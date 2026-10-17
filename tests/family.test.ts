import { describe, expect, it } from 'vitest';
import {
  FAMILY_ADULT_AGE,
  FAMILY_MAX_AGE,
  MAX_OLDER_SIBLINGS,
  MIN_FIRST_BIRTH_AGE,
  PARENT_AGED_FROM,
  SIBLING_GAP,
  YOUNGER_SIBLING_EVENT,
  autoResolveStep,
  familyOf,
  parentAgeAt,
  parentStateOf,
  spouseStateOf,
  stepYear,
  type GameState,
} from '../src/core';
import { CHILD_LABEL, PARENT_STATE_LABEL, SPOUSE_LABEL, siblingGapText, siblingLabel } from '../src/data/familyText';
import { startLife } from '../scripts/simulateLib';

/**
 * 식구 카드 (SPEC-003 DB13): 부모 나이는 해마다 오르고, 사별(parents_gone)은 표시에 반영되며, 형제자매·배우자·자녀는 저장된 상태에서 다시 계산한다.
 * 출생 때 정한 형제 순서·부모 나이·직업과 어긋나지 않는다(BR6·CM9).
 */

const base = (): GameState => startLife(7, 'present');
const withBirthOrder = (g: GameState, order: number): GameState => ({ ...g, birthReport: { ...g.birthReport!, birthOrder: order } });

describe('부모 (나이·직업·상태)', () => {
  it('나이 = 출생 때 나이 + 지금 나이 — 해마다 1씩 오른다 (BR6)', () => {
    const g = base();
    const report = g.birthReport!;
    for (const age of [0, 1, 17, 40, 63]) {
      const f = familyOf({ ...g, age });
      expect(f.mother.age, `어머니 ${age}세`).toBe(parentAgeAt(report.mother, age));
      expect(f.father.age, `아버지 ${age}세`).toBe(parentAgeAt(report.father, age));
      expect(f.mother.job).toBe(report.mother.job);
      expect(f.father.job).toBe(report.father.job);
    }
    expect(familyOf({ ...g, age: 11 }).mother.age - familyOf({ ...g, age: 10 }).mother.age).toBe(1);
  });

  it('상태: 사별(parents_gone) > 병환(cared_parents) > 고령(85세~) > 건강함. 사별은 두 부모에게 같이 반영된다', () => {
    expect(parentStateOf(60, [])).toBe('healthy');
    expect(parentStateOf(PARENT_AGED_FROM - 1, [])).toBe('healthy');
    expect(parentStateOf(PARENT_AGED_FROM, [])).toBe('aged');
    expect(parentStateOf(70, ['cared_parents'])).toBe('ill');
    expect(parentStateOf(90, ['cared_parents'])).toBe('ill');
    expect(parentStateOf(70, ['parents_gone', 'cared_parents'])).toBe('gone');
    expect(parentStateOf(40, ['parents_gone'])).toBe('gone');
    const g = { ...base(), age: 55, flags: ['parents_gone'] };
    const f = familyOf(g);
    expect(f.mother.state).toBe('gone');
    expect(f.father.state).toBe('gone');
  });

  it('가족 나이가 상한(100)을 넘으면 살아 있다고 보지 않는다 — 사별 사건이 없어도 113세 부모가 「건강함」으로 나오지 않는다', () => {
    expect(parentStateOf(FAMILY_MAX_AGE, [])).not.toBe('gone');
    expect(parentStateOf(FAMILY_MAX_AGE + 1, [])).toBe('gone');
    const g = { ...base(), age: 95 };
    const f = familyOf(g);
    for (const p of [f.mother, f.father]) if (p.age > FAMILY_MAX_AGE) expect(p.state).toBe('gone');
  });

  it('표시 라벨이 모든 상태에 있고, 사별 라벨은 「세상을 떠남」이다', () => {
    for (const s of ['healthy', 'ill', 'aged', 'gone'] as const) expect(PARENT_STATE_LABEL[s].length).toBeGreaterThan(1);
    expect(PARENT_STATE_LABEL.gone).toBe('세상을 떠남');
  });
});

