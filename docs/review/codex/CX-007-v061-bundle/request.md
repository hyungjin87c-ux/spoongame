# CX-007 검증 요청 — v0.6.1 묶음(이름 크레딧 EC1 · 교제 카드 PL17-R · 밀레니얼 얼굴 PL13 · 초점 코어 PL10(꺼짐) · CX-006-001 재검증)

| 항목 | 값 |
|---|---|
| 리뷰 ID | CX-007 |
| 유형 | **A 구현 감사 + B 적대적 QA**(결정 후속 262 — v0.6.1 묶음 한 번) |
| 대상 브랜치 | `review/CX-007` (대상 커밋 `0b0560e142b9ae0c85515f9a7f41b4057505ddf0` 위에 이 요청서만) |
| 비교 기준 | `f285373e2f706ee56964a8f7b7e2468a27a4ac88`(CX-006 대상 — G2까지 검증을 마친 코드) → `0b0560e142b9ae0c85515f9a7f41b4057505ddf0` |
| 레인 | CRITICAL — 사건 확률·교제 노출·결혼 사슬 진입(PL17-R) · `src/core/` 추첨 곱·저장 필드(PL10) · 판정 임계(CX-006-001) / STANDARD — 새 화면(EC1)·그림 적용(PL13) |
| 작성 | Claude Code 마스터, 2026-11-18 |

## 1. 검증자에게 (먼저 읽기)
- 너는 독립 검증자다. 코드·문서를 고치거나 커밋·배포하지 않는다. 결과는 같은 폴더의 `findings.md` 한 파일로만(형식 `docs/review/codex/TEMPLATE-findings.md`). 유형 B의 FAIL 재현 증거 스크린샷만 `qa/screenshots/CX-007/<케이스ID>.png`에 둔다(RECORD는 글로).
- 시험을 돌리거나 재현용 임시 시험·스크립트를 만들어도 된다. 끝나면 지운다. `npx`는 쓰지 말고 `npm run …`·`npm exec -- vitest …`·`npm exec -- playwright …`·`./node_modules/.bin/vite-node …`를 쓴다. 띄운 개발 서버는 끝나면 내린다.
- **첫 검증에서 읽지 않는다**: `docs/review/`(이 요청 폴더와 `codex/TEMPLATE-*` 제외 — 다른 CX·REV 기록 모두), `qa/`(스크린샷 쓰기는 예외), `docs/TODO.md`, `wiki/`, 그리고 `ai-log/`의 **`decisions-2026-11.md`를 뺀 전부**(특히 `ai-log/2026-11-18_*`는 작성자의 구현·측정 결론이라 읽지 않는다). `decisions-2026-11.md`는 후속 255·257·261·262·264·265·266·267·268만 읽는다. `.coding-rules.md`는 읽어도 된다.
- 저장소 밖 자료를 끌어오지 않는다. 문장 취향·그림 취향·코드 스타일 차이는 결함이 아니다.
- 지적에는 파일·줄, 실제 영향(플레이어가 겪는 것 또는 숫자), 근거, 재현 방법을 적는다. 재현 못 하면 「미확인」.

## 2. 원본 요구와 합격 기준
| 묶음 | 명세·설계 정본 | 합격 기준 |
|---|---|---|
| **EC1 이름 크레딧 「이 삶의 이름들」** | `docs/spec/SPEC-022-엔딩크레딧.md` EC1 1~11항 · 「안 할 것」 · 「영향 점검」 · 완료 기준 **1~22 · 36 · 37**(23~35 · 38 · 39와 EC2는 범위 밖 — EC2 코드가 없어야 한다) · 문구 `docs/design/copy.md` 22절 · 규격 `docs/design/design-system.md` 21절 | 완료 기준 그대로 |
| **PL17-R 교제 카드 + 외모 반대 사례** | `docs/spec/SPEC-018-맞춤인생.md` 77~80행(할 것 · 안 할 것 — `youth-hobby-circle`의 `stay`만 `has_partner` 예외 · 완료 기준 ①~⑥) · 글자 정본 `docs/data/review-018-romance-means.md` 7절(7-8 반영본) · 결정 265 Q7~Q9 | 완료 기준 ①~⑥ · 맞춤 없는 판 불변 |
| **PL10 초점 코어(출하 꺼짐)** | 설계 `docs/data/focus-spend-model.md`(승인본 — 12-2절, 1-1 표지 기준) · SPEC-018 PL10 줄 · 결정 265 · **268(스위치 `FOCUS_ENABLED = false`로 출하, 화면 없음)** | 꺼진 상태에서 초점 이전과 바이트 동일 · 켠 상태의 계약(설계 2~6절)은 시험으로 유지 |
| **PL13 밀레니얼 얼굴** | 결정 267 · `docs/design/codex/IMG-001-faces/review.md`(「형진 님 판정」 — 여성 3·4단계 파일 맞바꿈 · 「적용 계획」) · `request.md` 3-1절(나이대) | 밀레니얼만 그림 · 실패 시 SVG · 첫 로딩 증가는 코드 몫만 |
| **CX-006-001 재검증** | 결정 264(느린 독자 평균 상한 40 → 40.5분 · 줄별 예외는 「임계를 넘지 않음」까지) · 원 지적: `tests/judgeMargins.test.ts`의 줄별 예외 `floor 0`이 +1.5 SE 덧여유와 겹쳐 실제 −1.5 SE까지 허용했다 | 줄별 예외가 임계를 넘는 줄을 통과시키지 않는다 |

