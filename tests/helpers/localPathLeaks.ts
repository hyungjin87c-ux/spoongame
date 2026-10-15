/**
 * 공개 저장소 위생 감지기 (REV-003-M6a-2 R-188) — 내 컴퓨터의 절대 경로(사용자 폴더)와 사용자 이름이 저장소 글에 남아 있는지 본다.
 *
 * 두 겹이다.
 *  1. 일반 경로 패턴(어느 환경에서 돌려도 같다): 드라이브 문자 + 사용자 폴더(슬래시·역슬래시·겹역슬래시·역슬래시가 빠진 꼴·URL 인코딩 꼴), Git Bash 꼴, macOS·Linux 홈 폴더 아래 계정 폴더.
 *     CI(GitHub Actions)에서도 이 겹이 그대로 동작한다.
 *  2. 실행 환경의 계정 이름(os.userInfo().username, os.homedir()의 마지막 폴더): 내 컴퓨터에서 돌릴 때 내 이름이 글에 남는 것을 막는다.
 *     이름이 짧거나(4자 미만) runner·root처럼 흔한 말이면 우연히 걸리므로 건너뛴다 — CI의 계정은 보통 이렇게 건너뛰어져서 1번 겹만 본다.
 *
 * 이 파일과 테스트에는 사용자 이름·실제 경로를 글자 그대로 적지 않는다(적으면 이 감지기가 저장소에서 자기 자신을 잡는다).
 * 실패 메시지에도 걸린 글자는 싣지 않고 파일·줄·규칙만 적는다(공개 로그에 이름이 또 찍히지 않게).
 */

export interface LeakHit {
  /** 어떤 규칙에 걸렸는지 */
  rule: string;
  /** 1부터 세는 줄 번호 */
  line: number;
}

interface PathRule {
  rule: string;
  re: RegExp;
  /** 걸린 조각 중 정상으로 보아 넘길 것(예: CI 계정 폴더). 없으면 모두 위반 */
  allow?: (m: RegExpExecArray) => boolean;
}

/** macOS·Linux 홈 폴더 아래 이름 자리에 와도 되는 자리표시·CI 계정 */
const HOME_PLACEHOLDERS = new Set(['runner', 'runneradmin', 'user', 'username', 'you', 'me', 'name', 'example', 'ubuntu', 'node', 'shared', 'public', 'default']);

const PATH_RULES: readonly PathRule[] = [
  // 드라이브 문자 한 글자 + 구분자(슬래시·역슬래시·겹역슬래시·%5C·%2F, 0개 이상) + 사용자 폴더 이름. 구분자 0개는 역슬래시가 빠진 깨진 표기
  { rule: 'Windows 사용자 폴더 경로', re: /(?<![A-Za-z0-9])[A-Za-z]:(?:\\|\/|%5C|%2F)*Users/gi },
  // Git Bash 꼴(드라이브 문자가 첫 폴더)
  { rule: 'Git Bash 사용자 폴더 경로', re: /(?<![A-Za-z0-9_])\/[A-Za-z]\/Users\//gi },
  // 드라이브 문자 없이 구분자 인코딩만 남은 꼴
  { rule: 'URL 인코딩된 사용자 폴더 경로', re: /(?:%5C|%2F)Users(?:%5C|%2F)/gi },
  // macOS·Linux 홈 경로. 이름 자리가 자리표시(<이름>, $USER, …)나 CI 계정이면 넘긴다
  {
    rule: 'macOS·Linux 홈 폴더 경로',
    re: /(?<![A-Za-z0-9_.:-])\/(?:Users|home)\/([^\s/\\"'`<>()[\]{}$*|,;:]+)\//g,
    allow: (m) => HOME_PLACEHOLDERS.has(m[1].toLowerCase()),
  },
];

/** 계정 이름으로 쓰기에는 너무 흔해서 글 속에 우연히 들어 있을 수 있는 말 (CI 러너·컨테이너 계정 포함) */
const GENERIC_ACCOUNT_NAMES = new Set([
  'runner', 'runneradmin', 'root', 'user', 'users', 'admin', 'administrator', 'ubuntu', 'node', 'work', 'worker', 'default', 'public', 'guest', 'test', 'tester', 'build', 'builder',
  'github', 'docker', 'jenkins', 'circleci', 'travis', 'vsts', 'system', 'home', 'app', 'dev', 'developer', 'vagrant', 'codespace', 'gitpod', 'vscode',
]);

/** 감지에 쓸 만한 계정 이름만 남긴다: 소문자·중복 제거, 4자 미만이나 흔한 말은 뺀다 */
export function usableAccountNames(candidates: readonly (string | null | undefined)[]): string[] {
  const out = new Set<string>();
  for (const raw of candidates) {
    const name = (raw ?? '').trim().toLowerCase();
    if (name.length < 4) continue;
    if (GENERIC_ACCOUNT_NAMES.has(name)) continue;
    out.add(name);
  }
  return [...out];
}

/**
 * 이 컴퓨터(또는 CI)의 계정 이름 후보: os.userInfo().username, os.homedir()의 마지막 폴더.
 * tests/ 설정에는 Node 타입이 없어서 모듈 이름을 변수로 둔 동적 import를 쓴다(tests/designAssets.test.ts와 같은 방식).
 * 계정 정보를 못 읽는 환경(passwd 항목 없는 컨테이너)에서는 있는 것만 쓴다.
 */
export async function localAccountNames(): Promise<string[]> {
  const spec = 'node:os';
  const os = (await import(/* @vite-ignore */ spec)) as { userInfo(): { username: string }; homedir(): string };
  const found: string[] = [];
  try {
    found.push(os.userInfo().username);
  } catch {
    // 계정 정보를 못 읽는 환경 — 홈 폴더 이름만 쓴다
  }
  try {
    const parts = os.homedir().split(/[\\/]+/).filter((p) => p !== '');
    if (parts.length > 0) found.push(parts[parts.length - 1]);
  } catch {
    // 홈 폴더를 못 읽는 환경
  }
  return usableAccountNames(found);
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** 글자·숫자로만 된 이름은 낱말 경계로 찾고(다른 낱말의 일부는 넘김), 기호·숫자가 섞인 이름은 그 자체로 아주 특이하니 부분 문자열로도 찾는다 */
function nameRegExp(name: string): RegExp {
  const body = escapeRegExp(name);
  return /^\p{L}+$/u.test(name) ? new RegExp(`(?<![\\p{L}\\p{N}_])${body}(?![\\p{L}\\p{N}_])`, 'giu') : new RegExp(body, 'giu');
}

function lineOf(text: string, index: number): number {
  let line = 1;
  for (let i = 0; i < index; i++) if (text.charCodeAt(i) === 10) line++;
  return line;
}

/** 글 속의 사용자 폴더 경로·계정 이름 자리를 모두 찾는다 (걸린 글자는 돌려주지 않고 규칙·줄만) */
export function findLocalPathLeaks(text: string, accountNames: readonly string[] = []): LeakHit[] {
  const hits: LeakHit[] = [];
  for (const { rule, re, allow } of PATH_RULES) {
    re.lastIndex = 0;
    for (let m = re.exec(text); m !== null; m = re.exec(text)) {
      if (allow?.(m)) continue;
      hits.push({ rule, line: lineOf(text, m.index) });
    }
  }
  for (const name of accountNames) {
    const re = nameRegExp(name);
    for (let m = re.exec(text); m !== null; m = re.exec(text)) hits.push({ rule: '실행 환경의 계정 이름', line: lineOf(text, m.index) });
  }
  return hits.sort((a, b) => a.line - b.line);
}
