// QA-003 M7b 공격·키보드·상태 케이스 (prod 빌드, 360x740 터치). 사용: node qa/scripts/m7b-attack.mjs [케이스ID 일부 문자열]
// 카드 저장은 qa/results/m7b/states/*.json (m7b-states.mjs). 결과: qa/results/m7b/cases.jsonl, 스크린샷 qa/screenshots/003/M7b-<ID>*.png
import fs from 'node:fs';
import path from 'node:path';
import { launch, sleep, OUT, mkctx, PROD, GAME_KEY, SETTINGS_KEY, shot, runCase, readCard, readSave, choiceCount, con, settingsEnvelope, SET_MANUAL, SET_AUTO, cardReady, TOUCH } from './m7b-lib.mjs';
import { openCard, VPS } from './m7b-audit.mjs';

const ONLY = process.argv[2] || '';
const run = (c, fn) => (!ONLY || c.id.includes(ONLY) ? runCase({ cat: '공격', ...c }, fn) : null);
const browser = await launch();
const VP360 = VPS[2];

const hist = async (page) => choiceCount(await readSave(page));
const dashSnap = (page) =>
  page.evaluate(() => {
    const q = (s) => document.querySelector(s);
    const tx = (s) => (q(s) ? q(s).textContent.replace(/\s+/g, ' ').trim() : null);
    return {
      age: tx('[data-testid="life-age"]'),
      pct: q('[data-testid="year-progress"]')?.getAttribute('aria-valuenow') ?? null,
      speed: q('[data-speed][aria-pressed="true"]')?.getAttribute('data-speed') ?? null,
      auto: q('[data-testid="auto"]')?.getAttribute('aria-pressed') ?? null,
      paused: q('[data-testid="pause"]')?.getAttribute('data-paused') ?? null,
      dark: q('[data-testid="tool-dark"]')?.getAttribute('aria-pressed') ?? null,
      bgm: q('[data-testid="tool-bgm"]')?.getAttribute('aria-pressed') ?? null,
      exitAsk: !!q('[data-testid="exit-ask"]'),
      panels: document.querySelectorAll('[data-testid="choice-panel"]').length,
      folds: document.querySelectorAll('[data-testid="decision-fold"]').length,
      dialogs: document.querySelectorAll('[role="dialog"]').length,
      screen: ['title-screen', 'life-screen', 'ending-screen', 'superseded-screen', 'error-screen'].find((id) => q(`[data-testid="${id}"]`)) || 'unknown',
    };
  });
const same = (a, b, keys) => keys.every((k) => a[k] === b[k]);
const KEYS_CTL = ['age', 'pct', 'speed', 'auto', 'paused', 'dark', 'bgm', 'exitAsk'];

