# CX-007 회차 2 검증 요청 — 001·002 수정 재검증 (좁은 범위)

| 항목 | 값 |
|---|---|
| 리뷰 ID | CX-007 회차 2 |
| 유형 | A 구현 감사 + B 확인(001 화면) — **수정 diff만** |
| 대상 브랜치 | `review/CX-007-r2` (대상 커밋 `c9e4dbfa` 위에 이 요청서만) |
| 비교 기준 | `0b0560e142b9ae0c85515f9a7f41b4057505ddf0`(회차 1 대상) → `c9e4dbfa` |
| 작성 | Claude Code 마스터, 2026-11-19 |

## 1. 검증자에게
- 회차 1과 같은 규칙(코드 수정·커밋·배포 금지, 결과는 같은 폴더의 `findings-2.md` 한 파일, FAIL 증거만 `qa/screenshots/CX-007/`).
- 이번에는 이 폴더의 `findings.md`(회차 1 — 네가 쓴 것)와 `resolution.md`(마스터 처리 기록)를 읽어도 된다. 그 밖의 읽지 않을 경로는 회차 1 요청서 1절과 같다.
- 범위는 아래 diff다. 회차 1에서 이미 확인한 범위(초점·크레딧·얼굴·판 길이·첫 로딩)를 다시 돌리지 않는다.

## 2. 대상 diff (`git diff 0b0560e..c9e4dbfa -- src scripts tests e2e package.json`)
| 커밋 | 내용 |
|---|---|
| `e32953b2` | **001**: `src/ui/dash/DecisionCard.tsx` — `DecisionModel.text = decisionTextOf(game, ev) = eventTextOf(ev, condContextOf(game))`, 화면 `choice-text`가 그 글을 그린다 · `tests/decisionText.test.tsx`(재현 다섯 경우 + 19세 미만 선택 사건에 본문 변주 없음). **002**: `scripts/romanceReportLib.ts#romanceRichBoundary` · `scripts/personaReport.ts` · `scripts/romanceReport.ts` — 기본 경계를 데이터에서 읽음 |
| `a0369b3b` | 새 소식 v0.6.1(`src/data/releaseNotes.ts`) · `package.json` 0.6.1 · `e2e/info-panel.spec.ts`가 지금 버전·버전 수를 `RELEASE_NOTES`에서 읽음 — 회차 1 대상 밖이던 커밋. 게임 코드 변경이 없는지만 본다 |

## 3. 검증 질문
1. 회차 1 재현 부록의 다섯 경우(`A-high`·`B-unemployed`·`B-career`·`B-past`·`C-sport`)에서 실제 화면(`choice-text`)이 조건에 맞는 변주이고, 새로고침 뒤에도 같으며, 선택 뒤 연표 결과 문장과 어긋나지 않는가. 빠듯한 경우(`A-low`)는 기본 본문인가.
2. `decisionTextOf`가 쓰는 문맥(대기 중인 판의 `condContextOf`)이 카드가 뽑힌 때와 달라지는 경로가 있는가(같은 해 G2 원서 효과 · 부모 위임 · 자동 모드 인라인 카드 · 접힌 띠 다시 열기).
3. 부모·흘러감 카드(`ParentCard`)와 카드 읽기 필요량이 `ev.text`를 쓰는 전제(19세 미만에 열리는 선택 사건에 본문 변주가 없다)를 시험이 실제로 잠그는가.
4. `report:persona -- … --only=romance`의 기본 경계가 데이터(12,000)와 같고, `--net`으로 다른 값을 주면 탐색용 표기가 붙는가. 세 풀 결혼 비(C)의 수치는 바뀌지 않는가.
5. `a0369b3b`가 게임 코드·저장·확률을 바꾸지 않는가(문구·버전·시험 기대값만).

## 4. 제외
- 회차 1에서 확인한 범위 전부, 문장 취향.
