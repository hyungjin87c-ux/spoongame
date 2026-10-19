// QA-003 M7c 보충: ① 기록이 이미 40개일 때 자동 카드가 뜨면(40개 안내 시트) 「닫기」가 카드를 소비하고 새로고침해도 다시 안 뜨는가 ② 연표가 상한(300줄)에 닿았을 때 기록 줄이 먼저 버려지지 않는가 ③ 설정 noteCards 변조값.
// 사용: node qa/scripts/m7c-attack8.mjs [ID 일부]
import { launch, openOracle, plainLife, dueStateFor, evalCore, openSeeded, openSeededRaw, withNotes, sheetReady, readNote, readLog, readCard, readSave, noteRowsOf, shot, sleep, runCase, GAME_KEY, SETTINGS_KEY, SAVE_VERSION, PROD, mkctx, TOUCH } from './m7c-lib.mjs';

const ONLY = process.argv[2] || '';
const SKIP_IDS = (process.env.QA_SKIP || '').split(',').filter(Boolean); // 2회차: 기대가 바뀐 1회차 케이스(B07·B04c)는 2회차 전용 스크립트로 대체
const run = (c, fn) => (SKIP_IDS.includes(c.id) ? null : !ONLY || c.id.includes(ONLY) ? runCase({ cat: '동작 공격', ...c }, fn) : null);
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
const infant = await dueStateFor(oracle, 'note-infant-memory', { era: 'present', paused: true });

await run({ id: 'B04c', title: '기록이 이미 40개일 때 자동 카드(①)가 뜨면 40개 안내 시트(입력란 없음) — 「닫기」가 카드를 소비하고 새로고침해도 다시 안 뜬다', steps: '5세 ① 카드가 뜰 차례인 인생에 수동 기록 40개를 미리 쌓아 열고 닫기 → 새로고침', expected: '안내 시트·닫기만, 닫으면 seen 표시·기록 40줄 그대로, 새로고침 뒤 시트 없음', }, async () => {
  const { checks, chk } = mk();
  const shots = [];
  const st = await withNotes(oracle, infant, 40);
  const { ctx, page } = await openSeeded(b, st, { wait: '[data-testid="note-sheet"]' });
  await sheetReady(page);
  const n = await readNote(page);
  chk('자동 카드도 40개 안내(입력란 없음·닫기)', n.inputValue === null && n.limitClose && n.title === '이 인생에서 남길 수 있는 기록은 40개까지입니다.', JSON.stringify({ title: n.title, card: n.card, via: n.via }));
  shots.push(await shot(page, 'B04c', 'auto-limit'));
  await page.getByTestId('note-limit-close').tap();
  await page.waitForSelector('[data-testid="note-sheet"]', { state: 'detached', timeout: 3000 });
  await sleep(400);
  const sv = await readSave(page);
  chk('① 소비(seen)·기록 40줄 그대로', sv.data.seen['note-infant-memory'] !== undefined && noteRowsOf(sv).length === 40, JSON.stringify({ seen: sv.data.seen['note-infant-memory'], rows: noteRowsOf(sv).length }));
  await page.reload({ waitUntil: 'load' });
  await page.waitForSelector('[data-testid="life-screen"]', { timeout: 8000 });
  await sleep(500);
  chk('새로고침 뒤 시트 없음', !(await readNote(page)).present, '');
  await ctx.close();
  return done(checks, shots);
});

await run({ id: 'B17', title: '연표 상한(300줄)에 닿은 인생에서 기록 줄이 먼저 버려지지 않는다(note 행은 마지막에 버려짐) — 오라클 core로 상한까지 채운 상태에서 기록을 더하고 40개까지', steps: '연표 295줄을 만든 뒤 수동 기록 1~40건을 더하며 기록 줄 수·총 줄 수를 센다', expected: '기록 줄은 모두 남고(40건) 연표는 300줄 이하, 사건 줄이 대신 버려짐', }, async () => {
  const { checks, chk } = mk();
  const shots = [];
  const base = await plainLife(oracle, { era: 'present', seed: 4242, age: 9 });
  const r = await evalCore(
    oracle,
    `let g = arg.state;
     // 연표를 300에 가깝게 채운다(사건 줄 복제)
     const filler = [];
     for (let i = 0; i < 290; i++) filler.push({ age: Math.min(g.age, 9), kind: 'event', title: '채움 ' + i, text: '채움 줄 ' + i });
     g = { ...g, history: [...g.history, ...filler] };
     const before = g.history.length;
     let notes = 0;
     for (let i = 0; i < 40; i++) { const w = core.writeNote(g, { cardId: null, text: '상한 시험 ' + (i + 1) }); if (w === g) break; g = w; notes++; }
     const rows = g.history.filter((h) => h.kind === 'note').length;
     const kinds = {};
     for (const h of g.history) kinds[h.kind] = (kinds[h.kind] || 0) + 1;
     return { before, total: g.history.length, notes, rows, kinds, firstNote: g.history.findIndex((h) => h.kind === 'note'), state: g };`,
    { state: base },
  );
  chk('연표 상한 이하', r.total <= 300, `${r.before}→${r.total}`);
  chk('기록 40건 모두 남음', r.notes === 40 && r.rows === 40, JSON.stringify({ notes: r.notes, rows: r.rows }));
  chk('버려진 것은 사건 줄(기록 줄 아님)', r.kinds.note === 40, JSON.stringify(r.kinds));
  const { ctx, page } = await openSeeded(b, r.state);
  await sleep(400);
  const log = (await readLog(page)).filter((x) => x.isNote);
  chk('prod에서 열면 기록 40줄이 인생 기록에 보임', log.length === 40, `${log.length}`);
  chk('prod에서 저장 유지(새로고침)', (await readCard(page)).screen === 'life-screen', '');
  await ctx.close();
  return done(checks, shots, { note: JSON.stringify(r.kinds) });
});

