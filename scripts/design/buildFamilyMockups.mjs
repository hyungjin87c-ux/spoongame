/**
 * SPEC-009 집과 가족 그림 — 시안 생성기 (designer 2026-10-27, FM2 게이트 → FM2b 나머지 장면).
 *
 * 정본 그림체는 **s1 「종이 오림」**(2026-10-27 형진 님 선택, SPEC-009 머리 「FM2 그림체 게이트 통과」) — 선 없음, 평면 조각 + (3,3) 밀린 반투명 그림자 조각, 얼굴 없음.
 * s2 「굵은 선 그림책」은 **비교 자료로만** 남긴다: 기본 실행은 s1만 만들고, `--with-s2`를 붙일 때만 s2 조각·compare.html을 다시 만든다(지우지 않는다).
 *
 * 장면(FH7 게이트 장면 3 + 한계 1 + 앞 게이트의 2):
 *   a 1975 서울 단독주택 셋방 6명 + 마당 개 · b 2005 경기 신도시 아파트 3명 + 실내 고양이 (FM2)
 *   c 1955 전남 농촌 초가 3세대 7명 + 마당 개 · d 2015 서울 다세대 3명 + 실내 개 · e 한계 1968 대구 단독주택 8명 + 개·고양이 (FM2b)
 * 조각은 층(배경 / 시대 소품 / 집 / 식구 / 반려동물)마다 독립된 SVG 조각이고 장면은 조각을 자리(슬롯)에 놓아 합친다(FH2·FH5·FH8).
 * 매체(TV) 조각은 시대 소품 층의 한 묶음이고 집 조각이 내놓는 **실내 자리(창·마루)**에 놓인다 — 화면은 **빈 자리(slot)**만 둔다(형진 님 검토 중, 내용 그림 없음).
 * 색은 디자인 토큰만 읽는다 — `var(--c-scene-*, 기본값)`. 기본값은 라이트 값이라 CSS 없는 뷰어에서도 보인다(FH6 하드코딩 색 0 — 토큰 24개는 마스터 승인, tokens.css 반영은 구현 몫).
 *
 * 실행: node scripts/design/buildFamilyMockups.mjs [--with-s2]
 * 산출: docs/design/mockups/family/{scenes.html, pieces.html, dashboard-family.html, family.css, budget.json, pieces/s1/<id>.svg}
 *       --with-s2: + compare.html, pieces/s2/<id>.svg, budget.json의 s2 항목 (없으면 앞 실측 값을 그대로 둔다)
 *       — dashboard-family.html은 gm3/dashboard-004.html(읽기만)에 결정 카드(decision-adult.html의 인라인 카드)와 그림 카드를 끼운 것.
 * 의존성 없음(Node 내장만). `src/`는 읽지 않는다.
 */
import { gzipSync } from 'node:zlib';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const OUT = ROOT + 'docs/design/mockups/family/';
const WITH_S2 = process.argv.includes('--with-s2');
const STYLES_ALL = { s1: '종이 오림', s2: '굵은 선 그림책' };
const STYLES = WITH_S2 ? STYLES_ALL : { s1: STYLES_ALL.s1 };
for (const s of Object.keys(STYLES)) {
  mkdirSync(OUT + `pieces/${s}`, { recursive: true });
  for (const f of readdirSync(OUT + `pieces/${s}`)) if (f.endsWith('.svg')) rmSync(OUT + `pieces/${s}/` + f); // 조각 id가 바뀌면 옛 파일이 남지 않게
}
const write = (f, s) => writeFileSync(OUT + f, s.replace(/\r\n/g, '\n'), 'utf8');

// ---------------------------------------------------------------- 토큰(승인 24개) — 라이트 기본값 = SVG fallback, 다크는 family.css
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
    rect: (x, y, w, h, fill, o = {}) => el('rect', `x="${r1(x)}" y="${r1(y)}" width="${r1(w)}" height="${r1(h)}"${o.rx ? ` rx="${o.rx}"` : ''}${o.tf ? ` transform="${o.tf}"` : ''}`, fill, o),
    circle: (cx, cy, r, fill, o) => el('circle', `cx="${r1(cx)}" cy="${r1(cy)}" r="${r1(r)}"`, fill, o),
    ellipse: (cx, cy, rx, ry, fill, o) => el('ellipse', `cx="${r1(cx)}" cy="${r1(cy)}" rx="${r1(rx)}" ry="${r1(ry)}"`, fill, o),
    /** 가는 띠(전선·안테나·자전거 살): s2는 먹선, s1은 어두운 조각 색 */
    stroke: (d, w = SW, tok = 'roof2') => `<path d="${d}" fill="none" stroke="${T(line ? 'ink' : tok)}" stroke-width="${line ? w : Math.max(2, w - 0.5)}" stroke-linecap="round" stroke-linejoin="round"/>`,
    /** s2에만 있는 점(눈) */
    dot: (cx, cy, r = 1.4) => (line ? `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${T('face')}"/>` : ''),
    /** s2에만 있는 가는 선(입·옷 선) */
    ink: (d, w = 1.6) => (line ? `<path d="${d}" fill="none" stroke="${T('face')}" stroke-width="${w}" stroke-linecap="round"/>` : ''),
  };
}
const r1 = (n) => Math.round(n * 10) / 10;

// ---------------------------------------------------------------- 식구 조각 (발바닥 가운데가 원점)
/**
 * 연령대 기하(FH2 ④ — 얼굴 시스템 ageGroupOf와 같은 경계): H 키 · r 머리 반지름 · sw 어깨 폭(여/남).
 * infant(0~2)는 업힌 조각(fig-infant-carried)이 맡는다.
 */
const AGE_GEO = {
  toddler: { H: 50, r: 8, sw: [15, 16] },
  child: { H: 66, r: 9, sw: [18, 20] },
  teen: { H: 84, r: 10, sw: [21, 25] },
  young: { H: 94, r: 10.5, sw: [24, 30] },
  middle: { H: 94, r: 10.5, sw: [25, 31] },
  senior: { H: 86, r: 10.5, sw: [24, 29] },
  elder: { H: 80, r: 10, sw: [23, 27] },
};
/**
 * 시대 옷(FH8 「시대 옷 3종 × 성별 2」): e1 ~1965 생활 한복 · e2 1966~1999 · e3 2000~. 경계는 ▲(FD15·FD23 뒤 확정).
 * 장년·노년은 e2까지 한복을 유지한다(파라미터 — 조각을 늘리지 않는다).
 */
