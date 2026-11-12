# CX-003 검증 요청 — SPEC-018 맞춤 인생 M1 코드 (기질·적성·사건 조건·진로 트랙·외모 영향)

| 항목 | 값 |
|---|---|
| 리뷰 ID | CX-003 |
| 유형 | **A 구현 감사 + B 적대적 QA** (한 요청) |
| 대상 브랜치 | `review/CX-003` (대상 커밋 `736d15a4103c0ed79b8a15f8215b28629b2e0982` 위에 이 요청서만) |
| 비교 기준 | `2f0239e`(설계 r4 확정, 구현 전 코드) → `736d15a`(3b — 맞춤 인생 스위치 켬) |
| 레인 | CRITICAL — 확률(지원 판정·외모 가중·기질 배정)·게임 규칙(진로 트랙·페이싱)·저장/복원(`persona` 필드·대기 카드)·핵심 통계(경제 가드·시간 모델) |
| 작성 | Claude Code 마스터, 2026-11-12 |

## 1. 검증자에게 (먼저 읽기)
- 너는 독립 검증자다. 코드·문서를 고치거나 커밋·배포하지 않는다. 결과는 같은 폴더의 `findings.md` 한 파일로만(형식 `docs/review/codex/TEMPLATE-findings.md`).
- 시험을 돌리거나 재현용 임시 시험·스크립트를 만들어도 된다. 끝나면 지운다. `npx`는 쓰지 말고 `npm run …`·`npm exec -- vitest …`·`./node_modules/.bin/vite-node …`를 쓴다.
- **첫 검증에서 읽지 않는다**: `docs/review/`(이 요청 폴더와 `codex/TEMPLATE-*` 제외 — CX-002 폴더도 읽지 않는다), `qa/`, `ai-log/`, `docs/TODO.md`, `wiki/`. `.coding-rules.md`는 읽어도 된다.
- 저장소 밖 자료를 끌어오지 않는다. 문장 취향·코드 스타일 차이는 결함이 아니다.
- 지적에는 파일·줄, 실제 영향(플레이어가 겪는 것 또는 숫자), 근거, 재현 방법. 재현 못 하면 「미확인」.

## 2. 원본 요구와 합격 기준
- 명세: `docs/spec/SPEC-018-맞춤인생.md` — M1(v0.6.0) 중 **PL1 기질 · PL2 적성 · PL3 사건 조건 인터페이스 · PL4 진로 트랙(직업 2단계) · PL16 외모 영향**과 「안 할 것」·완료 기준. PL5·PL6·PL17(콘텐츠)·PL13(얼굴)은 아직 없다(6절).
- 설계 정본: `docs/data/persona-model.md`(r4.1 + `[결정 후속 233]` 표지). 기계 판독 값은 9절 블록(`tests/personaDoc.test.ts`가 코드와 대조). 소득 근거 `docs/data/occupation-wages.md`, 취업 문턱 근거 `docs/data/youth-employment-stats.md`, 경제 모형 `docs/data/economy-model.md`(9-4-SPEC-018절), 사건 스키마 `docs/data/events-schema.md`.
- 요약:
  - 출생 때 `persona`(기질 6종 세기·적성 5축)를 `peerSeed` 파생 해시로 배정한다(진행 RNG 불사용). 저장은 선택 필드, `SCHEMA_VERSION` 9 그대로. 값이 이상하면 판이 아니라 이 필드만 버린다.
  - 스위치 `src/data/personaSwitch.ts#PERSONA_ENABLED`(3b에서 **true**). 끄면 새 판에 `persona`가 없고 읽는 함수가 `null`을 돌려 변경 전 동작으로 돌아가야 한다. 예외는 F11(새 외모 표는 모든 판).
  - 진로 트랙: 학업이 끝난 다음 해(19~24세 창) 분야 카드 → 다음 해부터 세부 직업 카드(보이는 후보 3, 입문 ≥ 1). 지원 판정 `p = clamp(p_first × HIREYEAR[판정 연도] × (1 + kJob·z) + 재지원 가산 + 관계 가산)`, 난수 키는 지원 순번 `tries`. 불합격이면 매년 다시(35세까지). 강제 슬롯이라 일반 선택 간격·하드 상한을 받지 않는다. 맞춤 인생이 있는 판에서는 옛 첫 일 카드 `youth-first-job`을 대체한다(`retiredWith`).
  - 합격 소득: 직업 배율 `jobMul`(정규화 없음, 설계 5절) + 옛 첫 일 카드의 평생 소득 가산 몫(일반 +800·조건 보너스, 가업 +1,600 — `MODEL careerIncome`).
  - 페이싱: 진로 카드는 판의 선택지 예산(`choicesSoFar`)에 **한 장만** 센다(`life.ts#stepYear`, 보고 도구는 `pacingCards`).
  - 외모(PL16): 사건 필드 `looksChannel`(`romance`·`friend`)로 `LOOKW` 배율을 가중 끝에 곱한다. 시대 배율 `LOOKERA`는 맞춤 인생이 있는 판에서만 곱한다. 취업은 `kJob × z`를 `p_first`에만 곱한다(대면 서비스는 2016년까지 시대 예외 폭). 옛 사건별 외모 modifiers·보너스는 지웠다(골든 예외 목록 7사건, 필드 단위).
