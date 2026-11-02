# REV-009-ERA5-1 — SPEC-009 시대의 창 94장 반영 검수 (1회차 / 5, 표준 레인)

- 대상: 브랜치 `spec-009`, 커밋 5e35b16. 작업자 기록 `ai-log/2026-11-02_SPEC-009_dev-era-r5.md`, 설계 정본 `docs/design/era-window.md`(9-4절·10-1절·끝의 「승인 표기 (2026-11-02)」). 기준표 `.coding-rules.md`.
- 한계: 읽기 전용이라 시험과 `git diff`를 돌리지 못했다. 코드와 시험을 읽어서 판단했다. 작업자 보고의 수치(골든 187칸 불변, 1990년 앞 해 0칸 변경, 크기 표, 글꼴 바이트)는 구조로만 교차 확인했고 바이트 단위 대조는 못 했다.

판정: APPROVED

지적: 높음·중간 없음. 낮음 3건(R-570~R-572)은 「후속(TODO로 넘김)」으로 넘긴다. 다음 회차는 열지 않는다.

## 1. 지적 (모두 낮음)

### R-570 [CR-TEST] [심각도 낮음] `tests/sceneGolden.test.ts:8-11`
골든을 다시 뽑은 사유가 머리 주석에 없다. R-567(rngSnapshot·sceneGolden의 갱신 사유 누락)과 같은 종류가 이번 갱신에서 되풀이됐다. 이 파일은 갱신 때마다 사유를 머리에 적는 약속이다. 이번 갱신은 집 2칸(`boomer/1000041/9`, `g86/2000081/4`: h2 → h1 초가)과 시대의 창 72행 번호표(43 → 94)다.
- 재현 경로: 파일 머리 5~11행에 「시대의 창 r5 반영」이 없다. 다음에 골든이 깨질 때 이 2칸이 왜 바뀌었는지 코드만으로는 알 수 없다.

```diff
--- a/tests/sceneGolden.test.ts
+++ b/tests/sceneGolden.test.ts
@@ -10,1 +10,2 @@
  * **FM4b 검수 1회차 반영 갱신(2026-11-02, R-557·R-558·R-565)**: 장면 189칸 중 4칸(식구 수·열쇠 해시)을 다시 만들었다 — 조부모 별세 해·함께 사는 쪽·동생 구성이 달라져 그 나이의 식구 수가 달라진 칸이다(ai-log/2026-11-02_SPEC-009_dev-FM4b-r2.md 2절).
+ * **시대의 창 r5 반영 갱신(2026-11-02)**: ① 장면 189칸 중 2칸(`boomer/1000041/9` · `g86/2000081/4`)의 집이 `house-detached-h2`에서 지붕이 초가인 `house-detached-h1×0.86`으로 바뀌었다 — 초가 규칙(단독 · 시골/해안 · 재력 ≤ 2 · ~1975, era-window.md 9-4절 ③)이 1970~75에도 h1을 쓰게 했다. 나머지 187칸은 그대로다. ② 시대의 창 72행은 그림 번호표가 43장 → 94장이라 번호가 모두 새로 매겨졌다. 번호를 id로 풀어 견주면 1990년 앞 해(1940~1989)의 그림·가림 표시는 바뀌지 않았고, 바뀐 칸은 모두 1990년 이후 해다(ai-log/2026-11-02_SPEC-009_dev-era-r5.md 3절).
```

### R-571 [NEW] [심각도 낮음] `src/ui/dash/LogList.tsx:150-156, 206-222, 248-259` — LR2 밀림의 원인 제거(선택, 마스터가 받아들여도 된다)
작업자의 원인 설명은 코드로 맞는다. 다만 시험을 넓히지 않고 원인을 없앨 수 있다.

