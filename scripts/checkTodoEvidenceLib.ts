/**
 * docs/TODO.md `[x]` 근거 전수 대조의 순수 부분 (REV-001-M5-1 R-081). 파일 시스템·프로세스는 `Env`로 받아서, 테스트(tests/checkTodoEvidence.test.ts)가 가짜 저장소로 확인한다.
 * 실행 스크립트: scripts/checkTodoEvidence.ts (`npm run check:todo`).
 *
 * CLAUDE.md 3절: `[x]` 항목에는 근거(파일·함수·테스트명)를 적고, 적힌 파일·테스트가 실제로 없으면 검수가 반려한다.
 * 이 코드가 그 "실제로 있는가"를 기계로 확인한다. 마일스톤마다(검수 전에) 돌린다. 실패가 하나라도 있으면 종료 코드 1.
 *
 * ## 무엇을 대조하나 (각 `[x]` 항목의 "근거:" 뒤 글에 대해)
 *  1. 파일 경로: `src/…`·`tests/…`·`e2e/…`·`e2e-prod/…`·`scripts/…`·`docs/…`·`qa/…`·`harness/…`·`wiki/…`·`ai-log/…`·`.claude/…`와 저장소 루트 파일(package.json 등).
 *     - `{a,b}` 묶음은 펼쳐서 각각, `*` 글롭은 "맞는 파일이 하나 이상"으로 확인한다.
 *     - 경로 바로 뒤(괄호 설명은 건너뛰고)가 `·이름.확장자`이면 같은 폴더의 형제 파일이다(예: `…/dev-M5-ending-mobile.png·dev-M5-ending-desktop.png`, `docs/review/A.md(R-1)·B.md(R-2)`).
 *     - "구 …/Old.tsx 삭제"처럼 없앴다고 적은 경로는 반대로 **없어야** 통과한다.
 *  2. `경로#심볼`: 그 파일에 심볼이 낱말로 들어 있다. `#a/b/c`처럼 `/`로 이어진 목록은 모두, `심볼(설명)` 괄호 설명은 건너뛴다(중첩 괄호 포함), `a.b`는 각 부분.
 *  3. `package.json scripts.이름`, `npm run 이름`: package.json scripts에 그 이름이 있다.
 *  4. 따옴표 안 테스트 제목: 실제 테스트 목록에 있다 (아래). 단 `docs/review/….md 하단 "반영 내역 (…)"`처럼 따옴표 바로 앞이 `하단`이면 테스트 제목이 아니라
 *     앞에서 적은 .md 문서(200자 안)의 소제목이다 — 그 문서들 중 하나의 본문에 있으면 통과한다.
 *
 * ## 테스트 제목 대조 (템플릿 제목은 전개해서)
 * 소스를 정규식으로 읽지 않고 **실제 실행기에게 목록을 받는다**(scripts/checkTodoEvidence.ts): `vitest list --json`, `playwright test --list --reporter=json`(e2e·e2e-prod 두 설정).
 * 그래서 `for (const vp of …) test(`${vp.width}x${vp.height}: …`)` 같은 템플릿 제목은 이미 `360x568: …`처럼 전개된 이름으로 온다.
 * 각 테스트의 전체 이름은 `묶음 > 묶음 > 테스트`(describe 제목 포함)이고, 근거의 따옴표 글은 그 **부분 문자열**이면 통과한다
 * (근거는 제목 일부만 적기도 하고 describe 제목만 적기도 한다). 근거 쪽의 가변 부분은 와일드카드로 읽는다:
 *   `…`·`...`(생략), `${…}`(템플릿 그대로 적은 것), `<…>`(자리 표시: `<뷰포트>`, `<25|50|75>`). 조각들은 한 이름 안에서 **순서대로** 나와야 한다.
 *
 * ## 제목-파일 짝 경고 (REV-001-M5-2 R-092) — 실패가 아니라 경고
 * 근거는 `tests/a.test.ts "제목1", "제목2"; e2e/b.spec.ts "제목3"`처럼 파일 다음에 그 파일의 제목들을 적는다. 따옴표 제목 바로 앞에 적힌 테스트 파일
 * (`tests/…test.ts(x)`·`e2e/…spec.ts`·`e2e-prod/…spec.ts` 중 가장 가까운 것)이 그 제목을 가진 **실제 파일**이 아니면 경고한다.
 * 실제 파일은 실행기가 알려 준 목록(vitest `list --json`의 file, playwright 목록의 파일)이고, 그 제목(부분 문자열, 와일드카드 규칙 동일)을 가진 테스트가
 * 여러 파일에 있으면 그중 하나라도 앞에 적힌 파일이면 통과한다. 파일 정보를 주지 않으면(`testFiles` 생략) 이 점검은 건너뛴다.
 * 존재 대조(위 1~4)가 못 잡는 "제목은 있는데 엉뚱한 파일 뒤에 적었다"를 잡는다 — 실제 사례: 제목 둘이 `e2e/guard.spec.ts` 뒤에 있었으나 실제 파일은 tests/life.test.ts.
 * 경고는 종료 코드를 바꾸지 않는다. 경고 목록을 0으로 유지하는 것이 목표다.
 *
 * ## 오탐 처리 규칙 (따옴표 짝 파싱)
 *  - 근거 글 안의 제목에는 `\"`로 이스케이프한 따옴표가 있다 → 짝을 맞출 때 건너뛰고 비교 때 `"`로 되돌린다.
 *  - 제목 자체에 이스케이프 없이 `"…"`가 들어 있기도 하다(예: `… (SPEC "10분 내외"의 하단 …)`). 그래서 여는 따옴표마다
 *    **가장 먼 닫는 따옴표부터** 시도해(최대 MAX_QUOTES개 앞, MAX_SPAN 글자 안) 실제 이름에 맞는 첫 후보를 고르고,
 *    아무 후보도 안 맞으면 가장 가까운 짝을 "못 찾음"으로 보고한다. 긴 후보가 먼저라 제목 전체가 검사되고, 맞는 후보가 없을 때만 실패다.
 *  - 항목 설명("근거:" 앞)의 따옴표는 대조하지 않는다 — 그 글은 근거가 아니라 항목 이름이다.
 *  - 따옴표 안 글이 테스트 제목이 아니라 화면 문구·플래그 이름을 말하는 산문일 때는 어느 이름의 부분 문자열이어서 통과하거나,
 *    그렇지 않으면 "못 찾음"으로 나온다. 후자는 근거 문장에서 따옴표 대신 「」를 쓴다(따옴표는 테스트 제목에만 쓴다).
 *
 * ## 한계 (알아 두기)
 *  - 몇 개인지(`16개`, `연결 27개` 같은 숫자)는 대조하지 않는다 — 숫자를 쓸 때는 직접 센다(`npx playwright test --list`, tests/events.test.ts CHAINS).
 *  - `경로(설명)` 안의 백틱 식별자나 CSS 클래스는 대조하지 않는다. 심볼은 `#`로 적은 것만 본다.
 *  - 항목 하나가 근거 없이 `[x]`이면("근거:" 없음) 실패다.
 */

