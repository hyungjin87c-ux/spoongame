// QA-003 M3 공격 테스트(A01~). 사용: node qa/scripts/m3-attack.mjs [케이스ID,...]
import { launch, mkctx, fixSeed, installRouletteProbe, getProbe, runCase, shot, openTitle, waitGuard, pickEra, toRoulette, readRoulette, readBirth, skipToBirth, birthToLife, saveJson, readRaw, overflowX, lifeInfo, whichScreen, bodyText, VP, TOUCH, PROD, DEV, sleep, GAME_KEY, SETTINGS_KEY } from './m3-lib.mjs';

const browser = await launch();
const only = process.argv[2];
const want = (id) => !only || only.split(',').includes(id);
const push = (c, msg, arr) => (c ? null : arr.push(msg));

/** 저장에서 출생 결과 지문(같은 결과인지 비교) */
const fp = (sv) => (sv?.data ? JSON.stringify({ c: sv.data.character, r: sv.data.birthReport, ps: sv.data.peerSeed, seed: sv.data.seed, era: sv.data.era, ll: sv.data.lifeLength }) : null);
const center = async (p, testid) => {
  const b = await p.getByTestId(testid).boundingBox();
  return b ? { x: b.x + b.width / 2, y: b.y + b.height / 2 } : null;
};

// ---------- A01: 「태어나기」 연타 ----------
if (want('A01')) {
  await runCase(
    { id: 'M3-A01', cat: '공격', title: '「태어나기」 연타·더블탭·키 연타 → 룰렛은 한 번만, 회전이 건너뛰어지지 않음', steps: '(가) 마우스 40번 연타(지연 0) (나) 더블클릭 (다) 터치 탭 20번 (라) 포커스된 버튼에 Enter·Space 연타 25번. 각각 360x740·1280x800. 직후 1초 뒤 룰렛이 회전 중인지, 회전 시작 이벤트 수, 저장 지문이 첫 저장과 같은지', expected: '룰렛 한 번, 회전 중(건너뛰기 안 됨), 저장 지문 불변, 출생신고로 넘어가지 않음' },
    async () => {
      const bad = [];
      const shots = [];
      const notes = [];
      const variants = [
        ['mouse40-m360', VP.m360, TOUCH, 'mouse'],
        ['dblclick-d1280', VP.d1280, {}, 'dbl'],
        ['tap20-m360', VP.m360, TOUCH, 'tap'],
        ['keys25-d1280', VP.d1280, {}, 'keys'],
        ['mouse40-d1280', VP.d1280, {}, 'mouse'],
      ];
      for (const [name, vp, t, mode] of variants) {
        const ctx = await mkctx(browser, { viewport: vp, ...t });
        await fixSeed(ctx, 909);
        await installRouletteProbe(ctx);
        const p = await ctx.newPage();
        await openTitle(p);
        await waitGuard(p, 'start-birth');
        const c = await center(p, 'start-birth');
        if (mode === 'mouse') for (let i = 0; i < 40; i++) await p.mouse.click(c.x, c.y);
        else if (mode === 'dbl') await p.mouse.dblclick(c.x, c.y);
        else if (mode === 'tap') for (let i = 0; i < 20; i++) await p.touchscreen.tap(c.x, c.y);
        else {
          await p.getByTestId('start-birth').focus();
          for (let i = 0; i < 25; i++) await p.keyboard.press(i % 2 ? 'Enter' : 'Space');
        }
        await sleep(1000);
        const r = await readRoulette(p).catch(() => null);
        const scr = await whichScreen(p);
        const pr = await getProbe(p);
        const spinStarts = pr.events.filter((e) => e.id === 'roulette-screen' && e.state === 'spinning').length;
        const sv = await saveJson(p);
        notes.push(`${name}: 화면 ${scr} 상태 ${r?.state} 저장 ${sv?.data?.phase}`);
        push(scr === 'roulette-screen', `${name}: 화면 ${scr}`, bad);
        push(r?.state === 'spinning', `${name}: 1초 뒤 회전 중이 아님(${r?.state}) — 연타가 건너뛰기까지 눌렀나`, bad);
        push(sv?.data?.phase === 'roulette', `${name}: 저장 phase ${sv?.data?.phase}`, bad);
        // 끝까지 기다려 결과 불변
        await p.waitForSelector('[data-testid="roulette-screen"][data-state="result"]', { timeout: 9000 });
        const sv2 = await saveJson(p);
        push(fp(sv) === fp(sv2), `${name}: 회전 중·후 저장 지문 불변이 아님`, bad);
        const pr2 = await getProbe(p);
        const stops = pr2.events.filter((e) => e.state === 'stopped').length;
        push(stops === 2, `${name}: 릴 정지 이벤트 ${stops}회(2 기대 — 룰렛이 두 번 돌았나)`, bad);
        if (name === 'mouse40-m360' || name === 'keys25-d1280') shots.push(await shot(p, 'A01', name));
        await ctx.close();
      }
      return { verdict: bad.length ? 'FAIL' : 'PASS', severity: '높음', actual: bad.length ? bad.join(' / ') : notes.join(' | '), shots };
    },
  );
}

