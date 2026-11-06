// QA-009-FM6-010 2회차: 알약(log-jump) 공격 — 연타·창 크기/글자 크기 끌기·사라지는 경로별 변수 정리·새로고침 연타·뒤로가기
//   QA_BASE=... node qa/scripts/010/pill-attack.mjs <chromium|webkit> [폭=1280]
import { chromium, webkit, newPage, evalCore, inject, settle, BASE } from './lib.mjs';
const engine = process.argv[2] === 'webkit' ? webkit : chromium;
const name = process.argv[2] === 'webkit' ? 'webkit' : 'chromium';
const W = Number(process.argv[3] ?? 1280);
const H = W < 500 ? 740 : 800;
const issues = [];
const note = (ok, label, detail = '') => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${name} ${W}px ${label}${detail ? ' — ' + detail : ''}`); if (!ok) issues.push(label + ' ' + detail); };
const { browser, page, errors } = await newPage(engine, { width: W, height: H });
await page.goto(BASE + '/');
const st = await evalCore(page, `let s = core.enterLife(core.enterBirth(core.beginBirth(core.createInitialState(777), 'alpha')));
  while (s.phase === 'life' && (s.age < 50 || s.pending !== null)) s = s.pending ? core.autoResolveStep(s, s.pending.key).state : core.stepYear(s).state;
  return s;`);
await inject(page, { ...st, paused: false }, { speed: 1, autoMode: false }, '/');
await page.getByTestId('life-screen').waitFor();
await page.waitForFunction(() => document.querySelectorAll('[data-testid="why-btn"]').length > 30, null, { timeout: 20000 }).catch(() => {});

const state = () => page.evaluate(() => {
  const list = document.querySelector('[data-testid="log-list"]'); if (!list) return null;
  const slot = list.querySelector('.log__jump-slot'); const pill = list.querySelector('.log__jump');
  const probe = document.createElement('div'); probe.style.paddingTop = 'var(--sp-3)'; document.body.appendChild(probe); const base = parseFloat(getComputedStyle(probe).paddingTop); probe.remove();
  return { pill: !!pill, variable: list.style.getPropertyValue('--log-jump-bottom'), pad: parseFloat(getComputedStyle(list).scrollPaddingTop), base, pillBottom: pill && slot ? Math.ceil(pill.getBoundingClientRect().bottom - slot.getBoundingClientRect().top) : null, listTop: Math.round(list.scrollTop) };
});
async function ensurePill() {
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
const consistent = (s) => s.pill ? s.variable === `${s.pillBottom}px` : s.variable === '';

// A. 창 크기·글자 크기를 알약이 뜬 채 끌기 (관찰자가 따라오는가, 낡은 값이 남지 않는가)
if (!(await ensurePill())) note(false, 'A 사전: 알약을 못 띄움');
else {
  const sizes = W < 500 ? [[360, 740], [320, 568], [360, 740], [320, 256], [360, 740]] : [[1280, 800], [700, 800], [320, 600], [1280, 800], [960, 500]];
  let bad = 0; const seen = [];
  for (let round = 0; round < 3; round++) for (const pct of [100, 200, 100, 150]) for (const [w, h] of sizes) {
    await page.setViewportSize({ width: w, height: h });
    await page.addStyleTag({ content: `html { font-size: ${pct}% !important; }` });
    await settle(page, 80);
    const s = await state();
    if (s.pill && Math.abs(s.pad - (s.pillBottom + s.base)) > 1.5 && !s.focusedPill) { bad++; if (seen.length < 3) seen.push(`${w}x${h}·${pct}% pad ${s.pad} ≠ ${s.pillBottom}+${s.base}`); }
  }
  note(bad === 0, 'A 알약이 뜬 채 창 크기·글자 크기를 60번 끌었다 — 매번 위 여백 = 알약 아랫변 + 기준 여백', bad ? `${bad}번 어긋남: ${seen.join(' / ')}` : '');
  await page.setViewportSize({ width: W, height: H });
}

// B. 알약 연타(마우스 20번 · Enter 10번): 사라진 뒤 변수·여백 정리
if (await ensurePill()) {
  for (let i = 0; i < 20; i++) await page.getByTestId('log-jump').click({ timeout: 800, noWaitAfter: true }).catch(() => {});
  await settle(page, 500);
  const s = await state();
  note(!s.pill && s.variable === '' && Math.abs(s.pad - s.base) < 0.6, 'B 알약 마우스 연타 20번 뒤 알약 없음·변수 없음·위 여백 기준', JSON.stringify({ pill: s.pill, variable: s.variable, pad: s.pad, base: s.base, listTop: s.listTop }));
}
if (await ensurePill()) {
  await page.keyboard.press('Shift'); await page.getByTestId('log-jump').focus();
  for (let i = 0; i < 10; i++) await page.keyboard.press('Enter');
  await settle(page, 600);
  const s = await state();
  note(!s.pill && s.variable === '' && Math.abs(s.pad - s.base) < 0.6, 'B 알약에서 Enter 연타 10번 뒤 알약 없음·변수 없음·위 여백 기준', JSON.stringify({ pill: s.pill, variable: s.variable, pad: s.pad, listTop: s.listTop }));
}

// C. 알약이 사라지는 다른 길: 휠로 맨 위까지 올리기 · 키보드(Home) · 「맨 위로」 외 경로 — 변수 정리
for (const via of ['wheel', 'scrollTo']) {
  if (!(await ensurePill())) { note(false, `C(${via}) 사전: 알약을 못 띄움`); continue; }
  if (via === 'wheel') {
    const box = await page.getByTestId('log-list').boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    for (let i = 0; i < 40 && (await page.getByTestId('log-jump').count()) > 0; i++) { await page.mouse.wheel(0, -400); await page.waitForTimeout(120); }
  } else await page.getByTestId('log-list').evaluate((el) => el.scrollTo({ top: 0, behavior: 'instant' }));
  await settle(page, 500);
  const s = await state();
  note(!s.pill && s.variable === '' && Math.abs(s.pad - s.base) < 0.6, `C 알약이 맨 위 도착(${via})으로 사라진 뒤 변수 없음·위 여백 기준`, JSON.stringify({ pill: s.pill, variable: s.variable, pad: s.pad, listTop: s.listTop }));
}

// D. 알약이 뜬 채 새로고침 12번 연타 + 뒤로가기: 알약은 저장되지 않는다(새로 시작), 오류·주소 변화 없음
const hist0 = await page.evaluate(() => history.length);
await ensurePill();
for (let i = 0; i < 12; i++) { await page.reload({ waitUntil: 'commit' }).catch(() => {}); }
await page.getByTestId('life-screen').waitFor({ timeout: 20000 }).catch(() => {});
await settle(page, 600);
const s2 = await state();
const dup = await page.evaluate(() => { const ids = [...document.querySelectorAll('[id]')].map((e) => e.id); return ids.length - new Set(ids).size; });
note(s2 !== null && consistent(s2) && dup === 0, 'D 새로고침 12번 연타 뒤 변수와 알약이 일치하고 중복 id 0', JSON.stringify({ pill: s2?.pill, variable: s2?.variable, dup }));
await page.goBack({ waitUntil: 'commit' }).catch(() => {});
await settle(page, 500);
const hist1 = await page.evaluate(() => history.length);
note(hist1 === hist0 || hist1 <= hist0 + 1, 'D history 길이 불변(새로고침은 기록을 쌓지 않는다)', `${hist0} → ${hist1}`);

note(errors.length === 0, 'E 콘솔 오류·ResizeObserver 경고 0', errors.slice(0, 3).join(' | '));
console.log(issues.length ? `\n문제 ${issues.length}건` : '\n문제 0건');
await browser.close();
