import { ageGroupOf } from '../assets/faces/faceLayers';
import { regionNameAt } from '../data/regionNames';
import {
  FIGURE_GEO,
  INFANT_CARRIED,
  PIECE_BY_ID,
  PROP_PIECES,
  SCENE_RULES,
  bandOf,
  hasYard,
  houseWordOf,
  outfitEraOf,
  pieceInYear,
  regionKindOf,
  type Band,
  type FigureGroup,
  type HouseKind,
  type PieceOpt,
  type PropMeta,
  type PropTie,
  type RegionKind,
} from '../data/sceneTables';
import { FAMILY_TAG, type PersonId, type SceneFamilyState, type SceneMember } from './familyModel';
import { famHash01, famSeedOf } from './familyRng';
import { possessionTiesOf } from './possessions';
import { sceneFamilyOf, type FamilyGame } from './familyView';
import type { Gender, ParentWealth } from './types';

/**
 * 집과 가족 그림의 순수 함수 (SPEC-009 FM5, `docs/design/family-scene.md` 1·3·7절).
 *
 *  - `sceneInputOf(game)`: 게임 상태 → 입력. 가족 상태는 `sceneFamilyOf`가 **하나만** 읽는다(FA0-1: 그림이 가족 상태를 따로 계산하지 않는다).
 *  - `sceneOf(input)`: 입력 → `SceneSpec`(어느 조각을 어디에 놓는가). **그림 자체는 저장하지 않는다.** 같은 입력 → 같은 출력, `Date`·`Math.random` 없음 — 고르기에 난수가 필요하면 `famHash01`(판 시드, 조각 id)뿐이라
 *    해가 바뀌어도 시대 밴드·가족·지역이 같은 동안은 같은 소품·옷 색이 남는다(깜박이지 않는다).
 *  - `sceneLineOf`·`sceneRowsOf`·`scenePetsText`: 아래 한 줄·펼침·대체 글의 문구. 그림과 같은 집합(`state.members`)에서 만든다(FH5·FH6).
 *
 * 좌표계는 `viewBox 0 0 640 256`, 지면선 y 200, 안전 영역 x 20~620. 조각 마크업은 `renderScene`(ui)이 지연 덩어리 `familyArt`에서 가져와 그린다 — 이 파일은 마크업을 모른다.
 */

export const SCENE_W = 640;
export const SCENE_H = 256;
export const GROUND_Y = 200;
/** 식구 줄의 마지막 중심 x 상한 (안전 영역 620 − 반폭) */
export const FAMILY_RIGHT = 612;
/** 아래 한 줄의 글자 수 상한 (360px 카드 폭 326px, 14px 굵게 → 2줄 ≈ 40자, family-scene 7절) */
export const LINE_MAX = 40;

export interface SceneInput {
  state: SceneFamilyState;
  /** 출생 시도 줄임 이름 — 배경 종류를 정한다 */
  region: string;
  /** 아래 한 줄의 「사는 곳」 글자(그 해의 행정구역 이름) */
  place: string;
  /** 같은 글자의 짧은 형(줄임 이름) — 한 줄이 길 때 쓴다 */
  placeShort: string;
  wealth: ParentWealth;
  /** 가족 시드(`famSeedOf`) */
  seed: number;
  /** 「가진 것」(FK2)에서 이 집이 가진 항목 중 그림에 묶인 것 (`core/possessions.ts#possessionTiesOf`) */
  possessions: ReadonlySet<PropTie>;
}

export interface ScenePlacement {
  id: string;
  x: number;
  y: number;
  scale?: number;
  opt?: PieceOpt;
}
export interface FamilyPlacement extends ScenePlacement {
  /** 이 조각이 그리는 사람: 가족 id 또는 주인공('me') — 시험이 「떠난 사람·안 태어난 동생이 그림에 없다」를 이 값으로 단언한다 */
  who: PersonId | 'me';
}
export interface PetPlacement extends ScenePlacement {
  species: 'dog' | 'cat' | 'other';
  place: 'yard' | 'indoor';
}

export interface SceneSpec {
  year: number;
  regionKind: RegionKind;
  houseKind: HouseKind;
  band: Band;
  /** 배경은 상자 [0,0,640,256] 고정이라 (0,0) */
  bg: ScenePlacement;
  back: ScenePlacement[];
  house: ScenePlacement;
  front: ScenePlacement[];
  pets: PetPlacement[];
  family: FamilyPlacement[];
}

