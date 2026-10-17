// QA-003 M5: 화면 스크린샷이 따로 없는 케이스(측정·집계형)의 대표 장면을 qa/screenshots/003/M5-<케이스ID>.png 로 남긴다.
import fs from 'node:fs';
import path from 'node:path';
import { launch, mkctx, PROD, DEV, GAME_KEY, SETTINGS_KEY, sleep, setRootFont, editSave, SHOT_DIR, OUT } from './m5-lib.mjs';
import { loadSave } from './m5-states.mjs';

const crafted = JSON.parse(fs.readFileSync(path.join(OUT, 'craft-saves.json'), 'utf8'));
const browser = await launch();
const out = [];
async function snap(id, raw, { vp = { width: 360, height: 740 }, font = 100, base = PROD, full = false, scrollTo = null, focus = null, touch = false, settings = null } = {}) {
  const ctx = await mkctx(browser, { viewport: vp, ...(touch ? { hasTouch: true, isMobile: true, deviceScaleFactor: 2 } : {}) });
  const page = await ctx.newPage();
  await page.goto(base, { waitUntil: 'load' });
  await page.evaluate(([k, v, sk, sv]) => {
    localStorage.clear();
    localStorage.setItem(k, v);
    if (sv) localStorage.setItem(sk, sv);
  }, [GAME_KEY, raw, SETTINGS_KEY, settings]);
  await page.reload({ waitUntil: 'load' });
  await page.waitForSelector('[data-testid="life-screen"], [data-testid="ending-screen"]', { timeout: 15000 });
  const hasPanel = await page.locator('[data-testid="choice-panel"]').count();
  if (hasPanel) await page.waitForFunction(() => [...document.querySelectorAll('[data-testid="choice-panel"] .choice')].every((b) => b.getAttribute('aria-disabled') !== 'true'), null, { timeout: 8000 });
  if (font !== 100) await setRootFont(page, font);
  await sleep(300);
  if (focus) {
    await page.locator(focus).first().focus();
    await sleep(200);
  }
  if (scrollTo) {
    await page.locator(scrollTo).scrollIntoViewIfNeeded();
    await sleep(200);
  }
  const file = `M5-${id}.png`;
  await page.screenshot({ path: path.join(SHOT_DIR, file), fullPage: full });
  out.push(`qa/screenshots/003/${file}`);
  await ctx.close();
}
const ADULT = loadSave('present', 'adult-choice');
const YOUNG = loadSave('present', 'young-choice');
const ADULT_DASH = loadSave('past', 'adult-dash');
await snap('E01', ADULT, { scrollTo: '[data-testid="choice-panel"]' });
await snap('E02', YOUNG, { scrollTo: '[data-testid="choice-panel"]' });
await snap('E03', crafted['guarantee-small'].raw, { base: `${DEV}?__timescale=1`, scrollTo: '[data-testid="choice-panel"]' });
await snap('E04', crafted['marriage-neg'].raw, { base: `${DEV}?__timescale=1`, scrollTo: '[data-testid="choice-panel"]' });
await snap('E06', crafted['guarantee-neg'].raw, { base: `${DEV}?__timescale=1`, scrollTo: '[data-testid="assets-card"]' });
await snap('E07', ADULT_DASH, { scrollTo: '[data-testid="assets-card"]' });
await snap('E08', ADULT, { vp: { width: 1280, height: 800 } });
await snap('N06', loadSave('future', 'adult-dash'), { scrollTo: '[data-testid="assets-card"]' });
await snap('B10', ADULT_DASH, { vp: { width: 1280, height: 800 } });
await snap('A02', ADULT, { touch: true, scrollTo: '[data-testid="choice-panel"]' });
await snap('A04', ADULT, { vp: { width: 1280, height: 800 } });
await snap('X02', ADULT_DASH, { vp: { width: 1280, height: 800 } });
for (const id of ['L01', 'L02', 'L03a', 'L03b', 'L04', 'L05']) await snap(id, loadSave('present', 'extreme-big'), { vp: { width: 320, height: 568 }, font: 200, scrollTo: '[data-testid="assets-card"]' });
await snap('L06', ADULT, { vp: { width: 320, height: 568 }, font: 200, scrollTo: '.choices-list' });
await snap('L03-present', loadSave('present', 'ending-neg'), { vp: { width: 320, height: 568 }, font: 200, scrollTo: '[data-testid="final-net"]' });
await snap('L03-past', loadSave('past', 'ending'), { vp: { width: 320, height: 568 }, font: 200, scrollTo: '[data-testid="final-net"]' });
await snap('L03-future', loadSave('future', 'ending-early'), { vp: { width: 320, height: 568 }, font: 200, scrollTo: '[data-testid="final-net"]' });
await snap('C10f', YOUNG, { vp: { width: 360, height: 568 }, font: 200, focus: '[data-testid="choice-many"]' });
await snap('C20', ADULT, { focus: '[data-testid="choice-panel"] .choice', scrollTo: '[data-testid="choice-panel"]' });
await snap('C21', ADULT, { scrollTo: '[data-testid="choice-hint"]' });
await snap('C22', loadSave('past', 'adult-dash'), { scrollTo: '[data-testid="assets-card"]' });
await snap('C23', loadSave('future', 'ending'), { scrollTo: '[data-testid="final-net"]' });
await snap('A09', ADULT, { vp: { width: 1280, height: 800 } });
await snap('A04b', ADULT, { vp: { width: 1280, height: 800 } });
await browser.close();
console.log(out.length, 'shots');
