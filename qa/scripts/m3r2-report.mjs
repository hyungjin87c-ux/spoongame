// cases.jsonl → 케이스 요약을 표준 출력으로만 낸다(마크다운 파일을 만들지 않는다). 사용: node qa/scripts/m3-report.mjs [짧은 표]
import fs from 'node:fs';
import path from 'node:path';
import { OUT } from './m3r2-lib.mjs';
const rows = fs.readFileSync(path.join(OUT, 'cases.jsonl'), 'utf8').trim().split('\n').map((l) => JSON.parse(l));
const last = new Map();
for (const r of rows) last.set(r.id, r);
const ORDER = ['정상', '표본', '공격', '접근성', '정합', '회귀', '환경', '인상', '기록'];
const list = [...last.values()].sort((a, b) => ORDER.indexOf(a.cat) - ORDER.indexOf(b.cat) || a.id.localeCompare(b.id, 'en', { numeric: true }));
const cnt = {};
for (const r of list) cnt[r.verdict] = (cnt[r.verdict] || 0) + 1;
const esc = (s) => String(s ?? '').replace(/\|/g, '/').replace(/\n/g, ' ');
const cut = (s, n) => (esc(s).length > n ? esc(s).slice(0, n) + '…' : esc(s));
console.log(JSON.stringify({ total: list.length, ...cnt }));
for (const r of list) {
  const sh = (r.shots || []).slice(0, 1).map((x) => x.replace('qa/screenshots/003/', '')).join('');
  console.log(`| ${r.id} | ${cut(r.steps && r.steps !== '-' ? r.steps : r.title, 62)} | ${cut(r.expected, 42)} | ${cut(r.actual, 100)} | ${r.verdict} | ${sh || '-'}${(r.shots || []).length > 1 ? ` (+${r.shots.length - 1})` : ''} |`);
}
