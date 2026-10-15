# docs/design — 수저 게임 디자인 산출물 지도 (SPEC-003 M1, 5차 = REV-003-D-3 마무리 · 6차 = REV-003-D-4 후속)

> **심볼은 A안 「담긴 땅」으로 확정**(형진 님 선택, 2026-10-15). 디자인 검수 1회차(`docs/review/REV-003-D-1.md`) R-120~R-136, 2회차(`REV-003-D-2.md`) R-121 재지적·R-170~R-172, 3회차(`REV-003-D-3.md`, **APPROVED**) R-190~R-192·관찰 항목을 반영했다 — 처리 내역은 각 문서 하단 「반영 내역」, 자가 검수는 `self-review.md`. 4차의 핵심은 **수저 아이콘 규칙 변경(R-121 마스터 개입)**: 머리 안에 선 무늬를 두지 않고, 칩은 실루엣·32px 이상만 닫힌 채움 표식. 5차(마무리)는 **칩 아이콘을 강제 색상·단색에서도 채운 실루엣으로(R-190)**, 엔딩 문구를 함수 출력·`REBIRTH_NOTE`로(R-191), 상태 바 4색을 수저 5색·▲▼과 ΔE2000 15 이상 떨어뜨리고(R-192), 은·금 큰 변형의 광택을 구멍 대신 밝은 채움으로 바꿨다. **6차(REV-003-D-4 후속, M1 종결 뒤 소규모)**: 은·금 표식 `fill`을 고정값 + `style` 변수로 이중 지정(iOS Safari 속성 안 `var()` 대비)하고 강제 색상에서 `--sp-mark: Canvas`(두 극성 모두 표식 유지), 상태 4색을 명도 차·색각 시뮬레이션 기준으로 다시 골랐으며(R-195 — 지식 색 이름은 「파랑」), 서술 불일치를 바로잡았다(R-196). 3-0절.

## 1. 산출물 지도

