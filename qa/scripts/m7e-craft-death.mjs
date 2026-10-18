// QA-003 M7e: 영유아 때 사망하는 엔딩 저장 만들기 (vite-node: ./node_modules/.bin/vite-node qa/scripts/m7e-craft-death.mjs)
// 건강을 낮춘 0·1세 저장에서 코어로 한 해를 돌려 사망하는 난수 상태를 찾는다. 마일스톤과 사망이 같은 해에 일어나는 저장(두 줄 + 사망 줄)도 찾는다. 화면은 prod에서 따로 본다.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { stepYear, resolveChoiceStep } from '../../src/core/life';
import { parseGame } from '../../src/core/storage';
import { EVENT_POOL } from '../../src/data/events';
import { createInitialState, beginBirth, enterBirth, enterLife } from '../../src/core/state';
const RP = process.env.QA_RP || '';

const OUT = process.env.QA_OUT ? path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', process.env.QA_OUT) : path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'results', 'm7e');
fs.mkdirSync(OUT, { recursive: true });
const SAVES = path.join(OUT, 'saves');
fs.mkdirSync(SAVES, { recursive: true });
let found = 0;
for (const era of ['past', 'present', 'future']) {
  for (const age of [0, 1]) {
    const s0 = enterLife(enterBirth(beginBirth(createInitialState(11), era)));
    const d = structuredClone(s0);
    d.age = age;
    d.stats.health = 1;
    d.history = [d.history[0]];
    d.seen = {};
    d.paused = false;
    for (let k = 1; k <= 40000 && found < 99; k++) {
      d.rngState = Math.imul(k, 2654435761) >>> 0;
      const raw = JSON.stringify({ version: 8, data: d });
      let g = parseGame(raw, EVENT_POOL);
      if (!g) break;
      let r = stepYear(g, EVENT_POOL);
      // 선택지가 뜨면 첫 선택지로 이어 간다
      if (r.state.pending) r = { ...r, state: resolveChoiceStep(r.state, r.state.pending.key, r.state.pending.choiceIds[0]).state };
      if (r.state.phase === 'ending') {
        const twoLines = r.state.history.filter((h) => h.age === age && h.kind !== 'stage').length;
        const name = `ending-infant-death-${era}-age${age}-${twoLines >= 2 ? 'two' : 'one'}`;
        const out = JSON.stringify({ version: 8, data: r.state });
        if (!parseGame(out, EVENT_POOL)) { console.log('검증 실패', name); continue; }
        if (fs.existsSync(path.join(SAVES, `${name}.json`))) continue;
        fs.writeFileSync(path.join(SAVES, `${name}.json`), out);
        console.log(`${name}: 사망 ${r.state.age}세, 연표 ${r.state.history.length}줄, 줄 ${r.state.history.map((h) => h.kind[0]).join('')}`);
        found++;
        break;
      }
    }
  }
}
console.log('만든 저장', found);
