// QF5 공격: 배속 단추 연타(초당 10회) · 일시정지 중 배속 · 결정 카드 중 배속/자동 · 설정 변조(배속 이상치) · 새로고침 연타 · 탭 두 개 · 뒤로가기 · 회전
import { chromium, newPage, inject, evalCore, SETTINGS_KEY, GAME_KEY, BASE, SHOT } from './lib.mjs';
import { readFileSync } from 'node:fs';
const raw = JSON.parse(readFileSync('tests/fixtures/save-v040-both-age20.json', 'utf8')).data;
const base = { ...raw, paused: true };
delete base.play;
const out = [];
const rec = (id, verdict, note) => { out.push(`${id} | ${verdict} | ${note}`); console.log(`${id} | ${verdict} | ${note}`); };
const CYC = [1, 2, 4, 8];
const WATCH = `(() => { window.__sp = []; const b = document.querySelector('[data-testid=speed]'); window.__sp.push(+b.dataset.speed);
  new MutationObserver(() => { const v = +document.querySelector('[data-testid=speed]').dataset.speed; if (window.__sp.at(-1) !== v) window.__sp.push(v); }).observe(document.body, { subtree: true, attributes: true, attributeFilter: ['data-speed'] }); })()`;
const cycleOk = (seq) => seq.every((v, i) => i === 0 || CYC[(CYC.indexOf(seq[i - 1]) + 1) % 4] === v);

