# REV-009-FM7a-1 — 1회차 / 5 (정밀 레인, opus)

판정: CHANGES_REQUESTED

- 높음 0, 중간 1(R-631), 낮음 6(R-632~R-637).
- 다음 지적 ID는 R-638이다.
- 대상: 커밋 0acb22e → b940cfe(6661818 FM7a 구현, e4bf181 문서 정합, b940cfe 후속 199 보완)와 201bfac(시험 도구 browserCss).

**읽은 것**
- 기준: `.coding-rules.md`
- SPEC-009: 「FM7 나눔」 절 전체(361~549행), FC5
- 문서: `fm7a-event-texts.md` 전체, dev 로그 전체(보완 절 포함), `family-remeasure.md` 4·7·8·9절, TODO FM7a 블록(523~533행), REV-009-FM7a-TEXT-2
- 코어
  - `life.ts`의 stepYear·finishYear, `familyTick.ts` 전체, `familyFlags.ts` 전체
  - `familyAdult.ts` 색인부, `familyBirth.ts`(독립 나이·별세·이혼·Q3·출생), `familyModel.ts` 상수, `familyView.ts`(계획·보기)
  - `eventLint.ts`(STATE_WORD_RULES·lintEvents), `noteCards.ts`·`notes.ts`(변형), `familyStorage.ts`(검증)
- 데이터: `familyApproval.ts`, `familyLineText.ts`, `familyTables.ts`의 siblingLoss, `middle.json`(원본·변형 4개), `youth.json`, `senior.json`, `notes.json`
- 스크립트: `validateEvents.ts`, `preFm4bPool.ts`, `familyRulesLib.ts#withSiblingLoss`, `familyRemeasureLib.ts`(V 정의), `familyRemeasure.ts` 7절
- 시험
  - 전체: familyText, familyFm7a, siblingLoss, familyFm7aGentle
  - 해당 부분: familyConsistency(INV), familyHash와 helpers/familyGolden, sceneGolden 머리 주석, citationExposure·citationLink(P5), eventLint의 FM7a 부분, docCssFallback, helpers/browserCss
  - 원본 대조: `tests/fixtures/pre-fm7a-events`의 해당 사건

**못 한 것**
- 시험·빌드·e2e 실행: 읽기 전용이라 못 했다.
- git diff 원본 대조: fixtures와 familyText.test.ts ⑤로 대신했다.
- woff2 바이트 확인: `--check` 결과를 믿었다.
- inherit·noteCards·familyCard 등 나머지 고친 시험의 정독, e2e 두 파일의 전체 읽기(해당 줄만 봤다).
- `family-model.md`는 6-1·10·15절만 봤다.
- `report:citations` 수치 대조.

## 1. 「특히 볼 것」 확인 결과

| # | 결과 | 근거 |
|---|---|---|
| 1 R-561·K18 확장 | 통과 (같은 해 형제 쪽은 R-631) | 아래 표 |
| 2 R-586 | 통과 | 아래 표 |
| 3 R-618 | 통과 (어긋남 두 가지는 R-634) | 아래 표 |
| 4 Q3 안 B | R-631 빼고 통과 | 아래 표 |
| 5 승인 게이트 | 통과 (빈틈 R-637) | 아래 표 |
| 6 문장 전수 | 통과 | 2절 |
| 7 P5 | 통과 | 아래 표 |
| 8 재측정 정직성 | 통과 (하드코딩 R-635) | 아래 표 |
| 9 기타 | 통과 | 아래 표 |
| 201bfac | 통과 | 아래 표 |

**1 R-561·K18 확장**
- 별세 줄이 난 해에 빼는 것은 두 가지다: ① 세터 ② `exclude`일 때 그분의 `_gone`을 notFlags로 읽는 사건(`life.ts:340-348`).
- 후보가 비어도 한 칸을 쓴다(`life.ts:380-386`). 예외는 R-633이다.
- 한 방향이다: `eligibleAll`이 해 시작 플래그로 정해진다(`familyFm7a.test.ts:328-347`).
- 배포 값은 `'exclude'`다(`familyTick.ts:222`).
- legacy를 쓰는 곳은 L1(`familyHash.test.ts:51`), 재측정 V0~V6, 비교 시험뿐이다.
- INV-9는 「<」다(`familyConsistency.test.ts:125`).
- 어린 시절 대상은 3개다(`familyFm7a.test.ts:287-292`).

