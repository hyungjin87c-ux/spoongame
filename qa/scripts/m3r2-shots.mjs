// 1회차 6개 낱말 각각의 현재 모습을 같은 조합(폭·글자 크기·표본)에서 스크린샷으로 남긴다. 사용: node qa/scripts/m3r2-shots.mjs
import { launch, mkctx, fixSeed, openTitle, toRoulette, waitGuard, shot, sleep, setRootFont, TOUCH } from './m3r2-lib.mjs';
const b = await launch();
async function open(vp, era, seed, to) {
  const ctx = await mkctx(b, { viewport: { width: vp.w, height: vp.h }, ...(vp.touch ? TOUCH : {}) });
  await fixSeed(ctx, seed);
  const p = await ctx.newPage();
  await openTitle(p); await toRoulette(p, era);
  await waitGuard(p, 'skip-roulette'); await p.getByTestId('skip-roulette').click();
  await p.waitForSelector('[data-testid="roulette-screen"][data-state="result"]'); await sleep(400);
  if (to === 'birth') { await waitGuard(p, 'to-birth'); await p.getByTestId('to-birth').click(); await p.waitForSelector('[data-testid="birth-screen"]'); await sleep(400); }
  return { ctx, p };
}
const scroll = async (p, sel) => { await p.evaluate((s) => document.querySelector(s)?.scrollIntoView({ block: 'center' }), sel); await sleep(250); };
const jobs = [
  ['word1-정해졌습니다-360x740-200', { w: 360, h: 740, touch: true }, 'present', 229, 'result', 200, null],
  ['word1-정해졌습니다-320x568-200', { w: 320, h: 568 }, 'present', 229, 'result', 200, null],
  ['word1-정해졌습니다-320x256-200', { w: 320, h: 256 }, 'present', 229, 'result', 200, null],
  ['word2-다이아몬드수저-320x568-100-릴', { w: 320, h: 568 }, 'present', 229, 'result', 100, '[data-testid="reel-wealth"]'],
  ['word2-다이아몬드수저-320x568-100-칩', { w: 320, h: 568 }, 'present', 229, 'birth', 100, '[data-testid="birth-field-wealth"]'],
  ['word3-단순노무직서비스직-320x568-200', { w: 320, h: 568 }, 'present', 5, 'birth', 200, '[data-testid="birth-field-mother"]'],
  ['word3-단순노무직서비스직-360x740-200', { w: 360, h: 740, touch: true }, 'present', 5, 'birth', 200, '[data-testid="birth-field-mother"]'],
  ['word3-단순노무직서비스직-320x568-150', { w: 320, h: 568 }, 'present', 5, 'birth', 150, '[data-testid="birth-field-mother"]'],
  ['word4-제주특별자치도-320x568-200', { w: 320, h: 568 }, 'present', 4242, 'birth', 200, '[data-testid="birth-sentence"]'],
  ['word5-전남광주통합특별시-375x812-200', { w: 375, h: 812, touch: true }, 'present', 229, 'birth', 200, '[data-testid="birth-sentence"]'],
  ['word5-전남광주통합특별시-375x812-150', { w: 375, h: 812, touch: true }, 'present', 229, 'birth', 150, '[data-testid="birth-sentence"]'],
  ['word6-초중고사교육비조사-667x375-200', { w: 667, h: 375 }, 'present', 229, 'birth', 200, '[data-testid="compare-card"]'],
  ['word6-초중고사교육비조사-640x400-200', { w: 640, h: 400 }, 'present', 229, 'birth', 200, '[data-testid="compare-card"]'],
];
for (const [name, vp, era, seed, to, font, sel] of jobs) {
  const { ctx, p } = await open(vp, era, seed, to);
  await setRootFont(p, font); await sleep(300);
  if (sel) await scroll(p, sel); else await p.evaluate(() => window.scrollTo(0, 0));
  await shot(p, 'L02', name);
  await ctx.close();
}
await b.close();
