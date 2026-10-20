import { useCallback, useEffect, useRef } from 'react';

/**
 * 정보 패널의 「뒤로가기 = 닫기」 (SPEC-005 NT5): 패널이 열릴 때 history 항목 하나를 **더하고**(주소는 그대로), 뒤로가기(popstate)가 오면 패널을 닫는다.
 * 「닫기」·Esc로 닫을 때도 그 항목을 되돌려(history.back) 뒤로가기를 눌러도 아무 일도 없는 빈 항목이 남지 않게 한다 — 닫는 길이 셋이어도 history는 늘 한 걸음이다.
 *
 * 항목에 이 패널의 **열림 표식**(`{ suzeoInfoPanel: <토큰> }`)을 단다. 같은 표식이 이미 현재 항목에 있으면 다시 더하지 않는다 — 개발 서버의 StrictMode가 효과를 두 번 돌려도 항목이 두 개가 되지 않는다.
 * 토큰은 패널을 열 때마다 새로 만든다: 새로고침한 뒤에는 이전 토큰이 남은 항목에서 새 패널이 열려도 표식이 달라 항목을 새로 더한다(새로고침하면 패널은 닫힌 첫 화면이다).
 * `history.back()`이 popstate를 일으키지 않는 환경을 대비해 짧은 보호 시간(`BACK_FALLBACK_MS`) 뒤에도 닫는다 — 패널에 갇히지 않는다.
 */

/** 항목 표식의 키 */
export const PANEL_STATE_KEY = 'suzeoInfoPanel';
/** `history.back()` 뒤에 popstate가 오지 않을 때 그래도 닫는 보호 시간(ms) */
export const BACK_FALLBACK_MS = 500;

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);

/** 현재 history 항목이 이 토큰의 패널 표식을 달고 있는가 */
export function hasPanelMark(state: unknown, token: string): boolean {
  return isObj(state) && state[PANEL_STATE_KEY] === token;
}

let tokenSeq = 0;
function newToken(): string {
  tokenSeq += 1;
  return `${Math.round(typeof performance === 'undefined' ? 0 : performance.now())}-${tokenSeq}`;
}

/**
 * 패널이 마운트된 동안의 history 처리. 돌려주는 함수가 「닫기 요청」이다(닫기 버튼·Esc가 부른다): 표식이 있으면 `history.back()`으로 항목을 되돌리고 popstate가 `onClosed`를 부른다.
 * `onClosed`는 여러 번 불려도 안전해야 한다(popstate와 보호 시간이 둘 다 올 수 있다).
 */
export function useInfoPanelHistory(onClosed: () => void): () => void {
  const token = useRef<string | null>(null);
  if (token.current === null) token.current = newToken();
  const closed = useRef(onClosed);
  closed.current = onClosed;
  const timer = useRef<number | null>(null);

  useEffect(() => {
    const t = token.current as string;
    if (typeof window === 'undefined') return;
    if (!hasPanelMark(window.history.state, t)) {
      const base = isObj(window.history.state) ? window.history.state : {};
      window.history.pushState({ ...base, [PANEL_STATE_KEY]: t }, '');
    }
    const onPop = () => closed.current();
    window.addEventListener('popstate', onPop);
    return () => {
      window.removeEventListener('popstate', onPop);
      if (timer.current !== null) window.clearTimeout(timer.current);
    };
  }, []);

  return useCallback(() => {
    const t = token.current as string;
    if (typeof window !== 'undefined' && hasPanelMark(window.history.state, t)) {
      window.history.back();
      if (timer.current !== null) window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => closed.current(), BACK_FALLBACK_MS);
    } else {
      closed.current();
    }
  }, []);
}