// ---------------------------------------------------------------- 입력

const WEALTH_DEFAULT: ParentWealth = 3;

/** 그 해의 행정구역 이름. 시군구가 있는 판(시험 전용 R1 프로필)은 시군구까지 — 없으면 연혁 이름, 이름을 못 찾으면 줄임 이름 */
function placeTextOf(region: string, year: number, sigungu: string | undefined): { place: string; placeShort: string } {
  if (sigungu !== undefined && sigungu.length > 0) return { place: `${region} ${sigungu}`, placeShort: `${region} ${sigungu}` };
  try {
    return { place: regionNameAt(region, year), placeShort: region };
  } catch {
    return { place: region, placeShort: region };
  }
}

/** 게임 상태 → 그림 입력. 가족 상태는 `sceneFamilyOf`가, 그림에 묶인 「가진 것」(안테나·에어컨·승용차)은 `possessionTiesOf`(FK2)가 만든다(FA0-1) */
export function sceneInputOf(game: FamilyGame, possessions: ReadonlySet<PropTie> = possessionTiesOf(game)): SceneInput {
  const state = sceneFamilyOf(game);
  const report = game.birthReport!;
  const where = placeTextOf(report.region, state.calYear, report.sigungu);
  return { state, region: report.region, ...where, wealth: game.character?.parentWealth ?? WEALTH_DEFAULT, seed: famSeedOf(game.peerSeed ?? game.seed), possessions };
}

// ---------------------------------------------------------------- 도우미

/** 조각 id → 정수 (FNV-1a). 소품·옷 색을 판 시드와 섞어 고정하는 데 쓴다 */
function idNumber(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193) >>> 0;
  return h;
}
const hashOf = (seed: number, key: string, salt = 0): number => famHash01(seed, FAMILY_TAG.SCENE, idNumber(key), salt);

const r1 = (n: number): number => Math.round(n * 10) / 10;

// ---------------------------------------------------------------- 집 고르기

/**
 * 집 종류. 주택 종류 표(묶음 B)가 오기 전(`homeKind` null)에는 **점유 형태의 기본 모양**(family-model.md 4-5절): 자가·무상 → 단독, 임차 → 다세대 — 임시 모양이고 통계 주장이 아니다.
 * 수저 최상(5) + 자가 + 단독 → 큰 집. 요양(`care`) → 요양 시설. 어른이 된 뒤에는 집 종류를 새로 뽑지 않고 `Dwelling`에 따른 기본 모양(SPEC-006 전까지, 같은 4-5절).
 */
export function houseKindOf(state: SceneFamilyState, wealth: ParentWealth): HouseKind {
  if (state.dwelling === 'care') return 'care';
  let kind: HouseKind;
  if (state.dwelling !== null && state.dwelling !== 'family') kind = state.dwelling === 'own' ? (state.homeKind ?? 'detached') : state.homeKind ?? 'multi';
  else kind = state.homeKind ?? (state.housing === 'rent' ? 'multi' : 'detached');
  const ownerChild = state.dwelling === null || state.dwelling === 'family';
  if (wealth === 5 && state.housing === 'own' && ownerChild && (kind === 'detached' || kind === 'detached-rent')) return 'estate';
  return kind;
}

/** 수저 단계 → 집 크기 (`SCENE_RULES.houseScale`, 설계값: 하위 0.86 · 중 0.92 · 상 1.0). 마당이 있는 집만 — 아파트·다세대는 틀이 정해져 있다 */
function houseScaleOf(kind: HouseKind, wealth: ParentWealth, crowded: boolean): number {
  const r = SCENE_RULES.houseScale;
  if (kind === 'shack') return r.shack;
  if (kind === 'apt' || kind === 'multi' || kind === 'care') return 1;
  const base = kind === 'estate' ? r.high : wealth <= r.lowMaxWealth ? r.low : wealth === 3 ? r.mid : r.high;
  return crowded ? Math.min(base, r.crowded) : base;
}

// ---------------------------------------------------------------- 식구 줄

interface Figure {
  who: PersonId | 'me';
  gender: Gender;
  age: number;
  group: FigureGroup | 'infant';
}

