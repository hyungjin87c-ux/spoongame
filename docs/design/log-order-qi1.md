# 인생 기록 「새 기록 N개 · 맨 위로」 알약 — 자리·규격 (SPEC-005 QI1 LR2(c), REV-005-QI1-1 R-438 · 2026-10-20 designer)

최신순(SPEC-005 LR1)에서는 새 줄이 **맨 위**에 쌓이는데 구현(`spec-005` 53f15d4)의 「새 기록 N개 · 맨 위로」 버튼은 목록 **아래**에 있었다 — 1280×800에서 목록이 최대 높이이면 버튼이 접힘선 아래라 아래에서 읽는 사람은 버튼도 새 줄도 보지 못한다(R-438). 이 문서는 버튼의 **자리·크기·모양·동작**을 정한다. 문구는 `copy.md` 10절(R-437), 구현은 developer(`LogList.tsx`·`dash.css`), 시안 샷은 `screens/005/qi1-jump-*.png`. `src/`는 바꾸지 않았다.

## 0. 요약 (developer에게 넘기는 결정)

- **자리**: 스크롤 영역 `.log__list[role=region]` **안**, 목록 `ol.log__rows` **앞**에 두는 **높이 0의 sticky 슬롯**(`.log__jump-slot`) 안에 절대 배치 — 알약이 스크롤 영역 **위 가장자리에서 8px 아래, 가로 가운데**에 떠 있다(새 줄이 쌓이는 쪽).
- **밀지 않는다**: 슬롯 높이가 0이라 알약이 나타나고 사라질 때 줄이 1px도 움직이지 않는다(시안 측정: 보던 첫 줄 이동 **0px**, Chromium·WebKit). 목록의 `scrollHeight`도 변하지 않는다.
- **모양**: 지금 클래스 `btn btn--secondary btn--sm log__jump` 그대로(면 `--c-surface` + 2px `--c-border-strong` + 굵은 14px 글자) + **알약 모서리** `--r-pill` + `--shadow-2`(다크·강제 색상은 토큰이 `none` → 2px 테두리가 경계) + `display: block`(글자가 낱말 단위로 접힌다) + 안쪽 여백 8/16px → 글자 100%에서 **높이 37px**, 보이지 않는 `::before`로 **터치 대상 44px**.
- **동작·문구·로직 변경 없음**: `unread > 0`일 때만 렌더, 누르면 맨 위로 + 0, 직접 맨 위까지 올리면 사라짐. 누른 뒤 포커스를 영역으로 보내는 것(R-441)은 developer 몫 그대로.
- **아이콘 없음**: 「맨 위로」가 방향을 말한다. 새 자산 0, 전환·애니메이션 0(7절 — 나타남은 즉시, 움직임 줄이기에서도 같다).

## 1. 자리 후보 비교

| | 후보 | 밀지 않음 | 알약 위에서 휠·드래그 | 접근성 트리·Tab 순서 | 판정 |
|---|---|---|---|---|---|
| A | 목록 **아래** 보통 흐름(지금 구현) | 밀지 않음(아래라서) | — | 영역 → 버튼 | **버림** — 방향이 어긋나고 1280×800 최대 높이에서 접힘선 아래(R-438) |
| B | 카드 머리(제목 줄) 또는 고정 줄 `.log__pin` 옆 | **밈** — 머리 줄 높이가 바뀌어 목록 전체가 내려가고 보던 줄도 움직인다 | 문서 스크롤 | 제목 → 버튼 → 영역 | 버림 |
| C | 스크롤 영역 **밖** 절대 배치(`.log__view { position: relative }` 감싸기 + `position: absolute`) | 밀지 않음 | **문서**가 스크롤된다(알약이 스크롤 영역의 자손이 아니다) — 목록을 휠로 내리다 커서가 알약에 걸리면 페이지가 튄다 | 영역 → 버튼 | 버림 |
| **D** | 스크롤 영역 **안** 목록 앞의 **높이 0 sticky 슬롯** + 절대 배치 | 밀지 않음(측정 0px) | **목록**이 스크롤된다(자손) | 영역 → 버튼 → 줄(`ol`의 live region 밖) · 포커스가 가도 스크롤 점프 없음(늘 보이는 자리) | **채택** |
| E | 뷰포트 고정 `position: fixed` | 밀지 않음 | 문서 | 어느 열에 붙는지 모호, 다른 카드·헤더·하단 띠와 겹침 계산 필요 | 버림 |

