// R-506 ②: 키보드 포커스(:focus-visible)로만 보이는 BGM 말풍선이 슬라이더 위쪽 영역 클릭을 가로채는가. 1024 마우스.
import { launchChromium, Watch, PROD, DEV, run, ok, bad, note, sleep, seedPage, DEFAULT_SETTINGS, oracle, withoutPlay } from './q005r4-lib.mjs';
const b = await launchChromium();
const devB = await launchChromium();
const dev = await (await devB.newContext({ viewport: { width: 800, height: 600 } })).newPage();
await dev.goto(DEV + '/');
await dev.getByTestId('title-screen').waitFor({ timeout: 90000 });
const quiet = await oracle(dev, `let s = core.enterLife(core.enterBirth(core.beginBirth(core.createInitialState(7), 'present'))); return { ...s, paused: true };`).then(withoutPlay);
const ctx = await b.newContext({ viewport: { width: 1024, height: 800 }, locale: 'ko-KR' });
const page = await ctx.newPage();
await seedPage(page, { game: quiet, settings: { ...DEFAULT_SETTINGS, speed: 1, autoMode: false, noteCards: false, gentle: false } });
await page.goto(PROD + '/');
await page.getByTestId('life-screen').waitFor();
await sleep(900);
await run({ id: 'C-C-bgm-focus-1024', area: 'BGM·볼륨', title: '1024 마우스: 키보드로 BGM을 켠 뒤(포인터는 멀리) 슬라이더 위쪽 영역을 클릭하면 BGM이 꺼지는가 (R-506 ②)', steps: 'BGM에 Tab 포커스 → Enter(켬) → 포인터를 버튼에서 먼 곳에 둔 채 말풍선 겹침 좌표로 점프 클릭', expected: '말풍선이 포커스로 보여도 슬라이더 클릭을 가로채지 않는다(BGM 유지)' }, async () => {
  await page.getByTestId('pause').focus();
  for (let i = 0; i < 12; i++) {
    await page.keyboard.press('Tab');
    if ((await page.evaluate(() => document.activeElement?.getAttribute('data-testid'))) === 'tool-bgm') break;
  }
  await page.mouse.move(5, 400);
  await page.keyboard.press('Enter');
  await page.getByTestId('bgm-volume').waitFor();
  await sleep(300);
  const g = await page.evaluate(() => {
    const tip = document.querySelector('[data-testid="tool-bgm"] span:not(.sr-only)').getBoundingClientRect();
    const sl = document.querySelector('[data-testid="bgm-volume-input"]').getBoundingClientRect();
    const fv = document.querySelector('[data-testid="tool-bgm"]').matches(':focus-visible');
    return { tip: { x: tip.left, y: tip.top, r: tip.right, b: tip.bottom }, sl: { y: sl.top, b: sl.bottom }, fv, clip: getComputedStyle(document.querySelector('[data-testid="tool-bgm"] span:not(.sr-only)')).clipPath };
  });
  const x = (g.tip.x + g.tip.r) / 2;
  const y = (Math.max(g.tip.y, g.sl.y) + Math.min(g.tip.b, g.sl.b)) / 2;
  await page.mouse.click(x, y);
  await sleep(300);
  const pressed = await page.getByTestId('tool-bgm').getAttribute('aria-pressed');
  return (pressed === 'true' ? ok : bad)(JSON.stringify({ focusVisible: g.fv, tipClip: g.clip, clickAt: [Math.round(x), Math.round(y)], bgmAfterClick: pressed }));
});
await b.close();
await devB.close();
