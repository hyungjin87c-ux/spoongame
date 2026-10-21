/**
 * 첫 화면 통계 슬라이드의 표제어(인사이트형 질문)와 공식 통계명 (SPEC-005 SH1~SH3·SH7, 문구 기준표 docs/design/copy.md 9-1 · QI4 14-1).
 * 값 데이터(`koreaStats.json`, 원문 대조 대상)는 건드리지 않고 이 파일 한 곳에 둔다 — 지표 id → `{ insight, officialName }`.
 *
 *  - `insight`(표제어): 한 줄 질문형 또는 사실 요약형, 해요체, 숫자·달력 연도 없음(값 줄과 공식 통계명 줄이 맡는다 — 갱신 때 표제어가 낡지 않게), 길이 ≤ 24자,
 *    평가어·원인 단정·집단 낙인 없음. 같은 슬라이드의 값과 그래프가 직접 답하는 질문이어야 한다(reviewer 판독).
 *  - `officialName`(공식 통계명): 기관이 쓰는 이름이며 지어내지 않는다 — 해당 지표의 `title`·`source.table`·정의 문구에 실제로 나오는 **낱말**이다(tests/statHeadlines.test.ts가 낱말마다 확인, R-478 b).
 *    화면에는 `{공식 통계명}({기준})`으로 보이고 `({기준})`은 데이터(`latest.year`, 월 기준 지표는 범위 문구)에서 `core/carousel.ts#officialBasisOf`가 붙인다 — 이 파일에 연도를 적지 않는다(SC4 단일 출처).
 *    전망 슬라이드는 `({발표 연도}년 발표, {기준 연도}년 기준[, 시나리오])`를 `projection.releasedOn`·`baseYear`·시나리오 라벨에서 붙인다(`core/slideForms.ts`, 단일 출처 규칙 — diff-005 12절).
 *  - `withScope`: 기준 뒤에 범위 설명(「17개 시·도」「16개 시·도」)을 괄호 안에 함께 적는다 — 데이터 범위 문구 괄호의 **첫 항목만**(옛 기준 줄 「2025년 기준(17개 시·도)」을 공식 통계명 줄이 대신한다, copy.md 9-1 #6·#14, 9-11).
 *
 * 선택 필드(SPEC-005 QI4 2단계, 마스터 결정 9·R-486): **필드에는 측정 키와 화면 낱말만 두고 숫자를 두지 않는다**(값은 항상 데이터에서). 예외는 같은 지표 `definition`에 이미 있는 정의 상수뿐이다
 * (격차 캡션의 「20%」 — 소득 5분위배율의 정의, tests/statHeadlines.test.ts가 캡션의 숫자 토막이 정의에 있는지 확인한다).
 *  - `caption`: 값 줄 위 설명 글(데이터 `latestLabel`이 없을 때)
 *  - `pairExtra`: 본 계열과 첫 보조 계열의 **마지막 값**을 값 둘(「66세 이상」「18~65세」)로 보이고 그래프를 마지막 해 두 구간 막대로 그린다(격차 슬라이드, R-476)
 *  - `actualWord`: 전망 선 그래프에서 전망 앞 구간을 부르는 말. 원문 주석이 「확정」이라고 말하는 지표(장래인구추계)만 「확정」이고, 근거가 없는 곳(장래가구추계)은 「추계 앞 구간」이다(마스터 결정 3, R-480 — 「실측」은 쓰지 않는다)
 *
 * 「지금 태어나는 아기라면?」(#20)은 형진 님 문장(M8 답)이라 표제어 종결 규칙(`까?`·`요`)의 예외 목록 `HYUNGJIN_ENDING_EXCEPTIONS`에 있다(REV-005-QI4-1 R-478 마스터 승인).
 * 「나이들수록 또래들과 경제력 차이가 극심해져요」(#5)도 형진 님 문장 그대로다(마스터 결정 6 — 형진 님의 명시 결정이 SH2 ④보다 앞선다).
 */

