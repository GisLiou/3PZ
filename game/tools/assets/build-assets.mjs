#!/usr/bin/env node
/**
 * 素材轉檔：把 ../遊戲素材（原版，內容不修改）與 ../自製素材 轉成遊戲可用的格式，輸出到 public/。
 *   圖片 png  → public/assets/<原路徑>.webp（品質 92，保留透明），並寫 public/assets/manifest.json
 *   BGM  ogg  → public/bgm/<檔名>.mp3（iOS 不支援 ogg；需要 ffmpeg）
 *   語音 mp3  → public/voice/<原路徑>.mp3（不進安裝包，供「語音下載」使用），並寫 voice-index.json
 * 已轉過且來源沒變的檔案會略過，可重複執行。單一檔案失敗不會中斷整體，最後統一列出。
 *
 * 用法：node tools/assets/build-assets.mjs [--only=assets|bgm|voice] [--clean]
 *   --only=…  只執行其中一步
 *   --clean   刪除 public/ 裡已經沒有來源的舊檔（例如素材改名後留下的舊路徑）
 *
 * 輸出：
 *   終端機           每一步一條進度列，結束時一張總表；失敗與過期檔案另外列出
 *   build-assets.log 每個檔案的處理結果（轉檔／略過／失敗／過期／刪除），可用編輯器搜尋
 *   結束代碼         有任何失敗為 1，否則為 0（CI 依此判斷）
 */
import { readdir, stat, mkdir, writeFile, copyFile, rm, rmdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, dirname, relative, extname, basename } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const run = promisify(execFile);
const HERE = dirname(fileURLToPath(import.meta.url));
const GAME = join(HERE, '..', '..'); // tools/assets → game
const ROOT = join(GAME, '..'); // 專案根目錄
const SRC = join(ROOT, '遊戲素材');
const SELF = join(ROOT, '自製素材');
const PUB = join(GAME, 'public');
const LOG_FILE = join(GAME, 'build-assets.log');

const args = process.argv.slice(2);
const only = (args.find((arg) => arg.startsWith('--only=')) || '').slice('--only='.length);
const shouldClean = args.includes('--clean');
const IMAGE_CONCURRENCY = 8;
const AUDIO_CONCURRENCY = 4;
const MAX_FAILURES_SHOWN = 15;
const FFMPEG_HINT = '找不到 ffmpeg。請先安裝（Windows：winget install --id Gyan.FFmpeg --source winget），重開終端機後再執行';

// ───────────────────────── 終端機輸出 ─────────────────────────

/** 互動式終端機才用單行刷新的進度列；CI 或導向檔案時改為每 10% 印一行 */
const isInteractive = Boolean(process.stdout.isTTY) && !process.env.CI;
const useColor = Boolean(process.stdout.isTTY) && !process.env.NO_COLOR;
const paint = (code) => (text) => (useColor ? `\x1b[${code}m${text}\x1b[0m` : String(text));
const color = { green: paint(32), yellow: paint(33), red: paint(31), cyan: paint(36), dim: paint(2), bold: paint(1) };

