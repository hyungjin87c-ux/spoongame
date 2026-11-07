# 2026-11-07 SPEC-009/010 v0.4.0 — 배포 전 점검 실패 수리 + 새 소식·버전 (경량·표준 혼합, 커밋은 마스터)

- 누가: developer
- 무엇을: 2026-11-06 배포 전 전체 점검(`ai-log`에 보고만 있음)에서 나온 진짜 실패 3건을 고치고, v0.4.0 새 소식·버전을 넣었다. 커밋하지 않았다.
- 다음 단계: 마스터가 검수(sonnet, 1번 코어 규칙) → 푸시 체크리스트 → main 빨리 감기·푸시·DP8 → 형진 님 플레이테스트.

## 1. 버그 — `m7e3-ending.spec.ts:143` (0원·재력 1단계가 Z세대·알파에서 「앞선 자리」) · 마스터 결정 2026-11-07(배포 전 점검, 결정 C 보강)
- 규칙: 최종 순자산이 0원 이하(빚 포함)로 마친 판은 출발선과의 비교가 「앞섬」이 될 수 없다. 계산상 앞섬이면 「비슷함」으로 읽는다. 「뒤쪽」·자리 문장(`finalWealthStanding`)·점수(`standingScore`)는 그대로다.
- 원인(조사): 분포표를 다시 만든 8cb3cb1에서 Z세대·알파의 0원 자리가 하위 27% → 28%로 한 칸 옮겨 1단계 출발선([0, 25])의 여유(25 + 2)를 넘었다(`probe`: genz·alpha 재력 1단계 0원 = 도착 28, 앞섬).
- 고침:
  - `src/core/ending.ts`: `finalMovementOf(band, end, net, grace)` 추가(= `movementOf`에 0원 이하 상한). `reviewEnding`이 이 함수를 쓴다. `movementOf`는 그대로(순수 구간 판정). 주석에 「마스터 결정 2026-11-07(배포 전 점검, 결정 C 보강)」.
  - 독립 읽기 기준·측정 스크립트를 같은 규칙에 맞췄다: `scripts/endingReadback.ts#expectedMovement`(선택 인자 `net`), `scripts/pipelineLib.ts`(1000판 문장 대조에 `net` 전달), `scripts/economyCheckLib.ts`·`scripts/endingRatios.ts`(화면과 같은 규칙으로 센다).
- 시험(`tests/ending.test.ts`):
  - 새 describe 「0원 이하로 마친 판은 앞섬이 없다」 5개: 프로필 8종 × 재력 1~5 × 0원 / 빚(−1·−100·−5000·−200000) → 앞섬 아님 · 규칙 대조(0원이 위쪽 끝 위에 있는 표를 주입해 계산상 앞섬 → 비슷함, 0원보다 크면 그대로 앞섬 — 공허 통과 방지) · 가능한 모든 구간 5151 × 점수 1~99 × 순자산 {−5, 0, 1, 7}에서 `finalMovementOf`가 「0원 이하의 앞섬만 비슷함」이고 읽기 기준과 같다 · 0원보다 큰 값(1·10·1000·100000)은 `movementOf`와 같고 5단계 0원은 뒤쪽 그대로.
  - 기존 시험 3곳을 같은 규칙으로: `reviewEnding` 방향 = `finalMovementOf`, 방향 균형 표본(`tallyByStage`)도 같은 규칙, 11990판 문장 대조(`expectedMovement(…, l.net)`; 0원 이하의 「비슷함」은 구간 밖 여유 검사에서 제외하고 `cappedSame > 0`로 공허 통과 방지, 0원 이하 앞섬이면 실패).
  - 0원보다 큰 값의 판정은 기존 시험이 그대로 통과했다(`tests/ending.test.ts` 87개 통과).
- 영향 수치: `check:economy` 통과(알려진 차이 목표 7건·가드 6건, 그대로). 알파 자동 모드 「앞섬」 31.7% → 26.1%(0원 흙수저가 앞섬으로 읽히던 판이 비슷함으로) — 산업화·X세대·R1은 변화 없음.
- `e2e/m7e3-ending.spec.ts:143` 통과(mobile-360).

## 2. 시험 상수 — `m7b-cite-lines.spec.ts:108` (`EXPECTED_CELLS` 91 → 95)
- 원자료에서 칸마다 센 결과 95칸(결정 카드 92 + 기록 카드 3). 늘어난 4칸은 FM7a(6661818)의 변형 사건 `middle-parents-care-mother-gone`·`middle-parents-care-father-gone`이 인용 c-081을 지금·다가올 세상에 이은 것(2건 × 2세상). 별세 사건(`middle-parents-farewell-*-gone`)은 선택지(stay·late·share)는 있지만 인용이 없어(`noCitation: "X2"` — 원본 `middle-parents-farewell`과 같다) 칸에 들지 않는다(검수 R-649로 바로잡음).
- 고침: `EXPECTED_CELLS = 95`와 사유 주석, 오류 문구·제목 칸 수(91 → 95, 결정 카드 88 → 92). 줄바꿈 단언까지 돌았다: 320 인라인 × 글자 100·150·200% 3건 통과.
- `check:todo`는 제목의 칸 수가 바뀌어도 통과(실패 0·경고 0).

