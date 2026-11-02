import { describe, expect, it } from 'vitest';
import {
  GENERATION_IDS,
  HOME_KIND,
  createInitialState,
  familyTables,
  generateBirthFromSeed,
  homeBaseShares,
  homeKindOf,
  homeKindProbs,
  householdSizeAtBirth,
  regionKeyOf,
  rentRoomProbability,
  roomsDistribution,
  roomsFloor,
  sceneFamilyOf,
  type GameState,
} from '../src/core';
import { sigmaTolerance } from './helpers/stats';
import { spreadSeeds } from './helpers/familyGolden';

/**
 * 집의 모습 (SPEC-009 FM4b FA5, 묶음 B — `docs/data/fd-b-house.md` 10절 마스터 결정, `docs/data/family-model.md` 4-5절):
 * 출생 연도 × 시도 → 주택 종류 분포(센서스 격자 + 선형 보간 「추정」, 1969 이하는 1970 값 「설계값」), 점유 형태·소득계층 곱, 방 수(문턱은 연도 함수).
 */

const tables = () => familyTables();
const near = (a: number, b: number, d = 1e-9): void => expect(Math.abs(a - b), `${a} ≈ ${b}`).toBeLessThanOrEqual(d);

describe('거처 종류 구성 homeBaseShares', () => {
  it('합이 1이고, 센서스 해에는 표 값 그대로다(서울 2000 · 부산 1990 · 경기 2020)', () => {
    for (const [key, year] of [['seoul', 2000], ['busan', 1990], ['gyeonggi', 2020], ['jeju', 1995]] as const) {
      const v = homeBaseShares(key, year);
      near(v.reduce((a, b) => a + b, 0), 1);
      const s = tables().housing.regions[key];
      const raw = s.shares[s.years.indexOf(year)];
      // 주택 이외의 거처는 `shackYears` 밖(2000 이후)에서 0으로 가려진다
      const shack = year < tables().design.home.value.shackYears[0] || year > tables().design.home.value.shackYears[1];
      const masked = raw.map((x, k) => (k === HOME_KIND.other && shack ? 0 : x));
      const total = masked.reduce((a, b) => a + b, 0);
      masked.forEach((x, k) => near(v[k], x / total, 1e-9));
    }
  });

  it('센서스 사이 연도는 선형 보간이다(1972 = 1970 · 1975의 5분의 2 지점)', () => {
    const s = tables().housing.regions.seoul;
    const a = s.shares[s.years.indexOf(1970)];
    const b = s.shares[s.years.indexOf(1975)];
    const v = homeBaseShares('seoul', 1972);
    const raw = a.map((x, k) => x + (b[k] - x) * 0.4);
    const total = raw.reduce((x, y) => x + y, 0);
    raw.forEach((x, k) => near(v[k], x / total, 1e-9));
    // 1983: 1980과 1985 사이 3/5
    const c = s.shares[s.years.indexOf(1980)];
    const d = s.shares[s.years.indexOf(1985)];
    const w = homeBaseShares('seoul', 1983);
    const raw2 = c.map((x, k) => x + (d[k] - x) * 0.6);
    const total2 = raw2.reduce((x, y) => x + y, 0);
    raw2.forEach((x, k) => near(w[k], x / total2, 1e-9));
  });

  it('분류가 바뀌는 구간(1975→80 · 2000→05 · 2010→15)은 보간하지 않고 가까운 해의 값이다(같은 거리면 이른 해)', () => {
    const same = (key: string, year: number, pickYear: number): void => {
      const direct = homeBaseShares(key, pickYear);
      const got = homeBaseShares(key, year);
      got.forEach((x, k) => near(x, direct[k], 1e-9));
    };
    same('seoul', 1977, 1975);
    same('seoul', 1978, 1980);
    same('seoul', 2002, 2000);
    same('seoul', 2003, 2005);
    same('seoul', 2012, 2010);
    same('seoul', 2013, 2015);
  });

  it('1969 이하는 1970 구성비를 거슬러 쓰되 아파트 칸은 0에 가깝고 다세대는 0이다(설계값, 마스터 결정 1)', () => {
    const old = homeBaseShares('seoul', 1955);
    const y1970 = homeBaseShares('seoul', 1970);
    expect(old[HOME_KIND.apt]).toBeLessThan(0.005);
    expect(old[HOME_KIND.multi]).toBe(0);
    expect(old[HOME_KIND.detached]).toBeGreaterThan(y1970[HOME_KIND.detached] - 0.02);
    expect(homeBaseShares('seoul', 1941)).toEqual(homeBaseShares('seoul', 1969));
  });

  it('센서스에 시도 줄이 없던 해(승격 전)는 부모 도 줄을 쓴다: 대구 1975 = 경북 · 인천 1980 = 경기 · 광주 1985 = 전남 · 울산 1995 = 경남 · 세종 2010 = 충남', () => {
    for (const [child, parent, year] of [['daegu', 'gyeongbuk', 1975], ['incheon', 'gyeonggi', 1980], ['gwangju', 'jeonnam', 1985], ['ulsan', 'gyeongnam', 1995], ['sejong', 'chungnam', 2010]] as const) {
      const a = homeBaseShares(child, year);
      const b = homeBaseShares(parent, year);
      a.forEach((x, k) => near(x, b[k], 1e-9));
    }
    // 승격 뒤에는 자기 줄이다
    expect(homeBaseShares('daegu', 1990)).not.toEqual(homeBaseShares('gyeongbuk', 1990));
  });

  it('주택 이외의 거처는 출생 연도 범위(shackYears) 밖에서 확률 0이다', () => {
    const [from, to] = tables().design.home.value.shackYears;
    expect(homeBaseShares('seoul', from)[HOME_KIND.other]).toBeGreaterThan(0);
    expect(homeBaseShares('seoul', to)[HOME_KIND.other]).toBeGreaterThan(0);
    expect(homeBaseShares('seoul', to + 1)[HOME_KIND.other]).toBe(0);
    expect(homeBaseShares('seoul', 2015)[HOME_KIND.other]).toBe(0);
  });

  it('시대 경향: 단독주택이 줄고 아파트가 는다(서울 1970 → 2020)', () => {
    expect(homeBaseShares('seoul', 1970)[HOME_KIND.detached]).toBeGreaterThan(homeBaseShares('seoul', 1995)[HOME_KIND.detached]);
    expect(homeBaseShares('seoul', 1995)[HOME_KIND.detached]).toBeGreaterThan(homeBaseShares('seoul', 2020)[HOME_KIND.detached]);
    expect(homeBaseShares('seoul', 2020)[HOME_KIND.apt]).toBeGreaterThan(homeBaseShares('seoul', 1990)[HOME_KIND.apt]);
  });

  it('시도 이름을 모르면 throw, 합쳐진 「전남광주」(시험 전용 R1 프로필)는 전남 줄이다', () => {
    expect(() => regionKeyOf('없는곳')).toThrow();
    expect(regionKeyOf('서울')).toBe('seoul');
    expect(regionKeyOf('전남광주')).toBe('jeonnam');
  });
});

