import type { Gender, Housing, Occupation } from '../core/types';
import { HOUSINGS, OCCUPATIONS } from '../core/types';
import { ERA_CONFIG } from './birthTable';
import { FATHER_GAP, NATIONAL_ROW, OCCUPATION_STAT_ROW, PARENT_AGE_SHIFT_BY_WEALTH } from './birthReportTable';
import { buildParentAgeModel, type ParentAgeModel } from './parentAgeModel';
import {
  getRouletteRegions,
  getSigunguRows2025,
  getSigunguRows2026,
  getUsableIndicator,
  type RouletteRegion,
  type RouletteRegions,
} from './koreaStatsAccess';

/**
 * 출생신고·룰렛이 쓰는 출생 통계를 **검증된 지표(접근자)에서만** 읽어 타입이 있는 모양으로 꺼내 준다 (SPEC-003 BR4, 근거 s-016~s-025).
 * koreaStats.json을 직접 import하지 않는다 — `usable: false`·미확인 하위 항목이 게임에 새어 들어가지 않게 koreaStatsAccess.ts만 거친다.
 * 모양이 기대와 다르면(지표가 없거나 열이 바뀌었으면) 조용히 넘어가지 않고 throw한다 — 통계 갱신이 코드와 어긋난 것을 개발 중에 바로 드러내기 위해서다.
 * 값은 처음 쓰일 때 한 번만 읽는다(첫 화면이 이 통계를 못 읽어도 열리도록 import 시점에는 아무것도 하지 않는다).
 */

export interface Band {
  label: string;
  /** 나이 구간의 양 끝(포함). 「20세 미만」·「45세 이상」 같은 열린 구간은 사람이 정한 끝(아래 AGE_OPEN_ENDS)으로 닫는다. */
  min: number;
  max: number;
  weight: number;
}

/** 열린 나이 구간의 끝(설계값): 「20세 미만」은 어머니·아버지 16세부터(저장 검증의 부모 나이 하한과 같다) / 「45세 이상」은 49세까지, 「50세 이상」은 54세까지 */
const AGE_OPEN_ENDS = { mother: { low: 16, high: 49 }, father: { low: 16, high: 54 } } as const;

/** 「20세 미만」「25~29세」「45세 이상」 → 닫힌 나이 구간 */
export function parseAgeBand(label: string, ends: { low: number; high: number }): { min: number; max: number } {
  let m = /^(\d+)세 미만$/.exec(label);
  if (m) return { min: ends.low, max: Number(m[1]) - 1 };
  m = /^(\d+)~(\d+)세$/.exec(label);
  if (m) return { min: Number(m[1]), max: Number(m[2]) };
  m = /^(\d+)세 이상$/.exec(label);
  if (m) return { min: Number(m[1]), max: ends.high };
  throw new Error(`나이 구간 이름을 읽을 수 없다: ${label}`);
}

/** 체중 칸 하나(0.1kg 격자): 값과 확률(합 1) */
export interface WeightGrid {
  /** 0.1kg 격자 값 (오름차순) */
  values: number[];
  /** 각 값의 확률 (합 1; 체중 미상은 뺀다) */
  probs: number[];
}

/** 열린 체중 구간의 끝(설계값): 「1.5kg 미만」은 1.0~1.4kg, 「4.5kg 이상」은 4.5~4.9kg 격자로 닫는다 */
const WEIGHT_OPEN_WIDTH_KG = 0.5;

/** 「1.5~1.9kg」「1.5kg 미만」「4.5kg 이상」 → [아래(포함), 위(미포함)) kg */
export function parseWeightBin(label: string): { lo: number; hi: number } {
  let m = /^(\d(?:\.\d)?)~(\d(?:\.\d)?)kg$/.exec(label);
  if (m) return { lo: Number(m[1]), hi: Math.round((Number(m[2]) + 0.1) * 10) / 10 };
  m = /^(\d(?:\.\d)?)kg 미만$/.exec(label);
  if (m) return { lo: Math.round((Number(m[1]) - WEIGHT_OPEN_WIDTH_KG) * 10) / 10, hi: Number(m[1]) };
  m = /^(\d(?:\.\d)?)kg 이상$/.exec(label);
  if (m) return { lo: Number(m[1]), hi: Math.round((Number(m[1]) + WEIGHT_OPEN_WIDTH_KG) * 10) / 10 };
  throw new Error(`체중 구간 이름을 읽을 수 없다: ${label}`);
}

