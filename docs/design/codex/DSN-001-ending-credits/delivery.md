# DSN-001 전달 기록

- 작성일: 2026-11-13 KST. 마지막 브라우저 점검: 20:28:12 KST. 가림 목록 최종 캡처: 20:32:54 KST.
- 기준 커밋: `41521a1cb256a575ba4c0a216334891c6b6486f5`.
- 범위: 엔딩 크레딧 **기획·정적 디자인 시안**. 제품 구현 아님.
- 추천안: **「이 삶의 이름들」**. 사망 기록 아래에서 선택해 열고, 가족·친구 이름 → 실제 선택 → 시대 사실 → 이름으로 마친다.

## 1. 먼저 볼 것

| 산출물 | 내용 |
|---|---|
| [plan.md](plan.md) | 세 컨셉 비교, 추천 이유, 데이터 계약, SPEC-017 조정안, 연출·접근성·성능 계획, 질문 다섯 가지, 실제 여섯 판 전문 |
| [mockups/index.html](mockups/index.html) | 여섯 판의 라이트·다크·정지 목록 선택 |
| [mockups/ending-entry.html](mockups/ending-entry.html) | 엔딩 문서 아래 진입부의 부분 시안 |
| [모바일 시작](shots/credits-360-light-start.png) · [PC 시작](shots/credits-1280-dark-start.png) | 이름과 호칭의 위계 |
| [모바일 중간](shots/credits-360-light-mid.png) · [PC 끝](shots/credits-1280-dark-end.png) | 선택 원문과 마무리 |
| [정지 목록](shots/credits-360-light-reduce.png) · [짧은 삶](shots/credits-360-light-early-death.png) · [가림](shots/credits-360-light-gentle.png) | 움직임 줄이기와 내용 경계 |
| [mockups/samples.json](mockups/samples.json) | 여섯 실제 판의 initial/ended, 직렬화 원본, 가족·시대·선택의 파생 근거 |
| [mockups/credits.json](mockups/credits.json) · [model.mjs](mockups/model.mjs) | 시안용 표시 자료와 동일한 문장 선택 규칙 |
| [mockups/verification.json](mockups/verification.json) | 브라우저·폭·테마·글꼴·조작 점검 결과, PNG 크기 목록 |

HTML은 JSON을 읽으므로 파일을 직접 여는 방식보다 로컬 서버로 본다. 저장소 루트에서 다음 명령으로 열 수 있다.

```powershell
npm run dev -- --host 127.0.0.1 --port 5199 --strictPort
```

주소: `http://127.0.0.1:5199/docs/design/codex/DSN-001-ending-credits/mockups/index.html`

시안은 검토하기 쉽도록 처음에 멈춰 있다. `이어 보기`로 이동 감각을 확인하고, `목록으로 보기`로 전체를 읽는다. `motion=reduce` 또는 OS의 움직임 줄이기는 처음부터 정지 목록이다. `건너뛰기`/Escape는 시안의 간소한 회고 화면으로 돌아간다. 실제 앱의 저장·새 판 시작과 연결하지 않았다.

## 2. 읽거나 관련 정의를 검색한 파일

요청서는 처음부터 끝까지 읽었다. 아래는 판단에 사용한 저장소 자료다. 외부 화면·문구·작품 이름을 수집하거나 검색하지 않았다. 문서 안의 외부 출처 링크도 열지 않았다.

- 요청·문구·화면: 이 폴더의 `request.md`, `docs/spec/SPEC-017-엔딩첫장면과공유.md`, `docs/design/copy.md`, `docs/design/design-system.md`.
- 데이터 설명: `docs/data/bgm-spec.md`, `docs/data/family-model.md`, `docs/data/persona-model.md`, `docs/data/era-events-facts.md`의 관련 정의.
- 화면·소리: `src/screens/EndingScreen.tsx`, `src/screens/BirthScreen.tsx`, `src/App.tsx`, `src/ui/useBgm.ts`, 가족 카드 관련 `src/ui/dash/` 정의, `src/audio/`의 BGM 관련 정의.
- 상태·생애: `src/core/types.ts`, `state.ts`, `session.ts`, `profile.ts`, `life.ts`, `history.ts`, `ending.ts`, `jobs.ts`, `storage.ts`, `gentle.ts`.
- 가족: `src/core/familyModel.ts`, `familyBirth.ts`, `familyStorage.ts`, `familyView.ts`, `familyCard.ts`, `familyAdult.ts`.
- 시대·고정 글: `src/core/eraWindow.ts`, `src/data/eraWindows/index.ts`, `src/data/eraWindows/types.ts`, `src/data/endingText.ts`, `gentleText.ts`, `lifeTable.ts`, `regionKeys.ts`.
- 토큰·글꼴·실행: `src/styles/tokens.css`, `src/styles/fonts.css`, `tests/designAssets.test.ts`, `tests/fonts.test.tsx`, `scripts/simulateLib.ts`, `package.json`.
- 실제 샘플 실행 중 기존 `src/data/installAll`과 1940~2100년대 시대 모듈 17개를 로드했다. 화면에는 승인된 역사 연도 범위만 선택했다.

