/**
 * 심볼·로고 SVG와 앱 아이콘 PNG를 만든다 (SPEC-003 DS1·DS2, designer). 확정안 A 「담긴 땅」만 만든다(2026-10-15 형진 님 선택).
 * 실행: node scripts/design/buildBrand.mjs      (Playwright로 도형 크기를 재고 PNG를 내보내므로 크로미움이 필요하다)
 *
 * 만드는 것
 *   src/assets/symbol-a.svg, logo-a.svg                     라이트 기본 (var(--c-logo) → 없으면 쪽빛). 정식 심볼(지도 높이 ≥ 머리 높이 70%)
 *   src/assets/brand/a/symbol-dark.svg, symbol-mono.svg      다크·단색 정식 심볼
 *   src/assets/brand/a/symbol-small.svg, symbol-small-mono.svg   단순화 심볼(헤더·파비콘용, 14점 윤곽·섬 없음)
 *   src/assets/brand/a/logo-dark.svg, logo-mono.svg          가로 로고(정식 심볼 + 워드마크) — 첫 화면 데스크톱(108px)
 *   src/assets/brand/a/logo-header*.svg                      **헤더용 가로 로고**(단순화 심볼 + 워드마크 0.64H) — 40px에서 워드마크 글자 높이 ≈ 23px(R-128 ≥ 22px)
 *   src/assets/brand/a/logo-stacked*.svg                     세로 로고(첫 화면 모바일)
 *   src/assets/brand/a/favicon.svg, app-icon.svg, *.png      파비콘(단순화)·앱 아이콘(정식)
 *   src/assets/brand/wordmark*.svg                           워드마크만 (공통)
 * 도형 원본은 brandGeometry.mjs(워드마크)·brandSymbols.mjs(심볼)·geo.mjs(한반도). 이 스크립트는 파일을 덮어쓴다.
 * 점검: 지도 윤곽의 모든 점이 머리(숟가락 머리 도형) 안쪽에 여유(머리 폭의 5%) 이상 들어 있는지 isPointInFill로 확인한다 — 어긋나면 종료 코드 1.
 * 미리보기: node scripts/design/previewBrand.mjs <png>
 */
import { chromium } from '@playwright/test';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { WORDMARK, wordmarkGroup } from './brandGeometry.mjs';
import { OPTIONS } from './brandSymbols.mjs';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const ASSETS = ROOT + 'src/assets/';
const BRAND = ASSETS + 'brand/';

const INK = '#26324A'; // 쪽빛 (= --c-brand / --c-logo 라이트)
const INK_DARK = '#E9E4D6'; // 다크 바탕 위 크림색 (= --c-logo 다크)
const TILE_FG = '#F3EEE2'; // 앱 아이콘 타일 위 심볼색
const fmt = (v) => Math.round(v * 10) / 10;

mkdirSync(BRAND, { recursive: true });

// ---------- 도형 크기 재기·안쪽 점검 (Playwright) ----------
const browser = await chromium.launch();
const page = await browser.newPage();
async function bbox(d) {
  return page.evaluate((path) => {
    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('width', '600');
    svg.setAttribute('height', '600');
    const p = document.createElementNS(ns, 'path');
    p.setAttribute('d', path);
    svg.appendChild(p);
    document.body.appendChild(svg);
    const b = p.getBBox();
    svg.remove();
    return { x: b.x, y: b.y, w: b.width, h: b.height };
  }, d);
}
/** 점들이 모두 path 안쪽인지(여유 margin: 점에서 사방 8방향으로 margin만큼 떨어진 점도 안쪽이어야 한다) */
async function insideCheck(d, points, margin) {
  return page.evaluate(
    ({ path, points, margin }) => {
      const ns = 'http://www.w3.org/2000/svg';
      const svg = document.createElementNS(ns, 'svg');
      svg.setAttribute('width', '600');
      svg.setAttribute('height', '600');
      const p = document.createElementNS(ns, 'path');
      p.setAttribute('d', path);
      svg.appendChild(p);
      document.body.appendChild(svg);
      const out = [];
      const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1], [0.71, 0.71], [-0.71, 0.71], [0.71, -0.71], [-0.71, -0.71]];
      for (const [x, y] of points) {
        for (const [dx, dy] of [[0, 0], ...dirs]) {
          const pt = new DOMPoint(x + dx * margin, y + dy * margin);
          if (!p.isPointInFill(pt)) {
            out.push([Math.round(x), Math.round(y)]);
            break;
          }
        }
      }
      svg.remove();
      return out;
    },
    { path: d, points, margin },
  );
}

