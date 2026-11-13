# CX-004 처리 결과 (Claude 마스터)

- 대상: `findings.md`(Codex, 2026-11-13 19:05~19:37 KST, 판정 `FINDINGS` — 중간 1·관찰 1·요구 문구 확인 1). 원문은 고치지 않았다.
- 처리 커밋: `29731c4`(삭제 · FAQ 문구) — 전체 `npm test` 226파일 · 5,558 통과 · 실패 0. 재검증 요청 `request-2.md`

## 1. 지적별 처리

### CX-004-001 (중간) — 비맞춤 저장의 엔딩까지 새 분포표로 재판정된다
- **재현**: 예. 지적의 seed 25 알파(맞춤 제외)를 같은 종료 상태로 세 표에 넣었다 — 현행 표 `23 · same`, `4a453cd` 표 `22 · down`, **배포된 v0.5.1(`6dcb7f8`) 표 `25 · same`**. 7세대 × seed 1~30 맞춤 없는 자동 인생 210판에서 현행 표는 `4a453cd` 표와 115판, **v0.5.1 표와 202판(이동 판정 9판)** 이 달랐다. 어긋남은 이번 PL5만이 아니라 맞춤 인생을 켠 M1(`736d15a`)부터 분포표를 「맞춤이 켜진 세상」으로 다시 만들어 온 결과다.
- **처리 — 형진 님 결정(결정 후속 256)**: 「출발선 대비 자리는 한 삶을 살아보고 와닿지 않은 엔딩 콘텐츠」라 **엔딩의 「출발선 대비 자리」를 삭제**한다. 분포표 자체가 없어지므로 맞춤 없는 판의 엔딩 판정 회귀도 함께 사라진다. 대신 엔딩 크레딧을 Codex가 기획·디자인한다(`docs/design/codex/DSN-001-ending-credits/request.md`).

### 관찰 — 수저 1 · 방임 양육 판의 G2 야간 몫 평균 61.8%
- 명세 8(e)의 칸(수저 × 예술·운동 단계)으로는 60%를 넘지 않아 결함이 아니다(Codex도 단정하지 않음). `report:persona`가 양육 방식별 분모·평균도 내도록 후속으로 둔다(`docs/TODO.md`).

### Q5 「부모 카드가 새로고침 뒤 사라진다」
- 기존 계약(PD7-5 — 부모·흘러감 카드는 그 해 안에서 해결돼 기록만 남는다, `src/ui/dash/ParentCard.tsx:26`·`e2e/parent-card.spec.ts:77`)대로다. 요청서 Q5의 「같은 카드·같은 후보로 이어진다」는 본인 결정 카드에만 맞는 문구였다 — **요청서 작성 오류**, 제품 변경 없음.

## 2. 삭제 — 구현 전 위험·영향·복구 계획 (CRITICAL)

**지운다**
- 엔딩 화면의 「출발선 대비」 카드: 막대·범례·도착 자리 문장·이동 판정·안내 줄(`src/screens/EndingScreen.tsx`, `src/data/endingText.ts`의 해당 문구, `src/styles/dash.css`의 `.journey*`).
- 코어: `EndingReview.journey`·`WealthJourney`·`Movement`·`movementOf`·`finalMovementOf`·`BAND_GRACE`·`finalWealthStanding`·`FinalDistribution`·`validateFinalDistribution`·`reviewEnding`의 표 인자(`src/core/ending.ts`) — 다른 곳에서 쓰지 않는 것만.
- 데이터·도구: `src/data/finalDistribution.ts`, `scripts/finalDistribution*.ts`·`checkFinalDistribution.ts`·`endingRatios.ts`·`endingReadback.ts`, 경제 점검·파이프라인·가족 재측정·1000판 보고의 이동 판정 집계.
- 시험: 지운 기능만 지키던 시험(분포표 재생성 일치·엔딩 판정 균형 R-091·출발선 막대 색·문장·이동 판정)은 이유를 적고 걷어 낸다.

