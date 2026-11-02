VERDICT: CHANGES_REQUESTED

# REV-009-FM4a-1 — SPEC-009 FM4a 그림 최소 가족 코어 검수 (1회차 / 5, 정밀 레인)

- 대상: 브랜치 spec-009, 커밋 d51c7bf(기준 44d7a10, 사이 bc73480·f407c1c는 문서). 같은 커밋의 `docs/data/fd-b-*`는 범위 밖.
- 검수자: reviewer(opus, 읽기 전용). 슬림화 형식(2026-10-28)의 첫 회차다 — diff 지적, 규칙 ID, 위험도 줄. 리포트는 텍스트로 넘어왔고 마스터가 저장했다(2026-10-28).
- 판정: CHANGES_REQUESTED — 중간 2(R-530·R-531), 낮음 6(R-532~R-537).

## 마스터 질문 8개에 대한 답

**1. L0·L1 해시 불변**
- 코드로는 불변이 맞다.
  - `generateBirth`는 `peerSeed`를 만든 뒤에 `rollFamilyBirth`를 부르고, 진행 `rng`는 넘기지 않는다.
  - `aliveAtSixRate`는 자체 고정 시드 RNG를 쓴다.
  - `life.ts`는 바뀌지 않았다.
  - `siblingCountOf`는 `'legacy'`이고, `familyOf`는 `olderSiblingPlan`을 따로 뺐을 뿐 결과가 같다.
- 골든을 「변경 전 코드」로 만들었는지는 파일만으로 확인할 수 없다(R-535). 투영에서 `family`를 빼므로 새 코드로 만들어도 통과한다. 나란히 있는 「rngState를 쓰지 않는다」 시험은 동어반복이다.
- 세대 사이 상관은 게임 체감상 문제가 아니다.
  - 시드는 판마다 `crypto` 난수다(`App.tsx#newSeed`). `beginNew`·`rebirth`도 늘 새 시드를 받고, 사용자가 시드를 넣는 길이 없다.
  - 같은 시드로 다른 세대를 돌리면 가족 「모양」이 닮는다(독립 나이, 동생 터울·성별, 이어짐·이혼·별세의 `u`가 같다). 이것은 시험·시뮬레이션에서만 보이고 `spreadSeeds`가 처리한다.
  - 남는 주의 한 가지: Q1 「부모님 세대로 다시 태어나기」를 구현할 때 같은 판의 시드를 다시 쓰면 안 된다.

**2. 저장 v9 + `family`**
- 맞게 된 것:
  - 필드 단위 검증, 버린 뒤 같은 시드로 재생성
  - 옛 저장 스냅샷(`lg: 1`, 위 형제가 `familyOf`와 같음)
  - 1000자 한도(7000판 최댓값 + 로그 40개 최악)
- 빈 탭의 덮어쓰기는 막지 못한다(R-532).
- 고정 원문 3종은 v0.3.0이 만든 것이 아니다(R-531).

**3. 모순 0**
- 별세한 사람, 아직 태어나지 않은 동생, 출생신고의 위 형제만 표시(B-1)는 맞고 시험도 있다.
- 다만 부모 한 분이 떠난 뒤나 이혼한 뒤에 동생이 태어날 수 있다(R-530).

**4. 분포 시험**
- 외부 숫자와 대조하는 시험: T-FA3c(FD6), T-FA7a(15.6~18.0%), 표의 기준값(1981년 38.68·41.59, 2000년 15.00, 2005년 14.65).
- 같은 함수의 출력과 대조하는 시험(추첨이 맞는지만 봄): T-GP1, T-FA4a, T-FA7b.
- `survivalCurve`를 공식 기대수명과 대조하는 시험이 없다(R-536).
- 허용치 ±0.45는 16절 「추가 결정」에 마스터가 확정한 값이라 근거가 있다.

**5. 지연 덩어리 `familyData`**
- `loadGameData`의 `Promise.all`로 함께 받으므로, 실패하면 출생 실패와 같은 처리를 하고 다시 시도할 수 있다(A-10 충족).
- `lazyBoundary`·`initial-load`의 본문 표지 단언(첫 화면 0회, 「태어나기」 뒤 1회)이 맞다.

