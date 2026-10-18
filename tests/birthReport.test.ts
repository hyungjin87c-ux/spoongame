import birthReportSrc from '../src/core/birthReport.ts?raw';
import birthSrc from '../src/core/birth.ts?raw';
import statsJson from '../src/data/koreaStats.json';
import { describe, expect, it } from 'vitest';
import {
  ERAS,
  GENDERS,
  HOUSINGS,
  OCCUPATIONS,
  PARENT_WEALTHS,
  beginBirth,
  birthSentence,
  createInitialState,
  createRng,
  enterBirth,
  forkRng,
  enterLife,
  generateBirth,
  generateBirthFromSeed,
  housingProbs,
  isEventEligible,
  isValidBirthReport,
  jobWeights,
  mixSeed,
  parentAgeAt,
  playToEnd,
  reportPlaceLabel,
  rollBirthReport,
  weightStanding,
  type BirthReport,
  type Era,
  type Gender,
  type ParentWealth,
} from '../src/core';
import { EVENT_POOL } from '../src/data/events';
import { ERA_CONFIG } from '../src/data/birthTable';
import {
  BIRTH_ORDER_LABEL,
  ERA_REPORT_ADJUST,
  INCOME_CLASS_BLEND,
  INCOME_CLASS_ROW,
  JOB_TILT_BY_ERA,
  JOB_TILT_BY_PARENT,
  JOB_TILT_BY_WEALTH,
  OCCUPATION_LABEL,
  OCCUPATION_STAT_ROW,
  PARENT_AGE_LIMITS,
  PARENT_AGE_SHIFT_BY_WEALTH,
  THIRD_PLUS_SPLIT,
  WEALTH_ADJECTIVE,
} from '../src/data/birthReportTable';
import { getBirthStats, parseAgeBand, parseWeightBin, regionsOf, sigunguChoices } from '../src/data/birthStats';
import { formatKg } from '../src/data/birthReportText';
import { standingLabel } from '../src/data/birthText';
import { REGION_ORDER, formalSido, placeLabel, sortRegions } from '../src/data/regionNames';
import { startLife, chooserFor } from '../scripts/simulateLib';
import { codeOnly } from './helpers/code';
import { EPS, sigmaTolerancePct } from './helpers/stats';

/**
 * 출생신고 상세 (SPEC-003 BR2~BR4·BR6, M3). 기준은 **koreaStats.json 원자료를 직접 읽은 값**이다(구현의 접근자·표를 거치지 않는다) —
 * 구현이 통계를 틀리게 옮겨도 이 테스트가 잡는다. 분포는 허용오차 4σ(R-015)로 대조한다.
 */

interface Row {
  [key: string]: unknown;
}
const indicators = (statsJson as unknown as { indicators: Array<{ id: string; rows?: Row[]; series?: Row[]; averages?: Record<string, number> }> }).indicators;
const ind = (id: string) => indicators.find((i) => i.id === id)!;

const N = 20000;
/** core/birth.ts의 갈래 salt (값을 바꾸면 알려진 시드의 출생신고가 달라진다 — 그 값 자체를 여기서도 못 박는다) */
const REPORT_SALT_FOR_TEST = 0x52505254;
const PEER_SALT_FOR_TEST = 0x50454552;
const BIRTH_YEAR: Record<Era, number> = { past: 1970, present: 2026, future: 2045 };

/** (시대, n)마다 같은 시드로 한 번만 뽑는다 */
const cache = new Map<string, ReturnType<typeof generateBirth>[]>();
function sample(era: Era, n = N) {
  const key = `${era}:${n}`;
  let v = cache.get(key);
  if (!v) {
    const rng = createRng(20261016);
    v = Array.from({ length: n }, () => generateBirth(rng, era));
    cache.set(key, v);
  }
  return v;
}

describe('설계 보정 표 모양 (data/birthReportTable.ts) — 모든 칸이 채워져 있고 합·범위가 맞다', () => {
  it('직업 이름·배율: 9개 직업 모두, 배율은 양수이고 3단계·지금 세상은 1(통계 그대로)', () => {
    expect([...OCCUPATIONS]).toHaveLength(9);
    for (const job of OCCUPATIONS) {
      expect(OCCUPATION_LABEL[job].length).toBeGreaterThan(1);
      expect(OCCUPATION_STAT_ROW[job].length).toBeGreaterThan(1);
      for (const w of PARENT_WEALTHS) expect(JOB_TILT_BY_WEALTH[w][job], `${w}단계 ${job}`).toBeGreaterThan(0);
      for (const p of ['mother', 'father'] as const) expect(JOB_TILT_BY_PARENT[p][job]).toBeGreaterThan(0);
      for (const era of ERAS) expect(JOB_TILT_BY_ERA[era][job]).toBeGreaterThan(0);
      expect(JOB_TILT_BY_WEALTH[3][job]).toBe(1);
      expect(JOB_TILT_BY_ERA.present[job]).toBe(1);
      expect(JOB_TILT_BY_ERA.future[job]).toBe(1);
    }
    // 화면 이름에 가운뎃점이 없다(줄바꿈에서 「·」가 줄 끝·첫머리에 혼자 남지 않게, QM2-5)
    for (const job of OCCUPATIONS) expect(OCCUPATION_LABEL[job]).not.toMatch(/[·/—]/);
  });

  it('수저 단계가 높을수록 관리·전문직이 늘고 단순노무·기계 조작직이 준다(배율이 단계에 대해 비감소/비증가)', () => {
    for (let w = 1; w < 5; w++) {
      const lo = JOB_TILT_BY_WEALTH[w as ParentWealth];
      const hi = JOB_TILT_BY_WEALTH[(w + 1) as ParentWealth];
      for (const up of ['manager', 'professional', 'clerk'] as const) expect(hi[up], `${w}→${w + 1} ${up}`).toBeGreaterThanOrEqual(lo[up]);
      for (const down of ['service', 'agri', 'craft', 'machine', 'labor'] as const) expect(hi[down], `${w}→${w + 1} ${down}`).toBeLessThanOrEqual(lo[down]);
    }
  });

  it('부모 나이 보정은 단계에 대해 비감소이고, 단계 비율로 가중한 평균이 0에 가깝다(통계 평균 출산 연령을 거의 바꾸지 않는다)', () => {
    for (let w = 1; w < 5; w++) expect(PARENT_AGE_SHIFT_BY_WEALTH[(w + 1) as ParentWealth]).toBeGreaterThanOrEqual(PARENT_AGE_SHIFT_BY_WEALTH[w as ParentWealth]);
    const weights = ERA_CONFIG.present.wealthWeights;
    const mean = PARENT_WEALTHS.reduce((a, w) => a + PARENT_AGE_SHIFT_BY_WEALTH[w] * weights[w - 1], 0) / 100;
    expect(Math.abs(mean)).toBeLessThan(0.2);
  });

  it('형제 순서 표: 셋째 이상 분할 합 100, 시대별 덮어쓰기 합 100, 순서 이름 1~5', () => {
    expect(THIRD_PLUS_SPLIT.reduce((a, b) => a + b, 0)).toBe(100);
    for (const era of ERAS) {
      const o = ERA_REPORT_ADJUST[era].orderShares;
      if (o !== null) expect(o.reduce((a, b) => a + b, 0), era).toBe(100);
    }
    expect(ERA_REPORT_ADJUST.present).toEqual({ parentAgeShift: 0, orderShares: null });
    expect(Object.keys(BIRTH_ORDER_LABEL).map(Number)).toEqual([1, 2, 3, 4, 5]);
  });

  it('소득계층 섞는 비율: 단계마다 합 1, 계층 이름은 통계표의 행 이름과 같다', () => {
    for (const w of PARENT_WEALTHS) expect(INCOME_CLASS_BLEND[w].reduce((a, [, s]) => a + s, 0), `${w}단계`).toBeCloseTo(1, 9);
    const labels = new Set((ind('housing-tenure').rows ?? []).map((r) => r.label));
    for (const cls of ['low', 'mid', 'high'] as const) expect(labels.has(INCOME_CLASS_ROW[cls]), cls).toBe(true);
  });

  it('형편 서술 5개는 서로 다르고 수저 이름·구간을 쓰지 않는다 (인생 기록 첫 줄에 들어가는 글, C4)', () => {
    expect(new Set(Object.values(WEALTH_ADJECTIVE)).size).toBe(5);
    for (const t of Object.values(WEALTH_ADJECTIVE)) expect(t).not.toMatch(/수저|다이아|%|하위|상위/);
  });
});

