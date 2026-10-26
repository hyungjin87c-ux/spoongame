# 구현 ↔ 시안 차이 목록 (SPEC-004, designer) — GM3 시안이 지금 구현(`spec-004` 기준 커밋 `794aa4b`의 `src/`)과 달라지는 점

2026-10-27 GM3(세대 선택 · 연도 릴 룰렛 · 연표 줄 4종 · 당시 화폐 · 엔딩 세대 표기)에서 시작한다. `diff-005.md`와 같은 규칙: 상태 열 「시안 제안」 = **형진 님 확인(게이트 ③) 뒤** developer가 GM4(세대 선택·연도·시도 코어)·GM6(연표 줄)·GM10(당시 화폐)·GM9(전망 표시)에서 구현 / 「의도」 = 정적 시안의 한계라 그대로 둔다 / 「결정 필요」 = 형진 님 또는 마스터. ID는 `D4-NN`. 지금 구현의 근거는 `src/screens/TitleScreen.tsx`·`RouletteScreen.tsx`·`LifeScreen.tsx`·`EndingScreen.tsx`, `src/ui/Reel.tsx`·`dash/LogList.tsx`·`dash/Cards.tsx`·`dash/FinalNet.tsx`, `src/data/titleText.ts`·`birthReportText.ts`·`dashText.ts`, `src/styles/title.css`·`doc.css`·`dash.css`, 시안은 `docs/design/mockups/gm3/*.html` + `gm3.css`(생성 `scripts/design/buildGm3Mockups.mjs`) → `docs/design/screens/004/gm3-*`. 문구 `copy.md` 16절, 규격 `design-system.md` 17절.

**`src/`는 읽기만 했다.** 시안 CSS는 `ds.css`·`title-005.css`를 건드리지 않고 `gm3.css`에 따로 두었다(형진 님 확인 전) — 확인 뒤 developer가 블록별로 `title.css`·`doc.css`·`dash.css`로 옮기고 `ds.css`에도 같은 블록을 합친다. 시안 생성기의 `GM3_TEXT` 임시 블록은 구현이 상수(`titleText.ts`·`birthReportText.ts`·`dashText.ts`·`endingText.ts`)를 만들면 import로 되돌린다(R-191).

## 1. 첫 화면 — 세대 선택 (GS1~GS4·GS10 · `title-004.html`)

