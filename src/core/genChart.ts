import { GEN_CHART_TEXT as TXT } from '../data/genChartText';
import { NOW_YEAR } from '../data/generationText';
import { FIRST_BIRTH_YEAR, GENERATIONS, LAST_BIRTH_YEAR } from '../data/generations';
import { formatNumber, getUsableIndicator, type Point } from '../data/koreaStatsAccess';
import { commaList } from './glue';
import { currentOrgName, round1, sourceOrgsOf } from './slideKit';
import type { GenerationChoice } from './types';

/**
 * 첫 화면 캐러셀 첫 장 「세대 그래프」의 모델 (SPEC-004 GS11, design-system.md 17-12-3·17-13, diff-004.md D4-61·D4-72). 순수 함수 — React 없이 단위 테스트한다.
 *
 * 질문 「고른 세대는 한 해에 몇 명이 태어났을까?」 하나, 계열 하나(1970~2020 출생아 수). 왼쪽 세대 목록이 손잡이라 고른 세대에 맞춰 강조 구간(옅은 쪽빛 띠 + 쪽빛 2.5px 선)만 옮겨 간다.
 * 값은 `koreaStats.json`의 `births`(1970~)·`life-expectancy`(1970~)뿐이다 — 새로 수집한 값이 없다. 1940~1969는 공식 연간 출생 통계가 없어 **비워 두고** 「연간 통계 없음」 글자와 출처 줄의 한 문장으로 말한다(추정값 0).
 * 세대 사이의 우열·순위를 말하는 문구·모양은 없다(GD6) — 세대마다 같은 질문에 같은 모양으로 답한다.
 */

/** 그래프의 가로 범위(연도) — 세대 정의의 첫해·끝해 */
export const GEN_CHART_Y0 = FIRST_BIRTH_YEAR;
export const GEN_CHART_Y1 = LAST_BIRTH_YEAR;
/** y축 꼭대기(명) — 최댓값(1971년 1,024,773) 위의 눈금 120만에 둔다 (최댓값 = 꼭대기 눈금 금지) */
export const GEN_CHART_YMAX = 1_200_000;
/** y 눈금(명) */
export const GEN_CHART_YTICKS: readonly number[] = [400_000, 800_000, 1_200_000];
/** x 눈금(연도) */
export const GEN_CHART_XTICKS: readonly number[] = [1940, 1960, 1980, 2000, 2020];
/** 그림 틀의 여백(px): 왼쪽은 y 눈금 글자 자리, 위는 꼭대기 눈금선, 아래는 x 눈금 글자 자리 */
const PAD = { L: 46, R: 8, T: 16, bottom: 24 } as const;
/** 그림 폭 대비 높이 (시안 400×196) */
const ASPECT = 196 / 400;
/** 그림 폭 범위 — 선 그래프와 같다(core/carousel.ts CHART_MIN_W/MAX_W) */
const MIN_W = 220;
const MAX_W = 520;

export interface GenChartPoint {
  year: number;
  value: number;
  x: number;
  y: number;
}

export interface GenChartSource {
  /** 출생아 수(명) — 연도 오름차순, 그래프 범위(≤ 2020) 안의 해만 */
  births: readonly { year: number; value: number }[];
  /** 기대수명(세) — 연도 오름차순 */
  life: readonly { year: number; value: number }[];
  /** 출처 줄 재료: 기관(현재 이름 쉼표 나열)과 조회일(두 지표 가운데 늦은 날) */
  org: string;
  accessedOn: string;
}

function yearPoints(series: readonly Point[] | undefined): { year: number; value: number }[] {
  const out: { year: number; value: number }[] = [];
  for (const p of series ?? []) if ('year' in p && Number.isFinite(p.value)) out.push({ year: p.year, value: p.value });
  return out.sort((a, b) => a.year - b.year);
}

/** 저장소 데이터(koreaStats.json)에서 그래프 재료를 읽는다. 두 지표 중 하나라도 확인된 값이 아니면 null — 그러면 첫 장이 없다(조용히 지어내지 않는다) */
export function genChartSource(): GenChartSource | null {
  const births = getUsableIndicator('births');
  const life = getUsableIndicator('life-expectancy');
  if (births === undefined || life === undefined) return null;
  const b = yearPoints(births.series).filter((p) => p.year <= GEN_CHART_Y1);
  const l = yearPoints(life.series);
  if (b.length < 2 || l.length < 2) return null;
  const orgs: string[] = [];
  for (const raw of [births.source.org, life.source.org]) for (const o of sourceOrgsOf(raw)) if (!orgs.includes(currentOrgName(o))) orgs.push(currentOrgName(o));
  const accessedOn = [births.source.accessedOn, life.source.accessedOn].sort().slice(-1)[0];
  return { births: b, life: l, org: commaList(orgs), accessedOn };
}

/** 4자리 연도 `1970`부터의 첫 해 */
export function firstDataYear(src: GenChartSource): number {
  return src.births[0].year;
}

