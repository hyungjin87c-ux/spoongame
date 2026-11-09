/**
 * 집과 가족 그림의 조각 표 (SPEC-009 FM5, `docs/design/family-scene.md` 2·3절). **데이터만** 둔다 — 그림 마크업은 지연 덩어리 `familyArt`(`data/familyArt/`)에 있고, 이 표는 `sceneOf`(순수 함수)가
 * 「어느 조각을 어디에 놓는가」를 정하는 데 필요한 연도·상자·자리·대체 조각만 가진다(작아서 첫 화면 덩어리에 들어가도 된다 — 정적 import 그래프는 `tests/lazyBoundary.test.ts`가 잠근다).
 *
 * 조각 수 예산(FH8): 계획 87 · 상한 110. 층별로 센다 — 배경 12(종류 4 × 시대 3) · 집 21(종류 7 × 시대 3) + 요양 시설 1(마스터 결정) · 시대 소품 · 식구 22(몸 16 + 시대 옷 6, 코드 분기로 센다 — 마스터 결정) · 반려동물 6 · 틀 4(CSS).
 * 아직 **그리지 않은 조각**(designer 몫)이 생기면 `drawn: false`로 두고 `stand`에 가장 가까운 그려진 조각을 적는다 — 그림이 도착하면 `drawn: true`로 바꾸고 조각 파일만 더하면 된다(`tests/sceneAssets.test.ts`가 표와 덩어리의 일치를 잠그고, 대신 그리는 조각의 연도가 요청 연도를 덮지 않으면 허용 목록에만 둔다). FM5b에서 33조각이 모두 그려져 지금은 안 그린 조각이 0이다.
 */

export type RegionKind = 'metro' | 'town' | 'rural' | 'coast';
export type Band = 1 | 2 | 3;
/** 집 종류 7 + 요양 시설: 큰 집(`estate`)은 저장하지 않고 `sceneOf`가 수저 5 + 자가로 파생한다 */
export type HouseKind = 'detached' | 'detached-rent' | 'multi' | 'apt' | 'shack' | 'other' | 'estate' | 'care';
export type PieceLayer = 'bg' | 'house' | 'prop' | 'pet';

/** 조각 하나를 그릴 때 바꾸는 값(조각 수를 늘리지 않는 변형): 초가/기와 · 업은 사람의 키 · 포대기 색 · 옷 색 변형 번호 · 고무신 색 */
export interface PieceOpt {
  roof?: 'thatch' | 'tile';
  H?: number;
  tok?: string;
  v?: number;
  shoeTok?: string;
}

/** 연도 범위 `[처음, 마지막]` (마지막이 null이면 지금까지). null = 제한 없음 */
export type YearRange = readonly [number, number | null] | null;

export interface PieceMeta {
  id: string;
  layer: PieceLayer;
  /** 그 해에 없던 것이 그려지지 않는다(FH2 ②) — `tests/sceneAssets.test.ts`가 장면마다 단언한다 */
  years: YearRange;
  /** 조각 상자 [x, y, w, h] (조각 원점 기준). 안 그린 조각은 대신 그리는 조각의 상자를 쓴다 */
  box: readonly [number, number, number, number];
  drawn: boolean;
  /** 안 그린 조각을 대신 그리는 조각(그려진 것)과 그 파라미터. null = 대신 그릴 것이 없다(그리지 않는다) */
  stand: { id: string; opt?: PieceOpt } | null;
  /** 집 조각이 내놓는 자리(집 원점 기준 [x, y]) — 반려동물이 창가·마루에 앉는 곳 */
  slots?: { window?: readonly [number, number]; porch?: readonly [number, number] };
}

const b = (n: Band): readonly [number, number | null] => (n === 1 ? [1940, 1969] : n === 2 ? [1970, 1999] : [2000, null]);

// ---------------------------------------------------------------- 배경 12: 종류 4 × 시대 3
const BACKGROUNDS: PieceMeta[] = (['metro', 'town', 'rural', 'coast'] as const).flatMap((kind) =>
  ([1, 2, 3] as const).map((band): PieceMeta => ({ id: `bg-${kind}-b${band}`, layer: 'bg', years: b(band), box: [0, 0, 640, 256], drawn: true, stand: null })),
);

