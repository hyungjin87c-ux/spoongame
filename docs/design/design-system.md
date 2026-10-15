# 수저 게임 디자인 시스템 (SPEC-003 DS3)

「수저 게임」은 한국에서 한국인으로 태어나 사는 한 번의 인생을 다루고, 태어난 집(수저)이 삶에 얼마나 영향을 주는지 체감하게 하는 게임이다. 디자인은 그 정체성을 첫 화면에서 바로 읽히게 하되, **담담하고 단정하게** 전한다 — 감탄사·과장·자극적인 이미지 없이, 서류와 통계표처럼 정직한 얼굴로.

- 토큰(값의 원본): `src/styles/tokens.css` — 색·간격·모서리·그림자·글자·움직임·크기. 라이트 / 다크(시스템·수동) / 강제 색상 / 움직임 줄이기.
- 컴포넌트 참고 구현: `docs/design/mockups/ds.css` — 시안 HTML이 쓰는 클래스. developer는 이 구조·클래스를 기준으로 `src/`에 옮긴다(토큰만 쓰고 색 값을 직접 적지 않는다).
- 자산: `src/assets/` — 심볼·로고(`symbol-*.svg`, `logo-*.svg`, `brand/`), 아이콘 스프라이트(`icons/ui-icons.svg`, `icons/spoon-grades.svg` — 칩 변형 `sp-1`~`sp-5` + 큰 변형 `sp-1-lg`~`sp-5-lg`), 얼굴 생성 함수(`faces/faceLayers.ts`).
- 점검: `npx vite-node scripts/checkContrast.ts --write` → `docs/design/contrast-report.md`(라이트 77쌍 + 다크 77쌍, 실패 0). `tests/designAssets.test.ts`가 같은 계산과 자산 계약을 단언한다(42건). 상태 4색 색각 시뮬레이션 시트: `npx vite-node scripts/design/previewStatColorsCvd.mjs` → `screens/003/status-colors-cvd.png`.
- 시안: `docs/design/mockups/*.html` → 스크린샷 `docs/design/screens/003/*.png`. 다시 만드는 순서는 `docs/design/README.md`. 문구 기준은 `docs/design/copy.md`.

## 1. 정체성 — 톤·색·로고

### 톤
| 원칙 | 화면에서 |
|---|---|
| 담담함 | 큰 글자는 사실(이름·나이·숫자)에만 쓴다. 느낌표·이모지·감탄 문구 없음. 그림자는 얕고(`--shadow-1`) 움직임은 짧다(`--dur` 200ms) |
| 서류의 정직함 | 출생신고는 문서(띠·큰 이름·격자·「가상의 서류」 표기), 통계는 값·기준 연도·출처를 항상 함께 적는다. 가짜 데이터·설계값은 화면에 그렇게 적는다 |
| 풍자는 구조로 | 색이나 그림으로 조롱하지 않는다. 수저 다섯 자루를 **같은 모양·다른 재질**로 나란히 세우는 것, 선택지 아래 작은 영향 표기, 「다른 집 아이들과 견주면」 표(`copy.md`) 같은 **배치와 대비**가 풍자를 맡는다 |
| 한국의 밥상 | 바탕은 한지색(`--c-bg`), 글자와 심볼은 먹에 가까운 쪽빛(`--c-brand`), 강조는 놋쇠색(`--c-accent`). 숟가락은 한국 숟가락(둥근 머리·긴 자루) |

### 색의 뜻
- **쪽빛 `--c-brand` #26324a**: 로고·주요 버튼·선택 테두리·진행률. 먹색에 가까운 남색이라 특정 정당의 파랑·빨강과 겹치지 않는다. 순수 파랑·빨강은 어디에도 주색으로 쓰지 않는다.
- **놋쇠 `--c-accent` #8a6a14**: 인용 박스 왼쪽 막대, 「나의 기록」 줄, 접수 도장. 「사람이 남긴 것」의 색.
- **수저 5단계 `--c-grade-1~5`**: 재질색(흙·동·은·금·다이아몬드). 항상 **이름 + 점 개수**와 함께 쓴다 — 색만으로 단계를 전하지 않는다. 아이콘은 **무늬 없는 숟가락 실루엣**(칩, ≤ 24px — 강제 색상·단색에서도 채운 실루엣, R-190)이고 32px 이상에서만 닫힌 채움 표식을 둔다. 머리 안에 선 무늬는 어느 크기에도 없다(R-121 마스터 결정, 6절 「수저 칩」). **수저 아이콘은 이름·점 없이 단독으로 쓰지 않는다.**
- **상태 4색 `--c-stat-*`**: 건강(연지, 장밋빛 붉은색)·행복(자주, 자줏빛)·지식(**파랑** — 밝은 하늘빛 파랑. 「쪽빛」은 브랜드 `--c-brand`에만 쓰는 이름이다)·관계(보라). 규칙은 넷이고 모두 `tests/designAssets.test.ts`가 두 테마 각각 단언한다: ① **자리별 금지**(R-172(e) 취지를 REV-003-D-4에서 좁힘) — 건강은 녹(90~170°) 금지, 행복은 황(35~70°) 금지, 네 색의 계열 순서가 참고 캡처의 녹·황·청록·적갈이 아닐 것, 서로 색상 20° 이상(원형 거리). ② **뜻이 다른 토큰 — 수저 5색·▲▼ — 과 ΔE2000 ≥ 15, 상태색끼리 ≥ 12**(R-192), 크롬 색 `--c-link`·`--c-focus`와는 ≥ 10(R-195③ — 링크 글자·포커스 링은 상태 바와 같은 자리에 오지 않고 뜻을 나르지 않으므로 15보다 낮게 둔다). ③ **이웃 쌍 명도 차 ΔL\* ≥ 12**(지식↔관계·행복↔관계, R-195①) — 적록 색각 이상에서는 색상이 무너지므로 명도로 가른다(라이트 L\* 45·53·53·35, 다크 58·53·55·69). ④ **색각 시뮬레이션**(Machado 2009 protan·deutan 심각도 1.0)에서 모든 쌍 ΔE2000 ≥ 8(R-195②, 시트 `screens/003/status-colors-cvd.png`). 바에는 이름·아이콘·숫자를 함께 적는다. 상태 카드 안에 링크 글자(`--c-link`)를 두지 않는다.
- **▲ `--c-up` / ▼ `--c-down`**: 영향 표기. 화살표 개수가 크기, 색은 보조.

