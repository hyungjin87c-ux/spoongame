import forbiddenJson from '../src/data/forbiddenNames.json';
import namesJson from '../src/data/names.json';
import scourtJson from '../src/data/sources/scourt-birth-names.json';
import { describe, expect, it } from 'vitest';
import {
  ERAS,
  GENDERS,
  MAX_NAME_REDRAWS,
  createRng,
  isRejectedName,
  generateBirthFromSeed,
  namePoolFor,
  pickFullName,
  surnameWeights,
  type Era,
  type Gender,
  type Rng,
} from '../src/core';
import { FORBIDDEN_NAMES, isForbiddenFullName } from '../src/data/forbiddenNames';
import { ERA_CONFIG } from '../src/data/birthTable';
import { EPS, sigmaTolerancePct } from './helpers/stats';

/**
 * R-023·R-028: 정치적으로 민감한 실존 인물(전·현직 대통령과 배우자, 북한 최고지도자 일가)과 같은 성+이름은 만들지 않는다.
 * 걸리면 같은 풀에서 이름을 다시 뽑는다(성씨는 그대로). 플레이어에게 보이는 기능이 아니다.
 *
 * 열거와 대조는 JSON 파일을 직접 읽어 독립적으로 한다(구현의 풀 함수를 거치지 않는다).
 */
const forbidden = forbiddenJson as unknown as { meta: { groups: Record<string, string>; scope: string }; names: { name: string; group: string }[] };
const names = namesJson as unknown as {
  surnames: { items: { name: string }[] };
  decades: Record<string, Record<Gender, { verified: string[]; estimated: string[] }>>;
};
const scourt = scourtJson as unknown as { years: Record<string, { M: { name: string }[]; F: { name: string }[] }> };

/** 금지 목록 전체 (직접 적은 기대값). 범위가 슬며시 넓어지지 않도록 고정해 둔다 — 연예인·운동선수 등은 넣지 않는다(형진 님 결정). */
const EXPECTED_FORBIDDEN = [
  // 대한민국 역대·현직 대통령 14명
  '이승만', '윤보선', '박정희', '최규하', '전두환', '노태우', '김영삼', '김대중', '노무현', '이명박', '박근혜', '문재인', '윤석열', '이재명',
  // 그 배우자 12명 (박근혜 전 대통령은 배우자가 없고, 이승만 대통령 배우자는 성+이름 형태가 아니라 제외)
  '육영수', '공덕귀', '홍기', '이순자', '김옥숙', '손명순', '이희호', '권양숙', '김윤옥', '김정숙', '김건희', '김혜경',
  // 북한 최고지도자 일가 4명 (김정남 추가: REV-001-M2-2 R-028 마스터 결정)
  '김일성', '김정일', '김정은', '김정남',
];

/** 현재 성씨 × (모든 시대의 모든 풀)로 실제 만들어질 수 있는 금지 조합과 그 풀. 열거 결과를 그대로 적어 둔다. */
const EXPECTED_REACHABLE: Record<string, string[]> = {
  김정남: ['1950년대 male'], // R-028로 목록에 추가한 이름: 1950년대 남자 풀의 "정남"과 김 성이 만나면 만들어질 수 있었다
  김정숙: ['1950년대 female', '1960년대 female'],
  이순자: ['1950년대 female', '1960년대 female'],
  박정희: ['1950년대 female', '1960년대 female', '1970년대 female'],
};

interface PoolInfo {
  label: string;
  gender: Gender;
  given: string[];
}

/** 세 시대의 모든 이름 풀 (지난: 연대별, 지금: 연도별, 다가올: 합집합) — 원자료에서 독립적으로 구성 */
function allPools(): PoolInfo[] {
  const pools: PoolInfo[] = [];
  for (const [d, v] of Object.entries(names.decades)) {
    for (const g of GENDERS) pools.push({ label: `${d}년대 ${g}`, gender: g, given: [...v[g].verified, ...v[g].estimated] });
  }
  for (const [y, v] of Object.entries(scourt.years)) {
    pools.push({ label: `${y}년 male`, gender: 'male', given: v.M.map((r) => r.name) });
    pools.push({ label: `${y}년 female`, gender: 'female', given: v.F.map((r) => r.name) });
  }
  for (const g of GENDERS) {
    const col = g === 'male' ? 'M' : 'F';
    const union = [...new Set([2021, 2022, 2023, 2024, 2025].flatMap((y) => scourt.years[String(y)][col].map((r) => r.name)))];
    pools.push({ label: `미래 ${g}`, gender: g, given: union });
  }
  return pools;
}

const SURNAMES = names.surnames.items.map((s) => s.name);

