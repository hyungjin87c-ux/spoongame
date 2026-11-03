# REV-010-CORE-1 (SPEC-010 코어 FU1·FU2·FU7·FU8)

1회차 / 5 · 정밀 레인 · 대상 `spec-009` bf51dd5

판정: CHANGES_REQUESTED

높음 0 · 중간 3(R-596, R-597, R-598) · 낮음 9(R-599~R-607).

**코드(`eraWindow.ts`)에서는 고칠 것을 찾지 못했다. 중간 3건은 모두 시험의 구멍이다.** FU5에서 데이터가 들어올 때 이 시험들이 잡아야 할 것을 놓치므로 지금 닫는다. 2회차는 diff 적용 여부와 시험 통과만 보면 된다.

검수자는 읽기 전용이라 시험을 직접 돌리지 않았다. 변이 수치와 전체 시험 수치는 작업자 기록의 값이고, 아래 판단은 코드를 읽어 따진 것이다.

## 지적

### R-596 [CR-TEST] [중간] tests/eraFuture.test.ts:491-498 — 실제 데이터와 표의 대조가 어긋난 줄을 건너뛴다

줄 글자로 표를 찾고, 못 찾으면 `continue`한다. 그래서 다음을 모두 조용히 통과한다.
- 오타가 나거나 승인 없이 바꾼 줄
- 표에 없는 장면
- 표에 있는데 데이터에서 빠진 장면

`tests/helpers/eraFutureData.ts:9`의 「표 대조가 어긋남을 잡는다」는 설명과도 다르다. FU5의 「줄 문장과 basis는 표를 그대로 옮긴다」를 지키는 시험이 없는 셈이다. 나라 이름 규칙도 합성 표에만 걸려 있어(113행) 실제 줄에는 이 대조가 유일한 안전장치다.

```diff
--- a/tests/eraFuture.test.ts
+++ b/tests/eraFuture.test.ts
@@
-  it('합성 표와 대조: 실제 장면의 줄이 표(U01~U44)에 있으면 해·종류·구간·무거움·basis가 표와 같다', () => {
+  it('합성 표와 대조: 실제 2026년 이후 장면의 줄은 모두 표(U01~U44)에 있고 해·종류·구간·무거움·basis가 같다 · 재는 해의 표 줄은 실제 데이터에도 있다', () => {
     const byLine = new Map(FUTURE_TABLE.map((w) => [w.line, w]));
     for (const w of REAL_FUTURE_WINDOWS) {
       const t = byLine.get(w.line);
-      if (t === undefined) continue; // 승인 과정에서 다듬은 문장은 형진 님 승인 뒤 표를 고친다
+      expect(t, `${w.id} 「${w.line}」: 표에 없는 줄이다 — 문장을 바꿨으면 형진 님 승인 뒤 SPEC과 표를 먼저 고친다`).toBeDefined();
+      if (t === undefined) continue;
       expect({ years: w.years, kind: w.kind, band: w.band, heavy: w.heavy, basis: w.basis }, `${w.id} ↔ ${t.id}`).toEqual({ years: t.years, kind: t.kind, band: t.band, heavy: t.heavy, basis: t.basis });
     }
+    const realLines = new Set(REAL_FUTURE_WINDOWS.map((w) => w.line));
+    for (const t of FUTURE_TABLE) {
+      if (realCovered(t.years[0])) expect(realLines.has(t.line), `${t.id} 「${t.line}」: 재는 해인데 실제 데이터에 없다`).toBe(true);
+    }
   });
```

### R-597 [CR-TEST] [중간] tests/eraFuture.test.ts:54-79 — 「합성 표가 SPEC 표와 같다」는 묶음이 SPEC을 읽지 않는다

이 묶음은 합성 표 안에서 장수와 수만 센다. 문서가 바뀌어도 시험은 모른다. 실제로 U09·U10 승인 문구가 문서와 어긋났고, 지금 사람이 손으로 맞추고 있다. U01~U44의 줄·해·구간·무거움·basis는 내가 문서와 한 줄씩 대조했고, U09·U10 말고는 같았다.

**적용 순서:** U09·U10 줄을 고치는 다른 작업이 끝난 뒤에 넣는다. 먼저 넣으면 그 두 줄에서 실패한다. 실패가 맞는 동작이다.

