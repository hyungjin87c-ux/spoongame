import citationsJson from './citations.json';
import type { Era } from '../core/types';

/**
 * 인용 접근자 — `src/data/citations.json`을 게임 코드가 읽는 **유일한 통로**다 (SPEC-003 MD2, EV6, M7b).
 * 화면·core는 JSON을 직접 import하지 말고 이 파일의 `CITATION_TABLE`·`getCitation`만 쓴다.
 * 돌려주는 값은 읽기 전용으로 다룬다. `verified`·`usable`이 아닌 인용은 `getCitation`이 돌려주지 않는다(MD3 — 확인하지 못한 인용이 화면에 새지 않게).
 *
 * 필드 중 `validFromYear`·`validUntilYear`·`eraPrefix.future`·`source.authors`는 **스키마에 추가될 예정인 선택 필드**다(M7b 2단계 — R-182, 디자인 D-53).
 * 데이터에 아직 없어도 코드는 안전한 기본값으로 동작한다(`core/citations.ts`가 읽는 곳에서 기본값을 정의한다).
 */

export type CitationKind = 'stat' | 'research';

export interface CitationSource {
  /** 통계는 기관, 연구는 저자 목록 글자(「성, 머리글자, …, & 성, 머리글자」) 또는 기관 */
  org: string;
  /** 자료 이름(원제 — 번역·줄임 없이 화면에 그대로) */
  title: string;
  year: number;
  /** 'accessed' = 누리집 열람 연도(갱신 연도가 페이지에 없다) → 출처 줄에 「N년 열람」 */
  yearKind?: 'accessed';
  /** (예정) 저자 성 배열 — 있으면 `org`를 파싱하지 않고 이것을 읽는다 */
  authors?: string[];
  /** 화면에 그리지 않는 서지(EV6 — 링크·DOI·URL·PMID 노출 0) */
  venue?: string;
  doi?: string;
  pmid?: string;
  url?: string;
}

export interface CitationRef {
  indicator: string;
  year: number;
  value: number;
  extraSeriesIndex?: number;
}

export interface CitationRecord {
  id: string;
  kind: CitationKind;
  /** 요약 문장(합쇼체, ≤ 100자 — 시대 머리말을 붙인 표시 문자열이 100자 이하) */
  text: string;
  source: CitationSource;
  basisId: string;
  /** 이 인용을 쓸 수 있는 세상 */
  eras: Era[];
  /** 세상별 머리말(지난 세상의 시대 무관 연구 「지금의 연구로는」, 다가올 세상 「지금 기준으로는」) */
  eraPrefix?: Partial<Record<Era, string>>;
  refs?: CitationRef[];
  /** (예정) 게임 속 연도가 이 해보다 이르면 보이지 않는다. 기본: 통계는 `refs` 연도의 최댓값, 연구는 없음 */
  validFromYear?: number;
  /** (예정) 게임 속 연도가 이 해보다 늦으면 보이지 않는다(전망 인용). 기본: 없음 */
  validUntilYear?: number;
  usageCaution?: { forbiddenCardTypes?: string[]; forbiddenEvents?: string[]; framing?: string[]; note?: string };
  usedBy?: string[];
  verified: boolean;
  usable: boolean;
}

/** JSON의 인용 전체(읽기 전용). 쓸 수 있는지(verified·usable)는 `getCitation`이 가른다 */
export const CITATION_TABLE: readonly CitationRecord[] = (citationsJson as unknown as { citations: CitationRecord[] }).citations;

const BY_ID: ReadonlyMap<string, CitationRecord> = new Map(CITATION_TABLE.map((c) => [c.id, c]));

/** id로 인용 하나 — `verified`이고 `usable`인 것만(아니면 undefined) */
export function getCitation(id: string, table: readonly CitationRecord[] = CITATION_TABLE): CitationRecord | undefined {
  const c = table === CITATION_TABLE ? BY_ID.get(id) : table.find((x) => x.id === id);
  return c !== undefined && c.verified === true && c.usable === true ? c : undefined;
}
