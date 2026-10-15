import rawJson from '../src/data/names.json';
import scourtJson from '../src/data/sources/scourt-birth-names.json';
import { describe, expect, it } from 'vitest';
import { ERAS, createRng, generateBirthFromSeed, namePoolFor, namePoolIdOf, pickFullName, surnameWeights, type Gender } from '../src/core';
import { ERA_CONFIG } from '../src/data/birthTable';
import { validateOfficialRows } from '../src/data/names';
import { EPS, sigmaTolerancePct } from './helpers/stats';

/**
 * 구현(src/data/names.ts, src/core/birth.ts의 풀 함수)을 거치지 않고 두 JSON 파일을 직접 읽어 독립적으로 검증한다.
 *  - names.json: 지난 세상 연대 풀 + 성씨 + 메타
 *  - scourt-birth-names.json: 법원 통계서비스 원자료(지금 세상·다가올 세상의 풀 출처)
 */
interface PastPool {
  verified: string[];
  estimated: string[];
}
const raw = rawJson as unknown as {
  meta: {
    title: string;
    structure: string;
    how: string;
    eras: {
      present: { birthYears: { min: number; max: number }; level: string; derivation: string; source: string; rawFile: string };
      future: { birthYears: { min: number; max: number }; level: string; source: string; sourceYears: number[]; derivation: string; note: string };
      past: { birthYears: { min: number; max: number }; level: string; source: string; derivation: string };
    };
    sources: { id: string; name: string; url: string }[];
    verificationLevels: Record<string, string>;
    caveats: string[];
    attribution: { text: string; url: string };
  };
  surnames: { basis: string; censusYear: number; items: { name: string; populationThousands: number }[] };
  decades: Record<string, { verification: string; basis: string[]; male: PastPool; female: PastPool }>;
};
interface Row {
  rank: number;
  name: string;
  count: number;
  ratio: number | null;
}
const scourt = scourtJson as unknown as {
  meta: { url: string; suggestedAttribution: string };
  years: Record<string, { M: Row[]; F: Row[] }>;
};

const GENDER_COL: Record<Gender, 'M' | 'F'> = { male: 'M', female: 'F' };
const PAST_DECADES = ['1950', '1960', '1970', '1980'];
const PRESENT_YEARS = Array.from({ length: 2025 - 2008 + 1 }, (_, i) => 2008 + i);
const FUTURE_SOURCE_YEARS = [2021, 2022, 2023, 2024, 2025];
const HANGUL_NAME = /^[가-힣]{2,3}$/;

/** 원자료에서 (연도, 성별)의 이름 목록을 독립적으로 읽는다. */
const officialNames = (year: number, gender: Gender): string[] => scourt.years[String(year)][GENDER_COL[gender]].map((r) => r.name);

/** 다가올 세상 기대 풀: 2021~2025 원자료 성별별 합집합(중복 제거, 처음 나온 순서) */
function expectedFuturePool(gender: Gender): string[] {
  const out: string[] = [];
  for (const y of FUTURE_SOURCE_YEARS) for (const n of officialNames(y, gender)) if (!out.includes(n)) out.push(n);
  return out;
}

/** 지난 세상 기대 풀: names.json의 연대 풀(verified + estimated) */
function expectedPastPool(birthYear: number, gender: Gender): string[] {
  const d = raw.decades[String(Math.floor(birthYear / 10) * 10)][gender];
  return [...d.verified, ...d.estimated];
}

/** 시대별 기대 풀: 구현을 거치지 않는 독립 계산 */
function allowedGiven(birthYear: number, gender: Gender): string[] {
  if (birthYear >= 1950 && birthYear <= 1989) return expectedPastPool(birthYear, gender);
  if (birthYear >= 2008 && birthYear <= 2025) return officialNames(birthYear, gender);
  if (birthYear >= 2030 && birthYear <= 2060) return expectedFuturePool(gender);
  throw new Error(`테스트 오류: ${birthYear}년은 어느 시대에도 속하지 않는다`);
}

function allStrings(v: unknown): string[] {
  if (typeof v === 'string') return [v];
  if (Array.isArray(v)) return v.flatMap(allStrings);
  if (v && typeof v === 'object') return Object.values(v).flatMap(allStrings);
  return [];
}

