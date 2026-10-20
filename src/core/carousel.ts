import {
  createStatsAccess,
  formatBasisLine,
  formatHeadlines,
  formatNumber,
  formatWithUnit,
  getCarouselIndicators,
  type Point,
  type StatsFile,
  type UsableIndicator,
} from '../data/koreaStatsAccess';
import { STAT_HEADLINES } from '../data/statHeadlines';

/**
 * 한국 사회 통계 캐러셀의 슬라이드 모델과 동작 규칙 (SPEC-003 SC1~SC7). 모두 순수 함수라 React 없이 단위 테스트한다.
 * 값은 `data/koreaStatsAccess.ts`(koreaStats.json을 읽는 유일한 통로 — `usable:false`·미확인 항목은 거기서 이미 빠진다)가 주고,
 * 이 파일은 그것을 화면 모양(글자·좌표)으로 바꾼다. 그림은 SVG 직접 구현이다(SC7: 차트 라이브러리 없음) — 좌표까지 여기서 계산하고 ui/StatsChart.tsx는 그리기만 한다.
 * 슬라이드에는 평가·논평 문구를 넣지 않는다: 지표 이름, 값+단위, 기준 연도, 출처, 한 줄 정의, 그래프만(SC2).
 */

// ---------- 동작 규칙 (SC5) ----------

/** 자동 전환 주기(밀리초). SPEC-003 ▲ 7초 → SPEC-005 마스터 결정 M8(표제어·공식 통계명이 늘어 읽을 글이 많아졌다): 9초. */
export const AUTO_ADVANCE_MS = 9000;

/** 이전(-1)/다음(+1)으로 한 칸 이동. 끝에서는 반대쪽 끝으로 돈다. 슬라이드가 없으면 0. */
export function nextSlideIndex(index: number, count: number, step: 1 | -1): number {
  if (!Number.isInteger(count) || count <= 0) return 0;
  const base = Number.isInteger(index) ? ((index % count) + count) % count : 0;
  return (base + step + count) % count;
}

/** 자동 전환이 돌아야 하는가. 사용자가 멈췄거나, 포인터가 올라가 있거나, 포커스가 안에 있거나, 움직임 줄이기이거나, 탭이 가려졌거나, 볼 슬라이드가 하나뿐이면 멈춘다(WCAG 2.2.2). */
export function shouldAutoAdvance(s: { count: number; paused: boolean; hovering: boolean; focusWithin: boolean; reducedMotion: boolean; pageHidden: boolean }): boolean {
  return s.count > 1 && !s.paused && !s.hovering && !s.focusWithin && !s.reducedMotion && !s.pageHidden;
}

/**
 * 이 포인터가 「카드 위에 있다」(자동 전환 정지 사유 ⓑ)로 세어지는가 (QM2-2 I4). 마우스·펜은 세고, 터치는 세지 않는다 —
 * 손가락은 화면에서 떼면 곧 없어지므로 탭·스와이프 뒤에 「올라가 있는」 상태가 남으면 자동 전환이 멈춘 채 남는다. 모르는 종류는 마우스처럼 본다.
 */
export function pointerCountsAsHover(pointerType: string): boolean {
  return pointerType !== 'touch';
}

/** 터치 스와이프 판정: 가로로 임계값 이상 움직였고 세로 움직임보다 클 때만 넘긴다(세로 스크롤은 그대로). 왼쪽으로 밀면 다음(+1). */
export function swipeStep(dx: number, dy: number, threshold = 40): 1 | -1 | null {
  if (!Number.isFinite(dx) || !Number.isFinite(dy)) return null;
  if (Math.abs(dx) < threshold || Math.abs(dx) <= Math.abs(dy)) return null;
  return dx < 0 ? 1 : -1;
}

/**
 * 페이지 점은 슬라이드가 이 수 이하일 때만 그린다(R-133 마스터 결정, designer 문구 기준표): 점이 많으면 두 줄로 꺾이거나 누르기 어렵게 작아지므로,
 * 그보다 많으면 「3 / 14」 위치 표기와 이전·다음 버튼·방향키·스와이프로 넘긴다.
 */
export const CAROUSEL_MAX_DOTS = 5;

export function showDots(count: number): boolean {
  return count >= 2 && count <= CAROUSEL_MAX_DOTS;
}

/** 점 버튼의 접근 가능한 이름 (SC5): 「3/5 한 여성이 평생 낳을 아이는 몇 명일까?」 — 이름은 슬라이드의 표제어(SPEC-005 SH1) */
export function dotLabel(index: number, count: number, title: string): string {
  return `${index + 1}/${count} ${title}`;
}

// ---------- 슬라이드 모델 ----------

export type Dash = 'solid' | 'dashed' | 'dotted';

export interface LinePoint {
  x: number;
  y: number;
  year: number;
  value: number;
  text: string;
}

export interface ChartLabel {
  x: number;
  y: number;
  text: string;
  anchor: 'start' | 'middle' | 'end';
  bold: boolean;
}

