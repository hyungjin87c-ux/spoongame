# REV-009-PREDEPLOY-1 — 1회차 / 5 (정밀 레인, opus)

판정: APPROVED (높음 0 · 중간 0 · 낮음 4)

- 대상: 커밋 3dada82(배포 전 전체 점검 실패 4건 수정 + v0.4.0 새 소식·버전)

읽은 것: `.coding-rules.md`, dev 로그 `ai-log/2026-11-07_SPEC-009_dev-predeploy.md`, 결정 로그 후속 201, `src/core/ending.ts` 전체, `src/screens/EndingScreen.tsx`(엔딩 출발선 카드), `src/data/endingText.ts`, `src/core/birthProfile.ts#wealthMixtureOf*`, `src/data/finalDistribution.ts`(0원 칸 위치를 직접 셈), `scripts/endingReadback.ts`·`pipelineLib.ts`(500~553)·`economyCheckLib.ts`·`endingRatios.ts`·`familyRemeasureLib.ts`·`r1SnapshotLib.ts`, `tests/ending.test.ts`(새 describe 5개 + 고친 3곳 + 668~700), `e2e/m7e3-ending.spec.ts`·`m7e3Ending.ts`·`m7b-cite-lines.spec.ts`·`auto-from-sheet.spec.ts`(341~351)·`info-panel.spec.ts`(버전 줄), `middle.json`의 care·farewell 변형 6건, `citations.json` c-081, `releaseNotes.ts` v0.4.0, `copy.md` 5-2 ①·8-2·13-2, `familyApproval.ts` T06, `familyTables.ts` siblingLoss, `storage.ts` SCHEMA_VERSION, `tests/fixtures/save-v030-*.json`, `package.json`·lock.

못 한 것: 읽기 전용이라 시험 실행과 `git diff`는 못 했다. 통과 수치(vitest 4872, e2e, check:economy)는 dev 로그를 믿었고, 고친 3곳은 「고친 뒤의 내용」으로만 판단했다.

## 확인 결과
1. **`finalMovementOf`는 맞게 동작한다.**
   - 판정식은 `net <= 0 && m === 'up' ? 'same' : m` 하나다. 0원보다 큰 값은 `movementOf`와 같다.
   - 방향을 쓰는 화면은 `EndingScreen` 한 곳뿐이고, `reviewEnding`을 거쳐 이 함수를 쓴다. 방향 문장 `ending-movement`도 여기서 나온다.
   - 막대의 aria-label, 범례, 최종 순자산 줄은 방향을 쓰지 않는다. `src` 안에서 `movementOf`를 직접 부르는 화면은 없다.
   - 출생 화면·룰렛·카드는 `startBandOf`와 `bandLabel`만 써서 이 규칙이 닿지 않는다.
   - 방향은 저장하지 않고 화면을 그릴 때마다 계산한다.
2. **스크립트 4개는 같은 규칙으로 맞춰져 있다.**
   - `expectedMovement`의 `net` 갈래는 `finalMovementOf`와 같은 규칙이고, 5151 구간 전수 시험이 이를 대조한다.
   - 31.7% → 26.1%는 이 규칙만으로 설명된다.
     - 알파는 q[27] = −6이고 첫 0원이 28번째 칸이다. 그래서 순자산 −5 ~ 0이 점수 28로 1단계 띠 [0, 25] + 여유 2를 넘는다.
     - Z세대는 q[27] = −250이라 −249 ~ 0이 같다.
     - 다른 세대와 R1은 0원이 띠 안이거나 여유 안이라 변화가 없다(R1은 27).
   - `END_LIMITS.autoUpShare` 45와 `KNOWN_GUARD_GAPS` 6건은 문서(economy-model.md)와 같다. 가드를 몰래 푼 흔적은 없다.
