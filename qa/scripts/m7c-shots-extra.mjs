// QA-003 M7c 보충 스크린샷: 화면 증거를 따로 남기지 않은 케이스(A05-drop·A19-*·B10*·R-G*·X-attr·X-ax-row·K03)의 대표 화면을 qa/screenshots/003/M7c-<케이스ID>.png로 남긴다.
// 사용: node qa/scripts/m7c-shots-extra.mjs
import { launch, openOracle, plainLife, dueStateFor, openSeeded, openSeededRaw, openManual, sheetReady, readNote, readCard, shot, sleep, SAVE_VERSION, SET_MANUAL } from './m7c-lib.mjs';

const b = await launch();
const { page: oracle } = await openOracle(b);
const base = await plainLife(oracle, { era: 'present', seed: 4242, age: 9 });
const infant = await dueStateFor(oracle, 'note-infant-memory', { era: 'present', paused: true });
const infantRun = { ...infant, paused: false };

// A05-drop: 드롭한 글이 정리되어 입력란에 들어온 모습
{
  const { ctx, page } = await openSeeded(b, base);
  await openManual(page);
  const cdp = await ctx.newCDPSession(page);
  const box = await page.getByTestId('note-input').boundingBox();
  const data = { items: [{ mimeType: 'text/plain', data: '가나다​라‮마바' + '사'.repeat(300) }], dragOperationsMask: 1 };
  for (const type of ['dragEnter', 'dragOver', 'drop']) await cdp.send('Input.dispatchDragEvent', { type, x: box.x + box.width / 2, y: box.y + box.height / 2, data });
  await sleep(300);
  await shot(page, 'A05-drop', '');
  await ctx.close();
}
// A19-ime1~3, caret
{
  const { ctx, page } = await openSeeded(b, base);
  await openManual(page);
  const cdp = await ctx.newCDPSession(page);
  await page.getByTestId('note-input').focus();
  await cdp.send('Input.imeSetComposition', { text: '한', selectionStart: 1, selectionEnd: 1 });
  await page.keyboard.press('Escape');
  await sleep(250);
  await shot(page, 'A19-ime1', '');
  await cdp.send('Input.insertText', { text: '한' });
  await cdp.send('Input.imeSetComposition', { text: '글', selectionStart: 1, selectionEnd: 1 });
  await shot(page, 'A19-ime2', '');
  await cdp.send('Input.insertText', { text: '글' });
  await page.getByTestId('note-input').fill('가'.repeat(140));
  await page.getByTestId('note-input').focus();
  await page.keyboard.press('End');
  await cdp.send('Input.imeSetComposition', { text: '한', selectionStart: 1, selectionEnd: 1 });
  await cdp.send('Input.insertText', { text: '한' });
  await sleep(250);
  await shot(page, 'A19-ime3', '');
  await page.getByTestId('note-input').fill('abcd');
  await page.getByTestId('note-input').evaluate((el) => { el.focus(); el.setSelectionRange(2, 2); });
  await page.keyboard.insertText('X​Y');
  await sleep(200);
  await shot(page, 'A19-caret', '');
  await ctx.close();
}
// B10a(일시정지 중 열기)·B10b(흐르는 인생 중간 진행률)·B10c(자동 카드 열린 동안)
{
  const { ctx, page } = await openSeeded(b, base);
  await openManual(page);
  await sleep(300);
  await shot(page, 'B10a', '');
  await ctx.close();
  const r2 = await openSeeded(b, { ...base, paused: false }, { settings: { ...SET_MANUAL, speed: 1 } });
  for (let i = 0; i < 80; i++) {
    const v = Number((await readCard(r2.page)).pct);
    if (v >= 40 && v <= 70) break;
    await sleep(100);
  }
  await r2.page.getByTestId('tool-note').tap();
  await sheetReady(r2.page);
  await sleep(600);
  await shot(r2.page, 'B10b', '');
  await r2.ctx.close();
  const r3 = await openSeeded(b, infantRun, { settings: { ...SET_MANUAL, speed: 8 }, wait: '[data-testid="note-sheet"]' });
  await sheetReady(r3.page);
  await sleep(3500);
  await shot(r3.page, 'B10c', '');
  await r3.ctx.close();
}
// R-G01~12: 저장 변조 뒤의 화면(첫 화면)
{
  const baseObj = { version: SAVE_VERSION, data: base };
  const TAM = [
    ['G01', 'not json {{{'], ['G02', ''], ['G03', JSON.stringify({ ...baseObj, version: 99 })], ['G04', JSON.stringify({ version: SAVE_VERSION, data: null })],
    ['G05', JSON.stringify({ version: SAVE_VERSION, data: { ...base, phase: 'zzz' } })], ['G06', JSON.stringify({ version: SAVE_VERSION, data: { ...base, age: -3 } })],
    ['G07', JSON.stringify({ version: SAVE_VERSION, data: { ...base, age: 1e9 } })], ['G08', JSON.stringify({ version: SAVE_VERSION, data: { ...base, character: { ...base.character, name: '<img src=x onerror=window.__xss=1>' } } })],
    ['G09', JSON.stringify({ version: SAVE_VERSION, data: { ...base, history: 'x' } })], ['G10', JSON.stringify({ version: SAVE_VERSION, data: { ...base, seen: [1, 2] } })],
    ['G11', JSON.stringify({ version: 4, data: base })], ['G12', JSON.stringify({ version: SAVE_VERSION, data: { ...base, rngState: 'x' } })],
  ];
  for (const [id, raw] of TAM) {
    const { ctx, page } = await openSeededRaw(b, raw);
    await shot(page, `R-${id}`, '');
    await ctx.close();
  }
}
// X-attr·X-ax-row·K03: 시트·기록 줄·확인 복귀
{
  const { ctx, page } = await openSeeded(b, base);
  await openManual(page);
  await page.getByTestId('note-input').focus();
  await page.keyboard.insertText('속성·낭독 시험 글');
  await shot(page, 'X-attr', '');
  await page.getByTestId('note-save').tap();
  await page.waitForSelector('[data-testid="note-sheet"]', { state: 'detached', timeout: 4000 });
  await sleep(400);
  await page.evaluate(() => { const rows = [...document.querySelectorAll('[data-testid="log-row"]')].filter((r) => r.querySelector('[data-testid="note-label"]')); rows[rows.length - 1].scrollIntoView({ block: 'center' }); });
  await shot(page, 'X-ax-row', '');
  await openManual(page);
  await page.getByTestId('note-input').focus();
  await page.keyboard.insertText('확인 복귀 시험');
  await page.getByTestId('note-skip').tap();
  await page.waitForSelector('[data-testid="note-confirm"]');
  await sleep(500);
  await page.keyboard.press('Escape');
  await sleep(300);
  await shot(page, 'K03', '');
  await ctx.close();
}
await b.close();
console.log('보충 스크린샷 완료');
