// QA-003 M7b 공격 2: 자동 끄기 더블탭, 탭 가림, 나가기 확인 + 다음 결정으로 + Esc, 탭 닫기 복원, 키보드·스크린리더 순서, 저장 변조
// 사용: node qa/scripts/m7b-attack2.mjs [케이스ID 일부 문자열]
import fs from 'node:fs';
import path from 'node:path';
import { launch, sleep, OUT, mkctx, PROD, DEV, GAME_KEY, SETTINGS_KEY, shot, runCase, readCard, readSave, choiceCount, con, settingsEnvelope, SET_MANUAL, SET_AUTO, cardReady, injectSave, evalCore, findCardState, TOUCH } from './m7b-lib.mjs';
import { openCard, VPS } from './m7b-audit.mjs';

const ONLY = process.argv[2] || '';
const run = (c, fn) => (!ONLY || c.id.includes(ONLY) ? runCase({ cat: '공격', ...c }, fn) : null);
const browser = await launch();
const VP360 = VPS[2];
const STATES = path.join(OUT, 'states');
const loadState = (n) => JSON.parse(fs.readFileSync(path.join(STATES, `${n}.json`), 'utf8'));

const hist = async (page) => choiceCount(await readSave(page));
const dashSnap = (page) =>
  page.evaluate(() => {
    const q = (s) => document.querySelector(s);
    return {
      auto: q('[data-testid="auto"]')?.getAttribute('aria-pressed') ?? null,
      exitAsk: !!q('[data-testid="exit-ask"]'),
      panels: document.querySelectorAll('[data-testid="choice-panel"]').length,
      folds: document.querySelectorAll('[data-testid="decision-fold"]').length,
      dialogs: document.querySelectorAll('[role="dialog"]').length,
      speed: q('[data-speed][aria-pressed="true"]')?.getAttribute('data-speed') ?? null,
      paused: q('[data-testid="pause"]')?.getAttribute('data-paused') ?? null,
      dark: q('[data-testid="tool-dark"]')?.getAttribute('aria-pressed') ?? null,
    };
  });
const setVis = (page, v) => page.evaluate((x) => { window.__vis = x; document.dispatchEvent(new Event('visibilitychange')); }, v);

// ------------------------------------------------------------------ A07 자동 끄기 직후 더블탭
await run({ id: 'A07', title: '자동 모드 끄기 직후 더블탭 — 인라인 카드가 시트로 바뀌는 순간 같은 자리를 다시 탭해도 선택지 오탭 0', steps: '터치 360x740, 자동 인라인 카드(탭 가림으로 자동 선택 정지) 5종에서 「자동 모드」 버튼 중심을 탭 → 40·100·200·350ms 뒤 같은 좌표를 다시 탭', expected: '선택 기록 불변(둘째 탭이 시트의 선택지·접기 버튼에 떨어지지 않음)', }, async () => {
  const bad = [];
  const rows = [];
  const shots = [];
  for (const name of ['tutoring-present', 'sibling-past', 'startup-present', 'layoff-future', 'estate-present']) {
    for (const gap of [40, 100, 200, 350]) {
      const { ctx, page } = await openCard(browser, name, 'inline', { vp: VP360, hidden: true });
      await cardReady(page);
      const base = await hist(page);
      const bb = await page.getByTestId('auto').boundingBox();
      const x = bb.x + bb.width / 2;
      const y = bb.y + bb.height / 2;
      await page.touchscreen.tap(x, y);
      await sleep(gap);
      // 둘째 탭 자리에 무엇이 있는가
      const under = await page.evaluate(([px, py]) => { const e = document.elementFromPoint(px, py); return e ? (e.closest('[data-testid]')?.getAttribute('data-testid') || e.className || e.tagName) : null; }, [x, y]);
      await page.touchscreen.tap(x, y);
      await sleep(700);
      const h = await hist(page);
      const d = await dashSnap(page);
      rows.push(`${name}/${gap}ms: 둘째 탭 자리=${under} 선택 ${h - base} auto=${d.auto} 패널 ${d.panels}·띠 ${d.folds}`);
      if (h !== base) bad.push(`${name}/${gap}ms: 둘째 탭이 선택으로 기록됨(자리=${under})`);
      if (d.panels + d.folds !== 1) bad.push(`${name}/${gap}ms: 카드 ${d.panels}+${d.folds}`);
      if (name === 'tutoring-present' && gap === 100) shots.push(await shot(page, 'A07', 'after-double-tap'));
      await ctx.close();
    }
  }
  return { verdict: bad.length ? 'FAIL' : 'PASS', actual: bad.length ? bad.slice(0, 4).join(' / ') + ' || 샘플: ' + rows.slice(0, 3).join(' | ') : `5종 × 4간격 = 20조합 모두 선택 불변. 둘째 탭 자리: ${[...new Set(rows.map((r) => r.match(/자리=(\S+)/)[1]))].join(', ')} · 예 ${rows[0]}`, shots };
});

