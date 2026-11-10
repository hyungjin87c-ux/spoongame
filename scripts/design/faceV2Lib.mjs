/**
 * 프로필 얼굴 확장 시안 생성기 (SPEC-018 후보 — 「맞춤 인생」 개편 결정 Q8, 2026-11-10 designer). **시안 전용** — `src/`는 읽지도 고치지도 않는다.
 *
 * 구조 제안을 그대로 코드로 보인 것이다: 얼굴 한 장 = 독립 층 다섯의 합.
 *   ① 얼굴형(연령대·성별)   ② 이목구비 대비(외모 단계 × 표현 안)   ③ 머리(달력 10년대 × 나이대 × 성별)
 *   ④ 옷깃(달력 10년대 × 나이대 × 성별)   ⑤ 소품(안경 — 시대별 모양, 판의 시드로 뽑는다. 외모·수저와 무관)
 * 기본 기하(AGE_SPECS·HAIR·머리 경로)는 `src/assets/faces/faceLayers.ts`를 그대로 옮겼다(「현행」 열이 지금 구현과 같은 그림이 되도록). 달라지는 곳은 주석에 [v2]로 표시.
 * 색은 `--c-face-*` 토큰만 쓴다. 새로 제안하는 토큰 하나: `--c-face-shirt`(셔츠·블라우스 깃의 밝은 천 — 폴백 #efe9dc).
 */

export const AGE_GROUPS = [
  { id: 'infant', label: '영아', minAge: 0 },
  { id: 'toddler', label: '유아', minAge: 3 },
  { id: 'child', label: '아동', minAge: 7 },
  { id: 'teen', label: '청소년', minAge: 13 },
  { id: 'young', label: '청년', minAge: 20 },
  { id: 'middle', label: '중년', minAge: 40 },
  { id: 'senior', label: '장년', minAge: 60 },
  { id: 'elder', label: '노년', minAge: 75 },
];

export const FACE_VIEWBOX = '0 0 120 120';

const COLOR = {
  skin: 'var(--c-face-skin,#F1C9A5)',
  skinShade: 'var(--c-face-skin-shade,#E3B38C)',
  line: 'var(--c-face-line,#4A362C)',
  hair: 'var(--c-face-hair,#2B2420)',
  hairGray: 'var(--c-face-hair-gray,#85817B)',
  hairWhite: 'var(--c-face-hair-white,#D6D2CA)',
  hairEdge: 'var(--c-face-hair-edge,#4A453D)',
  cloth: 'var(--c-face-cloth,#6C7F9E)',
  shirt: 'var(--c-face-shirt,#EFE9DC)', // [v2] 제안 토큰
  bg: 'var(--c-face-bg,#E8E3D6)',
  blush: 'var(--c-face-blush,#E8998D)',
  eyeWhite: '#FFFFFF',
};

const r = (v) => Math.round(v * 10) / 10;

// ---------- ② 이목구비 대비: 표현 안별 파라미터 표 (인덱스 0 = 1단계 … 4 = 5단계) ----------
/**
 * cur = 현행(faceLayers.ts TIER_PARAMS 그대로)
 * A   = 「선의 대비」 — 현행 축을 더 벌리고 눈썹 농도·길이를 더한다. 부품·크기·위치 불변(R-135② 그대로)
 * B   = 「그림자 두 획」 — 선은 현행, 4·5단계에 콧날 옆·광대 아래 그림자(살색 그늘, 선이 아니다)를 얹는다. 1~3단계는 평면(수수함 = 그늘 없음)
 * C   = 「비례」 — 눈 세로 크기·눈썹 길이를 ±12% 안에서 단계에 따라. 선은 현행. (눈 크기 불변 시험과 어긋난다 — 가장 위험한 안)
 * AB  = A + B (추천)
 */
export const VARIANTS = {
  cur: {
    lineWidth: [1.6, 2.0, 2.4, 2.8, 3.2],
    lineAlpha: [0.62, 0.74, 0.86, 0.94, 1],
    browWidth: [1.4, 1.8, 2.3, 2.8, 3.2],
    browAlpha: [0.62, 0.74, 0.86, 0.94, 1],
    browLen: [1, 1, 1, 1, 1],
    highlight: [0.3, 0.45, 0.6, 0.78, 0.95],
    eyeScale: [1, 1, 1, 1, 1],
    noseShade: [0, 0, 0, 0, 0],
    jawShade: [0, 0, 0, 0, 0],
    hairVolume: [0.8, 0.9, 1, 1.1, 1.2],
    hairlineRise: [2, 1, 0, 0, 0],
    sheen: [0, 1, 2, 4, 6],
  },
  A: {
    lineWidth: [1.3, 1.8, 2.4, 3.0, 3.6],
    lineAlpha: [0.62, 0.72, 0.84, 0.94, 1],
    browWidth: [1.0, 1.6, 2.3, 3.0, 3.7],
    browAlpha: [0.56, 0.7, 0.84, 0.94, 1],
    browLen: [0.86, 0.93, 1, 1.06, 1.12],
    highlight: [0.18, 0.38, 0.6, 0.8, 1],
    eyeScale: [1, 1, 1, 1, 1],
    noseShade: [0, 0, 0, 0, 0],
    jawShade: [0, 0, 0, 0, 0],
    hairVolume: [0.8, 0.9, 1, 1.1, 1.2],
    hairlineRise: [2, 1, 0, 0, 0],
    sheen: [0, 1, 2, 4, 6],
  },
  B: {
    lineWidth: [1.6, 2.0, 2.4, 2.8, 3.2],
    lineAlpha: [0.62, 0.74, 0.86, 0.94, 1],
    browWidth: [1.4, 1.8, 2.3, 2.8, 3.2],
    browAlpha: [0.62, 0.74, 0.86, 0.94, 1],
    browLen: [1, 1, 1, 1, 1],
    highlight: [0.3, 0.45, 0.6, 0.78, 0.95],
    eyeScale: [1, 1, 1, 1, 1],
    noseShade: [0, 0, 0, 0.45, 0.7],
    jawShade: [0, 0, 0, 0.24, 0.4],
    hairVolume: [0.8, 0.9, 1, 1.1, 1.2],
    hairlineRise: [2, 1, 0, 0, 0],
    sheen: [0, 1, 2, 4, 6],
  },
  C: {
    lineWidth: [1.6, 2.0, 2.4, 2.8, 3.2],
    lineAlpha: [0.62, 0.74, 0.86, 0.94, 1],
    browWidth: [1.4, 1.8, 2.3, 2.8, 3.2],
    browAlpha: [0.62, 0.74, 0.86, 0.94, 1],
    browLen: [0.88, 0.94, 1, 1.05, 1.1],
    highlight: [0.3, 0.45, 0.6, 0.78, 0.95],
    eyeScale: [0.88, 0.94, 1, 1.06, 1.12],
    noseShade: [0, 0, 0, 0, 0],
    jawShade: [0, 0, 0, 0, 0],
    hairVolume: [0.8, 0.9, 1, 1.1, 1.2],
    hairlineRise: [2, 1, 0, 0, 0],
    sheen: [0, 1, 2, 4, 6],
  },
};
VARIANTS.AB = { ...VARIANTS.A, noseShade: VARIANTS.B.noseShade, jawShade: VARIANTS.B.jawShade };

