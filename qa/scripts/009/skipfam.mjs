import { chromium, GAME_KEY, SETTINGS_KEY, settingsEnvelope, BASE } from './qalib.mjs';
import { readFileSync } from 'node:fs';
const key = process.argv[2] ?? 'fam17';
const st = JSON.parse(readFileSync(`qa/scripts/009/states/${key}.json`, 'utf8'));
for (const vp of [{ width: 1280, height: 800 }, { width: 360, height: 740 }]) {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: vp, hasTouch: vp.width < 500 });
  const page = await ctx.newPage();
  const errors = []; page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(BASE + '/'); await page.waitForFunction((k) => localStorage.getItem(k) !== null, GAME_KEY);
  await page.evaluate(([k, v, sk, sv]) => { localStorage.setItem(k, v); localStorage.setItem(sk, sv); }, [GAME_KEY, JSON.stringify(st), SETTINGS_KEY, settingsEnvelope({ speed: 8, autoMode: false, noteCards: false })]);
  for (let i = 0; i < 3; i++) { await page.evaluate((k) => window.dispatchEvent(new StorageEvent('storage', { key: k })), GAME_KEY); try { await page.getByTestId('superseded-screen').waitFor({ state: 'attached', timeout: 1000 }); break; } catch {} }
  await page.goto(BASE + '/?__timescale=60');
  await page.getByTestId('life-screen').waitFor();
  let clicks = 0, stuck = 0, lastAge = -1, lastChange = Date.now();
  const t0 = Date.now();
  while (Date.now() - t0 < 170000) {
    if (await page.getByTestId('ending-screen').isVisible().catch(() => false)) break;
    const choice = page.locator('button[data-testid^="choice-"]').first();
    if (await choice.isVisible().catch(() => false)) { await choice.click({ timeout: 2000 }).catch(() => {}); clicks++; }
    else {
      const skip = page.getByTestId('skip');
      if (await skip.isEnabled().catch(() => false)) { await skip.click({ timeout: 2000 }).catch(() => {}); clicks++; }
    }
    const raw = await page.evaluate((k) => localStorage.getItem(k), GAME_KEY).catch(() => null);
    const a = raw ? JSON.parse(raw).data.age : -1;
    if (a !== lastAge) { lastAge = a; lastChange = Date.now(); }
    if (Date.now() - lastChange > 12000) { stuck++; break; }
    await page.waitForTimeout(60);
  }
  const s = JSON.parse(await page.evaluate((k) => localStorage.getItem(k), GAME_KEY)).data;
  let mono = true; for (let i = 1; i < s.history.length; i++) if (s.history[i].age < s.history[i - 1].age) mono = false;
  const famLines = s.history.filter((h) => (h.eventId ?? '').startsWith('fam-')).length;
  const lineLogs = s.family.l.filter((e) => [2, 4, 5, 6].includes(e[0]) || (e[0] === 1 && e[3] === 0)).length;
  console.log(`${key} ${vp.width}px: 클릭 ${clicks}회 | phase ${s.phase} age ${s.age} | 멈춤 ${stuck} | 연표 단조 ${mono} | fam- 줄 ${famLines} = 줄 쓴 로그 ${lineLogs} → ${famLines === lineLogs ? '일치' : '불일치'} | errors ${errors.length} ${errors.slice(0, 2)}`);
  await b.close();
}
