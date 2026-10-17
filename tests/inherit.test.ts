import { describe, expect, it } from 'vitest';
import inheritSrc from '../src/core/inherit.ts?raw';
import { ECONOMY } from '../src/data/economyTable';
import { EVENT_POOL } from '../src/data/events';
import type { EventDef } from '../src/core';
import { INHERIT_NOTE_TEXT } from '../src/data/lifeTable';
import {
  advanceYear,
  familyOf,
  inheritanceAmount,
  inheritanceDue,
  incomeOf,
  economyContextOf,
  parseGame,
  serializeGame,
  parentsAllGone,
  previewChoice,
  resolveChoiceStep,
  siblingCountOf,
  stepYear,
  type GameState,
  type ParentWealth,
} from '../src/core';
import { startLife } from '../scripts/simulateLib';

/**
 * 간이 상속 (SPEC-003 M5, 마스터 결정 D10 변경 — docs/data/economy-model.md 15-4절, 위치는 r3 15-6절): 부모가 모두 세상을 떠난 해(가족 상태가 처음 「gone」이 되는 해)의 **해 끝 규칙**으로 한 번
 * INHERIT[재력 단계] ÷ (형제 수 + 1)을 순자산에 더하고, 0보다 크면 인생 기록에 한 줄을 남긴다. 선택의 효과가 아니다 — 선택 적용(applyResolved)과 영향 표기(previewChoice)에는 들어가지 않는다.
 * 원인이 사건(parents_gone)이든 나이 상한이든 같은 경로(life.ts#finishYear)다.
 */

const FAREWELL = 'middle-parents-farewell';
const NOTE = '부모님이 남기신 재산을 물려받았습니다.';

/** 어머니 30세·아버지 33세에 태어난 중년 상태(재력 단계·형제 순서·나이·플래그를 고른다) */
function stateOf(over: { tier?: ParentWealth; age?: number; flags?: string[]; birthOrder?: number; motherAge?: number; fatherAge?: number; net?: number; assets?: 'none' } = {}): GameState {
  const base = startLife(11, 'present');
  const age = over.age ?? 55;
  const s: GameState = {
    ...base,
    age,
    flags: [...(over.flags ?? [])].sort(),
    character: { ...base.character!, parentWealth: over.tier ?? 5 },
    birthReport: {
      ...base.birthReport!,
      mother: { ...base.birthReport!.mother, age: over.motherAge ?? 30 },
      father: { ...base.birthReport!.father, age: over.fatherAge ?? 33 },
      birthOrder: over.birthOrder ?? 1,
    },
    seen: {},
    pending: null,
    assets: null,
    familyFund: 0,
  };
  if (over.assets === 'none') return s;
  const net = over.net ?? 20000;
  return { ...s, assets: { net, income: incomeOf(economyContextOf(s), 0), debt: Math.max(0, -net), incomeAdj: 0, dwelling: 'own' } };
}

const withPending = (s: GameState, eventId: string): GameState => {
  const ev = EVENT_POOL.byId.get(eventId)!;
  return { ...s, pending: { eventId, key: `${eventId}@${s.age}`, age: s.age, choiceIds: ev.choices!.map((c) => c.id) } };
};

describe('core 순수성: 상속 계산에 React·타이머·Date·Math.random이 없다', () => {
  it('core/inherit.ts (주석 제외)', () => {
    const src = inheritSrc.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    for (const bad of ['react', 'setTimeout', 'setInterval', 'Date', 'Math.random', 'createRng', 'rng.']) expect(src, bad).not.toContain(bad);
  });
});

describe('상속액 표 (설계값, EC7 조정): INHERIT[재력 단계] ÷ (형제 수 + 1)', () => {
  it('표는 5단계 오름차순이고 1단계는 0이다 — 부유한 집일수록 더 물려받는다', () => {
    expect(ECONOMY.inherit).toHaveLength(5);
    expect(ECONOMY.inherit[0]).toBe(0);
    for (let i = 1; i < 5; i++) expect(ECONOMY.inherit[i], `${i + 1}단계`).toBeGreaterThan(ECONOMY.inherit[i - 1]);
  });

  it('inheritanceAmount: 형제 수로 나누고 반올림한다', () => {
    expect(inheritanceAmount(1, 0)).toBe(0);
    expect(inheritanceAmount(5, 0)).toBe(ECONOMY.inherit[4]);
    expect(inheritanceAmount(5, 1)).toBe(Math.round(ECONOMY.inherit[4] / 2));
    expect(inheritanceAmount(4, 2)).toBe(Math.round(ECONOMY.inherit[3] / 3));
    expect(inheritanceAmount(2, 2)).toBe(Math.round(ECONOMY.inherit[1] / 3));
    expect(Number.isInteger(inheritanceAmount(2, 2))).toBe(true);
  });
});

