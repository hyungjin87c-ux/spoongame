import { describe, expect, it } from 'vitest';
import { EDUCATION_AGES, EDUCATION_LABEL, EDUCATION_STAGES, calendarYear, educationLabel, educationStage } from '../src/core';

/**
 * 프로필 카드의 학력 (SPEC-003 DB9): 나이 × 플래그(`left_school`·`college`·`early_work`) 표. 어떤 나이에도 모순되는 단계(5세의 「대학교 재학」)가 나오지 않는다.
 */
describe('educationStage: 나이 × 플래그 표', () => {
  it('플래그가 없으면 나이가 정한다: 취학 전 0~6 / 초등 7~12 / 중학 13~15 / 고등 16~18 / 19세부터 고등학교 졸업', () => {
    const table: Array<[age: number, label: string]> = [
      [0, '취학 전'],
      [6, '취학 전'],
      [7, '초등학교 재학'],
      [12, '초등학교 재학'],
      [13, '중학교 재학'],
      [15, '중학교 재학'],
      [16, '고등학교 재학'],
      [18, '고등학교 재학'],
      [19, '고등학교 졸업'],
      [40, '고등학교 졸업'],
      [90, '고등학교 졸업'],
    ];
    for (const [age, label] of table) expect(educationLabel(age, []), `${age}세`).toBe(label);
  });

  it('대학 진학(college): 19세부터 재학 4년(19~22), 23세부터 졸업. 진학이 16~18세에 정해져도 19세 전에는 고등학교 재학이다', () => {
    for (const age of [16, 17, 18]) expect(educationLabel(age, ['college']), `${age}세`).toBe('고등학교 재학');
    for (let age = 19; age < 19 + EDUCATION_AGES.collegeYears; age++) expect(educationLabel(age, ['college']), `${age}세`).toBe('대학교 재학');
    for (const age of [23, 24, 50, 99]) expect(educationLabel(age, ['college']), `${age}세`).toBe('대학교 졸업');
  });

  it('일찍 취업(early_work): 19세부터 「고등학교 졸업 후 취업」, 그 전에는 나이가 정한 학교 단계', () => {
    for (const age of [16, 17, 18]) expect(educationLabel(age, ['early_work']), `${age}세`).toBe('고등학교 재학');
    for (const age of [19, 30, 80]) expect(educationLabel(age, ['early_work']), `${age}세`).toBe('고등학교 졸업 후 취업');
  });

  it('학교를 접음(left_school): 그때부터 계속 「학업을 중단함」 — early_work가 함께 있어도 같다(학교를 접은 판은 두 플래그가 함께 켜진다)', () => {
    for (const age of [12, 15, 19, 40]) {
      expect(educationLabel(age, ['left_school']), `${age}세`).toBe('학업을 중단함');
      expect(educationLabel(age, ['left_school', 'early_work']), `${age}세`).toBe('학업을 중단함');
    }
  });

  it('모순이 없다: 모든 나이 0~110 × 가능한 플래그 조합에서 나이에 맞지 않는 단계가 나오지 않는다', () => {
    const combos: string[][] = [[], ['college'], ['early_work'], ['left_school'], ['left_school', 'early_work'], ['college', 'scholar'], ['late_learner']];
    for (const flags of combos) {
      for (let age = 0; age <= 110; age++) {
        const stage = educationStage(age, flags);
        const where = `${age}세 ${flags.join(',') || '(없음)'} → ${stage}`;
        if (stage === 'preschool') expect(age, where).toBeLessThan(EDUCATION_AGES.elementaryFrom);
        if (stage === 'elementary') expect(age, where).toBeGreaterThanOrEqual(EDUCATION_AGES.elementaryFrom);
        if (stage === 'middleSchool' || stage === 'highSchool') expect(age, where).toBeGreaterThanOrEqual(EDUCATION_AGES.middleFrom);
        if (stage === 'highSchool') expect(age, where).toBeLessThan(EDUCATION_AGES.highUntil);
        if (stage === 'highGraduated' || stage === 'highGraduatedWorking' || stage === 'collegeEnrolled' || stage === 'collegeGraduated') expect(age, where).toBeGreaterThanOrEqual(EDUCATION_AGES.highUntil);
        if (stage === 'collegeEnrolled') expect(age, where).toBeLessThan(EDUCATION_AGES.highUntil + EDUCATION_AGES.collegeYears);
        if (stage === 'collegeGraduated') expect(flags, where).toContain('college');
        if (stage === 'highGraduatedWorking') expect(flags, where).toContain('early_work');
        if (stage === 'leftSchool') expect(flags, where).toContain('left_school');
      }
    }
  });

  it('단계 목록·라벨 표가 짝이 맞고 라벨은 담담한 글(느낌표·이모지 없음)이다', () => {
    expect(Object.keys(EDUCATION_LABEL).sort()).toEqual([...EDUCATION_STAGES].sort());
    for (const label of Object.values(EDUCATION_LABEL)) {
      expect(label).not.toMatch(/[!！]|\p{Extended_Pictographic}/u);
      expect(label.length).toBeGreaterThan(2);
    }
    // 실제 게임에서 나올 수 있는 모든 단계가 표에 한 번 이상 나온다(공허 통과 방지)
    const seen = new Set<string>();
    for (const flags of [[], ['college'], ['early_work'], ['left_school']]) for (let age = 0; age <= 80; age++) seen.add(educationStage(age, flags));
    expect([...seen].sort()).toEqual([...EDUCATION_STAGES].sort());
  });

  it('음수·NaN·소수 나이는 안전하게 읽는다(취학 전으로, 소수는 내림)', () => {
    expect(educationStage(-3, [])).toBe('preschool');
    expect(educationStage(Number.NaN, [])).toBe('preschool');
    expect(educationStage(6.9, [])).toBe('preschool');
    expect(educationStage(7.2, [])).toBe('elementary');
  });
});

describe('calendarYear: 머리의 「{연도}년」', () => {
  it('태어난 해 + 나이', () => {
    expect(calendarYear(2026, 0)).toBe(2026);
    expect(calendarYear(2026, 31)).toBe(2057);
    expect(calendarYear(1960, 64)).toBe(2024);
    expect(calendarYear(2040, 90)).toBe(2130);
    expect(calendarYear(2026, -4)).toBe(2026);
  });
});