describe('통계 읽기 (data/birthStats.ts)가 원자료와 같다', () => {
  const stats = getBirthStats();

  it('나이·체중 구간 이름 해석: 실제 통계표의 모든 이름이 읽힌다', () => {
    expect(parseAgeBand('20세 미만', { low: 15, high: 49 })).toEqual({ min: 15, max: 19 });
    expect(parseAgeBand('30~34세', { low: 15, high: 49 })).toEqual({ min: 30, max: 34 });
    expect(parseAgeBand('45세 이상', { low: 15, high: 49 })).toEqual({ min: 45, max: 49 });
    expect(() => parseAgeBand('몰라', { low: 15, high: 49 })).toThrow();
    expect(parseWeightBin('1.5kg 미만')).toEqual({ lo: 1, hi: 1.5 });
    expect(parseWeightBin('2.5~2.9kg')).toEqual({ lo: 2.5, hi: 3 });
    expect(parseWeightBin('4.5kg 이상')).toEqual({ lo: 4.5, hi: 5 });
    expect(() => parseWeightBin('몰라')).toThrow();
  });

  it('월별 가중 = 원자료의 가장 최근 연도(2025) 열이고 합이 연간 출생아 수 254,341이다', () => {
    const rows = ind('birth-by-month').rows!;
    expect(stats.monthWeights).toEqual(rows.map((r) => r.y2025 as number));
    expect(stats.monthWeights.reduce((a, b) => a + b, 0)).toBe(254341);
  });

  it('체중 격자: 성별마다 1.0~4.9kg 40칸(0.1kg), 확률 합 1, 구간별 합이 원자료의 구간 비중(체중 미상 제외)과 같다', () => {
    const rows = ind('birth-weight').rows!.filter((r) => r.bin !== '미상');
    for (const g of GENDERS) {
      const grid = stats.weight[g];
      expect(grid.values).toHaveLength(40);
      expect(grid.values[0]).toBe(1);
      expect(grid.values[39]).toBe(4.9);
      expect(grid.probs.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 9);
      const total = rows.reduce((a, r) => a + (r[g] as number), 0);
      // 2.5~2.9kg 구간(값 2.5~2.9 다섯 칸)의 확률 합
      const bin = rows.find((r) => r.bin === '2.5~2.9kg')!;
      const share = grid.values.reduce((a, v, i) => (v >= 2.5 && v < 3 ? a + grid.probs[i] : a), 0);
      expect(share, g).toBeCloseTo((bin[g] as number) / total, 9);
    }
  });

  it('어머니·아버지 연령 구간이 원자료와 같다: 구간 수·가중치, 나이 범위가 겹치지 않고 이어진다', () => {
    const mother = ind('birth-mother-age').series!;
    expect(stats.motherBands.map((b) => b.weight)).toEqual(mother.map((p) => p.value as number));
    const father = ind('birth-father-age').series!;
    expect(stats.fatherBands.map((b) => b.weight)).toEqual(father.map((p) => p.value as number));
    for (const bands of [stats.motherBands, stats.fatherBands]) {
      for (let i = 1; i < bands.length; i++) expect(bands[i].min, `${bands[i].label}`).toBe(bands[i - 1].max + 1);
    }
    const avg = ind('birth-mother-age').averages!;
    expect(stats.motherAverages).toEqual({ all: avg.all, first: avg.first, second: avg.second, thirdPlus: avg.thirdPlus });
    // 순위가 늦을수록 평균 출산 연령이 높다(첫째 < 둘째 < 셋째 이상, 통계 그대로)
    expect(stats.motherAverages.first).toBeLessThan(stats.motherAverages.second);
    expect(stats.motherAverages.second).toBeLessThan(stats.motherAverages.thirdPlus);
  });

  it('출산 순위·점유형태·직업 표가 원자료와 같다', () => {
    for (const r of ind('birth-order').rows!) expect(stats.orderRows[r.label as string]).toEqual([r.first, r.second, r.thirdPlus]);
    for (const r of ind('housing-tenure').rows!) expect(stats.housingRows[r.label as string]).toEqual([r.own, r.rent, r.free]);
    const occ = ind('occupation-proxy').rows!;
    for (const job of OCCUPATIONS) {
      const row = occ.find((r) => r.label === OCCUPATION_STAT_ROW[job])!;
      expect([stats.occupation.a30[job], stats.occupation.a40[job]]).toEqual([row.a30, row.a40]);
    }
  });
});