describe('부모가 모두 떠났는가 (parentsAllGone): core/family.ts#parentStateOf와 같은 판정', () => {
  it('사별 플래그(parents_gone)가 켜지면 둘 다 떠난 것이다', () => {
    expect(parentsAllGone(stateOf({ age: 55 }))).toBe(false);
    expect(parentsAllGone(stateOf({ age: 55, flags: ['parents_gone'] }))).toBe(true);
  });

  it('나이 상한(100세 초과)은 어머니와 아버지 둘 다 넘어야 한다 — 한쪽만 넘으면 아직이다', () => {
    // 어머니 30·아버지 33세에 태어남: 아이 68세에 아버지 101세(어머니 98세), 아이 71세에 어머니 101세
    expect(parentsAllGone(stateOf({ age: 67 }))).toBe(false);
    expect(parentsAllGone(stateOf({ age: 68 }))).toBe(false); // 아버지만 101세
    expect(parentsAllGone(stateOf({ age: 70 }))).toBe(false); // 어머니 100세는 아직 아니다(100 초과여야 한다)
    expect(parentsAllGone(stateOf({ age: 71 }))).toBe(true);
    // 둘의 판정이 familyOf와 같다
    for (const age of [60, 68, 70, 71, 75]) {
      const s = stateOf({ age });
      const fam = familyOf(s);
      expect(parentsAllGone(s), `${age}세`).toBe(fam.mother.state === 'gone' && fam.father.state === 'gone');
    }
  });

  it('출생 정보가 없으면(birthReport null) 떠난 것으로 보지 않는다', () => {
    expect(parentsAllGone({ ...stateOf(), birthReport: null })).toBe(false);
  });
});

describe('inheritanceDue: 가족 상태가 처음 「gone」이 되는 전환에서만, 자산이 있고 상속액이 0보다 클 때만', () => {
  it('사별 플래그가 켜지는 전환: 재력 5단계·형제 없음이면 INHERIT[5]를 받는다', () => {
    const before = stateOf({ tier: 5 });
    const after = { ...before, flags: ['parents_gone'] };
    expect(inheritanceDue(before, after)).toBe(ECONOMY.inherit[4]);
  });

  it('이미 떠난 뒤의 전환은 0이다 (한 번만)', () => {
    const before = stateOf({ flags: ['parents_gone'] });
    expect(inheritanceDue(before, { ...before, age: before.age + 1 })).toBe(0);
    const aged = stateOf({ age: 72 });
    expect(inheritanceDue(aged, { ...aged, age: 73 })).toBe(0);
  });

  it('나이 상한 전환: 어머니·아버지가 모두 100세를 넘기는 해(아이 71세)에 받는다', () => {
    const before = stateOf({ age: 70, tier: 4 });
    expect(inheritanceDue(before, { ...before, age: 71 })).toBe(inheritanceAmount(4, siblingCountOf(before)));
    const early = stateOf({ age: 69, tier: 4 });
    expect(inheritanceDue(early, { ...early, age: 70 })).toBe(0);
  });

  it('재력 1단계는 상속이 0이다 · 20세 미만(자산 없음)은 0이다', () => {
    const before = stateOf({ tier: 1 });
    expect(inheritanceDue(before, { ...before, flags: ['parents_gone'] })).toBe(0);
    const noAssets = stateOf({ assets: 'none' });
    expect(inheritanceDue(noAssets, { ...noAssets, flags: ['parents_gone'] })).toBe(0);
  });

  it('형제가 많을수록 나눠 받는다: 둘째(위 형제 1명)는 절반, 셋째는 3분의 1 (출생신고의 형제 순서, 어머니 나이가 형제 수를 받쳐 줄 때)', () => {
    const first = stateOf({ tier: 5, birthOrder: 1 });
    const second = stateOf({ tier: 5, birthOrder: 2, motherAge: 34 });
    const third = stateOf({ tier: 5, birthOrder: 3, motherAge: 38 });
    expect(siblingCountOf(first)).toBe(0);
    expect(siblingCountOf(second)).toBe(1);
    expect(siblingCountOf(third)).toBe(2);
    const due = (s: GameState) => inheritanceDue(s, { ...s, flags: ['parents_gone'] });
    expect(due(first)).toBe(ECONOMY.inherit[4]);
    expect(due(second)).toBe(Math.round(ECONOMY.inherit[4] / 2));
    expect(due(third)).toBe(Math.round(ECONOMY.inherit[4] / 3));
    // 형제 수는 familyOf가 보이는 형제 수와 같다
    expect(siblingCountOf(third)).toBe(familyOf(third).siblings.length);
  });

  it('동생이 생긴 첫째도 형제로 센다 (infant-new-sibling을 본 첫째)', () => {
    const s = { ...stateOf({ tier: 5, birthOrder: 1 }), seen: { 'infant-new-sibling': 3 } };
    expect(siblingCountOf(s)).toBe(1);
  });
});

