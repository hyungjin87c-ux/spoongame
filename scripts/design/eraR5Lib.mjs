/**
 * SPEC-009 「시대의 창」 r5 — 1990~2020년대 소품 도우미 (designer 2026-10-28, r5 — 마스터 의뢰 「1990~2020년대 묶음」).
 * r4 도우미(`eraR4Lib.mjs` — 사람 `<symbol>`+`<use>`, 색 `class`, 1940~60년대 소품)를 그대로 쓰고, 이 시대에 필요한 것만 더한다:
 *   고층 건물·판상형 아파트·밤 창 패턴, CRT·LCD 모니터·노트북·휴대전화 빛, 버스 셸터·공중전화 부스, 구급차·소방차·통제선·고깔,
 *   국화 더미·노란 리본·종이컵 촛불(+ 촛불 군중), 헬기·보트·여객선, 키오스크·배달 스쿠터·진열대·천막·지하철 입구 계단·빈 판.
 * 색은 `--c-scene-*` 24 토큰만(새 토큰 0 — 붉은 옷·소방차·구급차 띠는 `clay`, 노란 리본·통제선·조끼는 `cloth2`). 글자·로고·상호·번호 0(간판·화면·전광판·쪽지는 빈 면).
 * 사람은 r4와 같이 뒷모습·옆모습·먼 인물만(얼굴 0). 새 심볼은 두지 않는다(허용 목록 `ALLOWED_CLASSES` 6접두 × 25토큰 안, 태그는 svgNodes 허용 목록 안).
 */
import { f, rep, T, person, walker, far, seeded, pick, taegeuk, lamp } from './eraR4Lib.mjs';
export * from './eraR4Lib.mjs';

const r1 = (n) => Math.round(n * 100) / 100;
const q1 = (n) => Math.round(n * 10) / 10;

/** r5 공유 패턴 — 덩어리에 한 번. era-lit 밤 건물의 켜진 창 · era-grid 가는 격자(시간표·화상 수업 칸·유리 커튼월) · era-cups 촛불 바다(종이컵 + 불꽃) */
export const ERA_DEFS_R5 = [
  `<pattern id="era-lit" width="2.2" height="2.6" patternUnits="userSpaceOnUse"><rect x=".4" y=".4" width="1.2" height="1.5" fill="${T('glass')}"/><rect x="1.7" y="1.9" width=".4" height=".5" fill="${T('glass')}" opacity=".5"/></pattern>`,
  `<pattern id="era-grid" width="2" height="2" patternUnits="userSpaceOnUse"><path d="M0,1.9 H2 M1.9,0 V2" fill="none" stroke="${T('far')}" stroke-width=".14"/></pattern>`,
  `<pattern id="era-cups" width="3" height="2" patternUnits="userSpaceOnUse"><rect x=".2" y="1" width=".6" height=".7" fill="${T('cloth3')}"/><circle cx=".5" cy=".7" r=".28" fill="${T('glass')}"/><rect x="1.5" y="1.2" width=".6" height=".7" fill="${T('cloth3')}"/><circle cx="1.8" cy=".9" r=".28" fill="${T('glass')}"/><rect x="2.4" y=".7" width=".5" height=".6" fill="${T('cloth3')}"/><circle cx="2.65" cy=".45" r=".24" fill="${T('glass')}"/></pattern>`,
].join('');