```diff
--- a/tests/eraFuture.test.ts
+++ b/tests/eraFuture.test.ts
@@
   it('2030~2100년대는 10년마다 band도 ages도 없는 일상이 2장 이상이다(나이 규칙의 데이터 조건 — 구현 규칙 2·6)', () => {
@@
       expect(plain.length, `${decade}년대`).toBeGreaterThanOrEqual(2);
     }
   });
+  it('표의 줄·해·구간·무거움·basis가 SPEC-010 문서의 연표 표 원문과 같다 — 복사본끼리 견주지 않고 문서를 직접 읽는다', () => {
+    const docs = import.meta.glob('../docs/spec/SPEC-010-*.md', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;
+    const spec = Object.values(docs)[0];
+    const rows = [...spec.matchAll(/^\| (U\d\d) \|([^|]+)\|([^|]+)\|[^|]+\|([^|]+)\|\s*$/gm)];
+    expect(rows.map((m) => m[1])).toEqual(Array.from({ length: 44 }, (_, i) => `U${String(i + 1).padStart(2, '0')}`));
+    const LABEL: Record<string, string> = { '공식 전망 바탕': 'official', '전문가 전망 바탕': 'expert', '가상 시나리오': 'scenario' };
+    for (const [, id, when, lineCol, basisCol] of rows) {
+      const w = futureById(id === 'U44' ? 'era-end-horizon' : id);
+      expect(w.line, id).toBe(/「([^」]+)」/.exec(lineCol)![1]);
+      expect(w.years[0], id).toBe(Number(when.trim().slice(0, 4)));
+      expect(w.band, id).toBe(/· 부유한 쪽/.test(when) ? 'high' : /· 어려운 쪽( 먼저)?\s*$/.test(when) ? 'low' : undefined);
+      expect(w.heavy, id).toBe(lineCol.includes('○'));
+      const shown = /→ (공식 전망 바탕|전문가 전망 바탕|가상 시나리오)/.exec(basisCol);
+      expect(w.basis, id).toBe(shown === null ? undefined : LABEL[shown[1]]);
+    }
+  });
 });
```

### R-598 [CR-TEST] [중간] tests/helpers/eraFutureForbidden.ts:37-53 — 첫머리 견주기는 합성어 동사를 통째로 놓친다

작업자 판단대로 하면 U23은 살지만, 낱말 첫머리만 보기 때문에 다음이 모두 통과한다.
- 「일터로 나갔습니다」 「병원에 들어갔습니다」
- 「버스를 갈아탔습니다」
- 「돌려받았습니다」 「치료받았습니다」
- 「사먹었습니다」

전부 주인공 행동으로 읽히는 전형적인 문장이다. U23 하나를 살리려고 여덟 어간 전체를 약하게 만들었다.

**더 나은 방법:** 어디에 있든 걸되, 사람이 확인한 줄만 문장 통째로 풀어 준다. U23 문장은 바꾸지 않아도 된다. 지금 44줄에서 부분 일치에 걸리는 것은 U23 하나뿐이다(대조함). 앞으로 「숲이 불탔습니다」 같은 줄이 오면 시험이 멈추고 사람이 판단하게 된다.

