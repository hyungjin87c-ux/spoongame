import type { RefObject } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import lifeScreenSrc from '../src/screens/LifeScreen.tsx?raw';
import hookSrc from '../src/ui/dismissibleTips.ts?raw';
import { TIP_OFF_ATTR, hidesTipOnClick, tipShowing, useDismissibleTips } from '../src/ui/dismissibleTips';

/** 훅 동작 시험용: React의 useEffect를 곧바로 돌려 정리 함수를 모은다 (DOM 없이 가짜 요소로 이벤트 순서를 흉내 낸다) */
const effects = vi.hoisted(() => ({ cleanups: [] as Array<void | (() => void)> }));
vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react')>();
  return { ...actual, useEffect: (fn: () => void | (() => void)) => void effects.cleanups.push(fn()) };
});

/** CSS는 ?raw가 빈 문자열이라 파일 시스템으로 읽는다 (tests/insight.test.ts와 같은 방법) */
async function readText(relative: string): Promise<string> {
  const spec = 'node:fs';
  const fs = (await import(/* @vite-ignore */ spec)) as { readFileSync(path: URL, encoding: 'utf-8'): string };
  return fs.readFileSync(new URL(relative, import.meta.url), 'utf-8');
}
const dashCss = await readText('../src/styles/dash.css');

/**
 * 도구 줄 압축 모드 말풍선의 WCAG 1.4.13 (SPEC-005 r4 QI9, REV-005-r4-1 R-501) — CSS와 훅이 같은 약속을 지킨다.
 *  ① 마우스가 주 입력일 때만 압축한다((hover: hover) and (pointer: fine)) — 터치·거친 포인터는 이름이 보이는 배치로 물러난다 ② 말풍선의 기본·올림 규칙에 `pointer-events: none`이 없고 틈을 메우는 다리가 있다(올릴 수 있음)
 *  ③ Esc로 숨기는 속성(`data-tip-off`)을 CSS가 읽고 훅이 켠다(닫을 수 있음). 실제 화면 동작은 e2e/toolbar-one-row.spec.ts가 단언한다.
 * SPEC-005 r4 UX9-6 (R-506, 이웃 조작을 가로채지 않는다): ④ 마우스로 눌러 동작시키면 같은 속성으로 그 버튼의 말풍선을 거둔다 — 키보드 click과 구별하고, 누름의 focusin이 먼저 와도 풀리지 않는다 ⑤ 포커스로만 보이는 말풍선만 `pointer-events: none`(올림 상태는 그대로 맞힘 대상).
 */

