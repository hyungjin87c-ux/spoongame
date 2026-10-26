# 2026-10-26 SPEC-005 dev — REV-005-B1-1 후속 (R-488~R-491·R-493, D5-76~D5-78)

- 누가: developer (`spec-005` 브랜치, 기준 `5fbac83`, 작업 트리는 깨끗하게 시작)
- 무엇을: 묶음 검수 `docs/review/REV-005-B1-1.md`(APPROVED)의 낮음 후속을 한 회차로 처리했다. v0.2.0 배포 전 마지막 개발 회차다. R-488(출처 기관 중복) · R-489(e2e-prod 기존 실패 2건, 배포 게이트) · R-490(기록 카드 ⑤⑥ 단언) · R-491(정보 패널 닫기 요청 겹침) · R-493(정보 패널 CSS, 디자이너 규격 D5-76) · D5-78(주석 11px → 12px) · D5-77(선택, 넣었다). R-492는 designer가 끝냈고 이번에 근거만 확인했다.
- 커밋: 하지 않았다(마스터가 한다). `SPEC`의 「안 할 것」은 건드리지 않았다: DOM·문구·클래스 불변, 저장 스키마 불변, 슬라이드 출처 줄 불변.
- 결과: 아래 9절. 지적 6건 모두 `docs/TODO.md`에서 `[x]`(근거 포함)로 바꿨고 `check:todo` 통과(경고 0).
- 다음 단계: QI8 최종 검수(변경분만, 마스터 결정 「고친 뒤 확인은 QI8」) → QA → 배포일 고침(`RELEASE_NOTES` 날짜) → main 병합.

## 1. R-488 — 같은 기관은 현재 이름으로 한 번만

원인: 푸터 출처 줄과 소개 Q3는 같은 목록(`CarouselData.orgs`)을 쓰는데, 공식 전망 5장의 `source.org`가 발행 당시 이름 「통계청(현 국가데이터처)」라 「국가데이터처」와 따로 모였다(7곳).

- **규칙 한 곳**: `src/core/slideKit.ts#currentOrgName` — 「…(현 X)」로 끝나는 이름만 X로 바꾼다. 「기상청(국립기상과학원)」처럼 괄호가 소속 기관을 알리는 이름은 그대로. `src/core/carousel.ts`가 같은 이름으로 다시 내보낸다.
- **쓰는 곳**: `src/core/carousel.ts#buildCarousel`이 기관 이름을 모을 때 한 번만 거친다. 푸터(`TitleScreen`의 `footerStatsText(data.orgs)`)와 소개 Q3(`buildAboutFaq({ orgs: data.orgs })`)가 같은 목록을 쓰므로 세 곳(`carousel.ts:696-701`, `TitleScreen.tsx:504-506`, `aboutFaq.ts:115`)이 코드 수정 없이 함께 고쳐진다. 결과: 「국가데이터처, 한국은행, 금융감독원, 행정안전부, 교육부, 기상청(국립기상과학원)」 6곳.
- **슬라이드 출처 줄은 그대로**: `sourceTextOf`는 건드리지 않았다(마스터 결정 3). 시험이 「통계청(현 국가데이터처)의 KOSIS 장래인구추계…」가 남아 있음을 단언한다.
- **시험(규칙을 한 곳에서 묶음)**: `tests/carousel.test.ts` "R-488 기관 이름 정규화(currentOrgName 한 곳)" — 함수 단위(5꼴), 데이터 전체 대조(슬라이드 기관 → `currentOrgName` → 중복 제거한 목록이 `data.orgs`와 같고 정확히 6곳), 어느 이름도 다른 이름 안에 들어 있지 않음, 전망 5장의 출처 줄은 발행 당시 이름 그대로. `tests/aboutFaq.test.ts` Q3: 실제 목록으로 만든 문장에서 「국가데이터처」가 한 번이고 「통계청」이 없다(푸터 문장도 한 번).
- **글자를 굳힌 시험 셋** (바꾼 단언, 모두 R-488 주석 달음):

