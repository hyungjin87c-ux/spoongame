// QA-003 M7c 동작 공격(B계열): 새로고침 연타·뒤로가기·다중 탭·40개·저장 차단·탭 닫기·더블탭·연타·자동 모드·일시정지·나가기 확인·탭 가림·끄기/켜기·결정 카드 이음·저장 변조.
// 사용: node qa/scripts/m7c-attack2.mjs [케이스ID 일부]
import { launch, openOracle, plainLife, dueStateFor, openSeeded, openSeededRaw, pendingState, decisionBeforeDue, withNotes, openManual, sheetReady, readNote, readLog, readCard, readSave, noteRowsOf, shot, sleep, runCase, TOUCH, GAME_KEY, SETTINGS_KEY, SET_MANUAL, SET_AUTO, SET_OFF, PROD, DEV, SAVE_VERSION, settingsEnvelope, setRootFont } from './m7c-lib.mjs';

const ONLY = process.argv[2] || '';
const b = await launch();
const { page: oracle } = await openOracle(b);
const base = await plainLife(oracle, { era: 'present', seed: 4242, age: 9 });
const infant = await dueStateFor(oracle, 'note-infant-memory', { era: 'present', paused: true });
const infantRun = { ...infant, paused: false };

const mk = () => {
  const checks = [];
  const chk = (name, ok, detail) => checks.push({ name, ok: !!ok, detail: detail === undefined ? '' : String(detail).slice(0, 300) });
  return { checks, chk };
};
const done = (checks, shots = [], extra = {}) => {
  const bad = checks.filter((x) => !x.ok);
  return { verdict: bad.length ? 'FAIL' : 'PASS', actual: bad.length ? `실패 ${bad.length}: ${bad.map((x) => `${x.name} [${x.detail}]`).join(' | ')}` : `검사 ${checks.length}건 통과${extra.note ? ' — ' + extra.note : ''}`, checks, shots, ...extra.rec };
};
const SKIP_IDS = (process.env.QA_SKIP || '').split(',').filter(Boolean); // 2회차: 기대가 바뀐 1회차 케이스(B07·B04c)는 2회차 전용 스크립트로 대체
const run = (c, fn) => (SKIP_IDS.includes(c.id) ? null : !ONLY || c.id.includes(ONLY) ? runCase({ cat: '동작 공격', ...c }, fn) : null);
const rowsOf = async (page) => noteRowsOf(await readSave(page));
const tapAt = (page, x, y) => page.touchscreen.tap(x, y);
const center = (r) => [r.x + r.w / 2, r.y + r.h / 2];

// ------------------------------------------------------------------ B01 시트 열린 채 새로고침 연타
await run({ id: 'B01a', title: '자동 카드 시트가 열린 채 새로고침 12번(느리게) — 같은 카드가 다시 뜨고 글은 사라지고 저장은 그대로', steps: '5세 ① 카드 시트에 글을 쓴 채 새로고침 12번', expected: '매번 같은 카드·빈 입력란·기록 0·저장 유지, 오류 0' }, async () => {
  const { checks, chk } = mk();
  const shots = [];
  const { ctx, page } = await openSeeded(b, infant, { wait: '[data-testid="note-sheet"]' });
  const seenBefore = JSON.stringify(Object.keys((await readSave(page)).data.seen).sort());
  let allSame = true;
  for (let i = 0; i < 12; i++) {
    await sheetReady(page);
    await page.keyboard.insertText('쓰다 만 글 ' + i).catch(() => {});
    await page.getByTestId('note-input').focus().catch(() => {});
    await page.keyboard.insertText('쓰다 만 글 ' + i);
    await page.reload({ waitUntil: 'load' });
    await page.waitForSelector('[data-testid="note-sheet"]', { timeout: 10000 }).catch(() => {});
    await sleep(150);
    const n = await readNote(page);
    const sv = await readSave(page);
    const ok = n.present && n.card === 'note-infant-memory' && n.inputValue === '' && sv && noteRowsOf(sv).length === 0 && JSON.stringify(Object.keys(sv.data.seen).sort()) === seenBefore;
    if (!ok) {
      allSame = false;
      chk(`새로고침 ${i + 1}회째`, false, JSON.stringify({ present: n.present, card: n.card, val: n.inputValue, rows: sv ? noteRowsOf(sv).length : 'nosave' }));
    }
  }
  chk('12회 모두 같은 카드·빈 입력란·기록 0·seen 같음', allSame, '');
  shots.push(await shot(page, 'B01a', 'after-12-reloads'));
  await sheetReady(page);
  await page.getByTestId('note-input').focus();
  await page.keyboard.insertText('연타 뒤 마지막 글');
  await page.getByTestId('note-save').tap();
  await page.waitForSelector('[data-testid="note-sheet"]', { state: 'detached', timeout: 5000 });
  await sleep(300);
  chk('저장 1줄', (await rowsOf(page)).length === 1, '');
  await ctx.close();
  return done(checks, shots);
});

await run({ id: 'B01b', title: '새로고침 연타(커밋만 기다리고 바로 다음 새로고침) 15번 — 저장 파손·중복 0', steps: 'reload(waitUntil=commit) 15번 연속', expected: '마지막에 정상 화면, 저장 1벌·기록 0' }, async () => {
  const { checks, chk } = mk();
  const { ctx, page } = await openSeeded(b, infant, { wait: '[data-testid="note-sheet"]' });
  for (let i = 0; i < 15; i++) await page.reload({ waitUntil: 'commit' }).catch(() => {});
  await page.waitForLoadState('load').catch(() => {});
  await page.waitForSelector('[data-testid="note-sheet"]', { timeout: 15000 }).catch(() => {});
  await sleep(400);
  const n = await readNote(page);
  const sv = await readSave(page);
  chk('같은 카드가 다시 뜸', n.present && n.card === 'note-infant-memory', n.card);
  chk('저장이 사라지지 않음·기록 0', sv && sv.data.phase === 'life' && noteRowsOf(sv).length === 0, sv ? sv.data.phase : 'nosave');
  await ctx.close();
  return done(checks);
});

await run({ id: 'B01c', title: '수동 시트가 열린 채 새로고침 12번 — 닫히고 글은 사라지고 일시정지는 그대로', steps: '수동 시트를 열고 글을 쓴 채 새로고침 12번', expected: '시트 닫힘·기록 0·paused 유지' }, async () => {
  const { checks, chk } = mk();
  const shots = [];
  const { ctx, page } = await openSeeded(b, base);
  let ok = true;
  for (let i = 0; i < 12; i++) {
    await openManual(page);
    await page.getByTestId('note-input').focus();
    await page.keyboard.insertText('수동 쓰던 글 ' + i);
    await page.reload({ waitUntil: 'load' });
    await page.waitForSelector('[data-testid="life-screen"]', { timeout: 10000 });
    await sleep(200);
    const n = await readNote(page);
    const c = await readCard(page);
    const sv = await readSave(page);
    if (n.present || noteRowsOf(sv).length !== 0 || c.paused !== 'true') {
      ok = false;
      chk(`새로고침 ${i + 1}회째`, false, JSON.stringify({ present: n.present, rows: noteRowsOf(sv).length, paused: c.paused }));
    }
  }
  chk('12회 모두 시트 닫힘·기록 0·paused 유지', ok, '');
  shots.push(await shot(page, 'B01c', 'after'));
  await ctx.close();
  return done(checks, shots);
});

