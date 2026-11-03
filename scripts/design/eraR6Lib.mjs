/**
 * SPEC-010 「시대의 창」 r6 — 미래 연표 묶음 A(2026~2039, U01~U12)의 소품 + 「예측」 칩 CSS + 미래 그림 톤 두 안 (designer 2026-11-03).
 * r5b 도우미(`eraR5bLib.mjs` → r5 → r4 → r3 → r2)를 그대로 쓰고, 2026~2030년대 장면에 필요한 것만 더한다:
 *   대기 의자 줄·앉은 뒷모습, 색 블록 목록 화면(구직 목록·강의 화면 — 글자 0), 서 있는 선풍기·벽걸이 냉방기, 운전석 없는 작은 셔틀,
 *   서버 선반과 작은 불빛, 접수 창구(유리 칸막이)와 서류 더미, 우산 든 뒷모습 줄과 빗줄기, 바닥 이불과 누운 어르신(얼굴 0), 항만 컨테이너 더미와 갠트리 크레인,
 *   오르는 색 막대·꺾은선(숫자·축 글자 0), 복도의 원근 문, 세움 안내판(빈 판), 조끼.
 * 색은 `--c-scene-*` 25 토큰만(새 토큰 0). 글자·숫자·로고·국기·지도 0. 사람은 r4 심볼(뒷모습·옆모습·먼 인물, 얼굴 0)만 — 새 심볼 0, 새 패턴 0.
 * 수위(SPEC-010 「그림 수위」 1~6): 공포 연출(붉은 하늘·과장된 불길) 0, 실존 로봇·기기 모사 0(기기는 일반형 윤곽), 순간(쓰러짐·시술) 0.
 */
import { f, rep, person, far, seeded, pick } from './eraR5bLib.mjs';
export * from './eraR5bLib.mjs';

const r1 = (n) => Math.round(n * 100) / 100;

// ---------------------------------------------------------------- 실내 — 대기 공간
/** 대기 의자 줄(앞에서 본 등받이 의자 n개): 등받이·좌판·다리. 앉은 사람은 `seatedAt`로 등받이와 좌판 사이에 그린다 */
export const chairRow = (x0, yBase, n, gap, tok = 'cloth4', w = 2.5) => rep(n, (i) => { const x = x0 + i * gap; return f.rect(x, yBase - 4.6, w, 2.6, tok, { rx: 0.25 }) + f.line(`M${r1(x + 0.35)},${r1(yBase - 1.7)} V${r1(yBase)} M${r1(x + w - 0.35)},${r1(yBase - 1.7)} V${r1(yBase)}`, 0.2, 'roof2'); });
/** 의자 좌판(사람을 그린 뒤 앞에 덮는다) */
export const chairSeats = (x0, yBase, n, gap, tok = 'cloth4', w = 2.5) => rep(n, (i) => f.rect(x0 + i * gap, yBase - 2.15, w, 0.5, tok, { rx: 0.15 }));
/** 의자에 앉은 뒷모습(머리+어깨 — 등받이 위로 보인다) */
export const seatedAt = (x0, yBase, gap, w, i, h, top, hair) => far(x0 + i * gap + w / 2, yBase - 1.75, h, top, hair);

