/**
 * SPEC-010 「시대의 창」 r9 — 미래 연표 묶음 C 다시 그리기(2060~2109 + 끝 장면, U27~U46 20장)의 소품 (designer 2026-11-04).
 * r8 도우미(`eraR8Lib.mjs` → r7 → … → r2)를 그대로 쓰고, r2 개정안의 「규모로 보여 주는」 장면에 필요한 것만 더한다:
 *   화면 벽(같은 꼴 윤곽 칸 수십 개 + 빈 가격판) · 단상 · 긴 식탁과 둘러앉은 뒷모습 · 빈 사진틀 줄 · 내려앉은 지붕의 빈집과 덩굴 · 로봇 팔이 비치는 공장 창 줄 · 빈 주차장 ·
 *   강과 유리 건물 · 차단된 다리 · 돌봄 로봇 · 호숫가 길과 빈 벤치 · 태양광 지붕 · 풍력 날개 · 둘로 가른 항만 울타리 · 물 위로 솟은 지붕 · 이삿짐 줄 · 거대한 방벽과 수문 · 전차 ·
 *   밤 노점 · 철거 중인 타워와 타워 크레인 · 멈춘 분수 · 별·정거장 빛줄·달 · 어깨 위의 아이 · 카페 탁자의 화면 · 수평선으로 사라지는 가로등 줄.
 * 색은 `--c-scene-*` 25 토큰만(새 토큰 0). 글자·숫자·로고·국기·나라 지도·군사 장비 0. 사람은 r4 심볼(뒷모습·옆모습·먼 인물, 얼굴 0)만 — 새 심볼 0, 새 패턴 0.
 * 수위(SPEC-010 「그림 수위」 + r2 메모 ①~③): 디지털 인간은 모두 같은 꼴의 눈코입 없는 윤곽(얼굴 비교 0, 가격 숫자 0) · 군중은 질서 있는 줄(구호·피켓·충돌 0) · 철거는 가림막과 크레인까지(무너지는 순간·먼지 0) ·
 *   재난은 현장까지(물은 평평, 휩쓸림·구조·쓰러진 사람 0) · 공포 연출(붉은 하늘) 0.
 */
import { f, rep, far, seeded, pick, waves } from './eraR8Lib.mjs';
export * from './eraR8Lib.mjs';

const r1 = (n) => Math.round(n * 100) / 100;
const P = (pts) => pts.map(([x, y]) => `${r1(x)},${r1(y)}`);

