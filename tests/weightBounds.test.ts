import { describe, expect, it } from 'vitest';
import { EVENT_POOL } from '../src/data/events';
import { MAX_EFFECTIVE_WEIGHT, MIN_EFFECTIVE_WEIGHT, eventWeightBounds, lintEvent, weightBoundsProblems, type EventDef } from '../src/core';
import { PERSONA_TABLE } from '../src/data/personaTable';

/**
 * 합성 가중 범위 검사 (SPEC-018 PL3, 설계 3절 `[CX-002 보충 3]`): `weight × modifiers`(외모 채널 곱·시대 배율 포함)의 모든 조합 곱의 최악·최선이 **[0.01, 10000]** 안이어야 한다.
 * 기존 허용 경계 `0.1 × 0.2 × 0.5 = 0.01`에 `LOOKW.romance` ×0.30을 곱하면 0.003이 되는 식의 새 결합을 이 검사가 잡는다. 서로 같이 맞을 수 없는 모디파이어는 곱하지 않는다.
 */

const when = (c: Record<string, unknown>) => c as EventDef['conditions'] & object;
const base = (over: Partial<EventDef>): EventDef => ({ id: 'test-w', title: '시험', text: '시험 본문입니다. 별일 없는 하루였습니다.', stages: ['youth'], weight: 1, once: false, cooldown: 15, ...over });

describe('eventWeightBounds', () => {
  it('모디파이어가 없으면 weight 그대로다', () => {
    expect(eventWeightBounds(base({ weight: 3 }))).toEqual({ min: 3, max: 3 });
  });

  it('기존 허용 경계: weight 1 × 0.1 × 0.2 × 0.5 = 0.01 → 최솟값 0.01(통과)', () => {
    const e = base({ modifiers: [{ when: when({ looks: { min: 70 } }), weight: 0.1 }, { when: when({ stats: { health: { min: 50 } } }), weight: 0.2 }, { when: when({ flags: ['married'] }), weight: 0.5 }] });
    const b = eventWeightBounds(e);
    expect(b.min).toBeCloseTo(0.01, 12);
    expect(weightBoundsProblems(e)).toEqual([]);
  });

  it('새 결합: 외모 연애 채널의 최악 배수 0.30(LOOKW.romance)을 곱하면 0.003이라 막는다', () => {
    const e = base({ modifiers: [{ when: when({ looks: { min: 70 } }), weight: 0.1 }, { when: when({ stats: { health: { min: 50 } } }), weight: 0.2 }, { when: when({ flags: ['married'] }), weight: 0.5 }] });
    const lowest = PERSONA_TABLE.LOOKW.romance[0] as number; // 0.30 (수저가 아니라 외모 1단계의 연애 가중)
    expect(lowest).toBe(0.3);
    const b = eventWeightBounds(e, [[lowest, PERSONA_TABLE.LOOKW.romance[4] as number]]);
    expect(b.min).toBeCloseTo(0.003, 12);
    expect(weightBoundsProblems(e, [[lowest, 1.7]]).join('\n')).toContain('0.01 아래');
  });

  it('최댓값: 100 × 10 × 10 = 10000은 통과, 거기에 1.7을 곱하면 막는다', () => {
    const e = base({ weight: 100, modifiers: [{ when: when({ looks: { min: 70 } }), weight: 10 }, { when: when({ flags: ['married'] }), weight: 10 }] });
    expect(eventWeightBounds(e).max).toBe(10000);
    expect(weightBoundsProblems(e)).toEqual([]);
    expect(weightBoundsProblems(e, [[0.3, 1.7]]).join('\n')).toContain('10000을 넘을');
  });

  it('서로 같이 맞을 수 없는 모디파이어는 곱하지 않는다(수저 ≤2와 ≥4는 한 판에서 동시에 참일 수 없다)', () => {
    const e = base({ modifiers: [{ when: when({ parentWealth: { max: 2 } }), weight: 0.1 }, { when: when({ parentWealth: { min: 4 } }), weight: 0.1 }, { when: when({ looks: { min: 70 } }), weight: 0.5 }] });
    // 단순 곱이면 0.005지만 수저 조건끼리는 같이 맞을 수 없어 최악은 0.1 × 0.5 = 0.05
    expect(eventWeightBounds(e).min).toBeCloseTo(0.05, 12);
    expect(weightBoundsProblems(e)).toEqual([]);
  });

  it('기본 weight 0.1 × 모디파이어 0.1 × 0.5 = 0.005는 lint가 막는다(lintEvent에 연결됨)', () => {
    const e = base({ weight: 0.1, modifiers: [{ when: when({ looks: { min: 70 } }), weight: 0.1 }, { when: when({ flags: ['married'] }), weight: 0.5 }] });
    expect(lintEvent(e).join('\n')).toContain('합성 가중의 최솟값');
  });

  it('범위 상수는 설계 값이다: [0.01, 10000]', () => {
    expect(MIN_EFFECTIVE_WEIGHT).toBe(0.01);
    expect(MAX_EFFECTIVE_WEIGHT).toBe(10000);
    expect(PERSONA_TABLE.MODEL.composeWeightRange).toEqual([0.01, 10000]);
  });

  it('풀의 모든 기존 사건이 범위 안이다(최악 곱이 기존 허용 경계 안)', () => {
    for (const e of EVENT_POOL.events) {
      const b = eventWeightBounds(e);
      expect(b.min, e.id).toBeGreaterThanOrEqual(MIN_EFFECTIVE_WEIGHT - 1e-12);
      expect(b.max, e.id).toBeLessThanOrEqual(MAX_EFFECTIVE_WEIGHT);
      expect(weightBoundsProblems(e), e.id).toEqual([]);
    }
  });
});

describe('외모 채널 곱을 포함한 합성 가중 (PL16)', () => {
  it('looksChannel이 있는 사건은 채널 곱(연애 ×0.30~×1.70)까지 곱해 범위를 본다 — 같은 모디파이어라도 채널이 없으면 통과한다', () => {
    const mods = [{ when: when({ stats: { health: { min: 50 } } }), weight: 0.2 }, { when: when({ flags: ['married'] }), weight: 0.5 }];
    const plain = base({ weight: 0.1, modifiers: mods }); // 0.1 × 0.2 × 0.5 = 0.01 (경계 통과)
    expect(weightBoundsProblems(plain)).toEqual([]);
    expect(lintEvent(plain).join('\n')).not.toContain('합성 가중의 최솟값');
    const withChannel = { ...plain, looksChannel: 'romance' as const }; // × 0.30 → 0.003
    expect(lintEvent(withChannel).join('\n')).toContain('합성 가중의 최솟값');
    const top = base({ weight: 7000, modifiers: [{ when: when({ flags: ['married'] }), weight: 1.2 }], looksChannel: 'romance' }); // 7000 × 1.2 × 1.7 = 14280
    expect(lintEvent(top).join('\n')).toContain('10000을 넘을');
  });

  it('풀의 모든 연애 채널 사건은 채널 곱까지 곱해도 [0.01, 10000] 안이다', () => {
    const channeled = EVENT_POOL.events.filter((e) => e.looksChannel !== undefined);
    expect(channeled.length).toBe(5);
    for (const e of channeled) {
      const b = eventWeightBounds(e, [[0.3, 1.7]]);
      expect(b.min, e.id).toBeGreaterThanOrEqual(MIN_EFFECTIVE_WEIGHT);
      expect(b.max, e.id).toBeLessThanOrEqual(MAX_EFFECTIVE_WEIGHT);
      expect(lintEvent(e).filter((m) => m.includes('합성 가중')), e.id).toEqual([]);
    }
  });
});
