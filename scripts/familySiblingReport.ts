import { GENERATION_IDS, siblingCountOf, inheritanceAmount, type ProfileId } from '../src/core';
import { simulateLife } from './simulateLib';
import { spreadSeeds } from '../tests/helpers/familyGolden';

/**
 * 형제 수 새 정의(K1)의 영향 보고 (SPEC-009 FM4a, docs/data/family-model.md 7-1절): 같은 판에서 옛 규칙(`legacy` — 위 형제 + 「동생이 생겼다」 사건 한 명)과 새 정의(`view` — 구성의 살아 있는 형제 전원)의 형제 수와
 * 상속 나눗셈(`INHERIT[재력] ÷ (형제 수 + 1)`)을 나란히 센다. FM4a는 규칙을 `legacy`로 두므로 이 보고는 「켜면 얼마나 달라지는가」다 — 켜는 일은 FM4b의 재측정 뒤 마스터가 정한다.
 * 실행: ./node_modules/.bin/vite-node scripts/familySiblingReport.ts [판수=300]
 */
const lives = Number(process.argv[2] ?? 300);
const f = (n: number, d = 2): string => n.toFixed(d);

const rows: Record<string, { n: number; legacy: number; view: number; amtLegacy: number; amtView: number }> = {};
let all = { n: 0, legacy: 0, view: 0 };
GENERATION_IDS.forEach((gen: ProfileId, gi) => {
  for (const seed of spreadSeeds(lives, gi)) {
    const { final } = simulateLife(seed, gen, 'auto');
    const tier = final.character!.parentWealth;
    const legacy = siblingCountOf(final, 'legacy');
    const view = siblingCountOf(final, 'view');
    const key = `${gen}/${tier}`;
    const r = (rows[key] ??= { n: 0, legacy: 0, view: 0, amtLegacy: 0, amtView: 0 });
    r.n++;
    r.legacy += legacy;
    r.view += view;
    r.amtLegacy += inheritanceAmount(tier, legacy);
    r.amtView += inheritanceAmount(tier, view);
    all = { n: all.n + 1, legacy: all.legacy + legacy, view: all.view + view };
  }
});
console.log(`형제 수 평균 (끝난 판 기준, ${all.n}판): 옛 규칙 ${f(all.legacy / all.n)} → 새 정의 ${f(all.view / all.n)}`);
for (const gen of GENERATION_IDS) {
  const g = Object.entries(rows).filter(([k]) => k.startsWith(`${gen}/`)).map(([, v]) => v);
  const n = g.reduce((a, r) => a + r.n, 0);
  const l = g.reduce((a, r) => a + r.legacy, 0) / n;
  const v = g.reduce((a, r) => a + r.view, 0) / n;
  const al = g.reduce((a, r) => a + r.amtLegacy, 0) / n;
  const av = g.reduce((a, r) => a + r.amtView, 0) / n;
  console.log(`${gen.padEnd(11)} n ${String(n).padStart(4)} | 형제 수 ${f(l)} → ${f(v)} | 상속액 평균(만 원) ${f(al, 0)} → ${f(av, 0)} (${f(((av - al) / al) * 100, 1)}%)`);
}
for (let tier = 1; tier <= 5; tier++) {
  const g = Object.entries(rows).filter(([k]) => k.endsWith(`/${tier}`)).map(([, v]) => v);
  const n = g.reduce((a, r) => a + r.n, 0);
  if (n === 0) continue;
  const al = g.reduce((a, r) => a + r.amtLegacy, 0) / n;
  const av = g.reduce((a, r) => a + r.amtView, 0) / n;
  console.log(`재력 ${tier}단계 n ${String(n).padStart(4)} | 상속액 평균(만 원) ${f(al, 0)} → ${f(av, 0)} (${f(((av - al) / al) * 100, 1)}%)`);
}
