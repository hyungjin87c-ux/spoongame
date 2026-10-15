/**
 * 캐릭터 얼굴 2D 레이어 생성 (SPEC-003 DS4·DS5, designer가 만든 명세 구현 — developer는 이 함수를 그대로 쓰거나 같은 규칙으로 컴포넌트를 만든다).
 *
 * 한 얼굴 = 연령대 8 × 성별 2 × 외모 단계 5 = 80조합. 부품(얼굴형·귀·머리·눈·눈썹·코·입·주름·옷)을 레이어로 쌓아서 만든다.
 * 이 파일은 순수 함수만 담고 React·DOM·Date·Math.random을 쓰지 않는다. 같은 입력은 항상 같은 그림이다.
 * 결과는 프레임워크와 상관없는 노드 목록(FaceNode[])이다 — React는 재귀로 JSX를, 테스트·정적 시안은 faceSvg()로 문자열을 만든다.
 *
 * 규칙 (docs/design/faces.md에 사유와 함께 적혀 있다)
 *  1. 외모가 높을수록 머리숱·이목구비 선명도가 높다: TIER_PARAMS의 숱·선명도 표는 단계에 대해 비감소(헤어라인 높이는 비증가). tests/designAssets.test.ts가 단언한다.
 *     숱은 **실루엣 부피(폭·높이·옆머리 두께)와 가장자리**로만 표현한다. 머리 채움색·불투명도는 모든 단계에서 같다(옅은 머리 = 희끗·늙어 보임, REV-003-D-1 R-126).
 *     두피가 드러나는 가닥·탈모 표현은 쓰지 않고, 이마(헤어라인) 상승은 최대 2px이다.
 *  2. 주름·흰머리·희끗한 구레나룻은 연령대가 정한다(AGE_SPECS). 외모 단계는 이 표시에 손대지 않는다.
 *  3. 눈·코·입의 크기와 위치, **부품의 종류**는 단계와 무관하다(연령대·성별만 정한다). 단계는 선 굵기·진하기(명암 대비)·눈 하이라이트 밝기와 머리숱만 바꾼다.
 *     쌍꺼풀·콧날처럼 특정 미의 기준을 뜻하는 구조는 어느 단계에도 더하지 않는다(R-135②).
 *  4. 피부색은 한 톤(--c-face-skin)이고 외모 단계와 연동하지 않는다. 표정은 모든 단계에서 같은 담담한 미소다.
 *  5. 색은 CSS 변수(src/styles/tokens.css의 --c-face-*)를 읽고, 없으면 기본값(라이트)으로 그려진다. 강제 색상 모드에서는
 *     얼굴 <svg>에 forced-color-adjust: none 을 건다(의미 있는 색이 아니라 그림이므로).
 */

export type Gender = 'female' | 'male';
export type AgeGroupId = 'infant' | 'toddler' | 'child' | 'teen' | 'young' | 'middle' | 'senior' | 'elder';
export type LooksTier = 1 | 2 | 3 | 4 | 5;

export interface AgeGroupInfo {
  id: AgeGroupId;
  label: string;
  /** 이 연령대의 첫 나이(포함) */
  minAge: number;
}

/** 연령대 8단계 (SPEC DS4). 경계 나이 = 다음 연령대의 minAge. 나이가 경계를 넘으면 얼굴이 바뀐다. */
export const AGE_GROUPS: readonly AgeGroupInfo[] = [
  { id: 'infant', label: '영아', minAge: 0 }, // 0~2
  { id: 'toddler', label: '유아', minAge: 3 }, // 3~6
  { id: 'child', label: '아동', minAge: 7 }, // 7~12
  { id: 'teen', label: '청소년', minAge: 13 }, // 13~19
  { id: 'young', label: '청년', minAge: 20 }, // 20~39
  { id: 'middle', label: '중년', minAge: 40 }, // 40~59
  { id: 'senior', label: '장년', minAge: 60 }, // 60~74
  { id: 'elder', label: '노년', minAge: 75 }, // 75~
];

/** 나이 → 연령대. 음수·NaN은 영아, 소수는 내림한다. */
export function ageGroupOf(age: number): AgeGroupId {
  const a = Number.isFinite(age) ? Math.floor(age) : 0;
  let id: AgeGroupId = 'infant';
  for (const g of AGE_GROUPS) if (a >= g.minAge) id = g.id;
  return id;
}

/**
 * 외모 점수(0~100) → 외모 단계 1~5. 외모 분포(core/birth.ts#looksPmf)에서 나온 백분위 구간이다.
 *   5: 상위 약 10% 이내(looksTopPercent ≤ 10, 점수 72~)   4: 상위 11~30%(60~71)   3: 가운데 40%(41~59)
 *   2: 하위 11~30%(28~40)                                  1: 하위 약 10% 이내(~27)
 * 각 구간의 확률: 5단계 10.3 / 4단계 18.6 / 3단계 40.8 / 2단계 20.3 / 1단계 9.9 (%). 점검 스크립트: scripts/design/checkFaceTiers.ts
 */
