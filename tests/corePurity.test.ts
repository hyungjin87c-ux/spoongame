import { describe, expect, it } from 'vitest';
import indexSrc from '../src/core/index.ts?raw';

/**
 * core 순수성 (SPEC-003 CM2, REV-003-M2-1 R-210): `src/core/*.ts` **전체**를 glob으로 점검한다.
 * 예전에는 파일 이름을 하나씩 적은 목록(life·events·session… / population·format)만 봐서, 새로 생긴 core 파일(carousel.ts·build.ts 등)이 점검 밖에 놓일 수 있었다.
 * 이제 파일이 늘어도 자동으로 점검 대상에 들어온다. core는 시각·난수·타이머·DOM·React를 직접 만지지 않는다 — 시각·시드는 UI가 주입한다.
 */

const sources = import.meta.glob('../src/core/*.ts', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;

/** 주석을 뺀 코드만 본다(규칙을 설명하는 주석이 오탐을 일으키지 않게). 줄 끝 주석은 앞에 공백이 있을 때만 지워 문자열 속 `https://`를 건드리지 않는다. */
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\s)\/\/.*$/gm, '$1');
}

/** core에 있으면 안 되는 것: 시각·난수·타이머·브라우저 전역·저장소·네트워크·React와 UI 계층 import */
const FORBIDDEN =
  /Math\.random|Date\.now|new Date\b|performance\.now|setTimeout|setInterval|requestAnimationFrame|from ['"]react['"]|from ['"]react-dom|document\.|window\.|localStorage|sessionStorage|navigator\.|\bfetch\(|XMLHttpRequest|WebSocket|crypto\.getRandomValues|from ['"]\.\.?\/(ui|screens)\b|from ['"]\.\.\/\.\.\/src\/(ui|screens)\b/;

/**
 * 파일별 허용: 브라우저 저장소 접근을 한 곳에 모은 `getBrowserStorage`(예외를 던질 수 있어 try/catch로 감싼 한 줄)만 허용한다.
 * 허용 조각을 지운 나머지에서 다시 금지 목록을 점검하므로, 같은 파일의 다른 곳에 `window.`가 생기면 잡힌다.
 */
const ALLOWED: Record<string, readonly string[]> = {
  'storage.ts': ["typeof window !== 'undefined' ? window.localStorage : null"],
};

const entries = Object.entries(sources).map(([path, raw]) => ({ file: path.slice(path.lastIndexOf('/') + 1), raw }));

describe('core 순수성 (CM2) — src/core/*.ts 전체', () => {
  it('glob이 core 파일을 전부 찾는다: index.ts가 내보내는 모든 모듈이 점검 대상에 있고, 새 core 파일(population·carousel·build·format)도 들어 있다', () => {
    const files = entries.map((e) => e.file);
    expect(files.length).toBeGreaterThanOrEqual(18);
    const exported = [...indexSrc.matchAll(/export \* from '\.\/([^']+)'/g)].map((m) => `${m[1]}.ts`);
    expect(exported.length).toBeGreaterThanOrEqual(17);
    for (const name of exported) expect(files, `${name}이 점검 대상에 없다`).toContain(name);
    for (const name of ['population.ts', 'carousel.ts', 'build.ts', 'format.ts', 'storage.ts', 'session.ts', 'life.ts', 'index.ts']) expect(files).toContain(name);
  });

  it('점검 규칙이 실제로 잡는다(공허 통과 방지): 금지 패턴을 넣은 가짜 소스는 걸리고, 주석 속 언급은 걸리지 않는다', () => {
    for (const bad of ['const t = Date.now();', 'new Date()', 'Math.random()', 'setTimeout(f, 1)', "import { useState } from 'react';", 'window.addEventListener', 'document.title', "import { X } from '../ui/Brand';", 'localStorage.getItem(k)', 'fetch(url)']) {
      expect(FORBIDDEN.test(stripComments(bad)), bad).toBe(true);
    }
    for (const ok of ['// Date.now()는 쓰지 않는다', '/* Math.random 금지 */', 'const url = "https://example.com"; // 설명', 'const a = 1; // window. 아님']) {
      expect(FORBIDDEN.test(stripComments(ok)), ok).toBe(false);
    }
  });

  for (const { file, raw } of entries) {
    it(`${file}: 시각·난수·타이머·DOM·React·저장소·네트워크·UI 계층을 만지지 않는다 (주석은 제외하고 코드만 본다)`, () => {
      let code = stripComments(raw);
      expect(code.trim().length, `${file} 주석 제거가 소스를 통째로 지웠다`).toBeGreaterThan(20);
      for (const piece of ALLOWED[file] ?? []) {
        expect(code, `${file}의 허용 조각이 사라졌다 — 허용 목록을 정리해야 한다`).toContain(piece);
        code = code.replace(piece, '');
      }
      expect(code, file).not.toMatch(FORBIDDEN);
    });
  }
});