// ---------------------------------------------------------------- 건물 · 거리
/** 고층 건물(낮: 창 격자 · 밤: 켜진 창) */
export const tower = (x, yBase, w, h, tok = 'far', o = {}) => { const { night = false, op = 0.55 } = o; return f.rect(x, yBase - h, w, h, tok) + f.fill(x + 0.3, yBase - h + 0.5, w - 0.6, h - 0.8, night ? 'era-lit' : 'era-windows', { op }); };
/** 판상형 아파트 한 동(층 띠 + 창) */
export const aptSlab = (x, yBase, w, h, tok = 'wall2', floors = 6) => f.rect(x, yBase - h, w, h, tok) + f.rect(x - 0.2, yBase - h - 0.5, w + 0.4, 0.6, 'roof2') + rep(floors, (i) => f.rect(x, yBase - h + (i + 1) * (h / (floors + 0.2)) - 0.15, w, 0.22, 'far', { op: 0.5 })) + f.fill(x + 0.4, yBase - h + 0.6, w - 0.8, h - 1, 'era-windows', { op: 0.55 });
/** 먼 스카이라인(여러 동) */
export const skyline = (y, night = false, tok = 'far2', seed = 5) => { const rnd = seeded(seed); return rep(8, (i) => { const w = 3 + rnd() * 3, h = 6 + rnd() * 9, x = i * 5.2 - 1 + rnd(); return tower(x, y, w, h, tok, { night, op: night ? 0.45 : 0.35 }); }); };
/** 밤 거리 땅(도로 + 차선) */
export const nightRoad = (y, h = 32 - 20) => f.rect(0, y, 40, h, 'roof2') + f.rect(0, y, 40, h, 'cloth1', { op: 0.35 }) + f.line(`M0,${r1(y + h * 0.55)} H40`, 0.25, 'cloth3', { dash: '2.2 1.8', op: 0.35 });
/** 인도 연석 띠 */
export const curb = (y, tok = 'ground2') => f.rect(0, y, 40, 0.5, tok, { op: 0.7 });
/** 빈 판(간판·전광판·쪽지·종이) */
export const blank = (x, y, w, h, tok = 'cloth3', o = {}) => f.rect(x, y, w, h, tok, { rx: 0.15, ...o });
/** 유리 셸터(버스 정류장) — 지붕·기둥·유리·벤치 */
export const shelter = (x, yBase, w = 11, h = 6) => f.rect(x - 0.3, yBase - h, w + 0.6, 0.5, 'roof2') + f.rect(x, yBase - h + 0.5, 0.35, h - 0.5, 'roof2') + f.rect(x + w - 0.35, yBase - h + 0.5, 0.35, h - 0.5, 'roof2') + f.rect(x + 0.35, yBase - h + 0.5, w - 0.7, h - 0.5, 'glass', { op: 0.25 }) + f.rect(x + 1, yBase - h * 0.42, w - 2, 0.5, 'wood') + f.line(`M${r1(x + 1.6)},${r1(yBase - h * 0.42 + 0.5)} V${r1(yBase)} M${r1(x + w - 1.6)},${r1(yBase - h * 0.42 + 0.5)} V${r1(yBase)}`, 0.3, 'roof2');
/** 공중전화 부스(유리 상자 + 안의 전화기) */
export const booth = (x, yBase, w = 2.6, h = 6.2) => f.rect(x, yBase - h, w, h, 'roof2', { rx: 0.2 }) + f.rect(x + 0.25, yBase - h + 0.25, w - 0.5, h - 0.5, 'glass', { op: 0.55 }) + f.rect(x + 0.25, yBase - h + 0.25, w - 0.5, 0.8, 'clay') + f.rect(x + w * 0.3, yBase - h * 0.62, w * 0.4, h * 0.2, 'ink', { rx: 0.15 }) + f.line(`M${r1(x + w * 0.7)},${r1(yBase - h * 0.5)} q0.4,0.8 0,1.6`, 0.12, 'ink');
/** 지하철 입구(계단 내려감 + 난간 + 지붕) */
export const subwayEntrance = (x, yBase, w = 8, h = 3.4) => f.rect(x, yBase - h, w, h, 'cloth1', { op: 0.85 }) + rep(4, (i) => f.rect(x + 0.5, yBase - h + 0.6 + i * 0.7, w - 1, 0.3, 'far', { op: 0.5 - i * 0.08 })) + f.rect(x - 0.3, yBase - h - 0.6, w + 0.6, 0.6, 'roof2') + f.line(`M${r1(x)},${r1(yBase - h)} V${r1(yBase - h - 2)} H${r1(x + w)} V${r1(yBase - h)}`, 0.22, 'roof2') + blank(x + w * 0.3, yBase - h - 1.8, w * 0.4, 1, 'far');
/** 천막(사각 지붕 + 기둥) */
export const tent = (x, yBase, w, h, tok = 'cloth3') => f.rect(x, yBase - h, 0.35, h, 'roof2') + f.rect(x + w - 0.35, yBase - h, 0.35, h, 'roof2') + f.poly([[x - 0.4, yBase - h], [x + w + 0.4, yBase - h], [x + w, yBase - h - 1.4], [x, yBase - h - 1.4]], tok) + f.rect(x - 0.4, yBase - h - 0.1, w + 0.8, 0.45, 'roof2', { op: 0.6 });
/** 통제선(두 기둥 사이 노란 띠, 검은 점선) */
export const policeTape = (x0, y0, x1, y1, posts = true) => (posts ? f.rect(x0 - 0.15, y0, 0.3, 3, 'roof2') + f.rect(x1 - 0.15, y1, 0.3, 3, 'roof2') : '') + f.line(`M${r1(x0)},${r1(y0 + 0.4)} Q${r1((x0 + x1) / 2)},${r1((y0 + y1) / 2 + 0.8)} ${r1(x1)},${r1(y1 + 0.4)}`, 0.42, 'cloth2') + f.line(`M${r1(x0)},${r1(y0 + 0.4)} Q${r1((x0 + x1) / 2)},${r1((y0 + y1) / 2 + 0.8)} ${r1(x1)},${r1(y1 + 0.4)}`, 0.42, 'ink', { dash: '1.1 1.1', op: 0.55 });
/** 고깔 */
export const cone = (x, yBase, h = 1.2) => f.poly([[x - h * 0.4, yBase], [x + h * 0.4, yBase], [x + h * 0.1, yBase - h], [x - h * 0.1, yBase - h]], 'clay') + f.rect(x - h * 0.3, yBase - h * 0.55, h * 0.6, h * 0.16, 'cloth3');
/** 가로수(여름 둥근 잎) */
export const streetTree = (x, yBase, h, tok = 'green') => f.rect(x - h * 0.05, yBase - h * 0.5, h * 0.1, h * 0.5, 'wood') + f.circle(x, yBase - h * 0.7, h * 0.3, tok) + f.circle(x - h * 0.18, yBase - h * 0.58, h * 0.2, tok) + f.circle(x + h * 0.2, yBase - h * 0.6, h * 0.22, tok);

