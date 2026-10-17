# 2026-10-17 SPEC-003 design-M4prep (M4 대시보드 착수 조건 — developer 착수 전 designer 몫)

- 누가: designer
- 무엇을: `docs/TODO.md` M4 아래 착수 조건·「착수 때 함께」 줄의 designer 몫 세 가지 — ① REV-003-M2-5 **R-251** `tokens.css` 강제 색상 블록 특이도 ② REV-003-M3-5 관찰의 designer 후속(design-system 11-6 `@supports` 폴백·`<br>` 등록제, `ds.css` 같은 폴백, contrast-report 머리글) ③ **M4 대시보드 시안 점검**(M1 시안 `dashboard-adult/infant.html`이 M2·M3에서 굳힌 11절 공통 규칙과 구현된 공용 부품에 맞는지 보고 어긋난 곳을 시안·`copy.md`에서 고침 — 또래 칸 VP4·「대시보드 오른쪽 칸」 문구·엔딩·밀린·오류 화면 공통 헤더 DS1·수동 다크 토글 상태 표시 포함). 범위 밖(developer 몫: R-310 ⓑ·R-311·「집안 형편」 Glue·`formatReport` 문구·M4 구현)은 건드리지 않았다. `src/`는 `src/styles/tokens.css`만 고쳤다.
- 결과: 아래 1~6절. 점검(7절) — `npm test -- tests/designAssets.test.ts` 44/44, `npx vite-node scripts/checkContrast.ts` 실패 0, `shootMockups dashboard`·`system`·`decision`·`note`·`--check` 넘침 0, 전체 `npm test` 56파일 통과, `npm run check:todo` 실패 0·경고 0.
- 다음 단계: M4 developer 착수. 넘길 메모는 5절, 마스터 판단 요청은 6절. 검수자는 `docs/design/screens/003/dashboard-adult-{320-text200,low,mobile-dark,mobile-forced}.png`·`system-*.png`를 이미지로 열어 평가한다.

## 1. 바꾼 파일

| 파일 | 내용 |
|---|---|
| `src/styles/tokens.css` | **R-251**: `@media (forced-colors: active)` 블록 선택자 `:root` → `:root, :root:not([data-theme='light']), :root[data-theme='dark']`(값은 그대로, `!important` 없음). 머리 주석 3항·블록 주석에 이유. **유일한 `src/` 변경** |
| `tests/designAssets.test.ts` | 「R-251」 시험 1건 추가(43 → **44건**): 강제 색상 블록 선택자 목록에 다크 두 선택자가 있고 특이도(계산기 자기 점검 포함)가 각각 이상, 소스 순서가 다크 블록 뒤, `!important` 없음, 값 유지(`--sp-mark: Canvas`·`--c-logo`·`--c-focus`·`--c-bg`), 블록 분리기가 여전히 다크 블록을 먼저 잡음. 「R-190」 시안 열두 장 점검에서 새 `system.html`(수저 없음) 제외 + 아이콘 0 단언 |
| `docs/design/mockups/ds.css` | ① 룰렛 제목 상한을 `@supports (width: 1cqi)`로 감쌈 ② `@supports not (container-type: inline-size)` 폴백 블록(비교 표 쌓기 `@media (max-width: 639px)`·서류 3열 `@media (min-width: 640px)` — 구현 `doc.css`와 글자 그대로 같은 본문) ③ 대시보드 절 전면 정리(3절 표) ④ 밀린·오류 화면 절(`.system`) |
| `scripts/design/mockLib.mjs` | `page()` 흉내 스크립트: 하단 띠 선택자 `.bottom-bar, .controls-fixed`, sticky 헤더 `.dash-head` → `--head-h`·`has-sticky-head`, **헤더 해제**(헤더 + 고정된 띠 > 작은 뷰포트 50% → `head-released`) |
| `scripts/design/buildMockups.mjs` | 대시보드: 끝 여백 150px → `.page-end-space`, 가상 인구 고정 줄 `fitPair`, 식구 「{직업} · {상태}」 `fitPair`, 「시간순 · …」「나의 기록 · …」「새 기록 N개 · …」 `glueHtml`, 금액 `.nowrap`, 또래 라벨 `.people__now` + 「요즘 모습」 `.card__sub`, 카드 `aria-labelledby`. **`systemPage()` 신설** → `system.html`(밀린 화면) / `?state=error`(오류 화면) |
| `scripts/design/shootMockups.mjs` | 대시보드 샷 추가: `dashboard-adult-mobile-dark`(다크 모드 켜짐), `-320-text200`(접힘), `-low`(320×256 — 프로필까지 스크롤해 헤더 해제가 보이게), `system-superseded-{mobile,mobile-forced,desktop}`, `system-error-{mobile,mobile-dark,desktop}` |
| `docs/design/mockups/*.html` | 재생성(`dashboard-*`·`decision-*`·`note`·`system` 등 전부 — 생성기 출력) |
| `docs/design/screens/003/*.png` | 대시보드 11장 재촬영(새 3장 포함) + `system-*` 6장 |
| `docs/design/design-system.md` | 머리(44건·M4 시안 정리 한 줄), **3절 4항 R-251 메모 → 반영**, 6절 도구 줄·진행 줄·대시보드 헤더·헤더(공통 헤더 `SiteHead`, 밀린·오류 화면)·**또래 카드 행 신설**, 10절 12항 보강·**13항 M4 대시보드 규칙 요약**, **11-1 `--head-h`·헤더 해제 규칙**, 11-5 R-251 문장, **11-6 폴백 규칙(R-302) + `<br>` 등록제 포인터**, **11-8 (b) `FORCED_BREAKS`** |
| `docs/design/copy.md` | 출생신고 또래 안내 행(켤 때 둘째 문장 대체 문구 제안), 대시보드 헤더·진행 줄·도구 줄(다크 모드 켜짐 뜻)·자산 현황(금액 nowrap)·프로필·인생 기록 고정 줄(FitPair, 굵게 없음)·머리 보조(Glue)·식구(FitPair)·또래 카드 행, **엔딩·밀린 화면·오류 화면 헤더 이름 행 신설**(「엔딩」「저장 안내」「오류」) |
| `docs/design/diff-003.md` | 4절: D-09 판단(64px 유지), `formatReport` 머리글 메모 갱신(도장 예시 — developer 몫, 제안 문구), R-251 닫힘, **마스터 판단 요청(또래 카드 칩)**, 대시보드 시안 점검 요약 |
| `docs/design/contrast-report.md` | `checkContrast --write` 재생성(81 + 81쌍 실패 0, 수치 변화 없음 — 머리글 문구는 생성기 문자열이라 그대로) |
| `docs/design/README.md` | 10차 요약 단락, 작업 기록 행 |
| `docs/TODO.md` | M4 「착수 때 함께」 줄 아래 designer 후속 [x]·대시보드 시안 점검 [x], R-251 줄을 designer [x] / **e2e는 M4 developer** [ ]로 나눔(근거 포함) |
| `docs/review/REV-003-M2-5.md` | 끝에 「반영 내역 (R-251, designer / 2026-10-17 — M4 착수 조건)」 |

