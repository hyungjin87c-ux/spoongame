// 공격 #2 키보드(R-036) / #3 자동 모드 해제(R-048) / #4 진입 직후 0.4초 / 키보드 전용 한 판
import { DEV, GAME_KEY, SETTINGS_KEY, launch, mkctx, runCase, shot, snap, toLife, waitScreen, readSave, readSettings, readChoice, sleep, con } from './lib.mjs';

const G = 'a-kbd';
const browser = await launch();
const only = process.argv[2];
let n = 68;
const aId = () => `M3-A${String(n++).padStart(2, '0')}`;
const curId = () => `M3-A${String(n - 1).padStart(2, '0')}`;
const TS = '?__timescale=15';

const focusInfo = (page) =>
  page.evaluate(() => {
    const a = document.activeElement;
    if (!a || a === document.body) return { tag: 'BODY', label: '' };
    const label = a.getAttribute('data-testid') || (a.dataset && a.dataset.speed ? `speed-${a.dataset.speed}` : '') || (a.textContent || '').trim().slice(0, 16);
    return { tag: a.tagName, label, ariaDisabled: a.getAttribute('aria-disabled'), testid: a.getAttribute('data-testid') };
  });
const pendingKey = async (page) => (await snap(page)).choiceKey;
const histChoices = async (page) => {
  const sv = await readSave(page);
  return sv && sv.data ? sv.data.history.filter((h) => h.kind === 'choice').length : -1;
};

/** Tab/Shift+Tab만으로 조건에 맞는 요소까지 이동 */
async function tabTo(page, pred, max = 30, back = false) {
  for (let i = 0; i < max; i++) {
    const f = await focusInfo(page);
    if (pred(f)) return i;
    await page.keyboard.press(back ? 'Shift+Tab' : 'Tab');
  }
  const f = await focusInfo(page);
  return pred(f) ? max : -1;
}