## 3. 변경 파일과 영향 범위 (`git diff --stat f285373..0b0560e142b9ae0c85515f9a7f41b4057505ddf0 -- src scripts e2e e2e-prod harness public package.json` — 123파일)
| 묶음 | 파일 |
|---|---|
| EC1 | 새 `src/credits/`(model · timing · text · allowlist · loader · useCreditsFlow · CreditsScreen) · `src/styles/credits.css`(지연) · `src/screens/EndingScreen.tsx` · `src/data/endingText.ts` · `src/styles/dash.css` · `src/App.tsx`(`?__creditsThrow` 개발 탐침) · `harness/credits.*` · `e2e/ending-credits.spec.ts` · `e2e/ending.spec.ts` · `e2e-prod/smoke.spec.ts` · 시험 `credits.*` · `endingScreen` · `lazyBoundary` · `ageViewLint` · `contrast` · `glue` |
| PL17-R | `src/data/events/youth.json`(사건 넷) · `src/data/citations.json`(usedBy) · `src/data/focusTable.ts`(새 사건 표지 행) · `src/credits/allowlist.ts`(id 표기만) · `scripts/romance*.ts` · `scripts/personaReport.ts`(`--only=romance`) · `scripts/eventMotifs.ts` · 시험 `romanceMeans` · `looksEffect` · `tests/helpers/preRomancePool.ts`(맞춤 켠 판 골든을 PL17-R 전 풀로 고정) · 사건 수 시험 다수 |
| PL10 | 새 `src/core/focus.ts` · `src/data/focusTable.ts` · `src/data/focusSwitch.ts` · `src/core/life.ts`(`pickWeighted` 곱 · `stepYear` 맨 앞) · `types.ts`(`GameState.focus?`) · `storage.ts`(`withValidFocus`) · `session.ts`(`setFocus`) · `eventLint.ts`(`pickWeightProblems`) · `scripts/validateEvents.ts` · `scripts/focus*.ts` · 시험 `focus*` · `storageFocus*` · `sessionFocus` · `tests/helpers/focusStates.ts#itFocusOn` · 골든 커밋 `ff2d52e5`(초점 코드보다 먼저) |
| PL13 | `public/faces/millennial/`(webp 80) · `src/ui/Face.tsx` · `src/ui/dash/Cards.tsx` · `src/screens/EndingScreen.tsx` · `src/styles/dash.css` · `docs/design/credits.md` · 시험 `facePhoto*` · `e2e/face-photo.spec.ts` |
| CX-006-001 | `tests/judgeMargins.test.ts` · `scripts/marginsLib.ts#READER_HIGH_LIMIT_MIN` · `tests/simulation.test.ts` |