**6. 기존 동작 불변**
- `familyOf`는 같은 결과를 낸다. `CondFamilyInfo`는 타입 이름만 바뀌었다(참조 2곳). `SIBLING_COUNT_RULE = 'legacy'`다.

**7. 규칙 위반**
- CR-RNG·CR-CORE 위반은 없다. CR-DATA는 R-534다.

**8. TODO FM4a `[x]` 근거**
- 적힌 파일·함수·describe 이름은 모두 실재한다.
- 괄호 안의 두 주장은 검증되지 않는다: 「골든은 변경 전 코드로 만들었다」(R-535), 「v0.3.0 고정 파일」(R-531).

## 지적

### R-530 [NEW(INV-2·모순 0)] [중간] `src/core/familyBirth.ts:230-240, 254-263`

**문제**
- `rollYoungerSiblings`는 부모가 떠나는 때와 이혼 시점을 보지 않는다.
- 그래서 「아버지가 내 3세에 별세 → 6세에 동생 출생」이나 「이혼으로 아버지가 떠난 뒤 몇 해 지나 동생 출생」이 생긴다.
- 재혼·의붓은 만들지 않는다는 4-7 (2)와 어긋난다. 산업화 세대처럼 이른 부모 사별이 많은 세대에서는 동생이 있는 판의 몇 %다. 시험에 이 단언이 없다.

**방향:** 이혼 계획을 출생 때 계산할 수 있는 함수로 옮기고, 동생 출생을 그 시점에서 끊는다.

