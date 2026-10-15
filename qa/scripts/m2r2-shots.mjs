// QA-003 M2 2회차: 줄바꿈 증거 스크린샷(푸터 글자 200%) — 사람 눈 확인용
import path from 'node:path';
import { launch, mkctx, openTitle, waitGuard, VP, TOUCH, SHOT_DIR, sleep } from './m2r2-lib.mjs';
import { setRootFont } from './m2r2-textlib.mjs';

const browser = await launch();
for (const [tag, vp] of [['320', VP.m320], ['360', VP.m360]]) {
  for (const font of [150, 200]) {
    const ctx = await mkctx(browser, { viewport: vp, ...TOUCH });
    const p = await ctx.newPage();
    await openTitle(p);
    await waitGuard(p);
    await p.addStyleTag({ content: '[data-testid=bottom-bar]{visibility:hidden !important}' });
    await setRootFont(p, font);
    await sleep(300);
    const foot = p.getByTestId('title-foot');
    await foot.scrollIntoViewIfNeeded();
    await foot.screenshot({ path: path.join(SHOT_DIR, `M2r2-C02-footer-${tag}-${font}.png`) });
    await ctx.close();
  }
}
await browser.close();