// ---------------------------------------------------------------- 집 21 + 요양 1
/** 집 조각의 상자와 자리. 슬롯 `window`는 창턱(아래쪽) 기준, `porch`는 마루. 모두 designer가 그렸다(family-scene.md 2-8절 — FM5b에서 안 그린 18채가 들어와 `stand`가 없다) */
const HOUSE_DRAWN: Record<string, Pick<PieceMeta, 'box' | 'slots'>> = {
  'house-detached-h1': { box: [-4, -130, 372, 130], slots: { porch: [214, 0], window: [232, -30] } },
  'house-detached-h2': { box: [-4, -130, 372, 130], slots: { window: [111, -52] } },
  'house-detached-h3': { box: [-4, -170, 372, 170], slots: { window: [119, -22] } },
  'house-detached-rent-h1': { box: [-4, -130, 372, 130], slots: { porch: [260, -14], window: [118, -34] } },
  'house-detached-rent-h2': { box: [-4, -140, 408, 140], slots: { window: [105, -73] } },
  'house-detached-rent-h3': { box: [0, -180, 340, 180], slots: { window: [60, -64] } },
  'house-multi-h1': { box: [0, -124, 320, 124], slots: { window: [130, -62] } },
  'house-multi-h2': { box: [0, -150, 330, 150], slots: { window: [53, -54] } },
  'house-multi-h3': { box: [0, -170, 330, 170], slots: { window: [122, -112] } },
  'house-apt-h1': { box: [0, -130, 400, 130], slots: { window: [30, -8] } },
  'house-apt-h2': { box: [0, -196, 400, 196], slots: { window: [35, -14] } },
  // 아파트: 시안은 맨 아래층 오른쪽 칸의 창턱(절대 y 166)에 앉혔다 → 집 원점(y 200) 기준 −34
  'house-apt-h3': { box: [0, -200, 400, 200], slots: { window: [300, -34] } },
  'house-shack-h1': { box: [0, -100, 260, 100], slots: { window: [55, -34] } },
  'house-shack-h2': { box: [0, -104, 270, 104], slots: { window: [53, -32] } },
  'house-shack-h3': { box: [0, -104, 280, 104], slots: { window: [155, -36] } },
  'house-other-h1': { box: [-4, -130, 372, 130], slots: { window: [252, -40] } },
  'house-other-h2': { box: [0, -150, 340, 150], slots: { window: [66, -92] } },
  'house-other-h3': { box: [0, -180, 340, 180], slots: { window: [75, -76] } },
  'house-estate-h1': { box: [-4, -150, 404, 150], slots: { porch: [160, -50], window: [70, -66] } },
  'house-estate-h2': { box: [-4, -170, 404, 170], slots: { window: [145, -26] } },
  'house-estate-h3': { box: [-4, -170, 404, 170], slots: { window: [175, -14] } },
  'house-care-h3': { box: [0, -170, 400, 170], slots: { window: [42, -16] } },
};
const HOUSE_KINDS = ['detached', 'detached-rent', 'multi', 'apt', 'shack', 'other', 'estate'] as const;
const HOUSES: PieceMeta[] = [
  ...HOUSE_KINDS.flatMap((kind) =>
    ([1, 2, 3] as const).map((band): PieceMeta => {
      const id = `house-${kind}-h${band}`;
      const art = HOUSE_DRAWN[id];
      return { id, layer: 'house', years: b(band), box: art.box, drawn: true, stand: null, slots: art.slots };
    }),
  ),
  // 요양 시설(마스터 결정: 상한 110 안에서 1 더한다) — 건물 외관만
  { id: 'house-care-h3', layer: 'house', years: b(3), box: HOUSE_DRAWN['house-care-h3'].box, drawn: true, stand: null, slots: HOUSE_DRAWN['house-care-h3'].slots },
];

// ---------------------------------------------------------------- 시대 소품
/** 소품이 놓이는 자리: yard 마당 · beside 집 옆 · roof 집 위 · back 배경 앞 */
export type PropSlot = 'yard' | 'beside' | 'roof' | 'back';
/** 「가진 것」에 묶인 소품: 그 항목이 있을 때만 그린다(FM6 `POSSESSIONS` 전에는 항목이 없어 그리지 않는다) */
export type PropTie = 'tv' | 'aircon' | 'car';

export interface PropMeta extends PieceMeta {
  layer: 'prop';
  slot: PropSlot;
  /** 마당이 있는 집(단독·셋방 단독·큰 집·작은 집)에만 */
  needsYard?: true;
  /** 시골·해안 배경에만 */
  rural?: true;
  /** 해안 배경에만 */
  coastOnly?: true;
  /** 도시(대도시·중소도시)에만 */
  urban?: true;
  tie?: PropTie;
}

