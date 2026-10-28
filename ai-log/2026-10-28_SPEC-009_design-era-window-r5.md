# 2026-10-28 SPEC-009 design — 시대의 창 r5(1990~2020년대 49장 + 계층 변주 8) + 디자인 후속

- 누가: designer (마스터 의뢰 2026-10-28 — 「1990~2020년대 묶음과 디자인 후속」. 브랜치 `spec-009`, 커밋은 마스터. `src/`·`tests/`·`scripts/`의 design 밖(developer FM4b 작업 중)·`docs/review/`·`docs/TODO.md` 손대지 않음 — `src/ui/svgNodes.tsx`·`src/styles/family.css`·`src/data/sceneTables.ts`·`src/styles/fonts.css`는 **읽기만**. 인터넷 조사 0 · 외부 URL 0 · 사진 모사 0 · npx 0 · 띄운 프로세스는 Playwright 크로뮴(preview·shoot 스크립트가 띄우고 스스로 닫음)과 `inspect.mjs`의 Chrome(스크립트가 닫음)뿐, 서버 없음(`file://`).)
- 무엇: ① 도우미 `scripts/design/eraR5Lib.mjs`(1990~2020년대 소품 + 공유 패턴 3) ② 장면 `eraR5Scenes90/00/10/20.mjs`(12·13·13·11) + 모음 `eraR5Scenes.mjs` ③ 생성 `buildEraWindowR5.mjs` → `docs/design/mockups/family/era-window-r5.html` + `pieces/era-r5/*.svg` 49 + `era-window-r5-budget.json` ④ 촬영·검사 `shootEraWindowR5.mjs` → `screens/009/era-r5-sheet.jpg`(+`-2`·`-3`, 1280, 각 ≤ 8,000px) · `era-r5-strip-360.jpg` ⑤ 미리보기 `previewEraR5.mjs` ⑥ 문서 `era-window.md` **9절**(r5 — 장면 표 49행·실측·taste 전·후·후속 처리·물음 3), `family-scene.md` 5-4(시대 줄 위치 판단), `README.md` 55차, `credits.md` 행 ⑦ 글꼴 사본 `mockups/gm3/fonts` s2·s3 4파일 + CSS 범위 + README ⑧ 이 로그.
- 결과: 아래. 다음 단계: 형진 님 — 시트 49장 확인(승인 표기는 마스터), 9-5절 물음 셋. 마스터 — R-553 A안·1960년대 밝기 값, 초가 규칙 한 줄을 developer에게. developer(승인 뒤) — `genEraWindows.ts` META에 r5 추가 · R-551 가드 +49 · `TRIM` 금 모으기 [1998,1998] · `family.css` 두 값.

## 1. 장면 49장(무거운 장면 ○ 9)

| 10년대 | 사건 | 일상 | 변주(아래 / 위) |
|---|---|---|---|
| 1990년대 12 | 1990 신도시 공사장 · 1991 노래방 · 1993 시험장 교문 · **○ 1994 끊긴 한강 다리** · 1997 새벽 인력시장 · 1998 역 광장 급식 줄(둘째, 금 모으기와 같은 해) · 1999 새천년의 밤 | 공중전화 줄과 호출기(13~29) · 야간 자율학습(13~19) · 아파트 놀이터(7~12) | 옥탑방 / 신도시 아파트 거실 |
| 2000년대 13 | 2000 피시방 · 2001 정류장의 폴더 휴대전화 · 2002 거리 응원 · **○ 2003 지하철역 입구의 연기** · 2004 고속열차 승강장 · 2005~06 부동산 유리창 · **○ 2008 여름밤 촛불** · **○ 2009 5월 광장의 조문 줄** | 미니홈피 방(13~29) · 학교 앞 분식집(모두) · 편의점 밤 근무(20~29) | 고시원 / 학원가의 밤 |
| 2010년대 13 | **○ 2010 서해의 수색** · 2012 공연장 조명 · **○ 2014 기울어진 배와 노란 리본** · 2015 마스크 줄 · **○ 2016 겨울 광장의 촛불** · **○ 2017 지진 뒤의 골목** · 2018 휴대전화 속 그래프 · 2019 세로 화면 | 지하철의 휴대전화(모두) · 혼자 먹는 자리(20~29) · 학원 버스 정류장(7~12) | 원룸(창밖은 옆 건물 벽) / 공항 출국장 |
| 2020년대 11 | 2020 선별진료소 앞 · 2021 빈 교실의 화면 수업 · **○ 2022 좁은 골목의 통제선과 꽃** · 2023 마트 저울 · 2024 화면 속 말풍선 · 2025 책상 위 시간표 | 식탁 재택(모두) · 배달 골목(모두) · 키오스크 줄(모두) | 새벽 물류센터 셔틀 / 고층 거실의 재택 |