// ------------------------------------------------------------------ A01 접기·다시 열기 연타
await run({ id: 'A01', title: '접기·다시 열기 연타 20회(천천히) + 30Hz 연타 60번 — 카드는 늘 하나, 선택 0, 나이·진행률 불변', steps: '수동 시트 카드(school-tutoring)에서 (a) 가드가 풀릴 때마다 접기·다시 열기를 20번 (b) 접기 버튼·다시 열기 버튼을 30ms 간격으로 60번 누른다', expected: '매 순간 카드(시트 또는 접힌 띠)는 정확히 1개, 선택 기록 0, 나이 불변, 마지막에 열린 카드로 복귀 가능' }, async () => {
  const { ctx, page } = await openCard(browser, 'tutoring-present', 'sheet', { vp: VP360, hidden: true });
  const base = await hist(page);
  const s0 = await dashSnap(page);
  const key0 = (await readCard(page)).key;
  const bad = [];
  // (a) 천천히 20회
  for (let i = 0; i < 20; i++) {
    await cardReady(page);
    await page.getByTestId('decision-fold-btn').click();
    await page.waitForSelector('[data-testid="decision-fold"]', { timeout: 3000 });
    await page.waitForFunction(() => { const b = document.querySelector('[data-testid="decision-reopen"]'); return b && b.getAttribute('aria-disabled') !== 'true' && !b.disabled; }, null, { timeout: 3000 });
    await page.getByTestId('decision-reopen').click();
    await page.waitForSelector('[data-testid="choice-panel"]', { timeout: 3000 });
    const d = await dashSnap(page);
    if (d.panels + d.folds !== 1) bad.push(`(a)${i}: 카드 ${d.panels}+${d.folds}`);
  }
  const mid = await readCard(page);
  if (mid.key !== key0 || mid.mode !== 'sheet') bad.push(`(a) 끝: key ${mid.key} mode ${mid.mode}`);
  // (b) 연타 60번
  let counts = { fold: 0, reopen: 0, miss: 0 };
  for (let i = 0; i < 60; i++) {
    const hasFold = await page.locator('[data-testid="decision-fold-btn"]').count();
    const hasReopen = await page.locator('[data-testid="decision-reopen"]').count();
    if (hasFold) {
      counts.fold++;
      await page.locator('[data-testid="decision-fold-btn"]').click({ timeout: 200, force: true }).catch(() => counts.miss++);
    } else if (hasReopen) {
      counts.reopen++;
      await page.locator('[data-testid="decision-reopen"]').click({ timeout: 200, force: true }).catch(() => counts.miss++);
    }
    await sleep(30);
    const d = await dashSnap(page);
    if (d.panels + d.folds > 1) bad.push(`(b)${i}: 카드 ${d.panels}+${d.folds}`);
  }
  await sleep(600);
  const d2 = await dashSnap(page);
  const after = await hist(page);
  if (after !== base) bad.push(`선택 기록 ${base}→${after}`);
  if (!same(s0, d2, ['age', 'pct'])) bad.push(`나이·진행률 변함 ${s0.age}/${s0.pct} → ${d2.age}/${d2.pct}`);
  if (d2.panels + d2.folds !== 1) bad.push(`끝 카드 ${d2.panels}+${d2.folds}`);
  const fin = await readCard(page);
  if (fin.key !== key0) bad.push(`키 변함 ${fin.key}`);
  const shots = [await shot(page, 'A01', 'after-mash')];
  await ctx.close();
  return { verdict: bad.length ? 'FAIL' : 'PASS', actual: bad.length ? bad.slice(0, 5).join(' / ') : `(a) 20번 모두 카드 1개·시트로 복귀 (b) 30ms 연타 60번(접기 ${counts.fold}·열기 ${counts.reopen}·못 누름 ${counts.miss}) 카드 1개 이하, 선택 기록 ${base}→${after}, 나이·진행률 불변, 같은 카드`, shots };
});

