/**
 * SPEC-010 FU11 시험 도우미: 근거 조사 문서 `docs/data/future-foresight-quotes.md`의 표를 **직접 읽는다**(복사본이 아니다). 근거 칸 글의 사람·기관·자료·연도·보도 기준 표시·반대 표시가
 * 이 표에 있는 것과 같은지 `tests/eraForesight.test.ts`가 견준다 — 출처 문서에 없는 이름을 게임 안에 두지 않으려는 잠금이다.
 *
 * 문서의 표는 둘이다(번호 모양이 다르다):
 *  - **1절**(`QUOTE_ROWS`, 69행): 번호가 `U01`~`U44`이고, **r2 개정(2026-11-04) 전의 옛 번호**다. SPEC-010 본표(U27~U46)와 U26까지는 같고 U27부터 다르다.
 *  - **7-1절**(`R2_ROWS`, r2 보강 15행): 번호가 `N33`·`N35·N36`·`N37`·`N38`·`N40`·`N43`·`N44`이다. `N##`은 r2 개정안의 임시 번호이고 SPEC-010 본표의 `U##`와 **같은 순서**다(N33 → U33 …).
 */

export interface QuoteRow {
  /** 번호 칸 그대로 (예: `U07(U06·U08 공통)`, `N35·N36 (보강)`) */
  numberCell: string;
  /** 번호 칸에 나오는 모든 문서 번호(1절은 `U##` 옛 번호, 7-1절은 `N##`) — 이 행을 쓸 수 있는 줄들 */
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

const toRow = (l: string, mark: RegExp): QuoteRow => {
  const c = l.split('|').map((x) => x.trim());
  return { numberCell: c[1], numbers: c[1].match(mark) ?? [], who: c[2], role: c[3], work: c[4], date: c[5], summary: c[6], quote: c[7], url: c[8], check: c[9], gap: c[10] };
};

/** 1절 근거 표의 행들 (「## 1. 근거 표」부터 「## 2.」 앞까지, U번호로 시작하는 표 행) — 2절의 현황 표는 열이 달라 읽지 않는다. 번호는 r2 개정 전의 옛 번호다 */
const SECTION_1: string = QUOTES_DOC.slice(QUOTES_DOC.indexOf('## 1. 근거 표'), QUOTES_DOC.indexOf('## 2.'));
export const QUOTE_ROWS: readonly QuoteRow[] = SECTION_1.split('\n')
  .filter((l) => /^\| U\d\d/.test(l))
  .map((l) => toRow(l, /U\d\d/g));

/** 7-1절 r2 보강 표의 행들 (「### 7-1. 근거 표」부터 「### 7-2.」 앞까지, N번호로 시작하는 표 행) — 번호 `N##`은 SPEC-010 본표의 `U##`와 같은 순서다 */
const SECTION_7_1: string = QUOTES_DOC.slice(QUOTES_DOC.indexOf('### 7-1. 근거 표'), QUOTES_DOC.indexOf('### 7-2.'));
export const R2_ROWS: readonly QuoteRow[] = SECTION_7_1.split('\n')
  .filter((l) => /^\| N\d\d/.test(l))
  .map((l) => toRow(l, /N\d\d/g));

/** 문서의 모든 근거 행(1절 69 + 7-1절 15) */
export const DOC_ROWS: readonly QuoteRow[] = [...QUOTE_ROWS, ...R2_ROWS];

/**
 * **SPEC-010 번호 → 조사 문서의 행 번호** (묶음 C 회차에 옛 「빌려 쓰기」 표 `BORROWED_ROWS`를 이 표로 바꿨다).
 * 조사 문서 1절의 번호는 r2 개정(2026-11-04) 전의 옛 번호(U01~U44)이고 7-1절은 임시 번호 N##이다. 묶음 B(U13~U26)까지는 두 번호가 같지만 U27부터 다르다(예: 새 U30 「사람 없는 공장」은 옛 U07행을 쓰고 옛 U30행은 새 U29가 쓴다).
 * 값은 SPEC-010 본표 「근거」 칸의 「quotes U##행」(= 1절의 옛 번호)과 「새 조사」(= 7-1절 N##)를 그대로 옮긴 것이고, 한 번호의 행이 후보다. 「부유한 쪽이 먼저」 줄(U15←U14 · U22←U21)은 짝 줄의 행을 빌린다.
 * 값이 빈 목록인 줄은 문서에 후보가 없다 — U11·U12·U20·U26(묶음 A·B)과 U41(밤 노동: 기후 배경 U36행뿐이고 「밤 노동」 자체는 근거 종류 글자만, 마스터 2026-11-04), U46(끝 줄, 칩 없음)이다.
 */
export const DOC_NUMBERS_OF: Readonly<Record<string, readonly string[]>> = {
  // 묶음 A·B: 번호가 같다(U15·U22는 문서에 자기 행이 없고 짝 줄 U14·U21의 행을 빌린다). 문서에 행이 없는 U11·U12·U20·U26은 빈 목록이다
  U01: ['U01'], U02: ['U02'], U03: ['U03'], U04: ['U04'], U05: ['U05'], U06: ['U06'], U07: ['U07'], U08: ['U08'], U09: ['U09'], U10: ['U10'], U11: [], U12: [],
  U13: ['U13'], U14: ['U14'], U15: ['U14'], U16: ['U16'], U17: ['U17'], U18: ['U18'], U19: ['U19'], U20: [], U21: ['U21'], U22: ['U21'], U23: ['U23'], U24: ['U24'], U25: ['U25'], U26: [],
  // 묶음 C (r2): 새 번호 → 옛 번호 행 + 7-1절 행
  U27: ['U27'], // 의식 이전 · 거래 — 국립학술원 · 니코렐리스·세스(반대) · 커즈와일
  U28: ['U27'], // 의식 이전 · 식탁의 가족 — 같은 행
  U29: ['U30', 'U29'], // 사람이 떠난 마을 — 통계청 생산연령인구(옛 U30행) · 소멸위험 시군구(옛 U29행)
  U30: ['U07'], // 사람 없는 공장 — AI Impacts · 아세모글루(반대)
  U31: ['U21'], // 늙는 쪽/늙지 않는 쪽 — 노화: 커즈와일·드 그레이·아모데이 / 올샨스키(반대)
  U32: ['U21'], // 늙지 않는 사람이 늘었습니다 — 같은 행
  U33: ['N33'], // 로봇이 노인을 돌보는 시설 — 새 조사 3행
  U34: ['U13', 'U31', 'U32'], // 빈 학교가 노인 시설로 — 통계청 학령인구 · UN 세계 고령 · 통계청 고령
  U35: ['U07', 'U08', 'N35'], // AI가 일자리 대부분을 — AI Impacts·세계경제포럼 · IMF 불평등 · Humlum(반대, 7-1절 보강 행 N35·N36)
  U36: ['U07', 'U08', 'N36'], // 일하지 않아도 사는 집 — 아세모글루(반대) · IMF · Humlum(반대)
  U37: ['N37'], // 바람과 햇빛 — IEA 2행
  U38: ['U16', 'N38'], // 미·중 두 진영 — WTO·IMF 직원(옛 U16행) · IMF 연구진·SUERF(7-1절)
  U39: ['U37', 'U38'], // 물에 잠긴 동네 — 기상청 집중호우 · 해수면
  U40: ['U38', 'N40'], // 방벽 — 해수면 배경 · 영국 환경청 · 왕샤오밍 연구진
  U41: [], // 밤에 깨어나는 도시 — 기후 배경(옛 U36행)뿐이고 밤 노동은 근거 없음: 근거 종류 글자만
  U42: ['U38'], // 바닷물이 드는 길 — 기상청 해수면
  U43: ['N43', 'U30', 'U32'], // 한국 인구가 절반 아래로 — UN·통계청·워싱턴대(7-1절) + 통계청 추계(옛 U30·U32행)
  U44: ['N44'], // 우주 정거장 — NASA · 톈궁
  U45: ['U27'], // 화면 속에 사는 사람 — 의식 이전의 뒤: 같은 행
  U46: [], // 끝 줄 — 칩이 없어 근거 칸도 없다
};

/** 번호 `u`(SPEC-010 본표 번호)의 줄이 쓸 수 있는 문서 표 행 — 위 `DOC_NUMBERS_OF`의 번호가 행의 번호 칸에 나오는 행들 */
export function rowsFor(u: string): QuoteRow[] {
  const ids = DOC_NUMBERS_OF[u] ?? [];
  return DOC_ROWS.filter((r) => r.numbers.some((n) => ids.includes(n)));
}