describe('rollBirthReport: 결정적이고 모든 값이 유효하다', () => {
  it('같은 RNG 상태·같은 입력 → 같은 결과, 다른 시드는 다르다 (세 시대)', () => {
    for (const era of ERAS) {
      const a = rollBirthReport(createRng(9), era, BIRTH_YEAR[era], 'female', 3);
      expect(rollBirthReport(createRng(9), era, BIRTH_YEAR[era], 'female', 3)).toEqual(a);
      const distinct = new Set(Array.from({ length: 50 }, (_, i) => JSON.stringify(rollBirthReport(createRng(i + 1), era, BIRTH_YEAR[era], 'male', 3))));
      expect(distinct.size).toBeGreaterThan(40);
    }
  });

  for (const era of ERAS) {
    it(`${era}: 시드 1000개 전부 — 월 1~12, 지역은 룰렛 목록 안, 시군구는 그 지역 후보, 부모 나이·직업·주거·체중(격자)·순서가 범위 안이고 저장 검증을 통과한다`, () => {
      for (let seed = 1; seed <= 1000; seed++) {
        const { character: c, report: r } = generateBirthFromSeed(seed * 104729, era);
        const where = `${era} 시드 ${seed}`;
        expect(isValidBirthReport(r, c.birthYear, c.gender), where).toBe(true);
        expect(Number.isInteger(r.month) && r.month >= 1 && r.month <= 12, where).toBe(true);
        expect(regionsOf(c.birthYear).regions.map((x) => x.name), where).toContain(r.region);
        expect(sigunguChoices(c.birthYear, r.region).some((x) => x.sido === r.sigunguSido && x.name === r.sigungu), where).toBe(true);
        for (const p of [r.mother, r.father]) {
          expect(p.age, where).toBeGreaterThanOrEqual(PARENT_AGE_LIMITS.min);
          expect(p.age, where).toBeLessThanOrEqual(PARENT_AGE_LIMITS.max);
          expect(OCCUPATIONS, where).toContain(p.job);
        }
        expect(HOUSINGS, where).toContain(r.housing);
        expect(Math.round(r.birthWeightKg * 10) / 10, where).toBe(r.birthWeightKg);
        expect(r.birthOrder, where).toBeGreaterThanOrEqual(1);
        expect(r.birthOrder, where).toBeLessThanOrEqual(5);
      }
    });
  }

  /** 지난·다가올 세상: M3 이전(9a8ac7f)의 generateBirthFromSeed(seed).rngState를 그 커밋의 코드로 구한 값이다. 지금 세상은 이름 풀이 2025년 단일 풀로 바뀌어(성과 첫 글자가 같은 이름을 다시 뽑는 횟수가 달라짐) 시드 3만 다르다. */
  const BEFORE_M3_SEEDS = [1, 2, 3, 20261013, 777, 4242, 9001, 123456789] as const;
  const BEFORE_M3_STATE = [4167084903, 4167084904, 4167084905, 4187345915, 4167085679, 4167089144, 4167093903, 4290541691] as const;

  it('R-273: 출생신고 상세의 추첨은 인생 진행용 RNG를 전진시키지 않는다 — 출생신고가 생기기 전(9a8ac7f)에 구한 인생 RNG 상태와 같다 (지난·다가올 세상 8시드 전부, 지금 세상은 이름 풀이 바뀐 시드 3만 빼고)', () => {
    BEFORE_M3_SEEDS.forEach((seed, i) => {
      for (const era of ERAS) {
        if (era === 'present' && seed === 3) continue;
        expect(generateBirthFromSeed(seed, era).rngState, `${era} 시드 ${seed}`).toBe(BEFORE_M3_STATE[i]);
      }
    });
    // 공허 통과 방지: 위에서 뺀 시드 3의 지금 세상은 실제로 M3 이전과 다르다(이름 풀 변경) — 비교가 값을 구별한다
    expect(generateBirthFromSeed(3, 'present').rngState).not.toBe(BEFORE_M3_STATE[2]);
  });

  it('R-273: 출생신고 상세·또래 시드를 만들 때 부모(인생) RNG에서 난수를 뽑지 않는다 — RNG 호출 기록: 첫 getState() 뒤에는 뽑는 호출이 없다', () => {
    for (const era of ERAS) {
      const real = createRng(31337);
      const calls: string[] = [];
      const spy = {
        next: () => (calls.push('next'), real.next()),
        int: (a: number, b: number) => (calls.push('int'), real.int(a, b)),
        pick: <T,>(items: readonly T[]) => (calls.push('pick'), real.pick(items)),
        weightedIndex: (w: readonly number[]) => (calls.push('weightedIndex'), real.weightedIndex(w)),
        getState: () => (calls.push('getState'), real.getState()),
      };
      generateBirth(spy, era);
      const firstState = calls.indexOf('getState');
      expect(firstState, `${era}: getState로 갈래를 만든다`).toBeGreaterThan(5);
      expect(calls.slice(firstState).every((c) => c === 'getState'), `${era}: 갈래를 만든 뒤 호출 ${calls.slice(firstState).join(',')}`).toBe(true);
      expect(calls.slice(0, firstState).some((c) => c !== 'getState')).toBe(true); // 인생용 난수는 그 앞에서만 뽑았다
    }
    // 출생신고 상세·또래 시드는 갈라낸 RNG(forkRng·mixSeed)로만 만든다 — 인생 진행용 rng에서 직접 뽑지 않는다(소스 점검)
    expect(birthSrc).toContain('forkRng(rng, REPORT_SALT)');
    expect(birthSrc).toContain('mixSeed(rng.getState(), PEER_SALT)');
  });

  it('R-273: 출생신고 상세 = 인생 RNG의 최종 상태에서 갈라낸 RNG로 다시 뽑은 것과 같다(독립 재구성) — 또래 시드도 같은 상태에서 섞어 만든다', () => {
    for (const era of ERAS) {
      for (const seed of [1, 99, 20261013]) {
        const b = generateBirthFromSeed(seed, era);
        const again = rollBirthReport(forkRng(createRng(b.rngState), REPORT_SALT_FOR_TEST), era, b.character.birthYear, b.character.gender, b.character.parentWealth);
        expect(again, `${era} 시드 ${seed}`).toEqual(b.report);
        expect(b.peerSeed).toBe(mixSeed(b.rngState, PEER_SALT_FOR_TEST));
      }
    }
  });

  it('지난 세상 지역은 그 시기의 시·도 목록(울산·세종 없음)에서, 시군구는 그 시·도 구분에 속한 2025년 행정구역에서 나온다', () => {
    for (let seed = 1; seed <= 400; seed++) {
      const { character: c, report: r } = generateBirthFromSeed(seed, 'past');
      const region = regionsOf(c.birthYear).regions.find((x) => x.name === r.region)!;
      expect(region.from, `${c.birthYear}년생 ${r.region}`).toContain(r.sigunguSido);
      if (c.birthYear <= 1980) expect(r.region).not.toBe('울산');
    }
  });

  it('지금 세상 시군구는 2026년 행정구역이다: 인천 중·동·서구와 화성시 대신 새 구가 나올 수 있고, 전남광주에는 광주·전남 시군구가 모두 있다', () => {
    const incheon = sigunguChoices(2026, '인천').map((x) => x.name);
    for (const gone of ['중구', '동구', '서구']) expect(incheon).not.toContain(gone);
    for (const made of ['제물포구', '영종구', '서해구', '검단구']) expect(incheon).toContain(made);
    const gyeonggi = sigunguChoices(2026, '경기').map((x) => x.name);
    expect(gyeonggi).not.toContain('화성시');
    expect(gyeonggi).toContain('화성시 동탄구');
    const jg = sigunguChoices(2026, '전남광주');
    expect(new Set(jg.map((x) => x.sido))).toEqual(new Set(['광주', '전남']));
    expect(new Set(jg.map((x) => x.name)).size, '지역 안에서 이름이 유일').toBe(jg.length);
    expect(jg.filter((x) => x.designValue)).toHaveLength(0);
    expect(sigunguChoices(2026, '인천').filter((x) => x.designValue)).toHaveLength(4);
  });
});