**원인 확인**
- `componentDidUpdate`가 보정한 뒤 `this.remember(rows)`(259행, 251행)로 보던 줄의 거리를 지금 잰 값으로 다시 잡는다.
- 다음 업데이트의 `getSnapshotBeforeUpdate`(220-221행)도 그 줄의 거리를 다시 잰다.
- 그래서 `scrollTo`가 정수 픽셀로만 옮겨 남긴 반올림 오차가 보정마다 새 기준이 되어 쌓인다.
- 시대 줄만 끼는 업데이트에서는 `added <= 0`이라 `eraInsertPlan`(logOrder.ts:112)이 `scrollTop + shift`를 쓴다. 그 shift가 69.59이면 70으로 옮겨져 매번 0.41px 어긋나고, 부호가 늘 같아서 쌓인다. 11줄이면 약 4.5px이고 보고된 4.3px과 맞는다.
- 같은 판 안에서도 사람들의 기록 줄이 소수 높이(글줄 × 행간)를 갖는데도 종전에 통과한 까닭은, 기록 줄은 업데이트마다 부호가 섞여 상쇄되기 때문이다. 시대 줄은 높이가 늘 같아 상쇄되지 않는다.
- 이미 `realign`(185행)은 「기억한 줄과 거리는 그대로 두고」 오차 누적을 막는다. 새 줄 보정 경로만 그렇지 않다.

**시대 줄 높이를 정수로 맞추는 쪽은 권하지 않는다.** 줄 높이는 글자 크기(100~200%)와 폭(360/320)에 따라 달라 CSS로 정수에 고정할 수 없다. 고칠 곳은 보정 코드다.

**같은 원인에 걸리는 다른 시험**
- `e2e/log-order.spec.ts:165`(3라운드 누적 ≤ 2px)가 같은 원인에 노출된다. 지금은 시드 777 판의 건너뛴 해 수가 정해져 있어 통과하지만 마진을 알 수 없다.
- 넓힌 기준 `2 + 0.5 × 시대 줄 수`는 실측 0.41/줄 대비 마진이 약 20%뿐이다. 줄 높이의 소수부가 .50에 가까운 폭·글자 크기에서는 한계에 닿는다.
- 그래도 이 기준은 받아들일 만하다. 시대 줄이 없는 판은 종전 2px 그대로이고, `maxJump ≤ 1`이 한 프레임에 튀는 일(무보정이면 약 70px)을 여전히 막는다.

**제안 diff** (직접 돌리지 못했다. 적용 뒤 `e2e/log-order`를 Chromium desktop·mobile-360에서 돌리고, WebKit은 LR2만 돌려 통과하면 둘째 diff로 기준을 되돌린다. 통과하지 못하면 이 지적은 철회하고 넓힌 기준을 그대로 둔다.)

```diff
--- a/src/ui/dash/LogList.tsx
+++ b/src/ui/dash/LogList.tsx
@@ -154,6 +154,18 @@
     const seen = this.firstSeen(rows, el, ol);
     this.place = { key: seen?.key ?? null, offset: seen?.offset ?? 0, scrollTop: el.scrollTop, ...this.dims(el, ol) };
   }
 
+  /**
+   * 보정을 마친 모습을 「보던 자리」로 기억한다. 보던 줄이 지키려던 거리(`snap.anchorOffset`)에서 1px 안쪽으로만 벗어나 있으면(정수 픽셀 스크롤의 반올림 오차)
+   * 거리는 지금 잰 값이 아니라 지키려던 값 그대로 둔다 — 다음 보정이 이 오차까지 되돌려, 소수 높이의 시대 줄이 해마다 끼는 판에서 오차(줄마다 0.41px)가 쌓이지 않는다(`realign`이 기억한 거리를 그대로 두는 것과 같은 방법).
+   */
+  private rememberKept(rows: readonly AnyLogRow[], snap: Snapshot): void {
+    this.remember(rows);
+    const p = this.place;
+    if (p !== null && p.key !== null && p.key === snap.anchorKey && Math.abs(p.offset - snap.anchorOffset) < 1) this.place = { ...p, offset: snap.anchorOffset };
+  }
+
   /** 기억한 뒤로 영역이나 목록의 크기가 달라졌는가 — 줄이 다시 흘렀다(관찰자가 곧 되맞춘다) */
@@ -218,8 +230,10 @@
       return { newestBefore, scrollTop: el.scrollTop, anchorKey: was.key, anchorOffset: was.offset };
     }
     const seen = this.firstSeen(prev.rows, el, ol);
-    return { newestBefore, scrollTop: el.scrollTop, anchorKey: seen?.key ?? null, anchorOffset: seen?.offset ?? 0 };
+    // 지난 보정이 남긴 1px 안쪽 오차는 새 기준으로 삼지 않고 지키려던(기억한) 거리를 기준으로 한다 — 오차가 쌓이지 않게
+    const anchorOffset = seen !== null && was !== null && was.key === seen.key && Math.abs(was.offset - seen.offset) < 1 ? was.offset : (seen?.offset ?? 0);
+    return { newestBefore, scrollTop: el.scrollTop, anchorKey: seen?.key ?? null, anchorOffset };
   }
 
   componentDidUpdate(_prev: Props, _state: Record<string, never>, snap: Snapshot | null): void {
@@ -248,7 +262,7 @@
       const top = eraInsertPlan({ scrollTop: snap.scrollTop, shift, follow: following.current });
       if (top !== null) el.scrollTo({ top, behavior: 'instant' });
-      this.remember(rows);
+      this.rememberKept(rows, snap);
       return;
     }
@@ -258,5 +272,5 @@
     if (plan.unread > 0) onUnread(plan.unread);
     // 보정한 모습을 새 「보던 자리」로 기억한다 — 줄이 늘어 목록 높이가 바뀌었다고 곧 도는 관찰자는 어긋남 0을 보고 가만히 있는다(한 번만 움직인다)
-    this.remember(rows);
+    this.rememberKept(rows, snap);
   }
```