- 수위: 「현장까지, 순간은 아님」. 유지선 ①~④ 전부 — 얼굴 0(뒷모습·옆모습·먼 인물), 글자·상호·로고·번호·휘장 0(피켓·화면·전광판·쪽지·간판은 빈 면), 정당 상징 0, 평가 문장 0, 사진 모사 0. 대구 지하철·세월호·이태원은 장면마다 판단을 시트 캡션과 9-1절 표에 적음(2003 입구와 연기·진입하는 소방관까지 / 2014 멀리 기울어진 배와 보트·헬기, 앞 난간의 리본 / 2022 이튿날의 빈 골목·통제선·꽃까지, 근접 0).
- 2009는 5월 광장 조문 줄(영정·이름·장례 행렬 0 — 1979 선례), 2017은 11월 지진으로 그림(2016 광장은 2016년만) — 형진 님 물음.
- 붉은 옷(2002)·소방차·구급차 띠는 토큰 `clay`, 노란 리본·통제선·조끼·학원 셔틀은 `cloth2`(새 토큰 0). 새 공유 패턴 3(`era-lit` 밤 창 · `era-grid` 격자 · `era-cups` 촛불 바다) 336B — 허용 태그 안, class는 허용 목록 안, 새 심볼 0.

## 2. 크기(`era-window-r5-budget.json`)

- 장당 gzip 평균 **1,197B**(695~1,760), 49장 합 58,661B — 장당 2.5KB 초과 **0**(무거운 장면 최대 2003 1,760B).
- 10년 덩어리(한 줄·defs 1,573B·토큰 CSS 1,125B 포함): 1990년대 12 + 승인 1995·1998 **20,293B** · 2000년대 13 **16,641B** · 2010년대 13 **15,431B** · 2020년대 11 **12,866B** — 모두 24KB 안. 92장(승인 43 + r5 49) 누적 추정 ≈ **105.8KB**(230KB 안), 한 번에 받는 양 ≈ 66KB(75KB 안).
- 캡처: `era-r5-sheet.jpg` 1,243KB · `-2` 1,046KB · `-3` 155KB(1280 × 17,223px을 셋으로) · `era-r5-strip-360.jpg` 697KB(1,180 × 6,109px) · taste 전·후 1440 각 180KB.

## 3. design-taste 전·후(designer.md 3·5·9·10)

- 읽은 것: `SKILL.md` · `references/app-screens.md` 2.7·13·14절 · `tells.md`. `draw.mjs`·`assets.mjs` 안 씀.

| 대상 | 전 | 후 | 남은 경고(규칙 9 — 일부러 둠) |
|---|---|---|---|
| `era-window-r5.html` inspect `--app` 1440·768·390 | 0 FAIL · 2 WARN(`palette-cream` · `panel-void` — R-553 카드 모형의 집 그림 자리 130px) | **0 FAIL · 1 WARN** | `palette-cream` — 확정 바탕 토큰 `#f9f7f2` |
| lint `--app` 시트 + 생성기 6 | **1 FAIL**(`gradient` — 집 그림 자리 틀을 family.css처럼 그라디언트로) · 1 WARN(`em-dash` 19) | **0 FAIL · 1 WARN** | `em-dash` — 한국어 캡션 줄표, 읽기에 걸리지 않음 |
| shoot(캡처 + 검사) | 기대치 오류 2 · 320 글자 200% 넘침(고정 폭 326 모형) · 강제 색상 바탕 대조 · 띠 합성 1,223KB | **문제 0**(넘침 0 · 본 51·확대 9·띠 51 · use 461 빈 것 0 · R-553 모형 80/80/104 · 외부 요청 0 · 글자 14/16px) | – |