**2 R-586**
- `apart` 공식: `familyView.ts:214`
- `leaveAge`는 `famHash01(ADULT, 40+j, 1)`로 20~30이다(`familyBirth.ts:216-219`).
- 해 끝 동기화: `life.ts:277,314`, `familyTick.ts:205-211`
- MANAGED에서 빼고 POST_EVENT로 맞춘다(`familyTick.ts:49-59,157`). 해 시작에 꺼졌다 켜지는 일이 없다.
- `senior.json:321`에 들어갔다.
- 「비어 가는 방」 문장이 SPEC 5절 4의 P안 문장과 같다(`familyText.test.ts:389`).
- 저장은 문자열 플래그라 스키마가 그대로다. 구형 저장은 첫 해 끝에 채워진다(`familyFm7a.test.ts:509-534`).

**3 R-618**
- `DIVORCE_AGES`는 `{1,18}`이다(`familyModel.ts:58`).
- `parentGoneAtOf`는 `max(1, …)`이고 d는 그대로다(`familyBirth.ts:291`).
- 줄·카드·동생 구성이 같은 값을 읽는다(`familyBirth.ts:381-383`, `familyTick.ts:142`, `familyView.ts:136`).
- scene-golden 3칸의 갱신 사유(Q3, `boomer/1000041`의 y1이 4살에 떠남 → 7세부터 식구 −1)가 계획 규칙과 맞는다.

**4 Q3 안 B**
- 계획(`familyTables.ts:55`, `familyBirth.ts:328-344`)
  - 1969년 이하 출생 · 형제 1~11세 · 주인공 1~19세 · 판당 최대 1 · 같은 해면 위 형제 먼저
  - 형제마다 해시 한 번(`SIB_LOSS` 19), 진행 RNG를 쓰지 않는다.
- 줄: `familyLineText.ts:65`. 로그 `[3, 나이, 10+i|20+j, a]`: `familyTick.ts:117-125`
- 가림 분류는 `:73`이고 스위치는 한 곳이다.
- 형제 수: K1 형제 수가 하나 줄고 상속액이 는다. SPEC 6절 7항의 의도대로다.
- 출생신고 「N째」는 그대로다(`siblingLoss.test.ts:151-163`).
- 저장
  - 로그 종류 3은 원래 허용돼 있다(`familyStorage.ts:88`).
  - `lg` 저장에는 계획이 없다(`familyView.ts:73`).

**5 승인 게이트**
- `validateEvents.ts:20,32`, `familyApproval.ts:49-64`
- T06만 optional이다.
- `src/`에서 `familyApproval.ts`를 import하는 곳이 없다(주석 2곳뿐).

**7 P5**
- c-081을 쓰는 사건은 원본과 변형 둘뿐이다(`citationLink.test.ts:188-190`).
- 허용 집합은 {c-011, c-081}이고, c-081은 세대마다 6% 이하다(`citationExposure.test.ts:43,46`).
- 다른 인용이 들어올 구멍은 없다.

**8 재측정 정직성**
- V 정의(`familyRemeasureLib.ts:65-75`)가 코드와 맞는다. V7=setters, V8=exclude, V9=노년 풀, V10=지금 풀 + Q3다.
- 7절 「같은 해 포함」 정의: `familyRemeasure.ts:368,380`
- 수치가 dev 로그 보완 절과 같다.

| 항목 | `family-remeasure.md` 행 | 값 |
|---|---|---|
| 같은 해 포함 원본 | 259 | 0/6514 |
| 별세 해 notFlags 규칙 V7→V8 | 306 | 0.36% · 0.23%p |
| 합계 V5→V10 | 350 | 0.46% · 0.68%p |
| 마지막 인사를 놓친 판 | 361 | 0.30% → 0.27% |
| 규칙으로 바뀐 판 | 384 | 325판 |

**9 기타**
- 초기 로드: 379,855 B · 383,633 B다. FM6 대비 약 +2.8 KB인데, 이벤트는 지연 덩어리이고 늘어난 것은 코드라 타당하다.
- `src/`에 외부 URL·사용자 경로가 없다(grep 0건).
- CR 규칙
  - CR-RNG·CORE·TIME·UI 위반이 없다.
  - 규칙 스위치는 `inherit.ts#withParentsGoneRule`과 같은 기존 꼴이다.
  - CR-TEST: L1·scene golden·고정 시드 시험이 있다.