export interface StatHeadline {
  insight: string;
  officialName: string;
  /** 공식 통계명 줄의 기준 괄호 안에 범위 설명(데이터의 `scopeLabel` 괄호 부분)을 덧붙인다 */
  withScope?: true;
  /** 값 줄 위 설명 글 — 숫자는 같은 지표 `definition`에 있는 정의 상수만(R-486) */
  caption?: string;
  /** 본 계열·첫 보조 계열의 마지막 값을 값 둘로, 그래프를 마지막 해 두 구간 막대로(R-476) */
  pairExtra?: true;
  /** 전망 선 그래프의 전망 앞 구간 이름(「확정」은 원문 주석이 확정이라고 말할 때만) */
  actualWord?: '확정' | '추계 앞 구간';
}

export const STAT_HEADLINES: Readonly<Record<string, StatHeadline>> = {
  // R-446 (c) 확정(designer 판단, copy.md 9-11, 마스터 승인): 합계출산율의 뜻(여성 한 명이 낳을 것으로 예상되는 아이 수)을 그대로 묻는다 — 값 「0.80명」이 바로 답한다
  tfr: { insight: '한 여성이 평생 낳을 아이는 몇 명일까?', officialName: '합계출산율' },
  births: { insight: '한 해에 몇 명이 태어날까?', officialName: '출생아 수' },
  // 분모 「인구 1천 명당」은 값 줄 아래 기준 줄에 남는다(copy.md 9-2). 부록 B 문구 그대로(R-446 a, 마스터 결정 — 「떠나는」만으로는 이민·이사로 읽힌다)
  cdr: { insight: '한 해에 세상을 떠나는 사람은 얼마나 될까?', officialName: '조사망률' },
  // 확정(마스터 결정 1, copy.md 14-1 #4): 형진 님 예시 문장은 연령계층별 격차 지표 `income-gap-by-age`의 표제어로 옮겼다(바로 아래). 이 슬라이드는 66세 이상 한 줄(+ 18~65세 보조 계열)이다
  'elderly-poverty': { insight: '노년의 살림살이는 어떨까?', officialName: '66세 이상 상대적 빈곤율' },
  // 형진 님 문장 그대로(M8 답 · 마스터 결정 6, copy.md 14-1 #5). 값(66세 이상 6.90배 · 18~65세 5.01배)과 보조 줄(모든 해에 66세 이상이 더 크다 · 두 구간으로만 공표된다)이 문장을 뒷받침하는 만큼만 말한다 —
  // 「나이들수록」의 점진성은 구간이 둘뿐이라 보이지 못하고 그 한계를 보조 줄이 밝힌다(R-476). 캡션의 「20%」는 같은 지표 정의문의 정의 상수다(R-486).
  'income-gap-by-age': {
    insight: '나이들수록 또래들과 경제력 차이가 극심해져요',
    officialName: '연령계층별 소득 5분위배율',
    caption: '같은 나이대 안에서 소득 상위 20%가 하위 20%의 몇 배인지(균등화 처분가능소득)',
    pairExtra: true,
  },
  // 확정(M9, REV-005-QI3-1 판독 통과·마스터 승인): copy.md 9-1 #5. 버린 후보 ② 「스스로 삶을 끝내는 사람은 얼마나 될까?」 ③ 「스스로 생을 마감하는 사람은 얼마나 될까?」.
  // 방법·장소·동기를 말하지 않고 완곡어(「극단적 선택」 류)를 쓰지 않는다. 「자살」 낱말은 공식 통계명 줄에만 있다. 상담전화 안내(SC6)는 같은 슬라이드 안에 그대로다.
  'suicide-rate': { insight: '삶을 스스로 마감하는 사람은 얼마나 될까?', officialName: '자살률' },
  // R-446 (b): 괄호에 범위 「16개 시·도」를 함께 적는다(#14의 「17개 시·도」와 왜 다른지가 설명 없이 보이지 않게, R-147 d). 「주민등록」은 이름에 이미 있어 범위 문구 괄호의 첫 항목만 쓴다
  'region-population-registered': { insight: '사람들은 어디에 모여 살까?', officialName: '지역별 주민등록 인구수', withScope: true },
  'life-expectancy': { insight: '얼마나 살 수 있을까?', officialName: '기대수명' },
  'single-household': { insight: '혼자 사는 집은 얼마나 될까?', officialName: '1인 가구 비율' },
  'first-marriage-age': { insight: '결혼은 몇 살쯤에 할까?', officialName: '평균 초혼 연령' },
  'marriage-count': { insight: '한 해에 몇 쌍이 결혼할까?', officialName: '혼인 건수·조혼인율' },
  // 형진 님 예시. 예시의 「취업률」은 공식 용어가 고용률이라 공식 통계명 줄이 바로잡는다(마스터 결정 M8)
  'youth-employment': { insight: '어떻게 먹고 살까?', officialName: '청년(15~29세) 고용률' },
  'private-education': { insight: '학교 밖 공부는 얼마나 흔할까?', officialName: '사교육 참여율' },
  'aging-rate': { insight: '어르신 인구는 얼마나 될까?', officialName: '고령인구(65세 이상) 비율' },
  'tfr-by-sido': { insight: '아이 낳는 데 지역 차이가 있을까?', officialName: '시·도별 합계출산율', withScope: true },

  // ---- 공식 전망 슬라이드 5장 (QI4 2단계, copy.md 14-1 #16~#20) — 네 장은 「앞으로 …」로 시작해 칩·색 없이 글자만으로도 전망임이 읽힌다(FC2). 연도·값은 데이터에서 ----
  // 「어떻게」는 곡선의 모양(줄어드는 꼴)이, 「얼마나」는 값이 답한다(SH2 ⑤). 그래프 앞 구간은 원문 KOSIS 주석이 「확정인구」라 부르는 구간이다
  'projection-population-total': { insight: '앞으로 인구는 어떻게 달라질까?', officialName: '장래인구추계 총인구', actualWord: '확정' },
  // 값이 **비중**이라 「인구 가운데」로 수가 아니라 몫을 묻는다. 현재 슬라이드 「어르신 인구는 얼마나 될까?」(인구주택총조사)와 짝이고 공식 통계명이 달라 다른 통계임이 보인다
  'projection-aging-share': { insight: '앞으로 인구 가운데 어르신은 얼마나 될까?', officialName: '장래인구추계 65세 이상 인구 구성비', actualWord: '확정' },
  // 시나리오 칸 없음(마스터 결정 2 — 원문에 시나리오 이름이 없다), 앞 구간은 원문에 「실측」 근거가 없어 「추계 앞 구간」(마스터 결정 3)
  'projection-one-person-households': { insight: '앞으로 혼자 사는 집은 얼마나 늘까?', officialName: '장래가구추계 1인 가구 비율', actualWord: '추계 앞 구간' },
  // 기존 지표 `heat-projection`(표)을 어댑터(`data/heatProjectionAdapter.ts`)가 전망 슬라이드로 바꾼다 — 「한 해에 … 며칠」이 값 「일/년」과 맞물린다(「며칠」은 의문사)
  'heat-projection': { insight: '앞으로 폭염은 한 해에 며칠이나 될까?', officialName: '남한상세 기후변화 전망 폭염일수' },
  // 형진 님 문장(M8 답) — 표제어만으로는 무엇을 묻는지 약해 캡션(데이터 `latestLabel`)이 「30세가 되는 해의 65세 이상 비율」로 받고 누적 막대가 「아기가 자라는 동안의 인구」를 보인다(SH2 ⑤ 조건부 예)
  'projection-newborn-age-structure': { insight: '지금 태어나는 아기라면?', officialName: '장래인구추계 인구 구조·부양비' },
};

/** 표제어 길이 상한(SH2 ② ▲) — 띄어쓰기·물음표 포함 */
export const INSIGHT_MAX_CHARS = 24;

/**
 * 표제어 종결 규칙(`까?`·`요`)의 **형진 님 문장 예외 목록** (REV-005-QI4-1 R-478 a — 마스터 승인). 지금은 「지금 태어나는 아기라면?」 하나이고, 목록 밖의 「~라면?」은 그대로 규칙에 걸린다.
 * 예외를 늘리려면 형진 님 문장인지 마스터가 먼저 확인한다.
 */
export const HYUNGJIN_ENDING_EXCEPTIONS: readonly string[] = ['지금 태어나는 아기라면?'];
