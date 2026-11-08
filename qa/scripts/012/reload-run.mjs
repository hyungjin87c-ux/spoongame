// 진행 중(자동 8배속) 새로고침 연타 15회 + 뒤로가기: 나이가 거꾸로 가지 않고 판이 깨지지 않는다
import { chromium, newPage, inject, readSave, BASE } from './lib.mjs';
import { readFileSync } from 'node:fs';
const raw = JSON.parse(readFileSync('tests/fixtures/save-v040-mother-age20.json', 'utf8')).data;
const { browser, page, errors } = await newPage(chromium, { width: 360, height: 740 }, { hasTouch: true });
const st = { ...raw, paused: false }; delete st.play;
await inject(page, st, { speed: 8, autoMode: true, noteCards: false }, '/?__timescale=40');
await page.getByTestId('life-screen').waitFor({ state: 'visible' });
const ages = [];
for (let i = 0; i < 15; i++) {
  await page.waitForTimeout(700 + (i % 3) * 300);
  await page.reload({ waitUntil: 'domcontentloaded' });
  const s = await readSave(page);
  ages.push(s ? `${s.data.phase[0]}${s.data.age}` : 'null');
}
await page.goBack().catch(() => {});
await page.waitForTimeout(800);
const scr = await page.evaluate(() => document.querySelector('[data-testid$="-screen"]')?.dataset.testid);
const nums = ages.map((a) => Number(a.slice(1)));
const mono = nums.every((n, i) => i === 0 || n >= nums[i - 1]);
console.log(`${mono && errors.length === 0 ? 'PASS' : 'FAIL'} | 저장 나이 ${ages.join(',')} 단조 ${mono}, 마지막 화면 ${scr}, 오류 ${errors.length} ${errors.slice(0, 2)}`);
await browser.close();
