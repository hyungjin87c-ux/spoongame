import statsJson from '../src/data/koreaStats.json';
import { describe, expect, it } from 'vitest';
import { GENERATION_IDS, PARENT_WEALTHS, R1_PRESENT } from '../src/core';
import { COMPARE_PROFILE, HOUSING_CLASS_LABEL, PRIVATE_EDU_BAND_BY_WEALTH, buildComparison, compareShown, lifeGapLine } from '../src/data/birthCompare';
import { createStatsAccess, formatNumber, getUsableIndicator, type StatsFile } from '../src/data/koreaStatsAccess';

/**
 * 출생신고 비교 표 「다른 집 아이들과 견주면」 (SPEC-003 BR5): 출처가 확인된 행만, 값은 koreaStats.json 원자료와 같다(직접 읽은 독립 기준).
 * REV-003-M3-1 마스터 결정: 「같은 소득 분위 유지」 행은 쓰지 않고(R-260), 기대수명 소득 격차는 표 칸이 아니라 모든 단계에 같은 한 줄 서술이며(R-261),
 * 비교 표는 지금 세상에서만 보인다(R-263). 행 만들기는 지표를 꺼내는 함수를 받아 「지표를 못 읽으면 행을 뺀다」를 직접 시험한다(R-273).
 */

interface Row {
  [key: string]: unknown;
}
const indicators = (statsJson as unknown as { indicators: Array<{ id: string; rows?: Row[]; persistence?: Record<string, number>; latest: { year: number; value: number } | null; usable: boolean; basisId: string; source: { org: string } | null; decimals?: number }> }).indicators;
const raw = (id: string) => indicators.find((i) => i.id === id)!;
const row = (id: string, key: string, value: string) => raw(id).rows!.find((r) => r[key] === value)!;

/** 원자료 파일에서 지표 몇 개를 바꾼 접근자 (지표를 못 읽거나 값이 다른 상황을 주입한다) */
function accessWith(patch: (i: StatsFile['indicators'][number]) => StatsFile['indicators'][number]) {
  const file = statsJson as unknown as StatsFile;
  return createStatsAccess({ ...file, indicators: file.indicators.map(patch) }).getUsableIndicator;
}