// ---------- ① 얼굴형: 연령대 표 (faceLayers.ts 그대로) ----------
const AGE_SPECS = {
  infant: { cy: 62, rx: 33, ry: 30, jawF: 0.96, jawM: 0.96, eyeY: 5, eyeDx: 12, eyeRx: 2.4, eyeRy: 3, browDy: 7, browW: 4.5, browScale: 0.45, noseY: 15, mouthY: 22, mouthW: 5, neckW: 14, shoulderY: 101, earRy: 5.5, blush: 1, wrinkle: 0, hairTone: 'dark', gray: false },
  toddler: { cy: 60, rx: 31.5, ry: 31, jawF: 0.92, jawM: 0.92, eyeY: 4, eyeDx: 12.4, eyeRx: 2.5, eyeRy: 3.1, browDy: 7.4, browW: 5.2, browScale: 0.6, noseY: 14, mouthY: 22, mouthW: 5.6, neckW: 14.5, shoulderY: 101, earRy: 5.5, blush: 0.9, wrinkle: 0, hairTone: 'dark', gray: false },
  child: { cy: 58, rx: 30, ry: 32, jawF: 0.86, jawM: 0.88, eyeY: 3, eyeDx: 12.6, eyeRx: 2.7, eyeRy: 3.2, browDy: 7.6, browW: 5.8, browScale: 0.8, noseY: 13, mouthY: 22, mouthW: 6.4, neckW: 15, shoulderY: 101, earRy: 6, blush: 0.65, wrinkle: 0, hairTone: 'dark', gray: false },
  teen: { cy: 57, rx: 28.5, ry: 33, jawF: 0.78, jawM: 0.84, eyeY: 2, eyeDx: 12.8, eyeRx: 3, eyeRy: 2.9, browDy: 7.8, browW: 6.4, browScale: 1, noseY: 12.5, mouthY: 22, mouthW: 6.8, neckW: 16, shoulderY: 100, earRy: 6.2, blush: 0.25, wrinkle: 0, hairTone: 'dark', gray: false },
  young: { cy: 56, rx: 28, ry: 34, jawF: 0.72, jawM: 0.8, eyeY: 1, eyeDx: 13, eyeRx: 3.1, eyeRy: 2.7, browDy: 8, browW: 6.8, browScale: 1, noseY: 12.5, mouthY: 22.5, mouthW: 7, neckW: 16.5, shoulderY: 100, earRy: 6.4, blush: 0, wrinkle: 0, hairTone: 'dark', gray: false },
  middle: { cy: 56, rx: 28.5, ry: 34, jawF: 0.74, jawM: 0.82, eyeY: 1.5, eyeDx: 13.2, eyeRx: 3.1, eyeRy: 2.5, browDy: 8, browW: 7, browScale: 1, noseY: 13, mouthY: 23, mouthW: 7, neckW: 17, shoulderY: 100, earRy: 6.6, blush: 0, wrinkle: 1, hairTone: 'dark', gray: true },
  senior: { cy: 57, rx: 28, ry: 34, jawF: 0.74, jawM: 0.82, eyeY: 2, eyeDx: 13.2, eyeRx: 3, eyeRy: 2.3, browDy: 8, browW: 7, browScale: 1, noseY: 13.5, mouthY: 23.5, mouthW: 6.8, neckW: 17, shoulderY: 101, earRy: 7, blush: 0, wrinkle: 2, hairTone: 'gray', gray: false },
  elder: { cy: 58, rx: 27.5, ry: 33.5, jawF: 0.72, jawM: 0.8, eyeY: 2.5, eyeDx: 13.2, eyeRx: 2.9, eyeRy: 2.2, browDy: 8, browW: 6.8, browScale: 0.95, noseY: 14, mouthY: 24, mouthW: 6.4, neckW: 17, shoulderY: 102, earRy: 7.4, blush: 0, wrinkle: 3, hairTone: 'white', gray: false },
};

// ---------- ③ 머리: 기본 표(지금 세상, faceLayers.ts 그대로) ----------
const HAIR = {
  infant: {
    male: { capW: 0.98, capTop: 1.5, hairline: 0.3, fringe: false, sideY: -14, sideLen: 0, backLen: 0, wave: 0, part: 0, accessory: 'tuft' },
    female: { capW: 0.98, capTop: 1.5, hairline: 0.3, fringe: false, sideY: -14, sideLen: 0, backLen: 0, wave: 0, part: 0, accessory: 'topknot' },
  },
  toddler: {
    male: { capW: 1.03, capTop: 2.5, hairline: 0.6, fringe: true, sideY: -8, sideLen: 0, backLen: 0, wave: 0, part: 0 },
    female: { capW: 1.07, capTop: 2.5, hairline: 0.6, fringe: true, sideY: -6, sideLen: 26, backLen: 0, wave: 0, part: 0, accessory: 'clip' },
  },
  child: {
    male: { capW: 1.03, capTop: 3, hairline: 0.46, fringe: false, sideY: -6, sideLen: 0, backLen: 0, wave: 0, part: -7 },
    female: { capW: 1.05, capTop: 3, hairline: 0.46, fringe: false, sideY: -4, sideLen: 6, backLen: 0, wave: 0, part: -7, accessory: 'ponytail' },
  },
  teen: {
    male: { capW: 1.04, capTop: 3.0, hairline: 0.52, fringe: true, sideY: -6, sideLen: 0, backLen: 0, wave: 0, part: 0 },
    female: { capW: 1.07, capTop: 3.5, hairline: 0.44, fringe: false, sideY: -4, sideLen: 38, backLen: 44, wave: 0, part: -7 },
  },
  young: {
    male: { capW: 1.05, capTop: 4.5, hairline: 0.42, fringe: false, sideY: -8, sideLen: 0, backLen: 0, wave: 0, part: -8 },
    female: { capW: 1.09, capTop: 4, hairline: 0.42, fringe: false, sideY: -4, sideLen: 56, backLen: 58, wave: 2, part: -8 },
  },
  middle: {
    male: { capW: 1.04, capTop: 3.5, hairline: 0.44, fringe: false, sideY: -8, sideLen: 0, backLen: 0, wave: 0, part: -8 },
    female: { capW: 1.13, capTop: 4.5, hairline: 0.44, fringe: false, sideY: -4, sideLen: 0, backLen: 0, wave: 2.4, part: -6, flare: 14 },
  },
  senior: {
    male: { capW: 1.03, capTop: 3, hairline: 0.44, fringe: false, sideY: -8, sideLen: 0, backLen: 0, wave: 0, part: -8 },
    female: { capW: 1.13, capTop: 4.5, hairline: 0.44, fringe: false, sideY: -4, sideLen: 0, backLen: 0, wave: 2.6, part: -6, flare: 13 },
  },
  elder: {
    male: { capW: 1.02, capTop: 2.5, hairline: 0.44, fringe: false, sideY: -8, sideLen: 0, backLen: 0, wave: 0, part: -7 },
    female: { capW: 1.11, capTop: 4, hairline: 0.44, fringe: false, sideY: -4, sideLen: 0, backLen: 0, wave: 2.6, part: -5, flare: 12 },
  },
};

// ---------- ③④⑤ 시대 유행 층: 달력 10년대 × 나이대 × 성별 ----------
/**
 * [v2] 유행은 **세대 id가 아니라 달력 연도**(출생 연도 + 나이)의 10년대로 고른다 — 그래야 같은 표 하나로 모든 세대가 맞는다
 * (밀레니얼 1981~96년생의 청소년기 = 1990년대 후반~2000년대, 청년기 = 2000년대 후반~2010년대 / 산업화 1940~54년생의 청년기 = 1960~70년대).
 * 머리는 HAIR 표의 필드에 새 필드 셋(fringeStyle·sideburn·tight)을 더한 값, 옷깃은 collar id, 화장은 makeup id, 안경은 모양 id(쓸지는 시드가 정한다).
 * 피부색·체형은 어느 시대에도 바꾸지 않는다 — 유행은 머리·화장·옷깃·안경으로만.
 */
