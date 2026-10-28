import { FIGURE_GEO, type FigureGroup, type OutfitEra, type PieceOpt } from '../sceneTables';
import { T, h, r1 } from './svg';

/**
 * 식구 조각 (SPEC-009 FM5, family-scene.md 2-5절). 몸은 `person()` **한 함수**가 연령대 × 성별 × 시대 옷으로 만든다 — 조각 파일이 아니라 코드라 바이트가 거의 들지 않는다(식구 층 전체 ≈ 3~4KB, 마스터 결정: 코드 분기 몸 16 + 옷 6을 조각으로 센다).
 * designer의 시안 생성기 `scripts/design/buildFamilyMockups.mjs`의 `person()`·`figSpec()`·머리 모양을 그대로 옮겼고(그린 19개 조합은 시안 SVG와 바이트 일치를 옮길 때 대조했다), 옷 색 변형 `v`(0~2)만 더했다 —
 * 같은 판의 식구가 모두 같은 색 옷이 되지 않게 한다(조각 수를 늘리지 않는 변형: 옷 색 토큰). 얼굴이 없고 머리 모양·옷으로 사람을 읽는다.
 */

type Sex = 'f' | 'm';
type Hair = 'short-m' | 'boy' | 'perm' | 'bob' | 'bun' | 'tied';
type Outfit = 'hanbok' | 'hanbok-m' | 'blouse-skirt' | 'shirt-trousers' | 'cardigan-pants' | 'polo-trousers' | 'dress' | 'tee-shorts' | 'shirt-shorts';
interface Toks {
  a: string;
  b?: string;
  c?: string;
  v?: string;
}
interface Spec {
  H: number;
  r: number;
  sw: number;
  outfit: Outfit;
  hair: Hair;
  hairTok: string;
  toks: Toks;
  cane: boolean;
  shoeTok?: string;
}

const OUTFIT: Record<OutfitEra, { f: Outfit; m: Outfit; girl: Outfit; boy: Outfit }> = {
  e1: { f: 'hanbok', m: 'hanbok-m', girl: 'hanbok', boy: 'hanbok-m' },
  e2: { f: 'blouse-skirt', m: 'shirt-trousers', girl: 'dress', boy: 'shirt-shorts' },
  e3: { f: 'cardigan-pants', m: 'polo-trousers', girl: 'dress', boy: 'tee-shorts' },
};
const HAIR: Record<OutfitEra, { f: Hair; m: Hair; girl: Hair; boy: Hair }> = {
  e1: { f: 'bun', m: 'short-m', girl: 'bob', boy: 'boy' },
  e2: { f: 'perm', m: 'short-m', girl: 'bob', boy: 'boy' },
  e3: { f: 'tied', m: 'short-m', girl: 'bob', boy: 'boy' },
};

function defaultToks(outfit: Outfit, old: boolean): Toks {
  switch (outfit) {
    case 'hanbok':
      return old ? { a: 'cloth3', b: 'cloth4', c: 'cloth1' } : { a: 'cloth3', b: 'cloth1', c: 'cloth2' };
    case 'hanbok-m':
      return old ? { a: 'cloth3', b: 'cloth3', c: 'cloth1', v: 'cloth1' } : { a: 'cloth3', b: 'cloth4', c: 'cloth1' };
    case 'blouse-skirt':
      return { a: 'cloth2', b: 'cloth1' };
    case 'shirt-trousers':
      return { a: 'cloth3', b: 'cloth1' };
    case 'cardigan-pants':
      return { a: 'cloth1', b: 'cloth4' };
    case 'polo-trousers':
      return { a: 'cloth4', b: 'roof2' };
    case 'dress':
      return { a: 'cloth1' };
    case 'tee-shorts':
      return { a: 'cloth2', b: 'cloth1' };
    case 'shirt-shorts':
      return { a: 'cloth3', b: 'cloth4' };
  }
}

/** 옷 색 변형 1·2 (0은 시안 그대로) — 같은 옷 모양의 다른 토큰 배색. 모두 승인된 24개 토큰 안이다 */
const ALT_TOKS: Record<Outfit, readonly Toks[]> = {
  hanbok: [{ a: 'cloth3', b: 'cloth4', c: 'cloth1' }, { a: 'cloth4', b: 'cloth3', c: 'cloth2' }],
  'hanbok-m': [{ a: 'cloth3', b: 'cloth1', c: 'cloth4' }, { a: 'cloth4', b: 'cloth3', c: 'cloth1' }],
  'blouse-skirt': [{ a: 'cloth3', b: 'cloth1' }, { a: 'cloth4', b: 'cloth1' }],
  'shirt-trousers': [{ a: 'cloth4', b: 'cloth1' }, { a: 'cloth3', b: 'roof2' }],
  'cardigan-pants': [{ a: 'cloth2', b: 'cloth1' }, { a: 'cloth4', b: 'roof2' }],
  'polo-trousers': [{ a: 'cloth1', b: 'roof2' }, { a: 'cloth3', b: 'cloth1' }],
  dress: [{ a: 'cloth4' }, { a: 'cloth2' }],
  'tee-shorts': [{ a: 'cloth1', b: 'cloth4' }, { a: 'cloth4', b: 'cloth1' }],
  'shirt-shorts': [{ a: 'cloth4', b: 'cloth3' }, { a: 'cloth3', b: 'cloth1' }],
};

