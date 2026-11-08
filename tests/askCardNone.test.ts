import { describe, expect, it, vi } from 'vitest';
import '../src/data/installAll';
import { askCloseness, askGrantChance } from '../src/core';
import { ASK_BASE } from '../src/data/askTable';
import { startLife } from '../scripts/simulateLib';
import { askEvent } from './helpers/askEvents';

/**
 * 함께 사는 부모가 「없음」(`coParentsOf` = `'none'`)인 방어 분기 (SPEC-011 AK3, 설계 문서 2-2절 「없으면 `C = 3`」).
 * 실제 가족 계획에서는 구조상 도달하지 않는다(INV-2c · R-558 — tests/parentSubject.test.ts가 7000판에서 0건을 단언한다). 그래서 `coParentsOf`를 가짜로 바꿔 이 분기만 따로 본다.
 * 가짜는 이 파일에만 걸린다(vitest는 파일마다 모듈을 따로 둔다).
 */
vi.mock('../src/core/parentSubject', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/core/parentSubject')>();
  return { ...actual, coParentsOf: () => 'none' as const };
});

describe('AK3 함께 사는 부모가 없으면 사이 C = 3 (방어 분기)', () => {
  const s = { ...startLife(11, 'genx'), age: 7 };
  const state = { ...s, pending: { eventId: 'ask-toy-x', key: 'ask-toy-x@7', age: 7, choiceIds: ['beg', 'tantrum', 'endure'] } };

  it('askCloseness는 3이고, p는 BASE 그대로다 (조르기) · +0.10 (떼쓰기)', () => {
    expect(askCloseness(state)).toBe(3);
    for (const w of [1, 2, 3, 4, 5] as const) {
      const st = { ...state, character: { ...state.character!, parentWealth: w } };
      expect(askGrantChance(st, askEvent('ask-toy-x', 'toy'), 'beg')).toBeCloseTo(ASK_BASE.toy[w - 1], 12);
      expect(askGrantChance(st, askEvent('ask-toy-x', 'toy'), 'tantrum')).toBeCloseTo(Math.min(0.95, ASK_BASE.toy[w - 1] + 0.1), 12);
    }
  });
});
