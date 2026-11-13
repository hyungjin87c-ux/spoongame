# CX-004 검증 결과 — 2회차 (Codex 작성)

- 대상 브랜치·커밋: `review/CX-004-r2`, HEAD `9ea1ca379573cb1fcb8ed156901802b5273565da`. 구현 대상 `29731c4c419beb1339f6fcff33a0ca38361f1306`, 비교 기준 `eede085fddc3d36206be8c95cb00729ba67587ee`. HEAD의 제품 코드는 구현 대상과 같다.
- 검토 범위: **A 삭제 구현 감사 + B 엔딩·출생 화면 확인**, 요청서 4절 질문1~6. 삭제한 엔딩 비교 기능 외의 표시·저장·경제 계산·시험 보호가 보존됐는지 검증했다. 엔딩 크레딧과 1회차의 다른 통과 범위는 재검증 대상에서 제외했다.
- 읽지 않은 경로 준수: **예**. 이번 요청 폴더의 요청서·`findings.md`·`resolution.md`, `codex/TEMPLATE-findings.md`, 허용된 `ai-log/2026-11-13_CX-004_dev.md`만 예외로 읽었다. 그 밖의 `docs/review/`, `qa/`, `ai-log/`, `docs/TODO.md`, `wiki/`는 열지 않았다. 저장소 밖 게임 근거 자료를 사용하지 않았다.
- 검증 시작·끝 시각: **2026-11-13 23:30:04 KST → 2026-11-13 23:51:35 KST**.
- 판정: **`FINDINGS` — 낮음 1건**. 높음·중간 0건. 비교 카드 삭제, 남은 기능, 저장 복원에서 새 실행 결함을 재현하지 못했다. 지적은 현재 문서의 정합성에 한정한다.
- 5199 포트: 시작 전 LISTEN 확인 결과 **사용 서버 없음**. 이후 이 작업 폴더에서 `npm run dev -- --host 127.0.0.1 --port 5199 --strictPort`로 띄웠다. 다른 서버를 재사용하거나 종료하지 않았다.

## 지적

### CX-004-101 — 현행 구현 규칙이 삭제된 엔딩 카드와 문구 API를 여전히 요구한다

- 심각도: **낮음**
- 규칙: `NEW` — 재검증 요청서 4절 질문5, 삭제 결정에 따른 현행 문서 정합성.
- 위치: **`docs/design/copy.md:98`·`:99`, `docs/design/design-system.md:197`**.
- 문제: `copy.md`의 「3. 표기 규칙」은 수저 구간의 사용처를 엔딩 출발선 영역까지 **네 곳**으로 적고, `standingLabel`의 용도에 엔딩 도착 자리를 포함한다. `design-system.md`의 「10. 구현할 때」는 엔딩 막대의 `aria-label`을 `MOVEMENT_TEXT[movement]`로 만들도록 현재형으로 지시한다. 실제 카드와 이 공개 문구 API는 이번 변경으로 없어졌다.
- 재현 조건과 근거:
  1. 현행 트리에서 다음 명령을 실행하면 앞 두 검색에 현재 규칙이 나오고, 마지막 검색에는 export가 **0건**이다.

     ```powershell
     rg -n '네 곳 모두|엔딩 도착 자리 전용' docs/design/copy.md
     rg -n '엔딩 출발선 막대의.*aria-label' docs/design/design-system.md
     rg -n '^export const MOVEMENT_TEXT' src/data/endingText.ts
     ```

  2. `npm exec -- vite-node .cx004r2-doc-probe.ts`로 실제 모듈을 import해 추가 확인했다. 임시 탐침은 해당 문서 줄의 요구와 공개 export 존재 여부를 각각 검사했다. 출력은 다음과 같았으며 파일은 삭제했다.

     ```json
     {"copy98RequiresFourPlaces":true,"copy99IncludesEndingStanding":true,"design197RequiresMovement":true,"exportedMovementText":false,"exportedJourneyText":false,"exportedFinalStanding":false}
     ```

  3. 삭제 안내를 못 본 채 과거 기록을 지적한 것은 아니다. `copy.md:191`은 **“이 절”**, `:375`는 **“아래 막대 규격…”**을 옛 기록으로 한정하고, `design-system.md:142`의 삭제 표지도 그 컴포넌트 행에 붙어 있다. 별도 현행 규칙인 위 위치에는 삭제·과거 기록 표지가 없다. 명시적으로 삭제 표시가 된 행과 지난 배포 기록은 지적에서 제외했다.
