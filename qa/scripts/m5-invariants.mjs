// QA-003 M5: 수확한 실제 저장(선택지 시점 1,110개 + 엔딩 48개 + 해마다 자산 기록)에서 경제 불변식과 판 전체의 모양을 센다.
//  불변식: 정수·범위·debt ≥ max(0, −net)·assets는 20세 이상에서만·집안 살림은 20세 미만에서만·dwelling 허용값·스탯 0~100 정수. 화면의 해마다 값(ageSeries)은 금액 글자 → 만 원으로 되읽어 같은 점검.
import fs from 'node:fs';
import path from 'node:path';
import { OUT, parseMan, addCase } from './m5-lib.mjs';

const runs = [];
for (const f of fs.readdirSync(OUT).filter((x) => /^samples-fix-.*\.jsonl$/.test(x))) for (const l of fs.readFileSync(path.join(OUT, f), 'utf8').trim().split('\n')) if (l) runs.push(JSON.parse(l));
const DW = ['family', 'rent', 'jeonse', 'own', 'care'];
const bad = [];
let raws = 0;
const check = (d, where) => {
  raws++;
  const isInt = Number.isInteger;
  if (d.assets === null) {
    if (d.age >= 20) bad.push(`${where}: 20세 이상인데 assets null`);
    if (!isInt(d.familyFund) || Math.abs(d.familyFund) > 3000) bad.push(`${where}: familyFund ${d.familyFund}`);
  } else {
    const a = d.assets;
    if (d.age < 20) bad.push(`${where}: 20세 미만인데 assets 있음`);
    if (d.familyFund !== 0) bad.push(`${where}: 20세 이상 familyFund ${d.familyFund}`);
    if (![a.net, a.income, a.debt, a.incomeAdj].every(isInt)) bad.push(`${where}: 정수 아님 ${JSON.stringify(a)}`);
    if (a.net < -200000 || a.net > 2000000 || a.income < 0 || a.income > 100000 || a.debt < 0 || a.debt > 1000000 || Math.abs(a.incomeAdj) > 10000) bad.push(`${where}: 범위 밖 ${JSON.stringify(a)}`);
    if (a.debt < Math.max(0, -a.net)) bad.push(`${where}: debt < −net ${JSON.stringify(a)}`);
    if (!DW.includes(a.dwelling)) bad.push(`${where}: dwelling ${a.dwelling}`);
  }
  for (const k of ['education', 'health', 'happiness', 'relationships']) if (!isInt(d.stats[k]) || d.stats[k] < 0 || d.stats[k] > 100) bad.push(`${where}: stats.${k} ${d.stats[k]}`);
  if ('wealth' in d.stats) bad.push(`${where}: 옛 wealth 키`);
};
const endings = [];
let series = 0;
const negDays = { past: 0, present: 0, future: 0 };
const years = { past: 0, present: 0, future: 0 };
for (const r of runs) {
  if (!r.fixtures) continue;
  r.fixtures.forEach((f, i) => check(JSON.parse(f.raw).data, `${r.era}-${r.seed}#${i}`));
  if (r.ending) {
    const d = JSON.parse(r.ending).data;
    check(d, `${r.era}-${r.seed} 엔딩`);
    endings.push({ era: r.era, seed: r.seed, tier: d.character.parentWealth, age: d.age, net: d.assets?.net ?? null, debt: d.assets?.debt ?? null });
  }
  for (const s of r.ageSeries) {
    if (!s.assets) continue;
    series++;
    const n = parseMan(s.assets.net);
    const inc = parseMan(s.assets.income);
    const debt = parseMan(s.assets.debt);
    if ([n, inc, debt].some((x) => x === null || Number.isNaN(x))) bad.push(`${r.era}-${r.seed} ${s.age}세: 금액 글자를 못 읽음 ${JSON.stringify(s.assets)}`);
    else if (debt < Math.max(0, -n)) bad.push(`${r.era}-${r.seed} ${s.age}세: 화면의 부채 ${s.assets.debt} < −순자산 ${s.assets.net}`);
    if (n < 0) negDays[r.era]++;
    years[r.era]++;
  }
}
const byEra = {};
for (const e of endings) {
  const k = e.era;
  byEra[k] ??= { n: 0, neg: 0, zero: 0, pos: 0 };
  byEra[k].n++;
  if (e.net < 0) byEra[k].neg++;
  else if (e.net === 0) byEra[k].zero++;
  else byEra[k].pos++;
}
const byTier = {};
for (const e of endings) {
  byTier[e.tier] ??= [];
  byTier[e.tier].push(e.net);
}
const med = (a) => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)];
console.log(JSON.stringify({ raws, series, endings: endings.length, byEra, tierMedians: Object.fromEntries(Object.entries(byTier).map(([t, a]) => [t, { n: a.length, med: med(a) }])), negShare: Object.fromEntries(Object.keys(years).map((e) => [e, Math.round((100 * negDays[e]) / years[e]) + '%'])) }, null, 1));
addCase({ id: 'M5-N06', cat: '정상', title: `경제 불변식: 실제 플레이 ${runs.length}판의 저장 ${raws}개(선택지 시점 ${raws - endings.length}·엔딩 ${endings.length})와 화면 자산 기록 ${series}개 — 정수·범위·debt ≥ max(0, −순자산)·assets는 20세 이상만·옛 wealth 없음`, steps: '세 시대 × 16판(시드 1~16, 선택은 섞음)을 개발 서버 시간 배율 60·8배속으로 끝까지 돌려 선택지 때마다 저장 원문을, 해마다 자산 카드 글자를 기록한 뒤 점검', expected: '위반 0', verdict: bad.length ? 'FAIL' : 'PASS', actual: bad.length ? bad.slice(0, 6).join(' / ') + ` (총 ${bad.length})` : `위반 0. 엔딩 ${endings.length}개 순자산 부호 ${JSON.stringify(byEra)}`, shots: [] });