// ---------------------------------------------------------------- 화면 · 홀 · 식탁 (2065 · 2100년대)
/** 머리·어깨 윤곽 하나(눈코입 0, 찬 면) — 어디서나 같은 꼴 */
export const bustSil = (cx, yTop, h, tok = 'cloth4', op = 0.88) => { const hr = h * 0.18, sw = h * 0.54, sy = yTop + hr * 2.1; return f.circle(cx, yTop + hr, hr, tok, { op }) + f.rect(cx - sw / 2, sy, sw, h - (sy - yTop), tok, { rx: r1(sw * 0.3), op }); };
/** 화면 칸(어두운 틀 + 유리 + 윤곽 하나) — tag면 칸 밑에 빈 가격판(글자·숫자 0) */
export const bustCell = (x, y, w, h, { tag = true, tok = 'cloth4', glassOp = 0.12 } = {}) => f.rect(x, y, w, h, 'ink', { rx: 0.15 }) + f.rect(x + 0.2, y + 0.2, w - 0.4, h - 0.4, 'roof2') + f.rect(x + 0.2, y + 0.2, w - 0.4, h - 0.4, 'glass', { op: glassOp }) + bustSil(x + w / 2, y + h * 0.2, h * 0.64, tok) + (tag ? f.rect(x + w * 0.22, y + h + 0.22, w * 0.56, h * 0.16, 'cloth3', { rx: 0.08, op: 0.9 }) : '');
/** 화면 벽 — cols × rows 칸(모두 같은 꼴) */
export const screenWall = (x, y, cols, rows, cw, ch, gapX = 0.45, gapY = 1.0, o = {}) => rep(rows, (r) => rep(cols, (c) => bustCell(x + c * (cw + gapX), y + r * (ch + gapY), cw, ch, o)));
/** 단상(단 + 앞판) */
export const podium = (x, yBase, w, h = 1.6) => f.rect(x, yBase - h, w, h, 'roof2') + f.rect(x, yBase - h, w, 0.35, 'far', { op: 0.6 });
/** 긴 식탁(상판 + 다리 둘 + 상판 위 그릇·컵 몇) */
export const longTable = (x, yBase, w, h = 1.8, tok = 'wood', seed = 4) => { const rnd = seeded(seed); return f.rect(x, yBase - h, w, 0.6, tok, { rx: 0.1 }) + f.rect(x + 0.2, yBase - h + 0.6, w - 0.4, 0.4, 'shade', { op: 0.25 }) + f.line(`M${r1(x + 1)},${r1(yBase - h + 0.6)} V${r1(yBase)} M${r1(x + w - 1)},${r1(yBase - h + 0.6)} V${r1(yBase)}`, 0.35, tok) + rep(Math.floor(w / 2.4), (i) => f.ellipse(x + 1.4 + i * 2.4 + rnd() * 0.6, yBase - h - 0.1, 0.6, 0.22, pick(rnd, ['cloth3', 'glass', 'hairw']), { op: 0.95 })); };
/** 의자 등받이(식탁 앞·뒤) */
export const chairBack = (x, yBase, w = 2.2, h = 2.6, tok = 'cloth4') => f.rect(x - w / 2, yBase - h, w, h * 0.55, tok, { rx: 0.3 }) + f.line(`M${r1(x - w * 0.38)},${r1(yBase - h * 0.45)} V${r1(yBase)} M${r1(x + w * 0.38)},${r1(yBase - h * 0.45)} V${r1(yBase)}`, 0.22, 'roof2');
/** 빈 사진틀 줄(여러 세대 — 안은 벽색보다 조금 어둡다) */
export const frameRow = (x, y, n, w, h, gap = 0.7, tok = 'wood') => rep(n, (i) => f.rect(x + i * (w + gap), y + (i % 2) * 0.5, w, h, tok) + f.rect(x + i * (w + gap) + 0.25, y + (i % 2) * 0.5 + 0.25, w - 0.5, h - 0.5, 'wall2', { op: 0.75 }));
/** 큰 창 너머 저녁 정원(틀 + 유리 + 나무 덩이 + 잔디 + 낮은 하늘빛) */
export const gardenWindow = (x, y, w, h, { evening = true } = {}) => f.rect(x, y, w, h, 'far') + f.rect(x + 0.5, y + 0.5, w - 1, h - 1, evening ? 'glass' : 'sky') + f.rect(x + 0.5, y + 0.5, w - 1, h - 1, evening ? 'clay' : 'cloth3', { op: evening ? 0.18 : 0.2 }) + f.ellipse(x + w * 0.3, y + h * 0.62, w * 0.2, h * 0.22, 'green', { op: 0.6 }) + f.ellipse(x + w * 0.72, y + h * 0.66, w * 0.16, h * 0.18, 'green', { op: 0.55 }) + f.rect(x + 0.5, y + h * 0.76, w - 1, h * 0.24 - 0.5, 'green', { op: 0.3 }) + f.rect(x + w * 0.5 - 0.2, y + 0.5, 0.4, h - 1, 'far');
/** 카페 탁자(둥근 상판 + 기둥) + 한쪽 의자의 사람(먼 인물) + 맞은편에 세운 화면 속 윤곽 */
export const cafeTable = (x, yBase, w, { person: top = 'cloth4', hair = 'hair', withPerson = true, screenTok = 'cloth4' } = {}) => f.ellipse(x, yBase - w * 0.42, w * 0.5, w * 0.16, 'wood') + f.rect(x - 0.15, yBase - w * 0.42, 0.3, w * 0.42, 'roof2') + (withPerson ? far(x - w * 0.42, yBase + 0.2, w * 0.9, top, hair) : '') + f.rect(x + w * 0.22, yBase - w * 0.95, w * 0.34, w * 0.44, 'ink', { rx: 0.12 }) + f.rect(x + w * 0.26, yBase - w * 0.91, w * 0.26, w * 0.36, 'roof2') + bustSil(x + w * 0.39, yBase - w * 0.88, w * 0.26, screenTok) + f.rect(x + w * 0.36, yBase - w * 0.51, w * 0.06, w * 0.1, 'ink');

