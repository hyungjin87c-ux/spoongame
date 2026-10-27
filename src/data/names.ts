import type { Gender } from '../core/types';
import type { NamesApi } from '../core/gameData';
import { namePoolKey, type NamePoolId } from './namePoolId';
import namesJson from './names.json';
import scourtJson from './sources/scourt-birth-names.json';

/**
 * 이름 데이터. 출생 연도마다 출처가 다르다(자세한 설명은 names.json의 meta, docs/data/names-source.md). **풀 id 체계(SPEC-004 NR4·G-03)**:
 *  - `court-YYYY`(2008~2020): 법원 통계서비스 「상위 출생신고 이름 현황」 그 해 상위 20위. 원자료 파일을 실행 시점에 그대로 읽는다. **등록 연도 기준**이라 출생 연도와 정확히 1:1이 아니다(연말 출생 → 이듬해 등록).
 *  - `decade-1940`~`decade-2000`(2007년 이전): names.json의 decades(1950~80년대는 언론 인용 확인분 + 추정 보충, 1940·1990·2000~2007은 전부 추정 — 통계 아님). 2000은 2000~2007 한 풀.
 *  - 시험 전용 R1 프로필(2026년생): 가장 최근 연도(`PRESENT_POOL_YEAR` = 2025)의 `court` 풀 하나 (SPEC-003 EV7: 2026년은 진행 중이라 수집하지 않는다).
 */

// ---------- 지난 세상: names.json (손으로 관리하는 연대 풀) ----------

export interface PastPool {
  /** 언론이 인용한 대법원 자료로 확인된 이름 */
  verified: string[];
  /** 통계가 아닌 추정 보충 (names.json meta.caveats 참고) */
  estimated: string[];
}

export interface PastDecade {
  verification: string;
  basis: string[];
  male: PastPool;
  female: PastPool;
}

export interface SurnameItem {
  name: string;
  /** 2015 인구주택총조사 보도 인구수(천 명). 뽑기 가중치로 쓰이는 유일한 값. */
  populationThousands: number;
}

export interface NamesMeta {
  eras: {
    /** 법원 연도 풀(2008~2020)과 시험 전용 R1 프로필(2026년생 = 2025년 풀)의 출처 설명 */
    present: { birthYears: { min: number; max: number }; poolYear: number; level: string; derivation: string; source: string; rawFile: string };
    /** 연대 풀(2007년 이전)의 출처 설명 */
    past: { birthYears: { min: number; max: number }; level: string; source: string; derivation: string };
  };
  verificationLevels: Record<string, string>;
  caveats: string[];
  sources: { id: string; name: string; url: string }[];
  /** 타이틀 화면에 표시하는 출처 표기 */
  attribution: { text: string; url: string };
  [k: string]: unknown;
}

export interface NamesData {
  meta: NamesMeta;
  surnames: { censusYear: number; basis: string; items: SurnameItem[] };
  /** 연대 풀. 키는 연대의 첫 해("1940"…"2000"; 2000은 2000~2007). */
  decades: Record<string, PastDecade>;
}

export const NAMES = namesJson as unknown as NamesData;

// ---------- 지금 세상·다가올 세상: 원자료(법원 통계서비스) ----------

export interface ScourtRow {
  rank: number;
  name: string;
  count: number;
  ratio: number | null;
}

interface ScourtData {
  meta: { suggestedAttribution: string; url: string; [k: string]: unknown };
  years: Record<string, Partial<Record<'M' | 'F', ScourtRow[]>>>;
}

const SCOURT = scourtJson as unknown as ScourtData;

const COLUMN: Record<Gender, 'M' | 'F'> = { male: 'M', female: 'F' };

/** 서비스 표의 이름이 아닌 행 이름("기타"는 21위 이하 묶음, "합계"는 맨 아래 합계 행). 이름 풀에 섞이면 안 된다(R-026). */
const NON_NAME_ROWS: ReadonlySet<string> = new Set(['기타', '합계', '총계', '소계', '전체']);