// A1: 연타 10회/초 터치(360)
{
  const { browser, page, errors } = await newPage(chromium, { width: 360, height: 740 });
  await inject(page, base, { speed: 1, autoMode: false, noteCards: false });
  await page.getByTestId('life-screen').waitFor({ state: 'visible' });
  await page.waitForTimeout(800);
  await page.evaluate(WATCH);
  const b = await page.getByTestId('speed').boundingBox();
  const x = b.x + b.width / 2, y = b.y + b.height / 2;
  for (let i = 0; i < 40; i++) { await page.touchscreen.tap(x, y); await page.waitForTimeout(100); }
  await page.waitForTimeout(400);
  const seq = await page.evaluate(() => window.__sp);
  const saved = await page.evaluate((k) => JSON.parse(localStorage.getItem(k)).data.speed, SETTINGS_KEY);
  const shown = await page.evaluate(() => +document.querySelector('[data-testid=speed]').dataset.speed);
  const paused = await page.getByTestId('pause').getAttribute('data-paused');
  const steps = seq.length - 1;
  rec('A1 배속 연타 10/s×40(터치 360)', cycleOk(seq) && saved === shown && paused === 'true' && errors.length === 0 && steps >= 30 ? 'PASS' : 'FAIL', `전이 ${steps}회(탭 40), 순서 순환 ${cycleOk(seq)}, 화면 ${shown}=저장 ${saved}, 일시정지 유지 ${paused}, 오류 ${errors.length}`);
  await browser.close();
}
// A2: 마우스 더블클릭·연타(PC)
{
  const { browser, page, errors } = await newPage(chromium, { width: 1280, height: 800 });
  await inject(page, base, { speed: 1, autoMode: false, noteCards: false });
  await page.getByTestId('life-screen').waitFor({ state: 'visible' });
  await page.waitForTimeout(800);
  await page.evaluate(WATCH);
  await page.getByTestId('speed').dblclick();
  await page.waitForTimeout(300);
  const afterDbl = await page.evaluate(() => +document.querySelector('[data-testid=speed]').dataset.speed);
  for (let i = 0; i < 30; i++) { await page.getByTestId('speed').click({ delay: 0 }); await page.waitForTimeout(100); }
  const seq = await page.evaluate(() => window.__sp);
  rec('A2 PC 더블클릭+연타', cycleOk(seq) && errors.length === 0 ? 'PASS' : 'FAIL', `더블클릭 후 ${afterDbl}배(두 번 눌림=1→4), 전이 ${seq.length - 1}회, 순환 ${cycleOk(seq)}, 오류 ${errors.length}`);
  await browser.close();
}
// B: 일시정지 중 배속 바꾸기 → 진행 재개 후 배속 반영
{
  const { browser, page, errors } = await newPage(chromium, { width: 1280, height: 800 });
  await inject(page, base, { speed: 1, autoMode: false, noteCards: false }, '/?__timescale=20');
  await page.getByTestId('life-screen').waitFor({ state: 'visible' });
  await page.waitForTimeout(800);
  const age0 = await page.getByTestId('life-age').innerText();
  await page.getByTestId('speed').click(); await page.waitForTimeout(150); await page.getByTestId('speed').click(); await page.waitForTimeout(150);
  const sp = await page.getByTestId('speed').getAttribute('data-speed');
  await page.waitForTimeout(1500);
  const age1 = await page.getByTestId('life-age').innerText();
  const stillPaused = await page.getByTestId('pause').getAttribute('data-paused');
  await page.getByTestId('pause').click();
  await page.waitForTimeout(4000);
  const age2 = await page.getByTestId('life-age').innerText();
  rec('B 일시정지 중 배속', sp === '4' && age0 === age1 && stillPaused === 'true' && age2 !== age1 && errors.length === 0 ? 'PASS' : 'FAIL', `배속 ${sp}, 나이 ${age0.trim()}→(정지 중)${age1.trim()}→(재개 4초)${age2.trim()}, 오류 ${errors.length}`);
  await browser.close();
}
// C: 결정 카드가 떠 있는 중 배속·자동 모드
{
  const { browser, page, errors } = await newPage(chromium, { width: 360, height: 740 }, { hasTouch: true });
  await page.goto(BASE + '/');
  const st = await evalCore(page, `
    for (let seed = 1; seed < 3000; seed++) {
      let s = core.enterLife(core.enterBirth(core.beginBirth(core.createInitialState(seed), 'alpha')));
      for (let g = 0; g < 100 && s.phase === 'life'; g++) {
        if (s.pending !== null) { if (s.age >= 22) return { ...s, paused: true }; s = core.autoResolveStep(s, s.pending.key).state; continue; }
        s = core.stepYear(s).state;
      }
    }
    return null;`);
  delete st.play;
  await inject(page, st, { speed: 1, autoMode: false, noteCards: false });
  await page.getByTestId('life-screen').waitFor({ state: 'visible' });
  await page.waitForTimeout(1200);
  const hasCard = await page.evaluate(() => !!document.querySelector('[data-testid=decision-card], [data-testid=decision], [data-testid^=decision]'));
  const pendKey = await page.evaluate((k) => JSON.parse(localStorage.getItem(k)).data.pending?.key ?? null, GAME_KEY);
  const reach = await page.evaluate(() => { const bt = document.querySelector('[data-testid=speed]').getBoundingClientRect(); const el = document.elementFromPoint(bt.left + bt.width / 2, bt.top + bt.height / 2); return { top: el?.closest('[data-testid]')?.dataset.testid, inertAncestor: !!document.querySelector('[data-testid=speed]').closest('[inert],[aria-hidden=true]') }; });
  // 모달 결정 시트가 열린 동안 배속·자동 모드는 눌리지 않는다(시트가 덮는다) — 키보드로도 포커스가 시트 안에 갇힌다
  const tabs = [];
  for (let i = 0; i < 10; i++) { await page.keyboard.press('Tab'); tabs.push(await page.evaluate(() => document.activeElement?.getAttribute('data-testid') ?? document.activeElement?.tagName)); }
  const pendAfter = await page.evaluate((k) => JSON.parse(localStorage.getItem(k)).data.pending?.key ?? null, GAME_KEY);
  rec('C1 모달 결정 시트 중 배속·자동 단추 접근', pendKey !== null && pendKey === pendAfter && !tabs.includes('speed') && !tabs.includes('auto') && errors.length === 0 ? 'PASS' : 'FAIL', `시트 ${hasCard}, 단추 자리 위 요소 ${JSON.stringify(reach)}, Tab 10회 ${tabs.join('>')}, 보류 유지 ${pendKey}→${pendAfter}, 오류 ${errors.length}`);
  await browser.close();
}
// D: 배속 설정 변조
for (const bad of [3, 0, -1, 99, '8', null, 'NaN', 1e9, 2.5, [], {}, true]) {
  const { browser, page, errors } = await newPage(chromium, { width: 360, height: 740 });
  await page.goto(BASE + '/');
  await page.waitForFunction((k) => localStorage.getItem(k) !== null, GAME_KEY);
  await inject(page, base, { speed: 1, autoMode: false, noteCards: false, theme: 'dark', bgm: { on: false, volume: 55 } });
  await page.evaluate(([k, v]) => { const s = JSON.parse(localStorage.getItem(k)); s.data.speed = v; localStorage.setItem(k, JSON.stringify(s)); }, [SETTINGS_KEY, bad]);
  // 저장을 덮는 앱 쓰기 방지: 새 페이지 로드
  await page.reload();
  await page.getByTestId('life-screen').waitFor({ state: 'visible', timeout: 8000 }).catch(() => {});
  const info = await page.evaluate(() => { const b = document.querySelector('[data-testid=speed]'); return b ? { sp: b.dataset.speed, txt: b.innerText.trim(), aria: b.getAttribute('aria-label') } : null; });
  const ok = info && CYC.includes(+info.sp) && /배속 \d배, 누르면 \d배/.test(info.aria) && errors.length === 0;
  const kept = await page.evaluate((k) => { const d = JSON.parse(localStorage.getItem(k) ?? 'null')?.data; return d ? `theme=${d.theme} vol=${d.bgm?.volume} noteCards=${d.noteCards} speed=${d.speed}` : 'none'; }, SETTINGS_KEY);
  if (info) { await page.keyboard.press('Escape'); await page.waitForTimeout(700); await page.getByTestId('speed').click({ force: true }); }
  const info2 = info ? await page.evaluate(() => document.querySelector('[data-testid=speed]').dataset.speed) : null;
  rec(`D 배속 변조 ${JSON.stringify(bad)}`, ok && CYC.includes(+info2) ? 'PASS' : 'FAIL', `읽힌 값 ${info?.sp} → 한 번 누르면 ${info2}, 라벨 "${info?.aria}", 다시 읽은 설정 ${kept}, 오류 ${errors.length} ${errors.slice(0, 1)}`);
  await browser.close();
}
// E: 새로고침 연타 12회 + 상태 복원
{
  const { browser, page, errors } = await newPage(chromium, { width: 360, height: 740 });
  await inject(page, base, { speed: 4, autoMode: false, noteCards: false });
  await page.getByTestId('life-screen').waitFor({ state: 'visible' });
  const age0 = await page.getByTestId('life-age').innerText();
  for (let i = 0; i < 14; i++) { await page.reload({ waitUntil: 'domcontentloaded' }); }
  await page.getByTestId('life-screen').waitFor({ state: 'visible' });
  await page.waitForTimeout(500);
  const sp = await page.getByTestId('speed').getAttribute('data-speed');
  const age1 = await page.getByTestId('life-age').innerText();
  const paused = await page.getByTestId('pause').getAttribute('data-paused');
  rec('E 새로고침 14연타', sp === '4' && age0 === age1 && errors.length === 0 ? 'PASS' : 'FAIL', `나이 ${age0.trim()}→${age1.trim()}, 배속 ${sp}, 일시정지 ${paused}, 오류 ${errors.length} ${errors.slice(0, 2)}`);
  await browser.close();
}
// F: 탭 두 개
{
  const { browser, ctx, page, errors } = await newPage(chromium, { width: 1280, height: 800 });
  await inject(page, base, { speed: 1, autoMode: false, noteCards: false });
  await page.getByTestId('life-screen').waitFor({ state: 'visible' });
  const p2 = await ctx.newPage();
  const e2 = [];
  p2.on('pageerror', (e) => e2.push(e.message));
  await p2.goto(BASE + '/');
  await p2.waitForTimeout(1500);
  const s1 = await page.evaluate(() => document.querySelector('[data-testid$="-screen"]')?.dataset.testid);
  const s2 = await p2.evaluate(() => document.querySelector('[data-testid$="-screen"]')?.dataset.testid);
  await page.waitForTimeout(500);
  await page.getByTestId('speed').click().catch(() => {});
  await p2.getByTestId('speed').click().catch(() => {});
  await page.waitForTimeout(500);
  const s1b = await page.evaluate(() => document.querySelector('[data-testid$="-screen"]')?.dataset.testid);
  const s2b = await p2.evaluate(() => document.querySelector('[data-testid$="-screen"]')?.dataset.testid);
  rec('F 탭 두 개', e2.length === 0 && errors.length === 0 ? 'RECORD' : 'FAIL', `탭1 ${s1}→${s1b}, 탭2 ${s2}→${s2b}(밀린 화면이면 한쪽만 이어짐 정상), 오류 ${errors.length + e2.length}`);
  await browser.close();
}
// G: 뒤로가기
{
  const { browser, page, errors } = await newPage(chromium, { width: 360, height: 740 });
  await inject(page, base, { speed: 2, autoMode: false, noteCards: false });
  await page.getByTestId('life-screen').waitFor({ state: 'visible' });
  await page.goto(BASE + '/?x=1');
  await page.waitForTimeout(600);
  await page.goBack();
  await page.waitForTimeout(800);
  await page.goBack().catch(() => {});
  await page.waitForTimeout(800);
  await page.goForward().catch(() => {});
  await page.waitForTimeout(800);
  const scr = await page.evaluate(() => document.querySelector('[data-testid$="-screen"]')?.dataset.testid);
  const sp = await page.evaluate(() => document.querySelector('[data-testid=speed]')?.dataset.speed ?? null);
  rec('G 뒤로가기/앞으로', errors.length === 0 ? 'PASS' : 'FAIL', `화면 ${scr}, 배속 ${sp}, 오류 ${errors.length} ${errors.slice(0, 2)}`);
  await browser.close();
}
// H: 회전 360x740 → 740x360 → 360x740 (같은 페이지)
{
  const { browser, page, errors } = await newPage(chromium, { width: 360, height: 740 }, { hasTouch: true });
  await inject(page, base, { speed: 1, autoMode: false, noteCards: false });
  await page.getByTestId('life-screen').waitFor({ state: 'visible' });
  const rows = [];
  for (const [w, h] of [[740, 360], [360, 740], [800, 360], [360, 740]]) {
    await page.setViewportSize({ width: w, height: h });
    await page.waitForTimeout(500);
    rows.push(await page.evaluate(() => { const b = document.querySelector('[data-testid=controls]').getBoundingClientRect(); return `${innerWidth}x${innerHeight}: bar ${b.height.toFixed(0)} pos ${getComputedStyle(document.querySelector('[data-testid=controls]')).position} ox ${document.documentElement.scrollWidth - document.documentElement.clientWidth}`; }));
  }
  rec('H 회전', errors.length === 0 && rows.every((r) => / ox 0$/.test(r)) ? 'PASS' : 'FAIL', rows.join(' ; '));
  await browser.close();
}
// C3: 비모달 부모 결정 카드가 떠 있는 중 배속·자동 모드(PC·모바일)
for (const vp of [{ width: 360, height: 740, touch: true }, { width: 1280, height: 800, touch: false }]) {
  const { browser, page, errors } = await newPage(chromium, { width: vp.width, height: vp.height }, { hasTouch: vp.touch });
  await page.goto(BASE + '/');
  const found = await evalCore(page, `
    for (let seed = 1; seed < 9000; seed++) {
      let s = core.enterLife(core.enterBirth(core.beginBirth(core.createInitialState(seed), 'alpha')));
      for (let g = 0; g < 80 && s.phase === 'life' && s.age <= 19; g++) {
        if (s.pending !== null) { s = core.autoResolveStep(s, s.pending.key).state; continue; }
        let cap = null;
        const r = core.stepYear(s, undefined, (e) => { cap = e; });
        if (cap !== null && r.tick.kind === 'resolved' && r.tick.by === 'parent' && r.tick.fromAge >= 3) return { start: s };
        s = r.state;
      }
    }
    return null;`);
  const st = found.start; delete st.play;
  await inject(page, st, { speed: 1, autoMode: false, noteCards: false }, '/');
  await page.getByTestId('parent-card').waitFor({ state: 'visible', timeout: 60000 });
  const tap = async (id) => (vp.touch ? page.getByTestId(id).tap() : page.getByTestId(id).click());
  await tap('speed'); await page.waitForTimeout(200); await tap('speed'); await page.waitForTimeout(200);
  const spd = await page.getByTestId('speed').getAttribute('data-speed');
  for (let i = 0; i < 5; i++) { await tap('auto'); await page.waitForTimeout(150); }
  const pr = await page.getByTestId('auto').getAttribute('aria-pressed');
  const cardStill = await page.getByTestId('parent-card').isVisible().catch(() => false);
  await page.waitForTimeout(1500);
  const settingsAuto = await page.evaluate((k) => JSON.parse(localStorage.getItem(k)).data.autoMode, SETTINGS_KEY);
  rec(`C3 부모 결정 카드 중 배속·자동(${vp.width})`, spd === '4' && pr === String(settingsAuto) && errors.length === 0 ? 'PASS' : 'FAIL', `배속 ${spd}, 자동 aria-pressed ${pr}=저장 ${settingsAuto}, 카드 유지(곧) ${cardStill}, 오류 ${errors.length} ${errors.slice(0, 1)}`);
  await browser.close();
}