// ---------------------------------------------------------------- 빈 마을 · 무인 공장 (2060년대)
/** 내려앉은 지붕의 빈집(벽 + 처진 용마루 + 어두운 창 + 덩굴 덩이). lit이면 창에 불 */
export const ruinHouse = (x, yBase, w, h, { sag = 0.5, lit = false, tok = 'wall2', roofTok = 'roof2', vines = 3, seed = 1, broken = false } = {}) => {
  const rnd = seeded(seed), top = yBase - h, ridge = top - w * 0.42 + sag * w * 0.3;
  return f.rect(x, top, w, h, tok) + f.rect(x, top, w, h, 'shade', { op: 0.12 })
    + (broken ? f.poly([[x - 0.3, top], [x + w * 0.42, ridge + 0.2], [x + w * 0.5, top + h * 0.25], [x + w * 0.62, ridge + 0.6], [x + w + 0.3, top]], roofTok) : f.poly([[x - 0.3, top], [x + w * 0.3, ridge - 0.2], [x + w * 0.52, ridge + 0.35], [x + w * 0.72, ridge - 0.1], [x + w + 0.3, top]], roofTok))
    + f.rect(x + w * 0.36, top + h * 0.28, w * 0.28, h * 0.36, lit ? 'glass' : 'ink', { op: lit ? 0.95 : 0.55 })
    + rep(vines, (i) => f.circle(x + w * (0.05 + rnd() * 0.9), top + h * (0.2 + rnd() * 0.9), w * (0.12 + rnd() * 0.12), 'green', { op: 0.55 + rnd() * 0.25 }));
};
/** 무너진 담(끊긴 낮은 벽) */
export const brokenWall = (x, y, w, h = 1.1) => f.rect(x, y, w * 0.38, h, 'ground2') + f.rect(x + w * 0.5, y + h * 0.3, w * 0.3, h * 0.7, 'ground2') + f.rect(x + w * 0.86, y + h * 0.1, w * 0.14, h * 0.9, 'ground2') + f.fill(x, y, w, h, 'era-stones', { op: 0.5 });
/** 풀이 자란 땅(풀 덩이 여럿) */
export const grassTufts = (x0, x1, y0, y1, n, seed = 2, tok = 'green', op = 0.45) => { const rnd = seeded(seed); return rep(n, () => f.ellipse(x0 + rnd() * (x1 - x0), y0 + rnd() * (y1 - y0), 0.8 + rnd() * 1.4, 0.3 + rnd() * 0.35, tok, { op: op * (0.7 + rnd() * 0.5) })); };
/** 로봇 팔이 비치는 공장 창(환한 창 + 팔 윤곽 — 일반형) */
export const armWindow = (x, y, w, h, pose = 0) => f.rect(x, y, w, h, 'glass', { op: 0.92 }) + f.line(`M${r1(x + w * 0.32)},${r1(y + h * 0.92)} V${r1(y + h * 0.55)} L${r1(x + w * (0.58 + pose * 0.12))},${r1(y + h * (0.32 - pose * 0.12))} v${r1(h * 0.18)}`, r1(w * 0.13), 'roof2') + f.rect(x + w * 0.16, y + h * 0.84, w * 0.32, h * 0.12, 'roof2');
/** 긴 공장동(어두운 벽 + 로봇 팔 창 줄 + 지붕 환기구) */
export const plantHall = (x, yBase, w, h, n, { seed = 3, roofTok = 'roof2', wallTok = 'cloth1' } = {}) => { const rnd = seeded(seed), cw = (w - 0.8) / n; return f.rect(x, yBase - h, w, h, wallTok) + f.rect(x - 0.2, yBase - h - 0.4, w + 0.4, 0.5, roofTok) + rep(n, (i) => armWindow(x + 0.4 + i * cw + cw * 0.12, yBase - h * 0.78, cw * 0.76, h * 0.5, Math.floor(rnd() * 3) - 1)) + rep(Math.max(1, Math.floor(w / 7)), (i) => f.rect(x + 2 + i * 7, yBase - h - 1.3, 1.2, 0.9, roofTok)); };
/** 컨베이어 줄(기둥 + 띠) */
export const conveyor = (x0, x1, y, h = 1.2) => f.rect(x0, y, x1 - x0, 0.35, 'far') + f.line(rep(Math.floor((x1 - x0) / 3) + 1, (i) => `M${r1(x0 + i * 3)},${r1(y + 0.35)} v${r1(h)}`), 0.2, 'roof2');
/** 빈 주차장(바탕 + 흰 칸 줄 — 차 0) */
export const parkingLot = (x, y, w, h, cols = 6, rows = 2) => f.rect(x, y, w, h, 'roof2', { op: 0.35 }) + f.line(rep(rows, (r) => rep(cols + 1, (c) => `M${r1(x + (c * w) / cols)},${r1(y + (r * h) / rows + 0.3)} v${r1(h / rows - 0.6)}`)), 0.14, 'cloth3', { op: 0.55 });
/** 빈 경비실(어두운 상자 + 꺼진 창) + 열린 게이트 막대 */
export const guardBox = (x, yBase, w = 3.2, h = 2.8) => f.rect(x, yBase - h, w, h, 'roof2') + f.rect(x + w * 0.2, yBase - h * 0.78, w * 0.6, h * 0.4, 'cloth1', { op: 0.9 }) + f.rect(x - 0.2, yBase - h - 0.35, w + 0.4, 0.4, 'ink', { op: 0.7 });

