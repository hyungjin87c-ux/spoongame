import {
  ERAS,
  STAGES,
  calendarYear,
  citationFor,
  estimatePlaySeconds,
  extraLineMsFor,
  holdMsFor,
  playToEnd,
  previewPending,
  readSecFor,
  stageOfAge,
  type Chooser,
  type Era,
  type EventPool,
  type GameState,
  type LifeLength,
  type Stage,
  type TickCounts,
} from '../src/core';
import { EVENT_POOL } from '../src/data/events';
import { IMPACT_LABEL } from '../src/data/impactText';
import { EVENT_FREQUENCY } from '../src/data/lifeTable';
import { HOLD_MS, LIFE_LENGTH_MODES, READ_MODEL, lifeModeOf, type ChoicePacing } from '../src/data/timingTable';
import { chooserFor, startLife, type Strategy } from './simulateLib';

/**
 * 시간 모델 측정 도우미 (SPEC-003 LM2·LM4·LM7, M8 — docs/data/content-M8.md 6-5절). `npm run report:time`(scripts/timeReport.ts)과 tests/timeModel.test.ts가 함께 쓴다.
 * 판정이 아니라 **보고**를 만든다: 시대 × 모드 × 전략 × 판수를 기록 시트 없이(소비 모드 — 인생은 같다) 끝까지 돌리며 결정 카드마다 실제 글자 수·인용·영향 줄을 잰다.
 * 난수는 시드 RNG뿐(Math.random·Date 없음) — 시드는 simulateMany와 같은 i × 7919 + 13이라 같은 입력이면 같은 결과다.
 */

// ---------- 옛 모델 (SPEC-001, M8 이전) — 재현용 상수 ----------

/** M8 이전의 시간 모델: 연출은 HOLD_MS 그대로(계수 1, 줄 대기 없음), 결정 카드 한 장 읽는 시간 중앙 18초. 「현 모델 재현」(content-M8.md 1-3절 표와 맞는지)에만 쓴다. */
export const LEGACY_MODEL = { readSec: 18, pacing: { soft: 23, softFactor: 0.3, hard: 26 } as ChoicePacing };

export function legacySeconds(c: TickCounts): number {
  return (c.quiet * HOLD_MS.quiet + c.narrative * HOLD_MS.narrative + c.resolved * HOLD_MS.resolved) / 1000 + c.choice * LEGACY_MODEL.readSec;
}

// ---------- 한 판 측정 ----------

/** 결정 카드 한 장에서 잰 것 (카드가 뜬 순간의 화면 기준) */
export interface CardFeature {
  eventId: string;
  stage: Stage;
  age: number;
  titleLen: number;
  textLen: number;
  /** 화면에 보인 선택지 라벨의 글자 수들 */
  labelLens: number[];
  /** 고른 선택지의 결과 문구 글자 수(판이 끝난 뒤 연표에서 채운다) */
  resultLen: number;
  /** 영향 줄의 글자 수 = 보인 선택지마다 Σ(항목 이름 글자 수 + 기호 수) 의 합, 항목 수의 합, 영향 줄이 있는 선택지 수 */
  impactChars: number;
  impactItems: number;
  /** 인용 박스가 보였는가, 요약(시대 머리말 포함)·출처 줄 글자 수 */
  cited: boolean;
  citeTextLen: number;
  citeSrcLen: number;
}

export interface LifeMeasure {
  seed: number;
  era: Era;
  lifeLength: LifeLength;
  deathAge: number;
  counts: TickCounts;
  cards: CardFeature[];
  /** 단계별 결정 카드 수 */
  byStage: Record<Stage, number>;
  /** 0~7세(영유아 빈도표 구간) 결정 카드 수 */
  cardsUpTo7: number;
  /** 불변식 위반(비어 있어야 한다) */
  problems: string[];
}

const len = (s: string): number => [...s].length;