/** 파일 시스템 접근 (실행 스크립트는 node:fs로, 테스트는 메모리 저장소로 채운다) */
export interface Env {
  exists(path: string): boolean;
  isDirectory(path: string): boolean;
  /** 폴더 안 이름들 (폴더가 아니면 빈 목록) */
  list(dir: string): string[];
  /** 파일 내용 (없으면 null) */
  read(path: string): string | null;
}

/** 후보 하나를 고를 때 보는 닫는 따옴표의 최대 개수와 최대 글자 수 */
export const MAX_QUOTES = 6;
export const MAX_SPAN = 700;

export const ROOT_DIRS = ['.claude', 'src', 'tests', 'e2e-prod', 'e2e', 'scripts', 'docs', 'qa', 'harness', 'wiki', 'ai-log'] as const;
export const ROOT_FILES = [
  'package.json',
  'package-lock.json',
  'vite.config.ts',
  'playwright.config.ts',
  'playwright.prod.config.ts',
  'tsconfig.json',
  'tsconfig.node.json',
  'node-globals.d.ts',
  'index.html',
  'CLAUDE.md',
  'HANDOFF.md',
] as const;

// ---------- 실제 테스트 목록 ----------

export interface PlaywrightSuite {
  title: string;
  /** 최상위 묶음(파일)의 testDir 기준 상대 경로 */
  file?: string;
  suites?: PlaywrightSuite[];
  specs?: Array<{ title: string }>;
}