```diff
--- a/e2e/log-order.spec.ts
+++ b/e2e/log-order.spec.ts
@@ -417,8 +417,5 @@
   expect(result.rowsAdded, `줄이 여러 개 쌓였다(${result.rowsAdded}개, ${result.frames}프레임)`).toBeGreaterThanOrEqual(5);
-  // 시대의 창 r5 반영: 이 판(2017년생 50세, 미래 해)은 해마다 시대 줄이 끼고, 그 줄 높이는 소수(69.59px)인데 스크롤 위치는 정수 픽셀로만 옮겨져 줄 하나에 0.41px씩 슬며시 밀린다(튀지 않고 쌓이는 반올림 오차).
-  // 그래서 보던 줄의 이동은 「기록 줄 하나당 2px 이내 + 시대 줄 하나당 0.5px 이내」로 본다 — 한 프레임에 튀는 일은 여전히 막는다(시대 줄 없는 판은 종전대로 2px).
-  expect(result.maxDelta, `보던 줄(「${result.text}」)의 프레임별 최대 이동(px) — ${result.rowsAdded}줄이 쌓이는 동안 시대 줄 ${result.eraAdded}개`).toBeLessThanOrEqual(2 + 0.5 * result.eraAdded);
+  // 시대 줄(소수 높이 69.59px)이 해마다 끼어도 정수 픽셀 보정의 반올림 오차가 쌓이지 않는다(LogList.rememberKept, R-571)
+  expect(result.maxDelta, `보던 줄(「${result.text}」)의 프레임별 최대 이동(px) — ${result.rowsAdded}줄이 쌓이는 동안 시대 줄 ${result.eraAdded}개`).toBeLessThanOrEqual(2);
   expect(result.maxJump, '한 프레임에 튄 최대 이동(px)').toBeLessThanOrEqual(1);
```

### R-572 [CR-TEST] [심각도 낮음] `e2e/family-scene.spec.ts:96-100` — 빈 틀 시험의 공허 통과 방지
새 시험은 `d2010.ts` 요청을 막고 빈 틀을 기대한다. 그런데 막힘 자체를 확인하지 않는다. 경로 정규식 `/\/eraWindows\/d2010\.ts/`는 개발 서버 주소에만 맞는다. 프로덕션 빌드(`d2010-<해시>.js`)로 돌리거나 경로가 바뀌면 막히지 않고, 덩어리가 도착하기 전의 빈 틀 순간에 `data-empty`가 참으로 읽혀 통과할 수 있다.
- 재현 경로: `playwright test`를 프로덕션 번들 대상으로 돌리면 `route` 콜백이 한 번도 호출되지 않는데 시험은 타이밍에 따라 통과한다.

```diff
--- a/e2e/family-scene.spec.ts
+++ b/e2e/family-scene.spec.ts
@@ -96,6 +96,10 @@
 test('시대의 창 덩어리를 받지 못한 판(2016년, 2010년대 덩어리 요청 차단)의 창은 빈 틀이다: 링크도 그림도 없고, 인생 기록에 시대 줄(data-tl="era")이 없다 — 연도 표만 보인다', async ({ page }) => {
-  await page.route(/\/eraWindows\/d2010\.ts/, (route) => route.abort());
+  let blocked = 0;
+  await page.route(/\/eraWindows\/d2010\.ts/, (route) => {
+    blocked++;
+    return route.abort();
+  });
   await injectSave(page, still(), FAST, MANUAL);
   await expect(sceneCard(page)).toHaveAttribute('data-scene-art', 'ready', { timeout: 15_000 });
+  await expect.poll(() => blocked, '2010년대 덩어리 요청을 실제로 막았다(공허 통과 방지)').toBeGreaterThan(0);
   await expect(page.locator('#scene-era')).toHaveAttribute('data-empty', 'true');
```

