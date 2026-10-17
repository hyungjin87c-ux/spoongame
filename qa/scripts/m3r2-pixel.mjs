// QA-003 M3 2회차 — QM3-5·R-291: 렌더 픽셀 대비. 화면을 그대로 찍어(스크린샷) 글자 줄 상자 자리의 바탕 색과 글자 색(가장 먼 색)의 명도 대비를 잰다.
// 계산된 CSS 색이 아니라 화면에 그려진 색이므로 불투명도 합성·백플레이트·시스템 색 덮어쓰기를 잡는다.
// 사용: node qa/scripts/m3r2-pixel.mjs   결과: qa/results/m3r2/pixel.json + 케이스 M3-K01·M3-K03
import fs from 'node:fs';
import path from 'node:path';
import { launch, mkctx, fixSeed, openTitle, toRoulette, waitGuard, skipToBirth, runCase, shot, sleep, OUT, VP, TOUCH, SHOT_DIR } from './m3r2-lib.mjs';

const browser = await launch();
const helper = await browser.newPage();
await helper.goto('about:blank');

/** 페이지 안: 보이는 글자 줄 상자(Range)와 그 요소의 속성을 모은다 */
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
      if (cs.display === 'none' || (x === pe && cs.visibility === 'hidden')) {
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
      // 조상 overflow 상자 밖으로 잘린 것(릴 창 밖 칸)은 제외
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
      out.push({
        text: t.slice(0, 24),
        punct: !/[가-힣A-Za-z0-9]/.test(t),
        x: r.left,
        y: r.top,
        w: r.width,
        h: r.height,
        fs: px,
        bold: parseInt(cs.fontWeight, 10) >= 700,
        deco: !!pe.closest('.stamp'),
        ariaHidden: !!pe.closest('[aria-hidden="true"]'),
        reelNeighbor: !!pe.closest('.reel__item') && !pe.closest('.reel__item.is-result') && !!pe.closest('[aria-hidden="true"]'),
        band: !!pe.closest('.doc__band'),
        boxBg: bg.css,
        boxEl: bg.el ? `${bg.el.tagName.toLowerCase()}.${(typeof bg.el.className === 'string' ? bg.el.className : '').split(' ')[0]}` : 'page',
        color: cs.color,
        opacity: (() => {
          let o = 1;
          for (let x = pe; x && x !== document.documentElement; x = x.parentElement) o *= parseFloat(getComputedStyle(x).opacity);
          return Math.round(o * 100) / 100;
        })(),
      });
    }
  }
  return out;
};

/** 헬퍼 페이지 안: PNG에서 줄 상자마다 바탕 색(최빈)과 글자 색(바탕과 대비가 가장 큰 색)을 뽑아 대비를 잰다 */
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
    // 글자 색: 바탕과 대비가 큰 순으로, 전체 면적의 0.5% 이상(최소 4픽셀)을 차지하는 색 중 가장 큰 것(안티앨리어싱 가장자리 색은 개수가 적다)
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
  ['forced-light', { forcedColors: 'active', colorScheme: 'light' }],
  ['forced-dark', { forcedColors: 'active', colorScheme: 'dark' }],
];
const STATES = [
  { key: 'result-diamond', era: 'present', seed: 229, birth: false },
  { key: 'result-dirt', era: 'present', seed: 5, birth: false },
  { key: 'birth-present-diamond', era: 'present', seed: 229, birth: true },
  { key: 'birth-present-labor', era: 'present', seed: 5, birth: true },
  { key: 'birth-past', era: 'past', seed: 155, birth: true },
  { key: 'birth-future', era: 'future', seed: 138, birth: true },
];

const all = [];
async function measure(modeName, opts, st) {
  const ctx = await mkctx(browser, { viewport: { width: 360, height: 740 }, ...TOUCH, ...opts });
  await fixSeed(ctx, st.seed);
  const p = await ctx.newPage();
  await openTitle(p);
  await toRoulette(p, st.era);
  await waitGuard(p, 'skip-roulette');
  await p.getByTestId('skip-roulette').click();
  await p.waitForSelector('[data-testid="roulette-screen"][data-state="result"]', { timeout: 3000 });
  await sleep(500);
  if (st.birth) {
    await waitGuard(p, 'to-birth');
    await p.getByTestId('to-birth').click();
    await p.waitForSelector('[data-testid="birth-screen"]', { timeout: 4000 });
    await sleep(500);
  }
  if (process.env.MUT_CSS) {
    await p.addStyleTag({ content: process.env.MUT_CSS });
    await sleep(250);
  }
  // 문서 높이만큼 뷰포트를 키워 한 장에 다 담는다(고정 띠는 아래에 붙는다)
  const h = await p.evaluate(() => Math.ceil(Math.max(document.documentElement.scrollHeight, document.body.scrollHeight)));
  await p.setViewportSize({ width: 360, height: Math.min(h + 4, 9000) });
  await sleep(500);
  await p.evaluate(() => window.scrollTo(0, 0));
  const rects = await p.evaluate(RECTS);
  const png = await p.screenshot({ type: 'png' });
  const px = await helper.evaluate(PIXELS, { b64: png.toString('base64'), dpr: 2, rects });
  const rows = rects.map((r, i) => ({ ...r, px: px[i] })).filter((r) => r.px);
  const shotPath = await shot(p, 'K03', `${modeName}-${st.key}`, { full: false });
  await ctx.close();
  return { rows, shotPath, docH: h };
}

