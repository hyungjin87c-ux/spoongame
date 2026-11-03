import '../src/data/installAll';
import { GENERATION_IDS, familyViewOf, parentsAllGone, type GameState } from '../src/core';
import { lifeSteps, seedsFor } from '../tests/helpers/familyLife';

/**
 * R-562 측정 (REV-009-FM4b-1 R-562, SPEC-009 FM6): 「한 분은 모델이 별세시키고 다른 분이 100세를 넘었을 때」 가족 보기는 「두 분 모두 떠남」(`FamilyView.parentsGone`)인데
 * 상속·주거 전환이 읽는 `parentsAllGone`은 (먼저 떠난 분의 실제 나이가 100을 넘을 때까지) 거짓인 해가 얼마나 되는지 센다.
 * 실행: ./node_modules/.bin/vite-node scripts/familyParentsGone.ts [세대당 판수=300]
 */
const PER_GEN = Number(process.argv.slice(2).find((a) => /^\d+$/.test(a)) ?? 300);

interface Row {
  gen: string;
  seed: number;
  /** 보기는 「두 분 모두 떠남」인데 parentsAllGone은 거짓인 해의 주인공 나이들 */
  mismatch: number[];
  /** 보기가 처음 「두 분 모두」가 된 나이 · parentsAllGone이 처음 참이 된 나이 */
  viewAt: number | null;
  econAt: number | null;
  deathAge: number;
}

const rows: Row[] = [];
GENERATION_IDS.forEach((gen, gi) => {
  for (const seed of seedsFor(PER_GEN, gi)) {
    const steps = lifeSteps(seed, gen);
    const mismatch: number[] = [];
    let viewAt: number | null = null;
    let econAt: number | null = null;
    let deathAge = 0;
    for (const { state } of steps) {
      deathAge = state.death?.age ?? state.age;
      const s: GameState = state;
      if (s.family === undefined || s.birthReport === null || s.character === null) continue;
      // 걸음이 끝난 상태의 나이(사망 걸음은 나이가 오르지 않는다)
      const age = s.age;
      const v = familyViewOf(s, age).parentsGone;
      const e = parentsAllGone({ ...s, age }, 'legacy'); // 규칙을 켠 뒤에도 옛 규칙과의 어긋남을 잰다 (R-579)
      if (v && viewAt === null) viewAt = age;
      if (e && econAt === null) econAt = age;
      if (v && !e) mismatch.push(age);
    }
    rows.push({ gen, seed, mismatch, viewAt, econAt, deathAge });
  }
});

const total = rows.length;
const withMismatch = rows.filter((r) => r.mismatch.length > 0);
const years = withMismatch.map((r) => r.mismatch.length);
console.log(`판 ${total}개 (7세대 × ${PER_GEN})`);
console.log(`두 분 모두 떠남(보기)에 도달한 판: ${rows.filter((r) => r.viewAt !== null).length} (${((100 * rows.filter((r) => r.viewAt !== null).length) / total).toFixed(1)}%)`);
console.log(`보기 ≠ parentsAllGone인 해가 있는 판: ${withMismatch.length} (${((100 * withMismatch.length) / total).toFixed(2)}%), 해 수 평균 ${(years.reduce((a, b) => a + b, 0) / Math.max(1, years.length)).toFixed(2)} · 최대 ${Math.max(0, ...years)}`);
const late = withMismatch.filter((r) => r.mismatch.some((a) => a >= 20));
console.log(`그중 20세 이상(자산이 있는 나이)에 걸친 판: ${late.length}, 어긋난 해의 주인공 나이 범위 ${Math.min(...late.flatMap((r) => r.mismatch))}~${Math.max(...late.flatMap((r) => r.mismatch))}`);
const byGen = new Map<string, number>();
for (const r of withMismatch) byGen.set(r.gen, (byGen.get(r.gen) ?? 0) + 1);
console.log('세대별:', [...byGen].map(([g, n]) => `${g} ${n}`).join(' · '));
const diffs = rows.filter((r) => r.viewAt !== null && r.econAt !== null && r.viewAt !== r.econAt).map((r) => r.econAt! - r.viewAt!);
console.log(`보기와 경제가 둘 다 도달했지만 나이가 다른 판: ${diffs.length}, 차이(경제가 늦은 해) 평균 ${(diffs.reduce((a, b) => a + b, 0) / Math.max(1, diffs.length)).toFixed(2)}`);
const never = rows.filter((r) => r.viewAt !== null && r.econAt === null).length;
console.log(`보기는 도달했는데 죽을 때까지 경제는 도달하지 못한 판: ${never}`);