### 로고 규칙 (DS1·DS2 — 확정 A안 「담긴 땅」, R-128)
심볼은 두 판이다. **정식 심볼**(머리 안 지도 높이 = 머리 높이의 74%, 섬 3개 포함)은 48px 이상에서, **단순화 심볼**(14점 윤곽, 섬 없음, 굵은 자루)은 40px 이하(헤더·파비콘)에서 쓴다. 기준은 **워드마크 글자 높이**: 첫 화면 ≥ 40px, 화면 헤더 ≥ 22px.

| 자리 | 파일 | 높이 | 워드마크 글자 높이 | 비고 |
|---|---|---|---|---|
| 첫 화면 모바일(< 960px) | `brand/a/logo-stacked.svg` (정식 심볼 위, 워드마크 아래) | 시안 `--logo-h: 236px` | 약 62px (≥ 40) | 가운데 정렬, 아래 한 줄 설명·수저 다섯 자루 |
| 첫 화면 데스크톱 | `logo-a.svg` (정식 심볼 + 워드마크, 가로) | 108px | 약 58px (≥ 40) | 왼쪽 정렬 |
| 그 밖의 모든 화면 헤더(룰렛·출생신고·대시보드·엔딩·밀린 화면·오류 화면) | **`brand/a/logo-header.svg`** (단순화 심볼 + 워드마크 0.64H) | `--logo-h-header` **40px** | 약 23px (≥ 22) | 왼쪽, 오른쪽에 화면 이름 또는 이름·나이 알약. 28px로 줄이지 않는다 |
| 파비콘·터치 아이콘·앱 아이콘 | `brand/a/favicon.svg`(단순화)·`favicon-32.png`, `apple-touch-icon.png`(180, 정식)·`icon-512.png`·`app-icon.svg`(정식) | — | — | 타일 바탕 `--c-logo-tile`, 심볼 `--c-on-logo-tile` |
| 심볼만 | `symbol-a.svg`(정식), `brand/a/symbol-small.svg`(단순화) | 정식 ≥ 48px / 단순화 16~40px | — | 둘레에 심볼 높이의 1/8 이상 여백 |
| 다크 | `brand/a/*-dark.svg` 또는 라이트 파일 그대로 | — | — | 라이트 파일은 `fill: var(--c-logo, #26324A)`를 읽으므로 토큰만 바뀌면 다크에서도 크림색이 된다. 고정 색이 필요할 때만 `-dark` 파일 |
| 단색(강제 색상·인쇄) | `*-mono.svg` | — | — | `currentColor` |

- **금지(R-130)**: 한반도 실루엣을 숟가락 없이 **단독으로 쓰지 않는다**(한반도기 구성과 겹친다 — 항상 수저와 한 묶음). **하늘색·연파랑 계열**(한반도기 색)로 칠하지 않는다. 로고를 기울이거나 늘이거나 색을 바꾸지 않는다(토큰 `--c-logo`만). 분단선·경계·지역 표시를 더하지 않는다.
- 섬: 정식 심볼은 제주·울릉도·독도를 실제 위치에 두고 면적은 **제주 > 울릉도 > 독도**(제주가 울릉도의 2배 이상 — `tests/designAssets.test.ts`가 단언). 특정 섬을 과대 강조하지 않는다. 단순화 심볼은 섬을 그리지 않는다(세 섬 모두 1px 미만이라 얼룩으로만 보임, 영토 표현의 의도 아님).
- 워드마크는 글꼴이 아니라 직접 그린 도형(`scripts/design/brandGeometry.mjs`)이라 어느 기기에서나 같다. 게임명은 글자로도 항상 있어야 한다(`aria-label="수저 게임"`, 탭 제목 「수저 게임」).
- 고르지 않은 B·C안은 `docs/design/archive/brand-bc/`에만 있다. 구현 코드가 참조하지 않는다.

## 2. 색 토큰

전체 값과 대비율은 `contrast-report.md`에 자동 생성된다. 아래는 용도별 요약(라이트 → 다크).

