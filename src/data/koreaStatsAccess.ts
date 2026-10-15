import statsJson from './koreaStats.json';

/**
 * 한국 통계 접근자 — `src/data/koreaStats.json`을 읽는 **유일한 통로**다 (SPEC-003 M6a, SC3·SC4, 검수 R-147(e)).
 * 화면·게임 코드(M2 캐러셀, M3 룰렛·출생신고, M5 경제)는 JSON을 직접 import하지 말고 아래 함수만 쓴다.
 * 그래야 「확인하지 못한 값(usable: false)」이 어떤 경우에도 게임에 새어 들어가지 않는다.
 *
 * ## 규칙
 *  - `usable !== true` 이거나 `verification.status !== 'verified'` 인 지표는 **어떤 함수도 돌려주지 않는다**(찾으면 undefined, 목록에서는 빠진다).
 *  - 지표 안에 `verification.unverifiedParts`(미확인 하위 항목)가 있으면 그 항목을 잘라 낸 복사본을 돌려주고 `partial: true`를 붙인다.
 *    part 표기: `extraSeries:<라벨>` · `series:<연도|라벨>` · `row:<열>=<값>` · `field:<점 경로>`.
 *  - 돌려준 객체는 **읽기 전용**으로 다룬다(고치지 않는다).
 *
 * ## 함수와 반환 형식 (M2·M3·M5 개발자용 요약)
 *  - `getUsableIndicator(id: string): UsableIndicator | undefined`
 *  - `getUsableIndicators(use?: UseTag): UsableIndicator[]` — 확인된 지표 전부(또는 `use`가 있는 것만), JSON 순서.
 *  - `getCarouselIndicators(): UsableIndicator[]` — 첫 화면 캐러셀 지표(`use: carousel`), `CAROUSEL_ORDER` 순서.
 *  - `getCarouselCards(): CarouselCard[]` — 캐러셀 한 장에 필요한 값을 글자로 만들어 둔 것(제목·기준 문구·큰 숫자들·그래프 점·정의·출처 줄·안전 안내).
 *  - `formatIndicatorValue(ind): FormattedValue` — 큰 숫자 `latest`를 `latestUnit`·`decimals`로 표기(`{ value: '0.80', unit: '명', text: '0.80명', year: 2025, label: '합계출산율' }`).
 *  - `formatHeadlines(ind): FormattedValue[]` — `headline`(남자·여자 등 여러 값)이 있으면 그 값들, 없으면 `[formatIndicatorValue(ind)]`.
 *  - `formatPointValue(ind, value): string` — 시리즈 점 하나(단위는 `unit`)를 같은 규칙으로 표기.
 *  - `formatColumnValue(col, value): string` — 표 셀 하나(`columns[].decimals`).
 *  - `formatNumber(value, decimals): string` — 천 단위 쉼표 + 고정 소수 자릿수.
 *  - `formatWithUnit(value, unit, decimals): string` — 단위 붙이기(`인구 1천 명당 7.1명`·`36.6%`·`5,000만 원`).
 *  - `formatBasisLine(ind): string` — `통계 기준: 2025년 · 마지막 갱신 2026-10-15`(SC4).
 *  - `getSeriesGaps(series): Array<{ from: number; to: number }>` — 연도 간격이 1년을 넘는 구간.
 *  - `getSigunguRows2026(): SigunguRow2026[]` — 2026년 행정구역 시군구 표(인천 제물포·영종·서해·검단구, 화성 4개 구는 **설계값**, 광주·전남은 `sido2026: '전남광주'`).
 *  - `getRouletteRegions(birthYear: number): RouletteRegions | undefined` — 룰렛 지역 목록과 비율(합 100.0). 1950~1989 지난 세상은 시대별 시·도 목록(설계값), 2026·2030~2060은 16개 시·도.
 *  - `getRegionFootnote(): string` — 「출생 통계는 2025년 행정구역 기준 …」 표기 문구.
 *  - `createStatsAccess(file): StatsAccess` — 같은 함수를 주어진 데이터로 만든다(테스트가 가짜 데이터로 규칙을 확인한다).
 */

