import { writeFileSync, mkdirSync } from 'node:fs';
import { type ProfileId } from '../../../src/core';
import { lifeSteps } from '../../../tests/helpers/familyLife';
const DIR = 'qa/scripts/009/states';
mkdirSync(DIR, { recursive: true });
const put = (key: string, gen: string, seed: number, pick: (steps: ReturnType<typeof lifeSteps>) => unknown) => {
  const steps = lifeSteps(seed, gen as ProfileId);
  const st = pick(steps) as { age: number; phase: string };
  const last = steps[steps.length - 1].state;
  writeFileSync(`${DIR}/${key}.json`, JSON.stringify({ version: 9, data: st }));
  writeFileSync(`${DIR}/${key}.expected.json`, JSON.stringify({ age: last.age, phase: last.phase, history: last.history, stats: last.stats, death: last.death, family: last.family }));
  console.log(key, 'start', st.age, 'death', JSON.stringify(last.death));
};
put('longline', 'industrial', 55001342, (s) => s.find((x) => x.state.age === 2)!.state);
for (const [k, g, sd] of [['predeath-genx', 'genx', 58000070], ['predeath-genz', 'genz', 60000198], ['predeath-ind', 'industrial', 55000549]] as const) put(k, g, sd, (s) => s[s.length - 2].state);
