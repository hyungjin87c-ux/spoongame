/**
 * SPEC-010 「시대의 창」 r8 — 미래 연표 묶음 C(2060~2109 + 끝 장면, U27~U44)의 소품 (designer 2026-11-03).
 * r7 도우미(`eraR7Lib.mjs` → r6 → r5b → r5 → r4 → r3 → r2)를 그대로 쓰고, 2060년 이후 장면에 필요한 것만 더한다:
 *   화면 속 윤곽 둘(눈코입 없는 머리·어깨 — 하나는 찬 면, 하나는 점선 윤곽), 열쇠 모양 표지, 책장 벽, 이동 진료 차량(차양·측면 창구), 닫힌 가게(셔터 + 문의 빈 판),
 *   사무실 책상 줄(모니터·앉은 뒷모습), 횡단보도 줄무늬, 신호등 기둥, 차단 막대, 거리 위 그늘 천, 체육관 백보드, 매트와 담요 줄, 높은 창(비), 물길(잠긴 길),
 *   제방·펌프장, 모래주머니 줄, 난간, 바다, 열린 작업장, 오래된 지도 종이(색 윤곽, 글자 0), 밭 구획, 물에 잠긴 기둥.
 * 색은 `--c-scene-*` 25 토큰만(새 토큰 0). 글자·숫자·로고·국기·지도(나라) 0. 사람은 r4 심볼(뒷모습·옆모습·먼 인물, 얼굴 0)만 — 새 심볼 0, 새 패턴 0.
 * 수위(SPEC-010 「그림 수위」 1·2·4·6): 디지털 인간은 윤곽 둘(원본과 닮은 얼굴 비교 0, 시술 근접 0) · 재난은 현장까지(물에 휩쓸림·구조·쓰러진 사람 0) · 공포 연출(붉은 하늘·과장된 불길) 0 · 2060년 이후 기술은 생활 속 작은 변화로만(실존 기기 모사 0).
 */
import { f, rep, far, seeded, pick, rain, waves } from './eraR7Lib.mjs';
export * from './eraR7Lib.mjs';

const r1 = (n) => Math.round(n * 100) / 100;

// ---------------------------------------------------------------- 화면 · 방 (2065)
/** 머리·어깨 윤곽 하나(눈코입 0) — solid면 찬 면, 아니면 점선 윤곽 */
const bust = (cx, yTop, h, tok, solid = true) => {
  const hr = h * 0.17, sw = h * 0.5, sy = yTop + hr * 2.2;
  return solid
    ? f.circle(cx, yTop + hr, hr, tok, { op: 0.85 }) + f.rect(cx - sw / 2, sy, sw, h - (sy - yTop), tok, { rx: r1(sw * 0.3), op: 0.85 })
    : f.line(`M${r1(cx - hr)},${r1(yTop + hr)} a${r1(hr)},${r1(hr)} 0 1 1 ${r1(hr * 2)},0 a${r1(hr)},${r1(hr)} 0 1 1 ${r1(-hr * 2)},0 M${r1(cx - sw / 2)},${r1(yTop + h)} V${r1(sy + sw * 0.3)} q0,${r1(-sw * 0.3)} ${r1(sw * 0.3)},${r1(-sw * 0.3)} h${r1(sw * 0.4)} q${r1(sw * 0.3)},0 ${r1(sw * 0.3)},${r1(sw * 0.3)} V${r1(yTop + h)}`, 0.22, tok, { dash: '0.5 0.35', op: 0.9 });
};
/** 상담실 벽 화면 — 윤곽 둘(왼쪽 찬 면 · 오른쪽 점선 윤곽)과 둘 사이의 짧은 점선. 글자·숫자 0 */
export const twinScreen = (x, y, w, h) => f.rect(x, y, w, h, 'ink', { rx: 0.25 }) + f.rect(x + 0.35, y + 0.35, w - 0.7, h - 0.7, 'roof2') + f.rect(x + 0.35, y + 0.35, w - 0.7, h - 0.7, 'glass', { op: 0.08 })
  + bust(x + w * 0.3, y + h * 0.2, h * 0.62, 'cloth4', true) + bust(x + w * 0.7, y + h * 0.2, h * 0.62, 'glass', false)
  + f.line(`M${r1(x + w * 0.43)},${r1(y + h * 0.5)} H${r1(x + w * 0.57)}`, 0.18, 'glass', { dash: '0.4 0.4', op: 0.7 })
  + rep(3, (i) => f.rect(x + w * (0.08 + i * 0.1), y + h * 0.88, w * 0.07, h * 0.05, i < 2 ? 'green' : 'glass', { rx: 0.08, op: 0.8 }));
