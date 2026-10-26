import { useCallback, useEffect, useRef, type RefObject } from 'react';
import { revealCard } from './focusReveal';

/**
 * 화면 전환 시 새 화면의 제목으로 포커스를 옮긴다 (R-030).
 * 화면이 바뀌면 이전 화면의 버튼이 사라지면서 포커스가 문서 맨 앞(body)으로 떨어지는데,
 * 키보드·스크린리더 사용자는 그러면 어디에 있는지 알 수 없다. 제목에 tabIndex={-1}을 주고 여기서 포커스를 준다.
 * (인생 화면은 선택지가 뜨고 사라지는 상황까지 다뤄야 해서 아래 useLifeFocus를 쓴다.)
 */
export function useFocusOnChange<T extends HTMLElement>(): RefObject<T> {
  const ref = useRef<T>(null);
  useEffect(() => {
    ref.current?.focus();
  }, []);
  return ref;
}

// ---------- 인생 화면 포커스 규칙 (R-036, R-048, M7b D-52) ----------

/** 인생 화면에서 포커스를 다시 정해야 하는 순간 */
export type LifeFocusMoment =
  /** 인생 화면이 막 떴다 (대기 중인 선택지 없음) */
  | 'enter'
  /** 인생 화면이 막 떴는데 대기 중인 선택지가 있다 (새로고침 복원 등) — 카드는 열린 채 뜬다(접힘 상태는 저장하지 않는다, U5) */
  | 'enterWithChoice'
  /** 플레이 중 시간이 흘러 새 선택지가 떴다 (카드가 열린 채 뜬다) */
  | 'choiceAppeared'
  /** 사용자가 "다음 결정으로"를 직접 눌러 새 선택지가 떴다 */
  | 'choiceAppearedBySkip'
  /** 선택지가 대기 중인 채로 자동 모드가 꺼졌다 (R-048) — 인라인 카드가 시트로 바뀐다 */
  | 'autoTurnedOff'
  /** 선택지가 대기 중인 채로 자동 모드가 켜졌다 (SPEC-005 r4 UX12 — 시트의 「이후 결정을 자동으로 고르게 하기」, 마스터 결정 M-6 개정) — 같은 카드가 시트에서 인라인으로 바뀐다. 사용자가 직접 눌렀다 */
  | 'autoTurnedOn'
  /** 선택지가 사라졌다 (고르거나 자동으로 골랐다) */
  | 'choiceResolved'
  /** 사용자가 「잠시 덮어 두기」(또는 Esc)를 눌렀다 (M7b) */
  | 'cardCollapsed'
  /** 사용자가 접힌 띠의 「결정 다시 열기」를 눌렀다 (M7b) */
  | 'cardReopened'
  /** 부모님이 정한·흘러간 해의 비모달 카드가 떴다 (SPEC-005 PD5-a) — 누를 것이 없는 카드라 포커스를 가져가지 않는다. `pending`이 만들어지지 않으므로 `lifeFocusMoment`가 이 순간을 만들지는 않는다(표에 칸으로만 있다) */
  | 'delegatedCard';

/** 지금 포커스가 어디 있는가 */
export type FocusPlace = 'body' | 'controls' | 'other';

/** 'none' 아무것도 안 함 / 'choiceTitle' 선택지 제목으로 / 'lifeTitle' 인생 화면 제목(이름)으로 / 'foldOpen' 접힌 띠의 「결정 다시 열기」로 */
export type LifeFocusAction = 'none' | 'choiceTitle' | 'lifeTitle' | 'foldOpen';

