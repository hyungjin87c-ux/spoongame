// R-591 폭 훑기: 식구 카드 사람 줄의 쉼표·가운뎃점이 줄 첫머리·끝에 혼자 남는지 (Chromium·WebKit). 사용: node qa/scripts/010/sweep.mjs <chromium|webkit> [fine]
import { chromium, webkit, newPage, evalCore, inject, BASE } from './lib.mjs';
const engine = process.argv[2] === 'webkit' ? webkit : chromium;
const fine = process.argv.includes('fine');
const font = Number((process.argv.find((a) => a.startsWith('font=')) ?? 'font=100').slice(5));
const VW = (process.argv.find((a) => a.startsWith('vw=')) ?? 'vw=340-400').slice(3).split('-').map(Number);
const SPECS = [
  { gen: 'millennial', seed: 55 }, // 아버지 아주 가까움 · 농림어업직 · 병환 중 · 따로 삶
  { gen: 'alpha', seed: 1 },       // 은퇴 · 병환 중 · 따로 삶
  { gen: 'alpha', seed: 24 },      // 형제 기계 조작직 · 따로 삶
  { gen: 'genx', seed: 7 },
];
const MEASURE = `(() => {
  const rows = [...document.querySelectorAll('[data-testid="family-card"] dd[data-testid^="family-"]:not([data-testid="family-pet"]):not([data-testid="family-things"])')];
  const res = [];
  for (const el of rows) {
    const chars = [];
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n !== null; n = walker.nextNode()) {
      const parent = n.parentElement;
      if (parent === null || parent.closest('.fit-pair__probe, .sr-only') !== null) continue;
      const text = n.textContent ?? '';
      for (let k = 0; k < text.length; k++) {
        if (text[k].trim() === '') continue;
        const range = document.createRange(); range.setStart(n, k); range.setEnd(n, k + 1);
        const r = range.getClientRects()[0];
        if (r !== undefined && r.width > 0) chars.push({ ch: text[k], top: r.top, left: r.left });
      }
    }
    chars.sort((a, b) => a.top - b.top || a.left - b.left);
    const lines = [];
    for (const c of chars) { const last = lines[lines.length - 1]; if (last !== undefined && Math.abs(last[0].top - c.top) <= 4) last.push(c); else lines.push([c]); }
    const stray = [];
    for (const line of lines) {
      line.sort((a, b) => a.left - b.left);
      const first = line[0].ch, end = line[line.length - 1].ch;
      if (first === ',' || first === '·') stray.push('첫머리 ' + first);
      if (end === '·' || (line.length === 1 && end === ',')) stray.push('줄끝 ' + end);
    }
    const fp = el.querySelector('small .fit-pair'); const pr = fp?.querySelector('.fit-pair__probe'); const slack = fp && pr ? fp.getBoundingClientRect().width - pr.getBoundingClientRect().width : null; let smallTops = new Set(); const sm = el.querySelector('small'); if (sm) { const w2 = document.createTreeWalker(sm, NodeFilter.SHOW_TEXT); for (let n = w2.nextNode(); n; n = w2.nextNode()) { if (n.parentElement.closest('.fit-pair__probe')) continue; const rg = document.createRange(); rg.selectNodeContents(n); for (const rr of rg.getClientRects()) if (rr.width > 0) smallTops.add(Math.round(rr.top / 4)); } }
    res.push({ who: el.querySelector('.family-who')?.textContent ?? '', lines: lines.length, stray, split: fp?.getAttribute('data-split') ?? '', slack, smallLines: smallTops.size, text: el.innerText.replace(/\s+/g, ' ') });
  }
  return { rows: res, overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth };
})()`;
const settle = (page) => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(r, 30)))));