describe('원자료(scourt-birth-names.json) 구조 — 풀의 재료', () => {
  it('2008~2025 모든 연도 × 남/녀에 이름 행이 있고, 연도 키가 정확히 2008~2025다', () => {
    expect(Object.keys(scourt.years).map(Number).sort((a, b) => a - b)).toEqual(PRESENT_YEARS);
    for (const y of PRESENT_YEARS) {
      for (const g of ['M', 'F'] as const) {
        const rows = scourt.years[String(y)][g];
        expect(Array.isArray(rows), `${y}년 ${g}`).toBe(true);
        expect(rows.length, `${y}년 ${g} 행 수`).toBeGreaterThanOrEqual(20);
        const names = rows.map((r) => r.name);
        expect(new Set(names).size, `${y}년 ${g} 중복 없음`).toBe(names.length);
        for (const n of names) expect(n, `${y}년 ${g}`).toMatch(HANGUL_NAME);
        // 순위는 비내림차순(동점은 같은 순위), 첫 순위는 1
        expect(rows[0].rank).toBe(1);
        for (let i = 1; i < rows.length; i++) expect(rows[i].rank).toBeGreaterThanOrEqual(rows[i - 1].rank);
      }
    }
  });
});

describe('원자료 구조 보강 (R-026): 이름이 아닌 행·건수·순위·합계의 정합', () => {
  const NON_NAME = ['기타', '합계', '총계', '소계', '전체'];
  const totals = (scourtJson as unknown as {
    meta: { topN: number };
    totals: Record<string, Record<'M' | 'F', { top20Sum: number; othersCount: number; othersRatio: number; totalCount: number }>>;
  });

  it('meta.topN은 20이고 모든 칸(연도 × 남/녀 36개)의 행 수가 정확히 topN이다', () => {
    expect(totals.meta.topN).toBe(20);
    let cells = 0;
    for (const y of PRESENT_YEARS) {
      for (const g of ['M', 'F'] as const) {
        expect(scourt.years[String(y)][g], `${y}년 ${g}`).toHaveLength(totals.meta.topN);
        cells++;
      }
    }
    expect(cells).toBe(36);
  });

  it('"기타"·"합계" 같은 이름이 아닌 행이 한 칸에도 없다 (서비스 표의 21위 이하 묶음/합계 행이 풀에 섞이지 않았다)', () => {
    for (const y of PRESENT_YEARS) {
      for (const g of ['M', 'F'] as const) {
        for (const r of scourt.years[String(y)][g]) expect(NON_NAME, `${y}년 ${g} ${r.name}`).not.toContain(r.name);
      }
    }
    // 이 검사가 실제로 가른다: 한글 2자라 기존 이름 형식 검사(HANGUL_NAME)는 "기타"를 통과시킨다
    expect('기타').toMatch(HANGUL_NAME);
  });

  it('건수는 위에서 아래로 늘지 않고(비증가), 모두 양의 정수다', () => {
    for (const y of PRESENT_YEARS) {
      for (const g of ['M', 'F'] as const) {
        const rows = scourt.years[String(y)][g];
        for (let i = 0; i < rows.length; i++) {
          expect(Number.isInteger(rows[i].count) && rows[i].count > 0, `${y}년 ${g} ${rows[i].name}`).toBe(true);
          if (i > 0) expect(rows[i].count, `${y}년 ${g} ${rows[i].name}`).toBeLessThanOrEqual(rows[i - 1].count);
        }
      }
    }
  });

  it('순위는 건수와 맞다: 동점이면 같은 순위, 다음 순위는 건너뛴다(공동 1위 뒤는 3위). 순위 = 1 + 자기보다 건수가 많은 행 수', () => {
    let ties = 0;
    for (const y of PRESENT_YEARS) {
      for (const g of ['M', 'F'] as const) {
        const rows = scourt.years[String(y)][g];
        for (const r of rows) {
          const expected = 1 + rows.filter((o) => o.count > r.count).length;
          expect(r.rank, `${y}년 ${g} ${r.name}`).toBe(expected);
        }
        ties += rows.filter((r, i) => i > 0 && r.rank === rows[i - 1].rank).length;
      }
    }
    expect(ties, '원자료에 공동 순위가 실제로 있다(이 검사가 동점 규칙을 시험한다)').toBeGreaterThan(0);
  });

  it('totals: 연도 키가 2008~2025이고, top20Sum = 상위 20개 건수 합, totalCount = top20Sum + othersCount', () => {
    expect(Object.keys(totals.totals).map(Number).sort((a, b) => a - b)).toEqual(PRESENT_YEARS);
    for (const y of PRESENT_YEARS) {
      for (const g of ['M', 'F'] as const) {
        const t = totals.totals[String(y)][g];
        const sum = scourt.years[String(y)][g].reduce((a, r) => a + r.count, 0);
        expect(t.top20Sum, `${y}년 ${g} top20Sum`).toBe(sum);
        expect(t.totalCount, `${y}년 ${g} totalCount`).toBe(t.top20Sum + t.othersCount);
        expect(t.othersCount, `${y}년 ${g} othersCount`).toBeGreaterThan(0);
        // "기타"(21위 이하)가 상위 20개 합보다 크다 = 20개 이름이 전체의 일부일 뿐이다
        expect(t.othersRatio).toBeCloseTo((t.othersCount / t.totalCount) * 100, 1);
      }
    }
  });

  it('행의 ratio는 상위 20개 합계 대비 비율이다 (count / top20Sum × 100, ±0.01)', () => {
    for (const y of PRESENT_YEARS) {
      for (const g of ['M', 'F'] as const) {
        const sum = totals.totals[String(y)][g].top20Sum;
        for (const r of scourt.years[String(y)][g]) {
          expect(r.ratio, `${y}년 ${g} ${r.name}`).not.toBeNull();
          expect(Math.abs(r.ratio! - (r.count / sum) * 100), `${y}년 ${g} ${r.name}`).toBeLessThanOrEqual(0.01);
        }
      }
    }
  });

  it('로더의 검사(validateOfficialRows)가 잘못된 칸을 거부한다: 기타·합계 행, 건수 증가, 순위 불일치, 중복, 형식 오류', () => {
    const rows = (...r: Array<[number, string, number]>) => r.map(([rank, name, count]) => ({ rank, name, count, ratio: null }));
    const good = rows([1, '민준', 100], [2, '서준', 90], [2, '하준', 90], [4, '도윤', 80]);
    expect(() => validateOfficialRows('t', good)).not.toThrow();
    expect(() => validateOfficialRows('t', [])).toThrow(/이름 행이 없다/);
    expect(() => validateOfficialRows('t', rows([1, '민준', 100], [2, '기타', 50]))).toThrow(/이름이 아닌 행/);
    expect(() => validateOfficialRows('t', rows([1, '민준', 100], [2, '합계', 50]))).toThrow(/이름이 아닌 행/);
    expect(() => validateOfficialRows('t', rows([1, '민준', 100], [2, '서준', 120]))).toThrow(/내림차순/);
    expect(() => validateOfficialRows('t', rows([1, '민준', 100], [2, '서준', 90], [3, '하준', 90]))).toThrow(/순위가 건수와 맞지 않는다/);
    expect(() => validateOfficialRows('t', rows([1, '민준', 100], [3, '서준', 90]))).toThrow(/순위가 건수와 맞지 않는다/);
    expect(() => validateOfficialRows('t', rows([1, '민준', 100], [2, '민준', 90]))).toThrow(/중복/);
    expect(() => validateOfficialRows('t', rows([1, '민준', 100], [2, 'abc', 90]))).toThrow(/이름 형식/);
    expect(() => validateOfficialRows('t', rows([1, '민준', 0]))).toThrow(/양의 정수/);
  });
});

