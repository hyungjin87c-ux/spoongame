import { describe, expect, it } from 'vitest';
import {
  GENERATION_IDS,
  autoResolveStep,
  closeChoiceYear,
  SCHEMA_VERSION,
  autoChoiceDelayMs,
  calendarYear,
  condContextOf,
  countTick,
  createRng,
  estimatePlaySeconds,
  familyChangesFor,
  isEventEligible,
  militaryDueOf,
  pacingCards,
  parseGame,
  resolveChoiceStep,
  serializeGame,
  tickReadNeedMs,
  emptyCounts,
  pendingLeadOf,
  resolveDelegated,
  resolveLeadGate,
  totalCards,
  eventPool,
  isChoiceEvent,
  playToEnd,
  stepYear,
  withGateTogether,
  type GameState,
  type ProfileId,
} from '../src/core';
import { lifeModeOf } from '../src/data/timingTable';
import { startLife, chooserFor, type Strategy } from '../scripts/simulateLib';
import { fnv } from './helpers/familyGolden';
import { listRepoTextFiles, readRepoText } from './helpers/repoFiles';

/**
 * G2 「고등학교 원서를 같은 해에 함께」 (결정 후속 255, CRITICAL — `ai-log/2026-11-17_SPEC-018_G2-plan.md`).
 * 이 파일은 엔진 변경 **앞** 커밋(①)에서 처음 만들었다: ⓪ 얼린 맞춤 판 해시와 ⑪ 지금 슬롯 규칙의 단위 시험.
 * 엔진 변경 뒤에는 같은 기대값으로 「표지 끔 = 엔진 변경 전」을 증명한다(`off`가 `withGateTogether(false)`를 건다).
 */

/** 표지 끔 세계에서 돈다 — 얼린 값은 엔진 변경 전(v0.6.0) 트리에서 만들었으므로 「끔 = 엔진 변경 전」을 바이트로 증명한다 */
const off = <T>(fn: () => T): T => withGateTogether(false, fn);

const GENS: readonly ProfileId[] = ['industrial', 'genx', 'alpha'];
const STRATEGIES: readonly Strategy[] = ['auto', 'first'];
const SEEDS = 200;
const seedOf = (i: number): number => i * 7919 + 13;

/** 한 칸(세대 × 전략)의 해: 시드 200판의 최종 상태 + counts + 마지막 틱을 한 해시로 */
function cellHash(gen: ProfileId, strategy: Strategy): string {
  const parts: string[] = [];
  for (let i = 1; i <= SEEDS; i++) {
    const seed = seedOf(i);
    const r = playToEnd(startLife(seed, gen), chooserFor(strategy, seed));
    parts.push(JSON.stringify([r.state, r.counts, r.last]));
  }
  return fnv(parts.join('\n'));
}

/** v0.6.0 엔진(`6d7c0de0` 트리)에서 이 함수로 만든 값 — 고치지 않는다. 다른 v0.6.1 엔진·콘텐츠 항목이 먼저 들어와 바뀌면 그 커밋에서 사유를 주석에 적고 다시 얼린다(계획 10-1절 ⑤) */
const FROZEN: Readonly<Record<string, string>> = {
  'industrial/auto': 'bdf34a0d',
  'industrial/first': '1684b068',
  'genx/auto': '9a015d02',
  'genx/first': '3482e316',
  'alpha/auto': '837fef94',
  'alpha/first': '1d482ed8',
};

describe('⓪ 얼린 맞춤 판 해시 (세대 3종 × 시드 200 × 전략 2 — 전 생애 최종 상태 + counts)', () => {
  it('표본 구성이 계획과 같다', () => {
    expect(GENS.every((g) => (GENERATION_IDS as readonly string[]).includes(g))).toBe(true);
    expect(Object.keys(FROZEN)).toHaveLength(GENS.length * STRATEGIES.length);
  });
  for (const gen of GENS) {
    for (const strategy of STRATEGIES) {
      it(`${gen} / ${strategy}: 표지 끔의 전 생애 해시가 얼린 값과 같다`, { timeout: 180_000 }, () => {
        expect(off(() => cellHash(gen, strategy))).toBe(FROZEN[`${gen}/${strategy}`]);
      });
    }
  }
});

// ---------- ⑪ 지금 슬롯 규칙의 단위 시험 ----------

const G1 = 'school-lessons';
const G2 = 'school-high-pick';
const pool = eventPool();

/** 한 판을 나이마다 한 걸음씩 돌리며 (걸음 직전 상태, 결과) 쌍을 모은다 — 대기는 자동 선택으로 푼다(해 하나가 닫힐 때까지) */
function* yearSteps(seed: number, gen: ProfileId): Generator<{ before: GameState; r: ReturnType<typeof stepYear> }> {
  let s: GameState = startLife(seed, gen);
  for (let guard = 0; s.phase === 'life' && guard < 400; guard++) {
    const before = s;
    const r = stepYear(s, pool);
    yield { before, r };
    let state = r.state;
    while (state.pending !== null) state = autoResolveStep(state, state.pending.key, pool).state;
    s = state;
  }
}

/** G2를 `seen`으로 막고 같은 해를 한 번 더 돌린 반사실 걸음 — 일반 추첨이 무엇을 뽑았을지 본다 */
const counterfactual = (before: GameState, id: string): ReturnType<typeof stepYear> => stepYear({ ...before, seen: { ...before.seen, [id]: 0 } }, pool);

