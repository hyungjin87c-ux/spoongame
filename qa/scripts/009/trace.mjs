// 한 판을 끝까지(자동 모드·빠른 시계) 돌리며 해마다 장면 카드·시대의 창·시대 줄을 기록한다.
import { chromium, inject, birthState, toLife, BASE } from './qalib.mjs';

const RECORDER = `
(() => {
  const trace = [];
  window.__trace = trace;
  let last = '';
  const snap = () => {
    const yr = document.querySelector('.scene__year time')?.textContent ?? '';
    if (!yr) return;
    const era = document.querySelector('#scene-era');
    const houseEl = document.querySelector('[data-testid="scene-house"] [data-layer="집"] [data-piece]');
    const house = houseEl?.getAttribute('data-piece') ?? '';
    const thatch = houseEl ? (houseEl.innerHTML.includes('Q 40,-92') ? 'thatch' : '') : '';
    const bg = document.querySelector('[data-testid="scene-house"] [data-layer="배경"] [data-piece]')?.getAttribute('data-piece') ?? '';
    const line = document.querySelector('[data-testid="scene-line"]')?.textContent ?? '';
    const eraRow = document.querySelector('[data-tl="era"]'); // 가장 위(최신) 시대 줄
    const s = JSON.stringify({
      yr, era: era?.getAttribute('data-era') ?? null, kind: era?.getAttribute('data-kind') ?? null, empty: era?.getAttribute('data-empty') ?? null,
      hid: era?.getAttribute('data-hidden') ?? null, house, thatch, bg, line,
      eraRow: eraRow ? (eraRow.id + ':' + (eraRow.getAttribute('aria-live') ?? '') + ':' + (eraRow.textContent ?? '').slice(0, 60)) : null,
      age: document.querySelector('[data-testid="life-age"]')?.textContent?.trim() ?? '',
    });
    if (s !== last) { last = s; trace.push(Object.assign(JSON.parse(s), { t: Math.round(performance.now()) })); }
  };
  const start = () => { new MutationObserver(() => snap()).observe(document.body, { subtree: true, childList: true, attributes: true, characterData: true }); snap(); };
  if (document.body) start(); else document.addEventListener('DOMContentLoaded', start);
})();
`;

export async function runLife(opt) {
  const { stopYear = 9999, generation, wealth, birthYear, region = '서울', seed, gentle = false, theme = 'light', viewport = { width: 1280, height: 800 }, scale = 60, maxMs = 240000, speed = 8, extra = {} } = opt;
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport, hasTouch: viewport.width < 500, colorScheme: theme === 'dark' ? 'dark' : 'light' });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text().slice(0, 200)); });
  await page.addInitScript(RECORDER);
  const st = birthState({ seed, generation, wealth, birthYear, region, lifeLength: opt.lifeLength ?? 'short30' });
  await inject(page, st, { speed, autoMode: true, gentle, theme, noteCards: false, ...extra }, `/?__timescale=${scale}`);
  await toLife(page);
  const t0 = Date.now();
  let ended = false;
  while (Date.now() - t0 < maxMs) {
    if (await page.getByTestId('ending-screen').isVisible().catch(() => false)) { ended = true; break; }
    const yrNow = await page.evaluate(() => Number((document.querySelector('.scene__year time')?.textContent ?? '0').replace(/[^0-9]/g, '')));
    if (yrNow >= stopYear) break;
    await page.waitForTimeout(500);
  }
  const trace = await page.evaluate(() => window.__trace).catch(() => []);
  const save = await page.evaluate((k) => JSON.parse(localStorage.getItem(k) || 'null'), 'suzeo-game:save');
  return { browser, ctx, page, trace, errors, ended, save };
}

export function summarize(trace) {
  // 해마다 마지막 상태를 모은다
  const byYear = new Map();
  for (const r of trace) byYear.set(r.yr, r);
  return [...byYear.values()];
}

if (process.argv[1] && process.argv[1].endsWith('trace.mjs')) {
  const [generation, wealth, birthYear, region, seed, gentle, scale, stopYear] = process.argv.slice(2);
  const r = await runLife({ generation, wealth: Number(wealth), birthYear: Number(birthYear), region, seed: Number(seed), gentle: gentle === 'gentle', scale: Number(scale || 60), stopYear: Number(stopYear || 9999) });
  console.log('ended', r.ended, 'errors', r.errors.length, r.errors.slice(0, 3));
  for (const y of summarize(r.trace)) console.log(y.yr, y.age, '|', y.kind, y.era ?? (y.empty === 'true' ? '(빈 틀)' : ''), y.hid === 'true' ? 'HIDDEN' : '', '|', y.house, y.thatch, '|', y.bg, '|', y.eraRow ?? '');
  await r.browser.close();
}