| 토큰 | 라이트 | 다크 | 용도 | 대비 기준 |
|---|---|---|---|---|
| `--c-bg` | #f6f3ec | #14171f | 화면 바탕(한지) | — |
| `--c-surface` | #fffdf8 | #1c212c | 카드·입력란·모달 | — |
| `--c-surface-2` | #efeae0 | #262c3a | 파인 면(보조 버튼·트랙·줄무늬) | — |
| `--c-border` | #d8d1c2 | #323a4b | 장식 구분선 | 요구 없음 |
| `--c-border-strong` | #857d6b | #7a8499 | 컨트롤 경계(입력란·라디오 카드·트랙) | 바탕과 3:1 ↑ |
| `--c-text` / `-2` / `-3` | #23211d / #4f4a41 / #6a6458 | #ece8de / #c4bfb2 / #a29d90 | 본문 / 보조 / 출처·주석 | 모든 면과 4.5:1 ↑ |
| `--c-brand` / `--c-on-brand` | #26324a / #fff | #b3c2e8 / #14171f | 주요 버튼 면 / 그 위 글자 | 4.5:1 ↑ |
| `--c-brand-soft` / `--c-on-brand-soft` | #e4e8f1 / #26324a | #262f47 / #d5def5 | 선택된 카드·인용 박스 | 4.5:1 ↑ |
| `--c-accent` / `--c-accent-soft` / `--c-on-accent-soft` | #8a6a14 / #f3e9cc / #5f4808 | #dcb85c / #3a3118 / #f0dc9c | 놋쇠 강조 / 나의 기록 줄 | 4.5:1 ↑ |
| `--c-focus` | #1d5bd6 | #8ab4ff | 포커스 링 3px | 모든 면과 3:1 ↑ |
| `--c-up` / `--c-down` | #1e6b45 / #a12b2b | #6fcf9a / #f08a8a | ▲ / ▼ | 4.5:1 ↑ |
| `--c-notice-bg` / `--c-on-notice` | #fff3cd / #5c4400 | #3d3410 / #f5e3a3 | 안내 띠 | 4.5:1 ↑ |
| `--c-stat-health/happy/knowledge/relation` | #cb2360 / #d048a9 / #2778ff / #6232b8 (L\* 45·53·53·35) | #ef4d92 / #d243b8 / #3d7ff0 / #bb9ade (L\* 58·53·55·69) | 상태 바 면·아이콘(연지·자주·파랑·보라) | 면·트랙과 3:1 ↑, 수저 5색·▲▼과 ΔE2000 ≥ 15, 서로 ≥ 12, 링크·포커스와 ≥ 10, 지식↔관계·행복↔관계 ΔL\* ≥ 12, protan·deutan 시뮬레이션 모든 쌍 ≥ 8 |
| `--c-meter-track` | #e6e0d3 | #2c3343 | 바 트랙 | — |
| `--c-grade-N` / `-soft` / `-ink` (N=1~5) | 재질색 / 옅은 칩 바탕 / 칩 글자 | 밝은 재질색 / 어두운 칩 바탕 / 밝은 글자 | 수저 칩·아이콘·점 | ink↔soft 4.5:1, solid↔면 3:1 |
| `--c-logo` | #26324a | #e9e4d6 | 로고·심볼 SVG | 바탕과 3:1 ↑ |
| `--c-face-*` | 피부·선·머리·옷·바탕 | 라이트와 같음(얼굴 타일은 두 테마에서 같은 그림) | 얼굴 | 선↔피부 3:1 ↑(가장 흐린 단계 포함) |

- **지식 파랑이 밝고 선명한 까닭(REV-003-D-4 R-195)**: 라이트에서 은수저 #6a7886과 다이아몬드수저 #1b83a8이 L\* 50 언저리의 푸른 회색·청록이고, `--c-link` #1d4fb0·`--c-focus` #1d5bd6이 L\* 36~41의 중간 파랑이라 파랑 계열에서 ②를 모두 만족하는 자리는 **L\* 52~53의 채도 높은 하늘빛 파랑**뿐이다(어두운 쪽은 링크·포커스와, 중간은 은·다이아와 겹친다). 네 색 중 가장 튀는 색이지만 12px 바 한 줄에만 쓰고 이름·아이콘·숫자가 늘 함께 있다. 다크에서는 자리가 넉넉해 #3d7ff0로 한 단 가라앉힌다.
- 측정값(6차, 테스트와 같은 계산): 라이트 — 상태색끼리 최소 ΔE2000 15.5(건강↔행복), 수저·▲▼ 최소 15.3(지식↔다이아), 링크·포커스 최소 11.3(지식↔포커스), ΔL\* 지식↔관계 18.4·행복↔관계 18.2, protan 최소 10.6·deutan 15.3, 트랙 대비 최소 3.06:1. 다크 — 12.2(건강↔행복), 15.4(관계↔은), 16.0(지식↔포커스), ΔL\* 14.2·15.6, protan 11.0·deutan 10.8, 트랙 대비 최소 3.15:1. 5차 값과 견주면 지식↔관계가 라이트 13.1(protan 2.6·deutan 5.0)·다크 19.7(2.7·2.5)에서 위 값으로, 라이트 지식↔링크가 1.4에서 16.9로 벌어졌다.

## 3. 테마 선택 규칙 (DB6·CM4)

