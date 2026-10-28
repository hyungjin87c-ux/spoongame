/**
 * SPEC-009 「시대의 창」 r4 — 사람 조각 `<symbol>`+`<use>` · 색은 `class` (designer 2026-10-28, r4 — 마스터 예산 결정 2026-10-28).
 * r3 도우미(`eraR3Lib.mjs` — 건물·차량·연기·태극기·패턴·톤)는 그대로 쓰고, **사람만** 심볼 참조로 바꾼다:
 *   - 사람 한 명 = `<use href="#ps" x y width height class="et-… eb-… eh-…"/>` 하나(+ 선택: 모자 `<use>` · 든 팔 · 짐).
 *   - 심볼은 `FIG_DEFS`(덩어리에 한 번) — 뒷모습 서기 ps · 외투 po · 치마 pk · 한복 긴 치마 pj · 옆모습 걷기 pw/pwk/pwj · 쪼그림 pc · 먼 인물 pf · 모자 hh/hd/hc/hs/hb.
 *   - 색은 CSS 변수 `--t`(윗옷) `--b`(아래) `--h`(머리) `--k`(모자)를 `<use>`의 클래스가 정한다(`tokenCss()`). 다른 조각은 출력 때 `toClass()`가 fill/stroke var()를 `class="e-…"`/`class="es-…"`로 바꾼다.
 * 얼굴은 여전히 없다(뒷모습·옆모습·먼 인물 — 눈·코·입 0). 토큰은 `--c-scene-*` 24개뿐.
 */
import { f, rep, LIGHT, T, taegeuk, shieldLine as shieldLine3, sitter as sitter3 } from './eraR3Lib.mjs';
export * from './eraR3Lib.mjs';

const q1 = (n) => Math.round(n * 10) / 10;
const r1 = (n) => Math.round(n * 100) / 100;
const R = (x, y, w, h, tok, o) => f.rect(q1(x), q1(y), q1(w), q1(h), tok, o);
const C = (cx, cy, r, tok, o) => f.circle(q1(cx), q1(cy), q1(r), tok, o);

/** 결정적 난수(장면마다 같은 그림) */
export const seeded = (seed) => { let s = (seed * 9301 + 49297) % 233280; return () => { s = (s * 9301 + 49297) % 233280; return s / 233280; }; };
export const pick = (rnd, arr) => arr[Math.floor(rnd() * arr.length) % arr.length];

