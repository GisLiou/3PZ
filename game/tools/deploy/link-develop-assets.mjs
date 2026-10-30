#!/usr/bin/env node
/**
 * 開發版（/develop/）素材整理：GitHub Pages 網站上限約 1 GB，素材不能放兩份完整的，
 * 但開發版也不可以覆蓋正式版（網站根目錄）的素材，否則 develop 的修改會弄壞 main 的遊戲。
 *
 * 做法：開發版有自己的 manifest.json／voice-index.json（放在 /develop/ 底下）。
 *   - 與正式版「內容完全相同」的檔案 → 網址指向正式版的檔案（../assets/…），不另存一份
 *   - 不同或新增的檔案 → 複製到 /develop/assets/…，只有開發版使用
 *   - BGM 沒有清單，直接複製一份到 /develop/bgm/（約 36 MB）
 * 正式版的檔案只會被「讀取比對」，這支程式永遠不會寫入正式版的資料夾。
 *
 * 用法：
 *   node tools/deploy/link-develop-assets.mjs --main-site=<網站根目錄> --out=<網站根目錄/develop> [--built=<public 資料夾>]
 *   --built 省略時：開發版素材與正式版相同，全部指向正式版。
 */
import { copyFile, mkdir, readFile, rm, stat, writeFile, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';

const args = Object.fromEntries(process.argv.slice(2).map((arg) => {
  const [key, ...rest] = arg.replace(/^--/, '').split('=');
  return [key, rest.join('=')];
}));
const mainSite = args['main-site'];
const outDir = args.out;
const builtDir = args.built || null;
if (!mainSite || !outDir) {
  console.error('用法：link-develop-assets.mjs --main-site=<網站根目錄> --out=<網站根目錄/develop> [--built=<public 資料夾>]');
  process.exit(1);
}

/** 網址（./assets/%E5…/x.webp）→ 相對於該資料夾的檔案路徑 */
const urlToRelativePath = (url, prefix) => url.slice(prefix.length).split('/').map(decodeURIComponent).join('/');

async function sameFile(a, b) {
  if (!existsSync(a) || !existsSync(b)) return false;
  const [sa, sb] = await Promise.all([stat(a), stat(b)]);
  if (sa.size !== sb.size) return false;
  const [ba, bb] = await Promise.all([readFile(a), readFile(b)]);
  return ba.equals(bb);
}

async function copyInto(source, target) {
  await mkdir(dirname(target), { recursive: true });
  await copyFile(source, target);
}

async function copyDirectory(source, target) {
  await mkdir(target, { recursive: true });
  for (const entry of await readdir(source, { withFileTypes: true })) {
    const from = join(source, entry.name), to = join(target, entry.name);
    if (entry.isDirectory()) await copyDirectory(from, to); else await copyFile(from, to);
  }
}

/**
 * 處理一份清單：entries 為 [id, 網址] 陣列，ownPrefix 為清單內網址的前綴（./assets/ 或 ./voice/），
 * sharedPrefix 為指向正式版時要換成的前綴。回傳新的 [id, 網址] 與統計。
 */
async function linkEntries(entries, { ownPrefix, sharedPrefix, mainFolder, builtFolder, outFolder }) {
  let shared = 0, own = 0;
  const result = [];
  for (const [id, url] of entries) {
    const relativePath = urlToRelativePath(url, ownPrefix);
    const mainFile = join(mainFolder, relativePath);
    if (!builtFolder || await sameFile(join(builtFolder, relativePath), mainFile)) {
      if (!builtFolder && !existsSync(mainFile)) throw new Error(`正式版缺少檔案：${mainFile}`);
      result.push([id, sharedPrefix + url.slice(ownPrefix.length)]);
      shared++;
    } else {
      await copyInto(join(builtFolder, relativePath), join(outFolder, relativePath));
      result.push([id, url]);
      own++;
    }
  }
  return { result, shared, own };
}

// ---------- 圖片 ----------
{
  const outFolder = join(outDir, 'assets');
  await rm(outFolder, { recursive: true, force: true });
  await mkdir(outFolder, { recursive: true });
  const source = builtDir ? join(builtDir, 'assets', 'manifest.json') : join(mainSite, 'assets', 'manifest.json');
  const manifest = JSON.parse(await readFile(source, 'utf8'));
  const { result, shared, own } = await linkEntries(Object.entries(manifest).map(([id, entry]) => [id, entry.url]), {
    ownPrefix: './assets/', sharedPrefix: '../assets/', mainFolder: join(mainSite, 'assets'), builtFolder: builtDir && join(builtDir, 'assets'), outFolder,
  });
  const linked = Object.fromEntries(result.map(([id, url]) => [id, { ...manifest[id], url }]));
  await writeFile(join(outFolder, 'manifest.json'), JSON.stringify(linked));
  console.log(`assets：共用正式版 ${shared}，開發版自有 ${own}`);
}

// ---------- 語音 ----------
{
  const outFolder = join(outDir, 'voice');
  await rm(outFolder, { recursive: true, force: true });
  await mkdir(outFolder, { recursive: true });
  const source = builtDir ? join(builtDir, 'voice', 'voice-index.json') : join(mainSite, 'voice', 'voice-index.json');
  if (existsSync(source)) {
    const index = JSON.parse(await readFile(source, 'utf8'));
    // 語音網址以 /develop/voice/ 為基準解析，指向正式版要往上兩層
    const { result, shared, own } = await linkEntries(Object.entries(index.files), {
      ownPrefix: './voice/', sharedPrefix: '../../voice/', mainFolder: join(mainSite, 'voice'), builtFolder: builtDir && join(builtDir, 'voice'), outFolder,
    });
    await writeFile(join(outFolder, 'voice-index.json'), JSON.stringify({ ...index, files: Object.fromEntries(result) }));
    console.log(`voice：共用正式版 ${shared}，開發版自有 ${own}`);
  } else console.log('voice：沒有 voice-index.json，略過');
}

// ---------- BGM ----------
{
  const outFolder = join(outDir, 'bgm');
  await rm(outFolder, { recursive: true, force: true });
  const source = builtDir ? join(builtDir, 'bgm') : join(mainSite, 'bgm');
  if (existsSync(source)) { await copyDirectory(source, outFolder); console.log('bgm：已複製'); }
}
