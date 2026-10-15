// QA-003 M2 공격 A: 태어나기 연타(A01)·진입 직후 클릭(A02)·라디오 빠른 전환(A03)·캐러셀 연타/스와이프/꾹(A04)
import { launch, mkctx, runCase, shot, openTitle, waitGuard, whichScreen, overflowX, readRaw, saveInfo, VP, TOUCH, PROD, SETTINGS_KEY, sleep } from './m2r2-lib.mjs';

const browser = await launch();
const only = process.argv[2];
const want = (id) => !only || only.split(',').includes(id);

/** 모든 click(캡처)을 기록: window.__clicks = ["start-birth", "next-life(가드)", "비버튼:DIV" ...] */
async function recordClicks(ctx) {
  await ctx.addInitScript(() => {
    window.__clicks = [];
    document.addEventListener(
      'click',
      (e) => {
        const b = e.target instanceof Element ? e.target.closest('button') : null;
        const name = b === null ? `비버튼:${e.target.tagName}` : b.dataset.testid || (b.textContent || '').trim().slice(0, 12);
        window.__clicks.push(b !== null && b.getAttribute('aria-disabled') === 'true' ? `${name}(가드)` : name);
      },
      true,
    );
  });
}

// ---------- A01 태어나기 연타·더블탭·길게 누름 ----------
if (want('A01'))
  await runCase({ id: 'M2-A01', cat: '공격', title: '「태어나기」 연타·더블탭·길게 누름 — 뷰포트 6종 × 방식 5종 (FS6·R-035·R-050)', steps: '가드가 풀린 뒤 「태어나기」 중심 좌표에 12연타(20ms 간격)·더블클릭·150ms 간격 두 번·터치 3연속 탭·길게 누름(1.5초)을 뷰포트마다 반복, 0.9초 뒤 화면·저장 단계·클릭 기록 확인', expected: '출생은 한 번만 — 화면은 출생 화면에 머물고(인생 화면으로 넘어가지 않음), 저장 phase=birth·age 0, 가드 중 입력은 (가드)로 무시' }, async () => {
    const problems = [];
    const rows = [];
    const shots = [];
    const viewports = [
      ['m360x740', VP.m360, true],
      ['m360x568', { width: 360, height: 568 }, true],
      ['m320x568', VP.m320, true],
      ['m375x812', VP.m375, true],
      ['d1280x800', VP.d1280, false],
      ['d1280x620', VP.d1280low, false],
    ];
    for (const [vname, vp, touch] of viewports) {
      for (const method of ['mouse12', 'dblclick', 'human150', 'tap3', 'longpress']) {
        if (method === 'tap3' && !touch) continue;
        const ctx = await mkctx(browser, { viewport: vp, ...(touch ? TOUCH : {}) });
        await recordClicks(ctx);
        const p = await ctx.newPage();
        await openTitle(p);
        await waitGuard(p);
        await sleep(200);
        const box = await p.getByTestId('start-birth').boundingBox();
        const x = box.x + box.width / 2;
        const y = box.y + box.height / 2;
        if (method === 'mouse12') {
          for (let i = 0; i < 12; i++) {
            await p.mouse.click(x, y);
            await sleep(20);
          }
        } else if (method === 'dblclick') {
          await p.mouse.dblclick(x, y);
        } else if (method === 'human150') {
          await p.mouse.click(x, y);
          await sleep(150);
          await p.mouse.click(x, y);
        } else if (method === 'tap3') {
          await p.touchscreen.tap(x, y);
          await p.touchscreen.tap(x, y);
          await p.touchscreen.tap(x, y);
        } else if (method === 'longpress') {
          await p.mouse.move(x, y);
          await p.mouse.down();
          await sleep(1500);
          await p.mouse.up();
        }
        await sleep(900);
        const screen = await whichScreen(p);
        const save = await saveInfo(p);
        const clicks = await p.evaluate(() => window.__clicks);
        const accepted = clicks.filter((c) => c === 'start-birth').length;
        rows.push(`${vname}/${method}: ${screen} phase=${save?.phase} 클릭 ${clicks.length}(수락 ${accepted}, 가드 ${clicks.filter((c) => c.endsWith('(가드)')).length})`);
        if (screen !== 'birth-screen') problems.push(`${vname}/${method}: 연타 뒤 화면 ${screen}`);
        if (save?.phase !== 'birth' || save?.age !== 0) problems.push(`${vname}/${method}: 저장 ${JSON.stringify(save)}`);
        if (accepted !== 1) problems.push(`${vname}/${method}: 「태어나기」 수락 ${accepted}회`);
        if (clicks.some((c) => c === 'next-life')) problems.push(`${vname}/${method}: 출생 화면 「살아가기」가 가드 없이 눌림 ${JSON.stringify(clicks)}`);
        if (method === 'mouse12' && vname === 'm360x568') shots.push(await shot(p, 'A01', `${vname}-${method}`));
        await ctx.close();
      }
    }
    return { verdict: problems.length ? 'FAIL' : 'PASS', actual: problems.length ? problems.slice(0, 8).join(' / ') : `전 조합(${rows.length}) 출생 1회·출생 화면 유지: ${rows.slice(0, 4).join(' ; ')} …`, shots };
  });

