# 구현 ↔ 시안 차이 목록 (SPEC-005, designer) — QI2 홈 시안이 지금 구현(1차 `src/`)과 달라지는 점

2026-10-20 QI2(홈 시안)에서 시작한다. `diff-003.md`와 같은 규칙: 상태 열 「시안 제안」 = 형진 님 확인 뒤 developer가 QI3·QI4·QI6·QI7에서 구현 / 「의도」 = 정적 시안의 한계라 그대로 둔다 / 「결정 필요」 = 형진 님 또는 마스터. ID는 `D5-NN`. 지금 구현의 근거는 `src/screens/TitleScreen.tsx`·`src/ui/StatsCarousel.tsx`·`src/styles/title.css`·`src/data/titleText.ts`·`src/core/carousel.ts`(2026-10-20, main `02f47c5`와 같은 `src/`), 시안은 `docs/design/mockups/title-005.html`·`title-005.css`·`title-005-compare.html`·`pictogram-b.svg` → `docs/design/screens/005/`. 문구는 `copy.md` 9절.

**`src/`는 읽기만 했다.** 시안 CSS는 `ds.css`를 건드리지 않고 `title-005.css`에 따로 두었다(형진 님 확인 전) — 확인 뒤 developer가 `title.css`로 옮길 때 같은 블록을 `ds.css`에도 합친다.

## 1. 머리 — 로고와 한반도 픽토그램 (HS1)

| ID | 곳 | 지금 구현 | 시안 | 상태 · 근거 |
|---|---|---|---|---|
| D5-01 | 제목(h1) | `<TitleLogos>` — 좁은 화면 세로 로고(심볼 위 + 워드마크, 236px, 가운데 정렬), 넓은 화면 가로 로고(심볼 + 워드마크, 108px) | **A안**: 두 폭 모두 **워드마크만**(`brand/wordmark.svg` 인라인 — 좁은 52px → 글자 41px, 넓은 64px → 51px, DS1 ≥ 40 실측) + 픽토그램 자리. **B안**: 넓은 화면은 지금 가로 로고 108px 그대로, **좁은 화면은 워드마크만**(헤더형 로고로 글자 40px을 지키면 폭 290px이라 픽토그램과 한 줄 328px에 못 들어간다 — 실측 357px) | **결정 필요(형진 님 — A/B)**. 어느 쪽이든 `TitleLogos`의 세로 로고 분기가 없어지고 머리가 왼쪽 정렬 행이 된다(`hero__brand` = h1 + 픽토그램) |
| D5-02 | 한반도 픽토그램 | 없음 | `.picto--inline`(< 960px, 로고 줄 오른쪽, 64px) / `.picto--top`(≥ 960px, 오른쪽 열 맨 위 오른쪽 맞춤, 168px, ≥ 1600px 200px). `aria-hidden`, 클릭 없음, 외부 요청 0, 세 변형(라이트 `--c-logo` / 다크 토큰 / 강제 색상 `CanvasText`). **A** = 정식 심볼 `symbol-a.svg` 그대로(새 자산 없음, 「담긴 땅」 규칙 R-130 그대로). **B** = `mockups/pictogram-b.svg`(심볼과 같은 좌표 `brandSymbols.mjs#map` — 60점 윤곽 + 섬 셋, 북쪽 위, 분단선·경계 없음, 쪽빛) | 시안 제안. **B를 고르면** `scripts/design/buildBrand.mjs`에 생성 단계를 더해 `src/assets/brand/a/peninsula{,-dark,-mono}.svg`로 내고, `tests/designAssets.test.ts`의 섬 비율 계약을 재사용하며, **`design-system.md` 1절 R-130(한반도 단독 금지)을 「첫 화면 픽토그램 한 자리만 예외, 하늘색 금지·분단선 금지 유지」로 고친다**(reviewer REV-003-M9-2 심볼 감점 — 한반도기 연상 — 이 B에서 더 커질 수 있음) |
| D5-03 | 넓은 화면 격자 | `.title__side`가 캐러셀 카드 하나 | `.title__side`가 세로 flex: 픽토그램 → 카드. sticky·안쪽 스크롤·`--bar-h` 규칙(R-224·R-220)은 그대로 | 시안 제안. 1280×800에서 카드 위끝 y=205, 표제어·값·그래프 첫 부분이 스크롤 0에서 보인다(HS3 ④, 실측 표제어 아래끝 280 · 값 350) |
| D5-04 | 좁은 화면 머리 정렬 | 가운데 정렬(세로 로고 아래 설명·띠·가상 인구) | **왼쪽 정렬**(로고 줄이 행이 되므로 아래 글도 왼쪽) — 수저 띠 `max-width: 420px` 왼쪽 | 시안 제안(판단: 한 줄 로고 + 오른쪽 픽토그램 아래에 가운데 글이 오면 축이 둘이 된다) |

