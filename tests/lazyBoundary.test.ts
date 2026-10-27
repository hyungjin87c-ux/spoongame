import { describe, expect, it } from 'vitest';

/**
 * 지연 로드 경계 잠금 (SPEC-004 MG8): 첫 화면 초기 로드(≤ 400,000B)를 지키려면 이벤트 풀(JSON 5개)과 출생 연도 표가 **첫 덩어리에 들어가면 안 된다.**
 * 앱 진입점(`src/main.tsx`)에서 **정적 import**만 따라가 닿는 파일 그래프를 만들고, 무거운 데이터 모듈에 닿는지 본다. (실제 번들 바이트는 e2e/initial-load.spec.ts가 잰다 —
 * 이 시험은 그 수치가 어긋나기 전에 「누가 정적으로 끌어왔는가」를 이름으로 알려 준다.)
 */

const fsSpec = 'node:fs';
const fs = (await import(/* @vite-ignore */ fsSpec)) as {
  readFileSync(path: URL, encoding: 'utf-8'): string;
  existsSync(path: URL): boolean;
  readdirSync(path: URL, opts: { withFileTypes: true }): Array<{ name: string; isDirectory(): boolean }>;
};
const at = (relative: string): URL => new URL(relative, import.meta.url);
const ROOT = '../';

