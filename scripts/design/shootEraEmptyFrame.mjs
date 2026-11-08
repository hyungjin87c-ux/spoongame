/**
 * SPEC-013 T3 빈 해 종이틀·캡션 시안(docs/design/mockups/era-empty-frame.html)을 Playwright 크로미움으로 찍고 잰다 → docs/design/screens/013/ (designer 2026-11-08).
 * 실행: node scripts/design/buildEraEmptyFrameArt.mjs && node scripts/design/shootEraEmptyFrame.mjs
 *   변형 ?v=now | a | b | c × 뷰포트 360×740(터치, 글자 100%·200%) · 1280×800(마우스) · 다크 · 강제 색상. 브라우저는 이 스크립트가 띄우고 닫는다(서버 없음, file://). 외부 요청 0.
 *   잰 것: 카드(사건·빈·가림·미래)마다 창 칸(.era)·그림 상자(.era__pic)·캡션(.era__cap)·빈 종이(.era__sheet)·「예측」 칩의 상자, 캡션 글자 크기·색, 넘침(shootLogQuestion.mjs와 같은 규칙).
 *   단언: 같은 장 안에서 네 카드의 창 칸 높이·너비가 같다(완료 기준 7 — 해가 바뀌어도 칸이 흔들리지 않는다), 캡션·칩·그림 상자가 서로 겹치지 않는다(캡션 규격 ④·⑦).
 *   산출: era-empty-frame-360.png(지금 · A · B · C × 네 해, 360) · era-empty-frame-pc.png(1280, 같은 격자) · era-empty-frame-states.png(안 B — 다크 · 글자 200% · 강제 색상) · era-empty-frame-measure.json. 넘침·겹침·칸 높이 차·300 KB 초과가 있으면 목록을 찍고 종료 코드 1.
 */
import { chromium } from '@playwright/test';
import { mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const PAGE = 'file:///' + ROOT.replace(/\\/g, '/') + 'docs/design/mockups/era-empty-frame.html';
const OUT = ROOT + 'docs/design/screens/013/';
const TMP = ROOT + '.taste-skill/013/era-empty-frame/tmp/';
mkdirSync(OUT, { recursive: true });
mkdirSync(TMP, { recursive: true });

const browser = await chromium.launch();
const problems = [];
const kb = (f) => Math.round(statSync(f).size / 1024);

async function open({ v, view, mobile = false, text, dark = false, forced = false, extra = '' }) {
  const ctx = await browser.newContext({ viewport: view, deviceScaleFactor: 1, isMobile: mobile, hasTouch: mobile, colorScheme: dark ? 'dark' : 'light', forcedColors: forced ? 'active' : 'none' });
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
      if (el.scrollWidth > el.clientWidth + 1 && !el.classList.contains('era__pic')) out.push(`${el.tagName.toLowerCase()}.${[...el.classList].join('.')} ${el.scrollWidth} > ${el.clientWidth}`);
      if (r.left < -0.5 || r.right > de.clientWidth + 0.5) out.push(`${el.tagName.toLowerCase()}.${[...el.classList].join('.')} 화면 밖 ${Math.round(r.left)}~${Math.round(r.right)}`);
    }
    return out;
  });
const measure = (page) =>
  page.evaluate(() => {
    const box = (el) => {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) };
    };
    const cards = [...document.querySelectorAll('[data-row]')].map((c) => {
      const era = c.querySelector('.era');
      const cap = c.querySelector('.era__cap');
      const ccs = cap ? getComputedStyle(cap) : null;
      return {
        row: c.dataset.row,
        era: box(era),
        pic: box(c.querySelector('.era__pic')),
        sheet: box(c.querySelector('.era__sheet')),
        fc: box(c.querySelector('.era__fc')),
        cap: cap ? { ...box(cap), text: cap.textContent, fontSize: ccs.fontSize, color: ccs.color, weight: ccs.fontWeight, lines: Math.round((cap.getBoundingClientRect().height - parseFloat(ccs.paddingTop) - parseFloat(ccs.paddingBottom)) / parseFloat(ccs.lineHeight)) } : null,
      };
    });
    return { vw: innerWidth, cardW: Math.round(document.querySelector('.card').getBoundingClientRect().width), cards };
  });