// ------------------------------------------------------------------ A08 탭 가림 뒤 복귀
await run({ id: 'A08', title: '탭 가림 뒤 복귀 — 접힘 유지, 자동 타이머는 가린 동안 멈추고 복귀 뒤 재개, 수동 시트는 그대로', steps: '(a) 자동 모드에서 접은 채 탭 가림 5초 → 복귀 → 4초 (b) 자동 인라인 카드, 1초 뒤 가림 5초 → 복귀 → 선택까지 시간 (c) 수동 시트 가림 3초 → 복귀', expected: '(a) 접힘 유지·선택 0 (b) 가린 동안 선택 0, 복귀 뒤 약 3초 뒤 선택 (c) 시트·포커스 유지', }, async () => {
  const bad = [];
  const rows = [];
  // (a)
  {
    const { ctx, page } = await openCard(browser, 'tutoring-present', 'inline', { vp: VP360, hidden: false, vishook: true });
    await cardReady(page);
    const base = await hist(page);
    await page.getByTestId('decision-fold-btn').tap();
    await page.waitForSelector('[data-testid="decision-fold"]');
    await setVis(page, 'hidden');
    await sleep(5000);
    await setVis(page, 'visible');
    await sleep(4200);
    const d = await dashSnap(page);
    const h = await hist(page);
    rows.push(`(a) 접은 채 가림 5초+복귀 4.2초: 띠 ${d.folds}·패널 ${d.panels}·선택 ${h - base}`);
    if (d.folds !== 1 || h !== base) bad.push(`(a) 접힘 유지 실패: 띠 ${d.folds} 선택 ${h - base}`);
    await ctx.close();
  }
  // (b)
  {
    const { ctx, page } = await openCard(browser, 'tutoring-present', 'inline', { vp: VP360, hidden: false, vishook: true });
    await cardReady(page);
    const base = await hist(page);
    await sleep(1000);
    await setVis(page, 'hidden');
    await sleep(5000);
    const hMid = await hist(page);
    const tBack = Date.now();
    await setVis(page, 'visible');
    let dt = null;
    for (let i = 0; i < 80; i++) {
      if ((await hist(page)) > base) {
        dt = Date.now() - tBack;
        break;
      }
      await sleep(100);
    }
    rows.push(`(b) 가린 5초 동안 선택 ${hMid - base}, 복귀 뒤 선택까지 ${dt}ms`);
    if (hMid !== base) bad.push(`(b) 가린 동안 자동 선택 ${hMid - base}`);
    if (dt === null || dt < 2000 || dt > 4500) bad.push(`(b) 복귀 뒤 선택까지 ${dt}ms(기대 약 3000)`);
    await ctx.close();
  }
  // (c)
  {
    const { ctx, page } = await openCard(browser, 'tutoring-present', 'sheet', { vp: VP360, hidden: false, vishook: true });
    await cardReady(page);
    const c0 = await readCard(page);
    await setVis(page, 'hidden');
    await sleep(3000);
    await setVis(page, 'visible');
    await sleep(600);
    const c1 = await readCard(page);
    rows.push(`(c) 수동 시트 가림 3초: ${c1.mode}, 포커스 ${c0.activeTid}→${c1.activeTid}, 다이얼로그 ${c1.dialogCount}`);
    if (c1.mode !== 'sheet' || c1.key !== c0.key) bad.push(`(c) 시트 유지 실패 ${c1.mode}/${c1.key}`);
    await ctx.close();
  }
  return { verdict: bad.length ? 'FAIL' : 'PASS', actual: bad.length ? bad.join(' / ') + ' || ' + rows.join(' | ') : rows.join(' | '), shots: [] };
});

