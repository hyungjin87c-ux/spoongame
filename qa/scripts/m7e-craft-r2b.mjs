// QA-003 M7e 2회차 추가 카드 저장 (vite-node: QA_OUT=qa/results/m7e/r2 ./node_modules/.bin/vite-node qa/scripts/m7e-craft-r2b.mjs)
// 자녀가 있는 노인 판의 「모임」·「집을 옮길까」 카드 — 1회차 레이아웃 감사의 카드 25종에 있던 것(8음절 어절이 있던 자리). 자녀 선택지가 보이도록 has_child를 켠다.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { stepYear, resolveChoiceStep } from '../../src/core/life';
import { parseGame } from '../../src/core/storage';
import { EVENT_POOL } from '../../src/data/events';
import { createInitialState, beginBirth, enterBirth, enterLife } from '../../src/core/state';

const OUT = process.env.QA_OUT ? path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', process.env.QA_OUT) : path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'results', 'm7e');
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
function craft(name, { event, era, tier, age, mod, want, tries = 6000 }) {
  for (const c of seeds.filter((r) => r.era === era && r.tier === tier).slice(0, 30)) {
    for (let variant = 0; variant < 3; variant++) {
      const base = toAge(era, c.seed, tier, age, variant);
      if (!base) continue;
      mod(base);
      for (let k = 1; k <= tries; k++) {
        const d = structuredClone(base);
        d.rngState = Math.imul(k, 2654435761) >>> 0;
        d.paused = false;
        const raw = JSON.stringify({ version: 8, data: d });
        const g = parseGame(raw, EVENT_POOL);
        if (!g) break;
        const r = stepYear(g, EVENT_POOL);
        if (r.tick.kind === 'choice' && r.tick.eventId === event && (!want || want(r.state.pending.choiceIds))) {
          fs.writeFileSync(path.join(SAVES, `${name}.json`), raw);
          console.log(`OK ${name}: ${r.state.pending.choiceIds.join(',')} (시드 ${c.seed} t${tier} ${d.age}세)`);
          return true;
        }
      }
    }
  }
  console.log('실패', name);
  return false;
}
const withChild = (d) => {
  d.flags = d.flags.filter((f) => !['child_distant', 'child_late', 'in_care', 'moved_home'].includes(f));
  if (!d.flags.includes('has_child')) d.flags.push('has_child');
  d.seen = Object.fromEntries(Object.entries(d.seen).filter(([k]) => !['senior-gathering', 'senior-move-home'].includes(k)));
};
craft('card-senior-gathering-present', { event: 'senior-gathering', era: 'present', tier: 3, age: 67, mod: withChild, want: (v) => v.includes('grandchildren') });
craft('card-senior-gathering-future', { event: 'senior-gathering', era: 'future', tier: 3, age: 67, mod: withChild, want: (v) => v.includes('grandchildren') });
craft('card-senior-move-home-present', { event: 'senior-move-home', era: 'present', tier: 3, age: 71, mod: withChild, want: (v) => v.includes('child') });
// 자녀와 멀어진 노인 판의 「서먹해진 자녀」 카드(1회차 수확에서 못 만난 결과 문장 senior-estranged-child/letter)
const estranged = (d) => {
  for (const f of ['has_child', 'child_distant']) if (!d.flags.includes(f)) d.flags.push(f);
  d.flags = d.flags.filter((f) => !['in_care'].includes(f));
  d.seen = Object.fromEntries(Object.entries(d.seen).filter(([k]) => k !== 'senior-estranged-child'));
};
craft('card-senior-estranged-child-present', { event: 'senior-estranged-child', era: 'present', tier: 3, age: 67, mod: estranged });
