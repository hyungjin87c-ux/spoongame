/**
 * SPEC-009 FM2 그림체 게이트 — 집과 가족 그림 시안 생성기 (designer 2026-10-27).
 *
 * 같은 장면 둘(A 1975년 서울 단독주택 셋방 · B 2005년 경기 신도시 아파트)을 두 벡터 그림체로 그린다.
 *   s1 「종이 오림」 — 선 없음, 평면 조각 + 한 칸 밀린 그림자 조각(판화·종이 오림 느낌). 얼굴 없음(머리 모양으로 사람을 읽는다).
 *   s2 「굵은 선 그림책」 — 먹선 3단위(둥근 이음)와 옅은 채움, 점 눈 + 담담한 미소(얼굴 시스템과 같은 표정).
 * 조각은 층(배경 / 시대 소품 / 집 / 식구 / 반려동물)마다 독립된 SVG 조각이고 장면은 조각을 자리(슬롯)에 놓아 합친다(FH2·FH5·FH8).
 * 색은 디자인 토큰만 읽는다 — `var(--c-scene-*, 기본값)`. 기본값은 라이트 값이라 CSS 없는 뷰어에서도 보인다(FH6 하드코딩 색 0 — 토큰 제안은 family.css).
 *
 * 실행: node scripts/design/buildFamilyMockups.mjs
 * 산출: docs/design/mockups/family/{compare.html, pieces.html, dashboard-family.html, family.css, budget.json, pieces/<s1|s2>/<id>.svg}
 *       — dashboard-family.html은 gm3/dashboard-004.html(읽기만)에 결정 카드(decision-adult.html의 인라인 카드)와 그림 카드를 끼운 것.
 * 의존성 없음(Node 내장만). `src/`는 읽지 않는다.
 */
import { gzipSync } from 'node:zlib';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const OUT = ROOT + 'docs/design/mockups/family/';
mkdirSync(OUT + 'pieces/s1', { recursive: true });
mkdirSync(OUT + 'pieces/s2', { recursive: true });
const write = (f, s) => writeFileSync(OUT + f, s.replace(/\r\n/g, '\n'), 'utf8');

// ---------------------------------------------------------------- 토큰(제안) — 라이트 기본값 = SVG fallback, 다크는 family.css
const LIGHT = {
  sky: '#dfe6ed', far: '#b9c4d0', far2: '#cfd8e2', ground: '#e4dccb', ground2: '#cfc5ae',
  wall: '#f5f0e5', wall2: '#cdc3ac', roof: '#5b6879', roof2: '#404b58', wood: '#8a6b4c', clay: '#926f52',
  ink: '#2b2a27', shade: 'rgba(38,50,74,0.2)', glass: '#fbf3d4', green: '#6e8a5b',
  cloth1: '#26324a', cloth2: '#8a6a14', cloth3: '#f7f2e8', cloth4: '#6c7f9e',
  skin: '#f1c9a5', hair: '#2b2420', hairw: '#d6d2ca', pet: '#a98c66', pet2: '#4a453d', face: '#4a362c',
};
const DARK = {
  sky: '#1e2633', far: '#2b3443', far2: '#252e3c', ground: '#2b3039', ground2: '#222730',
  wall: '#4a5264', wall2: '#3a4151', roof: '#7b8a9c', roof2: '#5d6b7d', wood: '#a0805e', clay: '#a07d60',
  ink: '#ece8de', shade: 'rgba(0,0,0,0.38)', glass: '#efdc9a', green: '#7f9a6c',
  cloth1: '#b3c2e8', cloth2: '#dcb85c', cloth3: '#e6e0d3', cloth4: '#93a3bf',
  skin: '#f1c9a5', hair: '#2b2420', hairw: '#d6d2ca', pet: '#b89c78', pet2: '#c9c3b8', face: '#4a362c',
};
const T = (n) => `var(--c-scene-${n},${LIGHT[n]})`;

// ---------------------------------------------------------------- 그림체 도우미
function mk(style) {
  const line = style === 's2';
  const SW = 3;
  const st = (w = SW) => (line ? ` stroke="${T('ink')}" stroke-width="${w}" stroke-linejoin="round" stroke-linecap="round"` : '');
  const shade = (tag, attrs) => (line ? '' : `<${tag} ${attrs} fill="${T('shade')}" transform="translate(3 3)"/>`);
  const el = (tag, attrs, fill, o = {}) => (o.shade ? shade(tag, attrs) : '') + `<${tag} ${attrs} fill="${fill}"${o.flat ? '' : st(o.w)}${o.extra ? ' ' + o.extra : ''}/>`;
  return {
    line,
    path: (d, fill, o) => el('path', `d="${d}"`, fill, o),
    rect: (x, y, w, h, fill, o = {}) => el('rect', `x="${x}" y="${y}" width="${w}" height="${h}"${o.rx ? ` rx="${o.rx}"` : ''}${o.tf ? ` transform="${o.tf}"` : ''}`, fill, o),
    circle: (cx, cy, r, fill, o) => el('circle', `cx="${cx}" cy="${cy}" r="${r}"`, fill, o),
    ellipse: (cx, cy, rx, ry, fill, o) => el('ellipse', `cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}"`, fill, o),
    /** 가는 띠(전선·안테나·자전거 살): s2는 먹선, s1은 어두운 조각 색 */
    stroke: (d, w = SW, tok = 'roof2') => `<path d="${d}" fill="none" stroke="${T(line ? 'ink' : tok)}" stroke-width="${line ? w : Math.max(2, w - 0.5)}" stroke-linecap="round" stroke-linejoin="round"/>`,
    /** s2에만 있는 점(눈 — 살색 위에서 다크에서도 보이게 얼굴 선 토큰 --c-face-line 값) */
    dot: (cx, cy, r = 1.4) => (line ? `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${T('face')}"/>` : ''),
    /** s2에만 있는 가는 선(입·옷 선 — 같은 얼굴 선 토큰) */
    ink: (d, w = 1.6) => (line ? `<path d="${d}" fill="none" stroke="${T('face')}" stroke-width="${w}" stroke-linecap="round"/>` : ''),
  };
}
const r1 = (n) => Math.round(n * 10) / 10;

// ---------------------------------------------------------------- 식구 조각 (발바닥 가운데가 원점)
/**
 * p: { H 키, r 머리 반지름, sw 어깨 폭, outfit, hair, hairTok, toks:{a,b,c} 옷 색 }
 * 연령대는 키·머리 비례로(얼굴 시스템 ageGroupOf와 같은 경계를 쓴다 — 이 시안은 young·senior·child·infant만).
 */
