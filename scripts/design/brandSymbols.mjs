/**
 * 심볼 도형 (512×512 좌표계). 전부 단색 하나(+투명 구멍)로 만들어서, 색은 SVG의 fill 하나로 바꾼다(라이트·다크·단색).
 *
 * 확정안(형진 님 선택, 2026-10-15): **A 「담긴 땅」** — 비스듬히 선 숟가락. 둥근 머리 안에 한반도와 섬이 비어(구멍) 있다. 도장(印)을 찍은 자국처럼도 읽힌다.
 *   - 정식 심볼(symbolA): 머리 안 지도의 높이가 머리 높이의 70% 이상(REV-003-D-1 R-128 조건). 제주·울릉도·독도 포함.
 *   - 단순화 심볼(symbolA({small:true})): 헤더(40px)·파비콘(16~32px)용. 지도 윤곽을 14점으로 줄이고 섬을 생략해, 작은 크기에서
 *     「금 간 숟가락·번개·열쇠」로 읽히지 않게 한다. 머리를 키우고 자루를 조금 줄인다.
 * 고르지 않은 B 「상 위에」·C 「상차림」은 ARCHIVED에만 남겨 둔다(buildBrand.mjs는 만들지 않는다. 파일은 docs/design/archive/brand-bc/).
 *
 * 숟가락은 모두 같은 도형(spoonPath)이다: 한국 숟가락 — 거의 둥근 머리, 분명한 목, 길고 곧은 자루, 끝이 살짝 넓어진다.
 * 수저 5단계 아이콘(mockLib.mjs SPRITE의 sp-1~5)도 같은 비례를 쓴다. 목의 보조점 오프셋은 머리 폭의 비율이라 어떤 크기에서도 viewBox 안에 든다(R-120).
 *
 * 윤곽 방향: 바깥 도형은 시계 방향, 구멍은 반시계(fill-rule nonzero). 심볼 하나는 path 하나다(tests/designAssets.test.ts).
 */
import { ISLANDS, PENINSULA, SIMPLE_PENINSULA, project, relax, smoothClosed } from './geo.mjs';

const f = (v) => Math.round(v * 10) / 10;

/** 윤곽 점(평면 단위). 가볍게 한 번 다듬는다 — 더 세게 다듬으면 호미곶·태안반도 같은 특징이 사라진다 */
const PEN = relax(PENINSULA.map(project), 0.12);
/** 단순화 윤곽(평면 단위). 세게 다듬어 매끈한 덩어리로 */
const PEN_SIMPLE = relax(SIMPLE_PENINSULA.map(project), 0.22);

function mapBounds(pts, withIslands) {
  const minX = Math.min(...pts.map((p) => p[0]));
  const topY = Math.min(...pts.map((p) => p[1]));
  let maxX = Math.max(...pts.map((p) => p[0]));
  let maxY = Math.max(...pts.map((p) => p[1]));
  if (withIslands) {
    const [, jy] = project([ISLANDS.jeju.lon, ISLANDS.jeju.lat]);
    maxY = Math.max(maxY, jy + ISLANDS.jeju.ry);
    const [dx] = project([ISLANDS.dokdo.lon, ISLANDS.dokdo.lat]);
    maxX = Math.max(maxX, dx + ISLANDS.dokdo.r);
  }
  return { minX, topY, maxX, maxY, w: maxX - minX, h: maxY - topY };
}
const BOUNDS_FULL = mapBounds(PEN, true);
const BOUNDS_SIMPLE = mapBounds(PEN_SIMPLE, false);

function ellipsePath(cx, cy, rx, ry, cw) {
  const sw = cw ? 1 : 0;
  return `M${f(cx - rx)} ${f(cy)}a${f(rx)} ${f(ry)} 0 1 ${sw} ${f(rx * 2)} 0a${f(rx)} ${f(ry)} 0 1 ${sw} ${f(-rx * 2)} 0Z`;
}

/** 절대 좌표 명령(M·L·C·Z)만 쓰는 path의 좌표를 변환 */
export function transformPath(d, fn) {
  return d.replace(/([MLC])([^MLCZ]*)/g, (_, cmd, args) => {
    const n = args.trim().split(/[\s,]+/).map(Number);
    const out = [];
    for (let i = 0; i < n.length; i += 2) {
      const [x, y] = fn(n[i], n[i + 1]);
      out.push(`${f(x)} ${f(y)}`);
    }
    return cmd + out.join(' ');
  });
}