export type UseTag = 'carousel' | 'roulette' | 'birth' | 'economy' | 'death' | 'satire' | 'future' | 'research';

export interface YearPoint {
  year: number;
  value: number;
}
export interface LabelPoint {
  label: string;
  value: number;
}
export type Point = YearPoint | LabelPoint;

export interface ExtraSeries {
  label: string;
  unit?: string;
  decimals?: number;
  latest?: YearPoint;
  series: Point[];
}
export interface AxisInfo {
  scale: 'year';
  step: number | null;
  regular: boolean;
  gaps: Array<{ from: number; to: number }>;
  breaks: Array<{ year: number; note: string }>;
  note?: string;
}
export interface Column {
  key: string;
  label: string;
  decimals?: number;
}
export interface Headline {
  label: string;
  year: number;
  value: number;
}
export interface Verification {
  status: 'verified' | 'unverified';
  method?: string;
  crossChecks?: string[];
  reason?: string;
  recheckedOn?: string;
  unverifiedParts?: Array<{ part: string; reason: string }>;
}
export interface SourceInfo {
  org: string;
  table: string;
  url: string;
  accessedOn: string;
}
export interface HelpLine {
  name: string;
  number: string;
  hours: string;
  note?: string;
  source?: SourceInfo;
}

/** koreaStats.json의 지표 한 개 (확인 여부와 무관한 원본 모양) */
export interface RawIndicator {
  id: string;
  title: string;
  unit: string | null;
  kind: 'line' | 'bar' | 'number' | 'table';
  use: UseTag[];
  latest: YearPoint | null;
  latestUnit?: string;
  latestLabel?: string;
  decimals?: number;
  headline?: Headline[];
  scopeLabel?: string;
  series?: Point[];
  seriesLabel?: string;
  extraSeries?: ExtraSeries[];
  axis?: AxisInfo;
  columns?: Column[];
  rows?: Array<Record<string, unknown>>;
  definition: string;
  basisId: string;
  source: SourceInfo | null;
  verification: Verification;
  safety: string | null;
  helpLine?: HelpLine;
  usable: boolean;
  notes?: string;
  [extra: string]: unknown;
}

/** 확인된 지표: latest·source가 반드시 있다. partial이면 미확인 하위 항목을 잘라 낸 것 */
export interface UsableIndicator extends RawIndicator {
  usable: true;
  latest: YearPoint;
  latestUnit: string;
  decimals: number;
  source: SourceInfo;
  partial?: true;
}

export interface StatsFile {
  meta: { updatedOn: string; birthStatsBasisFootnote?: string; regionChanges2026?: unknown; [k: string]: unknown };
  indicators: RawIndicator[];
}

export interface FormattedValue {
  /** 숫자 글자(천 단위 쉼표·decimals 적용): `0.80`, `254,341` */
  value: string;
  /** 단위 글자: `명`, `인구 1천 명당 명` */
  unit: string;
  /** 화면에 한 줄로 보일 글자: `0.80명`, `인구 1천 명당 7.1명`, `36.6%` */
  text: string;
  year: number;
  /** 이 값이 무엇인지(headline 라벨 → latestLabel → 지표 제목) */
  label: string;
}

export interface CarouselCard {
  id: string;
  title: string;
  /** 「2025년 기준(17개 시·도)」 같은 기준 문구(없으면 null) */
  scopeLabel: string | null;
  kind: 'line' | 'bar' | 'table' | 'number';
  headlines: FormattedValue[];
  /** 그래프 값. line이면 연도 비례 축(axis), bar이면 라벨 */
  chart: { kind: 'line' | 'bar'; unit: string | null; decimals: number; points: Point[]; extra: ExtraSeries[]; axis: AxisInfo | null };
  definition: string;
  basisLine: string;
  /** 출처 줄(텍스트만, 링크 없음): `국가데이터처 · <통계표>` */
  sourceLine: string;
  /** 자살률 슬라이드: 같은 슬라이드 안에 함께 보여야 하는 상담전화 안내(그 밖 카드는 null) */
  helpLine: HelpLine | null;
  notes: string | null;
}