describe('⑪ 지금 슬롯 규칙 (후속 241·243·244 — 이번에 바꾸지 않는다)', () => {
  it('빈 해: 일반 추첨이 아무것도 안 뽑은 15세 해는 G2 혼자 난다 — 부모 해결, 해가 닫히고 틱 `resolved + by + gate`', () => {
    let checked = 0;
    for (let i = 1; i <= 200 && checked < 5; i++) {
      for (const { before, r } of yearSteps(seedOf(i), 'millennial')) {
        if (before.age !== 15) continue;
        if (r.state.seen[G2] !== 15) break;
        const cf = counterfactual(before, G2);
        const empty = cf.tick.eventId === undefined || (cf.tick.milestoneIds ?? []).includes(cf.tick.eventId);
        if (!empty || cf.tick.familyIds !== undefined) break;
        expect(r.tick.kind, `시드 ${seedOf(i)}`).toBe('resolved');
        expect(r.tick.by).toBe('parent');
        expect(r.tick.gate).toBe(true);
        expect(r.tick.eventId).toBe(G2);
        expect(r.state.age).toBe(16);
        expect(r.state.pending).toBeNull();
        expect(r.state.history.filter((h) => h.age === 15 && h.kind === 'choice' && h.eventId === G2)).toHaveLength(1);
        checked++;
        break;
      }
    }
    expect(checked, '공허 통과 방지: 빈 해 표본이 있다').toBeGreaterThanOrEqual(5);
  });

  it('서술 해: 서술 장면이 뽑힌 15세 해는 G2가 그 장면을 대신한다 — 서술 효과·seen 없이 G2', () => {
    let checked = 0;
    for (let i = 1; i <= 300 && checked < 5; i++) {
      for (const { before, r } of yearSteps(seedOf(i), 'millennial')) {
        if (before.age !== 15) continue;
        if (r.state.seen[G2] !== 15) break;
        const cf = counterfactual(before, G2);
        const id = cf.tick.eventId;
        const ev = id === undefined ? undefined : pool.byId.get(id);
        if (ev === undefined || isChoiceEvent(ev) || (cf.tick.milestoneIds ?? []).includes(ev.id)) break;
        expect(r.tick.gate, `시드 ${seedOf(i)}`).toBe(true);
        expect(r.tick.eventId).toBe(G2);
        expect(r.state.seen[ev.id], '버려진 서술 장면은 seen에 남지 않는다').toBeUndefined();
        expect(r.state.history.some((h) => h.age === 15 && h.eventId === ev.id), '서술 줄도 없다').toBe(false);
        checked++;
        break;
      }
    }
    expect(checked, '공허 통과 방지: 서술 해 표본이 있다').toBeGreaterThanOrEqual(5);
  });

  it('가족 강제 해: 15세에 가족 강제 사건이 있으면 슬롯이 없다 — G2는 나지 않고 강제 카드가 난다', () => {
    let checked = 0;
    for (let i = 1; i <= 400 && checked < 3; i++) {
      const base = startLife(seedOf(i), 'millennial');
      const f = base.family;
      if (f === undefined || base.birthReport === null || base.birthReport.birthOrder !== 1 || f.lg === 1 || f.y.length === 0) continue;
      // 15세 해에 첫째의 첫 동생이 태어나는 판으로 손으로 옮긴다(생성된 판에서는 구조적으로 0 — 계획 2절)
      const y = f.y.map((x, j) => (j === 0 ? { ...x, k: 15 } : x));
      const hand: GameState = { ...base, age: 15, family: { ...f, y, l: f.l.filter((e) => !(e[0] === 1 && e[2] === 21)) } };
      const r = stepYear(hand, pool);
      if (r.tick.eventId !== 'infant-new-sibling') continue;
      expect(r.state.seen[G2], `시드 ${seedOf(i)}`).toBeUndefined();
      expect(r.tick.gate).toBeUndefined();
      expect(r.state.history.some((h) => h.eventId === G2)).toBe(false);
      checked++;
    }
    expect(checked, '공허 통과 방지: 손으로 만든 강제 해가 있다').toBeGreaterThanOrEqual(3);
  });

  it('G1 10~12세: 그 해 일반 추첨이 선택 카드를 뽑으면 G1을 넘기고(다음 해에 다시 본다), 15세 전에 G1이 이미 난 판은 두 번 나지 않는다', () => {
    let skipped = 0;
    let laterShown = 0;
    for (let i = 1; i <= 300; i++) {
      const steps = [...yearSteps(seedOf(i), 'millennial')];
      let g1Age: number | null = null;
      for (const { before, r } of steps) {
        if (before.age < 10 || before.age > 12) continue;
        if (r.state.seen[G1] !== undefined) {
          g1Age ??= r.state.seen[G1];
          continue;
        }
        const id = r.tick.eventId;
        const ev = id === undefined ? undefined : pool.byId.get(id);
        if (ev !== undefined && isChoiceEvent(ev) && id !== G1 && before.seen[G1] === undefined && (r.tick.kind === 'choice' || r.tick.by !== undefined)) {
          expect(r.tick.gate, `시드 ${seedOf(i)} ${before.age}세`).toBeUndefined();
          skipped++;
          if (before.age < 12) {
            const later = steps.find((x) => x.before.age > before.age && x.before.age <= 12 && x.r.state.seen[G1] !== undefined && x.before.seen[G1] === undefined);
            if (later !== undefined) laterShown++;
          }
        }
      }
      const g1Lines = steps.length === 0 ? [] : steps[steps.length - 1].r.state.history.filter((h) => h.eventId === G1);
      expect(g1Lines.length, `시드 ${seedOf(i)}: G1은 한 판에 한 번`).toBeLessThanOrEqual(1);
    }
    expect(skipped, '공허 통과 방지: G1을 넘긴 해가 있다').toBeGreaterThan(10);
    expect(laterShown, '넘긴 뒤 12세까지 다시 본 판이 있다').toBeGreaterThan(0);
  });
});

