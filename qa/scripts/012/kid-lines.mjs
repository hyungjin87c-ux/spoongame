// 0~6세·7~12세에게 나오는 시대 줄 전수(나이 제한 없는 장면) — 부록 A 밖에 아이에게 어색한 줄이 남았는지 눈으로 보려고 뽑는다
import { chromium, newPage, evalCore, BASE } from './lib.mjs';
const { browser, page } = await newPage(chromium);
await page.goto(BASE + '/');
const out = await evalCore(page, `
  const era = await import('/src/core/eraWindow.ts');
  const L = await import('/src/data/eraWindows/index.ts');
  const windows = []; for (const d of L.ERA_DECADES_WITH_DATA) windows.push(...(await L.ERA_DECADE_LOADERS[d]()).windows);
  const seen = new Map();
  for (let birth = 1940; birth <= 2026; birth++) for (const band of ['low','mid','high']) for (const seed of [1, 2, 3, 4]) {
    const ctx = { regionKey: '서울', gentle: false, seed, windows, birthYear: birth, band };
    for (let age = 0; age <= 12; age++) { const p = era.eraOf(birth + age, ctx); for (const k of ['line']) { const w = p[k]; if (w && w.line) { const key = w.id; const o = seen.get(key) ?? { id: w.id, line: w.line, ages: w.ages ?? null, min: 99, years: w.years }; o.min = Math.min(o.min, age); seen.set(key, o); } } }
  }
  return [...seen.values()].sort((a, b) => a.min - b.min || a.years[0] - b.years[0]);`);
const young = out.filter((o) => o.min <= 6);
console.log(`0~6세에게 나온 장면 ${young.length}개 (총 ${out.length}개 중, 7~12세까지 포함)`);
for (const o of young) console.log(`${o.min}세~ ${o.id} (${o.years.join('~')}) ${o.ages ? 'ages=' + o.ages.join('-') : ''} :: ${o.line}`);
await browser.close();