1. 기본은 시스템 설정 `prefers-color-scheme`. `tokens.css`의 `@media (prefers-color-scheme: dark) { :root:not([data-theme='light']) … }`.
2. 사용자가 다크 모드 버튼으로 고르면 `<html data-theme="light|dark">`를 쓰고 저장한다. 이 값이 시스템 설정보다 우선한다.
3. 다크 토큰은 두 블록(미디어쿼리 / `data-theme`)에 같은 값으로 적혀 있다 — `checkContrast`와 테스트가 두 블록의 불일치를 0으로 지킨다. **값을 고칠 때 두 곳을 함께 고친다.**
4. 강제 색상(`forced-colors: active`): 토큰이 시스템 색(Canvas·CanvasText·ButtonText·Highlight…)으로 바뀐다. 의미를 지닌 요소(눌린 버튼·선택 카드·바 채움·수저 점·토글)는 `ds.css`의 `@media (forced-colors: active)` 블록처럼 **모양**(이중 테두리·굵기·무늬·채움)으로 구분한다. 얼굴·로고 SVG는 `forced-color-adjust: none`.
5. 움직임 줄이기: `prefers-reduced-motion: reduce` 또는 앱 설정 `<html data-motion="reduce">`이면 `--dur-*`가 0.01ms가 된다. 캐러셀 자동 전환·진행률 애니메이션은 JS가 같은 신호를 읽어 끈다. **룰렛은 회전 화면을 거치지 않고 곧바로 결과 상태**(제목 「태어날 곳이 정해졌습니다」·결과·작은 글·「출생신고 보기」)를 보이고 제목 아래 안내 한 줄(`.motion-note`)을 더한다(R-171, 시안 `roulette-result-mobile-reduced.png`).

## 4. 글꼴·글자

- **글꼴 파일을 번들하지 않는다**: `--font-sans: system-ui, -apple-system, 'Apple SD Gothic Neo', 'Noto Sans KR', 'Malgun Gothic', 'Segoe UI', sans-serif`. 외부 요청 0, 라이선스 의무 0, 용량 0. 기기마다 모양이 조금 다르지만 게임명(워드마크)은 도형이라 같다. 모든 기기에서 같은 본문 글꼴을 원하면 Pretendard(SIL OFL 1.1)를 하위 집합으로 번들하는 안이 있다 — 도입 조건은 `credits.md` 「글꼴 결정 근거」(C15, 마스터 확정 사항).
- 크기 스케일(`--fs-*`): 12 xs(출처·주석, 이보다 작게 쓰지 않는다) / 14 sm(보조·영향 표기) / 16 md(본문) / 18 lg / 22 xl(카드 제목) / 28 2xl(화면 제목) / 36 3xl(나이 숫자) / display `clamp(2.5rem, 9vw, 4rem)`.
- 줄 높이: 본문 1.6(`--lh-body`), 제목 1.25, 카드 1.4. 한국어는 `word-break: keep-all` + `overflow-wrap: anywhere`(띄어쓰기 단위로 줄을 바꾸고, 한 단어가 줄보다 길 때만 끊는다). 숫자는 `font-variant-numeric: tabular-nums`(`.num`).
- 굵기는 400·700 둘뿐. 제목·이름·값은 700, 설명은 400. 글자 간격은 제목만 −0.01em.

## 5. 간격·모서리·그림자·크기

- 간격 4px 기준: `--sp-1` 4 / `-2` 8 / `-3` 12 / `-4` 16 / `-5` 20 / `-6` 24 / `-7` 32 / `-8` 40 / `-9` 48 / `-10` 64. 화면 좌우 여백 `--gutter` 16px(360px 기준).
- 모서리: `--r-sm` 6(태그) / `--r-md` 10(버튼·입력·카드 안 요소) / `--r-lg` 16(카드·시트) / `--r-pill`(칩·바).
- 그림자: `--shadow-1`(카드, 아주 얕음) / `--shadow-2`(문서·시트) / `--shadow-bar`(하단 고정 띠). 다크에서는 그림자 대신 경계선.
- 크기: `--hit` 44px(터치 대상 최소) / `--face-size` 72px(프로필 얼굴 최소, 시안 96px) / `--logo-h-hero` 48 / `--logo-h-header` **40** / `--w-doc` 720(출생신고 문서 폭) / `--w-page` 1200(3열 최대 폭).
- 반응형 기준 폭(px, 미디어쿼리에 숫자로 적는다): 640(2열 선택 카드·모달 가운데 정렬) / 960(첫 화면 2열, 대시보드 3열, 도구 줄 한 줄) / 1200(최대 폭).

## 6. 컴포넌트 규칙 (`ds.css` 클래스 기준)