function person(h, p) {
  const { H, r, sw } = p;
  const hy = -(H - r);
  const shY = -(H - 2 * r - 3);
  const hipY = -H * 0.5;
  const tk = p.toks;
  const out = [];
  const armL = (hipY - shY) * 0.95;
  const arm = (s, w = 7, tok = tk.a) => {
    const x0 = s * (sw / 2 - 2);
    const ex = r1(x0 + s * Math.sin((12 * Math.PI) / 180) * armL);
    const ey = r1(shY + 3 + Math.cos((12 * Math.PI) / 180) * armL);
    return h.rect(-w / 2, 0, w, armL, T(tok), { rx: w / 2, tf: `translate(${x0} ${shY + 3}) rotate(${s * 12})` }) + h.circle(ex, ey, 3.4, T('skin'));
  };
  const shoes = (lw, tok = 'roof2') => h.rect(-lw - 1, -4, lw + 1.5, 4, T(tok), { rx: 2 }) + h.rect(-0.5, -4, lw + 1.5, 4, T(tok), { rx: 2 });
  const legsSkin = (fromY, x = 2.5, w = 5) => h.rect(-x - w, fromY, w, -fromY, T('skin'), { flat: !h.line }) + h.rect(x, fromY, w, -fromY, T('skin'), { flat: !h.line });
  // 뒤에 오는 것(배낭·머리 옆 조각·쪽)
  if (p.outfit === 'tee-shorts') out.push(h.rect(-sw / 2 - 3, shY + 2, sw + 6, (hipY - shY) * 0.8, T('roof2'), { rx: 5 }));
  out.push(hairBack(h, p, hy));
  // 다리·치마
  switch (p.outfit) {
    case 'shirt-trousers':
    case 'polo-trousers':
    case 'cardigan-pants': {
      const lw = p.outfit === 'cardigan-pants' ? 8 : 10;
      out.push(h.rect(-lw, hipY - 3, lw - 1.5, -hipY + 3 - 3, T(tk.b), { rx: 3, shade: true }), h.rect(1.5, hipY - 3, lw - 1.5, -hipY + 3 - 3, T(tk.b), { rx: 3 }), shoes(lw));
      break;
    }
    case 'blouse-skirt': {
      const hemY = -H * 0.14;
      out.push(legsSkin(hemY), shoes(7), h.path(`M ${-sw / 2 + 2},${hipY - 3} L ${sw / 2 - 2},${hipY - 3} L ${sw / 2 + 8},${hemY} L ${-sw / 2 - 8},${hemY} Z`, T(tk.b), { shade: true }));
      break;
    }
    case 'hanbok': {
      const chestY = shY + H * 0.1;
      const hemY = -H * 0.05;
      out.push(h.ellipse(-5.5, -2.2, 5.2, 2.4, T('cloth3')), h.ellipse(5.5, -2.2, 5.2, 2.4, T('cloth3')));
      out.push(h.path(`M ${-sw / 2},${chestY} L ${sw / 2},${chestY} L ${sw / 2 + 15},${hemY} L ${-sw / 2 - 15},${hemY} Z`, T(tk.b), { shade: true }));
      break;
    }
    case 'dress': {
      const hemY = -H * 0.32;
      out.push(legsSkin(hemY, 2, 4.5), shoes(6));
      break;
    }
    case 'tee-shorts': {
      const hemY = -H * 0.3;
      out.push(legsSkin(hemY, 2, 4.5), shoes(6), h.rect(-9, hipY - 2, 8, hemY - hipY + 2, T(tk.b), { rx: 3 }), h.rect(1, hipY - 2, 8, hemY - hipY + 2, T(tk.b), { rx: 3 }));
      break;
    }
  }
  // 목·몸통
  out.push(h.rect(-3, hy + r - 2, 6, shY - (hy + r) + 4, T('skin'), { flat: !h.line }));
  switch (p.outfit) {
    case 'shirt-trousers':
    case 'polo-trousers':
      out.push(h.rect(-sw / 2, shY, sw, hipY - shY + 3, T(tk.a), { rx: 5, shade: true }), arm(-1), arm(1));
      if (p.outfit === 'polo-trousers') out.push(h.path(`M -6,${shY + 1} L 0,${shY + 8} L 6,${shY + 1} Z`, T('cloth3'), { flat: true }));
      else out.push(h.ink(`M -5,${shY + 1} L 0,${shY + 7} L 5,${shY + 1}`), h.ink(`M 0,${shY + 9} V ${hipY - 2}`, 1.2));
      break;
    case 'blouse-skirt':
      out.push(h.rect(-sw / 2, shY, sw, hipY - shY + 1, T(tk.a), { rx: 5 }), arm(-1), arm(1), h.path(`M -5,${shY} a 5 4 0 0 0 10 0 Z`, T('cloth3'), { flat: true }));
      break;
    case 'hanbok': {
      const chestY = shY + H * 0.1;
      out.push(h.rect(-sw / 2 - 1, shY, sw + 2, chestY - shY + 5, T(tk.a), { rx: 4 }), arm(-1, 10, tk.a), arm(1, 10, tk.a));
      out.push(h.path(`M -1.5,${chestY - 1} l 4,0 l 2,13 l -5,0 Z`, T(tk.c), { flat: true }), h.ink(`M 0,${shY + 9} l -7,-8 M 0,${shY + 9} l 7,-8`));
      break;
    }
    case 'dress': {
      const hemY = -H * 0.32;
      out.push(h.path(`M ${-sw / 2},${shY} L ${sw / 2},${shY} L ${sw / 2 + 7},${hemY} L ${-sw / 2 - 7},${hemY} Z`, T(tk.a), { shade: true }), arm(-1, 6), arm(1, 6));
      out.push(h.path(`M -5,${shY} a 5 4 0 0 0 10 0 Z`, T('cloth3'), { flat: true }));
      break;
    }
    case 'tee-shorts':
      out.push(h.rect(-sw / 2, shY, sw, hipY - shY + 2, T(tk.a), { rx: 5, shade: true }), arm(-1, 6), arm(1, 6));
      out.push(h.rect(-sw / 2 + 3, shY + 1, 4, hipY - shY - 4, T('roof2'), { flat: true, rx: 2 }), h.rect(sw / 2 - 7, shY + 1, 4, hipY - shY - 4, T('roof2'), { flat: true, rx: 2 }));
      break;
    case 'cardigan-pants':
      out.push(h.rect(-sw / 2, shY, sw, hipY - shY + 2, T(tk.a), { rx: 5, shade: true }), h.rect(-4, shY + 2, 8, hipY - shY - 4, T('cloth3'), { flat: true }), arm(-1), arm(1));
      break;
  }
  // 머리·머리카락·얼굴
  out.push(h.circle(0, hy, r, T('skin'), { shade: true }));
  out.push(hairFront(h, p, hy));
  if (h.line) out.push(h.dot(-r * 0.38, hy - r * 0.05), h.dot(r * 0.38, hy - r * 0.05), h.ink(`M ${-r * 0.26},${hy + r * 0.42} q ${r * 0.26} ${r * 0.2} ${r * 0.52} 0`));
  return out.join('');
}
/** 머리 모양 — 머리 위를 덮는 조각(앞) + 머리 뒤에 오는 조각(뒤). 이마 선은 머리 위에 그린다. */
function capPath(r, hy, outer, inner, sideY) {
  const R = r * outer;
  const sy = hy + r * sideY;
  const inY = hy - r * inner;
  return `M ${r1(-R)},${r1(sy)} A ${r1(R)} ${r1(R)} 0 0 1 ${r1(R)},${r1(sy)} Q ${r1(R)},${r1(hy - r * 0.2)} ${r1(r * 0.8)},${r1(hy - r * 0.4)} Q 0,${r1(inY)} ${r1(-r * 0.8)},${r1(hy - r * 0.4)} Q ${r1(-R)},${r1(hy - r * 0.2)} ${r1(-R)},${r1(sy)} Z`;
}
function hairFront(h, p, hy) {
  const { r } = p;
  const tok = T(p.hairTok || 'hair');
  switch (p.hair) {
    case 'short-m': return h.path(capPath(r, hy, 1.04, 0.5, 0.05), tok);
    case 'boy': return h.path(capPath(r, hy, 1.06, 0.55, 0.0), tok);
    case 'perm': return h.path(capPath(r, hy, 1.13, 0.5, 0.2), tok);
    case 'bob': return h.path(capPath(r, hy, 1.1, 0.55, 0.1), tok);
    case 'bun': return h.path(capPath(r, hy, 1.04, 0.45, 0.1), tok);
    case 'tied': return h.path(capPath(r, hy, 1.08, 0.55, 0.15), tok);
  }
  return '';
}
function hairBack(h, p, hy) {
  const { r } = p;
  const tok = T(p.hairTok || 'hair');
  switch (p.hair) {
    case 'perm': return h.rect(-r * 1.13, hy - r * 0.1, r * 0.5, r * 0.8, tok, { rx: r * 0.25 }) + h.rect(r * 0.63, hy - r * 0.1, r * 0.5, r * 0.8, tok, { rx: r * 0.25 });
    case 'bob': return h.rect(-r * 1.1, hy - r * 0.1, r * 0.5, r * 1.15, tok, { rx: r * 0.2 }) + h.rect(r * 0.6, hy - r * 0.1, r * 0.5, r * 1.15, tok, { rx: r * 0.2 });
    case 'bun': return h.circle(r * 0.62, hy + r * 0.5, r * 0.46, tok);
    case 'tied': return h.rect(r * 0.25, hy + r * 0.2, r * 0.6, r * 1.9, tok, { rx: r * 0.3 });
  }
  return '';
}