describe('names.json 구조 — 지난 세상 연대 풀과 메타', () => {
  it('연대 풀은 1950·1960·1970·1980년대뿐이다 (도달할 수 없는 1990~2020년대 풀과 언론 기반 출처 설명은 없다)', () => {
    expect(Object.keys(raw.decades).sort()).toEqual(PAST_DECADES);
    const text = JSON.stringify(raw);
    expect(text).not.toContain('namechart');
    expect(text).not.toContain('NAMECHART');
    expect(text).not.toContain('stats-single-year');
    expect(text).not.toContain('stats-two-years');
    expect(raw.meta.sources.map((s) => s.id).sort()).toEqual(['ETODAY', 'FN', 'KOSTAT2015', 'SCOURT', 'SEOUL']);
  });

  it('출처·검증 수준·주의사항이 새 구조에 맞게 적혀 있다', () => {
    expect(raw.meta.sources.length).toBeGreaterThanOrEqual(3);
    expect(raw.meta.caveats.length).toBeGreaterThan(0);
    expect(Object.keys(raw.meta.verificationLevels).sort()).toEqual(['official-recent-union', 'official-scourt-top20', 'partial-estimated-supplement']);
    for (const d of PAST_DECADES) {
      const dec = raw.decades[d];
      expect(dec.verification).toBe('partial-estimated-supplement');
      expect(raw.meta.verificationLevels[dec.verification]).toBeTruthy();
      expect(dec.basis.length).toBeGreaterThan(0);
    }
    // 시대별 설명: 지금 세상은 법원 통계서비스 직접 조회, 지난 세상은 확인분 + 추정(통계 아님)
    expect(raw.meta.eras.present.level).toBe('official-scourt-top20');
    expect(raw.meta.eras.present.source).toBe('법원 전자가족관계등록시스템 통계서비스 직접 조회(등록일 기준 잠정치, 상위 20위)');
    expect(raw.meta.eras.present.rawFile).toBe('src/data/sources/scourt-birth-names.json');
    expect(raw.meta.eras.past.level).toBe('partial-estimated-supplement');
    expect(raw.meta.eras.past.source).toBe('언론 인용 확인분 + 추정 보충(통계 아님)');
    expect(raw.meta.eras.future.source).toContain('최근 5개 연도(2021~2025)의 합집합');
    expect(raw.meta.verificationLevels['partial-estimated-supplement']).toContain('통계가 아니다');
    expect(raw.meta.how).toContain('직접 조회');
  });

  it('meta.eras의 출생 연도 범위가 시대 표(ERA_CONFIG)와 같다 — 문서와 설정이 어긋나지 않는다', () => {
    for (const era of ERAS) expect(raw.meta.eras[era].birthYears, era).toEqual(ERA_CONFIG[era].birthYears);
    expect(raw.meta.eras.past.birthYears).toEqual({ min: 1950, max: 1989 });
    expect(raw.meta.eras.present.birthYears).toEqual({ min: 2008, max: 2025 });
    expect(raw.meta.eras.future.birthYears).toEqual({ min: 2030, max: 2060 });
  });

  it('추정(estimated) 이름을 통계라고 설명하는 문장이 없다: estimated를 말하는 모든 문장에 "통계가 아니"가 붙고, 지금·다가올 세상 설명에는 estimated가 없다', () => {
    const NOT_STATS = /통계(가)? ?아(니|닌|님)/;
    const strings = allStrings(raw.meta);
    // 식별자(level 값 'partial-estimated-supplement' 등, 공백 없는 문자열)가 아니라 문장만 본다
    const mentionsEstimated = strings.filter((s) => /\s/.test(s) && s.includes('estimated'));
    expect(mentionsEstimated.length).toBeGreaterThanOrEqual(3);
    for (const s of mentionsEstimated) expect(s, s).toMatch(NOT_STATS);
    // 연대 풀의 basis(출처 설명)에도 estimated를 통계로 소개하는 말이 없다
    for (const d of PAST_DECADES) for (const b of raw.decades[d].basis) expect(b).not.toContain('estimated');
    // 지금 세상·다가올 세상은 공식 통계만 쓴다: 설명에 estimated(추정 보충)가 섞이지 않는다
    for (const era of ['present', 'future'] as const) {
      for (const s of allStrings(raw.meta.eras[era])) expect(s, `${era}: ${s}`).not.toContain('estimated');
    }
    expect(raw.meta.attribution.text).not.toContain('estimated');
    expect(raw.meta.attribution.text).not.toContain('추정');
  });

  for (const d of PAST_DECADES) {
    for (const g of ['male', 'female'] as const) {
      it(`${d}년대 ${g}: 20개 이상, 중복 없음, verified/estimated 겹침 없음`, () => {
        const pool = raw.decades[d][g];
        const all = [...pool.verified, ...pool.estimated];
        expect(all.length).toBeGreaterThanOrEqual(20);
        expect(new Set(all).size).toBe(all.length);
        expect(pool.verified.length).toBeGreaterThanOrEqual(10);
        for (const n of all) expect(n).toMatch(HANGUL_NAME);
      });
    }
  }

  it('meta 설명의 수치가 실제 데이터와 일치한다: 지난 세상 verified 10~11개 / estimated 9~12개 / 합계 20~22개 (R-020)', () => {
    const pools = PAST_DECADES.flatMap((d) => [raw.decades[d].male, raw.decades[d].female]);
    const v = pools.map((p) => p.verified.length);
    const e = pools.map((p) => p.estimated.length);
    const total = pools.map((p) => p.verified.length + p.estimated.length);
    expect([Math.min(...v), Math.max(...v)]).toEqual([10, 11]);
    expect([Math.min(...e), Math.max(...e)]).toEqual([9, 12]);
    expect([Math.min(...total), Math.max(...total)]).toEqual([20, 22]);
    const caveat = raw.meta.caveats.find((c) => c.startsWith('지난 세상(1950~1989년생)의 풀은'));
    expect(caveat).toBeTruthy();
    expect(caveat).toContain('verified(언론이 인용한 대법원 자료로 확인) 10~11개');
    expect(caveat).toContain('estimated(추정) 9~12개');
    expect(caveat).toContain('합계 20~22개');
    expect(caveat).not.toContain('13개');
    expect(raw.meta.verificationLevels['partial-estimated-supplement']).toContain('verified(10~11개)');
  });

  it('다가올 세상 설명: 미래 통계는 존재하지 않아 최근 연도 풀을 사용한다고 명시하고, 기준 연도는 원자료의 최근 5개 연도다', () => {
    const f = raw.meta.eras.future;
    expect(f.note).toBe('미래 통계는 존재하지 않아 최근 연도 풀을 사용');
    expect(raw.meta.caveats.some((c) => c.includes('미래 통계는 존재하지 않아 최근 연도 풀을 사용'))).toBe(true);
    expect(f.level).toBe('official-recent-union');
    expect(f.sourceYears).toEqual(FUTURE_SOURCE_YEARS);
    const latestFive = Object.keys(scourt.years).map(Number).sort((a, b) => a - b).slice(-5);
    expect(f.sourceYears).toEqual(latestFive);
  });

  it('성씨: 상위 10개, 인구 내림차순, 김>이>박, 가중치에 쓰는 인구수와 출처만 남아 있다 (R-019)', () => {
    const items = raw.surnames.items;
    expect(items).toHaveLength(10);
    expect(items.slice(0, 3).map((s) => s.name)).toEqual(['김', '이', '박']);
    for (let i = 1; i < items.length; i++) {
      expect(items[i - 1].populationThousands).toBeGreaterThanOrEqual(items[i].populationThousands);
    }
    for (const s of items) {
      expect(s.name).toHaveLength(1);
      expect(Object.keys(s).sort()).toEqual(['name', 'populationThousands']);
      expect(Number.isInteger(s.populationThousands)).toBe(true);
      expect(s.populationThousands).toBeGreaterThan(0);
    }
    expect(items[0].populationThousands).toBe(10690);
    // 분모가 섞여 있던 비율(%) 필드는 없다. 출처(기준 조사·연도)와 설명은 meta에 있다.
    expect(Object.keys(raw.surnames).sort()).toEqual(['basis', 'censusYear', 'items']);
    expect(JSON.stringify(raw.surnames)).not.toMatch(/shareOfPopulationPct|shareSource|totalPopulationThousands/);
    expect(raw.surnames.censusYear).toBe(2015);
    expect(raw.surnames.basis).toContain('인구수에 비례');
    expect(raw.surnames.basis).toContain('2015');
  });
});

