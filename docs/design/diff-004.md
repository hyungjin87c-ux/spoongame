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

## 6. 2차 변경 — 게이트 ③ 형진 님 답 1~4 (2026-10-27, SPEC-004 「GM3 게이트 ③ 형진 님 답」·N29·N30·DC7 마스터 결정 5 — 시안 `title-004.html`·`roulette-004.html`·`dashboard-004.html` 재생성, 샷 `screens/004/gm3r2-*` 7장, 문구 `copy.md` 16-10, 규격 `design-system.md` 17-10)

1절의 D4-01·D4-03·D4-05(카드 7장·세 줄 카드·랜덤 버튼 기억)와 2절의 D4-15(연도 확률표)는 아래가 **대체**한다. D4-10(1280 세로)은 D4-45로 갱신. 나머지 D4는 그대로.

| ID | 곳 | 지금 구현 / 1차 시안 | r2 시안 | 상태 · 근거 |
|---|---|---|---|---|
| D4-34 | 첫 화면 일러스트 | `TitleScreen`의 `<picture>` 둘(오른쪽 열 맨 위 `.illust--top` · 좁은 화면 배너 `.illust--banner`, `src/assets/home/home-map-*.webp`) | **없음** — 오른쪽 열은 캐러셀 카드로 바로 시작(`title__side` sticky 그대로, 카드 위 24px). 좁은 화면 배너도 뺐다(같은 자산) | 시안 제안(형진 님 답 1 — GM4). **결정 필요(마스터)**: ① `data-hero='illust'`에 묶인 캐러셀 색(카드 위 하늘 띠 그라디언트·차가운 테두리·푸른 그림자 — 12-6 「그림과 어울리게」)을 그림 없이도 유지할지(시안은 유지, inspect `gradient` 허용 목록 유지) ② 모바일 배너만 남길지(시안은 둘 다 뺌) ③ 자산 파일 `home-map-*.webp` 삭제 여부(96 KB, 초기 로드에서 빠진다 — MG8 여유가 는다) |
| D4-35 | 머리 글자 크기 | 부제 18/1.4 · 「51,284명 …」 22 · 안내 14 · 카드 소개 12 | 부제 **16/1.6 400** · 체험 한 줄 **14/1.6** · 안내 14/1.6 · 메타 14 · 소개 14/1.5(한 곳) | 시안 제안. `design-system.md` 17-10-1 표. `title.css` `.hero__tag`·새 `.hero__span`·`.slot__lead` |
| D4-36 | 「51,284명이 …」 줄 + 안내 | `heroPop`/`heroNote`(`titleText.ts`, `virtualPopulation`) | **없음** → `.hero__span` 「1940년생부터 2020년생까지, 어느 세대로든 태어나 한 번의 인생을 살아 볼 수 있어요.」(`copy.md` 16-10 ①, 후보 ②③은 마스터·형진 님 선택) | 시안 제안(답 1). 가상 인구 상수·계산(또래·푸터 설명)은 그대로 — 첫 화면 표시만 빠진다. `tests/titleScreen.test.tsx`·e2e의 「51,284명」 단언 삭제 |
| D4-37 | 세대 선택(D4-01·03·05 대체) | 1차: `.radio-card--gen` 7장 2열 + 「랜덤 세대」 버튼(`aria-pressed`) | **`.gen-list` 라디오 묶음 한 열 8줄**(`role=radiogroup` 「태어날 세대」, `input[name=gen]` 값 `random`·GD1 7종) — 줄 = 표식 · 이름(+「살아봄」) · 「{범위}년생 · 올해 {나이}」, 창 높이 `clamp(9rem, 100vh − 34rem, 22.5rem)`(모바일 svh − 29rem) 안에서 스크롤·snap, 고른 줄 옅은 쪽빛 면 + 왼쪽 3px 막대 + 체크, 소개는 목록 아래 `.gen-intro` 한 곳(`aria-hidden`, 라디오 `aria-describedby`가 같은 글자) + 알파 보조 줄, 접이식 그대로 | 시안 제안(GM4). **처음 방문의 기본 선택 = 「랜덤 세대」**(답 3 — N15의 「기본 선택」 물음은 이것으로 닫힌다, 마스터 확인) · 「살아봄」 표시 켬(GS10 ▲ → 답 3 「켜져 있다」, 설정 키는 MG1). 「랜덤 세대」가 라디오가 되므로 GS4 「마지막 선택 기억」은 라디오 값 `random` 기억으로 단순해진다(`aria-pressed` 없음). CSS는 `gm3.css` 「r2 세대 고르기」 블록 → `title.css` |
| D4-38 | 세대 목록 접근성·동작 | — | 위·아래 화살표 = 라디오 기본; 바뀐 줄은 **목록의 `scrollTop`만** 움직여 창 안에(`reveal()` — `scrollIntoView`는 문서까지 끌어올린다); 포커스 링 `outline-offset −3px`(창 안쪽); 줄 ≥ 44px; `scroll-behavior: smooth`는 `data-motion=reduce`에서 auto; 360·PC 가로 넘침 0(실측) | 시안 제안. e2e: 랜덤 → 알파 → 랜덤 왕복에 고른 줄이 창 안 + 문서 스크롤 ≤ 4px(브라우저 포커스 스크롤) + 360 `scrollWidth === clientWidth` |
| D4-39 | 룰렛 확률표(D4-15 대체) | 1차: 연도 % 11행 · 지역 1972년 고정 11행 · 수저 세대 표 | **연도** 「{연도}년 │ {출생아 수}만 명 · {확률}%」(births) / 「— · {확률}%」(uniform), 굵은 줄 = 창의 해/태어난 해 · **지역** 줄 수 고정(세대 범위의 시·도 합집합, 창의 해에 없던 시·도 「—」), 값 = 창의 해(1981~2020 `birth_share_sido`, 1940~1980 도별 인구 비례 계단식 — `dc7-province-population.json` `stairWeights`, 화면에 「인구 비례(출생 자료 없음)」) · **수저** `wealthFor(창의 해)`(N29 보간, 합 100 정수) + 「{해}년생의 값이에요. 게임의 설계값이에요(통계가 아님).」 · 좁은 열은 연도 칸 두 줄 · 값 칸 최소 폭(8.5ch/5.5ch) | 시안 제안(GM4). 함수 셋은 `buildGm3Mockups.mjs`의 `yearOddsFor`·`regionShare`·`wealthFor`·`largestRemainder`를 `src/core`로(단위 테스트: 닻 해 = NR1 표 · 합 100 · 1960~63 겹침 해는 연도만으로). 「예시」 알약은 **시안 전용** — 구현에 넣지 않는다 |
| D4-40 | 룰렛 움직임 | `RouletteScreen` 2릴 동시 회전 → 수저·지역 순 정지(`ROULETTE_TIMING`) | ① 3릴 함께 ② 연도 릴이 도는 동안 **창을 지나는 연도가 바뀔 때마다**(`Reel` offset ÷ `--reel-item-h`, rAF에서 칸 경계마다) 지역·수저 표를 그 해 값으로 다시 그림(값은 마운트 때 세대 범위 전 연도를 미리 계산한 Map) ③ 연도 정지(`yearStopMs`) → 표 고정 ④ 지역 정지 ⑤ 수저 정지 ⑥ `role=status` 한 번. 표는 live region 아님(aria-live 없음). `data-motion=reduce`·건너뛰기 = 최종 값만. 숫자 tabular + 칸 최소 폭·줄 수 고정으로 다시 그려도 폭·높이 불변(실측 도는 중 ↔ 결과 동일) | 시안 제안(GM4). `ROULETTE_TIMING`에 `yearStopMs`(D4-12), `Reel`에 `onWindowChange(index)`(선택 prop) 추가. e2e: 도는 동안 `.odds--region` 줄 수·`getBoundingClientRect().width` 불변, `aria-live` 속성 없음, 결과 뒤 status 1회 |
| D4-41 | 대시보드 「이 세상의 가상 인구 …」 고정 줄 | `LifeScreen` `.log__pin` 「이 세상의 가상 인구 51,284명 · {이름}도 그중 한 사람」 | **없음**(시안에서 뺌) | **결정 필요(마스터)** — 형진 님 답 1 「「이 세상의 가상인구 ○○명」 류가 있으면 그것도 뺀다」(마스터 지시)의 구현 적용 여부. 빼면 `dashText.ts` 상수·`tests` 단언 삭제, 푸터 「가상 인구: … 1,000분의 1 …」 설명문도 함께 볼 것 |
| D4-42 | 이름 비교(N30) | — | `?name=salabom` 「살아봄」(부제 자리에 「어느 해, 어디서, 어떤 수저로 태어날까」) · `?name=taeeonabo` 「태어나 보니」(부제 그대로) — 워드마크 SVG 자리에 글자만(52px 700 `--c-logo`, 새 로고 없음) → `gm3r2-name-salabom.png` · `gm3r2-name-taeeonabo.png`. 「세대 유감」은 형진 님이 뺌(마스터 지시 2026-10-27, 캡처 삭제) | 결정용 캡처. 구현 없음. 정본은 「수저 게임」. 「살아봄」이 되면 세대 줄 「살아봄」 알약(GS10)과 낱말이 겹친다 — 알약 글자 변경 필요(`copy.md` 16-10) |
| D4-43 | 글꼴 | `--font-sans` 시스템 글꼴 | 그대로(**추천 A** 시스템 글꼴 조정 — 자체 호스팅은 한 굵기 한 벌도 MG8 여유 26,587B의 3~4배, 17-10-2) | **결정 필요(마스터·형진 님)**: A 그대로 / A′ `--font-sans` 순서 조정(Windows에서 Segoe UI + 맑은 고딕 섞임 해소, 토큰 변경) / B 한도 변경 뒤 재검토 |
| D4-44 | 산업화 소개 | 1차 「한국전쟁, 전후 복구, 산업화의 시기를 지나온 세대」 | 「**6·25전쟁**, 전후 복구, 산업화의 시기를 지나온 세대」 | 시안 제안(DC1 결정 · 답 4). 86 소개 그대로 |
| D4-45 | 1280×800 세로(D4-10 갱신)·관찰 | 1차 왼쪽 열 끝 1136(스크롤 404) | **989(스크롤 257)** — 목록 5.8줄 + 소개 + 접이식까지 띠(732) 위, 그 아래는 SPEC-005의 인생 길이·태어나는 시도·설정 줄 | 기록. 관찰 ① 360 키보드 이동 때 문서 4px 스크롤(브라우저 포커스 스크롤, 띠 `scroll-padding` 안) ② 오른쪽 열은 카드 아래(≈ 600~732)가 비는데 sticky 열이라 왼쪽이 스크롤돼도 카드가 따라온다 ③ 1차의 끊긴 낱말 둘(「시·도별」 「설계값이에요(통계가」)과 새 「비례해요(국가데이터처」는 시안에서 `keep-phrase` — 구현은 `Glue` ⑤ |

### 6-1. 마스터 처리 (2026-10-27)

- **N30 종결 — 이름은 「수저 게임」 그대로**(형진 님 「수저 게임 그대로 가고, 세대에 대한 부분은 부제로 가자」). 세대의 뜻은 부제가 맡는다 — 지금 부제 「다른 세대, 다른 삶, 같은 대한민국」을 유지한다. D4-42 이름 비교 캡처 2장은 지웠고(결정이 나서 쓸모가 없다), `?name=` 시안 상태는 기록으로만 남는다. 세대 줄의 「살아봄」 알약은 이름과 겹치지 않으므로 그대로다.
- **D4-34**: 일러스트 둘(오른쪽 열·좁은 화면 배너)을 모두 뺀다. `src/assets/home/home-map-*.webp`는 GM4 구현에서 지운다(초기 로드가 가벼워진다). 캐러셀의 하늘 띠·테두리·그림자(12-6)는 시안대로 둔다.
- **D4-37**: 「랜덤 세대」를 목록의 첫 라디오로 둔다(SPEC GS1의 「버튼」 글자는 r5에서 고친다). N15 기본 선택 = 랜덤, 「살아봄」 켬 — 형진 님 답 3.
- **D4-41**: 구현의 `log__pin`(「이 세상의 가상 인구 …」)과 푸터의 가상 인구 설명을 GM4에서 뺀다(형진 님 답 1의 뜻).
- **D4-43 글꼴**: 형진 님 확인 대기. 마스터 추천은 A(시스템 글꼴 + 시안의 크기 단계·줄 간격 1.6)이고, A′(`--font-sans` 순서 조정)는 GM4에서 전·후 캡처를 만들어 형진 님께 보인 뒤 정한다. **→ r3(7절 D4-46)에서 형진 님 답 2차 4 「Noto Sans KR」로 바뀌었다.**
- **D4-36 체험 한 줄**: 형진 님 확인 대기(시안 ① 추천). **→ r3: 형진 님이 ②를 골랐다(D4-51).**

## 7. 3차 변경 — 게이트 ③ 형진 님 답 2차 1~4 (2026-10-27, SPEC-004 「GM3 게이트 ③ 형진 님 답 2차」 — 벤치마킹 `benchmark-004.md`, 시안 `title-004.html`·`roulette-004.html`·**`birth-004.html`(새)** 재생성, 글꼴 조각 `mockups/gm3/fonts/`(생성 `scripts/design/buildGm3Fonts.mjs`), 샷 `screens/004/gm3r3-*` 8장, 문구 `copy.md` 16-11, 규격 `design-system.md` 17-11)

6절의 D4-36(체험 한 줄)·D4-37·D4-38(세대 목록)·D4-39·D4-40(룰렛 확률표와 움직임)·D4-43(글꼴)과 2절의 D4-12·D4-13·D4-14·D4-16·D4-17(3릴·연도)은 아래가 **대체·갱신**한다. 1차 D4-11(세대 뽑기 단계)·D4-08·D4-09(시도 선택·내 출신 시도)와 3·4절(대시보드·엔딩)은 그대로 — 이번에 다시 그리지 않았다(토큰 영향은 17-11-2 표).

| ID | 곳 | 지금 구현 / r2 시안 | r3 시안 | 상태 · 근거 |
|---|---|---|---|---|
| D4-46 | **글꼴**(D4-43 대체) | `--font-sans` 시스템 글꼴(Windows는 Segoe UI 숫자 + 맑은 고딕 한글 두 벌 섞임) | **Noto Sans KR 400·700 부분 집합 조각 자체 호스팅(B안)** — `fonts/noto-sans-kr.css`의 `@font-face` × (굵기 2 × 조각 s0·s0b·s1·s2·s3, **WOFF2만** — WOFF(zlib) 없음) + `unicode-range`, `font-display: swap`, 첫 화면 조각 s0(400·700) `<link rel="preload">`, 대체 글꼴 `'Noto Sans KR Fallback'`(맑은 고딕에 `size-adjust`·`ascent/descent/line-gap-override`). `--font-sans: 'Noto Sans KR', 'Noto Sans KR Fallback', -apple-system, 'Apple SD Gothic Neo', 'Malgun Gothic', system-ui, sans-serif`. 글꼴 파일은 `src/assets/fonts/`로(외부 주소 0), OFL.txt 동봉, `credits.md` 행 | **마스터 결정(2026-10-27): B안 채택 · MG8 한도 400,000 유지 · `brotli` 모듈은 받지 않고 널 변환 WOFF2를 그대로 쓴다**(17-11-3 셈: 일러스트 삭제 뒤 370,200B, 여유 ≈ 30KB). 구현은 GM4: 조각은 `node scripts/design/buildGm3Fonts.mjs`(절차 17-11-4)로 다시 만들고 글자 집합이 바뀔 때마다(이벤트·연표 문장 추가) 재생성, `e2e-prod/initial-load.spec.ts`에 「첫 화면 요청 = s0 둘 + CSS, 합계 ≤ 400,000」, `tests/designAssets.test.ts`에 @font-face 블록·preload·fallback face 단언. 모바일(Android Noto Sans CJK 설치 기기)도 같은 파일을 받는다(local() 우선은 두지 않는다 — 기기마다 판이 달라 조판이 흔들린다) |
| D4-47 | **룰렛 2릴 · 세대 전체 기준 표**(D4-12·D4-14·D4-15·D4-16·D4-17·D4-39·D4-40 대체) | 구현 2릴(`.reels` 8.5rem) · r2 3릴 + 연도 표 + 창의 해를 따라 바뀌는 표 | **연도 릴·연도 표 없음 — 구현의 2릴 구조 그대로**(`RouletteScreen`·`Reel`·`ROULETTE_TIMING` 변경 없음, `yearStopMs`·`onWindowChange` 불필요). 릴 아래 표 = **고른 세대 전체 기준**: 지역 = Σ P(연도|세대) × 그해 시·도 비율(1981~2020 `birth_share_sido`, 1940~1980 `stairWeights`, 없던 해 0 — 줄은 세대 범위의 시·도 합집합, 어느 해에도 없던 시·도는 뺀다), 수저 = Σ P(연도|세대) × `wealthFor(연도)`(N29). P(연도|세대) = GS7(출생아 수 비례 / 균등). 표시 합 100(지역 소수 1자리 — 1000분의 1 단위 `largestRemainder(raw, 1000)`, 수저 정수). 표 머리 `.odds__head` 「{세대} 전체 기준」, 표 글자 14px(`--fs-sm`, 두 열이라 폭이 있다), 주석 셋(`copy.md` 16-11). **도는 동안 바뀌지 않는다** — live region 아님, 흔들림 0(실측 도는 중 ↔ 결과 동일) | 시안 제안(GM4). 생성기 `genMixture(g)`·`largestRemainder(raw, total)`를 `src/core/generationMixture.ts`로(단위 테스트: 7세대 × 지역 합 100.0·수저 합 100, 밀레니얼 서울 24.5 · 경기 16.0, 1940~1980 세대는 `stairWeights`만 쓴다, 범위 도중 생긴 시·도 목록 밀레니얼 「광주·대전」 · X 「대구·인천」). `.odds` 12px 기본은 ds.css 그대로 두고 룰렛 표만 `doc.css`에서 14px. 직접 고른 시도는 지역 표 대신 「직접 고른 시도」(D4-16 유지) |
| D4-48 | 결과 줄의 수저 구간(`bandOf`) | 구현 `bandLabel(startBandOf)` = 그 판의 연도별(지금은 세상별) 가중 | **세대 전체 기준의 섞은 값**(표와 같은 숫자 — 「동수저 (하위 26%와 상위 44% 사이)」), **출생신고의 「집안 형편」 구간도 같은 값** | **마스터 결정(2026-10-27): ① 섞은 값**(표와 일치, 연도를 드러내지 않음). 구현: `startBandOf`의 분포를 `genMixture(gen).wealth`로(룰렛·출생신고 공용), 엔딩 「같은 세대 안의 자리」(D4-31)도 같은 분포 |
| D4-49 | **연도 숨김 → 출생신고에서 처음**(D4-13·D4-14 갱신) | r2 룰렛 결과 줄 「{연도}년 · {시도}」 | 룰렛 화면 어디에도 연도 0(제목·상태 줄·표·릴). `generateBirth`는 연도를 GS7 가중으로 그대로 뽑는다(RL2 — 결과가 먼저). 출생신고: 이름 칸 옆 라벨 **「세대」** + 값 **「{세대} · {연도}년생」**(`.doc__who` 두 칸, `.doc__gen` 16px 700 tabular), 각주 첫 문장 「태어난 해는 … 이 서류에서 처음 적혀요.」 | 시안 제안(GM4). `birthReportText.ts`에 `genLabel`·`genLine(gen, year)`·`yearNote`, `BirthReport` 머리에 두 칸. e2e: 룰렛 DOM 글자에 `/\d{4}년/` 0 · 출생신고에 「{세대} · {연도}년생」 1 · 결과 상태 줄 1회 읽기(RL6). `ROULETTE_TEXT.spinTitle`·`doneTitle`·`spinNote`는 **SPEC-003 글자 그대로**(D4-13 폐기 — `ROULETTE_TITLE_LONGEST_WORD` 변경 없음) |
| D4-50 | **세대 목록 r3**(D4-37·D4-38 갱신) | r2: 1px 경계 + 둥근 모서리 + 면의 창 안 8줄(이름 16 700 · 메타 14), 소개는 목록 아래 한 곳 | 창 상자 없음 — 위아래 1px `--c-border-strong`, 줄 사이 1px `--c-border`. 줄 = 표식 원 18px + `.gen-row__body`(`.gen-row__line` = 이름 **14px 700** + (살아봄: 체크 12px + 글자, 알약 없음) + 메타 **12px** `--c-text-3` tabular 오른쪽(`margin-left:auto`, 안 들어가면 통째로 다음 줄, 320 · 200%는 「·」 뒤에서 접힘 — 안쪽 두 묶음 nowrap) / `.gen-row__desc` 소개 **12px** `--c-text-2`(알파는 보조 문장 이어 붙임, `.gen-row__note` `--c-text-3`)). 라디오 `aria-labelledby="{이름} {메타}"` + `aria-describedby="{소개}"`. **`flex: none`**(세로 flex 창 안에서 min-height 44 항목이 눌리지 않게). 고른 줄 면·막대·표식 r2와 같다. 창 높이 변수·snap·키보드(`scrollTop`만)·포커스 링 r2 그대로 | 시안 제안(GM4). 줄 높이 ≈ 49px(두 줄) · 360의 긴 이름 줄은 메타가 내려가 ≈ 66px. CSS는 `gm3.css` 「r3 세대 고르기」 블록 → `title.css`(r2 블록 대체). e2e: 랜덤 → 알파 → 랜덤 왕복 창 안, 360 가로 넘침 0, 320 · 200% 메타 넘침 0 |
| D4-51 | 체험 한 줄(D4-36 갱신) | r2 ① 「1940년생부터 2020년생까지, …」 | **② 「세대를 바꿔 가며 그 시절의 한 사람으로 살아 봐요.」**(형진 님 답 2차 3) | 시안 제안. `titleText.ts#heroSpan` |
| D4-52 | 「랜덤 세대」 경로의 룰렛 머리 | — | 세대 줄 위에 작은 글씨 **「랜덤 세대에서 뽑힌」**(`.roulette__from`, 12px `--c-text-3`) + 세대 이름 굵은 글자(알약 없음) + 「{범위}년생 가운데」. 세대 뽑기 단계(D4-11)는 그대로 | 시안 제안. `RouletteScreen`이 `fromRandom` 상태를 받는다(저장 복원에서도 같은 머리) |
| D4-53 | 룰렛 세대 알약 · 「예시」 알약 | r2 `.gen-tag` 1px 알약 · `.odds__ex` 점선 알약 | 둘 다 없음 — 세대 이름은 `--fs-md` 700 글자, 「예시」는 DC7-pop 수집 완료로 불필요 | 시안 제안(벤치마킹 규칙 6) |
| D4-54 | 수저 다섯 자루 줄 이름 | `.spoon-fig__name` 12px 700 | 12px **400**(굵기는 제목에만) | 시안 제안. `title.css` 한 줄 |
| D4-55 | **캐러셀 카드 평면화(정본) · 바탕 한 단 밝게(대안)**(D4-34 ① 갱신) | `data-hero='illust'`의 하늘 띠 그라디언트 + 푸른 그림자 + 차가운 테두리, 조작 상자 셋(`title-005.css`, 12-6 「그림과 어울리게」) | **정본**: 카드 = 면 + 1px `--c-border`, 그림자 0, 조작 버튼(`.nav-btn`) 테두리·면 0 — `gm3.css` `html[data-hero] .carousel--005`(강제 색상은 Canvas + CanvasText 경계). **대안** `?alt=paper` = 정본 + `--c-bg: #f9f7f2`·`--c-surface-2: #f1ede4`(`gm3r3-alt-title-paper-1280x800.png`, 형진 님께 보일 것) | **마스터 결정(2026-10-27) — 평면화 채택, 12-6 번복**: 일러스트가 빠진 뒤(D4-34) 하늘 띠·푸른 그림자의 이유가 없어졌다. 구현(GM4): `title.css`의 `data-hero='illust'` 블록에서 그라디언트·그림자·테두리 색을 빼고 `.nav-btn` 테두리를 거둔다; 토큰 `--c-card-tint`·`--shadow-card`·`--c-card-border`(tokens.css 12-6 블록)는 쓰는 곳이 없어지면 지우고 `checkContrastLib.ts` PAIRS의 띠 위 쌍도 뺀다. paper(토큰 변경)는 형진 님 결정 대기 — 17-11-2 ② 영향 표 |
| D4-56 | 머리 설명 줄 수 · 「한 판 약 30분」 자리 · 보조 잉크 옅게 | 부제 · 체험 한 줄 · 안내 한 줄(GS1) 셋 | 제안만(`benchmark-004.md` 3절 9~11) — 시안 변경 없음 | **결정 필요(마스터 → planner r5)** |
| D4-57 | 시험 · e2e(D4-32 갱신) | — | `tests/generationMixture.test.ts`(D4-47) · `tests/titleScreen.test.tsx`(줄 구조·aria·체험 한 줄 ②·살아봄 글자) · `tests/designAssets.test.ts`(글꼴 @font-face 블록 = 생성 CSS와 같은 글자, preload 2, fallback face, `title.css`/`doc.css` 블록 동일) · e2e `first-screen`(상자 없음 — `.gen-list` border-left 0, 키보드 왕복, 320 · 200% 넘침 0, `document.fonts` Noto Sans KR 400·700 loaded) · `roulette`(2릴 360 나란히, 표 머리 2, 도는 중 ↔ 결과 표 크기 동일, 연도 글자 0, `?from=random` 머리) · `birth`(세대 칸·각주) · `initial-load`(MG8 새 한도) | 시안 제안 |
| D4-58 | 관찰(범위 밖) | — | ① 룰렛 1280의 지역 표(두 열 8/7줄 + 주석 세 문장)가 수저 표보다 96px 길다 — 두 열의 아래끝이 다르다(app-screens `ragged-row`는 카드 기준이라 경고는 없지만 기록) ② 1280 · 200%의 「광주·대전의」·320 · 200%의 「자리」를」은 nowrap으로 묶었다 — 구현은 `Glue` ⑤ ③ 글꼴 B안의 WOFF2는 생성기의 널 변환 파일(brotli) — 정식 인코더는 5~15% 더 작지만 `brotli` 모듈을 받지 않기로 했다(마스터 결정) ④ 세대 줄의 오른쪽 안쪽 여백 8px(마스터 지적 — 1280에서 메타가 끝선에 붙고 360 선택 줄의 마지막 글자가 잘렸다) — 촬영 스크립트가 모든 줄의 메타 오른쪽 여유 ≥ 8px을 단언한다 | 기록 |

### 7-1. 마스터 처리 (2026-10-27, 시안 3차 다듬기)

- **D4-55**: 캐러셀 평면화를 정본으로 채택(12-6 번복 — 위 행). paper 대안 캡처는 평면화가 든 상태로 다시 찍었고 flat 대안 캡처는 정본과 같아져 지웠다.
- **D4-46**: B안 · MG8 400,000 유지 · `brotli` 내려받기 없음 · `fonts/`의 WOFF(zlib) 10개 삭제(CSS·README에서도 제거).
- **D4-48**: 섞은 값 채택, 출생신고도 같은 값.
- 글자 크기 12px 단계 유지(`tiny-text` 62%는 예외).
- 고친 것: 세대 줄 오른쪽 안쪽 여백 8px(D4-58 ④) · 정본 첫 화면 캡처는 포커스 없는 상태로(키보드 검사는 캡처 뒤에 — `shootGm3.mjs`).
