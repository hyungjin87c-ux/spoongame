# 기질·적성·직업 2단계·외모 영향 설계 (PL0) — SPEC-018 M1

- 작성: planner / 2026-11-10 (r1) · **r2 2026-11-10**(형진 님 답 반영) / 상태: **1·2절 유형 목록(기질·적성)은 조사 뒤 형진 님 승인, 나머지는 승인(2026-11-10)** — 단 r2가 새로 쓴 곳(1-3의 양육·역경·본보기, 4B 외모 영향, 5 소득 연결)은 마스터 검토 대기(10-3). 승인 전에는 `src/`를 바꾸지 않는다(CLAUDE.md 1절 CRITICAL 게이트 · SPEC-011 AK0 전례).
- 근거 SPEC: `docs/spec/SPEC-018-맞춤인생.md`(PL0 ①~⑧·PL16·PL17). 꼴은 `docs/data/ask-model.md`를 따른다. **근거 문서**: `docs/data/occupation-wages.md`(완료, 5절) · `docs/data/persona-research.md`(**조사 중** — 2절 기질·환경, 4절 외모 영향) · `docs/data/private-education-stats.md`(**진행 중**, `INVEST_Q` 근거).
- 읽은 코드(읽기만 했다): `src/core/events.ts`(`Condition` 87-107 · `ChoiceDef` 121-143 · `heavy` 211-215 · `isEventEligible` 355-370 · `MAX_DEFINED_CHOICES` 436-437) · `src/core/life.ts`(`AUTO_PRIORITY` 596-601 · `autoChoiceWeights` 611-647) · `src/core/birth.ts`(`generateBirth` 202-222) · `src/core/familyRng.ts` · `src/core/familyModel.ts`(`FAMILY_TAG_ASK` 41-47) · `src/core/storage.ts`(선택 필드 56-66·`withValid…` 197-238) · `src/core/types.ts`(`GameState` 273-339 · `HistoryEntry` 202-222 · `OCCUPATIONS` 90) · `src/core/economy.ts`(`incomeOf` 99-108) · `src/assets/faces/faceLayers.ts`(`looksTierOf` 57-65) · `src/data/events/youth.json`(`youth-first-job` 30 · `youth-approached` 327 · `youth-job-rejections` 851) · `school.json`(`school-club` 238 · `school-first-love` 95).
- 표기: **▲** = 기획자 설계 제안값(공식 통계가 아니고 화면에 숫자로 나오지 않는다 — 구현 실측이 대체). **손계산** = 이 문서를 쓰며 한 어림. **[F#]** 형진 님 결정/항목, **[M#]** 마스터 항목(10절).
- **확정하지 않는 것**: 실제 이름·문장(designer·`copy.md`), 화면, 구현 코드, 기질·적성 유형 목록(조사 뒤), 외모 시대 구간의 연도(조사 뒤), 판 길이 임계(실측 뒤).

---

## 0. 한 화면 요약

1. **기질**(유형 목록은 조사 뒤 확정 — 지금은 6종▲): 세기 벡터(비공개 정수 5~95). 출생 때 `peerSeed` 파생 해시로 하나가 두드러지게 배정되며 **양육 방식·수저와 약한 상관**(B안, [F1] 결정). 인생 중 **활동·선택**, **양육 방식의 지속 영향**, **아동기 역경(기존 「무거운 장면」)**, **본보기 어른**으로 움직이되 모두 약하게, 한 방향 고정을 막는 장치와 함께(1절). 화면에는 지금 가장 두드러진 기질만 말로.
2. **적성**(축 목록은 조사 뒤 확정 — 지금은 5축▲): `0.7 × 싹 + 키움`. 싹은 해시·수저와 독립, 키움은 학교·부모 투자·활동·기질 친화(2절).
3. **인터페이스**: `Condition` 타입 필드(`temper`·`apt`·`job`·`year`·`tailored`), 선택지 표지 `act`·`role`, `variants`, 선택지 정의 최대 6, 동적 후보 카드 `pick`. 기존 사건 자격 불변 골든(3절).
4. **직업 2단계**: 분야 9종 재사용 + 세부 표 `jobs.json`. 시간은 하드, 학력·적성·형편은 소프트. **고르면 지원 단계**(서류·면접 판정 — 외모 영향 포함, 떨어져도 길이 막히지 않음)(4·4B절).
5. **외모 영향**(PL16): 외모는 **길을 막는 조건이 아니라 확률·문장의 가산·감산**. 교우·연애·취업(지원), 시대별 차이, 만회 경로, 정당화·조롱 금지(4B절).
6. **소득**: `jobMul = occMult ÷ 대표 학력 배수`, `occMult` = 세부 직종 ÷ 전직종(같은 표·같은 해), 승무원 급변·통계 없는 직업 처리(5절).
7. **저장**: 선택 필드 `persona` 하나(`SCHEMA_VERSION` 9 유지, 이상하면 그 필드만 버림, 구형은 중립), 롤백 스위치 `PERSONA_ENABLED`(6절). **One-way** 목록(6-2).
8. **판 길이**: 손계산 +1~1.6분 — 현재 평균 상단 36분 초과 가능성이 높다. 내용을 줄이지 않고 실측 뒤 보고(8-2).

---

## 1. 기질 (PL1)

### 1-1. 종류와 이름 후보 — **조사 뒤 확정 (`persona-research.md`)**

수 N = 6▲ · 이름은 designer. 목록(수·id)은 형진 님이 근거 자료와 함께 승인한다 — 승인 전 id는 임시이고 One-way 목록(6-2)에도 확정되지 않았다. 아래 식은 N에 의존하지 않는다.

| 번호 | 임시 id | 이름 후보 | 뜻 |
|---|---|---|---|
| 0 | `curious` | 호기심 많은 | 새것·낯선 것에 끌림 |
| 1 | `steady` | 끈기 있는 | 한 가지를 오래·꼼꼼히 |
| 2 | `driven` | 지기 싫어하는 | 겨루고 이기고 싶음 |
| 3 | `warm` | 붙임성 좋은 | 사람 사이가 편함 |
| 4 | `quiet` | 속이 깊고 조용한 | 혼자·깊이 파는 쪽 |
| 5 | `easy` | 느긋한 | 걱정이 적고 흘러가는 대로 |

서열이 없는 중립·긍정 낱말이다. 80억분의1의 성향 낱말은 읽지 않았고 쓰지 않는다(겹침 판독표 PL7).

### 1-2. 출생 배정 — [F1] 결정: **B 약한 상관**

- **시드·해시**: `famSeed = famSeedOf(peerSeed)`. `generateBirth`가 `persona`를 같은 호출에서 파생해 `BirthResult`에 더한다(`birth.ts:221`, 진행 난수·기존 필드 불변 — L0 시험). 태그 **`FAMILY_TAG_PERSONA = 21`**은 `FAMILY_TAG` 객체 **밖**(`familyModel.ts:41-47`의 가족 골든 이유). 키: 두드러진 기질 `(1,0)` · 나머지 세기 `(2,i)` · 부모 투자 `(10+k, 나이)` · 환경 흐름 `(30+i, 나이)` · `shown` 동률 `(40, 나이)` · 직업 후보 `(50, 나이)` · 지원 판정 `(60, 나이×10+시도)` · 본보기 어른 `(70+역할번호, 나이)` · 역경 경로 `(80, 사건번호)` · 시대·규모 분산 `(90, 나이)` · 적성 싹 `(100+k, 0/1)`(서로 겹치지 않는다 — 시험).
- **분포** `P_i ∝ M[양육 방식][i] × N[수저][i]`(표 9절): 양육 곱수 0.9~1.15, **수저 곱수는 0.95~1.1로 더 좁게**(「가난 = 특정 기질」 고정관념을 막으려고 직접 상관을 더 약하게). 손계산: 모든 칸에서 `P_i` ≈ 0.13~0.22. 근거: **persona-research.md 2절(조사 중)** — 숫자는 모두 ▲이고 연구가 바꾼다. 형진 님 취지: 기질·적성은 유전과 환경이 함께 만든다.
- **세기**: `w[born] = 60 + ⌊10·h⌋`, 나머지 `w[i] = 20 + ⌊25·h_i⌋`(h = 해시), `shown = born`.

### 1-3. 세기 갱신 — 약하게, 고정관념 방지 장치와 함께

세기 정수, **하한 5 · 상한 95**. 모두 해시·표만 쓰는 순수 계산(난수 비소비). **양의 변화량은 감쇠**: `실제Δ = round(Δ × (1 − max(0, w − 60)/40))`(80에서 ½, 95에서 ⅛). 음은 감쇠 없이 하한까지. 아래 ①~④가 요인이다(근거: persona-research.md 2절, 조사 중 — 값은 ▲).

1. **활동·선택 (`act`)**: 선택지 필드, 값은 코드 표 한 곳 `ACT_SHIFT`(조르기 `ASK_EFFECTS` 전례). 8종▲ `sport` 운동 · `art` 악기·미술·무용 · `read` 읽기·글 · `make` 만들기·기술 · `social` 친구·모임 · `alone` 혼자 보내기 · `study` 공부·학원 · `work` 일·아르바이트. 해결 때(`resolveChoiceCore`) 적용, 부모가 정한·흘러간 카드(`by`)는 ½. 값은 9절 블록(예: `sport` → driven +5 · warm +3 · steady +2 · easy +1 · quiet −2). 한 행의 양의 합 ≤ 15, 음의 합 ≥ −7.
2. **양육 방식의 지속 영향 (`ENV_DRIFT`)**: 나이 3~18, 해 끝(`stepYear` 한 곳)마다 양육 방식별 기질 1~2개가 해시 `< 0.5`일 때 +1: strict → steady·driven / free → curious·easy / helicopter → quiet·steady / neglect → quiet·driven. 형편은 직접 입력이 아니다(선택지 가림 PL5로 간접).
3. **아동기 역경 (기존 「무거운 장면」 `heavy.kind` 재사용 — 새 표지 없음)**: 나이 ≤ 18에 `heavy` 사건(부모 별세·이혼·실직·괴롭힘·병·생계 곤란 등 — `home`·`school`·`health`·`loss`·`bond`·`work`)이 일어나면 세기가 **한 방향이 아니라 세 경로 중 하나**로 움직인다: **W 회복**(steady +2 · warm +1 · curious +1) / **H 움츠림**(quiet +3 · easy −2 · warm −1) / **D 독해짐**(driven +3 · easy −1 · warm −2). 경로는 분류별 확률 표(9절 `ADV`, ▲)에 해시 `(80, 사건번호)`를 댄 것이고, **지지가 있으면**(부모와 사이 `closenessOf` 4 이상 · `close_friend` · 본보기 어른을 겪음) W 확률이 +0.3(나머지는 원래 비율로 줄임, 상한 0.8). 한 판 역경 갱신의 `|Δ|` 합 ≤ 12. **무거운 장면 가리기와의 관계**: 방식 A(`events.ts:211-215`)대로 사건·효과·난수는 그대로이고 **갱신도 그대로** 일어난다 — 가려지는 것은 글뿐이다. 기질 변화 연표 줄([F4])은 원인을 적지 않는 일반 문장이라 가리기 중에도 같다.
4. **본보기 어른 (`role`)**: 선택지(또는 서술 사건) 표지, 5종▲ `teacher` · `relative` · `neighbor` · `coach` · `boss`. 존경하는 어른을 겪는 사건이 일어나면 그 어른의 기질 `mt = ⌊N × famHash01(famSeed, 21, 70+역할번호, 나이)⌋`쪽으로 `w[mt] += 3`(감쇠 적용, 부모·흘러감 ½). 어른의 기질은 화면에 나오지 않고(문장은 일반적으로), 판당 최대 4번, 본보기를 겪은 횟수는 저장하지 않고 `seen`과 사건 표지에서 센다. 표지를 붙일 사건·문장은 PL6·PL17이 정한다.
5. **고정관념 방지 장치(필수)**: ⓐ 크기: 활동 1회 `|Δ|` ≤ 5, 역경·본보기 ≤ 3(경로 W/H/D 한 번 합 ≤ 6), 환경 +1 ⓑ **방향 다중화**: 같은 역경도 W·H·D로 갈리고 지지가 길을 바꾼다 ⓒ **수저를 갱신 입력으로 쓰지 않는다**(출생 곱수 ±10%만) ⓓ 시험·보고: 20세 시점 수저 1·5단계의 `shown` 분포 차이가 어느 기질에서도 > 8%p▲이면 경고하고 사다리로 줄인다, 어느 기질도 한 수저에서 > 30%▲이면 사다리 ⓔ 문장 lint: 「가난해서/부잣집이라 …한 아이」「…를 겪었으니 …해진」 같은 인과 단정 금지(designer 낱말 목록 + reviewer) ⓕ 수렴: 20세에 한 기질이 가장 두드러진 판 ≤ 50%▲, 인생 중 `shown`이 `born`과 달라지는 판 ≥ 20%▲(SPEC 7-2).
6. **두드러진 기질 `shown`**: `argmax w`가 `w[shown] + H`(H = 6▲) 이상 크면 바꾸고 아니면 그대로(완충). 동률은 해시 `(40, 나이)`. 바뀌는 순간 **연표 한 줄**([F4] 결정: 둔다 — 숫자 없음, 원인 없음, [M4]).

### 1-4. 자동 모드와의 관계 (`autoChoiceWeights`)

- 보정 곱 `m_key = clamp(1 + Σ_t TP[t][key] × (w_t − 50)/100, 0.8, 1.25)`를 `AUTO_PRIORITY[양육 방식]`의 5키에 곱한다(`TP` 9절, ▲).
- **활동 끌림**: `act` 선택지 점수에 `ACT_PULL × Σ_t (w_t − 50)/50 × ACT_SHIFT[act][t]/5`(`ACT_PULL = 4`▲, 최대 약 +4 → 가중 ≈ ×1.9, T = 6). 자동·흘러감만 쓴다.
- **중립 불변**: `persona`가 없으면 `m_key = 1`·끌림 0 — 구형 저장·`PERSONA_ENABLED = false`의 자동 결과는 변경 전과 **비트 단위로 같다**. R-039(`autoResolveStep` = 수동 선택과 상태 전체가 같음)는 같은 함수라 유지. 조르기 `ask` 경로의 `scoreOf`도 같은 `priority`를 읽는다.

---

## 2. 적성 (PL2) — **축 목록은 조사 뒤 확정 (`persona-research.md`)**

- 5축▲(임시): `study` 학업 · `art` 예능(음악·미술·무용) · `sport` **체능(쉬운 말로 바꿀 예정 — 후보는 조사가 낸다)** · `craft` 손재주 · `people` 사람 상대. 목록은 형진 님이 근거와 함께 승인한다.
- **식**: `apt_k = clamp(round(0.7 × s_k + g_k), 0, 100)`.
  - **싹 `s_k`**(저장 안 함, `peerSeed` 재계산): `round(100 × (famHash01(famSeed,21,100+k,0) + famHash01(famSeed,21,100+k,1))/2)` — 삼각분포 평균 50, **수저와 독립**(SPEC 완료 기준 9).
  - **키움 `g_k`**(저장, 정수 0~30▲): ⓐ 학교 — 6~18세 짝수 나이 해 끝 `study` +1 ⓑ **부모 투자** — 4~18세 해 끝마다 `famHash01(famSeed,21,10+k,나이) < q`이면 +2, `q = clamp(INVEST_Q[수저][k] × INVEST_MUL[양육 방식][k], 0, 0.6)`(9절 ▲ — **근거: `private-education-stats.md`(진행 중)가 오면 교체, 지금은 설계값**) ⓒ 활동 — `ACT_APT[act]`(부모·흘러감 ½) ⓓ 기질 친화 — ⓑⓒ에 `m_k = clamp(1 + Σ_t AFF[t][k] × (w_t − 50)/100, 0.8, 1.3)`. 이득은 `max(1, round(base × m_k × (1 − g_k/30)))`, g = 30에서 멈춘다.
- **단계** `low` (< 35) / `mid` (35~64) / `high` (≥ 65)▲. 사건·직업 조건은 **단계만** 읽고 화면에는 숫자가 없다(결정 Q2).
- 입력 범위(격자 시험): 수저 1~5 · 양육 4 · 나이 0~100 · `w` 5~95 · `g` 0~30 · `s` 0~100. 단조: `g`↑이면 `apt` 비감소.
- **손계산**: 수저 1에서 `g` 6~12이면 `high` ≈ 5~12%, 수저 5에서 `g` 15~25이면 `low` ≈ 4~16% — 완료 기준 9의 경계. 모자라면 싹 계수 0.7(0.65~0.75)·`GMAX`를 쓴다.

---

## 3. 사건 자격·선택지·문장 변주 인터페이스 (PL3)

**안 비교**: A 타입 있는 `Condition` 필드(추천, [M1]) — 판의 값과 항상 일치·저장 이름 최소·`requires`·`modifiers`·`variants`가 같은 코드로 읽음, 대신 공개 인터페이스 변경(골든·lint 개정) / B 시스템이 쓰는 플래그 — `events.ts` 변경 0이나 켜고 끄는 동기화 버그·플래그 이름 수십 개 One-way.

- `Condition` 선택 필드(기존 AND 규칙): `temper?: TemperId[]`(지금 `shown`) · `apt?: Partial<Record<AptKey, AptTier[]>>` · `job?: { field?: Occupation[]; id?: string[] }` · `year?: Range`(달력 연도) · `tailored?: true`(이 판에 `persona`가 있다). `CondContext`에 `persona?: PersonaView | null`·`year?`를 더한다(`personaViewOf(state)` 순수). **모르거나 없으면 그 조건은 맞지 않는다**(가족 조건과 같다, `events.ts:308-311`). 부정 조건은 만들지 않는다.
- `meetsCondition`·`isEventEligible`·`eventWeight`·`visibleChoices`가 그대로 읽고, `conditionsCompatible`(`eventLint.ts:407`)·`visibleChoiceSets`(458)·`worstCaseVisibleChoiceIds`(470)가 새 필드를 이해해 「최악의 판에서 보이는 선택지 ≥ 2」를 지킨다. `MAX_DEFINED_CHOICES` 4 → **6**, `MAX_VISIBLE_CHOICES` 3 유지([M2]).
- 선택지 필드 `act?: ActKind`·`role?: RoleKind`(선택지 이벤트의 선택지·서술 사건에 `role`만), 사건 필드 `pick?: { kind }`(4절). 정의 `choices`가 없는 `pick` 사건은 lint 예외.
- **문장 변주** `textVariants`(사건 `text`)·`resultVariants`(선택지 `result`): `{ when: Condition, text }[]`, 사건·선택지당 ≤ 3, 먼저 맞는 것이 이긴다. ① **글만**(효과·선택지·확률 불가) ② 변주마다 `TEXT_LIMITS`·합쇼체·시대어·느낌표·이모지 lint를 그 사건의 `eras`·`stages`로 통과 ③ `when`이 사건 `conditions`와 양립 ④ 변주 간 의미 반전·서열화 금지 ⑤ `heavy` 사건의 변주도 함께 가려짐 ⑥ 카드가 만들어질 때 고르고 연표 줄에는 최종 글이 적힌다(`HistoryEntry.text` 문자열). 라벨 변주 없음.
- **외모 가림 금지 lint(신설, [M6] 개정)**: 새 사건과 `jobs.json`에서 `looks`는 `modifiers`·`bonuses`·`variants.when`에서만 쓴다. 사건 `conditions`·선택지 `requires`·직업 `when`에 `looks`를 쓰면 빌드가 막힌다(길 막기 금지). 기존 한 곳 `youth-approached`(`youth.json:337`, `conditions.looks ≥ 60`)는 허용 목록에 두고 [M12]가 바꿀지 정한다. **성별은 직업 `when`에 쓰지 않는다**(기존 `conditions.gender`는 직업 표 밖이라 해당 없음).
- **기존 사건 자격 불변 골든**: 변경 전 코드로 `tests/fixtures/eligibility-golden.json` 생성 — 기존 사건 id × 연도 격자(1940~2090, 10년) × 수저 1~5 × 고정 표본 상태 200개의 `(isEventEligible, eventWeight, visibleChoices)`. 변경 뒤 `persona` 없음·있음 둘 다 한 칸도 다르지 않다(재생성은 One-way). **기존 사건의 `modifiers`·`conditions`는 건드리지 않는다**(외모 영향도 새 사건·`tailored` 변주에서만).

---

## 4. 직업 2단계 (PL4)

- 분야 = `OCCUPATIONS` 9종 재사용(`familyJobs.ts` 불변). 세부 직업 표 `src/data/jobs.json`(지연 로딩, `validateJobs`를 check:events에 더함):

```
{ id, field, name, yearRange:{from?,to?},        // id는 One-way, 삭제·재사용 금지
  when?: Condition,                               // 학력 stats.education · flags · parentWealth · apt (소프트). looks·gender 금지
  open?: true,                                    // 조건 없이 후보가 되는 입문 직업(분야마다 ≥ 1)
  fitApt?, weight, hire: 'open'|'normal'|'selective', lookSens: 0.5|1.0|1.5, eduRef, wageRef, sizeMul? }
```
- **첫 묶음 분야 5개▲와 세부(최종 목록은 PL4, 통계 대응은 `occupation-wages.md` 2절)**: `professional`(소프트웨어 개발·간호·교사·디자이너·공학 연구·크리에이터†) · `clerk`(대기업 사무·중소기업 사무·은행 창구·공무원†·콜센터·호텔 프런트) · `service`(승무원·호텔 객실·미용·조리·카페 홀) · `sales`(백화점·면세점 판매·영업·텔레마케터 — 통계 직종 3개라 4번째는 추정 항목이나 추가 조사 필요) · `machine`(자동차 조립·반도체 장비·전자 조립·화학 장치·운전) — †은 통계 없음(5절). 배달·플랫폼(`labor`)은 형진 님 예시라 분야 5개 확정에서 같이 정한다([M13]). 관리자(`manager`)는 승진 결과로 다루고 후보가 아니다(wages 2-9).
- **후보 규칙** `jobCandidates(state, step)`(순수·결정론): ① `yearRange`로 거름(하드) ② `when` 평가 → 적합/부적합(소프트) ③ 적합한 것의 점수 `weight × (1 + 0.5 × tierValue(fitApt))`(low 0·mid 0.5·high 1)로 해시 비복원 추첨해 최대 **5개** ④ 적합 < 3이면 부적합을 「모자란 조건 수」순으로 채워 **3개**(채운 항목은 **「무리한 도전」** `stretch` — [F3] 결정: 허용, 지원 확률 −0.15·초기 소득이 낮아짐 — 학력이 모자라면 5절의 `jobMul`이 자동으로 낮다). 분야마다 `open` ≥ 1이므로 막다른 길 0(격자 시험).
- **카드 `pick`**(후보 3~5, 동적): 사건 `job-pick-field`(G4, once)·`job-pick-detail`(G5, 합격 전까지 반복·쿨다운 1), 나이 19~24▲, `conditions: { tailored: true }`. 화면은 목록 한 칸 5개까지. 자동·흘러감은 `jobPickWeights`(같은 후보·점수 × `exp(priority.wealth × 소득 호감 / T)`, 같은 함수라 R-039 유지, [M3]).
- **지원 판정**(PL16, 4B절): 세부 직업을 고르면 지원이고 합격하면 `persona.job = { field, id, since }`와 `job_picked` 플래그, `has_career` 설정. **불합격**이면 `persona.tries += 1`, 다음 해 같은 카드가 다시 뜬다. 이직은 M1 밖.
- `youth-first-job`은 id·선택지 불변, `notFlags`에 `job_picked`만 더함(플래그 없는 기존 판은 동작 동일 — 골든 대상).
- 직업별 직장 사건(PL6)은 `conditions: { job: { id | field } }`. 

---

## 4B. 외모 영향 (PL16 — 교우·연애·취업) — **근거: persona-research.md 4절(조사 중)**

형진 님 취지: 「밀레니얼로 살아 보니 외모가 교우·연애·취업에 영향이 컸다 — 체감되게 하는 것이 수저 게임의 포인트」. 외모 차별을 정당화하지 않고 사회 현실로 담담히 보인다.

- **입력**: `looksTierOf(looks)` 1~5(`faceLayers.ts:57-65`, 출현 9.9/20.3/40.8/18.6/10.3%). 외모 서술(SPEC-015)·얼굴과 같은 단계다.
- **읽어서 확인한 현재**: 기존 사건 일부가 `looks`로 가중(×1.5~2.5 / ×0.4~0.6, 예 `youth.json:81-82·276-277`, `school.json:107-108`)·보너스(`youth.json:642`)를 쓰고, 면접·서류 단계는 없으며 `youth-job-rejections`(`heavy: work`)가 「연락 없는 날들」 한 장이다. **기존 사건은 바꾸지 않는다**(골든).
- **원칙**: ① **길을 막지 않는다** — `looks`는 `modifiers`·`bonuses`·`variants.when`과 지원 확률에만 쓴다(3절 lint) ② **가산·감산**이고 크기는 ▲ ③ **시대별 차이** ④ **만회 경로** ⑤ 담담한 사실 서술 ⑥ 성별은 직업 조건에 쓰지 않는다.
- **채널과 크기(▲, 방향만 확정)** — 새 사건·`tailored` 변주에서만:
  - **교우**(친구 사귐·무리·또래 사이 사건): `modifiers` 가중 `LOOKW.friend` = 단계 1~5 → 0.7 / 0.85 / 1.0 / 1.15 / 1.3, 결과 효과(관계 ±1)는 변주 문장과 함께.
  - **연애**: `LOOKW.romance` = 0.4 / 0.7 / 1.0 / 1.4 / 2.0(기존 ≥70 ×2.5·≤30 ×0.4와 같은 방향, 단계 표로 표준화). 연애가 막히는 단계는 없다 — 소개·취미 모임 경로 사건이 모든 단계에 있다(PL17).
  - **취업 지원**: 합격 확률 `p = clamp(P_BASE[hire] + 0.15×(education−50)/50 + Δapt + LOOKP[단계] × LOOKERA[연도] × lookSens + 0.08×min(tries,3) + (관계 ≥ 60 ? 0.06 : 0) − (stretch ? 0.15 : 0), 0.10, 0.95)`. `P_BASE` open 0.85 · normal 0.60 · selective 0.40, `Δapt` low −0.08 · mid 0 · high +0.10(`fitApt`가 있을 때), `LOOKP` = −0.12 / −0.06 / 0 / +0.05 / +0.10, `lookSens`는 직업 표(개발·생산 0.5 · 사무 1.0 · 접객·판매 1.5 — 외모 감각이 큰 직무일수록 큼). 판정 `u = famHash01(famSeed, 21, 60, 나이×10+tries) < p`. **`tries ≥ 3`이면 `open` 직업은 합격(p = 1)** — 막다른 길 0.
  - **시대 `LOOKERA`(▲, 연도 구간은 조사 4절이 확정)**: 사진 부착 이력서·외모 스펙 시대 ~2012 → 1.0 / 전환 2013~2016 → 0.8 / 블라인드 채용 확산 2017~ → 0.4(면접 단계가 남아 0은 아님). 서류 탈락 vs 면접 탈락 문장은 연도·단계로 갈린다.
  - **만회 경로**: 낮은 단계도 ⓐ 재도전 가산(+0.08/회, 상한 +0.24) ⓑ 관계 가산(소개·추천) ⓒ 적성 가산(`high`일 때 실력으로 가는 길) ⓓ 입문 직업. 외모는 `p`의 한 항일 뿐이다.
- **문장**: 「외모 덕/탓」은 평가가 아니라 **장면(반응·시대의 관행)**으로 드러낸다(예: 면접관의 표정, 사진 칸, 블라인드 이후엔 「얼굴 대신 질문만 남았다」 식). 규칙: 외모 평가 낱말·조롱 금지(SPEC-015 외모 서술 규칙 `looksText.ts` — 평가 낱말은 5단계 한 자리뿐), 점수·단계·퍼센트 숫자 금지, 정당화 낱말(「당연」「마땅」) 금지, `lookSens`·`LOOKP`가 화면에 나오지 않는다. designer·reviewer가 낙인 판독.
- **기준(방향만, 크기는 ▲ — SPEC 완료 기준 12-2)**: 외모 1단계와 5단계 각 N판(▲ 1,000)에서 ⓐ 첫 지원 합격률 5단계 > 1단계이고 차이는 `~2012` 구간에서 ≥ 8%p▲, `2017~`에서 ≥ 2%p▲이고 더 작다 ⓑ 35세까지 직업 확정 도달률 두 단계 모두 ≥ 98%▲ ⓒ 20세 `relationships` 평균은 5단계 > 1단계이고 차이 ≤ 6점▲ ⓓ 35세 `has_partner` 도달률 1단계 ≥ 5단계의 0.6배▲ ⓔ 20세 `happiness` 평균 1단계가 5단계보다 8점▲ 넘게 낮지 않다(체감은 하되 인생이 무너지지 않게) ⓕ 막다른 길 0.
- **손계산**: selective 직업·학력 70·적성 mid·`lookSens` 1.0에서 2010년 5단계 `p = 0.40+0.06+0.10 = 0.56`, 1단계 `0.34`(차 0.22) / 2018년 5단계 0.50, 1단계 0.41(차 0.09).
- **Codex 범위**: `p` 클램프·`tries` 경계·`tries ≥ 3` 보장 · `looks`가 조건(길 막기)으로 쓰인 곳 0(lint 우회) · 시대 구간 경계 연도 · 외모 영향이 기존 사건에 새지 않는지(골든) · 만회 가산의 상한.

---

## 5. 소득 연결 (⑤) — `occupation-wages.md` 기반

- **입력**: `jobs.json`의 `wageRef` → `occupation-wages.md` 2절 행. 세부 직종 월임금총액(세전, 평균, **상용 5인 이상 상용근로자** — 한계 4절) ÷ 같은 표·같은 해 전직종 = **`occMult(직업, 연도)`**(계산 값). 금액은 쓰지 않는다.
- **이중 상승 완화**(`EDU`가 이미 직업 간 차이를 담는다 — wages 3절 1항): ① **대표 학력으로 나눈다(핵심)** `jobMul = occMult ÷ educationMultiplier(eduRef_j)`, `eduRef_j`는 직업 표의 지식 스탯 값. 그러면 `incomeOf`의 `labor = CURVE × EDU(내 학력) × … × jobMul`에서 **대표 학력인 사람은 `occMult` 그대로, 학력이 모자란 사람(`stretch`)은 낮고 넘는 사람은 높다** ② 잔여 이중 상승을 줄이는 지수 `k = 0.8`▲(`jobMul = (occMult ÷ EDU(eduRef))^k`, 사다리 0.6~1.0) ③ 상하한 `jobMul` ∈ [0.5, 2.5]▲.
- **연도**: 같은 해 표 값 — 7차 2022~2025(S1), 6차 2009~2019(중분류 배수, 소분류는 「중분류 안 상대 위치 고정」 `세부(y) = 세부(2022) ÷ 중분류(2022) × 중분류(y)`), 5차 2005~2008(wages 계산 값). 분류 이음은 배수만 잇는다. **2026 이후는 2025 배수를 그대로 이어 쓴다**(carried). 연도 보간은 배수가 크게 움직이는 분야(관리자·운송 서비스)만, 나머지는 해당 기간 평균 배수 하나로 단순화해도 된다.
- **승무원(운송 서비스 431) 급변**: 2022 0.85 → 2025 1.52(표본 18,565명·회복 효과). 단일 해 값을 쓰지 않는다 — **2009~2019는 6차 중분류 43 배수(0.86~0.92)**, **2022~는 `min(S1 값, 1.2)`▲의 3년 이동평균**.
- **규모 보정**(대기업/중소 사무직): 규모 배수는 직종×규모 교차표가 없어 곱한 **추정**이라 과대 가능 → `sizeMul = 1 + 0.5 × (규모 배수 − 1)`▲(300인 이상 ≈ 1.33, 300인 미만 ≈ 0.94).
- **통계 없는 직업 — 「추정」 표시를 표(`wageSrc: 'est'` + 가까운 직종 이름)에 남긴다**: 공무원(행정) = 행정 사무원(311) 값 + 사무 대분류 배수 수준·근속 상승·해고 위험 낮음(▲, 봉급표는 후보·미확인) / 크리에이터 = 영상(283)·공연 예술(284) 0.69~1.06 + **큰 해마다 변동**(해시 `(90, 나이)` ×0.5~×2.0▲) / 배달 라이더 = 배달원(922) ≈ 0.65 + 큰 변동 / 자영업 = 분야 × 자영 + 기존 창업 계수 0.8 유지 + 큰 분산. 변동은 해시로 재계산하고 저장하지 않는다.
- **적용**: `EconomyContext`에 선택 필드 `jobMul`(없으면 1)을 더해 `labor × jobMul`(`economy.ts:103`). `persona`가 없거나 직업 전이면 1 → 구형·직업 전 소득은 변경 전과 같다(골든). 분야 안 가중 평균은 정규화하지 않고 **보고**한다(첫 묶음은 분야의 일부 — 분야 대분류 배수 wages 2-11과의 차이를 `report:persona`에 낸다). 소득 숫자는 화면에 없다(결정 Q6). 이어 `check:economy`·`economyBalance` 가드(비틀지 않고 차이는 보고).
- 한계는 wages 4절을 따른다(비정규·자영·공무원 대부분 빠짐, 평균값, 연령·근속 차이).

---

## 6. 저장·호환·One-way (⑥)

### 6-1. 필드 (`GameState.persona?` — 선택 필드, SPEC-005 SV1 방식)

```
persona?: {
  v: 1,                      // 모양 버전(저장 SCHEMA_VERSION과 별개)
  born: 0..N-1,              // 출생 두드러진 기질 번호
  w: [N개 정수 5..95],       // 기질 세기
  shown: 0..N-1,             // 지금 두드러진 기질(완충 상태를 이어 가려고 저장)
  g: [K개 정수 0..30],       // 적성 키움
  tries?: 0..9,              // 지원 불합격 횟수(합격하면 0으로)
  job?: { field: Occupation, id: string, since: 나이 }
}
```
- **`SCHEMA_VERSION` 9 그대로**. `withValidPersona`(신설, `storage.ts` `withValid…` 한 줄 더)가 모양·길이·정수·범위가 틀리면 **`persona`만 버린다**(→ 중립). `phase === 'title'`이면 버린다. 모르는 직업 id는 `id`만 지우고 `field`는 둔다. 싹은 저장하지 않는다 — **싹 식·태그·키를 바꾸면 기존 적성이 달라진다(One-way)**. 크기 ≈ 90B.
- 본보기 횟수·역경 횟수는 저장하지 않는다(`seen`+사건 표지에서 센다). 시대·규모 분산은 해시.

### 6-2. One-way 이름 목록 — **유형 목록은 조사 뒤 확정** [F2 보류]

`persona`와 하위 `v·born·w·shown·g·tries·job·field·id·since` · **기질 id·번호(N)·적성 id·번호(K) — 조사 뒤 확정** · 활동 `act` 8·본보기 `role` 5 id · 해시 태그 **21**과 키 규칙(1-2) · 싹 식 · `job` id(삭제·재사용 금지) · 플래그 `job_picked` · 사건 id `job-pick-field`·`job-pick-detail` · 데이터 필드 이름 `act`·`role`·`textVariants`·`resultVariants`·`pick`·`Condition` 새 필드 5개. 화면 이름·문장·값 표는 Two-way. **유형 id가 확정되기 전에는 배포하지 않는다**(구현·시험은 임시 id로 진행).

### 6-3. 호환·복구·롤백

- **구형 저장**: `persona` 없음 → **중립**(`tailored`·`temper`·`apt`·`job` 조건 불성립, 자동 모드 보정 1·`jobMul` 1, `youth-first-job` 등 기존 흐름 그대로). `ensureFamily` 같은 채워 넣기 없음(맞춤은 새 판부터, Q4).
- **롤백 스위치 `PERSONA_ENABLED`**(`src/data/personaSwitch.ts`, `ASK_PET_ENABLED` 전례): false면 새 판이 `persona`를 만들지 않고 모든 맞춤 효과(외모 영향 포함)가 꺼진다. 저장된 `persona`는 지우지 않고 통과시킨다. 이때 결과가 변경 전과 같음을 시험으로 잠근다.
- **내려가기**: v0.5.1 앱이 `persona`가 든 저장을 여는지(모르는 최상위 필드를 막는지)는 **읽어서 확인하지 못했다** — Codex 범위([M8]).

---

## 7. 튜닝 사다리와 시험 (⑦)

**사다리**(재승인 없이, 움직이면 dev 로그와 이 절에 기록): ① `ACT_PULL` 2~8 ② 완충 `H` 4~10 ③ `ACT_SHIFT`·`ACT_APT` ±1(행 합 제약 유지) ④ `ENV_DRIFT` 확률 0.3~0.6 ⑤ 싹 계수 0.65~0.75·`GMAX` 25~35 ⑥ `INVEST_Q` ±0.05(수저 단조) ⑦ `TP`·`AFF` ±0.1 ⑧ 후보 상한 5·하한 3 고정 ⑨ **`BORNM`·`BORNN` ±0.05(범위 0.9~1.15 / 0.95~1.1 유지)** ⑩ **`ADV` 확률 ±0.1, 지지 가산 0.2~0.4** ⑪ 본보기 +3(2~4) ⑫ **`LOOKP` ±0.03·`LOOKW` ±0.1·`LOOKERA` ±0.2, 구간 연도는 조사 근거 안** ⑬ `jobMul` 지수 `k` 0.6~1.0·승무원 캡 1.0~1.4. **범위 밖은 승인**: 유형 수·id, 해시 태그·키, 출생 분포 구조, 입력 추가, 외모를 조건(길 막기)으로 쓰는 변경.

**시험 목록**(신설 제안): `personaDoc.test.ts`(9절 블록 ↔ 코드) · `personaBirth.test.ts`(L0 불변·분포 ±▲·수저 간 차이) · `personaShift.test.ts`(활동·감쇠·상하한·완충·역경 경로·지지·본보기 상한·격자) · `personaStereotype.test.ts`(1-3 ⑤ ⓓ 보고) · `personaApt.test.ts` · `personaCondition.test.ts`(자격 불변 골든) · `eventLintPersona.test.ts`(변주·양립·외모 조건 금지 lint·허용 목록) · `jobTable.test.ts`(후보 3~5·`yearRange`·`open`·막다른 길 0·`wageRef` 대응) · `jobWage.test.ts`(5절 식·승무원 캡·`jobMul` 범위·구형 1) · `jobApply.test.ts`(4B 판정·`tries ≥ 3`·경계) · `looksEffect.test.ts`(방향·시대) · `storagePersona.test.ts` · `personaAuto.test.ts`(R-039·중립 불변). 기존 시험은 지우지 않는다.

---

## 8. 측정 `report:persona` (⑧)와 영향 어림

### 8-1. 정의 (신설 `scripts/personaReport.ts`, 승인됨)

인자 `--gen=millennial --n=1000 --wealth=1,5 --temper=0..N-1|all --looks=1,5 --seed --only`. 수저·외모 지정은 해당 값이 나올 때까지 시드를 걸러 뽑고, 기질 지정은 시험 전용 인자(`born`·`w` 덮어쓰기). 보고 표: ① 출생 기질 분포(대 설계 B 분포) ② 갈림길 G1~G5 보이는 선택지 id의 수저 1·5단계 차이(한쪽만 id 수·Jaccard 거리) ③ 같은 수저·시드에서 출생 기질별 자동 첫 선택 총변동거리 ④ 20세 `shown` 분포·`shown ≠ born`·**수저 1·5 간 기질 분포 차(1-3 ⑤ ⓓ)**·요인별(활동·양육·역경·본보기) 갱신 횟수 ⑤ 적성 단계(수저별) ⑥ 직업 후보 수 3~5·`stretch` 비율·`yearRange` 위반 0·**첫묶음 가중 평균 `jobMul` 대 분야 대분류 배수** ⑦ 자동 선택 비율 최대(> 60%▲ 경고) ⑧ **외모 1·5단계별 첫 지원 합격률(시대 구간별)·35세 직업 확정 도달률·`relationships`·`happiness`·`has_partner`(4B 기준)**. 기준은 SPEC 완료 기준이 정한다.

### 8-2. 판 길이·번들 어림 (손계산 — `report:time`·`e2e:prod`가 대체)

새 카드: 직업 고르기 2장 + 지원 재도전(평균 +0.3장▲) + 직업 사건 3~4 + 교우·연애·면접 장면 사건 묶음(PL17) → 조르기 전례의 장당 약 0.23분(`ask-model.md` 5-2)으로 **+1~1.6분**▲(새 사연 10개 안팎 별도). 현재 평균 약 35.9분(상단 36 — 손계산)이라 **상단을 넘을 가능성이 높다**. 내용을 줄이지 않고 실측 뒤 마스터가 형진 님께 보고([M9]). 번들: 코어 +2~5KB(gzip▲), 첫 로딩 여유 약 14KB(385,630 → 400,000B, SPEC-017 로그 기록값) — 직업 표·변주·시대 표는 지연 로딩.

---

## 9. 기계 판독 블록 (`tests/personaDoc.test.ts`가 읽는다 — 이 블록만 고치면 문서와 코드가 어긋난다)

```persona-table
# persona-table v1  (TEMPER·APT 이름과 수는 조사 뒤 확정 — 임시)
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
MODEL | advSupportPW | 0.3
MODEL | advLifeCap | 12
MODEL | roleStep | 3
MODEL | roleLifeCap | 4
MODEL | jobMulExp | 0.8
MODEL | jobMulRange | 0.5 2.5
MODEL | flightAttendantCap | 1.2
MODEL | sizeCoef | 0.5
MODEL | triesFree | 3
MODEL | retryBonus | 0.08
MODEL | retryBonusCap | 0.24
MODEL | relBonus | 0.06
MODEL | stretchPenalty | 0.15
MODEL | pRange | 0.10 0.95
TEMPER | curious | 0
TEMPER | steady | 1
TEMPER | driven | 2
TEMPER | warm | 3
TEMPER | quiet | 4
TEMPER | easy | 5
APT | study | 0
APT | art | 1
APT | sport | 2
APT | craft | 3
APT | people | 4
# BORNM | 양육 방식 | 곱수(6 기질) / BORNN | 수저 | 곱수
BORNM | strict | 0.9 1.15 1.15 0.9 1.0 0.9
BORNM | free | 1.15 0.9 0.9 1.1 1.0 1.15
BORNM | helicopter | 1.0 1.1 1.0 0.95 1.15 0.9
BORNM | neglect | 1.0 1.0 1.15 0.9 1.15 1.0
BORNN | 1 | 1.0 1.05 1.1 1.0 1.0 0.95
BORNN | 2 | 1.0 1.05 1.05 1.0 1.0 1.0
BORNN | 3 | 1.0 1.0 1.0 1.0 1.0 1.0
BORNN | 4 | 1.05 1.0 0.95 1.0 1.0 1.05
BORNN | 5 | 1.1 0.95 0.95 1.0 0.95 1.1
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
# PATH | 경로 | 기질 변화  /  ADV | 무거운 장면 분류 | pW pH pD
PATH | W | 1 2 0 1 0 0
PATH | H | 0 0 0 -1 3 -2
PATH | D | 0 0 3 -2 0 -1
ADV | home | 0.4 0.3 0.3
ADV | school | 0.3 0.5 0.2
ADV | health | 0.5 0.3 0.2
ADV | loss | 0.4 0.4 0.2
ADV | bond | 0.3 0.4 0.3
ADV | work | 0.4 0.2 0.4
ROLE | teacher | 1
ROLE | relative | 2
ROLE | neighbor | 3
ROLE | coach | 4
ROLE | boss | 5
# TP | 기질 | 자동 모드(wealth education health happiness relationships)
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
# INVEST | 수저 | 연 투자 확률 / INVESTMUL | 양육 방식 | 곱수 (study art sport craft people)
INVEST | 1 | 0.20 0.03 0.08 0.05 0.05
INVEST | 2 | 0.25 0.06 0.12 0.06 0.07
INVEST | 3 | 0.33 0.15 0.18 0.08 0.10
INVEST | 4 | 0.40 0.25 0.25 0.09 0.12
INVEST | 5 | 0.45 0.35 0.30 0.10 0.15
INVESTMUL | strict | 1.3 1.0 1.0 1.0 1.0
INVESTMUL | free | 0.9 1.2 1.2 1.0 1.2
INVESTMUL | helicopter | 1.2 1.2 1.2 1.2 1.2
INVESTMUL | neglect | 0.6 0.6 0.6 0.6 0.6
# DRIFT | 양육 방식 | 해마다 +1(해시 <0.5) 받는 기질
DRIFT | strict | steady driven
DRIFT | free | curious easy
DRIFT | helicopter | quiet steady
DRIFT | neglect | quiet driven
# 외모(4B): LOOKP 단계별 지원 가산 · LOOKW 채널별 가중 곱 · LOOKERA 시대 배율 · HIRE 기본 합격률 · SENS 직무 감도
LOOKP | 1 2 3 4 5 | -0.12 -0.06 0 0.05 0.10
LOOKW | friend | 0.7 0.85 1.0 1.15 1.3
LOOKW | romance | 0.4 0.7 1.0 1.4 2.0
LOOKERA | -2012 | 1.0
LOOKERA | 2013-2016 | 0.8
LOOKERA | 2017- | 0.4
HIRE | open | 0.85
HIRE | normal | 0.60
HIRE | selective | 0.40
SENS | 0.5 1.0 1.5
```

(INVEST·INVESTMUL·DRIFT·BORN*·ADV·LOOK* 값은 모두 ▲ 설계값이다. 근거 칸: BORN*·ADV·ROLE·DRIFT = persona-research.md 2절(조사 중), LOOK* = 4절(조사 중), INVEST = private-education-stats.md(진행 중). 방향 중 SPEC 형진 님 예시에서 온 것은 「수저가 낮을수록 예능·체능 투자 확률이 낮다」와 「외모가 교우·연애·취업에 영향」이다.)

---

## 10. 승인 항목

### 10-1. 형진 님 결정·진행 (2026-11-10)

| # | 항목 | 결과 |
|---|---|---|
| **F1** | 출생 기질 배정 분포 | **B 약한 상관**(추천 A와 다름) — 양육·수저와 약한 상관, 수저 곱수는 더 좁게. 근거 persona-research.md 2절(조사 중) |
| **F2** | One-way 이름·**유형 목록** | **보류** — 기질 유형·적성 유형은 근거 연구 조사 뒤 형진 님이 근거 자료와 함께 승인. 나머지 이름(6-2)은 구조 승인, 유형 id 확정 전 배포 금지 |
| F3 | 후보 3개 미만 「무리한 도전」 | **가** 허용 |
| F4 | 기질 변화 연표 한 줄 | **가** 둔다 |
| F5 | 사교육비 통계 수집(`private-education-stats.md`, `INVEST_Q` 근거) | **진행 중** — 도착하면 9절 `INVEST` 교체 |

### 10-2. 마스터 결정 — M1~M11 추천대로(단 M6 개정)

| # | 항목 | 결정 |
|---|---|---|
| M1 | 자격 인터페이스 `Condition` 필드(A) | A |
| M2 | `MAX_DEFINED_CHOICES` 4 → 6 | 올린다 |
| M3 | `pick` 카드·`jobPickWeights` | 둔다(Codex 범위) |
| M4 | 기질 변화 줄의 종류 | 기존 줄 종류 재사용 |
| M5 | 부모가 정한·흘러간 카드 ½ 가중 | ½ |
| **M6(개정)** | ~~직업 조건에서 외모 금지~~ → **외모는 길을 막는 조건으로 쓰지 않고 확률·문장의 가산·감산으로만(3·4B절 lint), 성별은 직업 조건에서 계속 금지**. 낙인 점검(`ENV_DRIFT`·`ADV`·외모 문장)은 reviewer 항목 | 개정대로 |
| M7 | 목록 6·5·8 | **유형(기질·적성)은 F2 보류**, 활동 8·본보기 5는 확정 |
| M8 | CX-002 범위(이전 앱 열기·스위치 끈 동치) | 포함 |
| M9 | 판 길이 | 실측 뒤 보고 |
| M10 | 태그 21을 객체 밖 | 밖 |
| M11 | 자격 골든 먼저 생성 | 만든다 |

### 10-3. 마스터에게 확인 필요 (이번 개정에서 올림)

- **M12**: 기존 `youth-approached`(`youth.json:337`)의 `conditions.looks ≥ 60`은 외모가 길(사건)을 막는 유일한 기존 곳이다. 허용 목록으로 두나(골든 불변, 추천), 모디파이어로 바꾸나(자격이 바뀌어 골든 재생성 = One-way).
- **M13**: 첫 묶음 분야 5개(`professional`·`clerk`·`service`·`sales`·`machine` — 형진 님 예시 16개 중 12개 포함)를 확정할지, `sales`(통계 직종 3개뿐) 대신 `labor`(배달 예시 2개)를 넣을지.
- **M14**: r2가 새로 쓴 1-3(양육 지속·역경·본보기)·4B(외모 영향)·5(소득)의 검토. 4B의 시대 구간(~2012 / 2013~2016 / 2017~)은 조사 4절이 확정하기 전의 ▲다.
- 코드 읽기만으로 확인하지 못한 것: 이전 앱이 `persona` 저장을 여는지, `pending`·UI가 선택지 5개를 그리는지, `stepYear` 해 끝·`resolveChoiceCore`의 정확한 호출 자리, `closenessOf` 호출 형태, 승인 2단계(유형 목록 vs 나머지)의 구현 착수 범위(유형 id는 임시로 진행 가능, 배포만 금지).

---

## 11. 마스터 승인 기록

- 2026-11-10 (형진 님·마스터): F1 B · F3 가 · F4 가 · M1~M11 추천대로(M6 개정) · **F2 보류**(유형 목록은 근거 조사 뒤) · F5 진행 중. 1·2절 유형 목록 외 구조는 승인으로 본다 — 단 r2 신설 부분(10-3 M14)의 확인 기록은 아직 없다.
- (유형 목록 승인·M12·M13·M14 확인 시 `ai-log/<날짜>_SPEC-018_decision.md`에 함께 남긴다. `ask-model.md` 14절 방식.)
