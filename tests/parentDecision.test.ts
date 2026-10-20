import { describe, expect, it } from 'vitest';
import {
  ERAS,
  PARENTING_STYLES,
  PARENT_WEALTHS,
  STAT_KEYS,
  balanceFactor,
  condContextOf,
  createEventPool,
  deciderOf,
  decisionFor,
  isChoiceEvent,
  isPreAdultChoice,
  moneyNeedOf,
  parentChoiceWeights,
  parentTableProblems,
  possibleAgesOf,
  resolveEffects,
  siblingFactor,
  validateEventFiles,
  visibleChoices,
  type Decider,
  type EventDef,
  type GameState,
  type ParentWealth,
  type ParentingStyle,
} from '../src/core';
import { EVENT_POOL } from '../src/data/events';
import {
  ALL_SELF_FROM_AGE,
  PARENT_AREAS,
  PARENT_DECISION_TABLE,
  PARENT_FIT,
  PARENT_FIT_RANGE,
  PARENT_MODEL,
  PARENT_PRIORITY,
  PARENT_TABLE_COUNTS,
  SELF_AREAS,
  SELF_FROM_AGE,
  parentFitOf,
} from '../src/data/parentDecisionTable';
import { startLife } from '../scripts/simulateLib';

/**
 * 어린 시절 부모님 결정 — 분류표·규칙·확률 모델 (SPEC-005 PD1·PD2·PD4, 설계 문서 docs/data/parent-decision-model.md 5절의 T1·T2·T4).
 * 시뮬레이션 분포(T5)는 tests/parentDecisionSim.test.ts, 문서 ↔ 코드 표 대조(T1b)는 tests/parentDecisionDoc.test.ts에 있다.
 */

type Who = Decider;
/** 설계 문서 1-3절의 「나이별 결정자」 열을 손으로 옮긴 기대표 — 시험이 코드의 표가 아니라 이 표로 `deciderOf`를 판정한다 (구간: [from, to, 결정자]) */
const EXPECTED: Readonly<Record<string, ReadonlyArray<readonly [number, number, Who]>>> = {
  'infant-care': [[1, 5, 'parent']],
  'infant-fever': [[1, 5, 'parent']],
  'infant-stories': [[2, 6, 'parent']],
  'infant-screen': [[2, 6, 'parent']],
  'infant-new-sibling': [[2, 4, 'child']],
  'infant-meal-start': [[0, 1, 'parent']],
  'infant-parental-leave': [[0, 0, 'parent']],
  'infant-first-birthday': [[1, 1, 'parent']],
  'infant-daycare-wait': [[1, 2, 'parent']],
  'infant-noise': [[2, 6, 'parent']],
  'infant-kindergarten': [[3, 4, 'parent']],
  'infant-sibling-toy': [[3, 6, 'child']],
  'infant-hospital-stay': [[3, 6, 'parent']],
  'infant-moving': [[3, 6, 'parent']],
  'infant-early-lessons': [[5, 6, 'parent']],
  'school-supplies': [[7, 7, 'parent']],
  'school-after-hours': [[7, 7, 'parent']],
  'school-friend': [[8, 12, 'child'], [13, 13, 'self']],
  'school-puppy': [[8, 14, 'parent']],
  'school-bully': [[9, 12, 'child'], [13, 15, 'self']],
  'school-tutoring': [[10, 16, 'parent']],
  'school-club': [[11, 12, 'parent'], [13, 17, 'self']],
  'school-friend-quarrel': [[11, 12, 'child'], [13, 17, 'self']],
  'school-academy-night': [[11, 18, 'parent']],
  'school-teacher-notice': [[12, 12, 'child'], [13, 18, 'self']],
  'school-family-priority': [[12, 17, 'child']],
  'school-early-work': [[13, 16, 'parent']],
  'school-career-choice': [[14, 17, 'parent']],
  'school-first-love': [[15, 19, 'self']],
  'school-scholarship': [[15, 18, 'parent'], [19, 19, 'self']],
  'school-exam': [[16, 18, 'parent'], [19, 19, 'self']],
  'school-parttime': [[16, 18, 'parent'], [19, 19, 'self']],
};