// ---------- SVG 조각 ----------
const fillStyle = (variant) => (variant === 'dark' ? `fill:${INK_DARK}` : variant === 'mono' ? 'fill:currentColor' : `fill:var(--c-logo,${INK})`);
const strokeStyle = (variant) => (variant === 'dark' ? `stroke:${INK_DARK}` : variant === 'mono' ? 'stroke:currentColor' : `stroke:var(--c-logo,${INK})`);
const symbolGroup = (sym, variant, k, tx, ty) => `<path transform="translate(${fmt(tx)} ${fmt(ty)}) scale(${k})" d="${sym.d}" fill-rule="${sym.fillRule}" style="${fillStyle(variant)}"/>`;
const svgOpen = (vb, title) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}" role="img" aria-label="${title}">`;
/** 워드마크의 보이는 폭(획 끝 둥근 부분 포함, 100칸 기준) */
const WM_PAD = WORDMARK.strokeWidth / 2;
const WM_W = WORDMARK.w;
const VARIANTS = ['light', 'dark', 'mono'];
const suffix = (variant) => (variant === 'light' ? '' : '-' + variant);

/** 가로 로고 한 벌: 심볼(높이 H) + 워드마크(높이 wmRatio·H) */
function rowLockup(sym, bb, variant, { H = 128, wmRatio = 0.6, gapRatio = 0.17, title }) {
  const k = H / bb.h;
  const symW = bb.w * k;
  const wmH = H * wmRatio;
  const wmK = wmH / 100;
  const gap = H * gapRatio;
  const wmW = (WM_W + WM_PAD) * wmK;
  const totalW = symW + gap + wmW;
  const inner = symbolGroup(sym, variant, fmt(k * 1000) / 1000, -bb.x * k, -bb.y * k) + wordmarkGroup({ x: symW + gap, y: (H - wmH) / 2, h: wmH, style: strokeStyle(variant) });
  return { svg: `${svgOpen(`0 0 ${fmt(totalW)} ${H}`, title)}${inner}</svg>\n`, totalW, H, wmH, glyphH: wmH * 0.9 };
}