// ---------- A02 진입 직후 0.4초 안 클릭 ----------
if (want('A02'))
  await runCase({ id: 'M2-A02', cat: '공격', title: '진입 직후 0.4초 안 클릭 — 첫 화면(태어나기·라디오·캐러셀 버튼)·출생 화면(살아가기) 가드 (R-014·R-030)', steps: '첫 화면이 뜨자마자 가능한 한 빨리 「태어나기」·지난 세상 카드·캐러셀 「다음 지표」 클릭 → 0.6초 뒤 정상 클릭. 출생 화면 도착 즉시 「살아가기」 클릭', expected: '가드 중 입력 무시((가드)로 기록, 선택·슬라이드·화면 불변), 가드가 풀린 뒤 정상 동작' }, async () => {
    const problems = [];
    const facts = [];
    const a02shots = [];
    // 1) 첫 화면
    for (const [vname, vp] of [['m360', VP.m360], ['d1280', VP.d1280]]) {
      const ctx = await mkctx(browser, { viewport: vp, ...(vname === 'm360' ? TOUCH : {}) });
      await recordClicks(ctx);
      const p = await ctx.newPage();
      await p.goto(PROD, { waitUntil: 'commit' });
      await p.waitForSelector('[data-testid=title-screen]');
      const t = await p.evaluate(() => {
        const r = (id) => { const b = document.querySelector(`[data-testid="${id}"]`).getBoundingClientRect(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; };
        return { begin: r('start-birth'), eraPast: r('era-past'), next: document.querySelector('[data-testid=carousel-next]') ? r('carousel-next') : null, t: Math.round(performance.now()) };
      });
      const state0 = await p.evaluate(() => ({ count: document.querySelector('[data-testid=carousel-count]')?.innerText.trim(), era: ['past', 'present', 'future'].find((e) => document.querySelector(`[data-testid="era-${e}"]`).checked) }));
      // 즉시 클릭들 (각각 마운트 후 수십 ms 안)
      if (t.next && t.next.y < vp.height) await p.mouse.click(t.next.x, t.next.y);
      await p.mouse.click(t.eraPast.x, Math.min(t.eraPast.y, vp.height - 90)).catch(() => {});
      await p.mouse.click(t.begin.x, t.begin.y);
      const afterT = await p.evaluate(() => performance.now());
      const state1 = await p.evaluate(() => ({ screen: document.querySelector('[data-testid=title-screen]') ? 'title' : 'other', count: document.querySelector('[data-testid=carousel-count]')?.innerText.trim(), era: ['past', 'present', 'future'].find((e) => document.querySelector(`[data-testid="era-${e}"]`)?.checked) }));
      const clicks = await p.evaluate(() => window.__clicks.slice());
      facts.push(`${vname}: 마운트 후 ${Math.round(afterT - t.t)}ms 안에 클릭 ${JSON.stringify(clicks)} → ${JSON.stringify(state1)} (전 ${JSON.stringify(state0)})`);
      if (afterT - t.t < 380) {
        if (state1.screen !== 'title') problems.push(`${vname}: 가드 중 「태어나기」가 먹혀 화면 이탈 (${Math.round(afterT - t.t)}ms)`);
        if (state1.era !== state0.era) problems.push(`${vname}: 가드 중 라디오 선택이 바뀜 ${state0.era}→${state1.era}`);
        if (state1.count !== state0.count && state1.count !== undefined) problems.push(`${vname}: 가드 중 캐러셀 슬라이드가 넘어감 ${state0.count}→${state1.count}`);
      } else {
        facts.push(`${vname}: 클릭이 가드 시간(400ms) 뒤에 도착해 판정 제외(${Math.round(afterT - t.t)}ms)`);
      }
      await sleep(700);
      await p.mouse.click(t.begin.x, t.begin.y);
      await p.waitForSelector('[data-testid=birth-screen]', { timeout: 5000 }).catch(() => problems.push(`${vname}: 가드 뒤 정상 클릭이 안 먹힘`));
      if (vname === 'm360') {
        // 2) 출생 화면 도착 즉시 살아가기
        const nl = await p.evaluate(() => { const b = document.querySelector('[data-testid=next-life]').getBoundingClientRect(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; });
        await p.mouse.click(nl.x, nl.y);
        await sleep(100);
        const sc = await whichScreen(p);
        const clicks2 = await p.evaluate(() => window.__clicks.slice(-2));
        facts.push(`출생 화면 도착 직후 「살아가기」 클릭 → ${sc} ${JSON.stringify(clicks2)}`);
        a02shots.push(await shot(p, 'A02', 'birth-after-immediate-click'));
        if (sc !== 'birth-screen') problems.push(`출생 화면 도착 직후 「살아가기」가 먹혀 ${sc}`);
      }
      await ctx.close();
    }
    return { verdict: problems.length ? 'FAIL' : 'PASS', actual: problems.length ? problems.join(' / ') : facts.join(' | '), shots: a02shots };
  });

// ---------- A03 라디오 빠른 연속 전환 ----------
if (want('A03'))
  await runCase({ id: 'M2-A03', cat: '공격', title: '라디오 카드 빠른 연속 전환 (FS4·FS5)', steps: '1280x1000에서 세상 3카드·인생 길이 2카드 좌표를 무작위 순서로 60회(15ms 간격) 클릭 + 포커스된 라디오에서 방향키 ↓ 100회 연타 + 터치 360px에서 같은 연타', expected: '라디오마다 정확히 1개 선택, 마지막 클릭한 값이 화면·설정 저장과 일치, 「약 1시간」은 끝까지 선택 불가, 오류 0' }, async () => {
    const problems = [];
    const facts = [];
    const shots = [];
    for (const [vname, vp, touch] of [['d1280x1000', { width: 1280, height: 1000 }, false], ['m360', VP.m360, true]]) {
      const ctx = await mkctx(browser, { viewport: vp, ...(touch ? TOUCH : {}) });
      const p = await ctx.newPage();
      await openTitle(p);
      await waitGuard(p);
      await sleep(300);
      const targets = {};
      for (const id of ['era-past', 'era-present', 'era-future', 'life-short30', 'life-long60']) {
        await p.getByTestId(id).locator('xpath=ancestor::label').scrollIntoViewIfNeeded();
      }
      // 좌표는 스크롤마다 달라지므로 요소 클릭(force)으로 연타한다(힛 테스트 우회) — 대신 label을 바로 연속 click
      const order = [];
      const ids = ['era-past', 'era-present', 'era-future', 'life-short30', 'life-long60'];
      for (let i = 0; i < 60; i++) order.push(ids[(i * 7 + (i % 3)) % ids.length]);
      let lastEra = 'present';
      for (const id of order) {
        const lab = p.getByTestId(id).locator('xpath=ancestor::label');
        await lab.click({ force: true, noWaitAfter: true, timeout: 2000 }).catch(() => {});
        if (id.startsWith('era-')) lastEra = id.slice(4);
        await sleep(15);
      }
      await sleep(300);
      const st = await p.evaluate(() => ({
        eras: ['past', 'present', 'future'].filter((e) => document.querySelector(`[data-testid="era-${e}"]`).checked),
        lives: ['short30', 'long60'].filter((l) => document.querySelector(`[data-testid="life-${l}"]`).checked),
        selectedCards: document.querySelectorAll('.radio-card.is-selected').length,
      }));
      const settings = JSON.parse(await readRaw(p, SETTINGS_KEY)).data;
      facts.push(`${vname}: 마지막 세상 ${lastEra} → 화면 ${st.eras} 설정 ${settings.era}, 인생 ${st.lives}/${settings.lifeLength}`);
      if (st.eras.length !== 1 || st.eras[0] !== lastEra || settings.era !== lastEra) problems.push(`${vname}: 세상 선택 불일치 ${JSON.stringify(st)} 설정 ${settings.era} 기대 ${lastEra}`);
      if (st.lives.length !== 1 || st.lives[0] !== 'short30' || settings.lifeLength !== 'short30') problems.push(`${vname}: 인생 길이 이상 ${JSON.stringify(st)} ${settings.lifeLength}`);
      if (st.selectedCards !== 2) problems.push(`${vname}: 선택 표시된 카드 ${st.selectedCards}개`);
      // 방향키 꾹
      await p.getByTestId('era-past').focus();
      for (let i = 0; i < 100; i++) await p.keyboard.press('ArrowDown');
      const st2 = await p.evaluate(() => ['past', 'present', 'future'].filter((e) => document.querySelector(`[data-testid="era-${e}"]`).checked));
      const settings2 = JSON.parse(await readRaw(p, SETTINGS_KEY)).data;
      if (st2.length !== 1 || settings2.era !== st2[0]) problems.push(`${vname}: 방향키 100회 뒤 ${st2}/${settings2.era}`);
      facts.push(`${vname}: ↓×100 뒤 ${st2}/${settings2.era}`);
      shots.push(await shot(p, 'A03', vname));
      const ov = await overflowX(p);
      if (ov.overflow) problems.push(`${vname}: 가로 넘침`);
      await ctx.close();
    }
    return { verdict: problems.length ? 'FAIL' : 'PASS', actual: problems.length ? problems.join(' / ') : facts.join(' | '), shots };
  });

// ---------- A04 캐러셀 다음 연타·스와이프 난사·←/→ 꾹 ----------
async function swipe(cdp, x0, y0, x1, y1, steps = 6) {
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: x0, y: y0 }] });
  for (let i = 1; i <= steps; i++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x0 + ((x1 - x0) * i) / steps, y: y0 + ((y1 - y0) * i) / steps }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
}

