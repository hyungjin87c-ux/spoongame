import { EVENT_POOL } from '../src/data/events';
import {
  autoResolveStep,
  resolveChoiceStep,
  stageOfAge,
  stepYear,
  yearLineCount,
  type Era,
  type EventDef,
  type ProfileId,
  type GameState,
  type StepResult,
} from '../src/core';
import { isChoiceEvent } from '../src/core/events';
import { ECONOMY } from '../src/data/economyTable';
import { chooserFor, startLife, type Strategy } from './simulateLib';

/**
 * SPEC-004 GM0 기준선 측정의 순수 계산 부분 (실행 스크립트는 scripts/baseline004.ts, 결과는 docs/data/spec-004-baseline.md).
 * 이 파일은 **측정용**이다 — 게임 코드(`src/`)는 바꾸지 않는다. 세대 표·연표 후보 표는 SPEC-004 GD1·부록 A를 측정용으로 옮긴 것이고,
 * 본 구현(`src/data/generations.ts`·`timeline.json`)이 생기면 그쪽이 기준이다.
 */

// ---------- 세대 7종 (SPEC-004 GD1, r3) ----------

export interface Generation {
  id: string;
  label: string;
  /** 출생 연도(포함) */
  from: number;
  to: number;
}

export const GENERATIONS: readonly Generation[] = [
  { id: 'industrial', label: '산업화·전후', from: 1940, to: 1954 },
  { id: 'boomer', label: '베이비붐', from: 1955, to: 1963 },
  { id: 'g86', label: '86', from: 1960, to: 1969 },
  { id: 'genx', label: 'X', from: 1970, to: 1980 },
  { id: 'millennial', label: '밀레니얼', from: 1981, to: 1996 },
  { id: 'genz', label: 'Z', from: 1997, to: 2012 },
  { id: 'alpha', label: '알파', from: 2013, to: 2020 },
];

export const LAST_ACTUAL_YEAR = 2025;

// ---------- 나이대 8종 (SPEC-004 TL3) ----------

export interface AgeBand {
  key: string;
  label: string;
  min: number;
  max: number;
}

/** 노년은 「65~」이지만 이벤트 정의의 마지막 나이가 100이라 100까지 센다 */
export const AGE_BANDS: readonly AgeBand[] = [
  { key: 'infant', label: '영유아 0~6', min: 0, max: 6 },
  { key: 'child', label: '어린이 7~12', min: 7, max: 12 },
  { key: 'teen', label: '청소년 13~19', min: 13, max: 19 },
  { key: 'twenties', label: '20대', min: 20, max: 29 },
  { key: 'thirties', label: '30대', min: 30, max: 39 },
  { key: 'middle', label: '중년 40~54', min: 40, max: 54 },
  { key: 'preSenior', label: '장년 55~64', min: 55, max: 64 },
  { key: 'senior', label: '노년 65~100', min: 65, max: 100 },
];

// ---------- 시대 제한(eras)을 세대로 옮기는 규칙 ----------

/**
 * U 상한: 시대 제한을 무시한다 — 나이·단계만 본다(모든 세대가 같은 값).
 * L 하한: 지금 모델의 시대 제한을 **글자 그대로** 출생 연도에 옮긴다 — `ERA_CONFIG[era].birthYears`(지난 1950~1989 · 지금 2026 · 다가올 2030~2060) 안의 출생 연도만 통과.
 *   세대 범위(1940~2020)에는 지금·다가올 세상 출생이 없으므로 그 두 시대 제한만 가진 이벤트는 어느 세대에서도 후보가 아니다.
 * R 중간(달력 연도 규칙): 이벤트 `eras`를 SPEC-004 MG2가 만들 `yearRange`의 첫 근사로 옮긴다 — 지난 = 달력 연도 ≤ cut(기본 1999) · 지금 = 달력 연도 ≥ cut+1 · 다가올 = 달력 연도 ≥ 2026(전망 구간).
 *   세 갈래 중 하나라도 맞으면 통과(`eras` 생략 = 통과). cut은 GM1이 정한다(여기서는 1995·2000·2005를 견준다).
 */
/** 지난 모델(R1)의 시대별 출생 연도 — 기준선 비교용으로 얼린 값 (옛 `ERA_CONFIG[era].birthYears`) */
const LEGACY_ERA_BIRTH_YEARS: Readonly<Record<Era, { min: number; max: number }>> = {
  past: { min: 1950, max: 1989 },
  present: { min: 2026, max: 2026 },
  future: { min: 2030, max: 2060 },
};

