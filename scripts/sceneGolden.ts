import { writeFileSync } from 'node:fs';
import { ERA_GOLDEN_BANDS, ERA_GOLDEN_BIRTHS, ERA_GOLDEN_SEEDS, SCENE_GOLDEN_AGES, SCENE_GOLDEN_SEEDS, eraGolden, sceneGolden } from '../tests/helpers/sceneGolden';

/**
 * 집 그림·시대의 창 고정 시드 골든 만들기 (SPEC-009 FM5b, R-546): `tests/fixtures/scene-golden.json`을 다시 쓴다. 규칙·표·승인된 데이터를 **일부러** 바꿀 때만 돌리고, 바뀐 글을 눈으로 확인한 뒤 함께 커밋한다.
 * 실행: `npm run golden:scene`. 시험은 `tests/sceneGolden.test.ts`.
 */
const scene = sceneGolden();
const era = eraGolden();
const meta = {
  note: '집 그림(sceneOf)과 시대의 창(eraOf)의 고정 시드 골든 — scripts/sceneGolden.ts가 만든다. 일부러 규칙을 바꿀 때만 다시 만든다.',
  sceneSeeds: SCENE_GOLDEN_SEEDS,
  sceneAges: [...SCENE_GOLDEN_AGES],
  eraSeeds: [...ERA_GOLDEN_SEEDS],
  eraBands: [...ERA_GOLDEN_BANDS],
  eraBirths: [...ERA_GOLDEN_BIRTHS],
};
writeFileSync('tests/fixtures/scene-golden.json', JSON.stringify({ ...meta, scene, eraIds: era.ids, era: era.rows }, null, 1) + '\n', 'utf-8');
console.log(`scene-golden.json: 장면 ${Object.keys(scene).length}행, 시대의 창 ${Object.keys(era.rows).length}행`);
