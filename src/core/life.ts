import { ERA_CONFIG } from '../data/birthTable';
import { EVENT_POOL } from '../data/events';
import {
  EDUCATION_GROWTH,
  EVENT_FREQUENCY,
  HEALTH_DECAY,
  INCOME_BY_EDUCATION,
  CHOICE_PACING,
  INDEPENDENCE,
  MIN_YEARS_BETWEEN_CHOICES,
  MOOD_DRIFT,
  MORTALITY,
  SENIOR_RELATIONSHIP_DECAY_EVERY,
  SENIOR_WEALTH_DRAIN_BASE,
  STAGE_ENTRY_TEXT,
} from '../data/lifeTable';
import { deathCauseCandidates, deathEntryText } from '../data/lifeText';
import {
  eventWeight,
  isChoiceEvent,
  isEventEligible,
  resolveEffects,
  stageOfAge,
  visibleChoices,
  type CondContext,
  type EventDef,
  type EventPool,
  type ResolvedEffects,
} from './events';
import { appendHistory } from './history';
import { createRng, type Rng } from './rng';
import { applyStatDeltas, clampStat, type StatDeltas } from './stats';
import { PARENT_WEALTHS, type Character, type Era, type GameState, type Stage, type StatKey, type Stats } from './types';

/**
 * 인생 진행 루프(순수 함수). React·타이머·Date·Math.random을 쓰지 않고 시드 RNG만 쓴다.
 * 같은 시드 + 같은 선택 → 같은 인생. 중간에 직렬화↔복원해도 같다(RNG 상태와 모든 진행 정보가 GameState에 있다).
 *
 * 한 해의 흐름(나이 a를 사는 해):
 *   1) 이벤트 추첨(선택지 → 서술 순). 선택지 이벤트면 pending에 넣고 여기서 멈춘다(stepYear가 같은 상태를 돌려주는 동안 시간은 흐르지 않는다).
 *   2) 서술 이벤트면 효과를 적용하고 연표에 남긴다. (선택지는 resolveChoice가 효과를 적용한다.)
 *   3) 한 해 마무리(finishYear): 단계별 자연 변화 → 사망 판정 → 살아 있으면 나이 +1(단계가 바뀌면 연표에 한 줄).
 */

// ---------- 단계·사망 ----------

export { stageOfAge as stageOf };

export function maxAgeOf(era: Era): number {
  return ERA_CONFIG[era].life.maxAge;
}

/** 나이 a를 사는 해에 죽을 확률. 절대 상한 나이는 호출하는 쪽(finishYear)이 따로 처리한다. */
export function deathChance(age: number, health: number, era: Era): number {
  const base = MORTALITY.baseline + MORTALITY.gompertzA * Math.exp(MORTALITY.gompertzB * age);
  const healthFactor = Math.pow(2, (50 - health) / MORTALITY.healthDoubling);
  let q = base * healthFactor * ERA_CONFIG[era].life.mortalityScale;
  if (health < MORTALITY.criticalBelow) q += (MORTALITY.criticalBelow - health) * MORTALITY.criticalStep;
  return Math.min(1, Math.max(0, q));
}

// ---------- 자연 변화 ----------

/** 학창기 연간 학력 증가: 가정의 교육 여건(부모 재력·교육방식)이 성장 속도를 정한다(R-025). */
export function educationGrowthPerYear(c: Pick<Character, 'parentWealth' | 'parenting'>): number {
  const g = EDUCATION_GROWTH;
  const raw = g.schoolBase + g.byWealth[PARENT_WEALTHS.indexOf(c.parentWealth)] + g.byParenting[c.parenting];
  return Math.min(g.max, Math.max(g.min, raw));
}

function incomeStep(stage: 'youth' | 'middle', education: number, age: number): number {
  const rule = INCOME_BY_EDUCATION[stage].find(([minEdu]) => education >= minEdu);
  return rule !== undefined && age % rule[1] === 0 ? 1 : 0;
}

function healthDecay(stage: 'youth' | 'middle' | 'senior', age: number): number {
  let total = 0;
  for (const r of HEALTH_DECAY[stage]) if (age >= r.fromAge && (age - r.fromAge) % r.every === 0) total += r.amount;
  return total;
}