**남긴다**
- 룰렛·출생신고·프로필의 수저 구간(`startBandOf`·`bandLabel` — 「흙수저(하위 25% 안쪽)」): 출발점 정보라 엔딩 비교와 다르다.
- 출생 화면의 외모·체중 백분위 표기(`src/core/standing.ts`), 엔딩의 최종 스탯(처음 값 비교 `birthStats`)·최종 순자산 줄(20세 이상)·연표·플레이 시간·「다시 태어나기」.

**위험과 대응**
| 위험 | 대응 |
|---|---|
| 저장 호환 — 엔딩 저장에 회고 값이 들어 있다면 옛 저장이 깨진다 | 회고는 저장하지 않고 열 때마다 계산한다(확인 후 시험으로 잠근다). `SCHEMA_VERSION` 9 그대로, 저장 필드 변경 없음 |
| 최종 순자산 줄이 `journey.kind === 'compared'`에 기대고 있다 | 조건을 「20세 넘어 마친 판(`reachedIndependence`) ∧ 자산 있음」으로 바꾸고 20세 전후 시험으로 잠근다 |
| 출생 쪽 부품(`startBandOf`·`standing.ts`)을 함께 지워 룰렛·출생신고가 깨진다 | 남길 목록을 시험(룰렛·출생신고·프로필의 구간 글자)으로 확인한다 |
| 경제 점검·파이프라인 시험의 다른 검증(불변식·저장 왕복·1000판 예외 0)이 같이 약해진다 | 이동 판정 집계만 걷고 나머지 단언은 그대로 둔다. 걷은 단언 목록을 이 문서 3절에 적는다 |
| 첫 로딩 크기 | 표가 첫 덩어리에 있었다 — 줄어든다. `e2e:prod`로 잰다 |
| SPEC-017(첫 장면·사망 기록 문서)이 「출발선 막대가 남는다」고 가정 | 명세에 메모를 달고, 엔딩 크레딧(DSN-001) 결과와 함께 정리한다 |

**복구**: 삭제는 커밋 하나로 묶는다. 되돌릴 때는 그 커밋을 되돌리면 표·도구·시험이 함께 돌아온다(저장 형식 변경이 없어 사용자 저장에는 영향이 없다).

**검증**: T0 · 영향 범위 vitest · 엔딩·출생·룰렛 e2e · `e2e:prod`(스모크·첫 로딩) · 전체 `npm test` → **Codex 재검증(CX-004 2회차)**: 삭제가 남길 것을 건드리지 않았는지, 시험을 걷어 낸 근거가 맞는지.

## 3. 구현 기록 (developer, 2026-11-13 — 커밋 전, 마스터 검토 대기)
상세는 `ai-log/2026-11-13_CX-004_dev.md`. 저장 형식·`SCHEMA_VERSION` 9·사건 데이터·확률·경제 계수는 바꾸지 않았다. 회고(`reviewEnding`)는 저장하지 않고 열 때마다 계산한다(`src/core/storage.ts`에 회고 필드가 없다 — `tests/endingBar.test.tsx`가 저장 JSON에 `journey`가 없고 저장 왕복 뒤 같은 회고임을 잠근다).

**지운 것**: 엔딩 출발선 카드(`src/screens/EndingScreen.tsx`)·`journeyText`·`journeyBarLabel`·`MOVEMENT_TEXT`·`JOURNEY_NOTE`·`JOURNEY_BAR_LEGEND`·`ENDING_HEADINGS.journey`·`.journey*` CSS · 코어 `EndingReview.journey`·`WealthJourney`·`Movement`·`movementOf`·`finalMovementOf`·`BAND_GRACE`·`finalWealthStanding`·`FinalDistribution`·`QUANTILE_COUNT`·`shareAtLeast/AtMost/Below`·`validateFinalDistribution`·`standingScore`·`reviewEnding`의 표 인자 · `src/data/finalDistribution.ts` · `scripts/finalDistribution{,Lib,Diff}.ts`·`checkFinalDistribution.ts`·`endingRatios.ts`·`check:dist` · 경제 점검·파이프라인·가족 재측정·R1 스냅숏의 이동 판정 집계와 가드(`end-down4·5`, `auto-up`) · `e2e/m7e3-ending-colors.spec.ts`.
**남긴 것**: `startBandOf`·`bandFromRange`·`StartBand`·`bandLabel`(수저 구간), `reachedIndependence`, `COMPARABLE_STATS`, `src/core/standing.ts`, `scripts/endingReadback.ts`의 `numbersIn`·`readBand`(수저 구간 문구 독립 읽기), `EXPECTED_START_BANDS`, `src/ui/KeepStanding.tsx`(고아 — 마스터 판단).

