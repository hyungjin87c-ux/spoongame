// QA-003 M7c 회귀(prod, 360x740 터치): 첫 화면·룰렛·출생신고·대시보드(도구 줄·컨트롤·준비 중 문구 제거)·중대 결정 카드(M7b: 시트·접기·다시 열기·고르기·자동 인라인)·엔딩·나가기/이어서 살기·화면별 새로고침 연타·저장 변조(일반)·설정 v3→v4·옛 저장.
// 사용: node qa/scripts/m7c-regress.mjs [케이스ID 일부]
import { launch, openOracle, plainLife, pendingState, openSeeded, openSeededRaw, mkctx, fixSeed, cleanStorageOnce, openTitle, toRoulette, skipToBirth, birthToLife, waitGuard, sleep, shot, runCase, readCard, readNote, readLog, readSave, noteRowsOf, PROD, TOUCH, GAME_KEY, SETTINGS_KEY, SAVE_VERSION, SET_MANUAL, SET_AUTO, settingsEnvelope, setRootFont, readBirth } from './m7c-lib.mjs';

const ONLY = process.argv[2] || '';
const run = (c, fn) => (!ONLY || c.id.includes(ONLY) ? runCase({ cat: '회귀', ...c }, fn) : null);
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
const pend = await pendingState(oracle, { era: 'present', seed: 4242, minAge: 12, paused: false });
const newCtx = async (seed, vp = { width: 360, height: 740 }) => {
  const ctx = await mkctx(b, { viewport: vp, ...TOUCH });
  await cleanStorageOnce(ctx);
  await fixSeed(ctx, seed);
  return { ctx, page: await ctx.newPage() };
};
const scr = (page) => page.evaluate(() => ['title-screen', 'roulette-screen', 'birth-screen', 'life-screen', 'ending-screen', 'superseded-screen', 'error-screen'].find((id) => document.querySelector(`[data-testid="${id}"]`)) || (document.body.innerText.trim() === '' ? 'BLANK' : 'unknown'));

await run({ id: 'R01', title: '첫 화면: 로고·세상 3개·인생 길이 2개·태어나기·푸터 빌드 표기, index.html의 format-detection 메타(D7), 가로 넘침 0', steps: '새 저장소로 prod 첫 화면', expected: '구성이 이전과 같고 meta가 있음' }, async () => {
  const { checks, chk } = mk();
  const { ctx, page } = await newCtx(100);
  await openTitle(page, PROD);
  const t = await page.evaluate(() => ({
    eras: document.querySelectorAll('input[data-testid^="era-"]').length,
    lens: document.querySelectorAll('input[data-testid^="life-"]').length,
    begin: !!document.querySelector('[data-testid="start-birth"]'),
    build: (document.querySelector('[data-testid="build-version"]') || {}).textContent || '',
    meta: (document.querySelector('meta[name="format-detection"]') || {}).content || null,
    viewport: (document.querySelector('meta[name="viewport"]') || {}).content || null,
    overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    title: document.title,
  }));
  chk('세상 3개·인생 길이 2개·태어나기', t.eras === 3 && t.lens === 2 && t.begin, JSON.stringify({ eras: t.eras, lens: t.lens }));
  chk('푸터 빌드 표기', /^v\d+\.\d+\.\d+/.test(t.build.trim()), t.build.trim());
  chk('format-detection 메타(전화·날짜·주소·이메일 자동 링크 끔)', t.meta === 'telephone=no, date=no, address=no, email=no', t.meta);
  chk('가로 넘침 0', !t.overflow, '');
  const shots = [await shot(page, 'R01', 'title')];
  await ctx.close();
  return done(checks, shots, { note: `title 「${t.title}」` });
});

