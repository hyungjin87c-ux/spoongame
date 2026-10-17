// QA-003 M5 O10: 시설 입소(middle-parents-care/facility)의 영향 줄이 순자산·재력에 따라 어떻게 달라지는지 실제 화면에서 읽는다.
import fs from 'node:fs';
import path from 'node:path';
import { launch, mkctx, seedStorage, DEV, OUT, GAME_KEY, READ_DASH_M5, editSave } from './m5-lib.mjs';
const crafted = JSON.parse(fs.readFileSync(path.join(OUT, 'craft-saves.json'), 'utf8'));
const browser = await launch();
const rows = [];
for (const [tier, net] of [[1, 12000], [3, 12000], [5, 12000], [3, 100000], [5, 100000]]) {
  const raw = editSave(crafted['care-rich'].raw, (d) => {
    d.character.parentWealth = tier;
    d.assets.net = net;
    d.assets.debt = 0;
  });
  const ctx = await mkctx(browser, { viewport: { width: 1280, height: 800 } });
  await seedStorage(ctx, { [GAME_KEY]: raw });
  const page = await ctx.newPage();
  await page.addInitScript(`window.__readDash = ${READ_DASH_M5.toString()};`);
  await page.goto(`${DEV}?__timescale=60`, { waitUntil: 'load' });
  await page.waitForSelector('[data-testid="choice-panel"]', { timeout: 15000 });
  const d = await page.evaluate(() => window.__readDash());
  const f = d.choices.find((c) => c.id === 'facility');
  rows.push(`재력 ${tier}·순자산 ${net}: facility ${f ? f.impact.map((i) => i.shown).join(' · ') || '(영향 줄 없음)' : '(안 보임)'}`);
  await ctx.close();
}
await browser.close();
console.log(rows.join('\n'));
