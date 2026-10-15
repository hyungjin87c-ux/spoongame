import { useCallback, useEffect, useRef, type RefObject } from 'react';

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

// ---------- 인생 화면 포커스 규칙 (R-036, R-048) ----------

/** 인생 화면에서 포커스를 다시 정해야 하는 순간 */
export type LifeFocusMoment =
  /** 인생 화면이 막 떴다 (대기 중인 선택지 없음) */
  | 'enter'
  /** 인생 화면이 막 떴는데 대기 중인 선택지가 있다 (새로고침 복원 등) */
  | 'enterWithChoice'
  /** 플레이 중 시간이 흘러 새 선택지가 떴다 */
  | 'choiceAppeared'
  /** 사용자가 "다음 결정으로"를 직접 눌러 새 선택지가 떴다 */
  | 'choiceAppearedBySkip'
  /** 선택지가 대기 중인 채로 자동 모드가 꺼졌다 (R-048) */
  | 'autoTurnedOff'
  /** 선택지가 사라졌다 (고르거나 자동으로 골랐다) */
  | 'choiceResolved';

/** 지금 포커스가 어디 있는가 */
export type FocusPlace = 'body' | 'controls' | 'other';

/** 'none' 아무것도 안 함 / 'announce' 포커스는 두고 aria-live로만 알림 / 'choiceTitle' 선택지 제목으로 / 'lifeTitle' 인생 화면 제목(이름)으로 */
export type LifeFocusAction = 'none' | 'announce' | 'choiceTitle' | 'lifeTitle';

/**
 * 인생 화면의 포커스 규칙(순수 함수 — DOM 없이 단위 테스트한다).
 *  1. 자동 모드에서는 선택지가 떠도 포커스를 옮기지 않는다. 키보드로 자동 모드 버튼까지 가서 끌 수 있어야 한다(SPEC "언제든 해제 가능").
 *  2. 수동 모드에서 포커스가 이미 컨트롤 그룹(속도 4개·다음 결정으로·자동 모드) 안에 있으면 옮기지 않고 aria-live로만 알린다.
 *     (속도 버튼 사이를 이동하는 중에 포커스가 튀어 다음 Space가 엉뚱한 선택을 확정하는 일을 막는다.)
 *  3. 그 밖의 경우(포커스가 body이거나 제목 등)에는 선택지 제목으로 옮긴다.
 *  4. 사용자가 "다음 결정으로"를 직접 눌러 뜬 선택지는 포커스가 그 버튼(컨트롤 안)에 있어도 선택지 제목으로 옮긴다 — 사용자가 선택지를 보려고 누른 것이다.
 *     (이 판단은 "방금 skip을 눌렀다"는 명시적 표시로 한다. 버튼이 disabled가 되어 포커스를 잃었는지에 기대지 않는다.)
 *  5. 복원(새로고침)으로 선택지가 이미 떠 있는 채 화면이 열려도 플레이 중 뜬 선택지와 같은 대상(선택지 제목)을 쓴다 — 부모·자식이 서로 덮어쓰지 않도록 한 곳에서만 정한다.
 *  6. 선택지가 대기 중인 채 자동 모드가 꺼지면(R-048) 그 순간 2·3을 다시 적용한다: 컨트롤 안이면 알리기만, 그 밖이면 선택지 제목으로.
 *  7. 선택지가 사라질 때 포커스가 body로 떨어졌다면(키보드로 누른 선택 버튼이 사라진 경우) 인생 화면 제목으로 보낸다. 다른 곳에 있었다면 그대로 둔다.
 *  화면이 처음 뜰 때(선택지 없음)는 제목(이름)으로 — R-030.
 * 컨트롤 그룹의 Tab 순서는 이 규칙과 무관하게 선택지가 뜨든 사라지든 변하지 않는다("다음 결정으로"는 disabled가 아니라 aria-disabled라 포커스를 받는다, R-036).
 */
