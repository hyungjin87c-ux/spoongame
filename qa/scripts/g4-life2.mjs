import { open, go, sleep, rec } from './g4-lib.mjs';
const { browser, page, logs } = await open('d1280');
await go(page); await sleep(300);
await page.locator('[data-testid="gen-row-genx"]').click();
await page.click('[data-testid="start-birth"]');
await page.waitForSelector('[data-testid="to-birth"]', { timeout: 15000 }); await page.click('[data-testid="to-birth"]');
await page.waitForSelector('[data-testid="birth-screen"]'); await page.click('[data-testid="next-life"]'); await page.waitForSelector('[data-testid="life-screen"]');
await page.click('[data-testid="auto"]').catch(() => {}); 
await page.getByRole('button', { name: '8배' }).click().catch(() => {});
const seen = []; const t0 = Date.now();
while (Date.now() - t0 < 45000) { const a = await page.$eval('[data-testid="life-age"]', (e) => e.innerText).catch(() => '?'); const y = await page.$eval('[data-testid="life-year"]', (e) => e.innerText).catch(() => '?'); const dec = !!(await page.$('[data-testid="decision-card"],[data-testid="choice"],[data-testid^="choice-"]')); const s = a.replace(/\n/g, '') + '/' + y; if (seen[seen.length - 1] !== s) seen.push(s); await sleep(500); }
console.log(seen.join(' | '));
const pop = await page.evaluate(() => /가상 인구|명이 이 시뮬/.test(document.body.innerText));
const ids = await page.$$eval('[data-testid]', (es) => [...new Set(es.map((e) => e.getAttribute('data-testid')))].filter((x) => /decision|choice|sheet|card/.test(x)));
console.log(ids);
rec('L01', '장년 세대 한 판 8배속·자동 모드 45초', '나이가 흘러 간다, 가상 인구 문구 없음', `${seen.slice(0, 12).join(' ')} … pop=${pop}`, seen.length > 3 && !pop ? 'PASS' : 'FAIL');
rec('L02', '콘솔', '0건', JSON.stringify(logs), logs.length === 0 ? 'PASS' : 'FAIL');
await browser.close();
