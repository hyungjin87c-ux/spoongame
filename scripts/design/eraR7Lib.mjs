/**
 * SPEC-010 「시대의 창」 r7 — 미래 연표 묶음 B(2040~2059, U13~U26)의 소품 (designer 2026-11-03).
 * r6 도우미(`eraR6Lib.mjs` → r5b → r5 → r4 → r3 → r2)를 그대로 쓰고, 2040·2050년대 장면에 필요한 것만 더한다:
 *   계단식 강의실 책상 줄(빈 의자), 겹쳐 붙인 안내판, 팔 윤곽 화면(색 블록), 머리 뒤 기기 띠(일반형), 병상·침상 모니터, 틈 난 진열대와 빈 가격표, 장바구니 카트,
 *   밤 아파트(불 켜진 창 몇 개만), 배달 로봇(상자꼴), 그네·미끄럼틀·모래밭, 그늘막, 닫힌 블라인드, 부채, 여행 가방, 줄 기둥, 멀리 보이는 비행기, 컨테이너선,
 *   사과나무 줄과 과일 상자, 비닐하우스, 전봇대 확성기와 소리 호, 냉각 안개 기둥, 쌓아 둔 책상, 빈 화이트보드, 꺼진 냉방기.
 * 색은 `--c-scene-*` 25 토큰만(새 토큰 0). 글자·숫자·로고·국기·지도 0. 사람은 r4 심볼(뒷모습·옆모습·먼 인물, 얼굴 0)만 — 새 심볼 0, 새 패턴 0.
 * 수위(SPEC-010 「그림 수위」 1~6): 젊은 얼굴·늙은 얼굴 대비 0 · 시술·주사 근접 0 · 기기는 일반형 윤곽 · 국기·지도·군사 장비 0 · 공포 연출(붉은 하늘·과장된 불길) 0 · 순간(쓰러짐·구조) 0.
 * 2040·2050년대의 소품은 지금의 일반형을 조금 늘린 모습(실존 로봇·기기 모사 0): 그늘막·냉각 안개 기둥·배달 로봇·지붕 태양광 판·벽 화면.
 */
import { f, rep, person, far, seeded, pick } from './eraR6Lib.mjs';
export * from './eraR6Lib.mjs';

const r1 = (n) => Math.round(n * 100) / 100;

// ---------------------------------------------------------------- 학교 · 강의실
/** 계단식 강의실 책상 줄(뒤에서 앞을 본다 — 위가 멀다): rows줄, 줄마다 긴 책상 띠 + 빈 의자 등받이(줄마다 path 하나). 사람은 호출자가 `far`로 앉힌다 */
export const lectureRows = (rows, { yTop = 12, yBot = 30, hwTop = 10, hwBot = 22, cx = 20, deskTok = 'wood', chairTok = 'cloth4', skip = [] } = {}) => rep(rows, (i) => {
  const t = rows > 1 ? i / (rows - 1) : 1, y = yTop + (yBot - yTop) * t ** 1.3, hw = hwTop + (hwBot - hwTop) * t, dh = 0.45 + 0.5 * t, cw = 1.15 + 1.3 * t, ch = 0.85 + 1 * t, gap = cw * 1.4;
  const n = Math.floor((hw * 2 - cw) / gap) + 1, x0 = cx - ((n - 1) * gap + cw) / 2;
  const chairs = rep(n, (k) => (skip.some(([r, c]) => r === i && c === k) ? '' : `M${r1(x0 + k * gap)},${r1(y - 0.1)}h${r1(cw)}v${r1(-ch)}h${r1(-cw)}Z`));
  return (chairs ? f.path(chairs, chairTok) : '') + f.poly([[cx - hw, y], [cx + hw, y], [cx + hw + 0.4, y + dh], [cx - hw - 0.4, y + dh]], deskTok) + f.rect(cx - hw - 0.4, y + dh, hw * 2 + 0.8, dh * 0.55, 'roof2', { op: 0.3 });
});
/** 겹쳐 붙인 안내판(빈 판 둘 — 큰 판 위에 작은 판을 덧붙였다: 「합친 안내판」) */
export const mergedBoard = (x, y, w, h) => f.rect(x, y, w, h, 'wood', { rx: 0.15 }) + f.rect(x + 0.35, y + 0.35, w - 0.7, h - 0.7, 'cloth3') + f.rect(x + w * 0.1, y + h * 0.2, w * 0.55, h * 0.5, 'hairw', { op: 0.8 }) + f.rect(x + w * 0.38, y + h * 0.38, w * 0.52, h * 0.5, 'cloth3') + f.rect(x + w * 0.38, y + h * 0.38, w * 0.52, h * 0.1, 'cloth4', { op: 0.6 }) + f.rect(x + w * 0.1, y + h * 0.2, w * 0.55, h * 0.1, 'far', { op: 0.6 });
/** 빈 화이트보드(틀 + 흰 면 + 받침 턱) */
export const whiteboard = (x, y, w, h) => f.rect(x, y, w, h, 'far', { rx: 0.15 }) + f.rect(x + 0.3, y + 0.3, w - 0.6, h - 0.6, 'cloth3') + f.rect(x + w * 0.1, y + h, w * 0.8, 0.35, 'far');
/** 쌓아 둔 책상(뒤집어 n개 — 다리가 위로) + 겹친 의자 둘 */
export const stackedDesks = (x, yBase, n = 3, w = 5) => rep(n, (i) => f.rect(x, yBase - (i + 1) * 1.1, w, 0.55, 'wood') + f.line(`M${r1(x + 0.6)},${r1(yBase - (i + 1) * 1.1)} v${r1(-0.5)} M${r1(x + w - 0.6)},${r1(yBase - (i + 1) * 1.1)} v${r1(-0.5)}`, 0.2, 'roof2')) + f.rect(x + w + 0.6, yBase - 3.2, 1.8, 3.2, 'cloth4', { rx: 0.2 }) + f.rect(x + w + 0.9, yBase - 3.8, 1.8, 3.2, 'cloth4', { rx: 0.2, op: 0.85 });

