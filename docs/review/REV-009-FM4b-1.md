VERDICT: CHANGES_REQUESTED

# REV-009-FM4b-1 — SPEC-009 FM4b 검수 (1회차 / 5, 정밀 레인 · opus)

- 대상: spec-009 커밋 c4b4efb(기준 9a3a0d6). 검수자 reviewer(읽기 전용, 시험을 돌리지 않음 — 수치는 커밋된 문서·시험·코드로 대조). 리포트를 텍스트로 받아 마스터가 저장했다(2026-11-02).
- 판정: CHANGES_REQUESTED. 중간 4(R-555·R-557·R-558·R-559), 낮음 8(R-556·R-560~R-566 중 나머지).

## 지적

### R-555 [CR-TEST] [중간] `tests/judgeMargins.test.ts:24-28`, `tests/simulation.test.ts:282`
알파 노년 카드 −2.5 SE와 노이즈 0.05의 근거를 재현할 수 없다.
- 「−2.09 / −2.15 SE」는 주석과 ai-log 한 줄에만 있다. 표도 명령도 커밋되지 않았다.
- 효과를 끈 측정은 이른 별세 효과가 원인이 아니라는 것만 보여 준다. 「K2·K4의 난수 칸 이동 잡음」이라는 원인은 재지 않았다.
- 합친 4000판에서 −2.1 SE면 평균이 하한 아래일 가능성이 높다(단측 약 2%). 「잡음 안」은 근거가 없다.
- 실제 크기는 약 0.05장으로 플레이에서 느낄 수 없고, 결함을 가린다는 증거도 없다. 허용치 자체는 수용을 추천하되 기록은 남겨야 한다.

지시: `withEarlyLoss(on/off)`와 `preFm4bPool`(V0·V2 세계)로 알파 노년 평균·SE를 재는 항목을 `scripts/familyRemeasure.ts`에 더해 `docs/data/family-remeasure.md`에 표로 남긴다. QI5 때처럼 독립 시드 줄(1001~4000)을 함께 재서 잡음과 구조적 이동을 가른다. 결과에 맞게 주석의 「잡음」 문장을 고치고, GM10 재설정 줄을 TODO에 둔다.
```diff
--- a/tests/judgeMargins.test.ts
+++ b/tests/judgeMargins.test.ts
@@ -27,3 +27,3 @@
 const KNOWN_UNDER3: ReadonlyArray<{ metric: string; era: string; floor: number }> = [{ metric: '노년(65세+) 결정 카드 평균', era: 'alpha', floor: -2.5 }];
-/** 합친 표본은 `floor`(−1.5 SE), 줄별 표본은 그보다 1.5 SE 더 넓은 잡음을 인정한다(줄 하나는 표본이 4분의 1이라 SE가 두 배다) */
+/** 합친 표본은 `floor`(−2.5 SE), 줄별 표본은 그보다 1.5 SE 더 넓은 잡음을 인정한다(줄 하나는 표본이 4분의 1이라 SE가 두 배다) */
 const isKnownUnder3 = (u: { metric: string; era: string; margin: number }): boolean => KNOWN_UNDER3.some((k) => k.metric === u.metric && k.era === u.era && u.margin >= k.floor);
```

### R-556 [CR-TEST] [낮음] `tests/timeModel.test.ts:224-226`
상한 5→12로 비가족 둘째 줄을 지키던 가드가 사라졌다. 「가족 줄을 뺀 값은 옛 상한 5 안」을 단언하는 곳이 없다.

지시: 판마다 `fam-` 줄이 있는 해의 둘째 줄을 뺀 값을 따로 계산해 `< 5`를 단언한다. 12는 합계 가드로 둔다.

### R-557 [NEW] [중간] `src/core/familyBirth.ts:59-77`, `src/data/familyTables.ts:76`
`fd-b-house.md` 10절 결정 7을 빠뜨렸다.
- 결정 7은 회차를 미루지 않았다(미룬 것은 1948 연감뿐). 코드는 폐기된 「이른 쪽」 이동(−1~−3세)을 그대로 쓴다.
- 평균 약 25~27세 대 29.7세, 최대 4세 넘게 차이 난다. 조부모 출생 연도·별세·동거, `has_grandparent`를 거쳐 K4 후보까지 움직여 재측정 수치도 바뀐다.
- L0F 고정 뒤에는 알려진 시드의 가족 값이 바뀌므로 그 전에 닫아야 한다.
- 결정 8은 「다음 수집 회차의 developer」로 정해져 있어 빠뜨린 것이 아니다.

