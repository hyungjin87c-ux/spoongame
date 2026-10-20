import {
  PARENT_WEALTHS,
  autoResolveStep,
  calendarYear,
  citationFor,
  condContextOf,
  deciderOf,
  resolveChoiceStep,
  resolveEffects,
  stepYear,
  type DelegatedBy,
  type DelegatedObserver,
  type Era,
  type EventPool,
  type GameState,
  type HistoryEntry,
  type ParentWealth,
  type ParentingStyle,
} from '../src/core';
import { EVENT_POOL } from '../src/data/events';
import { ERA_CONFIG } from '../src/data/birthTable';
import { PARENT_DECISION_TABLE } from '../src/data/parentDecisionTable';
import { chooserFor, startLife, type Strategy } from './simulateLib';

/**
 * 어린 시절 부모님 결정 시뮬레이션 측정 (SPEC-005 PD12·PD13, 설계 문서 5절 T5) — `npm run report:parent`와 `tests/parentDecisionSim.test.ts`가 함께 쓴다.
 * 인생 전체가 아니라 **20세가 되기 전까지만** 돌린다(부모님이 정한·흘러간 카드와 13~19세 본인 카드는 모두 거기서 끝난다) — 한 판이 0.5ms쯤이라 수천 판을 금방 돈다. Math.random·Date는 쓰지 않는다.
 * 시드 규칙은 기존 시험과 같다(`i × 7919 + 13`). 수저 단계별 비교는 시드를 차례로 훑어 그 단계가 나온 판만 모은다(단계마다 N판) — 출생 분포는 그대로 자연스럽다(스탯·부모 나이가 단계와 함께 정해진다).
 */

export interface YoungObs {
  eventId: string;
  age: number;
  by: DelegatedBy;
  tier: ParentWealth;
  parenting: ParentingStyle;
  order: number;
  /** 고르기 직전 보이던 선택지 id · 확률 · 실제로 고른 것 */
  ids: string[];
  weights: number[];
  choiceId: string;
  /** 선택지별 실제 집안 살림·학력 효과 (영향 줄과 같은 resolveEffects, 고르기 직전 상태) */
  family: Record<string, number>;
  education: Record<string, number>;
}

export interface YoungLife {
  seed: number;
  era: Era;
  tier: ParentWealth;
  parenting: ParentingStyle;
  order: number;
  history: HistoryEntry[];
  obs: YoungObs[];
  /** 13~18세에 본인이 고른 카드 수 / 19세까지(13~19세) 본인이 고른 카드 수 */
  self13to18: number;
  selfUpTo19: number;
  /** 20세가 되기 전에 사망했는가 */
  diedYoung: boolean;
  /** 부모/흘러감으로 해결된 해 중 `pending`이 열린 채 남은 해가 있었는가 (구조적으로 0이어야 한다) */
  pendingLeak: number;
  /** 연표의 선택 줄 `by` 표지가 deciderOf와 어긋난 줄 수 (0이어야 한다) */
  byMismatch: number;
  parentCards: number;
  childCards: number;
  /** 부모님이 정한 카드 가운데 인용 박스가 붙는 카드 수 (PD12 ⑪ 보고: 부모 해 인용 노출률 = parentCited ÷ parentCards) */
  parentCited: number;
}

/** 20세 미만의 선택 줄을 나이·이벤트로 결정자 판정과 대조한다 */
function byMismatchOf(history: readonly HistoryEntry[]): number {
  let bad = 0;
  for (const h of history) {
    if (h.kind !== 'choice') continue;
    if (h.eventId === undefined || !Object.prototype.hasOwnProperty.call(PARENT_DECISION_TABLE, h.eventId)) continue;
    const want = deciderOf(h.eventId, h.age);
    const have = h.by === undefined ? 'self' : h.by;
    if (want !== have) bad++;
  }
  return bad;
}