// ---------- A02: 룰렛 회전 중 새로고침 연타 ----------
if (want('A02')) {
  await runCase(
    { id: 'M3-A02', cat: '공격', title: '룰렛 회전 중 새로고침 연타(12회+) → 다시 돌지 않고 결과 상태, 결과 불변', steps: '태어나기 직후 0·30·100·250·700ms 간격으로 새로고침을 12회 연속(간격은 회전 중 안에서), 마지막 로드 뒤 상태를 본다. 저장 지문은 첫 저장과 비교. 360x740 터치·1280x800 × 시드 3개', expected: '새로고침한 모든 로드에서 룰렛 화면이 처음부터 결과 상태(회전 이벤트 0), 저장 지문(이름·수저·지역·부모 등) 불변, 결과 문구 동일' },
    async () => {
      const bad = [];
      const notes = [];
      const shots = [];
      for (const [vname, vp, t] of [['m360', VP.m360, TOUCH], ['d1280', VP.d1280, {}]])
        for (const seed of [7, 4242, 91919]) {
          for (const gap of [0, 30, 100, 250, 700]) {
            const ctx = await mkctx(browser, { viewport: vp, ...t });
            await fixSeed(ctx, seed);
            const p = await ctx.newPage();
            await openTitle(p);
            await toRoulette(p, 'present');
            const sv0 = await saveJson(p);
            const fp0 = fp(sv0);
            // 첫 로드 기록: 새로고침 후에는 신선한 탐침이 필요 → 각 로드마다 init 스크립트로 기록
            let bad1 = null;
            for (let i = 0; i < 12; i++) {
              if (gap) await sleep(gap);
              await p.reload({ waitUntil: 'domcontentloaded' });
              await p.waitForSelector('[data-testid="roulette-screen"], [data-testid="title-screen"]', { timeout: 8000 });
              const scr = await whichScreen(p);
              if (scr !== 'roulette-screen') {
                bad1 = `${i + 1}번째 로드에서 ${scr}`;
                break;
              }
            }
            const r = await readRoulette(p);
            const sv1 = await saveJson(p);
            if (bad1) bad.push(`${vname}/seed${seed}/gap${gap}: ${bad1}`);
            else {
              push(r.state === 'result', `${vname}/seed${seed}/gap${gap}: 상태 ${r.state} (다시 돈다)`, bad);
              push(fp(sv1) === fp0, `${vname}/seed${seed}/gap${gap}: 저장 지문이 바뀜`, bad);
              push(sv1?.data?.phase === 'roulette', `${vname}/seed${seed}/gap${gap}: phase ${sv1?.data?.phase}`, bad);
            }
            if (vname === 'm360' && seed === 4242 && gap === 30) shots.push(await shot(p, 'A02', 'after-12-reloads'));
            notes.push(`${vname}/${seed}/${gap}ms: ${r.status}`);
            await ctx.close();
          }
        }
      return { verdict: bad.length ? 'FAIL' : 'PASS', severity: '높음', actual: bad.length ? bad.slice(0, 6).join(' / ') : `30개 조합 × 12회 = 360번 새로고침: 모두 결과 상태·저장 불변 (예: ${notes[0]})`, shots };
    },
  );
  // 새로고침 직후에도 회전이 없는지 탐침으로 한 번 더(회전 이벤트 0)
  await runCase(
    { id: 'M3-A02b', cat: '공격', title: '새로고침한 룰렛 화면에서 회전 애니메이션 이벤트가 한 번도 없다(탐침)', steps: '회전 도중(1.5초) 새로고침 → 탐침(rAF·릴 data-state) 기록', expected: '새로 열린 문서에서 릴 data-state는 처음부터 stopped, spinning 기록 0' },
    async () => {
      const bad = [];
      const ctx = await mkctx(browser, { viewport: VP.m360, ...TOUCH });
      await fixSeed(ctx, 4242);
      const p = await ctx.newPage();
      await openTitle(p);
      await toRoulette(p, 'present');
      await sleep(1500);
      // 새로 열리는 문서부터 기록
      await ctx.addInitScript(() => {
        window.__qa2 = { ev: [] };
        const mo = new MutationObserver((ms) => ms.forEach((m) => m.attributeName === 'data-state' && window.__qa2.ev.push([m.target.getAttribute('data-testid'), m.target.getAttribute('data-state')])));
        const go = () => mo.observe(document.documentElement, { subtree: true, attributes: true, attributeFilter: ['data-state'] });
        document.documentElement ? go() : document.addEventListener('DOMContentLoaded', go);
      });
      await p.reload({ waitUntil: 'domcontentloaded' });
      await p.waitForSelector('[data-testid="roulette-screen"]');
      await sleep(900);
      const ev = await p.evaluate(() => window.__qa2.ev);
      const reels = await p.evaluate(() => [...document.querySelectorAll('.reel')].map((r) => r.getAttribute('data-state')));
      push(reels.join() === 'stopped,stopped', `릴 상태 ${reels}`, bad);
      push(!ev.some((e) => e[1] === 'spinning'), `spinning 기록 ${JSON.stringify(ev)}`, bad);
      const shotp = await shot(p, 'A02b', 'reloaded-result');
      await ctx.close();
      return { verdict: bad.length ? 'FAIL' : 'PASS', severity: '높음', actual: bad.length ? bad.join(' / ') : `릴 ${reels}, 회전 기록 ${JSON.stringify(ev)}`, shots: [shotp] };
    },
  );
}