| ID | 곳 | 지금 구현 | 시안 | 상태 · 근거 |
|---|---|---|---|---|
| D4-01 | 큰 슬롯 | 「태어날 세상」 라디오 카드 3장(`era`), 2026년생 「지금 세상」 기본 선택 | 질문 「어느 세대로 살아보고 싶으세요?」 + 안내 한 줄 + 라디오 카드 **7장**(`generation`, id = GD1 7종) + 「랜덤 세대」 **버튼** + 접이식 설명. 「지금 세상」「다가올 세상」 없음. 처음 방문의 기본 선택은 **N15**(시안은 X세대 선택 상태를 보일 뿐) | 시안 제안(GM4). 문구 `copy.md` 16-1. `TITLE_TEXT`·`LIFE_LENGTH_TEXT` 옆에 `GENERATION_CARD_TEXT`(이름·범위·소개·보조 줄) — 소개 문장은 `GENERATION_EVAL_WORDS` lint 대상(GD6) |
| D4-02 | 부제 | `heroTagLead`/`heroTagKeep` 「태어난 집에 따라 달라지는, 한국인의 한 번의 인생」 | **「다른 세대, 다른 삶, 같은 대한민국」**(「같은 대한민국」 `nowrap`) | 시안 제안 — 형진 님 결정(2026-10-20, 세대 선택이 들어갈 때). `tests/titleScreen.test.tsx`·`e2e/first-screen.spec.ts`의 부제 단언 갱신 |
| D4-03 | 카드 구조 | compact 카드(제목 옆 메타, 아래 소개) | `.radio-card--gen`: 세 줄(이름 + 「살아봄」 / 짧은 쌍 「{범위}년생 · 올해 {나이}」 / 소개), 카드 컨테이너 쌍 문턱 14em, 알파 보조 줄 | 시안 제안. `design-system.md` 17-1. 「올해 N~M세」는 2026 − 범위(`LAST_ACTUAL_YEAR + 1`이 아니라 **현재 해 상수** — 해가 바뀌면 developer가 올린다, SPEC Q1 방식) |
| D4-04 | 살아본 세대 표시(GS10 ▲) | 없음 | 알약 「살아봄」(체크 + 글자, 이 기기의 설정 키 — 끝까지 산 세대 집합), 접근 가능한 이름 꼬리 「, 살아봄」 | **결정 필요(마스터 — N15와 함께, 선택 항목 ▲)**. 저장 키 이름·설정 버전은 MG1 |
| D4-05 | 「랜덤 세대」 기억(GS4) | — | 마지막 선택이 랜덤이면 버튼 `.is-selected` + `aria-pressed="true"`(실선 3px 쪽빛 + 반전 표식), 카드 라디오는 모두 미선택 | 시안 제안. 카드를 고르면 버튼의 pressed가 풀린다(시안 스크립트와 같은 동작) |
| D4-06 | 접이식 설명(GS2) | — | `details.disclosure.slot__fold` 「세대 범위는 자료마다 조금씩 달라요」 + 본문 세 문장 | 시안 제안 |
| D4-07 | 분절 컨트롤 공통 | `.seg`(인생 길이) — 320 · 글자 200%에서 「약 30분」「준비 중」이 낱말 안에서 끊김(시안 측정) | `.seg { flex-wrap: wrap }` + `.seg__opt { white-space: nowrap }` — 칸 단위로 줄이 바뀐다 | 시안 제안(SPEC-005 부품의 보정 — `title.css`에 두 줄). e2e `line-breaks` 320 · 200% 통과 확인 |
| D4-08 | 태어나는 시도(RG1·RG2) | 없음(지역은 룰렛만) | `.slots-bottom`의 인생 길이 아래 새 묶음 「태어나는 시도」: 분절 「룰렛에 맡기기(기본) / 직접 고르기」 + 안내 → 직접 고르기면 칩 묶음(`role=radiogroup`, 현행 16 시·도 줄임 이름, 44px 누르는 영역) + 고를 수 없는 시·도 점선·`aria-disabled` + 이유 한 줄(쉼표 나열) + (설정이 있으면) 맨 앞 「내 출신 시도 · {시도}」 바로가기 칩 | 시안 제안(GM4). 고를 수 없는 목록은 **DC7 연혁 표**(`regionNames.ts` 연혁 구간 × 세대 범위)로 계산 — 시안은 세종만. 확정(태어나기) 뒤 변경 불가(RG1) |
| D4-09 | 내 출신 시도 설정(RG3) | 없음 | 설정 줄의 접이식 「내가 실제로 태어난 시도 (밝히지 않음)」 → `select` 16 시·도 + 「지우기」 + 개인정보 한 줄 | 시안 제안(GM4). **이 기기의 설정 키 하나**에만(게임 저장 `GameState`·`buildFeedbackUrl`·콘솔·공유 문구에 넣지 않음), 「지우기」는 키 삭제. 설정 새 버전은 MG1(`READABLE_SETTINGS_VERSIONS`·`index.html` 동기) |
| D4-10 | 1280×800 세로 | 3장 — 왼쪽 열 끝 655 < 띠 732 | 7장 + 랜덤 + 접이식 + 시도 묶음 — 왼쪽 열 끝 **1136**(스크롤 404). 오른쪽 열 HS3 ④는 그대로 | **결정 필요(마스터)** — 받아들일지(CM10 `scroll-padding`으로 포커스는 안 가린다), 아니면 ≥ 1280에서 카드 소개를 숨기고 선택된 카드에만 보일지(밀도 ↓), 큰 슬롯을 3열로(소개가 3줄이 되어 더 높아진다 — 권하지 않음) |

## 2. 룰렛 (GS3·GS6·GS7·RG2 d · `roulette-004.html`)