// ------------------------------------------------------------------ A09 나가기 확인 + 다음 결정으로 + Esc
await run({ id: 'A09', title: '나가기 확인 단계를 연 채 「다음 결정으로」 → 시트 → Esc — 한 동작만(먼저 시트 접기, 다음 Esc가 나가기 확인 닫기)', steps: '카드가 대기 중이지 않은 상태(탭 가림으로 시계 정지)에서 「나가기」 탭 → 확인 단계 → 「다음 결정으로」 → 시트가 뜬 뒤 Esc 한 번, 한 번 더', expected: 'Esc 1번: 카드만 접힘(확인 단계는 그대로), Esc 2번: 확인 단계 닫힘', }, async () => {
  // 대기 카드가 없는 상태: 카드 상태에서 첫 선택지를 적용한 상태
  const oracle = await (await mkctx(browser)).newPage();
  await oracle.goto(DEV, { waitUntil: 'load' });
  await oracle.waitForSelector('[data-testid="title-screen"]');
  const s0 = loadState('tutoring-present');
  const s1 = await evalCore(oracle, 'return core.resolveChoice(arg, arg.pending.key, arg.pending.choiceIds[0]);', s0);
  await oracle.context().close();
  fs.writeFileSync(path.join(STATES, 'nopending-present.json'), JSON.stringify(s1));
  const bad = [];
  const rows = [];
  const { ctx, page } = await openCard(browser, 'nopending-present', 'sheet', { vp: VP360, hidden: true }).catch(() => ({ ctx: null, page: null }));
  void ctx;
  if (page) await ctx.close();
  // openCard는 카드를 기다리므로, 직접 연다
  const ctx2 = await mkctx(browser, { viewport: { width: 360, height: 740 }, ...TOUCH });
  await ctx2.addInitScript(([k, v, sk, sv]) => { try { if (!sessionStorage.getItem('__qa_seeded')) { localStorage.clear(); localStorage.setItem(k, v); localStorage.setItem(sk, sv); sessionStorage.setItem('__qa_seeded', '1'); } } catch {} window.__vis = 'hidden'; Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => window.__vis }); }, [GAME_KEY, JSON.stringify({ version: 8, data: s1 }), SETTINGS_KEY, settingsEnvelope(SET_MANUAL)]);
  const p = await ctx2.newPage();
  await p.goto(PROD, { waitUntil: 'load' });
  await p.waitForSelector('[data-testid="life-screen"]');
  await sleep(600);
  const pre = await dashSnap(p);
  rows.push(`시작: 패널 ${pre.panels}·확인 ${pre.exitAsk}`);
  await p.getByTestId('tool-exit').tap();
  await p.waitForSelector('[data-testid="exit-ask"]');
  const skipState = await p.evaluate(() => { const b = document.querySelector('[data-testid="skip"]'); return b ? { aria: b.getAttribute('aria-disabled'), disabled: b.disabled, inert: !!b.closest('[inert]') } : null; });
  rows.push(`확인 단계 열림, 다음 결정으로 버튼 ${JSON.stringify(skipState)}`);
  const shots = [await shot(p, 'A09', 'exit-ask-open')];
  await p.getByTestId('skip').tap({ timeout: 4000 }).catch((e) => bad.push('다음 결정으로 탭 실패: ' + String(e.message).slice(0, 120)));
  await sleep(1200);
  const c1 = await readCard(p);
  const d1 = await dashSnap(p);
  rows.push(`다음 결정으로 뒤: 모드 ${c1.mode}·확인 단계 ${d1.exitAsk}·다이얼로그 ${d1.dialogs}`);
  shots.push(await shot(p, 'A09', 'sheet-over-exit-ask'));
  if (c1.mode === 'sheet') {
    await cardReady(p);
    await p.keyboard.press('Escape');
    await sleep(500);
    const c2 = await readCard(p);
    const d2 = await dashSnap(p);
    rows.push(`Esc 1번: 모드 ${c2.mode}·확인 단계 ${d2.exitAsk}·포커스 ${c2.activeTid}`);
    if (c2.mode !== 'fold') bad.push(`Esc 1번 뒤 모드 ${c2.mode}(기대 fold)`);
    if (!d2.exitAsk) bad.push('Esc 1번이 확인 단계도 닫음(두 동작)');
    await p.keyboard.press('Escape');
    await sleep(500);
    const d3 = await dashSnap(p);
    const c3 = await readCard(p);
    rows.push(`Esc 2번: 확인 단계 ${d3.exitAsk}·띠 ${d3.folds}·포커스 ${c3.activeTid}`);
    if (d3.exitAsk) bad.push('Esc 2번이 확인 단계를 닫지 못함');
    shots.push(await shot(p, 'A09', 'after-esc-2'));
  } else if (c1.mode === null) {
    rows.push('다음 결정으로를 눌러도 카드가 뜨지 않음(확인 단계 열린 동안 버튼이 무동작이면 정상 — 결정 카드가 안 뜨므로 겹침 자체가 없음)');
  } else {
    bad.push(`카드 모드 ${c1.mode}`);
  }
  await ctx2.close();
  return { verdict: bad.length ? 'FAIL' : 'PASS', actual: bad.length ? bad.join(' / ') + ' || ' + rows.join(' | ') : rows.join(' | '), shots };
});