export interface BirthStats {
  /** 출생 통계 기준 연도 (월별 출생아 열·체중·연령·순위·주거 모두 이 해의 값 — 주거는 2024) */
  year: number;
  /** 1~12월 출생아 수(기준 연도) — 출생 월 추첨 가중 (남은 결정 R1) */
  monthWeights: number[];
  /** 성별 체중 격자 */
  weight: Record<Gender, WeightGrid>;
  motherBands: Band[];
  fatherBands: Band[];
  /** 모(母)의 평균 출산연령(세): 전체와 출산 순위별(통계 s-020) — 형제 순서에 따른 나이 보정의 기준 */
  motherAverages: { all: number; first: number; second: number; thirdPlus: number };
  /**
   * 부모 나이 분포 모델(R-265): 공표 구간 비중을 그대로 두고, 구간 안 기울기로 공표 평균(어머니 33.8·아버지 36.1)과 출산 순위별 평균(첫째 33.2·둘째 34.7·셋째 이상 35.8)에 맞춘 확률표.
   * 자세한 방법은 data/parentAgeModel.ts. 처음 쓸 때 한 번 만든다.
   */
  parentAges: ParentAgeModel;
  /** 시·도 줄임 이름(+「전국」) → [첫째, 둘째, 셋째 이상] 비중(%) */
  orderRows: Record<string, [number, number, number]>;
  /** 시·도 줄임 이름·「전국」·「전국·저소득층」… → [자가, 임차, 무상] 비율(%) */
  housingRows: Record<string, [number, number, number]>;
  /** 직업 대분류별 30~39세·40~49세 취업자(천 명) */
  occupation: { a30: Record<Occupation, number>; a40: Record<Occupation, number> };
  /** 시·도(2025, 17개 시도) 줄임 이름 → 출생아 수 */
  sidoBirths: Record<string, number>;
}

function need<T>(value: T | undefined, what: string): T {
  if (value === undefined) throw new Error(`출생 통계를 읽을 수 없다: ${what}`);
  return value;
}

function rowsOf(id: string): Array<Record<string, unknown>> {
  const ind = need(getUsableIndicator(id), `지표 ${id}가 없거나 확인되지 않았다`);
  return need(ind.rows, `지표 ${id}에 표(rows)가 없다`);
}

function num(row: Record<string, unknown>, key: string, where: string): number {
  const v = row[key];
  if (typeof v !== 'number' || !Number.isFinite(v)) throw new Error(`출생 통계를 읽을 수 없다: ${where}의 ${key}`);
  return v;
}

function readWeight(): Record<Gender, WeightGrid> {
  const rows = rowsOf('birth-weight').filter((r) => r.bin !== '미상'); // 체중을 모르는 출생아는 분포에서 뺀다
  const out = {} as Record<Gender, WeightGrid>;
  for (const gender of ['male', 'female'] as const) {
    const values: number[] = [];
    const counts: number[] = [];
    for (const r of rows) {
      const { lo, hi } = parseWeightBin(String(r.bin));
      const steps = Math.round((hi - lo) / 0.1);
      const count = num(r, gender, `birth-weight ${String(r.bin)}`);
      for (let k = 0; k < steps; k++) {
        values.push(Math.round((lo + k * 0.1) * 10) / 10);
        counts.push(count / steps); // 구간 안은 균등 분포를 가정한 근사(설계 보정, 통계 notes)
      }
    }
    const total = counts.reduce((a, b) => a + b, 0);
    out[gender] = { values, probs: counts.map((c) => c / total) };
  }
  return out;
}

function readBands(id: string, valueOf: (series: Record<string, unknown>) => number, ends: { low: number; high: number }): Band[] {
  const ind = need(getUsableIndicator(id), `지표 ${id}`);
  const series = need(ind.series, `지표 ${id}에 series가 없다`) as unknown as Array<Record<string, unknown>>;
  return series.map((p) => {
    const label = String(p.label);
    return { label, ...parseAgeBand(label, ends), weight: valueOf(p) };
  });
}