```diff
--- a/src/core/familyBirth.ts
+++ b/src/core/familyBirth.ts
@@
 import {
+  DIVORCE_AGES,
+  DIVORCE_FATHER_LEAVES,
   FAMILY_MAX_CHILDREN,
   FAMILY_TAG,
   FAMILY_DATA_VERSION,
   LEAVE_AGE,
   MOTHER_BIRTH_MAX,
+  NO_DEATH_PLAN,
   YOUNGER_MOTHER_MAX,
@@
-export function rollYoungerSiblings(famSeed: number, birthOrder: number, motherAge: number, shares: readonly [number, number, number]): SiblingData[] {
+/** `lastAt`: 동생이 태어날 수 있는 마지막 주인공 나이 = min(부모 한 분이 떠나는 해, 이혼한 해) — 재혼·의붓은 만들지 않는다(4-7 (2)) */
+export function rollYoungerSiblings(famSeed: number, birthOrder: number, motherAge: number, shares: readonly [number, number, number], lastAt: number = Infinity): SiblingData[] {
   const out: SiblingData[] = [];
   let k = 0;
   for (let j = 1; birthOrder + j <= FAMILY_MAX_CHILDREN; j++) {
     k += 2 + Math.floor(famHash01(famSeed, FAMILY_TAG.SIBLINGS, 100 + j, 1) * 4);
     if (motherAge + k > YOUNGER_MOTHER_MAX) break;
+    if (k > lastAt) break;
@@
+// ---------- 부모 한 분 별세·이혼 계획 (4-7절 (1)(2)) — familyView.ts에서 옮김: 동생 구성이 이 계획을 넘지 않게 출생 때도 쓴다 ----------
+
+const clampYear = (n: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, n));
+
+export function parentDivorceRate(year: number): number {
+  const d = familyTables().divorce;
+  const last = d.rateFrom + d.rate.length - 1;
+  if (year >= d.rateFrom) return d.rate[Math.min(year, last) - d.rateFrom];
+  const crudeAt = (y: number): number => d.crude[clampYear(y, d.crudeFrom, d.crudeFrom + d.crude.length - 1) - d.crudeFrom];
+  return (d.rate[0] * crudeAt(year)) / crudeAt(d.rateFrom);
+}
+
+export function parentGoneAtOf(birthYear: number, report: Pick<BirthReport, 'mother' | 'father'>, p: FamilyData['p']): [number, number] {
+  const by = [parentBirthYear(birthYear, report.mother.age), parentBirthYear(birthYear, report.father.age)];
+  return [0, 1].map((i) => (p[i].d >= NO_DEATH_PLAN ? Infinity : goneAtMyAge(by[i], p[i].d, birthYear))) as [number, number];
+}
+
+export function firstGoneOf(parentGoneAt: readonly [number, number]): { who: 0 | 1; at: number } | null {
+  if (!Number.isFinite(parentGoneAt[0]) && !Number.isFinite(parentGoneAt[1])) return null;
+  const who: 0 | 1 = parentGoneAt[1] <= parentGoneAt[0] ? 1 : 0;
+  return { who, at: parentGoneAt[who] };
+}
+
+export function divorcePlan(famSeed: number, birthYear: number, firstGone: { at: number } | null): { at: number; leaver: 0 | 1 } | null {
+  for (let a = DIVORCE_AGES.min; a <= DIVORCE_AGES.max; a++) {
+    if (firstGone !== null && a >= firstGone.at) break; // 한 분이 떠난 해부터는 일어나지 않는다
+    if (famHash01(famSeed, FAMILY_TAG.DIVORCE, a, 0) * 100 < parentDivorceRate(birthYear + a)) {
+      return { at: a, leaver: famHash01(famSeed, FAMILY_TAG.DIVORCE, a, 1) < DIVORCE_FATHER_LEAVES ? 1 : 0 };
+    }
+  }
+  return null;
+}
@@ export function rollFamilyBirth(famSeed: number, input: FamilyBirthInput): FamilyData {
   const core = rollFamilyCore(famSeed, input);
+  const firstGone = firstGoneOf(parentGoneAtOf(input.birthYear, input.report, core.p));
+  const divorce = divorcePlan(famSeed, input.birthYear, firstGone);
+  const lastAt = Math.min(firstGone?.at ?? Infinity, divorce?.at ?? Infinity);
   return {
     v: FAMILY_DATA_VERSION,
     ...core,
     o: rollOlderSiblings(famSeed, input.siblingSeed, input.report),
-    y: rollYoungerSiblings(famSeed, input.report.birthOrder, input.report.mother.age, input.orderShares),
+    y: rollYoungerSiblings(famSeed, input.report.birthOrder, input.report.mother.age, input.orderShares, lastAt),
     l: [],
   };
 }
--- a/src/core/familyView.ts
+++ b/src/core/familyView.ts
@@
-import { goneAtMyAge, grandBirthYears, parentBirthYear } from './familyBirth';
+import { divorcePlan, firstGoneOf, goneAtMyAge, grandBirthYears, parentBirthYear, parentGoneAtOf } from './familyBirth';
+export { parentDivorceRate } from './familyBirth';
@@
-export function parentDivorceRate(year: number): number {
-  ...(함수 본문 전체 삭제)
-}
@@ export function familyScheduleOf(game: FamilyGame): FamilySchedule {
-  const goneAt = (i: 0 | 1): number => {
-    const d = family.p[i].d;
-    return d >= NO_DEATH_PLAN ? Infinity : goneAtMyAge(parentBy[i], d, Y);
-  };
-  const parentGoneAt: [number, number] = [goneAt(0), goneAt(1)];
-  let firstGone: FamilySchedule['firstGone'] = null;
-  if (Number.isFinite(parentGoneAt[0]) || Number.isFinite(parentGoneAt[1])) {
-    const who: 0 | 1 = parentGoneAt[1] <= parentGoneAt[0] ? 1 : 0;
-    firstGone = { who, at: parentGoneAt[who] };
-  }
-  let divorce: FamilySchedule['divorce'] = null;
-  for (let a = DIVORCE_AGES.min; a <= DIVORCE_AGES.max && divorce === null; a++) {
-    if (firstGone !== null && a >= firstGone.at) break; // 한 분이 떠난 해부터는 일어나지 않는다
-    if (famHash01(famSeed, FAMILY_TAG.DIVORCE, a, 0) * 100 < parentDivorceRate(Y + a)) {
-      divorce = { at: a, leaver: famHash01(famSeed, FAMILY_TAG.DIVORCE, a, 1) < DIVORCE_FATHER_LEAVES ? 1 : 0 };
-    }
-  }
+  const parentGoneAt = parentGoneAtOf(Y, report, family.p);
+  const firstGone = firstGoneOf(parentGoneAt);
+  const divorce = divorcePlan(famSeed, Y, firstGone);
--- a/tests/sceneFamily.test.ts
+++ b/tests/sceneFamily.test.ts
@@ describe('T-FA7 부모 한 분 별세(K3)와 이혼·별거', () => {
+  it('INV-2b 아래 동생은 부모 한 분이 떠난 해·이혼한 해 뒤에 태어나지 않는다(재혼·의붓 없음)', () => {
+    for (const s of SAMPLES) {
+      const sc = familyScheduleOf(s.game);
+      for (const y of s.game.family!.y) {
+        if (sc.firstGone !== null) expect(y.k, `${s.gen} ${s.seed}`).toBeLessThanOrEqual(sc.firstGone.at);
+        if (sc.divorce !== null) expect(y.k, `${s.gen} ${s.seed}`).toBeLessThanOrEqual(sc.divorce.at);
+      }
+    }
+  });
```