// ---------- ① ~ ⑩ 새 규칙 (엔진 변경 뒤) ----------

/** 표본: 세대 4종(밀레니얼 + 세 시대) × 시드 N — 한 판을 해마다 걸어 15세 걸음을 기록한다 */
const SAMPLE_GENS: readonly ProfileId[] = ['millennial', 'industrial', 'genx', 'alpha'];
const SAMPLE_N = 150;

interface Age15 {
  gen: ProfileId;
  seed: number;
  /** 15세 걸음 직전 상태 */
  before: GameState;
  r: ReturnType<typeof stepYear>;
  /** 관찰자 호출들(덧카드 호출은 `lead: true`) */
  calls: Array<{ by: string; ids: readonly string[]; eventId: string; lead: boolean }>;
}

/** 한 판을 15세까지 걸어 15세 걸음을 돌려준다(자동 선택). 15세 해에 닿기 전에 죽었으면 null */
function walkTo15(seed: number, gen: ProfileId): Age15 | null {
  let s: GameState = startLife(seed, gen);
  for (let guard = 0; s.phase === 'life' && guard < 100; guard++) {
    if (s.age === 15 && s.pending === null) {
      const calls: Age15['calls'] = [];
      const r = stepYear(s, pool, (e) => calls.push({ by: e.by, ids: e.ids, eventId: e.state.pending!.eventId, lead: e.lead === true }));
      return { gen, seed, before: s, r, calls };
    }
    let r = stepYear(s, pool);
    while (r.state.pending !== null) r = autoResolveStep(r.state, r.state.pending.key, pool);
    s = r.state;
  }
  return null;
}

let sampleCache: Age15[] | null = null;
const sample15 = (): Age15[] => {
  if (sampleCache === null) {
    sampleCache = [];
    for (const gen of SAMPLE_GENS) {
      for (let i = 1; i <= SAMPLE_N; i++) {
        const a = walkTo15(seedOf(i), gen);
        if (a !== null) sampleCache.push(a);
      }
    }
  }
  return sampleCache;
};
const companions = (): Age15[] => sample15().filter((a) => a.r.tick.lead !== undefined);