describe('비교 표 행 (BR5)', () => {
  it('모든 수저 단계에서 행 구성이 같다: 사교육 참여율 · 월평균 사교육비 · 자기 집에 사는 가구 3행 (흙수저만 행이 더 많지 않다)', () => {
    for (const w of PARENT_WEALTHS) expect(buildComparison(w).map((r) => r.id), `${w}단계`).toEqual(['private-edu-participation', 'private-edu-cost', 'owner-share']);
  });

  it('R-260: 「같은 소득 분위 유지」 행도 소득 이동성 지표(income-mobility)도 비교 표에 없다 — 개인 소득 1년 이동 통계를 가정 형편 칸에 놓지 않는다', () => {
    const mobility = raw('income-mobility').basisId;
    for (const w of PARENT_WEALTHS) {
      const rows = buildComparison(w);
      expect(rows.some((r) => (r.id as string) === 'income-persistence' || r.basisId === mobility), `${w}단계`).toBe(false);
      const text = rows.map((r) => `${r.label}${r.average}${r.child}${r.childNote}${r.source}`).join(' ');
      expect(text).not.toMatch(/소득 분위|분위|소득이동/);
    }
    // 공허 통과 방지: 그 지표는 실제로 usable이라 (쓰려면 쓸 수 있는데) 일부러 안 쓴다
    expect(getUsableIndicator('income-mobility')).toBeDefined();
  });

  it('모든 행에 항목·두 값·집단 설명·출처(기관, 조사 이름 (기준 연도))·근거 id(s-###)가 있고, 출처의 기준 연도는 지표의 최신 연도다', () => {
    for (const w of PARENT_WEALTHS) {
      for (const r of buildComparison(w)) {
        expect(r.label.length).toBeGreaterThan(1);
        expect(r.average.length).toBeGreaterThan(0);
        expect(r.child.length).toBeGreaterThan(0);
        expect(r.childNote.length).toBeGreaterThan(0);
        expect(r.source, r.id).toMatch(/^.+, .+ \(\d{4}년\)$/);
        expect(r.basisId, r.id).toMatch(/^s-\d{3}$/);
        expect(r.source).not.toMatch(/ · /); // 항목이 셋인 나열은 쉼표 나열 (QM2-10 규칙 2)
        expect(`${r.label}${r.average}${r.child}${r.childNote}${r.source}`).not.toMatch(/[!！]/);
      }
    }
  });

  it('값이 원자료와 같다: 사교육 참여율·월평균 사교육비(수저 단계 → 소득 구간, 설계 대응)와 전체 평균', () => {
    const all = row('private-education-by-income', 'band', '전체');
    for (const w of PARENT_WEALTHS) {
      const band = row('private-education-by-income', 'band', PRIVATE_EDU_BAND_BY_WEALTH[w]);
      const rows = buildComparison(w);
      const part = rows.find((r) => r.id === 'private-edu-participation')!;
      expect([part.average, part.child]).toEqual([`${formatNumber(all.participationPct as number, 1)}%`, `${formatNumber(band.participationPct as number, 1)}%`]);
      const cost = rows.find((r) => r.id === 'private-edu-cost')!;
      expect([cost.average, cost.child]).toEqual([`${formatNumber(all.monthlyCostMan as number, 1)}만 원`, `${formatNumber(band.monthlyCostMan as number, 1)}만 원`]);
      expect(part.childNote).toContain(PRIVATE_EDU_BAND_BY_WEALTH[w]);
    }
    // 단계가 높을수록 참여율·사교육비가 비감소(통계가 그렇다)
    const part = PARENT_WEALTHS.map((w) => parseFloat(buildComparison(w).find((r) => r.id === 'private-edu-participation')!.child));
    for (let i = 1; i < part.length; i++) expect(part[i]).toBeGreaterThanOrEqual(part[i - 1]);
  });

  it('값이 원자료와 같다: 자가 점유 비율(전국과 소득계층: 1·2단계 저소득층, 3단계 중소득층, 4·5단계 고소득층)', () => {
    const nat = row('housing-tenure', 'label', '전국').own as number;
    const expected: Record<number, string> = { 1: '전국·저소득층', 2: '전국·저소득층', 3: '전국·중소득층', 4: '전국·고소득층', 5: '전국·고소득층' };
    for (const w of PARENT_WEALTHS) {
      const own = row('housing-tenure', 'label', expected[w]).own as number;
      const r = buildComparison(w).find((x) => x.id === 'owner-share')!;
      expect([r.average, r.child]).toEqual([`${formatNumber(nat, 1)}%`, `${formatNumber(own, 1)}%`]);
    }
    expect(HOUSING_CLASS_LABEL).toEqual({ low: '저소득층', mid: '중소득층', high: '고소득층' });
  });

  it('확인하지 못한 지표(대학 진학률의 소득별 차이)는 쓰지 않는다: 쓰는 지표가 모두 usable이고 근거 id가 그 지표의 것이다', () => {
    expect(raw('income-college-gap').usable).toBe(false);
    expect(getUsableIndicator('income-college-gap')).toBeUndefined();
    const used = new Set(PARENT_WEALTHS.flatMap((w) => buildComparison(w).map((r) => r.basisId)));
    const wanted = ['private-education-by-income', 'housing-tenure'].map((id) => raw(id).basisId);
    expect([...used].sort()).toEqual([...wanted].sort());
    expect(used.has(raw('income-college-gap').basisId)).toBe(false);
  });
});

describe('지표를 못 읽으면 그 행을 뺀다 — 주입한 접근자로 buildComparison을 직접 부른다 (R-273)', () => {
  it('기본 접근자와 같은 접근자를 주입하면 결과가 같다(대조군)', () => {
    for (const w of PARENT_WEALTHS) expect(buildComparison(w, getUsableIndicator)).toEqual(buildComparison(w));
  });

  it('주거 지표가 usable:false면 「자기 집에 사는 가구」 행만 빠지고 사교육 두 행은 그대로다', () => {
    const get = accessWith((i) => (i.id === 'housing-tenure' ? { ...i, usable: false } : i));
    expect(get('housing-tenure')).toBeUndefined();
    for (const w of PARENT_WEALTHS) expect(buildComparison(w, get).map((r) => r.id), `${w}단계`).toEqual(['private-edu-participation', 'private-edu-cost']);
  });

  it('사교육 지표가 없으면 사교육 두 행이 빠지고 주거 행만 남는다', () => {
    const get = accessWith((i) => (i.id === 'private-education-by-income' ? { ...i, usable: false } : i));
    for (const w of PARENT_WEALTHS) expect(buildComparison(w, get).map((r) => r.id), `${w}단계`).toEqual(['owner-share']);
  });

  it('지표가 하나도 없으면 행이 0개다(가짜 값을 채우지 않는다)', () => {
    for (const w of PARENT_WEALTHS) expect(buildComparison(w, () => undefined)).toEqual([]);
  });

  it('필요한 열을 못 읽는 행만 빠진다: 월평균 사교육비 열이 없으면 그 행만 빠지고 참여율 행은 남는다', () => {
    const get = accessWith((i) =>
      i.id === 'private-education-by-income' ? { ...i, rows: (i.rows ?? []).map((r) => Object.fromEntries(Object.entries(r).filter(([k]) => k !== 'monthlyCostMan'))) } : i,
    );
    for (const w of PARENT_WEALTHS) expect(buildComparison(w, get).map((r) => r.id), `${w}단계`).toEqual(['private-edu-participation', 'owner-share']);
  });

  it('행의 값은 주입한 접근자의 지표에서 읽는다(모듈 안에 굳은 값이 아니다): 전국 자가 비율을 바꾸면 「전체 평균」 칸이 바뀐다', () => {
    const get = accessWith((i) =>
      i.id === 'housing-tenure' ? { ...i, rows: (i.rows ?? []).map((r) => (r.label === '전국' ? { ...r, own: 12.3 } : r)) } : i,
    );
    expect(buildComparison(1, get).find((r) => r.id === 'owner-share')!.average).toBe('12.3%');
    expect(buildComparison(1).find((r) => r.id === 'owner-share')!.average).not.toBe('12.3%');
  });
});

