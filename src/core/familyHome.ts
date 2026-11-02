import { INCOME_CLASS_BLEND } from '../data/birthReportTable';
import { MERGED_PICK, REGION_KEYS } from '../data/regionKeys';
import { FAMILY_TAG, type HomeData, type HomeKind } from './familyModel';
import { famStream } from './familyRng';
import { familyTables } from './gameData';
import type { Housing, ParentWealth } from './types';

/**
 * 집의 모습 (SPEC-009 FM4b FA5, `docs/data/family-model.md` 4-5절, `docs/data/fd-b-house.md` 10절 마스터 결정): 출생 연도 × 시도 → 거처 종류 여섯 칸의 분포에서 **출생신고의 점유 형태와 부모 재력에 맞는** 한 칸을 뽑고,
 * 단독주택 셋방 딸림(`s`)과 사용 방 수(`r`)를 정한다. **`Housing`(자가·임차·무상)은 이미 정해진 값을 입력으로 받는다**(바꾸지 않는다). 모두 순수 함수이고 난수는 `HOME` 스트림의 세 값(종류 · 셋방 · 방 수)뿐이다.
 *
 * 분포를 메우는 방법(마스터 결정, 값의 근거는 `data/familyTables.ts#FAMILY_DESIGN.home`):
 *  - 센서스 해 격자(1970~2025) × 시도 × 여섯 칸. 사이 연도는 선형 보간(추정), 분류가 바뀌는 구간은 보간하지 않고 가까운 해(같은 거리면 이른 해), 1969 이하는 1970 값을 거슬러 쓴다(설계값, 아파트 칸 0.1%).
 *  - 승격 전 광역시는 부모 도 줄을 쓴다. 주택 이외의 거처는 `shackYears` 밖에서 확률 0.
 *  - 점유 형태(자가·임차·무상)와 소득계층(수저 단계)은 독립 가정의 곱: `P(종류 | 점유, 소득)`은 `P(종류 | 시도, 연도) × P(점유 | 종류) × [P(종류 | 소득계층, 지역) ÷ P(종류 | 지역)]`에 비례한다.
 *  - 방 수는 센서스 방 분포(전국, 거처 종류 × 가구원 수)에서 뽑되 연도마다 드문 방 수(`roomFloorPermille`)는 쓰지 않는다 — 「식구 수에 비해 비현실적으로 적은 방」 0건의 문턱이 연도 함수다.
 */

/** 거처 종류 번호 (`HomeData.k`, 표 `housing.kinds`의 순서) */
export const HOME_KIND = { detached: 0, apt: 1, row: 2, multi: 3, mixed: 4, other: 5 } as const;
export const HOME_KIND_COUNT = 6;

const nearest = (years: readonly number[], year: number): number => {
  let best = 0;
  for (let i = 1; i < years.length; i++) if (Math.abs(years[i] - year) < Math.abs(years[best] - year)) best = i;
  return best;
};

const normalize = (w: readonly number[]): number[] => {
  const t = w.reduce((a, b) => a + b, 0);
  return t > 0 ? w.map((x) => x / t) : w.map(() => 1 / w.length);
};

/** 시도 줄이 있는 해에는 그 시도, 없는 해(승격 전)에는 부모 도의 줄 */
function regionSeries(key: string, year: number): { years: number[]; shares: number[][] } {
  const t = familyTables();
  const own = t.housing.regions[key];
  if (own !== undefined && year >= own.years[0]) return own;
  const parent = t.design.home.value.parentOf[key];
  if (parent !== undefined) return regionSeries(parent, year);
  if (own === undefined) throw new Error(`familyHome: 시도 키를 모른다 (${key})`);
  return own;
}

/** 시도 이름(줄임) → 안정 키 */
export function regionKeyOf(short: string): string {
  // 시험 전용 R1 프로필(2026년생)의 합쳐진 「전남광주」: 센서스 표는 합치기 전의 두 시도 줄이라 전라남도 줄을 쓴다(광주는 승격 전 부모 도도 전남이다)
  if (short === MERGED_PICK) return 'jeonnam';
  const r = REGION_KEYS.find((x) => x.short === short);
  if (r === undefined) throw new Error(`familyHome: 시도 이름을 모른다 (${short})`);
  return r.key;
}