const OUTFIT = {
  e1: { f: 'hanbok', m: 'hanbok-m', girl: 'hanbok', boy: 'hanbok-m' },
  e2: { f: 'blouse-skirt', m: 'shirt-trousers', girl: 'dress', boy: 'shirt-shorts' },
  e3: { f: 'cardigan-pants', m: 'polo-trousers', girl: 'dress', boy: 'tee-shorts' },
};
const HAIR = { e1: { f: 'bun', m: 'short-m', girl: 'bob', boy: 'boy' }, e2: { f: 'perm', m: 'short-m', girl: 'bob', boy: 'boy' }, e3: { f: 'tied', m: 'short-m', girl: 'bob', boy: 'boy' } };
/** 연령대 × 성별 × 시대 → person() 스펙 (조각 id `fig-<age>-<sex>-<era>`) */
function figSpec(age, sex, era, o = {}) {
  const g = AGE_GEO[age];
  const kid = age === 'toddler' || age === 'child';
  const old = age === 'senior' || age === 'elder';
  const key = kid ? (sex === 'f' ? 'girl' : 'boy') : sex;
  const outfitEra = old && era === 'e2' ? 'e1' : era; // 장년·노년은 e2까지 한복
  const outfit = o.outfit || OUTFIT[outfitEra][key];
  const hair = o.hair || (old ? (sex === 'f' ? 'bun' : 'short-m') : HAIR[era][key]);
  const toks = o.toks || defaultToks(outfit, sex, old);
  return { H: g.H, r: g.r, sw: g.sw[sex === 'f' ? 0 : 1], outfit, hair, hairTok: old ? 'hairw' : 'hair', toks, cane: age === 'elder', shoeTok: o.shoeTok };
}
function defaultToks(outfit, sex, old) {
  switch (outfit) {
    case 'hanbok': return old ? { a: 'cloth3', b: 'cloth4', c: 'cloth1' } : { a: 'cloth3', b: 'cloth1', c: 'cloth2' };
    case 'hanbok-m': return old ? { a: 'cloth3', b: 'cloth3', c: 'cloth1', v: 'cloth1' } : { a: 'cloth3', b: 'cloth4', c: 'cloth1' };
    case 'blouse-skirt': return { a: 'cloth2', b: 'cloth1' };
    case 'shirt-trousers': return { a: 'cloth3', b: 'cloth1' };
    case 'cardigan-pants': return { a: 'cloth1', b: 'cloth4' };
    case 'polo-trousers': return { a: 'cloth4', b: 'roof2' };
    case 'dress': return { a: 'cloth1' };
    case 'tee-shorts': return { a: 'cloth2', b: 'cloth1' };
    case 'shirt-shorts': return { a: 'cloth3', b: 'cloth4' };
  }
  return { a: 'cloth1', b: 'cloth4' };
}
/**
 * p: { H 키, r 머리 반지름, sw 어깨 폭, outfit, hair, hairTok, toks:{a,b,c,v} 옷 색, cane, shoeTok }
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
    return h.rect(-w / 2, 0, w, armL, T(tok), { rx: w / 2, tf: `translate(${r1(x0)} ${r1(shY + 3)}) rotate(${s * 12})` }) + h.circle(ex, ey, 3.4, T('skin'));
  };
  const shoes = (lw, tok = p.shoeTok || 'roof2') => h.rect(-lw - 1, -4, lw + 1.5, 4, T(tok), { rx: 2 }) + h.rect(-0.5, -4, lw + 1.5, 4, T(tok), { rx: 2 });
  const legsSkin = (fromY, x = 2.5, w = 5) => h.rect(-x - w, fromY, w, -fromY, T('skin'), { flat: !h.line }) + h.rect(x, fromY, w, -fromY, T('skin'), { flat: !h.line });
  // 뒤에 오는 것(배낭·머리 옆 조각·쪽·지팡이)
  if (p.outfit === 'tee-shorts') out.push(h.rect(-sw / 2 - 3, shY + 2, sw + 6, (hipY - shY) * 0.8, T('roof2'), { rx: 5 }));
  if (p.cane) out.push(h.rect(sw / 2 + 6, hipY - 2, 2.5, -hipY + 2, T('wood'), { rx: 1 }));
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
    case 'hanbok-m': {
      // 바지저고리 — 넉넉한 바지, 발목 대님, 고무신(흰 또는 검정 — shoeTok)
      const lw = sw * 0.42;
      out.push(h.rect(-lw - 1, hipY - 3, lw, -hipY + 3 - 4, T(tk.b), { rx: 4, shade: true }), h.rect(1, hipY - 3, lw, -hipY + 3 - 4, T(tk.b), { rx: 4 }));
      out.push(h.rect(-lw - 1, -7, lw, 2.5, T(tk.c), { flat: true }), h.rect(1, -7, lw, 2.5, T(tk.c), { flat: true }));
      out.push(h.ellipse(-5.5, -2.2, 5.6, 2.4, T(p.shoeTok || 'cloth3')), h.ellipse(5.5, -2.2, 5.6, 2.4, T(p.shoeTok || 'cloth3')));
      break;
    }
    case 'blouse-skirt': {
      const hemY = -H * 0.14;
      out.push(legsSkin(hemY), shoes(7), h.path(`M ${r1(-sw / 2 + 2)},${r1(hipY - 3)} L ${r1(sw / 2 - 2)},${r1(hipY - 3)} L ${r1(sw / 2 + 8)},${r1(hemY)} L ${r1(-sw / 2 - 8)},${r1(hemY)} Z`, T(tk.b), { shade: true }));
      break;
    }
    case 'hanbok': {
      const chestY = shY + H * 0.1;
      const hemY = -H * 0.05;
      out.push(h.ellipse(-5.5, -2.2, 5.2, 2.4, T('cloth3')), h.ellipse(5.5, -2.2, 5.2, 2.4, T('cloth3')));
      out.push(h.path(`M ${r1(-sw / 2)},${r1(chestY)} L ${r1(sw / 2)},${r1(chestY)} L ${r1(sw / 2 + 15)},${r1(hemY)} L ${r1(-sw / 2 - 15)},${r1(hemY)} Z`, T(tk.b), { shade: true }));
      break;
    }
    case 'dress': {
      const hemY = -H * 0.32;
      out.push(legsSkin(hemY, 2, 4.5), shoes(6));
      break;
    }
    case 'tee-shorts':
    case 'shirt-shorts': {
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
      if (p.outfit === 'polo-trousers') out.push(h.path(`M -6,${r1(shY + 1)} L 0,${r1(shY + 8)} L 6,${r1(shY + 1)} Z`, T('cloth3'), { flat: true }));
      else out.push(h.ink(`M -5,${shY + 1} L 0,${shY + 7} L 5,${shY + 1}`), h.ink(`M 0,${shY + 9} V ${hipY - 2}`, 1.2));
      break;
    case 'blouse-skirt':
      out.push(h.rect(-sw / 2, shY, sw, hipY - shY + 1, T(tk.a), { rx: 5 }), arm(-1), arm(1), h.path(`M -5,${r1(shY)} a 5 4 0 0 0 10 0 Z`, T('cloth3'), { flat: true }));
      break;
    case 'hanbok': {
      const chestY = shY + H * 0.1;
      out.push(h.rect(-sw / 2 - 1, shY, sw + 2, chestY - shY + 5, T(tk.a), { rx: 4 }), arm(-1, 10, tk.a), arm(1, 10, tk.a));
      out.push(h.path(`M -1.5,${r1(chestY - 1)} l 4,0 l 2,13 l -5,0 Z`, T(tk.c), { flat: true }), h.ink(`M 0,${shY + 9} l -7,-8 M 0,${shY + 9} l 7,-8`));
      break;
    }
    case 'hanbok-m': {
      // 저고리(넓은 소매) + 고름 + 조끼(v가 있을 때)
      out.push(h.rect(-sw / 2 - 1, shY, sw + 2, hipY - shY + 6, T(tk.a), { rx: 4, shade: true }), arm(-1, 10, tk.a), arm(1, 10, tk.a));
      if (tk.v) out.push(h.rect(-sw / 2 + 3, shY + 1, sw - 6, hipY - shY + 1, T(tk.v), { flat: true, rx: 3 }));
      out.push(h.path(`M -1,${r1(shY + 5)} l 3,0 l 1.5,12 l -4.5,0 Z`, T(tk.c), { flat: true }), h.ink(`M 0,${shY + 8} l -6,-7 M 0,${shY + 8} l 6,-7`));
      break;
    }
    case 'dress': {
      const hemY = -H * 0.32;
      out.push(h.path(`M ${r1(-sw / 2)},${r1(shY)} L ${r1(sw / 2)},${r1(shY)} L ${r1(sw / 2 + 7)},${r1(hemY)} L ${r1(-sw / 2 - 7)},${r1(hemY)} Z`, T(tk.a), { shade: true }), arm(-1, 6), arm(1, 6));
      out.push(h.path(`M -5,${r1(shY)} a 5 4 0 0 0 10 0 Z`, T('cloth3'), { flat: true }));
      break;
    }
    case 'tee-shorts':
      out.push(h.rect(-sw / 2, shY, sw, hipY - shY + 2, T(tk.a), { rx: 5, shade: true }), arm(-1, 6), arm(1, 6));
      out.push(h.rect(-sw / 2 + 3, shY + 1, 4, hipY - shY - 4, T('roof2'), { flat: true, rx: 2 }), h.rect(sw / 2 - 7, shY + 1, 4, hipY - shY - 4, T('roof2'), { flat: true, rx: 2 }));
      break;
    case 'shirt-shorts':
      out.push(h.rect(-sw / 2, shY, sw, hipY - shY + 2, T(tk.a), { rx: 5, shade: true }), arm(-1, 6), arm(1, 6));
      out.push(h.path(`M -4.5,${r1(shY + 0.5)} L 0,${r1(shY + 6)} L 4.5,${r1(shY + 0.5)} Z`, T(tk.b), { flat: true }));
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
/** 머리 모양 — 머리 위를 덮는 조각(앞) + 머리 뒤에 오는 조각(뒤). */
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

// ---------------------------------------------------------------- 공통 그리기 도우미(집)
/** 기와 물결 — 반복 도형. 구현은 <pattern> 하나로 줄인다(family-scene.md 4절) */
const tiles = (h, x0, x1, y, n) => { let d = ''; const step = (x1 - x0) / n; for (let i = 0; i < n; i++) d += `M ${r1(x0 + i * step)},${y} a ${r1(step / 2)} ${r1(step / 2)} 0 0 0 ${r1(step)} 0 Z `; return h.path(d.trim(), T('roof2'), { flat: !h.line, w: 2 }); };
/** 창호(문살) — 마루 뒤의 방문 */
const lattice = (h, x, y, w, hh) => h.rect(x, y, w, hh, T('cloth3')) + h.stroke(`M ${r1(x + w / 2)},${y} V ${r1(y + hh)} M ${x},${r1(y + hh / 3)} H ${r1(x + w)} M ${x},${r1(y + (2 * hh) / 3)} H ${r1(x + w)}`, 1.5, 'wood');

// ---------------------------------------------------------------- 조각 정의 (id · 층 · 상자 [x,y,w,h] · 연도 · 그리기 · 슬롯)
/**
 * years: [처음, 마지막] — 그 해에 없던 것이 그려지지 않는다(FH2 ②, WORD_YEARS·DC14 방식). null = 제한 없음. ▲ = 확인 전.
 * slots: 집 조각이 내놓는 자리(그림 좌표계 640×256에서 집 원점 기준) — screen(매체) · window(실내 반려동물) · porch(마루).
 */