// ---------------------------------------------------------------- 강 · 유리 건물 · 다리 · 공원 (2075)
/** 강(평평한 물 면 — 평행사변형) */
export const riverBand = (pts, seed = 5, op = 0.6) => { const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]); return f.poly(pts, 'cloth4', { op }) + f.poly(pts, 'sky', { op: 0.25 }) + waves(Math.min(...xs) + 1, Math.max(...xs) - 1, Math.min(...ys) + 1, Math.max(...ys) - 1, 10, seed, 'cloth3', 0.35, 0.14); };
/** 유리 건물(밝은 면 + 가로 띠 + 위에 빛) */
export const glassTower = (x, yBase, w, h, { lit = true, tok = 'far2' } = {}) => f.rect(x, yBase - h, w, h, tok) + f.rect(x + 0.3, yBase - h + 0.4, w - 0.6, h - 0.6, lit ? 'glass' : 'far', { op: lit ? 0.75 : 0.5 }) + f.line(rep(Math.floor(h / 1.6), (i) => `M${r1(x + 0.3)},${r1(yBase - h + 0.9 + i * 1.6)} H${r1(x + w - 0.3)}`), 0.12, tok, { op: 0.9 }) + f.rect(x - 0.15, yBase - h - 0.3, w + 0.3, 0.35, 'hairw');
/** 다리(상판 + 난간 + 교각) */
export const bridge = (x0, x1, y, h = 1, piers = 2) => f.rect(x0, y, x1 - x0, h, 'far') + f.rect(x0, y - 0.5, x1 - x0, 0.3, 'hairw', { op: 0.9 }) + rep(piers, (i) => f.rect(x0 + ((x1 - x0) * (i + 1)) / (piers + 1) - 0.4, y + h, 0.8, 2.2, 'far', { op: 0.8 }));
/** 돌봄 로봇(둥근 머리 + 몸통 + 두 팔 + 바퀴 둘 — 일반형, 실존 기기 모사 0) */
export const careBot = (x, yBase, s = 3, dir = 1) => f.rect(x - s * 0.2, yBase - s * 0.74, s * 0.4, s * 0.52, 'hairw', { rx: r1(s * 0.14) }) + f.rect(x - s * 0.1, yBase - s * 0.62, s * 0.2, s * 0.12, 'cloth4', { rx: 0.08, op: 0.7 }) + f.circle(x, yBase - s * 0.9, s * 0.18, 'hairw') + f.circle(x + dir * s * 0.05, yBase - s * 0.9, s * 0.07, 'cloth4', { op: 0.6 }) + f.rect(x - s * 0.38, yBase - s * 0.66, s * 0.14, s * 0.34, 'hairw', { rx: 0.12 }) + f.rect(x + s * 0.24, yBase - s * 0.66, s * 0.14, s * 0.34, 'hairw', { rx: 0.12 }) + f.circle(x - s * 0.11, yBase - s * 0.1, s * 0.1, 'roof2') + f.circle(x + s * 0.11, yBase - s * 0.1, s * 0.1, 'roof2');
/** 호숫가 길(굽은 띠) */
export const curvePath = (d, w, tok = 'ground', op = 1) => f.line(d, w, tok, { op });

