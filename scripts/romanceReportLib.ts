import { autoChoiceWeights, createEventPool, createRng, resolveChoiceStep, stepYear, type EventDef, type EventPool, type GameState, type ParentWealth } from '../src/core';
import { EVENT_POOL } from '../src/data/events';
import { startLife } from './simulateLib';

/**
 * 교제 카드 측정 (SPEC-018 PL17-R, 검토안 `docs/data/review-018-romance-means.md` 5절 — `npm run report:persona -- --only=romance`가 쓴다). **판정이 아니라 보고**다.
 * 같은 시드에서 **조건 하나만 덮어쓴 짝**(22세 순자산 · 출생 수저 · 외모 · 22세 근무)과 **세 풀**(없음 / 교제 카드 A·B·후속 / 교제 카드 + 반대 사례)로 35세까지 교제·결혼, 40세까지 출산을 센다.
 * 정의(검토안 1-1): 밀레니얼 · 시드 `i×7919+13` · 35세까지 산 판이 분모(36세가 된 해의 상태를 본다) · 출산은 40세를 넘긴 판이 분모.
 * 사건이 아직 데이터에 없으면(측정 도구 커밋 시점) 세 풀은 같은 풀이다 — 「없음」 기준선만 뜻이 있다.
 */

export const NEW_CARDS = ['youth-date-budget', 'youth-two-news', 'youth-late-word'] as const;
export const NEW_CIRCLE = 'youth-hobby-circle';
export const NEW_ALL = [...NEW_CARDS, NEW_CIRCLE] as const;
export type PoolKind = 'none' | 'cards' | 'all';
export const POOL_KINDS: readonly PoolKind[] = ['none', 'cards', 'all'];
export const POOL_LABEL: Record<PoolKind, string> = { none: '없음', cards: '교제 카드 A·B·후속', all: '교제 카드 + 반대 사례' };

/** 시험 전용 덮어쓰기(가중·반대 사례 `stay` 관계 효과): 데이터 값을 바꾸지 않고 풀만 다시 만든다 — 가중 후보를 병렬로 견주려는 것이다. 없으면 데이터 그대로 */
export interface Tune {
  /** 새 사건 id → 가중 */
  weights?: Partial<Record<string, number>>;
  /** `youth-hobby-circle/stay`의 관계 효과 */
  stay?: number;
}
let tune: Tune = {};
export const setTune = (t: Tune): void => {
  tune = t;
  poolCache.clear();
};
const tuned = (e: EventDef): EventDef => {
  const w = tune.weights?.[e.id];
  let out = w === undefined ? e : { ...e, weight: w };
  if (e.id === NEW_CIRCLE && tune.stay !== undefined) {
    out = { ...out, choices: out.choices!.map((c) => (c.id === 'stay' ? { ...c, effects: { ...c.effects, stats: { ...c.effects!.stats, relationships: tune.stay } } } : c)) };
  }
  return out;
};

const poolCache = new Map<PoolKind, EventPool>();
/** 풀 덮어쓰기(조르기 대조 `poolWithoutAsk`와 같은 방법): 새 사건 id를 거른 풀 */
export function romancePool(kind: PoolKind): EventPool {
  const hit = poolCache.get(kind);
  if (hit !== undefined) return hit;
  const drop: readonly string[] = kind === 'none' ? NEW_ALL : kind === 'cards' ? [NEW_CIRCLE] : [];
  const changed = tune.stay !== undefined || (tune.weights !== undefined && Object.keys(tune.weights).length > 0);
  const pool = drop.length === 0 && !changed ? EVENT_POOL : createEventPool(EVENT_POOL.events.filter((e) => !drop.includes(e.id)).map(tuned));
  poolCache.set(kind, pool);
  return pool;
}
/** 데이터에 새 사건이 몇 개 들어 있는가 */
export const newEventsPresent = (): string[] => NEW_ALL.filter((id) => EVENT_POOL.byId.has(id));

export interface CardObs {
  id: string;
  age: number;
  by: 'self' | 'parent' | 'child';
  ids: string[];
  chosen: string;
  /** 카드가 뜬 때 순자산(만 원) · 근무 여부 — 「넉넉함」 경계 ▲를 가르는 근거 */
  net: number;
  career: boolean;
}

export interface RomObs {
  seed: number;
  gender: string;
  wealth: ParentWealth;
  looks: number;
  /** 36세가 된 해(= 35세를 마친 해)의 상태를 봤다 */
  reached35: boolean;
  reached40: boolean;
  /** 35세까지 `has_partner`·`married`·`divorced`가 켜진 적 */
  partner35: boolean;
  married35: boolean;
  /** 40세까지 `has_child` */
  child40: boolean;
  /** 22~33세에 짝이 있고 결혼 전이었던 해 수 */
  partnerYears: number;
  /** 새 사건이 연표에 남은 나이 */
  seenNew: Record<string, number>;
  /** 22~33세 각 나이 시작 때 순자산 */
  net: number[];
  cards: CardObs[];
}

export interface Override {
  wealth?: ParentWealth;
  looks?: number;
  /** 맞춤 인생 없음(`personaReportLib#overridden`의 neutral과 같다) */
  neutral?: boolean;
  /** 22세 첫 걸음 직전에 상태를 바꾼다(순자산·근무) */
  at22?: (s: GameState) => GameState;
}

export const setNet = (net: number) => (s: GameState): GameState => (s.assets === null ? s : { ...s, assets: { ...s.assets, net } });
export const setCareer = (on: boolean) => (s: GameState): GameState => {
  const rest = s.flags.filter((f) => f !== 'has_career');
  return { ...s, flags: on ? [...rest, 'has_career'] : rest };
};

