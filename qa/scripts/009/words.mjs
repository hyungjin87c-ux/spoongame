import { chromium, GAME_KEY, SETTINGS_KEY, settingsEnvelope, BASE } from './qalib.mjs';
import { readFileSync } from 'node:fs';
const b = await chromium.launch();
const out = [];
for (const vp of [{ width: 320, height: 568 }, { width: 360, height: 740 }]) {
  const ctx = await b.newContext({ viewport: vp, hasTouch: true });
  const page = await ctx.newPage();
  const errors = []; page.on('pageerror', (e) => errors.push(e.message));
  for (let w = 0; w < 9; w++) {
    const st = JSON.parse(readFileSync(`qa/scripts/009/states/word-${w}.json`, 'utf8')); st.data.paused = true;
    await page.goto(BASE + '/'); await page.waitForFunction((k) => localStorage.getItem(k) !== null, GAME_KEY);
    await page.evaluate(([k, v, sk, sv]) => { localStorage.setItem(k, v); localStorage.setItem(sk, sv); }, [GAME_KEY, JSON.stringify(st), SETTINGS_KEY, settingsEnvelope({ speed: 1, autoMode: false, noteCards: false })]);
    for (let i = 0; i < 3; i++) { await page.evaluate((k) => window.dispatchEvent(new StorageEvent('storage', { key: k })), GAME_KEY); try { await page.getByTestId('superseded-screen').waitFor({ state: 'attached', timeout: 1000 }); break; } catch {} }
    await page.goto(BASE + '/?__timescale=100');
    await page.getByTestId('life-screen').waitFor();
    await page.waitForSelector('[data-testid="family-scene"][data-scene-art="ready"]', { timeout: 15000 });
    for (const pct of [100, 150, 200]) {
      await page.evaluate((p) => { document.documentElement.style.fontSize = p + '%'; }, pct);
      await page.waitForTimeout(250);
      const m = await page.evaluate(() => {
        const vw = document.documentElement.clientWidth;
        const card = document.querySelector('[data-testid="family-scene"]');
        const bad = [...card.querySelectorAll('*')].filter((e) => !e.classList.contains('fit-pair__probe') && !e.classList.contains('sr-only')).filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && (r.right > vw + 0.5 || r.left < -0.5); }).map((e) => e.tagName + '.' + (e.className?.baseVal ?? e.className));
        return { over: document.documentElement.scrollWidth - vw, bad, line: document.querySelector('[data-testid="scene-line"]').innerText.replace(/\n/g, ' / ') };
      });
      if (m.over > 0 || m.bad.length) out.push(`!! ${vp.width}px ${pct}% word-${w}: overflow ${m.over} ${m.bad.join(',')} | ${m.line}`);
      if (pct === 200) out.push(`${vp.width}px 200% ${m.line}`);
    }
  }
  out.push(`  (${vp.width}px errors ${errors.length})`);
  await ctx.close();
}
console.log(out.join('\n'));
await b.close();