**함께 고칠 것**
- `familyView.ts`에서 쓰지 않게 된 import(`DIVORCE_AGES`·`DIVORCE_FATHER_LEAVES`·`famHash01`·`NO_DEATH_PLAN`)를 정리한다.
- `tests/familyBirth.test.ts:85`의 `rollYoungerSiblings(...)` 호출에 같은 `lastAt`을 넘긴다.
- T-FA3a 「첫 동생」 기대값의 `ok`에 `gap ≤ lastAt` 조건을 더한다.
- `legacyFamilyFrom`의 동생 처리(`seen`으로 만듦)는 그대로 둔다.

### R-531 [CR-SAVE] [중간] `scripts/genSaveFixtures.ts:6-35`, `tests/fixtures/save-v030-age{0,20,65}.json`

**문제**
- 「v0.3.0 저장 원문」이라는 고정 파일은 지금 코드로 만든 판에서 `family`만 지운 것이다.
- 문서 2-4·12-3 ⑤는 「이전 빌드(v0.3.0)가 만든 저장 원문」을 요구한다(reviewer 확인 항목).
- v0.3.0 태그 → 44d7a10 사이의 상태 모양·이벤트 풀·필드 차이를 잡지 못한다. 배포 중인 사용자 저장의 이어하기가 실제로 검증되지 않았다.

**지시**
- `v0.3.0` 태그를 별도 worktree로 꺼내, 그 빌드의 core로 genx 판을 0·20·65세까지 돌린다(시드 탐색은 이 스크립트와 같은 방식).
- 그 빌드의 `serializeGame` 원문을 세 파일로 다시 고정한다. 스크립트 머리에 사용한 커밋 해시를 적는다.
- npm은 그 worktree 안의 로컬 스크립트로만 실행한다(맨 `npx` 금지).
- 새 파일로 `tests/familyStorage.test.ts` 「옛 저장(v0.3.0…)」을 다시 통과시키고, TODO 근거의 표현을 맞춘다.

### R-532 [CR-SAVE] [낮음] `src/App.tsx:358-375`, `src/core/storage.ts:500-507`

**문제**
- 마운트 때 도는 저장 effect는 `decideSave`만 본다. 그래서 옛 저장을 처음 연 탭이 `ensureFamily`가 채운 `family`를 바로 한 번 쓴다.
- storage.ts:502 주석과 dev 로그 5절의 「빈 탭이 쓰지 않게 했다」는 10초 flush에만 맞는 말이다.
- 피해는 한 번뿐이다. 저장이 막힌 기기에서 열자마자 실패 안내가 뜨고, 열려 있던 옛 빌드 탭이 밀린 화면으로 간다. R-417·R-047 약속과 어긋난다.

```diff
--- a/src/core/storage.ts
+++ b/src/core/storage.ts
@@ export function parseOpened(raw: string | null, poolArg?: EventPool): GameState | null {
   const game = parseGame(raw, poolArg);
   return game === null ? null : ensureFamily(game);
 }
+
+/** 옛 저장을 열며 `ensureFamily`가 `family`만 채운 상태인가 (R-532) — 그렇다면 열기만 한 탭은 쓰지 않는다(R-417). 사람이 한 일이 생기면 그 저장에 함께 기록된다 */
+export function isFamilyFillOnly(knownRaw: string | null, game: GameState): boolean {
+  if (knownRaw === null || game.family === undefined) return false;
+  const plain = parseGame(knownRaw);
+  if (plain === null || plain.family !== undefined) return false;
+  const rest = { ...game } as Record<string, unknown>;
+  delete rest.family;
+  return serializeGame(rest as unknown as GameState) === serializeGame(plain);
+}
--- a/src/App.tsx
+++ b/src/App.tsx
@@
     if (decision === 'unchanged') {
       written.game = stored;
       setGameSaveFailed(false);
       return;
     }
+    // 옛 저장을 열며 family만 채운 상태는 쓰지 않는다 — 열기만 한 탭은 쓰지 않는다 (R-417·R-532)
+    if (isFamilyFillOnly(written.game, game)) return;
     const ok = saveGame(storage, game);
```

