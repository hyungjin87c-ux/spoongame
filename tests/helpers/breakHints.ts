/**
 * 코드에 적은 「줄바꿈 지점 표시」를 찾는다 (SPEC-003 QM3-1 (e), e2e/intendedBreaks.ts의 `INTENDED_BREAKS`와 대조).
 * 낱말 한가운데에 줄이 바뀔 수 있는 자리를 코드에서 명시하는 방법은 셋이다:
 *   `<wbr>`(`<wbr />`)        — 글자 없는 줄바꿈 지점 (마크업)
 *   `&shy;`·`&#173;`·`&#xAD;`  — 소프트 하이픈 엔티티
 *   U+00AD 글자 자체·`\u00AD`·`\xAD` 이스케이프
 * 주석 안의 언급은 사용이 아니므로 뺀다(`stripComments`). 낱말 = 표시 바로 앞뒤로 이어 붙은 한글·영숫자 덩어리(표시 때문에 갈린 한 낱말).
 */

export type BreakHintKind = 'wbr' | 'shy-entity' | 'soft-hyphen';

export interface BreakHint {
  kind: BreakHintKind;
  /** 표시 앞뒤로 이어 붙은 낱말 (표시는 글자가 아니므로 없이 이어 붙인다) */
  word: string;
  /** 소스 안 위치 */
  index: number;
}

/** 블록 주석·줄 주석(앞에 공백이 있을 때만)·JSX 주석을 뺀다 (tests/helpers/code.ts#codeOnly와 같은 규칙) */
export function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\s)\/\/.*$/gm, '$1');
}

const WORD = /[가-힣A-Za-z0-9]/;

/** 소스 글에서 줄바꿈 지점 표시를 모두 찾는다 */
export function findBreakHints(source: string): BreakHint[] {
  const src = stripComments(source);
  const out: BreakHint[] = [];
  const patterns: Array<{ kind: BreakHintKind; re: RegExp }> = [
    { kind: 'wbr', re: /<wbr\b[^>]*>/gi },
    { kind: 'shy-entity', re: /&shy;|&#0*173;|&#x0*ad;/gi },
    { kind: 'soft-hyphen', re: /\\u00ad|\\xad|\u00AD/gi },
  ];
  for (const { kind, re } of patterns) {
    for (const m of src.matchAll(re)) {
      const at = m.index ?? 0;
      let from = at;
      while (from > 0 && WORD.test(src[from - 1])) from--;
      let to = at + m[0].length;
      while (to < src.length && WORD.test(src[to])) to++;
      out.push({ kind, word: src.slice(from, at) + src.slice(at + m[0].length, to), index: at });
    }
  }
  return out.sort((a, b) => a.index - b.index);
}

/**
 * 코드에 적은 강제 줄바꿈 `<br>` 사용처 (REV-003-M3-4 R-300, e2e/intendedBreaks.ts의 `FORCED_BREAKS`와 대조). 마크업의 `<br>`·`<br />`·`<BR/>`와
 * `createElement('br')` 두 꼴이다. 주석 안의 언급은 뺀다. `<wbr>`는 별개(`findBreakHints`)라 세지 않는다.
 */
export function findLineBreakTags(source: string): Array<{ index: number }> {
  const src = stripComments(source);
  const tags = [...src.matchAll(/<br\b[^>]*>/gi)].map((m) => ({ index: m.index ?? 0 }));
  const calls = [...src.matchAll(/createElement\(\s*['"]br['"]/g)].map((m) => ({ index: m.index ?? 0 }));
  return [...tags, ...calls].sort((a, b) => a.index - b.index);
}