/** 서재 화면 — 윤곽 하나 + 모서리의 열쇠 모양 표지(글자 0) */
export const studyScreen = (x, y, w, h) => f.rect(x, y, w, h, 'ink', { rx: 0.25 }) + f.rect(x + 0.3, y + 0.3, w - 0.6, h - 0.6, 'roof2') + f.rect(x + 0.3, y + 0.3, w - 0.6, h - 0.6, 'glass', { op: 0.08 })
  + bust(x + w * 0.42, y + h * 0.2, h * 0.6, 'cloth4', true) + keyMark(x + w * 0.8, y + h * 0.3, h * 0.26, 'glass');
/** 열쇠 모양 표지(고리 + 자루 + 이 둘) — 「지켜 둔 것」의 표지, 글자 0 */
export const keyMark = (cx, cy, s, tok = 'glass') => f.line(`M${r1(cx - s * 0.3)},${r1(cy)} a${r1(s * 0.3)},${r1(s * 0.3)} 0 1 1 ${r1(s * 0.6)},0 a${r1(s * 0.3)},${r1(s * 0.3)} 0 1 1 ${r1(-s * 0.6)},0 M${r1(cx)},${r1(cy + s * 0.3)} V${r1(cy + s * 1.3)} M${r1(cx)},${r1(cy + s * 0.95)} h${r1(s * 0.3)} M${r1(cx)},${r1(cy + s * 1.25)} h${r1(s * 0.42)}`, r1(s * 0.16), tok, { op: 0.9 });
/** 책장 벽(선반 rows단 — 공유 패턴 era-books) */
export const bookWall = (x, y, w, h, rows = 4) => f.rect(x, y, w, h, 'wood') + rep(rows, (r) => { const rh = h / rows; return f.fill(x + 0.35, y + r * rh + 0.3, w - 0.7, rh - 0.75, 'era-books', { op: 0.9 }) + f.rect(x, y + (r + 1) * rh - 0.4, w, 0.4, 'wood'); });
/** 스탠드 등(가는 기둥 + 갓 + 빛) */
export const floorLamp = (x, yBase, h, lit = true) => f.ellipse(x, yBase, 0.9, 0.25, 'roof2') + f.rect(x - 0.1, yBase - h, 0.2, h, 'roof2') + f.poly([[x - 1.3, yBase - h + 1.8], [x + 1.3, yBase - h + 1.8], [x + 0.9, yBase - h - 0.4], [x - 0.9, yBase - h - 0.4]], 'cloth3') + (lit ? f.circle(x, yBase - h + 1.4, 2.6, 'glass', { op: 0.16 }) : '');
/** 커튼(한쪽) */
export const curtain = (x, y, w, h, tok = 'cloth3') => f.rect(x, y, w, h, tok, { op: 0.92 }) + f.line(rep(3, (i) => `M${r1(x + w * (0.25 + i * 0.25))},${r1(y + 0.4)} V${r1(y + h - 0.4)}`), 0.12, 'far', { op: 0.35 });

