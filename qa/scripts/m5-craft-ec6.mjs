// QA-003 M5 EC6: 자동 모드가 부채 판에서 「연애를 시작한다」를 덜 고르는가를 실제 화면에서 재기 위한 쌍 저장을 만든다.
// 같은 바탕·같은 난수 상태에서 순자산만 다른 두 저장(비부채 +8,000 / 부채 −3,000·부채 3,000)을 만들고, 둘 다 다음 해에 youth-meeting이 나오는 것만 남긴다.
// 실행: ./node_modules/.bin/vite-node qa/scripts/m5-craft-ec6.mjs  → qa/results/m5/samples-ec6-in.jsonl
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { stepYear } from '../../src/core/life';
import { parseGame } from '../../src/core/storage';
import { EVENT_POOL } from '../../src/data/events';

const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'results', 'm5');
const bases = [];
for (const f of fs.readdirSync(OUT).filter((x) => /^samples-fix-.*\.jsonl$/.test(x))) {
  for (const line of fs.readFileSync(path.join(OUT, f), 'utf8').trim().split('\n')) {
    if (!line) continue;
    const run = JSON.parse(line);
    for (const fx of run.fixtures ?? []) {
      const d = JSON.parse(fx.raw).data;
      if (d.age >= 24 && d.age <= 36) bases.push({ era: run.era, seed: run.seed, d });
    }
  }
}
// 바탕을 교육방식·시대·재력이 섞이게 고르기
const picked = [];
const seen = new Set();
for (const b of bases) {
  const k = `${b.era}-${b.d.character.parenting}-${b.d.character.parentWealth}`;
  if (seen.has(k)) continue;
  seen.add(k);
  picked.push(b);
}
console.log('바탕', bases.length, '→ 고른 바탕', picked.length);
const arm = (d, rng, net) => {
  const c = structuredClone(d);
  c.pending = null;
  delete c.seen['youth-meeting'];
  c.lastChoiceAge = null;
  c.paused = false;
  c.flags = c.flags.filter((f) => f !== 'has_partner' && f !== 'married' && f !== 'met_intro');
  c.assets = { net, income: 3000, debt: Math.max(0, -net), incomeAdj: 0, dwelling: 'rent' };
  c.rngState = rng;
  return JSON.stringify({ version: 8, data: c });
};
const out = [];
for (const b of picked) {
  let got = 0;
  for (let k = 1; k <= 8000 && got < 14; k++) {
    const rng = Math.imul(k, 2654435761) >>> 0;
    const A = arm(b.d, rng, 8000);
    const B = arm(b.d, rng, -3000);
    const gA = parseGame(A, EVENT_POOL);
    const gB = parseGame(B, EVENT_POOL);
    if (!gA || !gB) break;
    const rA = stepYear(gA, EVENT_POOL);
    const rB = stepYear(gB, EVENT_POOL);
    if (rA.tick.eventId === 'youth-meeting' && rB.tick.eventId === 'youth-meeting' && rA.tick.kind === 'choice' && rB.tick.kind === 'choice') {
      out.push({ era: b.era, seed: b.seed, parenting: b.d.character.parenting, tier: b.d.character.parentWealth, rng, A, B });
      got++;
    }
  }
}
fs.writeFileSync(path.join(OUT, 'samples-ec6-in.jsonl'), out.map((o) => JSON.stringify(o)).join('\n') + '\n');
console.log('쌍 저장', out.length);