- D의 한계(받아들임): 알약은 **목록의 스크롤포트**에 붙지 뷰포트에 붙지 않는다. 페이지를 내려 목록의 위 가장자리가 sticky 헤더 아래로 들어가면 알약도 함께 가린다 — 그때는 알약이 가리키는 최신 줄도 헤더 아래에 있고, 목록 높이 상한이 가용 높이(화면 − 고정 헤더 − 하단 띠)라 목록을 읽는 자세에서는 위 가장자리가 보인다. reviewer 조건(1280×800 페이지 스크롤 0에서 화면 안)과 1920×1080, 360×740(목록을 보이게 한 상태)에서 화면 안을 측정으로 확인했다(5절).
- 알약이 덮는 것: 영역 위 가장자리에 걸친 첫 줄의 일부(보던 줄 바로 위 — 대개 반쯤 지나간 줄). 떠 있는 동안만이고 누르거나 직접 맨 위로 올리면 사라진다.

## 2. 규격

| 항목 | 값 |
|---|---|
| DOM | `div.log__list[role=region][tabindex=0]` > **`div.log__jump-slot` > `button.btn.btn--secondary.btn--sm.log__jump[data-testid=log-jump]`** + `ol.log__rows[aria-live]`. 슬롯·버튼은 `unread > 0`일 때만(빈 슬롯은 높이 0이라 남아 있어도 무해하지만 함께 조건부 렌더를 권장) |
| 세로 자리 | 스크롤 영역 위 가장자리(스크롤포트 상단)에서 **`--sp-2` 8px** 아래. 스크롤 위치와 무관하게 같은 자리(sticky `top: 0`) |
| 가로 자리 | **가운데**(`left: --sp-2; right: --sp-2; width: fit-content; margin: 0 auto`) — 좌우 8px 안쪽, 글자가 길어도 영역 밖으로 나가지 않는다 |
| 높이 | 글자 14px(`--fs-sm`) × 줄 높이 1.2 + 안쪽 여백 8 + 8 + 테두리 2 + 2 = **37px**(글자 100%). 글자 200% 한 줄 70px, 두 줄(폭 320~360) 87~103px |
| 폭 | 「새 기록 3개 · 맨 위로」 170px(100%) · 글자 200% × 폭 360에서 278px(두 줄, 영역 294px 안) |
| 터치 대상 | `::before`가 위아래로 `(44 − 안쪽 상자 높이) / 2`씩 늘어난다 → **44px**(100%); 알약이 이미 44 이상이면 0(200%는 70px+). 폭은 170px 이상. 포인터 ≥ 24×24(WCAG 2.5.8)·거친 포인터 44(DB3·HS2 ⑤)를 함께 만족 |
| 글자 | `--fs-sm` 굵게 `--c-text`, 가운데 정렬, `Glue` 묶음 「{n}개 · 맨」(copy.md 10절 ②). `white-space: normal; word-break: keep-all; overflow-wrap: normal`(D-58 유지 — 낱말 안에서 끊지 않는다). **`display: block`** — `.btn`의 `inline-flex`를 풀어야 한다: 글자와 `Glue` span이 각각 flex 항목이 되어 글자 200%에서 세 칸이 따로 접혔다(시안 1회차에서 확인). block이면 「새 기록 12개 · 맨 / 위로」 낱말 단위 두 줄 |
| 면·테두리 | `--c-surface` + 2px `--c-border-strong`(`.btn--secondary` 그대로) — 라이트 테두리 4.02:1 · 다크 4.29:1(면 기준) |
| 모서리 | `--r-pill`(999px) |
| 그림자 | `--shadow-2`(라이트) · 다크 `none` · 강제 색상 `none`(모두 `tokens.css` 토큰 값 — 추가 규칙 없음) |
| 겹침 | 슬롯 `z-index: 1` — 줄·「나의 기록」 면 위, 고정 헤더(`--z-sticky` 10)·하단 띠(`--z-bar` 20)·시트(`--z-modal` 40) 아래. 스크롤 영역이 새 stacking context를 만들지 않으므로 값은 영역 안에서만 뜻이 있다 |
| 포커스 | 전역 `:focus-visible` 3px `--c-focus` 링(알약 바깥 2px, 둥근 모서리 따라). 라이트 5.87 · 다크 7.71 · 강제 색상 `Highlight`(샷 `qi1-jump-1280x800-forced-focus.png`) |
| 강제 색상 | `.btn` 공통 규칙(테두리 CanvasText, 면 Canvas, 글자 CanvasText, 그림자 없음) — 추가 규칙 없음. hover 규칙을 더하지 않는다(11-5절: 더하면 강제 색상 짝도 함께) |
| 움직임 | 전환·애니메이션 없음 — 나타남·사라짐 즉시. 「맨 위로」 이동은 기존(`smooth`, 움직임 줄이기 `instant`) |
| 글자 200% | 폭 320~360에서 두 줄, 폭 ≥ 640 한 줄. 넘침 0(문서·요소), 낱말 끊김 0 |

