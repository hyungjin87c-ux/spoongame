# CX-003 재검증 요청 (2회차) — SPEC-018 M1 코드: CX-003 지적 처리 확인

| 항목 | 값 |
|---|---|
| 리뷰 ID | CX-003 (2회차 — 재검증) |
| 유형 | A 구현 감사(수정 확인) + B 적대적 QA(수정한 두 경로) |
| 대상 브랜치 | `review/CX-003-r2` (대상 커밋 `20caef1f62127381e44bc98eb5167721352b6171` 위에 이 요청서만) |
| 비교 기준 | `736d15a`(1회차 대상) → `20caef1` |
| 레인 | CRITICAL — 확률·게임 규칙(진로 슬롯과 일반 추첨의 순서)·소득·저장 범위 |
| 작성 | Claude Code 마스터, 2026-11-12 |

## 1. 검증자에게 (먼저 읽기)
- 너는 독립 검증자다. 코드·문서를 고치거나 커밋·배포하지 않는다. 결과는 같은 폴더의 `findings-2.md` 한 파일로만(형식 `docs/review/codex/TEMPLATE-findings.md`, 지적 ID는 `CX-003-101`부터).
- 이번에는 **1회차 너의 결과(`findings.md`)와 Claude의 처리(`resolution.md`)를 읽어도 된다** — 처리가 지적을 실제로 막았는지 보는 재검증이다. 그 밖의 읽지 않을 경로는 1회차와 같다: `docs/review/`의 다른 폴더, `qa/`, `ai-log/`, `docs/TODO.md`, `wiki/`.
- 시험·재현용 임시 파일은 끝나면 지운다. `npx`는 쓰지 말고 `npm run …`·`npm exec -- vitest …`·`./node_modules/.bin/vite-node …`를 쓴다. `node_modules`는 원 저장소의 것을 연결해 두었다 — `npm install`·`npm ci`를 하지 않는다. 연결된 폴더라 vitest는 `--no-cache`로 돌린다.

## 2. 무엇이 바뀌었나 (`resolution.md` 1절 요약)
| 1회차 지적 | 처리 | 코드 |
|---|---|---|
| 002 19세 입시 | 분야 카드가 열리는 해에 `college`를 켜는 사건(풀 색인 `flagSettersOf`)이 그 해 후보이면 일반 선택지 추첨(`pickWeighted`)을 먼저 돌려, 대학 지원이 뽑히면 그것을 내고 아니면 분야 카드를 낸다. 난수는 어느 쪽이든 한 칸 | `src/core/life.ts#stepYear`(`examFirst`·`trackRngSpent`) |
| 001 첫 일 소득 중복 | 옛 카드의 출현 조건 `notFlags: has_career·own_business`를 합격 소득에도 옮겼다 | `src/core/careerTrack.ts#careerIncomeOf` |
| 003 지원 난수 재사용 | 저장 범위 `MODEL triesMax` 9 → 16 | `src/data/personaTable.ts` · `persona.ts`(범위 검사) |
| 004 스위치 끔 복원 | 끈 채 열면 진로 카드 대기를 `stale-pending`으로 풀고 그 해를 중립으로 다시 진행 | `src/core/storage.ts#pendingMatchesPool` |
| 005 격자 | 직업 id 칸을 코어 직업 색인의 실제 분야로 | `src/core/eventLint.ts#gridCells` |
| 006 경제 | 판정 표본 6,000판 명시, 001·002 뒤 재측정, 알려진 차이 한계 「측정 − 0.3」 | `scripts/economyCheckLib.ts` · `docs/data/economy-model.md` 9-4-SPEC-018 |
| 007 집계 | 진로 카드 틱에 `career: true`, 집계가 그것을 읽는다 | `src/core/life.ts#count` |

회귀 시험: `tests/careerStudyDecision.test.ts`(새) · `careerIncome` · `personaSwitch` · `jobApply` · `storagePersona` · `personaDoc` · `visibleChoiceGrid`. 1회차 대상 커밋에서 이 중 9건이 실패하고 지금은 통과한다.

