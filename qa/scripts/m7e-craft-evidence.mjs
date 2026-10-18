// QA-003 M7e 모순 증거 저장 (vite-node: ./node_modules/.bin/vite-node qa/scripts/m7e-craft-evidence.mjs)
//  - card-youth-housing-present-t1 : 월세로 사는 20대 판에서 「살 곳을 구하는 일」 — 선택지 「부모님 집에 머문다」(결과 「집을 나서지 않기로 했습니다」)가 보인다
//  - narr-lonely-holiday-family   : 부모님과 한집(가족 집)에 사는 미혼 40대 판에서 「혼자 맞는 명절」이 나온다
// 코어는 「그 사건이 다음 해에 나오는 난수 상태」를 찾는 데만 쓴다.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { stepYear, resolveChoiceStep } from '../../src/core/life';
import { parseGame } from '../../src/core/storage';
import { EVENT_POOL } from '../../src/data/events';
import { createInitialState, beginBirth, enterBirth, enterLife } from '../../src/core/state';

const OUT = process.env.QA_OUT ? path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', process.env.QA_OUT) : path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'results', 'm7e');
fs.mkdirSync(OUT, { recursive: true });
const SAVES = path.join(OUT, 'saves');
const seeds = JSON.parse(fs.readFileSync(path.join(OUT, 'seeds.json'), 'utf8'));

function toAge(era, seed, tier, age, variant) {
  let s = enterLife(enterBirth(beginBirth(createInitialState(seed), era)));
  if (tier && s.character.parentWealth !== tier) return null;
  let guard = 0;
  while (s.phase === 'life' && guard++ < 600) {
    if (s.age >= age && s.pending === null) return s;
    if (s.pending) {
      const p = s.pending;
      s = resolveChoiceStep(s, p.key, p.choiceIds[(guard + variant) % p.choiceIds.length]).state;
    } else s = stepYear(s).state;
  }
  return null;
}

function craft(name, { event, era, tier, age, mod, kind }) {
  for (const c of seeds.filter((r) => r.era === era && r.tier === tier).slice(0, 20)) {
    for (let variant = 0; variant < 3; variant++) {
      const base = toAge(era, c.seed, tier, age, variant);
      if (!base) continue;
      mod(base);
      for (let k = 1; k <= 6000; k++) {
        const d = structuredClone(base);
        d.rngState = Math.imul(k, 2654435761) >>> 0;
        d.paused = false;
        const raw = JSON.stringify({ version: 8, data: d });
        const g = parseGame(raw, EVENT_POOL);
        if (!g) break;
        const r = stepYear(g, EVENT_POOL);
        const hit = kind === 'choice' ? r.tick.kind === 'choice' && r.tick.eventId === event : r.tick.eventId === event;
        if (hit) {
          fs.writeFileSync(path.join(SAVES, `${name}.json`), raw);
          console.log(`OK ${name}: 시드 ${c.seed} t${tier} ${d.age}세 주거 ${d.assets ? d.assets.dwelling : '-'} 플래그 ${d.flags.join(',')}`);
          return true;
        }
      }
    }
  }
  console.log('실패', name);
  return false;
}

craft('card-youth-housing-present-t1', { event: 'youth-housing', era: 'present', tier: 1, age: 24, mod: () => {}, kind: 'choice' });
craft('narr-lonely-holiday-family', {
  event: 'middle-lonely-holiday',
  era: 'present',
  tier: 3,
  age: 45,
  kind: 'narr',
  mod: (d) => {
    d.flags = d.flags.filter((f) => !['married', 'has_partner', 'has_child', 'child_left', 'child_late', 'renting', 'own_home', 'moved_home', 'parents_gone'].includes(f));
    d.flags.push('lives_with_parents');
    if (d.assets) d.assets.dwelling = 'family';
    d.seen = Object.fromEntries(Object.entries(d.seen).filter(([k]) => k !== 'middle-lonely-holiday'));
  },
});

craft('card-senior-estranged-child-present', {
  event: 'senior-estranged-child',
  era: 'present',
  tier: 3,
  age: 72,
  kind: 'choice',
  mod: (d) => {
    d.flags = d.flags.filter((f) => !['child_left', 'moved_home', 'in_care'].includes(f));
    for (const f of ['has_child', 'child_distant']) if (!d.flags.includes(f)) d.flags.push(f);
    d.seen = Object.fromEntries(Object.entries(d.seen).filter(([k]) => k !== 'senior-estranged-child'));
  },
});
craft('card-infant-moving-present-t3', {
  event: 'infant-moving',
  era: 'present',
  tier: 3,
  age: 4,
  kind: 'choice',
  mod: (d) => {
    d.birthReport.housing = 'rent';
    d.seen = Object.fromEntries(Object.entries(d.seen).filter(([k]) => k !== 'infant-moving'));
  },
});
craft('card-infant-early-lessons-present-t5', { event: 'infant-early-lessons', era: 'present', tier: 5, age: 5, kind: 'choice', mod: () => {} });
