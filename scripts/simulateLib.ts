import {
  ERAS,
  PARENT_WEALTHS,
  STAGES,
  STAT_KEYS,
  beginBirth,
  createInitialState,
  createRng,
  enterBirth,
  enterLife,
  estimatePlaySeconds,
  playToEnd,
  stageOfAge,
  type Chooser,
  type Era,
  type EventPool,
  type GameState,
  type LifeLength,
  type ParentWealth,
  type Stage,
  type StatKey,
  type TickCounts,
} from '../src/core';
import { LIMITS } from '../src/data/economyTable';
import { lifeModeOf } from '../src/data/timingTable';

/**
 * 헤드리스 시뮬레이션 도우미 (테스트와 scripts/simulate.ts가 함께 쓴다).
 * UI 없이 core 순수 함수만으로 한 판을 끝까지 돌린다. Math.random·Date는 쓰지 않는다.
 */

export type Strategy = 'auto' | 'first' | 'random';

/**
 * 시대·시드로 인생 시작 직전(life, 0세)까지 만든다.
 * looks를 주면 외모를 그 값으로 고정한다(외모 구간별 조우율 비교용: 시드·시대가 같은 인생에서 외모만 다르게 한다).
 */
export function startLife(seed: number, era: Era, opts: { looks?: number; lifeLength?: LifeLength } = {}): GameState {
  // 첫 화면 → 태어나기(룰렛 단계에서 출생 결과 확정) → 출생신고 보기 → 살아가기(인생 0세)
  const s = enterLife(enterBirth(beginBirth(createInitialState(seed), era, opts.lifeLength)));
  if (opts.looks === undefined || s.character === null) return s;
  return { ...s, character: { ...s.character, looks: opts.looks } };
}

/** 선택 전략: auto = 성향 자동 선택(자동 모드와 같다), first = 늘 첫 번째 선택지, random = 별도 시드 RNG로 무작위(수동 플레이 흉내). */
export function chooserFor(strategy: Strategy, seed: number): Chooser | null {
  if (strategy === 'auto') return null;
  if (strategy === 'first') return (s) => s.pending!.choiceIds[0];
  const rng = createRng(seed ^ 0x9e3779b9);
  return (s) => rng.pick(s.pending!.choiceIds);
}

export interface LifeSummary {
  seed: number;
  era: Era;
  final: GameState;
  counts: TickCounts;
  deathAge: number;
  /** 단계별로 만난 선택지 이벤트 수 */
  choicesByStage: Record<Stage, number>;
  /** 1배속 수동(건너뛰기 없음) 추정 시간(초): 읽는 시간 가정 = 중앙('median') / 느린 독자('high') / 보수 상한('upper') — core/timing.ts#estimatePlaySeconds (판의 인생 길이 모드·시대로) */
  seconds1x: number;
  seconds1xHigh: number;
  seconds1xUpper: number;
  /** 8배속 + 다음 결정으로 추정 시간(초), 같은 가정 */
  secondsFast: number;
  secondsFastHigh: number;
  secondsFastUpper: number;
}

/** 이 판의 연표에서 단계별 선택지 수 */
export function choicesByStage(final: GameState): Record<Stage, number> {
  const out: Record<Stage, number> = { infant: 0, school: 0, youth: 0, middle: 0, senior: 0 };
  for (const h of final.history) if (h.kind === 'choice') out[stageOfAge(h.age)]++;
  return out;
}

/**
 * 한 판을 끝까지 돌리고 매 걸음 불변식을 검사한다(위반하면 throw):
 * 스탯 0~100 정수, 나이 단조(줄어들지 않음, 한 걸음에 +1 이하), 사망에 도달, 연표 상한.
 */
