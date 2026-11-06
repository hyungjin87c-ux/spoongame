# REV-009-FM7a-2: 2회차 / 5 (정밀 레인, opus, 변경분만)

판정: **APPROVED**

- 높음 0, 중간 0, 낮음 5건이다.
  - R-636(재지적)
  - R-638~R-641(새 지적)
- 낮음 5건은 모두 아래 「후속」 절에 있다.
- 다음 지적 ID는 R-642다.
- 대상: 커밋 5781e02 → 8cb3cb1(1회차 지적 반영분)

## 1회차 지적 닫힘 여부

| ID | 결과 | 근거 |
|---|---|---|
| R-631 (중간) | **닫힘** | 아래 「특히 볼 것」 1 |
| R-632 | **닫힘** | 아래 2 |
| R-633 | **닫힘** | `life.ts:396-407`이 검수자 diff와 글자까지 같다. 4칸 시험(`familyFm7a.test.ts:779`)의 풀은 `x-reader`(선택지 사건, 별세 플래그를 notFlags로 읽음) 하나와 `x-narr`(서술 사건) 하나다 |
| R-634 (a) | **닫힘** | 아래 4 |
| R-634 (b) | **닫힘** | `fm7a-event-texts.md` 50·67·94행: 메모·점검 문장만 고쳤다. T05 승인 문장 「부모님이 따로 살게 되었습니다. 이후 …와 함께 지냈습니다.」는 그대로다 |
| R-635 | **닫힘** | `familyRemeasure.ts:409-412`, `familyRemeasureLib.ts:405`가 diff대로다. 문서 261행 「46.4%·70.6%」가 7절 V5 표(246행)와 같다 |
| R-636 | **일부 닫힘** | TODO 초기 로드 줄, `family-model.md:506`, SPEC 5절 2항은 닫혔다. `preFm4bPool.ts:37,40` 주석은 이번 회차에 세계 번호가 V11까지 밀려 다시 틀렸다 → **R-636(재지적)** |
| R-637 | **닫힘** | `familyApproval.ts:43-44,66`이 diff대로다. 시험(`familyText.test.ts:60-69`)은 어느 번호를 빼도 그 번호 하나만 대며 실패하는지 표 전체를 돈다. 기존 단언(`:40`, `:48-54`)은 그대로 통과하는 꼴이다 |

**읽은 것**
- 문서
  - REV-009-FM7a-1 전체
  - SPEC-009 361~552행(2절 ②, 완료 기준 9(g)·15, 5절 2항, 8절 마스터 처리 블록)
  - decision 로그 후속 200
  - dev 로그 80~108행
- 코어
  - `familyTick.ts` 전체
  - `life.ts`: 1~60행, `finishYear`·`stepYear`(250~468행), 해결 경로(488~647행)
  - `familyAdult.ts` 40~110행, `familyBirth.ts` 270~404행, `familyView.ts` 35~164행, `familyModel.ts` 48~61행
  - `events.ts`의 `meetsCondition`·`visibleChoices`·`isEventEligible`, `apply.ts#condContextOf`, `storage.ts`의 pending 검증
- 데이터·스크립트
  - `familyApproval.ts` 전체
  - `familyRemeasureLib.ts` 40~83·120~283행, `familyRemeasure.ts` 395~594행, `preFm4bPool.ts`
- 시험
  - `familyFm7a.test.ts`: 1~220행, 440~812행
  - `familyConsistency.test.ts`: 180~304행, 380~399행
  - `familyText.test.ts` 20~90행, `siblingLoss.test.ts` 255~298행, `infantContent.test.ts` 476~531행, `helpers/familyLife.ts#lifeSteps`
- 문서·데이터 파일
  - `family-remeasure.md` 228~479행, TODO 523~534행, `family-model.md` 500~511행, `fm7a-event-texts.md` 40~99행
  - 풀에서 형제·조부모·이혼 플래그를 읽는 곳(grep): `infant.json`·`school.json` 7곳, `notes.json`에는 없음