export function startOf(seed: number, o: Override = {}): GameState {
  let s = startLife(seed, 'millennial', o.looks === undefined ? {} : { looks: o.looks });
  if (o.wealth !== undefined && s.character !== null) s = { ...s, character: { ...s.character, parentWealth: o.wealth } };
  if (o.neutral === true) {
    const { persona: _p, ...rest } = s;
    void _p;
    s = rest as GameState;
  }
  return s;
}

/** 한 판을 `until`세까지 자동으로 살며 교제·결혼·출산·새 사건을 센다 (`personaReportLib#playObserve`와 같은 진행 — 본인 카드는 자동 성향) */
export function playRomance(start: GameState, seed: number, pool: EventPool, o: Override = {}, until = 41): RomObs {
  let s = start;
  const obs: RomObs = {
    seed,
    gender: start.character!.gender,
    wealth: start.character!.parentWealth,
    looks: start.character!.looks,
    reached35: false,
    reached40: false,
    partner35: false,
    married35: false,
    child40: false,
    partnerYears: 0,
    seenNew: {},
    net: [],
    cards: [],
  };
  let ever = { partner: false, married: false, child: false };
  let applied = false;
  const isNew = (id: string): boolean => (NEW_ALL as readonly string[]).includes(id);
  const lastNetAge = { v: -1 };
  for (let guard = 0; guard < 2000 && s.phase === 'life' && s.age <= until; guard++) {
    if (!applied && s.age >= 22 && s.pending === null) {
      applied = true;
      if (o.at22 !== undefined) s = o.at22(s);
    }
    if (s.age >= 22 && s.age <= 33 && s.assets !== null && lastNetAge.v !== s.age) {
      lastNetAge.v = s.age;
      obs.net.push(s.assets.net);
      if (s.flags.includes('has_partner') && !s.flags.includes('married')) obs.partnerYears++;
    }
    if (s.flags.includes('has_partner') || s.flags.includes('married') || s.flags.includes('divorced')) ever.partner = true;
    if (s.flags.includes('married') || s.flags.includes('divorced')) ever.married = true;
    if (s.flags.includes('has_child')) ever.child = true;
    if (!obs.reached35 && s.age >= 36) {
      obs.reached35 = true;
      obs.partner35 = ever.partner;
      obs.married35 = ever.married;
    }
    if (!obs.reached40 && s.age >= 41) {
      obs.reached40 = true;
      obs.child40 = ever.child;
    }
    if (s.pending !== null) {
      const w = autoChoiceWeights(s, pool)!;
      const id = w.ids[createRng(s.rngState).weightedIndex(w.weights)];
      if (isNew(s.pending.eventId)) obs.cards.push({ id: s.pending.eventId, age: s.pending.age, by: 'self', ids: [...w.ids], chosen: id, net: s.assets?.net ?? 0, career: s.flags.includes('has_career') });
      s = resolveChoiceStep(s, s.pending.key, id, pool).state;
      continue;
    }
    const r = stepYear(s, pool, (e) => {
      if (isNew(e.state.pending!.eventId)) obs.cards.push({ id: e.state.pending!.eventId, age: e.state.pending!.age, by: e.by, ids: [...e.ids], chosen: e.choiceId, net: e.state.assets?.net ?? 0, career: e.state.flags.includes('has_career') });
    });
    s = r.state;
  }
  for (const id of NEW_ALL) if (s.seen[id] !== undefined) obs.seenNew[id] = s.seen[id];
  return obs;
}

export function sample(n: number, pool: EventPool, o: Override = {}, until = 41, seedOf: (i: number) => number = (i) => i * 7919 + 13): RomObs[] {
  const out: RomObs[] = [];
  for (let i = 1; i <= n; i++) {
    const seed = seedOf(i);
    out.push(playRomance(startOf(seed, o), seed, pool, o, until));
  }
  return out;
}

/** F10 정의(`persona-model.md` 8-1 기준선): 시드 `100003×i+1979`, 외모만 지정, 45세까지 */
export const seedF10 = (i: number): number => 100003 * i + 1979;

// ---------- 지표 ----------

export interface Rate {
  k: number;
  n: number;
}
export const rateOf = (lives: readonly RomObs[], pick: (l: RomObs) => boolean, denom: (l: RomObs) => boolean): Rate => {
  const d = lives.filter(denom);
  return { k: d.filter(pick).length, n: d.length };
};
export const r35 = (l: RomObs): boolean => l.reached35;
export const r40 = (l: RomObs): boolean => l.reached40;
export const fmtRate = (r: Rate): string => (r.n === 0 ? '-' : `${((r.k / r.n) * 100).toFixed(1)}%`);
export const val = (r: Rate): number => (r.n === 0 ? 0 : r.k / r.n);

export interface Chain {
  partner: Rate;
  married: Rate;
  child: Rate;
  /** 22~33세 짝 있는 해가 있는 판(교제 카드 분모) */
  withYears: Rate;
}
export const chainOf = (lives: readonly RomObs[]): Chain => ({
  partner: rateOf(lives, (l) => l.partner35, r35),
  married: rateOf(lives, (l) => l.married35, r35),
  child: rateOf(lives, (l) => l.child40, r40),
  withYears: rateOf(lives, (l) => l.partnerYears > 0, r35),
});

/** 새 사건 노출률(분모 = 36세까지 산 판) — id별 */
export const exposure = (lives: readonly RomObs[], id: string): Rate => rateOf(lives, (l) => l.seenNew[id] !== undefined, r35);

export function quantile(xs: readonly number[], p: number): number {
  if (xs.length === 0) return 0;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(p * s.length))];
}
