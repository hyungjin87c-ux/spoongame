import { chromium, webkit, newPage, evalCore, inject, BASE } from './lib.mjs';
const engine = process.argv[2] === 'webkit' ? webkit : chromium;
const [gen, seed, vw] = [process.argv[3], Number(process.argv[4]), Number(process.argv[5])];
const { browser, page } = await newPage(engine, { width: 360, height: 740 });
await page.goto(BASE + '/');
const state = await evalCore(page, `
  let s = core.enterLife(core.enterBirth(core.beginBirth(core.createInitialState(arg.seed), arg.gen)));
  while (s.phase === 'life' && s.age < 45) { if (s.pending !== null) s = core.resolveChoiceStep(s, s.pending.key, s.pending.choiceIds[0]).state; else s = core.stepYear(s).state; }
  const flags = [...new Set([...s.flags, 'married', 'has_child', 'close_friend', 'cared_parents'])].sort();
  return { ...s, flags, paused: true };`, { gen, seed });
await inject(page, state, { speed: 1, autoMode: false, noteCards: false }, '/');
await page.getByTestId('family-card').waitFor();
if ((await page.getByTestId('family-more').count()) > 0) await page.getByTestId('family-more').click();
await page.setViewportSize({ width: vw, height: 740 });
await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(r, 50)))));
const out = await page.evaluate(() => {
  const res = [];
  for (const el of document.querySelectorAll('[data-testid="family-card"] dd[data-testid^="family-"]:not([data-testid="family-pet"]):not([data-testid="family-things"])')) {
    const fp = el.querySelector('small .fit-pair'); if (!fp) continue;
    const pr = fp.querySelector('.fit-pair__probe');
    const slack = fp.getBoundingClientRect().width - pr.getBoundingClientRect().width;
    const lines = [];
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    const chars = [];
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      if (n.parentElement.closest('.fit-pair__probe')) continue;
      const t = n.textContent;
      for (let k = 0; k < t.length; k++) { const rg = document.createRange(); rg.setStart(n, k); rg.setEnd(n, k + 1); const r = rg.getClientRects()[0]; if (r && r.width > 0) chars.push({ ch: t[k], top: Math.round(r.top), left: r.left }); }
    }
    for (const c of chars) { const l = lines[lines.length - 1]; if (l && Math.abs(l.top - c.top) <= 4) l.text += c.ch; else lines.push({ top: c.top, text: c.ch }); }
    res.push({ slack: slack.toFixed(3), split: fp.getAttribute('data-split'), lines: lines.map((l) => l.text) });
  }
  return res;
});
console.log(`vw=${vw}`); for (const r of out) console.log(r.slack, r.split, JSON.stringify(r.lines));
await browser.close();
