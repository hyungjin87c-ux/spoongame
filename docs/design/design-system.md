# 수저 게임 디자인 시스템 (SPEC-003 DS3)

「수저 게임」은 한국에서 한국인으로 태어나 사는 한 번의 인생을 다루고, 태어난 집(수저)이 삶에 얼마나 영향을 주는지 체감하게 하는 게임이다. 디자인은 그 정체성을 첫 화면에서 바로 읽히게 하되, **담담하고 단정하게** 전한다 — 감탄사·과장·자극적인 이미지 없이, 서류와 통계표처럼 정직한 얼굴로.

- 토큰(값의 원본): `src/styles/tokens.css` — 색·간격·모서리·그림자·글자·움직임·크기. 라이트 / 다크(시스템·수동) / 강제 색상 / 움직임 줄이기.
- 컴포넌트 참고 구현: `docs/design/mockups/ds.css` — 시안 HTML이 쓰는 클래스. developer는 이 구조·클래스를 기준으로 `src/`에 옮긴다(토큰만 쓰고 색 값을 직접 적지 않는다).
- 자산: `src/assets/` — 심볼·로고(`symbol-*.svg`, `logo-*.svg`, `brand/`), 아이콘 스프라이트(`icons/ui-icons.svg`, `icons/spoon-grades.svg` — 칩 변형 `sp-1`~`sp-5` + 큰 변형 `sp-1-lg`~`sp-5-lg`), 얼굴 생성 함수(`faces/faceLayers.ts`).
- 점검: `npx vite-node scripts/checkContrast.ts --write` → `docs/design/contrast-report.md`(라이트 81쌍 + 다크 81쌍 — 토큰 쌍 77 + `src/styles/doc.css`가 불투명도로 합성하는 장식 도장 글자·테두리 3쌍·띠 표기 1쌍(QM3-5: 장식도 면제 없음), 실패 0). `tests/designAssets.test.ts`가 같은 계산과 자산 계약을 단언한다(43건). 상태 4색 색각 시뮬레이션 시트: `npx vite-node scripts/design/previewStatColorsCvd.mjs` → `screens/003/status-colors-cvd.png`.
- 시안: `docs/design/mockups/*.html` → 스크린샷 `docs/design/screens/003/*.png`. 다시 만드는 순서는 `docs/design/README.md`. 문구 기준은 `docs/design/copy.md`. 첫 화면 시안은 M2 구현(`src/screens/TitleScreen.tsx`·`src/styles/title.css`)과 같은 구조·같은 모델이다(2026-10-16, M3 착수 정리): 캐러셀 14장 전부를 품고 `?slide=<id>`로 보이는 슬라이드를, `title-continue.html?state=confirm`으로 확인 단계를 보인다.
- **M3·M4 화면 설계자가 먼저 읽을 것**: 11절 「공통 패턴」 — 고정 요소 높이 변수(`--bar-h`)와 `scroll-padding`(CM10), 띠 고정 해제(QM2-12), 글자 200% 리플로(CM11), 구분 기호 사슬·짧은 쌍(QM2-10), 강제 색상의 상태 색(+ 시스템 색 배경의 백플레이트), 컨테이너 쿼리, **11-7 서류 격자·칩·비교 표·FitPair(M3에서 확정)**. 룰렛·출생신고 시안은 M3 구현과 같은 모델(`core/roulette.ts#buildRoulette`·`core/birthReport.ts#birthSentence`·`core/peers.ts#peersOf`·`data/birthCompare.ts` …)이고(2026-10-16, R-270), 남은 차이·명세 차이는 `docs/design/diff-003.md`.

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
4. 강제 색상(`forced-colors: active`): 토큰이 시스템 색(Canvas·CanvasText·ButtonText·Highlight…)으로 바뀐다. 의미를 지닌 요소(눌린 버튼·선택 카드·바 채움·수저 점·토글)는 `ds.css`의 `@media (forced-colors: active)` 블록처럼 **모양**(이중 테두리·굵기·무늬·채움)으로 구분한다. 얼굴·로고 SVG는 `forced-color-adjust: none`. 상태(hover·active·focus) 색은 11-5절.
   - **R-251 대비 설계 메모(M4 착수 때 `tokens.css`를 고친다 — 지금은 문서만, REV-003-M2-5)**: 강제 색상 블록의 선택자 `:root`는 특이도 (0,1,0)이라 다크 두 블록 `:root:not([data-theme='light'])`·`:root[data-theme='dark']`(둘 다 (0,2,0))에 **진다**. 그래서 OS 다크 + 강제 색상에서는 시스템 색 매핑이 다크 팔레트에 덮인다 — 지금 첫 화면은 OS 다크 고대비가 어두운 Canvas라 보이는 결함이 없지만, M4의 수동 다크(`data-theme='dark'`)를 **밝은** 고대비 테마 위에서 켜면 `forced-color-adjust: none` 요소(로고 `--c-logo`, 선택 카드 `__meta`·`__desc`, 포커스 링 `--c-focus`, 띠 표식 `--sp-mark`)가 밝은 Canvas 위에 어두운 팔레트 값으로 그려져 사라진다. **고치는 방법**: 강제 색상 블록의 선택자를 `:root, :root:not([data-theme='light']), :root[data-theme='dark']`로 — 셋을 한 규칙에 적으면 다크·수동 다크에서 특이도 (0,2,0)으로 맞고 소스 순서가 뒤라 이기며, 수동 라이트에서는 `:root`(0,1,0)만 맞지만 그때는 다크 블록도 맞지 않아 기본 블록을 순서로 이긴다. `!important`는 쓰지 않는다(토큰을 덮어쓰는 다른 길까지 막는다). 블록 안의 값(`--sp-mark: Canvas` 포함)은 그대로. 점검: `checkContrast`의 다크 두 블록 일치 검사는 그대로 두고, e2e 한 건을 더한다 — `colorScheme: 'light'` + 강제 색상 + `<html data-theme='dark'>`에서 로고·선택 카드 글자·포커스 링의 바탕 대비 ≥ 3:1(REV-003-M2-5 기대 동작). `title.css`가 요소마다 시스템 색을 직접 적어 둔 것(주 버튼·선택 카드·점)은 이 수정 뒤에도 그대로 둔다(토큰에 기대지 않는 이중 안전).
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
| 라디오 카드 | `.radio-card` `.is-selected` `.is-disabled` | 선택 = 3px 쪽빛 테두리 + 체크 아이콘 + 옅은 면 + `sr-only` 「선택됨」. `role="radiogroup"` 안의 네이티브 라디오를 덮는다. **고를 수 없는 카드**(「약 1시간」 — 준비 중, M8 전): 라디오 그룹 안에 그대로 두고 `disabled` + 점선 테두리 + 옅은 글자(`--c-text-3`) + 오른쪽 작은 알약 「준비 중」(`copy.md`) — 색에만 의존하지 않고, 표식 글자가 카드의 접근 가능한 이름에 든다(R-202). 강제 색상은 `GrayText` |
| 상태 바 | `.meter--health/happy/knowledge/relation` | `role="meter"` + 이름·아이콘·숫자 병기. 트랙 12px, 1px 경계, 채움은 상태색 |
| 진행률 바 | `.year-progress` | `role="progressbar"`, 쪽빛 채움. 헤더에서 나이 숫자와 함께 |
| 수저 칩 | `.grade.grade--N` (`gradeChip`) | **아이콘(칩 변형 `sp-N` = 무늬 없는 실루엣, 재질 색 채움) + 이름 + 점 5개 중 N개**. 큰 판 `--lg`(20×32, 역시 실루엣). 룰렛 릴 `--reel`. **구간 글자는 `bandLabel(startBandOf(era, wealth))` 출력을 칩 뒤 괄호에**(`.grade-line__range`: 「(하위 25% 안쪽)」, 굵게, 글로 적으면 「흙수저(하위 25% 안쪽)」 — R-170, `copy.md` 3절. 칩과 구간은 `.grade-line` 안에 함께 두어 줄바꿈 시 구간이 칩 시작점에 맞춰 내려간다). **강제 색상·단색에서도 아이콘은 CanvasText(currentColor)로 채운 실루엣이다 — 외곽선이 아니다**(R-190 마스터 결정: 자루 폭이 선 굵기와 같아 외곽선은 ⚲·열쇠로 읽힌다. `.grade svg.spoon { color: CanvasText }`뿐, 외곽선 변수 없음). **수저 아이콘은 이름·점 없이 단독으로 쓰지 않는다** — 단계는 이름 + 점이 전하고 아이콘은 재질 색의 자리일 뿐이다. 쓰는 자리: 룰렛 결과·출생신고·프로필 카드·엔딩 출발선 영역(R-136①) — 대시보드 「자산 현황」에는 두지 않는다. 이벤트 본문·연표에는 등급명 금지(C4). **칩이 칸보다 넓어질 때**(글자 150%+·폭 320의 「다이아몬드수저 ●●●●●」, M3 R-262 표본): 알약 안에서 점이 다음 줄로 내려가고 이름은 「다이아몬드<wbr>수저」 낱말 단위로만 끊긴다(`.grade:not(.grade--reel) { flex-wrap }`, 이름 `min-width: min-content; overflow-wrap: normal`, 11-7절) — 칩이 칸 밖으로 넘치지 않는다. 또래 목록에서는 이름 묶음이 14rem을 못 받으면 칩이 이름 아래 줄로(R-269) |
| 수저 아이콘 큰 변형 | `sp-N-lg` (`spoon(n, cls, { lg: true })`) | **32px 이상에서만**(첫 화면 띠 32×52, 컴포넌트판 64px). 실루엣 + **닫힌 채움 도형 표식**: 흙 = 테두리 머리 안의 담긴 흙 더미(구멍 = 빈 그릇) / 동 = 표식 없음(무광) / 은 = 테두리를 따르는 가는 광택(짧은 호, **밝은 채움**) / 금 = 작은 하이라이트 점(중심을 비킴, **밝은 채움**) / 다이아몬드 = 마름모 커팅(구멍). 은·금의 광택은 흰빛 채움(`fill="#fff" style="fill:var(--sp-mark,#fff)"` — 속성에는 고정값, 변수는 `style`로만. SVG 프레젠테이션 속성 안의 `var()`는 iOS Safari 등이 무시할 수 있어 표식이 검게 나올 위험이 있다, REV-003-D-4)이지 evenodd 구멍이 아니다 — 구멍이면 다크 테마에서 바탕이 비쳐 「어두운 흠」으로 뒤집혀 보인다(REV-003-D-3 관찰). 강제 색상에서는 `tokens.css`가 `--sp-mark: Canvas`로 두어 두 극성 모두 표식이 남는다. **선(stroke) 무늬는 어느 크기에도 없고**, 원 안의 대각선·가로선·점 배열(⊘·⊜·⊖·⊙)은 쓰지 않는다(R-121 마스터 결정). 실제 크기 확인: `screens/003/spoon-sizes-dpr1.png`(DPR 1, 16·20·24·32·48px × 밝은·다크·강제 색상·단색), 테스트 `tests/designAssets.test.ts` 「R-121」 2건 |
| 수저 다섯 자루 | `.spoon-lineup` (`spoonLineup`) | 첫 화면 전용. 같은 숟가락 5개(큰 변형)를 재질색으로, 이름을 아래에. 위아래 1px 선으로 띠처럼 |
| 영향 표기 | `.impact` (`impact([...])`) | 「자산 ▼▼ · 행복 ▲」 — 변화가 있는 항목만, ▲▼ 1~3개, `sr-only` 문장(「자산이 크게 줄어요」) 병기, 14px |
| 표 | `.table` `.table--cmp` `.cmp__source` `.cmp__note` | 머리글 2px 아래선, 숫자 열 오른쪽 정렬(≥ 640px만 `nowrap`), 「이 가정 형편」 열만 굵게. **비교 표**(출생신고 BR5, M3): 열 「항목 / 전체 평균 / 이 가정 형편」, 항목 아래 출처 줄(`.cmp__source` — 「기관, 조사 이름 (기준 연도)」 쉼표 나열), 값 아래 어떤 집단의 값인지(`.cmp__note`), 출처 확인 행만·모든 단계 같은 행 구성. **카드(`.card--cmp`, 컨테이너 `cmp`) 내용 폭 35rem 미만이면 한 행이 한 덩어리**(머리글은 읽기 전용으로 숨기고 칸마다 `data-label`로 다시 적는다, `role`로 표 의미 유지 — 글자 100%는 뷰포트 약 592px 아래, 글자 125%+는 데스크톱에서도, QM3-1). 표 아래 안내(합쇼체, QM3-4) + 이 가정을 겨냥하지 않는 지표는 **한 줄 서술**(11-7절). 시안 `birth-bottom-desktop.png`·`birth-compare-mobile.png`·`birth-compare-desktop-text150.png` |
| 입력란 | `.field` `.field__input` `.field__hint` | 2px 강한 테두리, 안내와 글자 수(`34/140`)를 아래 양끝에. `dir="auto"`, `overflow-wrap: anywhere` |
| 토글 | `.toggle` `.is-on` | 52×30 트랙, 켬은 쪽빛 + 체크 + 「켬/끔」 글자 |
| 캐러셀 카드 머리·조작 줄 | `.carousel__head` `.carousel__heading` `.carousel__note` `.carousel__ctrl` `.carousel__status` `.carousel__pause` / `.dots` | **조작 줄은 카드 머리**(R-200): 왼쪽 제목 「한국 사회 통계」 + 작은 글 「7초마다 다음 지표」(멈추면 「자동 넘김 멈춤」), 오른쪽 「이전 지표」 · **「{i} / {N}」 번호 표기**(N = `koreaStats.json`의 캐러셀 지표 수, 2026-10-15 기준 14) · 「다음 지표」 · 「자동 넘김 일시정지」(멈춘 뒤 「자동 넘김 다시 시작」, 오른쪽 끝). 슬라이드 높이가 달라도 같은 자리이고 하단 띠에 가려지지 않는다. 좁으면 조작 줄이 아래로 내려와 가로 전체를 쓴다. **자동 넘김 간격 7초**(SPEC SC5). 점(`.dots`, 24×44 터치, 현재는 알약 + `aria-current`)은 항목이 5개 이하일 때만(R-133). 값·기준 연도·출처·조회일은 카드 안에 항상 함께(koreaStats.json) |
| 캐러셀 슬라이드 | `.slides` `.slide` `.is-active` `.slide__value` `.slide__unit` `.slide__basis` `.slide__side` `.slide__meta` `.legend` | 14장을 모두 `.slides`에 두고 보이는 하나만 `.is-active`. **좁은 화면**: 같은 칸에 겹쳐 카드 높이 = 가장 큰 슬라이드(전환 때 아래 내용이 흔들리지 않는다, 빈 칸은 카드 끝에). **넓은 화면(≥ 960)**: 카드 높이 = 보이는 슬라이드만큼(오른쪽 열이라 아래 내용이 없다), 안 보이는 슬라이드는 absolute. 줄 순서: 제목 → (캡션) → **값 줄**(큰 숫자 + 단위 낱말 하나 — 「27.8<small>명</small>」, 분모 문구 금지) → (**보조 값 줄** — 제목에 이름이 든 보조 계열: 「조혼인율 인구 1천 명당 4.7건」, 선 무늬 없이 글자만, QM2-11) → **기준 줄**(「2025년 기준」 / B형 「인구 10만 명당 · 2025년 기준」 — 짧은 쌍 `Pair`, 11-4절) → 그래프(값 글자 13px, 바탕색 테두리) → 범례(둘 이상일 때) → 정의 → (상담전화 안내 `.slide__help`) → 출처 줄 → 「통계 기준: 2025년 · 마지막 갱신 2026-10-15」(짧은 쌍). 큰 숫자는 칸 폭에 맞춰 글자 크기를 줄인다(`--value-em`·`--unit-chars`, 11-3절). 형식표 A~D는 SPEC QM2-4, 문구는 `copy.md` |
| 룰렛 하단 바 | `.bottom-bar` | 회전 중 「건너뛰기」(보조) → 결과 「출생신고 보기」(기본), 같은 자리의 고정 바(R-127). **움직임 줄이기면 회전 상태 자체를 건너뛰고 결과 상태 + 「출생신고 보기」로 시작**하며 제목 아래 안내 한 줄 `.motion-note`를 보인다(R-132·R-171) |
| 하단 고정 띠 | `.bottom-bar` `.bottom-bar__ask` `.bottom-bar__stack` + `.page-end-space` | 고정, safe-area 여백. **높이는 상태·글자 크기마다 다르므로**(새 판 68 · 이어하기 120 · 확인 단계 약 150 · 글자 200% 확인 단계 254px) 실제 높이를 `--bar-h`로 알리고 본문 끝 여백·`scroll-padding`이 그 값을 따른다(88px 같은 고정값 금지 — 11-1절). 띠 위끝 선은 그림자(`--shadow-bar`), 강제 색상은 `border-top: 1px solid CanvasText`(고정·해제 공통). 보조 버튼(「새로 태어나기」)은 기본 버튼 아래 작은 테두리 버튼. **확인 단계**(R-204·QM2-6): 안내문 「이전 판이 사라집니다. 새로 태어날까요?」 → 「이전 판 지우고 태어나기」(보조) → **맨 아래 「돌아가기」(기본·큰 버튼, 먼저 포커스)** — 방금 누른 「새로 태어나기」 자리에 안전한 쪽이 온다. 낮은 화면에서 띠가 절반을 넘으면 고정 해제(11-2절). 시안 `title-confirm-mobile.png`·`-low.png` |
| 헤더(첫 화면 외) | `.site-head` / `.dash-head` | 헤더 로고 40px(`brand/a/logo-header.svg`) + 화면 이름(또는 이름·나이 알약과 연도·진행률 줄). 대시보드 헤더는 `position: sticky` — 고정 요소이므로 높이를 `--head-h`로 알리고 `scroll-padding-top`에 더한다(11-1절, M4) |
| 카드 시트 | `.overlay` `.sheet` (`role="dialog" aria-modal`) | 모바일은 아래에서 올라온 시트(위 모서리만 둥글다), ≥ 640 가운데 모달. 머리에 종류(◆ 중대 결정 / ● 생각 남기기)·나이·「카드 접기 ▾」(`copy.md`) |
| 인용 박스 | `.cite` `.cite__text` `.cite__src` | 옅은 쪽빛 면 + 놋쇠 왼쪽 막대. 요약 ≤ 100자, 출처 한 줄(기관·저자(연도), 자료 이름) |
| 선택지 | `.choice` `.choice__no` | 번호 원 + 굵은 라벨 + 영향 표기. 2px 경계, hover/focus는 옅은 쪽빛 면 |
| 인생 기록 줄 | `.log__row` `--note` `--stage` `--latest` | 나이 열 3.1rem + 문장. 나의 기록은 놋쇠 옅은 면 + 왼쪽 5px 막대 + 연필 아이콘 라벨. 단계 줄은 2px 아래선, 최신 줄 굵게 |
| 얼굴 타일 | `.face` `--lg` | 72px 이상, `--r-md`, 1px 경계, 바탕 `--c-face-bg`. 얼굴 API는 `faces.md` |
| 출생신고 문서 | `.doc` `.doc__band` `.doc__tag` `.doc__body` `.stamp` `.doc__name` `.doc__sentence` `.doc__grid` `.span-2` `.wide` `.cell-sub` `.people` `.people__who` `.doc-notes` | 쪽빛 띠(제목 「출생 신고」 + 오른쪽 표기 「수저 게임 · 가상의 서류」 FitPair — `flex-wrap`이라 좁거나 글자가 크면 표기가 제목 아래 줄로) + 놋쇠 「접수」 도장(**본문 `.doc__body` 위쪽 모서리 기준**, 64px 장식 — 띠가 커져도 띠 글자를 가리지 않는다. **불투명도 없음**: 장식이라도 눈에 보이는 글자·도형은 DS3 전수 대비(글자 4.5:1·테두리 3:1) 대상이고 0.85를 걸면 라이트 3.72:1이었다, QM3-5) + 「이름」·큰 이름 + 한 줄 서술(끝 괄호 `.keep-phrase`) + 점선 아래 격자(**본문이 컨테이너 `docbody`** — 기본 2열, 칸이 11.5rem 미만이면 1열, ≥ 640px이고 본문 17.75rem 이상이면 3열; **「태어난 곳」은 `.span-2`** — 2열·1열에서 한 줄 전체·3열에서 3분의 2, 집안 형편·교육방식은 `.wide`; 보조 글자 `.cell-sub`) + 또래 목록 `.people`(이름 옆 「여성/남성」, 장소 다음 줄, 칩은 `.people__who` 14rem 아래로; 안내는 첫 문장 하나 — QM3-3) + 비교 카드(지금 세상만, `.card--cmp`) + 하단 표기 `.doc-notes` 4~5줄. **강제 색상: 띠는 `background: Canvas; color: CanvasText` + 3px 아래선**(11-5절 — 토큰 `--c-brand`가 시스템 색이라 그냥 두면 글자가 사라진다. 구현도 r4 R-291로 같은 규칙, `diff-003.md` D-07 닫힘). 시안 `birth-top-mobile.png`·`birth-top-desktop.png`·`birth-top-320-text200.png`·`birth-grid-320-text200.png`(1열)·`birth-past-mobile-full.png`·`birth-future-mobile-full.png` |
| 룰렛 릴 | `.reels` `.reel` `.reel__window` `.reel__item.is-result` `.is-spinning` `.is-fast` `.grade--reel` `.odds` `.roulette__after` | 두 릴 나란히(열 최소 폭 8.5rem `auto-fit` — 글자를 키우면 한 열씩 쌓인다), 칸 높이 `--reel-item-h: 3.5rem`(5칸 + 가운데 창 3px 쪽빛 + 창 안쪽 좌우 화살표). **빠르게 도는 동안만**(`.is-fast`, 속도로 켠다) 흐림 + 가로 줄무늬. **수저 릴은 왕복 순서**(흙 동 은 금 다이아몬드 금 은 동, `core/roulette.ts#WEALTH_REEL_ORDER` — R-274 마스터 결정: 이웃 칸이 늘 한 단계 차이라 정지 직전에 지나는 칸과 멈춘 창의 위아래가 이웃 단계. 흙수저 결과 「은 · 동 · [흙] · 동 · 은」), 지역 릴은 확률표 순서(서울→…→제주)의 순환 — 회전·결과·움직임 줄이기의 칸 순서가 같다(R-171). 릴 칸은 아이콘 + 이름(점 없음, `.grade--reel`). 아래 작은 확률표 `.odds`(수저 정수 %·지역 소수 1자리, 지역 16개 시·도는 < 640px 한 줄에 하나·≥ 640px 두 칸, 이름 줄바꿈 없음), 결과 뒤 고지 `.roulette__after`는 회전 중 `visibility: hidden`으로 자리만 지킨다. 시·도 이름은 릴·표 모두 줄임 이름으로 통일(`copy.md` 3절). 결과 부제는 「{수저}({구간}) · {시·도}」(FitPair). **제목(h1)은 `.roulette__lead`(컨테이너) 폭 ÷ `--title-chars`의 글자 크기 상한**(바닥 `--fs-lg`, QM3-2 — 11-8절). 시안 `roulette-spin-mobile.png`·`roulette-result-mobile.png`·`roulette-result-320.png`·`roulette-result-320-text200.png` |

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
6. 움직임은 `matchMedia('(prefers-reduced-motion: reduce)')`와 `data-motion`을 함께 읽어 캐러셀(7초 자동 넘김)·진행률을 끈다. **룰렛은 움직임 줄이기면 회전 상태를 만들지 않고 결과 상태로 시작**하며 제목 아래 `.motion-note` 한 줄을 보인다(R-171). 릴 순서는 고정 — 수저 릴은 왕복(`WEALTH_REEL_ORDER`, R-274), 지역 릴은 확률표 순서.
7. 도구 줄 토글(BGM·다크 모드)은 켜짐을 `aria-pressed="true"` + 아이콘 교체 + 읽기 전용 「켜짐」으로 표시한다. 다크 모드 아이콘: 꺼짐 달(`#i-moon`), 켜짐 해(`#i-sun`).
8. 지금 세상의 지역은 2026년 현행 **16개 시·도**(전남광주통합특별시 포함, 광주·전남 출생 통계 합산). 룰렛 릴·확률표는 줄임 이름, 서류·프로필은 정식 이름 + 시군구.
9. 가로·요소 넘침 점검은 `scripts/design/shootMockups.mjs`의 `overflowReport()`와 같은 규칙(문서 scrollWidth, 요소 scrollWidth > clientWidth, 경계 상자 화면 밖)을 e2e에 옮겨 360·320px에서 0건을 단언한다.
10. 구현 화면이 시안과 다르면 designer가 `docs/design/diff-<SPEC>.md`에 차이와 사유를 적는다(완료 기준 「디자인」). M2 첫 화면은 QA·검수에서 달라진 점(캐러셀 조작 줄이 카드 머리, 데스크톱 카드 높이 가변, 값 줄·기준 줄 분리, 짧은 쌍 두 줄, 푸터 쉼표 나열, 조혼인율 줄, 「준비 중」 카드, 확인 단계 배치, 띠 해제, 강제 색상 상태 색)을 시안 쪽에 모두 받아들여 2026-10-16에 시안·`ds.css`를 구현과 맞췄다(차이 문서 대신 — `ai-log/2026-10-16_SPEC-003_design-M3prep.md`). **M3 룰렛·출생신고**는 검수 승인(REV-003-M3-3) 뒤 시안을 구현 모델에서 다시 만들고 남은 차이(정적 시안의 한계 등 — `<wbr>` D-05·강제 색상 띠 결함 D-07은 r4 뒤 닫힘)와 명세 차이(주거 3칸 R-267, 비교 표 R-260~R-263, 「태어난 곳」 2칸 R-281, 릴 왕복 R-274 등)를 **`docs/design/diff-003.md`**에 적었다(2026-10-16, R-270). r4(QA-003-M3 후속 QM3-1~5·R-291) 뒤에는 시안 `ds.css`·생성기를 다시 구현과 맞췄다(컨테이너 기반 격자·비교 표, 제목 상한, 도장 불투명도 제거, `<wbr>`, 문구 3개 — `ai-log/2026-10-16_SPEC-003_design-M3r4.md`).
11. 수저 아이콘 스프라이트 `icons/spoon-grades.svg`: 칩·릴·서류·프로필·엔딩 칩은 **`#sp-N`**(실루엣), 첫 화면 다섯 자루 띠(32×52)만 **`#sp-N-lg`**. 강제 색상에서 칩 아이콘은 `.grade svg.spoon { color: CanvasText }`만 — **외곽선으로 바꾸지 않는다**(R-190, 스프라이트에 stroke·외곽선 변수가 없어 바꿀 길도 없다). 은·금 큰 변형의 밝은 표식은 `--sp-mark`(기본 흰빛)로 바꿀 수 있으나 평상시 테마에서는 바탕색으로 두지 않는다(구멍처럼 보인다) — 강제 색상에서만 `tokens.css`가 `Canvas`로 둔다(두 극성 모두 표식 유지, 앱은 `main.tsx`가 `tokens.css`를 읽으므로 따로 할 일 없음). 스프라이트의 표식은 `fill="#fff" style="fill:var(--sp-mark,#fff)"` 이중 지정이라 변수를 못 읽는 엔진에서도 흰빛이다. 머리 안에 선 무늬를 더하지 않고, **아이콘을 이름·점 없이 단독으로 쓰지 않는다**. 테스트가 막는 것(`tests/designAssets.test.ts`): 선 무늬·stroke·외곽선 변수(「R-121·R-190」·「R-121: 큰 변형」), SVG 프레젠테이션 속성 안의 `var()`(「REV-003-D-4」), 그리고 **화면 시안 열두 장의 단독 사용 0**(「R-190: 화면 시안의 수저 아이콘은 모두 칩·띠 안」 — 모든 `<svg class="spoon">`이 `.grade`/`.spoon-fig` 안에 있고 바로 뒤에 같은 단계의 이름이 따르는지 본다). 구현 화면의 단독 사용은 developer의 컴포넌트 테스트 몫이다.
12. **M3·M4 공통**: 하단 띠·고정 헤더·글자 확대·구분 기호·강제 색상 상태·컨테이너 쿼리는 11절의 패턴을 그대로 쓴다 — 첫 화면이 이미 쓰는 함수(`ui/barRelease.ts#watchBarRelease`, `ui/focusReveal.ts`, `ui/Glue.tsx`, `ui/Pair.tsx`)와 e2e 도구(`e2e/focusObscured.ts#auditFocus`, `e2e/viewports.ts#STANDARD_VIEWPORTS`, `e2e/textResize.ts`, `e2e/lineBreaks.ts`)를 재사용하고 새로 만들지 않는다.