**201bfac (시험 도구)**
- `browserCss.ts:69-94`는 `selector()` 안을 `:has(…)` 한 꼴만 푼다.
- 조합, 다른 선택자, 빈 `:has()`, 닫는 괄호 없음은 던진다(`docCssFallback.test.ts:53-70`).

**TODO 근거 대조**
- 523~533행의 파일·함수·시험 제목은 모두 실재한다.
  - `flagSettersOf`·`flagBlockersOf`·`GoneYearRule`·`childLeaveAgeOf`·`siblingLossPlan`·`SiblingLossRule`
  - 시험 제목 「승인 게이트 (완료 기준 1, RG11 방식)」(6개)·「R-561: …」·「별세 해 후보 정리 ②: …」·「R-586: …」·「R-618: …」
  - `eventLint.test.ts:872`, `noteCards.test.ts:240`, `familyHash.test.ts`(23개)
- 531행의 수치만 낡았다(R-636). `[x]`는 아직 없다.

## 2. 문장 전수 판독

| T | 위치 | 승인 문장과 |
|---|---|---|
| T01·T02 | `familyLineText.ts:55` (early 참·거짓) | 같음 |
| T03·T04 | `familyLineText.ts:50` | 같음 |
| T05 | `familyLineText.ts:60` | 같음 |
| T06 | `familyLineText.ts:65` (다)) | 같음 |
| T07 | `middle.json:88-89,102`·`:126-127,140` | 같음 |
| T08 | `middle.json:651,686` | 같음 |
| T09 | `youth.json:456,463,464` | 같음. 원본과는 「부모님 집(으로)」→「본가(로)」만 다르다 |
| T10 | `notes.json:79-80` | 같음 |

- **고르지 않은 꼴(R-627)**: 0건이다. `src`에서 「떠났습니다」는 형제 줄·주인공 사망·시대의 창·인용에만 나온다.
- **존대 범위**: 부모·조부모만 「떠나셨습니다」이고 형제와 이혼 줄은 지금 꼴이다.
- **변형 사건의 문장 외 필드**: 원본과 같다(`familyText.test.ts:245-271`). 원본은 FM7a 전 원문과 비교해 `conditions`만 바뀌었다(`:363-373`).
- **「병환」**: 허용 낱말 자리를 먼저 빼고 글자 포함으로 검사한다. R-630대로다(`familyText.test.ts:207`).
- **임종 예외 삭제**: 빈틈이 없다. 어른 시점에 「부모님」이 든 사건은 원본 둘뿐이고, 둘 다 notFlags에 세 플래그가 있다(`eventLint.ts:178-183`, `eventLint.test.ts:891-896`).
- **금지 표현**: 사인·병명·책임·속마음·출생 설정·자해·수저 등급명·금액이 0건이다.
- **`{이름}`**: T10에만 있고 「에게」다.

## 3. 지적

### R-631 [NEW] [중간] `src/core/life.ts:340-350` · `src/core/familyAdult.ts:86-88` — 어린 형제가 떠난 해에 그 형제를 산 사람으로 말하는 사건이 별세 줄 뒤에 같은 해 나온다

**문제**
- Q3 줄이 난 해의 사건 후보는 해 시작 플래그로 가려진다. 그런데 `has_younger_sibling`·`has_older_sibling`·`has_sibling`은 해 끝(`fam.clearFlags`)에야 꺼진다.
- 가족 줄은 일반 사건 앞에 적힌다(`life.ts:403`). 그래서 하나뿐인 동생이 떠난 해(주인공 3~6세)에 `infant-sibling-toy`가 뽑히면 기록이 이렇게 된다.
  - 「4살이던 남동생이 세상을 떠났습니다. 어른들은 한동안 말을 아꼈습니다.」
  - 그다음 「동생이 아이의 장난감을 만지기 시작했습니다.」와 선택 「장난감을 동생에게 건넨다」
- 같은 일이 생기는 사건이 둘 더 있다.
  - 손위 형제: `infant-follow-sibling`
  - 형제가 하나뿐이던 판: `school-family-priority`(「형제가 많은 집이라」)
- 부모 한 분 별세의 같은 꼴은 후속 199(K18 확장)가 막았다. Q3에는 이 규칙이 없다. 이번 회차에 새로 생긴 모순이다.
- INV-4 동적 점검(`familyConsistency.test.ts:279`)은 해 시작 보기로 봐서 이 경우를 못 잡는다.
- 빈도는 재지 않았다. 어림으로 7000판 중 몇 판이다.

