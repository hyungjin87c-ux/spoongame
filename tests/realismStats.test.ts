import { describe, expect, it } from 'vitest';
import stats from '../docs/data/realism-stats.json';
import koreaStats from '../src/data/koreaStats.json';
import statsDoc from '../docs/data/realism-stats.md?raw';
import calibrationDoc from '../docs/data/realism-calibration.md?raw';
import sourcesDoc from '../docs/data/korea-stats-sources.md?raw';
import { findLocalPathLeaks, localAccountNames } from './helpers/localPathLeaks';

/**
 * SPEC-004 GM2 — 현실성 보정용 생애 통계 DC20~DC25 (`docs/data/realism-stats.json`·`realism-stats.md`) 점검.
 * 값은 KOSIS 화면의 칸 그대로이고 비는 칸은 null이다. 여기서는 **합계 검산**(계 = 부분의 합, 남 + 여 = 계)과 저장소에 이미 있는 값과의 대조,
 * 문서·출처 기록이 빠지지 않았는지, 그리고 사용자 폴더 경로가 새지 않았는지만 본다. 값이 맞는지의 최종 근거는 원 표 화면이다.
 */

type Rows = Record<string, (number | null)[]>;
const sum = (xs: readonly (number | null)[]) => xs.reduce<number>((a, b) => a + (b ?? 0), 0);
const D = stats.datasets;

describe('realism-stats.json — 구성', () => {
  it('DC20~DC25 여섯 묶음이 모두 있고 수집일·이용 조건이 적혀 있다', () => {
    expect(Object.keys(D)).toEqual(['dc20_marital_status', 'dc21_first_marriage_age', 'dc22_fertility', 'dc23_housing_tenure', 'dc24_education', 'dc25_employment']);
    expect(D.dc20_marital_status.dc).toBe('DC20');
    expect(D.dc25_employment.dc).toBe('DC25');
    expect(stats.meta.collectedOn).toBe('2026-10-27');
    expect(stats.meta.usage).toContain('출처 명시');
    expect(stats.meta.valuePolicy).toContain('이어 붙이기·보간·추정 없음');
  });

  it('사용자 폴더 경로·계정 이름이 없다', async () => {
    const names = await localAccountNames();
    for (const [name, text] of [['json', JSON.stringify(stats)], ['stats.md', statsDoc]] as const) expect(findLocalPathLeaks(text, names), name).toEqual([]);
  });
});

describe('DC20 혼인 상태 — 합계 검산', () => {
  const years = D.dc20_marital_status.years as Record<string, { data: Record<string, Rows>; categories?: string[] }>;

  it('센서스 해 5개(2005·2010·2015·2020·2025)', () => {
    expect(Object.keys(years)).toEqual(['2005', '2010', '2015', '2020', '2025']);
  });

  it('각 칸에서 계 = 미혼 + 유배우 + (사별 + 이혼 또는 사별·이혼), 남 + 여 = 계 (X는 null)', () => {
    for (const [y, yr] of Object.entries(years)) {
      for (const sex of ['both', 'male', 'female']) {
        for (const [age, v] of Object.entries(yr.data[sex])) {
          if (v.some((x) => x === null)) continue; // 비밀보호 칸
          expect(sum(v.slice(1)), `${y}/${sex}/${age}`).toBe(v[0]);
        }
      }
      for (const [age, v] of Object.entries(yr.data.both)) {
        const m = yr.data.male[age];
        const f = yr.data.female[age];
        if (!m || !f || [v, m, f].some((r) => r.some((x) => x === null))) continue;
        expect(sum([m[0], f[0]]), `${y}/${age} 남+여`).toBe(v[0]);
      }
    }
  });

  it('조사 해가 늦을수록 50~54세 미혼 비율이 커진다(2.0 → 13.8%)', () => {
    const never = (y: string) => {
      const v = years[y].data.both['50~54세'];
      return (v[1] as number) / (v[0] as number);
    };
    expect(never('2005')).toBeCloseTo(0.02, 2);
    expect(never('2025')).toBeCloseTo(0.138, 2);
    expect(never('2010')).toBeGreaterThan(never('2005'));
    expect(never('2015')).toBeGreaterThan(never('2010'));
    expect(never('2020')).toBeGreaterThan(never('2015'));
    expect(never('2025')).toBeGreaterThan(never('2020'));
  });
});

