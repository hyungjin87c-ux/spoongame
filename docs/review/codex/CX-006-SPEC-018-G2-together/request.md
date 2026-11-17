# CX-006 검증 요청 — SPEC-018 G2 「고등학교 원서를 같은 해에 함께」(결정 후속 255 · 262 · 263)

| 항목 | 값 |
|---|---|
| 리뷰 ID | CX-006 |
| 유형 | **A 구현 감사** (G2 단독 — 결정 후속 262. v0.6.1 묶음 A+B는 뒤의 CX-007) |
| 대상 브랜치 | `review/CX-006` (대상 커밋 `f285373e2f706ee56964a8f7b7e2468a27a4ac88` 위에 이 요청서만) |
| 비교 기준 | `c09afd6915562a5830c80d82fcc4e161f287ae0c`(v0.6.0 배포 — CX-004까지 검증을 마친 코드) → `f285373` |
| 레인 | CRITICAL — 게임 규칙(큰 갈림길 카드가 나는 조건) · 진행 난수 수열 · 해 진행(「해를 닫지 않는 해결」) · 틱·집계 모양 · 핵심 통계 임계(판 길이 · 20세 스탯 · 경제 가드) |
| 작성 | Claude Code 마스터, 2026-11-17 |

## 1. 검증자에게 (먼저 읽기)
- 너는 독립 검증자다. 코드·문서를 고치거나 커밋·배포하지 않는다. 결과는 같은 폴더의 `findings.md` 한 파일로만(형식 `docs/review/codex/TEMPLATE-findings.md`).
- 시험을 돌리거나 재현용 임시 시험·스크립트를 만들어도 된다. 끝나면 지운다. `npx`는 쓰지 말고 `npm run …`·`npm exec -- vitest …`·`./node_modules/.bin/vite-node …`를 쓴다.
- **첫 검증에서 읽지 않는다**: `docs/review/`(이 요청 폴더와 `codex/TEMPLATE-*` 제외 — 다른 CX 폴더도 읽지 않는다), `qa/`, `docs/TODO.md`, `wiki/`, 그리고 `ai-log/`의 **아래 두 파일을 뺀 전부**(특히 `ai-log/2026-11-17_SPEC-018_G2-dev.md`·`…_G2-econ.md`는 작성자의 구현·측정 결론이라 읽지 않는다). `.coding-rules.md`는 읽어도 된다.
  - 읽어도 되는 것: `ai-log/2026-11-17_SPEC-018_G2-plan.md`(구현 전 설계 — 설계 정본) · `ai-log/decisions-2026-11.md`의 후속 241 ②·244·245·255·262·263(형진 님 결정).
- 저장소 밖 자료를 끌어오지 않는다. 문장 취향·코드 스타일 차이는 결함이 아니다.
- 지적에는 파일·줄, 실제 영향(플레이어가 겪는 것 또는 숫자), 근거, 재현 방법을 적는다. 재현 못 하면 「미확인」으로 적는다.

## 2. 원본 요구와 합격 기준
- 결정: 후속 255(맞춤 판 15세에 일반 추첨이 **선택 카드**를 뽑은 해에도 G2 `school-high-pick`을 같은 해에 먼저 부모 결정으로 낸다 · 기대 G2 노출 ≈ 100% · 본인 카드 수 그대로 · 판 길이 +부모 카드 약 0.35장 · G1은 그대로) · 262 G2 화면 (1)~(4) · 263 ①~④(경제 가드 알려진 차이 · 판 길이 상한 36 → 36.5분 · 원서 요약 카드 · 「자세히 보기」).
- 범위 밖으로 둔 것(바뀌면 결함): 빈 해·서술 해의 G2 규칙(후속 244 — 서술 해에는 G2가 서술을 대신한다), G1, 가족 강제 사건·병역 슬롯 우선(후속 241 ②), G2 데이터·효과 값.
- 명세: `docs/spec/SPEC-018-맞춤인생.md`의 PL5-G2 항목 · `docs/spec/SPEC-005-빠른개선.md` LR5 (b)·PD8 (a)의 예외 문장.
- 설계 정본: `ai-log/2026-11-17_SPEC-018_G2-plan.md` — 3절(걸음 순서·난수 칸·`TickInfo`/`TickCounts`·화면 흐름·경계 규칙) · 4절(불변) · 5절(복구 — 끄는 표지 `GATE_TOGETHER`) · **7절 완료 기준**.
- 화면 시안: `docs/design/mockups/g2-together/g2-together.html`(상태 A1 요약 카드 · B 부모 카드 두 장 · C 자동 모드).

