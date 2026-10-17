// QA-003 M5 렌더 픽셀 대비 감사(DS3·QM3-5): 라이트·다크(시스템)·수동 다크·강제 색상(라이트/다크) × 대시보드·엔딩·밀린·오류 화면. 화면을 그대로 찍어 글자 줄 상자의 글자색·바탕색 대비를 잰다.
// 사용: node qa/scripts/m4-audit-pixel.mjs   결과: qa/results/m5/pixel.json + 케이스 M5-K01
import fs from 'node:fs';
import path from 'node:path';
import { launch, sleep, OUT, CASES, SHOT_DIR } from './m5-lib.mjs';
import { openState } from './m5-states.mjs';

const browser = await launch();
const helper = await browser.newPage();
await helper.goto('about:blank');

const RECTS = () => {
  const out = [];
  const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let n;
  const parseBg = (e) => {
    for (let x = e; x; x = x.parentElement) {
      const c = getComputedStyle(x).backgroundColor;
      const m = /rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?/.exec(c);
      if (m && (m[4] === undefined || Number(m[4]) > 0)) return { el: x, css: c };
    }
    return { el: null, css: 'page' };
  };
  while ((n = w.nextNode())) {
    const t = n.textContent.trim();
    if (!t) continue;
    const pe = n.parentElement;
    if (!pe || /^(SCRIPT|STYLE|NOSCRIPT)$/.test(pe.tagName)) continue;
    let hidden = false;
    for (let x = pe; x && x !== document.documentElement; x = x.parentElement) {
      const cs = getComputedStyle(x);
      if (cs.display === 'none' || (x === pe && cs.visibility === 'hidden') || x.hidden || (x.tagName === 'DETAILS' && !x.open && !pe.closest('summary'))) {
        hidden = true;
        break;
      }
      const r = x.getBoundingClientRect();
      if (x !== document.body && (cs.overflow !== 'visible' || cs.clip !== 'auto') && (r.width <= 1.5 || r.height <= 1.5)) {
        hidden = true;
        break;
      }
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
        if (cx < b.left || cx > b.right || cy < b.top || cy > b.bottom) {
          clipped = true;
          break;
        }
      }
      if (clipped) continue;
      const bg = parseBg(pe);
      const px = parseFloat(cs.fontSize);
      let o = 1;
      for (let x = pe; x && x !== document.documentElement; x = x.parentElement) o *= parseFloat(getComputedStyle(x).opacity);
      const btn = pe.closest('button,[aria-disabled]');
      out.push({
        text: t.slice(0, 24),
        punct: !/[가-힣A-Za-z0-9]/.test(t),
        x: r.left,
        y: r.top,
        w: r.width,
        h: r.height,
        fs: px,
        bold: parseInt(cs.fontWeight, 10) >= 700,
        ariaHidden: !!pe.closest('[aria-hidden="true"]'),
        disabledBtn: !!(btn && btn.getAttribute('aria-disabled') === 'true'),
        unavailable: !!pe.closest('[data-unavailable="true"]'),
        testid: (pe.closest('[data-testid]') || {}).getAttribute ? pe.closest('[data-testid]').getAttribute('data-testid') : null,
        boxBg: bg.css,
        color: cs.color,
        opacity: Math.round(o * 100) / 100,
      });
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
  const lin = (v) => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  const L = (c) => 0.2126 * lin(c[0]) + 0.7152 * lin(c[1]) + 0.0722 * lin(c[2]);
  const ratio = (a, b) => {
    const la = L(a);
    const lb = L(b);
    return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
  };
  const res = [];
  for (const r of rects) {
    const x0 = Math.max(0, Math.floor(r.x * dpr));
    const y0 = Math.max(0, Math.floor(r.y * dpr));
    const x1 = Math.min(cv.width, Math.ceil((r.x + r.w) * dpr));
    const y1 = Math.min(cv.height, Math.ceil((r.y + r.h) * dpr));
    const w = x1 - x0;
    const h = y1 - y0;
    if (w < 2 || h < 2) {
      res.push(null);
      continue;
    }
    const d = g.getImageData(x0, y0, w, h).data;
    const hist = new Map();
    for (let i = 0; i < d.length; i += 4) {
      const k = (d[i] << 16) | (d[i + 1] << 8) | d[i + 2];
      hist.set(k, (hist.get(k) || 0) + 1);
    }
    let bgK = 0;
    let bgN = -1;
    for (const [k, c] of hist) if (c > bgN) ((bgN = c), (bgK = k));
    const bg = [(bgK >> 16) & 255, (bgK >> 8) & 255, bgK & 255];
    const total = w * h;
    let best = null;
    for (const [k, c] of hist) {
      if (k === bgK || c < (r.punct ? 1 : Math.max(4, total * 0.005))) continue;
      const col = [(k >> 16) & 255, (k >> 8) & 255, k & 255];
      const rr = ratio(col, bg);
      if (!best || rr > best.ratio) best = { ratio: rr, col, n: c };
    }
    res.push({ bg, ink: best ? best.col : null, ratio: best ? Math.round(best.ratio * 100) / 100 : 1, inkN: best ? best.n : 0, total });
  }
  return res;
};

const hex = (c) => (c ? '#' + c.map((v) => v.toString(16).padStart(2, '0')).join('') : null);
const MODES = [
  ['light', {}],
  ['dark', { colorScheme: 'dark' }],
  ['manual-dark', { manualDark: true }],
  ['forced-light', { forcedColors: 'active', colorScheme: 'light' }],
  ['forced-dark', { forcedColors: 'active', colorScheme: 'dark' }],
];
const ERA = process.env.ERA || 'present';
const STATES = (process.env.STATES || 'young-choice,adult-choice,adult-dash,neg-dash,extreme-neg,extreme-big,ending,ending-neg,ending-zero,ending-early').split(',');

let darkSettingsRaw = null;
{
  const { ctx, page } = await openState(browser, 'adult-dash', { era: ERA, vp: { width: 360, height: 740, touch: true } });
  await page.getByTestId('tool-dark').click();
  await sleep(400);
  darkSettingsRaw = await page.evaluate(() => localStorage.getItem('suzeo-game:settings'));
  await ctx.close();
}
const all = [];
const bad = [];
const shots = [];
let nRows = 0;
let minDisabled = 99;
let minOverall = 99;
for (const [mode, opts] of MODES) {
  for (const st of STATES) {
    const realState = st;
    const ctxOpts = { ...opts };
    delete ctxOpts.manualDark;
    const dashState = !st.startsWith('ending');
    const { ctx, page } = await openState(browser, realState, { era: ERA, vp: { width: 360, height: 740, touch: true }, ctxOpts, settingsRaw: opts.manualDark && !dashState ? darkSettingsRaw : null });
    if (opts.manualDark && dashState) {
      await page.getByTestId('tool-dark').click();
      await sleep(400);
    }
    // 입력 가드·진행 중 깜빡임을 피하려고 멈춘다(저장 원문은 이미 멈춘 상태이거나 선택지 대기)
    await sleep(700);
    const h = await page.evaluate(() => Math.ceil(Math.max(document.documentElement.scrollHeight, document.body.scrollHeight)));
    await page.setViewportSize({ width: 360, height: Math.min(h + 4, 8000) });
    await sleep(500);
    await page.evaluate(() => window.scrollTo(0, 0));
    const rects = await page.evaluate(RECTS);
    const png = await page.screenshot({ type: 'png' });
    const px = await helper.evaluate(PIXELS, { b64: png.toString('base64'), dpr: 2, rects });
    const rows = rects.map((r, i) => ({ ...r, px: px[i] })).filter((r) => r.px);
    nRows += rows.length;
    const need = (r) => (r.fs >= 24 || (r.fs >= 18.66 && r.bold) ? 3 : 4.5);
    const fail = rows.filter((r) => r.px.ratio < need(r));
    const min = rows.reduce((m, r) => Math.min(m, r.px.ratio), 99);
    minOverall = Math.min(minOverall, min);
    const dis = rows.filter((r) => r.disabledBtn || r.unavailable);
    for (const r of dis) minDisabled = Math.min(minDisabled, r.px.ratio);
    if (fail.length) bad.push(`${mode}/${st}: 미달 ${fail.length}건 ${JSON.stringify(fail.slice(0, 3).map((r) => `${r.text}(${r.testid ?? ''} ${r.px.ratio}:1 ${hex(r.px.ink)}/${hex(r.px.bg)} ${r.fs}px)`))}`);
    all.push({ mode, state: st, rows: rows.length, min, disabled: dis.map((r) => `${r.text}:${r.px.ratio}`), docH: h });
    if (['young-choice', 'adult-choice', 'extreme-neg', 'ending', 'ending-neg'].includes(st)) {
      const name = `M5-K01-${ERA}-${mode}-${st}.png`;
      fs.writeFileSync(path.join(SHOT_DIR, name), png);
      shots.push(`qa/screenshots/003/${name}`);
    }
    console.log(mode, st, 'rows', rows.length, 'min', min, 'disabled', dis.map((r) => r.px.ratio).join(','));
    await ctx.close();
  }
}
fs.writeFileSync(path.join(OUT, `pixel-${ERA}.json`), JSON.stringify({ all }, null, 1));
const rec = {
  id: `M5-K01-${ERA}`,
  cat: '접근성',
  title: `렌더 픽셀 대비(DS3·QM3-5): 라이트·다크(시스템)·수동 다크·강제 색상(라이트/다크) 5모드 × ${STATES.length}상태(20세 전 선택지·성인 선택지·성인 대시보드·순자산 음수·범위 끝 값·엔딩 최종 순자산 줄 …) — ${ERA === 'present' ? '지금' : ERA === 'past' ? '지난' : '다가올'} 세상: 영향 줄 기호·이름·안내 한 줄·자산 금액·최종 순자산 줄의 글자·바탕 대비 ≥ 4.5:1(큰 글자 3:1)`,
  steps: '360폭 터치, 뷰포트를 문서 높이로 키워 한 장을 찍고 모든 보이는 글자 줄 상자(장식·영향 줄 기호 포함)에서 최빈색 = 바탕·면적 0.5%↑ 색 중 바탕과 가장 먼 색 = 글자로 대비를 잼',
  expected: '모든 모드·상태에서 미달 0, 비활성 버튼 글자도 4.5:1 이상',
  verdict: bad.length ? 'FAIL' : 'PASS',
  severity: '중간',
  actual: (bad.length ? bad.slice(0, 8).join(' / ') + ' | ' : '') + `${all.length}조합 글자 줄 ${nRows.toLocaleString()}개 측정, 전체 최소 ${minOverall}:1`,
  shots: shots.slice(0, 40),
  console: [],
  externalRequests: [],
  at: new Date().toISOString(),
};
fs.appendFileSync(CASES, JSON.stringify(rec) + '\n');
console.log(`[${rec.verdict}] ${rec.id} :: ${rec.actual.slice(0, 1500)}`);
await browser.close();