/** 출생 연도·시도의 거처 종류 구성(합 1, 여섯 칸) — 보간·거슬러 쓰기·아파트 줄임·주택 이외의 거처 연도 제한을 적용한 뒤 */
export function homeBaseShares(key: string, birthYear: number): number[] {
  const d = familyTables().design.home.value;
  const year = Math.max(1970, birthYear);
  const s = regionSeries(key, year);
  const ys = s.years;
  let v: number[];
  if (year >= ys[ys.length - 1]) v = s.shares[ys.length - 1].slice();
  else {
    let i = 0;
    while (i + 1 < ys.length && ys[i + 1] <= year) i++;
    if (ys[i] === year) v = s.shares[i].slice();
    else {
      const [y0, y1] = [ys[i], ys[i + 1]];
      const step = d.stepSegments.some(([a, b]) => a === y0 && b === y1);
      if (step) v = (year - y0 <= y1 - year ? s.shares[i] : s.shares[i + 1]).slice();
      else {
        const f = (year - y0) / (y1 - y0);
        v = s.shares[i].map((x, k) => x + (s.shares[i + 1][k] - x) * f);
      }
    }
  }
  if (birthYear < 1970) {
    v[HOME_KIND.apt] = d.before1970AptPct; // 1969 이하: 1970 값을 거슬러 쓴다(설계값) — 아파트 칸은 0에 가깝게
    v[HOME_KIND.multi] = 0;
  }
  if (birthYear < d.shackYears[0] || birthYear > d.shackYears[1]) v[HOME_KIND.other] = 0;
  return normalize(v);
}

const TENURE_INDEX: Readonly<Record<Housing, 0 | 1 | 2>> = { own: 0, rent: 1, free: 2 };

/** 점유 형태 안의 거처 종류 가중 `P(점유 | 종류)` (전국 센서스 거처 종류 × 점유, 2010·2015·2020 중 가까운 해 — 그 앞은 2010) */
function tenureWeights(birthYear: number, housing: Housing): number[] {
  const t = familyTables().housing.tenure;
  const yi = nearest(t.years, birthYear);
  return t.byKind.map((perKind) => perKind[yi][TENURE_INDEX[housing]] / 100);
}

/** 소득계층 배율: 수저 단계가 섞는 계층의 `P(종류 | 계층, 지역) ÷ P(종류 | 지역)` (주거실태조사 2006~2024 중 가까운 해). 지역은 수도권 · 광역시 등 · 도지역 */
function incomeRatios(key: string, birthYear: number, wealth: ParentWealth): number[] {
  const t = familyTables();
  const inc = t.housing.income;
  const yi = nearest(inc.years, birthYear);
  const ri = ({ capital: 0, metro: 1, province: 2 } as const)[t.design.home.value.regionClassOf[key]];
  const all = inc.shares[0][ri][yi];
  const ratio = new Array<number>(HOME_KIND_COUNT).fill(0);
  for (const [cls, share] of INCOME_CLASS_BLEND[wealth]) {
    const ci = cls === 'low' ? 1 : cls === 'mid' ? 2 : 3;
    const row = inc.shares[ci][ri][yi];
    for (let k = 0; k < HOME_KIND_COUNT; k++) ratio[k] += share * (all[k] > 0 ? row[k] / all[k] : 1);
  }
  return ratio;
}

/** 이 가정의 거처 종류 확률(합 1): 시도·연도 구성 × 점유 형태 × 소득계층 배율 */
export function homeKindProbs(regionShort: string, birthYear: number, housing: Housing, wealth: ParentWealth): number[] {
  const key = regionKeyOf(regionShort);
  const base = homeBaseShares(key, birthYear);
  const tenure = tenureWeights(birthYear, housing);
  const income = incomeRatios(key, birthYear, wealth);
  return normalize(base.map((b, k) => b * tenure[k] * income[k]));
}

/** 단독주택 임차 가구가 셋방(딸림)일 확률 (설계값 점 사이 선형) */
export function rentRoomProbability(birthYear: number): number {
  const pts = familyTables().design.home.value.rentRoomPoints;
  if (birthYear <= pts[0][0]) return pts[0][1];
  const last = pts[pts.length - 1];
  if (birthYear >= last[0]) return last[1];
  const i = pts.findIndex((p) => p[0] > birthYear);
  const [x0, y0] = pts[i - 1];
  const [x1, y1] = pts[i];
  return y0 + ((y1 - y0) * (birthYear - x0)) / (x1 - x0);
}

