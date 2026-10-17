// QA-003 M5 레이아웃 감사: 11 뷰포트 × 글자 100·150·200% × 상태 10 — 가로 넘침(CM11)·낱말 끊김(QM3-1)·h1 한 줄(QM3-2)·고정 요소 해제(CM10·QM2-12·head-released)·터치 대상 크기.
// 사용: node qa/scripts/m4-audit-layout.mjs [states,comma] [fonts,comma] [workers]   결과: qa/results/m5/audit-layout.jsonl (조합마다 한 줄)
import fs from 'node:fs';
import path from 'node:path';
import { launch, sleep, OUT } from './m5-lib.mjs';
import { openState, STATES, VPS } from './m5-states.mjs';
import { WB_AUDIT, H1_AUDIT } from './m3r2-wb.mjs';

const states = (process.argv[2] || STATES.join(',')).split(',');
const ERA = process.env.ERA || 'present';
const fonts = (process.argv[3] || '100,150,200').split(',').map(Number);
const workers = Number(process.argv[4] || 3);
const outFile = path.join(OUT, `audit-layout${process.env.MUT_CSS ? '-mut' : ''}-${process.env.ERA || 'present'}.jsonl`);
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

const M5_MEASURE = () => {
  const rect = (e) => e.getBoundingClientRect();
  const out = { impactOut: [], moneyClip: [], items: 0, amounts: 0, choiceW: [] };
  for (const b of document.querySelectorAll('[data-testid="choice-panel"] .choice')) {
    const br = rect(b);
    out.choiceW.push(Math.round(br.width));
    const body = b.querySelector('.choice__body');
    const bodyR = body ? rect(body) : br;
    for (const it of b.querySelectorAll('.impact__item')) {
      out.items++;
      const r = rect(it);
      if (r.left < bodyR.left - 0.5 || r.right > bodyR.right + 0.5 || r.right > br.right + 0.5) out.impactOut.push(it.getAttribute('data-key') + ' ' + Math.round(r.left) + '~' + Math.round(r.right) + ' body ' + Math.round(bodyR.left) + '~' + Math.round(bodyR.right));
      const show = it.querySelector('.impact__show');
      if (show && (show.scrollWidth > show.clientWidth + 1)) out.impactOut.push(it.getAttribute('data-key') + ' show scrollWidth ' + show.scrollWidth + '>' + show.clientWidth);
    }
  }
  for (const e of document.querySelectorAll('.assets dd, [data-testid="final-net-value"], .final-net__standing, [data-testid="final-net-none"]')) {
    out.amounts++;
    const r = rect(e);
    const card = e.closest('.card') || document.body;
    const cr = rect(card);
    if (e.scrollWidth > e.clientWidth + 1 || r.right > cr.right + 0.5 || r.left < cr.left - 0.5 || r.right > document.documentElement.clientWidth + 0.5) out.moneyClip.push((e.getAttribute('data-testid') || e.className) + ' ' + e.textContent.trim().slice(0, 20) + ' scroll ' + e.scrollWidth + '/' + e.clientWidth + ' right ' + Math.round(r.right) + ' card ' + Math.round(cr.right));
  }
  return out;
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
      const { ctx, page } = await openState(browser, j.st, { era: ERA, vp: j.vp, font: j.font });
      if (process.env.MUT_CSS) {
        await page.addStyleTag({ content: process.env.MUT_CSS });
        await sleep(250);
      }
      const m = await page.evaluate(MEASURE);
      const wb = await page.evaluate(WB_AUDIT, { intended: ['다이아몬드수저'] });
      const m5 = await page.evaluate(M5_MEASURE);
      const h1 = await page.evaluate(H1_AUDIT);
      rec = { ...rec, m5, m, wb: { wordsN: wb.wordsN, charsN: wb.charsN, broken: wb.broken, unavoidable: wb.unavoidable, intended: wb.intended.length, cats: wb.cats }, h1 };
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
