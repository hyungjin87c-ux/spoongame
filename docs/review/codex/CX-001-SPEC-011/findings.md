# CX-001 검증 결과 (Codex 작성)

- 대상 브랜치·커밋: 실제 체크아웃 `codex/CX-001`, HEAD `adccf2c0d0ade80a6b3d6df5c9b973d4f0f2df46`. 요청서의 대상 코드 `901f13865c34b444783e81e59bb4e39a7409de23`와 `src/`, `tests/`, `scripts/`, `package.json`, `package-lock.json`의 차이가 없음을 `git diff --exit-code`로 확인했다. 구현 비교 기준은 `b658c3a` → `901f138`이다.
- 검토 범위(읽은 파일·돌린 시험): 아래 검토 범위와 실행 결과에 기재했다. SPEC-011 DS1·DS2·DS4, AK1~AK6·AK10 및 관련 완료 기준을 대상으로 했다.
- 읽지 않은 경로 준수: **예**. 허용된 이번 요청서와 `docs/review/codex/TEMPLATE-findings.md` 외의 `docs/review/` 기록, `qa/`, `ai-log/`, `docs/TODO.md`, `wiki/`는 열지 않았다. 허용 문서·코드에 있는 해당 경로의 참조도 따라가지 않았다. 외부 자료는 사용하지 않았다.
- 검증 시작·끝 시각: **2026-11-10 17:07:27 ~ 17:23:41 KST (Asia/Seoul, UTC+09:00)**. 도구 시각 기준이며 끝 시각은 검증을 마치고 결과를 작성하기 직전이다.
- 판정: **`NO_FINDINGS`**

## 지적

없음. 아래 범위에서 실제 영향을 갖는 명세 불일치나 회귀를 재현하지 못했다. 미확인 의심 사항을 확정 결함으로 올린 항목도 없다.

## 결함이 없을 때

`NO_FINDINGS` — 요청서 검증 질문 **1~8**을 아래 범위에서 확인했다. 반려동물을 켠 전체 출시 구성과 브라우저 E2E는 아래 한계에 명시했다.

### 검토 범위

- 정본·규칙: `docs/spec/SPEC-011-어린시절조르기.md`, `docs/data/ask-model.md`, `docs/data/parent-decision-model.md`의 관련 규칙, `.coding-rules.md`.
- 판정·효과·사이: `src/core/ask.ts`, `src/data/askTable.ts`, `src/core/familyRng.ts`, `src/core/familyModel.ts`, `src/core/familyCloseness.ts`, `src/data/familyTables.ts`.
- 자격·분류·부모 주어: `src/core/events.ts`, `src/core/eventLint.ts`, `src/core/parentDecision.ts`, `src/core/parentSubject.ts`, `src/core/familyView.ts`, `src/data/parentDecisionTable.ts`, `src/data/events/index.ts`, `ask.json`, `ask-pet.json`와 관련 호출부.
- 진행·저장: `src/core/life.ts`, `src/core/apply.ts`, `src/core/storage.ts`, `src/core/types.ts`, `src/core/history.ts`의 관련 변경·호출 경로. 부모 도장·조르기 화면의 연결은 관련 렌더링 시험과 호출부로 확인했다.
- 보정·측정: `src/data/events/infant.json`, `school.json`, `tests/fixtures/pre-ask-comp-events/`의 두 JSON, `src/data/timingTable.ts`, `src/data/finalDistribution.ts`, `scripts/askReport.ts`, `askReportLib.ts`, `validateEvents.ts`, 분포·경제·시간 측정 도구의 관련 부분.
- 관련 시험·도우미·구형 저장 fixture를 읽고 아래 시험을 실행했다. SPEC-013·014·015의 변경은 결함 판정 대상에서 제외했다.

### 질문별 확인 결과