/** 절대 좌표 path(M·L·C·Z·a)의 모든 좌표 쌍 [x, y] — 테스트·경계 점검용 (a 명령은 상대 좌표라 건너뛴다) */
export function pathPoints(d) {
  const out = [];
  for (const m of d.matchAll(/([MLC])([^A-Za-z]*)/g)) {
    const n = m[2].trim().split(/[\s,]+/).map(Number);
    for (let i = 0; i + 1 < n.length; i += 2) out.push([n[i], n[i + 1]]);
  }
  return out;
}

/**
 * 지도 도형.
 * @param s 위도 1°당 px, tx·ty 이동(단위 좌표 0,0이 놓일 px), cw 윤곽의 회전 방향(true=시계)
 * @param islandBoost 울릉도·독도 확대, jejuBoost 제주 확대, equalPair 울릉도·독도를 같은 크기로(옛 C안)
 * @param simple 단순화 윤곽(14점, 섬 없음)
 */
export function map({ s, tx, ty, cw = true, islandBoost = 1, jejuBoost = 1, equalPair = false, islandsCw = cw, simple = false }) {
  const t = ([x, y]) => [x * s + tx, y * s + ty];
  const src = simple ? PEN_SIMPLE : PEN;
  const pts = (cw ? src : [...src].reverse()).map(t);
  const land = smoothClosed(pts, 0.5);
  if (simple) return { land, jeju: '', ulleung: '', dokdo: '', islands: [], t, pos: {}, outline: pts };
  const j = ISLANDS.jeju;
  const [jx, jy] = t(project([j.lon, j.lat]));
  const jeju = ellipsePath(jx, jy, j.rx * 0.788 * s * jejuBoost, j.ry * s * jejuBoost, islandsCw);
  const u = ISLANDS.ulleung;
  const dk = ISLANDS.dokdo;
  const [ux, uy] = t(project([u.lon, u.lat]));
  const [dx, dy] = t(project([dk.lon, dk.lat]));
  const ur = u.r * s * islandBoost;
  const dr = (equalPair ? u.r : dk.r) * s * islandBoost;
  const ulleung = ellipsePath(ux, uy, ur, ur, islandsCw);
  const dokdo = ellipsePath(dx, dy, dr, dr, islandsCw);
  // 경계 점검용 점: 윤곽 + 섬의 상하좌우 끝
  const outline = [
    ...pts,
    ...[[jx - j.rx * 0.788 * s * jejuBoost, jy], [jx + j.rx * 0.788 * s * jejuBoost, jy], [jx, jy - j.ry * s * jejuBoost], [jx, jy + j.ry * s * jejuBoost]],
    ...[[ux - ur, uy], [ux + ur, uy], [ux, uy - ur], [ux, uy + ur]],
    ...[[dx - dr, dy], [dx + dr, dy], [dx, dy - dr], [dx, dy + dr]],
  ];
  return { land, jeju, ulleung, dokdo, islands: [jeju, ulleung, dokdo], t, pos: { jeju: [jx, jy], ulleung: [ux, uy], dokdo: [dx, dy] }, outline };
}

/** 지도를 (x0,y0)~(x0+w, y0+h) 상자에 비율 유지로 맞추는 s·tx·ty */
function fitMap(x0, y0, w, h, b = BOUNDS_FULL) {
  const s = Math.min(w / b.w, h / b.h);
  const tx = x0 + (w - b.w * s) / 2 - b.minX * s;
  const ty = y0 + (h - b.h * s) / 2 - b.topY * s;
  return { s, tx, ty, mapW: b.w * s, mapH: b.h * s };
}

// ---------- 숟가락 윤곽 ----------
/**
 * 세로 숟가락(머리 위, 자루 아래), 가운데 x=cx, 시계 방향, 절대 좌표 M·C·L·Z만 쓴다(transformPath로 돌릴 수 있다).
 * 비례(한국 숟가락): 머리 폭 w, 머리 높이 h ≈ 1.1w, 목 폭 ≈ 0.13w, 자루 길이 ≈ 2.1h, 자루 끝 폭 ≈ 0.3w.
 * 모든 보조점은 w·h의 비율이다(고정 px 없음) — 20×32 아이콘에서도 좌표가 머리 폭 밖으로 나가지 않는다(R-120).
 */
