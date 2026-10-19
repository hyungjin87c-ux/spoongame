// QA-003 M7c 보충 스크린샷 2: 숫자·표본 중심이라 화면을 따로 남기지 않았던 케이스의 대표 화면을 qa/screenshots/003/M7c-<케이스ID>.png로 남긴다.
// 사용: node qa/scripts/m7c-shots-extra2.mjs
import { launch, openOracle, plainLife, dueStateFor, pendingState, openSeeded, openManual, withNotes, sheetReady, readNote, readCard, shot, sleep, mkctx, TOUCH, GAME_KEY, SETTINGS_KEY, SAVE_VERSION, PROD, SET_MANUAL, SET_AUTO, settingsEnvelope } from './m7c-lib.mjs';

const b = await launch();
const { page: oracle } = await openOracle(b);
const base = await plainLife(oracle, { era: 'present', seed: 4242, age: 9 });
const infant = await dueStateFor(oracle, 'note-infant-memory', { era: 'present', paused: true });
const pend = await pendingState(oracle, { era: 'present', seed: 4242, minAge: 12, paused: true });
const write = async (page, text) => {
  await openManual(page);
  await page.getByTestId('note-input').focus();
  await page.keyboard.insertText(text);
  await page.getByTestId('note-save').tap();
  await page.waitForSelector('[data-testid="note-sheet"]', { state: 'detached', timeout: 4000 });
  await sleep(400);
};

{ // B01b·K01b·K02b: 자동 ① 시트
  const { ctx, page } = await openSeeded(b, infant, { wait: '[data-testid="note-sheet"]' });
  await sheetReady(page);
  await shot(page, 'B01b', '');
  await shot(page, 'K01b', '');
  await shot(page, 'K02b', '');
  await ctx.close();
}
{ // B03b: 다른 탭이 저장해 밀린 탭
  const { ctx, page: A } = await openSeeded(b, infant, { wait: '[data-testid="note-sheet"]', localFlag: true });
  const B = await ctx.newPage();
  await B.goto(PROD, { waitUntil: 'load' });
  await B.waitForSelector('[data-testid="note-sheet"]');
  await sleep(500);
  await A.bringToFront();
  await sheetReady(A);
  await A.getByTestId('note-input').focus();
  await A.keyboard.insertText('A 탭 기록');
  await A.getByTestId('note-save').tap();
  await sleep(800);
  await B.bringToFront();
  await sleep(600);
  await shot(B, 'B03b', '');
  await ctx.close();
}
{ // B06: 저장 뒤 떠났다 돌아온 화면 / S-refcount / P03 / P02 / B12 / M01 / K02a / P06
  const { ctx, page } = await openSeeded(b, base);
  await write(page, '닫기 시험 기록');
  await page.evaluate(() => { const rows = [...document.querySelectorAll('[data-testid="log-row"]')].filter((r) => r.querySelector('[data-testid="note-label"]')); rows[rows.length - 1].scrollIntoView({ block: 'center' }); });
  await sleep(200);
  await shot(page, 'B06', '');
  await shot(page, 'P03', '');
  await page.evaluate(() => window.scrollTo(0, 0));
  await sleep(200);
  await shot(page, 'P02', '');
  await openManual(page);
  await shot(page, 'K02a', '');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await shot(page, 'M01', '');
  await page.getByTestId('note-cards-toggle').tap();
  await sleep(300);
  await shot(page, 'P06', '');
  await page.getByTestId('note-input').focus();
  await page.keyboard.insertText('가려졌다 돌아온 글');
  await page.evaluate(() => { Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' }); document.dispatchEvent(new Event('visibilitychange')); });
  await sleep(500);
  await page.evaluate(() => { Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' }); document.dispatchEvent(new Event('visibilitychange')); });
  await sleep(300);
  await shot(page, 'B12', '');
  await ctx.close();
}
{ // S-refcount: 1280×800 인생 화면(잠금 없음)
  const { ctx, page } = await openSeeded(b, base, { vp: { width: 1280, height: 800 }, touch: false });
  await page.getByTestId('tool-note').click();
  await sheetReady(page);
  await page.keyboard.press('Escape');
  await sleep(500);
  await shot(page, 'S-refcount', '');
  await ctx.close();
}
{ // B14: 자동 모드 인생(시트 없음)
  const { ctx, page } = await openSeeded(b, { ...infant, paused: false }, { settings: { ...SET_AUTO, speed: 8 } });
  await sleep(4000);
  await shot(page, 'B14', '');
  await ctx.close();
}
{ // B17·: 기록 40줄(상한 시험)
  const full = await withNotes(oracle, base, 40, '상한 시험 ');
  const { ctx, page } = await openSeeded(b, full);
  await page.evaluate(() => document.querySelector('[data-testid="log-list"]').scrollTo(0, 1e9));
  await sleep(300);
  await shot(page, 'B17', '');
  await ctx.close();
}
{ // R-dec-reload: 결정 시트
  const { ctx, page } = await openSeeded(b, pend, { wait: '[data-testid="choice-panel"]' });
  await sleep(500);
  await shot(page, 'R-dec-reload', '');
  await ctx.close();
}
{ // R-S01·R-S02: 설정 v3·변조 설정으로 열린 자동 카드
  for (const [id, sv] of [['R-S01', JSON.stringify({ version: 3, data: { era: 'present', lifeLength: 'short30', bgm: { on: false, volume: 30 }, theme: 'dark', speed: 4, autoMode: false } })], ['R-S02', JSON.stringify({ version: 4, data: { era: 'present', lifeLength: 'short30', bgm: { on: false, volume: 30 }, theme: 'system', speed: 1, autoMode: false, noteCards: 'no' } })]]) {
    const ctx = await mkctx(b, { viewport: { width: 360, height: 740 }, ...TOUCH });
    await ctx.addInitScript(([k, s, sk, svv]) => { try { if (!sessionStorage.getItem('__s')) { localStorage.clear(); localStorage.setItem(k, s); localStorage.setItem(sk, svv); sessionStorage.setItem('__s', '1'); } } catch {} }, [GAME_KEY, JSON.stringify({ version: SAVE_VERSION, data: infant }), SETTINGS_KEY, sv]);
    const page = await ctx.newPage();
    await page.goto(PROD, { waitUntil: 'load' });
    await page.waitForSelector('[data-testid="note-sheet"]', { timeout: 10000 });
    await sleep(500);
    await shot(page, id, '');
    await ctx.close();
  }
}
{ // R05: 첫 화면
  const ctx = await mkctx(b, { viewport: { width: 360, height: 740 }, ...TOUCH });
  const page = await ctx.newPage();
  await page.goto(PROD, { waitUntil: 'load' });
  await page.waitForSelector('[data-testid="title-screen"]');
  await sleep(300);
  await shot(page, 'R05', '');
  await ctx.close();
}
await b.close();
console.log('보충 스크린샷 2 완료');