| 무엇 | 어디 | 비고 |
|---|---|---|
| 디자인 시스템 문서 | `design-system.md` | 톤·색 토큰·테마 규칙·글꼴·간격·컴포넌트·사용 예·구현 주의 11항 |
| **문구 기준표** | `copy.md` | 화면·자리·문구·바꾼 이유(인용 없이 SPEC 항목·검수 ID로만). **3절 수저 구간 규칙 + 5단계 × 3시대 예시표**(R-170) |
| 토큰(값의 원본) | `src/styles/tokens.css` | 라이트/다크/강제 색상/움직임 줄이기. 6차: 상태 바 4색 = 건강 연지 #cb2360/#ef4d92 · 행복 자주 #d048a9/#d243b8 · 지식 파랑 #2778ff/#3d7ff0 · 관계 보라 #6232b8/#bb9ade(수저 5색·▲▼과 ΔE2000 ≥ 15, 서로 ≥ 12, 링크·포커스와 ≥ 10, 지식↔관계·행복↔관계 ΔL\* ≥ 12, protan·deutan 시뮬레이션 ≥ 8 — R-192·R-195). 강제 색상 블록에 `--sp-mark: Canvas` |
| 컴포넌트 참고 구현 | `mockups/ds.css` | 시안 HTML이 쓰는 클래스. 구현의 기준 |
| 대비 점검 | `contrast-report.md` (자동 생성) | 라이트 77쌍 + 다크 77쌍, 실패 0 |
| 심볼·로고 (A안) | `src/assets/symbol-a.svg`(정식), `logo-a.svg`(가로), `src/assets/brand/a/`: `symbol-dark/mono`, `symbol-small(-mono)`(단순화), `logo-dark/mono`, `logo-header(-dark/-mono)`(헤더용), `logo-stacked*`, `favicon.svg`, `favicon-32.png`, `apple-touch-icon.png`, `icon-512.png`, `app-icon.svg`; `src/assets/brand/wordmark*.svg` | 도형 원본 `scripts/design/{geo,brandSymbols,brandGeometry}.mjs` |
| 아이콘 스프라이트 | `src/assets/icons/ui-icons.svg`(24px 선 아이콘 18개), **`spoon-grades.svg`** | 수저 아이콘 심볼 10개: **`sp-1`~`sp-5` = 칩 변형**(≤ 24px: 칩 15×24·큰 칩 20×32·릴 — 무늬 없는 실루엣, `currentColor` 채움뿐. 강제 색상·단색에서도 **채운 실루엣**이며 외곽선 변수가 없다, R-190), **`sp-1-lg`~`sp-5-lg` = 큰 변형**(≥ 32px: 첫 화면 띠 32×52·컴포넌트판 — 닫힌 채움 표식만. 은·금의 광택은 밝은 채움 `fill="#fff" style="fill:var(--sp-mark,#fff)"` — 기본 흰빛, 변수는 `style`로만(속성 안 `var()`는 iOS Safari 등이 무시할 수 있다, REV-003-D-4), 강제 색상은 `Canvas`). developer는 칩에 `#sp-N`, 첫 화면 띠에만 `#sp-N-lg`. **아이콘을 이름·점 없이 단독으로 쓰지 않는다**(화면 시안은 테스트가 단언) |
| 얼굴 | `src/assets/faces/faceLayers.ts`, 문서 `faces.md` | 80조합 순수 함수. 4차: 중년 구레나룻 토막·노년 결 줄·청소년 남 앞머리 |
| 화면 시안(HTML) | `mockups/*.html` | `title-a`, `title-continue`, `roulette-spin/result`, **`roulette-result-reduced`**(움직임 줄이기), `birth`, `dashboard-infant/adult`, `decision-infant/adult`, `note`, `ending`, `components`, `symbols`, `faces`, `faces-all`, **`spoon-sizes`**(아이콘 실제 크기 시트) (`?theme=dark`, `&motion=reduce`, 시트는 `?mono=1`) |
| 시안 스크린샷 | `screens/003/*.png` (화면 56장 + 아이콘 시트 5장 + 상태색 색각 시트 1장 + 강제 색상 두 극성 띠 2장) | 모바일 360×740(DPR 2)·데스크톱 1280×800·320×640, `-dark`·`-forced`·`-reduced`·`-full`·`-bottom`. **`spoon-sizes-dpr1.png`** = DPR 1 실제 크기 + 4배 확대(밝은·다크·강제 색상·단색, 부분 파일 `spoon-sizes-dpr1-{light,dark,forced,mono}.png`). **`status-colors-cvd.png`** = 상태 4색 정상·protan·deutan·tritan 네 줄(라이트·다크, 수저 5색·▲▼·링크·포커스 견본 포함). `title-a-mobile-forced-band.png`·`-forced-dark-band.png` = 첫 화면 띠의 강제 색상 검은 글자·흰 글자 극성(은·금 표식 유지) |
| 자가 검수 | `self-review.md` | reviewer 기준 7항목, R-ID별 근거 이미지(이미지를 보고 판단한 결과만 적는다) |
| 저작권·라이선스·문구 대조 | `credits.md` | 외부 자산 0, 글꼴 결정 근거, 캡처 비복제(문구 인용 0)·상태 바 색 변경 사유 |
| 보관 | `archive/brand-bc/`(B·C 심볼·로고·아이콘), `archive/screens-r1/`(1회차 B·C 첫 화면·비교판 스크린샷) | 기록용. 구현 참조 금지 |
| 작업 기록 | `ai-log/2026-10-15_SPEC-003_design-M1.md` | 2차·3차·4차·5차·6차(후속) |

### 먼저 볼 스크린샷 (형진 님·검수자용)
1. `screens/003/spoon-sizes-dpr1.png` — **수저 아이콘 실제 픽셀 크기 시트**(R-121·R-190 완료 근거: 16·20·24px 칩 실루엣이 강제 색상·단색에서도 채움, 32·48px 큰 변형의 은·금 밝은 광택, 밝은·다크·강제 색상·단색, 실제 칩 24px·큰 칩 32px 줄)
2. `screens/003/title-a-mobile.png` — 첫 화면 모바일(다섯 자루 띠 = 큰 변형. 다크 `-dark`에서 은·금 광택이 밝은 채움, 강제 색상 `-forced`, 320px `title-a-320.png`)
3. `screens/003/roulette-result-mobile-reduced.png` — 움직임 줄이기 룰렛(결과 상태 + 안내), `roulette-result-mobile.png`(「흙수저(하위 25% 안쪽) · 경기」)
4. `screens/003/birth-top-mobile.png`, `dashboard-adult-mobile.png`(+`-forced`), `ending-mobile-full.png`, `components-desktop-full.png` — 수저 구간 표기(칩 + 「(하위 25% 안쪽)」, 엔딩 범례는 칩 시작점 들여쓰기), 상태 바 4색(연지·자주·파랑·보라)과 수저 5색·▲▼의 구분, 엔딩 문장(함수 출력 그대로, `REBIRTH_NOTE`, 시안 주석 표시)
5. `screens/003/faces-48-desktop-full.png`, `faces-small-sizes.png` — 얼굴(중년 구레나룻·노년 흰머리·청소년 남 수정, 48·72·96px 실제 크기)
6. `screens/003/status-colors-cvd.png` — **상태 4색 색각 시뮬레이션**(R-195: 정상·protan·deutan·tritan × 라이트·다크, 줄마다 최소 ΔE2000·ΔL\* 표기), `title-a-mobile-forced-dark-band.png` — 흰 글자 고대비에서도 은·금 표식이 남는 띠
(그 밖에 `components-desktop-full.png` 수저 절, `dashboard-infant-mobile-full.png` 자산 현황(칩 없음), `symbols-desktop-full.png`)

