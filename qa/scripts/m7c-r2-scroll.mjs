// QA-003 M7c 스크롤 잠금(M7b A20b 재확인): 결정 시트·기록 시트(자동·수동) 모두 — 바탕 드래그(CDP 터치)·데스크톱 휠·짧은 시트·키(PageDown·Space·방향키)로 뒤 문서 scrollY 불변,
// 닫은 뒤 위치 복원, 스크롤바 폭 밀림 0(고전 스크롤바), 결정 시트→기록 시트로 이어질 때 튐 0, 변이 점검(잠금 클래스를 떼면 같은 시험이 실패).
// 사용: node qa/scripts/m7c-scroll.mjs [케이스ID 일부]
import { chromium } from 'playwright-core';
import { launch, openOracle, plainLife, dueStateFor, openSeeded, pendingState, decisionBeforeDue, openManual, sheetReady, readNote, readCard, shot, sleep, runCase, evalCore, mkctx, PROD, TOUCH, GAME_KEY, SETTINGS_KEY, SAVE_VERSION, settingsEnvelope, SET_MANUAL } from './m7c-r2-lib.mjs';

const ONLY = process.argv[2] || '';
const mk = () => {
  const checks = [];
  return { checks, chk: (name, ok, detail) => checks.push({ name, ok: !!ok, detail: detail === undefined ? '' : String(detail).slice(0, 300) }) };
};
const done = (checks, shots = [], extra = {}) => {
  const bad = checks.filter((x) => !x.ok);
  return { verdict: bad.length ? 'FAIL' : 'PASS', actual: bad.length ? `실패 ${bad.length}: ${bad.map((x) => `${x.name} [${x.detail}]`).join(' | ')}` : `검사 ${checks.length}건 통과${extra.note ? ' — ' + extra.note : ''}`, checks, shots };
};
const run = (c, fn) => (!ONLY || c.id.includes(ONLY) ? runCase({ cat: '스크롤 잠금', ...c }, fn) : null);

const b = await launch();
const { page: oracle } = await openOracle(b);
const base = await plainLife(oracle, { era: 'present', seed: 4242, age: 9 });
const pend = await pendingState(oracle, { era: 'present', seed: 4242, minAge: 12, paused: true });
const infant = await dueStateFor(oracle, 'note-infant-memory', { era: 'present', paused: true });
// 짧은 결정 시트(선택지 2개·인용 없음) — 시트 안에 스크롤이 없어 휠·키가 곧바로 문서로 넘어가는 최악의 경우
const shortDec = await evalCore(
  oracle,
  `const { EVENT_POOL } = await import('/src/data/events/index.ts');
   for (let seed = 1; seed < 3000; seed++) {
     let s = core.enterLife(core.enterBirth(core.beginBirth(core.createInitialState(seed), 'present')));
     for (let guard = 0; guard < 80 && s.phase === 'life'; guard++) {
       s = core.advanceUntilDecision(s, undefined, 'consume').state;
       if (s.phase !== 'life' || s.pending === null) break;
       const ev = EVENT_POOL.byId.get(s.pending.eventId);
       if (s.pending.choiceIds.length === 2 && ev !== undefined && core.citationIdFor(ev, 'present') === null && (ev.text ?? '').length < 120 && s.age >= 8) return { ...s, paused: true };
       s = core.resolveChoice(s, s.pending.key, s.pending.choiceIds[0]);
     }
   }
   return null;`,
);

const SHEETS = [
  { id: 'note-manual', label: '기록 시트(수동)', state: base, open: async (p) => { await p.evaluate(() => document.querySelector('[data-testid="tool-note"]').click()); await sheetReady(p); }, wait: '[data-testid="note-sheet"]', close: async (p) => { await p.keyboard.press('Escape'); await sleep(300); } },
  { id: 'note-auto', label: '기록 시트(자동 ①, 인용 있음)', state: infant, open: async () => {}, wait: '[data-testid="note-sheet"]', close: async (p) => { await p.getByTestId('note-skip').click(); /* 2회차: 합성 터치 끌기 직후의 첫 탭은 크로뮴 에뮬레이션에서 소비되어(최소 페이지에서도 재현) 닫기는 마우스 클릭으로 */ await sleep(300); } },
  { id: 'decision-short', label: '결정 시트(짧은 시트: 선택지 2·인용 없음)', state: shortDec, open: async () => {}, wait: '[data-testid="choice-panel"]', close: async (p) => { await p.waitForFunction(() => { const bt = document.querySelector('[data-testid="decision-fold-btn"]'); return bt && bt.getAttribute('aria-disabled') !== 'true' && !bt.disabled; }, null, { timeout: 5000 }); await p.getByTestId('decision-fold-btn').click(); await sleep(400); } },
  { id: 'decision-long', label: '결정 시트(긴 시트)', state: pend, open: async () => {}, wait: '[data-testid="choice-panel"]', close: async (p) => { await p.waitForFunction(() => { const bt = document.querySelector('[data-testid="decision-fold-btn"]'); return bt && bt.getAttribute('aria-disabled') !== 'true' && !bt.disabled; }, null, { timeout: 5000 }); await p.getByTestId('decision-fold-btn').click(); await sleep(400); } },
];

