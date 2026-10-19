// QA-003 M7b 색 대비: 카드(시트·접힌 띠·인라인)를 라이트·다크(시스템)·수동 다크·강제 색상(라이트·다크) 5모드에서 실제로 그린 픽셀로 읽어 글자 대비를 잰다(일반 4.5:1, 큰 글자 3:1; 강제 색상은 별도 기록).
// 사용: node qa/scripts/m7b-colors.mjs   결과: 케이스 K10 + qa/results/m7b/colors.json + 스크린샷 M7b-K10-*
import fs from 'node:fs';
import path from 'node:path';
import { launch, sleep, OUT, mkctx, shot, runCase, SHOT_DIR, SHOT_PREFIX } from './m7b-lib.mjs';
import { openCard, VPS } from './m7b-audit.mjs';

const RECTS = () => {
  const out = [];
  const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let n;
  const parseBg = (e) => {
    for (let x = e; x; x = x.parentElement) {
      const c = getComputedStyle(x).backgroundColor;
      const m = /rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?/.exec(c);
      if (m && (m[4] === undefined || Number(m[4]) > 0)) return { css: c };
    }
    return { css: 'page' };
  };
  while ((n = w.nextNode())) {
    const t = n.textContent.trim();
    if (!t) continue;
    const pe = n.parentElement;
    if (!pe || /^(SCRIPT|STYLE|NOSCRIPT)$/.test(pe.tagName)) continue;
    let hidden = false;
    for (let x = pe; x && x !== document.documentElement; x = x.parentElement) {
      const cs = getComputedStyle(x);
      if (cs.display === 'none' || (x === pe && cs.visibility === 'hidden') || x.hidden) { hidden = true; break; }
      const r = x.getBoundingClientRect();
      if (x !== document.body && (cs.overflow !== 'visible' || cs.clip !== 'auto') && (r.width <= 1.5 || r.height <= 1.5)) { hidden = true; break; }
    }
    if (hidden) continue;
    const rg = document.createRange();
    rg.selectNodeContents(n);
    const cs = getComputedStyle(pe);
    for (const r of rg.getClientRects()) {
      if (r.width < 2 || r.height < 2) continue;
      let clipped = false;
      for (let x = pe; x && x !== document.body; x = x.parentElement) {
        const c2 = getComputedStyle(x);
        if (c2.overflowX === 'visible' && c2.overflowY === 'visible') continue;
        const b = x.getBoundingClientRect();
        const cx = r.left + r.width / 2;
        const cy = r.top + r.height / 2;
        if (cx < b.left || cx > b.right || cy < b.top || cy > b.bottom) { clipped = true; break; }
      }
      if (clipped) continue;
      // 시트·스크림 뒤에 가려진 글(inert 영역)은 뺀다: 중심점이 이 글의 조상이 아닌 요소 위에 있으면 가려진 것
      const el = document.elementFromPoint(Math.min(Math.max(r.left + r.width / 2, 0), innerWidth - 1), Math.min(Math.max(r.top + r.height / 2, 0), innerHeight - 1));
      if (!el || !(pe === el || pe.contains(el) || el.contains(pe))) continue;
      const bg = parseBg(pe);
      const px = parseFloat(cs.fontSize);
      out.push({ text: t.slice(0, 24), punct: !/[가-힣A-Za-z0-9]/.test(t), x: r.left, y: r.top, w: r.width, h: r.height, fs: px, bold: parseInt(cs.fontWeight, 10) >= 700, testid: (pe.closest('[data-testid]') || {}).getAttribute ? pe.closest('[data-testid]').getAttribute('data-testid') : null, cls: typeof pe.className === 'string' ? pe.className.split(' ')[0] : '', color: cs.color, boxBg: bg.css, inCard: !!pe.closest('[data-testid="choice-panel"], [data-testid="decision-fold"]'), inCite: !!pe.closest('.cite') });
    }
  }
  return out;
};
const PIXELS = async ({ b64, dpr, rects }) => {
  const blob = await (await fetch('data:image/png;base64,' + b64)).blob();
  const bmp = await createImageBitmap(blob);
  const cv = document.createElement('canvas');
  cv.width = bmp.width;
  cv.height = bmp.height;
  const g = cv.getContext('2d', { willReadFrequently: true });
  g.drawImage(bmp, 0, 0);
  const lin = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
  const L = (c) => 0.2126 * lin(c[0]) + 0.7152 * lin(c[1]) + 0.0722 * lin(c[2]);
  const ratio = (a, b) => { const la = L(a); const lb = L(b); return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05); };
  const res = [];
  for (const r of rects) {
    const x0 = Math.max(0, Math.floor(r.x * dpr));
    const y0 = Math.max(0, Math.floor(r.y * dpr));
    const x1 = Math.min(cv.width, Math.ceil((r.x + r.w) * dpr));
    const y1 = Math.min(cv.height, Math.ceil((r.y + r.h) * dpr));
    const w = x1 - x0;
    const h = y1 - y0;
    if (w < 2 || h < 2) { res.push(null); continue; }
    const d = g.getImageData(x0, y0, w, h).data;
    const hist = new Map();
    for (let i = 0; i < d.length; i += 4) {
      const k = (d[i] << 16) | (d[i + 1] << 8) | d[i + 2];
      hist.set(k, (hist.get(k) || 0) + 1);
    }
    let bgK = 0; let bgN = -1;
    for (const [k, c] of hist) if (c > bgN) { bgN = c; bgK = k; }
    const bg = [(bgK >> 16) & 255, (bgK >> 8) & 255, bgK & 255];
    const total = w * h;
    let best = null;
    for (const [k, c] of hist) {
      if (k === bgK || c < (r.punct ? 1 : Math.max(4, total * 0.005))) continue;
      const col = [(k >> 16) & 255, (k >> 8) & 255, k & 255];
      const rr = ratio(col, bg);
      if (!best || rr > best.ratio) best = { ratio: rr, col, n: c };
    }
    res.push({ bg, ink: best ? best.col : null, ratio: best ? Math.round(best.ratio * 100) / 100 : 1, inkN: best ? best.n : 0 });
  }
  return res;
};