export const LOOKS_TIER_MIN_SCORE = [0, 28, 41, 60, 72] as const;
export function looksTierOf(looks: number): LooksTier {
  const v = Number.isFinite(looks) ? looks : 50;
  let tier: LooksTier = 1;
  LOOKS_TIER_MIN_SCORE.forEach((min, i) => {
    if (v >= min) tier = (i + 1) as LooksTier;
  });
  return tier;
}

/**
 * 외모 단계별 파라미터 표. 인덱스 0 = 1단계, 4 = 5단계.
 * 비감소여야 하는 표(숱·선명도 계열)와 비증가여야 하는 표(hairlineRise)를 tests가 단언한다 — 값을 바꿀 때 이 성질만 지키면 된다.
 */
export const TIER_PARAMS = {
  /** 머리숱 단계(1~5). 높을수록 풍성 */
  hairDensity: [1, 2, 3, 4, 5],
  /** 헤어라인이 올라간 정도(px, 성인 기준 머리 높이 34에서). 클수록 이마가 아주 조금 넓다. 비증가. 탈모로 읽히지 않도록 최대 2px (R-126) */
  hairlineRise: [2, 1, 0, 0, 0],
  /** 머리 부피 배율(폭·높이·옆머리 두께). 비감소 — 숱의 주된 표현 */
  hairVolume: [0.8, 0.9, 1, 1.1, 1.2],
  /** 머리 전체의 채움 불투명도. **모든 단계 1** — 머리색은 연령대만 정한다(옅어지면 희끗·늙어 보인다, R-126). 비감소 */
  hairFillAlpha: [1, 1, 1, 1, 1],
  /** 머리 뒤쪽 부피(정수리·뒷머리·긴 옆머리) 표시. 모든 단계에서 그린다(1) — 비감소 */
  hairBackAlpha: [1, 1, 1, 1, 1],
  /** 윤기·결 줄 개수(풍성한 단계의 질감, 머리 위 흰 선 17%). 비감소 */
  sheenCount: [0, 1, 2, 4, 6],
  /** 이목구비 선명도 단계(1~5) */
  featureClarity: [1, 2, 3, 4, 5],
  /** 이목구비 선 굵기(viewBox 단위). 비감소 */
  lineWidth: [1.6, 2.0, 2.4, 2.8, 3.2],
  /** 이목구비 선 불투명도. 가장 낮은 단계도 피부와 3:1 이상이 되도록 0.62 이상 */
  lineAlpha: [0.62, 0.74, 0.86, 0.94, 1],
  /** 눈썹 굵기 */
  browWidth: [1.4, 1.8, 2.3, 2.8, 3.2],
  /** 눈 하이라이트(흰 점)의 밝기. 모든 단계에 같은 크기·자리의 점이 있고 밝기만 다르다 — 구조 추가 없이 명암으로만(R-135②). 비감소 */
  eyeHighlightAlpha: [0.3, 0.45, 0.6, 0.78, 0.95],
} as const;

export const FACE_VIEWBOX = '0 0 120 120';

// ---------- 노드 ----------
export interface FaceStyle {
  fill?: string;
  fillOpacity?: number;
  stroke?: string;
  strokeOpacity?: number;
  strokeWidth?: number;
  linecap?: 'round' | 'butt';
  linejoin?: 'round' | 'miter';
}
export type FaceNode =
  | ({ tag: 'path'; d: string } & FaceStyle)
  | ({ tag: 'ellipse'; cx: number; cy: number; rx: number; ry: number } & FaceStyle)
  | ({ tag: 'rect'; x: number; y: number; width: number; height: number; rx?: number } & FaceStyle)
  | { tag: 'g'; layer: string; opacity?: number; children: FaceNode[] };

export interface FaceInput {
  ageGroup: AgeGroupId;
  gender: Gender;
  tier: LooksTier;
}
export interface FaceOptions {
  /** 바탕 사각형을 그릴지(기본 true). UI가 모서리를 깎는다 */
  background?: boolean;
}

// ---------- 색 (CSS 변수 + 라이트 기본값) ----------
const COLOR = {
  skin: 'var(--c-face-skin,#F1C9A5)',
  skinShade: 'var(--c-face-skin-shade,#E3B38C)',
  line: 'var(--c-face-line,#4A362C)',
  hair: 'var(--c-face-hair,#2B2420)',
  hairGray: 'var(--c-face-hair-gray,#85817B)',
  hairWhite: 'var(--c-face-hair-white,#D6D2CA)',
  hairEdge: 'var(--c-face-hair-edge,#4A453D)',
  cloth: 'var(--c-face-cloth,#6C7F9E)',
  bg: 'var(--c-face-bg,#E8E3D6)',
  blush: 'var(--c-face-blush,#E8998D)',
  eyeWhite: '#FFFFFF',
} as const;

const r = (v: number): number => Math.round(v * 10) / 10;