지시:
1. `scripts/genFamilyTables.ts`가 `fd1_a3_births_by_mother_age_1965_66_share_pct_calc`(전국)로 1956 앞 칸을 만들고 `motherAge.shift`를 없앤다.
2. `motherAgeShares`를 단순화한다.
3. `FAMILY_BASIS` `mother-age-before-1956`의 문구와 근거를 바꾸고, `family-model.md` 4-1 표도 고친다.
4. T-GP1·scene 골든을 갱신하고 `report:family`를 다시 낸다.

### R-558 [NEW] [중간 · 명세 누락] `src/core/familyBirth.ts:289-296`, `src/core/familyView.ts:104-114`
이혼 뒤 함께 살던 분이 미성년 때 별세하면 아이 곁에 부모가 없다.
- 예: 아버지가 떠난 뒤(leaver=1) 어머니가 별세한다. 아버지는 `apart`, 어머니는 `gone`이 된다.
- 형제·조부모도 없으면 `scene.ts:501`이 10세 아이에게 「혼자 지냅니다」를 쓴다.
- 4-7 (2)는 별세가 일어날 수 있다고만 한다.

안:
- **안 B(추천):** `divorcePlan` 인자를 `{ who, at }`로 넓히고, 정해진 `leaver`와 `firstGone.who`가 다르고 `firstGone.at`이 19 이하이면 그 판은 이혼 없음(null)으로 한다. 줄·플래그 추가가 없고 동생 끊기·R-540과도 같은 계획을 쓴다. T-FA7a 영향은 다시 잰다.
- 안 A: 따로 살던 분이 돌아오게 한다. 새 줄 문구와 플래그 의미 변경이 필요해 FM7로 넘어간다.
- 어느 쪽이든 `familyConsistency`에 「age < 20이면 household에 부모 한 분 이상」 불변식을 더한다.

### R-559 [CR-TEST] [중간] `tests/familyConsistency.test.ts:27,54,73,87,103`
INV 전수가 정본(7세대 × 1000판, 12-2절)의 약 9%다. 지시와 다른 점으로 보고되지도 않았다.
- 끝까지 돌지만(`lifeSteps` guard 400) 630판뿐이라 드문 조합을 잡기 어렵다. R-558이 그 예다.
- 사망 걸음은 73행 `continue`로 INV-7·8을 건너뛴다.
- 87행 INV-9는 정본의 「<」를 「≤」로 풀었다(R-561).
- 103행 INV-10은 `'view'`를 넘겨 동어반복이다(K1 결정 뒤 `siblingCountOf(state)`로 바꾼다).
- 12-5절의 `tests/familyFlags.test.ts`는 없다. INV-7이 이 파일로 옮겨 왔으니 설계 문서를 맞춘다.
```diff
--- a/tests/familyConsistency.test.ts
+++ b/tests/familyConsistency.test.ts
@@ -27 +27,2 @@
-const PER_GEN = 90;
+/** 평소 npm test는 세대당 90판, 12-2절 전수(1000판)는 FAMILY_INV_LIVES=1000으로 돌린다 */
+const PER_GEN = Number(process.env.FAMILY_INV_LIVES ?? 90);
@@ -54 +55 @@
-    it(`${gen}: ${PER_GEN}판`, { timeout: 120_000 }, () => {
+    it(`${gen}: ${PER_GEN}판`, { timeout: Math.max(120_000, PER_GEN * 1_500) }, () => {
```
지시: 다음 회차 전에 `FAMILY_INV_LIVES=1000`으로 한 번 돌려 위반 수·tally를 ai-log에 적는다.

### R-560 [CR-TEST] [낮음] `tests/familyTick.test.ts:136,287`, `tests/familyStorage.test.ts:202-222`
제목만큼 재지 않는 시험이 있다.
- 「난수 한 칸 규칙」은 난수 수를 단언하지 않는다.
- 「가림(4-9절)」은 `l.length > 0`만 본다. 4-9절의 7000판 가림 시험이 없다.
- 크기 시험은 출생 때 값 + 합성 로그 40개뿐이다. 실제 판을 끝까지 돌린 최댓값이 없다(코드상 판당 최대 약 20줄이라 지금 1000자는 안전해 보인다. 이름이 들어가는 회차 전에 실측이 필요하다).