// ------------------------------------------------------------------ B02 뒤로가기
await run({ id: 'B02', title: '뒤로가기·앞으로가기 — 사이트를 벗어났다 돌아오면 같은 카드가 뜬다(글은 사라짐), 저장 유지', steps: '자동 카드 시트에서 history.back → 앞으로 → 수동 시트에서도', expected: '돌아오면 같은 카드·기록 0·오류 0, 주소에 글 없음' }, async () => {
  const { checks, chk } = mk();
  const shots = [];
  const { ctx, page } = await openSeeded(b, infant, { wait: '[data-testid="note-sheet"]' });
  await page.keyboard.insertText('뒤로 가기 전에 쓴 글');
  const h0 = await page.evaluate(() => ({ len: history.length, url: location.href, state: JSON.stringify(history.state) }));
  chk('이 앱은 history 항목을 더하지 않는다', h0.len <= 2, JSON.stringify(h0));
  await page.goBack({ waitUntil: 'load' }).catch(() => {});
  await sleep(300);
  const away = page.url();
  await page.goForward({ waitUntil: 'load' }).catch(() => {});
  await page.waitForSelector('[data-testid="life-screen"]', { timeout: 10000 }).catch(() => {});
  await sleep(500);
  const n = await readNote(page);
  const sv = await readSave(page);
  chk('앞으로 가면 같은 카드', n.present && n.card === 'note-infant-memory', `${n.present} ${n.card} (away=${away.slice(0, 30)})`);
  chk('입력 글은 사라짐·기록 0', n.inputValue === '' && noteRowsOf(sv).length === 0, JSON.stringify(n.inputValue));
  chk('주소에 글 없음', !page.url().includes('%'), page.url());
  shots.push(await shot(page, 'B02', 'after-forward'));
  // 수동 시트: 열고 뒤로 → 앞으로
  await page.getByTestId('note-skip').tap();
  await page.waitForSelector('[data-testid="note-sheet"]', { state: 'detached', timeout: 4000 });
  await openManual(page);
  await page.keyboard.insertText('수동 글');
  await page.goBack({ waitUntil: 'load' }).catch(() => {});
  await sleep(200);
  await page.goForward({ waitUntil: 'load' }).catch(() => {});
  await page.waitForSelector('[data-testid="life-screen"]', { timeout: 10000 }).catch(() => {});
  await sleep(500);
  const n2 = await readNote(page);
  chk('수동 시트는 닫힌 채 돌아온다', !n2.present, `present=${n2.present}`);
  await ctx.close();
  return done(checks, shots);
});

// ------------------------------------------------------------------ B03 다중 탭
await run({ id: 'B03', title: '다중 탭 중 입력 — 한 탭이 저장하면 다른 탭은 「밀린 화면」, 이어받으면 한쪽 기록만 남음', steps: '탭 A·B가 같은 저장을 열고 A가 글을 쓰던 중 B가 먼저 저장', expected: 'A는 밀린 화면, 저장은 B의 기록 1줄뿐(A의 쓰던 글이 섞이지 않음), 이어받기 뒤 정상', }, async () => {
  const { checks, chk } = mk();
  const shots = [];
  const { ctx, page: A } = await openSeeded(b, base, { localFlag: true });
  const B = await ctx.newPage();
  await B.goto(PROD, { waitUntil: 'load' });
  await B.waitForSelector('[data-testid="life-screen"]', { timeout: 10000 });
  await sleep(300);
  // A: 수동 시트 열고 글 쓰는 중
  await openManual(A);
  await A.getByTestId('note-input').focus();
  await A.keyboard.insertText('A 탭에서 쓰던 글');
  // B: 먼저 저장
  await B.bringToFront();
  await openManual(B);
  await B.getByTestId('note-input').focus();
  await B.keyboard.insertText('B 탭에서 먼저 저장한 글');
  await B.getByTestId('note-save').tap();
  await B.waitForSelector('[data-testid="note-sheet"]', { state: 'detached', timeout: 5000 });
  await sleep(600);
  await A.bringToFront();
  await sleep(500);
  const aScreen = (await readCard(A)).screen;
  chk('A 탭은 밀린 화면', aScreen === 'superseded-screen', aScreen);
  shots.push(await shot(A, 'B03', 'A-superseded'));
  const rows = await rowsOf(B);
  chk('저장에는 B의 기록 1줄뿐', rows.length === 1 && rows[0].text === 'B 탭에서 먼저 저장한 글', JSON.stringify(rows.map((r) => r.text)));
  // 이어받기
  await A.waitForFunction(() => { const bt = document.querySelector('[data-testid="take-over"]'); return bt && bt.getAttribute('aria-disabled') !== 'true' && !bt.disabled; }, null, { timeout: 5000 }).catch(() => {});
  await A.getByTestId('take-over').tap();
  await A.waitForSelector('[data-testid="life-screen"]', { timeout: 6000 }).catch(() => {});
  await sleep(500);
  const a2 = await readCard(A);
  const log = (await readLog(A)).filter((r) => r.isNote);
  chk('이어받은 A는 B의 기록을 보여 줌', a2.screen === 'life-screen' && log.length === 1 && log[0].text === 'B 탭에서 먼저 저장한 글', `${a2.screen} ${log.length}`);
  chk('A의 쓰던 글은 저장에 없음', !JSON.stringify(await readSave(A)).includes('A 탭에서 쓰던 글'), '');
  shots.push(await shot(A, 'B03', 'A-after-takeover'));
  await ctx.close();
  return done(checks, shots);
});

await run({ id: 'B03b', title: '다중 탭: 같은 자동 카드를 두 탭에서 열고 한쪽이 저장 — 다른 탭은 밀려서 같은 카드로 두 번 저장할 수 없다', steps: '① 카드 시트를 탭 A·B에 열고 A가 저장 → B에서 1번 시도', expected: 'B는 밀린 화면이라 저장 불가, 기록 1줄', }, async () => {
  const { checks, chk } = mk();
  const { ctx, page: A } = await openSeeded(b, infant, { wait: '[data-testid="note-sheet"]', localFlag: true });
  const B = await ctx.newPage();
  await B.goto(PROD, { waitUntil: 'load' });
  await B.waitForSelector('[data-testid="note-sheet"]', { timeout: 10000 });
  await sleep(500);
  await A.bringToFront();
  await sheetReady(A);
  await A.getByTestId('note-input').focus();
  await A.keyboard.insertText('A 탭 ① 기록');
  await A.getByTestId('note-save').tap();
  await A.waitForSelector('[data-testid="note-sheet"]', { state: 'detached', timeout: 5000 });
  await sleep(600);
  await B.bringToFront();
  await sleep(600);
  const bs = (await readCard(B)).screen;
  chk('B 탭은 밀린 화면(저장 불가)', bs === 'superseded-screen', bs);
  const rows = await rowsOf(A);
  chk('기록 1줄', rows.length === 1 && rows[0].eventId === 'note-infant-memory', JSON.stringify(rows.map((r) => r.eventId)));
  await ctx.close();
  return done(checks);
});

// ------------------------------------------------------------------ B04 40개
await run({ id: 'B04', title: '기록 40개 채우기(실제 입력 40번) → 41번째는 열어도 입력란 없이 안내만, 연타해도 41번째 줄 없음', steps: '수동 기록을 UI로 40번 쓰고 「생각 남기기」 연타', expected: '기록 40줄, 41번째 시트는 안내+닫기, 연타 후에도 40줄, 새로고침 뒤 40줄', }, async () => {
  const { checks, chk } = mk();
  const shots = [];
  const { ctx, page } = await openSeeded(b, base);
  const t0 = Date.now();
  for (let i = 1; i <= 40; i++) {
    await openManual(page);
    await page.getByTestId('note-input').focus();
    await page.keyboard.insertText(`열람 기록 ${i} — ${'가나다라마바사'.repeat(i % 5)}`);
    await page.getByTestId('note-save').tap();
    await page.waitForSelector('[data-testid="note-sheet"]', { state: 'detached', timeout: 5000 });
    await sleep(60);
  }
  const ms = Date.now() - t0;
  chk('40번 입력 완료', (await rowsOf(page)).length === 40, `rows ${(await rowsOf(page)).length}, ${ms}ms`);
  await page.getByTestId('tool-note').tap();
  await sheetReady(page);
  const n = await readNote(page);
  chk('41번째 시트: 입력란 없음·안내·닫기뿐', n.inputValue === null && n.title === '이 인생에서 남길 수 있는 기록은 40개까지입니다.' && n.limitSub !== null && n.limitClose, JSON.stringify({ title: n.title, sub: n.limitSub, input: n.inputValue }));
  shots.push(await shot(page, 'B04', 'limit-sheet'));
  await page.getByTestId('note-limit-close').tap();
  await page.waitForSelector('[data-testid="note-sheet"]', { state: 'detached', timeout: 3000 });
  await sleep(450);
  // 연타: 20번
  for (let i = 0; i < 20; i++) await page.getByTestId('tool-note').tap({ timeout: 800 }).catch(() => {});
  await sleep(300);
  chk('연타 뒤 시트 하나', (await readNote(page)).dialogCount === 1, `dialogs ${(await readNote(page)).dialogCount}`);
  await page.keyboard.press('Escape');
  await sleep(300);
  chk('41번째 줄 없음', (await rowsOf(page)).length === 40, `${(await rowsOf(page)).length}`);
  await page.reload({ waitUntil: 'load' });
  await page.waitForSelector('[data-testid="life-screen"]', { timeout: 10000 });
  await sleep(300);
  const log = (await readLog(page)).filter((r) => r.isNote);
  chk('새로고침 뒤 40줄', (await rowsOf(page)).length === 40 && log.length === 40, `${log.length}`);
  const sv = await readSave(page);
  const size = JSON.stringify(sv).length;
  chk('저장 크기(참고)', size < 300000, `${size} chars`);
  await page.evaluate(() => document.querySelector('[data-testid="log-list"]').scrollTo(0, 1e9));
  await sleep(200);
  shots.push(await shot(page, 'B04', 'log-40'));
  await ctx.close();
  return done(checks, shots);
});

