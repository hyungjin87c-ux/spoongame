import { commaList } from '../core/glue';
import { josa } from '../core/slideKit';

/**
 * 전망·격차·폭염·아기 슬라이드의 문구 틀 (SPEC-005 QI4 2단계, 문구 기준표 docs/design/copy.md 14절 · diff-005 12절 D5-62~D5-70).
 * 화면 글자는 한 곳(여기)에서만 만든다 — 표제어·공식 통계명은 `statHeadlines.ts`, 값·연도·구간 이름·시나리오 이름은 **전부 데이터에서** 틀의 칸에 채운다(손으로 적은 수치 0).
 * 틀에 직접 든 숫자 토막은 나이 구간 이름(「0~14세」「15~64세」「65세 이상」)과 총부양비의 정의 상수(「100명당」)뿐이고, 둘 다 해당 지표의 정의 글이 말하는 구간·정의다
 * (R-486 — tests/slideForms.test.ts가 틀의 숫자 토막이 같은 지표의 `definition`·`title`·값에 있는지 확인한다).
 *
 * 어체: 값을 늘어놓는 줄은 명사구, 사실을 진술하는 줄은 합쇼체(슬라이드 본문 어체). 표제어만 해요체(copy.md 14-6).
 */

export const SLIDE_TEXT = {
  /** 「전망」 칩 글자 (FC2 — 색 + 글자 + 아이콘, copy.md 14-3). 「추계」「예상」은 쓰지 않는다 */
  projChip: '전망',
  /** 한 줄 안내 (FC2, copy.md 14-5) — 전망 5장 모두 같은 글자 */
  projNote: '전망은 예측이 아니라 공식 추계입니다. 가정이 달라지면 값도 달라집니다.',

  // ---------- 전망 선 그래프 (총인구 · 65세 이상 구성비 · 1인 가구) ----------
  /** 공식 통계명 줄: 「장래인구추계 총인구(2023년 발표, 2022년 기준, 중위 추계)」 — 시나리오 칸은 시나리오가 둘 이상일 때만(마스터 결정 2) */
  officialProjection: (name: string, releasedYear: number | string, baseLabel: string, scenario: string | null): string =>
    `${name}(${releasedYear}년 발표, ${baseLabel} 기준${scenario === null ? '' : `, ${scenario}`})`,
  /** 보조 줄 머리: 「2072년」 + 고위·저위 끝값 */
  endYear: (year: number): string => `${year}년`,
  /** 보조 줄의 한 항목: 「고위 추계(최대인구) 42,818,632명」 */
  scenarioValue: (scenarioWithMeaning: string, valueWithUnit: string): string => `${scenarioWithMeaning} ${valueWithUnit}`,
  /** 시나리오가 하나뿐일 때 보조 줄(출발값·경계값): 「추계 앞 구간 2000년 15.5%, 2021년 32.9%」 */
  edgeValues: (actualWord: string, firstYear: number, firstValue: string, throughYear: number, throughValue: string): string =>
    `${actualWord} ${firstYear}년 ${firstValue}, ${throughYear}년 ${throughValue}`,
  /** 보조 값 줄: 「65세 이상 인구는 2072년 17,270,735명(중위 추계)」 */
  relatedValue: (label: string, year: number, valueWithUnit: string, scenarioLabel: string): string => `${josa.topic(label)} ${year}년 ${valueWithUnit}(${scenarioLabel})`,
  /** 범례: 「확정 1960~2022」 / 「추계 앞 구간 2000~2021」 */
  legendActual: (actualWord: string, firstYear: number, throughYear: number): string => `${actualWord} ${firstYear}~${throughYear}`,
  /** 범례: 「전망 2023~2072(중위)」 — 시나리오가 하나면 괄호 없음 */
  legendProjection: (fromYear: number, horizonYear: number, scenario: string | null): string => `전망 ${fromYear}~${horizonYear}${scenario === null ? '' : `(${scenario})`}`,
  /** 범례(띠 견본): 「고위(최대인구)~저위(최소인구) 추계 범위」 — 괄호 낱말이 데이터에 없으면 괄호 없음 */
  legendBand: (highWord: string, highMeaning: string | null, lowWord: string, lowMeaning: string | null): string =>
    `${highWord}${highMeaning === null ? '' : `(${highMeaning})`}~${lowWord}${lowMeaning === null ? '' : `(${lowMeaning})`} 추계 범위`,
  /** 그래프 읽기 이름 (D5-65): 「1960년부터 2072년까지 장래인구추계 총인구 그래프. 1960~2022년은 확정인구(실선), 2023~2072년은 전망(점선, 고위~저위 범위는 띠). 1960년 …」 */
  projectionLineLabel: (o: {
    name: string;
    firstYear: number;
    throughYear: number;
    horizonYear: number;
    actualPhrase: string;
    hasBand: boolean;
    firstValue: string;
    throughValue: string;
    horizonValue: string;
    midWord: string | null;
    range: string | null;
  }): string =>
    `${o.firstYear}년부터 ${o.horizonYear}년까지 ${o.name} 그래프. ${o.firstYear}~${o.throughYear}년은 ${o.actualPhrase}, ${o.throughYear + 1}~${o.horizonYear}년은 전망(점선${o.hasBand ? ', 고위~저위 범위는 띠' : ''}). ` +
    `${o.firstYear}년 ${o.firstValue}, ${o.throughYear}년 ${o.throughValue}, ${o.horizonYear}년 ${o.midWord === null ? '' : `${o.midWord} `}${o.horizonValue}${o.range === null ? '' : `(${o.range})`}`,
  /** 읽기 이름의 앞 구간 설명 */
  actualPhrase: (actualWord: string): string => (actualWord === '확정' ? '확정인구(실선)' : '같은 표의 추계 앞 구간(실선)'),
  /** 읽기 이름의 고위·저위 값 괄호: 「고위 최대인구 추계 42,818,632명, 저위 최소인구 추계 30,172,383명」 */
  rangeRead: (highMeaning: string | null, highValue: string, lowMeaning: string | null, lowValue: string): string =>
    `고위 ${highMeaning === null ? '' : `${highMeaning} 추계 `}${highValue}, 저위 ${lowMeaning === null ? '' : `${lowMeaning} 추계 `}${lowValue}`,

  // ---------- 폭염일수 막대 ----------
  /** 보조 줄: 「현재(2000~2019년)는 7.8일」 */
  heatPresent: (period: string, valueWithUnit: string): string => `현재(${period})는 ${valueWithUnit}`,
  heatLegendNow: '현재',
  heatLegendProj: '전망(빗금)',
  /** 막대 범례의 이름 */
  barLegendLabel: '막대 범례',
  /** 읽기 이름: 「수도권 연 폭염일수 막대 그래프. 현재 2000~2019년 7.8일, …(빗금은 전망). 권역 6곳의 값은 아래 표」 */
  heatChartLabel: (region: string, barsText: string, regionCount: number): string => `${region} 연 폭염일수 막대 그래프. ${barsText}(빗금은 전망). 권역 ${regionCount}곳의 값은 아래 표`,
  /** 그래프 밖 표 캡션: 「{지표 이름} — 권역별」 */
  heatTableCaption: (title: string): string => `${title} — 권역별`,

  // ---------- 지금 태어나는 아기라면? (누적 막대) ----------
  /** 그래프 위 오른쪽 글자: 「모두 전망(중위 추계)」 */
  newbornHeader: (scenario: string): string => `모두 전망(${scenario})`,
  /** 범례: 연령 3구간 — 65세 이상 칸은 점무늬(놋쇠 빗금은 「전망」 전용, R-477) */
  newbornLegend: { young: '0~14세', work: '15~64세', old: '65세 이상(점무늬)' },
  /** 보조 줄: 「15~64세 100명당 0~14세와 65세 이상 인구(총부양비): 2026년 45.4명, 2056년 97.9명」 */
  newbornDependency: (firstYear: number, firstValue: string, latestYear: number, latestValue: string): string =>
    `15~64세 100명당 0~14세와 65세 이상 인구(총부양비): ${firstYear}년 ${firstValue}명, ${latestYear}년 ${latestValue}명`,
  /**
   * 읽기 이름: 「2026년에 태어난 아기가 0세, 10세, 20세, 30세, 40세가 되는 해의 연령 3구간 인구 구성비 누적 막대 그래프(중위 추계). 2026년(0세) …」 — 시안(copy.md 15-2)은 「0·10·20·30·40세」인데
   * 데이터로 채우는 나열에 가운뎃점을 쓰지 않는 규칙(QM2-10, tests/glue.test.ts)에 따라 쉼표 나열로 썼다(보조기기가 읽는 이름이라 화면 글자는 그대로다).
   */
  newbornChartLabel: (birthYear: number, ages: readonly number[], scenario: string, rowsText: string): string =>
    `${birthYear}년에 태어난 아기가 ${commaList(ages.map((a) => `${a}세`))}가 되는 해의 연령 3구간 인구 구성비 누적 막대 그래프(${scenario}). ${rowsText}`,
  /** 읽기 이름의 한 행: 「2026년(0세) 0~14세 9.7%, 15~64세 68.8%, 65세 이상 21.6%, 총부양비 45.4」 */
  newbornRowRead: (year: number, age: number, young: string, work: string, old: string, dependency: string): string =>
    `${year}년(${age}세) 0~14세 ${young}, 15~64세 ${work}, 65세 이상 ${old}, 총부양비 ${dependency}`,
  /** 그래프 밖 표 캡션과 머리글 */
  newbornTableCaption: (title: string, scenario: string): string => `${title} — 연령 3구간 구성비와 부양비(${scenario})`,
  newbornTableHead: ['나이(연도)', '0~14세', '15~64세', '65세 이상', '총부양비'] as readonly string[],

  // ---------- 연령별 격차 (마지막 해 두 구간 막대 + 보조 줄 둘) ----------
  /** 보조 줄 ① (R-476 b): 「2011~2024년 모든 해에 66세 이상의 격차가 18~65세보다 큽니다.」 — 판정은 `gapEveryYear`가 데이터에서 계산한다 */
  gapAllYears: (firstYear: number, lastYear: number, main: string, extra: string): string => `${firstYear}~${lastYear}년 모든 해에 ${main}의 격차가 ${extra}보다 큽니다.`,
  /** 보조 줄 ② (R-476 a): 「같은 나이대 안의 소득 격차는 18~65세와 66세 이상 두 구간으로 공표됩니다. 더 잘게 나눈 나이 구간의 값은 없습니다.」 */
  gapBands: (lower: string, upper: string): string => `같은 나이대 안의 소득 격차는 ${josa.and(lower)} ${upper} 두 구간으로 공표됩니다. 더 잘게 나눈 나이 구간의 값은 없습니다.`,
  /** 읽기 이름: 「2024년 연령계층별 소득 5분위배율 막대 그래프. 66세 이상(은퇴연령인구) 6.90배, 18~65세(근로연령인구) 5.01배. 2011~2024년 값은 아래 표」 */
  gapChartLabel: (year: number, title: string, mainLabel: string, mainValue: string, extraLabel: string, extraValue: string, firstYear: number, lastYear: number): string =>
    `${year}년 ${title} 막대 그래프. ${mainLabel} ${mainValue}, ${extraLabel} ${extraValue}. ${firstYear}~${lastYear}년 값은 아래 표`,
  /** 그래프 밖 표 캡션: 「{지표 이름} — 2011~2024년」 */
  gapTableCaption: (title: string, firstYear: number, lastYear: number): string => `${title} — ${firstYear}~${lastYear}년`,
  gapTableYearHead: '연도',
  /** 그래프 위 오른쪽 글자: 「2024년」 */
  gapHeader: (year: number): string => `${year}년`,
} as const;