/** 상속 표를 잠깐 바꿔 보고 되돌린다(시험 전용 — 같은 입력에서 상속이 있는 쪽과 없는 쪽의 차이가 곧 상속액이다. 상속은 난수를 쓰지 않아 두 쪽의 사건·난수 흐름이 같다) */
function withInherit<T>(table: number[], fn: () => T): T {
  const saved = ECONOMY.inherit.slice();
  try {
    (ECONOMY as unknown as { inherit: number[] }).inherit = table;
    return fn();
  } finally {
    (ECONOMY as unknown as { inherit: number[] }).inherit = saved;
  }
}
const NO_INHERIT = [0, 0, 0, 0, 0];

describe('사별 선택지 (r3): 영향 표기에는 상속이 없고, 상속은 그 해 끝에 한 번 더해진다', () => {
  const ev = EVENT_POOL.byId.get(FAREWELL)!;
  const farewellOf = (over: Parameters<typeof stateOf>[0]) => withPending(stateOf(over), FAREWELL);

  it('세 선택지 모두 parents_gone을 켠다 (선택과 무관하게 부모가 모두 떠난다)', () => {
    for (const c of ev.choices!) expect(c.effects?.setFlags, c.id).toContain('parents_gone');
  });

  it('전수: 이벤트 안에서 parents_gone을 켜는 선택지와 켜지 않는 선택지가 섞인 이벤트는 없다 — 켜는 이벤트는 사별 이벤트 하나뿐이고 그 세 선택지가 모두 켠다 (조건부 보너스·서술 이벤트 효과 포함)', () => {
    const sets = (e: { setFlags?: readonly string[] } | undefined): boolean => (e?.setFlags ?? []).includes('parents_gone');
    const mixed: string[] = [];
    const setters: string[] = [];
    for (const e of EVENT_POOL.events as readonly EventDef[]) {
      const choices = e.choices ?? [];
      const flags = choices.map((c) => sets(c.effects) || (c.bonuses ?? []).some((b) => sets(b.effects)));
      if (sets(e.effects) || flags.some(Boolean)) setters.push(e.id);
      if (flags.some(Boolean) && !flags.every(Boolean)) mixed.push(e.id);
      for (const c of choices) for (const b of c.bonuses ?? []) if (sets(b.effects)) mixed.push(`${e.id}/${c.id}: 조건부로 켠다`);
    }
    expect(mixed).toEqual([]);
    expect(setters).toEqual([FAREWELL]);
  });

  it('(a) previewChoice: 작별 장면의 영향 표기에 상속이 없다 — 재력 1·3·5단계가 같은 값(명시 비용뿐)이고 상속 표를 0으로 바꿔도 같다: stay -600·share -1,200은 자산 ▼, late는 순자산 변화가 없어 자산 항목이 없다', () => {
    for (const tier of [1, 3, 5] as const) {
      const s = farewellOf({ tier, net: 20000 });
      for (const c of ev.choices!) {
        const impact = previewChoice(s, c);
        const explicit = c.effects?.assets?.net ?? 0;
        expect(impact.detail.dNet, `${tier}단계 ${c.id}`).toBe(explicit);
        const item = impact.items.find((i) => i.key === 'assets');
        if (explicit < 0) expect(item, `${tier}단계 ${c.id}`).toMatchObject({ direction: 'down' });
        else expect(item, `${tier}단계 ${c.id}`).toBeUndefined();
        expect(impact, `${tier}단계 ${c.id}: 상속 표와 무관`).toEqual(withInherit(NO_INHERIT, () => previewChoice(s, c)));
      }
    }
  });

  it('(b) 그 해 끝에 상속이 한 번만 더해진다(형제 수로 나눔): 고른 해의 순자산이 상속 표를 0으로 한 판보다 정확히 상속액만큼 크고, 연표에는 선택 기록 바로 뒤에 한 줄(금액·제목 없음)이 남는다', () => {
    const s = farewellOf({ tier: 5, net: 20000 });
    const out = resolveChoiceStep(s, s.pending!.key, 'stay').state;
    const without = withInherit(NO_INHERIT, () => resolveChoiceStep(s, s.pending!.key, 'stay').state);
    expect(out.flags).toContain('parents_gone');
    expect(out.assets!.net - without.assets!.net).toBe(ECONOMY.inherit[4]);
    expect(out.assets!.debt).toBe(without.assets!.debt);
    // 연표: 한 줄, 선택 기록 바로 뒤, 작별과 같은 나이
    const choice = ev.choices!.find((c) => c.id === 'stay')!;
    expect(NOTE).toBe(INHERIT_NOTE_TEXT);
    expect(out.history.filter((h) => h.text === NOTE)).toHaveLength(1);
    const i = out.history.findIndex((h) => h.text === NOTE);
    expect(out.history[i - 1]).toMatchObject({ kind: 'choice', eventId: FAREWELL, choice: choice.label });
    expect(out.history[i]).toMatchObject({ kind: 'event', age: s.age });
    expect(out.history[i].title).toBeUndefined();
    expect(/\d/.test(out.history[i].text)).toBe(false);
    expect(without.history.some((h) => h.text === NOTE)).toBe(false);
    // 형제 수 나눔: 둘째(위 형제 1명)는 절반, 셋째는 3분의 1
    for (const [birthOrder, motherAge, siblings] of [[2, 34, 1], [3, 38, 2]] as const) {
      const t = farewellOf({ tier: 5, net: 20000, birthOrder, motherAge });
      const a = resolveChoiceStep(t, t.pending!.key, 'late').state;
      const b = withInherit(NO_INHERIT, () => resolveChoiceStep(t, t.pending!.key, 'late').state);
      expect(a.assets!.net - b.assets!.net, `형제 ${siblings}명`).toBe(Math.round(ECONOMY.inherit[4] / (siblings + 1)));
    }
    // 재력 1단계는 상속이 0이라 연표 줄도 없다
    const poor = farewellOf({ tier: 1, net: 20000 });
    expect(resolveChoiceStep(poor, poor.pending!.key, 'stay').state.history.some((h) => h.text === NOTE)).toBe(false);
  });

  it('상속은 한 번뿐이다: 사별 이후 몇 해를 더 살아도 연표 줄이 늘지 않고 상속이 다시 들어가지 않는다 (나이 상한 전환 71세를 지나도)', () => {
    const s = farewellOf({ tier: 5, net: 20000 });
    let g = resolveChoiceStep(s, s.pending!.key, 'late').state;
    const lines = (st: GameState) => st.history.filter((h) => h.text === NOTE).length;
    expect(lines(g)).toBe(1);
    for (let i = 0; i < 20 && g.phase === 'life'; i++) {
      g = g.pending === null ? advanceYear(g) : resolveChoiceStep(g, g.pending.key, g.pending.choiceIds[0]).state;
      expect(lines(g), `${g.age}세`).toBe(1);
    }
  });
});