| 컴포넌트 | 클래스 | 규칙 |
|---|---|---|
| 버튼 | `.btn` `--primary` `--secondary` `--ghost` `--lg` `--sm` `--icon` `--tool` | 최소 44×44, 모서리 `--r-md`, 굵은 글자. 눌림(`aria-pressed="true"`)은 색 반전 + 아래 4px 막대 — 색에만 의존하지 않는다. 비활성은 `aria-disabled` + 0.55 투명도. 아이콘만 있는 버튼은 `aria-label` 필수 |
| 도구 줄 버튼 | `.btn--tool` | 아이콘 위·이름 아래(모바일), 한 줄(≥ 960). 이름 12px, **낱말 단위로 두 줄까지 줄바꿈**(「생각/남기기」「다크/모드」「의견/보내기」) — `white-space: normal; word-break: keep-all` 이고 `.toolbar .btn { nowrap }`보다 뒤에 둔다(R-122). **켜짐 상태(BGM·다크 모드)**: `aria-pressed="true"` + 색 반전 + 아래 막대 + 아이콘 교체(다크 모드: 달 → 해) + 읽기 전용 「켜짐」(R-136②). 점검: 모든 시안에서 요소 단위 넘침 0(`shootMockups`) |
| 진행 줄(모바일 하단 고정) | `.controls__speed` `.controls__more` | 「일시정지/다시 진행」 + 1·2·4·8배 / 「다음 결정으로」「자동 모드」. **320px 이하**에서는 일시정지를 아이콘만(이름은 읽기 전용으로 유지) 44px, 배속 버튼 4개가 남은 폭을 나눈다 |
| 대시보드 헤더 | `.dash-head` `.who` `.year-row` | 첫 줄: 헤더 로고(40px) 왼쪽, 오른쪽에 「이름」 + 「{나이}세」 알약(`--c-brand-soft` 면, 1.5px 쪽빛 테두리, 숫자 22px). 둘째 줄: 「{연도}년」 · 올해 진행률 바 · 「{N}%」. ≥ 960px은 두 줄이 한 줄로 나란히. 큰 나이 숫자 하나가 헤더를 차지하는 배치는 쓰지 않는다(R-123) |
| 카드 | `.card` `.card__title` `.card__head` | 면 `--c-surface`, 1px `--c-border`, `--r-lg`, 안쪽 16px |
| 라디오 카드 | `.radio-card` `.is-selected` | 선택 = 3px 쪽빛 테두리 + 체크 아이콘 + 옅은 면 + `sr-only` 「선택됨」. `role="radiogroup"` 안의 네이티브 라디오를 덮는다 |
| 상태 바 | `.meter--health/happy/knowledge/relation` | `role="meter"` + 이름·아이콘·숫자 병기. 트랙 12px, 1px 경계, 채움은 상태색 |
| 진행률 바 | `.year-progress` | `role="progressbar"`, 쪽빛 채움. 헤더에서 나이 숫자와 함께 |
| 수저 칩 | `.grade.grade--N` (`gradeChip`) | **아이콘(칩 변형 `sp-N` = 무늬 없는 실루엣, 재질 색 채움) + 이름 + 점 5개 중 N개**. 큰 판 `--lg`(20×32, 역시 실루엣). 룰렛 릴 `--reel`. **구간 글자는 `bandLabel(startBandOf(era, wealth))` 출력을 칩 뒤 괄호에**(`.grade-line__range`: 「(하위 25% 안쪽)」, 굵게, 글로 적으면 「흙수저(하위 25% 안쪽)」 — R-170, `copy.md` 3절. 칩과 구간은 `.grade-line` 안에 함께 두어 줄바꿈 시 구간이 칩 시작점에 맞춰 내려간다). **강제 색상·단색에서도 아이콘은 CanvasText(currentColor)로 채운 실루엣이다 — 외곽선이 아니다**(R-190 마스터 결정: 자루 폭이 선 굵기와 같아 외곽선은 ⚲·열쇠로 읽힌다. `.grade svg.spoon { color: CanvasText }`뿐, 외곽선 변수 없음). **수저 아이콘은 이름·점 없이 단독으로 쓰지 않는다** — 단계는 이름 + 점이 전하고 아이콘은 재질 색의 자리일 뿐이다. 쓰는 자리: 룰렛 결과·출생신고·프로필 카드·엔딩 출발선 영역(R-136①) — 대시보드 「자산 현황」에는 두지 않는다. 이벤트 본문·연표에는 등급명 금지(C4) |
| 수저 아이콘 큰 변형 | `sp-N-lg` (`spoon(n, cls, { lg: true })`) | **32px 이상에서만**(첫 화면 띠 32×52, 컴포넌트판 64px). 실루엣 + **닫힌 채움 도형 표식**: 흙 = 테두리 머리 안의 담긴 흙 더미(구멍 = 빈 그릇) / 동 = 표식 없음(무광) / 은 = 테두리를 따르는 가는 광택(짧은 호, **밝은 채움**) / 금 = 작은 하이라이트 점(중심을 비킴, **밝은 채움**) / 다이아몬드 = 마름모 커팅(구멍). 은·금의 광택은 흰빛 채움(`fill="#fff" style="fill:var(--sp-mark,#fff)"` — 속성에는 고정값, 변수는 `style`로만. SVG 프레젠테이션 속성 안의 `var()`는 iOS Safari 등이 무시할 수 있어 표식이 검게 나올 위험이 있다, REV-003-D-4)이지 evenodd 구멍이 아니다 — 구멍이면 다크 테마에서 바탕이 비쳐 「어두운 흠」으로 뒤집혀 보인다(REV-003-D-3 관찰). 강제 색상에서는 `tokens.css`가 `--sp-mark: Canvas`로 두어 두 극성 모두 표식이 남는다. **선(stroke) 무늬는 어느 크기에도 없고**, 원 안의 대각선·가로선·점 배열(⊘·⊜·⊖·⊙)은 쓰지 않는다(R-121 마스터 결정). 실제 크기 확인: `screens/003/spoon-sizes-dpr1.png`(DPR 1, 16·20·24·32·48px × 밝은·다크·강제 색상·단색), 테스트 `tests/designAssets.test.ts` 「R-121」 2건 |
| 수저 다섯 자루 | `.spoon-lineup` (`spoonLineup`) | 첫 화면 전용. 같은 숟가락 5개(큰 변형)를 재질색으로, 이름을 아래에. 위아래 1px 선으로 띠처럼 |
| 영향 표기 | `.impact` (`impact([...])`) | 「자산 ▼▼ · 행복 ▲」 — 변화가 있는 항목만, ▲▼ 1~3개, `sr-only` 문장(「자산이 크게 줄어요」) 병기, 14px |
| 표 | `.table` | 머리글 2px 아래선, 숫자 열 오른쪽 정렬·`nowrap`, 「이 가정」 열만 굵게 |
| 입력란 | `.field` `.field__input` `.field__hint` | 2px 강한 테두리, 안내와 글자 수(`34/140`)를 아래 양끝에. `dir="auto"`, `overflow-wrap: anywhere` |
| 토글 | `.toggle` `.is-on` | 52×30 트랙, 켬은 쪽빛 + 체크 + 「켬/끔」 글자 |
| 캐러셀 조작 줄 | `.carousel__ctrl` `.carousel__count` / `.dots` | 「이전 지표」 · **「{i} / {N}」 번호 표기**(N = `koreaStats.json`의 캐러셀 지표 수, 2026-10-15 기준 14) · 「다음 지표」 · 「자동 넘김 일시정지」. **자동 넘김 간격 7초**(SPEC SC5). 점(`.dots`, 24×44 터치, 현재는 알약 + `aria-current`)은 항목이 5개 이하일 때만(R-133: 10개 이상이면 한 줄에 들어가지 않는다). 값·기준 연도·출처·조회일은 카드 안에 항상 함께(koreaStats.json) |
| 룰렛 하단 바 | `.bottom-bar` | 회전 중 「건너뛰기」(보조) → 결과 「출생신고 보기」(기본), 같은 자리의 고정 바(R-127). **움직임 줄이기면 회전 상태 자체를 건너뛰고 결과 상태 + 「출생신고 보기」로 시작**하며 제목 아래 안내 한 줄 `.motion-note`를 보인다(R-132·R-171) |
| 하단 고정 버튼 | `.bottom-bar` + `.page-end-space` | 고정, safe-area 여백, 본문 끝에 88px 여백을 둬 가리지 않는다. 보조 버튼(「새로 태어나기」)은 아래 작은 테두리 버튼 |
| 헤더(첫 화면 외) | `.site-head` / `.dash-head` | 헤더 로고 40px(`brand/a/logo-header.svg`) + 화면 이름(또는 이름·나이 알약과 연도·진행률 줄). 대시보드 헤더는 `position: sticky` |
| 카드 시트 | `.overlay` `.sheet` (`role="dialog" aria-modal`) | 모바일은 아래에서 올라온 시트(위 모서리만 둥글다), ≥ 640 가운데 모달. 머리에 종류(◆ 중대 결정 / ● 생각 남기기)·나이·「카드 접기 ▾」(`copy.md`) |
| 인용 박스 | `.cite` `.cite__text` `.cite__src` | 옅은 쪽빛 면 + 놋쇠 왼쪽 막대. 요약 ≤ 100자, 출처 한 줄(기관·저자(연도), 자료 이름) |
| 선택지 | `.choice` `.choice__no` | 번호 원 + 굵은 라벨 + 영향 표기. 2px 경계, hover/focus는 옅은 쪽빛 면 |
| 인생 기록 줄 | `.log__row` `--note` `--stage` `--latest` | 나이 열 3.1rem + 문장. 나의 기록은 놋쇠 옅은 면 + 왼쪽 5px 막대 + 연필 아이콘 라벨. 단계 줄은 2px 아래선, 최신 줄 굵게 |
| 얼굴 타일 | `.face` `--lg` | 72px 이상, `--r-md`, 1px 경계, 바탕 `--c-face-bg`. 얼굴 API는 `faces.md` |
| 출생신고 문서 | `.doc` `.doc__band` `.doc__name` `.doc__grid` | 쪽빛 띠 + 「가상의 서류」 표기 + 큰 이름 + 한 줄 서술 + 점선 아래 격자(2열, ≥ 640 3열) + 놋쇠 「접수」 도장 |
| 룰렛 릴 | `.reel` `.reel__window` `.is-spinning` | 두 릴 나란히, 가운데 창(3px 쪽빛 + 창 안쪽 좌우 화살표). 회전 중은 흐림 + 가로 줄무늬. **릴 순서는 확률표 순서 하나**(수저 흙→동→은→금→다이아몬드 순환, 지역 서울→…→제주 순환)라 회전·결과·움직임 줄이기 시안의 칸이 같다(R-171). 아래 작은 확률표 `.odds`(지역 16개 시·도는 < 640px 한 줄에 하나, ≥ 640px 두 칸, 이름 줄바꿈 없음). 시·도 이름은 릴·표 모두 줄임 이름으로 통일(`copy.md` 3절). 결과 부제는 「{수저}({구간}) · {시·도}」 |

