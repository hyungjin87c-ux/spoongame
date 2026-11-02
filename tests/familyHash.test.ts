import { describe, expect, it } from 'vitest';
import birthGolden from './fixtures/birth-golden.json';
import lifeGolden from './fixtures/life-golden.json';
import { GENERATION_IDS, L0_SEEDS, L1_SEEDS, L1_STRATEGIES, fnv, goldenSeeds, l0Hash, l0Projection, l1Hash } from './helpers/familyGolden';
import { preFm4bPool } from '../scripts/preFm4bPool';
import { withEarlyLoss } from '../scripts/familyRulesLib';

/**
 * 가족 모델의 해시 불변 시험 (SPEC-009 FM4a, docs/data/family-model.md 12-1절 — 세 층 중 L0·L1):
 *  - L0 출생: `generateBirth`의 character·stats·report·peerSeed·`rngState`가 가족 모델을 넣기 **전**의 코드로 만든 골든 해시(`tests/fixtures/birth-golden.json`)와 100% 같다 —
 *    가족 추첨이 기존 난수 흐름을 흔들지 않는다(`peerSeed`에서 파생한 독립 스트림, 진행 RNG를 쓰지 않는다).
 *  - L1 기록 전용: 한 판을 끝까지 돌린 뒤의 스탯·자산·집안 살림·플래그(가족 시스템 플래그 제외)·엔딩 판정·진행 RNG 상태·인생 기록(`fam-` 줄 제외)이 골든(`life-golden.json`)과 100% 같다 —
 *    FM4a는 인생 진행(stepYear)·사건 풀·상속의 형제 수 규칙을 건드리지 않는다.
 * 골든은 `scripts/familyGolden.ts`가 변경 전 코드로 한 번 만들었다 — 커밋 44d7a10의 별도 worktree에서 `tests/helpers/familyGolden.ts`·`scripts/familyGolden.ts`만 복사해 다시 돌린 출력이 두 골든 파일과 바이트 단위로 같음을 확인했다(R-535, ai-log `2026-10-28_SPEC-009_dev-FM4a-r2`).
 * 「진행 RNG를 쓰지 않는다」는 L0 골든(rngState 포함)이 정본이다 — 같은 입력을 두 번 넣어 비교하는 시험은 동어반복이라 두지 않는다. L2(사건 변경·이른 부모 별세 효과 뒤의 분포)는 FM4b의 몫이다.
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
});

describe('L1 기록 전용 해시 불변 (7세대 × 2전략 × 40판)', () => {
  it('골든 파일은 이 시험의 표본과 같은 크기로 만들어졌다', () => {
    expect(lifeGolden.seeds.l1).toBe(L1_SEEDS);
    expect(lifeGolden.strategies).toEqual([...L1_STRATEGIES]);
  });

  for (const gen of GENERATION_IDS) {
    for (const strategy of L1_STRATEGIES) {
      // FM4b(SPEC-009 A-3, 12-1절): 사건 풀을 바꾸는 K2·K4와 이른 부모 별세 효과는 L1의 대상이 아니다 — 그 셋을 **끈 세계**(FM4b 전 영유아·학창 이벤트 파일 + 효과 끔 + 형제 수 옛 규칙)에서 같은 시드를 돌려,
      // 새로 더해진 것(가족 변화 줄 `fam-…`·시스템 플래그·`family.log`·`familyChangesFor` 호출)이 진행 RNG·스탯·자산·플래그·엔딩을 한 글자도 바꾸지 않음(기록 전용)을 변경 전 골든과 대조한다.
      it(`${gen} / ${strategy}: (K2·K4·이른 별세 효과를 끈 세계) 스탯·자산·플래그·엔딩 판정·진행 RNG·인생 기록이 골든과 같다`, { timeout: 120_000 }, () => {
        const golden = (lifeGolden.cells as Record<string, string>)[`${gen}/${strategy}`];
        expect(withEarlyLoss(false, () => l1Hash(gen, strategy, goldenSeeds(L1_SEEDS), preFm4bPool()))).toBe(golden);
      });
    }
  }
});