// ------------------------------------------------------------------ A02 접기·다시 열기 직후 더블탭
await run({ id: 'A02', title: '다시 열기 직후 더블탭·접기 더블탭 — 선택지 오탭 0, 다른 컨트롤 오작동 0', steps: '터치 360x740. (a) 접힌 띠에서 「결정 다시 열기」를 50·120·250·380ms 간격 두 번 탭 (b) 다시 열기 직후 첫 선택지 자리를 50~380ms 안에 탭 (c) 「카드 접기」 더블탭(50·120·250ms). 마지막에 가드가 풀린 뒤 한 번 탭하면 정확히 1번 선택', expected: '(a)(b)(c) 모두 선택 0·컨트롤 상태 불변, 가드 뒤 탭은 선택 1' }, async () => {
  const { ctx, page } = await openCard(browser, 'tutoring-present', 'sheet', { vp: VP360, hidden: true });
  const base = await hist(page);
  const bad = [];
  const rows = [];
  const tapAt = async (x, y) => page.touchscreen.tap(x, y);
  const center = async (sel) => {
    const bb = await page.locator(sel).first().boundingBox();
    return bb ? [bb.x + bb.width / 2, bb.y + bb.height / 2] : null;
  };
  const toFold = async () => {
    await cardReady(page);
    await page.getByTestId('decision-fold-btn').tap();
    await page.waitForSelector('[data-testid="decision-fold"]');
    await page.waitForFunction(() => { const b = document.querySelector('[data-testid="decision-reopen"]'); return b && b.getAttribute('aria-disabled') !== 'true' && !b.disabled; }, null, { timeout: 3000 });
  };
  const s0 = await dashSnap(page);
  // (a) 다시 열기 더블탭
  for (const gap of [50, 120, 250, 380]) {
    await toFold();
    const [x, y] = await center('[data-testid="decision-reopen"]');
    await tapAt(x, y);
    await sleep(gap);
    await tapAt(x, y);
    await sleep(700);
    const d = await dashSnap(page);
    const h = await hist(page);
    rows.push(`열기x2(${gap}ms): 패널 ${d.panels}·띠 ${d.folds}·선택 ${h - base}`);
    if (h !== base) bad.push(`열기 더블탭 ${gap}ms: 선택 ${h - base}`);
    if (d.panels !== 1 || d.folds !== 0) bad.push(`열기 더블탭 ${gap}ms: 열린 카드 기대인데 패널 ${d.panels} 띠 ${d.folds}`);
    if (!same(s0, d, KEYS_CTL)) bad.push(`열기 더블탭 ${gap}ms: 컨트롤 상태 변함 ${JSON.stringify(d)}`);
  }
  // (b) 다시 열기 직후 첫 선택지 자리 탭
  for (const gap of [40, 150, 300, 380]) {
    await toFold();
    const [x, y] = await center('[data-testid="decision-reopen"]');
    await tapAt(x, y);
    await page.waitForSelector('[data-testid="choice-panel"]');
    const c1 = await center('.choice');
    await sleep(gap);
    if (c1) await tapAt(c1[0], c1[1]);
    await sleep(500);
    const h = await hist(page);
    const d = await dashSnap(page);
    rows.push(`열기→선택지 탭(${gap}ms): 선택 ${h - base}`);
    if (h !== base) {
      bad.push(`열기 ${gap}ms 뒤 첫 선택지 탭이 선택으로 기록됨(선택 ${h - base})`);
      break;
    }
    if (d.panels !== 1) bad.push(`열기→탭 ${gap}ms: 패널 ${d.panels} 띠 ${d.folds}`);
  }
  // (c) 카드 접기 더블탭
  const dBefore = await dashSnap(page);
  for (const gap of [50, 120, 250]) {
    if ((await dashSnap(page)).folds === 1) {
      await page.getByTestId('decision-reopen').tap();
      await page.waitForSelector('[data-testid="choice-panel"]');
    }
    await cardReady(page);
    const [x, y] = await center('[data-testid="decision-fold-btn"]');
    await tapAt(x, y);
    await sleep(gap);
    await tapAt(x, y);
    await sleep(700);
    const d = await dashSnap(page);
    const h = await hist(page);
    rows.push(`접기x2(${gap}ms): 패널 ${d.panels}·띠 ${d.folds}·선택 ${h - base}·컨트롤 ${same(dBefore, d, KEYS_CTL)}`);
    if (h !== base) bad.push(`접기 더블탭 ${gap}ms: 선택 ${h - base}`);
    if (d.folds !== 1) bad.push(`접기 더블탭 ${gap}ms: 접힌 띠 기대인데 띠 ${d.folds} 패널 ${d.panels}(둘째 탭이 다시 열기를 눌렀나)`);
    if (!same(dBefore, d, KEYS_CTL)) bad.push(`접기 더블탭 ${gap}ms: 컨트롤 변함 ${JSON.stringify(d)}`);
  }
  // 양성 대조: 가드가 풀린 뒤 한 번 탭하면 정확히 1번 선택
  if ((await dashSnap(page)).folds === 1) {
    await page.waitForFunction(() => { const b = document.querySelector('[data-testid="decision-reopen"]'); return b && b.getAttribute('aria-disabled') !== 'true'; });
    await page.getByTestId('decision-reopen').tap();
    await page.waitForSelector('[data-testid="choice-panel"]');
  }
  await cardReady(page);
  await sleep(300);
  const shots = [await shot(page, 'A02', 'before-control-tap')];
  await page.locator('.choice').first().tap();
  await sleep(700);
  const h2 = await hist(page);
  if (h2 !== base + 1) bad.push(`양성 대조: 가드 뒤 탭 선택 ${h2 - base}(기대 1)`);
  await ctx.close();
  return { verdict: bad.length ? 'FAIL' : 'PASS', actual: bad.length ? bad.slice(0, 5).join(' / ') : `더블탭 11조합 모두 선택 0·컨트롤 불변(${rows.slice(0, 3).join(' | ')} …), 가드 뒤 한 번 탭은 선택 1`, shots };
});