// ---------- 안별 생성 (확정 A) ----------
const results = {};
let failed = false;
for (const [key, opt] of Object.entries(OPTIONS)) {
  const full = opt.fn({ small: false });
  const small = opt.fn({ small: true });
  const bb = await bbox(full.d);
  const bbS = await bbox(small.d);
  const dir = BRAND + key + '/';
  mkdirSync(dir, { recursive: true });
  const pad = 6;
  const title = `수저 게임 심볼 「${opt.name}」`;
  const viewBoxOf = (b) => `${fmt(b.x - pad)} ${fmt(b.y - pad)} ${fmt(b.w + pad * 2)} ${fmt(b.h + pad * 2)}`;

  // 점검 1: 지도 높이 ≥ 머리 높이 70% (정식), 점검 2: 지도 윤곽이 머리 안쪽에 여유 있게 든다
  for (const [label, sym] of [['정식', full], ['단순화', small]]) {
    const m = sym.metrics;
    const margin = m.bowlW * 0.05;
    const outside = await insideCheck(m.bowlPath, m.mapOutline, margin);
    const ok = outside.length === 0 && (label === '단순화' || m.mapToBowl >= 0.7);
    console.log(`${label} 심볼: 지도 높이/머리 높이 = ${m.mapToBowl.toFixed(3)} (${label === '정식' ? '기준 ≥ 0.70' : '단순화'}), 머리 안쪽 여유 ${fmt(margin)}px 점검 → 밖으로 나간 점 ${outside.length}개 ${ok ? '통과' : '실패'}`);
    if (!ok) {
      failed = true;
      console.error('  밖으로 나간 점:', JSON.stringify(outside.slice(0, 10)));
    }
  }

  // 심볼 (꼭 맞춘 viewBox)
  for (const variant of VARIANTS) {
    const file = variant === 'light' ? `${ASSETS}symbol-${key}.svg` : `${dir}symbol-${variant}.svg`;
    writeFileSync(file, `${svgOpen(viewBoxOf(bb), title)}<path d="${full.d}" fill-rule="${full.fillRule}" style="${fillStyle(variant)}"/></svg>\n`, 'utf-8');
  }
  const smallTitle = `${title} (작은 크기용 단순화)`;
  writeFileSync(`${dir}symbol-small.svg`, `${svgOpen(viewBoxOf(bbS), smallTitle)}<path d="${small.d}" fill-rule="${small.fillRule}" style="${fillStyle('light')}"/></svg>\n`, 'utf-8');
  writeFileSync(`${dir}symbol-small-mono.svg`, `${svgOpen(viewBoxOf(bbS), smallTitle)}<path d="${small.d}" fill-rule="${small.fillRule}" style="${fillStyle('mono')}"/></svg>\n`, 'utf-8');

  // 가로 로고(정식 심볼): 첫 화면 데스크톱 등 ≥ 64px
  let rowInfo;
  for (const variant of VARIANTS) {
    const file = variant === 'light' ? `${ASSETS}logo-${key}.svg` : `${dir}logo-${variant}.svg`;
    const r = rowLockup(full, bb, variant, { H: 128, wmRatio: 0.6, gapRatio: 0.17, title: `수저 게임 로고 (${title})` });
    writeFileSync(file, r.svg, 'utf-8');
    rowInfo = r;
  }
  // 헤더용 가로 로고(단순화 심볼): 40px에서 워드마크 글자 높이 ≥ 22px
  let headInfo;
  for (const variant of VARIANTS) {
    const r = rowLockup(small, bbS, variant, { H: 128, wmRatio: 0.64, gapRatio: 0.14, title: `수저 게임 로고 (헤더용, ${smallTitle})` });
    writeFileSync(`${dir}logo-header${suffix(variant)}.svg`, r.svg, 'utf-8');
    headInfo = r;
  }

  // 스택 로고: 위 심볼, 아래 워드마크 (첫 화면 모바일)
  const SH = 150;
  const sk = SH / bb.h;
  const sW = bb.w * sk;
  const wmH2 = 72;
  const wmK2 = wmH2 / 100;
  const wmW2 = (WM_W + WM_PAD) * wmK2;
  const W2 = Math.max(sW, wmW2) + 8;
  const gap2 = 22;
  const H2 = SH + gap2 + wmH2 + 4;
  for (const variant of VARIANTS) {
    const inner = symbolGroup(full, variant, fmt(sk * 1000) / 1000, (W2 - sW) / 2 - bb.x * sk, -bb.y * sk) + wordmarkGroup({ x: (W2 - wmW2) / 2 + WM_PAD * wmK2, y: SH + gap2, h: wmH2, style: strokeStyle(variant) });
    writeFileSync(`${dir}logo-stacked${suffix(variant)}.svg`, `${svgOpen(`0 0 ${fmt(W2)} ${fmt(H2)}`, `수저 게임 로고 (${title})`)}${inner}</svg>\n`, 'utf-8');
  }

  // 앱 아이콘 타일 (바탕 쪽빛, 심볼 크림색) — 정사각 꽉 채움(iOS가 모서리를 깎는다). 512·180은 정식 심볼
  const tileSym = (b, size, fillH) => {
    const kk = Math.min(fillH / b.h, (size * 0.78) / b.w);
    const w = b.w * kk;
    const h = b.h * kk;
    return { kk, tx: (size - w) / 2 - b.x * kk, ty: (size - h) / 2 - b.y * kk };
  };
  {
    const t = tileSym(bb, 512, 512 * 0.7);
    writeFileSync(
      `${dir}app-icon.svg`,
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" role="img" aria-label="수저 게임 앱 아이콘"><rect width="512" height="512" fill="${INK}"/><path transform="translate(${fmt(t.tx)} ${fmt(t.ty)}) scale(${fmt(t.kk * 1000) / 1000})" d="${full.d}" fill-rule="${full.fillRule}" fill="${TILE_FG}"/></svg>\n`,
      'utf-8',
    );
    // 파비콘 32×32 (둥근 타일 + 단순화 심볼)
    const t2 = tileSym(bbS, 32, 26);
    writeFileSync(
      `${dir}favicon.svg`,
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" role="img" aria-label="수저 게임"><rect width="32" height="32" rx="7" fill="${INK}"/><path transform="translate(${fmt(t2.tx)} ${fmt(t2.ty)}) scale(${fmt(t2.kk * 1000) / 1000})" d="${small.d}" fill-rule="${small.fillRule}" fill="${TILE_FG}"/></svg>\n`,
      'utf-8',
    );
  }
  results[key] = {
    bbox: bb,
    bboxSmall: bbS,
    symbolAspect: fmt(bb.w / bb.h),
    smallAspect: fmt(bbS.w / bbS.h),
    mapToBowl: fmt(full.metrics.mapToBowl * 1000) / 1000,
    rowLockup: { w: fmt(rowInfo.totalW), h: rowInfo.H, wordmarkGlyphRatio: fmt((rowInfo.glyphH / rowInfo.H) * 1000) / 1000 },
    headerLockup: { w: fmt(headInfo.totalW), h: headInfo.H, wordmarkGlyphRatio: fmt((headInfo.glyphH / headInfo.H) * 1000) / 1000, glyphAt40px: fmt((headInfo.glyphH / headInfo.H) * 40) },
    stackedLockup: { w: fmt(W2), h: fmt(H2), wordmarkGlyphAt236px: fmt((wmH2 * 0.9 * 236) / H2) },
  };
}