## 3. 변경 파일과 영향 범위 (`git diff --stat c09afd6..f285373 -- src tests e2e scripts`)
| 영역 | 파일 |
|---|---|
| 규칙·진행 | `src/core/life.ts`(해를 닫지 않는 해결 갈래 · `resolveLeadGate` · `stepYear` 순서 · 틱 `lead` · 집계) · `src/core/careerTrack.ts`(`GATE_TOGETHER` · 슬롯 표지 · 측정 전용 `withGateTogether`) · `src/core/timing.ts`(읽기 시간·자동 선택 지연) · `src/data/timingTable.ts`(판 길이 상한) · `src/data/parentDecisionTable.ts`(주석) |
| 화면 | `src/App.tsx` · `src/screens/LifeScreen.tsx` · `src/ui/dash/ParentCard.tsx`(요약 카드) · `DecisionCard.tsx` · `Impact.tsx` · `CitationBox.tsx` · `src/styles/dash.css` · `src/data/dashText.ts` |
| 측정 도구 | `scripts/personaReportLib.ts`·`personaReport.ts`(15세 갈래) · `timeReportLib.ts` · `askReportLib.ts` · `familyRemeasureLib.ts` · `economyCheckLib.ts`(알려진 차이) · `marginsLib.ts` · `simulate1000.ts` · `timeReport.ts` · `baseline004Time.ts` · 신설 `gateTogetherReport.ts` |
| 시험 | 신설 `tests/gateTogether.test.ts`(45) · `tests/leadCard.test.tsx`(16) · `e2e/gate-together.spec.ts`(5 × 2 화면) · 기대값·임계를 바꾼 `tests/judgeMargins` · `stat20Guard` · `parentDecisionSim` · `autoEconomy`(표본 8000 → 24000) · `simulation` · `lifeLengthModes` · `life` · `flow` · `e2e/parentStates.ts` · `playwright.webkit.config.ts` |
| 문서 | `docs/design/copy.md` 23절 · `docs/design/design-system.md` 22절 · `docs/spec/SPEC-005-빠른개선.md` · `docs/data/economy-model.md` 9-3 |

## 4. 시험 결과 (작성자 측)
- T0 통과. `npm test` 전체: 228파일 — 처음 1 실패(`judgeMargins` — 상한 안의 3 SE 미만 두 줄)를 알려진 3 SE 미만 목록으로 처리한 뒤 그 파일 통과(전체 재실행은 하지 않았다).
- e2e 전체(Chromium 360·1280): 2 실패 — 부하 흔들림으로 판단(단독 48/48 통과). WebKit: v0.6.0부터 있던 기존 실패 5만 남음. `e2e:prod` 33 통과 · 1 건너뜀(라이브 확인).
- 초기 로드: Chromium 392,155 B · WebKit 396,283 B(한도 400,000 B).
- 빠른 실행 예: `npm exec -- vitest run tests/gateTogether.test.ts tests/leadCard.test.tsx` · `npm exec -- playwright test e2e/gate-together.spec.ts` · 켬/끔 짝 측정 `./node_modules/.bin/vite-node scripts/gateTogetherReport.ts`.

