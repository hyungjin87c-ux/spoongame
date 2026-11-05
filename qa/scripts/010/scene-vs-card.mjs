import { chromium, newPage, inject, settle } from './lib.mjs';
import { readFileSync } from 'node:fs';
for (const f of ['big-sib', 'big-both', 'big-gone']) for (const vp of [[1280, 800], [360, 740]]) {
  const { browser, page, errors } = await newPage(chromium, vp[0] === 1280 ? { width: 1280, height: 800 } : { width: 360, height: 740 });
  await inject(page, JSON.parse(readFileSync(`qa/scripts/010/states/${f}.json`, 'utf8')), { speed: 1, autoMode: false, noteCards: false }, '/?__timescale=1000');
  await page.getByTestId('family-card').waitFor();
  await page.waitForSelector('[data-testid="family-scene"][data-scene-art="ready"]', { timeout: 20000 }).catch(() => {});
  await settle(page, 300);
  // 장면 카드의 펼침(함께 사는 사람) 열기
  const sum = page.locator('.scene__more > summary'); if (await sum.count()) await sum.click();
  await settle(page, 200);
  const r = await page.evaluate(() => {
    const sceneNames = [...document.querySelectorAll('.scene__people li')].map((e) => e.textContent.replace(/\s+/g, ' ').trim());
    const together = [...document.querySelectorAll('[data-testid="family-card"] dl.family-list:not(.family-list--gone) dd[data-state="with"] .family-who')].map((e) => e.textContent.trim());
    const fig = document.querySelectorAll('[data-testid="scene-house"] [data-layer="사람"] [data-piece], [data-testid="scene-house"] [data-person]').length;
    const house = document.querySelector('[data-testid="scene-house"]'); const hr = house?.getBoundingClientRect(); const sc = document.querySelector('[data-testid="family-scene"]').getBoundingClientRect();
    let outside = 0; for (const e of house?.querySelectorAll('svg *') ?? []) { const b = e.getBoundingClientRect(); if (b.width > 0 && (b.right > hr.right + 2 || b.left < hr.left - 2)) outside++; }
    return { sceneNames, together, fig, line: document.querySelector('[data-testid="scene-line"]')?.textContent, outside, over: document.documentElement.scrollWidth > document.documentElement.clientWidth };
  });
  console.log(`${f} ${vp[0]}: 장면 아래 한 줄 「${r.line}」 | 펼침 줄 ${r.sceneNames.length}: ${r.sceneNames.join(' / ').slice(0, 120)} | 카드 함께 사는 ${r.together.length}명 | 그림 상자 밖으로 나간 도형 ${r.outside} | 넘침 ${r.over} | errors ${errors.length}`);
  await browser.close();
}
