import { ERA_CONFIG } from '../data/birthTable';
import { EVENT_POOL } from '../data/events';
import { AUTO_ASSET } from '../data/economyTable';
import {
  EARLY_YEARS_MAX_AGE,
  EDUCATION_GROWTH,
  EVENT_FREQUENCY,
  HEALTH_DECAY,
  INHERIT_NOTE_TEXT,
  MIN_YEARS_BETWEEN_CHOICES,
  MOOD_DRIFT,
  MORTALITY,
  SENIOR_RELATIONSHIP_DECAY_EVERY,
  STAGE_ENTRY_TEXT,
} from '../data/lifeTable';
import { deathCauseCandidates, deathEntryText } from '../data/lifeText';
import { lifeModeOf } from '../data/timingTable';
import {
  eventWeight,
  isChoiceEvent,
  isEventEligible,
  isMilestoneEvent,
  MILESTONES_PER_YEAR_MAX,
  resolveEffects,
  stageOfAge,
  visibleChoices,
  type CondContext,
  type EventDef,
  type EventPool,
} from './events';
import { applyResolved, condContextOf, economyContextOf } from './apply';
import { initialAssets, settleAssets, yearlyAssets } from './economy';
import { appendHistory } from './history';
import { impactOfEffects } from './impact';
import { dwellingWhenParentsGone, inheritanceAmount, inheritanceDue, parentsAllGone, parentsJustGone, siblingCountOf } from './inherit';
import type { NoteCardDef } from './noteCards';
import { consumeNote, dueNote, type NoteMode } from './notes';
import { createRng, type Rng } from './rng';
import { applyStatDeltas, type StatDeltas } from './stats';
import { PARENT_WEALTHS, type Character, type Era, type GameState, type HistoryEntry, type Stage, type StatKey, type Stats } from './types';

/**
 * 인생 진행 루프(순수 함수). React·타이머·Date·Math.random을 쓰지 않고 시드 RNG만 쓴다.
 * 같은 시드 + 같은 선택 → 같은 인생. 중간에 직렬화↔복원해도 같다(RNG 상태와 모든 진행 정보가 GameState에 있다).
 *
 * 한 해의 흐름(나이 a를 사는 해):
 *   0) 마일스톤 슬롯(M7a): 창 안의 마일스톤(첫 예방접종·첫 걸음마·첫 말)이 일반 추첨과 별개로 한 줄을 남긴다(창의 마지막 해는 100%). 한 해에 줄이 둘일 수 있다.
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
export function naturalDeltas(age: number, character: Character, stats: Stats, _era: Era, birth?: Pick<Stats, 'happiness' | 'relationships'> | null): StatDeltas {
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
      add('health', -healthDecay('youth', age));
      break;
    case 'middle':
      add('health', -healthDecay('middle', age));
      break;
    case 'senior':
      add('health', -healthDecay('senior', age));
      if (age % SENIOR_RELATIONSHIP_DECAY_EVERY === 0) add('relationships', -1);
      break;
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
  /** 그 해의 주된 사건(선택지·서술). 일반 추첨에서 아무것도 안 나온 해에 마일스톤만 있었다면 첫 마일스톤(id 오름차순)의 id다 */
  eventId?: string;
  /** 그 해 마일스톤 슬롯에서 일어난 이벤트 id들(id 오름차순) (SPEC-003 IN3, M7a r3 — 일반 사건과 별개 줄이라 한 해 연표에 여러 줄이 남을 수 있다: 1세는 걸음마 + 첫 말 + 일반 사건 최대 3줄 이상) */
  milestoneIds?: string[];
  /**
   * 그 해 연표에 남은 사건·선택 줄 수(마일스톤 + 일반 사건 + 결정 결과, `yearLineCount`) — 연출 대기가 둘째 줄부터 줄마다 길어진다(SPEC-003 LM2, core/timing.ts#holdMsFor).
   * 대기가 있는 걸음(서술 해 `narrative`·결과 해 `resolved`)에만 담는다. 새로고침 직후(tick 없음)에는 모르므로 조용한 해 값으로 대기한다.
   */
  lines?: number;
}

