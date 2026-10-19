import { useIsoLayoutEffect } from './hooks';

/**
 * 모달 시트가 떠 있는 동안 문서 스크롤 잠금 (SPEC-003 M7c T1 — REV-003-M7b-3 R-400, QA-003-M7b A20b; docs/design/design-system.md 11-10 「문서 스크롤 잠금」).
 *
 * `.overlay`·`.sheet`의 `overscroll-behavior: contain`은 시트 **안**에서 끝까지 쓴 뒤의 연쇄만 끊는다 — 스크림(시트 위쪽 바탕)에서 시작한 드래그, 짧은 시트(넘침 없음)의 휠·PageDown·Space는
 * 그대로 뒤 문서를 움직인다. 그래서 잠금은 CSS 한 줄이 아니라 **열린 시트 수를 세는 훅**이다: 첫 시트가 열릴 때 `<html class="sheet-open">`을 걸고(`html.sheet-open { overflow: hidden; padding-right: var(--scrollbar-w) }`)
 * 마지막 시트가 닫힐 때 푼다. 결정 시트 → 기록 시트로 이어질 때처럼 한 커밋 안에서 닫히고 열려도 개수가 0이 되었다 곧바로 1이 될 뿐 같은 작업(task) 안이라 그 사이에 그림이 그려지지 않고 `scrollY`가 튀지 않는다.
 * 데스크톱의 고전 스크롤바가 사라지며 본문이 옆으로 밀리지 않도록, 잠그기 **전에 잰** `innerWidth − documentElement.clientWidth`를 `--scrollbar-w`로 건다(겹쳐 그리는 스크롤바는 0).
 * `scrollbar-gutter: stable`은 쓰지 않는다(헤드리스 크로뮴이 겹쳐 그리는 스크롤바인데도 15px을 비워 폭 320 · 글자 200%의 상태 바가 넘쳤다). 시트 안 스크롤은 막지 않는다.
 */

/** 훅이 건드리는 문서의 부분 — 시험이 가짜를 넣을 수 있게 좁게 잡았다 */
export interface ScrollLockRoot {
  clientWidth: number;
  classList: { add(name: string): void; remove(name: string): void };
  style: { setProperty(name: string, value: string): void; removeProperty(name: string): void };
}

export const SCROLL_LOCK_CLASS = 'sheet-open';
export const SCROLL_LOCK_VAR = '--scrollbar-w';

export interface ScrollLock {
  /** 시트가 열렸다. 돌려받은 함수를 부르면 닫힌다(두 번 불러도 한 번만 센다) */
  acquire(): () => void;
  /** 지금 열린 시트 수 */
  readonly count: number;
}

export function createScrollLock(root: () => ScrollLockRoot | null, innerWidth: () => number): ScrollLock {
  let count = 0;
  return {
    acquire() {
      const el = root();
      if (el !== null && count === 0) {
        const bar = Math.max(0, innerWidth() - el.clientWidth); // 잠그기 전에 잰다
        el.style.setProperty(SCROLL_LOCK_VAR, `${bar}px`);
        el.classList.add(SCROLL_LOCK_CLASS);
      }
      count++;
      let released = false;
      return () => {
        if (released) return;
        released = true;
        count--;
        const now = root();
        if (now !== null && count === 0) {
          now.classList.remove(SCROLL_LOCK_CLASS);
          now.style.removeProperty(SCROLL_LOCK_VAR);
        }
      };
    },
    get count() {
      return count;
    },
  };
}

/** 이 앱의 문서 잠금 (모든 시트가 하나를 같이 센다) */
export const documentScrollLock: ScrollLock = createScrollLock(
  () => (typeof document === 'undefined' ? null : document.documentElement),
  () => (typeof window === 'undefined' ? 0 : window.innerWidth),
);

/**
 * 시트 컴포넌트가 마운트되어 있는 동안(또는 `active`인 동안) 문서 스크롤을 잠근다.
 * **레이아웃 효과**다(M7c r2 관찰 5): 시트가 처음 그려지는 프레임에 이미 잠겨 있어야 한다 — 일반 효과(passive)면 타이머로 저절로 뜬 카드처럼 이산 입력이 아닌 갱신에서는 시트가 그려진 뒤 한 프레임 늦게 잠겨
 * 그 사이의 휠·터치가 문서를 움직이고, 잠그는 순간 스크롤바 폭이 바뀌어 본문이 밀릴 수 있다. 서버 렌더(vitest)에서는 일반 효과와 같다(`useIsoLayoutEffect`).
 */
export function useScrollLock(active = true): void {
  useIsoLayoutEffect(() => {
    if (!active) return;
    return documentScrollLock.acquire();
  }, [active]);
}
