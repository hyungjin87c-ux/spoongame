// DS2: 가린 줄 도장 주어 + 기록 줄 도장 주어 (아버지 별세 후 어머니만: save-v040-mother-age20, 가리기 켬/끔)
import { chromium, newPage, inject } from './lib.mjs';
import { readFileSync } from 'node:fs';
for (const fx of ['save-v040-mother-age20', 'save-v040-both-age20']) {
  for (const gentle of [true, false]) {
    const raw = JSON.parse(readFileSync(`tests/fixtures/${fx}.json`, 'utf8')).data;
    const { browser, page, errors } = await newPage(chromium, { width: 360, height: 740 }, { hasTouch: true });
    const st = { ...raw, paused: true }; delete st.play;
    await inject(page, st, { speed: 1, autoMode: false, noteCards: false, gentle });
    await page.getByTestId('life-screen').waitFor({ state: 'visible' });
    await page.waitForTimeout(400);
    const r = await page.evaluate(() => ({
      log: [...document.querySelectorAll('[data-testid=log-row]')].filter((l) => l.querySelector('[data-by=parent]')).map((l) => l.querySelector('.log__age').textContent.trim() + ' ' + l.querySelector('[data-by=parent]').textContent.trim().slice(0, 14)),
      veil: [...document.querySelectorAll('[data-testid=veil-by][data-by=parent]')].map((e) => e.closest('[data-testid=log-row]')?.querySelector('.log__age')?.textContent.trim() + ' ' + e.textContent.trim()),
    }));
    console.log(`${fx} gentle=${gentle} errors ${errors.length}\n  기록줄 ${r.log.join(' / ')}\n  가린줄 ${r.veil.join(' / ')}`);
    await browser.close();
  }
}