await run({ id: 'B04b', title: '기록 39개에서 마지막 한 칸 — 더블탭·연타로 40번째를 두 번 만들 수 없고, 40개 시트는 compact·글자 200%에서도 닿는다', steps: '39개 상태에서 40번째 쓰고 1번 연타, 40개에서 320×568 글자 200%로 시트', expected: '40줄(41 아님), 안내와 닫기 버튼에 닿음', }, async () => {
  const { checks, chk } = mk();
  const shots = [];
  const st39 = await withNotes(oracle, base, 39);
  const { ctx, page } = await openSeeded(b, st39);
  await openManual(page);
  await page.getByTestId('note-input').focus();
  await page.keyboard.insertText('마지막 40번째');
  const r = await page.getByTestId('note-save').boundingBox();
  const [cx, cy] = [r.x + r.width / 2, r.y + r.height / 2];
  for (let i = 0; i < 6; i++) await tapAt(page, cx, cy);
  await sleep(500);
  chk('40줄(41 아님)', (await rowsOf(page)).length === 40, `${(await rowsOf(page)).length}`);
  await page.setViewportSize({ width: 320, height: 568 });
  await setRootFont(page, 200);
  await sleep(300);
  await page.getByTestId('tool-note').tap({ timeout: 3000 }).catch(() => {});
  await sleep(500);
  const n = await readNote(page);
  chk('40개 시트가 열림', n.present && n.limitClose, JSON.stringify({ present: n.present }));
  const reach = await page.evaluate(() => {
    const btn = document.querySelector('[data-testid="note-limit-close"]');
    const sheet = document.querySelector('[data-testid="note-sheet"]');
    if (!btn || !sheet) return null;
    btn.scrollIntoView({ block: 'nearest' });
    const r = btn.getBoundingClientRect();
    return { top: r.top, bottom: r.bottom, vh: window.innerHeight };
  });
  chk('닫기 버튼이 화면 안(스크롤로 닿음)', reach && reach.top >= 0 && reach.bottom <= reach.vh + 1, JSON.stringify(reach));
  shots.push(await shot(page, 'B04b', 'limit-320-200'));
  await ctx.close();
  return done(checks, shots);
});

// ------------------------------------------------------------------ B05 저장 차단·용량 초과
await run({ id: 'B05a', title: '저장 차단 ?__quota(개발 서버 탐침) — 기록은 메모리·인생 기록에 남고 저장 실패 배너, 새로고침하면 사라짐', steps: 'DEV ?__quota에서 수동 기록 1번', expected: '인생 기록에 줄 보임, save-notice 배너, 저장소에는 기록 없음', }, async () => {
  const { checks, chk } = mk();
  const shots = [];
  const { ctx, page } = await openSeeded(b, base, { base: DEV, query: '?__quota' });
  await openManual(page);
  await page.getByTestId('note-input').focus();
  await page.keyboard.insertText('저장이 막힌 곳에서 쓴 글');
  await page.getByTestId('note-save').tap();
  await page.waitForSelector('[data-testid="note-sheet"]', { state: 'detached', timeout: 5000 });
  await sleep(500);
  const log = (await readLog(page)).filter((r) => r.isNote);
  chk('인생 기록에 그대로 보임', log.length === 1 && log[0].text === '저장이 막힌 곳에서 쓴 글', `${log.length}`);
  const banner = await page.getByTestId('save-notice').textContent().catch(() => null);
  chk('저장 실패 배너(기존 문구)', banner && banner.trim() === '저장하지 못했습니다. 이 화면을 닫으면 진행이 사라질 수 있습니다.', banner);
  chk('저장소에는 기록 없음', (await rowsOf(page)).length === 0, '');
  shots.push(await shot(page, 'B05a', 'banner'));
  await page.reload({ waitUntil: 'load' });
  await page.waitForSelector('[data-testid="life-screen"]', { timeout: 10000 });
  await sleep(300);
  chk('새로고침 뒤 기록 없음(인생 저장은 시험 전 그대로 유지)', (await readLog(page)).filter((r) => r.isNote).length === 0, '');
  await ctx.close();
  return done(checks, shots);
});

const QUOTA_INIT = () => {
  window.__fail = false;
  window.__failBytes = Infinity;
  const orig = Storage.prototype.setItem;
  Storage.prototype.setItem = function (k, v) {
    if (this === window.localStorage && k === 'suzeo-game:save' && (window.__fail || String(v).length > window.__failBytes)) throw new DOMException('quota', 'QuotaExceededError');
    return orig.call(this, k, v);
  };
};
await run({ id: 'B05b', title: '저장 차단(prod, 쓰기만 실패) → 풀리면 다음 변화에 기록 둘 다 저장된다', steps: '기록1 저장 성공 → 쓰기 실패로 기록2 → 배너 → 실패 해제 후 기록3', expected: '실패 중 인생 기록에 보임·배너, 해제 뒤 저장소에 1·2·3 모두, 배너 사라짐', }, async () => {
  const { checks, chk } = mk();
  const shots = [];
  const { ctx, page } = await openSeeded(b, base, { init: QUOTA_INIT });
  const write = async (t) => {
    await openManual(page);
    await page.getByTestId('note-input').focus();
    await page.keyboard.insertText(t);
    await page.getByTestId('note-save').tap();
    await page.waitForSelector('[data-testid="note-sheet"]', { state: 'detached', timeout: 5000 });
    await sleep(400);
  };
  await write('기록 하나');
  chk('기록1 저장됨', (await rowsOf(page)).length === 1, '');
  await page.evaluate(() => (window.__fail = true));
  await write('기록 둘 — 저장 실패 중');
  const banner = await page.getByTestId('save-notice').count();
  chk('실패 중 배너', banner === 1, banner);
  chk('실패 중 인생 기록에 두 줄', (await readLog(page)).filter((r) => r.isNote).length === 2, '');
  chk('실패 중 저장소에는 1줄', (await rowsOf(page)).length === 1, '');
  shots.push(await shot(page, 'B05b', 'failing'));
  await page.evaluate(() => (window.__fail = false));
  await write('기록 셋 — 해제 뒤');
  const rows = await rowsOf(page);
  chk('해제 뒤 저장소에 세 줄', rows.length === 3 && rows[1].text.startsWith('기록 둘'), JSON.stringify(rows.map((r) => r.text)));
  chk('배너 사라짐', (await page.getByTestId('save-notice').count()) === 0, '');
  await ctx.close();
  return done(checks, shots);
});