function assertFrames(name, m) {
  const hs = new Set(m.cards.map((c) => c.era.h));
  const ws = new Set(m.cards.map((c) => c.era.w));
  if (hs.size > 1 || ws.size > 1) problems.push(`${name}: 창 칸 크기가 카드마다 다르다 ${m.cards.map((c) => `${c.row} ${c.era.w}×${c.era.h}`).join(' · ')}`);
  const overlap = (a, b) => a && b && a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
  for (const c of m.cards) {
    if (overlap(c.cap, c.fc)) problems.push(`${name}: ${c.row} 캡션과 「예측」 칩이 겹친다`);
    if (c.cap && c.pic && m.vw <= 480 && overlap(c.cap, c.pic)) problems.push(`${name}: ${c.row} 띠에서 캡션이 그림을 가린다`);
    if (c.cap && (c.cap.x < c.era.x || c.cap.x + c.cap.w > c.era.x + c.era.w + 1 || c.cap.y + c.cap.h > c.era.y + c.era.h + 1)) problems.push(`${name}: ${c.row} 캡션이 창 칸 밖으로 나간다`);
  }
}

const result = {};
const shots = {};
async function shoot(name, opts) {
  const { ctx, page } = await open(opts);
  const over = await overflowReport(page);
  if (over.length > 0) problems.push(`${name}: ${over.join(' | ')}`);
  const m = await measure(page);
  result[name] = m;
  assertFrames(name, m);
  console.log(name, JSON.stringify(m.cards.map((c) => ({ row: c.row, era: `${c.era.w}×${c.era.h}`, pic: c.pic && `${c.pic.w}×${c.pic.h}`, cap: c.cap && `${c.cap.w}×${c.cap.h}/${c.cap.lines}줄`, fc: c.fc && `${c.fc.w}×${c.fc.h}` }))));
  shots[name] = {};
  for (const c of m.cards) {
    const f = `${TMP}${name}-${c.row}.png`;
    await page.locator(`[data-row="${c.row}"] .scene`).screenshot({ path: f });
    shots[name][c.row] = f;
  }
  const full = `${TMP}${name}-page.png`;
  await page.screenshot({ path: full, fullPage: true });
  shots[name].page = full;
  await ctx.close();
}

const M = { width: 360, height: 740 };
const PC = { width: 1280, height: 800 };
for (const v of ['now', 'a', 'b', 'c']) await shoot(`360-${v}`, { v, view: M, mobile: true });
for (const v of ['now', 'a', 'b', 'c']) await shoot(`1280-${v}`, { v, view: PC });
await shoot('360-b-dark', { v: 'b', view: M, mobile: true, dark: true });
await shoot('360-c-dark', { v: 'c', view: M, mobile: true, dark: true });
await shoot('360-b-text200', { v: 'b', view: M, mobile: true, text: 200 });
await shoot('360-b-forced', { v: 'b', view: M, mobile: true, forced: true });
await shoot('360-c-forced', { v: 'c', view: M, mobile: true, forced: true });
await shoot('1280-b-dark', { v: 'b', view: PC, dark: true });
await shoot('1280-b-text200', { v: 'b', view: PC, text: 200 });
writeFileSync(`${OUT}era-empty-frame-measure.json`, JSON.stringify(result, null, 2));

