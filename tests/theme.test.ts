import { describe, expect, it } from 'vitest';
import indexHtml from '../index.html?raw';
import appSrc from '../src/App.tsx?raw';
import mainSrc from '../src/main.tsx?raw';
import errorBoundarySrc from '../src/screens/ErrorBoundary.tsx?raw';
import { readThemeBlocks, themeTokens } from '../scripts/checkContrastLib';
import { THEMES } from '../src/core';
import { THEME_COLOR, applyTheme, isDarkApplied, toggledTheme, type ThemeDocument } from '../src/ui/theme';

/** vitest는 CSS의 ?raw 가져오기를 빈 문자열로 돌려주므로(CSS 처리 꺼짐) CSS는 파일 시스템으로 읽는다(tests/designAssets.test.ts와 같은 방법). */
async function readText(relative: string): Promise<string> {
  const spec = 'node:fs';
  const fs = (await import(/* @vite-ignore */ spec)) as { readFileSync(path: URL, encoding: 'utf-8'): string };
  return fs.readFileSync(new URL(relative, import.meta.url), 'utf-8');
}
const tokensCss = await readText('../src/styles/tokens.css');
const stylesCss = await readText('../src/styles.css');

/**
 * 화면 테마 (SPEC-003 DB6): 설정의 theme(system / light / dark)을 `<html data-theme>`와 색 구성표·주소 표시줄 메타에 건다.
 * 옛 화면을 라이트로 고정하던 legacyTheme(M2~M3)은 모든 화면이 새 디자인이 되면서 사라졌다 — 이 파일이 그 시험(tests/legacyTheme.test.ts)을 대체한다.
 * 실제 다크 OS 에뮬레이션·수동 토글·새로고침 유지는 e2e/m4-theme.spec.ts가 본다.
 */

class FakeEl {
  constructor(private attrs: Record<string, string>) {}
  getAttribute(name: string): string | null {
    return name in this.attrs ? this.attrs[name] : null;
  }
  setAttribute(name: string, value: string): void {
    this.attrs[name] = value;
  }
  removeAttribute(name: string): void {
    delete this.attrs[name];
  }
  snapshot(): Record<string, string> {
    return { ...this.attrs };
  }
}

/** index.html의 메타와 같은 모양: color-scheme 하나, theme-color 둘(라이트·다크 media) */
function makeDoc(htmlAttrs: Record<string, string> = {}) {
  const html = new FakeEl(htmlAttrs);
  const scheme = new FakeEl({ name: 'color-scheme', content: 'light dark' });
  const themeLight = new FakeEl({ name: 'theme-color', content: '#f9f7f2', media: '(prefers-color-scheme: light)' });
  const themeDark = new FakeEl({ name: 'theme-color', content: '#14171f', media: '(prefers-color-scheme: dark)' });
  const doc: ThemeDocument = { documentElement: html, querySelectorAll: () => [scheme, themeLight, themeDark] };
  return { doc, html, scheme, themeLight, themeDark, all: () => [html, scheme, themeLight, themeDark].map((e) => e.snapshot()) };
}

