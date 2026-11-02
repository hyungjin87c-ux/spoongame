/**
 * SPEC-009 「시대의 창」 r5b — 무거운 장면을 「그 자리에 서 있는 느낌」으로 다시 그리기 위한 소품 (designer 2026-11-02, 형진 님 답 「현장까지 생생하게」).
 * r5 도우미(`eraR5Lib.mjs`)를 그대로 쓰고, 거리를 당긴 장면에 필요한 것만 더한다:
 *   파도·너울, 끊긴 상판의 철근, 흩어진 짙은 연기 덩이, 공기통 멘 소방관, 땅에 깔린 호스, 어깨 위의 아이, 입김, 경광등 빛,
 *   스마트폰(앱 격자 — 로고 0), 옥상 망루, 차량 크레인과 매달린 컨테이너, 물대포 차와 물줄기, 전경 열(먼 인물), 잔해 더미, 경광등 막대.
 * 색은 `--c-scene-*` 24 토큰만(새 토큰 0). 글자·로고·번호 0. 사람은 r4 심볼(뒷모습·옆모습·먼 인물, 얼굴 0)만 — 새 심볼 0.
 * 유지선(FT3 r4)은 도우미 수준에서도 지킨다: 불길 속 사람·넘어진 사람·시신·피를 그리는 도우미는 없다.
 */
import { f, rep, person, walker, far, seeded, pick } from './eraR5Lib.mjs';
export * from './eraR5Lib.mjs';

const r1 = (n) => Math.round(n * 100) / 100;

// ---------------------------------------------------------------- 물
/** 흩어진 흰 물마루(짧은 호 여럿, 결정적 난수) */
export const waves = (x0, x1, y0, y1, n, seed, tok = 'cloth3', op = 0.45, w = 0.18) => { const rnd = seeded(seed); return f.line(rep(n, () => { const x = x0 + rnd() * (x1 - x0), y = y0 + rnd() * (y1 - y0), l = 1.4 + rnd() * 2.6; return `M${r1(x)},${r1(y)} q${r1(l * 0.3)},-0.3 ${r1(l)},0`; }), w, tok, { op }); };
/** 큰 너울(물마루 덩이 — 앞바다에서) */
export const swell = (x, y, w, tok = 'cloth4', crest = 'cloth3', op = 0.9) => f.path(`M${r1(x)},${r1(y)} q${r1(w * 0.25)},${r1(-w * 0.1)} ${r1(w * 0.5)},0 q${r1(w * 0.25)},${r1(w * 0.07)} ${r1(w * 0.5)},0 V${r1(y + w * 0.3)} H${r1(x)}Z`, tok, { op }) + f.path(`M${r1(x + w * 0.28)},${r1(y - w * 0.015)} q${r1(w * 0.11)},${r1(-w * 0.07)} ${r1(w * 0.26)},0 q${r1(-w * 0.1)},${r1(w * 0.04)} ${r1(-w * 0.26)},0Z`, crest, { op: 0.85 });
/** 물보라 띠 */
export const spray = (x, y, w, op = 0.45) => f.ellipse(x, y, w / 2, w * 0.07, 'cloth3', { op }) + f.ellipse(x + w * 0.2, y - w * 0.04, w * 0.25, w * 0.05, 'cloth3', { op: op * 0.8 });

// ---------------------------------------------------------------- 잔해 · 연기 · 불
/** 끊긴 상판·기둥에서 늘어진 철근(가는 선 n개) */
export const rebar = (x, y, n, len, dir = 1, gap = 0.5) => f.line(rep(n, (i) => `M${r1(x + i * gap)},${r1(y)} q${r1(dir * 0.35)},${r1(len * 0.5)} ${r1(dir * 0.1)},${r1(len * (0.7 + (i % 2) * 0.3))}`), 0.14, 'ink');
/** 흩어진 짙은 연기 덩이(seed) — 기둥보다 자유롭게 하늘을 메운다 */
export const smokeMass = (x, y, w, h, n, seed, tok = 'ink', op = 0.6) => { const rnd = seeded(seed); return rep(n, () => { const cx = x + rnd() * w, cy = y + rnd() * h, r = w * (0.09 + rnd() * 0.13); return f.ellipse(cx, cy, r * 1.3, r * 0.85, tok, { op: r1(op * (0.6 + rnd() * 0.4)) }); }); };
/** 잔해 더미(벽돌·콘크리트 조각, seed) */
export const rubble = (x, y, w, h, n, seed, toks = ['clay', 'wall2', 'ground2']) => { const rnd = seeded(seed); return f.ellipse(x + w / 2, y + h * 0.75, w / 2, h * 0.5, 'ground2', { op: 0.7 }) + rep(n, () => { const px = x + rnd() * w, py = y + rnd() * h, s = 0.5 + rnd() * 0.8, a = rnd() * 60 - 30; return f.rect(px, py, s * 1.4, s * 0.7, pick(rnd, toks), { tr: `rotate(${r1(a)} ${r1(px)} ${r1(py)})` }); }); };
/** 벽의 균열(지그재그 선) */
export const crack = (x, y, len, w = 0.16, tok = 'ink', op = 0.8) => f.line(`M${r1(x)},${r1(y)} l0.5,${r1(len * 0.22)} l-0.7,${r1(len * 0.2)} l0.8,${r1(len * 0.24)} l-0.4,${r1(len * 0.18)} l0.5,${r1(len * 0.16)}`, w, tok, { op });