export type Rule = 'U' | 'L' | { rule: 'R'; cut: number };

export function eraPasses(ev: Pick<EventDef, 'eras'>, birthYear: number, age: number, rule: Rule): boolean {
  if (!ev.eras || rule === 'U') return true;
  const cal = birthYear + age;
  if (rule === 'L') return ev.eras.some((e) => birthYear >= LEGACY_ERA_BIRTH_YEARS[e].min && birthYear <= LEGACY_ERA_BIRTH_YEARS[e].max);
  const cut = rule.cut;
  return ev.eras.some((e) => (e === 'past' ? cal <= cut : e === 'present' ? cal > cut : cal > LAST_ACTUAL_YEAR));
}

/** 나이·단계가 맞는가 (SPEC-005 기준선의 `choiceEventIdsAt`과 같은 기준: 플래그·재력 조건은 보지 않는다) */
export function ageStageOk(ev: EventDef, age: number): boolean {
  if (!ev.stages.includes(stageOfAge(age))) return false;
  if (ev.ageRange?.min !== undefined && age < ev.ageRange.min) return false;
  if (ev.ageRange?.max !== undefined && age > ev.ageRange.max) return false;
  return true;
}

/** 필요한 플래그가 없는 이벤트(`conditions.flags` 없음) — 앞선 사건 없이도 열릴 수 있다 */
export const flagFree = (ev: EventDef): boolean => !(ev.conditions?.flags && ev.conditions.flags.length > 0);

export interface CandidateCount {
  all: number;
  free: number;
  choice: number;
  /** 시대 제한(eras)이 붙은 이벤트만 센 값 — 「시대색」 후보 */
  tagged: number;
}

/** 출생 연도 b, 나이 a에서 후보 이벤트 수 */
export function candidatesAt(b: number, a: number, rule: Rule): CandidateCount {
  const c: CandidateCount = { all: 0, free: 0, choice: 0, tagged: 0 };
  for (const ev of EVENT_POOL.events) {
    if (!ageStageOk(ev, a) || !eraPasses(ev, b, a, rule)) continue;
    c.all++;
    if (flagFree(ev)) c.free++;
    if (isChoiceEvent(ev)) c.choice++;
    if (ev.eras) c.tagged++;
  }
  return c;
}

export interface CellStat {
  /** (출생 연도, 나이) 쌍의 수 */
  pairs: number;
  meanAll: number;
  meanFree: number;
  meanChoice: number;
  meanTagged: number;
  /** 후보(전체)가 임계 미만인 쌍의 비율 / 0인 쌍의 비율 */
  thinShare: number;
  emptyShare: number;
  thinFreeShare: number;
  minAll: number;
  /** 임계 미만인 (나이) 목록 — 어느 출생 연도에서든 */
  thinAges: number[];
}

export const THIN = 4; // SPEC-004 MG2: (세대, 나이) 칸 후보 ≥ 4

/** 세대 × 나이대 한 칸의 통계: 세대 출생 연도 × 나이대 나이의 모든 쌍 */
export function cellStat(g: Generation, band: AgeBand, rule: Rule): CellStat {
  let pairs = 0;
  let all = 0;
  let free = 0;
  let choice = 0;
  let tagged = 0;
  let thin = 0;
  let thinFree = 0;
  let empty = 0;
  let min = Infinity;
  const thinAges = new Set<number>();
  for (let b = g.from; b <= g.to; b++) {
    for (let a = band.min; a <= band.max; a++) {
      const c = candidatesAt(b, a, rule);
      pairs++;
      all += c.all;
      free += c.free;
      choice += c.choice;
      tagged += c.tagged;
      if (c.all < THIN) {
        thin++;
        thinAges.add(a);
      }
      if (c.free < THIN) thinFree++;
      if (c.all === 0) empty++;
      min = Math.min(min, c.all);
    }
  }
  return {
    pairs,
    meanAll: all / pairs,
    meanFree: free / pairs,
    meanChoice: choice / pairs,
    meanTagged: tagged / pairs,
    thinShare: thin / pairs,
    emptyShare: empty / pairs,
    thinFreeShare: thinFree / pairs,
    minAll: min,
    thinAges: [...thinAges].sort((x, y) => x - y),
  };
}

/** 정수 나이 목록을 「0~2, 5, 8~9」 꼴로 */
export function rangesOf(ages: readonly number[]): string {
  if (ages.length === 0) return '-';
  const out: string[] = [];
  let s = ages[0];
  let p = ages[0];
  for (let i = 1; i <= ages.length; i++) {
    const x = ages[i];
    if (x === p + 1) {
      p = x;
      continue;
    }
    out.push(s === p ? `${s}` : `${s}~${p}`);
    s = x;
    p = x;
  }
  return out.join(', ');
}