describe('applyTheme: 수동 선택을 문서에 건다', () => {
  it('dark: <html data-theme="dark">, color-scheme 메타 dark, theme-color 두 메타를 다크 바탕색 하나로(media 없이)', () => {
    const { doc, html, scheme, themeLight, themeDark } = makeDoc();
    applyTheme('dark', doc);
    expect(html.snapshot()).toEqual({ 'data-theme': 'dark' });
    expect(scheme.snapshot()).toEqual({ name: 'color-scheme', content: 'dark' });
    for (const meta of [themeLight, themeDark]) expect(meta.snapshot(), '라이트 OS에서도 같은 색').toEqual({ name: 'theme-color', content: THEME_COLOR.dark });
  });

  it('light: 라이트 바탕색, 시스템이 다크여도 같다', () => {
    const { doc, html, scheme, themeLight, themeDark } = makeDoc();
    applyTheme('light', doc);
    expect(html.snapshot()).toEqual({ 'data-theme': 'light' });
    expect(scheme.getAttribute('content')).toBe('light');
    for (const meta of [themeLight, themeDark]) expect(meta.getAttribute('content')).toBe(THEME_COLOR.light);
    for (const meta of [themeLight, themeDark]) expect(meta.getAttribute('media')).toBeNull();
  });

  it('system: data-theme을 지우고 메타를 처음(index.html) 값 그대로 — media까지 — 되돌린다', () => {
    const { doc, all } = makeDoc();
    const before = all();
    applyTheme('dark', doc);
    expect(all()).not.toEqual(before);
    applyTheme('system', doc);
    expect(all()).toEqual(before);
  });

  it('라이트 ↔ 다크 ↔ 시스템을 어떤 순서로 오가도 쌓이지 않고, 마지막 선택이 그대로 보이며 시스템으로 돌아오면 처음과 같다', () => {
    const { doc, html, scheme, all } = makeDoc();
    const before = all();
    for (const seq of [
      ['dark', 'light', 'dark', 'system'],
      ['light', 'system', 'light', 'dark', 'system'],
      ['system', 'system', 'dark', 'dark', 'system'],
    ] as const) {
      for (const t of seq) {
        applyTheme(t, doc);
        if (t === 'system') expect(html.getAttribute('data-theme')).toBeNull();
        else {
          expect(html.getAttribute('data-theme')).toBe(t);
          expect(scheme.getAttribute('content')).toBe(t);
        }
      }
      expect(all(), seq.join('→')).toEqual(before);
    }
  });

  it('첫 건드림이 수동 선택이어도(저장된 다크로 부팅) 처음 값이 기억돼 시스템으로 돌아올 수 있다', () => {
    const { doc, all } = makeDoc();
    const before = all();
    applyTheme('dark', doc); // main.tsx가 React보다 먼저 건다
    applyTheme('dark', doc); // React가 다시 건다(같은 값)
    applyTheme('system', doc);
    expect(all()).toEqual(before);
  });

  it('theme 값은 THEMES 세 가지뿐이고 각각 문서에 건다 (모르는 값이 들어와도 던지지 않는다는 보장은 설정 읽기(parseSettings)가 한다)', () => {
    expect([...THEMES]).toEqual(['system', 'light', 'dark']);
    for (const t of THEMES) expect(() => applyTheme(t, makeDoc().doc)).not.toThrow();
  });
});

describe('다크 모드 버튼: 켜짐 표시와 누른 뒤의 선택 (copy.md 도구 줄)', () => {
  it('isDarkApplied: 수동 다크이거나 시스템 설정을 따르는데 시스템이 다크일 때만 켜짐', () => {
    expect(isDarkApplied('dark', false)).toBe(true);
    expect(isDarkApplied('dark', true)).toBe(true);
    expect(isDarkApplied('light', true)).toBe(false);
    expect(isDarkApplied('light', false)).toBe(false);
    expect(isDarkApplied('system', true)).toBe(true);
    expect(isDarkApplied('system', false)).toBe(false);
  });

  it('toggledTheme: 지금 다크가 적용돼 있으면 라이트, 아니면 다크 — 눈에 보이는 상태를 뒤집는다 (시스템 다크에서 누르면 라이트)', () => {
    expect(toggledTheme('system', true)).toBe('light');
    expect(toggledTheme('system', false)).toBe('dark');
    expect(toggledTheme('dark', false)).toBe('light');
    expect(toggledTheme('dark', true)).toBe('light');
    expect(toggledTheme('light', true)).toBe('dark');
    expect(toggledTheme('light', false)).toBe('dark');
    // 두 번 누르면 처음 모습으로 (수동 선택으로 굳어도 보이는 상태는 원래대로)
    for (const t of THEMES) for (const sys of [true, false]) expect(isDarkApplied(toggledTheme(toggledTheme(t, sys), sys), sys)).toBe(isDarkApplied(t, sys));
  });
});