// ---------------------------------------------------------------- 사람(심볼 조합)
/** 소방관 옆모습(공기통 · 헬멧 · 반사띠) — dir 쪽으로 걷는다 */
export const firefighter = (x, yBase, h, dir = 1, o = {}) => walker(x, yBase, h, { top: 'clay', bottom: 'clay', hat: 'helmet', hatTok: 'cloth2', ...o }, dir) + f.rect(x - dir * h * 0.16 - (dir > 0 ? h * 0.1 : 0), yBase - h * 0.74, h * 0.1, h * 0.3, 'roof2', { rx: 0.15 }) + f.rect(x - h * 0.11, yBase - h * 0.56, h * 0.22, h * 0.05, 'cloth2');
/** 소방관 뒷모습(공기통 · 헬멧 · 반사띠) */
export const firefighterBack = (x, yBase, h, o = {}) => person(x, yBase, h, { top: 'clay', bottom: 'clay', hat: 'helmet', hatTok: 'cloth2', ...o }) + f.rect(x - h * 0.07, yBase - h * 0.74, h * 0.14, h * 0.3, 'roof2', { rx: 0.15 }) + f.rect(x - h * 0.15, yBase - h * 0.56, h * 0.3, h * 0.05, 'cloth2');
/** 땅에 깔린 호스(굵은 선 + 하이라이트) */
export const hose = (d, w = 0.5) => f.line(d, w, 'clay') + f.line(d, w * 0.35, 'cloth3', { op: 0.3 });
/** 어깨 위에 아이를 태운 뒷모습(어른 + 작은 뒷모습) */
export const shouldered = (x, yBase, h, o = {}, child = {}) => person(x, yBase, h, o) + person(x, yBase - h * 0.72, h * 0.42, { top: 'cloth3', bottom: 'cloth1', hair: 'ink', ...child });
/** 입김 */
export const breath = (x, y, s = 0.6, op = 0.4) => f.ellipse(x, y, s, s * 0.45, 'cloth3', { op }) + f.ellipse(x + s * 0.8, y - s * 0.4, s * 0.7, s * 0.35, 'cloth3', { op: r1(op * 0.7) });
/** 전경 열 — 먼 인물(검은 제복 · 철모) + 내린 방패. 무기 0 */
export const riotFar = (x0, y, n, gap, h = 2.6, seed = 5) => { const rnd = seeded(seed); return rep(n, (i) => { const x = x0 + i * gap + (rnd() - 0.5) * 0.3, yy = y + (i % 2) * 0.15; return far(x, yy, h, 'cloth1', 'roof2') + f.rect(x - h * 0.2, yy - h * 0.52, h * 0.4, h * 0.52, 'far', { rx: 0.1, op: 0.85 }); }); };

// ---------------------------------------------------------------- 빛
/** 경광등 빛 번짐(반투명 원) */
export const glow = (x, y, r, tok, op = 0.2) => f.circle(x, y, r, tok, { op });
/** 경광등 막대(차 지붕 — 붉은 칸 · 푸른 칸 + 번짐) */
export const lightbar = (x, y, w) => f.rect(x, y, w * 0.45, 0.5, 'clay', { rx: 0.1 }) + f.rect(x + w * 0.55, y, w * 0.45, 0.5, 'cloth4', { rx: 0.1 }) + glow(x + w * 0.22, y + 0.25, w * 0.7, 'clay', 0.16) + glow(x + w * 0.78, y + 0.25, w * 0.7, 'cloth4', 0.18);
/** 손의 스마트폰(세로 · 둥근 모서리 · 앱 격자 — 로고·글자 0) + 화면 번짐 */
export const smartphone = (x, y, w, o = {}) => { const h = w * 1.95; const { grid = true, halo = true } = o; return (halo ? f.circle(x + w / 2, y + h / 2, w * 1.6, 'glass', { op: 0.14 }) : '') + f.rect(x, y, w, h, 'ink', { rx: r1(w * 0.14) }) + f.rect(x + w * 0.08, y + w * 0.18, w * 0.84, h - w * 0.4, 'glass') + (grid ? rep(12, (i) => f.rect(x + w * 0.14 + (i % 4) * w * 0.2, y + w * 0.3 + Math.floor(i / 4) * w * 0.3, w * 0.14, w * 0.14, ['clay', 'cloth4', 'green', 'cloth2', 'far', 'roof2'][i % 6], { rx: r1(w * 0.03) })) : '') + f.circle(x + w / 2, y + h - w * 0.12, w * 0.06, 'roof2'); };

