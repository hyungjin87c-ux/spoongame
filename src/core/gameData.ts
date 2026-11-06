import type { EventPool } from './events';
import type { CitationRecord } from '../data/citationsAccess';
import type { BirthYearTables } from './generationMixture';
import type { Gender } from './types';
import type { NamePoolId } from '../data/namePoolId';

/**
 * 「태어나기」 뒤에 불러오는 게임 데이터의 자리 (SPEC-004 MG8 — 지연 로드).
 *
 * core는 이벤트 풀·출생 연도 표 같은 **큰 데이터를 정적으로 import하지 않는다** — 첫 화면의 초기 로드(≤ 400,000B)를 지키려고 그 데이터는 별도 덩어리(`data/gameData.ts`)로 빠지고,
 * 그 덩어리가 불러와진 뒤 `installGameData`로 여기에 놓인다. core의 함수들은 `pool = eventPool()`처럼 여기서 읽는다(인자로 풀을 주는 쓰는 곳은 그대로 가능하다).
 * 시험·스크립트는 `data/installAll.ts`를 한 번 import하면 같은 데이터가 놓인다(vitest `setupFiles`). 데이터가 놓이기 전에 읽으면 **throw**한다 — 조용히 빈 풀로 돌지 않는다.
 */
/** 이름 데이터의 얼굴 (R-520) — 성씨 가중 목록과 풀 함수. 구현은 `data/names.ts#NAMES_API`(이름 풀 JSON 두 개와 함께 지연 덩어리에 있다) */
export interface NamesApi {
  /** 성씨와 인구수(천 명) — 뽑기 가중치 */
  surnames: ReadonlyArray<{ name: string; populationThousands: number }>;
  /** 출생 연도·성별에 맞는 이름(성 제외) 풀 */
  namePoolFor(birthYear: number, gender: Gender): readonly string[];
  /** 출생 연도 → 이름 풀 id (풀이 없는 연도는 throw) */
  namePoolIdOf(birthYear: number): NamePoolId;
}

/**
 * 가족 모델의 표 (SPEC-009 FM4a — 설계 문서 D-4 `familyData` 덩어리): 사망확률·어머니 출산 연령 분포·조부모 동거 비율·부모 이혼 비율. 묶음 B(집)·C·D 자료가 오면 칸이 늘어난다(없는 칸은 코어가 「자료가 오기 전 동작」으로 돈다).
 * 값의 출처와 정리 규칙은 `scripts/genFamilyTables.ts`와 `data/familyTables.ts#FAMILY_BASIS`에 있다. 구현은 `data/familyTables.ts`(지연 덩어리)다.
 */
export interface FamilyTables {
  mortality: {
    firstYear: number;
    lastYear: number;
    classes: number;
    /** 5세 구간 사망확률 Q: [성 0 남 1 여][구간 0~21][해 − firstYear] */
    qx: number[][][];
    /** 공식 기대수명 1970~1985 최소제곱 기울기(살/년): [남, 여] */
    e0Slope: number[];
  };
  motherAge: {
    bins: string[];
    vitalFrom: number;
    /** 인구동향조사 1981~: [해 − vitalFrom][일곱 칸 %] */
    vital: number[][];
    /** 센서스 역산 5년 묶음 1956~1980 */
    census: Array<{ from: number; to: number; census: number; childAge: number; pct: number[] }>;
    /** 1956년 앞 출생분(추정): 1966 센서스 표본(전국, 1965.10~1966.9 출생아)의 어머니 나이 일곱 칸 %를 그대로 쓴다 — 마스터 결정 fd-b-house.md 10절 7번 */
    before1956: { sample: string; meanAge: number; pct: number[] };
  };
  household: { multiplier: number; points: Array<[number, number, string]> };
  divorce: { rateFrom: number; rate: number[]; crudeFrom: number; crude: number[] };
  /** 집(묶음 B, FM4b) — 값은 `docs/data/fd-b-house.json`에서 `scripts/genFamilyTables.ts`가 옮긴 칸 그대로이고, 보간·베이즈·절단은 `core/familyHome.ts`가 한다 */
  housing: HousingTables;
  /** 코어가 쓰는 설계값 (R-534) — 값과 근거를 한 자리에 둔다 */
  design: FamilyDesign;
  /** 표 칸마다의 근거 구분과 한 줄 설명 (FA0-4) — 가족과 삶 카드 맨 아래 접이식 「이 칸은 어떻게 정했나요」가 읽는다 */
  basis: ReadonlyArray<{ id: string; basis: 'official' | 'calc' | 'estimated' | 'design'; note: string }>;
}

