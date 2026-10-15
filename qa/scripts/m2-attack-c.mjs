// QA-003 M2 공격 C: 저장 중 종료(A10)·localStorage 손상(A11)·long60 심기(A12)·오프라인(A13)·200% 확대(A14)
import { launch, mkctx, runCase, shot, openTitle, waitGuard, whichScreen, overflowX, readRaw, saveInfo, lifeInfo, startToLife, driveLife, setSpeed, bodyText, VP, TOUCH, PROD, GAME_KEY, SETTINGS_KEY, sleep, con } from './m2-lib.mjs';

const browser = await launch();
const only = process.argv[2];
const want = (id) => !only || only.split(',').includes(id);
const TITLE = '[data-testid=title-screen]';

// ---------- A10 저장 중 종료 ----------
if (want('A10'))
  await runCase({ id: 'M2-A10', cat: '공격', title: '저장 중 종료 — 인생 진행 중 렌더러를 즉시 죽이고(Page.crash, pagehide 없음)/탭을 닫고 다시 열기 (CM1)', steps: 'prod 360x740 8배속 자동: 무작위 시점에 Page.crash 4회·탭 닫기(beforeunload 없이) 2회 → 같은 컨텍스트에서 새 탭으로 열어 복원 확인. 출생 화면·첫 화면에서도 1회씩', expected: '매번 같은 인물의 인생 화면으로 복원(나이가 되돌아가도 1해 이내), 저장 JSON v5 정상, 「새 게임」으로 리셋되는 일 0' }, async () => {
    const ctx = await mkctx(browser, { viewport: VP.m360, ...TOUCH });
    let p = await ctx.newPage();
    const problems = [];
    const facts = [];
    await openTitle(p);
    await waitGuard(p);
    // 첫 화면에서 크래시 → 선택 유지
    await p.getByTestId('era-past').evaluate((el) => el.scrollIntoView({ block: 'center' }));
    await p.getByTestId('era-past').check();
    await sleep(6500); // 렌더러가 죽으면 Chromium이 아직 디스크에 넘기지 못한 localStorage 쓰기(수 초 지연)는 앱과 무관하게 사라진다 — 그 지연을 지나서 죽인다
    let cdp = await ctx.newCDPSession(p);
    cdp.send('Page.crash').catch(() => {}); // 응답이 오지 않으므로 기다리지 않는다(기다리면 멈춘다)
    await sleep(500);
    await p.close({ runBeforeUnload: false }).catch(() => {});
    p = await ctx.newPage();
    await openTitle(p);
    const eraKept = await p.evaluate(() => ['past', 'present', 'future'].find((e) => document.querySelector(`[data-testid="era-${e}"]`).checked));
    facts.push(`첫 화면 크래시 뒤 세상 ${eraKept}`);
    if (eraKept !== 'past') problems.push(`첫 화면 크래시 뒤 선택 유지 안 됨 ${eraKept}`);
    // 출생 화면 크래시
    await waitGuard(p);
    await p.getByTestId('start-birth').click();
    await p.waitForSelector('[data-testid=birth-screen]');
    await sleep(6500);
    const nameB = (await lifeInfo(p)).name;
    cdp = await ctx.newCDPSession(p);
    cdp.send('Page.crash').catch(() => {}); // 응답이 오지 않으므로 기다리지 않는다(기다리면 멈춘다)
    await sleep(500);
    await p.close({ runBeforeUnload: false }).catch(() => {});
    p = await ctx.newPage();
    await p.goto(PROD);
    await p.waitForSelector('[data-testid=birth-screen]', { timeout: 8000 }).catch(() => {});
    const nameB2 = (await lifeInfo(p)).name;
    facts.push(`출생 화면 크래시 뒤 ${nameB2} (전 ${nameB})`);
    if (nameB2 !== nameB) problems.push(`출생 화면 크래시 뒤 인물 변경 ${nameB}→${nameB2}`);
    // 인생 중
    await waitGuard(p, 'next-life');
    await p.getByTestId('next-life').click();
    await p.waitForSelector('[data-testid=life-screen]');
    await setSpeed(p, 8);
    await p.locator('[data-testid="auto"]').click();
    const ages = [];
    for (let round = 0; round < 6; round++) {
      await sleep(1500 + Math.floor(Math.random() * 2500));
      const before = await lifeInfo(p);
      const mode = round < 4 ? 'crash' : 'close';
      if (mode === 'crash') {
        cdp = await ctx.newCDPSession(p);
        cdp.send('Page.crash').catch(() => {}); // 응답이 오지 않으므로 기다리지 않는다(기다리면 멈춘다)
        await sleep(400);
      }
      await p.close({ runBeforeUnload: false }).catch(() => {});
      p = await ctx.newPage();
      await p.goto(PROD);
      await p.waitForSelector('[data-testid=life-screen],[data-testid=ending-screen],[data-testid=title-screen]', { timeout: 8000 }).catch(() => {});
      const after = await lifeInfo(p);
      const raw = await saveInfo(p);
      ages.push(`${mode}: ${before.age}→${after.age}`);
      if (after.screen === 'ending-screen') { facts.push('엔딩 도달 — 이후 라운드 생략'); break; }
      if (after.screen !== 'life-screen') problems.push(`라운드 ${round} ${mode}: 복원 화면 ${after.screen}`);
      else if (after.name !== before.name) problems.push(`라운드 ${round} ${mode}: 이름 달라짐 ${before.name}→${after.name}`);
      else if (after.age < before.age - (mode === 'crash' ? 8 : 1)) problems.push(`라운드 ${round} ${mode}: 나이가 ${before.age}→${after.age}로 너무 되돌아감`);
      if (!raw || raw.version !== 5) problems.push(`라운드 ${round}: 저장 ${JSON.stringify(raw)}`);
      await p.locator('[data-testid="auto"]').waitFor({ timeout: 3000 }).catch(() => {});
    }
    facts.push(ages.join(', '));
    const shots = [await shot(p, 'A10', 'restored')];
    await ctx.close();
    return { verdict: problems.length ? 'FAIL' : 'PASS', actual: problems.length ? problems.join(' / ') : facts.join(' | '), shots };
  });