function prop(id: string, years: YearRange, box: readonly [number, number, number, number], slot: PropSlot, o: Partial<PropMeta> = {}, drawn = true): PropMeta {
  return { id, layer: 'prop', years, box, drawn, stand: null, slot, ...o };
}
const PROPS: PropMeta[] = [
  prop('prop-jangdok', [1940, 1999], [-42, -48, 84, 48], 'yard', { needsYard: true }),
  prop('prop-well', [1940, 1980], [-22, -50, 44, 50], 'yard', { needsYard: true }),
  prop('prop-haystack', [1940, 1990], [-24, -44, 48, 44], 'yard', { needsYard: true, rural: true }),
  prop('prop-briquettes', [1955, 1989], [-26, -36, 52, 36], 'beside'),
  prop('prop-pole', [1960, null], [-14, -150, 330, 150], 'back'),
  prop('prop-antenna', [1961, 2005], [-16, -36, 32, 36], 'roof', { tie: 'tv' }),
  prop('prop-laundry', null, [-40, -70, 80, 70], 'yard'),
  prop('prop-tree', null, [-26, -84, 52, 84], 'back'),
  prop('prop-lamp', [1970, null], [-12, -120, 24, 120], 'back'),
  prop('prop-water-tank', [1980, null], [-14, -30, 28, 30], 'roof'),
  prop('prop-ac-unit', [1995, null], [0, -18, 26, 18], 'beside', { tie: 'aircon' }),
  prop('prop-parcel', [2000, null], [-12, -20, 24, 20], 'yard'),
  prop('prop-bicycle', null, [-28, -32, 56, 32], 'yard'),
  prop('prop-planter', null, [-12, -26, 24, 26], 'yard'),
  // 시대 소품 다섯(승용차·비닐하우스·스쿠터·전기차 충전기·말린 생선)은 FM5b에서 그려졌다
  prop('prop-car', [1985, null], [-34, -30, 68, 30], 'beside', { tie: 'car' }),
  prop('prop-plastic-greenhouse', [1980, null], [-60, -30, 120, 30], 'back', { rural: true }),
  prop('prop-scooter', [2000, null], [-22, -30, 44, 30], 'yard', { urban: true }),
  prop('prop-ev-charger', [2020, null], [-8, -34, 16, 34], 'beside', { tie: 'car' }),
  prop('prop-hanging-fish', null, [-40, -44, 80, 44], 'yard', { coastOnly: true, needsYard: true }),
];

// ---------------------------------------------------------------- 반려동물 6
const PETS: PieceMeta[] = [
  { id: 'pet-dog-yard', layer: 'pet', years: null, box: [-72, -46, 104, 46], drawn: true, stand: null },
  { id: 'pet-dog-indoor', layer: 'pet', years: null, box: [-14, -26, 28, 26], drawn: true, stand: null },
  { id: 'pet-cat-indoor', layer: 'pet', years: null, box: [-16, -30, 32, 30], drawn: true, stand: null },
  { id: 'pet-cat-yard', layer: 'pet', years: null, box: [-16, -30, 32, 30], drawn: true, stand: null },
  { id: 'pet-other-indoor', layer: 'pet', years: null, box: [-16, -30, 32, 30], drawn: true, stand: null },
  { id: 'pet-other-yard', layer: 'pet', years: null, box: [-16, -30, 32, 30], drawn: true, stand: null },
];

/** 그림 조각 표(식구 제외 — 식구는 `person()`이 연령대 × 성별 × 시대로 만든다) */
export const SCENE_PIECES: readonly PieceMeta[] = [...BACKGROUNDS, ...HOUSES, ...PROPS, ...PETS];
export const PIECE_BY_ID: ReadonlyMap<string, PieceMeta> = new Map(SCENE_PIECES.map((p) => [p.id, p]));
export const PROP_PIECES: readonly PropMeta[] = PROPS;

/** 식구 몸 16(연령대 8 × 성별 2) + 시대 옷 6(3 × 2) + 틀 4(CSS: frame-paper · ground-empty · fold-placeholder · swap-veil) — 코드 분기를 조각으로 센다(마스터 결정) */
export const FIGURE_BODIES = 16;
export const FIGURE_OUTFITS = 6;
export const FRAME_PIECES = 4;
export const PLANNED_PIECES = 87;
export const MAX_PIECES = 110;
/** 이 표가 세는 조각 수(그림 조각 + 식구 22 + 틀 4). 계획 87에 요양 시설 1(마스터 결정)을 더하고, 시대 소품 3개(「▲ 목록 위」)는 아직 이름이 없어 덜 세어진다 */
export const SCENE_PIECE_COUNT = SCENE_PIECES.length + FIGURE_BODIES + FIGURE_OUTFITS + FRAME_PIECES;

