// QA-003 M7e 2회차 저장 만들기 (vite-node: QA_OUT=qa/results/m7e/r2 ./node_modules/.bin/vite-node qa/scripts/m7e-craft-r2.mjs)
//  - card-youth-housing-rent         : 독립(월세) 판의 「살 곳을 구하는 일」 → 보이는 선택지 rent·return·loan
//  - card-youth-housing-family       : 가족 집 판 → rent·parents·loan
//  - card-youth-housing-alone        : 독립 + lives_alone 판 → rent·loan (return 안 보임)
//  - card-youth-housing-jeonse·own   : 독립 주거 변형(전세·자가 = 집 마련 전 own_home 플래그 없음)
//  - card-farewell-moved / -plain    : 부모 임종 카드, moved_home(자식 곁으로 옮긴) 판 / 일반 가족 집 판 — 떠난 뒤 주거 대조
//  - life-family-single-45           : 부모님과 한집에 사는 미혼 45세(일시정지 해제) — 「혼자 맞는 명절」이 안 나오는지 진행
//  - life-rent-single-45             : 같은 판의 독립 변형 — 「혼자 맞는 명절」이 나올 수 있는지(대조)
// 코어는 「그 카드가 다음 해에 뜨는 난수 상태」를 찾는 데만 쓴다.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { stepYear, resolveChoiceStep } from '../../src/core/life';
import { parseGame } from '../../src/core/storage';
import { EVENT_POOL } from '../../src/data/events';
import { createInitialState, beginBirth, enterBirth, enterLife } from '../../src/core/state';

const OUT = process.env.QA_OUT ? path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', process.env.QA_OUT) : path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'results', 'm7e');
const SAVES = path.join(OUT, 'saves');
fs.mkdirSync(SAVES, { recursive: true });
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
const write = (name, d) => {
  const raw = JSON.stringify({ version: 8, data: d });
  if (!parseGame(raw, EVENT_POOL)) {
    console.log('검증 실패', name);
    return false;
  }
  fs.writeFileSync(path.join(SAVES, `${name}.json`), raw);
  return true;
};

/** 이벤트가 다음 해에 뜨는 난수 상태를 찾는다. want(visible)로 보이는 선택지 조건 확인 */
function craft(name, { event, era, tier, age, mod, want, tries = 8000 }) {
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
          console.log(`OK ${name}: ${r.state.pending.choiceIds.join(',')} (시드 ${c.seed} t${tier} ${d.age}세 주거 ${d.assets ? d.assets.dwelling : '-'} 플래그 ${d.flags.join(',')})`);
          return true;
        }
      }
    }
  }
  console.log('실패', name);
  return false;
}
const clean = (d, drop) => {
  d.flags = d.flags.filter((f) => !drop.includes(f));
  d.seen = Object.fromEntries(Object.entries(d.seen).filter(([k]) => k !== 'youth-housing'));
};
const INDEP_DROP = ['married', 'own_home', 'renting', 'lives_alone', 'lives_with_parents', 'moved_home', 'has_partner'];

// youth-housing 네 상태
craft('card-youth-housing-rent', { event: 'youth-housing', era: 'present', tier: 1, age: 24, mod: (d) => { clean(d, INDEP_DROP); d.assets.dwelling = 'rent'; }, want: (v) => v.includes('return') && !v.includes('parents') });
craft('card-youth-housing-family', { event: 'youth-housing', era: 'present', tier: 3, age: 24, mod: (d) => { clean(d, INDEP_DROP); d.assets.dwelling = 'family'; }, want: (v) => v.includes('parents') && !v.includes('return') });
craft('card-youth-housing-alone', { event: 'youth-housing', era: 'present', tier: 1, age: 24, mod: (d) => { clean(d, INDEP_DROP); d.flags.push('lives_alone'); d.assets.dwelling = 'rent'; }, want: (v) => !v.includes('return') && !v.includes('parents') });
craft('card-youth-housing-jeonse', { event: 'youth-housing', era: 'present', tier: 3, age: 28, mod: (d) => { clean(d, INDEP_DROP); d.assets.dwelling = 'jeonse'; }, want: (v) => v.includes('return') && !v.includes('parents') });
craft('card-youth-housing-past-rent', { event: 'youth-housing', era: 'past', tier: 1, age: 26, mod: (d) => { clean(d, INDEP_DROP); d.assets.dwelling = 'rent'; }, want: (v) => v.includes('return') });

// 부모 임종: moved_home 판 vs 일반 가족 집 판
const farewellMod = (moved) => (d) => {
  d.flags = d.flags.filter((f) => !['parents_gone', 'married', 'has_partner', 'has_child', 'moved_home', 'in_care', 'renting', 'own_home'].includes(f));
  d.flags.push('lives_with_parents');
  if (moved) d.flags.push('moved_home');
  d.seen = Object.fromEntries(Object.entries(d.seen).filter(([k]) => k !== 'middle-parents-farewell'));
  d.assets.dwelling = 'family';
};
craft('card-farewell-moved', { event: 'middle-parents-farewell', era: 'present', tier: 3, age: 56, mod: farewellMod(true) });
craft('card-farewell-plain', { event: 'middle-parents-farewell', era: 'present', tier: 3, age: 56, mod: farewellMod(false) });

// 미혼 45세 인생(진행): 부모님과 한집 / 독립
for (const [name, fam] of [['life-family-single-45', true], ['life-rent-single-45', false]]) {
  for (const c of seeds.filter((r) => r.era === 'present' && r.tier === 3).slice(0, 12)) {
    const base = toAge('present', c.seed, 3, 45, 0);
    if (!base) continue;
    const d = structuredClone(base);
    d.flags = d.flags.filter((f) => !['married', 'has_partner', 'has_child', 'child_left', 'child_late', 'moved_home', 'in_care', 'parents_gone', 'renting', 'own_home', 'lives_alone', 'lives_with_parents'].includes(f));
    if (fam) {
      d.flags.push('lives_with_parents');
      d.assets.dwelling = 'family';
    } else {
      d.flags.push('renting');
      d.assets.dwelling = 'rent';
    }
    d.seen = Object.fromEntries(Object.entries(d.seen).filter(([k]) => !['middle-lonely-holiday', 'senior-alone'].includes(k)));
    d.paused = false;
    if (write(name + '-s' + c.seed, d)) console.log(`OK ${name}-s${c.seed}`);
  }
}
console.log('r2 저장', fs.readdirSync(SAVES).length);