/** 색 블록 목록 화면(구직 공고·대시보드 — 글자 0): 틀 + 머리 띠 + 채워진 줄 rows + 빈 줄 empty */
export const listScreen = (x, y, w, h, { rows = 3, empty = 5, toks = ['cloth1', 'green', 'clay', 'cloth4'] } = {}) => {
  const pad = 0.6, rowH = (h - pad * 2 - 1) / (rows + empty);
  return f.rect(x, y, w, h, 'ink', { rx: 0.3 }) + f.rect(x + 0.3, y + 0.3, w - 0.6, h - 0.6, 'glass') + f.rect(x + 0.3, y + 0.3, w - 0.6, h - 0.6, 'cloth4', { op: 0.18 }) + f.rect(x + pad, y + pad, w - pad * 2, 0.8, 'cloth4', { op: 0.6 })
    + rep(rows, (i) => { const yy = y + pad + 1 + i * rowH; return f.rect(x + pad, yy + rowH * 0.15, 1.3, rowH * 0.7, toks[i % toks.length], { rx: 0.1 }) + f.rect(x + pad + 1.7, yy + rowH * 0.3, (w - pad * 2 - 1.7) * (0.45 + (i % 2) * 0.2), rowH * 0.4, 'far', { op: 0.8 }); })
    + f.line(rep(empty, (i) => { const yy = y + pad + 1 + (rows + i) * rowH + rowH * 0.55; return `M${r1(x + pad)},${r1(yy)} H${r1(x + w - pad)}`; }), 0.12, 'far', { op: 0.45 });
};
/** 강의·발표 화면(색 블록 도식 — 상자 셋과 잇는 선, 글자 0) */
export const diagramScreen = (x, y, w, h) => f.rect(x, y, w, h, 'ink', { rx: 0.25 }) + f.rect(x + 0.35, y + 0.35, w - 0.7, h - 0.7, 'glass') + rep(3, (i) => f.rect(x + w * (0.1 + i * 0.32), y + h * 0.28, w * 0.2, h * 0.26, ['cloth4', 'cloth1', 'green'][i], { rx: 0.2 })) + f.line(`M${r1(x + w * 0.3)},${r1(y + h * 0.41)} H${r1(x + w * 0.42)} M${r1(x + w * 0.62)},${r1(y + h * 0.41)} H${r1(x + w * 0.74)}`, 0.25, 'far') + rep(4, (i) => f.rect(x + w * 0.1 + i * w * 0.2, y + h * 0.68, w * 0.14, h * 0.18, 'far', { op: 0.6 - i * 0.1 }));
/** 오르는 색 막대(숫자·축 글자 0) — heights는 좌표 단위 */
export const barsRising = (x, yBase, bw, gap, heights, tok = 'cloth4') => rep(heights.length, (i) => f.rect(x + i * (bw + gap), yBase - heights[i], bw, heights[i], tok, { rx: 0.08 })) + f.line(`M${r1(x - 0.3)},${r1(yBase)} H${r1(x + heights.length * (bw + gap))}`, 0.14, 'far', { op: 0.7 });
/** 오르는 꺾은선(화면 안) — 가는 눈금 3줄 + 선 + 끝점 */
export const lineRising = (x, y, w, h, pts, tok = 'cloth4') => {
  const P = pts.map(([px, py]) => [r1(x + px * w), r1(y + h - py * h)]);
  return f.line(rep(3, (i) => `M${r1(x)},${r1(y + h * (0.25 + i * 0.25))} H${r1(x + w)}`), 0.1, 'far', { op: 0.5 }) + f.poly([[x, y + h], ...P, [x + w, y + h]], tok, { op: 0.22 }) + f.line(`M${P.map((p) => p.join(',')).join(' L')}`, 0.32, tok) + f.circle(P[P.length - 1][0], P[P.length - 1][1], 0.42, 'glass');
};
/** 세움 안내판(A자 — 빈 판 + 머리 띠) */
export const standSign = (x, yBase, w, h, tok = 'cloth3', band = 'cloth1') => f.poly([[x + w * 0.1, yBase - h], [x + w * 0.9, yBase - h], [x + w, yBase], [x, yBase]], tok) + f.rect(x + w * 0.1, yBase - h, w * 0.8, h * 0.16, band, { op: 0.6 }) + f.line(`M${r1(x + w * 0.5)},${r1(yBase - h * 0.55)} H${r1(x + w * 0.5)}`, 0, 'far');
/** 서류 더미(종이 n장을 쌓은 덩이) */
export const paperStack = (x, yBase, w, n, tok = 'cloth3') => rep(n, (i) => f.rect(x + (i % 2) * 0.08, yBase - (i + 1) * 0.42, w, 0.36, tok, { rx: 0.04 })) + f.line(rep(n, (i) => `M${r1(x)},${r1(yBase - i * 0.42 - 0.03)} h${r1(w)}`), 0.07, 'far', { op: 0.6 });
/** 접수 창구: 긴 데스크 + 유리 칸막이(틀 far) + n개 창 — 직원은 호출자가 `far`로 둔다 */
export const serviceCounter = (x, yBase, w, n, h = 7.6) => f.rect(x, yBase - h, w, h - 4.2, 'glass', { op: 0.35 }) + rep(n + 1, (i) => f.rect(x + i * (w / n) - 0.2, yBase - h, 0.4, h - 4.2, 'far')) + f.rect(x - 0.3, yBase - h - 0.4, w + 0.6, 0.45, 'far') + f.rect(x, yBase - 4.2, w, 0.6, 'wall2') + f.rect(x, yBase - 3.6, w, 3.6, 'wood', { op: 0.55 }) + f.rect(x, yBase - 3.6, w, 3.6, 'wall2', { op: 0.5 });
/** 창구 유리 칸막이 하나(열린 창 — 데스크 위) */
export const glassBooth = (x, y, w, h) => f.rect(x, y, w, h, 'far') + f.rect(x + 0.5, y + 0.5, w - 1, h - 1, 'glass', { op: 0.5 });
/** 비어 있는 사무용 의자(등받이만 보인다 — 자리가 비었음을 말한다) */
export const emptyOfficeChair = (x, yBase, w = 2.6, tok = 'cloth4') => f.rect(x, yBase - 3.2, w, 2.4, tok, { rx: 0.35 }) + f.rect(x + w * 0.42, yBase - 0.8, w * 0.16, 0.8, 'roof2');

