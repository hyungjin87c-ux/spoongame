// QA-003 M7a 감사용 저장 만들기 (vite-node로 실행: ./node_modules/.bin/vite-node qa/scripts/m7a-saves.mjs)
//  - card-<이벤트>   : 영유아 결정 카드 (craft-saves.json에서 재력이 가장 높아 선택지가 모두 보이는 저장)
//  - log2           : 8세 일시정지 대시보드, 인생 기록에 영유아 0~7세의 가장 긴 문장을 한 해 두 줄로 쌓은 저장
//  - ending-<시대>-t<재력> : 코어로 한 판을 끝까지 돌린 엔딩 저장(출발선 문장이 재력 1~5단계별로 다르다)
//  - ending-long     : 위 엔딩에 영유아 한 해 두 줄(가장 긴 문장)을 넣은 저장
// 코어는 저장을 만드는 데만 쓰고, 보이는 모습은 실제 화면(prod)에서 잰다.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { stepYear, resolveChoiceStep } from '../../src/core/life';
import { parseGame } from '../../src/core/storage';
import { EVENT_POOL } from '../../src/data/events';
import { createInitialState, beginBirth, enterBirth, enterLife } from '../../src/core/state';
const RP = process.env.QA_RP || '';

const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'results', 'm7a');
const SAVES = path.join(OUT, RP + 'saves');
fs.mkdirSync(SAVES, { recursive: true });
const craft = JSON.parse(fs.readFileSync(path.join(OUT, RP + 'craft-saves.json'), 'utf8'));
const seeds = JSON.parse(fs.readFileSync(path.join(OUT, RP + 'seeds.json'), 'utf8'));
const write = (name, raw) => fs.writeFileSync(path.join(SAVES, `${name}.json`), raw);

// ---- 결정 카드 ----
const CARD_PICK = {
  'infant-care': 'w-infant-care-present-t5',
  'infant-stories': 'w-infant-stories-present-t5',
  'infant-fever': 'w-infant-fever-present-t5',
  'infant-parental-leave': 'w-infant-parental-leave-present-t5',
  'infant-first-birthday': 'w-infant-first-birthday-present-t5',
  'infant-daycare-wait': 'w-infant-daycare-wait-present-t5',
  'infant-noise': 'w-infant-noise-present-t4',
  'infant-kindergarten': 'w-infant-kindergarten-present-t5',
  'infant-hospital-stay': 'w-infant-hospital-stay-present-t5',
  'infant-moving': 'w-infant-moving-present-t3',
  'infant-early-lessons': 'w-infant-early-lessons-present-t5',
  'school-supplies': 'w-school-supplies-present-t5',
  'school-after-hours': 'w-school-after-hours-present-t5',
  'infant-meal-start': 'w-infant-meal-start-present-t5',
  'infant-new-sibling': 'w-infant-new-sibling-present-t5',
  'infant-new-sibling-gc': 'w-infant-new-sibling-gc-present-t5',
  'infant-sibling-toy': 'w-infant-sibling-toy-present-t5',
};
for (const [ev, key] of Object.entries(CARD_PICK)) {
  if (!craft[key]) console.log('없음', key);
  else write(`card-${ev}`, craft[key].raw);
}