/** 시대 제한이 있는 이벤트 33개가 규칙 L에서 한 칸이라도 후보가 되는 세대 */
export function taggedEventFate(rule: Rule): Array<{ ev: EventDef; gens: string[] }> {
  const out: Array<{ ev: EventDef; gens: string[] }> = [];
  for (const ev of EVENT_POOL.events) {
    if (!ev.eras) continue;
    const gens: string[] = [];
    for (const g of GENERATIONS) {
      let ok = false;
      for (let b = g.from; b <= g.to && !ok; b++) {
        const lo = ev.ageRange?.min ?? 0;
        const hi = Math.min(ev.ageRange?.max ?? 100, 100);
        for (let a = lo; a <= hi && !ok; a++) if (ageStageOk(ev, a) && eraPasses(ev, b, a, rule)) ok = true;
      }
      if (ok) gens.push(g.id);
    }
    out.push({ ev, gens });
  }
  return out;
}

// ---------- 정석 코스 이벤트 ----------

/** 정석 코스의 문(게이트) 플래그 — 이 플래그를 켜는 이벤트가 「문」, 이 플래그를 요구하거나 막는 이벤트가 「문에 기대는」 이벤트 */
export const GATE_FLAGS = ['college', 'exam_prep', 'passed_exam', 'has_career', 'own_business', 'has_partner', 'married', 'has_child', 'no_child', 'own_home', 'renting', 'lives_with_parents', 'divorced'] as const;

export interface CourseRow {
  id: string;
  stages: string;
  ages: string;
  eras: string;
  kind: '결정' | '서술';
  sets: string[];
  needs: string[];
  excludes: string[];
}

function flagsSetBy(ev: EventDef): string[] {
  const out = new Set<string>();
  for (const f of ev.effects?.setFlags ?? []) out.add(f);
  for (const c of ev.choices ?? []) for (const f of c.effects?.setFlags ?? []) out.add(f);
  return [...out];
}

export function courseRows(): CourseRow[] {
  const gate = new Set<string>(GATE_FLAGS);
  const rows: CourseRow[] = [];
  for (const ev of EVENT_POOL.events) {
    const sets = flagsSetBy(ev).filter((f) => gate.has(f));
    const needs = [...(ev.conditions?.flags ?? []), ...(ev.choices ?? []).flatMap((c) => c.requires?.flags ?? [])].filter((f) => gate.has(f));
    const excludes = [...(ev.conditions?.notFlags ?? [])].filter((f) => gate.has(f));
    if (sets.length === 0 && needs.length === 0 && excludes.length === 0) continue;
    rows.push({
      id: ev.id,
      stages: ev.stages.join('+'),
      ages: ev.ageRange ? `${ev.ageRange.min}~${ev.ageRange.max}` : '-',
      eras: ev.eras ? ev.eras.join('/') : '-',
      kind: isChoiceEvent(ev) ? '결정' : '서술',
      sets,
      needs: [...new Set(needs)],
      excludes: [...new Set(excludes)],
    });
  }
  return rows;
}

/** 본문(제목·본문·선택지·결과)에 정석 코스 낱말이 든 이벤트 — AL3 알파용 변형·닫기 검토 대상(문구 점검, 참고) */
export const COURSE_WORDS = ['정년', '퇴직', '은퇴', '입사', '취직', '신혼', '월급', '승진', '내 집', '결혼', '혼례', '출산', '직장', '회사', '시험 준비', '입시', '대학'] as const;

export function courseWordHits(ev: EventDef): string[] {
  const text = [ev.title, ev.text, ...(ev.choices ?? []).flatMap((c) => [c.label, c.result])].join(' ');
  return COURSE_WORDS.filter((w) => text.includes(w));
}

// ---------- 연표 후보 (SPEC-004 부록 A + A-2 + A-3, 측정용 옮김) ----------

export interface TimelineCandidate {
  id: string;
  cat: 'E' | 'S' | 'C' | 'B' | 'G';
  /** 사건이 있는 달력 연도 구간(포함). 여러 구간이면 여러 개 */
  years: ReadonlyArray<readonly [number, number]>;
}

const y = (a: number, b = a) => [a, b] as const;

