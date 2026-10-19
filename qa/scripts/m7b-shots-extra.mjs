// QA-003 M7b 보충 스크린샷: 케이스마다 한 장(A05·A08·A15·A17)과 인용 판독 C02에서 걸린 카드 화면
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
// C02: 걸린 카드 화면(수확 표본의 인용 문장 그대로)
const ctx0 = await mkctx(b);
const o = await ctx0.newPage();
await o.goto(DEV, { waitUntil: 'load' });
await o.waitForSelector('[data-testid="title-screen"]');
const LIST = [['infant-screen', 'future', 'c-035'], ['infant-screen', 'present', 'c-035'], ['youth-startup', 'present', 'c-077'], ['middle-business', 'present', 'c-078'], ['middle-career-peak', 'present', 'c-047'], ['youth-return-school', 'future', 'c-095'], ['school-academy-night', 'present', 'c-049'], ['senior-new-device', 'present', 'c-086'], ['middle-child-school', 'present', 'c-011'], ['school-parttime', 'present', 'c-017']];
for (const [ev, era, cid] of LIST) {
  const st = await findCardState(o, ev, era, { to: 9000 }) || null;
  if (!st) { console.log('못 찾음', ev, era); continue; }
  const name = `c02-${ev}-${era}`;
  fs.writeFileSync(path.join(STATES, `${name}.json`), JSON.stringify(st));
  const { ctx, page } = await openCard(b, name, 'sheet', { vp: VPS[2], hidden: true });
  await cardReady(page); await sleep(300);
  await shot(page, 'C02', `${cid}-${ev}-${era}`);
  await ctx.close();
}
await ctx0.close();
await b.close();