export function spoonPath({ cx = 256, top = 20, w = 240, h = 264, neck = 30, handleLen = 520, endW = 68, neckLen = 44 }) {
  const rw = w / 2;
  const nw = neck / 2;
  const ew = endW / 2;
  const widest = top + h * 0.47; // 머리의 가장 넓은 곳
  const bottom = top + h; // 머리 아래 끝(목 시작)
  const neckEnd = bottom + neckLen; // 목이 자루 굵기로 안정되는 곳
  const endY = neckEnd + handleLen; // 자루 끝
  const hw = nw * 1.15; // 자루 기본 반폭(목보다 아주 조금 굵다)
  const flareStart = neckEnd + handleLen * 0.55; // 여기서부터 끝까지 서서히 넓어진다
  const tipTop = endY - ew; // 둥근 끝이 시작하는 높이
  const c1y = flareStart + (tipTop - flareStart) * 0.6;
  const c2y = tipTop - (tipTop - flareStart) * 0.25;
  const K = 0.552; // 원호 베지어 상수
  const nk1 = w * (10 / 240); // 목 시작점이 목 폭보다 살짝 넓은 정도 (머리 폭 비율)
  const nk2 = w * (3 / 240);
  const right = [
    `M${f(cx)} ${f(top)}`,
    // 머리 오른쪽: 위에서 가장 넓은 곳까지 둥글게
    `C${f(cx + rw * 0.58)} ${f(top)} ${f(cx + rw)} ${f(top + h * 0.17)} ${f(cx + rw)} ${f(widest)}`,
    // 가장 넓은 곳에서 목으로 모임 (안쪽으로 오목하게 꺾여 목이 분명하다)
    `C${f(cx + rw)} ${f(widest + h * 0.33)} ${f(cx + rw * 0.62)} ${f(bottom - h * 0.04)} ${f(cx + nw + nk1)} ${f(bottom)}`,
    `C${f(cx + nw + nk2)} ${f(bottom + neckLen * 0.25)} ${f(cx + nw)} ${f(bottom + neckLen * 0.5)} ${f(cx + nw)} ${f(neckEnd)}`,
    // 자루: 곧게 내려가며 끝으로 갈수록 살짝 넓어진다
    `L${f(cx + hw)} ${f(flareStart)}`,
    `C${f(cx + hw)} ${f(c1y)} ${f(cx + ew)} ${f(c2y)} ${f(cx + ew)} ${f(tipTop)}`,
    // 끝: 반원 마무리
    `C${f(cx + ew)} ${f(tipTop + ew * K)} ${f(cx + ew * K)} ${f(endY)} ${f(cx)} ${f(endY)}`,
  ];
  const left = [
    `C${f(cx - ew * K)} ${f(endY)} ${f(cx - ew)} ${f(tipTop + ew * K)} ${f(cx - ew)} ${f(tipTop)}`,
    `C${f(cx - ew)} ${f(c2y)} ${f(cx - hw)} ${f(c1y)} ${f(cx - hw)} ${f(flareStart)}`,
    `L${f(cx - nw)} ${f(neckEnd)}`,
    `C${f(cx - nw)} ${f(bottom + neckLen * 0.5)} ${f(cx - nw - nk2)} ${f(bottom + neckLen * 0.25)} ${f(cx - nw - nk1)} ${f(bottom)}`,
    `C${f(cx - rw * 0.62)} ${f(bottom - h * 0.04)} ${f(cx - rw)} ${f(widest + h * 0.33)} ${f(cx - rw)} ${f(widest)}`,
    `C${f(cx - rw)} ${f(top + h * 0.17)} ${f(cx - rw * 0.58)} ${f(top)} ${f(cx)} ${f(top)}`,
    'Z',
  ];
  return [...right, ...left].join('');
}

/** 젓가락 한 짝(가로, 왼쪽이 굵은 쪽). 시계 방향 (옛 C안) */
function chopstick(xL, xR, y, tL, tR) {
  return `M${f(xL)} ${f(y - tL / 2)}L${f(xR)} ${f(y - tR / 2)}L${f(xR)} ${f(y + tR / 2)}L${f(xL)} ${f(y + tL / 2)}Z`;
}