export interface LineSeriesModel {
  key: string;
  label: string;
  dash: Dash;
  /** 조사 방법이 바뀐 연도(axis.breaks)에서 나뉜 선분들. 연도 간격이 일정하지 않아도 x는 연도에 비례한다. */
  segments: LinePoint[][];
  points: LinePoint[];
  first: LinePoint;
  last: LinePoint;
}

export interface LineChartModel {
  kind: 'line';
  width: number;
  height: number;
  /** 그래프 영역의 왼쪽·오른쪽 x (오른쪽 바깥은 마지막 값 글자 자리) */
  plotLeft: number;
  plotRight: number;
  /** 가로 보조선 y 좌표 */
  grid: number[];
  axisY: number;
  xLabels: ChartLabel[];
  labels: ChartLabel[];
  series: LineSeriesModel[];
}

export interface BarRowModel {
  label: string;
  fullLabel: string;
  value: number;
  text: string;
  /** 단위를 붙인 값(「13,777,186명」) — 그래프 밖 표(R-207)가 읽는다 */
  valueWithUnit: string;
  y: number;
  barWidth: number;
}

export interface BarChartModel {
  kind: 'bar';
  width: number;
  height: number;
  rowHeight: number;
  labelWidth: number;
  barX: number;
  rows: BarRowModel[];
}

export interface SlideLegendItem {
  key: string;
  label: string;
  dash: Dash;
  valueText: string;
}

export interface SlideSafety {
  name: string;
  number: string;
  hours: string;
}

export interface SlideHeadline {
  /** 값이 무엇인지(「남자」「여자」). 값이 하나뿐이면 null */
  label: string | null;
  /** 숫자 글자(천 단위 쉼표·공식 표기 자릿수) */
  value: string;
}

/**
 * 큰 값 아래 줄에 따로 보이는 보조 계열의 값 (QM2-11, R-230): 슬라이드 제목에 이름이 든 보조 계열이 그래프에 겹쳐 그려지지 않을 때(단위가 달라 같은 축에 못 둔다) 값을 글자로 보인다.
 * 예) 「혼인 건수와 조혼인율」 슬라이드의 `조혼인율 인구 1천 명당 4.7건`. 선 무늬(범례)는 없다.
 */
export interface SlideSideValue {
  /** 이름: 데이터 라벨의 괄호 풀이를 뺀 것(「조혼인율(인구 1천 명당 건)」 → 「조혼인율」) — 분모·단위는 `formatWithUnit`이 붙인다 */
  name: string;
  /** 단위를 붙인 값 — `formatWithUnit` 어순: 「인구 1천 명당 4.7건」 */
  valueText: string;
  /** 화면에 보이는 한 줄: 「조혼인율 인구 1천 명당 4.7건」 */
  text: string;
}

export interface CarouselSlide {
  id: string;
  /** 지표 이름(데이터의 `title`). 표제어가 아니다 — 막대 그래프 표 캡션·그래프 대체 글에 쓴다 */
  title: string;
  /** 표제어(SH1·SH2): 인사이트형 질문, `data/statHeadlines.ts`. 슬라이드의 제목(`h3`)이다 */
  insight: string;
  /** 공식 통계명(SH3): 기관이 쓰는 이름 — 「합계출산율」 */
  officialName: string;
  /** 공식 통계명 줄 글자(SH3): 「합계출산율(2025년)」 — 기준은 `latest.year`(월 기준·범위 지표는 데이터의 범위 문구)에서만 만든다(SC4 단일 출처) */
  officialText: string;
  /** 큰 글씨 값들(남자·여자처럼 두 값이면 둘). 막대 그래프 중 전국 값이 따로 적히지 않은 것은 빈 배열 */
  headlines: SlideHeadline[];
  /** 큰 글씨 값 하나(첫째). 값이 없으면 null */
  valueText: string | null;
  /** 값 바로 옆 칸: **단위 낱말 하나**(명·%·세·년·건…). 「인구 10만 명당」 같은 분모 문구는 여기가 아니라 기준 줄(basisText)에 있다(QM2-4) */
  unitText: string;
  /**
   * 기준 줄(QM2-4 → SPEC-005 copy.md 9-2): 연도만 있던 줄(「2025년 기준」)은 없앴다 — 공식 통계명 줄(`officialText`)이 같은 값을 말한다.
   * 분모가 있는 비율(조사망률·자살률)만 분모 「인구 1천 명당」이 남는다(B형). 없으면 null이고 줄을 그리지 않는다.
   * 슬라이드 안의 기준 연도(공식 통계명 줄·「통계 기준」 줄·그래프 마지막 점)는 모두 같은 값 `latest.year`에서 만든다.
   */
  basisText: string | null;
  /** 값 위 설명(예: 「2026년 9월 전국 주민등록 인구」) */
  caption: string | null;
  definition: string;
  /** 「국가데이터처, 2025년 출생 통계 통계표 1 …(2026-10-15 조회)」 — 기관, 통계표 이름, 열람일 */
  sourceText: string;
  /** 「통계 기준: 2025년 · 마지막 갱신 2026-10-15」 (SC4) */
  basisLine: string;
  chart: LineChartModel | BarChartModel;
  /** 그래프의 대체 텍스트 */
  chartLabel: string;
  legend: SlideLegendItem[];
  /** 범례가 하나뿐일 때 보이는 계열 설명(예: 「혼인 건수(건, 혼인신고 기준)」) */
  seriesNote: string | null;
  /** 큰 값 아래 줄의 보조 계열 값(제목에 이름이 든 것 중 그래프에 안 그려진 것). 없으면 빈 배열 */
  sideValues: SlideSideValue[];
  safety: SlideSafety | null;
}

