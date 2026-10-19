// QA-003 M7c 2회차 RECORD 재확인 (QA2-3): K03(확인에서 돌아가기 직후 Enter · 450ms 뒤 Tab→1번 Enter · 400ms 안의 1번 눌림) · U01(사용자 글 줄바꿈 화면) .
// 사용: node qa/scripts/m7c-r2-record.mjs [ID 일부]
import { launch, openOracle, plainLife, evalCore, openSeeded, openManual, sheetReady, readNote, readLog, readSave, noteRowsOf, shot, sleep, runCase, SET_MANUAL } from './m7c-r2-lib.mjs';

const ONLY = process.argv[2] || '';
const run = (c, fn) => (!ONLY || c.id.includes(ONLY) ? runCase({ cat: 'RECORD 재확인', ...c }, fn) : null);
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

async function toConfirm(page, text) {
  await openManual(page);
  await page.getByTestId('note-input').focus();
  await page.keyboard.insertText(text);
  await page.keyboard.press('Escape');
  await page.waitForSelector('[data-testid="note-confirm"]', { timeout: 3000 });
  await page.waitForFunction(() => { const bt = document.querySelector('[data-testid="note-confirm-back"]'); return bt && bt.getAttribute('aria-disabled') !== 'true'; }, null, { timeout: 4000 });
}

await run({ id: 'K03a', title: 'K03 확인에서 「돌아가서 이어 쓰기」 직후 곧바로 Enter — 포커스는 입력란이고 Enter는 줄바꿈이 된다(저장·버림 아님)', steps: '글 「가」 입력 → Esc → 확인 → 돌아가기 탭 → 30ms 뒤 Enter', expected: '활성 요소 = 입력란, 입력값 「가\\n」, 기록 0줄, 시트 그대로' }, async () => {
  const { checks, chk } = mk();
  const shots = [];
  const { ctx, page } = await openSeeded(b, base);
  await toConfirm(page, '가');
  await page.getByTestId('note-confirm-back').tap();
  await sleep(30);
  const act = await page.evaluate(() => document.activeElement?.getAttribute('data-testid'));
  await page.keyboard.press('Enter');
  await sleep(200);
  const n = await readNote(page);
  const rows = noteRowsOf(await readSave(page)).length;
  chk('돌아간 직후 포커스 = 입력란', act === 'note-input', act);
  chk('Enter가 줄바꿈이 됨(입력값 「가\\n」)', n.inputValue === '가\n', JSON.stringify(n.inputValue));
  chk('시트 그대로·확인 단계 아님·기록 0줄', n.present && n.confirm === null && rows === 0, JSON.stringify({ present: n.present, confirm: n.confirm, rows }));
  shots.push(await shot(page, 'K03a', 'after-enter'));
  await ctx.close();
  return done(checks, shots);
});

await run({ id: 'K03b', title: 'K03 돌아가기 450ms 뒤 Tab → 1번 Enter는 저장된다(가드가 계속 막지 않음)', steps: '글 입력 → Esc → 돌아가기 → 450ms 기다림 → Tab(입력란 → 1번) → Enter', expected: '1번에 포커스, Enter로 저장 1줄, 시트 닫힘' }, async () => {
  const { checks, chk } = mk();
  const shots = [];
  const { ctx, page } = await openSeeded(b, base);
  await toConfirm(page, '이어 쓴 글');
  await page.getByTestId('note-confirm-back').tap();
  await sleep(450);
  await page.keyboard.press('Tab');
  const act = await page.evaluate(() => document.activeElement?.getAttribute('data-testid'));
  await page.keyboard.press('Enter');
  await sleep(500);
  const n = await readNote(page);
  const rows = noteRowsOf(await readSave(page));
  chk('Tab 한 번에 1번(저장)에 포커스', act === 'note-save', act);
  chk('Enter로 저장 1줄·시트 닫힘', rows.length === 1 && rows[0].text === '이어 쓴 글' && !n.present, JSON.stringify({ rows, present: n.present }));
  shots.push(await shot(page, 'K03b', 'saved'));
  await ctx.close();
  return done(checks, shots);
});

await run({ id: 'K03c', title: 'K03 돌아가기 직후 400ms 안의 1번 눌림은 저장 0(새로 만들어진 버튼의 마운트 가드 — 더블탭 보호)', steps: '글 입력 → Esc → 돌아가기 탭 → 150ms 뒤 1번 위치 탭', expected: '기록 0줄·시트 그대로(눌림 버림)' }, async () => {
  const { checks, chk } = mk();
  const shots = [];
  const { ctx, page } = await openSeeded(b, base);
  await toConfirm(page, '이어 쓴 글');
  await page.getByTestId('note-confirm-back').tap();
  await sleep(150);
  const bx = await page.getByTestId('note-save').boundingBox();
  const disabled = await page.getByTestId('note-save').getAttribute('aria-disabled');
  await page.touchscreen.tap(bx.x + bx.width / 2, bx.y + bx.height / 2);
  await sleep(250);
  const rows = noteRowsOf(await readSave(page)).length;
  const n = await readNote(page);
  chk(`가드 중 1번 눌림은 버려짐(aria-disabled=${disabled}) — 기록 ${rows}줄`, rows === 0 && n.present, JSON.stringify({ rows, present: n.present }));
  shots.push(await shot(page, 'K03c', 'guarded'));
  await sleep(500);
  await page.touchscreen.tap(bx.x + bx.width / 2, bx.y + bx.height / 2);
  await sleep(500);
  const rows2 = noteRowsOf(await readSave(page)).length;
  chk('가드가 풀린 뒤 같은 탭은 저장', rows2 === 1, rows2);
  await ctx.close();
  return done(checks, shots);
});

// U01: 사용자 글 줄바꿈(음절 단위) — 설계 의도, 화면 증거만 남김
await run({ id: 'U01', title: 'U01 사용자 글은 음절 단위로 줄바꿈된다(설계 의도 D4) — 화면 증거', steps: '평범한 한글 문장 3줄을 저장해 인생 기록 줄(폭 360·320)을 본다', expected: '(참고) 낱말 가운데서 끊길 수 있음, 가로 넘침 0' }, async () => {
  const { ctx, page } = await openSeeded(b, base, { vp: { width: 320, height: 568 } });
  await openManual(page);
  await page.getByTestId('note-input').focus();
  await page.keyboard.insertText('오늘은 비가 와서 우산도 없이 한참을 처마 밑에 서 있었다.\n그래도 그날의 공기는 이상하게 따뜻했다.');
  await page.getByTestId('note-save').tap();
  await sleep(600);
  const rows = await readLog(page);
  const last = rows.filter((r) => r.isNote).pop();
  const over = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  const s = await shot(page, 'U01', 'log-row');
  await ctx.close();
  return { verdict: over ? 'FAIL' : 'RECORD', actual: `(설계 수용) 인생 기록의 나의 기록 줄 폭 ${last ? last.rect.w : '?'}px, 가로 넘침 ${over ? '있음' : '0'}. 낱말 가운데 줄바꿈 허용은 D4 설계 의도`, shots: [s] };
});

await b.close();
