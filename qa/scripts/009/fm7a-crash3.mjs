// 대조: FM7a와 무관한 새 판(genx 1975)에 같은 연타를 해도 렌더러가 죽는가
import { chromium, inject, birthState, toLife } from './qalib.mjs';
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1280, height: 800 } });
const page = await ctx.newPage();
let crashed = false; page.on('crash', () => { crashed = true; console.log('!!! page crash event'); });
await inject(page, birthState({ seed: 7001, generation: 'genx', wealth: 3, birthYear: 1975, phase: 'roulette' }), { speed: 1, autoMode: false, noteCards: false }, '/?__timescale=60');
await toLife(page);
const click = (id) => page.getByTestId(id).click({ timeout: 500, noWaitAfter: true }).catch(() => {});
const ageOf = () => page.evaluate(() => Number(document.querySelector('[data-testid="life-age"]')?.textContent?.match(/\d+/)?.[0] ?? -1)).catch(() => -2);
for (let round = 0; round < 14 && !crashed; round++) {
  for (let i = 0; i < 10 && !crashed; i++) { if (!process.env.NOSKIP) await click('skip'); if (!process.env.NOPAUSE) await click('pause'); if (!process.env.NOSPEED) { await page.locator('[data-speed="4"]').click({ timeout: 300 }).catch(() => {}); await page.locator('[data-speed="8"]').click({ timeout: 300 }).catch(() => {}); } if (process.env.ONLYWAIT) await page.waitForTimeout(100); }
  const c = page.locator('button[data-testid^="choice-"]:not([data-testid="choice-ask"])').first();
  if (!crashed && (await c.isVisible().catch(() => false))) for (let k = 0; k < Number(process.env.CLICKS ?? 4); k++) await c.click({ timeout: 300, noWaitAfter: true }).catch(() => {});
  console.log('round', round, 'age', await ageOf());
}
console.log(crashed ? '크래시' : '크래시 없음');
await b.close();