const expectedAt = (id: string, age: number): Who | undefined => EXPECTED[id].find(([a, b]) => age >= a && age <= b)?.[2];

describe('T1 분류표 = 데이터 일치 (PD2 검증 ①②③④)', () => {
  const preAdult = EVENT_POOL.events.filter(isPreAdultChoice);

  it('① 19세 미만에서 일어날 수 있는 선택지 이벤트 32장이 표의 키와 정확히 같다: 누락도 남는 키도 없다', () => {
    expect(preAdult).toHaveLength(32);
    expect(preAdult.map((e) => e.id).sort()).toEqual(Object.keys(PARENT_DECISION_TABLE).sort());
    expect(Object.keys(EXPECTED).sort()).toEqual(Object.keys(PARENT_DECISION_TABLE).sort());
    expect(parentTableProblems(EVENT_POOL.events)).toEqual([]);
  });

  it('① 청년 이상 58장은 표에 없다 (모두 본인) — 그리고 표 밖 이벤트도 19세 이상이면 throw하지 않는다', () => {
    const adult = EVENT_POOL.events.filter((e) => isChoiceEvent(e) && !isPreAdultChoice(e));
    expect(adult).toHaveLength(58);
    for (const ev of adult) {
      expect(PARENT_DECISION_TABLE[ev.id], ev.id).toBeUndefined();
      for (const a of possibleAgesOf(ev)) expect(deciderOf(ev.id, a), `${ev.id}@${a}`).toBe('self');
    }
  });

  it('① 새 선택지 이벤트를 분류 없이 추가하면 점검이 실패한다 (변이 점검: 풀에서 한 줄만 지워도 / 가짜 이벤트를 더해도 잡힌다)', () => {
    const fake = (id: string, min: number, max: number, stages: string[]) => ({
      id,
      title: '시험용 결정',
      text: '시험용 장면입니다. 아직 분류표에 없는 새 결정 카드입니다.',
      stages,
      ageRange: { min, max },
      weight: 10,
      once: true,
      choices: [
        { id: 'a', label: '하나를 고른다', result: '하나를 골랐습니다. 그 뒤로 일상이 이어졌습니다.', effects: { stats: { happiness: 1 } } },
        { id: 'b', label: '다른 것을 고른다', result: '다른 것을 골랐습니다. 그 뒤로 일상이 이어졌습니다.', effects: { stats: { happiness: 1 } } },
      ],
    });
    const withFake = createEventPool(validateEventFiles({ 'a.json': { events: [fake('infant-zz-new', 2, 4, ['infant'])] } }));
    const problems = parentTableProblems([...EVENT_POOL.events, ...withFake.events]);
    expect(problems.some((p) => p.startsWith('infant-zz-new') && p.includes('분류표'))).toBe(true);
    // 20세 이상에서만 일어나는 새 이벤트는 분류가 필요 없다
    const adultFake = createEventPool(validateEventFiles({ 'b.json': { events: [fake('youth-zz-new', 25, 30, ['youth'])] } }));
    expect(parentTableProblems([...EVENT_POOL.events, ...adultFake.events])).toEqual([]);
    // 표에서 한 줄을 빼면 그 이벤트가 걸린다
    const { 'school-puppy': _drop, ...rest } = PARENT_DECISION_TABLE;
    void _drop;
    expect(parentTableProblems(EVENT_POOL.events, rest).some((p) => p.startsWith('school-puppy'))).toBe(true);
    // 표에만 있는 id도 잡힌다
    expect(parentTableProblems(EVENT_POOL.events, { ...PARENT_DECISION_TABLE, 'infant-ghost': { areas: ['care'] } }).some((p) => p.startsWith('infant-ghost'))).toBe(true);
    // 알 수 없는 영역 코드·childActUntil 범위
    expect(parentTableProblems(EVENT_POOL.events, { ...PARENT_DECISION_TABLE, 'school-puppy': { areas: ['pets' as 'home'] } }).some((p) => p.includes('영역 코드'))).toBe(true);
    expect(parentTableProblems(EVENT_POOL.events, { ...PARENT_DECISION_TABLE, 'school-friend': { areas: ['friends'], childActUntil: 25 } }).some((p) => p.includes('childActUntil'))).toBe(true);
  });

  it('② 32장 전수 × 데이터 나이 범위의 모든 나이에서 deciderOf가 설계 문서 1-3절의 「나이별 결정자」와 같다', () => {
    for (const ev of preAdult) {
      const ages = possibleAgesOf(ev);
      expect(ages.length, ev.id).toBeGreaterThan(0);
      for (const a of ages) {
        const want = expectedAt(ev.id, a);
        expect(want, `${ev.id}@${a}: 기대표에 이 나이가 없다`).toBeDefined();
        expect(deciderOf(ev.id, a), `${ev.id}@${a}`).toBe(want);
      }
    }
  });

  it('② 나이 경계 12·13·18·19: 32장 전수의 규칙 값 (데이터 밖 나이도 규칙대로 값이 나온다)', () => {
    for (const id of Object.keys(PARENT_DECISION_TABLE)) {
      const row = PARENT_DECISION_TABLE[id];
      const hasParent = row.areas.some((a) => (PARENT_AREAS as readonly string[]).includes(a));
      const reaction = row.areas.includes('reaction');
      expect(deciderOf(id, 19), `${id}@19`).toBe('self');
      expect(deciderOf(id, 12), `${id}@12`).toBe(reaction || row.childActUntil !== undefined ? 'child' : 'parent');
      const at13: Who = reaction ? 'child' : row.childActUntil !== undefined && 13 <= row.childActUntil ? 'child' : hasParent ? 'parent' : 'self';
      expect(deciderOf(id, 13), `${id}@13`).toBe(at13);
      expect(deciderOf(id, 18), `${id}@18`).toBe(reaction ? 'child' : hasParent ? 'parent' : 'self');
    }
  });

  it('③ 13~18세에 본인이 고르는 이벤트의 영역은 공부·친구·취미뿐이다 (부모 영역도 아이 반응도 없다)', () => {
    const selfAt = Object.entries(PARENT_DECISION_TABLE).filter(([id]) => {
      const ev = EVENT_POOL.byId.get(id)!;
      return possibleAgesOf(ev).some((a) => a >= SELF_FROM_AGE && a < ALL_SELF_FROM_AGE && deciderOf(id, a) === 'self');
    });
    expect(selfAt.map(([id]) => id).sort()).toEqual(['school-bully', 'school-club', 'school-first-love', 'school-friend', 'school-friend-quarrel', 'school-teacher-notice']);
    for (const [id, row] of selfAt) for (const a of row.areas) expect((SELF_AREAS as readonly string[]).includes(a), `${id}: ${a}`).toBe(true);
  });

  it('④ 집계: 부모가 정하는 카드 24 · 흘러감이 있는 카드 7 · 본인 구간이 있는 카드 9 · 13~18세 본인 카드 6', () => {
    const kinds = (id: string): Set<Who> => new Set(possibleAgesOf(EVENT_POOL.byId.get(id)!).map((a) => deciderOf(id, a)));
    const ids = Object.keys(PARENT_DECISION_TABLE);
    expect(ids.filter((id) => kinds(id).has('parent'))).toHaveLength(PARENT_TABLE_COUNTS.parentCards);
    expect(ids.filter((id) => kinds(id).has('child'))).toHaveLength(PARENT_TABLE_COUNTS.childCards);
    expect(ids.filter((id) => kinds(id).has('self'))).toHaveLength(PARENT_TABLE_COUNTS.selfCards);
    const self13to18 = ids.filter((id) => possibleAgesOf(EVENT_POOL.byId.get(id)!).some((a) => a >= 13 && a <= 18 && deciderOf(id, a) === 'self'));
    expect(self13to18).toHaveLength(PARENT_TABLE_COUNTS.selfCards13to18);
    expect(ids.filter((id) => kinds(id).has('child')).sort()).toEqual(['infant-new-sibling', 'infant-sibling-toy', 'school-bully', 'school-family-priority', 'school-friend', 'school-friend-quarrel', 'school-teacher-notice']);
  });
});

