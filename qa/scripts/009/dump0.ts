import { writeFileSync, mkdirSync } from 'node:fs';
import { type ProfileId } from '../../../src/core';
import { startLife } from '../../../scripts/simulateLib';
import { lifeSteps } from '../../../tests/helpers/familyLife';
const DIR = 'qa/scripts/009/states';
mkdirSync(DIR, { recursive: true });
for (const [key, gen, seed] of [['fam17', 'industrial', 55000549]] as const) {
  const s = startLife(seed, gen as ProfileId);
  writeFileSync(`${DIR}/${key}.json`, JSON.stringify({ version: 9, data: s }));
  const last = lifeSteps(seed, gen as ProfileId).at(-1)!.state;
  writeFileSync(`${DIR}/${key}.expected.json`, JSON.stringify({ age: last.age, phase: last.phase, history: last.history, stats: last.stats, death: last.death, family: last.family }));
  console.log(key, 'fam lines:', last.history.filter((h) => (h.eventId ?? '').startsWith('fam-')).map((h) => `${h.age}:${h.eventId}`).join(' '));
}
