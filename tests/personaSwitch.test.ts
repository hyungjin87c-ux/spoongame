import { describe, expect, it } from 'vitest';
import { PERSONA_ENABLED } from '../src/data/personaSwitch';
import {
  autoChoiceWeights,
  beginBirth,
  condContextOf,
  createInitialState,
  enterBirth,
  enterLife,
  eventWeight,
  generateBirthFromSeed,
  meetsCondition,
  parseGame,
  personaBirthOf,
  personaFamSeedOf,
  personaOf,
  personaViewOf,
  resolveChoiceStep,
  serializeGame,
  stepYear,
  type GameState,
  type PersonaState,
} from '../src/core';
import { startLife } from '../scripts/simulateLib';
import { ch, ev, poolOf, withPending } from './helpers/personaTest';

/**
 * 롤백 스위치 `PERSONA_ENABLED` (SPEC-018 PL1, 설계 6-3절 — `ASK_PET_ENABLED` 전례). **이 파일은 mock 없이 코드가 출하하는 값 그대로 돌린다.**
 * 2단계에서 스위치는 꺼져 있다(`src/data/personaSwitch.ts` 머리 주석): 새 판은 `persona`를 만들지 않고, 맞춤 효과(갱신·`tailored` 조건·자동 모드 보정)는 없으며,
 * 인생은 변경 전과 같다(기존 골든이 따로 잠근다). **저장된 persona는 지우지 않고 통과시킨다**(켠 판에서 끄는 경우·롤백).
 */

const stored = (): PersonaState => personaBirthOf(personaFamSeedOf(777), 'free', 3);
const withStored = (s: GameState): GameState => ({ ...s, persona: stored() });

describe('스위치가 꺼져 있는 동안', () => {
  it('출하 값은 꺼짐이다', () => {
    expect(PERSONA_ENABLED).toBe(false);
  });

  it('새 판은 persona를 만들지 않는다(출생 결과·룰렛 상태 모두)', () => {
    expect(generateBirthFromSeed(1, 'millennial').persona).toBeUndefined();
    const roulette = beginBirth(createInitialState(7), 'g86');
    expect(roulette.persona).toBeUndefined();
    expect('persona' in roulette).toBe(false);
    const life = enterLife(enterBirth(roulette));
    expect('persona' in life).toBe(false);
    expect('persona' in JSON.parse(serializeGame(life)).data).toBe(false);
  });

  it('저장된 persona는 지우지 않고 그대로 통과시킨다(저장 → 복원 바이트 동일)', () => {
    const s = withStored(startLife(3, 'millennial'));
    const back = parseGame(serializeGame(s));
    expect(back).not.toBeNull();
    expect(back!.persona).toEqual(stored());
    expect(serializeGame(back!)).toBe(serializeGame(s));
  });

  it('맞춤 효과가 없다: personaOf·personaViewOf는 null이고 temper·apt·job·tailored 조건은 맞지 않는다', () => {
    const s = withStored(startLife(3, 'millennial'));
    expect(personaOf(s)).toBeNull();
    expect(personaViewOf(s)).toBeNull();
    const ctx = condContextOf(s);
    expect(ctx.persona).toBeNull();
    for (const c of [{ temper: ['warm' as const] }, { apt: { art: ['mid' as const] } }, { tailored: true as const }]) expect(meetsCondition(c, ctx)).toBe(false);
    expect(ctx.year).toBe(s.character!.birthYear + s.age); // 연도는 스위치와 무관하게 채워진다
  });

  it('갱신이 멈춘다: persona가 저장돼 있어도 선택 해결·해 끝에서 한 글자도 바뀌지 않는다(켠 판에서 끄는 경우)', () => {
    const pool = poolOf([ev({ id: 'test-club', choices: [ch('go', { act: 'sport', role: 'coach' }), ch('stay')] }), ev({ id: 'test-grief', heavy: { kind: 'loss' }, choices: [ch('a'), ch('b')] })]);
    const s0 = withStored({ ...startLife(5, 'millennial'), age: 10 });
    const p0 = s0.persona;
    for (const [id, pick] of [['test-club', 'go'], ['test-grief', 'a']] as const) {
      const r = resolveChoiceStep(withPending(s0, pool, id), `${id}@10`, pick, pool);
      expect(r.state.persona).toEqual(p0);
      expect(r.state.age).toBe(11);
    }
    let s = s0;
    for (let i = 0; i < 8 && s.phase === 'life'; i++) s = s.pending === null ? stepYear(s).state : resolveChoiceStep(s, s.pending.key, s.pending.choiceIds[0]).state;
    expect(s.persona).toEqual(p0);
  });

  it('중립 불변: persona가 저장돼 있어도 자동 모드 선택 가중이 persona 없는 판과 비트 단위로 같다', () => {
    const pool = poolOf([ev({ id: 'test-three', stages: ['youth'], choices: [ch('x', { act: 'sport' }), ch('y'), ch('z')] })]);
    const bare = { ...startLife(9, 'millennial'), age: 21 };
    const a = autoChoiceWeights(withPending(bare, pool, 'test-three'), pool)!;
    const b = autoChoiceWeights(withPending(withStored(bare), pool, 'test-three'), pool)!;
    expect(b.ids).toEqual(a.ids);
    expect(b.weights).toEqual(a.weights);
    expect(a.weights[0]).toBe(a.weights[1]); // act 끌림도 없다
  });

  it('가중·자격은 persona 유무와 무관하다(모디파이어의 기질 조건도 맞지 않는다)', () => {
    const [e] = poolOf([ev({ id: 'test-mod', modifiers: [{ when: { temper: ['warm'] }, weight: 5 }, { when: { tailored: true }, weight: 2 }], choices: [ch('a'), ch('b')] })]).events;
    const s = withStored(startLife(2, 'genz'));
    expect(eventWeight(e, condContextOf(s))).toBe(1);
  });
});
