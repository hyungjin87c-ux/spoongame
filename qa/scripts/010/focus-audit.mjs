// m4-focus 대체 점검: 시험 도구는 data-testid가 같은 단추(why-btn)를 같은 정지점으로 보고 순회를 끊는다. 앱이 실제로 포커스를 가리는지 직접 본다.
// 알파 시드 777 50세(시험의 dash-adult와 같은 판)에서 Tab 전체 순회·Shift+Tab 전체 순회: 매 정지점에서 포커스 요소가 화면 안에 있고 고정 요소(헤더·진행 줄)에 가려지지 않는가
import { chromium, webkit, newPage, evalCore, inject, settle, BASE } from './lib.mjs';
const engine = process.argv[2] === 'webkit' ? webkit : chromium;
const CASES = [[320, 568, 100], [320, 568, 200], [360, 740, 100], [360, 740, 200], [1280, 800, 100], [1280, 800, 200]];
const SAMPLE = `(() => {
  const a = document.activeElement; if (!a || a === document.body) return null;
  const r = a.getBoundingClientRect(); const vh = innerHeight, vw = innerWidth;
  const id = a.getAttribute('data-testid') || (a.tagName + (a.id ? '#' + a.id : '') + '[' + (a.textContent || '').trim().slice(0, 12) + ']');
  const cx = Math.min(Math.max(r.left + r.width / 2, 0), vw - 1), cy = Math.min(Math.max(r.top + r.height / 2, 0), vh - 1);
  const top = document.elementFromPoint(cx, cy);
  const covered = top && !(a === top || a.contains(top) || top.contains(a));
  const fixed = []; for (const e of document.querySelectorAll('[data-testid="dash-head"], [data-testid="controls"]')) { const cs = getComputedStyle(e); if (cs.position === 'fixed' || cs.position === 'sticky') { const fr = e.getBoundingClientRect(); fixed.push([e.getAttribute('data-testid'), fr.top, fr.bottom]); } }
  const hiddenByFixed = fixed.filter(([nm]) => !a.closest('[data-testid="' + nm + '"]')).filter(([, t, b]) => r.top < b && r.bottom > t && (Math.min(r.bottom, b) - Math.max(r.top, t)) > r.height * 0.5).map((x) => x[0]);
  return { id, top: Math.round(r.top), bottom: Math.round(r.bottom), h: Math.round(r.height), visible: r.bottom > 0 && r.top < vh && r.right > 0 && r.left < vw, inView: r.top >= -1 && r.bottom <= vh + 1, covered: !!covered, coverEl: covered ? (top.getAttribute('data-testid') || top.tagName) : '', hiddenByFixed };
})()`;
for (const [w, h, pct] of CASES) {
  const { browser, page, errors } = await newPage(engine, { width: w, height: h });
  await page.goto(BASE + '/');
  const st = await evalCore(page, `let s = core.enterLife(core.enterBirth(core.beginBirth(core.createInitialState(777), 'alpha')));
    while (s.phase === 'life' && (s.age < 50 || s.pending !== null)) s = s.pending ? core.autoResolveStep(s, s.pending.key).state : core.stepYear(s).state;
    return s;`);
  const PILL = process.argv.includes('pill'); await inject(page, { ...st, paused: !PILL }, { speed: 1, autoMode: false }, '/');
  await page.getByTestId('life-screen').waitFor();
  await page.waitForFunction(() => document.querySelectorAll('[data-testid="why-btn"]').length > 30, null, { timeout: 20000 }).catch(() => {});
  if (PILL) { await page.getByTestId('log-list').evaluate((el) => el.scrollTo({ top: 220, behavior: 'instant' })); for (let i = 0; i < 80 && (await page.getByTestId('log-jump').count()) === 0; i++) { await page.evaluate(() => { const c = document.querySelector('[data-testid="choice-panel"] button[data-testid^="choice-"]'); const k = document.querySelector('[data-testid="skip"]'); (c ?? k)?.click(); }); await page.waitForTimeout(400); } console.log('  pill', await page.getByTestId('log-jump').count(), 'age', (await page.getByTestId('life-age').textContent()).trim()); await page.getByTestId('pause').click().catch(() => {}); }
  if (pct !== 100) await page.addStyleTag({ content: `html { font-size: ${pct}% !important; }` });
  await settle(page, 400);
  await page.keyboard.press('Shift');
  const run = async (dir) => {
    const stops = [];
    await page.evaluate(() => { document.activeElement?.blur?.(); window.scrollTo(0, dir === 'back' ? document.documentElement.scrollHeight : 0); }).catch(() => {});
    if (dir === 'back') await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    for (let i = 0; i < 80; i++) {
      await page.keyboard.press(dir === 'fwd' ? 'Tab' : 'Shift+Tab');
      await page.evaluate(() => new Promise((res) => { let last = ''; let same = 0; const tick = () => { const a = document.activeElement; const r = a ? a.getBoundingClientRect() : null; const k = scrollY + ':' + (r ? Math.round(r.top * 10) : 0); if (k === last) same++; else { same = 0; last = k; } if (same >= 4) res(); else requestAnimationFrame(tick); }; tick(); }));
      const s = await page.evaluate(SAMPLE);
      if (s === null) break;
      stops.push(s);
    }
    return stops;
  };
  const f = await run('fwd'); const b = await run('back');
  const bad = (arr) => arr.filter((s) => !s.inView || s.covered || s.hiddenByFixed.length);
  const fb = bad(f), bb = bad(b);
  console.log(`${engine === webkit ? 'webkit' : 'chromium'} ${w}x${h}·${pct}%: Tab ${f.length}칸 (why-btn ${f.filter((s) => s.id === 'why-btn').length}) 화면 밖·가림 ${fb.length} | Shift+Tab ${b.length}칸 화면 밖·가림 ${bb.length} | errors ${errors.length}`);
  for (const s of [...fb, ...bb].slice(0, 4)) console.log('   예:', JSON.stringify(s));
  await browser.close();
}
