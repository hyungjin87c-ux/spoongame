import { describe, expect, it } from 'vitest';

/**
 * 원시 HTML 삽입 점검 (SPEC-003 FR4: 사용자 입력을 HTML로 넣는 길은 없다, REV-003-M2-1 R-216).
 * 로고·아이콘 스프라이트는 디자이너가 넘긴 SVG 파일이라 인라인으로 넣어야 CSS 변수(색)를 읽는다 — 그래서 `ui/Brand.tsx` 한 곳에서만 `dangerouslySetInnerHTML`을 쓰고,
 * 그 값은 `ui/brandAssets.ts`가 `?raw`로 가져온 우리 저장소의 파일 내용 상수(4개: 스프라이트 1 + 로고 3 — SPEC-003 M3에서 첫 화면 밖 모든 화면의 헤더 로고 `LOGO_HEADER_SVG`가 더해졌다, DS1)뿐이다. 그 밖의 `src/` 어디에도 원시 HTML 삽입이 없어야 한다.
 * 새로 쓸 일이 생기면 이 허용 목록을 일부러 고쳐야 하므로 리뷰에서 눈에 띈다.
 */

const sources = import.meta.glob('../src/**/*.{ts,tsx}', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;

const stripComments = (src: string): string => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\s)\/\/.*$/gm, '$1');

/** `../src/ui/Brand.tsx` → `ui/Brand.tsx` */
const files = Object.entries(sources).map(([path, raw]) => ({ file: path.replace('../src/', ''), code: stripComments(raw) }));

/** 허용: dangerouslySetInnerHTML은 이 파일에서만, 값은 이 세 상수만 */
const ALLOWED_FILE = 'ui/Brand.tsx';
const ALLOWED_CONSTANTS = ['SPRITE_SVG', 'LOGO_STACKED_SVG', 'LOGO_ROW_SVG', 'LOGO_HEADER_SVG'];

const HTML_SINKS = /\.innerHTML\b|\bouterHTML\b|insertAdjacentHTML|document\.write|createContextualFragment|\beval\(|new Function\(/;

describe('원시 HTML 삽입은 Brand.tsx의 ?raw 상수로만 (FR4)', () => {
  it('glob이 src 전체를 본다 (공허 통과 방지): 화면·core·data·ui 파일이 모두 들어 있고, 알려진 위치가 있다', () => {
    const names = files.map((f) => f.file);
    expect(names.length).toBeGreaterThan(40);
    for (const expected of ['App.tsx', 'ui/Brand.tsx', 'ui/brandAssets.ts', 'screens/TitleScreen.tsx', 'core/storage.ts', 'data/titleText.ts']) expect(names).toContain(expected);
  });

  it('dangerouslySetInnerHTML을 쓰는 파일은 ui/Brand.tsx 하나뿐이다 (그 밖 0건)', () => {
    const users = files.filter((f) => f.code.includes('dangerouslySetInnerHTML')).map((f) => f.file);
    expect(users).toEqual([ALLOWED_FILE]);
  });

  it('Brand.tsx의 dangerouslySetInnerHTML 4곳은 모두 허용된 SVG 상수를 넣는다 (식·문자열 조립·props 없음)', () => {
    const brand = files.find((f) => f.file === ALLOWED_FILE)!;
    const uses = [...brand.code.matchAll(/dangerouslySetInnerHTML=\{\{([^}]*)\}\}/g)].map((m) => m[1].trim());
    expect(uses.length, '허용된 삽입 개수(스프라이트 1 + 로고 3: 첫 화면 세로·가로 + 헤더)').toBe(4);
    for (const use of uses) {
      const m = /^__html: ([A-Z_]+)$/.exec(use);
      expect(m, `허용 모양이 아니다: ${use}`).not.toBeNull();
      expect(ALLOWED_CONSTANTS, use).toContain(m![1]);
    }
    expect(new Set(uses.map((u) => u.replace('__html: ', ''))).size).toBe(4);
    // 상수는 brandAssets에서만 온다
    expect(brand.code).toMatch(/from '\.\/brandAssets'/);
  });

  it('그 네 상수는 brandAssets.ts에서 `?raw`로 가져온 .svg 파일 내용(과 그 이어붙임)일 뿐이다 — 런타임 값·외부 입력이 섞이지 않는다', () => {
    const assets = files.find((f) => f.file === 'ui/brandAssets.ts')!;
    const rawImports = [...assets.code.matchAll(/^import (\w+) from '([^']+\.svg\?raw)';$/gm)].map((m) => m[1]);
    expect(rawImports.length).toBeGreaterThanOrEqual(4);
    for (const name of ALLOWED_CONSTANTS) {
      const m = new RegExp(`export const ${name}: string = ([\\w ]+(?: \\+ \\w+)*);`).exec(assets.code);
      expect(m, `${name} 정의를 못 찾았다`).not.toBeNull();
      for (const id of m![1].split('+').map((s) => s.trim())) expect(rawImports, `${name}의 ${id}는 ?raw로 가져온 파일이어야 한다`).toContain(id);
    }
  });

  it('그 밖의 원시 HTML 삽입(innerHTML·outerHTML·insertAdjacentHTML·document.write·eval·new Function)은 src 어디에도 없다', () => {
    for (const { file, code } of files) expect(code, file).not.toMatch(HTML_SINKS);
  });

  it('점검 규칙이 실제로 잡는다(공허 통과 방지): 다른 파일의 삽입·다른 싱크를 넣은 가짜 소스는 걸린다', () => {
    const fake = '<div dangerouslySetInnerHTML={{ __html: userText }} />';
    expect(fake.includes('dangerouslySetInnerHTML')).toBe(true);
    for (const bad of ['el.innerHTML = x', 'node.outerHTML', 'el.insertAdjacentHTML("beforeend", x)', 'document.write(x)', 'eval(x)', 'new Function("return 1")']) expect(HTML_SINKS.test(bad), bad).toBe(true);
    expect(HTML_SINKS.test(stripComments('// el.innerHTML = x은 쓰지 않는다'))).toBe(false);
    expect(/^__html: ([A-Z_]+)$/.test('__html: userText')).toBe(false);
  });
});