// ---------------------------------------------------------------- 광장 · 테라스 · 에너지 · 항만 (2080년대)
/** 군중의 띠(패턴 — 먼 군중 수백 명, 얼굴 0) */
export const crowdBand = (pts, op = 0.95) => f.poly(pts, 'roof2', { op: 0.25 }) + f.fillPath(`M${P(pts).join('L')}Z`, 'era-mass', { op });
/** 줄 선 먼 인물들 — (x0,y0)→(x1,y1) 선을 따라 n명(흔들림 jitter), 키 h. 질서 있는 줄(구호·충돌 0) */
export const farLine = (x0, y0, x1, y1, n, h, { seed = 1, jitter = 0.3, tops = ['cloth1', 'cloth4', 'roof2', 'hairw', 'cloth3', 'clay'], hairs = ['hair', 'ink', 'hairw'] } = {}) => { const rnd = seeded(seed); return f.line(`M${r1(x0)},${r1(y0)} L${r1(x1)},${r1(y1)}`, h * 0.5, 'roof2', { op: 0.1 }) + rep(n, (i) => { const t = (i + 0.2 + rnd() * 0.6) / n; return far(x0 + (x1 - x0) * t + (rnd() - 0.5) * jitter, y0 + (y1 - y0) * t + (rnd() - 0.5) * jitter, h * (0.9 + rnd() * 0.2), pick(rnd, tops), pick(rnd, hairs)); }); };
/** 접수 천막(천막 + 탁자 + 빈 판) */
export const intakeTent = (x, yBase, w, h) => f.rect(x, yBase - h, 0.35, h, 'roof2') + f.rect(x + w - 0.35, yBase - h, 0.35, h, 'roof2') + f.poly([[x - 0.5, yBase - h], [x + w + 0.5, yBase - h], [x + w, yBase - h - 1.4], [x, yBase - h - 1.4]], 'cloth3') + f.rect(x - 0.5, yBase - h - 0.1, w + 1, 0.4, 'cloth4', { op: 0.7 }) + f.rect(x + w * 0.1, yBase - h * 0.42, w * 0.8, 0.45, 'wood') + f.rect(x + w * 0.3, yBase - h - 1.2, w * 0.4, 0.9, 'cloth3', { rx: 0.1 });
/** 테라스 난간(가로대 + 가는 기둥) */
export const terraceRail = (x0, x1, y, h = 1.6, gap = 1.6) => f.line(rep(Math.floor((x1 - x0) / gap) + 1, (i) => `M${r1(x0 + i * gap)},${r1(y)} V${r1(y - h)}`), 0.14, 'hairw') + f.line(`M${r1(x0)},${r1(y - h)} H${r1(x1)}`, 0.3, 'hairw');
/** 양산·차양(기둥 + 둥근 천) */
export const parasol = (x, yBase, w, h, tok = 'cloth3') => f.rect(x - 0.12, yBase - h, 0.24, h, 'roof2') + f.path(`M${r1(x - w / 2)},${r1(yBase - h + 0.2)} Q${r1(x)},${r1(yBase - h - w * 0.45)} ${r1(x + w / 2)},${r1(yBase - h + 0.2)}Z`, tok, { op: 0.95 });
/** 태양광 지붕·벽(어두운 판 + 격자 빛) */
export const solarPanel = (x, y, w, h, cols = 4, rows = 2) => f.rect(x, y, w, h, 'cloth1', { op: 0.9 }) + f.line(`${rep(cols - 1, (i) => `M${r1(x + ((i + 1) * w) / cols)},${r1(y)} V${r1(y + h)}`)} ${rep(rows - 1, (i) => `M${r1(x)},${r1(y + ((i + 1) * h) / rows)} H${r1(x + w)}`)}`, 0.1, 'glass', { op: 0.75 }) + f.rect(x, y, w, h * 0.3, 'glass', { op: 0.18 });
/** 풍력 날개(기둥 + 허브 + 날개 셋) */
export const turbine = (x, yBase, h, a = 0, tok = 'cloth3') => { const hy = yBase - h, L = h * 0.42; return f.rect(x - h * 0.02, hy, h * 0.04, h, tok) + f.line(rep(3, (i) => { const t = ((a + i * 120) * Math.PI) / 180; return `M${r1(x)},${r1(hy)} L${r1(x + Math.cos(t) * L)},${r1(hy + Math.sin(t) * L)}`; }), r1(Math.max(0.12, h * 0.035)), tok) + f.circle(x, hy, h * 0.045, tok); };
/** 전기 버스(낮은 긴 몸체 + 창 띠 + 지붕 판) */
export const eBus = (x, yBase, w = 10, tok = 'cloth4') => { const h = w * 0.3; return f.rect(x, yBase - h, w, h - 0.3, tok, { rx: 0.5 }) + f.rect(x + 0.4, yBase - h * 0.85, w - 0.8, h * 0.42, 'glass') + f.rect(x + 0.6, yBase - h - 0.3, w - 1.2, 0.35, 'cloth1', { op: 0.8 }) + f.circle(x + w * 0.15, yBase - 0.1, h * 0.2, 'ink') + f.circle(x + w * 0.85, yBase - 0.1, h * 0.2, 'ink'); };
/** 충전 기둥(기둥 + 빛) */
export const chargePost = (x, yBase, h = 2.4) => f.rect(x - 0.3, yBase - h, 0.6, h, 'hairw', { rx: 0.15 }) + f.rect(x - 0.15, yBase - h + 0.4, 0.3, 0.5, 'green', { op: 0.9 });
/** 항만을 가르는 울타리 벽(기둥 + 판 — 높은 벽) */
export const splitFence = (x, y0, y1, w = 0.8) => f.rect(x - w / 2, y0, w, y1 - y0, 'roof2') + f.rect(x - w / 2 - 0.25, y0 - 0.3, w + 0.5, 0.4, 'ink') + f.line(rep(Math.floor((y1 - y0) / 1.6), (i) => `M${r1(x - w / 2)},${r1(y0 + 0.8 + i * 1.6)} h${r1(w)}`), 0.1, 'far', { op: 0.5 });
/** 작은 트럭 줄(옆, 한 방향으로 늘어섬) */
export const truckQueue = (x0, yBase, n, w, gap, dir = 1, toks = ['cloth4', 'hairw', 'cloth3', 'clay'], seed = 6) => { const rnd = seeded(seed); return rep(n, (i) => { const x = x0 + i * gap * dir, tok = pick(rnd, toks), h = w * 0.36; const cab = dir > 0 ? x + w * 0.72 : x, bed = dir > 0 ? x : x + w * 0.3; return f.rect(bed, yBase - h * 0.95, w * 0.7, h * 0.7, tok) + f.rect(cab, yBase - h * 1.02, w * 0.28, h * 0.78, 'roof2', { rx: 0.2 }) + f.circle(x + w * 0.2, yBase - 0.05, h * 0.2, 'ink') + f.circle(x + w * 0.8, yBase - 0.05, h * 0.2, 'ink'); }); };

