// 케이스별 마지막 기록을 모아 데이터 파일로 내보낸다: qa/results/cases-final.tsv (표 그대로 붙여 넣을 수 있는 열) + cases-final.json
// (보고서 문서 자체는 마스터가 이 데이터와 최종 보고 텍스트로 만든다.)
import fs from 'node:fs';
import path from 'node:path';
import { RES_DIR } from './lib.mjs';

const last = new Map();
for (const f of fs.readdirSync(RES_DIR).filter((x) => x.endsWith('.jsonl'))) {
  for (const line of fs.readFileSync(path.join(RES_DIR, f), 'utf8').trim().split('\n')) {
    const r = JSON.parse(line);
    if (!last.has(r.id) || last.get(r.id).at <= r.at) last.set(r.id, r);
  }
}
const order = (id) => {
  const m = /^M3-([NBPA])(\d+)$/.exec(id);
  return { N: 0, B: 1, P: 2, A: 3 }[m[1]] * 1000 + Number(m[2]);
};
const ids = [...last.keys()].sort((a, b) => order(a) - order(b));
const clean = (s) => String(s ?? '').replace(/[\t\r\n]+/g, ' ').replace(/\[2m|\[22m/g, '');
const header = ['ID', '분류', '케이스', '절차', '기대', '실제', '판정', '시간배율', '스크린샷'];
const lines = [header.join('\t')];
const json = [];
const cnt = {};
for (const id of ids) {
  const r = last.get(id);
  cnt[r.verdict] = (cnt[r.verdict] || 0) + 1;
  lines.push([id, r.cat, r.title, r.steps, r.expected, r.actual, r.verdict, r.timescale || '', (r.shots || []).join(' ; ')].map(clean).join('\t'));
  json.push({ id, cat: r.cat, title: r.title, steps: r.steps, expected: r.expected, actual: r.actual, verdict: r.verdict, timescale: r.timescale || null, shots: r.shots || [], console: r.console || [] });
}
fs.writeFileSync(path.join(RES_DIR, 'cases-final.tsv'), lines.join('\n') + '\n');
fs.writeFileSync(path.join(RES_DIR, 'cases-final.json'), JSON.stringify({ counts: cnt, total: ids.length, cases: json }, null, 1));
console.log(ids.length, JSON.stringify(cnt));