// ---------------------------------------------------------------- 기계 · 화면
/** CRT 모니터 + 자판(책상 위) — 화면은 빛만 */
export const crt = (x, yBase, w = 3.4, tok = 'hairw') => { const h = w * 0.85; return f.rect(x, yBase - h, w, h * 0.82, tok, { rx: 0.2 }) + f.rect(x + w * 0.1, yBase - h * 0.92, w * 0.8, h * 0.62, 'glass') + f.rect(x + w * 0.1, yBase - h * 0.92, w * 0.8, h * 0.62, 'cloth4', { op: 0.28 }) + f.rect(x + w * 0.3, yBase - h * 0.18, w * 0.4, h * 0.18, tok) + f.rect(x - w * 0.1, yBase - 0.35, w * 1.1, 0.35, 'roof2', { rx: 0.1 }); };
/** 얇은 모니터(받침) */
export const lcd = (x, yBase, w = 4, tint = 'cloth4') => { const h = w * 0.6; return f.rect(x, yBase - h - 0.8, w, h, 'ink', { rx: 0.15 }) + f.rect(x + 0.15, yBase - h - 0.65, w - 0.3, h - 0.3, 'glass') + f.rect(x + 0.15, yBase - h - 0.65, w - 0.3, h - 0.3, tint, { op: 0.25 }) + f.rect(x + w * 0.45, yBase - 0.8, w * 0.1, 0.6, 'ink') + f.rect(x + w * 0.3, yBase - 0.2, w * 0.4, 0.2, 'ink'); };
/** 노트북(옆에서 비스듬히 — 화면 + 바닥) */
export const laptop = (x, yBase, w = 3.2, dir = 1, tint = 'cloth4') => f.rect(x, yBase - 0.3, w, 0.3, 'roof2', { rx: 0.1 }) + f.rect(dir > 0 ? x + w - 0.35 : x, yBase - w * 0.62 - 0.3, 0.35, w * 0.62, 'roof2') + f.rect(dir > 0 ? x + w - 0.5 : x + 0.15, yBase - w * 0.62 - 0.2, 0.2, w * 0.58, 'glass') + f.rect(dir > 0 ? x + w - 0.5 : x + 0.15, yBase - w * 0.62 - 0.2, 0.2, w * 0.58, tint, { op: 0.3 });
/** 노트북(정면 — 화면 넓게) */
export const laptopFront = (x, yBase, w = 4, tint = 'cloth4') => f.rect(x - 0.2, yBase - 0.3, w + 0.4, 0.3, 'roof2', { rx: 0.1 }) + f.rect(x, yBase - w * 0.62 - 0.3, w, w * 0.62, 'roof2', { rx: 0.15 }) + f.rect(x + 0.15, yBase - w * 0.62 - 0.15, w - 0.3, w * 0.62 - 0.3, 'glass') + f.rect(x + 0.15, yBase - w * 0.62 - 0.15, w - 0.3, w * 0.62 - 0.3, tint, { op: 0.25 });
/** 벽걸이·평면 TV */
export const flatTv = (x, y, w, tint = 'cloth4') => f.rect(x, y, w, w * 0.56, 'ink', { rx: 0.15 }) + f.rect(x + 0.2, y + 0.2, w - 0.4, w * 0.56 - 0.4, 'glass') + f.rect(x + 0.2, y + 0.2, w - 0.4, w * 0.56 - 0.4, tint, { op: 0.3 });
/** 손의 휴대전화 빛(작은 사각 + 번짐) — 옆모습 사람의 손 높이에 둔다 */
export const phoneGlow = (x, y, s = 0.5, o = {}) => f.rect(x - s * 0.5, y - s * 0.8, s, s * 1.6, 'glass', { rx: 0.08, op: o.op }) + f.circle(x, y, s * 1.8, 'glass', { op: 0.12 });
/** 폴더 휴대전화(열림, 손 높이) */
export const folderPhone = (x, y, s = 0.6) => f.rect(x - s * 0.3, y - s, s * 0.6, s * 0.9, 'roof2', { rx: 0.1 }) + f.rect(x - s * 0.2, y - s * 0.9, s * 0.4, s * 0.55, 'glass') + f.rect(x - s * 0.3, y, s * 0.6, s * 0.8, 'roof2', { rx: 0.1, tr: `rotate(-12 ${r1(x)} ${r1(y)})` });
/** 책상(상판 + 다리 둘) */
export const desk = (x, yBase, w, h = 2.4, tok = 'wood') => f.rect(x, yBase - h, w, 0.5, tok) + f.line(`M${r1(x + 0.5)},${r1(yBase - h + 0.5)} V${r1(yBase)} M${r1(x + w - 0.5)},${r1(yBase - h + 0.5)} V${r1(yBase)}`, 0.35, tok);
/** 칸막이 책상(독서실·PC방) */
export const cubicle = (x, yBase, w, h, tok = 'wall2') => f.rect(x, yBase - h, w, h, tok) + f.rect(x + w - 0.3, yBase - h - 0.8, 0.3, h + 0.8, tok) + f.rect(x, yBase - h * 0.5, w, 0.35, 'wood');
/** 키오스크(기둥 + 기운 빈 화면) */
export const kiosk = (x, yBase, h = 6) => f.rect(x - 0.6, yBase - h * 0.55, 1.2, h * 0.55, 'roof2') + f.rect(x - 1.1, yBase - h, 2.2, h * 0.5, 'ink', { rx: 0.2 }) + f.rect(x - 0.9, yBase - h + 0.2, 1.8, h * 0.5 - 0.4, 'glass') + f.rect(x - 0.9, yBase - h + 0.2, 1.8, h * 0.5 - 0.4, 'cloth4', { op: 0.22 });
/** 진열대(선반 + 색 상품 줄) */
export const shelf = (x, y, w, h, rows = 3, toks = ['clay', 'cloth4', 'green', 'cloth2', 'hairw', 'cloth1']) => f.rect(x, y, w, h, 'wall2') + rep(rows, (r) => f.rect(x, y + (r + 1) * (h / rows) - 0.25, w, 0.25, 'far') + rep(Math.floor(w / 0.9), (i) => f.rect(x + 0.2 + i * 0.9, y + r * (h / rows) + 0.4, 0.6, h / rows - 0.75, toks[(i + r) % toks.length])));
/** 종이 상자 */
export const box = (x, yBase, w, h = w * 0.7, tok = 'clay') => f.rect(x, yBase - h, w, h, tok) + f.line(`M${r1(x + w / 2)},${r1(yBase - h)} V${r1(yBase)}`, 0.14, 'wood', { op: 0.6 }) + f.rect(x, yBase - h, w, 0.25, 'cloth3', { op: 0.3 });