- 고친 순서(글꼴 → 색 → 여백 → 구성): 모형의 집 그림 자리를 그라디언트 대신 실제 배경 조각 `pieces/s1/bg-metro-b2.svg` 인라인으로(끊긴 그림 판정·320 넘침도 같이 해결) → 띠 크기 캡션을 해·표시만으로(360 합성 11,129 → 6,109px) → 그림은 미리보기 세 크기로: 1990 골조 색·크레인 높이, 1999 종루를 열린 누각으로, 2010 함정 선체 짙게, 2014 여객선을 물에 내림. `--allow` 안 씀. 전·후 사본 `screens/009/era-r5-taste-before/after-1440.jpg`(`.taste-skill/`은 저장소에 올리지 않는다).

## 4. 후속 처리 결과(`era-window.md` 9-4절)

1. **R-553 ① 360 띠 빈 바탕** — 시트에 360 카드 모형 셋(지금 / A 바탕을 카드와 같게 / B 띠 104px). **A 추천**(「그림만」 결정과 띠 80px 유지, B는 띠 242px = 33vh). developer 값: `@container scene (max-width: 480px) { .era { height: 80px; background: var(--c-surface); } }` — 가려 둔·빈 칸의 `--c-surface-2` 네모는 그대로.
2. **R-553 ② 1960년대 밝기** — `.era[data-dec='1960'] svg { filter: sepia(.42) saturate(.72) contrast(.93) brightness(1.05); }`, 다크 `sepia(.2) saturate(.85) brightness(1.04)`. 시트에 1965·1961 전·후 나란히.
3. **초가·슬레이트(1970~75 시골·바닷가 흙수저 h2)** — 그 집은 초가가 맞다 → 새 그림 없이 규칙으로: `thatch` 조건(rural·coast · ≤1975 · wealth ≤2)이면 지붕 값이 있는 h1을 1975년까지 쓴다(한 줄). 슬레이트 변형(h2 `roof:'slate'`, +≈400B)은 보류 — 형진 님이 1976~80년대도 양옥은 아니라고 보시면 다음 묶음.
4. **글꼴 사본** — `mockups/gm3/fonts` s2·s3 4파일을 src와 바이트 같게, `noto-sans-kr.css` s2·s3 범위도 같게, README 갱신 줄. s0·s0b·s1은 GM4 이후 src와 다르다(시안은 자기 범위로 쓰므로 둠 — 전부 맞추려면 `buildGm3Fonts.mjs` 재실행, 마스터 판단).
5. **시대 줄 위치** — 구현(그해 첫 기록 앞 = 화면에서 그해 줄들 아래)을 **인정**. `family-scene.md` 5-4에 한 줄. 시안 안 고침.

## 5. 산출물
- 새: `scripts/design/{eraR5Lib, eraR5Scenes, eraR5Scenes90, eraR5Scenes00, eraR5Scenes10, eraR5Scenes20, buildEraWindowR5, shootEraWindowR5, previewEraR5}.mjs` · `docs/design/mockups/family/{era-window-r5.html, era-window-r5-budget.json}` · `pieces/era-r5/*.svg` 49 · `docs/design/screens/009/{era-r5-sheet, era-r5-sheet-2, era-r5-sheet-3, era-r5-strip-360, era-r5-taste-before-1440, era-r5-taste-after-1440}.jpg` · 이 로그.
- 고침: `docs/design/{era-window, family-scene, README, credits}.md` · `docs/design/mockups/gm3/fonts/{NotoSansKR-400.s2, NotoSansKR-700.s2, NotoSansKR-400.s3, NotoSansKR-700.s3}.woff2` · `noto-sans-kr.css` · `fonts/README.md`.
- 불변: `src/` · `tests/` · `e2e/` · `scripts/`(design 밖) · `docs/spec/` · `docs/TODO.md` · `docs/review/` · `pieces/era-r3·era-r4/` · r1~r4 시트.

## 6. 형진 님·마스터께
1. 2009(5월 조문 줄 vs 1월 참사 vs 무겁지 않은 해)와 2017(11월 지진) 선택.
2. 2003·2014·2022 세 장의 수위 — 여기서 멈출지 더 멀리 둘지.
3. 외환위기 생활 장면(1997 인력시장·1998 급식 줄 둘째)을 둬도 되는지.
