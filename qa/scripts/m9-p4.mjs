// QA-003 M9 P4: 다크 · 강제 색상(라이트/다크) 핵심 화면 · 움직임 줄이기(룰렛·캐러셀) · 키보드만으로 첫 화면 → 대시보드 → 카드 → 엔딩(Tab 순회 가려진 포커스 0)
// 사용: node qa/scripts/m9-p4.mjs <part ...>   part: kbd forced motion m360     (다크 1판은 M9_SCHEME=dark M9_CONTRAST=1 node m9-p2.mjs …)
import { launch, openOracle, plainLife, pendingState, dueStateFor, openSeeded, evalCore, sleep, shot, runCase, mkctx, fixSeed, cleanStorageOnce, readCard, readSave, waitGuard, sheetReady, SET_MANUAL, TOUCH, PROD, GAME_KEY } from './m7c-lib.mjs';
import { auditLayout, auditContrast, judgeSteps, MEASURE_M9 as MEASURE } from './m9-audit.mjs';

const parts = process.argv.slice(2);
const want = (p) => parts.length === 0 || parts.includes(p);
const browser = await launch();
const D = { width: 1280, height: 800 };

// ----------------------------------------------------------------- 키보드만
async function tabTo(p, selector, steps, max = 90) {
  for (let i = 0; i < max; i++) {
    const hit = await p.evaluate((sel) => !!document.activeElement && document.activeElement !== document.body && document.activeElement.matches(sel), selector);
    if (hit) return true;
    await p.keyboard.press('Tab');
    await sleep(40);
    const m = await p.evaluate(MEASURE);
    if (!m.body) steps.push({ dir: 'fwd', i: steps.length, ...m });
    else steps.push({ dir: 'fwd', i: steps.length, body: true });
  }
  return p.evaluate((sel) => !!document.activeElement && document.activeElement.matches(sel), selector);
}