/**
 * 학창기 출생 편차 되돌리기 (R-063): 출생 값이 50에서 벗어난 만큼의 fadeShare를 fromAge~toAge 사이에 고르게 걷어 낸다.
 * 나이 a의 변화량 = (a까지 걷어 낸 누적량) - (a-1까지 걷어 낸 누적량). 누적량은 출생 값과 나이만의 함수라서 선택(이벤트 효과)에 영향을 받지 않는다.
 * 합은 (출생 값 - 50)의 fadeShare를 반올림한 값(부호 반대)이고, 한 해의 변화는 편차가 ±16 안이면 -1·0·+1이다
 * (출생 행복은 약 31~68, 관계는 약 35~61이라 가장 벗어나도 한 해 최대 ±2).
 */
export function birthFadeDelta(birthValue: number, age: number): number {
  const { fadeShare, fromAge, toAge } = MOOD_DRIFT.school;
  if (age < fromAge || age > toAge) return 0;
  const span = toAge - fromAge + 1;
  const removed = (years: number) => Math.round(-(birthValue - 50) * fadeShare * (years / span));
  const d = removed(age - fromAge + 1) - removed(age - fromAge);
  return d === 0 ? 0 : d; // -0 방지
}

/**
 * 나이 a를 살고 난 뒤의 단계별 자연 변화(정수, 스케줄 방식이라 RNG를 쓰지 않는다).
 * birth(출생 스탯)를 주면 학창기에 행복·관계의 출생 편차를 걷어 낸다(birthFadeDelta). 주지 않으면 학창기 회귀는 없다.
 */
export function naturalDeltas(age: number, character: Character, stats: Stats, era: Era, birth?: Pick<Stats, 'happiness' | 'relationships'> | null): StatDeltas {
  const stage = stageOfAge(age);
  const d: StatDeltas = {};
  const add = (k: StatKey, v: number) => {
    if (v !== 0) d[k] = (d[k] ?? 0) + v;
  };
  switch (stage) {
    case 'infant':
      add('education', EDUCATION_GROWTH.infant);
      break;
    case 'school':
      add('education', educationGrowthPerYear(character));
      break;
    case 'youth':
      if (age <= EDUCATION_GROWTH.youthUntilAge && age % 2 === 0) add('education', 1);
      add('wealth', incomeStep('youth', stats.education, age));
      add('health', -healthDecay('youth', age));
      break;
    case 'middle':
      add('wealth', incomeStep('middle', stats.education, age));
      add('health', -healthDecay('middle', age));
      break;
    case 'senior': {
      add('health', -healthDecay('senior', age));
      const drainEvery = Math.max(2, Math.round(SENIOR_WEALTH_DRAIN_BASE / ERA_CONFIG[era].priceIndex));
      if (age % drainEvery === 0) add('wealth', -1);
      if (age % SENIOR_RELATIONSHIP_DECAY_EVERY === 0) add('relationships', -1);
      break;
    }
  }
  // 평균으로의 회귀(R-045 b, R-063): 행복·관계는 출생값(부모 재력·교육방식이 정한 값)에 평생 묶이지 않는다. 표와 이유는 data/lifeTable.ts#MOOD_DRIFT.
  if (stage === 'school') {
    if (birth !== undefined && birth !== null) {
      add('happiness', birthFadeDelta(birth.happiness, age)); // 출생 편차만 걷어 낸다: 선택의 효과는 건드리지 않는다
      add('relationships', birthFadeDelta(birth.relationships, age));
    }
  } else if (stage !== 'infant') {
    const rule = MOOD_DRIFT.adult;
    if (age % rule.every === 0) {
      for (const key of ['happiness', 'relationships'] as const) {
        if (stats[key] > rule.high) add(key, -1);
        else if (stats[key] < rule.low) add(key, 1);
      }
    }
  }
  return d;
}

/** 스무 살 독립: 재산이 집안 형편에서 내가 가진 것으로 바뀐다. */
export function independenceWealth(wealth: number, education: number): number {
  return clampStat(INDEPENDENCE.familyShare * wealth + INDEPENDENCE.educationShare * education + INDEPENDENCE.base);
}

// ---------- 상태 갱신 도우미 ----------

function ctxOf(state: GameState): CondContext {
  if (state.character === null) throw new Error('ctxOf: 캐릭터가 없다');
  return { character: state.character, stats: state.stats, flags: new Set(state.flags) };
}

