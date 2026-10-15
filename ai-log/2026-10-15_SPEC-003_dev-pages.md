# 2026-10-15 SPEC-003 dev-pages (GitHub Pages 자동 배포 설정)

- 누가: developer
- 무엇을: 형진 님 결정(모바일에서 링크로 플레이·검토, 피드백은 GitHub 이슈 — `CLAUDE.md` 5-1절, `ai-log/2026-10-15_SPEC-003_decision.md`)에 따라 공개 저장소 `hyungjin87c-ux/spoongame`(`main`)을 GitHub Pages(`https://hyungjin87c-ux.github.io/spoongame/`)로 자동 배포하는 설정만 만들었다. `src/` 게임 로직·이벤트 데이터·SPEC 문서·`docs/spec/SPEC-003-개편.md`는 건드리지 않았고 새 npm 의존성도 없다. commit·push는 하지 않았다(마스터가 한다).

## 만든·바꾼 파일
| 파일 | 내용 |
|---|---|
| `vite.config.ts` (수정) | `base: resolvePagesBase(process.env.PAGES_BASE)` 한 줄 추가. 환경변수가 없으면 `/` |
| `scripts/pagesBase.ts` (신규) | `resolvePagesBase(value)` 순수 함수. 없음/빈 값/`/` → `/`, `spoongame`·`/spoongame`·`/spoongame/` → `/spoongame/`. 경로로 못 쓰는 값(공백·`:`·`\`·`..` 등)은 오류로 멈춘다 |
| `.github/workflows/deploy.yml` (신규) | main push + `workflow_dispatch` → `npm ci` → `typecheck` → `npm test` → `npm run build`(타입·이벤트 검증·vite build, `PAGES_BASE=/spoongame/`) → dist 경로 확인 → `configure-pages` → `upload-pages-artifact` → 별도 deploy 작업 `deploy-pages` |
| `.github/ISSUE_TEMPLATE/feedback.yml` (신규) | 한국어 이슈 양식: 화면·한 일·기대·실제·기기·브라우저·스크린샷(선택), 개인정보 금지 안내 |
| `.github/ISSUE_TEMPLATE/config.yml` (신규) | `blank_issues_enabled: false` |
| `README.md` (신규) | 소개·플레이 링크·의견 링크·로컬 실행·검증 명령·배포 요약·문서 지도·데이터 출처 |
| `tests/pagesDeploy.test.ts` (신규) | 21개: base 계산, 워크플로 단계 순서·권한·고정 버전·e2e 제외, 이슈 양식 항목, README 출처 문구가 `names.json#meta.attribution`과 같음 등 |

## base 경로 처리 방식
- 앱은 경로 라우팅이 없는 단일 페이지다. `src/`·`index.html`에 손으로 쓴 절대경로(`/assets`, `/harness` 등)가 없다: `index.html`의 `/src/main.tsx`는 vite가 빌드 때 base를 붙이고, `harness/*.html`은 개발 서버 전용(빌드 입력이 아님, `dist`에 없음), `ErrorBoundary`의 `location.assign(location.pathname)`은 `/spoongame/` 아래에서도 그 자리로 돌아오므로 그대로 동작한다. localStorage 키는 경로와 무관. 그래서 `src/` 변경 0.
- base는 환경변수 `PAGES_BASE`로만 바뀐다. 로컬 `dev`·`e2e`(5199)·`e2e:prod`(4199)·`preview`는 변수 없이 `/` 그대로.
- 404.html 불필요: 단일 페이지라 `/spoongame/`만 쓰이고 새로고침도 같은 주소다(저장은 localStorage).
- 주의: Windows Git Bash는 `PAGES_BASE=/spoongame/`·`--base /spoongame/` 같은 인자를 `C:/Program Files/Git/spoongame/`으로 바꾼다(MSYS 경로 변환). 처음엔 이 때문에 잘못된 dist가 나왔고, 그래서 `resolvePagesBase`가 그런 값을 오류로 멈추게 했다. Windows에서는 PowerShell(`$env:PAGES_BASE='/spoongame/'`)을 쓰거나 Git Bash에서 `MSYS_NO_PATHCONV=1`을 붙인다. (CI는 Linux라 해당 없음.)

## 워크플로 요약 (`deploy.yml`)
- 트리거: `push` to `main`, `workflow_dispatch`. 권한: `contents: read`, `pages: write`, `id-token: write`(기본 GITHUB_TOKEN만, secrets 없음). `concurrency: pages`, `cancel-in-progress: false`.
- Node 24(로컬 v24.18.0과 같은 메이저), `cache: npm`, `npm ci`. timeout: build 20분(로컬 `npm test` 약 65~80초), deploy 10분.
- Playwright e2e는 넣지 않음(브라우저 설치가 무거움) — 이유를 워크플로 주석에 남겼다.
- 액션 버전은 `git ls-remote --tags`와 릴리스 정보로 확인한 현재 최신 안정 메이저로 고정: `actions/checkout@v7`, `actions/setup-node@v7`, `actions/configure-pages@v6`, `actions/upload-pages-artifact@v5`, `actions/deploy-pages@v5`(지시서 예시 v4/v4/v5/v3/v4는 모두 이전 메이저). 문제가 생기면 한 단계 낮은 메이저(v6/v6/v5/v4/v4)로 되돌리면 된다.
- 빌드 후 `dist/index.html`이 `/spoongame/assets/`를 가리키는지 grep으로 확인하는 단계를 넣어, base가 빠진 산출물이 배포되지 않게 했다.

## 확인 결과 (로컬, Windows)
- `npm run typecheck` 에러 0.
- `npm test`: 25파일 **1122 통과**(기존 1101 + 새 21), 69초.
- `npm run build`(base `/`): 이벤트 검증 통과(파일 5개, 이벤트 112개), `dist/index.html`이 `/assets/index-DKOibeYp.js`·`/assets/index-cY9FSJJ7.css` — 이번 변경 전과 해시까지 같다(번들 불변).
- `PAGES_BASE=/spoongame/` 빌드(PowerShell): `dist/index.html`이 `/spoongame/assets/index-DKOibeYp.js`·`/spoongame/assets/index-cY9FSJJ7.css`를 가리킴. 번들 JS·CSS 파일 내용은 base 값과 무관(같은 해시).
- `npx vite preview --base /spoongame/ --port 4380`(포트 4380, PowerShell로 실행) + 임시 Playwright 스크립트(360x740): 타이틀 → 시대 선택 → 출생 → 인생 화면(「0세 · 영유아」)까지 동작, 오류 화면 0, 저장 phase `life`, 새로고침 후에도 인생 화면 유지, 요청 9건 전부 `/spoongame/` 하위·200, console/page 오류 0. 확인 후 서버 종료, 임시 스크립트·스크린샷 삭제.
- 깨끗한 clone(LF, `core.autocrlf=false`)에 변경분을 얹어 `typecheck` → `npm test`(1122 통과, 64초) → `PAGES_BASE=/spoongame/` 빌드까지 통과: 무시된 파일(dist·qa 원자료 등)에 기대는 테스트가 없음을 확인. (clone 때 `core.autocrlf=true` 기본값이면 `tests/eventDistribution.test.ts`의 「docs/data/events-distribution.md는 …」 1건이 CRLF 때문에 실패한다 — 이 저장소 로컬 설정이 `autocrlf=false`이고 CI(Linux)는 LF라 배포에는 영향 없음. 아래 "참고".)
- 마지막에 base `/`로 다시 빌드해 `dist`를 원래대로: `dist/index.html`이 `/assets/...`.
- `npm run e2e`(포트 5199): **272 passed, 54 skipped**(2.3분). `npm run e2e:prod`(포트 4199, 빌드 포함): **4 passed**. 5173·5174·4173은 건드리지 않았다(5173·5174는 형진 님이 쓰는 중).
- `npm run check:todo`: 테스트 목록 vitest 1122 + e2e 326 + e2e-prod 4, `[x]` 25개 대조 → 실패 0, 경고 0. `npm run check:dist` 통과.
- 워크플로·이슈 양식 YAML은 파서로 읽어 구조 확인. **GitHub 위에서 실제로 돌려 보진 못했다**(Pages 켜기·push는 마스터/형진 님 몫) — 첫 실행 결과는 push 후 Actions 탭에서 확인해야 한다.

## 형진 님이 GitHub에서 할 일
1. 저장소 → **Settings → Pages → Build and deployment → Source: "GitHub Actions"** 선택(한 번만). 이걸 하지 않으면 `configure-pages` 단계가 "Pages가 켜져 있지 않다"며 실패한다.
2. `main`에 push(또는 **Actions 탭 → "Deploy to GitHub Pages" → Run workflow**) → 약 3~5분 뒤 `https://hyungjin87c-ux.github.io/spoongame/`.
3. 공개 저장소의 Pages가 보이려면 저장소가 Public이어야 한다(이미 공개). 첫 배포 때 **Settings → Environments → github-pages**가 자동 생성되며, 기본 규칙(main에서 배포 허용)이면 손댈 것 없다.
4. (선택) **Issues → Labels**에서 `feedback` 라벨을 만들어 두면 의견 이슈에 자동으로 붙는다(라벨이 없으면 그냥 안 붙을 뿐 양식은 동작). 인앱 「의견 보내기」(SPEC-003) 링크는 `https://github.com/hyungjin87c-ux/spoongame/issues/new?template=feedback.yml`을 쓰면 이 양식이 열린다.

## 참고 (마스터 판단용)
- Windows에서 이 저장소를 `core.autocrlf=true`(Git for Windows 기본값)로 새로 clone하면 `tests/eventDistribution.test.ts` 1건이 CRLF 때문에 실패한다. 필요하면 `.gitattributes`(`* text=auto eol=lf` 등)로 고정할 수 있으나 이번 범위 밖이라 손대지 않았다.
- 작업 중 다른 에이전트가 `wiki/`·`docs/spec/SPEC-003-개편.md`·`ai-log/2026-10-15_SPEC-003_spec.md`를 바꾸고 있었다(내가 만든 변경 아님).
- `docs/TODO.md`에는 배포 관련 항목이 없어 체크할 항목이 없다(SPEC-003 확정 후 planner/마스터가 항목을 만들면 근거: `.github/workflows/deploy.yml`, `scripts/pagesBase.ts#resolvePagesBase`, `tests/pagesDeploy.test.ts`).
- 다음 단계: 마스터가 변경분 커밋·push → Pages 설정(위 1번) → Actions 첫 실행 결과 확인 → 필요하면 액션 메이저 조정.
