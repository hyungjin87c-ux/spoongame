// QA-003 M3 EV7: 출생신고의 주인공·또래 이름이 원자료(법원 상위 이름 현황)·연대 풀·성씨 목록과 일치하는가 — 표본 스캔(samples-*.jsonl)을 원자료 파일에서 직접 대조
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { OUT, ROOT } from './m3-lib.mjs';
const require = createRequire(import.meta.url);
const raw = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/data/sources/scourt-birth-names.json'), 'utf8'));
const names = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/data/names.json'), 'utf8'));
const forb = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/data/forbiddenNames.json'), 'utf8'));
const surnames = new Set(names.surnames.items.map((s) => s.name));
const yearPool = (y) => ({ male: raw.years[y].M.map((r) => r.name), female: raw.years[y].F.map((r) => r.name) });
const present = yearPool('2025');
const future = { male: new Set(), female: new Set() };
for (const y of ['2021', '2022', '2023', '2024', '2025']) for (const g of ['male', 'female']) for (const n of yearPool(y)[g]) future[g].add(n);
const decadePool = (decade) => {
  const d = names.decades[String(decade)];
  const flat = (o) => (Array.isArray(o) ? o : Object.values(o).flat()).map((x) => (typeof x === 'string' ? x : x.name));
  return { male: new Set(flat(d.male)), female: new Set(flat(d.female)) };
};
const forbidden = new Set((forb.names || []).map((x) => (typeof x === 'string' ? x : x.name ?? `${x.surname ?? ''}${x.given ?? ''}`)));
const split = (full) => {
  for (const len of [2, 1]) if (surnames.has(full.slice(0, len)) && full.length - len >= 1) return [full.slice(0, len), full.slice(len)];
  return [null, full];
};
const out = {};
let total = 0;
let bad = [];
for (const era of ['present', 'past', 'future']) {
  const rows = fs.readFileSync(path.join(OUT, `samples-${era}.jsonl`), 'utf8').trim().split('\n').map((l) => JSON.parse(l));
  let n = 0;
  for (const r of rows) {
    const yr = r.save.birthYear;
    const entries = [{ who: '주인공', name: r.birth.name, gender: r.save.gender, year: yr }, ...r.birth.peers.map((p, i) => ({ who: `또래${i + 1}`, name: p.name, gender: p.gender === '남성' ? 'male' : 'female', year: yr }))];
    for (const e of entries) {
      n++;
      total++;
      const [sur, given] = split(e.name);
      if (!sur) bad.push(`${era}/seed${r.seed}/${e.who}: 성씨 목록에 없음 ${e.name}`);
      const pool = era === 'present' ? new Set(present[e.gender]) : era === 'future' ? future[e.gender] : decadePool(Math.floor(e.year / 10) * 10)[e.gender];
      if (!pool.has(given)) bad.push(`${era}/seed${r.seed}/${e.who}: 이름 ${given}이 ${era} 풀(${e.gender})에 없음`);
      if (forbidden.has(e.name)) bad.push(`${era}/seed${r.seed}/${e.who}: 금지 이름 ${e.name}`);
    }
  }
  out[era] = n;
}
console.log(JSON.stringify({ checked: out, total, bad: bad.length, sample: bad.slice(0, 6) }));
fs.writeFileSync(path.join(OUT, 'names-check.json'), JSON.stringify({ checked: out, total, bad }, null, 1));