## 2. 심볼 A안 「담긴 땅」 — 확정 내용

- 뜻: 비스듬히 선 숟가락의 머리 안에 한반도가 비어 있다(음각) — **태어날 때 쥐는 숟가락 안에 이 땅의 인생이 들어 있다.** 한반도는 하나의 실루엣(분단선·국경선·행정 경계 없음), 제주·울릉도·독도 포함, 색은 쪽빛 하나(다크 크림색, 단색판 currentColor).
- **정식 심볼**(≥ 48px: 첫 화면·앱 아이콘·터치 아이콘): 머리 안 지도의 높이 = 머리 높이의 **74%**(기준 70% 이상, `buildBrand`가 측정·점검). 섬 면적은 제주 > 울릉도 > 독도(제주가 울릉도의 2배 이상, `tests/designAssets.test.ts`).
- **단순화 심볼**(≤ 40px: 모든 화면 헤더·파비콘): 지도 윤곽 14점, 섬 생략, 머리를 키우고 자루를 굵게. 28px에서도 금 간 숟가락·번개·열쇠로 읽히지 않는다(`symbols-desktop-full.png` 사다리). 돋보기 오독 여지는 마스터 결정으로 이번엔 손대지 않았다.
- 헤더 로고 `brand/a/logo-header.svg` 40px → 워드마크 글자 높이 약 23px(기준 ≥ 22px). 첫 화면 세로 로고 236px → 글자 약 62px(기준 ≥ 40px).
- 금지: 한반도 실루엣 단독 사용(항상 숟가락과 한 묶음), 하늘색·연파랑 계열, 기울임·늘임·임의 색.
- 고르지 않은 B 「상 위에」·C 「상차림」: `archive/brand-bc/`.

## 3-0. 6차(REV-003-D-4 후속, M1 종결 뒤 소규모)에서 바뀐 것 — 요약

| 영역 | 바뀐 것 | 지적 |
|---|---|---|
| 은·금 큰 변형 표식 | `spoon-grades.svg`의 `sp-3-lg`·`sp-4-lg` 표식을 `fill="#fff" style="fill:var(--sp-mark,#fff)"`로 이중 지정(속성은 고정값, 변수는 `style`) — 속성 안 `var()`를 무시하는 엔진(iOS Safari 등)에서도 표식이 흰빛. id·경로·viewBox 그대로. 다른 SVG(로고·심볼)는 이미 `style`만 썼다. 테스트 「SVG 프레젠테이션 속성 값에 var() 금지」 추가 | 확인 못 한 것 |
| 강제 색상 표식 | `tokens.css` 강제 색상 블록에 `--sp-mark: Canvas` — 검은 글자·흰 글자 두 극성 모두 몸체(CanvasText) 위에 바탕색 표식이 남는다(`title-a-mobile-forced-band.png`·`-forced-dark-band.png`). `ds.css`·`title.css`에 따로 둘 규칙 없음(5절) | 관찰 (a) |
| 상태 4색 | 라이트 건강 #cb2360(유지)·행복 #d048a9·지식 #2778ff·관계 #6232b8, 다크 건강 #ef4d92(유지)·행복 #d243b8·지식 #3d7ff0·관계 #bb9ade. 이웃 쌍 ΔL\* 지식↔관계 18.4/14.2·행복↔관계 18.2/15.6, protan·deutan 최소 ΔE2000 10.6/10.8, 수저·▲▼ 최소 15.3/15.4, 링크·포커스 최소 11.3/16.0, 상태색끼리 15.5/12.2, 대비 실패 0. 지식 색 이름 「파랑」(쪽빛은 브랜드) | R-195 |
| 금지 범위 | 「35°~170° 일괄 금지」 → 자리별 금지(건강 녹 90~170°, 행복 황 35~70°, 캡처 계열 순서 금지) + 색상 차 ≥ 20°를 원형 거리로 실제 계산 | R-195·R-196 |
| 테스트 | `tests/designAssets.test.ts` 38 → **42건**: 자리별 금지·원형 색상 차, R-192에 링크·포커스(≥ 10), R-195① ΔL\*, R-195② 색각 시뮬레이션(Machado 2009 행렬 자기 점검 포함), SVG 속성 `var()` 금지, 화면 시안 열두 장의 수저 아이콘 단독 사용 0. `checkContrastLib.ts`에 `lightness`·`hueOf`·`hueDistance`·`simulateCvd` | R-195·R-196 |
| 도구·시트 | `scripts/design/previewStatColorsCvd.mjs` → `screens/003/status-colors-cvd.png`(정상·protan·deutan·tritan 네 줄 × 두 테마) | R-195 |
| 서술 정정 | `self-review.md` :15 절 번호(0-2절)·「0건」 서술, `design-system.md` §10.11 「테스트가 막는 것」을 사실대로(단독 사용은 시안 테스트가 막고 구현은 developer 몫), 테스트 주석 「20° 간격」을 실제 계산으로 | R-196 |