describe('① 규칙: 본인·부모·흘러감 동반 해와 틱 모양', () => {
  it('본인 동반 해: 틱 `choice + lead`, 나이 15 · G2 줄 · seen[G2] = 15 · X 대기 · lastChoiceAge = 15, 최상위 gate 없음', () => {
    const selfs = companions().filter((a) => a.r.tick.kind === 'choice');
    expect(selfs.length, '공허 통과 방지: 본인 동반 해 표본').toBeGreaterThanOrEqual(15);
    for (const a of selfs) {
      const { tick, state } = a.r;
      expect(tick.lead!.eventId).toBe(G2);
      expect(tick.lead!.by).toBe('parent');
      expect(tick.eventId).not.toBe(G2);
      expect(tick.gate).toBeUndefined();
      expect(state.age).toBe(15);
      expect(state.seen[G2]).toBe(15);
      expect(state.pending?.eventId).toBe(tick.eventId);
      expect(state.pending?.key).toBe(`${tick.eventId}@15`);
      expect(state.lastChoiceAge).toBe(15);
      expect(state.history.filter((h) => h.age === 15 && h.kind === 'choice' && h.eventId === G2)).toHaveLength(1);
      expect(pendingLeadOf(state, tick)).toBe(tick.lead);
      expect(pendingLeadOf({ ...state, pending: null }, tick)).toBeNull();
      expect(a.calls.map((c) => c.lead)).toEqual([true]); // 관찰자: 덧카드 한 번(본인 X는 위임 해결이 아니라 호출 없음)
    }
  });

  it('위임 동반 해: 틱 `resolved + by + lead`(사망이면 `death`), 연표 선택 줄 둘 — G2(부모) 다음 X, 관찰자 두 번(첫 호출 `lead: true`)', () => {
    const delegated = companions().filter((a) => a.r.tick.by !== undefined);
    expect(delegated.length, '공허 통과 방지: 위임 동반 해 표본').toBeGreaterThanOrEqual(5);
    for (const a of delegated) {
      const { tick, state } = a.r;
      expect(['resolved', 'death']).toContain(tick.kind);
      expect(tick.lead!.eventId).toBe(G2);
      expect(tick.gate).toBeUndefined();
      const lines = state.history.filter((h) => h.age === 15 && h.kind === 'choice');
      expect(lines.map((h) => h.eventId)).toEqual([G2, tick.eventId]);
      expect(lines[0].by).toBe('parent');
      expect(lines[1].by).toBe(tick.by);
      expect(state.pending).toBeNull();
      expect(a.calls.map((c) => c.lead)).toEqual([true, false]);
      expect(a.calls[0].eventId).toBe(G2);
      expect(a.calls[1].eventId).toBe(tick.eventId);
      if (tick.kind === 'resolved') expect(state.age).toBe(16);
    }
  });

  it('G2 혼자 난 해(빈 해·서술 해)는 지금 모양 그대로다: `gate: true`, lead 없음', () => {
    const alone = sample15().filter((a) => a.r.tick.eventId === G2);
    expect(alone.length).toBeGreaterThan(50);
    for (const a of alone) {
      expect(a.r.tick.gate).toBe(true);
      expect(a.r.tick.lead).toBeUndefined();
    }
  });

  it('덧카드는 15세에만 난다 — 그 밖의 나이 틱에는 lead가 없다', () => {
    for (const gen of ['millennial', 'alpha'] as const) {
      for (let i = 1; i <= 60; i++) {
        let s: GameState = startLife(seedOf(i), gen);
        for (let guard = 0; s.phase === 'life' && guard < 400; guard++) {
          let r = stepYear(s, pool);
          if (r.tick.lead !== undefined) expect(r.tick.fromAge).toBe(15);
          while (r.state.pending !== null) {
            r = autoResolveStep(r.state, r.state.pending.key, pool);
            expect(r.tick.lead).toBeUndefined();
          }
          s = r.state;
        }
      }
    }
  });

  it('같은 해 사망: 위임 동반 해에서 X 해결 뒤 사망하면 틱 `death + by + lead`, 집계 death+1 · deathDelegated+1 · leadCards+1 · gateCards+1', () => {
    // 15세 위임 동반 해의 해 끝 사망 굴림을 건강 0으로 밀어 사망 갈래를 만든다(건강은 G2·X의 효과와 무관한 입력)
    let found = 0;
    for (const a of companions().filter((x) => x.r.tick.by !== undefined)) {
      const doomed: GameState = { ...a.before, stats: { ...a.before.stats, health: 0 } };
      const r = stepYear(doomed, pool);
      if (r.tick.kind !== 'death' || r.tick.lead === undefined || r.tick.by === undefined) continue;
      expect(r.state.phase).toBe('ending');
      expect(r.state.history.filter((h) => h.age === 15 && h.kind === 'choice').map((h) => h.eventId)).toEqual([G2, r.tick.eventId]);
      const counts = emptyCounts();
      countTick(counts, r.tick);
      expect(counts).toMatchObject({ death: 1, deathDelegated: 1, leadCards: 1, gateCards: 1, parent: 0, child: 0, choice: 0 });
      expect(totalCards(counts)).toBe(2);
      found++;
    }
    expect(found, '공허 통과 방지: 사망 동반 해').toBeGreaterThan(0);
  });
});

// ---------- ② 켬/끔 짝 ----------

/** 한 판을 끝까지 자동·첫째 선택으로 돌리며 15세 걸음의 기록을 함께 남긴다 */
interface PairLife {
  pre15: GameState | null;
  tick15: ReturnType<typeof stepYear>['tick'] | null;
  /** 15세 해 일반 추첨 카드 X의 보이는 선택지(본인은 대기의 choiceIds, 위임은 X 해결 관찰의 ids) */
  visible15: readonly string[] | null;
  lastChoiceAge15: number | null;
  final: GameState;
  counts: ReturnType<typeof emptyCounts>;
}

function pairLife(seed: number, gen: ProfileId, strategy: Strategy): PairLife {
  const chooser = chooserFor(strategy, seed);
  let s: GameState = startLife(seed, gen);
  const counts = emptyCounts();
  const rec: PairLife = { pre15: null, tick15: null, visible15: null, lastChoiceAge15: null, final: s, counts };
  for (let guard = 0; s.phase === 'life' && guard < 1000; guard++) {
    let r: ReturnType<typeof stepYear>;
    if (s.pending !== null) {
      const picked = chooser === null ? null : chooser(s);
      r = picked === null ? autoResolveStep(s, s.pending.key, pool) : resolveChoiceStep(s, s.pending.key, picked, pool);
    } else if (s.age === 15 && rec.pre15 === null) {
      rec.pre15 = s;
      const seenIds: Array<readonly string[]> = [];
      r = stepYear(s, pool, (e) => seenIds.push(e.ids));
      rec.tick15 = r.tick;
      rec.lastChoiceAge15 = r.state.lastChoiceAge;
      rec.visible15 = r.state.pending !== null ? [...r.state.pending.choiceIds] : (seenIds[seenIds.length - 1] ?? null);
    } else {
      r = stepYear(s, pool);
    }
    s = r.state;
    countTick(counts, r.tick, s.lifeLength);
  }
  rec.final = s;
  return rec;
}

