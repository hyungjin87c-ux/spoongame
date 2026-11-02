import { chromium, GAME_KEY, SETTINGS_KEY, settingsEnvelope, BASE } from './qalib.mjs';
import { readFileSync } from 'node:fs';
const st = JSON.parse(readFileSync('qa/scripts/009/states/fam17-5.json', 'utf8'));
for (const speed of [1, 8]) {
  const b = await chromium.launch();
  const page = await (await b.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
  const errors = []; page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(BASE + '/'); await page.waitForFunction((k) => localStorage.getItem(k) !== null, GAME_KEY);
  await page.evaluate(([k, v, sk, sv]) => { localStorage.setItem(k, v); localStorage.setItem(sk, sv); }, [GAME_KEY, JSON.stringify(st), SETTINGS_KEY, settingsEnvelope({ speed, autoMode: true, noteCards: false })]);
  for (let i = 0; i < 3; i++) { await page.evaluate((k) => window.dispatchEvent(new StorageEvent('storage', { key: k })), GAME_KEY); try { await page.getByTestId('superseded-screen').waitFor({ state: 'attached', timeout: 1000 }); break; } catch {} }
  await page.goto(BASE + '/');
  await page.getByTestId('life-screen').waitFor();
  const times = await page.evaluate(() => new Promise((resolve) => {
    const out = []; let last = null; const t0 = performance.now();
    const age = () => Number(document.querySelector('[data-testid="life-age"]')?.textContent?.match(/\d+/)?.[0] ?? -1);
    const iv = setInterval(() => { const a = age(); if (a !== last) { out.push([a, Math.round(performance.now() - t0)]); last = a; } if (a >= 13 || performance.now() - t0 > 120000) { clearInterval(iv); resolve(out); } }, 25);
  }));
  const dur = [];
  for (let i = 1; i < times.length; i++) dur.push(`${times[i - 1][0]}→${times[i][0]}세 ${((times[i][1] - times[i - 1][1]) / 1000).toFixed(2)}s`);
  console.log(`speed ${speed}배: ${dur.join(' | ')} | errors ${errors.length}`);
  await b.close();
}