| 질문 | 확인 내용과 근거 |
|---|---|
| 1. 확률·경계 | `BASE`, `0.06 × (C−3)`, 떼쓰기 `+0.10`, 확률 범위 `[0.05, 0.95]`, 사이 비용 식과 효과 표가 정본과 일치했다. 재력·사이의 단조 비감소, 1·5단계 및 하한을 격자 시험으로 확인했다. 부모 0명은 실제 가족 계획에서 관측되지 않았고, 방어 분기는 기존 격리 시험에서 `C=3`을 확인했다. |
| 2. 결정론·난수 | 태그 20은 기존 태그 1~19와 충돌하지 않는다. 해시 입력은 가족 시드·종류 번호·`pending.age × 2 + 칸`이며 사건 ID·시대 분할·진행 RNG를 입력으로 쓰지 않는다. 관련 시험과 별도 시드 검증에서 세 선택의 해결 후 RNG 상태가 같았고, 같은 저장에서 같은 선택을 해결한 상태도 같았다. |
| 3. 종류당·판당 상한 | 풀 생성 시 같은 종류의 다른 사건 ID를 `askPeers`로 만들고 `seen`으로 배제한다. 시대 경계·자동 진행·다음 결정·저장 복원 시험이 통과했다. 출시 풀은 활성 종류가 둘이라 최대 2장이고, 합성 3종 풀 시험도 종류당 1장·판당 3장 상한을 통과했다. |
| 4. 저장·복원 | 저장 스키마는 9로 유지된다. 대기 카드의 키·선택지·판정 및 해결 직후 상태가 복원 후 같았다. v0.3.0·v0.4.0 구형 저장과 `family` 없는 저장의 관련 시험도 통과했다. 별도 시드의 매 걸음 저장·복원 대조에서 `seen`, 플래그, 결과 줄의 이중 적용을 재현하지 못했다. |
| 5. `parent_strained` | 거절된 떼쓰기의 해당 갈래에서만 관계 −1과 플래그가 적용된다. 부모 사이의 최소 1, 1~4단계의 감소, AK5-1이 허용한 5단계 흡수, 이후 판정의 확률 변화 및 플래그 중복 방지를 확인했다. 이미 플래그가 있는 상태의 추가 조르기도 별도 시드에서 검증했다. |
| 6. 자동·정적 효과 | 자동 가중은 갈래 확률별 효과 점수의 기대값으로 계산하며 결과 해시 `u1`·`u2`를 읽지 않는다. 독립 계산 대조·순수성·자동/수동 동치 시험이 통과했다. 관련 전략·통계 코드의 효과 읽기와 정적 효과 시험에서 갈래 선택지를 0효과로 오독해 결과를 바꾸는 경로를 확인하지 못했다. |
| 7. +1 보정·분포·시간 | 보정 전 fixture와 효과·보너스·선택 조건을 별도 비교한 결과, **21개 사건의 지식·관계 수치 50곳만 정확히 +1**이었다. 부모 선택 분포, 8세·20세 스탯, 대표 세대·R1 경제 가드가 통과했다. 시간 시험은 세 시대 평균 36분·시대별 평균 37.5분·95% 분위 41분·최대 45분 한도를 통과했다. 엔딩 분위수표도 재생성 결과와 일치했다. |
| 8. 전이·연타·13세·스위치 | 해결 후 같은 키의 재입력은 무효이고 결과 줄은 한 번만 남았다. 3세 이하·13세 이상 조르기 0건, 4세 장난감 한정, 같은 해 2장 0건 시험이 통과했다. 반려동물 꺼짐 시 풀·분류표·집계·진행에서 제외됨을 확인했다. 켜짐의 구성 경계와 선행 데이터 필요성은 확인했으며, 전체 통합 동작은 아래와 같이 미확인이다. |

### 실행 결과

`npm ci`로 의존성을 설치했다. 첫 설치는 샌드박스의 폴더 생성 권한 오류로 실패했고, 권한 승인 후 다시 실행해 성공했다.