export const FASHION = {
  // 산업화·전후 세대 청년기 (1960~70년대): 남 — 귀를 덮는 장발·긴 구레나룻·넓은 양복 깃·검은 뿔테 / 여 — 가운데 가르마 긴 생머리·가는 아치 눈썹·아이라인·둥근 블라우스 깃
  '1970s': {
    young: {
      male: { hair: { capW: 1.08, capTop: 4, hairline: 0.44, fringe: true, fringeStyle: 'curtain', sideY: -2, sideLen: 20, backLen: 0, wave: 1.2, part: -5, sideburn: 10 }, collar: 'suit70', makeup: null, glasses: 'horn70' },
      female: { hair: { capW: 1.1, capTop: 3.5, hairline: 0.42, fringe: false, sideY: -4, sideLen: 58, backLen: 60, wave: 0, part: 0 }, collar: 'blouse70', makeup: '70s', glasses: 'horn70' },
    },
  },
  // 밀레니얼 청소년기 (1990년대 후반~2000년대): 남 — 눈썹을 덮는 샤기컷·교복 셔츠 깃과 넥타이·작은 금속테 / 여 — 일자 앞머리·어깨 생머리·교복 둥근 깃과 리본
  '2000s': {
    teen: {
      male: { hair: { capW: 1.06, capTop: 3.5, hairline: 0.62, fringe: true, fringeStyle: 'shag', sideY: -2, sideLen: 0, backLen: 0, wave: 0, part: 0 }, collar: 'uniformM', makeup: null, glasses: 'metal00' },
      female: { hair: { capW: 1.07, capTop: 3.5, hairline: 0.58, fringe: true, fringeStyle: 'straight', sideY: -4, sideLen: 38, backLen: 44, wave: 0, part: 0 }, collar: 'uniformF', makeup: null, glasses: 'metal00' },
    },
  },
  // 밀레니얼 청년기 (2000년대 후반~2010년대): 남 — 옆을 바싹 친 댄디컷(앞머리 내림)·좁은 셔츠 깃·큰 뿔테 / 여 — 시스루 뱅·끝을 만 긴 웨이브·일자 눈썹·틴트 입술·라운드 넥
  '2010s': {
    young: {
      male: { hair: { capW: 0.97, capTop: 5.5, hairline: 0.5, fringe: true, fringeStyle: 'dandy', sideY: -9, sideLen: 0, backLen: 0, wave: 0, part: -4, tight: true }, collar: 'shirt10', makeup: null, glasses: 'round10' },
      female: { hair: { capW: 1.1, capTop: 4, hairline: 0.45, fringe: true, fringeStyle: 'seethrough', sideY: -4, sideLen: 56, backLen: 58, wave: 3.2, part: 0 }, collar: 'tee10', makeup: '10s', glasses: 'round10' },
    },
  },
};

export const ERA_LABEL = { '1970s': '1960~70년대 청년기 (산업화·전후 세대)', '2000s': '1990년대 후반~2000년대 청소년기 (밀레니얼)', '2010s': '2000년대 후반~2010년대 청년기 (밀레니얼)' };

/** 나이대(머리·옷 표의 둘째 키). 지금은 청소년·청년만 시대 표가 있다 — 없는 칸은 기본 표(지금 세상)로 떨어진다 */
function bandOf(ageGroup) {
  return ageGroup;
}
function fashionOf(era, ageGroup, gender) {
  if (!era) return null;
  return FASHION[era]?.[bandOf(ageGroup)]?.[gender] ?? null;
}

// ---------- 그리기 도우미 (faceLayers.ts 그대로) ----------
function headPath(cx, cy, rx, ry, jaw) {
  const k = 0.5523;
  return (
    `M${r(cx - rx)} ${r(cy)}C${r(cx - rx)} ${r(cy - ry * k)} ${r(cx - rx * k)} ${r(cy - ry)} ${r(cx)} ${r(cy - ry)}` +
    `C${r(cx + rx * k)} ${r(cy - ry)} ${r(cx + rx)} ${r(cy - ry * k)} ${r(cx + rx)} ${r(cy)}` +
    `C${r(cx + rx)} ${r(cy + ry * 0.62)} ${r(cx + rx * jaw)} ${r(cy + ry)} ${r(cx)} ${r(cy + ry)}` +
    `C${r(cx - rx * jaw)} ${r(cy + ry)} ${r(cx - rx)} ${r(cy + ry * 0.62)} ${r(cx - rx)} ${r(cy)}Z`
  );
}
const hairColorOf = (tone) => (tone === 'dark' ? COLOR.hair : tone === 'gray' ? COLOR.hairGray : COLOR.hairWhite);

