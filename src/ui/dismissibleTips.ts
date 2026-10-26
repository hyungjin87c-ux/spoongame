import { useEffect, type RefObject } from 'react';

/**
 * 도구 줄 압축 모드(폭 960~1179px, 마우스 PC)의 말풍선을 Esc로 숨긴다 (WCAG 1.4.13 「닫을 수 있음」, REV-005-r4-1 R-501).
 *
 * 말풍선은 CSS(`dash.css` 「도구 줄 압축 모드」)가 `:hover`·`:focus-visible`로 보이는데, 그대로 두면 마우스를 올려 둔 채·포커스를 둔 채로는 닫을 길이 없다.
 * 이 훅은 그룹 요소(`.controls__tools`)에 `data-tip-off` 속성을 켜고 끄기만 한다 — CSS가 그 속성이 있으면 말풍선을 다시 가린다. React 상태가 아니라 속성이라 다시 그리지 않는다.
 *  - 켜는 때: Esc를 눌렀고 지금 말풍선이 보이는 중(그룹 안 버튼에 올림 또는 키보드 포커스)일 때. 말풍선이 없으면 아무것도 하지 않는다(다른 Esc 처리 — 시트 닫기·나가기 확인 닫기 — 와 겹치지 않는다. 이벤트를 막지도 않는다).
 *  - 끄는 때: 올려 둔 버튼이 바뀌거나(다른 버튼·그룹 밖에서 들어옴) 포커스가 다른 버튼으로 옮겨 갈 때 — 마우스를 치웠다가 다시 올리면 다시 보인다.
 * 압축 모드가 아닌 곳(이름이 늘 보이는 ≥ 1180px · 터치 · < 960px)에서는 CSS가 이 속성을 보지 않으므로 아무 일도 일어나지 않는다.
 */

/** 말풍선을 숨겼다는 표시 속성 (dash.css가 읽는다) */
export const TIP_OFF_ATTR = 'data-tip-off';

/** 말풍선을 거느린 도구 버튼 */
const BUTTON_SELECTOR = '.btn--tool';

/** 지금 말풍선이 보이는 중인 버튼이 있는가 — `:focus-visible`을 모르는 오래된 브라우저는 `:focus`로 물러난다 */
export function tipShowing(root: Element): boolean {
  try {
    return root.querySelector(`${BUTTON_SELECTOR}:hover, ${BUTTON_SELECTOR}:focus-visible`) !== null;
  } catch {
    return root.querySelector(`${BUTTON_SELECTOR}:hover, ${BUTTON_SELECTOR}:focus`) !== null;
  }
}

const buttonOf = (target: EventTarget | null): Element | null => (target instanceof Element ? target.closest(BUTTON_SELECTOR) : null);

export function useDismissibleTips(rootRef: RefObject<HTMLElement>): void {
  useEffect(() => {
    const root = rootRef.current;
    if (root === null) return;
    // 올린/포커스한 버튼이 바뀌면 이전 숨김은 거둔다 (relatedTarget = 직전에 있던 곳)
    const onMove = (e: PointerEvent | FocusEvent) => {
      if (buttonOf(e.target) !== buttonOf(e.relatedTarget)) root.removeAttribute(TIP_OFF_ATTR);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && tipShowing(root)) root.setAttribute(TIP_OFF_ATTR, '');
    };
    root.addEventListener('pointerover', onMove);
    root.addEventListener('focusin', onMove);
    // Esc는 포커스가 어디 있든(마우스만 올려 둔 경우 포함) 문서에서 받는다
    document.addEventListener('keydown', onKey);
    return () => {
      root.removeEventListener('pointerover', onMove);
      root.removeEventListener('focusin', onMove);
      document.removeEventListener('keydown', onKey);
      root.removeAttribute(TIP_OFF_ATTR);
    };
  }, [rootRef]);
}