**못 한 것**
- 시험·`report:family`·빌드 실행: 읽기 전용이다.
- `src/data/finalDistribution.ts` 생성물 대조, git diff: 변경 파일을 직접 읽는 것으로 대신했다.
- L1·scene golden 재확인: 작업자 보고(23개 통과)를 믿었다.
- `familyFm7a.test.ts` 220~440행: 1회차에 본 범위다.

## 2. 「특히 볼 것」 결과

1. **R-631**
   - 조건: 줄 id가 있고, 이름 배열 안의 플래그가 실제로 `c.clearFlags`에 있을 때만 막는다(`familyTick.ts:223-229`).
   - 배열: `SIBLING_LINE_FLAGS` 셋과 `GRANDPARENT_LINE_FLAGS`(`has_grandparent`·`lives_with_grandparent`) 둘이다(`:219-220`).
   - `exclude`일 때만 `flagRequirersOf`로 막는다(`life.ts:355-359`).
   - 줄 없이 꺼지는 경우(20세가 되는 해, 이혼한 해)는 줄이 없으니 막지 않는다.
   - INV `CLEARS`가 조부모까지 넓혀졌다(`familyConsistency.test.ts:254-263`).
   - 관찰: 조부모 한 분의 줄과 20세 독립이 같은 해에 겹치면 `lives_with_grandparent`도 막힌다. 다만 지금 풀에는 이 플래그를 읽는 사건이 0개라 영향이 없다.
2. **R-632**
   - 줄 뒤 ctx = 해 시작 플래그 − 꺼지는 형제·조부모 플래그 + 떠난 부모의 `_gone`이다(`familyTick.ts:235-243`).
   - 교집합은 `life.ts:361`에서 만들고, 교집합이 2개 미만인 사건은 `:363`에서 `blocked`에 들어간다.
   - `pending.choiceIds`(`:426,432`)를 다음이 모두 그대로 읽는다.
     - `DecisionCard.tsx:64`, `impact.ts:116`
     - `autoChoiceWeights`·`childFlowWeights`(`life.ts:612,647`), `parentChoiceWeights`(`parentDecision.ts:121`)
     - `resolveChoiceCore`의 검사(`life.ts:490`)
   - 저장 검증(2~3개, `storage.ts:302`)과도 맞는다.
   - 안전망: 강제 사건은 `infant-new-sibling` 하나뿐이고, `help`·`sulk`에 requires가 없어 교집합이 늘 2개 이상이다. 그래서 지금 풀에서는 닿지 않는다. 이를 잠그는 시험은 없다(R-641).
   - 난수: `visibleChoices`·`meetsCondition`은 순수 계산이라 칸 수가 그대로다.
   - 가드 시험(`familyFm7a.test.ts:742-775`)은 `EVENT_POOL.events` 전체에서 conditions, modifiers.when, bonuses.when, 선택지 requires, 선택지 bonuses.when의 flags·notFlags를 훑는다. 실제 이혼 해 setFlags로 이름도 확인한다.
3. **R-633**: diff 그대로다. 위 표 참고.
4. **R-634 (a)**
   - `parentGoneOwnAgeOf`(`familyBirth.ts:299-303`)는 `d + (at − raw)`다. `deathAgeGiven`이 출산 때 나이로 조건을 걸어 `raw ≥ 0`이므로 옮김 폭은 최대 1이다.
   - 줄(`familyTick.ts:142`)과 카드(`familyView.ts:139` → `familyCard.ts:140`, `Cards.tsx:197`)가 같은 값을 읽는다.
   - 동생 구성(`lastAt`)과 상속은 시점만 읽는다. N은 읽지 않는다.
   - 저장 `d`와 해시는 그대로다. 옮겨지지 않은 판의 N=d는 `familyFm7a.test.ts:141`이 지킨다.
   - 남은 빈틈은 쓰이지 않는 대체 값 하나다(R-640).