if (want('kbd')) {
  await runCase({ id: 'P4-keyboard', cat: 'P4 키보드만', title: '키보드만(Tab·Enter)으로 첫 화면 → 룰렛 → 출생신고 → 대시보드(8배속) → 결정 카드·기록 카드 → 엔딩 → 다시 태어나기: 어디서도 막히지 않고, Tab 순회에서 가려진 포커스 0', steps: '마우스·탭 없이 keyboard.press(Tab/Enter)만 사용, 모든 Tab 정지에서 포커스 링·고정 요소 가림을 잼(MEASURE)' }, async () => {
    const ctx = await mkctx(browser, { viewport: D });
    await cleanStorageOnce(ctx);
    await fixSeed(ctx, 55);
    const p = await ctx.newPage();
    const steps = [];
    const problems = [];
    let tabs = 0;
    const press = async (sel, label) => {
      const ok = await tabTo(p, sel, steps);
      if (!ok) {
        problems.push(`Tab으로 ${label}에 닿지 못함`);
        return false;
      }
      await p.keyboard.press('Enter');
      return true;
    };
    await p.goto(PROD, { waitUntil: 'load' });
    await p.waitForSelector('[data-testid="title-screen"]');
    await waitGuard(p, 'start-birth');
    if (!(await press('[data-testid="start-birth"]', '태어나기'))) return { verdict: 'FAIL', actual: problems.join(' / '), shots: [await shot(p, 'P4-keyboard', 'stuck')] };
    await p.waitForSelector('[data-testid="roulette-screen"]', { timeout: 8000 });
    await waitGuard(p, 'skip-roulette').catch(() => {});
    if (!(await press('[data-testid="skip-roulette"]', '건너뛰기'))) return { verdict: 'FAIL', actual: problems.join(' / '), shots: [await shot(p, 'P4-keyboard', 'stuck-roulette')] };
    await p.waitForSelector('[data-testid="roulette-screen"][data-state="result"]', { timeout: 8000 });
    await waitGuard(p, 'to-birth');
    if (!(await press('[data-testid="to-birth"]', '출생신고 보기'))) return { verdict: 'FAIL', actual: problems.join(' / '), shots: [await shot(p, 'P4-keyboard', 'stuck-result')] };
    await p.waitForSelector('[data-testid="birth-screen"]', { timeout: 8000 });
    await waitGuard(p, 'next-life');
    if (!(await press('[data-testid="next-life"]', '살아가기'))) return { verdict: 'FAIL', actual: problems.join(' / '), shots: [await shot(p, 'P4-keyboard', 'stuck-birth')] };
    await p.waitForSelector('[data-testid="life-screen"]', { timeout: 8000 });
    await sleep(500);
    if (!(await press('[data-speed="8"]', '8배속'))) return { verdict: 'FAIL', actual: problems.join(' / '), shots: [await shot(p, 'P4-keyboard', 'stuck-dash')] };
    let decisions = 0;
    let notes = 0;
    let ended = false;
    const t0 = Date.now();
    let last = '';
    while (Date.now() - t0 < 6 * 60 * 1000) {
      const c = await readCard(p);
      if (c.screen === 'ending-screen') {
        ended = true;
        break;
      }
      if (c.screen !== 'life-screen') {
        problems.push(`뜻밖의 화면 ${c.screen}`);
        break;
      }
      if (c.noteSheet) {
        await sheetReady(p);
        if (!(await press('[data-testid="note-skip"]', '기록 시트의 2번'))) break;
        notes++;
        await p.waitForSelector('[data-testid="note-sheet"]', { state: 'detached', timeout: 5000 }).catch(() => problems.push('기록 시트가 안 닫힘'));
        continue;
      }
      if (c.mode === 'sheet') {
        await p.waitForFunction(() => {
          const bt = document.querySelector('[data-testid="decision-fold-btn"]');
          return bt !== null && bt.getAttribute('aria-disabled') !== 'true' && !bt.disabled;
        }, null, { timeout: 8000 }).catch(() => {});
        await sleep(150);
        if (c.key === last) {
          await sleep(100);
          continue;
        }
        last = c.key;
        const idx = decisions % c.choices.length;
        if (!(await press(`[data-testid="choice-${c.choices[idx].id}"]`, `결정 카드 선택지 ${idx + 1}`))) break;
        decisions++;
        await sleep(250);
        continue;
      }
      if (c.mode === 'inline' || c.mode === 'fold') {
        await sleep(150);
        continue;
      }
      if (c.skipDisabled !== 'true') {
        if (!(await press('[data-testid="skip"]', '다음 결정으로'))) break;
      }
      await sleep(150);
    }
    if (!ended) problems.push('엔딩에 닿지 못함');
    else {
      await sleep(400);
      if (await press('[data-testid="rebirth"]', '다시 태어나기')) {
        await p.waitForSelector('[data-testid="title-screen"]', { timeout: 8000 }).catch(() => problems.push('다시 태어나기 뒤 첫 화면이 안 뜸'));
      }
    }
    const judged = judgeSteps(steps, 'kbd', D.height);
    problems.push(...judged);
    tabs = steps.filter((s) => !s.body).length;
    const s = problems.length ? await shot(p, 'P4-keyboard') : null;
    await ctx.close();
    return { verdict: problems.length ? 'FAIL' : 'PASS', actual: problems.length ? problems.slice(0, 6).join(' / ') : `키보드만으로 엔딩까지 완주(결정 ${decisions}장·기록 시트 ${notes}장), Tab 정지 ${tabs}회 전부 가려진 포커스 0`, shots: s ? [s] : [] };
  });
}

// ----------------------------------------------------------------- 강제 색상 · 다크 (핵심 화면)
const { page: oracle } = await openOracle(browser);
const adult = await plainLife(oracle, { era: 'present', seed: 4242, age: 30, paused: true });
const pend = await pendingState(oracle, { era: 'present', seed: 4242, minAge: 12, paused: true });
const due = await dueStateFor(oracle, 'note-infant-memory', { era: 'present', paused: true });
const ending = await evalCore(
  oracle,
  `for (let seed = 7; seed < 4000; seed++) {
     const s0 = core.enterLife(core.enterBirth(core.beginBirth(core.createInitialState(seed), 'present')));
     const r = core.playToEnd(s0, null);
     if (r.state.phase === 'ending') return { ...r.state, play: { hold: 910900, decide: 755999, fold: 123456, note: 777777, idle: 999999, offSpeed: 0, auto: 0, skips: 0, resumes: 3 } };
   }
   return null;`,
);

