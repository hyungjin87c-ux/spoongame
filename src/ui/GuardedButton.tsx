import { forwardRef, useEffect, useState, type ButtonHTMLAttributes, type MouseEvent } from 'react';

/**
 * 화면 전환 직후 입력 가드 (R-014). UI 계층 전용 — core 순수 함수는 건드리지 않는다.
 *
 * 문제: 화면이 바뀌면 같은 좌표에 새 화면의 버튼이 놓일 수 있다. 더블클릭·연타의 둘째 클릭이
 * 그 버튼에 떨어지면 사용자는 새 화면을 보지도 못하고 다음 단계로 넘어가 버린다.
 * 대책: 새 화면이 뜬 뒤 INPUT_GUARD_MS 동안은 이 컴포넌트로 만든 버튼의 클릭을 무시한다.
 * 사람의 더블클릭 간격(약 100~300ms)보다 길고, 의도한 입력을 눈에 띄게 늦추지 않는 값이다.
 *
 * 재사용:
 *  - 인생 화면의 선택지 버튼은 이벤트 인스턴스의 고유 키(pending.key)를 guardKey로 넘긴다.
 *    같은 버튼 요소가 다음 선택지에서 재사용돼도(같은 위치·같은 타입이라 React가 언마운트하지 않는 경우) guardKey가
 *    바뀌는 그 렌더에서 즉시 다시 닫히고 ms 뒤에 열린다 — 연타가 다음 선택지를 자동으로 누르지 못한다.
 *  - 인생 화면의 하단 컨트롤(속도 4개·다음 결정으로·자동 모드)은 화면에 들어온 순간에만 걸리도록 상수 키를 넘긴다(R-035).
 *    "살아가기"/"이 탭에서 이어하기" 더블클릭의 둘째 입력이 같은 좌표의 컨트롤에 떨어지는 것을 막는다.
 *    키가 바뀌지 않으므로 플레이 중(배속 연타·나이가 오를 때·자동 모드 해제)에는 다시 닫히지 않는다.
 *
 * 접근성: 가드는 disabled 대신 aria-disabled를 쓴다(포커스는 유지, 스크린리더에는 비활성으로 전달).
 * Playwright도 aria-disabled=true를 비활성으로 보므로 e2e는 고정 대기 없이
 * "버튼이 활성화될 때까지"를 자동으로 기다린다.
 *
 * 호출자가 "지금은 누를 수 없는 버튼"을 만들 때(예: 선택지 대기 중·자동 모드의 "다음 결정으로")도 disabled가 아니라 aria-disabled를 넘긴다(R-036).
 * disabled 버튼은 Tab 순서에서 빠져 키보드 사용자의 Tab 순서가 상태에 따라 바뀌고, 포커스가 있던 버튼이 disabled가 되면 포커스를 잃기 때문이다.
 * 가드와 호출자의 비활성은 합쳐서 판단한다(isButtonInert): 둘 중 하나라도 비활성이면 aria-disabled="true"이고 클릭/Enter/Space(= 버튼의 click)를 무시한다.
 * 가드가 풀려도 호출자의 비활성은 그대로 유지된다. 어느 쪽이든 포커스는 받는다.
 *
 * 비활성의 두 가지 모양(R-337, SPEC-003 DS3·docs/design/design-system.md 2절 「비활성 컨트롤의 대비」): ① 진입 직후 0.4초 입력 가드는 과도 상태라 `aria-disabled`만 붙고 CSS가 흐리게(불투명도) 그린다.
 * ② 호출자가 넘긴 **지속 비활성**(자동 모드 내내인 「다음 결정으로」 — 「생각 남기기」는 M7c부터 보통 버튼이다)은 눈에 보이는 글자가 읽혀야 하므로 `data-unavailable="true"`도 함께 붙고, CSS가 불투명도 대신
 * 옅은 글자(`--c-text-3`) + 점선 테두리로 그린다(대비 4.5:1, 새 토큰 없음). 렌더 대비 e2e(e2e/m4-colors.spec.ts)는 이 요소를 면제하지 않고 잰다.
 */
export const INPUT_GUARD_MS = 400;

/** 가드를 다시 거는 기준 값. 화면/이벤트 인스턴스를 식별하는 문자열이나 숫자만 허용한다(인라인 객체는 렌더마다 달라져 무한 갱신을 부른다, R-029). */
export type GuardKey = string | number | null;

/**
 * 개발 서버 전용 탐침(e2e용, ?__crash=1과 같은 방식): ?__guard=<ms> 이면 가드 시간을 덮어쓴다.
 * 0이면 가드 없음(회귀 테스트의 대조군), 아주 큰 값이면 가드가 사실상 풀리지 않아
 * "가드 중 입력은 무시된다"를 시간에 의존하지 않고 결정적으로 검증할 수 있다.
 * 프로덕션 빌드에서는 import.meta.env.DEV가 false라 통째로 제거된다.
 */
