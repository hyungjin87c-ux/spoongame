VERDICT: APPROVED

# REV-009-FM4a-2 — SPEC-009 FM4a 검수 (2회차 / 5, 정밀 레인)

- 대상: spec-009 브랜치 커밋 eeb3ca8(기준 d51c7bf).
- 검수자: reviewer(opus, 읽기 전용). git diff를 돌리지 못해, 1회차 리포트에 인용된 이전 코드와 지금 파일을 대조했다. 리포트는 텍스트로 받아 마스터가 저장했다(2026-10-28).
- 판정: **APPROVED**. 높음 0 · 중간 0 · 낮음 4(R-538~R-541, 후속).

## 1회차 지적 처리

| ID | 상태 | 확인 |
|---|---|---|
| R-530 | 닫힘 | diff 그대로(`familyBirth.ts:232-244·254-284·300-307`, `familyView.ts:2-3·60-62`). 함께 고칠 것 3건 반영. 옮긴 `divorcePlan`은 옛 루프를 바로 return으로 바꾼 것뿐이라 같은 시드면 이혼·별세 계획이 같고 동생만 잘린다. INV-2b는 출생 경로의 `family.y`를 보기 경로의 `familyScheduleOf`와 대조하므로 동어반복이 아니다(잘린 판이 있다는 단언은 R-538) |
| R-531 | 닫힘 | `scripts/genSaveFixtures.ts:6-15`에 커밋 50e524c와 재현 절차가 있다. 지금 빌드에서는 36줄 검사에서 멈춘다. 태그 670a48e는 커밋 50e524c를 가리킨다. 「이전 빌드가 만든 원문」 요구를 채운다 |
| R-532 | 닫힘 | `App.tsx:373-374`가 conflict·unchanged 뒤, `saveGame` 앞에 있다. `isFamilyFillOnly`(`storage.ts:510-517`)는 family를 뺀 직렬화가 글자까지 같을 때만 참이라, 사람이 한 일은 막지 않는다 |
| R-533 | 닫힘 | diff 그대로(`familyStorage.ts:141-145`). 시험은 R-539 |
| R-534 | 닫힘 | 5개 값·비교식·`SIBLING_GAP`{2,5}가 원래와 같고, 각 값에 `value`·`basis`·`note`가 있다. 코어에 남은 리터럴 0(grep) |
| R-535 | 닫힘 | `tests/familyHash.test.ts:12-13`·ai-log r2에 `cmp` 바이트 일치와 sha256이 있다. 동어반복 시험은 지워졌다 |
| R-536 | 닫힘 | 1970·2000·2024 남녀 기대수명이 `koreaStats.json` KOSIS 생명표와 맞는다. ②는 이분법 수렴을 검증한다(지시 충족) |
| R-537 | FM4b | 마스터 결정, TODO:442 |

- 처리 중 바뀐 것: 주석 「의붓」 → 「재혼은 만들지 않는다」(글꼴 조각 사유)와 `node-globals.d.ts:13 mkdirSync`는 타당하다.
- TODO FM4a 근거(435~441줄)는 실재하고 사실대로다.
- 주의: 반영 내역의 「L0·L1 해시 통과 = 값 불변」은 근거가 아니다(투영에서 family를 뺀다). 이번 확인은 코드를 읽어서 했다.

## 지적 (모두 낮음, 후속)

### R-538 [CR-TEST] `tests/sceneFamily.test.ts:212-220`
INV-2b는 위반 0만 본다. 표본에 실제로 잘린 판이 있다는 단언이 없어서, 잘린 판이 0이 되면 `break`를 지워도 통과한다.
```diff
--- a/tests/sceneFamily.test.ts
+++ b/tests/sceneFamily.test.ts
@@
   livingSiblingCount,
+  orderSharesOf,
   parentDivorceRate,
+  rollYoungerSiblings,
   sceneFamilyOf,
@@
 } from '../src/core';
+import { reportTiltOf } from '../src/data/birthReportTable';
 import { sigmaTolerance } from './helpers/stats';
@@ describe('T-FA7 부모 한 분 별세(K3)와 이혼·별거', () => {
   it('INV-2b 아래 동생은 부모 한 분이 떠난 해·이혼한 해 뒤에 태어나지 않는다(재혼·의붓 없음)', () => {
+    let cut = 0;
     for (const s of SAMPLES) {
       const sc = familyScheduleOf(s.game);
       for (const y of s.game.family!.y) {
         if (sc.firstGone !== null) expect(y.k, `${s.gen} ${s.seed}`).toBeLessThanOrEqual(sc.firstGone.at);
         if (sc.divorce !== null) expect(y.k, `${s.gen} ${s.seed}`).toBeLessThanOrEqual(sc.divorce.at);
       }
+      // 끊는 규칙이 실제로 일했는가: 끊지 않고 굴리면 동생이 더 많은 판
+      const r = s.game.birthReport!;
+      const free = rollYoungerSiblings(sc.famSeed, r.birthOrder, r.mother.age, orderSharesOf(reportTiltOf(sc.birthYear), r.region, sc.birthYear));
+      if (free.length > s.game.family!.y.length) cut++;
     }
+    expect(cut, '끊긴 판이 표본에 있어야 이 시험이 위반을 잡는다').toBeGreaterThan(0);
   });
```

