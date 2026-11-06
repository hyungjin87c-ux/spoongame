import type { SiblingKind } from './family';
import type { Dwelling, Gender, Housing } from './types';

/**
 * 가족 모델의 상수와 타입 (SPEC-009 FM4a, 설계 문서 `docs/data/family-model.md` 0-2·2·3절). 데이터가 아니라 **약속**만 둔다 — 표는 `data/familyTables.ts`(지연 덩어리 `familyData`)에 있다.
 * 이 파일과 `family*.ts` 코어 파일은 모두 순수 함수다(React·`Date`·`Math.random` 없음).
 */

/** 가족 난수의 salt ('FAMI'). 값은 바꾸지 않는다 — 바꾸면 알려진 시드의 가족이 달라진다 (1-2절) */
export const FAMILY_SALT = 0x46414d49;

/**
 * 하위 추첨마다 독립 스트림의 태그 (1-2절). **값은 바꾸지 않는다.** EMPLOY~NAMES·HOME~POSSESS·ADULT는 FM4b/FM4c가 쓰는 자리이고, 지금(FM4a)은 아래 줄에서 쓰이는 것만 부른다.
 * `ERA`는 시대의 창(9절), `DIVORCE`·`MOVE`는 4-7절 해마다 판정 — 문서에 번호가 없어 이 파일이 14 다음부터 붙였다.
 */
export const FAMILY_TAG = {
  EMPLOY: 1,
  EDU: 2,
  HOMETOWN: 3,
  GRAND_AGE: 4,
  GRAND_LIFE: 5,
  GRAND_SIDE: 6,
  SIBLINGS: 7,
  NAMES: 8,
  HOME: 9,
  PETS: 10,
  POSSESS: 11,
  PARENT_LIFE: 12,
  ADULT: 13,
  ERA: 14,
  DIVORCE: 15,
  MOVE: 16,
  /** 집 그림 고르기(SPEC-009 FM5, family-scene.md 3절): 소품 선택·옷 색 변형. 해마다 바뀌지 않게 (판 시드, 조각 id)로만 쓴다 */
  SCENE: 17,
  /** 사이 말의 시드 ±1단계 (SPEC-009 FM6, FC2) */
  CLOSE: 18,
  /** 어린 형제의 이른 별세(Q3, FM7a): 형제마다 별세 나이 `u`(번호 10+i 위 · 20+j 아래, 부가 0)와 배율 솎기(부가 1). 자녀 독립 나이(R-586)는 ADULT 태그의 번호 40+j를 쓴다 */
  SIB_LOSS: 19,
} as const;

/** 전체 자녀 수 상한 (주인공 포함) */
export const FAMILY_MAX_CHILDREN = 8;
/** 모델이 새로 만드는 출산(조부모의 부모 출산)의 어머니 나이 상한 (추정 ▲, 1-1절) */
export const MOTHER_BIRTH_MAX = 49;
/** 아래 동생 출산의 어머니 나이 상한 (기존 `infant-new-sibling`의 `motherAge ≤ 45`, R-268) */
export const YOUNGER_MOTHER_MAX = 45;
/** 「이른」 부모 별세 = 주인공 19세 이하 (4-7절) — 효과 수치는 FM4b */
export const EARLY_LOSS_MAX_AGE = 19;
/** 별세 나이 상한. 표에서 이 나이를 넘기면 `NO_DEATH_PLAN`(계획 없음) */
export const FAMILY_AGE_CAP = 100;
export const NO_DEATH_PLAN = 101;
/** 조부모와 함께 살 수 있는 마지막 주인공 나이 (20세 이상은 독립) */
export const GRAND_COHABIT_UNTIL = 19;
/**
 * 부모 이혼·별거가 일어날 수 있는 주인공 나이 (1~18, 4-7절 (2)). 하한 1세(FM7a R-618, 마스터 2026-11-06): 0세 해의 이혼 줄은 한부모 출생으로 읽혀 문장으로는 풀리지 않는다(FA0-5 ①).
 * 부모 별세도 같은 이유로 주인공 0세 해를 1세 해로 옮긴다(`familyBirth.ts#parentGoneAtOf`) — 별세 나이 N(`d`)은 그대로다.
 */
