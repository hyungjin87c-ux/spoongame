import { describe, expect, it } from 'vitest';
import economySrc from '../src/core/economy.ts?raw';
import statsJson from '../src/data/koreaStats.json';
import {
  CURVE_FIRST_AGE,
  CURVE_LAST_AGE,
  ECONOMY,
  ERA_ECONOMY,
  LABOR_INCOME_CURVE_THOUSAND,
  LIMITS,
} from '../src/data/economyTable';
import {
  DWELLINGS,
  applyAssetEffects,
  cashFlowOf,
  clampFamilyFund,
  dwellingAfterFlags,
  economyFactors,
  educationMultiplier,
  housingCostOf,
  incomeOf,
  initialAssets,
  initialDwelling,
  isValidAssets,
  laborCurve,
  livingEquivalent,
  safetyNetApplies,
  livingOf,
  medicalOf,
  naturalDwelling,
  settleAssets,
  workStateOf,
  yearlyAssets,
  type Assets,
  type Dwelling,
  type EconomyContext,
  type Era,
  type ParentWealth,
} from '../src/core';

/**
 * 경제 모델 (SPEC-003 M5 EC1·EC2, docs/data/economy-model.md 3·4절): 순수 함수의 값을 손으로 계산한 기대와 대조한다.
 * 근거가 있는 계수(소득 곡선·월세 비율·최저임금·연금·생활비 기본·등록금)는 koreaStats.json의 통계 행과 대응하는지도 확인한다(표의 머리말이 약속한 시험).
 * 설계값(학력·일 상태 배수, 생활비 곡선, 결혼 계수 …)은 표에서 읽어 식을 직접 쓴다 — 표를 고치면 이 식의 값만 따라 바뀐다(식의 모양은 그대로 검사된다).
 */

const ctx = (over: Omit<Partial<EconomyContext>, 'flags'> & { flags?: string[] } = {}): EconomyContext => ({
  age: 45,
  education: 50,
  flags: new Set(over.flags ?? []),
  era: 'present',
  tier: 3,
  ...(over.age !== undefined ? { age: over.age } : {}),
  ...(over.education !== undefined ? { education: over.education } : {}),
  ...(over.era !== undefined ? { era: over.era } : {}),
  ...(over.tier !== undefined ? { tier: over.tier } : {}),
});

const assets = (over: Partial<Assets> = {}): Assets => ({ net: 0, income: 0, debt: 0, incomeAdj: 0, dwelling: 'rent', ...over });

/** 나이에 해당하는 생활비 곡선 배수 (표에서 직접 읽는다) */
const profile = (age: number): number => ECONOMY.living.ageProfile.find((p) => age <= p.upTo)!.mult;

type Indicator = { id: string; latest?: { value: number }; rows?: Array<Record<string, unknown>>; verification?: { crossChecks?: string[] } };
const indicators = (statsJson as unknown as { indicators: Indicator[] }).indicators;
const indicator = (id: string): Indicator => indicators.find((i) => i.id === id)!;

describe('core 순수성: 경제 계산에 React·타이머·Date·Math.random이 없다 (난수를 쓰지 않는다 — RNG 수열 보존)', () => {
  it('core/economy.ts (주석 제외)', () => {
    const src = economySrc.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    expect(src.length).toBeGreaterThan(2000);
    expect(src).not.toMatch(/Math\.random|Date\.now|new Date|performance\.now|setTimeout|setInterval|from 'react'|document\.|window\.|createRng|rng\./);
  });
});

describe('계수 표와 통계 근거의 대응 (src/data/economyTable.ts ↔ koreaStats.json)', () => {
  it('소득 곡선 L(a): 20~85세 66칸이 s-053 「나이별 1인당 노동소득(2024 국민이전계정)」과 한 칸도 다르지 않다 (천 원)', () => {
    expect(CURVE_FIRST_AGE).toBe(20);
    expect(CURVE_LAST_AGE).toBe(85);
    expect(LABOR_INCOME_CURVE_THOUSAND).toHaveLength(66);
    const rows = indicator('lifecycle-account').rows!;
    for (let age = 20; age <= 85; age++) {
      const row = rows.find((r) => String(r.ageLabel).replace(/\s/g, '').startsWith(`${age}세`));
      expect(row, `${age}세 행`).toBeDefined();
      expect(LABOR_INCOME_CURVE_THOUSAND[age - 20], `${age}세`).toBe(row!.laborIncome);
    }
  });

  it('월세 비율 = s-063 임차가구 월소득 대비 월임대료 15.8% (2024 주거실태조사, 중위수)', () => {
    expect(indicator('housing-cost-burden').latest!.value).toBe(15.8);
    expect(ECONOMY.housing.rentRate).toBeCloseTo(indicator('housing-cost-burden').latest!.value / 100, 10);
  });

  it('취업·창업 소득 하한 = s-032 최저임금(2026) 10,320원 × 209시간 × 12개월 = 25,882,560원 → 2,588만 원', () => {
    const wage = indicator('minimum-wage').latest!.value;
    expect(wage).toBe(10320);
    expect(Math.floor((wage * 209 * 12) / 10000)).toBe(ECONOMY.fullTimeFloor);
    expect(ECONOMY.fullTimeFloor).toBe(2588);
  });

  it('연금 660만 원 = s-031 공적이전소득 평균 (가계금융복지조사 2025 요약 쪽 재판독 값)', () => {
    const checks = indicator('household-finance-misc').verification!.crossChecks!.join(' ');
    expect(checks).toContain('공적이전소득 660');
    expect(ECONOMY.pension.amount).toBe(660);
  });

  it('생활비 기본 2,640만 원 = s-059 가계지출 월 4,014,817원 × 12 ÷ 평균 가구원 2.19명 = 2,200만 원 × 보정 1.2 (순자산 중앙값을 통계에 맞추는 설계 보정)', () => {
    const row = indicator('household-consumption').rows!.find((r) => r.group === '전체 평균')!;
    expect(row.expenditure).toBe(4014817);
    expect(row.householdSize).toBe(2.19);
    const perPerson = (Number(row.expenditure) * 12) / 10000 / Number(row.householdSize);
    expect(Math.round(perPerson)).toBe(2200);
    expect(ECONOMY.living.base).toBe(Math.round(perPerson * 1.2));
  });

  it('학자금 대출 LOAN[재력] = s-033 4년 등록금(연 727.0만 원 × 4 = 2,908만 원)의 약 80·50·20%, 4~5단계는 0', () => {
    const fourYears = (indicator('university-tuition').latest!.value / 10) * 4;
    expect(Math.round(fourYears)).toBe(2908);
    [0.8, 0.5, 0.2].forEach((share, i) => expect(Math.abs(ECONOMY.collegeLoan[i] - share * fourYears) / (share * fourYears), `${i + 1}단계`).toBeLessThan(0.1));
    expect(ECONOMY.collegeLoan.slice(3)).toEqual([0, 0]);
  });

  it('이자율 2.5%는 실질 설계값이다: 기준금리 3.00%(s-060) 근처에서 물가 상승을 뺀 값이라 0%보다 크고 기준금리보다 작다', () => {
    expect(indicator('base-rate').latest!.value).toBe(3);
    expect(ECONOMY.interest).toBeGreaterThan(0);
    expect(ECONOMY.interest).toBeLessThan(0.03);
  });

  it('시대 계수: 지난 세상은 소득·생활·주거가 모두 지금보다 낮고, 다가올 세상은 소득이 더 높지만 생활·주거 부담도 더 높다 (설계값, SPEC-004가 연도별 전망으로 바꾼다)', () => {
    expect(economyFactors('present')).toEqual({ income: 1, living: 1, housing: 1 });
    for (const k of ['income', 'living', 'housing'] as const) expect(ERA_ECONOMY.past[k], k).toBeLessThan(1);
    expect(ERA_ECONOMY.future.income).toBeGreaterThan(1);
    expect(ERA_ECONOMY.future.living).toBeGreaterThan(1);
    expect(ERA_ECONOMY.future.housing).toBeGreaterThan(1);
    // 마스터 결정 D6: 다가올 세상 생활 1.2 (생활비 곡선을 더한 뒤 주거는 M-4 가드 여유를 위해 1.2로 낮췄다 — 9-3절)
    expect(ERA_ECONOMY.future.living).toBe(1.2);
  });

  it('독립 부모 지원 SUPPORT는 재력 단계마다 늘어난다 (G3 방향) · 한계 값은 서로 앞뒤가 맞다', () => {
    expect(ECONOMY.support).toHaveLength(5);
    for (let i = 1; i < 5; i++) expect(ECONOMY.support[i]).toBeGreaterThan(ECONOMY.support[i - 1]);
    expect(LIMITS.netMin).toBeLessThan(0);
    expect(LIMITS.netMax).toBeGreaterThan(0);
    expect(LIMITS.debtMax).toBeGreaterThan(-LIMITS.netMin - 1);
  });
});