await run({ id: 'B05c', title: '용량 초과(저장 값이 일정 크기를 넘으면 실패) — 140글자 기록을 쌓다가 한계에 닿아도 화면·저장이 깨지지 않는다', steps: '저장 한계 = 현재 저장 크기 + 약 330자로 두고 140글자 기록 3개', expected: '한계 뒤 배너·인생 기록에는 계속 보임·저장소는 한계 전 상태로 유효한 JSON', }, async () => {
  const { checks, chk } = mk();
  const shots = [];
  const { ctx, page } = await openSeeded(b, base, { init: QUOTA_INIT });
  const size0 = (await page.evaluate((k) => localStorage.getItem(k).length, GAME_KEY));
  await page.evaluate((n) => (window.__failBytes = n), size0 + 330);
  const long = (i) => `${i}번째 긴 기록: ` + '가나다라마바사아자차'.repeat(13);
  const results = [];
  for (let i = 1; i <= 3; i++) {
    await openManual(page);
    await page.getByTestId('note-input').focus();
    await page.keyboard.insertText(long(i));
    await page.getByTestId('note-save').tap();
    await page.waitForSelector('[data-testid="note-sheet"]', { state: 'detached', timeout: 5000 });
    await sleep(400);
    results.push({ i, rows: (await rowsOf(page)).length, banner: await page.getByTestId('save-notice').count(), logRows: (await readLog(page)).filter((r) => r.isNote).length });
  }
  chk('한계 안에서는 저장되고 넘으면 배너', results[0].banner === 0 && results[2].banner === 1, JSON.stringify(results));
  chk('인생 기록에는 3줄 모두', results[2].logRows === 3, JSON.stringify(results));
  const raw = await page.evaluate((k) => localStorage.getItem(k), GAME_KEY);
  let valid = true;
  try {
    JSON.parse(raw);
  } catch {
    valid = false;
  }
  chk('저장소는 유효한 JSON(반쯤 쓴 값 없음)', valid, '');
  shots.push(await shot(page, 'B05c', 'over-quota'));
  await page.evaluate(() => (window.__failBytes = Infinity));
  await page.reload({ waitUntil: 'load' });
  await page.waitForSelector('[data-testid="life-screen"]', { timeout: 10000 });
  await sleep(300);
  const after = (await rowsOf(page)).length;
  chk('새로고침 뒤 인생이 사라지지 않음(저장된 만큼 유지)', after >= 1 && after <= 3, `${after}줄`);
  await ctx.close();
  return done(checks, shots, { note: `새로고침 뒤 ${results.length ? '' : ''}` });
});

// ------------------------------------------------------------------ B06 1번 직후 탭 닫기
await run({ id: 'B06', title: '1번 직후 탭 닫기·떠나기 → 다시 열기 — 저장된 기록이 남는다(지연 0~200ms × 이탈 방식 3)', steps: '1번을 탭한 뒤 즉시 about:blank로 이동 / 새로고침 / 페이지 닫기', expected: '모든 시도에서 기록 1줄이 남거나(저장됨), 그렇지 않으면 인생 저장이 깨지지 않고 이전 상태(기록 0)', }, async () => {
  const { checks, chk } = mk();
  const out = [];
  for (const mode of ['blank', 'reload', 'close']) {
    for (const delay of [0, 5, 20, 60, 150]) {
      const { ctx, page } = await openSeeded(b, base, { localFlag: true });
      await openManual(page);
      await page.getByTestId('note-input').focus();
      await page.keyboard.insertText(`닫기 시험 ${mode}-${delay}`);
      const r = await page.getByTestId('note-save').boundingBox();
      const [cx, cy] = [r.x + r.width / 2, r.y + r.height / 2];
      await tapAt(page, cx, cy);
      if (delay) await sleep(delay);
      if (mode === 'blank') await page.goto('about:blank').catch(() => {});
      else if (mode === 'reload') await page.reload({ waitUntil: 'commit' }).catch(() => {});
      else await page.close({ runBeforeUnload: true }).catch(() => {});
      await sleep(250);
      const p2 = await ctx.newPage();
      await p2.goto(PROD, { waitUntil: 'load' });
      await p2.waitForSelector('[data-testid="life-screen"], [data-testid="title-screen"], [data-testid="error-screen"]', { timeout: 10000 }).catch(() => {});
      await sleep(300);
      const sv = await readSave(p2);
      const scr = (await readCard(p2)).screen;
      out.push({ mode, delay, rows: sv ? noteRowsOf(sv).length : -1, screen: scr });
      await ctx.close();
    }
  }
  const lost = out.filter((o) => o.rows === 0);
  const broken = out.filter((o) => o.screen !== 'life-screen' || o.rows < 0);
  chk('인생 저장이 사라지지 않음', broken.length === 0, JSON.stringify(broken));
  chk('1번 직후 이탈에서도 기록이 남음(저장 도달)', lost.length === 0, `기록이 남지 않은 시도 ${lost.length}/${out.length}: ${JSON.stringify(lost)}`);
  return done(checks, [], { rec: { table: out } });
});

// ------------------------------------------------------------------ B07 더블탭 직후 도구 줄 탭 (400ms 가드)
await run({ id: 'B07', title: '1번 더블탭 직후 도구 줄 위치 탭 — 400ms 가드가 둘째 입력·뒤이은 탭을 막는다', steps: '자동 ① 시트에서 1번 더블탭(60ms 간격) → 도구 줄 「생각 남기기」 위치를 닫힘 후 100·250·380·520ms에 탭', expected: '기록 1줄, 닫힘 400ms 안의 탭은 새 시트를 열지 않음(가드), 그 뒤 탭은 열림', }, async () => {
  const { checks, chk } = mk();
  const shots = [];
  const trials = [];
  for (const gap of [100, 250, 380, 520]) {
    const { ctx, page } = await openSeeded(b, infant, { wait: '[data-testid="note-sheet"]' });
    await sheetReady(page);
    await page.getByTestId('note-input').focus();
    await page.keyboard.insertText('더블탭 시험');
    const save = await page.getByTestId('note-save').boundingBox();
    const tool = await page.getByTestId('tool-note').boundingBox();
    const [sx, sy] = [save.x + save.width / 2, save.y + save.height / 2];
    const [tx, ty] = [tool.x + tool.width / 2, tool.y + tool.height / 2];
    await tapAt(page, sx, sy);
    await sleep(60);
    await tapAt(page, sx, sy);
    await sleep(gap);
    await tapAt(page, tx, ty);
    await sleep(500);
    const n = await readNote(page);
    const rows = await rowsOf(page);
    const dlg = n.present ? n.via : 'none';
    trials.push({ gap, rows: rows.length, sheetAfter: dlg });
    if (gap === 100) shots.push(await shot(page, 'B07', 'gap100'));
    await ctx.close();
  }
  chk('모든 시험에서 기록은 1줄', trials.every((t) => t.rows === 1), JSON.stringify(trials));
  const early = trials.filter((t) => t.gap < 400);
  chk('닫힘 400ms 안의 도구 줄 탭은 시트를 열지 않음', early.every((t) => t.sheetAfter === 'none'), JSON.stringify(early));
  const late = trials.find((t) => t.gap === 520);
  chk('400ms 뒤 탭은 열림(가드가 계속 막지 않음)', late && late.sheetAfter === 'manual', JSON.stringify(late));
  return done(checks, shots, { rec: { trials } });
});