describe('형제자매 (관계·나이 차)', () => {
  it('형제 순서가 N째이면 위로 N−1명(다섯째 이상은 4명)이 있고 첫째는 위 형제가 없다', () => {
    for (const [order, older] of [[1, 0], [2, 1], [3, 2], [4, 3], [5, MAX_OLDER_SIBLINGS]] as const) {
      const f = familyOf({ ...withBirthOrder(base(), order), age: 10 });
      expect(f.siblings.filter((s) => s.older), `${order}째`).toHaveLength(older);
    }
  });

  it('위 형제의 나이 차는 한 명당 2~5살씩 쌓이고(가까운 순), 나이 = 내 나이 + 나이 차다. 같은 시드는 같은 형제다', () => {
    const g = { ...withBirthOrder(base(), 4), age: 12 };
    const a = familyOf(g);
    const b = familyOf(g);
    expect(a).toEqual(b);
    let prev = 0;
    for (const s of a.siblings) {
      expect(s.older).toBe(true);
      expect(s.gap - prev, '한 명당 나이 차').toBeGreaterThanOrEqual(SIBLING_GAP.min);
      expect(s.gap - prev).toBeLessThanOrEqual(SIBLING_GAP.max);
      expect(s.age).toBe(12 + s.gap);
      prev = s.gap;
    }
    // 다른 또래 시드는 (대체로) 다른 형제다
    const others = new Set(Array.from({ length: 30 }, (_, i) => JSON.stringify(familyOf({ ...g, peerSeed: 1000 + i * 77 }).siblings.map((s) => [s.kind, s.gap]))));
    expect(others.size).toBeGreaterThan(5);
  });

  it('위 형제와의 누적 나이 차는 「어머니의 출생 때 나이 − 최소 첫 출산 나이」를 넘지 않는다 — 어머니가 만 24살에 낳은 아이의 위로 20살 차이 형제는 없다 (R-330, CM9)', () => {
    expect(MIN_FIRST_BIRTH_AGE).toBe(16);
    const withMother = (g: GameState, motherAge: number): GameState => ({ ...g, birthReport: { ...g.birthReport!, mother: { ...g.birthReport!.mother, age: motherAge } } });
    // 다섯째 이상(위로 4명): 최소 간격 2살씩이라도 8살 — 어머니 24세면 한도 8 안에 겨우 들어가고, 한도가 7 이하면 형제가 보이지 않는다
    const fifth = withBirthOrder(base(), 5);
    for (let motherAge = 16; motherAge <= 50; motherAge++) {
      for (let seed = 1; seed <= 60; seed++) {
        const f = familyOf({ ...withMother(fifth, motherAge), peerSeed: seed * 131, age: 3 });
        const older = f.siblings.filter((s) => s.older);
        const budget = motherAge - MIN_FIRST_BIRTH_AGE;
        const farthest = older.at(-1)?.gap ?? 0;
        expect(farthest, `어머니 ${motherAge}세 시드 ${seed}: 누적 ${farthest}살 > 한도 ${budget}살`).toBeLessThanOrEqual(budget);
        expect(older.length, `어머니 ${motherAge}세: 위 형제 수 ${older.length}`).toBeLessThanOrEqual(Math.min(MAX_OLDER_SIBLINGS, Math.floor(budget / SIBLING_GAP.min)));
        let prev = 0;
        for (const s of older) {
          expect(s.gap - prev, '줄여도 형제마다 최소 간격은 남는다').toBeGreaterThanOrEqual(SIBLING_GAP.min);
          expect(s.gap - prev).toBeLessThanOrEqual(SIBLING_GAP.max);
          prev = s.gap;
        }
      }
    }
  });

  it('한도가 넉넉하면 예전과 같다 (시드에서 뽑은 2~5살 그대로), 빠듯하면 한도에서 멈추고, 최소 간격으로도 못 들어가는 형제는 보이지 않는다 (R-330)', () => {
    const withMother = (g: GameState, motherAge: number): GameState => ({ ...g, birthReport: { ...g.birthReport!, mother: { ...g.birthReport!.mother, age: motherAge } } });
    const third = withBirthOrder(base(), 3); // 위로 2명
    const free = familyOf({ ...withMother(third, 40), age: 0 }).siblings.filter((s) => s.older); // 한도 24 — 2~5살씩 두 명은 늘 들어간다
    expect(free).toHaveLength(2);
    // 한도 안에서는 어머니 나이와 상관없이 같은 형제(시드에서 정한 나이 차)다
    expect(familyOf({ ...withMother(third, 50), age: 0 }).siblings.map((s) => [s.kind, s.gap])).toEqual(free.map((s) => [s.kind, s.gap]));
    // 한도 4(어머니 20세): 2명이 정확히 2+2로 들어간다
    expect(familyOf({ ...withMother(third, 20), age: 0 }).siblings.map((s) => s.gap)).toEqual([2, 4]);
    // 한도 3(어머니 19세): 최소 간격 2살로는 한 명만 들어간다
    expect(familyOf({ ...withMother(third, 19), age: 0 }).siblings.filter((s) => s.older)).toHaveLength(1);
    // 한도 1·0(어머니 17·16세): 아무도 없다
    for (const m of [16, 17]) expect(familyOf({ ...withMother(third, m), age: 0 }).siblings.filter((s) => s.older), `어머니 ${m}세`).toHaveLength(0);
  });

  it('실제 판 전수(세 시대 × 600판): 어떤 출생에서도 가장 위 형제와의 나이 차가 어머니의 첫 출산 한도 안이고, 인생 기록 첫 줄의 「N째입니다」와 식구 카드의 위 형제 수가 같다 — 줄여서 보이는 판이 0이다 (R-330 r3: 생성기가 순서에 맞는 어머니 나이만 만든다)', () => {
    let checked = 0;
    let clamped = 0;
    for (const era of ['past', 'present', 'future'] as const) {
      for (let seed = 1; seed <= 600; seed++) {
        const g = startLife(seed, era);
        const r = g.birthReport!;
        const older = familyOf({ ...g, age: 0 }).siblings.filter((s) => s.older);
        const farthest = older.at(-1)?.gap ?? 0;
        expect(farthest, `${era} ${seed}: 어머니 ${r.mother.age}세, 누적 ${farthest}살`).toBeLessThanOrEqual(r.mother.age - MIN_FIRST_BIRTH_AGE);
        if (older.length > 0) checked++;
        if (older.length < Math.min(MAX_OLDER_SIBLINGS, r.birthOrder - 1)) clamped++;
        // 인생 기록 첫 줄(출생신고 서술문)이 말하는 형제 순서 ⇔ 식구 카드의 위 형제 수 (구현의 표를 읽지 않고 따로 적은 낱말)
        const said = ['첫째', '둘째', '셋째', '넷째', '다섯째 이상'].findIndex((w) => g.history[0].text.includes(`${w}입니다.`)) + 1;
        expect(said, `${era} ${seed}: 서술문에 형제 순서가 없다 — ${g.history[0].text}`).toBeGreaterThan(0);
        expect(older.length, `${era} ${seed}: 서술문 ${said}째 ⇔ 위 형제 ${older.length}명`).toBe(Math.min(4, said - 1));
      }
    }
    expect(checked, '공허 통과 방지: 위 형제가 있는 판').toBeGreaterThan(400);
    // 생성기가 형제 순서에 맞는 어머니 나이만 만든다(R-330 r3) — 한도에 걸려 형제가 줄어 보이는 판은 0이다. (옛 저장 판의 방어는 위 두 시험이 맡는다)
    expect(clamped).toBe(0);
  });

  it('나이가 들어도 나이 차는 그대로이고 나이만 오른다 (해마다 1씩)', () => {
    const g = withBirthOrder(base(), 3);
    const x = familyOf({ ...g, age: 20 });
    const y = familyOf({ ...g, age: 21 });
    x.siblings.forEach((s, i) => {
      expect(y.siblings[i].gap).toBe(s.gap);
      expect(y.siblings[i].age).toBe(s.age + 1);
      expect(y.siblings[i].kind).toBe(s.kind);
    });
  });

  it('아래 동생은 「동생이 생겼다」(첫째에게만 일어나는 사건)를 겪은 뒤에만 있고, 나이 = 지금 나이 − 사건이 일어난 나이, 나이 차 = 사건이 일어난 나이다', () => {
    const first = withBirthOrder(base(), 1);
    expect(familyOf({ ...first, age: 5 }).siblings).toEqual([]);
    const f = familyOf({ ...first, age: 9, seen: { [YOUNGER_SIBLING_EVENT]: 3 } });
    expect(f.siblings).toHaveLength(1);
    expect(f.siblings[0]).toMatchObject({ older: false, age: 6, gap: 3, gone: false });
    expect(['youngerBrother', 'youngerSister']).toContain(f.siblings[0].kind);
    // 첫째가 아닌 판에는 그 사건이 있을 수 없고(BR6) 있더라도 아래 동생을 만들지 않는다
    expect(familyOf({ ...withBirthOrder(base(), 2), age: 9, seen: { [YOUNGER_SIBLING_EVENT]: 3 } }).siblings.filter((s) => !s.older)).toEqual([]);
  });

  it('실제 판: 「동생이 생겼다」가 일어난 판에는 동생이 있고 일어나지 않은 판에는 없다 (사건 ⇔ 표시 일치)', () => {
    let withSibling = 0;
    let without = 0;
    for (let seed = 1; seed <= 400 && withSibling < 3; seed++) {
      let g = startLife(seed, 'present');
      if (g.birthReport!.birthOrder !== 1) continue;
      for (let i = 0; i < 8 && g.phase === 'life'; i++) {
        const r = stepYear(g);
        g = r.state;
        if (g.pending) break; // 선택지가 뜨면 그 해에서 멈춘다(seen에는 이미 기록된다)
      }
      const f = familyOf(g);
      const happened = g.seen[YOUNGER_SIBLING_EVENT] !== undefined;
      expect(f.siblings.some((s) => !s.older), `seed ${seed}`).toBe(happened);
      if (happened) withSibling++;
      else without++;
    }
    expect(withSibling, '공허 통과 방지: 사건이 일어난 판').toBeGreaterThanOrEqual(1);
    expect(without, '공허 통과 방지: 일어나지 않은 판').toBeGreaterThanOrEqual(1);
  });

  it('형제자매 상한(100세)을 넘으면 「세상을 떠남」(gone)으로 본다', () => {
    const f = familyOf({ ...withBirthOrder(base(), 5), age: 90 });
    for (const s of f.siblings) expect(s.gone, `${s.age}세`).toBe(s.age > FAMILY_MAX_AGE);
    expect(f.siblings.some((s) => s.gone), '공허 통과 방지').toBe(true);
  });

  it('호칭은 주인공의 성별에 따른다: 남자 = 형·누나, 여자 = 오빠·언니, 아래 동생은 남동생·여동생', () => {
    expect([siblingLabel('male', 'olderBrother'), siblingLabel('male', 'olderSister')]).toEqual(['형', '누나']);
    expect([siblingLabel('female', 'olderBrother'), siblingLabel('female', 'olderSister')]).toEqual(['오빠', '언니']);
    for (const p of ['male', 'female'] as const) expect([siblingLabel(p, 'youngerBrother'), siblingLabel(p, 'youngerSister')]).toEqual(['남동생', '여동생']);
    expect(siblingGapText(3, true)).toBe('3세 위');
    expect(siblingGapText(3, false)).toBe('3세 아래');
  });
});