/** 그림에 놓을 사람의 순서 (왼쪽부터): 조부 · 조모 · 아버지 · 어머니 · 손위 형제 · 주인공 · 손아래 · 배우자 · 자녀 (family-scene 3절) */
function figuresOf(state: SceneFamilyState): Figure[] {
  const out: Figure[] = state.members.map((m) => ({ who: m.id, gender: m.gender, age: m.age, group: ageGroupOf(m.age) as Figure['group'] }));
  const me: Figure = { who: 'me', gender: state.me.gender, age: state.me.age, group: ageGroupOf(state.me.age) as Figure['group'] };
  const at = out.findIndex((f) => f.who !== 'me' && (/^y\d$/.test(f.who) || f.who === 'spouse' || /^c\d$/.test(f.who)));
  if (at < 0) out.push(me);
  else out.splice(at, 0, me);
  return out;
}

const HEIGHT_OF = (g: FigureGroup): number => FIGURE_GEO[g].H;
const SEX = (g: Gender): 'f' | 'm' => (g === 'female' ? 'f' : 'm');
/** 어깨 폭 (붙어 서는 간격 계산용) */
const SHOULDER = (f: Figure): number => (f.group === 'infant' ? FIGURE_GEO.toddler.sw[0] : FIGURE_GEO[f.group].sw[f.gender === 'female' ? 0 : 1]);
const GAP = 17;

/** 발바닥 y: 어른 246/248, 노년·청소년 250, 어린이 250, 유아 252 (앞줄) */
function footY(f: Figure): number {
  switch (f.group) {
    case 'young':
    case 'middle':
      return f.gender === 'male' ? 246 : 248;
    case 'toddler':
    case 'infant':
      return 252;
    default:
      return 250;
  }
}

/**
 * 식구 줄의 중심 x들. 시작 = max(420, 집 오른끝 + 30), 간격 = 어깨 폭 평균 + 17. 오른쪽 끝이 안전 영역을 넘으면 먼저 시작을 앞으로 당기고(집 가까이), 다음에 간격을 줄이고(최대 0.6배), 마지막에 몸 크기를 0.92배로 줄인다.
 * 어떤 경우에도 마지막 사람의 중심은 `FAMILY_RIGHT` 안이다.
 */
function layoutFamily(bodies: readonly Figure[], houseRight: number): { xs: number[]; scale: number } {
  const n = bodies.length;
  if (n === 0) return { xs: [], scale: 1 };
  const gaps: number[] = [];
  for (let i = 0; i + 1 < n; i++) gaps.push((SHOULDER(bodies[i]) + SHOULDER(bodies[i + 1])) / 2 + GAP);
  const span = gaps.reduce((a, g) => a + g, 0);
  const starts = [Math.max(420, houseRight + 30), Math.max(404, houseRight + 12)];
  for (const body of [1, 0.92]) {
    for (const k of [1, 0.9, 0.8, 0.7, 0.6]) {
      for (const start of starts) {
        const used = span * k * body;
        if (start + used <= FAMILY_RIGHT - 0.5) {
          const xs: number[] = [start];
          for (const g of gaps) xs.push(r1(xs[xs.length - 1] + g * k * body));
          return { xs, scale: body };
        }
      }
    }
  }
  // 마지막 수단: 안전 영역 안에 고르게
  const start = 404;
  const step = n > 1 ? (FAMILY_RIGHT - start) / (n - 1) : 0;
  return { xs: bodies.map((_, i) => r1(start + step * i)), scale: 0.92 };
}

const ALT_VARIANTS = 3;