describe('금지 이름 목록 데이터 (src/data/forbiddenNames.json)', () => {
  it('정치적으로 민감한 소수 30개뿐이다: 대통령 14 + 배우자 12 + 북한 최고지도자 일가 4 (김정남 포함, R-028)', () => {
    expect(forbidden.names.map((n) => n.name).sort()).toEqual([...EXPECTED_FORBIDDEN].sort());
    expect(EXPECTED_FORBIDDEN).toHaveLength(30);
    const byGroup = (g: string) => forbidden.names.filter((n) => n.group === g).length;
    expect([byGroup('president'), byGroup('president-spouse'), byGroup('north-korea-leader')]).toEqual([14, 12, 4]);
    expect(forbidden.meta.scope).toContain('북한 최고지도자 일가');
    expect(forbidden.meta.scope).toContain('김정남');
    expect(Object.keys(forbidden.meta.groups).sort()).toEqual(['north-korea-leader', 'president', 'president-spouse']);
    for (const n of forbidden.names) expect(forbidden.meta.groups[n.group], n.name).toBeTruthy();
  });

  it('모두 성+이름 전체 문자열(한글 2~4자)이고 중복이 없다', () => {
    const list = forbidden.names.map((n) => n.name);
    expect(new Set(list).size).toBe(list.length);
    for (const n of list) expect(n).toMatch(/^[가-힣]{2,4}$/);
  });

  it('로더(FORBIDDEN_NAMES)가 파일과 같은 목록을 읽고 읽기 전용이다', () => {
    expect(FORBIDDEN_NAMES.map((n) => n.name)).toEqual(forbidden.names.map((n) => n.name));
    expect(Object.isFrozen(FORBIDDEN_NAMES)).toBe(true);
  });

  it('isForbiddenFullName: 성+이름 전체가 같을 때만 걸린다 (성 하나·이름 하나만 같거나 비슷한 이름은 허용)', () => {
    for (const n of EXPECTED_FORBIDDEN) expect(isForbiddenFullName(n), n).toBe(true);
    for (const ok of ['김정희', '박정', '정희', '박', '이재', '박정희 ', ' 박정희', '박정희2', '김민준', '이순', '김정수', '최정숙', '이정은', '']) {
      expect(isForbiddenFullName(ok), `"${ok}"`).toBe(false);
    }
  });
});

describe('현재 성씨 × 이름 풀로 실제 만들어질 수 있는 금지 조합 (열거)', () => {
  it('열거 결과가 직접 적은 기대값과 같다 — 성씨나 풀이 바뀌어 새 조합이 생기면 여기서 걸려 목록을 다시 확인하게 된다', () => {
    const forbiddenSet = new Set(EXPECTED_FORBIDDEN);
    const found = new Map<string, string[]>();
    for (const pool of allPools()) {
      for (const surname of SURNAMES) {
        for (const given of pool.given) {
          if (forbiddenSet.has(surname + given)) {
            found.set(surname + given, [...(found.get(surname + given) ?? []), pool.label]);
          }
        }
      }
    }
    expect(Object.fromEntries([...found].sort())).toEqual(EXPECTED_REACHABLE);
    // 시대로 보면 지난 세상 풀에서만 만들어질 수 있다 (지금 세상·다가올 세상 풀에는 없다)
    for (const places of found.values()) for (const place of places) expect(place).toMatch(/^19[5-8]0년대 (male|female)$/);
  });

  it('성씨 표에 없는 성(전·노·문·육·공·홍·손·권)의 금지 이름은 지금은 만들어질 수 없지만 목록에는 남겨 둔다', () => {
    const unreachableBySurname = EXPECTED_FORBIDDEN.filter((n) => !SURNAMES.includes(n[0]));
    expect(unreachableBySurname.sort()).toEqual(['공덕귀', '권양숙', '노무현', '노태우', '손명순', '육영수', '전두환', '문재인', '홍기'].sort());
    for (const n of unreachableBySurname) expect(isForbiddenFullName(n)).toBe(true);
  });
});