describe('소득 (EC2): 곡선 × 학력 × 일 상태 × 시대, 결혼·소득 보정·연금', () => {
  it('laborCurve: 20세 미만은 20세 값, 85세 이상은 마지막 한 칸 — 만 원 단위', () => {
    expect(laborCurve(20)).toBeCloseTo(546.8, 6);
    expect(laborCurve(10)).toBe(laborCurve(20));
    expect(laborCurve(45)).toBeCloseTo(4650.8, 6); // 곡선의 최대
    expect(laborCurve(85)).toBeCloseTo(6.1, 6);
    expect(laborCurve(100)).toBe(laborCurve(85));
    const max = Math.max(...LABOR_INCOME_CURVE_THOUSAND);
    expect(max).toBe(46508);
    expect(LABOR_INCOME_CURVE_THOUSAND.indexOf(max) + CURVE_FIRST_AGE).toBe(45);
  });

  it('일 상태: 취업 > 학생(대학, 25세까지) > 고시 준비(32세까지) > 창업 > 그 밖 — 플래그와 나이에서 정한다', () => {
    const f = (...flags: string[]) => new Set(flags);
    expect(workStateOf(f('has_career'), 30)).toBe('working');
    expect(workStateOf(f('has_career', 'college'), 22)).toBe('working'); // 일하는 대학생은 취업
    expect(workStateOf(f('college'), 22)).toBe('student');
    expect(workStateOf(f('college'), ECONOMY.studentUntilAge)).toBe('student');
    expect(workStateOf(f('college'), ECONOMY.studentUntilAge + 1)).toBe('casual');
    expect(workStateOf(f('exam_prep'), 25)).toBe('exam');
    expect(workStateOf(f('exam_prep'), ECONOMY.examUntilAge)).toBe('exam');
    expect(workStateOf(f('exam_prep'), ECONOMY.examUntilAge + 1)).toBe('casual');
    expect(workStateOf(f('own_business'), 40)).toBe('business');
    expect(workStateOf(f('own_business', 'has_career'), 40)).toBe('working');
    expect(workStateOf(f(), 40)).toBe('casual');
  });

  it('학력 배수: 지식 < 30 → 0.8 · 30~49 → 0.95 · 50~69 → 1.1 · 70 이상 → 1.35 (경계 포함 방향)', () => {
    expect([0, 29].map(educationMultiplier)).toEqual([0.8, 0.8]);
    expect([30, 49].map(educationMultiplier)).toEqual([0.95, 0.95]);
    expect([50, 69].map(educationMultiplier)).toEqual([1.1, 1.1]);
    expect([70, 100].map(educationMultiplier)).toEqual([1.35, 1.35]);
  });

  it('incomeOf: 45세 취업·지식 50·미혼·지금 세상 = 4,650.8 × 1.1 = 5,116 — 결혼하면 ×1.3(6,651), 소득 보정은 그대로 더해진다', () => {
    const base = ctx({ age: 45, flags: ['has_career'] });
    expect(incomeOf(base, 0)).toBe(5116); // 4650.8 × 1.1 × 1.0 = 5115.88
    expect(incomeOf(ctx({ age: 45, flags: ['has_career', 'married'] }), 0)).toBe(Math.round(4650.8 * 1.1 * ECONOMY.spouseIncome)); // 6650.64
    expect(incomeOf(base, 500)).toBe(5616);
    expect(incomeOf(base, -600)).toBe(4516);
    expect(incomeOf(base, -999999)).toBe(0); // 소득은 음수가 되지 않는다
  });

  it('incomeOf: 일 상태 계수 — 학생 0.15 · 고시 0.2 · 창업 0.8 · 그 밖 0.55 (22~26세는 최저임금 하한 적용 대상이 아닌 상태)', () => {
    const at = (flags: string[], age = 40) => incomeOf(ctx({ age, flags }), 0);
    const full = at(['has_career']);
    expect(at(['own_business'])).toBe(Math.round(4346.3 * 1.1 * 0.8));
    expect(at([])).toBe(Math.round(4346.3 * 1.1 * 0.55));
    expect(at(['has_career'])).toBe(Math.round(4346.3 * 1.1));
    expect(full).toBeGreaterThan(at(['own_business']));
    expect(at(['college'], 22)).toBe(Math.round(laborCurve(22) * 1.1 * 0.15));
    expect(at(['exam_prep'], 27)).toBe(Math.round(laborCurve(27) * 1.1 * 0.2));
  });

  it('incomeOf: 28세 미만의 취업·창업은 최저임금 하한(2,588만 원)이 곡선보다 높으면 하한을 쓴다 (s-032)', () => {
    expect(incomeOf(ctx({ age: 25, flags: ['has_career'] }), 0)).toBe(Math.round(2588 * 1.1)); // 곡선 2,056.8 < 2,588
    expect(incomeOf(ctx({ age: 22, flags: ['has_career'] }), 0)).toBe(Math.round(2588 * 1.1));
    expect(incomeOf(ctx({ age: 28, flags: ['has_career'] }), 0)).toBe(Math.round(laborCurve(28) * 1.1)); // 28세부터는 곡선
    expect(incomeOf(ctx({ age: 25, flags: [] }), 0)).toBe(Math.round(laborCurve(25) * 1.1 * 0.55)); // 하한은 취업·창업에만
  });

  it('incomeOf: 65세부터 연금 660이 더해지고 소득 보정은 0.3배로 줄어든다 · 시대 계수는 노동 소득에만 곱해진다', () => {
    const c = ctx({ age: 65, flags: [] });
    expect(incomeOf(c, 0)).toBe(Math.round(laborCurve(65) * 1.1 * 0.55 + 660));
    expect(incomeOf(c, 1000)).toBe(Math.round(laborCurve(65) * 1.1 * 0.55 + 300 + 660)); // 보정 1000 × 0.3
    expect(incomeOf(ctx({ age: 64, flags: [] }), 1000)).toBe(Math.round(laborCurve(64) * 1.1 * 0.55 + 1000)); // 64세는 그대로, 연금 없음
    expect(incomeOf(ctx({ age: 90, flags: [] }), -99999)).toBe(660); // 연금은 보정이 아무리 깎아도 남는다
    const era = (e: Era) => incomeOf(ctx({ age: 45, era: e, flags: ['has_career'] }), 0);
    expect(era('past')).toBe(Math.round(4650.8 * 1.1 * ERA_ECONOMY.past.income));
    expect(era('future')).toBe(Math.round(4650.8 * 1.1 * ERA_ECONOMY.future.income));
    expect(era('past')).toBeLessThan(era('present'));
    expect(era('present')).toBeLessThan(era('future'));
    expect(incomeOf(ctx({ age: 70, era: 'past', flags: [] }), 0)).toBe(Math.round(laborCurve(70) * 1.1 * 0.55 * ERA_ECONOMY.past.income + 660));
  });

  it('incomeOf: 한계(LIMITS.incomeMax)로 자른다', () => {
    expect(incomeOf(ctx({ age: 45, flags: ['has_career'] }), LIMITS.adjMax * 100)).toBe(LIMITS.incomeMax);
  });
});

