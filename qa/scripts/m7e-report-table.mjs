// QA-003 M7e 리포트용 케이스 표 만들기: cases.jsonl → 마크다운 표(ID/절차/기대/실제/판정/스크린샷)를 표준 출력으로 낸다(파일을 쓰지 않는다 — 리포트 본문은 답으로 넘긴다).
import fs from 'node:fs';
import path from 'node:path';
import { OUT } from './m7e-lib.mjs';

const rows = fs.readFileSync(path.join(OUT, 'cases.jsonl'), 'utf8').trim().split('\n').map((l) => JSON.parse(l));
const order = ['N', 'T', 'B', 'R', 'D', 'A', 'L', 'C', 'K', 'E'];
const key = (id) => {
  const m = /^M7e-([A-Z])(\d+)([a-z]?)/.exec(id);
  return m ? [order.indexOf(m[1]) < 0 ? 99 : order.indexOf(m[1]), Number(m[2]), m[3]] : [99, 0, ''];
};
rows.sort((a, b) => {
  const ka = key(a.id);
  const kb = key(b.id);
  return ka[0] - kb[0] || ka[1] - kb[1] || (ka[2] < kb[2] ? -1 : ka[2] > kb[2] ? 1 : 0);
});
const cut = (t, n) => {
  const s = String(t ?? '').replace(/\s+/g, ' ').replace(/\|/g, '/').trim();
  return s.length > n ? s.slice(0, n - 1) + '…' : s;
};
const out = ['| ID | 절차 | 기대 | 실제 | 판정 | 스크린샷 |', '|---|---|---|---|---|---|'];
const tally = {};
for (const r of rows) {
  tally[r.verdict] = (tally[r.verdict] ?? 0) + 1;
  const shots = (r.shots ?? []).slice(0, 2).map((s) => '`' + s.replace('qa/screenshots/003/', '').replace('.png', '') + '`').join(' ');
  out.push(`| ${r.id.replace('M7e-', '')} | ${cut(r.steps, 85)} | ${cut(r.expected, 60)} | ${cut(r.actual, 230)} | **${r.verdict}** | ${shots || '-'} |`);
}
console.log(out.join('\n'));
console.error(JSON.stringify({ total: rows.length, tally }));
