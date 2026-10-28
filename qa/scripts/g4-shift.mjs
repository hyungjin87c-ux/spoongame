import { VP, sleep, rec } from './g4-lib.mjs';
import { chromium } from 'playwright-core';
const U = 'http://localhost:4377/';
async function run(vpKey, delay) {
  const browser = await chromium.launch(); const ctx = await browser.newContext({ ...VP[vpKey] }); const page = await ctx.newPage();
  await page.addInitScript(() => {
    window.__ls = []; new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__ls.push({ v: e.value, t: Math.round(e.startTime), recent: e.hadRecentInput, src: (e.sources || []).map((s) => (s.node?.getAttribute?.('data-testid') || s.node?.nodeName || '?') + ':' + Math.round(s.previousRect.y) + '->' + Math.round(s.currentRect.y) + ' h' + Math.round(s.previousRect.height) + '->' + Math.round(s.currentRect.height)) }); }).observe({ type: 'layout-shift', buffered: true });
  });
  if (delay) await page.route('**/*.woff2', async (r) => { await sleep(delay); await r.continue(); });
  const pos = [];
  await page.goto(U, { waitUntil: 'commit' });
  const sample = async (label) => pos.push([label, await page.evaluate(() => { const g = (s) => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); return [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)]; }; return { head: g('[data-testid="title-heading"]'), list: g('[data-testid="gen-list"]'), row1: g('[data-testid="gen-row-random"]'), car: g('[data-testid="carousel"]'), fonts: [...document.fonts].filter((f) => f.status === 'loaded').length, w: document.documentElement.scrollWidth }; }).catch(() => null)]);
  await page.waitForSelector('[data-testid="title-screen"]', { timeout: 20000 });
  for (let i = 0; i < 12; i++) { await sample(`${i * 300}ms`); await sleep(300); }
  await sleep(1500); await sample('late');
  const ls = await page.evaluate(() => window.__ls);
  await browser.close();
  return { ls, pos };
}
for (const [vp, delay] of [['d1280', 0], ['d1280', 2500], ['m360', 2500]]) {
  const { ls, pos } = await run(vp, delay);
  const sum = ls.filter((e) => !e.recent).reduce((a, e) => a + e.v, 0);
  console.log(`== ${vp} delay=${delay} CLS=${sum.toFixed(4)} entries=${ls.length}`); console.log(JSON.stringify(ls));
  const interesting = pos.filter((p, i) => i === 0 || JSON.stringify(p[1]) !== JSON.stringify(pos[i - 1][1]));
  console.log(interesting.map((p) => p[0] + ' ' + JSON.stringify(p[1])).join('\n'));
  rec(`W-${vp}-${delay}`, `${vp} 글꼴 요청 ${delay}ms 지연, layout-shift 합`, '눈에 띄는 흔들림 없음(CLS < 0.1 권장)', `CLS=${sum.toFixed(4)} entries=${JSON.stringify(ls)}`, 'RECORD');
}