## 11. 공통 패턴 — M2에서 확정, M3(룰렛·출생신고)·M4(대시보드) 화면이 따른다

QA-003-M2·REV-003-M2 시리즈에서 굳어진 규칙이다. 근거는 SPEC-003 「QA-003-M2 보완」(QM2-1·QM2-3·QM2-5·QM2-10~12)과 CM10·CM11, 참고 구현은 `src/styles/title.css`·`docs/design/mockups/ds.css`(같은 블록). 새 화면은 자기 마일스톤에서 CM10·CM11 e2e를 통과해야 끝난다.

### 11-1. 고정 요소(하단 띠·고정 헤더)와 키보드 포커스 (CM10·QM2-1)
- 화면 가장자리에 붙는 요소(`position: fixed`, 붙은 `sticky`)는 **실제 높이를 CSS 변수로 노출**한다: 하단 띠 `--bar-h`, 상단 고정 헤더가 생기면 `--head-h`. 높이는 상태·글자 크기마다 다르므로 **고정값을 적지 않고 잰다** — 첫 화면이 쓰는 `ui/barRelease.ts#watchBarRelease(bar, …)`(ResizeObserver, `<html>`에 변수·클래스)를 그대로 부른다.
- 문서 루트(`<html>`)에 스크롤 여백: `scroll-padding-bottom: calc(var(--bar-h) + var(--sp-3))`, 위는 `scroll-padding-top: var(--sp-3)`(고정 헤더가 있으면 `calc(var(--head-h) + var(--sp-3))`). 여유 12px은 포커스 링(3px + 간격 2~4px)보다 크다. 안쪽 스크롤 영역(따라다니는 카드 등)은 자기 `scroll-padding`을 둔다.
- 본문 끝 여백은 `.page-end-space { height: calc(var(--bar-h, 164px) + var(--sp-2)) }` — 폴백 164px은 가장 큰 상태. 띠가 가리는 만큼만 비우고, 띠 높이가 바뀌면 함께 바뀐다.
- 가용 높이(뷰포트 − 고정 요소 − 스크롤 여백)보다 큰 포커스 대상(큰 글자의 라디오 카드·여러 줄 링크·슬라이드 영역)은 **위쪽 변과 링이 보이게** 맞춘다(`ui/focusReveal.ts#revealTopOfTallFocus`) — 키보드 포커스(`:focus-visible`)에서만, 눌러서 생긴 포커스는 화면을 점프시키지 않는다(R-241).
- 검사: `e2e/focusObscured.ts#auditFocus` × `STANDARD_VIEWPORTS` 11종 × 글자 100·200% × 화면 상태 전부 — 포커스 링 상자와 고정 요소 상자의 겹침 0, 조작 요소 집합 = 순회로 닿은 집합. 고정 요소는 테스트가 자동으로 모으므로 새 띠·헤더에 이름을 등록할 일은 없다.

