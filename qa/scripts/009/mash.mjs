import { chromium, GAME_KEY, SETTINGS_KEY, settingsEnvelope, BASE } from './qalib.mjs';
import { readFileSync } from 'node:fs';
const st = JSON.parse(readFileSync('qa/scripts/009/states/fam17-5.json', 'utf8'));
for (const vp of [{ width: 360, height: 740 }]) {
  const b = await chromium.launch();
  const page = await (await b.newContext({ viewport: vp, hasTouch: vp.width < 500 })).newPage();
  const errors = []; page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(BASE + '/'); await page.waitForFunction((k) => localStorage.getItem(k) !== null, GAME_KEY);
  await page.evaluate(([k, v, sk, sv]) => { localStorage.setItem(k, v); localStorage.setItem(sk, sv); }, [GAME_KEY, JSON.stringify(st), SETTINGS_KEY, settingsEnvelope({ speed: 8, autoMode: false, noteCards: false })]);
  for (let i = 0; i < 3; i++) { await page.evaluate((k) => window.dispatchEvent(new StorageEvent('storage', { key: k })), GAME_KEY); try { await page.getByTestId('superseded-screen').waitFor({ state: 'attached', timeout: 1000 }); break; } catch {} }
  await page.goto(BASE + '/?__timescale=60');
  await page.getByTestId('life-screen').waitFor();
  const click = (id) => page.getByTestId(id).click({ timeout: 800, noWaitAfter: true }).catch(() => {});
  for (let round = 0; round < 6; round++) {
    for (let i = 0; i < 8; i++) { await click('skip'); await click('pause'); await page.locator('[data-speed="4"]').click({ timeout: 500 }).catch(() => {}); await page.locator('[data-speed="8"]').click({ timeout: 500 }).catch(() => {}); await click('scene-fold'); await click('scene-open-family'); }
    const ch = page.locator('button[data-testid^="choice-"]').first();
    if (await ch.isVisible().catch(() => false)) await ch.click({ timeout: 800 }).catch(() => {});
    // 가족 줄이 있는 곳에서 시대의 창도 연타
    for (let i = 0; i < 10; i++) await page.locator('#scene-era').click({ timeout: 400 }).catch(() => {});
  }
  const s = JSON.parse(await page.evaluate((k) => localStorage.getItem(k), GAME_KEY)).data;
  let mono = true; for (let i = 1; i < s.history.length; i++) if (s.history[i].age < s.history[i - 1].age) mono = false;
  const eraIds = await page.locator('[data-tl="era"]').evaluateAll((els) => els.map((e) => e.id));
  const ov = await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth);
  await page.reload(); await page.waitForTimeout(1200);
  const s2 = JSON.parse(await page.evaluate((k) => localStorage.getItem(k), GAME_KEY)).data;
  console.log(`${vp.width}px: age ${s.age} phase ${s.phase} 연표 단조 ${mono} 시대 줄 id 중복 ${eraIds.length - new Set(eraIds).size} 가로넘침 없음 ${ov} | 새로고침 뒤 age ${s2.age} (같거나 이어짐) | errors ${errors.length} ${errors.slice(0, 2)}`);
  await b.close();
}