/**
 * 인생 화면의 포커스 규칙(순수 함수 — DOM 없이 단위 테스트한다). 10순간(SPEC-005에서 `delegatedCard`·`autoTurnedOn` 추가) × 자동 모드 2 × 위치 3 = 60칸이 tests/focus.test.ts에 사람이 적은 기대값으로 있다.
 *  1. 자동 모드에서는 선택지가 떠도 포커스를 옮기지 않는다. 카드는 비모달 인라인이라 키보드로 자동 모드 버튼까지 가서 끌 수 있어야 한다(SPEC "언제든 해제 가능").
 *  2. **수동 모드에서는 카드가 모달 시트이고 바깥 전부가 inert다**(M7b, 마스터 결정 M-6·D-52). 시트가 뜨는 순간 컨트롤에 있던 포커스는 body로 떨어지므로 R-036 규칙 2(「컨트롤 안이면 포커스는 두고 알리기만」)는
 *     성립하지 않는다 — 포커스가 어디에 있었든(body·컨트롤·그 밖) 선택지 제목으로 간다. 규칙 2가 막으려던 「포커스가 튀어 다음 Space가 엉뚱한 선택을 확정」은 제목(버튼이 아님)으로 가므로 생기지 않고 400ms 입력 가드가 남는다.
 *  3. 사용자가 "다음 결정으로"를 직접 눌러 뜬 선택지도 수동에서는 제목으로(R-036 4). 자동 모드에서는 skip 버튼이 지속 비활성이라 이 순간이 오지 않지만, 오더라도 건드리지 않는다.
 *  4. 복원(새로고침)으로 선택지가 이미 떠 있는 채 화면이 열려도 플레이 중 뜬 선택지와 같은 대상(선택지 제목)을 쓴다. 자동 모드는 인생 화면 제목(카드는 인라인이라 포커스를 가져오지 않는다).
 *  5. 선택지가 대기 중인 채 자동 모드가 꺼지면(R-048) 인라인 카드가 시트로 바뀌므로 수동 규칙 2와 같게 — 어디에 있었든 제목으로.
 *  6. 선택지가 사라질 때 포커스가 body로 떨어졌다면(키보드로 누른 선택 버튼·카드의 제목·「결정 다시 열기」가 사라진 경우) **자동·수동 모두** 인생 화면 제목으로 보낸다(스크롤은 그대로, `preventScroll`). 다른 곳에 있었다면 그대로 둔다.
 *     자동 모드도 같은 이유다(R-393, 마스터 승인): 「결정 다시 열기」를 누르면 포커스가 인라인 카드 제목으로 가고(8), 3초 뒤 자동 선택으로 카드가 사라지면 포커스가 body로 떨어진다.
 *     규칙 1(「포커스를 빼앗지 않는다」)과 부딪치지 않는다 — 이미 잃은 포커스를 되돌려 줄 뿐이다. 「잃었다」는 포커스가 **있던 요소가 사라져서** body가 된 경우만이다(`lostFocusPlace`): 처음부터 아무것도 누르지 않아 body인 자동 진행은 건드리지 않는다.
 *  7. 사용자가 「잠시 덮어 두기」(Esc)를 누르면 어느 모드·어느 위치든 접힌 띠의 「결정 다시 열기」로 간다(U6(b) — 「열기 전 요소」로 되돌리지 않는다: 카드가 저절로 뜬 경우 그 요소가 body이거나 컨트롤이라 규칙 2·6과 부딪친다).
 *  8. 사용자가 「결정 다시 열기」를 누르면 어느 모드·어느 위치든 **선택지 제목**으로 간다 — 자동 모드여도 사용자가 직접 눌렀으므로(`choiceAppearedBySkip`의 원칙).
 *  9. (SPEC-005 r4 UX12) 선택지가 대기 중인 채 사용자가 카드 맨 끝의 「이후 결정을 자동으로 고르게 하기」를 눌러 자동 모드가 켜지면(`autoTurnedOn`) 같은 카드가 시트에서 인라인으로 바뀐다 —
 *     누른 버튼이 시트와 함께 사라지므로 포커스는 어디에 있었든(자동 모드가 켜졌어도) **선택지 제목**으로 간다. 「결정 다시 열기」(8)와 같은 원칙: 사용자가 직접 눌렀으므로 자동 모드에서도 옮긴다.
 *     끄는 쪽(인라인 → 시트)은 `autoTurnedOff`(5)가 그대로 맡는다. 도구 줄로 켜는 길은 시트가 떠 있는 동안 `inert`라 이 순간을 만들지 않는다(카드를 접어 둔 채 켜면 접힘 변화가 먼저다).
 *  화면이 처음 뜰 때(선택지 없음)는 제목(이름)으로 — R-030.
 * 컨트롤 그룹의 Tab 순서는 이 규칙과 무관하게 선택지가 뜨든 사라지든 변하지 않는다("다음 결정으로"는 disabled가 아니라 aria-disabled라 포커스를 받는다, R-036).
 */
export function decideLifeFocus(moment: LifeFocusMoment, autoMode: boolean, place: FocusPlace): LifeFocusAction {
  // 위치를 보는 순간은 `choiceResolved` 하나뿐이다(body = 포커스를 잃었으면 제목으로, 컨트롤·그 밖이면 그대로). 나머지 순간은 위치와 무관하다 — 모달 시트가 컨트롤을 inert로 만들므로 R-036 규칙 2의
  // 「컨트롤 안」 칸이 사라졌다. 시험이 위치 3종을 모두 대조해 다른 순간이 위치에 기대게 되면 잡는다.
  switch (moment) {
    case 'enter':
      return 'lifeTitle';
    case 'enterWithChoice':
      return autoMode ? 'lifeTitle' : 'choiceTitle';
    case 'choiceAppeared':
    case 'choiceAppearedBySkip':
    case 'autoTurnedOff':
      return autoMode ? 'none' : 'choiceTitle';
    case 'choiceResolved':
      return place === 'body' ? 'lifeTitle' : 'none'; // 자동·수동 같다 (R-393)
    case 'cardCollapsed':
      return 'foldOpen';
    case 'cardReopened':
    case 'autoTurnedOn':
      return 'choiceTitle';
    case 'delegatedCard':
      return 'none'; // 부모 결정·흘러감 카드: 자동·수동, 어느 위치든 포커스를 옮기지 않는다 (PD5-a)
  }
}