**함께 할 것**
- `isFamilyFillOnly`를 `core/index`로 내보내고 App의 import에 더한다.
- `tests/familyStorage.test.ts` 고정 파일 시험에 `isFamilyFillOnly(raw, parseOpened(raw)!)`와 `isIdleOnlyChange(raw, parseOpened(raw)!)`가 모두 `true`라는 단언을 더한다.

### R-533 [CR-SAVE] [낮음] `src/core/familyStorage.ts:141`

**문제:** 옛 저장에서 만든 스냅샷(`lg: 1`)이 손상되면 새 판 방식(`rebuildFamily`)으로 다시 만든다. 그러면 이미 본 아래 동생(`seen`)과 다른 동생이 「이미 태어난」 상태로 생길 수 있다(DF25 위반).

```diff
-  if (AFTER_BIRTH.includes(bare.phase) && bare.character !== null && bare.birthReport !== null && isGameDataReady()) return { ...bare, family: rebuildFamily(bare) };
+  if (AFTER_BIRTH.includes(bare.phase) && bare.character !== null && bare.birthReport !== null && isGameDataReady()) {
+    // 옛 저장에서 만든 스냅샷이 손상됐으면 옛 저장 규칙으로 되살린다 — 새 판 방식은 이미 본 아래 동생(seen)과 어긋난다 (DF25)
+    const wasLegacy = isObj(raw) && raw.lg === 1;
+    return { ...bare, family: wasLegacy ? legacyFamilyFrom(bare) : rebuildFamily(bare) };
+  }
```

### R-534 [CR-DATA] [낮음] `src/core/familyBirth.ts:176·234·237`, `src/core/familyModel.ts:44·51·53`

**문제**
- 새 코드의 확률·밸런스 설계값이 코어에 박혀 있다: `PATERNAL_SIDE_SHARE` 0.7, `DIVORCE_FATHER_LEAVES` 0.8, 성별 0.5, `LEAVE_AGE`, 이어짐 상한 0.9.
- 0.7은 `FAMILY_BASIS` 글에도 따로 적혀 있어 두 곳이 어긋날 수 있다.
- 터울은 리터럴 `2 + …*4`라서 시험이 쓰는 `SIBLING_GAP`과 따로 논다.

```diff
--- a/src/core/familyBirth.ts
-import { ERA_REPORT_ADJUST, PARENT_AGE_LIMITS, THIRD_PLUS_SPLIT, reportTiltOf } from '../data/birthReportTable';
+import { ERA_REPORT_ADJUST, PARENT_AGE_LIMITS, SIBLING_GAP, THIRD_PLUS_SPLIT, reportTiltOf } from '../data/birthReportTable';
@@
-    k += 2 + Math.floor(famHash01(famSeed, FAMILY_TAG.SIBLINGS, 100 + j, 1) * 4);
+    k += SIBLING_GAP.min + Math.floor(famHash01(famSeed, FAMILY_TAG.SIBLINGS, 100 + j, 1) * (SIBLING_GAP.max - SIBLING_GAP.min + 1));
```

**지시**
- 나머지 설계값은 FM4b 첫 커밋에서 `src/data/familyTables.ts`의 `FAMILY_DESIGN`(근거 칸 포함)으로 옮긴다. 코어는 `familyTables()`로 읽는다.
- FM4b가 같은 종류의 값(이른 별세 효과 등)을 더 넣기 전에 자리를 정해 두려는 것이다.
- 릴리스(K6) 전이라 값과 동작은 바뀌지 않는다.

### R-535 [CR-TEST] [낮음] `tests/familyHash.test.ts:32-39`, `tests/fixtures/{birth,life}-golden.json`