// ---- 가장 긴 영유아 줄로 만든 연표 ----
const infantEvents = [...EVENT_POOL.byId.values()].filter((e) => (e.ageRange?.min ?? 0) <= 7 && (e.stages ?? []).some((s) => s === 'infant' || e.id.startsWith('school-first') || e.id === 'school-supplies' || e.id === 'school-after-hours'));
function linesFor(age) {
  const cand = [];
  for (const e of infantEvents) {
    if ((e.ageRange?.min ?? 0) > age || (e.ageRange?.max ?? 99) < age) continue;
    if (e.choices) {
      for (const c of e.choices) cand.push({ ev: e, entry: { age, kind: 'choice', title: e.title, text: c.result, choice: c.label, eventId: e.id }, len: c.result.length + c.label.length });
    } else cand.push({ ev: e, entry: { age, kind: 'event', title: e.title, text: e.text, eventId: e.id }, len: e.text.length });
  }
  return cand;
}
function crafted(base) {
  const hist = [base.history[0]];
  const used = new Set();
  for (let age = 0; age <= 7; age++) {
    const c = linesFor(age).filter((x) => !used.has(x.ev.id)).sort((a, b) => b.len - a.len);
    // 마일스톤 줄을 먼저(여러 개면 id 오름차순, r3: 1세는 걸음마·첫 말 둘), 그다음 가장 긴 줄
    const msList = c.filter((x) => x.ev.milestone === true).sort((a, b) => a.ev.id.localeCompare(b.ev.id));
    const rest = c.filter((x) => !msList.includes(x));
    const pick = [...msList, rest[0]].filter(Boolean);
    for (const x of pick) {
      used.add(x.ev.id);
      hist.push(x.entry);
    }
    if (age === 6) hist.push({ age: 7, kind: 'stage', text: '학교에 들어갈 나이가 되었다.' });
  }
  return hist;
}

// ---- log2 ----
{
  const s0 = enterLife(enterBirth(beginBirth(createInitialState(7), 'present')));
  const d = structuredClone(s0);
  d.age = 8;
  d.paused = true;
  d.pending = null;
  d.character.parentWealth = 5;
  d.history = crafted(d);
  d.seen = Object.fromEntries(d.history.filter((h) => h.eventId).map((h) => [h.eventId, h.age]));
  d.lastChoiceAge = 6;
  d.flags = [];
  const raw = JSON.stringify({ version: 8, data: d });
  const g = parseGame(raw, EVENT_POOL);
  console.log('log2 검증', g ? 'OK' : '실패', '줄', d.history.length);
  if (g) write('log2', raw);
}

// ---- 엔딩 (코어 자동 진행) ----
function simulate(era, seed, tierWanted) {
  let s = enterLife(enterBirth(beginBirth(createInitialState(seed), era)));
  if (tierWanted && s.character.parentWealth !== tierWanted) return null;
  let guard = 0;
  while (s.phase === 'life' && guard++ < 400) {
    if (s.pending) {
      const p = s.pending;
      s = resolveChoiceStep(s, p.key, p.choiceIds[guard % p.choiceIds.length]).state;
    } else s = stepYear(s).state;
  }
  return s.phase === 'ending' ? s : null;
}
const ERAS = ['past', 'present', 'future'];
let longDone = false;
for (const era of ERAS) {
  for (const tier of [1, 2, 3, 4, 5]) {
    const cand = seeds.filter((r) => r.era === era && r.tier === tier).slice(0, 8);
    let ok = false;
    for (const c of cand) {
      const s = simulate(era, c.seed, tier);
      if (!s) continue;
      const raw = JSON.stringify({ version: 8, data: s });
      if (!parseGame(raw, EVENT_POOL)) { console.log('엔딩 검증 실패', era, tier, c.seed); continue; }
      write(`ending-${era}-t${tier}`, raw);
      console.log(`ending-${era}-t${tier} seed ${c.seed} 사망 ${s.age}세 줄 ${s.history.length}`);
      if (!longDone && era === 'present' && tier === 3) {
        const d2 = structuredClone(s);
        const keepFrom = d2.history.findIndex((h) => h.age >= 8);
        const rest = keepFrom === -1 ? [] : d2.history.slice(keepFrom).filter((h) => h.kind !== 'stage' || h.age >= 8);
        d2.history = [...crafted(d2), ...rest];
        const raw2 = JSON.stringify({ version: 8, data: d2 });
        if (parseGame(raw2, EVENT_POOL)) { write('ending-long', raw2); longDone = true; console.log('ending-long OK 줄', d2.history.length); } else console.log('ending-long 검증 실패');
      }
      ok = true;
      break;
    }
    if (!ok) console.log('엔딩 실패', era, tier);
  }
}
console.log('저장 파일', fs.readdirSync(SAVES).length);