/** `playwright test --list --reporter=json`의 suites에서 테스트 전체 이름(묶음 > 묶음 > 테스트)을 모은다. 최상위 묶음은 파일 이름이라 넣지 않는다. 프로젝트(mobile-360·desktop)가 달라도 이름은 하나다. */
export function playwrightNames(suites: readonly PlaywrightSuite[]): string[] {
  const out = new Set<string>();
  const walk = (suite: PlaywrightSuite, trail: string[]) => {
    for (const spec of suite.specs ?? []) out.add([...trail, spec.title].join(' > '));
    for (const child of suite.suites ?? []) walk(child, [...trail, child.title]);
  };
  for (const file of suites) walk(file, []);
  return [...out];
}

/** 테스트 전체 이름(묶음 > … > 테스트, 공백 정규화) → 그 이름이 있는 파일들(저장소 루트 기준 경로, 슬래시) */
export type TestFiles = ReadonlyMap<string, ReadonlySet<string>>;

export interface TestEntry {
  name: string;
  file: string;
}

/** `playwright test --list --reporter=json`의 suites에서 (테스트 전체 이름, 파일)을 모은다. dir은 그 설정의 testDir(`e2e`·`e2e-prod`) — 최상위 묶음의 file이 그 안의 상대 경로다. */
export function playwrightEntries(suites: readonly PlaywrightSuite[], dir: string): TestEntry[] {
  const out: TestEntry[] = [];
  const walk = (suite: PlaywrightSuite, trail: string[], file: string) => {
    for (const spec of suite.specs ?? []) out.push({ name: [...trail, spec.title].join(' > '), file });
    for (const child of suite.suites ?? []) walk(child, [...trail, child.title], file);
  };
  for (const top of suites) walk(top, [], `${dir}/${top.file ?? top.title}`);
  return out;
}

/** vitest가 알려 준 절대 경로를 저장소 루트(슬래시) 기준 상대 경로로 바꾼다. 루트 밖이면 그대로 둔다. */
export function relativeTo(root: string, file: string): string {
  const r = root.replace(/\\/g, '/').replace(/\/+$/, '');
  const f = file.replace(/\\/g, '/');
  return f.startsWith(r + '/') ? f.slice(r.length + 1) : f;
}

/** (이름, 파일) 목록 → 이름별 파일 집합. 이름은 점검할 때와 같게 공백을 하나로 줄인다. */
export function testFilesOf(entries: readonly TestEntry[]): Map<string, Set<string>> {
  const map = new Map<string, Set<string>>();
  for (const e of entries) {
    const key = e.name.replace(/\s+/g, ' ');
    const files = map.get(key);
    if (files === undefined) map.set(key, new Set([e.file]));
    else files.add(e.file);
  }
  return map;
}

/** 테스트 파일 경로인가 (글롭 제외) */
export function isTestFile(p: string): boolean {
  return !p.includes('*') && /^(?:tests\/.+\.test\.tsx?|e2e\/.+\.spec\.ts|e2e-prod\/.+\.spec\.ts)$/.test(p);
}

// ---------- 따옴표 글 → 와일드카드 조각 ----------

/** 근거의 따옴표 글을 조각 목록으로: `…`·`...`·`${…}`·`<…>`는 와일드카드(조각 사이) */
export function segmentsOf(quoted: string): string[] {
  return quoted
    .replace(/\$\{[^}]*\}/g, '\u0000')
    .replace(/<[^<>]*>/g, '\u0000')
    .replace(/…|\.\.\./g, '\u0000')
    .split('\u0000')
    .map((s) => s.replace(/\s+/g, ' ').trim())
    .filter((s) => s.length > 0);
}

/** 조각들이 한 이름 안에서 순서대로 나오는가 */
export function inOrder(name: string, segments: readonly string[]): boolean {
  let pos = 0;
  for (const seg of segments) {
    const at = name.indexOf(seg, pos);
    if (at < 0) return false;
    pos = at + seg.length;
  }
  return true;
}

export interface QuoteResult {
  /** 근거 글 안에서 여는 따옴표의 위치 */
  at: number;
  text: string;
  found: boolean;
}