- 실제 영향: 현재 정본이 요구하는 **네 번째 표시 위치와 공개 API가 존재하지 않아**, 문구·디자인 규칙과 실제 구현을 동시에 충족할 수 없다. 플레이어 화면·저장·경제 계산의 오류는 아니며, 현재 문서의 사용처·구현 지시가 사실과 다른 문제다.
- 권장 대응: 현행 규칙의 수저 구간 사용처를 룰렛·출생신고·프로필로 맞추고 엔딩 도착 자리 용도를 제거한다. 엔딩 막대의 구현 지시는 삭제 사실과 함께 과거 기록으로 구분한다. 남기기로 한 출생 쪽 수저 구간·백분위 함수는 유지한다.
- 미확인 사항: 이 문서 불일치로 새 구현이 잘못 만들어진 사례는 확인하지 않았다. 향후 회귀를 이미 발생한 영향으로 주장하지 않는다.

## 1회차 지적 처리 확인

**CX-004-001의 처리 목적은 달성됐다.** 기능 삭제 결정에 따라 엔딩 비교 카드·범례·도착 자리·이동 판정·안내와 관련 공개 계산 함수, 최종 순자산 분위수표·생성/점검 도구가 제거됐다. 따라서 이전 지적의 「같은 비맞춤 종료 저장이 새 표에 의해 다른 이동 판정을 받는다」는 경로가 남아 있지 않다. 이를 옛 판정이 보존된 것으로 표현하지는 않는다. 비교 판정 자체가 없어진 것이다.

`src/data/finalDistribution.ts`, `scripts/finalDistribution{,Lib,Diff}.ts`, `scripts/checkFinalDistribution.ts`, `scripts/endingRatios.ts`, 막대 색 시험 파일과 `check:dist` 스크립트의 부재를 확인했다. `startBandOf`·`bandLabel`·출생 쪽 `standingOf`, 스탯 처음 값·최종 순자산·연표·플레이 시간은 남아 있다. `KeepStanding`의 보류와 옛 시안 보관본, DSN-001과 함께 정리하기로 명시된 SPEC-017 항목은 새 결함으로 올리지 않았다.

## A 구현 감사 결과

| 질문 | 확인한 결과 |
|---|---|
| 1. 남길 기능 | 7세대 × seed1~30, **210판**의 `eede085`와 현행 진행 결과·직렬화 저장 바이트가 같았다. `reviewEnding`에서 삭제한 `journey`만 제외하면 나머지도 같았다. 엔딩 SSR80건과 별도 플레이 시간1건은 이전 마크업에서 비교 카드만 빼면 현행과 완전히 같았다. |
| 1. 출생·경계 | 출생·룰렛 SSR **420건**, 가능한 정수 구간 **5,151개**, `standingOf` 입력 **10,201개**를 이전과 대조해 같았다. 게임 나이0·19·20·21·100 × 자산 있음/없음의 엔딩 SSR 경계를 확인했다. 금액 조건은 이전과 같은 `age >= 20 && assets !== null`이다. 음수·0원 및 프로필 구간은 관련 기존 단위 시험도 통과했다. |
| 2. 저장·복원 | 배포된 v0.5.1(`6dcb7f8`) 코어로 직접 만든 **7세대 × 5시드의 종료 저장35개**를 이전/현행 파서로 열었다. 파싱 결과·남은 회고·저장 왕복이 같았다. 실제 저장에는 회고·journey가 없으며 종료 상태에서 다시 계산한다. `storage.ts`·스키마·진행 규칙은 이번 diff에서 변경되지 않았다. |
| 3. R1 해시 | 아래 독립 재산출 표 참조. 이동 판정 칸과 관련 표·가드만 제거됐고 그 외 값의 변경을 발견하지 못했다. |
| 4. 걷은 시험 | 개발 기록의 목록을 실제 시험·도구 diff와 대조했다. 파이프라인의 원값·선택 수·연표·저장 검증, 경제의 음수·하한·순자산 순서·자동40대 순자산 가드, 가족의 net20/finalNet·단계 순서 검증, 시스템 문구의 사망·어체 단언이 유지됐다. e2e의 새로고침·재탄생·키보드·글자 확대 단언도 남았다. |
| 5. 흔적 | 제품의 화면 문자열·접근성 노드와 FAQ에서는 없어진 비교 기능의 잔존을 재현하지 못했다. FAQ는 마지막 상태·순자산·생애 연표 설명으로 바뀌었다. **현재 문서 규칙의 잔재는 CX-004-101**이다. 삭제 사실을 설명하는 주석과 명시된 과거 기록은 구분했다. |