## 5. 검증 질문
1. **난수·불변**: 맞춤 인생이 없는 판(`PERSONA_ENABLED` 끔·구형 저장), G2 자격이 없는 판, 15세가 빈 해·서술 해인 판의 진행 난수 수열과 최종 상태가 v0.6.0과 바이트로 같은가. 동반 해는 정확히 한 칸만 더 쓰는가. `GATE_TOGETHER = false`면 v0.6.0과 같은가.
2. **해를 닫지 않는 해결**: G2를 해결하고 같은 해의 일반 카드로 이어질 때 나이 증가·해 끝 정산·사망 굴림·가족 갱신이 두 번 일어나거나 빠지는 경로가 있는가. 같은 해 사망, 15세 카드가 부모/흘러감 카드인 해, 가족 강제 사건 해의 순서는 설계 3절대로인가.
3. **G2 효과가 같은 해 카드에 닿는 시점**: G2 플래그·스탯·집안 살림이 같은 해 본인 카드의 자격·보이는 선택지·영향 줄에 반영되는 시점이 한 곳으로 정해졌고, 자동·수동·부모 위임(R-039)이 같은 상태에 닿는가.
4. **저장·새로고침**: 15세 본인 카드 대기가 저장된 상태에서 새로고침·이어하기를 하면 G2 줄·효과·집계가 두 번 적용되거나 빠지는가. v0.6.0 저장(15세 대기 중)을 열면 어떻게 되는가. 새 저장 필드·`SCHEMA_VERSION` 변화가 없는가.
5. **틱·집계**: `TickInfo.lead`·`TickCounts`의 덧카드 셈이 집계 불변식(해 수 합 = 사망 나이 + 1, 카드 총수 = 연표 선택 줄)을 지키는가 — 특히 덧카드 해에 사망하는 판.
6. **화면**: 요약 카드·「자세히 보기」·부모 카드 두 장·자동 모드 대기(원서 읽기 시간 추가)·「다음 결정으로」·「잠시 덮어 두기」·Esc·연타에서 카드가 사라지거나 두 번 뜨거나 포커스가 갇히는 경로가 있는가. 가린(무거운) 판에서 원문이 새는가.
7. **임계 변경의 정당성**: 바꾼 임계·기준값(`timingTable` 상한, `KNOWN_UNDER3`, 경제 `KNOWN_GUARD_GAPS`, `PD_AT_20`, T5 ⑦ 예외 삭제, `autoEconomy` 표본)이 결정 263과 주석의 측정값과 맞고, 보호하던 요구를 조용히 지우지 않았는가.
8. **측정 도구**: 15세 갈래(`age15Branch`)와 `gateTogetherReport`가 바뀐 엔진에서 갈래를 바르게 가르는가(G2 결정자·서술 대신·동반 해).

## 6. 제외 범위
- 문장 품질·화면 배치 취향(시안 선택은 형진 님이 했다). 유형 B(적대적 QA)는 v0.6.1 묶음 CX-007에서 한다.
- 초점(PL10)·교제 카드·이름 크레딧 등 v0.6.1의 다른 항목(아직 구현 전).
- 경제식 재설계 대상(생활비 식 등) 자체의 타당성.

## 7. 알려진 제약
- 판 길이: 세 시대 평균이 36분을 넘어(측정 36.09분) 상한을 36.5분으로 올렸다(후속 263 ②). 알파 느린 독자(39.82 / 40분)·알파 95% 줄별은 상한 안의 3 SE 미만이라 알려진 목록에 올렸다.
- 경제: 수저 5 ÷ 1 40대 순자산 비가 알파 4.1 → 약 3.7배, 산업화 3.1 → 약 2.9배 — 기술 고등학교 선택지의 실제 효과로 보고 알려진 차이로 받아들였다(후속 263 ①).
- 새로고침하면 G2 카드는 다시 뜨지 않고 연표 줄만 남는다(지금 부모 카드 규칙).
- WebKit 기존 실패 5(BGM 슬라이더 4 · 연표 순서 1)는 v0.6.0부터 있다.
