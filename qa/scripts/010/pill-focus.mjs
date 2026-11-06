// QA-009-FM6-010 2회차: 알약(log-jump)이 떠 있을 때 포커스 가림·위 여백 점검 (REV-010-QAFIX-1 「QA에 넘길 것」 1)
//   node qa/scripts/010/pill-focus.mjs <chromium|webkit> [1280x800x100,...]
// 50세(시드 777 알파) 대시보드 + 알약. 경로:
//   S(Shift+Tab): 첫 「근거 보기」 단추에서 Shift+Tab → 알약. T(Tab): 인생 기록 영역에서 Tab → 알약. C(클릭): 알약 위에서 마우스를 누르는 순간.
//   W(거슬러 오르기): 알약이 떠 있는 채 Shift+Tab으로 「근거 보기」 단추를 거슬러 올라 가림(알약·머리)이 없는지.
// 판정: 알약 포커스 동안 위 scroll-padding = 12px(기준 여백), 알약이 화면 안·다른 요소에 안 가림·고정 머리에 안 가림. 단추는 같은 판정.
import { chromium, webkit, newPage, evalCore, inject, settle, BASE } from './lib.mjs';
const engine = process.argv[2] === 'webkit' ? webkit : chromium;
const name = process.argv[2] === 'webkit' ? 'webkit' : 'chromium';
const CASES = (process.argv[3] ?? '1280x800x100,1280x800x200,360x740x100,360x740x200,320x568x200,320x256x200').split(',').map((s) => s.split('x').map(Number));

const READ = `(() => {
  const list = document.querySelector('[data-testid="log-list"]');
  const probe = document.createElement('div'); probe.style.paddingTop = 'var(--sp-3)'; document.body.appendChild(probe);
  const base = parseFloat(getComputedStyle(probe).paddingTop); probe.remove();
  const a = document.activeElement;
  const id = !a || a === document.body ? null : (a.getAttribute('data-testid') || a.tagName);
  const pill = document.querySelector('[data-testid="log-jump"]');
  const lr = list.getBoundingClientRect();
  const out = { active: id, pad: parseFloat(getComputedStyle(list).scrollPaddingTop), base, variable: list.style.getPropertyValue('--log-jump-bottom'), scrollY: Math.round(scrollY), listTop: Math.round(list.scrollTop), listRectTop: Math.round(lr.top), pill: !!pill };
  const fixedOf = (r) => { const f = []; for (const e of document.querySelectorAll('[data-testid="dash-head"], [data-testid="controls"]')) { const cs = getComputedStyle(e); if (cs.position === 'fixed' || cs.position === 'sticky') { const fr = e.getBoundingClientRect(); f.push([e.getAttribute('data-testid'), fr.top, fr.bottom]); } } return f; };
  const judge = (el) => {
    if (!el) return null; const r = el.getBoundingClientRect(); const vh = innerHeight, vw = innerWidth;
    const cx = Math.min(Math.max(r.left + r.width / 2, 0), vw - 1), cy = Math.min(Math.max(r.top + r.height / 2, 0), vh - 1);
    const top = document.elementFromPoint(cx, cy); const covered = !!top && !(el === top || el.contains(top) || top.contains(el));
    const hid = fixedOf().filter(([nm]) => !el.closest('[data-testid="' + nm + '"]')).filter(([, t, b]) => r.top < b && r.bottom > t && (Math.min(r.bottom, b) - Math.max(r.top, t)) > r.height * 0.5).map((x) => x[0]);
    // 영역(스크롤 컨테이너) 윗변 아래에 있는가: 알약은 영역 안 위 가장자리에 떠 있다
    return { top: Math.round(r.top), bottom: Math.round(r.bottom), h: Math.round(r.height), inView: r.top >= -1 && r.bottom <= vh + 1, coveredBy: covered ? (top.getAttribute('data-testid') || top.tagName) : '', hiddenByFixed: hid };
  };
  out.focus = judge(a && a !== document.body ? a : null);
  out.pillJ = judge(pill);
  const heads = fixedOf(); out.headBottom = heads.length ? Math.max(...heads.map((h) => h[2])) : 0;
  return out;
})()`;

