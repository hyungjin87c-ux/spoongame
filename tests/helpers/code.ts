/**
 * 소스 점검용: 주석을 뺀 코드만 돌려준다(규칙을 설명하는 주석이 「Math.random 없음」 같은 점검에 오탐을 일으키지 않게).
 * 줄 끝 주석은 앞에 공백이 있을 때만 지워 문자열 속 `https://`를 건드리지 않는다. tests/corePurity.test.ts의 규칙과 같다.
 */
export function codeOnly(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\s)\/\/.*$/gm, '$1');
}