/** 집 표(FD11~FD13): 거처 종류 여섯 칸의 순서는 `kinds`(단독 · 아파트 · 연립 · 다세대 · 비거주용 건물 내 · 주택 이외의 거처)다 */
export interface HousingTables {
  kinds: string[];
  /** 시도 안정 키 → 센서스 해별 구성비(%, 가구 기준) — 시도마다 자기 연도 목록(승격 전 광역시는 줄이 없어 코어가 부모 도 줄을 쓴다) */
  regions: Record<string, { years: number[]; shares: number[][] }>;
  /** 전국 점유 형태(자가 · 임차 · 무상) 안의 거처 종류 구성(%): [거처 종류][해 2010·2015·2020][자가, 임차, 무상] — 센서스 거처 종류 × 점유 */
  tenure: { years: number[]; byKind: number[][][] };
  /** 주거실태조사 소득계층별 거처 종류 구성비(%): [소득(전체·저·중·고)][지역 3분류][해 2006~2024][거처 종류 여섯] */
  income: { years: number[]; regionClasses: string[]; classes: string[]; shares: number[][][][] };
  /** 사용 방 수: [거처 종류][해 1980~2010][가구원 수 1~6·7인 이상][방 1~6+개] 구성비 ×1000 */
  rooms: { years: number[]; hhNames: string[]; byKind: number[][][][] };
}

/** 설계값 하나: 값 · 근거 구분(`design` 설계값 / `estimated` 추정) · 근거 글. 화면의 「이 칸은 어떻게 정했나요」(FM6)가 읽는다 */
export interface DesignValue<T> {
  value: T;
  basis: 'design' | 'estimated';
  note: string;
}