// ---------------------------------------------------------------- 차량 · 항공 · 선박
/** 구급차(흰 밴 + 띠 + 경광등) — 표장(십자) 0 */
export const ambulance = (x, yBase, w = 8, dir = 1) => { const h = w * 0.46; return f.rect(x, yBase - h, w, h - w * 0.08, 'hairw', { rx: 0.4 }) + f.rect(x, yBase - h * 0.5, w, h * 0.16, 'clay') + f.rect(dir > 0 ? x + w * 0.72 : x + w * 0.06, yBase - h * 0.9, w * 0.22, h * 0.32, 'glass') + f.rect(x + w * 0.15, yBase - h * 0.9, w * 0.3, h * 0.32, 'glass', { op: 0.7 }) + f.rect(x + w * 0.4, yBase - h - 0.4, w * 0.2, 0.45, 'clay', { rx: 0.15 }) + f.circle(x + w * 0.5, yBase - h - 0.2, 1.1, 'clay', { op: 0.2 }) + f.circle(x + w * 0.2, yBase - 0.1, w * 0.07, 'ink') + f.circle(x + w * 0.8, yBase - 0.1, w * 0.07, 'ink'); };
/** 소방차(붉은 몸체 = clay · 사다리) */
export const fireEngine = (x, yBase, w = 11, dir = 1) => { const h = w * 0.34; return f.rect(x, yBase - h, w, h - w * 0.06, 'clay', { rx: 0.3 }) + f.rect(dir > 0 ? x + w * 0.74 : x + w * 0.04, yBase - h * 1.15, w * 0.22, h * 0.5, 'clay', { rx: 0.3 }) + f.rect(dir > 0 ? x + w * 0.78 : x + w * 0.07, yBase - h * 1.08, w * 0.14, h * 0.3, 'glass') + f.rect(x + w * 0.05, yBase - h - 0.3, w * 0.62, 0.35, 'hairw') + f.line(rep(6, (i) => `M${r1(x + w * 0.1 + i * w * 0.1)},${r1(yBase - h - 0.3)} v0.35`), 0.1, 'roof2') + f.rect(x + w * 0.1, yBase - h * 0.75, w * 0.55, h * 0.35, 'hairw', { op: 0.5 }) + f.rect(dir > 0 ? x + w * 0.8 : x + w * 0.1, yBase - h * 1.15 - 0.4, w * 0.1, 0.4, 'glass') + f.circle(x + w * 0.18, yBase - 0.1, w * 0.065, 'ink') + f.circle(x + w * 0.82, yBase - 0.1, w * 0.065, 'ink'); };
/** 승용차(옆) */
export const car = (x, yBase, w = 5, tok = 'cloth4', dir = 1) => { const h = w * 0.36; return f.rect(x, yBase - h * 0.7, w, h * 0.6, tok, { rx: 0.3 }) + f.path(`M${r1(x + w * 0.2)},${r1(yBase - h * 0.7)} L${r1(x + w * 0.32)},${r1(yBase - h * 1.15)} H${r1(x + w * 0.74)} L${r1(x + w * 0.86)},${r1(yBase - h * 0.7)}Z`, tok) + f.rect(x + w * 0.35, yBase - h * 1.08, w * 0.34, h * 0.32, 'glass') + f.circle(x + w * 0.22, yBase - 0.1, h * 0.25, 'ink') + f.circle(x + w * 0.78, yBase - 0.1, h * 0.25, 'ink'); };
/** 승합차·셔틀(옆, 긴 상자) */
export const van = (x, yBase, w = 7, tok = 'cloth2', dir = 1) => { const h = w * 0.42; return f.rect(x, yBase - h, w, h - w * 0.06, tok, { rx: 0.4 }) + rep(3, (i) => f.rect(x + w * 0.1 + i * w * 0.27, yBase - h * 0.88, w * 0.2, h * 0.36, 'glass')) + f.circle(x + w * 0.18, yBase - 0.1, w * 0.07, 'ink') + f.circle(x + w * 0.82, yBase - 0.1, w * 0.07, 'ink'); };
/** 시내버스(옆, 큰 창) */
export const bus = (x, yBase, w = 14, tok = 'cloth4') => { const h = w * 0.3; return f.rect(x, yBase - h, w, h - w * 0.04, tok, { rx: 0.4 }) + f.rect(x + w * 0.04, yBase - h * 0.9, w * 0.92, h * 0.42, 'glass') + f.line(rep(5, (i) => `M${r1(x + w * 0.2 + i * w * 0.16)},${r1(yBase - h * 0.9)} v${r1(h * 0.42)}`), 0.2, tok) + f.circle(x + w * 0.15, yBase - 0.1, h * 0.22, 'ink') + f.circle(x + w * 0.85, yBase - 0.1, h * 0.22, 'ink'); };
/** 배달 스쿠터(옆, 뒤 배달통) */
export const scooter = (x, yBase, w = 3.2, tok = 'cloth4', dir = 1) => f.circle(x + w * 0.15, yBase - w * 0.16, w * 0.16, 'ink') + f.circle(x + w * 0.85, yBase - w * 0.16, w * 0.16, 'ink') + f.rect(x + w * 0.22, yBase - w * 0.42, w * 0.5, w * 0.2, tok, { rx: 0.2 }) + f.line(`M${r1(x + w * 0.75)},${r1(yBase - w * 0.38)} L${r1(x + w * 0.82)},${r1(yBase - w * 0.7)}`, 0.14, 'ink') + f.rect(dir > 0 ? x - w * 0.02 : x + w * 0.7, yBase - w * 0.75, w * 0.34, w * 0.34, 'clay', { rx: 0.15 });
/** 헬기(옆) */
export const heli = (x, y, w = 5, tok = 'roof2', dir = 1) => f.ellipse(x, y, w * 0.3, w * 0.14, tok) + f.rect(dir > 0 ? x - w * 0.62 : x + w * 0.2, y - w * 0.04, w * 0.45, w * 0.07, tok) + f.rect(dir > 0 ? x - w * 0.66 : x + w * 0.58, y - w * 0.16, w * 0.06, w * 0.18, tok) + f.rect(x - w * 0.03, y - w * 0.26, w * 0.06, w * 0.12, tok) + f.line(`M${r1(x - w * 0.5)},${r1(y - w * 0.26)} H${r1(x + w * 0.5)}`, w * 0.05, tok) + f.line(`M${r1(x - w * 0.22)},${r1(y + w * 0.2)} H${r1(x + w * 0.22)}`, w * 0.04, tok) + f.rect(dir > 0 ? x + w * 0.08 : x - w * 0.24, y - w * 0.1, w * 0.16, w * 0.1, 'glass');
/** 작은 보트(구조·해경) */
export const boat = (x, y, w = 4, tok = 'cloth2') => f.path(`M${r1(x)},${r1(y)} L${r1(x + w)},${r1(y)} L${r1(x + w * 0.85)},${r1(y + w * 0.22)} L${r1(x + w * 0.1)},${r1(y + w * 0.22)}Z`, tok) + f.rect(x + w * 0.35, y - w * 0.18, w * 0.3, w * 0.18, 'hairw', { rx: 0.1 });
/** 여객선(옆, 기울기 deg — 0이면 정상) */
export const ferry = (x, y, w = 14, tilt = 0) => { const h = w * 0.22; const g = `rotate(${tilt} ${r1(x + w / 2)} ${r1(y)})`; return f.g(`transform="${g}"`, f.path(`M${r1(x)},${r1(y - h * 0.6)} L${r1(x + w)},${r1(y - h * 0.6)} L${r1(x + w * 0.9)},${r1(y + h * 0.5)} L${r1(x + w * 0.08)},${r1(y + h * 0.5)}Z`, 'hairw') + f.rect(x + w * 0.15, y - h * 1.4, w * 0.6, h * 0.8, 'cloth3') + f.rect(x + w * 0.2, y - h * 1.95, w * 0.42, h * 0.55, 'cloth3') + f.rect(x + w * 0.3, y - h * 2.3, w * 0.12, h * 0.4, 'roof2') + f.fill(x + w * 0.18, y - h * 1.3, w * 0.54, h * 0.6, 'era-windows', { op: 0.5 }) + f.rect(x, y + h * 0.1, w, h * 0.12, 'cloth4', { op: 0.8 })); };
/** 큰 회색 함정(옆) */
export const greyShip = (x, y, w = 10, tok = 'roof2', tok2 = 'far2') => { const h = w * 0.16; return f.path(`M${r1(x)},${r1(y - h)} L${r1(x + w)},${r1(y - h * 0.8)} L${r1(x + w * 0.92)},${r1(y + h * 0.4)} L${r1(x + w * 0.05)},${r1(y + h * 0.4)}Z`, tok) + f.rect(x, y - h * 0.5, w * 0.98, h * 0.14, 'cloth3', { op: 0.5 }) + f.rect(x + w * 0.3, y - h * 2, w * 0.3, h, tok2) + f.rect(x + w * 0.38, y - h * 2.7, w * 0.08, h * 0.7, tok2) + f.rect(x + w * 0.5, y - h * 2.5, w * 0.03, h * 0.5, 'ink') + f.rect(x + w * 0.62, y - h * 1.5, w * 0.12, h * 0.5, tok2); };
/** 고속열차 머리(옆, 유선형) */
export const bulletTrain = (x, yBase, w = 22, tok = 'cloth4') => { const h = w * 0.16; return f.path(`M${r1(x)},${r1(yBase)} L${r1(x + w)},${r1(yBase)} V${r1(yBase - h)} H${r1(x + w * 0.2)} Q${r1(x + w * 0.04)},${r1(yBase - h)} ${r1(x)},${r1(yBase)}Z`, 'hairw') + f.path(`M${r1(x + w * 0.1)},${r1(yBase - h * 0.3)} L${r1(x + w)},${r1(yBase - h * 0.3)} V${r1(yBase - h * 0.12)} H${r1(x + w * 0.02)}Z`, tok) + rep(Math.floor(w / 2.2) - 1, (i) => f.rect(x + w * 0.22 + i * 2.2, yBase - h * 0.86, 1.3, h * 0.36, 'glass')) + f.path(`M${r1(x + w * 0.04)},${r1(yBase - h * 0.6)} Q${r1(x + w * 0.1)},${r1(yBase - h * 0.95)} ${r1(x + w * 0.2)},${r1(yBase - h * 0.95)} V${r1(yBase - h * 0.55)}Z`, 'glass'); };