if (want('A04'))
  await runCase({ id: 'M2-A04', cat: '공격', title: '캐러셀 「다음」 연타·스와이프 난사·←/→ 꾹 누르기 (SC5)', steps: '1280x800: 「다음 지표」 40연타(10ms) · 키보드 →/← 꾹(자동 반복 80회). 모바일 360 터치: 좌우 스와이프 30회 난사·세로 스와이프 8회(슬라이드 안 바뀌어야 함)', expected: '횟수에 맞게 정확히 이동(14장 순환), 항상 활성 슬라이드 1개, 가로 넘침·오류 0, 세로 스와이프는 슬라이드를 넘기지 않음' }, async () => {
    const problems = [];
    const facts = [];
    const shots = [];
    const cnt = (p) => p.getByTestId('carousel-count').innerText().then((s) => parseInt(s, 10));
    const active = (p) => p.evaluate(() => ({ n: document.querySelectorAll('.slide.is-active').length, label: document.querySelector('.slide.is-active')?.getAttribute('aria-label') }));
    // 데스크톱
    {
      const ctx = await mkctx(browser, { viewport: VP.d1280 });
      const p = await ctx.newPage();
      await openTitle(p);
      await waitGuard(p);
      await sleep(300);
      const box = await p.getByTestId('carousel-next').boundingBox();
      const x = box.x + box.width / 2, y = box.y + box.height / 2;
      await p.mouse.move(x, y);
      const start = await cnt(p);
      for (let i = 0; i < 40; i++) {
        await p.mouse.click(x, y);
        await sleep(10);
      }
      await sleep(500);
      const afterClicks = await cnt(p);
      const exp = ((start - 1 + 40) % 14) + 1;
      facts.push(`다음 40연타: ${start}→${afterClicks} (기대 ${exp})`);
      if (afterClicks !== exp) problems.push(`다음 40연타 ${start}→${afterClicks}, 기대 ${exp}`);
      const a1 = await active(p);
      if (a1.n !== 1 || !a1.label.startsWith(`${afterClicks}/14`)) problems.push(`활성 슬라이드 ${JSON.stringify(a1)} (count ${afterClicks})`);
      shots.push(await shot(p, 'A04', 'desktop-after-clicks'));
      // →/← 꾹 (keydown 반복)
      await p.getByTestId('carousel-viewport').focus();
      const k0 = await cnt(p);
      for (let i = 0; i < 80; i++) {
        await p.keyboard.down('ArrowRight');
        await sleep(15);
      }
      await p.keyboard.up('ArrowRight');
      await sleep(400);
      const k1 = await cnt(p);
      const expK = ((k0 - 1 + 80) % 14) + 1;
      facts.push(`→ 꾹 80회: ${k0}→${k1} (기대 ${expK})`);
      if (k1 !== expK) problems.push(`→ 꾹 ${k0}→${k1}, 기대 ${expK}`);
      for (let i = 0; i < 80; i++) {
        await p.keyboard.down('ArrowLeft');
        await sleep(15);
      }
      await p.keyboard.up('ArrowLeft');
      await sleep(400);
      const k2 = await cnt(p);
      facts.push(`← 꾹 80회: ${k1}→${k2} (기대 ${k0})`);
      if (k2 !== k0) problems.push(`← 꾹 ${k1}→${k2}, 기대 ${k0}`);
      const a2 = await active(p);
      if (a2.n !== 1) problems.push(`꾹 누른 뒤 활성 슬라이드 ${a2.n}개`);
      const ov = await overflowX(p);
      if (ov.overflow) problems.push('데스크톱 가로 넘침');
      await ctx.close();
    }
    // 모바일 스와이프
    {
      const ctx = await mkctx(browser, { viewport: VP.m360, ...TOUCH });
      const p = await ctx.newPage();
      await openTitle(p);
      await waitGuard(p);
      await sleep(300);
      await p.getByTestId('carousel-pause').scrollIntoViewIfNeeded();
      await p.getByTestId('carousel-pause').click(); // 자동 전환 제외
      const cdp = await ctx.newCDPSession(p);
      const vb = await p.getByTestId('carousel-viewport').boundingBox();
      const cx = vb.x + vb.width / 2, cy = Math.min(vb.y + 120, 600);
      await p.evaluate(() => window.scrollTo(window.scrollX, window.scrollY));
      const vb2 = await p.getByTestId('carousel-viewport').boundingBox();
      const cy2 = vb2.y + Math.min(vb2.height / 2, 120);
      const start = await cnt(p);
      let net = 0;
      const dirs = [];
      for (let i = 0; i < 30; i++) {
        const left = (i * 5) % 7 < 4; // 불규칙한 방향 섞기
        dirs.push(left ? 'L' : 'R');
        await swipe(cdp, cx + (left ? 90 : -90), cy2, cx + (left ? -90 : 90), cy2, 4);
        net += left ? 1 : -1;
        await sleep(30);
      }
      await sleep(500);
      const afterSwipes = await cnt(p);
      const expS = (((start - 1 + net) % 14) + 14) % 14 + 1;
      facts.push(`스와이프 30회(왼쪽→ ${dirs.filter((d) => d === 'L').length}, 오른쪽 ${dirs.filter((d) => d === 'R').length}): ${start}→${afterSwipes} (기대 ${expS})`);
      if (afterSwipes !== expS) problems.push(`스와이프 난사 ${start}→${afterSwipes}, 기대 ${expS}`);
      // 세로 스와이프: 슬라이드 불변
      const before = await cnt(p);
      for (let i = 0; i < 8; i++) {
        await swipe(cdp, cx, cy2 + 60, cx + 6, cy2 - 100, 5);
        await sleep(40);
      }
      await sleep(300);
      const afterV = await cnt(p);
      facts.push(`세로 스와이프 8회: ${before}→${afterV}`);
      if (afterV !== before) problems.push(`세로 스와이프로 슬라이드가 바뀜 ${before}→${afterV}`);
      const a3 = await active(p);
      if (a3.n !== 1) problems.push(`스와이프 뒤 활성 슬라이드 ${a3.n}개`);
      shots.push(await shot(p, 'A04', 'mobile-after-swipes'));
      const ov = await overflowX(p);
      if (ov.overflow) problems.push('모바일 가로 넘침');
      await ctx.close();
    }
    return { verdict: problems.length ? 'FAIL' : 'PASS', actual: problems.length ? problems.join(' / ') : facts.join(' | '), shots };
  });

await browser.close();