const Y0 = 300;
const sy = (p) => p.evaluate(() => Math.round(window.scrollY));

async function touchDrag(cdp, x, y0, y1, steps = 8) {
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y: y0 }] });
  for (let i = 1; i <= steps; i++) {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: y0 + ((y1 - y0) * i) / steps }] });
    await sleep(12);
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await sleep(120);
}

// ------------------------------------------------------------------ 터치: 바탕 드래그 (360x740)
for (const S of SHEETS) {
  if (!S.state) continue;
  await run({ id: `S-touch-${S.id}`, title: `${S.label}: 시트 바깥(어두운 바탕)에서 터치로 쓸어도 뒤 문서 scrollY 불변`, steps: '360×740 터치, 문서를 스크롤한 채 시트를 열고 CDP 터치로 바탕(스크림)을 위·아래로 6번씩 쓸기', expected: 'scrollY 유지(열 때 튐 0), 닫은 뒤 잠금 해제(기록 시트는 위치 복원), 변이 점검(잠금을 떼면 문서가 움직임)', }, async () => {
    const { checks, chk } = mk();
    const shots = [];
    const { ctx, page } = await openSeeded(b, S.state, { wait: S.state === base ? '[data-testid="life-screen"]' : S.wait });
    const range = await page.evaluate(() => document.documentElement.scrollHeight - window.innerHeight);
    const Y = Math.min(300, Math.max(60, range - 40));
    chk('문서가 스크롤 가능(시험 전제)', range > 120, `스크롤 범위 ${range}px`);
    await page.evaluate((y) => window.scrollTo(0, y), Y);
    await sleep(250);
    const before = await sy(page);
    await S.open(page);
    await sleep(300);
    await page.waitForSelector(S.wait, { timeout: 5000 });
    const lock = await page.evaluate(() => document.documentElement.classList.contains('sheet-open'));
    chk('열린 동안 잠금 클래스', lock, '');
    const afterOpen = await sy(page);
    chk('열 때 scrollY 튐 0', afterOpen === before, `${before}→${afterOpen}`);
    const cdp = await ctx.newCDPSession(page);
    const rect = await page.evaluate(() => {
      const s = document.querySelector('.sheet');
      return { top: s.getBoundingClientRect().top };
    });
    chk('바탕(시트 위쪽)에 드래그할 자리가 있음', rect.top > 20, `시트 위쪽 ${Math.round(rect.top)}px`);
    const yHi = Math.max(8, Math.floor(rect.top) - 6);
    for (let i = 0; i < 6; i++) {
      await touchDrag(cdp, 180, yHi, 2);
      await touchDrag(cdp, 180, 2, yHi);
    }
    const afterDrag = await sy(page);
    chk('바탕 드래그 뒤 scrollY 불변', afterDrag === before, `${before}→${afterDrag}`);
    shots.push(await shot(page, `S-touch-${S.id}`, 'open'));
    // 변이 점검: 문서 잠금 클래스와 스크림의 touch-action을 떼면 같은 드래그가 문서를 움직인다(시험에 이빨이 있다)
    await page.evaluate(() => {
      document.documentElement.classList.remove('sheet-open');
      document.querySelectorAll('.overlay').forEach((o) => (o.style.touchAction = 'auto'));
    });
    for (let i = 0; i < 3; i++) await touchDrag(cdp, 180, yHi, 2);
    const mutated = await sy(page);
    chk('변이 점검: 잠금을 떼면 문서가 움직임(검증 도구가 유효)', mutated !== before, `${before}→${mutated}`);
    await page.evaluate(([y]) => {
      document.documentElement.classList.add('sheet-open');
      document.querySelectorAll('.overlay').forEach((o) => (o.style.touchAction = ''));
      window.scrollTo(0, y);
    }, [before]);
    await S.close(page);
    await sleep(400);
    const closed = await page.evaluate(() => ({ y: Math.round(window.scrollY), locked: document.documentElement.classList.contains('sheet-open') }));
    chk('닫은 뒤 잠금 해제', !closed.locked, '');
    if (S.id.startsWith('note')) chk('닫은 뒤 위치 복원', closed.y === before, `${before}→${closed.y}`);
    await ctx.close();
    return done(checks, shots);
  });
}