export interface FamilyDesign {
  /** 함께 사는 조부모 쪽이 두 쪽 모두 후보일 때 친가를 고를 확률 */
  paternalSideShare: DesignValue<number>;
  /** 부모 이혼 때 떠나는 쪽이 아버지일 확률 */
  divorceFatherLeaves: DesignValue<number>;
  /** 아래 동생의 성별이 남자일 확률 */
  maleShare: DesignValue<number>;
  /** 형제 독립 나이 (min~max 균등) */
  leaveAge: DesignValue<{ min: number; max: number }>;
  /** 아래 동생 이어짐 확률 `a_1`·`a_2`의 상한 */
  continueCap: DesignValue<number>;
  /**
   * 1945년 이전 출생 어머니의 출산 이어짐 보정 (FM4b, 마스터 결정 2026-10-28 · 1941~45는 R-565, 2026-11-02): 어머니 출생 연도가 `upTo` 이하인 코호트(오름차순 표, 마지막 `upTo`보다 크면 보정 없음)는 아래 동생 구성에서
   *  - 전체 자녀가 1·2명일 때의 이어짐 `a_1`·`a_2`의 상한을 `continueCap` 대신 `cap`으로,
   *  - 3명 이상일 때의 이어짐 `a_k`(k ≥ 3)를 `q`로,
   *  - 동생 터울의 상한을 `SIBLING_GAP.max` 대신 `gapMax`(출산이 많던 코호트의 짧은 터울)로 쓴다.
   * 공표 출산 순위 비중에서 유도한 값은 기간 단면 근사라 출산이 많던 코호트의 총 자녀 수를 낮게 만든다(모형 3.0~3.2명 vs FD6 3.4~5.6) — 코호트별로 FD6(센서스 코호트 평균 출생아 수) ±0.45 안에 들도록 `scripts/calibrateHighOrder.ts`가 맞춘 설계값(calibrated)이다.
   */
  highOrderContinue: DesignValue<Array<{ upTo: number; cap: number; q: number; gapMax: number }>>;
  /** 집 고르기의 설계값 (FM4b, `fd-b-house.md` 10절 마스터 결정) */
  home: DesignValue<HomeDesign>;
  /** 어린 형제의 이른 별세(Q3, FM7a): 계획을 켜고 끄는 스위치와 확률 배율 — 한 곳 (SPEC-009 6절). `enabled`는 T06 승인(`data/familyApproval.ts`)이 true일 때만 켤 수 있다 */
  siblingLoss: DesignValue<SiblingLossRule>;
  /** 이른 부모 별세 효과 (4-7절 (1), FA0-8 예외 · A-6 초안 ▲): 주인공 `maxAge` 이하에 한 분이 떠나는 해에만 한 번. `enabled: false`면 기록 전용(측정·시험에서 끈다) */
  earlyLoss: DesignValue<EarlyLossRule>;
  /** 성인기 식구 (FC5·FC6, 10절): 배우자 나이 차 · 자녀 수·터울 · 친구 수 */
  adult: DesignValue<AdultDesign>;
  /** 사이 말의 계산 (FC2): 호칭별 기본값 · 양육 방식 기울임 · 시드 ±1 · 플래그가 만드는 변화 표 */
  closeness: DesignValue<ClosenessDesign>;
  /** 반려동물 (FK1): 이름 목록(끝에만 추가) · 종별 수명 */
  pets: DesignValue<PetDesign>;
  /** 가진 것 (FK2): 항목 · 보급률 시계열 · 수저 기울임 */
  possessions: DesignValue<PossessionDesign>;
}

export interface AdultDesign {
  /** 남편 − 아내 나이 차 분포의 모양 (`FATHER_GAP`과 같은 꼴: 범위·봉우리·퍼짐) */
  spouseGap: { min: number; max: number; peak: number; spread: number };
  /** 처음 만난 해의 배우자 나이 하한 — 표의 나이 차가 이보다 어리게 만들면 출생 연도를 당긴다 (R-573) */
  spouseMinAge: number;
  /** 첫 자녀 출생 연도 `upTo` 이하일 때 자녀 수 1~4명의 가중 */
  childCount: Array<{ upTo: number; weights: [number, number, number, number] }>;
  childGap: { min: number; max: number };
  /** 둘째 이후 자녀가 태어날 수 있는 마지막 주인공 나이 */
  childLastAge: number;
  /** 가까운 친구 1·2·3명의 확률 */
  friendCount: [number, number, number];
  /** 친구의 나이 차(친구 출생 연도 − 주인공 출생 연도) 범위 */
  friendAgeOffset: { min: number; max: number };
  /** 사건을 본 나이를 알 수 없는 상태(시험이 직접 만든 플래그)에서 쓰는 나이 */
  fallbackAt: { spouse: number; child: number; friend: number };
  /** 직업 줄의 나이 값 (FC3, R-582): 학생으로 보는 나이 · 은퇴 나이(농림어업·그 밖, 각 min~max 균등) · 집안일을 하는 부모가 은퇴 나이를 모를 때 쓰는 나이. 근거 칸 글이 이 값으로 조립된다 */
  jobs: {
    studentAge: { min: number; max: number };
    retireAge: { agri: { min: number; max: number }; other: { min: number; max: number } };
    homemakerRetireAge: number;
  };
}

export type ClosenessRole = 'mother' | 'father' | 'grandparent' | 'sibling' | 'spouse' | 'child' | 'friend';

