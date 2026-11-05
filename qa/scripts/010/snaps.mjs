// 알파 2016년생 재력 W의 진짜 인생(코어를 그대로 걷는다)에서 나이별 멈춘 상태(스냅숏)를 뽑는다 → qa/scripts/010/states/snaps-W<재력>.json (커밋하지 않는다)
import { chromium, newPage, evalCore, birthState, BASE } from './lib.mjs';
import { writeFileSync, mkdirSync } from 'node:fs';
mkdirSync('qa/scripts/010/states', { recursive: true });
const AGES = [9, 10, 14, 28, 34, 49, 59, 69, 79, 84, 92, 93, 94, 95, 96];
const { browser, page } = await newPage(chromium);
await page.goto(BASE + '/');
for (const W of (process.env.WS ?? '1,3,5').split(',').map(Number)) {
  const seedStart = Number(process.argv[2] ?? 1);
  const res = await evalCore(page, `
    let best = null;
    for (let seed = arg.from; seed < arg.from + 600; seed++) {
      const bs = { ...arg.bs, seed, rngState: seed + 1 };
      let s = core.enterLife(core.enterBirth(bs));
      const snaps = {}; let maxAge = 0;
      while (s.phase === 'life') {
        if (s.pending !== null) { s = core.resolveChoiceStep(s, s.pending.key, s.pending.choiceIds[0]).state; continue; }
        if (arg.ages.includes(s.age) && snaps[s.age] === undefined) snaps[s.age] = { ...s, paused: true };
        maxAge = Math.max(maxAge, s.age);
        s = core.stepYear(s).state;
      }
      if (best === null || maxAge > best.maxAge) best = { seed, maxAge, snaps };
      if (maxAge >= 96) break;
    }
    return best;`, { from: seedStart, ages: AGES, bs: birthState({ seed: 1, generation: 'alpha', wealth: W, birthYear: 2016, phase: 'roulette' }) });
  console.log('W' + W, 'seed', res.seed, 'maxAge', res.maxAge, 'snap ages', Object.keys(res.snaps).join(','));
  writeFileSync(`qa/scripts/010/states/snaps-W${W}.json`, JSON.stringify(res));
}
await browser.close();