## 2. R-251 — 강제 색상 블록 특이도

- 문제: `:root`(0,1,0)가 다크 두 블록 `:root:not([data-theme='light'])`·`:root[data-theme='dark']`(0,2,0)에 져서 OS 다크·수동 다크 + 강제 색상에서 시스템 색 매핑이 다크 팔레트에 덮인다. 밝은 고대비 테마 위에 M4의 수동 다크를 켜면 `forced-color-adjust: none` 요소(로고·선택 카드 글자·포커스 링·띠 표식)가 밝은 Canvas 위에 어두운 팔레트 값으로 그려져 사라진다.
- 고침: 선택자 셋을 한 규칙에 — 다크·수동 다크에서 (0,2,0)으로 맞고 소스 순서가 뒤라 이기며, 수동 라이트에서는 `:root`만 맞지만 그때는 다크 블록도 맞지 않아 기본 블록을 순서로 이긴다. `!important` 없음, 값 그대로.
- 점검: 새 시험이 선택자·특이도·순서·값을 잠근다. **변조 확인** — 선택자를 옛 `:root {`로 되돌리면 `expected [ ':root' ] to include ':root:not(…)'`로 실패, 원복 뒤 통과(`cmp` 바이트 동일). `checkContrastLib#readThemeBlocks`는 `:root[data-theme='dark']`를 **첫 등장**(다크 블록, 228행)에서 찾으므로 뒤쪽 강제 색상 블록의 같은 선택자에 흔들리지 않는다 — 시험이 `blocks.darkAttr['--c-bg'] === '#14171f'`로 확인. `legacyTheme`·`contrast` 시험 그대로 통과.
- 남은 것: **렌더 e2e는 M4 developer** — `colorScheme: 'light'` + 강제 색상 + `<html data-theme='dark'>`에서 헤더 로고·선택 카드 글자·포커스 링의 바탕 대비 ≥ 3:1(`e2e/renderedContrast.ts` 재사용, 대조군 = 옛 선택자). TODO R-251 줄 하위 항목에 적었다.

## 3. 대시보드 시안 점검 — 어긋난 곳과 고친 것

