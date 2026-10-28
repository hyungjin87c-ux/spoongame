import { GENERATION_IDS, generateBirthFromSeed, type GameState, type ProfileId } from '../../src/core';
import { simulateLife, type Strategy } from '../../scripts/simulateLib';

/**
 * 가족 모델(SPEC-009 FM4a) 해시 불변 시험의 투영과 골든 해시 (docs/data/family-model.md 12-1절).
 *  - L0 출생: `generateBirth`의 character·stats·report·peerSeed·rngState — 가족 추첨이 기존 난수 흐름을 흔들지 않는다.
 *  - L1 기록 전용: 한 판을 끝까지 돌린 뒤의 스탯·자산·플래그·엔딩 판정·진행 RNG 상태·인생 기록. 가족 줄(`fam-` 접두어)과 시스템 플래그는 투영에서 뺀다.
 * 골든 값(`tests/fixtures/birth-golden.json`·`life-golden.json`)은 **이 변경 전의 코드**로 `scripts/familyGolden.ts`가 만들었다 — 다시 만들지 않는다.
 */

/** 32비트 FNV-1a */
export function fnv(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

/** 시드 열: 세대마다 같은 시드 목록을 쓴다 */
export const goldenSeeds = (n: number): number[] => Array.from({ length: n }, (_, i) => 1 + i * 37);

/**
 * 분포 시험용 시드 열: 세대마다 **다른** 시드를 쓴다. 같은 시드는 세대가 달라도 같은 `peerSeed`(= 난수 소비 수가 같으면 같은 값)에서 같은 가족 추첨 값 `u`를 받으므로,
 * 세대 일곱 칸에 같은 시드를 쓰면 표본 7000개가 독립이 아니라 1000개를 일곱 번 세는 꼴이 되어 4σ 허용이 틀어진다.
 */
export const spreadSeeds = (n: number, genIndex: number): number[] => goldenSeeds(n).map((s) => s + genIndex * 1_000_003);

export const L0_SEEDS = 1000;
export const L1_SEEDS = 40;
export const L1_STRATEGIES: readonly Strategy[] = ['auto', 'first'];

/** 시스템이 쓰는 가족 플래그(FM4b 이후 생긴다) — L1 투영에서 뺀다. 지금은 이름만 정해 둔다 */
const SYSTEM_FLAGS: ReadonlySet<string> = new Set([
  'has_grandparent',
  'lives_with_grandparent',
  'has_older_sibling',
  'has_younger_sibling',
  'has_sibling',
  'mother_gone',
  'father_gone',
  'mother_apart',
  'father_apart',
  'mother_works',
  'father_works',
  'sibling_loss_risk',
  'pet_farewell',
]);

export function l0Projection(seed: number, gen: ProfileId): string {
  const r = generateBirthFromSeed(seed, gen);
  return JSON.stringify([r.character, r.stats, r.report, r.peerSeed, r.rngState]);
}

export function l0Hash(gen: ProfileId, seeds: readonly number[]): string {
  return fnv(seeds.map((s) => l0Projection(s, gen)).join('\n'));
}

export function l1Projection(final: GameState): string {
  const history = final.history.filter((h) => !(h.eventId ?? '').startsWith('fam-')).map((h) => [h.age, h.kind, h.text, h.eventId ?? '', h.choice ?? '', h.title ?? '']);
  const flags = final.flags.filter((f) => !SYSTEM_FLAGS.has(f));
  return JSON.stringify([final.stats, final.assets, final.familyFund, flags, final.age, final.death, final.rngState, final.seen, history]);
}

export function l1Hash(gen: ProfileId, strategy: Strategy, seeds: readonly number[]): string {
  return fnv(seeds.map((s) => l1Projection(simulateLife(s, gen, strategy).final)).join('\n'));
}

export { GENERATION_IDS };