describe('타이틀 출처 표기(meta.attribution)는 원자료의 권장 표기와 같은 출처를 가리킨다', () => {
  it('기관·서비스명·기준·조회일이 원자료 suggestedAttribution에도 있고, 주소는 원자료 url과 같다', () => {
    const { text, url } = raw.meta.attribution;
    for (const part of ['대한민국 법원 전자가족관계등록시스템', '통계서비스', '상위 출생신고 이름 현황', '등록일 기준 잠정치', '2026-10-13']) {
      expect(scourt.meta.suggestedAttribution, `원자료 권장 표기에 "${part}"`).toContain(part);
      expect(text, `화면 표기에 "${part}"`).toContain(part);
    }
    expect(url).toBe(scourt.meta.url);
    expect(scourt.meta.suggestedAttribution).toContain(url);
    // 어느 시대 이름의 출처인지 밝힌다: 공식 통계를 쓰는 지금·다가올 세상만 (지난 세상 이름을 통계라고 하지 않는다)
    expect(text).toContain('지금 세상·다가올 세상');
    expect(text).not.toContain('지난 세상');
  });
});

describe('지금 세상 풀 (2008~2025년생): 출생 연도별 공식 통계 상위 20, 원자료와 일치', () => {
  for (const y of PRESENT_YEARS) {
    it(`${y}년생 남/녀 풀 = 원자료 ${y}년 행의 이름 전부 (순서까지), 20개 이상, 중복 없음`, () => {
      for (const g of ['male', 'female'] as const) {
        const pool = namePoolFor(y, g);
        expect(pool, `${y} ${g}`).toEqual(officialNames(y, g));
        expect(pool.length).toBeGreaterThanOrEqual(20);
        expect(new Set(pool).size).toBe(pool.length);
        expect(namePoolIdOf(y)).toEqual({ kind: 'present', year: y });
      }
    });
  }

  it('풀에는 비공식(estimated) 이름이 없다: 연도별 풀 = 그 해 원자료뿐이며, 지난 세상 추정 전용 이름은 어느 연도 풀에도 없다', () => {
    const everOfficial = new Set(PRESENT_YEARS.flatMap((y) => [...officialNames(y, 'male'), ...officialNames(y, 'female')]));
    const estimatedOnly = new Set(
      PAST_DECADES.flatMap((d) => [...raw.decades[d].male.estimated, ...raw.decades[d].female.estimated]).filter((n) => !everOfficial.has(n)),
    );
    expect(estimatedOnly.size).toBeGreaterThan(10); // 판별력: 추정 전용 이름이 실제로 존재한다
    for (const y of PRESENT_YEARS) {
      for (const g of ['male', 'female'] as const) {
        for (const n of namePoolFor(y, g)) expect(estimatedOnly.has(n), `${y} ${g} ${n}`).toBe(false);
      }
    }
    for (const g of ['male', 'female'] as const) for (const n of namePoolFor(2040, g)) expect(estimatedOnly.has(n)).toBe(false);
  });

  it('성별이 풀에 반영된다: 연도별 남자 풀과 여자 풀의 겹침은 절반 미만', () => {
    for (const y of PRESENT_YEARS) {
      const m = new Set(namePoolFor(y, 'male'));
      const overlap = namePoolFor(y, 'female').filter((n) => m.has(n)).length;
      expect(overlap, `${y}`).toBeLessThan(10);
    }
  });
});