// ------------------------------------------------------------------ B08 연타
await run({ id: 'B08', title: '「생각 남기기」 연타·1번 연타·2번 연타', steps: '도구 줄 버튼 연타 20번 → 시트 하나, 글 쓰고 1번 연타 12번 → 1줄, 글 쓰고 2번 연타 → 확인 한 번·글 지우고 담아 두기 연타 → 닫힘', expected: '시트 하나·기록 1줄·오류 0', }, async () => {
  const { checks, chk } = mk();
  const shots = [];
  const { ctx, page } = await openSeeded(b, base);
  const tool = await page.getByTestId('tool-note').boundingBox();
  const [tx, ty] = [tool.x + tool.width / 2, tool.y + tool.height / 2];
  for (let i = 0; i < 20; i++) await tapAt(page, tx, ty);
  await sleep(600);
  const n = await readNote(page);
  chk('시트는 하나', n.present && n.dialogCount === 1, `dialogs ${n.dialogCount}`);
  await sheetReady(page);
  await page.getByTestId('note-input').focus();
  await page.keyboard.insertText('연타 시험 글');
  const sv = await page.getByTestId('note-save').boundingBox();
  const [sx, sy] = [sv.x + sv.width / 2, sv.y + sv.height / 2];
  for (let i = 0; i < 12; i++) await tapAt(page, sx, sy);
  await sleep(600);
  chk('1번 연타 → 기록 1줄', (await rowsOf(page)).length === 1, `${(await rowsOf(page)).length}`);
  chk('연타 뒤 시트 닫힘', !(await readNote(page)).present, '');
  // 2번 연타
  await page.waitForTimeout(500);
  await openManual(page);
  await page.getByTestId('note-input').focus();
  await page.keyboard.insertText('버릴 글');
  const sk = await page.getByTestId('note-skip').boundingBox();
  const [kx, ky] = [sk.x + sk.width / 2, sk.y + sk.height / 2];
  for (let i = 0; i < 8; i++) await tapAt(page, kx, ky);
  await sleep(700);
  const n3 = await readNote(page);
  chk('2번 연타 → 확인 단계 하나만', n3.present && n3.confirm !== null, `confirm=${!!n3.confirm}`);
  shots.push(await shot(page, 'B08', 'confirm'));
  const dis = await page.getByTestId('note-confirm-discard').boundingBox();
  const [dx, dy] = [dis.x + dis.width / 2, dis.y + dis.height / 2];
  for (let i = 0; i < 8; i++) await tapAt(page, dx, dy);
  await sleep(700);
  chk('글 지우고 담아 두기 연타 → 닫힘·기록 그대로 1줄', !(await readNote(page)).present && (await rowsOf(page)).length === 1, '');
  await ctx.close();
  return done(checks, shots);
});

// ------------------------------------------------------------------ B09 자동 모드·결정 카드와 열기
const pend = await pendingState(oracle, { era: 'present', seed: 4242, minAge: 12, paused: false });
await run({ id: 'B09a', title: '수동 모드에서 결정 시트가 열려 있으면 도구 줄은 inert(「생각 남기기」를 누를 수 없다), 접은 띠에서는 열린다', steps: '결정 시트 열린 채 도구 줄 상태·탭, 접은 뒤 「생각 남기기」', expected: 'inert, 탭해도 기록 시트 안 열림 / 접은 뒤 열림, 결정 카드는 접힌 채 그대로, 닫아도 저절로 다시 열리지 않음', }, async () => {
  const { checks, chk } = mk();
  const shots = [];
  const { ctx, page } = await openSeeded(b, pend, { settings: SET_MANUAL });
  await page.waitForSelector('[data-testid="choice-panel"]', { timeout: 10000 });
  await sleep(600);
  const inert = await page.evaluate(() => {
    const t = document.querySelector('[data-testid="tool-note"]');
    return { inert: !!t.closest('[inert]'), ariaHidden: !!t.closest('[aria-hidden="true"]') };
  });
  chk('도구 줄이 inert', inert.inert, JSON.stringify(inert));
  const tool = await page.getByTestId('tool-note').boundingBox();
  await tapAt(page, tool.x + tool.width / 2, tool.y + tool.height / 2);
  await sleep(400);
  chk('결정 시트 열린 채 탭해도 기록 시트가 열리지 않음', !(await readNote(page)).present, '');
  // 접기
  await page.waitForFunction(() => {
    const bt = document.querySelector('[data-testid="decision-fold-btn"]');
    return bt && bt.getAttribute('aria-disabled') !== 'true' && !bt.disabled;
  }, null, { timeout: 5000 });
  await page.getByTestId('decision-fold-btn').tap();
  await page.waitForSelector('[data-testid="decision-fold"]', { timeout: 3000 });
  await sleep(300);
  await page.getByTestId('tool-note').tap();
  await sheetReady(page);
  const c1 = await readCard(page);
  chk('접은 띠에서 기록 시트가 열림', (await readNote(page)).present, '');
  shots.push(await shot(page, 'B09a', 'fold-then-note'));
  await page.getByTestId('note-skip').tap();
  await page.waitForSelector('[data-testid="note-sheet"]', { state: 'detached', timeout: 3000 });
  await sleep(900);
  const c2 = await readCard(page);
  chk('닫아도 결정 카드는 접힌 채(저절로 다시 열리지 않음)', c2.mode === 'fold', `mode=${c2.mode}`);
  chk('닫은 뒤 포커스는 「생각 남기기」 버튼', c2.activeTid === 'tool-note', c2.activeTid);
  await ctx.close();
  return done(checks, shots);
});

await run({ id: 'B09b', title: '자동 모드 + 결정 인라인 카드 + 「생각 남기기」 — 시트가 열린 동안 자동 선택이 멈추고 닫으면 다시 센다, 시트 열린 채 자동 모드 토글 불가', steps: '자동 모드에서 인라인 카드가 뜬 직후 「생각 남기기」 → 6초 대기 → 닫기 → 선택 대기', expected: '6초 동안 카드 그대로(자동 선택 없음), 닫은 뒤 약 3초 뒤 자동 선택, 열린 동안 「자동」 버튼은 inert', }, async () => {
  const { checks, chk } = mk();
  const shots = [];
  const { ctx, page } = await openSeeded(b, pend, { settings: SET_AUTO });
  await page.waitForSelector('[data-testid="choice-panel"]', { timeout: 10000 });
  const key0 = (await readCard(page)).key;
  await page.getByTestId('tool-note').tap({ timeout: 2000 }).catch(() => {});
  await sleep(500);
  let opened = (await readNote(page)).present;
  if (!opened) {
    // 자동 선택이 이미 지나갔을 수 있다 — 한 번 더 인라인 카드를 기다려 시도
    for (let k = 0; k < 20 && !opened; k++) {
      const c = await readCard(page);
      if (c.mode === 'inline') {
        await page.getByTestId('tool-note').tap({ timeout: 1500 }).catch(() => {});
        await sleep(400);
        opened = (await readNote(page)).present;
      } else await sleep(300);
    }
  }
  chk('인라인 카드가 떠 있는 동안 「생각 남기기」로 시트가 열림', opened, '');
  const keyNow = (await readCard(page)).key;
  await sleep(6000);
  const c2 = await readCard(page);
  chk('6초 동안 자동 선택 없음(카드 그대로)', c2.key === keyNow && c2.mode !== null, `${keyNow} → ${c2.key}`);
  const autoInert = await page.evaluate(() => {
    const a = document.querySelector('[data-testid="auto"]');
    return !!a.closest('[inert]');
  });
  chk('시트 열린 동안 「자동」 버튼 inert(토글 불가)', autoInert, '');
  const ap = await page.getByTestId('auto').boundingBox();
  const before = (await readCard(page)).auto;
  await tapAt(page, ap.x + ap.width / 2, ap.y + ap.height / 2);
  await sleep(300);
  chk('탭해도 자동 모드 그대로', (await readCard(page)).auto === before, `${before}`);
  shots.push(await shot(page, 'B09b', 'open-in-auto'));
  const tClose = Date.now();
  await page.getByTestId('note-skip').tap();
  await page.waitForSelector('[data-testid="note-sheet"]', { state: 'detached', timeout: 3000 });
  let dt = -1;
  for (let k = 0; k < 60; k++) {
    const c = await readCard(page);
    if (c.key !== keyNow) {
      dt = Date.now() - tClose;
      break;
    }
    await sleep(100);
  }
  chk('닫은 뒤 자동 선택 지연(약 3초, 1배속)', dt >= 2400 && dt <= 4500, `${dt}ms`);
  await ctx.close();
  return done(checks, shots);
});

