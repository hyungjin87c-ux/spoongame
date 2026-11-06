// QA(SPEC-009 FM7a) 「떠난 가족」이 가장 길게 늘어난 판(형제 별세 + 부모 별세 + 조부모들) — 360px·글자 200% 점검용
import '../../../src/data/installAll';
import { writeFileSync, mkdirSync } from 'node:fs';
import { GENERATION_IDS, familyViewOf, type ProfileId } from '../../../src/core';
import { lifeSteps } from '../../../tests/helpers/familyLife';
const OUT = process.env.QA_OUT ?? 'qa/scripts/009/fm7a-states6';
mkdirSync(OUT, { recursive: true });
let best = { n: -1, seed: 0, gen: '' };
for (const [gi, gen] of GENERATION_IDS.entries()) {
  if (!['industrial', 'boomer', 'g86'].includes(gen)) continue;
  for (let i = 0; i < 500; i++) {
    const seed = 121_000_000 + gi * 1_000_003 + i * 43;
    for (const { before } of lifeSteps(seed, gen as ProfileId)) {
      if (before.age !== 20) continue;
      const v = familyViewOf(before as never);
      const gone = v.people.filter((p) => p.state === 'gone');
      const hasSib = gone.some((p) => p.role === 'sibling');
      const hasPar = gone.some((p) => p.role === 'parent');
      const score = gone.length + (hasSib ? 3 : 0) + (hasPar ? 3 : 0);
      if (score > best.n) { best = { n: score, seed, gen }; writeFileSync(`${OUT}/GONEMAX.json`, JSON.stringify({ version: 9, data: before })); console.log('score', score, 'gone', gone.length, gone.map((g) => g.role + ':' + g.name).join(','), 'seed', seed, gen); }
      break;
    }
  }
}
