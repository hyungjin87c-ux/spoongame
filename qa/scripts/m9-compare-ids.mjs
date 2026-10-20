// QA-003 M9: 최종 케이스 표(M9)가 M8 2회차 표(432건)의 모든 ID를 다시 돌렸는지, 판정이 바뀐 것은 무엇인지 대조한다.
// 사용: node qa/scripts/m9-compare-ids.mjs
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from './m7c-lib.mjs';

const read = (f) => {
  const t = fs.readFileSync(path.join(ROOT, f), 'utf8').split('\n').filter(Boolean);
  const head = t.shift().split('\t');
  return new Map(t.map((l) => { const c = l.split('\t'); return [c[0], { cat: c[1], verdict: c[head.indexOf('판정')], actual: c[head.indexOf('실제')] }]; }));
};
const m8 = read('qa/results/m8/r2/cases-final.tsv');
const m9 = read('qa/results/m9/cases-final.tsv');
const missing = [...m8.keys()].filter((k) => !m9.has(k));
const added = [...m9.keys()].filter((k) => !m8.has(k));
const changed = [...m8.keys()].filter((k) => m9.has(k) && m8.get(k).verdict !== m9.get(k).verdict);
console.log(`M8 2회차 ${m8.size}건 · M9 ${m9.size}건`);
console.log(`M8에 있고 M9에 없는 ID ${missing.length}: ${missing.join(' ')}`);
console.log(`M9에서 새로 생긴 ID ${added.length}: ${added.slice(0, 120).join(' ')}`);
console.log(`판정이 바뀐 ID ${changed.length}: ${changed.map((k) => `${k}(${m8.get(k).verdict}→${m9.get(k).verdict})`).join(' ')}`);
const cnt = {};
for (const v of m9.values()) cnt[v.verdict] = (cnt[v.verdict] || 0) + 1;
console.log('M9 판정 분포', JSON.stringify(cnt));
