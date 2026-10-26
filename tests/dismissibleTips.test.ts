import { describe, expect, it } from 'vitest';
import lifeScreenSrc from '../src/screens/LifeScreen.tsx?raw';
import hookSrc from '../src/ui/dismissibleTips.ts?raw';
import { TIP_OFF_ATTR, tipShowing } from '../src/ui/dismissibleTips';

/** CSS는 ?raw가 빈 문자열이라 파일 시스템으로 읽는다 (tests/insight.test.ts와 같은 방법) */
async function readText(relative: string): Promise<string> {
  const spec = 'node:fs';
  const fs = (await import(/* @vite-ignore */ spec)) as { readFileSync(path: URL, encoding: 'utf-8'): string };
  return fs.readFileSync(new URL(relative, import.meta.url), 'utf-8');
}
const dashCss = await readText('../src/styles/dash.css');

/**
 * 도구 줄 압축 모드 말풍선의 WCAG 1.4.13 (SPEC-005 r4 QI9, REV-005-r4-1 R-501) — CSS와 훅이 같은 약속을 지킨다.
 *  ① 마우스가 주 입력일 때만 압축한다((hover: hover) and (pointer: fine)) — 터치·거친 포인터는 이름이 보이는 배치로 물러난다 ② 말풍선에 `pointer-events: none`이 없고 틈을 메우는 다리가 있다(올릴 수 있음)
 *  ③ Esc로 숨기는 속성(`data-tip-off`)을 CSS가 읽고 훅이 켠다(닫을 수 있음). 실제 화면 동작은 e2e/toolbar-one-row.spec.ts가 단언한다.
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

  it('말풍선에 pointer-events: none이 없고(올릴 수 있음), 버튼과의 틈을 메우는 ::before 다리가 있다', () => {
    const css = stripComments(compressBlock());
    expect(css).not.toContain('pointer-events');
    expect(css).toMatch(/span:not\(\.sr-only\)::before \{[^}]*content: ''[^}]*bottom: 100%/);
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

  it('정리 함수가 리스너 셋을 모두 거두고 속성을 지운다 (화면을 떠날 때 남지 않는다)', () => {
    for (const ev of ['pointerover', 'focusin', 'keydown']) {
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
