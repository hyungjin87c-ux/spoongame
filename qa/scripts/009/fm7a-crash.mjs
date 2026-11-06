// T04-boomer 연타에서 「Target crashed」가 나는 지점을 찾는다 (라운드마다 나이·DOM 노드·JS 힙 기록)
import { chromium, boot, readSave, cardNow, ageNow } from './fm7a-lib.mjs';
import { readFileSync } from 'node:fs';
const key = process.env.KEY ?? 'T04-boomer';
const st = JSON.parse(readFileSync(`${process.env.QA_STATES}/${key}.json`, 'utf8'));
const b = await chromium.launch();
const { ctx, page, errors } = await boot(b, st, { scale: Number(process.env.SCALE ?? 60), settings: { speed: 1, autoMode: false } });
const cdp = await ctx.newCDPSession(page);
if (!process.env.NOCDP) await cdp.send('Debugger.enable');
let frames = null;
cdp.on('Debugger.paused', (e) => { frames = e.callFrames; });
const alive = () => Promise.race([page.evaluate(() => 1).then(() => true), new Promise((r) => setTimeout(() => r(false), 4000))]);
let crashed = false;
page.on('crash', () => { crashed = true; console.log('!!! page crash event'); });
await page.getByTestId('life-screen').waitFor({ timeout: 15000 });
const click = (id) => page.getByTestId(id).click({ timeout: 500, noWaitAfter: true }).catch(() => {});
const probe = async (tag) => {
  if (crashed) return;
  const r = await page.evaluate(() => ({ nodes: document.getElementsByTagName('*').length, heap: Math.round((performance.memory?.usedJSHeapSize ?? 0) / 1e6), age: Number(document.querySelector('[data-testid="life-age"]')?.textContent?.match(/\d+/)?.[0] ?? -1) })).catch((e) => ({ err: String(e).slice(0, 60) }));
  console.log(tag, JSON.stringify(r));
};
for (let round = 0; round < Number(process.env.ROUNDS ?? 14) && !crashed; round++) {
  for (let i = 0; i < 10 && !crashed; i++) { if (!process.env.NOSKIP) await click('skip'); if (!process.env.NOPAUSE) await click('pause'); if (!process.env.NOSPEED) { await page.locator('[data-speed="4"]').click({ timeout: 300 }).catch(() => {}); await page.locator('[data-speed="8"]').click({ timeout: 300 }).catch(() => {}); } }
  if (process.env.WAIT) await page.waitForTimeout(Number(process.env.WAIT));
  await probe("round " + round);
  const card = crashed ? null : await cardNow(page).catch(() => null);
  if (card) { console.log('  카드', card.title, card.choices.map((c) => c.id).join('|')); const id = card.choices[0].id; for (let k = 0; k < Number(process.env.CLICKS ?? 4); k++) await page.getByTestId(`choice-${id}`).click({ timeout: 300, noWaitAfter: true }).catch(() => {}); }
}
console.log('errors', errors.slice(0, 5));
await b.close();
