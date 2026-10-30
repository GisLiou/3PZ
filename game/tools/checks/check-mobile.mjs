#!/usr/bin/env node
/**
 * 手機操作檢查（每次開發完都要跑）：以手機模擬（412×915、觸控）開啟 dist/，逐項檢查
 *  1. 瀏覽器「返回」不會離開遊戲或換頁（必須被遊戲內返回攔截）
 *  2. 舞台內沒有原生捲軸（overflow:auto/scroll）——捲動一律用 DragScroll 拖曳
 *  3. viewport 禁止縮放、根節點 touch-action:none
 *  4. 沒有 JS 錯誤、沒有 404 素材
 * 用法：先 npm run build，再 node tools/checks/check-mobile.mjs [網址，預設 http://localhost:4173/]
 */
import { chromium } from 'playwright';

const url = process.argv[2] || 'http://localhost:4173/';
const b = await chromium.launch();
const pg = await b.newPage({ viewport: { width: 412, height: 915 }, isMobile: true, hasTouch: true });
const problems = [];
pg.on('pageerror', (e) => problems.push(`JS 錯誤：${e.message}`));
pg.on('response', (r) => { if (r.status() >= 400) problems.push(`${r.status()}：${decodeURIComponent(r.url())}`); });

await pg.goto(url);
await pg.waitForTimeout(2500);

const vp = await pg.$eval('meta[name=viewport]', (m) => m.content);
if (!/user-scalable=no/.test(vp)) problems.push('viewport 未禁止縮放');
const ta = await pg.evaluate(() => getComputedStyle(document.body).touchAction);
if (ta !== 'none') problems.push(`body touch-action 應為 none，目前 ${ta}`);

const native = await pg.evaluate(() => [...document.querySelectorAll('#stage *')]
  .filter((e) => /(auto|scroll)/.test(getComputedStyle(e).overflowY)).map((e) => e.className || e.tagName));
if (native.length) problems.push(`發現原生捲動元素：${native.join(', ')}`);

const before = pg.url();
await pg.goBack().catch(() => {});
await pg.waitForTimeout(400);
if (pg.url() !== before || !(await pg.$('#stage'))) problems.push('瀏覽器返回離開了遊戲');

await b.close();
if (problems.length) { console.error('✗ 手機操作檢查未通過\n- ' + problems.join('\n- ')); process.exit(1); }
console.log('✓ 手機操作檢查通過');