function figSpec(group: FigureGroup, sex: Sex, era: OutfitEra, o: PieceOpt): Spec {
  const g = FIGURE_GEO[group];
  const kid = group === 'toddler' || group === 'child';
  const old = group === 'senior' || group === 'elder';
  const key = kid ? (sex === 'f' ? 'girl' : 'boy') : sex;
  const outfitEra: OutfitEra = old && era === 'e2' ? 'e1' : era; // 장년·노년은 e2까지 한복
  const outfit = OUTFIT[outfitEra][key];
  const hair: Hair = old ? (sex === 'f' ? 'bun' : 'short-m') : HAIR[era][key];
  const v = o.v ?? 0;
  const toks = v > 0 && !old ? ALT_TOKS[outfit][(v - 1) % 2] : defaultToks(outfit, old);
  return { H: g.H, r: g.r, sw: g.sw[sex === 'f' ? 0 : 1], outfit, hair, hairTok: old ? 'hairw' : 'hair', toks, cane: group === 'elder', shoeTok: o.shoeTok };
}

/** 머리 모양 — 머리 위를 덮는 조각(앞) + 머리 뒤에 오는 조각(뒤) */
function capPath(r: number, hy: number, outer: number, inner: number, sideY: number): string {
  const R = r * outer;
  const sy = hy + r * sideY;
  const inY = hy - r * inner;
  return `M ${r1(-R)},${r1(sy)} A ${r1(R)} ${r1(R)} 0 0 1 ${r1(R)},${r1(sy)} Q ${r1(R)},${r1(hy - r * 0.2)} ${r1(r * 0.8)},${r1(hy - r * 0.4)} Q 0,${r1(inY)} ${r1(-r * 0.8)},${r1(hy - r * 0.4)} Q ${r1(-R)},${r1(hy - r * 0.2)} ${r1(-R)},${r1(sy)} Z`;
}
function hairFront(p: Spec, hy: number): string {
  const { r } = p;
  const tok = T(p.hairTok);
  switch (p.hair) {
    case 'short-m':
      return h.path(capPath(r, hy, 1.04, 0.5, 0.05), tok);
    case 'boy':
      return h.path(capPath(r, hy, 1.06, 0.55, 0.0), tok);
    case 'perm':
      return h.path(capPath(r, hy, 1.13, 0.5, 0.2), tok);
    case 'bob':
      return h.path(capPath(r, hy, 1.1, 0.55, 0.1), tok);
    case 'bun':
      return h.path(capPath(r, hy, 1.04, 0.45, 0.1), tok);
    case 'tied':
      return h.path(capPath(r, hy, 1.08, 0.55, 0.15), tok);
  }
}
function hairBack(p: Spec, hy: number): string {
  const { r } = p;
  const tok = T(p.hairTok);
  switch (p.hair) {
    case 'perm':
      return h.rect(-r * 1.13, hy - r * 0.1, r * 0.5, r * 0.8, tok, { rx: r * 0.25 }) + h.rect(r * 0.63, hy - r * 0.1, r * 0.5, r * 0.8, tok, { rx: r * 0.25 });
    case 'bob':
      return h.rect(-r * 1.1, hy - r * 0.1, r * 0.5, r * 1.15, tok, { rx: r * 0.2 }) + h.rect(r * 0.6, hy - r * 0.1, r * 0.5, r * 1.15, tok, { rx: r * 0.2 });
    case 'bun':
      return h.circle(r * 0.62, hy + r * 0.5, r * 0.46, tok);
    case 'tied':
      return h.rect(r * 0.25, hy + r * 0.2, r * 0.6, r * 1.9, tok, { rx: r * 0.3 });
    default:
      return '';
  }
}

