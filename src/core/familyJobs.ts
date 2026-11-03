import { reportTiltOf } from '../data/birthReportTable';
import { jobWeights } from './birthReport';
import { FAMILY_TAG } from './familyModel';
import { famHash01 } from './familyRng';
import { familyTables } from './gameData';
import { OCCUPATIONS, type Gender, type Occupation, type ParentWealth } from './types';

/**
 * 직업 줄 (SPEC-009 FC3, 설계 문서 4-2·4-3절 (4)): 사람마다 「직업 대분류 이름」「학생」「은퇴」「집안일」「쉬는 중」 중 하나(또는 아직 없음).
 *  - 직업은 한 사람에게 **한 번만** 정해진다(해시): 나이가 들어도 직업 종류는 안 바뀌고 학생 → 직업 → 은퇴로만 흐른다.
 *  - 부모의 직업은 출생신고의 값(`report.mother.job`·`father.job`)이고, 은퇴 나이는 FA2의 설계값이다 — 농림어업 65~75세, 그 밖 55~65세 균등(해시, 저장하지 않는다 — FS2).
 *  - 형제·배우자·자녀·친구·조부모의 직업은 출생신고의 직업 분포(`jobWeights`)에서 뽑은 설계값이다(통계가 없다 — 근거 칸에 밝힌다).
 * 순수 함수, 난수는 `famHash01`(EMPLOY 태그)뿐이다.
 */

export type JobLine = 'employed' | 'homemaker' | 'retired' | 'student' | 'resting';

export interface JobInfo {
  /** null = 아직 직업 줄이 없는 나이(학령 전) */
  line: JobLine | null;
  job?: Occupation;
}

/** 직업 줄의 나이 값(설계값, R-582): `FAMILY_DESIGN.adult.jobs` — 학생 6~22세(초등 입학 ~ 대학 졸업 무렵), 은퇴 농림어업 65~75·그 밖 55~65 균등. 근거 칸 글도 이 값으로 조립된다 */
const jobsDesign = () => familyTables().design.adult.value.jobs;

/** 은퇴 나이 (FA2 설계값): 농림어업·그 밖 각각 `retireAge`의 min~max 균등 */
export function retireAgeOf(famSeed: number, key: number, job: Occupation): number {
  const r = jobsDesign().retireAge[job === 'agri' ? 'agri' : 'other'];
  return r.min + Math.floor(famHash01(famSeed, FAMILY_TAG.EMPLOY, key, 2) * (r.max - r.min + 1));
}

/** 한 사람의 직업 종류를 출생신고 직업 분포에서 뽑는다 (그 사람이 서른다섯 무렵의 시대 보정) */
export function drawJob(famSeed: number, key: number, gender: Gender, birthYear: number, wealth: ParentWealth): Occupation {
  const w = jobWeights(gender === 'male' ? 'father' : 'mother', 35, wealth, reportTiltOf(birthYear + 35));
  const total = w.reduce((a, b) => a + b, 0);
  let x = famHash01(famSeed, FAMILY_TAG.EMPLOY, key, 1) * total;
  for (let i = 0; i < OCCUPATIONS.length; i++) {
    x -= w[i];
    if (x < 0) return OCCUPATIONS[i];
  }
  return OCCUPATIONS[OCCUPATIONS.length - 1];
}

/**
 * 직업 줄. `job`은 이 사람의 직업 종류(부모는 출생신고 값, 그 밖은 `drawJob`), `homemaker`는 부모의 집안일(FA2 `ParentData.w`).
 * 학령 전은 `line: null`, 학생 나이는 학생, 그 뒤는 직업이고 은퇴 나이부터는 은퇴다.
 */
export function jobInfoOf(opts: { famSeed: number; key: number; age: number; job: Occupation; homemaker?: boolean; retireAt?: number; /** 부모처럼 이미 어른인 사람은 학생 나이를 건너뛴다 */ grownUp?: boolean }): JobInfo {
  const { age, job } = opts;
  const design = jobsDesign();
  if (opts.homemaker === true) return age >= (opts.retireAt ?? design.homemakerRetireAge) ? { line: 'retired' } : { line: 'homemaker' };
  if (opts.grownUp !== true) {
    if (age < design.studentAge.min) return { line: null };
    if (age <= design.studentAge.max) return { line: 'student' };
  }
  const retireAt = opts.retireAt ?? retireAgeOf(opts.famSeed, opts.key, job);
  return age >= retireAt ? { line: 'retired' } : { line: 'employed', job };
}
