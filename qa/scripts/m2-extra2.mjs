// QA-003 M2 추가 공격 2: 일시정지 연타(A16)·개발 탐침이 prod에서 꺼져 있는가(A17)·태어나기 직후 새로고침(A18)·좁은 폭·큰 글자(V04)
import { launch, mkctx, runCase, shot, openTitle, waitGuard, whichScreen, overflowX, saveInfo, readRaw, lifeInfo, VP, TOUCH, PROD, GAME_KEY, SETTINGS_KEY, sleep } from './m2-lib.mjs';

const browser = await launch();
const only = process.argv[2];
const want = (id) => !only || only.split(',').includes(id);
const TITLE = '[data-testid=title-screen]';

const LIFE_V5 = JSON.stringify({ version: 5, data: { phase: 'life', era: 'present', lifeLength: 'short30', character: { name: '김민준', gender: 'male', birthYear: 2012, parentWealth: 3, parenting: 'free', looks: 50 }, stats: { wealth: 45, education: 6, health: 70, happiness: 52, relationships: 54 }, birthStats: { wealth: 45, education: 6, health: 70, happiness: 52, relationships: 54 }, age: 3, history: [{ age: 0, kind: 'stage', text: '2012년, 남자아이로 태어났다.' }], flags: [], seen: {}, pending: null, lastChoiceAge: null, death: null, seed: 1234, rngState: 1235 } });

if (want('A16'))
  await runCase({ id: 'M2-A16', cat: '공격', title: '일시정지 버튼 연타 — 표시와 실제 동작이 일치하는가 (SC5)', steps: '1280x800: 일시정지 버튼을 15ms 간격으로 31회(홀수)·30회(짝수) 연타 → 버튼 이름·안내 문구·data-autoplay 대조 → 그 뒤 마우스를 카드 밖으로 옮기고 9초 관찰', expected: '홀수 → 「다시 시작」 이름·멈춤, 짝수 → 「일시정지」 이름·자동 전환 재개(이름과 실제가 항상 일치)' }, async () => {
    const problems = [];
    const facts = [];
    const shots16 = [];
    for (const n of [31, 30]) {
      const ctx = await mkctx(browser, { viewport: VP.d1280 });
      const p = await ctx.newPage();
      await openTitle(p);
      await waitGuard(p);
      await sleep(300);
      const box = await p.getByTestId('carousel-pause').boundingBox();
      const x = box.x + box.width / 2, y = box.y + box.height / 2;
      for (let i = 0; i < n; i++) {
        await p.mouse.click(x, y);
        await sleep(15);
      }
      await p.mouse.move(2, 2, { steps: 12 });
      await sleep(300);
      const st = await p.evaluate(() => ({ label: document.querySelector('[data-testid=carousel-pause]').getAttribute('aria-label'), note: document.querySelector('[data-testid=carousel-auto-note]').innerText, auto: document.querySelector('[data-testid=carousel]').dataset.autoplay, count: document.querySelector('[data-testid=carousel-count]').innerText.trim() }));
      await sleep(9000);
      const c2 = await p.getByTestId('carousel-count').innerText();
      const moved = c2 !== st.count;
      facts.push(`${n}회: ${JSON.stringify(st)} → 9초 뒤 ${c2} (${moved ? '움직임' : '멈춤'})`);
      shots16.push(await shot(p, 'A16', `${n}clicks`));
      const shouldPause = n % 2 === 1;
      if (shouldPause && (!/다시 시작/.test(st.label) || moved)) problems.push(`${n}회 뒤 멈춰야 하는데 ${JSON.stringify(st)} 이동 ${moved}`);
      if (!shouldPause && (!/일시정지/.test(st.label) || !moved)) problems.push(`${n}회 뒤 돌아야 하는데 ${JSON.stringify(st)} 이동 ${moved}`);
      if (shouldPause !== /다시 시작/.test(st.label)) problems.push(`${n}회: 버튼 이름과 실제 상태 불일치`);
      await ctx.close();
    }
    return { verdict: problems.length ? 'FAIL' : 'PASS', actual: problems.length ? problems.join(' / ') : facts.join(' | '), shots: shots16 };
  });

