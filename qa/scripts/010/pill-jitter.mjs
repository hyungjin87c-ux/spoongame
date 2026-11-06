// QA-009-FM6-010 2회차: 짧은 화면(320×256 = zoom 400) + 글자 200% + 알약에서 포커스 이동 중 스크롤이 튀는가 (REV-010-QAFIX-1 「QA에 넘길 것」 3 — 관찰만)
//   QA_BASE=... node qa/scripts/010/pill-jitter.mjs <chromium|webkit> [320x256x200,...]
// 포커스를 옮기는 동안 프레임마다 문서 scrollY·기록 영역 scrollTop·포커스 요소 윗변을 모아 방향 전환(왔다갔다) 횟수와 가장 큰 한 프레임 이동량을 센다.
import { chromium, webkit, newPage, evalCore, inject, settle, BASE } from './lib.mjs';
const engine = process.argv[2] === 'webkit' ? webkit : chromium;
const name = process.argv[2] === 'webkit' ? 'webkit' : 'chromium';
const CASES = (process.argv[3] ?? '320x256x200,320x256x100,360x740x200,1280x800x200').split(',').map((s) => s.split('x').map(Number));

async function ensurePill(page) {
  const sheetOpen = async () => (await page.getByTestId('choice-panel').count()) > 0;
  if ((await page.getByTestId('log-jump').count()) > 0 && !(await sheetOpen())) return true;
  await page.getByTestId('log-list').evaluate((el) => el.scrollTo({ top: 220, behavior: 'instant' }));
  for (let i = 0; i < 80 && ((await page.getByTestId('log-jump').count()) === 0 || (await sheetOpen())); i++) {
    await page.evaluate(() => { const c = document.querySelector('[data-testid="choice-panel"] button[data-testid^="choice-"]'); const k = document.querySelector('[data-testid="skip"]'); (c ?? k)?.click(); });
    await page.waitForTimeout(350);
  }
  await page.getByTestId('pause').click().catch(() => {});
  await settle(page, 400);
  return (await page.getByTestId('log-jump').count()) > 0;
}
const REC_START = `(() => { window.__tr = []; let on = true; window.__trStop = () => { on = false; }; const tick = () => { if (!on) return; const l = document.querySelector('[data-testid="log-list"]'); const a = document.activeElement; const r = a && a !== document.body ? a.getBoundingClientRect() : null; window.__tr.push([Math.round(scrollY * 10) / 10, l ? Math.round(l.scrollTop * 10) / 10 : 0, r ? Math.round(r.top * 10) / 10 : null, a && a !== document.body ? (a.getAttribute('data-testid') || a.tagName) : null]); requestAnimationFrame(tick); }; requestAnimationFrame(tick); })()`;
function analyse(tr) {
  const dims = { scrollY: 0, listTop: 1, focusTop: 2 }; const out = {};
  for (const [k, i] of Object.entries(dims)) {
    const v = tr.map((r) => r[i]).filter((x) => x !== null); let rev = 0; let dir = 0; let maxStep = 0;
    for (let j = 1; j < v.length; j++) { const d = v[j] - v[j - 1]; if (Math.abs(d) < 0.5) continue; maxStep = Math.max(maxStep, Math.abs(d)); const s = Math.sign(d); if (dir !== 0 && s !== dir) rev++; dir = s; }
    out[k] = { rev, maxStep: Math.round(maxStep) };
  }
  return out;
}
for (const [w, h, pct] of CASES) {
  const { browser, page, errors } = await newPage(engine, { width: w, height: h });
  await page.goto(BASE + '/');
  const st = await evalCore(page, `let s = core.enterLife(core.enterBirth(core.beginBirth(core.createInitialState(777), 'alpha')));
    while (s.phase === 'life' && (s.age < 50 || s.pending !== null)) s = s.pending ? core.autoResolveStep(s, s.pending.key).state : core.stepYear(s).state;
    return s;`);
  await inject(page, { ...st, paused: false }, { speed: 1, autoMode: false }, '/');
  await page.getByTestId('life-screen').waitFor();
  await page.waitForFunction(() => document.querySelectorAll('[data-testid="why-btn"]').length > 30, null, { timeout: 20000 }).catch(() => {});
  if (pct !== 100) await page.addStyleTag({ content: `html { font-size: ${pct}% !important; }` });
  const res = [];
  for (const path of ['S(Shift+Tab→알약)', 'T(Tab→알약)', 'S2(알약→Tab→첫 근거 보기)', 'W(근거 보기 3칸 거슬러)']) {
    if (!(await ensurePill(page))) { res.push(`${path}: 알약을 못 띄움`); continue; }
    await page.keyboard.press('Shift');
    if (path.startsWith('S(')) await page.getByTestId('why-btn').first().evaluate((el) => el.focus({ preventScroll: true }));
    else if (path.startsWith('T(')) await page.getByTestId('log-list').evaluate((el) => el.focus({ preventScroll: true }));
    else if (path.startsWith('S2')) await page.getByTestId('log-jump').focus();
    else await page.getByTestId('why-btn').nth(6).evaluate((el) => el.focus({ preventScroll: true }));
    await settle(page, 300);
    await page.evaluate(REC_START);
    const keys = path.startsWith('S(') ? ['Shift+Tab'] : path.startsWith('T(') ? ['Tab'] : path.startsWith('S2') ? ['Tab'] : ['Shift+Tab', 'Shift+Tab', 'Shift+Tab'];
    for (const k of keys) { await page.keyboard.press(k); await page.waitForTimeout(700); }
    await page.evaluate(() => window.__trStop());
    const tr = await page.evaluate(() => window.__tr);
    const a = analyse(tr);
    const last = tr.at(-1);
    res.push(`${path}: 프레임 ${tr.length} · 문서 scrollY 왕복 ${a.scrollY.rev}(최대 한 프레임 ${a.scrollY.maxStep}px) · 영역 scrollTop 왕복 ${a.listTop.rev}(${a.listTop.maxStep}px) · 포커스 윗변 왕복 ${a.focusTop.rev}(${a.focusTop.maxStep}px) · 끝 포커스 ${last[3]}`);
  }
  console.log(`${name} ${w}x${h}·${pct}% (errors ${errors.length})`);
  for (const r of res) console.log('   ' + r);
  await browser.close();
}