// ---------------------------------------------------------------- 더위 · 돌봄
/** 서 있는 선풍기(기둥·받침·둥근 머리 — dir 쪽을 본다) */
export const fan = (x, yBase, h, dir = 1) => f.ellipse(x, yBase - 0.2, h * 0.22, 0.35, 'roof2') + f.rect(x - h * 0.03, yBase - h * 0.62, h * 0.06, h * 0.62, 'hairw') + f.circle(x + dir * h * 0.08, yBase - h * 0.8, h * 0.22, 'hairw') + f.circle(x + dir * h * 0.08, yBase - h * 0.8, h * 0.17, 'far', { op: 0.55 }) + f.line(rep(5, (i) => { const a = (i / 5) * Math.PI * 2; return `M${r1(x + dir * h * 0.08)},${r1(yBase - h * 0.8)} l${r1(Math.cos(a) * h * 0.16)},${r1(Math.sin(a) * h * 0.16)}`; }), 0.1, 'hairw', { op: 0.8 }) + f.circle(x + dir * h * 0.08, yBase - h * 0.8, h * 0.035, 'roof2');
/** 벽걸이 냉방기(흰 상자 + 바람 살) */
export const acUnit = (x, y, w) => f.rect(x, y, w, w * 0.34, 'cloth3', { rx: 0.3 }) + f.line(rep(3, (i) => `M${r1(x + 0.5)},${r1(y + w * 0.2 + i * 0.3)} H${r1(x + w - 0.5)}`), 0.1, 'far', { op: 0.6 });
/** 바닥 이불에 누운 어르신(뒤통수만 — 얼굴 0): 요·베개·이불·머리 */
export const lyingElder = (x, y, w, { hair = 'hairw', blanket = 'cloth4' } = {}) => f.rect(x, y, w, w * 0.32, 'cloth3', { rx: 0.5 }) + f.rect(x + 0.4, y - 0.2, w * 0.22, w * 0.17, 'cloth3', { rx: 0.3 }) + f.rect(x + w * 0.2, y - 0.45, w * 0.82, w * 0.36, blanket, { rx: 0.45 }) + f.rect(x + w * 0.2, y - 0.45, w * 0.82, 0.35, 'cloth3', { op: 0.35 }) + f.circle(x + w * 0.15, y + w * 0.02, w * 0.085, hair);
/** 빨랫줄과 널린 옷 */
export const laundryLine = (x0, x1, y, toks = ['cloth3', 'cloth4', 'hairw']) => f.line(`M${r1(x0)},${r1(y)} H${r1(x1)}`, 0.12, 'far') + rep(toks.length, (i) => f.rect(x0 + 1 + i * ((x1 - x0 - 2) / toks.length), y + 0.1, 1.6, 2.4 + (i % 2) * 0.5, toks[i], { rx: 0.15 }));
/** 조끼(사람 몸통 위에 덧그리는 띠 — 돌봄 인력·안내 직원) */
export const vest = (x, yBase, h, tok = 'cloth2') => f.rect(x - h * 0.11, yBase - h * 0.75, h * 0.22, h * 0.34, tok, { rx: 0.25 });
/** 팔걸이의자(뒤에서 — 창을 향해 앉은 사람의 머리만 등받이 위로) */
export const armchairBack = (x, yBase, w, h, tok = 'cloth4', hair = 'hairw') => f.rect(x, yBase - h, w, h, tok, { rx: 0.6 }) + f.rect(x - 0.3, yBase - h * 0.45, w + 0.6, 0.7, tok, { rx: 0.3 }) + f.circle(x + w / 2, yBase - h - w * 0.1, w * 0.17, hair);
/** 지팡이(선 하나) */
export const cane = (x, yBase, h) => f.line(`M${r1(x)},${r1(yBase)} L${r1(x - h * 0.1)},${r1(yBase - h * 0.55)}`, 0.18, 'wood');

