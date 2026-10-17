// QA-003 M5: 저장이 항상 실패하는 환경(개발 서버 ?__quota)에서 영향 줄이 붙은 선택을 해도 진행이 계속되고 안내가 보이는가.
import { launch, mkctx, DEV, GAME_KEY, sleep, shot, runCase, READ_DASH_M5, con } from './m5-lib.mjs';
import { loadSave } from './m5-states.mjs';
const browser = await launch();
await runCase({ id: 'M5-A11', cat: '공격', title: '저장 실패 환경(?__quota): 선택·해 진행·20세 전환이 계속되고 「저장하지 못했습니다」 안내가 보이며 크래시가 없다', steps: '개발 서버 ?__quota(setItem이 항상 예외)에서 성인 선택지 저장을 불러(읽기는 가능) 선택 클릭 → 몇 해 더 진행', expected: '선택이 적용되어 나이가 오르고(화면), 저장 실패 안내가 헤더 위에 뜨고, 콘솔 오류·오류 화면 0' }, async () => {
  const bad = [];
  const raw = loadSave('present', 'adult-choice');
  const ctx = await mkctx(browser, { viewport: { width: 360, height: 740 } });
  const page = await ctx.newPage();
  await page.addInitScript(`window.__readDash = ${READ_DASH_M5.toString()};`);
  // quota 탐침은 setItem을 막으므로 먼저 탐침 없이 저장을 심고 연다
  await page.goto(DEV, { waitUntil: 'load' });
  await page.evaluate(([k, v]) => {
    localStorage.clear();
    localStorage.setItem(k, v);
  }, [GAME_KEY, raw]);
  await page.goto(`${DEV}?__quota&__timescale=60`, { waitUntil: 'load' });
  await page.waitForSelector('[data-testid="choice-panel"]', { timeout: 15000 });
  await page.waitForFunction(() => [...document.querySelectorAll('[data-testid="choice-panel"] .choice')].every((b) => b.getAttribute('aria-disabled') !== 'true'));
  const age0 = (await page.evaluate(() => window.__readDash())).age;
  await page.locator('[data-testid="choice-panel"] .choice').first().click();
  await sleep(600);
  const d = await page.evaluate(() => window.__readDash());
  const notice = await page.evaluate(() => (document.body.innerText.match(/저장하지 못했습니다[^\n]*/) || [null])[0]);
  const errScreen = d.screen === 'error-screen';
  if (errScreen) bad.push('오류 화면');
  if (!(d.age > age0 || d.screen === 'ending-screen')) bad.push(`선택 뒤 나이 ${age0} → ${d.age}`);
  if (!notice) bad.push('저장 실패 안내 없음');
  const s = await shot(page, 'A11', 'quota-after-choice');
  await ctx.close();
  return { verdict: bad.length ? 'FAIL' : 'PASS', actual: bad.length ? bad.join(' / ') : `선택 뒤 나이 ${age0}→${d.age}, 안내 「${notice}」`, shots: [s] };
});
await browser.close();
