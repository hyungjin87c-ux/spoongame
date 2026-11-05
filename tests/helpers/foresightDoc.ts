/**
 * SPEC-010 FU11 시험 도우미: 근거 조사 문서 `docs/data/future-foresight-quotes.md`의 1절 표를 **직접 읽는다**(복사본이 아니다). 근거 칸 글의 사람·기관·자료·연도·보도 기준 표시·반대 표시가
 * 이 표에 있는 것과 같은지 `tests/eraForesight.test.ts`가 견준다 — 출처 문서에 없는 이름을 게임 안에 두지 않으려는 잠금이다.
 */

export interface QuoteRow {
  /** 번호 칸 그대로 (예: `U07(U06·U08 공통)`) */
  numberCell: string;
  /** 번호 칸에 나오는 모든 U번호 — 이 행을 쓸 수 있는 줄들 */
  numbers: string[];
  who: string;
  role: string;
  work: string;
  date: string;
  summary: string;
  quote: string;
  url: string;
  /** `원문`·`원문(인터뷰)`·`2차` … */
  check: string;
  gap: string;
}

const docs = import.meta.glob('../../docs/data/future-foresight-quotes.md', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;
export const QUOTES_DOC: string = Object.values(docs)[0] ?? '';

/** 1절 근거 표의 행들 (「## 1. 근거 표」부터 「## 2.」 앞까지, U번호로 시작하는 표 행) — 2절의 현황 표는 열이 달라 읽지 않는다 */
const SECTION_1: string = QUOTES_DOC.slice(QUOTES_DOC.indexOf('## 1. 근거 표'), QUOTES_DOC.indexOf('## 2.'));
export const QUOTE_ROWS: readonly QuoteRow[] = SECTION_1.split('\n')
  .filter((l) => /^\| U\d\d/.test(l))
  .map((l) => {
    const c = l.split('|').map((x) => x.trim());
    return { numberCell: c[1], numbers: c[1].match(/U\d\d/g) ?? [], who: c[2], role: c[3], work: c[4], date: c[5], summary: c[6], quote: c[7], url: c[8], check: c[9], gap: c[10] };
  });

/**
 * 다른 번호의 행을 빌려 쓰는 줄: 「부유한 쪽이 먼저」 줄은 기술 근거를 짝 줄의 행에서 가져온다(U15←U14, U22←U21).
 *
 * **번호가 같은 범위는 U26까지다.** 조사 문서 1절의 번호는 r2 개정(2026-11-04) 전의 옛 번호(U01~U44)이고 SPEC-010 본표는 U27부터 새 번호(U27~U46)다 — 묶음 B(U13~U26)까지는 같지만 U27 이후는 다르다
 * (예: 새 U34 「빈 학교가 노인 시설로」는 문서의 U13·U31·U32행을, 새 U35 「AI가 일자리 대부분을」은 U07·U08행을 쓴다 — SPEC 표의 「quotes U##행」). 옛 표(U28←U27·U35←U18·U43←U23)를 그대로 두면
 * 묶음 C가 들어올 때 새 번호가 옛 번호의 엉뚱한 행을 읽으므로, **묶음 C 회차에 새 번호 → 문서 행 번호 표로 바꾼다**(그때까지 U27 이후는 자기 번호의 행만 본다).
 */
export const BORROWED_ROWS: Readonly<Record<string, readonly string[]>> = { U15: ['U14'], U22: ['U21'] };

/** 번호 `u`의 줄이 쓸 수 있는 문서 표 행 (자기 행 + 빌려 쓰는 행) */
export function rowsFor(u: string): QuoteRow[] {
  const ids = [u, ...(BORROWED_ROWS[u] ?? [])];
  return QUOTE_ROWS.filter((r) => r.numbers.some((n) => ids.includes(n)));
}
