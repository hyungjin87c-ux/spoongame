// QA-003 M4 레이아웃 감사: 11 뷰포트 × 글자 100·150·200% × 상태 10 — 가로 넘침(CM11)·낱말 끊김(QM3-1)·h1 한 줄(QM3-2)·고정 요소 해제(CM10·QM2-12·head-released)·터치 대상 크기.
// 사용: node qa/scripts/m4-audit-layout.mjs [states,comma] [fonts,comma] [workers]   결과: qa/results/m4/audit-layout.jsonl (조합마다 한 줄)
import fs from 'node:fs';
import path from 'node:path';
import { launch, sleep, OUT } from './m4-lib.mjs';
import { openState, STATES, VPS } from './m4-states.mjs';
import { WB_AUDIT, H1_AUDIT } from './m3r2-wb.mjs';

const states = (process.argv[2] || STATES.join(',')).split(',');
const fonts = (process.argv[3] || '100,150,200').split(',').map(Number);
const workers = Number(process.argv[4] || 3);
const outFile = path.join(OUT, 'audit-layout.jsonl');
if (!process.env.QA_APPEND) fs.writeFileSync(outFile, '');

const MEASURE = () => {
  const vw = document.documentElement.clientWidth;
  const vh = window.innerHeight;
  const root = document.documentElement;
  const q = (s) => document.querySelector(s);
  const visible = (e) => {
    const cs = getComputedStyle(e);
    const r = e.getBoundingClientRect();
    if (cs.display === 'none' || cs.visibility === 'hidden' || r.width <= 0 || r.height <= 0) return false;
    // sr-only(1px 상자·잘림)는 제외
    if (r.width <= 1.5 && r.height <= 1.5) return false;
    return true;
  };
  // 넘침: 문서 폭 + 보이는 요소의 오른쪽 끝
  const over = [];
  for (const e of document.body.querySelectorAll('*')) {
    if (e.namespaceURI === 'http://www.w3.org/2000/svg' && e.tagName !== 'svg') continue;
    if (!visible(e)) continue;
    const r = e.getBoundingClientRect();
    // 스크롤 영역 안의 잘린 것은 제외(기록 목록 등)
    let clipped = false;
    for (let x = e.parentElement; x && x !== document.body; x = x.parentElement) {
      const cs = getComputedStyle(x);
      if (cs.overflowX !== 'visible') {
        clipped = true;
        break;
      }
    }
    if (clipped) continue;
    if (r.right > vw + 0.5 || r.left < -0.5) over.push(`${e.tagName.toLowerCase()}${e.getAttribute('data-testid') ? '[' + e.getAttribute('data-testid') + ']' : e.className && typeof e.className === 'string' ? '.' + e.className.split(' ')[0] : ''} ${Math.round(r.left)}~${Math.round(r.right)}`);
  }
  const sticky = [];
  for (const e of document.body.querySelectorAll('*')) {
    const cs = getComputedStyle(e);
    if (cs.position === 'fixed' || cs.position === 'sticky') {
      const r = e.getBoundingClientRect();
      sticky.push({ el: e.getAttribute('data-testid') || e.className.toString().split(' ')[0] || e.tagName, pos: cs.position, top: Math.round(r.top), bottom: Math.round(r.bottom), h: Math.round(r.height), vis: r.height > 0 });
    }
  }
  const head = q('[data-testid="dash-head"]');
  const ctl = q('[data-testid="controls"]');
  const touch = [];
  for (const b of document.querySelectorAll('[data-testid="controls"] button, [data-testid="tools"] button, [data-testid="tools"] a, [data-testid="exit-ask"] button')) {
    if (!visible(b)) continue;
    const r = b.getBoundingClientRect();
    touch.push({ id: b.getAttribute('data-testid') || b.textContent.trim().slice(0, 6), w: Math.round(r.width), h: Math.round(r.height) });
  }
  return {
    vw,
    vh,
    docOverflow: root.scrollWidth - root.clientWidth,
    over: over.slice(0, 6),
    htmlClass: root.className,
    head: head ? { pos: getComputedStyle(head).position, h: Math.round(head.getBoundingClientRect().height) } : null,
    ctl: ctl ? { pos: getComputedStyle(ctl).position, h: Math.round(ctl.getBoundingClientRect().height) } : null,
    sticky,
    touch,
    docH: root.scrollHeight,
    logoH: (() => {
      const l = q('header [role="img"], header svg, [data-testid="header-logo"]');
      if (!l) return null;
      const r = l.getBoundingClientRect();
      return { w: Math.round(r.width), h: Math.round(r.height) };
    })(),
  };
};

const browser = await launch();
const jobs = [];
for (const st of states) for (const vp of VPS) for (const font of fonts) jobs.push({ st, vp, font });
let idx = 0;
let done = 0;
async function worker() {
  while (idx < jobs.length) {
    const j = jobs[idx++];
    let rec = { state: j.st, vp: j.vp.name, font: j.font };
    try {
      const { ctx, page } = await openState(browser, j.st, { vp: j.vp, font: j.font });
      const m = await page.evaluate(MEASURE);
      const wb = await page.evaluate(WB_AUDIT, { intended: ['다이아몬드수저'] });
      const h1 = await page.evaluate(H1_AUDIT);
      rec = { ...rec, m, wb: { wordsN: wb.wordsN, charsN: wb.charsN, broken: wb.broken, unavoidable: wb.unavoidable, intended: wb.intended.length, cats: wb.cats }, h1 };
      await ctx.close();
    } catch (e) {
      rec.err = String(e.message).slice(0, 200);
    }
    fs.appendFileSync(outFile, JSON.stringify(rec) + '\n');
    done++;
    if (done % 20 === 0) console.log(`${done}/${jobs.length}`);
  }
}
await Promise.all(Array.from({ length: workers }, worker));
await browser.close();
console.log('DONE', done);