/** 인생 화면 상태 중 포커스 규칙이 보는 것 */
export interface FocusSnapshot {
  /** 대기 중인 선택지의 키 (없으면 null) */
  key: string | null;
  autoMode: boolean;
  /** 대기 중인 카드가 접혀 있는가 */
  folded: boolean;
}

/**
 * 이전 상태와 지금 상태를 견주어 **포커스를 다시 정해야 하는 순간**을 가린다(순수 함수 — 훅은 이것을 부르고 `decideLifeFocus`로 행동을 고른다). 아무 순간도 아니면 null.
 *  - 이전이 없으면(화면이 막 뜸) 선택지가 없을 때 `enter`, 있을 때 `enterWithChoice`.
 *  - 선택지 키가 바뀌었다: 사라졌으면 `choiceResolved`, 새로 떴으면 `choiceAppearedBySkip`(방금 「다음 결정으로」를 눌렀을 때) 또는 `choiceAppeared`.
 *  - 키가 같은데 접힘이 바뀌었다: 접혔으면 `cardCollapsed`, 다시 열렸으면 `cardReopened` (접기·다시 열기는 사용자가 직접 누른 것뿐이다).
 *  - 키가 같고 접히지 않은 채 자동 모드가 꺼졌다: `autoTurnedOff` (접힌 채 끄면 옮길 제목이 없다 — 다시 열 때 그때의 자동 모드에 맞는 틀로 뜬다).
 *  - 키가 같고 접히지 않은 채 자동 모드가 켜졌다: `autoTurnedOn` (SPEC-005 r4 UX12 — 시트의 자동 고르기 버튼. 접힌 채 켜면 순간이 아니다 — 다시 열 때 `cardReopened`).
 */
export function lifeFocusMoment(prev: FocusSnapshot | null, now: FocusSnapshot, skipPressed: boolean): LifeFocusMoment | null {
  if (prev === null) return now.key === null ? 'enter' : 'enterWithChoice';
  if (prev.key !== now.key) return now.key === null ? 'choiceResolved' : skipPressed ? 'choiceAppearedBySkip' : 'choiceAppeared';
  if (now.key === null) return null;
  if (prev.folded !== now.folded) return now.folded ? 'cardCollapsed' : 'cardReopened';
  if (!now.folded && prev.autoMode && !now.autoMode) return 'autoTurnedOff';
  if (!now.folded && !prev.autoMode && now.autoMode) return 'autoTurnedOn';
  return null;
}

/** 현재 포커스 위치. 이 화면에는 disabled 버튼이 없지만, 만약 disabled가 된 버튼에 포커스가 남아 있다면 키 입력을 받지 못하므로 body와 같게 본다. */
export function focusPlaceOf(controls: Element | null, active: Element | null): FocusPlace {
  if (active === null || active === document.body || active === document.documentElement) return 'body';
  if (active instanceof HTMLButtonElement && active.disabled) return 'body';
  return controls !== null && controls.contains(active) ? 'controls' : 'other';
}

/**
 * 선택지가 사라진 순간의 위치 (R-393): body가 「포커스를 잃은」 것인지 가른다. 포커스가 있던 요소(`lastFocused`)가 DOM에서 사라져 body로 떨어진 경우만 'body'(잃음)이고,
 * 처음부터 body였던 경우(자동 진행 중 아무것도 누르지 않았거나, 포커스를 풀고 비어 있는 곳을 눌렀다)는 'other'로 본다 — 자동 모드 8배속에서 사라지는 카드마다 제목을 다시 읽게 하지 않는다.
 * body가 아닌 위치는 그대로다.
 */
export function lostFocusPlace(place: FocusPlace, lastFocused: { isConnected: boolean } | null): FocusPlace {
  if (place !== 'body') return place;
  return lastFocused !== null && !lastFocused.isConnected ? 'body' : 'other';
}

export interface LifeFocusTargets {
  /** 대기 중인 선택지의 키(없으면 null) */
  pendingKey: string | null;
  autoMode: boolean;
  /** 대기 중인 카드가 접혀 있는가 (접힌 띠가 보인다) */
  folded: boolean;
  /** 인생 화면 제목 (이름) */
  titleRef: RefObject<HTMLElement>;
  /** 선택지 제목 */
  choiceTitleRef: RefObject<HTMLElement>;
  /** 접힌 띠의 「결정 다시 열기」 버튼 */
  foldOpenRef: RefObject<HTMLElement>;
  /** 속도/다음 결정으로/자동 모드 컨트롤 그룹 */
  controlsRef: RefObject<HTMLElement>;
}