// ---------------------------------------------------------------- 조각 정의 (id · 층 · 상자 [x,y,w,h] · 그리기)
const PIECES = [
  // ── 배경 2 (× 시대) ──
  { id: 'bg-city-early', layer: '배경', box: [0, 0, 640, 256], draw: (h) => [
    h.rect(0, 0, 640, 200, T('sky'), { flat: true }),
    h.path('M 0,118 Q 90,66 170,104 Q 230,70 300,96 Q 360,60 440,98 Q 520,66 640,110 L 640,200 L 0,200 Z', T('far2'), { flat: true }),
    // 1970년대 서울 — 낮은 집들의 지붕선(먼 동네)
    h.path('M 0,160 L 24,150 L 48,160 L 60,146 L 86,160 L 110,154 L 130,142 L 154,158 L 180,152 L 200,140 L 230,156 L 256,150 L 276,160 L 300,148 L 330,160 L 352,150 L 376,162 L 400,154 L 428,142 L 456,158 L 484,152 L 510,164 L 540,150 L 566,162 L 596,154 L 620,164 L 640,156 L 640,200 L 0,200 Z', T('far'), { flat: true }),
    h.rect(0, 200, 640, 56, T('ground'), { flat: true }),
    h.rect(0, 238, 640, 18, T('ground2'), { flat: true }),
  ].join('') },
  { id: 'bg-newtown-late', layer: '배경', box: [0, 0, 640, 256], draw: (h, s) => {
    const pid = `${s}-win`;
    const towers = [[-30, 34, 120], [120, 56, 90], [240, 22, 110], [380, 48, 100], [500, 30, 130], [650, 60, 80]];
    return [
      h.rect(0, 0, 640, 200, T('sky'), { flat: true }),
      `<defs><pattern id="${pid}" width="22" height="18" patternUnits="userSpaceOnUse"><rect x="5" y="5" width="12" height="8" fill="${T('far2')}"/></pattern></defs>`,
      ...towers.map(([x, y, w]) => h.rect(x, y, w, 200 - y, T('far'), { flat: true }) + `<rect x="${x + 4}" y="${y + 6}" width="${w - 8}" height="${194 - y}" fill="url(#${pid})"/>`),
      h.rect(0, 200, 640, 56, T('ground'), { flat: true }),
      h.rect(0, 238, 640, 18, T('ground2'), { flat: true }),
    ].join('');
  } },
  // ── 집 2 (주택 종류 × 시대) ──
  { id: 'house-detached-rent-early', layer: '집', box: [-4, -140, 408, 140], draw: (h) => {
    const tiles = (x0, x1, y, n) => { let d = ''; const step = (x1 - x0) / n; for (let i = 0; i < n; i++) d += `M ${r1(x0 + i * step)},${y} a ${r1(step / 2)} ${r1(step / 2)} 0 0 0 ${r1(step)} 0 Z `; return h.path(d.trim(), T('roof2'), { flat: !h.line, w: 2 }); };
    return [
      // 담장과 대문(왼쪽)
      h.rect(0, -54, 52, 54, T('wall2'), { shade: true }), h.rect(-2, -60, 56, 7, T('roof'), { rx: 1 }),
      h.rect(12, -50, 15, 50, T('wood')), h.rect(29, -50, 15, 50, T('wood')), h.dot(24, -26, 1.2), h.dot(32, -26, 1.2),
      // 본채
      h.rect(60, -100, 230, 100, T('wall'), { shade: true }),
      h.rect(60, -10, 230, 10, T('wood')),
      h.path('M 44,-100 L 78,-130 L 272,-130 L 306,-100 Z', T('roof'), { shade: true }), h.rect(78, -133, 194, 5, T('roof2'), { rx: 1 }),
      h.rect(44, -103, 262, 6, T('roof2'), { rx: 1 }), tiles(46, 304, -97, 16),
      h.rect(84, -88, 42, 30, T('glass')), h.stroke('M 105,-88 V -58 M 84,-73 H 126', 2), h.rect(222, -88, 44, 30, T('glass')), h.stroke('M 244,-88 V -58 M 222,-73 H 266', 2),
      h.rect(158, -86, 40, 76, T('wood')), h.stroke('M 178,-86 V -10 M 158,-50 H 198', 2),
      // 셋방(문간방) — 따로 난 문과 작은 창, 연탄 아궁이 굴뚝
      h.rect(290, -74, 98, 74, T('wall2'), { shade: true }),
      h.path('M 284,-74 L 298,-96 L 394,-96 L 398,-74 Z', T('roof'), { shade: true }), h.rect(284, -77, 114, 5, T('roof2'), { rx: 1 }), tiles(286, 398, -71, 7),
      h.rect(372, -110, 6, 16, T('roof2'), { rx: 1 }),
      h.rect(338, -66, 26, 66, T('wood')), h.stroke('M 338,-34 H 364', 2), h.dot(358, -30, 1.2),
      h.rect(300, -62, 26, 20, T('glass')), h.stroke('M 313,-62 V -42', 2),
    ].join('');
  } },
  { id: 'house-apt-late', layer: '집', box: [0, -200, 400, 200], draw: (h) => {
    const unit = (x, y) => [
      h.rect(x, y, 150, 36, T('glass')), h.stroke(`M ${x + 50},${y} V ${y + 36} M ${x + 100},${y} V ${y + 36}`, 2),
      h.rect(x, y + 36, 150, 16, T('wall2')), h.stroke(`M ${x + 15},${y + 38} V ${y + 50} M ${x + 40},${y + 38} V ${y + 50} M ${x + 65},${y + 38} V ${y + 50} M ${x + 85},${y + 38} V ${y + 50} M ${x + 110},${y + 38} V ${y + 50} M ${x + 135},${y + 38} V ${y + 50}`, 1.5),
    ].join('');
    return [
      h.rect(0, -200, 400, 200, T('wall'), { shade: true }), h.rect(392, -200, 8, 200, T('wall2'), { flat: true }),
      h.rect(0, -200, 400, 12, T('wall2'), { flat: true }), h.rect(0, -140, 400, 10, T('wall2'), { flat: true }), h.rect(0, -80, 400, 10, T('wall2'), { flat: true }),
      unit(20, -186), unit(230, -186), unit(20, -126), unit(230, -126), unit(20, -70), unit(230, -70),
      // 현관 — 차양·유리문·계단, 글자 없는 명판
      h.rect(176, -92, 48, 8, T('roof2'), { rx: 2 }), h.rect(186, -84, 28, 84, T('roof'), { shade: true }), h.rect(190, -80, 20, 76, T('glass')), h.stroke('M 200,-80 V -4', 2),
      h.rect(170, -6, 60, 6, T('ground2')), h.rect(192, -108, 16, 9, T('wall2')),
    ].join('');
  } },
  // ── 시대 소품 1970년대 5 ──
  { id: 'prop-pole', layer: '소품(앞 시대)', box: [-14, -150, 330, 150], draw: (h) => [
    h.rect(-3, -140, 6, 140, T('wood'), { rx: 1 }), h.rect(-14, -128, 28, 4, T('wood')), h.rect(-14, -118, 28, 4, T('wood')),
    h.ellipse(-10, -130, 2.5, 2.5, T('wall2')), h.ellipse(0, -130, 2.5, 2.5, T('wall2')), h.ellipse(10, -130, 2.5, 2.5, T('wall2')),
    h.stroke('M 10,-129 q 150,16 300,-6 M 10,-119 q 150,16 300,-6', 1.5),
  ].join('') },
  { id: 'prop-antenna', layer: '소품(앞 시대)', box: [-16, -36, 32, 36], draw: (h) => h.stroke('M 0,0 V -32 M -14,-32 H 14 M -10,-26 H 10 M -6,-20 H 6 M 0,-12 L 8,-4', 2) },
  { id: 'prop-briquettes', layer: '소품(앞 시대)', box: [-26, -36, 52, 36], draw: (h) => {
    const one = (x, y) => h.rect(x, y, 14, 16, T('roof2'), { rx: 1 }) + h.ellipse(x + 7, y, 7, 2.6, T('roof')) + h.dot(x + 4, y, 0.9) + h.dot(x + 7, y - 0.4, 0.9) + h.dot(x + 10, y, 0.9);
    return one(-24, -16) + one(-8, -16) + one(8, -16) + one(-16, -32) + one(0, -32);
  } },
  { id: 'prop-jangdok', layer: '소품(앞 시대)', box: [-42, -48, 84, 48], draw: (h) => {
    const jar = (x, s) => h.path(`M ${x - 9 * s},0 Q ${x - 15 * s},${-14 * s} ${x - 9 * s},${-28 * s} L ${x + 9 * s},${-28 * s} Q ${x + 15 * s},${-14 * s} ${x + 9 * s},0 Z`, T('clay'), { shade: true }) + h.ellipse(x, -29 * s, 10.5 * s, 2.6 * s, T('wood'));
    return h.rect(-42, -4, 84, 4, T('ground2')) + jar(-24, 1.35) + jar(4, 1.1) + jar(26, 0.8);
  } },
  { id: 'prop-laundry', layer: '소품(앞 시대)', box: [-40, -70, 80, 70], draw: (h) => [
    h.rect(-38, -66, 3, 66, T('wood')), h.rect(35, -66, 3, 66, T('wood')), h.stroke('M -36,-60 q 36,6 72,0', 1.5),
    h.rect(-26, -58, 14, 20, T('cloth3')), h.rect(-6, -58, 16, 24, T('cloth4')), h.rect(16, -58, 12, 18, T('cloth3')),
  ].join('') },
  // ── 시대 소품 2000년대 5 ──
  { id: 'prop-ac-unit', layer: '소품(뒤 시대)', box: [0, -18, 26, 18], draw: (h) => h.rect(0, -16, 24, 16, T('wall2'), { rx: 2 }) + h.circle(10, -8, 5, T('wall')) + h.ink('M 10,-12 V -4 M 6,-8 H 14', 1.2) },
  { id: 'prop-parcel', layer: '소품(뒤 시대)', box: [-12, -20, 24, 20], draw: (h) => h.rect(-11, -18, 22, 18, T('clay'), { rx: 1, shade: true }) + h.rect(-2, -18, 4, 18, T('wall2'), { flat: true }) },
  { id: 'prop-bicycle', layer: '소품(뒤 시대)', box: [-28, -32, 56, 32], draw: (h) => [
    h.stroke('M -16,-10 a 10 10 0 1 0 0.01 0 M 16,-10 a 10 10 0 1 0 0.01 0', 2.2),
    h.stroke('M -16,-10 L -4,-24 L 12,-24 L 16,-10 M -4,-24 L 4,-10 L -16,-10 M 4,-10 L 12,-24 M 12,-24 L 10,-30 M -4,-24 L -8,-30', 2.2),
    h.rect(-12, -32, 8, 3, T('roof2'), { rx: 1 }), h.rect(6, -33, 10, 3, T('roof2'), { rx: 1 }),
  ].join('') },
  { id: 'prop-planter', layer: '소품(뒤 시대)', box: [-12, -26, 24, 26], draw: (h) => h.path('M -9,0 L -7,-12 L 7,-12 L 9,0 Z', T('clay')) + h.circle(0, -18, 7, T('green')) + h.circle(-5, -14, 4.5, T('green')) + h.circle(5, -14, 4.5, T('green')) },
  { id: 'prop-lamp', layer: '소품(뒤 시대)', box: [-12, -120, 24, 120], draw: (h) => h.rect(-2.5, -112, 5, 112, T('roof2'), { rx: 1 }) + h.rect(-2.5, -118, 16, 4, T('roof2'), { rx: 1 }) + h.rect(8, -122, 8, 6, T('glass')) },
  // ── 식구 (연령대 × 성별, 시대 옷) ──
  { id: 'fig-young-f-early', layer: '식구', box: [-24, -102, 48, 104], draw: (h) => person(h, { H: 92, r: 10.5, sw: 24, outfit: 'blouse-skirt', hair: 'perm', toks: { a: 'cloth2', b: 'cloth1' } }) },
  { id: 'fig-young-m-early', layer: '식구', box: [-26, -104, 52, 106], draw: (h) => person(h, { H: 98, r: 11, sw: 30, outfit: 'shirt-trousers', hair: 'short-m', toks: { a: 'cloth3', b: 'cloth1' } }) },
  { id: 'fig-senior-f-early', layer: '식구', box: [-32, -94, 64, 96], draw: (h) => person(h, { H: 84, r: 10.5, sw: 24, outfit: 'hanbok', hair: 'bun', hairTok: 'hairw', toks: { a: 'cloth3', b: 'cloth4', c: 'cloth1' } }) },
  { id: 'fig-child-f-early', layer: '식구', box: [-20, -70, 40, 72], draw: (h) => person(h, { H: 64, r: 9, sw: 18, outfit: 'dress', hair: 'bob', toks: { a: 'cloth1' } }) },
  { id: 'fig-infant-carried', layer: '식구', box: [-22, -100, 44, 60], draw: (h) => {
    // 포대기로 업힌 아기 — 어머니 조각 **뒤**에, 같은 자리에 놓는다(FH5 슬롯 겹침의 예). 어머니 몸통보다 넓은 포대기가 양옆·아래로 보이고, 오른쪽 어깨 위로 아기 머리가 나온다
    const H = 92, r = 10.5;
    const shY = -(H - 2 * r - 3);
    const hipY = -H * 0.5;
    return [
      h.rect(-18, shY + 1, 36, hipY - shY + 14, T('cloth2'), { rx: 7, shade: true }),
      h.circle(10.5, shY - 5, 6.5, T('skin'), { shade: true }), h.path(capPath(6.5, shY - 5, 1.05, 0.5, 0.0), T('hair')),
      h.dot(8.1, shY - 5.4, 1.1), h.dot(12.9, shY - 5.4, 1.1),
    ].join('');
  } },
  { id: 'fig-young-f-late', layer: '식구', box: [-22, -102, 44, 104], draw: (h) => person(h, { H: 92, r: 10.5, sw: 24, outfit: 'cardigan-pants', hair: 'tied', toks: { a: 'cloth1', b: 'cloth4' } }) },
  { id: 'fig-young-m-late', layer: '식구', box: [-26, -104, 52, 106], draw: (h) => person(h, { H: 98, r: 11, sw: 30, outfit: 'polo-trousers', hair: 'short-m', toks: { a: 'cloth4', b: 'roof2' } }) },
  { id: 'fig-child-m-late', layer: '식구', box: [-22, -72, 44, 74], draw: (h) => person(h, { H: 66, r: 9, sw: 20, outfit: 'tee-shorts', hair: 'boy', toks: { a: 'cloth2', b: 'cloth1' } }) },
  // ── 반려동물 (종 × 자리) ──
  { id: 'pet-dog-yard', layer: '반려동물', box: [-72, -46, 104, 46], draw: (h) => [
    h.rect(-64, -26, 34, 26, T('wall2'), { shade: true }), h.path('M -68,-26 L -47,-42 L -26,-26 Z', T('roof')), h.path('M -53,0 L -53,-12 a 6 6 0 0 1 12 0 L -41,0 Z', T('roof2'), { flat: true }),
    h.rect(-20, -9, 5, 9, T('pet'), { rx: 1.5 }), h.rect(-12, -9, 5, 9, T('pet'), { rx: 1.5 }), h.rect(4, -9, 5, 9, T('pet'), { rx: 1.5 }), h.rect(12, -9, 5, 9, T('pet'), { rx: 1.5 }),
    h.rect(-22, -22, 40, 15, T('pet'), { rx: 7, shade: true }), h.stroke('M -21,-18 q -9,-4 -7,-14', 3, 'pet'),
    h.circle(21, -24, 7.5, T('pet')), h.path('M 16,-30 l -2,-8 l 7,4 Z', T('pet2')), h.path('M 26,-30 l 2,-8 l -7,4 Z', T('pet2')), h.ellipse(26, -22, 3.5, 2.5, T('pet2')),
    h.dot(19, -26, 1.1), h.dot(24, -26, 1.1),
    h.rect(13, -17, 6, 3, T('cloth1'), { flat: true }), h.stroke('M 13,-16 q -20,8 -40,0', 1.5, 'roof2'),
  ].join('') },
  { id: 'pet-cat-indoor', layer: '반려동물', box: [-16, -30, 32, 30], draw: (h) => [
    h.path('M -8,0 Q -11,-14 0,-17 Q 11,-14 8,0 Z', T('pet2')), h.stroke('M 8,-2 q 9,-2 8,-10', 2.6, 'pet2'),
    h.circle(0, -20, 6.5, T('pet2')), h.path('M -6,-23 l 1.5,-6 l 4.5,3.5 Z', T('pet2')), h.path('M 6,-23 l -1.5,-6 l -4.5,3.5 Z', T('pet2')),
    `<circle cx="-2.5" cy="-21" r="1" fill="${T('glass')}"/><circle cx="2.5" cy="-21" r="1" fill="${T('glass')}"/>`,
  ].join('') },
];