describe('다가올 세상 풀 (2030~2060년생): 최근 5개 연도(2021~2025) 공식 풀의 성별별 합집합', () => {
  for (const g of ['male', 'female'] as const) {
    it(`${g}: 원자료 2021~2025의 합집합과 같고 중복이 없다`, () => {
      const expected = expectedFuturePool(g);
      expect(expected.length).toBeGreaterThan(20); // 여러 해를 합친 풀이라 한 해(20)보다 크다
      for (const y of [2030, 2045, 2060]) {
        const pool = namePoolFor(y, g);
        expect(pool).toEqual(expected);
        expect(new Set(pool).size).toBe(pool.length);
        expect(namePoolIdOf(y)).toEqual({ kind: 'future' });
      }
      // 한 해 풀의 이름이 하나도 빠지지 않는다
      for (const y of FUTURE_SOURCE_YEARS) for (const n of officialNames(y, g)) expect(expected).toContain(n);
    });
  }

  it('기준 연도 밖(2008~2020)의 이름은 합집합에 들어가지 않는다 — 판별력 있는 대조', () => {
    for (const g of ['male', 'female'] as const) {
      const onlyEarlier = PRESENT_YEARS.filter((y) => !FUTURE_SOURCE_YEARS.includes(y))
        .flatMap((y) => officialNames(y, g))
        .filter((n) => !expectedFuturePool(g).includes(n));
      expect(onlyEarlier.length).toBeGreaterThan(0);
      const pool = new Set(namePoolFor(2050, g));
      for (const n of onlyEarlier) expect(pool.has(n), `${g} ${n}`).toBe(false);
    }
  });
});

