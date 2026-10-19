// QA-003 M7c 2회차 키보드 가드 (G7): 시트를 키보드로 닫은 직후 포커스가 가는 「생각 남기기」 버튼이 키 반복·재입력으로 곧바로 다시 열리지 않는다(400ms),
// 포커스는 그대로 그 버튼에 남고(Tab 순서 불변), 400ms 뒤 Enter/Space는 열린다. Esc 연타·Enter 반복·Space 반복.
// 사용: node qa/scripts/m7c-r2-keys.mjs
import { launch, openOracle, plainLife, dueStateFor, openSeeded, sheetReady, readNote, readSave, noteRowsOf, shot, sleep, runCase } from './m7c-r2-lib.mjs';

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
const infant = await dueStateFor(oracle, 'note-infant-memory', { era: 'present', paused: true });

const sheets = (page) => page.evaluate(() => document.querySelectorAll('[data-testid="note-sheet"]').length);
const act = (page) => page.evaluate(() => document.activeElement?.getAttribute('data-testid') || document.activeElement?.tagName);

async function openByKey(page) {
  await page.waitForFunction(() => { const t = document.querySelector('[data-testid="tool-note"]'); return t && t.getAttribute('aria-disabled') !== 'true'; }, null, { timeout: 6000 });
  await page.getByTestId('tool-note').focus();
  await page.keyboard.press('Enter');
  await sheetReady(page);
}

for (const KEY of ['Enter', 'Space']) {
  await runCase({ id: `G-keys-${KEY}`, cat: '입력 가드(2회차)', title: `키보드 ${KEY} — 1번을 ${KEY}로 눌러 닫은 직후 키를 계속 누르고(반복) 있어도 400ms 안에는 「생각 남기기」가 다시 열리지 않는다`, steps: `수동 시트: 글 입력 → Tab으로 1번 → ${KEY} 누른 채 30ms 간격 반복 입력 360ms → 뗌 → 500ms 뒤 ${KEY}`, expected: '시트 0·기록 1줄·포커스 = 「생각 남기기」 버튼(aria-disabled), 400ms 뒤 같은 키는 열림' }, async () => {
    const { checks, chk } = mk();
    const shots = [];
    const { ctx, page } = await openSeeded(b, base);
    await openByKey(page);
    await page.getByTestId('note-input').focus();
    await page.keyboard.insertText('키보드 가드');
    await page.keyboard.press('Tab');
    chk('Tab 한 번에 1번에 포커스', (await act(page)) === 'note-save', await act(page));
    const code = KEY === 'Space' ? ' ' : 'Enter';
    // Enter는 keydown에서, Space는 keyup에서 클릭이 일어난다 — 누르고 있는 동안 반복 keydown을 보낸다
    await page.keyboard.down(code);
    if (KEY === 'Space') await page.keyboard.up(code);
    const t0 = Date.now();
    let maxSheets = 0;
    let a1 = null;
    let dis = null;
    let rowsNow = null;
    let reopenCount = 0;
    while (Date.now() - t0 < 360) {
      await page.keyboard.down(code); // 반복 입력(repeat)
      if (KEY === 'Space') await page.keyboard.up(code);
      const c = await sheets(page);
      maxSheets = Math.max(maxSheets, c);
      if (c === 0 && a1 === null) {
        // 닫힌 직후 첫 관찰(가드 400ms 안): 포커스와 aria-disabled
        a1 = await act(page);
        dis = await page.getByTestId('tool-note').getAttribute('aria-disabled');
        rowsNow = noteRowsOf(await readSave(page)).length;
      }
      if (c > 0 && a1 !== null) reopenCount++;
      await sleep(30);
    }
    if (KEY !== 'Space') await page.keyboard.up(code);
    chk('저장 1줄', rowsNow === 1, rowsNow);
    chk(`닫힌 뒤 360ms 동안 시트가 다시 열리지 않음(닫힌 뒤 열린 관찰 ${reopenCount}회, 마지막 시트 수 ${await sheets(page)})`, reopenCount === 0 && (await sheets(page)) === 0, `reopen=${reopenCount} sheets=${await sheets(page)}`);
    chk('포커스가 「생각 남기기」 버튼에 있고 aria-disabled(가드)', a1 === 'tool-note' && dis === 'true', `${a1}/${dis}`);
    shots.push(await shot(page, `G-keys-${KEY}`, 'during'));
    await sleep(500);
    await page.keyboard.press(code === ' ' ? 'Space' : 'Enter');
    await sleep(300);
    chk('400ms 뒤 같은 키는 시트를 연다', (await sheets(page)) === 1, await sheets(page));
    await ctx.close();
    return done(checks, shots);
  });
}

await runCase({ id: 'G-keys-esc', cat: '입력 가드(2회차)', title: 'Esc 연타 — 글 없는 수동 시트에서 Esc를 닫히는 순간부터 계속 누르면 시트가 다시 열리거나 다른 컨트롤이 작동하지 않는다', steps: '수동 시트(글 없음) Esc 한 번(=2번) 뒤 30ms 간격으로 Esc 12번', expected: '시트 0, 기록 0줄, 나가기 확인 등 다른 대화상자 0' }, async () => {
  const { checks, chk } = mk();
  const { ctx, page } = await openSeeded(b, base);
  await openByKey(page);
  await page.keyboard.press('Escape');
  for (let i = 0; i < 12; i++) {
    await page.keyboard.press('Escape');
    await sleep(30);
  }
  await sleep(300);
  const st = await page.evaluate(() => ({ dialogs: document.querySelectorAll('[role="dialog"]').length, exit: !!document.querySelector('[data-testid="exit-ask"]') }));
  chk('시트·대화상자 0', st.dialogs === 0 && !st.exit, JSON.stringify(st));
  chk('기록 0줄', noteRowsOf(await readSave(page)).length === 0, noteRowsOf(await readSave(page)).length);
  await ctx.close();
  return done(checks, []);
});

await runCase({ id: 'G-keys-tab-order', cat: '입력 가드(2회차)', title: '가드 중에도 Tab 순서는 그대로이고 포커스가 가드된 버튼에서 사라지지 않는다 (G7)', steps: '1번 저장(Enter) 직후 Tab·Shift+Tab', expected: '포커스가 도구 줄 버튼들을 차례로 옮겨 다님, body로 떨어지지 않음' }, async () => {
  const { checks, chk } = mk();
  const { ctx, page } = await openSeeded(b, base);
  await openByKey(page);
  await page.getByTestId('note-input').focus();
  await page.keyboard.insertText('탭 순서');
  await page.keyboard.press('Tab');
  await page.keyboard.press('Enter');
  await sleep(80);
  const seq = [await act(page)];
  for (let i = 0; i < 3; i++) {
    await page.keyboard.press('Tab');
    seq.push(await act(page));
  }
  await page.keyboard.press('Shift+Tab');
  seq.push(await act(page));
  chk(`닫힌 직후 포커스 이동 ${seq.join(' → ')}`, seq[0] === 'tool-note' && !seq.includes('BODY'), seq.join(','));
  await ctx.close();
  return done(checks, []);
});

await b.close();
