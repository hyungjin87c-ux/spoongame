import { useRef, type RefObject } from 'react';
import { createSmallViewport, shouldReleaseBar } from './barRelease';
import { shouldReleaseHead } from './headRelease';
import { useIsoLayoutEffect } from './hooks';

/**
 * 대시보드 「나가기」 확인 단계의 화면 맞춤 (QA-003-M4 O03, SPEC-003 QM2-12 (5)와 같은 규칙).
 *
 * 문제: 글자 200% 모바일에서 확인 단계를 열면, 브라우저의 기본 포커스 스크롤이 「돌아가기」 버튼만 화면에 넣고 안내문 첫 줄(무엇을 묻는지)은 화면 위로 밀어냈다
 * (360×740 214px·320×568 343px·640×400 154px). 첫 화면의 확인 단계는 「열 때·크기가 바뀐 뒤」 안내문 첫 줄과 포커스를 받은 취소 버튼이 **함께** 화면 안에 오게 맞추고 포커스를 잃지 않는다 —
 * 대시보드도 같다.
 *
 * 규칙
 *  1. 맞출 대상은 안내문 첫 줄(`first`)부터 「돌아가기」 버튼 아래(포커스 링 포함)까지의 구간이다. 고정 요소(위의 sticky 헤더, 모바일의 하단 고정 진행 줄)에 가리지 않는 가장자리 안에 두고,
 *     여유가 있으면 위아래로 12px 숨 쉴 틈을 둔다. 이미 안에 있으면 스크롤하지 않는다. 그 구간이 가용 높이보다 커서 다 못 넣으면(고정 요소를 다 풀어도 화면이 구간보다 낮은 극단 —
 *     320×256 글자 200%) **포커스를 받은 「돌아가기」 버튼을 우선**한다: 포커스가 화면 안에 있어야 한다는 규칙(CM10, R-322)이 먼저라서 버튼이 가장자리 아래끝에 닿게 하고 안내문은 닿는 만큼만 보인다.
 *  2. 고정 요소가 있어서 그 구간이 못 들어가면(원래 규칙대로 고정될 헤더 + 진행 줄 + 구간 > 작은 뷰포트 높이) 두 고정 요소를 **함께 푼다**(`head-released`·`bar-released`) — 첫 화면에서 확인 단계가 커진 띠가
 *     절반을 넘으면 고정을 푸는 것과 같은 일이다(QM2-12 「고정 → 해제 전환 포함」). 구간 길이와 두 고정 요소의 높이는 고정·해제 상태와 상관없이 같은 값이라 판정이 흔들리지 않는다
 *     (풀려서 자리가 생겨도 다시 고정으로 돌아가지 않는다). 확인 단계를 닫으면 원래 규칙(절반 기준)으로 돌아간다. 자리가 되는데도 푸는 일은 없다 — 360×740 글자 200%는 진행 줄이 고정인 채 구간이 들어간다.
 *  3. 열 때, 그리고 열려 있는 동안 확인 단계·헤더·진행 줄의 크기가 바뀌거나(글자 크기) 창의 폭·작은 뷰포트 높이가 바뀌면(회전·창 크기) 다시 맞춘다. 주소창이 접히고 펴져서 `innerHeight`만
 *     바뀌는 `resize`는 무시한다(작은 뷰포트 높이는 그대로) — 사용자가 스크롤해 둔 위치를 되돌리지 않는다. 포커스는 옮기지 않는다(이미 「돌아가기」에 있다).
 *
 * 순수 함수(`askSpan`·`askNeedsRoom`·`askFitDelta`)는 tests/exitAsk.test.ts, 실제 화면은 e2e/m4-exit-ask.spec.ts가 잰다.
 */

/** 진행 줄이 화면 아래에 고정되는 폭 — `styles/dash.css`의 `@media (max-width: 959px)`와 같아야 한다(tests/exitAsk.test.ts가 대조한다). 넓은 화면에서는 진행 줄이 도구 줄 안의 보통 행이라 화면을 가리지 않는다. */
export const BAR_FIXED_MEDIA = '(max-width: 959px)';
/** 포커스 링이 버튼 밖으로 나오는 두께(outline-width + offset) — `focusReveal.ts`의 다른 맞춤 함수와 같은 값 */
export const ASK_RING_EXTRA = 7;
/** 구간 위아래에 두는 숨 쉴 틈(px) = `--sp-3` */
export const ASK_GAP = 12;

/** 안내문 첫 줄 위끝부터 포커스 버튼의 링 아래끝까지의 높이(px). 두 요소가 같이 움직이므로 스크롤 위치와 상관없는 값이다. */
export function askSpan(first: Element, focused: Element, ringExtra = ASK_RING_EXTRA): number {
  return focused.getBoundingClientRect().bottom + ringExtra - first.getBoundingClientRect().top;
}