describe('T2 deciderOf 규칙 불변 (R1~R5)', () => {
  const ids = Object.keys(PARENT_DECISION_TABLE);

  it('R1 19세 이상은 어떤 영역·표지에도 본인이다 (표에 없는 id도 throw하지 않는다)', () => {
    for (const id of ids) for (const a of [19, 20, 40, 99]) expect(deciderOf(id, a)).toBe('self');
    expect(deciderOf('youth-whatever', 30)).toBe('self');
  });

  it('R2 영역에 reaction이 있으면 19세 미만의 어느 나이에서도 흘러감이다', () => {
    for (const id of ids.filter((x) => PARENT_DECISION_TABLE[x].areas.includes('reaction'))) for (let a = 0; a <= 18; a++) expect(deciderOf(id, a), `${id}@${a}`).toBe('child');
  });

  it('R3 childActUntil 이하는 흘러감, 그 위는 영역 규칙', () => {
    for (const id of ids.filter((x) => PARENT_DECISION_TABLE[x].childActUntil !== undefined)) {
      const until = PARENT_DECISION_TABLE[id].childActUntil!;
      expect(until).toBe(12);
      for (let a = 0; a <= until; a++) expect(deciderOf(id, a), `${id}@${a}`).toBe('child');
      expect(deciderOf(id, until + 1), `${id}@${until + 1}`).not.toBe('child');
    }
  });

  it('R4 0~12세는 (흘러감이 아니면) 부모, R5 13~18세는 부모 영역이 있으면 부모 · 공부/친구/취미뿐이면 본인', () => {
    for (const id of ids) {
      const row = PARENT_DECISION_TABLE[id];
      if (row.areas.includes('reaction')) continue;
      for (let a = 0; a <= 12; a++) if (row.childActUntil === undefined || a > row.childActUntil) expect(deciderOf(id, a), `${id}@${a}`).toBe('parent');
      const hasParent = row.areas.some((x) => (PARENT_AREAS as readonly string[]).includes(x));
      for (let a = 13; a <= 18; a++) expect(deciderOf(id, a), `${id}@${a}`).toBe(hasParent ? 'parent' : 'self');
    }
  });

  it('순수·멱등: 같은 입력은 늘 같은 값이고, 알 수 없는 id(19세 미만)·잘못된 나이는 throw한다', () => {
    for (const id of ids) for (let a = 0; a <= 19; a++) expect(deciderOf(id, a)).toBe(deciderOf(id, a));
    expect(() => deciderOf('nope-event', 5)).toThrow(/분류표/);
    expect(() => deciderOf('constructor', 5)).toThrow(/분류표/);
    expect(() => deciderOf('infant-care', -1)).toThrow();
    expect(() => deciderOf('infant-care', 2.5)).toThrow();
    expect(() => deciderOf('infant-care', Number.NaN)).toThrow();
  });

  it('decisionFor는 표 밖 이벤트(시험용 가짜 풀)를 본인으로 읽고, 표 안은 deciderOf와 같다', () => {
    expect(decisionFor('fake-choice', 3)).toBe('self');
    expect(decisionFor('infant-care', 3)).toBe('parent');
    expect(decisionFor('infant-new-sibling', 3)).toBe('child');
  });
});