5. **R-635·R-636·R-637**: 위 표 참고.
6. **GoneYearRule·재측정**
   - 값은 `legacy`/`setters`/`notflags`/`exclude` 넷이고, 배포 값은 `exclude`다(`familyTick.ts:255-256`).
   - `life.ts:344-359`가 ①②③을 정의대로 켠다.
   - V0~V11(`familyRemeasureLib.ts:71-82`)이 코드와 맞는다.
   - 8-4절 수치(39/7000, 3→0, 31→0)와 합계(V5→V11: 0.44%·0.68%p·뒤바뀜 0)는 생성기 정의와 같다.
   - 단, V8·V9는 `sibLoss: false`라 R-631의 **형제 쪽은 8-4에서 재지 않았다**(R-638).
7. **`PD_AT_8`**: 정당한 이동으로 본다.
   - 이동 크기는 모두 0.011 이하다.
   - 방향: 관계가 −0.009·−0.011로 줄었다. 줄이 난 해에 조부모 선택지(관계 +)를 빼고 R-633으로 서술 사건을 덜 뽑는 것과 맞는다.
   - 알파(Q3 없음)도 0.005 이하로 움직였다. 조부모·부모 줄 해 때문이고 설명된다.
   - 「기준선 = 현재 트리 ±0.01」 단언(`:528`)도 그대로 남아 있다.
8. **SPEC·문서**
   - 9(g)·2절 ②·5절 2항·완료 기준 15·`family-model.md:506`이 코드와 맞는다.
   - TODO 534행 근거의 파일·함수·시험 제목(「R-631: …」「R-632: …」「R-632 가드: …」「R-633: …」, `flagsAfterLine`, `narrowedChoices`, `slot`, `REQUIRED_IDS`, `parentGoneOwnAgeOf`)이 모두 실재한다. `[x]`는 없다.
   - 낡은 줄 둘이 있다(R-639).
9. **새 모순·빈틈**: 높음·중간 0이다. 낮음 R-638·R-640·R-641과 관찰 두 줄뿐이다.

CR 점검(새·고친 코드): RNG·CORE·TIME·SAVE·UI 위반은 0이다. CR-TEST는 고정 시드, 합성 풀, legacy 비교, INV로 갖춰졌다.

## 3. 후속 (모두 낮음)

### R-636 (재지적) [NEW] [낮음] `scripts/preFm4bPool.ts:37,40` — 세계 번호 주석이 다시 낡았다

- 1회차 diff는 그대로 들어갔다. 그런데 같은 회차에 V8(notflags)이 끼어들어 번호가 밀렸다. 이제 `fm7aVariantsPool`은 V6~V9, `fm7aSeniorPool`은 V10, `eventPool`은 V11이다.
- dev 로그 91행은 「V11로」 고쳤다고 적었지만 파일은 그대로다.
- 원인은 작업자 누락이다. 명세 문제는 아니다.

```diff
--- a/scripts/preFm4bPool.ts
+++ b/scripts/preFm4bPool.ts
@@ -37 +37 @@
- * FM7a의 원인을 하나씩 켠 풀 (재측정 V6~V9, SPEC-009 완료 기준 11): 영유아·학창은 지금(K2·K4가 켜진) 것이고 청년·중년·노년은 FM7a 전 원문에서 시작해
+ * FM7a의 원인을 하나씩 켠 풀 (재측정 V6~V10, SPEC-009 완료 기준 11): 영유아·학창은 지금(K2·K4가 켜진) 것이고 청년·중년·노년은 FM7a 전 원문에서 시작해
@@ -40 +40 @@
- * 마지막(V10)은 지금 풀(`eventPool`)이다.
+ * 마지막(V11)은 지금 풀(`eventPool`)이다.
```

### R-638 [NEW] [낮음] `scripts/familyRemeasure.ts:432,536,551-555,578-580` — 8-4절이 형제 쪽 R-631을 잰 것처럼 읽힌다

- V8·V9는 `sibLoss: false`라 형제 줄(`fam-sib-lost`)이 하나도 없다.
- 그래서 다음 수치는 측정값이 아니라 당연한 0이다.
  - 8-4절 표의 `infant-follow-sibling`·`infant-sibling-toy`·`school-family-priority` 「+0」
  - dev 로그 101행 「형제 쪽 … 0 → 0」
