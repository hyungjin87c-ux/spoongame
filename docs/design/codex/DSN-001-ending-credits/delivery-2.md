# DSN-001 엔딩 크레딧 2회차 인계

- 작업: 기획·디자인 시안. 게임 구현이나 경제 보정 검증이 아니다.
- 시작: 2026-11-14 06:18:07 +09:00.
- 완료: 2026-11-14 06:42:32 +09:00. 임시 파일과 작업용 서버 정리 완료.
- 기준 코드: `1371ca0fd78b627f856b50d4db05cd730958ae76`.
- 권고: **A 동일 위치 겹침, 4.8초**. 개인 백분위 숫자는 숨기고 추산 근거를 남긴다.
- 1회차의 확정 7개 결정을 반영했다. 형진 님께 남기는 새 질문은 [plan-2.md 12절](plan-2.md#12-형진-님께-묻는-것)의 연출·시간과 백분위 숫자 표기 두 가지다.

## 1. 산출물과 여는 법

| 파일 | 내용 |
|---|---|
| [plan-2.md](plan-2.md) | 단계별 선택·시대 규칙, 38개 큰 결정 목록, 수저 추산·문구·연출 세 안, 접근성·길이·구현 완료 기준, 실제 6판 전문 |
| [mockups/index-2.html](mockups/index-2.html) | 여섯 삶의 전체 시안과 장면 처음·중간·끝·움직임 줄이기 진입 |
| [mockups/motion-studies-2.html](mockups/motion-studies-2.html) | 같은 실제 삶으로 그린 세 안의 처음·중간·끝 비교 |
| [mockups/credits-2.html](mockups/credits-2.html) | 새 선택·시대와 수저 장면을 합친 전체 크레딧 |
| [mockups/samples-2.json](mockups/samples-2.json) | 원시 종료 상태, 출처·시드·재생 설정, 파생 자료, 추산 입력·중간값·경계 |
| [mockups/credits-2.json](mockups/credits-2.json) | 시안에 표시하는 여섯 판의 전문과 보기 모델 |
| [mockups/model-2.mjs](mockups/model-2.mjs), [editorial-2.mjs](mockups/editorial-2.mjs), [wealth-2.mjs](mockups/wealth-2.mjs) | 검토용 편집·계산. `src/`에서 참조하지 않는다. |
| [mockups/verification-2.json](mockups/verification-2.json) | 캡처 목록·크기, 화면 경계, 접근성 트리, 동작·글꼴·토큰 확인 |
| [shots-2/](shots-2/) | PNG 38장. 각 장 1,000,000바이트 미만. |

시안은 모듈과 로컬 JSON을 사용하므로 `file://`로 열지 않고 저장소 루트에서 개발 서버로 연다.

```powershell
npm run dev -- --host 127.0.0.1 --port 5199 --strictPort
```

브라우저 주소는 `http://127.0.0.1:5199/docs/design/codex/DSN-001-ending-credits/mockups/index-2.html`이다. 샘플 화면은 `credits-2.html?sample=millennial-low&theme=dark&focus=spoon&frame=mid`처럼 연다. `frame=start|mid|end`, `motion=reduce`, `method=fade|wipe|pair`는 검토용 주소 매개변수다. 움직임은 하단 「장면 보기」를 눌러 시작한다. 기본은 전체 정지 목록이다.

이 작업에서는 서버를 띄우기 전에 5199의 Listen 연결이 없음을 확인했고 strictPort로 실행했다. 작업용 서버를 종료하고 Listen 잔류0을 확인했다. 기존 1회차 파일은 보존하고 이름이 `-2`인 새 시안 파일을 추가했다.

## 2. 실제 판과 재현 방식

1회차의 여섯 시드를 현재 코드로 다시 진행했다. 초기·종료 상태와 파생 자료가 기존 `samples.json`과 모두 같았다. 저장 `serializeGame → parseGame` 왕복도 6/6 통과했다. 원하는 수저·자산·사망 나이·선택 결과를 덮어쓰지 않았다. 별도 새 시드 탐색은 필요하지 않았다.

재현 순서는 `createInitialState(seed)` → `createSession` → `begin / finishSpin / enterBirth / enterLife` → pending이 있으면 `autoChoose`, 없으면 `advance(fromAge)` → `phase === ending`이다. `lifeLength: short30`, `speed: 8`, `autoMode: true`, `noteCards: false`, `gentle`은 마지막 표본만 true다. 헤드리스 진행의 play 값은 실제 사람이 플레이한 시간이 아니다. `playToEnd`와 비교할 때 session이 소비한 `note-`의 seen 표지만 차이가 있었고, 나머지 모든 상태 값과 일반 seen 표지는 같았다.

| id | 세대·seed | 이름 | 게임 사망 나이 | 순자산 x(2025 가치 만 원) | M / 평균 | σ | 추산 F(%) | 출생 → 마침 |
|---|---|---|---:|---:|---|---:|---:|---|
| millennial-low | millennial · 4 | 김현우 | 83 | 22,342 | 22,100 / 49,279 | 1.266428378 | 50.343067943 | 흙 → 동 |
| millennial-high | millennial · 19 | 이상훈 | 87 | 195,233 | 22,100 / 49,279 | 1.266428378 | 95.730955846 | 다이아몬드 → 금 |
| industrial | industrial · 1 | 이학수 | 79 | 107,801 | 22,100 / 49,279 | 1.266428378 | 89.459143648 | 금 → 은 |
| early-death | industrial · 497 | 이용수 | 5 | 자산 없음 | 적용 안 함 | — | — | 동 출생만 |
| few-family | millennial · 38 | 김나래 | 48 | 48,815 | 28,384 / 48,389 | 1.032905522 | 70.018708200 | 은 → 은 |
| gentle | genx · 1 | 이상철 | 79 | 95,654 | 22,100 / 49,279 | 1.266428378 | 87.634805524 | 금 → 은 |

화면의 한국 나이는 위 게임 나이+1이다. 추산 함수에 표시 나이를 넣지 않았다. 여섯 판은 네 방향·가림·가족 수의 사례를 보여 주기 위한 것으로, 발생 비율이나 모집단을 추정하는 표본이 아니다.

모든 여섯 판에서 적격 학창기 **본인 큰 결정은 없다**. 부모가 정한 배움·진학을 끼워 넣지 않았다. 청년·중년·노년에서 최대 1건을 남겼으며 질문과 결과 원문 전체를 보존했다. 시대는 청년 이후의 실제 연도만 남기고 최대 3줄·heavy 1줄이다. 산업화 판에서만 세 단계의 시대가 모두 남는다. 빈 단계나 미래 시대를 지어내지 않았다.

## 3. 수저 계산

정본은 `docs/data/networth-distribution.md` 4절 안 B다. 공식 연령별 실제 CDF가 공표되어 있는 것으로 가장하지 않는다. 전체 가구 CDF에 연령별 평균·중위값을 결합하는 추산이다.

1. 사망 게임 나이로 20~29 / 30~39 / 40~49 / 50~59 / 60~64 / 65+의 행을 고른다. 60~64에는 공식 60+ 집계 행을 대신 쓴다.
2. `assets.net`은 이미 부채를 뺀 순자산이다. 부채를 다시 빼지 않는다.
3. `σ = sqrt(2 × ln(평균 / M))`. 인쇄된 3자리 σ로 계산하지 않는다.
4. `x ≤ M`이면 `F_all(x × 23860 / M)`. 전체 21개 마디의 선형 보간, 아래·위 꼬리는 문서 규칙을 따른다. `x > M`이면 `100 × Φ(ln(x/M)/σ)`다. 함수의 F는 0~100 백분율이다.
5. 원시 세대 누적 경계로 이름을 정한다. 밀레니얼 26/56/83/97, 산업화 40/72/92/99, X세대 33/64/88/98. 백분위 반올림 전에 판정한다. 경계와 정확히 같을 때 낮은 단계로 두는 `<=`는 이번 설계 제안이다.
6. 20세 전에는 추산하지 않는다. 성인 순자산 0 이하는 흙수저로 고정한다. 성인 자료가 없을 때는 0으로 간주하지 않고 추산 불가로 구분한다. 실제 여섯 판에는 성인 자산 누락 사례가 없다.

예를 들어 김현우는 65+의 `M=22100`, `σ≈1.266428378`, `x=22342`여서 위쪽 식을 쓴다. `z≈0.008599544`, `F≈50.343067943%`는 밀레니얼 26~56 구간에 들어 동수저다. 김나래는 40대 행을 써 약 70.0187%, 은수저 경계 56~83에 남는다. 실제 다섯 성인 표본의 순자산은 모두 M보다 크다. 아래쪽·비양수·연령 경계는 별도 계산 입력 검사로 확인했다.

11월 13일 측정 로그는 성긴 분위수 표를 다시 선형 보간한 방식이다. 이번 시안은 안 B 원식과 전체 마디를 사용하므로 로그의 근삿값을 억지로 맞추지 않았다. 실제 연령별 분포 부재, 가구주 나이를 인물 나이로 대응하는 가정, 60~64의 60+ 대용, 70·80대 분리 없음, 출생 가족 형편과 종료 순자산의 단위 차이는 [plan-2.md 5절](plan-2.md#5-마칠-때-수저를-정하는-법)에 명시했다.

계산과 저장된 자료를 다시 대조하는 명령은 다음과 같다.

```powershell
@'
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {estimateWealth} from './docs/design/codex/DSN-001-ending-credits/mockups/wealth-2.mjs';
import {buildCredit} from './docs/design/codex/DSN-001-ending-credits/mockups/model-2.mjs';
const p='docs/design/codex/DSN-001-ending-credits/mockups/';
const samples=JSON.parse(fs.readFileSync(p+'samples-2.json','utf8')).samples;
const credits=JSON.parse(fs.readFileSync(p+'credits-2.json','utf8'));
for(const s of samples) {
  const w=s.wealth;
  assert.deepEqual(estimateWealth({age:w.age,net:w.net,start:w.start,thresholds:w.thresholds}),w);
}
assert.deepEqual(samples.map(buildCredit),credits);
console.log('6판 추산·보기 모델 일치');
'@ | node --input-type=module
```

## 4. 실행·확인 결과

| 확인 | 결과·범위 |
|---|---|
| 자연 진행·저장 | 6판 현재 코드 재생성, 기존 초기/종료/파생 자료 동일, 저장 왕복 6/6 |
| 수학 함수 | 72,441개 단언 통과. 21마디, 6연령대, 중위값 50%, 0원 3%, 단조·범위, 정확 경계±1e-9, 비양수 강제1, 연령 경계, 비유효 자료 처리 |
| 정규 CDF 검산 | 독립 Simpson 적분 65점과 최대 절대차 약 6.89e-15. 자료 추산의 통계적 정밀도와는 별개다. |
| 경계·보기 모델 | 7세대 원 누적값과 현재 `startBandOf` 표시 경계 차이0. 6판 보기 모델·계산·문장 최종 대조 49개 통과 |
| 선택·시대 | 단계 19/20·39/40·64/65, 부모/흘러감/노트 제외, 질문 fallback, 결과 전체, heavy 이후 다음 nonheavy, 2027+/forecast/2110 안내 제외, 입력 무변이 확인 |
| 화면 | 네 경우 × 360/1280 × 라이트/다크 16조합 가로 넘침·텍스트 박스 넘침0. 장면 start/mid/end와 reduced 캡처 |
| 320·글자200% | 두 수저 나란히, 이름·점은 아래 전폭 행으로 재배치. 가로 넘침0, 하단 회고 버튼 화면 안에 있음. OS 브라우저 전체 줌 대신 루트 글자 크기 200%로 검사했다. |
| 접근성 구조 | 수저 문장 접근성 트리 1회, 그림/점 중복 읽기0. 강제 색상에서 두 이름·10개 점 유지. 실제 음성 낭독 시험은 아님. |
| 움직임 | 실제 재생 0.4초의 mix0, 2초 부근 mix약0.5, 3.4초 mix1, 5초에는 완료. 같은 수저·어린 삶의 중간 그림 변동0 |
| 제어 | OS reduced 실시간 변경, data-motion reduce→normal 복구, 휠 일시정지·자동재개 없음, Escape 회고 및 호출 단추 초점, 재진입 제목 초점, 재진입 뒤 화면 밖 일시정지, Space/Enter 전환·Tab 일시정지·하단 회고 버튼 복귀 |
| 가림 | 닫힌 원문 DOM 없음, 명시적 펼침, 회고 왕복 뒤 다시 닫힘 |
| 글꼴·토큰 | 여섯 판의 실제 DOM(상세 펼침 포함) 한글 290종이 기존 400·700 Unicode 범위에 모두 포함. CSS 토큰 참조 40개 모두 기존 정의에 있음. 새 글꼴 생성0 |
| 브라우저 | 로컬 Chrome/Playwright, DPR1. JavaScript 오류·HTTP400이상0 |
| 이미지 | 38장 모두 PNG, 최대 254,109바이트. 1MB 제한 충족 |

검토 중 발견한 시안 차이는 허용된 `mockups/` 안에서 해결했다. 하단에 항상 회고 복귀 조작을 두었고, 움직임 설정 해제 시 재생을 복구하며, 재진입으로 바뀐 장면 노드를 다시 관찰한다. 겹침 도중 그림이 옅어지는 것을 막기 위해 출생 실루엣은 불투명하게 유지하고 마침 그림만 0→1로 올렸다. 제목의 프로그램 초점은 유지하되 비조작 제목에는 테두리를 그리지 않는다. 버튼·링크의 키보드 초점 테두리는 유지한다.

직접 눈으로 확인한 대표 화면은 수저 중간 360 라이트, 하락 1280 다크, reduced 360 다크, 조기 종료 360 라이트, 320·200% 전체 및 세 연출 비교판이다. 모든 38장에 대한 주관적 시각 검수를 주장하지 않는다.

주요 실행 명령:

```powershell
Get-NetTCPConnection -LocalPort 5199 -State Listen -ErrorAction SilentlyContinue
git rev-parse HEAD
git status --short
& './node_modules/.bin/vite-node.cmd' '.dsn2-data-generate.ts'
node .dsn2-data-check.mjs
node .dsn2-build.mjs
npm run dev -- --host 127.0.0.1 --port 5199 --strictPort
node .dsn2-render.cjs
node .dsn2-extra.cjs
node .dsn2-final.cjs
```

`Get-Content`·`rg`·`node`로 아래 자료를 읽고, 보기 모델을 `node --input-type=module`로 생성·대조했다. 생성·브라우저 검사 스크립트의 `.dsn2-*` 임시 파일은 모두 제거했다. 계산·편집 모듈과 검증 결과는 허용된 시안 폴더에 남겼다. `npm install`, `npm ci`, `npx`, 앱 시험·설정 수정은 없었다. 앱 전체 시험이나 제품 빌드를 실행한 작업은 아니다.

## 5. 화면 증거

| 묶음 | 파일 |
|---|---|
| 네 경우·두 폭·두 테마 | `up-`, `same-`, `down-`, `early-` + `360/1280-light/dark-end.png` (16장) |
| 겹침 처음·중간 | `up-360/1280-light/dark-start/mid.png` (8장). end는 위 묶음에 포함. |
| 움직임 줄이기 | `reduce-360/1280-light/dark.png` (4장) |
| 경계 | `reduce-320-200pct.png`, `reduce-360-forced-colors.png` |
| 전체 흐름 | `full-360-light-start/choice/closing.png`, `industrial-1280-light-full.png`, `gentle-360-light-list.png` |
| 검토판 | `motion-three-1280-light/dark.png`, `index-1280-light.png` |

대표: [처음](shots-2/up-360-light-start.png) · [중간](shots-2/up-360-light-mid.png) · [끝](shots-2/up-360-light-end.png) · [움직임 줄이기](shots-2/reduce-360-dark.png) · [세 안 비교](shots-2/motion-three-1280-light.png).

## 6. 읽은 자료

이전 감사의 기록을 다시 열지 않았다. 다른 게임·영화·방송의 화면·문구나 외부 웹을 참고하지 않았다. 이번 요청에서 지정한 내부 자료만을 중심으로 원본 타입·호출 경로·스타일을 확인했다.

- 이 폴더: `request.md`, `request-2.md`, `plan.md`, `review.md`; 기존 `mockups/model.mjs`, `samples.json`, `credits.html`, `credits.mjs`, `credits.css` 및 이번 `-2` 산출물.
- 지정 자료: `docs/data/networth-distribution.md` 전문, `ai-log/2026-11-13_ending-spoon_measure.md` 전문, `ai-log/decisions-2026-11.md` 중 후속 **256~259만**.
- 디자인: `docs/design/design-system.md` 수저 칩·토큰 규칙, `src/ui/Brand.tsx`, `src/ui/Grade.tsx`, `src/assets/icons/spoon-grades.svg`, `src/styles/tokens.css`, `src/styles/fonts.css`.
- 편집·데이터 정의: `src/data/lifeTable.ts` 단계 경계, `src/data/events/school.json`, `career.json`, `youth.json`, `middle.json`, `senior.json`의 정의·선택·heavy, `src/data/gentleText.ts`, `src/core/types.ts` 관련 타입, `src/data/generationText.ts`의 NOW_YEAR 검색 결과.
- 진행·순자산·가족·시대 경로: `src/core/session.ts`, `ending.ts`, `birth.ts`, `birthProfile.ts`, `life.ts`, `familyCard.ts`, `familyView.ts`, `familyAdult.ts`, `familyModel.ts`, `eraWindow.ts`, `gentle.ts`, `notes.ts`, `index.ts`, `economy.ts`, `storage.ts`.
- 실행 시 가져온 자료: `src/data/installAll.ts`, `src/data/eraWindows/index.ts`, `d1940.ts` 및 `ERA_DECADE_LOADERS`의 1940~2100 모듈과 해당 코어 의존성.

## 7. 남는 한계와 배포 조건

전체 크레딧 자동 스크롤, 제품의 처음/끝 정지 상태 기계, 실제 앱 진입·복귀, lazy 청크, 청크 실패, 저장 호환 통합은 구현하지 않았다. 시안은 정지 목록과 마지막 장면의 명시적 4.8초 재생이다. 제품의 실제 브라우저 확대·WebKit·NVDA/VoiceOver·초기 gzip 예산은 후속 구현에서 검사해야 한다. 320·200% 시안은 보수적인 하단 여백을 사용하며 제품에서는 조작 띠 높이에 대응해야 한다. 이번 스크린샷과 접근성 트리 검사를 음성 낭독·사용성 검증 완료로 바꾸어 말하지 않는다.

노년 경제에 관한 약 40~47% 비양수 결과는 **2026-11-13 측정 기록의 결과**다. 현재 HEAD의 새 분포 측정치가 아니다. 현행 코드에 노년 관련 처리가 존재하는 것만으로 보정 완료를 판정하지 않았으며, 이번 작업에서 그 효과를 재검증하지 않았다. **이름 크레딧은 먼저 내고 수저 변화는 노년 경제 보정과 검증 뒤에 붙인다는 결정을 유지한다.** 흙수저 끝이 많다는 이유로 기준·계수·말투·시간을 바꾸지 않는다.

실제 통계의 불확실성과 출생/마침의 측정 단위 차이는 설계에 남는다. 개인 백분위 숫자 숨김과 A·4.8초는 형진 님의 새 확인 대상이며, 이미 확정된 1회차 결정은 다시 묻지 않는다.

최종 변경 범위는 `plan-2.md`, `mockups/`의 새 `-2` 파일, `shots-2/`, `delivery-2.md`다. 소스·시험·설정·다른 문서 수정, 커밋·푸시·배포는 하지 않았다.