export function simulateLife(seed: number, era: Era, strategy: Strategy, pool?: EventPool, opts: { looks?: number; lifeLength?: LifeLength } = {}): LifeSummary {
  const start = startLife(seed, era, opts);
  const chooser = chooserFor(strategy, seed);
  const run = playToEnd(start, chooser, pool);
  const final = run.state;
  if (final.phase !== 'ending' || final.death === null) throw new Error(`seed ${seed} ${era}: 사망에 도달하지 못했다`);
  for (const k of STAT_KEYS) {
    const v = final.stats[k];
    if (!Number.isInteger(v) || v < 0 || v > 100) throw new Error(`seed ${seed} ${era}: 스탯 ${k}=${v} 범위 밖`);
  }
  const slow = { speed: 1 as const, skipToDecision: false };
  const fast = { speed: 8 as const, skipToDecision: true };
  return {
    seed,
    era,
    final,
    counts: run.counts,
    deathAge: final.death.age,
    choicesByStage: choicesByStage(final),
    seconds1x: estimatePlaySeconds(run.counts, slow, final.lifeLength, era, 'median'),
    seconds1xHigh: estimatePlaySeconds(run.counts, slow, final.lifeLength, era, 'high'),
    seconds1xUpper: estimatePlaySeconds(run.counts, slow, final.lifeLength, era, 'upper'),
    secondsFast: estimatePlaySeconds(run.counts, fast, final.lifeLength, era, 'median'),
    secondsFastHigh: estimatePlaySeconds(run.counts, fast, final.lifeLength, era, 'high'),
    secondsFastUpper: estimatePlaySeconds(run.counts, fast, final.lifeLength, era, 'upper'),
  };
}

export interface Dist {
  n: number;
  mean: number;
  min: number;
  p05: number;
  p50: number;
  p95: number;
  max: number;
}

export function distOf(values: readonly number[]): Dist {
  const v = [...values].sort((a, b) => a - b);
  const at = (p: number) => v[Math.min(v.length - 1, Math.floor((p / 100) * v.length))];
  return { n: v.length, mean: v.reduce((a, b) => a + b, 0) / v.length, min: v[0], p05: at(5), p50: at(50), p95: at(95), max: v[v.length - 1] };
}

const mean = (xs: readonly number[]) => xs.reduce((a, b) => a + b, 0) / (xs.length || 1);
const median = (xs: readonly number[]): number => {
  if (xs.length === 0) return 0;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
};
const sd = (xs: readonly number[]) => {
  const m = mean(xs);
  return Math.sqrt(mean(xs.map((x) => (x - m) ** 2)));
};
/** 피어슨 상관계수 */
export function correlation(a: readonly number[], b: readonly number[]): number {
  const ma = mean(a);
  const mb = mean(b);
  let num = 0;
  let da = 0;
  let db = 0;
  for (let i = 0; i < a.length; i++) {
    num += (a[i] - ma) * (b[i] - mb);
    da += (a[i] - ma) ** 2;
    db += (b[i] - mb) ** 2;
  }
  return num / Math.sqrt(da * db);
}

export interface EraReport {
  era: Era;
  lives: number;
  deathAge: Dist;
  choices: Dist;
  narratives: Dist;
  quiet: Dist;
  /** 1배속 수동(분): 읽는 시간 가정 중앙 / 느린 독자 / 보수 상한 (시대별 r — core/timing.ts#readSecFor) */
  minutes1x: Dist;
  minutes1xHigh: Dist;
  minutes1xUpper: Dist;
  /** 8배속 + 다음 결정으로(분): 같은 가정 */
  minutesFast: Dist;
  minutesFastHigh: Dist;
  minutesFastUpper: Dist;
  /** 단계별 선택지 수 평균 */
  choicesByStageMean: Record<Stage, number>;
  /** 하드 상한을 넘은 판 수(구조적으로 0) / 하드 상한 −1 이상인 판의 비율(%) — 페이싱이 분포를 모양내는지 본다 (취약한 「25장 초과」 통계를 대체, M8 LD-9) */
  overHardCount: number;
  nearCapPct: number;
  /** 사망 나이 70세 이상인 판 중 결정 카드가 20장 미만인 판의 비율(%) (조기 사망이 섞이면 사망 나이 분포가 흔든다) */
  under20Of70PlusPct: number;
  /** 사망 연령 분포(10세 구간별 비율) */
  deathByDecade: Record<string, number>;
  /** 20세 전 사망 비율(%) */
  earlyDeathPct: number;
}

export function simulateMany(era: Era, seeds: number, strategy: Strategy, pool?: EventPool, opts: { looks?: number; lifeLength?: LifeLength } = {}): LifeSummary[] {
  const lives: LifeSummary[] = [];
  for (let i = 1; i <= seeds; i++) lives.push(simulateLife(i * 7919 + 13, era, strategy, pool, opts));
  return lives;
}