핵심 확인 사항:

- 가족의 사망 계획은 미래 자료일 수 있다. 현재 가족 카드가 제공하는 이름만 사용하고 출생 전 별세 항목을 제외했다.
- `FAMILY_MAX_CHILDREN=8`은 주인공을 포함한다. 형제 합계는7명, 현재 사람 명단 상한은21명이다. `familyStorage.ts:133`의 검증 조건과 생성 조건을 함께 확인했다.
- 과거 나이로 가족 뷰를 조회해도 현재 flags가 쓰인다. 과거 동거·친밀도를 복원했다고 주장하지 않았다.
- `gentleUsed`는 사용 이력, 현재 `settings.gentle`는 원문 가림 여부다.
- 미래 예측과 2110년 끝 안내는 시대 사실로 넣지 않았다. 집안 영향 `second`도 제외했다.
- 현재 게임용 글꼴 조각에는 `딧`이 없다. 화면 표기는 `이 삶의 이름들`/`이름과 시간`으로 만들었다. 기존 글꼴·토큰만 사용했다.

## 3. 실제 판 생성과 재현

결과·수저·가족·사망·스탯을 원하는 값으로 덮어쓰지 않았다. 세대와 시드를 정해 자연 생성된 판을 조건으로 골랐다.

| 구분 | 세대 | seed | 인물 | 생몰 | 게임/한국 사망 나이 |
|---|---|---:|---|---|---|
| 밀레니얼 수저1 | millennial | 4 | 김현우 | 1995~2078 | 83/84 |
| 밀레니얼 수저5 | millennial | 19 | 이상훈 | 1981~2068 | 87/88 |
| 산업화 | industrial | 1 | 이학수 | 1949~2028 | 79/80 |
| 20세 미만 사망 | industrial | 497 | 이용수 | 1942~1947 | 5/6 |
| 가족이 적은 판 | millennial | 38 | 김나래 | 1992~2040 | 48/49 |
| 가림을 켠 판 | genx | 1 | 이상철 | 1976~2055 | 79/80 |

모든 판은 `lifeLength:short30`, `speed:8`, `autoMode:true`, `noteCards:false`다. 가림 판만 시작 전에 `gentle:true`, 나머지는 false다. `createSession(createInitialState(seed), settings)` → reducer의 `begin` → `finishSpin` → `enterBirth` → `enterLife`를 거쳤다. 그 뒤 pending이 있으면 `autoChoose`, 없으면 `advance(fromAge)`를 반복해 ending까지 진행했다. 가림 사용 이력도 실제 reducer가 생성했다.

밀레니얼 수저1/5·산업화·가림은 게임60세 이상, 가족이 적은 판은 게임40세 이상이며 출생 전 별세 제외 가족4명 이하·성인기 가족/친구0인 자연 판을 찾았다. 검색은 seed1부터 최대5000이었다. 어린 사망은 산업화 seed1부터 최대3000, 각 판을 게임10세 전까지 진행하는 탐색에서 seed497을 찾았다. 최종 여섯 판은 모두 `parseGame(serializeGame(ended))`가 ended와 같음을 확인했다.

샘플 생성은 벽시계 플레이가 아니므로 `play` 값을 실제 소요 시간으로 해석하지 않는다. 전문에는 플레이 시간을 넣지 않았다. 상세 초기·최종 상태와 추출 위치는 samples.json, 화면 줄의 근거는 credits.json의 `source`에 있다. 샘플 검토용 수저·시드는 시안 목록에만 표시하고 크레딧 본문에는 쓰지 않았다.

## 4. 실행 명령과 제작 방식

아래는 실행한 주요 명령이다. `npx`·패키지 설치는 사용하지 않았다.

```powershell
git rev-parse HEAD
git status --short
npm run dev -- --host 127.0.0.1 --port 5199 --strictPort
& './node_modules/.bin/vite-node.cmd' '.dsn001-samples.ts'
node .dsn001-inspect.cjs
node .dsn001-build.mjs
node .dsn001-render.cjs
git diff --name-only
git diff --check
```

읽기에는 `rg`·`Get-Content`, 문서·시안 생성에는 대상 폴더에 한정한 파일 쓰기를 사용했다. 임시 스크립트 네 개는 완료 후 삭제했다.

- 샘플 스크립트: 기존 코어·데이터를 로드하고 실제 종료 상태와 파생 자료를 만들었다.
- 현재 화면 확인: 새 임시 Chrome 컨텍스트에 실제 김현우 판의 직렬화 종료 저장을 넣고, 현재 앱의 `ending-screen`을 직접 열어 촬영했다. 사용자의 기존 브라우저 저장을 건드리지 않았다. 음악은 끄고 실행했다. 현재 비교 카드는 **기준 화면 증거**에만 남아 있으며 제안 시안에는 없다.
- 시안 생성: 공통 `model.mjs`로 여섯 전문과 credits.json을 만들고, 그 자료로 HTML을 채웠다. 원문을 긍정적으로 다시 쓰지 않고 G5 불합격 결과도 그대로 남겼다. 본문·질문·선택 라벨은 원문 전체다.
- 렌더링: 기존 Playwright와 설치된 Chrome을 사용했다. 샌드박스 안의 Chrome에서 로컬 서버 연결이 제한돼 로컬 브라우저 실행만 권한 확장으로 진행했다. 원격 서비스 접속 없이 `127.0.0.1` 요청만 허용했다.
- 디자인: 출생신고서의 종이색, 쪽빛 글자, 역할/이름 정렬과 여백을 기존 토큰으로 구성했다. 새 그림·사진·아이콘·음원·글꼴은 없다.