### 11-2. 하단 띠 고정 해제 (QM2-12·R-233·R-240)
- 띠 높이가 **작은 뷰포트 높이(`100svh`)의 50%를 넘으면** `<html class="bar-released">` — 띠는 `position: static`으로 본문 끝(푸터 다음)에 놓인다. 판정·클래스는 `watchBarRelease`가 한다. `innerHeight`로 재지 않는다(모바일 주소창 접힘에 흔들려 스크롤 중 고정↔해제가 뒤집힌다). 높이 미디어 쿼리로 풀지 않는다(띠 높이는 상태마다 다르고 rem 미디어 쿼리는 글자 확대 시험에 반응하지 않는다).
- 함께 풀 것: `scroll-padding-bottom` → `var(--sp-3)`, `.page-end-space` 숨김, `--bar-h`에 묶인 다른 계산(첫 화면 오른쪽 열의 `max-height`). 띠 위끝 선은 **테두리가 아니라 그림자**(`--shadow-bar`, 풀린 띠 `0 -1px 0 var(--c-border-strong)`) — 테두리로 그리면 띠가 1px 커져 `--bar-h`가 해제 때문에 어긋난다. 강제 색상은 그림자를 지우므로 `.bottom-bar { border-top: 1px solid CanvasText }` **한 규칙을 고정·해제 공통**으로 둔다.
- 전환(창 크기·회전·글자 크기·확인 단계 열고 닫기)에서 포커스를 가진 요소는 포커스를 잃지 않는다(클래스만 바뀐다). 풀린 띠 안의 버튼이 포커스를 받으면 화면 안으로 스크롤되고, 확인 단계처럼 안내문이 있으면 안내문 첫 줄과 포커스 버튼이 함께 보이게 한다(`ui/focusReveal.ts#revealWithinReleasedBar`).
- 낮은 화면(400% 확대 상당 320×256 등)에서 주 버튼이 스크롤 아래로 가는 것은 받아들인 대가다. 시안: `screens/003/title-confirm-low.png`.