describe('분포가 통계와 맞는다 (허용오차 4σ, 지금 세상 20000건)', () => {
  const draws = () => sample('present');

  it('출생 월: 월별 출생아 수 가중(2025)과 4σ 이내 — 오늘 날짜와 무관하게 1~12월이 모두 나온다 (남은 결정 R1)', () => {
    const rows = ind('birth-by-month').rows!;
    const total = rows.reduce((a, r) => a + (r.y2025 as number), 0);
    const d = draws();
    for (const row of rows) {
      const month = row.month as number;
      const expected = ((row.y2025 as number) / total) * 100;
      const observed = (d.filter((x) => x.report.month === month).length / d.length) * 100;
      expect(Math.abs(observed - expected), `${month}월 관측 ${observed.toFixed(2)}% / 기대 ${expected.toFixed(2)}%`).toBeLessThanOrEqual(sigmaTolerancePct(expected, d.length) + EPS);
    }
  });

  it('출생 체중: 성별별 구간 비중(체중 미상 제외)과 4σ 이내', () => {
    const rows = ind('birth-weight').rows!.filter((r) => r.bin !== '미상');
    const d = draws();
    for (const g of GENDERS) {
      const sub = d.filter((x) => x.character.gender === g);
      const total = rows.reduce((a, r) => a + (r[g] as number), 0);
      for (const [bin, lo, hi] of [['2.5~2.9kg', 2.5, 3], ['3.0~3.4kg', 3, 3.5], ['3.5~3.9kg', 3.5, 4], ['2.0~2.4kg', 2, 2.5]] as const) {
        const expected = ((rows.find((r) => r.bin === bin)![g] as number) / total) * 100;
        const observed = (sub.filter((x) => x.report.birthWeightKg >= lo && x.report.birthWeightKg < hi).length / sub.length) * 100;
        expect(Math.abs(observed - expected), `${g} ${bin} 관측 ${observed.toFixed(2)}% / 기대 ${expected.toFixed(2)}%`).toBeLessThanOrEqual(sigmaTolerancePct(expected, sub.length) + EPS);
      }
    }
  });

  it('지역: 시·도 출생아 비율(룰렛 확률)과 4σ 이내, 16개 시·도가 모두 나온다', () => {
    const d = draws();
    const regions = regionsOf(2026).regions;
    expect(regions).toHaveLength(16);
    for (const r of regions) {
      const observed = (d.filter((x) => x.report.region === r.name).length / d.length) * 100;
      expect(Math.abs(observed - r.sharePct), `${r.name} 관측 ${observed.toFixed(2)}% / 기대 ${r.sharePct}%`).toBeLessThanOrEqual(sigmaTolerancePct(r.sharePct, d.length) + EPS);
    }
  });

  it('형제 순서: 첫째·둘째·셋째 이상 비중이 지역별 통계를 출생아 수로 가중한 값과 4σ 이내(전국 62.4/31.2/6.4와도 가깝다)', () => {
    const d = draws();
    const shares = (['first', 'second', 'thirdPlus'] as const).map((key) => {
      let sum = 0;
      for (const r of regionsOf(2026).regions) {
        const births = r.births;
        const regionRows = r.from.map((s) => ind('birth-order').rows!.find((x) => x.label === s)!);
        const w = r.from.map((s) => (ind('birth-by-sido').rows!.find((x) => x.sido === s)!.births as number));
        const mix = regionRows.reduce((a, row, i) => a + (row[key] as number) * w[i], 0) / w.reduce((a, b) => a + b, 0);
        sum += mix * births;
      }
      return sum / 254341;
    });
    const observed = [1, 2].map((o) => (d.filter((x) => x.report.birthOrder === o).length / d.length) * 100);
    observed.push((d.filter((x) => x.report.birthOrder >= 3).length / d.length) * 100);
    shares.forEach((expected, i) => {
      expect(Math.abs(observed[i] - expected), `순서 ${i} 관측 ${observed[i].toFixed(2)}% / 기대 ${expected.toFixed(2)}%`).toBeLessThanOrEqual(sigmaTolerancePct(expected, d.length) + EPS);
    });
    expect(Math.abs(observed[0] - 62.4)).toBeLessThan(2.5);
    // 셋째 이상은 셋째·넷째·다섯째로 나뉜다(설계 분할)
    const third = d.filter((x) => x.report.birthOrder === 3).length;
    const fourth = d.filter((x) => x.report.birthOrder === 4).length;
    const fifth = d.filter((x) => x.report.birthOrder === 5).length;
    expect(third).toBeGreaterThan(fourth);
    expect(fourth).toBeGreaterThan(fifth);
    expect(fifth).toBeGreaterThan(0);
  });

  it('부모 직업: 단계별 직업 분포가 「통계 × 설계 배율」(jobWeights)과 4σ 이내이고, 배율 방향대로 단계가 높을수록 관리·전문직이 많다', () => {
    const d = draws();
    for (const w of [1, 3, 5] as const) {
      const mothers = d.filter((x) => x.character.parentWealth === w && x.report.mother.age < 40);
      const weights = jobWeights('mother', 30, w, 'present');
      const total = weights.reduce((a, b) => a + b, 0);
      OCCUPATIONS.forEach((job, i) => {
        const expected = (weights[i] / total) * 100;
        const observed = (mothers.filter((x) => x.report.mother.job === job).length / mothers.length) * 100;
        if (expected < 0.5) return;
        expect(Math.abs(observed - expected), `${w}단계 어머니 ${job} 관측 ${observed.toFixed(2)}% / 기대 ${expected.toFixed(2)}%`).toBeLessThanOrEqual(sigmaTolerancePct(expected, mothers.length) + EPS + 0.01);
      });
    }
    const topShare = (w: ParentWealth) => {
      const xs = d.filter((x) => x.character.parentWealth === w);
      return xs.filter((x) => ['manager', 'professional'].includes(x.report.father.job)).length / xs.length;
    };
    expect(topShare(1)).toBeLessThan(topShare(3));
    expect(topShare(3)).toBeLessThan(topShare(5));
    // 어머니·아버지 배율이 다르다: 기능·기계 조작직은 아버지가 더 많다
    const blue = (who: 'mother' | 'father') => d.filter((x) => ['craft', 'machine'].includes(x.report[who].job)).length;
    expect(blue('father')).toBeGreaterThan(blue('mother'));
  });

  it('사는 집: 확률(housingProbs)이 합 1이고 지역 점유형태 × 소득계층 배율로 직접 계산한 값과 같다(서울 1·3·5단계), 단계가 높을수록 자가 비율이 높다', () => {
    const rows = ind('housing-tenure').rows!;
    const get = (label: string) => rows.find((r) => r.label === label)!;
    const seoul = get('서울');
    const nat = get('전국');
    const classOf: Record<ParentWealth, string> = { 1: '전국·저소득층', 3: '전국·중소득층', 5: '전국·고소득층' } as never;
    for (const w of [1, 3, 5] as const) {
      const cls = get(classOf[w]);
      const raw = (['own', 'rent', 'free'] as const).map((k) => (seoul[k] as number) * ((cls[k] as number) / (nat[k] as number)));
      const total = raw.reduce((a, b) => a + b, 0);
      housingProbs('서울', 2026, w).forEach((p, i) => expect(p, `${w}단계 ${i}`).toBeCloseTo(raw[i] / total, 9));
      expect(housingProbs('서울', 2026, w).reduce((a, b) => a + b, 0)).toBeCloseTo(1, 9);
    }
    const own = PARENT_WEALTHS.map((w) => housingProbs('경기', 2026, w)[0]);
    for (let i = 1; i < own.length; i++) expect(own[i]).toBeGreaterThan(own[i - 1]);
    // 실제 추첨도 단계가 높을수록 자가가 많다
    const d = draws();
    const ownShare = (w: ParentWealth) => {
      const xs = d.filter((x) => x.character.parentWealth === w);
      return xs.filter((x) => x.report.housing === 'own').length / xs.length;
    };
    expect(ownShare(1)).toBeLessThan(ownShare(3));
    expect(ownShare(3)).toBeLessThan(ownShare(5));
  });

  it('시대 보정: 지난 세상은 어머니 나이가 6세쯤 어리고 형제가 많으며, 다가올 세상은 첫째가 조금 많다 (설계값, 표대로)', () => {
    const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
    const past = sample('past');
    const present = sample('present');
    const future = sample('future');
    expect(mean(present.map((x) => x.report.mother.age)) - mean(past.map((x) => x.report.mother.age))).toBeGreaterThan(5);
    expect(mean(past.map((x) => x.report.birthOrder))).toBeGreaterThan(mean(present.map((x) => x.report.birthOrder)) + 0.5);
    const first = (xs: typeof past) => xs.filter((x) => x.report.birthOrder === 1).length / xs.length;
    expect(first(future)).toBeGreaterThan(first(present));
    // 지난 세상 직업: 농림어업이 지금보다 훨씬 많다
    const agri = (xs: typeof past) => xs.filter((x) => x.report.father.job === 'agri').length / xs.length;
    expect(agri(past)).toBeGreaterThan(agri(present) * 3);
  });
});