## 3. 검증 질문
1. **002 (첫 질문)**: `examFirst` 경로가 맞춤 인생이 없는 판과 같은 조건으로 대학 지원을 내는가 — 간격(`canChoice`)·페이싱(`choiceChance`)·후보(R-561·가족 줄 가림 `eligible`)·가중(`pickWeighted`의 `selfAreaWeightFactor`)·난수 칸 수. 대학 지원이 뽑힌 해의 연표·`seen`·`lastChoiceAge`·대기, 뽑히지 않은 해의 분야 카드가 1회차와 같은가. 부모님이 정하는 나이(19세 미만)·가족 강제 사건이 있는 해·`TRACK_WINDOW_END`(24세)·재수(`youth-exam-prep`)와 겹칠 때 새 막다른 길이나 이중 카드가 생기는가. 1회차 재현 상태(밀레니얼 시드 4, 2014년)와 짝 비교(시드 1~220, 4세대)를 다시 돌려 달라.
2. **001**: `has_career`·`own_business`가 이미 있는 판에서 첫 합격 소득이 0이 되는 것이 옛 첫 일 카드의 의미와 같은가 — 진로 트랙 중간에 `youth-gig-work`(settle)·`youth-exam-prep`(work)이 `has_career`를 켠 판, 모르는 직업 id를 정리한 뒤 재합격, v0.5.1 왕복(옛 카드를 푼 저장) 세 경로를 끝까지 재생해 소득이 한 판에 한 번인지, 반대로 받아야 할 판이 못 받는 경우가 없는지.
3. **003·004·005·007**: 처리가 1회차 재현을 막는지, 새 문제(저장 범위 0~16과 v0.5.1·736d15a 파서의 왕복, 끈 채 연 뒤 다시 켠 판, 격자 칸 수 증가로 빌드 시간)가 생기지 않았는지.
4. **검증 코드 이동(초기 로드)**: `core/events.ts`의 이벤트 파일 전용 검증을 `core/eventValidate.ts`로, `core/jobs.ts`의 `jobTableProblems`를 `core/jobValidate.ts`로 옮겼다(공용 도우미는 `events.ts#EVENT_CHECK`). 옮기며 검사 하나라도 빠지거나 바뀌었는가(같은 데이터에 같은 문제 목록 — 일부러 틀린 사건 몇 개로 대조), 첫 덩어리·지연 덩어리 배치가 의도대로인가(`npm run build` 뒤 `dist/assets`).
5. **측정·기준 변경**: 2회차에서 바꾼 시험 기준 — `stat20Guard` 기준선(지식 +0.5), `simulation`·`judgeMargins`의 알파 노년 허용 폭(0.20 · −7 SE)과 X 노년 줄 단위(0 SE), `KNOWN_GUARD_GAPS` 「측정 − 0.3」 — 이 결함을 가리지 않는가.

## 4. 시험 결과 (작성자 측)
- **T0 통과**: `npm run typecheck` · `check:events` · `check:todo` · `check:motifs` · `check:era-art`.
- **npm test 전체**(검증 코드 이동 뒤): 5,585 통과 · 실패 5 — 모두 잠금 시험(목록 창 CSS 값·점검 메시지 위치·스크롤 막대 규칙의 `@supports`·`:hover` 개수)이라 고친 뒤 해당 9파일 279건 통과. 그 전 회차(CX-003 처리 뒤) 전체: 실패는 이유를 적은 기준선·허용 폭 갱신 7건뿐.
- **e2e**: 바뀐 spec(첫 화면 3·엔딩·m7c·m5·m4-focus) 통과. **남은 것**(별도 작업): R-438 360×740-touch `log-list` 프로그램 포커스(SPEC-018 판 배치) · WebKit BGM 볼륨 막대 4건(main v0.5.1에서도 실패 — SPEC-016 회귀). v0.5.1 회귀 10건은 이 범위에서 고쳤다(제외 범위 참조).
- **e2e:prod** 33 통과 · 1 건너뜀: 초기 로드 Chromium 393,576 · WebKit 397,601 B(≤ 400,000).
- **경제** `npm run check:economy`(6,000판): 불합격 0(알려진 차이 한계 안).
- 빠른 실행 예: `npm exec -- vitest run --no-cache tests/careerStudyDecision.test.ts tests/careerIncome.test.ts tests/personaSwitch.test.ts tests/jobApply.test.ts tests/visibleChoiceGrid.test.ts tests/storagePersona.test.ts`.

## 5. 제외 범위
- 1회차 제외 범위 그대로(문장 품질·화면 배치·PL5/PL6/PL17·얼굴 그림·숫자 목표의 높낮이).
- 대상 범위 안의 v0.5.1 회귀 수정(첫 화면 목록 창 식·볼륨 포커스·엔딩 버튼 시험·세대 목록 스크롤 막대·`focusReveal`)은 SPEC-016·화면 손질이라 이번 질문 밖이다(보다가 결함을 보면 적어 달라).

## 6. 알려진 제약
- 진로 카드에는 질문 문장이 없다(스키마) — PL5에서 정한다.
- 수저 40대 비(3.0~3.97배)·알파 노년(진로 카드로 −0.08장)은 PL5·GM10 뒤 다시 잰다.