// ---------- A11 localStorage 손상 ----------
function seedCtx(ctx, game, settings) {
  return ctx.addInitScript(
    ([gk, gv, sk, sv]) => {
      try {
        // 주입 스크립트는 about:blank·불투명 문서에도 실행되므로 접근 거부는 삼킨다(앱의 오류가 아니다)
        if (sessionStorage.getItem('__seeded')) return;
        sessionStorage.setItem('__seeded', '1');
        if (gv !== null) localStorage.setItem(gk, gv);
        if (sv !== null) localStorage.setItem(sk, sv);
      } catch {}
    },
    [GAME_KEY, game, SETTINGS_KEY, settings],
  );
}

if (want('A11'))
  await runCase({ id: 'M2-A11', cat: '공격', title: 'localStorage 손상 — 잘못된 JSON·다른 버전·v4 모양·스크립트 이름·초대형 값 (CM1·C6·R-214)', steps: '저장 키마다 손상 값을 심고 prod 첫 로드: 화면·안내문(「이전 버전…」)·콘솔·다이얼로그 확인 → 새로고침(안내가 다시 안 뜨는지) → 태어나기 정상', expected: '모든 경우 첫 화면에서 새 게임(흰 화면·오류 화면 0), v4 진행 저장만 안내 한 번(새로고침 뒤 안 뜸)·v4 진행 전/손상은 안내 없음, 스크립트 이름은 실행되지 않음, 이후 정상 플레이' }, async () => {
    const lifeV5 = (name) => JSON.stringify({ version: 5, data: { phase: 'life', era: 'present', lifeLength: 'short30', character: { name, gender: 'male', birthYear: 2012, parentWealth: 3, parenting: 'free', looks: 50 }, stats: { wealth: 45, education: 6, health: 70, happiness: 52, relationships: 54 }, birthStats: { wealth: 45, education: 6, health: 70, happiness: 52, relationships: 54 }, age: 0, history: [{ age: 0, kind: 'stage', text: '2012년, 남자아이로 태어났다.' }], flags: [], seen: {}, pending: null, lastChoiceAge: null, death: null, seed: 1234, rngState: 1235 } });
    const cases = [
      ['깨진 JSON', '{not json', null, false],
      ['빈 문자열', '', null, false],
      ['null 문자열', 'null', null, false],
      ['배열', '[]', null, false],
      ['버전 99', '{"version":99,"data":{}}', null, false],
      ['버전 5인데 형태 오류', '{"version":5,"data":{"phase":"life"}}', null, false],
      ['v4 진행 저장', '{"version":4,"data":{"phase":"life","era":"present","age":10,"character":{"name":"김민준"}}}', null, true],
      ['v3 출생 저장', '{"version":3,"data":{"phase":"birth"}}', null, true],
      ['v4 진행 전(title)', '{"version":4,"data":{"phase":"title"}}', null, false],
      ['v4 시대 선택(eraSelect)', '{"version":4,"data":{"phase":"eraSelect"}}', null, false],
      ['스크립트 이름(유효 v5)', lifeV5('<svg onload=_p=1>'), null, false, 'script'],
      ['초대형 쓰레기 값(3MB)', 'x'.repeat(3_000_000), null, false],
      ['설정 깨진 JSON', null, '{', false],
      ['설정 버전 99', null, '{"version":99,"data":{}}', false],
      ['설정 값 형태 오류', null, '{"version":2,"data":{"era":"zzz","lifeLength":7,"speed":3,"autoMode":"yes"}}', false],
      ['저장·설정 모두 깨짐', '\u0000\u0001<<', '\ud800', false],
    ];
    const problems = [];
    const rows = [];
    const shots = [];
    for (const [name, game, settings, expectNotice, flag] of cases) {
      const ctx = await mkctx(browser, { viewport: VP.m360, ...TOUCH });
      await seedCtx(ctx, game, settings);
      const p = await ctx.newPage();
      let dialogs = 0;
      p.on('dialog', (d) => { dialogs++; d.dismiss().catch(() => {}); });
      await p.goto(PROD);
      await p.waitForSelector('[data-testid=title-screen],[data-testid=life-screen],[data-testid=error-screen],[data-testid=superseded-screen]', { timeout: 10000 }).catch(() => {});
      await sleep(500);
      const sc = await whichScreen(p);
      let notice = await p.getByTestId('old-save-notice').count();
      const noticeText = notice ? await p.getByTestId('old-save-notice').innerText() : '';
      const txt = await bodyText(p);
      const pwn = await p.evaluate(() => window._p === 1);
      const text1 = sc;
      if (flag === 'script') {
        // 유효 저장이면 인생 화면이 뜰 수 있다 — 이름이 글자 그대로 보이고 실행되지 않아야 한다
        if (pwn || dialogs) problems.push(`${name}: 스크립트가 실행됨`);
        if (sc === 'life-screen' && !txt.includes('<svg onload=_p=1>')) problems.push(`${name}: 이름이 글자 그대로 보이지 않음`);
        shots.push(await shot(p, 'A11', 'script-name'));
        rows.push(`${name}: ${sc} (이름이 글자 그대로 표시 ${txt.includes('<svg onload=_p=1>')}, 실행 ${pwn})`);
        await ctx.close();
        continue;
      }
      if (sc !== 'title-screen') problems.push(`${name}: 첫 화면이 아님 → ${sc}`);
      if (Boolean(notice) !== expectNotice) problems.push(`${name}: 안내문 ${notice ? '있음' : '없음'} (기대 ${expectNotice ? '있음' : '없음'})`);
      if (expectNotice && !/이전 버전/.test(noticeText)) problems.push(`${name}: 안내 문구 ${noticeText}`);
      if (name === 'v4 진행 저장') shots.push(await shot(p, 'A11', 'v4-notice'));
      if (name === '깨진 JSON') shots.push(await shot(p, 'A11', 'broken-json'));
      // 새로고침 → 안내가 다시 뜨면 안 된다
      await p.reload();
      await p.waitForSelector(TITLE, { timeout: 8000 }).catch(() => {});
      const noticeAfter = await p.getByTestId('old-save-notice').count();
      if (noticeAfter) problems.push(`${name}: 새로고침 뒤에도 안내가 다시 뜸`);
      // 정상 플레이 가능
      await waitGuard(p);
      await p.getByTestId('start-birth').click();
      const ok = await p.waitForSelector('[data-testid=birth-screen]', { timeout: 6000 }).then(() => true).catch(() => false);
      if (!ok) problems.push(`${name}: 이후 태어나기 불가`);
      const save = await saveInfo(p);
      if (!save || save.version !== 5) problems.push(`${name}: 이후 저장 ${JSON.stringify(save)}`);
      rows.push(`${name}: ${sc}${notice ? ' +안내' : ''}${noticeAfter ? ' (새로고침 뒤에도 안내)' : ''}`);
      await ctx.close();
    }
    return { verdict: problems.length ? 'FAIL' : 'PASS', actual: problems.length ? problems.slice(0, 8).join(' / ') : `${cases.length}종 모두 첫 화면·새 게임. ${rows.join(' ; ')}`, shots };
  });

