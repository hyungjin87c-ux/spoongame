// QA-003 M7c 2회차 보충 스크린샷: 화면 증거를 따로 남기지 않은 케이스(G-auto-select·G-feedback·G-in-sheet·G-keys-*·G-normal-taps·G-silent-*·L-40-reload·L-41-click·P04·PZ-*)의
// 대표 화면을 qa/screenshots/003/M7c-r2-<케이스ID>.png로 남긴다. 판정은 바꾸지 않는다(해당 케이스의 본 시험은 각자의 스크립트).
// 사용: node qa/scripts/m7c-r2-shots-extra.mjs
import { launch, openOracle, plainLife, dueStateFor, pendingState, evalCore, withNotes, openSeeded, sheetReady, shot, sleep, GAME_KEY, SET_AUTO, SET_MANUAL } from './m7c-r2-lib.mjs';

const b = await launch();
const { page: oracle } = await openOracle(b);
const base = await plainLife(oracle, { era: 'present', seed: 4242, age: 9 });
const pendRun = await pendingState(oracle, { era: 'present', seed: 4242, minAge: 12, paused: false });
const silentDue = await evalCore(
  oracle,
  `for (let seed = 1; seed < 4000; seed++) {
     let s = core.enterLife(core.enterBirth(core.beginBirth(core.createInitialState(seed), 'present')));
     for (let g = 0; g < 300 && s.phase === 'life'; g++) {
       if (s.pending !== null) { s = core.resolveChoice(s, s.pending.key, s.pending.choiceIds[0]); continue; }
       const due = core.dueNote(s);
       if (due !== null) {
         if (due.id === 'note-infant-memory') {
           let t = core.consumeNote(s, due);
           let ok = true;
           for (let i = 0; i < 3 && ok; i++) { const r = core.stepYear(t); t = r.state; if (t.phase !== 'life' || t.pending !== null) ok = false; }
           if (ok) return { ...s, paused: false };
         }
         s = core.consumeNote(s, due);
       }
       s = core.stepYear(s).state;
     }
   }
   return null;`,
);
const guardFree = (page, sel = '[data-testid="tool-note"]') => page.waitForFunction((q) => { const t = document.querySelector(q); return t && t.getAttribute('aria-disabled') !== 'true'; }, sel, { timeout: 6000 });

