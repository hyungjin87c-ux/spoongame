import { describe, expect, it } from 'vitest';
import { EVENT_POOL } from '../src/data/events';
import { lintEvent, minVisibleChoices, usesPersonaCondition, visibleChoiceGrid, visibleChoiceGridProblems, visibleChoiceProblems, worstCaseVisibleChoiceIds, type EventDef } from '../src/core';
import { ch, ev, poolOf } from './helpers/personaTest';

/**
 * 선택지 격자 하한 (SPEC-018 PL3, 설계 3절 `[CX-002-003]`): 맞춤 조건(`temper`·`apt`·`job`·`tailored`)을 쓰는 선택지 사건은 「조건 없는 선택지 ≥ 2」 대신
 * **수저 1~5 × 적성 단계(축마다 low·mid·high) × 기질 6 × 연도 경계(−1·0·+1) × 맞춤 인생 없는 중립 상태** 전부에서 보이는 선택지가 2~3개여야 한다.
 * `minVisibleChoices`(최소 — 신설)와 `worstCaseVisibleChoiceIds`(최대)가 함께 쓰인다. 0~1개가 되는 칸이 있으면 사건이 추첨에서 사라지므로 빌드 실패.
 */

const one = (e: Record<string, unknown>): EventDef => poolOf([e]).byId.get(e.id as string)!;
const poor = { parentWealth: { max: 2 } };
const rich = { parentWealth: { min: 3 } };

describe('격자 하한: G1·G2 꼴(공통 1개 + 수저 형편별 고유 2개씩, 정의 5개)', () => {
  const g1 = one(
    ev({
      id: 'test-g1',
      conditions: { tailored: true },
      choices: [ch('common'), ch('poor-a', { requires: poor }), ch('poor-b', { requires: poor }), ch('rich-a', { requires: rich }), ch('rich-b', { requires: rich })],
    }),
  );

  it('어느 칸에서도 보이는 것이 3개다(공통 1 + 형편별 2)', () => {
    const g = visibleChoiceGrid(g1);
    expect(g.min).toBe(3);
    expect(g.max).toBe(3);
    expect(minVisibleChoices(g1)).toBe(3);
    expect(g.cells).toBeGreaterThanOrEqual(5); // 수저 5단계 × 맞춤 있음
    expect(visibleChoiceGridProblems(g1)).toEqual([]);
    expect(lintEvent(g1).filter((p) => p.includes('격자'))).toEqual([]);
  });

  it('정의 5개 중 보이는 최대 3개를 넘지 않는다 — 최악 묶음도 3개 이하', () => {
    expect(visibleChoiceProblems(g1)).toEqual([]);
    expect(worstCaseVisibleChoiceIds(g1)).toHaveLength(3);
    expect(worstCaseVisibleChoiceIds(g1)).toContain('common');
  });
});