// ---------------------------------------------------------------- 거리 · 교통 · 날씨
/** 운전석 없는 작은 셔틀(양 끝이 같은 둥근 상자 — 회사·제품 모사 0): 차체·둘러친 창·열린 문·지붕 감지기·바퀴 */
export const shuttle = (x, yBase, w, tok = 'cloth3', stripe = 'green') => {
  const h = w * 0.42, y = yBase - h;
  return f.rect(x, y, w, h - 0.3, tok, { rx: w * 0.06 }) + f.rect(x + 0.4, y + 0.8, w - 0.8, h * 0.46, 'glass', { rx: 0.3 }) + f.rect(x + 0.4, y + 0.8, w - 0.8, h * 0.46, 'cloth4', { op: 0.22, rx: 0.3 }) + f.line(rep(4, (i) => `M${r1(x + w * (0.2 + i * 0.2))},${r1(y + 0.8)} v${r1(h * 0.46)}`), 0.22, tok) + f.rect(x, y + h * 0.64, w, 0.55, stripe)
    + f.rect(x + w * 0.4, y + h * 0.1, w * 0.17, h * 0.86, 'glass', { op: 0.95 }) + f.rect(x + w * 0.4, y + h * 0.1, w * 0.17, h * 0.86, 'cloth2', { op: 0.18 }) + f.line(`M${r1(x + w * 0.4)},${r1(y + h * 0.1)} v${r1(h * 0.86)} M${r1(x + w * 0.57)},${r1(y + h * 0.1)} v${r1(h * 0.86)}`, 0.2, 'roof2')
    + f.rect(x + w * 0.44, y - 0.55, w * 0.12, 0.6, 'roof2', { rx: 0.3 }) + f.circle(x + w * 0.5, y - 0.75, 0.45, 'glass') + f.circle(x + w * 0.5, y - 0.75, 0.22, 'cloth4')
    + f.circle(x + w * 0.16, yBase - 0.1, w * 0.055, 'ink') + f.circle(x + w * 0.84, yBase - 0.1, w * 0.055, 'ink') + f.circle(x + w * 0.16, yBase - 0.1, w * 0.02, 'hairw') + f.circle(x + w * 0.84, yBase - 0.1, w * 0.02, 'hairw');
};
/** 우산(뒤에서 본 반원 + 손잡이) */
export const umbrellaBack = (x, y, w, tok = 'cloth1') => { const q = (n) => Math.round(n * 10) / 10, s = q(w / 4), d = q(w * 0.07); return f.path(`M${q(x - w / 2)},${q(y)}a${q(w / 2)},${q(w * 0.42)} 0 0 1 ${q(w)},0q${-s * 0.5},${d} ${-s},0q${-s * 0.5},${d} ${-s},0q${-s * 0.5},${d} ${-s},0q${-s * 0.5},${d} ${-s},0Z`, tok) + f.line(`M${q(x)},${q(y)}v${q(w * 0.2)}`, 0.1, 'ink', { op: 0.5 }); };
/** 우산 든 뒷모습 줄 x0~x1에 n명(사람 머리 위에 우산) — o: y jitter hMin hMax seed tops bottoms umb(우산 색 목록) skirts */
export const umbrellaRow = (x0, x1, n, hMin, hMax, o = {}) => {
  const { y = 24, jitter = 0.6, seed = 9, tops = ['cloth1', 'roof2', 'far', 'cloth4', 'hairw', 'ink'], bottoms = ['cloth1', 'ink', 'roof2'], umb = ['cloth1', 'ink', 'cloth4', 'clay', 'roof2', 'cloth3'], skirts = 0.3, uw = 1.05 } = o;
  const rnd = seeded(seed); const list = [];
  for (let i = 0; i < n; i++) { const t = (i + rnd() * 0.7) / n; list.push({ x: x0 + (x1 - x0) * t, y: y + (rnd() - 0.5) * 2 * jitter, h: hMin + (hMax - hMin) * rnd(), top: pick(rnd, tops), bottom: pick(rnd, bottoms), u: pick(rnd, umb), sk: rnd() < skirts }); }
  list.sort((a, b) => a.y - b.y);
  return list.map((p) => person(p.x, p.y, p.h, { top: p.top, bottom: p.bottom, hair: 'ink', skirt: p.sk }) + umbrellaBack(p.x, p.y - p.h * 0.92, p.h * 0.62 * uw, p.u)).join('');
};
/** 빗줄기(짧은 사선 n개 — 한 path) */
export const rain = (seed, n, x0 = 0, x1 = 40, y0 = 0, y1 = 32, tok = 'cloth3', op = 0.35) => { const rnd = seeded(seed), q = (v) => Math.round(v * 10) / 10; return f.line(rep(n, () => { const x = x0 + rnd() * (x1 - x0), y = y0 + rnd() * (y1 - y0), l = 0.9 + rnd() * 1.1; return `M${q(x)},${q(y)}l${q(-l * 0.2)},${q(l)}`; }), 0.1, tok, { op }); };
/** 젖은 바닥의 물웅덩이 */
export const puddles = (seed, n, y0, y1, tok = 'glass', op = 0.14) => { const rnd = seeded(seed); return rep(n, () => f.ellipse(rnd() * 40, y0 + rnd() * (y1 - y0), 1.6 + rnd() * 2.4, 0.22 + rnd() * 0.25, tok, { op })); };
/** 바닥 햇빛 자국(창에서 들어온 밝은 평행사변형) */
export const sunPatch = (x, y, w, h, skew = 2, op = 0.22) => f.poly([[x, y], [x + w, y], [x + w + skew, y + h], [x + skew, y + h]], 'glass', { op });

