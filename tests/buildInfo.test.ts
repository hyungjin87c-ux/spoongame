import { describe, expect, it } from 'vitest';
import { COMMIT_LENGTH, commitConstant, resolveBuildInfo } from '../scripts/buildInfo';
import { formatBuildLabel } from '../src/core';
import { APP_COMMIT, APP_VERSION, BUILD_LABEL } from '../src/buildInfo';
import pkgRaw from '../package.json?raw';
import viteConfig from '../vite.config.ts?raw';
import deployYml from '../.github/workflows/deploy.yml?raw';
import titleScreenSrc from '../src/screens/TitleScreen.tsx?raw';
import indexHtml from '../index.html?raw';

/**
 * 빌드 버전 표기 (SPEC-003 FS7): 첫 화면 푸터의 `v<버전> (<커밋 7자>)`. 이슈 보고에서 어느 빌드인지 알기 위한 것이다.
 * 값은 빌드 때 vite가 상수로 넣는다(vite.config.ts → define).
 */

describe('formatBuildLabel', () => {
  it('v<버전> (<커밋 7자>)', () => {
    expect(formatBuildLabel('0.1.0', 'a1b2c3d4e5f60718293a4b5c6d7e8f9012345678')).toBe('v0.1.0 (a1b2c3d)');
    expect(formatBuildLabel('1.2.3', 'ABCDEF1')).toBe('v1.2.3 (abcdef1)');
  });
  it('커밋을 알 수 없으면 「개발 빌드」', () => {
    for (const c of [undefined, null, '', '   ', 'zzzzzzz', 'abc', 'not-a-hash']) expect(formatBuildLabel('0.1.0', c), String(c)).toBe('v0.1.0 (개발 빌드)');
  });
  it('버전이 비어 있으면 0.0.0', () => {
    expect(formatBuildLabel('', 'abcdef1')).toBe('v0.0.0 (abcdef1)');
  });
});