// ---------------------------------------------------------------- 병원 · 재활
/** 팔 윤곽 화면(재활 — 팔 두 마디와 관절, 아래 진행 블록, 글자·숫자 0) */
export const armScreen = (x, y, w, h) => f.rect(x, y, w, h, 'ink', { rx: 0.25 }) + f.rect(x + 0.35, y + 0.35, w - 0.7, h - 0.7, 'glass') + f.rect(x + 0.35, y + 0.35, w - 0.7, h - 0.7, 'cloth4', { op: 0.12 })
  // 어깨·몸통 덩이 → 위팔(가로) → 팔꿈치 → 아래팔(위로 든다) → 손(둥근 점): 사람 팔의 윤곽으로만 읽히게
  + f.rect(x + w * 0.1, y + h * 0.26, w * 0.14, h * 0.4, 'cloth4', { rx: 0.5, op: 0.55 }) + f.circle(x + w * 0.17, y + h * 0.2, h * 0.07, 'cloth4', { op: 0.55 })
  + f.rect(x + w * 0.2, y + h * 0.36, w * 0.32, h * 0.13, 'cloth4', { rx: 0.5 }) + f.rect(x + w * 0.46, y + h * 0.1, w * 0.12, h * 0.36, 'cloth4', { rx: 0.5, tr: `rotate(22 ${r1(x + w * 0.52)} ${r1(y + h * 0.42)})` })
  + f.circle(x + w * 0.52, y + h * 0.42, h * 0.065, 'glass') + f.circle(x + w * 0.52, y + h * 0.42, h * 0.035, 'cloth1') + f.circle(x + w * 0.66, y + h * 0.12, h * 0.07, 'cloth4')
  + rep(5, (i) => f.rect(x + w * 0.12 + i * w * 0.16, y + h * 0.74, w * 0.12, h * 0.1, i < 3 ? 'green' : 'far', { rx: 0.1, op: i < 3 ? 0.9 : 0.5 }));
