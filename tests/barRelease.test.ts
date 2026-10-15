import { afterEach, describe, expect, it, vi } from 'vitest';
import { BAR_RELEASE_RATIO, createSmallViewport, shouldReleaseBar, watchBarRelease } from '../src/ui/barRelease';
import barReleaseSrc from '../src/ui/barRelease.ts?raw';
import titleScreenSrc from '../src/screens/TitleScreen.tsx?raw';

/**
 * 낮은 화면에서 하단 띠 — 절반을 넘으면 고정을 푼다 (SPEC-003 QM2-12). 판정은 순수 함수(ui/barRelease.ts), 실제 띠 높이·고정 해제·전환은 e2e/text-resize.spec.ts(66조합·전환)가 잰다.
 * 여기서는 (1) 문턱이 정확히 「절반을 넘으면(> 0.5)」인지 (2) 첫 화면이 그 판정을 띠 높이 측정과 창 크기 변화에 걸었는지 (3) CSS가 해제 때 함께 풀 것(고정·스크롤 여백·본문 끝 여백·오른쪽 열 max-height)을 모두 풀었는지 본다.
 */

/** vitest는 CSS의 ?raw 가져오기를 빈 문자열로 돌려주므로 CSS는 파일 시스템으로 읽는다(tests/carousel.test.ts와 같은 방법) */
async function readText(relative: string): Promise<string> {
  const spec = 'node:fs';
  const fs = (await import(/* @vite-ignore */ spec)) as { readFileSync(path: URL, encoding: 'utf-8'): string };
  return fs.readFileSync(new URL(relative, import.meta.url), 'utf-8');
}
const css = await readText('../src/styles/title.css');

describe('shouldReleaseBar: 띠 높이가 뷰포트 높이의 절반을 넘으면(> 0.5) 고정을 푼다', () => {
  it('문턱은 50%다: 정확히 절반은 고정, 1px라도 넘으면 해제', () => {
    expect(BAR_RELEASE_RATIO).toBe(0.5);
    expect(shouldReleaseBar(128, 256), '정확히 50%').toBe(false);
    expect(shouldReleaseBar(129, 256)).toBe(true);
    expect(shouldReleaseBar(127, 256)).toBe(false);
  });

  it('QA 기록 4와 마스터 결정의 실제 조합: 320×256 확인 단계(150px = 59%)는 풀리고, 새 판(68px)·이어하기(120px = 47%)는 고정이다', () => {
    expect(shouldReleaseBar(150, 256)).toBe(true);
    expect(shouldReleaseBar(120, 256)).toBe(false);
    expect(shouldReleaseBar(68, 256)).toBe(false);
    // 글자 200%에서 확인 단계 띠는 254px — 가로 모드 667×375(68%)·640×400(64%)에서도 풀리고, 세로 폰 568·740에서는 고정이다
    expect(shouldReleaseBar(254, 375)).toBe(true);
    expect(shouldReleaseBar(254, 400)).toBe(true);
    expect(shouldReleaseBar(254, 568)).toBe(false);
    expect(shouldReleaseBar(254, 740)).toBe(false);
  });

  it('높이를 모르면(0·NaN·음수) 풀지 않는다 — 측정 실패가 고정 띠를 풀어 버리지 않는다', () => {
    for (const [bar, view] of [
      [0, 256],
      [150, 0],
      [Number.NaN, 256],
      [150, Number.NaN],
      [-5, 256],
      [Number.POSITIVE_INFINITY, 256],
    ] as const) {
      expect(shouldReleaseBar(bar, view), `${bar}/${view}`).toBe(false);
    }
  });
});

/** 주석을 뺀 코드만 (주석에 낡은 낱말이 남아 있어도 코드를 보게) */
const codeOf = (src: string): string => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\s)\/\/.*$/gm, '$1');

