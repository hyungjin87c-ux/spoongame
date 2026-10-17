import type { ChildState, ParentState, SiblingKind, SpouseState } from '../core/family';
import type { Gender } from '../core/types';

/**
 * 대시보드 식구 카드(DB13)의 문구 — 한 곳에 모았다. 계산은 core/family.ts, 문구 기준은 docs/design/copy.md 「대시보드 · 오른쪽 열 가족 카드」.
 * 형제자매 호칭은 **주인공의 성별**에 따라 다르다(남자 주인공: 형·누나, 여자 주인공: 오빠·언니, 아래 동생은 남동생·여동생).
 */

export const PARENT_STATE_LABEL: Record<ParentState, string> = {
  healthy: '건강함',
  ill: '병환 중',
  aged: '고령',
  gone: '세상을 떠남',
};

/** 사별(또는 가족 나이 상한 초과)을 나이 자리에 적는 글자 */
export const GONE_LABEL = '세상을 떠남';

export const SPOUSE_LABEL: Record<SpouseState, string> = {
  none: '없음',
  partner: '연인',
  married: '있음',
  divorced: '이혼',
};

export const CHILD_LABEL: Record<ChildState, string> = {
  none: '없음',
  has: '있음',
};

const SIBLING_LABEL: Record<Gender, Record<SiblingKind, string>> = {
  male: { olderBrother: '형', olderSister: '누나', youngerBrother: '남동생', youngerSister: '여동생' },
  female: { olderBrother: '오빠', olderSister: '언니', youngerBrother: '남동생', youngerSister: '여동생' },
};

/** 주인공 성별 기준의 호칭 */
export function siblingLabel(player: Gender, kind: SiblingKind): string {
  return SIBLING_LABEL[player][kind];
}

/** 「3세 위」「5세 아래」 */
export function siblingGapText(gap: number, older: boolean): string {
  return `${gap}세 ${older ? '위' : '아래'}`;
}
