// M7c 콘텐츠 보충: ④ 「헤어진 뒤에」 변형(broke_up 있고 has_partner·married 없음)의 도달 수를 세 세상 × 2,000판으로 센다 (오라클 = 개발 서버 core).
import { launch, openOracle, evalCore, writeJson } from './m7c-lib.mjs';
const b = await launch();
const { page } = await openOracle(b);
const out = {};
for (const era of ['past', 'present', 'future']) {
  out[era] = await evalCore(
    page,
    `let n = 0, broke = 0, partner = 0, def = 0, anyBrokeUpFlagAt = 0, brokeBeforeCard = 0;
     const examples = [];
     for (let seed = 1; seed <= arg.n; seed++) {
       let s = core.enterLife(core.enterBirth(core.beginBirth(core.createInitialState(seed), arg.era)));
       let sawBrokeUp = false;
       for (let g = 0; g < 900 && s.phase === 'life'; g++) {
         if (s.pending !== null) { s = core.resolveChoice(s, s.pending.key, s.pending.choiceIds[(seed + g) % s.pending.choiceIds.length]); continue; }
         if (s.flags.includes('broke_up')) sawBrokeUp = true;
         const r = core.advanceUntilDecision(s, undefined, 'stop');
         s = r.state;
         if (r.stoppedForNote) {
           const c = r.stoppedForNote;
           if (c.id === 'note-youth-romance') {
             n++;
             const q = core.noteQuestion(c, s);
             if (q.startsWith('헤어진 뒤에')) { broke++; if (examples.length < 3) examples.push({ seed, age: s.age, flags: s.flags }); }
             else if (q.startsWith('함께하는')) partner++; else def++;
             if (s.flags.includes('broke_up')) brokeBeforeCard++;
           }
           s = core.consumeNote(s, c);
         }
       }
       if (sawBrokeUp) anyBrokeUpFlagAt++;
     }
     return { cards: n, broke, partner, def, livesWithBrokeUpFlag: anyBrokeUpFlagAt, cardWithBrokeUpFlagOn: brokeBeforeCard, examples };`,
    { era, n: 2000 },
  );
  console.log(era, JSON.stringify(out[era]));
}
writeJson('broke-variant.json', out);
await b.close();
