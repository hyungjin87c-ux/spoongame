// 식구 카드에서 보조 줄이 가장 긴 판·「기계 조작직」이 든 판을 찾는다(코어를 브라우저에서 직접 돌린다)
import { chromium, newPage, evalCore, BASE } from './lib.mjs';
import { writeFileSync, mkdirSync } from 'node:fs';
const { browser, page } = await newPage(chromium);
await page.goto(BASE + '/');
const out = await evalCore(page, `
  const found = [];
  for (const gen of arg.gens) {
    for (let seed = arg.from; seed < arg.from + arg.seeds; seed++) {
      let s = core.enterLife(core.enterBirth(core.beginBirth(core.createInitialState(seed), gen)));
      while (s.phase === 'life' && s.age < 45) {
        if (s.pending !== null) s = core.resolveChoiceStep(s, s.pending.key, s.pending.choiceIds[0]).state;
        else s = core.stepYear(s).state;
      }
      if (s.phase !== 'life' || s.pending !== null) continue;
      const flags = [...new Set([...s.flags, 'married', 'has_child', 'close_friend', 'cared_parents'])].sort();
      const cand = { ...s, flags, paused: true };
      const card = core.familyCardOf(cand);
      for (const r of [...card.together, ...card.apart, ...card.adult, ...card.friends]) {
        const items = [r.closenessText, r.jobText, r.statusText, r.state === 'apart' && r.role !== 'friend' ? '따로 삶' : null].filter((x) => x !== null);
        const len = (r.name + ' ' + r.age + '세').length + items.join(' · ').length;
        found.push({ gen, seed, role: r.role, name: r.name, age: r.age, items, len, machine: items.join('').includes('기계 조작직') });
      }
    }
  }
  return found;
`, { gens: ['alpha', 'millennial', 'genx', 'g86', 'industrial'], from: 1, seeds: 60 });
out.sort((a, b) => b.len - a.len);
console.log('rows', out.length);
console.log('top 12:'); for (const r of out.slice(0, 12)) console.log(r.len, r.gen, r.seed, r.role, r.name, r.age, r.items.join(' · '));
const m = out.filter((r) => r.machine).sort((a, b) => b.len - a.len);
console.log('machine rows', m.length); for (const r of m.slice(0, 8)) console.log(r.len, r.gen, r.seed, r.role, r.name, r.age, r.items.join(' · '));
mkdirSync('qa/scripts/010/states', { recursive: true });
writeFileSync('qa/scripts/010/states/rows.json', JSON.stringify(out.slice(0, 40).concat(m.slice(0, 20)), null, 1));
await browser.close();