/** 시작 상태(0세 인생)에서 20세가 되기 전까지 돌린다. 본인 카드는 전략(자동 성향/무작위 수동 흉내)대로 고른다. */
export function runYoungLife(start: GameState, seed: number, strategy: Strategy, pool: EventPool = EVENT_POOL, observeExtra?: DelegatedObserver): YoungLife {
  const character = start.character!;
  const order = start.birthReport!.birthOrder;
  const chooser = chooserFor(strategy, seed);
  const obs: YoungObs[] = [];
  const observe: DelegatedObserver = (e) => {
    const ev = pool.byId.get(e.state.pending!.eventId)!;
    const ctx = condContextOf(e.state);
    const family: Record<string, number> = {};
    const education: Record<string, number> = {};
    for (const id of e.ids) {
      const c = ev.choices!.find((x) => x.id === id)!;
      const eff = resolveEffects(c.effects, c.bonuses, ctx);
      family[id] = eff.family;
      education[id] = eff.stats.education ?? 0;
    }
    // 흘러감의 가중치(autoChoiceWeights)는 합이 1이 아니라 exp 값이다 — 확률로 바꿔 둔다 (부모의 가중치는 이미 합 1)
    const total = e.weights.reduce((x, y) => x + y, 0);
    obs.push({ eventId: ev.id, age: e.state.pending!.age, by: e.by, tier: character.parentWealth, parenting: character.parenting, order, ids: [...e.ids], weights: e.weights.map((w) => w / total), choiceId: e.choiceId, family, education });
    observeExtra?.(e);
  };
  let s = start;
  let pendingLeak = 0;
  for (let i = 0; s.phase === 'life' && s.age < 20; i++) {
    if (i > 200) throw new Error('runYoungLife: 진행이 끝나지 않는다');
    if (s.pending !== null) {
      const picked = chooser === null ? null : chooser(s);
      const r = picked === null ? autoResolveStep(s, s.pending.key, pool) : resolveChoiceStep(s, s.pending.key, picked, pool);
      if (r.state === s) throw new Error('runYoungLife: 선택이 적용되지 않았다');
      s = r.state;
      continue;
    }
    const r = stepYear(s, pool, observe);
    s = r.state;
    // 막 나온 pending이 부모/흘러감 카드인가 (구조적으로 0이어야 한다)
    if (s.pending !== null && PARENT_DECISION_TABLE[s.pending.eventId] !== undefined && deciderOf(s.pending.eventId, s.pending.age) !== 'self') pendingLeak++;
  }
  let self13to18 = 0;
  let selfUpTo19 = 0;
  let parentCards = 0;
  let childCards = 0;
  let parentCited = 0;
  for (const h of s.history) {
    if (h.kind !== 'choice') continue;
    if (h.by === 'parent') {
      parentCards++;
      const ev = h.eventId === undefined ? undefined : pool.byId.get(h.eventId);
      if (ev !== undefined && citationFor(ev, s.era!, calendarYear(character.birthYear, h.age)) !== null) parentCited++;
    } else if (h.by === 'child') childCards++;
    else if (h.age >= 13 && h.age <= 19) {
      selfUpTo19++;
      if (h.age <= 18) self13to18++;
    }
  }
  return { seed, era: s.era!, tier: character.parentWealth, parenting: character.parenting, order, history: s.history, obs, self13to18, selfUpTo19, diedYoung: s.phase === 'ending', pendingLeak, byMismatch: byMismatchOf(s.history), parentCards, childCards, parentCited };
}

/** 시드 `i × 7919 + 13` (i = 1…) — 기존 시험·sim:1000과 같은 규칙 */
export const seedOf = (i: number): number => i * 7919 + 13;

/** 자연 분포에서 N판 (수저·양육·형제 순서가 출생 생성기 그대로) */
export function sampleYoung(era: Era, lives: number, strategy: Strategy, pool: EventPool = EVENT_POOL): YoungLife[] {
  const out: YoungLife[] = [];
  for (let i = 1; i <= lives; i++) {
    const seed = seedOf(i);
    out.push(runYoungLife(startLife(seed, era), seed, strategy, pool));
  }
  return out;
}

/** 수저 단계마다 N판씩 (시드를 차례로 훑어 그 단계가 나온 판만 모은다 — 자연 분포의 조건부 표본). 단계당 판이 모이면 멈춘다. */
export function sampleYoungByTier(era: Era, perTier: number, strategy: Strategy, pool: EventPool = EVENT_POOL): Record<ParentWealth, YoungLife[]> {
  const out: Record<ParentWealth, YoungLife[]> = { 1: [], 2: [], 3: [], 4: [], 5: [] };
  for (let i = 1; PARENT_WEALTHS.some((t) => out[t].length < perTier); i++) {
    if (i > 2_000_000) throw new Error('sampleYoungByTier: 표본을 모으지 못했다');
    const seed = seedOf(i);
    const start = startLife(seed, era);
    const tier = start.character!.parentWealth;
    if (out[tier].length >= perTier) continue;
    out[tier].push(runYoungLife(start, seed, strategy, pool));
  }
  return out;
}