function familyPlacements(state: SceneFamilyState, seed: number, year: number, houseRight: number): FamilyPlacement[] {
  const figs = figuresOf(state);
  const era = outfitEraOf(year);
  // 업힌 아기(0~2세)는 어머니(없으면 아버지·할머니·할아버지·다른 어른) 뒤 같은 자리에 — 둘 이상이면 앞사람부터 차례로 다른 어른에게, 업어 줄 사람이 없으면 유아 조각으로
  const infants = figs.filter((f) => f.group === 'infant');
  const carrierOrder = (f: Figure): number => (f.who === 'mother' ? 0 : f.who === 'father' ? 1 : f.who === 'pgm' || f.who === 'mgm' ? 2 : f.who === 'pgf' || f.who === 'mgf' ? 3 : 4);
  const carriers = figs.filter((f) => f.group !== 'infant' && f.group !== 'toddler' && f.group !== 'child' && f.group !== 'teen').sort((a, b) => carrierOrder(a) - carrierOrder(b));
  const carriedBy = new Map<Figure, Figure>(); // 아기 → 업어 주는 사람
  const taken = new Set<Figure>();
  for (const baby of infants) {
    const c = carriers.find((x) => !taken.has(x));
    if (c !== undefined) {
      taken.add(c);
      carriedBy.set(baby, c);
    }
  }
  const standing = figs.filter((f) => !carriedBy.has(f));
  const bodies: Figure[] = standing.map((f) => (f.group === 'infant' ? { ...f, group: 'toddler' as const } : f)); // 업어 줄 사람이 없는 아기는 유아 조각으로
  const { xs, scale } = layoutFamily(bodies, houseRight);

  const placed: FamilyPlacement[] = [];
  const posOf = new Map<Figure, { x: number; y: number }>();
  standing.forEach((f, i) => posOf.set(f, { x: xs[i], y: footY(bodies[i]) }));
  figs.forEach((f) => {
    const baby = carriedBy.get(f);
    if (baby !== undefined) return;
    const at = posOf.get(f)!;
    const body = bodies[standing.indexOf(f)];
    const g = body.group as FigureGroup;
    const sex = SEX(f.gender);
    // 업힌 아기는 업어 주는 사람 조각 뒤에 놓는다(앞서 push)
    const mine = [...carriedBy.entries()].filter(([, c]) => c === f).map(([b]) => b);
    for (const b of mine) {
      const tok = hashOf(seed, `infant:${b.who}`) < 0.5 ? 'cloth2' : 'cloth4';
      placed.push({ id: INFANT_CARRIED, who: b.who, x: at.x, y: at.y, scale: scale === 1 ? undefined : scale, opt: { H: HEIGHT_OF(g), tok } });
    }
    const small = f.group === 'infant'; // 업어 줄 사람이 없는 아기: 유아 조각을 조금 작게
    const sc = r1(scale * (small ? 0.8 : 1));
    const opt: PieceOpt = { v: Math.floor(hashOf(seed, `fig:${f.who}`) * ALT_VARIANTS) };
    if (g === 'senior' || g === 'elder' || g === 'middle' || g === 'young') {
      if (sex === 'm' && hashOf(seed, `shoe:${f.who}`) < 0.5) opt.shoeTok = 'cloth3';
    }
    placed.push({ id: `fig-${g}-${sex}-${era}`, who: f.who, x: at.x, y: at.y, scale: sc === 1 ? undefined : sc, opt });
  });
  return placed;
}

// ---------------------------------------------------------------- 소품·반려동물

interface HouseGeo {
  x0: number;
  scale: number;
  right: number;
  top: number;
  width: number;
}

/** 이 소품이 이 장면에 나올 수 있는가 (연도 · 그림이 있음 · 「가진 것」에 묶임 · 마당 · 지역) */
function propAllowed(p: PropMeta, year: number, kind: HouseKind, bgKind: RegionKind, possessions: ReadonlySet<PropTie>): boolean {
  if (!p.drawn || !pieceInYear(p, year)) return false;
  if (p.tie !== undefined && !possessions.has(p.tie)) return false;
  if (p.needsYard === true && !hasYard(kind)) return false;
  if (p.rural === true && bgKind !== 'rural' && bgKind !== 'coast') return false;
  if (p.urban === true && bgKind !== 'metro' && bgKind !== 'town') return false;
  if (p.coastOnly === true && bgKind !== 'coast') return false;
  // 전봇대는 시골에는 1970년부터 (family-scene 2-4절 ▲)
  if (p.id === 'prop-pole' && (bgKind === 'rural' || bgKind === 'coast') && year < SCENE_RULES.poleRuralFrom.year) return false;
  // 집 위 물통는 다세대(옥상) 집에만
  if (p.id === 'prop-water-tank' && kind !== 'multi') return false;
  // 연탄은 아파트 단지에 쌓아 두지 않는다
  if (p.id === 'prop-briquettes' && (kind === 'apt' || kind === 'care')) return false;
  return true;
}

/** 자리마다 한 장면에 놓는 소품 수: 마당 ≤ 2 · 집 위 ≤ 1 · 배경 앞 ≤ 1 (집 옆 소품은 마당 자리에 앉는다) */
const SLOT_CAP = { yard: 2, roof: 1, back: 1 } as const;