// ------------------------------------------------------------------ B10 일시정지·정지 3초·진행률 되감김
await run({ id: 'B10a', title: '일시정지 중 열기 — 열 수 있고 닫아도 일시정지 유지', steps: '일시정지 상태(저장된 paused)에서 수동 기록 열기·저장·닫기', expected: 'paused 그대로, 진행률·나이 불변', }, async () => {
  const { checks, chk } = mk();
  const { ctx, page } = await openSeeded(b, base);
  const c0 = await readCard(page);
  await openManual(page);
  await page.getByTestId('note-input').focus();
  await page.keyboard.insertText('일시정지 중 기록');
  await page.getByTestId('note-save').tap();
  await page.waitForSelector('[data-testid="note-sheet"]', { state: 'detached', timeout: 4000 });
  await sleep(2500);
  const c1 = await readCard(page);
  chk('paused 유지', c0.paused === 'true' && c1.paused === 'true', `${c0.paused}→${c1.paused}`);
  chk('나이·진행률 불변', c0.age === c1.age && c0.pct === c1.pct, `${c0.age}/${c1.age} ${c0.pct}/${c1.pct}`);
  await ctx.close();
  return done(checks);
});

await run({ id: 'B10b', title: '시트 열린 동안 나이·진행률 3초(+) 정지, 저장해도 진행률이 0으로 되감기지 않는다(시계 resetKey)', steps: '흐르는 인생에서 진행률 약 50%에 수동 시트 열기 → 4초 → 저장 → 진행률', expected: '열린 동안 불변, 저장 뒤에도 50% 안팎에서 이어 흐름(0%로 돌아가지 않음)', }, async () => {
  const { checks, chk } = mk();
  const { ctx, page } = await openSeeded(b, { ...base, paused: false }, { settings: { ...SET_MANUAL, speed: 1 } });
  // 진행률 40~60%가 될 때까지
  let p0 = -1;
  for (let i = 0; i < 80; i++) {
    const c = await readCard(page);
    const v = Number(c.pct);
    if (v >= 40 && v <= 70) {
      p0 = v;
      break;
    }
    await sleep(100);
  }
  chk('진행률 40~70%에서 시작', p0 >= 40, `${p0}`);
  const age0 = (await readCard(page)).age;
  await page.getByTestId('tool-note').tap();
  await sheetReady(page);
  const pa = Number((await readCard(page)).pct);
  await sleep(4000);
  const pb = Number((await readCard(page)).pct);
  const ageB = (await readCard(page)).age;
  chk('열린 동안 진행률·나이 정지(4초)', pb === pa && ageB === age0, `${pa}→${pb}, 나이 ${age0}→${ageB}`);
  await page.getByTestId('note-input').focus();
  await page.keyboard.insertText('진행률 시험 기록');
  await page.getByTestId('note-save').tap();
  await page.waitForSelector('[data-testid="note-sheet"]', { state: 'detached', timeout: 4000 });
  await sleep(300);
  const pc = Number((await readCard(page)).pct);
  chk('저장 직후 진행률이 되감기지 않음', pc >= pa - 5, `${pa}→${pc}`);
  await sleep(1500);
  const pd = Number((await readCard(page)).pct);
  chk('이어서 흐름', pd >= pc || (await readCard(page)).age > age0, `${pc}→${pd}`);
  await ctx.close();
  return done(checks);
});

await run({ id: 'B10c', title: '자동 기록 카드 시트가 열린 동안 3초 나이·진행률·자동 선택 정지, 닫으면 해가 처음부터', steps: '5세 ① 카드(흐르는 인생)를 3.5초 열어 둠', expected: '나이 5 유지·진행률 0%, 닫으면 진행률이 흐름', }, async () => {
  const { checks, chk } = mk();
  const { ctx, page } = await openSeeded(b, infantRun, { settings: { ...SET_MANUAL, speed: 8 }, wait: '[data-testid="note-sheet"]' });
  await sheetReady(page);
  const c0 = await readCard(page);
  await sleep(3500);
  const c1 = await readCard(page);
  chk('3.5초 뒤 나이·진행률 불변', c0.age === c1.age && c0.pct === c1.pct, `${c0.age}/${c1.age} ${c0.pct}/${c1.pct}`);
  await page.getByTestId('note-skip').tap();
  await page.waitForSelector('[data-testid="note-sheet"]', { state: 'detached', timeout: 3000 });
  await sleep(1500);
  const c2 = await readCard(page);
  chk('닫으면 시계가 다시 흐름', c2.age > c1.age || Number(c2.pct) > Number(c1.pct), `${c1.age}/${c2.age} ${c1.pct}/${c2.pct}`);
  await ctx.close();
  return done(checks);
});

// ------------------------------------------------------------------ B11 나가기 확인과 동시
await run({ id: 'B11', title: '나가기 확인 단계와 「생각 남기기」 — 확인을 닫고 시트를 연다, 시트 열린 동안 「나가기」 불가', steps: '나가기 확인을 연 채 「생각 남기기」, 시트 열린 채 나가기 탭', expected: 'exit-ask 닫힘·시트 열림 / 시트 열린 동안 나가기 inert', }, async () => {
  const { checks, chk } = mk();
  const shots = [];
  const { ctx, page } = await openSeeded(b, base);
  await page.getByTestId('tool-exit').tap();
  await page.waitForSelector('[data-testid="exit-ask"]', { timeout: 3000 });
  await sleep(500);
  const exitBox = await page.getByTestId('exit-ask').boundingBox().catch(() => null);
  shots.push(await shot(page, 'B11', 'exit-ask'));
  const tool = await page.getByTestId('tool-note').boundingBox().catch(() => null);
  chk('나가기 확인 중에도 「생각 남기기」 버튼은 보이는 곳에 있음', !!tool, JSON.stringify(tool));
  if (tool) {
    await tapAt(page, tool.x + tool.width / 2, tool.y + tool.height / 2);
    await sleep(700);
  }
  const n = await readNote(page);
  const c = await readCard(page);
  chk('시트가 열리고 나가기 확인은 닫힘', n.present && !c.exitAsk, JSON.stringify({ present: n.present, exitAsk: c.exitAsk }));
  shots.push(await shot(page, 'B11', 'note-over-exit'));
  const exitInert = await page.evaluate(() => !!document.querySelector('[data-testid="tool-exit"]')?.closest('[inert]'));
  chk('시트 열린 동안 나가기 버튼 inert', exitInert, '');
  await ctx.close();
  return done(checks, shots);
});

// ------------------------------------------------------------------ B12 탭 가림 뒤 복귀
await run({ id: 'B12', title: '기록 시트가 열린 채 탭이 가려졌다 돌아옴 — 시트·글 그대로, 시계 정지', steps: '글을 쓴 채 visibilitychange hidden → 3초 → visible', expected: '시트 열린 채·글 그대로·나이 불변', }, async () => {
  const { checks, chk } = mk();
  const { ctx, page } = await openSeeded(b, infantRun, { settings: { ...SET_MANUAL, speed: 8 }, wait: '[data-testid="note-sheet"]' });
  await sheetReady(page);
  await page.getByTestId('note-input').focus();
  await page.keyboard.insertText('탭이 가려지기 전에 쓴 글');
  const a0 = (await readCard(page)).age;
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await sleep(3000);
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await sleep(800);
  const n = await readNote(page);
  chk('시트·글 그대로', n.present && n.inputValue === '탭이 가려지기 전에 쓴 글', JSON.stringify(n.inputValue));
  chk('나이 불변', (await readCard(page)).age === a0, '');
  await ctx.close();
  return done(checks);
});