describe('resolveBuildInfo (vite.config.ts가 쓴다)', () => {
  const sha = '0123456789abcdef0123456789abcdef01234567';
  it('CI의 GITHUB_SHA가 있으면 그 앞 7자, 없으면 로컬 git HEAD 앞 7자, 둘 다 없으면 null (QM2-7: 커밋은 배포 커밋 앞 7자)', () => {
    expect(resolveBuildInfo({ version: '0.1.0', githubSha: sha, gitHead: 'fedcba9876543210fedcba9876543210fedcba98' })).toEqual({ version: '0.1.0', commit: sha.slice(0, 7), dirty: false });
    expect(resolveBuildInfo({ version: '0.1.0', githubSha: undefined, gitHead: sha })).toEqual({ version: '0.1.0', commit: sha.slice(0, 7), dirty: false });
    expect(resolveBuildInfo({ version: '0.1.0', githubSha: '', gitHead: null })).toEqual({ version: '0.1.0', commit: null, dirty: false });
  });

  it('QM2-7 (a) ① GITHUB_SHA가 있으면 그 앞 7자이고 작업 트리 상태(변경 여부)는 무시한다 — 배포된 커밋은 작업 트리가 아니라 푸시된 커밋이다', () => {
    for (const gitDirty of [false, true, undefined]) {
      const info = resolveBuildInfo({ version: '0.1.0', githubSha: sha, gitHead: 'fedcba9876543210fedcba9876543210fedcba98', gitDirty });
      expect(info.commit, `gitDirty=${gitDirty}`).toBe('0123456');
      expect(info.dirty, `gitDirty=${gitDirty}`).toBe(false);
      expect(commitConstant(info)).toBe('0123456');
    }
    expect(resolveBuildInfo({ version: '0.1.0', githubSha: sha.toUpperCase(), gitHead: null }).commit, '대문자도 소문자 7자로').toBe('0123456');
  });

  it('QM2-7 (a) ② GITHUB_SHA가 없고 작업 트리가 깨끗하면 HEAD 앞 7자 (「+」 없음)', () => {
    const info = resolveBuildInfo({ version: '0.1.0', githubSha: undefined, gitHead: sha, gitDirty: false });
    expect(info).toEqual({ version: '0.1.0', commit: '0123456', dirty: false });
    expect(commitConstant(info)).toBe('0123456');
    expect(formatBuildLabel('0.1.0', commitConstant(info))).toBe('v0.1.0 (0123456)');
  });

  it('QM2-7 (a) ③ GITHUB_SHA가 없고 커밋되지 않은 변경이 있으면 7자 + 「+」 — 배포본과 같다고 오해되지 않는다', () => {
    const info = resolveBuildInfo({ version: '0.1.0', githubSha: undefined, gitHead: sha, gitDirty: true });
    expect(info).toEqual({ version: '0.1.0', commit: '0123456', dirty: true });
    expect(commitConstant(info)).toBe('0123456+');
    expect(formatBuildLabel('0.1.0', commitConstant(info))).toBe('v0.1.0 (0123456+)');
  });

  it('QM2-7 (a) ④ 깃 정보가 없으면(HEAD 없음) 변경 여부와 관계없이 「개발 빌드」 — 「+」도 붙지 않는다', () => {
    for (const gitDirty of [false, true]) {
      const info = resolveBuildInfo({ version: '0.1.0', githubSha: undefined, gitHead: null, gitDirty });
      expect(info).toEqual({ version: '0.1.0', commit: null, dirty: false });
      expect(commitConstant(info)).toBe('');
      expect(formatBuildLabel('0.1.0', commitConstant(info))).toBe('v0.1.0 (개발 빌드)');
    }
  });

  it('커밋 글자 길이는 7이고, 푸터 표기는 「v버전 (커밋7자)」 또는 「(커밋7자+)」이다', () => {
    expect(COMMIT_LENGTH).toBe(7);
    expect(formatBuildLabel('1.2.3', 'ABCDEF1234567+')).toBe('v1.2.3 (abcdef1+)');
    expect(formatBuildLabel('1.2.3', 'abcdef1+')).toBe('v1.2.3 (abcdef1+)');
    expect(formatBuildLabel('1.2.3', '+')).toBe('v1.2.3 (개발 빌드)');
    expect(formatBuildLabel('1.2.3', 'abc+')).toBe('v1.2.3 (개발 빌드)');
  });
  it('해시 모양이 아닌 값(오류 메시지 등)은 커밋으로 쓰지 않는다', () => {
    expect(resolveBuildInfo({ version: '0.1.0', githubSha: 'fatal: not a git repository', gitHead: 'HEAD' }).commit).toBeNull();
  });
  it('버전은 숫자.숫자.숫자(+접미)만 받고 아니면 0.0.0', () => {
    expect(resolveBuildInfo({ version: '2.10.3', githubSha: undefined, gitHead: undefined }).version).toBe('2.10.3');
    expect(resolveBuildInfo({ version: '1.0.0-beta.1', githubSha: undefined, gitHead: undefined }).version).toBe('1.0.0-beta.1');
    expect(resolveBuildInfo({ version: 'latest', githubSha: undefined, gitHead: undefined }).version).toBe('0.0.0');
    expect(resolveBuildInfo({ version: undefined, githubSha: undefined, gitHead: undefined }).version).toBe('0.0.0');
  });
});

describe('빌드 상수 연결', () => {
  it('vite.config.ts가 package.json 버전과 커밋을 __APP_VERSION__·__APP_COMMIT__로 넣는다', () => {
    expect(viteConfig).toContain('__APP_VERSION__: JSON.stringify(build.version)');
    expect(viteConfig).toContain('__APP_COMMIT__: JSON.stringify(commitConstant(build))');
    expect(viteConfig).toContain('gitDirty: readGitDirty()'); // 로컬 변경 여부(QM2-7)
    expect(viteConfig).toContain("['status', '--porcelain']");
    expect(viteConfig).toContain('process.env.GITHUB_SHA');
    expect(viteConfig).toContain('pkg.version');
  });

  it('화면이 쓰는 값은 package.json 버전이고, 커밋은 7자 해시이거나 개발 빌드 표기다 (vitest도 같은 vite 설정을 쓴다)', () => {
    const pkg = JSON.parse(pkgRaw) as { version: string };
    expect(APP_VERSION).toBe(pkg.version);
    expect(APP_COMMIT === '' || /^[0-9a-f]{7}\+?$/.test(APP_COMMIT)).toBe(true); // 7자(+ 변경이 있는 로컬 빌드)
    expect(BUILD_LABEL).toBe(formatBuildLabel(APP_VERSION, APP_COMMIT));
    expect(BUILD_LABEL).toMatch(/^v\d+\.\d+\.\d+ \(([0-9a-f]{7}\+?|개발 빌드)\)$/);
  });

  it('QM2-7 (d) 빌드 버전의 출처는 하나다: 푸터는 BUILD_LABEL을 그대로 쓰고, 의견 보내기 주소(M4 DB7 buildFeedbackUrl)도 같은 BUILD_LABEL(또는 APP_VERSION·APP_COMMIT)을 가져다 쓴다', () => {
    expect(titleScreenSrc).toContain("import { BUILD_LABEL } from '../buildInfo';");
    expect(titleScreenSrc).toContain('{BUILD_LABEL}');
    expect(titleScreenSrc).not.toMatch(/__APP_(VERSION|COMMIT)__/); // 화면이 상수를 직접 읽지 않는다
  });
});