function propPlacements(input: SceneInput, kind: HouseKind, bgKind: RegionKind, geo: HouseGeo, familyLeft: number): ScenePlacement[][] {
  const { seed, state, possessions } = input;
  const year = state.calYear;
  const n = SCENE_RULES.propCount.min + Math.floor(hashOf(seed, 'props:n') * SCENE_RULES.propCount.spread); // 2~4개 (설계값)
  const cands = PROP_PIECES.filter((p) => propAllowed(p, year, kind, bgKind, possessions)).sort((a, b) => hashOf(seed, a.id) - hashOf(seed, b.id) || (a.id < b.id ? -1 : 1));
  const used = { yard: 0, roof: 0, back: 0 };
  const back: ScenePlacement[] = [];
  const front: ScenePlacement[] = [];
  for (const p of cands) {
    if (back.length + front.length >= n) break;
    // '집 옆' 소품은 마당 자리에 앉는다(시안도 마당 앞에 놓았다) — 집 옆에 남는 폭이 없는 집이 많다
    const slot: keyof typeof SLOT_CAP = p.slot === 'beside' ? 'yard' : p.slot;
    if (used[slot] >= SLOT_CAP[slot]) continue;
    const w = p.box[2];
    const ox = -p.box[0]; // 원점에서 상자 왼쪽 끝까지
    if (slot === 'back') {
      if (p.id === 'prop-pole') {
        back.push({ id: p.id, x: 28, y: GROUND_Y });
      } else if (p.id === 'prop-tree') {
        const x = geo.right + 22;
        if (x + 26 > familyLeft + 6) continue; // 식구 줄과 겹치면 놓지 않는다
        back.push({ id: p.id, x, y: GROUND_Y });
      } else if (p.id === 'prop-lamp') {
        const x = familyLeft - 14;
        if (x < geo.right - 10) continue;
        back.push({ id: p.id, x: r1(x), y: GROUND_Y });
      } else {
        back.push({ id: p.id, x: r1(Math.min(familyLeft - w / 2, geo.right + w / 2)), y: GROUND_Y });
      }
      used.back++;
    } else if (slot === 'roof') {
      if (p.id === 'prop-water-tank') front.push({ id: p.id, x: r1(geo.x0 + 50 * geo.scale), y: r1(geo.top + 4) });
      else front.push({ id: p.id, x: r1(geo.x0 + geo.width * 0.62), y: r1(geo.top + 6) }); // 안테나: 지붕 위
      used.roof++;
    } else {
      // 마당: 두 자리 — 앞(왼쪽, 발 y 246)과 뒤(집 앞 가운데, 발 y 238)
      const first = used.yard === 0;
      const centerX = first ? Math.max(20 + ox, 54 + ox * 0.4) : Math.min(geo.right * 0.52 + 20, geo.right - 30);
      front.push({ id: p.id, x: r1(centerX), y: first ? 246 : 238 });
      used.yard++;
    }
  }
  return [back, front];
}

function petPlacements(input: SceneInput, kind: HouseKind, house: ScenePlacement, geo: HouseGeo): PetPlacement[] {
  const { state } = input;
  const meta = PIECE_BY_ID.get(house.id)!;
  const slots = meta.slots;
  const out: PetPlacement[] = [];
  let indoorCount = 0;
  let yardCount = 0;
  for (const pet of state.pets.slice(0, 2)) {
    const yardOk = hasYard(kind) && state.calYear < SCENE_RULES.yardPetBefore.year;
    const place: 'yard' | 'indoor' = yardOk && pet.species !== 'other' ? 'yard' : 'indoor';
    const sp = pet.species;
    if (place === 'yard') {
      const id = sp === 'dog' ? 'pet-dog-yard' : 'pet-cat-yard';
      out.push({ id, species: sp, place, x: r1(geo.right - 12 - yardCount * 64), y: 246, scale: undefined });
      yardCount++;
    } else {
      const id = sp === 'dog' ? 'pet-dog-indoor' : sp === 'cat' ? 'pet-cat-indoor' : 'pet-other-indoor';
      const slot = slots?.window ?? slots?.porch ?? null;
      if (slot !== null && slot !== undefined) {
        out.push({ id, species: sp, place, x: r1(geo.x0 + (slot[0] + indoorCount * 34) * geo.scale), y: r1(GROUND_Y + slot[1] * geo.scale) });
      } else {
        // 창가·마루가 없는 집: 마당 한쪽(집 앞)에
        out.push({ id, species: sp, place, x: r1(geo.right - 40 - indoorCount * 34), y: 246 });
      }
      indoorCount++;
    }
  }
  return out;
}

// ---------------------------------------------------------------- sceneOf

