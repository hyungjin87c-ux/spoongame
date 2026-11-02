import { runLife, summarize } from './trace.mjs';
const runs = [
  { name: 'g86 1965 재력3', generation: 'g86', wealth: 3, birthYear: 1965, region: '서울', seed: 6101, stopYear: 1988, want: ['1980년', '1987년'] },
  { name: 'genx 1975 재력2', generation: 'genx', wealth: 2, birthYear: 1975, region: '경북', seed: 6102, stopYear: 1988, want: ['1980년', '1987년'] },
  { name: 'alpha 2016 재력4', generation: 'alpha', wealth: 4, birthYear: 2016, region: '서울', seed: 6103, stopYear: 2023, want: ['2016년', '2017년', '2022년'] },
  { name: 'alpha 2016 재력1', generation: 'alpha', wealth: 1, birthYear: 2016, region: '전남', seed: 6104, stopYear: 2023, want: ['2016년', '2017년', '2022년'] },
];
for (const rr of runs) for (const gentle of [false, true]) {
  const r = await runLife({ ...rr, gentle, scale: 8 });
  const sum = summarize(r.trace);
  const out = [];
  for (const w of rr.want) { const y = sum.find((x) => x.yr === w); out.push(`${w}: ${y ? y.kind + ' ' + y.era + (y.hid === 'true' ? ' HIDDEN' : '') : '없음'}`); }
  // 로그 DOM 순서 검사
  const order = await r.page.evaluate(() => {
    const li = [...document.querySelectorAll('[data-testid="log-list"] li')];
    const rows = li.map((e) => ({ era: e.getAttribute('data-tl') === 'era', id: e.id, age: Number((e.textContent.match(/^(\d+)세/) || [])[1] ?? NaN), veiled: e.getAttribute('data-veiled'), live: e.getAttribute('aria-live') }));
    return rows;
  });
  let bad = [];
  for (let i = 1; i < order.length; i++) if (!Number.isNaN(order[i].age) && !Number.isNaN(order[i - 1].age) && order[i].age > order[i - 1].age) bad.push(`위로 갈수록 나이가 줄어듦 @${i}`);
  // 시대 줄은 같은 나이 묶음의 맨 아래여야 한다
  for (let i = 0; i < order.length - 1; i++) if (order[i].era && order[i + 1].age === order[i].age && !order[i + 1].era) bad.push(`시대 줄 ${order[i].id} 아래에 같은 나이 기록 줄 있음 @${i}`);
  console.log(`${rr.name} gentle=${gentle} |`, out.join(' ; '), '| rows', order.length, 'era rows', order.filter((o) => o.era).length, 'live!=off', order.filter((o) => o.era && o.live !== 'off').length, '| order issues', bad.length ? bad.slice(0, 3) : 0, '| errors', r.errors.length);
  await r.browser.close();
}