// ---------- 집계 ----------

const mean = (xs: readonly number[]): number => (xs.length === 0 ? 0 : xs.reduce((a, b) => a + b, 0) / xs.length);
const sd = (xs: readonly number[]): number => {
  const m = mean(xs);
  return Math.sqrt(mean(xs.map((x) => (x - m) ** 2)));
};
const se = (xs: readonly number[]): number => (xs.length === 0 ? 0 : sd(xs) / Math.sqrt(xs.length));

export interface CardCounts {
  lives: number;
  parent: number;
  child: number;
  parentSE: number;
  childSE: number;
  /** 13~18세 본인 카드 수 평균·0장 비율 / 13~19세 */
  self13to18: number;
  self13to18Zero: number;
  selfUpTo19: number;
  selfUpTo19Zero: number;
  /** 13~18세 본인 카드 수 분포 (0, 1, 2, 3 이상) */
  dist13to18: number[];
  diedYoung: number;
  /** 부모님이 정한 카드 가운데 인용 박스가 붙는 비율 (PD12 ⑪ 보고) */
  parentCiteShare: number;
}

export function cardCounts(lives: readonly YoungLife[]): CardCounts {
  const dist = [0, 0, 0, 0];
  for (const l of lives) dist[Math.min(3, l.self13to18)]++;
  return {
    lives: lives.length,
    parent: mean(lives.map((l) => l.parentCards)),
    child: mean(lives.map((l) => l.childCards)),
    parentSE: se(lives.map((l) => l.parentCards)),
    childSE: se(lives.map((l) => l.childCards)),
    self13to18: mean(lives.map((l) => l.self13to18)),
    self13to18Zero: lives.filter((l) => l.self13to18 === 0).length / (lives.length || 1),
    selfUpTo19: mean(lives.map((l) => l.selfUpTo19)),
    selfUpTo19Zero: lives.filter((l) => l.selfUpTo19 === 0).length / (lives.length || 1),
    dist13to18: dist.map((n) => n / (lives.length || 1)),
    diedYoung: lives.filter((l) => l.diedYoung).length / (lives.length || 1),
    parentCiteShare: lives.reduce((n, l) => n + l.parentCited, 0) / (lives.reduce((n, l) => n + l.parentCards, 0) || 1),
  };
}

/** 한 카드의 관측들 */
export const obsOf = (lives: readonly YoungLife[], eventId: string): YoungObs[] => lives.flatMap((l) => l.obs.filter((o) => o.eventId === eventId));

/** 관측에서 집합 `pick`에 드는 선택지의 기대 확률(고르기 직전 확률의 평균). 관측이 없으면 null */
export function meanShare(obs: readonly YoungObs[], pick: (o: YoungObs, id: string) => boolean): number | null {
  if (obs.length === 0) return null;
  return mean(obs.map((o) => o.ids.reduce((sum, id, i) => sum + (pick(o, id) ? o.weights[i] : 0), 0)));
}

/** 비용 합 확률의 선택지 집합: 집안 살림 효과가 −300 이하 (설계 문서 5절 T5-④) */
export const isCostly = (o: YoungObs, id: string): boolean => o.family[id] <= -300;

/** 수저 단조 비교가 가능한 10장 (설계 문서 5절 T5-④) — `moving`은 재력 ≤ 3이라 1단계 대 3단계로 비교한다 */
export const MONOTONE_CARDS: ReadonlyArray<{ id: string; low: ParentWealth; high: ParentWealth; eras?: readonly Era[] }> = [
  { id: 'infant-fever', low: 1, high: 5 },
  { id: 'infant-meal-start', low: 1, high: 5 },
  { id: 'infant-parental-leave', low: 1, high: 5, eras: ['present'] },
  { id: 'infant-daycare-wait', low: 1, high: 5, eras: ['present'] },
  { id: 'infant-early-lessons', low: 1, high: 5, eras: ['present', 'future'] },
  { id: 'infant-hospital-stay', low: 1, high: 5 },
  { id: 'infant-moving', low: 1, high: 3 },
  { id: 'school-supplies', low: 1, high: 5 },
  { id: 'school-tutoring', low: 1, high: 5 },
  { id: 'school-academy-night', low: 1, high: 5, eras: ['present', 'future'] },
];