// ---------- 합성(외부 요청 0): 요소 샷을 한 페이지에 모아 다시 찍는다 ----------
const img = (f) => `data:image/png;base64,${readFileSync(f).toString('base64')}`;
async function compose(file, html, width) {
  const ctx = await browser.newContext({ viewport: { width, height: 800 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  await page.setContent(`<!doctype html><html lang="ko"><meta charset="utf-8"><style>body{margin:0;padding:12px;background:#e9e4d8;font:12px/1.4 'Malgun Gothic',sans-serif;color:#23211d}table{border-collapse:separate;border-spacing:12px 8px}th{font-weight:700;text-align:left;vertical-align:bottom;max-width:360px}th.row{text-align:right;vertical-align:middle;max-width:120px}td{vertical-align:top}img{display:block;border:1px solid #857d6b}figure{margin:0}figcaption{margin:0 0 6px;font-weight:700;max-width:360px}.row{display:flex;gap:16px;align-items:flex-start;flex-wrap:wrap}</style><body>${html}</body></html>`);
  await page.waitForTimeout(100);
  await page.screenshot({ path: file, fullPage: true });
  await ctx.close();
  const size = kb(file);
  if (size > 300) problems.push(`${file}: ${size} KB > 300 KB`);
  console.log('saved', file.replace(ROOT, ''), `${size} KB`);
}
const VN = { now: '지금 — 점무늬 빈 네모', a: '안 A 「고른 면」', b: '안 B 「빈 종이」 (추천)', c: '안 C 「사진 모서리」' };
const RN = { event: '1988 사건 해 · 캡션 「서울 올림픽」', empty: '1989 빈 해 · 캡션 없음', veil: '1980 가리기 켠 해 · 「가려 둔 장면」', future: '2035 미래 · 「예측」 칩 + 캡션' };
const grid = (prefix, w) => {
  const vs = ['now', 'a', 'b', 'c'];
  const rows = ['event', 'empty', 'veil', 'future'];
  const m = result[`${prefix}-b`];
  return `<table><tr><th></th>${vs.map((v) => `<th>${VN[v]}<br><span style="font-weight:400">창 칸 ${result[`${prefix}-${v}`].cards[0].era.w}×${result[`${prefix}-${v}`].cards[0].era.h}px</span></th>`).join('')}</tr>` +
    rows.map((r) => `<tr><th class="row">${RN[r]}</th>${vs.map((v) => `<td><img src="${img(shots[`${prefix}-${v}`][r])}" width="${w}"></td>`).join('')}</tr>`).join('') +
    `</table><p>그림 카드 폭 ${m.cardW}px · 사건 해 그림 상자 ${m.cards[0].pic.w}×${m.cards[0].pic.h}px · 캡션 ${m.cards[0].cap.fontSize} ${m.cards[0].cap.color}</p>`;
};
await compose(`${OUT}era-empty-frame-360.png`, `<p><b>360×740 · 그림 카드(집 + 시대의 창 띠)</b> — 열: 지금 · 세 안, 줄: 네 해. 띠 80px, 그림 100×80, 캡션은 그림 옆</p>${grid('360', 328)}`, 1500);
await compose(`${OUT}era-empty-frame-pc.png`, `<p><b>1280×800 · 가운데 열 536px</b> — 열: 지금 · 세 안, 줄: 네 해. 창 칸 175×140, 캡션은 그림 아래(그림 상자 175×118)</p>${grid('1280', 400)}`, 1800);
const col = (name, r, cap) => `<figure><figcaption>${cap}</figcaption><img src="${img(shots[name][r])}" width="328"></figure>`;
await compose(
  `${OUT}era-empty-frame-states.png`,
  `<p><b>안 B · 안 C 상태</b> — 다크 · 글자 200% · 강제 색상(360) · PC 다크</p><div class="row">
    ${col('360-b-dark', 'event', '360 · B · 다크 · 사건 해')}${col('360-b-dark', 'empty', '360 · B · 다크 · 빈 해')}${col('360-c-dark', 'empty', '360 · C · 다크 · 빈 해')}${col('360-b-dark', 'veil', '360 · B · 다크 · 가린 해')}
  </div><div class="row">
    ${col('360-b-text200', 'event', '360 · B · 글자 200% · 사건 해(캡션 두 줄)')}${col('360-b-text200', 'future', '360 · B · 글자 200% · 미래(칩 + 캡션)')}${col('360-b-forced', 'empty', '360 · B · 강제 색상 · 빈 해')}${col('360-c-forced', 'veil', '360 · C · 강제 색상 · 가린 해')}
  </div><div class="row">
    <figure><figcaption>1280 · B · 다크 · 사건 해</figcaption><img src="${img(shots['1280-b-dark'].event)}" width="400"></figure>
    <figure><figcaption>1280 · B · 다크 · 빈 해</figcaption><img src="${img(shots['1280-b-dark'].empty)}" width="400"></figure>
    <figure><figcaption>1280 · B · 글자 200% · 미래(캡션 두 줄 → 그림 상자 ${result['1280-b-text200'].cards[3].pic.w}×${result['1280-b-text200'].cards[3].pic.h})</figcaption><img src="${img(shots['1280-b-text200'].future)}" width="400"></figure>
  </div>`,
  1420,
);

await browser.close();
if (problems.length > 0) {
  console.error('문제:\n' + problems.join('\n'));
  process.exit(1);
}
console.log('완료 — 넘침 0, 겹침 0, 칸 크기 같음, 300 KB 초과 0');
