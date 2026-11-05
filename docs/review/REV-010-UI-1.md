# REV-010-UI-1 (SPEC-010 묶음 검수: 코어 2회차 + UI·묶음 A 데이터 1회차)

- **A. 코어 FU1·FU2·FU7·FU8**: 2회차 / 5 · 정밀 레인
- **B. UI·데이터 FU3·FU5(A)·FU6·FU9·FU11**: 1회차 / 5 · 표준 레인
- 대상: `spec-009` 7ade53d

판정: **A = CHANGES_REQUESTED**(중간 1: R-608) · **B = APPROVED**(높음·중간 0, 낮음 2: R-609·R-610)

검수자는 읽기 전용이라 시험을 직접 돌리지 않았다. R-608은 시험의 정규식과 지금 SPEC 원문을 줄 단위로 맞대어 판단했다. 다른 수치(4757 통과, 378,578B 등)는 작업자 기록의 값이다.

## 지적

### R-608 [CR-TEST] [중간] tests/eraFuture.test.ts:82 · tests/helpers/eraFutureData.ts:43 · tests/helpers/eraFutureForbidden.ts:39,44-45 — HEAD에서 R-597 시험이 실패한다

작업자가 시험을 돌린 뒤에 SPEC-010이 두 번 바뀌었고, 둘 다 「표의 줄·해·구간·무거움·basis가 SPEC-010 문서의 연표 표 원문과 같다」를 깨뜨린다.
- **① r2 표지(2026-11-04 planner):** U27~U44 18행이 `| U27 〔r2로 대체 예정〕 |` 모양이 됐다. 정규식 `^\| (U\d\d) \|`가 이 행을 못 읽어 26행만 잡히므로, 83행의 「44행」 단언이 실패한다.
- **② U23 줄 변경(4b92f48, 형진 님 묶음 B 승인):** 표의 U23은 「사과밭이 북쪽 산자락에만 남았습니다.」인데, 합성 표는 아직 옛 줄이다. 87행이 실패한다.

②는 R-597이 잡으라고 만든 바로 그 경우이므로, 시험이 제 일을 한 것이다. ①은 표 모양에서 생긴 소음이다.

U23을 바꾸면 `ACTION_ALLOW_LINES`의 예외 줄이 가리키는 문장이 사라진다. 그래서 SPEC 결정 기록(「묶음 B 회차에 뺀다」)을 앞당겨 지금 뺀다. 빼지 않으면 120행이 실패한다.