// ---------- 연령대 표 ----------
interface AgeSpec {
  /** 머리 중심 y, 가로·세로 반지름 */
  cy: number;
  rx: number;
  ry: number;
  /** 턱 폭 계수(작을수록 뾰족). 여성/남성 */
  jawF: number;
  jawM: number;
  /** 눈 위치(머리 중심 대비 y), 눈 사이 절반 간격, 눈 크기 */
  eyeY: number;
  eyeDx: number;
  eyeRx: number;
  eyeRy: number;
  /** 눈썹: 눈 위 간격, 길이 절반, 굵기 배율 */
  browDy: number;
  browW: number;
  browScale: number;
  /** 코·입 위치(머리 중심 대비 y), 입 폭 절반 */
  noseY: number;
  mouthY: number;
  mouthW: number;
  /** 목 폭 절반, 어깨 시작 y, 귀 크기 */
  neckW: number;
  shoulderY: number;
  earRy: number;
  /** 볼 홍조 세기 0~1 */
  blush: number;
  /** 주름 단계 0~3 (연령대 표시) */
  wrinkle: 0 | 1 | 2 | 3;
  /** 머리색 */
  hairTone: 'dark' | 'gray' | 'white';
  /** 구레나룻이 희끗한가(중년) */
  gray: boolean;
}

const AGE_SPECS: Record<AgeGroupId, AgeSpec> = {
  infant: { cy: 62, rx: 33, ry: 30, jawF: 0.96, jawM: 0.96, eyeY: 5, eyeDx: 12, eyeRx: 2.4, eyeRy: 3, browDy: 7, browW: 4.5, browScale: 0.45, noseY: 15, mouthY: 22, mouthW: 5, neckW: 14, shoulderY: 101, earRy: 5.5, blush: 1, wrinkle: 0, hairTone: 'dark', gray: false },
  toddler: { cy: 60, rx: 31.5, ry: 31, jawF: 0.92, jawM: 0.92, eyeY: 4, eyeDx: 12.4, eyeRx: 2.5, eyeRy: 3.1, browDy: 7.4, browW: 5.2, browScale: 0.6, noseY: 14, mouthY: 22, mouthW: 5.6, neckW: 14.5, shoulderY: 101, earRy: 5.5, blush: 0.9, wrinkle: 0, hairTone: 'dark', gray: false },
  child: { cy: 58, rx: 30, ry: 32, jawF: 0.86, jawM: 0.88, eyeY: 3, eyeDx: 12.6, eyeRx: 2.7, eyeRy: 3.2, browDy: 7.6, browW: 5.8, browScale: 0.8, noseY: 13, mouthY: 22, mouthW: 6.4, neckW: 15, shoulderY: 101, earRy: 6, blush: 0.65, wrinkle: 0, hairTone: 'dark', gray: false },
  teen: { cy: 57, rx: 28.5, ry: 33, jawF: 0.78, jawM: 0.84, eyeY: 2, eyeDx: 12.8, eyeRx: 3, eyeRy: 2.9, browDy: 7.8, browW: 6.4, browScale: 1, noseY: 12.5, mouthY: 22, mouthW: 6.8, neckW: 16, shoulderY: 100, earRy: 6.2, blush: 0.25, wrinkle: 0, hairTone: 'dark', gray: false },
  young: { cy: 56, rx: 28, ry: 34, jawF: 0.72, jawM: 0.8, eyeY: 1, eyeDx: 13, eyeRx: 3.1, eyeRy: 2.7, browDy: 8, browW: 6.8, browScale: 1, noseY: 12.5, mouthY: 22.5, mouthW: 7, neckW: 16.5, shoulderY: 100, earRy: 6.4, blush: 0, wrinkle: 0, hairTone: 'dark', gray: false },
  middle: { cy: 56, rx: 28.5, ry: 34, jawF: 0.74, jawM: 0.82, eyeY: 1.5, eyeDx: 13.2, eyeRx: 3.1, eyeRy: 2.5, browDy: 8, browW: 7, browScale: 1, noseY: 13, mouthY: 23, mouthW: 7, neckW: 17, shoulderY: 100, earRy: 6.6, blush: 0, wrinkle: 1, hairTone: 'dark', gray: true },
  senior: { cy: 57, rx: 28, ry: 34, jawF: 0.74, jawM: 0.82, eyeY: 2, eyeDx: 13.2, eyeRx: 3, eyeRy: 2.3, browDy: 8, browW: 7, browScale: 1, noseY: 13.5, mouthY: 23.5, mouthW: 6.8, neckW: 17, shoulderY: 101, earRy: 7, blush: 0, wrinkle: 2, hairTone: 'gray', gray: false },
  elder: { cy: 58, rx: 27.5, ry: 33.5, jawF: 0.72, jawM: 0.8, eyeY: 2.5, eyeDx: 13.2, eyeRx: 2.9, eyeRy: 2.2, browDy: 8, browW: 6.8, browScale: 0.95, noseY: 14, mouthY: 24, mouthW: 6.4, neckW: 17, shoulderY: 102, earRy: 7.4, blush: 0, wrinkle: 3, hairTone: 'white', gray: false },
};

