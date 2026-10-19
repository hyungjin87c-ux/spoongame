// 탐색: 인생을 끝까지 돌린 저장(phase=ending)의 death 모양을 읽는다 (A12c 저장 만들기용). 사용: QA_OUT=qa/results/m7b/r2 node qa/scripts/m7b-r2-probe-death.mjs
import fs from 'node:fs';
import path from 'node:path';
import { launch, mkctx, DEV, OUT, evalCore } from './m7b-lib.mjs';
const b = await launch();
const ctx = await mkctx(b);
const p = await ctx.newPage();
await p.goto(DEV, { waitUntil: 'load' });
await p.waitForSelector('[data-testid="title-screen"]');
const s = await evalCore(p, `
  let s = core.enterLife(core.enterBirth(core.beginBirth(core.createInitialState(7), 'present')));
  for (let guard = 0; guard < 400 && s.phase === 'life'; guard++) {
    s = core.advanceUntilDecision(s).state;
    if (s.phase !== 'life') break;
    if (s.pending) s = core.resolveChoice(s, s.pending.key, s.pending.choiceIds[0]);
  }
  return s;`);
console.log(s.phase, JSON.stringify(s.death), s.age, Object.keys(s).join(','));
fs.mkdirSync(path.join(OUT, 'states'), { recursive: true });
fs.writeFileSync(path.join(OUT, 'states', 'ended-present.json'), JSON.stringify(s));
await b.close();