// ---------------------------------------------------------------- 항만 · 산업 · 서버
/** 컨테이너 더미(rows × cols — 색은 돌아가며, 글자·로고 0) */
export const containerStack = (x, yBase, cw, ch, rows, cols, toks = ['cloth4', 'clay', 'green', 'cloth1', 'cloth2', 'hairw'], seed = 3) => { const rnd = seeded(seed); return rep(rows, (r) => rep(cols - (r % 2), (c) => { const xx = x + c * cw + (r % 2) * cw * 0.5, yy = yBase - (r + 1) * ch; return f.rect(xx, yy, cw - 0.12, ch - 0.1, pick(rnd, toks)) + f.line(`M${r1(xx + 0.3)},${r1(yy + 0.15)} v${r1(ch - 0.4)} M${r1(xx + cw - 0.45)},${r1(yy + 0.15)} v${r1(ch - 0.4)}`, 0.08, 'ink', { op: 0.25 }); })); };
/** 갠트리 크레인(항만 — 다리 둘·가로보·앞으로 뻗은 팔·매단 줄) */
export const gantry = (x, yBase, w, h, tok = 'far', op = 0.7) => f.rect(x, yBase - h, 0.5, h, tok, { op }) + f.rect(x + w * 0.55, yBase - h, 0.5, h, tok, { op }) + f.rect(x - w * 0.25, yBase - h - 0.5, w * 1.25, 0.55, tok, { op }) + f.line(`M${r1(x + w * 0.05)},${r1(yBase - h * 0.5)} H${r1(x + w * 0.55)} M${r1(x + w * 0.9)},${r1(yBase - h - 0.5)} V${r1(yBase - h * 0.55)}`, 0.18, tok, { op }) + f.rect(x + w * 0.78, yBase - h * 0.55, w * 0.22, 0.8, tok, { op });
/** 서버 선반(어두운 틀 + 가로 단 + 작은 불빛 — 결정적 난수) */
export const serverRack = (x, y, w, h, seed = 5) => { const rnd = seeded(seed); const n = Math.floor(h / 1.1); return f.rect(x, y, w, h, 'ink', { rx: 0.15 }) + f.rect(x + 0.2, y + 0.2, w - 0.4, h - 0.4, 'roof2') + f.line(rep(n, (i) => `M${r1(x + 0.2)},${r1(y + 0.9 + i * 1.1)} h${r1(w - 0.4)}`), 0.08, 'ink') + rep(n, (i) => rep(3, (j) => (rnd() < 0.75 ? f.rect(x + 0.45 + j * 0.5, y + 0.45 + i * 1.1, 0.26, 0.26, rnd() < 0.5 ? 'green' : 'glass', { rx: 0.05, op: 0.9 }) : ''))); };
/** 멀리 보이는 공장 띠(지붕선·켜진 창·굴뚝 둘) */
export const factoryBand = (y, h = 4.6) => f.rect(0, y, 40, h, 'roof2') + f.line(`M0,${r1(y)} ${rep(10, (i) => `L${r1(i * 4 + 2)},${r1(y - 1.2)} L${r1(i * 4 + 4)},${r1(y)}`)}`, 0.3, 'roof2') + f.fill(0.4, y + 0.5, 39.2, h - 0.8, 'era-lit', { op: 0.3 });

