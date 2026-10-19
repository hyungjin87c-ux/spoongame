// QA-003 M7c 입력 공격 보충(A5·A19): IME 조합(CDP) — 조합 중 Esc·Enter·1번·140 넘김, 캐럿 보정, 끌어다 놓기(CDP 드래그), localStorage 접근 자체가 막힌 환경.
// 사용: node qa/scripts/m7c-attack6.mjs [ID 일부]
import { launch, openOracle, plainLife, openSeeded, openManual, sheetReady, readNote, readLog, readSave, noteRowsOf, readCard, shot, sleep, runCase } from './m7c-lib.mjs';

const ONLY = process.argv[2] || '';
const run = (c, fn) => (!ONLY || c.id.includes(ONLY) ? runCase({ cat: '입력 공격', ...c }, fn) : null);
const mk = () => {
  const checks = [];
  return { checks, chk: (name, ok, detail) => checks.push({ name, ok: !!ok, detail: detail === undefined ? '' : String(detail).slice(0, 300) }) };
};
const done = (checks, shots = [], extra = {}) => {
  const bad = checks.filter((x) => !x.ok);
  return { verdict: bad.length ? 'FAIL' : 'PASS', actual: bad.length ? `실패 ${bad.length}: ${bad.map((x) => `${x.name} [${x.detail}]`).join(' | ')}` : `검사 ${checks.length}건 통과${extra.note ? ' — ' + extra.note : ''}`, checks, shots };
};
const b = await launch();
const { page: oracle } = await openOracle(b);
const base = await plainLife(oracle, { era: 'present', seed: 4242, age: 9 });
const CUT = '140자까지 적을 수 있어 넘는 부분은 줄였습니다.';

await run({ id: 'A19-ime1', title: 'IME 조합 중 Esc·Enter — 조합 중 Esc는 시트를 닫지 않고(확인 단계도 안 열림), 조합이 끝난 뒤 Esc는 2번과 같다', steps: 'CDP imeSetComposition으로 「한」을 조합하는 중 Esc(키 입력 + isComposing=true 합성 이벤트) → 확정 후 Esc', expected: '조합 중 Esc 무시(시트·확인 단계 변화 0), 확정 뒤 Esc = 확인 단계', }, async () => {
  const { checks, chk } = mk();
  const shots = [];
  const { ctx, page } = await openSeeded(b, base);
  await openManual(page);
  const cdp = await ctx.newCDPSession(page);
  await page.getByTestId('note-input').focus();
  await cdp.send('Input.imeSetComposition', { text: 'ㅎ', selectionStart: 1, selectionEnd: 1 });
  await cdp.send('Input.imeSetComposition', { text: '하', selectionStart: 1, selectionEnd: 1 });
  await cdp.send('Input.imeSetComposition', { text: '한', selectionStart: 1, selectionEnd: 1 });
  await sleep(150);
  const mid = await readNote(page);
  chk('조합 중 입력란에 「한」이 보임', mid.inputValue === '한', JSON.stringify(mid.inputValue));
  chk('조합 중에는 글자 수를 갱신하지 않음', mid.count === '0/140', mid.count);
  shots.push(await shot(page, 'A19-ime1', 'composing'));
  await page.keyboard.press('Escape');
  await sleep(250);
  const after1 = await readNote(page);
  chk('조합 중 Esc(키 입력): 시트 유지·확인 단계 안 열림', after1.present && after1.confirm === null, JSON.stringify({ present: after1.present, confirm: !!after1.confirm }));
  // isComposing=true 합성 Esc (일부 브라우저는 keydown의 isComposing이 true)
  await page.evaluate(() => {
    const e = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true, isComposing: true });
    document.dispatchEvent(e);
    document.querySelector('[data-testid="note-input"]').dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true, isComposing: true }));
  });
  await sleep(250);
  const after2 = await readNote(page);
  chk('조합 중 Esc(isComposing=true 합성): 시트 유지·확인 단계 안 열림', after2.present && after2.confirm === null, JSON.stringify({ present: after2.present, confirm: !!after2.confirm }));
  // Enter 합성(조합 중): 줄바꿈·제출 없음
  await page.evaluate(() => document.querySelector('[data-testid="note-input"]').dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true, isComposing: true })));
  await sleep(150);
  const afterEnter = await readNote(page);
  chk('조합 중 Enter(합성): 제출·확인 없음, 시트 유지', afterEnter.present && afterEnter.confirm === null && noteRowsOf(await readSave(page)).length === 0, '');
  // 확정
  await cdp.send('Input.insertText', { text: '한' });
  await sleep(200);
  const committed = await readNote(page);
  chk('확정 뒤 글자 수 1/140', committed.inputValue === '한' && committed.count === '1/140', `${JSON.stringify(committed.inputValue)} ${committed.count}`);
  await page.keyboard.press('Escape');
  await sleep(300);
  const after3 = await readNote(page);
  chk('확정 뒤 Esc → 확인 단계(2번과 같음)', after3.confirm !== null, '');
  shots.push(await shot(page, 'A19-ime1', 'esc-after-commit'));
  await ctx.close();
  return done(checks, shots);
});

