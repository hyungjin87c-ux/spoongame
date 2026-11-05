import { chromium, newPage, evalCore, BASE } from './lib.mjs';
import { writeFileSync } from 'node:fs';
const { browser, page } = await newPage(chromium);
await page.goto(BASE + '/');
const out = await evalCore(page, `
  let best = null;
  for (const gen of ['industrial', 'boomer']) for (let seed = 1; seed <= 1500; seed++) {
    let s = core.enterLife(core.enterBirth(core.beginBirth(core.createInitialState(seed), gen)));
    while (s.phase === 'life' && s.age < 14) {
      if (s.pending !== null) { s = core.resolveChoiceStep(s, s.pending.key, s.pending.choiceIds[0]).state; continue; }
      if (s.age >= 4) {
        const c = { ...s, paused: true };
        let v; try { v = core.familyViewOf(c); } catch { v = null; }
        if (v) { const withN = v.people.filter((p) => p.state === 'with').length; const sib = v.people.filter((p) => p.role === 'sibling' && p.state !== 'gone').length; const gp = v.people.filter((p) => p.role === 'grandparent' && p.state === 'with').length; const score = withN * 10 + sib; if (best === null || score > best.score) best = { score, withN, sib, gp, gen, seed, age: s.age, state: c }; }
      }
      s = core.stepYear(s).state;
    }
  }
  return best;`);
console.log('best', out.gen, out.seed, 'age', out.age, '함께 사는', out.withN, '형제(살아있는)', out.sib, '조부모 함께', out.gp);
writeFileSync('qa/scripts/010/states/big-child.json', JSON.stringify(out.state));
await browser.close();
