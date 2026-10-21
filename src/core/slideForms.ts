import { formatBasisLine, formatNumber, type ProjectionScenario, type UsableIndicator, type YearPoint } from '../data/koreaStatsAccess';
import { heatProjectionInput } from '../data/heatProjectionAdapter';
import { SLIDE_TEXT } from '../data/slideText';
import { STAT_HEADLINES } from '../data/statHeadlines';
import type {
  BarsChartModel,
  BarsRowModel,
  CarouselSlide,
  ChartLabel,
  ChartSize,
  LinePoint,
  LineChartModel,
  LineSeriesModel,
  SlideLegendItem,
  SlideProjection,
  SlideSideValue,
  SlideTable,
  StackChartModel,
  StackRowModel,
} from './carousel';
import { LABEL_GAP, LEGEND_LABEL_LINE, PAD, bareName, round1, segmentHitsRect, sourceTextOf, spreadY, valueWidthEm, yearPoints, type Rect } from './slideKit';

/**
 * 슬라이드 형식별 모델 — 공식 전망 5장(총인구·65세 이상 구성비·1인 가구 = 전망 선 그래프, 폭염 = 막대 셋, 지금 태어나는 아기 = 누적 막대)과 연령별 격차(마지막 해 두 구간 막대)
 * (SPEC-005 QI4 2단계, 설계 diff-005 12절 D5-60~D5-75 · 문구 copy.md 14절 · 규격 design-system.md 15절). 순수 함수 — 값·연도·구간 이름·시나리오 이름은 전부 데이터에서 계산한다(손으로 적은 수치 0).
 * 시안 생성기(scripts/design/buildQi4Slides.mjs)가 같은 규칙으로 그린 모양이 기준이다: 좌표계는 화면에 그려지는 폭(`size.width`)을 그대로 쓰고(R-206), 위치 규칙(경계 x = 확정 마지막 해,
 * 끝 글자 x = 마지막 점 + 8, 벌림 13)은 그대로다.
 *
 * 한 슬라이드의 연도는 자리마다 출처가 하나다(R-478 d 단일 출처 규칙): 공식 통계명 줄 「{발표 연도}년 발표」 = `projection.releasedOn`의 연도, 「{기준}년 기준」 = `projection.baseYear`,
 * 캡션 연도 = `latest.year`(지평 또는 아기 30세 해), 기준 줄 = `releasedOn` 전체. 폭염은 어댑터(`data/heatProjectionAdapter.ts`)가 같은 자리를 표에서 읽는다.
 */

const CHART_FONT = 13;

// ---------- 공통 ----------

function projectionMark(releasedOn: string): SlideProjection {
  return { chip: SLIDE_TEXT.projChip, note: SLIDE_TEXT.projNote, releasedOn };
}

/** 모든 형식이 같이 가지는 슬라이드 필드 (표제어·공식 통계명 이름·정의·출처) */
function baseOf(ind: UsableIndicator) {
  const headline = STAT_HEADLINES[ind.id];
  const officialName = headline?.officialName ?? ind.title;
  return { id: ind.id, title: ind.title, insight: headline?.insight ?? ind.title, officialName, definition: ind.definition, sourceText: sourceTextOf(ind) };
}

/** 1천만 이상은 그래프 안에서만 만 단위로 줄여 적는다(값 줄·범례·읽기 이름은 원문 자릿수 그대로): 36,222,293 → 「3,622만」 (design-system.md 15-2) */
export function manLabel(value: number): string {
  return `${formatNumber(Math.round(value / 10000), 0)}만`;
}

const releasedYearOf = (releasedOn: string): number => Number(releasedOn.slice(0, 4));

// ---------- 전망 선 그래프 (장래인구추계 둘 · 장래가구추계) ----------

