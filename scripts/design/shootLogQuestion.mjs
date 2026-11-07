/**
 * SPEC-012 QF4 인생 기록 결정 줄의 질문 시안(docs/design/mockups/log-question.html)을 Playwright 크로미움으로 찍고 잰다 → docs/design/screens/012/ (designer 2026-11-08).
 * 실행: node scripts/design/shootLogQuestion.mjs
 *   변형 ?v=now | 1 | 2 × 뷰포트 360×740(터치, 글자 100%·200%) · 1280×800(마우스) · 다크 · 가린 줄 펼침 · 옛 저장 표본. 브라우저는 이 스크립트가 띄우고 닫는다(서버 없음, file://). 외부 요청 0.
 *   잰 것: 결정 줄(data-kind="choice", 가리지 않은 줄)마다 높이, 줄 목록(ol) 전체 높이, 제목 줄(.log__q)의 글자 크기·색, 넘침(shootControlsCompact.mjs와 같은 규칙).
 *   산출: log-question-360.png(지금 · 안 1 · 안 2 나란히, 360 위 6줄) · log-question-pc.png(1280 지금 ↔ 안 2) · log-question-states.png(안 2 — 다크 · 옛 저장 표본 · 글자 200%) · log-question-veil.png(안 2 — 가린 줄 접힘 ↔ 펼침) · log-question-measure.json. 넘침이나 300 KB 초과가 있으면 목록을 찍고 종료 코드 1.
 */
import { chromium } from '@playwright/test';
import { mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const PAGE = 'file:///' + ROOT.replace(/\\/g, '/') + 'docs/design/mockups/log-question.html';
const OUT = ROOT + 'docs/design/screens/012/';
const TMP = ROOT + '.taste-skill/012/log-question/tmp/';
mkdirSync(OUT, { recursive: true });
mkdirSync(TMP, { recursive: true });

const browser = await chromium.launch();
const problems = [];
const kb = (f) => Math.round(statSync(f).size / 1024);

async function open({ v, view, mobile = false, text, dark = false, extra = '' }) {
  const ctx = await browser.newContext({ viewport: view, deviceScaleFactor: 1, isMobile: mobile, hasTouch: mobile, colorScheme: dark ? 'dark' : 'light' });
  const page = await ctx.newPage();
  await page.goto(`${PAGE}?v=${v}${text ? `&text=${text}` : ''}${dark ? '&theme=dark' : ''}${extra}`);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(200);
  return { ctx, page };
}
const overflowReport = (page) =>
  page.evaluate(() => {
    const out = [];
    const de = document.documentElement;
    if (de.scrollWidth > de.clientWidth) out.push(`문서 가로 넘침 ${de.scrollWidth} > ${de.clientWidth}`);
    for (const el of document.querySelectorAll('body *')) {
      if (el.closest('svg') || el.closest('template') || el.classList.contains('sr-only') || el.closest('.sr-only') || el.hidden || el.closest('[hidden]')) continue;
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.display === 'inline' || cs.display === 'contents' || cs.visibility === 'hidden' || cs.clip === 'rect(0px, 0px, 0px, 0px)') continue;
      if (/(auto|scroll)/.test(cs.overflowX)) continue;
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      if (el.scrollWidth > el.clientWidth + 1) out.push(`${el.tagName.toLowerCase()}.${[...el.classList].join('.')} ${el.scrollWidth} > ${el.clientWidth}`);
      if (r.left < -0.5 || r.right > de.clientWidth + 0.5) out.push(`${el.tagName.toLowerCase()}.${[...el.classList].join('.')} 화면 밖 ${Math.round(r.left)}~${Math.round(r.right)}`);
    }
    return out;
  });
const measure = (page) =>
  page.evaluate(() => {
    const r = (el) => el.getBoundingClientRect();
    const rows = [...document.querySelectorAll('li[data-kind="choice"]:not([data-veiled])')].map((li) => ({ age: li.querySelector('.log__age').textContent, h: Math.round(r(li).height) }));
    const veiled = document.querySelector('li[data-veiled]');
    const q = document.querySelector('.log__q');
    const qcs = q ? getComputedStyle(q) : null;
    const card = document.querySelector('.card.log');
    return {
      vw: innerWidth,
      vh: innerHeight,
      cardW: Math.round(r(card).width),
      textW: Math.round(r(document.querySelector('.log__text')).width),
      olH: Math.round(r(document.getElementById('rows')).height),
      rows,
      veiledH: veiled ? Math.round(r(veiled).height) : null,
      q: qcs ? { fontSize: qcs.fontSize, lineHeight: qcs.lineHeight, color: qcs.color, weight: qcs.fontWeight } : null,
      pageH: Math.round(document.documentElement.scrollHeight),
    };
  });

const result = {};
const shots = {};
async function shoot(name, opts, { full = true, clip = null } = {}) {
  const { ctx, page } = await open(opts);
  const over = await overflowReport(page);
  if (over.length > 0) problems.push(`${name}: ${over.join(' | ')}`);
  result[name] = await measure(page);
  console.log(name, JSON.stringify(result[name]));
  const f = `${TMP}${name}.png`;
  if (clip === 'card') {
    const box = await page.locator('.card.log').boundingBox();
    await page.screenshot({ path: f, clip: { x: Math.max(0, box.x - 8), y: Math.max(0, box.y - 8), width: Math.min(opts.view.width, box.width + 16), height: box.height + 16 } });
  } else {
    await page.screenshot({ path: f, fullPage: full });
  }
  shots[name] = f;
  await ctx.close();
}

