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
    /** 부모 출생 연도가 `to` 이하이면 출산 연령을 `by`살 이른 쪽으로 (추정) */
    shift: Array<{ to: number; by: number }>;
  };
  household: { multiplier: number; points: Array<[number, number, string]> };
  divorce: { rateFrom: number; rate: number[]; crudeFrom: number; crude: number[] };
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