```diff
--- a/tests/eraFuture.test.ts
+++ b/tests/eraFuture.test.ts
@@
     const spec = Object.values(docs)[0];
-    const rows = [...spec.matchAll(/^\| (U\d\d) \|([^|]+)\|([^|]+)\|[^|]+\|([^|]+)\|\s*$/gm)];
+    const rows = [...spec.matchAll(/^\| (U\d\d)(?: 〔[^〕]*〕)? \|([^|]+)\|([^|]+)\|[^|]+\|([^|]+)\|\s*$/gm)]; // 번호 뒤 표지(〔r2로 대체 예정〕 따위)는 건너뛴다 — 표가 실제로 바뀌면(r2 확정) 아래 44행 단언이 멈춘다
     expect(rows.map((m) => m[1])).toEqual(Array.from({ length: 44 }, (_, i) => `U${String(i + 1).padStart(2, '0')}`));
@@
-  it('주인공 행동 낱말(2027년 이후): 목록은 마스터 지정 그대로이고, 사건·일상 줄 모두 0이다 — 낱말 어디에 있든 걸고, 사람이 확인한 U23 한 줄만 문장 통째로 풀어 준다', () => {
+  it('주인공 행동 낱말(2027년 이후): 목록은 마스터 지정 그대로이고, 사건·일상 줄 모두 0이다 — 낱말 어디에 있든 걸고, 문장 통째로 풀어 주는 줄은 0이다(U23은 승인된 새 줄)', () => {
     expect([...ACTION_STEMS, ...ACTION_ANYWHERE].join('|')).toBe('갔|탔|샀|받았|일했|배웠|먹었|마셨|출근|퇴근');
-    expect([...ACTION_ALLOW_LINES]).toEqual([futureById('U23').line]);
+    expect([...ACTION_ALLOW_LINES]).toEqual([]);
+    expect(actionWordsIn('사과 재배지가 북쪽으로 올라갔습니다.')).toEqual(['올라갔습니다.']); // 옛 U23 줄 — 예외를 뺐으니 걸린다
     for (const line of ['일터로 나갔습니다.', '병원에 들어갔습니다.', '버스를 갈아탔습니다.', '월급을 돌려받았습니다.', '라면을 사먹었습니다.']) expect(actionWordsIn(line).length, line).toBe(1);
--- a/tests/helpers/eraFutureData.ts
+++ b/tests/helpers/eraFutureData.ts
@@
   ev('U22', 2050, '노화가 멈춘 집이 먼저 생겼습니다.', 'scenario', { band: 'high' }),
-  ev('U23', 2053, '사과 재배지가 북쪽으로 올라갔습니다.', 'official'),
+  ev('U23', 2053, '사과밭이 북쪽 산자락에만 남았습니다.', 'official'), // 형진 님 묶음 B 승인(2026-11-03)에서 바뀐 줄
   ev('U24', 2055, '인도가 세계 경제의 큰 축이 됐습니다.', 'scenario', { topic: '경제' }),
--- a/tests/helpers/eraFutureForbidden.ts
+++ b/tests/helpers/eraFutureForbidden.ts
@@
- * 견주는 방식: 낱말 **어디에 있든** 건다 — 「나갔습니다」·「갈아탔습니다」·「돌려받았습니다」 같은 합성어도 걸린다. 주어가 사물이라 사람이 확인한 줄만 문장 통째로 `ACTION_ALLOW_LINES`에 적어 풀어 준다(U23 「올라갔습니다」, 주어는 재배지).
+ * 견주는 방식: 낱말 **어디에 있든** 건다 — 「나갔습니다」·「갈아탔습니다」·「돌려받았습니다」 같은 합성어도 걸린다. 주어가 사물이라 사람이 확인한 줄만 문장 통째로 `ACTION_ALLOW_LINES`에 적어 풀어 준다(지금은 0줄 — 아래 주석).
@@
 /** 어간이 들어 있지만 주어가 사회·사물임을 사람이 확인한 줄 (문장 통째로 견준다 — 새 줄은 시험이 멈춰 세우고 사람이 판단한다) */
-export const ACTION_ALLOW_LINES: ReadonlySet<string> = new Set(['사과 재배지가 북쪽으로 올라갔습니다.']); // U23
+export const ACTION_ALLOW_LINES: ReadonlySet<string> = new Set<string>(); // 지금 0줄 — 옛 U23 「…올라갔습니다.」는 형진 님 묶음 B 승인(2026-11-03)에서 「사과밭이 북쪽 산자락에만 남았습니다.」로 바뀌었다
```

적용한 뒤 `tests/eraFuture.test.ts` 전체를 다시 돌린다. 새 U23 줄은 줄 규칙(20자·숫자 0·회사명 0)과 행동 낱말 검사를 모두 통과한다고 손으로 셌다. TODO 475행의 「정규식이 지금 문서 표 44행 전부에 맞는다」는 이 diff를 적용하면 다시 참이 된다.

### R-609 [NEW] [낮음] scripts/eraForesightNotes.ts:23,106,114,135 — 근거 칸 시점 문구 세 곳과 기사 제목 한 곳

