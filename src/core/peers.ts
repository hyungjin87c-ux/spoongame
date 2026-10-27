import { regionsOf, sigunguChoices } from '../data/birthStats';
import { pickFullName } from './birth';
import { wealthFor } from './generationMixture';
import { createRng, mixSeed, type Rng } from './rng';
import { GENDERS, PARENT_WEALTHS, type Gender, type ParentWealth } from './types';

/**
 * 같은 해 태어난 사람들 (SPEC-003 VP3). `peersOf(시드, 출생 연월)`는 결정적 순수 함수라 같은 시드는 새로고침해도 같은 인물이다(상태에는 시드만 저장한다).
 * 이름은 그 출생 연도·성별의 이름 풀에서(NR4), 성씨는 인구 가중, 금지 이름 필터는 주인공과 같은 함수(pickFullName)를 쓴다.
 * 지역은 룰렛 지역 확률(RL)과 같은 가중으로, 시군구는 출생신고와 같은 규칙으로(시험 전용 2026년생만 — 세대 판은 시도까지), 수저는 그 출생 연도의 수저 비율(`wealthFor`, N29)로 정한다. 서로 이름이 겹치지 않는다(주인공과도).
 */

export const PEER_COUNT = 4;

export interface Peer {
  name: string;
  gender: Gender;
  /** 룰렛 지역(시·도 줄임 이름) */
  region: string;
  /** 시군구는 시험 전용 R1 프로필(2026년생)만 있다 — 세대 판의 또래는 시도까지 */
  sigunguSido?: string;
  sigungu?: string;
  wealth: ParentWealth;
}

/** 이름이 겹칠 때 다시 뽑는 최대 횟수. 넘으면 풀에서 안 겹치는 첫 이름으로 정한다(무한 루프 없음). */
const MAX_NAME_TRIES = 40;

function uniqueName(rng: Rng, birthYear: number, gender: Gender, used: ReadonlySet<string>): string {
  for (let k = 0; k < MAX_NAME_TRIES; k++) {
    const name = pickFullName(rng, birthYear, gender);
    if (!used.has(name)) return name;
  }
  // 아주 드문 경우(풀이 작아 겹침이 잦은 조합): 같은 방식으로 더 많이 시도한다. 그래도 못 찾으면 throw — 겹치는 이름을 조용히 내보내지 않는다.
  for (let k = 0; k < 400; k++) {
    const name = pickFullName(rng, birthYear, gender);
    if (!used.has(name)) return name;
  }
  throw new Error(`uniqueName: 겹치지 않는 이름을 찾지 못했다 (${birthYear}년 ${gender})`);
}

/**
 * 같은 해 태어난 사람 4명. peerSeed는 출생 때 정해져 상태에 저장된 시드(GameState.peerSeed), avoidName은 주인공 이름(겹치지 않게).
 * 출생 연월은 시드에 섞여 같은 시드라도 연월이 다르면 다른 인물이 나온다(연월이 같은 판에서는 새로고침해도 같다).
 */
export function peersOf(peerSeed: number, birthYear: number, birthMonth: number, avoidName: string | null = null): Peer[] {
  if (!Number.isInteger(birthMonth) || birthMonth < 1 || birthMonth > 12) throw new RangeError(`peersOf: 출생 월이 1~12가 아니다 (${birthMonth})`);
  const rng = createRng(mixSeed(peerSeed, birthYear * 12 + birthMonth));
  const regions = regionsOf(birthYear).regions;
  const used = new Set<string>(avoidName === null ? [] : [avoidName]);
  const out: Peer[] = [];
  for (let i = 0; i < PEER_COUNT; i++) {
    const gender = GENDERS[rng.int(0, GENDERS.length - 1)];
    const name = uniqueName(rng, birthYear, gender, used);
    used.add(name);
    const region = regions[rng.weightedIndex(regions.map((r) => r.sharePct))].name;
    const place = birthYear >= 2026 ? ((choices) => choices[rng.weightedIndex(choices.map((c) => c.births))])(sigunguChoices(birthYear, region)) : null;
    const wealth = PARENT_WEALTHS[rng.weightedIndex(wealthFor(birthYear))];
    out.push({ name, gender, region, ...(place === null ? {} : { sigunguSido: place.sido, sigungu: place.name }), wealth });
  }
  return out;
}