function readFatherAverage(): number {
  const ind = need(getUsableIndicator('birth-father-age'), '지표 birth-father-age');
  const all = (ind.averages as Record<string, unknown> | undefined)?.all;
  if (typeof all !== 'number' || !Number.isFinite(all)) throw new Error('출생 통계를 읽을 수 없다: birth-father-age averages.all');
  return all;
}

function readMotherAverages(): BirthStats['motherAverages'] {
  const ind = need(getUsableIndicator('birth-mother-age'), '지표 birth-mother-age');
  const a = ind.averages as Record<string, unknown> | undefined;
  const get = (key: string): number => {
    const v = a?.[key];
    if (typeof v !== 'number' || !Number.isFinite(v)) throw new Error(`출생 통계를 읽을 수 없다: birth-mother-age averages.${key}`);
    return v;
  };
  return { all: get('all'), first: get('first'), second: get('second'), thirdPlus: get('thirdPlus') };
}

let cache: BirthStats | null = null;

/** 출생 통계 한 벌 (처음 부를 때 읽고 이후 같은 객체) */
export function getBirthStats(): BirthStats {
  if (cache !== null) return cache;
  // 월별 출생아: 가장 최근 연도 열(y2025)
  const monthRows = rowsOf('birth-by-month');
  const yearKeys = Object.keys(monthRows[0]).filter((k) => /^y\d{4}$/.test(k)).sort();
  const yearKey = need(yearKeys[yearKeys.length - 1], 'birth-by-month 연도 열');
  const monthWeights = Array.from({ length: 12 }, (_, i) => {
    const row = need(monthRows.find((r) => r.month === i + 1), `birth-by-month ${i + 1}월`);
    return num(row, yearKey, `birth-by-month ${i + 1}월`);
  });

  const orderRows: BirthStats['orderRows'] = {};
  for (const r of rowsOf('birth-order')) orderRows[String(r.label)] = [num(r, 'first', 'birth-order'), num(r, 'second', 'birth-order'), num(r, 'thirdPlus', 'birth-order')];

  const housingRows: BirthStats['housingRows'] = {};
  for (const r of rowsOf('housing-tenure')) housingRows[String(r.label)] = [num(r, 'own', 'housing-tenure'), num(r, 'rent', 'housing-tenure'), num(r, 'free', 'housing-tenure')];

  const a30 = {} as Record<Occupation, number>;
  const a40 = {} as Record<Occupation, number>;
  const occRows = rowsOf('occupation-proxy');
  for (const job of OCCUPATIONS) {
    const row = need(occRows.find((r) => r.label === OCCUPATION_STAT_ROW[job]), `occupation-proxy ${OCCUPATION_STAT_ROW[job]}`);
    a30[job] = num(row, 'a30', OCCUPATION_STAT_ROW[job]);
    a40[job] = num(row, 'a40', OCCUPATION_STAT_ROW[job]);
  }

  const sidoBirths: Record<string, number> = {};
  for (const r of rowsOf('birth-by-sido')) sidoBirths[String(r.sido)] = num(r, 'births', 'birth-by-sido');

  const motherBands = readBands('birth-mother-age', (p) => num(p, 'value', 'birth-mother-age'), AGE_OPEN_ENDS.mother);
  const fatherBands = readBands('birth-father-age', (p) => num(p, 'value', 'birth-father-age'), AGE_OPEN_ENDS.father);
  const motherAverages = readMotherAverages();
  cache = {
    year: need(getUsableIndicator('birth-by-sido'), 'birth-by-sido').latest.year,
    monthWeights,
    weight: readWeight(),
    motherBands,
    motherAverages,
    fatherBands,
    parentAges: buildParentAgeModel({
      motherBands,
      fatherBands,
      motherMean: motherAverages.all,
      fatherMean: readFatherAverage(),
      orderShares: need(orderRows[NATIONAL_ROW], `birth-order ${NATIONAL_ROW} 행`),
      orderMeans: [motherAverages.first, motherAverages.second, motherAverages.thirdPlus],
      wealthWeights: ERA_CONFIG.present.wealthWeights,
      wealthOffsets: [1, 2, 3, 4, 5].map((w) => PARENT_AGE_SHIFT_BY_WEALTH[w as 1 | 2 | 3 | 4 | 5]),
      gap: FATHER_GAP,
    }),
    orderRows,
    housingRows,
    occupation: { a30, a40 },
    sidoBirths,
  };
  return cache;
}

