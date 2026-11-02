import { writeFileSync, mkdirSync } from 'node:fs';
import { GENERATION_IDS, sceneInputOf, sceneLineOf, type ProfileId } from '../../../src/core';
import { lifeSteps } from '../../../tests/helpers/familyLife';
const DIR = 'qa/scripts/009/states';
mkdirSync(DIR, { recursive: true });
const WORDS = ['다가구 단독주택', '넓은 단독주택', '가게 딸린 집', '요양 시설', '상가주택', '단독주택 셋방', '작은 집', '다세대주택', '연립주택'];
const got: Record<string, string> = {};
outer: for (const [gi, gen] of GENERATION_IDS.entries()) {
  for (let i = 0; i < 250; i++) {
    const seed = 66_000_000 + gi * 1_000_003 + i * 67;
    for (const { state } of lifeSteps(seed, gen as ProfileId)) {
      const line = sceneLineOf(sceneInputOf(state as never));
      for (const w of WORDS) if (!got[w] && line.includes(w)) {
        got[w] = `${gen}/${seed}/${state.age}: ${line}`;
        writeFileSync(`${DIR}/word-${WORDS.indexOf(w)}.json`, JSON.stringify({ version: 9, data: state }));
      }
    }
    if (Object.keys(got).length === WORDS.length) break outer;
  }
}
console.log(JSON.stringify(got, null, 1));