기준: `design-system.md` 11절(고정 요소·포커스, 띠 해제, 글자 리플로, 구분 기호·Pair, 강제 색상 상태 색, 컨테이너 질의, 낱말 끊김)과 구현된 공용 부품(`SiteHead`·`GradeChip/GradeLine`·`GuardedButton`·`useBottomBar`·`FitPair`·`Glue`). 320 · 글자 200% 샷을 새로 찍어 **넘침 18건**이 나왔고(5열 도구 줄 격자, 이름표 격자의 고정 rem 열) 모두 시안 쪽에서 고쳐 0건이 됐다.

| # | 어긋난 곳 | 규칙 | 고친 것(시안) | 구현 메모 |
|---|---|---|---|---|
| 1 | 본문 끝 여백 `<div style="height:150px">` 고정값 | 11-1(고정값 금지) | `.page-end-space` | `useBottomBar(ref)` |
| 2 | 모바일 고정 진행 줄 `.controls-fixed`가 띠 패턴 밖 — `--bar-h`·`has-bottom-bar`·`scroll-padding`·해제 없음, 강제 색상에서 위끝 선 없음 | 11-1·11-2·11-5 | 흉내 스크립트가 `.controls-fixed`를 띠로 잼, `html.bar-released .controls-fixed { static }`, `< 960px` 안 `@media (forced-colors)` `border-top: 1px solid CanvasText`(고정·해제 공통) | `useBottomBar`에 진행 줄 ref |
| 3 | sticky 헤더 `.dash-head`: `--head-h`·`scroll-padding-top` 없음, 낮은 화면에서 헤더(≈100px) + 진행 줄(≈120px)이 320×256의 86%·667×375의 59%를 덮음 | 11-1 | `--head-h` + `html.has-sticky-head { scroll-padding-top }` + **헤더 해제**: 헤더 + 고정된 띠 > 작은 뷰포트 50% → `head-released`(static). 샷 `dashboard-adult-low.png` | developer가 같은 규칙으로 관찰자 하나 더(`watchBarRelease`와 같은 측정) + e2e(designer 제안 규칙) |
| 4 | 헤더 첫 줄 `.who__name { overflow: hidden; text-overflow: clip }` — 글자 200% × 320에서 이름이 잘림 | 11-3(잘림 0) | `.dash-head__top { flex-wrap }`, 자르기 제거 → 이름·알약이 로고 아래 줄 | — |
| 5 | 진행 줄 `grid 2.1fr repeat(4,1fr)` / `1fr 1fr` — 200%에서 「다음 결정으로」가 반쪽 칸에 안 들어감(nowrap) | 11-3(flex-wrap) | `flex-wrap` + `flex: 1 1 0; min-width: min-content`(보통 폭 모양 동일), ≥ 960px 자연 폭, 320px 일시정지 아이콘만 유지 | `GuardedButton` 6개 그대로 |
| 6 | 도구 줄 `grid repeat(5, 1fr)` — 200% × 320에서 「생각」「남기기」가 칸(47px)을 넘침 | 11-3 | `flex-wrap`(3 + 2로 접힘), ≥ 960px 자연 폭 | — |
| 7 | 프로필 `.facts 5.2rem 1fr`·식구 `.family-list 4.6rem 1fr` — 200%에서 값 칸 76px < 칩 90px | 11-7(컨테이너 rem) | 카드 컨테이너 `facts`, `≤ 12.5rem` 1열(글자 100%는 320에서도 2열 16rem) | `.profile`·`.family`를 컨테이너로 |
| 8 | 짧은 쌍이 맨 글자: 「… {N}명 · {이름}도 …」「{직업} · 건강함」「시간순 · …」「나의 기록 · …」「새 기록 N개 · …」 | 11-4(기호가 가장자리에 남지 않게) | 길이가 판마다 다른 둘은 `FitPair`, 나머지는 `Glue` | `ui/FitPair.tsx`·`ui/Glue.tsx` |
| 9 | 금액 「−1,200만 원」이 좁은 칸에서 「만 / 원」으로 갈림 가능 | 11-4 | `.nowrap` + `.assets__row { flex-wrap }`(금액이 이름 아래로, 오른쪽 정렬) | `core/glue.ts`가 금액을 숫자+단위로 못 묶는다 — `formatWon` 출력을 `.nowrap`으로 감싸거나 glue 규칙 확장 |
| 10 | 또래 칸(VP4) 라벨 `t-sm t-muted`가 길이에 따라 오른쪽/아래로 갈려 들쭉날쭉, 「요즘 모습」 inline style | VP4·일관성 | `.people__now` 항상 이름 묶음 아래 한 줄(굵게), `.card__sub` | 출생신고 `.people` 구조 재사용 + 라벨 한 줄 |
| 11 | 접이식 도움말 `summary` 32px | DB3(44px) | `min-height: var(--hit)` | — |
| 12 | 안쪽 스크롤 `.log__list`에 `scroll-padding` 없음 | 11-1 | `scroll-padding: var(--sp-3) 0` | — |
| 13 | 엔딩·밀린·오류 화면 공통 헤더(DS1) 시안 — 엔딩은 있었고 밀린·오류 화면은 없음 | DS1·QM3-6 | `system.html`(「저장 안내」) / `?state=error`(「오류」) — 문구는 현행 구현 그대로, h1은 메시지 | `SiteHead({ name })` + 옛 `<h1>수저 게임</h1>` 제거 |
| 14 | 수동 다크 토글 상태 표시 | R-136②·DB6 | 시안은 이미 켜짐 = `aria-pressed` + 해 아이콘 + 「켜짐」. **켜짐의 뜻**(지금 다크가 적용됨 — 시스템이든 수동이든, 이름은 늘 「다크 모드」)을 `copy.md`에 못 박음. 모바일 다크 샷 추가 | 상태값이 정한다 |
| 15 | 「대시보드 오른쪽 칸에서 요즘 모습을 볼 수 있습니다」(`peersNoteText`) — 360px 1열에서 또래 칸은 **맨 아래**, 「대시보드」는 화면에 없는 내부 이름 | QM3-3·DB1 | `copy.md`에 대체 문구 「살아가기를 누르면 「같은 해 태어난 사람들」 칸에서 요즘 모습을 볼 수 있습니다.」 | developer가 켤 때 상수 문구 교체(`src/data/birthReportText.ts`) |