export const DIVORCE_AGES = { min: 1, max: 18 } as const;
/** 부모 별세 줄이 나올 수 있는 주인공 나이의 하한 (R-618) */
export const PARENT_GONE_MIN_AGE = 1;
/** 자녀가 「따로 삶」이 될 수 있는 자녀 나이의 하한 (R-586, FM7a: 만 19세 — 민법상 성년과 맞춘다). `child_left`여도 이 나이 미만 자녀는 함께 산다 */
export const CHILD_APART_MIN_AGE = 19;
/** 형제 위 최대 4명, 그림의 식구 수 상한(주인공 제외 7) */
export const SCENE_MEMBER_MAX = 7;

/**
 * `family.log` 종류 코드 (2-2절): `[종류, 주인공 나이, 대상, 부가]`. 코드는 바꾸지 않는다.
 *  대상 — 동생 출생: `20+j`(아래 동생 y_j, j는 1부터) · 형제 독립: `10+i`(위 o_i) / `20+j` · 형제 이른 별세: `10+i`(위 o_i) / `20+j`, 부가 = 그 형제의 별세 나이 ·
 *  조부모 별세: 3 pgf · 4 pgm · 5 mgf · 6 mgm · 부모 한 분 별세: 1 어머니 / 2 아버지 · 이혼: 1 어머니가 떠남 / 2 아버지가 떠남.
 */
export const LOG_SIB_BORN = 1;
export const LOG_SIB_LEFT = 2;
/** 어린 형제의 이른 별세(Q3, FM7a) — 코드는 처음부터 3으로 비워 두었다 */
export const LOG_SIB_LOST = 3;
export const LOG_GRAND_GONE = 4;
export const LOG_PARENT_GONE = 5;
export const LOG_PARENTS_APART = 6;
/** 인생 기록에 남는 가족 줄의 `eventId` 접두어 */
export const FAMILY_LINE_PREFIX = 'fam-';

/** 가족 모양 버전 — 저장 `SCHEMA_VERSION`(9)과 별개. FM4a~c는 같은 릴리스라 1 하나다 (K5) */
export const FAMILY_DATA_VERSION = 1;

export type PersonId =
  | 'mother'
  | 'father'
  | 'pgf'
  | 'pgm'
  | 'mgf'
  | 'mgm'
  | 'o1'
  | 'o2'
  | 'o3'
  | 'o4'
  | 'y1'
  | 'y2'
  | 'y3'
  | 'y4'
  | 'y5'
  | 'y6'
  | 'y7'
  | 'spouse'
  | 'c1'
  | 'c2'
  | 'c3'
  | 'c4';

/** 조부모 네 자리의 순서 (`FamilyData.g`의 인덱스) */
export const GRAND_IDS = ['pgf', 'pgm', 'mgf', 'mgm'] as const;
export type GrandId = (typeof GRAND_IDS)[number];

// ---------- 저장되는 모양 (2-1절) ----------

/** 부모 한 분. `n`(이름)·`e`(학력)·`w`(집안일)·`r`(은퇴 나이)는 FM4b가 채운다 — FM4a는 `d`만 있다 */
export interface ParentData {
  /** 이름 (FM4b) */
  n?: string;
  /** 최종 학력 5단계 (FM4b) */
  e?: 1 | 2 | 3 | 4 | 5;
  /** 0 취업 / 1 집안일 (FM4b) */
  w?: 0 | 1;
  /** 은퇴 나이, 자기 나이 (FM4b) */
  r?: number;
  /** 별세 나이(자기 나이, 101 = 계획 없음) */
  d: number;
}

export interface GrandData {
  /** 이름 (FM4b) */
  n?: string;
  /** 부모가 태어날 때의 조부모 나이 */
  a: number;
  /** 별세 나이(자기 나이, 101 = 계획 없음) */
  d: number;
}

export interface SiblingData {
  /** 이름 (FM4b) */
  n?: string;
  /** 0 남 / 1 여 */
  g: 0 | 1;
  /** 위 형제: 주인공과의 나이 차(살) / 아래 동생: 태어난 때 주인공 나이 */
  k: number;
  /** 독립 나이(자기 나이, 20~30) */
  s: number;
}

/** 집 (묶음 B 대기 — FM4a는 만들지 않는다) */
export interface HomeData {
  k: number;
  r: number;
  s?: 1;
}

