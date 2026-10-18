// 도구 점검: 「Target crashed」(렌더러 충돌)가 특정 카드·입력에서 재현되는지 반복해 본다.
import fs from 'node:fs';
import path from 'node:path';
import { launch, mkctx, seedStorage, sleep, OUT, PROD, GAME_KEY, SETTINGS_KEY, TOUCH, VP } from './m7a-lib.mjs';
import { RP, SHOT_PREFIX } from './m7a-lib.mjs';
const craft = JSON.parse(fs.readFileSync(path.join(OUT, RP + 'craft-saves.json'), 'utf8'));
const key = process.argv[2] || 'w-school-supplies-present-t5';
const method = process.argv[3] || 'tap2';
const reps = Number(process.argv[4] || 12);
const SPEED8 = JSON.stringify({ version: 3, data: { speed: 8, autoMode: false, era: 'present', lifeLength: 'short30', bgm: { on: false, volume: 30 }, theme: 'system' } });
const browser = await launch();
let crashes = 0, ok = 0, other = 0;
for (let i = 0; i < reps; i++) {
  const ctx = await mkctx(browser, { viewport: VP.m360, ...TOUCH });
  await seedStorage(ctx, { [GAME_KEY]: craft[key].raw, [SETTINGS_KEY]: SPEED8 });
  const page = await ctx.newPage();
  let crashed = false;
  page.on('crash', () => { crashed = true; });
  try {
    await page.goto(PROD, { waitUntil: 'load', timeout: 20000 });
    await page.waitForSelector('[data-testid="choice-panel"]', { timeout: 30000 });
    await page.waitForFunction(() => [...document.querySelectorAll('[data-testid="choice-panel"] .choice')].every((b) => b.getAttribute('aria-disabled') !== 'true'), null, { timeout: 8000 });
    const first = await page.evaluate(() => document.querySelector('[data-testid="choice-panel"] .choice').getAttribute('data-testid'));
    const box = await page.locator(`[data-testid="${first}"]`).boundingBox();
    const n = method === 'tap3' ? 3 : 2;
    if (method.startsWith('tap')) for (let k = 0; k < n; k++) await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
    else if (method === 'mouse') for (let k = 0; k < 12; k++) await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    await sleep(900);
    await page.evaluate(() => 1);
    ok++;
  } catch (e) {
    if (crashed || /crash/i.test(String(e.message))) crashes++; else { other++; console.log('기타', String(e.message).split('\n')[0].slice(0, 100)); }
  }
  await ctx.close().catch(() => {});
}
console.log(`${key} ${method}: 정상 ${ok} / 렌더러 충돌 ${crashes} / 기타 ${other} (${reps}회)`);
await browser.close();
