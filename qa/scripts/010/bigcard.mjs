import { chromium, webkit, newPage, inject, settle } from './lib.mjs';
import { readFileSync } from 'node:fs';
const engine = process.argv[2] === 'webkit' ? webkit : chromium;
const FILES = ['big-gone', 'big-sib', 'big-both'];
for (const f of FILES) for (const vp of [[1280, 800], [360, 740]]) for (const font of [100, 200]) {
  const { browser, page, errors } = await newPage(engine, { width: vp[0], height: vp[1] });
  const st = JSON.parse(readFileSync(`qa/scripts/010/states/${f}.json`, 'utf8'));
  await inject(page, st, { speed: 1, autoMode: false, noteCards: false }, '/?__timescale=1000');
  await page.getByTestId('family-card').waitFor();
  await page.waitForSelector('[data-testid="family-scene"][data-scene-art="ready"], [data-testid="family-scene"][data-scene-art="failed"]', { timeout: 20000 }).catch(() => {});
  if (font !== 100) await page.addStyleTag({ content: `html { font-size: ${font}% !important; }` });
  await settle(page, 300);
  const info = () => page.evaluate(() => {
    const card = document.querySelector('[data-testid="family-card"]');
    const rows = [...card.querySelectorAll('dd[data-testid^="family-"]:not([data-testid="family-pet"]):not([data-testid="family-things"])')];
    const gone = card.querySelectorAll('[data-testid="family-gone"] dd').length;
    const more = card.querySelector('[data-testid="family-more"]');
    return { rows: rows.length, gone, living: rows.length - gone, more: more ? more.getAttribute('aria-expanded') + ':' + more.textContent.trim() : '없음', overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth, sceneLi: document.querySelectorAll('.scene__people li').length, cardH: Math.round(card.getBoundingClientRect().height), sr: card.querySelector('.family-more .sr-only')?.textContent ?? '' };
  });
  const a = await info();
  let k = '';
  const more = page.getByTestId('family-more');
  if ((await more.count()) > 0) {
    await more.focus(); await page.keyboard.press('Enter'); await settle(page, 150);
    const b = await info(); const focusOk = await more.evaluate((e) => e === document.activeElement);
    await page.keyboard.press('Space'); await settle(page, 150);
    const c = await info();
    k = `| 펼침(Enter) 줄 ${a.rows}→${b.rows} 단추 ${b.more} 초점유지 ${focusOk} | 접힘(Space) 줄 ${c.rows} ${c.more} (기본과 같음 ${c.rows === a.rows})`;
  }
  console.log(`${f.padEnd(9)} ${vp[0]}·${font}% 줄 ${a.rows}(떠난 ${a.gone}·산 ${a.living}) 더보기 ${a.more} 넘침 ${a.overflow} 장면줄 ${a.sceneLi} 카드높이 ${a.cardH} ${a.sr} ${k} errors ${errors.length}`);
  await browser.close();
}