/** 플래그를 끄고(clear) 켠다(set). 정렬·중복 없는 배열. 같은 플래그가 둘 다 있으면 켜는 쪽이 이긴다. */
export function applyFlags(flags: readonly string[], setFlags: readonly string[], clearFlags: readonly string[]): string[] {
  const s = new Set(flags);
  for (const f of clearFlags) s.delete(f);
  for (const f of setFlags) s.add(f);
  return [...s].sort();
}

function applyResolved(state: GameState, eff: ResolvedEffects): GameState {
  return { ...state, stats: applyStatDeltas(state.stats, eff.stats), flags: applyFlags(state.flags, eff.setFlags, eff.clearFlags) };
}

/**
 * 단계별 이벤트 색인(풀마다 한 번 만든다). 매년 후보를 고를 때 풀 전체가 아니라 그 단계의 이벤트만 훑어 시뮬레이션이 빠르다.
 * 색인은 풀의 이벤트 순서를 그대로 지키므로 후보 목록과 가중 추첨 결과는 풀 전체를 훑을 때와 완전히 같다.
 */
const STAGE_INDEX = new WeakMap<EventPool, Record<Stage, EventDef[]>>();
function eventsForStage(pool: EventPool, stage: Stage): readonly EventDef[] {
  let index = STAGE_INDEX.get(pool);
  if (index === undefined) {
    index = { infant: [], school: [], youth: [], middle: [], senior: [] };
    for (const ev of pool.events) for (const s of ev.stages) index[s].push(ev);
    STAGE_INDEX.set(pool, index);
  }
  return index[stage];
}

function pickWeighted(rng: Rng, list: readonly EventDef[], ctx: CondContext): EventDef | null {
  if (list.length === 0) return null;
  return list[rng.weightedIndex(list.map((ev) => eventWeight(ev, ctx)))];
}

// ---------- 한 해 진행 ----------

/** 이번 한 걸음에서 무슨 일이 있었는가 (UI가 연출 시간을 정하고, 시간 모델이 집계한다). */
export type TickKind =
  /** 아무 일 없이 한 해가 지났다 */
  | 'quiet'
  /** 서술 이벤트가 있었다 */
  | 'narrative'
  /** 선택지 이벤트가 나와 결정을 기다린다 */
  | 'choice'
  /** 선택을 마치고 한 해가 지났다 */
  | 'resolved'
  /** 사망했다 */
  | 'death'
  /** 아무것도 하지 않았다(진행할 수 없는 상태) */
  | 'none';

export interface TickInfo {
  kind: TickKind;
  /** 이 걸음을 시작할 때의 나이 */
  fromAge: number;
  eventId?: string;
}

export interface StepResult {
  state: GameState;
  tick: TickInfo;
}

function noop(state: GameState): StepResult {
  return { state, tick: { kind: 'none', fromAge: state.age } };
}

function finishYear(s: GameState, rng: Rng): { state: GameState; died: boolean } {
  if (s.character === null || s.era === null) throw new Error('finishYear: 캐릭터/시대가 없다');
  const age = s.age;
  const stats = applyStatDeltas(s.stats, naturalDeltas(age, s.character, s.stats, s.era, s.birthStats));
  // 난수는 해마다 정확히 한 번 쓴다(상한 나이에서도 소비해 수열이 일정하다).
  const roll = rng.next();
  const died = age >= maxAgeOf(s.era) || roll < deathChance(age, stats.health, s.era);
  if (died) {
    const cause = rng.pick(deathCauseCandidates(age, stats.health));
    return {
      died: true,
      state: {
        ...s,
        phase: 'ending',
        stats,
        pending: null,
        death: { age, cause },
        history: appendHistory(s.history, { age, kind: 'death', text: deathEntryText(cause) }),
        rngState: rng.getState(),
      },
    };
  }
  const newAge = age + 1;
  const oldStage = stageOfAge(age);
  const newStage = stageOfAge(newAge);
  let next: GameState = { ...s, stats, age: newAge, rngState: rng.getState() };
  if (newStage !== oldStage && newStage !== 'infant') {
    next = { ...next, history: appendHistory(next.history, { age: newAge, kind: 'stage', text: STAGE_ENTRY_TEXT[newStage] }) };
    if (newStage === 'youth') {
      next = { ...next, stats: { ...next.stats, wealth: independenceWealth(next.stats.wealth, next.stats.education) } };
    }
  }
  return { state: next, died: false };
}

