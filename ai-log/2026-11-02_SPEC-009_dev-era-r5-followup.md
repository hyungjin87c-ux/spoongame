# 2026-11-02 SPEC-009 dev-era-r5-followup — 시대의 창 검수 1회차 낮음 지적 반영 (REV-009-ERA5-1)

- 누가: developer (마스터 의뢰 2026-11-02, 표준 레인, 브랜치 `spec-009`, **커밋은 마스터가 한다**). 정본 `docs/review/REV-009-ERA5-1.md`(맨 아래 「마스터 처리」·「반영 내역」). 규칙: 검수자 diff는 해석·변형 없이 그대로 적용하고 시험을 다시 돌린다.
- 무엇: R-570(sceneGolden 머리 주석) · R-571(LogList 반올림 오차 누적 제거 + LR2 기준 되돌림) · R-572(빈 틀 e2e의 막힘 확인) + 마스터 추가 의뢰(R-571 재적용, `e2e/family-scene` 흔들림 고침).
- 결과: 셋 다 적용됐다. R-571은 처음 적용에서 소스 문장 시험 1개가 깨져 한 번 되돌렸다가(2절) 마스터 결정으로 정규식을 고쳐 다시 적용했다. family-scene 시험 셋은 원인별 기다림으로 고쳤다(3절). 다음 단계: QA(src 변경 끝남).

## 1. 지적별 처리

| 지적 | 처리 | 고친 곳 |
|---|---|---|
| R-570 | diff 그대로(머리 주석 한 문단) | `tests/sceneGolden.test.ts` 머리 주석 「시대의 창 r5 반영 갱신」 |
| R-572 | diff 그대로(`blocked` 카운터 + `expect.poll`) | `e2e/family-scene.spec.ts` "시대의 창 덩어리를 받지 못한 판(2016년, 2010년대 덩어리 요청 차단)의 창은 빈 틀이다" |
| R-571 | diff 둘 그대로 + 마스터 결정의 정규식 한 줄 | `src/ui/dash/LogList.tsx`(`rememberKept`, `getSnapshotBeforeUpdate`의 `anchorOffset`, `componentDidUpdate` 두 곳), `e2e/log-order.spec.ts`(8배속 기준 2px), `tests/logOrder.test.tsx` 386행 정규식 `this\.remember(?:Kept)?\([^)]*\);` |

## 2. R-571 경과 (값 포함)

1. 첫째 diff 적용. 넓힌 기준 그대로 `e2e/log-order`: Chromium(desktop·mobile-360) **56 passed**, WebKit LR2 **8 passed**. 둘째 diff(기준 2px) 뒤 LR2: Chromium 8, WebKit 8, 8배속 Chromium 3회 반복(6개) 모두 통과.
2. 그런데 `npm test`에서 **1개 실패**: `tests/logOrder.test.tsx:386` "LogList가 늦게 온 시대 줄에도 보던 자리를 지킨다…" — 소스 글을 읽는 정규식이 시대 줄 분기에서 `this.remember(rows);`를 그대로 요구하는데 diff가 그 자리를 `this.rememberKept(rows, snap);`로 바꾼다. 마스터 지시(다른 시험이 깨지면 LogList 변경까지 되돌리고 넓힌 기준 유지)에 따라 `git checkout`으로 두 파일을 되돌리고(시험을 맞춰 고치지 않았다) 보고했다. 되돌린 상태에서 `npm test` 165개 파일 4612 passed · 1 skipped, LR2 8배속은 넓힌 기준으로 통과.
3. 마스터 결정(2026-11-02): 걸림돌이 소스 글자 정규식 한 줄이고 `rememberKept`가 안에서 `remember`를 부르므로 시험의 뜻은 그대로다 → 보존해 둔 patch(저장소 밖 임시 폴더)를 `git apply`로 다시 적용하고 정규식만 `this\.remember(?:Kept)?\([^)]*\);`로 바꿨다.
4. 재적용 뒤 검증: `tests/logOrder.test.tsx` **35 passed**, `e2e/log-order` Chromium desktop·mobile-360 **56 passed**(기준 2px), WebKit LR2(webkit-desktop·webkit-mobile-360) **8 passed**, 8배속 Chromium 3회 반복 **6 passed**. 실패 없음 — 되돌릴 일이 생기지 않았다.

## 3. family-scene 흔들림 고침 (마스터 요청, 워커 수로 가리지 않음)

원인은 셋이었고 모두 시험의 기다림이었다. 앱 결함으로 볼 만한 것은 나오지 않았다(아래 끝에 판단).