// ---------------------------------------------------------------- 심볼(덩어리에 한 번)
const vt = (tok) => `var(--t,${LIGHT[tok]})`, vb = (tok) => `var(--b,${LIGHT[tok]})`, vh = (tok) => `var(--h,${LIGHT[tok]})`, vk = `var(--k,${LIGHT.roof2})`;
const SKIN = `var(--c-scene-skin,${LIGHT.skin})`;
const sym = (id, vb_, inner) => `<symbol id="${id}" viewBox="${vb_}" preserveAspectRatio="none" overflow="visible">${inner}</symbol>`;
/** 서 있는 뒷모습 30×100: 다리 둘 · 몸통 · 머리 */
const legsBack = `<rect x="3.5" y="60" width="11" height="40" fill="${vb('cloth1')}"/><rect x="16.5" y="60" width="11" height="40" fill="${vb('cloth1')}"/>`;
const head = (cx, cy, r) => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${vh('hair')}"/>`;
/** 옆모습 걷기 22×100: 뒷다리(연함)·앞다리·몸통·머리 */
const legsSide = `<path d="M4.4,60H17.6L9.2,100H-2.9Z" fill="${vb('cloth1')}" opacity=".8"/><path d="M4.4,60H17.6L24.9,100H12.8Z" fill="${vb('cloth1')}"/>`;
export const FIG_DEFS = [
  sym('ps', '0 0 30 100', `${legsBack}<rect x="0" y="23" width="30" height="40" rx="5" fill="${vt('cloth3')}"/>${head(15, 10.5, 10.5)}`),
  sym('po', '0 0 30 100', `${legsBack}<rect x="0" y="23" width="30" height="54" rx="5" fill="${vt('cloth3')}"/>${head(15, 10.5, 10.5)}`),
  sym('pk', '0 0 30 100', `<path d="M0,60H30L33.6,88H-3.6Z" fill="${vb('cloth1')}"/><rect x="3" y="88" width="8.8" height="12" fill="${SKIN}"/><rect x="18.2" y="88" width="8.8" height="12" fill="${SKIN}"/><rect x="0" y="23" width="30" height="40" rx="5" fill="${vt('cloth3')}"/>${head(15, 10.5, 10.5)}`),
  sym('pj', '0 0 30 100', `<path d="M1,50H29L38,98H-8Z" fill="${vb('cloth1')}"/><rect x="0" y="23" width="30" height="30" rx="5" fill="${vt('cloth3')}"/>${head(15, 10.5, 10.5)}`),
  sym('pw', '0 0 22 100', `${legsSide}<rect x="0" y="23" width="22" height="40" rx="4" fill="${vt('cloth3')}"/>${head(12.5, 10.5, 10.5)}`),
  sym('pwk', '0 0 22 100', `${legsSide}<path d="M-1.1,60H23.1L27.5,86H-5.5Z" fill="${vb('cloth1')}"/><rect x="0" y="23" width="22" height="40" rx="4" fill="${vt('cloth3')}"/>${head(12.5, 10.5, 10.5)}`),
  sym('pwj', '0 0 22 100', `${legsSide}<path d="M0,50H22L30,97H-8Z" fill="${vb('cloth1')}"/><rect x="0" y="23" width="22" height="30" rx="4" fill="${vt('cloth3')}"/>${head(12.5, 10.5, 10.5)}`),
  sym('pc', '0 0 62 100', `<rect x="3.1" y="78" width="55.8" height="22" rx="6" fill="${vb('cloth1')}"/><path d="M0,80Q0,22 31,20Q62,22 62,80Z" fill="${vt('cloth3')}"/>${head(37.2, 16, 13)}`),
  sym('pf', '0 0 34 100', `<rect x="0" y="28" width="34" height="72" rx="10" fill="${vt('cloth3')}"/>${head(17, 15, 13)}`),
  // 모자 — 머리 반지름 단위(-1.5~1.5), 색은 --k
  sym('hh', '-1.5 -1.5 3 3', `<path d="M-1.15,.15a1.15,1.15 0 0 1 2.3,0z" fill="${vk}"/>`),
  sym('hd', '-1.5 -1.5 3 3', `<path d="M-1.1,.15a1.1,1.1 0 0 1 2.2,0z" fill="${vk}"/><rect x="-1.3" y=".05" width="2.6" height=".22" fill="${vk}"/>`),
  sym('hc', '-1.5 -1.5 3 3', `<path d="M-1,-.1a1,1 0 0 1 2,0z" fill="${vk}"/><rect x=".6" y="-.2" width=".9" height=".22" fill="${vk}"/>`),
  sym('hs', '-1.5 -1.5 3 3', `<path d="M-1.05,.4a1.05,1.05 0 0 1 2.1,0l-.65,.9h-.8z" fill="${vk}"/>`),
  sym('hb', '-1.5 -1.5 3 3', `<rect x="-1.02" y="-.25" width="2.04" height=".38" fill="${vk}"/>`),
  sym('hg', '-1.5 -1.5 3 3', `<path d="M-1.15,.25a1.15,1.15 0 0 1 2.3,0z" fill="${vk}"/><rect x="-1.25" y=".1" width="2.5" height=".3" fill="${vk}"/>`), // 갓·중절모 비슷한 챙 모자
].join('');

