// QA-003 M7e 결정 카드 저장 만들기 (vite-node로 실행: ./node_modules/.bin/vite-node qa/scripts/m7e-craft.mjs)
// 목표 이벤트가 「다음 한 해에 나오는」 성인 저장을 만든다: 시드·재력에 맞는 판을 코어로 목표 나이 직전까지 돌린 뒤(첫 번째 선택지 정책의 변형), 난수 상태만 바꿔 가며 stepYear가 그 이벤트의 선택지를 띄우는 상태를 찾는다.
// 코어는 「어떤 상태에서 그 카드가 뜨는지」 찾는 데만 쓰고, 보이는 문장·선택지·영향 줄은 만든 저장을 실제 화면(prod)에 넣어 화면에서 읽는다.
// 결과: qa/results/m7e/saves/card-<이벤트>-<시대>.json (일시정지 아님 — 열면 그 해가 진행되어 카드가 뜬다), saves-manifest.json에 덧붙임
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
const manifestPath = path.join(OUT, 'saves-manifest.json');
const manifest = fs.existsSync(manifestPath) ? JSON.parse(fs.readFileSync(manifestPath, 'utf8')) : {};

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

function craft(name, { event, era, tier, age, minVisible = 0, tries = 3000, orderMin = 0 }) {
  const cand = seeds.filter((r) => r.era === era && (!tier || r.tier === tier) && (!orderMin || r.order >= orderMin)).slice(0, 14);
  for (const c of cand) {
    for (let variant = 0; variant < 3; variant++) {
      const base = toAge(era, c.seed, tier, age, variant);
      if (!base) continue;
      for (let k = 1; k <= tries; k++) {
        const d = structuredClone(base);
        d.rngState = Math.imul(k, 2654435761) >>> 0;
        d.paused = false;
        const raw = JSON.stringify({ version: 8, data: d });
        const g = parseGame(raw, EVENT_POOL);
        if (!g) break;
        const r = stepYear(g, EVENT_POOL);
        if (r.tick.kind === 'choice' && r.tick.eventId === event && (r.state.pending?.choiceIds.length ?? 0) >= minVisible) {
          fs.writeFileSync(path.join(SAVES, `${name}.json`), raw);
          manifest[name] = { event, era, tier: d.character.parentWealth, age: d.age, seed: c.seed, visible: r.state.pending.choiceIds, flags: d.flags };
          console.log(`OK ${name}: ${r.state.pending.choiceIds.join(',')} (시드 ${c.seed} t${d.character.parentWealth} ${d.age}세)`);
          return true;
        }
      }
    }
  }
  console.log(`실패 ${name}`);
  return false;
}

const TARGETS = JSON.parse(process.env.TARGETS || '[]');
const DEFAULT = [
  // [이벤트, 시대, 재력, 나이, 최소 보이는 선택지, 출생 순서 하한]
  ['school-family-priority', 'past', 2, 14, 3, 2],
  ['school-tutoring', 'present', 5, 12, 3],
  ['school-exam', 'present', 5, 17, 3],
  ['school-scholarship', 'present', 2, 16, 2],
  ['school-teacher-notice', 'present', 3, 14, 3],
  ['youth-housing', 'present', 3, 26, 3],
  ['youth-startup', 'future', 3, 30, 3],
  ['youth-first-job', 'present', 5, 25, 3],
  ['youth-exam-prep', 'present', 3, 24, 3],
  ['youth-rent-hike', 'present', 3, 30, 3],
  ['youth-gig-work', 'future', 2, 25, 3],
  ['middle-parents-care', 'present', 3, 50, 3],
  ['middle-marriage-crisis', 'present', 3, 48, 3],
  ['middle-parents-farewell', 'past', 3, 55, 3],
  ['middle-debt-guarantee', 'present', 3, 46, 3],
  ['middle-child-school', 'present', 3, 56, 3],
  ['middle-home-loan', 'present', 4, 46, 3],
  ['middle-layoff', 'present', 3, 50, 3],
  ['senior-gathering', 'present', 3, 70, 3],
  ['senior-illness-later', 'present', 3, 82, 3],
  ['senior-estate', 'present', 5, 72, 3],
  ['senior-move-home', 'present', 3, 74, 3],
  ['senior-spouse-care', 'present', 3, 74, 3],
  ['senior-long-life', 'future', 3, 76, 3],
];
const list = TARGETS.length ? TARGETS : DEFAULT.map(([event, era, tier, age, minVisible, orderMin]) => ({ event, era, tier, age, minVisible, orderMin }));
let ok = 0;
for (const t of list) if (craft(`card-${t.event}-${t.era}`, t)) ok++;
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 1));
console.log(`카드 저장 ${ok}/${list.length}`);