/** 머리 뒤의 기기 띠(일반형 윤곽 — 머리 가운데 (hx, hy) 반지름 hr): 뒤통수를 가로지르는 밝은 띠 + 작은 모듈. 시술·근접 0 */
export const headBand = (hx, hy, hr) => f.line(`M${r1(hx - hr * 0.95)},${r1(hy - hr * 0.05)} q${r1(hr * 0.95)},${r1(hr * 0.45)} ${r1(hr * 1.9)},0`, r1(hr * 0.22), 'hairw') + f.rect(hx - hr * 0.22, hy + hr * 0.02, hr * 0.44, hr * 0.34, 'roof2', { rx: 0.08 });
/** 병상(옆에서 — 머리 쪽이 x 쪽, 올린 등받이) + 이불 + 베개 + 뒤통수만 보이는 머리 */
export const hospitalBed = (x, yBase, w, { hair = 'hairw', blanket = 'cloth4' } = {}) => {
  const h = w * 0.22;
  return f.rect(x, yBase - h - 0.6, w, 0.5, 'hairw') + f.line(`M${r1(x + 0.8)},${r1(yBase - 0.1)} V${r1(yBase - h - 0.6)} M${r1(x + w - 0.8)},${r1(yBase - 0.1)} V${r1(yBase - h - 0.6)}`, 0.3, 'far') + f.rect(x + 0.3, yBase - h - 1.6, w - 0.6, 1.1, 'cloth3', { rx: 0.3 })
    + f.poly([[x + 0.3, yBase - h - 1.6], [x + w * 0.22, yBase - h - 1.6], [x + w * 0.22, yBase - h - 4.6], [x + 0.6, yBase - h - 4.2]], 'cloth3') + f.rect(x + w * 0.24, yBase - h - 2.4, w * 0.74, 1.9, blanket, { rx: 0.5 }) + f.rect(x + w * 0.24, yBase - h - 2.4, w * 0.74, 0.35, 'cloth3', { op: 0.45 })
    + f.rect(x + w * 0.06, yBase - h - 3.9, w * 0.17, 1.4, 'cloth3', { rx: 0.4 }) + f.circle(x + w * 0.17, yBase - h - 3.1, w * 0.045, hair);
};
/** 침상 곁 모니터(기둥 + 작은 화면의 색 블록 — 숫자 0) */
export const bedMonitor = (x, yBase, h) => f.rect(x - 0.15, yBase - h, 0.3, h, 'far') + f.ellipse(x, yBase, 1, 0.25, 'far') + f.rect(x - 1.5, yBase - h - 2.2, 3, 2.2, 'ink', { rx: 0.15 }) + f.rect(x - 1.3, yBase - h - 2, 2.6, 1.8, 'roof2') + f.rect(x - 1.1, yBase - h - 1.7, 1.2, 0.3, 'green', { op: 0.9 }) + f.rect(x - 1.1, yBase - h - 1.1, 1.8, 0.3, 'cloth4', { op: 0.9 }) + f.rect(x - 1.1, yBase - h - 0.5, 0.9, 0.3, 'glass', { op: 0.9 });
/** 진찰·접수 데스크 뒤의 벽 화면(색 블록 셋 — 글자 0) */
export const wallScreen = (x, y, w, h, toks = ['cloth4', 'green', 'cloth1']) => f.rect(x, y, w, h, 'ink', { rx: 0.2 }) + f.rect(x + 0.3, y + 0.3, w - 0.6, h - 0.6, 'glass') + rep(3, (i) => f.rect(x + w * (0.12 + i * 0.28), y + h * 0.25, w * 0.2, h * 0.5, toks[i], { rx: 0.15, op: 0.85 }));