맞았던 것(변경 없음): 헤더 로고 40px `logo-header.svg`(D-08 마크업 차이는 의도), Grade 칩 + `(구간)` 구조(`GradeLine`), 상태 바 4색·`role="meter"`·숫자 병기, 진행률 바 `role="progressbar"`, 자산 현황에 칩 없음(R-170), 외모 원점수 없음, 강제 색상의 눌림(Highlight + 이중 테두리)·바 채움 CanvasText·고정 줄/나의 기록 Canvas, 다크 토큰, 3열/1열 배치(DB1), 문구(copy.md) 일치.

## 4. 시안 ↔ 구현 전제

대시보드는 아직 구현 전이라 차이 표(D-번호)는 없다. 시안은 **구현된 부품을 그대로 쓰는 전제**로 그렸다: 헤더 로고 = `SiteHead`의 로고(인라인 SVG, D-08), 칩 = `GradeChip`(`<wbr>` 포함), 진행 줄 버튼 = `GuardedButton`(상수 키), 하단 띠 = `useBottomBar`, 짧은 쌍 = `FitPair`/`Glue`. M4 구현이 끝나면 `diff-003.md` 1절과 같은 표를 대시보드에 만든다(designer).

## 5. M4 developer에게 넘기는 메모

1. **R-251 e2e** 한 건: `colorScheme: 'light'` + `forcedColors: 'active'` + `<html data-theme='dark'>`에서 헤더 로고(`--c-logo`)·선택 카드 글자·포커스 링의 바탕 대비 ≥ 3:1(렌더 픽셀, `e2e/renderedContrast.ts`). 대조군: 선택자를 `:root`만으로 되돌린 CSS에서 실패.
2. **진행 줄 = 하단 띠**(< 960px): `useBottomBar(controlsRef)` — `.bottom-bar`가 아니어도 된다. `.page-end-space`, 강제 색상 `border-top`은 `ds.css` `@media (max-width: 959px)` 블록 그대로.
3. **헤더 해제 규칙(designer 제안)**: `--head-h` 관찰자 + `head-released`(헤더 + 고정된 띠 > 작은 뷰포트 50%). `watchBarRelease`에 옵션을 더하거나 형제 함수. e2e: 667×375·320×256에서 헤더가 static, 360×740에서 sticky, 포커스 가림 0(`auditFocus`는 sticky를 자동 수집).
4. **flex-wrap 세 곳**(헤더 첫 줄·진행 줄·도구 줄)과 **이름표 격자 컨테이너**(`facts` 12.5rem) — `ds.css` 대시보드 절을 그대로 옮기면 320 · 200%에서 넘침 0.
5. **금액**: `core/glue.ts`는 「1,200만 원」을 묶지 않는다 → `formatWon` 출력을 `.nowrap` 한 덩어리로(또는 glue 규칙 확장 + `tests/glue.test.ts`).
6. **또래 칸(VP4)**: `.people` 구조 재사용 + `.people__now` 항상 아래 한 줄. `DASHBOARD_PEERS_SHIPPED`를 켤 때 `peersNoteText` 둘째 문장을 `copy.md`의 대체 문구로(「오른쪽 칸」 금지 — 1열에서 틀림). 칩을 둘지는 6절 마스터 판단 뒤.
7. **공통 헤더**: 엔딩·밀린·오류 화면에 `SiteHead({ name: '엔딩' | '저장 안내' | '오류' })`, h1은 화면 메시지(문구는 현행 그대로). `system.html` 시안 참조.
8. **다크 모드 버튼**: 켜짐 = 지금 다크가 적용된 상태(시스템이든 수동이든), 이름은 늘 「다크 모드」, 누르면 반대 테마를 수동 저장.
9. **D-09 도장**: 64px 유지(판단 끝). **`formatReport` 머리글** 도장 예시 문구는 developer가 고친다(`diff-003.md` 4절 제안 문구).

