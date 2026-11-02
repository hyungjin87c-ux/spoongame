import { FAMILY_TAG, type FamilyData } from './familyModel';
import { famHash01, famSeedOf } from './familyRng';
import { familyTables } from './gameData';
import type { GameState } from './types';

/**
 * 반려동물의 상태 (SPEC-009 FK1, 설계 문서 5-1절 K10): 종 ▲ 개 · 고양이 · 그 밖. 상태는 **「함께 삶」「곁을 떠남」「없음」**.
 * 들이는 일은 사건이 한다 — 이 파일은 **읽는 규약**이다: 지금 함께 사는 동물은 플래그 `pet_dog`·`pet_cat`·`pet_other`(사건이 켜고 시스템이 끈다), 떠난 동물은 `family.log`의 종류 13(이별) 항목과 `pet_farewell`이 알린다.
 * 입양 나이·이별 나이는 로그 12·13이 처음이자 유일한 저장이다(`[12, 나이, 30+n, 종 코드]` · `[13, 나이, 30+n, 0]`) — 로그를 쓰는 일(입양 관찰 · 수명이 다한 이별 · 그 줄 `fam-pet-in`·`fam-pet-out`)은 사건 문장과 함께 FM7이 한다.
 * 이름은 설계값 목록 `PET_NAMES`에서 해시로 뽑고(번호 `30+n`), 한 판 안에서 겹치지 않는다. 수명은 종별 균등 설계값(`design.pets.lifeYears`) — 이별 시점을 정하는 쪽(FM7)이 `petLifeYears`를 부른다.
 * 부모 집의 반려동물(마당 개 → 실내 반려동물)은 양육 가구 비율(FD22) 수집 전이라 만들지 않는다(11절 「자료가 오기 전 동작」).
 * 순수 함수, 난수는 `famHash01`(PETS 태그)뿐이다.
 */

export type PetSpecies = 'dog' | 'cat' | 'other';
export type PetStatus = 'with' | 'gone' | 'none';

export const PET_FLAG: Readonly<Record<PetSpecies, string>> = { dog: 'pet_dog', cat: 'pet_cat', other: 'pet_other' };
const SPECIES_CODE: Readonly<Record<PetSpecies, number>> = { dog: 1, cat: 2, other: 3 };
const CODE_SPECIES: Readonly<Record<number, PetSpecies>> = { 1: 'dog', 2: 'cat', 3: 'other' };
/** 로그 종류: 입양 · 이별 */
export const LOG_PET_IN = 12;
export const LOG_PET_OUT = 13;

export interface PetInfo {
  species: PetSpecies;
  name: string;
  slot: number;
  /** 들인 주인공 나이 (로그 12가 없으면 null — 입양 나이를 모르는 떠돌이는 「함께한 N년」으로 쓴다) */
  since: number | null;
  status: 'with' | 'gone';
  /** 떠난 주인공 나이 (gone일 때) */
  goneAt?: number;
  /** 함께한 해 수 (입양·이별 나이를 둘 다 알 때) */
  years?: number;
}

/** 한 마리의 이름: 번호 `30 + slot`의 해시로 목록에서 뽑고, 이미 쓴 이름이면 소금을 올려 다시 뽑는다 */
export function petNameOf(famSeed: number, slot: number, taken: ReadonlySet<string> = new Set()): string {
  const names = familyTables().design.pets.value.names;
  for (let salt = 0; salt < 48; salt++) {
    const name = names[Math.floor(famHash01(famSeed, FAMILY_TAG.PETS, 30 + slot, salt * 2) * names.length)];
    if (!taken.has(name)) return name;
  }
  const free = names.find((n) => !taken.has(n));
  return free ?? names[slot % names.length];
}

/** 이 동물의 수명(년): 종별 범위 균등 (설계값). 이별 시점은 입양 나이 + 이 값이다 */
export function petLifeYears(famSeed: number, slot: number, species: PetSpecies): number {
  const { min, max } = familyTables().design.pets.value.lifeYears[species];
  return min + Math.floor(famHash01(famSeed, FAMILY_TAG.PETS, 30 + slot, 1) * (max - min + 1));
}

type Source = Pick<GameState, 'flags' | 'peerSeed' | 'seed'> & { family?: FamilyData | undefined };

/**
 * 이 판의 반려동물: 로그 12·13이 아는 동물(입양 나이·이별 나이)과, 플래그만 켜진 동물(로그 전)을 합친다. 순서는 칸 번호(`30+n`) 오름차순이고 최대 2마리 함께 산다.
 * 플래그가 켜진 종이 로그에 이미 있으면 로그의 칸을 쓰고, 없으면 종 번호(개 0 · 고양이 1 · 그 밖 2)를 칸으로 쓴다.
 */
export function petsOf(game: Source): PetInfo[] {
  const famSeed = famSeedOf(game.peerSeed ?? game.seed);
  const log = game.family?.l ?? [];
  const ins = log.filter((e) => e[0] === LOG_PET_IN);
  const outs = new Map(log.filter((e) => e[0] === LOG_PET_OUT).map((e) => [e[2], e[1]] as const));
  const out: Array<Omit<PetInfo, 'name'>> = [];
  const loggedSpecies = new Set<PetSpecies>();
  for (const e of ins) {
    const species = CODE_SPECIES[e[3]];
    if (species === undefined) continue;
    const slot = e[2] - 30;
    const goneAt = outs.get(e[2]);
    loggedSpecies.add(species);
    out.push(goneAt === undefined ? { species, slot, since: e[1], status: 'with' } : { species, slot, since: e[1], status: 'gone', goneAt, years: Math.max(0, goneAt - e[1]) });
  }
  // 로그 없이 플래그만 켜진 동물 (입양이 막 일어난 해 · FM7 전)
  (['dog', 'cat', 'other'] as const).forEach((species, i) => {
    if (game.flags.includes(PET_FLAG[species]) && !out.some((p) => p.species === species && p.status === 'with')) out.push({ species, slot: loggedSpecies.has(species) ? 3 + i : i, since: null, status: 'with' });
  });
  out.sort((a, b) => a.slot - b.slot);
  const taken = new Set<string>();
  return out.map((p) => {
    const name = petNameOf(famSeed, p.slot, taken);
    taken.add(name);
    return { ...p, name };
  });
}

/** 함께 사는 동물 (최대 2마리) */
export const petsWithOf = (game: Source): PetInfo[] => petsOf(game).filter((p) => p.status === 'with').slice(0, 2);

/** 한 종의 상태: 함께 삶 · 곁을 떠남(그 종이 한 번이라도 떠남) · 없음 */
export function petStatusOf(game: Source, species: PetSpecies): PetStatus {
  const all = petsOf(game).filter((p) => p.species === species);
  if (all.some((p) => p.status === 'with')) return 'with';
  return all.some((p) => p.status === 'gone') ? 'gone' : 'none';
}

export const petSpeciesCode = (s: PetSpecies): number => SPECIES_CODE[s];