const formatDuration = (ms) => {
  const seconds = Math.round(ms / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
};
const formatBytes = (bytes) => (bytes >= 1048576 ? `${(bytes / 1048576).toFixed(1)} MB` : `${Math.round(bytes / 1024)} KB`);
/** 顯示用路徑：相對專案根目錄、一律用 / */
const displayPath = (file) => relative(ROOT, file).split('\\').join('/');
/** 終端機顯示寬度（中日文佔 2 格），表格才對得齊 */
const displayWidth = (text) => [...text].reduce((width, char) => width + (char.codePointAt(0) > 0x2e7f ? 2 : 1), 0);
const padEndDisplay = (text, width) => text + ' '.repeat(Math.max(0, width - displayWidth(text)));
const padStartDisplay = (text, width) => ' '.repeat(Math.max(0, width - displayWidth(text))) + text;

// ───────────────────────── 記錄檔 ─────────────────────────

const logLines = [];
/** 寫一行到 build-assets.log；level 固定兩個中文字，方便搜尋（例：搜「失敗」） */
const log = (level, message) => logLines.push(`${new Date().toISOString()}  ${level}  ${message}`);
const LOG_LEVEL = { converted: '轉檔', skipped: '略過', failed: '失敗' };

/** @type {{ step: string, file: string, message: string }[]} */
const failures = [];

// ───────────────────────── 進度列 ─────────────────────────

class StepProgress {
  constructor(label, total) {
    this.label = label;
    this.total = total;
    this.counts = { converted: 0, skipped: 0, failed: 0 };
    this.startedAt = performance.now();
    this.lastRenderAt = 0;
    this.lastPrintedDecile = -1;
  }

  get done() {
    return this.counts.converted + this.counts.skipped + this.counts.failed;
  }

  /** @param {'converted'|'skipped'|'failed'} result */
  tick(result) {
    this.counts[result]++;
    this.render();
  }

  line() {
    const percent = this.total ? Math.floor((this.done * 100) / this.total) : 100;
    const barWidth = 24;
    const filled = Math.round((barWidth * percent) / 100);
    const bar = color.cyan('█'.repeat(filled)) + color.dim('░'.repeat(barWidth - filled));
    const count = `${String(this.done).padStart(String(this.total).length)}/${this.total}`;
    const { converted, skipped, failed } = this.counts;
    const detail = color.dim(`轉檔 ${converted} · 略過 ${skipped}`) + (failed ? color.dim(' · ') + color.red(`失敗 ${failed}`) : '');
    const elapsed = color.dim(formatDuration(performance.now() - this.startedAt));
    return `  ${padEndDisplay(this.label, 6)} ${bar} ${count} ${String(percent).padStart(3)}%  ${detail}  ${elapsed}`;
  }

  render(force = false) {
    if (isInteractive) {
      const now = performance.now();
      if (!force && now - this.lastRenderAt < 80) return; // 太頻繁刷新反而拖慢
      this.lastRenderAt = now;
      process.stdout.write(`\r\x1b[2K${this.line()}`);
      return;
    }
    const decile = this.total ? Math.floor((this.done * 10) / this.total) : 10;
    if (decile !== this.lastPrintedDecile || force) {
      this.lastPrintedDecile = decile;
      console.log(this.line());
    }
  }

  /** 結束這一步，回傳給總表用的統計 */
  finish(extra = {}) {
    if (isInteractive) {
      this.render(true);
      process.stdout.write('\n');
    } else if (this.lastPrintedDecile !== 10) this.render(true);
    return { label: this.label, total: this.total, ...this.counts, elapsedMs: performance.now() - this.startedAt, stale: 0, ...extra };
  }
}

/**
 * 處理單一檔案：成功回傳 'converted'／'skipped'，失敗只記錄、不中斷整體。
 * @param {StepProgress} progress
 * @param {string} file 來源檔
 * @param {() => Promise<'converted'|'skipped'>} work
 */
async function processFile(progress, file, work) {
  let result;
  try {
    result = await work();
  } catch (error) {
    result = 'failed';
    const message = String(error?.message || error).split('\n')[0];
    failures.push({ step: progress.label, file: displayPath(file), message });
    log(LOG_LEVEL.failed, `[${progress.label}] ${displayPath(file)} — ${message}`);
  }
  if (result !== 'failed') log(LOG_LEVEL[result], `[${progress.label}] ${displayPath(file)}`);
  progress.tick(result);
}

// ───────────────────────── 檔案工具 ─────────────────────────

async function* walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(path);
    else yield path;
  }
}
/** 輸出檔存在且不比來源舊 → 不用重轉 */
const isUpToDate = async (source, output) => existsSync(output) && (await stat(output)).mtimeMs >= (await stat(source)).mtimeMs;
/** 素材 id：相對路徑、/ 分隔、去副檔名 */
const assetId = (base, file) => relative(base, file).split('\\').join('/').replace(/\.[^.]+$/, '');
/** 輸出檔名：開發伺服器無法提供含「&」的路徑，檔名中的 & 改成 _and_（素材 id 不變） */
const safeName = (text) => text.replaceAll('&', '_and_');
const encodeUrlPath = (text) => safeName(text).split('/').map(encodeURIComponent).join('/');