/**
 * 원래 규칙(절반 기준)대로 고정되는 요소들을 모두 고정한 채로는 그 구간이 화면에 못 들어가는가: 구간 + (고정될) 헤더 + (하단에 고정될) 진행 줄 > 작은 뷰포트 높이.
 * 원래 규칙으로 이미 풀릴 요소는 자리를 차지하지 않으므로 셈에서 뺀다 — 진행 줄은 절반을 넘으면, 헤더는 (헤더 + 고정될 진행 줄)이 절반을 넘으면 원래도 풀린다(`shouldReleaseBar`·`shouldReleaseHead`).
 * 이 판정은 지금 풀려 있는지 고정인지와 상관없이 같은 값만 쓴다(풀려서 자리가 생겨도 다시 고정으로 돌아가지 않는다). `barFixedLayout`은 진행 줄이 하단에 고정되는 폭인가 — 넓은 화면에서는 보통 행이라 false.
 * 높이를 모르면(0·NaN) 풀지 않는다.
 */
export function askNeedsRoom(span: number, headHeight: number, barHeight: number, viewportHeight: number, barFixedLayout = true): boolean {
  if (![span, headHeight, barHeight, viewportHeight].every(Number.isFinite) || span <= 0 || viewportHeight <= 0) return false;
  const bar = barFixedLayout && !shouldReleaseBar(barHeight, viewportHeight) ? Math.max(0, barHeight) : 0;
  const head = shouldReleaseHead(headHeight, bar, viewportHeight) ? 0 : Math.max(0, headHeight);
  return span + head + bar > viewportHeight;
}

export interface AskFitInput {
  /** 안내문 첫 줄의 위끝(뷰포트 좌표) */
  firstTop: number;
  /** 포커스 버튼의 아래끝(뷰포트 좌표, 링 제외) */
  focusedBottom: number;
  /** 고정 요소에 가리지 않는 위·아래 가장자리(뷰포트 좌표): 위 = 고정 헤더의 아래끝(없으면 0), 아래 = 고정 진행 줄의 위끝(없으면 창 높이) */
  regionTop: number;
  regionBottom: number;
  gap?: number;
  ringExtra?: number;
}

/**
 * 구간을 가장자리 안에 두려면 문서를 얼마나 스크롤해야 하는가(양수 = 아래로, 음수 = 위로, 0 = 그대로). 여유가 있으면 숨 쉴 틈(최대 `gap`)을 두고, 틈을 낼 여유조차 없으면 틈 없이 맞춘다.
 * 구간이 가장자리 안에 다 못 들어가면(가용 높이 < 구간) 버튼의 링 아래끝을 가장자리 아래에 맞춘다 — 포커스 버튼이 우선이고(CM10) 그 위로 안내문이 닿는 만큼 보인다.
 */
export function askFitDelta({ firstTop, focusedBottom, regionTop, regionBottom, gap = ASK_GAP, ringExtra = ASK_RING_EXTRA }: AskFitInput): number {
  if (![firstTop, focusedBottom, regionTop, regionBottom].every(Number.isFinite)) return 0;
  const pairBottom = focusedBottom + ringExtra;
  const span = pairBottom - firstTop;
  const room = regionBottom - regionTop;
  let delta: number;
  if (room >= span) {
    // 구간이 다 들어간다: 숨 쉴 틈(여유가 틈 두 개보다 작으면 줄인다)을 두고 안에 넣는다
    const margin = Math.min(gap, (room - span) / 2);
    const lo = regionTop + margin;
    const hi = regionBottom - margin;
    delta = 0;
    if (pairBottom > hi) delta = pairBottom - hi; // 아래로 내려 버튼을 보인다
    if (firstTop - delta < lo) delta = firstTop - lo; // 안내문 첫 줄이 가려지면 거기까지 올린다(구간이 들어가므로 버튼도 함께 안에 든다)
  } else {
    // 다 못 들어간다: 포커스 버튼이 우선 — 링 아래끝을 가장자리 아래에 맞춘다(버튼이 이미 보여도 안내문이 조금이라도 더 보이게 맞춘다)
    delta = pairBottom - regionBottom;
  }
  return Math.abs(delta) < 0.5 ? 0 : delta;
}

const isFixedLike = (el: Element | null): el is Element => el !== null && ['fixed', 'sticky'].includes(getComputedStyle(el).position);

/** 고정 요소가 가리는 위·아래 가장자리: 위 = 고정(sticky) 헤더의 아래끝, 아래 = 고정된 진행 줄의 위끝. 풀린(static) 요소는 가리지 않는다. */
export function fixedInsets(head: Element | null, bar: Element | null, viewportHeight: number = window.innerHeight): { top: number; bottom: number } {
  return {
    top: isFixedLike(head) ? Math.max(0, head.getBoundingClientRect().bottom) : 0,
    bottom: isFixedLike(bar) ? Math.min(viewportHeight, bar.getBoundingClientRect().top) : viewportHeight,
  };
}