// ------------------------------------------------------------------ B13 끄기/켜기
await run({ id: 'B13', title: '「저절로 뜨는 기록 카드 끄기/켜기」 — 시트·글 그대로, 설정 저장, 꺼진 동안 카드 소비, 켠 뒤 이후 카드부터', steps: '① 시트에서 글을 쓴 채 끄기 → 저장 → 인생을 건너뛰며 ②③ 소비 확인 → 수동 시트에서 켜기 → 이후 카드', expected: '끄기 뒤 시트·글 유지·알림, noteCards=false 저장, ②③은 seen만 남고 시트·줄 없음, 켠 뒤 ④가 뜸', }, async () => {
  const { checks, chk } = mk();
  const shots = [];
  const { ctx, page } = await openSeeded(b, infantRun, { settings: { ...SET_MANUAL, speed: 8 }, wait: '[data-testid="note-sheet"]' });
  await sheetReady(page);
  const n0 = await readNote(page);
  chk('처음 이름은 「끄기」', n0.toggle === '저절로 뜨는 기록 카드 끄기', n0.toggle);
  await page.getByTestId('note-input').focus();
  await page.keyboard.insertText('끄기 전에 쓰던 글');
  await page.getByTestId('note-cards-toggle').tap();
  await sleep(300);
  const n1 = await readNote(page);
  chk('끄기 뒤 시트·글 그대로', n1.present && n1.inputValue === '끄기 전에 쓰던 글', JSON.stringify(n1.inputValue));
  chk('이름이 「켜기」로', n1.toggle === '저절로 뜨는 기록 카드 켜기', n1.toggle);
  chk('알림 문장', n1.notice === '이제 기록 카드가 저절로 뜨지 않습니다. 「생각 남기기」로는 언제든 적을 수 있습니다.', n1.notice);
  shots.push(await shot(page, 'B13', 'off-in-sheet'));
  const st = await page.evaluate((k) => JSON.parse(localStorage.getItem(k)), SETTINGS_KEY);
  chk('설정 noteCards=false 저장', st && st.data && st.data.noteCards === false, JSON.stringify(st && st.data));
  chk('설정에 글 없음', !JSON.stringify(st).includes('끄기 전에'), '');
  await page.getByTestId('note-save').tap();
  await page.waitForSelector('[data-testid="note-sheet"]', { state: 'detached', timeout: 4000 });
  await sleep(300);
  chk('끄기 뒤 저장된 ① 글', (await rowsOf(page)).length === 1, '');
  // 인생을 건너뛰며 ② 이후 카드가 시트 없이 소비되는지
  let sawSheet = false;
  let reached = 0;
  for (let i = 0; i < 400; i++) {
    const c = await readCard(page);
    if (c.screen !== 'life-screen') break;
    if (c.noteSheet) {
      sawSheet = true;
      break;
    }
    reached = c.age;
    if (c.mode === 'sheet') {
      await page.waitForFunction(() => {
        const bt = document.querySelector('[data-testid="decision-fold-btn"]');
        return bt && bt.getAttribute('aria-disabled') !== 'true' && !bt.disabled;
      }, null, { timeout: 6000 }).catch(() => {});
      await sleep(200);
      await page.locator('.choice').first().tap().catch(() => {});
      await sleep(250);
      continue;
    }
    if (reached >= 19) break;
    if (c.skipDisabled !== 'true') await page.getByTestId('skip').tap().catch(() => {});
    await sleep(120);
  }
  chk('꺼진 동안 시트가 뜨지 않음(나이 19까지)', !sawSheet && reached >= 19, `age ${reached}, sheet ${sawSheet}`);
  const sv = await readSave(page);
  const seen = sv.data.seen;
  chk('② 소비 표시(seen)가 남고 연표 줄은 없음', seen['note-teen-envy'] !== undefined && noteRowsOf(sv).length === 1, JSON.stringify({ teen: seen['note-teen-envy'], love: seen['note-first-love'], rows: noteRowsOf(sv).length }));
  // 켜기: 수동 시트에서 (결정 시트가 열려 있으면 도구 줄이 inert라 먼저 결정을 고른다)
  for (let k = 0; k < 8; k++) {
    const c = await readCard(page);
    if (c.mode !== 'sheet') break;
    await page.waitForFunction(() => {
      const bt = document.querySelector('[data-testid="decision-fold-btn"]');
      return bt && bt.getAttribute('aria-disabled') !== 'true' && !bt.disabled;
    }, null, { timeout: 6000 }).catch(() => {});
    await sleep(200);
    await page.locator('.choice').first().tap().catch(() => {});
    await sleep(600);
  }
  await page.getByTestId('tool-note').tap();
  await sheetReady(page);
  const n2 = await readNote(page);
  chk('수동 시트에서도 이름은 「켜기」', n2.toggle === '저절로 뜨는 기록 카드 켜기', n2.toggle);
  await page.getByTestId('note-cards-toggle').tap();
  await sleep(250);
  const n3 = await readNote(page);
  chk('켜기 알림', n3.notice === '다음 기록 카드부터 다시 저절로 뜹니다.' && n3.toggle === '저절로 뜨는 기록 카드 끄기', JSON.stringify({ n: n3.notice, t: n3.toggle }));
  shots.push(await shot(page, 'B13', 'on-again'));
  await page.getByTestId('note-skip').tap();
  await page.waitForSelector('[data-testid="note-sheet"]', { state: 'detached', timeout: 3000 });
  // 이후 카드(④ 27~32세 등)가 시트로 뜬다
  let cardAfter = null;
  for (let i = 0; i < 500; i++) {
    const c = await readCard(page);
    if (c.screen !== 'life-screen') break;
    if (c.noteSheet) {
      cardAfter = (await readNote(page)).card;
      break;
    }
    if (c.mode === 'sheet') {
      await page.waitForFunction(() => {
        const bt = document.querySelector('[data-testid="decision-fold-btn"]');
        return bt && bt.getAttribute('aria-disabled') !== 'true' && !bt.disabled;
      }, null, { timeout: 6000 }).catch(() => {});
      await sleep(200);
      await page.locator('.choice').first().tap().catch(() => {});
      await sleep(250);
      continue;
    }
    if (c.skipDisabled !== 'true') await page.getByTestId('skip').tap().catch(() => {});
    await sleep(120);
  }
  chk('켠 뒤 이후 카드가 시트로 뜸', cardAfter !== null && cardAfter !== 'note-teen-envy', `${cardAfter}`);
  const sv2 = await readSave(page);
  chk('지나간 ②는 돌아오지 않음', cardAfter !== 'note-teen-envy' && cardAfter !== 'note-infant-memory', `${cardAfter}`);
  await ctx.close();
  return done(checks, shots, { note: `켠 뒤 처음 뜬 카드 ${cardAfter}` });
});

// ------------------------------------------------------------------ B14 자동 모드 소비
await run({ id: 'B14', title: '자동 모드에서는 시트가 한 번도 뜨지 않고 카드가 소비된다(연표 줄 0, seen 표시)', steps: '5세에서 자동 모드(8배속)로 끝까지', expected: '시트 0번, 기록 줄 0, seen에 note- 키들', }, async () => {
  const { checks, chk } = mk();
  const { ctx, page } = await openSeeded(b, infantRun, { settings: { ...SET_AUTO, speed: 8 }, wait: '[data-testid="life-screen"]' });
  await page.addInitScript(() => {});
  await page.evaluate(() => {
    window.__sheets = 0;
    new MutationObserver(() => {
      if (document.querySelector('[data-testid="note-sheet"]')) window.__sheets++;
    }).observe(document.body, { childList: true, subtree: true });
  });
  const t0 = Date.now();
  while (Date.now() - t0 < 5 * 60 * 1000) {
    const c = await readCard(page);
    if (c.screen === 'ending-screen') break;
    await sleep(500);
  }
  const sheets = await page.evaluate(() => window.__sheets);
  const sv = await readSave(page);
  const notes = Object.keys(sv.data.seen).filter((k) => k.startsWith('note-'));
  chk('인생이 끝까지 감(엔딩)', (await readCard(page)).screen === 'ending-screen', (await readCard(page)).screen);
  chk('기록 시트가 뜬 적 없음', sheets === 0, `${sheets}`);
  chk('기록 줄 0', noteRowsOf(sv).length === 0, '');
  chk('소비 표시가 남음(카드 종류)', notes.length >= 3, `${notes.length}종: ${notes.join(',')}`);
  await ctx.close();
  return done(checks, [], { rec: { consumed: notes } });
});

