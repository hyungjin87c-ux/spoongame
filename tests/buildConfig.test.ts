import { describe, expect, it } from 'vitest';
import lockRaw from '../package-lock.json?raw';
import nodeGlobalsRaw from '../node-globals.d.ts?raw';
import pkgRaw from '../package.json?raw';
import tsconfigRaw from '../tsconfig.json?raw';
import tsconfigNodeRaw from '../tsconfig.node.json?raw';

/**
 * R-049: 빌드·타입 검사 설정의 계약.
 *  - `vite-node`는 `build`·`sim`·`sim:1000`·`check:events` 등이 직접 쓰므로 vitest의 전이 의존에 기대지 않고 devDependencies에 선언한다(lock에 잠긴 버전 그대로).
 *  - Node 전역(`process` 등) 선언은 scripts·설정 전용 tsconfig(tsconfig.node.json)에만 들어 있고, 브라우저 코드(src/)를 검사하는 tsconfig.json에는 보이지 않는다.
 *    `typecheck`는 두 설정을 모두 검사한다.
 * (실제로 src/에서 process를 쓰면 `npm run typecheck`가 실패하는 것은 변형 실험으로 확인했다 — docs/review/REV-001-M3-2.md 하단 "반영 내역".)
 */
interface Pkg {
  scripts: Record<string, string>;
  devDependencies: Record<string, string>;
}
interface Lock {
  packages: Record<string, { version?: string; devDependencies?: Record<string, string> }>;
}
interface TsConfig {
  extends?: string;
  include?: string[];
  compilerOptions?: { types?: string[] };
}
const pkg = JSON.parse(pkgRaw) as Pkg;
const lock = JSON.parse(lockRaw) as Lock;
const tsconfig = JSON.parse(tsconfigRaw) as TsConfig;
const tsconfigNode = JSON.parse(tsconfigNodeRaw) as TsConfig;

describe('vite-node 선언 (R-049)', () => {
  it('devDependencies에 선언돼 있고, 선언 범위가 lock의 루트 선언과 같으며, lock이 잠근 버전이 그 범위를 만족한다', () => {
    const declared = pkg.devDependencies['vite-node'];
    expect(declared, 'package.json devDependencies에 vite-node').toMatch(/^\^?\d+\.\d+\.\d+$/);
    expect(lock.packages[''].devDependencies?.['vite-node'], 'lock 루트의 선언과 package.json이 같다(npm ci가 통과한다)').toBe(declared);
    const locked = lock.packages['node_modules/vite-node'].version!;
    const floor = declared.replace('^', '');
    expect(locked.split('.')[0], '같은 메이저').toBe(floor.split('.')[0]);
    const cmp = (a: string, b: string) => a.split('.').map(Number).reduce((acc, n, i) => acc || n - Number(b.split('.')[i]), 0);
    expect(cmp(locked, floor), '잠긴 버전이 선언한 최저 버전 이상').toBeGreaterThanOrEqual(0);
  });

  it('vite-node를 쓰는 스크립트가 있다 (선언이 쓰임새와 맞는다)', () => {
    const users = Object.entries(pkg.scripts).filter(([, cmd]) => cmd.includes('vite-node'));
    // check:dist(최종 재산 분포표가 낡았는지, R-085)·check:todo(TODO 근거 전수 대조, R-081)는 REV-001-M5-1에서 더했다
    // sim:1000(세 시대 × 두 전략 × 1000판 전체 파이프라인 수치 보고, SPEC-001 M6)은 M6에서 더했다
    // check:motifs(소재 목록 점검 — 형식·금지 패턴·원문 겹침, SPEC-003 M6c)는 M6c에서 더했다
    // check:citations·gen:citations(citations.json의 usedBy를 이벤트 JSON의 citation에서 만들어 맞는지 확인·재생성)·report:citations(시대별 정적 연결률·노출률 보고, SPEC-003 M7b)는 M7b에서 더했다
    // check:basis·gen:basis(근거 문서·CSV를 JSON에서 다시 만들어 맞는지 확인·재생성, SPEC-003 M6a-r2 R-148)는 M6a 검수 반영에서 더했다
    // check:economy(경제 모델 밸런스 점검 — 연령대별 순자산·부채·소득을 통계 목표와 견줌, SPEC-003 M5 EC7)는 M5 2a에서 더했다
    // sim:infant(영유아 0~7세 지표 보고 — 빈 해·기록 줄·선택지·마일스톤, SPEC-003 M7a IN2)는 M7a에서 더했다
    // report:time(시간 모델 측정 보고 — 판당 카드 수 분포·자연 분포·글자 수 실측·읽기 수준별 판 시간, SPEC-003 M8 LM2·LM7 · content-M8 6-5절)은 M8에서 더했다
    // report:notes(기록 카드 스케줄 보고 — 판당 카드 수·도달률·결정 카드와 같은 해 겹침, SPEC-003 M7c 완료 기준 1)는 M7c core에서 더했다
    // report:parent(부모 결정 보고 — 판당 부모·흘러감·본인 카드 수, 13~18세 본인 카드 0장 비율, 수저별 선택 분포, SPEC-005 QI5 PD12·TM3·PD13)는 QI5에서 더했다
    expect(users.map(([name]) => name).sort()).toEqual(['build', 'check:basis', 'check:citations', 'check:dist', 'check:economy', 'check:events', 'check:motifs', 'check:todo', 'gen:basis', 'gen:citations', 'report:citations', 'report:notes', 'report:parent', 'report:time', 'sim', 'sim:1000', 'sim:infant']);
  });
});

