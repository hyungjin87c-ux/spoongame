// QA-003 M7b 2회차 L03: 인라인·320×568·글자 200%에서 아래 모서리가 고정 띠에 가린 포커스 조합의 스크린샷 (Tab으로 해당 선택지에 닿은 순간)
import { launch, sleep, shot } from './m7b-lib.mjs';
import { openCard, VPS } from './m7b-audit.mjs';
const b = await launch();
for (const [name, tid] of [['layoff-future', 'choice-hold'], ['familyprio-past', 'choice-accept'], ['marriage-past', 'choice-marry'], ['child-past', 'choice-have'], ['sibling-past', 'choice-notice']]) {
  const { ctx, page } = await openCard(b, name, 'inline', { vp: VPS[0], font: 200, hidden: true });
  await page.evaluate(() => { window.scrollTo(0, 0); if (document.activeElement) document.activeElement.blur(); });
  for (let i = 0; i < 40; i++) {
    await page.keyboard.press('Tab');
    await sleep(50);
    if ((await page.evaluate(() => document.activeElement && document.activeElement.getAttribute('data-testid'))) === tid) break;
  }
  await sleep(300);
  const r = await page.evaluate(() => { const a = document.activeElement; const r = a.getBoundingClientRect(); return { id: a.getAttribute('data-testid'), t: Math.round(r.top), b: Math.round(r.bottom), vh: innerHeight }; });
  console.log(name, JSON.stringify(r));
  await shot(page, 'L03', `inline-320x568-200-${name}-${tid}`);
  await ctx.close();
}
await b.close();
