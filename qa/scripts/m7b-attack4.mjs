// QA-003 M7b 공격 4: 저장소 오류(가득 참·차단)에서 카드 조작, 두 탭 동시, 키보드 난타(특수문자·이모지·자모·숫자)
// 사용: node qa/scripts/m7b-attack4.mjs [ID]
import fs from 'node:fs';
import path from 'node:path';
import { launch, sleep, OUT, mkctx, PROD, shot, runCase, readCard, readSave, choiceCount, cardReady, GAME_KEY, SETTINGS_KEY, settingsEnvelope, SET_MANUAL, SET_AUTO, TOUCH, injectSave } from './m7b-lib.mjs';
import { openCard, VPS } from './m7b-audit.mjs';

const ONLY = process.argv[2] || '';
const run = (c, fn) => (!ONLY || c.id.includes(ONLY) ? runCase({ cat: '공격', ...c }, fn) : null);
const browser = await launch();
const STATES = path.join(OUT, 'states');
const loadState = (n) => JSON.parse(fs.readFileSync(path.join(STATES, `${n}.json`), 'utf8'));
const hist = async (page) => choiceCount(await readSave(page));

// ------------------------------------------------------------------ A15 저장소 오류
await run({ id: 'A15', title: '저장소 쓰기 실패(가득 참)·읽기 차단 상태에서 카드 조작 — 접기·다시 열기·선택이 화면에서는 정상 동작하고, 오류 화면·잡히지 않은 예외가 없다', steps: '카드가 열린 뒤 localStorage.setItem이 QuotaExceededError를 던지게 만들고 접기 → 다시 열기 → 선택 → 다음 카드까지. 별도로 localStorage 접근 자체가 SecurityError인 컨텍스트', expected: 'pageerror 0, 화면이 계속 반응(접기·열기·선택 동작), 빈 화면 0' }, async () => {
  const bad = [];
  const rows = [];
  // (a) 쓰기 실패
  {
    const { ctx, page } = await openCard(browser, 'tutoring-present', 'sheet', { vp: VPS[2], hidden: true });
    const errs = [];
    page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 120)));
    await cardReady(page);
    await page.evaluate(() => { Storage.prototype.setItem = function () { throw new DOMException('quota', 'QuotaExceededError'); }; });
    await page.getByTestId('decision-fold-btn').tap();
    await page.waitForSelector('[data-testid="decision-fold"]');
    await page.waitForFunction(() => { const b = document.querySelector('[data-testid="decision-reopen"]'); return b && b.getAttribute('aria-disabled') !== 'true'; });
    await page.getByTestId('decision-reopen').tap();
    await page.waitForSelector('[data-testid="choice-panel"]');
    await cardReady(page);
    await sleep(200);
    const k0 = (await readCard(page)).key;
    await page.locator('.choice').first().tap();
    await page.waitForFunction((k) => { const p = document.querySelector('[data-testid="choice-panel"]'); return !p || p.getAttribute('data-key') !== k; }, k0, { timeout: 8000 }).catch(() => bad.push('(a) 선택 뒤 카드가 바뀌지 않음'));
    await sleep(500);
    const scr = await page.evaluate(() => ['life-screen', 'error-screen', 'superseded-screen'].find((id) => document.querySelector(`[data-testid="${id}"]`)) || 'other');
    rows.push(`(a) 쓰기 실패: 선택 뒤 화면 ${scr}, pageerror ${errs.length}`);
    if (scr === 'error-screen') bad.push('(a) 쓰기 실패 때 오류 화면');
    if (errs.length) bad.push(`(a) pageerror ${errs[0]}`);
    await ctx.close();
  }
  // (b) 읽기·쓰기 모두 차단
  {
    const ctx = await mkctx(browser, { viewport: { width: 360, height: 740 }, ...TOUCH });
    await ctx.addInitScript(() => { Object.defineProperty(window, 'localStorage', { configurable: true, get() { throw new DOMException('denied', 'SecurityError'); } }); });
    const page = await ctx.newPage();
    const errs = [];
    page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 120)));
    await page.goto(PROD, { waitUntil: 'load' });
    await sleep(1500);
    const scr = await page.evaluate(() => ['title-screen', 'life-screen', 'error-screen', 'superseded-screen'].find((id) => document.querySelector(`[data-testid="${id}"]`)) || (document.body.innerText.trim() === '' ? 'BLANK' : 'other'));
    rows.push(`(b) localStorage 차단: 화면 ${scr}, pageerror ${errs.length}`);
    if (scr === 'BLANK') bad.push('(b) 저장소 차단 때 빈 화면');
    if (errs.length) bad.push(`(b) pageerror ${errs[0]}`);
    // 새 판을 끝내지는 못해도 카드까지 갈 수 있는지
    if (scr === 'title-screen') {
      try {
        await page.getByTestId('start-birth').tap({ timeout: 5000 });
        await page.waitForSelector('[data-testid="roulette-screen"]', { timeout: 5000 });
        rows.push('(b) 저장소 차단에서도 룰렛까지 진행');
      } catch (e) {
        rows.push('(b) 저장소 차단: 첫 화면에서 진행 못 함(오류 없이)');
      }
    }
    await ctx.close();
  }
  return { verdict: bad.length ? 'FAIL' : 'PASS', actual: bad.length ? bad.join(' / ') + ' || ' + rows.join(' | ') : rows.join(' | '), shots: [] };
});

