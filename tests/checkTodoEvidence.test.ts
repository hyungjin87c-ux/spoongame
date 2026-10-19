import { describe, expect, it } from 'vitest';
import todoRaw from '../docs/TODO.md?raw';
import {
  checkQuotes,
  checkTodo,
  evidenceChunks,
  expandBraces,
  inOrder,
  isTestFile,
  pathExists,
  parseSymbols,
  playwrightEntries,
  playwrightNames,
  relativeTo,
  segmentsOf,
  siblingNames,
  testFilesOf,
  type Env,
} from '../scripts/checkTodoEvidenceLib';

/**
 * docs/TODO.md `[x]` 근거 전수 대조(REV-001-M5-1 R-081, `npm run check:todo`)의 규칙을 가짜 저장소로 확인한다.
 * 실제 TODO를 실제 파일·테스트 목록과 대조하는 것은 `npm run check:todo`가 한다(실행기를 띄워 목록을 받는다).
 */

/** 파일 경로 -> 내용. 폴더는 경로 앞부분으로 저절로 생긴다. */
function fakeEnv(files: Record<string, string>): Env {
  const paths = Object.keys(files);
  const dirs = new Set<string>(['.']);
  for (const p of paths) {
    const parts = p.split('/');
    for (let i = 1; i < parts.length; i++) dirs.add(parts.slice(0, i).join('/'));
  }
  return {
    exists: (p) => p in files || dirs.has(p),
    isDirectory: (p) => dirs.has(p),
    list: (dir) => {
      const prefix = dir === '.' ? '' : `${dir}/`;
      return [...new Set(paths.filter((p) => p.startsWith(prefix)).map((p) => p.slice(prefix.length).split('/')[0]))];
    },
    read: (p) => files[p] ?? null,
  };
}

const NAMES = [
  '묶음 A > 첫 테스트: 값이 같다 (R-001)',
  '묶음 A > 둘째 테스트에는 "인용"이 들어 있다',
  '360x568: 풀의 모든 선택지 — 가려지지 않는다 (R-042)',
  '프로덕션 번들: "다음 결정으로" → 첫 선택지 선택을 되풀이해 사망(엔딩 화면)까지 간다 (R-051, M5)',
  '목표 시간 (R-042): 평균이 약 7~10.5분 (SPEC "10분 내외"의 하단, 최종 판정은 M6 사람 실측)',
];

describe('근거 대조: 따옴표 글 -> 와일드카드 조각 (segmentsOf·inOrder)', () => {
  it('…·...·${…}·<…>는 조각 사이의 와일드카드다', () => {
    expect(segmentsOf('앞 … 뒤')).toEqual(['앞', '뒤']);
    expect(segmentsOf('앞...뒤')).toEqual(['앞', '뒤']);
    expect(segmentsOf('${vp.width}x${vp.height}: 제목')).toEqual(['x', ': 제목']);
    expect(segmentsOf('<뷰포트>: 제목 <25|50|75>% 지점')).toEqual([': 제목', '% 지점']);
    expect(segmentsOf('…')).toEqual([]);
    expect(segmentsOf('  공백   정리  ')).toEqual(['공백 정리']);
  });

  it('조각은 한 이름 안에서 순서대로 나와야 한다', () => {
    expect(inOrder('가나다라마', ['가', '다', '마'])).toBe(true);
    expect(inOrder('가나다라마', ['다', '가'])).toBe(false);
    expect(inOrder('가나다라마', ['가나다라마', '바'])).toBe(false);
    expect(inOrder('가나다', [])).toBe(true);
  });
});

