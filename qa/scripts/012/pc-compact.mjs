// PC 960~1179 아이콘만 도구 줄: 36 정사각, 말풍선(hover/focus) Esc로 숨김 + 1280 한 줄 + 1400
import { chromium, newPage, inject } from './lib.mjs';
import { readFileSync } from 'node:fs';
const raw = JSON.parse(readFileSync('tests/fixtures/save-v040-both-age20.json', 'utf8')).data;
for (const w of [960, 1000, 1179, 1180, 1280, 1440]) {
  const { browser, page, errors } = await newPage(chromium, { width: w, height: 800 });
  const st = { ...raw, paused: true }; delete st.play;
  await inject(page, st, { speed: 1, autoMode: false, noteCards: false });
  await page.getByTestId('life-screen').waitFor({ state: 'visible' });
  await page.waitForTimeout(400);
  const m = await page.evaluate(() => {
    const tb = [...document.querySelectorAll('[data-testid=tools] button, [data-testid=tools] a')].map((b) => { const r = b.getBoundingClientRect(); return `${Math.round(r.width)}x${Math.round(r.height)}`; });
    const tools = document.querySelector('[data-testid=tools]').getBoundingClientRect();
    const bar = document.querySelector('[data-testid=controls]').getBoundingClientRect();
    return { tb, toolsH: Math.round(tools.height), barW: Math.round(bar.width), barH: Math.round(bar.height), rows: new Set([...document.querySelectorAll('[data-testid=tools] button')].map((b) => Math.round(b.getBoundingClientRect().top))).size, ox: document.documentElement.scrollWidth - document.documentElement.clientWidth };
  });
  let tip = '';
  if (w < 1180) {
    await page.getByTestId('tool-note').hover();
    await page.waitForTimeout(500);
    const shown = await page.evaluate(() => [...document.querySelectorAll('[role=tooltip]')].filter((e) => e.getBoundingClientRect().height > 0 && getComputedStyle(e).visibility !== 'hidden').length);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
    const after = await page.evaluate(() => [...document.querySelectorAll('[role=tooltip]')].filter((e) => e.getBoundingClientRect().height > 0 && getComputedStyle(e).visibility !== 'hidden').length);
    tip = ` 말풍선 ${shown}→Esc ${after}`;
  }
  console.log(`${w}: 도구 ${m.tb.join(' ')} 블록 ${m.toolsH}px 진행줄 ${m.barW}x${m.barH} 도구 줄 수 ${m.rows} 넘침 ${m.ox}${tip} 오류 ${errors.length}`);
  await browser.close();
}