// ---------- A03: 회전 중 「출생신고 보기」·「건너뛰기」 연타 ----------
if (want('A03')) {
  await runCase(
    { id: 'M3-A03', cat: '공격', title: '건너뛰기·출생신고 보기 더블탭/연타: 한 번의 더블탭은 한 단계만 넘긴다', steps: '(가) 회전 중 건너뛰기를 더블클릭(지연 0) → 결과 상태에 머무는지 (나) 결과에서 「출생신고 보기」 더블클릭 → 출생신고에 머무는지 (다) 출생신고에서 「살아가기」 더블클릭 → 인생 화면에서 속도·자동 상태가 그대로인지. 360x740 터치(탭)·1280x800(클릭)', expected: '더블탭 한 번에 한 화면만 넘어가고 다음 화면의 같은 자리 버튼이 눌리지 않는다. 인생 화면 컨트롤이 의도치 않게 바뀌지 않음' },
    async () => {
      const bad = [];
      const notes = [];
      const shots = [];
      for (const [vname, vp, t, mode] of [['m360-tap', VP.m360, TOUCH, 'tap'], ['d1280-click', VP.d1280, {}, 'click']]) {
        for (const gapMs of [0, 60, 150]) {
          const ctx = await mkctx(browser, { viewport: vp, ...t });
          await fixSeed(ctx, 1234);
          const p = await ctx.newPage();
          await openTitle(p);
          await toRoulette(p, 'present');
          await sleep(1100);
          await waitGuard(p, 'skip-roulette');
          const dbl = async (tid) => {
            const c = await center(p, tid);
            if (mode === 'tap') {
              await p.touchscreen.tap(c.x, c.y);
              if (gapMs) await sleep(gapMs);
              await p.touchscreen.tap(c.x, c.y);
            } else {
              await p.mouse.click(c.x, c.y);
              if (gapMs) await sleep(gapMs);
              await p.mouse.click(c.x, c.y);
            }
          };
          await dbl('skip-roulette');
          await sleep(180);
          let scr = await whichScreen(p);
          const r = await readRoulette(p).catch(() => null);
          push(scr === 'roulette-screen' && r?.state === 'result', `${vname}/${gapMs}: 건너뛰기 더블탭 후 ${scr}/${r?.state}`, bad);
          if (scr === 'roulette-screen') {
            await waitGuard(p, 'to-birth');
            await dbl('to-birth');
            await sleep(180);
            scr = await whichScreen(p);
            push(scr === 'birth-screen', `${vname}/${gapMs}: 출생신고 보기 더블탭 후 ${scr}(birth 기대)`, bad);
            if (scr === 'birth-screen') {
              await waitGuard(p, 'next-life');
              if (gapMs === 60 && vname === 'm360-tap') shots.push(await shot(p, 'A03', 'birth-after-doubletap'));
              await dbl('next-life');
              await sleep(500);
              scr = await whichScreen(p);
              push(scr === 'life-screen', `${vname}/${gapMs}: 살아가기 더블탭 후 ${scr}`, bad);
              if (scr === 'life-screen') {
                const li = await p.evaluate(() => ({ speed: document.querySelector('[data-speed][aria-pressed="true"]')?.getAttribute('data-speed'), auto: document.querySelector('[data-testid="auto"]')?.getAttribute('aria-pressed'), paused: document.querySelector('[data-testid="pause"]')?.getAttribute('aria-pressed') ?? null, controls: [...document.querySelectorAll('[data-testid="controls"] button')].map((b) => `${b.textContent.trim()}:${b.getAttribute('aria-pressed')}`) }));
                push(li.speed === '1' && li.auto !== 'true', `${vname}/${gapMs}: 인생 컨트롤이 바뀜 ${JSON.stringify(li)}`, bad);
                notes.push(`${vname}/${gapMs}ms: 인생 컨트롤 ${li.controls.join(',')}`);
                if (gapMs === 60 && vname === 'm360-tap') shots.push(await shot(p, 'A03', 'life-after-doubletap'));
              }
            }
          }
          await ctx.close();
        }
      }
      return { verdict: bad.length ? 'FAIL' : 'PASS', severity: '높음', actual: bad.length ? bad.join(' / ') : '6조합(터치·마우스 × 간격 0/60/150ms) 모두 더블탭이 한 화면씩만 넘김, 인생 컨트롤 불변', shots };
    },
  );
  await runCase(
    { id: 'M3-A03b', cat: '공격', title: '하단 버튼 위치에 연타를 계속 퍼붓기(3초, 50ms 간격)', steps: '태어나기 후 룰렛 시작 1초 뒤부터 같은 좌표를 3초 동안 50ms 간격으로 클릭. 각 화면 0.4초 입력 가드가 지켜져 화면이 건너뛰어지지 않는지 기록(각 화면 체류 시간)', expected: '건너뛰기→출생신고 보기→살아가기 각 단계가 최소 0.35초는 보이고(가드 약 0.4초), 단계가 빠져 있지 않다' },
    async () => {
      const bad = [];
      const ctx = await mkctx(browser, { viewport: VP.m360, ...TOUCH });
      await fixSeed(ctx, 42);
      const p = await ctx.newPage();
      await openTitle(p);
      await toRoulette(p, 'present');
      await sleep(1000);
      await waitGuard(p, 'skip-roulette');
      const c = await center(p, 'skip-roulette');
      // 화면 전환 시각 기록
      await p.evaluate(() => {
        window.__log = [];
        const t0 = performance.now();
        const seen = new Set();
        const mo = new MutationObserver(() => {
          for (const id of ['roulette-screen', 'birth-screen', 'life-screen']) {
            const el = document.querySelector(`[data-testid="${id}"]`);
            const st = el ? id + ':' + (el.getAttribute('data-state') || '') : null;
            if (st && !seen.has(st)) {
              seen.add(st);
              window.__log.push([Math.round(performance.now() - t0), st]);
            }
          }
        });
        mo.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['data-state'] });
      });
      const t0 = Date.now();
      while (Date.now() - t0 < 3000) {
        await p.mouse.click(c.x, c.y);
        await sleep(50);
      }
      const log = await p.evaluate(() => window.__log);
      const order = log.map((l) => l[1]);
      const want2 = ['roulette-screen:result', 'birth-screen:', 'life-screen:'];
      const idx = want2.map((w) => order.indexOf(w));
      push(idx.every((i) => i >= 0), `단계 누락: ${JSON.stringify(log)}`, bad);
      if (idx.every((i) => i >= 0)) {
        const gap1 = log[idx[1]][0] - log[idx[0]][0];
        const gap2 = log[idx[2]][0] - log[idx[1]][0];
        push(gap1 >= 350, `룰렛 결과 → 출생신고까지 ${gap1}ms (<350)`, bad);
        push(gap2 >= 350, `출생신고 → 인생까지 ${gap2}ms (<350)`, bad);
      }
      const shotp = await shot(p, 'A03b', 'after-3s-storm');
      await ctx.close();
      return { verdict: bad.length ? 'FAIL' : 'PASS', severity: '높음', actual: bad.length ? bad.join(' / ') : `전환 기록 ${JSON.stringify(log)}`, shots: [shotp] };
    },
  );
}