## 3. 5차(REV-003-D-3 마무리)에서 바뀐 것 — 요약

| 영역 | 바뀐 것 | 지적 |
|---|---|---|
| 수저 칩 아이콘 | 강제 색상·단색에서도 **CanvasText(currentColor)로 채운 실루엣**(외곽선 아님). `spoon-grades.svg`의 칩 변형에서 stroke·외곽선 변수 제거, ds.css 강제 색상 규칙은 `color: CanvasText`뿐. 시트의 칩 변형 줄을 실제 `.grade svg.spoon` CSS 경로로 재촬영 + 큰 칩 32px 줄 추가. `design-system.md` §1·§6·§10에 「아이콘은 이름·점 없이 단독 사용 금지」 | R-190(마스터 결정) |
| 엔딩 문구 | `copy.md`·생성기: 엔딩 문장은 `endingText.ts`·`lifeText.ts` 출력 그대로, 어체는 C1·M7e를 따른다(시안은 M7e 전 현행 출력 — 시안 주석으로 표시). 연표 사망 줄 = `deathEntryText`(요약과 같은 어체). 다시 태어나기 안내 = `REBIRTH_NOTE` 그대로. 출발선 막대 `aria-label` = `bandLabel`·`standingLabel`·`MOVEMENT_TEXT` 조합(생성기가 함수 호출) | R-191 |
| 상태 바 4색 | (5차 당시 값 — 6차에서 재조정, 3-0절) 건강 연지 #cb2360/#ef4d92 · 행복 자주 #a3248c/#d884dc · 지식 파랑 #1f4db6/#4a8de8 · 관계 보라 #7040c8/#a078f0 — 수저 5색·▲▼과 두 테마 모두 ΔE2000 ≥ 15, 서로 ≥ 12, 바↔트랙 3:1 이상, 녹·황 계열 아님. `checkContrastLib`에 CIEDE2000 추가, 테스트 2건 | R-192 |
| 큰 변형 은·금 | 광택을 evenodd 구멍 대신 **밝은 채움**(`var(--sp-mark,#fff)`)으로 — 다크 테마·강제 색상에서 「어두운 흠」으로 뒤집히지 않는다. id·경로·viewBox 그대로 | 관찰 |
| 엔딩 범례·주석 | 구간 글자가 줄바꿈될 때 칩 시작점에 들여쓰기(격자 2열 + `.grade-line`), 구간 글자 굵기를 출생신고와 통일(굵게), 시안 주석을 `.mock-tag`(점선)로 구분 | 관찰 |
| 문서 한정 | `credits.md` 「띠·강조색에 적갈색·청록을 쓰지 않았다」·「캡처 문구는 디자인 문서에는 옮겨 적지 않는다」(`copy.md`도 같게), `self-review.md` 잔여 인용 제거 | 관찰 |

## 3-1. 4차(REV-003-D-2 반영)에서 바뀐 것 — 요약

