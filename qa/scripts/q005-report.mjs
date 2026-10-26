// cases.jsonl → 케이스 표(마크다운, 같은 시험의 뷰포트·엔진 반복은 한 줄로 묶음) + cases-final.jsonl(전체 기록). 사용: node qa/scripts/q005-report.mjs > 표.md
import fs from 'node:fs';
import path from 'node:path';
import { RES } from './q005-lib.mjs';

const lines = fs.readFileSync(path.join(RES, fs.existsSync(path.join(RES, 'cases.jsonl')) ? 'cases.jsonl' : 'cases-final.jsonl'), 'utf-8').trim().split('\n').map((l) => JSON.parse(l));
const last = new Map();
for (const r of lines) last.set(r.id, r);
const all = [...last.values()];
const esc = (s) => String(s ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ').trim();
const cut = (s, n) => (esc(s).length > n ? esc(s).slice(0, n - 1) + '…' : esc(s));
const count = {};
for (const r of all) count[r.verdict] = (count[r.verdict] ?? 0) + 1;

// 묶기: 「W-」「d1280-」「d1920-」「m360-」「m320-」 접두를 떼고 같은 시험이면 한 줄
const CFG = { d1280: '1280', d1920: '1920', m360: '360터치', m320: '320터치' };
const groups = new Map();
for (const r of all) {
  const m = /^(W-)?(d1280|d1920|m360|m320)-(.+)$/.exec(r.id);
  const base = m ? m[3] : r.id;
  const cfg = m ? `${m[1] ? 'WebKit ' : ''}${CFG[m[2]]}` : '';
  const key = `${r.area}|${base}`;
  if (!groups.has(key)) groups.set(key, { base, area: r.area, rows: [] });
  groups.get(key).rows.push({ cfg, r });
}
const areas = [...new Set(all.map((r) => r.area))];
const out = [];
out.push(`<!-- 케이스 ${all.length}건(표는 ${groups.size}행): ${JSON.stringify(count)} -->`);
for (const a of areas) {
  const gs = [...groups.values()].filter((g) => g.area === a);
  out.push(`\n#### ${a} (시험 ${gs.length}행 · 케이스 ${gs.reduce((s, g) => s + g.rows.length, 0)}건)\n`);
  out.push('| ID | 절차 | 기대 | 결과(구성별) | 실제(대표) | 증거 |');
  out.push('|---|---|---|---|---|---|');
  for (const g of gs) {
    const first = g.rows[0].r;
    const res = g.rows.length === 1 && g.rows[0].cfg === '' ? `**${first.verdict}**` : g.rows.map((x) => `${x.cfg} ${x.r.verdict}`).join(' · ');
    const shots = g.rows.map((x) => x.r.shot).filter(Boolean);
    const odd = g.rows.find((x) => x.r.verdict !== 'PASS') ?? g.rows[0];
    out.push(`| ${esc(g.base)} | ${cut(first.steps, 70)} | ${cut(first.expected, 90)} | ${res} | ${cut(odd.r.actual, 150)} | ${shots.length ? shots.map(esc).join(', ') : '-'} |`);
  }
}
console.log(out.join('\n'));
const jl = all.map((r) => JSON.stringify({ id: r.id, area: r.area, title: r.title, steps: r.steps, expected: r.expected, verdict: r.verdict, actual: String(r.actual ?? '').slice(0, 1500), shot: r.shot ?? null, evidence: r.evidence ? String(r.evidence).slice(0, 1500) : undefined }));
fs.writeFileSync(path.join(RES, 'cases-final.jsonl'), jl.join(String.fromCharCode(10)) + String.fromCharCode(10));