**문제**
- 골든을 변경 전 코드로 만들었다는 근거가 저장소에 없다. 투영에서 `family`를 빼므로 새 코드로 만들어도 통과한다.
- 32-39줄 「rngState 불소비」는 같은 입력을 두 번 넣어 비교하는 동어반복이다.

**지시**
- 44d7a10 worktree에 `tests/helpers/familyGolden.ts`·`scripts/familyGolden.ts`만 복사해 실행한다. 출력이 두 골든 파일과 바이트 단위로 같은지 확인하고 결과를 ai-log에 남긴다.
- 32-39줄은 「`generateBirth`의 `rngState` = 같은 시드에서 `rollFamilyBirth`를 빼고 다시 계산한 값」 같은 비교로 바꾸거나 지운다. L0 골든이 정본이다.

### R-536 [CR-TEST] [낮음] `tests/familyLife.test.ts`

**문제**
- T-FA4a·T-FA7b는 `survivalCurve`를 자기 출력과 대조한다(추첨기 검증).
- 곡선 자체를 공식 값과 대조하는 시험이 없다.
- 1970 앞 배율이 목표 기대수명을 실제로 맞추는지도 보지 않는다(지금은 단조와 1.5 초과만 본다).

**지시:** 두 시험을 더한다.
1. 표의 1970·2000·2024 열로 계산한 기간 기대수명을 `koreaStats` 공식 기대수명(남·여)과 ±1.5세로 대조한다.
2. t = 1960·1940에서 배율을 적용한 기간 기대수명이 `e0(1970) − 기울기 × (1970 − t)`(하한 30)의 ±0.1세 안인지 본다. `periodE0`는 내보내거나 같은 식을 시험에 둔다.

### R-537 [NEW] [낮음 — 명세 공백, 마스터 결정 필요] `src/core/familyView.ts:161`

**문제**
- 함께 사는 조부모가 이혼으로 떠난 쪽 집안이어도(예: c = 1 친가, 아버지가 떠남) 0~19세 내내 주인공·어머니와 함께 산다.
- 1993~2006년생 판의 약 1%다. 문서 4-4는 이사(대기 C)만 동거가 끝나는 경우로 적었다.

**지시:** 마스터가 「떠난 부모와 같은 쪽 조부모는 `divorce.at + 1`부터 따로 산다」로 할지, 지금처럼 둘지 정한다. FM4b에서 반영한다.

## 후속 (TODO로 넘길 낮음)

R-532 · R-533 · R-534 · R-535 · R-536 · R-537. 이번 회차가 중간 지적 때문에 반려라서, 다음 회차에 함께 닫아도 된다.

## 참고 (지적 아님)

- 12-2절의 `tests/familyConsistency.test.ts`(`playToEnd` INV 전수 시험)는 아직 없다. FM4b와 함께 만든다.
- FM5 그림이 FM4b보다 먼저 화면에 연결되면 부모 별세·이혼이 인생 기록 줄 없이 그림에만 보인다. 배포는 K6(한 번에)대로 묶는다.

위험도: One-way / 파급 중간
- `family`가 배포되면 사용자 저장에 남아, 그 뒤로는 추첨 규칙(R-530)을 바꿀 수 없다.
- v0.3.0 저장 호환을 실제 원문으로 확인하지 않고 배포하면 진행 중인 판의 이어하기가 깨질 수 있다(R-531).
- 지금은 spec-009 브랜치에만 있고 배포 전이라, 이번 수정 자체는 되돌릴 수 있다.

## 마스터 처리 (2026-10-28)

- **One-way 판단:** 되돌리기 어려운 지점은 **배포**이고, 이번 수정 적용은 브랜치 안에서 되돌릴 수 있다(검수자 설명 그대로). CLAUDE.md 2-4에 따라 형진 님께 확인을 요청했다. 배포 전 조건은 R-530·R-531 해결과 실제 v0.3.0 원문으로 확인한 이어하기다.
- **R-537:** 「떠난 부모와 같은 쪽 조부모는 `divorce.at + 1`부터 따로 산다」로 정한다. 현실에서 이혼 뒤 그 집안 조부모와 함께 사는 경우는 드물기 때문이다. FM4b에서 반영한다.
- **반영 순서:** R-530~R-536은 developer가 diff를 그대로 적용한다(R-531·R-535는 지시대로). R-537은 FM4b에서 한다.