## 3. CSS — `src/styles/dash.css`에 넣을 글자 (`docs/design/mockups/ds.css`도 같은 글자, designer 후속)

옛 `.log__jump { align-self: center; margin-top: var(--sp-2); … }` 한 줄을 아래 세 규칙으로 **교체**한다(주석 포함).

```css
/* 「새 기록 N개 · 맨 위로」(SPEC-005 LR2(c), R-438 — docs/design/log-order-qi1.md): 스크롤 영역 안, 목록(ol) 앞의 높이 0 sticky 슬롯. 알약이 영역 위 가장자리(새 줄이 쌓이는 쪽)에 떠 있고,
   슬롯 높이가 0이라 나타나고 사라질 때 줄이 밀리지 않는다(보던 줄 이동 0px). 알약이 영역의 자손이라 그 위에서 휠·드래그하면 목록이 스크롤된다. 고정 헤더(--z-sticky)·하단 띠(--z-bar)보다는 아래 */
.log__jump-slot { position: sticky; top: 0; z-index: 1; height: 0; flex: none; overflow: visible; }
/* 알약: .btn의 inline-flex를 block으로 — 글자와 Glue 묶음이 flex 항목으로 갈라져 글자 200%에서 세 칸으로 접히는 것을 막는다(낱말 단위 두 줄 「새 기록 12개 · 맨 / 위로」, D-58 유지).
   min-height 0 — 보이는 알약은 내용 크기(100%에서 37px)이고 터치 대상 44px은 아래 ::before가 맡는다. left/right + fit-content + margin auto로 가운데(left: 50%만 쓰면 쓸 수 있는 폭이 절반이 되어 괜히 접힌다) */
.log__jump { position: absolute; top: var(--sp-2); left: var(--sp-2); right: var(--sp-2); width: fit-content; margin: 0 auto; display: block; min-height: 0; padding: var(--sp-2) var(--sp-4); border-radius: var(--r-pill); box-shadow: var(--shadow-2); white-space: normal; word-break: keep-all; overflow-wrap: normal; text-align: center; }
/* 보이지 않는 터치 대상: 안쪽 상자가 44px보다 낮으면 위아래로 (44 − 높이) / 2 씩 늘어난다(100%: 33 → 44). 이미 44 이상이면 0 */
.log__jump::before { content: ''; position: absolute; left: 0; right: 0; top: min(0px, calc((100% - var(--hit)) / 2)); bottom: min(0px, calc((100% - var(--hit)) / 2)); }
```

- `.log__list`는 그대로(`margin-top`·`max-height`·`scroll-padding`·`overscroll-behavior` 불변). 감싸는 상자가 필요 없다.
- `.log__rows > .log__row:last-child { border-bottom: 0 }`(가장 오래된 줄 아래 선 없음, LR3)은 `dash.css`에 이미 있다 — `ds.css`에는 없으니 designer 후속에서 함께 옮긴다.
- 다크·강제 색상 규칙을 더하지 않는다 — 그림자·테두리·면 모두 토큰이 이미 바꾼다(`--shadow-2: none`, `.btn { border-color: CanvasText }`).

