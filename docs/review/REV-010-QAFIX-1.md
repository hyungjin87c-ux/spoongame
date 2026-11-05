# REV-010-QAFIX-1 — 1회차 / 5 (표준 레인, 대상: `7d4e240` · `5c218d6`)

판정: APPROVED

- 높음·중간 지적은 0건이다. 낮음 4건(R-614~R-617)은 「후속」이다.
- 검수 방식
  - 검수자는 읽기 전용이라 `git diff`·`npm test`·`gen:era -- --check`를 돌리지 못했다.
  - 변경 뒤 파일을 직접 읽고, 근거 칸 정정 전부를 생성 데이터 `d2020~d2100.ts`에서 문구 단위로 대조했다.
  - 시험 통과 수는 작업자 ai-log를 믿었다.
- 배경: `qa/reports/QA-009-FM6-010.md` F1, `ai-log/2026-11-05_SPEC-010_dev-qa-f1.md`, `docs/data/future-foresight-check.md` 4절.

## 점검 결과 (요약)

### 1. 시험 도구 (`e2e/focusObscured.ts`, `e2e/m4-focus.spec.ts`, `e2e/m7c-note.spec.ts`)

**`mayVanish`**
- 붙든 요소가 문서에서 떨어졌을 때만 면제한다(`isDetached`).
- 사라지지 않았는데 닿지 못했으면 위반으로 남는다.
- 앱이 요소를 새로 끼워 넣은 경우는 거르지 못한다(R-614).

**`restore`**
- `violations`를 건드리지 않는다. 순회 직전에 상태만 되돌리고, 그 순회의 목록을 새로 만들어 대조한다.
- 위반을 덮는 경로는 없다.

**`unreachedOf`**
- 마지막 `listStableTabbables` 목록과 같은 시점에 읽는다.
- 색인이 어긋나는 경로는 없다.

**알약 시험 단언 교체 — 타당하다**
- 앞으로(Tab): `forward`에 `log-jump`가 들어 있고, 위치가 `log-list` 바로 다음이다. 위반 0도 함께 단언한다.
- 뒤로(Shift+Tab): 첫 「근거 보기」 단추에 `preventScroll` focus() → Shift+Tab → `toBeFocused` → `sampleFocus` 판정. 알약에 키보드로 닿는 것과 가려지지 않는 것을 둘 다 증명한다.
- 엄격하다: 첫 단추 앞에 다른 정지점이 있으면 시험이 실패하지, 통과하지 않는다.
- 원인 B의 회귀 방지선은 유지된다. 알약이 떠 있을 때 「근거 보기」 단추를 거슬러 오르는 경로는 Shift+Tab 순회가 그대로 잰다.

**`listStableTabbables`**
- 15초 안에 안정되지 않으면 마지막 목록으로 순회한다.
- 목록이 어긋나면 위반으로 보고되므로 실패를 숨기는 경로는 없다.

**`pendingRequests`**
- 설치된 Playwright 1.64.0에 필요한 API가 있다. try/catch는 안전망이다.

**`m7c-note` 한도 90초**
- 한도만 바꿨고 단언은 그대로다.

### 2. 앱 수정 `syncJumpPad` (`src/ui/dash/LogList.tsx`, `src/styles/dash.css`)

**측정 시점**
- `componentDidMount`·`componentDidUpdate`에서 잰다(알약이 나타나고 사라질 때, 개수가 바뀔 때).
- 알약 `ResizeObserver`가 글자 크기나 폭이 바뀌어 줄바꿈이 달라질 때 다시 잰다.

**정리**
- `componentWillUnmount`에서 `disconnect`한다.
- 알약이 없으면 `removeProperty`로 변수를 지운다.
- 기준은 `var(--log-jump-bottom, 0px) + 12px`라, 변수를 지우면 정확히 12px이 된다.

