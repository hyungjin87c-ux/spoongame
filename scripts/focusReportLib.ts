import { EVENT_POOL } from '../src/data/events';
import { FOCUS_K_MAX, FOCUS_MODEL, FOCUS_SECTIONS, FOCUS_TOPICS } from '../src/data/focusTable';
import { SELF_AREA_WEIGHT } from '../src/data/parentDecisionTable';
import {
  STAT_KEYS,
  autoResolveStep,
  countTick,
  emptyCounts,
  estimatePlaySeconds,
  eventWeightBounds,
  focusChoicesOf,
  focusSectionOf,
  focusTaggable,
  focusTopicsOf,
  looksChannelBounds,
  resolveChoiceStep,
  setFocus,
  stepYear,
  timingEraOf,
  totalCards,
  withFocusEnabled,
  type FocusId,
  type FocusSection,
  type GameState,
  type ProfileId,
  type StatKey,
  type TickCounts,
} from '../src/core';
import { chooserFor, startLife, type Strategy } from './simulateLib';

/**
 * 올해의 초점 측정 (SPEC-018 PL10, 설계 `docs/data/focus-spend-model.md` 2-5절 ①~⑧ · 7절 판 길이) — `report:persona --only=focus`·`report:time --only=focus`가 쓴다.
 * 팔 7개 = 초점 없음 + 주제 6개. 같은 시드 집합을 팔마다 돌린다(시드 i × 7919 + 13). 구간이 시작하는 나이(13·20·40·65)마다 그 팔의 주제를 고른다(그 구간 목록에 없으면 `setFocus`가 무시한다 — 실제 플레이와 같다).
 * **판정이 아니라 보고다** — 기준(▲)에 못 미치는 칸은 곱을 비틀지 않고 그대로 적는다.
 */

export const FOCUS_ARMS: ReadonlyArray<FocusId | null> = [null, 0, 1, 2, 3, 4, 5];
export const focusSeedOf = (i: number): number => i * 7919 + 13;
export const ARM_NAMES: readonly string[] = FOCUS_TOPICS;
/** 스탯을 잡는 나이: 20(⑤ 지배) · 35(일) · 40 · 45(돈) · 65(건강·취미) */
export const SNAP_AGES = [20, 35, 40, 45, 65] as const;
export type SnapAge = (typeof SNAP_AGES)[number];

export interface Snap {
  stats: Record<StatKey, number>;
  net: number;
  income: number;
  career: boolean;
}

export interface FocusLife {
  seed: number;
  birthYear: number;
  /** 구간별 보이는 초점 목록 (출생 연도 기준) */
  lists: ReadonlyArray<readonly FocusId[]>;
  /** [구간][주제] 그 구간에 본 카드 수 (사건의 주제 중 하나라도 그 주제인 카드) */
  exposure: number[][];
  /** [구간] 그 구간에 본 사건 카드 전체 수 */
  sectionCards: number[];
  counts: TickCounts;
  /** 카드 수: 결정(본인 + 부모·흘러감) · 서술 · 합 */
  choice: number;
  narrative: number;
  total: number;
  snaps: Partial<Record<SnapAge, Snap>>;
  /** 한 판의 전 생애 요약 해시 재료 (⑦ 불변 점검용) */
  digest: string;
  seconds1x: number;
  deathAge: number;
}

const SECTION_COUNT = FOCUS_SECTIONS.length;