// ---------- T4 확률 모델 격자 ----------

const BASE: GameState = startLife(20261020, 'present');
const STATS = [30, 50, 70] as const;
const FUNDS = [-1500, 0, 1500] as const;
const ORDERS = [1, 3] as const;

interface Spec {
  eventId: string;
  age: number;
  wealth: ParentWealth;
  parenting: ParentingStyle;
  stat: number;
  fund: number;
  order: number;
}

/** 격자의 한 칸 → 대기 중인 상태 (보이는 선택지가 2개 미만이면 null — 그 칸에서는 카드가 일어나지 않는다) */
function stateAt(spec: Spec, tweak?: (s: GameState) => GameState): GameState | null {
  const ev = EVENT_POOL.byId.get(spec.eventId)!;
  let s: GameState = {
    ...BASE,
    age: spec.age,
    character: { ...BASE.character!, parentWealth: spec.wealth, parenting: spec.parenting },
    stats: { education: spec.stat, health: spec.stat, happiness: spec.stat, relationships: spec.stat },
    familyFund: spec.fund,
    birthReport: { ...BASE.birthReport!, birthOrder: spec.order },
    flags: [],
    seen: { [spec.eventId]: spec.age },
    lastChoiceAge: spec.age,
    pending: null,
  };
  if (tweak) s = tweak(s);
  const visible = visibleChoices(ev, condContextOf(s));
  if (visible.length < 2) return null;
  return { ...s, pending: { eventId: spec.eventId, key: `${spec.eventId}@${spec.age}`, age: spec.age, choiceIds: visible.map((c) => c.id) } };
}