- 합격 기준(설계 처리에서 넘어온 시험 — **각 시험이 실제로 그 위험을 막는지**를 봐 달라):

| 위험 | 기대 시험 |
|---|---|
| 직업 카드 대기 저장(후보 2~3개, 안정 id, 모르는 id, 구형 파서 롤백) | `pickChoices.test.tsx` · `storagePersona.test.ts`(「직업 카드(pick) 대기의 저장·복원」·「직업 상태의 부분 손상」) · `careerTrack.test.ts` · `life.test.ts`(자동 선택) |
| 진로 트랙 노출 창·재지원·모든 연도 × 분야 후보 ≥ 3·입문 ≥ 1, `open:true ⇔ hire:'open'` | `careerTrack.test.ts` · `jobTable.test.ts` |
| 새 조건 사건의 보이는 선택지 하한 | `visibleChoiceGrid.test.ts` |
| 기존 사건 자격 골든(10년 간격 + `yearRange` 경계 −1·0·+1 + 나이·상태 경계), 예외는 필드 단위 | `eligibilityGoldenBoundary.test.ts` · `tests/helpers/eligibilityGolden.ts` · `tests/fixtures/eligibility-golden*.json`(변경 전 코드 `2f0239e`로 만듦) · `tests/helpers/looksExceptions.ts` |
| 중립 판 동작(스위치 끔 = 변경 전, F11 예외만) | `looksEffect.test.ts` · `personaSwitch.test.ts` · `personaSwitchShipped.test.ts` |
| 갱신 예산 `advUsed`·`roleUsed`·가족 역경 | `personaBudget.test.ts` |
| 저장 범위 `g` 0~40과 성장 상한 분리, 배정 버전 고정 | `personaVersion.test.ts` |
| 활동 끌림 합 −4~+4, 자동 선택 60% 가드 | `personaAuto.test.ts` |
| 대면 첫 지원 외모 폭(같은 직무·같은 시점), 입문 대면 직무 불가 | `jobApply.test.ts` |
| 임금 연도 빈칸·보간·분모 | `jobWage.test.ts` · `careerIncome.test.ts` |

## 3. 변경 파일과 영향 범위
| 영역 | 파일 |
|---|---|
| 새 코어 | `src/core/persona.ts`(배정·읽기·스위치) · `personaKinds.ts` · `personaLife.ts`(갱신·예산) · `careerTrack.ts`(진로 트랙·`pickChoicesOf`·지원 판정·합격 소득) · `jobs.ts`·`jobIndex.ts`(직업 표·`jobMul`·`HIREYEAR`) · `looks.ts`(외모 채널·시대 배율·취업 항) |
| 바뀐 코어 | `life.ts`(`stepYear` 진로 강제 슬롯·페이싱 `choicesSoFar`·`pacingCards`) · `events.ts`(사건 조건·`pick`·`looksChannel`·`retiredWith`·`eventWeight`) · `eventLint.ts` · `apply.ts`(조건 문맥) · `birth.ts`(`persona` 배정) · `storage.ts`(`withValidPersona`·대기 카드 검증) · `state.ts` · `types.ts` · `economy.ts`(`jobMul`) · `impact.ts` · `familyModel.ts` · `gameData.ts` · `index.ts` |
| 데이터 | `src/data/personaTable.ts`(9절 값) · `personaSwitch.ts` · `jobs.json`·`jobs.ts`(28개) · `events/career.json`(진로 카드 2장) · `events/youth.json`·`school.json`·`middle.json`(외모 modifiers 제거·`looksChannel`·`retiredWith`) · `finalDistribution.ts`(재생성) · `timingTable.ts`(`READ_MODEL` 재측정) · `gameData.ts`·`installAll.ts` |
| 화면 | `src/ui/dash/DecisionCard.tsx`(`pickChoicesOf` 연결 — 기질·적성 표시는 아직 없음) |
| 측정·보고 도구 | `scripts/economyCheckLib.ts`(`KNOWN_GUARD_GAPS`) · `timeReportLib.ts`(`featureOf`·`pacingCards`) · `simulateLib.ts` · `marginsLib.ts` · `askReportLib.ts` · `validateEvents.ts` · `eventMotifs.ts` · `genEligibilityGolden.ts`(골든 생성) |
| e2e | `e2e/m5States.ts`(`retiredWith` 사건은 옛 저장에서 찾음) |
| 새 시험 | `tests/` 아래 `career*` · `job*` · `persona*` · `looksEffect` · `eligibilityGoldenBoundary` · `visibleChoiceGrid` · `weightBounds` · `eraTables` · `eventLintPersona` · `storagePersona` · `pickChoices.test.tsx`, 도우미 `tests/helpers/{careerTest,eligibilityGolden,eligibilityGoldenLoad,looksExceptions,personaTest}.ts`, 골든 `tests/fixtures/eligibility-golden*.json` |
| 바뀐 시험 | 24파일 — 경제·시간·엔딩 기준을 바꾼 곳은 5절 질문 7 |
| 문서 | `docs/data/persona-model.md` · `economy-model.md`(9-4-SPEC-018) · `events-schema.md` · `events-distribution.md` · `youth-employment-stats.md`(새) |