/** 카드가 뜬 상태(대기 중인 선택지)에서 카드 한 장의 글자·영향·인용을 잰다. 결과 문구 길이는 나중에 채운다. */
export function featureOf(s: GameState, pool: EventPool): CardFeature | null {
  const pending = s.pending;
  if (pending === null || s.character === null || s.era === null) return null;
  const ev = pool.byId.get(pending.eventId);
  if (ev === undefined) return null;
  const shown = pending.choiceIds.map((id) => ev.choices?.find((c) => c.id === id)).filter((c) => c !== undefined);
  const previews = previewPending(s, pool) ?? [];
  let impactChars = 0;
  let impactItems = 0;
  for (const p of previews) {
    for (const it of p.impact.items) {
      impactChars += len(IMPACT_LABEL[it.key]) + it.steps;
      impactItems++;
    }
  }
  const cite = citeOf(ev, s.era, s.character.birthYear, s.age);
  return {
    eventId: ev.id,
    stage: stageOfAge(s.age),
    age: s.age,
    titleLen: len(ev.title),
    textLen: len(ev.text),
    labelLens: shown.map((c) => len(c!.label)),
    resultLen: 0,
    impactChars,
    impactItems,
    cited: cite !== null,
    citeTextLen: cite === null ? 0 : len(cite.text),
    citeSrcLen: cite === null ? 0 : len(cite.sourceLine),
  };
}

function citeOf(ev: EventPool['events'][number], era: Era, birthYear: number, age: number) {
  return citationFor(ev, era, calendarYear(birthYear, age));
}

/**
 * 한 판을 끝까지 돌리며 연출 집계(해 수·둘째 줄 수)와 카드별 글자·인용·영향을 잰다. strategy는 simulateLib와 같다(random = 수동 흉내).
 * 불변식: 해 수 합 = 사망 나이 + 1, 카드 수 = 결정 틱 수 = 연표의 선택 기록 수, 하드 상한 이하, 인생 길이가 판에 고정.
 */
export function measureLife(seed: number, era: Era, strategy: Strategy, lifeLength: LifeLength, pool: EventPool = EVENT_POOL): LifeMeasure {
  const start = startLife(seed, era, { lifeLength });
  const base = chooserFor(strategy, seed);
  const cards: CardFeature[] = [];
  // playToEnd는 chooser가 null이면 자동 성향 선택(autoResolveStep)을, 함수면 그 함수가 고른 id를 쓴다(null을 돌려주면 성향 선택). 카드를 재는 래퍼는 늘 함수이고 자동 전략이면 null(= 성향 선택)을 돌려준다.
  const chooser: Chooser = (s) => {
    const f = featureOf(s, pool);
    if (f !== null) cards.push(f);
    return base === null ? null : base(s);
  };
  const run = playToEnd(start, chooser, pool);
  const final = run.state;
  const problems: string[] = [];
  const tag = `${era}/${strategy}/${lifeLength} 시드 ${seed}`;
  if (final.phase !== 'ending' || final.death === null) problems.push(`${tag}: 사망에 도달하지 못했다`);
  const deathAge = final.death?.age ?? final.age;
  const c = run.counts;
  if (c.quiet + c.narrative + c.resolved + c.death !== deathAge + 1) problems.push(`${tag}: 해 수 합 ${c.quiet + c.narrative + c.resolved + c.death} ≠ 사망 나이 + 1 (${deathAge + 1})`);
  const choiceRows = final.history.filter((h) => h.kind === 'choice');
  if (cards.length !== c.choice || choiceRows.length !== c.choice) problems.push(`${tag}: 카드 ${cards.length} / 결정 틱 ${c.choice} / 연표 선택 ${choiceRows.length}이 서로 다르다`);
  if (final.lifeLength !== lifeLength) problems.push(`${tag}: 판의 인생 길이가 ${final.lifeLength}다`);
  if (c.choice > lifeModeOf(lifeLength).pacing.hard) problems.push(`${tag}: 결정 카드 ${c.choice}장이 하드 상한 ${lifeModeOf(lifeLength).pacing.hard}을 넘었다`);
  if (c.extraLines < 0) problems.push(`${tag}: 둘째 줄 수가 음수다`);
  choiceRows.forEach((h, i) => {
    if (cards[i] !== undefined) cards[i].resultLen = len(h.text);
  });
  const byStage = { infant: 0, school: 0, youth: 0, middle: 0, senior: 0 } as Record<Stage, number>;
  let cardsUpTo7 = 0;
  for (const h of choiceRows) {
    byStage[stageOfAge(h.age)]++;
    if (h.age <= 7) cardsUpTo7++;
  }
  return { seed, era, lifeLength, deathAge, counts: c, cards, byStage, cardsUpTo7, problems };
}

/** 시대 × 모드 × 전략의 count판 (simulateMany와 같은 시드 줄) */
export function measureMany(era: Era, count: number, strategy: Strategy, lifeLength: LifeLength, pool: EventPool = EVENT_POOL): LifeMeasure[] {
  const out: LifeMeasure[] = [];
  for (let i = 1; i <= count; i++) out.push(measureLife(i * 7919 + 13, era, strategy, lifeLength, pool));
  return out;
}

