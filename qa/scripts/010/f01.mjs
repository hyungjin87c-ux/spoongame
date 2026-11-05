// QA-009-FM4b F01 재현 판: 알파 2016생 재력 2 14세 2030년 — 기록 전체에서 「물류센터」·「셔틀」 줄 0, 2030년 줄은 구간에 맞는 U번호. 재력 1·2·3·4·5 모두
import { chromium, newPage, inject, settle, specLines } from './lib.mjs';
import { readFileSync } from 'node:fs';
const U = specLines();
const { browser, page, errors } = await newPage(chromium, { width: 1280, height: 800 });
for (const w of [1, 2, 3, 4, 5]) {
  const st = JSON.parse(readFileSync(`qa/scripts/010/states/snaps-W${w}.json`, 'utf8')).snaps[14];
  await inject(page, { ...st, paused: true }, { speed: 1, autoMode: false, noteCards: false }, '/?__timescale=1000');
  await page.getByTestId('life-screen').waitFor();
  await page.waitForFunction(() => document.querySelector('#log-y2030') !== null, null, { timeout: 15000 }).catch(() => {});
  await settle(page, 300);
  const r = await page.evaluate(() => ({ all: document.querySelector('[data-testid="log-list"]').innerText, row2030: document.querySelector('#log-y2030 .log__sent')?.textContent, rows: [...document.querySelectorAll('[data-tl="era"] .log__sent')].map((e) => e.textContent) }));
  const bad = r.all.match(/물류센터|셔틀/g) ?? [];
  console.log(`W${w} 14세: 물류센터·셔틀 글자 ${bad.length}개, 2030년 줄 → ${U.get(r.row2030 ?? '') ?? '?'} 「${r.row2030}」, 시대 줄 ${r.rows.length}개`);
}
console.log('errors', errors);
await browser.close();