describe('격자 하한을 어기는 사건은 빌드가 막힌다', () => {
  it('적성 단계가 겹치지 않는 두 고유 선택지: 그 축이 mid인 칸에서 1개만 보인다', () => {
    const e = one(ev({ id: 'test-hole', conditions: { tailored: true }, choices: [ch('common'), ch('hi', { requires: { apt: { art: ['high'] } } }), ch('lo', { requires: { apt: { art: ['low'] } } })] }));
    const g = visibleChoiceGrid(e);
    expect(g.min).toBe(1);
    expect(g.minCell).toContain('art:mid');
    const problems = visibleChoiceGridProblems(e);
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain('1개인 칸');
    expect(lintEvent(e).join('\n')).toContain('선택지 격자');
  });

  it('맞춤 인생 없는 중립 상태: 사건 조건이 맞춤을 요구하지 않으면 중립 칸에서는 맞춤 선택지가 숨는다', () => {
    const e = one(ev({ id: 'test-neutral', choices: [ch('common'), ch('t1', { requires: { temper: ['warm'] } }), ch('t2', { requires: { tailored: true } })] }));
    const g = visibleChoiceGrid(e);
    expect(g.min).toBe(1);
    expect(g.minCell).toContain('중립');
    expect(visibleChoiceGridProblems(e).join('\n')).toContain('중립');
  });

  it('같은 사건이 사건 조건으로 맞춤 인생을 요구하면 중립 칸은 그 사건이 일어날 수 없는 칸이라 제외된다', () => {
    const e = one(ev({ id: 'test-neutral2', conditions: { tailored: true }, choices: [ch('common'), ch('t1', { requires: { temper: ['warm'] } }), ch('t2', { requires: { tailored: true } })] }));
    expect(visibleChoiceGrid(e).minCell).not.toContain('중립');
    expect(visibleChoiceGrid(e).min).toBe(2);
    expect(visibleChoiceGridProblems(e)).toEqual([]);
  });

  it('연도 경계(−1·0·+1): yearRange가 걸친 선택지가 경계에서 비는 칸을 잡는다', () => {
    // 2016까지 보이는 선택지와 2018부터 보이는 선택지 — 2017년에는 공통 1개만 보인다
    const e = one(ev({ id: 'test-year', conditions: { tailored: true }, choices: [ch('common'), ch('old', { requires: { year: { max: 2016 } } }), ch('new', { requires: { year: { min: 2018 } } })] }));
    const g = visibleChoiceGrid(e);
    expect(g.min).toBe(1);
    expect(g.minCell).toContain('2017년');
    expect(visibleChoiceGridProblems(e)).toHaveLength(1);
    // 경계가 이어지면 통과한다
    const ok = one(ev({ id: 'test-year-ok', conditions: { tailored: true }, choices: [ch('common'), ch('old', { requires: { year: { max: 2016 } } }), ch('new', { requires: { year: { min: 2017 } } })] }));
    expect(visibleChoiceGridProblems(ok)).toEqual([]);
    expect(visibleChoiceGrid(ok).min).toBe(2);
  });

  it('yearRange 경계 연도 −1·0·+1이 격자에 든다(사건이 일어나는 해만)', () => {
    const e = one(ev({ id: 'test-yr', yearRange: { from: 2016, to: 2020 }, conditions: { tailored: true }, choices: [ch('common'), ch('a', { requires: { temper: ['warm'] } }), ch('b', { requires: { temper: ['quiet'] } })] }));
    // 사건이 일어나는 연도는 2016~2020뿐이라 2015·2021 칸은 없다
    expect(visibleChoiceGrid(e).cells).toBeGreaterThan(0);
    expect(visibleChoiceGrid(e).minCell).not.toContain('2015년');
    expect(visibleChoiceGrid(e).minCell).not.toContain('2021년');
  });

  it('동시에 4개가 보일 수 있는 칸은 막는다(어떤 상태에서도 3개 이하)', () => {
    const e = one(ev({ id: 'test-over', conditions: { tailored: true }, choices: [ch('a'), ch('b'), ch('c', { requires: { apt: { art: ['low', 'mid', 'high'] } } }), ch('d', { requires: { apt: { art: ['low', 'mid', 'high'] } } })] }));
    expect(visibleChoiceGrid(e).max).toBe(4);
    expect(visibleChoiceGridProblems(e).join('\n')).toContain('4개가 동시에');
  });

  it('격자 밖 축(플래그 등)의 조건이 걸린 선택지는 최악에서 숨은 것으로 센다', () => {
    const e = one(ev({ id: 'test-flag', conditions: { tailored: true }, choices: [ch('common'), ch('a', { requires: { tailored: true, flags: ['f_set'] } }), ch('b', { effects: { setFlags: ['f_set'] } })] }));
    expect(visibleChoiceGrid(e).min).toBe(2);
  });
});

describe('worstCaseVisibleChoiceIds·maxVisibleChoices가 새 조건을 이해한다', () => {
  it('서로 배타인 기질 선택지는 같이 보이지 않아 정의 5개여도 최악 묶음은 3개다', () => {
    const e = one(ev({ id: 'test-temper', conditions: { tailored: true }, choices: [ch('c1'), ch('c2'), ch('w', { requires: { temper: ['warm'] } }), ch('q', { requires: { temper: ['quiet'] } }), ch('d', { requires: { temper: ['driven'] } })] }));
    expect(worstCaseVisibleChoiceIds(e).length).toBeLessThanOrEqual(3);
    expect(visibleChoiceProblems(e)).toEqual([]);
    expect(visibleChoiceGrid(e).max).toBe(3);
  });
});

describe('기존 사건은 격자 검사 대상이 아니다', () => {
  it('풀의 모든 기존 선택지 사건: 맞춤 조건을 쓰지 않아 격자 문제가 없고, 지금 규칙(조건 없는 선택지 2개 이상 등)은 그대로다', () => {
    for (const e of EVENT_POOL.events) {
      expect(usesPersonaCondition(e), e.id).toBe(false);
      expect(visibleChoiceGridProblems(e), e.id).toEqual([]);
    }
  });
});