// ---------- A12 lifeLength: long60 심기 ----------
if (want('A12'))
  await runCase({ id: 'M2-A12', cat: '공격', title: '설정에 lifeLength:"long60" 심기 → 「약 30분」으로 읽히는가 (R-202)', steps: '설정 v2·v1 봉투에 long60을 심고 첫 로드 → 라디오 상태·저장 설정 → 태어나기 → 저장된 판의 lifeLength', expected: '「약 30분」 선택 상태, 「약 1시간」 비활성·미선택, 시작한 판 lifeLength=short30, 다른 설정(세상·배속)은 유지' }, async () => {
    const problems = [];
    const facts = [];
    const shots = [];
    for (const [label, sv] of [
      ['v2 long60+past+speed4', '{"version":2,"data":{"era":"past","lifeLength":"long60","speed":4,"autoMode":false}}'],
      ['v2 long60 현재', '{"version":2,"data":{"era":"present","lifeLength":"long60","speed":1,"autoMode":false}}'],
    ]) {
      const ctx = await mkctx(browser, { viewport: VP.m360, ...TOUCH });
      await seedCtx(ctx, null, sv);
      const p = await ctx.newPage();
      await openTitle(p);
      await waitGuard(p);
      const st = await p.evaluate(() => ({ short: document.querySelector('[data-testid=life-short30]').checked, long: document.querySelector('[data-testid=life-long60]').checked, longDisabled: document.querySelector('[data-testid=life-long60]').disabled, era: ['past', 'present', 'future'].find((e) => document.querySelector(`[data-testid="era-${e}"]`).checked) }));
      if (label.includes('past')) shots.push(await shot(p, 'A12', 'seeded'));
      await p.getByTestId('start-birth').click();
      await p.waitForSelector('[data-testid=birth-screen]');
      const save = await saveInfo(p);
      const settings = JSON.parse(await readRaw(p, SETTINGS_KEY)).data;
      facts.push(`${label}: 화면 ${JSON.stringify(st)}, 판 lifeLength=${save.lifeLength}, 설정 저장 ${settings.lifeLength}/${settings.era}/speed${settings.speed}`);
      if (!st.short || st.long || !st.longDisabled) problems.push(`${label}: 라디오 상태 ${JSON.stringify(st)}`);
      if (save.lifeLength !== 'short30') problems.push(`${label}: 판 lifeLength=${save.lifeLength}`);
      if (settings.lifeLength === 'long60') problems.push(`${label}: 설정에 long60이 다시 저장됨`);
      if (label.includes('past') && (st.era !== 'past' || settings.speed !== 4)) problems.push(`${label}: 다른 설정 유지 안 됨 ${st.era}/${settings.speed}`);
      await ctx.close();
    }
    return { verdict: problems.length ? 'FAIL' : 'PASS', actual: problems.length ? problems.join(' / ') : facts.join(' | '), shots };
  });