// ---------- 집계 ----------

const mean = (xs: readonly number[]): number => xs.reduce((a, b) => a + b, 0) / (xs.length || 1);
export const sdOf = (xs: readonly number[]): number => {
  const m = mean(xs);
  return Math.sqrt(mean(xs.map((x) => (x - m) ** 2)));
};
const quantile = (xs: readonly number[], p: number): number => {
  const v = [...xs].sort((a, b) => a - b);
  return v[Math.min(v.length - 1, Math.floor((p / 100) * v.length))];
};

export interface Dist {
  mean: number;
  sd: number;
  se: number;
  min: number;
  p05: number;
  p50: number;
  p95: number;
  max: number;
}
export function distStats(xs: readonly number[]): Dist {
  const sd = sdOf(xs);
  return { mean: mean(xs), sd, se: sd / Math.sqrt(xs.length || 1), min: Math.min(...xs), p05: quantile(xs, 5), p50: quantile(xs, 50), p95: quantile(xs, 95), max: Math.max(...xs) };
}

export interface EraSummary {
  era: Era;
  lifeLength: LifeLength;
  lives: number;
  deathAge: number;
  /** 해 수 평균: 조용 / 서술 / 결과(= 결정을 고른 해) / 결정 카드 */
  q: number;
  n: number;
  r: number;
  c: number;
  extraLines: number;
  cards: Dist;
  hard: number;
  /** 하드 상한 초과 판 수(구조적으로 0) / 하드 −1 이상인 판의 비율(%) */
  overHard: number;
  nearCapPct: number;
  /** 하드 상한에 닿은(= hard) 판의 비율(%) */
  atCapPct: number;
  /** 단계별 결정 카드 평균 */
  byStage: Record<Stage, number>;
  upTo7: number;
  /** 사망 나이 70세 이상 판의 수 / 그중 결정 카드 20장 미만인 비율(%) */
  longLives: number;
  under20Of70PlusPct: number;
  /** 시간(분): 옛 모델 / 새 모델의 읽기 수준별 */
  legacyMin: Dist;
  low: Dist;
  median: Dist;
  high: Dist;
  upper: Dist;
  /** 8배속 + 다음 결정으로(분, 중앙) — 참고 */
  fastMin: Dist;
  /** 연출 합(분, 1배속, 모드 계수·줄 대기 포함) */
  holdMin: number;
  /** 카드별 정밀 합계(중앙)의 판 평균(분)과 시대 상수 모델의 판 평균(분) */
  preciseMin: number;
  constantMin: number;
  problems: string[];
}

/** 카드 하나의 정밀 읽는 시간(초): 실제 글자 수로. 인용은 요약 전부 + 출처 줄 절반 + 숫자 해석 1.5초. level의 분당 글자 수·고르는 시간을 쓴다 */
export function preciseCardSec(f: CardFeature, level: 'low' | 'median' | 'high'): number {
  const cpm = READ_MODEL.cpm[level];
  const chars = f.titleLen + f.textLen + f.labelLens.reduce((a, b) => a + b, 0) + f.impactChars * READ_MODEL.chars.impactWeight;
  const cite = f.cited ? ((f.citeTextLen + 0.5 * f.citeSrcLen) / cpm) * 60 + 1.5 : 0;
  return (chars / cpm) * 60 + READ_MODEL.chooseSec[level] + cite;
}

/**
 * 시대 하나의 집계. hardRef는 페이싱을 끈 자연 분포(하드 상한이 무한)에서 「하드 상한 −1 이상」 비율을 **현재 하드 상한을 기준으로** 보려는 참조값이다 — 현재 모드의 하드 상한이 유한이면 그것을 쓴다.
 * 후보 비교는 withCandidate 안에서 부르므로 그 후보의 하드 상한이 곧 모드 표의 값이다.
 */
