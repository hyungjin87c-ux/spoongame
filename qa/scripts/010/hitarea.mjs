import { chromium, newPage, inject, settle } from './lib.mjs';
import { readFileSync } from 'node:fs';
for (const [w, h, touch] of [[1280, 800, false], [360, 740, true]]) {
  const { browser, page, errors } = await newPage(chromium, { width: w, height: h });
  await inject(page, { ...JSON.parse(readFileSync('qa/scripts/010/states/snaps-W3.json', 'utf8')).snaps[84], paused: true }, { speed: 1, autoMode: false, noteCards: false }, '/?__timescale=1000');
  await page.getByTestId('life-screen').waitFor();
  await page.waitForFunction(() => document.querySelectorAll('[data-testid="why-btn"]').length > 30, null, { timeout: 20000 });
  await settle(page, 300);
  const row = page.locator('#log-y2095');
  await row.scrollIntoViewIfNeeded(); await settle(page, 200);
  const geo = await row.evaluate((r) => { const b = r.querySelector('[data-testid="why-btn"]').getBoundingClientRect(); const s = r.querySelector('.log__sent').getBoundingClientRect(); const bs = getComputedStyle(r.querySelector('[data-testid="why-btn"]'), '::after'); return { btn: [Math.round(b.left), Math.round(b.top), Math.round(b.right), Math.round(b.bottom)], sent: [Math.round(s.left), Math.round(s.top), Math.round(s.right), Math.round(s.bottom)], hit: { content: bs.content, top: bs.top, height: bs.height } }; });
  // 문장 첫 줄 위쪽(문장 윗변 +3px)과 가운데(문장 첫 줄 한가운데)를 누른다
  const results = [];
  for (const [label, dy] of [['문장 윗변 +3px', 3], ['문장 첫 줄 가운데', 10], ['문장 윗변 +20px(둘째 줄 근처)', 24]]) {
    const x = Math.round((geo.sent[0] + geo.sent[2]) / 2), y = geo.sent[1] + dy;
    const before = await row.getByTestId('why-btn').getAttribute('aria-expanded');
    await page.mouse.click(x, y);
    await settle(page, 150);
    const after = await row.getByTestId('why-btn').getAttribute('aria-expanded');
    results.push(`${label}(y=${y}): ${before}→${after}`);
    if (after === 'true') await row.getByTestId('why-btn').click();
  }
  console.log(`${w}px: 단추 ${JSON.stringify(geo.btn)} 문장 ${JSON.stringify(geo.sent)} | ${results.join(' | ')} | errors ${errors.length}`);
  await browser.close();
}
