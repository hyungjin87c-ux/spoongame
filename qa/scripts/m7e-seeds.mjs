// QA-003 M7e 시드 고르기 (vite-node로 실행: ./node_modules/.bin/vite-node qa/scripts/m7e-seeds.mjs)
// 앱의 core(beginBirth)로 「이 시드, 이 시대면 어떤 출생인지」만 읽어 시드를 고른다. 판은 실제 화면에서 돈다.
// 결과: qa/results/m7e/seeds.json (시대·재력·교육방식·출생 순서·어머니 나이·주거)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createInitialState, beginBirth } from '../../src/core/state';
const RP = process.env.QA_RP || '';

const OUT = process.env.QA_OUT ? path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', process.env.QA_OUT) : path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'results', 'm7e');
fs.mkdirSync(OUT, { recursive: true });
fs.mkdirSync(OUT, { recursive: true });
const rows = [];
for (const era of ['past', 'present', 'future']) {
  for (let seed = 1; seed <= 400; seed++) {
    const s = beginBirth(createInitialState(seed), era);
    const c = s.character, r = s.birthReport;
    rows.push({ era, seed, tier: c.parentWealth, parenting: c.parenting, order: r.birthOrder, mAge: r.mother.age, fAge: r.father.age, housing: r.housing, mJob: r.mother.job, fJob: r.father.job, gender: c.gender, name: c.name, birthYear: c.birthYear });
  }
}
fs.writeFileSync(path.join(OUT, RP + 'seeds.json'), JSON.stringify(rows));
const byEra = {};
for (const r of rows) { const k = `${r.era}-t${r.tier}-o${Math.min(r.order,2)}`; byEra[k] = (byEra[k] ?? 0) + 1; }
console.log(byEra);
