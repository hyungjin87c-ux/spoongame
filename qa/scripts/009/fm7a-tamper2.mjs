// 변조 저장이 열린 뒤 가족 카드의 「떠난 가족」·로그(family.l)가 정상 판과 같은가 (고쳐 읽었는가)
import { chromium, boot, readSave } from './fm7a-lib.mjs';
import { readFileSync } from 'node:fs';
const load = (k) => JSON.parse(readFileSync(`${process.env.QA_STATES}/${k}.json`, 'utf8'));
const b = await chromium.launch();
const muts = {
  '정상': () => {},
  '로그 범위 밖 [3,999,10,99]': (d) => { d.family.l = [...(d.family.l ?? []), [3, 999, 10, 99]]; },
  '없는 형제 [3,5,30,4]': (d) => { d.family.l = [...(d.family.l ?? []), [3, 5, 30, 4]]; },
  '종류 3 두 번': (d) => { d.family.l = [...(d.family.l ?? []), [3, 3, 10, 5], [3, 4, 11, 5]]; },
  'lg=2': (d) => { d.family.lg = 2; },
  'p[1].d=0': (d) => { d.family.p[1].d = 0; },
};
for (const [label, fn] of Object.entries(muts)) {
  const st = load('T06-male-형-industrial');
  st.data.paused = true;
  fn(st.data);
  const { ctx, page, errors } = await boot(b, st, { scale: 1, settings: { speed: 1, autoMode: false } });
  await page.getByTestId('life-screen').waitFor({ timeout: 10000 }).catch(() => {});
  await page.waitForTimeout(600);
  const gone = await page.evaluate(() => [...document.querySelectorAll('[data-testid="family-gone"] dt')].map((dt) => dt.textContent.trim() + ':' + (dt.nextElementSibling?.innerText ?? '').replace(/\s+/g, ' ')));
  const alive = await page.evaluate(() => [...document.querySelectorAll('[data-testid="family-list"] dt')].map((dt) => dt.textContent.trim()).join(','));
  const sv = await readSave(page);
  console.log(`${label.padEnd(24)} 나이 ${sv?.data?.age} | 식구 ${alive} | 떠난 가족 ${JSON.stringify(gone)} | family.l ${JSON.stringify(sv?.data?.family?.l)} lg ${sv?.data?.family?.lg} | errors ${errors.length}`);
  await ctx.close();
}
await b.close();
