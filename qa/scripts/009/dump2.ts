import { writeFileSync, mkdirSync } from 'node:fs';
import { type ProfileId } from '../../../src/core';
import { lifeSteps } from '../../../tests/helpers/familyLife';
const DIR = 'qa/scripts/009/states';
mkdirSync(DIR, { recursive: true });
const steps = lifeSteps(55000549, 'industrial' as ProfileId);
const st = steps.find((x) => x.state.age === 5)!.state;
writeFileSync(`${DIR}/fam17-5.json`, JSON.stringify({ version: 9, data: st }));
// 해마다 새 줄이 어떤 종류였는지(코어): 5~12세
for (const { before, state } of steps) if (before.age >= 5 && before.age <= 12) console.log(before.age, '→', state.history.filter((h) => !before.history.includes(h)).map((h) => h.eventId ?? h.kind).join(','));