// ------------------------------------------------------------------ 데스크톱: 휠·키 (1280x800, 짧은 시트 포함)
for (const S of SHEETS) {
  if (!S.state) continue;
  await run({ id: `S-wheel-${S.id}`, title: `${S.label}: 데스크톱 휠(바탕·시트 위)·PageDown·Space·방향키·End로 뒤 문서 scrollY 불변`, steps: '1280×800, scrollY=300에서 시트를 열고 바탕/시트 위 휠 6번, 키 입력', expected: 'scrollY 300 유지', }, async () => {
    const { checks, chk } = mk();
    const shots = [];
    const { ctx, page } = await openSeeded(b, S.state, { vp: { width: 1280, height: 800 }, touch: false, wait: S.state === base ? '[data-testid="life-screen"]' : S.wait });
    const range = await page.evaluate(() => document.documentElement.scrollHeight - window.innerHeight);
    const Y = Math.min(300, Math.max(60, range - 40));
    chk('문서가 스크롤 가능(시험 전제)', range > 120, `스크롤 범위 ${range}px`);
    await page.evaluate((y) => window.scrollTo(0, y), Y);
    await sleep(250);
    const before = await sy(page);
    await S.open(page);
    await sleep(300);
    await page.waitForSelector(S.wait, { timeout: 5000 });
    const sheet = await page.evaluate(() => {
      const s = document.querySelector('.sheet');
      const r = s.getBoundingClientRect();
      return { top: r.top, left: r.left, w: r.width, h: r.height, overflow: s.scrollHeight - s.clientHeight };
    });
    // 바탕 위 휠
    for (let i = 0; i < 6; i++) {
      await page.mouse.move(40, Math.max(20, sheet.top / 2));
      await page.mouse.wheel(0, 500);
      await sleep(60);
    }
    for (let i = 0; i < 3; i++) {
      await page.mouse.move(40, Math.max(20, sheet.top / 2));
      await page.mouse.wheel(0, -500);
      await sleep(60);
    }
    chk('바탕 위 휠 뒤 scrollY 불변', (await sy(page)) === before, `${before}→${await sy(page)}`);
    // 시트 위 휠(짧은 시트는 안이 안 움직여 문서로 넘어가는 경우)
    for (let i = 0; i < 6; i++) {
      await page.mouse.move(sheet.left + sheet.w / 2, sheet.top + 60);
      await page.mouse.wheel(0, 600);
      await sleep(60);
    }
    chk('시트 위 휠(끝까지 쓸어도) scrollY 불변', (await sy(page)) === before, `${before}→${await sy(page)} (시트 안 넘침 ${sheet.overflow}px)`);
    // 키
    for (const k of ['PageDown', 'Space', 'ArrowDown', 'End', 'PageUp', 'ArrowUp', 'Home']) {
      await page.keyboard.press(k);
      await sleep(80);
    }
    chk('PageDown·Space·방향키·End·Home 뒤 scrollY 불변', (await sy(page)) === before, `${before}→${await sy(page)}`);
    shots.push(await shot(page, `S-wheel-${S.id}`, 'open'));
    // 변이 점검
    await page.evaluate(() => document.documentElement.classList.remove('sheet-open'));
    for (let i = 0; i < 4; i++) {
      await page.mouse.move(40, Math.max(20, sheet.top / 2));
      await page.mouse.wheel(0, 500);
      await sleep(60);
    }
    const mutated = await sy(page);
    chk('변이 점검: 잠금을 떼면 휠이 문서를 움직임', mutated !== before, `${before}→${mutated}`);
    await page.evaluate((y) => { document.documentElement.classList.add('sheet-open'); window.scrollTo(0, y); }, before);
    await ctx.close();
    return done(checks, shots);
  });
}

