import { describe, expect, it, vi } from 'vitest';
import { applyPersonaShift, aptScoreOf, aptSeedOf, aptTierOf, mixSeed, parseGame, personaViewOf, readPersona, seedCoefOf, serializeGame, type PersonaState } from '../src/core';
import { lifeAt, personaOf } from './helpers/personaTest';

vi.mock('../src/data/personaSwitch', () => ({ PERSONA_ENABLED: true }));

/**
 * 모양 버전 `persona.v`와 저장 범위 (SPEC-018 PL2, 설계 2절·6-1절 `[CX-002-007]`):
 *  - 싹 식·계수는 **배정 버전에 고정**한다 — 코드 표 `SEEDCOEF[v]`(`v = 1` → 0.7). 계수를 바꾸려면 `v`를 올리고 옛 `v` 판은 옛 계수를 쓴다(같은 시드·`g`의 적성 단계가 배포로 바뀌지 않는다).
 *  - 키움 `g`의 **저장 검증 범위는 0~40으로 `v = 1`에 고정**이고 성장 상한 `GMAX`(30)와 별개다 — 불러온 `g`가 지금 `GMAX`보다 커도 보존하고 더 자라지 않는다.
 */

const fam = (i: number): number => mixSeed(i + 1, 0x7a3b11c5);
const state = (g: number[], over: Partial<PersonaState> = {}): PersonaState => ({ v: 1, born: 0, w: [50, 50, 50, 50, 50, 50], shown: 0, g, ...over });

describe('SEEDCOEF[v]: 싹 계수는 버전에 고정된다', () => {
  it('v = 1은 0.7이고 모르는 v는 던진다(계수를 조용히 바꾸지 않는다)', () => {
    expect(seedCoefOf(1)).toBe(0.7);
    for (const v of [0, 2, 3, 99]) expect(() => seedCoefOf(v)).toThrow();
  });

  it('설계 예시: 싹 80 + 키움 8 → v=1(0.70)이면 64 mid (0.75였다면 68 high — 단계가 배포로 바뀌지 않는다는 것의 반례)', () => {
    let found = -1;
    for (let i = 0; i < 20_000 && found < 0; i++) if (aptSeedOf(fam(i), 0) === 80) found = i;
    expect(found).toBeGreaterThanOrEqual(0);
    const p = state([8, 0, 0, 0, 0]);
    expect(aptScoreOf(fam(found), p, 0)).toBe(Math.round(0.7 * 80 + 8)); // 64
    expect(aptTierOf(aptScoreOf(fam(found), p, 0))).toBe('mid');
    expect(aptTierOf(Math.round(0.75 * 80 + 8))).toBe('high'); // 계수가 조용히 바뀌었다면
  });

  it('점수는 persona.v의 계수를 쓴다 — v가 다른 값이면 던진다(점수를 지어내지 않는다)', () => {
    const bad = { ...state([0, 0, 0, 0, 0]), v: 2 as unknown as 1 };
    expect(() => aptScoreOf(fam(1), bad, 0)).toThrow();
  });
});

describe('g 저장 범위 0~40 (양방향 로드)', () => {
  const life = lifeAt(11, 12);

  const withG = (g: unknown): string => {
    const raw = JSON.parse(serializeGame(life)) as { data: { persona: { g: unknown } } };
    raw.data.persona.g = g;
    return JSON.stringify(raw);
  };

  it('0과 40(경계)은 그대로 읽힌다', () => {
    for (const g of [[0, 0, 0, 0, 0], [40, 40, 40, 40, 40], [0, 10, 30, 31, 40]]) {
      const back = parseGame(withG(g));
      expect(back).not.toBeNull();
      expect(back!.persona!.g).toEqual(g);
    }
  });

  it('범위 밖(−1·41)·소수·길이 오류·문자열은 persona만 버리고 판은 산다', () => {
    for (const g of [[-1, 0, 0, 0, 0], [41, 0, 0, 0, 0], [0.5, 0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0, 0, 0], ['1', 0, 0, 0, 0], null]) {
      const back = parseGame(withG(g));
      expect(back, JSON.stringify(g)).not.toBeNull();
      expect(back!.persona).toBeUndefined();
      expect(back!.age).toBe(12);
      expect(back!.character).toEqual(life.character);
    }
  });

  it('GMAX(30)보다 큰 g는 보존하고 더 자라지 않는다 — 잘라 버리지 않는다: 읽기 → 갱신 → 저장에서도 그대로', () => {
    const loaded = parseGame(withG([31, 35, 40, 30, 29]))!;
    expect(loaded.persona!.g.slice(0, 4)).toEqual([31, 35, 40, 30]);
    const cx = { famSeed: 1234, age: 10, parenting: 'strict' as const, parentWealth: 5 as const };
    let p = loaded.persona!;
    for (let n = 0; n < 20; n++) p = applyPersonaShift(p, { ...cx, age: 4 + (n % 15) }, { act: 'study', yearEnd: true });
    expect(p.g.slice(0, 4)).toEqual([31, 35, 40, 30]);
    expect(p.g[4]).toBeGreaterThanOrEqual(29);
    expect(readPersona(JSON.parse(JSON.stringify(p)))).toEqual(p);
  });

  it('v가 1이 아니거나 모르는 키가 있으면 persona만 버린다(다른 필드·판은 산다)', () => {
    for (const mutate of [(p: Record<string, unknown>) => (p.v = 2), (p: Record<string, unknown>) => (p.v = 0), (p: Record<string, unknown>) => (p.extra = 1), (p: Record<string, unknown>) => delete p.v]) {
      const raw = JSON.parse(serializeGame(life)) as { data: { persona: Record<string, unknown> } };
      mutate(raw.data.persona);
      const back = parseGame(JSON.stringify(raw));
      expect(back).not.toBeNull();
      expect(back!.persona).toBeUndefined();
      expect(back!.seen).toEqual(life.seen);
    }
  });

  it('보기(personaViewOf)는 g = 40까지 안전하게 단계를 낸다', () => {
    const s = { ...life, persona: { ...personaOf(life), g: [40, 40, 40, 40, 40] } };
    const view = personaViewOf(s);
    expect(view).not.toBeNull();
    expect(Object.values(view!.tiers).every((t) => t === 'high' || t === 'mid')).toBe(true);
  });
});