// ------------------------------------------------------------------ A10 탭 닫기 → 복원
await run({ id: 'A10', title: '카드 열린 채·접힌 채·자동 인라인 상태에서 탭을 닫았다 새로 열기 — 같은 카드가 열린 채 복원(접힘은 사라짐), 선택 0', steps: '(a) 수동 시트 → 탭 닫기 → 새 탭 (b) 접은 뒤 닫기 → 새 탭 (c) 자동 인라인 → 닫기 → 새 탭', expected: '새 탭에 같은 key의 열린 카드(수동 = 시트, 자동 = 인라인), 선택 기록 불변', }, async () => {
  const bad = [];
  const rows = [];
  const shots = [];
  for (const [label, settings, fold] of [['(a) 수동 열린 채', SET_MANUAL, false], ['(b) 수동 접힌 채', SET_MANUAL, true], ['(c) 자동 인라인', { ...SET_AUTO }, false]]) {
    const ctx = await mkctx(browser, { viewport: { width: 360, height: 740 }, ...TOUCH });
    // 가려진 탭 아래서 준비(자동 선택이 닫기 전에 일어나지 않게) → 닫은 뒤 새 탭은 보이는 탭
    const page = await ctx.newPage();
    await page.addInitScript(() => { window.__vis = 'hidden'; Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => window.__vis }); });
    await injectSave(page, loadState('tutoring-present'), PROD, settings);
    await page.waitForSelector('[data-testid="choice-panel"]');
    await cardReady(page);
    const key0 = (await readCard(page)).key;
    const base = await hist(page);
    if (fold) {
      await page.getByTestId('decision-fold-btn').tap();
      await page.waitForSelector('[data-testid="decision-fold"]');
      await sleep(300);
    }
    await page.close({ runBeforeUnload: true });
    await sleep(300);
    const p2 = await ctx.newPage();
    await p2.addInitScript(() => { window.__vis = 'hidden'; Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => window.__vis }); });
    await p2.goto(PROD, { waitUntil: 'load' });
    await p2.waitForSelector('[data-testid="life-screen"]', { timeout: 10000 }).catch(() => bad.push(`${label}: 생애 화면 없음`));
    await sleep(500);
    const c = await readCard(p2);
    const h = await hist(p2);
    rows.push(`${label}: 복원 모드 ${c.mode}, key 같음 ${c.key === key0}, 선택 ${h - base}`);
    const want = settings.autoMode ? 'inline' : 'sheet';
    if (c.mode !== want) bad.push(`${label}: 모드 ${c.mode}(기대 ${want})`);
    if (c.key !== key0) bad.push(`${label}: key ${c.key}`);
    if (h !== base) bad.push(`${label}: 선택 ${h - base}`);
    shots.push(await shot(p2, 'A10', label.slice(1, 2)));
    await ctx.close();
  }
  return { verdict: bad.length ? 'FAIL' : 'PASS', actual: bad.length ? bad.join(' / ') : rows.join(' | '), shots };
});

