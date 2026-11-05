// 알파 2016년생 재력 W: 스냅숏 나이에서 시작해 자동 8배속으로 끝까지 — 해마다 창 그림·맨 위 시대 줄(칩·근거 종류)을 기록한다
import { chromium, webkit, newPage, inject, settle, specLines } from './lib.mjs';
import { readFileSync } from 'node:fs';
const U = specLines();
const W = Number(process.argv[2] ?? 3);
const startAge = Number(process.argv[3] ?? 9);
const engine = process.argv[4] === 'webkit' ? webkit : chromium;
const RECORDER = `(() => {
  const rec = {}; window.__rec = rec;
  const snap = () => {
    const yrTxt = document.querySelector('.scene__year time')?.textContent ?? ''; const yr = Number(yrTxt.replace(/[^0-9]/g, '')); if (!yr) return;
    const era = document.querySelector('#scene-era');
    const row = document.querySelector('#log-y' + yr);
    rec[yr] = { era: era?.getAttribute('data-era') ?? null, empty: era?.getAttribute('data-empty') ?? null, hidden: era?.getAttribute('data-hidden') ?? null, fut: era?.getAttribute('data-future') ?? null, end: era?.tagName === 'A' ? 'A' : era?.tagName ?? null, title: era?.getAttribute('title') ?? null,
      rowLine: row?.querySelector('.log__sent')?.textContent ?? null, chip: row ? !!row.querySelector('[data-testid="chip-fc"]') : null, basis: row?.querySelector('.log__basis')?.textContent ?? null, rowCount: document.querySelectorAll('[data-tl="era"]').length, age: document.querySelector('[data-testid="life-age"]')?.textContent?.trim() ?? '' };
  };
  const start = () => { new MutationObserver(snap).observe(document.body, { subtree: true, childList: true, attributes: true, characterData: true }); snap(); };
  if (document.body) start(); else document.addEventListener('DOMContentLoaded', start);
})();`;
const { browser, page, errors } = await newPage(engine, { width: 1280, height: 800 });
await page.addInitScript(RECORDER);
const st = { ...JSON.parse(readFileSync(`qa/scripts/010/states/snaps-W${W}.json`, 'utf8')).snaps[startAge], paused: false };
await inject(page, st, { speed: 8, autoMode: true, noteCards: false }, '/?__timescale=60');
const t0 = Date.now(); let ended = false;
while (Date.now() - t0 < 300000) {
  if (await page.getByTestId('ending-screen').isVisible().catch(() => false)) { ended = true; break; }
  await page.waitForTimeout(400);
}
const rec = await page.evaluate(() => window.__rec).catch(() => ({}));
const years = Object.keys(rec).map(Number).sort((a, b) => a - b);
let noChip = [], emptyYears = [], chipBad = [], run3 = [], lines = [];
for (const y of years) {
  const r = rec[y];
  const isFc = y >= 2027 && y <= 2109;
  if (r.empty === 'true') emptyYears.push(y);
  if (r.rowLine !== null) { if (isFc && !r.chip) noChip.push(y); if (!isFc && r.chip) chipBad.push(y); }
  lines.push(`${y}:${U.get(r.rowLine ?? '') ?? (r.rowLine ? '?' : '-')}${r.chip ? '*' : ''}`);
}
for (let i = 2; i < years.length; i++) { const a = rec[years[i - 2]], b = rec[years[i - 1]], c = rec[years[i]]; if (a.era && a.era === b.era && b.era === c.era) run3.push(`${years[i - 2]}-${years[i]} ${a.era}`); }
console.log(`${process.argv[4] ?? 'chromium'} W${W} 시작 나이 ${startAge}: 끝남 ${ended}, 기록한 해 ${years[0]}~${years.at(-1)} (${years.length}), 칩 없는 2027~2109 줄 ${noChip.length} ${noChip.slice(0, 5)}, 칩 있는 2026·2110 줄 ${chipBad.length} ${chipBad}, 창이 빈 틀인 해 ${emptyYears.length} ${emptyYears.slice(0, 8)}, 같은 그림 3해 연속 ${run3.length} ${run3.slice(0, 3)}, errors ${errors.length} ${errors.slice(0, 2)}`);
console.log('해:줄(U번호, *=칩)', lines.join(' '));
const last = rec[years.at(-1)]; console.log('마지막 해', years.at(-1), JSON.stringify(last));
await browser.close();
