// QA-003 M2 공격 B: 창 크기·회전(A05), 새로고침 연타(A06), 뒤로/앞으로(A07), 탭 가림(A08), 새로 태어나기 확인 더블탭(A09)
import { launch, mkctx, runCase, shot, openTitle, waitGuard, whichScreen, overflowX, readRaw, saveInfo, lifeInfo, startToLife, driveLife, setSpeed, VP, TOUCH, PROD, DEV, sleep } from './m2r2-lib.mjs';

const browser = await launch();
const only = process.argv[2];
const want = (id) => !only || only.split(',').includes(id);
const TITLE = '[data-testid=title-screen]';

// ---------- A05 창 크기·960 경계·회전 ----------
if (want('A05'))
  await runCase({ id: 'M2-A05', cat: '공격', title: '자동 전환 중 창 크기 바꾸기(960 경계 넘나들기)·회전 (FS3·SC5·R-206)', steps: '1280x800에서 자동 전환을 켠 채 1280→1000→961→960→959→700→360x740→740x360→360x740→959x500→1280x800 순으로 바꾸며 매번 가로 넘침·활성 슬라이드 수·캐러셀 위치·그래프 글자 크기·하단 띠 확인, 마지막에 자동 전환이 여전히 도는지', expected: '모든 크기에서 가로 넘침 0, 활성 슬라이드 정확히 1개, 캐러셀이 폭 ≥ 960이면 우측 열·미만이면 선택 아래, 그래프 글자 ≥ 12px, 오류 0, 자동 전환 유지' }, async () => {
    const ctx = await mkctx(browser, { viewport: VP.d1280 });
    const p = await ctx.newPage();
    await openTitle(p);
    await waitGuard(p);
    await p.mouse.move(2, 2);
    const problems = [];
    const rows = [];
    const shots = [];
    const sizes = [[1280, 800], [1000, 800], [961, 800], [960, 800], [959, 800], [700, 800], [360, 740], [740, 360], [360, 740], [959, 500], [1280, 800]];
    const measure = () => p.evaluate(() => {
      const car = document.querySelector('[data-testid=carousel]').getBoundingClientRect();
      const era = document.querySelector('[data-testid=era-group]').getBoundingClientRect();
      const life = document.querySelector('[data-testid=life-length-group]').getBoundingClientRect();
      const a = document.querySelector('.slide.is-active');
      let minFs = 99;
      for (const svg of a.querySelectorAll('svg')) {
        const vb = svg.viewBox?.baseVal?.width;
        const sc = vb ? svg.getBoundingClientRect().width / vb : 1;
        for (const t of svg.querySelectorAll('text')) minFs = Math.min(minFs, parseFloat(getComputedStyle(t).fontSize) * sc);
      }
      const bar = document.querySelector('[data-testid=bottom-bar]').getBoundingClientRect();
      const root = document.documentElement;
      const svgW = [...a.querySelectorAll('svg')].map((s) => Math.round(s.getBoundingClientRect().width));
      return { overflow: root.scrollWidth > root.clientWidth, sw: root.scrollWidth, cw: root.clientWidth, active: document.querySelectorAll('.slide.is-active').length, carLeft: Math.round(car.left), carRight: Math.round(car.right), carTop: Math.round(car.top + scrollY), eraRight: Math.round(era.right), lifeBottom: Math.round(life.bottom + scrollY), minFs: Math.round(minFs * 10) / 10, svgW, barBottom: Math.round(bar.bottom), vh: innerHeight, count: document.querySelector('[data-testid=carousel-count]').innerText.trim() };
    });
    for (const [w, h] of sizes) {
      await p.setViewportSize({ width: w, height: h });
      await sleep(500);
      const m = await measure();
      rows.push(`${w}x${h}: 넘침 ${m.overflow}, 활성 ${m.active}, 캐러셀 ${m.carLeft}~${m.carRight}, 글자 ${m.minFs}px, 그래프폭 ${m.svgW}, ${m.count}`);
      if (m.overflow) problems.push(`${w}x${h}: 가로 넘침 ${m.sw}>${m.cw}`);
      if (m.active !== 1) problems.push(`${w}x${h}: 활성 슬라이드 ${m.active}개`);
      if (m.minFs < 12) problems.push(`${w}x${h}: 그래프 글자 ${m.minFs}px`);
      if (m.carRight > w + 1) problems.push(`${w}x${h}: 캐러셀이 화면 밖 ${m.carRight}>${w}`);
      if (w >= 960) {
        if (!(m.carLeft >= m.eraRight - 1)) problems.push(`${w}x${h}: 폭≥960인데 캐러셀이 우측 열이 아님`);
      } else if (!(m.carTop >= m.lifeBottom - 1)) problems.push(`${w}x${h}: 폭<960인데 캐러셀이 선택 아래가 아님(top ${m.carTop} < ${m.lifeBottom})`);
      if (m.barBottom !== h) problems.push(`${w}x${h}: 하단 띠 bottom ${m.barBottom} ≠ ${h}`);
      if ([960, 959, 740].includes(w)) shots.push(await shot(p, 'A05', `${w}x${h}`));
    }
    // 크기를 빠르게 연속으로 흔들기 (resize 폭풍)
    for (let i = 0; i < 24; i++) {
      await p.setViewportSize({ width: i % 2 ? 1100 : 900, height: 800 });
      await sleep(40);
    }
    await p.setViewportSize({ width: 1280, height: 800 });
    await sleep(600);
    const m2 = await measure();
    if (m2.overflow || m2.active !== 1) problems.push(`resize 폭풍 뒤 넘침 ${m2.overflow}/활성 ${m2.active}`);
    // 자동 전환 유지
    await p.mouse.move(2, 2);
    const c0 = (await measure()).count;
    await sleep(8200);
    const c1 = (await measure()).count;
    rows.push(`자동 전환 유지: ${c0} → ${c1}`);
    if (c0 === c1) problems.push(`창 크기를 바꾼 뒤 자동 전환이 멈춤 ${c0}`);
    await ctx.close();
    // 모바일 회전 (터치·isMobile)
    const ctx2 = await mkctx(browser, { viewport: VP.m360, ...TOUCH });
    const p2 = await ctx2.newPage();
    await openTitle(p2);
    await waitGuard(p2);
    for (const [w, h] of [[740, 360], [360, 740], [740, 360], [360, 740]]) {
      await p2.setViewportSize({ width: w, height: h });
      await sleep(500);
      const ov = await overflowX(p2);
      const bar = await p2.getByTestId('start-birth').boundingBox();
      rows.push(`회전 ${w}x${h}: 넘침 ${ov.overflow}, 태어나기 ${Math.round(bar.x)},${Math.round(bar.y)} ${Math.round(bar.width)}x${Math.round(bar.height)}`);
      if (ov.overflow) problems.push(`회전 ${w}x${h}: 가로 넘침`);
      if (bar.y + bar.height > h + 0.5 || bar.y < 0) problems.push(`회전 ${w}x${h}: 태어나기가 화면 밖`);
      if (w === 740) shots.push(await shot(p2, 'A05', 'rotate-740x360'));
    }
    await p2.getByTestId('start-birth').click();
    await p2.waitForSelector('[data-testid=birth-screen]').catch(() => problems.push('회전 뒤 태어나기 불가'));
    await ctx2.close();
    return { verdict: problems.length ? 'FAIL' : 'PASS', actual: problems.length ? problems.slice(0, 8).join(' / ') : rows.slice(0, 5).join(' ; ') + ' …', shots };
  });

