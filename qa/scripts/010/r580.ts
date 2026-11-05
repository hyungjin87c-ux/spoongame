import '../../../src/data/installAll';
import { GENERATION_IDS, parentsAllGone, parentsJustGone, familyViewOf, type GameState } from '../../../src/core';
import { ensureFamily } from '../../../src/core/familyStorage';
import { lifeSteps, seedsFor } from '../../../tests/helpers/familyLife';
// R-580 독립 점검: 어긋남 구간(보기가 「두 분 모두 떠남」인데 옛 규칙은 아직)의 판에서
//  (a) 새 판(family 있음): 전환·상속 해 = 보기와 같은 해
//  (b) 옛 저장(family 칸을 지우고 ensureFamily로 lg=1 스냅숏): 전환 해 = 옛 규칙 해(먼저 떠난 분의 실제 나이 100 초과 해)이고 영영 안 일어나지 않는 판은 0
const PER = Number(process.argv.slice(2).find((a) => /^\d+$/.test(a)) ?? 400);
let mism = 0, newOk = 0, newBad = 0, oldOk = 0, oldNever = 0, oldBad = 0; const ex: string[] = [];
GENERATION_IDS.forEach((gen, gi) => {
  for (const seed of seedsFor(PER, gi)) {
    const steps = lifeSteps(seed, gen);
    let viewAt: number | null = null, econAt: number | null = null;
    for (const { state: s } of steps) {
      if (s.family === undefined || s.character === null || s.birthReport === null || s.assets === null) continue;
      if (viewAt === null && familyViewOf(s).parentsGone) viewAt = s.age;
      if (econAt === null && parentsAllGone({ ...s }, 'legacy')) econAt = s.age;
    }
    if (viewAt === null || econAt === null || viewAt === econAt) continue;
    mism++;
    // (a) 새 판: parentsJustGone 이 viewAt 해에 한 번 참이다
    let justNew: number[] = [];
    for (let i = 1; i < steps.length; i++) { const b = steps[i].before, a = steps[i].state; if (b.assets !== null && b.family !== undefined && parentsJustGone(b, a)) justNew.push(a.age); }
    if (justNew.length === 1) newOk++; else { newBad++; ex.push(`새 판 ${gen}/${seed} just=${justNew}`); }
    // (b) 옛 저장: 모든 걸음 상태에서 family를 지웠다가 ensureFamily
    const toOld = (s: GameState): GameState => { const { family: _f, ...rest } = s as GameState & { family?: unknown }; return ensureFamily(rest as GameState); };
    let justOld: number[] = [];
    for (let i = 1; i < steps.length; i++) {
      const b = toOld(steps[i].before), a = { ...toOld(steps[i].state) };
      if (b.assets !== null && parentsJustGone(b, a)) justOld.push(a.age);
    }
    if (justOld.length === 0) { oldNever++; ex.push(`옛 저장 전환 없음 ${gen}/${seed} view=${viewAt} econ=${econAt}`); }
    else if (justOld.length === 1) oldOk++; else { oldBad++; ex.push(`옛 저장 전환 여러 번 ${gen}/${seed} ${justOld}`); }
  }
});
console.log(`어긋남 구간이 있는 판 ${mism}개 — 새 판 전환 정확히 1번 ${newOk}/${newBad}(아님) · 옛 저장 전환 1번 ${oldOk}, 영영 없음 ${oldNever}, 여러 번 ${oldBad}`, ex.slice(0, 6));