describe('생활비·의료·주거비 (EC2)', () => {
  it('livingEquivalent: 나 1 + 배우자 0.5(OECD 수정 등가척도의 둘째 성인, 마스터 결정 2026-10-18) + 자녀 0.9 (자녀가 독립하면 child_left로 빠진다)', () => {
    const eq = (...f: string[]) => livingEquivalent(new Set(f));
    expect(ECONOMY.living.spouse).toBe(0.5);
    expect(ECONOMY.living.child).toBe(0.9);
    expect(eq()).toBe(1);
    expect(eq('married')).toBeCloseTo(1.5, 10);
    expect(eq('has_child')).toBeCloseTo(1.9, 10);
    expect(eq('married', 'has_child')).toBeCloseTo(2.4, 10);
    expect(eq('married', 'has_child', 'child_left')).toBeCloseTo(1.5, 10);
    expect(eq('has_child', 'child_left')).toBe(1);
  });

  it('livingOf: 기본 2,640 × 시대 × 생활 인원 × (80세~ 0.95) × (학생 0.7) × (부모 집 계수) × 나이 곡선 — 표에서 읽은 식과 같다', () => {
    const base = ECONOMY.living.base;
    expect(livingOf(ctx({ age: 45, flags: ['has_career'] }), 'rent')).toBe(Math.round(base * profile(45)));
    expect(livingOf(ctx({ age: 30, flags: ['has_career'] }), 'rent')).toBe(Math.round(base * profile(30)));
    expect(livingOf(ctx({ age: 70, flags: ['has_career'] }), 'rent')).toBe(Math.round(base * profile(70)));
    expect(livingOf(ctx({ age: 80, flags: [] }), 'rent')).toBe(Math.round(base * ECONOMY.living.old80 * profile(80)));
    expect(livingOf(ctx({ age: 45, flags: ['married', 'has_child'] }), 'own')).toBe(Math.round(base * 2.4 * profile(45)));
    expect(livingOf(ctx({ age: 22, flags: ['college'] }), 'rent')).toBe(Math.round(base * ECONOMY.living.student * profile(22)));
    // 부모 집에 사는 동안 부모가 생활비 일부를 부담한다 (M-2 FAMILY_LIVING)
    expect(livingOf(ctx({ age: 22, flags: ['college'] }), 'family')).toBe(Math.round(base * ECONOMY.living.student * ECONOMY.living.familyLiving * profile(22)));
    expect(livingOf(ctx({ age: 22, flags: ['college'] }), 'family')).toBeLessThan(livingOf(ctx({ age: 22, flags: ['college'] }), 'rent'));
    // 시대 계수
    expect(livingOf(ctx({ age: 45, era: 'past' }), 'rent')).toBe(Math.round(base * ERA_ECONOMY.past.living * profile(45)));
    expect(livingOf(ctx({ age: 45, era: 'future' }), 'rent')).toBe(Math.round(base * ERA_ECONOMY.future.living * profile(45)));
  });

  it('생활비 곡선(나이별 배수)은 20~39세 < 40~64세 > 65세~ 의 혹 모양이고 구간이 빠짐없이 이어진다 (설계값 D18)', () => {
    const p = ECONOMY.living.ageProfile;
    expect(p.map((x) => x.upTo)).toEqual([...p.map((x) => x.upTo)].sort((a, b) => a - b));
    expect(p[p.length - 1].upTo).toBeGreaterThanOrEqual(110); // 어느 나이든 구간이 있다
    expect(profile(20)).toBe(profile(39));
    expect(profile(40)).toBe(profile(64));
    expect(profile(65)).toBe(profile(100));
    expect(profile(45)).toBeGreaterThan(profile(30));
    expect(profile(45)).toBeGreaterThan(profile(70));
  });

  it('medicalOf: 65세부터 +400, 80세부터 추가 +900', () => {
    expect([0, 40, 64].map(medicalOf)).toEqual([0, 0, 0]);
    expect([65, 79].map(medicalOf)).toEqual([400, 400]);
    expect([80, 100].map(medicalOf)).toEqual([1300, 1300]);
  });

  it('housingCostOf: 자가 150 · 월세 max(360, 소득의 15.8%) · 전세 월세의 절반 · 가족 0 · 요양 1,800 — 시대 주거 계수를 곱한다', () => {
    expect(housingCostOf('own', 5000, 'present')).toBe(150);
    expect(housingCostOf('rent', 2000, 'present')).toBe(360); // 15.8% = 316 < 하한 360
    expect(housingCostOf('rent', 4000, 'present')).toBe(632); // 4000 × 0.158
    expect(housingCostOf('jeonse', 4000, 'present')).toBe(316);
    expect(housingCostOf('jeonse', 2000, 'present')).toBe(180);
    expect(housingCostOf('family', 4000, 'present')).toBe(0);
    expect(housingCostOf('care', 0, 'present')).toBe(1800);
    expect(housingCostOf('own', 5000, 'past')).toBe(Math.round(150 * ERA_ECONOMY.past.housing));
    expect(housingCostOf('care', 0, 'future')).toBe(Math.round(1800 * ERA_ECONOMY.future.housing));
  });
});