/** 만 단위 반올림 글자 「64만」 */
export function manText(v: number): string {
  return `${Math.round(v / 10_000)}만`;
}

/** 그림 폭(px)을 허용 범위로 맞추고 4px 단위로 내린다 */
export function genChartWidth(containerPx: number): number {
  return Number.isFinite(containerPx) ? Math.min(MAX_W, Math.max(MIN_W, Math.floor(containerPx / 4) * 4)) : 320;
}

export interface GenChartRow {
  /** 「1970년」 · 「1940~1969년」 */
  label: string;
  /** 「1,006,645명」 · 자료 없는 줄은 null */
  value: string | null;
}

export interface GenChartModel {
  choice: GenerationChoice;
  width: number;
  height: number;
  /** 플롯 영역(px): 왼쪽 x · 오른쪽 x · 위 y · 아래(가로축) y */
  L: number;
  R: number;
  T: number;
  B: number;
  /** 가로 보조선 y (y 눈금마다) */
  grid: number[];
  yTicks: Array<{ y: number; text: string }>;
  xTicks: Array<{ x: number; text: string; anchor: 'start' | 'middle' | 'end' }>;
  /** 고른 세대의 띠(한 해 칸 폭 단위 — 앞뒤 반 칸씩 넓다). 랜덤은 null */
  band: { x: number; y: number; width: number; height: number } | null;
  /** 자료 없는 구간 글자(1940~1969 가운데, 기준선 위) */
  none: { x: number; y: number; text: string };
  /** 전체 선(보조) · 고른 구간 선(강조) polyline points. 구간에 자료가 없으면 null */
  rest: string;
  span: string | null;
  /** 구간 최댓값 점과 직접 라벨 하나 */
  peak: { x: number; y: number; labelX: number; labelY: number; text: string } | null;
  /** 해마다 점(가리킴이 가장 가까운 해를 찾는다) */
  points: GenChartPoint[];
  /** 한 해 칸 폭(px)과 해 → x */
  step: number;
  /** 세대 줄: 「{세대 이름} · {from}~{to}년생」의 이름·범위 */
  gen: { name: string; range: string; from: number; to: number };
  /** 큰 값: 한 해 평균(만 단위) — 자료 없는 세대는 null */
  big: { value: string; unit: string } | null;
  bigSub: string;
  /** 숫자 둘 */
  age: string;
  life: { value: string; sub: string } | null;
  lifeNone: string;
  /** 「표로 보기」 */
  table: GenChartRow[];
  tableCaption: string;
  /** svg `aria-label` */
  readName: string;
}

/** 세대 선택 → 이름·출생 연도 범위 (랜덤은 전체) */
function spanOf(choice: GenerationChoice): { name: string; from: number; to: number } {
  if (choice === 'random') return { name: TXT.anyGen, from: GEN_CHART_Y0, to: GEN_CHART_Y1 };
  const g = GENERATIONS.find((x) => x.id === choice);
  if (g === undefined) throw new RangeError(`genChart: 모르는 세대 ${String(choice)}`);
  return { name: g.label, from: g.birth.from, to: g.birth.to };
}

/**
 * 세대 선택 하나의 그래프 모델. `width`는 화면에 그려지는 폭(px) — 좌표계 한 칸이 화면의 1px이라 글자가 어느 폭에서나 같은 크기다(R-206 방식).
 * 숫자 규칙(design-system.md 17-12-3 검산표): 올해 나이 = 2026 − 끝해 ~ 2026 − 첫해 · 한 해 평균 = 구간 안 자료 있는 해의 산술평균(만 단위 반올림) · 기대수명 = 구간 첫 자료 해·끝 자료 해의 값.
 */