// ------------------------------------------------------------------ A16 두 탭
await run({ id: 'A16', title: '같은 저장을 두 탭에서 연 채 카드 조작 — 한쪽이 선택하면 다른 쪽은 「밀린 화면」으로, 선택이 두 번 기록되지 않는다', steps: '같은 컨텍스트에서 탭 A(카드 열림) → 탭 B가 같은 저장을 연다 → B에서 선택 → A 화면 → A에서 이어받기/선택 시도', expected: '선택 기록은 +1뿐, A는 밀린 화면(저장을 덮어쓰지 않음)', }, async () => {
  const bad = [];
  const rows = [];
  const ctx = await mkctx(browser, { viewport: { width: 360, height: 740 }, ...TOUCH });
  const A = await ctx.newPage();
  await A.addInitScript(() => { window.__vis = 'hidden'; Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => window.__vis }); });
  await injectSave(A, loadState('tutoring-present'), PROD, SET_MANUAL);
  await A.waitForSelector('[data-testid="choice-panel"]');
  await cardReady(A);
  const base = await hist(A);
  const B = await ctx.newPage();
  await B.addInitScript(() => { window.__vis = 'hidden'; Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => window.__vis }); });
  await B.goto(PROD, { waitUntil: 'load' });
  await sleep(800);
  const sA0 = await A.evaluate(() => ['life-screen', 'superseded-screen', 'title-screen'].find((id) => document.querySelector(`[data-testid="${id}"]`)));
  const sB0 = await B.evaluate(() => ['life-screen', 'superseded-screen', 'title-screen'].find((id) => document.querySelector(`[data-testid="${id}"]`)));
  rows.push(`B 열림 직후: A ${sA0}, B ${sB0}`);
  // B에서 선택
  await B.waitForSelector('[data-testid="choice-panel"]', { timeout: 5000 }).catch(() => {});
  await cardReady(B).catch(() => {});
  await sleep(300);
  if (await B.locator('.choice').count()) await B.locator('.choice').first().tap();
  await sleep(1200);
  const hB = await hist(B);
  const sA1 = await A.evaluate(() => ['life-screen', 'superseded-screen', 'title-screen'].find((id) => document.querySelector(`[data-testid="${id}"]`)));
  rows.push(`B 선택 뒤: 기록 +${hB - base}, A 화면 ${sA1}`);
  if (hB - base !== 1) bad.push(`B에서 선택 +${hB - base}`);
  // A에서 아직 카드가 보이면 눌러 본다
  if (sA1 === 'life-screen' && (await A.locator('.choice').count())) {
    await A.locator('.choice').first().tap().catch(() => {});
    await sleep(800);
    const h2 = await hist(B);
    rows.push(`A에서도 선택 시도: 기록 +${h2 - base}`);
    if (h2 - base > 1) bad.push(`두 탭 선택 중복 +${h2 - base}`);
  }
  const shots = [await shot(A, 'A16', 'tab-a')];
  await ctx.close();
  return { verdict: bad.length ? 'FAIL' : 'PASS', actual: bad.length ? bad.join(' / ') + ' || ' + rows.join(' | ') : rows.join(' | '), shots };
});