// ------------------------------------------------------------------ K01 키보드만
await run({ id: 'K01', cat: '접근성', title: '키보드만: 시트 안 Tab 순회(앞뒤)·Esc 접기·Enter 다시 열기·Space/Enter 선택', steps: '수동 시트에서 Tab 16번·Shift+Tab 16번 포커스 요소를 기록, Esc, 다시 열기 Enter, 선택지에 Tab으로 가 Space', expected: '모든 포커스가 시트 안(또는 문서 밖으로만 빠짐), Esc → 다시 열기에 포커스, Enter → 제목에 포커스, Space/Enter로 선택 +1', }, async () => {
  const bad = [];
  const rows = [];
  const { ctx, page } = await openCard(browser, 'tutoring-present', 'sheet', { vp: { width: 1280, height: 800 }, hidden: true });
  await cardReady(page);
  await sleep(300);
  const base = await hist(page);
  const act = () => page.evaluate(() => { const a = document.activeElement; return a ? { tid: a.getAttribute('data-testid') || a.tagName, inDialog: !!a.closest('[role="dialog"]'), body: a === document.body } : null; });
  const fwd = [];
  for (let i = 0; i < 16; i++) { await page.keyboard.press('Tab'); await sleep(40); const a = await act(); fwd.push(a.body ? '(문서 밖)' : a.tid); if (!a.body && !a.inDialog) bad.push(`Tab ${i + 1}: 시트 밖 ${a.tid}`); }
  const bwd = [];
  for (let i = 0; i < 16; i++) { await page.keyboard.press('Shift+Tab'); await sleep(40); const a = await act(); bwd.push(a.body ? '(문서 밖)' : a.tid); if (!a.body && !a.inDialog) bad.push(`Shift+Tab ${i + 1}: 시트 밖 ${a.tid}`); }
  rows.push('Tab: ' + fwd.slice(0, 8).join('>') + ' … / Shift+Tab: ' + bwd.slice(0, 6).join('>'));
  const seen = new Set([...fwd, ...bwd]);
  for (const need of ['decision-fold-btn', 'choice-academy', 'choice-alone', 'choice-tutor']) if (!seen.has(need)) bad.push(`키보드로 ${need}에 닿지 못함`);
  const shots = [await shot(page, 'K01', 'tab-focus')];
  await page.keyboard.press('Escape');
  await sleep(300);
  let a = await act();
  rows.push(`Esc → ${a.tid}`);
  if (a.tid !== 'decision-reopen') bad.push(`Esc 뒤 포커스 ${a.tid}`);
  await page.waitForFunction(() => { const b = document.querySelector('[data-testid="decision-reopen"]'); return b && b.getAttribute('aria-disabled') !== 'true'; });
  await page.keyboard.press('Enter');
  await sleep(300);
  a = await act();
  rows.push(`Enter(다시 열기) → ${a.tid}`);
  if (a.tid !== 'choice-title') bad.push(`다시 열기 뒤 포커스 ${a.tid}`);
  await cardReady(page);
  await sleep(300);
  await page.keyboard.press('Tab'); // 제목 다음 = 첫 선택지 혹은 접기 버튼
  for (let i = 0; i < 6 && (await act()).tid !== 'choice-alone'; i++) await page.keyboard.press('Tab');
  a = await act();
  if (a.tid === 'choice-alone') {
    await page.keyboard.press('Space');
    await sleep(700);
    const h = await hist(page);
    rows.push(`Space(choice-alone) → 선택 +${h - base}`);
    if (h !== base + 1) bad.push(`Space 선택 +${h - base}`);
  } else bad.push(`choice-alone로 Tab 못 감(${a.tid})`);
  await ctx.close();
  return { verdict: bad.length ? 'FAIL' : 'PASS', actual: bad.length ? bad.join(' / ') + ' || ' + rows.join(' | ') : rows.join(' | '), shots };
});

