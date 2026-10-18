// QA-003 M7a 증거 스크린샷: 감사 상태(저장)를 prod 화면에 열어 케이스별 대표 장면을 찍는다.
// 사용: node qa/scripts/m7a-shots.mjs
import fs from 'node:fs';
import path from 'node:path';
import { launch, mkctx, sleep, OUT, PROD, GAME_KEY, SETTINGS_KEY, setRootFont, SHOT_DIR, TOUCH } from './m7a-lib.mjs';
import { RP, SHOT_PREFIX } from './m7a-lib.mjs';

const SAVES = path.join(OUT, RP + 'saves');
const SETTINGS = (theme = 'system') => JSON.stringify({ version: 3, data: { speed: 8, autoMode: false, era: 'present', lifeLength: 'short30', bgm: { on: false, volume: 30 }, theme } });
const browser = await launch();
const out = [];
async function open(state, { w, h, font = 100, touch = false, theme = 'system', ctxOpts = {} }) {
  const ctx = await mkctx(browser, { viewport: { width: w, height: h }, ...(touch ? TOUCH : {}), ...ctxOpts });
  const raw = fs.readFileSync(path.join(SAVES, `${state}.json`), 'utf8');
  await ctx.addInitScript(([k, v, sk, sv]) => { try { if (!sessionStorage.getItem('s')) { localStorage.clear(); localStorage.setItem(k, v); localStorage.setItem(sk, sv); sessionStorage.setItem('s', '1'); } } catch {} }, [GAME_KEY, raw, SETTINGS_KEY, SETTINGS(theme)]);
  const page = await ctx.newPage();
  await page.goto(PROD, { waitUntil: 'load' });
  await page.waitForSelector('[data-testid="life-screen"], [data-testid="ending-screen"]', { timeout: 15000 });
  if (state.startsWith('card-')) {
    await page.waitForSelector('[data-testid="choice-panel"]', { timeout: 30000 });
    await page.waitForFunction(() => [...document.querySelectorAll('[data-testid="choice-panel"] .choice')].every((b) => b.getAttribute('aria-disabled') !== 'true'), null, { timeout: 8000 }).catch(() => {});
  }
  await sleep(500);
  if (font !== 100) await setRootFont(page, font);
  await sleep(300);
  return { ctx, page };
}
const snap = async (page, name) => {
  const f = `${SHOT_PREFIX}-${name}.png`;
  await page.screenshot({ path: path.join(SHOT_DIR, f) });
  out.push(`qa/screenshots/003/${f}`);
};
const logTo = async (page, where) => {
  await page.evaluate((wh) => {
    const card = document.querySelector('[data-testid="log"]');
    card.scrollIntoView({ block: 'start', behavior: 'instant' });
    const list = document.querySelector('[data-testid="log-list"]');
    list.scrollTo({ top: wh === 'top' ? 0 : list.scrollHeight, behavior: 'instant' });
  }, where);
  await sleep(300);
};
const entryTo = async (page, sel = '[data-testid="ending-timeline"]') => {
  await page.evaluate((s) => document.querySelector(s).scrollIntoView({ block: 'start', behavior: 'instant' }), sel);
  await sleep(300);
};

// N02 인생 기록 한 해 두 줄
for (const [name, w, h, font, touch] of [['m360', 360, 740, 100, true], ['d1280', 1280, 800, 100, false], ['m320-200', 320, 568, 200, false]]) {
  const { ctx, page } = await open('log2', { w, h, font, touch });
  await logTo(page, 'top');
  await snap(page, `N02-log-two-lines-top-${name}`);
  await logTo(page, 'bottom');
  await snap(page, `N02-log-two-lines-bottom-${name}`);
  await ctx.close();
}
// N03 엔딩 연표(영유아 줄)·출발선 문장
for (const [name, w, h, font, touch] of [['m360', 360, 740, 100, true], ['m320-200', 320, 568, 200, false]]) {
  const { ctx, page } = await open('ending-long', { w, h, font, touch });
  await entryTo(page);
  await snap(page, `N03-ending-timeline-infant-${name}`);
  await entryTo(page, '[data-testid="ending-journey-section"]');
  await snap(page, `N03-ending-journey-${name}`);
  await ctx.close();
}
for (const era of ['past', 'present', 'future']) {
  for (const tier of [1, 3, 5]) {
    const { ctx, page } = await open(`ending-${era}-t${tier}`, { w: 320, h: 568, font: 200 });
    await entryTo(page, '[data-testid="ending-journey-section"]');
    await snap(page, `L-ending-journey-${era}-t${tier}-m320-200`);
    await ctx.close();
  }
}
// L 결정 카드(가장 긴 문장)
for (const [st, w, h, font, name] of [['card-infant-parental-leave', 320, 568, 200, 'parental-leave-m320-200'], ['card-infant-early-lessons', 320, 568, 200, 'early-lessons-m320-200'], ['card-infant-daycare-wait', 360, 740, 150, 'daycare-wait-m360-150'], ['card-school-after-hours', 320, 568, 150, 'after-hours-m320-150'], ['card-infant-hospital-stay', 375, 812, 200, 'hospital-stay-m375-200']]) {
  const { ctx, page } = await open(st, { w, h, font, touch: w < 400 });
  await page.evaluate(() => document.querySelector('[data-testid="choice-panel"]').scrollIntoView({ block: 'start', behavior: 'instant' }));
  await sleep(250);
  await snap(page, `L-card-${name}`);
  await ctx.close();
}
// K 색 대비: 다크·강제 색상
for (const [mode, ctxOpts, theme] of [['dark', { colorScheme: 'dark' }, 'system'], ['forced', { forcedColors: 'active', colorScheme: 'light' }, 'system']]) {
  for (const st of ['card-infant-kindergarten', 'log2', 'ending-long']) {
    const { ctx, page } = await open(st, { w: 360, h: 740, touch: true, theme, ctxOpts });
    if (st === 'log2') await logTo(page, 'top');
    else if (st === 'ending-long') await entryTo(page);
    else await page.evaluate(() => document.querySelector('[data-testid="choice-panel"]').scrollIntoView({ block: 'start', behavior: 'instant' }));
    await sleep(250);
    await snap(page, `K01-${mode}-${st}`);
    await ctx.close();
  }
}
fs.writeFileSync(path.join(OUT, RP + 'shots-list.json'), JSON.stringify(out, null, 1));
console.log(out.length, '장');
await browser.close();