if (!only || only === 'K1') {
  n = 68;
  await runCase(G, { id: aId(), cat: '#2 키보드', title: '키보드 전용(Tab/Shift+Tab/Enter/Space만)으로 타이틀부터 사망까지 한 판 (360x740, 시간 배율 30)', timescale: 30, steps: '마우스 없이 Tab으로 이동·Enter/Space로 실행. 시작→시대 선택(지난 세상 선택)→태어나기→살아가기→8배 선택→"다음 결정으로"/선택지 선택 반복→사망', expected: '모든 버튼이 키보드로 닿고 실행됨, 포커스 링이 보임, 사망(엔딩)까지 도달. 오류 없음' }, async () => {
    const ctx = await mkctx(browser, { viewport: { width: 360, height: 740 } });
    const page = await ctx.newPage();
    await page.goto(DEV + '/?__timescale=30');
    const bad = [];
    const shots = [];
    const keys = { tab: 0, enter: 0, space: 0 };
    const press = async (k) => { await page.keyboard.press(k); keys[k === 'Tab' ? 'tab' : k === 'Enter' ? 'enter' : 'space']++; };
    await waitScreen(page, 'title-screen');
    await sleep(600);
    // 타이틀: 첫 Tab이 "시작"에 닿아야
    const f0 = await focusInfo(page);
    await press('Tab');
    const f1 = await focusInfo(page);
    shots.push(await shot(page, curId(), 'title-focus'));
    if (f1.label !== '시작') bad.push(`타이틀 첫 Tab이 "시작"이 아님: ${JSON.stringify(f1)} (이전 ${JSON.stringify(f0)})`);
    await press('Enter');
    await waitScreen(page, 'era-screen');
    await sleep(600);
    // 시대 선택: Tab으로 "지난 세상"으로 가 Space로 선택
    let steps = await tabTo(page, (f) => f.label.startsWith('지난 세상'));
    if (steps < 0) bad.push('지난 세상 카드에 Tab으로 닿지 않음');
    await press(' ');
    await sleep(200);
    const era = await page.locator('[data-era="past"]').getAttribute('aria-pressed');
    if (era !== 'true') bad.push('Space로 시대가 선택되지 않음');
    shots.push(await shot(page, curId(), 'era-focus'));
    steps = await tabTo(page, (f) => f.testid === 'confirm-era');
    if (steps < 0) bad.push('태어나기 버튼에 Tab으로 닿지 않음');
    await press('Enter');
    await waitScreen(page, 'birth-screen');
    await sleep(600);
    steps = await tabTo(page, (f) => f.testid === 'next-life');
    if (steps < 0) bad.push('살아가기 버튼에 Tab으로 닿지 않음');
    shots.push(await shot(page, curId(), 'birth-focus'));
    await press('Enter');
    await waitScreen(page, 'life-screen');
    await sleep(600);
    // 8배 선택
    steps = await tabTo(page, (f) => f.label === 'speed-8');
    if (steps < 0) bad.push('8배에 Tab으로 닿지 않음');
    await press(' ');
    await sleep(200);
    if ((await snap(page)).speed !== '8') bad.push('Space로 8배가 선택되지 않음');
    shots.push(await shot(page, curId(), 'life-speed8-focus'));
    let choiceCount = 0;
    const t0 = Date.now();
    let ended = false;
    while (Date.now() - t0 < 90000) {
      const s = await snap(page);
      if (s.screen === 'ending-placeholder') { ended = true; break; }
      if (s.hasChoice) {
        // 선택지가 뜨면 포커스는 8배 버튼에 그대로여야(컨트롤 안 포커스). 선택 버튼으로 Shift+Tab 으로 거슬러 가서 Enter
        const ci = choiceCount++ % 3;
        const f0 = await focusInfo(page);
        // 선택지 제목(h2)에 있으면 선택 버튼은 DOM에서 그 뒤에 있으므로 Tab, 컨트롤 쪽에 있으면 Shift+Tab으로 거슬러 간다
        const st = await tabTo(page, (f) => f.testid && f.testid.startsWith('choice-') && f.testid !== 'choice-title', 14, f0.testid !== 'choice-title' && f0.tag !== 'BODY');
        if (st < 0) { bad.push('선택지 버튼에 Shift+Tab으로 닿지 않음'); break; }
        if (choiceCount === 2) shots.push(await shot(page, curId(), 'choice-focus'));
        await press('Enter');
        await sleep(250);
      } else {
        const st = await tabTo(page, (f) => f.testid === 'skip', 14);
        if (st < 0) { bad.push('다음 결정으로에 Tab으로 닿지 않음'); break; }
        await press('Enter');
        await sleep(250);
      }
    }
    if (!ended) bad.push('사망(엔딩)에 도달하지 못함');
    await sleep(500);
    shots.push(await shot(page, curId(), 'ending'));
    const final = await snap(page);
    return { verdict: bad.length ? 'FAIL' : 'PASS', actual: bad.length ? bad.join('; ') : `키 입력 Tab ${keys.tab}·Enter ${keys.enter}·Space ${keys.space}으로 선택지 ${choiceCount}번 거쳐 사망까지 (${final.death})`, shots };
  });
}

