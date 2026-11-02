import { FAMILY_TAG, type FamilyData } from './familyModel';
import { famHash01 } from './familyRng';
import { namesApi } from './gameData';
import { isRejectedName } from './naming';
import type { BirthReport, Gender } from './types';

/**
 * 식구 이름 (SPEC-009 FC1·FA0-6, 설계 문서 6-4절): 시대별 이름 풀에서 **그 사람의 출생 연도** 풀로 뽑고, 성은 DF5를 따른다 —
 * 아버지·형제자매·친할아버지 = 주인공 성, 어머니·외할아버지 = 어머니 성(주인공 성과 다르게 성씨 분포에서), 친할머니·외할머니는 각자 따로.
 * 모두 순수 함수이고 난수는 `famHash01`(NAMES 태그)뿐이라 진행 RNG를 쓰지 않는다. 한 판 안에서 **이름 전체(성+이름)가 겹치지 않고**, 주인공·또래(VP3)와도 겹치지 않는다. 같은 가족 안에서는 이름 부분도 되도록 겹치지 않게 한다(풀이 작아 다 피할 수 없으면 허용).
 *
 * 풀이 없는 연도: **1940년 앞 출생(주로 조부모)은 FD24 추정 목록이 오기 전까지 가장 오래된 풀(1940년대)을 쓰고**(설계값, 근거 칸에 밝힌다 — 설계 문서 6-4절 임시 규칙),
 * 2020년 뒤 출생(자녀)은 가장 최근 풀(2020)을 쓴다. 시험 전용 R1 프로필(2026년생)은 2025년 풀이다.
 */

const POOL_FIRST = 1940;
const POOL_LAST = 2020;

/** 이 연도의 풀이 실제 통계·연대 풀이 아니라 가까운 풀로 대신한 것인가 (1940 앞 · 2020 뒤 — 근거 칸이 이 경우를 밝힌다) */
export const isNamePoolFallback = (birthYear: number): boolean => birthYear < POOL_FIRST || (birthYear > POOL_LAST && birthYear !== 2026);

/** 가족 이름용 풀: 풀이 없는 연도는 가장 가까운 풀로 대신한다 (`isNamePoolFallback`) */
export function familyNamePool(birthYear: number, gender: Gender): readonly string[] {
  const year = birthYear === 2026 ? 2026 : Math.min(POOL_LAST, Math.max(POOL_FIRST, birthYear));
  return namesApi().namePoolFor(year, gender);
}

/** 성씨 하나를 인구 가중으로 뽑는다 — `exclude`에 든 성은 다시 뽑는다 (해시 소금을 올려 가며, 결정적) */
export function pickSurname(famSeed: number, key: number, exclude: readonly string[] = []): string {
  const items = namesApi().surnames;
  const total = items.reduce((n, s) => n + s.populationThousands, 0);
  for (let salt = 0; salt < 64; salt++) {
    let x = famHash01(famSeed, FAMILY_TAG.NAMES, 1000 + key, salt) * total;
    for (const s of items) {
      x -= s.populationThousands;
      if (x < 0) {
        if (!exclude.includes(s.name)) return s.name;
        break;
      }
    }
  }
  const fallback = items.find((s) => !exclude.includes(s.name));
  if (fallback === undefined) throw new Error('pickSurname: 쓸 수 있는 성씨가 없다');
  return fallback.name;
}

/** 이 성+이름을 쓰면 안 되는가 — 출생 이름과 같은 필터(금지 목록 · 성과 이름 첫 글자가 같은 조합) */
const rejected = isRejectedName;

/**
 * 이름 장부: 이 판에서 이미 쓴 이름(전체·이름 부분)을 기억하며 한 사람씩 이름을 준다. 같은 장부에 같은 순서로 부르면 같은 이름이 나온다.
 * `avoid`는 주인공과 또래의 전체 이름이다.
 */
export class NameBook {
  private readonly used: Set<string>;
  private readonly usedGiven = new Set<string>();

  constructor(
    private readonly famSeed: number,
    avoid: readonly string[],
  ) {
    this.used = new Set(avoid);
  }

  /** 이미 쓴 전체 이름을 적어 둔다 (저장된 이름·앞서 만든 이름) */
  take(fullName: string, surnameLength = 1): void {
    this.used.add(fullName);
    this.usedGiven.add(fullName.slice(surnameLength));
  }

  has(fullName: string): boolean {
    return this.used.has(fullName);
  }