## 2. 볼 것 8가지 — 확인 결과

**1. `eraOf` 고르기 (문제 없음)**
- `src/core/eraWindow.ts#stepPick`(155-179행)은 10-1절 순서를 지킨다.
  - ① `seen`(자기 구간 band 사건 + band 없는 사건)에서 `sameBand`를 `pickEvent`로 먼저 고른다.
  - ② 없으면 `plainEvents`를 고른다. 지역 사건 먼저, 각각 무거운 쪽 먼저(`heavyFirst`)다.
  - ③ 사건이 없으면 `dailyPick`이다.
  - 가운데 구간은 `band`가 `'low'|'high'`뿐이라 `sameBand`가 늘 비어 band 사건을 보지 않는다.
  - 가리기는 `chosenEvent.heavy`일 때 `seen` 안의 무겁지 않은 사건 → 없으면 `dailyPick(calm)`이다. 1987년 규칙이 그대로이고, 아래·가운데의 2009는 `seen`에 무겁지 않은 사건이 없어 일상으로 간다.
- 경계: `ERA_BAND_RULES = { lowMaxWealth: 2, highMinWealth: 4 }`(`src/data/sceneTables.ts:180`)로 1·2는 아래, 3은 가운데, 4·5는 위다. `bandOfWealth` 시험(eraWindows.test.ts:373-377)과 재력별 고정 시험(540-560행)이 잠근다.
- 글자: 줄 글 셋이 승인 표기(10-1절 표)와 한 글자까지 같다. 시험 82-84행, 542-546행이 문자열로 단언한다. 22자 상한은 모두 통과한다.
- 합성 시험(492-537행)은 ①→②→③ 우선, 다른 구간 band 사건이 안 보임, 가운데가 band 사건을 못 봄, 가리기 셋을 덮고, 일상 후보를 한 해짜리로 만들어 3해 연속 규칙이 끼지 않게 했다. 합성 3 + 실제 3이 공허하지 않다.
- LifeScreen:321과 SceneCard:144~145가 둘 다 `bandOfWealth(parentWealth)`로 같은 구간을 쓴다. 칸의 그림과 인생 기록 줄이 어긋나지 않는다.

**2. `scripts/genEraWindows.ts` (문제 없음)**
- 장수 가드는 `rows.length !== approvedCount`(145행)가 r3 16, r4 27, r5 40(필터 뒤), r5b 11에서 각각 던진다. 합 94(170행)와 id 유일성(171행)도 있다.
- r5b가 다시 그린 9장의 r5판은 `redrawn`(134행, r5b 행 id)으로 r5에서 걸러지고 `dropped !== 9`(141행)가 정확히 9인지 단언한다. id 유일성이 이중으로 막는다.
- 2009 세 갈래 단언(173-176행)은 band 유무와 값을 모두 본다.
- `TRIM` 1998 `[1998, 1998]`이 맞다. r3 행의 원래 범위가 `[1997, 1998]`이어서 1997에는 새벽 인력시장만 남는다. `eraWindows.test.ts:107-116`이 잠근다.
- `hCode`는 사건에만 싣는다(157행).
- 예산 시험은 공허하지 않다.
  - 묶음 ≤ 24KB: 9개 덩어리 각각 gzip 실측이다. 2000년대 21,882B로 약 2.6KB 남는다.
  - 누적 ≤ 230KB, 한 번에 받는 양 ≤ 75KB: 실측이다.
  - 한 장 크기: 상한을 어기는 장과 `over` 목록을 정확히 둘(1980 금남로·2009 철거 현장)로 `toEqual`한다.
- `gen:era -- --check`는 `npm test`에 들어 있지 않다. 지난 회차부터 그렇다. 이번에 새로 생긴 구멍은 아니다.

