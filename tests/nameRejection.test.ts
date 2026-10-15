import { describe, expect, it } from 'vitest';
import {
  ERAS,
  GENDERS,
  MAX_NAME_REDRAWS,
  createRng,
  generateBirthFromSeed,
  isRejectedName,
  namePoolFor,
  pickFullName,
  surnameWeights,
  type Era,
  type Gender,
  type Rng,
} from '../src/core';
import { isForbiddenFullName } from '../src/data/forbiddenNames';
import { ERA_CONFIG } from '../src/data/birthTable';

/**
 * R-027 (마스터 결정): 성과 이름 첫 글자가 같은 조합(이이준·윤윤서·정정우 등)은 금지 조합(R-023·R-028)과 같은 내부 필터로
 * 이름을 다시 뽑는다. 플레이어에게 보이는 기능이 아니다.
 */

const SURNAMES = surnameWeights().map((s) => s.name);

/** 성씨와 "이름 뽑기" 결과를 강제하는 RNG. 큐가 비면 마지막 값을 반복한다. */
function forcedRng(surname: string, picks: string[]) {
  const weights = surnameWeights();
  const idx = weights.findIndex((w) => w.name === surname);
  expect(idx).toBeGreaterThanOrEqual(0);
  const queue = [...picks];
  const log = { picks: [] as string[], weightedIndexCalls: 0 };
  const rng: Rng = {
    next: () => 0.5,
    int: (min) => min,
    pick<T>(items: readonly T[]): T {
      const want = queue.length > 1 ? queue.shift()! : queue[0];
      const hit = items.find((x) => (x as unknown) === want);
      expect(hit, `풀에 없는 값을 뽑도록 강제함: ${want}`).toBeDefined();
      log.picks.push(want);
      return hit as T;
    },
    weightedIndex: () => {
      log.weightedIndexCalls++;
      return idx;
    },
    getState: () => 0,
  };
  return { rng, log };
}

/** 실제 풀에서 "성과 첫 글자가 같은 이름"이 있는 (성, 연도, 성별, 이름) 목록 */
function sameLetterCases(): Array<{ surname: string; year: number; gender: Gender; given: string }> {
  const out: Array<{ surname: string; year: number; gender: Gender; given: string }> = [];
  const years = [1955, 1965, 1975, 1985, 2008, 2012, 2018, 2025, 2040];
  for (const year of years) {
    for (const gender of GENDERS) {
      for (const given of namePoolFor(year, gender)) {
        if (SURNAMES.includes(given[0])) out.push({ surname: given[0], year, gender, given });
      }
    }
  }
  return out;
}

describe('isRejectedName: 금지 조합과 같은 내부 필터 (R-027)', () => {
  it('성과 이름의 첫 글자가 같으면 걸린다 (이이준·윤윤서·정정우)', () => {
    expect(isRejectedName('이', '이준')).toBe(true);
    expect(isRejectedName('윤', '윤서')).toBe(true);
    expect(isRejectedName('정', '정우')).toBe(true);
    expect(isRejectedName('김', '김서')).toBe(true);
  });

  it('성과 첫 글자가 다르면 걸리지 않는다. 이름의 두 번째 글자가 성과 같은 것은 허용한다', () => {
    expect(isRejectedName('이', '서준')).toBe(false);
    expect(isRejectedName('김', '민준')).toBe(false);
    expect(isRejectedName('박', '지박')).toBe(false); // 둘째 글자만 같은 경우는 어색하지 않다
    expect(isRejectedName('이', '')).toBe(false); // 빈 이름은 규칙의 대상이 아니다(풀에는 없다)
  });

  it('금지 목록(실존 인물)도 같은 함수로 걸린다: 박정희·김정숙·이순자·김정남', () => {
    for (const [surname, given] of [['박', '정희'], ['김', '정숙'], ['이', '순자'], ['김', '정남']] as const) {
      expect(isForbiddenFullName(surname + given)).toBe(true);
      expect(isRejectedName(surname, given), surname + given).toBe(true);
    }
    expect(isRejectedName('박', '영희')).toBe(false);
  });

  it('실제 풀에 성과 첫 글자가 같은 이름이 있다 (대조군: 이 규칙이 실제로 무언가를 거른다)', () => {
    const cases = sameLetterCases();
    expect(cases.length).toBeGreaterThan(10);
    expect(new Set(cases.map((c) => c.surname)).size).toBeGreaterThanOrEqual(3);
  });
});