// ---------- A06 새로고침 연타 ----------
if (want('A06'))
  await runCase({ id: 'M2-A06', cat: '공격', title: '새로고침 연타 — 첫 화면·출생·인생 중 각 12회 (RL5·R-021·C3)', steps: 'prod 360x740: (1) 첫 화면에서 reload 12회(대기 없이) (2) 출생 화면에서 12회 → 같은 인물·같은 시드 (3) 인생 8배속 진행 중 12회(300ms 간격) → 이름 동일·나이 되돌아가지 않음', expected: '매번 같은 화면 복원, 출생 결과 불변(재추첨 없음), 인생 나이 단조 증가, 저장 손상·밀린 화면·콘솔 오류 0' }, async () => {
    const problems = [];
    const facts = [];
    const shots = [];
    // (1) 첫 화면
    {
      const ctx = await mkctx(browser, { viewport: VP.m360, ...TOUCH });
      const p = await ctx.newPage();
      await openTitle(p);
      await p.getByTestId('era-past').check({ force: true }).catch(() => {});
      for (let i = 0; i < 12; i++) await p.reload({ waitUntil: 'commit' }).catch(() => {});
      await p.waitForSelector(TITLE, { timeout: 10000 });
      const sc = await whichScreen(p);
      const ov = await overflowX(p);
      facts.push(`첫 화면 ×12: ${sc}`);
      if (sc !== 'title-screen' || ov.overflow) problems.push(`첫 화면 새로고침 연타 뒤 ${sc} 넘침 ${ov.overflow}`);
      await ctx.close();
    }
    // (2) 출생 화면
    {
      const ctx = await mkctx(browser, { viewport: VP.m360, ...TOUCH });
      const p = await ctx.newPage();
      await openTitle(p);
      await waitGuard(p);
      await p.getByTestId('start-birth').click();
      await p.waitForSelector('[data-testid=birth-screen]');
      await sleep(300);
      const snap = () => p.evaluate(() => ({ name: document.querySelector('[data-testid=birth-name]')?.innerText, year: document.querySelector('[data-testid=birth-year]')?.innerText, facts: document.querySelector('.facts')?.innerText }));
      const s0 = await snap();
      const save0 = await saveInfo(p);
      for (let i = 0; i < 12; i++) {
        await p.reload({ waitUntil: i % 2 ? 'commit' : 'domcontentloaded' }).catch(() => {});
      }
      await p.waitForSelector('[data-testid=birth-screen]', { timeout: 10000 });
      await sleep(300);
      const s1 = await snap();
      const save1 = await saveInfo(p);
      shots.push(await shot(p, 'A06', 'birth-after-12'));
      facts.push(`출생 ×12: ${s0.name} → ${s1.name}, 시드 ${save0.seed === save1.seed}`);
      if (JSON.stringify(s0) !== JSON.stringify(s1)) problems.push(`출생 화면이 새로고침 뒤 달라짐 ${JSON.stringify(s0)} → ${JSON.stringify(s1)}`);
      if (save0.seed !== save1.seed || save1.phase !== 'birth') problems.push(`저장 ${JSON.stringify(save0)} → ${JSON.stringify(save1)}`);
      await ctx.close();
    }
    // (3) 인생 중
    {
      const ctx = await mkctx(browser, { viewport: VP.m360, ...TOUCH });
      const p = await ctx.newPage();
      await openTitle(p);
      await startToLife(p);
      await setSpeed(p, 8);
      await p.locator('[data-testid="auto"]').click();
      await sleep(1500);
      let lastAge = -1;
      let name0 = null;
      const ages = [];
      for (let i = 0; i < 12; i++) {
        const info = await lifeInfo(p).catch(() => null);
        if (info && info.screen === 'life-screen') {
          if (name0 === null) name0 = info.name;
          if (info.name !== name0) problems.push(`인생 중 새로고침 ${i}회째 이름 ${name0}→${info.name}`);
          if (info.age < lastAge) problems.push(`나이가 되돌아감 ${lastAge}→${info.age} (새로고침 ${i}회째)`);
          lastAge = Math.max(lastAge, info.age);
          ages.push(info.age);
        } else if (info) problems.push(`새로고침 ${i}회째 화면 ${info.screen}`);
        await p.reload({ waitUntil: 'domcontentloaded' });
        await p.waitForSelector('[data-testid=life-screen],[data-testid=ending-screen]', { timeout: 8000 }).catch(() => {});
        await sleep(1300);
      }
      const fin = await lifeInfo(p);
      shots.push(await shot(p, 'A06', 'life-after-12'));
      facts.push(`인생 ×12: 나이 ${ages.join(',')} 최종 ${fin.screen} ${fin.age}`);
      const save = await saveInfo(p);
      if (!save || save.version !== 5) problems.push(`저장 ${JSON.stringify(save)}`);
      await ctx.close();
    }
    return { verdict: problems.length ? 'FAIL' : 'PASS', actual: problems.length ? problems.slice(0, 6).join(' / ') : facts.join(' | '), shots };
  });