describe('토큰·메타·부팅과의 대응', () => {
  const blocks = readThemeBlocks(tokensCss);
  const light = themeTokens(blocks, 'light');
  const dark = themeTokens(blocks, 'dark');

  it('THEME_COLOR는 토큰 --c-bg와 같은 값이다 (주소 표시줄이 화면 바탕과 같은 색)', () => {
    expect(THEME_COLOR.light.toLowerCase()).toBe(light['--c-bg'].toLowerCase());
    expect(THEME_COLOR.dark.toLowerCase()).toBe(dark['--c-bg'].toLowerCase());
    expect(THEME_COLOR.light).not.toBe(THEME_COLOR.dark);
  });

  it('index.html: color-scheme 메타는 시스템을 따르고(light dark), theme-color는 라이트·다크 토큰과 같은 값이며 media로 갈린다 (applyTheme이 되돌리는 원래 값)', () => {
    expect(indexHtml).toContain('<meta name="color-scheme" content="light dark" />');
    expect(indexHtml).toContain(`content="${light['--c-bg']}" media="(prefers-color-scheme: light)"`);
    expect(indexHtml).toContain(`content="${dark['--c-bg']}" media="(prefers-color-scheme: dark)"`);
  });

  it("tokens.css: 시스템 다크는 media로 걸리되 수동 라이트(data-theme='light')는 제외하고, 수동 다크는 :root[data-theme='dark']로 걸린다", () => {
    expect(tokensCss).toMatch(/@media \(prefers-color-scheme: dark\)\s*\{\s*:root:not\(\[data-theme='light'\]\)/);
    expect(tokensCss).toContain(":root[data-theme='dark']");
  });

  it('body 기본 바탕·글자색은 고정 색(#…)이 아니라 토큰이다 — 다크 OS에서 JS가 뜨기 전 라이트 번쩍임 없음 (REV-003-M2-2 R-223)', () => {
    const m = /(?:^|\n)body\s*\{([^}]*)\}/.exec(stylesCss);
    expect(m, 'styles.css의 body 규칙').not.toBeNull();
    expect(m![1]).toMatch(/background:\s*var\(--c-bg\)/);
    expect(m![1]).toMatch(/color:\s*var\(--c-text\)/);
    expect(m![1]).not.toMatch(/#[0-9a-f]{3,8}\b/i);
  });

  it('main.tsx는 저장된 테마를 React가 뜨기 전에 건다 (첫 그림부터 고른 테마) — 저장소를 못 읽어도 던지지 않는다', () => {
    const apply = mainSrc.indexOf('applyTheme(parseSettings(');
    const render = mainSrc.indexOf('createRoot(');
    expect(apply).toBeGreaterThan(-1);
    expect(render).toBeGreaterThan(apply);
    expect(mainSrc).toMatch(/try\s*\{\s*applyTheme\([\s\S]*?\}\s*catch\s*\{/);
  });

  it('App은 설정의 theme을 한 곳에서 건다(useApplyTheme)', () => {
    expect(appSrc).toContain("import { useApplyTheme } from './ui/theme';");
    expect(appSrc.match(/useApplyTheme\(/g), '호출은 앱 전체에서 한 번').toHaveLength(1);
    expect(appSrc).toContain('useApplyTheme(settings.theme);');
  });

  it('옛 화면 라이트 고정 장치는 없다: legacyTheme 파일·가져오기·LegacyLight 사용이 없고 오류 화면도 같은 테마 아래다', async () => {
    const files = import.meta.glob('../src/ui/legacyTheme.*');
    expect(Object.keys(files)).toEqual([]);
    for (const src of [appSrc, errorBoundarySrc, mainSrc]) {
      expect(src).not.toMatch(/from ['"][^'"]*legacyTheme['"]/);
      expect(src).not.toMatch(/<LegacyLight|import[^;]*LegacyLight/);
    }
  });
});