export function summarize(era: Era, lifeLength: LifeLength, lives: readonly LifeMeasure[], hardRef = LIFE_LENGTH_MODES.short30.pacing.hard): EraSummary {
  const modeHard = lifeModeOf(lifeLength).pacing.hard;
  const hard = Number.isFinite(modeHard) ? modeHard : hardRef;
  const choice = lives.map((l) => l.counts.choice);
  const min = (sec: (l: LifeMeasure) => number) => distStats(lives.map((l) => sec(l) / 60));
  const slow = { speed: 1 as const, skipToDecision: false };
  const fast = { speed: 8 as const, skipToDecision: true };
  const t = (l: LifeMeasure, level: 'low' | 'median' | 'high' | 'upper') => estimatePlaySeconds(l.counts, slow, lifeLength, era, level);
  const long = lives.filter((l) => l.deathAge >= 70);
  const holdSec = (l: LifeMeasure) => estimatePlaySeconds({ ...l.counts, choice: 0 }, slow, lifeLength, era, 'median');
  const byStage = Object.fromEntries(STAGES.map((st) => [st, mean(lives.map((l) => l.byStage[st]))])) as Record<Stage, number>;
  return {
    era,
    lifeLength,
    lives: lives.length,
    deathAge: mean(lives.map((l) => l.deathAge)),
    q: mean(lives.map((l) => l.counts.quiet)),
    n: mean(lives.map((l) => l.counts.narrative)),
    r: mean(lives.map((l) => l.counts.resolved)),
    c: mean(choice),
    extraLines: mean(lives.map((l) => l.counts.extraLines)),
    cards: distStats(choice),
    hard,
    overHard: choice.filter((x) => x > hard).length,
    nearCapPct: (choice.filter((x) => x >= hard - 1).length / lives.length) * 100,
    atCapPct: (choice.filter((x) => x >= hard).length / lives.length) * 100,
    byStage,
    upTo7: mean(lives.map((l) => l.cardsUpTo7)),
    longLives: long.length,
    under20Of70PlusPct: (long.filter((l) => l.counts.choice < 20).length / (long.length || 1)) * 100,
    legacyMin: min((l) => legacySeconds(l.counts)),
    low: min((l) => t(l, 'low')),
    median: min((l) => t(l, 'median')),
    high: min((l) => t(l, 'high')),
    upper: min((l) => t(l, 'upper')),
    fastMin: min((l) => estimatePlaySeconds(l.counts, fast, lifeLength, era, 'median')),
    holdMin: mean(lives.map((l) => holdSec(l) / 60)),
    preciseMin: mean(lives.map((l) => (holdSec(l) + l.cards.reduce((a, f) => a + preciseCardSec(f, 'median'), 0)) / 60)),
    constantMin: mean(lives.map((l) => t(l, 'median') / 60)),
    problems: lives.flatMap((l) => l.problems),
  };
}

// ---------- 글자 수 실측 ----------

export interface CharStats {
  /** 한 장 기준 평균 (뜬 카드 전체) */
  cards: number;
  title: number;
  body: number;
  /** 보인 선택지 라벨 수(카드당)와 라벨 평균 글자 수 */
  visibleLabels: number;
  label: number;
  result: number;
  /** 영향 줄: 카드당 글자 수(Σ 이름 + 기호), 선택지당 글자 수, 선택지당 항목 수 */
  impactPerCard: number;
  impactPerChoice: number;
  impactItemsPerChoice: number;
  /** 인용: 노출률, 요약 평균(시대 머리말 포함), 출처 줄 평균 */
  exposure: number;
  citeText: number;
  citeSrc: number;
}

/** 시대 하나의 뜬 카드 전체에서 센 글자 수 (카드 단위로 가중 — 많이 뜨는 카드가 더 반영된다) */
export function charStatsOf(lives: readonly LifeMeasure[]): CharStats {
  const cards = lives.flatMap((l) => l.cards);
  const labels = cards.flatMap((f) => f.labelLens);
  const choicesShown = labels.length;
  const cited = cards.filter((f) => f.cited);
  return {
    cards: cards.length,
    title: mean(cards.map((f) => f.titleLen)),
    body: mean(cards.map((f) => f.textLen)),
    visibleLabels: choicesShown / (cards.length || 1),
    label: mean(labels),
    result: mean(cards.map((f) => f.resultLen)),
    impactPerCard: mean(cards.map((f) => f.impactChars)),
    impactPerChoice: cards.reduce((a, f) => a + f.impactChars, 0) / (choicesShown || 1),
    impactItemsPerChoice: cards.reduce((a, f) => a + f.impactItems, 0) / (choicesShown || 1),
    exposure: cited.length / (cards.length || 1),
    citeText: mean(cited.map((f) => f.citeTextLen)),
    citeSrc: mean(cited.map((f) => f.citeSrcLen)),
  };
}

