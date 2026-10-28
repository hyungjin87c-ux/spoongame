/**
 * SPEC-009 「시대의 창」 r3 — 사람·군중·연기·차량 도우미 (designer 2026-10-28, r3 — FT3 r4 「가감 없이, 현실적으로」).
 * r2 도우미(`eraR2Lib.mjs` — 평면 조각 f·공유 패턴·톤)를 그대로 쓰고, 현장 묘사에 필요한 것만 더한다.
 * 사람은 **얼굴 없는 뒷모습·옆모습·먼 인물**만 — 머리는 머리카락(또는 모자·철모) 한 덩이, 눈·코·입 0. 실존 인물을 닮게 그리지 않는다.
 * 색은 `--c-scene-*` 24 토큰만: 군복은 green, 철모는 roof2, 구조대 조끼·헬멧은 cloth2, 태극은 clay+cloth1(일반형 비례, 괘는 ink 막대).
 */
import { f, rep, TONE, ERA_DEFS, T } from "./eraR2Lib.mjs";
export * from './eraR2Lib.mjs';

const r1 = (n) => Math.round(n * 100) / 100;
/** 결정적 난수(장면마다 같은 그림) */
export const seeded = (seed) => { let s = (seed * 9301 + 49297) % 233280; return () => { s = (s * 9301 + 49297) % 233280; return s / 233280; }; };
export const pick = (rnd, arr) => arr[Math.floor(rnd() * arr.length) % arr.length];

/** 한 자리 반올림(사람 조각은 바이트를 아낀다) */
const q1 = (n) => Math.round(n * 10) / 10;
const R = (x, y, w, h, tok, o) => f.rect(q1(x), q1(y), q1(w), q1(h), tok, o);
const C = (cx, cy, r, tok, o) => f.circle(q1(cx), q1(cy), q1(r), tok, o);
const cap = (x, hy, hr, tok, k = 1.15, o) => f.path(`M${q1(x - hr * k)},${q1(hy + hr * 0.15)}a${q1(hr * k)},${q1(hr * k)} 0 0 1 ${q1(hr * k * 2)},0z`, tok, o);

/**
 * 뒷모습 사람(서 있음) — 조각 4(머리·몸통·다리 둘) + 선택(든 팔 · 모자 · 짐). x = 가운데, yBase = 발바닥, h = 키. 얼굴 0.
 * o: top bottom hair hat('helmet'|'cap'|'scarf'|'band'|'hardhat') hatTok arm('upL'|'upR'|'up'|null) skirt coat bag carry('box'|'bundle'|'paper'|'bucket'|'flag'|'sign')
 */
