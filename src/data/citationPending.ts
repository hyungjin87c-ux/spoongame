import type { Era } from '../core/types';

/**
 * 인용 `2차 대기` 목록 (SPEC-003 M7b — 1차 게이트 뒤에 남은 칸).
 *
 * 선택지 이벤트(중대 결정 카드) 90개는 모두 이벤트 JSON에 `citation`(연결) 또는 `noCitation`(무인용 사유 X1~X6·D)을 가진다 — 단 아래 카드는 예외다:
 * **T-01~T-13 정서·관계 카드(content-M7b 2-4절 D, 「2차 후보」)** 는 맞는 공식 자료를 아직 수집하지 않았다. 이 카드들을 `noCitation: "D"`(자료가 없다고 확정한 카드)로 두면
 * 2차 수집이 끝나도 D인지 대기인지 구별되지 않으므로, 칸 단위로 여기에 적는다. 코드는 `docs/data/content-M7b.md`의 이름이다.
 * 칸 하나 = (카드, 세상) — 카드가 뜨지 않는 세상은 적지 않는다.
 *
 * 1차 게이트(MD2: 지금 ≥ 40% · 다가올 ≥ 40% · 지난 ≥ 8%)는 이 칸들을 **연결되지 않은 칸으로** 센다(분모에는 들어가고 분자에는 안 들어간다) — 약한 인용으로 채우지 않는다.
 * 2차가 칸을 채우는 방법: 그 카드의 이벤트 JSON에 `citation`을 쓰고 **이 목록에서 그 칸을 지운다**. `tests/citationLink.test.ts`가
 * 「이 목록의 칸은 아직 `citation`으로 연결되지 않았다」·「모든 선택지 이벤트는 `citation`/`noCitation`/이 목록 중 하나」를 점검하므로 연결하고 지우지 않으면 실패한다.
 * 끝내 자료를 못 구하면 칸을 지우고 그 카드를 `noCitation: "D"`로 확정한다.
 *
 * 이 목록은 게임 번들에 들어가지 않는다(시험·스크립트만 읽는다).
 */
export type PendingCode = string;

export const CITATION_PENDING: Readonly<Record<string, Readonly<Partial<Record<Era, PendingCode>>>>> = {
  'school-friend': { present: 'T-01', future: 'T-01' }, // 전학 온 아이
  'school-club': { present: 'T-03', future: 'T-03' }, // 방과 후의 모임
  'school-friend-quarrel': { present: 'T-02', future: 'T-02' }, // 틀어진 사이
  'school-puppy': { present: 'T-04', future: 'T-04' }, // 집 앞의 강아지
  'youth-meeting': { present: 'T-05', future: 'T-05' }, // 소개받은 자리
  'youth-friend-wedding': { present: 'T-06', future: 'T-06' }, // 오랜 친구의 결혼식
  'youth-colleague': { present: 'T-07', future: 'T-07' }, // 일터에서의 일
  'middle-friend-reunion': { present: 'T-08', future: 'T-08' }, // 오랜 친구의 연락
  'middle-hobby': { present: 'T-09', future: 'T-09' }, // 늦게 시작한 일
  'senior-gathering': { present: 'T-10', future: 'T-10' }, // 넉넉해진 시간
  'senior-travel': { present: 'T-13', future: 'T-13' }, // 미뤄 둔 여행
  'senior-old-friend': { present: 'T-11', future: 'T-11' }, // 오래된 친구의 소식
  'senior-classmates': { present: 'T-12', future: 'T-12' }, // 오랜만의 동창 모임
};

/** 대기 칸의 수 (카드, 세상) */
export function pendingCellCount(): number {
  return Object.values(CITATION_PENDING).reduce((n, cells) => n + Object.keys(cells).length, 0);
}