if (!only || only === 'K2') {
  n = 69;
  for (const sp of [2, 4, 8]) {
    await runCase(G, { id: aId(), cat: '#2 키보드(R-036)', title: `${sp}배 버튼에 포커스 → 선택지 등장 → Tab → Space/Enter는 무반응 (시간 배율 15)`, timescale: 15, steps: `Tab으로 ${sp}배에 포커스, 가만히 선택지를 기다림(포커스는 그대로여야 함) → Tab(남은 속도 버튼을 지나 다음 결정으로: 비활성에 닿음) → Space·Enter → Tab 1회(자동 모드) → Space(켜지는 것은 정상, 기록만)`, expected: '선택지가 떠도 포커스는 속도 버튼 그대로. Tab 한 번은 비활성 "다음 결정으로", Space/Enter 무반응(선택 미확정·자동 모드 불변·연표 불변). 한 번 더 Tab → 자동 모드, Space는 켜짐(정상)' }, async () => {
      const ctx = await mkctx(browser, { viewport: { width: 360, height: 740 } });
      const page = await ctx.newPage();
      await page.goto(DEV + '/' + TS);
      await toLife(page, 'present');
      await sleep(500);
      const bad = [];
      const rows = [];
      await tabTo(page, (f) => f.label === `speed-${sp}`);
      await page.keyboard.press('Enter'); // 속도 선택
      await sleep(100);
      await page.waitForSelector('[data-testid="choice-panel"]', { timeout: 20000 });
      await sleep(500);
      const f1 = await focusInfo(page);
      rows.push(`선택지 등장 후 포커스=${f1.label}`);
      if (f1.label !== `speed-${sp}`) bad.push(`포커스가 이동함: ${f1.label}`);
      const key0 = await pendingKey(page);
      const hc0 = await histChoices(page);
      const st0 = await readSettings(page);
      // Tab 순서는 속도 1·2·4·8 → 다음 결정으로 → 자동 모드. 남은 속도 버튼을 지나 "다음 결정으로"에 닿을 때까지 Tab(8배는 1번)
      const walk = [];
      for (let i = 0; i < [4, 8].filter((x) => x > sp).length + 1; i++) { await page.keyboard.press('Tab'); walk.push((await focusInfo(page)).label); }
      const f2 = await focusInfo(page);
      rows.push(`Tab ${walk.length}번 → ${walk.join(' → ')}(aria-disabled=${f2.ariaDisabled})`);
      if (f2.testid !== 'skip') bad.push(`Tab 이동 끝이 "다음 결정으로"가 아님: ${f2.label}`);
      await page.keyboard.press(' ');
      await page.keyboard.press('Enter');
      await page.keyboard.press(' ');
      await sleep(400);
      const s2 = await snap(page);
      if (s2.choiceKey !== key0) bad.push('Space/Enter 뒤 선택지가 바뀜');
      if (s2.auto !== 'false') bad.push(`자동 모드가 켜짐(${s2.auto})`);
      if ((await histChoices(page)) !== hc0) bad.push('연표 변화');
      const sh = await shot(page, curId());
      await page.keyboard.press('Tab');
      const f3 = await focusInfo(page);
      rows.push(`Tab → ${f3.label}`);
      if (f3.testid !== 'auto') bad.push(`두 번째 Tab이 자동 모드가 아님: ${f3.label}`);
      await page.keyboard.press(' ');
      await sleep(300);
      const s3 = await snap(page);
      rows.push(`자동 모드에서 Space → 자동=${s3.auto} (기록만: 켜지는 것이 정상)`);
      return { verdict: bad.length ? 'FAIL' : 'PASS', actual: bad.length ? bad.join('; ') + ' :: ' + rows.join(' | ') : rows.join(' | '), shots: [sh] };
    });
  }
}

