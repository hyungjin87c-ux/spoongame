/**
 * SPEC-009 「시대의 창」 정교화 2차 — 그림 도우미·공유 패턴·톤 규칙 (designer 2026-10-28, r2).
 * 좌표계 40×32(5:4) 전체를 쓴다(PC 175×140 · 휴대폰 100×80 모두 5:4라 잘림 0 — r1의 「가운데 40×20 띠」 규칙은 r2에서 푼다).
 * 색은 `--c-scene-*` 토큰 24개만(라이트 기본값 = SVG fallback). 깊이는 세 층(뒤 far/far2 · 가운데 · 앞 + 밀린 그림자 shade)으로 낸다.
 * 톤(바랜 인쇄물·필름)은 그림 바깥 CSS 필터 + 공유 패턴(망점·종이) 한 겹 — 그림 바이트는 겹 하나(≈ 90B)만 는다.
 */
export const LIGHT = {
  sky: '#dfe6ed', far: '#b9c4d0', far2: '#cfd8e2', ground: '#e4dccb', ground2: '#cfc5ae',
  wall: '#f5f0e5', wall2: '#cdc3ac', roof: '#5b6879', roof2: '#404b58', wood: '#8a6b4c', clay: '#926f52',
  ink: '#2b2a27', shade: 'rgba(38,50,74,0.2)', glass: '#fbf3d4', green: '#6e8a5b',
  cloth1: '#26324a', cloth2: '#8a6a14', cloth3: '#f7f2e8', cloth4: '#6c7f9e',
  skin: '#f1c9a5', hair: '#2b2420', hairw: '#d6d2ca', pet: '#a98c66', pet2: '#4a453d', face: '#4a362c',
};
export const T = (n) => { if (!(n in LIGHT)) throw new Error(`토큰 없음: ${n}`); return `var(--c-scene-${n},${LIGHT[n]})`; };
const r1 = (n) => Math.round(n * 100) / 100;
const op = (o) => (o && o.op !== undefined ? ` opacity="${o.op}"` : '');
const tr = (o) => (o && o.tr ? ` transform="${o.tr}"` : '');

/** 평면 조각 도우미 — 선 없음, 밀린 그림자는 shade 조각으로 */
export const f = {
  rect: (x, y, w, h, tok, o = {}) => `<rect x="${r1(x)}" y="${r1(y)}" width="${r1(w)}" height="${r1(h)}"${o.rx ? ` rx="${o.rx}"` : ''} fill="${T(tok)}"${op(o)}${tr(o)}/>`,
  path: (d, tok, o = {}) => `<path d="${d}" fill="${T(tok)}"${op(o)}${tr(o)}/>`,
  poly: (pts, tok, o = {}) => `<path d="M${pts.map(([x, y]) => `${r1(x)},${r1(y)}`).join('L')}Z" fill="${T(tok)}"${op(o)}${tr(o)}/>`,
  circle: (cx, cy, r, tok, o = {}) => `<circle cx="${r1(cx)}" cy="${r1(cy)}" r="${r1(r)}" fill="${T(tok)}"${op(o)}/>`,
  ellipse: (cx, cy, rx, ry, tok, o = {}) => `<ellipse cx="${r1(cx)}" cy="${r1(cy)}" rx="${r1(rx)}" ry="${r1(ry)}" fill="${T(tok)}"${op(o)}${tr(o)}/>`,
  /** 가는 띠(전선·연줄·창살) — 40×32에서 0.2~0.8 */
  line: (d, w, tok, o = {}) => `<path d="${d}" fill="none" stroke="${T(tok)}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"${o.dash ? ` stroke-dasharray="${o.dash}"` : ''}${op(o)}/>`,
  /** 공유 패턴으로 채우는 면(벽돌·기와·관중·책등·망점) */
  fill: (x, y, w, h, pat, o = {}) => `<rect x="${r1(x)}" y="${r1(y)}" width="${r1(w)}" height="${r1(h)}" fill="url(#${pat})"${op(o)}${tr(o)}/>`,
  fillPath: (d, pat, o = {}) => `<path d="${d}" fill="url(#${pat})"${op(o)}/>`,
  g: (attrs, inner) => `<g ${attrs}>${inner}</g>`,
};
export const rep = (n, fn) => Array.from({ length: n }, (_, i) => fn(i)).join('');
/** 땅에 밀린 그림자(빛은 왼쪽 위 → 그림자는 오른쪽 아래) */
export const shadow = (x, y, w, len = 1.2, o = 0.6) => f.poly([[x, y], [x + w, y], [x + w + len, y + len * 0.5], [x + len, y + len * 0.5]], 'shade', { op: o });
/** 가로수·마당 나무: 줄기 + 둥근 잎 세 덩이 */
export const tree = (x, yBase, h, tok = 'green', trunk = 'wood') => f.rect(x - h * 0.06, yBase - h * 0.55, h * 0.12, h * 0.55, trunk) + f.circle(x, yBase - h * 0.72, h * 0.3, tok) + f.circle(x - h * 0.22, yBase - h * 0.56, h * 0.24, tok) + f.circle(x + h * 0.22, yBase - h * 0.58, h * 0.25, tok);
/** 창문: 틀 + 유리 + 십자 창살 */
export const win = (x, y, w, h, frame = 'wood', glass = 'glass', bar = 0.3) => f.rect(x, y, w, h, frame) + f.rect(x + bar, y + bar, w - bar * 2, h - bar * 2, glass) + f.line(`M${r1(x + w / 2)},${r1(y)} V${r1(y + h)} M${r1(x)},${r1(y + h / 2)} H${r1(x + w)}`, bar * 0.9, frame);
/** 먼 지붕선(동네) */
export const farRoofs = (y = 12, tok = 'far2') => f.path(`M0,${y} L4,${y - 3} L8,${y} L12,${y - 2.5} L16,${y} L20,${y - 3} L24,${y} L28,${y - 2} L32,${y} L36,${y - 2.5} L40,${y} L40,${y + 2.5} L0,${y + 2.5} Z`, tok);
/** 연기(세 덩이, 오른쪽 위로) */
export const smoke = (x, y, tok = 'cloth3', o = 0.65) => f.ellipse(x, y, 0.9, 0.6, tok, { op: o }) + f.ellipse(x + 1.1, y - 1.5, 1.25, 0.85, tok, { op: o - 0.1 }) + f.ellipse(x + 2.6, y - 3, 1.6, 1.05, tok, { op: o - 0.25 });