function hairGeom(spec, st, P, tier) {
  const t = tier - 1;
  const vol = P.hairVolume[t];
  const rise = P.hairlineRise[t] * (spec.ry / 34);
  const topY = spec.cy - spec.ry;
  const W = spec.rx * st.capW * (1 + (vol - 1) * 0.7);
  const top = topY - st.capTop * vol;
  const hy = topY + spec.ry * st.hairline - rise;
  const sy = spec.cy + st.sideY - rise * 0.4;
  return { cx: 60, W, top, topY, hy, sy, rx: spec.rx };
}
function domePath(g, spec, st) {
  const { cx, W, top, sy, rx } = g;
  const xe = rx * 0.98;
  const mid = top + (sy - top) * 0.42;
  if (st.backLen > 0) {
    const yEnd = spec.cy + st.backLen;
    return (
      `M${r(cx - W)} ${r(sy + 4)}C${r(cx - W)} ${r(mid)} ${r(cx - W * 0.56)} ${r(top)} ${r(cx)} ${r(top)}C${r(cx + W * 0.56)} ${r(top)} ${r(cx + W)} ${r(mid)} ${r(cx + W)} ${r(sy + 4)}` +
      `L${r(cx + W - 1)} ${r(yEnd - 6)}Q${r(cx + W - 2)} ${r(yEnd)} ${r(cx + W - 9)} ${r(yEnd)}L${r(cx - W + 9)} ${r(yEnd)}Q${r(cx - W + 2)} ${r(yEnd)} ${r(cx - W + 1)} ${r(yEnd - 6)}Z`
    );
  }
  const fl = st.flare ?? 0;
  const yb = sy + 4 + fl;
  return (
    `M${r(cx - xe)} ${r(yb)}Q${r(cx - W + 3)} ${r(yb + 3)} ${r(cx - W - 0.5)} ${r(sy + fl * 0.5)}C${r(cx - W - 1)} ${r(sy - 4)} ${r(cx - W)} ${r(mid)} ${r(cx - W * 0.9)} ${r(top + (sy - top) * 0.25)}` +
    `C${r(cx - W * 0.7)} ${r(top)} ${r(cx - W * 0.3)} ${r(top)} ${r(cx)} ${r(top)}C${r(cx + W * 0.3)} ${r(top)} ${r(cx + W * 0.7)} ${r(top)} ${r(cx + W * 0.9)} ${r(top + (sy - top) * 0.25)}` +
    `C${r(cx + W)} ${r(mid)} ${r(cx + W + 1)} ${r(sy - 4)} ${r(cx + W + 0.5)} ${r(sy + fl * 0.5)}Q${r(cx + W - 3)} ${r(yb + 3)} ${r(cx + xe)} ${r(yb)}Z`
  );
}
/** 앞머리. [v2] fringeStyle: undefined(현행 물결) | 'straight'(일자) | 'shag'(끝이 삐죽한 샤기) | 'dandy'(가지런히 내린 댄디) | 'curtain'(가운데가 갈라진 70년대) | 'seethrough'(가닥 사이가 비는 시스루 — 가닥은 따로 그린다) */
function fringePath(g, st) {
  const { cx, hy, sy, topY, rx } = g;
  const part = st.part;
  const x1 = rx * 0.97;
  const outerTop = topY - 1.3;
  const upper =
    `M${r(cx - x1)} ${r(sy)}C${r(cx - rx * 1.03)} ${r(sy - (sy - topY) * 0.6)} ${r(cx - rx * 0.58)} ${r(outerTop)} ${r(cx)} ${r(outerTop)}` +
    `C${r(cx + rx * 0.58)} ${r(outerTop)} ${r(cx + rx * 1.03)} ${r(sy - (sy - topY) * 0.6)} ${r(cx + x1)} ${r(sy)}`;
  if (st.fringe) {
    const fs = st.fringeStyle;
    if (fs === 'straight' || fs === 'dandy') {
      const dy = fs === 'dandy' ? 1 : 2.4;
      return upper + `L${r(cx + rx * 0.9)} ${r(sy + 1)}C${r(cx + rx * 0.88)} ${r(hy)} ${r(cx + rx * 0.7)} ${r(hy + dy)} ${r(cx + rx * 0.5)} ${r(hy + dy)}L${r(cx - rx * 0.5)} ${r(hy + dy)}C${r(cx - rx * 0.7)} ${r(hy + dy)} ${r(cx - rx * 0.88)} ${r(hy)} ${r(cx - rx * 0.9)} ${r(sy + 1)}Z`;
    }
    if (fs === 'shag') {
      // 끝이 다섯 갈래로 삐죽한 앞머리(2000년대 샤기컷): 눈썹 바로 위까지
      let d = upper + `L${r(cx + rx * 0.92)} ${r(sy + 2)}C${r(cx + rx * 0.9)} ${r(hy - 3)} ${r(cx + rx * 0.82)} ${r(hy + 1)} ${r(cx + rx * 0.74)} ${r(hy + 2)}`;
      const tips = [0.56, 0.3, 0.04, -0.22, -0.48, -0.74];
      let prev = 0.74;
      for (const t of tips) {
        const xm = cx + rx * ((prev + t) / 2);
        d += `L${r(xm)} ${r(hy + 6.5)}L${r(cx + rx * t)} ${r(hy + 2)}`;
        prev = t;
      }
      return d + `C${r(cx - rx * 0.82)} ${r(hy + 1)} ${r(cx - rx * 0.9)} ${r(hy - 3)} ${r(cx - rx * 0.92)} ${r(sy + 2)}Z`;
    }
    if (fs === 'curtain') {
      // 가운데가 갈라져 양옆으로 흐르는 앞머리(1970년대): 이마 가운데가 보인다
      return (
        upper +
        `L${r(cx + rx * 0.93)} ${r(sy + 4)}C${r(cx + rx * 0.9)} ${r(hy + 4)} ${r(cx + rx * 0.72)} ${r(hy + 9)} ${r(cx + rx * 0.5)} ${r(hy + 7)}C${r(cx + rx * 0.3)} ${r(hy + 4)} ${r(cx + rx * 0.14)} ${r(hy + 0.5)} ${r(cx + part * 0.4)} ${r(hy - 2)}` +
        `C${r(cx + part * 0.4 - rx * 0.16)} ${r(hy + 1)} ${r(cx - rx * 0.36)} ${r(hy + 6)} ${r(cx - rx * 0.56)} ${r(hy + 7.5)}C${r(cx - rx * 0.76)} ${r(hy + 9)} ${r(cx - rx * 0.9)} ${r(hy + 4)} ${r(cx - rx * 0.93)} ${r(sy + 4)}Z`
      );
    }
    if (fs === 'seethrough') {
      // 바탕은 이마 중간까지 내려온 얇은 앞머리(가닥 셋은 fringeStrands가 따로 — 사이로 이마가 비친다)
      return upper + `L${r(cx + rx * 0.9)} ${r(sy + 1)}C${r(cx + rx * 0.88)} ${r(hy - 1)} ${r(cx + rx * 0.64)} ${r(hy + 2)} ${r(cx + rx * 0.5)} ${r(hy + 2)}L${r(cx - rx * 0.5)} ${r(hy + 2)}C${r(cx - rx * 0.64)} ${r(hy + 2)} ${r(cx - rx * 0.88)} ${r(hy - 1)} ${r(cx - rx * 0.9)} ${r(sy + 1)}Z`;
    }
    return (
      upper +
      `L${r(cx + rx * 0.9)} ${r(sy + 1)}C${r(cx + rx * 0.86)} ${r(hy - 2)} ${r(cx + rx * 0.7)} ${r(hy + 3)} ${r(cx + rx * 0.5)} ${r(hy + 3)}` +
      `Q${r(cx + rx * 0.3)} ${r(hy + 6)} ${r(cx + rx * 0.1)} ${r(hy + 3)}Q${r(cx - rx * 0.1)} ${r(hy + 6)} ${r(cx - rx * 0.3)} ${r(hy + 3)}` +
      `Q${r(cx - rx * 0.5)} ${r(hy + 6)} ${r(cx - rx * 0.7)} ${r(hy + 3)}C${r(cx - rx * 0.86)} ${r(hy - 2)} ${r(cx - rx * 0.9)} ${r(sy + 1)} ${r(cx - rx * 0.9)} ${r(sy + 1)}Z`
    );
  }
  const temple = hy + (sy - hy) * 0.3;
  return (
    upper +
    `L${r(cx + rx * 0.89)} ${r(sy + 2)}C${r(cx + rx * 0.86)} ${r(sy - 5)} ${r(cx + rx * 0.8)} ${r(temple + 2)} ${r(cx + rx * 0.62)} ${r(temple)}` +
    `C${r(cx + rx * 0.42)} ${r(hy + 1)} ${r(cx + rx * 0.2)} ${r(hy - 1.5)} ${r(cx + part)} ${r(hy - 1.5)}` +
    `C${r(cx + part - rx * 0.22)} ${r(hy - 1)} ${r(cx - rx * 0.4)} ${r(hy + 2)} ${r(cx - rx * 0.62)} ${r(temple + 1)}` +
    `C${r(cx - rx * 0.8)} ${r(temple + 2)} ${r(cx - rx * 0.86)} ${r(sy - 5)} ${r(cx - rx * 0.89)} ${r(sy + 2)}Z`
  );
}
/** [v2] 시스루 뱅: 앞머리 아래끝에서 눈썹 위까지 내려오는 굵은 가닥 셋(사이로 이마가 비친다) */
function fringeStrands(g, spec) {
  const { cx, hy, rx } = g;
  const out = [];
  const yEnd = spec.cy + spec.eyeY - spec.browDy - 2.6;
  for (const t of [-0.36, 0.02, 0.38]) {
    const x0 = cx + rx * t;
    out.push(`M${r(x0)} ${r(hy + 0.5)}C${r(x0 + 0.3)} ${r(hy + 3)} ${r(x0 + 1.2)} ${r(yEnd - 2.5)} ${r(x0 + 1)} ${r(yEnd)}`);
  }
  return out;
}
function panelPath(g, spec, st, side) {
  const { cx, W, sy } = g;
  const len = st.sideLen;
  const yEnd = sy + len;
  const wave = st.wave;
  const xo = cx + side * W;
  const xi = cx + side * (spec.neckW + 4);
  const xb = cx + side * (W - 8);
  return (
    `M${r(xi)} ${r(sy - 6)}L${r(xo)} ${r(sy - 6)}C${r(xo + side * 1.5)} ${r(sy + len * 0.4)} ${r(xo + side * 1)} ${r(yEnd - 8 - wave)} ${r(xo - side * 1)} ${r(yEnd - wave)}` +
    `Q${r((xo + xb) / 2)} ${r(yEnd + 1 + wave)} ${r(xb)} ${r(yEnd - wave * 0.5)}` +
    `Q${r((xb + xi) / 2)} ${r(yEnd + wave * 1.4)} ${r(xi)} ${r(yEnd - 2)}Z`
  );
}
function sheenPaths(g, st, n) {
  const out = [];
  const { cx, topY, hy, rx } = g;
  for (let i = 0; i < n; i++) {
    const t = ((i + 0.5) / n) * 2 - 1;
    const x0 = cx + st.part * 0.7 + t * rx * 0.08;
    const y0 = topY + 1.5;
    const xe = cx + t * rx * 0.78;
    const ye = topY + (hy - topY) * (0.5 + 0.3 * Math.abs(t));
    out.push(`M${r(x0)} ${r(y0)}Q${r(cx + t * rx * 0.62)} ${r(topY + (ye - topY) * 0.18)} ${r(xe)} ${r(ye)}`);
  }
  return out;
}