const problems = [];
const stats = { steps: 0, maxLines: 0, overflow: 0 };
const { browser, page, errors } = await newPage(engine, { width: 360, height: 740 });
await page.goto(BASE + '/');
for (const spec of SPECS) {
  const state = await evalCore(page, `
    let s = core.enterLife(core.enterBirth(core.beginBirth(core.createInitialState(arg.seed), arg.gen)));
    while (s.phase === 'life' && s.age < 45) { if (s.pending !== null) s = core.resolveChoiceStep(s, s.pending.key, s.pending.choiceIds[0]).state; else s = core.stepYear(s).state; }
    const flags = [...new Set([...s.flags, 'married', 'has_child', 'close_friend', 'cared_parents'])].sort();
    return { ...s, flags, paused: true };`, spec);
  await inject(page, state, { speed: 1, autoMode: false, noteCards: false }, '/');
  await page.getByTestId('family-card').waitFor();
  const more = page.getByTestId('family-more');
  if ((await more.count()) > 0) await more.click();
  if (font !== 100) await page.addStyleTag({ content: `html { font-size: ${font}% !important; }` });
  const record = async (label) => {
    await settle(page);
    const m = await page.evaluate(MEASURE);
    stats.steps++; for (const r of m.rows) { stats[r.split === 'true' ? 'splitRows' : 'oneLineRows'] = (stats[r.split === 'true' ? 'splitRows' : 'oneLineRows'] ?? 0) + 1; }
    if (m.overflow) { stats.overflow++; problems.push(`${spec.gen}/${spec.seed} ${label}: 가로 넘침`); }
    for (const r of m.rows) {
      if (r.slack !== null && r.slack < 0 && r.slack >= -0.5 && r.split === 'false') { stats.zone = (stats.zone ?? 0) + 1; if (r.smallLines > 1) { stats.zoneWrap = (stats.zoneWrap ?? 0) + 1; problems.push(label + ' 0.5px 구간에서 한 줄 모양이 줄을 바꿈: ' + r.text + ' slack=' + r.slack.toFixed(3)); } }
      stats.maxLines = Math.max(stats.maxLines, r.lines);
      if (r.stray.length) stats.stray = (stats.stray ?? 0) + 1; if (r.stray.length) problems.push(`${spec.gen}/${spec.seed} ${label}: ${r.who} [${r.stray.join(',')}] split=${r.split} lines=${r.lines} 「${r.text}」`);
      if (font === 100 && r.lines > 3) problems.push(`${spec.gen}/${spec.seed} ${label}: ${r.who} ${r.lines}줄 「${r.text}」`);
    }
    return m;
  };
  // 1) 뷰포트 폭 1px씩 340~400
  for (let w = VW[0]; w <= VW[1]; w++) { await page.setViewportSize({ width: w, height: 740 }); await record(`vw${w}`); }
  await page.setViewportSize({ width: 360, height: 740 });
  if (fine) {
    // 2) 카드 폭을 0.5px씩 줄여가며 분할 전환점을 찾고, 전환점 ±1px는 0.05px씩
    const setW = (w) => page.evaluate((w) => { let st = document.getElementById('qa-w'); if (!st) { st = document.createElement('style'); st.id = 'qa-w'; document.head.append(st); } st.textContent = `[data-testid="family-card"] { width: ${w}px !important; max-width: ${w}px !important; box-sizing: border-box; }`; }, w);
    const base = await page.evaluate(() => document.querySelector('[data-testid="family-card"]').getBoundingClientRect().width);
    let prev = null; const trans = [];
    for (let w = Math.floor(base); w >= 200; w -= 0.5) {
      await setW(w);
      const m = await record(`cw${w}`);
      const sig = m.rows.map((r) => r.split).join('');
      if (prev !== null && sig !== prev.sig) trans.push(prev.w);
      prev = { sig, w };
    }
    for (const t of trans) for (let w = t + 1.2; w >= t - 1.2; w -= 0.05) { await setW(w.toFixed(2)); await record(`cw${w.toFixed(2)}`); }
    console.log(`  ${spec.gen}/${spec.seed}: 카드 폭 ${base.toFixed(1)}px, 전환점 ${trans.length}곳`);
  }
}
console.log(`engine=${process.argv[2] ?? 'chromium'} fine=${fine} font=${font} 측정 ${stats.steps}회 (줄 분할 ${stats.splitRows}·한 줄 ${stats.oneLineRows}) · 최대 줄 수 ${stats.maxLines} · 0.5px 허용 구간 측정 ${stats.zone ?? 0}·그중 줄바뀜 ${stats.zoneWrap ?? 0} · 가장자리 기호 ${stats.stray ?? 0} · 넘침 ${stats.overflow} · 문제 ${problems.length} · 콘솔오류 ${errors.length}`);
const uniq = [...new Set(problems.map((p) => p.replace(/vw\d+|cw[\d.]+/, 'W')))];
console.log('고유 문제 유형', uniq.length); for (const p of uniq.slice(0, 12)) console.log(' -', p);
console.log('가장자리 기호 라벨:', problems.filter((x) => /첫머리|줄끝/.test(x)).map((x) => x.split(':')[0] + ':' + (x.match(/[[^]]+]/) ?? [''])[0]).join(' | ').slice(0, 1500));
if (errors.length) console.log(errors.slice(0, 5));
await browser.close();