export interface SigunguRow2026 {
  sido: string;
  /** 2026년 시·도 이름(광주·전남은 `전남광주`) */
  sido2026: string;
  name: string;
  births: number;
  tfr: number;
  /** 2026년 개편으로 옮겨 만든 설계값이면 true(통계 아님 — 화면에 「설계값」 표기) */
  designValue: boolean;
  /** 옮겨 온 옛 구·시 이름(설계값일 때) */
  from?: string[];
  /** 일반구가 속한 시(화성시) */
  parent?: string;
}

export interface RouletteRegion {
  name: string;
  from: string[];
  births: number;
  sharePct: number;
}
export interface RouletteRegions {
  eraId: string;
  label: string;
  kind: 'past' | 'present';
  /** 지난 세상 시대별 목록과 2026년 합친 값은 통계가 아니라 설계값(RL3) */
  designValue: true;
  regions: RouletteRegion[];
}

/** 캐러셀 슬라이드 순서(요청의 5개 → 나머지). 이 목록에 없는 carousel 지표는 JSON 순서로 뒤에 붙는다. */
export const CAROUSEL_ORDER: readonly string[] = [
  'tfr',
  'births',
  'cdr',
  'elderly-poverty',
  'suicide-rate',
  'region-population-registered',
  'life-expectancy',
  'single-household',
  'first-marriage-age',
  'marriage-count',
  'youth-employment',
  'private-education',
  'aging-rate',
  'tfr-by-sido',
];

// ---------------------------------------------------------------- 표기

/** 천 단위 쉼표 + 고정 소수 자릿수 (ko-KR 규칙을 쓰지 않고 직접 만들어 환경 차이를 없앤다) */
export function formatNumber(value: number, decimals: number): string {
  const d = Math.max(0, Math.floor(decimals));
  const neg = value < 0 || Object.is(value, -0);
  const scaled = Math.round(Math.abs(value) * 10 ** d + 1e-9) / 10 ** d;
  const fixed = scaled.toFixed(d);
  const [int, frac] = fixed.split('.');
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return (neg && scaled !== 0 ? '-' : '') + (frac === undefined ? grouped : `${grouped}.${frac}`);
}

/** 단위 붙이기: `인구 1천 명당 명` → `인구 1천 명당 7.1명`, `%`·`명`·`세`·`천 명`·`만 원` → 숫자 바로 뒤 */
export function formatWithUnit(value: number, unit: string, decimals: number): string {
  const n = formatNumber(value, decimals);
  const m = /^(인구 .+당) (.+)$/.exec(unit);
  if (m) return `${m[1]} ${n}${m[2]}`;
  return `${n}${unit}`;
}

/** 연도 간격이 1년을 넘는 구간 */
export function getSeriesGaps(series: readonly Point[]): Array<{ from: number; to: number }> {
  const out: Array<{ from: number; to: number }> = [];
  for (let k = 1; k < series.length; k++) {
    const a = series[k - 1];
    const b = series[k];
    if ('year' in a && 'year' in b && b.year - a.year > 1) out.push({ from: a.year, to: b.year });
  }
  return out;
}

// ---------------------------------------------------------------- 미확인 하위 항목 자르기

function dropPart(ind: Record<string, unknown>, part: string): void {
  const idx = part.indexOf(':');
  const kind = idx < 0 ? part : part.slice(0, idx);
  const arg = idx < 0 ? '' : part.slice(idx + 1);
  if (kind === 'extraSeries') {
    const list = ind.extraSeries as ExtraSeries[] | undefined;
    if (list) ind.extraSeries = list.filter((e) => e.label !== arg);
  } else if (kind === 'series') {
    const list = ind.series as Point[] | undefined;
    if (list) ind.series = list.filter((p) => ('year' in p ? String(p.year) !== arg : p.label !== arg));
  } else if (kind === 'row') {
    const eq = arg.indexOf('=');
    const col = arg.slice(0, eq);
    const val = arg.slice(eq + 1);
    const rows = ind.rows as Array<Record<string, unknown>> | undefined;
    if (rows) ind.rows = rows.filter((r) => String(r[col]) !== val);
  } else if (kind === 'field') {
    const path = arg.split('.');
    let cur: Record<string, unknown> | undefined = ind;
    for (let k = 0; k < path.length - 1 && cur; k++) cur = cur[path[k]] as Record<string, unknown> | undefined;
    if (cur) delete cur[path[path.length - 1]];
  } else {
    throw new Error(`알 수 없는 unverifiedParts 표기: ${part}`);
  }
}

