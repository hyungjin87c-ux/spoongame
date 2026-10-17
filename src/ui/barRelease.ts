/**
 * 낮은 화면에서 하단 띠 — 절반을 넘으면 고정을 푼다 (SPEC-003 QM2-12, QM2-3·CM10·CM11·FS6, REV-003-M2-3 R-233, REV-003-M2-4 R-240).
 *
 * 하단에 고정된 띠가 화면(뷰포트) 높이의 절반을 넘으면(400% 확대 상당 320×256에서 확인 단계 띠가 59%, 가로 모드 667×375에 글자 200%를 겹치면 더 높다) 본문이 띠 뒤로 거의 가려져
 * 읽을 수 없다. 그때는 띠의 고정을 풀어 문서 흐름의 본문 끝(푸터 다음)에 둔다 — 낮은 화면에서 주 버튼이 스크롤 아래로 가는 것은 마스터가 받아들인 대가다.
 *
 * 기준은 **측정**이다: 띠의 실제 높이(상태 3종·글자 크기에 따라 68~254px)를 뷰포트 높이와 견준다. 높이 미디어 쿼리는 쓰지 않는다 —
 * `rem` 미디어 쿼리는 `html { font-size }`로 재현하는 글자 확대에 반응하지 않고, 띠 높이는 상태마다 달라 높이값 하나로 맞출 수 없다.
 * 해제 상태는 `<html class="bar-released">`로 알리고(styles/title.css가 고정·스크롤 여백·`--bar-h`에 묶인 계산을 함께 푼다), 포커스를 가진 요소는 클래스만 바뀌므로 포커스를 잃지 않는다.
 *
 * **견주는 뷰포트 높이는 `window.innerHeight`가 아니라 작은 뷰포트 높이(`100svh`)다** (R-240). 모바일 브라우저는 스크롤하면 주소창이 접히고 펴지며 `innerHeight`가 바뀐다 —
 * 그 값으로 판정하면 경계에 가까운 조합(예: 가로 360dp 안드로이드의 확인 단계 띠 150px)에서 스크롤 도중 해제 ↔ 고정이 뒤집혀 본문 끝 여백이 생겼다 사라지며 문서 길이·스크롤 위치가 튄다.
 * 작은 뷰포트 높이는 정의상 주소창이 **펴진** 가장 작은 크기라 스크롤로 변하지 않는다. 그래서 히스테리시스(문턱을 둘로 나누는 것)는 필요 없고 명세의 「절반을 넘으면」 문구 그대로 쓴다.
 * 첫 화면 외에 M3(룰렛·출생신고)·M4(대시보드)의 하단 띠도 같은 함수(`watchBarRelease`)를 쓴다.
 */

/** 띠가 뷰포트 높이의 이 비율을 넘으면(> 0.5) 고정을 푼다 */
export const BAR_RELEASE_RATIO = 0.5;

/** 띠 높이(px)와 뷰포트 높이(px)로 고정을 풀어야 하는가. 높이를 모르면(0·NaN) 풀지 않는다. */
export function shouldReleaseBar(barHeight: number, viewportHeight: number): boolean {
  if (!Number.isFinite(barHeight) || !Number.isFinite(viewportHeight) || barHeight <= 0 || viewportHeight <= 0) return false;
  return barHeight > viewportHeight * BAR_RELEASE_RATIO;
}

/** 주소창(도구 모음)이 접히고 펴져도 변하지 않는 뷰포트 높이를 재는 도구 */
export interface SmallViewport {
  /** 작은 뷰포트 높이(px). 재지 못하면(0 이하 또는 유한하지 않음) 0 */
  height(): number;
  /** 탐침 요소를 지운다 */
  dispose(): void;
}

/**
 * 작은 뷰포트 높이 측정 도구. **`100svh` 탐침 요소**의 높이를 읽는다 — CSS 명세가 보장하는 값(동적 도구 모음이 모두 펴진 가장 작은 뷰포트)이라 주소창 접힘에 흔들리지 않는다
 * (Chrome 108+·Safari 15.4+·Firefox 101+). 데스크톱에서는 `innerHeight`와 같은 값이다(둘 다 가로 스크롤바를 포함한다).
 * `svh`를 모르는 브라우저는 `document.documentElement.clientHeight`(레이아웃 뷰포트 높이)로, 그것도 0이면 `innerHeight`로 물러난다.
 * 탐침은 보이지 않고(`visibility: hidden`) 폭 0이며 `position: fixed`라 문서 길이·스크롤·포커스에 영향이 없다.
 */