/**
 * 데이터의 단위 문자열(`latestUnit`)을 「값 바로 옆 단위 낱말」과 「분모 문구」로 나눈다(QM2-4): 「인구 10만 명당 명」 → 분모 「인구 10만 명당」, 단위 「명」.
 * 분모가 없으면(`%`·`명`·`세`·`천 명`…) 분모는 null이고 단위는 그대로다. 데이터 형식은 그대로 두고(formatWithUnit이 「인구 1천 명당 7.1명」을 만드는 데 쓴다) 화면 쪽에서만 나눈다.
 */
export function splitUnit(unit: string): { denominator: string | null; word: string } {
  const m = /^(인구 .+당) (.+)$/.exec(unit);
  return m === null ? { denominator: null, word: unit } : { denominator: m[1], word: m[2] };
}

/**
 * 큰 값 글자의 폭을 글자 크기(em) 단위로 어림한다 — 숫자는 같은 폭(tabular-nums)이라 0.62em, 쉼표·소수점은 0.32em, 그 밖은 1em.
 * 화면은 이 값으로 큰 글자 크기를 칸 폭에 맞춰 줄여(CSS `min(var(--fs-3xl), 칸 폭 / 이 값)`), 글자 크기를 200%로 키워도 숫자가 중간에서 줄바꿈되거나 칸을 넘치지 않게 한다(CM11, QM2-5).
 */
export function valueWidthEm(valueText: string): number {
  let em = 0;
  for (const ch of valueText) em += ch >= '0' && ch <= '9' ? 0.62 : ch === ',' || ch === '.' ? 0.32 : 1;
  return Math.round(em * 100) / 100;
}

/** 이름에서 끝의 괄호 풀이를 뺀다: 「조혼인율(인구 1천 명당 건)」 → 「조혼인율」, 「혼인 건수(건, 혼인신고 기준)」 → 「혼인 건수」 (QM2-11 규칙 3) */
export function bareName(label: string): string {
  return label.replace(/\s*\([^)]*\)\s*$/, '').trim();
}

/** 제목에 이름이 든 지표 하나 (QM2-11 규칙 3: 본 계열과 보조 계열) */
export interface TitleIndicator {
  /** 이름(괄호 풀이를 뺀 것) */
  name: string;
  kind: 'main' | 'extra';
  /** 보조 계열이면 `extraSeries`에서의 순서 */
  extraIndex: number | null;
  /** 최신 값을 `formatWithUnit`으로 쓴 글자: 「240,326건」「인구 1천 명당 4.7건」 */
  valueText: string;
  /** 눈에 보이는 값 줄에 있어야 하는 글자 = 숫자 + 단위 낱말: 「240,326건」「4.7건」 (분모 문구는 기준 줄·앞 문장에 따로 있다) */
  valueGlyph: string;
  /** 이 값의 기준 연도(보조 계열이 자기 `latest.year`를 가진 경우). 지표의 기준 연도와 다르면 화면 글자에 연도를 밝힌다 */
  year: number | null;
}

/**
 * 슬라이드 제목에 **이름이 부분 문자열로 든** 지표들 (QM2-11 규칙 3). 본 계열은 지표 자신이라 이름이 지표 제목이고(그래서 늘 든다 — 제목이 약속하는 첫 값은 본 계열의 최신 값이다),
 * 보조 계열(`extraSeries`)은 라벨의 괄호 풀이를 뺀 이름이 제목에 부분 문자열로 들어 있을 때만 든다(예: 「혼인 건수와 조혼인율」의 「조혼인율」).
 * 제목이 이름을 약속한 지표는 그 값이 같은 화면의 눈에 보이는 글자에 있어야 한다 — 테스트(단위·e2e)가 이 목록으로 검사한다.
 */
export function titleIndicators(ind: UsableIndicator): TitleIndicator[] {
  const out: TitleIndicator[] = [];
  const push = (label: string, kind: 'main' | 'extra', extraIndex: number | null, value: number, unit: string, decimals: number, year: number | null) => {
    const name = bareName(label);
    if (name === '' || !ind.title.includes(name)) return;
    out.push({ name, kind, extraIndex, valueText: formatWithUnit(value, unit, decimals), valueGlyph: `${formatNumber(value, decimals)}${splitUnit(unit).word}`, year });
  };
  push(ind.title, 'main', null, ind.latest.value, ind.latestUnit, ind.decimals, ind.latest.year);
  (ind.extraSeries ?? []).forEach((e, n) => {
    const last = e.latest?.value ?? lastValueOf(e.series);
    if (last === null) return;
    push(e.label, 'extra', n, last, e.unit ?? ind.unit ?? ind.latestUnit, e.decimals ?? ind.decimals, e.latest?.year ?? null);
  });
  return out;
}

