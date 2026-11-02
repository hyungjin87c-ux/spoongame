import type { SiblingKind } from '../core/family';
import type { Gender, HeavyKind } from '../core/types';
import { siblingLabel } from './familyText';

/**
 * 가족 변화 줄의 문구 (SPEC-009 FM4b FA7, `docs/data/family-model.md` 2-2·4-7절): `familyChangesFor`가 인생 기록에 남기는 `fam-…` 줄의 글.
 * **FM4b의 임시 문구다** — 줄 종류·분류(무거운 장면)·id는 확정이고, 소재 창고를 반영한 감정 밀도 있는 문구는 FM7(`copy.md`)이 이 표를 바꾼다. 그래서 짧고 사실만 쓴다(원인·책임 서술 없음, FA0-5).
 * 합쇼체, 수저 등급명·금액·평가어 없음.
 */

/** 받침이 있으면 「이」, 없으면 「가」 */
function iga(word: string): string {
  const code = word.charCodeAt(word.length - 1) - 0xac00;
  return code >= 0 && code <= 11171 && code % 28 !== 0 ? `${word}이` : `${word}가`;
}

export const FAMILY_LINE_ID = {
  sibBorn: 'fam-sib-born',
  sibLeft: 'fam-sib-left',
  grandGone: 'fam-gp-gone',
  parentGone: 'fam-parent-gone',
  parentsApart: 'fam-parents-apart',
} as const;

/** 조부모 호칭: 친할아버지 · 친할머니 · 외할아버지 · 외할머니 (`FamilyData.g`의 순서) */
export const GRAND_LABEL: readonly string[] = ['친할아버지', '친할머니', '외할아버지', '외할머니'];

/** 아래 동생의 순서 이름 (둘째부터 — 첫 동생은 순서를 붙이지 않는다) */
const YOUNGER_ORD = ['', '', '둘째', '셋째', '넷째', '다섯째', '여섯째', '일곱째'] as const;

export const FAMILY_LINE_TEXT = {
  /**
   * 아래 동생이 태어난 해 (카드로 대신하지 않는 동생). `order`는 태어난 순서(1부터) — 같은 판에서 같은 문장이 되풀이되지 않게 둘째 동생부터 순서를 붙인다
   * (한 판에서 같은 문구가 되풀이되지 않는다, QA 사용감 7).
   */
  sibBorn: (youngerGender: Gender, order = 1): string => {
    const who = iga(youngerGender === 'male' ? '남동생' : '여동생');
    return order <= 1 ? `${who} 태어났습니다.` : `${YOUNGER_ORD[Math.min(order, 7)]} 동생으로 ${who} 태어났습니다.`;
  },
  /** 형제가 독립해 집을 나선 해 — 호칭은 주인공 성별 기준(형·누나/오빠·언니, 남동생·여동생). 나이 차(`gap`살)를 붙여 같은 호칭의 형제 둘이 같은 문장이 되지 않는다 */
  sibLeft: (player: Gender, kind: SiblingKind, gap: number, older: boolean): string => `${gap}살 ${older ? '위인' : '아래인'} ${iga(siblingLabel(player, kind))} 독립해 집을 나섰습니다.`,
  grandGone: (index: number): string => `${iga(GRAND_LABEL[index])} 세상을 떠났습니다.`,
  /** 부모 한 분이 먼저 세상을 떠난 해 */
  parentGone: (who: 'mother' | 'father'): string => `${iga(who === 'mother' ? '어머니' : '아버지')} 세상을 떠났습니다.`,
  /** 부모 이혼·별거 — 떠나는 쪽만 밝히고 원인·책임은 쓰지 않는다 */
  parentsApart: (leaver: 'mother' | 'father'): string => `${iga(leaver === 'mother' ? '어머니' : '아버지')} 집을 떠나 따로 살게 되었습니다.`,
} as const;

/** 인생 기록의 가족 줄 → 무거운 장면 분류 (4-9절, `core/gentle.ts`가 읽는다). 분류 없는 줄(동생 출생·독립)은 가리지 않는다. 가리면 글만 가려지고 상태·플래그·로그는 그대로다(방식 A) */
export const FAMILY_LINE_HEAVY: Readonly<Record<string, HeavyKind>> = {
  [FAMILY_LINE_ID.grandGone]: 'loss',
  [FAMILY_LINE_ID.parentGone]: 'loss',
  [FAMILY_LINE_ID.parentsApart]: 'home',
};