```diff
--- a/src/core/familyAdult.ts
+++ b/src/core/familyAdult.ts
@@ -86,3 +86,11 @@
 export function flagBlockersOf(pool: EventPool, flag: string): readonly string[] {
   return flagIndexOf(pool).blockers.get(flag) ?? [];
 }
+
+/**
+ * 이 플래그를 **요구하는** 사건의 id들 — 사건 수준 `conditions.flags`(선택지 `requires`는 보지 않는다). 사건 id를 코드에 박지 않고 풀에서 찾는다.
+ * 어린 형제가 떠난 해에 그 해 끝에 꺼지는 형제 플래그를 읽는 사건을 그 해 후보에서 빼는 데 쓴다(FM7a Q3, R-631).
+ */
+export function flagRequirersOf(pool: EventPool, flag: string): readonly string[] {
+  return flagIndexOf(pool).requirers.get(flag) ?? [];
+}
```
```diff
--- a/src/core/life.ts
+++ b/src/core/life.ts
@@ -37 +37 @@
-import { flagBlockersOf, flagSettersOf } from './familyAdult';
+import { flagBlockersOf, flagRequirersOf, flagSettersOf } from './familyAdult';
@@ -344,6 +344,12 @@
     if (rule === 'exclude') {
       const who = fam.log.find((e) => e[0] === LOG_PARENT_GONE);
       for (const id of flagBlockersOf(pool, who?.[2] === 1 ? 'mother_gone' : 'father_gone')) blocked.add(id);
     }
   }
+  // R-631 (Q3): 어린 형제의 별세 줄이 난 해에는 그 해 끝에 꺼지는 형제 플래그를 요구하는 사건을 그 해 후보에서 뺀다 —
+  // 별세 줄 뒤에 같은 해 안에서 떠난 형제를 산 사람으로 말하지 않게 한다. 별세 해 notFlags 규칙과 같은 방식(한 방향, 후보 목록만 줄고 칸 수 그대로, 'exclude'에서만)
+  if (rule === 'exclude' && fam.lines.some((l) => l.eventId === FAMILY_LINE_ID.sibLost)) {
+    blocked ??= new Set<string>();
+    for (const flag of ['has_older_sibling', 'has_younger_sibling', 'has_sibling']) if (fam.clearFlags.includes(flag)) for (const id of flagRequirersOf(pool, flag)) blocked.add(id);
+  }
   const eligibleAll = eventsForStage(pool, stageOfAge(age)).filter((ev) => isEventEligible(ev, view));
```
```diff
--- a/tests/familyConsistency.test.ts
+++ b/tests/familyConsistency.test.ts
@@ -230,2 +230,6 @@
                 if (!dead && (scene.members.some((m) => m.id === id) || !scene.changed.includes('sib-gone'))) bad(where, `${h.age + 1}세 그림에서 형제 ${id}가 안 빠졌거나 바뀐 때(sib-gone)가 없다`);
+                // R-631: 같은 해 안에서 떠난 형제를 산 사람으로 말하는 사건이 없다 — 해 끝에 꺼진 형제 플래그를 요구하는 사건이 같은 해에 일어나지 않았다
+                const cleared = ['has_older_sibling', 'has_younger_sibling', 'has_sibling'].filter((x) => before.flags.includes(x) && !state.flags.includes(x));
+                const reader = added.find((x) => x.age === h.age && (EVENT_POOL.byId.get(x.eventId ?? '')?.conditions?.flags ?? []).some((fl) => cleared.includes(fl)));
+                if (reader !== undefined) bad(where, `${h.age}세 형제 별세 줄과 같은 해에 떠난 형제의 플래그를 요구하는 사건 ${reader.eventId}가 일어났다 (R-631)`);
               }
```

지시 — diff를 적용한 뒤 작업자가 할 일:
- `tests/familyFm7a.test.ts`에 K18 시험(297~326행)과 같은 꼴의 합성 시험을 더한다.
  - 풀: `conditions.flags: ['has_younger_sibling']` 사건과 보통 사건.
  - 걸음: 하나뿐인 동생이 떠나는 Q3 해.
  - 단언: exclude는 그 사건을 뽑지 않고, legacy는 뽑으며, `rngState`가 같다.
