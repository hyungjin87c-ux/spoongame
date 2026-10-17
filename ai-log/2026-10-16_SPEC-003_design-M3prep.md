# 2026-10-16 SPEC-003 design-M3prep (M3 착수에 맞춘 디자인 문서 정리 — 소규모)

- 누가: designer (Fable)
- 무엇을: M2 첫 화면이 QA·검수(QA-003-M2 1~3회차, REV-003-M2-1~5)를 거치며 시안과 달라진 점을 시안 쪽에 받아들이고, M3(룰렛·출생신고)·M4(대시보드) 화면 설계자가 따를 공통 패턴을 `design-system.md`에 적었다. 입력: `docs/review/REV-003-M2-5.md`(R-250·R-251), SPEC-003 「QA-003-M2 보완」(QM2-1~12, CM10·CM11, 마스터 결정), `ai-log/2026-10-15_SPEC-003_dev-M2-r4~r6.md`, `src/styles/title.css`·`src/screens/TitleScreen.tsx`·`src/ui/StatsCarousel.tsx`·`Pair.tsx`·`Glue.tsx`·`src/core/carousel.ts`·`glue.ts`·`src/data/titleText.ts`(**읽기만**). **`src/` 아래는 아무것도 고치지 않았다**(`tokens.css`·`src/assets/` 포함). 새 npm 의존성 없음, 커밋·푸시 없음.
- 결과: 아래. 검증 — `npx vite-node scripts/design/buildMockups.mjs` → `shootMockups.mjs title`(첫 화면 17장, 넘침 0) → `shootMockups.mjs --check`(모든 시안 320px 라이트·다크 넘침 0) → `npx vitest run tests/designAssets.test.ts tests/titleScreen.test.tsx` **84/84 통과**(시안 열두 장의 수저 아이콘 단독 사용 0, `ds.css`의 `.grade svg.spoon { color: CanvasText; }`, `title-a.html`의 `hero__pop`·세상 카드 문구 = `ERA_CONFIG`).
- 다음 단계: M3 developer가 룰렛·출생신고 띠에 `design-system.md` 11절(특히 11-1·11-2)을 적용하고 `watchBarRelease`·`auditFocus`·`STANDARD_VIEWPORTS`를 재사용한다 → 구현이 뜨면 designer가 룰렛·출생신고 시안을 같은 방식(구현 모델에서 읽기)으로 맞추고 차이가 있으면 `docs/design/diff-003.md`. R-251은 **M4 착수 조건**: designer가 `tokens.css` 강제 색상 블록 선택자를 3절 메모대로 고치고 developer가 e2e(라이트 고대비 + `data-theme='dark'`)를 더한다. R-250(`title.css` 주석)은 developer가 그 파일을 손볼 때.

## 1. `design-system.md` — 공통 패턴 11절 추가 (할 일 1)
| 절 | 내용 | 근거 |
|---|---|---|
| 11-1 고정 요소·포커스 | 고정 요소 높이를 변수(`--bar-h`, 헤더는 `--head-h`)로 노출(측정은 `watchBarRelease`), 문서 루트 `scroll-padding-bottom: calc(var(--bar-h) + var(--sp-3))`·`scroll-padding-top`, `.page-end-space` = `--bar-h` + 8px(고정값 금지), 가용 높이보다 큰 포커스 대상은 위쪽 변 보이기(`revealTopOfTallFocus`, 키보드만), 검사 `auditFocus` × 11종 × 글자 100·200% | CM10, QM2-1, R-241 |
| 11-2 띠 고정 해제 | 띠 > `100svh`의 50% → `bar-released`(static, 본문 끝), `innerHeight`·높이 미디어 쿼리 금지, 함께 풀 것(scroll-padding·끝 여백·`--bar-h` 계산), 위끝 선은 그림자(테두리면 높이가 어긋남) + 강제 색상 `border-top` 한 규칙, 전환 때 포커스 유지, 확인 단계 안내문 + 버튼 함께 보이기 | QM2-12, R-233, R-240, M2-B07 |
| 11-3 글자 200% 리플로 | 측정 조건 (가)·(나), `nowrap`은 숫자+단위·날짜만, 구절은 `.keep-phrase`, 가로 배열은 `flex-wrap`(가로 스크롤 금지), 큰 숫자는 `cqw`로 칸 폭 맞춤, rem/em, 그래프 글자 ≥ 13px | CM11, QM2-3, R-206 |
| 11-4 구분 기호·짧은 쌍·값 줄 | 쉼표 나열(데이터 나열) / 「·」는 고정 쌍만 / `Pair` 두 줄 모드(문턱 em 컨테이너 쿼리 14em·16.5em, 새 쌍은 실측), 값 줄·기준 줄 분리(「명당 명」 금지), 제목이 약속한 값은 눈에 보이게(조혼인율 줄, M3·M4 패널에도) | QM2-4·5·10·11, R-230, R-242 |
| 11-5 강제 색상 상태 색 | `forced-color-adjust: none` 요소는 상태마다 시스템 색 한 짝(ButtonFace/ButtonText ↔ Highlight/HighlightText), 보통 모드 hover가 토큰 매핑을 배경에 칠해 글자가 사라진 원인, 새 hover마다 짝을 함께 | REV-003-M2-4 r6 후속 |
| 11-6 컨테이너 쿼리 | 조상에 `container-type: inline-size` 필수, 폭을 부모가 정하는 블록에만, `@supports (width: 1cqw)`, 문턱은 em, 미지원 브라우저 물러남 | R-243 |