describe('tsconfig 분리: Node 전역은 scripts·설정 전용 (R-049)', () => {
  it('브라우저 쪽 tsconfig.json은 src·tests·e2e를 검사하고 Node 전역 선언·scripts 진입점·설정 파일을 포함하지 않는다', () => {
    const include = tsconfig.include ?? [];
    expect(include).toEqual(expect.arrayContaining(['src', 'tests', 'e2e']));
    expect(include).not.toContain('node-globals.d.ts');
    expect(include).not.toContain('scripts');
    for (const configFile of ['vite.config.ts', 'playwright.config.ts', 'playwright.prod.config.ts']) expect(include).not.toContain(configFile);
  });

  it('tsconfig.node.json은 tsconfig.json을 확장해 scripts·설정 파일·Node 전역 선언만 검사한다', () => {
    expect(tsconfigNode.extends).toBe('./tsconfig.json');
    expect(tsconfigNode.include).toEqual(
      expect.arrayContaining(['scripts', 'vite.config.ts', 'playwright.config.ts', 'playwright.prod.config.ts', 'node-globals.d.ts']),
    );
    expect(tsconfigNode.include).not.toContain('src');
  });

  it('typecheck는 두 설정을 모두 검사하고, build는 typecheck를 거친다', () => {
    expect(pkg.scripts.typecheck).toContain('-p tsconfig.json');
    expect(pkg.scripts.typecheck).toContain('-p tsconfig.node.json');
    expect(pkg.scripts.build.startsWith('npm run typecheck')).toBe(true);
  });

  it('Node 전역 선언은 process만 선언하고 설명이 어느 설정에서만 보이는지 밝힌다', () => {
    expect(nodeGlobalsRaw).toMatch(/declare const process:/);
    expect(nodeGlobalsRaw).toContain('tsconfig.node.json');
  });

  it('src/ 어디서도 process 같은 Node 전역을 쓰지 않는다 (브라우저 코드)', () => {
    const files = import.meta.glob('../src/**/*.{ts,tsx}', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;
    expect(Object.keys(files).length).toBeGreaterThan(20); // 글롭이 실제로 파일을 찾았다
    for (const [path, source] of Object.entries(files)) {
      // 주석·문자열 속의 언급은 제외하고 코드의 접근만 본다
      const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
      expect(code, path).not.toMatch(/\bprocess\.(env|argv|exit|cwd|platform)\b/);
    }
  });
});
