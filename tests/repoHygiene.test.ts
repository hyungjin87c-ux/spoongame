import { describe, expect, it } from 'vitest';
import { findLocalPathLeaks, localAccountNames, usableAccountNames } from './helpers/localPathLeaks';
import { ignoreMatcher, isTextPath, listRepoTextFiles, readRepoText } from './helpers/repoFiles';

/**
 * 공개 저장소 위생 (REV-003-M6a-2 R-188): 올라갈 텍스트 파일 전체에 내 컴퓨터의 절대 경로(사용자 폴더)와 사용자 이름이 없다.
 * 전에는 tests/spec003Baseline.test.ts가 문서 세 개만 봤다. 여기서는 md·ts·tsx·js·mjs·json·csv·yml·sh·txt·html·css 등 저장소 전체를 본다.
 * 대상: 깃이 추적하는 파일 + .gitignore에 걸리지 않는 새 파일. node_modules·dist·test-results·playwright-report·.gitignore 대상은 제외. 그림(.png)은 대상이 아니다.
 *
 * 환경에 따라 동작이 다르다(tests/helpers/localPathLeaks.ts 머리말).
 *  - 어디서나: 사용자 폴더 경로 일반 패턴 0. CI(GitHub Actions)에서도 같다.
 *  - 내 컴퓨터: 위에 더해 실행 환경의 계정 이름(os.userInfo().username, os.homedir() 마지막 폴더)이 0. CI의 계정(runner)은 흔한 말이라 건너뛴다.
 * 이 파일 어디에도 사용자 이름·실제 경로를 글자 그대로 적지 않는다 — 감지기 시험 문장은 조각을 이어 붙여 만든다.
 */

/** 시험용 가짜 경로를 이어 붙여 만든다(글자 그대로 적으면 이 파일이 감지기에 걸린다) */
const join = (sep: string, ...parts: string[]): string => parts.join(sep);
const FAKE_NAME = 'zz_fake_person';