// ---------- 머리 모양 표 ----------
interface HairStyle {
  /** 뒤쪽 부피: 머리 폭 배율(×rx), 꼭대기 위로 솟는 정도(px) */
  capW: number;
  capTop: number;
  /** 헤어라인 높이: 0 = 머리 꼭대기, 1 = 눈썹 높이 */
  hairline: number;
  /** 앞머리(헤어라인이 낮고 평평) */
  fringe: boolean;
  /** 구레나룻 끝(머리 중심 대비 y), 옆머리 길이(구레나룻 끝에서 아래로 px), 뒷머리 길이(머리 중심 아래로 px, 0이면 없음) */
  sideY: number;
  sideLen: number;
  backLen: number;
  /** 끝단 물결 크기(파마) */
  wave: number;
  /** 가르마 x 오프셋 */
  part: number;
  /** 파마 끝이 옆으로 말려 내려오는 정도(px). 옆머리 층 없이 뒤쪽 부피만 쓰는 짧은 머리용 */
  flare?: number;
  accessory?: 'tuft' | 'topknot' | 'ponytail' | 'clip';
}

const HAIR: Record<AgeGroupId, Record<Gender, HairStyle>> = {
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
    // 남: 앞머리를 내린 학생 머리(헤어라인이 낮고 평평) — 옆가르마의 청년 남성과 한눈에 갈린다(REV-003-D-2 관찰, 외모 단계와 무관한 연령 단서)
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

// ---------- 그리기 도우미 ----------
function headPath(cx: number, cy: number, rx: number, ry: number, jaw: number): string {
  const k = 0.5523;
  return (
    `M${r(cx - rx)} ${r(cy)}C${r(cx - rx)} ${r(cy - ry * k)} ${r(cx - rx * k)} ${r(cy - ry)} ${r(cx)} ${r(cy - ry)}` +
    `C${r(cx + rx * k)} ${r(cy - ry)} ${r(cx + rx)} ${r(cy - ry * k)} ${r(cx + rx)} ${r(cy)}` +
    `C${r(cx + rx)} ${r(cy + ry * 0.62)} ${r(cx + rx * jaw)} ${r(cy + ry)} ${r(cx)} ${r(cy + ry)}` +
    `C${r(cx - rx * jaw)} ${r(cy + ry)} ${r(cx - rx)} ${r(cy + ry * 0.62)} ${r(cx - rx)} ${r(cy)}Z`
  );
}

function hairColorOf(tone: AgeSpec['hairTone']): string {
  return tone === 'dark' ? COLOR.hair : tone === 'gray' ? COLOR.hairGray : COLOR.hairWhite;
}

interface HairGeom {
  cx: number;
  /** 뒤쪽 부피의 가로 반폭 */
  W: number;
  /** 뒤쪽 부피 꼭대기 y, 머리 꼭대기 y */
  top: number;
  topY: number;
  /** 헤어라인 중심 y, 구레나룻 끝 y */
  hy: number;
  sy: number;
  rx: number;
}

function hairGeom(spec: AgeSpec, st: HairStyle, tier: LooksTier): HairGeom {
  const t = tier - 1;
  const vol = TIER_PARAMS.hairVolume[t];
  const rise = TIER_PARAMS.hairlineRise[t] * (spec.ry / 34);
  const topY = spec.cy - spec.ry;
  const W = spec.rx * st.capW * (1 + (vol - 1) * 0.7);
  const top = topY - st.capTop * vol;
  const hy = topY + spec.ry * st.hairline - rise;
  const sy = spec.cy + st.sideY - rise * 0.4;
  return { cx: 60, W, top, topY, hy, sy, rx: spec.rx };
}

/** 머리 뒤쪽 부피(머리 뒤에 그려진다): 정수리·옆으로 머리 윤곽 바깥에 솟는 부분. 긴 머리는 뒷머리까지 */
function domePath(g: HairGeom, spec: AgeSpec, st: HairStyle): string {
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

/** 앞머리(머리 위에 그려진다): 머리 윗부분을 덮고, 아래 가장자리가 헤어라인 */
function fringePath(g: HairGeom, st: HairStyle): string {
  const { cx, hy, sy, topY, rx } = g;
  const part = st.part;
  const x1 = rx * 0.97;
  const outerTop = topY - 1.3;
  const upper =
    `M${r(cx - x1)} ${r(sy)}C${r(cx - rx * 1.03)} ${r(sy - (sy - topY) * 0.6)} ${r(cx - rx * 0.58)} ${r(outerTop)} ${r(cx)} ${r(outerTop)}` +
    `C${r(cx + rx * 0.58)} ${r(outerTop)} ${r(cx + rx * 1.03)} ${r(sy - (sy - topY) * 0.6)} ${r(cx + x1)} ${r(sy)}`;
  if (st.fringe) {
    // 앞머리: 눈썹 위에서 가로로 이어지는 낮은 선(끝이 살짝 물결)
    return (
      upper +
      `L${r(cx + rx * 0.9)} ${r(sy + 1)}C${r(cx + rx * 0.86)} ${r(hy - 2)} ${r(cx + rx * 0.7)} ${r(hy + 3)} ${r(cx + rx * 0.5)} ${r(hy + 3)}` +
      `Q${r(cx + rx * 0.3)} ${r(hy + 6)} ${r(cx + rx * 0.1)} ${r(hy + 3)}Q${r(cx - rx * 0.1)} ${r(hy + 6)} ${r(cx - rx * 0.3)} ${r(hy + 3)}` +
      `Q${r(cx - rx * 0.5)} ${r(hy + 6)} ${r(cx - rx * 0.7)} ${r(hy + 3)}C${r(cx - rx * 0.86)} ${r(hy - 2)} ${r(cx - rx * 0.9)} ${r(sy + 1)} ${r(cx - rx * 0.9)} ${r(sy + 1)}Z`
    );
  }
  // 자연스러운 헤어라인: 구레나룻 → 관자놀이(오목) → 이마 → 가르마
  const temple = hy + (sy - hy) * 0.3;
  return (
    upper +
    `L${r(cx + rx * 0.89)} ${r(sy + 2)}C${r(cx + rx * 0.86)} ${r(sy - 5)} ${r(cx + rx * 0.8)} ${r(temple + 2)} ${r(cx + rx * 0.62)} ${r(temple)}` +
    `C${r(cx + rx * 0.42)} ${r(hy + 1)} ${r(cx + rx * 0.2)} ${r(hy - 1.5)} ${r(cx + part)} ${r(hy - 1.5)}` +
    `C${r(cx + part - rx * 0.22)} ${r(hy - 1)} ${r(cx - rx * 0.4)} ${r(hy + 2)} ${r(cx - rx * 0.62)} ${r(temple + 1)}` +
    `C${r(cx - rx * 0.8)} ${r(temple + 2)} ${r(cx - rx * 0.86)} ${r(sy - 5)} ${r(cx - rx * 0.89)} ${r(sy + 2)}Z`
  );
}

/** 긴 옆머리 한쪽(옷 위·머리 아래 층). 얼굴에 가려지는 안쪽은 목 옆까지 이어 둔다 */
function panelPath(g: HairGeom, spec: AgeSpec, st: HairStyle, side: -1 | 1): string {
  const { cx, W, sy } = g;
  const len = st.sideLen;
  const yEnd = sy + len;
  const wave = st.wave;
  const xo = cx + side * W; // 바깥
  const xi = cx + side * (spec.neckW + 4); // 안쪽(목 옆)
  const xb = cx + side * (W - 8);
  return (
    `M${r(xi)} ${r(sy - 6)}L${r(xo)} ${r(sy - 6)}C${r(xo + side * 1.5)} ${r(sy + len * 0.4)} ${r(xo + side * 1)} ${r(yEnd - 8 - wave)} ${r(xo - side * 1)} ${r(yEnd - wave)}` +
    `Q${r((xo + xb) / 2)} ${r(yEnd + 1 + wave)} ${r(xb)} ${r(yEnd - wave * 0.5)}` +
    `Q${r((xb + xi) / 2)} ${r(yEnd + wave * 1.4)} ${r(xi)} ${r(yEnd - 2)}Z`
  );
}

/** 윤기·결 줄(풍성한 단계의 질감) */
function sheenPaths(g: HairGeom, st: HairStyle, n: number): string[] {
  const out: string[] = [];
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

// ---------- 레이어 ----------
function bgNode(): FaceNode {
  return { tag: 'g', layer: 'background', children: [{ tag: 'rect', x: 0, y: 0, width: 120, height: 120, fill: COLOR.bg }] };
}

function clothesNodes(spec: AgeSpec): FaceNode[] {
  const nw = spec.neckW + 3;
  const sy = spec.shoulderY;
  const dip = spec.neckW > 15 ? 7 : 5;
  const d =
    `M4 121C4 ${r(sy + 8)} 22 ${r(sy + 1)} ${r(60 - nw)} ${r(sy - 1)}` +
    `Q60 ${r(sy - 1 + dip)} ${r(60 + nw)} ${r(sy - 1)}C98 ${r(sy + 1)} 116 ${r(sy + 8)} 116 121Z`;
  const collar = `M${r(60 - nw)} ${r(sy - 1)}Q60 ${r(sy - 1 + dip)} ${r(60 + nw)} ${r(sy - 1)}`;
  return [
    { tag: 'g', layer: 'clothes', children: [{ tag: 'path', d, fill: COLOR.cloth }, { tag: 'path', d: collar, fill: 'none', stroke: COLOR.line, strokeOpacity: 0.28, strokeWidth: 1.2, linecap: 'round' }] },
  ];
}

function neckNode(spec: AgeSpec): FaceNode {
  const nw = spec.neckW;
  const top = spec.cy + spec.ry - 8;
  const bottom = spec.shoulderY + 4;
  return {
    tag: 'g',
    layer: 'neck',
    children: [{ tag: 'path', d: `M${r(60 - nw)} ${r(top)}L${r(60 + nw)} ${r(top)}L${r(60 + nw + 1)} ${r(bottom)}L${r(60 - nw - 1)} ${r(bottom)}Z`, fill: COLOR.skinShade }],
  };
}

function earsAndHead(spec: AgeSpec, gender: Gender): FaceNode[] {
  const jaw = gender === 'female' ? spec.jawF : spec.jawM;
  const earY = spec.cy + spec.eyeY + 2;
  const earX = spec.rx - 0.5;
  return [
    {
      tag: 'g',
      layer: 'ears',
      children: [
        { tag: 'ellipse', cx: r(60 - earX - 1.5), cy: r(earY), rx: 4, ry: spec.earRy, fill: COLOR.skinShade },
        { tag: 'ellipse', cx: r(60 + earX + 1.5), cy: r(earY), rx: 4, ry: spec.earRy, fill: COLOR.skinShade },
      ],
    },
    { tag: 'g', layer: 'head', children: [{ tag: 'path', d: headPath(60, spec.cy, spec.rx, spec.ry, jaw), fill: COLOR.skin }] },
  ];
}

function featureNodes(spec: AgeSpec, gender: Gender, tier: LooksTier): FaceNode[] {
  const t = tier - 1;
  const lw = TIER_PARAMS.lineWidth[t];
  const la = TIER_PARAMS.lineAlpha[t];
  const highlight = TIER_PARAMS.eyeHighlightAlpha[t];
  const bw = TIER_PARAMS.browWidth[t] * spec.browScale * (gender === 'male' ? 1.15 : 1);
  const ey = spec.cy + spec.eyeY;
  const ex = spec.eyeDx;
  const nodes: FaceNode[] = [];
  // 볼 홍조: 나이가 정하고 단계와 무관
  if (spec.blush > 0) {
    for (const s of [-1, 1]) nodes.push({ tag: 'ellipse', cx: r(60 + s * (spec.rx * 0.62)), cy: r(ey + 9), rx: 5.2, ry: 3.2, fill: COLOR.blush, fillOpacity: 0.42 * spec.blush });
  }
  const line = (d: string, w: number, op: number = la): FaceNode => ({ tag: 'path', d, fill: 'none', stroke: COLOR.line, strokeOpacity: op, strokeWidth: r(w), linecap: 'round', linejoin: 'round' });
  for (const s of [-1, 1]) {
    const x = 60 + s * ex;
    // 눈썹
    const by = ey - spec.browDy;
    nodes.push(line(`M${r(x - spec.browW)} ${r(by + 1.2)}Q${r(x)} ${r(by - 2.2)} ${r(x + spec.browW)} ${r(by + 0.6 + (s > 0 ? 0.4 : 0))}`, bw));
    // 눈 (크기·위치는 단계와 무관). 하이라이트 점은 모든 단계에 같은 자리·크기로 있고 밝기만 다르다
    nodes.push({ tag: 'ellipse', cx: r(x), cy: r(ey), rx: spec.eyeRx, ry: spec.eyeRy, fill: COLOR.line, fillOpacity: la });
    nodes.push({ tag: 'ellipse', cx: r(x + 0.9), cy: r(ey - 1.1), rx: 0.95, ry: 0.95, fill: COLOR.eyeWhite, fillOpacity: highlight });
  }
  // 코: 콧방울 선 하나. 콧날 선은 어느 단계에도 없다
  const ny = spec.cy + spec.noseY;
  nodes.push(line(`M${r(60 - 1.9)} ${r(ny)}Q60 ${r(ny + 2.8)} ${r(60 + 1.9)} ${r(ny)}`, lw * 0.75));
  // 입: 모든 단계에서 같은 담담한 미소
  const my = spec.cy + spec.mouthY;
  nodes.push(line(`M${r(60 - spec.mouthW)} ${r(my)}Q60 ${r(my + 3.6)} ${r(60 + spec.mouthW)} ${r(my)}`, lw * 0.9));
  return [{ tag: 'g', layer: 'features', children: nodes }];
}

function wrinkleNodes(spec: AgeSpec): FaceNode[] {
  if (spec.wrinkle === 0) return [];
  const ey = spec.cy + spec.eyeY;
  const ex = spec.eyeDx;
  const nodes: FaceNode[] = [];
  const w = (d: string, op = 0.34, sw = 1.1): FaceNode => ({ tag: 'path', d, fill: 'none', stroke: COLOR.line, strokeOpacity: op, strokeWidth: sw, linecap: 'round' });
  const ny = spec.cy + spec.noseY;
  const my = spec.cy + spec.mouthY;
  const foreheadY = spec.cy - spec.ry * 0.62;
  // 팔자 주름 (1단계부터)
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
  return [{ tag: 'g', layer: 'wrinkles', children: nodes }];
}

interface HairLayers {
  /** 가장 아래: 정수리·뒷머리 부피 */
  back: FaceNode[];
  /** 옷 위, 머리 아래: 긴 옆머리 */
  mid: FaceNode[];
  /** 머리 위: 앞머리·가닥·장식 */
  front: FaceNode[];
}

function hairNodes(spec: AgeSpec, st: HairStyle, tier: LooksTier): HairLayers {
  const t = tier - 1;
  const g = hairGeom(spec, st, tier);
  const color = hairColorOf(spec.hairTone);
  const fillAlpha = TIER_PARAMS.hairFillAlpha[t]; // 항상 1 — 표는 단조 규칙 테스트를 위해 남겨 둔다
  const edge = spec.hairTone !== 'dark';
  // 밝은 머리(회·흰)는 피부·바탕과 밝기가 비슷해 윤곽선을 두른다(불투명도 0.7 = checkContrast 「밝은 머리 윤곽선」 쌍, 3:1 이상).
  // 선은 0.9로 가늘게 — 두꺼운 닫힌 윤곽은 모자(챙)로 읽힌다(REV-003-D-2 관찰). 흰머리는 아래의 회색 결 줄이 머리카락 질감을 더한다.
  const edgeStyle: FaceStyle = edge ? { stroke: COLOR.hairEdge, strokeOpacity: 0.7, strokeWidth: 0.9, linejoin: 'round' } : {};
  /** 모든 머리 조각은 같은 색·같은 농도(연령대의 머리색, 불투명도 1). 숱 차이는 도형의 크기(부피)만으로 */
  const hairFill: FaceStyle = { fill: color, fillOpacity: fillAlpha, ...edgeStyle };
  const back: FaceNode[] = [];
  const mid: FaceNode[] = [];
  const front: FaceNode[] = [];

  // 뒤쪽 부피 (모든 단계) — 부피는 hairVolume이 정한다
  back.push({ tag: 'g', layer: 'hair-back', children: [{ tag: 'path', d: domePath(g, spec, st), ...hairFill }] });
  // 포니테일(아동 여): 머리 옆으로 솟았다 내려온다. 부피 배율만큼 굵어진다
  const vol = TIER_PARAMS.hairVolume[t];
  const ptX = 60 + spec.rx * 0.8;
  const ptY = spec.cy - spec.ry * 0.7;
  if (st.accessory === 'ponytail') {
    const k = 0.8 + vol * 0.2;
    back.push({
      tag: 'g',
      layer: 'hair-back',
      children: [
        {
          tag: 'path',
          d: `M${r(ptX)} ${r(ptY)}C${r(ptX + 20 * k)} ${r(ptY - 12)} ${r(ptX + 30 * k)} ${r(ptY + 18)} ${r(ptX + 12 * k)} ${r(ptY + 40)}C${r(ptX + 8)} ${r(ptY + 28)} ${r(ptX + 2)} ${r(ptY + 14)} ${r(ptX - 6)} ${r(ptY + 8)}Z`,
          ...hairFill,
        },
      ],
    });
  }
  // 긴 옆머리 (모든 단계; 두께는 W에 담긴 부피 배율을 따른다)
  if (st.sideLen > 18) {
    for (const s of [-1, 1] as const) mid.push({ tag: 'g', layer: 'hair-mid', children: [{ tag: 'path', d: panelPath(g, spec, st, s), ...hairFill }] });
  }

  // 앞머리
  const fc: FaceNode[] = [];
  fc.push({ tag: 'path', d: fringePath(g, st), ...hairFill });
  // 가르마 선 + 윤기·결 줄 (단계가 높을수록 결이 많다)
  if (!st.fringe) {
    fc.push({
      tag: 'path',
      d: `M${r(60 + st.part)} ${r(g.hy - 1.2)}Q${r(60 + st.part - 1.5)} ${r(g.topY + (g.hy - g.topY) * 0.45)} ${r(60 + st.part * 0.5)} ${r(g.topY + 1.2)}`,
      fill: 'none',
      stroke: edge ? COLOR.hairEdge : '#000000',
      strokeOpacity: edge ? 0.5 : 0.35,
      strokeWidth: 1,
      linecap: 'round',
    });
  }
  for (const d of sheenPaths(g, st, TIER_PARAMS.sheenCount[t])) {
    fc.push({ tag: 'path', d, fill: 'none', stroke: '#FFFFFF', strokeOpacity: spec.hairTone === 'white' ? 0 : 0.17, strokeWidth: 1.6, linecap: 'round' });
  }
  // 노년(흰머리): 가르마에서 양옆으로 빗어 내린 회색 결 세 줄 — 연령대 표시(외모 단계와 무관, 수는 고정). 윤곽선만 있는 밝은 덩어리가 모자로 읽히지 않게 머리카락 질감을 준다
  if (spec.hairTone === 'white' && !st.fringe) {
    for (const d of sheenPaths(g, st, 3)) fc.push({ tag: 'path', d, fill: 'none', stroke: COLOR.hairGray, strokeOpacity: 0.55, strokeWidth: 1.2, linecap: 'round' });
  }
  // 중년: 구레나룻 끝이 희끗하다 (나이 표시, 단계와 무관). 귀 위 구레나룻 자리에 짧은 회색 한 토막(길이 약 6) — 귀 높이의 긴 띠는 헤드셋으로 읽혀 쓰지 않는다(REV-003-D-2 관찰)
  if (spec.gray) {
    for (const s of [-1, 1]) {
      const x = 60 + s * (g.rx * 0.93);
      fc.push({ tag: 'path', d: `M${r(x)} ${r(g.sy + 1.5)}L${r(x + s * 0.3)} ${r(g.sy - 4.5)}`, fill: 'none', stroke: COLOR.hairGray, strokeOpacity: 0.9, strokeWidth: 2.2, linecap: 'round' });
    }
  }
  // 영유아 장식 (성별·나이 단서. 농도만 머리와 같이 따라간다)
  if (st.accessory === 'tuft') {
    fc.push({ tag: 'path', d: `M${r(60 - 2)} ${r(g.topY + 2)}C${r(60 - 3)} ${r(g.topY - 9)} ${r(60 + 8)} ${r(g.topY - 8)} ${r(60 + 5)} ${r(g.topY - 2)}`, fill: 'none', stroke: color, strokeOpacity: fillAlpha, strokeWidth: 2.6 * (0.9 + vol * 0.1), linecap: 'round' });
  }
  if (st.accessory === 'topknot') {
    const kr = 4.6 * (0.85 + vol * 0.15);
    fc.push({ tag: 'ellipse', cx: 60, cy: r(g.topY - 2), rx: r(kr), ry: r(kr), fill: color, fillOpacity: fillAlpha });
    fc.push({ tag: 'path', d: `M${r(60 - 5)} ${r(g.topY + 2.4)}Q60 ${r(g.topY + 5)} ${r(60 + 5)} ${r(g.topY + 2.4)}`, fill: 'none', stroke: COLOR.cloth, strokeWidth: 2.2, linecap: 'round' });
  }
  if (st.accessory === 'clip') {
    // 앞머리 옆의 작은 리본 핀 (성별 단서, 외모 단계와 무관)
    const x = 60 - spec.rx * 0.56;
    const y = g.hy + 4;
    fc.push({ tag: 'path', d: `M${r(x)} ${r(y)}L${r(x - 5)} ${r(y - 3.4)}L${r(x - 5)} ${r(y + 3.4)}ZM${r(x)} ${r(y)}L${r(x + 5)} ${r(y - 3.4)}L${r(x + 5)} ${r(y + 3.4)}Z`, fill: COLOR.cloth });
    fc.push({ tag: 'ellipse', cx: r(x), cy: r(y), rx: 1.8, ry: 1.8, fill: COLOR.cloth });
  }
  if (st.accessory === 'ponytail') fc.push({ tag: 'ellipse', cx: r(ptX - 1), cy: r(ptY + 4), rx: 3, ry: 3.6, fill: COLOR.cloth });
  front.push({ tag: 'g', layer: 'hair-front', children: fc });
  return { back, mid, front };
}

/** 얼굴 한 장의 레이어 노드 목록 (아래에서 위 순서) */
export function faceNodes(input: FaceInput, options: FaceOptions = {}): FaceNode[] {
  const spec = AGE_SPECS[input.ageGroup];
  const st = HAIR[input.ageGroup][input.gender];
  const hair = hairNodes(spec, st, input.tier);
  const nodes: FaceNode[] = [];
  if (options.background !== false) nodes.push(bgNode());
  nodes.push(...hair.back);
  nodes.push(neckNode(spec));
  nodes.push(...clothesNodes(spec));
  nodes.push(...hair.mid);
  nodes.push(...earsAndHead(spec, input.gender));
  nodes.push(...featureNodes(spec, input.gender, input.tier));
  nodes.push(...wrinkleNodes(spec));
  nodes.push(...hair.front);
  return nodes;
}

// ---------- 문자열 SVG (정적 시안·테스트용) ----------
function styleAttrs(n: FaceStyle): string {
  const a: string[] = [];
  if (n.fill !== undefined) a.push(`fill="${n.fill}"`);
  if (n.fillOpacity !== undefined && n.fillOpacity !== 1) a.push(`fill-opacity="${r(n.fillOpacity * 100) / 100}"`);
  if (n.stroke !== undefined) a.push(`stroke="${n.stroke}"`);
  if (n.strokeOpacity !== undefined && n.strokeOpacity !== 1) a.push(`stroke-opacity="${r(n.strokeOpacity * 100) / 100}"`);
  if (n.strokeWidth !== undefined) a.push(`stroke-width="${n.strokeWidth}"`);
  if (n.linecap !== undefined) a.push(`stroke-linecap="${n.linecap}"`);
  if (n.linejoin !== undefined) a.push(`stroke-linejoin="${n.linejoin}"`);
  return a.length > 0 ? ' ' + a.join(' ') : '';
}
export function nodeToString(n: FaceNode): string {
  switch (n.tag) {
    case 'path':
      return `<path d="${n.d}"${styleAttrs(n)}/>`;
    case 'ellipse':
      return `<ellipse cx="${n.cx}" cy="${n.cy}" rx="${n.rx}" ry="${n.ry}"${styleAttrs(n)}/>`;
    case 'rect':
      return `<rect x="${n.x}" y="${n.y}" width="${n.width}" height="${n.height}"${n.rx !== undefined ? ` rx="${n.rx}"` : ''}${styleAttrs(n)}/>`;
    case 'g':
      return `<g data-layer="${n.layer}"${n.opacity !== undefined && n.opacity !== 1 ? ` opacity="${n.opacity}"` : ''}>${n.children.map(nodeToString).join('')}</g>`;
  }
}

/** 얼굴 한 장의 <svg> 문자열. size를 주면 width·height를 붙인다. label은 접근 가능한 이름(비우면 장식 처리). */
export function faceSvg(input: FaceInput, options: FaceOptions & { size?: number; label?: string } = {}): string {
  const dim = options.size !== undefined ? ` width="${options.size}" height="${options.size}"` : '';
  const a11y = options.label ? ` role="img" aria-label="${options.label}"` : ' aria-hidden="true"';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${FACE_VIEWBOX}"${dim}${a11y} style="forced-color-adjust:none">${faceNodes(input, options).map(nodeToString).join('')}</svg>`;
}