- `npm run report:family -- 1000 --write`로 다시 재고, TODO 근거 줄을 갱신한다. V10만 움직인다.
- 조부모 쪽(마지막 한 분이 떠난 해의 `has_grandparent` 사건)은 FM4b부터 있던 같은 꼴이라 이번 지적 대상이 아니다. 마스터가 일반화를 원하면 위 배열 거르기를 빼고 `fam.clearFlags` 전체를 쓴다.

### R-632 [NEW] [낮음] `src/core/life.ts:406` · `src/data/events/school.json:283-288` — 별세 해 정리가 선택지 수준 `requires`를 보지 않는다

**문제**
- `school-teacher-notice`(12~18세, 흘러감 카드)의 선택지 「집에 가서 부모님과 의논한다」는 `requires.notFlags`로 세 플래그를 둔다.
- 그런데 `visibleChoices`가 해 시작 ctx로 보인다. 그래서 별세 줄이 난 해에 그 줄 뒤에 「부모님과 늦도록 이야기를 나눴습니다」가 나올 수 있다.
- 시험(`familyFm7a.test.ts:293`)이 이 경우를 일부러 대상에서 뺐다. 마스터 지시가 「사건」 범위였기 때문이다.

지시 (범위는 마스터가 정한다)
- 넣는다면 `'exclude'`에서 별세 줄이 난 해에 `visibleChoices(picked, …)`를 그 한 분의 `_gone`을 더한 ctx로 부른다.
- 그 ctx로 보이는 선택지가 2개 미만이 되는 사건은 `blocked`에 더한다.
- 시험은 K18 꼴의 합성 시험과, 실제 판에서 같은 해 0건을 단언하는 시험이다.

### R-633 [NEW] [낮음] `src/core/life.ts:379-389` — 선택지 후보가 비면 서술로 넘어가 「칸 수 그대로」가 깨진다

**문제**
- 선택지 후보가 별세 해 정리로 비면 `draw`가 한 칸을 쓰고 null을 돌려준다. 그 뒤 서술 추첨이 한 칸을 더 쓴다.
- 원래 세계는 선택지를 뽑고 서술 추첨을 하지 않았다. 그래서 칸 수가 하나 늘고, SPEC 4절·R-560 「한 칸 규칙」의 문장과 어긋난다.
- 시험(`familyFm7a.test.ts:215,349`)은 서술 사건이 없는 풀이라 이 경우를 못 본다.
- 실제로는 1~5세에 선택지 후보가 `infant-care` 하나뿐인 해에만 드물게 생긴다. 결정성은 그대로다.

```diff
--- a/src/core/life.ts
+++ b/src/core/life.ts
@@ -378,12 +378,15 @@
   } else {
     // 후보가 R-561로 줄어 비게 됐다면 원래 후보가 있던 만큼 난수를 한 칸 쓴다(칸 수 불변)
+    // 선택지 칸이 그렇게 비면 그 해의 추첨 칸은 쓴 것으로 본다 — 원래 세계는 선택지를 뽑아 서술 추첨을 하지 않았으므로 서술로 넘어가지 않는다(R-560 「한 칸 규칙」, 강제 사건 칸과 같다)
+    const slot = { spent: false };
     const draw = (list: EventDef[], full: EventDef[], a?: number, choices?: boolean): EventDef | null => {
       if (list.length === 0 && full.length > 0) {
         rng.next();
+        slot.spent = true;
         return null;
       }
       return pickWeighted(rng, list, ctx, a, choices);
     };
     const isNarrative = (ev: EventDef): boolean => !isChoiceEvent(ev) && !isMilestoneEvent(ev);
     if (rollChoice < choiceChance && canChoice) picked = draw(eligible.filter(isChoiceEvent), eligibleAll.filter(isChoiceEvent), age, true);
-    if (picked === null && rollNarrative < freq.narrative) picked = draw(eligible.filter(isNarrative), eligibleAll.filter(isNarrative));
+    if (picked === null && !slot.spent && rollNarrative < freq.narrative) picked = draw(eligible.filter(isNarrative), eligibleAll.filter(isNarrative));
   }
```
- 시험: 「빼는 선택지 사건 하나 + 서술 사건 하나」 풀에서 4칸을 단언한다.
- 마스터가 지금 동작(서술로 넘어감)을 원하면 코드는 두고, `life.ts:379`의 주석과 SPEC 4절 문장을 「선택지 칸이 비면 서술 추첨으로 넘어간다」로 고친다.