// ------------------------------------------------------------------ A03 새로고침 연타
await run({ id: 'A03', title: '카드 열린 채·접힌 채 새로고침 연타(각 12번 + 즉시 4번) — 항상 열린 같은 카드로 복원, 선택 0', steps: '수동 시트 카드와 접힌 상태에서 page.reload를 300ms 간격 12번, 대기 없이 4번', expected: '새로고침마다 같은 key의 열린 시트(접힘은 사라짐), 선택 기록·나이 불변, 오류·빈 화면 0', }, async () => {
  const { ctx, page } = await openCard(browser, 'tutoring-present', 'sheet', { vp: VP360, hidden: true });
  const base = await hist(page);
  const key0 = (await readCard(page)).key;
  const bad = [];
  const shots = [];
  const state = async (label) => {
    await page.waitForSelector('[data-testid="life-screen"]', { timeout: 10000 });
    await page.waitForSelector('[data-testid="choice-panel"], [data-testid="decision-fold"]', { timeout: 10000 });
    const c = await readCard(page);
    const h = await hist(page);
    if (c.key !== key0) bad.push(`${label}: key ${c.key}`);
    if (c.mode !== 'sheet') bad.push(`${label}: 열린 시트 기대인데 ${c.mode}`);
    if (h !== base) bad.push(`${label}: 선택 ${h - base}`);
    return c;
  };
  for (let i = 0; i < 12; i++) {
    await page.reload({ waitUntil: 'load' });
    await state(`열린 채 ${i + 1}`);
    await sleep(300);
  }
  for (let i = 0; i < 4; i++) {
    page.reload({ waitUntil: 'commit' }).catch(() => {});
    await sleep(60);
  }
  await page.waitForLoadState('load');
  await state('열린 채 즉시 4번 뒤');
  // 접힌 채
  for (let i = 0; i < 12; i++) {
    await cardReady(page);
    await page.getByTestId('decision-fold-btn').click();
    await page.waitForSelector('[data-testid="decision-fold"]');
    await sleep(100);
    await page.reload({ waitUntil: 'load' });
    const c = await state(`접힌 채 ${i + 1}`);
    if (i === 0) shots.push(await shot(page, 'A03', 'after-reload-folded'));
    void c;
  }
  for (let i = 0; i < 4; i++) {
    await cardReady(page);
    await page.getByTestId('decision-fold-btn').click();
    await page.waitForSelector('[data-testid="decision-fold"]');
    page.reload({ waitUntil: 'commit' }).catch(() => {});
    await sleep(40);
  }
  await page.waitForLoadState('load');
  await state('접힌 채 즉시 뒤');
  await ctx.close();
  return { verdict: bad.length ? 'FAIL' : 'PASS', actual: bad.length ? bad.slice(0, 5).join(' / ') : '열린 채 12+4번·접힌 채 12+4번 새로고침 모두 같은 key의 열린 시트로 복원, 선택 기록 불변, 오류 화면 0', shots };
});

