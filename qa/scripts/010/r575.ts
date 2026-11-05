import '../../../src/data/installAll';
import { GENERATION_IDS, familyCardOf, type GameState } from '../../../src/core';
import { lifeSteps, seedsFor } from '../../../tests/helpers/familyLife';
// 헤어진 뒤 새 연인(has_partner + broke_up/reunited)의 사이 말이 이별 플래그로 깎이지 않는다 (R-575): 같은 상태에서 broke_up·reunited·divorced만 껐다 켜 보며 연인 줄의 사이 글자 비교
let n = 0, diff = 0; const ex: string[] = [];
GENERATION_IDS.forEach((gen, gi) => {
  for (const seed of seedsFor(250, gi)) {
    for (const { state: s } of lifeSteps(seed, gen)) {
      const g: GameState = s;
      if (g.character === null || g.birthReport === null || g.family === undefined) continue;
      if (!(g.flags.includes('broke_up') || g.flags.includes('reunited'))) continue;
      const a = familyCardOf(g).adult.find((r) => r.role === 'spouse');
      if (!a) continue;
      const b = familyCardOf({ ...g, flags: g.flags.filter((f) => f !== 'broke_up' && f !== 'reunited') }).adult.find((r) => r.role === 'spouse');
      n++;
      if (!b || a.closenessText !== b.closenessText || a.label !== b.label) { diff++; if (ex.length < 4) ex.push(`${gen}/${seed} age${g.age} ${a.label}:${a.closenessText} vs ${b?.label}:${b?.closenessText}`); }
    }
  }
});
console.log(`broke_up·reunited가 켜진 상태에서 배우자·연인 줄이 보인 상태 ${n}개 — 이별 플래그를 빼면 사이·호칭이 달라진 것 ${diff} ${ex.join(' | ')}`);