describe('출생 체중의 순위 표현 (R-018 규칙, 같은 성별 출생아 중)', () => {
  it('40칸 전부(두 성별): 퍼센트는 항상 1~50, 약 0%·약 100%·50 초과 없음, 상위/하위/중간 중 하나', () => {
    for (const g of GENDERS) {
      for (const kg of getBirthStats().weight[g].values) {
        const s = weightStanding(kg, g);
        const text = standingLabel(s);
        if (s.kind === 'middle') {
          expect(text).toBe('가운데쯤');
          continue;
        }
        expect(s.percent, `${g} ${kg}kg`).toBeGreaterThanOrEqual(1);
        expect(s.percent, `${g} ${kg}kg`).toBeLessThanOrEqual(50);
        expect(text).not.toMatch(/약 (0|100)%/);
      }
    }
  });

  it('직접 계산한 값: 남자 3.3kg의 이상 비율 = (3.3 이상 칸의 확률 합)이고, 가벼울수록 하위·무거울수록 상위로 단조롭다', () => {
    const rows = ind('birth-weight').rows!.filter((r) => r.bin !== '미상');
    const total = rows.reduce((a, r) => a + (r.male as number), 0);
    const bins = ['1.5kg 미만', '1.5~1.9kg', '2.0~2.4kg', '2.5~2.9kg', '3.0~3.4kg', '3.5~3.9kg', '4.0~4.4kg', '4.5kg 이상'];
    const count = (bin: string) => rows.find((r) => r.bin === bin)![('male') as 'male'] as number;
    // 3.3kg = 3.0~3.4kg 구간의 네 번째 칸(3.0·3.1·3.2·3.3·3.4): 3.3 이상 = 3.3·3.4 두 칸 + 위 구간 전부
    const atLeast = (count('3.0~3.4kg') * 2) / 5 + count('3.5~3.9kg') + count('4.0~4.4kg') + count('4.5kg 이상');
    const atMost = (count('3.0~3.4kg') * 4) / 5 + count('2.5~2.9kg') + count('2.0~2.4kg') + count('1.5~1.9kg') + count('1.5kg 미만');
    expect(bins.length).toBe(8);
    const s = weightStanding(3.3, 'male');
    const topPct = (atLeast / total) * 100;
    const bottomPct = (atMost / total) * 100;
    if (topPct <= 50) expect(s).toMatchObject({ kind: 'top', percent: Math.max(1, Math.round(topPct)) });
    else if (bottomPct <= 50) expect(s).toMatchObject({ kind: 'bottom' });
    else expect(s).toEqual({ kind: 'middle' });
    const rank = (kg: number) => {
      const st = weightStanding(kg, 'male');
      return st.kind === 'top' ? 100 - st.percent : st.kind === 'bottom' ? st.percent : 50;
    };
    let prev = -1;
    for (const kg of getBirthStats().weight.male.values) {
      expect(rank(kg), `${kg}kg`).toBeGreaterThanOrEqual(prev);
      prev = rank(kg);
    }
    expect(() => weightStanding(9.9, 'male')).toThrow(RangeError);
  });
});