// ------------------------------------------------------------------ A03b 자동 모드 새로고침 연타
await run({ id: 'A03b', title: '자동 모드(인라인) 카드에서 새로고침 연타 — 선택 0 또는 1회(3초 타이머), 중복 선택 0', steps: '자동 모드 인라인 카드를 1.2초 간격으로 10번 새로고침, 이후 가만히 두고 자동 선택 1번만 일어나는지', expected: '새로고침 사이에는 선택이 일어나지 않고(타이머는 새로고침마다 새로 시작), 마지막에 기다리면 정확히 1번 선택', }, async () => {
  const { ctx, page } = await openCard(browser, 'tutoring-present', 'inline', { vp: VP360, hidden: false });
  const bad = [];
  const base = await hist(page);
  for (let i = 0; i < 10; i++) {
    await sleep(1200);
    await page.reload({ waitUntil: 'load' });
    await page.waitForSelector('[data-testid="life-screen"]');
    const h = await hist(page);
    if (h !== base) bad.push(`새로고침 ${i + 1}: 선택 ${h - base}`);
  }
  await sleep(4500);
  const h1 = await hist(page);
  if (h1 !== base + 1) bad.push(`기다린 뒤 선택 ${h1 - base}(기대 1)`);
  await sleep(1500);
  const shots = [await shot(page, 'A03b', 'after-auto')];
  await ctx.close();
  return { verdict: bad.length ? 'FAIL' : 'PASS', actual: bad.length ? bad.join(' / ') : `10번 새로고침 사이 선택 0, 4.5초 기다리자 선택 ${h1 - base}(1번)`, shots };
});

// ------------------------------------------------------------------ A04 뒤로가기
await run({ id: 'A04', title: '뒤로가기·앞으로가기 — 카드 열린 채/접힌 채 모두 앱이 깨지지 않고 같은 카드가 복원', steps: '빈 탭에서 앱을 열어 카드 → history.back → history.forward / 접은 뒤 같은 절차', expected: '뒤로가기는 앱을 떠나고(이 앱은 history를 쌓지 않는다), 앞으로 돌아오면 열린 같은 카드, 선택 0', }, async () => {
  const { ctx, page } = await openCard(browser, 'tutoring-present', 'sheet', { vp: VP360, hidden: true });
  const base = await hist(page);
  const key0 = (await readCard(page)).key;
  const bad = [];
  const rows = [];
  for (const folded of [false, true]) {
    if (folded) {
      await cardReady(page);
      await page.getByTestId('decision-fold-btn').click();
      await page.waitForSelector('[data-testid="decision-fold"]');
    }
    const urlBefore = page.url();
    await page.goBack({ waitUntil: 'load' }).catch(() => {});
    const afterBack = page.url();
    await sleep(300);
    await page.goForward({ waitUntil: 'load' }).catch(() => {});
    await page.waitForSelector('[data-testid="life-screen"]', { timeout: 10000 }).catch(() => bad.push(`${folded ? '접힌' : '열린'}: 앞으로 뒤 생애 화면 없음`));
    await page.waitForSelector('[data-testid="choice-panel"], [data-testid="decision-fold"]', { timeout: 10000 }).catch(() => {});
    const c = await readCard(page);
    rows.push(`${folded ? '접힌' : '열린'}: 뒤로 ${afterBack === urlBefore ? '(같은 주소)' : '(' + afterBack.slice(0, 30) + ')'} → 앞으로 ${c.mode}`);
    if (c.key !== key0) bad.push(`${folded ? '접힌' : '열린'}: key ${c.key}`);
    if ((await hist(page)) !== base) bad.push(`${folded ? '접힌' : '열린'}: 선택 기록 변함`);
  }
  // 빈 탭이 아니라 앱 안에서만 쓰는 사람: 연속 뒤로가기 3번
  const shots = [await shot(page, 'A04', 'after-forward')];
  await ctx.close();
  return { verdict: bad.length ? 'FAIL' : 'PASS', actual: bad.length ? bad.join(' / ') : rows.join(' | '), shots };
});