describe('감지기 자체 시험 (가짜 경로)', () => {
  it('Windows 사용자 폴더 경로를 잡는다: 역슬래시·슬래시·겹역슬래시·역슬래시가 빠진 꼴·소문자·URL 인코딩 꼴', () => {
    const samples = [
      join('\\', 'C:', 'Users', FAKE_NAME, 'Desktop', 'proj'),
      join('/', 'C:', 'Users', FAKE_NAME, 'Desktop', 'proj'),
      join('\\\\', 'C:', 'Users', FAKE_NAME, 'Desktop'),
      join('\\', 'd:', 'users', FAKE_NAME),
      join('', 'C:', 'Users', FAKE_NAME),
      join('%5C', 'C%3A', 'Users', FAKE_NAME),
      join('%2F', 'C%3A', 'Users', FAKE_NAME),
    ];
    for (const s of samples) expect(findLocalPathLeaks(`경로: ${s} 입니다`).length, s).toBeGreaterThan(0);
    // 슬래시 꼴은 홈 폴더 규칙에도 닿을 수 있지만 한 번만 센다(드라이브 문자 규칙이 맡는다)
    expect(findLocalPathLeaks(join('/', 'C:', 'Users', FAKE_NAME, 'x'))).toHaveLength(1);
  });

  it('Git Bash 꼴과 macOS·Linux 홈 경로를 잡는다', () => {
    for (const s of [join('/', '', 'c', 'Users', FAKE_NAME, 'x'), join('/', '', 'Users', FAKE_NAME, 'Documents'), join('/', '', 'home', FAKE_NAME, 'work')]) {
      expect(findLocalPathLeaks(s).length, s).toBeGreaterThan(0);
    }
  });

  it('줄 번호와 규칙 이름만 돌려주고 걸린 글자는 담지 않는다', () => {
    const hits = findLocalPathLeaks(`첫 줄\n둘째 줄\n${join('\\', 'C:', 'Users', FAKE_NAME)}\n`);
    expect(hits).toEqual([{ rule: 'Windows 사용자 폴더 경로', line: 3 }]);
    expect(JSON.stringify(hits)).not.toContain(FAKE_NAME);
  });

  it('정상 문구는 안 잡는다: 자리표시 경로·CI 러너 경로·일반 낱말', () => {
    const fine = [
      '<프로젝트 폴더>',
      join('/', '', 'home', 'runner', 'work', 'spoongame'),
      join('/', '', 'Users', '<이름>', 'x'),
      join('/', '', 'home', '$USER', 'x'),
      '사용자(Users)와 homepage, https://example.com/users/list',
      'https://users.example.com/ 과 http://localhost:5173/', // 주소의 「https:」·「localhost:」는 드라이브 문자(홀로 선 한 글자)가 아니다
      '사용자 폴더 경로',
    ];
    for (const s of fine) expect(findLocalPathLeaks(s), s).toEqual([]);
  });

  it('계정 이름 감지: 글자뿐인 이름은 낱말 경계로, 기호가 섞인 이름은 부분 문자열로 찾고, 대소문자를 가리지 않는다', () => {
    expect(findLocalPathLeaks(`이름은 ${FAKE_NAME.toUpperCase()} 이다`, [FAKE_NAME]).length).toBeGreaterThan(0);
    expect(findLocalPathLeaks(`접두${FAKE_NAME}접미`, [FAKE_NAME]).length).toBeGreaterThan(0); // 밑줄이 든 이름은 어디에 붙어도 잡는다
    expect(findLocalPathLeaks('the quickbrownfox jumps', ['quick'])).toEqual([]); // 글자뿐인 이름은 다른 낱말의 일부면 넘긴다
    expect(findLocalPathLeaks('the quick fox', ['quick']).length).toBeGreaterThan(0);
    expect(findLocalPathLeaks('아무 이름도 없다', [FAKE_NAME])).toEqual([]);
  });

  it('흔한 계정 이름·짧은 이름은 감지 이름에서 빠진다(CI 러너 등): runner·root·ubuntu·3글자 이하, 빈 값은 제외, 소문자·중복 제거', () => {
    expect(usableAccountNames(['runner', 'Root', 'UBUNTU', 'abc', '', null, undefined, 'runneradmin'])).toEqual([]);
    expect(usableAccountNames([FAKE_NAME.toUpperCase(), FAKE_NAME, 'ab'])).toEqual([FAKE_NAME]);
  });

  it('CI처럼 계정이 흔한 이름(runner)이어도 일반 경로 패턴 검사는 그대로 동작한다', () => {
    const names = usableAccountNames(['runner']);
    expect(names).toEqual([]);
    expect(findLocalPathLeaks(join('\\', 'C:', 'Users', 'someone', 'x'), names).length).toBeGreaterThan(0);
    expect(findLocalPathLeaks('runner가 돌린다', names)).toEqual([]);
  });
});

describe('.gitignore 간단 해석 (깃을 못 쓸 때 쓰는 대비책)', () => {
  const ignored = ignoreMatcher('# 주석\n\nnode_modules\ndist\n*.log\n.claude/settings.local.json\nqa/results/final/mass-*.json\nplaywright-report\n');

  it('폴더 이름·글롭·루트 기준 경로 규칙을 푼다', () => {
    expect(ignored('node_modules/vitest/index.js')).toBe(true);
    expect(ignored('sub/node_modules/x.js')).toBe(true);
    expect(ignored('dist/index.html')).toBe(true);
    expect(ignored('a/b/requests.log')).toBe(true);
    expect(ignored('.claude/settings.local.json')).toBe(true);
    expect(ignored('qa/results/final/mass-past.json')).toBe(true);
  });

  it('추적해야 할 파일은 거르지 않는다', () => {
    for (const p of ['src/main.tsx', 'README.md', 'qa/results/final/summary.json', 'docs/dist-notes.md', '.claude/agents/designer.md', 'qa/mass-note.md']) expect(ignored(p), p).toBe(false);
  });

  it('예외 규칙(!)은 지원하지 않으므로 던진다', () => {
    expect(() => ignoreMatcher('*.log\n!keep.log')).toThrow(/예외 규칙/);
  });
});

