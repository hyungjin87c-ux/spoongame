import {
  askBranchProbs,
  askCloseness,
  askGrantChance,
  askOutcomeOf,
  askStrainChance,
  autoChoiceWeights,
  condContextOf,
  createEventPool,
  createRng,
  resolveChoiceStep,
  resolveEffects,
  stepYear,
  type EventPool,
  type GameState,
  type ParentWealth,
  type ProfileId,
} from '../src/core';
import { ASK_EFFECTS, ASK_KINDS, type AskChoiceId, type AskEffectKey, type AskKind } from '../src/data/askTable';
import { EVENT_POOL } from '../src/data/events';
import { startLife } from './simulateLib';

/**
 * 어린 시절 조르기 시뮬레이션 측정 (SPEC-011 AK10, 결정 AQ8 — `npm run report:ask`와 `tests/askSim.test.ts`가 함께 쓴다): `report:parent`와 같은 방식 — 인생 전체가 아니라 **20세가 되기 전까지만** 돌린다.
 * 전략 셋: `auto`(자동 성향 — `autoChoiceWeights`로 고른다) · `random`(무작위 수동 흉내) · `evmax`(기대 행복 최대 — 조르기 카드는 갈래 확률로 가중한 행복 기대값이 가장 큰 선택지, 그 밖의 카드는 행복 효과가 가장 큰 선택지, AQ9).
 * 시드 `i × 7919 + 13`(기존 규칙). 판정이 아니라 보고다 — 단언은 tests/askSim.test.ts가 한다.
 */

export type AskStrategy = 'auto' | 'random' | 'evmax';
export const seedOf = (i: number): number => i * 7919 + 13;
/**
 * 세대마다 시드 구간을 띄운다(세대 g는 `i + g × 100000`번째 시드): 같은 시드는 세대가 달라도 같은 `peerSeed`라 가족·조르기 해시 값이 세대 사이에 같아(SPEC-009 FM4a 관찰 ③ — 분포 시험은 `spreadSeeds`로 피한다)
 * 7세대 표본이 독립이 아니게 되고 4σ 판정이 어긋난다. 한 세대 안의 시드 규칙은 그대로(`i × 7919 + 13`)다.
 */
export const GENERATION_SEED_STRIDE = 100_000;

export interface AskObs {
  kind: AskKind;
  age: number;
  wealth: ParentWealth;
  parenting: string;
  /** 사이 `C`와 들어줄 확률(조른다·떼쓴다) · 사이 나빠짐 확률 `s(C)` — 고르기 직전 상태의 값 */
  c: number;
  pBeg: number;
  pTan: number;
  s: number;
  choice: AskChoiceId;
  branch: AskEffectKey;
  /** 이 카드 이전에 이미 `parent_strained`가 켜져 있었나 */
  strainedBefore: boolean;
}

export interface AskLife {
  seed: number;
  era: ProfileId;
  wealth: ParentWealth;
  asks: AskObs[];
  /** 부모가 정한·흘러간 카드 수(20세 전) */
  parentCards: number;
  childCards: number;
  /** 본인이 고른 카드 수(조르기 포함) */
  selfCards: number;
  diedYoung: boolean;
  /** 같은 해에 조르기 카드가 두 장 있었나(0이어야 한다) */
  sameYearAsk: number;
  strainedAtEnd: boolean;
}

