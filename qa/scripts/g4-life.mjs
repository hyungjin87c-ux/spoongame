import { open, go, sleep, rec } from './g4-lib.mjs';
const { browser, page, logs } = await open('d1280');
await go(page); await sleep(300);
await page.locator('[data-testid="gen-row-millennial"]').click();
await page.click('[data-testid="start-birth"]');
await page.waitForSelector('[data-testid="to-birth"]', { timeout: 15000 }); await page.click('[data-testid="to-birth"]');
await page.waitForSelector('[data-testid="birth-screen"]');
await page.click('[data-testid="next-life"]'); await sleep(800);
const ids = await page.$$eval('[data-testid]', (es) => [...new Set(es.map((e) => e.getAttribute('data-testid')))].slice(0, 80));
console.log(ids.join(' '));
const t = await page.evaluate(() => document.body.innerText.slice(0, 1500));
console.log(t);
for (let i = 0; i < 6; i++) { await sleep(5000); const a = await page.evaluate(() => document.body.innerText.match(/(\d+)세/g)?.slice(0, 3)); console.log(i, a); }
await page.screenshot({ path: process.argv[2] + '/life.png' });
console.log(logs);
await browser.close();