describe('근거 대조: 따옴표 짝 (checkQuotes)', () => {
  const found = (evidence: string) => checkQuotes(evidence, NAMES).map((q) => q.found);

  it('이름의 일부(앞·뒤·가운데)와 생략 표시(…)도 찾는다', () => {
    expect(found('"첫 테스트: 값이 같다 (R-001)"')).toEqual([true]);
    expect(found('"첫 테스트 … (R-001)"')).toEqual([true]);
    expect(found('"묶음 A"')).toEqual([true]);
  });

  it('템플릿 제목은 전개된 이름과 맞는다: ${…}와 <뷰포트> 자리 표시', () => {
    expect(found('"${vp.width}x${vp.height}: 풀의 모든 선택지 — 가려지지 않는다 (R-042)"')).toEqual([true]);
    expect(found('"<뷰포트>: 풀의 모든 선택지 — 가려지지 않는다 (R-042)"')).toEqual([true]);
  });

  it('이스케이프한 따옴표(\\")는 짝에서 건너뛰고 비교 때 "로 되돌린다', () => {
    expect(found('"둘째 테스트에는 \\"인용\\"이 들어 있다"')).toEqual([true]);
  });

  it('이름 안에 이스케이프 없는 따옴표가 있어도 가장 긴 후보부터 맞춰 한 덩어리로 찾는다 (SPEC "10분 내외"의 하단)', () => {
    const r = checkQuotes('"목표 시간 (R-042): 평균이 약 7~10.5분 (SPEC "10분 내외"의 하단, 최종 판정은 M6 사람 실측)"', NAMES);
    expect(r).toHaveLength(1);
    expect(r[0].found).toBe(true);
    expect(r[0].text).toContain('"10분 내외"');
  });

  it('바뀐 제목은 못 찾는다: 예전 "(엔딩 자리표시)"', () => {
    const r = checkQuotes('"을 되풀이해 사망(엔딩 자리표시)까지 간다"', NAMES);
    expect(r.map((q) => q.found)).toEqual([false]);
    expect(found('"을 되풀이해 사망(엔딩 화면)까지 간다"')).toEqual([true]);
  });

  it('여러 개: 맞는 것과 틀린 것이 각각 판정된다', () => {
    expect(found('"첫 테스트" 와 "없는 테스트" 와 "묶음 A"')).toEqual([true, false, true]);
  });

  it('짝이 없는 따옴표는 못 찾음으로 보고한다', () => {
    expect(found('"짝이 없는')).toEqual([false]);
  });
});

describe('근거 대조: 경로·심볼 도우미', () => {
  it('expandBraces: 묶음을 펼친다 (중첩·여러 묶음 포함)', () => {
    expect(expandBraces('a/b.ts')).toEqual(['a/b.ts']);
    expect(expandBraces('.claude/agents/{planner,qa}.md')).toEqual(['.claude/agents/planner.md', '.claude/agents/qa.md']);
    expect(expandBraces('x/{a,b}/{c,d}.ts')).toEqual(['x/a/c.ts', 'x/a/d.ts', 'x/b/c.ts', 'x/b/d.ts']);
  });

  it('parseSymbols: / 로 이어진 목록, 괄호 설명(중첩 포함)은 건너뛴다, a.b는 한 심볼, 다음 낱말에서 멈춘다', () => {
    expect(parseSymbols('#a/b/c, 다음', 1).symbols).toEqual(['a', 'b', 'c']);
    expect(parseSymbols('#fn(설명 (중첩) 있음)/other/last(끝)·다음', 1).symbols).toEqual(['fn', 'other', 'last']);
    expect(parseSymbols('#ERA_CONFIG.life(시대별)/next', 1).symbols).toEqual(['ERA_CONFIG.life', 'next']);
    expect(parseSymbols('#only 그 다음 글', 1).symbols).toEqual(['only']);
    expect(parseSymbols('#open(닫히지 않는 괄호', 1).symbols).toEqual(['open']); // 닫히지 않은 괄호에서 멈춘다(무한 루프 없음)
  });

  it('parseSymbols(R-397): #로 이어 적은 심볼(#a#b#c)과 ·로 이은 심볼(#a·b)도 모두 읽고, ·가 경로·형제 파일을 이은 것이면 심볼로 읽지 않는다', () => {
    expect(parseSymbols('#a#b#c, 다음', 1).symbols).toEqual(['a', 'b', 'c']);
    expect(parseSymbols('#fn(설명)#other(설명 (중첩))#last 그 다음', 1).symbols).toEqual(['fn', 'other', 'last']);
    expect(parseSymbols('#a·b·c 다음', 1).symbols).toEqual(['a', 'b', 'c']);
    expect(parseSymbols('#a/b#c·d', 1).symbols).toEqual(['a', 'b', 'c', 'd']); // 이음 세 가지를 섞어도
    // 경로·형제 파일을 이은 ·는 심볼이 아니다
    expect(parseSymbols('#a·other.test.ts', 1).symbols).toEqual(['a']);
    expect(parseSymbols('#a·src/core/x.ts', 1).symbols).toEqual(['a']);
    expect(parseSymbols('#a·docs/review/B.md(R-2)', 1).symbols).toEqual(['a']);
    expect(parseSymbols('#a·dev-M5-ending-desktop.png', 1).symbols).toEqual(['a']);
    // 이음 다음이 영문자가 아니면(한글 설명·숫자) 멈춘다
    expect(parseSymbols('#a#1, #b·다음', 1).symbols).toEqual(['a']);
    expect(parseSymbols('#a·다음 글', 1).symbols).toEqual(['a']);
  });

  it('siblingNames: 경로 뒤 ·이름.확장자 (괄호 설명은 건너뛴다)', () => {
    expect(siblingNames('·b.png·c.png 끝', 0)).toEqual({ names: ['b.png', 'c.png'], end: 12 });
    expect(siblingNames('(R-1)·B.md(R-2)·C.md(R-3) 하단', 0).names).toEqual(['B.md', 'C.md']);
    expect(siblingNames(' 공백이면 아니다', 0).names).toEqual([]);
  });

  it('pathExists: 파일·폴더·글롭(*, **)', () => {
    const env = fakeEnv({ 'src/data/events/a.json': '{}', 'src/data/events/b.json': '{}', 'tests/x/deep/y.test.ts': '', 'package.json': '{}' });
    expect(pathExists(env, 'package.json')).toBe(true);
    expect(pathExists(env, 'src/data/events')).toBe(true);
    expect(pathExists(env, 'src/data/events/*.json')).toBe(true);
    expect(pathExists(env, 'src/data/events/*.md')).toBe(false);
    expect(pathExists(env, 'tests/**')).toBe(true);
    expect(pathExists(env, 'tests/**/*.test.ts')).toBe(true);
    expect(pathExists(env, 'nope/*.ts')).toBe(false);
    expect(pathExists(env, 'src/missing.ts')).toBe(false);
  });

  it('playwrightNames: 파일 제목을 빼고 묶음 > 테스트로 잇고, 프로젝트별 중복은 하나다', () => {
    const suites = [{ title: 'a.spec.ts', specs: [{ title: '루트 테스트' }], suites: [{ title: '묶음', specs: [{ title: '안 테스트' }, { title: '안 테스트' }] }] }];
    expect(playwrightNames(suites).sort()).toEqual(['루트 테스트', '묶음 > 안 테스트']);
  });
});

