/**
 * 첫 화면 통계 슬라이드의 표제어(인사이트형 질문)와 공식 통계명 (SPEC-005 SH1~SH3·SH7, 문구 기준표 docs/design/copy.md 9-1).
 * 값 데이터(`koreaStats.json`, 원문 대조 대상)는 건드리지 않고 이 파일 한 곳에 둔다 — 지표 id → `{ insight, officialName }`.
 *
 *  - `insight`(표제어): 한 줄 질문형 또는 사실 요약형, 해요체, 숫자·달력 연도 없음(값 줄과 공식 통계명 줄이 맡는다 — 갱신 때 표제어가 낡지 않게), 길이 ≤ 24자,
 *    평가어·원인 단정·집단 낙인 없음. 같은 슬라이드의 값과 그래프가 직접 답하는 질문이어야 한다(reviewer 판독).
 *  - `officialName`(공식 통계명): 기관이 쓰는 이름이며 지어내지 않는다 — 해당 지표의 `title`·`source.table`·정의 문구에 실제로 나오는 낱말이다(tests/statHeadlines.test.ts가 확인).
 *    화면에는 `{공식 통계명}({기준})`으로 보이고 `({기준})`은 데이터(`latest.year`, 월 기준 지표는 범위 문구)에서 `core/carousel.ts#officialBasisOf`가 붙인다 — 이 파일에 연도를 적지 않는다(SC4 단일 출처).
 *  - `withScope`: 기준 뒤에 범위 설명(「17개 시·도」)을 괄호 안에 함께 적는다(옛 기준 줄 「2025년 기준(17개 시·도)」을 공식 통계명 줄이 대신한다, copy.md 9-1 #14).
 *
 * 전망 슬라이드(FC, QI4)와 연령별 빈곤율 지표(형진 님 답 M8, QI4 수집)는 아직 없다 — 그때 이 표에 항목을 더한다.
 */

export interface StatHeadline {
  insight: string;
  officialName: string;
  /** 공식 통계명 줄의 기준 괄호 안에 범위 설명(데이터의 `scopeLabel` 괄호 부분)을 덧붙인다 */
  withScope?: true;
}

export const STAT_HEADLINES: Readonly<Record<string, StatHeadline>> = {
  tfr: { insight: '아기는 얼마나 태어나고 있을까?', officialName: '합계출산율' },
  births: { insight: '한 해에 몇 명이 태어날까?', officialName: '출생아 수' },
  // 분모 「인구 1천 명당」은 값 줄 아래 기준 줄에 남는다(copy.md 9-2). 부록 B 「세상을 떠나는」(24자)을 짧게 줄였다
  cdr: { insight: '한 해에 떠나는 사람은 얼마나 될까?', officialName: '조사망률' },
  // 임시: 형진 님 예시 「나이들수록 또래들과 경제력 차이가 극심해져요」는 연령계층별 빈곤율 지표를 수집한 뒤(QI4, 형진 님 답 M8) 그 지표의 표제어로 쓴다.
  // 지금 슬라이드는 66세 이상 한 줄(+ 18~65세 보조 계열)이라 그 문장에 그래프가 직접 답하지 못한다(SH2 ⑤) — 부록 B의 대안 문구를 임시로 쓴다. 마스터 결정 대기(diff-005 D5-15).
  'elderly-poverty': { insight: '노년의 살림살이는 어떨까?', officialName: '66세 이상 상대적 빈곤율' },
  // 임시(판독 대기): copy.md 9-1 #5 후보 ①. reviewer·마스터 판독 뒤 확정 [확인 M9]. 후보 ② 「스스로 삶을 끝내는 사람은 얼마나 될까?」 ③ 「스스로 생을 마감하는 사람은 얼마나 될까?」.
  // 방법·장소·동기를 말하지 않고 완곡어(「극단적 선택」 류)를 쓰지 않는다. 「자살」 낱말은 공식 통계명 줄에만 있다. 상담전화 안내(SC6)는 같은 슬라이드 안에 그대로다.
  'suicide-rate': { insight: '삶을 스스로 마감하는 사람은 얼마나 될까?', officialName: '자살률' },
  'region-population-registered': { insight: '사람들은 어디에 모여 살까?', officialName: '지역별 주민등록 인구수' },
  'life-expectancy': { insight: '얼마나 살 수 있을까?', officialName: '기대수명' },
  'single-household': { insight: '혼자 사는 집은 얼마나 될까?', officialName: '1인 가구 비율' },
  'first-marriage-age': { insight: '결혼은 몇 살쯤에 할까?', officialName: '평균 초혼 연령' },
  'marriage-count': { insight: '한 해에 몇 쌍이 결혼할까?', officialName: '혼인 건수·조혼인율' },
  // 형진 님 예시. 예시의 「취업률」은 공식 용어가 고용률이라 공식 통계명 줄이 바로잡는다(마스터 결정 M8)
  'youth-employment': { insight: '어떻게 먹고 살까?', officialName: '청년(15~29세) 고용률' },
  'private-education': { insight: '학교 밖 공부는 얼마나 흔할까?', officialName: '사교육 참여율' },
  'aging-rate': { insight: '어르신 인구는 얼마나 될까?', officialName: '고령인구(65세 이상) 비율' },
  'tfr-by-sido': { insight: '아이 낳는 데 지역 차이가 있을까?', officialName: '시·도별 합계출산율', withScope: true },
};

/** 표제어 길이 상한(SH2 ② ▲) — 띄어쓰기·물음표 포함 */
export const INSIGHT_MAX_CHARS = 24;