export const person = (x, yBase, h, o = {}) => {
  const { top = 'cloth3', bottom = 'cloth1', hair = 'hair', hat = null, hatTok = 'roof2', arm = null, skirt = false, coat = false, bag = null, carry = null, op } = o;
  const hr = h * 0.105, hy = yBase - h + hr, tw = h * 0.3, tTop = yBase - h * 0.77, tH = coat ? h * 0.54 : h * 0.4, lw = h * 0.11, lTop = yBase - h * 0.4;
  let s = '';
  if (skirt) s += f.poly([[q1(x - tw * 0.5), q1(lTop)], [q1(x + tw * 0.5), q1(lTop)], [q1(x + tw * 0.62), q1(yBase - h * 0.12)], [q1(x - tw * 0.62), q1(yBase - h * 0.12)]], bottom, { op }) + R(x - lw * 1.1, yBase - h * 0.12, lw * 0.8, h * 0.12, 'skin', { op }) + R(x + lw * 0.3, yBase - h * 0.12, lw * 0.8, h * 0.12, 'skin', { op });
  else s += R(x - lw * 1.15, lTop, lw, h * 0.4, bottom, { op }) + R(x + lw * 0.15, lTop, lw, h * 0.4, bottom, { op });
  s += R(x - tw / 2, tTop, tw, tH, top, { rx: q1(h * 0.05), op });
  const aw = h * 0.085, aL = h * 0.36;
  if (arm === 'upL' || arm === 'up') s += R(x - tw / 2 - aw * 0.3, tTop - aL + h * 0.04, aw, aL, top, { rx: q1(aw / 2), tr: `rotate(14 ${q1(x - tw / 2)} ${q1(tTop + h * 0.04)})`, op });
  if (arm === 'upR' || arm === 'up') s += R(x + tw / 2 - aw * 0.7, tTop - aL + h * 0.04, aw, aL, top, { rx: q1(aw / 2), tr: `rotate(-14 ${q1(x + tw / 2)} ${q1(tTop + h * 0.04)})`, op });
  if (bag) s += R(x + tw * 0.1, tTop + tH * 0.55, tw * 0.5, tH * 0.55, bag, { rx: 0.2, op });
  if (carry === 'box') s += R(x + tw / 2, tTop + aL * 0.6, h * 0.22, h * 0.16, 'clay', { op });
  if (carry === 'bundle') s += f.ellipse(q1(x), q1(yBase - h - hr * 0.3), q1(h * 0.26), q1(h * 0.13), 'cloth3', { op });
  if (carry === 'paper') s += R(x - tw * 0.42, tTop + h * 0.08, tw * 0.84, h * 0.2, 'cloth3', { op });
  if (carry === 'bucket') s += R(x + tw / 2 + aw * 0.2, tTop + aL * 0.75, h * 0.17, h * 0.17, 'hairw', { op });
  if (carry === 'flag') s += f.line(`M${q1(x + tw / 2 + aw * 0.3)},${q1(tTop + h * 0.1)}V${q1(tTop - h * 0.62)}`, q1(h * 0.03), 'wood', { op }) + taegeuk(q1(x + tw / 2 + aw * 0.3), q1(tTop - h * 0.62), q1(h * 0.3), { op });
  if (carry === 'sign') s += R(x - tw * 0.5, tTop - h * 0.34, tw, h * 0.22, 'cloth3', { op }) + R(x - h * 0.015, tTop - h * 0.12, h * 0.03, h * 0.14, 'wood', { op });
  s += C(x, hy, hr, hair, { op });
  if (hat === 'helmet') s += cap(x, hy, hr, hatTok, 1.15, { op });
  if (hat === 'hardhat') s += cap(x, hy, hr, hatTok, 1.1, { op }) + R(x - hr * 1.3, hy + hr * 0.05, hr * 2.6, hr * 0.22, hatTok, { op });
  if (hat === 'cap') s += cap(x, hy - hr * 0.25, hr, hatTok, 1, { op });
  if (hat === 'scarf') s += f.path(`M${q1(x - hr * 1.05)},${q1(hy + hr * 0.4)}a${q1(hr * 1.05)},${q1(hr * 1.05)} 0 0 1 ${q1(hr * 2.1)},0l${q1(-hr * 0.65)},${q1(hr * 0.9)}h${q1(-hr * 0.8)}z`, hatTok, { op });
  if (hat === 'band') s += R(x - hr * 1.02, hy - hr * 0.25, hr * 2.04, hr * 0.38, hatTok, { op });
  return s;
};