describe('첫 화면이 판정을 측정에 건다 (높이 미디어 쿼리가 아니다)', () => {
  it('띠의 실제 높이(offsetHeight)를 작은 뷰포트 높이와 견주고, 띠 크기 변화(ResizeObserver)와 창 크기·회전(resize)마다 다시 재며, html에 bar-released를 건다 — 측정은 공용 watchBarRelease가 한다 (M3·M4 재사용)', () => {
    // 첫 화면은 공용 감시자를 쓴다: 측정 코드가 화면 파일에 따로 없다
    expect(titleScreenSrc).toContain('watchBarRelease(bar,');
    expect(titleScreenSrc).not.toContain('shouldReleaseBar(');
    expect(titleScreenSrc).not.toContain('new ResizeObserver');
    // 공용 감시자(ui/barRelease.ts)가 같은 측정을 한다 (이전에 TitleScreen 안에서 단언하던 것 그대로)
    expect(barReleaseSrc).toContain('bar.offsetHeight');
    expect(barReleaseSrc).toContain('new ResizeObserver(apply)');
    expect(barReleaseSrc).toContain("window.addEventListener('resize', apply)");
    expect(barReleaseSrc).toContain("root.classList.toggle('bar-released', next)");
    expect(barReleaseSrc).toContain("root.style.setProperty('--bar-h'");
    // 화면을 떠나면 클래스·변수를 모두 지운다 (has-bottom-bar는 첫 화면이 건 것이라 첫 화면이 지운다)
    expect(barReleaseSrc).toContain("root.classList.remove('bar-released')");
    expect(barReleaseSrc).toContain("root.style.removeProperty('--bar-h')");
    expect(titleScreenSrc).toContain("root.classList.remove('has-bottom-bar')");
    // 해제 시 포커스를 잃지 않는다: 클래스만 바꾸고 DOM을 옮기거나 다시 만들지 않는다 — 풀리는 순간 포커스가 띠 안이면 화면 안으로만 스크롤한다
    expect(titleScreenSrc).toContain('revealWithinReleasedBar(askRef.current, active)');
  });

  it('판정 높이는 window.innerHeight가 아니라 작은 뷰포트 높이다 — 주소창이 접히고 펴져도 변하지 않는다 (R-240)', () => {
    const lib = codeOf(barReleaseSrc);
    const screen = codeOf(titleScreenSrc);
    expect(lib).toContain('shouldReleaseBar(height, view)');
    expect(lib).toContain('viewport.height()');
    expect(lib, '판정 줄에 innerHeight가 없다').not.toMatch(/shouldReleaseBar\([^)]*innerHeight/);
    expect(screen, '첫 화면 코드에 innerHeight가 없다(판정은 공용 감시자가 한다)').not.toContain('innerHeight');
    // innerHeight는 svh를 모르는 브라우저를 위한 마지막 물러남 한 곳에만 있다
    expect([...lib.matchAll(/innerHeight/g)]).toHaveLength(1);
    expect(lib).toContain("'100svh'");
    expect(lib).toContain('documentElement.clientHeight');
  });

  it('CSS에 높이 미디어 쿼리로 띠를 푸는 규칙이 없다 — rem 미디어 쿼리는 html font-size 확대에 반응하지 않고 띠 높이는 상태마다 달라 값 하나로 못 맞춘다', () => {
    expect(css).not.toMatch(/@media\s*\([^)]*max-height[^)]*\)[^{]*\{[^}]*bottom-bar/);
  });
});

describe('해제 상태에서 함께 풀 것 (QM2-12 규칙 3)', () => {
  it('고정을 푼다: html.bar-released .bottom-bar는 position: static이다', () => {
    expect(css).toMatch(/html\.bar-released \.bottom-bar \{[^}]*position: static/);
  });

  it('스크롤 여백이 기본 간격(--sp-3)으로 돌아온다 — 더는 가릴 띠가 없다', () => {
    expect(css).toMatch(/html\.bar-released\.has-bottom-bar \{ scroll-padding-bottom: var\(--sp-3\); \}/);
    // 고정일 때의 규칙(띠 높이 + 간격)은 그대로다
    expect(css).toContain('html.has-bottom-bar { scroll-padding-top: var(--sp-3); scroll-padding-bottom: calc(var(--bar-h, 164px) + var(--sp-3)); }');
  });

  it('본문 끝 여백(page-end-space)이 사라진다 — 풀린 띠 아래에 띠 높이만큼 빈 칸이 남지 않는다', () => {
    expect(css).toMatch(/html\.bar-released \.page-end-space \{ display: none; \}/);
  });

  it('폭 ≥ 960의 오른쪽 따라다니는 카드 max-height가 --bar-h를 빼지 않는다 (고정일 때는 뺀다)', () => {
    const wide = css.slice(css.indexOf('@media (min-width: 960px)'));
    expect(wide).toMatch(/\.title__side \{[^}]*max-height: calc\(100vh - var\(--bar-h, 164px\) - var\(--sp-6\) - 3px\)/);
    expect(wide).toMatch(/html\.bar-released \.title__side \{ max-height: calc\(100vh - var\(--sp-6\) - 3px\); \}/);
  });

  it('풀린 띠는 높이가 달라지지 않는다 — 테두리가 아니라 그림자로 위끝 선을 그어 --bar-h가 해제 때문에 어긋나지 않는다', () => {
    const rule = /html\.bar-released \.bottom-bar \{([^}]*)\}/.exec(css)![1];
    expect(rule).toContain('box-shadow: 0 -1px 0');
    expect(rule, '테두리 속성(border·border-top) 없음').not.toMatch(/(^|[\s;])border(-[a-z]+)*\s*:/);
    expect(rule).not.toMatch(/padding|margin|height/);
  });
});