describe('(c) 원인이 달라도 같은 경로다: 사건(parents_gone)으로 떠나는 해와 나이 상한으로 떠나는 해에 더해지는 금액·연표·난수가 같다', () => {
  for (const [tier, birthOrder, motherAge] of [
    [5, 1, 30],
    [4, 2, 34],
    [3, 3, 38],
  ] as const) {
    it(`재력 ${tier}단계·${birthOrder}째: 사건 경로 = 나이 상한 경로 = inheritanceAmount(${tier}, ${birthOrder - 1})`, () => {
      const want = inheritanceAmount(tier, birthOrder - 1);
      expect(want).toBeGreaterThan(0);
      // 사건 경로: 중년 55세에 작별 선택
      const f = withPending(stateOf({ tier, birthOrder, motherAge, net: 30000 }), FAREWELL);
      const ev1 = resolveChoiceStep(f, f.pending!.key, 'late').state;
      const ev0 = withInherit(NO_INHERIT, () => resolveChoiceStep(f, f.pending!.key, 'late').state);
      expect(ev1.assets!.net - ev0.assets!.net).toBe(want);
      expect(ev1.rngState).toBe(ev0.rngState);
      // 나이 상한 경로: 어머니·아버지가 모두 100세를 넘기는 해(어머니 나이에 맞춰 아이 나이를 고른다)
      const limitAge = Math.max(101 - motherAge, 101 - 33) - 1; // 아이 limitAge → limitAge+1에 어머니·아버지(stateOf는 33세)가 모두 101세 이상
      const g = stateOf({ tier, birthOrder, motherAge, age: limitAge, net: 30000 });
      const lim1 = stepOnce(g);
      const lim0 = withInherit(NO_INHERIT, () => stepOnce(g));
      expect(lim1.phase).toBe('life');
      expect(lim1.assets!.net - lim0.assets!.net).toBe(want);
      expect(lim1.rngState).toBe(lim0.rngState);
      expect(lim1.history.filter((h) => h.text === NOTE)).toHaveLength(1);
      expect(lim0.history.filter((h) => h.text === NOTE)).toHaveLength(0);
      expect(ev1.history.filter((h) => h.text === NOTE)).toHaveLength(1);
    });
  }
});

