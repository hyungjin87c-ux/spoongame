import { GENERATION_IDS, createInitialState, famSeedOf, generateBirthFromSeed, sceneFamilyOf, sceneInputOf, sceneKey, sceneOf, eraOf, type GameState, type ProfileId } from '../../src/core';
import type { EraBand, EraWindow } from '../../src/core/eraWindow';
import { ERA_DECADE as D1940 } from '../../src/data/eraWindows/d1940';
import { ERA_DECADE as D1950 } from '../../src/data/eraWindows/d1950';
import { ERA_DECADE as D1960 } from '../../src/data/eraWindows/d1960';
import { ERA_DECADE as D1970 } from '../../src/data/eraWindows/d1970';
import { ERA_DECADE as D1980 } from '../../src/data/eraWindows/d1980';
import { ERA_DECADE as D1990 } from '../../src/data/eraWindows/d1990';
import { ERA_DECADE as D2000 } from '../../src/data/eraWindows/d2000';
import { ERA_DECADE as D2010 } from '../../src/data/eraWindows/d2010';
import { ERA_DECADE as D2020 } from '../../src/data/eraWindows/d2020';
import { fnv, spreadSeeds } from './familyGolden';

/**
 * 집 그림(`sceneOf`)과 시대의 창(`eraOf`)의 **고정 시드 골든** (SPEC-009 FM5b, 검수 R-546). 기댓값을 눈으로 읽을 수 있는 짧은 글로 적어 두고(`tests/fixtures/scene-golden.json`),
 * 규칙·표·승인된 데이터가 바뀌면 이 시험이 깨져 「의도한 변경인지」 보게 한다. 같은 입력 → 같은 출력이므로 값은 늘 같아야 한다 — 일부러 바꿀 때만 `npm run golden:scene -- --write`로 다시 만든다(`--write` 없이 돌리면 쓰지 않고 달라진 칸만 알려 준다).
 */

/**
 * 골든이 도는 승인된 사건 33장(SPEC-013: 1940~2025년의 사건 32건 + 1987 가리기 대체 그림 1장) — 1940~2025년에 시작하는 장면뿐이다(출생~2025 골든이라 2026년 이후 장면은 닿지 않는다). 옛 94장(일상 포함)은 SPEC-013이 시대의 창을 사건 해만으로 바꾸며 퇴역했다.
 * 「2025년 이하의 고르기가 바뀌지 않는다」(SPEC-010 완료 기준 10)는 이 골든이 아니라 SPEC-013의 새 규칙이 잰다 — 골든은 새 규칙의 값으로 다시 만들었다(`tests/sceneGolden.test.ts` 머리 주석 「SPEC-013 갱신」). 2026년 이후는 `tests/eraFuture.test.ts`·`tests/eraEvents.test.ts`가 잰다.
 */
export const ALL_ERA_WINDOWS: readonly EraWindow[] = [D1940, D1950, D1960, D1970, D1980, D1990, D2000, D2010, D2020].flatMap((d) => d.windows).filter((w) => w.years[0] <= 2025);

function gameOf(seed: number, gen: ProfileId): GameState {
  const b = generateBirthFromSeed(seed, gen);
  return { ...createInitialState(seed), phase: 'life', generation: gen, character: b.character, birthReport: b.report, peerSeed: b.peerSeed, family: b.family } as GameState;
}
const at = (g: GameState, age: number): GameState => ({ ...g, age, assets: age >= 20 ? { net: 0, income: 0, debt: 0, incomeAdj: 0, dwelling: 'family' } : null }) as GameState;

export const SCENE_GOLDEN_AGES = [0, 4, 9, 15, 22, 35, 50, 68, 85] as const;
export const SCENE_GOLDEN_SEEDS = 3;