await run({ id: 'R02', title: '룰렛 → 출생신고 → 인생 시작(새 판): 룰렛 결과·출생신고 항목·인생 화면 진입, 도구 줄에 「준비 중」 문구 없음·「생각 남기기」는 보통 버튼', steps: '태어나기 → 룰렛 건너뛰기 → 출생신고 → 살아가기', expected: '각 화면이 열리고 인생 화면의 「생각 남기기」가 활성', }, async () => {
  const { checks, chk } = mk();
  const shots = [];
  const { ctx, page } = await newCtx(4321);
  await openTitle(page, PROD);
  await toRoulette(page, 'present');
  chk('룰렛 화면', (await scr(page)) === 'roulette-screen', await scr(page));
  shots.push(await shot(page, 'R02', 'roulette'));
  await skipToBirth(page);
  const bi = await readBirth(page);
  chk('출생신고: 이름·문장·또래 4명', !!bi.name && !!bi.sentence && bi.peers.length === 4, `${bi.name} peers ${bi.peers.length}`);
  shots.push(await shot(page, 'R02', 'birth'));
  await birthToLife(page);
  await sleep(500);
  const c = await readCard(page);
  chk('인생 화면', c.screen === 'life-screen', c.screen);
  chk('「생각 남기기」: 준비 중 아님·aria-disabled 없음', c.toolNoteText && !/준비 중/.test(c.toolNoteText) && c.toolNoteDisabled === null, JSON.stringify({ t: c.toolNoteText, d: c.toolNoteDisabled }));
  const body = await page.evaluate(() => document.body.innerText);
  chk('화면에 「준비 중」 0', !/준비 중/.test(body), '');
  shots.push(await shot(page, 'R02', 'life'));
  await ctx.close();
  return done(checks, shots);
});

await run({ id: 'R03', title: '대시보드 컨트롤: 일시정지/계속·배속 1·2·4·8·다음 결정으로·자동 모드·BGM·다크 모드·나가기 확인(예·아니오)·의견 보내기 링크', steps: '인생 화면에서 각 컨트롤을 한 번씩', expected: '이전과 같이 동작', }, async () => {
  const { checks, chk } = mk();
  const shots = [];
  const { ctx, page } = await openSeeded(b, { ...base, paused: false });
  const g = async (t) => { await page.waitForFunction((id) => { const e = document.querySelector(`[data-testid="${id}"]`); return e && e.getAttribute('aria-disabled') !== 'true' && !e.disabled; }, t, { timeout: 4000 }).catch(() => {}); };
  await sleep(500);
  await g('pause');
  await page.getByTestId('pause').tap();
  await sleep(200);
  chk('일시정지 켜짐', (await readCard(page)).paused === 'true', '');
  await page.getByTestId('pause').tap();
  await sleep(200);
  chk('계속(일시정지 풀림)', (await readCard(page)).paused === 'false', '');
  for (const sp of [2, 4, 8, 1]) {
    await page.locator(`[data-speed="${sp}"]`).tap();
    await sleep(120);
    chk(`배속 ${sp}`, (await page.evaluate(() => document.querySelector('[data-speed][aria-pressed="true"]').getAttribute('data-speed'))) === String(sp), '');
  }
  await g('tool-dark');
  const th0 = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
  await page.getByTestId('tool-dark').tap();
  await sleep(250);
  const th1 = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
  chk('다크 모드 전환', th0 !== th1, `${th0}→${th1}`);
  shots.push(await shot(page, 'R03', 'dark'));
  await page.getByTestId('tool-dark').tap();
  await sleep(250);
  await page.getByTestId('tool-exit').tap();
  await page.waitForSelector('[data-testid="exit-ask"]', { timeout: 3000 });
  await sleep(500);
  shots.push(await shot(page, 'R03', 'exit-ask'));
  await page.getByTestId('exit-no').tap();
  await sleep(300);
  chk('나가기 확인 → 아니오: 인생 화면 유지', (await scr(page)) === 'life-screen' && !(await readCard(page)).exitAsk, '');
  await page.getByTestId('tool-exit').tap();
  await page.waitForSelector('[data-testid="exit-ask"]', { timeout: 3000 });
  await sleep(500);
  await page.getByTestId('exit-yes').tap();
  await page.waitForSelector('[data-testid="title-screen"]', { timeout: 4000 });
  await sleep(300);
  chk('나가기 → 첫 화면(이어서 살기)', (await page.locator('[data-testid="resume"]').count()) === 1, '');
  shots.push(await shot(page, 'R03', 'title-resume'));
  await waitGuard(page, 'resume');
  await page.getByTestId('resume').tap();
  await page.waitForSelector('[data-testid="life-screen"]', { timeout: 4000 });
  chk('이어서 살기 → 인생 화면', true, '');
  const link = await page.evaluate(() => [...document.querySelectorAll('a')].filter((a) => /issues\/new/.test(a.href)).map((a) => a.href));
  chk('의견 보내기 링크', link.length === 1, link.join(','));
  await ctx.close();
  return done(checks, shots);
});