if (process.env.MUT_CSS) {
  // 변조 모드: 케이스 기록 없이 도장·띠 대비만 출력(측정기가 이전 결함을 잡는지)
  const st = STATES.find((x) => x.key === 'birth-present-diamond');
  for (const [mode, opts] of MODES.filter(([m]) => (process.env.MUT_MODES || 'light,forced-light').split(',').includes(m))) {
    const { rows } = await measure(mode, opts, st);
    const stamp = rows.filter((r) => r.deco).map((r) => `${r.px.ratio}:1(${hex(r.px.ink)}/${hex(r.px.bg)})`);
    const band = rows.filter((r) => r.band).map((r) => `${r.text}=${r.px.ratio}:1`);
    console.log(`MUT ${mode}: 도장 ${stamp.join(',')} / 띠 ${band.join(', ')}`);
  }
  await browser.close();
  process.exit(0);
}

await runCase(
  {
    id: 'M3-K03',
    cat: '접근성',
    title: '렌더 픽셀 대비(QM3-5·R-291): 라이트·다크·강제 색상(라이트/다크) × 룰렛 결과 2 · 출생신고 4표본 — 화면에 그려진 글자 줄 상자의 글자·바탕 색 대비 ≥ 4.5:1(큰 글자 3:1), 장식 도장 「접수」 포함',
    steps: '360폭 터치, 4모드 × 6상태. 뷰포트를 문서 높이로 키워 한 장을 찍고, 모든 보이는 글자 줄 상자(장식·aria-hidden 포함)마다 최빈색 = 바탕·면적 0.5%↑ 색 중 바탕과 대비가 가장 큰 색 = 글자로 대비를 잰다. 릴의 흐린 이웃 칸은 따로 센다',
    expected: '모든 모드·상태에서 미달 0(장식 도장 포함), 강제 색상에서 출생신고 띠 제목·표기가 보임(1:1 아님)',
  },
  async () => {
    const bad = [];
    const notes = [];
    const shots = [];
    const stampRows = [];
    const bandRows = [];
    let nRows = 0;
    let nBoxes = 0;
    for (const [mode, opts] of MODES) {
      for (const st of STATES) {
        const { rows, shotPath, docH } = await measure(mode, opts, st);
        shots.push(shotPath);
        nRows += rows.length;
        const colored = new Set(rows.filter((r) => r.boxBg !== 'page').map((r) => `${r.boxEl}|${r.boxBg}`));
        nBoxes += colored.size;
        const real = rows.filter((r) => !r.reelNeighbor);
        const need = (r) => (r.fs >= 24 || (r.fs >= 18.66 && r.bold) ? 3 : 4.5);
        const fail = real.filter((r) => r.px.ratio < need(r));
        const minRatio = real.reduce((m, r) => Math.min(m, r.px.ratio), 99);
        if (fail.length) bad.push(`${mode}/${st.key}: 미달 ${fail.length}건 ${JSON.stringify(fail.slice(0, 3).map((r) => `${r.text}(${r.px.ratio}:1 ${hex(r.px.ink)}/${hex(r.px.bg)} ${r.fs}px)`))}`);
        for (const r of rows.filter((x) => x.deco)) stampRows.push(`${mode}/${st.key}: ${r.text} ${r.px.ratio}:1 글자 ${hex(r.px.ink)} 바탕 ${hex(r.px.bg)}`);
        for (const r of rows.filter((x) => x.band)) bandRows.push({ mode, state: st.key, text: r.text, ratio: r.px.ratio, ink: hex(r.px.ink), bg: hex(r.px.bg) });
        all.push({ mode, state: st.key, n: rows.length, min: minRatio, docH, colored: colored.size });
        notes.push(`${mode}/${st.key}: 줄 ${rows.length}, 최소 ${minRatio}:1`);
      }
    }
    fs.writeFileSync(path.join(OUT, 'pixel.json'), JSON.stringify({ all, stampRows, bandRows }, null, 1));
    const stampMin = stampRows.length ? Math.min(...stampRows.map((s) => Number(/ ([\d.]+):1/.exec(s)[1]))) : null;
    const bandForcedBad = bandRows.filter((b) => b.mode.startsWith('forced') && b.ratio < 4.5);
    if (bandForcedBad.length) bad.push(`강제 색상 띠 글자 대비 미달 ${JSON.stringify(bandForcedBad.slice(0, 3))}`);
    if (!stampRows.length) bad.push('도장 「접수」를 한 번도 못 잼(공허 통과)');
    return {
      verdict: bad.length ? 'FAIL' : 'PASS',
      severity: '중간(접근성)',
      actual: bad.length ? bad.slice(0, 6).join(' / ') : `24조합(4모드 × 6상태) 글자 줄 ${nRows}개 렌더 픽셀 대비 미달 0. 도장 「접수」 최소 ${stampMin}:1(${stampRows.length}곳). 색 바탕 상자 ${nBoxes}개 포함. 띠 글자 강제 색상 최소 ${Math.min(...bandRows.filter((b) => b.mode.startsWith('forced')).map((b) => b.ratio))}:1`,
      shots: shots.slice(0, 40),
    };
  },
);

await browser.close();
