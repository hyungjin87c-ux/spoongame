import type { Gender } from '../core/types';
import namesJson from './names.json';
import scourtJson from './sources/scourt-birth-names.json';

/**
 * 이름 데이터. 시대마다 출처가 다르다(자세한 설명은 names.json의 meta, docs/data/names-source.md).
 *  - 지금 세상(2008~2025년생): 출생 연도별 법원 통계서비스 상위 20위. 원자료 파일을 실행 시점에 그대로 읽는다.
 *  - 다가올 세상(2030~2060년생): 통계가 없어 최근 5개 연도(meta.eras.future.sourceYears) 공식 풀의 합집합.
 *  - 지난 세상(1950~1989년생): names.json의 decades(언론 인용 확인분 + 추정 보충, 통계 아님).
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
    present: { birthYears: { min: number; max: number }; level: string; derivation: string; source: string; rawFile: string };
    future: { birthYears: { min: number; max: number }; level: string; source: string; sourceYears: number[]; derivation: string; note: string };
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
  /** 지난 세상의 연대 풀. 키는 연대의 첫 해("1950"…"1980"). */
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

/** 그 해 출생(등록)아의 공식 통계 이름 풀. 원자료에 없는 연도는 null. */
export function officialPool(year: number, gender: Gender): readonly string[] | null {
  return OFFICIAL.get(year)?.[gender] ?? null;
}

/** 다가올 세상 풀의 기준 연도들(names.json meta). */
const FUTURE_SOURCE_YEARS: readonly number[] = Object.freeze([...NAMES.meta.eras.future.sourceYears]);

const FUTURE: Readonly<Record<Gender, readonly string[]>> = (() => {
  const out = {} as Record<Gender, readonly string[]>;
  for (const gender of ['male', 'female'] as const) {
    const union: string[] = [];
    for (const year of FUTURE_SOURCE_YEARS) {
      const pool = officialPool(year, gender);
      if (!pool) throw new Error(`다가올 세상 풀의 기준 연도 ${year}가 원자료에 없다`);
      for (const name of pool) if (!union.includes(name)) union.push(name);
    }
    out[gender] = Object.freeze(union);
  }
  return Object.freeze(out);
})();

/** 다가올 세상(2030~2060년생)의 이름 풀: 기준 연도들의 공식 풀 합집합. */
export function futurePool(gender: Gender): readonly string[] {
  return FUTURE[gender];
}

// ---------- 지난 세상 연대 풀 ----------

const PAST: ReadonlyMap<number, Readonly<Record<Gender, readonly string[]>>> = new Map(
  Object.entries(NAMES.decades).map(([decade, d]) => [
    Number(decade),
    Object.freeze({
      male: Object.freeze([...d.male.verified, ...d.male.estimated]),
      female: Object.freeze([...d.female.verified, ...d.female.estimated]),
    }),
  ]),
);

/** 지난 세상 연대(1950·1960·1970·1980)의 이름 풀(verified + estimated). 풀이 없는 연대는 null. */
export function pastPool(decade: number, gender: Gender): readonly string[] | null {
  return PAST.get(decade)?.[gender] ?? null;
}
