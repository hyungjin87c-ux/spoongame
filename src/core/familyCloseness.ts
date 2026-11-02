import { FAMILY_TAG } from './familyModel';
import { famHash01, famSeedOf } from './familyRng';
import { familyTables, type ClosenessRole } from './gameData';
import type { GameState } from './types';

/**
 * 사이(관계) 말 (SPEC-009 FC2, 설계 문서 10절 FM6): 수치 대신 **다섯 단계의 말** — 아주 가까움(5) · 가까움(4) · 보통(3) · 데면데면함(2) · 멀어짐(1). 수치는 화면에 나오지 않는다.
 * 계산은 순수 함수 `closenessOf`: 호칭별 기본값 + (부모는) 양육 방식 기울임 + 시드 ±1단계에, **플래그가 만드는 변화**를 더한 표 `design.closeness.flags`(`CLOSENESS_FLAGS`)를 따른다 — 모두 설계값이다.
 * **사이는 사건 없이 슬며시 바뀌지 않는다**: 기본값·기울임·시드는 판이 정해지면 고정이고, 단계가 바뀌는 때는 그 표의 플래그가 켜지거나 꺼질 때뿐이다(시험이 표의 방향을 그 플래그를 켜는 사건의 관계 점수 방향과 맞춘다).
 * 함께 사는지 여부와 사이는 별개다 — 따로 사는 사람도, 사이가 가까울 수 있다.
 */

export type Closeness = 1 | 2 | 3 | 4 | 5;

export interface ClosenessSubject {
  /** `PersonId` 또는 친구 `f1`~`f3` — 시드 ±1 단계를 사람마다 다르게 하는 열쇠 */
  id: string;
  role: ClosenessRole;
}

const KEY: Readonly<Record<string, number>> = {
  mother: 1, father: 2, pgf: 3, pgm: 4, mgf: 5, mgm: 6,
  o1: 11, o2: 12, o3: 13, o4: 14,
  y1: 21, y2: 22, y3: 23, y4: 24, y5: 25, y6: 26, y7: 27,
  spouse: 31, c1: 41, c2: 42, c3: 43, c4: 44, f1: 51, f2: 52, f3: 53,
};

const clamp = (n: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, n));

type Source = Pick<GameState, 'flags' | 'character' | 'peerSeed' | 'seed'>;

/** 한 사람의 사이 단계(1~5) */
export function closenessOf(subject: ClosenessSubject, game: Source): Closeness {
  const rule = familyTables().design.closeness.value;
  const character = game.character;
  let v = rule.base[subject.role];
  if ((subject.role === 'mother' || subject.role === 'father') && character !== null) v += rule.parenting[character.parenting];
  const u = famHash01(famSeedOf(game.peerSeed ?? game.seed), FAMILY_TAG.CLOSE, KEY[subject.id] ?? 0, 0);
  if (u < rule.seedStep.down) v -= 1;
  else if (u >= 1 - rule.seedStep.up) v += 1;
  let floor = 1;
  let cap = 5;
  for (const r of rule.flags) {
    if (!r.who.includes(subject.role)) continue;
    const on = game.flags.includes(r.flag);
    if ((r.when === 'off') === on) continue; // 'off' 규칙은 꺼져 있을 때, 그 밖에는 켜져 있을 때
    v += r.delta ?? 0;
    if (r.floor !== undefined) floor = Math.max(floor, r.floor);
    if (r.cap !== undefined) cap = Math.min(cap, r.cap);
  }
  return clamp(Math.min(cap, Math.max(floor, clamp(v, 1, 5))), 1, 5) as Closeness;
}