/**
 * 원자료의 한 칸(연도·성별)이 이름 풀의 재료로 쓸 수 있는 모양인지 검사한다. 어긋나면 throw — 수집 오류가
 * 조용히 이름 풀에 섞이지 않게 한다(R-026). 검사: 이름 행만 있음("기타"·"합계" 금지, 한글 2~3자, 중복 없음),
 * 건수는 비증가, 순위는 서비스 규칙(동점이면 같은 순위, 다음 순위는 건너뜀)과 일치하고 첫 순위는 1.
 */
export function validateOfficialRows(label: string, rows: readonly ScourtRow[]): void {
  if (rows.length === 0) throw new Error(`${label}: 이름 행이 없다`);
  const seen = new Set<string>();
  rows.forEach((r, i) => {
    if (NON_NAME_ROWS.has(r.name)) throw new Error(`${label}: 이름이 아닌 행("${r.name}")이 섞여 있다`);
    if (!/^[가-힣]{2,3}$/.test(r.name)) throw new Error(`${label}: 이름 형식이 이상하다("${r.name}")`);
    if (seen.has(r.name)) throw new Error(`${label}: 이름이 중복이다("${r.name}")`);
    seen.add(r.name);
    if (!Number.isInteger(r.count) || r.count <= 0) throw new Error(`${label}: 건수가 양의 정수가 아니다(${r.name}: ${r.count})`);
    if (i > 0 && r.count > rows[i - 1].count) throw new Error(`${label}: 건수가 내림차순이 아니다(${rows[i - 1].name} ${rows[i - 1].count} < ${r.name} ${r.count})`);
  });
  // 순위 검사는 건수가 내림차순임을 확인한 뒤에 한다(순서가 틀린 칸의 오류 메시지가 순위 불일치로 가려지지 않게)
  for (const r of rows) {
    const expectedRank = 1 + rows.filter((o) => o.count > r.count).length;
    if (r.rank !== expectedRank) throw new Error(`${label}: 순위가 건수와 맞지 않는다(${r.name}: 순위 ${r.rank}, 기대 ${expectedRank})`);
  }
}

/** 연도 → 성별 → 그 해 상위 순위 이름들(원자료의 실제 행 순서·행 수 그대로). 한 번만 만든다. */
const OFFICIAL: ReadonlyMap<number, Readonly<Record<Gender, readonly string[]>>> = (() => {
  const out = new Map<number, Record<Gender, readonly string[]>>();
  for (const [yearKey, cells] of Object.entries(SCOURT.years)) {
    const year = Number(yearKey);
    const pools = {} as Record<Gender, readonly string[]>;
    for (const gender of ['male', 'female'] as const) {
      const rows = cells[COLUMN[gender]];
      if (!rows || rows.length === 0) throw new Error(`원자료에 ${year}년 ${gender} 행이 없다`);
      validateOfficialRows(`원자료 ${year}년 ${gender}`, rows);
      pools[gender] = Object.freeze(rows.map((r) => r.name));
    }
    out.set(year, Object.freeze(pools));
  }
  return out;
})();

/**
 * 시험 전용 R1 프로필(2026년생)이 쓰는 이름 풀의 기준 연도 — 가장 최근 연도 하나(SPEC-003 EV7 R1). 올해(2026)는 진행 중이라 통계가 없다.
 * names.json의 meta.eras.present.poolYear와 같은 값이다(tests/names.test.ts가 대조한다).
 */
export const PRESENT_POOL_YEAR = 2025;

/** 그 해 출생(등록)아의 공식 통계 이름 풀. 원자료에 없는 연도는 null. */
export function officialPool(year: number, gender: Gender): readonly string[] | null {
  return OFFICIAL.get(year)?.[gender] ?? null;
}

// ---------- 연대 풀 (2007년 이전) ----------