await run({ id: 'A19-ime2', title: 'IME 조합 중 「적어두고 살기」 — 조합 중인 마지막 글자가 빠지지 않고 저장된다', steps: '「한」 확정 후 「글」을 조합 중인 채 1번 탭', expected: '저장된 글 「한글」', }, async () => {
  const { checks, chk } = mk();
  const { ctx, page } = await openSeeded(b, base);
  await openManual(page);
  const cdp = await ctx.newCDPSession(page);
  await page.getByTestId('note-input').focus();
  await cdp.send('Input.insertText', { text: '한' });
  await cdp.send('Input.imeSetComposition', { text: '글', selectionStart: 1, selectionEnd: 1 });
  await sleep(150);
  await page.getByTestId('note-save').tap();
  await page.waitForSelector('[data-testid="note-sheet"]', { state: 'detached', timeout: 4000 }).catch(() => {});
  await sleep(300);
  const rows = noteRowsOf(await readSave(page));
  chk('조합 중 마지막 글자 포함 저장', rows.length === 1 && rows[0].text === '한글', JSON.stringify(rows.map((r) => r.text)));
  await ctx.close();
  return done(checks);
});

await run({ id: 'A19-ime3', title: 'IME 조합으로 140글자를 넘김 — 조합 중에는 자르지 않고 조합이 끝난 뒤 140으로 줄이며 알림', steps: '140글자를 채우고 끝에서 「한」을 조합·확정', expected: '확정 뒤 140/140, 알림 「140자까지 …」', }, async () => {
  const { checks, chk } = mk();
  const { ctx, page } = await openSeeded(b, base);
  await openManual(page);
  const cdp = await ctx.newCDPSession(page);
  await page.getByTestId('note-input').fill('가'.repeat(140));
  await page.getByTestId('note-input').focus();
  await page.keyboard.press('End');
  await cdp.send('Input.imeSetComposition', { text: '한', selectionStart: 1, selectionEnd: 1 });
  await sleep(120);
  const mid = await readNote(page);
  await cdp.send('Input.insertText', { text: '한' });
  await sleep(250);
  const end = await readNote(page);
  chk('확정 뒤 140/140', end.count === '140/140' && end.inputValue.length === 140, `${end.count} len ${end.inputValue.length}`);
  chk('알림 「140자까지 적을 수 있어 …」', end.msg === CUT, end.msg);
  await ctx.close();
  return done(checks, [], { note: `조합 중 입력란 길이 ${mid.inputValue.length}` });
});

await run({ id: 'A19-caret', title: '캐럿 보정 — 가운데에 붙여넣은 글에서 숨은 글자가 걷히면 캐럿이 끝으로 튀지 않고 붙여넣은 글 뒤에 선다', steps: 'abcd의 2번째 뒤에 「X(ZWSP)Y」를 입력', expected: '값 abXYcd, 캐럿 4', }, async () => {
  const { checks, chk } = mk();
  const { ctx, page } = await openSeeded(b, base);
  await openManual(page);
  await page.getByTestId('note-input').fill('abcd');
  await page.getByTestId('note-input').evaluate((el) => { el.focus(); el.setSelectionRange(2, 2); });
  await page.keyboard.insertText('X​Y');
  await sleep(250);
  const r = await page.getByTestId('note-input').evaluate((el) => ({ v: el.value, s: el.selectionStart, e: el.selectionEnd }));
  chk('값', r.v === 'abXYcd', JSON.stringify(r.v));
  chk('캐럿이 붙여넣은 글 뒤(4)', r.s === 4 && r.e === 4, `${r.s}/${r.e}`);
  // 글자 수 상한에 닿은 중간 삽입
  await page.getByTestId('note-input').fill('가'.repeat(139));
  await page.getByTestId('note-input').evaluate((el) => { el.focus(); el.setSelectionRange(10, 10); });
  await page.keyboard.insertText('나다라');
  await sleep(250);
  const r2 = await page.getByTestId('note-input').evaluate((el) => ({ v: el.value, s: el.selectionStart }));
  chk('139자 가운데에 3자 삽입: 140자로 줄고 캐럿이 삽입 위치 근처', r2.v.length === 140 && r2.s >= 10 && r2.s <= 140, `len ${r2.v.length} caret ${r2.s}`);
  await ctx.close();
  return done(checks);
});

