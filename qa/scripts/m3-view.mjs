// QA-003 M3 화면 확인(스크린샷 위주): 모바일 3종·태블릿·데스크톱의 룰렛 회전 중·결과·출생신고 상단·또래·비교·하단, 룰렛 정지 직전 프레임 연속(인상용). 사용: node qa/scripts/m3-view.mjs
import { launch, mkctx, fixSeed, installRouletteProbe, runCase, shot, openTitle, toRoulette, waitGuard, sleep, VP, TOUCH, overflowX } from './m3-lib.mjs';

const browser = await launch();

const SIZES = [
  ['m360x740', VP.m360, TOUCH],
  ['m320x568', VP.m320, TOUCH],
  ['m375x812', VP.m375, TOUCH],
  ['t768x1024', VP.t768, {}],
  ['d1024x768', VP.d1024, {}],
  ['d1280x800', VP.d1280, {}],
];

await runCase(
  { id: 'M3-V01', cat: '정상', title: '여러 화면 크기에서 룰렛(회전 중·결과)·출생신고(상단·또래·비교·하단)를 눈으로 확인 — 가로 넘침 0·로고 높이 ≥ 22px·띠가 본문을 가리지 않음', steps: '6개 뷰포트(360x740·320x568·375x812 터치, 768x1024·1024x768·1280x800)에서 시드 229(다이아몬드수저·전남광주통합특별시)로 룰렛 회전 중 1.5초, 결과, 출생신고 상단·또래·비교·하단을 스크린샷', expected: '넘침 0, 로고 ≥ 22px, 결과 칸이 가운데, 서류 격자가 폭에 맞게 2~3열, 띠가 마지막 줄을 가리지 않음(하단 여백)' },
  async () => {
    const bad = [];
    const shots = [];
    const notes = [];
    for (const [name, vp, t] of SIZES) {
      const ctx = await mkctx(browser, { viewport: vp, ...t });
      await fixSeed(ctx, 229);
      const p = await ctx.newPage();
      await openTitle(p);
      await toRoulette(p, 'present');
      await sleep(1500);
      shots.push(await shot(p, 'V01', `${name}-roulette-spinning`));
      await p.waitForSelector('[data-testid="roulette-screen"][data-state="result"]', { timeout: 8000 });
      await sleep(300);
      shots.push(await shot(p, 'V01', `${name}-roulette-result`));
      const ov1 = await overflowX(p);
      if (ov1.overflow) bad.push(`${name}: 룰렛 가로 넘침 ${ov1.scrollW}>${ov1.clientW}`);
      await waitGuard(p, 'to-birth');
      await p.getByTestId('to-birth').click();
      await p.waitForSelector('[data-testid="birth-screen"]');
      await sleep(500);
      shots.push(await shot(p, 'V01', `${name}-birth-top`));
      const ov2 = await overflowX(p);
      if (ov2.overflow) bad.push(`${name}: 출생신고 가로 넘침 ${ov2.scrollW}>${ov2.clientW}`);
      const logoH = await p.evaluate(() => Math.round(document.querySelector('[data-testid="header-logo"] svg')?.getBoundingClientRect().height ?? 0));
      if (logoH < 22) bad.push(`${name}: 헤더 로고 높이 ${logoH}px`);
      await p.evaluate(() => document.querySelector('[data-testid="peers-card"]')?.scrollIntoView({ block: 'start' }));
      await sleep(250);
      shots.push(await shot(p, 'V01', `${name}-birth-peers`));
      await p.evaluate(() => document.querySelector('[data-testid="compare-card"]')?.scrollIntoView({ block: 'start' }));
      await sleep(250);
      shots.push(await shot(p, 'V01', `${name}-birth-compare`));
      await p.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
      await sleep(300);
      shots.push(await shot(p, 'V01', `${name}-birth-bottom`));
      // 맨 아래에서 마지막 글자가 띠에 가려지지 않는지
      const hid = await p.evaluate(() => {
        const bar = document.querySelector('[data-testid="bottom-bar"]');
        const foot = document.querySelector('[data-testid="page-foot"]');
        const lastP = foot.lastElementChild.getBoundingClientRect();
        const bt = bar.getBoundingClientRect().top;
        return { lastBottom: Math.round(lastP.bottom), barTop: Math.round(bt), fixed: getComputedStyle(bar).position === 'fixed' };
      });
      if (hid.fixed && hid.lastBottom > hid.barTop + 1) bad.push(`${name}: 맨 아래에서 마지막 줄 ${hid.lastBottom}이 띠 위끝 ${hid.barTop} 아래로 가려짐`);
      notes.push(`${name}: 로고 ${logoH}px, 맨 아래 마지막 줄 ${hid.lastBottom} ≤ 띠 ${hid.barTop}`);
      await ctx.close();
    }
    return { verdict: bad.length ? 'FAIL' : 'PASS', severity: '중간', actual: bad.length ? bad.join(' / ') : notes.join(' | '), shots };
  },
);

// 정지 직전 프레임 연속(인상): 지역 릴이 멈춘 뒤 수저 릴만 남은 구간을 촘촘히
await runCase(
  { id: 'M3-I01', cat: '인상', title: '룰렛 긴장감 관찰: 정지 직전 구간 프레임 연속(지역 릴이 먼저 멈춘 뒤 수저 릴만 1.2초 더 돈다)', steps: '모바일 360x740에서 태어나기 직후 0.5·1.5·2.5·3.5·4.0·4.4·4.7·5.0·5.2·5.35·5.6초 프레임을 찍는다(흙수저 판·다이아몬드수저 판 각각)', expected: '(주관) 속도가 눈에 띄게 줄고 마지막 칸들이 읽히며, 지역이 먼저 정해진 뒤 수저만 도는 구간에 기대가 생긴다' },
  async () => {
    const shots = [];
    for (const [tag, seed] of [['dirt', 5], ['diamond', 229]]) {
      const ctx = await mkctx(browser, { viewport: VP.m360, ...TOUCH });
      await fixSeed(ctx, seed);
      await installRouletteProbe(ctx);
      const p = await ctx.newPage();
      await openTitle(p);
      await waitGuard(p, 'start-birth');
      await p.getByTestId('start-birth').click();
      const t0 = Date.now();
      for (const t of [500, 2500, 4000, 4700, 5100, 5350, 5700]) {
        while (Date.now() - t0 < t) await sleep(10);
        shots.push(await shot(p, 'I01', `${tag}-t${t}`));
      }
      await ctx.close();
    }
    return { verdict: 'RECORD', actual: '정지 직전 프레임 14장(흙수저 판·다이아몬드수저 판). 해석은 「인상」 절', shots };
  },
);

await browser.close();