/** 장면 골든: `세대/시드/나이` → 「배경|집×크기|식구 수|뒤 소품|앞 소품|반려동물|열쇠 해시」 */
export function sceneGolden(): Record<string, string> {
  const out: Record<string, string> = {};
  GENERATION_IDS.forEach((gen, gi) => {
    for (const seed of spreadSeeds(SCENE_GOLDEN_SEEDS, gi)) {
      const base = gameOf(seed, gen);
      for (const age of SCENE_GOLDEN_AGES) {
        const spec = sceneOf(sceneInputOf(at(base, age)));
        const list = (xs: readonly { id: string }[]): string => xs.map((x) => x.id).join(',');
        out[`${gen}/${seed}/${age}`] = [spec.bg.id, `${spec.house.id}×${spec.house.scale ?? 1}${spec.house.opt?.roof === undefined ? '' : `(${spec.house.opt.roof})`}`, spec.family.length, list(spec.back), list(spec.front), list(spec.pets), fnv(sceneKey(spec))].join('|');
      }
    }
  });
  return out;
}

// ---------------------------------------------------------------- L0F 보강: 성인 플래그를 켠 판 (SPEC-009 K6 직전, REV-009-FM6-1 3절)

/**
 * 위 `sceneGolden()`의 판은 플래그가 없어 배우자·자녀가 그림에 없다. 이 묶음은 혼인·자녀·이혼 플래그와 본 사건의 나이를 고정한 판의 그림 몇 칸을 더해 배우자·자녀 그림을 골든 안에 둔다.
 * **기존 칸(`scene`·`era`)은 한 글자도 바꾸지 않는다** — 새 묶음 `sceneAdult`만 파일 끝에 더한다. 배우자·자녀의 나이·이름·`at`은 저장하지 않고 플래그·`seen`·표에서 다시 계산하므로(`adultSlotsOf`)
 * 그림의 식구와 모양이 그 표를 따라간다 — 표를 바꾸면 이 칸이 달라진다(알아채는 장치, `tests/familyGolden.test.ts`와 한 쌍).
 */
export const SCENE_ADULT_RULE =
  '이 묶음(sceneAdult)은 L0F 가족 골든의 보강이다: 성인 플래그를 켠 판의 그림이다. 이 묶음을 다시 만드는 것은 공개 배포(K6) 뒤에는 이어하던 판의 배우자·자녀 그림이 바뀌는 One-way 변경이다 — 배우자·자녀는 저장하지 않고 플래그·seen·표에서 다시 계산하기 때문이다. ' +
  '그래서 마스터 승인과 형진 님 확인이 필요하고, 성인 식구 표(이름 풀·design.adult·NAME_KEY·성인 플래그를 켜는 사건)를 바꿀 때는 「로드 때 family.ad 스냅샷」을 먼저 한 번 배포한다(SPEC-009 FS2 예외 ③). 다시 만드는 명령은 npm run golden:scene -- --write 한 곳이다(--write 없이 돌리면 쓰지 않고 달라진 칸만 알려 준다. 쓰면 이 파일 전체를 다시 쓰므로 기존 scene·era 칸이 바뀌지 않았는지 git diff로 본다). 시험은 이 파일을 쓰지 않는다.';

export const SCENE_ADULT_SEEDS = 2;
export interface SceneAdultScenario {
  id: string;
  flags: string[];
  /** 사건 id → 본 주인공 나이 (실제 풀의 id를 글자 그대로) */
  seen: Record<string, number>;
  ages: number[];
}
export const SCENE_ADULT_SCENARIOS: readonly SceneAdultScenario[] = [
  { id: 'couple', flags: ['married'], seen: { 'youth-marriage': 27 }, ages: [32] },
  { id: 'family', flags: ['has_child', 'married'], seen: { 'youth-marriage': 26, 'youth-child': 28 }, ages: [30, 40, 55] },
  { id: 'late', flags: ['child_late', 'has_child', 'married'], seen: { 'youth-marriage': 28, 'youth-child': 30, 'youth-child-again': 36 }, ages: [38, 50] },
  { id: 'ex', flags: ['divorced', 'has_child'], seen: { 'youth-marriage': 26, 'youth-child': 28, 'middle-marriage-crisis': 40 }, ages: [42] },
];
/** 파일에 적는 시나리오 설명 한 줄: `id | 플래그 | 본 사건@나이 | 나이들` */
export const sceneAdultScenarioText = (s: SceneAdultScenario): string => `${s.id} | ${s.flags.join(',')} | ${Object.entries(s.seen).map(([id, a]) => `${id}@${a}`).join(',')} | ages ${s.ages.join(',')}`;

