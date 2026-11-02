import { chromium, GAME_KEY, SETTINGS_KEY, settingsEnvelope, BASE } from './qalib.mjs';
import { readFileSync } from 'node:fs';
for (const key of ['predeath-genx', 'predeath-genz', 'predeath-ind']) {
  const st = JSON.parse(readFileSync(`qa/scripts/009/states/${key}.json`, 'utf8'));
  const exp = JSON.parse(readFileSync(`qa/scripts/009/states/${key}.expected.json`, 'utf8'));
  const browser = await chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
  const errors = []; page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(BASE + '/'); await page.waitForFunction((k) => localStorage.getItem(k) !== null, GAME_KEY);
  await page.evaluate(([k, v, sk, sv]) => { localStorage.setItem(k, v); localStorage.setItem(sk, sv); }, [GAME_KEY, JSON.stringify(st), SETTINGS_KEY, settingsEnvelope({ speed: 2, autoMode: true, noteCards: false })]);
  for (let i = 0; i < 3; i++) { await page.evaluate((k) => window.dispatchEvent(new StorageEvent('storage', { key: k })), GAME_KEY); try { await page.getByTestId('superseded-screen').waitFor({ state: 'attached', timeout: 1000 }); break; } catch {} }
  await page.goto(BASE + '/?__timescale=3');
  const phases = [];
  let reloads = 0;
  const t0 = Date.now();
  while (Date.now() - t0 < 60000) {
    const ending = await page.getByTestId('ending-screen').isVisible().catch(() => false);
    const raw = await page.evaluate((k) => localStorage.getItem(k), GAME_KEY).catch(() => null);
    const ph = raw ? JSON.parse(raw).data.phase + '@' + JSON.parse(raw).data.age : '?';
    phases.push(ph);
    if (ending && reloads >= 8) break;
    await page.waitForTimeout(120 + Math.floor(Math.random() * 350));
    await page.reload().catch(() => {}); reloads++;
    await page.waitForSelector('[data-testid="life-screen"], [data-testid="title-screen"], [data-testid="ending-screen"]', { timeout: 10000 }).catch(() => {});
    if (await page.getByTestId('title-screen').isVisible().catch(() => false)) await page.getByRole('button', { name: /이어서/ }).first().click().catch(() => {});
  }
  await page.getByTestId('ending-screen').waitFor({ timeout: 20000 }).catch(() => {});
  const s = JSON.parse(await page.evaluate((k) => localStorage.getItem(k), GAME_KEY)).data;
  const deaths = s.history.filter((h) => h.kind === 'death').length;
  const same = JSON.stringify(s.history) === JSON.stringify(exp.history) && JSON.stringify(s.death) === JSON.stringify(exp.death);
  console.log(`${key}: reloads ${reloads} | 단계 ${[...new Set(phases)].join(' → ')} | 최종 ${s.phase} age ${s.age} death ${JSON.stringify(s.death)} | 사망 줄 ${deaths}개 | 코어와 동일=${same} | errors ${errors.length} ${errors.slice(0,2)}`);
  await browser.close();
}