## 4. 동작 (변경 없음 — developer 확인 항목)

- 렌더 조건 `unread > 0`, 누르면 `scrollTo({ top: 0 })`(움직임 줄이기 `instant`) → `unread` 0 → 알약 사라짐 → **포커스는 영역으로**(R-441, `focus({ preventScroll: true })`). 직접 맨 위까지 올리면(`isAtLogTop`) 사라짐.
- 알약이 스크롤 영역의 자손이라 알약 위의 `pointerdown`·`touchstart`·`keydown`이 영역의 `onUserScroll`(`following = false`)로 버블된 **뒤** `click`의 `jump`가 `following = true`로 둔다 — 순서상 충돌 없음(Enter는 keydown → click, Space는 keyup → click). 알약 위 휠·터치 드래그는 목록을 스크롤한다.
- 위치 보정(`LogList.getSnapshotBeforeUpdate`·`componentDidUpdate`)은 `ol.children`만 읽으므로 슬롯과 무관하고, 슬롯이 높이 0이라 `scrollHeight`·`addedAbove` 셈도 그대로다. 300줄 상한에서도 같다.
- 알약은 `aria-live`가 아니다(개수가 바뀔 때마다 읽지 않는다 — 줄 추가는 `ol`의 `polite` live가 알린다). 접근 가능한 이름 = 눈에 보이는 글자. 영역의 `aria-describedby="log-hint"`는 그대로.
- 키보드 순서: 도구 줄 → … → 인생 기록 영역(Tab) → **알약**(Tab, 있을 때만) → 다음 카드. 영역에서 Home = 맨 위(알약도 사라진다), End = 맨 아래.
- 화면이 좁아 하단 고정 진행 줄이 있을 때(< 960px): 알약은 목록의 위 가장자리라 띠와 겹치지 않는다(목록 높이 상한이 띠를 뺀 값, 측정 5절). 시트(결정·기록)가 떠 있으면 바깥이 `inert`라 알약도 닿지 않는다(기존 규칙).

## 5. 점검표 (시안 측정 2026-10-20 — Chromium 1248 · WebKit 2370, `dashboard-adult.html`에 3절 CSS와 DOM을 주입, 줄 23개를 최신순으로, 목록을 220px 내린 상태 = 지난 기록을 읽는 중)