// ------------------------------------------------------------------ 스크롤바 폭 밀림 0 (고전 스크롤바 — 헤드리스의 --hide-scrollbars 제거)
await run({ id: 'S-scrollbar', title: '1280×620 고전 스크롤바: 시트 열기·닫기 전후 documentElement.clientWidth·주요 요소 x 불변(본문 밀림 0)', steps: '1280×620(문서가 스크롤되는 높이), --hide-scrollbars 없이 열고, 기록 시트·결정 시트 열기/닫기', expected: 'clientWidth·헤더 x/폭 불변', }, async () => {
  const { checks, chk } = mk();
  const shots = [];
  const b2 = await chromium.launch({ headless: true, ignoreDefaultArgs: ['--hide-scrollbars'] });
  try {
    for (const S of [SHEETS[0], SHEETS[3]]) {
      const ctx = await mkctx(b2, { viewport: { width: 1280, height: 620 } });
      await ctx.addInitScript(([k, v, sk, sv]) => { try { if (!sessionStorage.getItem('__s')) { localStorage.clear(); localStorage.setItem(k, v); localStorage.setItem(sk, sv); sessionStorage.setItem('__s', '1'); } } catch {} }, [GAME_KEY, JSON.stringify({ version: SAVE_VERSION, data: S.state }), SETTINGS_KEY, settingsEnvelope(SET_MANUAL)]);
      const page = await ctx.newPage();
      await page.goto(PROD, { waitUntil: 'load' });
      await page.waitForSelector('[data-testid="life-screen"]');
      await sleep(400);
      const meas = () => page.evaluate(() => {
        const h = document.querySelector('[data-testid="dash-head"]') || document.querySelector('header');
        const r = h ? h.getBoundingClientRect() : { x: 0, width: 0 };
        const card = document.querySelector('[data-testid="profile-card"]');
        const c = card ? card.getBoundingClientRect() : { x: 0, width: 0 };
        return { clientW: document.documentElement.clientWidth, innerW: window.innerWidth, headX: Math.round(r.x * 10) / 10, headW: Math.round(r.width * 10) / 10, cardX: Math.round(c.x * 10) / 10, cardW: Math.round(c.width * 10) / 10 };
      });
      const m0 = await meas();
      chk(`${S.label}: 고전 스크롤바가 실제로 있음(시험 전제 — 결정 시트는 로드 때 이미 열려 있어 잠긴 상태가 기준)`, S.id !== 'note-manual' || m0.innerW - m0.clientW > 0, JSON.stringify(m0));
      if (S.id === 'note-manual') {
        await page.getByTestId('tool-note').click();
        await sheetReady(page);
      } else {
        await page.waitForSelector('[data-testid="choice-panel"]');
      }
      await sleep(400);
      const m1 = await meas();
      chk(`${S.label}: 열린 동안 clientWidth(밀림) 불변`, m1.clientW + 0 === m0.clientW || m1.innerW - m1.clientW === 0 ? true : false, `전 ${JSON.stringify(m0)} / 중 ${JSON.stringify(m1)}`);
      chk(`${S.label}: 열린 동안 헤더·카드 x·폭 불변`, m1.headX === m0.headX && m1.headW === m0.headW && m1.cardX === m0.cardX && m1.cardW === m0.cardW, `전 ${m0.headX}/${m0.headW}/${m0.cardX}/${m0.cardW} 중 ${m1.headX}/${m1.headW}/${m1.cardX}/${m1.cardW}`);
      shots.push(await shot(page, `S-scrollbar-${S.id}`, 'open'));
      if (S.id === 'note-manual') await page.keyboard.press('Escape');
      else {
        await page.waitForFunction(() => { const bt = document.querySelector('[data-testid="decision-fold-btn"]'); return bt && bt.getAttribute('aria-disabled') !== 'true' && !bt.disabled; }, null, { timeout: 5000 });
        await page.getByTestId('decision-fold-btn').click();
      }
      await sleep(500);
      const m2 = await meas();
      chk(`${S.label}: 닫은 뒤 원래대로(헤더·카드 x·폭 불변${S.id === 'note-manual' ? '·clientWidth 복원' : ''})`, (S.id !== 'note-manual' || m2.clientW === m0.clientW) && m2.headX === m0.headX && m2.headW === m0.headW && m2.cardX === m0.cardX && m2.cardW === m0.cardW, `전 ${JSON.stringify(m0)} / 후 ${JSON.stringify(m2)}`);
      await ctx.close();
    }
  } finally {
    await b2.close();
  }
  return done(checks, shots);
});