/** 부록 A(57) + A-2(13) + A-3(8) = 78건 중 연도가 정해진 77건 (H-G01 「모든 해」 제외). 연도는 부록의 초안 값이며 DC1이 확인한다. H-B11(9·11)은 사회 체험이라 S로 센다 */
export const TIMELINE_CANDIDATES: readonly TimelineCandidate[] = [
  { id: 'H-E01', cat: 'E', years: [y(1953, 1959)] },
  { id: 'H-E02', cat: 'E', years: [y(1962, 1979)] },
  { id: 'H-E03', cat: 'E', years: [y(1973), y(1979)] },
  { id: 'H-E04', cat: 'E', years: [y(1986, 1988)] },
  { id: 'H-E05', cat: 'E', years: [y(1989, 1996)] },
  { id: 'H-E06', cat: 'E', years: [y(1997, 1998)] },
  { id: 'H-E07', cat: 'E', years: [y(1999, 2000)] },
  { id: 'H-E08', cat: 'E', years: [y(2002, 2003)] },
  { id: 'H-E09', cat: 'E', years: [y(2005, 2007)] },
  { id: 'H-E10', cat: 'E', years: [y(2008, 2009)] },
  { id: 'H-E11', cat: 'E', years: [y(2017, 2018)] },
  { id: 'H-E12', cat: 'E', years: [y(2020, 2021)] },
  { id: 'H-E13', cat: 'E', years: [y(2022, 2023)] },
  { id: 'H-S01', cat: 'S', years: [y(1962, 1975)] },
  { id: 'H-S02', cat: 'S', years: [y(1969, 1974)] },
  { id: 'H-S03', cat: 'S', years: [y(1977, 1989)] },
  { id: 'H-S04', cat: 'S', years: [y(1980), y(2000)] },
  { id: 'H-S05', cat: 'S', years: [y(1982, 1983)] },
  { id: 'H-S06', cat: 'S', years: [y(1988)] },
  { id: 'H-S07', cat: 'S', years: [y(1993, 1994)] },
  { id: 'H-S08', cat: 'S', years: [y(1998)] },
  { id: 'H-S09', cat: 'S', years: [y(2004, 2005)] },
  { id: 'H-S10', cat: 'S', years: [y(2008, 2014)] },
  { id: 'H-S11', cat: 'S', years: [y(2011, 2016)] },
  { id: 'H-S12', cat: 'S', years: [y(2015)] },
  { id: 'H-S13', cat: 'S', years: [y(2015, 2016)] },
  { id: 'H-S14', cat: 'S', years: [y(2020, 2022)] },
  { id: 'H-C01', cat: 'C', years: [y(1961, 1980)] },
  { id: 'H-C02', cat: 'C', years: [y(1982)] },
  { id: 'H-C03', cat: 'C', years: [y(1986), y(1988)] },
  { id: 'H-C04', cat: 'C', years: [y(1989)] },
  { id: 'H-C05', cat: 'C', years: [y(1991, 1999)] },
  { id: 'H-C06', cat: 'C', years: [y(1994, 2002)] },
  { id: 'H-C07', cat: 'C', years: [y(1996, 2004)] },
  { id: 'H-C08', cat: 'C', years: [y(2002)] },
  { id: 'H-C09', cat: 'C', years: [y(2009, 2012)] },
  { id: 'H-C10', cat: 'C', years: [y(2012)] },
  { id: 'H-C11', cat: 'C', years: [y(2016)] },
  { id: 'H-C12', cat: 'C', years: [y(2022, 2025)] },
  { id: 'H-B01', cat: 'B', years: [y(1950), y(1953)] },
  { id: 'H-B02', cat: 'B', years: [y(1960)] },
  { id: 'H-B03', cat: 'B', years: [y(1961)] },
  { id: 'H-B04', cat: 'B', years: [y(1979), y(1980)] },
  { id: 'H-B05', cat: 'B', years: [y(1987)] },
  { id: 'H-B06', cat: 'B', years: [y(1994), y(1995)] },
  { id: 'H-B07', cat: 'B', years: [y(2003)] },
  { id: 'H-B08', cat: 'B', years: [y(2014)] },
  { id: 'H-B09', cat: 'B', years: [y(2016), y(2017)] },
  { id: 'H-B10', cat: 'B', years: [y(2022)] },
  { id: 'H-B11', cat: 'S', years: [y(2001)] },
  { id: 'H-G02', cat: 'G', years: [y(1993, 1995)] },
  { id: 'H-G03', cat: 'G', years: [y(2007, 2012)] },
  { id: 'H-G04', cat: 'G', years: [y(2015, 2019)] },
  { id: 'H-G05', cat: 'G', years: [y(2016, 2025)] },
  { id: 'H-G06', cat: 'G', years: [y(2019, 2023)] },
  { id: 'H-G07', cat: 'G', years: [y(2020, 2025)] },
  // A-2
  { id: 'H-B12', cat: 'B', years: [y(1945), y(1948)] },
  { id: 'H-E14', cat: 'E', years: [y(1964, 1985)] },
  { id: 'H-E15', cat: 'S', years: [y(1970, 1979)] },
  { id: 'H-S15', cat: 'S', years: [y(1970), y(1974)] },
  { id: 'H-S16', cat: 'S', years: [y(1981, 1987)] },
  { id: 'H-E16', cat: 'E', years: [y(2005, 2019)] },
  { id: 'H-C13', cat: 'C', years: [y(1999, 2010)] },
  { id: 'H-C14', cat: 'C', years: [y(2018, 2025)] },
  { id: 'H-E17', cat: 'E', years: [y(2018, 2025)] },
  { id: 'H-E18', cat: 'S', years: [y(2020, 2023)] },
  { id: 'H-S17', cat: 'S', years: [y(2023, 2025)] },
  { id: 'H-S18', cat: 'S', years: [y(2025)] },
  { id: 'H-C15', cat: 'C', years: [y(2022, 2025)] },
  // A-3
  { id: 'X1', cat: 'E', years: [y(1985, 1999)] },
  { id: 'X2', cat: 'C', years: [y(1993)] },
  { id: 'X3', cat: 'S', years: [y(1999, 2000)] },
  { id: 'X4', cat: 'S', years: [y(1996)] },
  { id: 'GX1', cat: 'G', years: [y(1982, 1998)] },
  { id: 'GX2', cat: 'G', years: [y(1991, 1995)] },
  { id: 'GX3', cat: 'G', years: [y(1992, 1999)] },
  { id: 'GX4', cat: 'G', years: [y(1990, 1998)] },
];