describe('배우자·자녀 (플래그와 표시가 일치)', () => {
  it('20세 전에는 두 줄을 두지 않는다(null), 20세부터 보인다', () => {
    const g = base();
    expect(familyOf({ ...g, age: FAMILY_ADULT_AGE - 1 }).spouse).toBeNull();
    expect(familyOf({ ...g, age: FAMILY_ADULT_AGE - 1 }).child).toBeNull();
    expect(familyOf({ ...g, age: FAMILY_ADULT_AGE }).spouse).toBe('none');
    expect(familyOf({ ...g, age: FAMILY_ADULT_AGE }).child).toBe('none');
  });

  it('배우자: 혼인(married) > 이혼(divorced) > 연인(has_partner) > 없음 — 이혼하면 혼인·연인 플래그가 꺼지므로 이혼이 남는다', () => {
    expect(spouseStateOf([])).toBe('none');
    expect(spouseStateOf(['has_partner'])).toBe('partner');
    expect(spouseStateOf(['has_partner', 'married'])).toBe('married');
    expect(spouseStateOf(['married'])).toBe('married');
    expect(spouseStateOf(['divorced', 'child_distant'])).toBe('divorced');
    expect(spouseStateOf(['broke_up'])).toBe('none'); // 헤어진 연인은 배우자가 아니다
    for (const s of ['none', 'partner', 'married', 'divorced'] as const) expect(SPOUSE_LABEL[s].length).toBeGreaterThan(1);
  });

  it('자녀: has_child이면 「있음」, 그 밖에는 「없음」(no_child·child_postponed 포함)', () => {
    const g = { ...base(), age: 40 };
    expect(familyOf({ ...g, flags: ['has_child'] }).child).toBe('has');
    for (const flags of [[], ['no_child'], ['child_postponed']]) expect(familyOf({ ...g, flags }).child, flags.join()).toBe('none');
    expect(CHILD_LABEL).toEqual({ none: '없음', has: '있음' });
  });

  it('실제 판 전수(세 시대 × 40판): 자동으로 끝까지 살며 해마다 배우자·자녀·부모 표시가 플래그·나이와 같다', () => {
    let years = 0;
    for (const era of ['past', 'present', 'future'] as const) {
      for (let seed = 1; seed <= 40; seed++) {
        let g = startLife(seed, era);
        for (let i = 0; i < 200 && g.phase === 'life'; i++) {
          const f = familyOf(g);
          const at = `${era} ${seed} ${g.age}세`;
          if (g.age >= FAMILY_ADULT_AGE) {
            expect(f.child === 'has', at).toBe(g.flags.includes('has_child'));
            expect(f.spouse === 'married', at).toBe(g.flags.includes('married'));
            expect(f.spouse === 'divorced' && g.flags.includes('married'), at).toBe(false);
          } else {
            expect(f.spouse, at).toBeNull();
            expect(f.child, at).toBeNull();
          }
          // 부모: 사별 플래그가 있으면 둘 다 gone, 살아 있다고 보이는 가족의 나이는 상한 이하
          if (g.flags.includes('parents_gone')) expect([f.mother.state, f.father.state], at).toEqual(['gone', 'gone']);
          for (const p of [f.mother, f.father]) if (p.state !== 'gone') expect(p.age, at).toBeLessThanOrEqual(FAMILY_MAX_AGE);
          // 위 형제 수는 출생 때 정한 형제 순서와 같다
          expect(f.siblings.filter((x) => x.older), at).toHaveLength(Math.min(MAX_OLDER_SIBLINGS, g.birthReport!.birthOrder - 1));
          years++;
          g = g.pending ? autoResolveStep(g, g.pending.key).state : stepYear(g).state;
        }
      }
    }
    expect(years, '공허 통과 방지: 수천 해를 점검했다').toBeGreaterThan(5000);
  });

  it('출생 전 상태(출생신고가 없음)는 가족을 만들 수 없다', () => {
    expect(() => familyOf({ ...base(), birthReport: null })).toThrow();
    expect(() => familyOf({ ...base(), character: null })).toThrow();
  });
});