export interface MonotoneRow {
  id: string;
  era: Era;
  /** 단계별 비용 합 확률(평균)과 관측 수 */
  byTier: Array<{ tier: ParentWealth; share: number | null; n: number }>;
  low: ParentWealth;
  high: ParentWealth;
  /** 높은 단계 − 낮은 단계 (%p). 비교할 수 없으면 null */
  gap: number | null;
  /** 인접 단계 격차의 최솟값(%p) — −8 이하는 보고 */
  minAdjacent: number | null;
}

/** 수저 단조 표: 한 시대의 단계별 표본에서 카드별 비용 합 확률 */
export function monotoneRows(era: Era, byTier: Record<ParentWealth, YoungLife[]>): MonotoneRow[] {
  const rows: MonotoneRow[] = [];
  for (const card of MONOTONE_CARDS) {
    if (card.eras !== undefined && !card.eras.includes(era)) continue;
    const tiers = PARENT_WEALTHS.map((tier) => {
      const obs = obsOf(byTier[tier], card.id);
      return { tier, share: meanShare(obs, isCostly), n: obs.length };
    });
    const lo = tiers.find((t) => t.tier === card.low)!;
    const hi = tiers.find((t) => t.tier === card.high)!;
    const gap = lo.share === null || hi.share === null ? null : (hi.share - lo.share) * 100;
    let minAdjacent: number | null = null;
    const present = tiers.filter((t) => t.share !== null && t.tier >= card.low && t.tier <= card.high);
    for (let i = 1; i < present.length; i++) {
      const d = (present[i].share! - present[i - 1].share!) * 100;
      minAdjacent = minAdjacent === null ? d : Math.min(minAdjacent, d);
    }
    rows.push({ id: card.id, era, byTier: tiers, low: card.low, high: card.high, gap, minAdjacent });
  }
  return rows;
}

/** 양육 방식 비교 (T5-⑤): 카드별 「학력 효과가 가장 큰 선택지」(최대 Δ학력 ≥ 3, 동률 제외)의 선택 확률 평균 — 엄격·헬리콥터 대 자유·방임 (%p 차) */
export function parentingGap(lives: readonly YoungLife[]): { front: number; back: number; gap: number; n: number; cards: number } {
  const front: number[] = [];
  const back: number[] = [];
  const cards = new Set<string>();
  for (const l of lives) {
    for (const o of l.obs) {
      if (o.by !== 'parent') continue;
      const best = Math.max(...o.ids.map((id) => o.education[id]));
      const winners = o.ids.filter((id) => o.education[id] === best);
      if (best < 3 || winners.length !== 1) continue;
      const p = o.weights[o.ids.indexOf(winners[0])];
      cards.add(o.eventId);
      (o.parenting === 'strict' || o.parenting === 'helicopter' ? front : back).push(p);
    }
  }
  const f = mean(front);
  const b = mean(back);
  return { front: f, back: b, gap: (f - b) * 100, n: front.length + back.length, cards: cards.size };
}

export interface DominanceCell {
  eventId: string;
  tier: ParentWealth;
  parenting: ParentingStyle;
  by: DelegatedBy;
  n: number;
  /** 한 선택지의 최대 평균 확률 */
  maxShare: number;
  maxId: string;
}

/** 지배 방지 (T5-⑥·⑩): (카드 × 수저 × 양육) 칸마다 선택지별 평균 확률의 최댓값. 선택지가 하나뿐인 칸은 없다(카드는 2개 이상 보일 때만 뜬다). 관측이 minN 이상인 칸만 본다 */
export function dominanceCells(lives: readonly YoungLife[], minN = 8): DominanceCell[] {
  const groups = new Map<string, YoungObs[]>();
  for (const l of lives) for (const o of l.obs) groups.set(`${o.eventId}|${o.tier}|${o.parenting}|${o.by}`, [...(groups.get(`${o.eventId}|${o.tier}|${o.parenting}|${o.by}`) ?? []), o]);
  const cells: DominanceCell[] = [];
  for (const [key, list] of groups) {
    if (list.length < minN) continue;
    const [eventId, tier, parenting, by] = key.split('|');
    // 선택지가 보이는 구성이 달라질 수 있어(requires) 선택지 id별로 평균(그 선택지가 보인 관측만의 평균 확률)
    const sums = new Map<string, number[]>();
    for (const o of list) o.ids.forEach((id, i) => sums.set(id, [...(sums.get(id) ?? []), o.weights[i]]));
    let maxShare = 0;
    let maxId = '';
    for (const [id, ws] of sums) {
      const m = mean(ws);
      if (m > maxShare) {
        maxShare = m;
        maxId = id;
      }
    }
    cells.push({ eventId, tier: Number(tier) as ParentWealth, parenting: parenting as ParentingStyle, by: by as DelegatedBy, n: list.length, maxShare, maxId });
  }
  return cells;
}