- 형제 쪽 효과는 V10→V11(Q3)에 섞여 있다.
- 「바뀐 판 0.56%」(후속 200)는 조부모 줄과 부모 별세 줄(R-632)만의 값이다.
- 또 하나: 8-4 제목과 점검 표는 「형제·조부모 줄이 난 해」라고 하지만, `school-teacher-notice/ask` 22건은 부모 별세 줄이 난 해다.
- 배포 세계의 안전은 INV(7000판)와 합성 시험이 지키고, 합계 판정에도 영향이 없다. 그래서 낮음이다.

```diff
--- a/scripts/familyRemeasure.ts
+++ b/scripts/familyRemeasure.ts
@@ -432 +432 @@
-    ['V10', 'V11', 'Q3 어린 형제의 이른 별세 → 상속의 형제 수 · 청년 「본가」 (V10 → V11)'],
+    ['V10', 'V11', 'Q3 어린 형제의 이른 별세 → 상속의 형제 수 · 형제 줄이 난 해의 R-631·R-632 · 청년 「본가」 (V10 → V11)'],
@@ -536 +536 @@
-  say('### 8-4. R-631·R-632: 형제·조부모 줄이 난 해의 후보·선택지 정리의 영향 — 바뀐 판 · 같은 해 점검 (V8 → V9)');
+  say('### 8-4. R-631·R-632: 가족 줄(형제·조부모 별세 · 부모 한 분 별세)이 난 해의 후보·선택지 정리의 영향 — 바뀐 판 · 같은 해 점검 (V8 → V9, 형제 줄은 V11)');
@@ -551,5 +551,5 @@
-  say('| 점검 (형제·조부모 줄이 난 해 · 줄 뒤 플래그 기준) | V8 (R-631·R-632 없음) | V9 | 0이어야 한다 |');
-  say('|---|---:|---:|---|');
-  say(`| 줄 뒤 꺼지는 플래그를 요구하는 사건이 같은 해에 일어난 판 (R-631, 건수) | ${livesWith(v8, (r) => r.sameYearCleared)} (${sumLen(v8, (r) => r.sameYearCleared)}건) | ${livesWith(v9, (r) => r.sameYearCleared)} (${sumLen(v9, (r) => r.sameYearCleared)}건) | V9 |`);
-  say(`| 줄 뒤 ctx로는 안 보이는 선택지가 골라진 판 (R-632, 건수) | ${livesWith(v8, (r) => r.lineChoiceBad)} (${sumLen(v8, (r) => r.lineChoiceBad)}건) | ${livesWith(v9, (r) => r.lineChoiceBad)} (${sumLen(v9, (r) => r.lineChoiceBad)}건) | V9 |`);
-  say(`| 점검한 선택(가족 줄이 난 해에 보이거나 골라진 선택지 수) | ${v8.reduce((n, r) => n + r.lineChoiceN, 0)} | ${v9.reduce((n, r) => n + r.lineChoiceN, 0)} | – |`);
+  say('| 점검 (가족 줄이 난 해 · 줄 뒤 플래그 기준) | V8 (R-631·R-632 없음) | V9 | V11 (배포 값, 형제 줄 포함) | 0이어야 한다 |');
+  say('|---|---:|---:|---:|---|');
+  say(`| 줄 뒤 꺼지는 플래그를 요구하는 사건이 같은 해에 일어난 판 (R-631, 건수) | ${livesWith(v8, (r) => r.sameYearCleared)} (${sumLen(v8, (r) => r.sameYearCleared)}건) | ${livesWith(v9, (r) => r.sameYearCleared)} (${sumLen(v9, (r) => r.sameYearCleared)}건) | ${livesWith(v11b, (r) => r.sameYearCleared)} (${sumLen(v11b, (r) => r.sameYearCleared)}건) | V9 · V11 |`);
+  say(`| 줄 뒤 ctx로는 안 보이는 선택지가 골라진 판 (R-632, 건수) | ${livesWith(v8, (r) => r.lineChoiceBad)} (${sumLen(v8, (r) => r.lineChoiceBad)}건) | ${livesWith(v9, (r) => r.lineChoiceBad)} (${sumLen(v9, (r) => r.lineChoiceBad)}건) | ${livesWith(v11b, (r) => r.lineChoiceBad)} (${sumLen(v11b, (r) => r.lineChoiceBad)}건) | V9 · V11 |`);
+  say(`| 점검한 선택(가족 줄이 난 해에 보이거나 골라진 선택지 수) | ${v8.reduce((n, r) => n + r.lineChoiceN, 0)} | ${v9.reduce((n, r) => n + r.lineChoiceN, 0)} | ${v11b.reduce((n, r) => n + r.lineChoiceN, 0)} | – |`);
@@ -580,2 +580,5 @@
   );
   say();
+  say('- **V8·V9에는 형제 줄이 없다**(Q3는 V11에서 켠다 — `sibLoss: false`). 그래서 위 V8 → V9의 바뀐 판·사건 표는 조부모 줄과 부모 한 분 별세 줄(R-632)만의 영향이고, 형제 쪽 사건(`infant-follow-sibling`·`infant-sibling-toy`·`school-family-priority`)의 「+0」은 측정값이 아니다. 형제 줄이 난 해의 R-631·R-632 영향은 V10 → V11 표에 함께 들어 있고, 같은 해 점검은 위 V11 열과 tests/familyConsistency.test.ts(7000판 INV)·tests/familyFm7a.test.ts 「R-631: …」 합성 시험이 본다.');
+  say();
```