- **U07의 「발언은 2029년」 「설문은 2047년경」:** 같은 칸 앞머리에 「2024년」(자료가 나온 해)이 있어, 「발언한 해」가 2029년처럼 읽혀 앞뒤가 어긋난다. 내다본 해라고 적는다.
- **U08:** 형진 님 지정 2030 시나리오인데, 칸의 두 건 어디에도 「2030년은 게임이 정한 시나리오」라는 말이 없다(예측 근거 규칙 4). IMF 건 하나에 더한다.
- **U03:** 묶음 A에서 유일하게 기사 제목을 글자 그대로 옮겼다. 조사 도구가 돌려준 글자라 한 글자까지 같다는 보증이 없다. 다른 「보도 기준」 행처럼 「…보도(매체)」로 쓴다.

```diff
--- a/scripts/eraForesightNotes.ts
+++ b/scripts/eraForesightNotes.ts
@@
         who: '보건복지부',
         role: '정부 부처',
-        work: '기사 「정부, 기본소득 제도화 착수…2027년 시범사업」(아시아경제)',
+        work: '기본소득 제도화 착수 보도(아시아경제)',
         year: 2026,
@@
         said: '인간 수준의 AI(AGI)가 2029년까지 나온다고 내다봤습니다.',
-        gap: '발언은 2029년, 게임은 2030년입니다.',
+        gap: '내다본 해는 2029년, 게임은 2030년입니다.',
       },
@@
         said: 'AI 연구자 설문은 모든 과제에서 기계가 사람을 앞서는 시점을 2047년경으로 내다봤습니다.',
-        gap: '설문은 2047년경, 게임은 2030년이라 17년 차이가 납니다.',
+        gap: '설문이 내다본 해는 2047년경, 게임은 2030년이라 17년 차이가 납니다.',
       },
@@
         said: '대부분의 시나리오에서 AI가 전체 불평등을 키울 것으로 내다봤습니다.',
-        gap: '불평등 일반론이며 투자가 AI를 가진 쪽에 몰린다는 직접 전망은 아닙니다.',
+        gap: '불평등 일반론이며 투자가 AI를 가진 쪽에 몰린다는 직접 전망은 아닙니다. 2030년은 게임이 정한 시나리오입니다.',
       },
```

적용 순서: `npm run gen:era` → `npm run gen:era -- --check` → `tests/eraForesight.test.ts`·`tests/fonts.test.tsx`·`tests/eraWindows.test.ts`.

### R-610 [NEW] [낮음] src/data/sceneText.ts:37 — 근거 칸 소개 문장이 사실과 다르다

「이 장면을 그릴 때 참고한 말과 자료입니다.」는 사실이 아니다. 근거들은 묶음 A 그림이 승인된 뒤에 조사됐고, U09의 유일한 근거는 반대 근거다.

```diff
--- a/src/data/sceneText.ts
+++ b/src/data/sceneText.ts
@@
   foresightOpen: '근거 보기',
-  foresightIntro: '이 장면을 그릴 때 참고한 말과 자료입니다.',
+  foresightIntro: '이 장면과 관련된 말과 자료입니다.',
   foresightReported: '보도 기준',
--- a/tests/eraChip.test.tsx
+++ b/tests/eraChip.test.tsx
@@
-    expect(body).toContain('<p class="log__why-intro">이 장면을 그릴 때 참고한 말과 자료입니다.</p>');
+    expect(body).toContain('<p class="log__why-intro">이 장면과 관련된 말과 자료입니다.</p>');
--- a/e2e/era-chip.spec.ts
+++ b/e2e/era-chip.spec.ts
@@
-  await expect(body).toContainText('이 장면을 그릴 때 참고한 말과 자료입니다.');
+  await expect(body).toContainText('이 장면과 관련된 말과 자료입니다.');
```

`tests/fonts.test.tsx`가 「조각 밖 글자」를 알리면 FU6 절차대로 s2·s3만 다시 만든다.

