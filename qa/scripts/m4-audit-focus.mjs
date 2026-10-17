// QA-003 M4 CM10 감사: 키보드 Tab·Shift+Tab 전체 순회에서 포커스가 고정 요소(고정 머리·하단 진행 줄)에 가려지는가. QM2-1 (b)(c) 방식의 독립 측정.
// 사용: node qa/scripts/m4-audit-focus.mjs [states] [fonts] [workers]   결과: qa/results/m4/audit-focus.jsonl
import fs from 'node:fs';
import path from 'node:path';
import { launch, sleep, OUT } from './m4-lib.mjs';
import { openState, VPS } from './m4-states.mjs';

const states = (process.argv[2] || 'infant,age30,pending,exit-ask,tools-open,ending').split(',');
const fonts = (process.argv[3] || '100,200').split(',').map(Number);
const workers = Number(process.argv[4] || 3);
const outFile = path.join(OUT, process.env.MUT_CSS ? 'audit-focus-mut.jsonl' : 'audit-focus.jsonl');
if (!process.env.QA_APPEND) fs.writeFileSync(outFile, '');

const TAG_INTERACTIVE = () => {
  let n = 0;
  const out = [];
  for (const e of document.querySelectorAll('button, a[href], input:not([type="hidden"]), select, textarea, summary, [tabindex]')) {
    if (e.getAttribute('tabindex') === '-1' || e.disabled) continue;
    const cs = getComputedStyle(e);
    const r = e.getBoundingClientRect();
    if (cs.display === 'none' || cs.visibility === 'hidden' || r.width < 2 || r.height < 2) continue;
    let hidden = false;
    for (let x = e; x; x = x.parentElement) if (x.hidden || getComputedStyle(x).display === 'none') hidden = true;
    if (hidden) continue;
    e.setAttribute('data-qa-i', String(n));
    out.push({ i: n, id: e.getAttribute('data-testid') || (e.textContent || '').trim().slice(0, 10) || e.tagName });
    n++;
  }
  return out;
};

const FOCUS_MEASURE = () => {
  const a = document.activeElement;
  if (!a || a === document.body || a === document.documentElement) return { none: true };
  const vw = document.documentElement.clientWidth;
  const vh = window.innerHeight;
  const cs = getComputedStyle(a);
  const r = a.getBoundingClientRect();
  const ow = cs.outlineStyle !== 'none' ? parseFloat(cs.outlineWidth) || 0 : 0;
  const oo = cs.outlineStyle !== 'none' ? Math.max(parseFloat(cs.outlineOffset) || 0, 0) : 0;
  const g = ow + oo;
  const box = { l: r.left - g, t: r.top - g, r: r.right + g, b: r.bottom + g };
  const fixed = [];
  for (const e of document.body.querySelectorAll('*')) {
    const c = getComputedStyle(e);
    if (c.position !== 'fixed' && c.position !== 'sticky') continue;
    if (c.visibility === 'hidden' || parseFloat(c.opacity) === 0 || c.display === 'none') continue;
    const q = e.getBoundingClientRect();
    if (q.width < 2 || q.height < 2) continue;
    if (c.position === 'sticky' && !(q.top <= 1 || q.bottom >= vh - 1)) continue;
    // 눈에 안 보이는 측정 장치(투명 배경·pointer-events none 빈 상자)는 제외
    if (c.pointerEvents === 'none' && e.textContent.trim() === '' && e.children.length === 0) continue;
    if (e.contains(a) || a.contains(e)) continue;
    fixed.push({ el: e.getAttribute('data-testid') || (typeof e.className === 'string' ? e.className.split(' ')[0] : '') || e.tagName, l: q.left, t: q.top, r: q.right, b: q.bottom });
  }
  let overlap = 0;
  const hit = [];
  for (const f of fixed) {
    const w = Math.min(box.r, f.r) - Math.max(box.l, f.l);
    const h = Math.min(box.b, f.b) - Math.max(box.t, f.t);
    if (w > 0.5 && h > 0.5) {
      overlap += w * h;
      hit.push(`${f.el}(${Math.round(f.t)}~${Math.round(f.b)}) vs 포커스 ${Math.round(box.t)}~${Math.round(box.b)}`);
    }
  }
  const topFix = fixed.filter((f) => f.t <= 1 && f.b < vh * 0.9).reduce((m, f) => Math.max(m, f.b), 0);
  const botFix = fixed.filter((f) => f.b >= vh - 1 && f.t > vh * 0.1).reduce((m, f) => Math.min(m, f.t), vh);
  const avail = botFix - topFix;
  const tall = r.height > avail;
  let outside = false;
  if (!tall) outside = box.t < -0.5 || box.b > vh + 0.5 || box.l < -0.5 || box.r > vw + 0.5;
  else outside = box.t < topFix - 0.5 && r.bottom < topFix; // 위쪽 변이 보이는지
  // 가려진 중심점
  const cx = Math.min(Math.max((Math.max(r.left, 0) + Math.min(r.right, vw)) / 2, 0), vw - 1);
  const top = Math.max(r.top, topFix);
  const bot = Math.min(r.bottom, botFix);
  const cy = (top + bot) / 2;
  let centerOk = true;
  if (bot - top > 2) {
    const el = document.elementFromPoint(cx, Math.min(Math.max(cy, 0), vh - 1));
    centerOk = !!el && (a === el || a.contains(el) || el.contains(a));
  }
  return {
    id: a.getAttribute('data-testid') || a.getAttribute('aria-label') || (a.textContent || '').trim().slice(0, 12) || a.tagName,
    qi: a.getAttribute('data-qa-i'),
    t: Math.round(box.t),
    b: Math.round(box.b),
    h: Math.round(r.height),
    overlap: Math.round(overlap),
    hit,
    outside,
    centerOk,
    tall,
    nFixed: fixed.length,
    fixedList: fixed.map((f) => `${f.el}:${Math.round(f.t)}~${Math.round(f.b)}`),
  };
};