## 4. 시험 결과 (작성자 측)
- T0 통과(typecheck · check:events · check:todo · check:motifs · check:era-art · 린트형 시험).
- `npm test` 전체: 245파일 · 5,815 통과 · 실패 0(`7b0eded9` — 그 뒤 대상 커밋까지는 문서와 e2e 기대값 두 줄뿐).
- e2e 전체(Chromium 360·1280): 3,877 통과 · 12 실패 → 실패만 다시 돌려 10건 단독 통과(부하 흔들림으로 판단) · 2건은 낡은 기대값이라 고침(`5833987c` — 엔딩 버튼 셋 · 인용 박스 101칸) → 통과.
- WebKit: v0.6.0부터 있던 실패 5(BGM 슬라이더 4 · 연표 순서 1) + `auto-from-sheet` (g) 1건(단독 재실행 통과).
- `e2e:prod`: 33 통과 · 1 건너뜀(DP8). 초기 로드 Chromium 394,624 B · WebKit 398,772 B(한도 400,000 B).
- 판 길이 v0.6.1 통합(`npm run report:time -- 1000 --only=margins`, 합친 4,000판): 세 시대 평균 36.09 ± 0.03분(상한 36.5) · 느린 독자 알파 39.83 ± 0.06분(상한 40.5, 줄별 최대 40.09) · 95% 분위 알파 40.8분(41).
- 빠른 실행 예: `npm exec -- vitest run tests/romanceMeans.test.ts tests/focusInvariant.test.ts tests/storageFocus.test.ts tests/credits.model.test.ts tests/facePhoto.test.tsx tests/judgeMargins.test.ts` · `npm exec -- playwright test e2e/ending-credits.spec.ts e2e/face-photo.spec.ts` · `npm run report:persona -- 600 --only=romance` · `npm run report:romance-time`.

## 5. 검증 질문 — 유형 A
1. **맞춤 없는 판·초점 꺼짐 불변**: 맞춤 인생이 없는 판(`PERSONA_ENABLED` 끔·구형 저장)과 출하 상태(`FOCUS_ENABLED = false`)에서 진행 난수 수열·최종 상태가 `f285373`과 바이트로 같은가(교제 카드 넷은 `tailored`라 맞춤 없는 판에 0이어야 한다). 맞춤 켠 판의 골든을 PL17-R 전 풀로 고정한 시험(`preRomancePool`)이 보호하던 요구(초점 끔 = 초점 전 · G2 불변 · 가족 생성)를 조용히 지우지 않았는가.
2. **PL17-R 데이터**: 사건 넷이 7절 글자와 같은가 · 조건·가중·`requires`에 외모·성별이 없는가 · 결혼 사슬 플래그를 건드리는 곳이 `youth-hobby-circle/stay`의 `has_partner` 하나뿐인가 · 어느 판에서도 보이는 선택지가 3개인가 · 「넉넉함」 경계(순자산 12,000만 원)와 수저 1~2 변주의 주거 가드(`notFlags lives_with_parents, parents_gone`)가 데이터에 있는가 · `youth-two-news`에 `youth-first-job`의 인용 짝(c-091 · c-011)을 이은 것이 그 해에 실제로 보이는 인용이고 인용의 사용 주의(`usageCaution`)를 어기지 않는가 · 화면 지배를 없애려 바꾼 효과 값이 글의 뜻과 어긋나지 않는가.
3. **PL17-R 측정 재현**: `report:persona --only=romance`(세 풀 — 없음 / 교제 카드 / 교제 카드 + 반대 사례, 같은 시드)에서 외모 1·5 · 수저 1·5의 35세 결혼 비가 「교제 카드 + 반대 사례」에서 0.02 넘게 나빠지지 않는가(작성자 측: 외모 +0.041 · 수저 +0.005, 「교제 카드만」은 외모 −0.024라 둘을 함께 출하한다).
4. **PL10 코어(꺼짐)**: 꺼진 상태에서 `setFocus`가 무시되고 저장된 `focus`는 지우지 않는가 · `withValidFocus`가 이상한 `focus`만 버리고 `persona`·판은 살리는가 · **v0.6.0(`c09afd6`) 파서로 최상위 `focus`가 든 저장을 열고 한 번 저장한 뒤에도 `focus`가 남는가**(설계 6-2 — 코드 읽기로만 확인됨, 실재현 필요) · 켠 상태의 계약 시험 도우미 `itFocusOn`이 켠 상태를 시험 밖으로 새게 하지 않는가(동기 시험만) · 초점 값이 사건 결과(스탯·돈·플래그)에 닿는 경로가 없는가.
5. **EC1**: 줄 모델(명단 합치기 · `goneBeforeMe` 제외 · 21명 초과 · 큰 결정 단계마다 첫 건 최대 4 · 시대 줄 · heavy 한 건 · 20세 전 사망 · 옛 저장)이 명세 2~6항대로인가 · `D_read`·정지 목록 여섯 경우 · 닫는 길 넷의 history 한 걸음 · 지연 덩어리(크레딧·CSS·시대 10년 덩어리)와 연타 한 번 받기 · 오류 경계 · 저장 바이트 불변·`setItem` 0 · 제품 번들에 `__creditsThrow`·`__spoon` 0 · CSS가 `.credits` 아래로만.
6. **PL13**: 밀레니얼(1981~1996년생)만 그림이고 다른 세대는 SVG인가 · 나이대·단계 경계에서 고른 파일이 맞는가(여성 3·4 맞바꿈 반영) · 로드 실패 시 SVG · 처음 화면에서 그림 요청 0 · 첫 로딩 증가가 코드 몫(약 280 B)뿐인가.
7. **CX-006-001**: `tests/judgeMargins.test.ts`의 줄별 예외가 이제 실제 여유 < 0인 줄을 통과시키지 않는가(경계 시험이 그 뜻을 잠그는가) · 느린 독자 상한 40.5분이 시뮬레이션 시험과 같은 값인가.
8. **판 길이·첫 로딩**: v0.6.1 통합 측정(4절)의 세 시대 평균·느린 독자·95% 분위가 상한(36.5 · 40.5 · 41분) 안이고, 초기 로드가 400,000 B 안인가(WebKit 여유가 약 1,228 B로 좁다).