// ---------- A04: 출생신고 「살아가기」 연타 ----------
if (want('A04')) {
  await runCase(
    { id: 'M3-A04', cat: '공격', title: '출생신고 「살아가기」 30번 연타 → 인생은 한 번만 시작, 연표 첫 줄 중복·선택 오입력 없음', steps: '출생신고에서 가드 해제 직후 마우스/터치로 30번 연타(지연 0). 1.5초 뒤 인생 화면·연표·저장 점검', expected: '인생 화면 한 번, 연표 0세 첫 줄 1개, 저장 phase life, 나이 0~1세' },
    async () => {
      const bad = [];
      const shots = [];
      for (const [vname, vp, t, mode] of [['m360-tap', VP.m360, TOUCH, 'tap'], ['d1280-click', VP.d1280, {}, 'click']]) {
        const ctx = await mkctx(browser, { viewport: vp, ...t });
        await fixSeed(ctx, 808);
        const p = await ctx.newPage();
        await openTitle(p);
        await toRoulette(p, 'present');
        await skipToBirth(p);
        const b = await readBirth(p);
        await waitGuard(p, 'next-life');
        const c = await center(p, 'next-life');
        for (let i = 0; i < 30; i++) {
          if (mode === 'tap') await p.touchscreen.tap(c.x, c.y);
          else await p.mouse.click(c.x, c.y);
        }
        await sleep(1500);
        const scr = await whichScreen(p);
        push(scr === 'life-screen', `${vname}: 화면 ${scr}`, bad);
        if (scr === 'life-screen') {
          const li = await lifeInfo(p);
          const entries = await p.evaluate((s) => [...document.querySelectorAll('[data-testid="log"] li')].map((x) => x.textContent.trim()).filter((t) => t.includes('태어났습니다')).length, b.sentence);
          const sv = await saveJson(p);
          push(entries === 1, `${vname}: 출생 줄 ${entries}개`, bad);
          push(li.age <= 2, `${vname}: 나이 ${li.age}`, bad);
          push(sv?.data?.phase === 'life', `${vname}: phase ${sv?.data?.phase}`, bad);
          push(li.name === b.name, `${vname}: 이름 ${li.name} ≠ ${b.name}`, bad);
          shots.push(await shot(p, 'A04', `${vname}-life`));
        }
        await ctx.close();
      }
      return { verdict: bad.length ? 'FAIL' : 'PASS', severity: '높음', actual: bad.length ? bad.join(' / ') : '터치·마우스 30연타 모두 인생 한 번 시작, 출생 줄 1개', shots };
    },
  );
}