function isUsable(i: RawIndicator): boolean {
  return i.usable === true && i.verification.status === 'verified' && i.latest !== null && i.source !== null;
}

function toUsable(i: RawIndicator): UsableIndicator {
  const parts = i.verification.unverifiedParts ?? [];
  if (parts.length === 0) return i as UsableIndicator;
  const copy = structuredClone(i) as Record<string, unknown>;
  for (const p of parts) dropPart(copy, p.part);
  copy.partial = true;
  return copy as unknown as UsableIndicator;
}

// ---------------------------------------------------------------- 접근자 만들기

export interface StatsAccess {
  getUsableIndicator(id: string): UsableIndicator | undefined;
  getUsableIndicators(use?: UseTag): UsableIndicator[];
  getCarouselIndicators(): UsableIndicator[];
  getCarouselCards(): CarouselCard[];
  getSigunguRows2026(): SigunguRow2026[];
  getRouletteRegions(birthYear: number): RouletteRegions | undefined;
  getRegionFootnote(): string;
  getUpdatedOn(): string;
}

export function formatIndicatorValue(ind: UsableIndicator): FormattedValue {
  const decimals = ind.decimals;
  const value = formatNumber(ind.latest.value, decimals);
  return {
    value,
    unit: ind.latestUnit,
    text: formatWithUnit(ind.latest.value, ind.latestUnit, decimals),
    year: ind.latest.year,
    label: ind.latestLabel ?? ind.title,
  };
}

export function formatHeadlines(ind: UsableIndicator): FormattedValue[] {
  if (!ind.headline || ind.headline.length === 0) return [formatIndicatorValue(ind)];
  return ind.headline.map((h) => ({
    value: formatNumber(h.value, ind.decimals),
    unit: ind.latestUnit,
    text: formatWithUnit(h.value, ind.latestUnit, ind.decimals),
    year: h.year,
    label: h.label,
  }));
}

export function formatPointValue(ind: UsableIndicator, value: number): string {
  return formatWithUnit(value, ind.unit ?? ind.latestUnit, ind.decimals);
}

export function formatColumnValue(col: Column, value: number): string {
  return formatNumber(value, col.decimals ?? 0);
}

/** 「통계 기준: 2025년 · 마지막 갱신 2026-10-15」(SC4). updatedOn을 생략하면 koreaStats.json의 meta.updatedOn */
export function formatBasisLine(ind: UsableIndicator, updatedOn?: string): string {
  const u = updatedOn ?? (statsJson as unknown as StatsFile).meta.updatedOn;
  return `통계 기준: ${ind.latest.year}년 · 마지막 갱신 ${u}`;
}