성인 `assets:null`은 기존 `storage.ts:432` 정합성 규칙이 거부하는 상태다. 이를 정상적인 구형 저장으로 취급하지 않았고, 화면 방어 경계로만 SSR 대조했다. 실제 플레이 시간 표시를 확인한125초 사례도 자연 경과 시간이 아닌 유효한 합성 `play` 입력이다.

### R1 스냅숏 독립 재산출

기존 항등시험 외에 **현재 코드의 같은 8,000판**에 `eede085`의 판정 함수·분포표를 적용했다. 기존 해시 유틸리티와 별개인 BigInt FNV 구현으로 옛/새 직렬화 해시를 함께 계산했다.

| 전략 | 판 수 | 표본 줄 | rowsHash | 옛 livesHash | 새 livesHash |
|---|---:|---:|---|---|---|
| random | 6,000 | 383,258 | `5e443240` | `641f08a0` | `f2546eee` |
| auto | 2,000 | 128,335 | `8cd3c43f` | `04a9e5fb` | `816aeb7d` |

신·구 fixture의 값과 모두 같았다. `scripts/r1SnapshotLib.ts:48`의 해시 입력에서 끝의 이동 판정 칸만 빠진 결과다. 이전 fixture에서 `finalDistribution`, `params.finalDistributionPlays`, 사망·재력별 movement, `end-down4/5`·`auto-up`을 제거하고 두 `livesHash`만 바꾸면 현행 fixture와 깊은 동등 비교가 통과했다. 연령대·재력 표, 목표19개, 잔존 가드, 사망 시점 순자산·`reportTime`을 갱신해 다른 회귀를 덮은 증거는 없다. 기존 항등시험의 시간 보고1,000판도 재생성했다.

### 시험 삭제 설명의 보충 — 별도 결함 아님

개발 기록은 삭제된 `e2e/m7e3-ending-colors.spec.ts`를 막대·범례 대비 시험으로 설명하지만, 해당 파일에는 엔딩 전체 글자 대비 검사도 있었다. 다만 `e2e/m4-colors.spec.ts:47`부터의 화면 목록에 엔딩이 있고 같은 전역 픽셀 대비·6테마 검사를 유지하며, `m7c-colors`에도 엔딩 연표 검사가 남는다. 따라서 이 설명의 축약을 **남은 기능의 대비 보호가 사라진 결함**으로 판정하지 않았다. 해당 대비 e2e 전체를 이번에 재실행한 것은 아니다.

## B 브라우저 확인 결과

설치된 Chrome을 Playwright로 직접 조작했다. 샌드박스의 브라우저 실행/로컬 연결 제한 때문에 로컬 Chrome 실행은 권한 확장으로 수행했다. 외부 페이지는 열지 않았고 임시 브라우저 컨텍스트만 썼다.

| 사례 | 1280×800 / 360×740 결과 |
|---|---|
| 성인 자연 종료 — 밀레니얼 seed4 김현우, 게임83/화면84세 | 비교 카드·막대·수저 칩 없음. 최종 스탯과 처음 값, 순자산22,342만 원, 사망·선택·연표 정상. |
| 어린 자연 종료 — 산업화 seed497 이용수, 게임5/화면6세 | 금액 대신 자산 안내 유지. 없어진 비교 제목·빈 카드 없음. |
| v0.5.1 실제 종료 저장 — 알파 seed1 이윤우, 게임71/화면72세 | 종료 화면 복원, 남은 정보 표시, 새로고침 후 본문과 저장 동일. |
| 성인 종료 +125초 play | `02:05` 표시 유지. 자연 인생의 실제 플레이 시간이라고 해석하지 않음. |
| 새 판 버튼 흐름 | 첫 화면 → 밀레니얼 선택 → 태어나기 → 룰렛 건너뛰기 → 출생신고 → 살아가기. 두 폭 모두 수저 구간과 출생 체중 백분위 표시, 인생 진입 확인. |