export function buildGenChart(choice: GenerationChoice, src: GenChartSource, width: number, now = NOW_YEAR): GenChartModel {
  const w = genChartWidth(width);
  const h = Math.round(w * ASPECT);
  const { name, from, to } = spanOf(choice);
  const all = choice === 'random';
  const L: number = PAD.L;
  const R = w - PAD.R;
  const T: number = PAD.T;
  const B = h - PAD.bottom;
  const step = (R - L) / (GEN_CHART_Y1 - GEN_CHART_Y0);
  const xOf = (year: number) => L + (year - GEN_CHART_Y0) * step;
  const yOf = (v: number) => B - (v / GEN_CHART_YMAX) * (B - T);
  const inSpan = (year: number) => year >= from && year <= to;

  const rows = src.births.filter((p) => inSpan(p.year));
  const avg = rows.length > 0 ? rows.reduce((s, p) => s + p.value, 0) / rows.length : null;
  const peakRow = rows.length > 0 ? rows.reduce((m, p) => (p.value > m.value ? p : m)) : null;
  const lifeRows = src.life.filter((p) => inSpan(p.year));
  const lifeA = lifeRows.length > 0 ? lifeRows[0] : null;
  const lifeB = lifeRows.length > 0 ? lifeRows[lifeRows.length - 1] : null;
  const first = firstDataYear(src);
  const lastBirths = src.births[src.births.length - 1];

  const pts = (arr: readonly { year: number; value: number }[]) => arr.map((p) => `${round1(xOf(p.year))},${round1(yOf(p.value))}`).join(' ');
  let peak: GenChartModel['peak'] = null;
  if (peakRow !== null) {
    const px = round1(xOf(peakRow.year));
    const py = round1(yOf(peakRow.value));
    peak = { x: px, y: py, labelX: Math.min(Math.max(px, L + 48), R - 48), labelY: round1(py - 9), text: `${peakRow.year}년 ${manText(peakRow.value)}` };
  }

  const table: GenChartRow[] = [];
  if (from < first) table.push({ label: `${Math.max(from, GEN_CHART_Y0)}~${Math.min(to, first - 1)}년`, value: null });
  for (const p of rows) table.push({ label: `${p.year}년`, value: `${formatNumber(p.value, 0)}명` });

  let readName: string;
  if (all) {
    readName = TXT.labelAll({ from: GEN_CHART_Y0, to: GEN_CHART_Y1, firstData: first, span: `${first}~${lastBirths.year}년`, avg: manText(avg!), peakY: peakRow!.year, peakV: manText(peakRow!.value), lastY: lastBirths.year, lastV: manText(lastBirths.value) });
  } else {
    const body = peakRow === null || avg === null ? TXT.labelGenNone : TXT.labelGenData({ avg: manText(avg), peakY: peakRow.year, peakV: manText(peakRow.value) });
    readName = TXT.labelGen({ all: { from: GEN_CHART_Y0, to: GEN_CHART_Y1 }, name, from, to, body });
  }

  return {
    choice,
    width: w,
    height: h,
    L,
    R,
    T,
    B,
    grid: GEN_CHART_YTICKS.map((v) => round1(yOf(v))),
    yTicks: [...GEN_CHART_YTICKS.map((v) => ({ y: round1(yOf(v) + 4), text: manText(v) })), { y: B + 4, text: '0' }],
    xTicks: GEN_CHART_XTICKS.map((y) => ({ x: round1(xOf(y)), text: String(y), anchor: y === GEN_CHART_Y0 ? ('start' as const) : y === GEN_CHART_Y1 ? ('end' as const) : ('middle' as const) })),
    band: all ? null : { x: round1(xOf(from) - step / 2), y: T - 6, width: round1((to - from + 1) * step), height: B - T + 6 },
    none: { x: round1(xOf((GEN_CHART_Y0 + first - 1) / 2)), y: B - 10, text: TXT.none },
    rest: pts(src.births),
    span: rows.length > 0 ? pts(rows) : null,
    peak,
    points: src.births.map((p) => ({ year: p.year, value: p.value, x: xOf(p.year), y: yOf(p.value) })),
    step,
    gen: { name, range: `${from}~${to}년생`, from, to },
    big: avg === null ? null : { value: manText(avg), unit: TXT.unit },
    bigSub: `${TXT.bigLabel} · ${avg === null ? TXT.since(first) : `${rows[0].year}~${rows[rows.length - 1].year}년`}`,
    age: `${now - to}~${now - from}세`,
    life: lifeA === null || lifeB === null ? null : { value: `${lifeA.value.toFixed(1)}~${lifeB.value.toFixed(1)}세`, sub: `${lifeA.year}·${lifeB.year}년생` },
    lifeNone: TXT.since(first),
    table,
    tableCaption: TXT.tableCaption(all ? `${GEN_CHART_Y0}~${GEN_CHART_Y1}년생` : `${name} ${from}~${to}년생`),
    readName,
  };
}

/** 이 해(가장 가까운 정수 연도)의 점. 그래프 영역 밖이거나 자료가 없는 해는 null */
export function nearestPoint(model: GenChartModel, plotX: number): GenChartPoint | null {
  const year = Math.round(GEN_CHART_Y0 + (plotX - model.L) / model.step);
  return model.points.find((p) => p.year === year) ?? null;
}

/** 슬라이드 읽기 이름의 앞부분 재료: 데이터 범위 「출생아 수(1970~2020년)」 */
export function genChartOfficial(src: GenChartSource): string {
  return TXT.official(firstDataYear(src), src.births[src.births.length - 1].year);
}

/** 출처 줄 두 문장 (copy.md 16-12) */
export function genChartSourceText(src: GenChartSource): { lead: string; tail: string } {
  return TXT.source({ org: src.org, birthsFrom: firstDataYear(src), birthsTo: src.births[src.births.length - 1].year, lifeFrom: src.life[0].year, lifeTo: src.life[src.life.length - 1].year, accessedOn: src.accessedOn, firstData: firstDataYear(src) });
}
