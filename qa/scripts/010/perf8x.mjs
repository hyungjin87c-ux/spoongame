// 8배속·자동 모드에서 카드(식구·시대 줄·근거 칸 포함) 화면의 프레임: rAF 간격·긴 작업(longtask) 수
import { chromium, webkit, newPage, evalCore, inject, settle, BASE } from './lib.mjs';
import { readFileSync } from 'node:fs';
const engine = process.argv[2] === 'webkit' ? webkit : chromium;
const { browser, page, errors } = await newPage(engine, { width: Number(process.argv[3] ?? 1280), height: 800 });
const st = { ...JSON.parse(readFileSync('qa/scripts/010/states/snaps-W3.json', 'utf8')).snaps[28], paused: false };
await page.addInitScript(`(() => { window.__fr = []; window.__lt = []; let last = performance.now(); const tick = (t) => { window.__fr.push(t - last); last = t; requestAnimationFrame(tick); }; requestAnimationFrame(tick); try { new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__lt.push(Math.round(e.duration)); }).observe({ entryTypes: ['longtask'] }); } catch {} })();`);
await inject(page, st, { speed: 8, autoMode: true, noteCards: false }, '/?__timescale=3'); // 8배속 · 시간 3배(너무 짧게 끝나지 않게)
await page.getByTestId('life-screen').waitFor();
await settle(page, 1500);
await page.evaluate(() => { window.__fr.length = 0; window.__lt.length = 0; });
const t0 = Date.now();
while (Date.now() - t0 < 25000) { if (await page.getByTestId('ending-screen').isVisible().catch(() => false)) break; await page.waitForTimeout(500); }
const r = await page.evaluate(() => { const f = window.__fr.slice().sort((a, b) => a - b); const p = (q) => Math.round(f[Math.floor(f.length * q)] * 10) / 10; return { n: f.length, p50: p(0.5), p95: p(0.95), p99: p(0.99), max: Math.round(f.at(-1)), over100: f.filter((x) => x > 100).length, lt: window.__lt.length, ltMax: Math.max(0, ...window.__lt), age: document.querySelector('[data-testid="life-age"]')?.textContent?.trim() }; });
console.log(`${process.argv[2] ?? 'chromium'} ${process.argv[3] ?? 1280}px 8배속 자동: 프레임 ${r.n} p50 ${r.p50}ms p95 ${r.p95}ms p99 ${r.p99}ms 최대 ${r.max}ms, 100ms 넘는 프레임 ${r.over100}, 긴 작업 ${r.lt}개(최대 ${r.ltMax}ms), 끝 나이 ${r.age}, errors ${errors.length}`);
await browser.close();