async function runPool(items, concurrency, worker) {
  let next = 0;
  await Promise.all(Array.from({ length: concurrency }, async () => {
    while (next < items.length) await worker(items[next++]);
  }));
}

/**
 * 找出輸出資料夾裡「已經沒有來源」的檔案（例如素材改名後留下的舊路徑）。
 * 加 --clean 時直接刪除，並刪掉因此變空的資料夾。
 */
async function handleStaleOutputs(stepLabel, outputDir, expectedOutputs, keepNames = []) {
  if (!existsSync(outputDir)) return 0;
  const staleFiles = [];
  for await (const file of walk(outputDir)) {
    if (!expectedOutputs.has(file) && !keepNames.includes(basename(file))) staleFiles.push(file);
  }
  for (const file of staleFiles) {
    if (shouldClean) {
      await rm(file, { force: true });
      log('刪除', `[${stepLabel}] ${displayPath(file)}`);
    } else log('過期', `[${stepLabel}] ${displayPath(file)}`);
  }
  if (shouldClean && staleFiles.length) await removeEmptyDirectories(outputDir);
  return staleFiles.length;
}

async function removeEmptyDirectories(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) await removeEmptyDirectories(join(dir, entry.name));
  }
  if ((await readdir(dir)).length === 0) await rmdir(dir).catch(() => {});
}

// ───────────────────────── 三個步驟 ─────────────────────────

async function buildImages() {
  const jobs = [];
  for (const [base, prefix] of [[SRC, ''], [SELF, '自製素材/']]) {
    if (!existsSync(base)) continue;
    for await (const file of walk(base)) {
      if (extname(file).toLowerCase() === '.png') jobs.push({ file, key: prefix + assetId(base, file) });
    }
  }
  if (!jobs.length) throw new Error(`「遊戲素材」裡沒有任何 png：${SRC}`);

  const progress = new StepProgress('圖片', jobs.length);
  const manifest = {};
  const expectedOutputs = new Set();
  await runPool(jobs, IMAGE_CONCURRENCY, async ({ file, key }) => {
    const output = join(PUB, 'assets', safeName(key) + '.webp');
    expectedOutputs.add(output);
    await processFile(progress, file, async () => {
      await mkdir(dirname(output), { recursive: true });
      const image = sharp(file, { limitInputPixels: false });
      const metadata = await image.metadata();
      const upToDate = await isUpToDate(file, output);
      if (!upToDate) await image.webp({ quality: 92, alphaQuality: 100, effort: 4 }).toFile(output);
      manifest[key] = { url: './assets/' + encodeUrlPath(key) + '.webp', w: metadata.width, h: metadata.height };
      return upToDate ? 'skipped' : 'converted';
    });
  });

  await mkdir(join(PUB, 'assets'), { recursive: true });
  const sortedManifest = Object.fromEntries(Object.keys(manifest).sort().map((key) => [key, manifest[key]]));
  await writeFile(join(PUB, 'assets', 'manifest.json'), JSON.stringify(sortedManifest));
  log('完成', `[圖片] manifest.json ${Object.keys(sortedManifest).length} 筆`);
  const stale = await handleStaleOutputs('圖片', join(PUB, 'assets'), expectedOutputs, ['manifest.json']);
  return progress.finish({ stale });
}