```diff
--- a/tests/helpers/eraFutureForbidden.ts
+++ b/tests/helpers/eraFutureForbidden.ts
@@
- * 견주는 방식: 동사 어간 여덟은 **낱말의 첫머리**에서만 본다 — 「물류센터로 갔습니다」(낱말 「갔습니다」)는 걸리고 「올라갔습니다」(U23, 주어가 재배지라는 사물)는 걸리지 않는다. 「출근」·「퇴근」은 낱말 어디에 있든 건다.
+ * 견주는 방식: 낱말 **어디에 있든** 건다 — 「나갔습니다」·「갈아탔습니다」·「돌려받았습니다」 같은 합성어도 걸린다. 주어가 사물이라 사람이 확인한 줄만 문장 통째로 `ACTION_ALLOW_LINES`에 적어 풀어 준다(U23 「올라갔습니다」, 주어는 재배지).
@@
 export const ACTION_ANYWHERE: readonly string[] = ['출근', '퇴근'];
+/** 어간이 들어 있지만 주어가 사회·사물임을 사람이 확인한 줄 (문장 통째로 견준다 — 새 줄은 시험이 멈춰 세우고 사람이 판단한다) */
+export const ACTION_ALLOW_LINES: ReadonlySet<string> = new Set(['사과 재배지가 북쪽으로 올라갔습니다.']); // U23
 
 /** 줄 하나에서 걸리는 주인공 행동 낱말 (없으면 빈 목록) */
 export function actionWordsIn(line: string): string[] {
+  if (ACTION_ALLOW_LINES.has(line)) return [];
   const hits: string[] = [];
   for (const token of line.split(/\s+/)) {
-    for (const stem of ACTION_STEMS) if (token.startsWith(stem)) hits.push(token);
-    for (const w of ACTION_ANYWHERE) if (token.includes(w)) hits.push(token);
+    for (const w of [...ACTION_STEMS, ...ACTION_ANYWHERE]) if (token.includes(w)) hits.push(token);
   }
   return hits;
 }
--- a/tests/eraFuture.test.ts
+++ b/tests/eraFuture.test.ts
@@
-import { ACTION_ANYWHERE, ACTION_STEMS, COMPANY_NAMES_EXTRA, COMPANY_NAMES_FROM_DOC, COUNTRY_NAMES, actionWordsIn, lineViolations } from './helpers/eraFutureForbidden';
+import { ACTION_ALLOW_LINES, ACTION_ANYWHERE, ACTION_STEMS, COMPANY_NAMES_EXTRA, COMPANY_NAMES_FROM_DOC, COUNTRY_NAMES, actionWordsIn, lineViolations } from './helpers/eraFutureForbidden';
@@
-  it('주인공 행동 낱말(2027년 이후): 목록은 마스터 지정 그대로이고, 사건·일상 줄 모두 0이다 — 낱말 첫머리 견주기라 「올라갔습니다」(U23)는 걸리지 않는다', () => {
+  it('주인공 행동 낱말(2027년 이후): 목록은 마스터 지정 그대로이고, 사건·일상 줄 모두 0이다 — 낱말 어디에 있든 걸고, 사람이 확인한 U23 한 줄만 문장 통째로 풀어 준다', () => {
     expect([...ACTION_STEMS, ...ACTION_ANYWHERE].join('|')).toBe('갔|탔|샀|받았|일했|배웠|먹었|마셨|출근|퇴근');
+    expect([...ACTION_ALLOW_LINES]).toEqual([futureById('U23').line]);
+    for (const line of ['일터로 나갔습니다.', '병원에 들어갔습니다.', '버스를 갈아탔습니다.', '월급을 돌려받았습니다.', '라면을 사먹었습니다.']) expect(actionWordsIn(line).length, line).toBe(1);
```

### R-599 [CR-TEST] [낮음] tests/eraFuture.test.ts:474 — 묶음 C가 들어오면 실제 3해 연속 시험이 거짓으로 실패한다

100세까지 걸어가므로 2110·2111·2112의 끝 장면(일부러 같은 그림이고 `realCovered`도 참)을 3연속으로 센다. 합성 시험(172행)은 이미 2109에서 끊는다.

```diff
--- a/tests/eraFuture.test.ts
+++ b/tests/eraFuture.test.ts
@@
-      const picks = picksOf(REAL_WINDOWS, birth, 100, { seed, band }).map((id, i) => (id !== undefined && (birth + i <= 2025 || ok.has(birth + i)) ? id : undefined));
+      const picks = picksOf(REAL_WINDOWS, birth, ERA_LAST_YEAR - birth, { seed, band }).map((id, i) => (id !== undefined && (birth + i <= 2025 || ok.has(birth + i)) ? id : undefined)); // 표 끝(2110~)의 끝 장면은 일부러 같은 그림이다
```

### R-600 [CR-TEST] [낮음] tests/eraFuture.test.ts:518-525 — 「다 들어왔는가」를 재는 시험이 없다

실제 데이터 시험은 모두 「들어온 해만」 잰다. 어느 10년대가 통째로 빠져도 전부 초록이다. 부분 배포를 하지 않기로 했지만(M3) 이를 강제하는 곳은 없고, 완료 기준 1도 비어 있다. 518행의 「상태」 시험은 내용상 항상 참이고 `console.log`만 남긴다.

지시: FU5 마지막 묶음(C) 회차에 이 시험을 `expect(REAL_COVERED_FUTURE_YEARS.length).toBe(87)`과 `expect(REAL_FUTURE_WINDOWS.length).toBe(44)`로 바꾸고 `console.log`를 지운다. 지금 넣으면 실패하므로 TODO FU5 줄에 조건으로 적어 둔다.

### R-601 [NEW] [낮음] src/ui/scene/SceneCard.tsx:98 — 2111년부터 창이 갈 곳 없는 링크가 된다