await run({ id: 'R04', title: '중대 결정 카드(M7b): 시트 → 접기 → 다시 열기 → 고르기, 접기·다시 열기 연타 20번, 선택지 연타, 자동 모드 인라인 카드와 자동 선택', steps: '결정 대기 저장을 열어 위 순서로', expected: 'M7b와 같이 동작(오류 0·카드 하나·선택은 한 번)', }, async () => {
  const { checks, chk } = mk();
  const shots = [];
  const { ctx, page } = await openSeeded(b, { ...pend, paused: true });
  await page.waitForSelector('[data-testid="choice-panel"]', { timeout: 10000 });
  await page.waitForFunction(() => { const bt = document.querySelector('[data-testid="decision-fold-btn"]'); return bt && bt.getAttribute('aria-disabled') !== 'true' && !bt.disabled; }, null, { timeout: 6000 });
  const c0 = await readCard(page);
  chk('결정 시트(모달)', c0.mode === 'sheet' && c0.choices.length >= 2 && c0.dialogCount === 1, JSON.stringify({ mode: c0.mode, n: c0.choices.length }));
  shots.push(await shot(page, 'R04', 'sheet'));
  await page.getByTestId('decision-fold-btn').tap();
  await page.waitForSelector('[data-testid="decision-fold"]', { timeout: 3000 });
  chk('접힌 띠', (await readCard(page)).mode === 'fold', '');
  shots.push(await shot(page, 'R04', 'fold'));
  // 접기·다시 열기 연타 20번
  for (let i = 0; i < 20; i++) {
    const r = page.getByTestId('decision-reopen');
    if (await r.count()) await r.tap({ timeout: 700 }).catch(() => {});
    const f = page.getByTestId('decision-fold-btn');
    if (await f.count()) await f.tap({ timeout: 700 }).catch(() => {});
    await sleep(60);
  }
  await sleep(600);
  const c1 = await readCard(page);
  chk('연타 뒤 카드 하나·같은 키', c1.dialogCount <= 1 && c1.key === c0.key, `dialogs ${c1.dialogCount} mode ${c1.mode}`);
  if (c1.mode === 'fold') {
    await page.waitForFunction(() => { const bt = document.querySelector('[data-testid="decision-reopen"]'); return bt && bt.getAttribute('aria-disabled') !== 'true' && !bt.disabled; }, null, { timeout: 4000 });
    await page.getByTestId('decision-reopen').tap();
    await page.waitForSelector('[data-testid="choice-panel"]', { timeout: 3000 });
  }
  await page.waitForFunction(() => { const bt = document.querySelector('[data-testid="decision-fold-btn"]'); return bt && bt.getAttribute('aria-disabled') !== 'true' && !bt.disabled; }, null, { timeout: 6000 }).catch(() => {});
  await sleep(300);
  const cc = await readCard(page);
  const ch = page.locator('.choice').first();
  const bx = await ch.boundingBox();
  const hist0 = (await readSave(page)).data.history.filter((h) => h.kind === 'choice').length;
  for (let i = 0; i < 6; i++) await page.touchscreen.tap(bx.x + bx.width / 2, bx.y + bx.height / 2);
  await sleep(900);
  const hist1 = (await readSave(page)).data.history.filter((h) => h.kind === 'choice').length;
  chk('선택지 연타 → 선택은 한 번', hist1 === hist0 + 1, `${hist0}→${hist1}`);
  await ctx.close();
  // 자동 모드: 인라인 카드 → 자동 선택
  const { ctx: c2, page: p2 } = await openSeeded(b, { ...pend, paused: false }, { settings: { ...SET_AUTO, speed: 8 } });
  let sawInline = false;
  for (let i = 0; i < 60; i++) {
    const c = await readCard(p2);
    if (c.mode === 'inline') { sawInline = true; break; }
    await sleep(100);
  }
  chk('자동 모드: 인라인 카드', sawInline, '');
  await c2.close();
  return done(checks, shots);
});

