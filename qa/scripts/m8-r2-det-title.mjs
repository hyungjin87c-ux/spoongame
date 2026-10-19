// QA-003 M8 2회차: 첫 화면에서 D-98 대상 밖의 글에 줄 끝 홀로 관형사가 남는 곳을 모아 낱낱이 기록한다(TL-det의 「관찰」 내역). 공통 뷰포트 11 × 글자 100·200%, 라이트.
import { DET_AUDIT } from './m8-r2-det.mjs';
import { launch, mkctx, sleep, STD_VIEWPORTS, setRootFont, PROD, TOUCH, writeJson } from './m8-lib.mjs';
const browser = await launch();
const found = new Map();
for (const vp of STD_VIEWPORTS) {
  const ctx = await mkctx(browser, { viewport: { width: vp.width, height: vp.height }, ...(vp.touch ? TOUCH : {}), colorScheme: 'light' });
  await ctx.addInitScript(() => { try { if (!sessionStorage.getItem('__c')) { localStorage.clear(); sessionStorage.setItem('__c', '1'); } } catch {} });
  const page = await ctx.newPage();
  await page.goto(PROD, { waitUntil: 'load' });
  await page.waitForSelector('[data-testid="title-screen"]');
  for (const pct of [100, 200]) {
    await setRootFont(page, pct);
    await sleep(150);
    const r = await page.evaluate(DET_AUDIT, ['[data-testid="title-screen"]']);
    for (const v of r.violations) {
      const key = `${v.el} | ${v.context}`;
      const e = found.get(key) || { el: v.el, context: v.context, at: [] };
      e.at.push(`${vp.name}/${pct}%`);
      found.set(key, e);
    }
  }
  await ctx.close();
}
const rows = [...found.values()];
writeJson('det-title-others.json', rows);
console.log(JSON.stringify(rows, null, 1));
await browser.close();