async function buildBackgroundMusic() {
  const sourceDir = join(SRC, 'BGM');
  const names = (await readdir(sourceDir)).filter((name) => name.toLowerCase().endsWith('.ogg'));
  const progress = new StepProgress('BGM', names.length);

  try {
    await run('ffmpeg', ['-version']);
  } catch {
    // 沒有 ffmpeg：整步略過，但不影響後面的語音
    for (const name of names) {
      failures.push({ step: 'BGM', file: displayPath(join(sourceDir, name)), message: '找不到 ffmpeg' });
      progress.counts.failed++;
    }
    log(LOG_LEVEL.failed, `[BGM] ${FFMPEG_HINT}`);
    const summary = progress.finish({ error: FFMPEG_HINT });
    return summary;
  }

  const outputDir = join(PUB, 'bgm');
  await mkdir(outputDir, { recursive: true });
  const expectedOutputs = new Set();
  await runPool(names, AUDIO_CONCURRENCY, async (name) => {
    const source = join(sourceDir, name);
    const output = join(outputDir, name.replace(/\.ogg$/i, '.mp3'));
    expectedOutputs.add(output);
    await processFile(progress, source, async () => {
      if (await isUpToDate(source, output)) return 'skipped';
      await run('ffmpeg', ['-v', 'error', '-y', '-i', source, '-codec:a', 'libmp3lame', '-q:a', '4', output]);
      return 'converted';
    });
  });
  const stale = await handleStaleOutputs('BGM', outputDir, expectedOutputs);
  return progress.finish({ stale });
}

async function buildVoice() {
  const sourceDir = join(SRC, '武將圖鑑語音');
  const sources = [];
  for await (const file of walk(sourceDir)) if (extname(file).toLowerCase() === '.mp3') sources.push(file);

  const progress = new StepProgress('語音', sources.length);
  const outputDir = join(PUB, 'voice');
  const files = {};
  const expectedOutputs = new Set();
  let totalBytes = 0;
  await runPool(sources, AUDIO_CONCURRENCY, async (source) => {
    const key = assetId(sourceDir, source);
    const output = join(outputDir, safeName(key) + '.mp3');
    expectedOutputs.add(output);
    await processFile(progress, source, async () => {
      await mkdir(dirname(output), { recursive: true });
      const upToDate = await isUpToDate(source, output);
      if (!upToDate) await copyFile(source, output);
      totalBytes += (await stat(source)).size;
      files[key] = './voice/' + encodeUrlPath(key) + '.mp3';
      return upToDate ? 'skipped' : 'converted';
    });
  });

  await mkdir(outputDir, { recursive: true });
  const sortedFiles = Object.fromEntries(Object.keys(files).sort().map((key) => [key, files[key]]));
  await writeFile(join(outputDir, 'voice-index.json'), JSON.stringify({ total: Object.keys(sortedFiles).length, bytes: totalBytes, files: sortedFiles }));
  log('完成', `[語音] voice-index.json ${Object.keys(sortedFiles).length} 筆、${formatBytes(totalBytes)}`);
  const stale = await handleStaleOutputs('語音', outputDir, expectedOutputs, ['voice-index.json']);
  return progress.finish({ stale });
}

// ───────────────────────── 總表 ─────────────────────────