const M = { width: 360, height: 740 };
const PC = { width: 1280, height: 800 };
// 전체 10줄은 재기만 하고(측정 표), 그림은 위 6줄(본인 선택 · 시대의 창 · 본인 · 어머니가 · 시대의 창 · 부모님이)로 찍어 300 KB 안에 둔다. 아래 4줄(단계 · 시대의 창 · 흘러감 · 가린 줄)은 상태 장에 있다
for (const v of ['now', '1', '2']) await shoot(`360-${v}-all`, { v, view: M, mobile: true });
for (const v of ['now', '1', '2']) await shoot(`360-${v}`, { v, view: M, mobile: true, extra: '&rows=0-5' });
for (const v of ['now', '2']) await shoot(`1280-${v}-all`, { v, view: PC }, { clip: 'card' });
for (const v of ['now', '2']) await shoot(`1280-${v}`, { v, view: PC, extra: '&rows=0-5' }, { clip: 'card' });
await shoot('360-2-dark', { v: '2', view: M, mobile: true, dark: true, extra: '&rows=0-2' });
await shoot('360-2-text200', { v: '2', view: M, mobile: true, text: 200, extra: '&rows=0-1' });
await shoot('360-2-veil-closed', { v: '2', view: M, mobile: true, extra: '&rows=7-9' });
await shoot('360-2-veil-open', { v: '2', view: M, mobile: true, extra: '&rows=8-9&open=1' });
await shoot('360-2-old', { v: '2', view: M, mobile: true, extra: '&old=1' });
writeFileSync(`${OUT}log-question-measure.json`, JSON.stringify(result, null, 2));

// ---------- 합성(외부 요청 0): 요소 샷을 한 페이지에 모아 다시 찍는다 ----------
const img = (f) => `data:image/png;base64,${readFileSync(f).toString('base64')}`;
async function compose(file, html, width) {
  const ctx = await browser.newContext({ viewport: { width, height: 800 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  await page.setContent(`<!doctype html><html lang="ko"><meta charset="utf-8"><style>body{margin:0;padding:12px;background:#e9e4d8;font:12px/1.4 'Malgun Gothic',sans-serif;color:#23211d}.row{display:flex;gap:16px;align-items:flex-start;flex-wrap:wrap}figure{margin:0}figcaption{margin:0 0 6px;font-weight:700;max-width:360px}img{display:block;border:1px solid #857d6b}.col{display:flex;flex-direction:column;gap:14px}</style><body>${html}</body></html>`);
  await page.waitForTimeout(100);
  await page.screenshot({ path: file, fullPage: true });
  await ctx.close();
  const size = kb(file);
  if (size > 300) problems.push(`${file}: ${size} KB > 300 KB`);
  console.log('saved', file.replace(ROOT, ''), `${size} KB`);
}
const rowsCap = (name) => result[name].rows.map((x) => `${x.age} ${x.h}`).join(' · ');
await compose(
  `${OUT}log-question-360.png`,
  `<div class="row">
    <figure><figcaption>지금 — 결정 줄 높이(px) ${rowsCap('360-now-all')} · 열 줄 목록 ${result['360-now-all'].olH}</figcaption><img src="${img(shots['360-now'])}" width="360"></figure>
    <figure><figcaption>안 1 · 제목 윗줄만 — ${rowsCap('360-1-all')} · 목록 ${result['360-1-all'].olH}</figcaption><img src="${img(shots['360-1'])}" width="360"></figure>
    <figure><figcaption>안 2 · 제목 → 고른 길 → 결과(추천) — ${rowsCap('360-2-all')} · 목록 ${result['360-2-all'].olH}</figcaption><img src="${img(shots['360-2'])}" width="360"></figure>
  </div>`,
  1160,
);
await compose(
  `${OUT}log-question-pc.png`,
  `<div class="row">
    <figure><figcaption>1280 · 지금 (카드 폭 ${result['1280-now-all'].cardW}px = 3열 가운데 열) — 결정 줄 높이(px) ${rowsCap('1280-now-all')}</figcaption><img src="${img(shots['1280-now'])}" width="520"></figure>
    <figure><figcaption>1280 · 안 2 — ${rowsCap('1280-2-all')}</figcaption><img src="${img(shots['1280-2'])}" width="520"></figure>
  </div>`,
  1100,
);
await compose(
  `${OUT}log-question-states.png`,
  `<div class="row">
    <div class="col">
      <figure><figcaption>360 · 안 2 · 다크</figcaption><img src="${img(shots['360-2-dark'])}" width="360"></figure>
      <figure><figcaption>360 · 안 2 · 옛 저장(제목 없는 줄)은 지금 모양</figcaption><img src="${img(shots['360-2-old'])}" width="360"></figure>
    </div>
    <figure><figcaption>360 · 안 2 · 글자 200% (넘침 0)</figcaption><img src="${img(shots['360-2-text200'])}" width="360"></figure>
  </div>`,
  784,
);
await compose(
  `${OUT}log-question-veil.png`,
  `<div class="row">
    <figure><figcaption>360 · 안 2 · 시대의 창 · 흘러감 · 가린 줄 접힘(제목도 가려짐)</figcaption><img src="${img(shots['360-2-veil-closed'])}" width="360"></figure>
    <figure><figcaption>360 · 안 2 · 가린 줄 펼침 → 제목 · 고른 길 · 결과</figcaption><img src="${img(shots['360-2-veil-open'])}" width="360"></figure>
  </div>`,
  784,
);

await browser.close();
if (problems.length > 0) {
  console.error('문제:\n' + problems.join('\n'));
  process.exit(1);
}
console.log('완료 — 넘침 0, 300 KB 초과 0');