const browser = await launch();
const jobs = [];
for (const st of states) for (const vp of VPS) for (const font of fonts) {
  if (vp.name === '320x256-zoom400' && font === 200) continue; // QA-003-M2 보완 마스터 확인 2회차 4: 800% 확대 상당은 CM10 제외
  jobs.push({ st, vp, font });
}
let idx = 0;
let done = 0;
async function worker() {
  while (idx < jobs.length) {
    const j = jobs[idx++];
    const rec = { state: j.st, vp: j.vp.name, font: j.font, fwd: [], bwd: [], issues: [], interactive: 0, reached: 0, missing: [] };
    try {
      const { ctx, page } = await openState(browser, j.st, { vp: j.vp, font: j.font });
      if (process.env.MUT_CSS) {
        await page.addStyleTag({ content: process.env.MUT_CSS });
        await sleep(250);
      }
      const inter = await page.evaluate(TAG_INTERACTIVE);
      rec.interactive = inter.length;
      await page.evaluate(() => {
        window.scrollTo(0, 0);
        if (document.activeElement && document.activeElement !== document.body) document.activeElement.blur();
      });
      await sleep(100);
      const reached = new Set();
      const seen = [];
      // 앞으로 한 바퀴
      for (let i = 0; i < inter.length + 6; i++) {
        await page.keyboard.press('Tab');
        await sleep(70);
        const m = await page.evaluate(FOCUS_MEASURE);
        if (m.none) break;
        rec.fwd.push(m.id);
        rec.nFixedMin = Math.min(rec.nFixedMin ?? 99, m.nFixed);
        rec.nFixedMax = Math.max(rec.nFixedMax ?? 0, m.nFixed);
        rec.fixedSeen = [...new Set([...(rec.fixedSeen ?? []), ...m.fixedList.map((f) => f.split(':')[0])])];
        if (m.qi !== null) reached.add(Number(m.qi));
        if (m.overlap > 0 || m.outside || !m.centerOk) rec.issues.push({ dir: 'fwd', ...m });
        seen.push(m.qi);
        if (seen.length > 1 && m.qi === seen[0]) break;
      }
      // 뒤로 한 바퀴
      for (let i = 0; i < inter.length + 6; i++) {
        await page.keyboard.press('Shift+Tab');
        await sleep(70);
        const m = await page.evaluate(FOCUS_MEASURE);
        if (m.none) break;
        rec.bwd.push(m.id);
        if (m.qi !== null) reached.add(Number(m.qi));
        if (m.overlap > 0 || m.outside || !m.centerOk) rec.issues.push({ dir: 'bwd', ...m });
      }
      rec.reached = reached.size;
      rec.missing = inter.filter((x) => !reached.has(x.i)).map((x) => x.id);
      rec.fixedList = (await page.evaluate(FOCUS_MEASURE)).fixedList ?? null;
      await ctx.close();
    } catch (e) {
      rec.err = String(e.message).slice(0, 200);
    }
    fs.appendFileSync(outFile, JSON.stringify(rec) + '\n');
    done++;
    if (done % 10 === 0) console.log(`${done}/${jobs.length}`);
  }
}
await Promise.all(Array.from({ length: workers }, worker));
await browser.close();
console.log('DONE', done);
