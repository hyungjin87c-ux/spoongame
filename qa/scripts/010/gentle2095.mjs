import { chromium, newPage, inject, settle } from './lib.mjs';
import { readFileSync } from 'node:fs';
const { browser, page, errors } = await newPage(chromium, { width: 1280, height: 800 });
for (const [age, y] of [[79, 2095], [69, 2085]]) for (const w of [1, 3, 5]) for (const gentle of [false, true]) {
  const st = JSON.parse(readFileSync(`qa/scripts/010/states/snaps-W${w}.json`, 'utf8')).snaps[age];
  await inject(page, st, { speed: 1, autoMode: false, noteCards: false, gentle }, '/?__timescale=1000');
  await page.getByTestId('life-screen').waitFor();
  await page.waitForFunction(() => document.querySelector('#scene-era')?.getAttribute('data-empty') !== 'true', null, { timeout: 12000 }).catch(() => {});
  await settle(page, 400);
  const r = await page.evaluate((y) => {
    const row = document.querySelector(`#log-y${y}`);
    return { eraId: document.querySelector('#scene-era')?.getAttribute('data-era'), rowText: row?.innerText.replace(/\s+/g, ' ') ?? '(행 없음)', hiddenAttr: row?.getAttribute('data-hidden'), chip: !!row?.querySelector('[data-testid="chip-fc"]'), whyBtn: !!row?.querySelector('[data-testid="why-btn"]'), veil: row?.querySelector('.veil, [data-veil], .log__veil') ? 'veil' : '', html: row ? row.className : '' };
  }, y);
  console.log(y, 'W' + w, gentle ? '가리기 켬' : '가리기 끔', r.eraId, '|', r.rowText.slice(0, 120), '| chip', r.chip, 'why', r.whyBtn, r.hiddenAttr ?? '', r.veil);
}
console.log('errors', errors);
await browser.close();