// ---------- A05: 뒤로·앞으로가기 ----------
if (want('A05')) {
  await runCase(
    { id: 'M3-A05', cat: '공격', title: '브라우저 뒤로·앞으로가기: 룰렛 도중·결과·출생신고·인생에서', steps: '각 단계에서 goBack → goForward(문서가 바뀐 경우), 앱이 history를 쓰는지 확인. 복원된 화면이 저장 단계와 같고 같은 출생 결과인지', expected: '크래시·빈 화면 없음. 돌아와서는 저장된 단계가 그대로 복원(룰렛 도중이었으면 결과 상태), 결과 불변' },
    async () => {
      const bad = [];
      const notes = [];
      const shots = [];
      for (const stage of ['roulette-spin', 'roulette-result', 'birth', 'life']) {
        const ctx = await mkctx(browser, { viewport: VP.m360, ...TOUCH });
        await fixSeed(ctx, 321);
        const p = await ctx.newPage();
        await p.goto('about:blank');
        await openTitle(p);
        await toRoulette(p, 'present');
        if (stage === 'roulette-spin') await sleep(1500);
        else await p.waitForSelector('[data-testid="roulette-screen"][data-state="result"]', { timeout: 9000 });
        if (stage === 'birth' || stage === 'life') {
          await waitGuard(p, 'to-birth');
          await p.getByTestId('to-birth').click();
          await p.waitForSelector('[data-testid="birth-screen"]');
        }
        if (stage === 'life') await birthToLife(p);
        const before = await saveJson(p);
        const hist = await p.evaluate(() => history.length);
        await p.goBack({ waitUntil: 'domcontentloaded' }).catch(() => {});
        await sleep(300);
        const urlBack = p.url();
        await p.goForward({ waitUntil: 'domcontentloaded' }).catch(() => {});
        await sleep(800);
        const scr = await whichScreen(p);
        const after = await saveJson(p);
        notes.push(`${stage}: history ${hist}, back=${urlBack.slice(0, 22)}, 복귀 화면 ${scr}`);
        const wantScr = stage.startsWith('roulette') ? 'roulette-screen' : stage === 'birth' ? 'birth-screen' : 'life-screen';
        push(scr === wantScr, `${stage}: 복귀 후 화면 ${scr} (기대 ${wantScr})`, bad);
        push(fp(before) === fp(after), `${stage}: 출생 결과 지문이 바뀜`, bad);
        if (stage === 'roulette-spin') {
          const r = await readRoulette(p);
          push(r.state === 'result', `roulette-spin: 복귀 후 상태 ${r.state} (다시 도는지)`, bad);
        }
        if (stage === 'birth') shots.push(await shot(p, 'A05', 'birth-after-back-forward'));
        if (stage === 'roulette-spin') shots.push(await shot(p, 'A05', 'roulette-after-back-forward'));
        await ctx.close();
      }
      // 앱 안에서 뒤로가기만 누르는 경우(같은 문서 history 항목 있음?)
      return { verdict: bad.length ? 'FAIL' : 'PASS', severity: '중간', actual: bad.length ? bad.join(' / ') : notes.join(' | '), shots };
    },
  );
}