describe('점유 형태·소득계층 곱 homeKindProbs', () => {
  it('합이 1이다: 모든 시도 × 점유 3 × 재력 5 × 연도 몇 개', () => {
    for (const region of ['서울', '부산', '대구', '인천', '광주', '대전', '울산', '세종', '경기', '강원', '충북', '충남', '전북', '전남', '경북', '경남', '제주']) {
      for (const year of [1945, 1972, 1988, 2003, 2019]) {
        for (const housing of ['own', 'rent', 'free'] as const) {
          for (const wealth of [1, 3, 5] as const) {
            const p = homeKindProbs(region, year, housing, wealth);
            near(p.reduce((a, b) => a + b, 0), 1, 1e-9);
            for (const x of p) expect(x).toBeGreaterThanOrEqual(0);
          }
        }
      }
    }
  });

  it('점유가 임차이면 단독보다 아파트·다세대 쪽으로 기울고(2015 서울), 수저가 높을수록 아파트 쪽이다(2018 경기)', () => {
    const own = homeKindProbs('서울', 2015, 'own', 3);
    const rent = homeKindProbs('서울', 2015, 'rent', 3);
    expect(rent[HOME_KIND.multi] + rent[HOME_KIND.row], '임차는 다세대·연립이 더 많다').toBeGreaterThan(own[HOME_KIND.multi] + own[HOME_KIND.row]);
    const low = homeKindProbs('경기', 2018, 'own', 1);
    const high = homeKindProbs('경기', 2018, 'own', 5);
    expect(high[HOME_KIND.apt], '수저가 높을수록 아파트').toBeGreaterThan(low[HOME_KIND.apt]);
    expect(low[HOME_KIND.detached], '수저가 낮을수록 단독').toBeGreaterThan(high[HOME_KIND.detached]);
  });
});