async function settleScroll(page) {
  await page.evaluate(() => new Promise((res) => { let last = ''; let same = 0; const tick = () => { const l = document.querySelector('[data-testid="log-list"]'); const a = document.activeElement; const r = a ? a.getBoundingClientRect() : null; const k = scrollY + ':' + (l ? l.scrollTop : 0) + ':' + (r ? Math.round(r.top * 10) : 0); if (k === last) same++; else { same = 0; last = k; } if (same >= 6) res(); else requestAnimationFrame(tick); }; tick(); }));
}
async function ensurePill(page) {
  const sheetOpen = async () => (await page.getByTestId('choice-panel').count()) > 0;
  if ((await page.getByTestId('log-jump').count()) > 0 && !(await sheetOpen())) return true;
  await page.getByTestId('log-list').evaluate((el) => el.scrollTo({ top: 220, behavior: 'instant' }));
  for (let i = 0; i < 80 && ((await page.getByTestId('log-jump').count()) === 0 || (await sheetOpen())); i++) {
    await page.evaluate(() => { const c = document.querySelector('[data-testid="choice-panel"] button[data-testid^="choice-"]'); const k = document.querySelector('[data-testid="skip"]'); (c ?? k)?.click(); });
    await page.waitForTimeout(350);
  }
  await page.getByTestId('pause').click().catch(() => {});
  await settleScroll(page);
  return (await page.getByTestId('log-jump').count()) > 0;
}