// ---------- A06: 탭 숨김(회전 중) ----------
if (want('A06')) {
  await runCase(
    { id: 'M3-A06', cat: '공격', title: '회전 중 탭을 숨겼다 돌아오기 — 룰렛이 멈춘 채 남지 않고, 결과가 바뀌지 않음', steps: '(가) visibilityState=hidden 흉내(visibilitychange)를 회전 1.5초에 걸어 8초 뒤 복귀 (나) 두 번째 탭을 앞으로 가져와 진짜 가림(bringToFront) 후 복귀 (다) CDP 페이지 수명주기 frozen→active. 모두 복귀 뒤 결과 상태까지 2초 안', expected: '복귀 후 룰렛이 정지해 결과 상태가 되고(멈춘 채 남지 않음), 결과는 저장 지문과 같다. 가린 동안 건너뛰기·출생신고로 넘어가지 않음' },
    async () => {
      const bad = [];
      const notes = [];
      const shots = [];
      for (const mode of ['fake-hidden', 'real-bringToFront', 'cdp-frozen']) {
        const ctx = await mkctx(browser, { viewport: VP.m360, ...TOUCH });
        await fixSeed(ctx, 2468);
        await ctx.addInitScript(() => {
          window.__vis = 'visible';
          Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => window.__vis });
        });
        const p = await ctx.newPage();
        await openTitle(p);
        await toRoulette(p, 'present');
        const fp0 = fp(await saveJson(p));
        await sleep(1500);
        if (mode === 'fake-hidden') {
          await p.evaluate(() => {
            window.__vis = 'hidden';
            document.dispatchEvent(new Event('visibilitychange'));
          });
          await sleep(8000);
          const mid = await readRoulette(p);
          notes.push(`fake: 숨김 8초 뒤 ${mid.state}`);
          await p.evaluate(() => {
            window.__vis = 'visible';
            document.dispatchEvent(new Event('visibilitychange'));
          });
        } else if (mode === 'real-bringToFront') {
          const p2 = await ctx.newPage();
          await p2.goto('about:blank');
          await p2.bringToFront();
          await sleep(8000);
          const vs = await p.evaluate(() => [document.hidden, document.visibilityState]);
          const mid = await readRoulette(p);
          notes.push(`real: document.hidden=${vs[0]} 8초 뒤 ${mid.state}`);
          await p.bringToFront();
          await p2.close();
        } else {
          const cdp = await ctx.newCDPSession(p);
          await cdp.send('Page.enable');
          await cdp.send('Page.setWebLifecycleState', { state: 'frozen' });
          await sleep(7000);
          await cdp.send('Page.setWebLifecycleState', { state: 'active' });
        }
        await sleep(2500);
        const r = await readRoulette(p);
        const scr = await whichScreen(p);
        push(scr === 'roulette-screen' && r.state === 'result', `${mode}: 복귀 뒤 ${scr}/${r.state} (멈춘 채 남았나)`, bad);
        push(r.wealthReel === 'stopped' && r.regionReel === 'stopped', `${mode}: 릴 ${r.wealthReel}/${r.regionReel}`, bad);
        push(fp(await saveJson(p)) === fp0, `${mode}: 저장 지문 변함`, bad);
        push(r.status?.includes(r.wealthResult) && r.status?.includes(r.regionResult), `${mode}: 결과 문구 ${r.status} vs 릴 ${r.wealthResult}/${r.regionResult}`, bad);
        shots.push(await shot(p, 'A06', mode));
        notes.push(`${mode}: 최종 ${r.state} ${r.status}`);
        await ctx.close();
      }
      return { verdict: bad.length ? 'FAIL' : 'PASS', severity: '높음', actual: bad.length ? bad.join(' / ') : notes.join(' | '), shots };
    },
  );
}