describe('지난 세상 풀 (1950~1989년생): names.json 연대 풀', () => {
  for (const [year, decade] of [
    [1950, '1950'],
    [1959, '1950'],
    [1960, '1960'],
    [1979, '1970'],
    [1980, '1980'],
    [1989, '1980'],
  ] as const) {
    it(`${year}년생 -> ${decade}년대 풀 (verified + estimated)`, () => {
      for (const g of ['male', 'female'] as const) {
        const d = raw.decades[decade][g];
        expect(namePoolFor(year, g)).toEqual([...d.verified, ...d.estimated]);
        expect(namePoolFor(year, g).length).toBeGreaterThanOrEqual(20);
      }
      expect(namePoolIdOf(year)).toEqual({ kind: 'past', decade: Number(decade) });
    });
  }
});

describe('풀을 찾는 연도 경계 — 기대값을 직접 적는다 (R-016)', () => {
  // [출생 연도, 기대 풀]. 매핑 식을 복제하지 않고 사람이 읽어서 정한 값이다.
  const ok: [number, ReturnType<typeof namePoolIdOf>][] = [
    [1950, { kind: 'past', decade: 1950 }], // 지난 세상 첫 해
    [1989, { kind: 'past', decade: 1980 }], // 지난 세상 마지막 해
    [2008, { kind: 'present', year: 2008 }], // 지금 세상 첫 해 (법원 통계서비스의 첫 해)
    [2025, { kind: 'present', year: 2025 }], // 지금 세상 마지막 해
    [2030, { kind: 'future' }], // 다가올 세상 첫 해
    [2060, { kind: 'future' }], // 다가올 세상 마지막 해
  ];
  for (const [year, id] of ok) {
    it(`${year}년생은 풀이 있다 -> ${JSON.stringify(id)}`, () => {
      expect(namePoolIdOf(year)).toEqual(id);
      expect(namePoolFor(year, 'male').length).toBeGreaterThanOrEqual(20);
      expect(namePoolFor(year, 'female').length).toBeGreaterThanOrEqual(20);
    });
  }

  for (const year of [1949, 1990, 2007, 2026, 2029]) {
    it(`${year}년생은 풀이 없어 throw한다 (다른 풀로 조용히 보내지 않는다)`, () => {
      expect(() => namePoolIdOf(year)).toThrow(RangeError);
      expect(() => namePoolFor(year, 'male')).toThrow(RangeError);
      expect(() => namePoolFor(year, 'female')).toThrow(RangeError);
      expect(() => pickFullName(createRng(1), year, 'female')).toThrow(RangeError);
    });
  }

  it('지난 세상과 지금 세상 사이(1990~2007), 지금과 다가올 사이(2026~2029), 그 밖(1949 이하·2061 이상)은 전부 throw', () => {
    const missing = [
      ...Array.from({ length: 2007 - 1990 + 1 }, (_, i) => 1990 + i),
      ...[2026, 2027, 2028, 2029],
      ...[2061, 2100, 2200],
      ...[1949, 1940, 1900, 0, -5],
    ];
    for (const year of missing) expect(() => namePoolIdOf(year), `${year}년`).toThrow(RangeError);
  });

  it('정수가 아닌 연도는 throw한다', () => {
    for (const year of [1999.5, 2008.5, NaN, Infinity, -Infinity]) expect(() => namePoolIdOf(year)).toThrow(RangeError);
  });

  it('시대 표의 출생 연도 범위는 직접 적은 값과 같고, 그 범위의 모든 연도는 throw 없이 풀을 찾는다', () => {
    expect(ERA_CONFIG.past.birthYears).toEqual({ min: 1950, max: 1989 });
    expect(ERA_CONFIG.present.birthYears).toEqual({ min: 2008, max: 2025 });
    expect(ERA_CONFIG.future.birthYears).toEqual({ min: 2030, max: 2060 });
    for (const era of ERAS) {
      const { min, max } = ERA_CONFIG[era].birthYears;
      for (let y = min; y <= max; y++) {
        expect(() => namePoolFor(y, 'male'), `${era} ${y}`).not.toThrow();
        expect(namePoolFor(y, 'female').length).toBeGreaterThanOrEqual(20);
      }
    }
  });
});

