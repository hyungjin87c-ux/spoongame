import { chromium, newPage, evalCore, BASE } from './lib.mjs';
import { writeFileSync } from 'node:fs';
const { browser, page } = await newPage(chromium);
await page.goto(BASE + '/');
const out = await evalCore(page, `
  let best = null; const hist = {};
  for (const gen of ['industrial', 'boomer']) for (let seed = 1; seed <= 3000; seed++) {
    let s = core.enterLife(core.enterBirth(core.beginBirth(core.createInitialState(seed), gen)));
    while (s.phase === 'life') {
      if (s.pending !== null) { s = core.resolveChoiceStep(s, s.pending.key, s.pending.choiceIds[0]).state; continue; }
      if (s.age >= 70) {
        const flags = [...new Set([...s.flags, 'married', 'has_child', 'close_friend'])].sort();
        const c = { ...s, flags };
        let card; try { card = core.familyCardOf(c); } catch { card = null; }
        if (card) { const g = card.gone.length; hist[g] = (hist[g] ?? 0) + 1; if (best === null || g > best.v) best = { v: g, gen, seed, age: s.age, state: { ...c, paused: true } }; }
      }
      s = core.stepYear(s).state;
    }
  }
  return { best, hist };`);
console.log('hist (떠난 사람 수: 상태 수)', JSON.stringify(out.hist), 'best', out.best.v, out.best.gen, out.best.seed, out.best.age);
writeFileSync('qa/scripts/010/states/big-gone.json', JSON.stringify(out.best.state));
await browser.close();
