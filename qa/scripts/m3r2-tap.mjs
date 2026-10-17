// A01 tap20 변동 원인 확인: 터치 20연타가 걸린 시간과 건너뛰기가 눌린 시각(룰렛 시작 기준)을 잰다. 사용: node qa/scripts/m3r2-tap.mjs
import { launch, mkctx, fixSeed, openTitle, waitGuard, sleep, VP, TOUCH, installRouletteProbe } from './m3r2-lib.mjs';
const b = await launch();
const out = [];
for (let run = 0; run < 6; run++) {
  const ctx = await mkctx(b, { viewport: VP.m360, ...TOUCH });
  await fixSeed(ctx, 909);
  await ctx.addInitScript(() => {
    window.__t = { clicks: [], t0: null };
    document.addEventListener('click', (e) => {
      const tid = e.target.closest && e.target.closest('[data-testid]')?.getAttribute('data-testid');
      window.__t.clicks.push({ t: Math.round(performance.now()), tid, disabled: e.target.closest && e.target.closest('[aria-disabled="true"]') ? true : false });
    }, true);
    new MutationObserver(() => {
      const s = document.querySelector('[data-testid="roulette-screen"]');
      if (s && window.__t.t0 === null) window.__t.t0 = Math.round(performance.now());
    }).observe(document.documentElement, { subtree: true, childList: true });
  });
  if (process.env.WITH_PROBE) await installRouletteProbe(ctx);
  const p = await ctx.newPage();
  await openTitle(p);
  await waitGuard(p, 'start-birth');
  const bb = await p.getByTestId('start-birth').boundingBox();
  const c = { x: bb.x + bb.width / 2, y: bb.y + bb.height / 2 };
  const s0 = Date.now();
  for (let i = 0; i < 20; i++) await p.touchscreen.tap(c.x, c.y);
  const took = Date.now() - s0;
  await sleep(1000);
  const st = await p.evaluate(() => ({ state: document.querySelector('[data-testid="roulette-screen"]')?.getAttribute('data-state'), t: window.__t }));
  const first = st.t.clicks.find((x) => x.tid === 'start-birth');
  const skip = st.t.clicks.find((x) => x.tid === 'skip-roulette' && !x.disabled);
  out.push({ run, tookMs: took, state1s: st.state, roulette_t0: st.t.t0, skipAcceptedAt: skip ? skip.t - st.t.t0 : null, skipClicks: st.t.clicks.filter((x) => x.tid === 'skip-roulette').length, ignoredDisabled: st.t.clicks.filter((x) => x.tid === 'skip-roulette' && x.disabled).length });
  await ctx.close();
}
console.log(JSON.stringify(out, null, 1));
await b.close();