describe('한 줄 서술문 (BR3, 합쇼체)과 서류의 장소 표기', () => {
  it('형식: 「{연}년 {월}월, {장소}의 {형편} 가정에서 {체중}kg {남자아이|여자아이}로 태어났습니다. {순서}입니다. ({체중}kg은 …)」 — 세 시대 × 시드 300개 전부', () => {
    const FORMAT = /^\d{4}년 \d{1,2}월, .+의 .+ 가정에서 \d\.\dkg (남자아이|여자아이)로 태어났습니다\. (첫째|둘째|셋째|넷째|다섯째 이상)입니다\. \(\d\.\dkg은 (상위 약 \d+%|하위 약 \d+%|상위 1% 안쪽|하위 1% 안쪽|가운데쯤)\)$/;
    for (const era of ERAS) {
      for (let seed = 1; seed <= 300; seed++) {
        const { character: c, report: r } = generateBirthFromSeed(seed * 31, era);
        const text = birthSentence(c, r, era);
        expect(text, `${era} ${seed}`).toMatch(FORMAT);
        expect(text).toContain(WEALTH_ADJECTIVE[c.parentWealth]);
        expect(text).toContain(reportPlaceLabel(r, era));
        expect(text).toContain(formatKg(r.birthWeightKg));
        expect(text, '수저 이름·구간·소득 분위 표현이 없다(인생 기록 첫 줄, C4)').not.toMatch(/수저|다이아|분위|하위 \d+% 안쪽의|%와/);
        expect(text).not.toMatch(/!|[\u{1F300}-\u{1FAFF}]/u);
        expect(text.startsWith(`${c.birthYear}년`)).toBe(true);
      }
    }
  });

  it('인생 기록 0세 첫 줄 = 같은 문장 (출생신고 「살아가기」 → enterLife)', () => {
    for (const era of ERAS) {
      const born = enterBirth(beginBirth(createInitialState(4242), era));
      const life = enterLife(born);
      expect(life.history[0]).toMatchObject({ age: 0, kind: 'stage', text: birthSentence(born.character!, born.birthReport!, era) });
      expect(life.history[0].text.length).toBeLessThanOrEqual(400); // HISTORY_LIMITS.maxTextLength
    }
  });

  it('placeLabel: 세종은 한 번만, 전남광주 구는 통합 이름 + 시군구, 새 구는 시 이름과 함께, 지난 세상은 합쳐진 시·도의 원래 이름을 밝힌다', () => {
    expect(placeLabel({ region: '세종', sigunguSido: '세종', sigungu: '세종특별자치시' }, 'present')).toBe('세종특별자치시');
    expect(placeLabel({ region: '전남광주', sigunguSido: '전남', sigungu: '순천시' }, 'present')).toBe('전남광주통합특별시 순천시');
    expect(placeLabel({ region: '전남광주', sigunguSido: '광주', sigungu: '동구' }, 'future')).toBe('전남광주통합특별시 동구');
    expect(placeLabel({ region: '경기', sigunguSido: '경기', sigungu: '화성시 동탄구' }, 'present')).toBe('경기도 화성시 동탄구');
    expect(placeLabel({ region: '제주', sigunguSido: '제주', sigungu: '제주시' }, 'present')).toBe('제주특별자치도 제주시');
    expect(placeLabel({ region: '경기', sigunguSido: '인천', sigungu: '중구' }, 'past')).toBe('경기도 인천 중구');
    expect(placeLabel({ region: '경기', sigunguSido: '경기', sigungu: '수원시 장안구' }, 'past')).toBe('경기도 수원시 장안구');
    expect(placeLabel({ region: '부산', sigunguSido: '부산', sigungu: '동래구' }, 'past')).toBe('부산직할시 동래구');
    expect(placeLabel({ region: '충남', sigunguSido: '세종', sigungu: '세종특별자치시' }, 'past')).toBe('충청남도 세종 지역');
    expect(() => formalSido('없는시', 'present')).toThrow(RangeError);
    expect(() => formalSido('전남광주', 'past')).toThrow(RangeError); // 지난 세상에는 통합 이름이 없다
  });

  it('sortRegions: 룰렛 지역 순서(copy.md)대로 정렬하고, 지금 세상 16개는 서울·부산·…·전남광주·…·제주 순서다', () => {
    const names = sortRegions(regionsOf(2026).regions).map((r) => r.name);
    expect(names).toEqual(['서울', '부산', '대구', '인천', '대전', '울산', '세종', '경기', '강원', '충북', '충남', '전북', '전남광주', '경북', '경남', '제주']);
    expect(REGION_ORDER.indexOf('전남광주')).toBeGreaterThan(REGION_ORDER.indexOf('전북'));
    // 지난 세상 목록도 같은 순서의 부분 목록이다
    const past = sortRegions(regionsOf(1970).regions).map((r) => r.name);
    expect(past).toEqual(REGION_ORDER.filter((n) => past.includes(n)));
  });
});