// ---------- 노드 → 문자열 ----------
function attrs(n) {
  const a = [];
  if (n.fill !== undefined) a.push(`fill="${n.fill}"`);
  if (n.fillOpacity !== undefined && n.fillOpacity !== 1) a.push(`fill-opacity="${r(n.fillOpacity * 100) / 100}"`);
  if (n.stroke !== undefined) a.push(`stroke="${n.stroke}"`);
  if (n.strokeOpacity !== undefined && n.strokeOpacity !== 1) a.push(`stroke-opacity="${r(n.strokeOpacity * 100) / 100}"`);
  if (n.strokeWidth !== undefined) a.push(`stroke-width="${n.strokeWidth}"`);
  if (n.linecap !== undefined) a.push(`stroke-linecap="${n.linecap}"`);
  if (n.linejoin !== undefined) a.push(`stroke-linejoin="${n.linejoin}"`);
  return a.length ? ' ' + a.join(' ') : '';
}
export function nodeToString(n) {
  switch (n.tag) {
    case 'path':
      return `<path d="${n.d}"${attrs(n)}/>`;
    case 'ellipse':
      return `<ellipse cx="${n.cx}" cy="${n.cy}" rx="${n.rx}" ry="${n.ry}"${attrs(n)}/>`;
    case 'rect':
      return `<rect x="${n.x}" y="${n.y}" width="${n.width}" height="${n.height}"${n.rx !== undefined ? ` rx="${n.rx}"` : ''}${attrs(n)}/>`;
    case 'g':
      return `<g data-layer="${n.layer}">${n.children.map(nodeToString).join('')}</g>`;
  }
  return '';
}
const g = (layer, children) => ({ tag: 'g', layer, children });

// ---------- 층 ----------
const bgNode = () => g('background', [{ tag: 'rect', x: 0, y: 0, width: 120, height: 120, fill: COLOR.bg }]);

/** ④ 옷깃. [v2] collar: undefined(현행 한 가지 옷) | 'suit70' | 'blouse70' | 'uniformM' | 'uniformF' | 'shirt10' | 'tee10' */
function clothesNodes(spec, collar) {
  const nw = spec.neckW + 3;
  const sy = spec.shoulderY;
  const dip = spec.neckW > 15 ? 7 : 5;
  const body = `M4 121C4 ${r(sy + 8)} 22 ${r(sy + 1)} ${r(60 - nw)} ${r(sy - 1)}Q60 ${r(sy - 1 + dip)} ${r(60 + nw)} ${r(sy - 1)}C98 ${r(sy + 1)} 116 ${r(sy + 8)} 116 121Z`;
  const collarLine = `M${r(60 - nw)} ${r(sy - 1)}Q60 ${r(sy - 1 + dip)} ${r(60 + nw)} ${r(sy - 1)}`;
  const nodes = [{ tag: 'path', d: body, fill: COLOR.cloth }];
  const shirtV = (open, depth, w) =>
    `M${r(60 - nw - 1)} ${r(sy - 1)}L${r(60 - open)} ${r(sy + depth)}L60 ${r(sy + depth + w)}L${r(60 + open)} ${r(sy + depth)}L${r(60 + nw + 1)} ${r(sy - 1)}Q60 ${r(sy - 1 + dip)} ${r(60 - nw - 1)} ${r(sy - 1)}Z`;
  const line = (d, w = 1.2, op = 0.28) => ({ tag: 'path', d, fill: 'none', stroke: COLOR.line, strokeOpacity: op, strokeWidth: w, linecap: 'round' });
  switch (collar) {
    case 'suit70': {
      // 흰 셔츠 V + 넓은 양복 깃(어두운 면) + 넓은 넥타이
      nodes.push({ tag: 'path', d: shirtV(8, 14, 6), fill: COLOR.shirt });
      for (const s of [-1, 1]) nodes.push({ tag: 'path', d: `M${r(60 + s * (nw + 1))} ${r(sy - 1)}L${r(60 + s * 24)} ${r(sy + 18)}L${r(60 + s * 10)} ${r(sy + 21)}L${r(60 + s * 3)} ${r(sy + 8)}Z`, fill: COLOR.line, fillOpacity: 0.22 });
      nodes.push({ tag: 'path', d: `M${r(60 - 2.2)} ${r(sy + dip + 2)}L${r(60 + 2.2)} ${r(sy + dip + 2)}L${r(60 + 4.2)} 121L${r(60 - 4.2)} 121Z`, fill: COLOR.line, fillOpacity: 0.78 });
      nodes.push(line(collarLine));
      break;
    }
    case 'blouse70': {
      // 둥근 블라우스 깃(피터팬) 두 장
      for (const s of [-1, 1]) nodes.push({ tag: 'path', d: `M${r(60 + s * 1.5)} ${r(sy + dip - 1)}C${r(60 + s * 4)} ${r(sy + 12)} ${r(60 + s * 12)} ${r(sy + 11)} ${r(60 + s * 16)} ${r(sy + 4)}C${r(60 + s * 14)} ${r(sy + 1)} ${r(60 + s * 8)} ${r(sy - 2)} ${r(60 + s * (nw - 1))} ${r(sy - 1)}Q60 ${r(sy - 1 + dip)} ${r(60 + s * 1.5)} ${r(sy + dip - 1)}Z`, fill: COLOR.shirt });
      nodes.push(line(`M60 ${r(sy + dip - 1)}L60 ${r(sy + 16)}`, 1, 0.22));
      break;
    }
    case 'uniformM': {
      // 교복: 흰 셔츠 깃(뾰족) + 좁은 넥타이, 재킷은 바탕 천
      nodes.push({ tag: 'path', d: shirtV(9, 9, 4), fill: COLOR.shirt });
      for (const s of [-1, 1]) nodes.push({ tag: 'path', d: `M${r(60 + s * (nw - 2))} ${r(sy - 1)}L${r(60 + s * 13)} ${r(sy + 10)}L${r(60 + s * 3)} ${r(sy + 8)}Z`, fill: COLOR.shirt, stroke: COLOR.line, strokeOpacity: 0.2, strokeWidth: 0.8, linejoin: 'round' });
      nodes.push({ tag: 'path', d: `M${r(60 - 1.8)} ${r(sy + dip + 1)}L${r(60 + 1.8)} ${r(sy + dip + 1)}L${r(60 + 3)} 121L${r(60 - 3)} 121Z`, fill: COLOR.line, fillOpacity: 0.78 });
      break;
    }
    case 'uniformF': {
      // 교복: 둥근 흰 깃 + 가운데 리본
      for (const s of [-1, 1]) nodes.push({ tag: 'path', d: `M${r(60 + s * 1)} ${r(sy + dip)}C${r(60 + s * 3)} ${r(sy + 10)} ${r(60 + s * 10)} ${r(sy + 10)} ${r(60 + s * 14)} ${r(sy + 3)}C${r(60 + s * 12)} ${r(sy + 0.5)} ${r(60 + s * 8)} ${r(sy - 2)} ${r(60 + s * (nw - 1))} ${r(sy - 1)}Q60 ${r(sy - 1 + dip)} ${r(60 + s * 1)} ${r(sy + dip)}Z`, fill: COLOR.shirt });
      const ry = sy + dip + 4;
      nodes.push({ tag: 'path', d: `M60 ${r(ry)}L${r(60 - 7)} ${r(ry - 3.6)}L${r(60 - 7)} ${r(ry + 3.6)}ZM60 ${r(ry)}L${r(60 + 7)} ${r(ry - 3.6)}L${r(60 + 7)} ${r(ry + 3.6)}Z`, fill: COLOR.line, fillOpacity: 0.8 });
      nodes.push({ tag: 'ellipse', cx: 60, cy: r(ry), rx: 2, ry: 2, fill: COLOR.line, fillOpacity: 0.9 });
      break;
    }
    case 'shirt10': {
      // 좁은 셔츠 깃, 단추 하나 푼 채
      nodes.push({ tag: 'path', d: shirtV(6, 9, 3), fill: COLOR.shirt });
      for (const s of [-1, 1]) nodes.push({ tag: 'path', d: `M${r(60 + s * (nw - 1))} ${r(sy - 1)}L${r(60 + s * 10)} ${r(sy + 9)}L${r(60 + s * 2.5)} ${r(sy + 7)}Z`, fill: COLOR.shirt, stroke: COLOR.line, strokeOpacity: 0.2, strokeWidth: 0.8, linejoin: 'round' });
      break;
    }
    case 'tee10': {
      // 라운드 넥: 깃 테두리 한 줄만 밝게
      nodes.push({ tag: 'path', d: collarLine, fill: 'none', stroke: COLOR.shirt, strokeOpacity: 0.9, strokeWidth: 2.2, linecap: 'round' });
      break;
    }
    default:
      nodes.push(line(collarLine));
  }
  return [g('clothes', nodes)];
}