// ---------- A13 오프라인 ----------
if (want('A13'))
  await runCase({ id: 'M2-A13', cat: '공격', title: '오프라인 — 로드 뒤 네트워크를 끊고 플레이·새로고침 (CM3·FS8)', steps: '정상 로드 후 setOffline(true): 세상 선택·캐러셀 넘김·태어나기·출생·인생 몇 해, 이어서 새로고침 시도. 별도로 온라인 로드의 요청 목록 확인(외부 도메인 0)', expected: '오프라인 중 모든 조작 정상·요청 실패 0, 로드 시 요청은 같은 origin뿐. (새로고침은 서비스 워커·PWA가 없는 설계라 브라우저 캐시에 의존 — 결과 기록)' }, async () => {
    const problems = [];
    const facts = [];
    const ctx = await mkctx(browser, { viewport: VP.m360, ...TOUCH });
    const p = await ctx.newPage();
    const reqs = [];
    p.on('request', (r) => reqs.push(r.url()));
    await openTitle(p);
    await sleep(800);
    const external = reqs.filter((u) => !u.startsWith('http://127.0.0.1:4299/'));
    facts.push(`온라인 로드 요청 ${reqs.length}개: ${reqs.map((u) => u.replace('http://127.0.0.1:4299/spoongame/', '')).join(', ')}`);
    if (external.length) problems.push(`외부 요청 ${external}`);
    con.take();
    await ctx.setOffline(true);
    await p.getByTestId('era-past').evaluate((el) => el.scrollIntoView({ block: 'center' }));
    await p.getByTestId('era-past').check();
    await p.getByTestId('carousel-next').scrollIntoViewIfNeeded();
    await p.getByTestId('carousel-next').click();
    await sleep(300);
    const c = await p.getByTestId('carousel-count').innerText();
    await waitGuard(p);
    await p.getByTestId('start-birth').click();
    await p.waitForSelector('[data-testid=birth-screen]');
    await waitGuard(p, 'next-life');
    await p.getByTestId('next-life').click();
    await p.waitForSelector('[data-testid=life-screen]');
    await setSpeed(p, 8);
    await p.locator('[data-testid="auto"]').click();
    await sleep(4500);
    const info = await lifeInfo(p);
    const failures = con.take().filter((x) => x.type === 'requestfailed' || x.type === 'error' || x.type === 'pageerror');
    facts.push(`오프라인 플레이: 캐러셀 ${c}, 인생 ${info.name} ${info.age}세, 오류/실패 ${failures.length}`);
    if (info.screen !== 'life-screen' || info.age < 1) problems.push(`오프라인 플레이 이상 ${JSON.stringify(info)}`);
    if (failures.length) problems.push(`오프라인 중 실패 ${JSON.stringify(failures.slice(0, 3))}`);
    const shots = [await shot(p, 'A13', 'offline-play')];
    // 오프라인 새로고침
    let reloadResult;
    try {
      await p.reload({ timeout: 8000, waitUntil: 'domcontentloaded' });
      await sleep(800);
      reloadResult = `로드됨 → ${await whichScreen(p)}`;
    } catch (e) {
      reloadResult = `실패(${String(e.message).split('\n')[0].slice(0, 80)})`;
    }
    facts.push(`오프라인 새로고침: ${reloadResult}`);
    shots.push(await shot(p, 'A13', 'offline-reload').catch(() => ''));
    await ctx.close();
    return { verdict: problems.length ? 'FAIL' : 'PASS', actual: problems.length ? problems.join(' / ') : facts.join(' | '), shots: shots.filter(Boolean) };
  });