**레이아웃 읽기**
- 매 스크롤·매 프레임 경로는 없다.
- 알약이 있는 동안 다시 그릴 때마다 `getBoundingClientRect`를 두 번 부른다. 8배속에서도 비용은 무시할 수준이다.

**되먹임 없음**
- 변수는 `scroll-padding`만 바꾼다.
- R-439 읽던 자리 보정은 `scrollTo`만 쓰므로 영향이 없다.

**CSS 우선순위와 대체**
- `:has(.log__jump:focus)`의 특이도는 (0,3,0)이라 알약 포커스 동안 항상 12px로 되돌린다.
- `@supports selector(:has(*))` 밖의 브라우저는 옛 동작(12px)으로 안전하게 떨어진다.

**`src` 위생**
- 사용자 폴더 경로·외부 URL은 없다.

**새 시험 「R-438 위 여백」**
- 알약 있음·없음·포커스·사라짐을 단언한다.
- 폭 320·글자 200%에서 「60px 초과」를 걸어 공허한 통과를 막는다.

### 3. 근거 칸 정정

**보고서 4-1 반영**
- 높음 1건(U23 gap)과 중간 8건이 모두 반영됐다.
  - U04 요약 + 「기사의 서술」 gap
  - U05 「관측 이래」 삭제
  - U13 「현 추세」
  - U08 『The 2025 AI Index Report』
  - 통계청 5곳 「장래인구추계 : 2022~2072년」
  - U35 「ChatGPT 출시 2년 뒤」
  - U40 「구조적 방어와 적응 능력이 큰 곳」(who 유지)
- 낮음도 대부분 반영됐다(주소 이동 갱신 7건 제외 — R-616).

**FU11 규칙**
- 직접 인용부호 0건, 정치인 0건.
- 「보도 기준」을 유지했고, 해 차이는 gap에 적혀 있다.
- 금지 공포어는 근거 글에 없다. 「기후위기」는 기상청 보고서의 실제 제목이고, 금지어 시험은 기록 줄에만 걸린다.

**U29 「칼럼」→「기고」**
- 뜻이 틀어지지 않았으므로 수용한다.

**재생성 데이터**
- 바뀐 문구가 모두 해당 `d20xx.ts`에 들어 있고, 옛 문구는 `src`에 남지 않았다.
- U23·U04·U40은 생성기 표와 글자 단위로 같다.

### 4. TODO
- 「출시 전 주소 대조」 `[x]` 줄(482행)에 적힌 근거 파일·시험이 실제로 있다.
- 새 `[ ]` 줄(483행)도 있다.

## 지적 (모두 낮음)

### R-614 [CR-TEST|NEW] [낮음] `e2e/focusObscured.ts:389-398·466-470`

**문제**
- `mayVanish` 면제 조건이 「붙든 옛 요소가 문서에서 떨어졌다」 하나뿐이다.
- 그래서 앱이 알약을 새로 끼워 넣어도(옛 요소는 떨어지고 새 알약은 문서에 있음) 면제된다.
- 지금 시험에서는 알약이 다시 만들어지지 않아 영향이 없다.