describe('근거 대조: 제목-파일 짝 도우미 (R-092)', () => {
  it('playwrightEntries: 이름은 playwrightNames와 같고, 파일은 설정의 testDir + 최상위 묶음의 파일이다 (e2e·e2e-prod)', () => {
    const suites = [
      { title: 'a.spec.ts', file: 'a.spec.ts', specs: [{ title: '루트 테스트' }], suites: [{ title: '묶음', specs: [{ title: '안 테스트' }] }] },
      { title: 'b.spec.ts', specs: [{ title: '파일 속성이 없으면 제목이 파일이다' }] },
    ];
    expect(playwrightEntries(suites, 'e2e')).toEqual([
      { name: '루트 테스트', file: 'e2e/a.spec.ts' },
      { name: '묶음 > 안 테스트', file: 'e2e/a.spec.ts' },
      { name: '파일 속성이 없으면 제목이 파일이다', file: 'e2e/b.spec.ts' },
    ]);
    expect(playwrightEntries(suites, 'e2e-prod')[0].file).toBe('e2e-prod/a.spec.ts');
    expect(playwrightEntries(suites, 'e2e').map((e) => e.name)).toEqual(playwrightNames(suites));
  });

  it('relativeTo: vitest의 절대 경로(슬래시·역슬래시)를 저장소 루트 기준으로 바꾼다, 루트 밖이면 그대로', () => {
    expect(relativeTo('C:/work/repo', 'C:/work/repo/tests/a.test.ts')).toBe('tests/a.test.ts');
    expect(relativeTo('C:\\work\\repo\\', 'C:\\work\\repo\\tests\\a.test.ts')).toBe('tests/a.test.ts');
    expect(relativeTo('/work/repo', '/other/tests/a.test.ts')).toBe('/other/tests/a.test.ts');
    expect(relativeTo('/work/repo', '/work/repo2/tests/a.test.ts')).toBe('/work/repo2/tests/a.test.ts'); // 접두사만 같은 다른 폴더
  });

  it('testFilesOf: 같은 이름이 여러 파일에 있으면 파일 집합으로 모은다, 이름의 공백은 하나로', () => {
    const m = testFilesOf([
      { name: '묶음  >  같은 제목', file: 'tests/a.test.ts' },
      { name: '묶음 > 같은 제목', file: 'e2e/c.spec.ts' },
      { name: '다른 제목', file: 'tests/a.test.ts' },
    ]);
    expect([...m.keys()]).toEqual(['묶음 > 같은 제목', '다른 제목']);
    expect([...m.get('묶음 > 같은 제목')!].sort()).toEqual(['e2e/c.spec.ts', 'tests/a.test.ts']);
  });

  it('isTestFile: tests/…test.ts(x), e2e/…spec.ts, e2e-prod/…spec.ts만. 글롭·소스·문서·하니스는 아니다', () => {
    for (const p of ['tests/a.test.ts', 'tests/guard.test.tsx', 'tests/helpers/x.test.ts', 'e2e/ending.spec.ts', 'e2e-prod/smoke.spec.ts']) expect(isTestFile(p), p).toBe(true);
    for (const p of ['tests/*.test.ts', 'tests/**', 'tests/helpers/stats.ts', 'e2e/helpers.ts', 'src/core/a.ts', 'harness/guard.tsx', 'docs/TODO.md', 'scripts/a.test.ts']) expect(isTestFile(p), p).toBe(false);
  });
});