### R-634 [NEW] [낮음] `src/core/familyBirth.ts:289-292,307` · `docs/design/fm7a-event-texts.md:50,67,94` — R-618 구현의 어긋남 두 가지 (마스터·planner 결정)

**(a) 옮겨진 부모의 나이가 한 살 줄어든다**
- 0세 해 별세를 1세 해로 옮긴 부모는 주인공 1세 해 카드에 d+1세로 살아 있다. 이듬해에는 「d세에 세상을 떠남」이 된다.
- 그 해 줄(「d세에 세상을 떠나셨습니다」)도 같은 해 카드 나이(d+1)와 다르다.
- 원인은 SPEC 2절 ②의 「N은 d 그대로」다. 대상은 7000판 중 10명을 넘는다(`familyFm7a.test.ts:90`).
- 선택지: 수용하거나, 옮겨진 경우만 `markGone`의 own을 `d + (at − raw)`로 바꾼다. 줄은 보기 값을 읽으므로 함께 맞는다.

**(b) 이혼은 옮겨지지 않고 0세 판정이 없어진다**
- `divorcePlan`은 a=1부터 돈다. 미성년 이혼 노출이 한 해 몫(약 1/19) 준다.
- 문장 문서의 T05 메모와 T01 점검은 「1세 해로 옮긴다」라고 쓴다.
- SPEC 2절 ①과 완료 기준 15가 정본이라 코드는 맞다.
- 선택지: 문서를 「0세 해에는 이혼이 일어나지 않는다(판정 하한 1세)」로 고치거나, 옮기기를 원하면 마스터가 SPEC을 고친다.

### R-635 [NEW] [낮음] `scripts/familyRemeasure.ts:405-409` · `scripts/familyRemeasureLib.ts:345` — 보고서가 FM7a 전 비율을 측정값 대신 하드코딩한다

**문제**
- 생성기가 「46.3%」를 문자로 박아 둔다. 그래서 `family-remeasure.md:261`의 판정 줄이 「46.3%」인데, 같은 문서 7절 V5 표의 측정값은 46.4%다(246행).
- `:425`도 같은 숫자를 쓴다.

```diff
--- a/scripts/familyRemeasure.ts
+++ b/scripts/familyRemeasure.ts
@@ -406,5 +406,7 @@
   const origSame7 = origAt(R('V7'), true);
   const lost7 = lostCount(R('V7'));
+  const v5Lost = R('V5').filter((r) => r.lossAge !== null);
+  const v5Pct = (i: 0 | 1): string => pct((100 * v5Lost.filter((r) => after(r, i)).length) / Math.max(1, v5Lost.length));
   say(
-    `- **판정(완료 기준 3, 마스터 결정 후속 199 — 「켜진 해부터」는 별세 줄이 난 그 해를 포함): 별세 줄이 난 해를 포함해 원본 사건이 나온 판 ${origAll}건 ${origAll === 0 ? '— 합격(46.3%·70.6% → 0%)' : '— **불합격**'}** (그중 별세 줄과 같은 해에 겹친 원본 ${origSame}건, 한 분 별세 판 ${lostCount(v10)}판 중). 변형은 한 분이 떠난 판에서만 일어난다(tests/familyText.test.ts).`,
+    `- **판정(완료 기준 3, 마스터 결정 후속 199 — 「켜진 해부터」는 별세 줄이 난 그 해를 포함): 별세 줄이 난 해를 포함해 원본 사건이 나온 판 ${origAll}건 ${origAll === 0 ? `— 합격(${v5Pct(0)}·${v5Pct(1)} → 0%)` : '— **불합격**'}** (그중 별세 줄과 같은 해에 겹친 원본 ${origSame}건, 한 분 별세 판 ${lostCount(v10)}판 중). 변형은 한 분이 떠난 판에서만 일어난다(tests/familyText.test.ts).`,
   );
```
```diff
--- a/scripts/familyRemeasureLib.ts
+++ b/scripts/familyRemeasureLib.ts
@@ -345 +345 @@
-- **성인기 「부모님」 사건(7절)** 은 모형이 부모 한 분 별세를 알린 판만 센다. FM6까지(V5, FM7a 전)는 사건 문장이 두 분을 말해 46.3%·70.6%였고, FM7a의 「남은 한 분」 변형·원본의 제외 조건·별세 해 notFlags 규칙(V10, 별세 줄이 난 해 포함)으로 원본 두 사건은 0%가 되었다.
+- **성인기 「부모님」 사건(7절)** 은 모형이 부모 한 분 별세를 알린 판만 센다. FM6까지(V5, FM7a 전)는 사건 문장이 두 분을 말해 7절 앞 표의 비율(같은 해 포함)로 나왔고, FM7a의 「남은 한 분」 변형·원본의 제외 조건·별세 해 notFlags 규칙(V10, 별세 줄이 난 해 포함)으로 원본 두 사건은 0%가 되었다.
```
적용한 뒤 `npm run report:family -- 1000 --write`로 문서를 다시 만든다.