/** 한 판을 끝까지 돌린다 — 선택은 자동 성향(`auto`) 또는 시드 무작위(`random`, report:time 기본) */
export function playFocusLife(seed: number, era: ProfileId, arm: FocusId | null, strategy: Strategy = 'auto', opts: { focusEnabled?: boolean } = {}): FocusLife {
  const run = (): FocusLife => {
    let s: GameState = startLife(seed, era);
    const chooser = chooserFor(strategy, seed);
    const counts = emptyCounts();
    const applied = new Set<number>();
    const snaps: Partial<Record<SnapAge, Snap>> = {};
    for (let i = 0; s.phase === 'life'; i++) {
      if (i > 5000) throw new Error(`seed ${seed}: 진행이 끝나지 않는다`);
      if (s.pending === null) {
        const sec = focusSectionOf(s.age);
        if (arm !== null && sec !== null && FOCUS_SECTIONS[sec] === s.age && !applied.has(sec)) {
          applied.add(sec);
          s = setFocus(s, arm);
        }
        for (const a of SNAP_AGES) {
          if (s.age === a && snaps[a] === undefined) snaps[a] = { stats: { ...s.stats }, net: s.assets?.net ?? 0, income: s.assets?.income ?? 0, career: s.flags.includes('has_career') };
        }
      }
      let r;
      if (s.pending !== null) {
        const picked = chooser === null ? null : chooser(s);
        r = picked === null ? autoResolveStep(s, s.pending.key) : resolveChoiceStep(s, s.pending.key, picked);
      } else r = stepYear(s);
      s = r.state;
      countTick(counts, r.tick, s.lifeLength);
    }
    const birthYear = s.character!.birthYear;
    const exposure = Array.from({ length: SECTION_COUNT }, () => new Array<number>(FOCUS_TOPICS.length).fill(0));
    const sectionCards = new Array<number>(SECTION_COUNT).fill(0);
    for (const h of s.history) {
      if ((h.kind !== 'event' && h.kind !== 'choice') || h.eventId === undefined) continue;
      const sec = focusSectionOf(h.age);
      if (sec === null) continue;
      sectionCards[sec]++;
      for (const t of focusTopicsOf(h.eventId)) exposure[sec][t]++;
    }
    const timingEra = timingEraOf(s.generation, birthYear);
    return {
      seed,
      birthYear,
      lists: ([0, 1, 2, 3] as const).map((sec) => focusChoicesOf(birthYear, sec)),
      exposure,
      sectionCards,
      counts,
      choice: totalCards(counts),
      narrative: counts.narrative,
      total: totalCards(counts) + counts.narrative,
      snaps,
      digest: JSON.stringify([s.stats, s.assets, s.flags, s.rngState, s.history.length, s.age, counts]),
      seconds1x: estimatePlaySeconds(counts, { speed: 1, skipToDecision: false }, s.lifeLength, timingEra, 'median'),
      deathAge: s.death?.age ?? s.age,
    };
  };
  return opts.focusEnabled === undefined ? run() : withFocusEnabled(opts.focusEnabled, run);
}

/** 7개 팔 × n판 (같은 시드 집합) */
export function runArms(era: ProfileId, n: number, strategy: Strategy = 'auto'): Array<{ arm: FocusId | null; lives: FocusLife[] }> {
  return FOCUS_ARMS.map((arm) => ({ arm, lives: Array.from({ length: n }, (_, i) => playFocusLife(focusSeedOf(i + 1), era, arm, strategy)) }));
}

// ---------- 통계 ----------

export const mean = (xs: readonly number[]): number => (xs.length === 0 ? 0 : xs.reduce((a, b) => a + b, 0) / xs.length);
export function sd(xs: readonly number[]): number {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  return Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / (xs.length - 1));
}
export const se = (xs: readonly number[]): number => (xs.length === 0 ? 0 : sd(xs) / Math.sqrt(xs.length));
export function pctile(xs: readonly number[], p: number): number {
  const a = [...xs].sort((x, y) => x - y);
  return a.length === 0 ? 0 : a[Math.min(a.length - 1, Math.floor(p * a.length))];
}

/** ① 한 칸(구간 s × 주제 t) — 팔 t 중 그 구간 목록에 t가 있는 판의 노출 평균 ÷ 초점 없음 팔의 같은 판들 평균 */
export interface ExposureCell {
  section: FocusSection;
  topic: FocusId;
  /** 목록에 t가 있는 판 수 */
  games: number;
  armMean: number;
  noneMean: number;
  ratio: number;
  ratioLo: number;
  ratioHi: number;
  /** 초점 없음 팔에서 그 구간 사건 카드 가운데 t 주제 카드의 몫(풀 몫의 경험적 근사) */
  share: number;
  /** ③ 목록-노출 어긋남: 팔 t에서 그 구간에 t 카드가 0장인 판의 비율 */
  mismatch: number;
}