// ---------------------------------------------------------------- 복도 원근
/** 원근 복도 벽 위의 문(벽의 위·아래 선을 따라 기운 사각형) — side -1 왼쪽 벽 / 1 오른쪽 벽. vp = [vx, vy], 벽 끝 x = ex(끝 벽의 가장자리) */
export const perspDoor = (x0, x1, side, vp, ex, tok = 'wood', { note = false } = {}) => {
  const [vx, vy] = vp; const top = (x) => (side < 0 ? (x / ex) * vy : ((40 - x) / (40 - ex)) * vy); const bot = (x) => (side < 0 ? 32 - (x / ex) * (32 - (vy + 6.4)) : 32 - ((40 - x) / (40 - ex)) * (32 - (vy + 6.4)));
  const t0 = top(x0), t1 = top(x1), b0 = bot(x0), b1 = bot(x1); const d0 = t0 + (b0 - t0) * 0.2, d1 = t1 + (b1 - t1) * 0.2;
  return f.poly([[x0, d0], [x1, d1], [x1, b1], [x0, b0]], tok) + f.poly([[x0 + (x1 - x0) * 0.15, d0 + (b0 - d0) * 0.1], [x1 - (x1 - x0) * 0.15, d1 + (b1 - d1) * 0.1], [x1 - (x1 - x0) * 0.15, d1 + (b1 - d1) * 0.5], [x0 + (x1 - x0) * 0.15, d0 + (b0 - d0) * 0.5]], 'far', { op: 0.35 })
    + (note ? f.poly([[x0 + (x1 - x0) * 0.3, d0 + (b0 - d0) * 0.55], [x1 - (x1 - x0) * 0.3, d1 + (b1 - d1) * 0.55], [x1 - (x1 - x0) * 0.3, d1 + (b1 - d1) * 0.68], [x0 + (x1 - x0) * 0.3, d0 + (b0 - d0) * 0.68]], 'cloth3') : '')
    + f.circle(side < 0 ? x1 - (x1 - x0) * 0.12 : x0 + (x1 - x0) * 0.12, (side < 0 ? d1 + (b1 - d1) * 0.62 : d0 + (b0 - d0) * 0.62), 0.14, 'roof2');
};
/** 원근 복도 벽 위의 창(바깥이 보인다 — 호출자가 안쪽 그림을 넣는다) */
export const perspWindow = (x0, x1, side, vp, ex, inner) => {
  const [vx, vy] = vp; const top = (x) => (side < 0 ? (x / ex) * vy : ((40 - x) / (40 - ex)) * vy); const bot = (x) => (side < 0 ? 32 - (x / ex) * (32 - (vy + 6.4)) : 32 - ((40 - x) / (40 - ex)) * (32 - (vy + 6.4)));
  const t0 = top(x0), t1 = top(x1), b0 = bot(x0), b1 = bot(x1); const w0 = t0 + (b0 - t0) * 0.18, w1 = t1 + (b1 - t1) * 0.18, l0 = t0 + (b0 - t0) * 0.6, l1 = t1 + (b1 - t1) * 0.6;
  return f.poly([[x0, w0 - 0.3], [x1, w1 - 0.3], [x1, l1 + 0.3], [x0, l0 + 0.3]], 'far') + f.poly([[x0 + 0.25, w0], [x1 - 0.25, w1], [x1 - 0.25, l1], [x0 + 0.25, l0]], 'glass') + inner([x0 + 0.25, w0], [x1 - 0.25, w1], [x1 - 0.25, l1], [x0 + 0.25, l0]);
};