// ---------- A07 뒤로가기/앞으로가기 ----------
if (want('A07'))
  await runCase({ id: 'M2-A07', cat: '공격', title: '뒤로가기/앞으로가기 (SPA — 화면 전환은 기록 항목을 만들지 않는다)', steps: 'prod: 빈 탭에서 앱 열기 → 태어나기 → 출생 화면에서 history.length 확인 → 브라우저 뒤로가기 → 앞으로가기 → 인생 진행 중 뒤로/앞으로', expected: '앱 안 화면 전환은 history를 쌓지 않음(뒤로가기는 앱을 떠남), 앞으로가기로 돌아오면 저장된 화면(출생·인생)이 그대로 복원, 오류 0' }, async () => {
    const ctx = await mkctx(browser, { viewport: VP.m360, ...TOUCH });
    const p = await ctx.newPage();
    const problems = [];
    const facts = [];
    await p.goto('about:blank');
    await openTitle(p);
    const h0 = await p.evaluate(() => history.length);
    await startToLife(p).catch(async () => {});
    const sc1 = await whichScreen(p);
    const h1 = await p.evaluate(() => history.length);
    const name = (await lifeInfo(p)).name;
    facts.push(`history.length ${h0}→${h1} (첫 화면→출생→인생)`);
    if (h1 !== h0) problems.push(`화면 전환이 history를 쌓음 ${h0}→${h1}`);
    await setSpeed(p, 8);
    await sleep(1200);
    await p.goBack({ waitUntil: 'commit' }).catch(() => {});
    await sleep(400);
    const urlBack = p.url();
    facts.push(`뒤로가기 → ${urlBack}`);
    await p.goForward({ waitUntil: 'domcontentloaded' }).catch(() => {});
    await p.waitForSelector('[data-testid=life-screen]', { timeout: 8000 }).catch(() => {});
    await sleep(500);
    const after = await lifeInfo(p);
    facts.push(`앞으로가기 → ${after.screen} ${after.name} ${after.age}세 (전 ${name})`);
    if (after.screen !== 'life-screen' || after.name !== name) problems.push(`앞으로가기 뒤 ${after.screen}/${after.name} (기대 인생/${name})`);
    const shots = [await shot(p, 'A07', 'after-forward')];
    // 첫 화면에서도
    const ctx2 = await mkctx(browser, { viewport: VP.m360, ...TOUCH });
    const p2 = await ctx2.newPage();
    await p2.goto('about:blank');
    await openTitle(p2);
    await p2.getByTestId('era-future').check({ force: true }).catch(() => {});
    await sleep(300);
    await p2.goBack({ waitUntil: 'commit' }).catch(() => {});
    await sleep(300);
    await p2.goForward({ waitUntil: 'domcontentloaded' }).catch(() => {});
    await p2.waitForSelector(TITLE, { timeout: 8000 });
    const eraKept = await p2.evaluate(() => ['past', 'present', 'future'].find((e) => document.querySelector(`[data-testid="era-${e}"]`).checked));
    facts.push(`첫 화면 뒤로/앞으로: 세상 ${eraKept}`);
    if (eraKept !== 'future') problems.push(`첫 화면 뒤로/앞으로 뒤 선택 유지 안 됨 ${eraKept}`);
    await ctx.close();
    await ctx2.close();
    return { verdict: problems.length ? 'FAIL' : 'PASS', actual: problems.length ? problems.join(' / ') : facts.join(' | '), shots };
  });