`endPick`이 새 상태(`pic`은 있고 `line`은 null)를 만들었다. `EraCell`은 그림만 있으면 `#log-y<year>` 링크를 만들고 「그해 기록으로」라고 읽어 준다. 그런데 `log-y` id는 시대 줄에만 있어(`EraRow.tsx:21`) 눌러도 아무 일이 없다. 2110 뒤까지 사는 판에서만, U44가 들어온 뒤에 생긴다. 크래시는 아니다.

지시: FU3/FU5에서 `data-dec`을 다룰 때 함께 고친다. `shown !== null && pick.line === null`이면 `<a>` 대신 `<div className="era" id="scene-era">`에 그림만 그리고 「그해 기록으로」를 읽지 않는다. 시험은 2111년 칸에 링크가 0임을 잰다.

### R-602 [NEW] [낮음] scripts/genEraWindows.ts:39,160-161 · tests/eraWindows.test.ts:125-126 — 지금 구조로는 U44를 넣을 수 없다

U44 `years: [2110, 2130]`이 넣는 경로의 세 곳에 걸린다.
- 「10년을 넘는다」 가드에 막힌다.
- `Row.kind`에 `'base'`가 없다.
- 덩어리 범위 시험(125-126행)에 걸린다.

**함정:** 가드만 풀면 `decadeOfYear(2110)`이 `d2110.ts`를 만든다. `eraDecadeOf`는 2110을 2100으로 돌려주므로 이 파일은 영영 요청되지 않고, 끝 장면이 조용히 안 나온다.

지시: 묶음 C 회차에 끝 장면만 `decade = 2100`으로 고정하고(`Math.min(decadeOfYear(years[0]), 2100)`), 가드와 시험은 `kind: 'base'`만 예외로 푼다. `basis` 출력도 같은 회차에 넣는다. TODO FU5 줄에 적는다.

### R-603 [CR-TEST] [낮음] tests/eraFuture.test.ts:504 — 「2장 이상」에 무거운 일상이 끼면 가리기를 켠 판에서 4단계에 닿는다

가리기가 켜지면 무거운 일상이 후보에서 빠져 1장이 될 수 있다. 그러면 나이를 푸는 단계로 내려간다. 지금 표에는 그런 일상이 없다.

```diff
--- a/tests/eraFuture.test.ts
+++ b/tests/eraFuture.test.ts
@@
-    for (const d of decades) expect(futureStarts.filter((x) => x.kind === 'daily' && x.years[0] === d && x.band === undefined && x.ages === undefined).length, `${d}년대`).toBeGreaterThanOrEqual(2);
+    for (const d of decades) expect(futureStarts.filter((x) => x.kind === 'daily' && x.years[0] === d && x.band === undefined && x.ages === undefined && !x.heavy).length, `${d}년대`).toBeGreaterThanOrEqual(2);
```

### R-604 [NEW] [낮음] tests/eraFuture.test.ts:93 — 공개 저장소의 시험 문장이 특정 정당의 승리를 말한다

목록 자체는 양쪽을 다 담아 중립적이다. 다만 이 예문 한 줄은 맥락 없이 읽히면 오해를 살 수 있다.

```diff
--- a/tests/eraFuture.test.ts
+++ b/tests/eraFuture.test.ts
@@
-    expect(bad('국민의힘이 이겼습니다.').join()).toContain('정당 이름');
+    expect(bad('정의당 소식이 늘었습니다.').join()).toContain('정당 이름');
```

### R-605 [CR-TEST] [낮음] tests/helpers/eraFutureForbidden.ts:32,63-64 — 띄어 쓴 이름과 빠진 정당

「오픈 AI」는 알파벳 규칙도(`AI` 허용) 회사 이름 규칙도 통과한다. 「기본소득당」·「진보당」은 목록에 없는데, 2030년 줄이 기본소득을 다룬다.

```diff
--- a/tests/helpers/eraFutureForbidden.ts
+++ b/tests/helpers/eraFutureForbidden.ts
@@
-export const PARTY_NAMES: readonly string[] = ['더불어민주당', '국민의힘', '정의당', '개혁신당', '조국혁신당', '민주당'];
+export const PARTY_NAMES: readonly string[] = ['더불어민주당', '국민의힘', '정의당', '개혁신당', '조국혁신당', '민주당', '기본소득당', '진보당'];
@@
-  const lower = line.toLowerCase();
+  const lower = line.replace(/\s/g, '').toLowerCase(); // 「오픈 AI」처럼 띄어 써도 잡는다
```