## 2. 선택 영역 — 슬롯 (HS2·HS3·HV3)

| ID | 곳 | 지금 구현 | 시안 | 상태 · 근거 |
|---|---|---|---|---|
| D5-05 | 큰 슬롯 격자 | `.choices--1`(1열) 라디오 카드 3장, 카드 안 여백 `--sp-3/--sp-4` | `.choices--grid { repeat(auto-fit, minmax(min(100%, 15rem), 1fr)) }` + `.radio-card--compact`(여백 한 단 작게, 제목 `--fs-md`, 보조 `--fs-xs`) — 1280에서 **2열**(3장 = 2 + 1, 8장 = 4행), 360에서 1열. 카드 수·열 수에 의존하지 않는 한 컴포넌트(HS3 ①) | 시안 제안. 8장 합성(`?slot=gen8`)에서 가로 넘침 0(1280·1920·360·320×200%), 1280×800은 아래 슬롯이 띠 아래로 내려가 스크롤 154px(CM10은 `scroll-padding`이 맡는다 — 정적 시안 Tab 순회는 감사 한계), 1920×1080은 전부 한 화면 |
| D5-06 | 인생 길이 | 라디오 카드 2장(`choices--2`) + 세 문장 안내(`lifeLengthHint`), 1280×800에서 띠에 반쯤 가림(KNOWN-title-life-length-hidden) | **분절 컨트롤** `.seg`(`role="radiogroup"`, `label.seg__opt > input[type=radio]`, 보이는 높이 32px, 거친 포인터에서 input이 44px) + 한 줄 안내 `.seg__hint`(42자). 묶음 제목 「인생 길이」는 왼쪽 같은 줄. 높이 1280 163 → 66px · 360 269 → 129px | 시안 제안(HS2 ①~⑥). **1280×800 띠 가림 해소**: 왼쪽 열 끝(스위치 아래끝) y=655 < 띠 위끝 732(3장) — 완료 기준 8 |
| D5-07 | 무거운 장면 가리기 | 없음 | 설정 줄 `.slot--setting` > `button.switch[role=switch][aria-checked]` + 트랙·썸 + 이름/상태 알약/한 줄 설명(`aria-labelledby`·`aria-describedby`). 기본 꺼짐 | 시안 제안. QI3는 자리와 값 저장(설정 v5 `gentle`)만, 가림 동작은 QI6. 판 도중 도구 줄 6번째 버튼 자리는 QI6 시안에서 |
| D5-08 | `LIFE_LENGTH_TEXT[*].desc` | 「가볍게 한 판」「결정을 더 많이」가 카드 보조문 | 분절 컨트롤에는 보조문 자리가 없다 — 화면에서 사라진다 | 시안 제안(데이터는 두어도 됨). `TITLE_TEXT.lifeLengthHint` 글자 교체(copy.md 9-4), `tests/titleScreen.test.tsx`·`e2e/first-screen.spec.ts`의 문구 단언 갱신 |

## 3. 통계 캐러셀 (SH1~SH7·FC1~FC2)