// ---------------------------------------------------------------- 마트 · 가게
/** 틈이 난 진열대(rows단 — 자리마다 물건이 있거나 비었다, fill 비율) + 단마다 가격표 띠(빈 종이) */
export const gapShelf = (x, y, w, h, rows = 4, seed = 7, fill = 0.62, toks = ['clay', 'cloth4', 'green', 'cloth2', 'hairw', 'cloth1']) => {
  const rnd = seeded(seed), rh = h / rows, n = Math.floor((w - 0.4) / 0.95);
  return f.rect(x, y, w, h, 'wall2') + rep(rows, (r) => rep(n, (i) => (rnd() < fill ? f.rect(x + 0.3 + i * 0.95, y + r * rh + 0.45, 0.65, rh - 1.05, pick(rnd, toks)) : '')) + f.rect(x, y + (r + 1) * rh - 0.55, w, 0.55, 'cloth3') + f.path(rep(Math.floor(n / 2), (k) => `M${r1(x + 0.5 + k * 1.9)},${r1(y + (r + 1) * rh - 0.45)}h1.1v0.36h-1.1Z`), rnd() < 0.5 ? 'hairw' : 'glass', { op: 0.95 }));
};
/** 장바구니 카트(옆) — 바구니 사다리꼴 + 살 + 손잡이 + 바퀴 */
export const shopCart = (x, yBase, w = 3.2, dir = 1) => f.poly([[x, yBase - w * 0.75], [x + w, yBase - w * 0.75], [x + w * 0.88, yBase - w * 0.3], [x + w * 0.12, yBase - w * 0.3]], 'far', { op: 0.7 }) + f.line(rep(3, (i) => `M${r1(x + w * (0.25 + i * 0.25))},${r1(yBase - w * 0.75)} V${r1(yBase - w * 0.32)}`), 0.08, 'roof2', { op: 0.5 }) + f.line(`M${r1(dir > 0 ? x : x + w)},${r1(yBase - w * 0.75)} l${r1(-dir * w * 0.12)},${r1(-w * 0.3)} h${r1(-dir * w * 0.2)}`, 0.14, 'roof2') + f.line(`M${r1(x + w * 0.2)},${r1(yBase - w * 0.3)} V${r1(yBase - 0.2)} M${r1(x + w * 0.8)},${r1(yBase - w * 0.3)} V${r1(yBase - 0.2)}`, 0.1, 'roof2') + f.circle(x + w * 0.2, yBase - 0.2, 0.22, 'ink') + f.circle(x + w * 0.8, yBase - 0.2, 0.22, 'ink');
/** 과일 상자(나무 틀 + 사과 몇 알 + 빈 가격표) — 알 수 n(적을수록 「귀해진」 느낌) */
export const fruitCrate = (x, yBase, w, n = 4, tag = true) => f.rect(x, yBase - w * 0.55, w, w * 0.55, 'wood') + f.rect(x + 0.2, yBase - w * 0.5, w - 0.4, w * 0.42, 'cloth3', { op: 0.55 }) + rep(n, (i) => f.circle(x + 0.6 + (i % 3) * (w - 1.2) / 2.2 + (Math.floor(i / 3) % 2) * 0.3, yBase - w * 0.4 + Math.floor(i / 3) * 0.5, w * 0.125, 'clay')) + (tag ? f.rect(x + w * 0.3, yBase - w * 0.62, w * 0.4, w * 0.22, 'cloth3', { rx: 0.08 }) : '');