## 반영 내역 (developer, 2026-10-28, 브랜치 spec-009, 커밋은 마스터)

형진 님 「수정안대로 고치기」 승인(One-way 확인 완료). diff는 해석·변형 없이 적용했고 모두 맞게 적용됐다. 아래 표의 「시험」은 새로 만들었거나 고친 것이다.

| ID | 처리 | 파일 | 시험 |
|---|---|---|---|
| R-530 | diff 그대로 적용. `parentDivorceRate`·`parentGoneAtOf`·`firstGoneOf`·`divorcePlan`을 `familyBirth.ts`로 옮기고 `rollYoungerSiblings(…, lastAt)`로 동생 출생을 끊었다. `familyView.ts`는 옮긴 함수를 불러 쓰고 `parentDivorceRate`를 다시 내보낸다(기존 import 호환). 함께 고칠 것 3건 반영: 안 쓰게 된 import 정리(`DIVORCE_AGES`·`DIVORCE_FATHER_LEAVES`·`FAMILY_TAG`·`famHash01`·`familyTables`), `tests/familyBirth.test.ts` 호출 인자에 `lastAt`, T-FA3a 기대값에 `gap ≤ lastAt` 조건. `legacyFamilyFrom`은 그대로. 주석의 「의붓」은 글꼴 조각(s3) 밖 글자라 `fonts.test.tsx`가 걸려 「재혼은 만들지 않는다」로 줄였다(주석 한 단어, 동작 무관) | `src/core/familyBirth.ts`, `src/core/familyView.ts`, `tests/familyBirth.test.ts` | `tests/sceneFamily.test.ts` 「INV-2b 아래 동생은 부모 한 분이 떠난 해·이혼한 해 뒤에 태어나지 않는다」(7세대 × 150판), T-FA3a·T-FA3c·T-FA7a 통과 |
| R-531 | 지시 수행. `v0.3.0`(50e524c) 별도 worktree(세션 스크래치 폴더, 저장소 밖)에서 `npm ci --ignore-scripts` 후 그 worktree의 `./node_modules/.bin/vite-node`로 genx 판을 0·20·65세까지 돌려 **그 빌드의 `serializeGame` 원문**을 썼다(시드 6). 이 저장소의 `vite-node`에 worktree 스크립트를 넘기는 방식은 `vitest` 패키지를 못 찾아 실패해서(vite.config.ts 해석) 지시의 둘째 방법으로 넘어갔다. 결과 파일 세 개가 기존 고정 파일과 **바이트 단위로 같았다**(`git diff` 없음) — 즉 기존 파일의 내용은 v0.3.0 원문과 같았고, 이제 근거(해시 50e524c·실제 빌드 출력)가 저장소에 있다. 스크립트 머리에 커밋 해시·절차를 적고, 지금 빌드(`family`가 든 상태)에서 돌리면 오류로 멈추게 했다. `node-globals.d.ts`에 `mkdirSync` 선언 한 줄 | `scripts/genSaveFixtures.ts`, `node-globals.d.ts`, `tests/fixtures/save-v030-age{0,20,65}.json`(내용 변화 없음) | `tests/familyStorage.test.ts` 「옛 저장(v0.3.0, family 없음) 이어하기 — 0·20·65세 고정 파일」 통과 |
| R-532 | diff 그대로 적용. `isFamilyFillOnly` 추가(`core/index`는 `export * from './storage'`라 내보내기 자동), App 저장 effect에 적용, App import에 추가. storage.ts 주석에 effect 쪽을 덧붙였다 | `src/core/storage.ts`, `src/App.tsx` | `tests/familyStorage.test.ts` 고정 파일 시험에 `isFamilyFillOnly(raw, parseOpened(raw)!)`·`isIdleOnlyChange(raw, parseOpened(raw)!)` 둘 다 `true` 단언(0·20·65세) |
| R-533 | diff 그대로 적용 | `src/core/familyStorage.ts` | 기존 「이상한 값은 그 필드만 버리고…」·「옛 저장…」 시험 통과(전용 시험은 만들지 않았다 — 리포트에 시험 지시 없음) |
| R-534 | `SIBLING_GAP` diff 그대로 적용. 나머지 설계값을 `src/data/familyTables.ts#FAMILY_DESIGN`(값·`basis`·`note` 근거 칸)으로 옮겼다: `paternalSideShare` 0.7 · `divorceFatherLeaves` 0.8 · `maleShare` 0.5 · `leaveAge` 20~30 · `continueCap` 0.9. 타입 `FamilyDesign`·`DesignValue`는 `core/gameData.ts`, `FAMILY_TABLES.design`에 실려 코어는 `familyTables().design`으로 읽는다. 중복 정의를 없애려고 `familyModel.ts`의 `LEAVE_AGE`·`DIVORCE_FATHER_LEAVES`, `familyBirth.ts`의 `PATERNAL_SIDE_SHARE`는 지우고 `tests/familyBirth.test.ts`가 `familyTables().design.leaveAge.value`를 읽게 했다. `FAMILY_BASIS`의 친가 0.7·외가 0.3 글과 「siblings」 글은 같은 값에서 만든다(어긋남 방지). 값과 동작 그대로 | `src/data/familyTables.ts`, `src/core/gameData.ts`, `src/core/familyBirth.ts`, `src/core/familyModel.ts`, `tests/familyBirth.test.ts` | L0·L1 해시(`tests/familyHash.test.ts`) 통과 — 해시 불변 |
| R-535 | 지시 수행. 44d7a10 별도 worktree에 `tests/helpers/familyGolden.ts`·`scripts/familyGolden.ts`만 복사, 그 worktree에서 `npm ci --ignore-scripts` 뒤 `./node_modules/.bin/vite-node scripts/familyGolden.ts` 실행. 출력 `birth-golden.json`·`life-golden.json`이 저장소의 두 골든 파일과 **`cmp` 바이트 일치**(sha256 앞 16자 6ac86df464b6dd1e · 88ca132001e80132 동일). 동어반복 시험(32-39줄 「가족 추첨은 진행 RNG를 쓰지 않는다」)은 지웠다 — L0 골든이 `rngState`를 포함하는 정본이다. 머리 설명에 확인 사실을 적었다 | `tests/familyHash.test.ts` | L0 7세대 × 1000판 · L1 7세대 × 2전략 × 40판 통과 |
| R-536 | 지시 수행. `periodE0`를 내보내 두 시험을 더했다: ① 표의 1970·2000·2024 열 기간 기대수명 ↔ `koreaStats` 공식 기대수명(남·여) ±1.5세, ② t = 1960·1940에서 배율 적용 기간 기대수명 ↔ `e0(1970) − 기울기 × (1970 − t)`(하한 30) ±0.1세 | `src/core/familyLife.ts`, `tests/familyLife.test.ts` | 「기대수명 대조 (R-536)」 2개 통과 |
| R-537 | 이번에 하지 않았다(마스터 결정: FM4b에서 반영). TODO에 선행 줄만 추가했다 | `docs/TODO.md` | — |

검증 수치와 실행 방법은 `ai-log/2026-10-28_SPEC-009_dev-FM4a-r2.md`에 있다.

## 반영 내역 (developer, 2026-10-28, FM4b 회차 — R-537, 커밋은 마스터가 한다)

| ID | 처리 | 파일 | 시험 |
|---|---|---|---|
| R-537 | 마스터 결정대로 반영. 이혼으로 떠난 부모와 같은 쪽 조부모(떠난 이가 아버지면 친가, 어머니면 외가)는 `divorce.at + 1`부터 함께 살지 않는다(`apart`). 함께 사는 사람·그림·`lives_with_grandparent` 플래그가 이 보기에서 따라 바뀐다 | `src/core/familyView.ts#familyViewOf`(`leftWithParent`) | `tests/familyTick.test.ts` "이혼·별거: 줄 fam-parents-apart, father_apart 또는 mother_apart, 떠난 쪽 조부모는 다음 해부터 따로 산다 (R-537), 재혼·의붓 없음"(같은 쪽·반대쪽 모두 사례 > 0), `tests/sceneFamily.test.ts` "INV-2·10·11·12" 통과 |