// ---------------------------------------------------------------- 동네 · 거리 (2060~2080년대)
/** 이동 진료 차량(옆 — 운전석 작은 칸 + 긴 상자 몸체 + 열린 측면 창구 + 펼친 차양 + 계단). 표장·글자·로고 0(몸체의 띠는 빈 면) */
export const clinicVan = (x, yBase, w, dir = 1) => {
  const h = w * 0.36, bx = dir > 0 ? x + w * 0.22 : x, bw = w * 0.78, cx = dir > 0 ? x : x + w * 0.78, cw = w * 0.22;
  return f.rect(bx, yBase - h - 0.4, bw, h, 'hairw', { rx: 0.3 }) + f.rect(cx, yBase - h * 0.72 - 0.4, cw, h * 0.72, 'hairw', { rx: 0.4 }) + f.rect(dir > 0 ? cx + 0.4 : cx + cw * 0.3, yBase - h * 0.68 - 0.4, cw * 0.55, h * 0.3, 'glass')
    + f.rect(bx, yBase - h * 0.52 - 0.4, bw, h * 0.14, 'cloth4', { op: 0.75 }) + f.rect(bx + bw * 0.34, yBase - h * 0.44 - 0.4, bw * 0.34, h * 0.08, 'cloth3', { op: 0.8 })
    + f.rect(bx + bw * 0.1, yBase - h * 0.92 - 0.4, bw * 0.46, h * 0.5, 'glass') + f.rect(bx + bw * 0.1, yBase - h * 0.92 - 0.4, bw * 0.46, h * 0.5, 'cloth4', { op: 0.12 }) + f.rect(bx + bw * 0.08, yBase - h * 0.42 - 0.4, bw * 0.5, 0.45, 'wood')
    + f.poly([[bx + bw * 0.04, yBase - h - 0.6], [bx + bw * 0.62, yBase - h - 0.6], [bx + bw * 0.62 + 4.2, yBase - h + 1.2], [bx + bw * 0.04 + 4.2, yBase - h + 1.2]], 'cloth4', { op: 0.85 })
    + f.line(`M${r1(bx + bw * 0.08 + 4.2)},${r1(yBase - h + 1.2)} V${r1(yBase)} M${r1(bx + bw * 0.58 + 4.2)},${r1(yBase - h + 1.2)} V${r1(yBase)}`, 0.2, 'roof2')
    + f.rect(bx + bw * 0.12, yBase - 1.3, bw * 0.3, 0.5, 'roof2') + f.rect(bx + bw * 0.14, yBase - 0.7, bw * 0.26, 0.5, 'roof2')
    + f.circle(x + w * 0.16, yBase - 0.1, w * 0.06, 'ink') + f.circle(x + w * 0.82, yBase - 0.1, w * 0.06, 'ink') + f.circle(x + w * 0.16, yBase - 0.1, w * 0.022, 'hairw') + f.circle(x + w * 0.82, yBase - 0.1, w * 0.022, 'hairw');
};
/** 접이식 탁자(상판 + X 다리) */
export const foldTable = (x, yBase, w, h = 2.6) => f.rect(x, yBase - h, w, 0.4, 'cloth3') + f.line(`M${r1(x + 0.5)},${r1(yBase - h + 0.4)} L${r1(x + 1.6)},${r1(yBase)} M${r1(x + 1.6)},${r1(yBase - h + 0.4)} L${r1(x + 0.5)},${r1(yBase)} M${r1(x + w - 0.5)},${r1(yBase - h + 0.4)} L${r1(x + w - 1.6)},${r1(yBase)} M${r1(x + w - 1.6)},${r1(yBase - h + 0.4)} L${r1(x + w - 0.5)},${r1(yBase)}`, 0.16, 'roof2');
/** 가게 한 칸(간판 띠는 빈 면) — open이면 유리 안이 환하다, 아니면 셔터 + 문의 빈 판(쪽지) */
export const shopUnit = (x, y, w, h, { open = false, tok = 'cloth4', note = true } = {}) => f.rect(x, y, w, h * 0.2, tok) + f.rect(x + w * 0.2, y + h * 0.05, w * 0.6, h * 0.1, 'cloth3', { op: 0.35 })
  + (open ? f.rect(x, y + h * 0.22, w, h * 0.78, 'glass') + f.rect(x, y + h * 0.22, w, h * 0.78, 'cloth3', { op: 0.3 }) + f.rect(x + w * 0.15, y + h * 0.45, w * 0.7, h * 0.3, 'far', { op: 0.25 })
    : f.rect(x, y + h * 0.22, w, h * 0.78, 'far2') + f.fill(x, y + h * 0.22, w, h * 0.78, 'era-shutter') + (note ? f.rect(x + w * 0.36, y + h * 0.5, w * 0.28, h * 0.22, 'cloth3', { rx: 0.1 }) : ''));