| ID | 곳 | 지금 구현 | 시안 | 상태 · 근거 |
|---|---|---|---|---|
| D4-11 | 세대 뽑기 단계(GS3, N3) | 없음 | 「랜덤 세대」 경로에만: 제목 「어느 세대로 살아볼지 뽑는 중」 + 상태 줄 + 세대 릴 하나(칸 = 이름 + 범위, `.reel--gen` 20rem) + 1/7 확률표 → ▲0.8~1.5초 뒤 3릴로. 건너뛰기·움직임 줄이기는 기존 룰렛 규칙 | 시안 제안(GM4). 결과는 시드 RNG가 먼저 정한다(RL2) |
| D4-12 | 릴 수·순서 | 수저·지역 2릴(`.reels` 8.5rem) | **연도 → 지역 → 수저 3릴**(`.reels--3` 6.25rem, 열 컨테이너 질의 7.5rem), 정지 순서 연도 → 지역 → 수저(`ROULETTE_TIMING`에 `yearStopMs`) | 시안 제안. `Reel` 부품 그대로(칸 수 8~16) |
| D4-13 | 제목·상태 문구 | `spinTitle` 「태어날 집과 땅을 고르는 중」 · `doneTitle` 「태어날 곳이 정해졌습니다」 · `spinNote` | 「태어날 해와 집과 땅을 고르는 중」 · 「태어날 때와 곳이 정해졌습니다」 · 「어느 해, 어느 집, 어느 땅에 …」 · 직접 고른 판 「태어나는 시도는 직접 골랐어요. …」 · 세대 줄 「{세대} {범위}년생 가운데」 · 릴 제목 「태어나는 해」 | 시안 제안. `ROULETTE_TITLE_LONGEST_WORD`가 두 제목에서 다시 계산된다(`tests/titleCap.test.ts`) |
| D4-14 | 결과 상태 줄 | FitPair 한 줄 「흙수저(하위 25% 안쪽) · 서울」 | 두 줄: FitPair 「{연도}년 · {시도}」 + 수저 칩 + 구간 | 시안 제안(QM2-10 — 세 항목은 「·」 사슬이 아니다) |
| D4-15 | 연도 확률표(GS7) | — | 연도별 % (소수 1자리, 합 100.0) + 기준·출처 주석, 자료 없는 해는 「균등 — 그해 자료가 없어요.」 | 시안 제안. 값은 DC2(`birthYearWeights`) |
| D4-16 | 직접 고른 시도(RG1·RG2) | — | 지역 릴 정지(`data-state="still"`, 흐림·줄무늬 없음) + 확률표 대신 「직접 고른 시도」. 존재하지 않는 해는 연도 후보에서 빠지고 확률 재계산 | 시안 제안 |
| D4-17 | 확률표 배치 | `.odds--cols` ≥ 640px 두 칸 | 3열에서는 모두 한 줄에 하나(`.reels--3 .odds--cols tbody { 1fr }`), 좁은 열 `th` 낱말 접힘, 수저 이름 「다이아몬드<wbr>수저」 | 시안 제안(1280 · 200%·360 넘침 0의 조건) |

## 3. 인생 기록 · 대시보드 (TL8·PJ7·EY10~EY12 · `dashboard-004.html`)

| ID | 곳 | 지금 구현 | 시안 | 상태 · 근거 |
|---|---|---|---|---|
| D4-18 | 연표 줄 4종 | `LogList` 줄 종류 `event/stage/note(/veiled)` | `log__row--tl[data-tl=year|bg|local|proj]`: 왼쪽 3px 선(실선 쪽빛 / 점선 보조 / 실선 보조 / 긴 점선 놋쇠) + 라벨 줄(아이콘 + 「그해/배경/지역 소식/전망」) + 문장, 나이 칸 아래 연도 `small.log__year`. 배경·지역 소식 문장은 14px 보조 톤 | 시안 제안(GM6). `LogList`의 `kind`에 `timeline` + `tl` 축, 라벨 글자는 `dashText.ts#TIMELINE_LABEL`. 무거운 장면 가리기(`Veil`)와 겹치면 가린 줄 규칙이 우선(RG8 — `close` → `near`) |
| D4-19 | 아이콘 셋 + 「전망」 칩 공용 | 스프라이트 19 심볼, `.chip--proj`는 `title.css` | `ui-icons.svg`에 `i-year`·`i-paper`·`i-talk` 추가(`buildIcons.mjs`·`mockLib.mjs#SPRITE`에도), `.chip`/`.chip--proj` 블록을 `title.css`에서 공용 위치로(대시보드·엔딩도 쓴다) | 시안 제안. `tests/designAssets.test.ts` 스프라이트 계약(심볼 수·fill 속성 없음) 갱신 |
| D4-20 | 전망 안내 한 번(PJ7) | — | 2026년 첫 진입에 `log__row--proj-intro`(놋쇠 옅은 면 + 5px 긴 점선 막대, 칩 「전망」 + 「{시나리오} 시나리오」 + 문장) 한 줄 — 판당 한 번, 기록에 남는다 | 시안 제안(GM9). 시나리오 이름은 PJ4의 판 값 |
| D4-21 | 머리 연도 옆 「전망」(PJ7) | `.year-row` 「2057년」 | `.year-row__year`(연도 + 칩 `.chip--proj`, nowrap) — 2026년 이상에만 | 시안 제안. `YearBar`/`LifeScreen` 머리 |
| D4-22 | 자산 카드 기준·전환(EY10·EY11) | `Cards.tsx` 태그 「지금 가치로 환산」(지난·다가올), 금액은 내부 값 | 태그 글자 「당시 화폐」/「2026년 가치」 + 금액 아래 `.assets__view`(전환 버튼 `btn--ghost btn--sm` + 기준 설명) — 표시 함수 `display(v, y, view)`(`economy-model.md` 16-8 ①), 2026년 이후·`cpi` 없는 해는 버튼 없음(후자는 이유 한 줄) | 시안 제안(GM10 — DC4 `cpi` 확보 뒤, 그 전에는 R1 방식 유지 EY12). `moneyView` 설정 기억(N22 ②), 상태 해시 불변(EY13) |
| D4-23 | 상태 도움말 문장 | `assetsUnit` present/past/future 세 문장 | 한 문장 「자산은 2025년까지는 그해의 화폐로, 2026년부터는 2026년 가치로 보입니다. …」 | 시안 제안(`copy.md` 16-5). 옛 「지금 가치로 환산」 글자 0(EY13 ⑤ 시험) |
| D4-24 | 프로필 「세대」 줄 | 출생·거주·출신 가정·학력·외모 | 「세대 X세대」 한 줄 추가(출생 아래) | 시안 제안(선택 — 세대가 판 내내 보이는 유일한 자리). 마스터가 빼도 된다 |
| D4-25 | 머리 연도 표기 | 「2057년」 | 달력 연도 그대로(「2000년」) — 변화 없음, 기록만 | 의도 |

