/**
 * SPEC-009 집과 가족 그림 시안을 Playwright 크로미움으로 찍고 잰다 → docs/design/screens/009/ (designer 2026-10-27).
 * 실행: node scripts/design/shootFamily.mjs            ← FM2d 정본 캡처 3장 + 검사 (시대의 창은 그림만 · 인생 기록의 「시대의 창」 줄)
 *       node scripts/design/shootFamily.mjs fm2c       ← (기록) FM2c 캡처 — 칸에 문장이 있던 시안. 커밋 e381f3e의 산출물을 그대로 둔다
 *       node scripts/design/shootFamily.mjs preview    ← 작업 중 미리보기(.taste-skill/009/preview/, 저장소에 올리지 않는다)
 *       node scripts/design/shootFamily.mjs fm2        ← FM2 게이트 캡처 6장(그림체 둘 — 먼저 buildFamilyMockups.mjs --with-s2)
 *       node scripts/design/shootFamily.mjs fm2b       ← (기록) FM2b 캡처 — 생성기가 매체 층을 뺀 뒤에는 다시 만들지 않는다(커밋 9f9d2da의 산출물을 그대로 둔다)
 *   시안은 먼저 `node scripts/design/buildFamilyMockups.mjs`로 만든다. 브라우저는 이 스크립트가 띄우고 닫는다(서버 없음, file://).
 * FM2d 캡처(3장, ≤ 300 KB):
 *   fm2d-dash-1280.png — 1280×800 대시보드(장면 A를 1988년에 · 시대의 창 = 성화대 그림만) · 시대의 창에서 Enter → 인생 기록 「시대의 창」 줄로 이동·강조된 상태
 *   fm2d-dash-360.png — 360×740 라이트(띠 80px) · 다크(장면 E) · 누른 뒤(시대 줄 강조)
 *   fm2d-log-era-row.png — 인생 기록 시대 줄 확대 ×2: 강조 중 · 평소 · 다크 · 강제 색상 · 움직임 줄이기
 * 검사: 가로 넘침 0(1280·360·320 글자 200%·1920·1280×600), 집 그림 ≤ 25vh, 카드 순서, 접기(둘 다 사라짐) 키보드, 대체 글(연도 포함), 시대의 창 = 그림만 + 링크 1(초점 정지점·title), Enter → #log-y1988 :target·초점·스크롤 영역 안·2.4초 뒤 강조 해제, 시대 줄 표지·문장 대비 ≥ 4.5(라이트·다크), 움직임 줄이기면 애니메이션 없음, 다크·강제 색상, 외부 요청 0.
 */
import { chromium } from '@playwright/test';
import { mkdirSync, readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const BASE = 'file:///' + ROOT.replace(/\\/g, '/') + 'docs/design/mockups/family/';
const MODE = process.argv[2] || 'fm2d';
const PREVIEW = MODE === 'preview';
if (MODE === 'fm2b' || MODE === 'fm2c') { console.log(`${MODE} 캡처는 기록입니다 — 시안이 바뀐 뒤에는 다시 만들지 않습니다(docs/design/screens/009/${MODE}-*.png 그대로).`); process.exit(0); }
const OUT = PREVIEW ? ROOT + '.taste-skill/009/preview/' : ROOT + 'docs/design/screens/009/';
const TMP = ROOT + '.taste-skill/009/shoot/';
mkdirSync(OUT, { recursive: true });
mkdirSync(TMP, { recursive: true });
const browser = await chromium.launch();
const problems = [];
const notes = [];
const external = new Set();
const kb = (f) => Math.round(statSync(f).size / 1024);

async function open({ file, q = '', view, dpr = 1, dark = false, forced = false, text, coarse = false, reduced = false }) {
  const ctx = await browser.newContext({ viewport: view, deviceScaleFactor: dpr, colorScheme: dark ? 'dark' : 'light', forcedColors: forced ? 'active' : 'none', hasTouch: coarse, reducedMotion: reduced ? 'reduce' : 'no-preference' });
  const page = await ctx.newPage();
  page.on('request', (r) => { if (!r.url().startsWith('file:')) external.add(r.url()); });
  if (coarse) {
    const cdp = await ctx.newCDPSession(page);
    await cdp.send('Emulation.setEmulatedMedia', { features: [{ name: 'pointer', value: 'coarse' }, { name: 'hover', value: 'none' }] });
  }
  await page.goto(`${BASE}${file}.html${q ? `?${q}` : ''}`);
  if (text !== undefined) await page.addStyleTag({ content: `html { font-size: ${text}% !important; }` });
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
      if (el.closest('svg') || el.closest('template') || el.classList.contains('sr-only') || el.closest('.sr-only') || el.classList.contains('fit-pair__probe')) continue;
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.display === 'inline' || cs.display === 'contents' || cs.visibility === 'hidden' || cs.clip === 'rect(0px, 0px, 0px, 0px)') continue;
      if (/(auto|scroll)/.test(cs.overflowX) || /(hidden)/.test(cs.overflow)) continue;
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      if (el.scrollWidth > el.clientWidth + 1) out.push(`${el.tagName.toLowerCase()}.${[...el.classList].join('.')} ${el.scrollWidth} > ${el.clientWidth}`);
      if (r.left < -0.5 || r.right > de.clientWidth + 0.5) out.push(`${el.tagName.toLowerCase()}.${[...el.classList].join('.')} 화면 밖 ${Math.round(r.left)}~${Math.round(r.right)}`);
    }
    return out;
  });