/** 사무실 책상 줄 — 긴 책상 + 모니터 n + 앉은 뒷모습(머리색 목록) + 의자 등받이 */
export const officeRow = (x0, yBase, n, gap, h, { hairs = ['hairw', 'hair', 'hairw', 'ink', 'roof2'], tops = ['cloth3', 'cloth4', 'hairw', 'cloth1'], seed = 4 } = {}) => {
  const rnd = seeded(seed), w = (n - 1) * gap + gap * 0.9;
  return f.rect(x0 - gap * 0.45, yBase - h * 0.62, w, 0.45, 'cloth3') + f.rect(x0 - gap * 0.45, yBase - h * 0.62 + 0.45, w, 0.3, 'far', { op: 0.5 })
    + rep(n, (i) => { const x = x0 + i * gap; return f.rect(x - gap * 0.26, yBase - h * 1.02, gap * 0.52, h * 0.38, 'ink', { rx: 0.1 }) + f.rect(x - gap * 0.22, yBase - h * 0.99, gap * 0.44, h * 0.3, 'glass') + f.rect(x - gap * 0.22, yBase - h * 0.99, gap * 0.44, h * 0.3, 'cloth4', { op: 0.15 }); })
    + rep(n, (i) => { const x = x0 + i * gap + (rnd() - 0.5) * 0.3; return far(x, yBase - 0.2, h * (0.9 + rnd() * 0.12), pick(rnd, tops), pick(rnd, hairs)) + f.rect(x - gap * 0.2, yBase - h * 0.42, gap * 0.4, h * 0.3, 'cloth4', { rx: 0.3, op: 0.85 }); });
};
/** 횡단보도(기운 줄무늬 n개) */
export const zebra = (x, y, w, h, n, skew = 0) => rep(n, (i) => { const sw = w / (n * 2 - 1), sx = x + i * sw * 2; return f.poly([[sx, y], [sx + sw, y], [sx + sw + skew, y + h], [sx + skew, y + h]], 'cloth3', { op: 0.85 }); });
/** 신호등 기둥(기둥 + 가로대 + 등 상자 셋 — 일반형) */
export const signalPole = (x, yBase, h, dir = 1) => f.rect(x - 0.18, yBase - h, 0.36, h, 'roof2') + f.rect(dir > 0 ? x : x - h * 0.4, yBase - h - 0.3, h * 0.4, 0.3, 'roof2') + f.rect(dir > 0 ? x + h * 0.4 - 0.5 : x - h * 0.4, yBase - h - 0.2, 1.1, 0.5, 'ink', { rx: 0.1 }) + f.circle(dir > 0 ? x + h * 0.4 - 0.25 : x - h * 0.4 + 0.25, yBase - h + 0.05, 0.14, 'green') + f.circle(dir > 0 ? x + h * 0.4 + 0.35 : x - h * 0.4 + 0.85, yBase - h + 0.05, 0.14, 'far');
/** 건물 벽의 큰 화면(색 블록만 — 글자 0) */
export const facadeScreen = (x, y, w, h) => f.rect(x, y, w, h, 'ink') + f.rect(x + 0.2, y + 0.2, w - 0.4, h - 0.4, 'glass', { op: 0.9 }) + f.rect(x + w * 0.1, y + h * 0.2, w * 0.5, h * 0.55, 'cloth4', { op: 0.6 }) + f.rect(x + w * 0.65, y + h * 0.3, w * 0.25, h * 0.45, 'green', { op: 0.5 });
/** 차단 막대(기둥 둘 + 가로 막대 — 밝은 바탕에 어두운 칸) */
export const barrierGate = (x, yBase, w, h = 2.4) => f.rect(x - 0.3, yBase - h, 0.6, h, 'roof2') + f.rect(x + w - 0.3, yBase - h, 0.6, h, 'roof2') + f.rect(x, yBase - h + 0.4, w, 0.6, 'cloth3') + rep(Math.floor(w / 2.4), (i) => f.rect(x + 1.2 + i * 2.4, yBase - h + 0.4, 1, 0.6, 'ink', { op: 0.8 }));
/** 원근 거리 벽 위의 가게 한 칸(간판 띠 + 내린 셔터) — side -1 왼쪽 벽 / 1 오른쪽 벽. vp = [vx, vy], 벽 끝 x = ex(끝 벽의 가장자리). perspDoor와 같은 벽 기하 */
export const perspShop = (x0, x1, side, vp, ex, tok = 'cloth4') => {
  const vy = vp[1]; const top = (x) => (side < 0 ? (x / ex) * vy : ((40 - x) / (40 - ex)) * vy); const bot = (x) => (side < 0 ? 32 - (x / ex) * (32 - (vy + 6.4)) : 32 - ((40 - x) / (40 - ex)) * (32 - (vy + 6.4)));
  const t0 = top(x0), t1 = top(x1), b0 = bot(x0), b1 = bot(x1); const s0 = t0 + (b0 - t0) * 0.42, s1 = t1 + (b1 - t1) * 0.42, u0 = t0 + (b0 - t0) * 0.52, u1 = t1 + (b1 - t1) * 0.52;
  const d = `M${r1(x0)},${r1(u0)} L${r1(x1)},${r1(u1)} L${r1(x1)},${r1(b1)} L${r1(x0)},${r1(b0)}Z`;
  return f.poly([[x0, s0], [x1, s1], [x1, u1], [x0, u0]], tok, { op: 0.85 }) + f.path(d, 'far2') + f.fillPath(d, 'era-shutter') + f.poly([[x0 + (x1 - x0) * 0.4, u0 + (b0 - u0) * 0.45], [x1 - (x1 - x0) * 0.4, u1 + (b1 - u1) * 0.45], [x1 - (x1 - x0) * 0.4, u1 + (b1 - u1) * 0.7], [x0 + (x1 - x0) * 0.4, u0 + (b0 - u0) * 0.7]], 'cloth3', { op: 0.9 });
};
/** 거리 위에 친 그늘 천(건물 사이 — 깊이에 따라 작아진다) */
export const canopyStrips = (y0, y1, n, xL = (t) => 0, xR = (t) => 40, tok = 'cloth3') => rep(n, (i) => { const t = i / Math.max(1, n - 1), y = y0 + (y1 - y0) * t, h = 1.6 - t * 1.1; return f.poly([[xL(t), y], [xR(t), y], [xR(t), y + h], [xL(t) + (xR(t) - xL(t)) * 0.5, y + h + h * 0.35], [xL(t), y + h]], tok, { op: 0.9 - t * 0.25 }); });