// ------------------------------------------------------------------ B15 결정 카드 → 기록 카드 이음
const dbd = await decisionBeforeDue(oracle, { era: 'present', paused: true });
await run({ id: 'B15', title: '결정 카드를 고르면 곧바로 다음 해의 기록 카드가 이어서 뜬다 — 동시에 열린 대화상자 0, 새 시트의 입력 가드 400ms(더블탭 둘째 입력이 떨어지지 않음), 포커스는 기록 시트 질문 제목', steps: '대기 중인 결정을 고른 직후 매 프레임 대화상자 수를 잰다. 선택 버튼을 더블탭(60ms)해 둘째 탭이 새 시트의 1번·2번에 떨어지게', expected: '대화상자 수 ≤1(모든 프레임), 기록 시트가 뜨고 둘째 탭이 저장·소비를 일으키지 않음, 포커스 note-title', }, async () => {
  const { checks, chk } = mk();
  const shots = [];
  if (!dbd) return { verdict: 'SKIP', actual: '상태를 찾지 못함', shots: [] };
  const { ctx, page } = await openSeeded(b, dbd.state, { settings: SET_MANUAL });
  await page.waitForSelector('[data-testid="choice-panel"]', { timeout: 10000 });
  await page.waitForFunction(() => {
    const bt = document.querySelector('[data-testid="decision-fold-btn"]');
    return bt && bt.getAttribute('aria-disabled') !== 'true' && !bt.disabled;
  }, null, { timeout: 6000 });
  await sleep(300);
  await page.evaluate(() => {
    window.__maxDlg = 0;
    window.__frames = 0;
    const tick = () => {
      const n = document.querySelectorAll('[role="dialog"]').length;
      if (n > window.__maxDlg) window.__maxDlg = n;
      window.__frames++;
      window.__raf = requestAnimationFrame(tick);
    };
    tick();
  });
  const choice = page.getByTestId(`choice-${dbd.choiceId}`);
  const box = await choice.boundingBox();
  const [cx, cy] = [box.x + box.width / 2, box.y + box.height / 2];
  await tapAt(page, cx, cy);
  await sleep(70);
  await tapAt(page, cx, cy); // 더블탭 둘째 — 새 기록 시트의 같은 자리에 떨어질 수 있다
  await sleep(1200);
  const n = await readNote(page);
  const max = await page.evaluate(() => ({ max: window.__maxDlg, frames: window.__frames }));
  chk('대화상자가 동시에 둘 열린 적 없음', max.max <= 1, JSON.stringify(max));
  chk('기록 시트가 이어서 뜸', n.present && n.card === dbd.cardId, `${n.card} (기대 ${dbd.cardId})`);
  chk('더블탭 둘째 입력이 시트를 닫지 않음(입력 가드)', n.present, '');
  chk('포커스는 기록 시트 질문 제목', n.activeTid === 'note-title', n.activeTid);
  chk('기록 아직 0·소비 안 됨', (await rowsOf(page)).length === 0 && !(await readSave(page)).data.seen[dbd.cardId], '');
  shots.push(await shot(page, 'B15', 'note-after-decision'));
  // 닫은 뒤 이어서 정상
  await page.getByTestId('note-skip').tap();
  await page.waitForSelector('[data-testid="note-sheet"]', { state: 'detached', timeout: 3000 });
  await sleep(500);
  chk('닫은 뒤 포커스는 인생 화면 제목', (await readCard(page)).activeTid === 'life-name', (await readCard(page)).activeTid);
  await ctx.close();
  return done(checks, shots);
});

// ------------------------------------------------------------------ B16 저장 변조 (기록 줄)
const baseRaw = JSON.stringify({ version: SAVE_VERSION, data: base });
const withNote = (over, extraHistory = []) => {
  const s = JSON.parse(baseRaw);
  s.data.history = [...s.data.history, { age: s.data.age, kind: 'note', title: '지금의 생각', text: '시험 글', eventId: 'note-manual', ...over }, ...extraHistory];
  return s;
};
const tamper = [
  ['T01', '기록 줄 text에 가족 그림 문자·국기·결합 문자·RTL(정상 글)', withNote({ text: '👨‍👩‍👧 🇰🇷 á שלום' }), { screen: 'life-screen', noteText: '👨‍👩‍👧 🇰🇷 á שלום' }],
  ['T02', '기록 줄 text에 RLO(U+202E)·ZWSP·널을 직접 심음 → 거부하지 않고 걷어 냄', withNote({ text: 'a‮b​c\u0000d' }), { screen: 'life-screen', noteText: 'abcd' }],
  ['T03', '기록 줄 text가 숫자 → 모양 위반(손상)', withNote({ text: 123 }), { screen: 'title-screen' }],
  ['T04', '기록 줄 text가 null → 손상', withNote({ text: null }), { screen: 'title-screen' }],
  ['T05', '기록 줄 text가 배열·객체 → 손상', withNote({ text: ['a'] }), { screen: 'title-screen' }],
  ['T06', '기록 줄 text 30,000자(변조) → 거부하지 않고 잘라서 연다', withNote({ text: '가'.repeat(30000) }), { screen: 'life-screen', noteMaxLen: 20000 }],
  ['T07', '기록 줄 text가 보이지 않는 글자뿐 → 그 줄만 버림', withNote({ text: '​‮\u0000' }), { screen: 'life-screen', noteRows: 0 }],
  ['T08', '기록 줄 title에 보이지 않는 글자(U+200B) → 기존 규칙대로 거부', withNote({ title: '지금​의 생각' }), { screen: 'title-screen' }],
  ['T09', '기록 줄 eventId가 note-로 시작하지 않는 문자열 / 없음', withNote({ eventId: 'weird-id' }), { screen: 'life-screen|title-screen' }],
  ['T10', '기록 줄 41개(상한 40 초과)', (() => { const s = JSON.parse(baseRaw); for (let i = 0; i < 41; i++) s.data.history.push({ age: s.data.age, kind: 'note', title: '지금의 생각', text: '기록 ' + i, eventId: 'note-manual' }); return s; })(), { screen: 'life-screen|title-screen' }],
  ['T11', '사망 원인에 가족 그림 문자 대신 ZWJ 심기 (이름·사망 원인은 기존 거부 그대로)', (() => { const s = JSON.parse(baseRaw); s.data.character.name = '김‍수호'; return s; })(), { screen: 'title-screen' }],
  ['T12', '이름에 U+3164만 (A12d: 이름 화이트리스트)', (() => { const s = JSON.parse(baseRaw); s.data.character.name = 'ㅤㅤ'; return s; })(), { screen: 'title-screen' }],
  ['T13', 'seen에 note- 키 이상값(나이 음수·문자열)', (() => { const s = JSON.parse(baseRaw); s.data.seen['note-x'] = -3; return s; })(), { screen: 'title-screen|life-screen' }],
  ['T14', '기록 줄의 kind를 알 수 없는 값으로', withNote({ kind: 'memo' }), { screen: 'title-screen' }],
];
for (const [id, title, obj, exp] of tamper) {
  await run({ id: `B16-${id}`, title: `저장 변조 ${id}: ${title}`, steps: '변조한 저장을 심고 앱을 연다', expected: JSON.stringify(exp) }, async () => {
    const { checks, chk } = mk();
    const shots = [];
    const { ctx, page } = await openSeededRaw(b, JSON.stringify(obj));
    const c = await readCard(page);
    const okScreens = exp.screen.split('|');
    chk('화면', okScreens.includes(c.screen), `${c.screen} (기대 ${exp.screen})`);
    if (c.screen === 'life-screen') {
      const log = (await readLog(page)).filter((r) => r.isNote);
      if (exp.noteText !== undefined) chk('표시 글', log.length >= 1 && log[log.length - 1].text === exp.noteText, JSON.stringify(log.map((r) => (r.text || '').slice(0, 40))));
      if (exp.noteMaxLen !== undefined) chk('잘린 길이', log.length >= 1 && log[log.length - 1].text.length === exp.noteMaxLen, `${log.length ? log[log.length - 1].text.length : 'none'}`);
      if (exp.noteRows !== undefined) chk('기록 줄 수', log.length === exp.noteRows, `${log.length}`);
      const lay = await page.evaluate(() => ({ docOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth }));
      chk('가로 넘침 0', !lay.docOverflow, JSON.stringify(lay));
      // 앱이 저장을 쓰고 나서도 JSON이 유효
      const raw = await page.evaluate((k) => localStorage.getItem(k), GAME_KEY);
      let valid = true;
      try {
        JSON.parse(raw);
      } catch {
        valid = false;
      }
      chk('저장 유효', valid, '');
    }
    shots.push(await shot(page, `B16-${id}`, 'opened'));
    await ctx.close();
    return done(checks, shots, { note: `화면 ${c.screen}` });
  });
}

await b.close();