// ---------------------------------------------------------------- 장면 규칙 상수 (R-545: 코어에 박지 않고 표에 둔다)
/**
 * `sceneOf`가 쓰는 설계값 상수 (SPEC-009 FM5b, 검수 R-545 CR-DATA). 모두 **설계값**이다 — 통계 주장이 아니라 「그림이 어색하지 않게」 정한 값이고, 근거 칸 `basis`가 그것을 적는다.
 * 숫자를 바꾸면 `tests/fixtures/scene-golden.json`(고정 시드 골든)이 달라져 의도한 변경인지 보게 한다(R-546).
 */
export const SCENE_RULES = {
  /** 초가: 시골·해안 배경 · 이 연도까지 · 수저 이 단계 이하 (지붕 파라미터가 있는 집 `house-detached-h1`에서만 쓰인다) */
  thatch: { regions: ['rural', 'coast'] as readonly RegionKind[], lastYear: 1975, maxWealth: 2, basis: '설계값' },
  /** 전봇대는 시골·해안에는 이 연도부터 (family-scene 2-4절 ▲) */
  poleRuralFrom: { year: 1970, basis: '설계값' },
  /** 마당이 있는 집의 반려동물은 이 연도 앞이면 마당, 그 뒤는 실내 */
  yardPetBefore: { year: 1990, basis: '설계값' },
  /** 집 크기(`scale`): 작은 집 · 수저 하위(wealth ≤ lowMax) · 가운데 · 위 · 식구가 많은 집(crowdedFrom명 이상)의 상한 */
  houseScale: { shack: 0.86, low: 0.86, mid: 0.92, high: 1, lowMaxWealth: 2, crowded: 0.86, crowdedFrom: 7, basis: '설계값' },
  /** 시대 소품 개수: min 이상 min + spread - 1 이하 (2~4개) */
  propCount: { min: 2, spread: 3, basis: '설계값' },
} as const;

/**
 * 시대의 창 수저 구간 경계 (R-554, CR-DATA): 부모 재력 단계 `lowMaxWealth` 이하는 아래, `highMinWealth` 이상은 위, 그 사이는 가운데. 설계값 — 통계 주장이 아니다.
 * `SCENE_RULES.thatch.maxWealth`(초가)·`houseScale.lowMaxWealth`(집 크기)와 같은 「수저 하위」 개념이다.
 */
export const ERA_BAND_RULES = { lowMaxWealth: 2, highMinWealth: 4, basis: '설계값' } as const;

/** 시대의 창·집 그림 조각이 쓰는 색 토큰 이름 27개(r11이 red·gold를 더했다) (`--c-scene-*`). 그림 조각의 `class` 허용 목록(`ui/svgNodes.tsx`)과 `styles/family.css`의 토큰 규칙이 이 이름에서 나온다 — `tests/sceneAssets.test.ts`가 `familyArt/svg.ts#SCENE_LIGHT`·CSS와 대조한다 */
export const SCENE_TOKEN_NAMES = [
  'sky', 'far', 'far2', 'ground', 'ground2', 'wall', 'wall2', 'roof', 'roof2', 'wood', 'clay', 'ink', 'shade', 'glass', 'green',
  'cloth1', 'cloth2', 'cloth3', 'cloth4', 'skin', 'hair', 'hairw', 'pet', 'pet2', 'face', 'red', 'gold',
] as const;

// ---------------------------------------------------------------- 식구 몸 기하 (family-scene 2-5절 — 얼굴 시스템 ageGroupOf와 같은 경계)
export type FigureGroup = 'toddler' | 'child' | 'teen' | 'young' | 'middle' | 'senior' | 'elder';
/** H 키 · r 머리 반지름 · sw 어깨 폭 [여, 남] */
export const FIGURE_GEO: Readonly<Record<FigureGroup, { H: number; r: number; sw: readonly [number, number] }>> = {
  toddler: { H: 50, r: 8, sw: [15, 16] },
  child: { H: 66, r: 9, sw: [18, 20] },
  teen: { H: 84, r: 10, sw: [21, 25] },
  young: { H: 94, r: 10.5, sw: [24, 30] },
  middle: { H: 94, r: 10.5, sw: [25, 31] },
  senior: { H: 86, r: 10.5, sw: [24, 29] },
  elder: { H: 80, r: 10, sw: [23, 27] },
};

export type OutfitEra = 'e1' | 'e2' | 'e3';
export const FIGURE_ID = /^fig-(toddler|child|teen|young|middle|senior|elder)-(f|m)-(e1|e2|e3)$/;
export const INFANT_CARRIED = 'fig-infant-carried';