// ---------------------------------------------------------------- 물 · 방벽 · 밤 (2090년대)
/** 물 위로 솟은 지붕(용마루까지 잠긴 집 — 지붕만) */
export const roofAbove = (x, yWater, w, h, tok = 'roof2') => f.poly([[x, yWater], [x + w * 0.5, yWater - h], [x + w, yWater]], tok) + f.ellipse(x + w * 0.5, yWater, w * 0.55, 0.22, 'cloth3', { op: 0.45 });
/** 물 위로 솟은 큰 건물 윗부분(학교 — 윗층 창 줄) */
export const blockAbove = (x, yWater, w, h, tok = 'wall2', n = 5) => f.rect(x, yWater - h, w, h, tok) + f.rect(x - 0.2, yWater - h - 0.45, w + 0.4, 0.5, 'roof2') + rep(n, (i) => f.rect(x + 0.5 + i * ((w - 1) / n), yWater - h * 0.7, (w - 1) / n - 0.5, h * 0.42, 'far', { op: 0.6 })) + f.ellipse(x + w * 0.5, yWater, w * 0.55, 0.25, 'cloth3', { op: 0.4 });
/** 이삿짐 트럭(상자 몸체 + 열린 뒷문) */
export const movingTruck = (x, yBase, w, dir = 1, tok = 'hairw') => { const h = w * 0.42; const cab = dir > 0 ? x + w * 0.74 : x, body = dir > 0 ? x : x + w * 0.26; return f.rect(body, yBase - h, w * 0.74, h - 0.3, tok, { rx: 0.2 }) + f.rect(body + (dir > 0 ? 0 : w * 0.6), yBase - h + 0.3, w * 0.14, h - 0.9, 'roof2', { op: 0.6 }) + f.rect(cab, yBase - h * 0.72, w * 0.26, h * 0.72 - 0.3, 'cloth4', { rx: 0.3 }) + f.rect(cab + w * 0.06, yBase - h * 0.68, w * 0.14, h * 0.26, 'glass') + f.circle(x + w * 0.16, yBase - 0.05, h * 0.2, 'ink') + f.circle(x + w * 0.84, yBase - 0.05, h * 0.2, 'ink'); };
/** 거대한 방벽(굽은 벽 + 머리 산책로 + 세로 이음선) */
export const seaWall = (d, top, y1, { tok = 'far', edgeTok = 'hairw' } = {}) => f.path(`${d} V${r1(y1)} H0Z`, tok) + f.path(`${d} V${r1(y1)} H0Z`, 'cloth3', { op: 0.18 }) + f.path(`${top}`, 'cloth3', { op: 0.9 }) + f.line(rep(13, (i) => `M${r1(i * 3.3)},${r1(y1 - 0.2)} v-5`), 0.08, 'roof2', { op: 0.3 });
/** 수문(방벽의 어두운 칸 + 기둥 둘) */
export const floodGate = (x, y, w, h) => f.rect(x, y, w, h, 'roof2') + f.rect(x + 0.3, y + 0.3, w - 0.6, h - 0.6, 'cloth1', { op: 0.9 }) + f.rect(x - 0.5, y - 1.2, 0.7, h + 1.2, 'hairw') + f.rect(x + w - 0.2, y - 1.2, 0.7, h + 1.2, 'hairw');
/** 전차(낮은 긴 몸체 + 창 띠 + 지붕 집전 막대) */
export const tram = (x, yBase, w = 9, tok = 'cloth3') => { const h = w * 0.26; return f.rect(x, yBase - h, w, h - 0.2, tok, { rx: 0.4 }) + f.rect(x + 0.4, yBase - h * 0.85, w - 0.8, h * 0.45, 'glass') + f.rect(x, yBase - h * 0.35, w, h * 0.12, 'cloth4', { op: 0.8 }) + f.line(`M${r1(x + w * 0.5)},${r1(yBase - h)} l-0.8,-1.2`, 0.12, 'roof2'); };
/** 밤 노점(천막 + 매대 + 등불) */
export const nightStall = (x, yBase, w, h, tok = 'clay') => f.rect(x, yBase - h, 0.3, h, 'roof2') + f.rect(x + w - 0.3, yBase - h, 0.3, h, 'roof2') + f.poly([[x - 0.4, yBase - h], [x + w + 0.4, yBase - h], [x + w, yBase - h - 1.1], [x, yBase - h - 1.1]], tok) + f.rect(x + 0.2, yBase - h * 0.5, w - 0.4, h * 0.5, 'wood') + f.rect(x + 0.4, yBase - h * 0.5 - 0.5, w - 0.8, 0.5, 'glass', { op: 0.9 }) + f.circle(x + w * 0.5, yBase - h + 0.6, 0.35, 'glass') + f.circle(x + w * 0.5, yBase - h + 0.6, 1.4, 'glass', { op: 0.16 });
/** 냉각 안개 기둥 여럿은 r7 `mistPost` 그대로 */