// ---------------------------------------------------------------- 집 · 거리 — 2040년대
/** 밤의 아파트(창 격자는 어둡게, 불 켜진 창만 몇 개 — 결정적 난수) + 지붕 태양광 판 줄. 창 자리는 공유 패턴 `era-windows`의 칸(2.2×2.6, 원점 0,0)에 맞춘다 */
export const aptNight = (x, yBase, w, h, seed = 3, lit = 0.14, tok = 'roof2') => {
  const rnd = seeded(seed), k0 = Math.ceil((x + 0.3 - 0.4) / 2.2), k1 = Math.floor((x + w - 0.3 - 1.6) / 2.2), m0 = Math.ceil((yBase - h + 0.6 - 0.4) / 2.6), m1 = Math.floor((yBase - 0.6 - 1.9) / 2.6);
  let s = f.rect(x, yBase - h, w, h, tok) + f.rect(x, yBase - h, w, h, 'ink', { op: 0.3 }) + f.fill(x + 0.3, yBase - h + 0.5, w - 0.6, h - 0.8, 'era-windows', { op: 0.22 }) + f.rect(x - 0.2, yBase - h - 0.5, w + 0.4, 0.6, 'ink', { op: 0.7 }) + f.rect(x + 0.4, yBase - h - 0.9, w - 0.8, 0.4, 'cloth1', { op: 0.8 });
  for (let m = m0; m <= m1; m++) for (let k = k0; k <= k1; k++) if (rnd() < lit) s += f.rect(0.4 + k * 2.2, 0.4 + m * 2.6, 1.2, 1.5, 'glass', { op: 0.9 });
  return s;
};
/** 배달 로봇(보도 위 상자꼴 — 일반형, 로고 0): 몸체 + 뚜껑 띠 + 작은 불빛 + 바퀴 넷 */
export const deliveryBot = (x, yBase, w = 2.6) => f.rect(x, yBase - w * 0.95, w, w * 0.75, 'hairw', { rx: w * 0.12 }) + f.rect(x, yBase - w * 0.95, w, w * 0.16, 'cloth4', { rx: w * 0.12 }) + f.circle(x + w * 0.86, yBase - w * 0.62, w * 0.07, 'glass') + f.circle(x + w * 0.86, yBase - w * 0.62, w * 0.2, 'glass', { op: 0.2 }) + f.rect(x + w * 0.1, yBase - w * 0.22, w * 0.8, w * 0.08, 'roof2') + rep(4, (i) => f.circle(x + w * (0.15 + i * 0.23), yBase - w * 0.1, w * 0.1, 'ink'));
/** 그네(A자 틀 + 좌석 둘 — 아이는 호출자가 `far`로 앉힌다) */
export const swingSet = (x, yBase, w = 8, h = 7) => f.line(`M${r1(x)},${r1(yBase)} L${r1(x + w * 0.1)},${r1(yBase - h)} L${r1(x + w * 0.2)},${r1(yBase)} M${r1(x + w * 0.8)},${r1(yBase)} L${r1(x + w * 0.9)},${r1(yBase - h)} L${r1(x + w)},${r1(yBase)}`, 0.32, 'roof2') + f.rect(x + w * 0.1 - 0.3, yBase - h - 0.35, w * 0.8 + 0.6, 0.45, 'roof2', { rx: 0.2 }) + f.line(`M${r1(x + w * 0.3)},${r1(yBase - h)} V${r1(yBase - h * 0.26)} M${r1(x + w * 0.42)},${r1(yBase - h)} V${r1(yBase - h * 0.26)} M${r1(x + w * 0.58)},${r1(yBase - h)} V${r1(yBase - h * 0.26)} M${r1(x + w * 0.7)},${r1(yBase - h)} V${r1(yBase - h * 0.26)}`, 0.1, 'ink', { op: 0.6 }) + f.rect(x + w * 0.27, yBase - h * 0.26, w * 0.18, 0.4, 'clay', { rx: 0.1 }) + f.rect(x + w * 0.55, yBase - h * 0.26, w * 0.18, 0.4, 'clay', { rx: 0.1 });
/** 미끄럼틀(사다리 · 받침 · 비탈 — dir 쪽으로 내려간다) */
export const slide = (x, yBase, w = 8, h = 6, dir = 1, tok = 'cloth4') => { const lx = dir > 0 ? x : x + w, sx = dir > 0 ? x + w : x; return f.line(`M${r1(lx)},${r1(yBase)} V${r1(yBase - h)} M${r1(lx + dir * 1.2)},${r1(yBase)} V${r1(yBase - h)} ${rep(4, (i) => `M${r1(lx)},${r1(yBase - h * (0.2 + i * 0.2))} h${r1(dir * 1.2)}`)}`, 0.22, 'roof2') + f.rect(Math.min(lx, lx + dir * 2.4), yBase - h - 0.3, 2.4, 0.4, 'roof2') + f.poly([[lx + dir * 1.2, yBase - h - 0.2], [lx + dir * 2.4, yBase - h - 0.2], [sx, yBase - 0.2], [sx - dir * 1.6, yBase - 0.2]], tok) + f.poly([[lx + dir * 1.2, yBase - h - 0.2], [lx + dir * 1.5, yBase - h - 0.2], [sx - dir * 1.3, yBase - 0.2], [sx - dir * 1.6, yBase - 0.2]], 'cloth3', { op: 0.35 }) + f.line(`M${r1(sx - dir * 0.8)},${r1(yBase - 0.2)} V${r1(yBase)} M${r1((lx + dir * 1.8 + sx) / 2)},${r1((yBase - h + yBase) / 2)} V${r1(yBase)}`, 0.2, 'roof2'); };
/** 모래밭(둥근 테 + 모래) */
export const sandbox = (x, y, w, h) => f.rect(x - 0.25, y - 0.25, w + 0.5, h + 0.5, 'ground2', { rx: 0.8 }) + f.rect(x, y, w, h, 'cloth3', { rx: 0.6, op: 0.55 }) + f.rect(x, y, w, h, 'ground2', { rx: 0.6, op: 0.25 });
/** 그늘막(기둥 넷 위의 천 — 사다리꼴 캐노피 + 땅의 그림자) */
export const shadeSail = (x, y, w, h, poleH = 5, tok = 'cloth3', shadeOp = 0.35) => f.poly([[x + w * 0.1 + 1.2, y + h + poleH + 0.6], [x + w * 0.9 + 1.2, y + h + poleH + 0.6], [x + w + 1.6, y + h + poleH + 1.4], [x + 0.4, y + h + poleH + 1.4]], 'shade', { op: shadeOp }) + f.line(`M${r1(x + w * 0.1)},${r1(y + h)} v${r1(poleH)} M${r1(x + w * 0.9)},${r1(y + h)} v${r1(poleH)} M${r1(x)},${r1(y)} v${r1(poleH + h * 0.6)} M${r1(x + w)},${r1(y)} v${r1(poleH + h * 0.6)}`, 0.22, 'roof2') + f.poly([[x, y], [x + w, y], [x + w * 0.9, y + h], [x + w * 0.1, y + h]], tok) + f.poly([[x, y], [x + w, y], [x + w * 0.9, y + h], [x + w * 0.1, y + h]], 'far', { op: 0.15 });
/** 닫힌 블라인드 창(밖은 희게 밝고 살 사이로만 빛이 든다) */
export const blinds = (x, y, w, h, gap = 0.9) => f.rect(x, y, w, h, 'far') + f.rect(x + 0.3, y + 0.3, w - 0.6, h - 0.6, 'glass') + f.line(rep(Math.floor((h - 0.6) / gap), (i) => `M${r1(x + 0.3)},${r1(y + 0.3 + i * gap + gap * 0.5)} H${r1(x + w - 0.3)}`), gap * 0.62, 'roof2', { op: 0.92 }) + f.line(`M${r1(x + w * 0.5)},${r1(y + 0.3)} V${r1(y + h - 0.3)}`, 0.08, 'ink', { op: 0.5 });
/** 부채(손에 든 흰 부채 — 어깨 옆, 각도 a) */
export const handFan = (x, y, s = 1.6, a = -20) => f.path(`M${r1(x)},${r1(y)} L${r1(x - s * 0.55)},${r1(y - s)} A${r1(s * 0.6)},${r1(s * 0.6)} 0 0 1 ${r1(x + s * 0.55)},${r1(y - s)}Z`, 'cloth3', { tr: `rotate(${a} ${r1(x)} ${r1(y)})` }) + f.line(`M${r1(x)},${r1(y)} v${r1(s * 0.3)}`, 0.14, 'wood', { op: 0.9 });
/** 꺼진 벽걸이 냉방기(흰 상자만 — 바람 살 없음 + 작은 표시등 꺼짐) */
export const acUnitOff = (x, y, w) => f.rect(x, y, w, w * 0.34, 'cloth3', { rx: 0.3 }) + f.rect(x + 0.4, y + w * 0.26, w - 0.8, 0.14, 'far', { op: 0.5 }) + f.circle(x + w - 0.7, y + w * 0.12, 0.12, 'far');

