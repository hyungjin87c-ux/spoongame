// QA-003 M2 3회차 케이스 표 생성: qa/results/m2r3/cases.jsonl(케이스별 마지막 기록) → qa/results/m2r3/case-table.md
import fs from 'node:fs';
import path from 'node:path';
import { OUT } from './m2r3-lib.mjs';

const rows = fs.readFileSync(path.join(OUT, 'cases.jsonl'), 'utf8').trim().split('\n').map((l) => JSON.parse(l));
const last = new Map();
for (const r of rows) last.set(r.id, r);
const parse = (id) => {
  const m = /^M2-([A-Z]+)(\d+)([a-z]?)/.exec(id);
  return m ? { g: m[1], n: Number(m[2]), s: m[3] } : { g: 'Z', n: 0, s: '' };
};
const order = { N: 0, A: 1, C: 2, B: 3, S: 4, Q: 5, R: 6, D: 7, L: 8, V: 9, X: 10 };
const ids = [...last.keys()].filter((id) => !/변이점검/.test(id)).sort((a, b) => {
  const pa = parse(a), pb = parse(b);
  return (order[pa.g] ?? 9) - (order[pb.g] ?? 9) || pa.n - pb.n || pa.s.localeCompare(pb.s);
});
const esc = (s) => String(s ?? '').replace(/\|/g, '\|').replace(/\n/g, ' ');
const cut = (s, n) => (s.length > n ? s.slice(0, n - 1) + '…' : s);
const out = ['| ID | 절차 | 기대 | 실제 | 판정 | 스크린샷 |', '|---|---|---|---|---|---|'];
const count = {};
for (const id of ids) {
  const r = last.get(id);
  count[r.verdict] = (count[r.verdict] || 0) + 1;
  const shots = (r.shots || []).filter(Boolean).map((s) => s.replace(/^qa\//, ''));
  const shotCell = shots.length ? shots.slice(0, 3).map((s) => `\`${s}\``).join('<br>') + (shots.length > 3 ? `<br>…외 ${shots.length - 3}장` : '') : r.verdict === 'SKIP' ? '(실행 불가)' : '-';
  const verdict = r.verdict === 'FAIL' ? `**FAIL**${r.severity ? ` (${r.severity})` : ''}` : r.verdict;
  out.push(`| ${id} ${esc(cut(r.title, 70))} | ${esc(cut(r.steps, 260))} | ${esc(cut(r.expected, 200))} | ${esc(cut(r.actual, 420))}${r.console.length ? ` (콘솔 ${r.console.length}건: ${esc(cut(r.console.map((c) => c.type + ' ' + c.text).join('; '), 120))})` : ''} | ${verdict} | ${shotCell} |`);
}
fs.writeFileSync(path.join(OUT, 'case-table.md'), out.join('\n') + '\n');
console.log(`케이스 ${ids.length}개: ${JSON.stringify(count)}`);
const anyExt = ids.filter((id) => last.get(id).externalRequests.length);
console.log('외부 요청이 잡힌 케이스:', anyExt.length ? anyExt.join(',') : '없음');
const anyCon = ids.filter((id) => last.get(id).console.length);
console.log('콘솔 기록이 있는 케이스:', anyCon.join(',') || '없음');
const notPass = ids.filter((id) => !['PASS', 'RECORD'].includes(last.get(id).verdict));
console.log('PASS 아님:', notPass.map((id) => `${id}=${last.get(id).verdict}`).join(', ') || '없음');