export function reportOf(era: Era, lives: readonly LifeSummary[]): EraReport {
  const deathByDecade: Record<string, number> = {};
  for (const l of lives) {
    const key = `${Math.floor(l.deathAge / 10) * 10}대`;
    deathByDecade[key] = (deathByDecade[key] ?? 0) + 1;
  }
  for (const k of Object.keys(deathByDecade)) deathByDecade[k] = Math.round((deathByDecade[k] / lives.length) * 1000) / 10;
  const choicesByStageMean = Object.fromEntries(STAGES.map((st) => [st, mean(lives.map((l) => l.choicesByStage[st]))])) as Record<Stage, number>;
  const pct = (n: number) => Math.round((n / lives.length) * 1000) / 10;
  const hard = lifeModeOf(lives[0]?.final.lifeLength).pacing.hard;
  const long = lives.filter((l) => l.deathAge >= 70);
  return {
    era,
    lives: lives.length,
    deathAge: distOf(lives.map((l) => l.deathAge)),
    choices: distOf(lives.map((l) => l.counts.choice)),
    narratives: distOf(lives.map((l) => l.counts.narrative)),
    quiet: distOf(lives.map((l) => l.counts.quiet)),
    minutes1x: distOf(lives.map((l) => l.seconds1x / 60)),
    minutes1xHigh: distOf(lives.map((l) => l.seconds1xHigh / 60)),
    minutes1xUpper: distOf(lives.map((l) => l.seconds1xUpper / 60)),
    minutesFast: distOf(lives.map((l) => l.secondsFast / 60)),
    minutesFastHigh: distOf(lives.map((l) => l.secondsFastHigh / 60)),
    minutesFastUpper: distOf(lives.map((l) => l.secondsFastUpper / 60)),
    choicesByStageMean,
    overHardCount: lives.filter((l) => l.counts.choice > hard).length,
    nearCapPct: pct(lives.filter((l) => l.counts.choice >= hard - 1).length),
    under20Of70PlusPct: Math.round((long.filter((l) => l.counts.choice < 20).length / (long.length || 1)) * 1000) / 10,
    deathByDecade,
    earlyDeathPct: pct(lives.filter((l) => l.deathAge < 20).length),
  };
}

export function reportEra(era: Era, seeds: number, strategy: Strategy, pool?: EventPool, opts: { lifeLength?: LifeLength } = {}): EraReport {
  return reportOf(era, simulateMany(era, seeds, strategy, pool, opts));
}

export function reportAll(seeds: number, strategy: Strategy, pool?: EventPool, opts: { lifeLength?: LifeLength } = {}): EraReport[] {
  return ERAS.map((era) => reportEra(era, seeds, strategy, pool, opts));
}

// ---------- 밸런스: 부모 재력 단계별 최종 스탯, 출생값과의 상관 (R-045 b) ----------

export interface TierBalance {
  tier: ParentWealth;
  n: number;
  /** 최종 스탯 평균 */
  mean: Record<StatKey, number>;
  /** 스무 살 넘어 마친 판의 최종 순자산(만 원) 중앙값 — 재산 스탯이 없어진 뒤(M5)의 「재산」 지표 */
  netMedian: number;
  /** 스무 살 넘어 마친 판 중 최종 순자산이 음수인 비율(%) */
  netNegativePct: number;
  /** 스무 살 넘어 마친 판 중 최종 순자산이 데이터 상한(LIMITS.netMax)에 닿은 비율(%) — 위쪽이 폭주하지 않는지 */
  netAtCapPct: number;
  /** 최종 학력이 40 이상 / 70 이상인 비율(%) — 소득 문턱(INCOME_BY_EDUCATION) */
  education40Pct: number;
  education70Pct: number;
}

export interface BalanceReport {
  lives: number;
  tiers: TierBalance[];
  /** 최종 값의 평균과 표준편차 */
  happiness: { mean: number; sd: number };
  relationships: { mean: number; sd: number };
  /** 출생 값과 최종 값의 상관계수 */
  correlation: { happiness: number; relationships: number };
}