/** 근거 글에서 따옴표 글을 뽑아 각각 실제 테스트 이름에 있는지 본다 (짝 맞춤 규칙은 머리말 "오탐 처리 규칙") */
export function checkQuotes(evidence: string, names: readonly string[]): QuoteResult[] {
  const normalized = names.map((n) => n.replace(/\s+/g, ' '));
  const matches = (text: string): boolean => {
    const segs = segmentsOf(text);
    if (segs.length === 0) return true; // 와일드카드뿐인 글은 대조할 것이 없다
    return normalized.some((n) => inOrder(n, segs));
  };
  const unescape = (s: string) => s.replace(/\\"/g, '"');
  const quotes: number[] = [];
  for (let i = 0; i < evidence.length; i++) if (evidence[i] === '"' && evidence[i - 1] !== '\\') quotes.push(i);

  const out: QuoteResult[] = [];
  let i = 0;
  while (i < quotes.length) {
    const open = quotes[i];
    let accepted = -1;
    for (let j = Math.min(quotes.length - 1, i + MAX_QUOTES); j > i; j--) {
      if (quotes[j] - open > MAX_SPAN) continue;
      if (matches(unescape(evidence.slice(open + 1, quotes[j])))) {
        accepted = j;
        break;
      }
    }
    if (accepted > 0) {
      out.push({ at: open, text: unescape(evidence.slice(open + 1, quotes[accepted])), found: true });
      i = accepted + 1;
    } else if (i + 1 < quotes.length) {
      out.push({ at: open, text: unescape(evidence.slice(open + 1, quotes[i + 1])), found: false });
      i += 2;
    } else {
      out.push({ at: open, text: unescape(evidence.slice(open + 1)), found: false }); // 짝이 없는 따옴표
      i += 1;
    }
  }
  return out;
}

// ---------- 경로·심볼 ----------

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const PATH_RE = new RegExp(
  `(?<![\\w./-])((?:${[...ROOT_DIRS.map((d) => escapeRe(d) + '/'), ...ROOT_FILES.map(escapeRe)].join('|')})(?:[A-Za-z0-9_.\\-*/]|\\{[^}\\s]*\\})*)`, // 한글은 경로 글자가 아니다: "tsconfig.json에서"처럼 조사가 붙은 경로를 자른다
  'g',
);

/** `a/{b,c}.md` → [`a/b.md`, `a/c.md`] */
export function expandBraces(p: string): string[] {
  const m = /^(.*?)\{([^{}]*)\}(.*)$/.exec(p);
  if (m === null) return [p];
  return m[2].split(',').flatMap((alt) => expandBraces(m[1] + alt + m[3]));
}

const trimTail = (p: string) => p.replace(/[.,;:]+$/, '');

function globToRegExp(glob: string): RegExp {
  return new RegExp('^' + glob.replace(/[.+^$()|[\]\\]/g, '\\$&').replace(/\*\*/g, '\u0001').replace(/\*/g, '[^/]*').replace(/\u0001/g, '.*') + '$');
}

/** 경로(글롭 포함)가 실제로 있는가: 글롭은 맞는 파일이 하나 이상 */
export function pathExists(env: Env, p: string): boolean {
  if (!p.includes('*')) return env.exists(p);
  const firstStar = p.indexOf('*');
  const dirEnd = p.lastIndexOf('/', firstStar);
  const base = dirEnd < 0 ? '.' : p.slice(0, dirEnd);
  if (!env.exists(base)) return false;
  if (/\*\*$/.test(p)) return env.list(base).length > 0; // `tests/**`: 폴더에 무언가 있다
  const re = globToRegExp(p);
  const walk = (dir: string): boolean => {
    for (const name of env.list(dir)) {
      const full = dir === '.' ? name : `${dir}/${name}`;
      if (re.test(full)) return true;
      if (p.includes('**') && env.isDirectory(full) && name !== 'node_modules' && walk(full)) return true;
    }
    return false;
  };
  return walk(base);
}

/** `#심볼` 목록 파싱: 식별자(점으로 이어진 것 포함) + 선택적 `(설명)` + `/` 다음 식별자 … */
export function parseSymbols(text: string, from: number): { symbols: string[]; end: number } {
  const symbols: string[] = [];
  let i = from;
  const ident = /[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*/y;
  for (;;) {
    ident.lastIndex = i;
    const m = ident.exec(text);
    if (m === null) break;
    symbols.push(m[0]);
    i = ident.lastIndex;
    if (text[i] === '(') {
      let depth = 0;
      let k = i;
      for (; k < text.length; k++) {
        if (text[k] === '(') depth++;
        else if (text[k] === ')' && --depth === 0) break;
      }
      if (k >= text.length) break; // 닫히지 않은 괄호: 여기서 멈춘다
      i = k + 1;
    }
    if (text[i] === '/' && /[A-Za-z_$]/.test(text[i + 1] ?? '')) i += 1;
    else break;
  }
  return { symbols, end: i };
}

const wordRe = (sym: string) => new RegExp(`(?<![\\w$])${escapeRe(sym)}(?![\\w$])`);

// ---------- TODO 파싱·대조 ----------

export interface Problem {
  line: number;
  kind: string;
  detail: string;
}

export interface Report {
  items: number;
  paths: number;
  symbols: number;
  scripts: number;
  quotes: number;
  /** 제목-파일 짝을 대조한 따옴표 제목의 수 (앞에 테스트 파일이 적혀 있고 실제 파일 정보가 있는 것) */
  pairs: number;
  problems: Problem[];
  /** 제목-파일 짝 경고 (실패가 아니다, R-092) */
  warnings: Problem[];
}

/** 경로 바로 뒤(괄호 설명은 건너뛰고)에 `·이름.확장자`가 이어지면 같은 폴더의 형제 파일이다: `a/b.png·c.png`, `docs/x/A.md(설명)·B.md(설명)` */
export function siblingNames(text: string, from: number): { names: string[]; end: number } {
  const names: string[] = [];
  let i = from;
  for (;;) {
    let j = i;
    if (text[j] === '(') {
      let depth = 0;
      let k = j;
      for (; k < text.length; k++) {
        if (text[k] === '(') depth++;
        else if (text[k] === ')' && --depth === 0) break;
      }
      if (k >= text.length) break;
      j = k + 1;
    }
    const m = /^·([\w\-.]+\.\w+)/.exec(text.slice(j));
    if (m === null) break;
    names.push(m[1]);
    i = j + m[0].length;
  }
  return { names, end: i };
}

interface PathRef {
  paths: string[];
  end: number;
}

/** 이 따옴표 앞에 적힌 가장 가까운 테스트 파일들(형제 줄임 포함). 없으면 null */
function ownerFilesBefore(refs: readonly PathRef[], at: number): string[] | null {
  for (let i = refs.length - 1; i >= 0; i--) {
    if (refs[i].end > at) continue;
    const files = refs[i].paths.filter(isTestFile);
    if (files.length > 0) return files;
  }
  return null;
}

/** 제목-파일 짝 (R-092): 이 제목을 가진 실제 파일들 중에 앞에 적힌 테스트 파일이 없으면 경고 */
function checkPair(q: QuoteResult, refs: readonly PathRef[], testFiles: TestFiles, report: Report, warn: (kind: string, detail: string) => void): void {
  const owners = ownerFilesBefore(refs, q.at);
  if (owners === null) return;
  const segs = segmentsOf(q.text);
  if (segs.length === 0) return;
  const actual = new Set<string>();
  for (const [name, files] of testFiles) if (inOrder(name, segs)) for (const f of files) actual.add(f);
  if (actual.size === 0) return; // 이름 대조가 따로 보고한다
  report.pairs++;
  if (owners.some((o) => actual.has(o))) return;
  const shown = q.text.length > 70 ? q.text.slice(0, 70) + '…' : q.text;
  warn('제목-파일 짝', `"${shown}" 앞에 적힌 파일은 ${owners.join('·')}인데 이 제목의 실제 파일은 ${[...actual].sort().join(', ')}`);
}

export function checkTodo(todo: string, names: readonly string[], pkgScripts: ReadonlySet<string>, env: Env, testFiles?: TestFiles): Report {
  const report: Report = { items: 0, paths: 0, symbols: 0, scripts: 0, quotes: 0, pairs: 0, problems: [], warnings: [] };
  const fileCache = new Map<string, string | null>();
  const read = (p: string): string | null => {
    if (!fileCache.has(p)) fileCache.set(p, env.exists(p) && !env.isDirectory(p) ? env.read(p) : null);
    return fileCache.get(p) ?? null;
  };

  todo.split(/\r?\n/).forEach((line, idx) => {
    if (!/^\s*- \[x\]/i.test(line)) return;
    const lineNo = idx + 1;
    const head = line.replace(/^\s*- \[x\]\s*/i, '').slice(0, 40);
    const marker = line.indexOf('근거:');
    report.items++;
    const problem = (kind: string, detail: string) => report.problems.push({ line: lineNo, kind, detail: `${detail}   [${head}…]` });
    const warn = (kind: string, detail: string) => report.warnings.push({ line: lineNo, kind, detail: `${detail}   [${head}…]` });
    if (marker < 0) {
      problem('근거 없음', '`[x]` 항목에 "근거:"가 없다');
      return;
    }
    const evidence = line.slice(marker + '근거:'.length);
    const refs: PathRef[] = [];

    // 1·2. 경로와 심볼
    for (const m of evidence.matchAll(PATH_RE)) {
      const token = trimTail(m[1]);
      const start = m.index ?? 0;
      const tokenEnd = start + token.length;
      const before = evidence.slice(Math.max(0, start - 3), start);
      const after = evidence.slice(tokenEnd, tokenEnd + 14);
      const removed = /^\s*\)?\s*(?:삭제|제거)/.test(after) || before.endsWith('구 ');
      const own = expandBraces(token);
      const paths = [...own];
      // 형제 파일 줄임
      const sib = token.includes('*') ? { names: [], end: tokenEnd } : siblingNames(evidence, tokenEnd);
      for (const name of sib.names) for (const p of own) paths.push(p.slice(0, p.lastIndexOf('/') + 1) + name);
      refs.push({ paths, end: sib.end });
      for (const p of paths) {
        report.paths++;
        const exists = pathExists(env, p);
        if (removed && exists) problem('삭제했다고 적은 파일이 있음', p);
        else if (!removed && !exists) problem('파일 없음', p);
      }
      if (evidence[tokenEnd] === '#' && !removed) {
        const { symbols } = parseSymbols(evidence, tokenEnd + 1);
        for (const p of own) {
          const src = read(p);
          for (const sym of symbols) {
            report.symbols++;
            if (src === null) continue; // 파일 없음은 위에서 이미 보고했다
            if (!sym.split('.').every((part) => wordRe(part).test(src))) problem('심볼 없음', `${p}#${sym}`);
          }
        }
      }
    }

    // 3. package.json scripts
    for (const m of evidence.matchAll(/\bscripts\.([a-z][\w:-]*)/g)) {
      report.scripts++;
      if (!pkgScripts.has(m[1])) problem('npm 스크립트 없음', `scripts.${m[1]}`);
    }
    for (const m of evidence.matchAll(/\bnpm run ([a-z][\w:-]*)/g)) {
      report.scripts++;
      if (!pkgScripts.has(m[1])) problem('npm 스크립트 없음', `npm run ${m[1]}`);
    }

    // 4. 따옴표 안 테스트 제목 (+ 문서 하단 제목)
    for (const q of checkQuotes(evidence, names)) {
      report.quotes++;
      if (q.found) {
        if (testFiles !== undefined) checkPair(q, refs, testFiles, report, warn);
        continue;
      }
      // 문서 제목: `docs/review/REV-….md 하단 "반영 내역 (…)"` — 바로 앞에 `하단`이 오면 앞에서 적은 .md 문서들 중 하나의 본문에 있어야 한다
      if (/하단\s*$/.test(evidence.slice(Math.max(0, q.at - 8), q.at))) {
        const docs = refs.filter((r) => q.at - r.end < 200 && r.end <= q.at).flatMap((r) => r.paths.filter((p) => p.endsWith('.md')));
        const segs = segmentsOf(q.text);
        if (docs.some((d) => inOrder((read(d) ?? '').replace(/\s+/g, ' '), segs))) continue;
      }
      problem('테스트 제목 없음', `"${q.text.length > 110 ? q.text.slice(0, 110) + '…' : q.text}"`);
    }
  });
  return report;
}