그 밖에 6절 컴포넌트 표 4행(라디오 카드 「준비 중」, 캐러셀 카드 머리·조작 줄 `.carousel__status`, 캐러셀 슬라이드 줄 순서, 하단 고정 띠 상태별 높이·확인 단계 배치, 헤더 `--head-h`), 10절 10항(차이는 시안에 흡수) + 12항(M3·M4 재사용 목록), 머리 요약에 「M3·M4 설계자가 먼저 읽을 것」.

## 2. 시안을 구현과 맞춤 (할 일 2)
- **생성기 `scripts/design/buildMockups.mjs`**: 첫 화면을 구현과 같은 구조(`.title` 격자 안 `main → aside → footer`, R-220)로 다시 썼고, 캐러셀은 `src/core/carousel.ts#buildCarousel`의 **실제 모델 14장**을 그대로 그린다(`SlideView`·`StatsChart.tsx`와 같은 마크업 — 값 줄 「27.8」+`<small>명</small>`, 보조 값 줄 「조혼인율 인구 1천 명당 4.7건」, 기준 줄·「통계 기준」 줄은 `Pair`, 모든 글자는 `Glue` 묶음, 범례·출처·상담전화 안내·막대 그래프 숨긴 표). 보이는 슬라이드는 `?slide=<id>`. 문구는 `titleText.ts`(한 줄 설명 `heroTagKeepParts`, 버튼·안내·푸터 `footerStatsText(orgs)`·`populationInfo`), `ERA_CONFIG`(세상 카드 — `eraMetaText`, 지금 세상만 M3 목표값 2026 고정), `LIFE_LENGTH_TEXT`·`NOT_READY_TEXT`(「약 1시간」 = `is-disabled` + 「준비 중」), `names.json meta.attribution`(이름 출처 링크)에서 읽는다. 하단 띠: 새 판 / 이어하기 / **확인 단계**(`title-continue.html?state=confirm` — 안내문 → 「이전 판 지우고 태어나기」 → 맨 아래 「돌아가기」). 가상 인구는 시안용 고정값 51,284 유지(대시보드 고정 줄과 같은 값).
- **`mockLib.mjs#page()`**: 하단 띠가 있는 시안에 `watchBarRelease` 흉내 스크립트(띠 `offsetHeight` → `--bar-h`, `100svh` 탐침의 50% 초과 → `bar-released`). 다른 시안(룰렛·출생신고)도 이 스크립트를 받아 끝 여백이 `--bar-h`를 따른다.
- **`ds.css`**: `title.css`와 같은 블록으로 — 하단 띠(`__ask`·`__stack`, `--bar-h` 끝 여백, `html.has-bottom-bar` scroll-padding, `html.bar-released`), 첫 화면 격자·960px 2열(카드 2줄 걸침, `max-height`에 `--bar-h`, 해제 때 풀림), `.keep-phrase`·`.pair` + `@container`, 수저 띠 `flex-wrap`, `.radio-card.is-disabled`, 캐러셀(카드 머리·`.slides`/`.slide.is-active`·`cqw` 값 줄·`__basis`/`__side`·그래프 13px `paint-order`·범례·점 한 줄), 강제 색상(주 버튼 hover·active·focus 짝, `GrayText`, `.slide__help`, `svg.logo`, 띠 `border-top`). `.carousel__count` → `.carousel__status`(구현 클래스).
- **촬영기 `shootMockups.mjs`**: `low` 320×256 뷰포트, 변형 옵션 `query`(시안 주소 질의)·`to`(요소를 화면 위로 스크롤), `--check`(샷 없이 320px 전수 점검). 첫 화면 샷 17장: 기존 9장 재촬영 + `title-a-suicide-mobile/-320`, `title-a-pair-split-320`, `title-a-marriage-mobile/-desktop`, `title-confirm-mobile/-desktop/-low`.
- **직접 본 것**(스크린샷을 열어 확인): 데스크톱 — 조작 줄이 카드 머리에 「1 / 14」·일시정지 오른쪽 끝, 「0.80<small>명</small>」 아래 「2025년 기준」, 카드 높이가 슬라이드만큼(혼인 건수 10/14은 더 길다). 모바일 360 — 수저 띠 한 줄, 「준비 중」 점선 카드, 캐러셀이 선택 아래, 푸터 「통계 출처: 국가데이터처, 행정안전부, 교육부 (…)」 쉼표 나열 + 이름 출처 밑줄 링크 + 가상 인구 설명 + `v0.1.0 (a1b2c3d)`. 320 — 「27.8 명」/「인구 10만 명당 · 2025년 기준」 한 줄, 「통계 기준: 2025년」/「마지막 갱신 2026-10-15」 **두 줄(기호 숨김)**. 확인 단계 — 안내문·보조 「이전 판 지우고 태어나기」·기본 「돌아가기」 맨 아래; **320×256에서는 띠가 풀려 푸터 다음에 놓이고 위끝 가는 선**. 다크·강제 색상(검은 글자 극성)은 6차와 같은 모양.
- 시안과 구현의 남은 차이(의도): 시안 그래프는 폭 320·높이 232 좌표를 비율로 늘리고(구현은 그려지는 폭으로 좌표를 다시 만든다, R-206), 시안의 조작 줄·자동 넘김은 동작하지 않는다(정적 HTML), 지금 세상 작은 글씨는 M3 목표값(구현은 M3 전까지 실제 범위 「2008~2025년생」, R-201).