/** 20세가 되기 전까지 돌려 조르기 관찰을 모은다. `pool`에 조르기 사건이 없으면(기준선) `asks`가 빈다 */
export function runAskLife(start: GameState, seed: number, strategy: AskStrategy, pool: EventPool = EVENT_POOL): AskLife {
  const rng = createRng(seed ^ 0x9e3779b9);
  let s = start;
  const asks: AskObs[] = [];
  let parentCards = 0;
  let childCards = 0;
  let selfCards = 0;
  const askAges = new Set<number>();
  let sameYearAsk = 0;
  for (let guard = 0; s.phase === 'life' && s.age < 20; guard++) {
    if (guard > 400) throw new Error('runAskLife: 진행이 끝나지 않는다');
    if (s.pending === null) {
      const r = stepYear(s, pool);
      if (r.tick.by === 'parent') parentCards++;
      else if (r.tick.by === 'child') childCards++;
      s = r.state;
      continue;
    }
    const p = s.pending;
    const ev = pool.byId.get(p.eventId)!;
    selfCards++;
    let id: string;
    if (strategy === 'random') id = rng.pick(p.choiceIds);
    else if (strategy === 'auto') {
      const w = autoChoiceWeights(s, pool)!;
      id = w.ids[createRng(s.rngState).weightedIndex(w.weights)];
    } else {
      let best = p.choiceIds[0];
      let bestV = -Infinity;
      for (const cid of p.choiceIds) {
        let v: number;
        if (ev.ask !== undefined && cid !== 'endure') v = askBranchProbs(s, ev, cid as AskChoiceId).reduce((n, x) => n + x.prob * (ASK_EFFECTS[x.key].stats?.happiness ?? 0), 0);
        else {
          // 진로 카드(`pick`, SPEC-018 PL4)는 정의 선택지·효과가 없다 — 행복은 움직이지 않는다
          const c = ev.pick !== undefined ? undefined : ev.choices!.find((x) => x.id === cid)!;
          v = c === undefined ? 0 : (resolveEffects(c.effects, c.bonuses, condContextOf(s)).stats.happiness ?? 0);
        }
        if (v > bestV + 1e-12) {
          bestV = v;
          best = cid;
        }
      }
      id = best;
    }
    if (ev.ask !== undefined) {
      if (askAges.has(p.age)) sameYearAsk++;
      askAges.add(p.age);
      asks.push({
        kind: ev.ask.kind,
        age: p.age,
        wealth: s.character!.parentWealth,
        parenting: s.character!.parenting,
        c: askCloseness(s),
        pBeg: askGrantChance(s, ev, 'beg'),
        pTan: askGrantChance(s, ev, 'tantrum'),
        s: askStrainChance(s),
        choice: id as AskChoiceId,
        branch: askOutcomeOf(s, ev, id as AskChoiceId).branch,
        strainedBefore: s.flags.includes('parent_strained'),
      });
    }
    s = resolveChoiceStep(s, p.key, id, pool).state;
  }
  return { seed, era: start.generation!, wealth: start.character!.parentWealth, asks, parentCards, childCards, selfCards, diedYoung: s.phase === 'ending', sameYearAsk, strainedAtEnd: s.flags.includes('parent_strained') };
}

export function sampleAsk(era: ProfileId, lives: number, strategy: AskStrategy, pool: EventPool = EVENT_POOL, generationIndex = 0): AskLife[] {
  const out: AskLife[] = [];
  for (let i = 1; i <= lives; i++) {
    const seed = seedOf(i + generationIndex * GENERATION_SEED_STRIDE);
    out.push(runAskLife(startLife(seed, era), seed, strategy, pool));
  }
  return out;
}

/** 조르기 사건을 뺀 풀 — 부모+흘러감 카드 이동의 기준선(같은 시드·같은 전략) */
export const poolWithoutAsk = (): EventPool => createEventPool(EVENT_POOL.events.filter((e) => e.ask === undefined));

// ---------- 집계 ----------

const mean = (xs: readonly number[]): number => (xs.length === 0 ? 0 : xs.reduce((a, b) => a + b, 0) / xs.length);

export interface ExposureStats {
  lives: number;
  /** 판당 조르기 장수 분포 0/1/2/3+ (비율) */
  dist: [number, number, number, number];
  mean: number;
  shareAtLeast1: number;
  /** 종류별 한 판에 등장한 비율 */
  kindShare: Record<AskKind, number>;
  firstAgeMean: number | null;
  firstAgeShare: { upTo6: number; upTo8: number };
  sameYear: number;
  maxPerKind: number;
  max: number;
}

export function exposureOf(lives: readonly AskLife[]): ExposureStats {
  const n = lives.length;
  const dist: [number, number, number, number] = [0, 0, 0, 0];
  const kindShare = { toy: 0, lessons: 0, pet: 0 } as Record<AskKind, number>;
  const firstAges: number[] = [];
  let sameYear = 0;
  let maxPerKind = 0;
  let max = 0;
  for (const l of lives) {
    dist[Math.min(3, l.asks.length)]++;
    max = Math.max(max, l.asks.length);
    sameYear += l.sameYearAsk;
    for (const k of ASK_KINDS) {
      const c = l.asks.filter((a) => a.kind === k).length;
      if (c > 0) kindShare[k]++;
      maxPerKind = Math.max(maxPerKind, c);
    }
    if (l.asks.length > 0) firstAges.push(Math.min(...l.asks.map((a) => a.age)));
  }
  for (const k of ASK_KINDS) kindShare[k] /= n;
  return {
    lives: n,
    dist: dist.map((x) => x / n) as [number, number, number, number],
    mean: mean(lives.map((l) => l.asks.length)),
    shareAtLeast1: 1 - dist[0] / n,
    kindShare,
    firstAgeMean: firstAges.length === 0 ? null : mean(firstAges),
    firstAgeShare: { upTo6: firstAges.filter((a) => a <= 6).length / n, upTo8: firstAges.filter((a) => a <= 8).length / n },
    sameYear,
    maxPerKind,
    max,
  };
}