// ---------------------------------------------------------------- 공항 · 항만
/** 여행 가방(바퀴 둘 + 올린 손잡이) */
export const suitcase = (x, yBase, w = 1.6, h = 2.4, tok = 'cloth1') => f.rect(x, yBase - h, w, h, tok, { rx: 0.2 }) + f.line(`M${r1(x + w * 0.25)},${r1(yBase - h)} v${r1(-h * 0.55)} h${r1(w * 0.5)} v${r1(h * 0.55)}`, 0.12, 'roof2') + f.rect(x + w * 0.2, yBase - h + 0.3, w * 0.6, 0.18, 'hairw', { op: 0.4 }) + f.circle(x + w * 0.2, yBase, 0.17, 'ink') + f.circle(x + w * 0.8, yBase, 0.17, 'ink');
/** 줄 기둥(둥근 받침 + 기둥)과 기둥 사이 띠 — x 목록 */
export const beltLine = (xs, yBase, h = 2.6) => xs.map((x) => f.ellipse(x, yBase, 0.55, 0.2, 'roof2') + f.rect(x - 0.12, yBase - h, 0.24, h, 'hairw') + f.circle(x, yBase - h, 0.22, 'roof2')).join('') + f.line(xs.slice(1).map((x, i) => `M${r1(xs[i])},${r1(yBase - h * 0.85)} Q${r1((xs[i] + x) / 2)},${r1(yBase - h * 0.72)} ${r1(x)},${r1(yBase - h * 0.85)}`).join(' '), 0.22, 'ink', { op: 0.75 });
/** 멀리 보이는 비행기(일반형 — 동체·꼬리날개·주날개, 도색·로고 0) */
export const planeFar = (x, y, w = 8, tok = 'hairw') => f.ellipse(x + w * 0.5, y, w * 0.5, w * 0.06, tok) + f.poly([[x + w * 0.86, y], [x + w * 0.98, y - w * 0.16], [x + w * 1.02, y - w * 0.16], [x + w * 0.96, y]], tok) + f.poly([[x + w * 0.42, y], [x + w * 0.56, y], [x + w * 0.5, y + w * 0.1], [x + w * 0.36, y + w * 0.1]], tok) + f.rect(x + w * 0.36, y + w * 0.06, w * 0.08, w * 0.05, 'roof2', { rx: 0.1 }) + f.rect(x + w * 0.04, y - w * 0.04, w * 0.12, w * 0.04, 'roof2', { rx: 0.05, op: 0.7 });
/** 큰 유리벽(세로 멀리언 — 호출자가 안쪽 풍경을 먼저 그린다) */
export const glassWall = (x, y, w, h, gap = 4, op = 0.1) => f.rect(x, y, w, h, 'glass', { op }) + f.line(`${rep(Math.floor(w / gap) + 1, (i) => `M${r1(x + i * gap)},${r1(y)} V${r1(y + h)}`)} M${r1(x)},${r1(y + h * 0.5)} H${r1(x + w)}`, 0.28, 'roof2', { op: 0.7 });
/** 컨테이너선(옆 — 선체 · 뒤쪽 선교 · 갑판 위 컨테이너 더미, 선명·국기 0) */
export const containerShip = (x, yWater, w, tok = 'cloth1') => {
  const h = w * 0.11;
  return f.poly([[x, yWater - h], [x + w, yWater - h * 0.9], [x + w * 0.96, yWater + h * 0.35], [x + w * 0.06, yWater + h * 0.35]], tok) + f.rect(x + w * 0.02, yWater - h * 0.75, w * 0.96, h * 0.12, 'clay', { op: 0.6 })
    + rep(4, (r) => rep(9, (c) => f.rect(x + w * 0.06 + c * w * 0.088, yWater - h - (r + 1) * h * 0.42, w * 0.08, h * 0.38, ['cloth4', 'clay', 'green', 'hairw', 'cloth2', 'cloth1'][(r * 3 + c) % 6])))
    + f.rect(x + w * 0.86, yWater - h - h * 2.4, w * 0.1, h * 2.4, 'hairw') + f.fill(x + w * 0.865, yWater - h - h * 2.3, w * 0.09, h * 1.6, 'era-windows', { op: 0.5 }) + f.rect(x + w * 0.88, yWater - h - h * 2.9, w * 0.03, h * 0.5, 'roof2');
};