### R-636 [NEW] [낮음] `docs/TODO.md:531` · `scripts/preFm4bPool.ts:37,40` · `docs/data/family-model.md:506` — 문서와 주석이 낡았다

```diff
--- a/docs/TODO.md
+++ b/docs/TODO.md
@@ -531 +531 @@
-    - 초기 로드(할 것 9): e2e-prod/initial-load.spec.ts — Chromium 379,713 B · WebKit 383,502 B(한도 400,000, 카드 모델 지연 분리 기준 390,000 아래라 분리하지 않았다)
+    - 초기 로드(할 것 9): e2e-prod/initial-load.spec.ts — Chromium 379,855 B · WebKit 383,633 B(후속 199 보완 뒤, 이전 379,713 · 383,502 — 한도 400,000, 카드 모델 지연 분리 기준 390,000 아래라 분리하지 않았다)
```
```diff
--- a/scripts/preFm4bPool.ts
+++ b/scripts/preFm4bPool.ts
@@ -37 +37 @@
- * FM7a의 원인을 하나씩 켠 풀 (재측정 V6~V8, SPEC-009 완료 기준 11): 영유아·학창은 지금(K2·K4가 켜진) 것이고 청년·중년·노년은 FM7a 전 원문에서 시작해
+ * FM7a의 원인을 하나씩 켠 풀 (재측정 V6~V9, SPEC-009 완료 기준 11): 영유아·학창은 지금(K2·K4가 켜진) 것이고 청년·중년·노년은 FM7a 전 원문에서 시작해
@@ -40 +40 @@
- * 마지막(V9)은 지금 풀(`eventPool`)이다.
+ * 마지막(V10)은 지금 풀(`eventPool`)이다.
```
- `family-model.md:506`(planner 몫): 코드는 `lives_with_child`를 `familyTick.ts#MANAGED_FLAGS`에 넣지 않고 `POST_EVENT_FLAGS`로 맞춘다. 넣으면 해 시작의 `familyChangesFor`가 끄기 때문이다. 문서의 「`deriveFamilyFlags`·`FAMILY_SYSTEM_FLAGS`·`MANAGED_FLAGS`」를 이렇게 고친다: 「`deriveFamilyFlags`·`FAMILY_SYSTEM_FLAGS`·`POST_EVENT_FLAGS` — `MANAGED_FLAGS`에는 넣지 않는다」.
- SPEC 5절 2항의 같은 낱말도 함께 고친다.

### R-637 [NEW] [낮음] `src/data/familyApproval.ts:43-64` — 승인 표에서 번호를 지우면 배포 빌드가 통과한다

**문제**
- 게이트는 `approved !== true`·번호 겹침·빈 `covers`만 본다. 그래서 T03 줄을 표에서 지우면 `check:events`가 통과한다.
- 지금은 `familyText.test.ts:29`만 이 경우를 잡는다.

```diff
--- a/src/data/familyApproval.ts
+++ b/src/data/familyApproval.ts
@@ -43,2 +43,5 @@
+/** 문장 문서 4절의 번호 — 표에서 하나라도 빠지면 배포 빌드가 막힌다 */
+const REQUIRED_IDS: readonly string[] = ['T01', 'T02', 'T03', 'T04', 'T05', 'T06', 'T07', 'T08', 'T09', 'T10'];
+
 /**
  * 승인 게이트의 문제 목록 (빈 배열이면 통과). `siblingLossEnabled`는 어린 형제의 이른 별세 계획의 스위치(`design.siblingLoss.enabled`)다.
@@ -61,4 +64,5 @@
     problems.push(`${a.id}(${a.what}): 형진 님 승인 전이다 — approved: true가 아니면 배포 빌드가 막힌다 (docs/design/fm7a-event-texts.md 4절)`);
   }
+  for (const id of REQUIRED_IDS) if (!ids.has(id)) problems.push(`${id}: 승인 표에 없다 — 문장 문서(docs/design/fm7a-event-texts.md 4절)의 번호가 표에서 빠지면 배포 빌드가 막힌다`);
   return problems;
 }
```
- 시험: `familyText.test.ts` 「승인 표가 깨진 것도 잡는다」에 「T03을 뺀 표 → T03을 대며 실패」를 더한다.
- 기존 단언(`:40` toHaveLength(1), `:48`, `:59`)은 그대로 통과한다.