**걷은 시험(이름 · 이유)** — 전체 목록은 ai-log 같은 날 `CX-004_dev.md`의 「걷은 시험」 절. 요약: 분위수표 묶음(자리 구하기·점수·재생성 일치·생성기·표 합리성), 방향 판정(`movementOf`·여유·천장·균형 R-091·`FIFTH_TIER_DOWN_CEILING` 관련 상한·0원 이하 앞섬 없음·화면 숫자와 판정 전수), 출발선 막대 그림·색·범례·읽기용 이름, 도착 자리·이동 판정 문장, 20세 전 사망의 「…의 집에서 태어났습니다」 문장과 `early/compared` 구분, `checkEnding`의 방향·구간·도착 자리 점검 4개, 1000판의 앞섬/비슷함/뒤쪽 하한, `movementShares`·`end-down4/5`·`auto-up`, 가족 재측정 ③(판정 변화 ≤ 2%p). 이유는 모두 「그 기능만 지키던 시험 — 기능이 없다」. 같은 파일의 다른 단언은 남겼다(이동 판정만 걷은 단언 목록은 ai-log 참조).
**새로 잠근 것**: 엔딩 서버 렌더에 `ending-journey-section`·`ending-bar`·`ending-movement`·`ending-legend`·`ending-note` 등이 없다 · 최종 순자산 줄은 20세 넘어 마친 판에만 금액(20세 전은 안내 한 줄) · 저장 왕복 뒤 같은 회고·회고 키 4개 · `.journey` CSS 없음 · 경제 가드 목록·`END_LIMITS`·스냅숏 키 목록에 방향 항목 없음 · 1000판 `endings.adult + endings.early = 판 수`.
**R1 스냅숏**(`tests/fixtures/r1-economy-snapshot.json`): 분위수표·이동 판정·`end-down4·5`·`auto-up`·`finalDistributionPlays`를 걷고 `livesHash` 둘만 다시 산출(무작위 641f08a0 → f2546eee, 자동 04a9e5fb → 816aeb7d — 판 끝 해시의 입력에서 이동 판정 칸이 빠졌다). `rowsHash`·표·목표 19개·나머지 가드·사망 시점 순자산·`reportTime`은 `tests/economyIdentity.test.ts`가 한 글자도 안 바뀐 것을 확인한다.
**TODO**: 닫힌 `[x]` 약 28줄이 지운 파일·심볼·테스트 제목을 근거로 적어 `check:todo`가 110건 실패했다. 지운 파일은 「구 …」, 스크립트는 `(삭제됨)`, 심볼은 `(삭제됨: …)`, 테스트 제목은 「」로 표지만 바꿨다(기록 내용은 그대로).
**시험 결과·첫 로딩 크기**: ai-log `2026-11-13_CX-004_dev.md` 1회차 「시험 결과」.
**마스터 처리(2026-11-13)**: FAQ 문구 `src/data/aboutFaq.ts`의 「엔딩에서는 출발선과 최종 순자산을 견줘 볼 수 있어요」 → 「엔딩에서는 마지막 상태와 순자산, 지나온 생애 연표를 돌아볼 수 있어요」(FAST 문구, `docs/design/copy.md` 13-3 정본도 같이, `tests/aboutFaq.test.ts`가 대조) · 고아 부품 `src/ui/KeepStanding.tsx`는 이번에 지우지 않고 후속(`docs/TODO.md`)으로 둔다 — 지우면 e2e·`designAssets`·CSS 주석까지 번져 이번 삭제의 검증 범위가 커진다 · `releaseNotes.ts`의 v0.x 기록 줄은 지난 배포 기록이라 그대로 둔다.
