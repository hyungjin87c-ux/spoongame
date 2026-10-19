// QA-003 M7b 2회차 보충 스크린샷: 케이스마다 한 장(A05·A08·A15·A17·A19) — 1회차 m7b-shots-extra에서 인용 판독 C02 부분만 뺀 것
import fs from 'node:fs';
import path from 'node:path';
import { launch, sleep, OUT, mkctx, DEV, PROD, shot, readCard, cardReady, findCardState, GAME_KEY, SETTINGS_KEY, settingsEnvelope, SET_MANUAL, SET_AUTO, TOUCH } from './m7b-lib.mjs';
import { openCard, VPS } from './m7b-audit.mjs';
const b = await launch();
const STATES = path.join(OUT, 'states');
// A05: 더블클릭 선택 뒤
{
  const { ctx, page } = await openCard(b, 'tutoring-present', 'sheet', { vp: VPS[2], hidden: true });
  await cardReady(page); await sleep(300);
  await page.locator('.choice').first().dblclick();
  await sleep(900);
  await shot(page, 'A05', 'after-dblclick');
  await ctx.close();
}
// A08: 접은 채 탭 가림 뒤 복귀
{
  const { ctx, page } = await openCard(b, 'tutoring-present', 'inline', { vp: VPS[2], hidden: false, vishook: true });
  await cardReady(page);
  await page.getByTestId('decision-fold-btn').tap();
  await page.waitForSelector('[data-testid="decision-fold"]');
  await page.evaluate(() => { window.__vis = 'hidden'; document.dispatchEvent(new Event('visibilitychange')); });
  await sleep(2500);
  await page.evaluate(() => { window.__vis = 'visible'; document.dispatchEvent(new Event('visibilitychange')); });
  await sleep(1500);
  await shot(page, 'A08', 'folded-after-return');
  await ctx.close();
}
// A15: 쓰기 실패 중 접은 화면
{
  const { ctx, page } = await openCard(b, 'tutoring-present', 'sheet', { vp: VPS[2], hidden: true });
  await cardReady(page);
  await page.evaluate(() => { Storage.prototype.setItem = function () { throw new DOMException('quota', 'QuotaExceededError'); }; });
  await page.getByTestId('decision-fold-btn').tap();
  await page.waitForSelector('[data-testid="decision-fold"]');
  await sleep(300);
  await shot(page, 'A15', 'folded-while-storage-fails');
  await ctx.close();
}
// A17: 키보드 난타 뒤 시트
{
  const { ctx, page } = await openCard(b, 'tutoring-present', 'sheet', { vp: VPS[2], hidden: true });
  await cardReady(page);
  for (let i = 0; i < 20; i++) await page.keyboard.type('<script>alert(1)</script>😀ㅎㅏㄴ한글123', { delay: 0 });
  await sleep(400);
  await shot(page, 'A17', 'after-typing');
  await ctx.close();
}
// A19: 화면 회전(가로 740×360) 중 시트·인라인 한 장씩
for (const mode of ['sheet', 'inline']) {
  const { ctx, page } = await openCard(b, 'sibling-past', mode, { vp: { name: '740x360', width: 740, height: 360, touch: true }, hidden: true });
  await cardReady(page).catch(() => {});
  await sleep(300);
  await shot(page, 'A19', `landscape-740x360-${mode}`);
  await ctx.close();
}
await b.close();