/** 옆모습으로 걷는 사람(dir 1 = 오른쪽으로) — 조각 4(머리·몸통·다리 둘) + 선택(짐·모자). 얼굴 0. */
export const walker = (x, yBase, h, o = {}, dir = 1, stride = 0.6) => {
  const { top = 'cloth3', bottom = 'cloth1', hair = 'hair', hat = null, hatTok = 'roof2', skirt = false, load = null, op } = o;
  const hr = h * 0.105, hy = yBase - h + hr, tw = h * 0.22, tTop = yBase - h * 0.77, tH = h * 0.4, lTop = yBase - h * 0.4, st = h * 0.14 * stride * dir;
  let s = f.poly([[q1(x - tw * 0.3), q1(lTop)], [q1(x + tw * 0.3), q1(lTop)], [q1(x + st + tw * 0.25), q1(yBase)], [q1(x + st - tw * 0.3), q1(yBase)]], bottom, { op });
  s += f.poly([[q1(x - tw * 0.3), q1(lTop)], [q1(x + tw * 0.3), q1(lTop)], [q1(x - st + tw * 0.3), q1(yBase)], [q1(x - st - tw * 0.25), q1(yBase)]], bottom, { op: (op || 1) * 0.8 });
  if (skirt) s += f.poly([[q1(x - tw * 0.55), q1(lTop)], [q1(x + tw * 0.55), q1(lTop)], [q1(x + tw * 0.75), q1(yBase - h * 0.14)], [q1(x - tw * 0.75), q1(yBase - h * 0.14)]], bottom, { op });
  s += R(x - tw / 2, tTop, tw, tH, top, { rx: q1(h * 0.04), op });
  if (load === 'jige') s += R(x - dir * tw * 0.9 - (dir > 0 ? h * 0.1 : 0), tTop - h * 0.1, h * 0.1, h * 0.55, 'wood', { op }) + R(x - dir * tw * 1.1 - (dir > 0 ? h * 0.24 : 0), tTop - h * 0.26, h * 0.3, h * 0.42, 'cloth3', { rx: 0.2, op });
  if (load === 'bundle') s += f.ellipse(q1(x), q1(yBase - h - hr * 0.35), q1(h * 0.24), q1(h * 0.12), 'cloth3', { op });
  if (load === 'baby') s += R(x - dir * tw * 0.95 - (dir > 0 ? h * 0.14 : 0), tTop + h * 0.02, h * 0.14, h * 0.26, 'cloth4', { rx: 0.3, op }) + C(x - dir * tw * 0.9 - (dir > 0 ? h * 0.07 : -h * 0.07), tTop - h * 0.01, h * 0.06, hair, { op });
  if (load === 'bag') s += R(x + dir * tw * 0.55 - (dir > 0 ? 0 : h * 0.12), tTop + tH * 0.45, h * 0.12, h * 0.2, 'clay', { rx: 0.15, op });
  if (load === 'briq') s += R(x + dir * tw * 0.6 - (dir > 0 ? 0 : h * 0.14), tTop + tH * 0.6, h * 0.14, h * 0.16, 'ink', { op });
  s += C(x + dir * h * 0.015, hy, hr, hair, { op });
  if (hat === 'helmet') s += cap(x, hy, hr, hatTok, 1.15, { op });
  if (hat === 'scarf') s += f.path(`M${q1(x - hr * 1.05)},${q1(hy + hr * 0.4)}a${q1(hr * 1.05)},${q1(hr * 1.05)} 0 0 1 ${q1(hr * 2.1)},0l${q1(-hr * 1.05 - dir * hr * 0.9)},${q1(hr)}z`, hatTok, { op });
  if (hat === 'cap') s += cap(x, hy - hr * 0.25, hr, hatTok, 1, { op }) + R(x + dir * hr * 0.6 - (dir > 0 ? 0 : hr * 0.9), hy - hr * 0.2, hr * 0.9, hr * 0.22, hatTok, { op });
  if (hat === 'mask') s += R(x + dir * hr * 0.3 - (dir > 0 ? 0 : hr * 0.8), hy + hr * 0.1, hr * 0.8, hr * 0.6, 'cloth3', { op });
  return s;
};

/** 쪼그려 앉은 사람 — 조각 3(엉덩이·등·머리) + 선택(머릿수건) */
export const crouch = (x, yBase, h, o = {}) => {
  const { top = 'cloth3', bottom = 'cloth1', hair = 'hair', hat = null, hatTok = 'roof2', op } = o;
  const w = h * 0.62;
  let s = R(x - w * 0.45, yBase - h * 0.22, w * 0.9, h * 0.22, bottom, { rx: q1(h * 0.06), op });
  s += f.path(`M${q1(x - w / 2)},${q1(yBase - h * 0.2)}Q${q1(x - w / 2)},${q1(yBase - h * 0.78)} ${q1(x)},${q1(yBase - h * 0.8)}Q${q1(x + w / 2)},${q1(yBase - h * 0.78)} ${q1(x + w / 2)},${q1(yBase - h * 0.2)}z`, top, { op });
  s += C(x + w * 0.1, yBase - h * 0.84, h * 0.13, hair, { op });
  if (hat === 'scarf') s += cap(x + w * 0.1, yBase - h * 0.84, h * 0.13, hatTok, 1.05, { op });
  return s;
};