export function createSmallViewport(doc: Document = document, win: Window = window): SmallViewport {
  const css = (win as Window & typeof globalThis).CSS;
  const supportsSvh = typeof css !== 'undefined' && typeof css.supports === 'function' && css.supports('height', '100svh');
  let probe: HTMLElement | null = null;
  if (supportsSvh && doc.body) {
    probe = doc.createElement('div');
    probe.setAttribute('aria-hidden', 'true');
    probe.setAttribute('data-viewport-probe', 'svh');
    probe.style.cssText = 'position:fixed;top:0;left:0;width:0;height:100svh;visibility:hidden;pointer-events:none;';
    doc.body.appendChild(probe);
  }
  const positive = (n: number): number => (Number.isFinite(n) && n > 0 ? n : 0);
  return {
    height() {
      const fromProbe = probe === null ? 0 : positive(probe.getBoundingClientRect().height);
      if (fromProbe > 0) return fromProbe;
      const client = positive(doc.documentElement.clientHeight);
      return client > 0 ? client : positive(win.innerHeight);
    },
    dispose() {
      probe?.remove();
      probe = null;
    },
  };
}

export interface BarReleaseOptions {
  /** `bar-released` 클래스와 `--bar-h` 변수를 거는 요소(기본 `<html>`) */
  root?: HTMLElement;
  /** 고정 → 해제로 바뀌었다(첫 측정은 제외). 포커스가 띠 안에 있으면 화면 안으로 맞출 때 쓴다. */
  onRelease?: () => void;
  /** 이미 풀려 있는데 띠 높이나 작은 뷰포트 높이가 달라졌다(글자 확대·창 높이 축소, QA-003-M2 M2-B07) — 주소창 접힘으로는 불리지 않는다(작은 뷰포트 높이가 그대로라서) */
  onReleasedResize?: () => void;
  /**
   * 절반 규칙과 별개로 고정을 풀어야 하는 사정이 있는가 (작은 뷰포트 높이를 받는다; 매번 재측정할 때 불린다). 대시보드 「나가기」 확인 단계가 열려 있을 때,
   * 안내문 첫 줄부터 「돌아가기」까지와 고정 요소(헤더·진행 줄)가 한 화면에 함께 못 들어가면 true — `ui/exitAsk.ts`가 판정한다(QA-003-M4 O03).
   * 절반 규칙이 이미 풀면 이 값과 상관없이 풀린다(둘 중 하나라도 true면 해제). 값이 바뀔 사정이 생기면 호출자가 `refresh()`를 부른다.
   */
  forceRelease?: (viewportHeight: number) => boolean;
}

export interface BarReleaseWatch {
  /** 지금 풀려 있는가 (아직 재지 않았으면 false) */
  isReleased(): boolean;
  /** 지금 바로 다시 잰다 — `forceRelease`의 사정이 바뀐 때(확인 단계 열기·닫기·크기 변화) 호출자가 부른다. 재는 일은 같은 함수라 값이 그대로면 아무 일도 없다 */
  refresh(): void;
  /** 리스너·관찰자·탐침을 걷고 `bar-released` 클래스와 `--bar-h`를 지운다 */
  dispose(): void;
}

/**
 * 하단 띠의 높이를 CSS 변수 `--bar-h`로 알리고, 띠가 작은 뷰포트 높이의 절반을 넘으면 `bar-released` 클래스를 건다. 띠 크기가 바뀔 때(ResizeObserver: 상태 3종·글자 크기)와
 * 창 크기·회전이 바뀔 때(resize)마다 다시 잰다. 클래스만 바꾸므로 포커스를 가진 요소는 포커스를 잃지 않는다. 지금 바로 한 번 잰다.
 */
export function watchBarRelease(bar: HTMLElement, options: BarReleaseOptions = {}): BarReleaseWatch {
  const root = options.root ?? document.documentElement;
  const viewport = createSmallViewport();
  let released: boolean | null = null;
  let lastBar = Number.NaN;
  let lastView = Number.NaN;
  const apply = () => {
    const height = bar.offsetHeight;
    const view = viewport.height();
    root.style.setProperty('--bar-h', `${height}px`);
    const next = shouldReleaseBar(height, view) || (options.forceRelease?.(view) ?? false);
    const sizeChanged = height !== lastBar || view !== lastView;
    lastBar = height;
    lastView = view;
    if (next === released) {
      if (next && sizeChanged) options.onReleasedResize?.();
      return;
    }
    const wasKnown = released !== null;
    released = next;
    root.classList.toggle('bar-released', next);
    if (next && wasKnown) options.onRelease?.();
  };
  apply();
  const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(apply);
  observer?.observe(bar);
  window.addEventListener('resize', apply);
  return {
    isReleased: () => released === true,
    refresh: apply,
    dispose() {
      observer?.disconnect();
      window.removeEventListener('resize', apply);
      viewport.dispose();
      root.classList.remove('bar-released');
      root.style.removeProperty('--bar-h');
    },
  };
}
