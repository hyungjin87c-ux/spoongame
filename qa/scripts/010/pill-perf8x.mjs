// QA-009-FM6-010 2회차: 8배속 자동 진행 중 알약(log-jump)이 뜬 채일 때 프레임 (REV-010-QAFIX-1 「QA에 넘길 것」 2, 1회차 P-F15 방식)
//   QA_BASE=... node qa/scripts/010/pill-perf8x.mjs <chromium|webkit> [폭=1280] [pill|nopill] [초=25]
// 기록을 아래로 스크롤해(읽는 중) 알약이 뜬 채로 8배속 자동을 돌린다. nopill은 같은 판을 스크롤 없이(맨 위) 돌려 비교한다.
import { chromium, webkit, newPage, inject, settle, BASE } from './lib.mjs';
import { readFileSync } from 'node:fs';
const engine = process.argv[2] === 'webkit' ? webkit : chromium;
const width = Number(process.argv[3] ?? 1280);
const mode = process.argv[4] === 'nopill' ? 'nopill' : 'pill';
const secs = Number(process.argv[5] ?? 25);
const { browser, page, errors } = await newPage(engine, { width, height: width < 500 ? 740 : 800 });
const st = { ...JSON.parse(readFileSync('qa/scripts/010/states/snaps-W3.json', 'utf8')).snaps[28], paused: false };
await page.addInitScript(`(() => { window.__fr = []; window.__lt = []; window.__pill = 0; window.__n = 0; let last = performance.now(); const tick = (t) => { window.__fr.push(t - last); last = t; window.__n++; if (document.querySelector('[data-testid="log-jump"]')) window.__pill++; requestAnimationFrame(tick); }; requestAnimationFrame(tick); try { new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__lt.push(Math.round(e.duration)); }).observe({ entryTypes: ['longtask'] }); } catch {} })();`);
await inject(page, { ...st, paused: true }, { speed: 8, autoMode: true, noteCards: false }, '/?__timescale=3');
await page.getByTestId('life-screen').waitFor();
await page.waitForFunction(() => document.querySelectorAll('[data-testid="log-row"], [data-tl]').length >= 8, null, { timeout: 20000 }).catch(() => {});
await settle(page, 300);
if (mode === 'pill') await page.getByTestId('log-list').evaluate((el) => el.scrollTo({ top: 260, behavior: 'instant' }));
await page.getByTestId('pause').click(); // 진행 시작
await settle(page, 1500);
await page.evaluate(() => { window.__fr.length = 0; window.__lt.length = 0; window.__pill = 0; window.__n = 0; });
const t0 = Date.now(); let ended = false;
while (Date.now() - t0 < secs * 1000) { if (await page.getByTestId('ending-screen').isVisible().catch(() => false)) { ended = true; break; } await page.waitForTimeout(500); }
const r = await page.evaluate(() => { const f = window.__fr.slice().sort((a, b) => a - b); const p = (q) => Math.round(f[Math.floor(f.length * q)] * 10) / 10; return { n: f.length, p50: p(0.5), p95: p(0.95), p99: p(0.99), max: Math.round(f.at(-1)), over100: f.filter((x) => x > 100).length, lt: window.__lt.length, ltMax: Math.max(0, ...window.__lt), pillFrames: window.__pill, frames: window.__n, age: document.querySelector('[data-testid="life-age"]')?.textContent?.trim(), pillNow: !!document.querySelector('[data-testid="log-jump"]'), pad: document.querySelector('[data-testid="log-list"]') ? getComputedStyle(document.querySelector('[data-testid="log-list"]')).scrollPaddingTop : null }; });
console.log(`${process.argv[2] ?? 'chromium'} ${width}px 8배속 자동 ${mode}: 프레임 ${r.n} (알약이 있던 프레임 ${r.pillFrames}/${r.frames}) p50 ${r.p50}ms p95 ${r.p95}ms p99 ${r.p99}ms 최대 ${r.max}ms, 100ms 넘는 프레임 ${r.over100}, 긴 작업 ${r.lt}개(최대 ${r.ltMax}ms), 끝 나이 ${r.age}${ended ? '(엔딩)' : ''}, 알약 지금 ${r.pillNow}, 위 여백 ${r.pad}, errors ${errors.length}`);
if (errors.length) console.log(errors.slice(0, 3));
await browser.close();