if (!only || only === 'K3') {
  n = 72;
  await runCase(G, { id: aId(), cat: '#2 키보드(R-036)', title: '"다음 결정으로" Enter/Space 연타·길게 누르기 → 선택지 제목으로 포커스, 선택 확정 없음', steps: '(진행 중, 선택지 없음) Tab으로 다음 결정으로에 포커스 → Enter 10회 연타 / Space 10회 / Enter 길게 누르기(keyboard.down 반복) / Space 길게', expected: '첫 입력으로 선택지가 뜨고 포커스는 선택지 제목으로, 이후 입력은 선택을 확정하지 않음(연표·선택지 불변)' }, async () => {
    const ctx = await mkctx(browser, { viewport: { width: 360, height: 740 } });
    const page = await ctx.newPage();
    await page.goto(DEV + '/');
    await toLife(page, 'present');
    await sleep(700);
    const bad = [];
    const rows = [];
    const shots = [];
    for (const [label, action] of [
      ['Enter 10회', async () => { for (let i = 0; i < 10; i++) await page.keyboard.press('Enter'); }],
      ['Space 10회', async () => { for (let i = 0; i < 10; i++) await page.keyboard.press(' '); }],
      ['Enter 길게', async () => { await page.keyboard.down('Enter'); for (let i = 0; i < 12; i++) { await page.keyboard.down('Enter'); await sleep(30); } await page.keyboard.up('Enter'); }],
      ['Space 길게', async () => { await page.keyboard.down(' '); for (let i = 0; i < 12; i++) { await page.keyboard.down(' '); await sleep(30); } await page.keyboard.up(' '); }],
    ]) {
      // 선택지가 없는 상태로 되돌린다: 있으면 마우스로 골라 둔다(이 준비 동작은 검사 대상 아님)
      for (let i = 0; i < 5; i++) {
        const s = await snap(page);
        if (s.screen === 'ending-placeholder') break;
        if (s.hasChoice) { await page.locator('.choice-list button').first().click(); await sleep(300); } else break;
      }
      const s0 = await snap(page);
      if (s0.screen === 'ending-placeholder') { rows.push(`${label}: 사망으로 중단`); break; }
      await page.locator('[data-testid="skip"]').focus();
      const hc0 = await histChoices(page);
      await action();
      await sleep(500);
      const s1 = await snap(page);
      const f = await focusInfo(page);
      const hc1 = await histChoices(page);
      rows.push(`${label}: 선택지=${s1.hasChoice ? s1.choiceKey : '없음'} 포커스=${f.label} 선택수 ${hc0}→${hc1}`);
      if (!s1.hasChoice) bad.push(`${label}: 선택지가 뜨지 않았거나 확정돼 사라짐`);
      if (hc1 !== hc0) bad.push(`${label}: 선택 확정됨(${hc0}→${hc1})`);
      if (s1.hasChoice && !(f.testid === 'choice-title')) bad.push(`${label}: 포커스가 선택지 제목이 아님(${f.label})`);
      shots.push(await shot(page, curId(), label.replace(/\s/g, '')));
    }
    return { verdict: bad.length ? 'FAIL' : 'PASS', actual: bad.length ? bad.join('; ') + ' :: ' + rows.join(' | ') : rows.join(' | '), shots };
  });
  n = 73;
  await runCase(G, { id: aId(), cat: '#2 키보드(R-036)', title: '흐린 "다음 결정으로" 클릭 무반응(선택지 대기 중·자동 모드 중), 1배에서 Shift+Tab, 선택 뒤 Tab 5번에 "다음 결정으로"', steps: '선택지 대기 중 흐린 skip 클릭(force) → 자동 모드 켜고 skip 클릭 → 1배 버튼에서 Shift+Tab → 키보드로 선택한 뒤 Tab 5번', expected: '흐린 버튼은 눌러도 무반응(선택·진행 불변), Shift+Tab은 어떤 동작도 일으키지 않고 포커스만 이동, 선택 뒤 Tab 5번째가 다음 결정으로' }, async () => {
    const ctx = await mkctx(browser, { viewport: { width: 360, height: 740 } });
    const page = await ctx.newPage();
    await page.goto(DEV + '/' + TS);
    await toLife(page, 'present');
    await sleep(700);
    const bad = [];
    const rows = [];
    await page.waitForSelector('[data-testid="choice-panel"]', { timeout: 20000 });
    await sleep(500);
    const key0 = await pendingKey(page);
    const op = await page.getByTestId('skip').evaluate((el) => ({ aria: el.getAttribute('aria-disabled'), opacity: getComputedStyle(el).opacity }));
    rows.push(`선택지 대기 중 skip: aria-disabled=${op.aria} opacity=${op.opacity}`);
    if (op.aria !== 'true' || Number(op.opacity) >= 0.9) bad.push(`선택지 대기 중 skip이 흐리지 않음 ${JSON.stringify(op)}`);
    const shDim = await shot(page, curId(), 'dim-skip');
    for (let i = 0; i < 6; i++) await page.getByTestId('skip').click({ force: true });
    await sleep(300);
    const s1 = await snap(page);
    if (s1.choiceKey !== key0) bad.push('흐린 skip 클릭으로 선택지가 바뀜');
    // Shift+Tab (1배) — 먼저 1배에 포커스
    await page.locator('[data-speed="1"]').focus();
    const hc = await histChoices(page);
    await page.keyboard.press('Shift+Tab');
    const fb = await focusInfo(page);
    rows.push(`1배에서 Shift+Tab → ${fb.tag}:${fb.label}`);
    await page.keyboard.press('Shift+Tab');
    const fb2 = await focusInfo(page);
    rows.push(`다시 Shift+Tab → ${fb2.tag}:${fb2.label}`);
    if ((await histChoices(page)) !== hc || (await pendingKey(page)) !== key0) bad.push('Shift+Tab 뒤 상태 변화');
    const shBack = await shot(page, curId(), 'shift-tab');
    // 키보드로 선택: 선택 버튼에 포커스 → Enter
    await page.locator('.choice-list button').first().focus();
    await sleep(500);
    await page.keyboard.press('Enter');
    await sleep(500);
    const fAfter = await focusInfo(page);
    rows.push(`선택 후 포커스=${fAfter.tag}:${fAfter.label}`);
    const seq = [];
    for (let i = 0; i < 5; i++) { await page.keyboard.press('Tab'); seq.push((await focusInfo(page)).label); }
    rows.push(`선택 뒤 Tab 5번 → ${seq.join(' → ')}`);
    if (seq[4] !== 'skip') bad.push(`Tab 5번째가 skip이 아님(${seq[4]})`);
    // 자동 모드에서 skip 클릭
    await page.getByTestId('auto').click();
    await sleep(200);
    const op2 = await page.getByTestId('skip').evaluate((el) => ({ aria: el.getAttribute('aria-disabled'), opacity: getComputedStyle(el).opacity }));
    rows.push(`자동 모드 skip: aria-disabled=${op2.aria} opacity=${op2.opacity}`);
    if (op2.aria !== 'true') bad.push('자동 모드에서 skip이 비활성 표시가 아님');
    const age0 = (await snap(page)).age;
    for (let i = 0; i < 5; i++) await page.getByTestId('skip').click({ force: true });
    await sleep(100);
    const sh = await shot(page, curId(), 'auto-skip');
    return { verdict: bad.length ? 'FAIL' : 'PASS', actual: bad.length ? bad.join('; ') + ' :: ' + rows.join(' | ') : rows.join(' | '), shots: [shDim, shBack, sh] };
  });
}