## A. 코어 2회차 — 결과
- 지난 지적 R-596·R-597·R-598·R-599·R-603·R-604·R-605·R-606·R-607은 모두 diff 그대로 들어갔다. R-597은 HEAD에서 실패한다(R-608).
- 처음 켜진 `describe.runIf` 7개는 공허하지 않다. 재는 해 14/87(2026~2029 사건 4 + 2030년대 10), 그림 닿음 8,484칸, 3해 연속은 2031~39 일상 구간을 실제로 걷는다, basis는 2026 둘 없음·열 장 있음, 줄 규칙 12줄, band 짝 U02↔U01·U06·U08↔U07. 예외: 0~12세 시험의 `ages` 절반은 지금 미래 장면에 `ages`가 없어 재는 것이 없다(데이터가 오면 켜지는 보호 장치).
- R-596은 「데이터 ↔ 합성 표 ↔ SPEC 원문」 사슬을 만든다. U09·U10 새 줄이 셋 모두에서 맞음을 보였다. R-597이 빨간 동안 사슬의 SPEC 쪽 끝이 끊겨 있다.
- R-603은 2030년대 band·ages 없는 무겁지 않은 일상이 정확히 2장(U09·U10)임을 잡는다.
- 코드: `EraForesight` 타입, `EraRow.foresight`·`isForecastYear`(순수 함수) 추가뿐. CR-CORE·RNG·SAVE 위반 없음.

## B. UI·데이터 1회차 — 결과
1. **FU11 근거 글 13건:** 요약 13/13이 문서 요약의 부분 문자열(넓혀 쓴 곳 없음), 어긋남 13/13 뜻이 같음, 연도 13/13 같음, 보도 기준 5 = 2차 5, 반대 1 = 반대·유보 1, 원문이 먼저, 직접 인용 0, 정치인 0(IMF 총재 글은 기관 이름). 직함 두 곳(「대학 연구팀」, 「연구자 2,778명 설문」)은 뜻이 같아 허용. 시점 차이는 U07·U08만 R-609.
2. **칩·근거 칸:** 접근성(판단 7) 문제없음, 진짜 `<button>`·Enter·Space 시험 있음, 가린 줄에서 단추 숨김(판단 8) 맞음, `<details>` 대신 단추(판단 6) 수용, R-571과 충돌 없음(펼침은 줄 안 상태만 바꾸고 기억한 줄 거리는 그대로), 다크·강제 색상·360·320·200%는 CSS와 e2e로 덮임.
3. **`data-dec`·`data-future`·R-601·판단 4·5:** 문제없음. R-601은 `div role="img"`(`data-end`)로 링크 0, 2110은 링크로 남음, 시험 3개.
4. **판단 2·3:** 쉼표 나열 수용. 골든 필터 `years[0] ≤ 2025`는 실제 풀과 결과가 같은 번호표 고정이라 공허하지 않다.
5. **FU9·FU6·로드:** FU9 시험은 덩어리 gzip(근거 글 포함)으로 잰다. 근거 이름이 덩어리 밖 `src`에 없음을 시험이 잰다. 글꼴·초기 로드 수치는 작업자 값.
6. **승인 표기:** 생성기 가드 r6 12장·합 106. r7·r8은 `SOURCES`에 없다. U09·U10 줄은 승인 표기와 같다.

## 마스터 판단 거리 (지적 아님)
1. U12는 「먼저」 줄 목록과 「후보 없는 줄」 목록 둘 다에 있다. 지금 근거 칸도 설정 안내도 없다. 근거 없이 안내 한 줄만 다는 칸(notes 0건 + byBand)을 허용할지.
2. `future-foresight-quotes.md` 6절은 비발트 실험을 반대·유보로 세는데, 1절 표 행에는 [반대] 표시가 없다.
3. 출시 전 주소 대조 목록에 커즈와일 행(「AGI 2029는 기자 서술」)과 「」로 옮긴 자료 제목들을 더한다.
4. SPEC-010 표와 조사 문서 1절은 시험이 직접 읽는다. 행 모양을 바꾸면 시험이 멈춘다. 고친 뒤 `tests/eraFuture.test.ts`·`tests/eraForesight.test.ts`를 함께 돌린다.

