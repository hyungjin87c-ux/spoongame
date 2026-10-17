// QA-003 M5: 추가 증거 스크린샷(D10·E10·O02·O05·O04·O06).
import fs from 'node:fs';
import path from 'node:path';
import { launch, mkctx, seedStorage, DEV, PROD, OUT, GAME_KEY, sleep, setRootFont, editSave, SHOT_DIR, READ_DASH_M5 } from './m5-lib.mjs';
import { loadSave } from './m5-states.mjs';
const crafted = JSON.parse(fs.readFileSync(path.join(OUT, 'craft-saves.json'), 'utf8'));
const browser = await launch();
const out = [];
async function snap(id, raw, { base = `${DEV}?__timescale=60`, vp = { width: 1280, height: 800 }, font = 100, waitPanel = false, scrollTo = null, pause = false } = {}) {
  const ctx = await mkctx(browser, { viewport: vp });
  const page = await ctx.newPage();
  await page.goto(base, { waitUntil: 'load' });
  await page.evaluate(([k, v]) => { localStorage.clear(); localStorage.setItem(k, v); }, [GAME_KEY, raw]);
  await page.reload({ waitUntil: 'load' });
  if (waitPanel) {
    await page.waitForSelector('[data-testid="choice-panel"]', { timeout: 15000 });
    await page.waitForFunction(() => [...document.querySelectorAll('[data-testid="choice-panel"] .choice')].every((b) => b.getAttribute('aria-disabled') !== 'true'));
  } else await page.waitForSelector('[data-testid="life-screen"], [data-testid="ending-screen"]');
  if (font !== 100) await setRootFont(page, font);
  await sleep(300);
  if (scrollTo) { await page.locator(scrollTo).first().scrollIntoViewIfNeeded(); await sleep(200); }
  await page.screenshot({ path: path.join(SHOT_DIR, `M5-${id}.png`) });
  out.push(`M5-${id}.png`);
  await ctx.close();
}
await snap('D10', crafted['return-zero'].raw, { waitPanel: true, scrollTo: '[data-testid="choice-panel"]' });
await snap('E10', editSave(crafted['gig-rent'].raw, (d) => (d.paused = false)), { waitPanel: true, scrollTo: '[data-testid="choice-panel"]' });
await snap('O02', loadSave('present', 'young-choice'), { base: PROD, vp: { width: 360, height: 740 }, waitPanel: true, scrollTo: '.choices-list' });
await snap('O05', editSave(loadSave('present', 'adult-choice'), (d) => (d.character.name = '가나다라마바사아자차카타파하가나다라마바')), { base: PROD, vp: { width: 320, height: 568 }, font: 200, waitPanel: true });
await snap('O04', loadSave('future', 'ending-zero'), { base: PROD, vp: { width: 360, height: 740 }, scrollTo: '[data-testid="final-net"]' });
await snap('O06', loadSave('present', 'young-choice'), { base: PROD, vp: { width: 320, height: 568 }, font: 200, waitPanel: true, scrollTo: '.choices-list' });
await browser.close();
console.log(out.join(' '));