지시: 강제 해의 `rngState`를 `createRng(before.rngState)`로 계산한 칸 수와 대조하고, `heavyKindOfEntry` 전수와 플레이 끝 `family` 길이 최댓값 단언을 더한다.

### R-561 [NEW] [낮음] `src/core/life.ts:347-371`
한 분 별세 해에 `middle-parents-farewell`도 같은 해에 뽑힐 수 있다. 「어머니가 세상을 떠났습니다」 다음에 「부모님이 마지막 숨을…」이 온다. 4-7 (1)은 「같은 해면 기존 사건이 두 분을 맡는다」다.

지시: FM7 변형 때 그 해 후보에서 빼거나 정본을 「≤」로 고친다.

### R-562 [NEW] [낮음] `src/core/familyView.ts:105,183`, `src/core/inherit.ts:18-23`
한 분 모델 별세 + 다른 분 100세 초과면 보기는 「두 분 모두 떠남」인데 `parentsAllGone`은 거짓이다. 먼저 떠난 분의 실제 나이가 100을 넘을 때까지 상속·주거 전환이 늦다. 설계가 허용한 동작(4-7 (1))이지만 카드가 보이면 드러난다.

지시: FM6에서 판단하고, 위험 표에 적는다.

### R-563 [CR-DATA] [낮음] `src/core/events.ts:922-923`
스키마 완화는 일반 추첨에서는 안전하다(`isEventEligible`이 보이는 선택지 2개 미만을 막는다). 빈틈이 셋 있다.
- 강제 슬롯은 이 검사를 거치지 않는다. trigger 사건에 완화가 적용되면 선택지 1개로 대기가 생겨 `pendingShapeOk`가 저장 전체를 버릴 수 있다.
- 완화 경로의 직접 시험이 없다. `familyLint`의 예는 조건 없는 선택지가 2개다.
- 실제로 `infant-care`가 이 경로를 쓴다. 조부모가 안 계신 재력 1~3 판에서 이 카드가 빠지는데 보고에 없다(수용 가능). `eventLint.ts:476` 주석도 낡았다.
```diff
--- a/src/core/events.ts
+++ b/src/core/events.ts
@@ -923 +923,3 @@
       if (unconditional < 2 && !(unconditional >= 1 && unconditional + familyGated >= 2)) p.add(`${path}.choices`, `조건(requires) 없는 선택지가 2개 이상 있어야 한다 (항상 2개 이상 보여야 한다. 지금 ${unconditional}개)`);
+      // 강제 슬롯은 isEventEligible을 거치지 않는다 — 보이는 선택지가 1개면 대기 저장이 깨진다(pendingShapeOk)
+      else if (ev.trigger !== undefined && unconditional < 2) p.add(`${path}.choices`, `trigger 사건은 조건 없는 선택지가 2개 이상이어야 한다 (지금 ${unconditional}개)`);
```
지시: 조건 없음 1 + 가족 플래그 1은 통과, 조건 없음 1 + 다른 requires 1은 실패, trigger + 조건 없음 1은 실패인 시험 셋을 `familyLint`에 더한다.

### R-564 [NEW] [낮음] `docs/TODO.md:464`
성인기 「부모님」 사건은 FM7로 넘겨도 된다(13-2절이 이미 FM7로 정했다). 단 세 가지를 고친다.
- 13-2 목록에 `youth-housing`과 `note-parents-aging`(`src/data/notes.json:71`, 조건이 `parents_gone`뿐)을 더한다.
- R-542 배포 차단 줄은 FM6·FC10만 말한다. FM7 변형도 공개 배포 차단 조건에 넣는다.
- 80.6%는 보고서·스크립트에 없다. `report:family` 표에 넣는다.

### R-565 [CR-DATA] [낮음] `src/data/familyTables.ts:37-49`
1941~45 −0.39는 ±0.45 안이고 근거 칸(`basis`·`note`, `siblings-old-cohort`)도 있어 합격이다. 다만 여유 0.06은 표본 SE(약 0.05) 수준이고, 1936~40→1941~45 낙차가 모형 −1.00, FD6 −0.64로 벌어진다.

지시(마스터 판단): `calibrateHighOrder.ts`로 upTo 1945 줄을 더하는 것을 추천한다.