| 실행 | 결과 |
|---|---|
| `npm run typecheck` | 통과 |
| `npm run check:events` | 통과 — 파일 6개, 이벤트 151개, 부모 결정 분류표 39장 |
| `npx vitest run tests/ask tests/parentSubject tests/storage tests/parentDecision.test.ts tests/parentDecisionDoc.test.ts tests/familyCard.test.ts tests/autoEconomy.test.ts tests/pacing.test.ts tests/impact.test.ts tests/impactText.test.tsx tests/citationLink.test.ts` | **29개 파일·647개 시험 통과** |
| `stat20Guard`, `parentDecisionSim`, `timeModel`, `infantContent` 시험 파일 실행 (`--maxWorkers=2 --minWorkers=1`) | **4개 파일·128개 시험 통과** |
| `npx vitest run tests/simulation.test.ts tests/economyBalance.test.ts -t '1배속 수동\|경제 밸런스 측정' --maxWorkers=2 --minWorkers=1` | **2개 파일·10개 시험 통과**, 선택 범위 밖 58개 건너뜀 |
| `npm run check:dist` | 통과 — 8개 프로필의 표가 현재 엔진·이벤트와 일치. 7개 세대는 각각 4,000판으로 재생성하며 R1 표는 고정 fixture를 사용한다. |
| 별도 임시 검증 (`npx vite-node .cx001-independent.ts`) | 통과 — 아래 재현 조건 참조. **실행 후 임시 파일 삭제 완료** |
| 보정 fixture와 현재 JSON의 별도 재귀 비교 | 21개 사건·50곳, 변경 축은 `education`·`relationships`뿐이며 모두 기존 값 +1 |

Vitest 합계는 **35개 파일·785개 통과·실패 0개**, 선택 실행에서 건너뛴 시험 58개다. 전체 `npm test`를 실행한 결과는 아니다.

### 별도 검증의 재현 조건·관측

기존 시험의 표본과 다른 시드를 사용했다. `GENERATION_IDS` 순서의 세대 인덱스 `g=0..6`, 판 인덱스 `i=0..39`에 대해 시드는 `(0x1f2e3d4c + g × 1000003 + i × 104729) >>> 0`이다.

각 판을 `startLife`에서 20세 전까지 진행하면서, 매 걸음 `parseGame(serializeGame(state))`로 복원한 경로와 복원하지 않은 경로의 상태 전체를 대조했다. 선택은 `pending.choiceIds[(i + g + pending.age) % pending.choiceIds.length]`로 고정했다.

실제 조르기 카드마다 세 선택을 모두 분기했다. 문서의 숫자를 별도로 적은 확률식·태그 20·종류 번호·해시 식으로 결과를 계산하고, 그 효과·결과 문장을 가진 일반 사건으로 해결한 상태와 조르기 해결 상태를 대조했다. 세 선택의 RNG 상태, 같은 키 재입력 무효, `seen`에 따른 같은 종류 배제도 단언했다.

- 280판, 실제 조르기 카드 **466건**, 저장·복원 **6,477회**, 같은 종류 자격 배제 **1,637회** 모두 통과.
- 세 선택 분기에서 장난감 승낙 291, 예체능 승낙 235, 조르기 거절 225, 떼쓰기 거절 95, 사이 나빠짐 86, 참음 466건을 대조했다. 이는 분기 검증 횟수이며 자연 플레이 빈도 추정값은 아니다.
- 부모 주어는 두 분 432건·어머니만 24건·아버지만 10건·없음 0건이었다.
- 이미 `parent_strained`가 켜진 상태에서 다시 사이 비용 갈래가 되는 경우 6건도 포함했다. 같은 플래그가 중복 저장되거나 복원만으로 효과가 재적용되는 현상은 없었다.

### 검증 한계·미확인 범위

- **미확인:** 브라우저 E2E의 실제 더블클릭·새로고침·타이머 경합. 이번에는 코어 전이·저장 시험과 서버 렌더링 시험으로 확인했으며 브라우저 E2E는 실행하지 않았다. 화면 배치·CSS·글꼴·문장 품질은 요청서의 제외 범위다.
- **미확인:** 반려동물을 켠 전체 출시 구성의 진행·저장·입양 통합. 현재 풀에는 FM7b 반려동물 선행 데이터가 없고, 켜짐 구성 시험도 합성 선행 데이터를 사용한다. 스위치를 단독으로 켜면 `pet_cat` 등 세터가 없어 검증이 실패하는 것은 코드·시험에 명시된 선행 조건과 일치하므로 이번 출시의 결함으로 판정하지 않았다. 반려동물 콘텐츠 자체는 제외 범위다.
- 수치·분포 판정은 기재한 고정 표본과 가드 범위에 한정한다. 모든 가능한 시드·상태의 무결함을 증명한 것은 아니다.
- 소스 코드와 기존 시험 파일은 수정하지 않았다. 커밋·푸시·배포는 하지 않았다. 영구 결과물은 이 `findings.md` 한 파일이며, 임시 검증 파일은 삭제했다.
