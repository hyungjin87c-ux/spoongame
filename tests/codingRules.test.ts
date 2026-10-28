import { describe, expect, it } from 'vitest';
import { listRepoTextFiles, readRepoText } from './helpers/repoFiles';

/**
 * 코딩 규칙 CR-RNG (`.coding-rules.md`, 2026-10-28 형진 님 결정 — 에이전트 슬림화): `src`에서 `Math.random()`을 직접 부르지 않는다.
 * 난수는 시드 기반 RNG(`src/core/rng.ts#createRng`, 가족은 `src/core/familyRng.ts`)만 쓴다 — 같은 시드 = 같은 인생.
 * 저장소에 린터가 없어 소스를 읽는 시험으로 강제한다. 주석 속 낱말(「Math.random 없음」 같은 설명)은 세지 않는다.
 */

/** 주석(블록·줄)을 지운 코드. 문자열 안의 `//`(주소 등)는 지우지 않도록 따옴표 구간을 건너뛴다 */
export function stripComments(src: string): string {
  let out = '';
  let i = 0;
  let quote: string | null = null;
  while (i < src.length) {
    const ch = src[i];
    const next = src[i + 1];
    if (quote) {
      out += ch;
      if (ch === '\\') {
        out += next ?? '';
        i += 2;
        continue;
      }
      if (ch === quote) quote = null;
      i += 1;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') {
      quote = ch;
      out += ch;
      i += 1;
      continue;
    }
    if (ch === '/' && next === '*') {
      const end = src.indexOf('*/', i + 2);
      i = end < 0 ? src.length : end + 2;
      continue;
    }
    if (ch === '/' && next === '/') {
      const end = src.indexOf('\n', i);
      i = end < 0 ? src.length : end;
      continue;
    }
    out += ch;
    i += 1;
  }
  return out;
}

const CALL = /Math\s*\.\s*random\s*\(/;
const SRC_CODE = /^src\/.*\.(?:ts|tsx)$/;

describe('CR-RNG Math.random 직접 호출 금지', () => {
  it('감지기 자체 시험: 코드 속 호출은 잡고, 주석 속 낱말은 잡지 않는다', () => {
    expect(CALL.test(stripComments('const x = Math.random();'))).toBe(true);
    expect(CALL.test(stripComments('const x = Math . random ( );'))).toBe(true);
    expect(CALL.test(stripComments('// Math.random()을 쓰지 않는다\nconst y = 1;'))).toBe(false);
    expect(CALL.test(stripComments('/** React·Math.random() 없음 */\nconst y = 1;'))).toBe(false);
    expect(stripComments("const u = 'https://a.b/c'; // 설명")).toBe("const u = 'https://a.b/c'; ");
  });

  it('src의 코드 파일 어디에서도 Math.random()을 부르지 않는다', () => {
    const files = listRepoTextFiles().paths.filter((p) => SRC_CODE.test(p));
    expect(files.length, '공허 통과 방지: src 코드 파일을 읽었다').toBeGreaterThan(100);
    expect(files, '범위 확인').toContain('src/core/rng.ts');
    const hits: string[] = [];
    for (const p of files) {
      const text = readRepoText(p);
      if (text === null) continue;
      stripComments(text)
        .split('\n')
        .forEach((line, i) => {
          if (CALL.test(line)) hits.push(`${p}:${i + 1}`);
        });
    }
    expect(hits, '시드 RNG(src/core/rng.ts#createRng)를 주입받아 쓴다').toEqual([]);
  });
});