### R-566 [NEW] [낮음] `ai-log/2026-10-28_SPEC-009_dev-FM4b.md:35-37`
- 고친 뒤 전체 `npm test`를 돌린 기록이 없다(해당 4파일 74/74뿐). 「전체 e2e는 아래 5」라고 했는데 5절은 TL16이다.
- `src/core/familyView.ts:27-28,239-240` 주석(「아직 어느 화면도…」, 「집 종류는 null」)이 낡았다.
- TODO:463이 검수 전에 [x]다.

지시: 재실행 결과를 적고 주석을 지운다. 체크는 QA 뒤로 옮긴다.

## 1. 느슨해진 시험 판단
| 대상 | 판단 |
|---|---|
| `judgeMargins` −2.5, `simulation` 0.05 | 값은 수용 가능, 근거가 재현 불가(R-555) |
| `timeModel` 12 | 사유는 맞다. 옛 가드가 사라졌다(R-556) |
| 스키마 완화 | 런타임 가드가 있어 가리는 결함 없음. 빈틈은 R-563 |
| `glue` | 정당. `FitPair` 4는 실제 코드 수와 맞는다. `SceneCard` 1은 이제 `split(' · ')`인데 307행 주석은 옛 설명이다 |
| `buildConfig` | 정당(`report:family` 추가) |
| `family-scene.spec` | 정당(집 낱말 목록, 52·212행) |
| 보고 목록 밖의 변경 | `stat20Guard`·`infantContent` 기준선(이동 ≤ 0.34), `rngSnapshot`, `sceneGolden`, 첫째 동생 비율 띠, 5세 후보 +1. 사유가 적혀 있고 수용 가능. 기준선은 효과를 끈 세계에서 재므로 효과 크기는 `family-remeasure`만 지킨다 |

## 2. 이른 부모 별세 — 지표가 틀렸다, 크기는 A-6 유지 추천
- 20세 −15%는 150만 원 한 칸 ÷ 분모 바닥 1000만 원이다. 한 칸만 움직여도 15%가 나온다.
- 최종 −4.23%(2단계)는 난수만 옮긴 K2 표의 같은 칸 7.35%보다 작다. 이 칸의 중앙값 잡음이 효과보다 크다. 평균 변화는 최대 0.48%다.
- 보고서 5절의 「평균으로 바꾸면」은 그대로 안 풀린다. 같은 분모로 20세 평균 변화가 5.9·7.3·8.3·4.6·1.3%이고, 반 크기도 2.9·3.6·4.2·2.3·0.7%다.
- 추천 수용 기준: 최종 순자산 평균 변화 ≤ 3%(지금 최대 0.48%), 20세 시작 평균의 절대 변화 ≤ 150만 원(지금 최대 126), 뒤바뀜 0, 판정 ≤ 2%p(지금 0.35). 중앙값·효과 걸린 판(−446 / −1,124만 원)은 보고만 한다.
- 결정하면 `family-model.md` 4-7 (1)과 12-1, `familyRemeasure`의 「기준 초과」 판정을 함께 고친다.

## 3. K1 — FM6과 같은 묶음으로 K6 전에 켜는 것을 추천
- 옛 규칙을 두면 FM6에서 INV-10이 깨진다(카드 = 그림 = `siblingCountOf`). 금액은 화면에 없어(D8) 직접 보이지는 않지만, 5남매 카드에 2.6분의 1 상속이 남는다. 지금 INV-10 시험이 통과하는 것은 `'view'`를 넘기기 때문이다.
- 영향은 위쪽에 몰린다. 최종 평균은 1~3단계 ≤ 0.9%, 4단계 −4.3%, 5단계 −7.4%. 뒤바뀜 0. 5단계 판정 4.93%p는 n=284라 흔들림이 크다.
- 3%·2%p 기준은 못 넘는다. K1용 기준을 따로 승인받아야 한다(추천: 뒤바뀜 0, 최종 평균 ≤ 8%, 판정 ≤ 5%p). INHERIT 재보정은 하지 않는다. 형제가 많으면 몫이 준다는 것이 이 게임의 주제에 맞는다. 다음 플레이테스트의 확인 포인트로 묻는다.
- 옛 저장은 안전하다. 스냅샷 구성의 형제 수가 옛 값과 같다(`familyStorage.test.ts:192`).
- 켤 때 함께 할 일: L1 시험을 `withSiblingCountRule('legacy')`로 감싼다. INV-10은 `siblingCountOf(state)`로 바꾼다.
- 그대로 두려면 INV-10의 예외를 명세에 적어야 한다.