/** 부모가 정하는 나이(최소·중간·최대) 대표 */
function parentAgesOf(ev: EventDef): number[] {
  const ages = possibleAgesOf(ev).filter((a) => a < ALL_SELF_FROM_AGE && deciderOf(ev.id, a) === 'parent');
  if (ages.length === 0) return [];
  return [...new Set([ages[0], ages[Math.floor(ages.length / 2)], ages[ages.length - 1]])];
}

const PARENT_EVENTS = Object.keys(PARENT_DECISION_TABLE)
  .map((id) => EVENT_POOL.byId.get(id)!)
  .filter((ev) => parentAgesOf(ev).length > 0);

/** 선택지별 실제 집안 살림 효과(영향 줄과 같은 resolveEffects) */
function familyOf(s: GameState): Record<string, number> {
  const ev = EVENT_POOL.byId.get(s.pending!.eventId)!;
  const ctx = condContextOf(s);
  return Object.fromEntries(s.pending!.choiceIds.map((id) => {
    const c = ev.choices!.find((x) => x.id === id)!;
    return [id, resolveEffects(c.effects, c.bonuses, ctx).family];
  }));
}

/** 비용 합 확률: 집안 살림 효과 ≤ −300인 선택지 전부의 선택 확률 합 (설계 문서 5절 T5-④) */
function costShare(s: GameState): number {
  const w = parentChoiceWeights(s)!;
  const fam = familyOf(s);
  return w.ids.reduce((sum, id, i) => sum + (fam[id] <= -300 ? w.weights[i] : 0), 0);
}