/** 사람 한 명 (발바닥 가운데가 원점) */
function person(p: Spec): string {
  const { H, r, sw } = p;
  const hy = -(H - r);
  const shY = -(H - 2 * r - 3);
  const hipY = -H * 0.5;
  const tk = p.toks;
  const out: string[] = [];
  const armL = (hipY - shY) * 0.95;
  const arm = (s: number, w = 7, tok: string = tk.a): string => {
    const x0 = s * (sw / 2 - 2);
    const ex = r1(x0 + s * Math.sin((12 * Math.PI) / 180) * armL);
    const ey = r1(shY + 3 + Math.cos((12 * Math.PI) / 180) * armL);
    return h.rect(-w / 2, 0, w, armL, T(tok), { rx: w / 2, tf: `translate(${r1(x0)} ${r1(shY + 3)}) rotate(${s * 12})` }) + h.circle(ex, ey, 3.4, T('skin'));
  };
  const shoes = (lw: number, tok = p.shoeTok || 'roof2'): string => h.rect(-lw - 1, -4, lw + 1.5, 4, T(tok), { rx: 2 }) + h.rect(-0.5, -4, lw + 1.5, 4, T(tok), { rx: 2 });
  const legsSkin = (fromY: number, x = 2.5, w = 5): string => h.rect(-x - w, fromY, w, -fromY, T('skin')) + h.rect(x, fromY, w, -fromY, T('skin'));
  const b = tk.b ?? 'cloth1';
  const c = tk.c ?? 'cloth1';
  // 뒤에 오는 것(배낭·머리 옆 조각·쪽·지팡이)
  if (p.outfit === 'tee-shorts') out.push(h.rect(-sw / 2 - 3, shY + 2, sw + 6, (hipY - shY) * 0.8, T('roof2'), { rx: 5 }));
  if (p.cane) out.push(h.rect(sw / 2 + 6, hipY - 2, 2.5, -hipY + 2, T('wood'), { rx: 1 }));
  out.push(hairBack(p, hy));
  // 다리·치마
  switch (p.outfit) {
    case 'shirt-trousers':
    case 'polo-trousers':
    case 'cardigan-pants': {
      const lw = p.outfit === 'cardigan-pants' ? 8 : 10;
      out.push(h.rect(-lw, hipY - 3, lw - 1.5, -hipY + 3 - 3, T(b), { rx: 3, shade: true }), h.rect(1.5, hipY - 3, lw - 1.5, -hipY + 3 - 3, T(b), { rx: 3 }), shoes(lw));
      break;
    }
    case 'hanbok-m': {
      // 바지저고리 — 넉넉한 바지, 발목 대님, 고무신(흰 또는 검정 — shoeTok)
      const lw = sw * 0.42;
      out.push(h.rect(-lw - 1, hipY - 3, lw, -hipY + 3 - 4, T(b), { rx: 4, shade: true }), h.rect(1, hipY - 3, lw, -hipY + 3 - 4, T(b), { rx: 4 }));
      out.push(h.rect(-lw - 1, -7, lw, 2.5, T(c)), h.rect(1, -7, lw, 2.5, T(c)));
      out.push(h.ellipse(-5.5, -2.2, 5.6, 2.4, T(p.shoeTok || 'cloth3')), h.ellipse(5.5, -2.2, 5.6, 2.4, T(p.shoeTok || 'cloth3')));
      break;
    }
    case 'blouse-skirt': {
      const hemY = -H * 0.14;
      out.push(legsSkin(hemY), shoes(7), h.path(`M ${r1(-sw / 2 + 2)},${r1(hipY - 3)} L ${r1(sw / 2 - 2)},${r1(hipY - 3)} L ${r1(sw / 2 + 8)},${r1(hemY)} L ${r1(-sw / 2 - 8)},${r1(hemY)} Z`, T(b), { shade: true }));
      break;
    }
    case 'hanbok': {
      const chestY = shY + H * 0.1;
      const hemY = -H * 0.05;
      out.push(h.ellipse(-5.5, -2.2, 5.2, 2.4, T('cloth3')), h.ellipse(5.5, -2.2, 5.2, 2.4, T('cloth3')));
      out.push(h.path(`M ${r1(-sw / 2)},${r1(chestY)} L ${r1(sw / 2)},${r1(chestY)} L ${r1(sw / 2 + 15)},${r1(hemY)} L ${r1(-sw / 2 - 15)},${r1(hemY)} Z`, T(b), { shade: true }));
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
      out.push(legsSkin(hemY, 2, 4.5), shoes(6), h.rect(-9, hipY - 2, 8, hemY - hipY + 2, T(b), { rx: 3 }), h.rect(1, hipY - 2, 8, hemY - hipY + 2, T(b), { rx: 3 }));
      break;
    }
  }
  // 목·몸통
  out.push(h.rect(-3, hy + r - 2, 6, shY - (hy + r) + 4, T('skin')));
  switch (p.outfit) {
    case 'shirt-trousers':
    case 'polo-trousers':
      out.push(h.rect(-sw / 2, shY, sw, hipY - shY + 3, T(tk.a), { rx: 5, shade: true }), arm(-1), arm(1));
      if (p.outfit === 'polo-trousers') out.push(h.path(`M -6,${r1(shY + 1)} L 0,${r1(shY + 8)} L 6,${r1(shY + 1)} Z`, T('cloth3')));
      break;
    case 'blouse-skirt':
      out.push(h.rect(-sw / 2, shY, sw, hipY - shY + 1, T(tk.a), { rx: 5 }), arm(-1), arm(1), h.path(`M -5,${r1(shY)} a 5 4 0 0 0 10 0 Z`, T('cloth3')));
      break;
    case 'hanbok': {
      const chestY = shY + H * 0.1;
      out.push(h.rect(-sw / 2 - 1, shY, sw + 2, chestY - shY + 5, T(tk.a), { rx: 4 }), arm(-1, 10, tk.a), arm(1, 10, tk.a));
      out.push(h.path(`M -1.5,${r1(chestY - 1)} l 4,0 l 2,13 l -5,0 Z`, T(c)));
      break;
    }
    case 'hanbok-m': {
      // 저고리(넓은 소매) + 고름 + 조끼(v가 있을 때)
      out.push(h.rect(-sw / 2 - 1, shY, sw + 2, hipY - shY + 6, T(tk.a), { rx: 4, shade: true }), arm(-1, 10, tk.a), arm(1, 10, tk.a));
      if (tk.v) out.push(h.rect(-sw / 2 + 3, shY + 1, sw - 6, hipY - shY + 1, T(tk.v), { rx: 3 }));
      out.push(h.path(`M -1,${r1(shY + 5)} l 3,0 l 1.5,12 l -4.5,0 Z`, T(c)));
      break;
    }
    case 'dress': {
      const hemY = -H * 0.32;
      out.push(h.path(`M ${r1(-sw / 2)},${r1(shY)} L ${r1(sw / 2)},${r1(shY)} L ${r1(sw / 2 + 7)},${r1(hemY)} L ${r1(-sw / 2 - 7)},${r1(hemY)} Z`, T(tk.a), { shade: true }), arm(-1, 6), arm(1, 6));
      out.push(h.path(`M -5,${r1(shY)} a 5 4 0 0 0 10 0 Z`, T('cloth3')));
      break;
    }
    case 'tee-shorts':
      out.push(h.rect(-sw / 2, shY, sw, hipY - shY + 2, T(tk.a), { rx: 5, shade: true }), arm(-1, 6), arm(1, 6));
      out.push(h.rect(-sw / 2 + 3, shY + 1, 4, hipY - shY - 4, T('roof2'), { rx: 2 }), h.rect(sw / 2 - 7, shY + 1, 4, hipY - shY - 4, T('roof2'), { rx: 2 }));
      break;
    case 'shirt-shorts':
      out.push(h.rect(-sw / 2, shY, sw, hipY - shY + 2, T(tk.a), { rx: 5, shade: true }), arm(-1, 6), arm(1, 6));
      out.push(h.path(`M -4.5,${r1(shY + 0.5)} L 0,${r1(shY + 6)} L 4.5,${r1(shY + 0.5)} Z`, T(b)));
      break;
    case 'cardigan-pants':
      out.push(h.rect(-sw / 2, shY, sw, hipY - shY + 2, T(tk.a), { rx: 5, shade: true }), h.rect(-4, shY + 2, 8, hipY - shY - 4, T('cloth3')), arm(-1), arm(1));
      break;
  }
  // 머리·머리카락 (얼굴은 그리지 않는다)
  out.push(h.circle(0, hy, r, T('skin'), { shade: true }));
  out.push(hairFront(p, hy));
  return out.join('');
}

/** 식구 조각 `fig-<연령대>-<f|m>-<e1|e2|e3>` 마크업 */
export function figureMarkup(group: FigureGroup, sex: Sex, era: OutfitEra, opt: PieceOpt = {}): string {
  return person(figSpec(group, sex, era, opt));
}

/** 업힌 아기 — 포대기로 업힌 아기를 업은 사람 조각 **뒤**에, 같은 자리에 놓는다. `H`는 업은 사람의 키(기본 94) */
export function infantCarriedMarkup(opt: PieceOpt = {}): string {
  const H = opt.H ?? 94;
  const r = 10.5;
  const shY = -(H - 2 * r - 3);
  const hipY = -H * 0.5;
  return [
    h.rect(-18, shY + 1, 36, hipY - shY + 14, T(opt.tok ?? 'cloth2'), { rx: 7, shade: true }),
    h.circle(10.5, shY - 5, 6.5, T('skin'), { shade: true }),
    h.path(capPath(6.5, shY - 5, 1.05, 0.5, 0.0), T('hair')),
  ].join('');
}
