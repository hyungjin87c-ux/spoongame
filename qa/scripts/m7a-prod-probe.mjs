// QA-003 M7a 환경: prod 번들이 개발 서버 전용 탐침(?__timescale·__quota·__crash·__exit)을 무시하는지, 서비스 워커가 없는지.
// 같은 절차를 탐침 없이(대조군) 한 번, 탐침과 함께 한 번 돌려 3초 뒤 연도 진행률을 견준다(시간 배율이 먹으면 탐침 쪽이 훨씬 높다).
import { launch, mkctx, sleep, PROD, runCase, VP } from './m7a-lib.mjs';
import { RP, SHOT_PREFIX } from './m7a-lib.mjs';

const browser = await launch();
async function measure(query) {
  const ctx = await mkctx(browser, { viewport: VP.m360 });
  const page = await ctx.newPage();
  await page.goto(`${PROD}${query}`, { waitUntil: 'load' });
  await page.waitForSelector('[data-testid="title-screen"]', { timeout: 10000 });
  await page.getByTestId('start-birth').click();
  await page.waitForSelector('[data-testid="roulette-screen"]');
  await page.waitForSelector('[data-testid="skip-roulette"], [data-testid="to-birth"]');
  if (await page.locator('[data-testid="skip-roulette"]').count()) await page.getByTestId('skip-roulette').click();
  await page.waitForSelector('[data-testid="to-birth"]');
  await sleep(1200);
  await page.getByTestId('to-birth').click();
  await page.waitForSelector('[data-testid="next-life"]');
  await sleep(1200);
  await page.getByTestId('next-life').click();
  await page.waitForSelector('[data-testid="life-screen"]');
  await sleep(3000);
  const r = await page.evaluate(async () => ({
    pct: document.querySelector('[data-testid="year-pct"]')?.textContent.trim(),
    age: document.querySelector('[data-testid="life-age"] b')?.textContent,
    sw: navigator.serviceWorker ? (await navigator.serviceWorker.getRegistrations()).length : 'n/a',
    saveFailMsg: /저장하지 못했습니다/.test(document.body.innerText),
  }));
  await ctx.close();
  return r;
}

await runCase({ id: 'M7a-X02', cat: '환경', title: 'prod에서 ?__timescale=60·__quota·__crash·__exit 탐침 무시, 서비스 워커 0', steps: '같은 절차(태어나기 → 룰렛 → 출생신고 → 대시보드 3초)를 탐침 없이·탐침과 함께 돌려 연도 진행률을 견준다', expected: '탐침 쪽도 정상 첫 화면(크래시 없음), 진행률이 대조군과 비슷(시간 배율 무시), 저장 실패 안내 없음, 서비스 워커 0' }, async () => {
  const control = await measure('');
  const probed = await measure('?__timescale=60&__quota&__crash&__exit');
  const bad = [];
  if (parseInt(probed.pct, 10) > parseInt(control.pct, 10) + 20) bad.push(`탐침 쪽 진행률 ${probed.pct} ≫ 대조군 ${control.pct}`);
  if (probed.sw !== 0 || control.sw !== 0) bad.push(`서비스 워커 ${probed.sw}/${control.sw}`);
  if (probed.saveFailMsg) bad.push('저장 실패 안내가 뜸(__quota가 먹음)');
  return { verdict: bad.length ? 'FAIL' : 'PASS', actual: bad.length ? bad.join(' / ') : `탐침 쪽 3초 뒤 ${probed.pct}(${probed.age}세) ≈ 대조군 ${control.pct}(${control.age}세) — 시간 배율 무시, 크래시·저장 실패 없음, 서비스 워커 0`, shots: [] };
});
await browser.close();