/** 플래그가 만드는 사이 변화 한 줄: `who`의 사이에 `delta`를 더하고, `floor`보다 낮지 않게 · `cap`보다 높지 않게 한다 (1 멀어짐 … 5 아주 가까움) */
export interface ClosenessFlagRule {
  flag: string;
  /** `'off'`이면 이 플래그가 **꺼져 있을 때** 적용한다 (기본 `'on'`) */
  when?: 'on' | 'off';
  who: ClosenessRole[];
  delta?: number;
  floor?: number;
  cap?: number;
  /** 이 변화를 만드는 사건의 방향을 한 줄로 (시험이 사건의 관계 점수 방향과 맞춘다) */
  note: string;
}

export interface ClosenessDesign {
  base: Record<ClosenessRole, number>;
  /** 양육 방식 기울임 — 부모에게만 */
  parenting: Record<'neglect' | 'free' | 'helicopter' | 'strict', number>;
  /** 시드 ±1단계: 한 단계 낮을 확률 · 높을 확률 */
  seedStep: { down: number; up: number };
  flags: ClosenessFlagRule[];
}

export interface PetDesign {
  /** 반려동물 이름 (상호 아님). **끝에만 추가**한다 — 순서를 바꾸면 알려진 시드의 이름이 달라진다 */
  names: string[];
  /** 종별 수명(년, 균등) — 공식 통계가 없는 설계값 */
  lifeYears: Record<'dog' | 'cat' | 'other', { min: number; max: number }>;
}

export interface PossessionItem {
  id: string;
  /** 일반 명사 (상호·제품명 금지) */
  name: string;
  /** 보급이 시작된 연도 — 이 앞에는 집에 없다 */
  start: number;
  /** 가구 보급률(%) 시계열 `[연도, %]` — 사이는 선형, 앞은 0, 뒤는 마지막 값 유지(2025 뒤는 새 물건 없음) */
  points: Array<[number, number]>;
  /** 그림에 그려지는 소품과 묶인 항목 */
  tie?: 'tv' | 'aircon' | 'car';
  /** 이 항목을 가지면 카드에서 가려지는 앞 세대 물건 (컬러 텔레비전 → 흑백 텔레비전) */
  supersedes?: string;
}

export interface PossessionDesign {
  items: PossessionItem[];
  /** 수저 기울임 세기 0~1 (평균 보존 방식 — 0이면 수저와 무관) */
  wealthTilt: number;
  /** 카드 「집에 있는 것」에 글자로 보이는 항목 수 상한 */
  displayMax: number;
}

/** 집 고르기의 설계값: 표가 없는 구간을 메우는 방법과 매핑 */
export interface HomeDesign {
  /** 1969 이하 출생은 1970 구성비를 거슬러 쓰되 아파트 칸을 이 값(%)으로 줄인다(마스터 결정 1: 「아파트 칸은 0에 가깝게」) */
  before1970AptPct: number;
  /** 주택 이외의 거처를 쓸 수 있는 출생 연도 `[처음, 마지막]` (FD14, 범위 밖은 확률 0 — 이 뒤의 센서스 값은 오피스텔·고시원이라 「작은 집」이 아니다) */
  shackYears: readonly [number, number];
  /** 임차 단독주택이 셋방(딸림)일 확률: `[출생 연도, 확률]` 점, 사이는 선형, 바깥은 끝점 값 */
  rentRoomPoints: ReadonlyArray<readonly [number, number]>;
  /** 방 수 문턱(연도 함수, 마스터 결정 4): 그 해·거처·가구원 수의 센서스 방 분포에서 누적이 이 값(천분율)에 닿기 전의 드문 방 수는 쓰지 않는다 */
  roomFloorPermille: number;
  /** 시도 안정 키 → 주거실태조사 지역 3분류 (수저 단계 → 소득계층은 `INCOME_CLASS_BLEND`) */
  regionClassOf: Readonly<Record<string, 'capital' | 'metro' | 'province'>>;
  /** 센서스에 시도 줄이 없는 해(직할시·광역시 승격 전)에 쓰는 부모 도 */
  parentOf: Readonly<Record<string, string>>;
  /** 분류·정의가 바뀌어 보간하지 않는 센서스 해 구간: 사이 연도는 가까운 쪽 해의 값(같은 거리면 이른 해) */
  stepSegments: ReadonlyArray<readonly [number, number]>;
}