describe('성씨 가중 랜덤', () => {
  it('가중치는 인구수에 비례한다', () => {
    const w = surnameWeights();
    expect(w.map((x) => x.name)).toEqual(raw.surnames.items.map((s) => s.name));
    expect(w.map((x) => x.weight)).toEqual(raw.surnames.items.map((s) => s.populationThousands));
  });

  it('20000번 뽑은 성씨 비율이 가중치와 4σ 이내이고, 10개 성씨가 모두 1회 이상 나온다 (R-015)', () => {
    const rng = createRng(31337);
    const n = 20000;
    const counts = new Map<string, number>();
    for (let i = 0; i < n; i++) {
      const sur = pickFullName(rng, 2010, 'male')[0];
      counts.set(sur, (counts.get(sur) ?? 0) + 1);
    }
    const total = raw.surnames.items.reduce((a, s) => a + s.populationThousands, 0);
    // 표에 없는 성씨는 나오지 않고, 표의 성씨는 하나도 빠지지 않는다 (가장 작은 "임"도 포함)
    expect([...counts.keys()].sort()).toEqual(raw.surnames.items.map((s) => s.name).sort());
    for (const s of raw.surnames.items) {
      const count = counts.get(s.name) ?? 0;
      expect(count, `${s.name} 등장 횟수`).toBeGreaterThan(0);
      const expected = (s.populationThousands / total) * 100;
      const observed = (count / n) * 100;
      expect(Math.abs(observed - expected), `${s.name}: 관측 ${observed.toFixed(2)}% / 기대 ${expected.toFixed(2)}%`).toBeLessThanOrEqual(
        sigmaTolerancePct(expected, n) + EPS,
      );
    }
  });
});