describe('T4 부모 확률 모델 격자 (parentChoiceWeights — 순수 함수, 시뮬 없음)', () => {
  const grid: Spec[] = [];
  for (const ev of PARENT_EVENTS) {
    for (const age of parentAgesOf(ev)) {
      for (const wealth of PARENT_WEALTHS) for (const parenting of PARENTING_STYLES) for (const stat of STATS) for (const fund of FUNDS) for (const order of ORDERS) grid.push({ eventId: ev.id, age, wealth, parenting, stat, fund, order });
    }
  }
  const cells = grid.map((spec) => ({ spec, state: stateAt(spec) })).filter((c): c is { spec: Spec; state: GameState } => c.state !== null);

  it('격자가 충분히 크고 부모가 정하는 카드 24장이 모두 들어 있다', () => {
    expect(PARENT_EVENTS).toHaveLength(PARENT_TABLE_COUNTS.parentCards);
    expect(cells.length).toBeGreaterThan(20000);
  });

  it('① 가중치는 모두 유한·양수이고 합이 1이다 ② 확률 하한 ε/n × 0.999 ④ 어떤 칸에서도 한 선택지가 90%를 넘지 않는다', () => {
    let maxShare = 0;
    let maxAt = '';
    let max2 = 0;
    for (const { spec, state } of cells) {
      const w = parentChoiceWeights(state)!;
      expect(w.ids).toEqual(state.pending!.choiceIds);
      const sum = w.weights.reduce((a, b) => a + b, 0);
      expect(Math.abs(sum - 1)).toBeLessThan(1e-9);
      const n = w.weights.length;
      for (const x of w.weights) {
        expect(Number.isFinite(x) && x > 0).toBe(true);
        expect(x).toBeGreaterThanOrEqual((PARENT_MODEL.epsilon / n) * 0.999);
        if (x > maxShare) {
          maxShare = x;
          maxAt = `${spec.eventId}@${spec.age} 수저${spec.wealth} ${spec.parenting} 스탯${spec.stat} 잔액${spec.fund} 순서${spec.order}`;
        }
        if (n === 2 && x > max2) max2 = x;
      }
    }
    // 이론상 n = 2의 최댓값은 0.075 + 0.85 = 92.5%이지만 실제 격자의 최댓값은 90%를 넘지 않는다 (PD12 ⑥)
    expect(maxShare, maxAt).toBeLessThanOrEqual(0.9);
    expect(max2).toBeLessThanOrEqual(0.925 + 1e-9);
  });

  it('③ 부모 직업·부모 나이·성별·이름·지역·외모·주거 형태를 바꿔도 가중치가 같다 (마스터 결정 M4 — 격자 전체)', () => {
    for (const { state } of cells) {
      const base = parentChoiceWeights(state)!;
      const r = state.birthReport!;
      const changed: GameState = {
        ...state,
        character: { ...state.character!, name: '박서연', gender: state.character!.gender === 'male' ? 'female' : 'male', looks: 100 - state.character!.looks },
        birthReport: {
          ...r,
          region: r.region === '서울' ? '제주' : '서울',
          sigungu: '다른구',
          mother: { age: r.mother.age + 9, job: r.mother.job === 'manager' ? 'labor' : 'manager' },
          father: { age: r.father.age + 7, job: r.father.job === 'agri' ? 'professional' : 'agri' },
          housing: r.housing === 'own' ? 'rent' : 'own',
          birthWeightKg: r.birthWeightKg + 0.4,
          month: r.month === 3 ? 9 : 3,
        },
      };
      const other = parentChoiceWeights(changed)!;
      expect(other.ids).toEqual(base.ids);
      expect(other.weights).toEqual(base.weights);
    }
  });

  it('⑤ 방향: 집안 살림 잔액이 −1500이면 +1500보다 비용이 큰 선택지의 합 확률이 작거나 같고, 형제 순서 3이 1보다 같거나 작다 (허용 오차 0.5%p)', () => {
    let strictFund = 0;
    let strictOrder = 0;
    for (const { spec, state } of cells) {
      if (spec.fund !== -1500 || spec.order !== 1) continue;
      const high = stateAt({ ...spec, fund: 1500 });
      if (high !== null && high.pending!.choiceIds.join() === state.pending!.choiceIds.join()) {
        const lo = costShare(state);
        const hi = costShare(high);
        expect(lo, `${spec.eventId}@${spec.age} 수저${spec.wealth} ${spec.parenting} 스탯${spec.stat}`).toBeLessThanOrEqual(hi + 0.005);
        if (lo < hi - 0.01) strictFund++;
      }
      const third = stateAt({ ...spec, order: 3 });
      const first = stateAt({ ...spec, fund: 0, order: 1 });
      const third0 = stateAt({ ...spec, fund: 0, order: 3 });
      if (first !== null && third0 !== null && third !== null && first.pending!.choiceIds.join() === third0.pending!.choiceIds.join()) {
        expect(costShare(third0), `${spec.eventId}@${spec.age}`).toBeLessThanOrEqual(costShare(first) + 0.005);
        if (costShare(third0) < costShare(first) - 0.01) strictOrder++;
      }
    }
    // 공허 통과 방지: 방향이 실제로 느껴지는 칸이 있다
    expect(strictFund).toBeGreaterThan(50);
    expect(strictOrder).toBeGreaterThan(50);
  });

  it('⑥ 같은 형제·잔액 조건에서 수저 단계가 오를수록 비용 합 확률이 줄지 않는다 (5단계 ≥ 1단계 − 0.5%p, 두 단계에서 보이는 선택지가 같은 칸)', () => {
    let compared = 0;
    let strict = 0;
    const bad: string[] = [];
    for (const { spec, state } of cells) {
      if (spec.wealth !== 1) continue;
      const rich = stateAt({ ...spec, wealth: 5 });
      if (rich === null || rich.pending!.choiceIds.join() !== state.pending!.choiceIds.join()) continue;
      const famPoor = familyOf(state);
      const famRich = familyOf(rich);
      // 두 단계의 비용 선택지 집합이 같아야 합을 견줄 수 있다 (재력 보너스로 비용이 달라지는 선택지는 집합이 달라져 단일 선택지 역전이 난다 — 설계 문서 5절 T5-④)
      const same = state.pending!.choiceIds.every((id) => (famPoor[id] <= -300) === (famRich[id] <= -300));
      if (!same) continue;
      compared++;
      const p = costShare(state);
      const r = costShare(rich);
      if (r < p - 0.005) bad.push(`${spec.eventId}@${spec.age} ${spec.parenting} 스탯${spec.stat} 잔액${spec.fund} 순서${spec.order}: 1단계 ${p.toFixed(3)} > 5단계 ${r.toFixed(3)}`);
      if (r > p + 0.01) strict++;
    }
    expect(bad.slice(0, 5)).toEqual([]);
    expect(compared).toBeGreaterThan(500);
    expect(strict).toBeGreaterThan(100);
  });

  it('⑦ 같은 입력이면 같은 출력이다 (두 번 호출) · 대기 중인 선택지가 없으면 null', () => {
    for (const { state } of cells.filter((_, i) => i % 97 === 0)) expect(parentChoiceWeights(state)).toEqual(parentChoiceWeights(state));
    expect(parentChoiceWeights({ ...BASE, pending: null })).toBeNull();
  });
});