// ---------- A08 탭 숨겼다 돌아오기 ----------
if (want('A08'))
  await runCase({ id: 'M2-A08', cat: '공격', title: '탭을 숨겼다 돌아오기 — 캐러셀 자동 전환·인생 진행 (SC5·R-005)', steps: 'visibilityState를 hidden으로 바꿔(visibilitychange 발생) 캐러셀: 10초 대기 → 변화 없음, 복귀 뒤 8초 안에 정확히 1장 이동. 인생 8배속: 숨긴 6초 동안 나이 불변, 복귀 후 진행 재개', expected: '숨긴 동안 슬라이드·인생이 멈추고(백로그 몰아치기 없음), 복귀 후 정상 재개' }, async () => {
    const hide = (p) => p.evaluate(() => { window.__vis = 'hidden'; document.dispatchEvent(new Event('visibilitychange')); });
    const show = (p) => p.evaluate(() => { window.__vis = 'visible'; document.dispatchEvent(new Event('visibilitychange')); });
    const init = (ctx) => ctx.addInitScript(() => {
      window.__vis = 'visible';
      Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => window.__vis });
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => window.__vis === 'hidden' });
    });
    const problems = [];
    const facts = [];
    const ctx = await mkctx(browser, { viewport: VP.d1280 });
    await init(ctx);
    const p = await ctx.newPage();
    await openTitle(p);
    await waitGuard(p);
    await p.mouse.move(2, 2);
    const cnt = () => p.getByTestId('carousel-count').innerText().then((s) => parseInt(s, 10));
    await sleep(1000);
    const c0 = await cnt();
    await hide(p);
    await sleep(10000);
    const c1 = await cnt();
    const auto = await p.getByTestId('carousel').getAttribute('data-autoplay');
    await show(p);
    await sleep(100);
    const t0 = Date.now();
    let c2 = c1;
    while (Date.now() - t0 < 8500 && c2 === c1) {
      await sleep(250);
      c2 = await cnt();
    }
    await sleep(400);
    const c3 = await cnt();
    facts.push(`캐러셀: 숨기기 전 ${c0} → 10초 숨김 ${c1}(auto=${auto}) → 복귀 뒤 ${c2} → 잠시 뒤 ${c3}`);
    if (c1 !== c0) problems.push(`숨긴 동안 슬라이드가 바뀜 ${c0}→${c1}`);
    if (c2 === c1) problems.push('복귀 뒤 8.5초 안에 자동 전환 재개 안 됨');
    if (((c3 - c1 + 14) % 14) > 1) problems.push(`복귀 뒤 몰아서 이동 ${c1}→${c3}`);
    // 인생
    await startToLife(p);
    await setSpeed(p, 8);
    await p.locator('[data-testid="auto"]').click();
    await sleep(2500);
    const a0 = (await lifeInfo(p)).age;
    await hide(p);
    await sleep(6000);
    const a1 = (await lifeInfo(p)).age;
    await show(p);
    await sleep(3500);
    const a2 = (await lifeInfo(p)).age;
    facts.push(`인생(8배): 숨기기 전 ${a0}세 → 6초 숨김 ${a1}세(최대 1해 차이 허용) → 복귀 3.5초 뒤 ${a2}세`);
    if (a1 - a0 > 1) problems.push(`숨긴 동안 인생이 진행됨 ${a0}→${a1}`);
    if (a2 <= a1 && !(await lifeInfo(p)).hasChoice) problems.push(`복귀 뒤 인생 진행 재개 안 됨 ${a1}→${a2}`);
    // 가려진 채 시작(탭이 백그라운드에서 열림)
    const shots = [await shot(p, 'A08', 'after-return')];
    await ctx.close();
    return { verdict: problems.length ? 'FAIL' : 'PASS', actual: problems.length ? problems.join(' / ') : facts.join(' | '), shots };
  });