// ---------------------------------------------------------------- 장면 (조각을 자리에 놓는다 — 구현의 sceneOf → SceneSpec과 같은 모양)
const SCENES = {
  a: {
    id: 'a', title: '장면 A · 1975년 서울 · 단독주택 셋방', line: '서울 성북구 · 단독주택 셋방 · 부모님·누나 둘·할머니와 함께', petLine: '마당에서 기르는 개 한 마리가 있습니다.',
    people: ['어머니 · 박영숙 · 34세 · 아주 가까움', '아버지 · 김재호 · 36세 · 가까움', '친할머니 · 이순자 · 61세 · 가까움', '누나 · 김미경 · 10세 · 가까움', '누나 · 김미정 · 8세 · 아주 가까움', '나 · 김성민 · 0세'],
    bg: 'bg-city-early',
    back: [['prop-pole', 30, 200]],
    house: ['house-detached-rent-early', 0, 200],
    front: [['prop-antenna', 236, 70], ['prop-laundry', 220, 236], ['prop-jangdok', 96, 246], ['prop-briquettes', 286, 240]],
    pets: [['pet-dog-yard', 372, 246]],
    family: [['fig-senior-f-early', 432, 250], ['fig-young-m-early', 478, 246], ['fig-infant-carried', 528, 248], ['fig-young-f-early', 528, 248], ['fig-child-f-early', 574, 250, 1], ['fig-child-f-early', 608, 250, 0.9]],
  },
  b: {
    id: 'b', title: '장면 B · 2005년 경기 신도시 · 아파트', line: '경기 안양시 동안구 · 아파트 · 부모님과 함께', petLine: '집 안에서 기르는 고양이 한 마리가 있습니다.',
    people: ['어머니 · 정수연 · 38세 · 아주 가까움', '아버지 · 김민호 · 39세 · 가까움', '나 · 김도현 · 10세'],
    bg: 'bg-newtown-late',
    back: [],
    house: ['house-apt-late', 0, 200],
    front: [['prop-ac-unit', 300, 150], ['prop-planter', 58, 246], ['prop-parcel', 246, 240], ['prop-bicycle', 324, 244], ['prop-lamp', 614, 246]],
    pets: [['pet-cat-indoor', 300, 166]],
    family: [['fig-young-m-late', 468, 246], ['fig-young-f-late', 514, 248], ['fig-child-m-late', 556, 250]],
  },
};
const byId = Object.fromEntries(PIECES.map((p) => [p.id, p]));
function place(style, [id, x, y, scale = 1]) {
  const h = mk(style);
  return `<g data-piece="${id}" transform="translate(${x} ${y})${scale !== 1 ? ` scale(${scale})` : ''}">${byId[id].draw(h, style)}</g>`;
}
function sceneSvg(style, sc, attrs = '') {
  const L = (name, items) => `<g data-layer="${name}">${items.map((it) => place(style, it)).join('')}</g>`;
  return `<svg class="scene__svg" viewBox="0 0 640 256" preserveAspectRatio="xMidYMid slice" ${attrs}>${L('배경', [[sc.bg, 0, 0]])}${L('소품-뒤', sc.back)}${L('집', [sc.house])}${L('소품-앞', sc.front)}${L('반려동물', sc.pets)}${L('식구', sc.family)}</svg>`;
}