export interface LifeFocusHandle {
  /** 사용자가 "다음 결정으로"를 눌렀음을 알린다(누르는 쪽 핸들러가 dispatch 직전에 부른다). 그 결과로 뜬 선택지는 제목으로 포커스를 옮긴다. */
  noteSkip: () => void;
}

/**
 * 인생 화면의 포커스를 한 곳에서 정한다(decideLifeFocus 규칙). 선택지가 뜨거나 사라질 때(pendingKey가 바뀔 때), 카드가 접히거나 다시 열릴 때, 선택지가 대기 중인 채 자동 모드가 꺼지거나 켜질 때(r4: 시트의 자동 고르기 버튼),
 * 화면이 처음 뜰 때만 동작하고, 나이 변화 같은 다른 갱신에서는 아무것도 하지 않는다.
 */
export function useLifeFocus(targets: LifeFocusTargets): LifeFocusHandle {
  const latest = useRef(targets);
  useEffect(() => {
    latest.current = targets; // 아래 효과보다 먼저 선언돼 있어 같은 커밋에서 항상 최신 값을 읽는다
  });
  // "방금 다음 결정으로를 눌렀다" 표시. 눌림 → dispatch → 렌더 → 커밋의 효과가 읽고, 어떤 커밋이든 그 효과 뒤에 지워진다(오래 남아 엉뚱한 선택지에 적용되지 않게).
  const skipPressed = useRef(false);
  const noteSkip = useCallback(() => {
    skipPressed.current = true;
  }, []);
  // null = 아직 한 번도 실행 전(화면이 막 뜸). StrictMode가 효과를 두 번 돌려도 두 번째는 같은 값이라 아무 일도 하지 않는다.
  const previous = useRef<FocusSnapshot | null>(null);
  const { pendingKey, autoMode, folded } = targets;
  // 마지막으로 포커스를 받은 요소: 선택지가 사라지는 커밋에서 그 요소가 사라졌는지로 「포커스를 잃었다」를 가른다(lostFocusPlace)
  const lastFocused = useRef<Element | null>(null);
  useEffect(() => {
    const onFocusIn = (e: FocusEvent) => {
      lastFocused.current = e.target instanceof Element ? e.target : null;
    };
    document.addEventListener('focusin', onFocusIn);
    return () => document.removeEventListener('focusin', onFocusIn);
  }, []);

  useEffect(() => {
    const t = latest.current;
    const prev = previous.current;
    const now: FocusSnapshot = { key: pendingKey, autoMode, folded };
    previous.current = now;
    const moment = lifeFocusMoment(prev, now, skipPressed.current);
    if (moment === null) return;
    let place = focusPlaceOf(t.controlsRef.current, document.activeElement);
    if (moment === 'choiceResolved') place = lostFocusPlace(place, lastFocused.current);
    const action = decideLifeFocus(moment, autoMode, place);
    if (action === 'choiceTitle') {
      // 포커스는 제목으로 옮기되 스크롤은 직접 맞춘다: 브라우저 기본은 제목을 화면 가운데로 올려 그 아래 선택지를 하단 고정 줄 밑으로 밀 수 있다(M4 대시보드 — 고정 헤더·진행 줄).
      // 인라인 카드(제목을 품은 section)가 헤더 밑·진행 줄 위 가용 영역 안에 이미 있으면 그대로 두고, 아니면 카드의 위쪽을 헤더 밑에 맞춘다(scroll-padding이 헤더·띠 높이를 담고 있다, CM10).
      // 모달 시트(role=dialog)는 문서와 따로 놓인 고정 상자라 문서 스크롤을 건드리지 않는다.
      const title = t.choiceTitleRef.current;
      if (title !== null) {
        title.focus({ preventScroll: true });
        if (title.closest('[role="dialog"]') === null) revealCard(title.closest('section') ?? title);
      }
    } else if (action === 'foldOpen') {
      // 접힌 띠는 카드가 있던 자리(가운데 열 맨 위)에 생기므로 문서를 읽던 자리에서 멀 수 있다 — 포커스를 받은 띠가 가용 영역 안에 오게 맞춘다
      const open = t.foldOpenRef.current;
      if (open !== null) {
        open.focus({ preventScroll: true });
        revealCard(open.closest('section') ?? open);
      }
    } else if (action === 'lifeTitle') t.titleRef.current?.focus({ preventScroll: moment === 'choiceResolved' });
  }, [pendingKey, autoMode, folded]);
  useEffect(() => {
    skipPressed.current = false;
  });

  return { noteSkip };
}