## 3. 조사 — WebKit `auto-from-sheet.spec.ts:317` 간헐 실패
- 제품 문장: `EndingScreen#PlayTimeBlock` → `PlayTime`이 낭독용 「{m}분 {s}초」(sr-only) + 눈에 보이는 `mm:ss`(aria-hidden)를 붙여 낸다. `mm`은 두 자리 **이상**이다(분 상한 없음, 100분 = `100:00`, `core/playClock.ts#formatPlayTime`, copy.md 8-2).
- 원인: 시험 URL `?__timescale=2000`에서 실제 3초가 가상 100분이라 WebKit 모바일에서 느리게 끝난 판은 `mm`이 세 자리가 된다. 시험이 `\d{2}:\d{2}`로만 가려 세 자리의 앞 숫자 `1`이 남았고(`N초1mm:ss`) 두 판(카드 버튼·도구 줄)의 문장이 갈렸다. **제품이 두 화면에서 다르게 만든 것이 아니다**(시험 쪽 정규식).
- 고침: `e2e/auto-from-sheet.spec.ts`의 가리기 정규식을 `\d{2,}:\d{2}`로, 사유 주석. 이전: webkit-mobile-360 3회 중 2회 실패(`--repeat-each=3`) → 이후 6회 모두 통과.

## 4. v0.4.0 새 소식·버전 (경량, 형진 님 확정)
- `docs/design/copy.md` 13-2: 제목 「v0.4.0」(초안 표시 뺌), 날짜 `2026-11-07`, 6번을 확정 문장으로(70자: 「부모님 한 분·조부모와의 이별, 부모님의 별거, 드물게 어린 형제와의 이별까지 가족의 큰일이 기록·카드·그림에 함께 나타나요.」), 근거 열에 T06 승인·계획 스위치(`familyApproval.ts` T06 `approved: true`, `familyTables.ts` `design.siblingLoss.enabled: true`) 추가, 「버린 후보」에서 6번 대체 문장을 빼고 채택 줄로, 원칙 점검 줄(최대 70자·6번). 13-5 표는 v0.3.0도 열이 없어 더하지 않았다.
- `ai-log/2026-11-06_SPEC-009_design-release-notes-v0.4.0.md`에 「형진 님 확정으로 6번에 채택」 줄을 덧붙였다.
- `src/data/releaseNotes.ts` 맨 위에 v0.4.0(요약 + 8항목)을 copy.md 문구 그대로(표에서 읽어 옮겨 글자 수 70·≤70 대조). `package.json`·`package-lock.json` version `0.4.0`.
- 버전을 올려서 깨지는 e2e 상수를 맞췄다(`e2e/info-panel.spec.ts`): 새 소식 버전 4 → 5개(v0.4.0 맨 위, 앞 3개 펼침), `notesSeen` `0.3.0` → `0.4.0`, 뱃지 시험에 「0.3.0까지 본 사람에게도 뜬다」 추가, 의견 보내기 주소의 빌드 표기 `v0.4.0`, 상자·행 수 5.

## 돌린 시험 (모두 마지막 상태 기준)
- `npm run typecheck` 통과 · `check:todo` 통과(352개, 실패 0·경고 0) · `check:events` 통과 · `check:economy` 통과.
- vitest 전체(`npm test`): **174 파일 · 4872 통과(점검 때 4867 + 새 시험 5) · 1 건너뜀 · 0 실패**(24분 9초). `tests/ending.test.ts` 87개, 릴리스 노트 관련 9개 파일 311개 포함.
- Chromium e2e(mobile-360·desktop): `m7e3-ending`·`m7b-cite-lines`·`info-panel`·`link-underline-and-breaks`·`auto-from-sheet` — 첫 실행에서 `auto-from-sheet` 6건이 맨 처음 30초 타임아웃(개발 서버 콜드스타트 흔들림, 점검 때와 같은 패턴), `info-panel.spec.ts:301`은 위 버전 상수(고침). `--workers=1` 재실행 `auto-from-sheet`·`info-panel.spec.ts:301` 31 통과.
- WebKit(`playwright.webkit.config.ts`): `auto-from-sheet`·`info-panel` — 처음 2건(맨 처음 30초 타임아웃) 외 96 통과, `auto-from-sheet` `--workers=1` 28 통과.
- `npm run e2e:prod`(기본 base): 33 통과 · 1 건너뜀(DP8) · 0 실패. 초기 로드 Chromium 380,789 B, WebKit 384,574~384,575 B(한도 400,000).
- e2e가 바꾼 `qa/screenshots/003`은 되돌린다.