describe('현금흐름 (cashFlowOf): 소득 − 생활비 − 의료 − 주거비 − 이자', () => {
  it('항목의 합이 total이다: 45세 취업·자가·부채 4,000 → 소득 5,116 − 생활비 − 주거 150 − 이자 100', () => {
    const c = ctx({ age: 45, flags: ['has_career'] });
    const f = cashFlowOf(c, assets({ dwelling: 'own', debt: 4000 }));
    expect(f.income).toBe(5116);
    expect(f.living).toBe(Math.round(ECONOMY.living.base * profile(45)));
    expect(f.medical).toBe(0);
    expect(f.housing).toBe(150);
    expect(f.interest).toBe(100); // 4000 × 2.5%
    expect(f.total).toBe(f.income - f.living - f.medical - f.housing - f.interest);
  });

  it('이자는 부채에 비례한다 (반올림) · 부채가 없으면 0', () => {
    const c = ctx({ age: 45, flags: ['has_career'] });
    expect(cashFlowOf(c, assets({ debt: 0 })).interest).toBe(0);
    expect(cashFlowOf(c, assets({ debt: 40000 })).interest).toBe(1000);
    expect(cashFlowOf(c, assets({ debt: 41 })).interest).toBe(1);
  });

  it('소득 보정(incomeAdj)이 늘면 현금흐름이 그만큼 늘고, 결혼하면 소득 ×1.3 · 생활 인원 +0.5로 현금흐름이 달라지는 파생 변화가 표기에 들어간다', () => {
    const c = ctx({ age: 45, flags: ['has_career'] });
    const a = assets({ dwelling: 'rent' });
    // 소득 보정이 늘어난 만큼의 산술은 흑자 쪽 나이(38세 — 나이 곡선 ×0.85)에서 본다. 40~64세의 곡선(M7a 재보정 뒤 ×1.73)에서는 생활비가 최소 생활(minShare) 바닥에 닿아 현금흐름이 같은 값으로 막힐 수 있다
    const y = ctx({ age: 38, flags: ['has_career'] });
    expect(cashFlowOf(y, { ...a, incomeAdj: 400 }).total - cashFlowOf(y, a).total).toBe(400 - (housingCostOf('rent', incomeOf(y, 0) + 400, 'present') - housingCostOf('rent', incomeOf(y, 0), 'present')));
    const married = ctx({ age: 45, flags: ['has_career', 'married'] });
    // 소득 +30%(약 +1,535)와 생활 인원 +0.5(약 +2,150)의 차이: 중년 부부는 혼자일 때보다 현금흐름이 줄어든다(소득이 낮은 사람일수록 더)
    // 차입 한도(limits)를 끈 값으로 견준다 — M7a 재보정 뒤 40~64세는 둘 다 한도(−300)에 막혀 같은 값이 된다
    expect(cashFlowOf(married, a, { limits: false }).total).not.toBe(cashFlowOf(c, a, { limits: false }).total);
    expect(cashFlowOf(married, a).income - cashFlowOf(c, a).income).toBe(incomeOf(married, 0) - incomeOf(c, 0));
    expect(cashFlowOf(married, a, { limits: false }).living - cashFlowOf(c, a, { limits: false }).living).toBe(livingOf(married, 'rent') - livingOf(c, 'rent'));
  });

  /** ECONOMY 계수를 잠깐 바꿔 보고 되돌린다(시험 전용) */
  const withLiving = <T,>(patch: Partial<{ maxBorrow: number; minShare: number }>, fn: () => T): T => {
    const living = ECONOMY.living as { maxBorrow: number; minShare: number };
    const saved = { maxBorrow: living.maxBorrow, minShare: living.minShare };
    try {
      Object.assign(living, patch);
      return fn();
    } finally {
      Object.assign(living, saved);
    }
  };

  it('생활비 차입 한도(maxBorrow)는 켜져 있다(300, 마스터 결정 D19): 소득이 모자라면 생활을 줄이고(새 빚은 한도 안), 모아 둔 자산이 있으면 그것을 쓰고, 최소 생활(기본 생활비의 40%) 아래로는 줄지 않는다', () => {
    expect(ECONOMY.living.maxBorrow).toBe(300);
    expect(ECONOMY.living.minShare).toBe(0.4);
    const c = ctx({ age: 50, flags: [] });
    const poor = assets({ net: -2000, debt: 2000, dwelling: 'rent' });
    const on = cashFlowOf(c, poor);
    const floor = Math.round(ECONOMY.living.base * ECONOMY.living.minShare);
    // 쓸 수 있는 돈 = 소득 − 의료 − 주거 − 이자 + 쓸 수 있는 순자산(0) + 한도 → 최소 생활보다 작으면 최소 생활
    const means = on.income - on.medical - on.housing - on.interest + ECONOMY.living.maxBorrow;
    const desired = livingOf(c, 'rent');
    expect(on.living).toBe(Math.min(desired, Math.max(floor, means)));
    expect(on.living).toBeLessThan(desired);
    // 켠 쪽이 끈 쪽보다 적자가 작다(생활을 줄이고 새 빚을 줄인다)
    const off = withLiving({ maxBorrow: Number.POSITIVE_INFINITY }, () => cashFlowOf(c, poor));
    expect(off.living).toBe(desired);
    expect(on.total).toBeGreaterThan(off.total);
    // 모아 둔 자산이 있으면 그것을 쓴다: 순자산 30,000이면 한도가 걸리지 않는다
    expect(cashFlowOf(c, assets({ net: 30000, dwelling: 'rent' })).living).toBe(desired);
    // 최소 생활 아래로는 줄지 않는다: 소득이 0이어도 minShare × 기본 생활비
    expect(cashFlowOf(ctx({ age: 40, flags: [] }), { ...poor, incomeAdj: -99999 }).living).toBe(Math.min(floor, livingOf(ctx({ age: 40, flags: [] }), 'rent')));
  });

  it('차입 한도는 한 해에 생활비 때문에 늘어나는 빚의 크기를 막는다: 일이 없는 40세가 순자산 0에서 시작해도 한 해 적자가 한도(300) + 최소 생활을 못 맞출 때의 몫 안이다', () => {
    const unemployed = ctx({ age: 40, flags: [] });
    const first = cashFlowOf(unemployed, assets({ net: 0, debt: 0, dwelling: 'rent' }));
    const floor = Math.round(ECONOMY.living.base * ECONOMY.living.minShare);
    expect(first.living).toBeGreaterThanOrEqual(floor);
    // 소득 0.55 × 곡선이 있어 최소 생활까지 줄여야 하는 판이라, 줄인 뒤의 적자는 한도 + (최소 생활과 쓸 수 있는 돈의 차이)다
    expect(first.total).toBeGreaterThanOrEqual(-ECONOMY.living.maxBorrow - Math.max(0, floor - (first.income - first.medical - first.housing - first.interest + ECONOMY.living.maxBorrow)));
  });

  describe('노년 안전망 (마스터 결정 D20): 65세 이상이고 순자산 ≤ 0이면 적자가 새 빚이 되지 않고 부채는 동결된다', () => {
    const old = (age = 72) => ctx({ age, flags: [] });
    const floor = Math.round(ECONOMY.living.base * ECONOMY.living.minShare);

    it('safetyNetApplies: 65세 이상 && 순자산 ≤ 0 — 64세나 순자산 > 0이면 아니다', () => {
      expect(safetyNetApplies(65, 0)).toBe(true);
      expect(safetyNetApplies(80, -5000)).toBe(true);
      expect(safetyNetApplies(64, -5000)).toBe(false);
      expect(safetyNetApplies(70, 1)).toBe(false);
    });

    it('생활비는 하한(기본 생활비의 40%)까지 줄고, 그래도 남는 적자(이자 포함)는 subsidy로 메워져 연 현금흐름이 0 이상이다', () => {
      const poor = assets({ net: -8000, debt: 8000, dwelling: 'rent' });
      const flow = cashFlowOf(old(), poor);
      expect(flow.living).toBe(Math.min(livingOf(old(), 'rent'), floor));
      const raw = flow.income - flow.living - flow.medical - flow.housing - flow.interest;
      expect(raw).toBeLessThan(0); // 연금 660 < 하한 생활 + 월세 + 의료 + 이자
      expect(flow.subsidy).toBe(-raw);
      expect(flow.total).toBe(0);
    });

    it('해마다 정산: 순자산·부채가 그대로다(새 빚 없음, 부채 동결) — 몇 해가 지나도', () => {
      let a = assets({ net: -8000, debt: 8000, dwelling: 'rent' });
      for (let age = 70; age < 85; age++) {
        const next = yearlyAssets(a, old(age));
        expect(next.net, `${age}세`).toBe(-8000);
        expect(next.debt, `${age}세`).toBe(8000);
        a = next;
      }
    });

    it('안전망이 없는 64세는 같은 상태에서 적자가 빚으로 쌓인다', () => {
      const poor = assets({ net: -8000, debt: 8000, dwelling: 'rent' });
      const next = yearlyAssets(poor, ctx({ age: 64, flags: [] }));
      expect(next.net).toBeLessThan(-8000);
      expect(next.debt).toBeGreaterThan(8000);
    });

    it('순자산이 남아 있던 해의 적자도 0까지만 줄인다(coverOvershoot): 자산을 다 쓴 해에 새 빚이 생기지 않는다 — 끄면 15-4절 문장 그대로 빚이 생긴다', () => {
      const a = assets({ net: 400, debt: 0, dwelling: 'rent' });
      expect(ECONOMY.safetyNet.coverOvershoot).toBe(true);
      const on = yearlyAssets(a, old());
      expect(on.net).toBe(0);
      expect(on.debt).toBe(0);
      const saved = ECONOMY.safetyNet.coverOvershoot;
      try {
        (ECONOMY.safetyNet as { coverOvershoot: boolean }).coverOvershoot = false;
        const off = yearlyAssets(a, old());
        expect(off.net).toBeLessThan(0);
        expect(off.debt).toBeGreaterThan(0);
      } finally {
        (ECONOMY.safetyNet as { coverOvershoot: boolean }).coverOvershoot = saved;
      }
    });

    it('흑자인 해는 그대로다: 안전망은 적자만 메운다(소득이 큰 65세는 보조 0)', () => {
      const rich = ctx({ age: 66, flags: ['has_career'], education: 80 });
      const flow = cashFlowOf(rich, assets({ net: 0, debt: 0, incomeAdj: 6000, dwelling: 'own' }));
      expect(flow.total).toBeGreaterThan(0);
      expect(flow.subsidy).toBe(0);
    });

    it('난수를 쓰지 않는다: 같은 입력은 같은 출력이다', () => {
      const poor = assets({ net: -3000, debt: 3000, dwelling: 'rent' });
      expect(yearlyAssets(poor, old())).toEqual(yearlyAssets(poor, old()));
    });
  });
});