await run({ id: 'R05', title: '화면별 새로고침 연타 10번(첫 화면·룰렛·출생신고·인생·엔딩) — 같은 화면이 복원되고 저장이 깨지지 않는다', steps: '각 화면에서 reload 10번', expected: '같은 화면, 오류 0', }, async () => {
  const { checks, chk } = mk();
  const { ctx, page } = await newCtx(777);
  await openTitle(page, PROD);
  const seq = [['title-screen', null]];
  const reloadN = async (want) => {
    for (let i = 0; i < 10; i++) {
      await page.reload({ waitUntil: 'load' });
      await page.waitForSelector(`[data-testid="${want}"]`, { timeout: 8000 }).catch(() => {});
    }
    return scr(page);
  };
  chk('첫 화면 10회', (await reloadN('title-screen')) === 'title-screen', '');
  await toRoulette(page, 'present');
  chk('룰렛 10회', (await reloadN('roulette-screen')) === 'roulette-screen', await scr(page));
  await skipToBirth(page).catch(async () => { await page.getByTestId('to-birth').tap().catch(() => {}); });
  chk('출생신고 10회', (await reloadN('birth-screen')) === 'birth-screen', await scr(page));
  await birthToLife(page);
  chk('인생 10회', (await reloadN('life-screen')) === 'life-screen', await scr(page));
  await ctx.close();
  const ended = await (async () => {
    return null;
  })();
  return done(checks);
});

await run({ id: 'R06', title: '엔딩 새로고침 연타 10번 + 다시 태어나기 → 첫 화면(새 판 시작 가능)', steps: '엔딩 저장을 열어 reload 10번, 다시 태어나기, 태어나기', expected: '엔딩 복원, 다시 태어나기 뒤 첫 화면·새 판 진행 가능', }, async () => {
  const { checks, chk } = mk();
  const shots = [];
  const ended = await (await import('./m7c-lib.mjs')).evalCore(oracle, `let s = { ...arg.s, paused: false }; for (let g = 0; g < 2000 && s.phase === 'life'; g++) { if (s.pending !== null) { s = core.autoResolveStep(s, s.pending.key).state; continue; } const d = core.dueNote(s); if (d) s = core.consumeNote(s, d); s = core.stepYear(s).state; } return s;`, { s: base });
  const { ctx, page } = await openSeeded(b, ended, { wait: '[data-testid="ending-screen"]' });
  for (let i = 0; i < 10; i++) {
    await page.reload({ waitUntil: 'load' });
    await page.waitForSelector('[data-testid="ending-screen"]', { timeout: 8000 });
  }
  chk('엔딩 복원(10회)', (await scr(page)) === 'ending-screen', await scr(page));
  const e = await page.evaluate(() => ({ journey: !!document.querySelector('[data-testid="ending-journey"]'), tl: document.querySelectorAll('[data-testid="timeline-entry"]').length, reb: !!document.querySelector('[data-testid="rebirth"]'), overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth }));
  chk('엔딩 구성(출발선 막대·연표·다시 태어나기)·넘침 0', e.journey && e.tl > 5 && e.reb && !e.overflow, JSON.stringify(e));
  shots.push(await shot(page, 'R06', 'ending'));
  await page.waitForFunction(() => { const bt = document.querySelector('[data-testid="rebirth"]'); return bt && bt.getAttribute('aria-disabled') !== 'true' && !bt.disabled; }, null, { timeout: 5000 });
  await page.getByTestId('rebirth').tap();
  await page.waitForSelector('[data-testid="title-screen"]', { timeout: 5000 });
  chk('다시 태어나기 → 첫 화면', true, '');
  await waitGuard(page, 'start-birth');
  await page.getByTestId('start-birth').tap();
  await page.waitForSelector('[data-testid="roulette-screen"]', { timeout: 5000 });
  chk('새 판: 룰렛으로', true, '');
  await ctx.close();
  return done(checks, shots);
});