## 4. 후속 (낮음)

- R-632~R-637은 다음 회차에 diff를 함께 적용해도 되고, 마스터 판단으로 `docs/TODO.md`에 `[ ]`로 넘겨도 된다.
- R-632(범위)와 R-634(a·b)는 마스터·planner의 결정 사항이다.
- 2회차는 변경분만 본다. 볼 범위는 R-631 diff, 새 시험, `report:family` 재생성이다.

## 5. 관찰 (지적 아님, QA 참고)

- **1세 해의 겹침**: R-618로 옮겨진 별세는 마일스톤(첫 말·첫 걸음마, 1세 100%)과 같은 해다. 「어른들이 한참을 웃었습니다」 다음에 「…세상을 떠나셨습니다. 집 안이 한동안 조용했습니다.」가 온다. 시간 순서라 지적하지 않는다.
- **FM4~FM6 개발·QA 저장**: `family`가 있고 `lg`가 없는 저장은 Q3 계획이 소급된다. 그래서 줄 없이 형제가 떠난 사람으로 보인다. 공개 v0.3 저장은 `lg: 1`이라 해당 없다. QA ③은 새 판이나 `lg` 저장으로 한다.

위험도: Two-way / 파급 낮음 — 지적 반영은 Q3가 난 해의 후보 목록(전체 판의 약 4%에서 한 해), 보고서, 문서뿐이고 저장 버전은 그대로다. 다만 FM7a를 배포하면 사용자 저장에 `lives_with_child`·가족 로그 종류 3·`fam-sib-lost` 줄이 남는다. 그 뒤 T06 스위치를 끄면 기록과 보기가 어긋난다. 이 점은 배포 결정 때 형진 님께 알린다.

## 마스터 처리 (2026-11-06)

모두 2회차에 반영한다. 낮음도 TODO로 넘기지 않는다. 다음 지적 ID는 R-638이다.

- **R-631 (중간)**: diff를 적용하고, 범위를 넓힌다.
  - 형제 플래그 셋에 더해, 가족 줄이 난 해 끝에 꺼지는 조부모 플래그(마지막 한 분이 떠난 해)도 넣는다.
  - 이유: T03·T04 조부모 별세 줄이 FM7a 승인 문장이라, 같은 해에 할머니를 산 사람으로 말하면 같은 모순이 된다.
  - `fam.clearFlags` 전체를 쓰지 않고 이름을 적은 배열로 둔다. 작업자는 실제로 꺼지는 플래그 목록을 확인해 보고한다.
  - INV 점검도 같은 범위로 넓힌다.
- **R-632**: 넣는다. 정의는 다음과 같다.
  - 가족 줄이 난 해(`exclude`)에 보이는 선택지 = 해 시작 ctx로 보이는 것 ∩ 그해 줄 뒤 ctx로 보이는 것.
  - 그해 줄 뒤 ctx는 떠난 분의 `_gone`을 더하고, 꺼지는 형제·조부모 플래그를 뺀 것이다.
  - 교집합으로 해야 한 방향이 지켜진다. 새로 열리는 선택지가 없다.
  - 보이는 선택지가 2개 미만이 되는 사건은 그해 후보에서 뺀다.
- **R-633**: diff를 적용한다(한 칸 규칙 유지).
- **R-634 (a)**: 옮긴다. 옮겨진 경우만 별세 나이를 `d + (at − raw)`로 해서 카드와 줄의 나이를 맞춘다. SPEC 2절 ②는 planner가 고친다.
- **R-634 (b)**: 문서를 고친다(planner). 「0세 해에는 이혼이 일어나지 않는다(판정 하한 1세)」. 코드는 그대로다.
- **R-635·R-636·R-637**: diff를 적용한다. `family-model.md:506`과 SPEC 5절 2항은 planner가 고친다.
- **위험도 메모**(배포 뒤 T06 스위치를 끄면 기록과 보기가 어긋남): K6 배포 요청 때 형진 님께 함께 알린다.