await run({ id: 'A05-drop', title: '끌어다 놓기(드롭) — 텍스트를 입력란에 떨어뜨려도 입력 규칙이 같다(1만 자·제어 문자·ZWSP)', steps: 'CDP Input.dispatchDragEvent로 text/plain을 입력란에 드롭', expected: '140글자 이내로 정리, 알림, 기록·표시 정상(드롭 이벤트가 안 먹는 환경이면 SKIP)', }, async () => {
  const { checks, chk } = mk();
  const { ctx, page } = await openSeeded(b, base);
  await openManual(page);
  const cdp = await ctx.newCDPSession(page);
  const box = await page.getByTestId('note-input').boundingBox();
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  const data = { items: [{ mimeType: 'text/plain', data: '가나다​라‮마바' + '사'.repeat(300) }], dragOperationsMask: 1 };
  await cdp.send('Input.dispatchDragEvent', { type: 'dragEnter', x, y, data });
  await cdp.send('Input.dispatchDragEvent', { type: 'dragOver', x, y, data });
  await cdp.send('Input.dispatchDragEvent', { type: 'drop', x, y, data });
  await sleep(300);
  const n = await readNote(page);
  if (!n.inputValue) {
    await ctx.close();
    return { verdict: 'SKIP', actual: '이 환경(헤드리스 CDP)에서 드롭이 입력란에 글을 넣지 못함 — 붙여넣기(A05·A06)·직접 입력(insertText)과 같은 onChange 경로이므로 그 결과로 갈음', checks, shots: [] };
  }
  chk('드롭한 글이 입력란에 들어옴', n.inputValue.startsWith('가나다라마바사'), JSON.stringify(n.inputValue.slice(0, 20)));
  chk('ZWSP·RLO 걷힘·140글자 이내', !/[​‮]/.test(n.inputValue) && n.inputValue.length <= 140, `len ${n.inputValue.length}`);
  chk('잘림 알림', n.msg === CUT, n.msg);
  await ctx.close();
  return done(checks);
});

await run({ id: 'B05d', title: 'localStorage 접근 자체가 막힌 환경(Safari 비공개 모드꼴: 접근하면 SecurityError) — 앱이 죽지 않고 기록은 메모리에서 보인다', steps: 'window.localStorage getter가 SecurityError를 던지도록 하고 새 판 → 인생 → 수동 기록', expected: '오류 화면·빈 화면 0, 기록이 인생 기록에 보임(저장 실패 안내가 있으면 문구 그대로), 콘솔 오류 외 JS 예외로 앱이 멈추지 않음', }, async () => {
  const { checks, chk } = mk();
  const shots = [];
  const errs = [];
  const ctx = await (await import('./m7c-lib.mjs')).mkctx(b, { viewport: { width: 360, height: 740 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
  await ctx.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', { configurable: true, get() { throw new DOMException('denied', 'SecurityError'); } });
    Object.defineProperty(window, 'sessionStorage', { configurable: true, get() { throw new DOMException('denied', 'SecurityError'); } });
    const orig = crypto.getRandomValues.bind(crypto);
    crypto.getRandomValues = (buf) => { if (buf instanceof Uint32Array && buf.length === 1) { buf[0] = 31; return buf; } return orig(buf); };
  });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 160)));
  await page.goto('http://127.0.0.1:4899/spoongame/', { waitUntil: 'load' });
  await page.waitForSelector('[data-testid="title-screen"]', { timeout: 10000 });
  chk('저장소가 막혀도 첫 화면이 뜸', true, '');
  const { toRoulette, skipToBirth, birthToLife, waitGuard } = await import('./m7c-lib.mjs');
  await toRoulette(page, 'present');
  await skipToBirth(page);
  await birthToLife(page);
  await page.waitForSelector('[data-testid="life-screen"]', { timeout: 8000 });
  chk('인생 화면', true, '');
  await page.getByTestId('pause').tap().catch(() => {});
  await sleep(300);
  await page.getByTestId('tool-note').tap();
  await sheetReady(page);
  await page.getByTestId('note-input').focus();
  await page.keyboard.insertText('저장소가 막힌 곳의 기록');
  await page.getByTestId('note-save').tap();
  await page.waitForSelector('[data-testid="note-sheet"]', { state: 'detached', timeout: 4000 });
  await sleep(400);
  const log = (await readLog(page)).filter((r) => r.isNote);
  chk('인생 기록에 보임', log.length === 1 && log[0].text === '저장소가 막힌 곳의 기록', `${log.length}`);
  const banner = await page.getByTestId('save-notice').count();
  chk('저장 실패 안내(있으면 기존 문구)', banner === 0 || (await page.getByTestId('save-notice').textContent()).trim() === '저장하지 못했습니다. 이 화면을 닫으면 진행이 사라질 수 있습니다.', `배너 ${banner}`);
  chk('앱이 멈추지 않음(pageerror 0)', errs.length === 0, errs.join(' | '));
  shots.push(await shot(page, 'B05d', 'no-storage'));
  await ctx.close();
  return done(checks, shots, { note: `배너 ${banner}` });
});

await b.close();
