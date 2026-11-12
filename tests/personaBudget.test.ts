import { describe, expect, it, vi } from 'vitest';
import { EVENT_POOL } from '../src/data/events';
import { FAMILY_LINE_ID } from '../src/data/familyLineText';
import {
  applyPersonaShift,
  decisionFor,
  isChoiceEvent,
  personaFamSeedOf,
  personaOnFamilyLines,
  personaSupportOf,
  resolveChoiceStep,
  resolveDelegated,
  stableKey,
  stepYear,
  type GameState,
  type PersonaShiftContext,
} from '../src/core';
import { forcedPending } from './helpers/forcedPending';
import { ch, ev, lifeAt, personaOf, poolOf, withPending } from './helpers/personaTest';

vi.mock('../src/data/personaSwitch', () => ({ PERSONA_ENABLED: true }));

/**
 * 갱신 예산과 갱신 지점 (SPEC-018 PL1, 설계 1-3절 ⑦ `[CX-002-006]`):
 *  - `advUsed`(역경의 **실제 적용** |Δ| 합 ≤ 12)·`roleUsed`(본보기 ≤ 12)가 저장되고, 한도에 닿으면 남은 몫만 적용하고 잘라 버린다. `seen`으로는 복원할 수 없어 저장한다.
 *  - 갱신 지점은 세 곳 — 선택 해결 한 번(대기 중 미적용) · 가족 변화 줄 · 해 끝 공통 경로 한 번 — 이고 어느 길이든 한 해에 한 번이다.
 *  - 「무거운 장면 가리기」는 갱신을 바꾸지 않는다(켬·끔 같은 벡터·같은 `advUsed`).
 */

const cxOf = (s: GameState, age: number): PersonaShiftContext => ({ famSeed: personaFamSeedOf(s.peerSeed as number), age, parenting: s.character!.parenting, parentWealth: s.character!.parentWealth });

describe('예산 저장: 역경·본보기', () => {
  const pool = poolOf([ev({ id: 'test-grief', heavy: { kind: 'loss' }, choices: [ch('hold'), ch('talk')] }), ev({ id: 'test-mentor', choices: [ch('learn', { role: 'teacher' }), ch('skip')] })]);

  it('무거운 선택 사건을 해결하면 advUsed가 저장되고 실제 적용한 |Δ| 합과 같다', () => {
    const s0 = lifeAt(5, 8);
    const before = personaOf(s0);
    const r = resolveChoiceStep(withPending(s0, pool, 'test-grief'), 'test-grief@8', 'hold', pool);
    const after = personaOf(r.state);
    const supported = personaSupportOf(withPending(s0, pool, 'test-grief'));
    const cx = cxOf(s0, 8);
    const expected = applyPersonaShift(applyPersonaShift(before, cx, { adversity: { kind: 'loss', key: stableKey('test-grief', 'hold'), supported } }), cx, { yearEnd: true });
    expect(after).toEqual(expected);
    expect(after.advUsed).toBeGreaterThan(0);
    expect(after.advUsed).toBeLessThanOrEqual(6);
  });

  it('본보기 선택을 해결하면 roleUsed가 저장된다(+3 안쪽)', () => {
    const s0 = lifeAt(6, 11);
    const r = resolveChoiceStep(withPending(s0, pool, 'test-mentor'), 'test-mentor@11', 'learn', pool);
    expect(personaOf(r.state).roleUsed).toBeGreaterThan(0);
    expect(personaOf(r.state).roleUsed).toBeLessThanOrEqual(3);
    const skip = resolveChoiceStep(withPending(s0, pool, 'test-mentor'), 'test-mentor@11', 'skip', pool);
    expect(personaOf(skip.state).roleUsed).toBeUndefined();
  });

  it('여러 번 겪어도 advUsed·roleUsed는 12를 넘지 않고, 예산 필드는 저장→복원에서 그대로다', () => {
    let s = lifeAt(7, 8);
    for (let age = 8; age <= 18; age++) {
      s = { ...s, age, pending: null };
      s = resolveChoiceStep(withPending(s, pool, 'test-grief'), `test-grief@${age}`, 'talk', pool).state;
      s = { ...s, age, pending: null };
      s = resolveChoiceStep(withPending(s, pool, 'test-mentor'), `test-mentor@${age}`, 'learn', pool).state;
    }
    const p = personaOf(s);
    expect(p.advUsed).toBeLessThanOrEqual(12);
    expect(p.roleUsed).toBeLessThanOrEqual(12);
    expect((p.advUsed ?? 0) + (p.roleUsed ?? 0)).toBeGreaterThan(0);
    expect(personaOf(s).w.every((x) => x >= 5 && x <= 95)).toBe(true);
  });
});

