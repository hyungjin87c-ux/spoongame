// SPEC-005 r4 QA(360×740 터치): 자동 고르기 버튼 더블탭·세 번 탭, 끄는 버튼 탭, 덮기·다시 열기 탭, 넘침.
import { launchChromium, VP, Watch, PROD, DEV, run, ok, bad, note, sleep, overflowOf, readSave, readSettings, seedPage, DEFAULT_SETTINGS, pendingState } from './q005r4-lib.mjs';
const b = await launchChromium();
const devB = await launchChromium();
const dev = await (await devB.newContext({ viewport: { width: 800, height: 600 } })).newPage();
await dev.goto(DEV + '/');
await dev.getByTestId('title-screen').waitFor({ timeout: 90000 });
const st = await pendingState(dev, 'youth-startup');
const MANUAL = { ...DEFAULT_SETTINGS, speed: 1, autoMode: false, noteCards: false, gentle: false };
const chosen = async (page) => (await readSave(page))?.data?.history?.filter((h) => h.kind === 'choice' && h.by === undefined).length ?? -1;
const waitEnabled = (page, id) => page.waitForFunction((i) => { const e = document.querySelector(`[data-testid="${i}"]`); return e && e.getAttribute('aria-disabled') !== 'true' && !e.disabled; }, id, { timeout: 15000 });
for (const taps of [1, 2, 3]) {
  const ctx = await b.newContext({ ...VP.m360, locale: 'ko-KR' });
  const watch = new Watch('touch').attach(ctx);
  const page = await ctx.newPage();
  await seedPage(page, { game: st, settings: MANUAL });
  await page.goto(PROD + '/');
  await page.getByTestId('choice-panel').waitFor({ timeout: 60000 });
  await sleep(900);
  const c0 = await chosen(page);
  await waitEnabled(page, 'auto-on-btn');
  await run({ id: `T360-tap${taps}`, area: '자동 고르기(터치)', title: `360×740 터치: 자동 고르기 버튼 ${taps}번 탭(80ms 간격)`, steps: '시트 맨 끝으로 스크롤 → 버튼 좌표를 touchscreen.tap 연속', expected: '인라인 전환 1회, 자동 모드 켜진 채, 선택지 오탭 0, 넘침 0' }, async () => {
    await page.getByTestId('auto-on-btn').scrollIntoViewIfNeeded();
    await sleep(250);
    const box = await page.getByTestId('auto-on-btn').boundingBox();
    const x = box.x + box.width / 2;
    const y = box.y + box.height / 2;
    for (let i = 0; i < taps; i++) {
      await page.touchscreen.tap(x, y);
      await sleep(80);
    }
    await sleep(1000);
    const mode = await page.getByTestId('choice-panel').getAttribute('data-mode', { timeout: 1500 }).catch(() => null);
    const set = await readSettings(page);
    const cc = (await chosen(page)) - c0;
    const ov = await overflowOf(page);
    const focus = await page.evaluate(() => document.activeElement?.getAttribute('data-testid'));
    const good = mode === 'inline' && set?.data?.autoMode === true && cc === 0 && ov.over === 0;
    return (good ? ok : bad)(JSON.stringify({ mode, autoMode: set?.data?.autoMode, choiceDelta: cc, over: ov.over, focus }));
  });
  if (taps === 1) {
    await run({ id: 'T360-off', area: '자동 고르기(터치)', title: '360 터치: 인라인 끄는 버튼 탭 → 시트로, 덮기·다시 열기 탭', steps: '끄는 버튼 tap → 덮기 tap → 다시 열기 tap', expected: '시트 ↔ 인라인/띠 전환 정상, 선택 0' }, async () => {
      await waitEnabled(page, 'auto-off-btn');
      await page.getByTestId('auto-off-btn').scrollIntoViewIfNeeded();
      await page.getByTestId('auto-off-btn').tap();
      await page.waitForFunction(() => document.querySelector('[data-testid="choice-panel"]')?.getAttribute('data-mode') === 'sheet', null, { timeout: 5000 });
      await sleep(500);
      await waitEnabled(page, 'decision-fold-btn');
      await page.getByTestId('decision-fold-btn').tap();
      await page.getByTestId('decision-fold').waitFor({ timeout: 5000 });
      await waitEnabled(page, 'decision-reopen');
      await page.getByTestId('decision-reopen').tap();
      await page.getByTestId('choice-panel').waitFor({ timeout: 5000 });
      const set = await readSettings(page);
      const cc = (await chosen(page)) - c0;
      return (set?.data?.autoMode === false && cc === 0 ? ok : bad)(JSON.stringify({ autoMode: set?.data?.autoMode, choiceDelta: cc }));
    });
  }
  const w = watch.take();
  if (w.console.length || w.external.length) console.log('CONSOLE', taps, JSON.stringify(w));
  await ctx.close();
}
await b.close();
await devB.close();
