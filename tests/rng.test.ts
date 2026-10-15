import { describe, expect, it } from 'vitest';
import {
  beginBirth,
  createInitialState,
  createRng,
  generateBirth,
  loadGame,
  saveGame,
  type StorageLike,
} from '../src/core';

function memoryStorage(): StorageLike {
  const m = new Map<string, string>();
  return {
    getItem: (k) => m.get(k) ?? null,
    setItem: (k, v) => void m.set(k, v),
    removeItem: (k) => void m.delete(k),
  };
}

describe('RNG', () => {
  it('같은 시드는 같은 수열', () => {
    const a = createRng(12345);
    const b = createRng(12345);
    const seqA = Array.from({ length: 50 }, () => a.next());
    const seqB = Array.from({ length: 50 }, () => b.next());
    expect(seqA).toEqual(seqB);
  });

  it('다른 시드는 다른 수열', () => {
    expect(createRng(1).next()).not.toBe(createRng(2).next());
  });

  it('값은 [0,1) 범위이고 int는 [min,max] 범위', () => {
    const r = createRng(7);
    for (let i = 0; i < 1000; i++) {
      const v = r.next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
      const n = r.int(3, 6);
      expect(n).toBeGreaterThanOrEqual(3);
      expect(n).toBeLessThanOrEqual(6);
    }
  });

  it('저장 후 복원해도 수열이 이어진다 (출생이 난수를 실제로 소비하고, 복원한 RNG가 끊김 없이 이어 쓴 RNG와 같다)', () => {
    const storage = memoryStorage();
    const before = createInitialState(999);

    // 기준: 같은 시드의 RNG로 출생 추첨을 직접 한 번 돌린 뒤 이어서 계속 쓰는 RNG
    const continuous = createRng(before.rngState);
    generateBirth(continuous, 'past');

    const born = beginBirth(before, 'past');
    // 출생이 난수를 소비해 상태가 전진했다 (시드 그대로가 아니다)
    expect(born.rngState).not.toBe(before.rngState);
    expect(born.rngState).toBe(continuous.getState());

    // 저장 → 복원: 상태가 그대로 돌아오고, 복원한 RNG의 이후 수열이 끊김 없이 이어 쓴 RNG와 같다
    saveGame(storage, born);
    const restored = loadGame(storage)!;
    expect(restored.rngState).toBe(born.rngState);
    const resumed = createRng(restored.rngState);
    const next10 = Array.from({ length: 10 }, () => resumed.next());
    expect(next10).toEqual(Array.from({ length: 10 }, () => continuous.next()));

    // 판별력: 상태를 복원하지 않고 시드부터 다시 시작하면 수열이 다르다
    const fromSeed = createRng(before.seed);
    expect(Array.from({ length: 10 }, () => fromSeed.next())).not.toEqual(next10);
  });

  it('beginBirth는 rngState를 전진시킨다 (시대별로 모두)', () => {
    for (const era of ['past', 'present', 'future'] as const) {
      const before = createInitialState(31);
      const after = beginBirth(before, era);
      expect(after.rngState, era).not.toBe(before.rngState);
      expect(after.seed, era).toBe(before.seed); // 시드는 그대로, 진행 상태만 전진
      expect(createRng(after.rngState).next(), era).not.toBe(createRng(before.rngState).next());
    }
  });

  it('상태에서 만든 RNG는 원본의 다음 수열과 같다', () => {
    const a = createRng(42);
    a.next();
    a.next();
    const b = createRng(a.getState());
    expect(b.next()).toBe(a.next());
  });
});

describe('RNG 인자 검증 (R-002)', () => {
  it('int: min>max, 비정수, NaN/Infinity는 throw', () => {
    const r = createRng(1);
    expect(() => r.int(5, 1)).toThrow();
    expect(() => r.int(1.5, 3)).toThrow();
    expect(() => r.int(1, 3.5)).toThrow();
    expect(() => r.int(NaN, 3)).toThrow();
    expect(() => r.int(1, NaN)).toThrow();
    expect(() => r.int(0, Infinity)).toThrow();
    expect(() => r.int(-Infinity, 0)).toThrow();
  });

  it('int: min===max는 허용, 잘못된 호출은 RNG 상태를 소비하지 않는다', () => {
    const r = createRng(1);
    const before = r.getState();
    expect(() => r.int(2, 1)).toThrow();
    expect(r.getState()).toBe(before);
    expect(r.int(4, 4)).toBe(4);
  });

  it('weightedIndex: 잘못된 가중치는 throw, 0 가중치는 절대 안 뽑힌다', () => {
    const r = createRng(3);
    expect(() => r.weightedIndex([])).toThrow();
    expect(() => r.weightedIndex([0, 0])).toThrow();
    expect(() => r.weightedIndex([1, -1])).toThrow();
    expect(() => r.weightedIndex([1, NaN])).toThrow();
    for (let i = 0; i < 500; i++) expect(r.weightedIndex([0, 5, 0, 1])).not.toBe(0);
  });
});
