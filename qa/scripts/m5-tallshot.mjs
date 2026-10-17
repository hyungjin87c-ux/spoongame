// 포커스가 가용 높이보다 큰 선택지 카드에 있을 때의 모습(예외 ②)을 찍는다: 20세 미만 카드, 360×568·320×568, 글자 200%, Tab으로 큰 선택지에 포커스
import { launch, sleep, shot } from './m5-lib.mjs';
import { openState } from './m5-states.mjs';
const browser = await launch();
for (const [vpn, vp] of [['360x568', { width: 360, height: 568 }], ['320x568', { width: 320, height: 568 }]]) {
  const { ctx, page } = await openState(browser, 'young-choice', { vp, font: 200 });
  await page.evaluate(() => { window.scrollTo(0, 0); if (document.activeElement) document.activeElement.blur(); });
  for (let i = 0; i < 30; i++) {
    await page.keyboard.press('Tab');
    await sleep(60);
    const id = await page.evaluate(() => document.activeElement?.getAttribute('data-testid'));
    if (id === 'choice-many') break;
  }
  await sleep(300);
  console.log(vpn, await page.evaluate(() => { const a = document.activeElement; const r = a.getBoundingClientRect(); const c = document.querySelector('[data-testid="controls"]').getBoundingClientRect(); return { id: a.getAttribute('data-testid'), top: Math.round(r.top), bottom: Math.round(r.bottom), controlsTop: Math.round(c.top), vh: innerHeight }; }));
  console.log(await shot(page, 'C10', `tall-card-young-${vpn}-200`));
  await ctx.close();
}
await browser.close();