// ---------------------------------------------------------------- 체육관 · 물 (2090년대)
/** 백보드(기둥 + 판 + 고리) */
export const backboard = (x, yBase, h, dir = 1) => f.rect(x - 0.25, yBase - h, 0.5, h, 'roof2') + f.rect(x + dir * 0.2 - (dir > 0 ? 0 : 3.2), yBase - h - 0.3, 3.2, 2.4, 'cloth3', { rx: 0.1 }) + f.rect(x + dir * 0.2 - (dir > 0 ? 0 : 3.2) + 0.9, yBase - h + 0.3, 1.4, 1, 'far', { op: 0.5 }) + f.ellipse(x + dir * 1.8, yBase - h + 1.9, 0.7, 0.22, 'clay') + f.line(rep(4, (i) => `M${r1(x + dir * 1.8 - 0.6 + i * 0.4)},${r1(yBase - h + 1.95)} v0.8`), 0.08, 'cloth3', { op: 0.7 });
/** 매트와 담요 줄 — n장(매트 밑면 + 담요 + 베개). 앉은 사람은 호출자가 따로 */
export const matRow = (x0, y, n, w, h, seed = 3, gap = 0.6) => { const rnd = seeded(seed); return rep(n, (i) => { const x = x0 + i * (w + gap), bl = pick(rnd, ['cloth1', 'clay', 'cloth4', 'green']); return f.rect(x, y, w, h, 'cloth3', { rx: 0.2 }) + f.rect(x + 0.25, y + h * 0.35, w - 0.5, h * 0.55, bl, { rx: 0.25, op: 0.85 }) + f.rect(x + 0.4, y + 0.2, w * 0.35, h * 0.22, 'hairw', { rx: 0.2 }); }); };
/** 높은 창 띠(틀 + 칸 n — 밖은 회색 하늘) */
export const highWindows = (x, y, w, h, n) => f.rect(x, y, w, h, 'far') + rep(n, (i) => { const cw = (w - 0.3) / n; return f.rect(x + 0.3 + i * cw, y + 0.3, cw - 0.3, h - 0.6, 'sky') + f.rect(x + 0.3 + i * cw, y + 0.3, cw - 0.3, h - 0.6, 'far', { op: 0.35 }); });
/** 물(잠긴 길·물길) — 평평한 면 + 잔물결. 흐름·휩쓸림 0 */
export const water = (x, y, w, h, seed = 2, op = 0.7) => f.rect(x, y, w, h, 'cloth4', { op }) + f.rect(x, y, w, h, 'sky', { op: 0.2 }) + waves(x + 0.5, x + w - 0.5, y + 0.3, y + h - 0.3, Math.max(3, Math.round(w * h / 9)), seed, 'cloth3', 0.4, 0.14);
/** 물에 잠긴 기둥(물 위로 솟은 부분만) */
export const drownedPost = (x, yWater, h, tok = 'roof2') => f.rect(x - 0.16, yWater - h, 0.32, h, tok) + f.ellipse(x, yWater, 0.7, 0.18, 'cloth3', { op: 0.5 });
/** 제방 벽(콘크리트 벽 + 머리 + 비탈) */
export const floodWall = (x, y, w, h) => f.poly([[x, y + h], [x + w, y + h], [x + w, y], [x, y]], 'far') + f.rect(x - 0.2, y - 0.4, w + 0.4, 0.5, 'hairw') + f.line(rep(Math.floor(w / 3), (i) => `M${r1(x + 1.5 + i * 3)},${r1(y)} V${r1(y + h)}`), 0.08, 'roof2', { op: 0.35 });
/** 펌프장(작은 상자 건물 + 굵은 관 둘 + 환기구) */
export const pumpHouse = (x, yBase, w) => f.rect(x, yBase - w * 0.7, w, w * 0.7, 'wall2') + f.rect(x - 0.2, yBase - w * 0.7 - 0.4, w + 0.4, 0.5, 'roof2') + f.rect(x + w * 0.15, yBase - w * 0.5, w * 0.25, w * 0.25, 'far', { op: 0.6 }) + f.line(`M${r1(x + w)},${r1(yBase - w * 0.3)} h${r1(w * 0.6)} v${r1(w * 0.3)} M${r1(x + w)},${r1(yBase - w * 0.15)} h${r1(w * 0.45)} v${r1(w * 0.15)}`, 0.5, 'roof2') + f.rect(x + w * 0.6, yBase - w * 0.7 - 1.1, w * 0.12, 0.8, 'roof2');
/** 모래주머니 줄(rows단, 엇갈린 자루) */
export const sandbags = (x0, x1, yBase, rows = 2, seed = 5, bw = 1.5, bh = 0.8) => { const rnd = seeded(seed), n = Math.floor((x1 - x0) / bw); return rep(rows, (r) => rep(n - (r % 2), (i) => f.rect(x0 + i * bw + (r % 2) * bw * 0.5, yBase - (r + 1) * bh, bw - 0.12, bh - 0.08, pick(rnd, ['ground2', 'cloth3', 'ground']), { rx: 0.35 }))); };
/** 난간(기둥 + 가로대 둘) */
export const guardrail = (x0, x1, y, h = 1.8, gap = 2.4) => f.line(rep(Math.floor((x1 - x0) / gap) + 1, (i) => `M${r1(x0 + i * gap)},${r1(y)} V${r1(y - h)}`), 0.2, 'hairw') + f.line(`M${r1(x0)},${r1(y - h)} H${r1(x1)} M${r1(x0)},${r1(y - h * 0.5)} H${r1(x1)}`, 0.22, 'hairw');
/** 바다(수평선 아래의 면 + 잔물결 + 수평선 가까이 밝은 띠) */
export const sea = (y, h, seed = 7, op = 0.55) => f.rect(0, y, 40, h, 'cloth4', { op }) + f.rect(0, y, 40, Math.min(1.2, h), 'glass', { op: 0.22 }) + waves(0, 40, y + 1, y + h - 0.5, Math.round(h * 2.2), seed, 'cloth3', 0.4, 0.16);
/** 열린 작업장(셔터를 올린 문 안이 환하다 — 작업대·선반·조명. 사람은 호출자가) */
export const workshopOpen = (x, y, w, h) => f.rect(x, y, w, h, 'wall2') + f.rect(x, y, w, h, 'roof2', { op: 0.45 }) + f.rect(x + w * 0.1, y + h * 0.18, w * 0.8, h * 0.82, 'glass') + f.rect(x + w * 0.1, y + h * 0.18, w * 0.8, h * 0.82, 'cloth3', { op: 0.25 }) + f.rect(x + w * 0.1, y + h * 0.12, w * 0.8, h * 0.08, 'roof2') + f.rect(x + w * 0.1, y + h * 0.2, w * 0.8, 0.3, 'glass', { op: 0.9 })
  + f.rect(x + w * 0.16, y + h * 0.3, w * 0.3, h * 0.35, 'wall2', { op: 0.7 }) + f.rect(x + w * 0.22, y + h * 0.72, w * 0.56, 0.45, 'wood') + f.line(`M${r1(x + w * 0.26)},${r1(y + h * 0.72 + 0.45)} V${r1(y + h)} M${r1(x + w * 0.74)},${r1(y + h * 0.72 + 0.45)} V${r1(y + h)}`, 0.25, 'wood');
