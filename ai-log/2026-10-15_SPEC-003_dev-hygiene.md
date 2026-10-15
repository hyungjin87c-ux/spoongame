# 2026-10-15 SPEC-003 dev-hygiene (푸시 전 공개 저장소 위생, REV-003-M6a-2 R-188)

- 누가: developer
- 무엇을: 공개 저장소에 올라갈 파일에서 사용자 이름이 든 로컬 절대 경로(사용자 폴더 경로)를 없애고, 그런 것이 다시 올라가지 않게 위생 검사를 저장소 전체로 넓혔다. 커밋·푸시는 하지 않았다(마스터가 한다). `src/`·`e2e/`·`qa/reports`·`qa/screenshots`는 건드리지 않았다(qa가 첫 화면 QA 중).
- 이 기록에도 사용자 이름·실제 경로는 적지 않았다.

## 찾은 곳 (전수 조사)
깃이 추적하거나 새로 올라갈 파일 전체(node_modules·dist·test-results·playwright-report·`.gitignore` 대상 제외, 그림 제외)를 사용자 이름 조각, `드라이브:\Users`·`드라이브:/Users`·Git Bash 꼴·URL 인코딩 꼴·`/Users/`·`/home/`로 찾았다. 현재 파일 중 걸린 곳:

| 파일 | 내용 | 처리 |
|---|---|---|
| `HANDOFF.md:6` | 시작 방법의 cd 예시에 전체 경로 | `cd "<프로젝트 폴더>"   # 이 저장소를 내려받은(또는 열어 둔) 폴더로 이동` |
| `qa/scripts/f-breakevents.sh:3` | `ROOT="…절대 경로…"` | `ROOT="$(cd "$(dirname "$0")/../.." && { pwd -W 2>/dev/null \|\| pwd; })"` (스크립트 위치 기준. Windows Git Bash는 뒤의 PowerShell 명령이 읽는 `C:/…` 꼴이 필요해 `pwd -W`) |
| `qa/results/final/F-R-vitest.txt:6` | vitest 실행 기록 머리의 작업 폴더 경로 | 경로 부분만 `<프로젝트 루트>` (색 코드·나머지 기록은 그대로) |
| `ai-log/2026-10-15_SPEC-003_dev-M6a.md:47` | 깨진 경로 표기 조각 | 「사용자 폴더 경로」 |
| `tests/spec003Baseline.test.ts:186-188` | 「없어야 한다」 단언에 쓴 사용자 이름 글자 | 글자 대신 실행 환경에서 읽음 (아래) |
| `docs/data/korea-stats-sources.md:48` | 접근 기록 원본 위치 서술 | 「원본(`requests-r2.log`)은 저장소 밖·비공개(`*.log`는 `.gitignore`), 요약 표로 갈음」 |

그 밖에 이름이 든 곳은 **없었다**. 참고로 `hyungjin87c-ux`(GitHub 계정 = 공개 저장소 주소)는 의도해서 공개한 주소라 대상이 아니고, 커밋 작성자도 GitHub noreply 주소 3건뿐이다(`git log`로 확인).

## 새 위생 검사
- `tests/helpers/localPathLeaks.ts` — 감지기. `findLocalPathLeaks(text, accountNames)`는 걸린 곳을 `{rule, line}`로만 돌려준다(글자는 담지 않음). `localAccountNames()`는 `os.userInfo().username`·`os.homedir()` 마지막 폴더를 읽고, 4자 미만이거나 흔한 계정 이름(runner·root·ubuntu …)이면 뺀다(`usableAccountNames`). 글자뿐인 이름은 낱말 경계로, 기호가 섞인 이름은 부분 문자열로 찾는다.
- `tests/helpers/repoFiles.ts` — `listRepoTextFiles()`: `git ls-files --cached --others --exclude-standard`(깃 불가 시 폴더 걷기 + `ignoreMatcher`로 `.gitignore`의 간단한 규칙 해석), 확장자로 텍스트만 거름, `readRepoText()`(12MB 초과·삭제된 파일은 건너뜀).
- `tests/repoHygiene.test.ts` — 17개: 감지기 자체 시험(가짜 경로는 조각을 이어 붙여 만듦: 역슬래시·슬래시·겹역슬래시·깨진 꼴·소문자·URL 인코딩·Git Bash·홈 경로, 줄 번호만 돌려줌, 정상 문구·CI 러너 경로 통과, 이름 감지 규칙, 흔한 이름 걸러내기, CI처럼 runner일 때도 일반 패턴은 동작), `.gitignore` 해석 3개, 대상 목록 4개(빈 목록 방지·핵심 파일 포함·제외 규칙·폴더 걷기 대비책), 저장소 전체 3개(파일 경로, 내용의 일반 패턴, 내용의 계정 이름).
- `tests/spec003Baseline.test.ts` — R-155 테스트는 같은 감지기를 쓰도록 바꿈(이름 글자 제거).