| 화면 | 목록 상자(x, y, w, h) | 알약(w × h) · 영역 위 가장자리에서 | 터치 대상 | 화면 안 | 하단 띠·헤더 겹침 | 가로 넘침 | 나타날 때 보던 줄 이동 | 샷 |
|---|---|---|---|---|---|---|---|---|
| 1280×800 라이트, 페이지 스크롤 0 | 389, 298, 502, 470 | 170 × 37 · +8px | 44px | 안 | 없음 | 0 | 0px | `qi1-jump-1280x800.png`(95 KB) |
| 1920×1080 라이트, 페이지 스크롤 0 | 709, 298, 502, 750 | 170 × 37 · +8px | 44px | 안 | 없음 | 0 | 0px | `qi1-jump-1920x1080.png`(135 KB) |
| 360×740 라이트(DPR 2, 터치), 인생 기록 카드를 헤더 아래로 | 33, 234, 294, 495 | 170 × 37 · +8px | 44px | 안 | 하단 고정 진행 줄과 겹침 없음(띠 위끝 1255/2 = 627 > 알약 아래끝 279) | 0 | 0px | `qi1-jump-360x740.png`(102 KB) |
| 360×740 · 글자 200% · 새 기록 12개 | 33, 375, 294, 486 | 278 × 87(두 줄 「새 기록 12개 · 맨 / 위로」) · +8px | 83px(알약 자체) | 안 | 없음 | 0 | 0px | `qi1-jump-360x740-text200.png`(카드 요소 샷, 90 KB) |
| 1280×800 다크 | 389, 298, 502, 470 | 170 × 37 · +8px | 44px | 안 | 없음 | 0 | 0px | `qi1-jump-1280x800-dark.png`(카드 요소 샷, 31 KB — 그림자 없음·테두리 #7a8499) |
| 1280×800 강제 색상 + 키보드 포커스(영역에서 Tab) | 389, 274, 502, 470 | 170 × 37 · +8px | 44px | 안 | 없음 | 0 | 0px | `qi1-jump-1280x800-forced-focus.png`(카드 요소 샷, 26 KB — Canvas/CanvasText + Highlight 링, `:focus-visible` 참) |
| WebKit 1280×800(측정만) | — | 159 × 37 · +8px(스크롤 220·400 모두) | 44px | — | — | — | 0px | 산출물 없음 |

- 콘솔 오류 0 · 외부 요청 0(모든 샷). 샷의 추가 줄(21~30세 16줄)은 **시안 전용** 문장이다(게임 데이터 아님, 담담한 합쇼체).
- 글자 200% 두 줄은 `Glue` 묶음 「12개 · 맨」이 한 덩어리라 「·」가 줄 가장자리에 남지 않는다(11-4절). 안내 「최신순 · 아래로 / 스크롤하면 지난 기록」도 같은 방식으로 접힌다.
- 대비(토큰 쌍, `contrast-report.md` 값 + 다크 계산): 글자 15.81 / 13.17, 테두리 4.02 / 4.29, 포커스 링 5.87 / 7.71 — 알약이 「나의 기록」 면(`--c-accent-soft`) 위에 걸칠 때 테두리 대비는 라이트 3.37:1(≥ 3:1).

## 6. developer 반영 목록 (R-438)

1. `src/ui/dash/LogList.tsx` `render`: `.log__list` 안 `ol` **앞**에 `{jump}` 자리 — `LogCard`가 상태(`unread`)와 `jump`를 가지므로 알약을 `ReactNode` prop(예 `jump?: ReactNode`)으로 내려 `<div className="log__jump-slot">{jump}</div>`로 감싸거나, 슬롯까지 `LogCard`가 만들어 prop으로 넘긴다. 버튼 마크업·`data-testid="log-jump"`·`Glue` 글자는 그대로, `LogCard` 끝의 옛 버튼은 지운다.
2. `src/styles/dash.css`: 옛 `.log__jump` 규칙을 3절 세 규칙으로 교체.
3. e2e(REV-005-QI1-1 R-438 요구 + 이 문서): 1280×800 페이지 스크롤 0 · 목록 ≥ 200px 내림 · 새 줄 → `log-jump`가 **뷰포트 안이고 목록 상자 안(위 가장자리 + 8px ± 1)**, 나타날 때 보던 줄 이동 ≤ 2px(기존 LR2 단언이 잡는다), CM10 가림 0(`auditFocus` 상태에 알약이 떠 있는 상태를 더한다), 360×740에서 하단 고정 진행 줄과 겹침 0, 글자 200% × 320·360 넘침 0·낱말 끊김 0(`e2e/m7b-word-breaks.spec.ts` D-58 시험을 새 자리·새 글자 `DASH_TEXT.logJump(12)`로), 터치 대상 ≥ 44px(`::before` 포함 — `getComputedStyle(el, '::before')`의 top/bottom으로 계산), WebKit 설정(`playwright.webkit.config.ts`)에서도 같은 위치.
4. `tests/logOrder.test.tsx`의 CSS 규칙 단언을 새 규칙(`.log__jump-slot { position: sticky … height: 0 }`, `.log__jump { position: absolute … display: block }`, `::before`)으로.
5. designer 후속(구현 반영 뒤): `ds.css`에 같은 세 규칙 + `:last-child` 선 규칙, `buildMockups.mjs#logCard`를 최신순·`DASH_TEXT` import로 고쳐 `dashboard-*`·`note-rows` 시안 재생성, `tests/designAssets.test.ts` 「log__jump 낱말 보호」 단언(`overflow-wrap: normal`)은 새 규칙에도 맞다.