## 4. 엔딩 (GS9·GD2·PJ4·RG4 · `ending-004.html`)

| ID | 곳 | 지금 구현 | 시안 | 상태 · 근거 |
|---|---|---|---|---|
| D4-26 | 머리 | 「{세상} · 생애 기록」 라벨 + 이름 + 날짜 | 라벨 「생애 기록」 + 이름 + 날짜 + `.ending__meta`(「{세대} · {연도}년생」 굵게 / 「{그 해의 시·도 + 시군구}에서 태어남」 / 전망 구간을 산 판은 칩 + 「2026년부터는 공식 전망({시나리오} 시나리오)을 바탕으로 한 이야기입니다.」) | 시안 제안(GM4·GM9). `endingText.ts` |
| D4-27 | 최종 순자산(N22 ④) | `FinalNet` 금액 + 태그 「지금 가치로 환산」 | 금액 → `.final-net__view`(태그 「당시 화폐」/「2026년 가치」 + 마지막 해 ≤ 2025이고 `cpi` actual이면 같은 전환 버튼) → 기준 설명 | 시안 제안(GM10) |
| D4-28 | 생애 연표 줄 | `TimelineItem` event/stage/choice/note/death | `li.is-tl[data-tl]` 같은 4종 + 나이 칸 아래 연도 + 전망 경계 `li.timeline__split`(2026년 첫 줄 앞) | 시안 제안(GM6·GM9) |
| D4-29 | 비교 카드(RG4) | — | 내 출신 시도 설정이 있을 때만 `section.card.same-event` 「같은 사건, 다른 자리」(`.compare`는 시안 갤러리의 비교 틀 이름이라 피했다)(사건당 한 줄 ≤ 5, 세 사실, 마무리 한 줄, 작은 글). 출신이 같으면 한 줄 | 시안 제안(GM7 — 지역 체감 사건 승인 뒤). 이미지화는 SPEC-007(N19) |
| D4-30 | 다시 태어나기 보조문 | 「다시 태어나면 이 인생의 기록은 사라집니다.」 | 앞에 「첫 화면의 세대 선택으로 돌아갑니다.」 | 시안 제안(GS9) |
| D4-31 | 출발선 카드 주석 | 「같은 세상 안의 자리로 견주었습니다」 | 「같은 세대 안의 자리로 견주었습니다」 | 시안 제안 — 분포표가 세대 7종으로 다시 만들어지면(EY8) 「세상」 → 「세대」. `JOURNEY_NOTE`·`standingLabel` 문구 |

## 5. 시험 · e2e · 관찰

| ID | 곳 | 내용 | 상태 |
|---|---|---|---|
| D4-32 | 시험 | `tests/titleScreen.test.tsx`(카드 7·랜덤 버튼·부제·질문) · `tests/titleCap.test.ts`(룰렛 두 제목의 가장 긴 낱말) · `tests/designAssets.test.ts`(스프라이트 22 심볼, `gm3.css` 블록이 `title.css`/`doc.css`/`dash.css`에 같은 글자로) · `tests/moneyView.test.ts`(EY13 ③④⑤) · e2e `first-screen`(7장·랜덤·시도 분절·360 넘침 0)·`roulette`(3릴 360 나란히·건너뛰기)·`line-breaks`(320 · 200% 분절 칸·칩·연표 줄) | 시안 제안 |
| D4-33 | 관찰(범위 밖) | ① 또래 카드 주석 「설계값입니다(통계가 아님).」가 320 · 200%에서 괄호 앞에서 끊김 — 기존 시안 글자(구현은 `Glue` ⑤ 괄호 묶음이 맡는지 확인) ② 1280×800 왼쪽 열 스크롤(D4-10) ③ 카드 경계 `heavy-borders` 1.49:1은 M1 확정 토큰(전 회차와 같은 예외) | 기록 |