/**
 * 입력 → 조각 목록. 배경(출생 시도 × 그 해) → 소품-뒤 → 집(종류 × 그 해 × 수저 크기) → 소품-앞 → 반려동물 → 식구. 같은 입력 → 같은 출력(순수).
 * 식구는 `state.members`와 주인공 **그것뿐**이다 — 떠난 사람·독립한 형제·아직 안 태어난 동생은 입력에 없으므로 그림에도 없다(FH5 「함께 사는 사람」과 같은 집합).
 */
export function sceneOf(input: SceneInput): SceneSpec {
  const { state } = input;
  const year = state.calYear;
  const bgKind = regionKindOf(input.region, year);
  const band = bandOf(year);
  const kind = houseKindOf(state, input.wealth);
  const crowded = state.members.length + 1 >= SCENE_RULES.houseScale.crowdedFrom;
  const scale = houseScaleOf(kind, input.wealth, crowded);
  // 초가 규칙(시대의 창 r5 반영, era-window.md 9-4절 ③): 시골·해안 · ~1975 · 수저 하위의 단독 집은 1970~75에도 지붕 값이 있는 h1(초가)을 쓴다 — 새 그림 없이 h1의 연도 범위를 이 조건에서만 1975로 늘린다(슬레이트 변형은 다음 묶음)
  const thatch = SCENE_RULES.thatch;
  const thatchHouse = kind === 'detached' && thatch.regions.includes(bgKind) && input.wealth <= thatch.maxWealth && year <= thatch.lastYear;
  const houseBand: Band = kind === 'care' ? 3 : thatchHouse ? 1 : band;
  const houseId = `house-${kind}-h${houseBand}`;
  const meta = PIECE_BY_ID.get(houseId)!;
  const x0 = scale >= 1 ? 0 : 8;
  const [bx, by, bw] = meta.box;
  const geo: HouseGeo = { x0, scale, right: r1(x0 + (bx + bw) * scale), top: r1(GROUND_Y + by * scale), width: bw * scale };
  const house: ScenePlacement = { id: houseId, x: x0, y: GROUND_Y, scale: scale === 1 ? undefined : scale };
  // 초가: 시골·해안 · ~1975 · 수저 하위. 이 조각의 지붕 파라미터가 있는 집(단독 h1·그 대신 그리는 조각)에서만 쓰인다
  const art = meta.drawn ? meta : PIECE_BY_ID.get(meta.stand!.id)!;
  if (art.id === 'house-detached-h1' && kind !== 'estate' && thatch.regions.includes(bgKind) && input.wealth <= thatch.maxWealth && year <= thatch.lastYear && kind !== 'care') house.opt = { roof: 'thatch' };

  const family = familyPlacements(state, input.seed, year, geo.right);
  const familyLeft = family.length === 0 ? FAMILY_RIGHT : Math.min(...family.map((f) => f.x)) - 22;
  const [back, front] = propPlacements(input, kind, bgKind, geo, familyLeft);
  const pets = petPlacements(input, kind, house, geo);
  return {
    year,
    regionKind: bgKind,
    houseKind: kind,
    band: houseBand,
    bg: { id: `bg-${bgKind}-b${band}`, x: 0, y: 0 },
    back,
    house,
    front,
    pets,
    family,
  };
}

/** 조각 구성이 같은가를 가르는 열쇠 — 해만 바뀌어 조각이 그대로면 같다(교차 페이드는 이 열쇠가 바뀔 때만) */
export function sceneKey(spec: SceneSpec): string {
  const p = (x: ScenePlacement): string => `${x.id}@${x.x},${x.y}${x.scale === undefined ? '' : `*${x.scale}`}${x.opt === undefined ? '' : JSON.stringify(x.opt)}`;
  return [spec.bg, ...spec.back, spec.house, ...spec.front, ...spec.pets, ...spec.family].map(p).join('|');
}

// ---------------------------------------------------------------- 문구

const COUNT_WORD = ['', '', '둘', '셋', '넷', '다섯', '여섯', '일곱', '여덟'];

/** 「와/과」 — 마지막 글자의 받침으로 고른다 */
export function wa(word: string): '과' | '와' {
  const c = word.charCodeAt(word.length - 1);
  return c >= 0xac00 && c <= 0xd7a3 && (c - 0xac00) % 28 !== 0 ? '과' : '와';
}