export const timelineAtYear = (year: number): TimelineCandidate[] => TIMELINE_CANDIDATES.filter((t) => t.years.some(([s, e]) => year >= s && year <= e));

/** 달력 연도 목록에서 연표 후보가 하나도 없는 연속 구간(길이 ≥ minRun) */
export function emptyRuns(from: number, to: number, minRun: number): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  let start: number | null = null;
  for (let yr = from; yr <= to + 1; yr++) {
    const empty = yr <= to && timelineAtYear(yr).length === 0;
    if (empty && start === null) start = yr;
    if (!empty && start !== null) {
      if (yr - start >= minRun) out.push([start, yr - 1]);
      start = null;
    }
  }
  return out;
}

/** 달력 연도 [from, to] 안에 걸치는 연표 후보 (한 번이라도 겹치면 센다 — 여러 해에 걸친 사건도 한 건) */
export const timelineOverlapping = (from: number, to: number): TimelineCandidate[] => TIMELINE_CANDIDATES.filter((t) => t.years.some(([s, e]) => s <= to && e >= from));

/**
 * 세대 × 나이대 한 칸에서 한 사람이 겪을 수 있는 서로 다른 연표 후보 사건 수(실제 구간 2025까지) — 출생 연도마다 센 평균·최소.
 * 실제 줄 수는 TL4(나이대 변형이 있어야 나온다) 때문에 이보다 적다. `years`는 그 칸이 실제 구간에 걸치는 평균 해 수.
 */
export function timelineCell(g: Generation, band: AgeBand): { mean: number; min: number; years: number } {
  let sum = 0;
  let min = Infinity;
  let years = 0;
  let births = 0;
  for (let b = g.from; b <= g.to; b++) {
    const from = b + band.min;
    const to = Math.min(b + band.max, LAST_ACTUAL_YEAR);
    births++;
    if (to < from) {
      min = Math.min(min, 0);
      continue;
    }
    const n = timelineOverlapping(from, to).length;
    sum += n;
    min = Math.min(min, n);
    years += to - from + 1;
  }
  return { mean: sum / births, min, years: years / births };
}

/** 한 사람의 평생(출생~min(출생+lifeAge, 2025))에 걸치는 연표 후보 수: 출생 연도별 최소·평균·최대 */
export function timelineLifetime(g: Generation, lifeAge: number): { min: number; mean: number; max: number } {
  const xs: number[] = [];
  for (let b = g.from; b <= g.to; b++) xs.push(timelineOverlapping(b, Math.min(b + lifeAge, LAST_ACTUAL_YEAR)).length);
  return { min: Math.min(...xs), mean: xs.reduce((a, c) => a + c, 0) / xs.length, max: Math.max(...xs) };
}

