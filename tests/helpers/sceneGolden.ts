import { GENERATION_IDS, createInitialState, famSeedOf, generateBirthFromSeed, sceneInputOf, sceneKey, sceneOf, eraOf, type GameState, type ProfileId } from '../../src/core';
import type { EraBand, EraWindow } from '../../src/core/eraWindow';
import { ERA_DECADE as D1940 } from '../../src/data/eraWindows/d1940';
import { ERA_DECADE as D1950 } from '../../src/data/eraWindows/d1950';
import { ERA_DECADE as D1960 } from '../../src/data/eraWindows/d1960';
import { ERA_DECADE as D1970 } from '../../src/data/eraWindows/d1970';
import { ERA_DECADE as D1980 } from '../../src/data/eraWindows/d1980';
import { ERA_DECADE as D1990 } from '../../src/data/eraWindows/d1990';
import { fnv, spreadSeeds } from './familyGolden';

/**
 * 집 그림(`sceneOf`)과 시대의 창(`eraOf`)의 **고정 시드 골든** (SPEC-009 FM5b, 검수 R-546). 기댓값을 눈으로 읽을 수 있는 짧은 글로 적어 두고(`tests/fixtures/scene-golden.json`),
 * 규칙·표·승인된 데이터가 바뀌면 이 시험이 깨져 「의도한 변경인지」 보게 한다. 같은 입력 → 같은 출력이므로 값은 늘 같아야 한다 — 일부러 바꿀 때만 `npm run golden:scene`으로 다시 만든다.
 */

export const ALL_ERA_WINDOWS: readonly EraWindow[] = [D1940, D1950, D1960, D1970, D1980, D1990].flatMap((d) => d.windows);

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