export function exposureCells(arms: ReturnType<typeof runArms>): ExposureCell[] {
  const none = arms[0].lives;
  const out: ExposureCell[] = [];
  for (const { arm, lives } of arms) {
    if (arm === null) continue;
    for (const section of [0, 1, 2, 3] as const) {
      const idx = lives.map((_, i) => i).filter((i) => lives[i].lists[section].includes(arm));
      if (idx.length === 0) continue;
      const a = idx.map((i) => lives[i].exposure[section][arm]);
      const b = idx.map((i) => none[i].exposure[section][arm]);
      const am = mean(a);
      const bm = mean(b);
      const ratio = bm === 0 ? Number.NaN : am / bm;
      const rel = bm === 0 || am === 0 ? 0 : Math.sqrt((se(a) / am) ** 2 + (se(b) / bm) ** 2);
      const noneCards = mean(idx.map((i) => none[i].sectionCards[section]));
      out.push({
        section,
        topic: arm,
        games: idx.length,
        armMean: am,
        noneMean: bm,
        ratio,
        ratioLo: ratio * (1 - 1.96 * rel),
        ratioHi: ratio * (1 + 1.96 * rel),
        share: noneCards === 0 ? 0 : bm / noneCards,
        mismatch: a.filter((x) => x === 0).length / a.length,
      });
    }
  }
  return out;
}

/** ⑤ 20세 스탯 지배 (2-4절): (a) 3개 이상 스탯에서 7팔 중 최고 (b) 4스탯 합이 7팔 평균보다 +1.5 이상 (c) 그 차이가 SE의 2배 초과 — 셋이 모두 맞으면 지배 */
export interface DominanceRow {
  arm: FocusId | null;
  stats: Record<StatKey, number>;
  sum: number;
  sumSe: number;
  best: number;
  diffFromMean: number;
  dominant: boolean;
}

export function dominanceRows(arms: ReturnType<typeof runArms>): { rows: DominanceRow[]; sumBand: number } {
  const sums = arms.map((a) => a.lives.map((l) => STAT_KEYS.reduce((t, k) => t + (l.snaps[20]?.stats[k] ?? 0), 0)));
  const means = arms.map(({ lives }) => Object.fromEntries(STAT_KEYS.map((k) => [k, mean(lives.map((l) => l.snaps[20]?.stats[k] ?? 0))])) as Record<StatKey, number>);
  const sumMeans = sums.map(mean);
  const grand = mean(sumMeans);
  const rows = arms.map(({ arm }, ai): DominanceRow => {
    const best = STAT_KEYS.filter((k) => means.every((m, bi) => bi === ai || means[ai][k] >= m[k])).length;
    const diff = sumMeans[ai] - grand;
    const sumSe = se(sums[ai]);
    return { arm, stats: means[ai], sum: sumMeans[ai], sumSe, best, diffFromMean: diff, dominant: best >= FOCUS_MODEL.dominanceStatsMin && diff >= FOCUS_MODEL.dominanceSumDiff && diff > FOCUS_MODEL.dominanceSEMul * sumSe };
  });
  return { rows, sumBand: Math.max(...sumMeans) - Math.min(...sumMeans) };
}

/** ④ 카드 수: 팔마다 판당 평균 (결정 · 서술 · 합)과 초점 없음 팔과의 차 */
export function cardRows(arms: ReturnType<typeof runArms>): Array<{ arm: FocusId | null; choice: number; narrative: number; total: number; dChoice: number; dNarrative: number; dTotal: number }> {
  const base = arms[0].lives;
  const bc = mean(base.map((l) => l.choice));
  const bn = mean(base.map((l) => l.narrative));
  const bt = mean(base.map((l) => l.total));
  return arms.map(({ arm, lives }) => {
    const c = mean(lives.map((l) => l.choice));
    const nr = mean(lives.map((l) => l.narrative));
    const t = mean(lives.map((l) => l.total));
    return { arm, choice: c, narrative: nr, total: t, dChoice: c - bc, dNarrative: nr - bn, dTotal: t - bt };
  });
}

