/**
 * 대시보드 프로필 카드·머리에 쓰는 순수 규칙 (SPEC-003 DB9). 화면은 이 결과만 문구로 그린다(data/dashText.ts·이 파일의 EDUCATION_LABEL).
 * 모든 표는 게임의 설계값이고 통계가 아니다.
 */

// ---------- 학력 (DB9: 나이 × 플래그 표) ----------

/** 학교 단계 (프로필의 「학력」) */
export const EDUCATION_STAGES = [
  'preschool',
  'elementary',
  'middleSchool',
  'highSchool',
  'highGraduated',
  'highGraduatedWorking',
  'collegeEnrolled',
  'collegeGraduated',
  'leftSchool',
] as const;
export type EducationStage = (typeof EDUCATION_STAGES)[number];

export const EDUCATION_LABEL: Record<EducationStage, string> = {
  preschool: '취학 전',
  elementary: '초등학교 재학',
  middleSchool: '중학교 재학',
  highSchool: '고등학교 재학',
  highGraduated: '고등학교 졸업',
  highGraduatedWorking: '고등학교 졸업 후 취업',
  collegeEnrolled: '대학교 재학',
  collegeGraduated: '대학교 졸업',
  leftSchool: '학업을 중단함',
};

/**
 * 나이 경계 표 (게임의 학교 단계는 7세에 시작한다 — data/lifeTable.ts#STAGE_TABLE.school): 초등 7~12, 중학 13~15, 고등 16~18, 19세부터 졸업 뒤.
 * 대학교는 19세에 들어가 4년 재학하고 23세부터 졸업이다(`collegeYears`).
 */
export const EDUCATION_AGES = { elementaryFrom: 7, middleFrom: 13, highFrom: 16, highUntil: 19, collegeYears: 4 } as const;

/**
 * 학력 단계. 플래그가 정한다 — `left_school`(학교를 접음, 12~17세에 정해진다)은 그때부터 계속 「학업을 중단함」, `college`(대학에 감, 16~19세에 정해진다)는 19세부터 재학 → 졸업,
 * `early_work`(대학에 가지 않고 일함)는 19세부터 「고등학교 졸업 후 취업」. 플래그가 정해지기 전의 나이(예: 16세에 대학 진학이 정해졌어도 19세 전)에는 나이가 정한 학교 단계를 보인다 —
 * 그래서 어떤 나이에도 모순되는 단계(예: 5세의 「대학교 재학」)가 나오지 않는다. 플래그가 하나도 없이 19세를 넘으면 「고등학교 졸업」이다.
 */
export function educationStage(age: number, flags: readonly string[]): EducationStage {
  const has = (f: string) => flags.includes(f);
  if (has('left_school')) return 'leftSchool';
  const a = Number.isFinite(age) ? Math.max(0, Math.floor(age)) : 0;
  if (a < EDUCATION_AGES.elementaryFrom) return 'preschool';
  if (a < EDUCATION_AGES.middleFrom) return 'elementary';
  if (a < EDUCATION_AGES.highFrom) return 'middleSchool';
  if (a < EDUCATION_AGES.highUntil) return 'highSchool';
  if (has('college')) return a < EDUCATION_AGES.highUntil + EDUCATION_AGES.collegeYears ? 'collegeEnrolled' : 'collegeGraduated';
  return has('early_work') ? 'highGraduatedWorking' : 'highGraduated';
}

export function educationLabel(age: number, flags: readonly string[]): string {
  return EDUCATION_LABEL[educationStage(age, flags)];
}

// ---------- 머리의 연도 ----------

/** 머리 둘째 줄의 「{연도}년」 — 태어난 해 + 나이 (시스템이 만드는 표기라 이벤트 문구의 달력 연도 금지에 걸리지 않는다, copy.md 대시보드 헤더) */
export function calendarYear(birthYear: number, age: number): number {
  return birthYear + Math.max(0, Math.floor(age));
}