/** (x,y)를 (ox,oy) 중심으로 deg만큼 돌린다 (SVG 좌표: 양수 = 시계 방향으로 보인다) */
function rotator(ox, oy, deg) {
  const a = (deg * Math.PI) / 180;
  const c = Math.cos(a);
  const s = Math.sin(a);
  return (x, y) => [ox + x * c - y * s, oy + x * s + y * c];
}

// ---------- A 「담긴 땅」 (확정) ----------
/** A안의 기울기(도). 정사각 안에서 자루를 머리보다 충분히 길게 두기 위한 값 */
export const TILT_DEG = 35;

/**
 * 비스듬히 선 숟가락(머리 오른쪽 위, 자루 왼쪽 아래). 머리 안에 한반도와 섬이 똑바로 선 채 구멍으로 들어간다.
 * 기울인 이유: 정사각 안에서 자루를 머리보다 충분히 길게(≈1.25배) 둘 수 있어 손거울·막대사탕이 아니라 숟가락으로 읽힌다.
 * 반환: { d, fillRule, metrics } — metrics.mapToBowl = 지도 높이 / 머리 높이 (정식 심볼은 0.70 이상이어야 한다, R-128).
 * small: 단순화 심볼 — 머리를 키우고(256) 자루를 줄이며(230), 지도는 14점 윤곽, 섬 없음.
 */
export function symbolA({ small = false } = {}) {
  const bowlW = small ? 256 : 218;
  const bowlH = bowlW * 1.1;
  const handleLen = small ? 230 : 300;
  const cx = small ? 318 : 322;
  const cy = small ? 150 : 138;
  const rot = rotator(cx, cy, TILT_DEG);
  // 단순화판은 자루를 조금 굵게(28px에서 1px 선으로 끊기지 않게)
  const neck = bowlW * (small ? 0.17 : 0.14);
  const endW = bowlW * (small ? 0.34 : 0.3);
  // 머리 중심(가장 넓은 곳)을 원점으로 둔 세로 숟가락을 돌린다
  const v = spoonPath({ cx: 0, top: -bowlH * 0.47, w: bowlW, h: bowlH, neck, neckLen: bowlW * 0.16, handleLen, endW });
  const spoon = transformPath(v, rot);
  // 머리만(경계 점검용) — 같은 변환
  const bowlOnly = transformPath(spoonPath({ cx: 0, top: -bowlH * 0.47, w: bowlW, h: bowlH, neck, neckLen: bowlW * 0.16, handleLen: 0.01, endW }), rot);
  // 지도(똑바로): 머리 안쪽 상자에 맞춘다. 높이가 머리 높이의 74%가 되게(폭은 비율상 50%쯤이라 제약이 되지 않는다).
  // 머리 중심보다 살짝 왼쪽 위에 두어 울릉도·독도가 오른쪽 가장자리에 붙지 않게 한다.
  const ratio = small ? 0.72 : 0.74;
  const bw = bowlW * 0.72;
  const bh = bowlH * ratio;
  const fit = fitMap(cx - bw / 2 - bowlW * 0.035, cy - bh / 2 - bowlH * 0.015, bw, bh, small ? BOUNDS_SIMPLE : BOUNDS_FULL);
  const m = map({ s: fit.s, tx: fit.tx, ty: fit.ty, cw: false, islandBoost: 1, jejuBoost: 1.2, simple: small });
  const d = small ? [spoon, m.land].join('') : [spoon, m.land, m.jeju, m.ulleung, m.dokdo].join('');
  return {
    d,
    fillRule: 'nonzero',
    metrics: { bowlW, bowlH, mapW: fit.mapW, mapH: fit.mapH, mapToBowl: fit.mapH / bowlH, handleLen, tilt: TILT_DEG, bowlPath: bowlOnly, mapOutline: m.outline, islands: !small },
  };
}