function neckNode(spec) {
  const nw = spec.neckW;
  const top = spec.cy + spec.ry - 8;
  const bottom = spec.shoulderY + 4;
  return g('neck', [{ tag: 'path', d: `M${r(60 - nw)} ${r(top)}L${r(60 + nw)} ${r(top)}L${r(60 + nw + 1)} ${r(bottom)}L${r(60 - nw - 1)} ${r(bottom)}Z`, fill: COLOR.skinShade }]);
}
function earsAndHead(spec, gender) {
  const jaw = gender === 'female' ? spec.jawF : spec.jawM;
  const earY = spec.cy + spec.eyeY + 2;
  const earX = spec.rx - 0.5;
  return [
    g('ears', [
      { tag: 'ellipse', cx: r(60 - earX - 1.5), cy: r(earY), rx: 4, ry: spec.earRy, fill: COLOR.skinShade },
      { tag: 'ellipse', cx: r(60 + earX + 1.5), cy: r(earY), rx: 4, ry: spec.earRy, fill: COLOR.skinShade },
    ]),
    g('head', [{ tag: 'path', d: headPath(60, spec.cy, spec.rx, spec.ry, jaw), fill: COLOR.skin }]),
  ];
}

/** [v2] B안의 그림자 두 획: 콧날 왼쪽 옆 한 획 + 광대 아래 한 획(양쪽). 살색 그늘(skinShade) — 선이 아니라 면의 명암이다. 단계 1~3은 0(평면) */
function shadeNodes(spec, P, tier) {
  const t = tier - 1;
  const ns = P.noseShade[t];
  const js = P.jawShade[t];
  if (ns <= 0 && js <= 0) return [];
  const ey = spec.cy + spec.eyeY;
  const ny = spec.cy + spec.noseY;
  const nodes = [];
  if (ns > 0) nodes.push({ tag: 'path', d: `M${r(60 - 2.4)} ${r(ey + 3.5)}C${r(60 - 3.2)} ${r(ey + 7)} ${r(60 - 3.4)} ${r(ny - 4)} ${r(60 - 3)} ${r(ny - 0.5)}`, fill: 'none', stroke: COLOR.skinShade, strokeOpacity: ns, strokeWidth: 2.6, linecap: 'round' });
  // 광대 아래 그늘: 관자놀이 아래에서 광대뼈 밑까지 짧게(턱선까지 내리면 수염 자국으로 읽힌다 — 1차 샷 관찰)
  if (js > 0) for (const s of [-1, 1]) nodes.push({ tag: 'path', d: `M${r(60 + s * spec.rx * 0.86)} ${r(spec.cy + spec.ry * 0.14)}C${r(60 + s * spec.rx * 0.84)} ${r(spec.cy + spec.ry * 0.36)} ${r(60 + s * spec.rx * 0.76)} ${r(spec.cy + spec.ry * 0.5)} ${r(60 + s * spec.rx * 0.62)} ${r(spec.cy + spec.ry * 0.58)}`, fill: 'none', stroke: COLOR.skinShade, strokeOpacity: js, strokeWidth: 4, linecap: 'round' });
  return [g('shade', nodes)];
}

