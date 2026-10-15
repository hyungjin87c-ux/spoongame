import { describe, expect, it } from 'vitest';
import indexHtml from '../index.html?raw';
import appSrc from '../src/App.tsx?raw';
import errorBoundarySrc from '../src/screens/ErrorBoundary.tsx?raw';
import { LEGACY_THEME_COLOR, enterLegacyLight, type ThemeDocument } from '../src/ui/legacyTheme';
import { readThemeBlocks, themeTokens } from '../scripts/checkContrastLib';

/** vitest는 CSS의 ?raw 가져오기를 빈 문자열로 돌려주므로(CSS 처리 꺼짐) CSS는 파일 시스템으로 읽는다(tests/designAssets.test.ts와 같은 방법). */
async function readText(relative: string): Promise<string> {
  const spec = 'node:fs';
  const fs = (await import(/* @vite-ignore */ spec)) as { readFileSync(path: URL, encoding: 'utf-8'): string };
  return fs.readFileSync(new URL(relative, import.meta.url), 'utf-8');
}
const tokensCss = await readText('../src/styles/tokens.css');
const stylesCss = await readText('../src/styles.css');

/**
 * 옛 화면이 떠 있는 동안 색 구성표를 라이트로 고정한다 (REV-003-M2-1 R-208). 실제 다크 OS 에뮬레이션·화면 전환은 e2e/first-screen.spec.ts 「색 구성표」가 본다.
 * 여기서는 속성 조작과 복원이 정확한지 가짜 문서로 확인한다.
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
  const themeLight = new FakeEl({ name: 'theme-color', content: '#f6f3ec', media: '(prefers-color-scheme: light)' });
  const themeDark = new FakeEl({ name: 'theme-color', content: '#14171f', media: '(prefers-color-scheme: dark)' });
  const doc: ThemeDocument = { documentElement: html, querySelectorAll: () => [scheme, themeLight, themeDark] };
  return { doc, html, scheme, themeLight, themeDark };
}

describe('enterLegacyLight: 옛 화면 동안 라이트 고정 → 돌아오면 원래대로', () => {
  it('<html data-theme>을 light로, color-scheme 메타를 light로, theme-color 두 메타를 옛 화면 바탕색 하나로(media 없이) 바꾼다', () => {
    const { doc, html, scheme, themeLight, themeDark } = makeDoc();
    enterLegacyLight(doc);
    expect(html.snapshot()).toEqual({ 'data-theme': 'light' });
    expect(scheme.snapshot()).toEqual({ name: 'color-scheme', content: 'light' });
    for (const meta of [themeLight, themeDark]) expect(meta.snapshot(), '다크 OS에서도 같은 색').toEqual({ name: 'theme-color', content: LEGACY_THEME_COLOR });
    expect(LEGACY_THEME_COLOR).toMatch(/^#[0-9a-f]{6}$/i);
  });

  it('복원하면 모든 값이 처음 그대로다(속성이 없었으면 없어지고, media도 돌아온다)', () => {
    const { doc, html, scheme, themeLight, themeDark } = makeDoc();
    const before = [html, scheme, themeLight, themeDark].map((e) => e.snapshot());
    const restore = enterLegacyLight(doc);
    restore();
    expect([html, scheme, themeLight, themeDark].map((e) => e.snapshot())).toEqual(before);
  });

  it('이미 data-theme이 있으면(사용자가 고른 테마, M4) 그 값을 되돌려 준다', () => {
    const { doc, html } = makeDoc({ 'data-theme': 'dark' });
    const restore = enterLegacyLight(doc);
    expect(html.getAttribute('data-theme')).toBe('light');
    restore();
    expect(html.getAttribute('data-theme')).toBe('dark');
  });

  it('복원은 여러 번 불려도 안전하다(StrictMode의 이중 effect·언마운트): 두 번째 복원이 다른 값을 덮지 않는다', () => {
    const { doc, html } = makeDoc();
    const restore = enterLegacyLight(doc);
    restore();
    html.setAttribute('data-theme', 'dark'); // 복원 뒤에 사용자가 바꾼 값
    restore();
    expect(html.getAttribute('data-theme')).toBe('dark');
  });

  it('들어왔다 나왔다를 반복해도 쌓이지 않는다 (StrictMode: 마운트 → 정리 → 마운트)', () => {
    const { doc, html, scheme } = makeDoc();
    const r1 = enterLegacyLight(doc);
    r1();
    const r2 = enterLegacyLight(doc);
    expect(html.getAttribute('data-theme')).toBe('light');
    expect(scheme.getAttribute('content')).toBe('light');
    r2();
    expect(html.getAttribute('data-theme')).toBeNull();
    expect(scheme.getAttribute('content')).toBe('light dark');
  });
});

describe('옛 화면에 LegacyLight가 함께 그려진다', () => {
  it('App: 첫 화면(title·다시 연 첫 화면)이 아닐 때만 그린다 — 출생·인생·엔딩·밀린 화면', () => {
    expect(appSrc).toContain("import { LegacyLight } from './ui/legacyTheme';");
    expect(appSrc).toContain('const onFirstScreen = !superseded && (game.phase === \'title\' || showTitle);');
    expect(appSrc).toContain('{onFirstScreen ? null : <LegacyLight />}');
  });

  it('오류 화면(ErrorBoundary)도 옛 화면이라 라이트로 고정한다', () => {
    expect(errorBoundarySrc).toContain('<LegacyLight />');
  });
});

describe('body 기본 바탕은 토큰(시스템 테마)이다 — 다크 OS에서 JS가 뜨기 전 라이트 번쩍임 없음 (REV-003-M2-2 R-223)', () => {
  const blocks = readThemeBlocks(tokensCss);
  const light = themeTokens(blocks, 'light');
  const dark = themeTokens(blocks, 'dark');

  /** styles.css에서 선택자가 정확히 `body`인 규칙의 본문 */
  const bodyRule = (() => {
    const m = /(?:^|\n)body\s*\{([^}]*)\}/.exec(stylesCss);
    if (m === null) throw new Error('styles.css에서 body 규칙을 찾지 못했다');
    return m[1];
  })();

  it('styles.css의 body 바탕·글자색은 고정 색(#…)이 아니라 토큰 var(--c-bg)·var(--c-text)다', () => {
    expect(bodyRule).toMatch(/background:\s*var\(--c-bg\)/);
    expect(bodyRule).toMatch(/color:\s*var\(--c-text\)/);
    expect(bodyRule, 'body 규칙에 고정 색이 없다').not.toMatch(/#[0-9a-f]{3,8}\b/i);
  });

  it('토큰은 라이트·다크 바탕이 서로 다르고(공허 통과 방지) 다크는 시스템 설정(media)으로 걸린다', () => {
    expect(light['--c-bg']).not.toBe(dark['--c-bg']);
    expect(tokensCss).toContain('@media (prefers-color-scheme: dark)');
    expect(tokensCss).toMatch(/@media \(prefers-color-scheme: dark\)\s*\{\s*:root:not\(\[data-theme='light'\]\)/);
  });

  it('index.html: color-scheme 메타는 시스템을 따르고(light dark), 주소 표시줄 색(theme-color)은 라이트·다크 바탕 토큰과 같은 값이며 media로 갈린다', () => {
    expect(indexHtml).toContain('<meta name="color-scheme" content="light dark" />');
    expect(indexHtml).toContain(`content="${light['--c-bg']}" media="(prefers-color-scheme: light)"`);
    expect(indexHtml).toContain(`content="${dark['--c-bg']}" media="(prefers-color-scheme: dark)"`);
  });

  it('옛 화면의 주소 표시줄 색(LEGACY_THEME_COLOR)은 옛 화면이 받는 라이트 바탕 토큰과 같다(<html data-theme="light"> 아래 body = 라이트 --c-bg)', () => {
    expect(LEGACY_THEME_COLOR.toLowerCase()).toBe(light['--c-bg'].toLowerCase());
  });

  it("옛 화면은 LegacyLight가 data-theme을 light로 거는 것만으로 라이트 토큰을 받는다: 기본(:root)이 라이트 토큰이고, 시스템 다크 블록은 data-theme='light'를 제외한다", () => {
    expect(tokensCss).toContain(":root:not([data-theme='light'])");
    // enterLegacyLight가 실제로 거는 값이 바로 그 'light'다
    const { doc, html } = makeDoc();
    enterLegacyLight(doc);
    expect(html.getAttribute('data-theme')).toBe('light');
  });
});