/**
 * 한 해를 진행한다. 진행할 수 없는 상태(life가 아님 / 대기 중인 선택지가 있음)면 같은 상태를 돌려준다
 * → 타이머가 겹치거나 버튼을 연타해도 한 해가 두 번 진행되거나 선택지를 건너뛰지 않는다.
 */
export function stepYear(state: GameState, pool: EventPool = EVENT_POOL): StepResult {
  if (state.phase !== 'life' || state.pending !== null || state.character === null || state.era === null) return noop(state);

  const rng = createRng(state.rngState);
  const age = state.age;
  const freq = EVENT_FREQUENCY[stageOfAge(age)];
  const rollChoice = rng.next();
  const rollNarrative = rng.next();

  const ctx = ctxOf(state);
  const view = { ...ctx, age, era: state.era, seen: state.seen };
  const eligible = eventsForStage(pool, stageOfAge(age)).filter((ev) => isEventEligible(ev, view));
  // 선택지는 간격을 두고, 한 판의 선택지 수 조절(CHOICE_PACING)을 따른다. 지금까지 푼 선택지 수는 연표의 선택 기록 수다.
  const choicesSoFar = state.history.reduce((n, h) => (h.kind === 'choice' ? n + 1 : n), 0);
  const canChoice = (state.lastChoiceAge === null || age - state.lastChoiceAge >= MIN_YEARS_BETWEEN_CHOICES) && choicesSoFar < CHOICE_PACING.hard;
  const choiceChance = freq.choice * (choicesSoFar >= CHOICE_PACING.soft ? CHOICE_PACING.softFactor : 1);

  let picked: EventDef | null = null;
  if (rollChoice < choiceChance && canChoice) picked = pickWeighted(rng, eligible.filter(isChoiceEvent), ctx);
  if (picked === null && rollNarrative < freq.narrative) picked = pickWeighted(rng, eligible.filter((ev) => !isChoiceEvent(ev)), ctx);

  if (picked !== null && isChoiceEvent(picked)) {
    const visible = visibleChoices(picked, ctx);
    return {
      state: {
        ...state,
        rngState: rng.getState(),
        seen: { ...state.seen, [picked.id]: age },
        lastChoiceAge: age,
        pending: { eventId: picked.id, key: `${picked.id}@${age}`, age, choiceIds: visible.map((c) => c.id) },
      },
      tick: { kind: 'choice', fromAge: age, eventId: picked.id },
    };
  }

  let s: GameState = state;
  if (picked !== null) {
    s = applyResolved(s, resolveEffects(picked.effects, picked.bonuses, ctx));
    s = {
      ...s,
      seen: { ...s.seen, [picked.id]: age },
      history: appendHistory(s.history, { age, kind: 'event', title: picked.title, text: picked.text, eventId: picked.id }),
    };
  }
  const { state: next, died } = finishYear(s, rng);
  return { state: next, tick: { kind: died ? 'death' : picked !== null ? 'narrative' : 'quiet', fromAge: age, eventId: picked?.id } };
}

/** 한 해 진행의 상태만 필요할 때 */
export function advanceYear(state: GameState, pool: EventPool = EVENT_POOL): GameState {
  return stepYear(state, pool).state;
}

/**
 * 대기 중인 선택지에 답한다. key가 대기 중인 이벤트 인스턴스의 키와 다르거나, choiceId가 화면에 보인 선택지가 아니면
 * 같은 상태를 돌려준다(연타·늦게 도착한 입력이 다음 선택지를 건드리지 못한다).
 */