/** 안내문 첫 줄과 포커스 버튼이 함께 보이게 문서를 스크롤한다(필요할 때만). 포커스는 건드리지 않는다. */
export function fitAskInView(first: Element | null, focused: Element | null, head: Element | null, bar: Element | null): void {
  if (typeof window === 'undefined' || first === null || focused === null) return;
  const { top, bottom } = fixedInsets(head, bar);
  const delta = askFitDelta({ firstTop: first.getBoundingClientRect().top, focusedBottom: focused.getBoundingClientRect().bottom, regionTop: top, regionBottom: bottom });
  if (delta !== 0) window.scrollBy(0, delta);
}

interface Refreshable {
  refresh(): void;
}

export interface ExitAskRefs {
  /** 안내문 첫 줄(제목 문단) */
  titleRef: RefObject<HTMLElement>;
  /** 포커스를 받는 「돌아가기」 버튼 */
  cancelRef: RefObject<HTMLElement>;
  /** 확인 단계 상자(크기 변화 관찰) */
  boxRef: RefObject<HTMLElement>;
  headRef: RefObject<HTMLElement>;
  barRef: RefObject<HTMLElement>;
}

/** 두 감시자(`useBottomBar`·`useStickyHead`)에 넘기는 「고정을 풀어야 하는가」 판정 함수를 담는 ref — 감시자보다 먼저 만들고, `useExitAskFit`이 늘 최신 판정으로 채운다 */
export function useForceReleaseRef(): { current: (viewportHeight: number) => boolean } {
  return useRef<(viewportHeight: number) => boolean>(() => false);
}

/**
 * 나가기 확인 단계의 화면 맞춤을 건다. `forceRelease`는 `useForceReleaseRef()`로 먼저 만들어 `useBottomBar`·`useStickyHead`에 넘긴 그 ref이고, `refreshers`는 그 둘이 돌려준 `refresh`다(이 훅은 둘 뒤에 부른다).
 * 확인 단계가 열리면(첫 그림 전, layout effect) 고정 요소를 풀어야 하는지 다시 재고 구간을 화면 안에 맞춘다. 열려 있는 동안은 위 3번 규칙대로 다시 맞춘다. 닫히면 원래 규칙으로 되돌린다.
 */
export function useExitAskFit(forceRelease: { current: (viewportHeight: number) => boolean }, open: boolean, refs: ExitAskRefs, refreshers: readonly Refreshable[]): void {
  const latest = useRef({ open, refs, refreshers });
  latest.current = { open, refs, refreshers };

  // 판정 함수는 늘 최신 상태를 본다(렌더마다 갈아 끼운다). 두 감시자가 재측정할 때마다 이 함수를 부른다.
  forceRelease.current = (viewportHeight) => {
    const { open: isOpen, refs: r } = latest.current;
    const title = r.titleRef.current;
    const cancel = r.cancelRef.current;
    const head = r.headRef.current;
    const bar = r.barRef.current;
    if (!isOpen || title === null || cancel === null || head === null || bar === null) return false;
    const barFixedByDefault = typeof window.matchMedia === 'function' && window.matchMedia(BAR_FIXED_MEDIA).matches;
    return askNeedsRoom(askSpan(title, cancel), head.offsetHeight, bar.offsetHeight, viewportHeight, barFixedByDefault);
  };

  useIsoLayoutEffect(() => {
    const refresh = () => latest.current.refreshers.forEach((r) => r.refresh());
    refresh(); // 열렸거나 닫혔다: 고정 요소를 풀어야 하는지 다시 잰다(첫 그림 전)
    if (!open) return;
    const { titleRef, cancelRef, headRef, barRef, boxRef } = latest.current.refs;
    const fit = () => fitAskInView(titleRef.current, cancelRef.current, headRef.current, barRef.current);
    let raf = 0;
    const settle = () => {
      refresh();
      fit();
    };
    const settleLater = () => {
      settle();
      // 고정 해제 클래스가 바뀐 뒤에 생기는 레이아웃 변화(헤더가 진행 줄 해제를 따라 풀리는 경우 등)까지 반영한다
      if (typeof requestAnimationFrame === 'function') {
        cancelAnimationFrame(raf);
        raf = requestAnimationFrame(settle);
      }
    };
    settleLater();

    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(settleLater);
    for (const ref of [boxRef, headRef, barRef]) if (ref.current !== null) observer?.observe(ref.current);
    const viewport = createSmallViewport();
    let lastWidth = window.innerWidth;
    let lastView = viewport.height();
    const onResize = () => {
      const width = window.innerWidth;
      const view = viewport.height();
      if (width === lastWidth && view === lastView) return; // 주소창 접힘 등 innerHeight만의 변화: 맞춤을 다시 하지 않는다
      lastWidth = width;
      lastView = view;
      settleLater();
    };
    window.addEventListener('resize', onResize);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', onResize);
      viewport.dispose();
      if (typeof cancelAnimationFrame === 'function') cancelAnimationFrame(raf);
    };
  }, [open]);
}