### R-539 [CR-TEST] `tests/familyStorage.test.ts` (R-533 경로)
`withValidFamily`의 `wasLegacy` 갈래에 시험이 없다(DF25 회귀).
```diff
--- a/tests/familyStorage.test.ts
+++ b/tests/familyStorage.test.ts
@@ describe('옛 저장(v0.3.0, family 없음) 이어하기 — 0·20·65세 고정 파일 (12-3절 ⑤)', () => {
+  it('옛 저장에서 만든 스냅샷(lg: 1)이 손상되면 옛 저장 규칙으로 되살린다 — 새 판 방식으로 만들지 않는다 (R-533, DF25)', () => {
+    for (const fixture of [age0, age20, age65]) {
+      const opened = parseOpened(JSON.stringify(fixture))!;
+      const broken = { ...opened, family: { ...opened.family!, c: 3 } } as unknown as GameState;
+      const parsed = parseGame(serializeGame(broken))!;
+      expect(parsed.family!.lg).toBe(1);
+      expect(parsed.family).toEqual(legacyFamilyFrom(opened));
+    }
+  });
+
   it('ensureFamily: 이미 있으면 같은 객체, 첫 화면이면 그대로, 출생 이후이고 없으면 legacyFamilyFrom 결과를 채운다', () => {
```

### R-540 [NEW(INV-2b)] 명세 공백, 마스터 결정 필요 — `src/core/familyStorage.ts:32-35`, `src/core/familyView.ts:60-62`
- 옛 저장 스냅샷(`lg: 1`)의 아래 동생은 이미 본 `infant-new-sibling` 나이에서 만든다. 별세·이혼 계획은 시드에서 새로 뽑는다.
- 그래서 「아버지 2세 별세(모델) → 4세 동생(이미 본 사건)」 같은 위반이 옛 저장에만 남을 수 있다(빈도 작음).
- 추천: `lg: 1`이고 `y[0]`이 있으면 그 `k`보다 앞선 이혼 계획은 없는 것으로 본다. 별세는 스냅샷을 만들 때 그 부모의 `d`가 `goneAt ≥ k`가 되도록 아래쪽을 막는다. 사용자가 본 적 없는 값이라 DF25와 충돌하지 않는다.

### R-541 [CR-TEST] `tests/familyBirth.test.ts:340·361`
T-FA3c 제목·주석의 측정값(0.41, −0.25·+0.41·+0.16)은 R-530 전 수치다. 다시 재서 고치고 ai-log에 남긴다. 1941~45가 −0.45에 가까워지면 마스터에게 알린다.

## 참고 (지적 아님)
- 가족 값(`family`) 자체를 고정하는 골든이 없다. K6 배포 직전에 FM4b·c를 확정한 구성으로 「L0F 가족 골든」을 한 번 만들어 둔다(배포 뒤 One-way).
- 사건 플래그(`*_gone`·`*_apart`)와 계획된 동생의 어긋남은 K2(FM4b)에서 함께 다룬다.
- `FAMILY_BASIS` siblings 글의 「터울 2~5년」은 `SIBLING_GAP`에서 만들지 않은 리터럴이다. `familyView.ts:3`의 재내보내기는 이제 없어도 된다.

위험도: Two-way / 파급 낮음 — 배포 전이고 브랜치 안의 변경이다. 다만 K6 배포 때 family가 저장에 남아 One-way가 되므로, R-540 결정과 가족 골든을 그 전에 정한다.

## 마스터 처리 (2026-10-28)
- 승인. R-538·R-539·R-541은 FM4b 첫 커밋에 developer가 diff 그대로 넣는다.
- **R-540은 추천대로 한다.** 옛 저장 스냅샷에서는 이미 본 동생 나이보다 앞선 이혼 계획을 없앤다. 별세는 `goneAt ≥ k`가 되도록 아래쪽을 막는다. FM4b에서 옛 저장 표본 INV-2b 시험과 함께 넣는다.
- 「L0F 가족 골든」은 K6 배포 직전에 만드는 일로 TODO에 넣는다.