### 11-3. 글자 200% 리플로 (CM11·QM2-3)
- 측정 조건: (가) `html { font-size: 100~200% }` × 320·360 (나) 640×400·512×384·320×256. 가로 넘침 0px, 잘림 0, 이름표 겹침 0, 기본 버튼 높이 ≥ 44px·누름 가능, 고정 띠 ≤ 화면 높이 50%(아니면 11-2로 해제).
- `white-space: nowrap`은 **숫자+단위·날짜 같은 짧은 묶음**(`.nowrap`)에만. 구절·사슬은 `.keep-phrase`(inline-block, `max-width: 100%` — 줄에 안 들어가면 통째로 다음 줄로, 구절이 한 줄보다 길 때만 안에서 끊긴다).
- 가로 배열(수저 띠·버튼 줄·도구 줄)은 `flex-wrap`으로 다음 줄로 접는다 — 가로 스크롤로 해결하지 않는다. 칸의 최소 폭은 이름의 가장 긴 낱말(`min-width: min-content`). 접힘 모양을 미리 정한다(수저 띠: 앞 넷 같은 폭 + 다이아몬드 1.3배, 못 들어가면 줄바꿈 / 도구 줄 이름 두 줄까지).
- 큰 숫자는 칸 폭에 맞춰 글자 크기를 줄인다: `.slide__value { font-size: min(var(--fs-3xl), calc((100cqw − 단위 폭) / var(--value-em))) }` — 값 글자 폭(em)·단위 글자 수를 인라인 변수로 넣는다(`core/carousel.ts#valueWidthEm`). 숫자는 중간에서 끊기지 않는다.
- 글자·간격·고정 높이는 rem/em. 그래프 글자는 13px 아래로 내려가지 않는다(R-206).

