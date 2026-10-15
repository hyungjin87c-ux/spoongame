/**
 * 빌드 base 경로 결정 (GitHub Pages 배포, SPEC-003 배포 설정).
 *
 * GitHub Pages는 프로젝트 사이트를 `https://<사용자>.github.io/<저장소>/` 하위에서 서빙한다. 그래서 배포 빌드만 base를 `/<저장소>/`로 바꾸고,
 * 로컬(dev·e2e 5199·e2e:prod 4199·preview)은 지금처럼 `/` 그대로 둔다. 바꾸는 방법은 환경변수 하나뿐이다:
 *   PAGES_BASE=/spoongame/ npm run build        (PowerShell: $env:PAGES_BASE='/spoongame/'; npm run build)
 * 값이 없거나 비어 있거나 `/`뿐이면 `/`. 앞뒤 슬래시가 빠져도(`spoongame`, `/spoongame`) `/spoongame/` 모양으로 맞춘다.
 *
 * 경로로 쓸 수 없는 값(공백·`:`·`\`·`..` 등)은 조용히 넘기지 않고 오류로 멈춘다. Windows의 Git Bash는 `/spoongame/` 같은 인자를
 * `C:/Program Files/Git/spoongame/`으로 바꿔 버리므로(MSYS 경로 변환) 거기서는 PowerShell을 쓰거나 `MSYS_NO_PATHCONV=1`을 붙인다.
 *
 * 순수 함수(Node 전역을 쓰지 않음)라서 tests/pagesDeploy.test.ts가 직접 검사한다. vite.config.ts가 `process.env.PAGES_BASE`를 넘겨 호출한다.
 */
export function resolvePagesBase(value: string | undefined): string {
  const path = (value ?? '').trim().replace(/^\/+|\/+$/g, '');
  if (path === '') return '/';
  const segments = path.split('/');
  if (!segments.every((s) => /^[A-Za-z0-9._~-]+$/.test(s) && s !== '.' && s !== '..')) {
    throw new Error(
      `PAGES_BASE 값이 경로로 쓸 수 없는 모양입니다: ${JSON.stringify(value)} (예: /spoongame/). ` +
        'Windows Git Bash는 /로 시작하는 인자를 C:/Program Files/Git/... 으로 바꿉니다 — PowerShell을 쓰거나 MSYS_NO_PATHCONV=1을 붙이세요.',
    );
  }
  return `/${segments.join('/')}/`;
}