// ------------------------------------------------------------------ A17 키보드 난타
await run({ id: 'A17', title: '키보드 난타(특수문자·이모지·한글 자모·숫자·Enter·Space·화살표·Tab·Esc 섞음) — 선택지가 의도치 않게 골라지지 않고 카드·화면이 깨지지 않는다', steps: '시트·인라인·접힌 띠 각 상태에서 문자열 「<script>alert(1)</script>😀ㅎㅏㄴ한글123 따옴표·세미콜론 섞음」을 키보드로 40번 입력하고 방향키·숫자·F키·PageDown·Home/End를 섞어 누른다(포커스는 제목 또는 body)', expected: '선택 기록 불변(카드가 선택으로 확정된 것이 아님), pageerror 0, 경고창 0, 카드·띠 1개' }, async () => {
  const bad = [];
  const rows = [];
  const junk = '<script>alert(1)</script>😀ㅎㅏㄴ한글123\'"; --';
  for (const mode of ['sheet', 'inline', 'fold']) {
    const { ctx, page } = await openCard(browser, 'tutoring-present', mode === 'fold' ? 'sheet' : mode, { vp: { width: 1280, height: 800 }, hidden: true });
    const errs = [];
    const dialogs = [];
    page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 100)));
    page.on('dialog', (d) => { dialogs.push(d.message()); d.dismiss().catch(() => {}); });
    await cardReady(page);
    if (mode === 'fold') {
      await page.getByTestId('decision-fold-btn').click();
      await page.waitForSelector('[data-testid="decision-fold"]');
      await sleep(500);
    }
    const base = await hist(page);
    const k0 = (await readCard(page)).key;
    for (let i = 0; i < 40; i++) await page.keyboard.type(junk, { delay: 0 });
    for (const key of ['ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight', 'PageDown', 'PageUp', 'Home', 'End', '1', '2', '3', '4', '9', '0', 'F1', 'F5', 'a', 'z', 'Shift', 'Control', 'Alt', 'Meta', 'CapsLock', 'Insert', 'Delete', 'Backspace']) {
      if (key === 'F5') continue; // 새로고침은 A03에서
      await page.keyboard.press(key).catch(() => {});
    }
    await sleep(600);
    const h = await hist(page);
    const c = await readCard(page);
    const d = await page.evaluate(() => ({ p: document.querySelectorAll('[data-testid="choice-panel"]').length, f: document.querySelectorAll('[data-testid="decision-fold"]').length, ov: document.documentElement.scrollWidth > document.documentElement.clientWidth }));
    rows.push(`${mode}: 선택 +${h - base}·카드 ${d.p}+${d.f}·key 같음 ${c.key === k0}·pageerror ${errs.length}·경고창 ${dialogs.length}`);
    if (h !== base) bad.push(`${mode}: 선택 +${h - base}`);
    if (d.p + d.f !== 1) bad.push(`${mode}: 카드 ${d.p}+${d.f}`);
    if (errs.length) bad.push(`${mode}: pageerror ${errs[0]}`);
    if (dialogs.length) bad.push(`${mode}: 경고창 ${dialogs[0]}`);
    if (c.key !== k0) bad.push(`${mode}: key가 바뀜`);
    await ctx.close();
  }
  return { verdict: bad.length ? 'FAIL' : 'PASS', actual: bad.length ? bad.join(' / ') + ' || ' + rows.join(' | ') : rows.join(' | '), shots: [] };
});
await browser.close();