describe('방 수: 문턱은 연도 함수', () => {
  it('분포는 합이 1000 이하의 정수 칸이고, 문턱 아래는 0이다', () => {
    for (const kind of [0, 1, 2, 3]) {
      for (const year of [1960, 1985, 1995, 2010, 2020]) {
        for (const hh of [1, 2, 4, 5, 7, 9]) {
          const d = roomsDistribution(year, kind, hh);
          expect(d).toHaveLength(6);
          expect(d.reduce((a, b) => a + b, 0)).toBeGreaterThan(0);
          const floor = roomsFloor(year, kind, hh);
          d.forEach((x, r) => {
            if (r + 1 < floor) expect(x).toBe(0);
          });
          expect(d[floor - 1]).toBeGreaterThan(0);
        }
      }
    }
  });

  it('식구 수에 비해 비현실적으로 적은 방 수는 연도마다 다르다: 1980 단독 5인 가구는 방 1개도 있었지만 2010 아파트 5인 가구는 3개 이상이다', () => {
    expect(roomsFloor(1980, HOME_KIND.detached, 5)).toBeLessThanOrEqual(2);
    expect(roomsFloor(2010, HOME_KIND.apt, 5)).toBeGreaterThanOrEqual(3);
    // 식구가 많을수록 문턱이 낮아지지 않는다(같은 연도·거처에서 1인 가구보다 5인 가구가 문턱이 같거나 높다)
    expect(roomsFloor(2010, HOME_KIND.apt, 5)).toBeGreaterThanOrEqual(roomsFloor(2010, HOME_KIND.apt, 1));
  });

  it('셋방(딸림) 확률은 설계 점 사이 선형이고 끝 밖은 끝 값이다', () => {
    const pts = tables().design.home.value.rentRoomPoints;
    expect(rentRoomProbability(1940)).toBe(pts[0][1]);
    expect(rentRoomProbability(2030)).toBe(pts[pts.length - 1][1]);
    expect(rentRoomProbability(1999)).toBeLessThan(rentRoomProbability(1990));
  });
});

describe('출생 때 집 rollHome (7세대 × 1000판)', () => {
  const N = 1000;
  const ALL = GENERATION_IDS.flatMap((gen, gi) =>
    spreadSeeds(N, gi).map((seed) => {
      const b = generateBirthFromSeed(seed, gen);
      return { gen, seed, b };
    }),
  );

  it('모든 판에 집이 있고 값이 유효하다: 종류 0~5 · 방 1~6 · 셋방은 임차 단독에만 · 방 수는 문턱 이상', () => {
    for (const { gen, seed, b } of ALL) {
      const h = b.family.h!;
      expect(h, `${gen} ${seed}`).toBeDefined();
      expect(h.k).toBeGreaterThanOrEqual(0);
      expect(h.k).toBeLessThanOrEqual(5);
      expect(h.r).toBeGreaterThanOrEqual(1);
      expect(h.r).toBeLessThanOrEqual(6);
      if (h.s !== undefined) {
        expect(h.s).toBe(1);
        expect(h.k, `${gen} ${seed}: 셋방은 단독에만`).toBe(HOME_KIND.detached);
        expect(b.report.housing, `${gen} ${seed}: 셋방은 임차에만`).toBe('rent');
      }
      const hh = householdSizeAtBirth(b.character.birthYear, b.report, b.family, b.family.o);
      expect(h.r, `${gen} ${seed}: 방 ${h.r}개 < 문턱 ${roomsFloor(b.character.birthYear, h.k, hh)} (식구 ${hh}명)`).toBeGreaterThanOrEqual(roomsFloor(b.character.birthYear, h.k, hh));
      // 주택 이외의 거처는 출생 연도 범위 안에서만
      if (h.k === HOME_KIND.other) {
        const [from, to] = tables().design.home.value.shackYears;
        expect(b.character.birthYear).toBeGreaterThanOrEqual(from);
        expect(b.character.birthYear).toBeLessThanOrEqual(to);
      }
    }
  });

  it('출생신고의 점유 형태(Housing)는 집이 바꾸지 않는다: 같은 입력의 출생 결과가 가족 추첨 앞뒤로 같다(report 그대로)', () => {
    for (const { gen, seed, b } of ALL.filter((_, i) => i % 11 === 0)) {
      const again = generateBirthFromSeed(seed, gen);
      expect(again.report).toEqual(b.report);
      expect(again.family).toEqual(b.family);
    }
  });

  it('거처 종류의 경험 비율이 판마다의 확률 합과 4σ 이내다(세대별 · 단독·아파트·연립+다세대)', () => {
    for (const gen of GENERATION_IDS) {
      const rows = ALL.filter((x) => x.gen === gen);
      for (const [label, kinds] of [['단독', [0]], ['아파트', [1]], ['연립·다세대', [2, 3]]] as Array<[string, number[]]>) {
        const ps = rows.map(({ b }) => {
          const p = homeKindProbs(b.report.region, b.character.birthYear, b.report.housing, b.character.parentWealth);
          return kinds.reduce((a, k) => a + p[k], 0);
        });
        const mu = ps.reduce((a, b) => a + b, 0);
        const sd = Math.sqrt(ps.reduce((a, p) => a + p * (1 - p), 0));
        const got = rows.filter(({ b }) => kinds.includes(b.family.h!.k)).length;
        expect(Math.abs(got - mu), `${gen} ${label}: 관측 ${got} vs 기대 ${mu.toFixed(1)} (4σ ${(4 * sd).toFixed(1)})`).toBeLessThanOrEqual(4 * sd + 1e-9);
      }
    }
    void sigmaTolerance;
  });

  it('시대 경향: 아파트에서 태어난 비율이 산업화 < X < 알파로 는다', () => {
    const rate = (gen: string): number => ALL.filter((x) => x.gen === gen && x.b.family.h!.k === HOME_KIND.apt).length / N;
    expect(rate('industrial')).toBeLessThan(rate('genx'));
    expect(rate('genx')).toBeLessThan(rate('alpha'));
    expect(rate('alpha')).toBeGreaterThan(0.3);
  });
});