3. **새 vitest 5개는 공허하지 않다.**
   - 첫 시험(0원 × 8 × 5)은 고치기 전 코드에서 genz·alpha 1단계로 실패하므로 회귀 시험이다.
   - 주입 표 시험은 0원이 점수 59라 실제로 앞섬 → 비슷함이 되는 경로를 본다. +1은 앞섬 그대로다.
   - 전수 시험은 `capped > 10000`을 단언한다.
   - 고친 3곳은 기대값을 맞춰 넣은 것이 아니라 규칙을 반영했다. 단, 11990판의 `cappedSame` 분류가 느슨하다(R-650).
4. **cite-lines 95는 맞다.** `middle-parents-care-{mother,father}-gone`이 c-081을 지금·다가올 세상에 이어 2 × 2 = 4칸이다. 다만 farewell 변형이 칸에 들지 않는 이유는 틀렸다. 선택지는 3개(stay·late·share) 있고, 실제 이유는 `noCitation: "X2"`다(R-649).
5. **시간 가리기는 맞다.** copy.md 8-2가 「분은 두 자리 이상 … 100:00」으로 정했고 `formatPlayTime`은 `padStart(2)`만 한다. `\d{2,}:\d{2}`는 시간 숫자만 가리므로 다른 실패를 숨기지 않는다.
6. **새 소식은 맞다.**
   - 요약과 8항목이 copy.md 13-2와 글자 그대로 같고, 종류 칩도 같다.
   - 6번이 70자로 가장 길다. 느낌표·이모지·내부 식별자는 없고 모두 해요체다.
   - 사실도 맞다. T06은 `approved: true`, `siblingLoss.enabled: true`다. `SCHEMA_VERSION` 9는 v0.3.0 고정 원문의 `"version":9`와 같다.
   - 버전 0.4.0이 package.json, lock 2곳, 노트, info-panel에서 같은 값이다.

## 지적

### R-649 [NEW] [낮음] `e2e/m7b-cite-lines.spec.ts:40` — farewell 변형이 칸에서 빠지는 이유가 틀렸다

- farewell 변형은 선택지가 있다. 칸에서 빠지는 이유는 인용이 없어서(`noCitation: "X2"`)다.
- dev 로그 21행도 같은 오기다(로그는 고치지 않아도 된다).

```diff
--- a/e2e/m7b-cite-lines.spec.ts
+++ b/e2e/m7b-cite-lines.spec.ts
@@ -39,3 +39,3 @@
  * 91 → 95 (2026-11-07, 배포 전 점검): SPEC-009 FM7a(커밋 6661818)의 변형 사건 `middle-parents-care-mother-gone`·`middle-parents-care-father-gone`이 인용 c-081을 지금·다가올 세상에 이어(2건 × 2세상 = 4칸) 결정 카드 칸이 88 → 92가 됐다.
- * 같은 변형의 별세 서술 사건(`middle-parents-farewell-*-gone`)은 선택지가 없어 칸에 들지 않는다. 기록 카드 3칸은 그대로다. 원자료에서 칸마다 센 목록으로 확인한 값이다(그 밖의 증감 없음).
+ * 같은 변형의 별세 사건(`middle-parents-farewell-*-gone`)은 선택지(stay·late·share)는 있지만 인용이 없어(`noCitation: "X2"` — 원본 `middle-parents-farewell`과 같다) 칸에 들지 않는다. 기록 카드 3칸은 그대로다. 원자료에서 칸마다 센 목록으로 확인한 값이다(그 밖의 증감 없음).
  */
```

### R-650 [CR-TEST] [낮음] `tests/ending.test.ts:1157`, `scripts/endingRatios.ts:43`(`scripts/endingReadback.ts` 사용처) — 상한으로 바뀐 판과 여유로 비슷함인 판이 섞인다

