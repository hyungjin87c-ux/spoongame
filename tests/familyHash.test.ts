import { describe, expect, it } from 'vitest';
import birthGolden from './fixtures/birth-golden.json';
import lifeGolden from './fixtures/life-golden.json';
import { GENERATION_IDS, L0_SEEDS, L1_SEEDS, L1_STRATEGIES, fnv, goldenSeeds, l0Hash, l0Projection, l1Hash } from './helpers/familyGolden';
import { generateBirthFromSeed } from '../src/core';

/**
 * 가족 모델의 해시 불변 시험 (SPEC-009 FM4a, docs/data/family-model.md 12-1절 — 세 층 중 L0·L1):
 *  - L0 출생: `generateBirth`의 character·stats·report·peerSeed·`rngState`가 가족 모델을 넣기 **전**의 코드로 만든 골든 해시(`tests/fixtures/birth-golden.json`)와 100% 같다 —
 *    가족 추첨이 기존 난수 흐름을 흔들지 않는다(`peerSeed`에서 파생한 독립 스트림, 진행 RNG를 쓰지 않는다).
 *  - L1 기록 전용: 한 판을 끝까지 돌린 뒤의 스탯·자산·집안 살림·플래그(가족 시스템 플래그 제외)·엔딩 판정·진행 RNG 상태·인생 기록(`fam-` 줄 제외)이 골든(`life-golden.json`)과 100% 같다 —
 *    FM4a는 인생 진행(stepYear)·사건 풀·상속의 형제 수 규칙을 건드리지 않는다.
 * 골든은 `scripts/familyGolden.ts`가 변경 전 코드로 한 번 만들었다. L2(사건 변경·이른 부모 별세 효과 뒤의 분포)는 FM4b의 몫이다.
 */

describe('L0 출생 해시 불변 (7세대 × 1000판)', () => {
  it('골든 파일은 이 시험의 표본과 같은 크기로 만들어졌다', () => {
    expect(birthGolden.seeds.l0).toBe(L0_SEEDS);
    expect(Object.keys(birthGolden.generations)).toEqual([...GENERATION_IDS]);
  });

  for (const gen of GENERATION_IDS) {
    it(`${gen}: character·stats·report·peerSeed·rngState의 해시가 골든과 같다`, () => {
      const golden = (birthGolden.generations as Record<string, { hash: string; first: string[] }>)[gen];
      const seeds = goldenSeeds(L0_SEEDS);
      // 앞쪽 몇 판은 판별 해시를 따로 둬서 어긋났을 때 어느 판부터인지 알 수 있다
      golden.first.forEach((h, i) => expect(fnv(l0Projection(seeds[i], gen)), `${gen} 시드 ${seeds[i]}`).toBe(h));
      expect(l0Hash(gen, seeds)).toBe(golden.hash);
    });
  }

  it('가족 추첨은 진행 RNG(rngState)를 쓰지 않는다: 같은 시드의 출생 결과에서 rngState는 family 필드를 빼도 그대로고, family는 매번 같다', () => {
    for (const gen of GENERATION_IDS) {
      const a = generateBirthFromSeed(7, gen);
      const b = generateBirthFromSeed(7, gen);
      expect(a.family).toEqual(b.family);
      expect(a.rngState).toBe(b.rngState);
    }
  });
});

describe('L1 기록 전용 해시 불변 (7세대 × 2전략 × 40판)', () => {
  it('골든 파일은 이 시험의 표본과 같은 크기로 만들어졌다', () => {
    expect(lifeGolden.seeds.l1).toBe(L1_SEEDS);
    expect(lifeGolden.strategies).toEqual([...L1_STRATEGIES]);
  });

  for (const gen of GENERATION_IDS) {
    for (const strategy of L1_STRATEGIES) {
      it(`${gen} / ${strategy}: 스탯·자산·플래그·엔딩 판정·진행 RNG·인생 기록이 골든과 같다`, { timeout: 120_000 }, () => {
        const golden = (lifeGolden.cells as Record<string, string>)[`${gen}/${strategy}`];
        expect(l1Hash(gen, strategy, goldenSeeds(L1_SEEDS))).toBe(golden);
      });
    }
  }
});