const RING_SWEEP = async (p, max = 45) => {
  const stops = [];
  for (let i = 0; i < max; i++) {
    await p.keyboard.press('Tab');
    await sleep(40);
    const r = await p.evaluate(() => {
      const a = document.activeElement;
      if (!a || a === document.body) return null;
      let ring = false;
      for (let x = a, k = 0; x && x !== document.body && k < 4; x = x.parentElement, k++) {
        const cs = getComputedStyle(x);
        if (cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0 && (x === a || x.matches(':focus-within'))) ring = true;
      }
      return { id: a.getAttribute('data-testid') || a.tagName, ring };
    });
    if (!r) continue;
    if (stops.some((s) => s.id === r.id)) break;
    stops.push(r);
  }
  return stops;
};

async function coreScreens(vpName, vp, touch, extraCtx, label) {
  const results = [];
  const screens = [
    ['title', async () => { const ctx = await mkctx(browser, { viewport: vp, ...(touch ? TOUCH : {}), ...extraCtx }); await cleanStorageOnce(ctx); const p = await ctx.newPage(); await p.goto(PROD, { waitUntil: 'load' }); await p.waitForSelector('[data-testid="title-screen"]'); return { ctx, page: p }; }],
    ['dash', async () => openSeeded(browser, adult, { vp, touch, settings: SET_MANUAL, extraCtx })],
    ['decision', async () => { const r = await openSeeded(browser, pend, { vp, touch, settings: SET_MANUAL, extraCtx }); await r.page.waitForSelector('[data-testid="choice-panel"]'); await sleep(600); return r; }],
    ['note', async () => { const r = await openSeeded(browser, due, { vp, touch, settings: SET_MANUAL, extraCtx }); await sheetReady(r.page); return r; }],
    ['ending', async () => openSeeded(browser, ending, { vp, touch, settings: SET_MANUAL, extraCtx, wait: '[data-testid="ending-screen"]' })],
  ];
  const only = process.env.M9_P4_SCREENS ? process.env.M9_P4_SCREENS.split(',') : null;
  for (const [name, open] of screens) {
    if (only && !only.includes(name)) continue;
    const { ctx, page } = await open();
    await sleep(400);
    const lay = await auditLayout(page);
    const con = await auditContrast(page);
    const probs = [...lay.problems, ...con.problems];
    let ringMiss = 0;
    let stops = 0;
    if (extraCtx.forcedColors) {
      const sweep = await RING_SWEEP(page);
      stops = sweep.length;
      const miss = sweep.filter((s) => !s.ring);
      ringMiss = miss.length;
      if (miss.length) probs.push(`강제 색상에서 포커스 링(outline)이 없는 정지 ${miss.length}/${sweep.length}: ${miss.slice(0, 4).map((m) => m.id).join(', ')}`);
    }
    let shotPath = null;
    if (probs.length) shotPath = await shot(page, `P4-${label}`, `${vpName}-${name}`);
    results.push({ name, probs, shot: shotPath, contrast: `${con.checked}/${con.unknown}`, stops });
    await ctx.close();
  }
  return results;
}

