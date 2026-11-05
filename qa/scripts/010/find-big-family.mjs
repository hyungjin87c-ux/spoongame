// 떠난 사람 많은 판 · 형제 많은 산업화 판을 코어에서 찾아 states/big-*.json 로 남긴다
import { chromium, newPage, evalCore, BASE } from './lib.mjs';
import { writeFileSync, mkdirSync } from 'node:fs';
mkdirSync('qa/scripts/010/states', { recursive: true });
const { browser, page } = await newPage(chromium);
await page.goto(BASE + '/');
const out = await evalCore(page, `
  const best = { gone: null, sib: null, both: null };
  const rec = (k, v, s, extra) => { if (best[k] === null || v > best[k].v) best[k] = { v, seed: extra.seed, gen: extra.gen, age: s.age, state: { ...s, paused: true } }; };
  for (const gen of ['industrial', 'boomer']) for (let seed = 1; seed <= 500; seed++) {
    let s = core.enterLife(core.enterBirth(core.beginBirth(core.createInitialState(seed), gen)));
    let goneBest = null;
    while (s.phase === 'life') {
      if (s.pending !== null) { s = core.resolveChoiceStep(s, s.pending.key, s.pending.choiceIds[0]).state; continue; }
      if (s.age >= 55 && s.age % 5 === 0) {
        const flags = [...new Set([...s.flags, 'married', 'has_child', 'close_friend'])].sort();
        const c = { ...s, flags };
        let card; try { card = core.familyCardOf(c); } catch { card = null; }
        if (card) {
          const gone = card.gone.length, living = card.together.length + card.apart.length + card.adult.length + card.friends.length;
          const sib = [...card.together, ...card.apart].filter((r) => r.role === 'sibling').length;
          rec('gone', gone, c, { seed, gen }); rec('sib', sib, c, { seed, gen });
          rec('both', Math.min(gone, 9) * 100 + living, c, { seed, gen });
        }
      }
      s = core.stepYear(s).state;
    }
  }
  return best;`);
for (const k of Object.keys(out)) { const b = out[k]; console.log(k, 'v', b.v, b.gen, 'seed', b.seed, 'age', b.age); writeFileSync(`qa/scripts/010/states/big-${k}.json`, JSON.stringify(b.state)); }
await browser.close();
