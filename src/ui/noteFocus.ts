/**
 * 기록 시트의 포커스 규칙 (SPEC-003 M7c, docs/data/content-M7c.md 5-9절, D-76) — 순수 함수라 DOM 없이 단위 테스트한다(tests/noteFocus.test.ts, 5순간 × 2 = 10칸).
 *
 * 중대 결정 카드의 `decideLifeFocus`(8순간 × 자동 모드 2 × 위치 3 = 48칸)와 **따로** 둔다 — 기록 시트는 모달이라 열릴 때의 포커스는 「포커스가 어디 있었든」 같은 곳이고(11-10),
 * 닫을 때의 대상만 **여는 길**(저절로 뜬 카드 / 도구 줄 「생각 남기기」 버튼)에 달려 있어 `(순간 × 자동 × 위치)` 표에 끼우면 한 축이 어색하다. 48칸 기대값은 하나도 바꾸지 않았다.
 *
 * 같은 커밋에서 `choiceResolved`(결정을 고른 직후)와 `opened`(기록 시트가 막 열림)가 겹치면 **`opened`가 이긴다**: 시트 안 제목의 포커스 효과(자식)가 인생 화면의 포커스 효과(부모)보다 먼저 돌고,
 * 부모의 `choiceResolved` 판정은 「포커스가 body로 떨어졌는가」를 보는데 그때는 이미 시트 제목에 포커스가 있으므로 아무것도 하지 않는다(tests/noteFocus.test.ts).
 */

/** 기록 시트에서 포커스를 다시 정해야 하는 순간 */
export type NoteFocusMoment =
  /** 시트가 막 열렸다 */
  | 'opened'
  /** 빈 입력에서 「적어두고 살기」를 눌렀다 — 안내가 뜨고 카드는 열린 채다 */
  | 'emptyError'
  /** 글이 있는데 「마음속에 담고 살기」(또는 Esc)를 눌러 확인 단계가 열렸다 */
  | 'confirmOpened'
  /** 확인 단계에서 「돌아가서 이어 쓰기」(또는 Esc)를 눌렀다 */
  | 'confirmBack'
  /** 시트가 닫혔다 (저장·담아 두기·확정·40개 상태의 「닫기」) */
  | 'closed';

/** 시트를 연 길: 저절로 뜬 카드(`auto`) / 도구 줄 「생각 남기기」 버튼(`manual`) */
export type NoteFocusVia = 'auto' | 'manual';

/**
 * 'title' 시트의 질문 제목(h2) / 'input' 입력란(캐럿은 글 끝) / 'confirmBack' 확인 단계의 「돌아가서 이어 쓰기」 / 'lifeTitle' 인생 화면 제목(이름, `preventScroll`) / 'noteButton' 도구 줄 「생각 남기기」 버튼
 */
export type NoteFocusTarget = 'title' | 'input' | 'confirmBack' | 'lifeTitle' | 'noteButton';

export function decideNoteFocus(moment: NoteFocusMoment, via: NoteFocusVia): NoteFocusTarget {
  switch (moment) {
    case 'opened':
      return 'title'; // 입력란이 아니다 — 모바일에서 키보드가 질문을 가리지 않게
    case 'emptyError':
      return 'input'; // 키보드가 내려가지 않게
    case 'confirmOpened':
      return 'confirmBack'; // 안전한 쪽이 먼저 포커스를 받는다
    case 'confirmBack':
      return 'input';
    case 'closed':
      return via === 'auto' ? 'lifeTitle' : 'noteButton';
  }
}