지시(같은 파일 474행 문자열 안)
- 「R-631·R-632는 형제·조부모 줄이 난 해에만 닿아 이 규칙들로 임종을 놓치는 판이 늘지는 않는다」를 다음으로 바꾼다.
  - 「R-631은 형제·조부모 줄이 난 해에만, R-632는 그에 더해 한 분 별세 줄이 난 해의 선택지에만 닿고, 임종 사건은 그 해에 이미 R-561이 빼므로 이 규칙들로 임종을 놓치는 판이 늘지는 않는다」
- 적용한 뒤 `npm run report:family -- 1000 --write`로 문서를 다시 만든다. V11 열 두 칸은 0이어야 한다.

### R-639 [NEW] [낮음] `docs/TODO.md:533,534` — 번호가 밀리고 결정이 끝난 뒤 낡은 문구 둘

diff 대신 지시(줄이 길어 부분 문자열만 바꾼다)
- 533행: 「docs/data/family-remeasure.md 7절 V10 원본 열 0/6514」 → 「docs/data/family-remeasure.md 7절 V11 원본 열 0/6514」
- 534행 끝
  - 지금: 「**마스터·planner 결정 필요**: SPEC-009 완료 기준 9 (g) 「기록 전용」 문구에 이 예외(Q3 줄 해에 형제 플래그가 꺼지는 판)를 적는 것」
  - 바꿀 문구: 「SPEC-009 완료 기준 9 (g)에 이 예외를 적었다(planner, 후속 200 · 커밋 7869b88)」

### R-640 [NEW] [낮음] `src/core/familyTick.ts:142` — 별세 줄 나이의 대체 값이 R-634 (a)와 다른 값(`d`)이다

- 실제로는 쓰이지 않는 갈래다. `byId1`의 그분은 늘 `markGone`을 거친다.
- 그래도 「줄과 카드가 같은 값」을 코드에서 끝까지 맞춘다.

```diff
--- a/src/core/familyTick.ts
+++ b/src/core/familyTick.ts
@@ -142 +142 @@
-      lines.push({ code: LOG_PARENT_GONE, line: entry(age, FAMILY_LINE_ID.parentGone, FAMILY_LINE_TEXT.parentGone(who, byId1.get(who)?.goneAtOwnAge ?? f.p[sc.firstGone.who].d, age <= EARLY_LOSS_MAX_AGE)) });
+      lines.push({ code: LOG_PARENT_GONE, line: entry(age, FAMILY_LINE_ID.parentGone, FAMILY_LINE_TEXT.parentGone(who, byId1.get(who)?.goneAtOwnAge ?? sc.parentGoneOwn[sc.firstGone.who], age <= EARLY_LOSS_MAX_AGE)) });
```