/**
 * 한 해(나이 age)에 연표에 남은 사건·선택 줄 수: `event`와 `choice` 줄만 센다(`stage`·`death`·`note` 줄은 읽는 연출 대기의 대상이 아니다).
 * 한 해에 줄이 둘 이상일 수 있다 — 마일스톤 슬롯(M7a r3)이 일반 사건과 별개로 한 줄을 남기고, 결정을 고른 해는 마일스톤 줄 뒤에 결과 줄이 붙는다.
 */
export function yearLineCount(history: readonly HistoryEntry[], age: number): number {
  let n = 0;
  for (const h of history) if (h.age === age && (h.kind === 'event' || h.kind === 'choice')) n++;
  return n;
}

export interface StepResult {
  state: GameState;
  tick: TickInfo;
}

function noop(state: GameState): StepResult {
  return { state, tick: { kind: 'none', fromAge: state.age } };
}

/** 상속을 받는 해 연표에 한 줄을 남긴다 (금액은 적지 않는다 — D8) */
const inheritanceLine = (age: number): HistoryEntry => ({ age, kind: 'event', text: INHERIT_NOTE_TEXT });

/**
 * 한 해 마무리. `before`는 **이 해를 시작할 때의 상태**(그 해의 사건·선택 효과를 적용하기 전)다 — 간이 상속(D10 변경, r3)이 「부모가 처음 모두 떠나는 해」를 가르는 기준이다.
 * 상속은 선택의 효과가 아니라 해 끝 규칙이다: 원인이 사건(`parents_gone`)이든 나이 상한(어머니·아버지 모두 100세 초과)이든 이 함수 한 곳에서 한 번 더한다(영향 표기에 들어가지 않는다).
 * 연표 한 줄은 그 해 사건·선택 기록 바로 뒤에 남는다(나이 상한으로 처음 떠나는 해는 한 살 많은 나이의 줄).
 */