describe('② 켬/끔 짝 (같은 시드 · 세대 3종 × 전략 2)', () => {
  for (const gen of GENS) {
    for (const strategy of STRATEGIES) {
      it(`${gen} / ${strategy}: 15세 걸음 직전 상태 · 15세 일반 카드 id·보이는 선택지·결정자·lastChoiceAge가 같고, 동반 해가 아닌 판은 최종 상태·counts까지 같다`, { timeout: 180_000 }, () => {
        let companion = 0;
        let nonCompanion = 0;
        let selfOpen = 0;
        let selfOpenOff = 0;
        for (let i = 1; i <= 120; i++) {
          const seed = seedOf(i);
          const on = pairLife(seed, gen, strategy);
          const base = off(() => pairLife(seed, gen, strategy));
          expect(on.pre15, `시드 ${seed}: 15세 걸음 직전`).toEqual(base.pre15);
          if (on.tick15 === null || base.tick15 === null) {
            expect(on.final).toEqual(base.final);
            continue;
          }
          // (b) 15세 해 일반 카드: G2 혼자 난 해는 두 세계 모두 G2가 낸다(같은 틱 최상위 id)
          expect(on.tick15.eventId, `시드 ${seed}`).toBe(base.tick15.eventId);
          expect(on.tick15.by, `시드 ${seed}`).toBe(base.tick15.by);
          expect(on.tick15.kind === 'choice', `시드 ${seed}`).toBe(base.tick15.kind === 'choice');
          expect(on.visible15, `시드 ${seed}`).toEqual(base.visible15);
          expect(on.lastChoiceAge15, `시드 ${seed}`).toBe(base.lastChoiceAge15);
          if (on.tick15.kind === 'choice') selfOpen++;
          if (base.tick15.kind === 'choice') selfOpenOff++;
          if (on.tick15.lead !== undefined) {
            companion++;
            expect(base.tick15.lead).toBeUndefined();
            expect(base.final.seen[G2], '끔에서는 G2를 넘긴다').toBeUndefined();
          } else {
            nonCompanion++;
            // (c) 동반 해가 아닌 판의 최종 상태·counts
            expect(on.final, `시드 ${seed}`).toEqual(base.final);
            expect(on.counts, `시드 ${seed}`).toEqual(base.counts);
          }
        }
        expect(selfOpen, '(d) 15세에 본인 카드가 열린 판 수').toBe(selfOpenOff);
        expect(companion, '공허 통과 방지: 동반 판').toBeGreaterThan(10);
        expect(nonCompanion).toBeGreaterThan(30);
      });
    }
  }

  it('15세 선택 카드 해: 끔은 G2를 넘기고(15세 범위 15~15라 그 판에는 G2가 없다) 켬은 같은 해에 G2를 먼저 해결한다', () => {
    const a = companions().find((x) => x.r.tick.kind === 'choice')!;
    const off15 = off(() => stepYear(a.before, pool));
    expect(off15.state.seen[G2]).toBeUndefined();
    expect(off15.tick.lead).toBeUndefined();
    expect(off15.tick.eventId).toBe(a.r.tick.eventId);
    expect(a.r.state.seen[G2]).toBe(15);
  });
});

// ---------- ③ 난수 칸 수 ----------

/** createRng(from)을 한 칸씩 나아가게 해 `to`와 만날 때까지의 횟수 */
function used(from: number, to: number): number {
  const rng = createRng(from);
  for (let n = 0; n <= 60; n++) {
    if (rng.getState() === to) return n;
    rng.next();
  }
  return -1;
}

/** 걸음 하나를 해가 닫힐 때까지 자동으로 마치고 마지막 상태를 돌려준다 */
function closed(s0: GameState): GameState {
  let r = stepYear(s0, pool);
  while (r.state.pending !== null) r = autoResolveStep(r.state, r.state.pending.key, pool);
  return r.state;
}

describe('③ 난수 칸 수', () => {
  it('동반 해는 끈 같은 해보다 정확히 한 칸 더 쓰고, 빈 해·서술 해(G2 혼자)와 동반이 아닌 해는 같다', () => {
    let companionChecked = 0;
    let aloneChecked = 0;
    for (const a of sample15()) {
      const onYear = closed(a.before);
      const offYear = off(() => closed(a.before));
      if (onYear.phase !== 'life' || offYear.phase !== 'life') continue; // 사망 해는 사망 원인 뽑기가 더해져 칸 수가 달라진다
      const diff = used(a.before.rngState, onYear.rngState) - used(a.before.rngState, offYear.rngState);
      if (a.r.tick.lead !== undefined) {
        expect(diff, `${a.gen}/${a.seed}: 동반 해`).toBe(1);
        companionChecked++;
      } else if (a.r.tick.eventId === G2) {
        expect(diff, `${a.gen}/${a.seed}: G2 혼자`).toBe(0);
        aloneChecked++;
      } else {
        expect(diff, `${a.gen}/${a.seed}: 그 밖`).toBe(0);
      }
    }
    expect(companionChecked, '공허 통과 방지').toBeGreaterThan(30);
    expect(aloneChecked).toBeGreaterThan(30);
  });

  it('`resolveLeadGate(P).state.rngState`는 `P.rngState`에서 정확히 한 칸 나아간 값이다', () => {
    const Ps = naturalG2Pendings();
    expect(Ps.length).toBeGreaterThan(50);
    for (const P of Ps.slice(0, 150)) {
      const g = resolveLeadGate(P, pool)!;
      expect(used(P.rngState, g.state.rngState)).toBe(1);
    }
  });
});

// ---------- ④ 닫기 법칙 · ⑤ 해를 닫지 않는다 ----------

