// QA-003 M5: 「표기 = 실제」 대조 표본 30건을 보기 좋게 뽑는다(표준 출력). 재생(samples-match.jsonl)에서 세 시대·재력 1~5·20세 미만/성인이 섞이게 고른다.
import fs from 'node:fs';
import path from 'node:path';
import { OUT } from './m5-lib.mjs';
const L = fs.readFileSync(path.join(OUT, 'samples-match.jsonl'), 'utf8').trim().split('\n').map((l) => JSON.parse(l)).filter((r) => !r.err);
const by = new Map();
for (const r of L) {
  if (!by.has(r.fixtureKey)) by.set(r.fixtureKey, []);
  by.get(r.fixtureKey).push(r);
}
const KEYS = ['health', 'happiness', 'education', 'relationships'];
const KO = { health: '건강', happiness: '행복', education: '지식', relationships: '관계' };
const rows = [];
for (const [key, reps] of by) {
  if (reps.length < 2) continue;
  const S = JSON.parse(reps[0].pre.raw).data;
  const choices = reps[0].pre.dash.choices;
  const stat = (p, k) => p.stats[k] - S.stats[k];
  // 기준 선택지: 영향 항목이 가장 적은 선택지 → 해마다 규칙(자연 변화)이 낀 값의 기준
  const baseRep = [...reps].sort((a, b) => choices.find((c) => c.id === a.choiceId).impact.length - choices.find((c) => c.id === b.choiceId).impact.length)[0];
  const Pb = JSON.parse(baseRep.post.raw).data;
  for (const r of reps) {
    const c = choices.find((x) => x.id === r.choiceId);
    if (c.impact.length < 3 && r !== reps[0]) continue;
    const P = JSON.parse(r.post.raw).data;
    const dStats = KEYS.map((k) => `${KO[k]} ${stat(P, k) >= 0 ? '+' : ''}${stat(P, k)}`).join(' ');
    const rel = KEYS.filter((k) => stat(P, k) - stat(Pb, k) !== 0).map((k) => `${KO[k]} ${stat(P, k) - stat(Pb, k) > 0 ? '+' : ''}${stat(P, k) - stat(Pb, k)}`).join(' ');
    const money = !S.assets && P.assets ? `20세 시작: 순자산 ${P.assets.net}·부채 ${P.assets.debt}(집안 살림 ${S.familyFund} → 합산)` : S.assets && P.assets ? `순자산 ${P.assets.net - S.assets.net >= 0 ? '+' : ''}${P.assets.net - S.assets.net}·부채 ${P.assets.debt - S.assets.debt >= 0 ? '+' : ''}${P.assets.debt - S.assets.debt}(기준 대비 순자산 ${P.assets.net - Pb.assets.net >= 0 ? '+' : ''}${P.assets.net - Pb.assets.net}·부채 ${P.assets.debt - Pb.assets.debt >= 0 ? '+' : ''}${P.assets.debt - Pb.assets.debt})` : `집안 살림 ${P.familyFund - S.familyFund >= 0 ? '+' : ''}${P.familyFund - S.familyFund}`;
    rows.push({ era: r.era, tier: r.tier, age: r.age, ev: r.eventId, choice: r.choiceId, line: c.impact.map((i) => i.shown).join(' · ') || '(없음)', dStats, rel: rel || '—(기준)', money, base: baseRep.choiceId === r.choiceId });
  }
}
// 고르게: 이벤트가 겹치지 않게, 시대·재력이 돌아가며 — 한 상황에서 영향 줄이 가장 긴 선택지와 기준 선택지 두 줄씩 15상황 = 30건
const fixtures = [...by.keys()].map((k) => ({ k, reps: by.get(k) })).filter((x) => x.reps.length >= 2);
fixtures.sort((a, b) => (a.reps[0].eventId + a.reps[0].era + a.reps[0].tier).localeCompare(b.reps[0].eventId + b.reps[0].era + b.reps[0].tier));
const usedEv = new Set();
const pick = [];
const want = [];
let rot = 0;
const eras = ['present', 'past', 'future'];
for (const x of fixtures) {
  const ev = x.reps[0].eventId;
  if (usedEv.has(ev)) continue;
  const richest = Math.max(...x.reps[0].pre.dash.choices.map((c) => c.impact.length));
  if (richest < 3) continue;
  if (x.reps[0].era !== eras[rot % 3] && fixtures.length > 60) continue;
  usedEv.add(ev);
  rot++;
  const rowsOf = rows.filter((r) => r.age === x.reps[0].age && r.ev === ev && r.era === x.reps[0].era && r.tier === x.reps[0].tier);
  const rich = [...rowsOf].sort((a, b) => b.line.split('·').length - a.line.split('·').length)[0];
  const base = rowsOf.find((r) => r.base);
  for (const r of [rich, base]) if (r && !pick.includes(r)) pick.push(r);
  if (pick.length >= 30) break;
}
pick.slice(0, 30).forEach((r, i) => console.log(`| ${i + 1} | ${r.era} 재력 ${r.tier} ${r.age}세 ${r.ev} | ${r.choice}${r.base ? '(기준)' : ''} | ${r.line} | ${r.dStats} | ${r.money} | ${r.rel} | PASS |`));
console.log('rows', Math.min(30, pick.length));