function finishYear(s: GameState, rng: Rng, before: GameState = s): { state: GameState; died: boolean } {
  if (s.character === null || s.era === null) throw new Error('finishYear: 캐릭터/시대가 없다');
  const age = s.age;
  const stats = applyStatDeltas(s.stats, naturalDeltas(age, s.character, s.stats, s.era, s.birthStats));
  // 20세 이상: 이 해의 경제(소득 − 생활비 − 주거비 − 이자, 상환, 자동 대출). 자연 변화로 바뀐 지식(학력 배수)을 반영한다. 난수를 쓰지 않는다.
  const assets = s.assets === null ? null : yearlyAssets(s.assets, { ...economyContextOf(s), education: stats.education });
  // 난수는 해마다 정확히 한 번 쓴다(상한 나이에서도 소비해 수열이 일정하다).
  const roll = rng.next();
  const died = age >= maxAgeOf(s.era) || roll < deathChance(age, stats.health, s.era);
  // 간이 상속(해 끝 규칙): 이 해 끝(사망이면 같은 나이, 아니면 한 살 많은 나이 — 부모의 나이도 한 해 오른다)에 부모가 처음 모두 떠났다면 정산 뒤 순자산에 한 번 더한다. 난수를 쓰지 않는다.
  const inherited = assets === null ? 0 : inheritanceDue(before, { ...s, age: died ? age : age + 1, assets });
  const inheritedAssets = inherited > 0 && assets !== null ? settleAssets({ ...assets, net: assets.net + inherited }) : assets;
  // 부모가 처음 모두 떠난 해 끝(상속을 더한 뒤): 가족 집에 살고 있었다면 월세로 나온다 (M7e-3 마스터 결정 추가②, economy-model.md 4-2절). 난수를 쓰지 않는다.
  const settled =
    inheritedAssets !== null && parentsJustGone(before, { ...s, age: died ? age : age + 1, assets: inheritedAssets })
      ? { ...inheritedAssets, dwelling: dwellingWhenParentsGone(inheritedAssets.dwelling, s.flags) }
      : inheritedAssets;
  const history = inherited > 0 ? appendHistory(s.history, inheritanceLine(parentsAllGone({ ...s, age }) ? age : age + 1)) : s.history;
  if (died) {
    const cause = rng.pick(deathCauseCandidates(age, stats.health));
    return {
      died: true,
      state: {
        ...s,
        phase: 'ending',
        stats,
        assets: settled,
        pending: null,
        paused: false, // 일시정지는 인생 단계에서만 있을 수 있다(저장 검증, DB3) — 일시정지 중 고른 선택이 마지막이었어도 엔딩에는 남지 않는다
        death: { age, cause },
        history: appendHistory(history, { age, kind: 'death', text: deathEntryText(cause) }),
        rngState: rng.getState(),
      },
    };
  }
  const newAge = age + 1;
  const oldStage = stageOfAge(age);
  const newStage = stageOfAge(newAge);
  let next: GameState = { ...s, stats, assets: settled, history, age: newAge, rngState: rng.getState() };
  if (newStage !== oldStage && newStage !== 'infant') {
    next = { ...next, history: appendHistory(next.history, { age: newAge, kind: 'stage', text: STAGE_ENTRY_TEXT[newStage] }) };
    if (newStage === 'youth') {
      // 독립(20세): 부모 지원 + 집안 살림 − 학자금 대출로 시작 자산을 만든다(M-1: 집안 살림에 하한이 없다 — 모자란 몫은 시작 부채)
      next = { ...next, assets: initialAssets(economyContextOf(next), next.familyFund), familyFund: 0 };
      // 20세 전에 부모가 모두 떠난 판(지금 규칙으로는 사별 이벤트가 52세부터라 드물다 — 저장에 이미 사별 플래그가 있는 판): 자산이 없는 동안은 받을 곳이 없으니
      // 집안 살림(familyFund)에 더하지 않고 **독립 때 순자산에 한 번** 더한다. 이 전환에서만 일어나므로 두 번 더해지지 않는다(그 뒤 해 끝 규칙은 「처음 떠나는 해」에만 받는다).
      if (parentsAllGone(next) && next.assets !== null && next.character !== null) {
        const early = inheritanceAmount(next.character.parentWealth, siblingCountOf(next));
        if (early > 0) next = { ...next, assets: settleAssets({ ...next.assets, net: next.assets.net + early }), history: appendHistory(next.history, inheritanceLine(newAge)) };
        // 부모가 이미 모두 떠난 채 독립하면 가족 집으로 시작하지 않고 월세로 나온다 (M7e-3 추가②)
        const independent = next.assets;
        if (independent !== null) next = { ...next, assets: { ...independent, dwelling: dwellingWhenParentsGone(independent.dwelling, next.flags) } };
      }
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
  // 0~7세는 영유아 빈도표를 쓴다(SPEC-003 M7a: 7세는 학창 단계지만 영유아기와 같은 빈도 — EARLY_YEARS_MAX_AGE)
  const freq = age <= EARLY_YEARS_MAX_AGE ? EVENT_FREQUENCY.infant : EVENT_FREQUENCY[stageOfAge(age)];
  const rollChoice = rng.next();
  const rollNarrative = rng.next();

  const ctx = condContextOf(state);
  const view = { ...ctx, age, era: state.era, seen: state.seen };
  const eligible = eventsForStage(pool, stageOfAge(age)).filter((ev) => isEventEligible(ev, view));

  // 마일스톤 슬롯 (SPEC-003 IN3, M7a r3): 일반 추첨과 별개로, 창 안의 마일스톤을 한 해에 **여러 개(최대 MILESTONES_PER_YEAR_MAX)** 일으킨다. 창이 일찍 끝나는(급한) 것부터, 끝이 같으면 id 오름차순으로 따져
  // 확률 1 ÷ (창 끝 나이 − 나이 + 1)로 일어나고, 창의 마지막 해(분모 1)는 난수 없이 100%다. 한 해에 몰려도 칸(MILESTONES_PER_YEAR_MAX) 안이면 모두 일어나고, 칸을 넘길 몰림은
  // lint(eventLint#milestoneWindowProblems)가 풀 점검에서 막는다 → 모든 판에 반드시 일어난다(tests/milestone.test.ts). 난수는 확률이 1보다 작은 후보를 따질 때만 쓴다(후보·확률은 상태로 정해지므로 같은 시드 → 같은 인생).
  // 연표·효과는 id 오름차순으로 남긴다(같은 해에 줄이 여럿이어도 순서가 늘 같다).
  const chosenMilestones: EventDef[] = [];
  for (const m of eligible.filter(isMilestoneEvent).sort((a, b) => (a.ageRange?.max ?? 0) - (b.ageRange?.max ?? 0) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))) {
    if (chosenMilestones.length >= MILESTONES_PER_YEAR_MAX) break;
    const left = (m.ageRange?.max ?? age) - age + 1;
    if (left <= 1 || rng.next() < 1 / left) chosenMilestones.push(m);
  }
  chosenMilestones.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

  // 선택지는 간격을 두고, 한 판의 선택지 수 조절(페이싱)을 따른다. 지금까지 푼 선택지 수는 연표의 선택 기록 수다.
  // 페이싱은 **판의 인생 길이 모드**가 정한다(SPEC-003 LM2·LM3, data/timingTable.ts#LIFE_LENGTH_MODES) — 설정이 아니라 판의 값을 읽어 첫 화면에서 설정을 바꿔도 진행 중인 판이 흔들리지 않는다.
  const pacing = lifeModeOf(state.lifeLength).pacing;
  const choicesSoFar = state.history.reduce((n, h) => (h.kind === 'choice' ? n + 1 : n), 0);
  const canChoice = (state.lastChoiceAge === null || age - state.lastChoiceAge >= MIN_YEARS_BETWEEN_CHOICES) && choicesSoFar < pacing.hard;
  const choiceChance = freq.choice * (choicesSoFar >= pacing.soft ? pacing.softFactor : 1);

  let picked: EventDef | null = null;
  if (rollChoice < choiceChance && canChoice) picked = pickWeighted(rng, eligible.filter(isChoiceEvent), ctx);
  if (picked === null && rollNarrative < freq.narrative) picked = pickWeighted(rng, eligible.filter((ev) => !isChoiceEvent(ev) && !isMilestoneEvent(ev)), ctx);

  // 마일스톤 효과·연표 한 줄은 그 해의 일반 사건보다 먼저 적용한다(선택지가 뜨는 해에도 마일스톤 줄은 이미 남는다)
  let s: GameState = state;
  for (const milestone of chosenMilestones) {
    s = applyResolved(s, resolveEffects(milestone.effects, milestone.bonuses, ctx));
    s = {
      ...s,
      seen: { ...s.seen, [milestone.id]: age },
      history: appendHistory(s.history, { age, kind: 'event', title: milestone.title, text: milestone.text, eventId: milestone.id }),
    };
  }
  const milestoneIds = chosenMilestones.map((m) => m.id);

  if (picked !== null && isChoiceEvent(picked)) {
    const visible = visibleChoices(picked, ctx);
    return {
      state: {
        ...s,
        rngState: rng.getState(),
        seen: { ...s.seen, [picked.id]: age },
        lastChoiceAge: age,
        pending: { eventId: picked.id, key: `${picked.id}@${age}`, age, choiceIds: visible.map((c) => c.id) },
      },
      tick: { kind: 'choice', fromAge: age, eventId: picked.id, ...(milestoneIds.length > 0 ? { milestoneIds } : {}) },
    };
  }

  if (picked !== null) {
    s = applyResolved(s, resolveEffects(picked.effects, picked.bonuses, ctx));
    s = {
      ...s,
      seen: { ...s.seen, [picked.id]: age },
      history: appendHistory(s.history, { age, kind: 'event', title: picked.title, text: picked.text, eventId: picked.id }),
    };
  }
  const { state: next, died } = finishYear(s, rng, state);
  const lines = yearLineCount(next.history, age); // 이 해의 줄 수(마일스톤 + 일반 사건 + 해 끝 규칙의 상속 줄이 이 나이에 붙었다면 그것도) — 단계 줄은 세지 않는다
  const eventId = picked?.id ?? milestoneIds[0];
  return {
    state: next,
    tick: {
      kind: died ? 'death' : eventId !== undefined ? 'narrative' : 'quiet',
      fromAge: age,
      ...(eventId !== undefined ? { eventId } : {}),
      ...(milestoneIds.length > 0 ? { milestoneIds } : {}),
      ...(!died && eventId !== undefined ? { lines } : {}),
    },
  };
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

  const ctx = condContextOf(state);
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
  const { state: next, died } = finishYear(s, rng, state);
  const lines = yearLineCount(next.history, pending.age); // 이 해의 마일스톤 줄들 + 방금 남긴 결과 줄 (+ 이 나이에 붙은 상속 줄)
  return { state: next, tick: { kind: died ? 'death' : 'resolved', fromAge: pending.age, eventId: ev.id, ...(died ? {} : { lines }) } };
}

export function resolveChoice(state: GameState, key: string, choiceId: string, pool: EventPool = EVENT_POOL): GameState {
  return resolveChoiceStep(state, key, choiceId, pool).state;
}

// ---------- 자동 선택 (성향 기반) ----------

/**
 * 자동 모드의 "성향": 부모의 교육방식이 캐릭터의 가치관을 만들고(어디에 무게를 두는가),
 * 지금 스탯이 낮을수록 그 스탯을 올리는 선택에 끌린다. 결정은 점수에 비례한 확률로 시드 RNG가 뽑는다(항상 같은 답만 고르지 않는다).
 */
/** 자동 선택이 돈(자산·집안 살림)에 두는 무게의 이름 `wealth` — 재산 스탯은 없어졌어도 성향 표의 이름은 그대로다(economy-model.md 8절). */
export type AutoPriorityKey = StatKey | 'wealth';

export const AUTO_PRIORITY: Record<Character['parenting'], Record<AutoPriorityKey, number>> = {
  strict: { wealth: 1.2, education: 1.5, health: 1.0, happiness: 0.7, relationships: 0.8 },
  free: { wealth: 0.9, education: 0.8, health: 1.0, happiness: 1.5, relationships: 1.2 },
  helicopter: { wealth: 1.0, education: 1.3, health: 1.3, happiness: 0.9, relationships: 1.0 },
  neglect: { wealth: 1.4, education: 0.9, health: 0.9, happiness: 1.0, relationships: 0.8 },
};
/** 20세 미만의 「집안 살림」 항에 곱하는 절실함의 기준: 옛 재산 스탯의 재력 단계별 출발값(8·22·45·70·92)에서 1 + (50 − 값) ÷ 100 — 가난한 집일수록 집안 살림 효과에 민감하다(옛 동작 보존). */
const FAMILY_NEED_BASE = [8, 22, 45, 70, 92] as const;

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
  const ctx = condContextOf(state);
  const priority = AUTO_PRIORITY[state.character.parenting];
  // 돈 항의 절실함: 순자산이 음수일수록 커진다(1 ~ 1 + needCap). 20세 미만은 재력 단계로 정한다.
  const moneyNeed =
    state.assets === null
      ? 1 + (50 - FAMILY_NEED_BASE[state.character.parentWealth - 1]) / 100
      : 1 + Math.min(AUTO_ASSET.needCap, Math.max(0, -state.assets.net) / AUTO_ASSET.needSpan);
  const weights = pending.choiceIds.map((id) => {
    const choice = ev.choices?.find((c) => c.id === id);
    if (choice === undefined) throw new Error(`autoChoiceWeights: 선택지를 찾을 수 없다 (${id})`);
    const eff = resolveEffects(choice.effects, choice.bonuses, ctx);
    let score = 0;
    for (const [key, delta] of Object.entries(eff.stats) as [StatKey, number][]) {
      const need = 1 + (50 - state.stats[key]) / 100; // 이미 높은 스탯보다 낮은 스탯이 더 절실하다(0.5~1.5)
      score += delta * priority[key] * need;
    }
    // 자산 점수(Δ순자산 + 3×Δ연 현금흐름)와 집안 살림을 옛 「점수」 크기로 환산해 더한다(EC6: 부채 판에서는 자산을 깎는 선택에서 멀어진다).
    const money = impactOfEffects(state, eff).detail;
    score += (money.assetScore / AUTO_ASSET.pointMan + money.dFamily / AUTO_ASSET.familyPointMan) * priority.wealth * moneyNeed;
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
  /** 연출 대기가 있는 해(서술 해·결과 해)의 **둘째 줄부터의 줄 수** 합 = Σ max(0, 줄 수 − 1) — 시간 모델이 줄마다 대기를 더한다(SPEC-003 LM2) */
  extraLines: number;
}

export function emptyCounts(): TickCounts {
  return { quiet: 0, narrative: 0, choice: 0, resolved: 0, death: 0, extraLines: 0 };
}

function count(counts: TickCounts, tick: TickInfo): void {
  if (tick.kind === 'none') return;
  counts[tick.kind]++;
  if (tick.kind === 'narrative' || tick.kind === 'resolved') counts.extraLines += Math.max(0, (tick.lines ?? 1) - 1);
}

/** 안전장치: 한 번의 연속 진행이 이 걸음 수를 넘으면 무한 루프로 보고 throw */
const MAX_STEPS = 1000;

export interface RunResult {
  state: GameState;
  counts: TickCounts;
  /** 마지막 걸음 */
  last: TickInfo;
  /** `advanceUntilDecision`이 `'stop'` 모드에서 이 기록 카드 앞에서 멈췄다(멈춘 뒤의 상태는 카드가 뜰 차례인 해의 첫머리) */
  stoppedForNote?: NoteCardDef;
}

/**
 * 다음 결정으로: 선택지 이벤트(또는 사망)가 나올 때까지 연출 없이 즉시 진행한다.
 * 이미 대기 중인 선택지가 있으면 움직이지 않는다.
 *
 * `notes`는 기록 카드(SPEC-003 M7c)를 어떻게 다룰지다. 기본 `'ignore'`는 카드를 보지 않아 시뮬레이션·기존 호출의 동작이 그대로다(인생도 `seen`도 바뀌지 않는다).
 * `'stop'`: 카드가 뜰 차례인 해의 첫머리에서 멈추고 `stoppedForNote`에 그 카드를 담는다(이미 그 해의 첫머리라면 한 걸음도 가지 않는다).
 * `'consume'`: 카드를 시트 없이 소비(`seen` 표시, 연표 줄 없음)하고 계속 간다. 소비는 스탯·자산·플래그·`rngState`를 바꾸지 않아 인생이 같다.
 */
export function advanceUntilDecision(state: GameState, pool: EventPool = EVENT_POOL, notes: NoteMode = 'ignore'): RunResult {
  let s = state;
  const counts = emptyCounts();
  let last: TickInfo = { kind: 'none', fromAge: s.age };
  for (let i = 0; s.phase === 'life' && s.pending === null; i++) {
    if (i >= MAX_STEPS) throw new Error('advanceUntilDecision: 진행이 끝나지 않는다');
    if (notes !== 'ignore') {
      const due = dueNote(s);
      if (due !== null) {
        if (notes === 'stop') return { state: s, counts, last, stoppedForNote: due };
        s = consumeNote(s, due);
      }
    }
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
