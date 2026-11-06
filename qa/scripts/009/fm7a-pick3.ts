// QA(SPEC-009 FM7a) 자녀 독립(R-586) 점검용 판: 주인공 나이 AGE에서 has_child인 판(자녀 1·2·3명 따로) + 늦둥이(child_late) 판
import '../../../src/data/installAll';
import { writeFileSync, mkdirSync } from 'node:fs';
import { GENERATION_IDS, familyViewOf, type ProfileId } from '../../../src/core';
import { lifeSteps } from '../../../tests/helpers/familyLife';

const OUT = process.env.QA_OUT ?? 'qa/scripts/009/fm7a-states3';
mkdirSync(OUT, { recursive: true });
const N = Number(process.env.QA_N ?? 80);
const picks: Array<{ key: string; note: string }> = [];
const got: Record<string, number> = {};
for (const [gi, gen] of GENERATION_IDS.entries()) {
  if (!['boomer', 'g86', 'genx', 'millennial'].includes(gen)) continue;
  for (let i = 0; i < N; i++) {
    const seed = 91_000_000 + gi * 1_000_003 + i * 53;
    for (const { before } of lifeSteps(seed, gen as ProfileId)) {
      if (before.age !== 42) continue;
      if (!before.flags.includes('has_child')) break;
      const view = familyViewOf(before as never);
      const kids = view.people.filter((p) => p.role === 'child');
      const kind = kids.length >= 3 ? 'k3' : kids.length === 2 ? 'k2' : 'k1';
      const key = `${kind}-${gen}`;
      if ((got[key] ?? 0) >= 1) break;
      got[key] = 1;
      writeFileSync(`${OUT}/${key}.json`, JSON.stringify({ version: 9, data: before }));
      picks.push({ key, note: `seed ${seed} 자녀 ${kids.length}명 나이 ${kids.map((k) => k.age).join(',')}` });
      break;
    }
  }
}
writeFileSync(`${OUT}/_picks.json`, JSON.stringify(picks, null, 1));
for (const p of picks) console.log(p.key.padEnd(16), p.note);