/** ② 이목구비. [v2] P = 표현 안의 파라미터 표, makeup = 시대 화장(여성만: '70s' 가는 아치 눈썹·아이라인·입술 / '10s' 일자 눈썹·틴트) */
function featureNodes(spec, gender, P, tier, makeup) {
  const t = tier - 1;
  const lw = P.lineWidth[t];
  const la = P.lineAlpha[t];
  const highlight = P.highlight[t];
  const es = P.eyeScale[t];
  let bw = P.browWidth[t] * spec.browScale * (gender === 'male' ? 1.15 : 1);
  let ba = P.browAlpha[t];
  let bl = spec.browW * P.browLen[t];
  let arch = -2.2; // 눈썹 제어점 높이(음수 = 위로)
  if (makeup === '70s') {
    bw *= 0.55;
    bl *= 0.96;
    arch = -3.6;
    ba = Math.max(ba, 0.9);
  }
  if (makeup === '10s') {
    bw *= 1.2;
    bl *= 0.94;
    arch = -0.7;
    ba = Math.max(ba, 0.9);
  }
  const ey = spec.cy + spec.eyeY;
  const ex = spec.eyeDx;
  const nodes = [];
  if (spec.blush > 0) for (const s of [-1, 1]) nodes.push({ tag: 'ellipse', cx: r(60 + s * (spec.rx * 0.62)), cy: r(ey + 9), rx: 5.2, ry: 3.2, fill: COLOR.blush, fillOpacity: 0.42 * spec.blush });
  const line = (d, w, op = la) => ({ tag: 'path', d, fill: 'none', stroke: COLOR.line, strokeOpacity: op, strokeWidth: r(w), linecap: 'round', linejoin: 'round' });
  for (const s of [-1, 1]) {
    const x = 60 + s * ex;
    const by = ey - spec.browDy;
    nodes.push(line(`M${r(x - bl)} ${r(by + 1.2)}Q${r(x)} ${r(by + arch)} ${r(x + bl)} ${r(by + 0.6 + (s > 0 ? 0.4 : 0))}`, r(bw), ba));
    nodes.push({ tag: 'ellipse', cx: r(x), cy: r(ey), rx: r(spec.eyeRx * (0.5 + es * 0.5)), ry: r(spec.eyeRy * es), fill: COLOR.line, fillOpacity: la });
    nodes.push({ tag: 'ellipse', cx: r(x + 0.9), cy: r(ey - 1.1), rx: 0.95, ry: 0.95, fill: COLOR.eyeWhite, fillOpacity: highlight });
    if (makeup === '70s') {
      // 아이라인: 윗눈꺼풀 선 + 바깥 꼬리
      const rx = spec.eyeRx;
      nodes.push(line(`M${r(x - s * rx)} ${r(ey - 0.6)}Q${r(x)} ${r(ey - spec.eyeRy - 1.2)} ${r(x + s * (rx + 0.6))} ${r(ey - 0.8)}L${r(x + s * (rx + 2.6))} ${r(ey - 2)}`, 1.1, 0.92));
    }
  }
  const ny = spec.cy + spec.noseY;
  nodes.push(line(`M${r(60 - 1.9)} ${r(ny)}Q60 ${r(ny + 2.8)} ${r(60 + 1.9)} ${r(ny)}`, lw * 0.75));
  const my = spec.cy + spec.mouthY;
  if (makeup === '70s' || makeup === '10s') {
    // 입술 색: 선 아래위로 작은 면. 10s는 가운데만(틴트), 70s는 입 전체
    const w = makeup === '10s' ? spec.mouthW * 0.62 : spec.mouthW * 0.96;
    nodes.push({ tag: 'path', d: `M${r(60 - w)} ${r(my)}Q60 ${r(my - 2.2)} ${r(60 + w)} ${r(my)}Q60 ${r(my + 4.6)} ${r(60 - w)} ${r(my)}Z`, fill: COLOR.blush, fillOpacity: makeup === '10s' ? 0.55 : 0.68 });
  }
  nodes.push(line(`M${r(60 - spec.mouthW)} ${r(my)}Q60 ${r(my + 3.6)} ${r(60 + spec.mouthW)} ${r(my)}`, lw * 0.9));
  return [g('features', nodes)];
}

function wrinkleNodes(spec) {
  if (spec.wrinkle === 0) return [];
  const ey = spec.cy + spec.eyeY;
  const ex = spec.eyeDx;
  const nodes = [];
  const w = (d, op = 0.34, sw = 1.1) => ({ tag: 'path', d, fill: 'none', stroke: COLOR.line, strokeOpacity: op, strokeWidth: sw, linecap: 'round' });
  const ny = spec.cy + spec.noseY;
  const my = spec.cy + spec.mouthY;
  const foreheadY = spec.cy - spec.ry * 0.62;
  for (const s of [-1, 1]) nodes.push(w(`M${r(60 + s * 7)} ${r(ny + 1)}Q${r(60 + s * (spec.mouthW + 4.5))} ${r((ny + my) / 2 + 1)} ${r(60 + s * (spec.mouthW + 3))} ${r(my + 2)}`, 0.3));
  nodes.push(w(`M${r(60 - 11)} ${r(foreheadY)}Q60 ${r(foreheadY - 2.2)} ${r(60 + 11)} ${r(foreheadY)}`, 0.26));
  if (spec.wrinkle >= 2) {
    nodes.push(w(`M${r(60 - 14)} ${r(foreheadY + 5)}Q60 ${r(foreheadY + 2.6)} ${r(60 + 14)} ${r(foreheadY + 5)}`, 0.3));
    for (const s of [-1, 1]) {
      nodes.push(w(`M${r(60 + s * (ex + spec.eyeRx + 3))} ${r(ey - 1.5)}L${r(60 + s * (ex + spec.eyeRx + 7.5))} ${r(ey - 3.4)}`, 0.34));
      nodes.push(w(`M${r(60 + s * (ex + spec.eyeRx + 3))} ${r(ey + 0.8)}L${r(60 + s * (ex + spec.eyeRx + 8))} ${r(ey + 1.2)}`, 0.34));
    }
  }
  if (spec.wrinkle >= 3) {
    nodes.push(w(`M${r(60 - 16)} ${r(foreheadY + 10)}Q60 ${r(foreheadY + 7.6)} ${r(60 + 16)} ${r(foreheadY + 10)}`, 0.3));
    for (const s of [-1, 1]) {
      nodes.push(w(`M${r(60 + s * (ex - 4))} ${r(ey + spec.eyeRy + 2.6)}Q${r(60 + s * ex)} ${r(ey + spec.eyeRy + 4.6)} ${r(60 + s * (ex + 4))} ${r(ey + spec.eyeRy + 2.6)}`, 0.3));
      nodes.push(w(`M${r(60 + s * (spec.rx * 0.78))} ${r(my - 3)}Q${r(60 + s * (spec.rx * 0.7))} ${r(my + 3)} ${r(60 + s * (spec.rx * 0.6))} ${r(my + 8)}`, 0.26));
    }
  }
  return [g('wrinkles', nodes)];
}

/** ⑤ 안경 (소품 층 — 머리 앞머리 아래, 이목구비 위). [v2] 모양은 시대가, 쓸지는 판의 시드가 정한다. 외모 단계·수저와 무관 */
function glassesNodes(spec, kind) {
  if (!kind) return [];
  const ey = spec.cy + spec.eyeY;
  const ex = spec.eyeDx;
  const nodes = [];
  const st = kind === 'metal00' ? { stroke: COLOR.hairGray, strokeOpacity: 0.95, strokeWidth: 1.1 } : { stroke: COLOR.line, strokeOpacity: 0.95, strokeWidth: kind === 'horn70' ? 2.3 : 2.0 };
  const half = { horn70: [spec.eyeRx + 5, spec.eyeRy + 3.8], metal00: [spec.eyeRx + 3.2, spec.eyeRy + 2.4], round10: [spec.eyeRx + 5.2, spec.eyeRx + 5.2] }[kind];
  for (const s of [-1, 1]) {
    const x = 60 + s * ex;
    if (kind === 'horn70') nodes.push({ tag: 'rect', x: r(x - half[0]), y: r(ey - half[1]), width: r(half[0] * 2), height: r(half[1] * 2), rx: 3, fill: 'none', ...st });
    else nodes.push({ tag: 'ellipse', cx: r(x), cy: r(ey), rx: r(half[0]), ry: r(half[1]), fill: 'none', ...st });
  }
  // 브리지 + 다리(관자놀이까지)
  nodes.push({ tag: 'path', d: `M${r(60 - ex + half[0])} ${r(ey - 0.5)}L${r(60 + ex - half[0])} ${r(ey - 0.5)}`, fill: 'none', ...st, linecap: 'round' });
  for (const s of [-1, 1]) nodes.push({ tag: 'path', d: `M${r(60 + s * (ex + half[0]))} ${r(ey - 0.5)}L${r(60 + s * (spec.rx - 0.5))} ${r(ey - 1.5)}`, fill: 'none', ...st, linecap: 'round' });
  return [g('glasses', nodes)];
}