describe('(d) 다시 불러온 저장에서 두 번 더해지지 않는다', () => {
  it('사별한 해의 저장을 직렬화 → 복원해 이어 살아도 순자산·연표가 그대로 이어 간 것과 같고 연표 줄은 한 줄뿐이다', () => {
    const s = withPending(stateOf({ tier: 5, net: 20000 }), FAREWELL);
    const after = resolveChoiceStep(s, s.pending!.key, 'late').state;
    const restored = parseGame(serializeGame(after));
    expect(restored, '저장 검증을 통과한다').not.toBeNull();
    expect(restored!.assets).toEqual(after.assets);
    expect(restored!.flags).toEqual(after.flags);
    expect(restored!.history).toEqual(after.history);
    let a: GameState = after;
    let b: GameState = restored!;
    const lines = (st: GameState) => st.history.filter((h) => h.text === NOTE).length;
    for (let i = 0; i < 15 && a.phase === 'life' && b.phase === 'life'; i++) {
      a = a.pending === null ? advanceYear(a) : resolveChoiceStep(a, a.pending.key, a.pending.choiceIds[0]).state;
      b = b.pending === null ? advanceYear(b) : resolveChoiceStep(b, b.pending.key, b.pending.choiceIds[0]).state;
      expect(b.assets, `${a.age}세`).toEqual(a.assets);
      expect(lines(b), `${b.age}세`).toBe(1);
    }
  });

  it('나이 상한으로 떠난 해의 저장도 복원해 이어 살면 다시 받지 않는다 (71세 이후)', () => {
    const g = stateOf({ tier: 5, age: 70, net: 30000 });
    const after = stepOnce(g);
    expect(after.phase).toBe('life');
    expect(after.pending).toBeNull();
    const restored = parseGame(serializeGame(after));
    expect(restored).not.toBeNull();
    const a = advanceYear(after);
    const b = advanceYear(restored!);
    expect(b.assets).toEqual(a.assets);
    expect(b.history.filter((h) => h.text === NOTE)).toHaveLength(1);
  });
});