/** 공유 패턴 — 문서(또는 덩어리)에 한 번만 들어간다. 그림은 `url(#id)`로 가리킨다 */
export const ERA_DEFS = [
  // 망점(톤 A · 인쇄물) — 30° 기울인 작은 점. 175px 칸에서 점 간격 ≈ 4.8px
  `<pattern id="era-dots" width=".62" height=".62" patternUnits="userSpaceOnUse" patternTransform="rotate(30)"><circle cx=".31" cy=".31" r=".11" fill="${T('ink')}"/></pattern>`,
  // 관중(얼굴 없는 색점 두 줄, 어두운 바탕 위) — 관중석 원호를 채운다
  `<pattern id="era-crowd" width="2.4" height="1.6" patternUnits="userSpaceOnUse"><rect width="2.4" height="1.6" fill="${T('roof2')}" opacity=".35"/><rect x=".15" y=".25" width=".45" height=".6" fill="${T('cloth3')}"/><rect x=".95" y=".15" width=".45" height=".6" fill="${T('cloth4')}"/><rect x="1.75" y=".3" width=".45" height=".6" fill="${T('cloth2')}"/><rect x=".55" y="1" width=".45" height=".5" fill="${T('cloth1')}"/><rect x="1.35" y=".95" width=".45" height=".55" fill="${T('hairw')}"/></pattern>`,
  // 돌담·벽돌
  `<pattern id="era-stones" width="3" height="2" patternUnits="userSpaceOnUse"><rect x=".15" y=".15" width="1.3" height=".8" rx=".2" fill="${T('ground2')}"/><rect x="1.65" y=".15" width="1.2" height=".8" rx=".2" fill="${T('ground2')}" opacity=".7"/><rect x=".9" y="1.15" width="1.4" height=".75" rx=".2" fill="${T('ground2')}" opacity=".85"/></pattern>`,
  // 타일 벽(지하철) — 줄눈만
  `<pattern id="era-tiles" width="2" height="1.4" patternUnits="userSpaceOnUse"><path d="M0,1.3 H2 M1.9,0 V1.4" fill="none" stroke="${T('wall2')}" stroke-width=".18"/></pattern>`,
  // 마룻장 줄
  `<pattern id="era-planks" width="6" height="1.6" patternUnits="userSpaceOnUse"><path d="M0,1.5 H6 M3,0 V1.5" fill="none" stroke="${T('shade')}" stroke-width=".2"/></pattern>`,
  // 책등(만화방 책꽂이) — 여섯 권이 한 타일, 높이가 조금씩 다르다
  `<pattern id="era-books" width="5.4" height="4" patternUnits="userSpaceOnUse"><rect x=".1" y=".4" width=".75" height="3.6" fill="${T('cloth1')}"/><rect x="1" y=".1" width=".75" height="3.9" fill="${T('clay')}"/><rect x="1.9" y=".55" width=".75" height="3.45" fill="${T('cloth4')}"/><rect x="2.8" y=".25" width=".75" height="3.75" fill="${T('green')}"/><rect x="3.7" y=".5" width=".75" height="3.5" fill="${T('cloth2')}"/><rect x="4.6" y=".15" width=".7" height="3.85" fill="${T('roof')}"/></pattern>`,
  // 건물 창(먼 건물) — 작은 창 격자
  `<pattern id="era-windows" width="2.2" height="2.6" patternUnits="userSpaceOnUse"><rect x=".4" y=".4" width="1.2" height="1.5" fill="${T('far')}"/></pattern>`,
  // 셔터 가로줄
  `<pattern id="era-shutter" width="2" height=".9" patternUnits="userSpaceOnUse"><path d="M0,.7 H2" fill="none" stroke="${T('far')}" stroke-width=".22"/></pattern>`,
  // 자개 점(문갑·장식장)
  `<pattern id="era-nacre" width="2.6" height="1.8" patternUnits="userSpaceOnUse"><circle cx=".6" cy=".6" r=".22" fill="${T('cloth4')}"/><circle cx="1.8" cy="1.2" r=".2" fill="${T('hairw')}"/><circle cx="2.2" cy=".4" r=".14" fill="${T('cloth3')}"/></pattern>`,
  // 벽지 잔무늬(안방)
  `<pattern id="era-paper" width="2.4" height="2.4" patternUnits="userSpaceOnUse"><circle cx=".6" cy=".6" r=".28" fill="${T('wall2')}"/><circle cx="1.8" cy="1.8" r=".28" fill="${T('wall2')}"/></pattern>`,
  // 발(만화방 창)
  `<pattern id="era-blind" width="2" height=".8" patternUnits="userSpaceOnUse"><path d="M0,.4 H2" fill="none" stroke="${T('cloth2')}" stroke-width=".3"/></pattern>`,
].join('');