describe('자산 불변식 (settleAssets · isValidAssets): 부채 ≥ max(0, −순자산)', () => {
  it('순자산이 음수이면 부족분만큼 부채가 생긴다 (자동 대출) · 이미 부채가 더 크면 그대로', () => {
    expect(settleAssets(assets({ net: -500, debt: 0 }))).toEqual(assets({ net: -500, debt: 500 }));
    expect(settleAssets(assets({ net: -500, debt: 9000 }))).toEqual(assets({ net: -500, debt: 9000 }));
    expect(settleAssets(assets({ net: 700, debt: 0 })).debt).toBe(0);
    expect(settleAssets(assets({ net: 0, debt: 0 })).debt).toBe(0);
  });

  it('한계로 자른다: 순자산 ±, 부채·소득 상한, 소득 보정 ±, 정수로 반올림', () => {
    expect(settleAssets(assets({ net: LIMITS.netMin - 99 })).net).toBe(LIMITS.netMin);
    expect(settleAssets(assets({ net: LIMITS.netMin - 99 })).debt).toBe(-LIMITS.netMin);
    expect(settleAssets(assets({ net: LIMITS.netMax + 99 })).net).toBe(LIMITS.netMax);
    expect(settleAssets(assets({ debt: LIMITS.debtMax + 5 })).debt).toBe(LIMITS.debtMax);
    expect(settleAssets(assets({ income: -50 })).income).toBe(0);
    expect(settleAssets(assets({ income: LIMITS.incomeMax + 1 })).income).toBe(LIMITS.incomeMax);
    expect(settleAssets(assets({ incomeAdj: LIMITS.adjMax + 1 })).incomeAdj).toBe(LIMITS.adjMax);
    expect(settleAssets(assets({ incomeAdj: -LIMITS.adjMax - 1 })).incomeAdj).toBe(-LIMITS.adjMax);
    expect(settleAssets(assets({ net: 10.6 })).net).toBe(11);
    expect(() => settleAssets(assets({ net: Number.NaN }))).toThrow(RangeError);
    expect(() => settleAssets(assets({ net: Number.POSITIVE_INFINITY }))).toThrow(RangeError);
  });

  it('isValidAssets: 정상 값은 통과하고 정수 아님·범위 밖·음수 부채·불변식 위반·알 수 없는 주거 형태·객체 아님은 거부한다', () => {
    const ok = assets({ net: -300, debt: 300, income: 1200, incomeAdj: 50 });
    expect(isValidAssets(ok, DWELLINGS)).toBe(true);
    expect(isValidAssets(assets({ net: 100, debt: 0 }), DWELLINGS)).toBe(true);
    for (const bad of [
      { ...ok, net: 1.5 },
      { ...ok, net: LIMITS.netMin - 1, debt: LIMITS.debtMax },
      { ...ok, net: LIMITS.netMax + 1 },
      { ...ok, debt: -1 },
      { ...ok, debt: LIMITS.debtMax + 1 },
      { ...ok, net: -500, debt: 100 },
      { ...ok, income: -1 },
      { ...ok, income: LIMITS.incomeMax + 1 },
      { ...ok, incomeAdj: LIMITS.adjMax + 1 },
      { ...ok, dwelling: 'castle' },
      { ...ok, dwelling: 3 },
      null,
      [],
      'x',
    ]) {
      expect(isValidAssets(bad, DWELLINGS), JSON.stringify(bad)).toBe(false);
    }
  });

  it('주거 형태는 다섯 가지: 자가·월세·전세·가족(부모 집)·요양', () => {
    expect([...DWELLINGS].sort()).toEqual(['care', 'family', 'jeonse', 'own', 'rent'].sort());
  });

  it('집안 살림 범위 자르기: ±3000', () => {
    expect(clampFamilyFund(4000)).toBe(LIMITS.familyFundMax);
    expect(clampFamilyFund(-4000)).toBe(-LIMITS.familyFundMax);
    expect(clampFamilyFund(450)).toBe(450);
    expect(clampFamilyFund(10.6)).toBe(11);
  });
});

