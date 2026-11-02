import { chromium, inject, birthState, toLife, BASE } from './qalib.mjs';
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 360, height: 740 }, hasTouch: true });
const page = await ctx.newPage();
const errors = []; page.on('pageerror', (e) => errors.push(e.message));
const cdp = await ctx.newCDPSession(page);
await cdp.send('Network.enable');
await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 400, downloadThroughput: (400 * 1024) / 8, uploadThroughput: (400 * 1024) / 8 }); // 느린 3G 정도
await page.addInitScript(() => {
  window.__yrs = new Map();
  const tick = () => {
    const yr = document.querySelector('.scene__year time')?.textContent; if (!yr) return;
    const era = document.querySelector('#scene-era');
    const art = document.querySelector('[data-testid="family-scene"]')?.getAttribute('data-scene-art');
    const rec = window.__yrs.get(yr) ?? { first: performance.now(), emptyMs: 0, last: performance.now(), seenEra: false };
    const now = performance.now();
    if (era?.getAttribute('data-empty') === 'true') rec.emptyMs += now - rec.last; else rec.seenEra = true;
    rec.last = now; rec.art = art; window.__yrs.set(yr, rec);
  };
  setInterval(tick, 50);
});
await inject(page, birthState({ seed: 9911, generation: 'g86', wealth: 2, birthYear: 1966, region: '경북' }), { speed: 8, autoMode: true, noteCards: false }, '/');
await toLife(page);
const t0 = Date.now();
while (Date.now() - t0 < 330000) {
  if (await page.getByTestId('ending-screen').isVisible().catch(() => false)) break;
  await page.waitForTimeout(1000);
}
const ended = await page.getByTestId('ending-screen').isVisible().catch(() => false);
const yrs = await page.evaluate(() => [...window.__yrs.entries()].map(([k, v]) => [k, Math.round(v.emptyMs), v.seenEra]));
const blanks = yrs.filter(([, ms, seen]) => ms > 600 || !seen);
console.log('느린 네트워크(400kbps, 지연 400ms) 프로덕션 번들 8배속:', '끝까지', ended, '해', yrs.length, '| 빈 틀이 0.6초 넘게 보인 해(또는 끝내 안 보인 해):', blanks.map(([k, ms, s]) => `${k}(${ms}ms${s ? '' : ',끝내 빈 틀'})`).join(' ') || '없음', '| errors', errors.length);
await b.close();
