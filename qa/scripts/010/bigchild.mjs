import { chromium, webkit, newPage, inject, settle } from './lib.mjs';
import { readFileSync } from 'node:fs';
const engine = process.argv[2] === 'webkit' ? webkit : chromium;
for (const vp of [[1280, 800], [360, 740]]) for (const font of [100, 200]) {
  const { browser, page, errors } = await newPage(engine, { width: vp[0], height: vp[1] });
  await inject(page, JSON.parse(readFileSync('qa/scripts/010/states/big-child.json', 'utf8')), { speed: 1, autoMode: false, noteCards: false }, '/?__timescale=1000');
  await page.getByTestId('family-card').waitFor();
  await page.waitForSelector('[data-testid="family-scene"][data-scene-art="ready"]', { timeout: 20000 }).catch(() => {});
  if (font !== 100) await page.addStyleTag({ content: `html { font-size: ${font}% !important; }` });
  await settle(page, 300);
  const sum = page.locator('.scene__more > summary'); if (await sum.count()) await sum.click();
  await settle(page, 200);
  const r = await page.evaluate(() => {
    const names = [...document.querySelectorAll('.scene__people li')].map((e) => e.textContent.replace(/\s+/g, ' ').trim());
    const together = [...document.querySelectorAll('[data-testid="family-card"] dd[data-state="with"] .family-who')].map((e) => e.textContent.trim());
    const rows = document.querySelectorAll('[data-testid="family-card"] dd[data-testid^="family-"]:not([data-testid="family-pet"]):not([data-testid="family-things"])').length;
    const house = document.querySelector('[data-testid="scene-house"]');
    const layers = [...house.querySelectorAll('[data-layer]')].map((l) => l.getAttribute('data-layer') + ':' + l.querySelectorAll('[data-piece]').length);
    return { names, together, rows, layers, line: document.querySelector('[data-testid="scene-line"]')?.textContent, over: document.documentElement.scrollWidth > document.documentElement.clientWidth, more: document.querySelector('[data-testid="family-more"]')?.textContent.trim() ?? '없음' };
  });
  console.log(`${engine === webkit ? 'webkit' : 'chromium'} ${vp[0]}·${font}%: 아래 한 줄 「${r.line}」 | 장면 펼침 ${r.names.length}줄 | 카드 함께 사는 ${r.together.length}명, 카드 줄 ${r.rows}, 더 보기 ${r.more} | 그림 층 ${r.layers.join(',')} | 넘침 ${r.over} | errors ${errors.length}`);
  if (font === 100 && vp[0] === 1280) console.log('   장면 펼침:', r.names.join(' / '), '\n   카드:', r.together.join(', '));
  await browser.close();
}