- 0원 이하이면서 여유 안(1~2점)이라 원래도 비슷함인 판이 `cappedSame`(시험)과 `inGrace`(측정 표)에 섞인다.
- 그래서 시험의 `cappedSame > 0`이 상한이 실제로 일했음을 증명하지 못한다. 측정 표의 「구간 밖·여유 안」 열에는 상한으로 바뀐 판이 들어간다.

```diff
--- a/tests/ending.test.ts
+++ b/tests/ending.test.ts
@@ -1157,1 +1157,1 @@
-        } else if (j.movement === 'same' && l.net <= 0 && end > high) {
+        } else if (j.movement === 'same' && l.net <= 0 && expectedMovement(low, high, end, BAND_GRACE) === 'up') {
```
```diff
--- a/scripts/endingRatios.ts
+++ b/scripts/endingRatios.ts
@@ -1,1 +1,1 @@
-import { BAND_GRACE, finalMovementOf, finalWealthStanding, reachedIndependence, standingScore, startBandOf, wealthMixtureOfProfile, type Movement, type ParentWealth } from '../src/core';
+import { BAND_GRACE, finalMovementOf, finalWealthStanding, movementOf, reachedIndependence, standingScore, startBandOf, wealthMixtureOfProfile, type Movement, type ParentWealth } from '../src/core';
@@ -43,1 +43,1 @@
-    if (score < band.low || score > band.high) if (finalMovementOf(band, end, l.net) === 'same') t.inGrace++;
+    if (score < band.low || score > band.high) if (movementOf(band, end) === 'same') t.inGrace++; // 여유로 비슷함이 된 판만 센다 (0원 이하 상한으로 비슷함이 된 판은 이 열에 넣지 않는다)
```

### R-651 [NEW] [낮음] `docs/design/copy.md:304~305`, `src/core/ending.ts:19`, `e2e/m7e3-ending.spec.ts:69` — 결정 C 보강이 결정 문서에 기록되지 않았다

- copy.md 5-2 ①은 아직 「다가올 세상에서 1단계 0원이 「앞섬」으로 남는 것은 … 사실과 맞다」라고 적고 있어, 지금 코드와 반대다.
- 디자이너가 이 문서를 보고 규칙을 되돌릴 위험이 있다.

```diff
--- a/docs/design/copy.md
+++ b/docs/design/copy.md
@@ -305,2 +305,3 @@
 - 검토하고 버린 안 D(0원이면 자리를 말하지 않는다): 27%의 판이 방향 없는 엔딩이 되어 「출발선에서 마지막까지」 카드의 뜻이 사라진다.
+- **보강(마스터 결정 2026-11-07, 배포 전 점검)**: 최종 순자산이 0원 이하(빚 포함)로 마친 판은 방향이 「앞섬」이 될 수 없다 — 계산상 앞섬이면 「비슷함」으로 읽는다(`src/core/ending.ts#finalMovementOf`). 위 표의 「다가올 0원 → 앞섬」과 그 설명(「사실과 맞다」)은 이 보강으로 바뀌었다. 자리 글자와 막대 마름모의 위치는 그대로라, 0원 판의 마름모가 띠 오른쪽 조금 밖에 있어도 문장은 「비슷한 자리」다(지금 분포표: Z세대·알파 1단계 0원 = 28, 띠 끝 25).
 
```
```diff
--- a/src/core/ending.ts
+++ b/src/core/ending.ts
@@ -19,1 +19,2 @@
  *  - 방향(앞섬·비슷함·뒤쪽)은 도착 자리가 출발 구간의 위·안·아래 어디인지로 정한다(movementOf). 화면에 말한 숫자만 쓰므로 문장과 방향이 어긋날 수 없다.
+ *    엔딩이 실제로 쓰는 것은 finalMovementOf다 — 0원 이하로 마친 판은 앞섬이 없다(마스터 결정 2026-11-07, 결정 C 보강).
```
```diff
--- a/e2e/m7e3-ending.spec.ts
+++ b/e2e/m7e3-ending.spec.ts
@@ -69,1 +69,2 @@
   // 눈으로 읽히는 방향: 띠 오른쪽 밖 = 앞선 자리, 왼쪽 밖 = 뒤쪽, 띠 안·가장자리 = 비슷함 (movementOf의 여유 2점)
