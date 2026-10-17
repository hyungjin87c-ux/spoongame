import { useMemo, useRef, type RefObject } from 'react';
import { BAR_RELEASE_RATIO, createSmallViewport } from './barRelease';
import { useIsoLayoutEffect } from './hooks';

/**
 * 대시보드 고정 헤더의 높이 변수와 고정 해제 (SPEC-003 CM10·CM11, design-system.md 11-1 「고정 헤더의 해제」, M4 착수 메모 3).
 *
 * 헤더(`.dash-head`)는 위에 붙는 sticky **고정 요소**다. 하단 띠(`ui/barRelease.ts`)와 같은 패턴을 따른다:
 *  1) 실제 높이를 `<html>`의 CSS 변수 `--head-h`로 알리고 `<html class="has-sticky-head">`를 걸어 스크롤 여백(`scroll-padding-top`)이 헤더 높이를 따르게 한다 →
 *     키보드 Tab·프로그램 focus()가 요소를 화면 안으로 스크롤할 때 헤더 밑에 머문다(CM10).
 *  2) **헤더 높이 + (진행 줄이 화면 아래에 고정돼 있으면 그 높이)가 작은 뷰포트 높이(100svh)의 절반을 넘으면** `<html class="head-released">` — 헤더는 `position: static`이 되어 본문과 함께 스크롤된다.
 *     가로 폰 667×375(헤더 약 100px + 진행 줄 약 120px = 59%)·400% 확대 상당 320×256처럼 고정 요소 둘이 화면 대부분을 덮어 본문·포커스가 설 자리가 없어지는 것을 막는다.
 *     진행 줄 자체의 해제(진행 줄 높이 > 50%)는 `watchBarRelease`가 그대로 맡고, 그때는 진행 줄이 고정이 아니므로 이 계산에서 빠진다(둘이 서로를 부른다 → `<html>`의 class 변화를 지켜본다).
 * 판정은 `innerHeight`가 아니라 **작은 뷰포트 높이(`100svh`)**로 한다(주소창이 접히고 펴져도 변하지 않아 스크롤 도중 고정 ↔ 해제가 뒤집히지 않는다 — R-240). 클래스만 바꾸므로 포커스는 그대로다.
 */

/** 헤더 높이와 화면 아래에 고정된 진행 줄 높이(없으면 0)가 작은 뷰포트 높이의 절반을 넘는가. 높이를 모르면(0·NaN) 풀지 않는다. */
export function shouldReleaseHead(headHeight: number, fixedBarHeight: number, viewportHeight: number): boolean {
  if (!Number.isFinite(headHeight) || !Number.isFinite(fixedBarHeight) || !Number.isFinite(viewportHeight) || headHeight <= 0 || viewportHeight <= 0) return false;
  return headHeight + Math.max(0, fixedBarHeight) > viewportHeight * BAR_RELEASE_RATIO;
}

export interface HeadReleaseWatch {
  isReleased(): boolean;
  /** 지금 바로 다시 잰다 — `forceRelease`의 사정이 바뀐 때(확인 단계 열기·닫기·크기 변화) 호출자가 부른다 */
  refresh(): void;
  /** 리스너·관찰자를 걷고 클래스·변수를 지운다 */
  dispose(): void;
}

export interface HeadReleaseOptions {
  /** 절반 규칙과 별개로 헤더 고정을 풀어야 하는 사정인가(작은 뷰포트 높이를 받는다) — 나가기 확인 단계가 고정 요소와 함께 화면에 못 들어갈 때 true(`ui/exitAsk.ts`, QA-003-M4 O03). 둘 중 하나라도 true면 풀린다. */
  forceRelease?: (viewportHeight: number) => boolean;
}

/**
 * 헤더의 높이를 `--head-h`로 알리고 `head-released`를 건다. `controls`는 화면 아래에 고정될 수 있는 진행 줄(없으면 null) — 계산된 position이 fixed·sticky일 때만 높이를 더한다.
 */
export function watchHeadRelease(head: HTMLElement, controls: HTMLElement | null, root: HTMLElement = document.documentElement, options: HeadReleaseOptions = {}): HeadReleaseWatch {
  const viewport = createSmallViewport();
  let released = false;
  const apply = () => {
    const headHeight = head.offsetHeight;
    const barFixed = controls !== null && ['fixed', 'sticky'].includes(getComputedStyle(controls).position);
    const barHeight = controls !== null && barFixed ? controls.offsetHeight : 0;
    root.style.setProperty('--head-h', `${headHeight}px`);
    const view = viewport.height();
    const next = shouldReleaseHead(headHeight, barHeight, view) || (options.forceRelease?.(view) ?? false);
    if (next !== released) {
      released = next;
      root.classList.toggle('head-released', next);
    }
  };
  root.classList.add('has-sticky-head');
  apply();
  const resize = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(apply);
  resize?.observe(head);
  if (controls !== null) resize?.observe(controls);
  window.addEventListener('resize', apply);
  // 진행 줄이 풀리거나 다시 고정될 때(bar-released 클래스) 헤더 계산이 달라진다
  const classes = typeof MutationObserver === 'undefined' ? null : new MutationObserver(apply);
  classes?.observe(root, { attributes: true, attributeFilter: ['class'] });
  return {
    isReleased: () => released,
    refresh: apply,
    dispose() {
      resize?.disconnect();
      classes?.disconnect();
      window.removeEventListener('resize', apply);
      viewport.dispose();
      root.classList.remove('has-sticky-head', 'head-released');
      root.style.removeProperty('--head-h');
    },
  };
}

/**
 * 대시보드가 떠 있는 동안 헤더 높이 변수·클래스를 건다 (사라지면 지운다). `forceRelease`는 호출자가 늘 최신 판정 함수를 담아 두는 ref다(나가기 확인 단계, `ui/exitAsk.ts`).
 * 돌려주는 `refresh`는 그 사정이 바뀐 때(확인 단계 열기·닫기) 바로 다시 재게 한다 — 안정된 함수라 효과의 의존 목록에 넣어도 효과가 다시 돌지 않는다.
 */
export function useStickyHead(headRef: RefObject<HTMLElement>, controlsRef: RefObject<HTMLElement>, forceRelease?: RefObject<(viewportHeight: number) => boolean>): { refresh(): void } {
  const watchRef = useRef<HeadReleaseWatch | null>(null);
  useIsoLayoutEffect(() => {
    const head = headRef.current;
    if (head === null) return;
    const watch = watchHeadRelease(head, controlsRef.current, document.documentElement, { forceRelease: (vh) => forceRelease?.current?.(vh) ?? false });
    watchRef.current = watch;
    return () => {
      watchRef.current = null;
      watch.dispose();
    };
  }, [headRef, controlsRef, forceRelease]);
  return useMemo(() => ({ refresh: () => watchRef.current?.refresh() }), []);
}