| ID | 곳 | 지금 구현 | 시안 | 상태 · 근거 |
|---|---|---|---|---|
| D5-09 | 카드 머리 | `.carousel__head` = `h2.card__title` 「한국 사회 통계」 + `.carousel__note`(「7초마다 다음 지표」/「자동 넘김 멈춤」) + `.carousel__ctrl`(44px 버튼 넷) | `h2.sr-only` 「한국 사회 통계」 + `.carousel__nav`(오른쪽 위 정렬, 28px 상자 버튼 셋 + 「i / N」 `--fs-xs`). 거친 포인터에서 버튼 자체가 44px(`.nav-btn` 44 / 보이는 `.nav-btn__box` 28 — 요소 넘침 0) | 시안 제안(SH4·SH5). 삭제: `TITLE_TEXT.carouselTitle`·`carouselAutoNote`·`carouselPausedNote`, `data-testid="carousel-auto-note"`와 사용처(5개 파일 12곳) |
| D5-10 | 일시정지 상태 | 아이콘 + 이름 + 머리 문구 셋이 상태를 말함 | **아이콘 + 이름만**(「자동 넘김 일시정지」 ↔ 「자동 넘김 다시 시작」). QM2-2 재개 불변식 e2e는 버튼 상태를 단언 | 시안 제안(SH6) |
| D5-11 | 자동 넘김 주기 | `AUTO_ADVANCE_MS = 7000` | **9000** | 마스터 결정(M8 일부). `tests/carousel.test.ts`·`e2e/autoplay-resume.spec.ts`의 시계 값 |
| D5-12 | 슬라이드 머리 | `h3.t-h3` = 지표 이름(`slide.title`) · 기준 줄 「2025년 기준」 | `h3.slide__insight`(표제어, `--fs-xl`) + `p.slide__official`(「공식 통계명(기준)」, `--fs-xs`·`--c-text-3`) · 연도만 있던 기준 줄 삭제, 분모(「인구 10만 명당」)만 남김 · `aria-label` 「n/N 표제어, 공식 통계명(기준)」 | 시안 제안(SH1~SH3). 데이터 `src/data/statHeadlines.ts`(copy.md 9-1·9-10), `core/carousel.ts`의 기준 문구 분기, `tests/statHeadlines.test.ts` |
| D5-13 | 지표 수·순서 | 14장(`CAROUSEL_ORDER`) | **19장** = 14 + 전망 5(캐러셀 끝, `proj-population`·`proj-births`·`proj-life-expectancy`·`proj-heat`·`proj-single-household`) ≤ 20 | 시안 제안(FC1, 마스터 결정 M10). 전망 데이터는 QI4 수집(R-149) — P1~P4는 지금 데이터(`future-projection`·`heat-projection`)의 실제 값, **P5 1인 가구 전망은 가짜 값**(장래가구추계 수집 뒤 교체 또는 부록 C의 다른 후보) |
| D5-14 | 전망 슬라이드 부품 | 없음(`future-projection`은 `use: future`로 첫 화면에 안 보임) | `.chip--proj` 「전망」(아이콘 `#i-proj` + 글자) · 공식 전망명 줄 `({발표} 발표, {기준} 기준, {시나리오})` · 그래프 `line--proj`(10 5 놋쇠) + `split` 세로 점선 + 「실측 | 전망」 라벨 · 막대 `chart-bar--proj`(스프라이트 `#hatch` 빗금) · 범례 `swatch-line--proj` · 한 줄 `.slide__projnote` | 시안 제안(FC2). 스프라이트 `ui-icons.svg`에 `i-proj`·`i-shuffle`·`hatch` 추가(designer 몫, `buildIcons.mjs`) |
| D5-15 | 연령 빈곤율 | `elderly-poverty`(66세 이상 한 줄 + 18~65세 보조 계열) | 자리에 `poverty-by-age`(연령계층별 막대, **가짜 값** 표기) — 표제어 「나이들수록 또래들과 경제력 차이가 극심해져요」 | **QI4 수집 뒤 교체**(형진 님 답 M8). 수집 전에는 `elderly-poverty`를 그대로 두고 표제어만 대안 「노년의 살림살이는 어떨까?」(부록 B)로 둘지는 마스터 결정 |
| D5-16 | 자살률 표제어 | 지표 이름 「자살률」 | 후보 ① 「삶을 스스로 마감하는 사람은 얼마나 될까?」(copy.md 9-1 #5에 ②③) | **결정 필요(reviewer 판독 + 마스터 승인, M9)**. HV7 가림 꼴은 QI6 |

## 4. 푸터 · 띠 · 테마

| ID | 곳 | 지금 구현 | 시안 | 상태 · 근거 |
|---|---|---|---|---|
| D5-17 | 푸터 링크 | 없음 | `.title-foot__links` 「새 소식 · 자주 묻는 질문」(빌드 표기 위) | 시안 제안 — 자리만, 패널·「새」 표시는 QI7(NT4·FQ1) |
| D5-18 | 통계 출처 줄 | 「국가데이터처, 행정안전부, 교육부」 | 「…, 기상청」이 데이터(`data.orgs`)에서 자동으로 붙는다 | 의도(생성 규칙 그대로) |
| D5-19 | 하단 띠 | 새 판 68px / 이어서 살기 120px / 확인 단계 | 같음(`?state=saved`로 120px 띠를 보임 — 왼쪽 열 끝 655 < 띠 680) | 의도. 확인 단계는 `title-continue.html?state=confirm` 그대로 |
| D5-20 | 강제 색상·다크 | `title.css`의 기존 블록 | `title-005.css` 강제 색상 블록: 조작 상자·분절·스위치 트랙·칩·랜덤 카드 `CanvasText` 테두리, 선택 분절 `Highlight/HighlightText`, 켜진 스위치 트랙 `Highlight`, 픽토그램 `CanvasText` 채움, 전망 막대 `CanvasText` 빗금 테두리. 다크는 토큰만 | 시안 제안. 샷 `home-a-1280x800-forced.png`·`home-a-1280x800-dark.png`·`home-b-360x740-dark.png` |

## 5. 정적 시안의 한계 (의도)

| ID | 곳 | 내용 |
|---|---|---|
| D5-21 | 차트 높이 | 시안 SVG는 `viewBox` 320×232 그대로 카드 폭으로 늘어나 1280에서 약 290px — 구현은 `chartSizeFor(카드 폭)`으로 다시 그려 약 150px(`diff-003.md` D-102와 같은 한계). 전망 슬라이드도 같다 |
| D5-22 | 동작 | 자동 넘김·스와이프·입력 가드·설정 저장 없음. 조작 줄·분절·스위치·라디오는 시안 전용 스크립트로 눌러 볼 수만 있다 |
| D5-23 | 값 | 가상 인구 51,284명 고정, 빌드 표기 `v0.2.0 (a1b2c3d)`(NT1 제안 버전) |

## 6. 측정값 (2026-10-20, Playwright chromium DPR 1 — 저장소 밖 촬영 스크립트)

- 가로 넘침(문서·요소) 0: 1280×800·1920×1080·360×740·320×640 × A/B × 3장/8장 × 글자 100%·200%(320·1280 8장) — 조작 버튼의 44px 터치 영역을 버튼 자신으로 두어 요소 넘침 0.
- 1280×800 A(3장): 왼쪽 열 끝(스위치) 655 < 띠 732 · 오른쪽 카드 위 205, 표제어 아래 280, 값 350, 그래프 641. B(3장): 699 < 732. A(8장): 886(스크롤 154px), 오른쪽 열 같음. 이어서 살기 띠(120px): 655 < 680.
- 1920×1080 A(8장): 886 < 1012 — 전부 한 화면.
- 360×740: 로고 글자 41px(A·B 모두 워드마크 52px), 픽토그램 64px, 조작 버튼 44×44(보이는 28), 분절 input 44px(보이는 32), 스위치 버튼 높이 67(≥ 44).
- 인생 길이 영역 높이: 1280 163 → 66(40%), 360 269 → 129(48%) — HS2 ④.
- PNG 25장 1.59 MB, 최대 152 KB(`compare-pictogram-desktop.png`), 콘솔 오류 0, 외부 요청 0.

### 6-1. 일러스트 변형(`?hero=illust`) 측정 (2026-10-20 r2, Playwright chromium DPR 1, 저장소 밖 `shoot.mjs`·`measure.mjs`)

- 가로 넘침(문서·요소, sr-only 자손 제외) 0 · 콘솔 오류 0 · 외부 요청 0: 1280×800(라이트·다크·강제 색상·tag=alt·state=saved·gen8·글자 200% gen8·slide=proj-heat), 1920×1080(라이트·다크·gen8), 360×740(라이트·다크·tag=alt·full), 320×640(100%·tag=alt 200%·gen8 200%).
- 1280×800: 그림 255×300(열 428px 가운데, 위 24) → **카드 위 332**(픽토그램 때 205), 표제어 아래 408, 값 아래 478, 그래프 위 484 < 띠 732 — HS3 ④(표제어·값 스크롤 0) 유지. 왼쪽 열 끝 655(3장) < 732, 이어서 살기 띠 655 < 680, 8장 886(스크롤 154) — **QI2 수치 그대로, 띠 가림 재발 없음**. 글자 200% 8장: 값 아래 642 < 732.
- 1920×1080: 그림 341×400 → 카드 위 432, 값 아래 578 < 1012(8장 왼쪽 열 886 < 1012, 한 화면).
- 360×740: 배너 328×200(위 88, 지도 171px), 부제 300~350, 로고 글자 52px 자루(DS1 41px 유지), 왼쪽 본문 끝 1100, 카드 1124~1930. 320×640: 배너 288×200, 넘침 0(200%에서도).
- 한 뷰포트에서 보이는 `<img>`는 하나(숨은 `<picture>`는 폭 0)이고 둘 다 같은 파일을 고른다 — 1280·1920 `home-map-pc.webp`(545×640 → 255×300 / 341×400), 360·320 `home-map-mobile.webp`(341×400 → 171×200).
- 차트 색 실측: 라이트 실측 선 `rgb(47,95,143)`(#2f5f8f) · 다크 `rgb(159,196,234)`(#9fc4ea) · 강제 색상 `rgb(0,0,0)`(ButtonText), 카드 테두리 #d3dce6 / #343d4e / CanvasText.
- PNG 15장 2.45 MB(`illust-*` 14장 2.29 MB + `compare-tagline.png` 158 KB), 최대 342 KB(`illust-1920x1080-dark.png`). 그림 자산 합계 **88.3 KB**(57.5 + 30.8).

### 6-2. 일러스트 r3(1.4배 + 흐림) 측정 (2026-10-20 r3, Playwright chromium DPR 1, 저장소 밖 `shoot.mjs` — 서버 없음 `file://`, 브라우저는 스크립트가 띄우고 닫음)

- 가로 넘침(문서·요소, sr-only 자손 제외) 0 · 콘솔 오류 0 · 외부 요청 0: 1280×800(라이트·다크·gen8·state=saved·soft 0/1/3), 1920×1080(라이트·다크), 360×740(라이트·다크), 320×640.
- 1280×800: 그림 358×420(r2 255×300, 위 24~444) → **카드 위 412**(r2 332 — 그림 아래 32px이 카드 뒤), 표제어 아래 488, 값 아래 558, 그래프 위 564 < 열 보이는 끝 726 < 띠 732 — HS3 ④(표제어·값 스크롤 0) 유지. 왼쪽 열 끝 655 < 732(3장), 이어서 살기 띠 655 < 680, 8장 886(스크롤 154) — **QI2 수치 그대로**.
- 1920×1080: 그림 426×500(r2 341×400) → 카드 위 488, 값 아래 634 < 1006. **1차 촬영의 560px은 오른쪽 열 폭 428px에 걸려 `max-width: 100%`가 그림을 세로로 찌그러뜨렸다**(428×560, 비율 0.76 ≠ 0.85) → 500px(열 폭에 들어가는 최대) + `object-fit: contain`(안전장치)로 고침.
- 360×740: 배너 191×224(r2 171×200, 위 88~312), 부제 324~374, 「태어날 세상」 제목 636~661 < 띠 672, 첫 카드 669(띠 아래). 배너 높이 탐색(200/216/224/232/240 → 제목 아래끝 637/653/661/669/677): 232부터 띠에 닿아 **224**. 320×640: 배너 같음, 넘침 0.
- 실효 스타일(getComputedStyle, 2단계): 라이트 `opacity 0.8` + `saturate(0.85) contrast(0.92) blur(0.5px)`, 다크 `opacity 0.8` + `brightness(0.9) saturate(0.78) contrast(0.92) blur(0.5px)`. 1차 비교에서 다크는 투명도만으로 「흐려」 보이지 않아(어두운 바탕 위의 밝은 그림) brightness 0.96 → 0.9로 더 내렸다.
- 한 뷰포트에서 보이는 `<img>`는 하나(숨은 쪽은 폭 0)이고 둘 다 같은 파일 — 1280·1920 `home-map-pc.webp`(613×720), 360·320 `home-map-mobile.webp`(375×440).
- 그림 자산 2장 **96.3 KB**(63.6 + 32.7 = 98,570 B ≤ 102,400). PNG 6장 2.68 MB — `illust-r3-1280x800.png` 292 KB · `-dark` 292 · `illust-r3-1920x1080.png` 404 · `illust-r3-360x740.png` 96 · `-dark` 97 · `compare-illust-soft.png` 1.53 MB(비교 시트, 8칸 원본 크기). `npm test -- tests/designAssets.test.ts` 74/74 통과(17:13).

## 7. 첫 화면 일러스트 (형진 님 결정 2026-10-20 — 픽토그램 A/B 대신 형진 님 그림, `?hero=illust`; **r3 2026-10-20 「조금 더 키우고, 약간 흐리게」 반영** — 대표 샷 `illust-r3-1280x800.png`·`illust-r3-360x740.png`, 흐림 비교 `compare-illust-soft.png`)

SPEC-005 「형진 님 결정 — 첫 화면 그림」 ①~⑤. 1절 D5-01·D5-02의 픽토그램 A/B는 **폐기**(D5-01의 「머리는 워드마크 + 왼쪽 정렬 행」은 그대로 — 좁은 화면 로고 줄 오른쪽의 픽토그램 자리만 비고, 그림은 그 아랫줄 배너). 원본 대비 처리 내역은 `design-system.md` 12-5, 출처는 `credits.md`.

| ID | 곳 | 지금 구현 | 시안 | 상태 · 근거 |
|---|---|---|---|---|
| D5-24 | 첫 화면 그림 자리 | 없음 | `figure.illust--top`(≥ 960px: 오른쪽 열 맨 위, 가운데 정렬, 높이 **420px**(r2 300) → ≥ 1600px **500px**(r2 400), 그림 아래 **32px**(≥ 1600 36px)은 통계 카드 뒤로 — D5-32) / `figure.illust--banner`(< 960px: 로고 줄 **아래** 배너, 높이 **224px**(r2 200), 가운데) → 바로 밑 통계 카드와 한 덩어리. 마크업 `<figure aria-hidden="true"><picture><source media="(min-width: 960px)" srcset="…/home-map-pc.webp" type="image/webp"><img src="…/home-map-mobile.webp" width="375" height="440" alt="" decoding="async"></picture></figure>` 둘(배너·오른쪽 열) — 같은 뷰포트에서 둘 다 같은 파일을 고르므로 내려받기 1회 | **형진 님 결정 → r3(2026-10-20 「조금 더 키우고, 약간 흐리게」) 확인 대기**. 구현: `TitleScreen.tsx`에 figure 두 자리(`hero__brand` 아래 · `title__side` 맨 위), CSS는 `title-005.css` 「일러스트」 블록을 `title.css`로. 장식이므로 접근 가능한 이름 없음(HS1 ① 그대로) |
| D5-25 | 그림 자산 | 없음 | `src/assets/home/home-map-pc.webp` **613×720, 63.6 KB**(q58) · `home-map-mobile.webp` **375×440, 32.7 KB**(q66), 알파 WebP(테마별 파일 없음, 흐림도 파일에 굽지 않음), 합계 **96.3 KB ≤ 100 KB▲**(r2 545×640·341×400 = 88.3 KB — 그림을 1.4배 키우며 해상도를 올리고, 화면에서 흐림 처리를 거치므로 품질 단계를 낮췄다). 표시 크기 대비 PC 1.7×(1280 420px)·1.44×(1920 500px), 모바일 1.96×(224px). `width`·`height` 속성 + `height` 고정·`width: auto`·`object-fit: contain` → 레이아웃 이동 0·찌그러짐 0 | 시안 제안. 번들: vite 정적 import(`new URL('../assets/home/home-map-pc.webp', import.meta.url)` 또는 `?url`)로 해시 이름 — `public/`에 두지 않는다(캐시). 초기 로드 1280 ≈ 286 + 64 = **350 KB ≤ 400 KB**(360 ≈ 319 KB). 처리 스크립트 `docs/design/source/cut-home-illustration.py`(r3 값으로 갱신, 재생성 가능) |
| D5-26 | 다크 모드 | — | 같은 파일 + 흐림 2단계 다크 값 `opacity: 0.8` · `filter: brightness(0.9) saturate(0.78) contrast(0.92) blur(0.5px)`(미디어쿼리 `:root:not([data-theme='light'])` + `:root[data-theme='dark']` 두 선택자 — 테마 규칙 DB6 그대로; r2의 `brightness(0.86) saturate(0.9)` 대체). 가장자리는 그림 파일의 알파(흰 테두리 + 22% 크림색 광)가 어두운 바탕에 녹는다 | 시안 제안. 샷 `illust-r3-1280x800-dark.png`·`illust-r3-360x740-dark.png` |
| D5-27 | 통계 카드·차트 색(그림과 어울리게) | `.card` 공용(면 `--c-surface`, 테두리 `--c-border`, 그림자 `--shadow-1`), 차트 실측 선·점·막대·범례 `--c-brand`(쪽빛 #26324a / #b3c2e8) | 카드 안에서만 `--c-brand: var(--c-chart)` — **새 토큰 4개** `--c-chart`(#2f5f8f / #9fc4ea / ButtonText) · `--c-card-tint`(#eef4f9 / #1f2735 / Canvas, 카드 위 88px 그라데이션 띠) · `--c-card-border`(#d3dce6 / #343d4e / CanvasText) · `--shadow-card`(푸른빛 2겹 / none / none). 전망(놋쇠 긴 점선 10 5·빗금)·보조 계열(남자 점선·여자 점선)·칩·텍스트 색은 그대로 → 실측 실선 / 전망 점선 구분 유지 | 시안 제안. `tokens.css`에 토큰 4개(라이트·다크 두 블록·강제 색상) + `checkContrast` 쌍 추가: 선/면 6.55·8.87, 선/띠 6.01·8.26, `--c-text-3`/띠 5.30·5.54, `--c-border-strong`/띠 3.68·3.99, 놋쇠/띠 4.56·7.90(`design-system.md` 12-6). 카드가 그림 바로 아래라 `.carousel--005`에만 적용(다른 카드는 공용 그대로) |
| D5-28 | 부제 | `TITLE_TEXT.tagline` 「태어난 집에 따라 달라지는, 한국인의 한 번의 인생」 | **그대로**. r2의 `?tag=alt` 후보 「다른 세대, 다른 삶, 같은 대한민국」과 「부제 후보」 표식은 r3에서 시안에서 뺐다(마크업 `<p class="hero__tag">` 한 줄로 복귀) | **결정됨(형진 님 2026-10-20)**: 지금 부제 유지, 새 문구는 SPEC-004 세대 선택 구현 때 적용. `compare-tagline.png`·`illust-*-tag-alt.png`는 r2 기록으로 남김 |
| D5-29 | 강제 색상 | `title.css` 기존 블록 | 토큰 4개가 시스템 색으로 돌아가고 카드 배경 `Canvas`, 그림은 `filter: none`(래스터 그림은 강제 색상에서도 원색으로 보인다 — 장식이라 정보 손실 없음) | 시안 제안. 샷 `illust-1280x800-forced.png`(실측 선 검정 = ButtonText) |
| D5-30 | 오른쪽 열 높이 | sticky + 안쪽 스크롤(R-224), `max-height: calc(100vh - --bar-h - …)` | 같음. 그림이 열 안에 있으므로 1280×800에서 카드 위끝이 205(픽토그램) → 332(r2) → **412(r3)**로 내려가고, 표제어 아래 488 · 값 아래 558 · 그래프 위 564 < 열 보이는 끝 726 < 띠 732 — 표제어·값·그래프 첫 162px은 스크롤 0(HS3 ④), 카드 하반부는 **열 안쪽 스크롤**. 1920×1080은 카드 위 488·값 아래 634 < 1006 | 의도. 그림을 420보다 더 키우지 않은 이유: 450px이면 카드 위 442·값 아래 588·그래프 132px — 그림 아래를 카드 뒤로 더 넣으면(tuck 60+) 제주 타일이 반 넘게 가려진다 |
| D5-31 | 좁은 화면 머리 순서 | 세로 로고 → 설명 | 워드마크(52px) → **배너 그림 224px**(r2 200) → 부제 → 수저 띠 → 가상 인구 → 큰 슬롯. 360×740에서 부제 324~374, 「태어날 세상」 제목 636~661 < 띠 672(첫 카드 669는 띠 아래 — 제목만 첫 화면) | 시안 제안. 232px이면 제목 아래끝 669가 띠 672에 닿아 224로 멈췄다(배너 200 → 224 = 1.12배). 형진 님이 선택 영역이 더 일찍 보이길 원하면 200(r2)·160까지 줄일 수 있다 |
| D5-32 | 그림–카드 겹침(r3) | — | `.illust--top { margin-bottom: calc(-1 * var(--illust-tuck)) }`(32px, ≥ 1600px 36px) + `.carousel--005 { position: relative; z-index: 1 }` — 카드가 그림 아래쪽 위에 얹힌다. 제주 타일 아래 약 30%만 가려지고 본토 윤곽(남해안, 그림 높이의 ≈ 92%)은 그대로 | 시안 제안. **z-index가 필요한 이유**: `filter`·`opacity`가 있는 `img`는 자체 스태킹 컨텍스트라 뒤에 오는 형제의 배경보다 위에 그려진다 — 카드를 띄우지 않으면 그림이 카드 위로 올라온다. `.title__side`의 sticky·overflow와는 충돌 없음(열 안에서만 z 1) |
| D5-33 | 흐림(r3 「약간 흐리게」) | — | `.illust img { opacity: var(--illust-opacity); filter: var(--illust-filter); object-fit: contain }` — **2단계(기본)** 라이트 `0.8` / `saturate(0.85) contrast(0.92) blur(0.5px)`, 다크 `0.8` / `brightness(0.9) saturate(0.78) contrast(0.92) blur(0.5px)`, 강제 색상 `opacity: 1; filter: none`. 세 단계 비교 `screens/005/compare-illust-soft.png`(시안 `?soft=0|1|2|3`, 0 = r2 그대로) | 시안 제안. 1단계(투명도만)는 r2와 거의 같아 보이고 3단계(1px 블러)는 인물 디테일이 뭉개져 **2단계 추천**. 두 변수는 `title.css` 「일러스트」 블록의 지역 변수로(첫 화면 전용 — `tokens.css`에 넣지 않음). 그림 위에 글·UI가 없으므로 대비 영향 0. 자산은 한 벌(흐림을 파일에 굽지 않음) |