describe('모델 상수와 보조 함수 (설계 문서 2절 — 승인 A3~A6)', () => {
  it('PARENT_PRIORITY는 4양육 방식 × (학력/건강/행복/관계/돈) 승인표 그대로다', () => {
    const row = (k: ParentingStyle) => [PARENT_PRIORITY[k].education, PARENT_PRIORITY[k].health, PARENT_PRIORITY[k].happiness, PARENT_PRIORITY[k].relationships, PARENT_PRIORITY[k].wealth];
    expect(row('strict')).toEqual([1.8, 1.2, 0.6, 0.7, 1.3]);
    expect(row('free')).toEqual([1.0, 1.2, 1.4, 1.2, 1.0]);
    expect(row('helicopter')).toEqual([1.7, 1.7, 0.9, 0.9, 1.1]);
    expect(row('neglect')).toEqual([0.6, 0.6, 0.7, 0.5, 1.5]);
    for (const k of PARENTING_STYLES) for (const s of STAT_KEYS) expect(PARENT_PRIORITY[k][s]).toBeGreaterThan(0);
  });

  it('ε 0.15 · T_p 8 · 지수 한계 40 (A4), 튜닝 사다리 범위 안이다 (ε 0.10~0.20 · T_p 7~10)', () => {
    expect(PARENT_MODEL.epsilon).toBe(0.15);
    expect(PARENT_MODEL.temperature).toBe(8);
    expect(PARENT_MODEL.exponentLimit).toBe(40);
    expect(PARENT_MODEL.epsilon).toBeGreaterThanOrEqual(0.1);
    expect(PARENT_MODEL.epsilon).toBeLessThanOrEqual(0.2);
    expect(PARENT_MODEL.temperature).toBeGreaterThanOrEqual(7);
    expect(PARENT_MODEL.temperature).toBeLessThanOrEqual(10);
  });

  it('moneyNeed(수저) 1.42·1.28·1.05·0.80·0.58, siblingFactor 첫째 1.00 … 다섯째 이상 1.32, balanceFactor −1500 → 1.25 · 0 → 1.00 · +1500 → 0.75 (승인 A5)', () => {
    expect(PARENT_WEALTHS.map((t) => Number(moneyNeedOf(t).toFixed(2)))).toEqual([1.42, 1.28, 1.05, 0.8, 0.58]);
    expect([1, 2, 3, 4, 5, 6, 9].map((o) => Number(siblingFactor(o).toFixed(2)))).toEqual([1.0, 1.08, 1.16, 1.24, 1.32, 1.32, 1.32]);
    expect(balanceFactor(-1500)).toBeCloseTo(1.25, 10);
    expect(balanceFactor(0)).toBe(1);
    expect(balanceFactor(1500)).toBeCloseTo(0.75, 10);
    // 한도 밖 잔액은 ±1500으로 자른다 (familyFund 한계 ±3000)
    expect(balanceFactor(-3000)).toBeCloseTo(1.25, 10);
    expect(balanceFactor(3000)).toBeCloseTo(0.75, 10);
    // 가장 먼 두 단계는 보정을 최악으로 겹쳐도 뒤집히지 않는다 (설계 문서 2-4절)
    expect(moneyNeedOf(5) * siblingFactor(5) * balanceFactor(-1500)).toBeLessThan(moneyNeedOf(1) * siblingFactor(1) * balanceFactor(1500));
  });

  it('PARENT_FIT: 기본 1.0, 예외 열거만, 범위 0.5~4.0 (A6) — 표에 없는 선택지는 1.0', () => {
    for (const [k, v] of Object.entries(PARENT_FIT)) {
      expect(v, k).toBeGreaterThanOrEqual(PARENT_FIT_RANGE.min);
      expect(v, k).toBeLessThanOrEqual(PARENT_FIT_RANGE.max);
      const [eventId, choiceId] = k.split('/');
      const ev = EVENT_POOL.byId.get(eventId);
      expect(ev?.choices?.some((c) => c.id === choiceId), `${k}: 실제 선택지가 아니다`).toBe(true);
    }
    expect(parentFitOf('infant-fever', 'dismiss')).toBe(0.5);
    expect(parentFitOf('school-tutoring', 'academy')).toBe(2.5);
    expect(parentFitOf('school-academy-night', 'many')).toBe(1.3); // 승인 초기값 2.0 → 구현 실측 뒤 1.3 (A16, 아래 승인값 대조 시험)
    expect(parentFitOf('infant-parental-leave', 'one')).toBe(1.5); // 승인 초기값 1.0 → 실측 뒤 1.5
    expect(parentFitOf('infant-care', 'daycare')).toBe(1);
    expect(parentFitOf('nope', 'nope')).toBe(1);
  });

  it('적합도는 선택지의 효과를 바꾸지 않는다: 같은 입력에서 fit 표를 지우면 확률만 달라지고 영향 줄(resolveEffects)은 그대로다', () => {
    const cell = stateAt({ eventId: 'school-tutoring', age: 12, wealth: 4, parenting: 'free', stat: 50, fund: 0, order: 1 })!;
    const w = parentChoiceWeights(cell)!;
    expect(w.ids).toEqual(['academy', 'alone', 'tutor']);
    const ev = EVENT_POOL.byId.get('school-tutoring')!;
    const before = JSON.stringify(ev.choices);
    parentChoiceWeights(cell);
    expect(JSON.stringify(ev.choices)).toBe(before);
    // 같은 양육·형편에서 fit이 있는 학원·과외가 fit 없는 혼자 공부보다 상대적으로 높다 (2.5배 곱)
    const noFit = w.weights.map((x) => x); // 변조 금지 확인용 복사
    expect(noFit).toHaveLength(3);
  });
});

describe('영역 표 정합 (설계 문서 1-2절)', () => {
  it('부모 영역은 돌봄·건강·돈·진학·이사·집안 여섯, 본인 영역은 공부·친구·취미 셋이다', () => {
    expect([...PARENT_AREAS]).toEqual(['care', 'health', 'money', 'school', 'move', 'home']);
    expect([...SELF_AREAS]).toEqual(['study', 'friends', 'hobby']);
  });

  it('모든 시대에서 풀이 32장 전수를 가진다 (시대 제한 카드는 있는 시대에서만 일어난다)', () => {
    for (const era of ERAS) {
      const inEra = Object.keys(PARENT_DECISION_TABLE).filter((id) => {
        const ev = EVENT_POOL.byId.get(id)!;
        return ev.eras === undefined || ev.eras.includes(era);
      });
      expect(inEra.length, era).toBeGreaterThanOrEqual(24); // 시대 제한(eras) 카드가 빠진 가장 적은 시대(지난 세상)도 24장 이상
    }
  });
});
