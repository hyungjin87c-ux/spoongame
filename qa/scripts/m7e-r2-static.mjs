// QA-003 M7e 2회차 풀 전체(정적) 문장 점검: 이벤트 JSON의 본문·결과·라벨·제목을 모아
//  S1 합쇼체(문장 끝 「-ㅂ니다/-습니다/-입니다/-었습니다/-니까?」 아닌 문장)  S2 8음절 이상 어절(라벨은 6음절 이상)  S3 「~지만」을 가진 문장 비율
//  S4 「~수 있었습니다.」로 끝나는 마지막 문장  S5 「외동」 판에서 읽힐 수 있는 형제 낱말  S6 「가족이나 친척」·「가족·친척」 쓰임  S7 한 본문 안 같은 끝맺음 2문장 연속
// 사용: QA_OUT=qa/results/m7e/r2 node qa/scripts/m7e-r2-static.mjs   결과: <OUT>/static-pool.json
import fs from 'node:fs';
import path from 'node:path';
import { OUT, ROOT } from './m7e-lib.mjs';

const rows = [];
for (const f of ['infant', 'school', 'youth', 'middle', 'senior']) {
  const j = JSON.parse(fs.readFileSync(path.join(ROOT, 'src', 'data', 'events', f + '.json'), 'utf8'));
  for (const e of Array.isArray(j) ? j : j.events) {
    rows.push({ id: e.id, kind: '본문', t: e.text });
    rows.push({ id: e.id, kind: '제목', t: e.title });
    for (const c of e.choices ?? []) {
      rows.push({ id: `${e.id}/${c.id}`, kind: '결과', t: c.result });
      rows.push({ id: `${e.id}/${c.id}`, kind: '라벨', t: c.label });
    }
    for (const b of e.bonuses ?? []) if (b.note) rows.push({ id: `${e.id}/bonus`, kind: '보너스', t: b.note });
  }
}
const sents = (t) => t.replace(/\([^)]*\)/g, '').split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter(Boolean);
const hangul = (w) => (w.match(/[가-힣]/g) ?? []).length;
const out = { rows: rows.length, texts: {}, S1: [], S2: [], S2label: [], S3: {}, S4: [], S5: [], S6: {}, S7: [] };
const body = rows.filter((r) => r.kind === '본문' || r.kind === '결과');
let sN = 0;
let jiman = 0;
for (const r of body) {
  const ss = sents(r.t);
  sN += ss.length;
  for (const s of ss) {
    if (!/(?:니다|니까)[.?]$/.test(s)) out.S1.push({ id: r.id, kind: r.kind, s });
    if (/지만[ ,]/.test(s)) jiman++;
  }
  for (const w of r.t.split(/\s+/)) {
    const bare = w.replace(/[^가-힣]/g, '');
    if (hangul(bare) >= 8) out.S2.push({ id: r.id, kind: r.kind, w });
  }
  const last = ss[ss.length - 1] ?? '';
  if (/수 있었습니다\.$/.test(last)) out.S4.push({ id: r.id, kind: r.kind, last });
  if (ss.length >= 2) {
    const key = (s) => s.replace(/\.$/, '').split(/\s+/).slice(-2).join(' ');
    if (key(ss[ss.length - 1]) === key(ss[ss.length - 2])) out.S7.push({ id: r.id, kind: r.kind, t: r.t });
  }
}
out.S3 = { sentences: sN, jiman, ratio: Number(((jiman / sN) * 100).toFixed(1)) };
for (const r of rows.filter((r) => r.kind === '라벨')) {
  for (const w of r.t.split(/\s+/)) if (hangul(w.replace(/[^가-힣]/g, '')) >= 6) out.S2label.push({ id: r.id, w });
}
const SIB = /(형제|동생|언니|오빠|누나|자매|손위|손아래|맏이|맏아들|막내)/;
for (const r of rows) if (SIB.test(r.t)) out.S5.push({ id: r.id, kind: r.kind, t: r.t.slice(0, 80) });
for (const key of ['가족이나 친척', '가족·친척', '일가친척', '형제들']) out.S6[key] = rows.filter((r) => r.t.includes(key)).map((r) => `${r.id}(${r.kind})`);
out.texts = { 본문: rows.filter((r) => r.kind === '본문').length, 결과: rows.filter((r) => r.kind === '결과').length, 라벨: rows.filter((r) => r.kind === '라벨').length };
fs.writeFileSync(path.join(OUT, 'static-pool.json'), JSON.stringify(out, null, 1));
console.log(JSON.stringify({ rows: out.rows, texts: out.texts, S1: out.S1.length, S2: out.S2.length, S2label: out.S2label.length, S3: out.S3, S4: out.S4.length, S5: out.S5.length, S6: Object.fromEntries(Object.entries(out.S6).map(([k, v]) => [k, v.length])), S7: out.S7.length }, null, 1));
console.log('S1', out.S1.slice(0, 8));
console.log('S2', out.S2.slice(0, 12));
console.log('S2label', out.S2label.slice(0, 20));
console.log('S4', out.S4.slice(0, 8));
console.log('S6', out.S6);
console.log('S7', out.S7.slice(0, 5));