if (!only || only === 'A1') {
  n = 74;
  await runCase(G, { id: aId(), cat: '#3 자동 해제(R-048)', title: '선택지가 떠 있는 순간 자동 모드 해제 → 포커스·안내, 자동 선택 취소 (1배, 실시간)', steps: '1배·자동 켠 채 선택지가 뜨는 순간(3초 대기 중) 자동 모드를 끈다 → 6초 관찰', expected: '선택지는 그대로 남고 자동 선택이 일어나지 않음. 포커스는 자동 모드 버튼, 안내(aria-live)가 갱신됨' }, async () => {
    const ctx = await mkctx(browser, { viewport: { width: 360, height: 740 } });
    const page = await ctx.newPage();
    await page.goto(DEV + '/');
    await toLife(page, 'present');
    await sleep(600);
    await page.getByTestId('auto').click();
    await sleep(200);
    await page.waitForSelector('[data-testid="choice-panel"]', { timeout: 120000 });
    const t = Date.now();
    await page.getByTestId('auto').click();
    const tOff = Date.now() - t;
    const key0 = await pendingKey(page);
    const hc0 = await histChoices(page);
    await sleep(6000);
    const s = await snap(page);
    const f = await focusInfo(page);
    const live = await page.getByTestId('choice-announce').textContent();
    const bad = [];
    if (!s.hasChoice || s.choiceKey !== key0) bad.push('자동 선택이 일어났거나 선택지가 바뀜');
    if ((await histChoices(page)) !== hc0) bad.push('선택 확정됨');
    if (s.auto !== 'false') bad.push('자동 모드가 아직 켜짐');
    if (f.testid !== 'auto') bad.push(`포커스가 자동 모드 버튼이 아님(${f.label})`);
    const sh = await shot(page, curId());
    return { verdict: bad.length ? 'FAIL' : 'PASS', actual: bad.length ? bad.join('; ') : `해제 클릭 ${tOff}ms 뒤 6초간 선택지 유지, 포커스=${f.label}, 안내="${live}"`, shots: [sh] };
  });
  n = 75;
  await runCase(G, { id: aId(), cat: '#3 자동 해제(R-048)', title: '8배속 자동 선택 직전 해제 x12 — 해제가 화면에 보인 뒤 선택이 확정되면 FAIL', steps: '8배·자동으로 진행하다 선택지가 보이는 즉시 자동 모드 버튼 클릭. 해제가 반영된 것이 보이는 시점의 연표 선택 수와 2초 뒤를 비교', expected: '해제가 보인 뒤에는 선택이 확정되지 않음' }, async () => {
    const ctx = await mkctx(browser, { viewport: { width: 360, height: 740 } });
    const page = await ctx.newPage();
    await page.addInitScript(([k, v]) => { if (location.protocol === 'about:') return; if (localStorage.getItem(k) === null) localStorage.setItem(k, v); }, [SETTINGS_KEY, JSON.stringify({ version: 1, data: { speed: 8, autoMode: true } })]);
    await page.goto(DEV + '/');
    await toLife(page, 'present');
    const bad = [];
    const rows = [];
    let before = 0, race = 0, cancelled = 0;
    for (let round = 0; round < 12; round++) {
      // 선택지 뜰 때까지 (자동 모드가 이전 선택을 처리하며 진행)
      await page.waitForSelector('[data-testid="choice-panel"]', { timeout: 60000 }).catch(() => {});
      const s0 = await snap(page);
      if (s0.screen === 'ending-placeholder') { rows.push('사망으로 중단'); break; }
      if (!s0.hasChoice) continue;
      const key = s0.choiceKey;
      // 해제 클릭 + 바로 상태 읽기
      const res = await page.evaluate(async () => {
        const btn = document.querySelector('[data-testid="auto"]');
        const count = () => { try { return JSON.parse(localStorage.getItem('suzeo-game:save')).data.history.filter((h) => h.kind === 'choice').length; } catch { return -1; } };
        const panel0 = document.querySelector('[data-testid="choice-panel"]');
        const keyNow = panel0 ? panel0.getAttribute('data-key') : null;
        btn.click();
        await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
        const off = btn.getAttribute('aria-pressed') === 'false';
        const c1 = count();
        const p1 = document.querySelector('[data-testid="choice-panel"]');
        return { off, c1, key1: p1 ? p1.getAttribute('data-key') : null, keyNow };
      });
      await sleep(2200);
      const c2 = await histChoices(page);
      const sNow = await snap(page);
      if (!res.off) { rows.push(`R${round}: 해제 반영 안 됨?`); continue; }
      if (res.key1 !== res.keyNow || res.keyNow !== key) { before++; rows.push(`R${round}: 클릭 전에 이미 선택됨`); continue; }
      if (c2 !== res.c1 || sNow.choiceKey !== key) {
        bad.push(`R${round}: 해제 후 선택이 확정됨(선택 수 ${res.c1}→${c2}, key ${key}→${sNow.choiceKey})`);
      } else cancelled++;
      // 다시 자동 켜서 계속 진행(선택은 자동으로 이어지게)
      await page.getByTestId('auto').click();
      await sleep(300);
    }
    const sh = await shot(page, curId());
    return { verdict: bad.length ? 'FAIL' : cancelled >= 4 ? 'PASS' : 'ERROR', actual: bad.length ? bad.join('; ') : `해제가 선택을 막은 횟수 ${cancelled}, 클릭 전에 이미 선택된 횟수 ${before}(경쟁에서 짐, 정상)`, shots: [sh] };
  });
}

