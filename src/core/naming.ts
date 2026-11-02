import { isForbiddenFullName } from '../data/forbiddenNames';
import { namePoolKey, type NamePoolId } from '../data/namePoolId';
import { namesApi } from './gameData';
import type { Rng } from './rng';
import type { Gender } from './types';

/**
 * 이름 뽑기 (출생·또래·가족이 함께 쓴다). `core/birth.ts`에 있던 것을 옮겼다 — 또래(`peers.ts`)와 가족(`familyNames.ts`)이 출생(`birth.ts`)과 서로를 부르는 순환을 없애려고(출생이 또래의 이름을 가족 이름이 피할 목록으로 쓴다, SPEC-009 FA0-6).
 * 기존 import 경로(`core/birth`·`core`)는 `birth.ts`가 같은 이름으로 다시 내보내 그대로 동작한다.
 */

// 풀 id·연도 → 풀은 data/names.ts(namePoolIdOf·namePoolFor — SPEC-004 NR4)가 하되, 이름 풀 JSON은 「태어나기」 뒤의 지연 덩어리에 있다(R-520) — 여기서는 `core/gameData.ts`가 놓은 것을 부른다.
// 기존 import 경로(`core/birth`·`core`)가 그대로 동작하게 같은 이름으로 다시 내보낸다. 데이터가 놓이기 전에 부르면 throw한다(다른 지연 데이터와 같다).
export { namePoolKey, type NamePoolId };

/** 출생 연도 → 이름 풀 id (풀이 없는 연도는 throw) */
export function namePoolIdOf(birthYear: number): NamePoolId {
  return namesApi().namePoolIdOf(birthYear);
}

/** 출생 연도·성별에 맞는 이름(성 제외) 풀. 읽기 전용. */
export function namePoolFor(birthYear: number, gender: Gender): readonly string[] {
  return namesApi().namePoolFor(birthYear, gender);
}

/** 성씨별 가중치: 인구수에 비례 */
export function surnameWeights(): { name: string; weight: number }[] {
  return namesApi().surnames.map((s) => ({ name: s.name, weight: s.populationThousands }));
}

/** 이름이 걸렸을 때 같은 풀에서 이름을 다시 뽑는 최대 횟수. 넘으면 풀에서 안 걸리는 첫 이름으로 대체한다. */
export const MAX_NAME_REDRAWS = 8;

/**
 * 이 성+이름 조합을 쓰면 안 되는가 (내부 필터, 플레이어에게 보이지 않는다). 두 가지가 같은 필터로 걸린다.
 *  1) 금지 목록(민감한 실존 인물, R-023·R-028) — 성+이름 전체가 같을 때
 *  2) 성과 이름의 첫 글자가 같은 조합(이이준·윤윤서·정정우 등, R-027) — 어색해 보이는 조합이라 다시 뽑는다
 */
export function isRejectedName(surname: string, given: string): boolean {
  return isForbiddenFullName(surname + given) || (given.length > 0 && given[0] === surname);
}

/**
 * 성+이름을 뽑는다. 성씨는 인구수 가중 랜덤, 이름은 출생 연도·성별 풀에서 균등 랜덤.
 * isRejectedName에 걸리면 **이름만** 같은 풀에서 다시 뽑는다(성씨 분포는 건드리지 않는다).
 * 다시 뽑기는 같은 RNG에서 이어 뽑으므로 결정적이고, MAX_NAME_REDRAWS번 뒤에도 걸리면
 * 풀에서 걸리지 않는 첫 이름을 쓴다(무한 루프 없음).
 */
export function pickFullName(rng: Rng, birthYear: number, gender: Gender): string {
  const pool = namePoolFor(birthYear, gender);
  const surnames = surnameWeights();
  const surname = surnames[rng.weightedIndex(surnames.map((s) => s.weight))].name;
  let given = rng.pick(pool);
  for (let tries = 0; tries < MAX_NAME_REDRAWS && isRejectedName(surname, given); tries++) {
    given = rng.pick(pool);
  }
  if (isRejectedName(surname, given)) {
    const safe = pool.find((g) => !isRejectedName(surname, g));
    if (safe === undefined) throw new Error(`pickFullName: ${surname} 성에 쓸 수 있는 이름이 풀에 없다`);
    given = safe;
  }
  return surname + given;
}
