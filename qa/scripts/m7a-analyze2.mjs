// QA-003 M7a 수확 표본 2차 분석: 문장·상태 모순 후보(재력·교육방식·주거·시대·발달 시점)를 센다.
import fs from 'node:fs';
import path from 'node:path';
import { OUT } from './m7a-lib.mjs';
import { RP, SHOT_PREFIX } from './m7a-lib.mjs';
const ERAS = ['past', 'present', 'future'];
const games = ERAS.flatMap((era) => fs.readFileSync(path.join(OUT, `samples-${RP}harvest-${era}.jsonl`), 'utf8').trim().split('\n').filter(Boolean).map((l) => ({ ...JSON.parse(l), era })).filter((g) => !g.failed));
console.log('판', games.length);
const R = { tight: {}, neglect: {}, housing: {}, firstWordQuestion: 0, firstWordAge: {}, wordWithTantrum: 0, moving: [] };
const hist7 = (g) => g.history.filter((h) => h.age <= 7);
// 1) 「빠듯」 문구 × 재력
const tightRe = /빠듯|살림이 어려|형편이 어려|돈이 없|가난/;
for (const g of games) for (const h of hist7(g)) if (tightRe.test(h.text)) {
  const k = `${h.eventId}${h.kind === 'choice' ? '/' + h.choice : ''}`;
  (R.tight[k] ??= { n: 0, byTier: {} }).n++;
  R.tight[k].byTier[g.character.tier] = (R.tight[k].byTier[g.character.tier] ?? 0) + 1;
}
// 2) 방임 판에서 돌봄이 두터운 문장
const careIds = ['infant-checkup', 'infant-hundred-days', 'infant-first-birthday', 'infant-meal-start', 'infant-hospital-stay', 'infant-kindergarten', 'infant-early-lessons', 'infant-night-wake', 'infant-questions', 'infant-first-book', 'infant-tantrum', 'infant-parental-leave', 'infant-daycare-wait', 'infant-care-alert', 'school-supplies', 'school-after-hours', 'infant-care', 'infant-fever', 'infant-stories', 'infant-first-steps', 'infant-first-word', 'infant-vaccine'];
let neglectGames = 0;
for (const g of games) {
  if (g.character.parenting !== 'neglect') continue;
  neglectGames++;
  for (const h of hist7(g)) if (h.eventId && careIds.includes(h.eventId)) R.neglect[h.eventId] = (R.neglect[h.eventId] ?? 0) + 1;
}
R.neglectGames = neglectGames;
// 3) 주거 × 이사·이웃 항의
for (const g of games) for (const h of hist7(g)) if (['infant-moving', 'infant-noise'].includes(h.eventId)) {
  const k = `${h.eventId}|${g.report.housing}${h.kind === 'choice' ? '|' + h.choice : ''}`;
  R.housing[k] = (R.housing[k] ?? 0) + 1;
}
// 4) 첫 말과 질문기 같은 해, 첫 말 나이 분포
for (const g of games) {
  const w = g.seen['infant-first-word'];
  const q = g.seen['infant-questions'];
  const t = g.seen['infant-tantrum'];
  R.firstWordAge[w] = (R.firstWordAge[w] ?? 0) + 1;
  if (typeof q === 'number' && q === w) R.firstWordQuestion++;
  if (typeof t === 'number' && t < w) R.wordWithTantrum++;
}
// 5) 형제 × 부모 나이: 동생 맞이 때 어머니
const motherAtSib = [];
for (const g of games) { const ns = g.seen['infant-new-sibling']; if (typeof ns === 'number') motherAtSib.push(g.report.mAge + ns); }
R.motherAtSib = { n: motherAtSib.length, max: Math.max(...motherAtSib), min: Math.min(...motherAtSib) };
// 6) 한 해 두 줄에서 어체 섞임: 어떤 줄이 해라체인가(기존 이벤트 id)
const legacyInTwo = {};
let mixYears = 0;
for (const g of games) {
  const byAge = {};
  for (const h of hist7(g)) if (h.kind !== 'stage') (byAge[h.age] ??= []).push(h);
  for (const rows of Object.values(byAge)) {
    if (rows.length < 2) continue;
    const kinds = rows.map((h) => (/니다\./.test(h.text) ? 'H' : 'L'));
    if (kinds.includes('H') && kinds.includes('L')) { mixYears++; for (const [i, h] of rows.entries()) if (kinds[i] === 'L') legacyInTwo[h.eventId ?? h.kind] = (legacyInTwo[h.eventId ?? h.kind] ?? 0) + 1; }
  }
}
R.mixYears = mixYears;
R.legacyInTwo = legacyInTwo;
// 7) 7세 줄: 단계 줄(해라체) + 사건
let sevenMix = 0;
for (const g of games) {
  const rows = g.history.filter((h) => h.age === 7);
  if (rows.some((h) => h.kind === 'stage') && rows.some((h) => h.kind !== 'stage' && /니다\./.test(h.text))) sevenMix++;
}
R.sevenStageMix = sevenMix;
// 8) 한 해 줄 수 분포
const lineDist = {};
for (const g of games) { const byAge = {}; for (const h of hist7(g)) if (h.kind !== 'stage') byAge[h.age] = (byAge[h.age] ?? 0) + 1; for (let a = 0; a <= 7; a++) { const n = byAge[a] ?? 0; lineDist[n] = (lineDist[n] ?? 0) + 1; } }
R.lineDist = lineDist;
fs.writeFileSync(path.join(OUT, RP + 'analysis2.json'), JSON.stringify(R, null, 1));
console.log(JSON.stringify(R, null, 1).slice(0, 6000));