| 영역 | 바뀐 것 | 지적 |
|---|---|---|
| 수저 아이콘 | **규칙 변경**: 머리 안 선 무늬 금지(모든 크기). 칩 변형 `sp-N` = 실루엣, 큰 변형 `sp-N-lg` = 닫힌 채움 표식(흙 더미 / 동 없음 / 은 짧은 광택 / 금 점 / 다이아 마름모). DPR 1 실제 크기 시트 + 테스트 2건 | R-121(마스터 개입) |
| 수저 구간 표기 | `bandLabel(startBandOf(era, wealth))` 한 함수 출력, 「흙수저(하위 25% 안쪽)」 — 룰렛 결과·출생신고·프로필·엔딩 출발선. `copy.md` 3절 예시표(5단계 × 3시대). 엔딩 회고 문장은 `endingText.ts` 출력 그대로. 영유아 「자산 현황」 칩 제거 | R-170 |
| 룰렛 움직임 줄이기 | 별도 시안 `roulette-result-reduced`: 결과 상태 + 안내 한 줄 + 「출생신고 보기」. 릴 순서 = 확률표 순서로 고정 | R-171 |
| 문서 정합 | 「카드 접기」·「다른 집 아이들과 견주면」 통일, `copy.md`·`credits.md`에서 캡처 문구 인용 제거, 캐러셀 **7초**·「1 / 14」 일치, 상태 바 색에서 녹·황 계열 제거(5차에서 다시 조정) | R-172 |
| 얼굴 | 중년 구레나룻 짧은 토막, 노년 가는 윤곽선 + 회색 결 줄, 청소년 남 앞머리 | 관찰(마스터 추가) |
| 시안 데이터 | 또래 1 「대전광역시 서구 · 흙」 | 관찰 |
| 도구 | `shootSpoonSizes.mjs`(DPR 1 시트), `previewFaces.mjs`(얼굴 실제 크기), `zoomCrop.mjs`(픽셀 확대) | — |

3차(REV-003-D-1)에서 바뀐 것은 `REV-003-D-1.md` 하단 「반영 내역」에 있다.

## 4. 다시 만드는 법 (순서대로)

```
node scripts/design/buildBrand.mjs             # 심볼·로고 SVG, 앱 아이콘 PNG (크로미움 필요). 지도 70%·머리 안쪽 여유 점검 포함
npx vite-node scripts/design/buildIcons.mjs    # 아이콘 스프라이트 (sp-N·sp-N-lg 포함)
npx vite-node scripts/design/buildMockups.mjs  # 시안 HTML (koreaStats.json·koreaStatsAccess.ts·endingText.ts를 읽는다)
npx vite-node scripts/design/shootMockups.mjs  # 스크린샷 56장 + 넘침 점검(문서·요소 단위, 360·1280·320·다크·강제 색상·움직임 줄이기) — 0건이 아니면 종료 코드 1
npx vite-node scripts/design/shootSpoonSizes.mjs   # 수저 아이콘 DPR 1 실제 크기 시트 (spoon-sizes-dpr1.png)
npx vite-node scripts/design/previewStatColorsCvd.mjs   # 상태 4색 색각 시뮬레이션 시트 (status-colors-cvd.png) — 상태 토큰을 고치면 다시
npx vite-node scripts/checkContrast.ts --write     # 대비 보고서
npx vitest run tests/designAssets.test.ts          # 자산 계약(토큰·상태 색·얼굴·숟가락 도형·심볼·아이콘 R-121·문구 기록)
npx vite-node scripts/design/previewFaces.mjs [out.png]   # (작업용) 얼굴 48·72·96px 시트
node scripts/design/zoomCrop.mjs <in.png> <x> <y> <w> <h> <배율> <out.png>   # (작업용) 픽셀 확대
node scripts/design/previewBrand.mjs <png>     # (작업용) 심볼·로고 미리보기
```
시안 HTML은 `file://`로 바로 열린다(`?theme=dark`로 다크, `&motion=reduce`로 움직임 줄이기). 정적 서버가 필요 없다.

