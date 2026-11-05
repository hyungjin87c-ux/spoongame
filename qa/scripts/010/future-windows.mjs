// 해 × 재력 1·3·5의 창(시대의 창): 알파 2016년생 진짜 인생의 나이별 스냅숏(snaps.mjs)을 그해에 멈춰 두고 그림 id·U번호·칩·가리기를 읽는다
import { chromium, newPage, inject, BASE, specLines, settle } from './lib.mjs';
import { readFileSync } from 'node:fs';
const U = specLines();
const gentle = process.argv.includes('gentle');
const AGE_OF = { 2026: 10, 2030: 14, 2044: 28, 2050: 34, 2065: 49, 2075: 59, 2085: 69, 2095: 79, 2100: 84, 2108: 92, 2109: 93, 2110: 94 };
const YEARS = (process.argv.find((a) => /^\d{4}(,\d{4})*$/.test(a)) ?? Object.keys(AGE_OF).join(',')).split(',').map(Number);
const { browser, page, errors } = await newPage(chromium, { width: 1280, height: 800 });
const out = [];
for (const y of YEARS) for (const w of [1, 3, 5]) {
  const snaps = JSON.parse(readFileSync(`qa/scripts/010/states/snaps-W${w}.json`, 'utf8')).snaps;
  const st = snaps[AGE_OF[y]];
  await inject(page, st, { speed: 1, autoMode: false, noteCards: false, gentle }, '/?__timescale=1000');
  await page.getByTestId('life-screen').waitFor({ timeout: 20000 });
  await page.waitForSelector('[data-testid="family-scene"][data-scene-art="ready"], [data-testid="family-scene"][data-scene-art="failed"]', { timeout: 20000 }).catch(() => {});
  await page.waitForFunction(() => { const e = document.querySelector('#scene-era'); return e && e.getAttribute('data-empty') !== 'true'; }, null, { timeout: 12000 }).catch(() => {});
  await settle(page, 300);
  const r = await page.evaluate(() => {
    const era = document.querySelector('#scene-era');
    const fc = !!document.querySelector('#scene-era [data-testid="era-fc"]');
    return { id: era?.getAttribute('data-era'), kind: era?.getAttribute('data-kind'), dec: era?.getAttribute('data-dec'), fut: era?.getAttribute('data-future'), hid: era?.getAttribute('data-hidden'), empty: era?.getAttribute('data-empty'), end: era?.getAttribute('data-end'), name: era?.getAttribute('title'), rowLine: document.querySelector('.log__row--tl[data-tl="era"] .log__sent')?.textContent ?? '', rowChip: !!document.querySelector('.log__row--tl[data-tl="era"] [data-testid="chip-fc"]'), fc, yr: document.querySelector('.scene__year time')?.textContent, link: era?.tagName };
  });
  const base = (r.name ?? '').replace(/^시대의 창 · (예측: )?/, '').replace(/ 그해 기록으로$/, '');
  const u = U.get(base) ?? '?';
  out.push({ y, w, u, ...r });
  console.log(y, 'W' + w, u.padEnd(4), (r.id ?? '(없음)').padEnd(40), `${r.kind} dec=${r.dec} fut=${r.fut} fc=${r.fc} hid=${r.hid} empty=${r.empty} end=${r.end} <${r.link}> ${r.yr}`, '|', base);
}
console.log('errors', errors.length, errors.slice(0, 3));
await browser.close();