## 6. 검증 질문 — 유형 B (사람처럼 조작 · 정상 + 공격)
- **크레딧(EC1)**: SPEC-022 「완료 기준」 끝의 QA 문단(297행 근처)의 시나리오 전부 — 7판(밀레니얼 흙·다이아몬드, 산업화, 20세 전 사망, 가족 적은 판, 가림 켠 판, 알파 성인 판). 저장은 `e2e/ending-credits.spec.ts`의 `endedOf`와 같은 방법(지금 코드로 끝까지 진행)으로 직접 만든다. 열기 → 흐름 → 정지 → 목록 → 처음부터 → 닫기 네 길 · 연타 · 새로고침 중간 이탈 · 탭 숨김 · 창 폭 변경 · 움직임 줄이기 켬/끔 · 가림 설정을 바꿔 다시 열기 · 다른 탭에서 새 판 · 오프라인에서 덩어리 받기 실패 → 다시 시도. 크레딧에 수저 장면·등급명이 없어야 한다.
- **얼굴(PL13)**: 밀레니얼 판 프로필·엔딩(360 · 1280 · 다크 · 강제 색상) · 다른 세대 판은 SVG · 그림 요청을 막은 판 · 나이 경계를 넘는 해(얼굴이 바뀌는 때).
- **교제 카드**: 노출이 낮다(카드 A 8% · B 5% · 반대 사례 40%, 36세까지 산 맞춤 판). 맞춤 판 22~33세 `has_partner` 상태를 만들어 카드 A·B를, 짝 없는 상태로 반대 사례를 띄운다 — 선택지 셋·결과 문장 변주·영향 줄·연표 줄·새로고침 이어하기. 맞춤 없는 판에서 넷이 한 번도 나오지 않는다.
- **초점(꺼짐)**: 어느 화면에도 초점 고르기 UI가 없다 · 최상위 `focus`를 주입한 저장(정상 값·이상한 값)을 열어도 판·기질·적성이 그대로이고 진행이 같다.
- 세 폭(360·768·1280)은 한 번씩만, 데스크톱 우선. 스크린샷은 FAIL 재현 증거만.

## 7. 제외 범위
- 문장·그림 취향(문구는 형진 님이 확정했다 — 결정 265 Q9 · 266). EC2(수저 변화 장면 — 코드가 없어야 한다는 것만 본다). 초점 화면(PL12 — 경제식 재설계 배포에서 구현). 경제식 자체.
- G2 「같은 해에 함께」 본체(CX-006에서 감사를 마쳤다 — CX-006-001 수정만 본다).

## 8. 알려진 제약
- 초점은 출하 꺼짐이다(결정 268 — 지금 사건 풀에서 효과가 약해 「다가가는 일」 사건을 채운 뒤 켠다). 켠 상태의 측정 미달(노출 비 1.22~1.29 칸 · 한 번도 못 만나는 판 33~56%)은 이번 지적 대상이 아니다.
- 교제 카드만 넣으면 외모 결혼 비가 약 0.024 나빠진다 — 반대 사례와 함께 출하하는 것이 결정이다.
- WebKit 기존 실패 5(BGM 슬라이더 4 · 연표 순서 1)는 v0.6.0부터 있다.
- 실제 스크린리더(NVDA·VoiceOver) 낭독은 작성자 측에서 확인하지 못했다.