await run({ id: 'R-S02', title: '설정 변조: noteCards가 문자열·숫자·null이면 기본 true로 읽고 다른 설정은 유지', steps: '설정 v4에 noteCards: "no"·0·null·[]를 넣고 열어 자동 카드가 뜨는지', expected: '모두 기본값(true)이라 ① 카드가 뜸, 오류 0', }, async () => {
  const { checks, chk } = mk();
  for (const v of ['no', 0, null, [], 'false', {}]) {
    const ctx = await mkctx(b, { viewport: { width: 360, height: 740 }, ...TOUCH });
    await ctx.addInitScript(([k, s, sk, sv]) => { try { if (!sessionStorage.getItem('__s')) { localStorage.clear(); localStorage.setItem(k, s); localStorage.setItem(sk, sv); sessionStorage.setItem('__s', '1'); } } catch {} }, [GAME_KEY, JSON.stringify({ version: SAVE_VERSION, data: infant }), SETTINGS_KEY, JSON.stringify({ version: 4, data: { era: 'present', lifeLength: 'short30', bgm: { on: false, volume: 30 }, theme: 'system', speed: 1, autoMode: false, noteCards: v } })]);
    const page = await ctx.newPage();
    const errs = [];
    page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 100)));
    await page.goto(PROD, { waitUntil: 'load' });
    await page.waitForSelector('[data-testid="life-screen"], [data-testid="title-screen"], [data-testid="error-screen"]', { timeout: 10000 });
    await sleep(500);
    const n = await readNote(page);
    chk(`noteCards=${JSON.stringify(v)} → 기본 true(① 카드 뜸)·오류 0`, n.present && errs.length === 0, `${n.present} ${errs.join(',')}`);
    await ctx.close();
  }
  return done(checks);
});

await run({ id: 'R-dec-reload', title: '회귀(M7b): 결정 카드가 열린 채·접힌 채 새로고침 10번 — 같은 카드가 열린 채로 복원되고 선택은 한 번도 일어나지 않는다', steps: '결정 대기 저장(일시정지)에서 시트 열린 채 reload 10번, 접은 뒤 reload 10번', expected: '매번 같은 키의 시트, 선택 기록 수 불변', }, async () => {
  const { checks, chk } = mk();
  const { pendingState } = await import('./m7c-lib.mjs');
  const pend = await pendingState(oracle, { era: 'present', seed: 4242, minAge: 12, paused: true });
  const { ctx, page } = await openSeeded(b, pend, { wait: '[data-testid="choice-panel"]' });
  const key0 = (await readCard(page)).key;
  const picks0 = (await readSave(page)).data.history.filter((h) => h.kind === 'choice').length;
  let ok = true;
  for (let i = 0; i < 10; i++) {
    await page.reload({ waitUntil: 'load' });
    await page.waitForSelector('[data-testid="choice-panel"]', { timeout: 8000 }).catch(() => { ok = false; });
    const c = await readCard(page);
    if (c.key !== key0 || c.mode !== 'sheet') ok = false;
  }
  chk('열린 채 10회: 같은 키·시트', ok, '');
  await page.waitForFunction(() => { const bt = document.querySelector('[data-testid="decision-fold-btn"]'); return bt && bt.getAttribute('aria-disabled') !== 'true' && !bt.disabled; }, null, { timeout: 6000 });
  await page.getByTestId('decision-fold-btn').tap();
  await page.waitForSelector('[data-testid="decision-fold"]', { timeout: 3000 });
  ok = true;
  for (let i = 0; i < 10; i++) {
    await page.reload({ waitUntil: 'load' });
    await page.waitForSelector('[data-testid="choice-panel"]', { timeout: 8000 }).catch(() => { ok = false; });
    const c = await readCard(page);
    if (c.key !== key0 || c.mode !== 'sheet') ok = false;
  }
  chk('접은 뒤 10회: 열린 카드로 복원(접힘은 저장하지 않음)', ok, '');
  chk('선택은 한 번도 일어나지 않음', (await readSave(page)).data.history.filter((h) => h.kind === 'choice').length === picks0, '');
  await ctx.close();
  return done(checks);
});

await b.close();
