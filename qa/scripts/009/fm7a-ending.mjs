// 엔딩: 형제가 떠난 판(T06 키)을 끝까지 자동으로 돌려 엔딩 화면의 연표·출생신고 「N째」·가림(gentle) 노출을 본다
import { chromium, boot, loadState, readSave } from './fm7a-lib.mjs';

const keys = process.argv.slice(2);
const gentle = process.env.GENTLE === '1';
const b = await chromium.launch();
for (const key of keys) {
  const st = loadState(key);
  const { ctx, page, errors } = await boot(b, st, { scale: 60, settings: { speed: 8, autoMode: true, gentle } });
  await page.getByTestId('life-screen').waitFor({ timeout: 15000 });
  const t0 = Date.now();
  while (Date.now() - t0 < 120000 && !(await page.getByTestId('ending-screen').isVisible().catch(() => false))) {
    const card = page.locator('button[data-testid^="choice-"]:not([data-testid="choice-ask"])').first();
    if (await card.isVisible().catch(() => false)) await card.click({ timeout: 1000 }).catch(() => {});
    await page.waitForTimeout(150);
  }
  const ended = await page.getByTestId('ending-screen').isVisible().catch(() => false);
  const sv = await readSave(page);
  const first = sv.data.history[0]?.text ?? '';
  const rows = await page.evaluate(() => [...document.querySelectorAll('[data-testid="ending-timeline"] li')].map((li) => li.innerText.replace(/\s+/g, ' ').trim()));
  const hit = rows.filter((r) => /세상을 떠|따로 살게|무거운 일이 있었/.test(r));
  const veiled = await page.locator('[data-testid="ending-timeline"] [data-veiled="true"]').count();
  console.log(`\n=== ${key} gentle=${gentle} 엔딩 ${ended} | 출생신고 「${first.match(/(첫째|둘째|셋째|넷째|다섯째|여섯째|일곱째)[^ ]*/)?.[0] ?? '?'}」 | 연표 줄 ${rows.length} | 가림 ${veiled} | errors ${errors.length}`);
  for (const r of hit.slice(0, 8)) console.log('  · ' + r.slice(0, 120));
  await ctx.close();
}
await b.close();