```diff
--- a/e2e/focusObscured.ts
+++ b/e2e/focusObscured.ts
@@ -386,13 +386,18 @@
     for (const v of s.judgement.violations) violations.push(`[${label}] ${path} ${n + 1}번째(scrollY ${s.scrollY}): ${v}`);
   });
 };
-  /** 순회가 닿지 못한 조작 요소. `mayVanish`에 든 요소는 지금 문서에서 실제로 사라졌을 때만 뺀다 */
+  /**
+   * `mayVanish`에 든 요소가 **정말 사라졌는가**: 붙든 요소가 문서에서 떨어졌고, 같은 이름(data-testid)의 요소가 지금 문서에 하나도 없다.
+   * 앱이 요소를 새로 끼워 넣었다면(옛 요소만 떨어지고 새 것이 문서에 있다) 사라진 것이 아니므로 면제하지 않는다.
+   */
+  const vanished = async (id: string, index: number): Promise<boolean> => mayVanish.has(id) && (await isDetached(page, index)) && (await page.getByTestId(id).count()) === 0;
+  /** 순회가 닿지 못한 조작 요소. `mayVanish`에 든 요소는 `vanished`일 때만 뺀다 */
   const unreachedOf = async (list: string[], reached: Set<string>): Promise<string[]> => {
     const out: string[] = [];
     for (const id of [...new Set(list)]) {
       if (reached.has(id)) continue;
-      if (mayVanish.has(id) && (await isDetached(page, list.indexOf(id)))) continue;
+      if (await vanished(id, list.indexOf(id))) continue;
       out.push(id);
     }
     return out;
@@ -465,7 +470,7 @@
     if (result === 'gone') {
       // 앞서 건 focus()가 앱 쪽 변화를 일으켜 이 요소를 없앴다 — 허용 목록에 없으면 위반(조용히 건너뛰지 않는다)
-      if (!mayVanish.has(focusList[i])) violations.push(`[${label}] focus() ${i + 1}번째: ${focusList[i]}이(가) 문서에서 사라져 focus()를 걸 수 없다`);
+      if (!(await vanished(focusList[i], i))) violations.push(`[${label}] focus() ${i + 1}번째: ${focusList[i]}이(가) 문서에서 사라져 focus()를 걸 수 없다`);
       continue;
     }
```

### R-615 [CR-TEST|NEW] [낮음] `e2e/m4-focus.spec.ts:254` 알약 시험

**문제**
- 프로그램 focus() 순회에서 `mayVanish`가 「알약이 사라졌으면 건너뛴다」로 작동한다.
- 그래서 그 순회에서 알약을 한 번도 재지 않았어도 통과한다.
- 알약은 첫 「근거 보기」 단추보다 앞 정지점이라, 그 칸에서는 떠 있어야 한다.

**적용 뒤 확인**
- 이 단언을 넣은 뒤 8조합이 통과하지 않으면 단언을 빼지 말고 마스터에게 보고한다.

```diff
--- a/e2e/m4-focus.spec.ts
+++ b/e2e/m4-focus.spec.ts
@@ -253,6 +253,8 @@
         });
         expect(audit.violations, summarize(audit)).toEqual([]);
+        // mayVanish(알약은 순회 도중 사라져도 된다)가 「프로그램 focus()로 알약을 재는 일」까지 건너뛰게 두지 않는다 — 알약은 첫 「근거 보기」 단추보다 앞이라 그 칸에서는 아직 떠 있다
+        expect(audit.programmatic.map((s) => s.id), '프로그램 focus()로 알약을 쟀다').toContain('log-jump');
         for (const id of ['pause', 'skip', 'auto', 'tool-exit', 'log-list', 'log-jump']) {
```

### R-616 [NEW] [낮음] 문서·TODO 문구 정확성

**문제**
- 조사 문서 8절 첫 항목과 TODO 482행은 낮음을 「전부」 반영했다고 적었다.
- 그런데 「주소 이동 갱신」 7건은 새 전체 주소를 확인하지 못해 메모만 있고, 추적하는 `[ ]` 줄도 없다.

```diff
--- a/docs/data/future-foresight-quotes.md
+++ b/docs/data/future-foresight-quotes.md
@@ -249 @@
-… 보고서 4-1·4-2의 고칠 것 목록대로 고쳤다(높음 1 · 중간 전부 · 낮음 전부, 번호는 SPEC-010 번호). …
+… 보고서 4-1·4-2의 고칠 것 목록대로 고쳤다(높음 1 · 중간 전부 · 낮음은 「주소 이동 갱신」 7건만 빼고 전부 — 아래 메모, 번호는 SPEC-010 번호). …
```