/** 앉은 사람(옆모습, dir 쪽을 봄) — 벤치·바닥. yBase = 발바닥, seat = 앉은 면 높이 */
export const sitter = (x, yBase, h, o = {}, dir = 1, seat = h * 0.42) => {
  const { top = 'cloth3', bottom = 'cloth1', hair = 'hair', op, book = false } = o;
  const hr = h * 0.105, tw = h * 0.24, hipY = yBase - seat;
  let s = f.rect(x - tw * 0.5, hipY - h * 0.02, tw * 0.5 + dir * 0 + h * 0.3, h * 0.12, bottom, { rx: 0.15, tr: dir > 0 ? '' : `translate(${q1(-h * 0.3 + tw * 0.5)} 0)`, op });
  s += f.rect(x + dir * h * 0.26 - h * 0.05, hipY + h * 0.08, h * 0.1, seat - h * 0.08, bottom, { op }) + f.rect(x + dir * h * 0.26 - h * 0.09, yBase - 0.1, h * 0.2, 0.22, 'ink', { op });
  s += f.rect(x - tw / 2, hipY - h * 0.42, tw, h * 0.44, top, { rx: h * 0.04, tr: `rotate(${8 * dir} ${q1(x)} ${q1(hipY)})`, op });
  s += f.rect(x + dir * tw * 0.3 - h * 0.035, hipY - h * 0.34, h * 0.07, h * 0.26, top, { rx: h * 0.035, tr: `rotate(${-55 * dir} ${q1(x + dir * tw * 0.3)} ${q1(hipY - h * 0.34)})`, op });
  if (book) s += f.rect(x + dir * h * 0.16 - h * 0.1, hipY - h * 0.24, h * 0.2, h * 0.14, 'cloth3', { tr: `rotate(${-20 * dir} ${q1(x + dir * h * 0.16)} ${q1(hipY - h * 0.17)})`, op });
  s += f.circle(x + dir * h * 0.06, hipY - h * 0.44 - hr * 0.7, hr, hair, { op });
  return s;
};
/** 소(옆, dir 쪽을 봄) — 달구지용 */
export const ox = (x, yBase, h, dir = 1) => f.rect(x - h * 0.55, yBase - h * 0.78, h * 1.1, h * 0.46, 'clay', { rx: h * 0.18 }) + rep(4, (i) => f.rect(x - h * 0.45 + i * h * 0.27, yBase - h * 0.36, h * 0.1, h * 0.36, 'clay')) + f.rect(x + dir * h * 0.6 - h * 0.14, yBase - h * 0.92, h * 0.28, h * 0.34, 'clay', { rx: h * 0.06 }) + f.line(`M${r1(x + dir * h * 0.56)},${r1(yBase - h * 0.94)} l${r1(dir * h * 0.08)},${r1(-h * 0.12)} M${r1(x + dir * h * 0.66)},${r1(yBase - h * 0.94)} l${r1(dir * h * 0.08)},${r1(-h * 0.12)}`, h * 0.04, 'ink');
/** 자전거(옆, 세워 둠) */
export const bicycle = (x, yBase, w = 3) => f.circle(x, yBase - w * 0.25, w * 0.25, 'ink') + f.circle(x, yBase - w * 0.25, w * 0.17, 'sky') + f.circle(x + w * 0.7, yBase - w * 0.25, w * 0.25, 'ink') + f.circle(x + w * 0.7, yBase - w * 0.25, w * 0.17, 'sky') + f.line(`M${r1(x)},${r1(yBase - w * 0.25)} L${r1(x + w * 0.3)},${r1(yBase - w * 0.62)} L${r1(x + w * 0.7)},${r1(yBase - w * 0.25)} M${r1(x + w * 0.3)},${r1(yBase - w * 0.62)} L${r1(x + w * 0.58)},${r1(yBase - w * 0.66)} M${r1(x + w * 0.35)},${r1(yBase - w * 0.25)} L${r1(x + w * 0.3)},${r1(yBase - w * 0.62)}`, w * 0.05, 'ink') + f.rect(x + w * 0.22, yBase - w * 0.7, w * 0.16, w * 0.06, 'ink');
/** 먼 인물(머리 점 + 어깨 덩이) — 군중 안쪽·먼 거리 */
export const far = (x, yBase, h, top = 'cloth3', hair = 'hair', o = {}) => R(x - h * 0.17, yBase - h * 0.72, h * 0.34, h * 0.72, top, { rx: q1(h * 0.1), op: o.op }) + C(x, yBase - h * 0.85, h * 0.13, hair, { op: o.op });

