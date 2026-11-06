/**
 * FM7a 무거운 문장의 승인 표지 (SPEC-009 「FM7 나눔」 2절 승인 게이트, RG11 방식 — 시대의 창 `EraWindow.approved`와 같은 뜻): 무거운 장면(부모 한 분 별세·조부모 별세·부모 이혼·병환·어린 형제의 이른 별세)의 문장은
 * 형진 님이 사건(T번호)마다 승인해야 하고, **`approved !== true`인 항목이 하나라도 있으면 배포 빌드(`npm run build` → `scripts/validateEvents.ts`)와 `tests/familyText.test.ts`가 그 항목의 번호를 대며 실패한다.**
 * 승인된 문장은 `docs/design/fm7a-event-texts.md` 4절 표(2026-11-06 형진 님: T01~T10 추천안 전부 승인 · 부모·조부모 별세 줄은 존대 「세상을 떠나셨습니다」 · T06 둘째 문장 다) · 확률 배율 1.0)와 같고,
 * 승인한 문장을 고치면 다시 승인받아야 한다 — 글자는 `tests/familyText.test.ts`가 잠근다(줄 문구 출력·변형 사건 본문).
 *
 * **T06(어린 형제의 이른 별세)만 예외**다: 승인되지 않아도 배포한다 — 이 항목의 `approved`가 `true`가 아니면 계획이 꺼져 있어야 한다(`design.siblingLoss.enabled === false`, `familyTables.ts` 한 곳).
 * 그 밖의 항목은 승인되지 않으면 배포하지 않는다(줄을 빼면 「상태가 바뀌면 그림·카드·인생 기록이 함께 바뀐다」(FA7)가 깨진다).
 */

export interface TextApproval {
  /** 문장 문서의 번호 (T01~T10) */
  id: string;
  /** 무엇인가 (문장 문서 2절 표의 사건 이름) */
  what: string;
  /** 형진 님의 승인 여부 — true만 배포한다 */
  approved: boolean;
  /** 이 승인이 덮는 코드 위치: `line:`은 인생 기록 줄(`fam-…`), `event:`는 사건 id, `choice:`는 `사건 id/선택지 id`, `note:`는 글감 카드 id */
  covers: readonly string[];
  /** 승인되지 않아도 배포하는 항목 (T06 — 계획만 끈다) */
  optional?: true;
}

/** 승인 표 (2026-11-06, 형진 님). 바꿀 때는 새 승인 기록(`ai-log` decision)을 먼저 남긴다 */
export const FM7A_APPROVALS: readonly TextApproval[] = [
  { id: 'T01', what: '부모 한 분 별세 줄 — 주인공 19세 이하', approved: true, covers: ['line:fam-parent-gone'] },
  { id: 'T02', what: '부모 한 분 별세 줄 — 주인공 20세 이상', approved: true, covers: ['line:fam-parent-gone'] },
  { id: 'T03', what: '조부모 별세 줄 — 기본', approved: true, covers: ['line:fam-gp-gone'] },
  { id: 'T04', what: '조부모 별세 줄 — 함께 살던 분', approved: true, covers: ['line:fam-gp-gone'] },
  { id: 'T05', what: '부모 이혼·별거 줄', approved: true, covers: ['line:fam-parents-apart'] },
  { id: 'T06', what: '어린 형제의 이른 별세 줄 (Q3)', approved: true, covers: ['line:fam-sib-lost'], optional: true },
  {
    id: 'T07',
    what: '「남은 한 분」 병환 사건 — 제목·본문·「직접 모시고 돌본다」 결과',
    approved: true,
    covers: ['event:middle-parents-care-mother-gone', 'event:middle-parents-care-father-gone', 'choice:middle-parents-care-mother-gone/home', 'choice:middle-parents-care-father-gone/home'],
  },
  { id: 'T08', what: '「남은 한 분」 마지막 인사 사건 — 본문', approved: true, covers: ['event:middle-parents-farewell-mother-gone', 'event:middle-parents-farewell-father-gone'] },
  { id: 'T09', what: '청년 「살 곳을 구하는 일」 — 「본가」', approved: true, covers: ['choice:youth-housing/parents', 'choice:youth-housing/return'] },
  { id: 'T10', what: '글감 「부모님의 나이듦」 — 남은 분 변형', approved: true, covers: ['note:note-parents-aging'] },
];

/**
 * 승인 게이트의 문제 목록 (빈 배열이면 통과). `siblingLossEnabled`는 어린 형제의 이른 별세 계획의 스위치(`design.siblingLoss.enabled`)다.
 *  - 승인되지 않은 항목(T06 제외)이 있으면 그 번호를 대며 막는다.
 *  - T06이 승인되지 않았는데 계획이 켜져 있으면 막는다(승인 없는 문장이 나온다). 계획이 꺼져 있으면 T06 미승인은 문제가 아니다.
 *  - 번호가 겹치거나 `covers`가 비어 있으면 막는다(표가 깨진 것).
 */
export function familyApprovalProblems(approvals: readonly TextApproval[], siblingLossEnabled: boolean): string[] {
  const problems: string[] = [];
  const ids = new Set<string>();
  for (const a of approvals) {
    if (ids.has(a.id)) problems.push(`${a.id}: 승인 표에 번호가 겹친다`);
    ids.add(a.id);
    if (a.covers.length === 0) problems.push(`${a.id}: 덮는 코드 위치(covers)가 없다`);
    if (a.approved === true) continue;
    if (a.optional === true) {
      if (siblingLossEnabled) problems.push(`${a.id}(${a.what}): 승인 전인데 계획이 켜져 있다 — design.siblingLoss.enabled를 false로 하고 배포하거나 승인을 받는다`);
      continue;
    }
    problems.push(`${a.id}(${a.what}): 형진 님 승인 전이다 — approved: true가 아니면 배포 빌드가 막힌다 (docs/design/fm7a-event-texts.md 4절)`);
  }
  return problems;
}