describe('링크 안의 줄바꿈 묶음이 링크의 밑줄을 상속한다 (R-236)', () => {
  it('.title-page a .keep-phrase { text-decoration: inherit } — inline-block에는 링크의 밑줄이 전파되지 않는다', () => {
    expect(css).toMatch(/\.title-page a \.keep-phrase \{ text-decoration: inherit; \}/);
    // 푸터 링크 색은 글자색 그대로(inherit)라 밑줄이 유일한 링크 표시다
    expect(css).toMatch(/\.title-foot a \{ color: inherit; text-decoration: underline;/);
  });
});

describe('강제 색상(고대비)에서 띠 구분선 (QA-003-M2 3회차 기록 5)', () => {
  const forced = css.slice(css.indexOf('@media (forced-colors: active)'));

  it('강제 색상은 box-shadow를 지우므로 하단 띠가 CanvasText 1px 실선 위끝 테두리를 갖는다 — 고정·해제를 가리지 않는 .bottom-bar 한 규칙이다', () => {
    expect(forced).toMatch(/\.bottom-bar \{ border-top: 1px solid CanvasText; \}/);
    // 같은 규칙이 고정·해제 모두에 걸리므로(해제 전용 규칙으로 따로 두지 않는다) 두 상태의 띠 높이가 같다 — --bar-h가 해제 때문에 어긋나지 않는다
    expect(forced).not.toMatch(/bar-released[^{]*\{[^}]*border/);
    // 규칙이 강제 색상 미디어 쿼리 안에만 있다: 보통 모드의 .bottom-bar 규칙에는 테두리가 없다(그림자 선)
    const normal = css.slice(0, css.indexOf('@media (forced-colors: active)'));
    const bottomBarRule = /\n\.bottom-bar \{([^}]*)\}/.exec(normal)![1];
    expect(bottomBarRule).not.toMatch(/(^|[\s;])border(-[a-z]+)*\s*:/);
    expect(bottomBarRule).toContain('box-shadow: var(--shadow-bar)');
  });

  it('주 버튼의 hover·active·키보드 포커스 상태도 시스템 색 한 짝으로 덮는다 — hover 때 배경(--c-brand-hover = ButtonText)과 글자(ButtonText)가 같아 글자가 사라지던 것 (r6 후속)', () => {
    // 쉬는 상태: ButtonFace / ButtonText
    expect(forced).toMatch(/\.btn--primary \{ forced-color-adjust: none; background: ButtonFace; color: ButtonText;/);
    // hover·active: Highlight / HighlightText — 배경과 글자를 항상 같이 정한다(한쪽만 정하지 않는다)
    expect(forced).toMatch(/\.btn--primary:hover, \.btn--primary:active \{ background: Highlight; color: HighlightText; \}/);
    // 키보드 포커스: 기본 짝(링은 outline) + 포커스 중 hover·active는 다시 Highlight 짝(더 구체적인 선택자)
    expect(forced).toMatch(/\.btn--primary:focus-visible \{ background: ButtonFace; color: ButtonText; \}/);
    expect(forced).toMatch(/\.btn--primary:focus-visible:hover, \.btn--primary:focus-visible:active \{ background: Highlight; color: HighlightText; \}/);
    // 보통 모드의 hover 규칙은 그대로다(강제 색상 블록이 같은 우선순위 뒤에서 덮는다)
    const normal = css.slice(0, css.indexOf('@media (forced-colors: active)'));
    expect(normal).toContain('.btn--primary:hover { background: var(--c-brand-hover); }');
    // 첫 화면 CSS의 :hover 규칙은 이 한 곳뿐이다(새 hover 규칙이 생기면 강제 색상 짝도 같이 정하라고 이 시험이 알린다)
    const code = css.replace(/\/\*[\s\S]*?\*\//g, ''); // 주석을 뺀 코드만
    expect([...code.matchAll(/:hover/g)].length, ':hover를 쓴 곳(주석 제외) — 보통 모드 1 + 강제 색상 블록(주 버튼 hover 규칙 두 줄)').toBe(3);
  });
});

describe('작은 뷰포트 높이와 공용 감시자 — 가짜 환경 (R-240 주소창, M2-B07 풀린 채 크기 변화)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  interface State {
    svh: boolean;
    probeHeight: number;
    clientHeight: number;
    innerHeight: number;
    barHeight: number;
  }

  /** 브라우저 없이 window·document·ResizeObserver를 흉내 낸다 — 작은 뷰포트(probe)·innerHeight·clientHeight·띠 높이를 따로 바꿀 수 있다 */
  function install(initial: State) {
    const state = { ...initial };
    const listeners: Record<string, Array<() => void>> = {};
    const probes: Array<{ removed: boolean; attrs: Record<string, string>; style: { cssText: string } }> = [];
    const toggles: string[] = [];
    const classes = new Set<string>();
    const vars = new Map<string, string>();
    const observers: Array<{ cb: () => void; disconnected: boolean }> = [];
    vi.stubGlobal('window', {
      get innerHeight() {
        return state.innerHeight;
      },
      CSS: { supports: (_prop: string, value: string) => state.svh && value === '100svh' },
      addEventListener: (type: string, fn: () => void) => {
        (listeners[type] ??= []).push(fn);
      },
      removeEventListener: (type: string, fn: () => void) => {
        listeners[type] = (listeners[type] ?? []).filter((f) => f !== fn);
      },
    });
    vi.stubGlobal('document', {
      body: { appendChild: (el: (typeof probes)[number]) => void probes.push(el) },
      createElement: () => ({
        removed: false,
        attrs: {} as Record<string, string>,
        style: { cssText: '' },
        setAttribute(k: string, v: string) {
          this.attrs[k] = v;
        },
        getBoundingClientRect: () => ({ height: state.probeHeight }),
        remove() {
          this.removed = true;
        },
      }),
      documentElement: {
        get clientHeight() {
          return state.clientHeight;
        },
      },
    });
    vi.stubGlobal(
      'ResizeObserver',
      class {
        entry = { cb: () => {}, disconnected: false };
        constructor(cb: () => void) {
          this.entry.cb = cb;
          observers.push(this.entry);
        }
        observe() {}
        disconnect() {
          this.entry.disconnected = true;
        }
      },
    );
    const root = {
      style: { setProperty: (k: string, v: string) => void vars.set(k, v), removeProperty: (k: string) => void vars.delete(k) },
      classList: {
        toggle: (name: string, on: boolean) => {
          toggles.push(`${name}:${on}`);
          if (on) classes.add(name);
          else classes.delete(name);
        },
        remove: (name: string) => void classes.delete(name),
      },
    } as unknown as HTMLElement;
    const bar = {
      get offsetHeight() {
        return state.barHeight;
      },
    } as unknown as HTMLElement;
    return {
      state,
      probes,
      toggles,
      classes,
      vars,
      root,
      bar,
      listeners,
      observers,
      /** 창 크기 변화 이벤트 (resize) */
      resize: () => (listeners.resize ?? []).forEach((f) => f()),
      /** 띠 크기 변화 (ResizeObserver 콜백) */
      barResized: () => observers.forEach((o) => o.cb()),
    };
  }

  it('createSmallViewport: svh를 알면 100svh 탐침의 높이를 읽는다 — innerHeight·clientHeight가 바뀌어도 변하지 않는다 (주소창 접힘 흉내)', () => {
    const env = install({ svh: true, probeHeight: 568, clientHeight: 568, innerHeight: 568, barHeight: 150 });
    const vp = createSmallViewport();
    expect(env.probes).toHaveLength(1);
    expect(env.probes[0].style.cssText).toContain('height:100svh');
    expect(env.probes[0].style.cssText).toContain('visibility:hidden');
    expect(env.probes[0].style.cssText).toContain('position:fixed');
    expect(env.probes[0].attrs['aria-hidden']).toBe('true');
    expect(vp.height()).toBe(568);
    for (const inner of [300, 568, 640, 900]) {
      env.state.innerHeight = inner; // 주소창이 접히고 펴지며 innerHeight가 오르내린다
      env.state.clientHeight = inner;
      expect(vp.height(), `innerHeight ${inner}`).toBe(568);
    }
    vp.dispose();
    expect(env.probes[0].removed).toBe(true);
  });

  it('createSmallViewport: svh를 모르는 브라우저는 documentElement.clientHeight로, 그것도 0이면 innerHeight로 물러난다 (탐침을 만들지 않는다)', () => {
    const env = install({ svh: false, probeHeight: 999, clientHeight: 480, innerHeight: 700, barHeight: 150 });
    const vp = createSmallViewport();
    expect(env.probes).toHaveLength(0);
    expect(vp.height()).toBe(480);
    env.state.clientHeight = 0;
    expect(vp.height()).toBe(700);
    env.state.innerHeight = 0;
    expect(vp.height(), '아무것도 재지 못하면 0 — shouldReleaseBar가 풀지 않는다').toBe(0);
    expect(shouldReleaseBar(150, vp.height())).toBe(false);
    vp.dispose();
  });

  it('R-240: innerHeight만 바꾼 resize에서 bar-released 클래스 변화가 0번이다 — 해제 상태도 고정 상태도 흔들리지 않는다', () => {
    // 해제 쪽: 띠 150px / 작은 뷰포트 256px = 59%. 주소창이 접히면 innerHeight가 340까지(150/340 = 44%) 커져도 판정은 그대로
    const env = install({ svh: true, probeHeight: 256, clientHeight: 256, innerHeight: 256, barHeight: 150 });
    const watch = watchBarRelease(env.bar, { root: env.root });
    expect(watch.isReleased()).toBe(true);
    expect(env.toggles).toEqual(['bar-released:true']); // 첫 측정 한 번
    for (const inner of [340, 256, 400, 256, 180, 640, 256]) {
      env.state.innerHeight = inner;
      env.resize();
    }
    expect(env.toggles, 'innerHeight만 바꾼 resize 7번 뒤에도 토글은 처음 한 번뿐이다').toEqual(['bar-released:true']);
    expect(watch.isReleased()).toBe(true);
    expect(env.classes.has('bar-released')).toBe(true);
    watch.dispose();

    // 고정 쪽: 띠 68px / 작은 뷰포트 568px = 12%. innerHeight가 100까지 줄어도(68/100이면 옛 방식은 풀었다) 고정 그대로
    const fixed = install({ svh: true, probeHeight: 568, clientHeight: 568, innerHeight: 568, barHeight: 68 });
    const watchFixed = watchBarRelease(fixed.bar, { root: fixed.root });
    expect(watchFixed.isReleased()).toBe(false);
    const before = fixed.toggles.length;
    for (const inner of [100, 568, 120, 300, 568]) {
      fixed.state.innerHeight = inner;
      fixed.resize();
    }
    expect(fixed.toggles.length, '고정 상태에서도 토글 추가 0').toBe(before);
    expect(fixed.classes.has('bar-released')).toBe(false);
    watchFixed.dispose();
  });

  it('작은 뷰포트 높이가 실제로 바뀌면(창 크기·회전) 따라 바뀐다 — 고정 → 해제는 onRelease를 한 번 부르고 해제 → 고정은 부르지 않는다', () => {
    const env = install({ svh: true, probeHeight: 568, clientHeight: 568, innerHeight: 568, barHeight: 150 });
    const calls = { release: 0, releasedResize: 0 };
    const watch = watchBarRelease(env.bar, { root: env.root, onRelease: () => void calls.release++, onReleasedResize: () => void calls.releasedResize++ });
    expect(watch.isReleased(), '150/568 = 26%').toBe(false);
    expect(calls).toEqual({ release: 0, releasedResize: 0 }); // 첫 측정은 onRelease를 부르지 않는다
    env.state.probeHeight = 256; // 가로로 눕히거나 창 높이를 줄임: 150/256 = 59%
    env.resize();
    expect(watch.isReleased()).toBe(true);
    expect(calls).toEqual({ release: 1, releasedResize: 0 });
    env.state.probeHeight = 568;
    env.resize();
    expect(watch.isReleased()).toBe(false);
    expect(calls, '해제 → 고정은 부르지 않는다').toEqual({ release: 1, releasedResize: 0 });
    expect(env.toggles).toEqual(['bar-released:false', 'bar-released:true', 'bar-released:false']);
    watch.dispose();
  });

  it('M2-B07: 이미 풀린 채 띠 높이(글자 확대)나 작은 뷰포트 높이(창 높이 축소)가 달라지면 onReleasedResize가 불린다 — 달라지지 않은 resize·innerHeight만의 변화·ResizeObserver 재통지는 부르지 않는다', () => {
    const env = install({ svh: true, probeHeight: 256, clientHeight: 256, innerHeight: 256, barHeight: 150 });
    const calls = { release: 0, releasedResize: 0 };
    const watch = watchBarRelease(env.bar, { root: env.root, onRelease: () => void calls.release++, onReleasedResize: () => void calls.releasedResize++ });
    expect(watch.isReleased()).toBe(true);
    env.barResized(); // 관찰 시작 직후의 첫 통지: 크기가 달라지지 않았다
    env.resize();
    env.state.innerHeight = 330; // 주소창 접힘
    env.resize();
    expect(calls, '크기가 그대로면 맞춤을 다시 하지 않는다 — 사용자가 스크롤해 둔 위치를 되돌리지 않는다').toEqual({ release: 0, releasedResize: 0 });
    env.state.barHeight = 190; // 글자를 125%로 키움
    env.barResized();
    expect(calls.releasedResize, '띠 높이 변화').toBe(1);
    env.state.probeHeight = 220; // 창 높이 축소 (190/220 = 86%, 여전히 풀림)
    env.resize();
    expect(calls.releasedResize, '작은 뷰포트 높이 변화').toBe(2);
    expect(watch.isReleased()).toBe(true);
    expect(calls.release, '풀린 채 바뀐 것은 onRelease가 아니다').toBe(0);
    expect(env.toggles).toEqual(['bar-released:true']);
    watch.dispose();

    // 고정 상태에서 띠가 커져도(풀리지 않는 한) 부르지 않는다
    const fixed = install({ svh: true, probeHeight: 800, clientHeight: 800, innerHeight: 800, barHeight: 68 });
    const calls2 = { release: 0, releasedResize: 0 };
    const w2 = watchBarRelease(fixed.bar, { root: fixed.root, onRelease: () => void calls2.release++, onReleasedResize: () => void calls2.releasedResize++ });
    fixed.state.barHeight = 150;
    fixed.barResized();
    expect(calls2).toEqual({ release: 0, releasedResize: 0 });
    w2.dispose();
  });

  it('dispose: 리스너·관찰자·탐침을 걷고 bar-released 클래스와 --bar-h를 지운다', () => {
    const env = install({ svh: true, probeHeight: 256, clientHeight: 256, innerHeight: 256, barHeight: 150 });
    const watch = watchBarRelease(env.bar, { root: env.root });
    expect(env.vars.get('--bar-h')).toBe('150px');
    expect(env.listeners.resize).toHaveLength(1);
    watch.dispose();
    expect(env.listeners.resize).toHaveLength(0);
    expect(env.observers[0].disconnected).toBe(true);
    expect(env.probes[0].removed).toBe(true);
    expect(env.classes.has('bar-released')).toBe(false);
    expect(env.vars.has('--bar-h')).toBe(false);
  });
});

describe('짧은 쌍 「A · B」는 좁은 폭·큰 글자에서 두 줄로 나뉜다 (QM2-10 규칙 3)', () => {
  it('컨테이너 쿼리(em 기준)가 기호를 감추고 두 항목을 블록으로 나눈다 — 기준 줄과 보조 줄 각각의 문턱', () => {
    expect(css).toMatch(/@container \(max-width: 14em\) \{\s*\.pair--basis \.pair__item \{ display: block; \}\s*\.pair--basis \.pair__sep \{ display: none; \}\s*\}/);
    expect(css).toMatch(/@container \(max-width: 16\.5em\) \{\s*\.pair--meta \.pair__item \{ display: block; \}\s*\.pair--meta \.pair__sep \{ display: none; \}\s*\}/);
    // 문턱은 슬라이드 칸(container-type: inline-size)의 폭을 가리킨다
    expect(css).toMatch(/\.slide \{ container-type: inline-size;/);
  });
});
