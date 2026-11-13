import { displayAge } from '../core/format';
import type { SiblingKind } from '../core/family';
import type { AgeView, Gender, HeavyKind } from '../core/types';
import { siblingLabel } from './familyText';

/**
 * 가족 변화 줄의 문구 (SPEC-009 FM4b FA7, `docs/data/family-model.md` 2-2·4-7절): `familyChangesFor`가 인생 기록에 남기는 `fam-…` 줄의 글.
 * 무거운 줄(부모 한 분 별세 `parentGone` · 조부모 별세 `grandGone` · 부모 이혼·별거 `parentsApart` · 어린 형제의 이른 별세 `sibLost`)은 **FM7a에서 형진 님이 승인한 문장**이다
 * (`docs/design/fm7a-event-texts.md` 4절, 2026-11-06: T01~T06 — 추천안 · 부모·조부모 별세는 존대 「세상을 떠나셨습니다」 · T06 둘째 문장 다) · 확률 배율 1.0). 승인 표시는 `data/familyApproval.ts`가 갖고,
 * 승인된 문장을 고치면 다시 승인받아야 한다(`tests/familyText.test.ts`가 글자까지 잠근다). 동생 출생·독립 줄은 임시 문구 그대로다(문구 다양화·감정 밀도는 FM7b).
 * 합쇼체, 수저 등급명·금액·평가어·사인·원인·책임 서술 없음. 고르지 않은 꼴(비존대 「떠났습니다」)의 문장은 데이터에 두지 않는다(R-627).
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
  /** 어린 형제의 이른 별세 (Q3, FM7a) */
  sibLost: 'fam-sib-lost',
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
  /**
   * 조부모 별세 (T03·T04 — 승인): 「{호칭}가 {N}세에 세상을 떠나셨습니다.」 N = 그 분의 별세 나이(자기 나이). 함께 살던 분(떠나기 직전 `with`)이면 앞에 「함께 살던 」을 붙인다.
   * 주인공이 태어나기 전에 떠난 분은 줄이 없다(`familyChangesFor`).
   */
  grandGone: (index: number, goneAge: number, livedWith = false): string => `${livedWith ? '함께 살던 ' : ''}${iga(GRAND_LABEL[index])} ${goneAge}세에 세상을 떠나셨습니다.`,
  /**
   * 부모 한 분이 먼저 세상을 떠난 해 (T01·T02 — 승인): 「어머니가 {N}세에 세상을 떠나셨습니다.」 N = 그 분의 별세 나이. 주인공이 19세 이하(`EARLY_LOSS_MAX_AGE`)이면 아이가 본 것 한 줄을 더한다(「집 안이 한동안 조용했습니다.」),
   * 20세 이상이면 사실 한 가지뿐이다(장례·마지막 인사는 사건 카드가 맡는다).
   */
  parentGone: (who: 'mother' | 'father', goneAge: number, early: boolean): string => `${iga(who === 'mother' ? '어머니' : '아버지')} ${goneAge}세에 세상을 떠나셨습니다.${early ? ' 집 안이 한동안 조용했습니다.' : ''}`,
  /**
   * 부모 이혼·별거 (T05 — 승인): 「부모님이 따로 살게 되었습니다. 이후 {남는 분}와 함께 지냈습니다.」 — **떠나는 쪽을 문장이 지목하지 않는다**(책임 서술 없음, 누가 따로 사는지는 카드의 「따로 삶」이 알려 준다).
   * 남는 분 = 떠나는 쪽의 반대(어머니가 떠나면 아버지, 아버지가 떠나면 어머니). 두 호칭 모두 받침이 없어 「와」다.
   */
  parentsApart: (leaver: 'mother' | 'father'): string => `부모님이 따로 살게 되었습니다. 이후 ${leaver === 'mother' ? '아버지' : '어머니'}와 함께 지냈습니다.`,
  /**
   * 어린 형제의 이른 별세 (T06 — 승인, 둘째 문장 다)): 「{N}살이던 {호칭}이 세상을 떠났습니다. 어른들은 한동안 말을 아꼈습니다.」 N = 그 형제의 별세 나이(1~11). 호칭은 주인공 성별 기준(형·누나/오빠·언니, 남동생·여동생).
   * 형제는 비존대 「떠났습니다」다(승인 기록 1절 규칙 1). 사인·병명 없음.
   */
  sibLost: (player: Gender, kind: SiblingKind, goneAge: number): string => `${goneAge}살이던 ${iga(siblingLabel(player, kind))} 세상을 떠났습니다. 어른들은 한동안 말을 아꼈습니다.`,
} as const;

/** 인생 기록의 가족 줄 → 무거운 장면 분류 (4-9절, `core/gentle.ts`가 읽는다). 분류 없는 줄(동생 출생·독립)은 가리지 않는다. 가리면 글만 가려지고 상태·플래그·로그는 그대로다(방식 A) */
export const FAMILY_LINE_HEAVY: Readonly<Record<string, HeavyKind>> = {
  [FAMILY_LINE_ID.grandGone]: 'loss',
  [FAMILY_LINE_ID.parentGone]: 'loss',
  [FAMILY_LINE_ID.parentsApart]: 'home',
  [FAMILY_LINE_ID.sibLost]: 'loss',
};

/** 줄 문장 속 사람 나이(별세 나이)를 나이 보기로 읽는 세 줄 — 조부모 별세 · 부모 별세는 「N세에」, 어린 형제 별세는 「N살이던」으로 시작한다 (나이 차 「N살 위인」은 차이라 바꾸지 않는다) */
const AGE_IN_LINE: Readonly<Record<string, RegExp>> = {
  [FAMILY_LINE_ID.grandGone]: /(\d+)세에 세상을 떠나셨습니다/,
  [FAMILY_LINE_ID.parentGone]: /(\d+)세에 세상을 떠나셨습니다/,
  [FAMILY_LINE_ID.sibLost]: /^(\d+)살이던/,
};

/**
 * 가족 변화 줄의 화면 글자 (SPEC-019). 줄 문장은 만들 때 기록(`HistoryEntry.text`)에 굳기 때문에 — **저장 형식은 그대로** 두고 — 보여 줄 때만 문장 속 별세 나이를 나이 보기에 맞춘다.
 * 저장된 글자는 게임 나이(태어난 해 0)이고, 한국 나이는 +1(`displayAge`)이다. 가족 변화 줄이 아니거나 나이 자리를 못 찾으면 글자 그대로다.
 */
export function familyLineViewText(eventId: string | undefined, text: string, view: AgeView): string {
  const re = eventId === undefined ? undefined : AGE_IN_LINE[eventId];
  if (re === undefined) return text;
  return text.replace(re, (whole, n: string) => whole.replace(n, String(displayAge(Number(n), view))));
}