/** 토큰 → 클래스 CSS(문서에 한 번). e- 채움 · es- 선 · et-/eb-/eh-/ek- 사람 변수 */
export const tokenCss = () => Object.entries(LIGHT).map(([k, v]) => `.e-${k}{fill:var(--c-scene-${k},${v})}.es-${k}{stroke:var(--c-scene-${k},${v})}.et-${k}{--t:var(--c-scene-${k},${v})}.eb-${k}{--b:var(--c-scene-${k},${v})}.eh-${k}{--h:var(--c-scene-${k},${v})}.ek-${k}{--k:var(--c-scene-${k},${v})}`).join('\n');
/** fill/stroke var(--c-scene-…) → class (출력 때 한 번) */
export const toClass = (s) => s.replace(/fill="var\(--c-scene-([a-z0-9]+),[^"]*\)"/g, 'class="e-$1"').replace(/stroke="var\(--c-scene-([a-z0-9]+),[^"]*\)"/g, 'class="es-$1"');

// ---------------------------------------------------------------- 사람(심볼 참조)
const opAttr = (o) => (o && o.op !== undefined ? ` opacity="${o.op}"` : '');
const cls = (top, bottom, hair) => [top !== 'cloth3' && `et-${top}`, bottom !== 'cloth1' && `eb-${bottom}`, hair !== 'hair' && `eh-${hair}`].filter(Boolean).join(' ');
/** 심볼 한 번 쓰기 */
export const U = (id, x, y, w, h, c = '', o = {}) => `<use href="#${id}" x="${q1(x)}" y="${q1(y)}" width="${q1(w)}" height="${q1(h)}"${c ? ` class="${c}"` : ''}${opAttr(o)}${o.tr ? ` transform="${o.tr}"` : ''}/>`;
/** 좌우 뒤집어 쓰기(dir -1) */
const Ud = (id, x, y, w, h, c, dir, o = {}) => (dir > 0 ? U(id, x, y, w, h, c, o) : U(id, -(x + w), y, w, h, c, { ...o, tr: 'scale(-1 1)' }));
const HATS = { helmet: 'hh', hardhat: 'hd', cap: 'hc', scarf: 'hs', band: 'hb', brim: 'hg' };
const hat = (kind, hx, hy, hr, tok, dir = 1, o = {}) => (HATS[kind] ? Ud(HATS[kind], hx - hr * 1.5, hy - hr * 1.5, hr * 3, hr * 3, tok === 'roof2' ? '' : `ek-${tok}`, dir, o) : '');

/**
 * 뒷모습 사람(서 있음). x = 가운데, yBase = 발바닥, h = 키.
 * o: top bottom hair hat('helmet'|'hardhat'|'cap'|'scarf'|'band'|'brim') hatTok arm('upL'|'upR'|'up') skirt long(한복 긴 치마) coat bag carry('box'|'bundle'|'paper'|'bucket'|'flag'|'sign'|'jar')
 */
export const person = (x, yBase, h, o = {}) => {
  const { top = 'cloth3', bottom = 'cloth1', hair = 'hair', hat: hk = null, hatTok = 'roof2', arm = null, skirt = false, long = false, coat = false, bag = null, carry = null, op } = o;
  const hr = h * 0.105, hy = yBase - h + hr, tw = h * 0.3, tTop = yBase - h * 0.77, tH = coat ? h * 0.54 : h * 0.4;
  let s = U(long ? 'pj' : skirt ? 'pk' : coat ? 'po' : 'ps', x - tw / 2, yBase - h, tw, h, cls(top, bottom, hair), { op });
  const aw = h * 0.085, aL = h * 0.36;
  if (arm === 'upL' || arm === 'up') s += R(x - tw / 2 - aw * 0.3, tTop - aL + h * 0.04, aw, aL, top, { rx: q1(aw / 2), tr: `rotate(14 ${q1(x - tw / 2)} ${q1(tTop + h * 0.04)})`, op });
  if (arm === 'upR' || arm === 'up') s += R(x + tw / 2 - aw * 0.7, tTop - aL + h * 0.04, aw, aL, top, { rx: q1(aw / 2), tr: `rotate(-14 ${q1(x + tw / 2)} ${q1(tTop + h * 0.04)})`, op });
  if (bag) s += R(x + tw * 0.1, tTop + tH * 0.55, tw * 0.5, tH * 0.55, bag, { rx: 0.2, op });
  if (carry === 'box') s += R(x + tw / 2, tTop + aL * 0.6, h * 0.22, h * 0.16, 'clay', { op });
  if (carry === 'bundle') s += f.ellipse(q1(x), q1(yBase - h - hr * 0.3), q1(h * 0.26), q1(h * 0.13), 'cloth3', { op });
  if (carry === 'jar') s += f.ellipse(q1(x), q1(yBase - h - hr * 0.5), q1(h * 0.16), q1(h * 0.14), 'clay', { op });
  if (carry === 'paper') s += R(x - tw * 0.42, tTop + h * 0.08, tw * 0.84, h * 0.2, 'cloth3', { op });
  if (carry === 'bucket') s += R(x + tw / 2 + aw * 0.2, tTop + aL * 0.75, h * 0.17, h * 0.17, 'hairw', { op });
  if (carry === 'flag') s += f.line(`M${q1(x + tw / 2 + aw * 0.3)},${q1(tTop + h * 0.1)}V${q1(tTop - h * 0.62)}`, q1(h * 0.03), 'wood', { op }) + taegeuk(q1(x + tw / 2 + aw * 0.3), q1(tTop - h * 0.62), q1(h * 0.3), { op });
  if (carry === 'sign') s += R(x - tw * 0.5, tTop - h * 0.34, tw, h * 0.22, 'cloth3', { op }) + R(x - h * 0.015, tTop - h * 0.12, h * 0.03, h * 0.14, 'wood', { op });
  s += hat(hk, x, hy, hr, hatTok, 1, { op });
  return s;
};

/** 옆모습으로 걷는 사람(dir 1 = 오른쪽으로). o: top bottom hair hat hatTok skirt long load('jige'|'bundle'|'baby'|'bag'|'briq'|'jar') */
export const walker = (x, yBase, h, o = {}, dir = 1) => {
  const { top = 'cloth3', bottom = 'cloth1', hair = 'hair', hat: hk = null, hatTok = 'roof2', skirt = false, long = false, load = null, op } = o;
  const hr = h * 0.105, hy = yBase - h + hr, tw = h * 0.22, tTop = yBase - h * 0.77, tH = h * 0.4;
  let s = Ud(long ? 'pwj' : skirt ? 'pwk' : 'pw', x - tw / 2, yBase - h, tw, h, cls(top, bottom, hair), dir, { op });
  if (load === 'jige') s += R(x - dir * tw * 0.9 - (dir > 0 ? h * 0.1 : 0), tTop - h * 0.1, h * 0.1, h * 0.55, 'wood', { op }) + R(x - dir * tw * 1.1 - (dir > 0 ? h * 0.24 : 0), tTop - h * 0.26, h * 0.3, h * 0.42, 'cloth3', { rx: 0.2, op });
  if (load === 'bundle') s += f.ellipse(q1(x), q1(yBase - h - hr * 0.35), q1(h * 0.24), q1(h * 0.12), 'cloth3', { op });
  if (load === 'jar') s += f.ellipse(q1(x), q1(yBase - h - hr * 0.5), q1(h * 0.15), q1(h * 0.14), 'clay', { op });
  if (load === 'baby') s += R(x - dir * tw * 0.95 - (dir > 0 ? h * 0.14 : 0), tTop + h * 0.02, h * 0.14, h * 0.26, 'cloth4', { rx: 0.3, op }) + C(x - dir * tw * 0.9 - (dir > 0 ? h * 0.07 : -h * 0.07), tTop - h * 0.01, h * 0.06, hair, { op });
  if (load === 'bag') s += R(x + dir * tw * 0.55 - (dir > 0 ? 0 : h * 0.12), tTop + tH * 0.45, h * 0.12, h * 0.2, 'clay', { rx: 0.15, op });
  if (load === 'briq') s += R(x + dir * tw * 0.6 - (dir > 0 ? 0 : h * 0.14), tTop + tH * 0.6, h * 0.14, h * 0.16, 'ink', { op });
  if (hk === 'mask') s += R(x + dir * hr * 0.3 - (dir > 0 ? 0 : hr * 0.8), hy + hr * 0.1, hr * 0.8, hr * 0.6, 'cloth3', { op });
  else s += hat(hk, x + dir * h * 0.015, hy, hr, hatTok, dir, { op });
  return s;
};

/** 쪼그려 앉은 사람 — 심볼 하나(+ 머릿수건) */
export const crouch = (x, yBase, h, o = {}) => {
  const { top = 'cloth3', bottom = 'cloth1', hair = 'hair', hat: hk = null, hatTok = 'roof2', op } = o;
  const w = h * 0.62;
  return U('pc', x - w / 2, yBase - h, w, h, cls(top, bottom, hair), { op }) + (hk ? hat(hk, x + w * 0.1, yBase - h * 0.84, h * 0.13, hatTok, 1, { op }) : '');
};
/** 먼 인물(머리 + 어깨 덩이) */
export const far = (x, yBase, h, top = 'cloth3', hair = 'hair', o = {}) => U('pf', x - h * 0.17, yBase - h, h * 0.34, h, cls(top, 'cloth1', hair), { op: o.op });
/** 앉은 사람(옆모습)은 r3 그대로(조각) */
export const sitter = sitter3;
export const shieldLine = shieldLine3;

/** 군중(뒷모습) x0~x1 사이 n명 — o: y jitter tops bottoms hairs arms hats[{hat,hatTok,p}] seed farMode skirts long carry[] */
export const crowd = (x0, x1, n, hMin, hMax, o = {}) => {
  const { y = 24, jitter = 0.8, tops = ['cloth3', 'cloth4', 'hairw', 'cloth1', 'clay', 'far'], bottoms = ['cloth1', 'ink', 'roof2', 'clay'], hairs = ['hair', 'ink', 'roof2'], arms = 0, hats = [], seed = 7, farMode = false, skirts = 0.3, long = 0, carry = [] } = o;
  const list = []; const rnd = seeded(seed);
  for (let i = 0; i < n; i++) {
    const t = (i + rnd() * 0.8) / n; const x = x0 + (x1 - x0) * t; const dy = (rnd() - 0.5) * 2 * jitter; const h = hMin + (hMax - hMin) * rnd();
    const sk = rnd() < skirts;
    const p = { x, y: y + dy, h, top: pick(rnd, tops), bottom: pick(rnd, bottoms), hair: pick(rnd, hairs), arm: rnd() < arms ? (rnd() < 0.5 ? 'upL' : 'upR') : null, skirt: sk, long: sk && rnd() < long, hat: null, hatTok: 'roof2', carry: carry.length && rnd() < 0.3 ? pick(rnd, carry) : null };
    for (const hh of hats) if (rnd() < hh.p) { p.hat = hh.hat; p.hatTok = hh.hatTok || 'roof2'; break; }
    list.push(p);
  }
  list.sort((a, b) => a.y - b.y);
  return list.map((p) => (farMode ? far(p.x, p.y, p.h, p.top, p.hair) : person(p.x, p.y, p.h, p))).join('');
};
/** 줄 선 사람들(옆모습, 한 방향) — o: tops bottoms seed loads hats skirts long */
export const queue = (x0, y, n, h, gap, o = {}, dir = 1) => {
  const { tops = ['cloth3', 'cloth4', 'hairw', 'cloth1', 'clay'], bottoms = ['cloth1', 'ink', 'roof2'], seed = 3, loads = [], hats = [], skirts = 0.35, long = 0, dy = 0 } = o;
  const rnd = seeded(seed);
  return rep(n, (i) => { const hh = h * (0.92 + rnd() * 0.16); const ht = hats.length && rnd() < 0.5 ? pick(rnd, hats) : null; const sk = rnd() < skirts; return walker(x0 + i * gap * dir, y + (i % 2) * dy, hh, { top: pick(rnd, tops), bottom: pick(rnd, bottoms), load: loads.length && rnd() < 0.7 ? pick(rnd, loads) : null, hat: ht && ht.hat, hatTok: ht && ht.hatTok, skirt: sk, long: sk && rnd() < long }, dir); });
};
/** 군인(뒷모습·철모·소총 멘) */
export const soldier = (x, yBase, h, o = {}) => person(x, yBase, h, { top: 'green', bottom: 'green', hat: 'helmet', hatTok: 'roof2', ...o }) + (o.rifle === false ? '' : f.line(`M${q1(x + h * 0.14)},${q1(yBase - h * 0.42)}L${q1(x - h * 0.02)},${q1(yBase - h * 0.98)}`, q1(h * 0.035), 'ink'));
/** 군인 열 — 소총은 한 path */
export const soldierLine = (x0, y, n, h, gap, o = {}) => rep(n, (i) => soldier(x0 + i * gap, y + (i % 2) * 0.15, h, { ...o, rifle: false })) + f.line(rep(n, (i) => { const x = x0 + i * gap; return `M${q1(x + h * 0.14)},${q1(y + (i % 2) * 0.15 - h * 0.42)}L${q1(x - h * 0.02)},${q1(y + (i % 2) * 0.15 - h * 0.98)}`; }), q1(h * 0.035), 'ink');
/** 경찰 열(뒷모습 · 검은 제복 · 정모) — 1960 저지선. 무기 0 */
export const policeLine = (x0, y, n, h, gap) => rep(n, (i) => person(x0 + i * gap, y + (i % 2) * 0.15, h, { top: 'cloth1', bottom: 'cloth1', hat: 'cap', hatTok: 'cloth1' }));

// ---------------------------------------------------------------- 1940~60년대 공용 소품
/** 초가 한 채(앞에서) — 둥근 이엉 지붕 · 흙벽 · 창호문 · 마루. x = 왼쪽, yBase = 바닥, w·h = 벽 폭·높이 */
export const choga = (x, yBase, w, h, o = {}) => {
  const { wall = 'wall', door = true, maru = true } = o;
  const rh = h * 0.62;
  return f.rect(x, yBase - h, w, h, wall) + f.rect(x, yBase - h, w, h * 0.06, 'wood', { op: 0.5 })
    + f.path(`M${r1(x - w * 0.1)},${r1(yBase - h)}Q${r1(x - w * 0.05)},${r1(yBase - h - rh * 0.75)} ${r1(x + w * 0.5)},${r1(yBase - h - rh)}Q${r1(x + w * 1.05)},${r1(yBase - h - rh * 0.75)} ${r1(x + w * 1.1)},${r1(yBase - h)}Z`, 'ground2')
    + f.path(`M${r1(x - w * 0.04)},${r1(yBase - h - rh * 0.12)}Q${r1(x + w * 0.5)},${r1(yBase - h - rh * 0.82)} ${r1(x + w * 1.04)},${r1(yBase - h - rh * 0.12)}Q${r1(x + w * 0.5)},${r1(yBase - h - rh * 0.62)} ${r1(x - w * 0.04)},${r1(yBase - h - rh * 0.12)}Z`, 'ground', { op: 0.55 })
    + f.rect(x - w * 0.1, yBase - h - 0.1, w * 1.2, 0.5, 'wood', { op: 0.6 })
    + (door ? f.rect(x + w * 0.38, yBase - h * 0.82, w * 0.24, h * 0.62, 'cloth3') + f.line(`M${r1(x + w * 0.5)},${r1(yBase - h * 0.82)}V${r1(yBase - h * 0.2)}M${r1(x + w * 0.38)},${r1(yBase - h * 0.6)}H${r1(x + w * 0.62)}M${r1(x + w * 0.38)},${r1(yBase - h * 0.4)}H${r1(x + w * 0.62)}`, 0.14, 'wood') : '')
    + f.rect(x + w * 0.08, yBase - h * 0.78, w * 0.18, h * 0.3, 'cloth3') + f.line(`M${r1(x + w * 0.17)},${r1(yBase - h * 0.78)}V${r1(yBase - h * 0.48)}`, 0.12, 'wood')
    + (maru ? f.rect(x + w * 0.3, yBase - h * 0.2, w * 0.4, h * 0.2, 'wood') + f.rect(x + w * 0.3, yBase - h * 0.2, w * 0.4, 0.25, 'clay', { op: 0.6 }) : '');
};
/** 장독대 — n개 항아리(뒤 큰 것 → 앞 작은 것) */
export const jangdok = (x, yBase, n = 4, s = 1) => rep(n, (i) => { const r = (1.3 - i * 0.12) * s, cx = x + i * r * 1.7; return f.ellipse(cx, yBase - r * 1.1, r, r * 1.1, 'clay') + f.ellipse(cx, yBase - r * 2.1, r * 0.55, r * 0.2, 'ink', { op: 0.7 }); });
/** 돌담 */
export const stoneWall = (x, y, w, h, o = 0.9) => f.rect(x, y, w, h, 'wall2') + f.fill(x, y, w, h, 'era-stones', { op: o }) + f.rect(x, y - 0.3, w, 0.4, 'ground2');
/** 싸리·나무 울타리 */
export const fence = (x, y, w, h = 1.6) => f.line(rep(Math.round(w / 0.7), (i) => `M${r1(x + i * 0.7)},${r1(y)}v${r1(-h)}`), 0.18, 'wood') + f.line(`M${r1(x)},${r1(y - h * 0.55)}H${r1(x + w)}`, 0.2, 'wood');
/** 먼 산(두 겹) */
export const hills = (y, tok = 'far', tok2 = 'far2') => f.path(`M0,${y} L6,${y - 4.5} L11,${y - 2} L17,${y - 6} L23,${y - 3} L29,${y - 5.5} L35,${y - 2.5} L40,${y - 4} L40,${y + 3} L0,${y + 3} Z`, tok) + f.path(`M0,${y + 1.5} L8,${y - 1} L14,${y + 1} L22,${y - 2} L30,${y} L40,${y - 1.5} L40,${y + 3} L0,${y + 3} Z`, tok2);
/** 먼 초가 지붕들(마을) */
export const farChogas = (y, n = 5, x0 = 1, gap = 8) => rep(n, (i) => { const x = x0 + i * gap + (i % 2) * 1.5; return f.path(`M${x},${y}Q${x + 2.6},${y - 2.6} ${x + 5.2},${y}Z`, 'ground2') + f.rect(x + 0.6, y, 4, 1.6, 'wall2'); });
/** 나무(겨울 — 가지만) */
export const bareTree = (x, yBase, h) => f.line(`M${x},${yBase}V${r1(yBase - h * 0.55)}l${r1(-h * 0.2)},${r1(-h * 0.25)}M${x},${r1(yBase - h * 0.5)}l${r1(h * 0.22)},${r1(-h * 0.3)}M${x},${r1(yBase - h * 0.55)}v${r1(-h * 0.3)}l${r1(-h * 0.08)},${r1(-h * 0.12)}`, h * 0.05, 'wood');
/** 감나무(가을 — 잎 적고 열매) */
export const persimmon = (x, yBase, h) => bareTree(x, yBase, h) + rep(7, (i) => f.circle(x + ((i * 1.7) % 4) - 2 + (i % 2) * 0.4, yBase - h * 0.6 - (i * 1.1) % 3.2, 0.32, 'clay'));
