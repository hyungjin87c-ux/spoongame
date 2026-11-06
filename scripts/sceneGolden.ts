import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { ERA_GOLDEN_BANDS, ERA_GOLDEN_BIRTHS, ERA_GOLDEN_SEEDS, SCENE_ADULT_RULE, SCENE_ADULT_SCENARIOS, SCENE_ADULT_SEEDS, SCENE_GOLDEN_AGES, SCENE_GOLDEN_SEEDS, eraGolden, sceneAdultGolden, sceneAdultScenarioText, sceneGolden } from '../tests/helpers/sceneGolden';

/**
 * 집 그림·시대의 창 고정 시드 골든 만들기 (SPEC-009 FM5b, R-546): `tests/fixtures/scene-golden.json`을 쓰는 **유일한 곳**이다 — 시험은 이 파일을 쓰지 않는다. 규칙·표·승인된 데이터를 **일부러** 바꿀 때만 쓰고, 바뀐 글을 눈으로 확인한 뒤 함께 커밋한다.
 *
 *   npm run golden:scene              지금 코드의 값과 골든을 견주어 달라진 칸만 알려 준다(쓰지 않는다 · 달라졌으면 종료 코드 1)
 *   npm run golden:scene -- --write   골든을 지금 코드의 값으로 다시 쓴다
 *
 * (L0F, SPEC-009 K6 직전: `golden:family`와 같은 규칙으로 맞췄다 — 이전에는 돌리면 바로 다시 썼다.) 시험은 `tests/sceneGolden.test.ts`.
 * L0F 보강: 파일 끝의 `sceneAdult`(성인 플래그를 켠 판의 그림)는 **공개 배포 뒤에 다시 만들면 One-way**다 — 마스터 승인·형진 님 확인이 먼저(`noteAdult`, 갱신 규칙 전문은 `tests/sceneGolden.test.ts` 머리 주석).
 */
const PATH = 'tests/fixtures/scene-golden.json';
const args = process.argv.slice(2);

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
// 새 묶음은 파일 끝에만 더한다 — 위 키와 그 값은 L0F 보강 앞의 파일과 같다
const adult = {
  noteAdult: SCENE_ADULT_RULE,
  sceneAdultSeeds: SCENE_ADULT_SEEDS,
  sceneAdultScenarios: SCENE_ADULT_SCENARIOS.map(sceneAdultScenarioText),
  sceneAdult: sceneAdultGolden(),
};
const next = { ...meta, scene, eraIds: era.ids, era: era.rows, ...adult };
const text = JSON.stringify(next, null, 1) + '\n';
const current = existsSync(PATH) ? readFileSync(PATH, 'utf-8') : null;

if (current === text) {
  console.log('골든과 지금 코드의 값이 같다 — 달라진 칸 없음');
  process.exit(0);
}

if (args.includes('--write')) {
  writeFileSync(PATH, text, 'utf-8');
  console.log(`scene-golden.json: 장면 ${Object.keys(scene).length}행, 시대의 창 ${Object.keys(era.rows).length}행, 성인 플래그 장면 ${Object.keys(adult.sceneAdult).length}행`);
  console.log('주의: 공개 배포 뒤라면 sceneAdult는 이어하던 판의 배우자·자녀 그림이 바뀌는 One-way 변경이다 — 마스터 승인·형진 님 확인이 있었는가? 기존 scene·era 칸이 의도한 만큼만 바뀌었는지 git diff로 본다.');
  process.exit(0);
}

// 쓰지 않는다: 달라진 칸만 알려 준다
type Json = Record<string, unknown>;
const META_KEYS = ['note', 'noteAdult', 'sceneSeeds', 'sceneAges', 'eraSeeds', 'eraBands', 'eraBirths', 'eraIds', 'sceneAdultSeeds', 'sceneAdultScenarios'];
function cellsOf(o: Json): Map<string, string> {
  const m = new Map<string, string>();
  for (const section of ['scene', 'era', 'sceneAdult']) for (const [k, v] of Object.entries((o[section] ?? {}) as Record<string, string>)) m.set(`${section}/${k}`, v);
  for (const k of META_KEYS) m.set(`meta/${k}`, JSON.stringify(o[k]));
  return m;
}
let before: Json | null = null;
try {
  before = current === null ? null : (JSON.parse(current) as Json);
} catch {
  before = null;
}
if (before === null) {
  console.error('골든 파일이 없거나 읽을 수 없다. 처음 만드는 것이라면 --write.');
} else {
  const a = cellsOf(before);
  const b = cellsOf(next as unknown as Json);
  const keys = [...new Set([...a.keys(), ...b.keys()])];
  const diff = keys.filter((k) => a.get(k) !== b.get(k));
  console.error(`달라진 칸 ${diff.length}개 (전체 ${keys.length}칸) — 앞 20개:`);
  for (const k of diff.slice(0, 20)) console.error(`  ${k}\n    골든 ${a.get(k) ?? '(없음)'}\n    지금 ${b.get(k) ?? '(없음)'}`);
  if (diff.length === 0) console.error('칸 값은 같고 파일의 글(줄 모양)만 다르다.');
}
console.error('쓰지 않았다. 의도한 변경이고 승인을 받았다면: npm run golden:scene -- --write');
process.exit(1);
