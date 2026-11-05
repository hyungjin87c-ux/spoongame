import '../../../src/data/installAll';
import { GENERATION_IDS, adultSlotsOf, type GameState } from '../../../src/core';
import { startLife } from '../../../scripts/simulateLib';
import { spreadSeeds } from '../../../tests/helpers/familyGolden';
// 손으로 만든 공격 판: 처음 만난 나이를 18·19·20·21·22·23·24·25·30으로 바꿔도 배우자·연인(남녀 주인공 모두)이 만난 해에 20세 이상인가
const AGES = [18, 19, 20, 21, 22, 23, 24, 25, 30];
const res: Record<string, { n: number; min: number }> = {};
let bad = 0, total = 0; const examples: string[] = [];
GENERATION_IDS.forEach((gen, gi) => {
  for (const seed of spreadSeeds(300, gi)) {
    for (const at of AGES) for (const flag of ['has_partner', 'married']) {
      const base = startLife(seed, gen);
      const g: GameState = { ...base, age: 45, flags: [...new Set([...base.flags, flag])].sort(), seen: { ...base.seen, ...(flag === 'married' ? { 'youth-marriage': at } : { 'youth-approached': at }) } };
      const sp = adultSlotsOf(g, g.family!).find((s) => s.role === 'spouse');
      if (!sp) continue;
      total++;
      const k = `${g.character!.gender}/${flag}/${at}`;
      const ageAtMeet = g.character!.birthYear + sp.at - sp.birthYear;
      res[k] ??= { n: 0, min: 99 }; res[k].n++; res[k].min = Math.min(res[k].min, ageAtMeet);
      if (ageAtMeet < 20) { bad++; if (examples.length < 5) examples.push(`${gen}/${seed} ${k} at=${sp.at} ageAtMeet=${ageAtMeet}`); }
    }
  }
});
console.log('판 조합', total, '· 20세 미만', bad, examples.join(' | '));
for (const k of Object.keys(res).sort()) console.log(k.padEnd(24), `n=${res[k].n} 만난 해 최소 ${res[k].min}`);
