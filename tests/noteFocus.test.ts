import { describe, expect, it } from 'vitest';
import { decideLifeFocus, type FocusPlace } from '../src/ui/useFocus';
import { decideNoteFocus, type NoteFocusMoment, type NoteFocusTarget, type NoteFocusVia } from '../src/ui/noteFocus';

/**
 * 기록 시트의 포커스 규칙 (SPEC-003 M7c D-76, docs/data/content-M7c.md 5-9절): 5순간 × 열린 길 2 = 10칸. 실제 포커스 이동(DOM)은 e2e/m7c-note.spec.ts가 본다.
 * 표는 사람이 직접 적은 기대값이다(구현이 쓰는 상수·함수를 다시 계산하지 않는다). 인생 화면 `decideLifeFocus`의 48칸(tests/focus.test.ts)은 이 마일스톤에서 하나도 바뀌지 않았다.
 */

const MOMENTS: NoteFocusMoment[] = ['opened', 'emptyError', 'confirmOpened', 'confirmBack', 'closed'];
const VIAS: NoteFocusVia[] = ['auto', 'manual'];

/** [자동 카드, 「생각 남기기」 버튼] */
const TABLE: Record<NoteFocusMoment, [NoteFocusTarget, NoteFocusTarget]> = {
  opened: ['title', 'title'],
  emptyError: ['input', 'input'],
  confirmOpened: ['confirmBack', 'confirmBack'],
  confirmBack: ['input', 'input'],
  closed: ['lifeTitle', 'noteButton'],
};

describe('decideNoteFocus (content-M7c 5-9절, D-76): 5순간 × 2 = 10칸', () => {
  it('열 가지 칸 모두 손으로 적은 표와 같다', () => {
    let cells = 0;
    for (const moment of MOMENTS) {
      for (const [i, via] of VIAS.entries()) {
        expect(decideNoteFocus(moment, via), `${moment} × ${via}`).toBe(TABLE[moment][i]);
        cells++;
      }
    }
    expect(cells).toBe(10);
  });

  it('열린 길이 갈리는 순간은 「닫힘」 하나뿐이다: 자동 카드는 인생 화면 제목, 수동은 도구 줄의 「생각 남기기」 버튼', () => {
    for (const moment of MOMENTS) {
      const same = decideNoteFocus(moment, 'auto') === decideNoteFocus(moment, 'manual');
      expect(same, moment).toBe(moment !== 'closed');
    }
    expect(decideNoteFocus('closed', 'auto')).toBe('lifeTitle');
    expect(decideNoteFocus('closed', 'manual')).toBe('noteButton');
  });

  it('열릴 때는 입력란이 아니라 질문 제목이다(모바일에서 키보드가 질문을 가리지 않게), 확인 단계는 안전한 쪽이 먼저다', () => {
    for (const via of VIAS) {
      expect(decideNoteFocus('opened', via)).not.toBe('input');
      expect(decideNoteFocus('opened', via)).toBe('title');
      expect(decideNoteFocus('confirmOpened', via)).toBe('confirmBack');
      // 빈 입력 안내와 확인에서 돌아올 때는 키보드가 내려가지 않게 입력란
      expect(decideNoteFocus('emptyError', via)).toBe('input');
      expect(decideNoteFocus('confirmBack', via)).toBe('input');
    }
  });
});

describe('결정 시트 직후의 기록 시트 (content-M7c 5-4절 둘째 행, 5-9절): choiceResolved와 opened가 같은 커밋이면 opened가 이긴다', () => {
  it('시트 안 제목의 효과(자식)가 먼저 돌아 포커스가 제목에 있으면, 인생 화면의 choiceResolved 판정은 「포커스가 body로 떨어졌나」를 보고 아무것도 하지 않는다', () => {
    for (const auto of [false, true]) {
      // 자식 효과: 기록 시트의 opened → 질문 제목(시트 안, body가 아니다)
      expect(decideNoteFocus('opened', 'auto')).toBe('title');
      const placeAfterChild: FocusPlace = 'other';
      // 부모 효과: 결정 카드가 사라진 choiceResolved — 포커스를 잃지 않았으므로 건드리지 않는다
      expect(decideLifeFocus('choiceResolved', auto, placeAfterChild), `자동 모드 ${auto}`).toBe('none');
      // 대조: 기록 시트가 없었다면 포커스는 body로 떨어졌고 인생 화면 제목으로 옮겼을 것이다 (기존 규칙 그대로)
      expect(decideLifeFocus('choiceResolved', auto, 'body'), `대조 ${auto}`).toBe('lifeTitle');
    }
  });

  it('48칸은 그대로다: decideLifeFocus는 기록 시트의 순간을 모른다(8순간 × 자동 2 × 위치 3 = 48, tests/focus.test.ts의 표가 본다)', () => {
    const moments = ['enter', 'enterWithChoice', 'choiceAppeared', 'choiceAppearedBySkip', 'autoTurnedOff', 'choiceResolved', 'cardCollapsed', 'cardReopened'] as const;
    const places: FocusPlace[] = ['body', 'controls', 'other'];
    let cells = 0;
    for (const m of moments) for (const a of [false, true]) for (const p of places) {
      expect(['lifeTitle', 'choiceTitle', 'foldOpen', 'none']).toContain(decideLifeFocus(m, a, p));
      cells++;
    }
    expect(cells).toBe(48);
  });
});
