import { writeFileSync } from 'node:fs';
import { GENERATION_IDS } from '../src/core';
import { L0_SEEDS, L1_SEEDS, L1_STRATEGIES, goldenSeeds, l0Hash, l0Projection, l1Hash, fnv } from '../tests/helpers/familyGolden';

/**
 * SPEC-009 FM4a 골든 해시 만들기 (docs/data/family-model.md 12-1절 L0·L1). **가족 모델을 넣기 전의 코드**에서 한 번 돌려 `tests/fixtures/birth-golden.json`·`life-golden.json`을 만든다.
 * 다시 돌리면 골든이 지금 코드로 덮여 시험의 뜻이 없어진다 — 출생·인생 진행의 규칙을 일부러 바꿀 때만(그리고 마스터 승인 뒤에) 쓴다.
 * 실행: ./node_modules/.bin/vite-node scripts/familyGolden.ts
 */
const L0: Record<string, { hash: string; first: string[] }> = {};
for (const gen of GENERATION_IDS) {
  const seeds = goldenSeeds(L0_SEEDS);
  L0[gen] = { hash: l0Hash(gen, seeds), first: seeds.slice(0, 8).map((s) => fnv(l0Projection(s, gen))) };
}
const L1: Record<string, string> = {};
for (const gen of GENERATION_IDS) for (const strategy of L1_STRATEGIES) L1[`${gen}/${strategy}`] = l1Hash(gen, strategy, goldenSeeds(L1_SEEDS));
const meta = { note: 'SPEC-009 FM4a 이전 코드로 만든 골든 해시 (scripts/familyGolden.ts)', seeds: { l0: L0_SEEDS, l1: L1_SEEDS }, step: 37 };
writeFileSync('tests/fixtures/birth-golden.json', JSON.stringify({ ...meta, generations: L0 }, null, 2) + '\n', 'utf-8');
writeFileSync('tests/fixtures/life-golden.json', JSON.stringify({ ...meta, strategies: [...L1_STRATEGIES], cells: L1 }, null, 2) + '\n', 'utf-8');
console.log('골든 해시를 썼다:', Object.keys(L0).length, '세대,', Object.keys(L1).length, '칸');