// ---------------------------------------------------------------- 조각 파일 + 예산 실측
const STYLES = { s1: '종이 오림', s2: '굵은 선 그림책' };
const budget = { measuredAt: '2026-10-27', note: 'raw·gz는 조각 안쪽 마크업(<g> 내용) 바이트. chunk는 그림체의 조각 전부를 {id: 마크업} JSON으로 묶어 gzip한 값(실제 덩어리에 가까운 추정). 예산(SPEC-009 FH8 ▲): 조각 평균 gzip ≤ 0.45KB · 조각 덩어리 ≤ 45KB(93조각) · family 덩어리 합계 ≤ 75KB.', styles: {} };
for (const s of Object.keys(STYLES)) {
  const h = mk(s);
  const rows = [];
  const chunk = {};
  for (const p of PIECES) {
    const inner = p.draw(h, s);
    chunk[p.id] = inner;
    const raw = Buffer.byteLength(inner, 'utf8');
    const gz = gzipSync(Buffer.from(inner, 'utf8')).length;
    rows.push({ id: p.id, layer: p.layer, raw, gz });
    const [x, y, w, hh] = p.box;
    write(`pieces/${s}/${p.id}.svg`, `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${x} ${y} ${w} ${hh}" width="${w * 2}" height="${hh * 2}"><!-- 수저 게임 · 집과 가족 그림 조각 · ${STYLES[s]} · ${p.id} (${p.layer}) · 직접 제작, 색은 --c-scene-* 토큰(기본값 = 라이트) --><rect x="${x}" y="${y}" width="${w}" height="${hh}" fill="${T('sky')}"/><g>${inner}</g></svg>\n`);
  }
  const chunkStr = JSON.stringify(chunk);
  const chunkGz = gzipSync(Buffer.from(chunkStr, 'utf8')).length;
  const sum = (k) => rows.reduce((a, r) => a + r[k], 0);
  budget.styles[s] = { name: STYLES[s], pieces: rows.length, rawTotal: sum('raw'), gzEachTotal: sum('gz'), gzEachAvg: Math.round(sum('gz') / rows.length), chunkRaw: Buffer.byteLength(chunkStr, 'utf8'), chunkGz, chunkPerPiece: Math.round(chunkGz / rows.length), projected93: Math.round((chunkGz / rows.length) * 93), projected110: Math.round((chunkGz / rows.length) * 110), rows };
}
write('budget.json', JSON.stringify(budget, null, 2) + '\n');