if (want('A17'))
  await runCase({ id: 'M2-A17', cat: '공격', title: '개발 전용 탐침(?__exit·?__crash·?__quota·?__timescale·?__guard)이 prod에서는 먹지 않는가', steps: '진행 중인 저장을 심고 prod를 ?__exit&__crash&__quota&__timescale=1000&__guard=0 로 열기, 저장 없는 상태에서도 열어 진입 가드·시간 배율 확인', expected: '탐침이 모두 무시됨: 저장된 인생 화면 그대로(첫 화면·오류 화면 아님), 시간 가속 없음, 저장 실패 안내 없음, 진입 가드 유지' }, async () => {
    const problems = [];
    const facts = [];
    const ctx = await mkctx(browser, { viewport: VP.m360, ...TOUCH });
    await ctx.addInitScript(([k, v]) => { try { if (!sessionStorage.getItem('__seeded')) { sessionStorage.setItem('__seeded', '1'); localStorage.setItem(k, v); } } catch {} }, [GAME_KEY, LIFE_V5]);
    const p = await ctx.newPage();
    await p.goto(PROD + '?__exit&__crash&__quota&__timescale=1000&__guard=0');
    await p.waitForSelector('[data-testid=life-screen],[data-testid=title-screen],[data-testid=error-screen]', { timeout: 8000 });
    const sc = await whichScreen(p);
    const a0 = (await lifeInfo(p)).age;
    await sleep(5000);
    const a1 = (await lifeInfo(p)).age;
    const notice = await p.getByTestId('save-notice').count();
    facts.push(`저장 있는 상태: ${sc}, 5초 사이 ${a0}→${a1}세, 저장 실패 안내 ${notice}`);
    const shots17 = [await shot(p, 'A17', 'probes-ignored-life')];
    if (sc !== 'life-screen') problems.push(`탐침이 화면에 영향 ${sc}`);
    if (a1 - a0 > 1) problems.push(`시간 가속 의심 ${a0}→${a1}`);
    if (notice) problems.push('?__quota 탐침이 먹힘(저장 실패 안내)');
    await ctx.close();
    const ctx2 = await mkctx(browser, { viewport: VP.m360, ...TOUCH });
    const q = await ctx2.newPage();
    await q.goto(PROD + '?__guard=0&__timescale=1000');
    await q.waitForSelector(TITLE);
    const box = await q.getByTestId('start-birth').boundingBox();
    const guarded = await q.getByTestId('start-birth').getAttribute('aria-disabled');
    await q.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    await sleep(80);
    const sc2 = await whichScreen(q);
    facts.push(`저장 없음: 진입 직후 aria-disabled=${guarded}, 즉시 클릭 뒤 ${sc2}`);
    if (guarded !== 'true' || sc2 !== 'title-screen') problems.push(`?__guard=0이 prod에서 먹힘 (aria-disabled ${guarded}, ${sc2})`);
    shots17.push(await shot(q, 'A17', 'guard-kept-title'));
    await ctx2.close();
    return { verdict: problems.length ? 'FAIL' : 'PASS', actual: problems.length ? problems.join(' / ') : facts.join(' | '), shots: shots17 };
  });

if (want('A18'))
  await runCase({ id: 'M2-A18', cat: '공격', title: '「태어나기」를 누르자마자 새로고침(저장 직전·직후) 8회 (RL5·R-021)', steps: '태어나기 클릭 후 0~120ms 사이 서로 다른 지연으로 곧바로 reload → 결과가 「첫 화면」(저장 전) 또는 「출생 화면」(저장 후) 중 하나이고 이후 새로고침 연타에도 같은 인물', expected: '어느 쪽이든 깨진 상태·밀린 화면·오류 화면 없음, 출생 화면이면 새로고침을 몇 번 해도 같은 인물' }, async () => {
    const problems = [];
    const facts = [];
    const shots18 = [];
    for (const delay of [0, 5, 15, 30, 50, 80, 100, 120]) {
      const ctx = await mkctx(browser, { viewport: VP.m360, ...TOUCH });
      const p = await ctx.newPage();
      await openTitle(p);
      await waitGuard(p);
      await p.getByTestId('start-birth').click({ noWaitAfter: true });
      if (delay) await sleep(delay);
      await p.reload({ waitUntil: 'domcontentloaded' });
      await p.waitForSelector('[data-testid=title-screen],[data-testid=birth-screen],[data-testid=error-screen],[data-testid=superseded-screen]', { timeout: 8000 });
      await sleep(400);
      const sc = await whichScreen(p);
      let who = null;
      if (sc === 'birth-screen') {
        who = (await lifeInfo(p)).name;
        for (let i = 0; i < 3; i++) {
          await p.reload();
          await p.waitForSelector('[data-testid=birth-screen]', { timeout: 5000 }).catch(() => {});
        }
        const again = (await lifeInfo(p)).name;
        if (again !== who) problems.push(`지연 ${delay}ms: 출생 인물이 새로고침으로 바뀜 ${who}→${again}`);
      }
      const save = await saveInfo(p);
      facts.push(`${delay}ms: ${sc}${who ? ' ' + who : ''} 저장 ${save?.phase}`);
      if (delay === 0 || delay === 50) shots18.push(await shot(p, 'A18', `delay${delay}`));
      if (!['title-screen', 'birth-screen'].includes(sc)) problems.push(`지연 ${delay}ms: 화면 ${sc}`);
      if (save && sc === 'birth-screen' && save.phase !== 'birth') problems.push(`지연 ${delay}ms: 화면은 출생인데 저장 ${save.phase}`);
      await ctx.close();
    }
    return { verdict: problems.length ? 'FAIL' : 'PASS', actual: problems.length ? problems.join(' / ') : facts.join(' ; '), shots: shots18 };
  });