describe('저장 검증: 손상·변조된 출생신고 상세는 거부한다 (isValidBirthReport)', () => {
  const good = generateBirthFromSeed(5, 'present');
  const ok = (r: unknown, year = good.character.birthYear, g: Gender = good.character.gender) => isValidBirthReport(r, year, g);
  const base = good.report;

  it('원본은 통과하고, 필드가 하나라도 어긋나면 거부한다', () => {
    expect(ok(base)).toBe(true);
    const bad: Array<[string, unknown]> = [
      ['null', null],
      ['배열', []],
      ['월 0', { ...base, month: 0 }],
      ['월 13', { ...base, month: 13 }],
      ['월 소수', { ...base, month: 1.5 }],
      ['지역 없음', { ...base, region: '화성' }],
      ['지난 세상 지역(울산 아님·광주)', { ...base, region: '광주' }],
      ['시군구 없음', { ...base, sigungu: '없는구' }],
      ['시군구가 다른 지역', { ...base, region: base.region === '서울' ? '부산' : '서울' }],
      ['시·도 이름 틀림', { ...base, sigunguSido: '없는도' }],
      ['어머니 나이 10', { ...base, mother: { ...base.mother, age: 10 } }],
      ['아버지 나이 99', { ...base, father: { ...base.father, age: 99 } }],
      ['직업 이상값', { ...base, mother: { ...base.mother, job: '무직' } }],
      ['직업 누락', { ...base, father: { age: 30 } }],
      ['주거 이상값', { ...base, housing: 'jeonse' }],
      ['체중 격자 밖(5.5)', { ...base, birthWeightKg: 5.5 }],
      ['체중 격자 밖(3.25)', { ...base, birthWeightKg: 3.25 }],
      ['체중 문자열', { ...base, birthWeightKg: '3.3' }],
      ['형제 순서 0', { ...base, birthOrder: 0 }],
      ['형제 순서 6', { ...base, birthOrder: 6 }],
      ['필드 누락', { month: 3 }],
    ];
    for (const [name, r] of bad) expect(ok(r), name).toBe(false);
  });

  it('지금 세상 지역은 지난 세상 출생 연도에서는 맞지 않는다(전남광주 ≠ 1970년의 목록)', () => {
    const jg = { ...base, region: '전남광주', sigunguSido: '전남', sigungu: '순천시' };
    expect(isValidBirthReport(jg, 2026, 'male')).toBe(true);
    expect(isValidBirthReport(jg, 1970, 'male')).toBe(false);
  });
});

