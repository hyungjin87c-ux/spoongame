/**
 * 줄바꿈 위생 감지기 (REV-003-M4-2 R-341) — 저장소의 텍스트 파일은 LF만 쓴다. CR(캐리지 리턴, CRLF의 앞 글자)이 든 파일이 하나라도 있으면 잡는다.
 *
 * 왜: `.gitattributes`(`* text=auto eol=lf`)가 커밋·체크아웃 때 줄바꿈을 LF로 맞춰 줘서 저장소 자체는 안전하지만, 작업 폴더의 파일이 CRLF이거나 CRLF·LF가 섞이면
 * ① `cmp`·해시로 원복을 확인하는 변이 점검이 오판하고 ② 소스 파일을 글로 직접 읽어 정규식으로 보는 시험(줄 끝 `$`)이 어긋난다.
 * 예외는 `.gitattributes`에서 `-text`로 변환을 끈 파일뿐이다(생성기가 UTF-8 BOM·CRLF로 만들고 시험이 바이트 그대로 대조하는 CSV).
 *
 * 이 파일에는 CR 글자를 직접 적지 않는다(`String.fromCharCode(13)`) — 적으면 이 파일 자체가 감지기에 걸린다.
 */

const CR = String.fromCharCode(13);

/** CR이 든 줄의 번호(1부터). CRLF·단독 CR(옛 Mac 줄바꿈)·LF와 섞인 파일 모두 잡는다. 줄 번호는 LF 기준이다. */
export function carriageReturnLines(text: string): number[] {
  if (!text.includes(CR)) return [];
  const lines: number[] = [];
  text.split('\n').forEach((line, i) => {
    if (line.includes(CR)) lines.push(i + 1);
  });
  return lines;
}

/**
 * `.gitattributes`에서 `-text`가 붙은 파일 경로(슬래시 구분, 저장소 루트 기준). 주석·빈 줄은 건너뛴다.
 * 경로에 글롭(`*`·`?`·`[`)이 든 `-text` 규칙은 지원하지 않는다 — 예외 범위가 조용히 넓어지지 않도록 던진다.
 */
export function noTextPaths(gitattributes: string): string[] {
  const out: string[] = [];
  for (const raw of gitattributes.split('\n')) {
    const line = raw.trim();
    if (line === '' || line.startsWith('#')) continue;
    const [pattern, ...attrs] = line.split(/\s+/);
    if (!attrs.includes('-text')) continue;
    if (/[*?[\]]/.test(pattern)) throw new Error(`noTextPaths: -text 규칙에 글롭은 지원하지 않는다: ${pattern}`);
    out.push(pattern.replace(/^\//, ''));
  }
  return out;
}