// ------------------------------------------------------------------ A05 선택지 연타
await run({ id: 'A05', title: '선택지 연타 — 더블클릭·트리플·세 선택지 동시·키보드 Enter 연타 모두 선택 정확히 1번', steps: '서로 다른 카드 3종 × {dblclick, 3연속 click, 선택지 1·2·3을 10ms 안에, Enter 5연타}', expected: '선택 기록은 카드당 +1', }, async () => {
  const bad = [];
  const rows = [];
  for (const [name, method] of [['tutoring-present', 'dblclick'], ['sibling-past', 'triple'], ['startup-present', 'three'], ['tutoring-future', 'enter'], ['layoff-present', 'dblclick'], ['estate-present', 'triple']]) {
    const { ctx, page } = await openCard(browser, name, 'sheet', { vp: { width: 1280, height: 800 }, hidden: true });
    await cardReady(page);
    await sleep(200);
    const base = await hist(page);
    const ids = await page.evaluate(() => [...document.querySelectorAll('.choice')].map((b) => b.getAttribute('data-testid')));
    if (method === 'dblclick') await page.getByTestId(ids[0]).dblclick();
    else if (method === 'triple') await page.getByTestId(ids[1]).click({ clickCount: 3, delay: 20 });
    else if (method === 'three') {
      await page.evaluate((ids) => { for (const id of ids) document.querySelector(`[data-testid="${id}"]`)?.click(); }, ids);
    } else {
      await page.getByTestId(ids[0]).focus();
      for (let i = 0; i < 5; i++) await page.keyboard.press('Enter');
    }
    await sleep(900);
    const h = await hist(page);
    rows.push(`${name}/${method}: +${h - base}`);
    if (h - base !== 1) bad.push(`${name}/${method}: 선택 +${h - base}`);
    await ctx.close();
  }
  return { verdict: bad.length ? 'FAIL' : 'PASS', actual: bad.length ? bad.join(' / ') : rows.join(' | '), shots: [] };
});

