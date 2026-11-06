// T04-boomer + 「다음 결정으로」 연타: CDP 지표(JS 힙·DOM 노드·리스너·레이아웃 수)를 해마다 찍어 크래시 직전 추세를 본다
import { chromium, boot, cardNow } from './fm7a-lib.mjs';
import { readFileSync } from 'node:fs';
const st = JSON.parse(readFileSync(`${process.env.QA_STATES}/${process.env.KEY ?? 'T04-boomer'}.json`, 'utf8'));
const b = await chromium.launch();
const { ctx, page } = await boot(b, st, { scale: 60, settings: { speed: 1, autoMode: false } });
const cdp = await ctx.newCDPSession(page);
await cdp.send('Performance.enable');
let crashed = false; page.on('crash', () => { crashed = true; console.log('!!! crash'); });
await page.getByTestId('life-screen').waitFor();
const click = (id) => page.getByTestId(id).click({ timeout: 400, noWaitAfter: true }).catch(() => {});
for (let round = 0; round < 40 && !crashed; round++) {
  for (let i = 0; i < 10 && !crashed; i++) await click('skip');
  const card = crashed ? null : await cardNow(page).catch(() => null);
  if (card) for (let k = 0; k < 4; k++) await page.getByTestId(`choice-${card.choices[0].id}`).click({ timeout: 300, noWaitAfter: true }).catch(() => {});
  if (crashed) break;
  const m = await cdp.send('Performance.getMetrics').then((r) => Object.fromEntries(r.metrics.map((x) => [x.name, x.value]))).catch(() => null);
  const age = await page.evaluate(() => Number(document.querySelector('[data-testid="life-age"]')?.textContent?.match(/\d+/)?.[0] ?? -1)).catch(() => -2);
  console.log('round', round, 'age', age, m ? `heap ${Math.round(m.JSHeapUsedSize / 1e6)}MB nodes ${m.Nodes} listeners ${m.JSEventListeners} layouts ${m.LayoutCount} recalc ${m.RecalcStyleCount}` : 'metrics fail', card ? '카드 ' + card.title : '');
}
await b.close();
