// 최종 QA 원자료 정리: cases.jsonl(같은 ID는 마지막 기록) → cases-final.json / cases-final.tsv + 요약 + 보호 파일 해시 대조 + 리포트 초안(QA-001.draft.md)
import fs from 'node:fs';
import path from 'node:path';
import { FIN, ROOT } from './f-lib.mjs';
const lines = fs.readFileSync(path.join(FIN, 'cases.jsonl'), 'utf8').trim().split('\n').map((l) => JSON.parse(l));
const last = new Map();
for (const c of lines) last.set(c.id, c);
const TITLE_FIX = {
  'F-AX93': '첫 선택지 전 사망 문구: 104세 저장에서 「다음 결정으로」 → 사망 → 엔딩 문구 확인 (옛 제목의 「재시작 수단 없음」은 M5에서 다시 태어나기가 생겨 해당 없음)',
};
const ORDER = [
  /^F-N/, /^F-P\d/, /^F-T/, /^F-S/, /^F-E/, /^F-C/, /^F-AR/, /^F-AN/, /^F-AU/, /^F-AK/, /^F-AC/, /^F-AL/, /^F-AT/, /^F-AM/, /^F-AQ/, /^F-AX/, /^F-AE/, /^F-AP/, /^F-A99/, /^F-R/, /^F-X/,
];
const rank = (id) => {
  const k = ORDER.findIndex((re) => re.test(id));
  return k < 0 ? 99 : k;
};
const cases = [...last.values()].map((c) => ({ ...c, title: TITLE_FIX[c.id] || c.title })).sort((a, b) => rank(a.id) - rank(b.id) || a.id.localeCompare(b.id, 'en', { numeric: true }));
const CAT = (c) => c.cat || '';
const V = { PASS: 'PASS', FAIL: 'FAIL', RECORD: '기록만', JUDGE: '판단 필요', SKIP: '미실행', ERROR: 'ERROR', '기록만': '기록만' };
const counts = {};
for (const c of cases) counts[V[c.verdict] || c.verdict] = (counts[V[c.verdict] || c.verdict] || 0) + 1;

// 보호 파일 해시 대조
const parse = (f) => Object.fromEntries(fs.readFileSync(path.join(FIN, f), 'utf8').trim().split('\n').map((l) => { const i = l.indexOf('  '); return [l.slice(i + 2), l.slice(0, i)]; }));
let hashDiff = { start: 0, end: 0, changed: [], added: [], removed: [] };
if (fs.existsSync(path.join(FIN, 'hash-end.txt'))) {
  const a = parse('hash-start.txt');
  const b = parse('hash-end.txt');
  hashDiff.start = Object.keys(a).length;
  hashDiff.end = Object.keys(b).length;
  for (const k of Object.keys(a)) if (!(k in b)) hashDiff.removed.push(k);
  for (const k of Object.keys(b)) if (!(k in a)) hashDiff.added.push(k);
  for (const k of Object.keys(a)) if (k in b && a[k] !== b[k]) hashDiff.changed.push(k);
}

const out = cases.map((c) => ({
  id: c.id,
  category: CAT(c),
  title: c.title,
  steps: c.steps,
  expected: c.expected,
  actual: c.actual,
  verdict: V[c.verdict] || c.verdict,
  timeScaleProbe: !!c.ts,
  screenshots: (c.allShots || c.shots || []).filter(Boolean),
  console: (c.console || []).length ? c.console : [],
  note: c.note || null,
  at: c.at,
}));
fs.writeFileSync(path.join(FIN, 'cases-final.json'), JSON.stringify({ counts, hash: hashDiff, cases: out }, null, 1));
const esc = (s) => String(s ?? '').replace(/[\t\r\n]+/g, ' ');
fs.writeFileSync(path.join(FIN, 'cases-final.tsv'), ['id\tcategory\ttitle\tsteps\texpected\tactual\tverdict\ttimeScaleProbe\tscreenshots\tconsole', ...out.map((c) => [c.id, c.category, c.title, c.steps, c.expected, c.actual, c.verdict, c.timeScaleProbe ? 'Y' : '-', c.screenshots.join(' | '), c.console.length].map(esc).join('\t'))].join('\n'));

// 요약 출력
console.log('총', cases.length, JSON.stringify(counts));
console.log('해시:', JSON.stringify({ start: hashDiff.start, end: hashDiff.end, changed: hashDiff.changed, added: hashDiff.added, removed: hashDiff.removed }));
for (const c of out) if (!['PASS'].includes(c.verdict)) console.log(`${c.verdict} ${c.id} ${String(c.title).slice(0, 70)}`);
// 마크다운 케이스 표
const rows = out.map((c) => `| ${c.id} | ${c.category} | ${esc(c.title).replace(/\|/g, '/')} | **${c.verdict}** | ${c.timeScaleProbe ? '개발 탐침' : '-'} | ${c.screenshots.length ? `[${c.screenshots.length}장](../screenshots/001/${path.basename(c.screenshots[0])})` : '-'} |`);
fs.writeFileSync(path.join(FIN, 'case-table.txt'), ['| ID | 분류 | 케이스 | 판정 | 시간 배율·탐침 | 스크린샷 |', '|---|---|---|---|---|---|', ...rows].join('\n'));