| 시험 | 원인 | 고친 곳 |
|---|---|---|
| 「배치(FM2d)」(mobile-360에서 `#scene-era .era__pic` 상자가 null) | `data-scene-art="ready"`는 집 그림 덩어리의 준비 표시이고 시대의 창(10년대 묶음)은 따로 도착한다. 도착 전에는 빈 틀이라 `.era__pic`이 아직 그 모양이 아닌 순간에 쟀다 | `ready` 뒤 `#scene-era`에 `data-empty="true"`가 풀리고 `#scene-era .era__pic`이 보일 때까지 기다린 다음 잰다 |
| 「해가 바뀌면 그림과 연도 표가 바뀐다」(`pause` 클릭 시간 초과, `decision-overlay`가 가로챔) | `FAST`(`__timescale=1000`)에서 한 해가 50~80ms다(탐침 측정: 0세→13세 930ms, 13세 결정 모달 1030ms). `expect.poll` 기본 간격(100·250·500·1000ms)이면 모달이 이미 뜬 뒤에 「나이 ≥ 4」를 확인하고 「일시정지」를 누르려다 막혔다. 부하가 걸리면 자주 났다 | 이 시험만 새 상수 `STEADY`(`__timescale=100`, 측정상 한 해 약 0.3초, 13세 모달이 약 4초)로 돌리고 폴링 간격을 50ms로 줄였다 |
| FH9 「요청이 막혀도 게임은 계속되고…」(「다시 불러오기」 클릭 시간 초과) | 같은 원인 + 달리는 판에서 5·7세 부모님 카드가 끼어들며 줄을 밀거나(비모달, 클릭 대상이 움직이는 동안 가로챔) 13세에 결정 모달이 뜸 | `STEADY` + 「게임은 계속된다」(나이가 오른다)를 확인한 즉시 「일시정지」를 누르고 그 뒤에 풀고 다시 불러오기 |

- 탐침으로 `FAST`·100·30배에서 나이별 도달 시간을 잰 임시 시험(`e2e/_probe-tmp.spec.ts`)은 측정 뒤 지웠다(`git status`에 없음).
- 과부하 재현: `--repeat-each=14 --workers=10`으로 「해가 바뀌면…」이 28개 중 20개 실패(`page.goto` 시간 초과 10 = 개발 서버 과부하, `pause` 클릭 가로챔 8 = 위 원인). 고친 뒤 기본 워커로 확인했다.
- 결과: 기본 워커(7)로 3번 연속 **34/34 passed**(51.1·56.5·49.8초), `--repeat-each=3`(102개) **102/102 passed**(2.0분). 고치기 전 같은 `--repeat-each=3`은 100/102(FH9 2개 실패).
- **앱 결함 판단**: FH9의 실패에서 「결정 모달이 떠 있는 동안 「다시 불러오기」를 누를 수 없다」는 모달 설계대로다(결정을 한 뒤에는 누를 수 있다). 부모님 카드는 대시보드 가운데 열 맨 위에 흐름대로 끼어드는 비모달 카드라 그림 카드 위치가 밀릴 수 있다 — 「복구할 길이 없음」이 아니라 일반적인 레이아웃 이동이다. 시험으로 덮을 앱 결함은 찾지 못했다.

## 4. 최종 상태의 시험 수치 (R-570·R-571·R-572 + family-scene 고침 모두 적용 뒤, 겹쳐 돌리지 않고 차례로)

| 확인 | 결과 |
|---|---|
| `npm test` | 165개 파일 · **4612 passed · 1 skipped**(종전과 같은 1건) · 실패 0 (805초) |
| `npm run typecheck` | 통과 |
| `npm run build` (typecheck + validateEvents + vite build) | 통과 |
| `npm run check:todo` | 통과 — `[x]` 323개 대조, 실패 0 · 경고 0 |
| `e2e/log-order` (2px 기준) | Chromium desktop·mobile-360 56 passed, WebKit LR2 8 passed, 8배속 3회 반복 6 passed |
| `e2e/family-scene` (Chromium, 기본 워커) | 3번 연속 34/34, `--repeat-each=3` 102/102 |

## 5. 정리
- 서버는 playwright의 webServer로만 띄웠고(5199·5198) 시험이 끝날 때마다 playwright가 내렸다.
- 한 번 `python -` 빈 입력으로 멈춘 백그라운드 셸이 있어 그 작업만 중지했다(서버 아님).
- e2e가 바꾼 `qa/screenshots`는 없다. `test-results`·`dist`는 gitignore 대상.
