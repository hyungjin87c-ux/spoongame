# 기질·적성·직업 2단계 설계 (PL0) — SPEC-018 M1

- 작성: planner / 2026-11-10 / 상태: **초안 — 마스터 승인 대기** (CLAUDE.md 1절 CRITICAL 게이트 · SPEC-011 AK0 전례). 승인 전에는 `src/`를 바꾸지 않는다(PL1~PL4 착수 금지). **⑤ 소득 연결(5절)은 자리만 있다** — 조사 작업의 `docs/data/occupation-wages.md`(PL0a)가 나온 뒤 채운다. 나머지 절은 완성이다.
- 근거 SPEC: `docs/spec/SPEC-018-맞춤인생.md`(확정 2026-11-10 — PL0 ①~⑧, 결정 Q2~Q6). 꼴은 `docs/data/ask-model.md`를 따른다.
- 읽은 코드(수치·구조의 근거, 읽기만 했다): `src/core/events.ts`(`Condition` 87-107 · `ChoiceDef` 121-143 · `isEventEligible` 355-370 · `MAX_DEFINED_CHOICES` 436-437) · `src/core/life.ts`(`AUTO_PRIORITY` 596-601 · `autoChoiceWeights` 611-647) · `src/core/birth.ts`(`generateBirth` 202-222 — 가족을 `peerSeed`에서 파생, 난수 비소비) · `src/core/familyRng.ts`(`famHash01`) · `src/core/familyModel.ts`(`FAMILY_TAG`·`FAMILY_TAG_ASK` 41-47) · `src/core/storage.ts`(선택 필드 방식 56-66·`withValid…` 197-238) · `src/core/types.ts`(`GameState` 273-339 · `HistoryEntry` 202-222 · `OCCUPATIONS` 90) · `src/core/economy.ts`(`incomeOf` 99-108) · `src/core/familyJobs.ts` · `src/data/events/school.json`(`school-club` 238, `school-career-choice` 445) · `youth.json`(`youth-first-job` 30).
- 표기: **▲** = 기획자 설계 제안값(공식 통계가 아니고 화면에 숫자로 나오지 않는다 — 구현 실측이 대체). **손계산** = 이 문서를 쓰며 한 어림. **[F#]** = 형진 님이 고를 것, **[M#]** = 마스터가 정할 것(10절).
- **확정하지 않는 것**: 실제 이름·문장(designer·`copy.md`), 화면, 구현 코드, 직업 표의 세부 항목과 소득 값(PL0a 뒤), 판 길이 임계(실측 뒤).

---

## 0. 한 화면 요약

1. **기질**: 6종▲의 **세기 벡터(비공개 정수 5~95)**. 출생 때 `peerSeed`에서 파생한 해시로 하나가 두드러지게 배정되고(진행 난수 비소비), 활동·선택(표지 `act`)과 양육 환경(해마다 약한 흐름)으로 움직인다. 화면에는 **지금 가장 두드러진 기질**만 말로 보인다. 감쇠·상하한·완충(6▲)으로 한 기질로 몰리지 않게 한다(1절).
2. **적성**: 5축▲(학업·예능·체능·손재주·사람 상대). `적성 = clamp(0.7 × 싹 + 키움)` — **싹**은 출생 해시(수저와 독립, 저장 안 함), **키움**(0~30)은 학교·부모 투자(수저·양육 방식별 해마다 확률)·활동·기질 친화로 자란다(저장). 단계 낮음/보통/높음(<35 / <65 / ≥65▲)만 사건 조건이 읽는다(2절).
3. **사건 자격 인터페이스**: `Condition`에 타입 있는 필드 `temper`·`apt`·`job`·`year`·`tailored` 추가(파생 플래그 안과 비교, 3절). **새 필드가 없는 기존 사건은 모든 판에서 자격·가중이 불변**(골든). 선택지 `requires`가 그대로 읽는다. 문장 변주는 `variants`(글만, 효과 불가). 정의 선택지 최대 4 → 6, 보이는 3 그대로. 후보 3~5개 카드는 `pick`(동적 후보, 4절).
4. **직업 2단계**: 분야 = `OCCUPATIONS` 9종 재사용 → 세부 직업 표 `src/data/jobs.json`(지연 로딩). 시간(`yearRange`)은 하드 조건, 학력·적성·형편은 소프트 — 후보가 3개 미만이면 「무리한 도전」으로 채워 막다른 길 0(4절).
5. **저장**: 선택 필드 `persona` 하나(`{v, born, w[6], shown, g[5], job?}`) — **`SCHEMA_VERSION` 9 그대로**, 이상하면 그 필드만 버림, 없는 구형 저장은 **중립**(맞춤 사건·선택지 안 나옴, 자동 모드 보정 1.0). 롤백 스위치 `PERSONA_ENABLED`(6절).
6. **One-way**: `persona` 필드 모양·이름, 기질 6·적성 5·활동 8의 id, 직업 id(삭제·재사용 금지), 해시 태그 `21`, 싹 해시식, 플래그 `job_picked`(6-2).
7. **판 길이**: 손계산으로 +1~1.5분 — 현재 평균 상단 36분(손계산 35.9)을 넘을 가능성이 높다. 내용을 줄이지 않고 실측 뒤 보고한다(8-2).

---

## 1. 기질 (PL1)

### 1-1. 종류와 이름 후보 (수 N = 6▲, 이름은 designer가 최종)

| 번호 | id | 이름 후보(우리 말) | 뜻 |
|---|---|---|---|
| 0 | `curious` | 호기심 많은 | 새것·낯선 것에 끌림 |
| 1 | `steady` | 끈기 있는 | 한 가지를 오래·꼼꼼히 |
| 2 | `driven` | 지기 싫어하는 | 겨루고 이기고 싶음 |
| 3 | `warm` | 붙임성 좋은 | 사람 사이가 편함 |
| 4 | `quiet` | 속이 깊고 조용한 | 혼자·깊이 파는 쪽 |
| 5 | `easy` | 느긋한 | 걱정이 적고 흘러가는 대로 |

- 여섯 모두 장단 서열이 없는 중립·긍정 낱말이다(우열 낙인 금지 — SPEC 안 할 것). 80억분의1의 성향·기질 낱말은 **읽지 않았고 쓰지 않는다** — 겹침 판독표(PL7)가 확인한다. 수가 5나 8이어도 구조는 같다(승인 항목 [M7]은 id 목록 확정).

### 1-2. 출생 배정 (해시, 진행 난수 비소비)

- 시드: `famSeed = famSeedOf(peerSeed)`(`familyRng.ts`, 가족 계획과 같다). `generateBirth`가 `persona`를 **같은 호출 안에서 파생해** `BirthResult`에 더한다(`birth.ts:221` — 가족과 같은 방식, `rngState`·기존 필드는 불변 — `tests/familyHash.test.ts` L0 방식의 시험으로 잠근다).
- 해시 태그: **`FAMILY_TAG_PERSONA = 21`**(`FAMILY_TAG_ASK = 20` 다음, `FAMILY_TAG` 객체 **밖**에 둔다 — 객체 전체를 얼리는 가족 골든 `tests/fixtures/family-golden.json`을 깨지 않으려는 `familyModel.ts:41-47`의 이유 그대로). 키 `(a, b)`: 두드러진 기질 뽑기 `(1, 0)` · 나머지 세기 `(2, i)` · 부모 투자 `(10+k, 나이)` · 환경 흐름 `(30+i, 나이)` · `shown` 동률 `(40, 나이)` · 직업 후보 추첨 `(50, 나이)` · 적성 싹 `(100+k, 0/1)`(서로 겹치지 않는다 — 시험).
- **두드러진 기질 `born`**: `u = famHash01(famSeed, 21, 1, 0)`을 분포 `P`의 누적에 대어 뽑는다. 세기: `w[born] = 60 + ⌊10·h⌋`(60~69), 나머지 `w[i] = 20 + ⌊25·h_i⌋`(20~44), `h = famHash01(famSeed, 21, 2, i)`. 처음 간격 ≥ 16이라 `shown = born`이다.
- **분포 `P` — [F1] 형진 님이 고른다**:
  - **A. 완전 균등(추천)** `P_i = 1/6`. 근거: 기질은 태어날 때 정해지는 성질로 보는 편이 자연스럽고, **수저·양육 방식의 영향은 1-3절의 환경 흐름과 선택지 가림으로 이미 들어간다** — 출생에도 상관을 두면 이중 계산이고 「흙수저는 이런 기질」이라는 고정관념으로 읽힐 수 있다.
  - **B. 약한 상관** `P_i ∝ M[양육 방식][i] × N[수저][i]`, 각 곱수 0.8~1.25▲, 어느 기질도 `P_i ≥ 0.08`(손계산). 표는 승인 뒤 확정. 이점: 「그 집 아이다운」 일관성. 위험: 낙인·분포 쏠림.

### 1-3. 세기 갱신 — 활동·선택·환경

세기 `w[i]` 정수, **하한 5 · 상한 95**(`W_MIN`·`W_MAX`). 갱신은 해시·표만 쓰는 순수 계산이다(난수 비소비).

1. **활동 표지 `act`** (선택지 필드, 사건마다 효과를 따로 고치지 않고 **코드 표 한 곳 `ACT_SHIFT`**에 값을 둔다 — 조르기 `ASK_EFFECTS` 전례, `ask-model.md` 3-1절). 8종▲: `sport` 운동 · `art` 악기·미술·무용 배움 · `read` 읽기·글 · `make` 만들기·기술 · `social` 친구·모임 · `alone` 혼자 보내기 · `study` 공부·학원 · `work` 일·아르바이트. 선택지를 **해결할 때**(`resolveChoiceCore` 한 곳) 적용한다: `Δ_i`(표) × 감쇠 후 반올림. 부모가 정한·흘러간 카드(`by`가 `parent`·`child`)는 **½ 가중**▲(아이가 겪은 환경이지만 고른 것은 아니다, [M5]).
   - 값 표 `ACT_SHIFT[act][기질]`(▲, 9절 블록 전체): `sport` → driven +5 · warm +3 · steady +2 · easy +1 · quiet −2 / `social` → warm +5 · easy +2 · curious +1 · driven +1 · quiet −3 / `read` → curious +4 · quiet +4 · steady +2 · warm −1 / `art` → curious +3 · quiet +3 · steady +2 · warm +1 · driven +1 / `make` → steady +4 · curious +2 · quiet +2 · driven +1 / `study` → steady +3 · driven +3 · curious +2 · quiet +1 · warm −1 · easy −2 / `work` → steady +3 · driven +3 · warm +1 · easy −2 / `alone` → quiet +4 · curious +1 · steady +1 · easy +1 · warm −3.
2. **감쇠(양의 값만)**: `실제Δ = round(Δ × (1 − max(0, w − 60)/40))` — 60 아래는 그대로, 80에서 ½, 95에서 ⅛(⌊⌉로 0이 되면 더 오르지 않는다 = 자연 포화). 음의 값은 감쇠 없이 하한 5까지.
3. **환경 흐름 `ENV_DRIFT`** (양육 환경): 나이 3~18세, 해 끝 한 번(`stepYear` 해 끝 처리 한 곳), 양육 방식별로 정한 기질 1~2개가 각각 **해시 `< 0.5`일 때 +1**(감쇠 적용): strict → steady·driven / free → curious·easy / helicopter → quiet·steady / neglect → quiet·driven. (낙인 점검 [M6] — 특히 neglect·helicopter 줄은 reviewer가 읽는다.) **형편(수저)은 출생 분포가 아니라 선택지 가림(PL5)으로 환경에 들어간다.**
4. **두드러진 기질 `shown`** 판정: `argmax w`가 `w[shown] + H`(H = **6**▲) 이상 크면 바꾸고, 아니면 그대로(완충 — 깜빡임 방지). 동률은 번호가 작은 쪽이 아니라 해시 `(40, 나이)`로 가른다. **바뀌는 순간 연표 한 줄**을 둘지는 [M4].
5. **수렴 방지**: ⓐ 활동 표지는 대부분 `once` 사건이라 판당 갱신 횟수에 상한이 있다(실측 보고 항목) ⓑ 감쇠·상한 ⓒ 한 활동 표의 양의 합 ≤ 15, 음의 합 ≥ −7 ⓓ 기준(SPEC 7-2): 20세 시점에 한 기질이 가장 두드러진 판 ≤ 50%▲, 인생 중 `shown`이 `born`과 달라지는 판 ≥ 20%▲.
6. **갱신하지 않는 것**: 큰 사건(별세·이혼·따돌림 등)을 직접 기질 값으로 옮기지 않는다(민감 소재의 인과 단정을 피한다 — 후속 후보).

### 1-4. 자동 모드와의 관계 (`autoChoiceWeights`)

- 지금 `priority = AUTO_PRIORITY[양육 방식]`(5키: wealth·education·health·happiness·relationships). **보정 곱 `m_key = clamp(1 + Σ_t TP[t][key] × (w_t − 50)/100, 0.8, 1.25)`**를 곱한다. `TP`(▲, 9절): curious → education +0.4 · happiness +0.2 / steady → education +0.3 · wealth +0.2 · health +0.2 / driven → education +0.3 · wealth +0.3 · happiness −0.2 / warm → relationships +0.5 · happiness +0.2 / quiet → education +0.2 · health +0.1 · relationships −0.3 / easy → happiness +0.4 · wealth −0.2 · education −0.2.
- **활동 끌림**: `act`가 있는 선택지의 점수에 `ACT_PULL × Σ_t (w_t − 50)/50 × ACT_SHIFT[act][t]/5`를 더한다(`ACT_PULL = 4`▲, 손계산 최대 약 +4 → 가중 ≈ ×1.9, T = 6). 자동·흘러감만 쓰고 수동 플레이에는 끌림이 없다.
- **중립 불변**: `persona`가 없으면 `m_key = 1`·끌림 0 — 구형 저장·`PERSONA_ENABLED = false`의 자동 결과는 변경 전과 **비트 단위로 같다**(골든). `autoResolveStep` = 수동 선택과 상태 전체가 같은 성질(R-039)은 같은 함수를 쓰므로 유지된다. 조르기 `ask` 경로의 `scoreOf`도 같은 `priority`를 읽는다.

---

## 2. 적성 (PL2)

- 5축▲ `AptKey`: `study`(학업) · `art`(예능 — 음악·미술·무용) · `sport`(체능) · `craft`(손재주 — 기술·만들기) · `people`(사람 상대 — 말·돌봄·접객).
- **식**: `apt_k = clamp(round(0.7 × s_k + g_k), 0, 100)`.
  - **싹 `s_k`**(저장하지 않는다, `peerSeed`에서 재계산): `s_k = round(100 × (famHash01(famSeed, 21, 100+k, 0) + famHash01(famSeed, 21, 100+k, 1)) / 2)` — 삼각분포 평균 50. **수저와 독립**(재능은 돈으로 정해지지 않는다 — SPEC 완료 기준 9).
  - **키움 `g_k`**(저장, 정수 0~**30**▲):
    - ⓐ **학교**: 6~18세 짝수 나이 해 끝에 `study` +1(모두).
    - ⓑ **부모 투자**: 4~18세 해 끝마다 축 `k`에 대해 `famHash01(famSeed, 21, 10+k, 나이) < q`이면 +2. `q = clamp(INVEST_Q[수저][k] × INVEST_MUL[양육 방식][k], 0, 0.6)`(▲, 9절).
    - ⓒ **활동**: `act` 선택 시 `ACT_APT[act]`(sport→sport 4 · art→art 4 · read→study 2·art 1 · make→craft 4 · social→people 4 · alone→art 1·craft 1 · study→study 3 · work→craft 1·people 2), 부모·흘러감은 ½.
    - ⓓ **기질 친화**: ⓑⓒ의 이득에 `m_k = clamp(1 + Σ_t AFF[t][k] × (w_t − 50)/100, 0.8, 1.3)`를 곱한다(`AFF` ▲ 9절 — 예: 끈기→학업·손재주, 지기 싫어함→체능, 붙임성→사람 상대, 조용함→예능).
    - 모든 이득은 `gain = max(1, round(base × m_k × (1 − g_k/30)))`(g<30일 때), g = 30에서 멈춘다.
- **단계** `AptTier`: `low` (< 35) / `mid` (35~64) / `high` (≥ 65)▲. 사건·직업 조건은 **단계만** 읽고 숫자는 화면에 나오지 않는다(SPEC 결정 Q2) — 화면은 `high`일 때 말(「손끝이 야무지다」 꼴)로만, 문장은 designer.
- **입력 범위**(격자 시험이 잠근다): 수저 1~5 · 양육 4종 · 나이 0~100 · `w` 5~95 · `g` 0~30 · `s` 0~100. 출력은 0~100 정수, 결정론, 단조: `g`↑이면 `apt` 비감소.
- **손계산**(구현 실측이 대체): 수저 1에서 `g`가 6~12이면 `high`(≥65) 확률 ≈ 5~12%, 수저 5에서 `g`가 15~25이면 `low`(<35) ≈ 4~16% — 완료 기준 9(양쪽 ≥ 5%)의 경계다. 모자라면 7절 사다리의 싹 계수 0.7(0.65~0.75)·`GMAX`를 쓴다. 참고: 수저별 예체능 참여 비율의 공식 통계(사교육비조사 계열)가 근거로 쓸 만하나 저장소에 없고 이 문서는 읽지 못했다 — `INVEST_Q`는 설계값이다.
- **적성이 진학·직업을 연다**: 갈림길 선택지의 `requires.apt`와 직업의 `when.apt`가 읽는다(3·4절).

---

## 3. 사건 자격·선택지·문장 변주 인터페이스 (PL3)

### 3-1. 안 비교: 타입 있는 `Condition` 필드(A) vs 파생 플래그(B)

| | A. `Condition` 필드 | B. 시스템이 쓰는 플래그 |
|---|---|---|
| 모양 | `temper`·`apt`·`job`·`year`·`tailored` 선택 필드 | `t_curious`·`apt_art_high` … 플래그를 켜고 끔 |
| 장점 | 판의 값과 항상 일치, 저장 이름 최소, `requires`·`modifiers`·`variants`가 같은 코드로 읽음 | `events.ts` 변경 0 |
| 단점 | 공개 인터페이스 변경(정밀 레인) — 골든·lint·`conditionsCompatible` 개정 | 갱신 때마다 켜고 끄는 동기화 버그, `FLAG_PATTERN`(≤ 39자)·플래그 이름 수십 개가 **One-way**, `flagsWritten` 교차 점검에 시스템 플래그 예외가 필요 |
| 추천 | **A**([M1]) | 대안 |

### 3-2. A안의 구체

- `Condition`에 선택 필드(적힌 항목이 모두 맞아야 — 기존 AND 규칙): `temper?: TemperId[]`(지금 `shown`이 그중 하나) · `apt?: Partial<Record<AptKey, AptTier[]>>` · `job?: { field?: Occupation[]; id?: string[] }` · `year?: Range`(달력 연도 — 같은 사건의 세대별 변주·선택지 가림에 쓴다) · `tailored?: true`(이 판에 `persona`가 있다 — 맞춤 판 전용 사건·구형 저장에서 막는다).
- `CondContext`에 `persona?: PersonaView | null`과 `year?: number`를 더한다. `PersonaView = { shown, aptTier, job }`은 순수 함수 `personaViewOf(state)`가 만든다. **모르거나 없으면 그 조건은 맞지 않는다**(가족 조건과 같은 안전 쪽, `events.ts:308-311`). 부정 조건(`not`)은 만들지 않는다(다른 값을 나열).
- `meetsCondition`·`isEventEligible`·`eventWeight`(`modifiers`)·`visibleChoices`(`requires`)가 그대로 새 필드를 읽는다. `conditionsCompatible`(`eventLint.ts:407`)·`visibleChoiceSets`(458)·`worstCaseVisibleChoiceIds`(470)가 새 필드를 이해해 「최악의 판에서 보이는 선택지 ≥ 2」를 계속 지킨다(서로 겹치지 않는 `temper` 목록은 양립 불가).
- `MAX_DEFINED_CHOICES` 4 → **6**, `MAX_VISIBLE_CHOICES` 3 유지([M2]) — 한 갈림길에 수저·적성별 선택지를 충분히 둔다.
- 선택지 필드 `act?: ActKind`(1-3절)와 사건 필드 `pick?: { kind: 'job-field' | 'job-detail' }`(4절). `act`는 선택지 이벤트의 선택지에만, `pick` 사건은 정의 `choices`가 없다.
- **문장 변주**: 사건 `text`와 선택지 `result`에만 `variants?: { when: Condition; text: string }[]`(사건 `textVariants`·선택지 `resultVariants`, **사건·선택지당 최대 3개**, 먼저 맞는 것이 이긴다, 없으면 기본 글). 규칙: ① **글만**(효과·선택지·확률 없음, 시험이 필드 모양으로 막는다) ② 변주마다 `TEXT_LIMITS`·합쇼체·시대어(`ERA_BANNED_WORDS`)·느낌표·이모지 lint를 **그 사건의 `eras`·`stages`로** 통과 ③ `when`이 사건 `conditions`와 양립 가능 ④ 변주 간 의미 반전·서열화 금지(reviewer 읽기) ⑤ `heavy` 표지 사건의 변주도 「무거운 장면 가리기」가 함께 가린다(사건 단위) ⑥ 고르는 시점은 **카드가 만들어질 때**이고 연표 줄에는 고른 **최종 글**이 적힌다(`HistoryEntry.text`가 문자열이라 다시 고를 일이 없다 — `types.ts:202-209`). 라벨(`label`) 변주는 없다(선택지 정체성).
- **기존 사건 자격 불변 골든**: 이 변경 **전** 코드로 `tests/fixtures/eligibility-golden.json`을 만든다 — 기존 사건 id 전부 × 연도 격자(1940~2090 10년 간격) × 수저 1~5 × 고정 표본 상태 200개의 `(isEventEligible, eventWeight, visibleChoices id)`. 변경 뒤 같은 입력(`persona` 없음·있음 둘 다)에서 **한 칸도 다르지 않다**. 골든 재생성은 One-way(가족 골든 전례) — 마스터 승인·형진 님 확인.

---

## 4. 직업 2단계 (PL4)

- **1단계 분야** = `OCCUPATIONS` 9종 id 재사용(`types.ts:90`; 군인 없음 — 그대로). 부모·가족 직업 표(`familyJobs.ts`)는 **건드리지 않는다**.
- **2단계 세부 직업** 표 `src/data/jobs.json`(지연 로딩 데이터, 번들 제외 — 첫 로딩 여유 약 14KB, 8-2). 스키마 검증 `validateJobs`를 `scripts/validateEvents.ts`(check:events)에 더한다.

```
{ id, field: Occupation, name,                      // id는 영문 소문자·하이픈(One-way, 삭제·재사용 금지)
  yearRange: {from?, to?},                          // 달력 연도 — 그 직업이 있던 때(하드)
  when?: Condition,                                  // 학력 stats.education · flags(college 등) · parentWealth · apt (소프트)
  open?: true,                                       // 조건 없이 언제나 후보가 될 수 있는 입문 직업(분야마다 ≥ 1)
  fitApt?: AptKey,                                   // 후보 점수에 가산
  weight, wageRef }                                  // wageRef = occupation-wages.md의 행 id (5절)
```
- **금지**: `when`에 `looks`·`gender`를 쓰지 않는다(외모·성별 서열화 금지 — SPEC 안 할 것, [M6]) · 실존 회사·상표 이름 · 평가어. 외모는 문장 변주에만 쓴다.
- **후보 규칙** `jobCandidates(state, step)` — 순수·결정론:
  1. `yearRange`로 거른다(하드). 분야 단계: 후보 직업이 하나라도 있는 분야만 남긴다.
  2. 각 직업의 `when`을 평가해 **적합**/**부적합**으로 나눈다(학력·형편·적성 — 소프트).
  3. 적합한 것의 점수 `weight × (1 + 0.5 × tierValue(fitApt))`(low 0 · mid 0.5 · high 1)로 **해시 비복원 추첨**(`famHash01(famSeed, 21, 50, 나이)`를 번호로 섞은 값)해 최대 **5개**▲를 고른다.
  4. 적합한 것이 **3개 미만이면** 부적합한 것을 「모자란 조건의 수」가 적은 순(동수는 해시)으로 채워 3개로 맞춘다 — 채워진 항목은 **「무리한 도전」**(`stretch`)으로 표시되고 결과는 더 어렵다(초기 소득 보정 −·행복 −, 값은 PL4가 정한다). **막다른 길 0**: 어떤 입력에서도 후보 ≥ 3이다(분야마다 `open` ≥ 1이라 하드 조건만으로는 3개 미만이 되지 않는 분야가 없다 — 격자 시험).
- **카드 모양 `pick`**: 후보가 동적이고 3~5개라 정적 `choices`(보이는 ≤ 3)로 못 쓴다 → 사건 필드 `pick`(정의 선택지 없음)이 있는 사건은 `pending.choiceIds`를 `jobCandidates`가 채운다. 화면은 목록 한 칸 5개까지(폭 320 안, designer — PL7), 해결은 코드(`resolveJobPick`)가 한다. 사건 둘: `job-pick-field`(G4)·`job-pick-detail`(G5), 나이 창 19~24세▲(대학·입시 갈림길 뒤), 모두 `once`·`conditions: { tailored: true }`. **자동·흘러감**은 같은 후보에 `jobPickWeights`(점수 × `exp(priority.wealth × 소득 호감 / T)`)로 정하고 같은 함수를 쓰므로 R-039가 유지된다. 이 경로는 일반 `autoChoiceWeights`와 따로라 Codex 범위다([M3]).
- **기존 사건과의 관계**: `youth-first-job`(22~32세)은 id·선택지를 바꾸지 않고 `notFlags`에 `job_picked`를 **더한다**(맞춤 판에서 직업을 이미 고른 뒤 중복을 막는다 — 플래그 없는 기존 판은 동작이 같다, 골든 대상). `has_career`는 직업 고르기가 그대로 설정한다(경제가 읽는 `workStateOf` 불변).
- 직업을 고르면 `persona.job = { field, id, since }`. 이직은 M1 밖(교체 가능한 모양이고 지난 직업은 연표 줄이 기록).
- **직업별 직장 사건**(PL6)은 `conditions: { job: { id | field } }`로 그 직업에서만 일어난다 — 첫 묶음 5분야×사건 3~4개.

---

## 5. 소득 연결 (⑤) — **PL0a 결과 뒤 채움**

**구조만 확정(값은 `docs/data/occupation-wages.md` 뒤):**
- 입력: `jobs.json`의 `wageRef` → 그 문서의 행(직업 → 연도/구간별 임금, 출처 기관·표 이름, 시대 보정 방법, 통계가 없는 항목은 「추정(가까운 직종)」 표시).
- 경제 연결 후보(`economy.ts#incomeOf`가 읽는 곳): `EconomyContext`에 선택 필드 `jobMul`(없으면 1)을 더해 `labor × jobMul`. `persona`가 없거나 직업 전이면 `jobMul = 1` → 구형 저장·직업 전의 소득은 변경 전과 **같다**(골든).
- 제약(▲): ① **분야 안 가중 평균(가중치 = `weight`) `jobMul` = 1.0** — 분야 평균은 기존 통계 값을 유지한다(SPEC PL4) ② 상한·하한 `jobMul` ∈ [0.6, 2.0] ③ 「무리한 도전」 초기 보정은 해마다 사라진다 ④ 소득 숫자는 화면에 노출하지 않는다(SPEC 결정 Q6) ⑤ `check:economy`·`economyBalance` 가드를 통과한다(비틀지 않고 차이는 보고).
- 채울 것: 세부 직업별 `jobMul` 표·시대 보정 식·「추정」 표시 항목 목록·근거 표.

---

## 6. 저장·호환·One-way (⑥)

### 6-1. 필드 (`GameState.persona?` — 선택 필드, SPEC-005 SV1 방식)

```
persona?: {
  v: 1,                      // 모양 버전(저장 SCHEMA_VERSION과 별개 — 가족 모양 버전 전례 familyModel.ts:89)
  born: 0..5,                // 출생 두드러진 기질 번호
  w: [6개 정수 5..95],       // 기질 세기
  shown: 0..5,               // 지금 두드러진 기질(완충 상태를 이어 가려고 저장)
  g: [5개 정수 0..30],       // 적성 키움
  job?: { field: Occupation, id: string, since: 나이 }
}
```
- **`SCHEMA_VERSION` 9 그대로**. `withValidPersona`(신설, `storage.ts` 197-238의 `withValid…` 한 줄 더): 모양·길이·정수·범위가 하나라도 틀리면 **판을 버리지 않고 `persona`만 버린다**(→ 중립으로 이어진다). `phase === 'title'`이면 버린다. 알 수 없는 직업 id는 `job`에서 `id`만 지우고 `field`는 둔다(표에서 항목이 빠져도 이어진다).
- **싹(`s`)은 저장하지 않는다** — `peerSeed`에서 재계산한다. 그래서 **싹 해시식·태그·키 규칙을 바꾸면 기존 저장의 적성이 달라진다**(One-way).
- 크기 ≈ 80B 안팎(저장 용량 영향 무시 가능).

### 6-2. One-way 이름 목록 (배포 뒤 바꾸면 마이그레이션 — 형진 님 확인 [F2])

`persona`(필드명)와 하위 `v·born·w·shown·g·job·field·id·since` · 기질 id 6개와 순서(번호) · 적성 id 5개와 순서 · 활동 `act` id 8개 · 해시 태그 **21**과 키 규칙(1-2절) · 싹 식 · `job` id(전체, **삭제·재사용 금지** — 빠지면 `field`만 남는다) · 플래그 `job_picked` · 사건 id `job-pick-field`·`job-pick-detail` · 데이터 필드 이름 `act`·`variants`(`textVariants`·`resultVariants`)·`pick`·`Condition` 새 필드 5개. (화면 이름·문장·값 표는 Two-way.)

### 6-3. 호환·복구·롤백

- **구형 저장(v0.5.1 이하)**: `persona` 없음 → **중립**: `tailored`·`temper`·`apt`·`job` 조건은 모두 맞지 않아 맞춤 사건·선택지·직업 카드가 나오지 않고, 자동 모드 보정·소득 `jobMul`은 1이며, `youth-first-job` 등 기존 흐름이 그대로다. **`ensureFamily` 같은 채워 넣기를 하지 않는다**(SPEC 결정 Q4 — 맞춤은 새 판부터). 이어하기에 불이익이 없다.
- **롤백 스위치 `PERSONA_ENABLED`**(`src/data/personaSwitch.ts` 한 곳, `ASK_PET_ENABLED` 전례): false면 새 판이 `persona`를 만들지 않고 모든 맞춤 효과가 꺼진다. **이미 저장된 `persona`는 지우지 않고 그대로 통과시킨다**(켜면 이어진다). 이때 결과 요약이 변경 전과 같음을 시험으로 잠근다.
- **내려가기**: v0.5.1 앱이 `persona`가 든 저장을 열 수 있는지(모르는 최상위 필드를 막지 않는지)는 **읽어서 확인하지 못했다** — Codex 범위이고, 막으면 롤백 계획이 달라진다([M8]).

---

## 7. 튜닝 사다리와 시험 (⑦)

**사다리**(재승인 없이 움직일 수 있는 범위, 움직이면 dev 로그와 이 절에 기록): ① `ACT_PULL` 2~8 ② 완충 `H` 4~10 ③ `ACT_SHIFT`·`ACT_APT` 값 ±1(행의 양의 합 ≤ 15, 음의 합 ≥ −7) ④ `ENV_DRIFT` 확률 0.3~0.6·값 +1 고정 ⑤ 싹 계수 0.65~0.75·`GMAX` 25~35 ⑥ `INVEST_Q` 각 칸 ±0.05(수저 단조 비감소 유지) ⑦ `TP`·`AFF` ±0.1 ⑧ 후보 상한 5·하한 3은 고정 ⑨ `stretch` 보정 값. **범위 밖은 승인**: 기질·적성 수 변경, 해시 태그·키, `born` 분포(A↔B), 입력 추가.

**시험 목록**(신설 제안): `tests/personaDoc.test.ts`(9절 블록 ↔ 코드) · `personaBirth.test.ts`(L0: `rngState`·기존 출생 필드 불변, 같은 시드 같은 `persona`, 분포 ±▲) · `personaShift.test.ts`(활동·감쇠·상하한·완충·격자) · `personaApt.test.ts`(식 격자·단조·싹 수저 독립) · `personaCondition.test.ts`(자격 불변 골든·모르는 값 안전) · `eventLintPersona.test.ts`(변주 lint·양립·최악의 판 ≥ 2) · `jobTable.test.ts`(후보 3~5·`yearRange`·`open` 분야당 ≥ 1·막다른 길 0 격자) · `storagePersona.test.ts`(구형·이상한 필드·`PERSONA_ENABLED`) · `personaAuto.test.ts`(R-039 동치·중립 불변). 기존 시험은 지우지 않는다.

---

## 8. 측정 `report:persona` (⑧)와 영향 어림

### 8-1. 정의 (신설 `scripts/personaReport.ts`, `npm run report:persona` — 마스터 승인 2026-11-10)

- 인자: `--gen=millennial` `--n=1000`(▲ 칸당) `--wealth=1,5` `--temper=0..5|all` `--seed=…` `--only=…`. 수저 지정은 해당 수저가 나올 때까지 시드를 걸러 뽑는다(출생 결과의 일관성 유지). 기질 지정은 시험 전용 인자로 `born`·`w`만 덮어쓴다.
- 보고 표: ① 출생 기질 분포(대 설계 분포) ② 갈림길 G1~G5별 **보이는 선택지 id 집합**의 수저 1·5단계 차이(한 쪽에만 보이는 id 수, Jaccard 거리 평균) ③ 같은 수저·시드에서 출생 기질별 **자동 모드 첫 선택 분포 총변동거리**(가장 먼 쌍) ④ 20세 시점 `shown` 분포·`shown ≠ born` 비율·판당 활동 갱신 횟수 ⑤ 적성 단계 분포(수저별 `high`·`low`) ⑥ 직업 후보 수 분포(3~5)·`stretch` 비율·`yearRange` 위반 0 ⑦ 한 선택지의 자동 선택 비율 최대(> 60%▲ 경고).
- 기준은 SPEC 완료 기준 7~10이 정한다(이 문서는 표만 정의한다).

### 8-2. 판 길이·번들 어림 (손계산 — `report:time`·`e2e:prod` 실측이 대체)

- 새 카드: 직업 고르기 2장 + 변주·갈림길 선택지 추가는 장수 불변(읽는 글자만 소폭) + 직업 사건 3~4개(서술·선택) — 조르기 전례의 장당 약 0.23분(`ask-model.md` 5-2절)으로 **+0.9~1.4분**▲. 새 사연 10개 안팎(SPEC PL6)은 따로 더한다. 현재 평균 약 35.9분(상단 36 — 손계산)이므로 **평균 상단을 넘을 가능성이 높다**. 내용은 줄이지 않고 실측 뒤 마스터가 형진 님께 보고한다([M9]).
- 번들: 코어 코드 +2~4KB(gzip, ▲), 첫 로딩 여유 약 14KB(385,630 → 한도 400,000B — SPEC-017 spec 로그의 기록값) — 직업 표·변주 데이터는 지연 로딩 청크, 사건 JSON 추가분은 기존 방식대로 포함되므로 실측 보고 대상.

---

## 9. 기계 판독 블록 (`tests/personaDoc.test.ts`가 읽는다 — 이 블록만 고치면 문서와 코드가 어긋난다)

```persona-table
# persona-table v1
# MODEL | 이름 | 값
MODEL | hashTag | 21
MODEL | wMin | 5
MODEL | wMax | 95
MODEL | bornMain | 60 69
MODEL | bornOther | 20 44
MODEL | shownMargin | 6
MODEL | dampFrom | 60
MODEL | gMax | 30
MODEL | seedCoef | 0.7
MODEL | tierMid | 35
MODEL | tierHigh | 65
MODEL | actPull | 4
MODEL | partialWeight | 0.5
MODEL | candidatesMax | 5
MODEL | candidatesMin | 3
MODEL | maxDefinedChoices | 6
# TEMPER | id | 번호
TEMPER | curious | 0
TEMPER | steady | 1
TEMPER | driven | 2
TEMPER | warm | 3
TEMPER | quiet | 4
TEMPER | easy | 5
# APT | id | 번호
APT | study | 0
APT | art | 1
APT | sport | 2
APT | craft | 3
APT | people | 4
# ACT | act | 기질 변화(curious steady driven warm quiet easy)
ACT | sport | 0 2 5 3 -2 1
ACT | social | 1 0 1 5 -3 2
ACT | read | 4 2 0 -1 4 0
ACT | art | 3 2 1 1 3 0
ACT | make | 2 4 1 0 2 0
ACT | study | 2 3 3 -1 1 -2
ACT | work | 0 3 3 1 0 -2
ACT | alone | 1 1 0 -3 4 1
# ACTAPT | act | 적성 키움(study art sport craft people)
ACTAPT | sport | 0 0 4 0 0
ACTAPT | art | 0 4 0 0 0
ACTAPT | read | 2 1 0 0 0
ACTAPT | make | 0 0 0 4 0
ACTAPT | social | 0 0 0 0 4
ACTAPT | alone | 0 1 0 1 0
ACTAPT | study | 3 0 0 0 0
ACTAPT | work | 0 0 0 1 2
# TP | 기질 | 자동 모드 보정(wealth education health happiness relationships)
TP | curious | 0 0.4 0 0.2 0
TP | steady | 0.2 0.3 0.2 0 0
TP | driven | 0.3 0.3 0 -0.2 0
TP | warm | 0 0 0 0.2 0.5
TP | quiet | 0 0.2 0.1 0 -0.3
TP | easy | -0.2 -0.2 0 0.4 0
# AFF | 기질 | 적성 친화(study art sport craft people)
AFF | curious | 0.3 0.3 0 0.3 0
AFF | steady | 0.6 0 0.3 0.6 0
AFF | driven | 0.3 0 0.6 0 0
AFF | warm | 0 0.3 0 0 0.6
AFF | quiet | 0.3 0.6 0 0.3 -0.3
AFF | easy | -0.3 0 0.3 0 0.3
# INVEST | 수저 | 연 투자 확률(study art sport craft people)
INVEST | 1 | 0.20 0.03 0.08 0.05 0.05
INVEST | 2 | 0.25 0.06 0.12 0.06 0.07
INVEST | 3 | 0.33 0.15 0.18 0.08 0.10
INVEST | 4 | 0.40 0.25 0.25 0.09 0.12
INVEST | 5 | 0.45 0.35 0.30 0.10 0.15
# INVESTMUL | 양육 방식 | 곱수(study art sport craft people)
INVESTMUL | strict | 1.3 1.0 1.0 1.0 1.0
INVESTMUL | free | 0.9 1.2 1.2 1.0 1.2
INVESTMUL | helicopter | 1.2 1.2 1.2 1.2 1.2
INVESTMUL | neglect | 0.6 0.6 0.6 0.6 0.6
# DRIFT | 양육 방식 | 해마다 +1(해시 <0.5) 받는 기질
DRIFT | strict | steady driven
DRIFT | free | curious easy
DRIFT | helicopter | quiet steady
DRIFT | neglect | quiet driven
```

(INVEST·INVESTMUL·DRIFT의 값은 모두 ▲ 설계값이고 근거 통계가 없다. 수저가 낮을수록 예능·체능 투자 확률이 낮다는 방향만 SPEC 형진 님 예시에서 왔다.)

---

## 10. 승인 항목

### 10-1. 형진 님이 고를 것

| # | 항목 | 추천 | 대안 | 절 |
|---|---|---|---|---|
| **F1** | 출생 기질의 배정 분포 | **A 완전 균등** — 수저·양육의 영향은 활동 갱신·환경 흐름·선택지 가림에 이미 있어 이중 계산·고정관념을 피한다 | B 양육 방식·수저와 약한 상관(곱수 0.8~1.25, 어느 기질도 ≥ 8%) | 1-2 |
| **F2** | **One-way 이름 목록**(저장 필드 `persona` 모양, 기질 6·적성 5·활동 8의 id, 해시 태그 21, 싹 식, 직업 id 규칙, `job_picked`) — 배포 뒤 바꾸면 마이그레이션 | 6-2절 목록대로 + `SCHEMA_VERSION` 9 유지(선택 필드) | 이름·수를 승인 전에 바꾼다(기질 5·8종 등) | 6 |
| **F3** | 후보가 3개 미만일 때 **「무리한 도전」 선택지**로 채우는 것(형편·학력이 모자라도 길이 막히지 않고 더 어렵다) | 허용 | 후보가 모자라면 못 고르게 하고 입문 직업으로만 채움(선택의 폭이 좁다) | 4 |
| **F4** | 기질이 바뀌는 순간 **연표 한 줄**(「… 아이가 어느새 …」 같은 말, 숫자 없음) | 둔다(바뀐 것을 플레이어가 알아차려야 「변주」가 체감된다) | 두지 않고 프로필 문구만 조용히 바뀐다 | 1-3 |

### 10-2. 마스터가 정할 것

| # | 항목 | 추천 | 절 |
|---|---|---|---|
| M1 | 사건 자격 인터페이스: 타입 있는 `Condition` 필드(A) vs 파생 플래그(B) | A | 3-1 |
| M2 | `MAX_DEFINED_CHOICES` 4 → 6(보이는 3 유지) | 올린다 | 3-2 |
| M3 | `pick` 카드(후보 3~5개, 동적 선택지)와 `jobPickWeights` 별도 자동 경로 — UI 한 칸 5개 | 둔다(Codex 범위 포함) | 4 |
| M4 | 기질이 바뀌는 순간 연표 줄을 기존 `note`류 줄로 둘지 새 줄 종류로 둘지(F4가 「둔다」일 때) | 기존 줄 종류 재사용 | 1-3 |
| M5 | 부모가 정한·흘러간 카드도 활동 갱신에 ½ 가중 | ½ | 1-3 |
| M6 | 낙인 점검: `ENV_DRIFT` neglect·helicopter 줄·직업 `when`의 외모·성별 금지를 reviewer 점검 항목으로 | 둔다 | 1-3·4 |
| M7 | 기질 6종·적성 5종·활동 8종의 목록(id 확정은 F2) | 6·5·8 | 1-1·2 |
| M8 | CX-002 범위에 「v0.5.1 앱이 `persona` 저장을 여는지」와 `PERSONA_ENABLED` 끈 판의 변경 전 동치 포함 | 포함 | 6-3 |
| M9 | 판 길이: 평균 상단을 사전 상향하지 않고 실측 뒤 형진 님께 보고 | 실측 뒤 보고 | 8-2 |
| M10 | `FAMILY_TAG_PERSONA = 21`을 `FAMILY_TAG` 객체 밖에 둔다(가족 골든 보존) | 밖 | 1-2 |
| M11 | 기존 사건 자격 골든 `eligibility-golden.json`을 변경 **전** 코드로 먼저 만든다(블라인드 기준, Codex 요청에 커밋 지정) | 만든다 | 3-2 |

### 10-3. 마스터에게 확인 필요 (기획자가 정하지 않은 것)

- 5절(소득 연결)은 PL0a 결과 뒤 채워 **이 문서의 승인은 2단계로 나뉜다**: ① 1~4·6~9절 구조 승인 → PL3·PL1·PL2 착수 가능 ② 5절 승인 → PL4 소득 연결 착수. 한 번에 승인할지 나눌지.
- 코드 읽기만으로는 `GameState` 최상위의 모르는 필드를 이전 앱이 막는지, `pending`·UI가 선택지 5개를 그릴 수 있는지, `resolveChoiceCore`·`stepYear` 해 끝 처리의 정확한 호출 자리를 확정하지 못했다 — 구현 전 작업자 확인 사항이다.
- 활동 표지 `act`를 붙일 기존 선택지 목록(예: `school-club`의 `sports`·`books`·`home`, `school-tutoring`, `school-parttime`)은 PL5가 정한다(기존 사건 id·선택지 id는 바꾸지 않는다).

---

## 11. 마스터 승인

(승인 전 — 승인되면 이 절에 일시·범위·F1~F4·M1~M11 결정을 `ask-model.md` 14절 방식으로 적고 `ai-log/<날짜>_SPEC-018_decision.md`에 함께 남긴다.)
