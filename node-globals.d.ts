/**
 * Node 전역 최소 선언: playwright.config.ts·playwright.prod.config.ts(process.env.CI)와 scripts/*(process.argv, process.exit, 문서 생성의 파일 쓰기·읽기, 목록 조회 실행)에서만 쓴다.
 * 이 파일은 tsconfig.node.json에만 들어 있다 — 브라우저 코드(src/)·tests/·e2e/를 검사하는 tsconfig.json에는 없으므로 src/에서 `process`를 쓰면 타입 오류다(R-049).
 * @types/node를 새 의존성으로 들이지 않으려고 필요한 모양만 적는다.
 */
declare const process: { env: Record<string, string | undefined>; argv: string[]; execPath: string; cwd(): string; exit(code?: number): never };

/** scripts/eventDistribution.ts·finalDistribution.ts(문서·표 생성)의 파일 쓰기, scripts/checkFinalDistribution.ts·checkTodoEvidence.ts(점검)의 파일 읽기·조회 — @types/node 없이 필요한 모양만 적는다. */
declare module 'node:fs' {
  export function writeFileSync(path: string, data: string, encoding: 'utf-8'): void;
  export function readFileSync(path: string, encoding: 'utf-8'): string;
  export function existsSync(path: string): boolean;
  export function readdirSync(path: string): string[];
  export function statSync(path: string): { isDirectory(): boolean };
}

/** scripts/checkTodoEvidence.ts: vitest·playwright의 테스트 목록(JSON)을 받아 온다 */
declare module 'node:child_process' {
  export function execFileSync(file: string, args: string[], options: { encoding: 'utf-8'; maxBuffer?: number }): string;
}
