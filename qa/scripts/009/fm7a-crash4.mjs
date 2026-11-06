// 프로덕션 번들(vite preview, 기존 dist)에서 같은 연타(타임스케일 없음) — 크래시 여부
import { chromium, inject, birthState, toLife } from './qalib.mjs';
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1280, height: 800 } });
const page = await ctx.newPage();
let crashed = false; page.on('crash', () => { crashed = true; console.log('!!! page crash event'); });
await inject(page, birthState({ seed: 7001, generation: 'genx', wealth: 3, birthYear: 1975, phase: 'roulette' }), { speed: 8, autoMode: false, noteCards: false }, '/');
await toLife(page);
const click = (id) => page.getByTestId(id).click({ timeout: 400, noWaitAfter: true }).catch(() => {});
const ageOf = () => page.evaluate(() => Number(document.querySelector('[data-testid="life-age"]')?.textContent?.match(/\d+/)?.[0] ?? -1)).catch(() => -2);
const t0 = Date.now();
let round = 0;
while (!crashed && Date.now() - t0 < 110000) {
  for (let i = 0; i < 6 && !crashed; i++) { await click('skip'); await click('pause'); await page.locator('[data-speed="4"]').click({ timeout: 250 }).catch(() => {}); await page.locator('[data-speed="8"]').click({ timeout: 250 }).catch(() => {}); }
  const c = page.locator('button[data-testid^="choice-"]:not([data-testid="choice-ask"])').first();
  if (!crashed && (await c.isVisible().catch(() => false))) for (let k = 0; k < 4; k++) await c.click({ timeout: 250, noWaitAfter: true }).catch(() => {});
  if (round++ % 5 === 0) console.log('round', round, 'age', await ageOf(), `${Math.round((Date.now() - t0) / 1000)}s`);
  if (await page.getByTestId('ending-screen').isVisible().catch(() => false)) { console.log('엔딩 도달'); break; }
}
console.log(crashed ? '크래시' : '크래시 없음');
await b.close();
