/**
 * 빌드 정보 결정 (SPEC-003 FS7·QM2-7 푸터의 `v<버전> (<커밋 7자>)`).
 *
 * vite.config.ts가 빌드(그리고 dev·vitest) 때 한 번 호출해 `__APP_VERSION__`·`__APP_COMMIT__` 상수로 넣는다. 순수 함수(Node 전역을 쓰지 않음)라서 tests/buildInfo.test.ts가 직접 검사한다.
 *
 * 커밋은 **배포된 커밋**이다(QM2-7):
 *  - CI(`GITHUB_SHA`가 있는 빌드)는 그 앞 7자다. 작업 트리 상태와 무관하다(CI의 작업 트리는 체크아웃 그대로라 「+」가 붙을 일이 없다).
 *  - 로컬 빌드는 작업 트리 `HEAD` 앞 7자이고, **커밋되지 않은 변경이 있으면 접미사 「+」**(예 `abc1234+`)를 붙여 배포본과 같다고 오해되지 않게 한다(마스터 확정 2026-10-15).
 *  - 깃 정보가 없으면 null → 푸터는 「개발 빌드」.
 */
export interface BuildInfo {
  version: string;
  /** 커밋 해시 앞 7자(소문자 16진수) 또는 null */
  commit: string | null;
  /** 로컬 빌드에서 커밋되지 않은 변경이 있다(CI 빌드는 항상 false) */
  dirty: boolean;
}

const HASH = /^[0-9a-f]{7,40}$/;

/** 푸터에 쓰는 커밋 글자 길이 */
export const COMMIT_LENGTH = 7;

function cleanHash(value: string | null | undefined): string | null {
  const v = (value ?? '').trim().toLowerCase();
  return HASH.test(v) ? v.slice(0, COMMIT_LENGTH) : null;
}

export function resolveBuildInfo(input: {
  version: string | undefined;
  githubSha: string | undefined;
  gitHead: string | null | undefined;
  /** 로컬 작업 트리에 커밋되지 않은 변경(추적 파일의 수정·새 파일)이 있는가. 모르면 false */
  gitDirty?: boolean;
}): BuildInfo {
  const version = (input.version ?? '').trim();
  const ci = cleanHash(input.githubSha);
  const local = cleanHash(input.gitHead);
  return {
    version: /^\d+\.\d+\.\d+([-+][0-9A-Za-z.-]+)?$/.test(version) ? version : '0.0.0',
    commit: ci ?? local,
    // CI 커밋이 있으면 그것이 배포 커밋이다 — 작업 트리 상태는 상관없다. 로컬은 HEAD가 있을 때만 변경 여부를 뜻이 있다.
    dirty: ci === null && local !== null && input.gitDirty === true,
  };
}

/** vite가 `__APP_COMMIT__`로 넣는 글자: 커밋 7자 + (변경이 있으면 「+」). 커밋을 모르면 빈 글자(푸터가 「개발 빌드」로 쓴다). */
export function commitConstant(info: BuildInfo): string {
  return info.commit === null ? '' : `${info.commit}${info.dirty ? '+' : ''}`;
}

/**
 * 저장소 주소 결정 (SPEC-003 DB7·DP1 「저장소 주소는 빌드 설정에서 읽는다」): package.json의 `repository`(문자열 또는 { url })에서 GitHub 저장소의 **https 주소**(`https://github.com/<주인>/<저장소>`)를 만든다.
 * `git+https://…/x.git`·`git@github.com:주인/x.git`·`github:주인/x` 꼴을 받고, GitHub 저장소가 아니거나 모양이 어긋나면 빈 글자(의견 보내기 링크를 만들지 않는다 — 엉뚱한 주소로 보내지 않는다).
 * vite.config.ts가 `__REPO_URL__` 상수로 넣고, src/core/feedback.ts#buildFeedbackUrl이 이 주소에서 이슈 작성 주소를 만든다.
 */
export function resolveRepoUrl(repository: unknown): string {
  const raw = typeof repository === 'string' ? repository : typeof repository === 'object' && repository !== null && typeof (repository as { url?: unknown }).url === 'string' ? (repository as { url: string }).url : '';
  const text = raw.trim();
  const owner = '([A-Za-z0-9][A-Za-z0-9-]{0,38})';
  const repo = '([A-Za-z0-9._-]{1,100}?)';
  const m =
    new RegExp(`^(?:git\\+)?https://github\\.com/${owner}/${repo}(?:\\.git)?/?$`).exec(text) ??
    new RegExp(`^git@github\\.com:${owner}/${repo}(?:\\.git)?$`).exec(text) ??
    new RegExp(`^github:${owner}/${repo}$`).exec(text);
  return m === null ? '' : `https://github.com/${m[1]}/${m[2]}`;
}