/**
 * 톤 규칙 — 10년대마다 CSS 필터(그림 바깥, 바이트 0) + 그림 안 한 겹(톤 A는 망점+종이, 톤 B는 바램 한 겹).
 * A 「바랜 인쇄물」: 세피아 ↘ 망점 ↘ 종이 — 2000년대부터 망점이 사라진다(인쇄 → 디지털).
 * B 「색 빠진 사진」: 매끈한 면, 색조만 시대를 따라 바뀐다(세피아 → 바랜 컬러 → 선명 → 디지털).
 */
export const TONE = {
  a: {
    name: '바랜 인쇄물', filter: { 40: 'sepia(.62) saturate(.6) contrast(.9) brightness(1.03)', 50: 'sepia(.55) saturate(.62) contrast(.91) brightness(1.02)', 60: 'sepia(.42) saturate(.72) contrast(.93)', 70: 'sepia(.3) saturate(.8) contrast(.94) brightness(1.02)', 80: 'sepia(.18) saturate(.9) contrast(.96)', 90: 'sepia(.05) saturate(1)', 2000: 'saturate(1.04) contrast(1.02)', 2010: 'none', 2020: 'none' },
    dots: { 40: 0.14, 50: 0.13, 60: 0.11, 70: 0.1, 80: 0.075, 90: 0.04, 2000: 0, 2010: 0, 2020: 0 },
    paper: { 40: 0.16, 50: 0.14, 60: 0.12, 70: 0.1, 80: 0.08, 90: 0.04, 2000: 0, 2010: 0, 2020: 0 },
    dark: { 40: 'sepia(.3) saturate(.75)', 50: 'sepia(.26) saturate(.78)', 60: 'sepia(.2) saturate(.85)', 70: 'sepia(.14) saturate(.9)', 80: 'sepia(.08)', 90: 'none', 2000: 'none', 2010: 'none', 2020: 'none' },
  },
  b: {
    name: '색 빠진 사진', filter: { 40: 'sepia(.5) saturate(.55) contrast(.95)', 50: 'sepia(.42) saturate(.6) contrast(.96)', 60: 'sepia(.3) saturate(.7) contrast(.97)', 70: 'sepia(.2) saturate(.78) contrast(.98)', 80: 'sepia(.1) saturate(.9)', 90: 'none', 2000: 'saturate(1.05)', 2010: 'none', 2020: 'none' },
    dots: {},
    paper: { 40: 0.12, 50: 0.1, 60: 0.08, 70: 0.07, 80: 0.05, 90: 0.02, 2000: 0, 2010: 0, 2020: 0 },
    dark: { 40: 'sepia(.22) saturate(.8)', 50: 'sepia(.18) saturate(.82)', 60: 'sepia(.12)', 70: 'sepia(.08)', 80: 'none', 90: 'none', 2000: 'none', 2010: 'none', 2020: 'none' },
  },
};
export const decadeOf = (year) => (year >= 2000 ? Math.floor(year / 10) * 10 : Math.floor((year % 100) / 10) * 10);
/** 그림 위에 얹는 톤 한 겹(그림 바이트에 포함되는 유일한 톤 비용) */
export const toneLayer = (tone, year) => {
  const t = TONE[tone]; const d = decadeOf(year); let s = '';
  if (t.paper[d]) s += f.rect(0, 0, 40, 32, 'cloth3', { op: t.paper[d] });
  if (t.dots[d]) s += f.fill(0, 0, 40, 32, 'era-dots', { op: t.dots[d] });
  return s;
};
export const toneCss = (sel = '.ew') => Object.entries(TONE).map(([k, t]) => Object.keys(t.filter).map((d) => `${sel} [data-tone="${k}"] [data-dec="${d}"] svg{filter:${t.filter[d]}}\n:root[data-theme="dark"] ${sel} [data-tone="${k}"] [data-dec="${d}"] svg{filter:${t.dark[d]}}`).join('\n')).join('\n');