### CI에서의 동작
- GitHub Actions 계정은 runner라 계정 이름 검사는 건너뛰고 **일반 경로 패턴만** 본다(드라이브 문자 + 사용자 폴더 꼴 등). 작성자 이름 자체는 내 컴퓨터에서 푸시 전 `npm test`로 잡는다는 한계를 테스트·감지기 머리 주석에 적었다.
- 워크플로(`deploy.yml`)가 `npm test`를 돌리므로 새 테스트도 CI에서 돈다. 체크아웃에 `.git`이 있어 깃 목록을 쓰고, 못 쓰면 폴더 걷기로 내려간다.

## 시행착오
- 처음 감지기 주석과 테스트 표본에 경로 꼴을 글자 그대로 적었더니 감지기가 자기 파일을 잡았다 → 주석은 말로 풀고 표본은 `join`으로 이어 붙임.
- `https:`의 마지막 글자 `s`를 드라이브 문자로 보지 않게 「앞에 영문·숫자가 없는 한 글자」일 때만 드라이브 문자로 센다(주소 `https://users.example.com/` 시험 포함).
- 슬래시 꼴 경로가 드라이브 규칙과 홈 폴더 규칙에 두 번 잡히던 것을 한 번만 세게 고침(홈 규칙 앞에 `:`가 오면 제외).

## 결과
- `npm run typecheck`: 통과.
- `npm test`: 41개 파일 중 40개 통과, 1개 실패 — 1634개 중 1632 통과. 실패 2건은 모두 `tests/repoHygiene.test.ts`의 저장소 전체 검사이고 원인은 **qa가 만드는 미추적 임시 파일 `qa/scripts/_probe.mjs` 19~20줄**의 사용자 폴더 경로 두 곳뿐이다(qa 작업 중이라 손대지 않음; 걸린 파일은 이것 하나). 즉 검사가 의도대로 동작했다. 그 파일을 지우거나 경로를 없애면 통과한다.
- `npm run check:todo`: 통과(`[x]` 항목 42개, 실패 0, 경고 0).
- 스크립트 `f-breakevents.sh`: `sh -n` 문법 검사 통과, ROOT 해석 확인(`package.json` 존재). 전체 실행은 하지 않음(`qa/results/final/F-A99-break-events.txt`를 덮어쓰고 복사본 빌드를 여러 번 돌림).

## 다음 단계
- qa 종료 후 `qa/scripts/_probe.mjs`(및 같은 시기 새 임시 파일)를 지우거나 정리하고 `npm test` 다시 확인(마스터/qa). `qa/scripts/m2-lib.mjs`는 경로가 없어 걸리지 않음.
- `check:motifs` 원문 겹침 0 확인은 마스터(원본 CSV가 저장소 밖).
- 이미 공개된 지난 커밋(851bbaf)의 옛 경로는 그대로다. 기록 재작성(강제 푸시)은 하지 않기로 했고 필요하면 형진 님 판단.
- 수정 파일은 커밋 전이다: HANDOFF.md, docs/TODO.md, docs/data/korea-stats-sources.md, docs/review/REV-003-M6a-2.md, ai-log/2026-10-15_SPEC-003_dev-M6a.md, ai-log/2026-10-15_SPEC-003_dev-hygiene.md, qa/scripts/f-breakevents.sh, qa/results/final/F-R-vitest.txt, tests/spec003Baseline.test.ts, tests/repoHygiene.test.ts(신규), tests/helpers/localPathLeaks.ts(신규), tests/helpers/repoFiles.ts(신규).
