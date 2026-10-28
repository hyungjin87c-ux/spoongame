import { FAMILY_SALT } from './familyModel';
import { createRng, mixSeed, type Rng } from './rng';

/**
 * 가족 난수 (설계 문서 1-2절, D-1): 출생 때 뽑는 값은 `forkRng`가 아니라 **`peerSeed`에서 파생한 태그별 독립 스트림**으로 뽑는다.
 *  - `peerSeed`는 출생 생성기가 이미 만들어 저장하는 값(`mixSeed(rng.getState(), PEER_SALT)`)이라 진행 RNG(`rngState`)를 전진시키지 않는다 — L0 해시가 그대로다.
 *  - `forkRng`와 달리 **저장된 판에서 같은 값을 다시 만들 수 있다**(저장에서 `family`가 빠져도 `ensureFamily`가 같은 값을 채운다).
 *  - 하위 추첨마다 스트림이 달라 표가 늘거나 한 추첨이 늘고 줄어도 다른 값이 밀리지 않는다.
 * 해마다의 판정은 `famHash01`로 한다(진행 RNG를 소비하지 않는다, RG7 방식).
 */

/** 이 판의 가족 시드. `peerSeed`(없으면 판 시드 — 시험이 만든 옛 상태 대비) */
export function famSeedOf(peerSeed: number): number {
  return mixSeed(peerSeed, FAMILY_SALT);
}

/** 태그별 독립 스트림 */
export function famStream(famSeed: number, tag: number): Rng {
  return createRng(mixSeed(famSeed, tag));
}

/** 해마다 판정용 해시 [0,1) — 같은 (시드, 태그, a, b) → 같은 값. 진행 RNG를 쓰지 않는다 */
export function famHash01(famSeed: number, tag: number, a: number, b: number): number {
  return mixSeed(mixSeed(mixSeed(famSeed, tag), a), b) / 4294967296;
}