// ---------------------------------------------------------------- 농촌 · 기후
/** 사과나무 줄 x0~x1에 n그루(둥근 잎 + 붉은 알 셋) — 좁은 띠에만 남은 과수원 */
export const appleRow = (x0, x1, y, n, s = 1.5, seed = 5, slope = 0) => { const rnd = seeded(seed); return rep(n, (i) => { const x = x0 + ((x1 - x0) * i) / Math.max(1, n - 1) + (rnd() - 0.5) * 0.5, yy = y + (x - x0) * slope + (rnd() - 0.5) * 0.4; return f.rect(x - s * 0.06, yy - s * 0.3, s * 0.12, s * 0.45, 'wood') + f.circle(x, yy - s * 0.6, s * 0.5, 'green') + f.circle(x - s * 0.3, yy - s * 0.42, s * 0.3, 'green') + f.circle(x + s * 0.3, yy - s * 0.45, s * 0.32, 'green') + f.circle(x - s * 0.2, yy - s * 0.55, s * 0.09, 'clay') + f.circle(x + s * 0.22, yy - s * 0.72, s * 0.09, 'clay') + f.circle(x + s * 0.05, yy - s * 0.38, s * 0.09, 'clay'); }); };
/** 비닐하우스(반원 지붕 — 밝은 막) */
export const greenhouse = (x, yBase, w, h) => f.path(`M${r1(x)},${r1(yBase)} V${r1(yBase - h * 0.35)} Q${r1(x)},${r1(yBase - h)} ${r1(x + w * 0.5)},${r1(yBase - h)} Q${r1(x + w)},${r1(yBase - h)} ${r1(x + w)},${r1(yBase - h * 0.35)} V${r1(yBase)}Z`, 'cloth3', { op: 0.85 }) + f.line(rep(4, (i) => `M${r1(x + w * (0.2 + i * 0.2))},${r1(yBase)} V${r1(yBase - h * (0.78 + Math.sin((0.2 + i * 0.2) * Math.PI) * 0.2))}`), 0.08, 'far', { op: 0.5 });
/** 밭의 작물 줄(비탈 위의 가는 줄들 — 한 path) */
export const cropRows = (x0, x1, y0, y1, n, tok = 'green', op = 0.5) => f.line(rep(n, (i) => { const t = (i + 0.5) / n; return `M${r1(x0 + (x1 - x0) * 0.04)},${r1(y0 + (y1 - y0) * t)} H${r1(x1 - (x1 - x0) * 0.04)}`; }), 0.22, tok, { op });
/** 전봇대의 확성기(나팔 — dir 쪽으로) + 소리 호 셋 */
export const loudspeaker = (x, y, s = 1.4, dir = -1) => f.poly([[x, y - s * 0.2], [x, y + s * 0.2], [x + dir * s, y + s * 0.5], [x + dir * s, y - s * 0.5]], 'roof2') + f.rect(x - 0.15 * s, y - s * 0.15, 0.3 * s, 0.3 * s, 'roof2') + f.line(rep(3, (i) => { const r = s * (1.2 + i * 0.55); return `M${r1(x + dir * (s + r * 0.3))},${r1(y - r * 0.5)} q${r1(dir * r * 0.5)},${r1(r * 0.5)} 0,${r1(r)}`; }), 0.14, 'cloth3', { op: 0.75 });
/** 전봇대(기둥 + 가로대 + 전선 두 가닥) */
export const utilityPole = (x, yBase, h) => f.rect(x - 0.22, yBase - h, 0.44, h, 'ground2') + f.rect(x - 1.6, yBase - h + 0.8, 3.2, 0.3, 'roof2') + f.line(`M${r1(x - 1.4)},${r1(yBase - h + 0.8)} q-6,1.2 -12,0.6 M${r1(x + 1.4)},${r1(yBase - h + 0.8)} q6,1.2 12,0.6`, 0.1, 'ink', { op: 0.6 });
/** 냉각 안개 기둥(가는 기둥 + 머리 + 흩어지는 안개) */
export const mistPost = (x, yBase, h = 6) => f.rect(x - 0.18, yBase - h, 0.36, h, 'hairw') + f.rect(x - 0.6, yBase - h - 0.5, 1.2, 0.6, 'roof2', { rx: 0.2 }) + f.ellipse(x, yBase - h + 0.9, 1.9, 0.9, 'cloth3', { op: 0.35 }) + f.ellipse(x + 0.4, yBase - h + 2.1, 2.6, 1.1, 'cloth3', { op: 0.22 }) + f.ellipse(x + 0.2, yBase - h + 3.4, 3.2, 1.2, 'cloth3', { op: 0.12 });
/** 빈 벤치(앉는 판 + 다리) */
export const bench = (x, yBase, w = 4, tok = 'wood') => f.rect(x, yBase - 1.5, w, 0.45, tok, { rx: 0.1 }) + f.rect(x, yBase - 2.6, w, 0.4, tok, { rx: 0.1, op: 0.85 }) + f.line(`M${r1(x + 0.4)},${r1(yBase - 1.05)} V${r1(yBase)} M${r1(x + w - 0.4)},${r1(yBase - 1.05)} V${r1(yBase)} M${r1(x + 0.4)},${r1(yBase - 2.2)} V${r1(yBase - 1.5)} M${r1(x + w - 0.4)},${r1(yBase - 2.2)} V${r1(yBase - 1.5)}`, 0.22, 'roof2');
/** 하드 섀도(한낮 — 물체 오른쪽 아래로 길게 밀린 짙은 그림자) */
export const hardShadow = (x, y, w, len = 3, op = 0.42) => f.poly([[x, y], [x + w, y], [x + w + len * 1.1, y + len * 0.45], [x + len * 1.1, y + len * 0.45]], 'shade', { op });
