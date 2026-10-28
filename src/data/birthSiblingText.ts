import type { FamilyData } from '../core/familyModel';
import type { Gender } from '../core/types';
import { siblingLabel } from './familyText';

/**
 * 출생신고의 형제자매 칸 문구 (SPEC-009 FA3 「보이는 곳」, 설계 문서 4-3 (5)·6-4절 B-1).
 *
 * **기본값은 「위 형제만」이다** (마스터 2026-10-28, 형진 님 확인 요청 B-1 답 전): 아직 태어나지 않은 동생이 신생아의 신고서에 있는 것은 모순이라 동생은 태어나는 해의 인생 기록과 카드에서 처음 보인다.
 * 형진 님이 「위로 형·누나 2명, 아래로 동생 1명」처럼 보이길 원하시면 이 상수 한 곳(`showYounger`)만 `true`로 바꾼다 — 화면 표시만 달라지고 저장·난수·구성은 그대로다.
 */
export const BIRTH_SIBLING_DISPLAY = { showYounger: false } as const;

/** 칸 이름과 문구 조각 (식구 카드의 호칭 규칙은 FM6이 정한다 — 여기는 출생신고 한 줄만) */
export const BIRTH_SIBLING_TEXT = {
  label: '형제자매',
  /** 위 형제가 없을 때 */
  noOlder: '위로 없음',
  olderPrefix: '위로 ',
  younger: (n: number): string => `아래로 동생 ${n}명`,
} as const;

/**
 * 출생신고 「형제자매」 한 줄: 「위로 형 1명, 누나 1명」 · 위가 없으면 「위로 없음」 · (`showYounger`가 켜졌을 때만) 「, 아래로 동생 2명」을 덧붙인다.
 * 호칭은 식구 카드와 같다(`siblingLabel`: 주인공이 남자이면 형·누나, 여자이면 오빠·언니). 가까운 순으로 처음 나온 호칭부터 센다. 순수 함수.
 */
export function birthSiblingLine(family: Pick<FamilyData, 'o' | 'y'>, me: Gender, showYounger: boolean = BIRTH_SIBLING_DISPLAY.showYounger): string {
  const counts = new Map<string, number>();
  for (const s of family.o) {
    const title = siblingLabel(me, s.g === 0 ? 'olderBrother' : 'olderSister');
    counts.set(title, (counts.get(title) ?? 0) + 1);
  }
  const older = counts.size === 0 ? BIRTH_SIBLING_TEXT.noOlder : BIRTH_SIBLING_TEXT.olderPrefix + [...counts].map(([title, n]) => `${title} ${n}명`).join(', ');
  return showYounger && family.y.length > 0 ? `${older}, ${BIRTH_SIBLING_TEXT.younger(family.y.length)}` : older;
}
