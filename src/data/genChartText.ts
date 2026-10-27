/**
 * 첫 화면 캐러셀 첫 장 「세대 그래프」의 문구 (SPEC-004 GS11, docs/design/copy.md 16-12·16-13, design-system.md 17-12-3·17-13, diff-004.md D4-61·D4-71·D4-72).
 * 어체는 해요체 하나. 숫자·연도·기관 이름은 모두 데이터에서 채운다(`{…}` 자리) — 글자 틀만 여기 있다. 세대 사이의 우열·순위를 말하는 문구는 없다(GD6).
 */
export const GEN_CHART_TEXT = {
  /** 표제어 h3 (다른 장과 같은 물음 꼴 — copy.md 16-13) */
  insight: '고른 세대는 한 해에 몇 명이 태어났을까?',
  /** 공식 통계명(슬라이드 읽기 이름의 뒷부분) — 「{from}~{to}」는 데이터의 출생아 수 표 범위 */
  official: (from: number, to: number) => `출생아 수(${from}~${to}년)`,
  /** 「랜덤 세대」 줄을 골랐을 때 세대 줄 이름 */
  anyGen: '어느 세대든',
  /** 자료 없는 구간(플롯 안 글자) */
  none: '연간 통계 없음',
  bigLabel: '한 해 평균',
  unit: '명',
  since: (year: number) => `${year}년부터 자료가 있어요`,
  noData: '자료 없음',
  kAge: '올해 나이',
  kLife: '태어난 해의 기대수명',
  tableSummary: '표로 보기',
  tableCaption: (who: string) => `${who} 구간의 해마다 출생아 수`,
  thYear: '연도',
  thBirths: '출생아 수',
  /** 가리킴 글자 「1988년 · 63만 명」 */
  hover: (year: number, man: string) => `${year}년 · ${man} 명`,
  /** 읽기 이름(svg `aria-label`) */
  labelAll: (o: { span: string; avg: string; peakY: number; peakV: string; lastY: number; lastV: string; firstData: number; to: number; from: number }) =>
    `${o.from}년부터 ${o.to}년까지 한 해에 태어난 아기 수 그래프. 공식 연간 통계는 ${o.firstData}년부터 있어요. ${o.span}은 한 해 평균 ${o.avg} 명, 가장 많은 해는 ${o.peakY}년 ${o.peakV} 명, ${o.lastY}년은 ${o.lastV} 명이에요.`,
  labelGen: (o: { all: { from: number; to: number }; name: string; from: number; to: number; body: string }) => `${o.all.from}년부터 ${o.all.to}년까지 한 해에 태어난 아기 수 그래프. ${o.name} ${o.from}~${o.to}년생 구간을 강조했어요. ${o.body}`,
  labelGenData: (o: { avg: string; peakY: number; peakV: string }) => `그 구간은 한 해 평균 ${o.avg} 명, 가장 많은 해는 ${o.peakY}년 ${o.peakV} 명이에요.`,
  labelGenNone: '그 구간은 공식 연간 출생 통계가 없어요.',
  /** 출처 한 줄 — 기관과 조회일은 데이터에서 */
  source: (o: { org: string; birthsFrom: number; birthsTo: number; lifeFrom: number; lifeTo: number; accessedOn: string; firstData: number }) => ({
    lead: `출처: ${o.org} 인구동향조사 출생아 수(${o.birthsFrom}~${o.birthsTo}년)와 생명표 기대수명(${o.lifeFrom}~${o.lifeTo}년), ${o.accessedOn} 조회.`,
    tail: `${o.firstData - 1}년까지는 공식 연간 출생 통계가 없어 비워 두었어요.`,
  }),
} as const;