## 7. 움직임

- 전환 토큰 `--dur-fast` 120ms / `--dur` 200ms / `--dur-slow` 400ms, `--ease: cubic-bezier(0.2, 0, 0, 1)`. CSS 전환은 이 토큰만 쓴다.
- 허용되는 연출: 룰렛(가속→회전→감속, 4~6초, 건너뛰기), 진행률 바 채움, 캐러셀 전환(자동 넘김 7초). 그 밖의 장식 애니메이션은 두지 않는다.
- 움직임 줄이기: 3절 5번(룰렛은 결과 상태로 바로). 인생 기록의 `scroll-behavior: smooth`도 끈다.

## 8. 강제 색상(고대비) 모드

`docs/design/screens/003/title-a-mobile-forced.png`, `dashboard-adult-desktop-forced.png`, `spoon-sizes-dpr1.png`(강제 색상 줄)가 기준. 규칙: 바탕·글자색은 시스템에 맡기고, 의미는 모양으로 — 주요 버튼 3px 테두리, 눌림은 `Highlight` + 이중 테두리, 선택 카드 이중 테두리 + 체크, 바 채움 `CanvasText`, 수저 단계는 **이름 + 점**(칩 아이콘도 `CanvasText`로 **채운 실루엣** — 외곽선 아님, R-190. 첫 화면 띠의 큰 변형은 `CanvasText` 채움 + 닫힌 표식: 흙·다이아의 구멍에는 `Canvas`가 비치고, 은·금의 밝은 표식은 `tokens.css`의 강제 색상 블록이 `--sp-mark: Canvas`로 두어 **두 극성 모두 바탕색 표식으로 남는다** — 검은 글자 고대비에서는 검은 몸체 위 흰 표식, 흰 글자 고대비에서는 흰 몸체 위 검은 표식(`title-a-mobile-forced-band.png`·`title-a-mobile-forced-dark-band.png`, REV-003-D-4 관찰 (a)). 단계는 이름이 전한다), 토글은 `Highlight`. 로고·얼굴은 그림이므로 `forced-color-adjust: none`.