## 6. 마스터 판단 요청

- 대시보드 또래 카드(VP4)에 **수저 칩**을 둘지 — 시안은 상태 라벨만(수저 이름 허용 자리 R-136① 밖). 칩이 있으면 「나이 × 수저 → 삶」 연결이 바로 읽히지만 허용 자리 확장 결정이라 designer가 정하지 않았다. 둘 다 구조 변경 없이 가능.
- 헤더 해제 규칙(3절 #3)은 designer 제안이다 — 다르게 정하면(예: 헤더를 애초에 sticky로 두지 않음) `ds.css` 두 줄과 11-1 한 단락만 바뀐다.

## 7. 점검 결과

| 명령 | 결과 |
|---|---|
| `npx vitest run tests/designAssets.test.ts` | **44/44 통과**(R-251 추가; R-190 열두 장 단독 사용 0 유지) — 변조 확인: 옛 선택자에서 R-251 1건 실패, 원복 뒤 통과(바이트 동일) |
| `npx vite-node scripts/checkContrast.ts --write` | 라이트 81쌍 + 다크 81쌍, 실패 0, 다크 블록 불일치 0 → `contrast-report.md` 재생성(수치 변화 없음) |
| `npx vite-node scripts/design/buildMockups.mjs` | 생성 완료(주인공 저장 검증·또래 시드 조건 통과), `system.html` 신설 |
| `npx vite-node scripts/design/shootMockups.mjs dashboard` | 첫 실행 320 · 200%에서 **넘침 18건**(도구 줄 5열·이름표 격자) → 고친 뒤 11장 저장, 넘침 0 |
| `npx vite-node scripts/design/shootMockups.mjs system` | 6장 저장, 넘침 0 |
| `npx vite-node scripts/design/shootMockups.mjs --check` | 320px 전수(시안 파일 × 주소 질의 × 라이트·다크, `system.html?state=error` 포함) 넘침 0 |
| `npm test` | **56파일 전부 통과**(vitest 목록 1961개 — `tokens.css` 선택자 변경에 걸리는 `contrast`·`legacyTheme`·`designAssets` 포함) |
| `npm run check:todo` | `[x]` 56개 대조: 파일 경로 821·심볼 387·npm 스크립트 25·따옴표 제목 791(제목-파일 짝 769) → **실패 0, 경고 0** |
| `npx vite-node scripts/design/shootMockups.mjs decision` / `note` | `dashboardPage()`를 같이 쓰는 카드 시안(M7b·M7c 몫이지만 헤더·진행 줄·끝 여백이 함께 바뀌므로) 재촬영, 넘침 0 |

눈으로 확인한 샷: `dashboard-adult-320-text200.png`(헤더 첫 줄 접힘, 도구 줄 3 + 2, 진행 줄 4줄), `dashboard-adult-low.png`(헤더 해제 — 프로필이 맨 위, 진행 줄만 고정), `dashboard-adult-mobile-dark.png`(「다크 모드」 켜짐: 색 반전 + 해 + 막대), `dashboard-adult-mobile-forced.png`(진행 줄 위끝 선, 눌림 Highlight), `dashboard-adult-desktop.png`(도구 줄 자연 폭 회귀 없음), `dashboard-adult-mobile-full.png`(또래 라벨 일관 배치, 가상 인구 줄 두 줄 모드), `system-superseded-mobile.png`·`system-error-mobile-dark.png`.

건드리지 않은 것: `src/`(tokens.css 제외)·`e2e/`·`qa/`·`docs/spec/`·`scripts/checkContrastLib.ts`(developer 파일)·다른 `tests/`.