// G-auto-select
{
  const { ctx, page } = await openSeeded(b, pendRun, { settings: { ...SET_AUTO, speed: 1 }, wait: '[data-testid="choice-panel"]' });
  await page.waitForSelector('[data-testid="choice-panel"]', { state: 'detached', timeout: 15000 });
  await sleep(100);
  await page.evaluate(() => { const t = document.querySelector('[data-speed="4"]'); t.click(); });
  await sleep(250);
  await shot(page, 'G-auto-select');
  await ctx.close();
}
// G-feedback · G-in-sheet · G-keys-esc · G-keys-tab-order · G-normal-taps
{
  const { ctx, page } = await openSeeded(b, base, { wait: '[data-testid="life-screen"]' });
  await guardFree(page);
  await page.evaluate(() => document.querySelector('[data-testid="tool-note"]').click());
  await sheetReady(page);
  await page.getByTestId('note-input').focus();
  await page.keyboard.insertText('링크 가드 시험');
  await page.keyboard.press('Escape');
  await page.waitForSelector('[data-testid="note-confirm"]');
  await sleep(500);
  await shot(page, 'G-in-sheet');
  await page.getByTestId('note-confirm-back').tap();
  await sleep(600);
  await page.getByTestId('note-save').tap();
  await sleep(80);
  await shot(page, 'G-feedback');
  await ctx.close();
}
{
  const { ctx, page } = await openSeeded(b, base, { wait: '[data-testid="life-screen"]' });
  await guardFree(page);
  await page.getByTestId('tool-note').focus();
  await page.keyboard.press('Enter');
  await sheetReady(page);
  await page.keyboard.press('Escape');
  for (let i = 0; i < 12; i++) {
    await page.keyboard.press('Escape');
    await sleep(30);
  }
  await sleep(300);
  await shot(page, 'G-keys-esc');
  await guardFree(page);
  await page.keyboard.press('Enter');
  await sheetReady(page);
  await page.getByTestId('note-input').focus();
  await page.keyboard.insertText('탭 순서');
  await page.keyboard.press('Tab');
  await page.keyboard.press('Enter');
  await sleep(80);
  await page.keyboard.press('Tab');
  await page.keyboard.press('Tab');
  await shot(page, 'G-keys-tab-order');
  await ctx.close();
}
{
  const { ctx, page } = await openSeeded(b, { ...base, paused: false }, { settings: { ...SET_MANUAL, speed: 1 }, wait: '[data-testid="life-screen"]' });
  await sleep(900);
  for (const v of ['2', '4', '8', '2']) {
    await page.evaluate((vv) => document.querySelector(`[data-speed="${vv}"]`).click(), v);
    await sleep(100);
  }
  await shot(page, 'G-normal-taps');
  await ctx.close();
}
// G-silent-*
for (const V of [
  { id: 'auto-mode', st: silentDue, settings: { ...SET_AUTO, speed: 8 } },
  { id: 'cards-off', st: silentDue, settings: { speed: 8, autoMode: false, noteCards: false } },
  { id: 'limit-40', st: null, settings: { speed: 8, autoMode: false, noteCards: true } },
]) {
  const st = V.id === 'limit-40' ? await withNotes(oracle, silentDue, 40) : V.st;
  const { ctx, page } = await openSeeded(b, st, { settings: V.settings, wait: '[data-testid="life-screen"]' });
  const t0 = Date.now();
  while (Date.now() - t0 < 20000) {
    const has = await page.evaluate((k) => { try { return JSON.parse(localStorage.getItem(k)).data.seen['note-infant-memory'] !== undefined; } catch { return false; } }, GAME_KEY);
    if (has) break;
    await sleep(20);
  }
  await sleep(100);
  await page.evaluate(() => document.querySelector('[data-speed="2"]').click());
  await sleep(250);
  await shot(page, `G-silent-${V.id}`);
  await ctx.close();
}
// L-40-reload · L-41-click
{
  const infant = await dueStateFor(oracle, 'note-infant-memory', { era: 'present', paused: true });
  const st40 = await withNotes(oracle, infant, 40);
  const { ctx, page } = await openSeeded(b, st40, { wait: '[data-testid="life-screen"]' });
  for (let i = 0; i < 12; i++) {
    await page.reload({ waitUntil: 'load' });
    await page.waitForSelector('[data-testid="life-screen"], [data-testid="note-sheet"]');
  }
  await sleep(500);
  await shot(page, 'L-40-reload');
  await guardFree(page);
  await page.evaluate(() => document.querySelector('[data-testid="tool-note"]').click());
  await sheetReady(page);
  await shot(page, 'L-41-click');
  await ctx.close();
}
// P04: 개발 서버 ?__crash 오류 화면
{
  const { ctx, page } = await openSeeded(b, base, { base: 'http://127.0.0.1:5899/', query: '?__crash', wait: '[data-testid="error-screen"]' });
  await shot(page, 'P04');
  await ctx.close();
}
// PZ-baseline · PZ-doubletap
{
  const { ctx, page } = await openSeeded(b, base, { wait: '[data-testid="life-screen"]' });
  const cdp = await ctx.newCDPSession(page);
  const pts = (d) => [{ x: 180 - d / 2, y: 400, id: 1 }, { x: 180 + d / 2, y: 400, id: 2 }];
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: pts(60) });
  for (let i = 1; i <= 12; i++) {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: pts(60 + (180 * i) / 12) });
    await sleep(16);
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await sleep(400);
  await shot(page, 'PZ-baseline');
  await ctx.close();
}
{
  const { ctx, page } = await openSeeded(b, base, { wait: '[data-testid="life-screen"]' });
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Input.synthesizeTapGesture', { x: 180, y: 400, tapCount: 2, gestureSourceType: 'touch' }).catch(() => {});
  await sleep(500);
  await shot(page, 'PZ-doubletap');
  await ctx.close();
}
await b.close();
console.log('보충 스크린샷 완료');
