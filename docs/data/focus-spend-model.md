# 올해의 초점 설계 (PL9) — SPEC-018 M2 · v0.6.1

- 작성: planner / 2026-11-18 (r1 초안) / 상태: **승인(2026-11-18, 결정 후속 265 — Q1~Q6 추천대로).** r1 + 마스터 검토(12-1절). 구현(PL10)은 이 문서와 12-2절의 승인 내용을 따른다. 형진 님 승인 전에는 `src/`·`tests/`·`e2e/`를 바꾸지 않는다(CLAUDE.md 1절 CRITICAL 게이트, `persona-model.md`·`ask-model.md` 전례).
- **범위: 초점 몫만 — 돈 쓰기는 SPEC-020.** 돈 쓰기(PL11 「한 번 쓰기」)는 경제식 재설계 뒤 첫 묶음으로 옮겨졌다(결정 후속 262 ①). 이 문서는 돈 쓰기 항목·물가표·부채 규칙을 쓰지 않는다. SPEC-020 쪽 전제는 하나뿐이다: **초점 × 쓰기 효과 곱 없음**(후속 260 C, `docs/data/spend-invest-model.md` Q15) — 초점은 사건 확률만 바꾸므로 지켜진다(3절).
- 근거 SPEC: `docs/spec/SPEC-018-맞춤인생.md` PL9·PL10·PL12, 완료 기준 13, 시험 표 PL10 줄. 꼴은 `docs/data/persona-model.md`(절 구성·기계 판독 블록·One-way 목록)를 따른다.
- **이미 정해진 것(다시 묻지 않는다 — `ai-log/decisions-2026-11.md` 후속 262 ②③)**: ② 초점은 그 주제 사건이 나올 확률만 바꾼다. 결과(스탯·돈)는 바꾸지 않는다. ③ 13세에 처음 고르고 20·40·65세에 다시 묻는다. 구간마다 그 나이에 주제 사건이 실제로 있는 초점만 보인다. 고르기는 진행을 막지 않고, 고르지 않으면 직전 초점(처음이면 없음)으로 이어진다. 구간 안에서 언제든 바꿀 수 있다(완료 기준 13). 주제 6개: 공부·일·관계·건강·취미·돈.
- **화면(PL12)은 이 문서 밖이다.** designer 시안 → 형진 님 선택이 따로 있다. 이 문서는 화면이 지켜야 할 **계약**(5절)만 적고 배치·문구·이름 표시는 정하지 않는다.
- **읽은 것(읽기만 했다)**: `src/core/life.ts`(`pickWeighted` 184-188 · `stepYear` 359-490) · `src/core/events.ts`(`eventWeight` 489-494 · `isEventEligible` 469-486 · 한도 상수 544-563) · `src/core/eventLint.ts`(`eventWeightBounds` 691-705 · `weightBoundsProblems` 708-714) · `src/core/eventValidate.ts`(합성 가중 358-359) · `src/core/parentDecision.ts`(`selfAreaWeightFactor` 71-74) · `src/data/parentDecisionTable.ts` · `src/core/persona.ts`(`PersonaState` 69-87 · `readPersona` 398-429) · `src/core/storage.ts`(`withValidPersona` 214 · `SCHEMA_VERSION` 72) · `src/core/session.ts`(`SessionAction` 82-131) · `src/core/careerTrack.ts`(`GATE_SLOT_EVENTS` 112 · `GATE_TOGETHER` 88) · `src/data/events/{school,youth,middle,senior,career}.json`의 **id·제목·`ageRange`·선택지 유무·가중**(사건 본문은 읽지 않았다).
- **이 문서가 하지 못한 것**: 시험·스크립트·측정을 돌리지 못했다(이 작업에 실행 도구가 없었다). 아래 모든 숫자는 **손으로 센 값(제목·id·나이 범위 기준)** 이거나 식에서 나온 어림이다. 확정 수는 구현 때 스크립트(1-6절)로 다시 센다.
- 표기: **▲** = 측정으로 정할 값(기획자 제안, 화면에 숫자로 나오지 않는다). **추측** = 코드·데이터로 확인하지 못한 판단. **[Q#]** = 10절 승인 항목, **[M#]** = 마스터 확인 항목.

---

## 0. 한 화면 요약

1. **주제 표지**: 별도 표 파일 `src/data/focusTable.ts`(사건 id → 주제 1~2개)를 추천한다. 사건 JSON은 고치지 않고, `check:events`가 「표 누락·모르는 주제·풀에 없는 id·제외 계열의 행」을 막는다(1절).
2. **확률 곱**: 초점 주제에 걸린 사건의 **추첨 가중에 ×k**(추천 k = 2.5▲, 사다리 1.5~3.0, 하드 상한 3.0). 다른 사건은 줄이지 않는다(정규화 없음 — 상대 비율만 달라진다). 곱은 `pickWeighted`에서 `selfAreaWeightFactor` 옆에 한 번 곱한다(2절).
3. **판당 카드 수·페이싱 불변의 근거**: 한 해에 카드가 나올지·선택/서술 중 무엇인지는 `rollChoice`·`rollNarrative`·`canChoice`·후보 목록이 비었는지로 정해지고 **가중과 무관하다**. 초점은 이미 정해진 카드 안에서 「어느 사건」만 바꾼다(2-3절). 난수 소비 횟수도 같다(`weightedIndex`는 가중과 상관없이 `next()` 한 번).
4. **결과 불변**: 초점 값은 `resolveEffects`·`resolveChoiceCore`·`Condition`·`bonuses`로 들어가는 길이 없다. 차분 시험(같은 상태에서 초점만 다르게 → `focus` 필드만 다른 결과)과 읽기 허용 목록 시험으로 잠근다(3절).
5. **초점 없음 = 곱 1 = 바이트 동일**: 초점이 없거나 스위치가 꺼졌거나 맞춤 인생이 없으면 `focusFactor`가 리터럴 `1`을 돌려주고 `x * 1 === x`다. 끄는 표지 `FOCUS_ENABLED`를 둔다(4절).
6. **고르기**: 대기 상태를 만들지 않는다. 구간 시작 나이(13·20·40·65)부터 화면이 「고르기 가능」 패널을 보이고, 추첨 시점의 `focus` 값을 읽는다. 자동 모드·부모 위임은 초점을 고르지 않는다(5절).
7. **저장**: **최상위 선택 필드 `GameState.focus?: { id?: 0..5, sec: 0..3 }`**(`persona` 안이 아니다). `SCHEMA_VERSION` 9 유지. 이유: `readPersona`가 모르는 키를 만나면 `persona` 전체를 버린다(`persona.ts:400`) — 안에 넣으면 v0.6.0 앱이 새 저장을 열 때 기질·적성·직업이 통째로 사라진다(6절).
8. **판 길이**: 카드 수가 같아 시간 차는 사건 글 길이 차뿐이다(어림 ±0.1분▲ — 7절).
9. **어림 표의 결론(1-5절)**: 13~19세에 보일 초점은 4개(공부·관계·일·돈), 건강·취미는 숨는다. 20~39세는 같은 4개. 40~64세는 일·관계·돈·건강. 65세 이후는 건강·관계·돈·취미·일. **건강은 40세 전에, 취미는 65세 전에 보이지 않는다** — 사건이 없어서다(콘텐츠 몫, 10절 Q2).

---

## 1. 주제 표지 (어떤 사건에 어떤 주제를 붙이는가)

### 1-1. 주제 6개와 이름 (One-way는 6절)

| 번호 | 코드 | 뜻 | 사건에 붙이는 기준 |
|---|---|---|---|
| 0 | `learn` | 공부 | 학업·시험·학원·배움·자격 준비·재교육 |
| 1 | `work` | 일 | 일자리·직장·사업·취업 준비·퇴직 |
| 2 | `bond` | 관계 | 친구·연애·결혼·가족·부모·자녀·이웃 |
| 3 | `health` | 건강 | 검진·운동·식단·몸을 돌보는 일(병·사고·낙상처럼 닥쳐오는 일은 제외 — 1-1 아래 「표지 기준」) |
| 4 | `hobby` | 취미 | 동아리·여가·여행·배우고 즐기는 일 |
| 5 | `money` | 돈 | 집·빚·살림·학비·노후 자금 |

- 코드는 데이터·저장 번호용 내부 이름이고 화면 낱말은 designer가 정한다(PL12). `bond`·`work`·`health`는 기존 `heavy.kind`·`act` 이름과 글자가 같지만 **서로 다른 타입**(`FocusId`)이다 — lint가 `FocusId`가 아닌 곳에서 이 표를 읽지 못하게 한다(1-4절).
- **표지 기준(결정 후속 265 Q6)**: 주제 표지는 **그 사람이 다가가는 일**에만 단다 — 검진·운동·식단·공부 기회·모임·저축·이직 고민처럼 마음을 쓰면 더 자주 마주칠 사건. 병·사고·낙상·해고·보증 사고·사별·재난처럼 **닥쳐오는 일은 `[]`**(표지 없음)이다. 초점을 고른 쪽이 그 영역에서 손해를 보는 판을 막는다(2-5절 ⑧이 측정). 11절 r1 블록은 이 기준 전의 제목 분류라 구현 때 본문을 읽고 다시 분류한다.
- 「관계」에는 가족(부모 병환·자녀·배우자)을 넣는다. 가족을 별도 주제로 두지 않는다 — 6개가 형진 님 결정이다.

### 1-2. 포함과 제외

초점 곱은 **일반 추첨(`pickWeighted`)이 고르는 사건에만** 닿는다. 아래는 코드를 읽고 정한 분류다.

| 종류 | 근거 | 표지 | 이유 |
|---|---|---|---|
| 서술 사건(선택지 없음) | `life.ts:486` 서술 풀 추첨 | **붙인다** | 「혼자 맞는 명절」「시큰거리는 허리」처럼 주제가 분명한 서술이 많다. 빼면 건강·관계의 노출이 선택 카드로만 갈려 비가 작아진다 |
| 선택 사건 | `life.ts:485` 선택 풀 추첨 | **붙인다** | 기본 대상 |
| 부모가 정한·흘러감 카드(19세 미만) | 같은 추첨을 거친다. 결정자는 `decisionFor`가 따로 정한다 | **붙인다**(결정자와 무관) | 표지는 사건의 성격이다. 곱은 노출만 바꾸고 누가 고르는지·무엇을 고르는지는 그대로다. [Q3] |
| 맞춤 판 전용 사건(`tailored`) | 일반 추첨 후보 | 붙인다 | 같음 |
| 가족 강제 사건 `fam.forcedEvent` | `life.ts:462-465` 추첨을 건너뛴다 | **붙이지 않는다** | `pickWeighted`를 거치지 않아 곱이 닿지 않는다 |
| 큰 갈림길 슬롯 G1·G2 | `GATE_SLOT_EVENTS`, `life.ts:489` | 붙이지 않는다 | 슬롯 카드 |
| 진로 트랙 `pick` 사건 | `isEventEligible` 거짓(`events.ts:471`) | 붙이지 않는다 | 예약 경로. 「일」 주제이지만 곱이 닿지 않는다 |
| 병역 `youth-military` | 강제 서술 슬롯 + `retiredWith: persona` | 붙이지 않는다 | 예약 경로 |
| `retiredWith: 'persona'` 사건(`school-career-choice`·`youth-first-job` 등) | 맞춤 판에서 자격 거짓(`events.ts:472`) | 붙이지 않는다 | 초점은 맞춤 판에서만 켜진다. 맞춤 판에서 죽은 사건에 표지를 달면 후보 수가 부풀려진다 |
| 마일스톤 사건 | `life.ts:408-412` 별도 슬롯 | 붙이지 않는다 | 13세 이후 파일(school·youth·middle·senior)에 `"milestone"` 표지 사건이 **없다**(문자열 검색 0 — 추측: 들여쓰기가 다른 줄은 놓칠 수 있다) |
| 조르기 `ask`·`ask-pet`(4~12세) | 13세 전 | 붙이지 않는다 | 초점은 13세부터 |
| 가족 변화 줄(`familyTick`) | `fam.lines`, 풀 밖 | 해당 없음 | 사건이 아니다 |
| 시대 줄·역사 사실 한 줄 | 추첨 사건이 아니다 | 해당 없음 | 코드에서 시대 줄 경로를 찾지 못했다(추측: 연표 문장은 사건 텍스트에 포함). 구현 때 확인한다 |

- **대상 판정은 한 함수** `focusTaggable(ev)`(순수)가 한다: `trigger`·`pick`·`milestone`·`retiredWith: persona`·`GATE_SLOT_EVENTS`에 없고, 13세 이후에 나올 수 있는(`ageRange.max ≥ 13`이거나 단계가 school 이후) 사건. 게이트(1-4절)와 엔진이 같은 함수를 쓴다.

### 1-3. 한 사건에 여러 주제

**최대 2개(주 1 + 보조 1), 곱은 한 번만 한다.** 사건의 주제 중 하나라도 초점과 같으면 ×k, 둘 다 같아도 ×k(k²가 아니다).

- 이유: 부모 병환은 관계(가족)이면서 돈이다. 주제가 하나뿐이면 「돈」 초점이 부모 병환·집 대출·보증 같은 현실적인 돈 사건을 못 잡는다. 하지만 3개 이상은 아무 사건이나 모든 초점에 걸려 구별이 사라진다.
- 곱이 한 번뿐이라 합성 가중 최대는 `eventWeight × (자기 영역 ×2) × k`로 고정된다(2-2절).
- 구간 목록 계산(1-6절)은 주·보조를 모두 센다. 이름: 표 한 줄 `사건 id | 주 [보조]`.

### 1-4. 표지의 위치 — 세 안 비교와 추천

| 안 | 내용 | 장점 | 단점 |
|---|---|---|---|
| A | `parentDecisionTable.ts`(영역 분류표)를 넓힌다 | 이미 있는 표 | 그 표는 **누가 정하는가**(부모 영역 `care·health·money·school·move·home`, 본인 영역 `study·friends·hobby`)의 표고, **19세 미만 선택 사건 32장 + 조르기에만** 있다(`parentDecisionTable.ts:52-91`). 서술 사건·20세 이상 사건에는 행이 없다. 영역 6개 ≠ 주제 6개(`care`·`home`·`move`는 주제가 없고 `일`·`취미(65+)`은 영역에 없다). 문서 블록·`parentTableProblems`가 「19세 미만 선택지 사건 = 표」라는 정확 일치를 지키고 있어 넓히면 그 시험이 깨진다 |
| B | 사건 JSON에 새 필드 `topic?: FocusId[]` | 사건 옆에 붙어 새 사건이 만들 때 정해진다 | 사건 파일 7개·사건 ~100곳을 고친다(5개 넘음). 다른 작업자가 사건 데이터를 쓰는 중이면 충돌한다. `EventDef`·`events-schema.md` 공개 인터페이스가 늘어난다 |
| **C(추천)** | **별도 표 `src/data/focusTable.ts`** `Record<사건 id, readonly [FocusId] \| readonly [FocusId, FocusId] \| readonly []>` | 사건 JSON 불변(자격·가중 골든이 닿지 않는다). 기계 판독 블록과 줄마다 대조하기 쉽다. `parentDecisionTable.ts`와 같은 검증된 패턴 | 새 사건이 표를 잊을 수 있다 → **빌드 게이트로 막는다**(아래) |

**추천 C.** 근거: ① 파일 5개 규칙 ② `parentTableProblems`(`scripts/validateEvents.ts` 안 게이트)가 같은 방식으로 「새 사건을 분류 없이 추가하면 빌드가 실패한다」를 이미 지키고 있다 ③ 표지가 사건의 **성격 분류**이고 사건 효과·자격과 무관하다.

**게이트 `focusTableProblems(events, table)`(신설, `check:events`에 더한다)**:
1. `focusTaggable(ev)`인 모든 사건은 행이 있어야 한다. 주제 없음은 **명시적 빈 배열 `[]`**(예: 「먼 등굣길」). 행이 없으면 실패 — 새 사건이 표지를 잊는 길을 막는다.
2. 행의 id는 풀에 있어야 한다. 사건을 지우거나 이름을 바꾸면 실패.
3. 주제는 `FocusId` 6개 중 하나이고, 한 행에 최대 2개·중복 없음. 모르는 주제는 실패.
4. `focusTaggable`이 거짓인 사건(제외 계열)에는 행이 **없어야** 한다 — 죽은 표지가 구간 목록을 부풀리지 않게.
5. 표 ↔ 이 문서 11절 블록이 줄마다 같다(`tests/focusDoc.test.ts`, `parentDecisionDoc.test.ts` 전례).

### 1-5. 구간별 × 주제별 사건 수 어림

**어떻게 셌나**: 제목·id·`ageRange`·`stages`·선택지 유무만 보고 손으로 분류했다. 사건 본문·`conditions`(플래그 의존)·`yearRange`는 거의 읽지 않았다. 따라서 **「나이 범위가 겹치는 후보 수」의 위쪽 어림**이다 — 실제로는 플래그·`once`·시대 때문에 한 판이 만나는 수가 더 적다. 분류는 제목 기준이라 틀릴 수 있다(▲). **확정 수는 구현 때 스크립트 `scripts/focusCount.ts`(신설)로 풀에서 다시 센다.**

구간 = 13~19 · 20~39 · 40~64 · 65+. 한 사건은 구간 안 나이가 하나라도 겹치면 센다(20~39 단계 사건이 40세 이후로 이어지는 `youth-marriage` 등은 두 구간에 센다). 칸 값은 **주제를 가진 사건 수(주·보조 합) / 그중 주 주제로만 센 수**.

| 구간 | 대상 사건 수 | 공부 learn | 일 work | 관계 bond | 건강 health | 취미 hobby | 돈 money |
|---|---:|---:|---:|---:|---:|---:|---:|
| 13~19 | 21 | 7 / 7 | 2 / 2 | 9 / 8 | **0 / 0** | 1 / 1 | 7 / 2 |
| 20~39 | 29 | 3 / 3 | 12 / 9 | 16 / 15 | 1 / 0 | **0 / 0** | 5 / 2 |
| 40~64 | 36 (이어지는 20~39 단계 사건 7 포함) | 1 / 0 | 9 / 8 | 20 / 20 | 4 / 4 | 1 / 1 | 11 / 3 |
| 65+ | 23 | 1 / 0 | 2 / 2 | 11 / 9 | 7 / 5 | 5 / 2 | 4 / 2 |

- 제외한 것: 13~19세의 `school-career-choice`(맞춤 판에서 퇴역)·`school-high-pick`(슬롯)·13세 전용 사건, 20~39세의 `youth-military`·`youth-first-job`(퇴역).
- 분류 근거 앵커: 13~19세 선택 사건은 `parentDecisionTable.ts:52-91`의 영역을 참고했다(`study`→공부, `friends`→관계, `hobby`→취미, `money`→돈 보조). 그 밖은 제목으로 분류했다 — **11절 블록 표가 이 분류를 그대로 담는다. 마스터가 표를 검토한 뒤 형진 님께 부록으로 보인다**(표지가 곧 무엇이 더 나오는지를 정하기 때문).
- **보이는 초점(규칙은 1-6절, 최소 2개 `FOCUS_MIN_EVENTS`=2 기준)**:

| 구간 | 보이는 초점 | 숨는 초점(이유) |
|---|---|---|
| 13~19세 | 공부·일·관계·돈 (4개) | 건강(사건 0)·취미(1개뿐) |
| 20~39세 | 공부·일·관계·돈 (4개) | 건강(1개)·취미(0) |
| 40~64세 | 일·관계·돈·건강 (4개) | 공부(1개)·취미(1개) |
| 65세 이후 | 건강·관계·돈·취미·일 (5개) | 공부(1개) |

- **관찰**: 건강은 40세 전에, 취미는 65세 전에 **사건이 없어서** 보이지 않는다. 13세 첫 선택이 4개뿐이고 형진 님이 기대한 「취미」「건강」이 일생의 앞 40~50년 동안 목록에 없다. 이 문서는 숨기는 쪽을 추천한다(SPEC 규칙 「실제로 있는 초점만」 그대로) — 사건을 더 쓰는 것은 콘텐츠(STANDARD)라 v0.6.1 밖이다. [Q2]
- **얇은 주제**: 사건 2~3개짜리 주제(13~19세 일 2·20~39세 돈 2~5·65세 이후 일 2)는 노출 비가 작거나 흔들린다. 측정으로 판정한다(2-5절 「주제 크기별 실패 처리」).

### 1-6. 구간에서 보이는 초점 목록 규칙

`focusChoicesOf(birthYear, section)`(순수, 풀과 표만 읽는다):

- 구간 `s`의 나이 범위 `[a_s, b_s]`(13~19·20~39·40~64·65~110)와 이 사람의 달력 연도 `[birthYear + a_s, birthYear + b_s]`가 **겹치는** `focusTaggable` 사건(나이 범위·단계·`yearRange` 모두)이 그 주제를 `FOCUS_MIN_EVENTS`(2▲)개 이상 가지면 그 주제를 보인다.
- **상태(플래그·`seen`)는 읽지 않는다.** 목록이 해마다 바뀌면 화면이 흔들린다 — 구간 안에서는 고정이다. 대신 「목록에는 있는데 그 구간에 한 번도 노출되지 않은 판」의 비율을 `report:persona`로 잰다(8절 ⑤).
- 같은 풀 → 같은 목록(풀마다 한 번 계산해 `WeakMap`에 둔다, `STAGE_INDEX` 전례 `life.ts:173`).
- **저장된 초점이 지금 구간의 목록에 없으면** 효과가 없다(`focusEffectiveOf`가 `null`) — 5절.

---

## 2. 확률 곱

### 2-1. 식

```
pickWeight(ev) = eventWeight(ev, ctx) × selfAreaWeightFactor(ev.id, age)   // 기존(life.ts:187)
               × focusFactor(ev.id, focus)                                  // 신설
focusFactor(id, focus) = 1                  if focus == null · FOCUS_ENABLED == false · 표에 id 없음
                       = FOCUS_K            if focus ∈ topics(id)
                       = 1                  otherwise
```

- `FOCUS_K` = **2.5▲**(추천), 사다리 **1.5~3.0**, **하드 상한 3.0**(사다리 밖은 승인). 근거는 2-4절 표.
- 곱은 `pickWeighted` 한 곳이다. `eventWeight`는 지금 `pickWeighted`에서만 불린다(`life.ts:187`, 전 저장소 검색) — 곱이 새는 호출부가 없다. `pickWeighted`는 `stepYear` 안 모든 추첨(선택 풀·서술 풀·진로 직전 학업 추첨 `life.ts:448`)에서 같은 `focus` 인자를 받는다. `focus`는 `stepYear` 맨 앞에서 한 번 계산한다(`focusEffectiveOf(state, age)`).
- **다른 사건을 줄이지 않는다.** 가중이 `≥ 1`배라 줄어드는 사건이 없고, 풀 안의 확률 질량이 다시 나뉠 뿐이다(정규화 코드 없음).
- **선택 풀과 서술 풀을 섞지 않는다.** 선택 풀의 주제 사건은 선택 풀 안에서, 서술 풀은 서술 풀 안에서만 상대 비율이 바뀐다(`life.ts:485-486`이 풀을 따로 뽑는다).
- **자기 영역 ×2와의 곱**: 13~18세 본인이 고르는 카드는 이미 `SELF_AREA_WEIGHT = 2`(`parentDecisionTable.ts:238`)가 곱해진다. 공부·관계·취미 사건이 초점을 받으면 13~18세 본인 카드의 최대 곱은 `2 × k = 5`다. 따로 상한을 두지 않고 2-2절 증명 안에 넣는다. 이 곱이 노출 비를 줄인다(공부·관계 사건의 풀 몫이 이미 커서) — 2-4절 측정에 반영.

### 2-2. 합성 가중이 한계 안에 머무는 증명 — 기존 lint 확장

기존: `eventWeight`의 최악 곱이 `[MIN_EFFECTIVE_WEIGHT 0.01, MAX_EFFECTIVE_WEIGHT 10000]` 안(`eventLint.ts:691-714` `weightBoundsProblems`, `eventValidate.ts:358-359`). `weightBoundsProblems(ev, extra)`의 `extra`는 모디파이어 밖에서 곱해지는 채널의 `[최소 배수, 최대 배수]` 목록이다(외모·시대 채널이 이미 쓴다).

신설 `pickWeightProblems(ev)` = `weightBoundsProblems(ev, [[1, SELF_AREA_WEIGHT], [1, FOCUS_K_MAX]])`를 **표에 행이 있는(= 곱이 닿는) 모든 사건**에 적용한다.

- 최솟값: 두 채널의 최소 배수가 1이라 **기존 최솟값 그대로**(곱이 가중을 줄이지 않는다는 것이 곧 증명).
- 최댓값: `기존 최댓값 × 2 × 3.0 ≤ 10000` 이어야 한다. 사건 가중 상한 100×모디파이어 상한은 기존 lint가 이미 10000으로 막으므로, 이 조건은 **기존 최댓값이 1666 이하일 때** 지켜진다. 실제 사건의 최댓값(모디파이어를 모두 켠 곱)은 이 문서가 구하지 못했다(추측: 대부분 수십~수백). 구현 때 스크립트가 전수 계산하고, **넘는 사건이 있으면 곱 상한을 낮추지 않고 보고**한다(「계수를 비틀어 통과시키지 않는다」 원칙) — 대안은 `MAX_PICK_WEIGHT`를 따로 두는 것(승인 사항, 이 문서의 추천은 아님).
- 유한·양수 보장: `weightedIndex`는 가중이 유한·0 이상이고 합이 양수여야 한다(`rng.ts:76-80`). 곱 ≥ 1과 기존 가중 > 0이라 만족한다. 시험 `focusWeight.test.ts`가 모든 사건 × 6초점 × 나이 격자에서 `Number.isFinite` · `> 0` · `≥ 기존 가중` · `≤ 기존 × 2k`를 확인한다.
- **여러 주제 곱 1회**: 시험이 주제 2개가 둘 다 초점인 사건(예: 부모 병환의 관계+돈에서 관계 초점)에서 곱이 `k`지 `k²`가 아님을 확인한다.

### 2-3. 판당 카드 수·페이싱·난수 소비는 바뀌지 않는다 — 보장 방식

초점이 바꾸는 것은 「어느 사건이 뽑히는가」뿐이어야 한다. 코드상 근거(`stepYear`):

1. 카드가 나오는지는 `rollChoice`·`rollNarrative`(맨 앞 `rng.next()` 두 번, `life.ts:366-367`)·`canChoice`(간격·`choicesSoFar`)·`choiceChance`로 정해지고 **가중을 읽지 않는다**(`life.ts:417-429`).
2. 후보 목록(`eligible`)은 자격 판정이 만들며 초점과 무관하다. `draw`는 목록이 비면 난수 한 칸을 쓰고(`life.ts:474-479`), 비지 않으면 `pickWeighted` → `weightedIndex`가 **가중과 상관없이 `next()` 한 번**을 쓴다(`rng.ts:81`).
3. 선택 풀이 뽑으면 선택 카드, 서술 풀이 뽑으면 서술이라 **카드 종류(선택/서술/없음)는 같다.** 풀 안에서 어느 사건이 뽑히든 같은 종류다.
4. 예외 하나: 진로 직전 학업 추첨(`examFirst`, `life.ts:444-452`)은 뽑힌 사건이 「대학 지원」인지에 따라 그 해 카드가 대학 지원 카드냐 진로 카드냐로 갈린다. 둘 다 **선택 카드 한 장**이고 난수 소비도 한 칸으로 같다.
5. 이 해의 구조가 같아도 **뽑힌 사건이 다르면 이후 플래그·`seen`·`lastChoiceAge`가 달라져** 먼 뒤의 카드 수가 조금 달라질 수 있다. 그래서 두 층의 시험을 둔다:
   - **한 해 차분 시험(정확)**: 같은 상태·같은 `rngState`에서 `stepYear`를 초점 없음/6초점으로 돌려 **카드 종류·소비한 난수 횟수(`rngState` 전진량)가 같다**(위 4번의 예외도 같음). 표본: 20시드 × 전 나이 × 구간 경계.
   - **판 단위 측정(통계)**: 초점 6 + 없음의 7개 팔 × 1,000판에서 **판당 총 카드 수 평균 차 ≤ 0.1장▲**, 선택 카드 수·서술 카드 수 각각 ≤ 0.1장▲. 넘으면 보고하고 곱을 낮춘다(사다리).
- 마일스톤·가족 강제 사건·진로 카드·병역 슬롯은 곱이 닿지 않아 그대로다(1-2절).

### 2-4. k의 어림 — 노출 비 ≥ 1.3과 지배 점검

**노출 비의 정의**: 구간 `s`·주제 `t`·초점 팔 `f`에서 `비 = E[그 구간에 t 주제 카드를 본 수 | 초점 = t] ÷ E[같은 수 | 초점 없음]`(1,000판 평균 ÷ 평균). **한 번 뽑을 때** 주제 가중의 몫이 `s_t`(그 풀에서 t에 걸린 가중의 몫)이면:

```
r(s, k) = k ÷ (1 + (k − 1) × s)
```

| s \ k | 1.5 | 2.0 | **2.5** | 3.0 |
|---|---:|---:|---:|---:|
| 0.1 | 1.43 | 1.82 | 2.17 | 2.50 |
| 0.3 | 1.30 | 1.54 | 1.72 | 1.88 |
| 0.5 | 1.20 | 1.33 | 1.43 | 1.50 |
| 0.7 | 1.11 | 1.18 | 1.22 | 1.25 |

(손계산. 한 번 뽑을 때의 값이고 한 판은 구간에서 선택 카드 2~4장·서술 1~2장이라 같은 풀을 몇 번 뽑는다.)

- **13~19세 몫 `s` 어림**(데이터의 가중 합, 구간 전체 합산 ▲): 공부 약 0.47(`school-exam` 가중 70이 16~19세에 있다)·관계 약 0.3·일 약 0.1·돈(보조 포함) 약 0.3. 13~18세는 자기 영역 ×2가 공부·관계·취미 사건에 이미 곱해져 이 몫을 더 키운다.
- **결론(손계산)**: k = 2.0은 s ≥ 0.5 주제에서 1.33으로 기준(1.3)에 겨우 닿고, 사건이 한 번씩만 나오는(`once`) 구조의 소진(2-3절 5번)을 보면 못 미칠 수 있다. **k = 2.5**는 s ≈ 0.5에서 1.43으로 여유가 있다. k = 3.0이 사다리 최대. 그래서 **추천 k = 2.5▲**. [Q1]
- **풀 몫이 0.6~0.7을 넘는 주제는 어떤 k ≤ 3.0에서도 1.3을 못 넘을 수 있다**(표의 s=0.7 줄) — 20~39세 관계(16/29)가 이 경우일 가능성이 있다(추측). 이때의 처리: **노출 비가 1.3 미만인 칸은 실패로 세지 않고 「몫이 큰 주제」로 따로 보고**한다(주제 크기별 판정). 곱을 3.0 넘게 올려 맞추지 않는다. [M2]
- **소진 효과**: 사건 대부분이 `once`라 초점 주제 사건이 앞당겨 소진되면 구간 끝 쪽 노출이 줄어든다. 판단은 구간 합계로만 한다(해별이 아님).

**지배 점검 — 20세 스탯**: 완료 기준 13 「어느 초점도 20세 스탯 평균이 일관되게 높지 않다」를 이 문서가 다음으로 정한다. 13세에 고른 초점만 20세 스탯에 닿는다(첫 구간 하나). 스탯은 `education·health·happiness·relationships` 4개(`types.ts:144`).

- 측정: 13세에 초점 6개 + 없음을 각각 켠 7개 팔 × 1,000판▲(같은 시드 집합, 자동 진행 `autoResolveStep`, 팔마다 13세에 초점을 덮어쓴다). 20세 시점 4스탯의 평균·4스탯 합의 평균·표준오차(SE).
- **지배(실패) 조건**(셋이 모두 맞으면): (a) 한 초점이 4스탯 중 **3개 이상에서** 7개 팔 중 최고, (b) 4스탯 합이 7개 팔 평균보다 **+1.5점▲ 이상** 높다, (c) 그 차이가 SE의 2배보다 크다.
- 참고 경보: 7개 팔의 4스탯 합 최대−최소 > 3.0점▲이면 보고(실패 아님).
- 40세·65세 시점 스탯·45세 순자산은 **보고만** 한다(판정은 SPEC 밖).
- **실패 시 처리**: 해당 초점의 곱을 사다리로 낮추기 전에 원인(그 주제 사건이 스탯을 올리는 쪽으로 치우친 것)을 보고한다. 곱을 주제별로 달리하지 않는다(단일 k).

### 2-5. 측정 칸 (`report:persona --only=focus`, 신설 `scripts/personaReport.ts` 확장)

| 칸 | 정의 | 판정 |
|---|---|---|
| ① 구간×주제 노출 비 | 2-4절 정의, 분모(판 수)와 95% 신뢰구간 | 목록의 주제 중 `s < 0.6`인 칸은 ≥ 1.3▲, 그 밖은 「몫이 큰 주제」로 보고 |
| ② 주제별 사건 수 | 풀에서 센 1-5절 표 | 이 문서 표와 다르면 보고(표를 고친다) |
| ③ 목록-노출 어긋남 | 목록에 있는 주제를 초점으로 한 판 중 그 구간에 그 주제 카드 0장인 판의 비율 | ≤ 10%▲ |
| ④ 카드 수 차 | 7개 팔의 판당 카드 수 평균 차 | ≤ 0.1장▲(2-3절) |
| ⑤ 20세 스탯 지배 | 2-4절 (a)~(c) | 지배 0 |
| ⑥ 최대 합성 가중 | 모든 사건의 `pickWeight` 최댓값 | ≤ 10000 |
| ⑦ 초점 없음 불변 | 초점 없음 팔이 변경 전 요약과 같다 | 같음 |
| ⑧ 고른 주제의 손해 *(마스터 검토 추가)* | 초점 팔마다 그 주제에 맞는 스탯·값(공부 → `education` · 건강 → `health` · 관계 → `relationships` · 돈 → 45세 순자산 · 일 → 35세 직업 확정·소득 · 취미 → `happiness`)이 초점 없음 팔보다 **낮아지는가**(구간 끝 나이, 평균 차와 SE) | 낮아지는 칸이 SE 2배를 넘으면 보고(Q6의 표지 기준을 다시 본다) |

---

## 3. 결과 불변 — 초점이 사건 결과를 바꾸는 길이 없다

**경로 분석**: 초점은 `pickWeighted`의 가중 인자에서만 읽는다. 사건이 뽑힌 뒤 효과는 `resolveEffects(base, bonuses, ctx)`(`events.ts:507`)와 `resolveChoiceCore`가 정하고, `ctx`(`CondContext`, `apply.ts:23`)에는 초점이 없다. `Condition`에도 초점 키가 없다. 이 둘을 **계약으로 잠근다**:

1. **차분 시험 `focusInvariant.test.ts`(동적)**: 표본 상태(20시드 × 구간 경계 나이)에서 선택 카드가 대기 중인 상태 `P`를 만들고, `P`에서 `focus`만 {없음, 0..5}로 바꾼 상태들에 `resolveChoiceStep`·`resolveDelegated`·`autoResolveStep`을 적용한다. 결과 상태가 **`focus` 필드만 빼고 전부 같다**(스탯·자산·플래그·`seen`·`history`·`rngState`·`pending`).
2. **읽기 허용 목록 시험(정적)**: `src/core`의 `focus` 식별자 읽기가 허용 목록(`focusFactorOf`·`focusEffectiveOf`·`focusChoicesOf`·`pickWeighted`의 호출·`setFocus`·`storage` 검증·세션 리듀서)에만 있다. 효과·보너스·자격·`condContextOf` 파일에 `focus`가 나오면 실패(`corePurity`·`codingRules` 린트형 시험 전례).
3. **`Condition` 키 시험**: `Condition`의 키 목록(`eventValidate`의 허용 키)에 `focus`·`topic`이 없다. 사건 데이터가 초점을 읽는 길이 없다.
4. **`CondContext` 키 시험**: `condContextOf`가 만드는 객체의 키에 `focus`가 없다.
5. **변이 시험(증거)**: `resolveChoiceCore`에 일부러 `focus` 의존 분기를 넣은 변이를 만들면 1번 시험이 실패하는지 한 번 확인하고 결과를 기록한다.

---

## 4. 난수·불변 — 초점 없는 판은 지금과 바이트로 같다

- **적용 범위**: 초점 없는 판 = 13세 전 · 13세 이후에 고르지 않은 판 · 구형 저장(`persona` 없음) · `PERSONA_ENABLED = false` · `FOCUS_ENABLED = false`. 모두 `focusEffectiveOf`가 `null`이다.
- **구현 원칙**: `focusFactor`는 `null`이면 **리터럴 `1`**을 돌려준다. `x * 1`은 IEEE에서 `x`와 같고 `list.map`이 만든 가중 배열이 같으므로 `weightedIndex`의 입력이 같다. 난수 소비 횟수는 초점과 무관하다(2-3절). **새 해시도 새 난수도 쓰지 않는다**(`persona`의 `famHash01`·`forkRng` 전례를 쓸 필요 자체가 없다 — 초점에는 난수가 없다).
- **골든 시험 `focusRng.test.ts`**: ① 변경 전 코드로 만든 시뮬레이션 요약·`rngState` 열의 얼린 표본(시드 × 시대 3개 × 맞춤 켠/끈)과 새 코드의 초점 없음 결과가 **바이트 동일** ② `FOCUS_ENABLED = false` 동일 ③ v0.5.1 저장 샘플 4개(출생 직후·어린 시절·20대·노년)를 열어 이어 진행한 결과가 변경 전과 같다(`storageOptional.test.ts` 확장) ④ `persona`는 있고 `focus`만 없는 v0.6.0 저장도 같다. **골든 재생성은 하지 않는다**(One-way).
- **끄는 표지 `FOCUS_ENABLED`**(`src/data/personaSwitch.ts` 옆에 같은 방식, 시험 전용 덮어쓰기 포함 — `GATE_TOGETHER`의 `activeGateTogether` 전례 `careerTrack.ts:88-89`): false이면 (a) `focusEffectiveOf`가 `null` (b) 화면이 패널을 안 보인다 (c) `setFocus`가 무시된다. **저장된 `focus`는 지우지 않고 통과시킨다**(켜면 이어진다). 맞춤 인생을 못 끄는 판이므로 이 표지는 `PERSONA_ENABLED`와 독립이다. 마스터 판단 [M4].
- 맞춤 판에서 초점이 있는 판의 수열은 초점 없는 판과 **달라질 수 있다**(뽑힌 사건이 달라지므로). 이것이 의도이고, 같은 시드·같은 초점·같은 선택이면 같은 판이다(결정론 시험).

---

## 5. 고르는 때와 화면 계약

### 5-1. 구간과 「고르기 가능」

- 구간: `FOCUS_SECTIONS = [13, 20, 40, 65]`(시작 나이). `focusSectionOf(age)`: `< 13`이면 `null`, 13~19 → 0, 20~39 → 1, 40~64 → 2, 65+ → 3. 20·40·65는 `STAGE_TABLE`의 `youth·middle·senior.startAge`(`lifeTable.ts:21-23`)와, 13은 `SELF_FROM_AGE`(`parentDecisionTable.ts:41`)와 같아야 한다(시험).
- 「고르기 가능」 `focusPromptDue(state)`(순수): 맞춤 판 · `FOCUS_ENABLED` · `phase === 'life'` · 구간 `s ≠ null` · `s > (focus?.sec ?? −1)` · `focusChoicesOf(birthYear, s)`가 비어 있지 않다. 화면은 이 값이 참인 동안 **비차단 패널**을 보인다.
- **대기 상태를 만들지 않는다.** `pending`이 아니고 `advance`·타이머·자동 진행을 막지 않는다. 고르거나 「넘기기」를 하면 `sec`을 현재 구간으로 올린다(다시 안 묻는다). 안 하면 다음 구간이 되면 그 구간 쪽 패널로 바뀐다(`sec`이 올라가 있지 않으므로 계속 「가능」 상태).
- **구간 안에서 언제든 바꿀 수 있다**: `setFocus`는 구간 중이면 `focusPromptDue`와 관계없이 허용한다(패널이 닫힌 뒤에도 초점 칸에서 바꿀 길은 PL12가 정한다).

### 5-2. 추첨 시점의 초점

- 추첨은 `stepYear`가 한다. **그 시점의 `state.focus`를 읽는다.** 구간 첫 나이(13·20·40·65)가 되어 패널이 뜬 뒤 고르기 전에 `stepYear`가 불리면 **직전 초점**(처음이면 없음)이 쓰인다 — 후속 262 ③의 「고르지 않으면 직전 초점」과 같은 뜻이고 별도 처리가 필요 없다.
- 변경은 **다음 추첨부터** 효과가 난다. 이미 뽑혀 열려 있는 카드(`pending`)는 바뀌지 않는다. `pending`이 열린 동안에도 `setFocus`는 허용한다(`persona-model.md` 1-3 ⑦은 갱신을 대기 중에 막지만 초점은 상태 갱신이 아니라 다음 추첨의 입력이다).
- **효과가 없는 초점**: 저장된 `focus.id`가 지금 구간의 `focusChoicesOf`에 없으면 `focusEffectiveOf`가 `null`이다(예: 공부 초점으로 40세가 되어 공부 사건이 1개뿐). 직전 초점을 「이어 가지만 효과 없음」이며 화면이 이를 어떻게 보일지는 PL12다. 저장 값은 지우지 않아 다음 구간에 목록에 다시 들어오면 이어진다.

### 5-3. 자동 모드·부모 위임·가족 강제 사건·사망

- **자동 모드(`autoMode`)와 자동 선택(`autoResolveStep`)은 초점을 고르지 않는다.** 초점 없음 = 곱 1이 되어 자동 판의 진행·R-039(자동 = 수동 선택과 상태 전체가 같음)가 변경 전과 같다. 자동 모드 사용자는 초점을 직접 고를 수 있다(패널은 비차단). 대안: 기질로 자동 선택하는 안은 `autoChoiceWeights`·골든을 건드려 이번 범위 밖이다. [Q4]
- **부모 위임(19세 미만 부모가 정한 카드)**: 초점은 노출만 바꾸고 결정자·선택 점수(`parentChoiceWeights`)는 건드리지 않는다. 부모 카드도 표지를 받는다(1-2절). 13~18세에 고른 초점이 부모 카드의 노출을 늘리는 것은 의도다([Q3]).
- **가족 강제 사건·진로 카드·병역·슬롯 카드**와 같은 해: 이들은 `pickWeighted`를 거치지 않아 초점이 닿지 않고, 그 해 일반 추첨은 기존 규칙대로 난수 한 칸을 쓰거나 건너뛴다(`life.ts:456-469`). 바뀌는 것 없음.
- **사망 해·엔딩**: `phase !== 'life'`면 `setFocus`는 상태를 그대로 돌려준다(`stepYear`의 `noop` 전례). 사망이 난 해에 패널이 떠 있어도 저장은 바뀌지 않는다.

### 5-4. 화면이 지켜야 할 계약 (배치·문구는 PL12)

1. **막지 않는다**: 패널이 열려 있어도 진행 단추·「다음 결정으로」·자동 타이머·키 입력이 평소와 같다. 패널 닫기 전 진행하면 직전 초점으로 진행한다.
2. **보이는 초점은 `focusChoicesOf(birthYear, 구간)`와 같다.** 화면이 따로 목록을 만들지 않는다(구간 경계 격자 시험이 이 함수를 잠근다).
3. **「없음」을 고를 수 있다.** 고르지 않기와 「초점 없음」은 다르다 — 고르지 않으면 직전 초점이 이어지고, 「없음」은 초점을 끈다(`focus.id` 제거).
4. **바꾸기 연타**: 같은 값을 연타해도 상태가 변하지 않는다(멱등). 서로 다른 값을 연타하면 **마지막 값이 이긴다.** 연타 한 번마다 저장이 일어나도 중복·꼬임이 없어야 한다. 횟수 제한은 없다(SPEC 「언제든」).
5. **숫자·확률을 보이지 않는다**: 「×2.5」「확률」 같은 값을 화면·접근성 트리에 노출하지 않는다(결정 Q2의 정신 — 이 값은 ▲ 비공개 수치다). 효과를 약속하는 문구(「이 초점이면 …이 일어납니다」)도 쓰지 않는다. 노출이 늘 뿐 결과는 정해지지 않는다.
6. **새로고침·이어하기**: 패널의 열림·닫힘과 선택값이 `focus`로 복원된다. `sec`이 올라가 있으면 다시 열리지 않는다.
7. **세션 액션**: `{ type: 'setFocus'; focus: FocusId | null }`(`SessionAction`에 추가, `setGentle`처럼 진행을 일으키지 않는 액션). 목록에 없는 값은 상태를 바꾸지 않는다. 「넘기기」는 현재 값을 유지한 채 `sec`만 올리는 같은 액션이다(`id` 인자 없음 또는 같은 값).

---

## 6. 저장

### 6-1. 모양

```
focus?: {                  // GameState 최상위 선택 필드 (persona 밖)
  id?: 0..5,               // 지금 초점. 없으면 「초점 없음」. 0 learn 1 work 2 bond 3 health 4 hobby 5 money
  sec: 0..3,               // 마지막으로 묻기를 마친(고르거나 넘긴) 구간 번호. 구간 시작: 13 · 20 · 40 · 65
}
```

- 필드 순서 고정 `id, sec`, `id`가 없으면 키 자체를 뺀다(같은 값 → 같은 바이트, `persona`의 `canonical` 전례). 크기 ≈ 20B.
- **왜 `persona` 안이 아닌가**: `readPersona`는 모르는 키가 하나라도 있으면 `null`을 돌려주고(`persona.ts:400`) 부르는 쪽이 `persona` **전체**를 버린다(`storage.ts:210-217`). v0.6.0 앱이 v0.6.1이 만든 저장을 열면(롤백·두 기기·캐시된 옛 번들) `persona.focus`가 있는 판의 기질·적성·직업이 모두 사라지고 `has_career`·`job_picked`만 남는다. 최상위 선택 필드는 `persona-model.md` 6-3에서 Codex가 재현한 「모르는 최상위 필드 통과·보존」 경로에 있다(추측: `focus`라는 이름으로는 아직 재현하지 못했다 — CX-007에서 v0.6.0 파서 픽스처로 재현한다).
- 초점은 `persona`가 있는 판에서만 의미가 있다(`personaOf(state)`가 null이면 `focusEffectiveOf`가 null).

### 6-2. 읽기·검증 (`withValidFocus`, `withValidPersona` 옆에 한 줄 더)

`storage.ts`의 `withValid…` 방식(SPEC-005 SV1)을 따른다. 판은 살리고 **`focus`만 버린다**:

| 입력 | 처리 |
|---|---|
| 키가 없음 | 초점 없음(중립) |
| 객체가 아님·모르는 키·`id`가 0~5 정수가 아님·`sec`이 0~3 정수가 아님 | `focus` 필드만 버림 |
| `sec`이 현재 나이의 구간보다 큼(미래) | 버림(손상·조작) |
| `phase`가 `title`(출생 전) | 버림 |
| `persona`가 없음(검증에서 버려졌거나 구형 판) | 버림. `PERSONA_ENABLED = false`이면 통과·보존 |
| `id`가 있지만 지금 구간 목록에 없음 | **저장은 보존**, 효과만 없음(5-2절) |
| `id`가 6 이상(모르는 주제 — 이후 버전이 더한 주제 번호) | 버림. (되돌아오면 초점이 사라질 수 있다 — 허용) |

- `SCHEMA_VERSION`은 **9 그대로**. 이유: ① 선택 필드를 더하고 없으면 기본값을 쓰는 전례가 여럿이다(`family`·`gentleUsed`·`play`·`question`·`persona`, `storage.ts:56-66`) ② 새 필드가 없는 모든 저장이 그대로 유효하다 ③ 올리면 One-way이고 내려가기가 막힌다.
- 구형 파서(v0.6.0·v0.5.1)가 새 저장을 열면: 최상위 `focus`는 통과·보존되고(재현 필요) 초점은 무시한다. 판의 나머지(`persona` 포함)는 온전하다. 다시 v0.6.1로 오면 초점이 이어진다.

### 6-3. One-way 목록

배포되면 바꿀 수 없다. 형진 님 확인 대상 [Q5]:
- 필드 이름 `focus`·`id`·`sec`.
- **주제 번호와 순서** `0 learn · 1 work · 2 bond · 3 health · 4 hobby · 5 money`(저장에 번호가 들어간다. 코드 이름은 저장되지 않으므로 Two-way — 데이터·화면이 쓴 이름을 나중에 바꿀 수 있다).
- `sec` 번호의 뜻 `0 = 13~19 · 1 = 20~39 · 2 = 40~64 · 3 = 65+`와 구간 시작 나이 13·20·40·65(바꾸면 옛 `sec`의 뜻이 달라진다).
- `FOCUS_K`·`FOCUS_MIN_EVENTS`·표지 표의 값은 **Two-way**(저장되지 않음, 튜닝 사다리).

### 6-4. 롤백·복구

- 롤백 스위치 `FOCUS_ENABLED`(4절). 켜진 판에서 끄면 초점은 보존되고 효과·화면이 멈춘다.
- 판 도중 앱을 v0.6.0으로 되돌려도 판이 열린다(6-2). 그때까지 노출이 바뀐 사건은 이미 `seen`에 있어 되돌릴 수 없다(복구 없음 — `persona-model.md` 6-3 ③과 같은 원칙).

---

## 7. 판 길이 영향

- 카드 수가 바뀌지 않으므로(2-3절) 시간 차는 **뽑히는 사건의 글 길이 차**뿐이다. 장당 평균 약 0.23분(`persona-model.md` 8-2)이고 초점이 선택/서술 풀 안에서 주제 사건 몫을 약 1.2~2배로 옮길 뿐이라 초점별 평균 차는 **±0.1분▲** 안쪽일 것이다(추측 — 주제 사건이 더 길거나 짧은 쪽으로 치우친 정도를 모른다).
- **초점 패널은 시간을 늘리지 않는다**: 진행·자동 타이머를 막지 않으며(5절) 자동 모드의 머무는 시간을 늘리는 코드가 없다. 사람이 고르는 시간은 `report:time` 모델 밖이다.
- **측정**: `report:time`을 초점 6 + 없음의 7개 팔 × 1,000판▲(세 시대)으로 돌려 평균·95% 분위가 초점 없음 대비 **±0.15분▲** 안인지 본다. 판 길이 상한은 평균 36.5분(후속 263 ②)이고 v0.6.1 통합 측정 뒤 한 번 더 보고하며 평균 증가가 G2 측정 값과 합쳐 1.5분을 넘으면 올리기 전에 다시 묻는다(후속 262 ⑤). 초점은 이 합계에 더해질 몫이 거의 없다(추측).
- **번들**: 표 한 파일(~100행, 행당 ~50B → 약 5KB 비압축, gzip 약 1.5KB▲)과 함수 몇 개. 초기 로드 여유 약 14KB(SPEC 사실 13)라 안이다. 표는 `src/data/`의 코어가 읽는 데이터라 지연 로딩이 아니다 — **추측**: `eventPool`이 풀 로딩 때 읽으므로 코어에 들어간다. `e2e:prod`로 확인한다.

---

## 8. 측정·시험 목록과 Codex 검증 질문

### 8-1. 시험 목록 (신설 제안, 기존 시험은 지우지 않는다)

SPEC 시험 표 PL10 줄(확률 곱이 상한을 넘지 않음 · 지배 점검 · 구간 경계·바꾸기 연타·저장 복원)을 시험 이름 수준으로 푼 것이다.

| 시험 파일 | 내용 | SPEC PL10 줄 |
|---|---|---|
| `focusDoc.test.ts` | 11절 기계 판독 블록 ↔ `focusTable.ts`·상수(줄마다) | 완료 기준 1 |
| `focusTable.test.ts` | 1-4절 게이트 5개(누락·모르는 주제·풀에 없는 id·제외 계열 행·주제 3개) 각각 실패 사례와 통과 사례 | 확률 곱 |
| `focusWeight.test.ts` | 모든 사건 × 6초점 × 나이 격자에서 유한·양수·`≥` 기존·`≤` 기존×2k · 여러 주제 곱 1회 · `FOCUS_K_MAX` 3.0 · `pickWeightProblems`가 최악 곱 > 10000인 가상 사건을 거절 | **확률 곱이 상한을 넘지 않음** |
| `focusSections.test.ts`(격자) | 나이 {12, 13, 19, 20, 39, 40, 64, 65} × 출생 연도 격자(1940~2090 10년 + 풀의 `yearRange` 경계 −1·0·+1) → `focusChoicesOf`가 **풀에서 직접 센 목록과 같다**(구간 경계 나이에서 보이는 초점 = 그 나이의 주제 사건 유무) | **구간 경계** |
| `focusInvariant.test.ts` | 3절 1~5번 | 결과 불변 |
| `focusRng.test.ts` | 4절 골든 ①~④·`FOCUS_ENABLED` 켬/끔 | 난수·불변 |
| `focusPacing.test.ts` | 2-3절 한 해 차분(카드 종류·`rngState` 전진량) + 1,000판 카드 수 평균 차 | 판당 카드 수 불변 |
| `storageFocus.test.ts` | 6-2절 표 전 행 + 구형 파서 픽스처(v0.6.0·v0.5.1) + 모르는 키·미래 `sec`·`persona` 없음·`persona`는 손상·`focus`만 손상일 때 `persona` 보존 | **저장 복원** |
| `sessionFocus.test.ts` | `setFocus` 멱등·마지막 값 승리·`pending` 중 허용·`phase ≠ life` 무시·목록 밖 값 무시·「없음」·`advance` 이중 진행 없음·자동 모드 진행 중 | **바꾸기 연타** |
| `focusDominance`(보고, `personaReport`) | 2-4절 (a)~(c) | **지배 점검** |
| `e2e/focus.spec.ts`(PL12 시안 확정 뒤) | 13세 패널이 진행을 막지 않음 · 연타 · 새로고침 복원 · 구간 경계 목록(데스크톱 우선, 모바일 1회) | 구간 경계·연타 |

### 8-2. 시험 단계

T0(typecheck·`check:events`에 표 게이트 포함·린트형 시험) · T1(표·가중·저장·세션 vitest) · T2(핵심 흐름 + 13세 패널) · T3(전체 + WebKit + `e2e:prod` + 골든). **CRITICAL이라 T3과 Codex 독립 검증이 필수**(CX-007 유형 A+B 묶음 — 후속 262).

### 8-3. Codex 독립 검증 질문 (CX-007 유형 A 구현 감사용)

1. 같은 상태·같은 `rngState`에서 초점만 바꾼 `stepYear`의 **카드 종류·난수 소비**가 항상 같은가? `examFirst`처럼 뽑힌 사건에 따라 카드가 갈리는 분기가 더 있는가?
2. 초점이 `resolve` 결과(스탯·자산·플래그·`rngState`)에 닿는 경로가 있는가? 특히 `condContextOf`·`resolveEffects`·`autoChoiceWeights`·`parentChoiceWeights`·문장 변주가 `focus`를 읽지 않는가?
3. 초점 없음·`FOCUS_ENABLED` 끔·구형 저장에서 결과가 **변경 전과 바이트로 같은가**? `x * 1`로 부동소수점 가중이 달라지는 경우는 없는가?
4. 합성 가중: 모든 사건에서 `eventWeight × 2 × k`가 유한·한계 안인가? 표에 행이 있지만 `weightBoundsProblems`가 못 보는 사건·주제 2개 곱이 `k²`가 되는 경로가 없는가?
5. 구간 목록 `focusChoicesOf`가 구간 경계 나이·시대(`yearRange`) 경계에서 풀과 어긋나지 않는가? 목록에 없는 `id`를 저장에 주입하면 어떻게 되는가(효과 없음·보존)?
6. `setFocus`: 연타·`pending` 중·자동 모드 진행 중·`phase`가 `ending`·두 탭에서 동시에 바꾸기·저장 중 종료 뒤 이어하기에서 초점이 꼬이거나 구간이 다시 열리지 않는가?
7. 저장 손상: `sec` 미래·`id` 범위 밖·모르는 키·`persona` 없음에서 **`focus`만 버려지고 `persona`는 살아 있는가**? v0.6.0 파서로 v0.6.1 저장을 열 때 `focus`가 통과·보존되고 `persona`가 유지되는가?
8. 표 게이트 우회: 새 사건이 `[]`로 주제를 피하거나, 제외 계열에 행을 달아 목록을 부풀리거나, 사건 이름 변경으로 행이 죽는 길이 남아 있는가?
9. 측정의 맹점: 노출 비가 `once` 소진·13~18세 자기 영역 ×2 때문에 낙관적·비관적으로 나오지 않는가? 지배 점검 (a)~(c)를 피해 가는 초점 배치(예: 한 스탯만 크게 오름)는 없는가?

---

## 9. 위험과 복구 계획 (CRITICAL)

| 위험 | 영향 범위 | 대응 |
|---|---|---|
| 초점이 사건 결과를 바꿔 지배 전략이 생긴다 | `life.ts`·효과 경로 | 3절 차분 시험 + 읽기 허용 목록 + 20세 지배 점검(2-4절) |
| 초점 없음 판의 난수·결과가 변한다 | 모든 판(구형 저장 포함) | 곱 `1` 리터럴 + 골든 ①~④ + `FOCUS_ENABLED` |
| 카드 수·페이싱이 달라져 판 길이가 늘어난다 | 판 길이 한도 36.5분 | 곱이 풀 안 상대 비율만 바꾸는 구조(2-3절) + 한 해 차분·1,000판 측정 |
| 새 사건이 표지를 잊거나 표가 풀과 어긋난다 | `check:events`·콘텐츠 작업 | 게이트 5개(1-4절) — 빌드 실패로 막는다 |
| 합성 가중이 범위를 넘는다 | `weightedIndex` 예외 | `pickWeightProblems` 전수 + 시험 |
| 새 저장 필드가 옛 앱에서 기질·적성을 지운다 | 저장 호환(One-way) | 최상위 필드 + 구형 파서 픽스처 재현(CX-007) |
| 목록이 비거나 목록과 노출이 어긋나 「고른 초점이 안 나온다」 | 체감 | 노출 어긋남 칸(2-5절 ③) ≤ 10%▲ + 구간 목록 격자 시험 |
| 몫이 큰 주제(관계)에서 효과가 작아 체감이 약하다 | 체감 | 보고하고 곱을 3.0 넘게 올리지 않는다. 형진 님 플레이테스트 확인 포인트 |
| 분류가 제목 기준이라 틀린다 | 표 품질 | 표를 형진 님께 부록으로 보이고 구현 때 스크립트로 재집계 |

- **영향 범위**: `src/core/life.ts`(`pickWeighted`·`stepYear` 맨 앞)·`src/core/focus.ts`(신설)·`src/data/focusTable.ts`(신설)·`src/core/storage.ts`·`src/core/types.ts`(`GameState.focus?`)·`src/core/session.ts`·`scripts/validateEvents.ts`·`src/core/eventLint.ts`·`scripts/personaReport.ts`·화면(PL12). 사건 JSON·`events.ts`의 자격·가중 함수·`apply.ts`·`economy.ts`·`persona.ts`는 바뀌지 않는다. 파일이 5개를 넘어 CRITICAL(`src/core/` 접촉 + 저장 필드)이다.
- **되돌리는 방법**: ① `FOCUS_ENABLED = false`(즉시, 저장 보존) ② 코드 되돌리기: 이 작업은 새 필드만 더하고 기존 필드·사건·`SCHEMA_VERSION`을 건드리지 않아 커밋 단위로 되돌려도 저장이 열린다 ③ 구현은 **표·게이트 → 곱·스위치 → 저장·세션 → 측정 → 화면** 순으로 나누고 단계마다 T0·T1, 마지막에 T3. 골든은 첫 커밋에서 변경 전 코드로 얼린다.

---

## 10. 승인 항목

### 10-1. 형진 님이 정할 것 (한꺼번에 묻는다 — 후속 262 ②③으로 이미 정해진 것은 묻지 않는다)

| # | 질문 | 추천안 | 대안 | 추천 이유 한 줄 |
|---|---|---|---|---|
| **Q1** | **초점의 세기**: 초점 주제 사건이 그 해 뽑힐 가능성을 몇 배로 높일까 | **2.5배**(사건 결과는 그대로, 사다리 1.5~3.0) | 2배(약함 — 체감 약할 수 있음) / 3배(강함 — 한 주제로 쏠려 스탯 지배 위험) | 한 번 뽑을 때 큰 주제도 1.4배는 보이게 하는 가장 낮은 값(2-4절 표) |
| **Q2** | **고를 수 있는 초점의 기준**: 그 구간에 사건이 **2개 이상** 있는 주제만 보인다. 이 기준이면 13세 첫 선택은 공부·일·관계·돈 4개이고 **건강은 40세부터, 취미는 65세부터** 보인다 | 2개 이상으로 두고 이대로 숨김. 건강·취미 사건은 별도 콘텐츠로 나중에 더한다 | 1개 이상(5~6개가 다 보이나 사건 1개짜리 초점은 효과가 거의 없다) / 사건을 먼저 써서 13세에도 건강·취미를 보이게(v0.6.1 밖 STANDARD 콘텐츠 — 일정이 늘어난다) | 「고른 초점이 안 나오는」 일이 없게 하는 것이 SPEC 규칙의 취지 |
| **Q3** | **부모님이 정한 카드(13~18세)와 서술 사건**도 초점에 따라 더 나오게 할까 | **예**(결정은 그대로 부모님, 노출만) | 본인이 고르는 선택 카드만(초점 노출 비가 작아지고 건강·관계 서술이 빠진다) | 서술 사건 없이는 관계·건강 초점이 거의 구별되지 않는다 |
| **Q4** | **자동 모드(켜 둔 채 구경)에서는** 초점을 대신 고르지 않는다(원하면 사용자가 패널로 고름) | **고르지 않음**(초점 없음으로 진행) | 기질에 따라 자동으로 초점을 고름(자동 선택 점수·골든을 건드려 범위 밖) | 자동 모드의 기존 진행이 변경 전과 같게 남는다 |
| **Q6** *(마스터 검토 추가)* | **초점이 끌어오는 사건의 성격**: r1 표는 주제가 같으면 힘든 일도 함께 끌어온다 — 「건강」 초점이면 `middle-health-crisis`·`senior-illness`·`senior-fall`·`middle-back-pain`이, 「일」 초점이면 `middle-layoff`가, 「돈」 초점이면 `youth-rent-hike`·`middle-debt-guarantee`가 더 자주 나온다. 건강에 마음을 쓴 사람이 더 자주 아프게 된다 | **마음을 쓰면 더 자주 마주칠 일만 표지를 단다** — 검진·운동·식단·공부 기회·모임·저축·이직 고민처럼 그 사람이 다가가는 일. 병·사고·낙상·해고·보증 사고·사별·재난처럼 **닥쳐오는 일은 표지를 달지 않는다**(`[]`). 이 기준으로 표를 다시 분류하면 건강·일 초점의 보이는 구간이 더 줄 수 있다(구현 때 스크립트로 다시 센다) | 주제가 같으면 다 끌어옴(r1 그대로 — 「그 시기 삶의 중심」이라는 뜻으로 풀고 PL12 문구가 「좋은 일만 늘지 않는다」를 밝힌다) | 결정 262 ②의 「확률만」 아래에서 초점을 고른 쪽이 그 영역에서 손해를 보는 판을 막는다 — 고른 초점이 벌처럼 읽히지 않게 |
| **Q5** | **저장 이름·번호(One-way)**: 최상위 선택 필드 `focus`(`id`·`sec`), 주제 번호 `0 공부 · 1 일 · 2 관계 · 3 건강 · 4 취미 · 5 돈`, 구간 번호 `0 13~19 · 1 20~39 · 2 40~64 · 3 65+`. `SCHEMA_VERSION`은 9 그대로 | 위대로 확정 | 주제 번호 순서·필드 이름 변경 / 버전을 올림(옛 앱이 새 저장을 열지 못한다) | 옛 앱이 새 저장을 열어도 기질·적성이 안 지워지게 하는 모양 |

### 10-2. 마스터 확인 항목

| # | 항목 | 추천 |
|---|---|---|
| M1 | 표지 위치 = 별도 표 `focusTable.ts` + 빌드 게이트(1-4절) | C |
| M2 | 몫 큰 주제(풀 몫 ≥ 0.6)에서 노출 비 < 1.3이면 실패가 아니라 「몫이 큰 주제」로 보고(곱을 3.0 넘게 올리지 않음) | 예. SPEC 완료 기준 13의 「노출 비 ≥ 1.3」 문장에 「몫이 큰 주제는 예외로 보고」를 단다 |
| M3 | 한 사건 주제 최대 2개·곱 1회 | 예 |
| M4 | 끄는 표지 `FOCUS_ENABLED`를 `PERSONA_ENABLED`와 따로 둠 | 예 |
| M5 | 지배 점검 폭(2-4절: 3스탯 이상 최고 + 합 +1.5점▲ + SE 2배) | 예. 측정 뒤 폭을 보고한다 |
| M6 | `FOCUS_MIN_EVENTS`(2▲)와 구간 목록이 상태(플래그)를 읽지 않는 규칙 | 예 |
| M7 | 1-5절 분류표를 형진 님께 부록으로 보임 | 예(표지가 무엇이 더 나오는지를 정한다) |
| M8 | 초점은 맞춤 판에서만(저장이 `persona`에 의존) — 구형 저장은 초점 없음 | 예(결정 Q4와 같다) |

### 10-3. 마스터 SPEC 반영 제안 (이 문서는 SPEC을 고치지 않는다)

- PL10 검증 줄에 「몫이 큰 주제 예외」(M2)와 지배 점검 폭(2-4절)을 적는다. 완료 기준 13의 「지배 점검 ±▲ 설계 문서가 정한 폭」은 2-4절을 가리킨다.
- PL9 줄의 「저장」은 이 문서 6절을 가리킨다.

### 10-4. 남은 미정 (구현 때 확정)

① 표지 분류의 줄별 확정(본문을 읽고 제목 분류를 고친다) ② `focusChoicesOf`의 `yearRange` 처리와 시대 사건 ③ 시대 줄·연표 문장이 추첨 사건인지(1-2절 마지막 행) ④ ~~최대 합성 가중 전수 계산 결과~~ — **해결(12-1절: 표지 대상 최대 약 1,102 < 10,000)** ⑤ 초점 칸이 닫힌 뒤 구간 중에 바꾸는 길과 「효과 없는 초점」의 화면 표시(PL12) ⑥ 표 코어 포함 여부(번들, `e2e:prod`) ⑦ 구형 파서가 최상위 `focus`를 통과시키는지의 재현(CX-007).

---

## 11. 기계 판독 블록 (초안 — `tests/focusDoc.test.ts`가 읽는다. 구현 때 `src/data/focusTable.ts`와 줄마다 맞춘다)

주 주제 하나는 필수이고 보조는 선택이다. `-`는 「주제 없음」(표에 `[]`). 분류는 **제목 기준 초안**(1-5절)이라 마스터·형진 님 검토 후 확정한다.

```focus-table
# focus-table v2 (r2 2026-11-18 — Q6 기준으로 사건 본문을 읽고 다시 분류). 행 형식: 키 | 채널 | 값들
MODEL | topics | learn work bond health hobby money
MODEL | topicNo | 0 1 2 3 4 5
MODEL | sections | 13 20 40 65
MODEL | sectionNo | 0 1 2 3
MODEL | focusK | 2.5
MODEL | focusKRange | 1.5 3.0
MODEL | focusKMax | 3.0
MODEL | minEvents | 2
MODEL | topicsPerEventMax | 2
MODEL | pickWeightMax | 10000
MODEL | exposureMin | 1.3
MODEL | exposureBigShare | 0.6
MODEL | cardDiffMax | 0.1
MODEL | timeDiffMax | 0.15
MODEL | dominanceStatsMin | 3
MODEL | dominanceSumDiff | 1.5
MODEL | dominanceSEMul | 2
MODEL | dominanceSumBand | 3.0
# 13~19세 (school.json)
EVENT | school-lunch | -
EVENT | school-friend | bond
EVENT | school-tutoring | learn
EVENT | school-first-love | bond
EVENT | school-exam | learn
EVENT | school-early-work | -
EVENT | school-bully | -
EVENT | school-club | hobby bond
EVENT | school-teacher-notice | learn
EVENT | school-scholarship | learn money
EVENT | school-friend-quarrel | -
EVENT | school-academy-night | learn
EVENT | school-family-priority | -
EVENT | school-parttime | work money
EVENT | school-puppy | bond
EVENT | school-mirror | -
EVENT | school-money-gap | -
EVENT | school-chat-room | -
EVENT | school-academy-talk | -
EVENT | school-virtual-class | -
EVENT | school-long-walk | -
# 20~39세 (youth.json)
EVENT | youth-work-pressure | -
EVENT | youth-meeting | bond
EVENT | youth-marriage | bond
EVENT | youth-marriage-again | bond
EVENT | youth-partner-leaves | -
EVENT | youth-reunion | bond
EVENT | youth-second-chance | bond
EVENT | youth-meeting-again | bond
EVENT | youth-matchmaker | bond
EVENT | youth-approached | bond
EVENT | youth-child | bond
EVENT | youth-child-again | bond
EVENT | youth-workplace-romance | bond
EVENT | youth-housing | money
EVENT | youth-exam-prep | learn work
EVENT | youth-exam-passed | -
EVENT | youth-exam-failed | -
EVENT | youth-friend-wedding | bond
EVENT | youth-colleague | -
EVENT | youth-startup | work money
EVENT | youth-night-study | learn work
EVENT | youth-return-school | learn
EVENT | youth-rent-hike | -
EVENT | youth-gig-work | work
EVENT | youth-machine-partner | work
EVENT | youth-lonely-city | -
EVENT | youth-single-years | -
EVENT | youth-job-rejections | -
EVENT | youth-factory-night | -
# 40~64세 (middle.json)
EVENT | middle-business | work money
EVENT | middle-parents-care | -
EVENT | middle-parents-care-mother-gone | -
EVENT | middle-parents-care-father-gone | -
EVENT | middle-health-check | health
EVENT | middle-health-check-later | health
EVENT | middle-health-crisis | -
EVENT | middle-new-skills | work learn
EVENT | middle-remote-work | -
EVENT | middle-child-school | bond
EVENT | middle-child-leaves | -
EVENT | middle-child-grows | -
EVENT | middle-late-child | -
EVENT | middle-home-loan | money
EVENT | middle-career-peak | work
EVENT | middle-layoff | -
EVENT | middle-job-again | work
EVENT | middle-friend-reunion | bond
EVENT | middle-marriage-crisis | -
EVENT | middle-hobby | hobby
EVENT | middle-parents-farewell | -
EVENT | middle-parents-farewell-mother-gone | -
EVENT | middle-parents-farewell-father-gone | -
EVENT | middle-debt-guarantee | -
EVENT | middle-retirement-prep | money work
EVENT | middle-both-working | -
EVENT | middle-back-pain | -
EVENT | middle-lonely-holiday | -
EVENT | middle-own-shop-year | -
# 65세 이후 (senior.json)
EVENT | senior-retire | -
EVENT | senior-gathering | bond hobby
EVENT | senior-illness | -
EVENT | senior-illness-later | -
EVENT | senior-grandchildren | bond
EVENT | senior-estate | money
EVENT | senior-move-home | money bond
EVENT | senior-travel | hobby
EVENT | senior-estranged-child | bond
EVENT | senior-spouse-care | -
EVENT | senior-alone | bond
EVENT | senior-new-device | learn
EVENT | senior-long-life | work learn
EVENT | senior-last-wishes | -
EVENT | senior-old-friend | -
EVENT | senior-fall | -
EVENT | senior-classmates | bond hobby
EVENT | senior-diet | health
EVENT | senior-memoir | hobby
EVENT | senior-stairs | -
EVENT | senior-photo | -
EVENT | senior-grandchild-visit | -
EVENT | senior-quiet-pride | -

```

- 표에 **넣지 않은** 사건(제외 계열, 1-2절): `school-career-choice`·`school-high-pick`·`school-lessons`(13세 전)·`youth-military`·`youth-first-job`·`job-pick-field`·`job-pick-detail`·7세 전용·조르기·영유아 사건.
- 확신이 낮은 줄: `senior-quiet-pride`(제목 「지나온 일」 — 일인지 회상인지 본문 확인 필요) · `school-puppy`(관계 vs 취미) · `school-mirror`(제목 「또래의 눈길」, 본문 미확인) · `middle-new-skills`(일 vs 공부) · `senior-new-device`(공부 vs 취미) · 이 밖 제목만 보고 분류한 모든 줄.

---

## 12. 승인 기록

- **2026-11-18 형진 님 「추천대로 해줘」 — Q1~Q6 모두 추천대로**(결정 후속 265, `ai-log/decisions-2026-11.md`). CX 레드팀은 따로 두지 않고 v0.6.1 묶음 CX-007(유형 A+B)이 8-3절 질문으로 본다.

### 12-1. 마스터 검토 (2026-11-18)

- **확인한 근거**
  - `readPersona`가 모르는 키를 만나면 `null`(`src/core/persona.ts`의 `readPersona` 첫 검사) — 6-1의 「`persona` 밖에 둔다」 판단이 맞다.
  - v0.6.0(`c09afd6`)의 `parseGame` → `checkGameState`는 최상위의 모르는 키를 거르지 않고 `data as GameState`로 넘긴다(코드 읽기). 그래서 v0.6.0 앱이 최상위 `focus`가 든 저장을 열어도 판은 열린다. 「다음 저장까지 보존되는가」는 CX-007에서 v0.6.0 파서 픽스처로 재현한다(10-4 ⑦ 그대로).
  - **10-4 ④ 해결 — 합성 가중 최댓값**: 풀 156개의 `eventWeightBounds` 최댓값은 600(`infant-new-sibling` — 7세 전이라 표지 대상 밖), 표지 대상 가운데 최대는 `youth-second-chance` 108이다. 외모 채널 최대 1.7을 곱해도 약 184 × 자기 영역 2 × k 3.0 ≈ 1,102로 10,000 아래다(1,666 이하 조건을 모든 사건이 지킨다). 2-2의 별도 `MAX_PICK_WEIGHT`는 필요 없다.
- **고친 것**
  - Q6 추가(10-1): r1 표는 같은 주제의 힘든 일(병·낙상·해고·월세 인상·보증 사고)도 초점이 끌어온다. 「확률만」(후속 262 ②) 아래에서는 건강 초점이 건강을 해치는 쪽으로 작동할 수 있어 형진 님께 표지 기준을 묻는다. 추천은 「마음을 쓰면 더 자주 마주칠 일만」이다.
  - 2-5 측정 칸 ⑧ 추가: 초점을 고른 주제의 값이 초점 없음보다 낮아지는지 보고한다(지배 점검의 반대 방향).
- **마스터 확인 항목(10-2) 판단**: M1(별도 표 + 빌드 게이트) · M3(주제 최대 2개·곱 1회) · M4(`FOCUS_ENABLED` 따로) · M6(목록은 상태를 읽지 않음) · M7(분류표 부록) · M8(맞춤 판에서만) — 추천대로 승인. M2(몫이 큰 주제 예외)와 M5(지배 폭)는 Q1·Q6 답과 측정이 나온 뒤 SPEC 완료 기준 13 문장과 함께 정한다(측정 전에 기준을 느슨하게 적지 않는다).
- **형진 님께 올릴 때**: Q1~Q6을 한 번에 묻는다. 1-5절 어림 표와 Q6에 따라 달라질 「보이는 초점」 표를 함께 보인다. 11절 분류표 전체는 부록(파일 링크)으로만 둔다.

### 12-2. 승인 내용 (결정 후속 265)

- Q1 `FOCUS_K` = 2.5(사다리 1.5~3.0, 하드 상한 3.0) · Q2 `FOCUS_MIN_EVENTS` = 2 · Q3 부모님이 정한 카드(13~18세)도 표지 대상 · Q4 자동 모드는 초점을 고르지 않음 · Q5 6절 One-way 목록 그대로(배포 승인 때 한 번 더 짚는다) · Q6 표지 기준 「다가가는 일만」(1-1절).
- M1·M3·M4·M6·M7·M8 추천대로. M2(몫 큰 주제 예외)·M5(지배 폭)는 측정 뒤 SPEC-018 완료 기준 13 문장과 함께 정한다.