describe('DC21 초혼 연령', () => {
  const fm = D.dc21_first_marriage_age;

  it('평균 초혼 연령 1990~2025 36개 해, 남편이 아내보다 늘 늦다', () => {
    expect(fm.meanAge.series).toHaveLength(36);
    expect(fm.meanAge.series[0].year).toBe(1990);
    expect(fm.meanAge.series[35].year).toBe(2025);
    for (const s of fm.meanAge.series) expect(s.husband, String(s.year)).toBeGreaterThan(s.wife);
  });

  it('저장소 koreaStats.json(first-marriage-age)의 2005·2025 값과 같다', () => {
    const ind = (koreaStats.indicators as Array<{ id: string; series?: { year: number; value: number }[]; extraSeries?: { series: { year: number; value: number }[] }[] }>).find((e) => e.id === 'first-marriage-age')!;
    const husband = (y: number) => ind.series!.find((s) => s.year === y)!.value;
    const wife = (y: number) => ind.extraSeries![0].series.find((s) => s.year === y)!.value;
    for (const y of [2005, 2015, 2025]) {
      const row = fm.meanAge.series.find((s) => s.year === y)!;
      expect(row.husband).toBe(husband(y));
      expect(row.wife).toBe(wife(y));
    }
  });

  it('초혼 연령대별 혼인 건수: 연령 칸의 합 = 계 (8개 해 × 남편·아내)', () => {
    const rows = fm.byAgeBand.rows as Record<string, Record<string, { husband: number | null; wife: number | null }>>;
    const ages = Object.keys(rows).filter((k) => k !== '계');
    expect(Object.keys(rows)[0]).toBe('계');
    for (const y of fm.byAgeBand.years) {
      for (const who of ['husband', 'wife'] as const) {
        const total = rows['계'][String(y)][who] as number;
        expect(sum(ages.map((a) => rows[a][String(y)][who])), `${y}/${who}`).toBe(total);
      }
    }
    // 40세 이상 초혼 비중이 커지는 방향(남편): 1990 0.6% → 2025 11.3%
    const late = (y: number) => {
      const t = rows['계'][String(y)].husband as number;
      const over40 = ['40~44세', '45~49세', '50~54세', '55~59세', '60~64세', '65~69세', '70~74세', '75세이상'].reduce((a, k) => a + (rows[k][String(y)].husband ?? 0), 0);
      return over40 / t;
    };
    expect(late(1990)).toBeCloseTo(0.006, 3);
    expect(late(2025)).toBeCloseTo(0.113, 3);
  });
});

describe('DC22 출산력', () => {
  const years = D.dc22_fertility.years as Record<string, { data: Record<string, { total: number; byChildren: (number | null)[]; totalChildren: number; meanChildren: number }> }>;

  it('기혼여성 계 = 출생자녀 0~10명 이상의 합, 평균 자녀 수는 총 자녀 수 ÷ 인구(소수 첫째 자리)', () => {
    for (const [y, yr] of Object.entries(years)) {
      for (const [age, e] of Object.entries(yr.data)) {
        expect(sum(e.byChildren), `${y}/${age}`).toBe(e.total);
        expect(Math.abs(e.totalChildren / e.total - e.meanChildren), `${y}/${age} 평균`).toBeLessThan(0.06);
      }
    }
  });

  it('50~54세 기혼여성의 무자녀 비율이 1.9(2010) → 3.3(2015) → 4.9%(2020)로 는다', () => {
    const r = (y: string) => years[y].data['50~54세'].byChildren[0]! / years[y].data['50~54세'].total;
    expect(r('2010')).toBeCloseTo(0.019, 3);
    expect(r('2015')).toBeCloseTo(0.033, 3);
    expect(r('2020')).toBeCloseTo(0.049, 3);
  });

  it('2020 초혼 연령별 표: 초혼 40세 이상 여성의 무자녀 비율이 80% 안팎(50~54세 81.2%)이고 합이 맞는다', () => {
    const t = D.dc22_fertility.byFirstMarriageAge2020.data as Record<string, Record<string, { total: number; byFirstMarriageAge: (number | null)[] }>>;
    for (const [age, rows] of Object.entries(t)) {
      const total = rows['계'];
      expect(sum(total.byFirstMarriageAge), `${age} 초혼 구간 합`).toBe(total.total);
      const byCount = ['0명', '1명', '2명', '3명', '4명', '5명이상'].map((k) => rows[k]);
      expect(sum(byCount.map((r) => r.total)), `${age} 자녀수 합`).toBe(total.total);
    }
    const r = t['50~54세'];
    expect(r['0명'].byFirstMarriageAge[6]! / r['계'].byFirstMarriageAge[6]!).toBeCloseTo(0.812, 3);
    expect(r['0명'].byFirstMarriageAge[5]! / r['계'].byFirstMarriageAge[5]!).toBeCloseTo(0.262, 3);
  });
});

describe('DC23 자가점유율', () => {
  const years = D.dc23_housing_tenure.years as Record<string, { data: Rows }>;

  it('일반가구 = 자가 + 전세 + 월세(보증금 있음·없음) + 사글세 + 무상, 연령 칸 합 = 합계', () => {
    for (const [y, yr] of Object.entries(years)) {
      const ages = Object.keys(yr.data).filter((k) => k !== '합계');
      for (const [age, v] of Object.entries(yr.data)) expect(sum(v.slice(1)), `${y}/${age}`).toBe(v[0]);
      for (let c = 0; c < yr.data['합계'].length; c++) expect(sum(ages.map((a) => yr.data[a][c])), `${y}/열${c}`).toBe(yr.data['합계'][c]);
    }
  });

  it('2020 자가 비율: 25~29세 15.1% · 50~54세 61.3% · 전체 57.3%', () => {
    const d = years['2020'].data;
    const own = (age: string) => (d[age][1] as number) / (d[age][0] as number);
    expect(own('25~29세')).toBeCloseTo(0.151, 3);
    expect(own('50~54세')).toBeCloseTo(0.613, 3);
    expect(own('합계')).toBeCloseTo(0.573, 3);
  });
});

