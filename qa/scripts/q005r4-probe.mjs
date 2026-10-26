// 탐색: 1280×800 수동 모드로 youth-startup 결정 카드(시트)를 열어 DOM 사실을 모은다.
import { launchChromium, VP, Watch, PROD, DEV, sleep, seedPage, DEFAULT_SETTINGS, pendingState, writeJson } from './q005r4-lib.mjs';
const b = await launchChromium();
const devB = await launchChromium();
const dev = await (await devB.newContext({ viewport: { width: 800, height: 600 } })).newPage();
await dev.goto(DEV + '/');
await dev.getByTestId('title-screen').waitFor({ timeout: 90000 });
const st = await pendingState(dev, 'youth-startup');
console.log('state', !!st, st && st.age);
const ctx = await b.newContext({ ...VP.d1280, locale: 'ko-KR' });
const w = new Watch('probe').attach(ctx);
const page = await ctx.newPage();
await seedPage(page, { game: st, settings: { ...DEFAULT_SETTINGS, speed: 1, autoMode: false, noteCards: false, gentle: false } });
await page.goto(PROD + '/');
await page.getByTestId('choice-panel').waitFor({ timeout: 60000 });
await sleep(800);
const facts = await page.evaluate(() => {
  const q = (s) => document.querySelector(s);
  const ins = q('.cite__insight-text');
  const cs = ins ? getComputedStyle(ins) : null;
  const ask = q('[data-testid="choice-ask"]');
  return {
    sheetText: q('[data-testid="choice-panel"]').innerText,
    ask: ask?.innerText,
    askBox: ask?.getBoundingClientRect().toJSON(),
    firstChoice: q('.choice')?.getBoundingClientRect().toJSON(),
    insightHtml: q('[data-testid="cite-insight"]')?.innerHTML,
    insightColor: cs?.color, insightWeight: cs?.fontWeight, citeSummaryColor: q('.cite')?.querySelector('p, .cite__summary') && getComputedStyle(q('.cite')?.querySelector('p')).color,
    bodyHas풀이: document.body.innerText.includes('풀이'),
    srPrefix: q('[data-testid="cite-insight"] .sr-only')?.textContent,
    foldBtn: q('[data-testid="decision-fold-btn"]')?.innerText,
    autoBtn: q('[data-testid="auto-on-btn"]')?.innerText,
    autoSub: q('[data-testid="auto-sub"]')?.innerText,
  };
});
console.log(JSON.stringify(facts, null, 1));
await page.screenshot({ path: process.env.TEMP + '/probe-sheet.png' });
console.log(w.take());
await b.close(); await devB.close();