describe('그림 상태 sceneFamilyOf: 집 종류·방 수', () => {
  const b = generateBirthFromSeed(2024, 'genx');
  const game = { ...createInitialState(2024), phase: 'life', generation: 'genx', character: b.character, birthReport: b.report, peerSeed: b.peerSeed, family: b.family } as GameState;

  it('어린 시절(부모 집)에는 출생 때 정한 집이 실린다', () => {
    for (const age of [0, 8, 19]) {
      const s = sceneFamilyOf({ ...game, age });
      expect(s.homeKind).toBe(homeKindOf(b.family.h!));
      expect(s.rooms).toBe(b.family.h!.r);
    }
  });

  it('독립한 어른(월세·자가 등)은 집 종류를 새로 뽑지 않고 null이다 — 가족 집에 살 때만 부모 집이다', () => {
    const assets = { net: 0, income: 0, debt: 0, dwelling: 'rent' } as unknown as GameState['assets'];
    expect(sceneFamilyOf({ ...game, age: 30, assets }).homeKind).toBeNull();
    const family = { ...assets, dwelling: 'family' } as unknown as GameState['assets'];
    expect(sceneFamilyOf({ ...game, age: 30, assets: family }).homeKind).toBe(homeKindOf(b.family.h!));
    expect(sceneFamilyOf({ ...game, age: 30, assets: family, flags: ['moved_home'] }).homeKind).toBeNull();
  });

  it('연립·다세대는 그림에서 multi로 합치고, 셋방 딸린 단독은 detached-rent, 주택 이외의 거처는 shack이다', () => {
    expect(homeKindOf({ k: HOME_KIND.row, r: 3 })).toBe('multi');
    expect(homeKindOf({ k: HOME_KIND.multi, r: 3 })).toBe('multi');
    expect(homeKindOf({ k: HOME_KIND.detached, r: 3, s: 1 })).toBe('detached-rent');
    expect(homeKindOf({ k: HOME_KIND.detached, r: 3 })).toBe('detached');
    expect(homeKindOf({ k: HOME_KIND.other, r: 1 })).toBe('shack');
    expect(homeKindOf({ k: HOME_KIND.mixed, r: 3 })).toBe('other');
    expect(homeKindOf({ k: HOME_KIND.apt, r: 4 })).toBe('apt');
  });
});
