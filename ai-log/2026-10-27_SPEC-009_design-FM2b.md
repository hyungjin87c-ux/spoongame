# 2026-10-27 SPEC-009 design-FM2b — 그림체 「종이 오림」 확정 뒤: 나머지 장면 셋 + 한계 장면 · 조각 설계 문서(FH10) · 매체(TV) 자리와 화면 표본(FT1~FT3) · 토큰 24개 정리

- 누가: designer (마스터 지시 2026-10-27 — s2를 기본 경로에서 빼고 비교 자료로만, FH7 나머지 장면 ①②③을 그림체 1로, `family-scene.md`(FH10) 조각 표, 토큰 24개 design-system 정리. 추가 지시 2건: ① TV 자리만(화면 빈 슬롯 px) → ② FT1~FT6 확정(커밋 57a4ced)에 따라 **시대 TV 조각을 그리고 화면 표본 두 장**(문화·스포츠 1 + 정치 일반 상징 1)을 시험 삼아 그려 gzip 실측. 지킨 것: `src/` 읽기만(토큰·`ageGroupOf` 경계를 읽었을 뿐) · 커밋 없음 · 외부 자원·웹 접근 0 · 다른 게임 그림 0 · 도트·그림 안 글자·상호 0 · 줄 끝 LF · 사용자 폴더 경로 0).
- 무엇: ① 생성기 `scripts/design/buildFamilyMockups.mjs` — 기본 실행은 s1만(`--with-s2`로만 s2·compare.html 재생성, `pieces/s2/`는 지우지 않음), 조각 id를 시대 밴드 접미(`-b1/b2/b3`·`-h1/h2/h3`·`-e1/e2/e3`)로 통일, 조각마다 `years`를 두고 장면마다 연도 단언(`assertYears`, 위반이면 빌드 실패), 집 조각이 슬롯(`screen`·`window`·`porch`)을 내놓음, `person(figSpec(age, sex, era))` 한 함수로 연령대 8 × 성별 2 × 시대 옷 3(e1 생활 한복 `hanbok`/`hanbok-m` 추가, e2 `shirt-shorts` 추가, elder 지팡이), 아래 한 줄 `sceneLineOf`(와/과 받침, 40자 규칙 ①②③), `scenes.json`(한 줄·매체 자리·빈 화면 px) ② 새 조각 27 — 배경 `bg-rural-b1`·`bg-town-b1`·`bg-metro-b3`, 집 `house-detached-h1`(초가/기와 파라미터)·`house-multi-h3`, 소품 `prop-well`·`prop-haystack`·`prop-tree`·`prop-water-tank`, 매체 6(`media-radio`·`tv-bw`·`tv-color`·`tv-flat`·`tv-wall`·`handheld`), 식구 조합 11, `pet-dog-indoor` ③ 장면 c(1955 전남 고흥군 초가 3세대 7명 + 마당 개 + 마루 라디오) · d(2015 서울 관악구 다세대 3명 + 집 안 개 + 벽걸이 TV) · e(한계: 1968 대구 중구 기와 단독 8명 + 마당 개 + 마루 고양이 + 라디오), a·b에도 매체(흑백 TV 창 너머 · 컬러 TV 거실 창) ④ 화면 속 그해 표본 2(`screen-stadium-flame` 1988 · `screen-ballot-box` 1987, 좌표계 40×24, `approved: false`) ⑤ 촬영 `shootFamily.mjs`(기본 FM2b 4장 + 검사 13, `fm2`는 게이트 6장) ⑥ 문서 `docs/design/family-scene.md`(새) · `family-art.md` 상태 · `design-system.md` 18절 · `README.md` 47차 · `credits.md` 행 · 이 로그.
- 편집 범위: 새 — `docs/design/family-scene.md` · `docs/design/mockups/family/scenes.html`·`scenes.json` · `pieces/s1/*.svg` 53(옛 24는 id가 바뀌어 지우고 다시 씀) · `docs/design/screens/009/fm2b-*.png` 4 · 이 로그. 수정 — `buildFamilyMockups.mjs` · `shootFamily.mjs` · `mockups/family/{dashboard-family.html, pieces.html, family.css, budget.json}` · `family-art.md` · `design-system.md` · `README.md` · `credits.md`. 불변 — `src/`·`tests/`·`e2e/`·`docs/spec/`·`docs/TODO.md`·`mockups/family/compare.html`·`pieces/s2/`. 띄운 프로세스: Playwright 크로뮴(`shootFamily.mjs`가 띄우고 닫음) · `inspect.mjs`의 Chrome(스크립트가 닫음). 서버 없음(file://).

## 1. 스킬 절차(designer.md 1~10)
1. 읽기: `SKILL.md` · `references/app-screens.md` 전체 · `tells.md`. 2. 토큰·정체성 불변, 방향 뽑기 없음(구성 요소 작업 — GM3 r4 `achromatic-ledger` 그대로). 3. 전: `dashboard-family.html`(FM2 상태, 장면 a) → `.taste-skill/009/fm2b-before`, 후: 같은 파일(장면 a 기본, 매체 추가) → `fm2b-after`, 폭 1440·1280·768·390·360. 4. 순서: 글자(새 글자 크기 0 — 한 줄 14px 굵게 그대로) → 색(토큰 24개 안, 새 토큰 0) → 구획(그림 카드 구조 불변) → 구성 요소(매체 조각·새 장면) → 움직임(없음). 5. 정본 캡처 4장만 저장소에, `.taste-skill/`은 올리지 않음. 6·7. 외부 사진 0 — `assets.mjs` 미사용. 8. 외부 주소 0(검사 외부 요청 0). 9·10. 예외 표 4절.

## 2. 전 (fm2b-before = FM2 시안 그대로)
inspect `--app` 1 FAIL `button-fx`@768 · 3 WARN `palette-cream`·`heavy-borders`·`ragged-row`(전부 기존). lint `--app` family + 생성기 0 FAIL · 1 WARN `em-dash` 10.

## 3. 결정·발견 (요약 — 정본은 `family-scene.md`)
- **장면별 결과**: c 7명(업힌 아기 포함)·초가·마루 라디오·우물·볏가리 — 360에서도 식구 구분됨, 한 줄 37자 2줄. d 다세대(필로티·바깥 계단·물탱크)·벽걸이 TV·창가 개 — 한 줄 24자 1줄. **e 8명 + 2마리 — 집 scale 0.86, 간격 30~37, 식구 x 404~616(안전 영역 안), 한 줄 40자 = 360에서 정확히 2줄(규칙 ①~③ 발동 전 한계), 320·글자 200%는 5줄이지만 넘침 0.** a·b 매체 추가 뒤에도 구도 불변.
- **s2 정리**: 기본 빌드에서 제외, `--with-s2`로만 재생성. `compare.html`·`pieces/s2/`는 게이트 기록으로 남김(지우지 않음).
- **매체(FT1)**: 시대 소품 층의 묶음, 집 슬롯 `screen`(창 너머) 또는 `porch`(마루)에. 빈 화면 자리 실측: 흑백 16×12단위 = **PC 13.4×10px · 휴대폰 8.2×6.1px**, 컬러 20×15 = 16.7×12.5 / 10.2×7.6, 평면 34×18 = 28.4×15 / 17.3×9.2, 벽걸이 40×22 = **33.4×18.4 / 20.4×11.2**, 휴대폰 10×14 = 8.3×11.7 / 5.1×7.1. → 25vh 그림 안의 화면은 색·형태 **힌트** 크기라, 같은 그림을 **「그해」 줄(한 줄 밑, 60×36px + 링크 하나)**에도 두는 제안을 적었다(마스터 확정 필요, FH6 포커스 규칙의 예외 1개).
- **화면 표본(FT2·FT3)**: 1988 성화대·관중석(문화·스포츠) **276B**, 1987 투표함(정치 일반 상징) **241B**(개별 gzip). 휘장·글자·인물·정당 상징 0, 특정 사진 모사 0. 1940~2020 × 1장 = 81장 ≈ 21.0KB 개별 → 덩어리 ≈ **8.4KB**, × 2장 = 162장 ≈ 42.0KB → ≈ **16.8KB**(덩어리 비율 0.40 적용) + 한 줄 문장 ≈ 5KB.
- **만들다 고친 것**: ① 「부모님와 함께」 → 받침 조사(와/과) ② 초가 지붕이 납작한 판으로 읽힘 → 둥근 처마 + 용마루 띠(`clay`+`wood`) ③ 장면 e 안테나가 지붕 위에 떠 있음 → y 105 ④ 합성 캡처에서 그림이 겹침 → figure 폭 고정 ⑤ 매체 확대 캡처가 제목 글자를 물고 들어옴 → 그림 영역 안으로 클립 ⑥ 성화대가 촛불로 읽힐 수 있음 → 기둥 + 접시 추가.

## 4. 후 + 남은 경고·예외
| 대상 | 전 | 후 |
|---|---|---|
| inspect `--app` 1440·1280·768·390·360 | 1 FAIL · 3 WARN | **같음(1 FAIL · 3 WARN, 새 경고 0)** |
| lint `--app` family 폴더 + 생성기 + 촬영 | 0 FAIL · 1 WARN `em-dash` 10 | 0 FAIL · 1 WARN `em-dash` 12(한국어 주석 줄표) |
| shootFamily(캡처 4 + 검사 13) | — | **문제 0**: 넘침 0(1280·360·320 글자 200%·1920·다크·강제·접힘·펼침) · 그림 높이 ≤ 25vh 전부(534×200 · 326×130 · 1920 534×214) · 가운데 열 순서 `decision/fold → scene-card → log`, 휴대폰 `decision → scene-card → profile …` · 접기 키보드 왕복 · 대체 글 = 한 줄 + 반려동물 문장 · 한계 장면 360 한 줄 2줄 · 외부 요청 0 · 캡처 ≤ 133KB |

| 검사 | 경고 | 처리 | 이유 |
|---|---|---|---|
| inspect | `button-fx`@768 FAIL | 기존 예외 | ds.css 버튼 그림자(GM3 기록과 같음, 이 시안이 만든 것 아님) |
| inspect | `palette-cream`·`heavy-borders` | 예외 | 확정 토큰 · 접근성 3:1 경계(규칙 9) |
| inspect | `ragged-row` | 예외 | 3열 대시보드의 열 높이 차(DB1 배치, 기존) |
| lint | `em-dash` 12 | 기록 | 한국어 주석의 줄표 |
| app-screens | 카드 위끝 그림 + 작은 TV 화면 | 의도 | 우리 조각 그림(장식 아님). 화면은 빈 자리 + 표본, 사진·그라디언트 0 |

## 5. 예산 실측 (`budget.json`, 기준 덩어리 gzip)
- s1 **51조각**(배경 5 · 집 4 · 소품 14 · 매체 6 · 식구 19 · 반려동물 3): 개별 평균 342B(합 17,437) · **덩어리 7,025B**(조각당 138B, 비율 0.40) · 93조각 단순 추정 12.8KB · 110조각 15.2KB. 층별 개별 평균: 배경 369 · 집 612 · 소품 205 · 매체 221 · 식구 421 · 반려동물 319.
- 93조각 가중 추정(집 21 × 612 등) 개별 34.9KB → **덩어리 ≈ 14.0KB**. `family` 합계 추정 = 조각 14 + 화면 그림(2장 기준) 21 + 표·이름·소품 연도 ≤ 30 = **≤ 65KB < 75KB**. 조각 평균 ≤ 0.45KB(0.34) · 조각 덩어리 ≤ 45KB · 합계 ≤ 75KB 모두 안.
- `<pattern>`/`<use>` 적용 시 집 조각 1~2KB 추가 절감, 식구를 런타임 함수로 두면 조각 덩어리에서 약 3.5KB 추가 절감(조각 셈법은 마스터 확인).

## 6. 산출물
- 시안 `docs/design/mockups/family/`: `scenes.html`(장면 다섯 + 화면 표본, `?theme=dark&w=`) · `dashboard-family.html`(`?scene=a|b|c|d|e&theme=dark&motion=reduce&fold=1&open=1&decision=fold`) · `pieces.html`(층별) · `scenes.json` · `budget.json`(s1 51 + screens, s2 비교 기록 유지) · `family.css` · `pieces/s1/*.svg` 53. 비교 기록 `compare.html`·`pieces/s2/` 불변.
- 캡처 4장 `docs/design/screens/009/`: `fm2b-scene-c.png`(82KB) · `fm2b-scene-d.png`(79KB) · `fm2b-scene-e.png`(133KB, 라이트 520 · 다크 520 · 360×740 대시보드) · `fm2b-tv-slots.png`(98KB, 매체 자리 ×3 + 표본 둘).
- 문서: `docs/design/family-scene.md`(새 — 1 좌표계·층·슬롯, 2 조각 표 93, 3 `sceneOf` 고르기 표, 4 `<pattern>`/`<use>`, 5 매체·화면(FT), 6 예산, 7 한 줄 규칙, 8 참조 구조, 9 질문) · `family-art.md` 상태 줄 · `design-system.md` 18절(토큰 24개 표) · `README.md` 47차·산출물 지도·먼저 볼 스크린샷 19 · `credits.md` 행.

## 7. 다음
1. 마스터·형진 님: `family-scene.md` 9절 질문 6개 — ① 화면 그림 두 자리(TV 힌트 + 「그해」 줄 60×36px·링크 1) ② 표본 둘 승인 ③ 식구 런타임 함수의 조각 셈법 ④ 「주택 이외의 거처」 한 줄 낱말 「작은 집」 ⑤ `media-handheld` 자리 ⑥ 요양 시설 집 1종(상한 110 안).
2. developer(FM5): `PIECES`·슬롯·`sceneOf` 고르기 표·매체 규칙·`sceneLineOf` 40자 규칙을 코드로, `tokens.css`에 `--c-scene-*` 24개 반영, 반복 도형 `<pattern>`/`<use>`, 화면 그림은 시대별 하위 덩어리 후보. 남은 조각 42(배경 7 · 집 17 · 소품 8 · 식구 몸 중 미작성 연령대 middle/elder · 반려동물 3 · 틀 1)는 designer가 FM5와 병행해 그린다.
3. reviewer: 정체성(절제·낙인 없음)·닮음 판독 — 새 장면 셋과 표본 둘 포함.

## 시험 결과
- `./node_modules/.bin/vitest run tests/repoHygiene.test.ts tests/designAssets.test.ts`(2026-10-27): **repoHygiene 22/22 통과**(LF·사용자 폴더 경로 0 — 새 파일 포함). designAssets **108/111 — 실패 3은 FM2 로그와 같은 developer GM4 동시 작업 원인**(`buildMockups.mjs`가 읽는 `src/data/birthReportText.ts#regionOddsNote` 삭제 · D-97/D-98 glue 문장 · `TitleScreen.tsx` width/height 대조). 디자인 산출물은 `src/`를 읽지 않으며 `designAssets`의 `mockups/*.html` 글롭은 `family/` 하위 폴더를 보지 않는다.
- 바뀐 파일: 위 「편집 범위」. 커밋·푸시 없음. `git status`의 `src/**`·`scripts/*.ts`·`tests/**` 변경은 developer 작업분이다.