await run({ id: 'K02', cat: '접근성', title: '키보드: 자동 모드 인라인 카드에서 Esc 무동작, Tab으로 컨트롤(자동 모드 끄기)에 닿고 Enter로 끈다', steps: '자동 인라인 카드에서 Esc, Tab으로 「자동 모드」 버튼까지 가서 Enter', expected: 'Esc 무동작, 자동 모드 버튼에 키보드로 닿고 Enter로 꺼짐 → 시트', }, async () => {
  const bad = [];
  const rows = [];
  const { ctx, page } = await openCard(browser, 'tutoring-present', 'inline', { vp: { width: 1280, height: 800 }, hidden: true });
  await cardReady(page);
  await page.keyboard.press('Escape');
  await sleep(300);
  const d0 = await dashSnap(page);
  if (d0.panels !== 1 || d0.folds !== 0) bad.push(`인라인에서 Esc가 동작함 패널 ${d0.panels} 띠 ${d0.folds}`);
  rows.push(`Esc: 패널 ${d0.panels}·띠 ${d0.folds}`);
  let reached = false;
  const path_ = [];
  for (let i = 0; i < 30; i++) {
    await page.keyboard.press('Tab');
    await sleep(40);
    const tid = await page.evaluate(() => document.activeElement?.getAttribute('data-testid') || document.activeElement?.tagName);
    path_.push(tid);
    if (tid === 'auto') { reached = true; break; }
  }
  rows.push(`Tab 경로: ${path_.join('>')}`);
  if (!reached) bad.push('자동 모드 버튼에 키보드로 닿지 못함');
  else {
    await page.keyboard.press('Enter');
    await sleep(500);
    const c = await readCard(page);
    rows.push(`Enter → 자동 ${c.auto}, 모드 ${c.mode}`);
    if (c.auto !== 'false' || c.mode !== 'sheet') bad.push(`자동 끄기 뒤 auto=${c.auto} mode=${c.mode}`);
  }
  const shots = [await shot(page, 'K02', 'after-auto-off-keyboard')];
  await ctx.close();
  return { verdict: bad.length ? 'FAIL' : 'PASS', actual: bad.length ? bad.join(' / ') + ' || ' + rows.join(' | ') : rows.join(' | '), shots };
});