describe('가족 정합 (BR6, CM9): 출생 때 정한 부모 나이·직업·형제 순서가 이후 사건과 모순되지 않는다', () => {
  it('parentAgeAt: 부모 나이는 해마다 오른다', () => {
    const p = { age: 30, job: 'clerk' } as const;
    expect(parentAgeAt(p, 0)).toBe(30);
    expect(parentAgeAt(p, 40)).toBe(70);
  });

  /** 부모·형제에 관한 기존 사건과 그 가족 조건(설계): 병환·임종 사건은 두 부모 중 나이가 많은 쪽이 그만한 나이일 때만, 동생이 생기는 사건은 첫째인 판에서만 말이 된다 */
  const PARENT_EVENTS: Array<{ id: string; min: number; max: number }> = [
    { id: 'middle-parents-care', min: 60, max: 100 },
    { id: 'middle-parents-farewell', min: 65, max: 100 },
  ];
  const olderParent = (r: BirthReport, age: number) => Math.max(parentAgeAt(r.mother, age), parentAgeAt(r.father, age));

  it('이벤트 데이터가 가족 조건을 실제로 걸고 있다(공허 통과 방지): 조건 값이 위 설계표와 같다', () => {
    for (const rule of PARENT_EVENTS) {
      const ev = EVENT_POOL.byId.get(rule.id)!;
      expect(ev.conditions?.parentAge, rule.id).toEqual({ min: rule.min, max: rule.max });
    }
    expect(EVENT_POOL.byId.get('infant-new-sibling')!.conditions?.birthOrder).toEqual({ max: 1 });
    // R-268: 동생이 생기는 때의 어머니 나이 상한
    expect(EVENT_POOL.byId.get('infant-new-sibling')!.conditions?.motherAge).toEqual({ max: 45 });
  });

  it('isEventEligible: 부모가 너무 많은 나이가 되는 판에서는 병환·임종 사건이 후보가 되지 않고, 알맞은 나이면 후보가 된다 / 동생 사건은 첫째만', () => {
    const base = { character: { name: '김민준', gender: 'male', birthYear: 2026, parentWealth: 3, parenting: 'free', looks: 50 } as never, stats: { wealth: 50, education: 50, health: 50, happiness: 50, relationships: 50 }, flags: new Set<string>(), era: 'present' as Era, seen: {} };
    const at = (age: number, motherBirthAge: number, fatherBirthAge: number, birthOrder = 1) => ({ ...base, age, family: { birthOrder, motherBirthAge, fatherBirthAge } });
    const farewell = EVENT_POOL.byId.get('middle-parents-farewell')!;
    const care = EVENT_POOL.byId.get('middle-parents-care')!;
    const sibling = EVENT_POOL.byId.get('infant-new-sibling')!;
    // 52세: 아버지가 태어날 때 40세면 92세 → 후보. 56세였다면 108세 → 후보가 아니다. 더 나이 많은 쪽 기준이라 어머니만 어려도 같다.
    expect(isEventEligible(farewell, at(52, 30, 40))).toBe(true);
    expect(isEventEligible(farewell, at(52, 30, 56))).toBe(false);
    expect(isEventEligible(farewell, at(52, 16, 16))).toBe(true); // 68세
    expect(isEventEligible(care, at(45, 28, 38))).toBe(true);
    expect(isEventEligible(care, at(60, 30, 45))).toBe(false); // 105세
    // 가족 정보를 모르면 가족 조건이 걸린 사건은 일어나지 않는다
    expect(isEventEligible(farewell, { ...base, age: 52 } as never)).toBe(false);
    expect(isEventEligible(farewell, { ...base, age: 52, family: null } as never)).toBe(false);
    // 동생 사건: 첫째만
    expect(isEventEligible(sibling, at(3, 30, 33, 1))).toBe(true);
    for (const order of [2, 3, 4, 5]) expect(isEventEligible(sibling, at(3, 30, 33, order)), `${order}번째`).toBe(false);
    // R-268: 어머니가 동생을 낳을 때 45세를 넘으면 후보가 아니다 (사건 시점 어머니 나이 = 출생 때 나이 + 아이 나이, 아버지 나이는 상관없다)
    expect(isEventEligible(sibling, at(2, 43, 33, 1)), '어머니 45세').toBe(true);
    expect(isEventEligible(sibling, at(3, 43, 33, 1)), '어머니 46세').toBe(false);
    expect(isEventEligible(sibling, at(2, 47, 50, 1)), '어머니 49세').toBe(false);
    expect(isEventEligible(sibling, at(4, 40, 60, 1)), '어머니 44세, 아버지가 많아도').toBe(true); // M7a: 동생 사건은 2~4세(옛 2~6세라 6세·어머니 38세였다)
    expect(isEventEligible(sibling, at(5, 39, 33, 1)), '5세는 창(2~4세) 밖').toBe(false);
    expect(isEventEligible(sibling, at(1, 30, 33, 1)), '1세는 창(2~4세) 밖').toBe(false);
  });

  it('R-268: 출생 때 어머니가 높은 나이인 판 400개 — 동생 사건이 일어난 나이에 어머니는 45세 이하이고, 어머니 47세 판에서는 동생 사건이 없다 / 어머니 38세 판에서는 있다(공허 통과 방지)', () => {
    const withMother = (seed: number, era: Era, motherAge: number) => {
      const start = startLife(seed * 29, era);
      return { ...start, birthReport: { ...start.birthReport!, birthOrder: 1, mother: { ...start.birthReport!.mother, age: motherAge } } };
    };
    for (const era of ERAS) {
      const counts = { old: 0, young: 0 };
      for (let seed = 1; seed <= 400; seed++) {
        for (const [key, motherAge] of [['old', 47], ['young', 38]] as const) {
          const end = playToEnd(withMother(seed, era, motherAge), chooserFor('random', seed)).state;
          for (const h of end.history) {
            if (h.eventId !== 'infant-new-sibling') continue;
            counts[key]++;
            expect(motherAge + h.age, `${era} 시드 ${seed} 어머니 출생 때 ${motherAge}세, 동생 사건 ${h.age}세`).toBeLessThanOrEqual(45);
          }
        }
      }
      expect(counts.old, `${era}: 어머니가 47세인 판에는 동생 사건이 없다`).toBe(0);
      expect(counts.young, `${era}: 공허 통과 방지 — 어머니가 38세인 판에는 동생 사건이 나온다`).toBeGreaterThan(0);
    }
  });

  for (const era of ERAS) {
    it(`${era}: 한 판 400개 — 부모 병환·임종 사건이 일어난 나이에 나이 많은 부모가 설계 범위 안이고, 동생 사건은 첫째 판에서만 나오며, 사별(parents_gone)이 있으면 그 사건이 있었다`, () => {
      let seen = 0;
      let sibling = 0;
      for (let seed = 1; seed <= 400; seed++) {
        const start = startLife(seed * 17, era);
        const end = playToEnd(start, chooserFor('random', seed)).state;
        const r = end.birthReport!;
        for (const h of end.history) {
          if (h.eventId === 'infant-new-sibling') {
            sibling++;
            expect(r.birthOrder, `${era} 시드 ${seed} 동생 사건`).toBe(1);
            expect(parentAgeAt(r.mother, h.age), `${era} 시드 ${seed} 동생 사건 ${h.age}세 — 어머니 나이 (R-268)`).toBeLessThanOrEqual(45);
          }
          const rule = PARENT_EVENTS.find((e) => e.id === h.eventId);
          if (rule === undefined) continue;
          seen++;
          const older = olderParent(r, h.age);
          expect(older, `${era} 시드 ${seed} ${rule.id} ${h.age}세`).toBeGreaterThanOrEqual(rule.min);
          expect(older, `${era} 시드 ${seed} ${rule.id} ${h.age}세`).toBeLessThanOrEqual(rule.max);
        }
        // 사별 플래그: 임종 사건에서만 켜진다(그 사건이 나이 조건을 통과했다는 뜻)
        if (end.flags.includes('parents_gone')) expect(end.history.some((h) => h.eventId === 'middle-parents-farewell'), `${era} 시드 ${seed}`).toBe(true);
        // 출생신고 서술문의 형제 순서와 저장된 순서가 같다
        expect(end.history[0].text).toContain(`${BIRTH_ORDER_LABEL[r.birthOrder]}입니다.`);
      }
      expect(seen, '공허 통과 방지: 부모 병환·임종 사건이 실제로 나온 판이 있다').toBeGreaterThan(20);
      expect(sibling, '공허 통과 방지: 동생 사건이 나온 판이 있다').toBeGreaterThan(0);
    });
  }
});

describe('출생신고 상세 소스 점검: 난수는 시드 RNG뿐이다', () => {
  it('birthReport.ts에 Math.random·Date가 없다', () => {
    const code = codeOnly(birthReportSrc); // 주석은 빼고 코드만 본다
    expect(code.trim().length).toBeGreaterThan(500);
    expect(code).not.toContain('Math.random');
    expect(code).not.toMatch(/Date\.now|new Date/);
  });
});