## 5. developer에게 (M2~ 구현 주의)
- 헤더 로고는 `brand/a/logo-header.svg`(또는 인라인), 높이 `--logo-h-header`(40px). 첫 화면은 `brand/a/logo-stacked.svg`(모바일)·`logo-a.svg`(데스크톱 108px). 파비콘·터치 아이콘은 `brand/a/favicon.svg`·`favicon-32.png`·`apple-touch-icon.png`·`icon-512.png`.
- **수저 아이콘**: 칩·릴·서류·프로필·엔딩은 `#sp-N`, 첫 화면 띠(32×52)만 `#sp-N-lg`. 강제 색상에서 칩 아이콘은 `.grade svg.spoon { color: CanvasText }`만 — **외곽선으로 바꾸지 않는다**(R-190, 스프라이트에 외곽선 변수가 없다). 아이콘을 이름·점 없이 단독으로 쓰지 않는다. 은·금 큰 변형의 밝은 표식은 `--sp-mark`(기본 흰빛)로만 바꾼다. 머리 안에 선 무늬를 더하지 않는다(테스트가 막는다).
  - **6차 스프라이트 교체(M2 배포 전)**: `spoon-grades.svg`는 그대로 바꿔 끼운다 — id·경로·viewBox 동일, 바뀐 것은 `sp-3-lg`·`sp-4-lg` 표식의 `fill="var(--sp-mark,#fff)"` → `fill="#fff" style="fill:var(--sp-mark,#fff)"`뿐. 화면 코드 수정 없음.
  - **강제 색상 표식**: `tokens.css`의 `@media (forced-colors: active) { :root { --sp-mark: Canvas } }`가 이미 있고 앱은 `main.tsx`가 `tokens.css`를 읽으므로 **`title.css`에 넣을 것은 없다.** 만약 띠를 `tokens.css` 없이 그리거나 `title.css`의 강제 색상 블록에서 띠 아이콘에 `forced-color-adjust: none`을 주게 되면 그 블록에 한 줄만 더한다: `.spoon-lineup svg.spoon--lg { --sp-mark: Canvas; }`. 기대 모습: 검은 글자 고대비 = 검은 몸체 위 흰 표식, 흰 글자 고대비 = 흰 몸체 위 검은 표식(`screens/003/title-a-mobile-forced-band.png`·`-forced-dark-band.png`).
  - SVG 자산에 CSS 변수를 쓸 때는 프레젠테이션 속성(`fill="var(…)"`)이 아니라 `style="fill:var(…)"`로 — `tests/designAssets.test.ts`가 `src/assets` 전체를 단언한다.
- **엔딩**: 회고 문장·연표 사망 줄·다시 태어나기 안내는 `endingText.ts`(`deathLineText`·`choiceCountText`·`journeyText`·`MOVEMENT_TEXT`·`JOURNEY_NOTE`·`REBIRTH_LABEL`·`REBIRTH_NOTE`)·`lifeText.ts#deathEntryText` 출력 그대로(어체는 M7e가 바꾼다). 출발선 막대 `aria-label`은 「출발선 {bandLabel}, 마지막 {standingLabel}. {MOVEMENT_TEXT}」 조합(R-191). 범례의 칩 + 구간은 `.grade-line` 안에 함께.
- **상태 바 색**: 토큰 이름은 그대로, 값만 바뀌었다(5차·6차 모두 코드 수정 없음). 문서·코드 주석에서 지식 색은 「파랑」이라 부른다(「쪽빛」은 브랜드 `--c-brand`). 새 색을 더할 때는 `tests/designAssets.test.ts`의 네 규칙(수저 5색·▲▼과 ΔE2000 ≥ 15, 상태색끼리 ≥ 12, 링크·포커스 ≥ 10, 이웃 쌍 ΔL\* ≥ 12, protan·deutan 시뮬레이션 ≥ 8, 자리별 색상 금지)을 통과해야 한다. 상태 카드 안에 링크 글자(`--c-link`)를 두지 않는다.
- **수저 구간**: `bandLabel(startBandOf(era, wealth))`만, 형식 「흙수저(하위 25% 안쪽)」(`copy.md` 3절). `standingLabel`은 외모·체중·엔딩 도착 자리 전용. 대시보드 「자산 현황」에 칩 없음.
- **룰렛 움직임 줄이기**: 회전 상태를 만들지 않고 결과 상태 + `.motion-note`로 시작. 릴 순서는 확률표 순서.
- 캐러셀: 자동 넘김 7초, 「{i} / {N}」의 N은 `getCarouselIndicators().length`(14).
- 문구는 `copy.md`, 컴포넌트 구조는 `mockups/ds.css`, 얼굴은 `faceLayers.ts`(`eyeDetail`·`noseBridge` 키는 없고, 4차에 추가된 머리 모양 변경은 API에 영향 없음). 자세한 목록은 `design-system.md` 10절.
