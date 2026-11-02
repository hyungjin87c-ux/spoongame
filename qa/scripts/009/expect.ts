import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { type ProfileId } from '../../../src/core';
import { lifeSteps } from '../../../tests/helpers/familyLife';
const DIR = 'qa/scripts/009/states';
for (const f of readdirSync(DIR).filter((x) => x.endsWith('.json') && !x.endsWith('.expected.json'))) {
  const d = JSON.parse(readFileSync(`${DIR}/${f}`, 'utf8')).data;
  const steps = lifeSteps(d.seed, d.generation as ProfileId);
  const last = steps[steps.length - 1].state;
  writeFileSync(`${DIR}/${f.replace('.json', '.expected.json')}`, JSON.stringify({ age: last.age, phase: last.phase, history: last.history, stats: last.stats, death: last.death, family: last.family }));
  console.log(f, d.generation, d.seed, 'start age', d.age, '→ final age', last.age, 'hist', last.history.length);
}