describe('걸리면 같은 풀에서 이름만 다시 뽑는다 (강제 RNG)', () => {
  const cases = sameLetterCases().slice(0, 12);
  for (const c of cases) {
    const full = c.surname + c.given;
    const pool = () => namePoolFor(c.year, c.gender);
    const other = () => pool().find((g) => g !== c.given && !isRejectedName(c.surname, g))!;

    it(`${c.year}년 ${c.gender} ${full}: 첫 글자가 같은 이름이 뽑히면 이름만 다시 뽑아 다른 이름이 나온다 (성씨 추첨은 1번)`, () => {
      const { rng, log } = forcedRng(c.surname, [c.given, other()]);
      const result = pickFullName(rng, c.year, c.gender);
      expect(result).toBe(c.surname + other());
      expect(result).not.toBe(full);
      expect(result[0]).not.toBe(result[1]);
      expect(log.picks).toEqual([c.given, other()]);
      expect(log.weightedIndexCalls).toBe(1);
    });
  }

  it('연속으로 걸려도 다시 뽑기를 이어 가고, 걸리지 않는 이름이 나오면 멈춘다', () => {
    const c = cases[0];
    const ok = namePoolFor(c.year, c.gender).find((g) => !isRejectedName(c.surname, g))!;
    const { rng, log } = forcedRng(c.surname, [c.given, c.given, c.given, ok]);
    expect(pickFullName(rng, c.year, c.gender)).toBe(c.surname + ok);
    expect(log.picks).toEqual([c.given, c.given, c.given, ok]);
  });

  it('걸리지 않는 이름이 처음에 나오면 다시 뽑지 않는다 (RNG를 더 쓰지 않는다)', () => {
    const c = cases[0];
    const ok = namePoolFor(c.year, c.gender).find((g) => !isRejectedName(c.surname, g))!;
    const { rng, log } = forcedRng(c.surname, [ok]);
    expect(pickFullName(rng, c.year, c.gender)).toBe(c.surname + ok);
    expect(log.picks).toEqual([ok]);
  });

  it(`계속 걸리는 이름만 뽑히면 ${MAX_NAME_REDRAWS}번 다시 뽑은 뒤 풀에서 걸리지 않는 첫 이름으로 대체한다 (무한 루프 없음)`, () => {
    const c = cases[0];
    const { rng, log } = forcedRng(c.surname, [c.given]);
    const result = pickFullName(rng, c.year, c.gender);
    const firstSafe = namePoolFor(c.year, c.gender).find((g) => !isRejectedName(c.surname, g))!;
    expect(result).toBe(c.surname + firstSafe);
    expect(log.picks).toHaveLength(1 + MAX_NAME_REDRAWS);
  });

  it('성과 첫 글자가 다른 이름은 그대로 허용된다 (예: 이 + 서준, 박 + 민준)', () => {
    for (const [surname, year, gender, given] of [['이', 2012, 'male', '서준'], ['박', 2012, 'male', '민준'], ['정', 2015, 'female', '서연']] as const) {
      if (!namePoolFor(year, gender).includes(given)) continue;
      const { rng, log } = forcedRng(surname, [given]);
      expect(pickFullName(rng, year, gender)).toBe(surname + given);
      expect(log.picks).toEqual([given]);
    }
  });
});

/** 필터 없이 첫 추첨만 흉내 낸다. 소비 순서는 generateBirth와 같다: 연도 → 성별 → 성씨 → 이름. */
function unfilteredFirstDraw(seed: number, era: Era) {
  const rng = createRng(seed);
  const cfg = ERA_CONFIG[era];
  const year = rng.int(cfg.birthYears.min, cfg.birthYears.max);
  const gender = GENDERS[rng.int(0, GENDERS.length - 1)];
  const weights = surnameWeights();
  const surname = weights[rng.weightedIndex(weights.map((w) => w.weight))].name;
  const given = rng.pick(namePoolFor(year, gender));
  return { year, gender, surname, given };
}

describe('대량 시뮬레이션: 세 시대 모두 성과 이름 첫 글자가 같은 이름이 0건', () => {
  for (const era of ERAS) {
    it(`${era}: 필터가 없었다면 나왔을 시드가 실제로 있고(대조군), 실제 출생 결과에는 한 건도 없다 (시드 20000개)`, () => {
      let wouldHave = 0;
      let actual = 0;
      for (let seed = 1; seed <= 20000; seed++) {
        const s = seed * 104729;
        const d = unfilteredFirstDraw(s, era);
        if (d.given[0] === d.surname) wouldHave++;
        const { character: c } = generateBirthFromSeed(s, era);
        if (c.name[0] === c.name[1]) actual++;
      }
      expect(wouldHave, '필터가 없었다면 걸렸을 시드 수').toBeGreaterThan(50);
      expect(actual).toBe(0);
    });
  }

  it('다시 뽑은 이름도 결정적이다: 같은 시드 → 같은 인물, 걸렸던 시드는 성씨·성별·출생 연도가 그대로이고 이름만 바뀐다', () => {
    let checked = 0;
    for (let seed = 1; seed <= 6000 && checked < 25; seed++) {
      const d = unfilteredFirstDraw(seed, 'present');
      if (d.given[0] !== d.surname) continue;
      checked++;
      const a = generateBirthFromSeed(seed, 'present');
      expect(generateBirthFromSeed(seed, 'present')).toEqual(a);
      expect(a.character.name[0]).toBe(d.surname);
      expect(a.character.gender).toBe(d.gender);
      expect(a.character.birthYear).toBe(d.year);
      expect(a.character.name.slice(1)).not.toBe(d.given);
      expect(namePoolFor(d.year, d.gender)).toContain(a.character.name.slice(1));
    }
    expect(checked).toBe(25);
  });
});