describe('독립(20세) 초기 자산 (M-1, 15절): net₂₀ = SUPPORT + 집안 살림 − 학자금 대출, 모자란 몫은 시작 부채', () => {
  const at20 = (tier: ParentWealth, flags: string[] = []): EconomyContext => ctx({ age: 20, tier, flags });
  const SUPPORT = [0, 300, 1000, 3000, 10000];
  const LOAN = [2300, 1500, 600, 0, 0];

  it('집안 살림이 0이고 대학에 안 갔으면 순자산은 부모 지원 그대로, 부채 0', () => {
    for (let t = 1; t <= 5; t++) {
      const a = initialAssets(at20(t as ParentWealth), 0);
      expect(a.net, `${t}단계`).toBe(SUPPORT[t - 1]);
      expect(a.debt, `${t}단계`).toBe(0);
      expect(a.incomeAdj).toBe(0);
    }
  });

  it('대학(college 플래그)에 갔으면 학자금 대출만큼 순자산이 줄고 같은 값의 부채가 생긴다 — 재력이 높을수록 적다', () => {
    for (let t = 1; t <= 5; t++) {
      const a = initialAssets(at20(t as ParentWealth, ['college']), 0);
      expect(a.net, `${t}단계`).toBe(SUPPORT[t - 1] - LOAN[t - 1]);
      expect(a.debt, `${t}단계`).toBe(Math.max(LOAN[t - 1], -(SUPPORT[t - 1] - LOAN[t - 1])));
    }
    // 1단계: 지원 0 − 대출 2,300 = -2,300 → 부채 2,300 (대출이 곧 마이너스 출발)
    expect(initialAssets(at20(1, ['college']), 0)).toMatchObject({ net: -2300, debt: 2300 });
    // 5단계: 대출 없이 지원 10,000
    expect(initialAssets(at20(5, ['college']), 0)).toMatchObject({ net: 10000, debt: 0 });
  });

  it('M-1: 집안 살림은 하한 없이 그대로 더해진다 — 가장 가난한 집(지원 0)의 「집안 살림 ▼」가 20세에 사라지지 않고 시작 부채가 된다', () => {
    expect(initialAssets(at20(1), -1200)).toMatchObject({ net: -1200, debt: 1200 });
    expect(initialAssets(at20(2), -1200)).toMatchObject({ net: -900, debt: 900 }); // 지원 300 + (-1200)
    expect(initialAssets(at20(1, ['college']), -600)).toMatchObject({ net: -2900, debt: 2900 }); // 대출 2,300 + 집안 살림 -600
    expect(initialAssets(at20(5), 1500)).toMatchObject({ net: 11500, debt: 0 });
    expect(initialAssets(at20(3), 3000).net).toBe(4000);
  });

  it('소득은 20세 값으로 정해지고 주거는 재력 3~5단계 부모 집(family) · 1~2단계 월세(rent)다', () => {
    expect([1, 2, 3, 4, 5].map((t) => initialDwelling(t as ParentWealth))).toEqual(['rent', 'rent', 'family', 'family', 'family']);
    for (let t = 1; t <= 5; t++) {
      const c = at20(t as ParentWealth, ['college']);
      const a = initialAssets(c, 0);
      expect(a.dwelling).toBe(initialDwelling(t as ParentWealth));
      expect(a.income).toBe(incomeOf(c, 0));
      expect(isValidAssets(a, DWELLINGS)).toBe(true);
    }
  });
});