// ------------------------------------------------------------------ 결정 시트 → 기록 시트로 이어질 때 튐 0
const dbd = await decisionBeforeDue(oracle, { era: 'present', paused: true });
await run({ id: 'S-handoff', title: '결정 시트 → 기록 시트로 이어질 때 scrollY 튐 0, 잠금이 풀렸다 다시 걸리는 사이에도 위치가 유지', steps: 'scrollY=300에서 결정 시트의 선택을 고르고 기록 시트가 이어서 뜨는 동안 매 프레임 scrollY를 잰다', expected: '모든 프레임에서 300, 잠금 클래스가 끝까지 유지(풀린 프레임 0)', }, async () => {
  const { checks, chk } = mk();
  const shots = [];
  if (!dbd) return { verdict: 'SKIP', actual: '상태를 찾지 못함', shots: [] };
  const { ctx, page } = await openSeeded(b, dbd.state, { wait: '[data-testid="choice-panel"]' });
  await page.evaluate((y) => window.scrollTo(0, y), Y0);
  await sleep(300);
  await page.waitForFunction(() => { const bt = document.querySelector('[data-testid="decision-fold-btn"]'); return bt && bt.getAttribute('aria-disabled') !== 'true' && !bt.disabled; }, null, { timeout: 6000 });
  await page.evaluate(() => {
    window.__ys = new Set();
    window.__unlocked = 0;
    window.__frames = 0;
    const tick = () => {
      window.__ys.add(Math.round(window.scrollY));
      if (!document.documentElement.classList.contains('sheet-open')) window.__unlocked++;
      window.__frames++;
      window.__raf = requestAnimationFrame(tick);
    };
    tick();
  });
  const before = await sy(page);
  await page.getByTestId(`choice-${dbd.choiceId}`).tap();
  await sleep(1500);
  const r = await page.evaluate(() => ({ ys: [...window.__ys], unlocked: window.__unlocked, frames: window.__frames }));
  chk('기록 시트가 이어서 뜸', (await readNote(page)).present, '');
  chk('모든 프레임에서 scrollY 같음', r.ys.length === 1 && r.ys[0] === before, JSON.stringify(r));
  chk('잠금이 풀린 프레임 0', r.unlocked === 0, `${r.unlocked}/${r.frames}`);
  shots.push(await shot(page, 'S-handoff', 'note-open'));
  await ctx.close();
  return done(checks, shots);
});

// ------------------------------------------------------------------ 연속·열린 시트 연타에도 잠금 개수가 틀어지지 않는다
await run({ id: 'S-refcount', title: '열고 닫기·새로고침·연타를 되풀이한 뒤 잠금이 남지 않는다(문서가 영영 못 움직이는 일 0)', steps: '수동 시트를 20번 열고 닫고(2번·Esc) 마지막에 문서 휠', expected: 'sheet-open 클래스 0, 휠로 문서 스크롤 가능', }, async () => {
  const { checks, chk } = mk();
  const { ctx, page } = await openSeeded(b, base, { vp: { width: 1280, height: 800 }, touch: false });
  for (let i = 0; i < 20; i++) {
    await page.getByTestId('tool-note').click();
    await sheetReady(page);
    if (i % 2) await page.keyboard.press('Escape');
    else await page.getByTestId('note-skip').click();
    await page.waitForSelector('[data-testid="note-sheet"]', { state: 'detached', timeout: 3000 });
    await sleep(450);
  }
  const cls = await page.evaluate(() => ({ locked: document.documentElement.classList.contains('sheet-open'), pad: document.documentElement.style.getPropertyValue('--scrollbar-w') }));
  chk('잠금 클래스·변수 남지 않음', !cls.locked && cls.pad === '', JSON.stringify(cls));
  await page.mouse.move(640, 400);
  await page.mouse.wheel(0, 600);
  await sleep(300);
  chk('문서가 다시 스크롤됨', (await sy(page)) > 0, `${await sy(page)}`);
  await ctx.close();
  return done(checks);
});

await b.close();
