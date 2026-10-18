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

/** 마지막 글자에 받침이 있는가 (한글 음절만 본다 — 원인 낱말 뒤 「이었습니다」/「였습니다」를 정한다) */
function hasFinalConsonant(word: string): boolean {
  const code = word.charCodeAt(word.length - 1) - 0xac00;
  return code >= 0 && code <= 11171 && code % 28 !== 0;
}

/** 「원인은 노환이었습니다.」 — 원인 낱말의 받침이 있으면 「이었습니다」, 없으면 「였습니다」(「사고였습니다」) (M7e-3, copy.md 5-3) */
export function causeSentenceText(cause: string): string {
  return `원인은 ${cause}${hasFinalConsonant(cause) ? '이었습니다' : '였습니다'}.`;
}

/** 연표에 남기는 사망 문구 */
export function deathEntryText(cause: string): string {
  return `세상을 떠났습니다. ${causeSentenceText(cause)}`;
}