async function check(page, name) {
  const over = await overflowReport(page);
  if (over.length > 0) problems.push(`${name}: ${over.join(' | ')}`);
}
function saved(file) {
  const size = kb(file);
  if (size > 300) problems.push(`${file}: ${size} KB > 300 KB`);
  console.log('saved', file.replace(ROOT, ''), `${size} KB`);
}
/** 요소 샷 여러 장을 한 페이지에 모아 다시 찍는다(설명 글은 시안 표식 — 외부 자원 0) */
async function composite(outFile, items, title, { row = false, width = 1120 } = {}) {
  const ctx = await browser.newContext({ viewport: { width, height: 800 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  const figs = items.map(([f, cap, w]) => `<figure${w ? ` style="width:${w}px"` : ''}><img src="data:image/png;base64,${readFileSync(f).toString('base64')}" alt=""${w ? ` style="width:${w}px"` : ''}><figcaption>${cap}</figcaption></figure>`).join('');
  await page.setContent(`<!doctype html><html lang="ko"><meta charset="utf-8"><style>body{margin:0;padding:16px;background:#f9f7f2;font:14px/1.4 system-ui,'Malgun Gothic',sans-serif;color:#23211d}h1{font-size:16px;margin:0 0 12px}main{display:flex;flex-direction:${row ? 'row' : 'column'};flex-wrap:wrap;gap:16px;align-items:flex-start}figure{margin:0;flex:none;min-width:0}img{display:block;height:auto;border:1px solid #d8d1c2}figcaption{margin-top:4px;color:#4f4a41}</style><body><h1>${title}</h1><main>${figs}</main></body></html>`);
  await page.waitForTimeout(100);
  const h = await page.evaluate(() => document.documentElement.scrollHeight);
  await page.setViewportSize({ width, height: h });
  await page.screenshot({ path: outFile, fullPage: true });
  saved(outFile);
  await ctx.close();
}
const dashMeasure = (page) =>
  page.evaluate(() => {
    const r = (sel) => { const el = document.querySelector(sel); return el ? el.getBoundingClientRect() : null; };
    const order = [...document.querySelectorAll('main.dash .card')].map((c) => ({ top: Math.round(c.getBoundingClientRect().top), left: Math.round(c.getBoundingClientRect().left), cls: c.className.split(' ').filter((x) => x !== 'card')[0] }));
    const pic = r('.scene__svg');
    const svg = document.querySelector('.scene__svg');
    const ids = (svg && svg.getAttribute('aria-labelledby')) || '';
    const alt = ids.split(/\s+/).map((id) => (document.getElementById(id) || {}).textContent || '').join(' ').trim();
    const line = document.querySelector('.scene__line');
    const lh = line ? parseFloat(getComputedStyle(line).lineHeight) : 0;
    const lines = line ? Math.round(line.getBoundingClientRect().height / lh) : 0;
    // FM2c: 연도 표 · 시대의 창 · 식구 조각 px · 초점 정지점
    const lum = (c) => { const m = c.match(/[\d.]+/g).map(Number); const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(m[0]) + 0.7152 * f(m[1]) + 0.0722 * f(m[2]); };
    const contrast = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return Math.round(((x + 0.05) / (y + 0.05)) * 100) / 100; };
    const yEl = document.querySelector('.scene__year');
    const yr = yEl && yEl.getBoundingClientRect();
    const ycs = yEl && getComputedStyle(yEl);
    const era = document.querySelector('.era');
    const er = era && era.getBoundingClientRect();
    const ep = era && era.querySelector('.era__pic') && era.querySelector('.era__pic').getBoundingClientRect();
    const ecap = era && era.querySelector('.era__cap');
    const ecs = ecap && getComputedStyle(ecap);
    const eline = era && era.querySelector('.era__line');
    const eraLines = eline ? Math.round(eline.getBoundingClientRect().height / (parseFloat(ecs.lineHeight) || 1)) : 0; // 문장(.era__line)이 차지하는 줄 수 — PC에서는 머리 글자 줄이 그 위에 하나 더 있다
    const eraName = era && (era.textContent || '').replace(/\s+/g, ' ').trim();
    const figOf = (sel) => { const g = document.querySelector(`.scene__svg [data-layer="식구"] [data-piece^="${sel}"]`); if (!g) return null; const b = g.getBoundingClientRect(); return [Math.round(b.width), Math.round(b.height)]; };
    const focusables = [...document.querySelectorAll('.scene-card a[href], .scene-card button, .scene-card summary, .scene-card [tabindex]:not([tabindex="-1"])')].filter((el) => el.getBoundingClientRect().height > 0).map((el) => (el.className && String(el.className).split(' ')[0]) || el.tagName.toLowerCase());
    const strip = r('.scene');
    return { vw: innerWidth, vh: innerHeight, picH: pic && Math.round(pic.height), picW: pic && Math.round(pic.width), picTop: pic && Math.round(pic.top), maxH: Math.round(innerHeight * 0.25), order, alt, lines, lineText: line && line.textContent, fold: (document.querySelector('.scene-card') || {}).dataset?.fold, foldName: (document.querySelector('.scene__fold') || {}).textContent,
      stripH: strip && Math.round(strip.height), year: yEl && { text: yEl.textContent, w: Math.round(yr.width), h: Math.round(yr.height), fontPx: parseFloat(ycs.fontSize), contrast: contrast(ycs.color, ycs.backgroundColor), right: Math.round(pic ? pic.right - yr.right : 0), top: Math.round(pic ? yr.top - pic.top : 0) },
      era: era && { id: era.dataset.era, hidden: era.dataset.hidden, w: Math.round(er.width), h: Math.round(er.height), picW: ep && Math.round(ep.width), picH: ep && Math.round(ep.height), capFontPx: ecs && parseFloat(ecs.fontSize), capLines: eraLines, capH: ecap && Math.round(ecap.getBoundingClientRect().height), capChars: (era.querySelector('.era__line') || {}).textContent?.length, name: eraName, href: era.getAttribute('href'), capContrast: ecs && contrast(ecs.color, getComputedStyle(era).backgroundColor) },
      fig: { adult: figOf('fig-young-m') || figOf('fig-young-f'), child: figOf('fig-child'), toddler: figOf('fig-toddler') }, focusables, eraLinkTarget: !!document.querySelector((era && era.getAttribute('href')) || '#nope') };
  });
const SCENE_CAP = {
  a: '장면 A · 1975년 서울 성북구 · 단독주택 셋방 · 6명 · 마당 개 · 흑백 텔레비전(창 너머)',
  b: '장면 B · 2005년 경기 안양시 동안구 · 아파트 · 3명 · 집 안 고양이 · 컬러 텔레비전(창 너머)',
  c: '장면 C · 1955년 전남 고흥군 · 초가 단독주택 3세대 · 7명(나는 업힌 아기) · 마당 개 · 라디오(마루)',
  d: '장면 D · 2015년 서울 관악구 · 다세대주택 · 3명 · 집 안 개 · 벽걸이 텔레비전(창 너머)',
  e: '장면 E(한계) · 1968년 대구 중구 · 기와 단독주택 · 8명 · 마당 개 + 마루 고양이 · 라디오(마루)',
};

if (MODE === 'fm2') {
  // ---------- FM2 게이트 기록(그림체 둘 — compare.html은 --with-s2 빌드에서만 갱신) ----------
  for (const s of ['s1', 's2']) {
    for (const k of ['a', 'b']) {
      const items = [];
      for (const [label, q, opt, w] of [['라이트 · 520px(PC 가운데 열)', 'w=520', {}, 520], ['다크', 'w=520&theme=dark', { dark: true }, 520], ['라이트 · 328px(휴대폰 360 카드 폭)', 'w=328', { dpr: 2 }, 328]]) {
        const { ctx, page } = await open({ file: 'compare', q, view: { width: 1120, height: 900 }, ...opt });
        await check(page, `compare ${s}${k} ${label}`);
        const f = `${TMP}${s}-${k}-${w}${opt.dark ? '-dark' : ''}.png`;
        await page.locator(`.cmp__fig[data-style="${s}"][data-scene="${k}"]`).screenshot({ path: f });
        items.push([f, label, w]);
        await ctx.close();
      }
      const name = { s1: '그림체 1 · 종이 오림', s2: '그림체 2 · 굵은 선 그림책' }[s];
      await composite(`${OUT}fm2-${s}-scene-${k}.png`, items, `${name} — ${SCENE_CAP[k]} (시안 · 가짜 이름·나이)`, { row: true, width: 1120 });
    }
  }
} else {
  // ================= FM2d — 시대의 창은 그림만 · 인생 기록의 시대 줄 =================
  const rowMeasure = (page) =>
    page.evaluate(() => {
      const lum = (c) => { const m = c.match(/[\d.]+/g).map(Number); const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(m[0]) + 0.7152 * f(m[1]) + 0.0722 * f(m[2]); };
      const contrast = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return Math.round(((x + 0.05) / (y + 0.05)) * 100) / 100; };
      const row = document.querySelector('#log-y1988');
      if (!row) return null;
      const cs = getComputedStyle(row);
      const card = getComputedStyle(document.querySelector('#life-log'));
      const bg = cs.backgroundColor === 'rgba(0, 0, 0, 0)' ? card.backgroundColor : cs.backgroundColor;
      const tl = getComputedStyle(row.querySelector('.log__tl'));
      const sent = getComputedStyle(row.querySelector('.log__sent'));
      const r = row.getBoundingClientRect();
      const list = document.querySelector('.log__list').getBoundingClientRect();
      return { h: Math.round(r.height), border: `${cs.borderLeftWidth} ${cs.borderLeftStyle} ${cs.borderLeftColor}`, label: tl.color, labelContrast: contrast(tl.color, bg), sentContrast: contrast(sent.color, bg), bg, targeted: row.matches(':target'), focused: document.activeElement === row, inView: r.top >= list.top - 1 && r.bottom <= list.bottom + 1, anim: cs.animationName, hash: location.hash, eraTitle: (document.querySelector('.era') || {}).getAttribute?.('title') };
    });
  const shot = async (label, q, view, opt, file, { full = false, pre } = {}) => {
    const { ctx, page } = await open({ file: 'dashboard-family', q, view, ...opt });
    if (pre) await pre(page);
    await check(page, label);
    const m = await dashMeasure(page);
    const rm = await rowMeasure(page);
    if (m.picH !== null && m.picH > m.maxH) problems.push(`${label} 집 그림 높이 ${m.picH} > 25vh ${m.maxH}`);
    if (m.lines > 2 && view.width >= 360) problems.push(`${label} 한 줄 ${m.lines}줄`);
    if (m.year && m.year.contrast < 4.5 && !opt.forced) problems.push(`${label} 연도 표 대비 ${m.year.contrast}`);
    if (m.era && !m.eraLinkTarget) problems.push(`${label} 시대의 창 링크 대상 없음 ${m.era.href}`);
    if (rm && !opt.forced && rm.labelContrast < 4.5) problems.push(`${label} 시대 줄 표지 대비 ${rm.labelContrast}`);
    if (rm && !opt.forced && rm.sentContrast < 4.5) problems.push(`${label} 시대 줄 문장 대비 ${rm.sentContrast}`);
    const center = m.order.find((x) => x.cls === 'scene-card');
    const ord = m.order.filter((o) => center && o.left === center.left).sort((x, y) => x.top - y.top).map((o) => o.cls).join(' → ');
    notes.push(`${label}: 집 ${m.picW}×${m.picH}(25vh ${m.maxH}) 띠 ${m.stripH} · 연도 「${m.year?.text}」 대비 ${m.year?.contrast} · 창 ${m.era?.id ?? '-'} ${m.era?.w}×${m.era?.h} 그림 ${m.era?.picW}×${m.era?.picH} title 「${rm?.eraTitle ?? m.era?.name}」 · 식구 어른 ${m.fig.adult?.join('×')} · 한 줄 ${m.lines}줄 · 초점 ${m.focusables.join(', ')} · 순서 ${ord}${rm ? ` · 시대 줄 ${rm.h}px 선 ${rm.border} 표지 대비 ${rm.labelContrast} 문장 대비 ${rm.sentContrast} target ${rm.targeted} focus ${rm.focused} 보임 ${rm.inView} anim ${rm.anim} bg ${rm.bg}` : ''}`);
    if (file) {
      if (full) {
        if (!/target=1/.test(q)) { await page.evaluate(() => { const el = document.querySelector('.scene-card'); const head = document.querySelector('.dash-head'); const h = head ? head.getBoundingClientRect().height : 0; window.scrollBy(0, el.getBoundingClientRect().top - h - 8); }); await page.waitForTimeout(150); }
        await page.screenshot({ path: file });
      } else {
        await page.evaluate(() => { const el = document.querySelector('.scene-card'); const head = document.querySelector('.dash-head'); const h = head ? head.getBoundingClientRect().height : 0; window.scrollBy(0, el.getBoundingClientRect().top - h - 8); });
        await page.waitForTimeout(150);
        await page.locator('.scene-card').screenshot({ path: file });
      }
    }
    await ctx.close();
    return { m, rm };
  };
  // ---------- ① 1280×800 대시보드: 장면 A @ 1988 · 시대의 창(그림만) → Enter → 인생 기록 「시대의 창」 줄로 이동·강조 ----------
  {
    const { ctx, page } = await open({ file: 'dashboard-family', q: 'scene=a&era=stadium&decision=fold', view: { width: 1280, height: 800 } });
    await check(page, 'fm2d-dash-1280');
    const m = await dashMeasure(page);
    if (m.focusables.filter((f) => f === 'era').length !== 1) problems.push('시대의 창 초점 정지점이 1개가 아님');
    if (m.era.w !== m.era.picW || m.era.h !== m.era.picH) problems.push(`시대의 창에 그림 말고 다른 것이 있음 ${m.era.w}×${m.era.h} vs 그림 ${m.era.picW}×${m.era.picH}`);
    notes.push(`dash-a1988-1280(전): 창 ${m.era.w}×${m.era.h} = 그림 ${m.era.picW}×${m.era.picH} · 접근 이름 「${m.era.name}」 · 대체 글 「${m.alt}」`);
    // 접기 왕복
    await page.focus('.scene__fold'); await page.keyboard.press('Enter');
    const folded = await page.evaluate(() => ({ fold: document.querySelector('.scene-card').dataset.fold, strip: getComputedStyle(document.querySelector('.scene')).display, era: document.querySelector('.era').getBoundingClientRect().height }));
    await page.keyboard.press('Enter');
    if (folded.fold !== 'true' || folded.strip !== 'none' || folded.era !== 0) problems.push(`접기 동작: ${JSON.stringify(folded)}`);
    // 시대의 창 Enter → 시대 줄
    await page.focus('.era'); await page.keyboard.press('Enter');
    await page.waitForTimeout(250);
    const rm = await rowMeasure(page);
    if (!rm || rm.hash !== '#log-y1988' || !rm.targeted) problems.push(`시대의 창 링크 → 시대 줄 실패 ${JSON.stringify(rm)}`);
    if (rm && !rm.inView) problems.push('시대 줄이 인생 기록 스크롤 영역 밖');
    if (rm && rm.anim !== 'era-flash') problems.push(`시대 줄 강조 애니메이션 없음(${rm.anim})`);
    // 캡처: 그림 카드와 시대 줄이 한 화면에 — 창을 눌러 안쪽 목록이 줄로 스크롤된 상태에서 창만 맨 위로(줄이 목록 머리에 오게)
    await page.evaluate(() => { const row = document.querySelector('#log-y1988'); const list = document.querySelector('.log__list'); list.scrollTop = row.offsetTop - list.offsetTop; window.scrollTo(0, 0); });
    await page.waitForTimeout(120);
    notes.push(`dash-a1988-1280(후): 시대 줄 ${rm.h}px 선 ${rm.border} 표지 대비 ${rm.labelContrast} 문장 대비 ${rm.sentContrast} 강조면 ${rm.bg} target ${rm.targeted} 초점 ${rm.focused} 보임 ${rm.inView} anim ${rm.anim}`);
    await page.screenshot({ path: `${OUT}fm2d-dash-1280.png` });
    saved(`${OUT}fm2d-dash-1280.png`);
    // 강조가 끝난 뒤(2.4s) 면이 사라지는지
    await page.waitForTimeout(2600);
    const after = await rowMeasure(page);
    if (after.bg === rm.bg) problems.push('시대 줄 강조가 사라지지 않음');
    notes.push(`dash-a1988-1280(2.6s 뒤): bg ${after.bg}`);
    await ctx.close();
  }
  // ---------- ② 360×740: 라이트(장면 A @ 1988) · 다크(장면 E 1968 연) ----------
  {
    const items = [];
    const f1 = `${TMP}fm2d-360.png`;
    const r1 = await shot('dash-a1988-360', 'scene=a&era=stadium', { width: 360, height: 740 }, { dpr: 2, coarse: true }, f1, { full: true });
    items.push([f1, `라이트 — 집 ${r1.m.picW}×${r1.m.picH}(25vh ${r1.m.maxH}) · 창 띠 ${r1.m.era.w}×${r1.m.era.h}(그림 ${r1.m.era.picW}×${r1.m.era.picH}) · 띠 합계 ${r1.m.stripH}px · 한 줄 ${r1.m.lines}줄`, 360]);
    const f2 = `${TMP}fm2d-360-dark.png`;
    const r2 = await shot('dash-dark-360-e', 'scene=e&theme=dark', { width: 360, height: 740 }, { dark: true, dpr: 2 }, f2, { full: true });
    items.push([f2, `다크 — 한계 장면 E · 창 = 생활 장면(연) · 연도 표 대비 ${r2.m.year.contrast}`, 360]);
    const f3 = `${TMP}fm2d-360-target.png`;
    const r3 = await shot('dash-a1988-360-target', 'scene=a&era=stadium&target=1', { width: 360, height: 740 }, { dpr: 2 }, f3, { full: true });
    items.push([f3, `시대의 창을 누른 뒤 — 인생 기록의 「시대의 창」 줄로 이동·강조(표지 대비 ${r3.rm?.labelContrast})`, 360]);
    await composite(`${OUT}fm2d-dash-360.png`, items, 'FM2d — 360×740 휴대폰 · 시대의 창은 그림만(띠 80px) · 누르면 인생 기록의 시대 줄로 (시안 · 가짜 이름·나이 · 표본은 승인 전)', { row: true, width: 1120 });
  }
  // ---------- ③ 인생 기록 「시대의 창」 줄 확대: 라이트(강조 중) · 다크 · 강제 색상 · 움직임 줄이기(강조만) ----------
  {
    const items = [];
    for (const [label, q, opt, cap] of [
      ['row-light', 'scene=a&era=stadium&decision=fold&target=1', {}, '라이트 · 시대의 창을 누른 직후(면 --c-era-soft 강조, 2.4초 뒤 사라짐)'],
      ['row-light-rest', 'scene=a&era=stadium&decision=fold', {}, '라이트 · 평소(5px 겹선 --c-era + 표지 「시대의 창」 + 창 아이콘 + 본문 문장)'],
      ['row-dark', 'scene=a&era=stadium&theme=dark&decision=fold&target=1', { dark: true }, '다크 · 누른 직후'],
      ['row-forced', 'scene=a&era=stadium&decision=fold&target=1', { forced: true }, '강제 색상 · 누른 직후(겹선 CanvasText + Highlight 테두리)'],
      ['row-reduce', 'scene=a&era=stadium&decision=fold&target=1&motion=reduce', { reduced: true }, '움직임 줄이기 · 애니메이션 없이 면만(강조만)'],
    ]) {
      const { ctx, page } = await open({ file: 'dashboard-family', q, view: { width: 1280, height: 800 }, dpr: 2, ...opt });
      const rm = await rowMeasure(page);
      await page.evaluate(() => { document.querySelector('#log-y1988').scrollIntoView({ block: 'center' }); const el = document.querySelector('#life-log'); const head = document.querySelector('.dash-head'); const h = head ? head.getBoundingClientRect().height : 0; const t = el.getBoundingClientRect().top; if (t < h) window.scrollBy(0, t - h - 8); });
      await page.waitForTimeout(120);
      const box = await page.evaluate(() => { const r = document.querySelector('#log-y1988').getBoundingClientRect(); const l = document.querySelector('.log__list').getBoundingClientRect(); return { x: l.x - 2, y: Math.max(l.y, r.y - 58), w: l.width + 4, h: Math.min(l.bottom, r.bottom + 58) - Math.max(l.y, r.y - 58) }; });
      const f = `${TMP}fm2d-${label}.png`;
      await page.screenshot({ path: f, clip: { x: box.x, y: box.y, width: box.w, height: box.h } });
      items.push([f, `${cap} — 표지 대비 ${rm.labelContrast} · 문장 대비 ${rm.sentContrast} · 선 ${rm.border}${label === 'row-reduce' ? ` · anim ${rm.anim}` : ''}`, 534]);
      if (label === 'row-reduce' && rm.anim !== 'none') problems.push(`움직임 줄이기에서 강조 애니메이션 ${rm.anim}`);
      notes.push(`${label}: 표지 ${rm.label} 대비 ${rm.labelContrast} 문장 대비 ${rm.sentContrast} 선 ${rm.border} target ${rm.targeted} anim ${rm.anim} bg ${rm.bg}`);
      await ctx.close();
    }
    await composite(`${OUT}fm2d-log-era-row.png`, items, 'FM2d — 인생 기록의 「시대의 창」 줄(data-tl="era") · 1280 가운데 열 ×2 · 연표 줄 4종 위에 다섯째 모양(겹선)·색(--c-era)·표지 글자·아이콘 (시안)', { row: true, width: 1120 });
  }
  // ---------- ④ 검사만 ----------
  for (const [label, q, view, opt] of [
    ['dash-e-1280', 'scene=e&decision=fold', { width: 1280, height: 800 }, {}],
    ['dash-decision-open-1280-a', 'scene=a&era=stadium', { width: 1280, height: 800 }, {}],
    ['dash-1920-e', 'scene=e', { width: 1920, height: 1080 }, {}],
    ['dash-1280x600-a', 'scene=a&era=stadium&decision=fold', { width: 1280, height: 600 }, {}],
    ['dash-320-text200-e-open', 'scene=e&open=1', { width: 320, height: 640 }, { text: 200 }],
    ['dash-1280-text200-a', 'scene=a&era=stadium&decision=fold&target=1', { width: 1280, height: 800 }, { text: 200 }],
    ['dash-forced-360-e', 'scene=e', { width: 360, height: 740 }, { forced: true, dpr: 2 }],
    ['dash-forced-1280-a', 'scene=a&era=stadium&decision=fold', { width: 1280, height: 800 }, { forced: true }],
    ['dash-dark-1280-a', 'scene=a&era=stadium&theme=dark&decision=fold', { width: 1280, height: 800 }, { dark: true }],
    ['dash-hide-1280-a', 'scene=a&era=ballot&hide=1&decision=fold', { width: 1280, height: 800 }, {}],
    ['dash-b-1280', 'scene=b&decision=fold', { width: 1280, height: 800 }, {}],
    ['dash-d-360-dark', 'scene=d&theme=dark', { width: 360, height: 740 }, { dark: true, dpr: 2 }],
    ['dash-fold-360-a', 'scene=a&era=stadium&fold=1', { width: 360, height: 740 }, { dpr: 2 }],
  ]) await shot(label, q, view, opt, `${TMP}${label}.png`);
  for (const [label, q, view, opt] of [['scenes-1280', '', { width: 1280, height: 800 }, {}], ['scenes-dark-1280', 'theme=dark', { width: 1280, height: 800 }, { dark: true }], ['scenes-360', '', { width: 360, height: 740 }, { dpr: 2 }]]) {
    const { ctx, page } = await open({ file: 'scenes', q, view, ...opt });
    await check(page, label);
    const n = await page.locator('#era-samples .cmp__fig').count();
    if (n !== 3) problems.push(`${label}: 시대의 창 표본 ${n}개(3 기대)`);
    await page.screenshot({ path: `${TMP}${label}.png`, fullPage: true });
    await ctx.close();
  }
}
await browser.close();

console.log('\n--- 측정 ---');
for (const n of notes) console.log(n);
if (external.size) problems.push(`외부 요청 ${[...external].join(', ')}`);
console.log('\n외부 요청', external.size);
if (problems.length) { console.log('\n--- 문제 ---'); for (const p of problems) console.log(p); process.exit(1); }
console.log('\n문제 0');