const MODES = [
  ['light', {}, 'system'],
  ['dark', { colorScheme: 'dark' }, 'system'],
  ['manual-dark', {}, 'dark'],
  ['forced-light', { forcedColors: 'active', colorScheme: 'light' }, 'system'],
  ['forced-dark', { forcedColors: 'active', colorScheme: 'dark' }, 'system'],
];
const CARDS = ['tutoring-present', 'sibling-past', 'grandchildren-future', 'fever-present'];
const STATES = ['sheet', 'fold', 'inline'];
const hex = (c) => (c ? '#' + c.map((v) => v.toString(16).padStart(2, '0')).join('') : null);

const browser = await launch();
const helper = await browser.newPage();
await helper.goto('about:blank');

await runCase({ id: 'K10', cat: '접근성', title: '글자 대비(렌더 픽셀): 카드 3상태(시트·접힌 띠·인라인) × 카드 4종 × 5모드(라이트·다크·수동 다크·강제 색상 둘)', steps: '360×740 터치 prod에서 카드를 연 채 화면의 모든 글자 사각형을 실제 픽셀로 읽어 글자색 대 배경색 대비를 잰다(시트는 맨 위·맨 아래 스크롤 두 번)', expected: '일반 글자 ≥ 4.5:1(큰 글자 ≥ 3:1), 강제 색상에서는 카드 안 글자 ≥ 7:1', }, async () => {
  const bad = [];
  const shots = [];
  const summary = {};
  let minCard = 99;
  let minCite = 99;
  let nRows = 0;
  for (const [mode, opts, theme] of MODES) {
    for (const card of CARDS) {
      for (const state of STATES) {
        if (card === 'fever-present' && state === 'inline' && mode !== 'dark') continue; // 표본 줄이기
        const { ctx, page } = await openCard(browser, card, state, { vp: VPS[2], hidden: true, ctxOpts: opts, theme });
        await sleep(500);
        const positions = state === 'sheet' ? ['top', 'bottom'] : [null];
        let allRows = [];
        for (const pos of positions) {
          if (pos) await page.evaluate((p) => { const s = document.querySelector('.sheet'); s.scrollTop = p === 'top' ? 0 : s.scrollHeight; }, pos);
          else if (state === 'inline') await page.evaluate(() => document.querySelector('[data-testid="choice-panel"]').scrollIntoView({ block: 'start' }));
          await sleep(400);
          const rects = await page.evaluate(RECTS);
          const png = await page.screenshot({ type: 'png' });
          const px = await helper.evaluate(PIXELS, { b64: png.toString('base64'), dpr: 2, rects });
          const rows = rects.map((r, i) => ({ ...r, px: px[i] })).filter((r) => r.px);
          allRows = allRows.concat(rows);
          if (card === 'sibling-past' && (pos === 'top' || pos === null)) {
            const name = `${SHOT_PREFIX}-K10-${mode}-${state}.png`;
            fs.writeFileSync(path.join(SHOT_DIR, name), png);
            if (state === 'sheet' || mode.startsWith('forced')) shots.push(`qa/screenshots/003/${name}`);
          }
        }
        nRows += allRows.length;
        const need = (r) => (r.fs >= 24 || (r.fs >= 18.66 && r.bold) ? 3 : 4.5);
        const fail = allRows.filter((r) => r.px.ratio < need(r) && r.inCard);
        const failAny = allRows.filter((r) => r.px.ratio < need(r));
        const cardMin = allRows.filter((r) => r.inCard).reduce((m, r) => Math.min(m, r.px.ratio), 99);
        const citeMin = allRows.filter((r) => r.inCite).reduce((m, r) => Math.min(m, r.px.ratio), 99);
        minCard = Math.min(minCard, cardMin);
        minCite = Math.min(minCite, citeMin);
        summary[`${mode}/${card}/${state}`] = { rows: allRows.length, cardMin, citeMin: citeMin === 99 ? null : citeMin, failCard: fail.length, failAny: failAny.length };
        const need7 = mode.startsWith('forced') ? allRows.filter((r) => r.inCard && r.px.ratio < 7) : [];
        if (fail.length) bad.push(`${mode}/${card}/${state}: 카드 글자 미달 ${fail.length}건 ${JSON.stringify(fail.slice(0, 3).map((r) => `${r.text}(${r.px.ratio}:1 ${hex(r.px.ink)}/${hex(r.px.bg)} ${Math.round(r.fs)}px)`))}`);
        if (need7.length) bad.push(`${mode}/${card}/${state}: 강제 색상 7:1 미달 ${need7.length}건 ${JSON.stringify(need7.slice(0, 2).map((r) => `${r.text} ${r.px.ratio}`))}`);
        await ctx.close();
      }
    }
  }
  fs.writeFileSync(path.join(OUT, 'colors.json'), JSON.stringify({ summary, minCard, minCite, nRows }, null, 1));
  return { verdict: bad.length ? 'FAIL' : 'PASS', actual: bad.length ? bad.slice(0, 4).join(' / ') + ` (총 ${bad.length})` : `5모드 × 카드 4종 × 3상태 ${Object.keys(summary).length}조합·글자 ${nRows}개 모두 통과: 카드 안 글자 최저 ${minCard}:1(인용 박스 최저 ${minCite}:1)`, shots: shots.slice(0, 6) };
});
await browser.close();