## 5. 확인 결과

- Chrome `157.0.8103.51`, deviceScaleFactor1. **화면 점검39건**, 가로 넘침0·검사 대상 글자 잘림0·브라우저 오류0·외부 요청0.
- 320·360·1280폭 × 라이트/다크 × 글자100/200%, 360폭 강제 색상 라이트/다크, 모바일 긴 이름10자, 시안 목록·진입부360/1280을 확인했다. CSS 루트 글자 크기를200%로 늘려 검사했으며 브라우저 자체의 페이지 줌과는 구분한다.
- 360×740·1280×800의 라이트/다크 각각 처음·중간·끝12장, 정지 목록4장, 나머지 실제 판4장, 글자200%1장, 강제 색상2장, 진입부2장, 현재 앱1장으로 **PNG26장**이다. 최대122,054B, 합계1,533,038B. 모두 장당1MB 이하이며 DPR2/3 원본은 없다. 정지 목록의 세로 전체 캡처도 CSS 픽셀1배다.
- 모든 화면의 표시 글자286종을 기존 Noto Sans KR s0/s0b/s1/s2의 400·700 unicode-range와 대조해 누락0이었다. 사용자 글용 s3를 고정 문구의 근거로 쓰지 않았다.
- OS reduce 및 `data-motion=reduce`에서 정지 목록 전환, 글자200% 정지 목록, 재생 이동·정지, PageDown 정지, Escape 복귀, 다시 보기, 버튼의 가시 초점을 확인했다.
- 가림 원문은 닫힌 상태에서 DOM에 빈 내용으로 두고, 명시적으로 펼칠 때만 삽입했다. 펼침→건너뛰기→다시 보기에서 원문 제거와 `aria-expanded=false` 복귀를 확인했다.
- 화면을 열 때 제목에 초점을 두고, 복귀할 때 간소한 회고의 다시 보기 버튼으로 돌아간다. 전체 본문은 한 번만 존재하며 줄별 aria-live를 쓰지 않는다.
- 대표 모바일 중간·가림·진입부와 PC 다크 시작 화면은 PNG를 직접 열어 정보 위계와 줄바꿈도 확인했다.

## 6. 한계와 미확인

- 현재 산출물은 정적 시안이다. 제품의 라우팅·실제 회고 복귀·저장 충돌·다시 태어나기·청크 실패 처리를 구현한 것이 아니다. SPEC-017 사망 기록 서류 전체도 시안에서 재설계하지 않았다.
- 선택 재생은 이동 감각을 위한 기능이다. 계획에 적은 처음/끝4초 정지,36px/s 상한, 정식 완료 상태 전환은 제품 구현 사항이다. 첫 진입이 멈춘 화면이라는 점도 검토용 동작이다.
- 글자 수에 따른7자/초는 실측 독서 속도가 아닌 기획 가설이다. 이번 샘플 제안은33~83초이며 실제 몰입과 읽기 여유는 사용자 확인이 필요하다. 통계적 대표 표본이나 효과 평가를 주장하지 않는다.
- NVDA/VoiceOver 실제 낭독, WebKit·Firefox·실제 휴대폰, OS별 고대비 설정, 터치 기기 조작은 미확인이다. Chrome 미디어 에뮬레이션과 DOM/키보드 검사 결과만 보고했다.
- 제품 초기gzip400,000B 통과 여부는 측정하지 않았다. 시안은 production 번들에 연결하지 않았다. 구현 때 lazy 경계를 확인하고 Chromium·WebKit에서 기존 성능 가드를 재측정해야 한다.
- 가족 최대21명·동명이인·자녀4명·이혼 후 재혼, 가족 데이터 없는 옛 저장, 게임0/100세 경계는 완료 기준으로 명시했으며 이번 실제 여섯 판이 전부를 포함하지는 않는다.
- 시대 문장은 저장소의 승인된 원문을 사용했다. 역사 출처를 새로 외부 검증한 작업이 아니다. 고유한 화면·문구를 외부 작품과 비교 검사한 것도 아니며, 외부 참고를 들이지 않고 자체 구성했다.

## 7. 변경 범위

최종 산출물은 이 폴더의 `plan.md`, `mockups/`, `shots/`, `delivery.md`뿐이다. 기존 요청서와 `src/`·시험·설정·다른 문서는 수정하지 않았다. 임시 스크립트와 작업용 서버는 정리했다. 커밋·푸시·배포는 하지 않았다.

선택이 필요한 다섯 항목과 각각의 추천 이유는 [plan.md 11절](plan.md#11-형진-님께-묻는-것)에 모았다.
