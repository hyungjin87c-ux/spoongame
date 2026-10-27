# 2026-10-27 SPEC-009 design-FM2c — 형진 님 제안: TV를 그림 밖으로 · 연도 표 · 「시대의 창」 칸 배치 시안

- 누가: designer (마스터 지시 2026-10-27 — 형진 님 제안 「TV를 그림 안에 넣지 않고, 연도를 그림 우측 상단에, 가족과 집 그림 우측에 별도 시대의 창 그림칸」을 시안으로. 지킨 것: `src/` 읽기만(토큰만 링크로 읽음) · 커밋 없음 · 외부 자원·웹 접근 0 · 그림 안 글자·인물·정당 상징 0 · 줄 끝 LF · 사용자 폴더 경로 0 · 띄운 프로세스는 Playwright 크로뮴·inspect의 Chrome뿐, 스크립트가 스스로 닫음, 서버 없음(file://)).
- 무엇: ① 생성기 `scripts/design/buildFamilyMockups.mjs` — 매체 조각 6과 집의 `screen` 슬롯·매체 층 제거(조각 51 → **45**), `ERA`(시대의 창 그림 3, 좌표계 **40×20**, `ERA_LINE_MAX` 22 단언, `eraFor`, `eraBox` HTML), 대시보드 그림 카드에 연도 표(`.scene__year`)와 시대의 창 칸(`.era` 링크) + 쿼리 `era·hide·stamp·label·split`, `family.css` 배치 규칙(2:1 격자, 컨테이너 ≤ 480px 쌓기·가로 띠, 다크·강제 색상), `scenes.html#era-samples`, `budget.json#era`, `scenes.json#layouts` ② 촬영 `shootFamily.mjs` 기본 모드 `fm2c`(캡처 4 + 검사 25, `fm2b`는 기록이라 다시 만들지 않음) ③ 문서 `docs/design/family-scene.md` 1·2-4·3·**5(새로 씀)**·6·9절, `family-art.md` 상태 줄, `design-system.md` 18절 한 줄, `credits.md` 행, `README.md` 48차·산출물 지도·먼저 볼 스크린샷 20 ④ 캡처 `docs/design/screens/009/fm2c-*.png` 4장 ⑤ 이 로그.
- 편집 범위: 새 — `screens/009/fm2c-dash-1280.png`·`fm2c-dash-e-1280.png`·`fm2c-dash-360.png`·`fm2c-dash-dark.png`, `pieces/s1/era-*.svg` 3(옛 `screen-*.svg` 2와 `media-*.svg` 6은 생성기가 지움), 이 로그. 수정 — 생성기·촬영 스크립트, `mockups/family/{dashboard-family.html, scenes.html, pieces.html, family.css, budget.json, scenes.json}`, `family-scene.md`·`family-art.md`·`design-system.md`·`credits.md`·`README.md`. 불변 — `src/`·`tests/`·`e2e/`·`docs/spec/`·`docs/TODO.md`·`fm2b-*.png`·`compare.html`·`pieces/s2/`. `git status`의 `src/**`·`scripts/*.ts` 변경은 developer 작업분이다.

## 1. 스킬 절차(designer.md 1~10)
1. 읽기: `SKILL.md` · `references/app-screens.md` 전체 · `tells.md`. 2. 토큰·정체성 불변, 방향 뽑기 없음(구성 요소 작업). 3. 전: `dashboard-family.html`(FM2b 상태) → `.taste-skill/009/fm2c-before`, 후: 같은 파일(장면 a 기본) → `fm2c-after`, 폭 1440·1280·768·390·360. 4. 순서: 글자(연도 표 14px 굵게 · 창 글 12px/14px — 기존 토큰 크기, 새 크기 0) → 색(토큰 안, 새 토큰 0 — 창 글 바닥은 `--c-surface-2`) → 구획(그림 띠를 2열 격자로, 카드 바깥 구조 불변) → 구성 요소(연도 표·창 칸·링크) → 움직임(해 바뀜 교차 페이드만, 기존 규칙). 5. 정본 캡처 4장만 저장소에, `.taste-skill/`은 올리지 않음. 6·7. 외부 사진 0 — `assets.mjs` 미사용. 8. 외부 주소 0(검사 외부 요청 0). 9·10. 예외 표 4절.

## 2. 전 (fm2c-before = FM2b 시안 그대로)
inspect `--app` 1 FAIL `button-fx`@768 · 3 WARN `palette-cream`·`heavy-borders`·`ragged-row`(전부 기존). lint `--app` family + 생성기 + 촬영 0 FAIL · 1 WARN `em-dash` 12.

## 3. 결정·실측 (정본은 `family-scene.md` 5절)
- **배치 PC 2:1 채택**(카드 534px: 집 **351×140**, 창 175×140 — 그림 175×78 + 머리 글자 1줄 + 문장 2줄 12px). 한계 장면 E 실측: 어른 **52px** · 어린이 36 · 머리 r 5.8(FM2b 534×200의 78·55에서 줄었고, 지금 휴대폰 326px의 48·34와 비슷 — 360에서 읽힘이 확인된 크기). 비교 5:2(집 376×150, 어른 55, 창 150 — 글 한 줄 12자) · 3:1(집 395×158, 어른 58, 창 132 — **문장 3줄**, 그림 1.67:1로 좌우 잘림) → 탈락.
- **휴대폰 360 쌓기 채택**: 집 전폭 326×130(25vh 185 안) + 창 **가로 띠 326×47**(그림 88×44 + 「시대의 창 · 문장」 14px 2줄) = 띠 합계 **186px ≈ 25vh**. 비교 나란히 2:1(집 212×85, 어른 **31px**·어린이 22, 창이 집보다 높아짐 127) → 탈락. 접기는 「그림 접기」의 결과로만(둘 다 사라짐, Enter 왕복 실측).
- **연도 표**: HTML 종이 꼬리표 「1988년」 14px 굵게 **62×24px**, `--c-text`/`--c-surface` 대비 **라이트 15.81 · 다크 13.17 · 강제 색상 21**(Canvas/CanvasText + 1px 테두리). 집 그림 대체 글에 연도가 앞에 붙는다(실측 「1988년 서울 성북구 · … 개 한 마리가 있습니다.」). 나이 함께 적는 안 「1988년 · 13세」(106×24, `?stamp=age`)는 시안에만 — **연도만을 제안**(나이는 머리띠에 있고 날짜 도장처럼 한 값).
- **시대의 창**: 창틀 장식 없음(평면 칸: 그림 위 + 글 바닥 `--c-surface-2`). 머리 글자 「시대의 창」은 글 바닥 첫 줄(PC) / 문장 앞 이어 쓰기(휴대폰 띠) — 없는 안 `?label=0`(그림 +17px). 한 줄 ≤ **22자**(빌드 단언) → 투표함 문장을 「국민이 대통령을 직접 뽑았습니다.」(18자)로 줄여 제안. **칸 전체가 링크 하나**(`#life-log`, 구현은 그해 연표 줄) = **초점 정지점 1**(FH6 예외) — 카드 Tab 순서 시대의 창 → 함께 사는 사람 → 그림 접기, Enter로 이동 실측. 접근 이름 「시대의 창 · 서울에서 올림픽이 열렸습니다. 그해 기록으로」. 그림 좌표계 **40×20**(2:1, 안전 영역 x 3~37 · y 1~19 — PC 자리 2.24:1에서 위·아래 1.1단위만 잘림). 그해 장면이 없는 해는 **생활 장면**(연도 범위로 재사용, ▲ 5년 단위 17장)으로 채우고 빌드가 1940~2020 빈 해 0을 단언, 가리기면 재난은 한 줄만(칸 틀 유지, 생활 장면으로 바꿔 넣지 않음).
- **표본 셋**(승인 전): `era-stadium-flame` 1988(280B) · `era-ballot-box` 1987(240B) · `era-kite-roofs` 1960~1979 생활 장면 「겨울이면 동네 하늘에 연이 떴습니다.」(376B, 연도 범위 ▲).
- **글자 200%·작은 화면**: 1280 글자 200%에서 창이 194px로 커지고 집 그림 아래 `--c-surface-2` 54px — 넘침·잘림 0. 320 글자 200% 한 줄 5줄·넘침 0. 1280×600(25vh 150)에서도 집 140이라 안 닿음. 1920 집 351×140(폭이 정한다).
- **만들다 고친 것**: ① 창 그림을 5:3 그대로 두면 PC 자리(2.24:1)에서 위·아래 3단위가 잘려 성화 불꽃이 깎임 → 좌표계 40×20으로 ② 머리 글자를 문장에 이어 쓰면 PC 12px에서 3줄 → PC는 머리 글자 줄 분리, 휴대폰만 이어 쓰기 ③ 글자 200%에서 창 그림 높이 0 → `min-height 48px` ④ 연 그림의 선을 `mk().stroke`로 그리면 최소 2단위라 너무 굵음 → 0.45단위 선 직접 ⑤ 3:1 비교 변형의 3줄은 비교 증거라 검사 예외.

## 4. 후 + 남은 경고·예외
| 대상 | 전 | 후 |
|---|---|---|
| inspect `--app` 1440·1280·768·390·360 | 1 FAIL · 3 WARN | **같음(1 FAIL · 3 WARN, 새 경고 0)**. 글자 크기 집합 11/12/14/16/18/22 불변(창 글 12px·연도 표 14px은 기존 크기) |
| lint `--app` family 폴더 + 생성기 + 촬영 | 0 FAIL · 1 WARN `em-dash` 12 | 0 FAIL · 1 WARN `em-dash`(한국어 주석 줄표) |
| shootFamily(캡처 4 + 검사 25) | — | **문제 0**: 넘침 0(1280·360·320 글자 200%·1280 글자 200%·1920·1280×600·다크·강제·접힘·펼침·가리기·머리 글자 없음·나이 표) · 집 그림 ≤ 25vh 전부 · 순서 `fold/decision → scene-card → log`, 휴대폰 `decision → scene-card → profile …` · 접기 키보드(둘 다 사라짐) · 시대의 창 링크 Enter → `#life-log` · 초점 정지점 1 · 연도 표·창 글자 대비 ≥ 11.4 · 창 문장 ≤ 2줄(제안 배치) · 외부 요청 0 · 캡처 ≤ 165KB |
| repoHygiene | — | `./node_modules/.bin/vitest run tests/repoHygiene.test.ts` **22/22 통과**(새 파일 포함, LF·사용자 폴더 경로 0) |

| 검사 | 경고 | 처리 | 이유 |
|---|---|---|---|
| inspect | `button-fx`@768 FAIL | 기존 예외 | ds.css 버튼 그림자(GM3 기록과 같음, 이 시안이 만든 것 아님) |
| inspect | `palette-cream`·`heavy-borders` | 예외 | 확정 토큰 · 접근성 3:1 경계(규칙 9) |
| inspect | `ragged-row` | 예외 | 3열 대시보드의 열 높이 차(DB1 배치, 기존) |
| lint | `em-dash` 12 | 기록 | 한국어 주석의 줄표 |
| app-screens | 연도 표(작은 꼬리표)·창 칸의 12px 글 | 의도 | 12px은 토큰 바닥(`--fs-xs`, 11px 미만 없음), 꼬리표는 그림 위 글자를 읽히게 하는 단 하나의 장치. 창틀·아이콘·그라디언트 0 |

## 5. 예산(기준 덩어리 gzip, `budget.json`)
- 조각 **45**(배경 5 · 집 4 · 소품 14 · 식구 19 · 반려동물 3): 개별 평균 358B(합 16,110) · 덩어리 **6,701B**(조각당 149B, 비율 0.42). 계획 93 → **87**(매체 6 제외): 가중 개별 ≈ 33.6KB → 덩어리 **≈ 14.1KB**(단순 149×87 = 13.0KB, 110조각 16.4KB).
- 시대의 창: 장당 개별 **299B**(FM2b 259B — 칸이 커져 조금 무겁다). 사건 1장/해 + 생활 17장 = 98장 → **12.3KB**(+한 줄 **15.4KB**) · 사건 2장/해 → 179장 **22.5KB**(+**28.2KB**).
- `family` 합계 = 조각 14.1 + 창(2장/해) 28.2 + 표·이름·소품 연도 ≤ 30 = **≤ 72.3KB < 75KB**(1장/해면 ≤ 59.5). 여유가 작아 시대별 하위 덩어리를 권함.

## 6. 산출물
- 시안 `docs/design/mockups/family/`: `dashboard-family.html`(`?scene=a~e&era=stadium|ballot|kite|none&hide=1&stamp=age&label=0&split=2|2.5|3&theme=dark&fold=1&open=1&decision=fold`) · `scenes.html`(장면 다섯 + `#era-samples`) · `pieces.html` · `scenes.json`(`layouts`) · `budget.json`(`era`) · `family.css` · `pieces/s1/*.svg` 48(조각 45 + era 3).
- 캡처 4장 `docs/design/screens/009/`: `fm2c-dash-1280.png`(107KB) · `fm2c-dash-e-1280.png`(165KB) · `fm2c-dash-360.png`(123KB) · `fm2c-dash-dark.png`(154KB).
- 문서: `family-scene.md`(머리·1·2-4·3·5·6·9절) · `family-art.md` 상태 줄 · `design-system.md` 18절 한 줄 · `credits.md` 행 · `README.md` 48차.

## 7. 다음
1. 형진 님·마스터: `family-scene.md` 9절 — ① 연도 표 「1988년」만 / 나이 함께 ② 머리 글자 「시대의 창」 둘지 ③ 배치 2:1·쌓기 승인(집 534 → 351px; 더 크게 원하시면 창을 PC에서도 집 아래 띠로 두는 ⓒ안을 한 장 더) ④ 표본 셋 승인(투표함 문장 교체 포함) ⑤ 생활 장면 규칙·소재 출처 ⑥ 초점 정지점 1 ⑦ 식구 런타임 함수 셈법·예산 87(SPEC FH8 표 수정은 planner) ⑧ 「작은 집」 낱말 ⑨ 요양 시설 집 1종.
2. developer(FM5): `ERA` 데이터·`eraOf`·빈 해 단언·`#log-y<year>` 앵커, 그림 카드 2열 격자 + 컨테이너 쌓기, 연도 표를 `aria-labelledby`에 포함, `tokens.css`에 `--c-scene-*` 24개.
3. reviewer: 정체성·낙인·닮음 판독 — 연도 표·시대의 창 포함(다른 게임의 「우측 상단 TV 모니터」와는 구조만: 글자 없는 그림 칸 + 사실 한 줄).
