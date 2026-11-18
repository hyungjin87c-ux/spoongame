import { describe, expect, it } from 'vitest';
import { FOCUS_K, FOCUS_K_MAX, FOCUS_MODEL, FOCUS_TABLE } from '../src/data/focusTable';
import { SELF_AREA_WEIGHT } from '../src/data/parentDecisionTable';
import { EVENT_POOL } from '../src/data/events';
import { eventWeightBounds, focusFactor, focusTaggable, focusTopicsOf, pickWeightProblems, type EventDef, type FocusId } from '../src/core';

/**
 * 곱의 한계 (SPEC-018 PL10, 설계 2-1·2-2절): 곱은 가중을 줄이지 않고(≥ 1), 기존 가중의 `FOCUS_K`배를 넘지 않으며, 주제 둘이 모두 초점이어도 한 번만 곱한다.
 * 합성 가중(자기 영역 × 초점 최악 곱)이 `MAX_EFFECTIVE_WEIGHT`(10000)을 넘는 사건은 빌드가 막는다.
 */
const FOCI: readonly FocusId[] = [0, 1, 2, 3, 4, 5];
const events = EVENT_POOL.events;

describe('focusWeight — 곱 한 번 · 유한 · 양수 · 기존 이상 · 기존 × K 이하', () => {
  it('모든 사건 × 6초점 × (초점 없음): 배수는 유한한 양수이고 1 또는 K다', () => {
    let hits = 0;
    for (const ev of events) {
      expect(focusFactor(ev.id, null), `${ev.id} 없음`).toBe(1);
      for (const f of FOCI) {
        const m = focusFactor(ev.id, f);
        expect(Number.isFinite(m) && m > 0, `${ev.id}/${f}`).toBe(true);
        expect(m === 1 || m === FOCUS_K, `${ev.id}/${f}`).toBe(true);
        expect(m).toBeGreaterThanOrEqual(1);
        expect(m).toBeLessThanOrEqual(FOCUS_K);
        if (m === FOCUS_K) hits++;
      }
    }
    expect(hits, '공허 통과 방지: 곱이 닿는 칸이 있다').toBeGreaterThan(50);
  });

  it('곱이 닿는 칸은 사건의 주제에 그 초점이 있을 때뿐이고, 표에 없는 사건 id에는 닿지 않는다', () => {
    for (const [id, codes] of Object.entries(FOCUS_TABLE)) {
      const topics = focusTopicsOf(id);
      expect(topics).toHaveLength(codes.length);
      for (const f of FOCI) expect(focusFactor(id, f) === FOCUS_K, `${id}/${f}`).toBe(topics.includes(f));
    }
    for (const f of FOCI) expect(focusFactor('no-such-event', f)).toBe(1);
  });

  it('여러 주제 곱 1회: 주제가 둘인 사건에서 둘 중 어느 쪽 초점이든 K이고 K²가 아니다', () => {
    const two = Object.keys(FOCUS_TABLE).filter((id) => focusTopicsOf(id).length === 2);
    expect(two.length).toBeGreaterThan(10);
    for (const id of two) for (const t of focusTopicsOf(id)) expect(focusFactor(id, t), `${id}/${t}`).toBe(FOCUS_K);
    expect(FOCUS_K * FOCUS_K).toBeGreaterThan(FOCUS_K_MAX);
  });

  it('K는 하드 상한 3.0 이하이고 13~18세 본인 카드의 최대 곱(자기 영역 × K)은 한계 안이다', () => {
    expect(FOCUS_K).toBeLessThanOrEqual(3.0);
    expect(FOCUS_K_MAX).toBe(3.0);
    expect(SELF_AREA_WEIGHT * FOCUS_K_MAX).toBeLessThanOrEqual(6);
  });

  it('pickWeightProblems: 실제 풀은 통과하고 최대 합성 가중은 10000 아래다', () => {
    expect(pickWeightProblems(events)).toEqual([]);
    let max = 0;
    for (const ev of events.filter(focusTaggable)) max = Math.max(max, eventWeightBounds(ev, [[1, SELF_AREA_WEIGHT], [1, FOCUS_K_MAX]]).max);
    expect(max).toBeGreaterThan(0);
    expect(max).toBeLessThanOrEqual(FOCUS_MODEL.pickWeightMax);
  });

  it('pickWeightProblems는 최악 곱이 10000을 넘는 가상 사건을 거절하고, 곱 없이는 통과하는 사건도 곱 때문에 거절한다', () => {
    const base = events.find((e) => e.id === 'school-club') as EventDef;
    const huge: EventDef = { ...base, id: 'school-huge', weight: 100, modifiers: [{ when: {}, weight: 100 }] };
    const table = { 'school-huge': ['hobby'] as const };
    const p = pickWeightProblems([huge], table);
    expect(p).toHaveLength(1);
    expect(p[0]).toContain('school-huge');
    expect(p[0]).toContain('최댓값');
    // 곱 전의 최댓값 10000은 통과하고 곱(자기 영역 2 × 3.0)이 더해져 넘는 사건
    const edge: EventDef = { ...base, id: 'school-edge', weight: 100, modifiers: [{ when: {}, weight: 100 }] };
    expect(eventWeightBounds(edge).max).toBe(10000);
    expect(pickWeightProblems([edge], {})).toEqual([]); // 표에 행이 없으면 곱이 닿지 않아 보지 않는다
    expect(pickWeightProblems([edge], { 'school-edge': [] })).toHaveLength(1);
  });
});
