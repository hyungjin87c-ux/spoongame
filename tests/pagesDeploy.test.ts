import { describe, expect, it } from 'vitest';
import configYml from '../.github/ISSUE_TEMPLATE/config.yml?raw';
import feedbackYml from '../.github/ISSUE_TEMPLATE/feedback.yml?raw';
import deployYml from '../.github/workflows/deploy.yml?raw';
import indexHtml from '../index.html?raw';
import namesJson from '../src/data/names.json';
import readme from '../README.md?raw';
import pkgRaw from '../package.json?raw';
import viteConfig from '../vite.config.ts?raw';
import { resolvePagesBase } from '../scripts/pagesBase';

/**
 * GitHub Pages 자동 배포 설정의 계약 (SPEC-003 배포 설정, ai-log/2026-10-15_SPEC-003_dev-pages.md).
 * 워크플로 자체는 GitHub에서만 돌지만, 단계 순서·권한·고정 버전·"e2e를 넣지 않음" 같은 약속이 파일에서 깨지지 않는지 여기서 지킨다.
 */

describe('resolvePagesBase: base 경로는 환경변수 PAGES_BASE로만 바뀐다', () => {
  it('값이 없거나 비어 있거나 슬래시/공백뿐이면 "/" — 로컬 dev·e2e(5199)·e2e:prod(4199)·preview는 그대로', () => {
    for (const value of [undefined, '', '   ', '/', '//', ' / ']) expect(resolvePagesBase(value), JSON.stringify(value)).toBe('/');
  });

  it('배포용 값 "/spoongame/"은 그대로 나온다', () => {
    expect(resolvePagesBase('/spoongame/')).toBe('/spoongame/');
  });

  it('앞뒤 슬래시가 빠져도 "/이름/" 모양으로 맞춘다', () => {
    for (const value of ['spoongame', '/spoongame', 'spoongame/', ' /spoongame/ ']) expect(resolvePagesBase(value), value).toBe('/spoongame/');
  });

  it('경로로 쓸 수 없는 값은 조용히 넘기지 않고 오류로 멈춘다 (Windows Git Bash가 /spoongame/을 C:/Program Files/Git/spoongame/으로 바꾼 경우 등)', () => {
    for (const value of ['C:/Program Files/Git/spoongame/', 'a b', '..', '/a/../b', 'https://example.com/x/', 'a\\b','/spoongame?x=1']) {
      expect(() => resolvePagesBase(value), value).toThrow(/PAGES_BASE/);
    }
  });

  it('여러 단계 경로도 허용한다 (/a/b/)', () => {
    expect(resolvePagesBase('/a/b')).toBe('/a/b/');
  });

  it('vite.config.ts가 PAGES_BASE만 읽어 base로 쓴다 (다른 입력 경로 없음)', () => {
    expect(viteConfig).toContain('base: resolvePagesBase(process.env.PAGES_BASE)');
    expect(viteConfig).not.toMatch(/base:\s*['"]/); // 하드코딩된 base가 아니다
  });

  it('index.html은 루트 상대 경로(/src/main.tsx) 하나만 쓴다 — vite가 빌드 때 base를 붙여 준다 (그 밖에 손으로 쓴 절대 경로 없음)', () => {
    const refs = [...indexHtml.matchAll(/(?:src|href)="([^"]+)"/g)].map((m) => m[1]);
    expect(refs).toEqual(['/src/main.tsx']);
  });
});

describe('deploy.yml: main push → 검증 → Pages 배포', () => {
  const at = (needle: string) => {
    const i = deployYml.indexOf(needle);
    expect(i, `deploy.yml에 "${needle}"`).toBeGreaterThanOrEqual(0);
    return i;
  };

  it('main push와 수동 실행(workflow_dispatch)으로만 돈다', () => {
    expect(deployYml).toMatch(/on:\s*\n\s+push:\s*\n\s+branches:\s*\[main\]\s*\n\s+workflow_dispatch:/);
    expect(deployYml).not.toMatch(/pull_request/);
  });

  it('권한은 contents:read·pages:write·id-token:write뿐이고 concurrency가 있다', () => {
    expect(deployYml).toMatch(/permissions:\s*\n\s+contents: read\s*\n\s+pages: write\s*\n\s+id-token: write\s*\n/);
    expect(deployYml).toMatch(/concurrency:\s*\n\s+group: pages\s*\n\s+cancel-in-progress: false/);
  });

  it('단계 순서: npm ci → typecheck → test → build → base 확인 → configure-pages → upload → (deploy 작업) deploy-pages', () => {
    const order = [
      'run: npm ci',
      'run: npm run typecheck',
      'run: npm test',
      'run: npm run build',
      'grep -q \'src="/spoongame/assets/\' dist/index.html',
      'actions/configure-pages@',
      'actions/upload-pages-artifact@',
      'needs: build',
      'actions/deploy-pages@',
    ].map(at);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });

  it('배포 빌드만 PAGES_BASE=/spoongame/ 를 준다 (npm ci·typecheck·test 단계에는 값이 필요 없다)', () => {
    expect(deployYml).toMatch(/env:\s*\n\s+(?:#.*\n\s+)*PAGES_BASE: \/spoongame\/\n/);
  });

  it('Node 24, package-lock.json 그대로 npm ci, 공식 액션은 고정 메이저 버전, 비밀값은 쓰지 않는다', () => {
    expect(deployYml).toMatch(/node-version: 24\b/);
    expect(deployYml).not.toMatch(/npm install\b/);
    const uses = [...deployYml.matchAll(/uses:\s*(\S+)/g)].map((m) => m[1]);
    expect(uses.length).toBe(5);
    for (const u of uses) expect(u, u).toMatch(/^actions\/[a-z-]+@v\d+$/);
    expect(deployYml).not.toMatch(/secrets\./); // GITHUB_TOKEN 기본 권한만
  });

  it('Playwright e2e는 이번 CI에 넣지 않는다 (브라우저 설치가 무거움) — 이유가 주석으로 남아 있다', () => {
    const steps = deployYml.split('\n').filter((l) => !l.trim().startsWith('#'));
    expect(steps.join('\n')).not.toMatch(/playwright|npm run e2e/);
    expect(deployYml).toMatch(/#.*Playwright e2e.*CI에 넣지 않는다/);
  });

  it('README에 적힌 Pages 주소가 워크플로의 base(/spoongame/)와 같은 저장소 이름이다', () => {
    expect(readme).toContain('https://hyungjin87c-ux.github.io/spoongame/');
    expect(deployYml).toContain('https://hyungjin87c-ux.github.io/spoongame/');
  });

  it('package.json의 build 스크립트(typecheck → 이벤트 검증 → vite build)를 그대로 쓴다 (PAGES_BASE는 환경변수로만 전달)', () => {
    const pkg = JSON.parse(pkgRaw) as { scripts: Record<string, string> };
    expect(pkg.scripts.build).toBe('npm run typecheck && vite-node scripts/validateEvents.ts && vite build');
    expect(pkg.scripts.build).not.toContain('--base');
  });
});

describe('피드백 이슈 템플릿', () => {
  it('config.yml: 빈 이슈를 막고 의견 양식으로 받는다', () => {
    expect(configYml).toMatch(/^blank_issues_enabled: false$/m);
  });

  it('feedback.yml: 화면·한 일·기대·실제·기기·스크린샷(선택) 항목과 개인정보 금지 안내가 있다', () => {
    for (const id of ['screen', 'action', 'expected', 'actual', 'device', 'screenshot']) expect(feedbackYml, id).toContain(`id: ${id}`);
    expect(feedbackYml).toContain('어떤 화면에서');
    expect(feedbackYml).toContain('무엇을 했을 때');
    expect(feedbackYml).toContain('기대한 것');
    expect(feedbackYml).toContain('실제로 일어난 것');
    expect(feedbackYml).toContain('기기·브라우저');
    expect(feedbackYml).toContain('스크린샷 (선택)');
    expect(feedbackYml).toMatch(/개인정보는 적지 말아 주세요/);
    // 스크린샷만 선택 항목이다
    const requiredCount = (feedbackYml.match(/required: true/g) ?? []).length;
    const optionalCount = (feedbackYml.match(/required: false/g) ?? []).length;
    expect(requiredCount).toBe(5);
    expect(optionalCount).toBe(1);
  });

  it('README의 의견 보내기 링크는 이 템플릿 파일 이름(feedback.yml)을 가리킨다', () => {
    expect(readme).toContain('/issues/new?template=feedback.yml');
  });
});

describe('README', () => {
  it('데이터 출처 문구가 names.json의 meta.attribution과 같다 (법원 전자가족관계등록시스템 통계서비스)', () => {
    const { text, url } = (namesJson as { meta: { attribution: { text: string; url: string } } }).meta.attribution;
    expect(readme).toContain(text);
    expect(readme).toContain(url);
  });

  it('검증 명령과 문서 지도가 실제 스크립트·폴더와 맞는다', () => {
    const pkg = JSON.parse(pkgRaw) as { scripts: Record<string, string> };
    for (const name of ['typecheck', 'test', 'build', 'e2e', 'e2e:prod', 'check:todo', 'check:dist', 'sim:1000']) {
      expect(pkg.scripts[name], `package.json scripts.${name}`).toBeTruthy();
      expect(readme, name).toContain(`npm ${name === 'test' ? '' : 'run '}${name}`);
    }
    for (const place of ['CLAUDE.md', 'docs/spec/', 'docs/review/', 'qa/reports/', 'ai-log/', 'wiki/']) expect(readme, place).toContain(place);
  });

  it('개인 이메일 같은 개인정보가 없다', () => {
    expect(readme).not.toMatch(/[\w.+-]+@[\w-]+\.[\w.]+/);
  });
});
