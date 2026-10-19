// QA-003 M7c 2회차: F-1 재측정 결과 요약 — 1회차에 실패한 조합을 이름으로 따로 적고, 2회차 두 번의 측정과 대조한다. 결과 → qa/results/m7c/r2/guard-summary.json
// 사용: node qa/scripts/m7c-r2-analyze-guard.mjs
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, OUT } from './m7c-r2-lib.mjs';

const rl = (p) => (fs.existsSync(p) ? fs.readFileSync(p, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)) : []);
const R1 = path.join(ROOT, 'qa', 'results', 'm7c');
const key = (r) => `${r.target}|${r.font}|${r.vp}`;

const r1dbl = rl(path.join(R1, 'dbltap.jsonl'));
const r1dec = rl(path.join(R1, 'dbltap-decision.jsonl')).map((r) => ({ ...r, target: 'decision' }));
const r1fail = new Map();
for (const r of [...r1dbl, ...r1dec]) if (r.diff && Object.keys(r.diff).length) r1fail.set(key(r), r.diff);

const r2 = [...rl(path.join(OUT, 'guard-dbl.jsonl')), ...rl(path.join(OUT, 'guard-dec.jsonl')), ...rl(path.join(OUT, 'guard-inline.jsonl'))];
const byKey = new Map();
for (const r of r2) {
  const k = key(r);
  if (!byKey.has(k)) byKey.set(k, {});
  byKey.get(k)[`run${r.run}`] = r;
}
const summary = { r1FailCombos: [], r2: { combos: 0, withDiff: 0, runs: {}, secondClickKinds: {} } };
for (const [k, diff] of r1fail) {
  const rr = byKey.get(k) || {};
  summary.r1FailCombos.push({ combo: k, r1: diff, run1: rr.run1 ? (Object.keys(rr.run1.diff).length ? rr.run1.diff : 'OK(작동 0)') : '측정 없음', run2: rr.run2 ? (Object.keys(rr.run2.diff).length ? rr.run2.diff : 'OK(작동 0)') : '측정 없음', secondClick: rr.run1 && rr.run1.under ? `${rr.run1.under.tid}${rr.run1.under.dis === 'true' ? '(aria-disabled)' : ''}` : '-' });
}
const kinds = {};
for (const r of r2) {
  summary.r2.runs[`run${r.run}`] = (summary.r2.runs[`run${r.run}`] || 0) + 1;
  if (r.diff && Object.keys(r.diff).length) summary.r2.withDiff++;
  const u = r.under || {};
  const kind = u.dis === 'true' ? '가드 중인 컨트롤(aria-disabled=true)이 눌림을 버림' : u.btn ? '가드 아닌 버튼에 닿음' : u.tid && u.tid.startsWith('(') ? u.tid : '버튼 아닌 곳에 닿음(컨트롤 없음)';
  kinds[kind] = (kinds[kind] || 0) + 1;
}
summary.r2.secondClickKinds = kinds;
summary.r2.combos = byKey.size;
const by = (t) => [...byKey.entries()].filter(([k]) => k.startsWith(t + '|'));
summary.r2.counts = {
  dbl: ['keep-cite', 'keep-manual', 'skip-empty', 'discard'].map((t) => [t, by(t).length]),
  decision: by('decision').length,
  inline: by('inline').length,
};
summary.r1FailCount = r1fail.size;
const run1ok = summary.r1FailCombos.filter((c) => c.run1 === 'OK(작동 0)').length;
const run2ok = summary.r1FailCombos.filter((c) => c.run2 === 'OK(작동 0)').length;
summary.r1FailNowOk = { run1: run1ok, run2: run2ok, of: summary.r1FailCombos.length };
fs.writeFileSync(path.join(OUT, 'guard-summary.json'), JSON.stringify(summary, null, 1));
console.log(JSON.stringify({ r1FailCount: summary.r1FailCount, r1FailNowOk: summary.r1FailNowOk, r2Combos: summary.r2.combos, r2WithDiff: summary.r2.withDiff, runs: summary.r2.runs, counts: summary.r2.counts, kinds }, null, 1));
for (const c of summary.r1FailCombos) console.log(c.combo, '| r1:', JSON.stringify(c.r1), '| r2 run1:', JSON.stringify(c.run1), '| run2:', JSON.stringify(c.run2), '| 2nd click:', c.secondClick);
