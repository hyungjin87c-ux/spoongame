import { sleep, rec, shot } from './g4-lib.mjs';
import { chromium } from 'playwright-core';
const b = await chromium.launch();
for (const [w, h, label] of [[640, 400, '브라우저 확대 200%(1280x800 환산)'], [320, 200, '브라우저 확대 400%(1280x800 환산)'], [320, 568, '320 폭']]) {
  const ctx = await b.newContext({ viewport: { width: w, height: h } }); const page = await ctx.newPage();
  await page.goto('http://localhost:4377/'); await page.waitForSelector('[data-testid="title-screen"]'); await sleep(600);
  const m = await page.evaluate(() => { const bar = document.querySelector('[data-testid="bottom-bar"]').getBoundingClientRect(); const st = document.querySelector('[data-testid="start-birth"]').getBoundingClientRect(); const list = document.querySelector('[data-testid="gen-list"]').getBoundingClientRect(); return { sw: document.documentElement.scrollWidth, vw: innerWidth, barH: Math.round(bar.height), vh: innerHeight, startVisible: st.top >= 0 && st.bottom <= innerHeight, listH: Math.round(list.height), listVisibleH: Math.round(Math.min(list.bottom, bar.top) - Math.max(list.top, 0)), pause: (() => { const p = document.querySelector('[data-testid="carousel-pause"]'); if (!p) return null; const r = p.getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height)]; })() }; });
  const ok = m.sw <= m.vw && m.startVisible;
  rec('Z-' + w + 'x' + h, label, '가로 넘침 0, 태어나기 보임', JSON.stringify(m), ok ? 'PASS' : 'FAIL', ok ? '-' : await shot(page, 'Z-' + w + 'x' + h));
  await ctx.close();
}
await b.close();