### 11-4. 구분 기호 사슬·짧은 쌍·값 줄 (QM2-4·QM2-5·QM2-10·QM2-11)
- 「·」「/」「—」가 **줄 끝이나 첫머리에 혼자 남지 않는다**. 글자는 `ui/Glue.tsx`로 감싼다(`core/glue.ts`가 사슬·붙은 기호·괄호 낱말·숫자+단위·날짜를 자동으로 묶는다). 설계 쪽에서 정할 것 셋:
  1. **항목 수가 데이터·설정에 따라 바뀌는 나열은 쉼표 나열**(「국가데이터처, 행정안전부, 교육부」, `commaList`) — 가운뎃점 금지. 쉼표는 앞 낱말에 붙어 줄 끝에 와도 되고 첫머리에는 오지 않는다.
  2. 「·」는 **항목 수가 고정된 짧은 쌍**에만(「인구 10만 명당 · 2025년 기준」, 「통계 기준: 2025년 · 마지막 갱신 2026-10-15」). `src/`에서 `join(' · ')`로 화면 글자를 잇지 않는다(`tests/glue.test.ts`가 사용처를 잠근다).
  3. 짧은 쌍은 **`ui/Pair.tsx`**로 그린다: 한 줄에 들어가면 「A · B」, 칸이 좁거나 글자가 커서 넘치면 기호를 감추고 두 항목을 따로 줄로(두 항목 사이 공백은 기호 조각 밖에, R-242). 문턱은 **컨테이너 폭을 em으로** 견주는 컨테이너 쿼리(기준 줄 14em, 보조 줄 16.5em = 실측 한 줄 폭 + 15~20%). 새 쌍을 만들면 같은 방법으로 실측해 문턱을 더한다(`title.css`·`ds.css`의 `@container` 블록). 시안: `screens/003/title-a-pair-split-320.png`(두 줄 모드).