/** 자연 발생 G2 대기 상태 P — 빈 해·서술 해에 슬롯이 G2를 부모 결정으로 해결하는 순간 관찰자가 받는 상태(`resolveDelegated`가 받는 그 상태) */
let pendingCache: GameState[] | null = null;
function naturalG2Pendings(): GameState[] {
  if (pendingCache === null) {
    pendingCache = [];
    for (const gen of SAMPLE_GENS) {
      for (let i = 1; i <= 200; i++) {
        let s: GameState = startLife(seedOf(i), gen);
        for (let guard = 0; s.phase === 'life' && s.age <= 15 && guard < 100; guard++) {
          let r = stepYear(s, pool, (e) => {
            if (e.state.pending?.eventId === G2 && e.lead !== true) pendingCache!.push(e.state);
          });
          while (r.state.pending !== null) r = autoResolveStep(r.state, r.state.pending.key, pool);
          s = r.state;
        }
      }
    }
  }
  return pendingCache;
}

describe('④ 닫기 법칙: closeChoiceYear(resolveLeadGate(P).state, P) = resolveDelegated(P, parent).state', () => {
  it('자연 발생 G2 대기 상태 300개 이상에서 정규화 없이 같고, 덧카드 값은 그 틱의 값과 같다', () => {
    const Ps = naturalG2Pendings();
    expect(Ps.length, '공허 통과 방지: 대조 수').toBeGreaterThanOrEqual(300);
    for (const P of Ps) {
      const g = resolveLeadGate(P, pool);
      expect(g, '부모 결정이라 덧카드가 선다').not.toBeNull();
      const whole = resolveDelegated(P, 'parent', pool);
      expect(closeChoiceYear(g!.state, P)).toEqual(whole.state);
      const t = whole.tick;
      expect(g!.lead).toEqual({ eventId: t.eventId, by: t.by, choiceId: t.choiceId, impact: t.impact, readNeedMs: t.readNeedMs, ...(t.firstParent === true ? { firstParent: true } : {}) });
    }
  });

  it('`closeChoiceYear`는 시험·측정 전용이다 — src 안의 사용처는 정의뿐', () => {
    const srcFiles = listRepoTextFiles().paths.filter((p) => p.startsWith('src/') && /\.(ts|tsx)$/.test(p));
    expect(srcFiles.length, '공허 통과 방지').toBeGreaterThan(100);
    const hits = srcFiles.filter((p) => (readRepoText(p) ?? '').includes('closeChoiceYear('));
    expect(hits).toEqual(['src/core/life.ts']);
    const text = readRepoText('src/core/life.ts') ?? '';
    expect(text.match(/closeChoiceYear\(/g)).toHaveLength(1);
  });
});

describe('⑤ 해를 닫지 않는다', () => {
  it('덧카드 해결은 나이·단계·대기·사망을 그대로 두고 연표에 선택 줄 하나만 더한다 — 해 끝 갱신(자연 변화)은 적용되지 않는다', () => {
    const Ps = naturalG2Pendings();
    for (const P of Ps.slice(0, 200)) {
      const g = resolveLeadGate(P, pool)!;
      const s = g.state;
      expect(s.age).toBe(P.age);
      expect(s.phase).toBe('life');
      expect(s.pending).toBeNull();
      expect(s.death).toBeNull();
      expect(s.history).toHaveLength(P.history.length + 1);
      const line = s.history[s.history.length - 1];
      expect([line.age, line.kind, line.eventId, line.by]).toEqual([P.age, 'choice', G2, 'parent']);
      expect(s.seen[G2]).toBe(P.age);
      expect(s.lastChoiceAge).toBe(P.lastChoiceAge);
      // 닫으면 달라진다(자연 변화·나이) — 안 닫은 상태와 닫은 상태가 같지 않다
      expect(closeChoiceYear(s, P).age).toBe(P.age + 1);
    }
  });
});

// ---------- ⑥ 집계 식 ----------

describe('⑥ 집계 식 (세대 3종 × 시드 100 × 전략 2)', () => {
  for (const gen of GENS) {
    for (const strategy of STRATEGIES) {
      it(`${gen} / ${strategy}: 해 수 합 · 총 카드 = 연표 선택 줄 · by 줄 = parent + child + deathDelegated + leadCards · c_self = by 없는 줄 · 페이싱 상한 · 선택 줄이 둘인 나이 = leadCards ≤ 1`, { timeout: 180_000 }, () => {
        let leadLives = 0;
        for (let i = 1; i <= 100; i++) {
          const seed = seedOf(i);
          const r = playToEnd(startLife(seed, gen), chooserFor(strategy, seed));
          const c = r.counts;
          const final = r.state;
          const tag = `${gen}/${strategy}/${seed}`;
          const lines = final.history.filter((h) => h.kind === 'choice');
          expect(c.quiet + c.narrative + c.resolved + c.parent + c.child + c.death, `${tag}: 해 수 합`).toBe(final.death!.age + 1);
          expect(totalCards(c), `${tag}: 총 카드`).toBe(lines.length);
          expect(c.parent + c.child + c.deathDelegated + (c.leadCards ?? 0), `${tag}: by 줄`).toBe(lines.filter((h) => h.by !== undefined).length);
          expect(c.choice, `${tag}: c_self`).toBe(lines.filter((h) => h.by === undefined).length);
          expect(pacingCards(c), `${tag}: 페이싱 상한`).toBeLessThanOrEqual(lifeModeOf(final.lifeLength).pacing.hard);
          expect(c.extraLines).toBeGreaterThanOrEqual(0);
          // 선택 줄이 둘인 나이는 덧카드 해뿐이고, 그 나이의 첫 선택 줄은 G2 · 부모
          const byAge = new Map<number, typeof lines>();
          for (const h of lines) byAge.set(h.age, [...(byAge.get(h.age) ?? []), h]);
          const doubles = [...byAge.values()].filter((l) => l.length >= 2);
          expect(doubles.length, `${tag}: 선택 줄이 둘인 나이`).toBe(c.leadCards ?? 0);
          expect(doubles.length).toBeLessThanOrEqual(1);
          for (const d of doubles) expect([d[0].eventId, d[0].by]).toEqual([G2, 'parent']);
          if ((c.leadCards ?? 0) > 0) leadLives++;
          // 덧카드 필요량은 본인 동반 해에서만 쌓인다
          if (c.leadReadMs !== undefined) expect(c.leadCards).toBeGreaterThan(0);
        }
        expect(leadLives, '공허 통과 방지: 동반 판').toBeGreaterThan(10);
      });
    }
  }

  it('읽기 항: leadReadMs가 있으면 estimatePlaySeconds의 읽기 항이 그만큼 늘고, 없으면 지금 값이다', () => {
    const base = emptyCounts();
    const withLead = { ...emptyCounts(), choice: 3, leadCards: 1, gateCards: 1, leadReadMs: 30_000 };
    const without = { ...withLead, leadReadMs: undefined };
    delete (without as { leadReadMs?: number }).leadReadMs;
    const slow = { speed: 1 as const, skipToDecision: false };
    const a = estimatePlaySeconds(withLead, slow, null, 'present', 'high');
    const b = estimatePlaySeconds(without, slow, null, 'present', 'high');
    expect(a - b).toBeCloseTo(30, 6);
    expect(estimatePlaySeconds(base, slow, null, 'present')).toBe(estimatePlaySeconds({ ...base }, slow, null, 'present'));
  });

  it('위임 동반 해의 연출 대기: 필요량 = X의 필요량 + 덧카드의 필요량 (`tickReadNeedMs`) — 덧카드가 없으면 그대로', () => {
    const a = companions().find((x) => x.r.tick.kind === 'resolved' && x.r.tick.by !== undefined)!;
    expect(tickReadNeedMs(a.r.tick)).toBe(a.r.tick.readNeedMs! + a.r.tick.lead!.readNeedMs);
    const { lead: _lead, ...plain } = a.r.tick;
    void _lead;
    expect(tickReadNeedMs(plain)).toBe(plain.readNeedMs);
    expect(tickReadNeedMs({})).toBeUndefined();
    expect(autoChoiceDelayMs(1, 1)).toBe(3000);
    expect(autoChoiceDelayMs(2, 1, 20_000)).toBe(10_000);
    expect(autoChoiceDelayMs(1, 1, 1_000)).toBe(3000);
  });
});

// ---------- ⑦ 맞춤 없는 판 ----------

describe('⑦ 맞춤 없는 판(구형 저장·persona 없음): 켬/끔 전 생애 deepEqual, counts에 새 키 없음', () => {
  for (const gen of GENS) {
    it(`${gen}: persona를 뗀 판 100개`, { timeout: 180_000 }, () => {
      for (let i = 1; i <= 100; i++) {
        const seed = seedOf(i);
        const start = startLife(seed, gen);
        const { persona: _p, ...rest } = start;
        void _p;
        const plain = rest as GameState;
        expect(plain.persona).toBeUndefined();
        const on = playToEnd(plain, chooserFor('auto', seed));
        const base = off(() => playToEnd(plain, chooserFor('auto', seed)));
        expect(on.state, `시드 ${seed}`).toEqual(base.state);
        expect(on.counts).toEqual(base.counts);
        expect(on.last).toEqual(base.last);
        expect('leadCards' in on.counts || 'leadReadMs' in on.counts).toBe(false);
        expect(on.state.seen[G2], '맞춤 없는 판에는 G2가 없다').toBeUndefined();
      }
    });
  }
});

// ---------- ⑧ 저장 ----------

describe('⑧ 저장: 새 필드 0 · 왕복 · 복원 뒤 끝까지 = 메모리 끝까지 · 대기만 풀려도 G2는 한 번', () => {
  /** 본인 동반 해의 대기 상태 S(= 저장되는 상태) */
  const selfCompanions = (): Age15[] => companions().filter((a) => a.r.tick.kind === 'choice');

  it('SCHEMA_VERSION은 9이고, 동반 해 대기 상태의 직렬화 키 집합은 v0.6.0 본인 카드 대기 상태와 같다', () => {
    expect(SCHEMA_VERSION).toBe(9);
    const S = selfCompanions()[0].r.state;
    const plain = ((): GameState => {
      let s: GameState = startLife(seedOf(1), 'millennial');
      for (let guard = 0; guard < 200; guard++) {
        const r = stepYear(s, pool);
        if (r.state.pending !== null && r.state.age !== 15) return r.state;
        s = r.state.pending !== null ? autoResolveStep(r.state, r.state.pending.key, pool).state : r.state;
      }
      throw new Error('본인 카드 대기를 못 찾았다');
    })();
    const keys = (g: GameState): string[] => Object.keys((JSON.parse(serializeGame(g)) as { data: Record<string, unknown> }).data).sort();
    expect(keys(S)).toEqual(keys(plain));
    expect(Object.keys(S.pending!).sort()).toEqual(Object.keys(plain.pending!).sort());
  });

  it('저장 → 불러오기 왕복이 deepEqual이고, 복원 상태에서 끝까지 = 메모리에서 끝까지', { timeout: 120_000 }, () => {
    for (const a of selfCompanions().slice(0, 25)) {
      const S = a.r.state;
      const restored = parseGame(serializeGame(S), pool);
      expect(restored, `${a.gen}/${a.seed}`).toEqual(S);
      const mem = playToEnd(S, null, pool);
      const rest = playToEnd(restored!, null, pool);
      expect(rest.state).toEqual(mem.state);
      expect(rest.counts).toEqual(mem.counts);
    }
  });

  it('대기만 지운 뒤(콘텐츠 갱신)에도 G2는 한 번이고, v0.6.0 꼴(G2 없는) 대기가 풀리면 G2가 한 번 난다', { timeout: 120_000 }, () => {
    const g2Lines = (s: GameState): number => s.history.filter((h) => h.kind === 'choice' && h.eventId === G2).length;
    for (const a of selfCompanions().slice(0, 25)) {
      const cleared: GameState = { ...a.r.state, pending: null };
      expect(g2Lines(playToEnd(cleared, null, pool).state), `${a.gen}/${a.seed}: 켠 상태에서 대기만 풀림`).toBe(1);
      const v060 = off(() => stepYear(a.before, pool)).state;
      expect(v060.pending, '끔의 15세 걸음도 본인 대기다').not.toBeNull();
      expect(v060.seen[G2]).toBeUndefined();
      const loosened: GameState = { ...v060, pending: null };
      expect(g2Lines(playToEnd(loosened, null, pool).state), `${a.gen}/${a.seed}: v0.6.0 꼴 대기 풀림`).toBe(1);
    }
  });
});

// ---------- ⑨ 경계 ----------

describe('⑨ 경계: 가족 강제 해 · left_school · G1 해', () => {
  it('손으로 만든 15세 가족 강제 해: 덧카드가 없고 켬/끔의 걸음 결과가 같다', () => {
    let checked = 0;
    for (let i = 1; i <= 400 && checked < 3; i++) {
      const base = startLife(seedOf(i), 'millennial');
      const f = base.family;
      if (f === undefined || base.birthReport === null || base.birthReport.birthOrder !== 1 || f.lg === 1 || f.y.length === 0) continue;
      const y = f.y.map((x, j) => (j === 0 ? { ...x, k: 15 } : x));
      const hand: GameState = { ...base, age: 15, family: { ...f, y, l: f.l.filter((e) => !(e[0] === 1 && e[2] === 21)) } };
      const on = stepYear(hand, pool);
      if (on.tick.eventId !== 'infant-new-sibling') continue;
      const base0 = off(() => stepYear(hand, pool));
      expect(on.tick.lead).toBeUndefined();
      expect(on.state).toEqual(base0.state);
      expect(on.tick).toEqual(base0.tick);
      checked++;
    }
    expect(checked, '공허 통과 방지').toBeGreaterThanOrEqual(3);
  });

  it('left_school: G2 자격이 없어 슬롯이 없다 — 덧카드 없이 켬/끔이 같다', () => {
    const sel = sample15().filter((a) => a.before.character !== null).slice(0, 80);
    for (const a of sel) {
      const gone: GameState = { ...a.before, flags: [...a.before.flags.filter((x) => x !== 'left_school'), 'left_school'] };
      const on = stepYear(gone, pool);
      const base = off(() => stepYear(gone, pool));
      expect(on.tick.lead).toBeUndefined();
      expect(on.state.seen[G2]).toBeUndefined();
      expect(on.state).toEqual(base.state);
    }
  });
});

// ---------- ⑩ 노출 구조 · 하한 ----------

describe('⑩ G2 노출: 자격이 있고 강제·병역 슬롯이 없는 15세 해는 모두 G2가 난다', () => {
  it('미노출 0건 · 노출 ≥ 98% · 동반 판 몫이 기준선 34.5% 근처', () => {
    const ev = pool.byId.get(G2)!;
    let alive = 0;
    let shown = 0;
    let eligibleCount = 0;
    let missed = 0;
    let comp = 0;
    for (const a of sample15()) {
      const pre = a.before;
      const view = { ...condContextOf(pre), age: 15, year: calendarYear(pre.character!.birthYear, 15), seen: pre.seen };
      const eligible = isEventEligible(ev, view);
      const slotFree = familyChangesFor(pre, 15, pool).forcedEvent === undefined && militaryDueOf(pre, pool, 15) === null;
      alive++;
      if (a.r.state.seen[G2] === 15) shown++;
      if (a.r.tick.lead !== undefined) comp++;
      if (eligible && slotFree) {
        eligibleCount++;
        if (a.r.state.seen[G2] !== 15) missed++;
      }
    }
    expect(eligibleCount).toBeGreaterThan(500);
    expect(missed, '자격이 있는데 안 난 판').toBe(0);
    expect(shown / alive, '표본이 작아(600판) 98%보다 조금 낮게 둔다 — 정식 판정(≥ 98.0%, 네 세대 3000판)은 report:persona').toBeGreaterThanOrEqual(0.96);
    expect(comp / alive).toBeGreaterThan(0.25);
    expect(comp / alive).toBeLessThan(0.45);
  });
});
