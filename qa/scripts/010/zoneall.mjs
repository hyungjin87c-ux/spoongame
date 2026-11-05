// 0.5px 허용 구간(R-591 별도 문제): 각 사람 줄마다 탐침 폭 − 0.2px ~ + 0.45px가 되게 카드 폭을 맞춰 한 줄 모양이 줄을 바꿀 때 가장자리에 남는 글자를 본다
import { chromium, webkit, newPage, evalCore, inject, BASE } from './lib.mjs';
const engine = process.argv[2] === 'webkit' ? webkit : chromium;
const SPECS = [{ gen: 'millennial', seed: 55 }, { gen: 'alpha', seed: 1 }, { gen: 'alpha', seed: 24 }, { gen: 'genx', seed: 7 }, { gen: 'industrial', seed: 3 }, { gen: 'g86', seed: 9 }];
const { browser, page } = await newPage(engine, { width: 360, height: 740 });
await page.goto(BASE + '/');
const settle = () => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(r, 40)))));
const ROW = `(idx) => {
  const el = [...document.querySelectorAll('[data-testid="family-card"] dd[data-testid^="family-"]:not([data-testid="family-pet"]):not([data-testid="family-things"])')][idx];
  const fp = el.querySelector('small .fit-pair'); const pr = fp.querySelector('.fit-pair__probe');
  const chars = []; const walker = document.createTreeWalker(el.querySelector('small'), NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) { if (n.parentElement.closest('.fit-pair__probe')) continue; const t = n.textContent; for (let k = 0; k < t.length; k++) { const rg = document.createRange(); rg.setStart(n, k); rg.setEnd(n, k + 1); const r = rg.getClientRects()[0]; if (r && r.width > 0) chars.push({ ch: t[k], top: Math.round(r.top), left: r.left }); } }
  const lines = []; for (const c of chars) { const l = lines[lines.length - 1]; if (l && Math.abs(l.top - c.top) <= 4) l.text += c.ch; else lines.push({ top: c.top, text: c.ch }); }
  return { slack: fp.getBoundingClientRect().width - pr.getBoundingClientRect().width, split: fp.getAttribute('data-split'), lines: lines.map((l) => l.text), who: el.querySelector('.family-who').textContent };
}`;
const found = new Map(); let zoneN = 0, stray = 0;
for (const spec of SPECS) {
  const state = await evalCore(page, `
    let s = core.enterLife(core.enterBirth(core.beginBirth(core.createInitialState(arg.seed), arg.gen)));
    while (s.phase === 'life' && s.age < 45) { if (s.pending !== null) s = core.resolveChoiceStep(s, s.pending.key, s.pending.choiceIds[0]).state; else s = core.stepYear(s).state; }
    const flags = [...new Set([...s.flags, 'married', 'has_child', 'close_friend', 'cared_parents'])].sort();
    return { ...s, flags, paused: true };`, spec);
  await inject(page, state, { speed: 1, autoMode: false, noteCards: false }, '/');
  await page.getByTestId('family-card').waitFor();
  if ((await page.getByTestId('family-more').count()) > 0) await page.getByTestId('family-more').click();
  await settle();
  const n = await page.locator('[data-testid="family-card"] dd[data-testid^="family-"]:not([data-testid="family-pet"]):not([data-testid="family-things"])').count();
  const setW = (w) => page.evaluate((w) => { let st = document.getElementById('qa-w'); if (!st) { st = document.createElement('style'); st.id = 'qa-w'; document.head.append(st); } st.textContent = `[data-testid="family-card"] { width: ${w}px !important; max-width: ${w}px !important; box-sizing: border-box; }`; }, w);
  const base = await page.evaluate(() => document.querySelector('[data-testid="family-card"]').getBoundingClientRect().width);
  for (let i = 0; i < n; i++) {
    await setW(base); await settle();
    const r0 = await page.evaluate(`(${ROW})(${i})`);
    if (r0.split === 'true') continue;
    for (const off of [-0.45, -0.3, -0.2, -0.1, -0.02]) {
      await setW(base - r0.slack + off); await settle();
      const r = await page.evaluate(`(${ROW})(${i})`);
      if (!(r.slack < 0 && r.slack >= -0.5 && r.split === 'false')) continue;
      zoneN++;
      if (process.env.ALL) console.log('  zone', spec.gen, spec.seed, r.who, r.slack.toFixed(3), JSON.stringify(r.lines)); if (r.lines.length > 1) {
        const first = r.lines[0], last = r.lines[r.lines.length - 1];
        const bad = first.endsWith('·') || last.startsWith('·') || last.startsWith(',');
        if (bad) stray++;
        const key = JSON.stringify(r.lines);
        if (!found.has(key)) found.set(key, { bad, off, slack: r.slack.toFixed(3), spec: `${spec.gen}/${spec.seed}` });
      }
    }
  }
}
console.log(engine === webkit ? 'webkit' : 'chromium', `허용 구간 측정 ${zoneN} · 가장자리에 기호가 남은 것 ${stray} · 고유 줄 모양 ${found.size}`);
for (const [k, v] of found) console.log(v.bad ? 'BAD ' : 'ok  ', v.spec, v.slack, k);
await browser.close();