영향 범위: 모든 새 판(스위치 켬) — 사건 가중(외모 채널)·진로 카드(20~35세)·소득(`jobMul`·합격 소득)·페이싱·저장 필드. 맞춤 인생이 없는 판(옛 저장·스위치 끔)은 골든과 같아야 한다(F11 외모 표 예외).

## 4. 시험 결과 (작성자 측)
- **T0 통과**: `npm run typecheck` · `check:events` · `check:todo` · `check:motifs` · `check:era-art`.
- **영향 범위 통과**(대상 커밋): 진로·직업·기질·외모 새 시험 전부, `economyBalance`(23) · `economyIdentity` · `timeModel`(41) · `ending`(87) · `simulation`(45) · `judgeMargins` · `stat20Guard` · `autoEconomy` · `flow` · `life` · `impact` · `dashboard`.
- **T3 진행 중**(이 요청을 낸 시점): `npm test` 전체 · `npm run e2e` · WebKit(`./node_modules/.bin/playwright test -c playwright.webkit.config.ts`) · `npm run e2e:prod`(첫 로딩 ≤ 400,000 B). 결과와 그에 따른 수정은 `resolution.md`에 적는다 — 대상 커밋 뒤의 수정은 검증 범위가 아니다.
- **빠른 실행 예**: `npm exec -- vitest run tests/careerTrack.test.ts tests/jobApply.test.ts tests/careerIncome.test.ts tests/storagePersona.test.ts tests/pickChoices.test.tsx tests/looksEffect.test.ts tests/eligibilityGoldenBoundary.test.ts`(1~2분). 무거운 시험: `tests/economyBalance.test.ts`·`tests/simulation.test.ts`(각 약 10분). 경제 보고 `npm run check:economy -- --plays 3000 --auto 1000`(약 2분).
- **실행 준비**: 이 작업 폴더의 `node_modules`는 원 저장소의 것을 연결(junction)해 두었다 — `npm install`·`npm ci`를 하지 않는다. 개발 서버는 `npm run dev`.