if (!only || only === 'E1') {
  n = 76;
  await runCase(G, { id: aId(), cat: '#4 진입 직후 0.4초', title: '인생 화면 진입·새로고침 직후 0.4초: 속도·자동·다음 결정으로 흐림·무반응 + 가드 해제 시간 측정', steps: '"살아가기" 직후 즉시 4배·자동·다음 결정으로 클릭(좌표 입력) → 0.7초 뒤 다시. 새로고침 직후에도 동일. aria-disabled가 풀리는 시간을 측정', expected: '약 0.4초간 흐림(aria-disabled)·무반응, 이후 정상. 가드 해제는 약 400ms' }, async () => {
    const ctx = await mkctx(browser, { viewport: { width: 360, height: 740 } });
    const page = await ctx.newPage();
    await page.addInitScript(() => {
      window.__tm = {};
      new MutationObserver(() => {
        const b = document.querySelector('[data-speed="4"]');
        if (b && window.__tm.mount === undefined) window.__tm.mount = performance.now();
        if (b && window.__tm.mount !== undefined && window.__tm.free === undefined && b.getAttribute('aria-disabled') !== 'true') window.__tm.free = performance.now();
      }).observe(document, { attributes: true, childList: true, subtree: true });
    });
    await page.goto(DEV + '/');
    await waitScreen(page, 'title-screen');
    await page.getByRole('button', { name: '시작' }).click();
    await waitScreen(page, 'era-screen');
    await page.getByTestId('confirm-era').click();
    await waitScreen(page, 'birth-screen');
    await sleep(700);
    const bad = [];
    const rows = [];
    // 인생 화면 진입 직후
    await page.getByTestId('next-life').click();
    await waitScreen(page, 'life-screen');
    const get = async () => page.evaluate(() => ({ s4: document.querySelector('[data-speed="4"]').getAttribute('aria-disabled'), sk: document.querySelector('[data-testid="skip"]').getAttribute('aria-disabled'), au: document.querySelector('[data-testid="auto"]').getAttribute('aria-disabled'), op: getComputedStyle(document.querySelector('[data-speed="4"]')).opacity }));
    const g0 = await get();
    rows.push(`진입 직후 aria-disabled(4배/skip/자동)=${g0.s4}/${g0.sk}/${g0.au} opacity=${g0.op}`);
    if (!(g0.s4 === 'true' && g0.sk === 'true' && g0.au === 'true')) bad.push('진입 직후 컨트롤이 흐리지 않음');
    const shEarly = await shot(page, curId(), 'enter-dim');
    for (const sel of ['[data-speed="4"]', '[data-testid="auto"]', '[data-testid="skip"]']) {
      const b = await page.locator(sel).boundingBox();
      await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
    }
    await sleep(30);
    const s0 = await snap(page);
    rows.push(`즉시 클릭 뒤 속도=${s0.speed} 자동=${s0.auto} 나이=${s0.age} 선택지=${s0.hasChoice}`);
    if (s0.speed !== '1' || s0.auto !== 'false') bad.push('가드 중 클릭이 반영됨');
    await sleep(800);
    const tm = await page.evaluate(() => window.__tm);
    rows.push(`가드 해제까지 ${Math.round(tm.free - tm.mount)}ms`);
    if (!(tm.free - tm.mount > 300 && tm.free - tm.mount < 700)) bad.push(`해제 시간 이상 ${Math.round(tm.free - tm.mount)}ms`);
    const g1 = await get();
    if (g1.s4 === 'true') bad.push('0.8초 뒤에도 흐림');
    await page.getByTestId('auto').click();
    await sleep(100);
    // 새로고침 직후
    await page.reload();
    await waitScreen(page, 'life-screen');
    const g2 = await get();
    rows.push(`새로고침 직후 aria-disabled(4배)=${g2.s4}`);
    if (g2.s4 !== 'true') bad.push('새로고침 직후 흐리지 않음');
    const b4 = await page.locator('[data-speed="4"]').boundingBox();
    await page.mouse.click(b4.x + b4.width / 2, b4.y + b4.height / 2);
    await sleep(30);
    const s2 = await snap(page);
    if (s2.speed !== '1') bad.push(`새로고침 직후 클릭이 반영됨(${s2.speed})`);
    await sleep(700);
    const s3 = await snap(page);
    rows.push(`새로고침 직후 즉시 클릭 뒤 속도 ${s2.speed}, 0.7초 뒤 ${s3.speed}`);
    // 자동 모드 내내 흐린 skip
    const op = [];
    for (let i = 0; i < 6; i++) { op.push(await page.getByTestId('skip').evaluate((el) => `${el.getAttribute('aria-disabled')}/${getComputedStyle(el).opacity}`)); await sleep(500); }
    rows.push(`자동 모드 중 skip(aria/opacity) ${op.join(' ')}`);
    if (op.some((x) => !x.startsWith('true'))) bad.push('자동 모드 중 skip이 흐리지 않은 순간이 있음');
    return { verdict: bad.length ? 'FAIL' : 'PASS', actual: bad.length ? bad.join('; ') + ' :: ' + rows.join(' | ') : rows.join(' | '), shots: [shEarly] };
  });
}
await browser.close();