function lastValueOf(series: readonly Point[]): number | null {
  for (let k = series.length - 1; k >= 0; k--) if (Number.isFinite(series[k].value)) return series[k].value;
  return null;
}

/** 같은 단위로 겹쳐 그려도 되는 보조 계열을 가진 지표 (사교육 참여율의 사교육비처럼 단위가 다른 보조 계열이 있는 지표는 제외) */
const EXTRA_SERIES_IDS: readonly string[] = ['elderly-poverty', 'life-expectancy', 'first-marriage-age', 'youth-employment'];

/** 막대 그래프 라벨이 긴 행정구역 이름의 짧은 표기 (대체 텍스트에는 전체 이름) */
const SHORT_LABELS: Readonly<Record<string, string>> = { 전남광주통합특별시: '전남광주', 전남광주: '전남광주' };

const DASHES: readonly Dash[] = ['solid', 'dashed', 'dotted'];

/**
 * 그래프 좌표계: SVG viewBox의 한 칸이 화면의 1px이 되도록 **실제 그려지는 폭**(`width`)으로 좌표를 만든다(REV-003-M2-1 R-206).
 * 320 고정 viewBox를 카드 폭에 맞춰 줄이면 320px 화면에서 글자가 10px대로 작아졌다 — 폭에 맞춰 만들면 글자(13px)가 어느 폭에서나 같은 크기로 그려진다.
 * 폭을 모를 때(서버 렌더·첫 그림·단위 테스트)는 LINE_W(320).
 */
export const LINE_W = 320;
/**
 * 선 그래프의 높이. 넓은 화면(캐러셀이 오른쪽 열, 카드 높이가 슬라이드마다 다르다)에서는 카드가 하단 띠 위에 들어가도록 낮게(LINE_H),
 * 좁은 화면(한 칸 레이아웃, 모든 슬라이드가 가장 큰 슬라이드의 높이를 나눠 쓴다)에서는 높게(LINE_H_STACKED) 그린다 — 짧은 슬라이드의 빈 칸이 그래프로 채워진다(R-200).
 */
export const LINE_H = 180;
export const LINE_H_STACKED = 232;
/** 그래프 폭의 허용 범위: 이보다 좁으면 값 글자가 겹치고, 이보다 넓으면 선이 늘어진다 */
export const CHART_MIN_W = 220;
export const CHART_MAX_W = 520;

/** 그래프를 그릴 크기: 좌표계 폭(= 화면에 그려지는 폭)과 선 그래프의 높이 */
export interface ChartSize {
  width: number;
  lineHeight: number;
}
export const DEFAULT_CHART_SIZE: ChartSize = { width: LINE_W, lineHeight: LINE_H };

/** 화면에 그려지는 폭(px)과 레이아웃 → 그래프 크기. 폭은 4px 단위로 맞춰 창 크기를 조금 바꿀 때마다 다시 만들지 않는다. */
export function chartSizeFor(containerPx: number, wideLayout: boolean): ChartSize {
  const width = Number.isFinite(containerPx) ? Math.min(CHART_MAX_W, Math.max(CHART_MIN_W, Math.floor(containerPx / 4) * 4)) : LINE_W;
  return { width, lineHeight: wideLayout ? LINE_H : LINE_H_STACKED };
}
const PAD = { left: 8, right: 66, top: 24, bottom: 30 };
const LABEL_GAP = 13;

/** 값 글자(CSS .chart text, 13px) 한 줄이 차지하는 칸: 글자 위쪽(ascent)·아래쪽(descent) */
const LABEL_ASCENT = 11;
const LABEL_DESCENT = 3;
/** 값 글자 폭 추정(13px 한글 시스템 글꼴의 숫자·점 폭을 넉넉하게). 그래프 안 글자는 숫자·소수점·쉼표뿐이다. */
export function estimateLabelWidth(text: string, bold: boolean): number {
  let w = 0;
  for (const ch of text) w += ch >= '0' && ch <= '9' ? (bold ? 8.2 : 7.8) : ch === '.' || ch === ',' ? 4.2 : 13;
  return Math.ceil(w) + 1;
}

export interface Rect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/** 시작점 기준(anchor start) 값 글자가 baseline y에 놓일 때 차지하는 사각형 */
export function labelRect(x: number, baselineY: number, text: string, bold = false): Rect {
  return { left: x, top: baselineY - LABEL_ASCENT, right: x + estimateLabelWidth(text, bold), bottom: baselineY + LABEL_DESCENT };
}

const rectsOverlap = (a: Rect, b: Rect): boolean => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;

