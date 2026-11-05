// 창 크기를 끄는 중 + 8배속 자동: 줄 모양 떨림·콘솔 오류(ResizeObserver 포함)
import { chromium, webkit, newPage, evalCore, inject, settle, BASE } from './lib.mjs';
const engine = process.argv[2] === 'webkit' ? webkit : chromium;
const { browser, page, errors } = await newPage(engine, { width: 1280, height: 800 });
await page.goto(BASE + '/');
const state = await evalCore(page, `
  let s = core.enterLife(core.enterBirth(core.beginBirth(core.createInitialState(55), 'millennial')));
  while (s.phase === 'life' && s.age < 40) { if (s.pending !== null) s = core.resolveChoiceStep(s, s.pending.key, s.pending.choiceIds[0]).state; else s = core.stepYear(s).state; }
  const flags = [...new Set([...s.flags, 'married', 'has_child', 'close_friend', 'cared_parents'])].sort();
  return { ...s, flags, paused: false };`);
await inject(page, state, { speed: 8, autoMode: true, noteCards: false }, '/?__timescale=25');
await page.getByTestId('family-card').waitFor();
const t0 = Date.now(); let n = 0; const widths = [];
// 끄는 동작: 1280 → 330 → 1280 를 여러 번, 대기 없이 연속
for (let pass = 0; pass < 6; pass++) {
  for (let w = 1280; w >= 330; w -= 38) { await page.setViewportSize({ width: w, height: 740 }); n++; }
  for (let w = 330; w <= 1280; w += 38) { await page.setViewportSize({ width: w, height: 740 }); n++; }
}
await page.setViewportSize({ width: 360, height: 740 });
await settle(page, 400);
const ending = await page.getByTestId('ending-screen').isVisible().catch(() => false);
const lines = await page.evaluate(() => [...document.querySelectorAll('[data-testid="family-card"] dd[data-testid^="family-"]:not([data-testid="family-pet"]):not([data-testid="family-things"])')].map((el) => { const tops = new Set(); const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT); for (let t = w.nextNode(); t; t = w.nextNode()) { if (t.parentElement.closest('.fit-pair__probe')) continue; const r = document.createRange(); r.selectNodeContents(t); for (const q of r.getClientRects()) if (q.width > 0) tops.add(Math.round(q.top / 4)); } return tops.size; }));
console.log(`${process.argv[2] ?? 'chromium'}: 크기 변경 ${n}회 (${Date.now() - t0}ms), 엔딩 ${ending}, 끝난 뒤 360 폭 줄 수 최대 ${Math.max(0, ...lines)} (사람 ${lines.length}), 가로 넘침 ${await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)}, 콘솔·페이지 오류 ${errors.length} ${errors.slice(0, 3).join(' | ')}`);
await browser.close();