/**
 * 군중(뒷모습) — x0~x1 사이 n명, 키 hMin~hMax, 색은 tops/bottoms에서, 멀수록 먼저 그린다(뒤 → 앞).
 * o.y = yBase, o.jitter = 앞뒤 흔들림, o.arms = 팔 든 비율, o.hats = [{hat, hatTok, p}], o.far = true면 먼 인물 모양
 */
export const crowd = (x0, x1, n, hMin, hMax, o = {}) => {
  const { y = 24, jitter = 0.8, tops = ['cloth3', 'cloth4', 'hairw', 'cloth1', 'clay', 'far'], bottoms = ['cloth1', 'ink', 'roof2', 'clay'], hairs = ['hair', 'ink', 'roof2'], arms = 0, hats = [], seed = 7, farMode = false, skirts = 0.3, carry = [] } = o;
  const list = [];
  const r2 = seeded(seed);
  for (let i = 0; i < n; i++) {
    const t = (i + r2() * 0.8) / n;
    const x = x0 + (x1 - x0) * t;
    const dy = (r2() - 0.5) * 2 * jitter;
    const h = hMin + (hMax - hMin) * r2();
    const p = { x, y: y + dy, h, top: pick(r2, tops), bottom: pick(r2, bottoms), hair: pick(r2, hairs), arm: r2() < arms ? (r2() < 0.5 ? 'upL' : 'upR') : null, skirt: r2() < skirts, hat: null, hatTok: 'roof2', carry: carry.length && r2() < 0.3 ? pick(r2, carry) : null };
    for (const hh of hats) if (r2() < hh.p) { p.hat = hh.hat; p.hatTok = hh.hatTok || 'roof2'; break; }
    list.push(p);
  }
  list.sort((a, b) => a.y - b.y);
  return list.map((p) => (farMode ? far(p.x, p.y, p.h, p.top, p.hair) : person(p.x, p.y, p.h, p))).join('');
};

/** 줄 선 사람들(옆모습, 한 방향) — 간격 gap, 뒤 → 앞 */
export const queue = (x0, y, n, h, gap, o = {}, dir = 1) => {
  const { tops = ['cloth3', 'cloth4', 'hairw', 'cloth1', 'clay'], bottoms = ['cloth1', 'ink', 'roof2'], seed = 3, loads = [], hats = [] } = o;
  const rnd = seeded(seed);
  return rep(n, (i) => { const hh = h * (0.92 + rnd() * 0.16); const hat = hats.length && rnd() < 0.5 ? pick(rnd, hats) : null; return walker(x0 + i * gap * dir, y, hh, { top: pick(rnd, tops), bottom: pick(rnd, bottoms), load: loads.length && rnd() < 0.7 ? pick(rnd, loads) : null, hat: hat && hat.hat, hatTok: hat && hat.hatTok, skirt: rnd() < 0.35 }, dir, 0.15 + rnd() * 0.5); });
};