// ---------- 워드마크만 ----------
for (const variant of VARIANTS) {
  const inner = wordmarkGroup({ x: WM_PAD, y: 0, h: 100, style: strokeStyle(variant) });
  writeFileSync(BRAND + `wordmark${suffix(variant)}.svg`, `${svgOpen(`0 0 ${WM_W + WM_PAD * 2} 100`, '수저 게임')}${inner}</svg>\n`, 'utf-8');
}

// ---------- PNG 내보내기 (앱 아이콘 180·512, 파비콘 32) ----------
const shotPage = await browser.newPage();
for (const key of Object.keys(OPTIONS)) {
  const dir = BRAND + key + '/';
  for (const [name, size, src] of [
    ['apple-touch-icon.png', 180, 'app-icon.svg'],
    ['icon-512.png', 512, 'app-icon.svg'],
    ['favicon-32.png', 32, 'favicon.svg'],
  ]) {
    const svg = readFileSync(dir + src, 'utf-8');
    await shotPage.setViewportSize({ width: size, height: size });
    await shotPage.setContent(`<body style="margin:0;background:transparent">${svg.replace('<svg ', `<svg width="${size}" height="${size}" `)}</body>`);
    await shotPage.screenshot({ path: dir + name, omitBackground: true });
  }
}
await browser.close();
console.log(JSON.stringify(results, null, 1));
if (failed) process.exit(1);