## 9. 사용 예

```html
<!-- 주요 버튼 -->
<button class="btn btn--primary btn--lg" type="button">태어나기</button>

<!-- 수저 칩: 색 + 아이콘(칩 변형 sp-1, 실루엣) + 이름 + 점 (+ 구간 글자 = bandLabel(startBandOf(era, wealth))). 아이콘만 떼어 단독으로 쓰지 않는다 -->
<span class="grade-line">
  <span class="grade grade--1"><svg class="spoon" aria-hidden="true"><use href="/icons/spoon-grades.svg#sp-1"/></svg><span>흙수저</span>
    <span class="grade__dots" role="img" aria-label="5단계 중 1단계"><i class="on"></i><i></i><i></i><i></i><i></i></span></span>
  <span class="grade-line__range">(하위 25% 안쪽)</span>
</span>
<!-- 첫 화면 띠(32×52 이상)만 큰 변형 -->
<li class="spoon-fig grade--1"><svg class="spoon spoon--lg" aria-hidden="true"><use href="/icons/spoon-grades.svg#sp-1-lg"/></svg><span class="spoon-fig__name">흙수저</span></li>

<!-- 상태 바 -->
<div class="meter meter--health"><span class="meter__label">건강</span>
  <div class="meter__track" role="meter" aria-label="건강" aria-valuemin="0" aria-valuemax="100" aria-valuenow="74"><div class="meter__fill" style="width:74%"></div></div>
  <span class="meter__value">74</span></div>

<!-- 영향 표기 -->
<span class="impact"><span class="impact__item"><span>자산</span><span class="down" aria-hidden="true">▼▼</span><span class="sr-only">자산이 크게 줄어요</span></span></span>
```

```ts
// 로고 (Vite): 같은 출처라 외부 요청이 아니다
import logoUrl from '../assets/logo-a.svg?url'; // 형진 님이 고른 안으로
<img src={logoUrl} alt="수저 게임" style={{ height: 'var(--logo-h-header)' }} />
// 또는 인라인 <svg>로 넣으면 fill: var(--c-logo)가 테마를 따라간다(시안 방식).

// 얼굴
import { ageGroupOf, faceNodes, looksTierOf } from '../assets/faces/faceLayers';
const nodes = faceNodes({ ageGroup: ageGroupOf(age), gender, tier: looksTierOf(looks) });
```

## 10. 구현할 때 (developer)