/** 군인(뒷모습·철모·소총 멘 줄) */
export const soldier = (x, yBase, h, o = {}) => person(x, yBase, h, { top: 'green', bottom: 'green', hat: 'helmet', hatTok: 'roof2', shoes: 'ink', ...o }) + (o.rifle === false ? '' : f.line(`M${q1(x + h * 0.14)},${q1(yBase - h * 0.42)}L${q1(x - h * 0.02)},${q1(yBase - h * 0.98)}`, q1(h * 0.035), 'ink'));
/** 군인 열(뒷모습, 철모) — 소총은 한 path로 묶는다(조각 n×5 + 1) */
export const soldierLine = (x0, y, n, h, gap, o = {}) => rep(n, (i) => soldier(x0 + i * gap, y + (i % 2) * 0.15, h, { ...o, rifle: false })) + f.line(rep(n, (i) => { const x = x0 + i * gap; return `M${q1(x + h * 0.14)},${q1(y + (i % 2) * 0.15 - h * 0.42)}L${q1(x - h * 0.02)},${q1(y + (i % 2) * 0.15 - h * 0.98)}`; }), q1(h * 0.035), 'ink');
/** 전경 방패 열(방패 사각 + 철모 머리만 — 뒤에서 본 줄) */
export const shieldLine = (x0, y, n, w, h, gap = 0.15) => rep(n, (i) => { const x = x0 + i * (w + gap); return f.circle(x + w / 2, y - h - 0.35, 0.42, 'roof2') + f.rect(x, y - h, w, h, 'far', { rx: 0.15, op: 0.85 }); });
/** 장갑차(옆, 왼쪽을 봄) — 쐐기 몸체·바퀴·포탑 */
export const apc = (x, yBase, w = 9, tok = 'green', dark = 'roof2') => {
  const h = w * 0.36;
  return f.poly([[x + w * 0.08, yBase - h * 0.35], [x + w * 0.22, yBase - h], [x + w * 0.9, yBase - h], [x + w, yBase - h * 0.55], [x + w, yBase - h * 0.3], [x + w * 0.06, yBase - h * 0.3]], tok)
    + f.rect(x + w * 0.38, yBase - h * 1.28, w * 0.26, h * 0.3, tok, { rx: 0.2 }) + f.line(`M${r1(x + w * 0.4)},${r1(yBase - h * 1.16)} L${r1(x + w * 0.02)},${r1(yBase - h * 1.26)}`, h * 0.1, dark)
    + f.rect(x + w * 0.02, yBase - h * 0.38, w * 0.98, h * 0.18, dark, { rx: 0.2 }) + rep(4, (i) => f.circle(x + w * 0.16 + i * w * 0.22, yBase - h * 0.2, h * 0.22, 'ink') + f.circle(x + w * 0.16 + i * w * 0.22, yBase - h * 0.2, h * 0.09, 'far'))
    + f.rect(x + w * 0.26, yBase - h * 0.9, w * 0.07, h * 0.12, 'ink') + f.rect(x + w * 0.74, yBase - h * 0.9, w * 0.07, h * 0.12, 'ink');
};
/** 트럭(옆) — 운전석 + 짐칸 */
export const truck = (x, yBase, w = 10, cab = 'cloth4', bed = 'roof2', dir = 1) => {
  const h = w * 0.34;
  const cabX = dir > 0 ? x + w * 0.72 : x, bedX = dir > 0 ? x : x + w * 0.3;
  return f.rect(bedX, yBase - h * 0.95, w * 0.7, h * 0.65, bed) + f.rect(bedX, yBase - h * 0.95, w * 0.7, h * 0.08, 'ink', { op: 0.5 })
    + f.rect(cabX, yBase - h * 1.05, w * 0.28, h * 0.75, cab, { rx: 0.3 }) + f.rect(cabX + (dir > 0 ? w * 0.12 : w * 0.03), yBase - h * 0.98, w * 0.13, h * 0.3, 'glass')
    + f.rect(x, yBase - h * 0.34, w, h * 0.12, 'ink') + f.circle(x + w * 0.16, yBase - h * 0.2, h * 0.22, 'ink') + f.circle(x + w * 0.16, yBase - h * 0.2, h * 0.08, 'far') + f.circle(x + w * 0.84, yBase - h * 0.2, h * 0.22, 'ink') + f.circle(x + w * 0.84, yBase - h * 0.2, h * 0.08, 'far');
};
/** 리어카(옆, 왼쪽으로 끎) */
export const cart = (x, yBase, w = 6) => f.rect(x, yBase - w * 0.42, w, w * 0.3, 'wood') + f.rect(x + 0.1, yBase - w * 0.42, w - 0.2, 0.3, 'roof2', { op: 0.5 }) + f.line(`M${r1(x)},${r1(yBase - w * 0.3)} L${r1(x - w * 0.45)},${r1(yBase - w * 0.36)}`, 0.3, 'wood') + f.circle(x + w * 0.5, yBase - w * 0.18, w * 0.18, 'ink') + f.circle(x + w * 0.5, yBase - w * 0.18, w * 0.07, 'hairw');