// ---------- 경로 측정 (AL10 기준선) ----------

export interface Snapshot {
  age: number;
  flags: ReadonlySet<string>;
  dwelling: string | null;
  seen: Readonly<Record<string, number>>;
}

export interface LifeRecord {
  seed: number;
  era: ProfileId;
  birthYear: number;
  deathAge: number;
  /** 나이 → 그 나이의 마지막 상태 */
  at: Map<number, Snapshot>;
  /** 19~64세에 고른 선택의 「이벤트/선택지」 목록 */
  picks: string[];
  /** 해마다 연표 줄 수(event·choice) */
  lines: Map<number, number>;
}

/** playToEnd와 같은 걸음으로 한 판을 끝까지 돌리며 나이마다 상태를 남긴다 (게임 규칙은 그대로) */
export function playRecorded(seed: number, era: ProfileId, strategy: Strategy): LifeRecord {
  let s: GameState = startLife(seed, era);
  const chooser = chooserFor(strategy, seed);
  const at = new Map<number, Snapshot>();
  const snap = (st: GameState) => at.set(st.age, { age: st.age, flags: new Set(st.flags), dwelling: st.assets?.dwelling ?? null, seen: { ...st.seen } });
  snap(s);
  for (let i = 0; s.phase === 'life'; i++) {
    if (i >= 2000) throw new Error('playRecorded: 진행이 끝나지 않는다');
    let r: StepResult;
    if (s.pending !== null) {
      const picked = chooser === null ? null : chooser(s);
      r = picked === null ? autoResolveStep(s, s.pending.key, EVENT_POOL) : resolveChoiceStep(s, s.pending.key, picked, EVENT_POOL);
    } else {
      r = stepYear(s, EVENT_POOL);
    }
    s = r.state;
    snap(s);
  }
  const picks: string[] = [];
  const lines = new Map<number, number>();
  for (const h of s.history) {
    if (h.kind === 'choice' && h.eventId && h.choice && h.age >= 19 && h.age <= 64) {
      const ev = EVENT_POOL.byId.get(h.eventId);
      const ch = ev?.choices?.find((c) => (c.parentLabel ?? c.label) === h.choice || c.label === h.choice);
      if (ch) picks.push(`${h.eventId}/${ch.id}`);
    }
  }
  for (let a = 0; a <= s.age; a++) lines.set(a, yearLineCount(s.history, a));
  return { seed, era, birthYear: s.character!.birthYear, deathAge: s.death?.age ?? s.age, at, picks, lines };
}

/** 나이 a 이하에서 가장 최근에 기록된 상태 (사망 등으로 그 나이가 없으면 null) */
export function snapshotAt(rec: LifeRecord, age: number): Snapshot | null {
  if (age > rec.deathAge) return null;
  for (let a = age; a >= 0; a--) {
    const s = rec.at.get(a);
    if (s) return s;
  }
  return null;
}

// 축 상태 정의 v0 — 지금 모델의 플래그·주거로 AL2의 다섯 축(배움·일·거처·관계·돌봄)에 대응시킨 **측정용 매핑**이다.
// 알파의 `lifeBoard`가 생기면(GM9) 같은 정의로 X·밀레니얼도 다시 매핑해 재측정한다.
const seenAge = (s: Snapshot, id: string): number | null => (id in s.seen ? s.seen[id] : null);

export function axisLearn(s: Snapshot): string {
  if (s.age < 20) return '정규';
  if (s.flags.has('college') && s.age <= ECONOMY.studentUntilAge) return '정규';
  const retrain = ['youth-night-study', 'youth-return-school'].map((id) => seenAge(s, id)).filter((x): x is number => x !== null);
  if (retrain.some((a) => s.age - a <= 3)) return '재교육';
  if (s.flags.has('exam_prep') && s.age <= ECONOMY.examUntilAge) return '독학·수험';
  return '쉼';
}

export function axisWork(s: Snapshot): string {
  if (s.age < 20) return '학생';
  const retired = seenAge(s, 'senior-retire');
  if (retired !== null && s.age >= retired) return '은퇴';
  const career = s.flags.has('has_career');
  const biz = s.flags.has('own_business');
  if (career && biz) return '고용+사업';
  if (career) return '고용 1곳';
  if (biz) return '사업';
  if (s.flags.has('college') && s.age <= ECONOMY.studentUntilAge) return '학생';
  if (s.flags.has('exam_prep') && s.age <= ECONOMY.examUntilAge) return '수험';
  return '임시·쉼';
}

