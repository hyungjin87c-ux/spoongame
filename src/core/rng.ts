/**
 * 시드 기반 RNG (mulberry32). 상태는 uint32 숫자 하나라서 저장/복원이 쉽다.
 * 순수 함수 `nextRandom`이 핵심이고, `Rng`는 편의 래퍼.
 */

export function toUint32(n: number): number {
  return n >>> 0;
}

/** 상태를 받아 [0,1) 난수와 다음 상태를 돌려준다. */
export function nextRandom(state: number): { value: number; state: number } {
  const s = (toUint32(state) + 0x6d2b79f5) >>> 0;
  let t = s;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  const value = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  return { value, state: s };
}

/**
 * 두 uint32를 섞어 새 uint32를 만든다 (murmur3의 마무리 단계). 부모 RNG의 현재 상태에서 **부모를 전진시키지 않고** 갈래(fork) RNG의 시드를 만드는 데 쓴다.
 * 정수 연산뿐이라 같은 입력 → 같은 출력이고 환경에 따라 달라지지 않는다.
 */
export function mixSeed(a: number, b: number): number {
  let h = (toUint32(a) ^ Math.imul(toUint32(b), 0x9e3779b1)) >>> 0;
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
}

export interface Rng {
  /** [0,1) */
  next(): number;
  /** [min, max] 정수 */
  int(min: number, max: number): number;
  pick<T>(items: readonly T[]): T;
  /** 가중치에 비례해 인덱스를 뽑는다. 가중치는 0 이상 유한수, 합은 양수여야 한다. */
  weightedIndex(weights: readonly number[]): number;
  /** 현재 내부 상태 (저장용) */
  getState(): number;
}

/**
 * 부모 RNG의 **현재 상태**에서 갈라져 나온 RNG. 부모를 전진시키지 않는다(부모의 이후 수열은 갈래를 만들든 안 만들든 같다) — 출생신고 상세(core/birthReport.ts)처럼
 * 인생 진행의 난수 수열(rngState)과 분포표(finalDistribution)를 건드리지 않아야 하는 추첨에 쓴다. salt가 다르면 서로 다른 수열이다.
 */
export function forkRng(rng: Rng, salt: number): Rng {
  return createRng(mixSeed(rng.getState(), salt));
}

/** 저장된 상태(또는 시드)에서 RNG를 만든다. 같은 상태 → 같은 이후 수열. */
export function createRng(state: number): Rng {
  let s = toUint32(state);
  const next = () => {
    const r = nextRandom(s);
    s = r.state;
    return r.value;
  };
  return {
    next,
    int(min, max) {
      if (!Number.isInteger(min) || !Number.isInteger(max)) {
        throw new Error(`int: 정수가 아닌 인자 (${min}, ${max})`);
      }
      if (min > max) throw new Error(`int: min이 max보다 크다 (${min} > ${max})`);
      return min + Math.floor(next() * (max - min + 1));
    },
    pick(items) {
      if (items.length === 0) throw new Error('pick: empty list');
      return items[Math.floor(next() * items.length)];
    },
    weightedIndex(weights) {
      if (weights.length === 0 || weights.some((w) => !Number.isFinite(w) || w < 0)) {
        throw new Error('weightedIndex: 잘못된 가중치');
      }
      const total = weights.reduce((a, b) => a + b, 0);
      if (!(total > 0)) throw new Error('weightedIndex: 가중치 합이 0');
      let r = next() * total;
      for (let i = 0; i < weights.length; i++) {
        r -= weights[i];
        if (r < 0) return i;
      }
      return weights.length - 1;
    },
    getState: () => s,
  };
}