/** 풀에서 정적으로 센 글자 수(뜨는 빈도와 무관한 평균): 선택지 이벤트 제목·본문, 정의된 선택지 라벨·결과, 서술 이벤트 본문 — 시험이 READ_MODEL과 ±10%로 대조한다 */
export function poolCharStats(pool: EventPool = EVENT_POOL): { choiceEvents: number; title: number; body: number; labels: number; label: number; result: number; narrativeBody: number } {
  const choiceEvents = pool.events.filter((e) => e.choices !== undefined);
  const narrative = pool.events.filter((e) => e.choices === undefined && e.milestone !== true);
  const defined = choiceEvents.flatMap((e) => e.choices ?? []);
  return {
    choiceEvents: choiceEvents.length,
    title: mean(choiceEvents.map((e) => len(e.title))),
    body: mean(choiceEvents.map((e) => len(e.text))),
    labels: defined.length / (choiceEvents.length || 1),
    label: mean(defined.map((c) => len(c.label))),
    result: mean(defined.map((c) => len(c.result))),
    narrativeBody: mean(narrative.map((e) => len(e.text))),
  };
}

// ---------- 설정을 잠시 바꿔 측정 (후보 비교) ----------

export interface Candidate {
  label: string;
  pacing: ChoicePacing;
  /** 청년·중년·노년 선택지 빈도에 더하는 값(영유아·학창은 건드리지 않는다) */
  freq?: Partial<Record<'youth' | 'middle' | 'senior', number>>;
}

/** 후보 설정으로 fn을 돌리고 원래 값을 되돌린다 (모드 표의 페이싱과 EVENT_FREQUENCY를 잠시 덮어쓴다) */
export function withCandidate<T>(lifeLength: LifeLength, cand: Candidate, fn: () => T): T {
  const mode = LIFE_LENGTH_MODES[lifeLength];
  const savedPacing = { ...mode.pacing };
  const savedFreq = { youth: EVENT_FREQUENCY.youth.choice, middle: EVENT_FREQUENCY.middle.choice, senior: EVENT_FREQUENCY.senior.choice };
  try {
    Object.assign(mode.pacing, cand.pacing);
    for (const k of ['youth', 'middle', 'senior'] as const) EVENT_FREQUENCY[k].choice = Math.round((savedFreq[k] + (cand.freq?.[k] ?? 0)) * 1e6) / 1e6;
    return fn();
  } finally {
    Object.assign(mode.pacing, savedPacing);
    for (const k of ['youth', 'middle', 'senior'] as const) EVENT_FREQUENCY[k].choice = savedFreq[k];
  }
}

/**
 * `--cands=soft:hard[:빈도+],…` 인자를 후보 목록으로 읽는다(REV-003-M8-1 R-420: 숫자 검증 — NaN 후보가 조용히 돌지 않는다). 잘못된 값이면 이유를 적은 문자열을 돌려준다.
 * 소프트·하드는 1~200의 정수(하드 ≥ 소프트), 빈도는 0~0.5의 수. 소프트 계수는 0.3 고정.
 */
export function parseCandidates(given: string): Candidate[] | string {
  const out: Candidate[] = [];
  const okInt = (x: number): boolean => Number.isInteger(x) && x >= 1 && x <= 200;
  for (const c of given.split(',')) {
    const parts = c.split(':');
    const [soft, hard, d] = parts.map((x) => (x.trim() === '' ? Number.NaN : Number(x)));
    const freqOk = parts.length === 3 && Number.isFinite(d) && d >= 0 && d <= 0.5;
    if ((parts.length !== 2 && !freqOk) || !okInt(soft) || !okInt(hard) || hard < soft) {
      return `--cands 값 「${c}」이 올바르지 않다. 형식: soft:hard[:빈도+] — 소프트·하드는 1 이상 정수(하드 ≥ 소프트), 빈도는 0~0.5 (예: --cands=25:28,29:33:0.05)`;
    }
    out.push({ label: `soft ${soft} / hard ${hard}${d ? ` + 빈도 +${d}` : ''}`, pacing: { soft, softFactor: 0.3, hard }, ...(d ? { freq: { youth: d, middle: d, senior: d } } : {}) });
  }
  return out;
}

/** 페이싱을 끈 자연 분포 후보 (soft = hard = 무한) */
export const NATURAL: Candidate = { label: '자연(페이싱 끔)', pacing: { soft: Infinity, softFactor: 1, hard: Infinity } };

export { ERAS, holdMsFor, extraLineMsFor, readSecFor };