// ---- 저장 변조(일반): 이전 QA의 A12 계열 표본 — 어떤 변조든 빈 화면·잡히지 않은 오류 0
const baseObj = JSON.parse(JSON.stringify({ version: SAVE_VERSION, data: base }));
const TAM = [
  ['G01', '저장 원문이 JSON이 아님', 'not json {{{'],
  ['G02', '빈 문자열', ''],
  ['G03', '버전이 알 수 없는 값(99)', JSON.stringify({ ...baseObj, version: 99 })],
  ['G04', 'data가 null', JSON.stringify({ version: SAVE_VERSION, data: null })],
  ['G05', 'data.phase가 모르는 값', JSON.stringify({ version: SAVE_VERSION, data: { ...base, phase: 'zzz' } })],
  ['G06', '나이 −3', JSON.stringify({ version: SAVE_VERSION, data: { ...base, age: -3 } })],
  ['G07', '나이 1e9', JSON.stringify({ version: SAVE_VERSION, data: { ...base, age: 1e9 } })],
  ['G08', '이름이 HTML', JSON.stringify({ version: SAVE_VERSION, data: { ...base, character: { ...base.character, name: '<img src=x onerror=window.__xss=1>' } } })],
  ['G09', 'history가 문자열', JSON.stringify({ version: SAVE_VERSION, data: { ...base, history: 'x' } })],
  ['G10', 'seen이 배열', JSON.stringify({ version: SAVE_VERSION, data: { ...base, seen: [1, 2] } })],
  ['G11', '구버전(v4) 저장', JSON.stringify({ version: 4, data: base })],
  ['G12', 'rngState가 문자열', JSON.stringify({ version: SAVE_VERSION, data: { ...base, rngState: 'x' } })],
];
for (const [id, title, raw] of TAM) {
  await run({ id: `R-${id}`, title: `저장 변조 ${id}: ${title}`, steps: '변조한 저장 원문으로 prod를 연다', expected: '빈 화면·잡히지 않은 오류·스크립트 실행 0, 첫 화면 또는 정상 화면' }, async () => {
    const { checks, chk } = mk();
    const { ctx, page } = await openSeededRaw(b, raw);
    const s = await scr(page);
    chk('화면이 비어 있지 않음(첫 화면·인생·오류 안내 중 하나)', ['title-screen', 'life-screen', 'error-screen', 'ending-screen', 'birth-screen', 'roulette-screen'].includes(s), s);
    chk('스크립트 실행 0', (await page.evaluate(() => window.__xss)) === undefined, '');
    await ctx.close();
    return done(checks, [], { note: `화면 ${s}` });
  });
}

await run({ id: 'R-S01', title: '설정 v3(noteCards 없음) → 앱이 읽고 noteCards 기본 true로 시작, 이미 고른 설정(배속·테마)은 유지, 쓰면 v4로', steps: '설정 v3 원문을 심고 인생 화면을 열어 기록 시트가 저절로 뜨는지·저장된 설정 버전', expected: '배속·테마 유지, 자동 카드 뜸(noteCards 기본 true), 설정이 v4로 저장', }, async () => {
  const { checks, chk } = mk();
  const { page: or } = { page: oracle };
  const { evalCore } = await import('./m7c-lib.mjs');
  const infant = await (await import('./m7c-lib.mjs')).dueStateFor(oracle, 'note-infant-memory', { era: 'present', paused: true });
  const v3 = JSON.stringify({ version: 3, data: { era: 'present', lifeLength: 'short30', bgm: { on: false, volume: 30 }, theme: 'dark', speed: 4, autoMode: false } });
  const ctx = await mkctx(b, { viewport: { width: 360, height: 740 }, ...TOUCH });
  await ctx.addInitScript(([k, v, sk, sv]) => { try { if (!sessionStorage.getItem('__s')) { localStorage.clear(); localStorage.setItem(k, v); localStorage.setItem(sk, sv); sessionStorage.setItem('__s', '1'); } } catch {} }, [GAME_KEY, JSON.stringify({ version: SAVE_VERSION, data: infant }), SETTINGS_KEY, v3]);
  const page = await ctx.newPage();
  await page.goto(PROD, { waitUntil: 'load' });
  await page.waitForSelector('[data-testid="life-screen"]', { timeout: 10000 });
  await sleep(600);
  const n = await readNote(page);
  chk('noteCards 기본 true: 자동 ① 카드가 뜸', n.present && n.card === 'note-infant-memory' && n.toggle === '저절로 뜨는 기록 카드 끄기', `${n.present} ${n.card} ${n.toggle}`);
  chk('이미 고른 테마(다크)·배속 4 유지', (await page.evaluate(() => document.documentElement.getAttribute('data-theme'))) === 'dark', '');
  await page.getByTestId('note-cards-toggle').tap();
  await sleep(400);
  const st = await page.evaluate((k) => JSON.parse(localStorage.getItem(k)), SETTINGS_KEY);
  chk('쓰면 설정 v4·noteCards=false·배속 4·테마 dark 유지', st.version === 4 && st.data.noteCards === false && st.data.speed === 4 && st.data.theme === 'dark', JSON.stringify(st));
  await ctx.close();
  return done(checks);
});

await b.close();