export interface FamilyData {
  v: 1;
  /** 옛 저장(필드 없음)에서 만든 스냅샷: 이미 본 값을 보존하고 지난 변화를 줄로 소급하지 않는다 */
  lg?: 1;
  /** [어머니, 아버지] */
  p: [ParentData, ParentData];
  /** [친할아버지, 친할머니, 외할아버지, 외할머니] */
  g: [GrandData, GrandData, GrandData, GrandData];
  /** 위 형제 (가까운 순, ≤ 4) */
  o: SiblingData[];
  /** 아래 동생 (태어난 순) */
  y: SiblingData[];
  /** 함께 사는 조부모 쪽: 0 없음 · 1 친가 · 2 외가 (FA4) */
  c: 0 | 1 | 2;
  h?: HomeData;
  t?: [number, number];
  u?: number;
  ad?: string[];
  /** family.log — 알린 변화 [종류, 주인공 나이, 대상, 부가] (2-2절, FM4b부터 쓴다) */
  l: number[][];
}

// ---------- 보기(FamilyView)와 그림 상태 (3-1절·8절) ----------

export type PersonRole = 'mother' | 'father' | 'grandparent' | 'sibling' | 'spouse' | 'child';
/** with 함께 삶 · apart 따로 삶 · gone 떠남 */
export type PersonState = 'with' | 'apart' | 'gone';

export interface Person {
  id: PersonId;
  role: PersonRole;
  /** 이름 (FM4b 전에는 빈 글자) */
  name: string;
  gender: Gender;
  birthYear: number;
  /** 지금 나이 (떠난 사람은 떠난 때 나이) */
  age: number;
  state: PersonState;
  goneAtOwnAge?: number;
  goneAtMyAge?: number;
  beforeMyBirth?: true;
  sibKind?: SiblingKind;
  older?: boolean;
  /** 아직 태어나지 않은 사람은 `people`에 넣지 않는다. 독립했는가(형제) — 카드에는 남고 그림에서 빠진다 */
  independent?: boolean;
  /** 따로 사는 이유: 'split' 이혼·별거 · 'away' 어른이 된 뒤 따로 삶 (apart일 때) */
  apartBy?: 'split' | 'away';
}

export interface PetView {
  species: 'dog' | 'cat' | 'other';
  name: string;
  since: number | null;
}

export interface FamilyView {
  age: number;
  calYear: number;
  people: Person[];
  siblingCount: { older: number; younger: number; living: number; total: number };
  /** 함께 사는 사람 (주인공 제외) — 3-1절 정의 */
  household: PersonId[];
  pets: PetView[];
  /** flags.parents_gone 또는 두 분 모두 gone */
  parentsGone: boolean;
}

export interface SceneMember {
  id: PersonId;
  role: 'parent' | 'grandparent' | 'sibling' | 'spouse' | 'child';
  gender: Gender;
  age: number;
}

export type SceneChange =
  | 'sib-born'
  | 'sib-left'
  | 'sib-gone'
  | 'gp-gone'
  | 'parent-gone'
  | 'parents-apart'
  | 'moved'
  | 'pet-in'
  | 'pet-out'
  | 'independent'
  | 'married'
  | 'child-born'
  | 'era';

export type HomeKind = 'detached' | 'detached-rent' | 'multi' | 'apt' | 'shack' | 'other';

export interface SceneFamilyState {
  calYear: number;
  me: { age: number; gender: Gender };
  /** 함께 사는 사람 (주인공 제외). 최대 7. 순서 = 그림 왼쪽부터 (조부 · 조모 · 아버지 · 어머니 · 손위 형제 · 손아래 · 배우자 · 자녀) */
  members: SceneMember[];
  /** 8명을 넘어 그림에 못 나온 사람 수 (한 줄에만 「그 밖에 N명」) */
  overflow: number;
  /** 출생 점유 형태 (그림에는 표시 안 함) */
  housing: Housing;
  dwelling: Dwelling | null;
  /** null = 표 대기(묶음 B) → 점유 형태 기본 모양 */
  homeKind: HomeKind | null;
  rooms: number | null;
  pets: { species: 'dog' | 'cat' | 'other'; place: 'yard' | 'indoor' }[];
  /** 이번 해(age−1 → age)에 바뀐 종류 — 교차 페이드 트리거와 시험용 */
  changed: SceneChange[];
}