## 4. 확인 결과 (문제 없음)
- **K2:** `rng.next()` 한 번은 `weightedIndex` 한 번과 칸 수가 같다. 진행 RNG는 이 슬롯에서만 쓴다. 새 진행 경로 없이 `stepYear` 안에서 처리한다(CR-TIME). 부모 결정은 `child`(2~5세)라 대기가 안 생긴다. 자동 모드·「다음 결정으로」는 같은 틱을 쓴다. 강제 사건은 하나뿐이다. `lg === 1`이면 카드가 안 나오고 `seen`도 함께 막으므로 옛 저장에서 다시 나오지 않는다. 새 세계의 고정 시드 골든이 아직 없다(L0F까지는 `rngSnapshot` 13판이 대신한다).
- **FA7:** 「한 해 앞서」는 수용한다. 이번 해 후보는 해 시작 플래그로 가려지고 효과는 플래그를 읽지 않는다. 동생 플래그는 k−1 끝에 켜지고, `younger_sibling` 조건으로 장난감 사건은 k+1부터다. k−1에 사망하면 플래그만 남는데 읽는 곳이 없다. `*_gone`을 읽지 않아도 어긋남은 없다. 같은 해 별세 + 동생은 코드 순서대로 줄이 남고 INV-2b와 맞다. `family.log` 크기는 지금 안전하다(R-560).
- **집:** 격자·보간·단계 경계·가까운 해 규칙·승격 전 부모 도·1969 이하·연도별 문턱·경험 비율 4σ 시험이 모두 있다. 값은 데이터 파일에 있고 근거 칸도 있다. 수저 → 소득, 시도 → 지역 매핑은 10절 3번상 planner 몫인데 작업자가 정했다. 사후 승인이 필요하다(세종 = 「광역시 등」). 근거 표기 「지역 4분류」는 실제 3분류를 쓴다(전국 제외).
- **옛 저장:** 0·20·65세 원문이 열리고, 소급 0을 `familyTick:383-415`가 끝까지 돌려 확인한다. R-540은 코드와 시험에 있다. 첫 해에는 플래그가 없어 한 해 동안 어긋날 수 있다(무시 가능).
- **TODO:** FM4b 근거 파일·함수·시험명은 대조한 범위에서 모두 실재한다.

## 5. QA 전체 e2e에서 꼭 볼 것
1. 멈췄던 1,446 이후를 포함한 전체 완주. 특히 `gentle`·`ending`·`m7a-infant`.
2. 가족 줄만 있는 해: 연출 대기, 줄 수, 빠른 진행, 가리기 켬에서 `fam-parent-gone`·`fam-parents-apart`·`fam-gp-gone` 문장 0.
3. 강제 카드 해(2~5세): 마일스톤과 함께, 자동·8배속·「다음 결정으로」·새로고침.
4. v0.3.0 원문으로 이어하기: 줄 소급 없음, 연 직후 그림과 플래그, 저장 뒤 재열기.
5. 큰 글자·360px 아래 한 줄 `FitList` 줄바꿈과 낭독, 긴 집 낱말.
6. R-558 고친 뒤 미성년 「혼자 지냅니다」 0(시드 고정 공격 판).
7. 2~5세 부모 별세 + 동생 같은 해.

위험도: Two-way / 파급 중간

## 마스터 처리 (2026-11-02)
- **R-557:** 지금 구현한다(L0F 전 필수이고 이미 내린 결정이다).
- **R-558:** 안 B로 정한다. 재혼·의붓을 만들지 않은 결정과 같은 결이고, 새 문구 없이 모순을 없앤다. 불변식을 더한다.
- **이른 별세 수용 기준:** 검수자 추천대로 바꾼다(최종 평균 ≤ 3%, 20세 평균 절대 변화 ≤ 150만 원, 뒤바뀜 0, 판정 ≤ 2%p, 중앙값은 보고만). 크기는 A-6 그대로.
- **R-565:** 보정 범위를 1945까지 넓힌다.
- **집 매핑(수저 → 소득, 시도 → 지역)** 사후 승인. 세종 = 「광역시 등」. 근거 표기를 「지역 3분류」로 고친다.
- **R-561·R-562·R-564의 FM7·FM6 몫**은 해당 회차에. R-564의 TODO·13-2 수정과 `report:family` 표는 이번에.
- **K1:** 형진 님께 묻는다(게임 체감이 바뀌는 결정).