/** 큰 연기·먼지 구름(네 덩이) — 최루탄(cloth3)·화재(ink·roof2)·먼지(ground2) */
export const cloud = (x, y, r, tok = 'cloth3', o = 0.6) => f.ellipse(x, y, r * 1.35, r * 0.8, tok, { op: o }) + f.ellipse(x - r * 0.8, y + r * 0.2, r * 0.9, r * 0.6, tok, { op: o * 0.9 }) + f.ellipse(x + r * 0.75, y - r * 0.15, r, r * 0.7, tok, { op: o * 0.9 }) + f.ellipse(x + r * 0.1, y - r * 0.55, r * 0.8, r * 0.55, tok, { op: o * 0.8 });
/** 연기 기둥(아래 좁고 위로 퍼짐, 오른쪽으로 기움) */
export const plume = (x, yBase, h, tok = 'roof2', o = 0.55) => rep(5, (i) => f.ellipse(x + i * h * 0.1 + (i * i) * h * 0.02, yBase - i * h * 0.21, h * (0.1 + i * 0.07), h * (0.07 + i * 0.045), tok, { op: o - i * 0.06 }));
/** 불길(세 겹) */
export const flame = (x, yBase, h, w = h * 0.7) => f.path(`M${r1(x)},${r1(yBase - h)} Q${r1(x + w * 0.7)},${r1(yBase - h * 0.5)} ${r1(x + w * 0.45)},${r1(yBase)} L${r1(x - w * 0.45)},${r1(yBase)} Q${r1(x - w * 0.7)},${r1(yBase - h * 0.5)} ${r1(x)},${r1(yBase - h)} Z`, 'clay') + f.path(`M${r1(x + w * 0.05)},${r1(yBase - h * 0.7)} Q${r1(x + w * 0.42)},${r1(yBase - h * 0.35)} ${r1(x + w * 0.28)},${r1(yBase)} L${r1(x - w * 0.28)},${r1(yBase)} Q${r1(x - w * 0.42)},${r1(yBase - h * 0.35)} ${r1(x + w * 0.05)},${r1(yBase - h * 0.7)} Z`, 'cloth2') + f.path(`M${r1(x)},${r1(yBase - h * 0.38)} Q${r1(x + w * 0.2)},${r1(yBase - h * 0.2)} ${r1(x + w * 0.13)},${r1(yBase)} L${r1(x - w * 0.13)},${r1(yBase)} Q${r1(x - w * 0.2)},${r1(yBase - h * 0.2)} ${r1(x)},${r1(yBase - h * 0.38)} Z`, 'glass');
/** 태극기(일반형 비례 — 흰 바탕·태극 두 색·괘는 막대 넷, 글자 없음) */
export const taegeuk = (x, y, w, o = {}) => { const h = w * 0.67, r = h * 0.25, cx = x + w / 2, cy = y + h / 2; return f.rect(x, y, w, h, 'cloth3', { op: o.op }) + f.path(`M${r1(cx - r)},${r1(cy)}a${r1(r)},${r1(r)} 0 0 1 ${r1(r * 2)},0z`, 'clay', { op: o.op }) + f.path(`M${r1(cx - r)},${r1(cy)}a${r1(r)},${r1(r)} 0 0 0 ${r1(r * 2)},0z`, 'cloth1', { op: o.op }) + (w < 2.4 ? '' : f.rect(x + w * 0.08, y + h * 0.14, w * 0.14, h * 0.07, 'ink', { op: o.op }) + f.rect(x + w * 0.78, y + h * 0.14, w * 0.14, h * 0.07, 'ink', { op: o.op }) + f.rect(x + w * 0.08, y + h * 0.78, w * 0.14, h * 0.07, 'ink', { op: o.op }) + f.rect(x + w * 0.78, y + h * 0.78, w * 0.14, h * 0.07, 'ink', { op: o.op })); };
/** 건물(창 패턴) */
export const building = (x, y, w, h, tok = 'far', winOp = 0.6) => f.rect(x, y, w, h, tok) + f.fill(x + 0.4, y + 0.6, w - 0.8, h - 1, 'era-windows', { op: winOp });
/** 셔터 내린 상가 줄 */
export const shops = (x, y, n, w, h, toks = ['cloth4', 'clay', 'cloth1', 'green']) => rep(n, (i) => f.rect(x + i * (w + 0.5), y, w, h * 0.2, toks[i % toks.length]) + f.rect(x + i * (w + 0.5), y + h * 0.22, w, h * 0.78, 'far2') + f.fill(x + i * (w + 0.5), y + h * 0.22, w, h * 0.78, 'era-shutter'));
/** 날리는 종이 */
export const papers = (seed, n, x0, x1, y0, y1, size = 1.2) => { const rnd = seeded(seed); return rep(n, () => { const x = x0 + rnd() * (x1 - x0), y = y0 + rnd() * (y1 - y0), a = rnd() * 60 - 30, s = size * (0.6 + rnd() * 0.6); return f.rect(x, y, s, s * 0.7, 'cloth3', { tr: `rotate(${r1(a)} ${r1(x)} ${r1(y)})`, op: 0.9 }); }); };
/** 발자국(눈·흙) */
export const footprints = (seed, n, x0, x1, y0, y1) => { const rnd = seeded(seed); return rep(n, () => f.ellipse(x0 + rnd() * (x1 - x0), y0 + rnd() * (y1 - y0), 0.32, 0.16, 'shade', { op: 0.45 })); };
/** 가로등(켜짐) */
export const lamp = (x, yBase, h, lit = true) => f.rect(x - 0.2, yBase - h, 0.4, h, 'roof2') + f.rect(x - 0.9, yBase - h - 0.4, 1.8, 0.5, 'roof2') + (lit ? f.circle(x, yBase - h - 0.9, 0.6, 'glass') + f.circle(x, yBase - h - 0.9, 1.6, 'glass', { op: 0.18 }) : f.circle(x, yBase - h - 0.9, 0.6, 'far'));