describe('주거 형태 전환 (4-2): 새로 켜진 플래그가 정한다', () => {
  const flags = (...f: string[]) => new Set(f);
  const move = (prev: Dwelling, before: string[], after: string[], tier: ParentWealth = 3) => dwellingAfterFlags(prev, flags(...before), flags(...after), tier);

  it('요양(in_care) · 자가(own_home) · 월세(renting) · 부모 집(lives_with_parents · moved_home) — 막 켜진 플래그만 본다', () => {
    expect(move('own', [], ['in_care'])).toEqual({ dwelling: 'care', debtAdd: 0 });
    expect(move('rent', [], ['own_home'])).toEqual({ dwelling: 'own', debtAdd: 0 });
    expect(move('family', [], ['renting'])).toEqual({ dwelling: 'rent', debtAdd: 0 });
    expect(move('rent', [], ['lives_with_parents'])).toEqual({ dwelling: 'family', debtAdd: 0 });
    expect(move('care', [], ['moved_home'])).toEqual({ dwelling: 'family', debtAdd: 0 });
    // 이미 켜져 있던 플래그는 다시 전환하지 않는다
    expect(move('rent', ['own_home'], ['own_home'])).toEqual({ dwelling: 'rent', debtAdd: 0 });
    expect(move('rent', [], [])).toEqual({ dwelling: 'rent', debtAdd: 0 });
  });

  it('결혼(married가 막 켜짐)하고 부모 집(family)이면: 4~5단계 자가 + 부채, 3단계 전세 + 부채, 1~2단계 월세 · 부모 집이 아니면 주거는 그대로', () => {
    expect(move('family', [], ['married'], 5)).toEqual({ dwelling: 'own', debtAdd: ECONOMY.marriage.ownDebt });
    expect(move('family', [], ['married'], 4)).toEqual({ dwelling: 'own', debtAdd: ECONOMY.marriage.ownDebt });
    expect(move('family', [], ['married'], 3)).toEqual({ dwelling: 'jeonse', debtAdd: ECONOMY.marriage.jeonseDebt });
    expect(move('family', [], ['married'], 2)).toEqual({ dwelling: 'rent', debtAdd: 0 });
    expect(move('family', [], ['married'], 1)).toEqual({ dwelling: 'rent', debtAdd: 0 });
    expect(move('rent', [], ['married'], 5)).toEqual({ dwelling: 'rent', debtAdd: 0 });
    expect(move('own', [], ['married'], 4)).toEqual({ dwelling: 'own', debtAdd: 0 });
    expect(move('family', ['married'], ['married'], 5)).toEqual({ dwelling: 'family', debtAdd: 0 });
  });

  it('같은 선택에서 주거 플래그와 결혼이 함께 켜지면 주거 플래그의 결과(예: 자가)를 먼저 정하고, 그 뒤 부모 집일 때만 결혼 규칙이 적용된다', () => {
    expect(move('family', [], ['married', 'own_home'], 1)).toEqual({ dwelling: 'own', debtAdd: 0 });
    expect(move('family', [], ['married', 'lives_with_parents'], 5)).toEqual({ dwelling: 'own', debtAdd: ECONOMY.marriage.ownDebt });
  });

  it('naturalDwelling: 미혼 30세 이상이 부모 집에 남아 있으면 월세로 나온다 (lives_with_parents · moved_home · 결혼이면 그대로)', () => {
    const nd = (prev: Dwelling, age: number, f: string[] = []) => naturalDwelling(prev, ctx({ age, flags: f }));
    expect(nd('family', ECONOMY.leaveFamilyAge)).toBe('rent');
    expect(nd('family', ECONOMY.leaveFamilyAge - 1)).toBe('family');
    expect(nd('family', 40, ['married'])).toBe('family');
    expect(nd('family', 40, ['lives_with_parents'])).toBe('family');
    expect(nd('family', 40, ['moved_home'])).toBe('family');
    expect(nd('rent', 50)).toBe('rent');
    expect(nd('care', 85)).toBe('care');
  });
});

describe('선택의 자산 효과 적용 (applyAssetEffects)', () => {
  const c = (flags: string[] = []) => ctx({ age: 45, flags: ['has_career', ...flags] });

  it('순자산·소득 보정·부채 변화를 더하고, 소득은 새 보정으로 다시 계산해 저장한다', () => {
    const before = assets({ net: 1000, income: 5116, debt: 500, incomeAdj: 0, dwelling: 'rent' });
    const out = applyAssetEffects(before, { net: -300, income: 400, debt: 200 }, new Set(['has_career']), c());
    expect(out.net).toBe(700);
    expect(out.debt).toBe(700);
    expect(out.incomeAdj).toBe(400);
    expect(out.income).toBe(incomeOf(c(), 400));
    expect(out.dwelling).toBe('rent');
  });

  it('자산을 넘는 지출은 부채가 된다: 순자산 100에서 -3,000 → 순자산 -2,900 · 부채 2,900 (불변식)', () => {
    const out = applyAssetEffects(assets({ net: 100, debt: 0 }), { net: -3000 }, new Set(), c());
    expect(out.net).toBe(-2900);
    expect(out.debt).toBe(2900);
    expect(isValidAssets(out, DWELLINGS)).toBe(true);
  });

  it('새로 켜진 플래그의 주거 전환과 결혼 시작 부채가 함께 적용된다', () => {
    const family = assets({ net: 2000, dwelling: 'family' });
    const out = applyAssetEffects(family, { net: -800 }, new Set(), ctx({ age: 30, tier: 3, flags: ['married'] }));
    expect(out.dwelling).toBe('jeonse');
    expect(out.debt).toBe(ECONOMY.marriage.jeonseDebt);
    expect(out.net).toBe(1200);
    const own = applyAssetEffects(assets({ net: 0, dwelling: 'rent' }), { net: -800, debt: 9000 }, new Set(), ctx({ age: 30, flags: ['own_home'] }));
    expect(own).toMatchObject({ dwelling: 'own', debt: 9000, net: -800 });
  });

  it('효과가 없으면(빈 변화) 자산은 그대로이고 소득만 다시 계산된다', () => {
    const before = assets({ net: 1000, income: 1, debt: 0 });
    const out = applyAssetEffects(before, {}, new Set(['has_career']), c());
    expect(out).toEqual({ ...before, income: incomeOf(c(), 0) });
  });
});