describe('풀 안에서 균등 추첨 (시드 RNG)', () => {
  it('2015년 남자 풀(20개)을 20000번 뽑으면 20개 모두 나오고 각 비율이 1/20과 4σ 이내다', () => {
    const rng = createRng(2015);
    const n = 20000;
    const counts = new Map<string, number>();
    for (let i = 0; i < n; i++) {
      const given = pickFullName(rng, 2015, 'male').slice(1);
      counts.set(given, (counts.get(given) ?? 0) + 1);
    }
    const pool = officialNames(2015, 'male');
    expect([...counts.keys()].sort()).toEqual([...pool].sort());
    for (const name of pool) {
      const observed = ((counts.get(name) ?? 0) / n) * 100;
      expect(Math.abs(observed - 5), `${name}: ${observed.toFixed(2)}%`).toBeLessThanOrEqual(sigmaTolerancePct(5, n) + EPS);
    }
  });
});

/** SPEC-001 '시대 선택': 시대별 출생 연도 (지난 1950~1989 / 지금 2008~2025 / 다가올 2030~2060) */
const EXPECTED_BIRTH_YEARS = {
  past: { min: 1950, max: 1989 },
  present: { min: 2008, max: 2025 },
  future: { min: 2030, max: 2060 },
} as const;

describe('이름이 출생 연도·성별 풀과 100% 일치 (1000판 시뮬레이션, 원자료 직접 대조)', () => {
  const surnames = new Set(raw.surnames.items.map((s) => s.name));
  const everOfficial = new Set(PRESENT_YEARS.flatMap((y) => [...officialNames(y, 'male'), ...officialNames(y, 'female')]));
  const estimatedOnly = new Set(
    PAST_DECADES.flatMap((d) => [...raw.decades[d].male.estimated, ...raw.decades[d].female.estimated]).filter((n) => !everOfficial.has(n)),
  );

  for (const era of ERAS) {
    it(`${era}: 시드 1000개 전부 출생 연도·성별에 맞는 풀 안의 이름`, () => {
      // 기대 범위는 SPEC의 리터럴이다(구현이 읽는 ERA_CONFIG 표에서 다시 읽으면 항상 참이 된다 — R-032).
      const range = EXPECTED_BIRTH_YEARS[era];
      let mismatches = 0;
      const years = new Set<number>();
      const genders = new Set<string>();
      let estimatedHits = 0;
      for (let seed = 1; seed <= 1000; seed++) {
        const { character: c } = generateBirthFromSeed(seed * 7919, era);
        years.add(c.birthYear);
        genders.add(c.gender);
        const surname = c.name[0];
        const given = c.name.slice(1);
        // 독립 대조: 원자료/names.json에서 직접 계산한 허용 목록 (구현의 풀 함수를 거치지 않는다)
        const ok = surnames.has(surname) && allowedGiven(c.birthYear, c.gender).includes(given) && c.birthYear >= range.min && c.birthYear <= range.max;
        if (!ok) mismatches++;
        if (estimatedOnly.has(given)) estimatedHits++;
      }
      expect(mismatches).toBe(0);
      expect(genders.size).toBe(2);
      if (era === 'past') {
        // 지난 세상에는 추정 보충 이름이 실제로 섞여 있다 (구분 표기된 데이터)
        expect(estimatedHits).toBeGreaterThan(0);
        expect(new Set([...years].map((y) => Math.floor(y / 10) * 10))).toEqual(new Set([1950, 1960, 1970, 1980]));
      } else {
        // 지금 세상·다가올 세상에서 나온 이름 중 estimated/비공식 이름은 0개
        expect(estimatedHits).toBe(0);
      }
      if (era === 'present') expect(years.size).toBeGreaterThanOrEqual(15); // 2008~2025 대부분의 연도 풀을 실제로 썼다
      if (era === 'future') expect(years.size).toBeGreaterThanOrEqual(25);
    });
  }

  it('성별이 풀에 반영된다: 남자 풀과 여자 풀의 이름이 겹치는 것은 절반 미만 (지난·미래 풀)', () => {
    for (const d of PAST_DECADES) {
      const m = new Set([...raw.decades[d].male.verified, ...raw.decades[d].male.estimated]);
      const f = [...raw.decades[d].female.verified, ...raw.decades[d].female.estimated];
      expect(f.filter((n) => m.has(n)).length, `${d}년대`).toBeLessThan(f.length / 2);
    }
    const m = new Set(expectedFuturePool('male'));
    const f = expectedFuturePool('female');
    expect(f.filter((n) => m.has(n)).length).toBeLessThan(f.length / 2);
  });
});