describe('(e) 20세 전에 부모가 모두 떠난 판: 집안 살림(familyFund)에 더하지 않고 독립(20세) 때 순자산에 한 번 더한다', () => {
  // 지금 규칙으로는 사별 이벤트가 52세부터라 드물다 — 저장에 이미 사별 플래그가 있는 판(주입·옛 저장)을 다룬다
  const youngGone = (over: { age: number; flags?: string[] }) => ({ ...stateOf({ tier: 5, age: over.age, flags: over.flags ?? ['parents_gone'], assets: 'none' }), familyFund: 500 });

  it('독립 때(19 → 20세) 순자산에 한 번: 시작 자산(부모 지원 + 집안 살림 − 학자금 대출) + 상속, 집안 살림은 0으로 합쳐지고 상속이 더해지지 않은 채 남지 않는다', () => {
    const g = youngGone({ age: 19 });
    const a = stepOnce(g);
    const b = withInherit(NO_INHERIT, () => stepOnce(g));
    expect(a.phase).toBe('life');
    expect(a.age).toBe(20);
    expect(a.assets).not.toBeNull();
    expect(a.familyFund).toBe(0);
    expect(a.assets!.net - b.assets!.net, '독립 때 상속액').toBe(ECONOMY.inherit[4]);
    expect(a.history.filter((h) => h.text === NOTE)).toHaveLength(1);
    expect(a.history.find((h) => h.text === NOTE)).toMatchObject({ age: 20, kind: 'event' });
    expect(b.history.some((h) => h.text === NOTE)).toBe(false);
  });

  it('20세 전에는 상속이 더해지지 않는다: 부모가 이미 떠난 18세 → 19세 해에 집안 살림은 상속 표와 무관하고, 독립 뒤 해마다 규칙은 다시 주지 않는다(21세에도 차이는 상속액 하나)', () => {
    const g = youngGone({ age: 18 });
    const a18 = stepOnce(g);
    const b18 = withInherit(NO_INHERIT, () => stepOnce(g));
    expect(a18.phase).toBe('life');
    expect(a18.familyFund).toBe(b18.familyFund);
    expect(a18.assets).toBeNull();
    expect(a18.history.some((h) => h.text === NOTE)).toBe(false);
    const a20 = stepOnce(a18);
    const b20 = withInherit(NO_INHERIT, () => stepOnce(b18));
    expect(a20.phase).toBe('life');
    expect(a20.assets!.net - b20.assets!.net).toBe(ECONOMY.inherit[4]);
    const a21 = stepOnce(a20);
    const b21 = withInherit(NO_INHERIT, () => stepOnce(b20));
    expect(a21.phase).toBe('life');
    // 한 해 정산을 거쳐도 차이는 상속액 하나다(순자산이 양수라 한도·안전망 반응이 같다) — 두 번 더해지지 않았다
    expect(a21.assets!.net - b21.assets!.net).toBeGreaterThanOrEqual(ECONOMY.inherit[4] - 2000);
    expect(a21.assets!.net - b21.assets!.net).toBeLessThanOrEqual(ECONOMY.inherit[4] + 2000);
    expect(a21.history.filter((h) => h.text === NOTE)).toHaveLength(1);
  });

  it('부모가 떠나지 않은 판은 독립 때 상속이 없다', () => {
    const g = youngGone({ age: 19, flags: [] });
    const a = stepOnce(g);
    expect(a.phase).toBe('life');
    expect(a.history.some((h) => h.text === NOTE)).toBe(false);
  });
});

describe('나이 상한 전환의 상속 (해마다 규칙): 선택과 무관하게 부모가 모두 100세를 넘기는 해에 받는다', () => {
  it('아이 70세 → 71세(재력 5단계·형제 없음): 정산에 상속이 더해지고 71세 연표에 한 줄이 남는다', () => {
    const s = stateOf({ tier: 5, age: 70, net: 30000 });
    const saved = ECONOMY.inherit.slice();
    let zero: GameState;
    try {
      (ECONOMY as unknown as { inherit: number[] }).inherit = [0, 0, 0, 0, 0];
      zero = stepOnce(s);
    } finally {
      (ECONOMY as unknown as { inherit: number[] }).inherit = saved;
    }
    const withIt = stepOnce(s);
    expect(withIt.phase).toBe('life');
    expect(withIt.age).toBe(71);
    expect(withIt.assets!.net - zero.assets!.net).toBe(ECONOMY.inherit[4]);
    expect(withIt.history.filter((h) => h.text === NOTE)).toHaveLength(1);
    expect(withIt.history.find((h) => h.text === NOTE)).toMatchObject({ age: 71, kind: 'event' });
    expect(zero.history.some((h) => h.text === NOTE)).toBe(false);
    // 난수를 쓰지 않는다: 상속이 있든 없든 난수 상태가 같다
    expect(withIt.rngState).toBe(zero.rngState);
  });

  it('난수를 쓰지 않는다: 같은 상태에서 상속 표가 달라도 난수 수열(rngState)은 같다 · 같은 상태는 늘 같은 결과', () => {
    const s = stateOf({ tier: 5, age: 70 });
    expect(stepOnce(s)).toEqual(stepOnce(s));
  });
});

/** 선택지가 나오지 않게 선택 빈도를 비워 한 해를 진행한다(상속 전환만 보려는 시험용): 선택지가 걸리면 첫 선택지로 마친다 */
function stepOnce(s: GameState): GameState {
  const r = stepYear(s);
  if (r.state.pending === null) return r.state;
  return resolveChoiceStep(r.state, r.state.pending.key, r.state.pending.choiceIds[0]).state;
}