- **값 줄과 기준 줄을 나눈다**(형식표 A~D, SPEC QM2-4): 값 옆 칸에는 단위 낱말 하나(「27.8명」「240,326건」), 「인구 10만 명당」 같은 분모 문구는 기준 줄(「인구 10만 명당 · 2025년 기준」)이나 문장형(「인구 10만 명당 27.8명」). 「명당 명」「건 건」처럼 겹치는 표기 금지. 기준 연도는 한 값(`latest.year`)에서 만든다.
- **제목이 약속한 값은 눈에 보인다**(QM2-11): 제목(슬라이드·카드·패널 머리글)에 이름이 든 지표마다 그 값이 같은 화면의 눈에 보이는 글자에 있다 — 대체 텍스트·`sr-only` 표는 세지 않는다. 캐러셀은 큰 값 바로 아래 줄(「조혼인율 인구 1천 명당 4.7건」, 선 무늬 없음, 기준 줄 앞). M3 출생신고 비교표·M4 대시보드 패널의 제목도 같다 — 값을 보이거나 제목에서 이름을 뺀다.

### 11-5. 강제 색상에서 상태(hover·active·focus) 색
- `forced-color-adjust: none`을 준 요소는 브라우저가 색을 대신 고쳐 주지 않으므로 **상태마다 배경·글자를 시스템 색 한 짝으로** 못 박는다: 쉬는 상태 `ButtonFace`/`ButtonText`(주 버튼) 또는 `Canvas`/`CanvasText`, hover·active `Highlight`/`HighlightText`, 키보드 포커스는 쉬는 짝 그대로(링은 `outline`이 그린다), 포커스 중 hover·active는 다시 `Highlight` 짝(특이도가 포커스 규칙에 지지 않게 `:focus-visible:hover`로).
- 보통 모드의 `:hover { background: var(--c-brand-hover) }`가 강제 색상 블록보다 특이도가 높으면 토큰 매핑(`ButtonText`)이 배경에 칠해져 글자와 같은 색이 된다 — 첫 화면 주 버튼의 글자가 사라졌던 원인(REV-003-M2-4 r6 후속). **새 hover·active·눌림 규칙을 더할 때마다 강제 색상 짝을 같은 자리에 적는다**(`tests/barRelease.test.ts`가 첫 화면 CSS의 `:hover` 수를 센다 — 새 화면도 같은 잠금을 둔다). 눌림·선택은 이중 테두리·체크 같은 모양으로(8절). `tokens.css` 블록 특이도의 남은 위험은 3절 R-251 메모.
- **시스템 색으로 매핑된 토큰을 면(배경)에 쓰는 요소**(`background: var(--c-brand)` → 강제 색상에서 `ButtonText`): 브라우저는 저자가 쓴 **시스템 색은 덮어쓰지 않으므로** 면이 검게(CanvasText 극성) 남고, 그 위 글자(`--c-on-brand` = `ButtonFace`) 뒤에는 Canvas 백플레이트가 깔려 **글자가 사라진다**(M3 출생신고 띠 — 시안·구현 강제 색상 스크린샷의 흰 상자, `diff-003.md` D-07. 구현은 r4 R-291로 고쳐 `qa/screenshots/003/dev-M3-r4-birth-top-forced-colors-light-360x740.png`에서 글자가 보이고, e2e `m3-colors`가 **렌더 픽셀**로 글자 자리의 명도 대비 ≥ 4.5:1을 잰다). 그런 요소는 강제 색상 블록에서 ① `background: Canvas; color: CanvasText` + 모양(굵은 선·테두리)으로 구분하거나(출생신고 띠 `.doc__band`), ② 주 버튼처럼 `forced-color-adjust: none` + 시스템 색 **한 짝**을 명시한다. 글자색 vs 배경색만 견주는 대비 시험은 백플레이트를 보지 못하므로 **강제 색상 스크린샷을 눈으로 확인**한다(`shootMockups` `-forced`, e2e 스크린샷).