describe('DC24 진학률', () => {
  const ed = D.dc24_education;

  it('1980~2025 46개 해, 모든 줄이 같은 길이이고 값은 0~100(%)', () => {
    expect(ed.years).toHaveLength(46);
    for (const [name, v] of Object.entries(ed.series as Record<string, (number | null)[]>)) {
      expect(v, name).toHaveLength(46);
      for (const x of v) {
        if (x === null) continue;
        expect(x).toBeGreaterThanOrEqual(0);
        expect(x).toBeLessThanOrEqual(101);
      }
    }
  });

  it('고교 졸업자의 대학 진학률: 1980 27.2% · 2005 82.1% · 2024 73.6%(저장소 s-077·s-090과 같다), 2025는 비어 있다', () => {
    const v = (ed.series as Record<string, (number | null)[]>)['고등학교 상급학교진학률'];
    expect(v[0]).toBe(27.2);
    expect(v[2005 - 1980]).toBe(82.1);
    expect(v[2024 - 1980]).toBe(73.6);
    expect(v[2025 - 1980]).toBeNull();
  });
});

describe('DC25 고용률·종사상 지위', () => {
  const emp = D.dc25_employment.employmentRate;
  const st = D.dc25_employment.statusOfWorker2020;

  it('연간 6개 해(2000~2025), 계 고용률 2025 = 62.9%(저장소 근거 줄과 같다), 남자 > 여자(30~54세)', () => {
    expect(emp.years).toEqual([2000, 2005, 2010, 2015, 2020, 2025]);
    const both = emp.rate.both as Record<string, (number | null)[]>;
    expect(both['계'][5]).toBe(62.9);
    for (const age of ['30~34세', '35~39세', '40~44세', '45~49세', '50~54세']) for (let i = 0; i < 6; i++) expect((emp.rate.male as Record<string, (number | null)[]>)[age][i]!, `${age}/${i}`).toBeGreaterThan((emp.rate.female as Record<string, (number | null)[]>)[age][i]!);
  });

  it('2020 종사상 지위: 취업인구 = 임금 + 고용원 없는·있는 자영업 + 무급가족, 계 = 남 + 여', () => {
    const data = st.data as Record<string, Rows>;
    for (const sex of ['both', 'male', 'female']) for (const [age, v] of Object.entries(data[sex])) expect(sum(v.slice(1)), `${sex}/${age}`).toBe(v[0]);
    for (const [age, v] of Object.entries(data.both)) expect((data.male[age][0] as number) + (data.female[age][0] as number), age).toBe(v[0]);
    const v = data.both['40~44세'];
    expect(((v[2] as number) + (v[3] as number)) / (v[0] as number)).toBeCloseTo(0.173, 3);
  });
});

describe('문서와 출처 기록', () => {
  it('realism-stats.md: DC20~DC25·이용 조건·접근 기록(R-149)·한계가 적혀 있다', () => {
    for (const k of ['DC20', 'DC21', 'DC22', 'DC23', 'DC24', 'DC25']) expect(statsDoc, k).toContain(k);
    expect(statsDoc).toContain('통계정보 이용지침');
    expect(statsDoc).toContain('R-149');
    expect(statsDoc).toContain('Claude/');
    expect(statsDoc).toContain('1970~1989');
    expect(statsDoc).toContain('공공누리');
  });

  it('korea-stats-sources.md: 이번 수집의 접근 기록·이용 조건·결과 절이 있다', () => {
    expect(sourcesDoc).toContain('SPEC-004 현실성 통계(2026-10-27) 접근 기록');
    expect(sourcesDoc).toContain('SPEC-004 현실성 통계(2026-10-27) 이용 조건');
    expect(sourcesDoc).toContain('### 3.15');
    expect(sourcesDoc).toContain('www.index.go.kr');
  });

  it('realism-calibration.md: L0 측정 결과·비교표·상위 5·마스터 결정 절이 있고 비교표에 R01~R13이 모두 있다', () => {
    for (const h of ['## 10. L0 측정 결과', '## 11. 통계와 같은 정의로 맞춘 비교표', '## 12. 차이가 큰 지표 상위 5', '## 13. 마스터가 정할 것']) expect(calibrationDoc, h).toContain(h);
    const section = calibrationDoc.slice(calibrationDoc.indexOf('### 11-2'));
    for (let i = 1; i <= 13; i++) expect(section, `R${String(i).padStart(2, '0')}`).toContain(`| R${String(i).padStart(2, '0')} |`);
    expect(calibrationDoc).toContain('H1(선택자 효과)은 확인');
  });
});