export function decideLifeFocus(moment: LifeFocusMoment, autoMode: boolean, place: FocusPlace): LifeFocusAction {
  switch (moment) {
    case 'enter':
      return 'lifeTitle';
    case 'enterWithChoice':
      return autoMode ? 'lifeTitle' : 'choiceTitle';
    case 'choiceAppeared':
    case 'autoTurnedOff':
      if (autoMode) return 'none';
      return place === 'controls' ? 'announce' : 'choiceTitle';
    case 'choiceAppearedBySkip':
      return autoMode ? 'none' : 'choiceTitle';
    case 'choiceResolved':
      if (autoMode) return 'none';
      return place === 'body' ? 'lifeTitle' : 'none';
  }
}

/** 현재 포커스 위치. 이 화면에는 disabled 버튼이 없지만, 만약 disabled가 된 버튼에 포커스가 남아 있다면 키 입력을 받지 못하므로 body와 같게 본다. */
export function focusPlaceOf(controls: Element | null, active: Element | null): FocusPlace {
  if (active === null || active === document.body || active === document.documentElement) return 'body';
  if (active instanceof HTMLButtonElement && active.disabled) return 'body';
  return controls !== null && controls.contains(active) ? 'controls' : 'other';
}

export interface LifeFocusTargets {
  /** 대기 중인 선택지의 키(없으면 null) */
  pendingKey: string | null;
  autoMode: boolean;
  /** 인생 화면 제목 (이름) */
  titleRef: RefObject<HTMLElement>;
  /** 선택지 제목 */
  choiceTitleRef: RefObject<HTMLElement>;
  /** 속도/다음 결정으로/자동 모드 컨트롤 그룹 */
  controlsRef: RefObject<HTMLElement>;
  /** 스크린리더용 알림 영역(aria-live) */
  liveRef: RefObject<HTMLElement>;
}

export interface LifeFocusHandle {
  /** 사용자가 "다음 결정으로"를 눌렀음을 알린다(누르는 쪽 핸들러가 dispatch 직전에 부른다). 그 결과로 뜬 선택지는 제목으로 포커스를 옮긴다. */
  noteSkip: () => void;
}

/**
 * 인생 화면의 포커스를 한 곳에서 정한다(decideLifeFocus 규칙). 선택지가 뜨거나 사라질 때(pendingKey가 바뀔 때), 선택지가 대기 중인 채 자동 모드가 꺼질 때,
 * 화면이 처음 뜰 때만 동작하고, 나이 변화·자동 모드 켜기 같은 다른 갱신에서는 아무것도 하지 않는다.
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
  const previous = useRef<{ key: string | null; auto: boolean } | null>(null);
  const { pendingKey, autoMode } = targets;

  useEffect(() => {
    const t = latest.current;
    const prev = previous.current;
    previous.current = { key: pendingKey, auto: autoMode };
    let moment: LifeFocusMoment | null = null;
    if (prev === null) moment = pendingKey === null ? 'enter' : 'enterWithChoice';
    else if (prev.key !== pendingKey) moment = pendingKey === null ? 'choiceResolved' : skipPressed.current ? 'choiceAppearedBySkip' : 'choiceAppeared';
    else if (pendingKey !== null && prev.auto && !autoMode) moment = 'autoTurnedOff';
    const live = t.liveRef.current;
    if (moment === null) {
      // 자동 모드를 다시 켜면 이전 알림을 지운다(다시 꺼질 때 같은 문장이 다시 읽히도록)
      if (prev !== null && !prev.auto && autoMode && live !== null) live.textContent = '';
      return;
    }
    const action = decideLifeFocus(moment, autoMode, focusPlaceOf(t.controlsRef.current, document.activeElement));
    if (live !== null) live.textContent = action === 'announce' ? `선택지가 나왔습니다: ${t.choiceTitleRef.current?.textContent ?? ''}` : '';
    if (action === 'choiceTitle') t.choiceTitleRef.current?.focus();
    else if (action === 'lifeTitle') t.titleRef.current?.focus({ preventScroll: moment === 'choiceResolved' });
  }, [pendingKey, autoMode]);
  useEffect(() => {
    skipPressed.current = false;
  });

  return { noteSkip };
}