// ---------------------------------------------------------------- family.css (시안 전용 — 토큰 제안 + 그림 카드 규칙)
const tokenBlock = (o, indent = '  ') => Object.entries(o).map(([k, v]) => `${indent}--c-scene-${k}: ${v};`).join('\n');
write('family.css', `/* SPEC-009 FM2 집과 가족 그림 — 시안 전용 CSS (designer 2026-10-27). 토큰은 **제안**이다(tokens.css에 없는 새 이름 --c-scene-*; 마스터 확정 뒤 developer가 tokens.css로 옮긴다).
   라이트 값은 SVG 조각의 fallback과 같다(buildFamilyMockups.mjs LIGHT). 다크는 같은 그림을 어두운 종이에 놓은 것 — 낮밤·계절 표현이 아니다(SPEC-009 안 할 것).
   얼굴 시스템과 공유: 살색·머리색은 --c-face-* 값과 같다(사람이 같은 사람으로 보이게). */
:root {
${tokenBlock(LIGHT)}
}
@media (prefers-color-scheme: dark) {
  :root:not([data-theme='light']) {
${tokenBlock(DARK, '    ')}
  }
}
:root[data-theme='dark'] {
${tokenBlock(DARK)}
}

/* 그림 카드 — 가운데 열: 결정 카드 → 이 카드 → (올해 마음 쓸 곳 자리) → 인생 기록 (FH1). 그림은 카드 위끝에 꽉 차게(이미지창), 아래 한 줄·펼침·접기 */
.scene-card { padding-top: 0; overflow: hidden; }
.scene-card[data-fold='true'] { padding-top: var(--sp-4); }
.scene-card[data-fold='true'] .scene { display: none; }
.scene { margin: 0 calc(-1 * var(--sp-4)); background: var(--c-scene-sky); }
/* 높이: 폭 ÷ 2.5, 화면 높이의 25%를 넘지 않는다(FH1 ▲). 넘으면 양옆을 조금 잘라 보인다(preserveAspectRatio slice — 안전 영역 x 20~620) */
.scene__svg { display: block; width: 100%; aspect-ratio: 640 / 256; max-height: 25vh; forced-color-adjust: none; }
.scene__line { margin: var(--sp-3) 0 0; font-size: var(--fs-sm); line-height: var(--lh-normal, 1.5); color: var(--c-text); font-weight: var(--fw-bold); word-break: keep-all; overflow-wrap: anywhere; }
.scene__row { display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: start; gap: var(--sp-2) var(--sp-3); margin-top: var(--sp-2); }
.scene__more { flex: 1 1 auto; min-width: 0; }
.scene__more > summary { display: inline-flex; align-items: center; min-height: var(--hit); padding: 0 var(--sp-1); cursor: pointer; font-size: var(--fs-sm); color: var(--c-text-2); list-style: none; }
.scene__more > summary::-webkit-details-marker { display: none; }
.scene__more > summary::before { content: ''; display: inline-block; width: 7px; height: 7px; margin-right: var(--sp-2); border-right: 2px solid currentColor; border-bottom: 2px solid currentColor; transform: rotate(-45deg); transition: transform var(--dur) var(--ease, ease); }
.scene__more[open] > summary::before { transform: rotate(45deg); }
.scene__more > summary:focus-visible { outline: 3px solid var(--c-focus); outline-offset: 2px; border-radius: var(--r-sm); }
.scene__people { margin: var(--sp-2) 0 0; padding: 0 0 0 var(--sp-2); list-style: none; display: grid; gap: var(--sp-1); font-size: var(--fs-sm); color: var(--c-text); }
.scene__people li { padding-left: var(--sp-3); position: relative; }
.scene__people li::before { content: ''; position: absolute; left: 0; top: 0.65em; width: 5px; height: 5px; border-radius: 50%; background: var(--c-text-3); }
.scene__open { margin: var(--sp-2) 0 0; }
/* 바뀌는 해의 교차 페이드(FH4 ▲): 두 그림을 겹쳐 두고 앞 그림의 불투명도만 바꾼다. 움직임 줄이기면 --dur-slow가 0.01ms라 즉시 교체된다(tokens.css) */
.scene--swap .scene__svg { transition: opacity var(--dur-slow) var(--ease, ease); }
@media (max-width: 959px) {
  /* 휴대폰: 결정 카드 바로 아래(둘 다 order -1, 문서 순서대로 결정 → 그림), 그 다음 프로필·스탯·… 인생 기록(DB1) */
  .scene-card { order: -1; }
}
@media (forced-colors: active) {
  .scene { border-bottom: 1px solid CanvasText; }
  .scene__people li::before { background: CanvasText; }
}
`);

