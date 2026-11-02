import { chromium, GAME_KEY, SETTINGS_KEY, settingsEnvelope, BASE } from './qalib.mjs';
import { readFileSync } from 'node:fs';
async function open(browser, vp, state, settings) {
  const ctx = await browser.newContext({ viewport: vp, hasTouch: vp.width < 500 });
  const page = await ctx.newPage();
  const errors = []; page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(BASE + '/'); await page.waitForFunction((k) => localStorage.getItem(k) !== null, GAME_KEY);
  await page.evaluate(([k, v, sk, sv]) => { localStorage.setItem(k, v); localStorage.setItem(sk, sv); }, [GAME_KEY, JSON.stringify(state), SETTINGS_KEY, settingsEnvelope(settings)]);
  for (let i = 0; i < 3; i++) { await page.evaluate((k) => window.dispatchEvent(new StorageEvent('storage', { key: k })), GAME_KEY); try { await page.getByTestId('superseded-screen').waitFor({ state: 'attached', timeout: 1000 }); break; } catch {} }
  await page.goto(BASE + '/?__timescale=100');
  await page.getByTestId('life-screen').waitFor();
  return { ctx, page, errors };
}
const measure = (page) => page.evaluate(() => {
  const vw = document.documentElement.clientWidth;
  const over = document.documentElement.scrollWidth - vw;
  const card = document.querySelector('[data-testid="family-scene"]');
  const offenders = [...card.querySelectorAll('*')].filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && (r.right > vw + 0.5 || r.left < -0.5); }).map((e) => e.tagName + '.' + (e.className?.baseVal ?? e.className)).slice(0, 4);
  const clipped = [...card.querySelectorAll('p, span, button, summary, time')].filter((e) => e.scrollWidth > e.clientWidth + 1 && getComputedStyle(e).overflow !== 'visible').map((e) => e.className).slice(0, 4);
  const line = document.querySelector('[data-testid="scene-line"]');
  const lb = line.getBoundingClientRect();
  const era = document.querySelector('#scene-era').getBoundingClientRect();
  const img = document.querySelector('[data-testid="scene-house"] [role="img"]');
  const name = (img?.getAttribute('aria-labelledby') ?? '').split(' ').map((id) => document.getElementById(id)?.textContent ?? '').join(' | ');
  const btns = [...card.querySelectorAll('button, summary, a')].map((b) => { const r = b.getBoundingClientRect(); return [b.dataset.testid ?? b.tagName, Math.round(r.width), Math.round(r.height)]; });
  return { rootPx: parseFloat(getComputedStyle(document.documentElement).fontSize), over, offenders, clipped, lineH: Math.round(lb.height), lineText: line.textContent, eraBox: [Math.round(era.width), Math.round(era.height)], name, btns };
});
const b = await chromium.launch();
const longline = JSON.parse(readFileSync('qa/scripts/009/states/longline.json', 'utf8'));
longline.data.paused = true;
for (const vp of [{ width: 360, height: 740 }, { width: 320, height: 568 }, { width: 1280, height: 800 }]) {
  for (const pct of [100, 200]) {
    const { ctx, page, errors } = await open(b, vp, longline, { speed: 1, autoMode: false, noteCards: false });
    await page.waitForSelector('[data-testid="family-scene"][data-scene-art="ready"]');
    await page.evaluate((p) => { document.documentElement.style.fontSize = p + '%'; }, pct);
    await page.waitForTimeout(500);
    await page.getByTestId('scene-more').locator('summary').click().catch(() => {});
    await page.waitForTimeout(200);
    const m = await measure(page);
    console.log(`${vp.width}px 글자 ${pct}% (root ${m.rootPx}px): overflow=${m.over} offenders=${JSON.stringify(m.offenders)} clipped=${JSON.stringify(m.clipped)} line높이=${m.lineH} era=${m.eraBox} errors=${errors.length}\n    한 줄: ${m.lineText}\n    낭독: ${m.name}`);
    await ctx.close();
  }
}
await b.close();
