import { describe, expect, it } from 'vitest';
import { autoResolveStep, eventPool, focusEffectiveOf, setFocus, stepYear, totalCards, type FocusId, type GameState } from '../src/core';
import { playFocusLife, focusSeedOf } from '../scripts/focusReportLib';
import { itFocusOn, lifeStateAt, listOf } from './helpers/focusStates';

/**
 * 판당 카드 수·난수 소비 불변 (SPEC-018 PL10, 설계 2-3절): 초점은 이미 정해진 카드 안에서 「어느 사건」만 바꾼다.
 * ① 한 해 차분(정확): 같은 상태에서 초점 없음/그 구간의 모든 초점으로 `stepYear` — 카드 범주(결정·서술·없음)·나이·해를 마친 뒤 **난수 상태**가 같다.
 * ② 판 단위(거친 상한): 초점 팔의 판당 카드 수 평균이 초점 없음과 크게 다르지 않다 — 정확한 ≤ 0.1장 판정은 `report:persona --only=focus`의 ④가 1,000판으로 보고한다.
 */
const pool = eventPool();
const AGES = [13, 14, 15, 16, 18, 19, 20, 24, 30, 35, 39, 40, 45, 52, 60, 64, 65, 72, 80];

/**
 * 카드 범주: 결정 카드(본인이 고르는 `choice`든 부모님이 정하거나 흘러간 `resolved`든 **선택 사건 한 장**) · 서술 · 아무것도 없는 해.
 * 초점이 바꾸는 것은 선택 풀 안의 「어느 사건」이라 같은 범주 안에서 결정자(본인/부모)는 달라질 수 있다 — 그 시간 영향은 report:time이 본다. 해를 끝까지 마친 뒤의 난수 상태는 같아야 한다.
 */
const categoryOf = (kind: string): string => (kind === 'choice' || kind === 'resolved' ? 'decision' : kind);
/** 해를 끝까지 마친다: 본인 카드가 열려 있으면 자동 선택으로 푼다 */
const finish = (s: GameState): GameState => (s.pending === null ? s : autoResolveStep(s, s.pending.key, pool).state);

describe('focusPacing ① 한 해 차분 — 카드 범주·난수 소비가 초점과 무관하다', () => {
  itFocusOn('20시드 × 구간 안팎 나이 × 그 구간의 모든 초점: 카드 범주·나이·해를 마친 뒤 rngState가 초점 없음과 같다', () => {
    let compared = 0;
    let decision = 0;
    for (let i = 1; i <= 20; i++) {
      const seed = i * 131 + 7;
      for (const age of AGES) {
        const base = lifeStateAt(seed, i % 2 === 0 ? 'millennial' : 'industrial', age);
        if (base.phase !== 'life' || base.pending !== null || base.age !== age) continue;
        const none = stepYear(base, pool);
        const noneDone = finish(none.state);
        for (const f of listOf(base)) {
          const withF = setFocus(base, f, pool);
          expect(focusEffectiveOf(withF, withF.age, pool), `${seed}/${age}/${f}: 초점이 닿는다`).toBe(f);
          const r = stepYear(withF, pool);
          const done = finish(r.state);
          expect(categoryOf(r.tick.kind), `${seed}/${age}/${f}`).toBe(categoryOf(none.tick.kind));
          expect(done.age, `${seed}/${age}/${f}`).toBe(noneDone.age);
          expect(done.rngState, `${seed}/${age}/${f}: 난수 소비`).toBe(noneDone.rngState);
          compared++;
          if (categoryOf(none.tick.kind) === 'decision') decision++;
        }
      }
    }
    expect(compared, '공허 통과 방지: 비교 칸이 충분하다').toBeGreaterThan(300);
    expect(decision, '결정 카드가 나온 해를 포함한다').toBeGreaterThan(30);
  });

  itFocusOn('초점이 닿은 해에는 뽑힌 사건이 달라지는 칸이 있다 (곱이 실제로 작동한다)', () => {
    let changed = 0;
    for (let i = 1; i <= 40 && changed === 0; i++) {
      for (const age of [14, 16, 22, 26, 44, 50, 66, 70]) {
        const base: GameState = lifeStateAt(i * 17, 'millennial', age);
        if (base.phase !== 'life' || base.pending !== null) continue;
        const none = stepYear(base, pool);
        for (const f of listOf(base) as readonly FocusId[]) {
          const r = stepYear(setFocus(base, f, pool), pool);
          if (r.tick.eventId !== none.tick.eventId) changed++;
        }
      }
    }
    expect(changed).toBeGreaterThan(0);
  });
});

describe('focusPacing ② 판 단위 — 카드 수 평균은 거의 같다', () => {
  it('150판: 공부·관계 초점 팔의 판당 카드 수(결정+서술) 평균이 초점 없음과 0.8장 안 (거친 상한)', () => {
    const n = 150;
    const mean = (arm: FocusId | null): number => {
      let sum = 0;
      for (let i = 1; i <= n; i++) {
        const l = playFocusLife(focusSeedOf(i), 'millennial', arm, 'auto');
        sum += totalCards(l.counts) + l.counts.narrative;
      }
      return sum / n;
    };
    const base = mean(null);
    for (const arm of [0, 2] as const) expect(Math.abs(mean(arm) - base), `팔 ${arm}`).toBeLessThan(0.8);
  });
});
