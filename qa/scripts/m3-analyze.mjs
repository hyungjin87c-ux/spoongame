// 표본(samples-*.jsonl) 요약: 분포·극단 표본·실제 위반(검사 도구 오류 제외) 집계
import fs from 'node:fs';
import path from 'node:path';
import { OUT } from './m3-lib.mjs';
const out = {};
const FALSE_POS = [/외모 형식/, /서술문의 형제 순서와 격자 불일치.*다섯째 이상/];
for (const era of ['present', 'past', 'future']) {
  const f = path.join(OUT, `samples-${era}.jsonl`);
  const rows = fs.readFileSync(f, 'utf8').trim().split('\n').map((l) => JSON.parse(l));
  const tally = (fn) => rows.reduce((a, r) => { const k = fn(r); a[k] = (a[k] || 0) + 1; return a; }, {});
  const real = rows.filter((r) => (r.violations || []).some((v) => !FALSE_POS.some((re) => re.test(v))));
  const place = (r) => r.birth?.fields?.place?.value ?? '';
  const sorted = [...rows].sort((a, b) => place(b).length - place(a).length);
  const sentLen = [...rows].sort((a, b) => (b.birth?.sentence?.length ?? 0) - (a.birth?.sentence?.length ?? 0));
  const jobs = (r) => (r.birth?.fields?.mother?.value ?? '').split('·')[1]?.trim();
  const byDecade = {};
  if (era === 'past') for (const r of rows) { const y = Number(/(\d{4})/.exec(r.birth.fields.month.value)[1]); const d = Math.floor(y / 10) * 10; (byDecade[d] ||= { n: 0, regions: new Set() }); byDecade[d].n++; byDecade[d].regions.add(r.regionN); }
  out[era] = {
    n: rows.length,
    errors: rows.filter((r) => r.error).length,
    violationsRaw: rows.filter((r) => r.violations?.length).length,
    violationsReal: real.length,
    realList: real.slice(0, 5).map((r) => [r.seed, r.violations]),
    wealth: tally((r) => r.roulette?.wealthResult ?? '?'),
    order: tally((r) => r.birth?.fields?.order?.value ?? '?'),
    housing: tally((r) => r.birth?.fields?.housing?.value ?? '?'),
    regionN: tally((r) => r.regionN),
    regionResult: tally((r) => r.roulette?.regionResult ?? '?'),
    jobsMother: tally(jobs),
    longestPlaces: sorted.slice(0, 5).map((r) => [r.seed, place(r), r.roulette?.wealthResult]),
    longestSentence: sentLen.slice(0, 3).map((r) => [r.seed, r.birth.sentence.length]),
    ageMother: [Math.min(...rows.map((r) => r.save.mother.age)), Math.max(...rows.map((r) => r.save.mother.age))],
    ageFather: [Math.min(...rows.map((r) => r.save.father.age)), Math.max(...rows.map((r) => r.save.father.age))],
    weight: [Math.min(...rows.map((r) => r.save.weight)), Math.max(...rows.map((r) => r.save.weight))],
    birthYears: [Math.min(...rows.map((r) => r.save.birthYear)), Math.max(...rows.map((r) => r.save.birthYear))],
    months: tally((r) => r.save.month),
    fatherYounger: rows.filter((r) => r.save.father.age < r.save.mother.age).length,
    gap: tally((r) => r.save.father.age - r.save.mother.age >= 10 ? '>=10' : r.save.father.age - r.save.mother.age <= -5 ? '<=-5' : 'mid'),
    byDecade: Object.fromEntries(Object.entries(byDecade).map(([k, v]) => [k, { n: v.n, regionCells: [...v.regions] }])),
    jeonnam: rows.filter((r) => /전남광주통합특별시/.test(place(r))).length,
    sigunguSample: sorted.slice(0, 1).map(place),
    unionPlaces: [...new Set(rows.map(place).filter((p) => p.length >= 12))].slice(0, 12),
  };
}
fs.writeFileSync(path.join(OUT, 'samples-summary.json'), JSON.stringify(out, null, 1));
console.log(JSON.stringify(out, null, 1));