// ---------------------------------------------------------------- 미래 그림 톤 두 안 · 「예측」 칩 (CSS — developer 인계용 원문)
/**
 * 톤 안 1 「밑그림」: 2027년 이후 그림(`data-future="true"`)의 채도를 절반으로, 조금 밝게 — 「아직 색이 다 칠해지지 않은 그림」. 그림 바이트 0(CSS 필터만).
 * 톤 안 2 「점선 틀」: 그림은 2010년대와 같은 색 그대로, 칸 안쪽에 2px 점선(오디색 --c-era) 틀 — 「전망」 칸의 점선 언어와 같은 뜻(아직 아님). 그림 바이트 0.
 * 둘 다 과거(≤ 2026)에는 닿지 않는다. 다크·강제 색상 값은 아래.
 */
export const FUTURE_TONE = {
  draft: { name: '밑그림', filter: 'saturate(.5) contrast(.92) brightness(1.06)', dark: 'saturate(.55) brightness(.94)' },
  frame: { name: '점선 틀', filter: 'none', dark: 'none' },
};
export const futureToneCss = (sel = '.ew') => `${sel} [data-ftone="draft"] [data-future="true"] svg{filter:${FUTURE_TONE.draft.filter}}
:root[data-theme="dark"] ${sel} [data-ftone="draft"] [data-future="true"] svg{filter:${FUTURE_TONE.draft.dark}}
${sel} [data-ftone="frame"] [data-future="true"]{outline:2px dashed var(--c-era);outline-offset:-4px}
@media (forced-colors: active){${sel} [data-ftone="frame"] [data-future="true"]{outline-color:CanvasText}}`;