// ---------------------------------------------------------------- 2100년대
/** 철거 중인 빈 타워(어두운 창 + 윗부분 일부 해체 — 들쭉날쭉한 윗선) */
export const emptyTower = (x, yBase, w, h, cut = 0.2, tok = 'far') => { const top = yBase - h; return f.poly([[x, yBase], [x, top + h * cut], [x + w * 0.3, top + h * cut], [x + w * 0.3, top + h * cut * 0.5], [x + w * 0.65, top + h * cut * 0.5], [x + w * 0.65, top + h * cut * 0.8], [x + w, top + h * cut * 0.8], [x + w, yBase]], tok) + f.fill(x + 0.3, top + h * cut + 0.5, w - 0.6, h * (1 - cut) - 0.8, 'era-windows', { op: 0.4 }) + f.rect(x + 0.3, top + h * cut + 0.5, w - 0.6, h * (1 - cut) - 0.8, 'ink', { op: 0.22 }) + f.line(`M${r1(x + w * 0.3)},${r1(top + h * cut * 0.5)} V${r1(top + h * cut)} M${r1(x + w * 0.65)},${r1(top + h * cut * 0.8)} V${r1(top + h * cut)}`, 0.12, 'roof2', { op: 0.6 }); };
/** 타워 크레인(마스트 + 지브 + 평형추 + 줄) */
export const towerCrane = (x, yBase, h, arm, dir = 1, tok = 'cloth2') => f.rect(x - 0.25, yBase - h, 0.5, h, tok) + f.rect(x - (dir > 0 ? arm * 0.25 : arm), yBase - h - 0.4, arm * 1.25, 0.4, tok) + f.rect(x - 0.6, yBase - h - 1.2, 1.2, 0.8, tok) + f.line(`M${r1(x + dir * arm * 0.7)},${r1(yBase - h)} V${r1(yBase - h * 0.45)} M${r1(x)},${r1(yBase - h - 1.2)} L${r1(x + dir * arm)},${r1(yBase - h - 0.4)}`, 0.1, 'ink', { op: 0.6 }) + f.rect(x + dir * arm * 0.7 - 0.5, yBase - h * 0.45, 1, 0.6, 'roof2');
/** 멈춘 분수(둥근 못 + 가운데 기둥, 물줄기 0) */
export const fountainOff = (x, y, rx, ry) => f.ellipse(x, y, rx, ry, 'far') + f.ellipse(x, y, rx * 0.85, ry * 0.82, 'cloth4', { op: 0.5 }) + f.rect(x - 0.3, y - ry * 1.3, 0.6, ry * 1.3, 'far');
/** 별(흩어진 점) */
export const stars = (n, x0, x1, y0, y1, seed = 11, tok = 'cloth3') => { const rnd = seeded(seed); return rep(n, () => f.circle(x0 + rnd() * (x1 - x0), y0 + rnd() * (y1 - y0), 0.1 + rnd() * 0.14, tok, { op: 0.4 + rnd() * 0.5 })); };
/** 정거장 빛줄(완만한 호를 따라 줄지어 지나는 밝은 점들) */
export const stationTrail = (x0, x1, y, n, bow = 2, tok = 'glass', r = 0.3) => f.line(`M${r1(x0)},${r1(y)} Q${r1((x0 + x1) / 2)},${r1(y - bow * 2)} ${r1(x1)},${r1(y)}`, 0.12, tok, { op: 0.35 }) + rep(n, (i) => { const t = i / (n - 1), x = x0 + (x1 - x0) * t, yy = y - Math.sin(t * Math.PI) * bow; return f.circle(x, yy, r, tok) + f.circle(x, yy, r * 2.4, tok, { op: 0.22 }); });
/** 달(밝은 원 + 곁의 작은 구조물 빛) */
export const moonWith = (x, y, r) => f.circle(x, y, r, 'glass') + f.circle(x, y, r * 1.8, 'glass', { op: 0.12 }) + f.rect(x + r * 1.4, y - r * 0.2, r * 0.5, r * 0.18, 'glass', { op: 0.9 }) + f.rect(x + r * 1.1, y + r * 0.6, r * 0.3, r * 0.14, 'glass', { op: 0.8 });
/** 어깨 위에 아이를 태운 뒷모습(먼 인물 + 작은 머리·몸) */
export const shoulderKid = (x, yBase, h, top = 'cloth4', hair = 'hair', kidTok = 'clay') => far(x, yBase, h, top, hair) + f.rect(x - h * 0.09, yBase - h - h * 0.16, h * 0.18, h * 0.2, kidTok, { rx: 0.2 }) + f.circle(x, yBase - h - h * 0.22, h * 0.08, hair);
/** 발사장 윤곽(먼 탑 + 비스듬한 구조물) */
export const launchSite = (x, yBase, h) => f.rect(x, yBase - h, h * 0.18, h, 'roof2', { op: 0.8 }) + f.rect(x + h * 0.28, yBase - h * 0.7, h * 0.3, h * 0.7, 'roof2', { op: 0.7 }) + f.line(`M${r1(x + h * 0.18)},${r1(yBase - h * 0.9)} H${r1(x + h * 0.32)}`, 0.2, 'roof2', { op: 0.8 });
/** 수평선으로 사라지는 가로등 줄(소실점 vp를 향해 작아진다) */
export const lampPersp = (x0, y0, vp, n, h0, lit = true) => rep(n, (i) => { const t = i / n, k = 1 - t ** 0.75, x = x0 + (vp[0] - x0) * (1 - k), y = y0 + (vp[1] - y0) * (1 - k), h = h0 * k; if (h < 0.3) return ''; return f.rect(x - h * 0.03, y - h, h * 0.06, h, 'roof2', { op: 0.5 + k * 0.5 }) + f.circle(x, y - h - h * 0.05, h * 0.07, lit ? 'glass' : 'far') + (lit ? f.circle(x, y - h, h * 0.2, 'glass', { op: 0.14 }) : ''); });