**3. 저장·난수·스탯 불변 (문제 없음)**
- `src/core/index.ts` 외에 `scene.ts`·`eraWindow.ts`를 import하는 코어 모듈이 없다. `life.ts#stepYear` 쪽은 시대의 창에 닿지 않는다.
- `eraOf`는 `famHash01`(상태 없는 해시)만 쓴다. `Math.random`·`Date`·저장이 없다.
- 그래서 `rngSnapshot`·`familyHash`·`life-golden`은 구조상 불변이다. CR-RNG·CR-CORE·CR-SAVE를 어기지 않는다.
- 초가: `src/core/scene.ts:388-390`이 단독 · 시골/해안 · 재력 ≤ 2 · ~1975일 때 h1로 가는 조건이다. 설계 9-4절 ③과 같다. 규칙값은 `SCENE_RULES.thatch`에 있다(CR-DATA).
- 골든 두 칸은 `bg-coast-b2`와 `bg-rural-b2`(1970~99 배경), `house-detached-h1×0.86(thatch)`다. 1970~75의 저재력 시골·해안 단독집이 맞다.
- `sceneOf.test.ts:265-288`이 1970·1975는 초가, 1976·재력 3·도시·셋방은 그대로임을 단언한다.

**4. 작업자가 고친 시험**
- LR2 8배속 → R-571. 원인 설명은 맞고 넓힌 기준은 수용 가능하다.
- R-444 한도 16 → 60 (문제 없음): 「다음 결정으로」가 여러 해를 건너뛰고, 해마다 시대 줄(약 70px)이 위에 쌓이면 보정으로 `scrollTop`이 그만큼 커진다. ArrowUp은 한 번에 40px이라 종전 16번(640px)이면 모자란다. 루프 뒤에 「알약이 저절로 사라졌는가」·「scrollTop ≤ 24」·「포커스가 목록」·「`scrollY` 불변」을 단언하므로 한도가 모자라면 실패한다.
- LR1 (문제 없음): 접근성 트리 항목 수를 `history.length + 시대 줄 수`로 보고, 읽기 순서는 시대 줄을 뺀 줄로 본다. 시대 줄 순서는 `tests/logOrder.test.tsx`가 잠근다.
- `gentle.spec.ts` (문제 없음): `histVeiled`는 알파 평생의 2016·2017·2022 시대 줄을 뺀다. 시대 줄의 가림·펼침·꺼짐은 `family-scene.spec.ts:336-352`가 따로 단언하고, 「끄면 `[data-veiled]` 0」(93행)은 시대 줄까지 포함해 그대로 있다.
- `family-scene.spec.ts` 빈 틀 시험 → R-572. 덩어리 실패 빈 틀로 바꾼 것 자체는 맞다.
- `e2e-prod/initial-load.spec.ts` (문제 없음): 정규식 `^d(19[4-9]|20[0-2])0-`는 1940~2020년대 아홉만 통과시킨다.

**5. 글꼴 s2·s3 (문제 없음)**
- `scripts/buildFamilyFonts.mjs`는 s0·s0b·s1을 읽기만 하고 s2·s3의 woff2와 unicode-range만 쓴다. 첫 화면 글꼴은 불변이다. 코드 구조상 확인했고 바이트 대조는 못 했다.
- `tests/fonts.test.tsx:129-149`는 `src/**`·`index.html` 전체의 글자가 두 굵기 모두 s0∪s0b∪s1∪s2에 있는지(`files > 100`으로 공허 방지), s3에는 게임 글자가 없는지를 단언한다. 새 줄 글자(퓨·탑·볶·룸·빽)를 덮는다.

**6. R-553 (문제 없음)**
- `src/styles/family.css:84-88`, 1960 라이트(65행), 1960 다크 두 블록(73·79행)이 9-4절과 글자까지 같다. `tests/sceneAssets.test.ts:270-273`이 세 값을 정확한 문자열로 잠근다.

**7. R-567·R-568·R-569·TODO (문제 없음)**
- `tests/rngSnapshot.test.ts:19`, `tests/familyRemeasure.test.ts`, `docs/data/family-model.md`는 REV-009-FM4b-2의 diff와 글자가 같다. R-568 시험은 5단계 표본에서 통과했다(값을 맞추지 않았다).
- TODO `[x]` 근거(457·460·462·463·469행)를 표본 대조했고 실재한다.