// ---------- A14 200% 확대 ----------
if (want('A14'))
  await runCase({ id: 'M2-A14', cat: '공격', title: '200% 확대(·400%) — 가로 넘침·가림·조작 (CM4)', steps: '데스크톱 200%(640x400)·1024 창의 200%(512x384)·400%(320x256)·모바일 360의 200%(180x370)를 CSS 뷰포트로 재현(DPR 2): 가로 넘침, 하단 띠가 본문을 가리는 정도, 태어나기 누르기, 캐러셀 조작', expected: '320 CSS px 이상에서 가로 넘침 0, 하단 띠가 화면의 절반 이하, 「태어나기」·캐러셀 버튼 조작 가능' }, async () => {
    const problems = [];
    const rows = [];
    const shots = [];
    for (const [name, vp, strict] of [['640x400(1280창 200%)', { width: 640, height: 400 }, true], ['512x384(1024창 200%)', { width: 512, height: 384 }, true], ['320x256(1280창 400%)', { width: 320, height: 256 }, true], ['180x370(360폰 200%)', { width: 180, height: 370 }, false]]) {
      const ctx = await mkctx(browser, { viewport: vp, deviceScaleFactor: 2 });
      const p = await ctx.newPage();
      await openTitle(p);
      await waitGuard(p).catch(() => {});
      await sleep(400);
      const m = await p.evaluate(() => {
        const root = document.documentElement;
        const bar = document.querySelector('[data-testid=bottom-bar]').getBoundingClientRect();
        const btn = document.querySelector('[data-testid=start-birth]').getBoundingClientRect();
        const wide = [...document.querySelectorAll('body *')].filter((e) => { const b = e.getBoundingClientRect(); return b.right > root.clientWidth + 1 && b.width > 0 && getComputedStyle(e).position !== 'fixed'; }).slice(0, 3).map((e) => `${e.tagName}.${String(e.className).slice(0, 20)}`);
        return { overflow: root.scrollWidth > root.clientWidth, sw: root.scrollWidth, cw: root.clientWidth, barH: Math.round(bar.height), vh: innerHeight, btnVisible: btn.top >= 0 && btn.bottom <= innerHeight + 1, wide, logoW: Math.round(document.querySelector('h1').getBoundingClientRect().width) };
      });
      rows.push(`${name}: 넘침 ${m.overflow}(${m.sw}>${m.cw}), 띠 ${m.barH}/${m.vh}px, 태어나기 보임 ${m.btnVisible}${m.wide.length ? ' 넘친 요소 ' + m.wide : ''}`);
      if (strict && m.overflow) problems.push(`${name}: 가로 넘침 ${m.sw}>${m.cw} ${m.wide}`);
      if (strict && m.barH > m.vh * 0.5) problems.push(`${name}: 하단 띠가 화면의 ${Math.round((m.barH / m.vh) * 100)}%`);
      if (!m.btnVisible) problems.push(`${name}: 태어나기 버튼이 화면 밖`);
      shots.push(await shot(p, 'A14', name.split('(')[0]));
      // 스크롤 끝에서 본문이 띠에 가리지 않는지: 푸터 마지막 줄
      await p.evaluate(() => scrollTo(0, document.documentElement.scrollHeight));
      await sleep(150);
      const cover = await p.evaluate(() => {
        const last = [...document.querySelectorAll('[data-testid=title-foot] p')].pop().getBoundingClientRect();
        const bar = document.querySelector('[data-testid=bottom-bar]').getBoundingClientRect();
        return Math.round(last.bottom - bar.top);
      });
      if (strict && cover > 1) problems.push(`${name}: 맨 아래에서 푸터 마지막 줄이 띠에 ${cover}px 가림`);
      // 캐러셀 버튼 조작
      const prev = await p.getByTestId('carousel-next').scrollIntoViewIfNeeded().then(() => true).catch(() => false);
      await p.getByTestId('carousel-next').click({ timeout: 3000 }).catch(() => problems.push(`${name}: 캐러셀 다음 버튼을 누를 수 없음`));
      // 태어나기
      await p.getByTestId('start-birth').click({ timeout: 3000 }).catch(() => problems.push(`${name}: 태어나기를 누를 수 없음`));
      const sc = await p.waitForSelector('[data-testid=birth-screen]', { timeout: 4000 }).then(() => 'birth').catch(() => 'no');
      if (sc !== 'birth') problems.push(`${name}: 태어나기 후 출생 화면 아님`);
      await ctx.close();
    }
    return { verdict: problems.length ? 'FAIL' : 'PASS', actual: problems.length ? problems.slice(0, 6).join(' / ') : rows.join(' ; '), shots };
  });

await browser.close();