/**
 * 어린 형제의 이른 별세 계획의 조건과 배율 (FM7a, SPEC-009 6절). 형제마다 해시 한 번으로 별세 나이를 정하고(`deathAgeGiven` — 부모·조부모 별세와 같은 생존 곡선) 조건에 드는 가장 이른 한 명이 떠난다.
 *  - `enabled`: false면 계획이 없다(형제는 떠나지 않는다) — T06 문장이 승인되지 않으면 이것만 끄고 나머지는 그대로 낸다.
 *  - `scale`: 배율. 1.0 = 실제 생명표 그대로(형진 님 2026-11-06). 1 미만이면 형제마다 해시로 그 비율만 남긴다.
 *  - `maxBirthYear`: 이 출생 연도 이하 판만 (1969). `sibAge`: 형제 별세 나이 범위(1~11 — 태어난 해에 떠나는 0세는 제외, R-619). `heroAge`: 주인공 나이 범위(1~19 = `EARLY_LOSS_MAX_AGE` 이하).
 */
export interface SiblingLossRule {
  enabled: boolean;
  scale: number;
  maxBirthYear: number;
  sibAge: { min: number; max: number };
  heroAge: { min: number; max: number };
}

/** 이른 부모 별세 효과의 수치. `family`는 집안 살림(만 원, 20세 미만이라 `familyFund`로 간다)이고 재력 단계 배율을 곱해 반올림한다 */
export interface EarlyLossRule {
  enabled: boolean;
  /** 이 주인공 나이 이하에 떠난 경우만 (19) */
  maxAge: number;
  stats: { happiness: number; relationships: number; health: number };
  family: { father: number; mother: number; motherHomemaker: number };
  /** 부모 재력 1~5단계 배율 */
  wealthMultiplier: readonly [number, number, number, number, number];
}

export interface GameData {
  eventPool: EventPool;
  birthYears: BirthYearTables;
  /** 인용 테이블(citations.json) — 생애·엔딩 화면의 통계·연구 인용 카드가 쓴다. 첫 화면은 쓰지 않아 지연 로드 덩어리에 들어간다 */
  citations: readonly CitationRecord[];
  /** 이름 풀과 성씨 — 첫 화면은 쓰지 않아 지연 로드 덩어리에 들어간다(출처 줄은 `titleText.ts#NAME_CREDIT`에 따로 있다) */
  names: NamesApi;
  /** 가족 모델의 표 (SPEC-009 FM4a `familyData`) — 첫 화면은 쓰지 않아 지연 로드 덩어리에 들어간다 */
  family: FamilyTables;
}

let installed: GameData | null = null;

/** 불러온 데이터를 놓는다. 같은 데이터를 다시 놓는 것은 무해하다(중복 로드·테스트 재설치). */
export function installGameData(data: GameData): void {
  installed = data;
}

export function isGameDataReady(): boolean {
  return installed !== null;
}

/** 테스트 전용: 놓은 데이터를 치운다(로드 전 상태를 시험할 때) */
export function uninstallGameData(): void {
  installed = null;
}

export function gameData(): GameData {
  if (installed === null) throw new Error('gameData: 게임 데이터가 아직 불러와지지 않았다 (data/gameData.ts의 loadGameData를 기다려야 한다)');
  return installed;
}

/** 지금 놓인 이벤트 풀 (함수 기본 인자로 쓴다) */
export function eventPool(): EventPool {
  return gameData().eventPool;
}

export function birthYearTables(): BirthYearTables {
  return gameData().birthYears;
}

export function citationTable(): readonly CitationRecord[] {
  return gameData().citations;
}

export function namesApi(): NamesApi {
  return gameData().names;
}

export function familyTables(): FamilyTables {
  return gameData().family;
}
