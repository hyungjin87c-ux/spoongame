// QA-003 M3 2회차 — QM3-3(없는 기능을 가리키는 문구 0)·QM3-4(어체)용 문구 수집. 세 세상 × 시드 N판의 룰렛(회전 중·결과)·출생신고 글자(숨은 글자·속성 포함)를 모은다.
// 사용: node qa/scripts/m3r2-copy.mjs <era> <시작시드> <판수>   결과: qa/results/m3r2/copy-<era>.jsonl (한 판에 한 줄)
import fs from 'node:fs';
import path from 'node:path';
import { launch, mkctx, fixSeed, openTitle, toRoulette, waitGuard, sleep, OUT, VP, TOUCH } from './m3r2-lib.mjs';

const [era = 'present', startS = '1', countS = '20'] = process.argv.slice(2);
const start = Number(startS);
const count = Number(countS);
const outFile = path.join(OUT, `copy-${era}.jsonl`);

/** 화면의 모든 글자(보이는 것 + 숨은 것 + 접근성 속성)와 문단별 문장 어체를 모은다 */
const COLLECT = () => {
  const SKIP = /^(SCRIPT|STYLE|NOSCRIPT|TEMPLATE)$/;
  const hiddenText = [];
  const all = [];
  const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let n;
  while ((n = w.nextNode())) {
    const pe = n.parentElement;
    if (!pe || SKIP.test(pe.tagName)) continue;
    const t = n.textContent.trim();
    if (!t) continue;
    all.push(t);
    const cs = getComputedStyle(pe);
    const r = pe.getBoundingClientRect();
    if (cs.display === 'none' || cs.visibility === 'hidden' || r.width <= 1.5 || r.height <= 1.5) hiddenText.push(t);
  }
  const attrs = [];
  for (const el of document.querySelectorAll('[aria-label],[title],[alt],[aria-description],[placeholder]')) {
    for (const a of ['aria-label', 'title', 'alt', 'aria-description', 'placeholder']) {
      const v = el.getAttribute(a);
      if (v) attrs.push(`${a}=${v}`);
    }
  }
  // 문단(블록)별 자기 글자 — 인라인 자손까지만
  const inline = (e) => /^(inline|contents)$/.test(getComputedStyle(e).display);
  const own = (el) => {
    let s = '';
    for (const c of el.childNodes) {
      if (c.nodeType === 3) s += c.textContent;
      else if (c.nodeType === 1) {
        if (SKIP.test(c.tagName)) continue;
        if (c.tagName === 'BR') s += ' ';
        else if (inline(c)) s += own(c);
      }
    }
    return s;
  };
  const paras = [];
  for (const el of document.body.querySelectorAll('*')) {
    if (SKIP.test(el.tagName) || inline(el)) continue;
    const cs = getComputedStyle(el);
    if (cs.display === 'none') continue;
    const t = own(el).replace(/\s+/g, ' ').trim();
    if (t.length < 4) continue;
    paras.push({ text: t, id: el.getAttribute('data-testid') || (typeof el.className === 'string' ? el.className.split(' ')[0] : '') || el.tagName.toLowerCase(), tag: el.tagName.toLowerCase() });
  }
  return { allText: all.join('\n'), hiddenText, attrs, paras, title: document.title };
};

const browser = await launch();
const tctx = await mkctx(browser, { viewport: VP.m360, ...TOUCH });
const tp = await tctx.newPage();
await openTitle(tp);
const titleScan = await tp.evaluate(COLLECT);
await tctx.close();
fs.appendFileSync(outFile, JSON.stringify({ era, seed: 'title', screens: { title: titleScan } }) + '\n');

for (let seed = start; seed < start + count; seed++) {
  const ctx = await mkctx(browser, { viewport: VP.m360, ...TOUCH });
  await fixSeed(ctx, seed);
  const p = await ctx.newPage();
  try {
    await openTitle(p);
    await toRoulette(p, era);
    await sleep(700);
    const spin = await p.evaluate(COLLECT);
    await waitGuard(p, 'skip-roulette');
    await p.getByTestId('skip-roulette').click();
    await p.waitForSelector('[data-testid="roulette-screen"][data-state="result"]', { timeout: 3000 });
    await sleep(350);
    const result = await p.evaluate(COLLECT);
    await waitGuard(p, 'to-birth');
    await p.getByTestId('to-birth').click();
    await p.waitForSelector('[data-testid="birth-screen"]', { timeout: 4000 });
    await sleep(350);
    const birth = await p.evaluate(COLLECT);
    const peersNote = await p.evaluate(() => document.querySelector('[data-testid="peers-card"] .card__note')?.textContent.trim() ?? null);
    const compareNote = await p.evaluate(() => document.querySelector('[data-testid="compare-note"]')?.textContent.trim() ?? null);
    fs.appendFileSync(outFile, JSON.stringify({ era, seed, peersNote, compareNote, screens: { spin, result, birth } }) + '\n');
  } catch (e) {
    fs.appendFileSync(outFile, JSON.stringify({ era, seed, error: String(e.message).slice(0, 200) }) + '\n');
  }
  await ctx.close();
}
await browser.close();
console.log(`copy ${era} ${start}..${start + count - 1} 완료`);