/**
 * 사용 방 수 분포(천분율, 방 1~6+): 그 연도(1980~2010 중 가까운 센서스 해)·거처·가구원 수(1~6, 7인 이상)의 센서스 분포에서, 누적이 `roomFloorPermille`에 닿기 전의 드문 방 수는 뺀다.
 * 자료가 빈 칸(표본 0)은 가까운 가구원 수의 칸을 쓴다.
 */
export function roomsDistribution(birthYear: number, kind: number, householdSize: number): number[] {
  const t = familyTables();
  const rooms = t.housing.rooms;
  const yi = nearest(rooms.years, birthYear);
  const hh = Math.min(Math.max(householdSize, 1), rooms.hhNames.length) - 1;
  let row: number[] | undefined;
  for (let d = 0; d < rooms.hhNames.length && row === undefined; d++) {
    for (const h of d === 0 ? [hh] : [hh - d, hh + d]) {
      const cand = rooms.byKind[kind]?.[yi]?.[h];
      if (cand !== undefined && cand.reduce((a, b) => a + b, 0) > 0) {
        row = cand;
        break;
      }
    }
  }
  const dist = row ?? [0, 0, 1000, 0, 0, 0];
  const floor = t.design.home.value.roomFloorPermille;
  let cum = 0;
  let floorAt = 0;
  for (let r = 0; r < dist.length; r++) {
    cum += dist[r];
    if (cum >= floor) {
      floorAt = r;
      break;
    }
  }
  return dist.map((x, r) => (r < floorAt ? 0 : x));
}

/** 방 수 문턱 (연도 함수): 이 연도·거처·가구원 수에서 쓸 수 있는 가장 적은 방 수 */
export function roomsFloor(birthYear: number, kind: number, householdSize: number): number {
  return roomsDistribution(birthYear, kind, householdSize).findIndex((x) => x > 0) + 1;
}

export interface HomeInput {
  birthYear: number;
  /** 출생신고의 시도 (줄임 이름) */
  region: string;
  housing: Housing;
  parentWealth: ParentWealth;
  /** 태어날 때 함께 사는 사람 수(주인공 포함) — 방 수 문턱이 읽는다 */
  householdSize: number;
}

const pickIndex = (weights: readonly number[], u: number): number => {
  let acc = 0;
  for (let i = 0; i < weights.length; i++) {
    acc += weights[i];
    if (u < acc) return i;
  }
  for (let i = weights.length - 1; i >= 0; i--) if (weights[i] > 0) return i;
  return 0;
};

/** 출생 때 집 하나: 종류 · 사용 방 수 · 셋방 딸림. 난수는 HOME 스트림의 세 값(종류 → 셋방 → 방 수)을 늘 같은 순서로 쓴다 */
export function rollHome(famSeed: number, input: HomeInput): HomeData {
  const rng = famStream(famSeed, FAMILY_TAG.HOME);
  const uKind = rng.next();
  const uRent = rng.next();
  const uRooms = rng.next();
  const probs = homeKindProbs(input.region, input.birthYear, input.housing, input.parentWealth);
  const k = pickIndex(probs, uKind);
  const dist = roomsDistribution(input.birthYear, k, input.householdSize);
  const r = pickIndex(normalize(dist), uRooms) + 1;
  const home: HomeData = { k, r };
  if (k === HOME_KIND.detached && input.housing === 'rent' && uRent < rentRoomProbability(input.birthYear)) home.s = 1;
  return home;
}

/** 저장된 집 → 그림의 집 종류 (연립·다세대는 그림에서 `multi`로 합친다, 셋방 딸린 단독은 `detached-rent`) */
export function homeKindOf(h: HomeData): HomeKind {
  switch (h.k) {
    case HOME_KIND.apt:
      return 'apt';
    case HOME_KIND.row:
    case HOME_KIND.multi:
      return 'multi';
    case HOME_KIND.mixed:
      return 'other';
    case HOME_KIND.other:
      return 'shack';
    default:
      return h.s === 1 ? 'detached-rent' : 'detached';
  }
}