+  // 단 0원 이하로 마친 판은 띠 오른쪽 밖이어도 비슷함이다(finalMovementOf, 마스터 결정 2026-11-07) — 아래 same의 위쪽 한계(high + 2)는 그런 판에 맞지 않는다. 지금 'zero' 상태는 알파 2단계([25, 55])라 띠 안이다.
```

### R-652 [NEW] [낮음] `docs/TODO.md:153` — [x] 근거의 시험 제목 칸 수가 낡았다

- 근거가 시험 제목을 「…인용 박스(92칸) — …」로 적고 있다. 실제 제목은 「(95칸)」이다.
- 이 어긋남은 이번 커밋 전(제목 91칸)부터 있었지만, 이번에 제목이 다시 바뀌었다.
- 지시: `docs/TODO.md` 153행의 `「320 인라인 · 글자 …%: 연결된 카드 × 세상 전부의 인용 박스(92칸) — …」`를 `「320 인라인 · 글자 …%: 연결된 카드 × 세상 전부의 인용 박스(95칸) — …」`로 바꾼다. 169행의 「92(결정 카드 89 + …)」는 그때의 기록이라 두어도 된다.

## 후속 (TODO로 넘김)
- R-649 · R-650 · R-651 · R-652(모두 낮음). 배포를 막지 않는다.

## 관찰 (지적 아님)
- 0원 판의 마름모는 띠 밖 최대 3점(28 대 25)에 놓이고 문장은 「비슷한 자리」다. 결정이 정한 동작이다. 시도를 직접 골라도 섞음 비율은 연도만 줄여서 띠가 거의 같으므로 차이가 더 커지지 않는다.
- 흙수저가 1만 원으로 마치면 점수 42로 「앞섬」이다(알파). 결정 C(동률 불리)에서 원래 생기는 계단이고, 이번 변경과는 무관하다.
- 다음 3곳은 아직 `movementOf`를 직접 쓴다. 다시 돌리면 genz·alpha 1단계 0원 이하 판에서 제품과 다르게 나온다. QA에 알릴 사항이다.
  - 디자인 도구: `scripts/design/buildMockups.mjs`. 이미 옛 `startBandOf(era, …)` 서명이라 지금 그대로는 돌지 않는다.
  - QA 스크립트: `qa/scripts/f-ending.mjs`, `qa/scripts/m7e-saves.mjs`.
- `tests/ending.test.ts` 1023행 제목의 「관측 앞섬 42~52%」는 알파에서 낮아졌을 수 있다. 문턱(≥ 0.3)은 dev 로그상 통과다.

위험도: Two-way / 파급 낮음 — 방향은 저장하지 않고 엔딩을 그릴 때마다 `reviewEnding`으로 계산하므로, 되돌리면 옛 저장도 그대로 옛 규칙으로 돌아간다.

## 마스터 처리 (2026-11-07)
- APPROVED다.
- 낮음 R-649~R-652는 TODO로 넘기지 않는다. 배포 전에 developer가 diff 그대로 적용한다(주석·시험 분류·문서·TODO 문구뿐이다. 제품 동작은 바뀌지 않는다).
- QA 실패 케이스 재확인: 실패했던 `m7e3-ending:143`(0원 판 엔딩 화면)·`m7b-cite-lines`·WebKit `auto-from-sheet:317`을 작업자가 다시 돌려 통과했다(dev 로그).
- 배포 뒤 DP8(공개 사이트 번들 확인)로 마무리한다.
- 관찰의 QA 스크립트 2곳(`movementOf` 직접 사용)은 다음 QA 때 qa에게 알린다(TODO 줄).
- 다음 지적 ID는 R-653이다.