export function balanceOf(lives: readonly LifeSummary[]): BalanceReport {
  const pct = (g: readonly LifeSummary[], f: (l: LifeSummary) => boolean) => Math.round((g.filter(f).length / (g.length || 1)) * 1000) / 10;
  const tiers: TierBalance[] = PARENT_WEALTHS.map((tier) => {
    const g = lives.filter((l) => l.final.character!.parentWealth === tier);
    return {
      tier,
      n: g.length,
      mean: Object.fromEntries(STAT_KEYS.map((k) => [k, mean(g.map((l) => l.final.stats[k]))])) as Record<StatKey, number>,
      netMedian: median(g.filter((l) => l.final.assets !== null).map((l) => l.final.assets!.net)),
      netNegativePct: pct(
        g.filter((l) => l.final.assets !== null),
        (l) => l.final.assets!.net < 0,
      ),
      netAtCapPct: pct(
        g.filter((l) => l.final.assets !== null),
        (l) => l.final.assets!.net >= LIMITS.netMax,
      ),
      education40Pct: pct(g, (l) => l.final.stats.education >= 40),
      education70Pct: pct(g, (l) => l.final.stats.education >= 70),
    };
  });
  const fh = lives.map((l) => l.final.stats.happiness);
  const fr = lives.map((l) => l.final.stats.relationships);
  return {
    lives: lives.length,
    tiers,
    happiness: { mean: mean(fh), sd: sd(fh) },
    relationships: { mean: mean(fr), sd: sd(fr) },
    correlation: {
      happiness: correlation(
        lives.map((l) => l.final.birthStats!.happiness),
        fh,
      ),
      relationships: correlation(
        lives.map((l) => l.final.birthStats!.relationships),
        fr,
      ),
    },
  };
}

export function balanceAll(seeds: number, strategy: Strategy, pool?: EventPool): BalanceReport {
  const lives: LifeSummary[] = [];
  for (const era of ERAS) lives.push(...simulateMany(era, seeds, strategy, pool));
  return balanceOf(lives);
}

// ---------- 외모 구간별 평생 조우율 (R-044) ----------

/** 연애·결혼·사업 이벤트 묶음(R-044: 외모가 확률로 반영되는 이벤트). 풀에 실제로 있는지는 tests/events.test.ts가 확인한다. */
export const ENCOUNTER_GROUPS = {
  romance: ['school-first-love', 'youth-meeting', 'youth-meeting-again', 'youth-matchmaker', 'youth-approached', 'youth-workplace-romance', 'youth-reunion'],
  marriage: ['youth-marriage', 'youth-marriage-again'],
  business: ['youth-startup', 'middle-business'],
} as const;
export type EncounterGroup = keyof typeof ENCOUNTER_GROUPS;

/** 외모 구간(대표값으로 고정해서 같은 시드·시대의 인생을 비교한다) */
export const LOOKS_TIERS = [
  { label: '낮음(0~30)', looks: 15 },
  { label: '보통(31~69)', looks: 50 },
  { label: '높음(70~100)', looks: 85 },
] as const;

export interface EncounterRow {
  label: string;
  looks: number;
  lives: number;
  /** 한 판에서 그 묶음의 이벤트를 한 번이라도 만난 비율(%) */
  romancePct: number;
  marriageEventPct: number;
  businessPct: number;
  /** 실제로 결혼한 판(결혼 플래그를 켠 적이 있는 판)의 비율(%) */
  marriedPct: number;
  /** 사업을 시작한 판(own_business 플래그)의 비율(%) */
  ownBusinessPct: number;
}

/** 같은 시드·같은 시대에서 외모만 구간 대표값으로 바꿔 돌린 판들의 평생 조우율 */
export function encounterTable(seeds: number, strategy: Strategy, pool?: EventPool): EncounterRow[] {
  return LOOKS_TIERS.map((tier) => {
    const lives: LifeSummary[] = [];
    for (const era of ERAS) lives.push(...simulateMany(era, seeds, strategy, pool, { looks: tier.looks }));
    const met = (l: LifeSummary, group: EncounterGroup) => ENCOUNTER_GROUPS[group].some((id) => Object.prototype.hasOwnProperty.call(l.final.seen, id));
    const pct = (f: (l: LifeSummary) => boolean) => Math.round((lives.filter(f).length / lives.length) * 1000) / 10;
    return {
      label: tier.label,
      looks: tier.looks,
      lives: lives.length,
      romancePct: pct((l) => met(l, 'romance')),
      marriageEventPct: pct((l) => met(l, 'marriage')),
      businessPct: pct((l) => met(l, 'business')),
      marriedPct: pct((l) => l.final.flags.includes('married') || l.final.flags.includes('divorced')),
      ownBusinessPct: pct((l) => l.final.flags.includes('own_business')),
    };
  });
}
