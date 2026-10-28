import { open, go, sleep, rec, shot } from './g4-lib.mjs';
{
  const { browser, page } = await open('d1280'); await go(page); await sleep(500);
  for (let i = 0; i < 19; i++) { await page.click('[data-testid="carousel-next"]'); await sleep(200); }
  const t = await page.$eval('[data-testid="carousel"]', (e) => e.innerText); const i = t.indexOf('최고'); console.log(t.slice(Math.max(0, i - 80), i + 60).replace(/\n/g, ' '));
  await browser.close();
}
{
  const { browser, page } = await open('m360'); await go(page); await sleep(500);
  const rows = [];
  for (let i = 0; i < 21; i++) { rows.push(await page.evaluate(() => ({ n: document.querySelector('[data-testid="carousel-count"]').textContent.trim(), car: Math.round(document.querySelector('[data-testid="carousel"]').getBoundingClientRect().height), foot: Math.round(document.querySelector('footer').getBoundingClientRect().top + scrollY), doc: document.documentElement.scrollHeight }))); await page.click('[data-testid="carousel-next"]'); await sleep(200); }
  const foots = rows.map((r) => r.foot); console.log(rows.map((r) => `${r.n} car=${r.car} footTop=${r.foot}`).join('\n'));
  rec('C13', '360: 장이 바뀔 때 캐러셀 높이가 변해 아래 푸터가 밀리는 정도', '큰 흔들림 없음(RECORD)', `캐러셀 높이 ${Math.min(...rows.map((r) => r.car))}~${Math.max(...rows.map((r) => r.car))}px, 푸터 위치 변동 ${Math.max(...foots) - Math.min(...foots)}px`, 'RECORD');
  await browser.close();
}
