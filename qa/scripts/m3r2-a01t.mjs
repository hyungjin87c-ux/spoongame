// 「태어나기」 터치 20연타(M3-A01의 tap20 변형) — 입력 가드(400ms) 안에 끝난 연타만 유효 시도로 센다.
// 이유: 이 PC에서는 터치 20번이 346ms 걸리기도, 660~930ms 걸리기도 한다(Windows 스케줄링). 가드(400ms)가 풀린 뒤에 들어간 탭은 「건너뛰기」를 정당하게 누른다.
// 사용: node qa/scripts/m3r2-a01t.mjs
import { launch, mkctx, fixSeed, installRouletteProbe, getProbe, runCase, shot, openTitle, waitGuard, readRoulette, saveJson, whichScreen, sleep, VP, TOUCH } from './m3r2-lib.mjs';

const browser = await launch();
await runCase(
  { id: 'M3-A01t', cat: '공격', title: '「태어나기」 터치 20연타 → 룰렛은 한 번만, 건너뛰기가 눌리지 않음(입력 가드 400ms 안에 끝난 연타만 유효)', steps: '360x740 터치, 터치 20번(지연 0)을 최대 10번 시도. 20탭이 380ms 안에 끝난 시도에서 1초 뒤 회전 중인지·정지 이벤트 2회·저장 불변을 본다. 가드 뒤로 밀린 느린 시도는 기록만(건너뛰기가 가드 해제 뒤에 눌린 것은 정상)', expected: '유효 시도에서 회전 중·건너뛰기 0·룰렛 한 번. 느린 시도에서는 건너뛰기가 가드 해제(≥400ms) 뒤에만 눌림' },
  async () => {
    const attempts = [];
    const bad = [];
    const shots = [];
    let valid = 0;
    for (let a = 0; a < 10 && valid < 3; a++) {
      const ctx = await mkctx(browser, { viewport: VP.m360, ...TOUCH });
      await fixSeed(ctx, 909);
      await installRouletteProbe(ctx);
      await ctx.addInitScript(() => {
        window.__clicks = [];
        document.addEventListener('click', (e) => {
          const el = e.target.closest && e.target.closest('[data-testid]');
          window.__clicks.push({ t: performance.now(), tid: el && el.getAttribute('data-testid'), disabled: !!(e.target.closest && e.target.closest('[aria-disabled="true"]')) });
        }, true);
      });
      const p = await ctx.newPage();
      await openTitle(p);
      await waitGuard(p, 'start-birth');
      const bb = await p.getByTestId('start-birth').boundingBox();
      const c = { x: bb.x + bb.width / 2, y: bb.y + bb.height / 2 };
      const t0 = Date.now();
      for (let i = 0; i < 20; i++) await p.touchscreen.tap(c.x, c.y);
      const took = Date.now() - t0;
      await sleep(1000);
      const r = await readRoulette(p).catch(() => null);
      const scr = await whichScreen(p);
      const clicks = await p.evaluate(() => window.__clicks);
      const startClick = clicks.find((x) => x.tid === 'start-birth');
      const accepted = clicks.filter((x) => x.tid === 'skip-roulette' && !x.disabled);
      const firstAcceptedAfter = accepted.length ? Math.round(accepted[0].t - startClick.t) : null;
      const rec = { a, tookMs: took, state1s: r?.state, screen: scr, skipAcceptedAfterStartMs: firstAcceptedAfter };
      attempts.push(rec);
      if (took <= 380) {
        valid++;
        if (scr !== 'roulette-screen') bad.push(`시도 ${a}: 화면 ${scr}`);
        if (r?.state !== 'spinning') bad.push(`시도 ${a}(20탭 ${took}ms ≤ 380): 1초 뒤 회전 중이 아님(${r?.state})`);
        const sv = await saveJson(p);
        if (sv?.data?.phase !== 'roulette') bad.push(`시도 ${a}: 저장 phase ${sv?.data?.phase}`);
        await p.waitForSelector('[data-testid="roulette-screen"][data-state="result"]', { timeout: 9000 });
        const pr = await getProbe(p);
        const stops = pr.events.filter((e) => e.state === 'stopped').length;
        if (stops !== 2) bad.push(`시도 ${a}: 릴 정지 이벤트 ${stops}회(2 기대)`);
        if (valid === 1) shots.push(await shot(p, 'A01t', 'tap20-valid'));
      } else if (firstAcceptedAfter !== null && firstAcceptedAfter < 380) {
        bad.push(`시도 ${a}(20탭 ${took}ms): 가드 400ms 안인데 건너뛰기가 받아들여짐(${firstAcceptedAfter}ms)`);
      }
      await ctx.close();
    }
    if (valid === 0) return { verdict: 'RECORD', severity: '-', actual: `유효 시도 0(모두 20탭이 380ms를 넘김) — 판정 보류. 시도: ${JSON.stringify(attempts)}`, shots };
    return { verdict: bad.length ? 'FAIL' : 'PASS', severity: '높음', actual: bad.length ? bad.join(' / ') : `유효 시도 ${valid}번(20탭 ≤ 380ms) 모두 회전 중·정지 2회. 시도 기록: ${attempts.map((x) => `${x.tookMs}ms→${x.state1s}${x.skipAcceptedAfterStartMs != null ? '(건너뛰기 가드 뒤 ' + x.skipAcceptedAfterStartMs + 'ms)' : ''}`).join(', ')}`, shots };
  },
);
await browser.close();