### R-606 [CR-TEST] [낮음] tests/eraFuture.test.ts:123,345,466,506 — 무거운 시험이 기본 제한 시간 5초에 기댄다

`vite.config.ts`에 `testTimeout`이 없고 `it`에도 제한 시간이 없다. 345행은 약 12만 번의 `eraOf`를 돌리며 해마다 걸어온다(어림 2억 번 이상의 후보 판정). 전체 실행이 791초 걸릴 만큼 부하가 큰 환경에서는 흔들릴 수 있다. 재 보지는 못했다.

지시: 네 `it`의 세 번째 인자로 `60_000`을 준다.

### R-607 [NEW] [낮음] scripts/genEraWindows.ts:60 — 주석이 없는 글을 가리키고 사실과 다르다

`sceneGolden.test.ts` 머리에는 FU8 이야기가 없고, 골든 칸은 하나도 달라지지 않았다.

```diff
--- a/scripts/genEraWindows.ts
+++ b/scripts/genEraWindows.ts
@@
- * 골든에 닿는 칸: 2020~2025년 어려운 쪽(`band: 'low'`) 19세 미만 — 이 줄이 더는 어린이에게 오르지 않는다(`tests/sceneGolden.test.ts` 머리 주석).
+ * 달라지는 칸: 2020~2025년 어려운 쪽(`band: 'low'`) 19세 미만(실제로는 가리기를 켠 2022년) — 이 줄이 더는 어린이에게 오르지 않는다. 골든의 출생 연도에는 이 칸이 없어 `scene-golden.json`은 그대로다(`tests/eraFuture.test.ts` 「FU8가 바꾸는 조합은…」).
```

## 핵심 항목별 결과

**1. 고르기 — 문제 없음**
- **2025 이하 불변:** `future` 분기를 없애도 2025 이하에는 영향이 없다. 분기가 2026년 이후에만 걸렸고, 지금 걷기·단계 코드에 해 경계에 따른 차이가 없다. 옛 코드는 저장소 압축본이라 직접 비교하지 못했다.
- **이를 잠그는 시험:** 실질적인 잠금은 `sceneGolden`이다(시드 2 × 구간 3 × 가리기 2 × 출생 6, 출생~2025). `eraFuture:391`의 「2025 이하 불변」은 새 코드끼리 풀만 바꿔 견주므로 데이터가 섞이지 않음만 보이고, 옛 동작과의 대조는 아니다. 골든이 있어 지적하지는 않는다.
- **FU8과 골든:** 바뀌는 칸은 가리기 2022년의 어려운 쪽 19세 미만뿐이다. 골든에서 가장 늦은 출생인 2003년생은 그해 19세라 범위 밖이다. 작업자 주장이 맞다.
- **순서:** band 사건 → band 없는 사건(지역 먼저, 무거운 쪽 먼저) → 일상 → 기본 순서가 10-1절과 같다. 2026~2109도 같은 경로를 탄다.
- **3해 연속:** 10년 경계에서 `recent`가 비지만, 일상이 10년을 넘지 못하므로(생성 가드, 시험 125행) 경계를 넘어 이어질 그림이 없다. 큰 해에도 맞다. 2110 뒤는 걷지 않는다.
- **2110 뒤:** 끝 줄 한 번, 2111부터 줄 없음, `sourceYear` 2109 모두 맞다.

**2. forecast·basis — 문제 없음**
- 2026 이하와 2110 끝 줄은 false, 2027~2109는 true이고, `basis`는 예측 줄에서 줄을 낳은 장면의 값을 쓴다. 가린 줄도 유지된다.
- CR-CORE, CR-RNG, CR-SAVE 위반은 없다. `eraRows`는 `LifeScreen`의 `useMemo`에만 있고 저장 경로에 닿지 않는다. CR-TIME도 해당 없음이다.