describe('해마다 정산 (yearlyAssets): 현금흐름을 더하고, 흑자의 일부로 빚을 갚고, 모자라면 자동 대출 — 난수 없음', () => {
  const working = ctx({ age: 45, flags: ['has_career'] });

  // 흑자를 보는 시험은 나이 곡선이 ×0.85인 38세로 한다(40~64세는 M7a 재보정 뒤 ×1.73이라 흑자가 보장되지 않는다)
  const earning = ctx({ age: 38, flags: ['has_career'] });

  it('흑자: 순자산이 현금흐름만큼 늘고 흑자의 repayShare만큼 부채가 준다 (상환은 순자산을 바꾸지 않는다)', () => {
    const a = assets({ net: 1000, debt: 3000, dwelling: 'own' });
    const flow = cashFlowOf(earning, a).total;
    expect(flow).toBeGreaterThan(0);
    const out = yearlyAssets(a, earning);
    expect(out.net).toBe(1000 + flow);
    expect(out.debt).toBe(3000 - Math.round(ECONOMY.repayShare * flow));
    expect(out.income).toBe(cashFlowOf(earning, a).income);
  });

  it('부채보다 큰 흑자여도 부채는 0 아래로 내려가지 않는다', () => {
    const a = assets({ net: 5000, debt: 50, dwelling: 'own' });
    expect(yearlyAssets(a, earning).debt).toBe(0);
  });

  it('적자: 순자산이 줄고, 순자산이 음수가 되면 부족분이 부채로 잡힌다 (이자가 다음 해 적자를 키운다 — 빚이 빚을 만든다). 차입 한도를 끈 상태에서 본 구조다', () => {
    const living = ECONOMY.living as { maxBorrow: number };
    const saved = living.maxBorrow;
    try {
      living.maxBorrow = Number.POSITIVE_INFINITY;
      const unemployed = ctx({ age: 40, flags: [] });
      let a = assets({ net: 0, debt: 0, dwelling: 'rent' });
      const netPath: number[] = [];
      for (let i = 0; i < 4; i++) {
        a = yearlyAssets(a, unemployed);
        netPath.push(a.net);
        expect(isValidAssets(a, DWELLINGS)).toBe(true);
        expect(a.debt).toBeGreaterThanOrEqual(-a.net);
      }
      expect(netPath[0]).toBeLessThan(0);
      // 적자가 해마다 더 커진다(이자 때문에)
      const drops = netPath.map((n, i) => (i === 0 ? n : n - netPath[i - 1]));
      for (let i = 1; i < drops.length; i++) expect(drops[i]).toBeLessThan(drops[i - 1]);
    } finally {
      living.maxBorrow = saved;
    }
  });

  it('차입 한도를 켠 상태(300)에서는 같은 판의 적자가 한도 근처에서 멈춘다: 해마다 줄어드는 순자산이 한도 + 이자를 크게 넘지 않는다', () => {
    const unemployed = ctx({ age: 40, flags: [] });
    let a = assets({ net: 0, debt: 0, dwelling: 'rent' });
    let worst = 0;
    for (let i = 0; i < 6; i++) {
      const next = yearlyAssets(a, unemployed);
      worst = Math.min(worst, next.net - a.net);
      expect(isValidAssets(next, DWELLINGS)).toBe(true);
      a = next;
    }
    const first = cashFlowOf(unemployed, assets({ net: 0, debt: 0, dwelling: 'rent' }));
    // 한 해 적자는 (소득 − 최소 생활 − 의료 − 주거 − 이자)에서 정해진다: 최소 생활까지 줄여도 모자란 몫만 남는다
    expect(first.living).toBeGreaterThanOrEqual(Math.min(livingOf(unemployed, 'rent'), Math.round(ECONOMY.living.base * ECONOMY.living.minShare)));
    expect(worst).toBeGreaterThan(-4000);
  });

  it('적자는 모아 둔 순자산에서 먼저 나간다: 순자산 5,000이면 적자 해에도 빚이 늘지 않는다', () => {
    const unemployed = ctx({ age: 40, flags: [] });
    const a = assets({ net: 5000, debt: 0, dwelling: 'rent' });
    const flow = cashFlowOf(unemployed, a).total;
    expect(flow).toBeLessThan(0);
    const out = yearlyAssets(a, unemployed);
    expect(out.net).toBe(5000 + flow);
    expect(out.debt).toBe(0);
  });

  it('자연 주거 전환: 미혼 30세 이상이 부모 집에 있으면 올해부터 월세 — 그 해의 주거비도 월세로 센다', () => {
    const a = assets({ net: 3000, dwelling: 'family' });
    const c30 = ctx({ age: 30, flags: ['has_career'] });
    const out = yearlyAssets(a, c30);
    expect(out.dwelling).toBe('rent');
    expect(out.net).toBe(3000 + cashFlowOf(c30, { ...a, dwelling: 'rent' }).total);
    const c29 = ctx({ age: 29, flags: ['has_career'] });
    expect(yearlyAssets(a, c29).dwelling).toBe('family');
  });

  it('결정적이다: 같은 입력은 늘 같은 결과이고 입력 객체를 바꾸지 않는다 (RNG를 받지 않는다)', () => {
    const a = assets({ net: 1200, debt: 800, incomeAdj: 150, dwelling: 'jeonse' });
    const frozen = JSON.stringify(a);
    const r1 = yearlyAssets(a, working);
    const r2 = yearlyAssets(a, working);
    expect(r1).toEqual(r2);
    expect(JSON.stringify(a)).toBe(frozen);
    expect(yearlyAssets.length).toBe(2);
  });

  it('긴 인생 한 판을 돌려도 매해 불변식과 한계가 지켜진다 (20~100세, 세 시대 × 일 상태 4가지 × 주거 5가지)', () => {
    const eras: Era[] = ['past', 'present', 'future'];
    const stateFlags = [['has_career'], ['own_business'], [], ['has_career', 'married', 'has_child']];
    for (const era of eras) {
      for (const flags of stateFlags) {
        for (const dwelling of DWELLINGS) {
          let a = assets({ net: 0, dwelling });
          for (let age = 20; age <= 100; age++) {
            a = yearlyAssets(a, ctx({ age, era, flags }));
            expect(isValidAssets(a, DWELLINGS), `${era} ${flags.join(',')} ${dwelling} ${age}세 ${JSON.stringify(a)}`).toBe(true);
          }
        }
      }
    }
  });
});