/** 오래된 지도 종이(기운 종이 + 색 윤곽 하나 — 땅과 바다, 글자 0). 특정 나라·한반도 모양이 아니다 */
export const mapSheet = (x, y, w, h, a = -8) => { const tr = `rotate(${a} ${r1(x)} ${r1(y)})`; return f.rect(x, y, w, h, 'cloth3', { tr }) + f.rect(x, y, w, h, 'ground2', { op: 0.35, tr }) + f.path(`M${r1(x + w * 0.55)},${r1(y)} q${r1(-w * 0.2)},${r1(h * 0.2)} ${r1(-w * 0.05)},${r1(h * 0.4)} q${r1(w * 0.15)},${r1(h * 0.2)} ${r1(-w * 0.1)},${r1(h * 0.35)} q${r1(-w * 0.05)},${r1(h * 0.15)} ${r1(w * 0.05)},${r1(h * 0.25)} H${r1(x + w)} V${r1(y)}Z`, 'cloth4', { op: 0.55, tr }) + f.line(`M${r1(x + w * 0.55)},${r1(y)} q${r1(-w * 0.2)},${r1(h * 0.2)} ${r1(-w * 0.05)},${r1(h * 0.4)} q${r1(w * 0.15)},${r1(h * 0.2)} ${r1(-w * 0.1)},${r1(h * 0.35)} q${r1(-w * 0.05)},${r1(h * 0.15)} ${r1(w * 0.05)},${r1(h * 0.25)}`, 0.16, 'cloth1', { op: 0.7 }) + f.line(`M${r1(x + w * 0.1)},${r1(y + h * 0.15)} v${r1(h * 0.7)}`, 0.1, 'far', { op: 0.5 }); };
/** 밭 구획(원근 — rows줄 × cols칸, 칸마다 다른 작물 색과 줄) */
export const plots = (yTop, yBot, rows, cols, seed = 9, toks = ['green', 'cloth2', 'clay', 'ground2', 'green', 'wall2']) => {
  const rnd = seeded(seed), xl = (t) => 20 - (6 + 14 * t) * 1.5, xr = (t) => 20 + (6 + 14 * t) * 1.5;
  return rep(rows, (r) => { const t0 = r / rows, t1 = (r + 1) / rows, y0 = yTop + (yBot - yTop) * t0 ** 1.4, y1 = yTop + (yBot - yTop) * t1 ** 1.4; return rep(cols, (c) => { const a = c / cols, b = (c + 1) / cols, tok = pick(rnd, toks), op = 0.35 + rnd() * 0.35; const p = [[xl(t0) + (xr(t0) - xl(t0)) * a, y0], [xl(t0) + (xr(t0) - xl(t0)) * b, y0], [xl(t1) + (xr(t1) - xl(t1)) * b, y1], [xl(t1) + (xr(t1) - xl(t1)) * a, y1]]; return f.poly(p, tok, { op }) + (rnd() < 0.5 ? f.line(rep(3, (k) => { const s = (k + 0.5) / 3; return `M${r1(p[0][0] + (p[3][0] - p[0][0]) * s)},${r1(y0 + (y1 - y0) * s)} H${r1(p[1][0] + (p[2][0] - p[1][0]) * s)}`; }), 0.14, 'ground2', { op: 0.5 }) : ''); }); });
};
/** 휠체어(옆 — 큰 바퀴 + 작은 바퀴 + 좌석. 사람은 호출자가 far로) */
export const wheelchair = (x, yBase, s = 3, dir = 1) => f.circle(x, yBase - s * 0.32, s * 0.32, 'roof2') + f.circle(x, yBase - s * 0.32, s * 0.22, 'wall2', { op: 0.6 }) + f.circle(x + dir * s * 0.55, yBase - s * 0.14, s * 0.14, 'roof2') + f.rect(x - dir * s * 0.1 - (dir > 0 ? s * 0.4 : 0), yBase - s * 0.7, s * 0.5, s * 0.14, 'cloth4', { rx: 0.1 }) + f.rect(x - dir * s * 0.42 - (dir > 0 ? s * 0.12 : 0), yBase - s * 1.2, s * 0.12, s * 0.6, 'cloth4', { rx: 0.1 });
/** 벽 손잡이(요양 시설 복도·휴게실) */
export const handrail = (x0, x1, y) => f.line(`M${r1(x0)},${r1(y)} H${r1(x1)}`, 0.34, 'wood') + f.line(rep(Math.floor((x1 - x0) / 5) + 1, (i) => `M${r1(x0 + 1 + i * 5)},${r1(y)} v0.8`), 0.2, 'roof2');
/** 학생 책상 하나(상판 + 다리 둘) — 앉은 사람은 호출자가 far로 */
export const schoolDesk = (x, yBase, w) => f.rect(x - w / 2, yBase - w * 0.42, w, w * 0.11, 'wood') + f.line(`M${r1(x - w * 0.4)},${r1(yBase - w * 0.31)} V${r1(yBase)} M${r1(x + w * 0.4)},${r1(yBase - w * 0.31)} V${r1(yBase)}`, r1(w * 0.05), 'wood');
/** 낮은 집(벽 + 지붕 + 창 하나) — 낮은 동네 */
export const lowHouse = (x, yBase, w, h, tok = 'wall2', roofTok = 'roof2') => f.rect(x, yBase - h, w, h, tok) + f.poly([[x - 0.3, yBase - h], [x + w + 0.3, yBase - h], [x + w * 0.5, yBase - h - w * 0.42]], roofTok) + f.rect(x + w * 0.36, yBase - h * 0.75, w * 0.28, h * 0.38, 'far', { op: 0.55 });