// ---------------------------------------------------------------- compare.html / pieces.html
const HEAD = (title, extra = '') => `<!doctype html>
<html lang="ko" data-paper="1">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<!-- 시안(정적 HTML, 가짜 데이터) — SPEC-009 FM2 그림체 게이트. ?theme=dark 다크 · ?style=s1|s2 · ?scene=a|b · ?w=328 그림 폭 -->
<link rel="stylesheet" href="../../../../src/styles/tokens.css">
<link rel="stylesheet" href="../ds.css">
<link rel="stylesheet" href="../gm3/gm3.css">
<link rel="stylesheet" href="family.css">
<script>(function(){var q=new URLSearchParams(location.search);var t=q.get('theme');if(t==='dark'||t==='light')document.documentElement.setAttribute('data-theme',t);if(q.get('motion')==='reduce')document.documentElement.setAttribute('data-motion','reduce');var w=q.get('w');if(w)document.documentElement.style.setProperty('--pic-w',w+'px');})();</script>
${extra}
</head>`;
const sceneCardStandalone = (style, sc) => `<figure class="cmp__fig" data-style="${style}" data-scene="${sc.id}"><div class="cmp__pic"><svg class="scene__svg" viewBox="0 0 640 256" role="img" aria-label="${sc.line}. ${sc.petLine}" focusable="false">${sceneSvg(style, sc).replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '')}</svg></div><figcaption class="scene__line">${sc.line}</figcaption></figure>`;

write('compare.html', `${HEAD('수저 게임 · 시안 · 집과 가족 그림 — 그림체 두 가지(SPEC-009 FM2)', `<style>
.cmp { max-width: 1120px; margin: 0 auto; padding: var(--sp-6) var(--gutter) var(--sp-10); }
.cmp h1 { font-size: var(--fs-2xl); line-height: var(--lh-snug); margin: 0 0 var(--sp-2); }
.cmp__lead { margin: 0 0 var(--sp-6); color: var(--c-text-2); max-width: 64ch; }
.cmp__style { margin: 0 0 var(--sp-8); }
.cmp__style h2 { font-size: var(--fs-xl); margin: 0 0 var(--sp-1); }
.cmp__style p { margin: 0 0 var(--sp-4); color: var(--c-text-2); max-width: 72ch; }
.cmp__grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 420px), 1fr)); gap: var(--sp-4); }
.cmp__fig { margin: 0; background: var(--c-surface); border: 1px solid var(--c-border); border-radius: var(--r-lg); overflow: hidden; padding: 0 var(--sp-4) var(--sp-4); max-width: var(--pic-w, none); }
.cmp__pic { margin: 0 calc(-1 * var(--sp-4)); background: var(--c-scene-sky); }
.cmp__pic .scene__svg { max-height: none; }
.cmp__links { display: flex; flex-wrap: wrap; gap: var(--sp-3); font-size: var(--fs-sm); margin: 0 0 var(--sp-6); }
</style>`)}
<body>
<main class="cmp">
<h1>집과 가족 그림 — 그림체 두 가지</h1>
<p class="cmp__lead">같은 장면 둘을 두 벡터 그림체로 그렸습니다. 둘 다 조각(배경·소품·집·식구·반려동물)을 자리에 놓아 합친 것이고, 색은 디자인 토큰만 읽습니다. 시안이라 이름·나이는 가짜 값입니다.</p>
<nav class="cmp__links" aria-label="보기"><a href="compare.html">라이트</a><a href="compare.html?theme=dark">다크</a><a href="dashboard-family.html">대시보드 자리(그림체 1)</a><a href="dashboard-family.html?style=s2">대시보드 자리(그림체 2)</a><a href="pieces.html">조각 표</a></nav>
${Object.entries(STYLES).map(([s, name], i) => `<section class="cmp__style" data-style="${s}"><h2>그림체 ${i + 1} · ${name}</h2><p>${s === 's1' ? '선이 없습니다. 평평한 종이 조각을 겹쳐 놓고 한 칸 밀린 그림자 조각으로 두께를 냅니다. 얼굴은 그리지 않고 머리 모양·옷으로 사람을 읽습니다 — 조롱이나 닮음이 생길 자리가 없습니다.' : '둥근 먹선 한 굵기와 옅은 채움입니다. 점 눈과 작은 미소는 얼굴 시스템의 「담담한 미소」와 같은 표정이고, 창틀·기와·전선이 모두 같은 선으로 그려져 그림책 한 장처럼 읽힙니다.'}</p><div class="cmp__grid">${['a', 'b'].map((k) => sceneCardStandalone(s, SCENES[k])).join('')}</div></section>`).join('')}
</main>
</body>
</html>
`);

write('pieces.html', `${HEAD('수저 게임 · 시안 · 집과 가족 그림 조각 표(SPEC-009 FM2)', `<style>
.pc { max-width: 1120px; margin: 0 auto; padding: var(--sp-6) var(--gutter) var(--sp-10); }
.pc h1 { font-size: var(--fs-2xl); margin: 0 0 var(--sp-2); }
.pc h2 { font-size: var(--fs-xl); margin: var(--sp-6) 0 var(--sp-3); }
.pc__grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: var(--sp-3); }
.pc__cell { margin: 0; background: var(--c-surface); border: 1px solid var(--c-border); border-radius: var(--r-md); overflow: hidden; }
.pc__cell svg { display: block; width: 100%; height: 110px; background: var(--c-scene-sky); }
.pc__cell figcaption { padding: var(--sp-2); font-size: var(--fs-xs); color: var(--c-text-2); word-break: break-all; }
.pc__cell b { color: var(--c-text); display: block; }
</style>`)}
<body><main class="pc"><h1>집과 가족 그림 조각 표</h1><p>조각마다 안쪽 마크업의 gzip 바이트를 적었습니다(실측은 budget.json). 조각은 층별로 세고, 수저·시대 차이는 크기·색 토큰·자리로만 바꿉니다(FH8).</p>
${Object.entries(STYLES).map(([s, name], i) => `<h2>그림체 ${i + 1} · ${name} — 조각 ${PIECES.length}개 · 덩어리 gzip ${budget.styles[s].chunkGz.toLocaleString('ko-KR')}B(조각당 ${budget.styles[s].chunkPerPiece}B)</h2><div class="pc__grid">${PIECES.map((p) => { const [x, y, w, hh] = p.box; const row = budget.styles[s].rows.find((r) => r.id === p.id); return `<figure class="pc__cell"><svg viewBox="${x} ${y} ${w} ${hh}" preserveAspectRatio="xMidYMid meet" aria-hidden="true" focusable="false">${p.draw(mk(s), s + 'p')}</svg><figcaption><b>${p.id}</b>${p.layer} · gzip ${row.gz}B</figcaption></figure>`; }).join('')}</div>`).join('')}
</main></body></html>
`);