/** dash.css의 「r4 구현 변경 — 도구 줄 압축 모드」 블록 */
function compressBlock(): string {
  const start = dashCss.indexOf('/* ---------- r4 구현 변경 — 도구 줄 압축 모드');
  const endMark = '/* ---------- r4 구현 변경(도구 줄) 끝 ---------- */';
  const end = dashCss.indexOf(endMark);
  expect(start, '압축 모드 블록이 있다').toBeGreaterThan(-1);
  expect(end, '압축 모드 블록 끝이 있다').toBeGreaterThan(start);
  return dashCss.slice(start, end + endMark.length);
}
const stripComments = (css: string): string => css.replace(/\/\*[^]*?\*\//g, '');

describe('압축 모드 CSS 계약 (R-501)', () => {
  it('마우스가 주 입력일 때만 압축한다: 질의에 (hover: hover) and (pointer: fine)이 들어 있고 960~1179 범위는 그대로다', () => {
    const css = stripComments(compressBlock());
    const media = /@media ([^{]+)\{/.exec(css);
    expect(media, '@media 하나').not.toBeNull();
    expect(media![1]).toContain('(min-width: 960px)');
    expect(media![1]).toContain('(max-width: 1179px)');
    expect(media![1]).toContain('(hover: hover)');
    expect(media![1]).toContain('(pointer: fine)');
    expect((css.match(/@media/g) ?? []).length, '압축 블록의 @media는 하나').toBe(1);
  });

  it('올릴 수 있다: 말풍선의 기본·올림 규칙에는 pointer-events가 없고(포인터를 받는다), 버튼과의 틈을 메우는 ::before 다리가 있다', () => {
    const css = stripComments(compressBlock());
    const rules = css
      .split('}')
      .map((r) => r.trim())
      .filter((r) => r.includes('{'));
    // pointer-events를 쓰는 규칙은 단 하나 — 아래 「포커스로만」 규칙. 기본 말풍선·올림·다리·숨김 규칙은 쓰지 않는다
    expect(rules.filter((r) => r.includes('pointer-events')), 'pointer-events를 쓰는 규칙은 하나').toHaveLength(1);
    expect(css).toMatch(/span:not\(\.sr-only\)::before \{[^}]*content: ''[^}]*bottom: 100%/);
  });

  it('UX9-6 포커스로만 보이는 말풍선(:focus-visible이면서 :hover가 아닐 때)만 pointer-events: none이다 — 올림 상태는 이 규칙에서 빠진다', () => {
    const css = stripComments(compressBlock());
    expect(css).toMatch(/\.controls__tools \.btn--tool:focus-visible:not\(:hover\) > span:not\(\.sr-only\) \{ pointer-events: none; \}/);
    // 선택자 목록에 섞지 않는다 — :focus-visible을 모르는 브라우저가 이 규칙만 버리고 올림 규칙은 살게
    const rule = /([^{}]*)\{ pointer-events: none; \}/.exec(css);
    expect(rule, 'pointer-events: none 규칙').not.toBeNull();
    expect(rule![1], '선택자 하나').not.toContain(',');
  });

  it('말풍선은 평소 clip-path: inset(50%)로 가려지고(불투명도를 쓰지 않는다) 올림·포커스에서만 none이다', () => {
    const css = stripComments(compressBlock());
    expect(css).not.toContain('opacity');
    expect(css).toMatch(/\.btn--tool > span:not\(\.sr-only\) \{[^}]*clip-path: inset\(50%\)/);
    expect(css).toMatch(/\.btn--tool:hover > span:not\(\.sr-only\), \.controls__tools \.btn--tool:focus-visible > span:not\(\.sr-only\) \{ clip-path: none; \}/);
  });

  it('Esc 숨김: 훅이 켜는 속성(data-tip-off)을 CSS가 올림·포커스 규칙보다 구체적으로 읽는다', () => {
    expect(TIP_OFF_ATTR).toBe('data-tip-off');
    const css = stripComments(compressBlock());
    expect(css).toContain(`.controls__tools[${TIP_OFF_ATTR}] .btn--tool:hover > span:not(.sr-only)`);
    expect(css).toContain(`.controls__tools[${TIP_OFF_ATTR}] .btn--tool:focus-visible > span:not(.sr-only)`);
    expect(css).toMatch(/\[data-tip-off\][^{]*\{ clip-path: inset\(50%\); \}/);
  });

  it('구현 dash.css에 쓰이지 않는 .cite__insight-label 규칙이 없다 (R-503)', () => {
    expect(stripComments(dashCss)).not.toContain('.cite__insight-label');
  });
});

describe('훅 연결', () => {
  it('도구 줄(LifeTools)이 그룹 요소 ref로 훅을 부른다', () => {
    expect(lifeScreenSrc).toContain("import { useDismissibleTips } from '../ui/dismissibleTips';");
    expect(lifeScreenSrc).toContain('useDismissibleTips(toolsRef);');
    expect(lifeScreenSrc).toMatch(/className="controls__tools"[^>]*data-testid="tools" ref=\{toolsRef\}/);
  });

  it('Esc만 받고(다른 키는 무시) 이벤트를 막지 않는다 — 시트 닫기·나가기 확인 닫기와 겹치지 않는다', () => {
    expect(hookSrc).toContain("e.key === 'Escape'");
    expect(hookSrc).not.toContain('preventDefault');
    expect(hookSrc).not.toContain('stopPropagation');
  });

  it('정리 함수가 리스너 넷을 모두 거두고 속성을 지운다 (화면을 떠날 때 남지 않는다)', () => {
    for (const ev of ['pointerover', 'focusin', 'click', 'keydown']) {
      expect(hookSrc.match(new RegExp(`addEventListener\\('${ev}'`, 'g')) ?? [], ev).toHaveLength(1);
      expect(hookSrc.match(new RegExp(`removeEventListener\\('${ev}'`, 'g')) ?? [], ev).toHaveLength(1);
    }
    expect(hookSrc).toContain('root.removeAttribute(TIP_OFF_ATTR);');
  });
});

describe('tipShowing — 지금 말풍선이 보이는 중인가', () => {
  const rootWith = (matches: (selector: string) => boolean): Element => ({ querySelector: (sel: string) => (matches(sel) ? ({} as Element) : null) }) as unknown as Element;

  it('올려 둔 버튼이나 포커스한 버튼이 있으면 참, 없으면 거짓', () => {
    expect(tipShowing(rootWith(() => true))).toBe(true);
    expect(tipShowing(rootWith(() => false))).toBe(false);
  });

  it(':focus-visible을 모르는 브라우저(선택자가 SyntaxError)는 :focus로 물러난다', () => {
    const old = rootWith((sel) => {
      if (sel.includes(':focus-visible')) throw new SyntaxError('invalid selector');
      return sel.includes(':focus');
    });
    expect(tipShowing(old)).toBe(true);
    const oldNone = rootWith((sel) => {
      if (sel.includes(':focus-visible')) throw new SyntaxError('invalid selector');
      return false;
    });
    expect(tipShowing(oldNone)).toBe(false);
  });
});

describe('hidesTipOnClick — 마우스 click과 키보드 click의 구별 (UX9-6 1번)', () => {
  it('마우스로 누른 click(detail ≥ 1)은 거둔다 — 포인터는 늘 그 버튼 위에 있다', () => {
    expect(hidesTipOnClick(1, true)).toBe(true);
    expect(hidesTipOnClick(2, true)).toBe(true); // 더블클릭의 둘째 click
  });

  it('키보드(Enter·Space)와 element.click()은 detail이 0이다 — 포인터가 그 버튼 위에 없으면 거두지 않는다 (포커스 표시는 Esc로만 숨는다)', () => {
    expect(hidesTipOnClick(0, false)).toBe(false);
  });

  it('키보드로 눌렀어도 포인터가 그 버튼 위에 있으면 올림으로 보이던 말풍선이라 같이 거둔다', () => {
    expect(hidesTipOnClick(0, true)).toBe(true);
  });
});

/** 훅 동작 시험용 가짜 요소: closest/matches/속성/이벤트만 흉내 낸다 (이벤트 순서와 속성 켜고 끄기를 본다) */
class FakeElement {
  readonly attrs = new Map<string, string>();
  hovered = false;
  private readonly listeners = new Map<string, Set<(e: unknown) => void>>();
  constructor(
    readonly isButton = false,
    readonly parent: FakeElement | null = null,
  ) {}
  closest(selector: string): FakeElement | null {
    if (selector !== '.btn--tool') return null;
    return this.isButton ? this : (this.parent?.closest(selector) ?? null);
  }
  matches(selector: string): boolean {
    if (selector === ':hover') return this.hovered;
    throw new SyntaxError(selector);
  }
  setAttribute(name: string, value: string): void {
    this.attrs.set(name, value);
  }
  removeAttribute(name: string): void {
    this.attrs.delete(name);
  }
  addEventListener(type: string, fn: (e: unknown) => void): void {
    this.listeners.set(type, (this.listeners.get(type) ?? new Set()).add(fn));
  }
  removeEventListener(type: string, fn: (e: unknown) => void): void {
    this.listeners.get(type)?.delete(fn);
  }
  listenerCount(): number {
    return Array.from(this.listeners.values()).reduce((n, set) => n + set.size, 0);
  }
  dispatch(type: string, event: Record<string, unknown>): void {
    for (const fn of Array.from(this.listeners.get(type) ?? [])) fn({ type, ...event });
  }
  /** tipShowing이 쓰는 질의: 자손 중 올린 버튼이 있으면 보이는 중 */
  querySelector(): FakeElement | null {
    return this.children.find((c) => c.hovered) ?? null;
  }
  readonly children: FakeElement[] = [];
}

describe('useDismissibleTips — 이벤트 순서 (UX9-6, R-506)', () => {
  const docListeners = new Map<string, Set<(e: unknown) => void>>();

  function mount() {
    effects.cleanups.length = 0;
    vi.stubGlobal('Element', FakeElement);
    vi.stubGlobal('document', {
      addEventListener: (t: string, fn: (e: unknown) => void) => docListeners.set(t, (docListeners.get(t) ?? new Set()).add(fn)),
      removeEventListener: (t: string, fn: (e: unknown) => void) => void docListeners.get(t)?.delete(fn),
    });
    const root = new FakeElement();
    const bgm = new FakeElement(true, root);
    const icon = new FakeElement(false, bgm); // 버튼 안의 아이콘(이벤트 target이 되는 자손)
    const dark = new FakeElement(true, root);
    root.children.push(bgm, dark);
    useDismissibleTips({ current: root } as unknown as RefObject<HTMLElement>);
    const off = () => root.attrs.has(TIP_OFF_ATTR);
    /** 마우스로 누르기: 포인터가 버튼 위(올림) → mousedown의 focusin → mouseup 뒤 click(detail 1) */
    const mousePress = (btn: FakeElement, target: FakeElement = btn) => {
      btn.hovered = true;
      root.dispatch('focusin', { target, relatedTarget: null });
      root.dispatch('click', { target, detail: 1 });
    };
    const esc = () => docListeners.get('keydown')?.forEach((fn) => fn({ key: 'Escape' }));
    return { root, bgm, icon, dark, off, mousePress, esc };
  }

  afterEach(() => {
    for (const c of effects.cleanups) if (typeof c === 'function') c();
    effects.cleanups.length = 0;
    docListeners.clear();
    vi.unstubAllGlobals();
  });

  it('마우스로 누르면 숨긴다 — 누름의 focusin이 먼저 와도(그 자리에서 거둔다) click에서 건 숨김이 풀리지 않는다', () => {
    const t = mount();
    t.mousePress(t.bgm);
    expect(t.off()).toBe(true);
    // 아이콘(자손)을 누른 click도 같다
    const u = mount();
    u.mousePress(u.bgm, u.icon);
    expect(u.off()).toBe(true);
  });

  it('누른 뒤 같은 버튼 안에서 포인터가 자손 사이를 오가도(pointerover의 target·relatedTarget이 같은 버튼) 숨김이 풀리지 않는다', () => {
    const t = mount();
    t.mousePress(t.bgm);
    t.root.dispatch('pointerover', { target: t.icon, relatedTarget: t.bgm });
    t.root.dispatch('pointerover', { target: t.bgm, relatedTarget: t.icon });
    expect(t.off()).toBe(true);
  });

  it('포인터가 버튼을 벗어났다가(그룹 밖에서) 다시 올라오면 숨김이 풀린다 — 다른 버튼으로 옮겨도 풀린다', () => {
    const t = mount();
    t.mousePress(t.bgm);
    t.bgm.hovered = false; // 버튼을 벗어남(볼륨 줄 쪽 — 그룹 밖이라 이벤트는 오지 않는다)
    t.root.dispatch('pointerover', { target: t.bgm, relatedTarget: null }); // 돌아옴
    expect(t.off()).toBe(false);
    t.mousePress(t.bgm);
    t.bgm.hovered = false;
    t.root.dispatch('pointerover', { target: t.dark, relatedTarget: t.bgm }); // 다른 도구 버튼으로
    expect(t.off()).toBe(false);
  });

  it('키보드 click(detail 0)이고 포인터가 그 버튼 위에 없으면 숨기지 않는다 · 포인터가 위에 있으면 거둔다', () => {
    const t = mount();
    t.root.dispatch('focusin', { target: t.bgm, relatedTarget: null });
    t.root.dispatch('click', { target: t.bgm, detail: 0 });
    expect(t.off(), '키보드 Enter·Space').toBe(false);
    t.bgm.hovered = true;
    t.root.dispatch('click', { target: t.bgm, detail: 0 });
    expect(t.off(), '포인터가 위에 있는 키보드 click').toBe(true);
  });

  it('도구 버튼 밖(그룹의 빈 자리)을 누른 click은 아무것도 하지 않는다', () => {
    const t = mount();
    t.root.dispatch('click', { target: t.root, detail: 1 });
    expect(t.off()).toBe(false);
  });

  it('Esc는 그대로다: 올린 버튼이 있을 때만 켜고, 없으면 켜지 않는다', () => {
    const t = mount();
    t.esc();
    expect(t.off(), '말풍선이 없을 때').toBe(false);
    t.bgm.hovered = true;
    t.esc();
    expect(t.off(), '올린 버튼이 있을 때').toBe(true);
  });

  it('정리 함수가 리스너를 모두 거두고 속성을 지운다', () => {
    const t = mount();
    t.mousePress(t.bgm);
    expect(t.root.listenerCount()).toBe(3); // pointerover · focusin · click
    expect(docListeners.get('keydown')?.size).toBe(1);
    for (const c of effects.cleanups) if (typeof c === 'function') c();
    expect(t.root.listenerCount()).toBe(0);
    expect(docListeners.get('keydown')?.size).toBe(0);
    expect(t.off()).toBe(false);
    effects.cleanups.length = 0;
  });
});