  /** `key`번 사람(번호는 판 안에서 겹치지 않는 정수)의 이름: 풀에서 해시로 고르고, 겹치거나 걸리면 소금을 올려 다시 고른다 */
  give(key: number, surname: string, birthYear: number, gender: Gender): string {
    const pool = familyNamePool(birthYear, gender);
    let any: string | null = null;
    for (let salt = 0; salt < 64; salt++) {
      const given = pool[Math.floor(famHash01(this.famSeed, FAMILY_TAG.NAMES, key, salt) * pool.length)];
      if (rejected(surname, given) || this.used.has(surname + given)) continue;
      if (any === null) any = given;
      // 처음 24번은 가족 안에서 이름 부분이 겹치지 않는 것만 받는다 (김영수·박영수 둘이 한 가족에 있지 않게)
      if (salt < 24 && this.usedGiven.has(given)) continue;
      return this.accept(surname, given);
    }
    if (any !== null) return this.accept(surname, any);
    const safe = pool.find((g) => !rejected(surname, g) && !this.used.has(surname + g));
    if (safe === undefined) throw new Error(`NameBook.give: ${surname} 성에 쓸 수 있는 이름이 풀에 없다 (${birthYear}년 ${gender})`);
    return this.accept(surname, safe);
  }

  private accept(surname: string, given: string): string {
    this.used.add(surname + given);
    this.usedGiven.add(given);
    return surname + given;
  }
}

/** 사람 번호 (`NameBook.give`의 `key`): 겹치지 않는 정수. 바꾸면 알려진 시드의 가족 이름이 달라진다 */
export const NAME_KEY = {
  mother: 1,
  father: 2,
  pgf: 3,
  pgm: 4,
  mgf: 5,
  mgm: 6,
  older: (i: number): number => 11 + i,
  younger: (j: number): number => 21 + j,
  spouse: 31,
  child: (i: number): number => 41 + i,
  friend: (i: number): number => 51 + i,
} as const;

export interface FamilyNames {
  p: [string, string];
  g: [string, string, string, string];
  o: string[];
  y: string[];
}

export interface FamilyNameInput {
  birthYear: number;
  /** 주인공 이름 전체 (성 = 첫 글자) */
  name: string;
  report: Pick<BirthReport, 'mother' | 'father'>;
  /** 주인공·또래의 전체 이름 */
  avoid: readonly string[];
  /** 부모가 태어날 때 조부모 나이가 든 구성 (이름은 조부모 출생 연도 풀에서) */
  g: ReadonlyArray<{ a: number }>;
  o: ReadonlyArray<{ g: 0 | 1; k: number }>;
  y: ReadonlyArray<{ g: 0 | 1; k: number }>;
}

/** 출생 때 식구 이름을 한꺼번에 뽑는다 (아버지 → 어머니 → 조부모 넷 → 위 형제 → 아래 동생 순서로 장부에 적는다) */
export function rollFamilyNames(famSeed: number, input: FamilyNameInput): FamilyNames {
  const { birthYear, name, report } = input;
  const S = name.slice(0, 1);
  const book = new NameBook(famSeed, input.avoid);
  const fatherBy = birthYear - report.father.age;
  const motherBy = birthYear - report.mother.age;
  const father = book.give(NAME_KEY.father, S, fatherBy, 'male');
  const M = pickSurname(famSeed, NAME_KEY.mother, [S]);
  const mother = book.give(NAME_KEY.mother, M, motherBy, 'female');
  const pgf = book.give(NAME_KEY.pgf, S, fatherBy - input.g[0].a, 'male');
  const pgm = book.give(NAME_KEY.pgm, pickSurname(famSeed, NAME_KEY.pgm, [S]), fatherBy - input.g[1].a, 'female');
  const mgf = book.give(NAME_KEY.mgf, M, motherBy - input.g[2].a, 'male');
  const mgm = book.give(NAME_KEY.mgm, pickSurname(famSeed, NAME_KEY.mgm, [M]), motherBy - input.g[3].a, 'female');
  const o = input.o.map((s, i) => book.give(NAME_KEY.older(i), S, birthYear - s.k, s.g === 0 ? 'male' : 'female'));
  const y = input.y.map((s, j) => book.give(NAME_KEY.younger(j), S, birthYear + s.k, s.g === 0 ? 'male' : 'female'));
  return { p: [mother, father], g: [pgf, pgm, mgf, mgm], o, y };
}

/** 저장된 구성에 이름을 얹는다 (`rollFamilyBirth`·옛 저장 스냅샷이 쓴다) */
export function withNames(family: FamilyData, names: FamilyNames): FamilyData {
  return {
    ...family,
    p: [{ ...family.p[0], n: names.p[0] }, { ...family.p[1], n: names.p[1] }],
    g: family.g.map((gp, i) => ({ ...gp, n: names.g[i] })) as FamilyData['g'],
    o: family.o.map((s, i) => ({ ...s, n: names.o[i] })),
    y: family.y.map((s, j) => ({ ...s, n: names.y[j] })),
  };
}
