// QA: 브라우저에서 실제로 돌려 볼 판을 코어 시드 탐색으로 고른다 (고르기만 하고 코어 결과를 판정 기준으로 쓰지 않는다)
import { writeFileSync, mkdirSync } from 'node:fs';
import { GENERATION_IDS, sceneInputOf, sceneLineOf, type ProfileId, type GameState } from '../../../src/core';
import { lifeSteps } from '../../../tests/helpers/familyLife';
const OUT = 'qa/scripts/009/states';
mkdirSync(OUT, { recursive: true });
const N = Number(process.env.QA_N ?? 400);
const found: Record<string, { gen: string; seed: number; age: number; note: string }> = {};
let bestLine = { len: 0, gen: '', seed: 0, age: 0, line: '' };
let bestFam = { n: 0, gen: '', seed: 0 };
const save = (key: string, gen: string, seed: number, state: GameState, note: string) => {
  if (found[key]) return;
  found[key] = { gen, seed, age: state.age, note };
  writeFileSync(`${OUT}/${key}.json`, JSON.stringify({ version: 9, data: state }));
};
for (const [gi, gen] of GENERATION_IDS.entries()) {
  for (let i = 0; i < N; i++) {
    const seed = 55_000_000 + gi * 1_000_003 + i * 61;
    const steps = lifeSteps(seed, gen as ProfileId);
    const fam = steps[steps.length - 1].state.history.filter((h) => (h.eventId ?? '').startsWith('fam-')).length;
    if (fam > bestFam.n) bestFam = { n: fam, gen, seed };
    let prev: GameState | null = null;
    for (const { state, before } of steps) {
      const age = state.age;
      const line = sceneLineOf(sceneInputOf(state as never));
      if (line.length > bestLine.len) bestLine = { len: line.length, gen, seed, age, line };
      // 강제 카드(2~5세): 이 해에 infant-new-sibling이 기록됨
      const newToday = state.history.filter((h) => h.age === before.age && !before.history.includes(h));
      const forced = newToday.some((h) => h.eventId === 'infant-new-sibling');
      const fams = newToday.filter((h) => (h.eventId ?? '').startsWith('fam-'));
      if (forced && before.age >= 2 && before.age <= 5) {
        save(`forced-${gen}`, gen, seed, before, `강제 카드 ${before.age}세 직전`);
        if (fams.some((h) => h.eventId === 'fam-parent-gone')) save(`forced-parentgone-${gen}`, gen, seed, before, `강제 카드 + 부모 별세 같은 해 ${before.age}세 직전`);
      }
      if (before.age <= 5 && fams.some((h) => h.eventId === 'fam-parent-gone') && newToday.some((h) => h.eventId === 'infant-new-sibling')) save(`gone-and-sib-${gen}`, gen, seed, before, `2~5세 부모 별세 + 동생 같은 해 ${before.age}세 직전`);
      if (before.age <= 19 && fams.some((h) => h.eventId === 'fam-parents-apart')) save(`apart-${gen}`, gen, seed, before, `이혼 ${before.age}세 직전`);
      prev = state;
    }
  }
}
// 가장 긴 한 줄 판, 가족 줄이 가장 많은 판은 시작 직후(0세)부터 돌린다
console.log(JSON.stringify({ found, bestLine, bestFam }, null, 1));