## 후속
- R-609, R-610: 이번 R-608 회차에 함께 적용. 기존 조건 줄 R-600·R-602(묶음 C)는 그대로.

## QA에 넘길 것 (표준 — 해당 화면만)
1. 2030년 판(재력 1·3·5): 칩과 근거 종류 글자, 「근거 보기」를 마우스·Enter·Space로 열고 닫기, 칸의 글이 U06·U07·U08 근거와 맞는지, U11·U12 해에는 단추 없이 글자만.
2. 근거 칸을 펼친 채 1배속·8배속 진행에서 읽던 줄이 밀리지 않는지(R-570~R-572 회귀).
3. 360·320·글자 200%·다크·강제 색상에서 펼친 칸의 넘침 0, 긴 영문 제목 줄바꿈.
4. RECORD: 단추의 44px 누르는 영역이 아래 문장 첫 줄 위쪽 약 12px을 덮는다. 문장 위쪽을 누르면 칸이 열리는지 적는다.
5. 스크린리더 한 번: 줄 「예측, 가상 시나리오. 근거 보기」(단추, 접힘) 다음 문장, 창 「시대의 창 · 예측: … 그해 기록으로」.
6. 2030년대 덩어리 요청을 막은 판: 2030년 뒤 창이 빈 틀이고 시대 줄이 없는지.

위험도: Two-way / 파급 낮음 (diff는 시험·생성기 입력 글·화면 문구 한 줄뿐이다. 실명 근거 글은 main 병합·배포 전이라 되돌릴 수 있다. 배포 전에 판단 거리 3번 대조를 권한다)

## 마스터 처리 (2026-11-04)
- B는 APPROVED 수용. A의 R-608은 리뷰 뒤 SPEC이 다시 바뀌었다(r2가 본표에 반영돼 U27~U46, 46행 — cdced17). 그래서 diff의 ①(표지 건너뛰기)은 쓰지 않고, **합성 표를 r2 46행으로 갈고 단언을 46행으로** 바꾼다(FU7 범위). ②(U23 새 줄, `ACTION_ALLOW_LINES` 0줄)는 diff 그대로.
- R-609·R-610은 diff 그대로. 근거 칸 소개 문장은 「이 장면과 관련된 말과 자료입니다.」로 정한다.
- 판단 거리 1: 근거가 없는 수저별 「먼저」 줄(U12, r2의 해당 줄)에도 「수저별 차이는 게임의 설정입니다.」 한 줄만 다는 칸을 허용한다(notes 0건 + byBand).
- 판단 거리 2: 조사 문서 1절의 비발트 행에 [반대·유보] 표시를 단다(6절과 맞춤).
- 판단 거리 3: 출시 전 대조 목록에 더한다(TODO).
- 묶음 B 데이터 반영 때 3회차(변경분만)로 A를 다시 본다.

## 반영 내역 (developer, 2026-11-04 — REV-010-UI-1 「마스터 처리」 기준, 커밋은 마스터가 만든다)

검수자 diff는 해석·변형 없이 적용했다(R-608은 마스터 처리대로 ①을 r2 46행으로 바꿈). 적용 뒤 시험을 다시 돌렸다.

