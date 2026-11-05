import { chromium, webkit, newPage, evalCore, inject, settle, BASE } from './lib.mjs';
const engine = process.argv[2] === 'webkit' ? webkit : chromium;
const { browser, page } = await newPage(engine, { width: 360, height: 740 });
await page.goto(BASE + '/');
const state = await evalCore(page, `
  let s = core.enterLife(core.enterBirth(core.beginBirth(core.createInitialState(55), 'millennial')));
  while (s.phase === 'life' && s.age < 45) { if (s.pending !== null) s = core.resolveChoiceStep(s, s.pending.key, s.pending.choiceIds[0]).state; else s = core.stepYear(s).state; }
  const flags = [...new Set([...s.flags, 'married', 'has_child', 'close_friend', 'cared_parents'])].sort();
  return { ...s, flags, paused: true };`);
await inject(page, state, { speed: 1, autoMode: false, noteCards: false }, '/');
await page.getByTestId('family-card').waitFor();
if ((await page.getByTestId('family-more').count()) > 0) await page.getByTestId('family-more').click();
await page.addStyleTag({ content: 'html { font-size: 150% !important; } [data-testid="family-card"] { width: 220.5px !important; max-width: 220.5px !important; box-sizing: border-box; }' });
await settle(page, 300);
const row = page.locator('[data-testid="family-card"] dd[data-testid^="family-"]').filter({ hasText: '김상훈' }).first();
console.log(await row.innerText().then((t) => JSON.stringify(t)));
await row.scrollIntoViewIfNeeded();
const box = await row.boundingBox();
await page.screenshot({ path: process.argv[3] ?? 'qa/screenshots/SPEC-010/F-R591-stray-dot.png', clip: { x: Math.max(0, box.x - 90), y: Math.max(0, box.y - 20), width: 330, height: box.height + 40 } });
await browser.close();