// ---------------------------------------------------------------- 시대 밴드 (경계는 ▲ — FD15·FD23·DC14 확인 뒤 확정)
/** 배경·집 밴드: ~1969 / 1970~1999 / 2000~ */
export function bandOf(year: number): Band {
  return year < 1970 ? 1 : year < 2000 ? 2 : 3;
}
/** 옷 시대: ~1965 / 1966~1999 / 2000~ */
export function outfitEraOf(year: number): OutfitEra {
  return year <= 1965 ? 'e1' : year < 2000 ? 'e2' : 'e3';
}

/** 조각이 그 해에 있었는가 */
export function pieceInYear(p: Pick<PieceMeta, 'years'>, year: number): boolean {
  return p.years === null || (year >= p.years[0] && (p.years[1] === null || year <= p.years[1]));
}

// ---------------------------------------------------------------- 배경 분류 (설계값 — FD15 `regionKind` 표가 오기 전의 시도 단위 임시 분류)
/**
 * 출생 시도(줄임 이름) → 배경 종류. **설계값**이다(통계 주장이 아니다): 특별·광역시 → 대도시, 경기·세종 → 중소도시, 전남·경남·제주 → 해안, 그 밖 → 시골.
 * 경기는 1975 앞에는 시골으로 본다(`townFrom`). `regionKind(시군구 × 연혁 연도)` 표(묶음 B FD15)가 오면 이 표를 바꾼다.
 */
export const REGION_KIND_DESIGN: Readonly<Record<string, { kind: RegionKind; townFrom?: number }>> = {
  서울: { kind: 'metro' },
  부산: { kind: 'metro' },
  대구: { kind: 'metro' },
  인천: { kind: 'metro' },
  광주: { kind: 'metro' },
  대전: { kind: 'metro' },
  울산: { kind: 'metro' },
  세종: { kind: 'town' },
  경기: { kind: 'town', townFrom: 1975 },
  강원: { kind: 'rural' },
  충북: { kind: 'rural' },
  충남: { kind: 'rural' },
  전북: { kind: 'rural' },
  경북: { kind: 'rural' },
  전남: { kind: 'coast' },
  전남광주: { kind: 'town' },
  경남: { kind: 'coast' },
  제주: { kind: 'coast' },
};

/** 출생 시도와 달력 연도 → 배경 종류. 모르는 시도는 중소도시(설계값) */
export function regionKindOf(region: string, year: number): RegionKind {
  const d = REGION_KIND_DESIGN[region];
  if (d === undefined) return 'town';
  return d.townFrom !== undefined && year < d.townFrom ? 'rural' : d.kind;
}

// ---------------------------------------------------------------- 문구 (아래 한 줄·대체 글의 낱말)
/**
 * 집 낱말(family-scene 2-3절 「대체 글 낱말」). 점유 형태는 말하지 않는다(FH2 ③). 시대어(셋방·사글세·다세대 등)의 연도는 `WORD_YEARS`(SPEC-004 GM6)가 들어오면 그 표를 따른다 —
 * 지금은 연립(~1989)·다세대(1990~)를 센서스 낱말 ▲ 1990~으로 나눈다. 주택 종류 표(묶음 B)가 오기 전(`homeKind` null)에는 「집」이다.
 */
export function houseWordOf(kind: HouseKind | null, year: number): string {
  if (kind === null) return '집';
  switch (kind) {
    case 'detached':
      return '단독주택';
    case 'detached-rent':
      return year >= 2000 ? '다가구 단독주택' : '단독주택 셋방';
    case 'multi':
      return year < 1990 ? '연립주택' : '다세대주택';
    case 'apt':
      return '아파트';
    case 'shack':
      return '작은 집';
    case 'other':
      return year >= 2000 ? '상가주택' : '가게 딸린 집';
    case 'estate':
      return '넓은 단독주택';
    case 'care':
      return '요양 시설';
  }
}

/** 마당이 있는 집 종류 */
export function hasYard(kind: HouseKind): boolean {
  return kind === 'detached' || kind === 'detached-rent' || kind === 'estate' || kind === 'shack';
}

// ---------------------------------------------------------------- 그림 덩어리의 얼굴 (지연 덩어리 `familyArt`가 채운다)
export interface FamilyArt {
  /** 조각 마크업(색은 `var(--c-scene-*)`만). 그릴 수 없는 id는 null */
  piece(id: string, opt?: PieceOpt): string | null;
  /** 시대의 창 그림이 있는 10년대(승인된 그림이 있는 곳만) */
  eraDecades: readonly number[];
}