**8. FT3 r4 가드 (문제 없음)**
- 새 줄 글 `d1990.ts`~`d2020.ts`를 훑었다. 평가어·인명·정당·사상자 수·원인·책임 표현이 없다.
- 접근 이름은 `시대의 창 · {줄}. 그해 기록으로` 한 가지다. 그림 마크업에 `<text>`·`<style>`·`style=`·`on*` 금지(eraWindows.test.ts:145)와 class 허용 목록 검사가 94장 전부에 걸린다.

## 3. 후속(TODO로 넘김) — 모두 낮음
- R-570 sceneGolden 머리 주석에 이번 갱신 사유를 적는다
- R-571 LogList 반올림 오차 누적 제거 + LR2 8배속 기준 되돌림 (선택. 실패하면 철회하고 넓힌 기준을 유지)
- R-572 빈 틀 e2e의 막힘 확인

## 4. QA에 넘길 것
- 시대의 창 화면: 360 띠 바탕(라이트·다크), 1960년대 칸 밝기, 2009 세 갈래(재력 1·2 / 3 / 4·5)와 가리기 켠 아래·가운데, 인생 기록의 해당 시대 줄.
- 초가: 시골·해안 재력 1·2의 1970~75 집, 1976년부터 h2.
- LR2: 8배속 중 아래에서 읽는 줄이 슬며시 내려가는지(미래 해 판). R-571을 적용했다면 그 diff 뒤에 Chromium desktop·mobile-360과 WebKit LR2를 다시 돌린다.
- FM4b 공격 항목(REV-009-FM4b-2 「QA에 넘길 것」)은 그대로다. QA는 src 변경이 끝난 뒤에 시작한다.

위험도: Two-way / 파급 낮음 (R-570은 시험 주석, R-572는 e2e 단언 추가다. R-571은 읽기 위치 보정만 바꾸고 저장·난수·스탯에 닿지 않는다. 저장 구조·공개 데이터 변경 없음)

## 마스터 처리 (2026-11-02)
- APPROVED 수용. R-570·R-571·R-572 셋 다 QA 전에 반영한다 — R-571은 src 변경이라 QA보다 먼저여야 하고, 시험 기준을 넓혀 두기보다 원인을 없애는 쪽이 낫다. 적용 뒤 시험이 통과하지 못하면 검수 문서대로 R-571을 철회하고 넓힌 기준을 유지한다.

## 반영 내역 (developer, 2026-11-02 — 커밋은 마스터)
| 지적 | 처리 | 고친 곳 |
|---|---|---|
| R-570 | diff 그대로 적용 | `tests/sceneGolden.test.ts` 머리 주석 「시대의 창 r5 반영 갱신」 |
| R-572 | diff 그대로 적용. e2e/family-scene Chromium desktop·mobile-360에서 통과 | `e2e/family-scene.spec.ts` "시대의 창 덩어리를 받지 못한 판(2016년, 2010년대 덩어리 요청 차단)의 창은 빈 틀이다" (`blocked` 카운터 + `expect.poll`) |
| R-571 | diff 둘 그대로 적용(마스터 결정 2026-11-02). 처음 적용했을 때 `npm test`의 `tests/logOrder.test.tsx:386` 소스 문장 정규식(보정 뒤 호출 `this.remember(rows);` 요구) 1개가 깨져 마스터 지시대로 한 번 되돌렸다가, 마스터가 `rememberKept`가 안에서 `remember`를 부르므로 시험의 뜻은 그대로라고 결정해 정규식을 `this.remember(?:Kept)?([^)]*);`로 고치고 다시 적용했다. 검증: `e2e/log-order` Chromium desktop·mobile-360 56개(기준 2px) 통과, WebKit LR2 8개 통과, 8배속 Chromium 3회 반복 통과, `tests/logOrder.test.tsx` 35개 통과 | `src/ui/dash/LogList.tsx`(`rememberKept`, `getSnapshotBeforeUpdate`, `componentDidUpdate` 두 곳), `e2e/log-order.spec.ts`(8배속 기준 2px), `tests/logOrder.test.tsx` 386행 정규식. 경과: `ai-log/2026-11-02_SPEC-009_dev-era-r5-followup.md` |


- 같은 회차 마스터 요청(2026-11-02): `e2e/family-scene.spec.ts`의 흔들리던 시험 셋(「배치(FM2d)」·「해가 바뀌면 그림과 연도 표가 바뀐다」·FH9)을 원인별 기다림으로 고쳤다 — 리뷰 지적과는 별개이고 상세는 ai-log 같은 파일 3절.