describe('기대수명 소득 격차는 표 칸이 아니라 모든 단계에 같은 한 줄 서술이다 (R-261)', () => {
  const gap = raw('life-expectancy-income-gap');

  it('문구: 「소득 상위 20%와 하위 20%의 기대수명 차이는 6.48세입니다(2017년). 집단의 평균 차이입니다.」 — 값·연도는 원자료에서 읽고, 합쇼체이다', () => {
    const line = lifeGapLine()!;
    expect(line).not.toBeNull();
    expect(gap.latest!.value).toBe(6.48);
    expect(gap.latest!.year).toBe(2017);
    expect(line.text).toBe(`소득 상위 20%와 하위 20%의 기대수명 차이는 ${formatNumber(gap.latest!.value, gap.decimals ?? 2)}세입니다(${gap.latest!.year}년). 집단의 평균 차이입니다.`);
    expect(line.text).toBe('소득 상위 20%와 하위 20%의 기대수명 차이는 6.48세입니다(2017년). 집단의 평균 차이입니다.');
    expect(line.basisId).toBe(gap.basisId);
    expect(line.source).toMatch(/^.+, 한국의 사회동향 2019 \(2017년\)$/);
    expect(line.source).not.toMatch(/ · /);
  });

  it('이 가정을 겨냥하지 않는다: 수저 단계를 받지 않아 모든 단계에 같은 글이고, 「이 아이·이 가정·수저」나 「짧음·긺」 같은 명사형 단정이 없다', () => {
    expect(lifeGapLine.length).toBeLessThanOrEqual(1); // 인자는 지표 접근자 하나뿐(수저 단계 인자가 없다)
    const line = lifeGapLine()!;
    expect(line.text).not.toMatch(/이 아이|이 가정|이 집|수저|짧음|긺|짧습니다|깁니다|더 오래|더 일찍|하위 20%는|상위 20%는/);
    expect(line.text).toContain('집단의 평균 차이입니다'); // 개인의 수명이 아니라는 단서
    expect(line.text).not.toMatch(/[!！]/);
    // 표 행에는 더 이상 이 값이 없다
    for (const w of PARENT_WEALTHS) expect(buildComparison(w).some((r) => r.child.includes('6.48') || r.average.includes('6.48'))).toBe(false);
  });

  it('지표를 못 읽으면(없거나 usable:false) 서술을 뺀다 — 가짜 값을 채우지 않는다', () => {
    expect(lifeGapLine(() => undefined)).toBeNull();
    const dropped = accessWith((i) => (i.id === 'life-expectancy-income-gap' ? { ...i, usable: false } : i));
    expect(lifeGapLine(dropped)).toBeNull();
    // 주입한 지표의 값이 문구에 반영된다
    const changed = accessWith((i) => (i.id === 'life-expectancy-income-gap' ? { ...i, latest: { year: 2030, value: 7.1 } } : i));
    expect(lifeGapLine(changed)!.text).toBe('소득 상위 20%와 하위 20%의 기대수명 차이는 7.10세입니다(2030년). 집단의 평균 차이입니다.');
  });
});

describe('비교 표는 시험 전용 R1(2026년생)에서만 보인다 (R-263 → SPEC-004 BR5: 세대 판에서는 숨김)', () => {
  it('compareShown: 시험 전용 R1 프로필만 true, 일곱 세대는 모두 false', () => {
    expect(COMPARE_PROFILE).toBe(R1_PRESENT);
    expect(compareShown(R1_PRESENT)).toBe(true);
    for (const g of GENERATION_IDS) expect(compareShown(g), g).toBe(false);
  });
});
