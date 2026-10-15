import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { checkTodo, playwrightEntries, relativeTo, testFilesOf, type Env, type PlaywrightSuite, type TestEntry } from './checkTodoEvidenceLib';

/**
 * docs/TODO.md 의 `[x]` 근거 전수 대조 (REV-001-M5-1 R-081).  실행: npm run check:todo   (새 의존성 없이 vite-node)
 * 무엇을 어떻게 대조하는지, 오탐 처리 규칙은 scripts/checkTodoEvidenceLib.ts 머리말에 있다.
 * 마일스톤마다 검수 요청 전에 돌린다 — 실패가 하나라도 있으면 종료 코드 1.
 *
 * 테스트 목록은 실행기에게 받는다: vitest list --json (tests/**), playwright test --list (e2e·e2e-prod). 브라우저는 띄우지 않고 서버도 켜지 않는다(목록만).
 * 목록에는 각 테스트가 있는 파일도 있다 — 따옴표 제목 바로 앞에 적힌 테스트 파일이 그 제목의 실제 파일과 다르면 **경고**한다(실패 아님, R-092).
 */
const TODO_PATH = process.argv[2] ?? 'docs/TODO.md';

function runNode(args: string[]): string {
  return execFileSync(process.execPath, args, { encoding: 'utf-8', maxBuffer: 256 * 1024 * 1024 });
}

/** playwright 설정 하나의 테스트 (전체 이름, 파일). dir은 그 설정의 testDir */
function listPlaywright(dir: string, config?: string): TestEntry[] {
  const args = ['node_modules/@playwright/test/cli.js', 'test', '--list', '--reporter=json', ...(config === undefined ? [] : ['-c', config])];
  const report = JSON.parse(runNode(args)) as { suites: PlaywrightSuite[]; errors?: unknown[] };
  if (report.errors !== undefined && report.errors.length > 0) throw new Error(`playwright 목록 오류: ${JSON.stringify(report.errors).slice(0, 300)}`);
  return playwrightEntries(report.suites, dir);
}

const nodeEnv: Env = {
  exists: (p) => existsSync(p),
  isDirectory: (p) => existsSync(p) && statSync(p).isDirectory(),
  list: (dir) => (existsSync(dir) && statSync(dir).isDirectory() ? readdirSync(dir) : []),
  read: (p) => (existsSync(p) ? readFileSync(p, 'utf-8') : null),
};

try {
  const todo = readFileSync(TODO_PATH, 'utf-8');
  const vitest: TestEntry[] = (JSON.parse(runNode(['node_modules/vitest/vitest.mjs', 'list', '--json'])) as Array<{ name: string; file: string }>).map((t) => ({
    name: t.name,
    file: relativeTo(process.cwd(), t.file),
  }));
  const e2e = listPlaywright('e2e');
  const e2eProd = listPlaywright('e2e-prod', 'playwright.prod.config.ts');
  const entries = [...vitest, ...e2e, ...e2eProd];
  const names = entries.map((e) => e.name);
  const pkg = JSON.parse(readFileSync('package.json', 'utf-8')) as { scripts: Record<string, string> };
  const report = checkTodo(todo, names, new Set(Object.keys(pkg.scripts)), nodeEnv, testFilesOf(entries));
  console.log(`테스트 목록: vitest ${vitest.length} + e2e ${e2e.length} + e2e-prod ${e2eProd.length} (이름 ${names.length}개)`);
  console.log(
    `[x] 항목 ${report.items}개 대조: 파일 경로 ${report.paths}, 심볼 ${report.symbols}, npm 스크립트 ${report.scripts}, 따옴표 속 테스트 제목 ${report.quotes} (제목-파일 짝 ${report.pairs}) → 실패 ${report.problems.length}, 경고 ${report.warnings.length}`,
  );
  // 경고(제목-파일 짝, R-092)는 종료 코드를 바꾸지 않는다. 목록은 0으로 유지한다.
  for (const w of report.warnings) console.warn(`  ${TODO_PATH}:${w.line} [경고 ${w.kind}] ${w.detail}`);
  if (report.problems.length > 0) {
    for (const p of report.problems) console.error(`  ${TODO_PATH}:${p.line} [${p.kind}] ${p.detail}`);
    console.error('TODO 근거 대조 실패: 위 항목을 실제 파일·심볼·테스트 제목에 맞게 고친다.');
    process.exit(1);
  }
  console.log(report.warnings.length === 0 ? 'TODO 근거 대조 통과 (경고 0)' : `TODO 근거 대조 통과 (경고 ${report.warnings.length}건: 위 목록을 고친다)`);
} catch (error) {
  console.error('TODO 근거 대조를 실행하지 못했다:', error instanceof Error ? error.message : String(error));
  process.exit(1);
}