// ---------- A07: 창 크기·회전 중 ----------
if (want('A07')) {
  await runCase(
    { id: 'M3-A07', cat: '공격', title: '회전 중 창 크기 바꾸기·회전(세로↔가로, 320↔1280)', steps: '회전 중 1초마다 360x740 → 740x360 → 1280x800 → 320x568 → 667x375 → 360x740로 크기를 바꾼다. 결과 상태에서 다시 바꿈', expected: '크래시·가로 넘침 없음, 결과 칸이 가운데·확정 모양, 띠 버튼이 눌림, 결과 불변' },
    async () => {
      const bad = [];
      const shots = [];
      const ctx = await mkctx(browser, { viewport: VP.m360, ...TOUCH });
      await fixSeed(ctx, 13579);
      const p = await ctx.newPage();
      const errs = [];
      p.on('pageerror', (e) => errs.push(String(e)));
      await openTitle(p);
      await toRoulette(p, 'present');
      const fp0 = fp(await saveJson(p));
      const sizes = [[740, 360], [1280, 800], [320, 568], [667, 375], [360, 740]];
      for (const [w, h] of sizes) {
        await p.setViewportSize({ width: w, height: h });
        await sleep(900);
        const ov = await overflowX(p);
        push(!ov.overflow, `회전 중 ${w}x${h} 가로 넘침 ${ov.scrollW}>${ov.clientW}`, bad);
      }
      shots.push(await shot(p, 'A07', 'after-resizes-spinning-or-result'));
      await p.waitForSelector('[data-testid="roulette-screen"][data-state="result"]', { timeout: 6000 });
      const r = await readRoulette(p);
      // 결과 칸이 릴 창 안 가운데에 있는가
      const geo = await p.evaluate(() => {
        const out = {};
        for (const id of ['reel-wealth', 'reel-region']) {
          const reel = document.querySelector(`[data-testid="${id}"]`);
          const win = reel.querySelector('.reel__window').getBoundingClientRect();
          const res = reel.querySelector('[data-result="true"]').getBoundingClientRect();
          out[id] = { dy: Math.abs(win.top + win.height / 2 - (res.top + res.height / 2)), winH: win.height };
        }
        return out;
      });
      for (const [k, v] of Object.entries(geo)) push(v.dy < 3, `${k}: 결과 칸이 창 가운데에서 ${v.dy.toFixed(1)}px 어긋남`, bad);
      for (const [w, h] of [[1280, 800], [320, 568], [740, 360], [360, 740]]) {
        await p.setViewportSize({ width: w, height: h });
        await sleep(500);
        const ov = await overflowX(p);
        const g2 = await p.evaluate(() => {
          const reel = document.querySelector('[data-testid="reel-wealth"]');
          const win = reel.querySelector('.reel__window').getBoundingClientRect();
          const res = reel.querySelector('[data-result="true"]').getBoundingClientRect();
          return Math.abs(win.top + win.height / 2 - (res.top + res.height / 2));
        });
        push(!ov.overflow, `결과 후 ${w}x${h} 가로 넘침`, bad);
        push(g2 < 3, `결과 후 ${w}x${h} 결과 칸 어긋남 ${g2.toFixed(1)}`, bad);
      }
      push(fp(await saveJson(p)) === fp0, '저장 지문 변함', bad);
      push(errs.length === 0, `pageerror ${errs.join('|')}`, bad);
      await ctx.close();
      return { verdict: bad.length ? 'FAIL' : 'PASS', severity: '중간', actual: bad.length ? bad.join(' / ') : `5가지 크기를 회전 중·후 바꿔도 넘침 0·결과 칸 가운데 유지·결과 ${r.status}`, shots };
    },
  );
}

await browser.close();