1. 색·간격·글자 크기는 **토큰만** 쓴다. `ds.css`를 `src/styles/`로 옮길 때 클래스 이름과 구조를 유지하면 시안과 1:1로 대조할 수 있다. 문구는 `docs/design/copy.md`에서 가져온다.
2. 다크 토큰을 고치면 `tokens.css`의 두 블록을 함께 고치고 `npx vite-node scripts/checkContrast.ts --write`로 실패 0을 확인한다(테스트도 같은 계산을 한다). 상태 4색을 고치면 §1 「상태 4색」의 네 규칙(자리별 금지·ΔE2000·ΔL\*·색각 시뮬레이션)을 `tests/designAssets.test.ts`로 함께 확인하고, 시트는 `npx vite-node scripts/design/previewStatColorsCvd.mjs`로 다시 만든다. SVG 자산에서 CSS 변수는 프레젠테이션 속성이 아니라 `style`에 쓴다(테스트가 막는다).
3. 로고: 헤더는 **`brand/a/logo-header.svg` 40px**(`--logo-h-header`), 첫 화면은 `brand/a/logo-stacked.svg`(모바일, 236px) / `logo-a.svg`(데스크톱, 108px). 크기 단언(DS1 e2e)은 **워드마크 글자 높이** 기준: 첫 화면 ≥ 40px, 헤더 ≥ 22px. 글자 높이 = 워드마크 칸 높이 × 0.9 (스택 로고: 로고 높이 × 72/248 × 0.9, 헤더 로고: 로고 높이 × 0.64 × 0.9).
4. 수저 등급은 어디서나 `gradeChip` 구조(아이콘+이름+점)를 쓰고, 색만 바꿔 등급을 전하지 않는다. **구간 글자는 `bandLabel(startBandOf(era, wealth))` 한 함수의 출력만**(형식 「흙수저(하위 25% 안쪽)」, `copy.md` 3절 — `standingLabel`은 외모·체중·엔딩 도착 자리 전용). 등급명 허용 자리: 룰렛 결과·출생신고·프로필·엔딩 출발선 영역(대시보드 「자산 현황」에는 칩을 두지 않는다). 이벤트 본문·연표에는 쓰지 않는다(C4). 엔딩 출발선 막대의 `aria-label`도 손으로 적지 않고 같은 함수의 조합으로 만든다: 「출발선 {bandLabel(start)}, 마지막 {standingLabel(end)}. {MOVEMENT_TEXT[movement]}」(R-191(d)). 엔딩 문장·연표 사망 줄은 `endingText.ts`·`lifeText.ts` 출력 그대로이며 어체는 M7e를 따른다.
5. 얼굴은 `faceNodes`를 React 노드로 옮긴다(`dangerouslySetInnerHTML` 금지). 72px 이상, `aria-label` 또는 `aria-hidden`. 외모는 점수 대신 「상위/하위 약 N%」만 글자로 적는다(R-135①).
6. 움직임은 `matchMedia('(prefers-reduced-motion: reduce)')`와 `data-motion`을 함께 읽어 캐러셀(7초 자동 넘김)·진행률을 끈다. **룰렛은 움직임 줄이기면 회전 상태를 만들지 않고 결과 상태로 시작**하며 제목 아래 `.motion-note` 한 줄을 보인다(R-171). 릴 순서는 확률표 순서로 고정.
7. 도구 줄 토글(BGM·다크 모드)은 켜짐을 `aria-pressed="true"` + 아이콘 교체 + 읽기 전용 「켜짐」으로 표시한다. 다크 모드 아이콘: 꺼짐 달(`#i-moon`), 켜짐 해(`#i-sun`).
8. 지금 세상의 지역은 2026년 현행 **16개 시·도**(전남광주통합특별시 포함, 광주·전남 출생 통계 합산). 룰렛 릴·확률표는 줄임 이름, 서류·프로필은 정식 이름 + 시군구.
9. 가로·요소 넘침 점검은 `scripts/design/shootMockups.mjs`의 `overflowReport()`와 같은 규칙(문서 scrollWidth, 요소 scrollWidth > clientWidth, 경계 상자 화면 밖)을 e2e에 옮겨 360·320px에서 0건을 단언한다.
10. 구현 화면이 시안과 다르면 designer가 `docs/design/diff-<SPEC>.md`에 차이와 사유를 적는다(완료 기준 「디자인」).
11. 수저 아이콘 스프라이트 `icons/spoon-grades.svg`: 칩·릴·서류·프로필·엔딩 칩은 **`#sp-N`**(실루엣), 첫 화면 다섯 자루 띠(32×52)만 **`#sp-N-lg`**. 강제 색상에서 칩 아이콘은 `.grade svg.spoon { color: CanvasText }`만 — **외곽선으로 바꾸지 않는다**(R-190, 스프라이트에 stroke·외곽선 변수가 없어 바꿀 길도 없다). 은·금 큰 변형의 밝은 표식은 `--sp-mark`(기본 흰빛)로 바꿀 수 있으나 평상시 테마에서는 바탕색으로 두지 않는다(구멍처럼 보인다) — 강제 색상에서만 `tokens.css`가 `Canvas`로 둔다(두 극성 모두 표식 유지, 앱은 `main.tsx`가 `tokens.css`를 읽으므로 따로 할 일 없음). 스프라이트의 표식은 `fill="#fff" style="fill:var(--sp-mark,#fff)"` 이중 지정이라 변수를 못 읽는 엔진에서도 흰빛이다. 머리 안에 선 무늬를 더하지 않고, **아이콘을 이름·점 없이 단독으로 쓰지 않는다**. 테스트가 막는 것(`tests/designAssets.test.ts`): 선 무늬·stroke·외곽선 변수(「R-121·R-190」·「R-121: 큰 변형」), SVG 프레젠테이션 속성 안의 `var()`(「REV-003-D-4」), 그리고 **화면 시안 열두 장의 단독 사용 0**(「R-190: 화면 시안의 수저 아이콘은 모두 칩·띠 안」 — 모든 `<svg class="spoon">`이 `.grade`/`.spoon-fig` 안에 있고 바로 뒤에 같은 단계의 이름이 따르는지 본다). 구현 화면의 단독 사용은 developer의 컴포넌트 테스트 몫이다.