## 5. 검증 질문
1. **진로 트랙 상태 기계 (가장 위험 — 먼저 봐 달라)**: `none → field → hired`(그리고 35세 닫힘)가 모든 경로에서 맞는가 — 가족 강제 사건과 겹친 해의 밀림, 불합격 뒤 매년 재지원, 대기 카드 저장 → 새로고침 → 복원(같은 후보·같은 판정, 다시 뽑기 없음), 저장 손상·모르는 직업 id, 롤백(v0.5.1 파서가 대기 카드를 만났을 때), 자동 모드, 부모님이 정한 해·같은 해 사망과 겹칠 때. 판정 난수 키가 `tries`라 새로고침·연타로 결과를 바꿀 수 없는가.
2. **지원 판정 확률**: `jobApplyOf`·`applyProbability`의 식이 설계 4B-2·4C와 같은가 — `HIREYEAR`는 판정 연도에만, `kJob·z`는 `p_first`에만(재지원 가산은 곱 뒤), 대면 서비스의 시대 예외(2016년까지), 입문 대면 직무 불가·`fitApt` 필수, clamp 경계.
3. **합격 소득·경제**: `careerIncomeOf`의 값·조건이 옛 `youth-first-job`과 같은가, 두 번 더해지거나(옛 카드와 진로 카드가 한 판에 같이 뜸) 빠지는 경로가 있는가. `jobMulOf`(연도·학력·외모 ±3%)와 `incomeOf`의 결합, 맞춤 인생이 없는 판의 소득이 변경 전과 같은가.
4. **페이싱**: `stepYear`의 `choicesSoFar`(진로 카드 한 장)와 보고 도구의 `pacingCards`가 같은 규칙인가(`life.ts`는 사건의 `pick`으로, `count`는 id 접두사 `job-pick-`로 센다). 강제 슬롯이 `lastChoiceAge`를 바꿔 일반 카드 간격에 주는 영향, 하드 상한을 넘는 판이 생기는가.
5. **외모 영향**: `looksChannelMult`·`jobLookTerm`·`LOOKERA`가 설계 4B·4C-1 값과 같은가, 시대 배율이 맞춤 인생 없는 판에 새지 않는가, `looksChannel`이 `pick` 사건에 붙지 못하는가. 골든 예외(`looksExceptions.ts`)가 필드 단위로 좁고 그 밖의 기존 사건 자격·가중·효과가 바이트 그대로인가(외모 50 판 동치 포함).
6. **기질·적성 배정과 저장**: 출생 배정이 진행 RNG를 쓰지 않아 기존 판의 난수 흐름이 그대로인가, `beginBirth` 새로고침·룰렛 도중 같은 값인가, `withValidPersona`가 부분 손상에서 필드만 버리는가, 끄기 스위치에서 저장된 `persona`를 지우지 않는가.
7. **측정·가드 변경의 정당성**: `scripts/economyCheckLib.ts#KNOWN_GUARD_GAPS`의 새 한계(산업화·X·알파 40대 수저 비), `src/data/timingTable.ts#READ_MODEL`의 재측정 상수, `tests/judgeMargins.test.ts`·`tests/simulation.test.ts`의 알파 노년 허용 폭, `tests/ending.test.ts`의 0원 이하 상한 칸, `scripts/timeReportLib.ts#featureOf`의 진로 카드 처리 — 결함을 가리려고 기준을 느슨하게 한 곳이 있는가.
8. **적대적 QA**: 브라우저에서(`npm run dev`) 맞춤 인생 판을 진로 카드까지 진행하며 새로고침·뒤로 가기·연타·자동 모드 전환·저장 손상(로컬 저장소 수정)을 시도해 진로 카드가 사라지거나 다시 뽑히거나 같은 해에 두 장 뜨는 경우를 찾아 달라.

## 6. 제외 범위
- 사건 문장·직업 이름·카드 문구의 품질, 화면 배치·색(기질·적성 화면 표시는 아직 없다).
- PL5(큰 갈림길 재작성)·PL6(직업별 사건)·PL17(연애 만회 사건)·PL9~PL12(초점·돈 쓰기)·PL13(얼굴 그림) — 아직 구현하지 않았다.
- `docs/design/codex/IMG-001-faces/`(얼굴 그림 80장 — 비교 범위 안에 있지만 따로 검수를 마쳤고 코드에 아직 연결되지 않았다).
- 숫자 목표 자체의 높낮이(형진 님 결정: 연애 외모 k 0.70, `HIREYEAR` 하한 0.75 등) — 구현이 결정값과 다른지만 본다.

## 7. 알려진 제약 (의도된 동작)
- 맞춤 인생은 모든 세대 판에 배정된다(콘텐츠는 밀레니얼 먼저). 시험 전용 R1 프로필의 얼린 사건 풀(`scripts/r1EventPool.ts`)에는 진로 카드가 없다.
- F11: 새 외모 표는 맞춤 인생 유무와 무관하게 모든 판에 적용한다(밸런스 변경 — 골든 예외 목록).
- 경제: 진로 트랙으로 35세까지 거의 모두 정규직이 돼 재력 1단계의 40대 순자산이 올랐다(수저 5단계 ÷ 1단계 3.2~3.9배, 이전 3.4~4배+). PL5 뒤 다시 잰다 — 알려진 차이 목록에 사유와 함께 있다.
- 판 길이: 진로 카드가 판당 약 2.5장 더해진다(페이싱은 한 장만 셈 — 총 카드 24.7 → 26.2장). 형진 님 「몰입 우선」.
- 알파 세대 노년 카드 하한(5.00)은 옛 「다가올 세상」 기준이라 알파에 맞지 않는다는 기존 판단이 있다(세대별 시간 모델 GM10에서 다시 정함).
- 기질 「보인 세기 ≠ 타고난 세기」가 지금 거의 0%다 — 변주 사건(PL6)이 없어서다. 결함으로 보지 않는다.