/** 주인공 성별 기준 호칭 */
function labelOf(m: SceneMember, me: Gender): string {
  switch (m.role) {
    case 'parent':
      return m.id === 'mother' ? '어머니' : '아버지';
    case 'grandparent':
      return m.id === 'pgf' ? '친할아버지' : m.id === 'pgm' ? '친할머니' : m.id === 'mgf' ? '외할아버지' : '외할머니';
    case 'sibling':
      if (/^o\d$/.test(m.id)) return me === 'male' ? (m.gender === 'male' ? '형' : '누나') : m.gender === 'male' ? '오빠' : '언니';
      return m.gender === 'male' ? '남동생' : '여동생';
    case 'spouse':
      return '배우자';
    case 'child':
      return m.gender === 'male' ? '아들' : '딸';
  }
}

/** 한 줄에 쓰는 짧은 말 (친·외 구분 없이 「할머니」, 동생은 성별 없이 「동생」) */
function shortLabelOf(m: SceneMember, me: Gender): string {
  if (m.role === 'grandparent') return m.id === 'pgf' ? '할아버지' : m.id === 'pgm' ? '할머니' : m.id === 'mgf' ? '외할아버지' : '외할머니';
  if (m.role === 'sibling' && !/^o\d$/.test(m.id)) return '동생';
  return labelOf(m, me);
}

/** 같은 호칭이 여럿이면 「누나 둘」, 한 사람이면 그대로 */
function counted(labels: readonly string[]): string[] {
  const order: string[] = [];
  const count = new Map<string, number>();
  for (const l of labels) {
    if (!count.has(l)) order.push(l);
    count.set(l, (count.get(l) ?? 0) + 1);
  }
  return order.map((l) => ((count.get(l) ?? 1) > 1 ? `${l} ${COUNT_WORD[Math.min(count.get(l)!, COUNT_WORD.length - 1)]}` : l));
}

/**
 * 함께 사는 사람 묶음 (한 줄용): 부모님(한 분이면 어머니/아버지) → 형제 → 조부모 → (성인) 배우자 → 자녀.
 * `squeeze`가 1이면 형제 3명 이상을 「형제 N명」으로, 2이면 거기에 더해 할머니·할아버지 둘을 「조부모님」으로 묶는다.
 */
function peopleGroups(state: SceneFamilyState, squeeze: 0 | 1 | 2): string[] {
  const me = state.me.gender;
  const ms = state.members;
  const out: string[] = [];
  const parents = ms.filter((m) => m.role === 'parent');
  if (parents.length === 2) out.push('부모님');
  else if (parents.length === 1) out.push(parents[0].id === 'mother' ? '어머니' : '아버지');
  const sibs = ms.filter((m) => m.role === 'sibling');
  if (sibs.length >= 3 && squeeze >= 1) out.push(`형제 ${sibs.length}명`);
  else out.push(...counted(sibs.map((m) => shortLabelOf(m, me))));
  const gps = ms.filter((m) => m.role === 'grandparent');
  const paternal = gps.filter((m) => m.id === 'pgf' || m.id === 'pgm');
  if (squeeze >= 2 && gps.length >= 2) out.push(paternal.length === 2 && gps.length === 2 ? '조부모님' : `조부모님 ${gps.length}분`);
  else out.push(...counted(gps.map((m) => shortLabelOf(m, me))));
  if (ms.some((m) => m.role === 'spouse')) out.push('배우자');
  out.push(...counted(ms.filter((m) => m.role === 'child').map((m) => shortLabelOf(m, me))));
  return out;
}

/**
 * 아래 한 줄 (FH3): 「{사는 곳} · {집 낱말} · {함께 사는 사람}{과/와} 함께」. 길면(> `LINE_MAX`) ① 형제 3명 이상 → 「형제 N명」 ② 할머니·할아버지 둘 → 「조부모님」 ③ 「식구 N명과 함께」(그림에 못 나온 사람 포함).
 * 말줄임(…)은 쓰지 않는다 — 항상 완전한 문장. 혼자 사는 사람은 「혼자 지냅니다」. 집 종류 표(묶음 B)가 오기 전의 집 낱말은 「집」이다.
 */
