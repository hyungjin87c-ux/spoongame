import { execFileSync } from 'node:child_process';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import pkg from './package.json';
import { commitConstant, resolveBuildInfo, resolveRepoUrl } from './scripts/buildInfo';
import { resolvePagesBase } from './scripts/pagesBase';

/** 로컬 깃의 HEAD 커밋(없으면 null). 깃이 없는 환경(압축본 빌드 등)에서도 빌드가 멈추지 않는다. */
function readGitHead(): string | null {
  try {
    return execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf-8' }).trim();
  } catch {
    return null;
  }
}

/** 로컬 작업 트리에 커밋되지 않은 변경(추적 파일의 수정·삭제, 새 파일)이 있는가. 깃을 못 읽으면 false(어차피 HEAD도 없다). 무시 파일(dist·node_modules 등)은 세지 않는다. */
function readGitDirty(): boolean {
  try {
    return execFileSync('git', ['status', '--porcelain'], { encoding: 'utf-8' }).trim() !== '';
  } catch {
    return false;
  }
}

// 첫 화면 푸터의 빌드 버전(FS7): 이슈에서 어느 빌드인지 알 수 있게 package.json 버전과 **배포 커밋** 7자를 상수로 넣는다. (scripts/buildInfo.ts)
// CI(GitHub Actions)에서는 `GITHUB_SHA`(푸시된 커밋)가 그 앞 7자가 되고, 로컬 빌드는 HEAD 앞 7자에 커밋 안 된 변경이 있으면 「+」가 붙는다(QM2-7).
const build = resolveBuildInfo({ version: pkg.version, githubSha: process.env.GITHUB_SHA, gitHead: readGitHead(), gitDirty: readGitDirty() });

export default defineConfig({
  plugins: [react()],
  // GitHub Pages(/<저장소>/ 하위)용 빌드만 환경변수 PAGES_BASE로 base를 바꾼다. 없으면 '/' — dev·e2e·e2e:prod·preview는 그대로다. (scripts/pagesBase.ts)
  base: resolvePagesBase(process.env.PAGES_BASE),
  define: {
    __APP_VERSION__: JSON.stringify(build.version),
    __APP_COMMIT__: JSON.stringify(commitConstant(build)),
    // 의견 보내기(DB7)가 이슈 작성 주소를 만드는 저장소 주소 — package.json의 repository에서 읽는다(DP1: 저장소 주소는 빌드 설정에서)
    __REPO_URL__: JSON.stringify(resolveRepoUrl((pkg as { repository?: unknown }).repository)),
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
  },
});