// ---------------------------------------------------------------- 추모 · 촛불 · 리본
/** 국화 더미(흰·노란 꽃 + 초록 잎) */
export const flowers = (x, y, w, n = 14, seed = 11) => { const rnd = seeded(seed); return f.ellipse(x + w / 2, y + 0.6, w / 2 + 0.3, 1, 'green', { op: 0.8 }) + rep(n, () => { const fx = x + rnd() * w, fy = y - rnd() * 1.2 + 0.4, r = 0.38 + rnd() * 0.22; return f.circle(fx, fy, r, rnd() < 0.3 ? 'glass' : 'cloth3') + f.circle(fx, fy, r * 0.35, 'cloth2'); }); };
/** 노란 리본(고리 둘 + 꼬리 둘) */
export const ribbon = (x, y, s = 1, tok = 'cloth2') => f.path(`M${r1(x)},${r1(y)} q${r1(-s * 0.55)},${r1(-s * 0.9)} 0,${r1(-s * 0.6)} q${r1(s * 0.55)},${r1(-s * 0.3)} 0,${r1(s * 0.6)} l${r1(-s * 0.45)},${r1(s * 0.9)} h${r1(s * 0.3)} l${r1(s * 0.15)},${r1(-s * 0.9)} l${r1(s * 0.45)},${r1(s * 0.9)} h${r1(s * 0.3)}Z`, tok);
/** 종이컵 촛불(컵 + 불꽃 + 번짐) */
export const candle = (x, y, s = 0.55) => f.rect(x - s * 0.4, y - s * 0.6, s * 0.8, s * 0.9, 'cloth3', { rx: 0.05 }) + f.circle(x, y - s * 0.85, s * 0.3, 'glass') + f.circle(x, y - s * 0.8, s * 1.4, 'glass', { op: 0.14 });
/** 촛불 든 군중(뒷모습) — 사람마다 가슴 높이에 촛불 하나. o는 crowd와 같다(+ cupScale) */
export const candleCrowd = (x0, x1, n, hMin, hMax, o = {}) => {
  const { y = 24, jitter = 0.8, tops = ['cloth3', 'cloth4', 'hairw', 'cloth1', 'clay', 'roof2'], bottoms = ['cloth1', 'ink', 'roof2'], hairs = ['hair', 'ink'], seed = 7, skirts = 0.25, hats = [], coat = 0 } = o;
  const list = []; const rnd = seeded(seed);
  for (let i = 0; i < n; i++) { const t = (i + rnd() * 0.8) / n; const dy = (rnd() - 0.5) * 2 * jitter; const h = hMin + (hMax - hMin) * rnd(); const sk = rnd() < skirts; const p = { x: x0 + (x1 - x0) * t, y: y + dy, h, top: pick(rnd, tops), bottom: pick(rnd, bottoms), hair: pick(rnd, hairs), skirt: sk, coat: rnd() < coat, hat: null, hatTok: 'roof2' }; for (const hh of hats) if (rnd() < hh.p) { p.hat = hh.hat; p.hatTok = hh.hatTok || 'roof2'; break; } list.push(p); }
  list.sort((a, b) => a.y - b.y);
  return list.map((p) => person(p.x, p.y, p.h, p) + candle(p.x + p.h * 0.16, p.y - p.h * 0.52, p.h * 0.075)).join('');
};
/** 조기(반기) — 깃대 + 중간 높이의 태극기 */
export const halfMast = (x, yBase, h, fw = 2.4) => f.rect(x - 0.12, yBase - h, 0.24, h, 'roof2') + taegeuk(x + 0.12, yBase - h * 0.62, fw) + f.circle(x, yBase - h, 0.3, 'cloth2');
/** 흰 마스크 쓴 옆모습 걷는 사람(walker의 hat 'mask') */
export const masked = (x, yBase, h, o = {}, dir = 1) => walker(x, yBase, h, { ...o, hat: 'mask' }, dir);
/** 손에 휴대전화를 든 옆모습 걷는 사람 — 가슴 앞에 작은 빛 */
export const phoneWalker = (x, yBase, h, o = {}, dir = 1) => walker(x, yBase, h, o, dir) + phoneGlow(x + dir * h * 0.17, yBase - h * 0.5, h * 0.06);
/** 앉은 뒷모습 줄(의자 등받이 위로 어깨와 머리 — far 심볼) */
export const seatedBacks = (x0, y, n, gap, h, tops = ['cloth3', 'cloth4', 'hairw', 'cloth1', 'clay'], hairs = ['hair', 'ink'], seed = 21) => { const rnd = seeded(seed); return rep(n, (i) => far(x0 + i * gap + (rnd() - 0.5) * 0.3, y + (rnd() - 0.5) * 0.3, h * (0.92 + rnd() * 0.16), pick(rnd, tops), pick(rnd, hairs))); };
/** 창밖 밤 하늘 + 빌딩 불빛 띠(실내 장면의 창에) */
export const windowNight = (x, y, w, h) => f.rect(x, y, w, h, 'cloth1') + f.rect(x, y, w, h, 'roof2', { op: 0.4 }) + f.fill(x + 0.2, y + h * 0.45, w - 0.4, h * 0.55, 'era-lit', { op: 0.35 });
/** 형광등 막대(천장) */
export const fluorescent = (x, y, w) => f.rect(x, y, w, 0.5, 'glass', { rx: 0.2 }) + f.rect(x - 0.4, y - 0.2, w + 0.8, 1.8, 'glass', { op: 0.12, rx: 0.6 });
/** 벽시계(바늘만) */
export const clock = (x, y, r = 1.2) => f.circle(x, y, r, 'roof2') + f.circle(x, y, r * 0.82, 'cloth3') + f.line(`M${r1(x)},${r1(y)} V${r1(y - r * 0.6)} M${r1(x)},${r1(y)} L${r1(x + r * 0.45)},${r1(y + r * 0.25)}`, r * 0.12, 'ink');
/** 소파(앞에서) */
export const sofa = (x, yBase, w = 12, h = 4.4, tok = 'cloth4') => f.rect(x, yBase - h, w, h * 0.55, tok, { rx: 0.4 }) + f.rect(x, yBase - h * 0.5, w, h * 0.5, tok, { rx: 0.4 }) + f.rect(x - 0.5, yBase - h * 0.72, 1.2, h * 0.72, tok, { rx: 0.4 }) + f.rect(x + w - 0.7, yBase - h * 0.72, 1.2, h * 0.72, tok, { rx: 0.4 }) + f.rect(x + 0.4, yBase - h * 0.5, w - 0.8, 0.3, 'ink', { op: 0.25 });
/** 화분(큰 잎) */
export const plant = (x, yBase, h = 5) => f.rect(x - h * 0.16, yBase - h * 0.3, h * 0.32, h * 0.3, 'clay') + rep(5, (i) => f.ellipse(x + (i - 2) * h * 0.14, yBase - h * 0.3 - h * 0.32 + Math.abs(i - 2) * h * 0.06, h * 0.1, h * 0.3, 'green', { tr: `rotate(${(i - 2) * 22} ${r1(x + (i - 2) * h * 0.14)} ${r1(yBase - h * 0.3)})` }));
/** 캐비닛 컬러 TV(1990년대 큰 브라운관) */
export const bigTv = (x, yBase, w = 7) => { const h = w * 0.8; return f.rect(x, yBase - h, w, h, 'roof2', { rx: 0.3 }) + f.rect(x + w * 0.07, yBase - h * 0.93, w * 0.86, h * 0.7, 'glass') + f.rect(x + w * 0.07, yBase - h * 0.93, w * 0.86, h * 0.7, 'cloth4', { op: 0.3 }) + f.rect(x + w * 0.1, yBase - h * 0.18, w * 0.8, h * 0.1, 'ink', { op: 0.5 }); };

