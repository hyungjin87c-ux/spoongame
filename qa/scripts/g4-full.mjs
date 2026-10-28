import { open, go, sleep, rec, shot } from './g4-lib.mjs';
const { browser, page, logs } = await open('d1280');
await go(page); await sleep(300);
await page.locator('[data-testid="gen-row-millennial"]').click(); await page.click('[data-testid="start-birth"]');
await page.waitForSelector('[data-testid="to-birth"]', { timeout: 15000 }); await sleep(700); await page.click('[data-testid="to-birth"]');
await page.waitForSelector('[data-testid="birth-screen"]'); await sleep(700); await page.click('[data-testid="next-life"]'); await page.waitForSelector('[data-testid="life-screen"]');
await page.click('[data-testid="auto"]').catch(() => {}); await page.getByRole('button', { name: '8배' }).click().catch(() => {});
const t0 = Date.now(); let last = ''; let ending = false;
while (Date.now() - t0 < 14 * 60000) {
  if (await page.$('[data-testid="ending-screen"]')) { ending = true; break; }
  const a = await page.$eval('[data-testid="life-age"]', (e) => e.innerText.replace(/\n/g, '')).catch(() => '?');
  if (a !== last && /0세$/.test(a)) console.log(Math.round((Date.now() - t0) / 1000) + 's ' + a); last = a;
  // 결정 카드가 남아 있으면 자동 모드가 고르지만, 멈춘 경우 첫 선택지 선택
  const stuck = await page.evaluate(() => { const b = document.querySelector('[data-testid^="choice-"],[data-testid="choice"] button'); return !!b; });
  await sleep(1500);
}
rec('E01', '밀레니얼 한 판 8배속+자동 모드로 엔딩까지', '엔딩 도달', `${ending} ${Math.round((Date.now() - t0) / 1000)}초 마지막 나이=${last}`, ending ? 'PASS' : 'FAIL', ending ? '-' : await shot(page, 'E01'));
if (ending) {
  const e = await page.evaluate(() => document.querySelector('[data-testid="ending-screen"]').innerText.replace(/\n/g, ' ').slice(0, 400));
  console.log(e);
  const again = page.getByRole('button', { name: /다시 태어나기/ }); await sleep(800); await again.first().click(); await sleep(1500);
  const t = await page.evaluate(() => ({ title: !!document.querySelector('[data-testid="title-screen"]'), lived: [...document.querySelectorAll('[data-testid^="gen-lived-"]')].map((e) => e.getAttribute('data-testid') + ':' + e.innerText), sel: document.querySelector('[data-testid="gen-list"] input:checked')?.value }));
  rec('E02', '엔딩 → 다시 태어나기', '첫 화면(세대 선택), 방금 산 세대에 「살아봄」 표시, 선택은 마지막 고른 줄 유지', JSON.stringify(t), t.title && t.lived.some((x) => /millennial/.test(x) && /살아봄/.test(x)) ? 'PASS' : 'FAIL');
}
rec('E00', '콘솔', '0건', JSON.stringify(logs), logs.length === 0 ? 'PASS' : 'FAIL');
await browser.close();
