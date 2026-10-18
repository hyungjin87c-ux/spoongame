// QA-003 M7a 시나리오 저장 만들기 (vite-node로 실행: ./node_modules/.bin/vite-node qa/scripts/m7a-craft.mjs)
// 출생 직후 저장(코어로 만든 0세 판)에서 나이·재력·형제 순서·플래그만 고쳐, 「다음 한 해에 목표 이벤트가 나오는」 저장을 만든다.
// 코어(stepYear)는 「어떤 난수 상태에서 그 이벤트가 나오는지」 찾는 데만 쓰고, 보이는 선택지·영향 줄·문장은 만든 저장을 실제 화면에 넣어 화면에서 읽는다.
// 결과: qa/results/m7a/craft-saves.json  { 이름: { raw, meta } }
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { stepYear } from '../../src/core/life';
import { parseGame } from '../../src/core/storage';
import { EVENT_POOL } from '../../src/data/events';
import { createInitialState, beginBirth, enterBirth, enterLife } from '../../src/core/state';
const RP = process.env.QA_RP || '';

const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'results', 'm7a');
fs.mkdirSync(OUT, { recursive: true });
const crafted = {};

function baseFor(era, seed) {
  return enterLife(enterBirth(beginBirth(createInitialState(seed), era)));
}

/** event가 목표 이벤트. 나이·재력·형제 순서 등을 고쳐 다음 해에 그 이벤트가 나오는 난수 상태를 찾는다. */
function craft(name, { event, era, tier, age, seed = 7, mod, parenting, order, tries = 12000, kind = 'choice' }) {
  const s0 = baseFor(era, seed);
  const d = structuredClone(s0);
  d.age = age;
  d.character.parentWealth = tier;
  if (parenting) d.character.parenting = parenting;
  if (order) d.birthReport.birthOrder = order;
  d.pending = null;
  d.seen = {};
  d.lastChoiceAge = null;
  d.flags = [];
  d.paused = false;
  d.history = [d.history[0]];
  if (mod) mod(d);
  for (let k = 1; k <= tries; k++) {
    d.rngState = Math.imul(k, 2654435761) >>> 0;
    const raw = JSON.stringify({ version: 8, data: d });
    const g = parseGame(raw, EVENT_POOL);
    if (!g) {
      console.log(`저장 검증 실패 ${name}`);
      return false;
    }
    const r = stepYear(g, EVENT_POOL);
    const ids = r.tick.milestoneIds ?? [];
    const hit = kind === 'choice' ? r.tick.kind === 'choice' && r.tick.eventId === event : kind === 'y1choice' ? r.tick.kind === 'choice' && ids.length >= 2 : kind === 'y1narr' ? r.tick.kind === 'narrative' && ids.length >= 2 && r.tick.eventId !== undefined && !ids.includes(r.tick.eventId) : (r.tick.eventId === event || ids.includes(event));
    if (hit) {
      crafted[name] = { raw, meta: { event, era, tier, age, seed, order: d.birthReport.birthOrder, parenting: d.character.parenting, visible: r.state.pending?.choiceIds ?? null, rngState: d.rngState, tick: r.tick } };
      console.log(`OK ${name}: ${event} ${era} t${tier} age ${age} → ${r.state.pending ? r.state.pending.choiceIds.join(',') : r.tick.kind}`);
      return true;
    }
  }
  console.log(`실패 ${name} (${event} ${era} t${tier} age ${age})`);
  return false;
}

// 이벤트별: [id, 시대들, 나이, 비고]
const WEALTH_EVENTS = [
  ['infant-care', ['past', 'present', 'future'], 2],
  ['infant-stories', ['past', 'present', 'future'], 3],
  ['infant-fever', ['past', 'present', 'future'], 2],
  ['infant-parental-leave', ['present'], 0],
  ['infant-first-birthday', ['past', 'present', 'future'], 1],
  ['infant-daycare-wait', ['present'], 1],
  ['infant-noise', ['present'], 3],
  ['infant-kindergarten', ['present', 'future'], 3],
  ['infant-hospital-stay', ['past', 'present', 'future'], 4],
  ['infant-moving', ['past', 'present', 'future'], 4],
  ['infant-early-lessons', ['present', 'future'], 5],
  ['school-supplies', ['past', 'present', 'future'], 7],
  ['school-after-hours', ['present', 'future'], 7],
  ['infant-meal-start', ['past', 'present', 'future'], 0],
  ['infant-new-sibling', ['past', 'present', 'future'], 3],
  ['infant-sibling-toy', ['past', 'present', 'future'], 4],
];

for (const [ev, eras, age] of WEALTH_EVENTS) {
  for (const era of eras) {
    for (const tier of [1, 2, 3, 4, 5]) {
      craft(`w-${ev}-${era}-t${tier}`, {
        event: ev,
        era,
        tier,
        age,
        order: ev === 'infant-new-sibling' || ev === 'infant-sibling-toy' ? 1 : undefined,
        parenting: 'free',
        mod: (d) => {
          if (ev === 'infant-sibling-toy') {
            d.flags = ['younger_sibling'];
            d.seen = { 'infant-new-sibling': 2 };
            d.history = [d.history[0]];
          }
          if (ev === 'infant-new-sibling') {
            d.birthReport.mother.age = Math.min(d.birthReport.mother.age, 30);
          }
          if (ev === 'infant-moving') d.birthReport.housing = 'rent';
        },
      });
    }
  }
}

// r2: 동생 맞이 조부모 플래그 있음 변형, 1세 한 해 세 줄(마일스톤 둘 + 일반 사건) 저장
for (const era of ['past', 'present', 'future']) {
  for (const tier of [1, 5]) {
    craft(`w-infant-new-sibling-gc-${era}-t${tier}`, { event: 'infant-new-sibling', era, tier, age: 3, order: 1, parenting: 'free', mod: (d) => { d.birthReport.mother.age = Math.min(d.birthReport.mother.age, 30); d.flags = ['grandparent_close']; } });
  }
  for (const kind of ['y1choice', 'y1narr']) {
    craft(`${kind}-${era}`, { event: '-', era, tier: 3, age: 1, parenting: 'free', kind });
  }
}

fs.writeFileSync(path.join(OUT, RP + 'craft-saves.json'), JSON.stringify(crafted, null, 1));
console.log('저장', Object.keys(crafted).length, '개');