if (want('forced')) {
  for (const [scheme, id] of [['light', 'P4-forced-light'], ['dark', 'P4-forced-dark']]) {
    await runCase({ id, cat: 'P4 강제 색상', title: `강제 색상(forced-colors: active, ${scheme}) 1280×800: 첫 화면·대시보드·결정 카드·기록 시트·엔딩 — 배치 감사 0, 글자 대비 기준 이상, Tab 정지마다 포커스 링(outline) 있음`, steps: 'forcedColors active + colorScheme으로 컨텍스트를 열고 각 화면을 연 뒤 m9-audit(배치·대비)와 Tab 순회 링 점검' }, async () => {
      const rs = await coreScreens('d1280', D, false, { forcedColors: 'active', colorScheme: scheme }, `forced-${scheme}`);
      const bad = rs.filter((r) => r.probs.length);
      return { verdict: bad.length ? 'FAIL' : 'PASS', actual: bad.length ? bad.map((r) => `${r.name}: ${r.probs.join(' ; ').slice(0, 300)}`).join(' || ') : `화면 ${rs.length}곳 문제 0 (대비 검사/건너뜀 ${rs.map((r) => `${r.name} ${r.contrast}`).join(', ')}, Tab 링 정지 ${rs.map((r) => r.stops).join('/')})`, shots: bad.length && bad[0].shot ? [bad[0].shot] : [] };
    });
  }
  // 강제 색상에서 눈금·눌림 상태가 구분되는가
  await runCase({ id: 'P4-forced-state', cat: 'P4 강제 색상', title: '강제 색상: 눌린 배속 버튼과 안 눌린 버튼, 올해 진행 막대의 채움과 바탕, 상태 막대가 색 말고도(배경·테두리·글자색) 구분된다', steps: 'forcedColors active 대시보드에서 [aria-pressed=true]와 false 버튼의 계산 스타일(배경·테두리·글자·outline)을 견줌, 진행 막대 채움과 트랙의 배경색 견줌' }, async () => {
    const { ctx, page } = await openSeeded(browser, adult, { vp: D, touch: false, settings: SET_MANUAL, extraCtx: { forcedColors: 'active', colorScheme: 'light' } });
    await sleep(400);
    const r = await page.evaluate(() => {
      const st = (e) => { const c = getComputedStyle(e); return `${c.backgroundColor}|${c.color}|${c.borderTopColor}|${c.borderTopWidth}|${c.outlineStyle}`; };
      const on = document.querySelector('[data-speed][aria-pressed="true"]');
      const off = document.querySelector('[data-speed][aria-pressed="false"]');
      const fill = document.querySelector('[data-testid="year-progress-fill"]');
      const track = document.querySelector('[data-testid="year-progress"]');
      const bars = [...document.querySelectorAll('[data-testid="stats"] [role="progressbar"], [data-testid="stats"] .bar, [data-testid="stats"] .stat-bar')].slice(0, 2);
      return { on: on ? st(on) : null, off: off ? st(off) : null, fill: fill ? getComputedStyle(fill).backgroundColor : null, track: track ? getComputedStyle(track).backgroundColor : null, trackBorder: track ? getComputedStyle(track).borderTopColor : null, fillW: fill ? fill.getBoundingClientRect().width : null, bars: bars.length };
    });
    const problems = [];
    if (!r.on || !r.off) problems.push('배속 버튼 눌림 표시를 못 찾음');
    else if (r.on === r.off) problems.push(`눌린 버튼과 안 눌린 버튼의 스타일이 같음: ${r.on}`);
    if (r.fill && r.track && r.fill === r.track) problems.push(`진행 막대 채움과 바탕 색이 같음 ${r.fill}`);
    const s = problems.length ? await shot(page, 'P4-forced-state') : null;
    await ctx.close();
    return { verdict: problems.length ? 'FAIL' : 'PASS', actual: problems.length ? problems.join(' / ') : `눌린 ${r.on} ≠ 안 눌린 ${r.off}; 진행 채움 ${r.fill} (바탕 ${r.track}, 채움 폭 ${Math.round(r.fillW)}px)`, shots: s ? [s] : [] };
  });
}

// ----------------------------------------------------------------- 둘째 축: 360×740 터치 다크·강제 색상의 첫 화면·대시보드
if (want('m360')) {
  for (const [id, extra] of [['P4-m360-dark', { colorScheme: 'dark' }], ['P4-m360-forced-light', { forcedColors: 'active', colorScheme: 'light' }], ['P4-m360-forced-dark', { forcedColors: 'active', colorScheme: 'dark' }]]) {
    await runCase({ id, cat: 'P4 360 터치', title: `360×740 터치 ${id.replace('P4-m360-', '')}: 첫 화면·대시보드 — 배치 감사 0, 글자 대비 기준 이상`, steps: '컨텍스트 옵션으로 색 모드를 바꿔 첫 화면·대시보드를 열고 m9-audit(배치·대비)' }, async () => {
      process.env.M9_P4_SCREENS = 'title,dash';
      const rs = await coreScreens('m360', { width: 360, height: 740 }, true, extra, id.replace('P4-m360-', 'm360-'));
      delete process.env.M9_P4_SCREENS;
      const bad = rs.filter((r) => r.probs.length);
      return { verdict: bad.length ? 'FAIL' : 'PASS', actual: bad.length ? bad.map((r) => `${r.name}: ${r.probs.join(' ; ').slice(0, 300)}`).join(' || ') : `화면 ${rs.length}곳 문제 0 (대비 검사/건너뜀 ${rs.map((r) => `${r.name} ${r.contrast}`).join(', ')})`, shots: bad.length && bad[0].shot ? [bad[0].shot] : [] };
    });
  }
}

