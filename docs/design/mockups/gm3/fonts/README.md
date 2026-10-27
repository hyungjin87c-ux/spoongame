# Noto Sans KR 부분 집합 — 시안용 (SPEC-004 GM3 r3, designer 2026-10-27)

- 원본: 이 PC에 설치된 Noto Sans KR **v2.004**(정적 Regular·Bold, Adobe/Google, SIL Open Font License 1.1 — 전문 `OFL.txt`, 글꼴 name 표 13·14로 확인). 저작권: (c) 2014-2021 Adobe (http://www.adobe.com/), with Reserved Font Name 'Source'. 「Source」는 예약 글꼴 이름(RFN)이지만 이 파일들의 이름 「Noto Sans KR」에는 들어 있지 않으므로 부분 집합(= OFL의 Modified Version)에 그대로 쓸 수 있다. 외부 주소 0, 내려받기 0.
- 만든 방법: `node scripts/design/buildGm3Fonts.mjs`(Python fontTools subset + Node brotli). 글자 집합과 조각 규칙은 그 스크립트 머리글, 절차는 `docs/design/design-system.md` 17-11.
- 파일 이름 `NotoSansKR-{굵기}.{조각}.woff2` — 조각 s0(첫 화면이 처음 그리는 글자) · s0b(첫 화면의 나머지) · s1(룰렛·출생신고) · s2(그 밖 게임 글자) · s3(KS X 1001 꼬리). `noto-sans-kr.css`가 `@font-face` + `unicode-range`로 묶는다. WOFF(zlib)는 만들지 않는다(마스터 결정 2026-10-27 — 저장소 크기; WOFF2는 이 스크립트의 널 변환 파일 그대로, `brotli` 모듈은 받지 않는다).

## 글자 집합

| 집합 | 글자 수 | 그중 한글 |
|---|---:|---:|
| GAME | 1,202 | 1,034 |
| GM3 | 578 | 508 |
| TITLE | 507 | 440 |
| RENDERED | 289 | 247 |
| ROULETTE | 271 | 234 |
| KS | 2,350 | 2,350 |
| S0 | 346 | 247 |
| S0B | 194 | 193 |
| S1 | 28 | 28 |
| S2 | 638 | 570 |
| S3 | 1,313 | 1,313 |
| ALL | 1,206 | 1,038 |

## 측정(바이트 실측, 2026-10-27)

| 안 | 굵기 | 조각 | 글자 수 | TTF | **WOFF2(널 변환)** | 파일 |
|---|---|---|---:|---:|---:|---|
| A 정적 한 파일 | 400 | all | 1,206 | 201,164 | **86,444** | (임시) |
| A 정적 한 파일 | 700 | all | 1,206 | 201,040 | **87,644** | (임시) |
| B 정적 조각 | 400 | s0 | 346 | 56,532 | **28,752** | docs/design/mockups/gm3/fonts/NotoSansKR-400.s0.woff2 |
| B 정적 조각 | 400 | s0b | 194 | 33,584 | **17,780** | docs/design/mockups/gm3/fonts/NotoSansKR-400.s0b.woff2 |
| B 정적 조각 | 400 | s1 | 28 | 6,716 | **4,096** | docs/design/mockups/gm3/fonts/NotoSansKR-400.s1.woff2 |
| B 정적 조각 | 400 | s2 | 638 | 109,728 | **52,828** | docs/design/mockups/gm3/fonts/NotoSansKR-400.s2.woff2 |
| B 정적 조각 | 400 | s3 | 1,313 | 251,792 | **106,148** | docs/design/mockups/gm3/fonts/NotoSansKR-400.s3.woff2 |
| B 정적 조각 | 700 | s0 | 346 | 56,492 | **29,028** | docs/design/mockups/gm3/fonts/NotoSansKR-700.s0.woff2 |
| B 정적 조각 | 700 | s0b | 194 | 33,556 | **17,964** | docs/design/mockups/gm3/fonts/NotoSansKR-700.s0b.woff2 |
| B 정적 조각 | 700 | s1 | 28 | 6,708 | **4,132** | docs/design/mockups/gm3/fonts/NotoSansKR-700.s1.woff2 |
| B 정적 조각 | 700 | s2 | 638 | 109,664 | **52,364** | docs/design/mockups/gm3/fonts/NotoSansKR-700.s2.woff2 |
| B 정적 조각 | 700 | s3 | 1,313 | 251,572 | **105,452** | docs/design/mockups/gm3/fonts/NotoSansKR-700.s3.woff2 |
| C 가변 조각 | VF | s0 | 346 | 94,156 | **47,712** | (임시) |
| C 가변 조각 | VF | s0b | 194 | 54,428 | **29,312** | (임시) |
| C 가변 조각 | VF | s1 | 28 | 10,844 | **6,528** | (임시) |
| C 가변 조각 | VF | s2 | 638 | 178,764 | **86,628** | (임시) |
| C 가변 조각 | VF | s3 | 1,313 | 414,480 | **177,612** | (임시) |
| C 가변 한 파일 | VF | all | 1,206 | 329,488 | **145,744** | (임시) |

## 안별 합계(WOFF2 널 변환 바이트)

| 안 | 첫 화면이 처음 받는 바이트(s0) | 첫 화면 글자 전부(s0+s0b) | 룰렛 화면까지 누적 | 전체(s3 꼬리 제외) | s3 꼬리(필요할 때만) |
|---|---:|---:|---:|---:|---:|
| A 정적 한 파일(400+700) | 174,088 | 174,088 | 174,088 | 174,088 | — |
| B 정적 조각(400+700) | 57,780 | 93,524 | 101,752 | 206,944 | 211,600 |
| B′ 정적 조각 400만(굵게는 합성) | 28,752 | 46,532 | 50,628 | 103,456 | 106,148 |
| C 가변 조각(wght 400~700) | 47,712 | 77,024 | 83,552 | 170,180 | 177,612 |
| C′ 가변 한 파일 | 145,744 | 145,744 | 145,744 | 145,744 | — |

- 정식 WOFF2(glyf 변환, fontTools+brotli)는 보통 이보다 5~15% 작지만 `brotli` 모듈 내려받기가 필요해 쓰지 않는다(마스터 결정 2026-10-27) — 위 수치가 그대로 배포 크기다.
- 대체 글꼴 맞춤(맑은 고딕 → Noto Sans KR 수직 metric·폭): size-adjust 92.19% · ascent-override 116.00% · descent-override 28.80% · line-gap-override 0.00% (Noto: upm 1000, hhea 1160/-288/0, 표본 평균 폭 905.8 · 맑은 고딕: upm 2048, hhea 2229/-495/0, 표본 평균 폭 2012.2; 표본 = 첫 화면 한글 247자 + 숫자).

- `noto-sans-kr.css` 39,024B(원문) · brotli 압축 ≈ **4,133B**(unicode-range 목록이 길지만 압축이 잘 된다 — 초기 로드 셈에는 이 압축 바이트가 들어간다).