export function createStatsAccess(file: StatsFile): StatsAccess {
  const all = file.indicators;
  const usable = (): UsableIndicator[] => all.filter(isUsable).map(toUsable);
  const byId = (id: string): UsableIndicator | undefined => {
    const found = all.find((i) => i.id === id);
    return found && isUsable(found) ? toUsable(found) : undefined;
  };

  const getCarouselIndicators = (): UsableIndicator[] => {
    const list = usable().filter((i) => i.use.includes('carousel'));
    const rank = (id: string) => {
      const k = CAROUSEL_ORDER.indexOf(id);
      return k < 0 ? CAROUSEL_ORDER.length : k;
    };
    return [...list].sort((a, b) => rank(a.id) - rank(b.id));
  };

  const getCarouselCards = (): CarouselCard[] =>
    getCarouselIndicators().map((ind) => ({
      id: ind.id,
      title: ind.title,
      scopeLabel: ind.scopeLabel ?? null,
      kind: ind.kind,
      headlines: formatHeadlines(ind),
      chart: {
        kind: ind.kind === 'bar' ? 'bar' : 'line',
        unit: ind.unit,
        decimals: ind.decimals,
        points: ind.series ?? [],
        extra: ind.extraSeries ?? [],
        axis: ind.axis ?? null,
      },
      definition: ind.definition,
      basisLine: formatBasisLine(ind, file.meta.updatedOn),
      sourceLine: `${ind.source.org} · ${ind.source.table}`,
      helpLine: ind.safety === 'suicide-help' && ind.helpLine ? ind.helpLine : null,
      notes: typeof ind.notes === 'string' ? ind.notes : null,
    }));

  const getSigunguRows2026 = (): SigunguRow2026[] => {
    const ind = byId('birth-by-sigungu');
    if (!ind) return [];
    const changes = ind.regionChanges2026 as { retired: string[]; rows: Array<{ sido: string; name: string; births: number; tfr: number; from: string[]; parent?: string }> };
    const retired = new Set(changes.retired);
    const merged = new Set(['광주', '전남']);
    const toSido2026 = (s: string) => (merged.has(s) ? '전남광주' : s);
    const kept = (ind.rows ?? [])
      .map((r) => r as { sido: string; name: string; births: number; tfr: number })
      .filter((r) => !retired.has(`${r.sido} ${r.name}`))
      .map((r): SigunguRow2026 => ({ sido: r.sido, sido2026: toSido2026(r.sido), name: r.name, births: r.births, tfr: r.tfr, designValue: false }));
    const made = changes.rows.map((r): SigunguRow2026 => ({ sido: r.sido, sido2026: toSido2026(r.sido), name: r.name, births: r.births, tfr: r.tfr, designValue: true, from: r.from, ...(r.parent ? { parent: r.parent } : {}) }));
    return [...kept, ...made];
  };

  const getRouletteRegions = (birthYear: number): RouletteRegions | undefined => {
    const ind = byId('birth-by-sido');
    if (!ind) return undefined;
    const eras = ind.eraRegions as Array<{ id: string; label: string; kind: 'past' | 'present'; birthYears: [number, number]; regions: RouletteRegion[] }> | undefined;
    if (!eras) return undefined;
    const inPastOrPresent = (e: (typeof eras)[number]) => birthYear >= e.birthYears[0] && birthYear <= e.birthYears[1];
    // 지금 세상(2026)과 다가올 세상(2030~2060)은 같은 16개 시·도 목록(birthYears [2026, 2060])
    const era = eras.find((e) => inPastOrPresent(e) && (e.kind === 'past' || birthYear === 2026 || (birthYear >= 2030 && birthYear <= 2060)));
    if (!era) return undefined;
    return { eraId: era.id, label: era.label, kind: era.kind, designValue: true, regions: era.regions };
  };

  const getRegionFootnote = (): string => String(file.meta.birthStatsBasisFootnote ?? '');

  return {
    getUsableIndicator: byId,
    getUsableIndicators: (use) => usable().filter((i) => (use === undefined ? true : i.use.includes(use))),
    getCarouselIndicators,
    getCarouselCards,
    getSigunguRows2026,
    getRouletteRegions,
    getRegionFootnote,
    getUpdatedOn: () => file.meta.updatedOn,
  };
}

// ---------------------------------------------------------------- 기본 인스턴스 (실제 데이터)

const DEFAULT = createStatsAccess(statsJson as unknown as StatsFile);

export const getUsableIndicator = DEFAULT.getUsableIndicator;
export const getUsableIndicators = DEFAULT.getUsableIndicators;
export const getCarouselIndicators = DEFAULT.getCarouselIndicators;
export const getCarouselCards = DEFAULT.getCarouselCards;
export const getSigunguRows2026 = DEFAULT.getSigunguRows2026;
export const getRouletteRegions = DEFAULT.getRouletteRegions;
export const getRegionFootnote = DEFAULT.getRegionFootnote;