// ------------------------------------------------------------------ K03 스크린리더 낭독 순서
await run({ id: 'K03', cat: '접근성', title: '스크린리더 낭독 순서: 대화상자(이름=제목) → 제목 h2 → 상황 → 인용(통계/연구 라벨 → 요약 → 출처) → 선택지(이름 = 라벨 + 영향 문장) → 안내', steps: '수동 시트의 CDP 접근성 트리를 문서 순서로 훑어 읽히는 글(StaticText·역할)을 모은다', expected: '순서 제목 → 상황 → 인용 → 선택지 → 영향 안내 → 자동 모드 안내, 기호 ▲▼ 안 읽힘', }, async () => {
  const bad = [];
  const rows = [];
  for (const name of ['sibling-past', 'tutoring-present']) {
    const { ctx, page } = await openCard(browser, name, 'sheet', { vp: { width: 360, height: 740 }, hidden: true });
    await cardReady(page);
    const cdp = await ctx.newCDPSession(page);
    await cdp.send('DOM.enable');
    await cdp.send('Accessibility.enable');
    const { root } = await cdp.send('DOM.getDocument', { depth: 0 });
    const { nodeId } = await cdp.send('DOM.querySelector', { nodeId: root.nodeId, selector: '[role="dialog"]' });
    const { node } = await cdp.send('DOM.describeNode', { nodeId });
    const { nodes } = await cdp.send('Accessibility.getFullAXTree');
    const byId = new Map(nodes.map((n) => [n.nodeId, n]));
    const start = nodes.find((n) => n.backendDOMNodeId === node.backendNodeId);
    const seq = [];
    const walk = (n, depth) => {
      if (!n) return;
      if (!n.ignored) {
        const role = n.role?.value;
        const nm = n.name?.value || '';
        if (role === 'StaticText' || role === 'heading' || role === 'button' || role === 'dialog' || role === 'group' || role === 'paragraph') seq.push({ role, name: nm.slice(0, 60), level: n.properties?.find((p) => p.name === 'level')?.value?.value });
      }
      for (const c of n.childIds ?? []) walk(byId.get(c), depth + 1);
    };
    walk(start, 0);
    const idx = (pred) => seq.findIndex(pred);
    const iDialog = idx((x) => x.role === 'dialog');
    const iH = idx((x) => x.role === 'heading');
    const iCiteKind = idx((x) => x.role === 'StaticText' && /^(통계|연구)$/.test(x.name));
    const iSit = idx((x) => x.role === 'StaticText' && x.name.length > 15 && iH >= 0);
    const iChoiceBtn = idx((x) => x.role === 'button' && /^(동생|서운|일부러|성적|학원|혼자|과외|직접|남이)/.test(x.name));
    const iHint = idx((x) => x.role === 'StaticText' && /선택지 아래 글씨/.test(x.name));
    const iAuto = idx((x) => x.role === 'StaticText' && /자동 모드가/.test(x.name));
    const dialogName = seq[iDialog]?.name;
    const headingName = seq[iH]?.name;
    rows.push(`${name}: 다이얼로그「${dialogName}」 제목 h${seq[iH]?.level}「${headingName}」 순서 idx 제목${iH}<인용${iCiteKind}<선택지${iChoiceBtn}<안내${iHint}<자동${iAuto}`);
    if (dialogName !== headingName) bad.push(`${name}: 대화상자 이름 ≠ 제목`);
    if (seq[iH]?.level !== 2) bad.push(`${name}: 제목 레벨 ${seq[iH]?.level}`);
    if (!(iH < iSit)) bad.push(`${name}: 제목 → 상황 순서 아님`);
    if (iCiteKind >= 0 && !(iSit < iCiteKind && iCiteKind < iChoiceBtn)) bad.push(`${name}: 상황 → 인용 → 선택지 순서 아님 (${iSit},${iCiteKind},${iChoiceBtn})`);
    if (!(iChoiceBtn < iHint && iHint < iAuto)) bad.push(`${name}: 선택지 → 안내 → 자동 안내 순서 아님`);
    const allText = seq.map((x) => x.name).join(' ');
    if (/[▲▼]/.test(allText)) bad.push(`${name}: ▲▼가 읽히는 글자에 있음`);
    fs.writeFileSync(path.join(OUT, `ax-order-${name}.json`), JSON.stringify(seq, null, 1));
    await ctx.close();
  }
  return { verdict: bad.length ? 'FAIL' : 'PASS', actual: bad.length ? bad.join(' / ') + ' || ' + rows.join(' | ') : rows.join(' | '), shots: [] };
});

await browser.close();