export function resolveChoiceStep(state: GameState, key: string, choiceId: string, pool: EventPool = EVENT_POOL): StepResult {
  const pending = state.pending;
  if (state.phase !== 'life' || pending === null || pending.key !== key || !pending.choiceIds.includes(choiceId)) return noop(state);
  if (state.character === null || state.era === null) return noop(state);
  const ev = pool.byId.get(pending.eventId);
  const choice = ev?.choices?.find((c) => c.id === choiceId);
  if (ev === undefined || choice === undefined) throw new Error(`resolveChoice: 이벤트/선택지를 찾을 수 없다 (${pending.eventId}/${choiceId})`);

  const ctx = ctxOf(state);
  let s = applyResolved(state, resolveEffects(choice.effects, choice.bonuses, ctx));
  s = {
    ...s,
    pending: null,
    history: appendHistory(s.history, {
      age: pending.age,
      kind: 'choice',
      title: ev.title,
      text: choice.result,
      choice: choice.label,
      eventId: ev.id,
    }),
  };
  // 선택을 하나 해결할 때마다 난수를 정확히 한 번 먼저 소비한다. 이 한 번의 난수는 자동 선택이 선택지를 고르는 데 쓰고(autoResolveStep),
  // 수동 선택에서는 버린다. 그래서 같은 상태에서 같은 선택지를 고르면 자동이었든 수동이었든 난수 수열이 똑같이 한 칸 나아가
  // 이후 인생이 완전히 같다(R-039). (난수는 stepYear 이후 해마다 finishYear가 한 번씩 쓴다 — 선택 한 번에 한 번이 더해질 뿐이다.)
  // 자동 선택용 수열을 따로 두는 방식(시드·이벤트 키에서 파생)도 가능하지만, 저장 상태의 rngState 하나로 모든 것이 이어진다는
  // 지금의 단순함(저장 스키마·복원 규칙 그대로)을 지키려고 같은 수열에서 한 칸을 예약하는 쪽을 골랐다.
  const rng = createRng(state.rngState);
  rng.next();
  const { state: next, died } = finishYear(s, rng);
  return { state: next, tick: { kind: died ? 'death' : 'resolved', fromAge: pending.age, eventId: ev.id } };
}

export function resolveChoice(state: GameState, key: string, choiceId: string, pool: EventPool = EVENT_POOL): GameState {
  return resolveChoiceStep(state, key, choiceId, pool).state;
}

// ---------- 자동 선택 (성향 기반) ----------

/**
 * 자동 모드의 "성향": 부모의 교육방식이 캐릭터의 가치관을 만들고(어디에 무게를 두는가),
 * 지금 스탯이 낮을수록 그 스탯을 올리는 선택에 끌린다. 결정은 점수에 비례한 확률로 시드 RNG가 뽑는다(항상 같은 답만 고르지 않는다).
 */
export const AUTO_PRIORITY: Record<Character['parenting'], Record<StatKey, number>> = {
  strict: { wealth: 1.2, education: 1.5, health: 1.0, happiness: 0.7, relationships: 0.8 },
  free: { wealth: 0.9, education: 0.8, health: 1.0, happiness: 1.5, relationships: 1.2 },
  helicopter: { wealth: 1.0, education: 1.3, health: 1.3, happiness: 0.9, relationships: 1.0 },
  neglect: { wealth: 1.4, education: 0.9, health: 0.9, happiness: 1.0, relationships: 0.8 },
};
/** 점수 → 가중치(exp(점수 / 온도)). 클수록 무작위에 가깝다. */
export const AUTO_TEMPERATURE = 6;
/** exp()에 넣는 값의 절댓값 상한 (exp(40) ≈ 2.4e17 — 선택지 3개를 더해도 유한하다) */
export const AUTO_EXPONENT_LIMIT = 40;

/** 보이는 선택지마다의 자동 선택 가중치 (순서는 pending.choiceIds와 같다). RNG를 쓰지 않는 순수 계산. */
export function autoChoiceWeights(state: GameState, pool: EventPool = EVENT_POOL): { ids: string[]; weights: number[] } | null {
  const pending = state.pending;
  if (state.phase !== 'life' || pending === null || state.character === null) return null;
  const ev = pool.byId.get(pending.eventId);
  if (ev === undefined) throw new Error(`autoChoiceWeights: 이벤트를 찾을 수 없다 (${pending.eventId})`);
  const ctx = ctxOf(state);
  const priority = AUTO_PRIORITY[state.character.parenting];
  const weights = pending.choiceIds.map((id) => {
    const choice = ev.choices?.find((c) => c.id === id);
    if (choice === undefined) throw new Error(`autoChoiceWeights: 선택지를 찾을 수 없다 (${id})`);
    const eff = resolveEffects(choice.effects, choice.bonuses, ctx);
    let score = 0;
    for (const [key, delta] of Object.entries(eff.stats) as [StatKey, number][]) {
      const need = 1 + (50 - state.stats[key]) / 100; // 이미 높은 스탯보다 낮은 스탯이 더 절실하다(0.5~1.5)
      score += delta * priority[key] * need;
    }
    // 점수가 비정상적으로 커져도 가중치가 Infinity·0이 되지 않게 지수를 제한한다(R-046: 데이터 검증이 합산 상한을 두지만 런타임도 방어한다).
    return Math.exp(Math.max(-AUTO_EXPONENT_LIMIT, Math.min(AUTO_EXPONENT_LIMIT, score / AUTO_TEMPERATURE)));
  });
  return { ids: [...pending.choiceIds], weights };
}