## 3. R-251 대비 설계 메모 (할 일 3)
`design-system.md` 3절 4항 아래 한 단락: 강제 색상 블록 `:root`(0,1,0)가 다크 두 블록(0,2,0)에 지는 구조와 M4 수동 다크 + 밝은 고대비에서 `forced-color-adjust: none` 요소(로고·선택 카드 글자·포커스 링·`--sp-mark`)가 사라지는 경로, 고치는 방법(선택자를 `:root, :root:not([data-theme='light']), :root[data-theme='dark']`로 — `!important` 금지, 값은 그대로), 점검(다크 두 블록 일치 검사 유지 + e2e `colorScheme: light` + 강제 색상 + `data-theme='dark'`에서 대비 ≥ 3:1). **`tokens.css`는 손대지 않았다** — M4 착수 때.

## 4. `copy.md` 확인·보완 (할 일 4)
- 이미 있었음: 확인 단계 두 버튼(「이전 판 지우고 태어나기」/「돌아가기」 + 안내문 + 「새로 태어나기」), 푸터 출처 쉼표 나열, 조혼인율 줄. 확인 단계 행에 **배치**(맨 아래 「돌아가기」, R-204)와 시안 주소를 더했다.
- 없어서 더함(7행): 인생 길이 「준비 중」(R-202), 이전 저장 안내(C6), 캐러셀 머리 상태 문구(「자동 넘김 멈춤」·「자동 넘김 다시 시작」·슬라이드 영역 이름, QM2-2 I2), 값 줄·기준 줄 형식(A/B/D형·「통계 기준」 줄·짧은 쌍 두 줄, QM2-4·5·10), 자살률 안내(SC6·C10), 푸터 가상 인구 설명(VP2). 3-2절에 구분 기호 규칙 포인터(11-4절)와 QM2-11 일반 규칙 한 줄.

## 5. 바꾼 파일
- 문서: `docs/design/design-system.md`(머리 요약·3절 R-251 메모·6절 4행·10절 10·12항·**11절 신설**), `docs/design/copy.md`(2절 7행 추가·확인 단계 행 보강·3-2절 한 줄), `docs/design/README.md`(머리·산출물 지도·먼저 볼 스크린샷 7·3-00절·명령·5절).
- 시안: `docs/design/mockups/title-a.html`·`title-continue.html`(재작성), `ds.css`(첫 화면·캐러셀·띠·강제 색상 블록), 다른 시안 HTML은 `page()` 스크립트 한 줄만 바뀜(재생성).
- 스크린샷: `docs/design/screens/003/title-*.png` 17장(9장 재촬영 + 8장 추가).
- 생성기: `scripts/design/buildMockups.mjs`, `mockLib.mjs`, `shootMockups.mjs`.
- 손대지 않음: `src/` 전체(`tokens.css`·`src/assets/` 포함), `tests/`, `e2e/`, `docs/spec/`, `docs/TODO.md`, `docs/design/self-review.md`·`credits.md`·`faces.md`·`contrast-report.md`.

## 6. 확인하지 못한 것
- 시안의 띠 해제·`Pair` 두 줄은 Playwright 크로미엄(데스크톱) 에뮬레이션에서만 봤다 — 실기기·WebKit·실제 Windows 고대비 팔레트는 M9 목록 그대로.
- 글자 200% 상태의 시안 스크린샷은 찍지 않았다(촬영기에 글자 크기 옵션이 없다 — 필요하면 `html { font-size }` 옵션을 더한다). 구현 쪽 근거는 `qa/screenshots/003/dev-M2-r4-v04-*.png`·`r5-c02-*`.