describe('검사 대상 파일 목록', () => {
  const listed = listRepoTextFiles();

  it('텍스트 파일 꼴 판정: 문서·코드·데이터는 대상이고 그림·바이너리는 아니다', () => {
    for (const p of ['README.md', 'src/App.tsx', 'tests/x.test.ts', 'scripts/a.mjs', 'docs/data/x.csv', '.github/workflows/deploy.yml', 'qa/scripts/f-breakevents.sh', 'qa/results/final/F-R-vitest.txt', 'index.html', 'src/styles.css', 'package.json', '.gitignore']) {
      expect(isTextPath(p), p).toBe(true);
    }
    for (const p of ['qa/screenshots/003/a.png', 'docs/x.jpg', 'a/b.woff2', 'LICENSE']) expect(isTextPath(p), p).toBe(false);
  });

  it('목록이 비어 있지 않고(깃 또는 폴더 걷기) 핵심 파일이 들어 있다 — 빈 목록으로 통과하지 않는다', () => {
    expect(['git', 'walk']).toContain(listed.via);
    expect(listed.paths.length).toBeGreaterThan(150);
    for (const p of ['README.md', 'HANDOFF.md', 'CLAUDE.md', 'package.json', 'docs/TODO.md', 'src/main.tsx', 'qa/scripts/f-breakevents.sh', 'qa/results/final/F-R-vitest.txt', 'tests/repoHygiene.test.ts', 'ai-log/2026-10-15_SPEC-003_dev-M6a.md']) {
      expect(listed.paths, p).toContain(p);
    }
    expect(listed.totalFiles).toBeGreaterThanOrEqual(listed.paths.length);
  });

  it('node_modules·dist·test-results·playwright-report·.git과 .gitignore 대상(*.log, 대량 원자료)은 목록에 없다', () => {
    for (const p of listed.paths) {
      expect(p, p).not.toMatch(/(^|\/)(node_modules|dist|test-results|playwright-report|\.git)\//);
      expect(p, p).not.toMatch(/\.log$/);
      expect(p, p).not.toMatch(/^qa\/results\/final\/(mass-[^/]*\.json|cases\.jsonl|end-table\.json)$/);
    }
  });

  it('폴더 걷기 대비책도 같은 핵심 파일을 찾고 같은 제외 규칙을 지킨다', () => {
    const walked = listRepoTextFiles(true);
    expect(walked.via).toBe('walk');
    expect(walked.paths.length).toBeGreaterThan(150);
    for (const p of ['README.md', 'HANDOFF.md', 'package.json', 'src/main.tsx', 'qa/scripts/f-breakevents.sh']) expect(walked.paths, p).toContain(p);
    for (const p of walked.paths) {
      expect(p, p).not.toMatch(/(^|\/)(node_modules|dist|test-results|playwright-report|\.git)\//);
      expect(p, p).not.toMatch(/\.log$/);
    }
  });
});

describe('저장소 전체 위생: 사용자 폴더 경로·사용자 이름이 올라갈 글에 없다 (R-188)', () => {
  const listed = listRepoTextFiles();

  it('모든 텍스트 파일의 경로(파일 이름) 자체에 사용자 폴더 꼴·계정 이름이 없다', async () => {
    const names = await localAccountNames();
    const bad = listed.paths.filter((p) => findLocalPathLeaks(p, names).length > 0);
    expect(bad).toEqual([]);
  });

  it('모든 텍스트 파일 내용에 사용자 폴더 경로 일반 패턴이 0이다 (CI에서도 같다)', () => {
    const report: string[] = [];
    let read = 0;
    for (const path of listed.paths) {
      const text = readRepoText(path);
      if (text === null) continue;
      read++;
      for (const h of findLocalPathLeaks(text)) report.push(`${path}:${h.line} ${h.rule}`);
    }
    expect(read, '읽은 파일 수').toBeGreaterThan(150);
    expect(report).toEqual([]);
  });

  it('모든 텍스트 파일 내용에 실행 환경의 계정 이름(os.userInfo().username, os.homedir() 마지막 폴더)이 0이다 — 흔한 이름(CI의 runner 등)이면 건너뛴다', async () => {
    const names = await localAccountNames();
    const report: string[] = [];
    for (const path of listed.paths) {
      const text = readRepoText(path);
      if (text === null) continue;
      for (const h of findLocalPathLeaks(text, names)) report.push(`${path}:${h.line} ${h.rule}`);
    }
    expect(report).toEqual([]);
  });
});