describe('갱신 지점은 세 곳, 어느 길이든 한 해에 한 번', () => {
  it('선택 해결: 대기 중에는 적용하지 않고(pending이 열린 동안 같은 상태), 해결 한 번 = 사건 갱신 한 번 + 해 끝 한 번', () => {
    const pool = poolOf([ev({ id: 'test-club', choices: [ch('go', { act: 'sport' }), ch('stay')] })]);
    const s0 = lifeAt(2, 9);
    const pending = withPending(s0, pool, 'test-club');
    expect(pending.persona).toEqual(s0.persona);
    expect(stepYear(pending, pool).state.persona).toEqual(s0.persona);
    const r = resolveChoiceStep(pending, 'test-club@9', 'go', pool);
    const cx = cxOf(s0, 9);
    expect(r.state.persona).toEqual(applyPersonaShift(applyPersonaShift(personaOf(s0), cx, { act: 'sport' }), cx, { yearEnd: true }));
    expect(r.state.age).toBe(10);
  });

  it('조용한 해: 해 끝 갱신만 한 번(사건이 없는 풀로 나이 3~18을 진행)', () => {
    const empty = poolOf([ev({ id: 'test-never', stages: ['senior'], choices: [ch('a'), ch('b')] })]);
    for (let age = 3; age <= 18; age++) {
      const s0 = lifeAt(age + 40, age);
      const r = stepYear(s0, empty);
      if (r.tick.kind !== 'quiet' && r.tick.kind !== 'narrative') continue; // 가족 줄이 있는 해는 건너뛴다(아래 가족 줄 시험이 따로 본다)
      if (r.tick.familyIds !== undefined) continue;
      expect(r.state.persona, `나이 ${age}`).toEqual(applyPersonaShift(personaOf(s0), cxOf(s0, age), { yearEnd: true }));
    }
  });

  it('서술 사건의 역경·본보기: 사건이 적용되는 자리에서 한 번 + 해 끝 한 번(안정 키 = 이벤트 id + age<나이>)', () => {
    const pool = poolOf([ev({ id: 'test-narr', once: true, cooldown: undefined, heavy: { kind: 'school' }, role: 'coach', stages: ['school'], ageRange: { min: 7, max: 18 }, weight: 50 })]);
    let checked = 0;
    for (let seed = 1; seed <= 12 && checked < 4; seed++) {
      let s: GameState = { ...lifeAt(seed, 7), flags: ['close_friend'] }; // 지지가 있다(친한 친구) — 가족 줄과 상관없이 같은 지지값
      for (let guard = 0; s.age <= 18 && guard < 30 && s.phase === 'life'; guard++) {
        const before = s;
        const r = stepYear(s, pool);
        s = r.state;
        if (r.tick.eventId !== 'test-narr' || r.tick.familyIds !== undefined) continue;
        const cx = cxOf(before, before.age);
        const expected = applyPersonaShift(
          applyPersonaShift(personaOf(before), cx, { role: 'coach', adversity: { kind: 'school', key: stableKey('test-narr', `age${before.age}`), supported: true } }),
          cx,
          { yearEnd: true },
        );
        expect(s.persona).toEqual(expected);
        checked++;
        break;
      }
    }
    expect(checked).toBeGreaterThan(0);
  });

  it('가족 변화 줄: FAMILY_LINE_HEAVY 분류 줄만 역경이고 안정 키는 (줄 eventId, age<나이>)다(풀에도 seen에도 없는 줄)', () => {
    const s0: GameState = { ...lifeAt(3, 10), flags: ['close_friend'] };
    const p0 = personaOf(s0);
    const line = (eventId: string) => ({ age: 10, kind: 'event' as const, text: '가족 줄', eventId });
    const after = personaOnFamilyLines(s0, [line(FAMILY_LINE_ID.parentGone)], 10);
    expect(personaOf(after)).toEqual(applyPersonaShift(p0, cxOf(s0, 10), { adversity: { kind: 'loss', key: stableKey(FAMILY_LINE_ID.parentGone, 'age10'), supported: true } }));
    expect(personaOnFamilyLines(s0, [line(FAMILY_LINE_ID.parentsApart)], 10).persona).not.toEqual(p0);
    // 분류 없는 줄(동생 출생·독립)은 역경이 아니다
    expect(personaOnFamilyLines(s0, [line(FAMILY_LINE_ID.sibBorn)], 10)).toBe(s0);
    // 두 줄이 같은 해에 있으면 각각 한 번씩
    const both = personaOnFamilyLines(s0, [line(FAMILY_LINE_ID.parentGone), line(FAMILY_LINE_ID.grandGone)], 10);
    expect(personaOf(both).advUsed).toBeGreaterThan(personaOf(after).advUsed ?? 0);
    // 19세 이상은 아동기 역경이 아니다
    expect(personaOf(personaOnFamilyLines({ ...s0, age: 19 }, [line(FAMILY_LINE_ID.parentGone)], 19)).advUsed).toBeUndefined();
  });

  it('진행 중 실제 가족 줄이 난 해: stepYear가 줄을 한 번 역경으로 센다(어린 시절 별세·이혼이 나는 판을 찾는다)', () => {
    const empty = poolOf([ev({ id: 'test-never', stages: ['senior'], choices: [ch('a'), ch('b')] })]);
    const heavyIds: readonly string[] = [FAMILY_LINE_ID.parentGone, FAMILY_LINE_ID.grandGone, FAMILY_LINE_ID.parentsApart, FAMILY_LINE_ID.sibLost];
    let found = 0;
    for (let seed = 1; seed <= 2500 && found < 3; seed++) {
      let s: GameState = lifeAt(seed, 0);
      for (let guard = 0; s.age <= 18 && guard < 40 && s.phase === 'life'; guard++) {
        const before = s;
        const r = stepYear(before, empty);
        s = r.state;
        if (r.tick.familyIds === undefined || !r.tick.familyIds.some((id) => heavyIds.includes(id))) continue;
        if (before.age > 18) break;
        // 이 해에 가족 줄이 있었다 → 줄만큼 역경 예산이 늘었다(역경 입력 말고 이 해에 advUsed를 올릴 것이 없다)
        expect(personaOf(r.state).advUsed ?? 0).toBeGreaterThan(personaOf(before).advUsed ?? 0);
        found++;
        break;
      }
    }
    expect(found, '어린 시절 무거운 가족 줄이 나는 판을 찾았다').toBeGreaterThan(0);
  });

  it('흘러감(child) 해: 같은 해결 경로라 사건 갱신 + 해 끝 갱신이 한 번씩이다(실제 흘러가는 카드)', () => {
    const delegated = EVENT_POOL.events.filter((e) => isChoiceEvent(e) && e.ageRange?.min !== undefined && decisionFor(e.id, e.ageRange.min) === 'child' && e.heavy === undefined);
    let checked = 0;
    for (const e of delegated) {
      let pending: GameState;
      try {
        pending = forcedPending(e.id, 'millennial', { age: e.ageRange!.min! });
      } catch {
        continue;
      }
      const r = resolveDelegated(pending, 'child');
      expect(r.tick.by).toBe('child');
      // 데이터에 act·role·heavy가 없으니 갱신은 해 끝뿐이다 — 한 번
      expect(personaOf(r.state)).toEqual(applyPersonaShift(personaOf(pending), cxOf(pending, pending.age), { yearEnd: true }));
      if (++checked >= 3) break;
    }
    expect(checked).toBeGreaterThan(0);
  });

  it('부모가 정한(parent) 해의 활동은 ½다: 같은 상태에서 본인(by 없음)과 부모(by)의 결과가 다르다', () => {
    const pool = poolOf([ev({ id: 'test-club', choices: [ch('go', { act: 'sport' }), ch('stay')] })]);
    const s0 = lifeAt(4, 10);
    const pending = withPending(s0, pool, 'test-club');
    const self = resolveChoiceStep(pending, 'test-club@10', 'go', pool).state;
    const cx = cxOf(s0, 10);
    expect(self.persona).toEqual(applyPersonaShift(applyPersonaShift(personaOf(s0), cx, { act: 'sport' }), cx, { yearEnd: true }));
    // by를 거치는 공개 경로는 resolveDelegated뿐이라, 같은 ½ 규칙을 순수 함수로 견준다
    expect(applyPersonaShift(personaOf(s0), cx, { act: 'sport', by: 'parent' }).w).not.toEqual(applyPersonaShift(personaOf(s0), cx, { act: 'sport' }).w);
  });
});

describe('무거운 장면 가리기 켬·끔 동치 (가려지는 것은 글뿐)', () => {
  const pool = poolOf([ev({ id: 'test-grief', heavy: { kind: 'home' }, choices: [ch('hold'), ch('talk')] })]);

  it('가림을 켠 판(gentleUsed)과 끈 판이 같은 시드·같은 선택에서 같은 persona·같은 advUsed다', () => {
    const run = (gentle: boolean): GameState => {
      let s: GameState = { ...lifeAt(14, 8), ...(gentle ? { gentleUsed: true } : {}) };
      for (let age = 8; age <= 12; age++) {
        s = { ...s, age, pending: null };
        s = resolveChoiceStep(withPending(s, pool, 'test-grief'), `test-grief@${age}`, age % 2 === 0 ? 'hold' : 'talk', pool).state;
      }
      return s;
    };
    const off = run(false);
    const on = run(true);
    expect(on.persona).toEqual(off.persona);
    expect(personaOf(on).advUsed).toBe(personaOf(off).advUsed);
    expect(personaOf(off).advUsed).toBeGreaterThan(0);
    // 가림 표지만 다르다
    expect(on.gentleUsed).toBe(true);
    expect(off.gentleUsed).toBeUndefined();
  });
});