/** 섬 면적(평면 단위², 정식 심볼의 보정 포함) — 제주 ≥ 울릉도 × 2, 독도 < 울릉도 (R-129) */
export function islandMetrics() {
  const jejuBoost = 1.2;
  const j = ISLANDS.jeju;
  const jeju = Math.PI * (j.rx * 0.788 * jejuBoost) * (j.ry * jejuBoost);
  const ulleung = Math.PI * ISLANDS.ulleung.r ** 2;
  const dokdo = Math.PI * ISLANDS.dokdo.r ** 2;
  return { jeju, ulleung, dokdo, jejuToUlleung: jeju / ulleung, dokdoToUlleung: dokdo / ulleung };
}

// ---------- 보관(선택되지 않음): B 「상 위에」, C 「상차림」 ----------
/** B: 위에서 내려다본 밥상 — 왼쪽 한반도, 오른쪽 숟가락과 젓가락 한 벌(세로). 기록용 */
function symbolB({ small = false } = {}) {
  const mapW = small ? 300 : 286;
  const { s, tx, ty } = fitMap(small ? 8 : 16, small ? 20 : 26, mapW, small ? 472 : 460);
  const m = map({ s, tx, ty, cw: true, islandBoost: small ? 2.2 : 1.5, jejuBoost: small ? 1.3 : 1.1 });
  const top = small ? 24 : 28;
  const bottom = small ? 492 : 486;
  const bowlW = small ? 92 : 78;
  const bowlH = bowlW * 1.1;
  const spoonX = small ? 372 : 366;
  const spoon = spoonPath({ cx: spoonX, top, w: bowlW, h: bowlH, neck: bowlW * 0.15, neckLen: bowlW * 0.18, handleLen: bottom - top - bowlH - bowlW * 0.18, endW: bowlW * 0.32 });
  const t0 = small ? 20 : 15;
  const t1 = small ? 11 : 8;
  const x1 = spoonX + bowlW / 2 + (small ? 30 : 26);
  const x2 = x1 + (small ? 34 : 28);
  const stick = (x) => `M${f(x - t1 / 2)} ${f(top + bowlH * 0.3)}L${f(x + t1 / 2)} ${f(top + bowlH * 0.3)}L${f(x + t0 / 2)} ${f(bottom)}L${f(x - t0 / 2)} ${f(bottom)}Z`;
  return { d: [m.land, m.jeju, m.ulleung, m.dokdo, spoon, stick(x1), stick(x2)].join(''), fillRule: 'nonzero' };
}

/** C: 한반도 아래에 수저 한 벌이 가로로. 기록용 */
function symbolC({ small = false } = {}) {
  const mapH = small ? 318 : 334;
  const { s, tx, ty } = fitMap(small ? 96 : 118, small ? 4 : 6, small ? 400 : 376, mapH);
  const m = map({ s, tx, ty, cw: true, islandBoost: small ? 2.3 : 1.5, jejuBoost: small ? 1.3 : 1.1, equalPair: true });
  const mapBottom = (small ? 4 : 6) + mapH;
  const xL = small ? 56 : 72;
  const xR = small ? 456 : 440;
  const spoonY = mapBottom + (small ? 50 : 44);
  const bowlW = small ? 92 : 80;
  const bowlH = bowlW * 1.08;
  const v = spoonPath({ cx: 0, top: 0, w: bowlW, h: bowlH, neck: bowlW * 0.15, neckLen: bowlW * 0.18, handleLen: xR - xL - bowlH - bowlW * 0.18, endW: bowlW * 0.32 });
  const spoon = transformPath(v, (x, y) => [xR - y, spoonY + x]);
  const gap = small ? 30 : 26;
  const t0 = small ? 20 : 16;
  const t1 = small ? 11 : 8;
  const tip = xR - bowlH * 0.38;
  const sticks = [chopstick(xL, tip, spoonY + bowlW / 2 + gap, t0, t1), chopstick(xL, tip, spoonY + bowlW / 2 + gap + (small ? 34 : 30), t0, t1)];
  return { d: [m.land, m.jeju, m.ulleung, m.dokdo, spoon, ...sticks].join(''), fillRule: 'nonzero' };
}

/** 만드는 안(확정 A만). buildBrand.mjs가 이 목록을 돈다 */
export const OPTIONS = {
  a: { name: '담긴 땅', fn: symbolA },
};
/** 고르지 않은 안(기록용, 파일은 만들지 않는다) */
export const ARCHIVED = {
  b: { name: '상 위에', fn: symbolB },
  c: { name: '상차림', fn: symbolC },
};