/** 강제 RNG: 성씨와 "이름 뽑기" 결과를 지정한다. pick은 큐에서 꺼내고, 비면 마지막 값을 반복한다. */
function forcedRng(surname: string, picks: string[]) {
  const weights = surnameWeights();
  const idx = weights.findIndex((w) => w.name === surname);
  expect(idx, `성씨 ${surname}`).toBeGreaterThanOrEqual(0);
  const queue = [...picks];
  const log = { weightedIndexCalls: 0, picks: [] as string[] };
  const rng: Rng = {
    next: () => 0.5,
    int: (min) => min,
    pick<T>(items: readonly T[]): T {
      const want = queue.length > 1 ? queue.shift()! : queue[0];
      const hit = items.find((x) => x === (want as unknown));
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

describe('금지 조합에 걸리면 같은 풀에서 이름을 다시 뽑는다 (강제 RNG)', () => {
  // [성, 금지 이름(given), 출생 연도, 성별]
  const cases: [string, string, number, Gender][] = [
    ['박', '정희', 1955, 'female'],
    ['박', '정희', 1965, 'female'],
    ['박', '정희', 1975, 'female'],
    ['김', '정숙', 1955, 'female'],
    ['김', '정숙', 1965, 'female'],
    ['이', '순자', 1955, 'female'],
    ['이', '순자', 1965, 'female'],
  ];

  for (const [surname, given, year, gender] of cases) {
    const full = surname + given;
    const pool = () => namePoolFor(year, gender);

    it(`${year}년 ${gender} ${full}: 금지 이름이 뽑히면 이름만 다시 뽑아 다른 이름이 나온다 (성씨는 그대로, 성씨 추첨은 1번)`, () => {
      expect(isForbiddenFullName(full)).toBe(true);
      expect(pool()).toContain(given);
      const other = pool().find((g) => g !== given && !isRejectedName(surname, g))!;
      const { rng, log } = forcedRng(surname, [given, other]);
      const result = pickFullName(rng, year, gender);
      expect(result).toBe(surname + other);
      expect(isRejectedName(surname, result.slice(1))).toBe(false);
      expect(log.picks).toEqual([given, other]); // 첫 뽑기는 금지 이름이었고, 한 번 다시 뽑았다
      expect(log.weightedIndexCalls).toBe(1); // 성씨는 다시 뽑지 않는다
    });

    it(`${year}년 ${gender} ${full}: 금지 이름이 연속으로 뽑혀도 다시 뽑기를 이어 가다 걸리지 않는 이름이 나오면 멈춘다`, () => {
      const other = pool().find((g) => g !== given && !isRejectedName(surname, g))!;
      const { rng, log } = forcedRng(surname, [given, given, given, other]);
      expect(pickFullName(rng, year, gender)).toBe(surname + other);
      expect(log.picks).toEqual([given, given, given, other]);
    });

    it(`${year}년 ${gender} ${full}: 걸리지 않는 이름이 처음에 나오면 다시 뽑지 않는다 (RNG를 더 쓰지 않는다)`, () => {
      const other = pool().find((g) => g !== given && !isRejectedName(surname, g))!;
      const { rng, log } = forcedRng(surname, [other]);
      expect(pickFullName(rng, year, gender)).toBe(surname + other);
      expect(log.picks).toEqual([other]);
    });

    it(`${year}년 ${gender} ${full}: 계속 금지 이름만 뽑히면 ${MAX_NAME_REDRAWS}번 다시 뽑은 뒤 풀에서 걸리지 않는 첫 이름으로 대체한다 (무한 루프 없음)`, () => {
      const { rng, log } = forcedRng(surname, [given]); // 큐가 비면 같은 값을 반복 → 영원히 금지 이름
      const result = pickFullName(rng, year, gender);
      const firstSafe = pool().find((g) => !isRejectedName(surname, g))!;
      expect(result).toBe(surname + firstSafe);
      expect(isForbiddenFullName(result)).toBe(false);
      expect(log.picks).toHaveLength(1 + MAX_NAME_REDRAWS); // 처음 1번 + 다시 뽑기 상한
    });
  }

  it('금지 조합이 아닌 같은 이름(김정희·이정희)과 같은 성(박)의 다른 이름은 그대로 허용된다', () => {
    for (const [surname, given] of [['김', '정희'], ['이', '정희'], ['박', '영희'], ['박', '정숙'], ['최', '순자'], ['김', '순자']] as const) {
      const { rng, log } = forcedRng(surname, [given]);
      expect(pickFullName(rng, 1955, 'female')).toBe(surname + given);
      expect(log.picks).toEqual([given]);
    }
  });
});

/** 실제 시드 RNG로, 필터가 없었다면 금지 이름이 나왔을 시드를 찾는다. 소비 순서는 generateBirth와 같다: 연도 → 성별 → 성씨 → 이름. */
function unfilteredFirstDraw(seed: number, era: Era) {
  const rng = createRng(seed);
  const cfg = ERA_CONFIG[era];
  const year = rng.int(cfg.birthYears.min, cfg.birthYears.max);
  const gender = GENDERS[rng.int(0, GENDERS.length - 1)];
  const weights = surnameWeights();
  const surname = weights[rng.weightedIndex(weights.map((w) => w.weight))].name;
  const given = rng.pick(namePoolFor(year, gender));
  return { rng, year, gender, surname, given };
}

describe('실제 시드에서의 필터 (지난 세상에서만 금지 조합이 만들어질 수 있다)', () => {
  // 지난 세상 약 1%의 시드가 필터 없이는 금지 이름을 만든다(40000개 중 약 390건) → 훑으면 수백 건
  const hits: { seed: number; year: number; gender: Gender; surname: string; given: string }[] = [];
  for (let seed = 1; seed <= 40000; seed++) {
    const d = unfilteredFirstDraw(seed, 'past');
    if (isForbiddenFullName(d.surname + d.given)) hits.push({ seed, year: d.year, gender: d.gender, surname: d.surname, given: d.given });
  }

  it('필터가 없었다면 금지 이름이 나왔을 시드가 실제로 있다 (대조군): 박정희·김정숙·이순자·김정남이 모두 나온다', () => {
    expect(hits.length).toBeGreaterThanOrEqual(10);
    expect(new Set(hits.map((h) => h.surname + h.given))).toEqual(new Set(['박정희', '김정숙', '이순자', '김정남']));
    for (const h of hits) expect(h.gender).toBe(h.surname + h.given === '김정남' ? 'male' : 'female');
  });

  it('그 시드들에서 실제 출생 결과는 금지 이름이 아니고, 성씨·성별·출생 연도는 그대로이며 이름만 같은 풀의 다른 이름이다', () => {
    for (const h of hits) {
      const { character: c } = generateBirthFromSeed(h.seed, 'past');
      expect(isForbiddenFullName(c.name), `seed ${h.seed}: ${c.name}`).toBe(false);
      expect(c.name[0]).toBe(h.surname);
      expect(c.gender).toBe(h.gender);
      expect(c.birthYear).toBe(h.year);
      const given = c.name.slice(1);
      expect(given).not.toBe(h.given);
      expect(namePoolFor(h.year, h.gender)).toContain(given);
    }
  });

  it('다시 뽑은 이름은 같은 RNG에서 이어 뽑은 결과와 같다 (결정적): 두 번째 뽑기 값 또는 그다음 값', () => {
    for (const h of hits) {
      const d = unfilteredFirstDraw(h.seed, 'past'); // 첫 이름까지 소비한 RNG
      const pool = namePoolFor(h.year, h.gender);
      let expected = d.given;
      for (let i = 0; i < MAX_NAME_REDRAWS && isRejectedName(h.surname, expected); i++) expected = d.rng.pick(pool);
      expect(isRejectedName(h.surname, expected)).toBe(false); // 이 시드들은 상한 안에 해결된다
      expect(generateBirthFromSeed(h.seed, 'past').character.name).toBe(h.surname + expected);
    }
  });

  it('같은 시드 → 같은 결과: 걸렸던 시드들을 두 번 만들어도 인물 전체가 같다', () => {
    for (const h of hits) {
      expect(generateBirthFromSeed(h.seed, 'past')).toEqual(generateBirthFromSeed(h.seed, 'past'));
    }
  });

  it('성씨 분포를 건드리지 않는다: 1955년 여자 이름을 40000번 뽑으면 박 성의 비율이 가중치와 4σ 이내, 박정희만 0건이고 김정희·이정희·박영희는 나온다', () => {
    const n = 40000;
    const rng = createRng(955);
    const counts = new Map<string, number>();
    for (let i = 0; i < n; i++) {
      const name = pickFullName(rng, 1955, 'female');
      counts.set(name, (counts.get(name) ?? 0) + 1);
    }
    expect(counts.get('박정희') ?? 0).toBe(0);
    expect(counts.get('김정숙') ?? 0).toBe(0);
    expect(counts.get('이순자') ?? 0).toBe(0);
    for (const ok of ['김정희', '이정희', '박영희', '박정숙', '박순자', '김순자']) expect(counts.get(ok) ?? 0, ok).toBeGreaterThan(0);
    const total = surnameWeights().reduce((a, w) => a + w.weight, 0);
    const park = surnameWeights().find((w) => w.name === '박')!.weight;
    const observed = ([...counts].filter(([k]) => k[0] === '박').reduce((a, [, c]) => a + c, 0) / n) * 100;
    expect(Math.abs(observed - (park / total) * 100)).toBeLessThanOrEqual(sigmaTolerancePct((park / total) * 100, n) + EPS);
  });
});

describe('대량 시뮬레이션: 세 시대 모두 금지 조합 0건', () => {
  for (const era of ERAS) {
    it(`${era}: 시드 20000개에서 금지 이름이 하나도 나오지 않는다`, () => {
      let forbiddenCount = 0;
      for (let seed = 1; seed <= 20000; seed++) {
        const { character: c } = generateBirthFromSeed(seed * 104729, era);
        if (isForbiddenFullName(c.name)) forbiddenCount++;
      }
      expect(forbiddenCount).toBe(0);
    });
  }
});