| 지적 | 적용 | 곳(파일) | 시험 |
|---|---|---|---|
| R-608 ② U23 새 줄 · `ACTION_ALLOW_LINES` 0줄 | diff 그대로 | `tests/helpers/eraFutureData.ts`(U23), `tests/helpers/eraFutureForbidden.ts#ACTION_ALLOW_LINES`, `tests/eraFuture.test.ts` 「주인공 행동 낱말(2027년 이후)」 | 옛 줄 「…올라갔습니다.」이 이제 걸린다는 단언 포함 |
| R-608 ① (마스터 처리: r2 46행으로) | 합성 표 `FUTURE_TABLE`을 SPEC 본표 U01~U46으로 갈고(U27~U46 r2), R-597 시험의 정규식이 번호 칸의 `U39 ○`와 `→ **가상 시나리오**`(굵게)를 읽게 하고 단언을 46행으로 | `tests/helpers/eraFutureData.ts`, `tests/eraFuture.test.ts` 「표의 줄·해·구간·무거움·basis가 SPEC-010 문서의 연표 표 원문과 같다」 | 46행 전부 맞음 |
| FU7 번호 갈이 | 장수·집계(공식 10 · 전문가 4 · 가상 29)·band 13장·heavy U39·사건 해(2065·2075·2085·2095)·끝 장면 U46·가리기 U39→U41·U42·`['U15','U22','U32','U36']`(옛 U33·U40 주석) | `tests/eraFuture.test.ts` | 52개 통과 |
| 나라 이름 시험 | `COUNTRY_NAMES`에 한국·미·중·미중을 더하고 허용 줄(U02·U24·U38·U43)과 낱말을 `COUNTRY_ALLOWED`로 따로 두고, 허용 줄에도 전쟁·충돌·정권·군사 낱말 0을 건다. 실제 데이터 쪽도 같은 허용 줄만 본다 | `tests/helpers/eraFutureForbidden.ts`, `tests/eraFuture.test.ts` 「나라 이름은 경제·인구·국제 질서 사실 줄에만…」 | 「미·중」·「한국」이 허용 줄 밖이면 멈춘다는 공허 방지 단언 포함 |
| R-609 | diff 그대로(U03 기사 제목 → 「기본소득 제도화 착수 보도(아시아경제)」, U07 「내다본 해는…」, U08 시나리오 문장) | `scripts/eraForesightNotes.ts` → `npm run gen:era` → `d2020.ts`·`d2030.ts` | `tests/eraForesight.test.ts`, `gen:era -- --check` |
| R-610 | diff 그대로(소개 문장 「이 장면과 관련된 말과 자료입니다.」) | `src/data/sceneText.ts#SCENE_TEXT.foresightIntro`, `tests/eraChip.test.tsx`, `e2e/era-chip.spec.ts` | `tests/eraChip.test.tsx`, e2e `era-chip` |
| 판단 거리 1: 근거 없는 「먼저」 줄 안내 칸 | `EraForesight.notes` 빈 목록 + `byBand`(U12·U20). 생성기는 부유한 쪽 줄에만 notes 0건을 허용, 화면은 소개 문장 없이 안내 한 줄만 | `src/core/eraWindow.ts#EraForesight`, `scripts/genEraWindows.ts`, `src/ui/dash/EraRow.tsx`, `scripts/eraForesightNotes.ts` | `tests/eraChip.test.tsx` 「근거 글이 없는 수저별 「먼저」 줄…」, `tests/eraForesight.test.ts` |
| 판단 거리 2: 비발트 행 [반대·유보] | 조사 문서 1절 행에 표시를 달았고, 그 근거 글(U06)에 `counter: true`가 필요해져 달았다(표 행 수 69 그대로 — `foresightDoc`의 행 수 단언은 바뀌지 않았다) | `docs/data/future-foresight-quotes.md`, `scripts/eraForesightNotes.ts` | `tests/eraForesight.test.ts` 「보도 기준 … 반대 근거」 |
| 판단 거리 3: 출시 전 주소 대조 | TODO에 줄 추가 | `docs/TODO.md` | – |
| 판단 거리 4 | 행 모양을 바꾸지 않았다. 두 시험을 함께 돌렸다 | – | `tests/eraFuture.test.ts`·`tests/eraForesight.test.ts` |

묶음 B 데이터 반영은 `ai-log/2026-11-04_SPEC-010_dev-b.md`. 3회차(변경분만)로 A 코어를 다시 볼 때 이 회차의 변경 파일: `tests/eraFuture.test.ts`·`tests/helpers/eraFutureData.ts`·`tests/helpers/eraFutureForbidden.ts`(시험만), `src/core/eraWindow.ts`(타입 주석), `src/ui/dash/EraRow.tsx`(소개 문장 조건 한 줄).

