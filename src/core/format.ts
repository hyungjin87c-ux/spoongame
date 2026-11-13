/** 화면에 쓰는 숫자 표기 (순수 함수, 로캘에 기대지 않는다). 통계 값의 공식 표기(자릿수·단위)는 data/koreaStatsAccess.ts의 formatNumber·formatWithUnit이 맡는다. */

/** 천 단위 쉼표: 51284 → "51,284" (반올림한 정수로) */
export function formatCount(n: number): string {
  const sign = n < 0 ? '-' : '';
  return sign + String(Math.abs(Math.round(n))).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/**
 * 원 단위 금액을 만·억 단위로 읽기 쉽게 적는다 (SPEC-003 DB11, 자산 현황의 순자산·연 소득·부채). 입력은 **원**이다.
 *  - 1만 원 미만은 그대로 「9,999원」, 0은 「0원」.
 *  - 1만 원 이상은 **만 원 단위로 반올림**하고(만 원 아래 자리는 읽기 쉽게 버린다) 「1,200만 원」「1억 2,000만 원」「1억 원」「1조 2,000억 원」처럼 큰 단위부터 쓴다. 반올림이 올림을 만들어
 *    단위 경계를 넘으면(9,999만 5,000원 → 1억 원) 단위를 올려 적는다.
 *  - 음수는 맨 앞에 수학 빼기 부호 「−」(U+2212)를 붙인다. 0으로 반올림되는 음수는 없다(1만 원 미만은 반올림하지 않는다).
 * 숫자와 단위 사이는 한 칸 띄어 쓰고(「만 원」), 화면은 이 글자 전체를 줄바꿈 없는 한 덩어리(.nowrap)로 그린다 — core/glue.ts는 「1,200만 원」을 묶지 않는다(디자인 M4 메모).
 */
export function formatWon(won: number): string {
  if (!Number.isFinite(won)) throw new RangeError(`formatWon: 유한한 수가 아니다 (${won})`);
  const sign = won < 0 ? '−' : '';
  const abs = Math.abs(won);
  if (abs < 10_000) return `${sign}${formatCount(abs)}원`;
  const totalMan = Math.round(abs / 10_000); // 만 원 단위로 반올림
  const jo = Math.floor(totalMan / 100_000_000);
  const eok = Math.floor((totalMan % 100_000_000) / 10_000);
  const man = totalMan % 10_000;
  const parts: string[] = [];
  if (jo > 0) parts.push(`${formatCount(jo)}조`);
  if (eok > 0) parts.push(`${formatCount(eok)}억`);
  if (man > 0) parts.push(`${formatCount(man)}만`);
  return `${sign}${parts.join(' ')} 원`;
}

/**
 * 만 원 단위 정수(경제 모델의 모든 금액, `Assets.net·income·debt`)를 화면 금액으로 적는다: `formatWon(만 원 × 10,000)` 출력 그대로(「약」 없음, 음수는 U+2212, 0은 「0원」).
 * 자산 현황 카드·엔딩 「최종 순자산」 줄이 같은 함수를 쓴다 — 순자산이 음수여도 「빚」으로 바꿔 쓰지 않는다(docs/design/copy.md 4-5절).
 */
export function formatMan(man: number): string {
  return formatWon(man * 10_000);
}

/**
 * 사람의 나이를 화면 숫자로 바꾸는 **단 하나의 정의** (SPEC-019 r2). 입력은 게임 나이(태어난 해 0 — `GameState.age`·가족 나이·별세 나이 모두)이고,
 * 화면은 늘 **한국 나이**(+1, 태어난 해 1세)다. 화면 코드는 사람 나이에 「세」를 직접 붙이지 않고 아래 함수를 거친다(tests/ageViewLint.test.ts).
 * 유일한 예외는 인생 화면 헤더 알약 옆의 작은 「만 N세」(`manAgeText`, 게임 나이 그대로). 통계의 나이(연령 구간·기대수명·인구 구성)는 만 나이 기준이라 이 함수를 거치지 않는다.
 */
export function displayAge(age: number): number {
  return age + 1;
}

/** 「24세」 — 한국 나이 (목록·카드·문장·헤더 알약) */
export function ageText(age: number): string {
  return `${displayAge(age)}세`;
}

/** 헤더 알약 옆의 작은 글자 「만 23세」 — 게임 나이 그대로(만 나이). 이 한 곳 말고는 「만」 표기가 없다 */
export function manAgeText(age: number): string {
  return `만 ${age}세`;
}

/** 나이 구간: 「8~20세」, `to`가 null이면 「66세~」 */
export function ageRangeText(from: number, to: number | null): string {
  return to === null ? `${displayAge(from)}세~` : `${displayAge(from)}~${displayAge(to)}세`;
}