### 11-6. 컨테이너 쿼리
- `@container (max-width: Nem)`·`cqw` 단위를 쓰는 요소의 **조상에 `container-type: inline-size`**가 있어야 한다 — 없으면 쿼리는 영원히 거짓이고(한 줄 모양 고정) `cqw`는 무시된다. 첫 화면은 `.slide`가 컨테이너다. 새 화면에서 `Pair`·칸 폭 맞춤 글자를 쓰면 그 칸을 컨테이너로 선언한다.
- 컨테이너가 된 요소는 안쪽 내용으로 폭을 정하지 못하므로(inline-size containment) **부모가 폭을 정하는 블록**에만 건다(flex·grid 칸은 `min-width: 0`과 함께). `cqw` 식은 `@supports (width: 1cqw)`로 감싼다.
- 문턱은 em으로 적어 글자 확대에 함께 커지게 한다. 지원하지 않는 브라우저(Safari 16 미만)는 한 줄 모양 + `Glue` 묶음으로 물러난다. 제품 번들에 `@container`·`container-type`·`cqw`가 살아 있는지 e2e-prod가 본다(R-243).

### 11-7. 서류 격자·칩·비교 표·FitPair — M3(룰렛·출생신고)에서 확정, M4 패널·프로필 카드가 따른다 (REV-003-M3-1~3)
- **긴 낱말이 들어가는 격자 칸**(9글자 지명 「전남광주통합특별시」, 긴 직업·주거 이름): 좁은 화면(2열)에서는 한 줄 전체, 넓은 화면(3열)에서는 **두 칸 이상**(`grid-column: span 2`) — 한 칸(폭 1280에서 205px)은 글자 150%부터 낱말이 중간에서 끊긴다(R-281 마스터 결정). 빈 칸을 메우려고 `grid-auto-flow: dense`를 쓰지 않는다(읽는 순서 = 화면 순서). 끊김 판정 기준은 칸이 아니라 **한 줄 전체 폭**(낱말이 한 줄에 들어갈 폭인데 끊기면 위반)이고, 허용은 측정과 `INTENDED_BREAKS`뿐이다(11-8절 — R-281의 「글자 200% × 폭 320·360 명시 목록」은 QM3-1이 대체했다). **열 수·쌓기는 뷰포트 px가 아니라 컨테이너 폭(rem)이 정한다**: 서류 격자는 본문 `docbody`가 11.5rem 미만이면 1열(반쪽 칸의 「단순노무직」·「서비스직」이 글자 150~200%에서 끊겼다 — 폭 320 · 150%+, 360 · 200%), 3열은 640px 이상 **그리고** 본문 17.75rem 이상일 때만; 비교 표는 카드 `cmp`가 35rem 미만이면 한 행씩(글자 200%의 폭 640대에서 출처 줄이 표 칸 안에서 끊겼다). px 미디어 쿼리는 글자 확대에 반응하지 않는다(11-6절). 새 화면도 가장 긴 내용의 **표본을 일부러 모아**(흙·다이아몬드·지난·다가올 세상, 부모 직업이 다른 표본 — R-262·QM3-1) 잰다 — 짧은 기준선 한 장으로는 못 잡는다.
- **칩 안 줄바꿈**(수저 칩): 알약은 `flex-wrap` + `max-width: 100%`, 아이콘·점은 `flex: none`, 이름은 `flex: 1 1 0; min-width: min-content; overflow-wrap: normal; word-break: keep-all` — 점이 먼저 다음 줄로 밀리고 이름은 `<wbr>`(「다이아몬드<wbr>수저」) 자리에서만 끊긴다. 전역 `overflow-wrap: anywhere`를 이름에 그대로 두면 점이 밀리기 전에 이름이 글자 하나씩 끊긴다. 짧은 칩(릴 칸)은 제외.
- **비교 표 + 한 줄 서술**: 표에는 「이 가정 형편」에 맞춘 **집단의 값만**(출처 확인 행만, 모든 단계 같은 행 구성, 행마다 출처 줄과 집단 설명, 열 머리와 칸 뜻이 어긋나는 값 금지 — 「전체 평균」 칸에 격차를 넣지 않는다). 이 가정을 겨냥할 수 없는 지표(소득 계층 간 기대수명 격차 같은 집단 평균 차이)는 **표 밖 한 줄 서술** + 「집단의 평균 차이입니다」 단서 + 모든 단계 같은 글. 통계의 기준 연도가 그 세상과 어긋나면(지난·다가올 세상) 카드 전체를 숨기고, 하단 표기의 범위를 보이는 항목으로 한정한다(R-260·R-261·R-263). 제목이 약속한 값은 눈에 보이는 글자에(11-4절 QM2-11).
- **짧은 쌍의 둘째 방식 `FitPair`**(`ui/FitPair.tsx`): 내용 길이가 **판마다 다른** 쌍(「{수저}({구간}) · {시·도}」, 「{나이}세 · {직업}」, 「수저 게임 · 가상의 서류」)은 em 문턱의 `Pair` 대신 보이지 않는 탐침(`::before { content: attr(data-text) }`, **`position: fixed`** — absolute면 한 줄 폭만큼 문서 가로 스크롤이 늘어난다)으로 한 줄 폭을 재서 칸 폭과 견주고, 넘치면 기호 없이 두 항목을 따로 줄로. 탐침 글자는 DOM 글자에 들어가지 않는다(복사·읽기에 두 번 나오지 않음). 칸이 `flex` 안이면 그 칸이 폭을 **나눠 받아야**(`flex: 1 1 8rem; min-width: 0`) 측정이 맞다(문서 띠 `.doc__tag`).
- **세상별 문구 분기**: 통계 기반 문구(지역 확률표 주석·하단 표기·지역 표기)는 세상마다 다른 상수/함수로 두고(지금 = 통계 파생, 지난·다가올 = 설계값·조정 고지, 지난 세상 지역 이름은 2025년 행정구역임을 밝힘) 한 문장이 세 세상에 억지로 맞도록 쓰지 않는다(R-263·R-264·R-187). 문구는 `copy.md` 룰렛·출생신고 행.
- **넘침 측정기 공통 규칙**: `clip: rect(0 0 0 0)`로 읽기 전용으로 접은 요소와 그 안(비교 표의 접힌 머리글)은 세지 않는다 — 시안 `shootMockups#overflowReport`와 e2e `textResize.ts`가 같은 규칙(M3). 가로 넘침 0px·요소 단위 넘침 0은 그대로다.