// ------------------------------------------------------------------ A06 자동 모드 켜고 끄기 + 접기
await run({ id: 'A06', title: '자동 모드 켜고 끄기 + 접기 — 접은 동안 자동 선택 정지, 다시 열면 3초 뒤 재개, 끄면 시트로', steps: '자동 인라인 카드: (a) 접기 → 4.5초 대기(선택 0) → 다시 열기 → 선택까지 시간(기대 ≈3초) (b) 인라인에서 자동 끄기 → 시트 → Esc → 자동 켜기 → 다시 열기 → (c) 자동 on/off 10번 연타', expected: '접힌 동안 선택 0, 재개 2.6~4.2초, 끈 뒤 시트(모달), 연타 뒤 카드 1개·상태 일관', }, async () => {
  const bad = [];
  const rows = [];
  const shots = [];
  const { ctx, page } = await openCard(browser, 'tutoring-present', 'inline', { vp: VP360, hidden: false });
  // (a) 접기 → 대기
  await page.waitForSelector('[data-testid="decision-fold-btn"]');
  await cardReady(page);
  const base = await hist(page);
  await page.getByTestId('decision-fold-btn').tap();
  await page.waitForSelector('[data-testid="decision-fold"]');
  shots.push(await shot(page, 'A06', 'inline-folded'));
  await sleep(4500);
  const h1 = await hist(page);
  rows.push(`접힌 채 4.5초: 선택 +${h1 - base}`);
  if (h1 !== base) bad.push(`접힌 동안 자동 선택 ${h1 - base}`);
  await page.waitForFunction(() => { const b = document.querySelector('[data-testid="decision-reopen"]'); return b && b.getAttribute('aria-disabled') !== 'true'; });
  const t0 = Date.now();
  await page.getByTestId('decision-reopen').tap();
  let dt = null;
  for (let i = 0; i < 80; i++) {
    if ((await hist(page)) > base) {
      dt = Date.now() - t0;
      break;
    }
    await sleep(100);
  }
  rows.push(`다시 열기 → 자동 선택 ${dt}ms`);
  if (dt === null || dt < 2600 || dt > 4400) bad.push(`재개 시간 ${dt}ms(기대 2600~4400)`);
  const focusAfter = (await readCard(page)).activeTid;
  rows.push(`자동 선택 직후 포커스 ${focusAfter}`);
  if (focusAfter !== 'life-name') bad.push(`자동 선택 직후 포커스 ${focusAfter}(기대 life-name = 이름 제목, body 아님)`);
  await ctx.close();

  // (b) 인라인 → 자동 끄기 → 시트 → Esc → 자동 켜기
  {
    const { ctx, page } = await openCard(browser, 'tutoring-present', 'inline', { vp: VP360, hidden: true });
    await cardReady(page);
    const c0 = await readCard(page);
    await page.getByTestId('auto').tap();
    await sleep(500);
    const c1 = await readCard(page);
    rows.push(`자동 끄기 → ${c1.mode}, 포커스 ${c1.activeTid}, 안내 「${(c1.autoNote || '').slice(0, 16)}」`);
    if (c1.mode !== 'sheet') bad.push(`자동 끈 뒤 모드 ${c1.mode}(기대 sheet)`);
    if (c1.key !== c0.key) bad.push('자동 끄기로 카드 key가 바뀜');
    shots.push(await shot(page, 'A06', 'auto-off-sheet'));
    await cardReady(page);
    await page.keyboard.press('Escape');
    await page.waitForSelector('[data-testid="decision-fold"]');
    await page.getByTestId('auto').tap();
    await sleep(300);
    const c2 = await readCard(page);
    rows.push(`접힌 채 자동 켜기 → ${c2.mode}, auto=${c2.auto}`);
    if (c2.mode !== 'fold' || c2.auto !== 'true') bad.push(`접힌 채 자동 켜기: mode ${c2.mode} auto ${c2.auto}`);
    await page.waitForFunction(() => { const b = document.querySelector('[data-testid="decision-reopen"]'); return b && b.getAttribute('aria-disabled') !== 'true'; });
    await page.getByTestId('decision-reopen').tap();
    await sleep(300);
    const c3 = await readCard(page);
    rows.push(`다시 열기 → ${c3.mode}, 안내 「${(c3.autoNote || '').slice(0, 14)}」`);
    if (c3.mode !== 'inline') bad.push(`자동 켠 채 다시 열기 모드 ${c3.mode}(기대 inline)`);
    // (c) 연타: 자동 켜기·끄기를 12번 — 시트가 떠 있으면 컨트롤이 가려지므로(모달) Esc로 접은 뒤 누른다(탭이 가려져 자동 선택은 일어나지 않음)
    const h0 = await hist(page);
    for (let i = 0; i < 12; i++) {
      const dd = await dashSnap(page);
      if (dd.dialogs > 0) {
        await cardReady(page);
        await page.keyboard.press('Escape');
        await sleep(60);
      } else {
        await page.getByTestId('auto').tap();
        await sleep(70);
      }
      const d1 = await dashSnap(page);
      if (d1.panels + d1.folds !== 1) bad.push(`연타 ${i}: 카드 ${d1.panels}+${d1.folds}`);
    }
    await sleep(500);
    const d = await dashSnap(page);
    rows.push(`자동 켜기·끄기·접기 12번 뒤: 패널 ${d.panels}·띠 ${d.folds}·다이얼로그 ${d.dialogs}·auto=${d.auto}`);
    const cm = await readCard(page);
    if (cm.mode === 'sheet' && d.dialogs !== 1) bad.push('시트인데 다이얼로그 수가 1이 아님');
    if (cm.mode !== 'sheet' && d.dialogs !== 0) bad.push('시트가 아닌데 다이얼로그가 있음');
    if ((await hist(page)) !== h0) bad.push('연타로 선택이 기록됨');
    shots.push(await shot(page, 'A06', 'auto-toggle-mash'));
    await ctx.close();
  }
  return { verdict: bad.length ? 'FAIL' : 'PASS', actual: bad.length ? bad.slice(0, 5).join(' / ') + ' || ' + rows.join(' | ') : rows.join(' | '), shots };
});

await browser.close();