// ---------- A09 「새로 태어나기」 확인 단계 더블탭 ----------
if (want('A09'))
  await runCase({ id: 'M2-A09', cat: '공격', title: '「새로 태어나기」 더블탭·연타 — 확인 단계에서 이전 판이 지워지면 안 됨 (FS6·R-204)', steps: '개발 서버(?__exit)에서 몇 해 산 판 → 첫 화면에서 「새로 태어나기」를 방식별(더블클릭·3연타·150ms 간격·터치 3탭·길게 누름)로 눌러 확인 단계 진입 → 이전 판 저장 불변 확인 → 확정 버튼 더블클릭 → 새 판 한 개만·출생 화면 유지', expected: '확인 없이 이전 판이 지워지는 입력 0(5방식 × 모바일·데스크톱), 확정 더블클릭은 새 판 1개(출생 화면에 머묾)' }, async () => {
    const problems = [];
    const facts = [];
    const shots = [];
    for (const [vname, vp, touch] of [['m360', VP.m360, true], ['d1280', VP.d1280, false]]) {
      for (const method of ['dblclick', 'mouse3', 'human150', 'tap3', 'longpress']) {
        if (method === 'tap3' && !touch) continue;
        const ctx = await mkctx(browser, { viewport: vp, ...(touch ? TOUCH : {}) });
        const p = await ctx.newPage();
        await p.goto(DEV + '?__timescale=20');
        await p.waitForSelector(TITLE);
        await startToLife(p);
        await driveLife(p, (i) => i.screen === 'life-screen' && i.age >= 2 && !i.hasChoice);
        await sleep(300);
        const before = await saveInfo(p);
        await p.goto(DEV + '?__exit&__timescale=20');
        await p.waitForSelector(TITLE);
        await waitGuard(p, 'begin-new');
        await sleep(200);
        const box = await p.getByTestId('begin-new').boundingBox();
        const x = box.x + box.width / 2, y = box.y + box.height / 2;
        if (method === 'dblclick') await p.mouse.dblclick(x, y);
        else if (method === 'mouse3') { for (let i = 0; i < 3; i++) await p.mouse.click(x, y); }
        else if (method === 'human150') { await p.mouse.click(x, y); await sleep(150); await p.mouse.click(x, y); }
        else if (method === 'tap3') { for (let i = 0; i < 3; i++) await p.touchscreen.tap(x, y); }
        else if (method === 'longpress') { await p.mouse.move(x, y); await p.mouse.down(); await sleep(1500); await p.mouse.up(); }
        await sleep(700);
        const sc = await whichScreen(p);
        const confirmOpen = await p.getByTestId('confirm-new-ask').count();
        const save = await saveInfo(p);
        const intact = save.phase === 'life' && save.name === before.name && save.age >= before.age;
        facts.push(`${vname}/${method}: ${sc} 확인단계 ${confirmOpen ? '열림' : '닫힘'} 저장 ${save.phase}/${save.name}/${save.age}세`);
        if (!intact) problems.push(`${vname}/${method}: 이전 판이 사라짐 ${JSON.stringify(before)} → ${JSON.stringify(save)}`);
        if (sc !== 'title-screen') problems.push(`${vname}/${method}: 화면 ${sc}`);
        if (method === 'dblclick') shots.push(await shot(p, 'A09', `${vname}-after-${method}`));
        // 확정 더블클릭 (확인 단계가 열려 있을 때만)
        if (confirmOpen && method === 'dblclick') {
          await waitGuard(p, 'confirm-new-yes');
          await sleep(200);
          const yb = await p.getByTestId('confirm-new-yes').boundingBox();
          await p.mouse.dblclick(yb.x + yb.width / 2, yb.y + yb.height / 2);
          await sleep(800);
          const sc2 = await whichScreen(p);
          const save2 = await saveInfo(p);
          facts.push(`${vname}: 확정 더블클릭 → ${sc2} 저장 ${save2.phase}/${save2.age}세`);
          if (sc2 !== 'birth-screen' || save2.phase !== 'birth') problems.push(`${vname}: 확정 더블클릭 뒤 ${sc2}/${save2.phase} (출생 화면 기대)`);
          shots.push(await shot(p, 'A09', `${vname}-confirm-dblclick`));
        }
        await ctx.close();
      }
    }
    return { verdict: problems.length ? 'FAIL' : 'PASS', actual: problems.length ? problems.slice(0, 6).join(' / ') : facts.slice(0, 5).join(' ; ') + ' …', shots };
  });

await browser.close();