const PIECES = [
  // ── 배경 (종류 4 × 시대 3 = 12 예정 — 이 시안 5) ──
  { id: 'bg-rural-b1', layer: '배경', years: [1940, 1969], box: [0, 0, 640, 256], draw: (h) => [
    h.rect(0, 0, 640, 200, T('sky'), { flat: true }),
    h.path('M 0,126 Q 80,80 160,112 Q 240,74 330,106 Q 420,70 520,104 Q 580,86 640,108 L 640,200 L 0,200 Z', T('far2'), { flat: true }),
    h.path('M 0,150 Q 70,128 150,146 Q 240,120 340,142 Q 440,124 530,146 Q 590,134 640,148 L 640,200 L 0,200 Z', T('far'), { flat: true }),
    // 논 — 가로 띠(둑)
    h.rect(0, 200, 640, 56, T('ground'), { flat: true }),
    h.rect(0, 214, 640, 3, T('ground2'), { flat: true }), h.rect(0, 226, 640, 3, T('ground2'), { flat: true }), h.rect(0, 238, 640, 18, T('ground2'), { flat: true }),
  ].join('') },
  { id: 'bg-town-b1', layer: '배경', years: [1940, 1969], box: [0, 0, 640, 256], draw: (h) => [
    h.rect(0, 0, 640, 200, T('sky'), { flat: true }),
    h.path('M 0,124 Q 110,72 200,110 Q 280,78 380,104 Q 470,66 560,100 Q 600,92 640,104 L 640,200 L 0,200 Z', T('far2'), { flat: true }),
    // 낮은 지붕선 성글게 + 굴뚝 하나
    h.path('M 0,166 L 30,156 L 60,166 L 90,152 L 124,166 L 150,158 L 184,166 L 210,150 L 244,166 L 280,160 L 310,168 L 340,154 L 376,168 L 410,160 L 440,168 L 476,152 L 510,168 L 544,160 L 580,168 L 612,156 L 640,166 L 640,200 L 0,200 Z', T('far'), { flat: true }),
    h.rect(300, 126, 7, 34, T('far'), { flat: true }),
    h.rect(0, 200, 640, 56, T('ground'), { flat: true }), h.rect(0, 238, 640, 18, T('ground2'), { flat: true }),
  ].join('') },
  { id: 'bg-metro-b2', layer: '배경', years: [1970, 1999], box: [0, 0, 640, 256], draw: (h) => [
    h.rect(0, 0, 640, 200, T('sky'), { flat: true }),
    h.path('M 0,118 Q 90,66 170,104 Q 230,70 300,96 Q 360,60 440,98 Q 520,66 640,110 L 640,200 L 0,200 Z', T('far2'), { flat: true }),
    // 1970년대 서울 — 낮은 집들의 지붕선(먼 동네)
    h.path('M 0,160 L 24,150 L 48,160 L 60,146 L 86,160 L 110,154 L 130,142 L 154,158 L 180,152 L 200,140 L 230,156 L 256,150 L 276,160 L 300,148 L 330,160 L 352,150 L 376,162 L 400,154 L 428,142 L 456,158 L 484,152 L 510,164 L 540,150 L 566,162 L 596,154 L 620,164 L 640,156 L 640,200 L 0,200 Z', T('far'), { flat: true }),
    h.rect(0, 200, 640, 56, T('ground'), { flat: true }),
    h.rect(0, 238, 640, 18, T('ground2'), { flat: true }),
  ].join('') },
  { id: 'bg-town-b3', layer: '배경', years: [2000, null], box: [0, 0, 640, 256], draw: (h, s) => {
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
  { id: 'bg-metro-b3', layer: '배경', years: [2000, null], box: [0, 0, 640, 256], draw: (h, s) => {
    const pid = `${s}-win3`;
    // 2010년대 대도시 — 산 능선 앞에 높고 촘촘한 건물, 틈 없이
    const towers = [[-20, 40, 70], [46, 18, 60], [102, 52, 80], [178, 8, 54], [228, 36, 92], [316, 60, 60], [372, 14, 76], [444, 44, 70], [510, 26, 58], [564, 50, 90]];
    return [
      h.rect(0, 0, 640, 200, T('sky'), { flat: true }),
      h.path('M 0,96 Q 120,40 240,84 Q 360,36 480,80 Q 560,56 640,90 L 640,200 L 0,200 Z', T('far2'), { flat: true }),
      `<defs><pattern id="${pid}" width="16" height="14" patternUnits="userSpaceOnUse"><rect x="4" y="4" width="8" height="6" fill="${T('far2')}"/></pattern></defs>`,
      ...towers.map(([x, y, w]) => h.rect(x, y, w, 200 - y, T('far'), { flat: true }) + `<rect x="${x + 3}" y="${y + 5}" width="${w - 6}" height="${195 - y}" fill="url(#${pid})"/>`),
      h.rect(0, 200, 640, 56, T('ground'), { flat: true }),
      h.rect(0, 238, 640, 18, T('ground2'), { flat: true }),
    ].join('');
  } },
  // ── 집 (주택 종류 6 + 큰 집 1 = 7 × 시대 3 = 21 예정 — 이 시안 4) ──
  { id: 'house-detached-h1', layer: '집', years: [1940, 1969], box: [-4, -130, 372, 130], params: 'roof: thatch | tile',
    slots: { porch: [214, 0], screen: [232, -30], window: [232, -30] },
    draw: (h, s, o = {}) => {
      const thatch = (o.roof || 'thatch') === 'thatch';
      return [
        // 사립문·돌담(왼쪽) — 낮은 담, 나뭇가지 문
        h.rect(0, -34, 44, 34, T('wall2'), { shade: true }), h.rect(10, -30, 24, 30, T('wood')), h.stroke('M 14,-28 V -4 M 22,-28 V -4 M 30,-28 V -4', 1.5, 'wall2'),
        // 본채 — 흙벽, 마루(툇마루) 가운데, 양옆 방문(창호)
        h.rect(56, -78, 300, 78, T(thatch ? 'wall2' : 'wall'), { shade: true }),
        h.rect(56, -12, 300, 12, T('ground2')),
        // 마루: 나무 판 + 기둥
        h.rect(150, -72, 130, 60, T('wood')), h.stroke('M 150,-56 H 280 M 150,-40 H 280 M 150,-24 H 280', 1.5, 'clay'),
        h.rect(146, -78, 6, 66, T('clay')), h.rect(278, -78, 6, 66, T('clay')),
        lattice(h, 76, -66, 50, 44), lattice(h, 304, -66, 40, 44), lattice(h, 170, -70, 36, 34), lattice(h, 232, -70, 36, 34),
        // 지붕 — 초가(둥근 어깨) 또는 기와(물결)
        thatch
          ? h.path('M 34,-76 Q 40,-92 70,-108 Q 110,-124 206,-124 Q 302,-124 342,-108 Q 372,-92 378,-76 Q 300,-82 206,-82 Q 112,-82 34,-76 Z', T('clay'), { shade: true }) + h.path('M 96,-114 Q 150,-121 206,-121 Q 262,-121 316,-114 Q 262,-110 206,-110 Q 150,-110 96,-114 Z', T('wood'), { flat: true })
          : h.path('M 36,-78 L 72,-112 L 338,-112 L 376,-78 Z', T('roof'), { shade: true }) + h.rect(72, -115, 266, 5, T('roof2'), { rx: 1 }) + h.rect(36, -81, 340, 6, T('roof2'), { rx: 1 }) + tiles(h, 38, 374, -75, 21),
        // 굴뚝(부엌 쪽)
        h.rect(330, -100, 7, 24, T('clay'), { rx: 1 }),
      ].join('');
    } },
  { id: 'house-detached-rent-h2', layer: '집', years: [1970, 1999], box: [-4, -140, 408, 140], slots: { screen: [105, -73], window: [105, -73], porch: null },
    draw: (h) => [
      // 담장과 대문(왼쪽)
      h.rect(0, -54, 52, 54, T('wall2'), { shade: true }), h.rect(-2, -60, 56, 7, T('roof'), { rx: 1 }),
      h.rect(12, -50, 15, 50, T('wood')), h.rect(29, -50, 15, 50, T('wood')), h.dot(24, -26, 1.2), h.dot(32, -26, 1.2),
      // 본채
      h.rect(60, -100, 230, 100, T('wall'), { shade: true }),
      h.rect(60, -10, 230, 10, T('wood')),
      h.path('M 44,-100 L 78,-130 L 272,-130 L 306,-100 Z', T('roof'), { shade: true }), h.rect(78, -133, 194, 5, T('roof2'), { rx: 1 }),
      h.rect(44, -103, 262, 6, T('roof2'), { rx: 1 }), tiles(h, 46, 304, -97, 16),
      h.rect(84, -88, 42, 30, T('glass')), h.stroke('M 105,-88 V -58 M 84,-73 H 126', 2), h.rect(222, -88, 44, 30, T('glass')), h.stroke('M 244,-88 V -58 M 222,-73 H 266', 2),
      h.rect(158, -86, 40, 76, T('wood')), h.stroke('M 178,-86 V -10 M 158,-50 H 198', 2),
      // 셋방(문간방) — 따로 난 문과 작은 창, 연탄 아궁이 굴뚝
      h.rect(290, -74, 98, 74, T('wall2'), { shade: true }),
      h.path('M 284,-74 L 298,-96 L 394,-96 L 398,-74 Z', T('roof'), { shade: true }), h.rect(284, -77, 114, 5, T('roof2'), { rx: 1 }), tiles(h, 286, 398, -71, 7),
      h.rect(372, -110, 6, 16, T('roof2'), { rx: 1 }),
      h.rect(338, -66, 26, 66, T('wood')), h.stroke('M 338,-34 H 364', 2), h.dot(358, -30, 1.2),
      h.rect(300, -62, 26, 20, T('glass')), h.stroke('M 313,-62 V -42', 2),
    ].join('') },
  { id: 'house-apt-h3', layer: '집', years: [2000, null], box: [0, -200, 400, 200], slots: { screen: [305, -168], window: [300, -166], porch: null },
    draw: (h) => {
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
  { id: 'house-multi-h3', layer: '집', years: [2000, null], box: [0, -170, 330, 170], slots: { screen: [214, -112], window: [122, -112], porch: null },
    draw: (h) => {
      // 2010년대 다세대 — 4층 벽돌 빌라, 1층 필로티 주차, 바깥 계단, 옥상 난간
      const floor = (y) => [h.rect(28, y, 60, 30, T('glass')), h.stroke(`M 58,${y} V ${y + 30} M 28,${y + 15} H 88`, 2), h.rect(180, y, 70, 30, T('glass')), h.stroke(`M 215,${y} V ${y + 30} M 180,${y + 15} H 250`, 2), h.rect(20, y + 30, 240, 6, T('wall2'), { flat: true })].join('');
      return [
        h.rect(10, -160, 270, 160, T('clay'), { shade: true }), h.rect(272, -160, 8, 160, T('wood'), { flat: true }),
        h.rect(10, -166, 270, 8, T('wall2'), { rx: 1 }), h.stroke('M 20,-166 V -174 M 60,-166 V -174 M 100,-166 V -174 M 140,-166 V -174 M 180,-166 V -174 M 220,-166 V -174 M 260,-166 V -174 M 16,-172 H 276', 1.5, 'wall2'),
        floor(-150), floor(-110), floor(-70),
        // 1층 필로티 — 기둥 셋, 어두운 안쪽
        h.rect(10, -34, 270, 34, T('roof2'), { flat: true }), h.rect(24, -34, 10, 34, T('wall2')), h.rect(135, -34, 10, 34, T('wall2')), h.rect(246, -34, 10, 34, T('wall2')),
        // 바깥 계단(오른쪽)
        h.rect(282, -156, 38, 156, T('wall2'), { shade: true }), h.stroke('M 286,-20 H 316 M 286,-60 H 316 M 286,-100 H 316 M 286,-140 H 316', 2, 'wall'),
        h.rect(282, -8, 38, 8, T('ground2')),
      ].join('');
    } },
  // ── 시대 소품 (시대 4단계별 5 + 공통 8 = 28 예정 — 이 시안 15 + 매체 6) ──
  { id: 'prop-pole', layer: '소품', years: [1960, null], box: [-14, -150, 330, 150], draw: (h) => [
    h.rect(-3, -140, 6, 140, T('wood'), { rx: 1 }), h.rect(-14, -128, 28, 4, T('wood')), h.rect(-14, -118, 28, 4, T('wood')),
    h.ellipse(-10, -130, 2.5, 2.5, T('wall2')), h.ellipse(0, -130, 2.5, 2.5, T('wall2')), h.ellipse(10, -130, 2.5, 2.5, T('wall2')),
    h.stroke('M 10,-129 q 150,16 300,-6 M 10,-119 q 150,16 300,-6', 1.5),
  ].join('') },
  { id: 'prop-antenna', layer: '소품', years: [1961, 2005], box: [-16, -36, 32, 36], draw: (h) => h.stroke('M 0,0 V -32 M -14,-32 H 14 M -10,-26 H 10 M -6,-20 H 6 M 0,-12 L 8,-4', 2) },
  { id: 'prop-briquettes', layer: '소품', years: [1955, 1989], box: [-26, -36, 52, 36], draw: (h) => {
    const one = (x, y) => h.rect(x, y, 14, 16, T('roof2'), { rx: 1 }) + h.ellipse(x + 7, y, 7, 2.6, T('roof')) + h.dot(x + 4, y, 0.9) + h.dot(x + 7, y - 0.4, 0.9) + h.dot(x + 10, y, 0.9);
    return one(-24, -16) + one(-8, -16) + one(8, -16) + one(-16, -32) + one(0, -32);
  } },
  { id: 'prop-jangdok', layer: '소품', years: [1940, 1999], box: [-42, -48, 84, 48], draw: (h) => {
    const jar = (x, s) => h.path(`M ${r1(x - 9 * s)},0 Q ${r1(x - 15 * s)},${r1(-14 * s)} ${r1(x - 9 * s)},${r1(-28 * s)} L ${r1(x + 9 * s)},${r1(-28 * s)} Q ${r1(x + 15 * s)},${r1(-14 * s)} ${r1(x + 9 * s)},0 Z`, T('clay'), { shade: true }) + h.ellipse(x, -29 * s, 10.5 * s, 2.6 * s, T('wood'));
    return h.rect(-42, -4, 84, 4, T('ground2')) + jar(-24, 1.35) + jar(4, 1.1) + jar(26, 0.8);
  } },
  { id: 'prop-laundry', layer: '소품', years: null, box: [-40, -70, 80, 70], draw: (h) => [
    h.rect(-38, -66, 3, 66, T('wood')), h.rect(35, -66, 3, 66, T('wood')), h.stroke('M -36,-60 q 36,6 72,0', 1.5),
    h.rect(-26, -58, 14, 20, T('cloth3')), h.rect(-6, -58, 16, 24, T('cloth4')), h.rect(16, -58, 12, 18, T('cloth3')),
  ].join('') },
  { id: 'prop-well', layer: '소품', years: [1940, 1980], box: [-22, -50, 44, 50], draw: (h) => [
    h.ellipse(0, -4, 20, 5, T('wall2'), { shade: true }), h.rect(-20, -16, 40, 12, T('wall2')), h.ellipse(0, -16, 20, 5, T('roof2'), { flat: true }),
    h.rect(-16, -46, 3, 32, T('wood')), h.rect(13, -46, 3, 32, T('wood')), h.rect(-18, -48, 36, 3, T('wood')),
    h.stroke('M 0,-46 V -30', 1.5, 'roof2'), h.rect(-5, -31, 10, 8, T('wood'), { rx: 1 }),
  ].join('') },
  { id: 'prop-haystack', layer: '소품', years: [1940, 1990], box: [-24, -44, 48, 44], draw: (h) => h.path('M -22,0 Q -20,-28 0,-42 Q 20,-28 22,0 Z', T('ground2'), { shade: true }) + h.path('M -12,-6 Q -8,-26 0,-32 Q 8,-26 12,-6 Z', T('clay'), { flat: true }) },
  { id: 'prop-tree', layer: '소품', years: null, box: [-26, -84, 52, 84], draw: (h) => [
    h.rect(-3.5, -40, 7, 40, T('wood'), { rx: 1 }), h.circle(0, -58, 22, T('green'), { shade: true }), h.circle(-14, -46, 12, T('green')), h.circle(14, -48, 12, T('green')), h.circle(0, -74, 11, T('green')),
  ].join('') },
  { id: 'prop-water-tank', layer: '소품', years: [1980, null], box: [-14, -30, 28, 30], draw: (h) => h.rect(-12, -4, 24, 4, T('wall2')) + h.rect(-10, -26, 20, 22, T('wall'), { rx: 3, shade: true }) + h.rect(-10, -14, 20, 3, T('wall2'), { flat: true }) + h.ellipse(0, -26, 10, 3, T('wall2')) },
  { id: 'prop-ac-unit', layer: '소품', years: [1995, null], box: [0, -18, 26, 18], draw: (h) => h.rect(0, -16, 24, 16, T('wall2'), { rx: 2 }) + h.circle(10, -8, 5, T('wall')) + h.ink('M 10,-12 V -4 M 6,-8 H 14', 1.2) },
  { id: 'prop-parcel', layer: '소품', years: [2000, null], box: [-12, -20, 24, 20], draw: (h) => h.rect(-11, -18, 22, 18, T('clay'), { rx: 1, shade: true }) + h.rect(-2, -18, 4, 18, T('wall2'), { flat: true }) },
  { id: 'prop-bicycle', layer: '소품', years: null, box: [-28, -32, 56, 32], draw: (h) => [
    h.stroke('M -16,-10 a 10 10 0 1 0 0.01 0 M 16,-10 a 10 10 0 1 0 0.01 0', 2.2),
    h.stroke('M -16,-10 L -4,-24 L 12,-24 L 16,-10 M -4,-24 L 4,-10 L -16,-10 M 4,-10 L 12,-24 M 12,-24 L 10,-30 M -4,-24 L -8,-30', 2.2),
    h.rect(-12, -32, 8, 3, T('roof2'), { rx: 1 }), h.rect(6, -33, 10, 3, T('roof2'), { rx: 1 }),
  ].join('') },
  { id: 'prop-planter', layer: '소품', years: null, box: [-12, -26, 24, 26], draw: (h) => h.path('M -9,0 L -7,-12 L 7,-12 L 9,0 Z', T('clay')) + h.circle(0, -18, 7, T('green')) + h.circle(-5, -14, 4.5, T('green')) + h.circle(5, -14, 4.5, T('green')) },
  { id: 'prop-lamp', layer: '소품', years: [1970, null], box: [-12, -120, 24, 120], draw: (h) => h.rect(-2.5, -112, 5, 112, T('roof2'), { rx: 1 }) + h.rect(-2.5, -118, 16, 4, T('roof2'), { rx: 1 }) + h.rect(8, -122, 8, 6, T('glass')) },
  // ── 매체(TV) — 시대 소품 층의 한 묶음. 집의 screen 슬롯(창 너머·마루)에 놓인다. screen: 빈 화면 자리 [x,y,w,h] (자기 좌표계) ──
  { id: 'media-radio', layer: '매체', years: [1940, null], box: [-10, -16, 20, 16], screen: null, draw: (h) => h.rect(-9, -14, 18, 14, T('wood'), { rx: 2, shade: true }) + h.rect(-6, -11, 7, 8, T('wall2'), { rx: 1, flat: true }) + h.circle(5, -7, 2.4, T('wall2')) + h.stroke('M 6,-14 L 10,-24', 1.5, 'roof2') },
  { id: 'media-tv-bw', layer: '매체', years: [1961, 1985], box: [-15, -30, 30, 30], screen: [-10, -25, 16, 12], draw: (h) => [
    // 다리 달린 장식장형 — 나무 상자, 다리 둘, 오른쪽 손잡이, 위에 작은 안테나
    h.rect(-12, -4, 3, 4, T('wood')), h.rect(9, -4, 3, 4, T('wood')),
    h.rect(-14, -28, 28, 24, T('wood'), { rx: 2, shade: true }),
    h.rect(-10, -25, 16, 12, T('roof2'), { rx: 1, flat: true }), h.circle(10, -20, 1.6, T('wall2')), h.circle(10, -14, 1.6, T('wall2')),
    h.stroke('M -4,-28 L -9,-36 M -4,-28 L 1,-36', 1.5),
  ].join('') },
  { id: 'media-tv-color', layer: '매체', years: [1981, 2005], box: [-16, -26, 32, 26], screen: [-12, -22, 20, 15], draw: (h) => [
    h.rect(-15, -24, 30, 22, T('wall2'), { rx: 2, shade: true }), h.rect(-12, -22, 20, 15, T('roof2'), { rx: 1.5, flat: true }), h.rect(10, -20, 3, 10, T('wall'), { rx: 1, flat: true }),
    h.rect(-8, -2, 16, 2, T('wall2')),
  ].join('') },
  { id: 'media-tv-flat', layer: '매체', years: [2005, null], box: [-19, -24, 38, 24], screen: [-17, -22, 34, 18], draw: (h) => h.rect(-6, -3, 12, 3, T('roof2'), { rx: 1 }) + h.rect(-18, -23, 36, 20, T('roof2'), { rx: 1, shade: true }) + h.rect(-17, -22, 34, 18, T('roof2'), { flat: true }) + h.rect(-17, -22, 34, 18, T('far2'), { flat: true, extra: 'opacity="0.18"' }) },
  { id: 'media-tv-wall', layer: '매체', years: [2010, null], box: [-21, -24, 42, 24], screen: [-20, -23, 40, 22], draw: (h) => h.rect(-21, -24, 42, 24, T('roof2'), { rx: 1, shade: true }) + h.rect(-20, -23, 40, 22, T('far2'), { flat: true, extra: 'opacity="0.18"' }) },
  { id: 'media-handheld', layer: '매체', years: [2010, null], box: [-6, -18, 12, 18], screen: [-5, -16, 10, 14], draw: (h) => h.rect(-6, -18, 12, 18, T('roof2'), { rx: 1.5, shade: true }) + h.rect(-5, -16, 10, 14, T('far2'), { flat: true, extra: 'opacity="0.18"' }) },
  // ── 식구 (연령대 8 × 성별 2 = 16 몸 + 시대 옷 6 — 이 시안 17 조합) ──
  ...[
    ['young', 'f', 'e2'], ['young', 'm', 'e2'], ['senior', 'f', 'e2'], ['child', 'f', 'e2'],
    ['young', 'f', 'e3'], ['young', 'm', 'e3'], ['child', 'm', 'e3'], ['child', 'f', 'e3'],
    ['senior', 'm', 'e1'], ['senior', 'f', 'e1'], ['young', 'm', 'e1'], ['young', 'f', 'e1'], ['child', 'f', 'e1'], ['toddler', 'm', 'e1'],
    ['senior', 'm', 'e2'], ['teen', 'f', 'e2'], ['child', 'm', 'e2'], ['toddler', 'm', 'e2'],
  ].map(([age, sex, era]) => {
    const g = AGE_GEO[age];
    const w = (g.sw[sex === 'f' ? 0 : 1] + 34) / 2;
    return { id: `fig-${age}-${sex}-${era}`, layer: '식구', years: null, box: [-w, -(g.H + 10), 2 * w, g.H + 12], draw: (h, s, o = {}) => person(h, figSpec(age, sex, era, o)) };
  }),
  { id: 'fig-infant-carried', layer: '식구', years: null, box: [-22, -100, 44, 60], draw: (h, s, o = {}) => {
    // 포대기로 업힌 아기 — 어머니 조각 **뒤**에, 같은 자리에 놓는다(FH5 슬롯 겹침의 예). o.H 어머니 키(기본 young 94)
    const H = o.H || 94, r = 10.5;
    const shY = -(H - 2 * r - 3);
    const hipY = -H * 0.5;
    return [
      h.rect(-18, shY + 1, 36, hipY - shY + 14, T(o.tok || 'cloth2'), { rx: 7, shade: true }),
      h.circle(10.5, shY - 5, 6.5, T('skin'), { shade: true }), h.path(capPath(6.5, shY - 5, 1.05, 0.5, 0.0), T('hair')),
      h.dot(8.1, shY - 5.4, 1.1), h.dot(12.9, shY - 5.4, 1.1),
    ].join('');
  } },
  // ── 반려동물 (종 3 × 자리 2 = 6 예정 — 이 시안 3) ──
  { id: 'pet-dog-yard', layer: '반려동물', years: null, box: [-72, -46, 104, 46], draw: (h) => [
    h.rect(-64, -26, 34, 26, T('wall2'), { shade: true }), h.path('M -68,-26 L -47,-42 L -26,-26 Z', T('roof')), h.path('M -53,0 L -53,-12 a 6 6 0 0 1 12 0 L -41,0 Z', T('roof2'), { flat: true }),
    h.rect(-20, -9, 5, 9, T('pet'), { rx: 1.5 }), h.rect(-12, -9, 5, 9, T('pet'), { rx: 1.5 }), h.rect(4, -9, 5, 9, T('pet'), { rx: 1.5 }), h.rect(12, -9, 5, 9, T('pet'), { rx: 1.5 }),
    h.rect(-22, -22, 40, 15, T('pet'), { rx: 7, shade: true }), h.stroke('M -21,-18 q -9,-4 -7,-14', 3, 'pet'),
    h.circle(21, -24, 7.5, T('pet')), h.path('M 16,-30 l -2,-8 l 7,4 Z', T('pet2')), h.path('M 26,-30 l 2,-8 l -7,4 Z', T('pet2')), h.ellipse(26, -22, 3.5, 2.5, T('pet2')),
    h.dot(19, -26, 1.1), h.dot(24, -26, 1.1),
    h.rect(13, -17, 6, 3, T('cloth1'), { flat: true }), h.stroke('M 13,-16 q -20,8 -40,0', 1.5, 'roof2'),
  ].join('') },
  { id: 'pet-cat-indoor', layer: '반려동물', years: null, box: [-16, -30, 32, 30], draw: (h) => [
    h.path('M -8,0 Q -11,-14 0,-17 Q 11,-14 8,0 Z', T('pet2')), h.stroke('M 8,-2 q 9,-2 8,-10', 2.6, 'pet2'),
    h.circle(0, -20, 6.5, T('pet2')), h.path('M -6,-23 l 1.5,-6 l 4.5,3.5 Z', T('pet2')), h.path('M 6,-23 l -1.5,-6 l -4.5,3.5 Z', T('pet2')),
    `<circle cx="-2.5" cy="-21" r="1" fill="${T('glass')}"/><circle cx="2.5" cy="-21" r="1" fill="${T('glass')}"/>`,
  ].join('') },
  { id: 'pet-dog-indoor', layer: '반려동물', years: null, box: [-14, -26, 28, 26], draw: (h) => [
    // 창가에 앉은 작은 개 — 앉은 몸, 처진 귀, 꼬리
    h.path('M -9,0 Q -12,-13 -2,-16 Q 10,-14 8,0 Z', T('pet')), h.stroke('M -9,-3 q -7,-3 -5,-10', 2.4, 'pet'),
    h.circle(2, -19, 6.5, T('pet')), h.path('M -5,-21 q -4,3 -3,9 l 4,-2 Z', T('pet2')), h.path('M 9,-21 q 4,3 3,9 l -4,-2 Z', T('pet2')), h.ellipse(6, -17, 2.6, 2, T('pet2')),
    h.dot(0, -20, 1), h.dot(4.5, -20, 1),
  ].join('') },
];
const byId = Object.fromEntries(PIECES.map((p) => [p.id, p]));
for (const p of PIECES) if (!('years' in p)) throw new Error(`years 없음: ${p.id}`);

/**
 * 화면 속 그해의 장면 — 표본 둘(FT2·FT3, 2026-10-27 마스터 지시: 문화·스포츠 1 + 정치 일반 상징 1. 특정 사진을 따라 그리지 않고 새로 구성).
 * 좌표계 40×24(5:3) — 매체 조각의 screen 슬롯에 맞춰 scale된다. 색은 토큰만, 글자·로고·실존 인물 0. approved는 형진 님 사건별 승인 전이라 false.
 * 조각 수 예산(FH8 93)과는 따로 센다 — 화면 그림은 `family` 덩어리의 시대별 하위 덩어리 후보(FT5).
 */
const SCREENS = [
  { id: 'screen-stadium-flame', year: 1988, kind: '문화·스포츠', line: '서울에서 올림픽이 열렸습니다.', approved: false, draw: (h) => [
    // 경기장 관중석(원호) + 성화대 불꽃 — 고리·휘장·글자 없음
    h.rect(0, 0, 40, 24, T('sky'), { flat: true }),
    h.path('M 2,19 Q 20,8 38,19 L 38,24 L 2,24 Z', T('far'), { flat: true }), h.path('M 6,19 Q 20,11 34,19 Z', T('far2'), { flat: true }),
    h.rect(18.5, 11, 3, 8, T('wall2'), { flat: true }), h.path('M 15,8.5 L 25,8.5 L 23,11.5 L 17,11.5 Z', T('wall2'), { flat: true }), h.path('M 20,2 Q 24.5,5 23,8.5 L 17,8.5 Q 15.5,5 20,2 Z', T('cloth2'), { flat: true }), h.path('M 20,4 Q 22,6.2 21.4,8.5 L 18.6,8.5 Q 18,6.2 20,4 Z', T('glass'), { flat: true }),
  ].join('') },
  { id: 'screen-ballot-box', year: 1987, kind: '정치(일반 상징)', line: '대통령을 국민이 직접 뽑는 선거가 치러졌습니다.', approved: false, draw: (h) => [
    // 투표함 + 넣는 용지 — 정당 상징·구호·인물 없음
    h.rect(0, 0, 40, 24, T('wall'), { flat: true }), h.rect(0, 18, 40, 6, T('wall2'), { flat: true }),
    h.rect(11, 8, 18, 11, T('cloth4'), { flat: true }), h.rect(10, 7, 20, 2.5, T('cloth1'), { flat: true }), h.rect(16, 7.6, 8, 1, T('wall'), { flat: true }),
    h.path('M 17,2 L 24,1 L 24.5,7 L 17.5,7.6 Z', T('cloth3'), { flat: true }), h.rect(18.5, 3.2, 4, 0.9, T('cloth1'), { flat: true }), h.rect(18.5, 5, 3, 0.9, T('cloth1'), { flat: true }),
  ].join('') },
];
/** 매체 조각의 screen 슬롯에 화면 표본을 놓는다(매체 좌표계) */
function screenIn(h, mediaId, screenId) {
  const m = byId[mediaId];
  if (!m.screen) return '';
  const [x, y, w, hh] = m.screen;
  const s = Math.min(w / 40, hh / 24);
  const sc = SCREENS.find((q) => q.id === screenId);
  return `<g data-screen="${screenId}" transform="translate(${r1(x + (w - 40 * s) / 2)} ${r1(y + (hh - 24 * s) / 2)}) scale(${r1(s)})">${sc.draw(h)}</g>`;
}

// ---------------------------------------------------------------- 장면 (조각을 자리에 놓는다 — 구현의 sceneOf → SceneSpec과 같은 모양)
/**
 * 항목: [조각 id, x, y, scale?, 옵션?] — 옵션은 조각의 파라미터(roof·toks·H 등). 좌표계 640×256, 지면선 y=200, 발바닥 y≈246~250, 안전 영역 x 20~620.
 * media: 집의 screen 슬롯에 놓는 매체 조각(없으면 그리지 않는다). 집 슬롯 좌표 + 집의 (x,y,scale)로 자리가 정해진다.
 */
const SCENES = {
  a: {
    id: 'a', year: 1975, title: '장면 A · 1975년 서울 · 단독주택 셋방', region: '서울 성북구', house: '단독주택 셋방',
    people: [['어머니', '박영숙', 34, '아주 가까움'], ['아버지', '김재호', 36, '가까움'], ['친할머니', '이순자', 61, '가까움'], ['누나', '김미경', 10, '가까움'], ['누나', '김미정', 8, '아주 가까움'], ['나', '김성민', 0]],
    with: ['부모님', '누나 둘', '할머니'], pets: [['pet-dog-yard', 372, 246]], petLine: '마당에서 기르는 개 한 마리가 있습니다.',
    bg: 'bg-metro-b2', back: [['prop-pole', 30, 200]], houseAt: ['house-detached-rent-h2', 0, 200],
    front: [['prop-antenna', 236, 70], ['prop-laundry', 220, 236], ['prop-jangdok', 96, 246], ['prop-briquettes', 286, 240]],
    media: 'media-tv-bw',
    family: [['fig-senior-f-e2', 432, 250], ['fig-young-m-e2', 478, 246], ['fig-infant-carried', 528, 248], ['fig-young-f-e2', 528, 248], ['fig-child-f-e2', 574, 250, 1], ['fig-child-f-e2', 608, 250, 0.9]],
  },
  b: {
    id: 'b', year: 2005, title: '장면 B · 2005년 경기 신도시 · 아파트', region: '경기 안양시 동안구', house: '아파트',
    people: [['어머니', '정수연', 38, '아주 가까움'], ['아버지', '김민호', 39, '가까움'], ['나', '김도현', 10]],
    with: ['부모님'], pets: [['pet-cat-indoor', 300, 166]], petLine: '집 안에서 기르는 고양이 한 마리가 있습니다.',
    bg: 'bg-town-b3', back: [], houseAt: ['house-apt-h3', 0, 200],
    front: [['prop-ac-unit', 300, 150], ['prop-planter', 58, 246], ['prop-parcel', 246, 240], ['prop-bicycle', 324, 244], ['prop-lamp', 614, 246]],
    media: 'media-tv-color',
    family: [['fig-young-m-e3', 468, 246], ['fig-young-f-e3', 514, 248], ['fig-child-m-e3', 556, 250]],
  },
  c: {
    id: 'c', year: 1955, title: '장면 C · 1955년 전남 농촌 · 초가 단독주택 3세대', region: '전남 고흥군', house: '단독주택',
    people: [['어머니', '최순덕', 29, '아주 가까움'], ['아버지', '박판수', 33, '가까움'], ['친할아버지', '박만석', 64, '가까움'], ['친할머니', '김옥분', 60, '아주 가까움'], ['누나', '박말순', 9, '가까움'], ['형', '박기호', 5, '가까움'], ['나', '박기수', 1]],
    with: ['부모님', '누나', '형', '할머니', '할아버지'], pets: [['pet-dog-yard', 330, 246]], petLine: '마당에서 기르는 개 한 마리가 있습니다.',
    bg: 'bg-rural-b1', back: [['prop-tree', 356, 200]], houseAt: ['house-detached-h1', 0, 200, 0.92, { roof: 'thatch' }],
    front: [['prop-jangdok', 60, 246], ['prop-haystack', 594, 244], ['prop-well', 384, 238]],
    media: 'media-radio',
    family: [['fig-senior-m-e1', 424, 250, 1, { shoeTok: 'cloth3' }], ['fig-senior-f-e1', 460, 250], ['fig-young-m-e1', 500, 246, 1, { shoeTok: 'roof2' }], ['fig-infant-carried', 544, 248, 1, { tok: 'cloth4' }], ['fig-young-f-e1', 544, 248], ['fig-child-f-e1', 582, 250], ['fig-toddler-m-e1', 610, 250]],
  },
  d: {
    id: 'd', year: 2015, title: '장면 D · 2015년 서울 · 다세대주택', region: '서울 관악구', house: '다세대주택',
    people: [['어머니', '이지은', 37, '아주 가까움'], ['아버지', '한승우', 40, '가까움'], ['나', '한서윤', 8]],
    with: ['부모님'], pets: [['pet-dog-indoor', 122, 88]], petLine: '집 안에서 기르는 개 한 마리가 있습니다.',
    bg: 'bg-metro-b3', back: [['prop-lamp', 392, 200]], houseAt: ['house-multi-h3', 0, 200],
    front: [['prop-water-tank', 60, 34], ['prop-ac-unit', 262, 64], ['prop-parcel', 150, 240], ['prop-bicycle', 346, 244], ['prop-planter', 24, 246]],
    media: 'media-tv-wall',
    family: [['fig-young-m-e3', 470, 246, 1, { toks: { a: 'cloth1', b: 'roof2' } }], ['fig-young-f-e3', 516, 248, 1, { toks: { a: 'cloth3', b: 'cloth1' } }], ['fig-child-f-e3', 556, 250, 1, { toks: { a: 'cloth4' } }]],
  },
  e: {
    id: 'e', year: 1968, title: '장면 E(한계) · 1968년 대구 · 단독주택 · 식구 8명 + 개·고양이', region: '대구 중구', house: '단독주택',
    people: [['어머니', '서정자', 36, '아주 가까움'], ['아버지', '이병철', 40, '가까움'], ['친할아버지', '이만갑', 67, '가까움'], ['친할머니', '조분이', 63, '아주 가까움'], ['누나', '이경희', 15, '가까움'], ['오빠', '이성호', 12, '보통'], ['나', '이경숙', 9], ['남동생', '이성민', 5, '가까움']],
    with: ['부모님', '누나', '오빠', '동생', '할머니', '할아버지'], pets: [['pet-dog-yard', 338, 246], ['pet-cat-indoor', 300, 200]], petLine: '마당에서 기르는 개 한 마리와 집 안에서 기르는 고양이 한 마리가 있습니다.',
    bg: 'bg-town-b1', back: [['prop-pole', 24, 200], ['prop-tree', 352, 200]], houseAt: ['house-detached-h1', 10, 200, 0.86, { roof: 'tile' }],
    front: [['prop-antenna', 296, 105], ['prop-jangdok', 60, 246], ['prop-laundry', 396, 234], ['prop-briquettes', 248, 236]],
    media: 'media-radio',
    family: [['fig-senior-m-e2', 404, 250], ['fig-senior-f-e2', 436, 250], ['fig-young-m-e2', 470, 246], ['fig-young-f-e2', 506, 248], ['fig-teen-f-e2', 540, 250, 1, { toks: { a: 'cloth3', b: 'cloth1' } }], ['fig-child-m-e2', 566, 252], ['fig-child-f-e2', 592, 252, 1, { toks: { a: 'cloth4' } }], ['fig-toddler-m-e2', 616, 252]],
  },
};

/**
 * 아래 한 줄(FH3) — `sceneLineOf`의 시안 규칙. 「사는 곳 · 집 · 함께 사는 사람과 함께」.
 * 사람 묶음 순서: 부모님 → 형제(누나·오빠·형·언니·동생) → 조부모 → (성인) 배우자·자녀. 길이 규칙(360px 2줄 ▲): 전체 글자 수가 LINE_MAX를 넘으면
 *  ① 형제 3명 이상 → 「형제 N명」 ② 할머니·할아버지 둘 → 「조부모님」 ③ 그래도 넘으면 「식구 N명」. 한 줄에 쓰는 낱말(셋방 등)은 WORD_YEARS를 따른다.
 */
const LINE_MAX = 40;
/** 「와/과」 — 마지막 글자의 받침으로 고른다(부모님과 · 할머니와) */
const wa = (w) => { const c = w.charCodeAt(w.length - 1); return c >= 0xac00 && c <= 0xd7a3 && (c - 0xac00) % 28 !== 0 ? '과' : '와'; };
function sceneLineOf(sc) {
  const join = (arr) => `${sc.region} · ${sc.house} · ${arr.join('·')}${wa(arr[arr.length - 1])} 함께`;
  let people = [...sc.with];
  let line = join(people);
  if (line.length > LINE_MAX) {
    const sib = people.filter((w) => /누나|오빠|형|언니|동생/.test(w));
    if (sib.length >= 3) { const n = sib.reduce((a, w) => a + (/둘/.test(w) ? 2 : /셋/.test(w) ? 3 : 1), 0); people = people.filter((w) => !sib.includes(w)); people.splice(1, 0, `형제 ${n}명`); line = join(people); }
  }
  if (line.length > LINE_MAX && people.includes('할머니') && people.includes('할아버지')) { people = people.filter((w) => w !== '할머니' && w !== '할아버지'); people.push('조부모님'); line = join(people); }
  if (line.length > LINE_MAX) line = `${sc.region} · ${sc.house} · 식구 ${sc.people.length - 1}명과 함께`;
  return line;
}
for (const sc of Object.values(SCENES)) sc.line = sceneLineOf(sc);

/** 연도 단언(FH2 ②): 장면의 모든 조각이 그 해에 있어야 한다 */
function assertYears(sc) {
  const ids = [sc.bg, ...sc.back.map((x) => x[0]), sc.houseAt[0], ...sc.front.map((x) => x[0]), ...sc.pets.map((x) => x[0]), ...sc.family.map((x) => x[0]), ...(sc.media ? [sc.media] : [])];
  for (const id of ids) {
    const p = byId[id];
    if (!p) throw new Error(`조각 없음: ${id}`);
    if (p.years && (sc.year < p.years[0] || (p.years[1] !== null && sc.year > p.years[1]))) throw new Error(`연도 위반: ${sc.id} ${sc.year} ← ${id} [${p.years}]`);
  }
}
for (const sc of Object.values(SCENES)) assertYears(sc);

function place(style, [id, x, y, scale = 1, opt]) {
  const h = mk(style);
  return `<g data-piece="${id}" transform="translate(${x} ${y})${scale !== 1 ? ` scale(${scale})` : ''}">${byId[id].draw(h, style, opt)}</g>`;
}
/** 매체 조각의 자리 = 집의 screen 슬롯(집 좌표) → 그림 좌표 */
function mediaPlacement(sc) {
  if (!sc.media) return null;
  const [hid, hx, hy, hs = 1] = sc.houseAt;
  const slot = byId[hid].slots?.screen;
  if (!slot) return null;
  return [sc.media, r1(hx + slot[0] * hs), r1(hy + slot[1] * hs), r1(hs)];
}
function sceneSvg(style, sc, attrs = '') {
  const L = (name, items) => `<g data-layer="${name}">${items.map((it) => place(style, it)).join('')}</g>`;
  const media = mediaPlacement(sc);
  return `<svg class="scene__svg" viewBox="0 0 640 256" preserveAspectRatio="xMidYMid slice" ${attrs}>${L('배경', [[sc.bg, 0, 0]])}${L('소품-뒤', sc.back)}${L('집', [sc.houseAt])}${L('매체', media ? [media] : [])}${L('소품-앞', sc.front)}${L('반려동물', sc.pets)}${L('식구', sc.family)}</svg>`;
}

// ---------------------------------------------------------------- 조각 파일 + 예산 실측
const prevBudget = existsSync(OUT + 'budget.json') ? JSON.parse(readFileSync(OUT + 'budget.json', 'utf8')) : { styles: {} };
const budget = { measuredAt: '2026-10-27', note: 'raw·gz는 조각 안쪽 마크업(<g> 내용) 바이트. chunk는 그림체의 조각 전부를 {id: 마크업} JSON으로 묶어 gzip한 값(실제 덩어리에 가까운 추정). 예산(SPEC-009 FH8 ▲, 기준은 덩어리 gzip — 마스터 확정): 조각 평균 gzip ≤ 0.45KB · 조각 덩어리 ≤ 45KB(93조각) · family 덩어리 합계 ≤ 75KB. s1이 정본(형진 님 선택 2026-10-27), s2는 비교용 실측 기록.', styles: {} };
for (const s of Object.keys(STYLES)) {
  const h = mk(s);
  const rows = [];
  const chunk = {};
  const byLayer = {};
  for (const p of PIECES) {
    const inner = p.draw(h, s);
    chunk[p.id] = inner;
    const raw = Buffer.byteLength(inner, 'utf8');
    const gz = gzipSync(Buffer.from(inner, 'utf8')).length;
    rows.push({ id: p.id, layer: p.layer, years: p.years, raw, gz });
    (byLayer[p.layer] ||= []).push(gz);
    const [x, y, w, hh] = p.box;
    write(`pieces/${s}/${p.id}.svg`, `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${x} ${y} ${w} ${hh}" width="${w * 2}" height="${hh * 2}"><!-- 수저 게임 · 집과 가족 그림 조각 · ${STYLES[s]} · ${p.id} (${p.layer}${p.years ? ` · ${p.years[0]}~${p.years[1] ?? ''}` : ''}) · 직접 제작, 색은 --c-scene-* 토큰(기본값 = 라이트) --><rect x="${x}" y="${y}" width="${w}" height="${hh}" fill="${T('sky')}"/><g>${inner}</g></svg>\n`);
  }
  const chunkStr = JSON.stringify(chunk);
  const chunkGz = gzipSync(Buffer.from(chunkStr, 'utf8')).length;
  const sum = (k) => rows.reduce((a, r) => a + r[k], 0);
  const layerAvg = Object.fromEntries(Object.entries(byLayer).map(([k, v]) => [k, { n: v.length, gzAvg: Math.round(v.reduce((a, b) => a + b, 0) / v.length) }]));
  budget.styles[s] = { name: STYLES[s], pieces: rows.length, rawTotal: sum('raw'), gzEachTotal: sum('gz'), gzEachAvg: Math.round(sum('gz') / rows.length), chunkRaw: Buffer.byteLength(chunkStr, 'utf8'), chunkGz, chunkPerPiece: Math.round(chunkGz / rows.length), chunkRatio: Math.round((chunkGz / sum('gz')) * 100) / 100, projected93: Math.round((chunkGz / rows.length) * 93), projected110: Math.round((chunkGz / rows.length) * 110), layerAvg, rows };
}
if (!WITH_S2 && prevBudget.styles?.s2) budget.styles.s2 = { ...prevBudget.styles.s2, note: '비교용 — FM2 게이트 실측(24조각)을 그대로 둔다. 다시 재려면 --with-s2' };
// 화면 표본(FT2) — 조각 예산과 따로: 장당 gzip과 1940~2020 × 1~2장 합계 추정
{
  const h = mk('s1');
  const rows = SCREENS.map((q) => { const inner = q.draw(h); write(`pieces/s1/${q.id}.svg`, `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 24" width="240" height="144"><!-- 수저 게임 · 화면 속 그해의 장면 표본 · ${q.id} · ${q.kind} · 승인 전(approved: false) · 직접 구성, 색은 --c-scene-* 토큰 --><g>${inner}</g></svg>\n`); return { id: q.id, year: q.year, kind: q.kind, approved: q.approved, raw: Buffer.byteLength(inner, 'utf8'), gz: gzipSync(Buffer.from(inner, 'utf8')).length }; });
  const chunkGz = gzipSync(Buffer.from(JSON.stringify(Object.fromEntries(SCREENS.map((q) => [q.id, q.draw(h)]))), 'utf8')).length;
  const avg = Math.round(rows.reduce((a, r) => a + r.gz, 0) / rows.length);
  const ratio = budget.styles.s1.chunkRatio;
  const years = 2020 - 1940 + 1;
  budget.screens = { note: '화면 속 그해의 장면(FT2) 표본. 장당 개별 gzip과, 덩어리 비율(s1 chunkRatio)을 곱한 합계 추정. 승인 전(approved: false).', rows, gzEachAvg: avg, chunkGzTwo: chunkGz, projected: { years, one: { pieces: years, gzEach: avg * years, chunkEst: Math.round(avg * years * ratio) }, two: { pieces: years * 2, gzEach: avg * years * 2, chunkEst: Math.round(avg * years * 2 * ratio) } } };
}
write('budget.json', JSON.stringify(budget, null, 2) + '\n');

// ---------------------------------------------------------------- family.css (시안 전용 — 토큰 + 그림 카드 규칙)
const tokenBlock = (o, indent = '  ') => Object.entries(o).map(([k, v]) => `${indent}--c-scene-${k}: ${v};`).join('\n');
write('family.css', `/* SPEC-009 집과 가족 그림 — 시안 전용 CSS (designer 2026-10-27). 토큰 --c-scene-* 24개는 **마스터 승인**(FM2 게이트 통과 기록) — tokens.css 반영은 구현(FM5) 몫이고 이 파일은 시안만 읽는다.
   라이트 값은 SVG 조각의 fallback과 같다(buildFamilyMockups.mjs LIGHT). 다크는 같은 그림을 어두운 종이에 놓은 것 — 낮밤·계절 표현이 아니다(SPEC-009 안 할 것). 다크의 창 불빛(glass)은 유지한다(마스터 결정).
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
/* 높이: 폭 ÷ 2.5, 화면 높이의 25%를 넘지 않는다(FH1 ▲, 형진 님 선택 2026-10-27). 넘으면 양옆을 조금 잘라 보인다(preserveAspectRatio slice — 안전 영역 x 20~620) */
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
  /* 휴대폰: 결정 카드 바로 아래(둘 다 order -1, 문서 순서대로 결정 → 그림 — 마스터 결정), 그 다음 프로필·스탯·… 인생 기록(DB1) */
  .scene-card { order: -1; }
}
@media (forced-colors: active) {
  .scene { border-bottom: 1px solid CanvasText; }
  .scene__people li::before { background: CanvasText; }
}
`);

// ---------------------------------------------------------------- scenes.html(정본 s1 전 장면) / compare.html(--with-s2) / pieces.html
const HEAD = (title, extra = '') => `<!doctype html>
<html lang="ko" data-paper="1">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<!-- 시안(정적 HTML, 가짜 데이터) — SPEC-009 집과 가족 그림. ?theme=dark 다크 · ?w=328 그림 폭 -->
<link rel="stylesheet" href="../../../../src/styles/tokens.css">
<link rel="stylesheet" href="../ds.css">
<link rel="stylesheet" href="../gm3/gm3.css">
<link rel="stylesheet" href="family.css">
<script>(function(){var q=new URLSearchParams(location.search);var t=q.get('theme');if(t==='dark'||t==='light')document.documentElement.setAttribute('data-theme',t);if(q.get('motion')==='reduce')document.documentElement.setAttribute('data-motion','reduce');var w=q.get('w');if(w)document.documentElement.style.setProperty('--pic-w',w+'px');})();</script>
${extra}
</head>`;
const CMP_CSS = `<style>
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
</style>`;
const sceneCardStandalone = (style, sc) => `<figure class="cmp__fig" data-style="${style}" data-scene="${sc.id}"><div class="cmp__pic"><svg class="scene__svg" viewBox="0 0 640 256" role="img" aria-label="${sc.line}. ${sc.petLine}" focusable="false">${sceneSvg(style, sc).replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '')}</svg></div><figcaption class="scene__line">${sc.line}</figcaption></figure>`;

write('scenes.html', `${HEAD('수저 게임 · 시안 · 집과 가족 그림 — 장면 다섯(SPEC-009 FM2b, 그림체 종이 오림)', CMP_CSS)}
<body>
<main class="cmp">
<h1>집과 가족 그림 — 장면 다섯</h1>
<p class="cmp__lead">형진 님이 고른 그림체(종이 오림)로 그린 장면입니다. 조각(배경·소품·집·매체·식구·반려동물)을 자리에 놓아 합친 것이고, 색은 디자인 토큰만 읽습니다. 시안이라 이름·나이는 가짜 값입니다. 매체(라디오·텔레비전)의 화면은 빈 자리만 두었습니다.</p>
<nav class="cmp__links" aria-label="보기"><a href="scenes.html">라이트</a><a href="scenes.html?theme=dark">다크</a><a href="dashboard-family.html?scene=c">대시보드 자리</a><a href="pieces.html">조각 표</a><a href="compare.html">그림체 비교(게이트 기록)</a></nav>
<section class="cmp__style"><div class="cmp__grid">${Object.values(SCENES).map((sc) => `<div><h2 style="font-size:var(--fs-md);margin:0 0 var(--sp-2)">${sc.title}</h2>${sceneCardStandalone('s1', sc)}</div>`).join('')}</div></section>
<section class="cmp__style" id="screen-samples"><h2>화면 속 그해의 장면 — 표본 둘(FT2, 승인 전)</h2><p>종이 오림 그림체로 새로 구성한 표본입니다. 특정 사진을 따라 그리지 않았고 글자·로고·실존 인물·정당 상징이 없습니다. 왼쪽은 40×24 좌표계 원본(6배), 가운데는 컬러 TV 조각 안(화면 20×15단위), 오른쪽은 흑백 TV 조각 안(16×12단위) — 둘 다 3배.</p><div class="cmp__grid">${SCREENS.map((q) => { const h = mk('s1'); const tvc = byId['media-tv-color'], tvb = byId['media-tv-bw']; const box = (p) => p.box.join(' '); return `<figure class="cmp__fig" data-sample="${q.id}" style="padding:var(--sp-4)"><div style="display:flex;gap:var(--sp-4);align-items:flex-end;flex-wrap:wrap"><svg viewBox="0 0 40 24" width="240" height="144" aria-hidden="true" focusable="false">${q.draw(h)}</svg><svg viewBox="${box(tvc)}" width="${tvc.box[2] * 3}" height="${tvc.box[3] * 3}" aria-hidden="true" focusable="false"><rect x="${tvc.box[0]}" y="${tvc.box[1]}" width="${tvc.box[2]}" height="${tvc.box[3]}" fill="${T('glass')}"/>${tvc.draw(h, 's1')}${screenIn(h, 'media-tv-color', q.id)}</svg><svg viewBox="${box(tvb)}" width="${tvb.box[2] * 3}" height="${tvb.box[3] * 3}" aria-hidden="true" focusable="false"><rect x="${tvb.box[0]}" y="${tvb.box[1]}" width="${tvb.box[2]}" height="${tvb.box[3]}" fill="${T('glass')}"/>${tvb.draw(h, 's1')}${screenIn(h, 'media-tv-bw', q.id)}</svg></div><figcaption class="scene__line" style="font-weight:var(--fw-regular)">${q.year}년 · ${q.kind} · 한 줄 「${q.line}」 · gzip ${budget.screens.rows.find((r) => r.id === q.id).gz}B</figcaption></figure>`; }).join('')}</div></section>
</main>
</body>
</html>
`);

if (WITH_S2) {
  write('compare.html', `${HEAD('수저 게임 · 시안 · 집과 가족 그림 — 그림체 두 가지(SPEC-009 FM2 게이트 기록)', CMP_CSS)}
<body>
<main class="cmp">
<h1>집과 가족 그림 — 그림체 두 가지</h1>
<p class="cmp__lead">같은 장면 둘을 두 벡터 그림체로 그렸습니다(FM2 게이트 기록 — 형진 님이 그림체 1을 골랐습니다). 둘 다 조각을 자리에 놓아 합친 것이고, 색은 디자인 토큰만 읽습니다. 시안이라 이름·나이는 가짜 값입니다.</p>
<nav class="cmp__links" aria-label="보기"><a href="compare.html">라이트</a><a href="compare.html?theme=dark">다크</a><a href="scenes.html">정본 장면 다섯</a><a href="pieces.html">조각 표</a></nav>
${Object.entries(STYLES_ALL).map(([s, name], i) => `<section class="cmp__style" data-style="${s}"><h2>그림체 ${i + 1} · ${name}${s === 's1' ? ' — 선택' : ' — 비교용'}</h2><p>${s === 's1' ? '선이 없습니다. 평평한 종이 조각을 겹쳐 놓고 한 칸 밀린 그림자 조각으로 두께를 냅니다. 얼굴은 그리지 않고 머리 모양·옷으로 사람을 읽습니다.' : '둥근 먹선 한 굵기와 옅은 채움입니다. 점 눈과 작은 미소는 얼굴 시스템의 「담담한 미소」와 같은 표정입니다.'}</p><div class="cmp__grid">${['a', 'b'].map((k) => sceneCardStandalone(s, SCENES[k])).join('')}</div></section>`).join('')}
</main>
</body>
</html>
`);
}

write('pieces.html', `${HEAD('수저 게임 · 시안 · 집과 가족 그림 조각 표(SPEC-009)', `<style>
.pc { max-width: 1120px; margin: 0 auto; padding: var(--sp-6) var(--gutter) var(--sp-10); }
.pc h1 { font-size: var(--fs-2xl); margin: 0 0 var(--sp-2); }
.pc h2 { font-size: var(--fs-xl); margin: var(--sp-6) 0 var(--sp-3); }
.pc h3 { font-size: var(--fs-md); margin: var(--sp-5) 0 var(--sp-2); color: var(--c-text-2); }
.pc__grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: var(--sp-3); }
.pc__cell { margin: 0; background: var(--c-surface); border: 1px solid var(--c-border); border-radius: var(--r-md); overflow: hidden; }
.pc__cell svg { display: block; width: 100%; height: 110px; background: var(--c-scene-sky); }
.pc__cell figcaption { padding: var(--sp-2); font-size: var(--fs-xs); color: var(--c-text-2); word-break: break-all; }
.pc__cell b { color: var(--c-text); display: block; }
</style>`)}
<body><main class="pc"><h1>집과 가족 그림 조각 표</h1><p>조각마다 안쪽 마크업의 gzip 바이트와 사용 연도를 적었습니다(실측은 budget.json, 설계 표는 family-scene.md). 조각은 층별로 세고, 수저·시대 차이는 크기·색 토큰·자리로만 바꿉니다(FH8).</p>
${Object.entries(STYLES).map(([s, name]) => { const b = budget.styles[s]; const layers = [...new Set(PIECES.map((p) => p.layer))]; return `<h2>${name} — 조각 ${PIECES.length}개 · 덩어리 gzip ${b.chunkGz.toLocaleString('ko-KR')}B(조각당 ${b.chunkPerPiece}B)</h2>${layers.map((ly) => `<h3>${ly} · ${b.layerAvg[ly].n}개 · 평균 gzip ${b.layerAvg[ly].gzAvg}B</h3><div class="pc__grid">${PIECES.filter((p) => p.layer === ly).map((p) => { const [x, y, w, hh] = p.box; const row = b.rows.find((r) => r.id === p.id); return `<figure class="pc__cell"><svg viewBox="${x} ${y} ${w} ${hh}" preserveAspectRatio="xMidYMid meet" aria-hidden="true" focusable="false">${p.draw(mk(s), s + 'p')}</svg><figcaption><b>${p.id}</b>${p.years ? `${p.years[0]}~${p.years[1] ?? ''}` : '공통'} · gzip ${row.gz}B</figcaption></figure>`; }).join('')}</div>`).join('')}`; }).join('')}
</main></body></html>
`);

// ---------------------------------------------------------------- dashboard-family.html — gm3/dashboard-004.html(읽기만)에 결정 카드 + 그림 카드를 끼운다 (s1만)
{
  let dash = readFileSync(ROOT + 'docs/design/mockups/gm3/dashboard-004.html', 'utf8');
  const dec = readFileSync(ROOT + 'docs/design/mockups/decision-adult.html', 'utf8');
  const di = dec.indexOf('<section class="card decision decision--inline"');
  const dj = dec.indexOf('</section>', di) + '</section>'.length;
  let decision = dec.slice(di, dj);
  decision = decision.replace(/2057년 · 31세/g, '2000년 · 25세').replace(/data-a="2057년" data-b="31세"/, 'data-a="2000년" data-b="25세"');
  const fi = dec.indexOf('<section class="card fold"');
  const fold = dec.slice(fi, dec.indexOf('</section>', fi) + '</section>'.length).replace('같은 팀의 사람', '살 곳을 구하는 일');
  const ti = dash.indexOf('<template id="state-now">');
  const tj = dash.lastIndexOf('</template>') + '</template>'.length;
  if (ti > 0 && tj > ti) dash = dash.slice(0, ti) + dash.slice(tj);
  dash = dash.replace(/<script>\(function\(\)\{var s=new URLSearchParams\(location\.search\)\.get\('state'\)[\s\S]*?<\/script>\n?/, '');
  dash = dash.replace('<title>수저 게임 · 시안 · 인생 기록 연표 줄·자산 카드 당시 화폐(SPEC-004 GM3)</title>', '<title>수저 게임 · 시안 · 대시보드의 집과 가족 그림 자리(SPEC-009)</title>');
  dash = dash.replace('<link rel="stylesheet" href="gm3.css">', '<link rel="stylesheet" href="../gm3/gm3.css">\n<link rel="stylesheet" href="family.css">');
  dash = dash.replace('<!-- 시안(정적 HTML, 가짜 데이터): 디자인 시스템 토큰·컴포넌트 스타일을 그대로 불러 쓴다. 주소 끝에 ?theme=dark 를 붙이면 다크 테마, &motion=reduce 면 움직임 줄이기. -->', '<!-- 시안(정적 HTML, 가짜 데이터) — gm3/dashboard-004.html에 결정 카드(decision-adult.html의 인라인 카드)와 집과 가족 그림 카드를 끼운 것(buildFamilyMockups.mjs). 그림체는 종이 오림(선택) 하나. ?theme=dark 다크 · &motion=reduce 움직임 줄이기 · ?scene=a|b|c|d|e 장면 · ?fold=1 그림 접힘 · ?open=1 펼침 열림 · ?decision=fold 결정 카드를 「잠시 덮어 두기」로 접은 띠 -->');
  const personLine = ([role, name, age, rel]) => `${role} · ${name} · ${age}세${rel ? ` · ${rel}` : ''}`;
  const sceneCard = (sc) => `<section class="card scene-card" aria-labelledby="scene-title" data-fold="false" data-scene="${sc.id}" data-testid="family-scene">
<h2 id="scene-title" class="sr-only">집과 가족</h2>
<div class="scene" id="scene-pic">${sceneSvg('s1', sc, 'role="img" aria-labelledby="scene-line scene-pets" focusable="false"')}</div>
<p class="scene__line" id="scene-line">${sc.line}</p>
<p class="sr-only" id="scene-pets">${sc.petLine}</p>
<div class="scene__row"><details class="scene__more" id="scene-more"><summary>함께 사는 사람</summary><ul class="scene__people">${sc.people.slice(0, 6).map((x) => `<li>${personLine(x)}</li>`).join('')}${sc.people.length > 6 ? `<li>그 밖에 ${sc.people.length - 6}명</li>` : ''}<li>${sc.petLine.replace(/가 있습니다\.$/, '')}</li></ul><p class="scene__open"><button class="btn btn--ghost btn--sm" type="button">가족과 삶 열기</button></p></details><button class="btn btn--ghost btn--sm scene__fold" type="button" aria-expanded="true" aria-controls="scene-pic" data-testid="scene-fold">그림 접기</button></div>
</section>`;
  const variants = Object.values(SCENES).filter((sc) => sc.id !== 'a').map((sc) => `<template data-scene="${sc.id}">${sceneCard(sc)}</template>`);
  const marker = '<div class="col col--center">';
  const i = dash.indexOf(marker);
  const inject = `${marker}${decision}\n${sceneCard(SCENES.a)}\n<!-- 올해 마음 쓸 곳(SPEC-008) 자리 — 아직 없으면 생략(FH1) -->\n`;
  dash = dash.slice(0, i) + inject + dash.slice(i + marker.length);
  dash = dash.replace('</body>', `${variants.join('\n')}
<template data-decision="fold">${fold}</template>
<script>(function(){var q=new URLSearchParams(location.search);var k=q.get('scene')||'a';if(q.get('decision')==='fold'){var ft=document.querySelector('template[data-decision="fold"]');var dc=document.querySelector('.decision--inline');if(ft&&dc)dc.replaceWith(ft.content.cloneNode(true));}var cur=document.querySelector('.scene-card');if(k!=='a'){var t=document.querySelector('template[data-scene="'+k+'"]');if(t&&cur){cur.replaceWith(t.content.cloneNode(true));cur=document.querySelector('.scene-card');}}
/* 접기(FH1): 접으면 그림만 사라지고 한 줄·펼침은 남는다. 설정에 저장(구현) — 시안은 ?fold=1 */
var btn=cur.querySelector('.scene__fold');function setFold(f){cur.setAttribute('data-fold',f?'true':'false');btn.setAttribute('aria-expanded',f?'false':'true');btn.textContent=f?'그림 펼치기':'그림 접기';}
if(q.get('fold')==='1')setFold(true);btn.addEventListener('click',function(){setFold(cur.getAttribute('data-fold')!=='true');});
if(q.get('open')==='1')cur.querySelector('.scene__more').open=true;})();</script>
</body>`);
  write('dashboard-family.html', dash);
}

// ---------------------------------------------------------------- 장면 요약(문서용 — 한 줄·매체 자리·화면 슬롯 px)
const SCENE_W = { pc: 534, mobile: 326 };
const summary = Object.values(SCENES).map((sc) => {
  const media = mediaPlacement(sc);
  const mp = media && byId[media[0]];
  const scr = mp && mp.screen ? { units: [mp.screen[2] * media[3], mp.screen[3] * media[3]].map(r1) } : null;
  if (scr) { scr.pc = scr.units.map((u) => r1((u * SCENE_W.pc) / 640)); scr.mobile = scr.units.map((u) => r1((u * SCENE_W.mobile) / 640)); }
  return { id: sc.id, year: sc.year, line: sc.line, lineChars: sc.line.length, people: sc.people.length, media: media ? media[0] : null, mediaAt: media ? media.slice(1, 3) : null, screen: scr };
});
write('scenes.json', JSON.stringify({ note: '장면별 한 줄(sceneLineOf 시안 규칙, LINE_MAX ' + LINE_MAX + ') · 매체 자리 · 빈 화면 자리 크기(단위: 그림 좌표 640, PC 534px, 휴대폰 326px)', scenes: summary }, null, 2) + '\n');

console.log('조각', PIECES.length, '× 그림체', Object.keys(STYLES).join(','), WITH_S2 ? '(비교용 s2 포함)' : '(정본 s1만)');
for (const [s, b] of Object.entries(budget.styles)) if (b.rows) console.log(`${s} ${b.name}: 조각 ${b.pieces} · 조각별 gzip 평균 ${b.gzEachAvg}B(합 ${b.gzEachTotal}) · 덩어리 gzip ${b.chunkGz}B(조각당 ${b.chunkPerPiece}B, 비율 ${b.chunkRatio}) · 93조각 추정 ${b.projected93}B · 110조각 ${b.projected110}B`);
for (const s of summary) console.log(`${s.id} ${s.year}: ${s.lineChars}자 「${s.line}」 매체 ${s.media ?? '-'} 화면 ${s.screen ? `${s.screen.units.join('×')}단위 = PC ${s.screen.pc.join('×')}px · 휴대폰 ${s.screen.mobile.join('×')}px` : '-'}`);
