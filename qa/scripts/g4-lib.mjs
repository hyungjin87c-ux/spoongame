// SPEC-004 GM4 QA(2026-10-28) 공용. src·tests는 건드리지 않고 브라우저로만 조작한다. 스크린샷은 FAIL 증거만.
import { chromium, webkit } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';
export const ROOT = path.resolve(import.meta.dirname, '..', '..');
export const RES = path.join(ROOT, 'qa', 'results', '004');
export const SHOT = path.join(ROOT, 'qa', 'screenshots', '004');
export const URL = process.env.QA_URL || 'http://localhost:4377/';
export const GAME_KEY = 'suzeo-game:save';
export const SETTINGS_KEY = 'suzeo-game:settings';
fs.mkdirSync(RES, { recursive: true }); fs.mkdirSync(SHOT, { recursive: true });
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export const VP = {
  d1280: { viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 },
  d1366: { viewport: { width: 1366, height: 768 }, deviceScaleFactor: 1 },
  m360: { viewport: { width: 360, height: 740 }, hasTouch: true, isMobile: true, deviceScaleFactor: 1 },
};
export async function open(vpKey = 'd1280', opts = {}) {
  const browser = await (opts.webkit ? webkit : chromium).launch({ headless: true });
  const ctx = await browser.newContext({ ...VP[vpKey], reducedMotion: opts.reduced ? 'reduce' : 'no-preference', locale: 'ko-KR' });
  const page = await ctx.newPage();
  const logs = [];
  page.on('console', (m) => { if (['error', 'warning'].includes(m.type())) logs.push(`${m.type()}: ${m.text()}`); });
  page.on('pageerror', (e) => logs.push('pageerror: ' + e.message));
  const reqs = [];
  ctx.on('request', (r) => reqs.push({ url: r.url(), type: r.resourceType() }));
  return { browser, ctx, page, logs, reqs };
}
export async function go(page, query = '') { await page.goto(URL + query, { waitUntil: 'load' }); await page.waitForSelector('[data-testid="title-screen"]'); }
export const cases = [];
export function rec(id, proc, expect, actual, result, shot = '-') {
  cases.push({ id, proc, expect, actual, result, shot });
  console.log(`[${result}] ${id} :: ${actual}`);
  fs.appendFileSync(path.join(RES, 'g4-cases.jsonl'), JSON.stringify({ id, proc, expect, actual, result, shot }) + '\n');
}
export async function shot(page, id) { const p = path.join(SHOT, id + '.png'); await page.screenshot({ path: p }); return `qa/screenshots/004/${id}.png`; }