/**
 * 「예측」 칩(SPEC-010 FU3 · 구현 규칙 7) — 세 겹: 색(오디색 `--c-era`/`--c-era-soft` — 시대 줄의 토큰을 다시 쓴다, 새 토큰 0) + 글자 「예측」 + 아이콘 `#i-ahead`(찬 점 → 빈 점: 「지금에서 아직 채워지지 않은 자리로」).
 * 경제 칸의 「전망」(놋쇠 `--c-accent` 알약 `--r-pill` + 점선 꺾은선 `#i-proj` + 연표 줄은 긴 점선 테두리)과 **색·아이콘·모양**이 모두 다르다: 오디 ↔ 놋쇠, 점·빈 점 ↔ 꺾은선, 꼬리표 `--r-sm` ↔ 알약, 시대 줄은 겹선 ↔ 점선.
 * 대비(토큰 값 2026-11-03): 라이트 글자/면 #6d2f4e/#f4e3ec 7.87 · 테두리/카드 면 9.53, 다크 #f5a8d6/#3a2434 7.73 · 8.79 — 모두 4.5 이상(생성기가 실측해 시트 표에 적는다).
 * 근거 종류 글자(`.log__basis`)는 칩 옆 한 단어(「공식 전망 바탕」 등, `--fs-xs` `--c-text-2`). 360·320·글자 200%에서는 줄이 나뉘고(flex-wrap) 가로 넘침 0.
 * 창의 표(안 B, `.era__fc`)는 창 칸(`a.era`)의 왼쪽 위 — PC(칸 = 그림)에서는 그림 위, 휴대폰 띠(카드 ≤ 480px — 그림 100×80 왼쪽, 나머지는 띠 바탕)에서는 **그림 옆 띠 바탕 위**(그림을 가리지 않는다).
 * 연도 표 `.scene__year`와 같은 「카드 면 색 꼬리표」 문법(어느 하늘 위에서도 대비가 토큰 그대로). 강제 색상: Canvas/CanvasText + 1px 테두리. 표는 `.era__pic`의 형제(그림 span 밖, 링크 안).
 */
export const chipCss = () => `.log__tlrow{display:flex;flex-wrap:wrap;align-items:center;gap:var(--sp-1) var(--sp-2);min-width:0}
.chip--fc{display:inline-flex;align-items:center;gap:4px;padding:0 6px;border-radius:var(--r-sm);border:1px solid var(--c-era);background:var(--c-era-soft);color:var(--c-era);font-size:var(--fs-xs);font-weight:var(--fw-bold);line-height:1.7;white-space:nowrap}
.chip--fc .icon{width:14px;height:14px;stroke-width:2.4}
.log__basis{font-size:var(--fs-xs);line-height:1.7;color:var(--c-text-2)}
.era{position:relative}
.era__fc{position:absolute;top:var(--sp-1);left:var(--sp-1);display:inline-flex;align-items:center;gap:3px;padding:0 5px;border-radius:var(--r-sm);background:var(--c-surface);color:var(--c-era);font-size:var(--fs-xs);font-weight:var(--fw-bold);line-height:1.6;white-space:nowrap}
.era__fc .icon{width:12px;height:12px;stroke-width:2.6}
@container scene (max-width: 480px){.era__fc{top:var(--sp-2);left:calc(100px + var(--sp-2))}}
@media (forced-colors: active){.chip--fc{background:Canvas;color:CanvasText;border-color:CanvasText}.era__fc{background:Canvas;color:CanvasText;border:1px solid CanvasText}}`;
/** 새 아이콘 `#i-ahead`(24×24, 선 아이콘 규칙 — currentColor 선): 찬 점(지금) · 짧은 선 · 빈 점(아직 채워지지 않은 자리). 「전망」 `#i-proj`(꺾은선 + 점선)과 다른 실루엣 */
export const ICON_AHEAD = '<symbol id="i-ahead" viewBox="0 0 24 24"><circle cx="4.6" cy="12" r="1.9" fill="currentColor" stroke="none"/><path d="M7.6 12h5.6"/><circle cx="17.6" cy="12" r="3.6"/></symbol>';
/** 비교용 기존 아이콘(스프라이트 원문 그대로 — src/assets/icons/ui-icons.svg·scene-icons.svg) */
export const ICON_PROJ = '<symbol id="i-proj" viewBox="0 0 24 24"><path d="M3 17l5-6 4 3 4-5"/><path d="M16 9h3.5v3.5" stroke-dasharray="2.5 1.8"/><path d="M3 20h18" stroke-dasharray="2 2"/></symbol>';
export const ICON_ERA = '<symbol id="i-era" viewBox="0 0 24 24"><rect x="4" y="4.5" width="16" height="15" rx="1.5"/><path d="M12 4.5v15M4 12h16"/></symbol>';
export const ICON_YEAR = '<symbol id="i-year" viewBox="0 0 24 24"><rect x="4" y="5" width="16" height="15" rx="1.5"/><path d="M4 10h16M8 3v4M16 3v4"/></symbol>';
