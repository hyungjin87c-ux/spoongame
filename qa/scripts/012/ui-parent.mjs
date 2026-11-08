// DS1·DS2: 한 분과 사는 해(별세·이혼)와 두 분인 해의 부모 결정 카드 칩·도장·안내·기록 줄 — 코어로 찾은 해를 주입해 실제 화면을 읽는다
import { chromium, newPage, evalCore, inject, BASE, SHOT } from './lib.mjs';
const { browser, page, errors } = await newPage(chromium, { width: 1280, height: 800 });
await page.goto(BASE + '/');
const cases = [['both', 'any'], ['mother', 'death'], ['father', 'death'], ['mother', 'divorce'], ['father', 'divorce']];
const results = [];
for (const [subject, why] of cases) {
  const found = await evalCore(page, `
    for (let seed = 1; seed < 9000; seed++) {
      let s = core.enterLife(core.enterBirth(core.beginBirth(core.createInitialState(seed), arg.era)));
      for (let g = 0; g < 80 && s.phase === 'life' && s.age <= 19; g++) {
        if (s.pending !== null) { s = core.autoResolveStep(s, s.pending.key).state; continue; }
        let cap = null;
        const r = core.stepYear(s, undefined, (e) => { cap = e; });
        if (cap !== null && r.tick.kind === 'resolved' && r.state.phase === 'life' && r.tick.by === 'parent' && r.tick.fromAge >= (arg.subject === 'both' ? 1 : 4)) {
          const sub = core.coParentsOf(s, r.tick.fromAge);
          const sched = core.familyScheduleOf(s);
          const reason = sched.divorce !== null && ((sched.divorce.leaver === 0 && sub === 'father') || (sched.divorce.leaver === 1 && sub === 'mother')) && sched.divorce.at < r.tick.fromAge ? 'divorce' : (sched.firstGone !== null && sched.firstGone.at < r.tick.fromAge ? 'death' : 'any');
          if (sub === arg.subject && (arg.why === 'any' || reason === arg.why) && !(arg.subject === 'both' && sched.divorce === null && sched.firstGone === null && false)) return { seed, start: s, age: r.tick.fromAge, eventId: r.tick.eventId };
        }
        s = r.state;
      }
    }
    return null;`, { era: 'alpha', subject, why });
  if (!found) { results.push({ subject, why, found: false }); continue; }
  const st = { ...found.start }; delete st.play;
  st.history = st.history.filter((h) => h.by !== 'parent');
  await inject(page, st, { speed: 8, autoMode: false, noteCards: false }, '/?__timescale=8');
  await page.getByTestId('parent-card').waitFor({ state: 'visible', timeout: 40000 });
  await page.getByTestId('pause').click();
  const r = await page.evaluate(() => ({
    chip: document.querySelector('[data-testid=parent-chip]')?.textContent.trim(),
    stamp: document.querySelector('[data-testid=parent-stamp]')?.textContent.trim(),
    hint: document.querySelector('[data-testid=parent-hint]')?.textContent.trim() ?? null,
    log: [...document.querySelectorAll('[data-testid=log-by][data-by=parent]')].map((e) => e.textContent.trim()),
    bodyHasBoth: /부모님이 이렇게|부모님의 결정/.test(document.querySelector('[data-testid=parent-card]').innerText),
  }));
  results.push({ subject, why, seed: found.seed, age: found.age, ...r });
}
console.log(JSON.stringify(results, null, 1));
console.log('errors', errors);
await browser.close();