let failures = 0;
const bad = [];
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
  const say = (tag, r, extra = '') => {
    const f = r.focus; const pj = r.pillJ;
    const issues = [];
    if (tag === 'W') { if (!f || !f.inView || f.coveredBy || f.hiddenByFixed.length) issues.push('단추 가림/화면 밖'); if (pj && f && f.top < pj.bottom - 1 && f.bottom > pj.top + 1 && f.coveredBy) issues.push('단추가 알약에 가림'); }
    else {
      // WebKit은 마우스 클릭으로 단추에 포커스를 주지 않는다(가까운 포커스 가능 조상인 기록 영역이 받는다) — 알약이 포커스를 안 받으면 위 여백은 알약 아랫변 + 12px이 맞다
      if (tag === 'C' && name === 'webkit' && r.active === 'log-list') { const want = parseFloat(r.variable) + r.base; if (Math.abs(r.pad - want) > 1.5) issues.push(`WebKit 클릭: 알약이 포커스를 안 받는데 위 여백 ${r.pad}px ≠ ${want}px`); }
      else if (r.active !== 'log-jump') issues.push('알약에 포커스가 가지 않음(' + r.active + ')');
      else {
        if (Math.abs(r.pad - r.base) > 0.6) issues.push(`위 여백 ${r.pad}px ≠ 기준 ${r.base}px`);
        if (!f.inView || f.coveredBy || f.hiddenByFixed.length) issues.push(`알약 가림(${f.coveredBy || f.hiddenByFixed.join()} · inView ${f.inView})`);
      }
    }
    const line = `${name} ${w}x${h}·${pct}% ${tag}: active=${r.active} pad=${r.pad} base=${r.base} var=${r.variable || '-'} pill(top ${f?.top} bottom ${f?.bottom} h ${f?.h}) head ${r.headBottom} scrollY ${r.scrollY} listTop ${r.listTop} ${extra}${issues.length ? '  ▶ FAIL: ' + issues.join(' / ') : ''}`;
    console.log(line);
    if (issues.length) { failures++; bad.push(line); }
  };
  try {
    // S: Shift+Tab
    if (await ensurePill(page)) {
      await page.keyboard.press('Shift');
      await page.getByTestId('why-btn').first().evaluate((el) => el.focus({ preventScroll: true }));
      const pre = await page.evaluate(READ);
      await page.keyboard.press('Shift+Tab'); await settleScroll(page);
      const post = await page.evaluate(READ);
      say('S', post, `Δ(scrollY ${post.scrollY - pre.scrollY}, listTop ${post.listTop - pre.listTop})`);
    } else console.log(`${name} ${w}x${h}·${pct}% S: 알약을 못 띄움`);
    // T: Tab
    if (await ensurePill(page)) {
      await page.keyboard.press('Shift');
      await page.getByTestId('log-list').evaluate((el) => el.focus({ preventScroll: true }));
      const pre = await page.evaluate(READ);
      await page.keyboard.press('Tab'); await settleScroll(page);
      const post = await page.evaluate(READ);
      say('T', post, `Δ(scrollY ${post.scrollY - pre.scrollY}, listTop ${post.listTop - pre.listTop})`);
    } else console.log(`${name} ${w}x${h}·${pct}% T: 알약을 못 띄움`);
    // C: 클릭(누르는 순간 포커스)
    if (await ensurePill(page)) {
      const box = await page.getByTestId('log-jump').boundingBox();
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      const pre = await page.evaluate(READ);
      await page.mouse.down(); await settleScroll(page);
      const down = await page.evaluate(READ);
      await page.mouse.up(); await settleScroll(page); await page.waitForTimeout(500); await settleScroll(page);
      const after = await page.evaluate(READ);
      say('C', down, `Δ(scrollY ${down.scrollY - pre.scrollY}, listTop ${down.listTop - pre.listTop}) → 뗀 뒤 pill=${after.pill} pad=${after.pad} var=${after.variable || '-'} listTop=${after.listTop}`);
    } else console.log(`${name} ${w}x${h}·${pct}% C: 알약을 못 띄움`);
    // W: 알약이 떠 있는 채 Shift+Tab으로 근거 보기 단추를 거슬러 올라가기 (단추 12번째 → 알약이 사라질 때까지)
    if (await ensurePill(page)) {
      await page.keyboard.press('Shift');
      const n = await page.getByTestId('why-btn').count();
      const start = Math.min(14, n - 1);
      await page.getByTestId('why-btn').nth(start).evaluate((el) => el.focus({ preventScroll: true }));
      await settleScroll(page);
      let walked = 0; let worst = 0;
      for (let i = 0; i < start; i++) {
        const had = await page.evaluate(() => !!document.querySelector('[data-testid="log-jump"]'));
        await page.keyboard.press('Shift+Tab'); await settleScroll(page);
        const r = await page.evaluate(READ);
        const f = r.focus;
        walked++;
        if (r.active === 'log-jump') { say('W' + (start - i), r, '(알약에 닿음)'); break; }
        if (had && r.pill) {
          const bad1 = !f || !f.inView || f.coveredBy || f.hiddenByFixed.length;
          if (bad1) say('W' + (start - i), r);
          if (f && r.pillJ) worst = Math.max(worst, r.pillJ.bottom - f.top);
        }
        if (!r.pill) break; // 알약은 기록이 맨 위에 닿으면 설계대로 사라진다
      }
      console.log(`${name} ${w}x${h}·${pct}% W: 거슬러 오르기 ${walked}칸(알약 유지 구간), 단추 윗변이 알약 아랫변보다 위로 들어간 최대 ${Math.round(worst)}px`);
    } else console.log(`${name} ${w}x${h}·${pct}% W: 알약을 못 띄움`);
  } catch (e) { console.log(`${name} ${w}x${h}·${pct}% ERROR ${e.message.split('\n')[0]}`); failures++; }
  if (errors.length) console.log('  errors:', errors.slice(0, 3));
  await browser.close();
}
console.log(failures ? `\n판정 문제 ${failures}건` : '\n판정 문제 0건');
for (const b of bad) console.log('  ' + b);
process.exit(0);