if (want('V04'))
  await runCase({ id: 'M2-V04', cat: '환경', title: '아주 좁은 화면(280px 폴더블)·루트 글자 200% 첫 화면 (CM4)', steps: '280x653에서 가로 넘침·버튼, 360x740에서 html 글자 크기를 200%로 키워 넘침·하단 띠 높이·태어나기 조작 확인', expected: '가로 넘침 0, 태어나기를 누를 수 있음, 하단 띠가 화면의 절반을 넘지 않음' }, async () => {
    const problems = [];
    const facts = [];
    const shots = [];
    {
      const ctx = await mkctx(browser, { viewport: { width: 280, height: 653 }, ...TOUCH });
      const p = await ctx.newPage();
      await openTitle(p);
      await waitGuard(p);
      await sleep(300);
      const ov = await overflowX(p);
      facts.push(`280x653: 넘침 ${ov.overflow}(${ov.scrollW}>${ov.clientW})`);
      if (ov.overflow) problems.push(`280px 가로 넘침 ${ov.scrollW}>${ov.clientW}`);
      shots.push(await shot(p, 'V04', '280'));
      await p.getByTestId('carousel-next').scrollIntoViewIfNeeded();
      const ov2 = await overflowX(p);
      if (ov2.overflow) problems.push('280px 캐러셀 구간 가로 넘침');
      await ctx.close();
    }
    {
      const ctx = await mkctx(browser, { viewport: VP.m360, ...TOUCH });
      await ctx.addInitScript(() => { const st = document.createElement('style'); st.textContent = 'html{font-size:200% !important}'; document.addEventListener('DOMContentLoaded', () => document.head.appendChild(st)); });
      const p = await ctx.newPage();
      await openTitle(p);
      await waitGuard(p);
      await sleep(300);
      const m = await p.evaluate(() => ({ rootPx: getComputedStyle(document.documentElement).fontSize, h1: Math.round(document.querySelector('h1').getBoundingClientRect().height), barH: Math.round(document.querySelector('[data-testid=bottom-bar]').getBoundingClientRect().height), vh: innerHeight, bodyFs: getComputedStyle(document.querySelector('.hero__note')).fontSize, ov: document.documentElement.scrollWidth > document.documentElement.clientWidth, sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, over: [...document.querySelectorAll('body *')].filter((e) => { if (e.closest('.sr-only')) return false; const r = e.getBoundingClientRect(); return r.width > 0 && r.right > document.documentElement.clientWidth + 0.5 && getComputedStyle(e).position !== 'fixed'; }).slice(0, 4).map((e) => `${e.tagName}.${String(e.className).slice(0, 22)}`) }));
      facts.push(`루트 ${m.rootPx} → 보조 문구 ${m.bodyFs}, 띠 ${m.barH}/${m.vh}px, 넘침 ${m.ov}`);
      if (m.ov) problems.push(`루트 글자 200%(360px)에서 가로 넘침 ${m.sw}>${m.cw}px: ${m.over} (125·150·175%는 넘침 0)`);
      shots.push(await shot(p, 'V04', 'bigtext'));
      await p.getByTestId('start-birth').click({ timeout: 3000 }).catch(() => problems.push('글자 200%에서 태어나기를 누를 수 없음'));
      await p.waitForSelector('[data-testid=birth-screen]', { timeout: 4000 }).catch(() => problems.push('글자 200%에서 출생 화면 아님'));
      await ctx.close();
    }
    return { verdict: problems.length ? 'FAIL' : 'PASS', severity: problems.length ? '낮음' : undefined, actual: (problems.length ? problems.join(' / ') + ' || ' : '') + facts.join(' | '), shots };
  });

await browser.close();