**지시** (`docs/TODO.md`)
- 482행: 「(보고서 4-1·4-2: 높음 1 · 중간 전부 · 낮음 전부, 마스터 조정 …)」를 아래로 바꾼다.
  - 「(보고서 4-1·4-2: 높음 1 · 중간 전부 · 낮음은 주소 이동 갱신 7건만 빼고 전부(새 전체 주소 미확인 — 483행), 마스터 조정 …)」
- 483행: 끝의 「열 수 있게 되면 다시 대조한다. 배포 차단 아님(마스터 2026-11-05)」 앞에 아래를 덧붙인다.
  - 「 · 주소가 옮겨 가 새 전체 주소를 확인하지 못한 7건(코리아타임스·국립학술원·케임브리지·포천 힌턴·CBS 허사비스/Salon·darioamodei.com·earth.com — 조사 문서 8절)의 표 주소 칸 갱신」

### R-617 [NEW] [낮음] `scripts/eraForesightNotes.ts` U40 `work` (`era-2095-high-seawall-city-lit` 둘째 근거)

**문제**
- 칸은 「…논문 보도(earth.com)」라고 매체를 적었다.
- 그런데 고친 요약은 Down To Earth(2025-09-29)에서 확인한 문장이고, earth.com은 열지 못했다.
- 「보도 기준」 표시와 조사 문서 행이 이 차이를 드러내므로 틀리지는 않는다.

**지시**
- 483행 미해결 줄에 「U40 earth.com」을 함께 적는다.
- 출시 전에 earth.com을 열 수 있으면 지금대로 둔다.
- 열 수 없으면 칸의 매체 이름을 「Down To Earth」로 바꾸고, 조사 문서 N40 행도 함께 맞춘다. 같은 회차에 `gen:era`로 다시 만든다.

## QA에 넘길 것

1. **WebKit에서 `:has()` 규칙 (필수)**
   - 알약에 포커스가 있는 동안 위 여백이 12px로 되돌아가는지. Tab·Shift+Tab·클릭 세 경로로 본다.
   - 알약이 떠 있을 때 Shift+Tab으로 「근거 보기」 단추를 거슬러 올라도 단추가 가려지지 않는지.
   - `log-order.spec.ts`의 「R-438 위 여백」과 R-439 글자 크기 시험.
2. 8배속 자동 진행 중 알약이 뜬 채일 때 프레임(P-F15 방식).
3. 짧은 화면(320×256·zoom 400) + 글자 200% + 알약에서 포커스 스크롤이 튀는지. 관찰만 한다.
4. 「시대의 창」 칸에서 `#log-y…` 줄로 이동할 때 알약이 떠 있으면, 그 줄이 알약 아래에 맞는지.
5. 근거 칸 눈 확인: U04·U23·U29(「기고」)·U40 문구를 글자 200%·폭 360에서 본다.

위험도: Two-way / 파급 낮음 — 시험 도구, CSS·UI 변수(세이브 구조와 무관), 근거 칸 글(`gen:era`로 재생성 가능)만 바꿨다.

## 마스터 처리 (2026-11-06)

**APPROVED.**
- 낮음 4건은 TODO로 넘기지 않고 이번에 바로 반영한다. R-611~R-613 때와 같은 방식이다. 4건 모두 작업자가 손으로 적용한다.
  - R-614·R-615: 시험만 바뀌고 diff가 작다.
  - R-616: 문구만 바뀐다.
  - R-617: TODO 483행에 적는 것만이다. 매체 이름을 바꾸는 일은 다음 주소 대조로 미룬다.
- 다음 검수 회차는 열지 않는다.
- R-615를 적용한 뒤 알약 8조합이 실패하면 단언은 빼지 않는다. 마스터가 원인을 판단한다.
- 그 뒤 QA를 다시 돌린다. QA 범위:
  - 실패 스펙 5개
  - 알약 8조합
  - WebKit `:has()`
  - 위 「QA에 넘길 것」 1~5
- 다음 지적 ID: R-618.