/**
 * 대기 중인 선택지를 성향에 따라 자동으로 고르고 진행한다. 대기 중인 선택지가 없거나 key가 다르면 같은 상태.
 * 고르는 난수는 resolveChoiceStep이 선택마다 먼저 소비하는 바로 그 한 번의 난수와 같다(같은 상태에서 시작하므로 수열의 첫 값).
 * 따라서 결과는 "자동이 고른 선택지를 수동으로 고른 것"과 상태 전체가 같다(R-039).
 */
export function autoResolveStep(state: GameState, key: string, pool: EventPool = EVENT_POOL): StepResult {
  if (state.pending === null || state.pending.key !== key) return noop(state);
  const w = autoChoiceWeights(state, pool);
  if (w === null) return noop(state);
  const id = w.ids[createRng(state.rngState).weightedIndex(w.weights)];
  return resolveChoiceStep(state, key, id, pool);
}

// ---------- 여러 해를 한꺼번에 (다음 결정으로 · 자동 모드 · 시뮬레이션) ----------

export interface TickCounts {
  quiet: number;
  narrative: number;
  choice: number;
  resolved: number;
  death: number;
}

export function emptyCounts(): TickCounts {
  return { quiet: 0, narrative: 0, choice: 0, resolved: 0, death: 0 };
}

function count(counts: TickCounts, tick: TickInfo): void {
  if (tick.kind !== 'none') counts[tick.kind]++;
}

/** 안전장치: 한 번의 연속 진행이 이 걸음 수를 넘으면 무한 루프로 보고 throw */
const MAX_STEPS = 1000;

export interface RunResult {
  state: GameState;
  counts: TickCounts;
  /** 마지막 걸음 */
  last: TickInfo;
}

/**
 * 다음 결정으로: 선택지 이벤트(또는 사망)가 나올 때까지 연출 없이 즉시 진행한다.
 * 이미 대기 중인 선택지가 있으면 움직이지 않는다.
 */
export function advanceUntilDecision(state: GameState, pool: EventPool = EVENT_POOL): RunResult {
  let s = state;
  const counts = emptyCounts();
  let last: TickInfo = { kind: 'none', fromAge: s.age };
  for (let i = 0; s.phase === 'life' && s.pending === null; i++) {
    if (i >= MAX_STEPS) throw new Error('advanceUntilDecision: 진행이 끝나지 않는다');
    const r = stepYear(s, pool);
    s = r.state;
    last = r.tick;
    count(counts, r.tick);
  }
  return { state: s, counts, last };
}

/** 선택을 고르는 함수: 대기 중인 선택지가 있는 상태를 받아 고를 선택지 id를 돌려준다(또는 null이면 자동 성향 선택). */
export type Chooser = (state: GameState) => string | null;

/**
 * 끝(사망)까지 진행한다. chooser가 null이면 자동 모드(성향 선택), 함수면 그 함수가 고른다(manual 시뮬레이션용).
 * 같은 시드 + 같은 선택 → 같은 결과.
 * 시뮬레이션·테스트·e2e 기대값 계산용이다. 화면(세션 reducer)은 쓰지 않는다 — 자동 모드도 타이머가 선택지를 한 걸음씩 고른다(R-038).
 */
export function playToEnd(state: GameState, chooser: Chooser | null = null, pool: EventPool = EVENT_POOL): RunResult {
  let s = state;
  const counts = emptyCounts();
  let last: TickInfo = { kind: 'none', fromAge: s.age };
  for (let i = 0; s.phase === 'life'; i++) {
    if (i >= MAX_STEPS) throw new Error('playToEnd: 진행이 끝나지 않는다');
    let r: StepResult;
    if (s.pending !== null) {
      const picked = chooser === null ? null : chooser(s);
      r = picked === null ? autoResolveStep(s, s.pending.key, pool) : resolveChoiceStep(s, s.pending.key, picked, pool);
      if (r.state === s) throw new Error('playToEnd: 선택이 적용되지 않았다');
    } else {
      r = stepYear(s, pool);
    }
    s = r.state;
    last = r.tick;
    count(counts, r.tick);
  }
  return { state: s, counts, last };
}