/** 통계 보정 판정의 공식 값 (설계 문서 2-7절, SPEC PD4-6) */
export const OFFICIAL = {
  /** 소득 구간별 사교육 참여율 — 수저 1~5단계 (2025 초중고사교육비조사 표 11, s-026) */
  privateEdu: [52.8, 64.2, 74.9, 83.1, 84.9] as const,
  /** 육아휴직 어머니 사용률 72.2% (2024 잠정, s-055) — 가구 단위 근사는 기획자 가정 */
  parentalLeaveMother: 72.2,
  tolerancePp: 15,
};

export interface CalibrationRow {
  label: string;
  /** 단계별 (참여 선택지) 기대 확률 % 와 관측 수 */
  byTier: Array<{ tier: ParentWealth; share: number | null; n: number }>;
  official: readonly number[];
  /** 단계별 |차| %p (관측이 있는 단계만) */
  diffs: Array<number | null>;
}

/** 사교육 참여율 (지금 세상): 카드가 일어난 판에서 참여 선택지 비율을 수저 단계별로 */
export function privateEducationRows(byTier: Record<ParentWealth, YoungLife[]>): CalibrationRow[] {
  const defs: Array<{ label: string; id: string; pick: readonly string[] }> = [
    { label: 'school-tutoring (academy + tutor)', id: 'school-tutoring', pick: ['academy', 'tutor'] },
    { label: 'school-academy-night (many + one)', id: 'school-academy-night', pick: ['many', 'one'] },
  ];
  return defs.map((d) => {
    const tiers = PARENT_WEALTHS.map((tier) => {
      const obs = obsOf(byTier[tier], d.id);
      const share = meanShare(obs, (_o, id) => d.pick.includes(id));
      return { tier, share: share === null ? null : share * 100, n: obs.length };
    });
    return { label: d.label, byTier: tiers, official: OFFICIAL.privateEdu, diffs: tiers.map((t, i) => (t.share === null ? null : Math.abs(t.share - OFFICIAL.privateEdu[i]))) };
  });
}

/** 육아휴직 (지금 세상 전체, 수저 비율로 가중): one + share 비율(한 사람 이상 일을 쉼) % */
export function parentalLeaveShare(byTier: Record<ParentWealth, YoungLife[]>, era: Era = 'present'): { share: number; byTier: Array<{ tier: ParentWealth; share: number | null; n: number }> } {
  const weights = ERA_CONFIG[era].wealthWeights as readonly number[];
  const rows = PARENT_WEALTHS.map((tier) => {
    const obs = obsOf(byTier[tier], 'infant-parental-leave');
    const s = meanShare(obs, (_o, id) => id === 'one' || id === 'share');
    return { tier, share: s === null ? null : s * 100, n: obs.length };
  });
  let acc = 0;
  let w = 0;
  rows.forEach((r, i) => {
    if (r.share === null) return;
    acc += r.share * weights[i];
    w += weights[i];
  });
  return { share: w === 0 ? 0 : acc / w, byTier: rows };
}

/** `school-family-priority` accept 비율(보고, 대역 5~35%▲): 재력 단계별 */
export function familyPriorityAccept(byTier: Record<ParentWealth, YoungLife[]>): Array<{ tier: ParentWealth; share: number | null; n: number }> {
  return PARENT_WEALTHS.map((tier) => {
    const obs = obsOf(byTier[tier], 'school-family-priority');
    const share = meanShare(obs, (_o, id) => id === 'accept');
    return { tier, share: share === null ? null : share * 100, n: obs.length };
  });
}