const PAST: ReadonlyMap<number, Readonly<Record<Gender, readonly string[]>>> = new Map(
  Object.entries(NAMES.decades).map(([decade, d]) => [
    Number(decade),
    Object.freeze({
      male: Object.freeze([...d.male.verified, ...d.male.estimated]),
      female: Object.freeze([...d.female.verified, ...d.female.estimated]),
    }),
  ]),
);

/** 연대(1940·1950·…·1990·2000)의 이름 풀(verified + estimated). 풀이 없는 연대는 null. */
export function pastPool(decade: number, gender: Gender): readonly string[] | null {
  return PAST.get(decade)?.[gender] ?? null;
}

// ---------- 출생 연도 → 풀 (NR4) ----------

export { namePoolKey, type NamePoolId };

/** 법원 연도 풀이 있는 첫 해·마지막 해 (등록 연도 기준) */
export const COURT_POOL_FIRST_YEAR = 2008;
export const COURT_POOL_LAST_BIRTH_YEAR = 2020;

/**
 * 출생 연도 → 이름 풀 (SPEC-004 NR4): 2008~2020은 그 해 법원 풀, 1940~2007은 연대 풀(2000~2007은 `decade-2000` 한 풀), 시험 전용 R1 프로필의 2026년생은 2025년 법원 풀.
 * 풀이 없는 연도(1939 이하, 2021~2025, 2027 이상)와 정수가 아닌 연도는 **throw**한다 — 다른 풀로 조용히 돌려보내면 「있지도 않은 통계」가 된다.
 */
export function namePoolIdOf(birthYear: number): NamePoolId {
  if (!Number.isInteger(birthYear)) throw new RangeError(`namePoolIdOf: 정수 연도가 아니다 (${birthYear})`);
  if (birthYear === 2026) {
    if (officialPool(PRESENT_POOL_YEAR, 'male') === null) throw new RangeError(`namePoolIdOf: ${PRESENT_POOL_YEAR}년 공식 통계 풀이 없다`);
    return { kind: 'court', year: PRESENT_POOL_YEAR };
  }
  if (birthYear >= COURT_POOL_FIRST_YEAR && birthYear <= COURT_POOL_LAST_BIRTH_YEAR) {
    if (officialPool(birthYear, 'male') === null) throw new RangeError(`namePoolIdOf: ${birthYear}년 공식 통계 풀이 없다`);
    return { kind: 'court', year: birthYear };
  }
  if (birthYear >= 1940 && birthYear <= 2007) {
    const decade = Math.min(2000, Math.floor(birthYear / 10) * 10);
    if (pastPool(decade, 'male') === null) throw new RangeError(`namePoolIdOf: ${decade}년대 이름 풀이 없다`);
    return { kind: 'decade', decade };
  }
  throw new RangeError(`namePoolIdOf: ${birthYear}년생은 이름 풀이 없다 (풀은 1940~2020년생과 시험 전용 2026년생뿐이다)`);
}

/** 출생 연도·성별에 맞는 이름(성 제외) 풀. 읽기 전용. */
export function namePoolFor(birthYear: number, gender: Gender): readonly string[] {
  const id = namePoolIdOf(birthYear);
  const pool = id.kind === 'decade' ? pastPool(id.decade, gender) : officialPool(id.year, gender);
  if (pool === null || pool.length === 0) throw new RangeError(`namePoolFor: ${birthYear}년 ${gender} 이름 풀이 비어 있다`);
  return pool;
}

/**
 * 지연 덩어리(`data/gameData.ts`)가 `core/gameData.ts`에 놓는 이름 데이터의 얼굴 (R-520): 뽑기에 쓰는 성씨 가중 목록과 풀 함수 둘.
 * core(birth.ts)는 이 파일을 정적으로 import하지 않는다 — 이름 풀 JSON(names.json·scourt-birth-names.json, gzip 약 7.3KB)이 첫 화면 덩어리에 들지 않게.
 */
export const NAMES_API: NamesApi = { surnames: NAMES.surnames.items, namePoolFor, namePoolIdOf };