export function axisHome(s: Snapshot): string {
  if (s.age < 20) return '부모 집';
  return ({ family: '부모 집', rent: '월세', jeonse: '전세', own: '자가', care: '돌봄 시설' } as Record<string, string>)[s.dwelling ?? 'family'] ?? '부모 집';
}

export function axisRelation(s: Snapshot): string {
  if (s.flags.has('married') && s.flags.has('has_child')) return '결혼+자녀';
  if (s.flags.has('married')) return '결혼';
  if (s.flags.has('has_partner')) return '파트너';
  return '혼자';
}

export function axisCare(s: Snapshot): string {
  const cp = s.flags.has('cared_parents') && !s.flags.has('parents_gone');
  const childAge = seenAge(s, 'youth-child') ?? seenAge(s, 'youth-child-again');
  const child = s.flags.has('has_child') && !s.flags.has('child_left') && childAge !== null && s.age - childAge <= 18;
  if (cp) return '부모';
  if (child) return '자녀';
  if (s.flags.has('in_care')) return '자신';
  return '없음';
}

export const AXES = [
  ['배움', axisLearn],
  ['일', axisWork],
  ['거처', axisHome],
  ['관계', axisRelation],
  ['돌봄', axisCare],
] as const;

export const PATH_AGES = [25, 35, 45, 55, 65] as const;

/** 25·35·45·55·65세의 5축 상태를 이어 붙인 경로 서명. 그 나이 전에 사망하면 null */
export function pathSignature(rec: LifeRecord): string | null {
  const parts: string[] = [];
  for (const a of PATH_AGES) {
    const s = snapshotAt(rec, a);
    if (!s) return null;
    parts.push(AXES.map(([, f]) => f(s)).join('/'));
  }
  return parts.join(' | ');
}

/** 섀넌 엔트로피(비트) */
export function entropyBits(counts: Iterable<number>): number {
  const arr = [...counts];
  const n = arr.reduce((a, b) => a + b, 0);
  if (n === 0) return 0;
  return -arr.reduce((h, c) => (c > 0 ? h + (c / n) * Math.log2(c / n) : h), 0);
}

export function countBy<T>(xs: readonly T[], key: (x: T) => string): Map<string, number> {
  const m = new Map<string, number>();
  for (const x of xs) m.set(key(x), (m.get(key(x)) ?? 0) + 1);
  return m;
}

/**
 * N잡 판정 (지금 모델에는 「일 슬롯」이 없어 선택·플래그로 대리한다):
 *  · 엄격 = 19~64세에 「여러 일을 이어 붙이는」 선택을 고름 — 플랫폼 일감 `youth-gig-work/juggle`(지금·다가올 세상에만 나온다) 또는 본업을 두고 하는 사업 `youth-startup/side`
 *  · 겸업(참고) = 19~64세 어느 해든 has_career와 own_business 플래그가 함께 켜져 있음 — 「사업을 시작한다」 선택이 취업 플래그를 지우지 않아 **부풀려진 값**이다(참고용)
 *  · 넓게 = 엄격 + 일하며 시험을 준비하는 선택 `youth-exam-prep/work`
 */
export const NJOB_PICKS = ['youth-gig-work/juggle', 'youth-startup/side'] as const;
export const NJOB_BROAD_PICKS = [...NJOB_PICKS, 'youth-exam-prep/work'] as const;

export function njobOf(rec: LifeRecord): { strict: boolean; overlap: boolean; broad: boolean } {
  const strict = rec.picks.some((p) => (NJOB_PICKS as readonly string[]).includes(p));
  const broad = rec.picks.some((p) => (NJOB_BROAD_PICKS as readonly string[]).includes(p));
  let overlap = false;
  for (let a = 19; a <= Math.min(64, rec.deathAge); a++) {
    const s = snapshotAt(rec, a);
    if (s && s.flags.has('has_career') && s.flags.has('own_business')) overlap = true;
  }
  return { strict, overlap, broad };
}

