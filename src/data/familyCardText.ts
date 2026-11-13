import type { Gender, Occupation } from '../core/types';
import { ageText } from '../core/format';
import type { JobLine } from '../core/familyJobs';
import type { SiblingKind } from '../core/family';
import { OCCUPATION_LABEL } from './birthReportTable';
import { siblingLabel } from './familyText';

/**
 * 가족과 삶 카드(SPEC-009 FC1~FC9)의 문구 — 한 곳에 모았다. 계산은 `core/familyCard.ts`·`familyCloseness.ts`·`possessions.ts`, 문구 기준은 이 SPEC의 FC 항목(합쇼체가 아닌 명사형 줄)과 `docs/design/copy.md` 「대시보드 · 오른쪽 열 가족 카드」.
 * 새 낱말은 「집안일」「쉬는 중」「은퇴」「학생」뿐이다(FC3). 사이의 다섯 단계는 수치 없이 말로만 보인다(FC2).
 */

/** 사이 다섯 단계 (5 아주 가까움 … 1 멀어짐) */
export const CLOSENESS_LABEL: Readonly<Record<1 | 2 | 3 | 4 | 5, string>> = {
  5: '아주 가까움',
  4: '가까움',
  3: '보통',
  2: '데면데면함',
  1: '멀어짐',
};

/** 직업 줄의 낱말 (직업 대분류 이름은 `OCCUPATION_LABEL`을 그대로 쓴다) */
export const JOB_LINE_LABEL: Readonly<Record<Exclude<JobLine, 'employed'>, string>> = {
  student: '학생',
  retired: '은퇴',
  homemaker: '집안일',
  resting: '쉬는 중',
};

export function jobText(line: JobLine | null, job?: Occupation): string | null {
  if (line === null) return null;
  if (line === 'employed') return job === undefined ? null : OCCUPATION_LABEL[job];
  return JOB_LINE_LABEL[line];
}

/** 조부모 호칭 (FC9) */
const GRAND_LABEL: Readonly<Record<string, string>> = { pgf: '친할아버지', pgm: '친할머니', mgf: '외할아버지', mgm: '외할머니' };

export const FAMILY_CARD_TEXT = {
  /** 따로 사는 사람 표지 */
  apart: '따로 삶',
  friend: '친구',
  friendFaded: '멀어진 친구',
  spouse: '배우자',
  exSpouse: '전 배우자',
  partner: '연인',
  son: '아들',
  daughter: '딸',
  goneHeading: '떠난 가족',
  petsHeading: '함께 사는 동물',
  thingsHeading: '집에 있는 것',
  more: '더 보기',
  less: '접기',
  basisSummary: '이 칸은 어떻게 정했나요',
  basisIntro: '식구의 이름, 나이, 사이, 직업과 집에 있는 것은 통계와 게임이 정한 값이 섞여 있습니다. 칸마다 어디까지가 통계인지 밝힙니다.',
  basisKind: { official: '확인', calc: '확인(환산)', estimated: '추정', design: '설계값' } as const,
  nothing: '없음',
  /** 「N세에 세상을 떠남」 */
  goneAt: (ownAge: number): string => `${ageText(ownAge)}에 세상을 떠남`,
  /** 주인공이 태어나기 전에 떠난 분 */
  goneBeforeMe: (ownAge: number): string => `내가 태어나기 전에 세상을 떠남(${ageText(ownAge)})`,
  /** 펼치면 붙는 한 줄 */
  goneMyAge: (myAge: number): string => `내가 ${ageText(myAge)}였던 해`,
  petSpecies: { dog: '개', cat: '고양이', other: '반려동물' } as const,
  petWith: '함께 삶',
  petGone: (years: number | undefined): string => (years === undefined ? '곁을 떠남' : `${years}년을 함께하고 곁을 떠남`),
  /** 줄 수를 가리키는 접근 이름: 「식구 N명」 */
  rowsLabel: (n: number): string => `식구 ${n}명`,
} as const;

/** 호칭 (FC9): 조부모 친·외, 자녀 아들·딸, 형제는 주인공 성별 기준 (`siblingLabel`) */
export function personLabel(id: string, role: string, gender: Gender, player: Gender, sibKind: SiblingKind | undefined, partner: boolean): string {
  switch (role) {
    case 'mother':
      return '어머니';
    case 'father':
      return '아버지';
    case 'grandparent':
      return GRAND_LABEL[id] ?? '조부모';
    case 'sibling':
      return sibKind === undefined ? '형제자매' : siblingLabel(player, sibKind);
    case 'spouse':
      return partner ? FAMILY_CARD_TEXT.partner : FAMILY_CARD_TEXT.spouse;
    case 'child':
      return gender === 'male' ? FAMILY_CARD_TEXT.son : FAMILY_CARD_TEXT.daughter;
    default:
      return FAMILY_CARD_TEXT.friend;
  }
}