/** r3 공유 패턴 — 먼 군중 띠(얼굴 없는 뒷모습 다섯이 한 타일, 키가 조금씩 다르다). 덩어리에 한 번만 */
export const ERA_DEFS_R3 = ERA_DEFS + `<pattern id="era-mass" width="4" height="2.2" patternUnits="userSpaceOnUse"><rect x=".1" y=".7" width=".7" height="1.5" rx=".2" fill="${T('cloth3')}"/><circle cx=".45" cy=".5" r=".3" fill="${T('hair')}"/><rect x="1" y=".9" width=".7" height="1.3" rx=".2" fill="${T('cloth4')}"/><circle cx="1.35" cy=".7" r=".3" fill="${T('ink')}"/><rect x="1.9" y=".6" width=".7" height="1.6" rx=".2" fill="${T('hairw')}"/><circle cx="2.25" cy=".4" r=".3" fill="${T('hair')}"/><rect x="2.8" y="1" width=".7" height="1.2" rx=".2" fill="${T('clay')}"/><circle cx="3.15" cy=".8" r=".3" fill="${T('hair')}"/><rect x="3.5" y=".8" width=".6" height="1.4" rx=".2" fill="${T('cloth3')}"/><circle cx="3.8" cy=".6" r=".28" fill="${T('ink')}"/></pattern>`;
/** 먼 군중 띠 — 패턴으로 한 번에(위쪽 가장자리는 들쭉날쭉하게 두 겹) */
export const mass = (x, y, w, h, o = 1) => f.fill(x, y, w, h, 'era-mass', { op: o }) + f.fill(x + 2, y + 1.1, w - 2, h - 1.1, 'era-mass', { op: o });
/** 톤 A 「바랜 인쇄물」만 CSS로(r3 — 형진 님 결정으로 B는 뺀다). 다크는 약하게 */
export const toneCssA = (sel = '.ew') => Object.keys(TONE.a.filter).map((d) => `${sel} [data-dec="${d}"] svg{filter:${TONE.a.filter[d]}}\n:root[data-theme="dark"] ${sel} [data-dec="${d}"] svg{filter:${TONE.a.dark[d]}}`).join('\n');