describe('근거 대조: TODO 전체 (checkTodo)', () => {
  const env = fakeEnv({
    'src/core/a.ts': 'export function alpha() {}\nexport const BETA = 1;\n',
    'src/data/events/x.json': '{ "meta": { "attribution": "x" } }',
    'tests/a.test.ts': '',
    'docs/review/REV-1.md': '# 제목\n## 반영 내역 (developer, M5 / 2026-10-14)\n',
    'docs/review/REV-2.md': '# 제목\n',
    'package.json': '{}',
  });
  const scripts = new Set(['build', 'check:todo']);
  const run = (todo: string) => checkTodo(todo, NAMES, scripts, env);
  const kinds = (todo: string) => run(todo).problems.map((p) => p.kind);

  it('모두 맞으면 문제가 없고, 센 개수가 나온다', () => {
    const r = run(
      [
        '# TODO',
        '- [x] 기능 — 근거: src/core/a.ts#alpha/BETA, src/data/events/*.json, tests/a.test.ts "첫 테스트 … (R-001)", package.json scripts.build, `npm run check:todo`',
        '- [ ] 아직 안 한 것 — 근거: src/없는/파일.ts "없는 제목"',
      ].join('\n'),
    );
    expect(r.problems).toEqual([]);
    expect(r.items).toBe(1); // [ ] 항목은 보지 않는다
    expect(r.symbols).toBe(2);
    expect(r.scripts).toBe(2);
    expect(r.quotes).toBe(1);
    expect(r.paths).toBeGreaterThanOrEqual(4);
  });

  it('없는 파일·없는 심볼·없는 테스트 제목·없는 npm 스크립트를 각각 잡는다', () => {
    expect(kinds('- [x] 가 — 근거: src/core/missing.ts')).toEqual(['파일 없음']);
    expect(kinds('- [x] 가 — 근거: src/core/a.ts#alpha/gamma')).toEqual(['심볼 없음']);
    expect(kinds('- [x] 가 — 근거: tests/a.test.ts "없는 제목"')).toEqual(['테스트 제목 없음']);
    expect(kinds('- [x] 가 — 근거: package.json scripts.nope')).toEqual(['npm 스크립트 없음']);
    expect(kinds('- [x] 가 — 근거: npm run nope')).toEqual(['npm 스크립트 없음']);
  });

  it('조사가 붙은 경로("src/core/a.ts에서")는 조사를 자르고 찾는다', () => {
    expect(kinds('- [x] 가 — 근거: src/core/a.ts에서 쓴다')).toEqual([]);
    expect(kinds('- [x] 가 — 근거: src/core/missing.ts의 함수')).toEqual(['파일 없음']);
  });

  it('{a,b} 묶음은 각각, 형제 파일(·이름)도 같은 폴더에서 찾는다', () => {
    const e = fakeEnv({ 'docs/a.md': '', 'docs/c.md': '' });
    const missing = (todo: string) => checkTodo(todo, NAMES, scripts, e).problems.map((p) => p.detail.split('   ')[0]);
    expect(missing('- [x] 가 — 근거: docs/{a,b}.md')).toEqual(['docs/b.md']);
    expect(missing('- [x] 가 — 근거: docs/a.md(설명)·c.md(설명)·d.md')).toEqual(['docs/d.md']);
  });

  it('"구 …/Old.tsx 삭제"처럼 없앴다고 적은 경로는 없어야 통과한다', () => {
    const e = fakeEnv({ 'src/old.tsx': '' });
    expect(checkTodo('- [x] 가 — 근거: 구 src/gone.tsx 삭제', NAMES, scripts, e).problems).toEqual([]);
    expect(checkTodo('- [x] 가 — 근거: (구 src/old.tsx 삭제)', NAMES, scripts, e).problems.map((p) => p.kind)).toEqual(['삭제했다고 적은 파일이 있음']);
  });

  it('문서 소제목: "docs/….md 하단 "…""은 테스트 제목이 아니라 그 문서(들) 안에서 찾는다', () => {
    expect(kinds('- [x] 가 — 근거: docs/review/REV-1.md 하단 "반영 내역 (developer, M5 / 2026-10-14)"')).toEqual([]);
    expect(kinds('- [x] 가 — 근거: docs/review/REV-2.md 하단 "반영 내역 (developer, M5 / 2026-10-14)"')).toEqual(['테스트 제목 없음']);
    // 형제 문서 중 하나에만 있어도 통과
    expect(kinds('- [x] 가 — 근거: docs/review/REV-2.md(R-1)·REV-1.md(R-2) 하단 "반영 내역 (developer, M5 / 2026-10-14)"')).toEqual([]);
  });

  it('"하단" 표지가 없는 따옴표는 문서가 아니라 테스트 목록에서만 찾는다', () => {
    expect(kinds('- [x] 가 — 근거: docs/review/REV-1.md "반영 내역 (developer, M5 / 2026-10-14)"')).toEqual(['테스트 제목 없음']);
  });

  it('근거가 없는 [x]는 실패다 (CLAUDE.md 3절)', () => {
    expect(kinds('- [x] 근거 없이 체크')).toEqual(['근거 없음']);
  });

  it('항목 설명("근거:" 앞)의 따옴표는 대조하지 않는다', () => {
    expect(kinds('- [x] "없는 이름"이라는 설명 — 근거: src/core/a.ts')).toEqual([]);
  });

  it('이어 적은 심볼도 모두 대조한다 (R-397): #a#b의 둘째 심볼이 없으면 심볼 없음, #a·b의 둘째·#a/b#c·d의 뒤쪽도 같다', () => {
    expect(kinds('- [x] 가 — 근거: src/core/a.ts#alpha#BETA')).toEqual([]);
    expect(kinds('- [x] 가 — 근거: src/core/a.ts#alpha#gone')).toEqual(['심볼 없음']);
    expect(kinds('- [x] 가 — 근거: src/core/a.ts#alpha#BETA#gone')).toEqual(['심볼 없음']);
    expect(kinds('- [x] 가 — 근거: src/core/a.ts#alpha·gone')).toEqual(['심볼 없음']);
    expect(kinds('- [x] 가 — 근거: src/core/a.ts#alpha/BETA#gone·BETA')).toEqual(['심볼 없음']);
    expect(run('- [x] 가 — 근거: src/core/a.ts#alpha(설명)#gone(설명)').problems.map((p) => p.detail.split('   ')[0])).toEqual(['src/core/a.ts#gone']);
    // 모두 있으면 통과하고 센 심볼 수에 들어간다
    const ok = run('- [x] 가 — 근거: src/core/a.ts#alpha#BETA·alpha');
    expect(ok.problems).toEqual([]);
    expect(ok.symbols).toBe(3);
  });

  it('·가 경로·형제 파일을 이은 것은 심볼이 아니다 — 형제 파일 줄임(a.ts#sym·b.test.ts)과 다음 경로(#sym·src/…)를 심볼로 오해하지 않는다', () => {
    const e = fakeEnv({ 'src/core/a.ts': 'export function alpha() {}\n', 'tests/a.test.ts': '', 'tests/b.test.ts': '' });
    const r = checkTodo('- [x] 가 — 근거: src/core/a.ts#alpha·tests/a.test.ts·b.test.ts', NAMES, scripts, e);
    expect(r.problems).toEqual([]);
    expect(r.symbols).toBe(1);
  });

  it('실제 TODO.md(R-397): 이어 적은 심볼(#a#b·#a·b)이 든 [x] 줄이 실제로 있고(공허 통과 방지) 둘째 이후 심볼까지 읽힌다 — 옛 구현은 첫 심볼만 셌다', () => {
    let chained = 0;
    let extra = 0;
    for (const line of todoRaw.split(/\r?\n/)) {
      if (!/^\s*- \[x\]/i.test(line)) continue;
      for (const m of line.matchAll(/[\w./-]+\.(?:ts|tsx|json)#/g)) {
        const { symbols } = parseSymbols(line, (m.index ?? 0) + m[0].length);
        if (symbols.length > 1) {
          chained++;
          extra += symbols.length - 1;
        }
      }
    }
    expect(chained, '심볼을 이어 적은 근거').toBeGreaterThanOrEqual(30);
    expect(extra, '옛 구현이 대조하지 않던 둘째 이후 심볼').toBeGreaterThanOrEqual(100);
  });

  it('보고에는 줄 번호와 항목 머리가 들어 있다', () => {
    const r = run('# 제목\n\n- [x] 여기 항목 — 근거: src/core/missing.ts');
    expect(r.problems[0].line).toBe(3);
    expect(r.problems[0].detail).toContain('여기 항목');
  });
});

describe('근거 대조: [x] 바로 밑의 들여쓴 하위 줄도 근거다 (REV-003-M7b-1 R-389)', () => {
  const env = fakeEnv({ 'src/core/a.ts': 'export function alpha() {}\n', 'tests/a.test.ts': '', 'package.json': '{}' });
  const scripts = new Set(['build', 'check:todo']);
  const run = (todo: string) => checkTodo(todo, NAMES, scripts, env);
  const todoOf = (...lines: string[]) => ['# TODO', ...lines].join('\n');

  it('하위 줄의 없는 파일·심볼·시험 제목·npm 스크립트를 잡고, 줄 번호는 그 하위 줄이다 (옛 검사는 [x] 줄만 읽어 놓쳤다)', () => {
    const r = run(
      todoOf(
        '- [x] 머리 — 근거: (developer 기록)', // 2행: 근거는 하위 줄에 있다
        '    - 시험: tests/a.test.ts "첫 테스트 … (R-001)", "없는 제목"', // 3행
        '    - 파일: src/core/a.ts#alpha/gamma, src/core/missing.ts, `npm run nope`', // 4행
      ),
    );
    expect(r.items).toBe(1);
    expect(r.problems.map((p) => `${p.line}:${p.kind}`).sort()).toEqual(['3:테스트 제목 없음', '4:npm 스크립트 없음', '4:파일 없음', '4:심볼 없음'].sort());
    expect(r.quotes).toBe(2);
  });

  it('하위 줄이 모두 맞으면 문제가 없고, 센 개수에 하위 줄이 들어간다', () => {
    const r = run(
      todoOf('- [x] 머리 — 근거: package.json', '    - 시험: tests/a.test.ts "첫 테스트 … (R-001)"', '    - 함수: src/core/a.ts#alpha, `npm run check:todo`'),
    );
    expect(r.problems).toEqual([]);
    expect(r.quotes).toBe(1);
    expect(r.symbols).toBe(1);
    expect(r.scripts).toBe(1);
  });

  it('[x] 줄에 「근거:」가 없어도 하위 줄에 있으면 거기서부터 근거다. 그 앞 하위 줄(설명)은 대조하지 않는다. 어디에도 없으면 「근거 없음」', () => {
    const ok = run(todoOf('- [x] 머리(근거는 아래)', '    - 설명: src/없는/파일.ts "없는 제목"', '    - 근거: src/core/a.ts#alpha', '    - 시험: tests/a.test.ts "첫 테스트 … (R-001)"'));
    expect(ok.problems).toEqual([]);
    const bad = run(todoOf('- [x] 머리(근거는 아래)', '    - 근거: src/core/a.ts#alpha', '    - 시험: tests/a.test.ts "없는 제목"'));
    expect(bad.problems.map((p) => `${p.line}:${p.kind}`)).toEqual(['4:테스트 제목 없음']);
    expect(run(todoOf('- [x] 머리', '    - 그냥 설명 src/없는/파일.ts')).problems.map((p) => p.kind)).toEqual(['근거 없음']);
  });

  it('같은 들여쓰기의 다음 항목·빈 줄 뒤의 글은 하위 줄이 아니다 (이웃 항목의 근거를 이 항목의 것으로 읽지 않는다)', () => {
    const r = run(todoOf('- [x] 하나 — 근거: package.json', '- [ ] 이웃(안 한 것) — 근거: src/없는/파일.ts', '', '    - 빈 줄 뒤 들여쓴 글 src/없는/파일2.ts', '- [x] 둘 — 근거: src/core/a.ts'));
    expect(r.problems).toEqual([]);
    expect(r.items).toBe(2);
  });

  it('체크 상자가 있는 하위 항목은 따로 항목이다: [ ]는 읽지 않고 그 아래도 건너뛰며, [x]는 자기 줄로 대조한다. 그 뒤의 일반 하위 줄은 다시 부모의 근거다', () => {
    const r = run(
      todoOf(
        '- [x] 부모 — 근거: package.json',
        '    - [ ] 아직 안 한 하위 — 근거: src/없는/파일.ts "없는 제목"',
        '        - 그 아래 글 src/없는/파일3.ts',
        '    - [x] 한 하위 — 근거: src/core/a.ts#alpha',
        '    - 부모의 하위 줄 src/core/missing.ts',
      ),
    );
    expect(r.items).toBe(2);
    expect(r.problems.map((p) => `${p.line}:${p.kind}`)).toEqual(['6:파일 없음']);
  });

  it('실제 TODO.md: [x] 항목 아래 들여쓴 하위 줄에 근거가 있는 항목이 실제로 있고(공허 통과 방지) 그 줄들이 근거 줄로 읽힌다', () => {
    const lines = todoRaw.split(/\r?\n/);
    const withSubs = lines
      .map((l, i) => ({ l, i }))
      .filter(({ l }) => /^\s*- \[x\]/i.test(l))
      .filter(({ i }) => evidenceChunks(lines, i).some((c) => c.line - 1 !== i));
    expect(withSubs.length, '하위 줄을 근거로 읽는 [x] 항목').toBeGreaterThanOrEqual(1);
    for (const { i } of withSubs) {
      const chunks = evidenceChunks(lines, i);
      expect(chunks[0].line, '첫 근거 줄은 [x] 줄 자신이거나 그 아래다').toBeGreaterThanOrEqual(i + 1);
      for (const c of chunks.slice(1)) expect(lines[c.line - 1].trimStart().startsWith('- ['), `${c.line}행은 체크 상자 줄이 아니다`).toBe(false);
    }
  });
});

describe('근거 대조: 제목-파일 짝 경고 (checkTodo, R-092) — 실패가 아니라 경고', () => {
  const env = fakeEnv({ 'tests/a.test.ts': '', 'tests/b.test.ts': '', 'e2e/c.spec.ts': '', 'src/x.ts': '', 'harness/guard.tsx': '' });
  const entries = [
    { name: '묶음 A > 첫 테스트', file: 'tests/a.test.ts' },
    { name: '묶음 B > 둘째 테스트', file: 'tests/b.test.ts' },
    { name: '화면 > 두 파일에 있는 제목', file: 'tests/a.test.ts' },
    { name: '화면 > 두 파일에 있는 제목', file: 'e2e/c.spec.ts' },
    { name: '다음 결정으로 (advanceUntilDecision)', file: 'tests/b.test.ts' },
  ];
  const names = entries.map((e) => e.name);
  const files = testFilesOf(entries);
  const scripts = new Set<string>();
  const run = (todo: string, withFiles = true) => checkTodo(todo, names, scripts, env, withFiles ? files : undefined);

  it('맞는 짝은 경고가 없다: 파일 다음에 그 파일의 제목들', () => {
    const r = run('- [x] 가 — 근거: tests/a.test.ts "첫 테스트", tests/b.test.ts "둘째 테스트"; e2e/c.spec.ts "두 파일에 있는 제목"');
    expect(r.problems).toEqual([]);
    expect(r.warnings).toEqual([]);
    expect(r.pairs).toBe(3);
  });

  it('틀린 짝은 경고다 — 실패(problems)가 아니다: 제목은 실제로 있으나 엉뚱한 파일 뒤에 적었다', () => {
    const r = run('- [x] 가 — 근거: tests/a.test.ts "둘째 테스트"');
    expect(r.problems).toEqual([]); // 존재 대조는 통과
    expect(r.warnings).toHaveLength(1);
    expect(r.warnings[0].kind).toBe('제목-파일 짝');
    expect(r.warnings[0].detail).toContain('tests/a.test.ts');
    expect(r.warnings[0].detail).toContain('tests/b.test.ts'); // 실제 파일
    expect(r.warnings[0].line).toBe(1);
  });

  it('REV-001-M5-2 R-092의 사례: 사이에 다른 종류의 경로(소스·하니스)가 끼어도 가장 가까운 "테스트 파일"을 기준으로 잡는다', () => {
    const r = run('- [x] 가 — 근거: e2e/c.spec.ts "두 파일에 있는 제목"(하니스 harness/guard.tsx의 버튼, src/x.ts), "다음 결정으로 (advanceUntilDecision)"');
    expect(r.warnings).toHaveLength(1);
    expect(r.warnings[0].detail).toContain('e2e/c.spec.ts');
    expect(r.warnings[0].detail).toContain('tests/b.test.ts');
    // 같은 제목을 맞는 파일 뒤에 두면 경고가 없다
    expect(run('- [x] 가 — 근거: e2e/c.spec.ts "두 파일에 있는 제목"; tests/b.test.ts "다음 결정으로 (advanceUntilDecision)"').warnings).toEqual([]);
  });

  it('같은 제목이 여러 파일에 있으면 그중 어느 파일 뒤에 적어도 통과한다', () => {
    expect(run('- [x] 가 — 근거: tests/a.test.ts "두 파일에 있는 제목"').warnings).toEqual([]);
    expect(run('- [x] 가 — 근거: e2e/c.spec.ts "두 파일에 있는 제목"').warnings).toEqual([]);
    expect(run('- [x] 가 — 근거: tests/b.test.ts "두 파일에 있는 제목"').warnings).toHaveLength(1);
  });

  it('형제 파일 줄임(a.test.ts·b.test.ts)은 둘 다 기준이다', () => {
    expect(run('- [x] 가 — 근거: tests/a.test.ts·b.test.ts "둘째 테스트"').warnings).toEqual([]);
    expect(run('- [x] 가 — 근거: tests/a.test.ts(설명)·b.test.ts(설명) "첫 테스트", "둘째 테스트"').warnings).toEqual([]);
  });

  it('앞에 테스트 파일이 없으면(소스·문서만 있거나 글롭뿐) 짝을 대조하지 않는다', () => {
    const r = run('- [x] 가 — 근거: src/x.ts "둘째 테스트"; tests/*.test.ts "첫 테스트"');
    expect(r.warnings).toEqual([]);
    expect(r.pairs).toBe(0);
  });

  it('파일 목록을 주지 않으면 이 점검을 건너뛴다 (기존 호출과 같다)', () => {
    const r = run('- [x] 가 — 근거: tests/a.test.ts "둘째 테스트"', false);
    expect(r.warnings).toEqual([]);
    expect(r.pairs).toBe(0);
    expect(r.problems).toEqual([]);
  });

  it('없는 제목은 경고가 아니라 실패 하나다 (중복 보고 없음)', () => {
    const r = run('- [x] 가 — 근거: tests/a.test.ts "없는 제목"');
    expect(r.problems.map((p) => p.kind)).toEqual(['테스트 제목 없음']);
    expect(r.warnings).toEqual([]);
  });

  it('실제 TODO.md의 사례: "속도 컨트롤" 항목의 "다음 결정으로 (advanceUntilDecision)"·"설정(배속·자동 여부)은 …" 제목은 tests/life.test.ts 뒤에 적혀 있다 (e2e/guard.spec.ts 뒤가 아니다)', () => {
    const line = todoRaw.split(/\r?\n/).find((l) => l.startsWith('- [x] 속도 컨트롤'))!;
    expect(line).toBeTruthy();
    for (const title of ['"다음 결정으로 (advanceUntilDecision)"', '"설정(배속·자동 여부)은 게임과 독립으로 저장되고 다음 판에도 유지된다"']) {
      const at = line.indexOf(title);
      expect(at, title).toBeGreaterThan(0);
      const before = [...line.slice(0, at).matchAll(/(?:tests|e2e|e2e-prod)\/[\w./-]+?\.(?:test\.tsx?|spec\.ts)/g)].map((m) => m[0]);
      expect(before[before.length - 1], title).toBe('tests/life.test.ts');
    }
  });
});

describe('docs/TODO.md 구조 (실제 파일)', () => {
  const lines = todoRaw.split(/\r?\n/);
  const checked = lines.filter((l) => /^\s*- \[x\]/i.test(l));

  it('[x] 항목이 있고 모두 "근거:"를 적었다 (근거 없는 체크 금지)', () => {
    expect(checked.length).toBeGreaterThan(15);
    for (const l of checked) expect(l, l.slice(0, 60)).toContain('근거:');
  });

  it('SPEC-001 M1~M5 [x] 항목의 근거는 따옴표가 짝이 맞는다 (이스케이프 \\" 를 뺀 따옴표 수가 짝수, 문구 속 따옴표는 「」)', () => {
    for (const l of checked) {
      const evidence = l.slice(l.indexOf('근거:'));
      const quotes = (evidence.replace(/\\"/g, '').match(/"/g) ?? []).length;
      expect(quotes % 2, `따옴표가 홀수 개다: ${l.slice(0, 60)}`).toBe(0);
    }
  });
});