describe('index.html 메타·아이콘 (파비콘·터치 아이콘 A안, 탭 제목 유지)', () => {
  it('탭 제목은 「수저 게임」이고 언어는 한국어다', () => {
    expect(indexHtml).toContain('<title>수저 게임</title>');
    expect(indexHtml).toContain('<html lang="ko">');
  });

  it('파비콘(svg·32px png)과 터치 아이콘이 형진 님이 고른 A안 파일을 가리킨다', () => {
    expect(indexHtml).toContain('<link rel="icon" type="image/svg+xml" href="/src/assets/brand/a/favicon.svg" />');
    expect(indexHtml).toContain('<link rel="icon" type="image/png" sizes="32x32" href="/src/assets/brand/a/favicon-32.png" />');
    expect(indexHtml).toContain('<link rel="apple-touch-icon" href="/src/assets/brand/a/apple-touch-icon.png" />');
  });

  it('주소 표시줄 색은 라이트·다크 바탕 토큰과 같고, 색 구성표는 라이트·다크 둘 다 지원한다', () => {
    expect(indexHtml).toContain('<meta name="color-scheme" content="light dark" />');
    expect(indexHtml).toContain('content="#f6f3ec" media="(prefers-color-scheme: light)"');
    expect(indexHtml).toContain('content="#14171f" media="(prefers-color-scheme: dark)"');
  });

  it('설명 문구는 다른 게임의 이름·고유 문구를 쓰지 않고 「접속자」 표현도 없다', () => {
    const desc = /<meta name="description" content="([^"]+)"/.exec(indexHtml)?.[1] ?? '';
    expect(desc.length).toBeGreaterThan(10);
    expect(desc).not.toMatch(/80억|접속자/);
  });

  it('외부 주소(http/https)로 불러오는 것이 없다 (FS8·CM3: 폰트·CDN 없음)', () => {
    expect(indexHtml).not.toMatch(/(src|href)="https?:/);
    expect(indexHtml).not.toMatch(/fonts\.googleapis|cdn\./);
  });
});

describe('deploy.yml: 배포 커밋 확인 단계 (SPEC-003 QM2-7 b)', () => {
  const at = (needle: string) => {
    const i = deployYml.indexOf(needle);
    expect(i, `deploy.yml에 "${needle}"`).toBeGreaterThanOrEqual(0);
    return i;
  };

  it('빌드 뒤·Pages 설정 앞에, 산출물 JS에 GITHUB_SHA 앞 7자가 들어 있는지 확인하고 없으면 멈추는 단계가 있다 (base 경로 확인 단계와 같은 방식: grep + exit 1)', () => {
    const step = at('빌드 산출물에 배포 커밋(GITHUB_SHA 앞 7자)이 들어 있는지 확인');
    expect(at('run: npm run build')).toBeLessThan(step);
    expect(at("grep -q 'src=\"/spoongame/assets/' dist/index.html")).toBeLessThan(step);
    expect(step).toBeLessThan(at('actions/configure-pages@'));
    const block = deployYml.slice(step, at('actions/configure-pages@'));
    expect(block).toContain('short="${GITHUB_SHA::7}"');
    expect(block).toContain('grep -rqF "$short" dist/assets');
    expect(block).toContain('exit 1');
    // 비밀값·토큰을 새로 쓰지 않는다 (GITHUB_SHA는 Actions가 모든 단계에 주는 기본 환경변수)
    expect(block).not.toMatch(/secrets\./);
  });
});