| 파일 | 옛 단언 | 새 단언 | 이유 |
|---|---|---|---|
| `tests/glue.test.ts` "실제 푸터" | `…교육부, 통계청(현 국가데이터처), 기상청(국립기상과학원) (…)` | `…교육부, 기상청(국립기상과학원) (…)` + 「통계청」 없음 | 같은 기관이 두 번 나오던 결함의 기대 글자였다 |
| `tests/titleScreen.test.tsx` "푸터 통계 출처 줄은 쉼표 나열이다" | 같은 7곳 글자 | 같은 6곳 글자 + 「통계청」 없음 | glue 시험과 같은 글자 |
| `tests/carousel.test.ts` "출처 기관: 국가데이터처·행정안전부·교육부 등" | 목록에 `통계청(현 국가데이터처)`가 따로 있음 | 한국은행·금융감독원·기상청만 포함, 「국가데이터처」 정확히 1, 「통계청」·「(현 」 없음 | 옛 단언이 결함을 굳혀 두었다 |

- **변이 점검**: `currentOrgName`을 항등으로 바꾸면(정규화 빼기) 5건 실패(aboutFaq Q3, carousel 2건, glue 실제 푸터, titleScreen 푸터). 원상 복구 후 통과.

## 2. R-489 — e2e-prod 기존 실패 2건 (시험 쪽 수정, 배포 게이트)

### 2-1. 사망까지 선택 수 18 ≠ 25 (`e2e-prod/smoke.spec.ts` "…사망(엔딩 화면)까지 가고…")
- **정의 확인**: 엔딩의 「살아오며 N번의 선택」(`src/data/endingText.ts#choiceCountText`)의 N은 `src/core/ending.ts#reviewEnding`의 `choiceCount` = 연표의 `kind === 'choice'` 줄 중 **`by`가 없는 것(본인이 고른 선택)**이다. 부모님이 정한(`by: 'parent'`)·아이의 일로 흘러간(`by: 'child'`) 줄은 세지 않고 따로 「어린 시절의 큰 결정 가운데 M번은 부모님이 내렸고…」 줄(`ending-delegated`)에서 센다. 이 시험이 누르는 선택지 버튼 수(`choices` = 18)도 본인이 고른 것이다. 옛 단언은 `kind === 'choice'` 전부(25 = 18 + 부모·흘러감 7)를 `choices`와 비교했다 — QI5 이전에는 `by` 줄이 없어 맞았다.
- **고친 것**: 선택 줄을 본인(`by` 없음)·부모님·흘러감 셋으로 나눠, 본인 수만 `choices`와 비교하고 셋의 합이 전체와 같음을 단언한다. 엔딩 화면은 `timeline-picked`를 `data-by`별로(없음/parent/child) 세고, `ending-choices` 문장이 「살아오며 ${본인 수}번의 선택을 했습니다.」임을 단언한다. 부모·흘러감 줄이 있으면 `ending-delegated`가 보이고 없으면 줄이 없다. 옛 단언 `timeline-picked` 개수 = `choices`도 같은 이유로 갈랐다.
- 코드는 건드리지 않았다(제품 동작이 맞고 시험이 옛 정의였다).

### 2-2. `@supports (height: clamp(…))` (`e2e-prod/smoke.spec.ts` "제품 번들 CSS(M3, R-302)…")
- **원인**: `tests/helpers/browserCss.ts#evaluateSupports`의 정규식이 값 안에 괄호가 있으면 「지원하지 않는 @supports 조건」으로 던졌다. QI3가 넣은 `title.css`의 낮은 창 그림 높이 규칙(`@supports (height: clamp(1px, 2px, 3px))`)을 번들 걸러내기가 처음 만났다.
- **고친 것**: 값에서 함수 호출 한 겹(`(?:[^()]|\([^()]*\))+?`)을 값의 일부로 읽는다. 조건 둘(`and`)·함수 두 겹은 여전히 던진다(조용히 틀리지 않게). 컨테이너 질의를 모르는 브라우저도 `clamp()`는 안다(Safari 13.1+) → 참. 함수 안에 컨테이너 단위가 있으면(`calc(1cqi + 2px)`) 모르는 브라우저는 거짓.
- **시험**: `tests/docCssFallback.test.ts` "R-489 @supports 값 안의 함수 호출"(참·거짓·`not`·던지는 꼴), "R-489 실제 소스 CSS"(`title.css` 전체를 두 브라우저로 걸러도 던지지 않고 clamp 규칙이 올라옴 — 공허 통과 방지).

## 3. R-490 — 기록 카드 ⑤⑥이 가려지지 않는다는 단언

⑤ = `note-illness`, ⑥ = `note-parents-aging`(`src/data/notes.json` order 5·6). 기록 시트(`NoteSheet`)는 `gentle`을 받지 않아 구조상 가려질 수 없지만, 이를 단언하는 시험이 없었다.

- **단위** `tests/gentleScreens.test.tsx` "인생 화면: 식구 카드의 상태 문구·…·기록 카드 ⑤⑥·결정자 표지가 켠 상태에서도 그대로다": `renderLife`에 `noteSheet` 옵션을 더해, 결정 카드가 없는 판(`pending: null`)에 두 카드의 시트를 가림 켬·끔으로 그린다. 시트 마크업 전체가 같고, 질문 글(`noteQuestion`)이 보이며(스크린리더 기준 포함), 제목이 `h2#nc-title[data-testid=note-title]`이고, 가림 부품(`veil`·`data-veiled`)과 분류 문구(「무거운 일이 있었습니다」「무거운 주제」)가 없다.
- **e2e** `e2e/gentle.spec.ts` "…기록 카드 ⑤⑥ 시트는 가려지지 않는다": 새 도우미 `e2e/gentleStates.ts#noteDueState`가 카드가 뜰 차례가 되는 해의 일시정지한 판을 만든다(앞서 뜰 차례가 된 다른 카드는 소비해 넘긴다). 같은 판을 가림 꺼짐 → 켜짐 설정으로 각각 열어 질문 글이 core의 `noteQuestion`과 같고, 시트 안에 가림 부품이 없고, 대화상자 접근성 트리(이름 포함)가 켜짐과 꺼짐에서 같음을 단언한다. 제목이 말하는 것을 같은 시험 안에서 단언하므로 `docs/TODO.md` HV8 줄의 인용(두 시험 제목)은 그대로 맞는다.
- **변이 점검**: `LifeScreen`이 `cardsOn`을 가림 설정에 묶도록 바꾸면 단위 시험이 「켠 시트 = 끈 시트」에서 실패. 복구 후 통과.

## 4. R-491 — 정보 패널 닫기 요청 겹침

- **원인**: `history.back()`은 비동기라 popstate가 오기 전에는 현재 항목에 표식이 그대로 있다. 「닫기」 더블클릭·Esc 연타로 요청이 겹치면 표식만 보고 `back()`을 또 불러 두 걸음 뒤로 갔다.
- **고친 것** (`src/ui/infoPanelHistory.ts`): 닫는 중임을 `closing` ref로 표시한다. 처분은 순수 함수 `decideCloseRequest(closing, marked)`(`ignore`/`back`/`close`)로 뺐고, `back` 처분 때 `closing`을 켠 뒤 `history.back()`을 부르며, popstate와 보호 시간 콜백에서 푼다. 「닫기」 버튼(`InfoPanel.tsx:67`)과 Esc가 같은 요청 함수를 지나므로 `InfoPanel.tsx`는 바꾸지 않았다.
- **단위** `tests/infoPanel.test.tsx`: "R-491 decideCloseRequest"(진리표), "R-491 소스"(훅이 `decideCloseRequest(closing.current, marked)`를 거치고, `closing`을 켠 다음에 `back()`을 부르고, 풀림이 둘이며, 버튼·Esc가 같은 `close`를 씀).
- **e2e** `e2e/info-panel.spec.ts` "닫기 요청이 겹쳐도 history는 한 걸음만 되돌아간다 (R-491)": 겹침 다섯 가지(「닫기」 더블클릭 · 같은 작업 안에서 두 번 `click()` · Esc 키 두 번 · 같은 작업 안에서 Esc 이벤트 두 번 · 「닫기」+Esc 섞어) × 「새 소식」·「소개」 = 10건. 열기 전 history에 `/?before-panel` 항목을 두어 두 걸음 뒤가 눈에 보이게 했다(주소가 바뀌고 창에 심은 표시가 사라진다). 닫은 뒤 900ms를 기다려(보호 시간 500ms보다 길게) 주소가 `/` 그대로이고 같은 문서가 살아 있으며 첫 화면이 보이고 열림 표식이 걷혔는지, 포커스가 열었던 링크로 돌아왔는지, 다시 열고 한 번 닫아도 같은지를 본다.
- **변이 점검**: 고치기 전 `infoPanelHistory.ts`로 되돌리면 mobile-360에서 10건 중 8건 실패(주소가 `http://localhost:5199/?before-panel`). 사람 속도 Esc 키 두 번 2건은 popstate가 둘 사이에 도착해 통과 — 같은 작업 안에서 겹치는 변형이 이 결함을 확실히 잡는다. 고친 뒤 Chromium 2프로젝트 20건 통과(WebKit은 9절).

## 5. R-493 — 정보 패널 CSS (D5-76) + D5-77 판단

- **D5-76**: `src/styles/title.css`의 「새 소식과 소개 패널」 블록(513~545행)을 `docs/design/mockups/ds.css`의 같은 이름 r2 블록(1114~1152행)으로 통째로 바꿨다. 선언 ①~⑦(구역 간격 0·머리/리드 margin, 구분줄을 행과 같은 너비로, 테두리·모서리·면 제거와 `+` 구분줄, summary 패딩/모서리/hover 면, 항목 패딩, `.note-kind`의 테두리·패딩 제거와 `min-width: 2.5em`, 강제 색상 구분줄)이 모두 들어갔고 본문 선언은 시안과 글자 그대로 같다(diff 0). 머리 주석의 「구현 title.css에 같은 글자로」만 구현 표현으로 고쳤다(문서가 허용). DOM·문구·클래스는 바꾸지 않았다(`tests/infoPanel.test.tsx`·`e2e/info-panel.spec.ts:46` 그대로 통과).
- **부수 단언 하나를 고쳤다**: `tests/barRelease.test.ts`가 첫 화면 CSS의 `:hover` 글자 수를 4로 박아 두고 「새 hover 규칙이 생기면 강제 색상 짝도 정하라고 알린다」는 경보 역할을 한다. 새 규칙 `summary:hover`(선택자 둘)가 2를 더해 6이 됐다. 이 규칙은 배경만 바꾸고 글자색을 정하지 않아 강제 색상에서 UA가 배경을 지워도 글자가 사라지지 않는다 — 그래서 강제 색상 블록에 짝을 더하지 않고 숫자를 4 → 6으로 바꾸며 이유를 R-493 주석으로 달았다. 새 규칙의 글자 `{ background: var(--c-surface-2); }`를 못 박는 단언을 더했다(글자색 선언이 붙으면 실패).
- **D5-77 (선택) — 넣었다**. 판단: 이번 변경은 「상자를 걷어도 누를 수 있다는 표시가 남는다」는 접근성 약속(1.4.11 경계를 상자 대신 꺾쇠·44px 행·포커스 링이 맡는다는 설계)에 기대고 있는데, 기존 e2e는 320 글자 200% 넘침만 본다. 강제 색상·다크·44px 행·포커스 링은 어느 시험도 보지 않아 나중에 CSS를 만져도 알 수 없다. 비용은 파일 하나에 시험 4건이고 CSS 안정도 높아 흔들릴 위험이 낮아 넣는 쪽이 이득이라고 판단했다. 색은 값을 박지 않고 토큰(`--c-border`·`--c-text-2`·`--c-surface-2`)을 화면에서 풀어 비교하므로 라이트·다크 모두 같은 단언이다. 내용: `e2e/info-panel.spec.ts` "한 줄 구분 목록 (R-493·D5-77)" 4건 — ① 버전 2·질문 10·종류 칸에 네 변 테두리 상자 0, 구분줄은 행 사이에만(첫 행 없음, 다른 변 테두리 0, 색 `--c-border`) ② 꺾쇠 2px·`--c-text-2`, 행 44px 이상, hover 면 `--c-surface-2`(평소 투명), 키보드 포커스 링 3px 실선 ③ 다크에서 구분줄·꺾쇠가 다크 토큰이고 라이트와 다름 ④ 강제 색상에서 구분줄·꺾쇠 CanvasText, 행 44px 이상.
- **변이 점검**: 옛 r1 CSS(`git show HEAD:src/styles/title.css`)로 되돌리면 상자 28개로 실패(「테두리 상자는 0」 기대 0, 받은 값 28 — 검수가 센 수와 같다).
- design-taste 전·후 inspect·lint 기록은 designer 로그 `ai-log/2026-10-21_SPEC-005_design-R492-R493.md`에 있다(이번 회차에서 시안을 그대로 옮겼으므로 새 판단 없음).
- 초기 로드: 아래 9절(+147~154 B).

## 6. R-492 확인 + D5-78

- R-492 근거 확인: `docs/review/REV-005-B1-1.md` 끝 「반영 내역 (designer…)」 표의 R-492 행(`split-label`·`range-label` 11px → 12px, 15-2 「첫 값 글자 자리」 행 재작성, 시안 푸터 링크 블록 정합)과 `docs/design/design-system.md` 15-2가 실재한다. 남은 몫은 developer D5-78이었다.
- **D5-78**: `src/core/carousel.ts:99`의 `range`·`split` 글자 주석 「11px」 둘과 `tests/slideForms.test.ts:101`의 시험 제목 「11px 연한 글씨」를 12px로 고쳤다(글자만, 값 단언 없음).

## 7. 바꾼 기존 단언·시험 요약

| 위치 | 바꾼 것 | 이유 |
|---|---|---|
| `tests/glue.test.ts` "실제 푸터", `tests/titleScreen.test.tsx` "푸터 통계 출처 줄은…", `tests/carousel.test.ts` "출처 기관…" | 7곳 글자 → 6곳(통계청 병기 제거) | R-488(1절 표) |
| `e2e-prod/smoke.spec.ts` "…사망(엔딩 화면)까지 가고…" | 선택 줄 `kind==='choice'` 전부 = `choices` → `by` 없는 줄만 = `choices` + 부모·흘러감 따로 | R-489(2-1절). 정의는 `reviewEnding.choiceCount`와 같게 |
| `tests/barRelease.test.ts` "주 버튼의 hover·active·…" | `:hover` 글자 수 4 → 6 | R-493(5절). 글자색을 바꾸지 않는 hover 면 |
| `tests/slideForms.test.ts:101` 제목, `src/core/carousel.ts:99` 주석 | 11px → 12px | D5-78(6절) |

시험을 약하게 만든 것은 없다: 바꾼 단언은 모두 같은 일을 더 정확한 정의로 본다(기관 중복 없음 단언은 늘었다).

## 8. 변이 점검 한눈에

| 지적 | 변이 | 결과 |
|---|---|---|
| R-488 | `currentOrgName`을 항등으로 | 5건 실패 → 복구 후 통과 |
| R-490 | `LifeScreen`의 `cardsOn`을 가림 설정에 묶기 | 단위 "켠 시트 = 끈 시트" 실패 → 복구 후 통과 |
| R-491 | 고치기 전 `infoPanelHistory.ts` | e2e mobile-360 10건 중 8건 실패 → 복구 후 20건 통과 |
| R-493 | 옛 r1 CSS | e2e 3건 실패(테두리 상자 28, 둥근 모서리, 구분줄) → 복구 후 통과 |

## 9. 확인 결과

| 항목 | 결과 |
|---|---|
| 단위 `npm test` | **3858 통과 · 1 건너뜀**(127 파일). 기준 3853 + 새 시험 5(`tests/carousel.test.ts` 1, `tests/docCssFallback.test.ts` 2, `tests/infoPanel.test.tsx` 2). 기존 시험 안에 단언을 더한 곳: `tests/gentleScreens.test.tsx`(R-490), `tests/aboutFaq.test.ts`(R-488), `tests/barRelease.test.ts`(R-493) |
| 타입 검사 · 데이터 점검 | `npm run typecheck` 통과 · `check:events` 통과(이벤트 140개) · `check:basis` 일치 2건 · `check:dist` 통과 · `check:todo` 통과(경고 0) |
| 빌드 | `npm run build` 통과 — JS 809.62 kB(gzip 283.80), CSS 78.35 kB(gzip 14.31) |
| 초기 로드 (`e2e-prod/initial-load.spec.ts`, 한도 400,000 B) | Chromium PC **365,083** · 모바일 **333,617** / WebKit PC **368,301** · 모바일 **336,836**. QI4 2단계 기준(364,936 · 333,470 / 368,148 · 336,682) 대비 +147~154 B(`currentOrgName`·`decideCloseRequest`·CSS 한 블록). 모두 요청 4개(HTML·CSS·JS·그림 한 장) |
| e2e Chromium 전체 (`playwright.config.ts`, mobile-360 + desktop) | **3428 통과 · 2674 건너뜀(프로젝트 필터) · 0 실패**, 52.3분, 작업자 기본 7개. 개발 서버(5199)를 먼저 띄워 브라우저로 데운 뒤 돌렸다. 부하성 시간 초과 없음. 이 실행 뒤 `info-panel.spec.ts`의 더블클릭 포커스 단언을 고쳐(아래 WebKit 줄) `info-panel`+`gentle` 108건을 다시 돌려 모두 통과 |
| e2e WebKit 전체 (`playwright.webkit.config.ts`) | 첫 실행 234 통과 · 4 실패, 둘째 237 통과 · 1 실패, **셋째 238 통과 · 60 건너뜀 · 0 실패**(5.9분). 앞의 실패는 모두 내가 새로 쓴 R-491 시험의 「닫기 더블클릭」 변형 하나가 포커스 위치를 단언한 것이다 — 사람의 더블클릭은 첫 클릭으로 패널이 걷힌 뒤 둘째 클릭이 「닫기」 자리 뒤의 요소(캐러셀 뷰포트 또는 빈 바탕)에 떨어져 포커스를 가져간다(WebKit에서 그렇고 앱의 잘못이 아니다). 주소·같은 문서·첫 화면·표식 걷힘 단언은 처음부터 통과했다. 그 변형에서는 포커스를 보지 않게 고쳤고(키보드·같은 작업 안 변형은 링크로 돌아오는 것을 그대로 단언), R-491 20건 3회 반복 60/60 통과 후 전체를 다시 돌렸다 |
| e2e-prod (`npm run e2e:prod` = 빌드 + `playwright.prod.config.ts`) | **21 통과 · 1 건너뜀**(DP8 배포 주소 확인 — `DEPLOY_URL`·`DEPLOY_COMMIT`이 있을 때만) · 1.9분. 고치기 전 실패 2건("…사망(엔딩 화면)까지 가고…" 53.8초, "제품 번들 CSS(M3, R-302)…")이 통과 |
| 뒷정리 | 이번 실행이 덮어쓴 `qa/screenshots`는 `git checkout -- qa/screenshots`로 되돌렸고, 새로 생긴 증거 PNG 6장은 지웠다. 직접 띄운 개발 서버 둘(5199·5198)은 PID로 끄고(`taskkill /PID … /T`) 세 포트 모두 비었음을 확인했다. 데우기용 임시 스크립트는 지웠다 |

## 10. 마스터가 정할 것

1. **커밋·푸시**는 마스터가 한다(이번 회차는 커밋하지 않았다). 푸시 전 `check:motifs`·경로·줄바꿈 점검(메모리 「Push checklist」)은 마스터 몫 — 이번에 사용자에게 보이는 글의 새 소재는 없다(푸터 기관 줄에서 한 곳이 줄었을 뿐).
2. **QI8에 남은 일**(이번 회차 범위 밖): v0.2.0 첫 노트의 날짜(`src/data/releaseNotes.ts`, 임시 2026-10-21)를 main 배포일로 고치는 것, FAQ Q3 전망 분기·`getUsableIndicator('suicide-rate')` 상담전화 안내 확인. 고친 R-488~R-493의 확인은 마스터 결정대로 QI8 최종 검수(변경분만)에서 한다.
3. **D5-77을 넣었다**(`e2e/info-panel.spec.ts` "한 줄 구분 목록 (R-493·D5-77)" 4건) — 선택 사항이었으므로 판단 이유는 5절에 적었다. 시험 4건이 부담스러우면 그 describe만 지우면 된다(다른 시험은 의존하지 않는다).
4. **`tests/barRelease.test.ts`의 `:hover` 글자 수 4 → 6**: 새 hover 면 규칙(디자이너 시안 그대로)은 배경만 바꾸고 강제 색상 짝을 따로 두지 않는다(디자이너 시안 주석: 강제 색상이 지우므로). 이 판단에 이의가 있으면 designer에게 확인.
5. **푸터 기관 줄의 「기상청(국립기상과학원)」**은 같은 기관의 옛 이름이 아니라 소속 기관 표기라 그대로 둔다(정규화 규칙은 「(현 …)」 꼴만). 「기상청」 한 단어로 줄이려면 데이터 `source.org` 표기 정리가 필요하다(범위 밖, 필요하면 후속).
6. 관찰(ID 없음): 사람이 「닫기」를 더블클릭하면 둘째 클릭이 패널 뒤 요소에 떨어져 그 요소가 포커스를 가진다(WebKit 확인). 브라우저 기본 동작이라 지적 대상은 아니다.