**3. 성능 — 캐시는 필요 없다**
- 걷기는 `eraOf` 한 번에 최대 10단계라, 비용은 O(해 × 10 × 후보)다. 받은 덩어리만 후보이므로 한 판에서 약 115장 안팎이다.
- 100세 판의 재계산은 어림 13만 번의 판정으로 PC에서 1~2ms, 저사양 휴대폰에서 어림 10ms 이하다(실측 아님).
- 8배속에서 가장 짧은 대기는 quiet 7,000ms × 계수 ÷ 8이라, 1배속 계수에 따라 달라도 수백 ms 단위다. 차이가 나지 않는다.
- 모듈 캐시는 순수 함수의 장점을 해치므로 넣지 않는 편이 낫다. 정말 필요해지면 `eraRowsOf`를 한 번에 걷게 바꾸는 것이 낫다. 지적하지 않는다.

**4. FU2**
- 코드가 막는 것이 아니라 데이터 조건(band·ages 없는 일상 2장 이상)이 막는다. 다만 주석에 그렇게 적혀 있고 SPEC 6번도 같은 구조다.
- 조건이 맞으면 3단계에서 언제나 새 그림이 나오는 것이 시드와 무관하게 성립한다. 그래서 단일 시드 시험으로도 충분하고, `oneOnly` 반례도 공허하지 않다.
- 구멍은 낱말 견주기(R-598)와 대조(R-596)다.
- 낱말 목록은 「섰습니다」 「기다렸습니다」를 잡지 못한다. 그래서 의미 차원의 보증은 **실제 줄 = 사람이 승인한 표** 일치에서 나온다. R-596이 FU2의 실질적인 강제 장치인 이유다.

**5. 시험의 공허함**
- **`describe.runIf`:** 켜진다. 한 묶음에 `it` 7개이고, eager glob이 수집 시점에 동기로 돈다. `d2020.ts`에 U01만 보충돼도 켜진다. 지금 `years[0] >= 2026`인 장면, 2026~2029 사건, 2110 이후 base가 모두 없어 0/87이 맞다.
- **수치:** 52,722 = 87 × 101 × 3 × 2로 맞다. 51개 = 44 실행 + 7 건너뜀도 `it`을 세어 맞다. 다만 이 칸들은 합성 풀이고 시드 하나다. 「그림 있음」은 시드와 무관한 성질이라 문제없다.
- **변이 주장:** 네 변이가 잡힌다는 것은 읽어서 그럴듯함을 확인했고, 실패 개수까지는 재현하지 않았다.
- **대조:** 복사본끼리 비교조차 없이 끝난다. R-596, R-597이 이를 닫는다.

**6. 금지어 (M11) — 확인 완료**
- 원문 제목과 링크는 없다.
- 줄 번호 주석은 조사 문서와 맞는다. Neuralink·Neuracle은 조사 문서의 주소에서만 나오고 본문에는 이름이 없다.
- 조사 문서의 다른 라틴 이름은 알파벳 규칙이 모두 잡으므로 목록에 없어도 된다.
- 공개 저장소에 올라가면 안 될 내용은 없다. 예문 한 줄만 고친다(R-604).
- 구조: `lineViolations`는 `w.line`에만 적용되므로 FU11 근거 칸은 대상이 아니다. 맞다.

**7. FU8 `AGES_FIX` — 문제 없음**
- 나이대가 이미 있는 행을 덮으면 멈추고, 쓰이지 않은 키도 멈춘다. `d2020.ts:15`에 `ages: [19, 100]`이 생성 순서대로 들어갔다. `TRIM`과 같은 방식이다. 주석 한 줄만 고친다(R-607).

**TODO:** SPEC-010 코어 줄은 아직 `[ ]`이고 근거로 적힌 파일과 함수는 모두 있다.

## 후속 (TODO로 넘김)

- **QA 전, 이번 회차에 함께 적용 권장 (diff 있음):** R-599, R-603, R-604, R-605, R-607
- **R-606:** 이번 회차에 함께 적용 권장 (지시, diff 없음)
- **FU3/FU5 회차:** R-601
- **FU5 묶음 C 회차:** R-600, R-602

위험도: Two-way / 파급 중간 (공개 인터페이스 추가지만 저장되지 않는 파생 줄이라 되돌릴 수 있다. 이번 지적의 diff는 시험과 주석뿐이다)

## 마스터 처리 (2026-11-03)
- 중간 3건과 R-599·R-603~R-607을 다음 developer 회차에 diff대로 반영한다. R-596·R-597은 U09·U10 줄 수정(R-591~595 회차)이 끝난 뒤 넣는다. R-601은 FU3 회차, R-600·R-602는 묶음 C 회차.
- 2회차는 CLAUDE.md 2-6에 따라 표준보다 가볍게, diff 적용과 시험 통과를 본다.
