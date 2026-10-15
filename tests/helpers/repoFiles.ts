/**
 * 저장소의 「올라갈 텍스트 파일」 목록과 읽기 (REV-003-M6a-2 R-188 위생 검사용).
 *
 * 「올라갈」 = 깃이 추적하는 파일 + 아직 추가 안 했지만 .gitignore에 걸리지 않는 새 파일(푸시 직전에 새 파일 속 경로도 잡으려고).
 * 깃을 쓸 수 있으면 `git ls-files`가 정답이고, 못 쓰면(압축본·권한 문제) 폴더를 걸으며 node_modules·dist 등과 .gitignore의 간단한 규칙으로 거른다.
 * tests/ 설정에는 Node 타입이 없어서 모듈 이름을 변수로 둔 동적 import를 쓴다(tests/designAssets.test.ts와 같은 방식).
 */

interface FsLike {
  readFileSync(path: string, encoding: 'utf-8'): string;
  readdirSync(path: string): string[];
  statSync(path: string): { isDirectory(): boolean; size: number };
}
interface CpLike {
  execFileSync(file: string, args: string[], options: { encoding: 'utf-8'; maxBuffer: number; cwd: string; stdio: string[] }): string;
}
interface UrlLike {
  fileURLToPath(url: URL): string;
}

const fsSpec = 'node:fs';
const cpSpec = 'node:child_process';
const urlSpec = 'node:url';
const fs = (await import(/* @vite-ignore */ fsSpec)) as FsLike;
const cp = (await import(/* @vite-ignore */ cpSpec)) as CpLike;
const url = (await import(/* @vite-ignore */ urlSpec)) as UrlLike;

/** 저장소 루트의 절대 경로(끝 구분자 없음) */
export const REPO_ROOT: string = url.fileURLToPath(new URL('../../', import.meta.url)).replace(/[\\/]+$/, '');

/** 글로 읽어 검사하는 파일 확장자 (그림 .png 등 바이너리는 대상이 아니다) */
export const TEXT_EXTENSIONS: readonly string[] = [
  'md', 'ts', 'tsx', 'mts', 'cts', 'js', 'mjs', 'cjs', 'json', 'jsonl', 'csv', 'tsv', 'yml', 'yaml', 'sh', 'txt', 'stdout', 'html', 'css', 'svg', 'xml', 'toml',
];
/** 확장자는 없지만 글인 파일 */
const TEXT_BASENAMES = new Set(['.gitignore', '.gitattributes', '.editorconfig', '.nvmrc']);
/** 이보다 큰 파일은 글이어도 건너뛴다(자료 덩어리) */
const MAX_BYTES = 12 * 1024 * 1024;

/** 폴더를 걸을 때(깃 없이) 들어가지 않는 폴더 */
const SKIP_DIRS = new Set(['node_modules', 'dist', 'test-results', 'playwright-report', '.git']);

/** 슬래시로 통일한 상대 경로가 검사 대상 텍스트 파일 꼴인가 */
export function isTextPath(path: string): boolean {
  const base = path.slice(path.lastIndexOf('/') + 1);
  if (TEXT_BASENAMES.has(base)) return true;
  const dot = base.lastIndexOf('.');
  return dot > 0 && TEXT_EXTENSIONS.includes(base.slice(dot + 1).toLowerCase());
}

/**
 * .gitignore의 간단한 규칙만 푼다(이 저장소가 쓰는 꼴): 빈 줄·주석 무시, 맨 앞 `/`는 루트 기준, 끝 `/`는 폴더, `*`는 슬래시 아닌 아무 글자.
 * `/`가 없는 규칙은 어느 깊이의 이름·폴더와도 맞는다. `!`(예외)는 지원하지 않는다 — 있으면 던져서 이 줄이 틀렸음을 알린다.
 */
export function ignoreMatcher(gitignoreText: string): (relativePath: string) => boolean {
  const patterns: RegExp[] = [];
  for (const raw of gitignoreText.split(/\r?\n/)) {
    let line = raw.trim();
    if (line === '' || line.startsWith('#')) continue;
    if (line.startsWith('!')) throw new Error(`ignoreMatcher: 예외 규칙은 지원하지 않는다: ${line}`);
    const anchored = line.startsWith('/') || line.slice(0, -1).includes('/');
    line = line.replace(/^\//, '').replace(/\/$/, '');
    const body = line
      .split('*')
      .map((part) => part.replace(/[.+?^${}()|[\]\\]/g, '\\$&'))
      .join('[^/]*');
    // 이름 자체이거나 그 아래의 모든 것
    patterns.push(new RegExp(`${anchored ? '^' : '(?:^|/)'}${body}(?:/|$)`));
  }
  return (relativePath) => patterns.some((re) => re.test(relativePath));
}

function readText(relative: string): string | null {
  try {
    return fs.readFileSync(`${REPO_ROOT}/${relative}`, 'utf-8');
  } catch {
    return null;
  }
}

/** 깃으로 얻은 「올라갈」 파일 목록 (슬래시 구분 상대 경로). 깃을 못 쓰면 null */
function listViaGit(): string[] | null {
  try {
    const out = cp.execFileSync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard'], {
      encoding: 'utf-8',
      maxBuffer: 64 * 1024 * 1024,
      cwd: REPO_ROOT,
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    const files = out.split('\0').filter((p) => p !== '');
    // 저장소 루트가 아닌 곳에서 도는 깃(상위 폴더 저장소)이면 목록이 엉뚱할 수 있으니 이 폴더의 핵심 파일이 보여야 믿는다
    return files.includes('package.json') ? files : null;
  } catch {
    return null;
  }
}

/** 깃 없이 폴더를 걸어 얻은 목록 */
function listViaWalk(): string[] {
  const ignored = ignoreMatcher(readText('.gitignore') ?? '');
  const out: string[] = [];
  const walk = (relative: string) => {
    let names: string[] = [];
    try {
      names = fs.readdirSync(relative === '' ? REPO_ROOT : `${REPO_ROOT}/${relative}`);
    } catch {
      return;
    }
    for (const name of names) {
      if (SKIP_DIRS.has(name)) continue;
      const path = relative === '' ? name : `${relative}/${name}`;
      if (ignored(path)) continue;
      let isDir = false;
      try {
        isDir = fs.statSync(`${REPO_ROOT}/${path}`).isDirectory();
      } catch {
        continue;
      }
      if (isDir) walk(path);
      else out.push(path);
    }
  };
  walk('');
  return out;
}

export interface RepoTextFiles {
  /** 어떻게 얻었는지: 깃 목록인지, 폴더 걷기인지 */
  via: 'git' | 'walk';
  /** 검사 대상 텍스트 파일의 상대 경로(슬래시 구분) */
  paths: string[];
  /** 깃 목록·걷기 목록에 든 전체 파일 수(그림 등 포함) */
  totalFiles: number;
}

export function listRepoTextFiles(forceWalk = false): RepoTextFiles {
  const git = forceWalk ? null : listViaGit();
  const all = git ?? listViaWalk();
  const paths = all.filter(isTextPath).sort();
  return { via: git ? 'git' : 'walk', paths, totalFiles: all.length };
}

/** 검사 대상 파일을 읽는다. 지워졌거나(깃 목록엔 있는데 디스크엔 없음) 너무 크면 null */
export function readRepoText(relative: string): string | null {
  try {
    if (fs.statSync(`${REPO_ROOT}/${relative}`).size > MAX_BYTES) return null;
  } catch {
    return null;
  }
  return readText(relative);
}
