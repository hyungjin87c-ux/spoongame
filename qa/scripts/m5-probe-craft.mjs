// QA-003 M5: 「선택 직후 상태」에서 한 해를 더 살면(사건 없는 조용한 해) 순자산이 얼마나 변하는가 = 그 상태의 연 현금흐름(CF')을 화면에서 재기 위한 저장을 만든다.
// 선택 직후 저장(samples-match.jsonl의 post.raw)에서 선택지 대기를 풀고, 선택지가 못 나오게 하고(lastChoiceAge = 나이), 사건이 없는 난수 상태를 찾아 samples-probe-in.jsonl에 쓴다.
// 난수 상태를 찾는 데만 앱 core(stepYear)를 쓰고, 연 현금흐름의 측정은 m5-impact-probe.mjs가 실제 화면에서 한다. 실행: ./node_modules/.bin/vite-node qa/scripts/m5-probe-craft.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { stepYear } from '../../src/core/life';
import { parseGame } from '../../src/core/storage';
import { EVENT_POOL } from '../../src/data/events';

const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'results', 'm5');
const SUF = process.env.VARIANT === 'rich' ? '-rich' : '';
const rows = fs.readFileSync(path.join(OUT, `samples-match${SUF}.jsonl`), 'utf8').trim().split('\n').map((l) => JSON.parse(l)).filter((r) => !r.err && r.post);
const out = [];
let n = 0;
let miss = 0;
for (const r of rows) {
  const d = JSON.parse(r.post.raw).data;
  if (d.phase !== 'life' || d.assets === null) continue;
  d.pending = null;
  d.paused = false;
  d.lastChoiceAge = d.age;
  let found = null;
  for (let k = 1; k <= 3000; k++) {
    d.rngState = Math.imul(k, 2246822519) >>> 0;
    const raw = JSON.stringify({ version: 8, data: d });
    const g = parseGame(raw, EVENT_POOL);
    if (!g) break;
    const res = stepYear(g, EVENT_POOL);
    if (res.tick.kind === 'quiet') {
      found = raw;
      break;
    }
  }
  if (found) {
    out.push({ fixtureKey: r.fixtureKey, choiceId: r.choiceId, probeRaw: found });
    n++;
  } else miss++;
}
fs.writeFileSync(path.join(OUT, `samples-probe-in${SUF}.jsonl`), out.map((o) => JSON.stringify(o)).join('\n') + '\n');
console.log('probe 저장', n, '실패', miss);
