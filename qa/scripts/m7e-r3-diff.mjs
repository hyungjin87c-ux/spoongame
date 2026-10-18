// QA-003 M7e 3회차 「바뀐 것은 라벨 한 곳뿐」 확인(독립): 2회차에 화면에서 읽은 글(수확 374판의 연표 줄·결정 카드 본문·선택지 라벨)과 지금 이벤트 JSON을 견준다.
//  - 지금 JSON의 본문·결과 문장이 2회차 화면 글에 그대로 있는가(2회차에 못 본 결과 3개는 2회차 T09 기록 문장과 견줌)
//  - 지금 JSON의 선택지 라벨 집합 vs 2회차 화면에서 읽은 라벨 집합의 차이 = {일가친척과 의논해 치른다} / {가족·친척과 의논해 치른다}뿐인가
//  - 라벨·제목이 한글과 공백만인가(lint 규칙 /[^가-힣 ]/), 어절 최대 음절
// 결과: <OUT>/diff-r2-r3.json  사용: QA_OUT=qa/results/m7e/r3 node qa/scripts/m7e-r3-diff.mjs
import fs from 'node:fs';
import path from 'node:path';
import { OUT, ROOT } from './m7e-lib.mjs';

const R2DIR = path.join(ROOT, 'qa', 'results', 'm7e');
const pool = { bodies: [], results: [], labels: [], titles: [] };
for (const f of ['infant', 'school', 'youth', 'middle', 'senior']) {
  const j = JSON.parse(fs.readFileSync(path.join(ROOT, 'src', 'data', 'events', f + '.json'), 'utf8'));
  for (const e of Array.isArray(j) ? j : j.events) {
    pool.bodies.push([e.id, e.text]);
    pool.titles.push([e.id, e.title]);
    for (const c of e.choices ?? []) {
      pool.results.push([`${e.id}/${c.id}`, c.result]);
      pool.labels.push([`${e.id}/${c.id}`, c.label]);
    }
  }
}
const r2screen = [];
const r2labels = new Set();
const r2titles = new Set();
for (const f of fs.readdirSync(R2DIR).filter((f) => /^samples-r2-harvest-.*\.jsonl$/.test(f))) {
  for (const line of fs.readFileSync(path.join(R2DIR, f), 'utf8').split(String.fromCharCode(10))) {
    if (!line.trim()) continue;
    const r = JSON.parse(line);
    if (!r.final) continue;
    for (const h of r.final.history) { r2screen.push(h.text); if (h.choice) r2labels.add(h.choice); if (h.title) r2titles.add(h.title); }
    for (const d of r.decisions) { r2screen.push(d.text); r2titles.add(d.title); for (const c of d.choices) r2labels.add(c.label); }
  }
}
const blob = r2screen.join(String.fromCharCode(10));
const cases = fs.readFileSync(path.join(R2DIR, 'r2-cases.jsonl'), 'utf8');
const t09 = cases.split(String.fromCharCode(10)).filter(Boolean).map((l) => JSON.parse(l)).find((r) => r.id === 'r2-T09')?.actual ?? '';
const bodyMiss = pool.bodies.filter(([, t]) => !blob.includes(t));
const resMiss = pool.results.filter(([, t]) => !blob.includes(t) && !t09.includes(t));
const nowLabels = new Set(pool.labels.map((x) => x[1]));
const added = [...nowLabels].filter((l) => !r2labels.has(l));
const removed = [...r2labels].filter((l) => !nowLabels.has(l));
const nonHangul = [...pool.labels, ...pool.titles].filter(([, t]) => /[^가-힣 ]/.test(t));
const hangul = (w) => (w.match(/[가-힣]/g) ?? []).length;
let maxWord = 0;
let maxWordWhere = '';
for (const [id, t] of pool.labels) for (const w of t.split(' ')) if (hangul(w) > maxWord) { maxWord = hangul(w); maxWordWhere = `${id} 「${w}」`; }
const out = { r2Lives: 'samples-r2-harvest', poolBodies: pool.bodies.length, poolResults: pool.results.length, poolLabels: nowLabels.size, bodyMiss: bodyMiss.map((x) => x[0]), resMiss: resMiss.map((x) => x[0]), labelsAdded: added, labelsRemoved: removed, nonHangulLabelsTitles: nonHangul.map((x) => `${x[0]} ${x[1]}`), maxLabelWordSyllables: maxWord, maxLabelWordWhere: maxWordWhere, r2TitlesSeen: r2titles.size };
fs.writeFileSync(path.join(OUT, 'diff-r2-r3.json'), JSON.stringify(out, null, 1));
console.log(JSON.stringify(out, null, 1));