엔딩 **4상태 × 2폭 = 8사례**에서 가로 넘침0, 카드 간격24px, 삭제 영역 노드0, 브라우저 오류0이었다. 새로고침 뒤 본문·저장 동일, Tab 이동과 다시 태어나기 버튼의 초점 테두리, 버튼 클릭 후 첫 화면 복귀를 확인했다. 성인·어린 사망의 두 폭 화면은 메모리 이미지로 직접 살펴 빈 칸·남은 제목·어색한 간격이 없음을 확인했다. **실패가 재현되지 않아 PNG 파일은 남기지 않았다.**

## 실행한 시험·명령

기존 관련 시험 **15파일353개 통과**. 독립 해시 탐침2개와 신·구 상태 비교·문서 재현·브라우저 탐침은 별도다. 전체 시험 수와 혼합하지 않았다.

- `npm run typecheck` — 통과.
- `npm run check:events` — 사건155개·부모 결정 분류41장 통과.
- `npm test -- tests/ending.test.ts tests/endingScreen.test.tsx tests/endingBar.test.tsx tests/standing.test.ts tests/birthScreen.test.tsx tests/roulette.test.tsx tests/dashboard.test.tsx tests/glue.test.ts --maxWorkers=1 --minWorkers=1` — **8파일252개 통과**.
- `npm test -- tests/economyIdentity.test.ts --maxWorkers=1 --minWorkers=1` — **2개 통과**.
- `npm test -- tests/aboutFaq.test.ts tests/fonts.test.tsx --maxWorkers=1 --minWorkers=1` — **2파일29개 통과**.
- `npm test -- tests/pipeline.test.ts tests/economyBalance.test.ts tests/familyRemeasure.test.ts tests/systemText.test.ts --maxWorkers=1 --minWorkers=1` — 첫 실행에서 **pipeline 34개 통과**(6,000판, 예외·불변식 위반0). 출력 지연을 실행 정체로 오인해 이후 묶음 실행을 중단했으며 이 실행 전체를 통과로 세지 않았다.
- `npm test -- tests/economyBalance.test.ts tests/familyRemeasure.test.ts tests/systemText.test.ts --maxWorkers=1 --minWorkers=1` — 완료된 pipeline을 빼고 재실행. **economyBalance 23개·systemText 7개·familyRemeasure 6개, 3파일36개 통과(exit 0)**. 완료된 pipeline까지 합쳐 이 분담의 4파일70개가 통과했다.
- `npm test -- tests/.cx004r2-hash-probe.test.ts --maxWorkers=1 --minWorkers=1` — 독립 해시·fixture 정규화 **2개 통과**.
- `./node_modules/.bin/vite-node.cmd .cx004r2-state/probe.tsx` — 신·구 진행/저장/SSR/구간 탐침 통과. 루트 검증자가 같은 명령을 재실행해 확인했다.
- `npm exec -- vite-node .cx004r2-doc-probe.ts` — CX-004-101 재현.
- `node .cx004r2-ui.cjs` — 엔딩8사례·새 출생 흐름2폭 통과.

읽은 범위는 위 시험과 구현 파일, 관련 `scripts/pipelineLib.ts`·경제/R1/가족 재측정 도구·삭제 도구의 기준 커밋 사본, 지정 e2e diff, `src/data/endingText.ts`·`aboutFaq.ts`·`birthText.ts`, `src/styles/dash.css`, 문구·디자인 정본과 관련 명세·데이터 문서의 검색 결과다. `.coding-rules.md`도 확인했다. 금지 경로를 읽는 `check:todo`는 실행하지 않았다.

## 한계·작업 무결성

- 전체 `npm test`, e2e 전체, `e2e:prod`, WebKit·실제 모바일·스크린리더 낭독은 이번에 재실행하지 않았다. 작성자가 보고한5,558개와 첫 로딩 바이트 수를 독립 통과 수치로 재사용하지 않는다.
- 자연 저장의 결과 동등성은 위 고정 시드 표본에 대한 확인이다. 전체 사용자 저장이나 모든 가능한 종료 상태의 전수 증명은 아니다.
- `interrogate`의 재현 중심 방식으로 영역별 검토를 나누고, 루트가 지적 명령과 상태 비교를 다시 실행했다. 사용 가능한 부모 모델을 분담 검토에 사용했으며 서로 다른 모델 계열의 합의라고 주장하지 않는다.
- 소스·기존 시험·기존 문서·설정 수정, 설치·커밋·푸시·배포 없음. 임시 스크립트·기준선 소스 사본·브라우저 컨텍스트·작업용 서버는 정리했다. 영구 산출물은 **이 `findings-2.md` 한 파일**이다.