export function sceneLineOf(input: SceneInput): string {
  const { state } = input;
  const kind = state.homeKind === null && state.dwelling !== 'care' ? null : houseKindOf(state, input.wealth);
  const word = houseWordOf(kind, state.calYear);
  const total = state.members.length + state.overflow;
  const head = (place: string): string => `${place} · ${word} · `;
  const build = (place: string, groups: readonly string[]): string => (groups.length === 0 ? `${head(place)}혼자 지냅니다` : `${head(place)}${groups.join('·')}${wa(groups[groups.length - 1])} 함께`);
  if (total === 0) return build(input.place, []);
  const crowdedLine = (place: string): string => `${head(place)}식구 ${total}명과 함께`;
  if (state.overflow > 0) return crowdedLine(input.place).length <= LINE_MAX ? crowdedLine(input.place) : crowdedLine(input.placeShort);
  for (const place of input.place === input.placeShort ? [input.place] : [input.place, input.placeShort]) {
    for (const squeeze of [0, 1, 2] as const) {
      const line = build(place, peopleGroups(state, squeeze));
      if (line.length <= LINE_MAX) return line;
    }
  }
  const last = crowdedLine(input.placeShort);
  return last;
}

/**
 * 신원 카드 「지금 사는 곳」 (SPEC-009 FC8): 「{사는 곳} · {집 낱말}」 — 그림·아래 한 줄과 **같은 입력**(`sceneInputOf`)에서 같은 함수(`houseKindOf`·`houseWordOf`)로 만든다.
 * 시도는 평생 출생 시도(SPEC-004 RG5·RG9, K16 — 이사는 같은 시도 안의 이동만이고 이사 사건은 FM7 이후)이고 그 해의 행정구역 이름이다. 시군구는 출생신고에 있는 판(시험 전용 2026년생)만 보인다.
 */
export function currentHomeOf(input: SceneInput): { place: string; word: string } {
  const { state } = input;
  const kind = state.homeKind === null && state.dwelling !== 'care' ? null : houseKindOf(state, input.wealth);
  return { place: input.place, word: houseWordOf(kind, state.calYear) };
}

/** 「지금 사는 곳」을 한 줄 글자로 (시험·대체 글용) — 화면은 두 항목을 `FitPair`로 그려 좁으면 기호 없이 두 줄이 된다 */
export function currentHomeTextOf(input: SceneInput): string {
  const { place, word } = currentHomeOf(input);
  return `${place} · ${word}`;
}

export interface SceneRow {
  label: string;
  age: number;
  self: boolean;
}
/** 펼침의 사람 줄: 그림 순서(주인공 포함) 앞 6명 + 「그 밖에 N명」(그림에 못 나온 사람 포함) */
export function sceneRowsOf(input: SceneInput): { rows: SceneRow[]; more: number } {
  const { state } = input;
  const me = state.me.gender;
  const all: SceneRow[] = state.members.map((m) => ({ label: labelOf(m, me), age: m.age, self: false }));
  const at = state.members.findIndex((m) => /^y\d$/.test(m.id) || m.id === 'spouse' || /^c\d$/.test(m.id));
  const self: SceneRow = { label: '나', age: state.me.age, self: true };
  if (at < 0) all.push(self);
  else all.splice(at, 0, self);
  return { rows: all.slice(0, 6), more: Math.max(0, all.length - 6) + state.overflow };
}

type PetLike = { species: 'dog' | 'cat' | 'other'; place: 'yard' | 'indoor' };

/** 반려동물마다 한 구절: 「마당에서 기르는 개 한 마리」 · 「집 안에서 기르는 고양이 한 마리」 (펼침의 한 줄 하나) */
export function petPhrases(pets: readonly PetLike[]): string[] {
  return pets.map((p) => {
    const kind = p.species === 'dog' ? '개' : p.species === 'cat' ? '고양이' : '반려동물';
    if (p.species === 'cat' && p.place === 'yard') return '마당에 드나드는 고양이';
    return `${p.place === 'yard' ? '마당에서' : '집 안에서'} 기르는 ${kind} 한 마리`;
  });
}

/** 반려동물 문장 (대체 글): 「마당에서 기르는 개 한 마리와 집 안에서 기르는 고양이 한 마리가 있습니다.」 — 없으면 빈 글자 */
export function scenePetsText(pets: readonly PetLike[]): string {
  return pets.length === 0 ? '' : `${petPhrases(pets).join('와 ')}가 있습니다.`;
}

/** 그림의 대체 글 전체 (한 판 문장): 「{연도}년 {한 줄}. {반려동물}」 — 화면은 같은 요소를 `aria-labelledby`로 이어 읽힌다 */
export function sceneAltOf(input: SceneInput, spec: SceneSpec): string {
  const pets = scenePetsText(spec.pets);
  return `${spec.year}년 ${sceneLineOf(input)}.${pets === '' ? '' : ` ${pets}`}`;
}