/** 선분 (x1,y1)-(x2,y2)이 사각형(경계 포함)과 만나는가 — 끝점이 안에 있거나 네 변 중 하나와 교차 */
export function segmentHitsRect(x1: number, y1: number, x2: number, y2: number, r: Rect): boolean {
  const inside = (x: number, y: number) => x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
  if (inside(x1, y1) || inside(x2, y2)) return true;
  if (Math.max(x1, x2) < r.left || Math.min(x1, x2) > r.right || Math.max(y1, y2) < r.top || Math.min(y1, y2) > r.bottom) return false;
  const cross = (ax: number, ay: number, bx: number, by: number, cx: number, cy: number) => (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
  const crosses = (cx: number, cy: number, dx: number, dy: number) => {
    const d1 = cross(x1, y1, x2, y2, cx, cy);
    const d2 = cross(x1, y1, x2, y2, dx, dy);
    const d3 = cross(cx, cy, dx, dy, x1, y1);
    const d4 = cross(cx, cy, dx, dy, x2, y2);
    return d1 * d2 <= 0 && d3 * d4 <= 0;
  };
  return crosses(r.left, r.top, r.right, r.top) || crosses(r.right, r.top, r.right, r.bottom) || crosses(r.right, r.bottom, r.left, r.bottom) || crosses(r.left, r.bottom, r.left, r.top);
}

/** 선 그래프의 선·점(그려지는 모양 그대로: 선 두께·점 반지름 + 여유 1칸)을 사각형으로 모아 둔다 — 값 글자가 피해야 하는 곳 */
function lineObstacles(series: readonly LineSeriesModel[]): { segments: Array<[number, number, number, number]>; markers: Rect[] } {
  const segments: Array<[number, number, number, number]> = [];
  const markers: Rect[] = [];
  for (const s of series) {
    for (const seg of s.segments) for (let k = 1; k < seg.length; k++) segments.push([seg[k - 1].x, seg[k - 1].y, seg[k].x, seg[k].y]);
    const dots = s.points.length <= 20 ? s.points : [s.last];
    for (const p of dots) {
      const r = (p === s.last ? 4.5 : 3) + 2.5; // 점 반지름 + 점 테두리·여유
      markers.push({ left: p.x - r, top: p.y - r, right: p.x + r, bottom: p.y + r });
    }
  }
  return { segments, markers };
}

/**
 * 계열마다 「처음 값」 글자를 둘 자리를 고른다(REV-003-M2-2 R-225). 점 위쪽이 기본이지만 선이 오른쪽 위로 올라가면 그 위쪽 자리를 지나가므로
 * (320px 초혼 연령 그래프에서 「27.7」에 선이 걸렸다) 후보 자리를 차례로 보고 **어떤 선·점·이미 놓은 다른 글자와도 겹치지 않고 그래프 영역 안에 있는 첫 자리**를 쓴다.
 * 후보(점 y 기준 글자 baseline 오프셋): 위 -8 → 아래 +18 → 위 한 칸 더 -21 → 아래 한 칸 더 +31. 어디도 안 되면 겹침이 가장 적은 자리(같으면 앞선 후보).
 * 위치가 위에서 아래로 가까운 계열부터 놓아 두 계열이 서로 밀어내며 자리를 나눈다. 순수 계산이라 단위 테스트가 겹침 0을 직접 확인한다.
 */
export function placeFirstLabels(series: readonly LineSeriesModel[], lineHeight: number, axisY: number): Map<string, ChartLabel> {
  const { segments, markers } = lineObstacles(series);
  const placed: Rect[] = [];
  const out = new Map<string, ChartLabel>();
  const order = series.filter((s) => s.first.x !== s.last.x).sort((a, b) => a.first.y - b.first.y);
  const OFFSETS = [-8, 18, -21, 31];
  for (const s of order) {
    const x = s.first.x;
    let best: { y: number; cost: number } | null = null;
    for (const dy of OFFSETS) {
      const y = round1(s.first.y + dy);
      const r = labelRect(x, y, s.first.text);
      // 겹침의 무게(QM2-8): 다른 글자·점(마커)과 겹치는 것은 어떤 경우에도 피하고(글자 위의 글자는 읽히지 않는다), 자기 선과 겹치는 것만 마지막 수단으로 허용한다 —
      // 선과는 겹쳐도 글자 뒤 카드 바탕색 테두리(CSS paint-order)가 읽히게 하지만 글자끼리는 테두리로도 못 읽는다.
      let cost = 0;
      if (r.top < 1 || r.bottom > Math.min(lineHeight - 1, axisY - 1)) cost += 100_000; // 그래프 영역 밖(위쪽 가장자리·가로축 아래)
      for (const [x1, y1, x2, y2] of segments) if (segmentHitsRect(x1, y1, x2, y2, r)) cost += 1;
      for (const m of markers) if (rectsOverlap(r, m)) cost += 1_000;
      for (const o of placed) if (rectsOverlap(r, o)) cost += 10_000;
      if (best === null || cost < best.cost) best = { y, cost };
      if (cost === 0) break;
    }
    const y = best!.y;
    placed.push(labelRect(x, y, s.first.text));
    out.set(s.key, { x, y, text: s.first.text, anchor: 'start', bold: false });
  }
  return out;
}

const round1 = (n: number): number => Math.round(n * 10) / 10;

/** 세로로 겹치는 라벨을 위아래로 벌린다(입력 순서대로 돌려준다). 최소 간격 gap, 범위 [lo, hi]. */
export function spreadY(ys: readonly number[], gap: number, lo: number, hi: number): number[] {
  const order = ys.map((y, i) => ({ y, i })).sort((a, b) => a.y - b.y || a.i - b.i);
  const out = order.map((o) => Math.min(hi, Math.max(lo, o.y)));
  for (let k = 1; k < out.length; k++) if (out[k] - out[k - 1] < gap) out[k] = out[k - 1] + gap;
  if (out.length > 0 && out[out.length - 1] > hi) {
    out[out.length - 1] = hi;
    for (let k = out.length - 2; k >= 0; k--) out[k] = Math.min(out[k], out[k + 1] - gap);
  }
  const result = new Array<number>(ys.length);
  order.forEach((o, k) => {
    result[o.i] = out[k];
  });
  return result;
}

function breakYears(ind: UsableIndicator): Set<number> {
  const set = new Set<number>();
  for (const b of ind.axis?.breaks ?? []) if (Number.isInteger(b.year)) set.add(b.year);
  return set;
}

function yearPoints(series: readonly Point[]): Array<{ year: number; value: number }> {
  const out: Array<{ year: number; value: number }> = [];
  for (const p of series) if ('year' in p && Number.isInteger(p.year) && Number.isFinite(p.value)) out.push({ year: p.year, value: p.value });
  return out.sort((a, b) => a.year - b.year);
}

function buildLineChart(ind: UsableIndicator, { width, lineHeight }: ChartSize): { chart: LineChartModel; legend: SlideLegendItem[]; label: string } | null {
  const mainPts = yearPoints(ind.series ?? []);
  if (mainPts.length < 2) return null;
  const defs: Array<{ key: string; label: string; pts: Array<{ year: number; value: number }> }> = [{ key: 'main', label: ind.seriesLabel ?? ind.title, pts: mainPts }];
  if (EXTRA_SERIES_IDS.includes(ind.id)) {
    for (const [n, e] of (ind.extraSeries ?? []).entries()) {
      if (e.unit !== undefined && e.unit !== ind.unit) continue; // 단위가 다른 계열은 같은 축에 겹치지 않는다
      const pts = yearPoints(e.series);
      if (pts.length >= 2 && defs.length < DASHES.length) defs.push({ key: `extra-${n}`, label: e.label, pts });
    }
  }
  const all = defs.flatMap((d) => d.pts);
  const minYear = Math.min(...all.map((p) => p.year));
  const maxYear = Math.max(...all.map((p) => p.year));
  let lo = Math.min(...all.map((p) => p.value));
  let hi = Math.max(...all.map((p) => p.value));
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
  const breaks = breakYears(ind);
  const text = (v: number) => formatNumber(v, ind.decimals);

  const series: LineSeriesModel[] = defs.map((d, n) => {
    const points: LinePoint[] = d.pts.map((p) => ({ x: xOf(p.year), y: yOf(p.value), year: p.year, value: p.value, text: text(p.value) }));
    const segments: LinePoint[][] = [];
    for (const pt of points) {
      const cur = segments[segments.length - 1];
      if (cur === undefined || breaks.has(pt.year)) segments.push([pt]);
      else cur.push(pt);
    }
    return { key: d.key, label: d.label, dash: DASHES[n], segments, points, first: points[0], last: points[points.length - 1] };
  });

  // 값 라벨: 각 계열의 마지막(점 오른쪽, 세로로 겹치면 벌린다)과 처음(선·점·다른 글자와 겹치지 않는 자리, placeFirstLabels).
  const grid = [0, 0.5, 1].map((t) => round1(PAD.top + t * plotH));
  const axisY = round1(PAD.top + plotH);
  const lastYs = spreadY(series.map((s) => s.last.y + 4), LABEL_GAP, PAD.top, lineHeight - PAD.bottom);
  const firstLabels = placeFirstLabels(series, lineHeight, axisY);
  const labels: ChartLabel[] = [];
  series.forEach((s, n) => {
    labels.push({ x: s.last.x + 8, y: round1(lastYs[n]), text: s.last.text, anchor: 'start', bold: true });
    // 처음 값이 마지막과 같은 자리(점 하나뿐)가 아닐 때만
    const first = firstLabels.get(s.key);
    if (first !== undefined) labels.push(first);
  });
  const xLabels: ChartLabel[] = [
    { x: xOf(minYear), y: lineHeight - 8, text: String(minYear), anchor: 'start', bold: false },
    { x: xOf(maxYear), y: lineHeight - 8, text: String(maxYear), anchor: 'end', bold: false },
  ];
  const withUnit = (v: number) => formatWithUnit(v, ind.unit ?? ind.latestUnit, ind.decimals);
  const legend: SlideLegendItem[] = series.map((s) => ({ key: s.key, label: s.label, dash: s.dash, valueText: withUnit(s.last.value) }));
  const parts = series.map((s) => `${s.label} 처음 ${withUnit(s.first.value)}(${s.first.year}년), 마지막 ${withUnit(s.last.value)}(${s.last.year}년)`);
  const label = `${minYear}년부터 ${maxYear}년까지 ${ind.title} 추이 그래프. ${parts.join('. ')}`;
  return { chart: { kind: 'line', width, height: lineHeight, plotLeft: PAD.left, plotRight: width - PAD.right, grid, axisY, xLabels, labels, series }, legend, label };
}

export const BAR_ROW_H = 15;
const BAR_LABEL_W = 56;
const BAR_VALUE_W = 84;

function buildBarChart(ind: UsableIndicator, { width }: ChartSize): { chart: BarChartModel; label: string } | null {
  const raw = (ind.series ?? []).filter((p): p is { label: string; value: number } => 'label' in p && typeof p.label === 'string' && Number.isFinite(p.value));
  if (raw.length < 2) return null;
  const sorted = [...raw].sort((a, b) => b.value - a.value);
  const max = sorted[0].value;
  const barX = BAR_LABEL_W + 6;
  const maxBar = width - barX - BAR_VALUE_W;
  const withUnit = (v: number) => formatWithUnit(v, ind.unit ?? ind.latestUnit, ind.decimals);
  const rows: BarRowModel[] = sorted.map((p, k) => ({
    label: SHORT_LABELS[p.label] ?? p.label,
    fullLabel: p.label,
    value: p.value,
    text: formatNumber(p.value, ind.decimals),
    valueWithUnit: withUnit(p.value),
    y: k * BAR_ROW_H + 2,
    barWidth: max > 0 ? Math.max(2, round1((p.value / max) * maxBar)) : 2,
  }));
  const top = sorted[0];
  const bottom = sorted[sorted.length - 1];
  const label = `${ind.title} 막대 그래프(큰 값부터). 가장 큰 값 ${top.label} ${withUnit(top.value)}, 가장 작은 값 ${bottom.label} ${withUnit(bottom.value)}`;
  return { chart: { kind: 'bar', width, height: rows.length * BAR_ROW_H + 4, rowHeight: BAR_ROW_H, labelWidth: BAR_LABEL_W, barX, rows }, label };
}

/** 기관 이름 목록 (「국가데이터처·교육부」처럼 가운뎃점으로 묶인 것을 나눈다) */
export function sourceOrgsOf(org: string): string[] {
  return org
    .split(/[·,/]/)
    .map((x) => x.trim())
    .filter((x) => x !== '');
}

/** 자살예방 상담전화 안내가 갖춰졌는가 (SC6: 번호가 확인되기 전에는 자살률 슬라이드를 쓰지 않는다 — C10) */
function hasHelpLine(i: UsableIndicator): boolean {
  const h = i.helpLine;
  return h !== undefined && typeof h.number === 'string' && /^\d{2,5}(-\d{3,4})?$/.test(h.number) && typeof h.hours === 'string' && h.hours.length > 0 && typeof h.name === 'string' && h.name.length > 0;
}

/** 캐러셀에 그릴 수 있는 지표인가: 선·막대 종류, 계열 2개 이상, 안전 규칙(상담전화) 충족. */
export function isDrawable(i: UsableIndicator): boolean {
  if (i.kind !== 'line' && i.kind !== 'bar') return false;
  if (!Array.isArray(i.series) || i.series.length < 2 || !i.series.every((p) => Number.isFinite(p.value))) return false;
  return i.safety !== 'suicide-help' || hasHelpLine(i);
}

/** 캐러셀 지표 목록(순서 확정): 접근자가 준 `use: carousel` 확인 지표 중 그릴 수 있는 것. file을 주면 그 데이터로(테스트용). */
export function selectCarouselIndicators(file?: StatsFile): UsableIndicator[] {
  const list = file === undefined ? getCarouselIndicators() : createStatsAccess(file).getCarouselIndicators();
  return list.filter(isDrawable);
}

const SCOPE_LABEL = /^(\d{4}년(?: \d{1,2}월)?) 기준(?:\((.+)\))?$/;

/**
 * 공식 통계명 줄의 기준 괄호 안 글자 (SH3, SC4 단일 출처): 보통은 `latest.year` — 「2025년」. 월 기준 지표(지역별 주민등록 인구수)는 데이터의 범위 문구(`scopeLabel`: 「2026년 9월 기준(16개 시·도, 주민등록)」)의
 * 앞부분 「2026년 9월」이다. `withScope`이면 범위 문구의 괄호 안 설명 **첫 항목만** 쉼표로 덧붙인다(시·도별 합계출산율: 「2025년, 17개 시·도」 — 옛 기준 줄 「2025년 기준(17개 시·도)」을 대신한다.
 * 지역별 주민등록 인구수: 「2026년 9월, 16개 시·도」 — 「주민등록」은 공식 통계명에 이미 있어 겹치지 않게 뺀다, R-446 b).
 * 범위 문구를 읽을 수 없는 모양이면 `latest.year`로 돌아간다.
 */
export function officialBasisOf(ind: Pick<UsableIndicator, 'latest' | 'scopeLabel'>, withScope: boolean): string {
  const m = ind.scopeLabel !== undefined ? SCOPE_LABEL.exec(ind.scopeLabel) : null;
  const when = m === null ? `${ind.latest.year}년` : m[1];
  return withScope && m !== null && m[2] !== undefined ? `${when}, ${m[2].split(',')[0].trim()}` : when;
}

/** 지표 하나 → 슬라이드. 그릴 수 없는 지표(계열 부족 등)는 null. size는 그래프를 그릴 크기(chartSizeFor). */
export function buildSlide(ind: UsableIndicator, updatedOn?: string, size: ChartSize = DEFAULT_CHART_SIZE): CarouselSlide | null {
  const isBar = ind.kind === 'bar';
  const built = isBar ? buildBarChart(ind, size) : buildLineChart(ind, size);
  if (built === null) return null;
  const legend = 'legend' in built ? built.legend : [];
  const seriesNote = !isBar && legend.length === 1 && ind.seriesLabel !== undefined && ind.seriesLabel !== '' && ind.seriesLabel !== ind.title ? ind.seriesLabel : null;
  const help = ind.safety === 'suicide-help' ? ind.helpLine : undefined;
  // 막대 그래프(시·도)는 전국 값이 따로 적혀 있을 때만(latestLabel) 큰 글씨로 보인다.
  const showValue = !isBar || (ind.latestLabel !== undefined && ind.latestLabel !== '');
  const headlines: SlideHeadline[] = showValue ? formatHeadlines(ind).map((h, _i, all) => ({ label: all.length > 1 ? h.label : null, value: h.value })) : [];
  // 값 옆 칸은 단위 낱말 하나, 분모 문구(「인구 10만 명당」)는 기준 줄로(QM2-4). 기준 연도는 공식 통계명 줄(officialText)이 말한다(SPEC-005 SH3 — 시·도 그래프의 범위 문구 「17개 시·도」도 그 괄호 안,
  // 통계 근거 검수 R-147 d·copy.md 9-1 #14). 연도는 모두 latest.year(월 기준·범위 지표는 데이터의 범위 문구)에서만 만든다.
  // 큰 값 아래 줄: 제목에 이름이 든 보조 계열 중 그래프(범례)에 안 그려진 것 — 값을 글자로 보인다(QM2-11, R-230). 이름 + 분모 문구 + 값 + 단위(`formatWithUnit` 어순), 선 무늬 없음.
  const drawn = new Set(legend.map((l) => l.key));
  const sideValues: SlideSideValue[] = titleIndicators(ind)
    .filter((t) => t.kind === 'extra' && t.extraIndex !== null && !drawn.has(`extra-${t.extraIndex}`))
    // 보조 계열의 기준 연도가 슬라이드의 기준 연도(latest.year)와 다르면 그 값의 연도를 글자로 밝힌다(QM2-4 규칙 4: 기준 줄은 슬라이드 한 값만 가리킨다)
    .map((t) => ({ name: t.name, valueText: t.valueText, text: `${t.name} ${t.valueText}${t.year !== null && t.year !== ind.latest.year ? ` (${t.year}년 기준)` : ''}` }));
  const { denominator, word } = splitUnit(ind.latestUnit);
  // 표제어·공식 통계명(SH1~SH3): 데이터 파일은 건드리지 않고 data/statHeadlines.ts에서 가져온다. 항목이 없는 지표(새 지표·시험용 가짜 지표)는 지표 이름으로 대신한다 —
  // 그래도 슬라이드는 뜨고, 모든 캐러셀 지표에 항목이 있는지는 tests/statHeadlines.test.ts가 잡는다.
  const headline = STAT_HEADLINES[ind.id];
  const officialName = headline?.officialName ?? ind.title;
  return {
    id: ind.id,
    title: ind.title,
    insight: headline?.insight ?? ind.title,
    officialName,
    officialText: `${officialName}(${officialBasisOf(ind, headline?.withScope === true)})`,
    headlines,
    valueText: headlines.length > 0 ? headlines[0].value : null,
    unitText: word,
    basisText: denominator,
    caption: isBar && ind.latestLabel !== undefined && ind.latestLabel !== '' ? ind.latestLabel : null,
    definition: ind.definition,
    sourceText: `${ind.source.org}, ${ind.source.table} (${ind.source.accessedOn} 조회)`,
    basisLine: formatBasisLine(ind, updatedOn),
    chart: built.chart,
    chartLabel: built.label,
    legend,
    seriesNote,
    sideValues,
    safety: help === undefined ? null : { name: help.name, number: help.number, hours: help.hours },
  };
}

export interface CarouselData {
  slides: CarouselSlide[];
  /** 슬라이드에 쓰인 출처 기관 이름(중복 없이, 슬라이드 순서대로) */
  orgs: string[];
}

/** 캐러셀 전체: 접근자가 고른 지표 → 슬라이드 (그릴 수 없는 지표는 빠진다). size는 그래프를 그릴 크기(chartSizeFor). */
export function buildCarousel(file?: StatsFile, size: ChartSize = DEFAULT_CHART_SIZE): CarouselData {
  const slides: CarouselSlide[] = [];
  const orgs: string[] = [];
  for (const ind of selectCarouselIndicators(file)) {
    const slide = buildSlide(ind, file?.meta.updatedOn, size);
    if (slide === null) continue;
    slides.push(slide);
    for (const org of sourceOrgsOf(ind.source.org)) if (!orgs.includes(org)) orgs.push(org);
  }
  return { slides, orgs };
}
