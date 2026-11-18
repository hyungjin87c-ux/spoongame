import { playToEnd, totalCards, type ProfileId } from '../../src/core';
import { preRomancePool } from './preRomancePool';
import { startLife, chooserFor, type Strategy } from '../../scripts/simulateLib';
import { fnv } from './familyGolden';

/**
 * 「올해의 초점」(SPEC-018 PL10) 골든의 표본 정의 — 초점 코드를 넣기 **전** 커밋에서 변경 전 코드로 값을 얼렸다
 * (`tests/focusRng.test.ts` 맞춤 켠 판 · `tests/focusRngOff.test.ts` 맞춤 끈 판). 설계 `docs/data/focus-spend-model.md` 4절.
 */
export const FOCUS_GOLDEN_ERAS: readonly ProfileId[] = ['industrial', 'millennial', 'alpha'];
export const FOCUS_GOLDEN_STRATEGIES: readonly Strategy[] = ['auto', 'first'];
export const FOCUS_GOLDEN_SEEDS = 100;
export const focusSeedOf = (i: number): number => i * 6151 + 29;
/** `rngState` 열로 따로 얼리는 앞쪽 시드 수 */
export const FOCUS_RNG_COLUMN = 8;

export interface FocusCell {
  /** 시드 100판의 최종 상태 + counts + 마지막 틱을 한 해시로 */
  hash: string;
  /** 앞쪽 시드 8판의 최종 `rngState` 열 */
  rng: number[];
  /** 시뮬레이션 요약: 100판의 (평균 카드 수 ×1000, 평균 최종 나이 ×1000)의 정수 */
  cards: number;
  age: number;
}

export function focusCell(era: ProfileId, strategy: Strategy): FocusCell {
  const parts: string[] = [];
  const rng: number[] = [];
  let cards = 0;
  let age = 0;
  for (let i = 1; i <= FOCUS_GOLDEN_SEEDS; i++) {
    const seed = focusSeedOf(i);
    const r = playToEnd(startLife(seed, era), chooserFor(strategy, seed), preRomancePool()); // PL17-R 전 풀로 고정(얼린 값 불변)
    parts.push(JSON.stringify([r.state, r.counts, r.last]));
    if (i <= FOCUS_RNG_COLUMN) rng.push(r.state.rngState);
    cards += totalCards(r.counts);
    age += r.state.age;
  }
  return { hash: fnv(parts.join('\n')), rng, cards: Math.round((cards * 1000) / FOCUS_GOLDEN_SEEDS), age: Math.round((age * 1000) / FOCUS_GOLDEN_SEEDS) };
}
