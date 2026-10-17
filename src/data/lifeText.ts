import type { StatKey } from '../core/types';

/** 인생 화면·연표에 쓰는 문구. 담담한 어조, 느낌표와 이모지는 쓰지 않는다. */

export const STAT_LABEL: Record<StatKey, string> = {
  education: '학력',
  health: '건강',
  happiness: '행복',
  relationships: '관계',
};

/** 사망 원인 후보 (나이·건강에 따라 다르다). 정확히 하나를 시드 RNG로 고른다. */
export function deathCauseCandidates(age: number, health: number): readonly string[] {
  if (age < 20) return ['갑작스러운 병', '사고'];
  if (age < 60) return health < 40 ? ['오랜 투병', '병환'] : ['사고', '갑작스러운 병'];
  return health < 35 ? ['오랜 병환', '병세 악화'] : ['노환', '조용한 잠'];
}

/** 연표에 남기는 사망 문구 */
export function deathEntryText(cause: string): string {
  return `세상을 떠났다. 원인: ${cause}.`;
}

/** 출생 문구 (연표 첫 줄) */
export function birthEntryText(birthYear: number, gender: 'male' | 'female'): string {
  return `${birthYear}년, ${gender === 'male' ? '남자아이' : '여자아이'}로 태어났다.`;
}

/** 이벤트 없이 한 해가 지났을 때 인생 화면 상태 줄 */
export const QUIET_YEAR_TEXT = '별다른 일 없이 한 해가 지났다.';