// ---------- 지역 ----------

/** 출생 연도의 룰렛 지역 목록(비율 합 100.0). 어느 시대에도 속하지 않는 연도는 throw. */
export function regionsOf(birthYear: number): RouletteRegions {
  const regions = getRouletteRegions(birthYear);
  if (regions === undefined) throw new RangeError(`regionsOf: ${birthYear}년생의 룰렛 지역 목록이 없다`);
  return regions;
}

/** 합쳐진 지역(전남광주·지난 세상의 경기 등)의 값 = 속한 시·도 값의 출생아 수 가중 평균 */
function weightedByBirths(region: RouletteRegion, rows: Record<string, number[]>, width: number, what: string): number[] {
  const stats = getBirthStats();
  const sum = new Array<number>(width).fill(0);
  let total = 0;
  for (const sido of region.from) {
    const row = need(rows[sido], `${what}에 ${sido} 행이 없다`);
    const births = need(stats.sidoBirths[sido], `birth-by-sido에 ${sido} 행이 없다`);
    for (let k = 0; k < width; k++) sum[k] += row[k] * births;
    total += births;
  }
  return sum.map((v) => v / total);
}

/** 이 지역의 [첫째, 둘째, 셋째 이상] 비중(%, 합 약 100) */
export function regionOrderShares(region: RouletteRegion): [number, number, number] {
  return weightedByBirths(region, getBirthStats().orderRows, 3, 'birth-order') as [number, number, number];
}

/** 이 지역의 [자가, 임차, 무상] 비율(%, 합 약 100) */
export function regionHousing(region: RouletteRegion): [number, number, number] {
  return weightedByBirths(region, getBirthStats().housingRows, 3, 'housing-tenure') as [number, number, number];
}

export interface SigunguChoice {
  /** 통계에서 속한 시·도(줄임 이름) */
  sido: string;
  /** 시군구 이름 (일반구는 「수원시 장안구」) */
  name: string;
  births: number;
  /** 2026년 개편으로 인구 비례로 옮겨 만든 설계값인가(화면에 설계값임을 밝힌다) */
  designValue: boolean;
}

/**
 * 룰렛이 정한 시·도 안의 시군구 후보(출생아 수가 추첨 가중). 지금 세상·다가올 세상은 2026년 행정구역(새 구 8개는 설계값), 지난 세상은 2025년 행정구역을 그 시기 시·도 구분에 맞춰 쓴다(설계값).
 * (시·도, 이름) 쌍은 지역 안에서 유일하다.
 */
export function sigunguChoices(birthYear: number, regionName: string): SigunguChoice[] {
  const regions = regionsOf(birthYear);
  const region = need(regions.regions.find((r) => r.name === regionName), `${birthYear}년생 룰렛 지역에 ${regionName}이 없다`);
  if (birthYear >= 2026) {
    return getSigunguRows2026()
      .filter((r) => r.sido2026 === region.name)
      .map((r) => ({ sido: r.sido, name: r.parent === undefined ? r.name : `${r.parent} ${r.name}`, births: r.births, designValue: r.designValue }));
  }
  return getSigunguRows2025()
    .filter((r) => region.from.includes(r.sido))
    .map((r) => ({ sido: r.sido, name: r.name, births: r.births, designValue: true }));
}

// ---------- 주거 ----------

/** 점유형태 비율 배열의 인덱스 → Housing */
export const HOUSING_BY_INDEX: readonly Housing[] = HOUSINGS;

/** 소득계층 배율 계산용: 전국 행 */
export function nationalHousing(): [number, number, number] {
  return need(getBirthStats().housingRows[NATIONAL_ROW], `housing-tenure ${NATIONAL_ROW}`) as [number, number, number];
}

/** 통계표 행 이름으로 점유형태 비율을 꺼낸다 */
export function housingRow(label: string): [number, number, number] {
  return need(getBirthStats().housingRows[label], `housing-tenure ${label}`) as [number, number, number];
}