// ---------------------------------------------------------------- 철거 현장 장비
/** 옥상의 망루(각목 틀 + 판자 — 가설 구조물) */
export const watchtower = (x, yBase, w, h) => f.rect(x, yBase - h, w, h, 'wood') + f.rect(x + w * 0.1, yBase - h + 0.5, w * 0.8, h * 0.5, 'roof2', { op: 0.8 }) + f.line(`M${r1(x)},${r1(yBase - h)} L${r1(x + w)},${r1(yBase - h * 0.42)} M${r1(x + w)},${r1(yBase - h)} L${r1(x)},${r1(yBase - h * 0.42)} M${r1(x)},${r1(yBase - h * 0.45)} H${r1(x + w)}`, 0.22, 'ink') + f.rect(x - 0.3, yBase - h - 0.4, w + 0.6, 0.5, 'wood') + f.rect(x + w * 0.3, yBase - h * 0.38, w * 0.4, h * 0.38, 'ink', { op: 0.6 });
/** 차량 크레인(몸체 · 운전석 · 붐) — 붐 끝 (tipX, tipY) */
export const mobileCrane = (x, yBase, w, tipX, tipY) => f.rect(x, yBase - w * 0.3, w, w * 0.22, 'cloth2', { rx: 0.2 }) + f.rect(x + w * 0.7, yBase - w * 0.5, w * 0.25, w * 0.22, 'cloth2', { rx: 0.2 }) + f.rect(x + w * 0.75, yBase - w * 0.47, w * 0.15, w * 0.12, 'glass') + rep(3, (i) => f.circle(x + w * 0.15 + i * w * 0.3, yBase - w * 0.07, w * 0.08, 'ink')) + f.rect(x - w * 0.08, yBase - w * 0.12, w * 0.12, w * 0.12, 'roof2') + f.line(`M${r1(x + w * 0.3)},${r1(yBase - w * 0.3)} L${r1(tipX)},${r1(tipY)}`, r1(w * 0.1), 'cloth2') + f.line(`M${r1(x + w * 0.3)},${r1(yBase - w * 0.3)} L${r1(tipX)},${r1(tipY)}`, r1(w * 0.03), 'ink', { op: 0.4 });
/** 붐 끝에 매달린 컨테이너(줄 · 고리 · 상자) */
export const hungContainer = (tipX, tipY, cx, cy, w, h, tok = 'cloth4') => f.line(`M${r1(tipX)},${r1(tipY)} L${r1(cx)},${r1(cy - h / 2 - 0.6)}`, 0.12, 'ink') + f.line(`M${r1(cx)},${r1(cy - h / 2 - 0.6)} L${r1(cx - w / 2)},${r1(cy - h / 2)} M${r1(cx)},${r1(cy - h / 2 - 0.6)} L${r1(cx + w / 2)},${r1(cy - h / 2)}`, 0.1, 'ink') + f.rect(cx - w / 2, cy - h / 2, w, h, tok) + f.line(rep(Math.floor(w / 0.8), (i) => `M${r1(cx - w / 2 + 0.4 + i * 0.8)},${r1(cy - h / 2 + 0.2)} V${r1(cy + h / 2 - 0.2)}`), 0.1, 'ink', { op: 0.3 });
/** 물대포 차(검은 몸체 · 지붕 포신) + 물줄기(호 — 사람에 닿지 않는 높이로 쏜다) */
export const waterCannon = (x, yBase, w, aimX, aimY) => { const nx = x + w * 0.8, ny = yBase - w * 0.7, mx = (nx + aimX) / 2, my = Math.min(aimY, ny) - 4; const d = `M${r1(nx)},${r1(ny)} Q${r1(mx)},${r1(my)} ${r1(aimX)},${r1(aimY)}`; return f.rect(x, yBase - w * 0.42, w, w * 0.36, 'cloth1', { rx: 0.3 }) + f.rect(x + w * 0.05, yBase - w * 0.4, w * 0.3, w * 0.16, 'glass', { op: 0.6 }) + f.rect(x + w * 0.55, yBase - w * 0.56, w * 0.18, w * 0.16, 'roof2') + f.line(`M${r1(x + w * 0.64)},${r1(yBase - w * 0.56)} L${r1(nx)},${r1(ny)}`, r1(w * 0.06), 'roof2') + f.circle(x + w * 0.18, yBase - w * 0.06, w * 0.08, 'ink') + f.circle(x + w * 0.82, yBase - w * 0.06, w * 0.08, 'ink') + f.line(d, 0.7, 'glass', { op: 0.5 }) + f.line(d, 0.3, 'cloth3', { op: 0.6 }); };
/** 가설 울타리(판 줄) */
export const hoarding = (x, yBase, w, h = 2.8, toks = ['hairw', 'cloth4']) => rep(Math.ceil(w / 4), (i) => f.rect(x + i * 4, yBase - h, 3.8, h, toks[i % toks.length], { op: 0.9 })) + f.rect(x, yBase - h - 0.2, w, 0.3, 'roof2');
