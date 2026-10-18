// QA-003 M7a 2회차: 「나오지 않아야 하는 것」 부정 탐침 (vite-node: QA_RP=r2- ./node_modules/.bin/vite-node qa/scripts/m7a-craft-neg.mjs)
// 코어(stepYear)로 「이 상태에서 목표 이벤트가 나오는 난수 상태가 있는가」를 난수 12000개까지 찾는다. 나오면 그 상태가 있다는 뜻(양성 대조), 안 나오면 구조상 안 나온다는 뜻.
// 양성 대조(나와야 하는 상태)를 함께 돌려 탐침이 눈을 뜬 상태인지 확인한다. 보이는 화면은 이 스크립트가 아니라 prod에서 따로 본다.
// 결과: qa/results/m7a/r2-craft-neg.json, 케이스 기록은 호출한 쪽(보고서)에서
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { stepYear } from '../../src/core/life';
import { parseGame } from '../../src/core/storage';
import { EVENT_POOL } from '../../src/data/events';
import { createInitialState, beginBirth, enterBirth, enterLife } from '../../src/core/state';

const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'results', 'm7a');
const RP = process.env.QA_RP || '';
const baseFor = (era, seed) => enterLife(enterBirth(beginBirth(createInitialState(seed), era)));

/** target이 다음 해에 나오는 난수가 있는가(있으면 첫 난수 번호, 없으면 0) */
function search({ event, era, tier, age, housing, flags = [], order, seed = 7, tries = 12000, want = 'event' }) {
  const d = structuredClone(baseFor(era, seed));
  d.age = age;
  d.character.parentWealth = tier;
  d.character.parenting = 'free';
  if (order) d.birthReport.birthOrder = order;
  if (housing) d.birthReport.housing = housing;
  d.pending = null;
  d.seen = {};
  d.lastChoiceAge = null;
  d.flags = flags;
  d.paused = false;
  d.history = [d.history[0]];
  for (let k = 1; k <= tries; k++) {
    d.rngState = Math.imul(k, 2654435761) >>> 0;
    const g = parseGame(JSON.stringify({ version: 8, data: d }), EVENT_POOL);
    if (!g) return -1;
    const r = stepYear(g, EVENT_POOL);
    const ids = r.tick.milestoneIds ?? [];
    const hit = want === 'event' ? r.tick.eventId === event || ids.includes(event) : false;
    if (hit) return k;
  }
  return 0;
}

const rows = [];
const probe = (name, expectFound, args) => {
  const k = search(args);
  rows.push({ name, expectFound, found: k > 0, ok: (k > 0) === expectFound, k });
  console.log(`${(k > 0) === expectFound ? ' ' : '!'} ${name}: ${k > 0 ? `나옴(난수 ${k})` : k === 0 ? '12000개 중 0' : '저장 검증 실패'} — 기대 ${expectFound ? '나옴' : '안 나옴'}`);
};
for (const era of ['past', 'present', 'future']) {
  for (const tier of [1, 2, 3]) {
    for (const age of [3, 4, 5, 6]) probe(`이삿짐(자가) ${era} 재력${tier} ${age}세`, false, { event: 'infant-moving', era, tier, age, housing: 'own' });
    probe(`이삿짐(임차) ${era} 재력${tier} 4세`, true, { event: 'infant-moving', era, tier, age: 4, housing: 'rent' });
    probe(`이삿짐(무상) ${era} 재력${tier} 4세`, true, { event: 'infant-moving', era, tier, age: 4, housing: 'free' });
  }
}
// childcare_set: 켜진 판에서 보살핌·어린이집 대기가 안 나온다 / 꺼진 판에서는 나온다
for (const era of ['past', 'present', 'future']) {
  probe(`맡김 정해짐(childcare_set)인 판의 「맡겨지는 낮」(infant-care) ${era} 2세`, false, { event: 'infant-care', era, tier: 3, age: 2, flags: ['childcare_set'] });
  probe(`맡김 정해지지 않은 판의 「맡겨지는 낮」 ${era} 2세`, true, { event: 'infant-care', era, tier: 3, age: 2 });
}
probe('맡김 정해짐인 판의 「어린이집 대기」 present 1세', false, { event: 'infant-daycare-wait', era: 'present', tier: 3, age: 1, flags: ['childcare_set'] });
probe('맡김 정해짐인 판의 「어린이집 대기」 present 2세', false, { event: 'infant-daycare-wait', era: 'present', tier: 3, age: 2, flags: ['childcare_set'] });
probe('맡김 정해지지 않은 판의 「어린이집 대기」 present 1세', true, { event: 'infant-daycare-wait', era: 'present', tier: 3, age: 1 });
// 나이 창
probe('일을 쉬는 한 해 present 1세(창 0~0)', false, { event: 'infant-parental-leave', era: 'present', tier: 3, age: 1 });
probe('일을 쉬는 한 해 present 0세', true, { event: 'infant-parental-leave', era: 'present', tier: 3, age: 0 });
probe('말을 받아 주는 인형 future 2세(창 3~5)', false, { event: 'infant-talking-toy', era: 'future', tier: 3, age: 2 });
probe('말을 받아 주는 인형 future 3세', true, { event: 'infant-talking-toy', era: 'future', tier: 3, age: 3 });
probe('첫 걸음마 2세(창 1~1)', false, { event: 'infant-first-steps', era: 'present', tier: 3, age: 2 });
probe('첫 걸음마 1세', true, { event: 'infant-first-steps', era: 'present', tier: 3, age: 1 });
probe('첫 말 3세(창 1~1)', false, { event: 'infant-first-word', era: 'present', tier: 3, age: 3 });
probe('첫 말 1세', true, { event: 'infant-first-word', era: 'present', tier: 3, age: 1 });
probe('둘째 이상의 동생 맞이 present 3세', false, { event: 'infant-new-sibling', era: 'present', tier: 3, age: 3, order: 2 });
probe('첫째의 동생 맞이 present 3세', true, { event: 'infant-new-sibling', era: 'present', tier: 3, age: 3, order: 1 });
fs.writeFileSync(path.join(OUT, `${RP}craft-neg.json`), JSON.stringify(rows, null, 1));
console.log(`탐침 ${rows.length}개, 기대와 다름 ${rows.filter((r) => !r.ok).length}`);
