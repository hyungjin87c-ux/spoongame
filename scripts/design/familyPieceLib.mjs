/**
 * SPEC-009 집과 가족 그림 — 조각 그리기 도우미(그림체 s1 「종이 오림」) (designer 2026-10-28, FM5 조각 보강 때 `buildFamilyMockups.mjs`에서 **그대로** 옮김 — 출력 바이트는 같다).
 * 토큰 24(라이트·다크) · `T()` · `mk(style)`(평면 조각 + (3,3) 밀린 그림자) · 식구 `person(h, figSpec(age, sex, era))` · 기와 `tiles` · 창호 `lattice`.
 * 쓰는 곳: `buildFamilyMockups.mjs`(장면·조각 표) · `familyPiecesFm5.mjs`(FM5 보강 조각 33) · `buildFm5Pieces.mjs`(보강 조각 시트). 의존성 없음.
 */
// ---------------------------------------------------------------- 토큰(승인 24개) — 라이트 기본값 = SVG fallback, 다크는 family.css
export const LIGHT = {
  sky: '#dfe6ed', far: '#b9c4d0', far2: '#cfd8e2', ground: '#e4dccb', ground2: '#cfc5ae',
  wall: '#f5f0e5', wall2: '#cdc3ac', roof: '#5b6879', roof2: '#404b58', wood: '#8a6b4c', clay: '#926f52',
  ink: '#2b2a27', shade: 'rgba(38,50,74,0.2)', glass: '#fbf3d4', green: '#6e8a5b',
  cloth1: '#26324a', cloth2: '#8a6a14', cloth3: '#f7f2e8', cloth4: '#6c7f9e',
  skin: '#f1c9a5', hair: '#2b2420', hairw: '#d6d2ca', pet: '#a98c66', pet2: '#4a453d', face: '#4a362c',
};
export const DARK = {
  sky: '#1e2633', far: '#2b3443', far2: '#252e3c', ground: '#2b3039', ground2: '#222730',
  wall: '#4a5264', wall2: '#3a4151', roof: '#7b8a9c', roof2: '#5d6b7d', wood: '#a0805e', clay: '#a07d60',
  ink: '#ece8de', shade: 'rgba(0,0,0,0.38)', glass: '#efdc9a', green: '#7f9a6c',
  cloth1: '#b3c2e8', cloth2: '#dcb85c', cloth3: '#e6e0d3', cloth4: '#93a3bf',
  skin: '#f1c9a5', hair: '#2b2420', hairw: '#d6d2ca', pet: '#b89c78', pet2: '#c9c3b8', face: '#4a362c',
};
export const T = (n) => `var(--c-scene-${n},${LIGHT[n]})`;

// ---------------------------------------------------------------- 그림체 도우미
export function mk(style) {
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
export const r1 = (n) => Math.round(n * 10) / 10;

// ---------------------------------------------------------------- 식구 조각 (발바닥 가운데가 원점)
/**
 * 연령대 기하(FH2 ④ — 얼굴 시스템 ageGroupOf와 같은 경계): H 키 · r 머리 반지름 · sw 어깨 폭(여/남).
 * infant(0~2)는 업힌 조각(fig-infant-carried)이 맡는다.
 */
export const AGE_GEO = {
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
export const OUTFIT = {
  e1: { f: 'hanbok', m: 'hanbok-m', girl: 'hanbok', boy: 'hanbok-m' },
  e2: { f: 'blouse-skirt', m: 'shirt-trousers', girl: 'dress', boy: 'shirt-shorts' },
  e3: { f: 'cardigan-pants', m: 'polo-trousers', girl: 'dress', boy: 'tee-shorts' },
};
export const HAIR = { e1: { f: 'bun', m: 'short-m', girl: 'bob', boy: 'boy' }, e2: { f: 'perm', m: 'short-m', girl: 'bob', boy: 'boy' }, e3: { f: 'tied', m: 'short-m', girl: 'bob', boy: 'boy' } };
/** 연령대 × 성별 × 시대 → person() 스펙 (조각 id `fig-<age>-<sex>-<era>`) */
export function figSpec(age, sex, era, o = {}) {
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
export function defaultToks(outfit, sex, old) {
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
export function person(h, p) {
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
export function capPath(r, hy, outer, inner, sideY) {
  const R = r * outer;
  const sy = hy + r * sideY;
  const inY = hy - r * inner;
  return `M ${r1(-R)},${r1(sy)} A ${r1(R)} ${r1(R)} 0 0 1 ${r1(R)},${r1(sy)} Q ${r1(R)},${r1(hy - r * 0.2)} ${r1(r * 0.8)},${r1(hy - r * 0.4)} Q 0,${r1(inY)} ${r1(-r * 0.8)},${r1(hy - r * 0.4)} Q ${r1(-R)},${r1(hy - r * 0.2)} ${r1(-R)},${r1(sy)} Z`;
}
export function hairFront(h, p, hy) {
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
export function hairBack(h, p, hy) {
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
export const tiles = (h, x0, x1, y, n) => { let d = ''; const step = (x1 - x0) / n; for (let i = 0; i < n; i++) d += `M ${r1(x0 + i * step)},${y} a ${r1(step / 2)} ${r1(step / 2)} 0 0 0 ${r1(step)} 0 Z `; return h.path(d.trim(), T('roof2'), { flat: !h.line, w: 2 }); };
/** 창호(문살) — 마루 뒤의 방문 */
export const lattice = (h, x, y, w, hh) => h.rect(x, y, w, hh, T('cloth3')) + h.stroke(`M ${r1(x + w / 2)},${y} V ${r1(y + hh)} M ${x},${r1(y + hh / 3)} H ${r1(x + w)} M ${x},${r1(y + (2 * hh) / 3)} H ${r1(x + w)}`, 1.5, 'wood');