/** 데이터 `official` 「고위 추계(최대인구 추계: …)」에서 뜻 낱말 「최대인구」「최소인구」 — 없으면 null (R-483 a) */
export function scenarioMeaning(scenario: Pick<ProjectionScenario, 'official'>): string | null {
  return /\((최대인구|최소인구) 추계/.exec(scenario.official)?.[1] ?? null;
}
const withMeaning = (s: Pick<ProjectionScenario, 'label' | 'official'>): string => {
  const m = scenarioMeaning(s);
  return m === null ? s.label : `${s.label}(${m})`;
};
/** 「중위 추계」 → 「중위」 (범례의 「전망 2023~2072(중위)」) */
const shortScenario = (label: string): string => /^(.+?) 추계$/.exec(label)?.[1] ?? label;

interface ProjectionParts {
  actual: YearPoint[];
  mid: ProjectionScenario & { pts: YearPoint[] };
  high: (ProjectionScenario & { pts: YearPoint[] }) | null;
  low: (ProjectionScenario & { pts: YearPoint[] }) | null;
  actualWord: '확정' | '추계 앞 구간';
}

function projectionParts(ind: UsableIndicator): ProjectionParts | null {
  const p = ind.projection;
  const word = STAT_HEADLINES[ind.id]?.actualWord;
  if (ind.kind !== 'projection' || p === undefined || p.shape === 'cohort-rows' || word === undefined) return null;
  const actual = yearPoints(ind.actual ?? []);
  const withPts = (s: ProjectionScenario | undefined) => (s === undefined || s.series === undefined ? null : { ...s, pts: yearPoints(s.series) });
  const mid = withPts(p.scenarios.find((s) => s.key === p.defaultScenario));
  if (actual.length < 2 || mid === null || mid.pts.length < 2 || !Number.isInteger(p.actualThrough) || actual[actual.length - 1].year !== p.actualThrough) return null;
  const high = withPts(p.scenarios.find((s) => s.level === 'high'));
  const low = withPts(p.scenarios.find((s) => s.level === 'low'));
  // 고위·저위가 둘 다 있을 때만 띠를 그린다(시나리오가 하나인 장래가구추계는 띠 없음)
  const band = high !== null && low !== null && high.pts.length >= 2 && low.pts.length >= 2;
  return { actual, mid, high: band ? high : null, low: band ? low : null, actualWord: word };
}

/** 전망 선 그래프로 그릴 수 있는 지표인가 (확정 구간 ≥ 2점, 기본 시나리오 ≥ 2점, 경계 = 확정 마지막 해, 전망 앞 구간 이름이 표제어 데이터에 있다) */
export function canDrawProjectionLine(ind: UsableIndicator): boolean {
  return projectionParts(ind) !== null;
}

/** 처음 값 글자(13px)가 실제로 차지하는 상자: 기준선 위 15 · 아래 3, 좌우 1 (getBBox 실측: 위 14.3 · 아래 2.7). e2e 겹침 검사(R-225)가 이 실제 상자로 보므로 같은 크기로 잰다 */
export const FIRST_LABEL_BOX = { up: 15, down: 3, side: 1 } as const;
/** ③ 축 바로 위에서 오른쪽으로 비켜 가는 간격(처음 값 점에서 x가 얼마나 오른쪽인가) — 선이 오른쪽으로 오르므로 오른쪽으로 갈수록 글자 상자 밑에서 멀어진다 */
export const FIRST_LABEL_AXIS_OFFSETS: readonly number[] = [12, 16, 20, 24, 28, 32, 36, 40, 44, 48];

/**
 * 전망 선 그래프의 「처음 값」 글자 자리 (design-system.md 15-2 「첫 값 글자 자리」, R-487): 후보를 차례로 두고 글자 상자(폭 `valueWidthEm × 13px`, 실제 글자 상자 `FIRST_LABEL_BOX`, 그림 영역 안)가
 * 어느 계열의 선분과도 만나지 않는 첫 자리를 쓴다 — ① 점 위 (x, y−8) ② 점 아래 (x, y+18) ③ 축 바로 위 오른쪽 (x+12, 축−4)부터 4px씩 더 오른쪽 ④ 위 눈금 아래 오른쪽 (x+12, 위+17). 다 만나면 ①.
 * 축 가까이에서 가파르게 오르는 선(총인구 1960 「2,501만」, 1인 가구 2000 「15.5」)은 ①·②가 선·축과 겹쳐 ③이 뽑힌다.
 * developer 보정(SPEC-005 QI4 2단계, 실제 브라우저 검사에서 드러남 — ai-log/2026-10-21_SPEC-005_dev-QI4-2.md): (1) 시안 생성기는 상자를 위 12·아래 2로 잡아 실제 글자(위 14.3)보다 작았다 → 실제 크기로,
 * (2) ③이 x+12 한 자리뿐이라 낮은 그래프(1280 폭, 높이 180)의 1인 가구 「15.5」가 오르는 선과 겹쳐 ①로 돌아갔다 → ③을 오른쪽으로 4px씩 비켜 가며 보고, (3) ④는 위 한계(PAD.top + 2)와 같은 식이라 늘 막혀 있었다 → y를 위+17로.
 * 보통 선 그래프(`placeFirstLabels`)는 이 규칙을 쓰지 않는다 — 14장의 처음 값 자리는 기존 시험(R-225·QM2-8)이 잠그고 있어 그대로 두었다(전망 그래프만 새 규칙).
 */
export function placeProjectionFirstLabel(first: LinePoint, allSegments: ReadonlyArray<ReadonlyArray<{ x: number; y: number }>>, axisY: number): ChartLabel {
  const w = valueWidthEm(first.text) * CHART_FONT;
  const candidates: Array<[number, number]> = [
    [first.x, first.y - 8],
    [first.x, first.y + 18],
    ...FIRST_LABEL_AXIS_OFFSETS.map((dx): [number, number] => [first.x + dx, axisY - 4]),
    [first.x + 12, PAD.top + 17],
  ];
  for (const [x, y] of candidates) {
    const box: Rect = { left: x - FIRST_LABEL_BOX.side, right: x + w + FIRST_LABEL_BOX.side, top: y - FIRST_LABEL_BOX.up, bottom: y + FIRST_LABEL_BOX.down };
    if (box.top < PAD.top + 2 || box.bottom > axisY) continue;
    let hit = false;
    for (const seg of allSegments) for (let k = 1; k < seg.length && !hit; k++) hit = segmentHitsRect(seg[k - 1].x, seg[k - 1].y, seg[k].x, seg[k].y, box);
    if (!hit) return { x, y: round1(y), text: first.text, anchor: 'start', bold: false };
  }
  return { x: first.x, y: round1(first.y - 8), text: first.text, anchor: 'start', bold: false };
}

export function buildProjectionLineSlide(ind: UsableIndicator, updatedOn: string | undefined, size: ChartSize): CarouselSlide | null {
  const parts = projectionParts(ind);
  const p = ind.projection;
  if (parts === null || p === undefined) return null;
  const { actual, mid, high, low, actualWord } = parts;
  const { width, lineHeight } = size;
  const unit = ind.unit ?? ind.latestUnit;
  const d = ind.decimals;
  const all = [...actual, ...p.scenarios.flatMap((s) => yearPoints(s.series ?? []))];
  const minYear = Math.min(...all.map((q) => q.year));
  const maxYear = Math.max(...all.map((q) => q.year));
  let lo = Math.min(...all.map((q) => q.value));
  let hi = Math.max(...all.map((q) => q.value));
  if (hi === lo) {
    lo -= 1;
    hi += 1;
  }
  const pad = (hi - lo) * 0.08;
  lo -= pad;
  hi += pad;
  const plotW = width - PAD.left - PAD.right;
  const plotH = lineHeight - PAD.top - PAD.bottom;
  const xOf = (year: number) => round1(PAD.left + (maxYear === minYear ? plotW / 2 : ((year - minYear) / (maxYear - minYear)) * plotW));
  const yOf = (value: number) => round1(PAD.top + (1 - (value - lo) / (hi - lo)) * plotH);
  const big = (v: number) => (Math.abs(v) >= 1e7 ? manLabel(v) : formatNumber(v, d));
  const withUnit = (v: number) => `${formatNumber(v, d)}${unit}`;
  const toPoints = (pts: YearPoint[]): LinePoint[] => pts.map((q) => ({ x: xOf(q.year), y: yOf(q.value), year: q.year, value: q.value, text: big(q.value) }));

  const A = toPoints(actual);
  const M = toPoints(mid.pts);
  const lastA = A[A.length - 1];
  const lastM = M[M.length - 1];
  // 가구추계처럼 마지막 확정 해(2021) < 첫 추계 해(2022)이면 그 사이도 점선으로 잇는다
  const projPts = lastA.year < M[0].year ? [lastA, ...M] : M;
  const throughYear = p.actualThrough;
  const splitX = xOf(throughYear);
  const axisY = round1(PAD.top + plotH);
  const grid = [0, 0.5, 1].map((t) => round1(PAD.top + t * plotH));
  const fromYear = M[0].year === throughYear ? throughYear + 1 : M[0].year;
  const scenario = mid.level === 'single' ? null : mid.label;

  const Hp = high === null ? [] : toPoints(high.pts);
  const Lp = low === null ? [] : toPoints(low.pts);
  const pointsAttr = (pts: LinePoint[]) => pts.map((q) => `${q.x},${q.y}`).join(' ');
  const band =
    high !== null && low !== null
      ? { path: `M${Hp.map((q) => `${q.x},${q.y}`).join('L')}L${[...Lp].reverse().map((q) => `${q.x},${q.y}`).join('L')}Z`, edges: [pointsAttr(Hp), pointsAttr(Lp)] as [string, string] }
      : null;

  const actualLabel = SLIDE_TEXT.legendActual(actualWord, A[0].year, throughYear);
  const projLabel = SLIDE_TEXT.legendProjection(fromYear, maxYear, scenario === null ? null : shortScenario(scenario));
  const series: LineSeriesModel[] = [
    { key: 'actual', label: actualLabel, dash: 'solid', segments: [A], points: A, first: A[0], last: lastA, marks: 'none' },
    { key: 'projection', label: projLabel, dash: 'proj', segments: [projPts], points: projPts, first: projPts[0], last: lastM, marks: 'last' },
  ];

  // 값 글자: 마지막(중위 끝값, 굵게)과 「고위」「저위」를 세로로 벌려 놓는다 · 처음(확정 첫 값)은 선과 겹치지 않는 후보 자리
  const endLabels: ChartLabel[] = [{ x: lastM.x + 8, y: lastM.y + 4, text: lastM.text, anchor: 'start', bold: true }];
  if (high !== null && low !== null) {
    endLabels.push({ x: Hp[Hp.length - 1].x + 8, y: Hp[Hp.length - 1].y + 4, text: '고위', anchor: 'start', bold: false, tone: 'range' });
    endLabels.push({ x: Lp[Lp.length - 1].x + 8, y: Lp[Lp.length - 1].y + 4, text: '저위', anchor: 'start', bold: false, tone: 'range' });
  }
  const ys = spreadY(endLabels.map((l) => l.y), LABEL_GAP, PAD.top, lineHeight - PAD.bottom);
  const labels = endLabels.map((l, k) => ({ ...l, y: round1(ys[k]) }));
  labels.push(placeProjectionFirstLabel(A[0], [A, projPts, Hp, Lp].filter((s) => s.length > 1), axisY));

  const split = {
    x: splitX,
    year: throughYear,
    top: 18,
    bottom: axisY,
    tickTo: axisY + 5,
    left: { x: splitX - 4, y: 16, text: actualWord, anchor: 'end' as const, bold: false, tone: 'split' as const },
    right: { x: splitX + 4, y: 16, text: SLIDE_TEXT.projChip, anchor: 'start' as const, bold: false, tone: 'split' as const },
  };
  const xLabels: ChartLabel[] = [
    { x: xOf(minYear), y: lineHeight - 8, text: String(minYear), anchor: 'start', bold: false },
    { x: splitX, y: lineHeight - 8, text: String(throughYear), anchor: 'middle', bold: false },
    { x: xOf(maxYear), y: lineHeight - 8, text: String(maxYear), anchor: 'end', bold: false },
  ];
  const chart: LineChartModel = { kind: 'line', width, height: lineHeight, plotLeft: PAD.left, plotRight: width - PAD.right, grid, axisY, xLabels, labels, series, split, band };

  const legend: SlideLegendItem[] = [
    { key: 'actual', label: actualLabel, dash: 'solid', valueText: withUnit(lastA.value) },
    { key: 'projection', label: projLabel, dash: 'proj', valueText: withUnit(lastM.value) },
  ];
  if (high !== null && low !== null) legend.push({ key: 'band', label: SLIDE_TEXT.legendBand(high.label.replace(/ 추계$/, ''), scenarioMeaning(high), low.label.replace(/ 추계$/, ''), scenarioMeaning(low)), dash: 'proj', valueText: '', rect: 'band' });

  const name = baseOf(ind).officialName;
  const range = high !== null && low !== null ? SLIDE_TEXT.rangeRead(scenarioMeaning(high), withUnit(high.pts[high.pts.length - 1].value), scenarioMeaning(low), withUnit(low.pts[low.pts.length - 1].value)) : null;
  const chartLabel = SLIDE_TEXT.projectionLineLabel({
    name,
    firstYear: A[0].year,
    throughYear,
    horizonYear: maxYear,
    actualPhrase: SLIDE_TEXT.actualPhrase(actualWord),
    hasBand: band !== null,
    firstValue: withUnit(A[0].value),
    throughValue: withUnit(lastA.value),
    horizonValue: withUnit(lastM.value),
    midWord: mid.level === 'single' ? null : '중위',
    range,
  });

  // 보조 줄: 고위·저위가 있으면 끝값 둘(쉼표 문장, 항목마다 줄바꿈 묶음), 시나리오가 하나면 앞 구간의 출발값·경계값(R-483 b), 그 뒤 65세 이상 인구 같은 보조 값
  const sideValues: SlideSideValue[] = [];
  if (high !== null && low !== null) {
    const items = [SLIDE_TEXT.scenarioValue(withMeaning(high), withUnit(high.pts[high.pts.length - 1].value)), SLIDE_TEXT.scenarioValue(withMeaning(low), withUnit(low.pts[low.pts.length - 1].value))];
    const lead = SLIDE_TEXT.endYear(maxYear);
    sideValues.push({ name: '고위·저위', valueText: items.join(', '), text: `${lead} ${items.join(', ')}`, phrases: { lead, items } });
  } else {
    const text = SLIDE_TEXT.edgeValues(actualWord, A[0].year, withUnit(A[0].value), throughYear, withUnit(lastA.value));
    sideValues.push({ name: actualWord, valueText: text, text });
  }
  for (const r of ind.related ?? []) {
    // 보조 값은 기본 시나리오의 끝값 하나(65세 이상 인구) — 가구추계의 가구 수 같은 나머지는 화면에 올리지 않는다(마스터 결정: 보조 줄은 구성비 설명에 필요한 것만)
    if (r.key !== 'population65plus') continue;
    const series2 = yearPoints(r.scenarios.find((s) => s.key === mid.key)?.series ?? []);
    const end = series2[series2.length - 1];
    if (end === undefined) continue;
    const valueText = `${formatNumber(end.value, r.decimals)}${r.unit}`;
    sideValues.push({ name: r.label, valueText, text: SLIDE_TEXT.relatedValue(r.label, end.year, valueText, mid.label) });
  }

  return {
    ...baseOf(ind),
    officialText: SLIDE_TEXT.officialProjection(name, releasedYearOf(p.releasedOn), `${p.baseYear}년`, scenario),
    headlines: [{ label: null, value: formatNumber(ind.latest.value, d) }],
    valueText: formatNumber(ind.latest.value, d),
    unitText: ind.latestUnit,
    basisText: null,
    caption: ind.latestLabel ?? null,
    basisLine: formatBasisLine(ind, updatedOn, p.releasedOn),
    chart,
    chartLabel,
    legend,
    legendLabel: LEGEND_LABEL_LINE,
    seriesNote: null,
    sideValues,
    tables: [],
    projection: projectionMark(p.releasedOn),
    safety: null,
  };
}

// ---------- 지금 태어나는 아기라면? (연령 3구간 누적 막대) ----------

interface NewbornRow {
  age: number;
  year: number;
  share0to14: number;
  share15to64: number;
  share65plus: number;
  totalDependency: number;
}

function newbornParts(ind: UsableIndicator): { mid: ProjectionScenario; rows: NewbornRow[] } | null {
  const p = ind.projection;
  if (ind.kind !== 'projection' || p === undefined || p.shape !== 'cohort-rows') return null;
  const mid = p.scenarios.find((s) => s.key === p.defaultScenario);
  if (mid === undefined || mid.rows === undefined) return null;
  const rows: NewbornRow[] = [];
  for (const r of mid.rows) {
    if (![r.age, r.year, r.share0to14, r.share15to64, r.share65plus, r.totalDependency].every((v) => Number.isFinite(v))) return null;
    rows.push({ age: r.age, year: r.year, share0to14: r.share0to14, share15to64: r.share15to64, share65plus: r.share65plus, totalDependency: r.totalDependency });
  }
  rows.sort((a, b) => a.age - b.age);
  if (rows.length < 2 || !rows.some((r) => r.year === ind.latest.year)) return null;
  return { mid, rows };
}

export function canDrawNewborn(ind: UsableIndicator): boolean {
  return newbornParts(ind) !== null;
}

export function buildNewbornSlide(ind: UsableIndicator, updatedOn: string | undefined, size: ChartSize): CarouselSlide | null {
  const parts = newbornParts(ind);
  const p = ind.projection;
  if (parts === null || p === undefined) return null;
  const { mid, rows } = parts;
  const d = ind.decimals;
  const width = size.width;
  const rowH = 26;
  const top = 22;
  const labelX = 62;
  const barX = 70;
  const barWidth = Math.max(60, width - barX - 58);
  const height = top + rows.length * rowH + 4;
  const pct = (v: number) => `${formatNumber(v, d)}%`;
  const stackRows: StackRowModel[] = rows.map((r, k) => {
    const y = top + k * rowH;
    const wy = round1((r.share0to14 / 100) * barWidth);
    const ww = round1((r.share15to64 / 100) * barWidth);
    return {
      age: r.age,
      year: r.year,
      y: y + 4,
      textY: y + 17,
      ageText: `${r.age}세`,
      yearText: String(r.year),
      young: { x: barX, width: wy },
      work: { x: round1(barX + wy), width: ww, text: pct(r.share15to64) },
      old: { x: round1(barX + wy + ww), width: round1(barWidth - wy - ww) },
      valueText: pct(r.share65plus),
      valueX: barX + barWidth + 6,
    };
  });
  const chart: StackChartModel = {
    kind: 'stack',
    width,
    height,
    labelX,
    barX,
    barWidth,
    barHeight: 18,
    header: { x: width - 2, y: 14, text: SLIDE_TEXT.newbornHeader(mid.label), anchor: 'end', bold: false, tone: 'split' },
    rows: stackRows,
  };
  const birthYear = ind.cohort?.birthYear ?? rows.find((r) => r.age === 0)?.year ?? rows[0].year;
  const rowsText = rows.map((r) => SLIDE_TEXT.newbornRowRead(r.year, r.age, pct(r.share0to14), pct(r.share15to64), pct(r.share65plus), formatNumber(r.totalDependency, d))).join('. ');
  const tables: SlideTable[] = [
    {
      caption: SLIDE_TEXT.newbornTableCaption(ind.title, mid.label),
      head: [...SLIDE_TEXT.newbornTableHead],
      rows: rows.map((r) => ({ head: `${r.age}세(${r.year}년)`, cells: [pct(r.share0to14), pct(r.share15to64), pct(r.share65plus), formatNumber(r.totalDependency, d)] })),
    },
  ];
  const first = rows[0];
  const latestRow = rows.find((r) => r.year === ind.latest.year) ?? rows[rows.length - 1];
  const dependency = SLIDE_TEXT.newbornDependency(first.year, formatNumber(first.totalDependency, d), latestRow.year, formatNumber(latestRow.totalDependency, d));
  const legend: SlideLegendItem[] = [
    { key: 'young', label: SLIDE_TEXT.newbornLegend.young, dash: 'solid', valueText: '', rect: 'young' },
    { key: 'work', label: SLIDE_TEXT.newbornLegend.work, dash: 'solid', valueText: '', rect: 'work' },
    { key: 'old', label: SLIDE_TEXT.newbornLegend.old, dash: 'solid', valueText: '', rect: 'old' },
  ];
  const name = baseOf(ind).officialName;
  return {
    ...baseOf(ind),
    officialText: SLIDE_TEXT.officialProjection(name, releasedYearOf(p.releasedOn), `${p.baseYear}년`, mid.level === 'single' ? null : mid.label),
    headlines: [{ label: null, value: formatNumber(ind.latest.value, d) }],
    valueText: formatNumber(ind.latest.value, d),
    unitText: ind.latestUnit,
    basisText: null,
    caption: ind.latestLabel ?? null,
    basisLine: formatBasisLine(ind, updatedOn, p.releasedOn),
    chart,
    chartLabel: SLIDE_TEXT.newbornChartLabel(birthYear, rows.map((r) => r.age), mid.label, rowsText),
    legend,
    legendLabel: SLIDE_TEXT.barLegendLabel,
    seriesNote: null,
    sideValues: [{ name: '총부양비', valueText: dependency, text: dependency }],
    tables,
    projection: projectionMark(p.releasedOn),
    safety: null,
  };
}

// ---------- 폭염일수 (막대 셋 + 권역 표) ----------

export function buildHeatSlide(ind: UsableIndicator, updatedOn: string | undefined, size: ChartSize): CarouselSlide | null {
  const input = heatProjectionInput(ind);
  if (input === null) return null;
  const d = ind.decimals;
  const unit = ind.latestUnit;
  const width = size.width;
  const rowH = 26;
  const labelX = 122;
  const barX = 128;
  const maxBar = Math.max(40, width - barX - 48);
  const max = Math.max(...input.bars.map((b) => b.value));
  const withUnit = (v: number) => `${formatNumber(v, d)}${unit}`;
  const rows: BarsRowModel[] = input.bars.map((b, k) => {
    const barY = k * rowH + 10;
    const barWidth = max > 0 ? Math.max(2, round1((b.value / max) * maxBar)) : 2;
    return { label: b.label, fullLabel: b.label, value: b.value, text: withUnit(b.value), valueWithUnit: withUnit(b.value), barY, textY: barY + 11, barWidth, proj: b.projection, bold: false };
  });
  const chart: BarsChartModel = { kind: 'bars', width, height: input.bars.length * rowH + 8, labelX, barX, barHeight: 14, header: null, rows };
  const tables: SlideTable[] = [
    {
      caption: SLIDE_TEXT.heatTableCaption(ind.title),
      head: input.columns,
      rows: input.rows.map((r) => ({ head: r.label, cells: [withUnit(r.present), withUnit(r.lateLow), withUnit(r.lateHigh)] })),
    },
  ];
  const legend: SlideLegendItem[] = [
    { key: 'now', label: SLIDE_TEXT.heatLegendNow, dash: 'solid', valueText: '', rect: 'bar' },
    { key: 'proj', label: SLIDE_TEXT.heatLegendProj, dash: 'proj', valueText: '', rect: 'proj' },
  ];
  const present = SLIDE_TEXT.heatPresent(input.present.period, withUnit(input.present.value));
  const name = baseOf(ind).officialName;
  return {
    ...baseOf(ind),
    officialText: SLIDE_TEXT.officialProjection(name, releasedYearOf(input.releasedOn), input.baseLabel, input.scenarioWord),
    headlines: input.headlines.map((h) => ({ label: h.label, value: formatNumber(h.value, d) })),
    valueText: formatNumber(input.headlines[0].value, d),
    unitText: unit,
    basisText: null,
    caption: input.caption,
    basisLine: formatBasisLine(ind, updatedOn, input.releasedOn),
    chart,
    chartLabel: SLIDE_TEXT.heatChartLabel(input.region, input.bars.map((b) => `${b.label} ${withUnit(b.value)}`).join(', '), input.rows.length),
    legend,
    legendLabel: SLIDE_TEXT.barLegendLabel,
    seriesNote: null,
    sideValues: [{ name: '현재', valueText: withUnit(input.present.value), text: present }],
    tables,
    projection: projectionMark(input.releasedOn),
    safety: null,
  };
}

// ---------- 연령별 격차 (마지막 해 두 구간 막대 + 보조 줄 둘 + 2011~2024 표) ----------

interface GapParts {
  main: { label: string; pts: YearPoint[] };
  extra: { label: string; pts: YearPoint[] };
  /** 두 계열이 함께 있는 해 */
  paired: Array<{ year: number; main: number; extra: number }>;
}

function gapParts(ind: UsableIndicator): GapParts | null {
  const mainPts = yearPoints(ind.series ?? []);
  const e = ind.extraSeries?.[0];
  const extraPts = e === undefined ? [] : yearPoints(e.series);
  if (mainPts.length < 2 || e === undefined || extraPts.length < 2) return null;
  const byYear = new Map(extraPts.map((q) => [q.year, q.value]));
  const paired = mainPts.filter((q) => byYear.has(q.year)).map((q) => ({ year: q.year, main: q.value, extra: byYear.get(q.year) as number }));
  return { main: { label: ind.seriesLabel ?? ind.title, pts: mainPts }, extra: { label: e.label, pts: extraPts }, paired };
}

export function canDrawGap(ind: UsableIndicator): boolean {
  return gapParts(ind) !== null;
}

/**
 * 「2011~2024년 모든 해에 66세 이상의 격차가 18~65세보다 큽니다」 판정 (R-476 b, D5-75): 두 계열이 함께 있는 해(≥ 2개)마다 본 계열 값 > 보조 계열 값일 때만 참이다.
 * 갱신으로 깨지면 슬라이드는 이 문장을 **거짓으로 보이지 않고 빼며**, tests/slideForms.test.ts가 실제 데이터에서 참임을 단언해 조용히 빠지는 일을 막는다(깨지면 시험이 실패한다).
 */
export function gapEveryYear(ind: UsableIndicator): { holds: boolean; firstYear: number; lastYear: number; years: number } | null {
  const parts = gapParts(ind);
  if (parts === null || parts.paired.length < 2) return null;
  const { paired } = parts;
  return { holds: paired.every((q) => q.main > q.extra), firstYear: paired[0].year, lastYear: paired[paired.length - 1].year, years: paired.length };
}

export function buildGapSlide(ind: UsableIndicator, updatedOn: string | undefined, size: ChartSize, officialBasis: string): CarouselSlide | null {
  const parts = gapParts(ind);
  const headline = STAT_HEADLINES[ind.id];
  if (parts === null) return null;
  const { main, extra, paired } = parts;
  const d = ind.decimals;
  const unit = ind.unit ?? ind.latestUnit;
  const lastM = main.pts[main.pts.length - 1];
  const lastE = extra.pts[extra.pts.length - 1];
  const mainShort = bareName(main.label);
  const extraShort = bareName(extra.label);
  // 두 계열의 마지막 해가 다르면 다른 쪽의 연도를 라벨에 밝힌다 (REV 7절 8) — 지금은 둘 다 같은 해(2024)
  const sameYear = lastM.year === lastE.year;
  const withUnit = (v: number) => `${formatNumber(v, d)}${unit}`;
  const barLabel = (short: string, year: number) => (sameYear ? short : `${short}(${year}년)`);
  const { width } = size;
  const rowH = 26;
  const top = 22;
  const labelX = 70;
  const barX = 78;
  const maxBar = Math.max(60, width - barX - 66);
  const bars = [
    { label: barLabel(mainShort, lastM.year), full: main.label, value: lastM.value },
    { label: barLabel(extraShort, lastE.year), full: extra.label, value: lastE.value },
  ];
  const max = Math.max(...bars.map((b) => b.value));
  const rows: BarsRowModel[] = bars.map((b, k) => {
    const barY = top + k * rowH + 4;
    return { label: b.label, fullLabel: b.full, value: b.value, text: withUnit(b.value), valueWithUnit: withUnit(b.value), barY, textY: barY + 13, barWidth: max > 0 ? Math.max(2, round1((b.value / max) * maxBar)) : 2, proj: false, bold: true };
  });
  const chart: BarsChartModel = {
    kind: 'bars',
    width,
    height: top + bars.length * rowH + 4,
    labelX,
    barX,
    barHeight: 18,
    header: sameYear ? { x: width - 2, y: 14, text: SLIDE_TEXT.gapHeader(lastM.year), anchor: 'end', bold: false, tone: 'split' } : null,
    rows,
  };
  const every = gapEveryYear(ind);
  const sideValues: SlideSideValue[] = [];
  if (every !== null && every.holds) {
    const text = SLIDE_TEXT.gapAllYears(every.firstYear, every.lastYear, mainShort, extraShort);
    sideValues.push({ name: '모든 해', valueText: '', text });
  }
  const bandsText = SLIDE_TEXT.gapBands(extraShort, mainShort);
  sideValues.push({ name: '공표 구간', valueText: '', text: bandsText });
  const tables: SlideTable[] = [
    {
      caption: SLIDE_TEXT.gapTableCaption(ind.title, paired[0]?.year ?? lastM.year, paired[paired.length - 1]?.year ?? lastM.year),
      head: [SLIDE_TEXT.gapTableYearHead, main.label, extra.label],
      rows: paired.map((q) => ({ head: `${q.year}년`, cells: [withUnit(q.main), withUnit(q.extra)] })),
    },
  ];
  const name = baseOf(ind).officialName;
  return {
    ...baseOf(ind),
    officialText: `${name}(${officialBasis})`,
    headlines: [
      { label: bars[0].label, value: formatNumber(lastM.value, d) },
      { label: bars[1].label, value: formatNumber(lastE.value, d) },
    ],
    valueText: formatNumber(lastM.value, d),
    unitText: ind.latestUnit,
    basisText: null,
    caption: headline?.caption ?? null,
    basisLine: formatBasisLine(ind, updatedOn),
    chart,
    chartLabel: SLIDE_TEXT.gapChartLabel(lastM.year, ind.title, main.label, withUnit(lastM.value), extra.label, withUnit(lastE.value), paired[0]?.year ?? lastM.year, paired[paired.length - 1]?.year ?? lastM.year),
    legend: [],
    legendLabel: LEGEND_LABEL_LINE,
    seriesNote: null,
    sideValues,
    tables,
    projection: null,
    safety: null,
  };
}