### R-641 [NEW] [낮음] `src/core/life.ts:424-426` · `tests/familyFm7a.test.ts:738-740` — 강제 사건 안전망이 「닿지 않음」을 지키는 시험이 없다

- 안전망(교집합이 2개 미만이면 해 시작 값)이 실제로 쓰이면 R-632가 조용히 깨진다.
- 나중에 `infant-new-sibling`의 `help`·`sulk`에 requires가 붙으면 그렇게 된다.

```diff
--- a/tests/familyFm7a.test.ts
+++ b/tests/familyFm7a.test.ts
@@ -738,3 +738,13 @@
     expect(legacyAsk, 'legacy에서 ask가 보이거나 골라진 시도(공허 통과 방지)').toBeGreaterThan(3);
   });
+
+  it('강제 사건(K2, trigger: "family")의 안전망은 닿지 않는다: 조건(requires) 없는 선택지가 둘 이상이라 줄 뒤 교집합이 늘 2개 이상이다', () => {
+    const forced = EVENT_POOL.events.filter((e) => e.trigger === 'family');
+    expect(forced.length, '강제 사건(공허 통과 방지)').toBeGreaterThan(0);
+    for (const ev of forced) {
+      const free = (ev.choices ?? []).filter((c) => c.requires === undefined);
+      expect(free.length, `${ev.id}: requires 없는 선택지가 둘 미만이면 life.ts의 안전망(해 시작 값)이 R-632를 깬다`).toBeGreaterThanOrEqual(2);
+    }
+  });
 });
```

## 4. 관찰 (지적 아님)

- **SPEC 완료 기준 9(g)** 「난수 칸 수와 다른 해는 그대로다」(planner 참고)
  - 그해 후보가 바뀌면 그 뒤 흐름(스탯·`seen`·위임 해결의 난수)이 옮겨 갈 수 있다. 8-4의 「흐름이 옮겨 간 판」이 그것이다.
  - 「규칙이 닿는 것은 그해뿐이다」로 읽어야 맞다. 고칠 때 문구를 다듬으면 된다.
- **R-636 재지적과 출구 규칙**: 같은 ID가 2번 나왔으므로 CLAUDE.md 2-3에 따라 마스터 판단이 필요하다. 원인은 같은 회차의 번호 이동을 놓친 작업자 누락이고, 한 줄짜리 주석이다. TODO로 넘기는 것을 추천한다.

위험도: Two-way / 파급 낮음 — 이번 변경은 줄이 난 해의 후보·선택지 목록(인생 기록이 바뀐 판 0.56% + 형제 쪽 소량), 별세 줄 나이 표시(7000판 중 65판), 시험·보고서·문서뿐이다. 저장 구조와 버전은 그대로다. 남은 지적도 주석·보고서·시험 몫이다(배포 뒤 T06 스위치 문제는 1회차 메모대로 K6 배포 요청 때 알린다).

## 마스터 처리 (2026-11-06)

- APPROVED다. 3회차는 열지 않는다. 다음 지적 ID는 R-642다.
- **R-636 재지적**(같은 ID 2번, CLAUDE.md 2-3 마스터 개입)
  - 원인: 작업자 누락. 같은 회차에 재측정 세계 번호가 밀린 것을 주석에 반영하지 않았다.
  - 명세나 설계 문제가 아니고 한 줄짜리 주석이다.
  - 처리: diff 그대로 적용한다. 재발을 막기 위해 번호를 다시 짤 때는 `preFm4bPool.ts`·`familyRemeasureLib.ts` 주석을 함께 grep하라고 작업자 지시에 적는다.
- **낮음 R-636·R-638·R-639·R-640·R-641**: TODO로 넘기지 않고, QA 전에 developer가 diff를 그대로 적용한다.
  - 모두 주석·보고서·시험 몫이다. R-640만 쓰이지 않는 대체 값이다.
  - QA가 바뀐 빌드를 쫓지 않도록 QA보다 먼저 한다.
- **관찰 9(g)**: planner가 문구를 「규칙이 닿는 것은 그해의 후보·선택지뿐이다(뒤 흐름은 그 결과로 옮겨 갈 수 있다)」로 다듬는다.
