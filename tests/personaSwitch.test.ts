import { describe, expect, it, vi } from 'vitest';
import { PERSONA_ENABLED } from '../src/data/personaSwitch';
import {
  autoChoiceWeights,
  beginBirth,
  condContextOf,
  createInitialState,
  enterBirth,
  enterLife,
  economyContextOf,
  eventPool,
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

// 출하 값은 3b단계에서 켰다(`personaSwitchShipped.test.ts`가 본다). 이 파일은 「끈 판」의 의미(6-3절)를 시험하므로 스위치를 끈 경로로 고정한다
vi.mock('../src/data/personaSwitch', () => ({ PERSONA_ENABLED: false }));

/**
 * 롤백 스위치 `PERSONA_ENABLED` (SPEC-018 PL1, 설계 6-3절 — `ASK_PET_ENABLED` 전례). **이 파일은 스위치를 끈 경로(mock)로 돌린다** — 3b단계에서 출하 값을 켰으므로 「끄면 어떻게 되는가」를 여기서 잠근다.
 * 스위치를 끄면(`src/data/personaSwitch.ts` 머리 주석): 새 판은 `persona`를 만들지 않고, 맞춤 효과(갱신·`tailored` 조건·자동 모드 보정)는 없으며,
 * 인생은 변경 전과 같다(기존 골든이 따로 잠근다). **저장된 persona는 지우지 않고 통과시킨다**(켠 판에서 끄는 경우·롤백).
 */

const stored = (): PersonaState => personaBirthOf(personaFamSeedOf(777), 'free', 3);
const withStored = (s: GameState): GameState => ({ ...s, persona: stored() });

describe('스위치가 꺼져 있는 동안', () => {
  it('이 파일의 스위치는 mock으로 꺼져 있다(출하 값은 personaSwitchShipped.test.ts가 켜짐으로 잠근다)', () => {
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

describe('스위치가 꺼져 있을 때의 진로 트랙 (3a단계, 설계 6-3절)', () => {
  const hiredPersona = (): PersonaState => ({ ...stored(), job: { field: 'clerk', id: 'clerk-bank', since: 22 }, tries: 1 });
  const at30 = (): GameState => {
    let s: GameState = startLife(4, 'millennial');
    for (let i = 0; i < 200 && s.phase === 'life' && s.age < 30; i++) s = s.pending === null ? stepYear(s).state : resolveChoiceStep(s, s.pending.key, s.pending.choiceIds[0]).state;
    return { ...s, pending: null, flags: [...new Set([...s.flags, 'has_career', 'job_picked'])].sort(), persona: hiredPersona() };
  };

  it('persona가 없는 판은 35세까지 진로 카드가 없고 옛 첫 일 카드가 그대로 나온다', () => {
    let first = 0;
    for (let seed = 1; seed <= 25; seed++) {
      let s: GameState = startLife(seed, 'millennial');
      for (let i = 0; i < 500 && s.phase === 'life' && s.age <= 36; i++) s = s.pending === null ? stepYear(s).state : resolveChoiceStep(s, s.pending.key, s.pending.choiceIds[0]).state;
      expect(Object.keys(s.seen).some((k) => k.startsWith('job-pick-')), `seed ${seed}`).toBe(false);
      if (s.seen['youth-first-job'] !== undefined) first++;
    }
    expect(first).toBeGreaterThan(0); // 옛 카드는 살아 있다(retiredWith는 persona가 켜진 판에서만 거둔다)
  });

  it('저장된 persona가 있어도 스위치가 꺼져 있으면 진로 트랙이 멈춘다(켠 판에서 끄는 경우)', () => {
    const none: GameState = { ...startLife(5, 'millennial'), age: 19, persona: stored() };
    const r = stepYear(none);
    expect(r.state.pending?.eventId.startsWith('job-pick-') ?? false).toBe(false);
    expect(r.state.persona).toEqual(none.persona);
  });

  it('이미 합격한 판은 job·has_career·jobMul이 유지된다 — 소득이 끊기지 않는다', () => {
    const s = at30();
    const back = parseGame(serializeGame(s))!;
    expect(back.persona!.job).toEqual({ field: 'clerk', id: 'clerk-bank', since: 22 });
    expect(back.flags).toEqual(expect.arrayContaining(['has_career', 'job_picked']));
    const withJob = economyContextOf(back);
    expect(withJob.jobMul).toBeGreaterThan(0);
    const { persona: _p, ...bare } = back;
    void _p;
    expect('jobMul' in economyContextOf(bare as GameState)).toBe(false); // persona가 없는 판은 1
  });
});

describe('스위치를 끈 판의 외모 영향 (3b단계 PL16, 설계 4B 중립 판 F11 · 6-3절)', () => {
  const eventPoolOf = (id: string) => eventPool().byId.get(id)!;
  const youthMeeting = () => eventPoolOf('youth-meeting');
  const ctxAt = (gen: 'boomer' | 'millennial', looks: number, age: number, persona: boolean) => {
    const s = { ...startLife(11, gen, { looks }), age };
    return condContextOf(persona ? withStored(s) : s);
  };

  it('외모 새 표(LOOKW)는 끈 판에도 적용된다: persona가 없든 저장돼 있든 연애 가중이 외모 5단계 ×1.7 / 1단계 ×0.3이다', () => {
    const e = youthMeeting();
    for (const persona of [false, true]) {
      const mid = eventWeight(e, ctxAt('millennial', 50, 26, persona));
      expect(eventWeight(e, ctxAt('millennial', 90, 26, persona)) / mid, `persona ${persona}`).toBeCloseTo(1.7, 12);
      expect(eventWeight(e, ctxAt('millennial', 10, 26, persona)) / mid, `persona ${persona}`).toBeCloseTo(0.3, 12);
    }
  });

  it('시대 배율 LOOKERA는 꺼진다: 1995년 이전 판도 표 값 그대로(0.8배 폭을 곱하지 않는다)', () => {
    const e = youthMeeting();
    const c5 = ctxAt('boomer', 90, 25, true);
    expect(c5.year!).toBeLessThanOrEqual(1995);
    expect(eventWeight(e, c5) / eventWeight(e, ctxAt('boomer', 50, 25, true))).toBeCloseTo(1.7, 12);
  });

  it('사업 제안의 외모 가중·소득 보너스 삭제도 끈 판에 적용된다(외모 단계 사이에 같다)', () => {
    for (const id of ['youth-startup', 'middle-business']) {
      const e = eventPoolOf(id);
      const w = [10, 50, 90].map((l) => eventWeight(e, ctxAt('millennial', l, 30, false)));
      expect(new Set(w).size, id).toBe(1);
    }
  });

  it('이미 hired인 판은 스위치를 꺼도 jobMul(외모 ±3% 항 포함)이 유지된다 — 소득이 끊기지 않는다', () => {
    const base = { ...startLife(4, 'millennial'), age: 30 };
    const hired = (looks: number): GameState => ({ ...base, character: { ...base.character!, looks }, persona: { ...stored(), job: { field: 'clerk', id: 'clerk-bank', since: 22 }, tries: 1 } });
    expect(economyContextOf(hired(90)).jobMul! / economyContextOf(hired(10)).jobMul!).toBeCloseTo(1.03 / 0.97, 6);
  });
});