function printSummary(summaries, totalMs) {
  const columns = ['步驟', '總數', '轉檔', '略過', '失敗', '過期', '耗時'];
  const rows = summaries.map((summary) => [
    summary.label, summary.total, summary.converted, summary.skipped, summary.failed, summary.stale, formatDuration(summary.elapsedMs),
  ].map(String));
  const widths = columns.map((column, index) => Math.max(displayWidth(column), ...rows.map((row) => displayWidth(row[index]))));
  const formatRow = (cells) => cells.map((cell, index) => (index === 0 ? padEndDisplay(cell, widths[index]) : padStartDisplay(cell, widths[index]))).join('   ');

  console.log('');
  console.log('  ' + color.bold(formatRow(columns)));
  console.log('  ' + color.dim(widths.map((width) => '─'.repeat(width)).join('───')));
  rows.forEach((cells, rowIndex) => {
    const summary = summaries[rowIndex];
    const text = formatRow(cells);
    console.log('  ' + (summary.failed ? color.red(text) : summary.stale ? color.yellow(text) : text));
  });

  const stepErrors = summaries.filter((summary) => summary.error);
  const fileFailures = failures.filter((failure) => !stepErrors.some((summary) => summary.label === failure.step));
  if (stepErrors.length || fileFailures.length) {
    console.log('');
    console.log(color.red(color.bold(`  ✗ 失敗 ${failures.length} 個`)));
    for (const summary of stepErrors) console.log(color.red(`    [${summary.label}] ${summary.error}`));
    for (const failure of fileFailures.slice(0, MAX_FAILURES_SHOWN)) {
      console.log(color.red(`    [${failure.step}] ${failure.file}`) + color.dim(` — ${failure.message}`));
    }
    if (fileFailures.length > MAX_FAILURES_SHOWN) console.log(color.dim(`    …其餘 ${fileFailures.length - MAX_FAILURES_SHOWN} 個見記錄檔（搜尋「失敗」）`));
  }

  const staleCount = summaries.reduce((sum, summary) => sum + summary.stale, 0);
  if (staleCount) {
    console.log('');
    if (shouldClean) console.log(color.yellow(`  已刪除 ${staleCount} 個沒有來源的舊檔`));
    else console.log(color.yellow(`  ! public/ 有 ${staleCount} 個沒有來源的舊檔（清單見記錄檔，搜尋「過期」）；執行 npm run assets -- --clean 可刪除`));
  }

  console.log('');
  console.log(color.dim(`  記錄檔：${displayPath(LOG_FILE)}`));
  const ok = failures.length === 0;
  console.log((ok ? color.green('  ✓ 完成') : color.red('  ✗ 完成（有失敗）')) + color.dim(`，總耗時 ${formatDuration(totalMs)}`));
}

// ───────────────────────── 主流程 ─────────────────────────

async function main() {
  const startedAt = performance.now();
  console.log('');
  console.log(color.bold('  3PZ 素材轉檔') + color.dim(`  ${displayPath(SRC)} → ${displayPath(PUB)}${only ? `（只執行 ${only}）` : ''}${shouldClean ? '（清除舊檔）' : ''}`));
  console.log('');

  // 原版素材資料夾必須存在（素材不會自動下載；見 README「開始開發」）
  const required = [SRC, join(SRC, 'BGM'), join(SRC, '武將圖鑑語音')];
  const missing = required.filter((dir) => !existsSync(dir));
  if (missing.length) {
    console.error(color.red(`  ✗ 找不到原版素材資料夾：\n    ${missing.join('\n    ')}\n  請先把「遊戲素材」資料夾放到專案根目錄（${ROOT}），再執行 npm run assets。`));
    process.exit(1);
  }

  const steps = [
    ['assets', buildImages],
    ['bgm', buildBackgroundMusic],
    ['voice', buildVoice],
  ];
  const summaries = [];
  for (const [name, buildStep] of steps) {
    if (!only || only === name) summaries.push(await buildStep());
  }

  await writeFile(LOG_FILE, logLines.join('\n') + '\n');
  printSummary(summaries, performance.now() - startedAt);
  process.exitCode = failures.length ? 1 : 0;
}

main().catch(async (error) => {
  if (isInteractive) process.stdout.write('\n');
  log('錯誤', String(error?.stack || error));
  await writeFile(LOG_FILE, logLines.join('\n') + '\n').catch(() => {});
  console.error(color.red(`\n  ✗ 轉檔中斷：${error?.message || error}`));
  console.error(color.dim(`  記錄檔：${displayPath(LOG_FILE)}`));
  process.exit(1);
});