/** 정적 import 문의 경로: `import … from 'x'`, `export … from 'x'`, `import 'x'` — 타입만 가져오는 것(`import type`·`export type`)과 동적 `import()`는 뺀다 */
function staticImports(source: string): string[] {
  const code = source.replace(/\/\*[^]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1');
  const out: string[] = [];
  for (const m of code.matchAll(/^\s*(import|export)\s+(type\s+)?([^'";]*?)\s*from\s*['"]([^'"]+)['"]/gm)) {
    if (m[2] !== undefined) continue; // import type / export type
    // `import { type A, type B } from` 처럼 이름이 모두 type이면 런타임 import가 아니다
    const names = m[3].match(/^\{([^}]*)\}$/);
    if (names !== null && names[1].split(',').map((n) => n.trim()).filter(Boolean).every((n) => n.startsWith('type '))) continue;
    out.push(m[4]);
  }
  for (const m of code.matchAll(/^\s*import\s*['"]([^'"]+)['"]/gm)) out.push(m[1]);
  return out;
}

const EXTS = ['', '.ts', '.tsx', '.json', '/index.ts', '/index.tsx'];
function resolve(from: string, spec: string): string | null {
  if (!spec.startsWith('.')) return null; // 외부 패키지(react 등)는 보지 않는다
  const base = new URL(spec, at(`${ROOT}${from}`)).pathname;
  const rootPath = at(ROOT).pathname;
  const rel = decodeURIComponent(base.slice(rootPath.length));
  for (const ext of EXTS) {
    const candidate = `${rel}${ext}`;
    if (/\.(ts|tsx|json|css|svg|png|webp|woff2)$/.test(candidate) && fs.existsSync(at(`${ROOT}${candidate}`))) return candidate;
  }
  return null;
}

/** 진입점에서 정적으로 닿는 파일 → 처음 끌어온 파일(경로 설명용) */
function reachable(entry: string): Map<string, string> {
  const seen = new Map<string, string>([[entry, '(진입점)']]);
  const queue = [entry];
  while (queue.length > 0) {
    const file = queue.shift()!;
    if (!/\.(ts|tsx)$/.test(file)) continue;
    for (const spec of staticImports(fs.readFileSync(at(`${ROOT}${file}`), 'utf-8'))) {
      const next = resolve(file, spec);
      if (next === null || seen.has(next)) continue;
      seen.set(next, file);
      queue.push(next);
    }
  }
  return seen;
}

function chain(seen: Map<string, string>, file: string): string {
  const parts = [file];
  for (let f = seen.get(file); f !== undefined && f !== '(진입점)'; f = seen.get(f)) parts.unshift(f);
  return parts.join(' ← ').replace(/src\//g, '');
}

const graph = reachable('src/main.tsx');
const HEAVY = [
  'src/data/events/index.ts',
  'src/data/events/infant.json',
  'src/data/events/school.json',
  'src/data/events/youth.json',
  'src/data/events/middle.json',
  'src/data/events/senior.json',
  'src/data/birthYearData.ts',
  'src/data/birthYearData.json',
  'src/data/citationsAccess.ts',
  'src/data/citations.json',
  'src/data/installAll.ts',
] as const;

describe('앱 진입점(main.tsx)의 정적 import 그래프 (MG8)', () => {
  it('그래프 계산이 실제로 돈다 — 공허 통과 방지: App·TitleScreen·core/session·core/storage에 닿는다', () => {
    expect(graph.size).toBeGreaterThan(60);
    for (const f of ['src/App.tsx', 'src/screens/TitleScreen.tsx', 'src/core/session.ts', 'src/core/storage.ts', 'src/data/gameData.ts', 'src/core/gameData.ts']) expect(graph.has(f), f).toBe(true);
  });

  it('이벤트 풀(index.ts·JSON 5개)·출생 연도 표·인용 테이블(citations.json)·installAll이 정적으로 닿지 않는다 — 닿으면 닿는 길을 이름으로 알려 준다', () => {
    const leaked = HEAVY.filter((f) => graph.has(f)).map((f) => chain(graph, f));
    expect(leaked, '첫 덩어리로 새는 무거운 데이터 (core는 core/gameData.ts의 eventPool()·birthYearTables()로 읽는다)').toEqual([]);
  });

  it('이 시험이 실제로 새는 길을 잡는다(변이 점검): 정적 import 한 줄을 더한 합성 소스는 그 경로를 돌려준다', () => {
    expect(staticImports("import { EVENT_POOL } from '../data/events';\nimport type { X } from './types';\nconst m = () => import('./later');\nexport * from './a';\nimport './side';\nimport { type A, type B } from './onlyTypes';")).toEqual(['../data/events', './a', './side']);
    expect(resolve('src/core/gentle.ts', '../data/events')).toBe('src/data/events/index.ts');
  });

  it('src/data/gameData.ts는 동적 import()로만 이벤트 풀·출생 연도 표·인용 테이블을 부른다', () => {
    const source = fs.readFileSync(at(`${ROOT}src/data/gameData.ts`), 'utf-8');
    expect(staticImports(source)).toEqual(['../core/gameData']);
    expect(source).toMatch(/import\('\.\/events'\)/);
    expect(source).toMatch(/import\('\.\/birthYearData'\)/);
    expect(source).toMatch(/import\('\.\/citationsAccess'\)/);
  });

  it('src 안에서 installAll.ts를 부르는 파일이 없다 — 시험·스크립트·하니스 전용이다', () => {
    const offenders: string[] = [];
    const walk = (dir: string): void => {
      for (const e of fs.readdirSync(at(`${ROOT}${dir}`), { withFileTypes: true })) {
        const p = `${dir}${e.name}`;
        if (e.isDirectory()) walk(`${p}/`);
        else if (/\.(ts|tsx)$/.test(p) && /installAll/.test(fs.readFileSync(at(`${ROOT}${p}`), 'utf-8').replace(/\/\*[^]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\/\/.*$/gm, ''))) offenders.push(p);
      }
    };
    walk('src/');
    expect(offenders).toEqual([]);
  });

  it('첫 화면 유휴 중 미리 받기가 없다: loadGameData를 부르는 곳은 「태어나기」·이어하기 복원 경로(App.tsx)뿐이고, requestIdleCallback·prefetch는 src에 없다', () => {
    const callers: string[] = [];
    const idle: string[] = [];
    const walk = (dir: string): void => {
      for (const e of fs.readdirSync(at(`${ROOT}${dir}`), { withFileTypes: true })) {
        const p = `${dir}${e.name}`;
        if (e.isDirectory()) walk(`${p}/`);
        else if (/\.(ts|tsx)$/.test(p)) {
          const code = fs.readFileSync(at(`${ROOT}${p}`), 'utf-8').replace(/\/\*[^]*?\*\//g, '').replace(/\/\/.*$/gm, '');
          if (/loadGameData\(/.test(code) && p !== 'src/data/gameData.ts') callers.push(p);
          if (/requestIdleCallback|rel=["']prefetch|<link[^>]+prefetch/.test(code)) idle.push(p);
        }
      }
    };
    walk('src/');
    expect(callers).toEqual(['src/App.tsx']);
    expect(idle).toEqual([]);
  });
});