function devGuardOverride(): number | null {
  if (!import.meta.env.DEV || typeof window === 'undefined') return null;
  const raw = new URLSearchParams(window.location.search).get('__guard');
  if (raw === null || raw.trim() === '') return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

export interface GuardState {
  key: GuardKey;
  ready: boolean;
}

/** 렌더 중 키를 확인한다: 키가 바뀌었으면 같은 렌더에서 바로 닫는다(효과를 기다리면 한 프레임 동안 열린 채로 그려진다). */
export function reconcileGuard(prev: GuardState, resetKey: GuardKey): GuardState {
  return Object.is(prev.key, resetKey) ? prev : { key: resetKey, ready: false };
}

/** 대기 시간이 끝났을 때: 그 사이 키가 다시 바뀌었다면(다른 화면의 타이머) 열지 않는다. */
export function openGuard(prev: GuardState, forKey: GuardKey): GuardState {
  return Object.is(prev.key, forKey) && !prev.ready ? { key: prev.key, ready: true } : prev;
}

/** 가드가 풀렸는지(true) 여부. resetKey가 바뀌면 같은 렌더에서 즉시 닫히고 다시 ms만큼 기다린다. */
export function useInputGuard(resetKey: GuardKey = null, requestedMs: number = INPUT_GUARD_MS): boolean {
  const ms = devGuardOverride() ?? requestedMs;
  const [state, setState] = useState<GuardState>({ key: resetKey, ready: false });
  const current = reconcileGuard(state, resetKey);
  if (current !== state) setState(current);
  useEffect(() => {
    if (ms <= 0) return;
    const timer = window.setTimeout(() => {
      setState((s) => openGuard(s, resetKey));
    }, ms);
    return () => window.clearTimeout(timer);
  }, [resetKey, ms]);
  return ms <= 0 || current.ready;
}

/**
 * 버튼이 입력을 무시해야 하는가(= aria-disabled="true"로 보여야 하는가). 가드가 닫혀 있거나 호출자가 aria-disabled를 true로 넘겼으면 true.
 * 호출자가 넘기는 aria-disabled는 true / 'true'만 비활성으로 본다(false·'false'·undefined와 ARIA의 다른 토큰은 비활성이 아니다).
 */
export function isButtonInert(guardReady: boolean, callerAriaDisabled: ButtonHTMLAttributes<HTMLButtonElement>['aria-disabled']): boolean {
  return !guardReady || isCallerUnavailable(callerAriaDisabled);
}

/**
 * 호출자가 「지금은 누를 수 없다」고 넘긴 비활성인가(`aria-disabled`가 true / 'true'). 0.4초 입력 가드(과도 상태)와 구분하려고 따로 센다 —
 * 호출자의 비활성은 **지속** 비활성(자동 모드 내내 「다음 결정으로」)이라 눈에 보이는 글자가 읽혀야 한다(R-337).
 */
export function isCallerUnavailable(callerAriaDisabled: ButtonHTMLAttributes<HTMLButtonElement>['aria-disabled']): boolean {
  return callerAriaDisabled === true || callerAriaDisabled === 'true';
}

export interface GuardedButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** 이 값이 바뀌면 가드가 다시 걸린다(같은 버튼이 다른 화면/이벤트에서 재사용될 때). */
  guardKey?: GuardKey;
  /** 기본 INPUT_GUARD_MS. 0 이하면 가드 없음. */
  guardMs?: number;
}

/** 버튼 요소를 가리키는 ref를 받는다(포커스를 옮겨야 하는 호출자용, R-212). */
export const GuardedButton = forwardRef<HTMLButtonElement, GuardedButtonProps>(function GuardedButton({ guardKey, guardMs, onClick, 'aria-disabled': callerAriaDisabled, ...rest }, ref) {
  const ready = useInputGuard(guardKey, guardMs);
  const inert = isButtonInert(ready, callerAriaDisabled);
  // 호출자가 넘긴 지속 비활성에만 표식을 단다: 0.4초 가드(ready=false)만으로는 달지 않는다 — 가드의 흐림은 읽으라고 둔 글자가 아니라 더블탭을 삼키는 과도 상태다(R-337, design-system.md 2절)
  const unavailable = isCallerUnavailable(callerAriaDisabled);
  const handleClick = (e: MouseEvent<HTMLButtonElement>) => {
    if (inert) {
      e.preventDefault();
      return;
    }
    onClick?.(e);
  };
  return <button type="button" {...rest} ref={ref} aria-disabled={inert ? true : undefined} data-unavailable={unavailable ? 'true' : undefined} onClick={handleClick} />;
});