/** ⑥ 모든 표지 사건의 합성 추첨 가중 최댓값 (자기 영역 × 초점 곱 포함) */
/** (행이 `[]`인 사건도 13~18세 본인 카드의 자기 영역 곱은 받으므로 표지 대상 전부를 잰다) */
export function maxPickWeight(): { id: string; max: number; over: number } {
  let best = { id: '', max: 0 };
  let over = 0;
  for (const ev of EVENT_POOL.events) {
    if (!focusTaggable(ev)) continue;
    const extra: Array<readonly [number, number]> = [[1, SELF_AREA_WEIGHT], [1, FOCUS_K_MAX]];
    if (ev.looksChannel !== undefined) extra.push(looksChannelBounds(ev.looksChannel));
    const b = eventWeightBounds(ev, extra);
    if (b.max > FOCUS_MODEL.pickWeightMax) over++;
    if (b.max > best.max) best = { id: ev.id, max: b.max };
  }
  return { ...best, over };
}

/** ⑧ 고른 주제의 손해: 팔의 주제에 맞는 값이 초점 없음 팔보다 낮아지는가 (평균 차와 SE) */
export interface HarmRow {
  arm: FocusId;
  label: string;
  age: SnapAge;
  diff: number;
  diffSe: number;
  harmed: boolean;
}

const HARM_METRIC: Record<number, { label: string; age: SnapAge; get: (s: Snap) => number }> = {
  0: { label: '지식 education @20', age: 20, get: (s) => s.stats.education },
  1: { label: '일: 연 소득 @35', age: 35, get: (s) => s.income },
  2: { label: '관계 relationships @20', age: 20, get: (s) => s.stats.relationships },
  3: { label: '건강 health @65', age: 65, get: (s) => s.stats.health },
  4: { label: '취미: 행복 happiness @65', age: 65, get: (s) => s.stats.happiness },
  5: { label: '돈: 순자산 @45', age: 45, get: (s) => s.net },
};

export function harmRows(arms: ReturnType<typeof runArms>): HarmRow[] {
  const none = arms[0].lives;
  const rows: HarmRow[] = [];
  for (const { arm, lives } of arms) {
    if (arm === null) continue;
    const m = HARM_METRIC[arm];
    const pairs = lives.map((l, i) => [l.snaps[m.age], none[i].snaps[m.age]] as const).filter(([a, b]) => a !== undefined && b !== undefined);
    const a = pairs.map(([x]) => m.get(x!));
    const b = pairs.map(([, y]) => m.get(y!));
    const diff = mean(a) - mean(b);
    const diffSe = Math.sqrt(se(a) ** 2 + se(b) ** 2);
    rows.push({ arm, label: m.label, age: m.age, diff, diffSe, harmed: diff < 0 && -diff > 2 * diffSe });
  }
  return rows;
}

/** ⑦ 초점 없음 불변: 초점 없음 팔의 판 요약 = 같은 시드를 「스위치 끔 + 초점을 고르려 함」으로 돌린 요약 (스위치 끔이 곱 1을 보장하는지) */
export function offInvariant(era: ProfileId, n: number, strategy: Strategy = 'auto'): { n: number; same: number } {
  let same = 0;
  for (let i = 1; i <= n; i++) {
    const seed = focusSeedOf(i);
    const a = playFocusLife(seed, era, null, strategy);
    const b = playFocusLife(seed, era, 2, strategy, { focusEnabled: false });
    if (a.digest === b.digest) same++;
  }
  return { n, same };
}

/** 7절: 팔별 판 길이 (1배속 중앙 읽기 모델, 분) */
export function timeRows(arms: ReturnType<typeof runArms>): Array<{ arm: FocusId | null; mean: number; p95: number; dMean: number }> {
  const base = mean(arms[0].lives.map((l) => l.seconds1x / 60));
  return arms.map(({ arm, lives }) => {
    const mins = lives.map((l) => l.seconds1x / 60);
    return { arm, mean: mean(mins), p95: pctile(mins, 0.95), dMean: mean(mins) - base };
  });
}