// ----------------------------------------------------------------- 움직임 줄이기
if (want('motion')) {
  const runMotion = async (reduce) => {
    const ctx = await mkctx(browser, { viewport: D, reducedMotion: reduce ? 'reduce' : 'no-preference' });
    await cleanStorageOnce(ctx);
    await fixSeed(ctx, 66);
    const p = await ctx.newPage();
    await p.goto(PROD, { waitUntil: 'load' });
    await p.waitForSelector('[data-testid="title-screen"]');
    // 캐러셀: 8초 동안 자동으로 넘어가는가
    const c0 = await p.evaluate(() => (document.querySelector('[data-testid="carousel-count"]') || {}).textContent || null);
    const anim0 = await p.evaluate(() => document.getAnimations().filter((a) => a.playState === 'running').length);
    await sleep(9000);
    const c1 = await p.evaluate(() => (document.querySelector('[data-testid="carousel-count"]') || {}).textContent || null);
    const autoNote = await p.evaluate(() => (document.querySelector('[data-testid="carousel-auto-note"]') || {}).textContent || null);
    // 룰렛
    await waitGuard(p, 'start-birth');
    await p.getByTestId('start-birth').click();
    await p.waitForSelector('[data-testid="roulette-screen"]', { timeout: 8000 });
    await sleep(600);
    const spin = await p.evaluate(() => ({
      state: document.querySelector('[data-testid="roulette-screen"]').getAttribute('data-state'),
      running: document.getAnimations().filter((a) => a.playState === 'running').length,
      note: (document.querySelector('[data-testid="motion-note"]') || {}).textContent || null,
    }));
    const t0 = Date.now();
    await p.waitForSelector('[data-testid="roulette-screen"][data-state="result"]', { timeout: 30000 }).catch(() => {});
    const spinMs = Date.now() - t0;
    await ctx.close();
    return { c0, c1, anim0, autoNote, spin, spinMs };
  };
  await runCase({ id: 'P4-motion', cat: 'P4 움직임 줄이기', title: '움직임 줄이기(prefers-reduced-motion): 캐러셀이 저절로 넘어가지 않고 룰렛 회전 연출이 줄어든다 — 대조(움직임 줄이기 아님)에서는 움직인다', steps: '1280×800에서 reduce와 no-preference 두 컨텍스트: 첫 화면 캐러셀 9초 관찰·실행 중인 애니메이션 수 → 룰렛 시작 600ms 뒤 실행 중인 애니메이션·안내문·결과까지 걸린 시간' }, async () => {
    const a = await runMotion(true);
    const b = await runMotion(false);
    const problems = [];
    if (a.c0 !== a.c1) problems.push(`움직임 줄이기인데 캐러셀이 저절로 넘어감 ${a.c0} → ${a.c1}`);
    if (a.spin.state !== 'result') problems.push(`움직임 줄이기인데 룰렛이 회전 상태(${a.spin.state})`);
    if (!a.spin.note) problems.push('움직임 줄이기 안내문(motion-note)이 없음');
    const ctl = [];
    if (b.c0 === b.c1) ctl.push('대조에서 캐러셀이 9초 동안 안 움직임(대조 무효)');
    if (b.spin.state !== 'spinning') ctl.push(`대조에서 룰렛이 회전하지 않음(상태 ${b.spin.state}, 대조 무효)`);
    if (b.spin.note) ctl.push('대조에서도 움직임 줄이기 안내문이 보임');
    return { verdict: problems.length || ctl.length ? 'FAIL' : 'PASS', actual: problems.length || ctl.length ? [...problems, ...ctl].join(' / ') : `줄임: 캐러셀 ${a.c0}→${a.c1}(그대로), 룰렛 600ms 뒤 상태 ${a.spin.state}·안내문 있음, 결과까지 ${a.spinMs}ms / 대조: 캐러셀 ${b.c0}→${b.c1}(저절로 넘어감), 룰렛 상태 ${b.spin.state}, 결과까지 ${b.spinMs}ms`, shots: [] };
  });
}
await browser.close();