export interface GrantRow {
  kind: AskKind;
  wealth: ParentWealth;
  choice: 'beg' | 'tantrum';
  n: number;
  granted: number;
  /** 식의 기대값(고르기 직전 p의 평균)과 그 표준편차 */
  expected: number;
  sd: number;
}

/** 재력 × 종류 × 선택(조른다·떼쓴다)별 들어줌 비율과 식의 기대값 */
export function grantRows(lives: readonly AskLife[]): GrantRow[] {
  const rows: GrantRow[] = [];
  const all = lives.flatMap((l) => l.asks);
  for (const kind of ASK_KINDS) {
    for (const wealth of [1, 2, 3, 4, 5] as ParentWealth[]) {
      for (const choice of ['beg', 'tantrum'] as const) {
        const obs = all.filter((a) => a.kind === kind && a.wealth === wealth && a.choice === choice);
        if (obs.length === 0) continue;
        const ps = obs.map((a) => (choice === 'beg' ? a.pBeg : a.pTan));
        rows.push({
          kind,
          wealth,
          choice,
          n: obs.length,
          granted: obs.filter((a) => a.branch === `granted-${kind}`).length / obs.length,
          expected: mean(ps),
          sd: Math.sqrt(ps.reduce((v, p) => v + p * (1 - p), 0)) / obs.length,
        });
      }
    }
  }
  return rows;
}

export interface StrainStats {
  tantrumDenied: number;
  strained: number;
  expected: number;
  sd: number;
  /** 떼쓰기를 고르고 거절당한 가운데 이미 `parent_strained`였던 카드 수(참고) */
  alreadyStrained: number;
  /** 사이 나빠짐이 일어난 판의 비율(전체 판) */
  livesStrained: number;
  /** 떼쓰기 거절 밖(조른다·참는다·들어줌)의 사이 나빠짐 0건 */
  strainedOutsideTantrumDenied: number;
}

export function strainStats(lives: readonly AskLife[]): StrainStats {
  const all = lives.flatMap((l) => l.asks);
  const denied = all.filter((a) => a.choice === 'tantrum' && a.branch !== `granted-${a.kind}`);
  const ss = denied.map((a) => a.s);
  return {
    tantrumDenied: denied.length,
    strained: denied.filter((a) => a.branch === 'strained').length,
    expected: ss.reduce((a, b) => a + b, 0),
    sd: Math.sqrt(ss.reduce((v, s) => v + s * (1 - s), 0)),
    alreadyStrained: denied.filter((a) => a.strainedBefore).length,
    livesStrained: lives.filter((l) => l.strainedAtEnd).length / lives.length,
    strainedOutsideTantrumDenied: all.filter((a) => a.branch === 'strained' && a.choice !== 'tantrum').length,
  };
}

export interface ChoiceShare {
  beg: number;
  tantrum: number;
  endure: number;
  n: number;
}

export function choiceShare(lives: readonly AskLife[], pick: (a: AskObs) => boolean = () => true): ChoiceShare {
  const all = lives.flatMap((l) => l.asks).filter(pick);
  const n = all.length;
  const share = (c: AskChoiceId): number => (n === 0 ? 0 : all.filter((a) => a.choice === c).length / n);
  return { beg: share('beg'), tantrum: share('tantrum'), endure: share('endure'), n };
}

/** (종류 × 재력 × 양육 방식 × 사이 C) 칸마다 한 선택지의 최대 비율 — 표본이 minN 이상인 칸 */
export function dominanceOf(lives: readonly AskLife[], minN = 30): Array<{ cell: string; n: number; max: number; top: string }> {
  const cells = new Map<string, AskObs[]>();
  for (const a of lives.flatMap((l) => l.asks)) {
    const key = `${a.kind}/W${a.wealth}/${a.parenting}/C${a.c}`;
    cells.set(key, [...(cells.get(key) ?? []), a]);
  }
  const out: Array<{ cell: string; n: number; max: number; top: string }> = [];
  for (const [cell, obs] of cells) {
    if (obs.length < minN) continue;
    const sh = (['beg', 'tantrum', 'endure'] as const).map((c) => [c, obs.filter((a) => a.choice === c).length / obs.length] as const);
    const [top, max] = sh.reduce((b, x) => (x[1] > b[1] ? x : b));
    out.push({ cell, n: obs.length, max, top });
  }
  return out;
}

export interface CardMove {
  parent: number;
  child: number;
  self: number;
  diedYoung: number;
}

export const cardMoveOf = (lives: readonly AskLife[]): CardMove => ({
  parent: mean(lives.map((l) => l.parentCards)),
  child: mean(lives.map((l) => l.childCards)),
  self: mean(lives.map((l) => l.selfCards)),
  diedYoung: lives.filter((l) => l.diedYoung).length / lives.length,
});