// ---------------------------------------------------------------- dashboard-family.html — gm3/dashboard-004.html(읽기만)에 결정 카드 + 그림 카드를 끼운다
{
  let dash = readFileSync(ROOT + 'docs/design/mockups/gm3/dashboard-004.html', 'utf8');
  const dec = readFileSync(ROOT + 'docs/design/mockups/decision-adult.html', 'utf8');
  const di = dec.indexOf('<section class="card decision decision--inline"');
  const dj = dec.indexOf('</section>', di) + '</section>'.length;
  let decision = dec.slice(di, dj);
  // 시안 맞춤: 1975년생 판의 2000년 · 25세 자리 글자(자리만 — 결정 내용은 decision-adult.html의 실제 카드 그대로)
  decision = decision.replace(/2057년 · 31세/g, '2000년 · 25세').replace(/data-a="2057년" data-b="31세"/, 'data-a="2000년" data-b="25세"');
  // 「잠시 덮어 두기」를 누른 뒤의 접힌 띠(decision-adult.html ?state=collapsed와 같은 마크업) — ?decision=fold
  const fi = dec.indexOf('<section class="card fold"');
  const fold = dec.slice(fi, dec.indexOf('</section>', fi) + '</section>'.length).replace('같은 팀의 사람', '살 곳을 구하는 일');
  // 상태 템플릿(연표 줄 비교용 then/now/projection/none)은 이 시안에 필요 없다 — 지운다
  const ti = dash.indexOf('<template id="state-now">');
  const tj = dash.lastIndexOf('</template>') + '</template>'.length;
  if (ti > 0 && tj > ti) dash = dash.slice(0, ti) + dash.slice(tj);
  dash = dash.replace(/<script>\(function\(\)\{var s=new URLSearchParams\(location\.search\)\.get\('state'\)[\s\S]*?<\/script>\n?/, '');
  dash = dash.replace('<title>수저 게임 · 시안 · 인생 기록 연표 줄·자산 카드 당시 화폐(SPEC-004 GM3)</title>', '<title>수저 게임 · 시안 · 대시보드의 집과 가족 그림 자리(SPEC-009 FM2)</title>');
  dash = dash.replace('<link rel="stylesheet" href="gm3.css">', '<link rel="stylesheet" href="../gm3/gm3.css">\n<link rel="stylesheet" href="family.css">');
  dash = dash.replace('<!-- 시안(정적 HTML, 가짜 데이터): 디자인 시스템 토큰·컴포넌트 스타일을 그대로 불러 쓴다. 주소 끝에 ?theme=dark 를 붙이면 다크 테마, &motion=reduce 면 움직임 줄이기. -->', '<!-- 시안(정적 HTML, 가짜 데이터) — gm3/dashboard-004.html에 결정 카드(decision-adult.html의 인라인 카드)와 집과 가족 그림 카드를 끼운 것(buildFamilyMockups.mjs). ?theme=dark 다크 · &motion=reduce 움직임 줄이기 · ?style=s1|s2 그림체 · ?scene=a|b 장면 · ?fold=1 그림 접힘 · ?open=1 펼침 열림 · ?decision=fold 결정 카드를 「잠시 덮어 두기」로 접은 띠 -->');
  const sceneCard = (style, sc) => `<section class="card scene-card" aria-labelledby="scene-title" data-fold="false" data-testid="family-scene">
<h2 id="scene-title" class="sr-only">집과 가족</h2>
<div class="scene" id="scene-pic">${sceneSvg(style, sc, 'role="img" aria-labelledby="scene-line scene-pets" focusable="false"')}</div>
<p class="scene__line" id="scene-line">${sc.line}</p>
<p class="sr-only" id="scene-pets">${sc.petLine}</p>
<div class="scene__row"><details class="scene__more" id="scene-more"><summary>함께 사는 사람</summary><ul class="scene__people">${sc.people.map((x) => `<li>${x}</li>`).join('')}<li>${sc.petLine.replace(/가 있습니다\.$/, '')}</li></ul><p class="scene__open"><button class="btn btn--ghost btn--sm" type="button">가족과 삶 열기</button></p></details><button class="btn btn--ghost btn--sm scene__fold" type="button" aria-expanded="true" aria-controls="scene-pic" data-testid="scene-fold">그림 접기</button></div>
</section>`;
  const variants = [];
  for (const s of Object.keys(STYLES)) for (const k of ['a', 'b']) variants.push(`<template data-style="${s}" data-scene="${k}">${sceneCard(s, SCENES[k])}</template>`);
  const marker = '<div class="col col--center">';
  const i = dash.indexOf(marker);
  const inject = `${marker}${decision}\n${sceneCard('s1', SCENES.a)}\n<!-- 올해 마음 쓸 곳(SPEC-008) 자리 — 아직 없으면 생략(FH1) -->\n`;
  dash = dash.slice(0, i) + inject + dash.slice(i + marker.length);
  dash = dash.replace('</body>', `${variants.join('\n')}
<template data-decision="fold">${fold}</template>
<script>(function(){var q=new URLSearchParams(location.search);var s=q.get('style')||'s1',k=q.get('scene')||'a';if(q.get('decision')==='fold'){var ft=document.querySelector('template[data-decision="fold"]');var dc=document.querySelector('.decision--inline');if(ft&&dc)dc.replaceWith(ft.content.cloneNode(true));}var cur=document.querySelector('.scene-card');if(!(s==='s1'&&k==='a')){var t=document.querySelector('template[data-style="'+s+'"][data-scene="'+k+'"]');if(t&&cur){cur.replaceWith(t.content.cloneNode(true));cur=document.querySelector('.scene-card');}}
/* 접기(FH1): 접으면 그림만 사라지고 한 줄·펼침은 남는다. 설정에 저장(구현) — 시안은 ?fold=1 */
var btn=cur.querySelector('.scene__fold');function setFold(f){cur.setAttribute('data-fold',f?'true':'false');btn.setAttribute('aria-expanded',f?'false':'true');btn.textContent=f?'그림 펼치기':'그림 접기';}
if(q.get('fold')==='1')setFold(true);btn.addEventListener('click',function(){setFold(cur.getAttribute('data-fold')!=='true');});
if(q.get('open')==='1')cur.querySelector('.scene__more').open=true;})();</script>
</body>`);
  write('dashboard-family.html', dash);
}

console.log('조각', PIECES.length, '× 그림체', Object.keys(STYLES).length);
for (const [s, b] of Object.entries(budget.styles)) console.log(`${s} ${b.name}: 조각별 gzip 평균 ${b.gzEachAvg}B(합 ${b.gzEachTotal}) · 덩어리 gzip ${b.chunkGz}B(조각당 ${b.chunkPerPiece}B) · 93조각 추정 ${b.projected93}B · 110조각 ${b.projected110}B`);