/** ③ 머리 (faceLayers.ts 구조 + [v2] 시대 필드: fringeStyle·sideburn·tight) */
function hairNodes(spec, st, P, tier) {
  const t = tier - 1;
  const geo = hairGeom(spec, st, P, tier);
  const color = hairColorOf(spec.hairTone);
  const edge = spec.hairTone !== 'dark';
  const edgeStyle = edge ? { stroke: COLOR.hairEdge, strokeOpacity: 0.7, strokeWidth: 0.9, linejoin: 'round' } : {};
  const hairFill = { fill: color, ...edgeStyle };
  const back = [];
  const mid = [];
  const front = [];
  back.push(g('hair-back', [{ tag: 'path', d: domePath(geo, spec, st), ...hairFill }]));
  const vol = P.hairVolume[t];
  const ptX = 60 + spec.rx * 0.8;
  const ptY = spec.cy - spec.ry * 0.7;
  if (st.accessory === 'ponytail') {
    const k = 0.8 + vol * 0.2;
    back.push(g('hair-back', [{ tag: 'path', d: `M${r(ptX)} ${r(ptY)}C${r(ptX + 20 * k)} ${r(ptY - 12)} ${r(ptX + 30 * k)} ${r(ptY + 18)} ${r(ptX + 12 * k)} ${r(ptY + 40)}C${r(ptX + 8)} ${r(ptY + 28)} ${r(ptX + 2)} ${r(ptY + 14)} ${r(ptX - 6)} ${r(ptY + 8)}Z`, ...hairFill }]));
  }
  if (st.sideLen > 18) for (const s of [-1, 1]) mid.push(g('hair-mid', [{ tag: 'path', d: panelPath(geo, spec, st, s), ...hairFill }]));
  const fc = [];
  fc.push({ tag: 'path', d: fringePath(geo, st), ...hairFill });
  if (st.fringeStyle === 'seethrough') for (const d of fringeStrands(geo, spec)) fc.push({ tag: 'path', d, fill: 'none', stroke: color, strokeWidth: 3.4, linecap: 'round' });
  if (st.sideburn) {
    // [v2] 긴 구레나룻(1970년대 남): 귀 앞을 따라 내려오는 좁은 띠
    for (const s of [-1, 1]) {
      const x = 60 + s * (spec.rx * 0.9);
      fc.push({ tag: 'path', d: `M${r(x - s * 2.2)} ${r(geo.sy - 2)}L${r(x + s * 1.4)} ${r(geo.sy - 2)}L${r(x + s * 0.6)} ${r(geo.sy + st.sideburn)}L${r(x - s * 2.6)} ${r(geo.sy + st.sideburn - 1)}Z`, fill: color });
    }
  }
  if (!st.fringe) fc.push({ tag: 'path', d: `M${r(60 + st.part)} ${r(geo.hy - 1.2)}Q${r(60 + st.part - 1.5)} ${r(geo.topY + (geo.hy - geo.topY) * 0.45)} ${r(60 + st.part * 0.5)} ${r(geo.topY + 1.2)}`, fill: 'none', stroke: edge ? COLOR.hairEdge : '#000000', strokeOpacity: edge ? 0.5 : 0.35, strokeWidth: 1, linecap: 'round' });
  for (const d of sheenPaths(geo, st, P.sheen[t])) fc.push({ tag: 'path', d, fill: 'none', stroke: '#FFFFFF', strokeOpacity: spec.hairTone === 'white' ? 0 : 0.17, strokeWidth: 1.6, linecap: 'round' });
  if (spec.hairTone === 'white' && !st.fringe) for (const d of sheenPaths(geo, st, 3)) fc.push({ tag: 'path', d, fill: 'none', stroke: COLOR.hairGray, strokeOpacity: 0.55, strokeWidth: 1.2, linecap: 'round' });
  if (spec.gray) for (const s of [-1, 1]) {
    const x = 60 + s * (geo.rx * 0.93);
    fc.push({ tag: 'path', d: `M${r(x)} ${r(geo.sy + 1.5)}L${r(x + s * 0.3)} ${r(geo.sy - 4.5)}`, fill: 'none', stroke: COLOR.hairGray, strokeOpacity: 0.9, strokeWidth: 2.2, linecap: 'round' });
  }
  if (st.accessory === 'tuft') fc.push({ tag: 'path', d: `M${r(60 - 2)} ${r(geo.topY + 2)}C${r(60 - 3)} ${r(geo.topY - 9)} ${r(60 + 8)} ${r(geo.topY - 8)} ${r(60 + 5)} ${r(geo.topY - 2)}`, fill: 'none', stroke: color, strokeWidth: 2.6 * (0.9 + vol * 0.1), linecap: 'round' });
  if (st.accessory === 'topknot') {
    const kr = 4.6 * (0.85 + vol * 0.15);
    fc.push({ tag: 'ellipse', cx: 60, cy: r(geo.topY - 2), rx: r(kr), ry: r(kr), fill: color });
    fc.push({ tag: 'path', d: `M${r(60 - 5)} ${r(geo.topY + 2.4)}Q60 ${r(geo.topY + 5)} ${r(60 + 5)} ${r(geo.topY + 2.4)}`, fill: 'none', stroke: COLOR.cloth, strokeWidth: 2.2, linecap: 'round' });
  }
  if (st.accessory === 'clip') {
    const x = 60 - spec.rx * 0.56;
    const y = geo.hy + 4;
    fc.push({ tag: 'path', d: `M${r(x)} ${r(y)}L${r(x - 5)} ${r(y - 3.4)}L${r(x - 5)} ${r(y + 3.4)}ZM${r(x)} ${r(y)}L${r(x + 5)} ${r(y - 3.4)}L${r(x + 5)} ${r(y + 3.4)}Z`, fill: COLOR.cloth });
    fc.push({ tag: 'ellipse', cx: r(x), cy: r(y), rx: 1.8, ry: 1.8, fill: COLOR.cloth });
  }
  if (st.accessory === 'ponytail') fc.push({ tag: 'ellipse', cx: r(ptX - 1), cy: r(ptY + 4), rx: 3, ry: 3.6, fill: COLOR.cloth });
  front.push(g('hair-front', fc));
  return { back, mid, front };
}

/**
 * 얼굴 한 장의 노드 목록.
 * input: { ageGroup, gender, tier(1~5), variant('cur'|'A'|'B'|'C'|'AB'), era(null|'1970s'|'2000s'|'2010s'), glasses(boolean) }
 */
export function faceV2Nodes(input, options = {}) {
  const spec = AGE_SPECS[input.ageGroup];
  const P = VARIANTS[input.variant ?? 'cur'];
  const fashion = fashionOf(input.era, input.ageGroup, input.gender);
  const st = fashion ? fashion.hair : HAIR[input.ageGroup][input.gender];
  const hair = hairNodes(spec, st, P, input.tier);
  const nodes = [];
  if (options.background !== false) nodes.push(bgNode());
  nodes.push(...hair.back);
  nodes.push(neckNode(spec));
  nodes.push(...clothesNodes(spec, fashion?.collar));
  nodes.push(...hair.mid);
  nodes.push(...earsAndHead(spec, input.gender));
  nodes.push(...shadeNodes(spec, P, input.tier));
  nodes.push(...featureNodes(spec, input.gender, P, input.tier, fashion?.makeup ?? null));
  nodes.push(...wrinkleNodes(spec));
  nodes.push(...glassesNodes(spec, input.glasses ? fashion?.glasses : null));
  nodes.push(...hair.front);
  return nodes;
}

export function faceV2Svg(input, options = {}) {
  const dim = options.size !== undefined ? ` width="${options.size}" height="${options.size}"` : '';
  const a11y = options.label ? ` role="img" aria-label="${options.label}"` : ' aria-hidden="true"';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${FACE_VIEWBOX}"${dim}${a11y} style="forced-color-adjust:none">${faceV2Nodes(input, options).map(nodeToString).join('')}</svg>`;
}