## 반영 내역 2 (developer, 2026-11-05 — 묶음 C 데이터 회차: 지난 지적 R-600·R-602 조건 줄 + 3회차(변경분만) 입력, 커밋은 마스터가 만든다)

새 지적 반영은 없다(이번 회차는 REV-010-UI-1 이후 새 `CHANGES_REQUESTED`가 없다). 기존 조건 줄 R-600·R-602와 묶음 C 데이터(FU5(C)·FU6·FU9·FU11)를 넣었다. 정본: `ai-log/2026-11-05_SPEC-010_dev-c.md`.

| 지적·조건 | 적용 | 곳(파일) | 시험 |
|---|---|---|---|
| R-600(낮음, 묶음 C 조건) | 「다 들어왔는가」 시험을 `REAL_COVERED_FUTURE_YEARS.length` 87 · `REAL_FUTURE_WINDOWS.length` 46으로 바꾸고 `console.log` 삭제 | `tests/eraFuture.test.ts` | 「실제 데이터가 다 들어왔다」 |
| R-602(낮음, 묶음 C 조건) | 끝 장면 U46 `era-end-horizon`만 `decade = 2100` 고정(`END_SCENE`), 「10년을 넘는다」 가드·basis 검사는 `kind: 'base'`만 예외(id·해가 END_SCENE과 다르면 막고, 끝 장면에 basis·근거 글이 있으면 막음), 시험은 `kind: 'base'`만 예외 | `scripts/genEraWindows.ts#END_SCENE`, `src/data/eraWindows/d2100.ts`, `tests/eraWindows.test.ts` | 「모든 장면은 approved: true이고…」·「승인된 그림이 있는 10년대는 모두 자기 덩어리를 받는다」·`tests/eraFuture.test.ts` 「표 끝 뒤(구현 규칙 3, R-602)」·e2e `era-chip` 「표 끝 뒤(R-601·R-602, 실제 데이터)」 |
| 묶음 C 회차 조건(BORROWED_ROWS) | 「SPEC 새 번호 → 조사 문서 행 번호」 표 `DOC_NUMBERS_OF`(U01~U46)와 7-1절 읽기(`R2_ROWS`) | `tests/helpers/foresightDoc.ts` | `tests/eraForesight.test.ts` 「SPEC 번호 → 문서 행 번호 표(DOC_NUMBERS_OF)는 U01~U46을 모두 갖고…」 |
| 판단 거리 4(행 모양을 바꾸면 시험이 멈춘다) | 조사 문서는 고치지 않았다(표 모양 그대로) — 시험이 7-1절 15행도 읽는다 | `docs/data/future-foresight-quotes.md`(읽기만) | `tests/eraForesight.test.ts` 「문서 표를 읽었다」 |

3회차(변경분만) 검수 입력 — 이번 회차에 바뀐 파일: `scripts/genEraWindows.ts`(r9·`END_SCENE`·가드 140) · `scripts/eraForesightNotes.ts`(묶음 C 구간 18칸) · `tests/helpers/foresightDoc.ts` · `tests/eraWindows.test.ts`(17덩어리·140장·base 예외·「덩어리를 못 받은 판」) · `tests/eraForesight.test.ts`(40칸·묶음 C 시험 7·`rowOf` 요약 우선) · `tests/eraFuture.test.ts`(R-600·실제 끝 장면 시험 1) · `e2e/era-chip.spec.ts`(끝 두 판) · 생성 파일 `src/data/eraWindows/d2060.ts`~`d2100.ts`·`index.ts` · 글꼴 s2·s3(`src/assets/fonts/NotoSansKR-*.s2·s3.woff2`·`src/styles/fonts.css`) · `docs/TODO.md`. `src/core/`·`src/ui/`는 이번 회차에 바뀐 것이 없다. 켜진 실제 데이터 시험 7개는 수정 없이 통과했고(재는 해 87/87), 추가한 시험 쪽 판단은 dev 로그 6절에 적었다.