### 11-8. 낱말 끊김 공통 규칙 — QM3-1·QM3-2 (M3-L02, 2026-10-16 r4에서 확정, 새 화면이 그대로 따른다)
- **대상은 눈에 보이는 모든 낱말**(제목·본문·칩·표·출처·푸터·하단 띠·헤더·릴·장식 「접수」까지 — 낱말 종류로 범위를 좁히지 않는다). 낱말 = 공백·구두점으로 가른 한글·영숫자 덩어리이고 요소 경계(`<span>`·`<wbr>`)를 넘어 이어 붙은 글자는 한 낱말, `<br>`는 낱말 경계(첫 화면 띠의 「다이아몬드<br>수저」는 글쓴이가 정한 두 줄 이름표). 끊김 = 한 낱말의 글자가 두 줄 이상에 걸친 것 — 낱말 사이·구두점 뒤 줄바꿈은 끊김이 아니다.
- **허용은 둘뿐, 둘 다 손으로 적은 낱말 목록이 아니다**: (a) **측정상 한 줄 전체보다 긴 낱말** — 자연 폭(`nowrap`으로 잰 글자 상자 폭의 합) > 한 줄 전체(그 낱말에서 위로 올라가 처음 만나는, 여러 칸이 한 줄을 나눠 쓰는 상자의 내용 폭 — 격자 `dl`·또래 `li`·표·두 릴 전체; 칸 하나의 폭이 아니다) + 0.5px일 때만, 그리고 **글자 100%에서는 0건**(R-281 유지). 지금 그런 낱말은 글자 200%의 7글자 특별자치도 지명(폭 320)과 9글자 「전남광주통합특별시」(폭 375까지)뿐이다. (b) **`e2e/intendedBreaks.ts#INTENDED_BREAKS`에 올린 `<wbr>` 지점** — 지금은 「다이아몬드<wbr>수저」(`ui/Grade.tsx`, 시안 생성기 `mockLib.mjs#gradeNameHtml`) 하나. 목록에 없는 낱말에 `<wbr>`·`&shy;`·U+00AD를 쓰려면 이유와 함께 등재한다(`tests/wordBreaks.test.ts`가 `src/` 사용처와 목록의 일치를 잠근다).
- **그 밖의 끊김은 결함**이고 고치는 방법은 낱말을 허용 목록에 넣는 것이 아니라 **칸을 한 줄 전체로 넓히는 것**이다 — 반쪽 칸을 1열로(서류 격자 컨테이너 11.5rem), 출처 줄을 표 칸 밖 한 덩어리로(비교 카드 컨테이너 35rem), 칩 안 점을 먼저 다음 줄로(11-7절). 문턱은 rem·컨테이너 폭으로 두어 글자 확대에 함께 커지게 한다.
- **제목(h1)에는 (a)(b)를 쓰지 않는다**: 어떤 조합에서도 제목 낱말이 끊기지 않도록 **줄 폭 기준 글자 크기 상한**을 둔다 — `font-size: max(바닥, min(기본, 100cqi ÷ (가장 긴 낱말 글자 수 + 1)))`(상자를 `container-type: inline-size`로, 글자 수는 문구 상수에서 계산해 인라인 변수로). rem 고정 상한은 루트 글자 200%에서 함께 두 배가 되어 소용이 없다. 바닥은 같은 화면 본문보다 큰 크기(룰렛 `--fs-lg`)라 제목 위계가 유지되고, 낱말 **사이**에서 여러 줄로 접히는 것은 허용한다(「태어날 곳이 / 정해졌습니다」, `roulette-result-320-text200.png`). 「정해졌습니 / 다」처럼 한 글자가 홀로 남는 것은 금지다.
- 측정은 `e2e/lineBreaks.ts#measureWordBreaks`(`STANDARD_VIEWPORTS` 11종 × 글자 100·150·200% × 화면 상태 전부, `broken = []`)가 하고 시안은 같은 규칙으로 샷을 눈으로 확인한다(`birth-grid-320-text200.png` 1열, `birth-future-320-text150.png` 다이아몬드 칩, `roulette-result-320-text200.png` 제목). 설계 쪽 판단이 필요한 것: 릴 배치(두 릴 전체 폭이 한 줄 — 릴 칸 낱말이 반쪽 폭에 걸려 끊기면 세로 쌓기 등 배치 변경을 designer와 협의, 마스터 확인 5)와 서류 본문 안쪽 여백(7글자 지명의 (a) 허용을 없애려면 여백을 줄여야 하나 지금은 유지 — `ai-log/2026-10-16_SPEC-003_design-M3r4.md` 6절).