/** 성인 플래그 장면 골든: `세대/시드/시나리오/나이` → 「배경|집×크기|식구 수|뒤 소품|앞 소품|반려동물|열쇠 해시|그림에 나온 식구 id|바뀐 종류」. 독립한 어른(월세)이라 부모 집이 아니라 자기 집 모양이다 */
export function sceneAdultGolden(): Record<string, string> {
  const out: Record<string, string> = {};
  GENERATION_IDS.forEach((gen, gi) => {
    for (const seed of spreadSeeds(SCENE_ADULT_SEEDS, gi)) {
      const base = gameOf(seed, gen);
      for (const sc of SCENE_ADULT_SCENARIOS) {
        for (const age of sc.ages) {
          const g = { ...base, age, flags: [...sc.flags].sort(), seen: { ...sc.seen }, assets: { net: 0, income: 0, debt: 0, incomeAdj: 0, dwelling: 'rent' } } as GameState;
          const spec = sceneOf(sceneInputOf(g));
          const state = sceneFamilyOf(g);
          const list = (xs: readonly { id: string }[]): string => xs.map((x) => x.id).join(',');
          out[`${gen}/${seed}/${sc.id}/${age}`] = [spec.bg.id, `${spec.house.id}×${spec.house.scale ?? 1}${spec.house.opt?.roof === undefined ? '' : `(${spec.house.opt.roof})`}`, spec.family.length, list(spec.back), list(spec.front), list(spec.pets), fnv(sceneKey(spec)), list(state.members), state.changed.join(',')].join('|');
        }
      }
    }
  });
  return out;
}

export const ERA_GOLDEN_SEEDS = [11, 4242] as const;
export const ERA_GOLDEN_BANDS: readonly EraBand[] = ['low', 'mid', 'high'];
export const ERA_GOLDEN_BIRTHS = [1944, 1962, 1978, 1984, 1991, 2003] as const;
const WINDOW_IDS: readonly string[] = [...ALL_ERA_WINDOWS].map((w) => w.id).sort();

/** 시대의 창 골든: 시드 × 수저 구간 × 가리기 × 출생 연도마다 출생부터 2025까지 해마다 「그림 번호(00 = 빈 틀) + 가림 표시(. / v)」를 이은 글 */
export function eraGolden(): { ids: string[]; rows: Record<string, string> } {
  const rows: Record<string, string> = {};
  for (const seed of ERA_GOLDEN_SEEDS) {
    for (const band of ERA_GOLDEN_BANDS) {
      for (const gentle of [false, true]) {
        for (const birthYear of ERA_GOLDEN_BIRTHS) {
          let line = '';
          for (let y = birthYear; y <= 2025; y++) {
            const p = eraOf(y, { regionKey: '서울', gentle, seed: famSeedOf(seed), windows: ALL_ERA_WINDOWS, birthYear, band });
            const n = p.pic === null ? 0 : WINDOW_IDS.indexOf(p.pic.id) + 1;
            line += `${String(n).padStart(2, '0')}${p.veiled ? 'v' : '.'}`;
          }
          rows[`${seed}/${band}/${gentle ? 'gentle' : 'plain'}/${birthYear}`] = line;
        }
      }
    }
  }
  return { ids: [...WINDOW_IDS], rows };
}
