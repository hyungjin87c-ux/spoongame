import type { UsableIndicator } from './koreaStatsAccess';

/**
 * 폭염일수 전망 어댑터 (SPEC-005 QI4 2단계, diff-005 D5-67): 기존 지표 `heat-projection`은 `kind: 'table'`(권역 6행 × 현재·저탄소·고탄소 3열)이라 전망 지표(`kind: 'projection'`)의 구조화된 필드
 * (`projection.releasedOn`·`baseYear`·시나리오)가 없다. 이 어댑터가 표를 전망 슬라이드(`core/slideForms.ts#buildHeatSlide`)의 입력으로 바꾼다 — 데이터 파일은 그대로다.
 *
 * 값과 낱말은 **전부 표에서 읽는다**: 권역 = `latestLabel`이 시작하는 행(수도권), 막대 라벨 = 열 이름의 낱말(「현재(2000~2019년)」·「저탄소 시나리오 SSP1-2.6」·「고탄소 시나리오 SSP5-8.5」)을 정규식으로,
 * 발표일 = `source.table`의 「(2021-12-23)」(괄호 속 날짜가 **정확히 하나**일 때만), 기준 기간 = 열 이름의 괄호 「(2000~2019년)」. 설계 문서(diff-005 D5-67)는 이 둘을 어댑터 상수로 두자고 했으나
 * `source.table`·열 이름에 같은 글자가 있어 상수 없이 데이터에서 읽는다 — 상수가 데이터와 따로 낡을 일이 없다(글자가 사라지면 어댑터가 null을 돌려주고 슬라이드가 빠져 tests/carousel.test.ts의 「20장」 단언이 실패한다).
 * `latest.year`(2081)는 전망 기간의 **시작 연도**라 어디서도 「기준」으로 쓰지 않는다(REV-005-QI4-1 7절 11, 단일 출처 규칙).
 */

export const HEAT_PROJECTION_ID = 'heat-projection';

export interface HeatBarInput {
  key: 'present' | 'lateLow' | 'lateHigh';
  /** 막대 라벨: 「현재 2000~2019년」「저탄소 SSP1-2.6」「고탄소 SSP5-8.5」 */
  label: string;
  value: number;
  /** 전망 막대(빗금)이면 true — 현재(실선 막대)만 false */
  projection: boolean;
}

export interface HeatRegionRow {
  label: string;
  present: number;
  lateLow: number;
  lateHigh: number;
}

export interface HeatProjectionInput {
  /** 권역 이름(수도권) */
  region: string;
  /** 막대 셋 */
  bars: HeatBarInput[];
  /** 큰 값 둘: 「저탄소 시나리오」 25.0 / 「고탄소 시나리오」 86.4 (일) */
  headlines: Array<{ label: string; value: number }>;
  /** 캡션: 「수도권 연 폭염일수(21세기 후반기 2081~2100년 평균)」 — 데이터 `latestLabel`에서 시나리오 꼬리만 뺀 것 */
  caption: string;
  /** 보조 줄에 쓰는 현재 값과 그 기간 */
  present: { period: string; value: number };
  /** 「저탄소·고탄소」 — 공식 통계명 줄의 시나리오 칸 */
  scenarioWord: string;
  releasedOn: string;
  baseLabel: string;
  /** 권역 6곳 전체(그래프 밖 표) */
  rows: HeatRegionRow[];
  /** 표의 열 이름(그래프 밖 표의 머리글) */
  columns: string[];
}

const COLUMN_KEYS = ['present', 'lateLow', 'lateHigh'] as const;

/** 지표가 폭염일수 표 모양이면 입력, 아니면 null(캐러셀에 그릴 수 없다) */
export function heatProjectionInput(ind: UsableIndicator): HeatProjectionInput | null {
  if (ind.id !== HEAT_PROJECTION_ID || ind.kind !== 'table' || !Array.isArray(ind.columns) || !Array.isArray(ind.rows) || ind.rows.length === 0) return null;
  const col = Object.fromEntries(ind.columns.map((c) => [c.key, c.label]));
  if (!COLUMN_KEYS.every((k) => typeof col[k] === 'string')) return null;
  const rows: HeatRegionRow[] = [];
  for (const r of ind.rows) {
    const row = r as Record<string, unknown>;
    if (typeof row.label !== 'string' || !COLUMN_KEYS.every((k) => typeof row[k] === 'number' && Number.isFinite(row[k]))) return null;
    rows.push({ label: row.label, present: row.present as number, lateLow: row.lateLow as number, lateHigh: row.lateHigh as number });
  }
  const latestLabel = ind.latestLabel;
  if (typeof latestLabel !== 'string') return null;
  const region = rows.find((r) => latestLabel.startsWith(r.label)) ?? rows[0];
  const period = /\((\d{4}~\d{4}년)\)/.exec(col.present);
  const low = /(저탄소|고탄소) 시나리오 (SSP[\d.-]+)/.exec(col.lateLow);
  const high = /(저탄소|고탄소) 시나리오 (SSP[\d.-]+)/.exec(col.lateHigh);
  // 캡션: 데이터 latestLabel 「수도권 연 폭염일수(21세기 후반기 2081~2100년 평균, 고탄소 시나리오 SSP5-8.5)」에서 시나리오 꼬리를 뺀다 — 괄호 하나(R-487)
  const caption = /^(.+?), (?:저탄소|고탄소) 시나리오 SSP[\d.-]+\)$/.exec(latestLabel);
  const dates = [...ind.source.table.matchAll(/\((\d{4}-\d{2}-\d{2})\)/g)].map((m) => m[1]);
  if (period === null || low === null || high === null || caption === null || dates.length !== 1) return null;
  return {
    region: region.label,
    bars: [
      { key: 'present', label: `현재 ${period[1]}`, value: region.present, projection: false },
      { key: 'lateLow', label: `${low[1]} ${low[2]}`, value: region.lateLow, projection: true },
      { key: 'lateHigh', label: `${high[1]} ${high[2]}`, value: region.lateHigh, projection: true },
    ],
    headlines: [
      { label: `${low[1]} 시나리오`, value: region.lateLow },
      { label: `${high[1]} 시나리오`, value: region.lateHigh },
    ],
    caption: `${caption[1]})`,
    present: { period: period[1], value: region.present },
    scenarioWord: `${low[1]}·${high[1]}`,
    releasedOn: dates[0],
    baseLabel: period[1],
    rows,
    columns: ind.columns.map((c) => c.label),
  };
}