/** 정석 4단: 취업(has_career)·결혼(married)·출산(has_child)·내 집(own_home 또는 주거 자가)을 모두 밟았는가 + 순서대로(처음 밟은 나이가 줄어들지 않게)인가. AL10의 「입사→결혼→자가→정년퇴직」도 같이 센다 */
export function courseOf(rec: LifeRecord): { any4: boolean; ordered4: boolean; al10: boolean; atLeast3: boolean; first: Record<string, number | null> } {
  const first: Record<string, number | null> = { career: null, married: null, child: null, home: null, retired: null };
  for (let a = 0; a <= rec.deathAge; a++) {
    const s = rec.at.get(a);
    if (!s) continue;
    if (first.career === null && s.flags.has('has_career')) first.career = a;
    if (first.married === null && s.flags.has('married')) first.married = a;
    if (first.child === null && s.flags.has('has_child')) first.child = a;
    if (first.home === null && (s.flags.has('own_home') || s.dwelling === 'own')) first.home = a;
    if (first.retired === null && 'senior-retire' in s.seen) first.retired = s.seen['senior-retire'];
  }
  const { career, married, child, home, retired } = first;
  const any4 = career !== null && married !== null && child !== null && home !== null;
  const ordered4 = any4 && career! <= married! && married! <= child! && child! <= home!;
  const al10 = career !== null && married !== null && home !== null && retired !== null && career <= married && married <= home! && home! <= retired;
  const atLeast3 = [career, married, child, home].filter((x) => x !== null).length >= 3;
  return { any4, ordered4, al10, atLeast3, first };
}

// ---------- 소재 창고 가공본(EM) 개요 × 세대 × 나이대 ----------

export interface EmItem {
  id: string;
  from: number;
  to: number;
  bands: Set<string>;
  shape: string;
}

/** 제외 8 · 보류 3 (SPEC-004 GE1) — 쓰지 않는 항목 */
export const EM_UNUSED = new Set(['EM-019', 'EM-042', 'EM-056', 'EM-064', 'EM-075', 'EM-076', 'EM-107', 'EM-108', 'EM-040', 'EM-041', 'EM-043']);

const BAND_ORDER = AGE_BANDS.map((b) => b.key);
const WORD_BAND: Array<[string, string]> = [
  ['영유아', 'infant'],
  ['어린이', 'child'],
  ['십대', 'teen'],
  ['20대', 'twenties'],
  ['30대', 'thirties'],
  ['중년', 'middle'],
  ['노년', 'senior'],
];

/** `era-motifs-7090.md` 3절의 나이대 칸 문장을 TL3 나이대 키 집합으로 옮긴다 (측정용 근사) */
export function bandsOfAgeText(text: string): Set<string> {
  const out = new Set<string>();
  if (/전 나이대|나이 무관/.test(text)) return new Set(BAND_ORDER);
  const bandOfWord = (w: string): string | null => WORD_BAND.find(([k]) => w.includes(k))?.[1] ?? null;
  for (const part of text.split(/[·,]/)) {
    if (part.includes('~')) {
      const [l, r] = part.split('~');
      const a = bandOfWord(l);
      const b = bandOfWord(r);
      if (a && b) for (let i = BAND_ORDER.indexOf(a); i <= BAND_ORDER.indexOf(b); i++) out.add(BAND_ORDER[i]);
      continue;
    }
    for (const [k, v] of WORD_BAND) if (part.includes(k)) out.add(v);
    if (part.includes('부모 세대')) out.add('middle');
  }
  return out;
}

export function parseEm(markdown: string): EmItem[] {
  const out: EmItem[] = [];
  for (const line of markdown.split('\n')) {
    if (!/^\| EM-\d{3} /.test(line)) continue;
    const c = line.split('|').slice(1, -1).map((s) => s.trim());
    if (c.length < 11) continue; // 사용하지 않는 항목 표(4절)는 칸 수가 다르다
    const id = c[0];
    if (EM_UNUSED.has(id)) continue;
    const m = c[3].match(/^(\d{4})(?:~(\d{4}))?/);
    if (!m) continue;
    const from = Number(m[1]);
    const to = m[2] ? Number(m[2]) : /~/.test(c[3]) ? LAST_ACTUAL_YEAR : from;
    const bands = bandsOfAgeText(c[4]);
    if (bands.size === 0) continue;
    out.push({ id, from, to, bands, shape: c[7] });
  }
  return out;
}

/** 세대 × 나이대 한 칸에 걸리는 소재 항목 수 (그 칸의 달력 연도 창과 소재의 시기가 겹치고 나이대가 맞는 것) */
export function emCell(items: readonly EmItem[], g: Generation, band: AgeBand, shape?: RegExp): number {
  let n = 0;
  for (const it of items) {
    if (!it.bands.has(band.key)) continue;
    if (shape && !shape.test(it.shape)) continue;
    let hit = false;
    for (let b = g.from; b <= g.to && !hit; b++) hit = it.from <= b + band.max && it.to >= b + band.min;
    if (hit) n++;
  }
  return n;
}
