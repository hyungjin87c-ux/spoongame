# docs/design — 수저 게임 디자인 산출물 지도 (SPEC-003 M1, 5차 = REV-003-D-3 마무리 · 6차 = REV-003-D-4 후속 · 7차 = M3 착수 정리 · 8차 = M3 승인 뒤 시안 맞춤 R-270 · 9차 = M3 r4 뒤 후속 · 10차 = M4 착수 정리 · 11차 = M4 구현 뒤 후속 · 12차 = M4 r2 뒤 후속)

> **14차(2026-10-18, M5 r3 — developer 2b 화면 구현 뒤 designer 마무리)**: ① 구현(`src/ui/dash/Impact.tsx`·`FinalNet.tsx`·`Cards.tsx`·`src/data/impactText.ts`·`dashText.ts`·`styles/dash.css`)과 증거 샷 `qa/screenshots/003/dev-M5-*.png` 22장을 `copy.md` 4절·`ds.css`와 대조 — 어긋남은 「안내 한 줄은 영향이 하나라도 있는 묶음에만」 하나뿐이고 받아들여 `copy.md` 4-4에 반영. `diff-003.md` **D-31~D-37 닫힘**, 관찰 D-38(선택지 번호 원 26px 고정)·D-39(`dash.css` 호환 두 줄)·D-40(상속 표기 developer r3) 추가. ② 생성기 정리: `mockLib.mjs#impact()`(M1 초안, 해요체) **삭제**, decision-*·components·dashboard-*·note 시안의 영향 줄·상태 도움말·자산 카드를 **구현 컴포넌트 출력**(`ImpactLine`·`ImpactHint`(시트 안내 한 줄)·`StatusCard`·`AssetsCard`)으로 교체, `ds.css` 호환 두 줄 삭제. ③ `economy-m5.html`은 developer가 옮긴 `buildMockups.mjs#economyPage()` 출력 — 생성기로 **재촬영**(`economy-*` + decision·components·dashboard·note), 320px 전수 넘침 점검, 저장소 밖 감사(끊김·CM10·렌더 대비)를 생성된 페이지에 다시 실행. 결과는 `ai-log/2026-10-18_SPEC-003_design-M5-r3.md`.
>
> **13차(2026-10-17, M5 경제 모델 — developer가 경제 로직(2a)을 하는 동안 designer가 화면 몫의 규격을 먼저 냄. `src/`·`scripts/`·`qa/`는 읽기만, `tests/`는 디자인 계약 시험 한 묶음만 추가)**: ① `copy.md` **4절 신설**(영향 줄 항목 이름 7개 · 스크린리더 문장 42개(합쇼체) · 영향 줄과 선택지 버튼의 접근 가능한 이름 형식 · 안내 한 줄 · 자산 카드 라벨과 「지금 가치로 환산」 자리 · 가구 기준 도움말 한 문장 · 엔딩 「최종 순자산」 줄(음수·0·스무 살 전) · 구현 노트)과 2절 행 갱신(상태 도움말·자산 현황·엔딩·카드 안내·영향 줄). ② `ds.css`: 「영향 표기」 블록을 M5 규격으로(항목 한 덩어리 · **CSS 「·」 가장자리 감춤** · 지속 비활성 선택지 · 안내 줄), 「자산 현황(M5)」(컨테이너 `assets` 금액 크기 3단계 · 주석), 「최종 순자산」 줄, `@supports not` 폴백, 강제 색상 M5 추가분 — 기존 클래스는 `.impact`의 구분 기호 방식만 바뀌었다(옛 마크업 호환 규칙 유지). ③ **손으로 쓴 시안 `mockups/economy-m5.html`**(생성기 밖 — `?state=choice|choice-young|impact-samples|assets|assets-past|assets-big|ending|ending-past|ending-early`) → 샷 **`screens/003/economy-*.png`**(360×740 · 320×568 · 1280×800 · 320×256, 라이트·다크·강제 색상, 글자 100·200%). 점검(저장소 밖 촬영 스크립트, e2e 측정기 `lineBreaks`·`renderedContrast`·`focusObscured` 재사용): 넘침 0 · 낱말 끊김 0 · 구분 기호 가장자리 0 · 줄 첫머리 「·」 0 · 렌더 대비 최저 라이트 5.78 / 다크 5.96 / 강제 색상 14.02:1 · CM10 포커스 가림 0. ④ `design-system.md` 2절(hover 면 쌍) · 6절(영향 표기·선택지·자산 카드·최종 순자산 행) · 10절 16항 · **11-9절 신설**, `diff-003.md` **1-2절 D-31~D-36**, `credits.md` 문구 대조 M5 행, `contrast-report.md` 재생성(수치 변화 없음), `tests/designAssets.test.ts` M5 계약 묶음. `ai-log/2026-10-17_SPEC-003_design-M5.md`.
>
> **12차(2026-10-17, M4 r2(REV-003-M4-1 반영) 뒤 designer 후속 — 소규모, developer가 출생 생성기를 고치는 중이라 `src/`·`e2e/`·`tests/`·`qa/`는 읽기만)**: ① 생성기가 r2에서 삭제된 `DASH_TEXT.noteSoon`을 읽어 재생성 시 「undefined」가 찍히던 것을 고치고 「생각 남기기」를 구현과 같은 **지속 비활성 + 버튼 안 「준비 중」 알약**(R-326, `toolBtn soon`·`ds.css` `.tool-soon`)으로 — M7c 목표 시안 `note.html`만 보통 버튼. ② `ds.css`에 r2 구현 반영: `.ending__who`(R-320), 엔딩·밀린·오류 h1 `--title-chars` 상한 `@supports` 블록(R-321 — 생성기가 `titleCharsFor`·`SYSTEM_TITLE`을 읽음), 확인 단계 버튼 네 속성(R-336), `.profile__top`·`.who` flex-wrap(R-329·R-321), `.timeline li` flex-wrap, `.tool-note` 삭제. ③ `copy.md`(생각 남기기 행 교체·도구 줄·자산 자리표시 채택·상태 도움말 M5 조건), `diff-003.md`(D-17·D-20·D-23·D-26 닫힘, D-27~D-30, 3-3절), `design-system.md`(2절 구현 반영·6절 버튼/도구 줄/확인 단계/헤더/얼굴 타일/**엔딩 머리 행 신설**·10절 15항·11-8), `faces.md` 5차 검토. ④ **R-329 후반**: 72px로 그리는 자리는 지금 없고(프로필·엔딩 모두 96px), 72px 시트에서 중년 남성 단서가 약해 조정안만 제시(`faces-72-young-vs-middle.png`). ⑤ 촬영기 `el`(요소 단위 샷) 옵션 + 새 샷 19장(`dashboard-tools-{mobile-dark,mobile-forced,320,320-text200}`, `dashboard-unavailable-tools-mobile{,-dark,-forced}`, `dashboard-exit-box-{mobile,320}-text200-full`, `components-buttons-{mobile,desktop,desktop-dark}`, `components-tools-mobile{,-forced}`, `ending-320{,-text200}`, `system-{superseded,error}-320-text200`, `faces-72-young-vs-middle`), 대시보드·카드·컴포넌트·엔딩·밀린/오류 재촬영 넘침 0, `--check` 320px 전수 넘침 0, `tests/designAssets.test.ts` 44/44. `ai-log/2026-10-17_SPEC-003_design-M4r2.md`.
>
> **11차(2026-10-17, M4 구현 뒤 designer 후속 — 소규모, 검수 중이라 `src/`·`e2e/`·`tests/`·`qa/`는 읽기만)**: ① `copy.md`에 M4 구현(`src/data/dashText.ts`)이 쓰는 문구 행 8개(BGM 볼륨 「BGM 볼륨」+「N%」, 나가기 확인 단계, 생각 남기기 준비 중, 읽기 전용 이름, 자산 자리표시, 기록 줄 형식, M4 임시 결정 카드, 엔딩 「사망과 선택」) — 모두 원칙(해요체/합쇼체 구분·QM2-6 확정 버튼 이름·QM3-3 가리키는 이름 일치) 안이라 **그대로 두고**, 제안 둘만 표시(자산 자리표시의 「스무 살 이후의」, 자동 모드 안내의 콜론형). ② **비활성 「다음 결정으로」 3.77:1 판단 = 면제하지 않는다**(`design-system.md` 2절 「비활성 컨트롤의 대비」): 지속 비활성은 `--c-text-3` 글자 + 점선 테두리(5.78/5.96:1), 0.4초 입력 가드의 0.55 흐림만 예외 — `ds.css` `.btn[data-unavailable='true']`, developer 구현 몫(D-23). ③ `contrast-report.md` 재생성(머리글 새 문구, 81 + 81 수치 변화 없음; `dash.css` 쌍은 생성기 범위 밖 — D-26 제안). ④ `diff-003.md` 1-1절 D-13~D-26(결정 카드 자리 M7b 전·자산 M5 전·엔딩 M7e 전은 의도, **D-20 확인 단계 버튼의 글자 200% 가로 넘침은 구현 수정 필요 후보**). ⑤ 시안을 구현에 맞춤: 도구 줄 아래 한 줄(`dashboard-infant.html?state=tools|exit` → `dashboard-tools-*`·`dashboard-exit-*` 7장), 또래 카드 칩(마스터 결정 1), 기록 단계 줄 나이 열·`flex-wrap`·높이 상한, `facts` 15.5rem, 문구를 `DASH_TEXT`에서 읽음; `shootMockups` 대시보드·카드·컴포넌트 재촬영 + `--check` 넘침 0, `tests/designAssets.test.ts` 44/44. `ai-log/2026-10-17_SPEC-003_design-M4.md`.
>
> **10차(2026-10-17, M4 착수 조건 정리 — developer 착수 전 designer 몫)**: ① **R-251** `src/styles/tokens.css` 강제 색상 블록 선택자를 `:root, :root:not([data-theme='light']), :root[data-theme='dark']`로(수동 다크 + 밝은 고대비에서도 시스템 색 매핑이 이긴다 — 값 그대로, `!important` 없음), `tests/designAssets.test.ts` 「R-251」 특이도·순서 단언(**44건**), 렌더 e2e는 M4 developer. ② M3 후속: `design-system.md` 11-6에 `@supports` 폴백 규칙(R-302)·11-8에 `<br>` 등록제(R-300), `ds.css`에 같은 폴백 블록, `contrast-report.md` 재생성(도장 예시 문구는 생성기 문자열이라 `diff-003.md` 4절에 메모). ③ **M4 대시보드 시안 점검**(11절 공통 규칙·구현된 공용 부품 기준) — 어긋난 곳을 시안 쪽에서 고쳤다: 고정 여백 150px → `.page-end-space`, 모바일 진행 줄 = 하단 띠(`--bar-h`·`bar-released`·강제 색상 위끝 선), sticky 헤더 `--head-h` + **헤더 해제 규칙**(헤더 + 고정 진행 줄 > 작은 뷰포트 50%), 헤더 첫 줄·진행 줄·도구 줄 `flex-wrap`(320 · 글자 200%에서 5열 격자가 넘쳤다), 프로필·식구 이름표 격자 컨테이너 `facts` 12.5rem 1열, 짧은 쌍 `FitPair`(가상 인구 줄·「직업 · 상태」)·`Glue`, 금액 `nowrap`, 또래 라벨 `.people__now` 항상 아래 한 줄, 접이식 도움말 44px, 기록 목록 `scroll-padding`; **밀린·오류 화면 시안 `system.html`**(DS1 공통 헤더 「저장 안내」「오류」) 신설; `copy.md` 대시보드 행 갱신 + 엔딩·밀린·오류 행 + 「대시보드 오른쪽 칸」 대체 문구 제안. 샷: 대시보드 재촬영 + `dashboard-adult-320-text200`·`-low`·`-mobile-dark`, `system-*` 6장, `shootMockups --check` 넘침 0. `src/`는 `tokens.css`만. `ai-log/2026-10-17_SPEC-003_design-M4prep.md`.
>
> **9차(2026-10-16, M3 r4 QA-003-M3 후속 뒤 — 소규모)**: 시안 `ds.css`·생성기를 r4 구현(`src/styles/doc.css`)과 다시 맞췄다 — 서류 격자 컨테이너 1열(`docbody` 11.5rem)·비교 표 카드 컨테이너 쌓기(`cmp` 35rem)·룰렛 제목 글자 크기 상한(`100cqi ÷ --title-chars`)·도장 불투명도 제거(QM3-5)·칩 이름 `<wbr>`(D-05 닫힘). `contrast-report.md` 81쌍(도장 3·띠 표기 1 포함)으로 재생성, `copy.md` 문구 3개(QM3-3·QM3-4), `design-system.md` **11-8 낱말 끊김 공통 규칙**(QM3-1·QM3-2), `diff-003.md`(D-05·D-07 닫힘 + 3-1절). 샷 4장 추가(`roulette-result-320-text200`·`birth-grid-320-text200`·`birth-compare-desktop-text150`·`birth-future-320-text150`), 룰렛·출생신고 재촬영 넘침 0. `src/`·`tests/`·`e2e/`·`qa/`는 읽기만. `ai-log/2026-10-16_SPEC-003_design-M3r4.md`.
>
> **8차(2026-10-16, M3 승인 뒤 — REV-003-M3-1 R-270)**: 룰렛·출생신고 시안을 **M3 구현과 같은 모델**에서 다시 만들었다(생성기가 `core/roulette.ts#buildRoulette`·`ui/Reel.tsx#restCells/spinCells`·`core/birthReport.ts#birthSentence`·`core/peers.ts#peersOf`·`data/birthCompare.ts`·`data/birthReportText.ts#REPORT_NOTES`… 출력을 그대로 그린다): 수저 릴 왕복 순서(R-274), 비교 표 3행 + 기대수명 한 줄 서술(R-260·R-261, 지금 세상만 R-263), 하단 표기 4~5줄, 또래 줄(이름 옆 「여성/남성」·칩 아래, R-269), 「태어난 곳」 두 칸(R-281), 문서 띠 줄바꿈·본문 기준 도장, 임차 쉼표(R-267), 지난·다가올 세상 출생신고 한 장씩(`birth.html?era=past|future`). `copy.md` 룰렛·출생신고 행을 구현 문구로 교체, **`diff-003.md`**(구현↔시안 남은 차이 D-01~D-12, 구현↔명세 S-01~S-12) 신설, `design-system.md` 11-7절. 시안 강제 색상 점검에서 **구현에도 있는 결함**을 찾았다 — 문서 띠 글자가 사라짐(D-07, developer 수정 필요). `src/`·`tests/`·`e2e/`는 건드리지 않았다. 3-000절.
>
> **7차(2026-10-16, M3 착수 정리 — 소규모)**: M2 첫 화면이 QA·검수를 거치며 시안과 달라진 점을 시안 쪽에 받아들여 `title-a.html`·`title-continue.html`·`ds.css`를 구현(`TitleScreen.tsx`·`title.css`)과 같은 구조·같은 모델로 다시 만들었고, `design-system.md`에 M3·M4가 따를 **11절 공통 패턴**(고정 요소 높이 변수 + `scroll-padding`, 띠 고정 해제, 글자 200% 리플로, 구분 기호 사슬·짧은 쌍, 강제 색상 상태 색, 컨테이너 쿼리)과 3절 **R-251 대비 메모**(`tokens.css` 강제 색상 블록 특이도 — M4 착수 때 수정)를 더했다. `copy.md`에 M2 확정 문구(「준비 중」, 캐러셀 상태 문구·값 줄/기준 줄 형식, 자살률 안내, 이전 저장 안내, 푸터 가상 인구 설명, 확인 단계 배치)를 보충했다. `src/`는 건드리지 않았다. 3-00절.
>
> **심볼은 A안 「담긴 땅」으로 확정**(형진 님 선택, 2026-10-15). 디자인 검수 1회차(`docs/review/REV-003-D-1.md`) R-120~R-136, 2회차(`REV-003-D-2.md`) R-121 재지적·R-170~R-172, 3회차(`REV-003-D-3.md`, **APPROVED**) R-190~R-192·관찰 항목을 반영했다 — 처리 내역은 각 문서 하단 「반영 내역」, 자가 검수는 `self-review.md`. 4차의 핵심은 **수저 아이콘 규칙 변경(R-121 마스터 개입)**: 머리 안에 선 무늬를 두지 않고, 칩은 실루엣·32px 이상만 닫힌 채움 표식. 5차(마무리)는 **칩 아이콘을 강제 색상·단색에서도 채운 실루엣으로(R-190)**, 엔딩 문구를 함수 출력·`REBIRTH_NOTE`로(R-191), 상태 바 4색을 수저 5색·▲▼과 ΔE2000 15 이상 떨어뜨리고(R-192), 은·금 큰 변형의 광택을 구멍 대신 밝은 채움으로 바꿨다. **6차(REV-003-D-4 후속, M1 종결 뒤 소규모)**: 은·금 표식 `fill`을 고정값 + `style` 변수로 이중 지정(iOS Safari 속성 안 `var()` 대비)하고 강제 색상에서 `--sp-mark: Canvas`(두 극성 모두 표식 유지), 상태 4색을 명도 차·색각 시뮬레이션 기준으로 다시 골랐으며(R-195 — 지식 색 이름은 「파랑」), 서술 불일치를 바로잡았다(R-196). 3-0절.

## 1. 산출물 지도

| 무엇 | 어디 | 비고 |
|---|---|---|
| 디자인 시스템 문서 | `design-system.md` | 톤·색 토큰·테마 규칙(+ 3절 R-251 메모)·글꼴·간격·컴포넌트·사용 예·구현 주의 12항·**11절 공통 패턴(M3·M4가 따른다)** |
| **문구 기준표** | `copy.md` | 화면·자리·문구·바꾼 이유(인용 없이 SPEC 항목·검수 ID로만). **3절 수저 구간 규칙 + 5단계 × 3시대 예시표**(R-170). 7차: M2 확정 문구 보충. 8차: 룰렛·출생신고 행을 M3 구현 문구(`src/data/birthReportText.ts` 정본)로 — 비교 표 열 「전체 평균 / 이 가정 형편」·안내 「(학생, 가구)」·기대수명 한 줄·주거 3칸·릴 왕복·하단 표기(세상별)·또래 「여성/남성」·지역 확률표 주석 세 가지 |
| **차이 목록** | `diff-003.md` | 구현 ↔ 시안 남은 차이(D-01~D-12: 정적 시안의 한계 — `<wbr>` D-05·강제 색상 띠 D-07은 **r4 뒤 닫힘**) · 구현 ↔ 명세 차이(S-01~S-12: 주거 3칸 R-267, 비교 표 R-260~R-263, 「태어난 곳」 2칸 R-281, 릴 왕복 R-274 …) · 재생성으로 사라진 차이(3절·**3-1절 r4 뒤**) · designer 후속 |
| 토큰(값의 원본) | `src/styles/tokens.css` | 라이트/다크/강제 색상/움직임 줄이기. 6차: 상태 바 4색 = 건강 연지 #cb2360/#ef4d92 · 행복 자주 #d048a9/#d243b8 · 지식 파랑 #2778ff/#3d7ff0 · 관계 보라 #6232b8/#bb9ade(수저 5색·▲▼과 ΔE2000 ≥ 15, 서로 ≥ 12, 링크·포커스와 ≥ 10, 지식↔관계·행복↔관계 ΔL\* ≥ 12, protan·deutan 시뮬레이션 ≥ 8 — R-192·R-195). 강제 색상 블록에 `--sp-mark: Canvas` |
| 컴포넌트 참고 구현 | `mockups/ds.css` | 시안 HTML이 쓰는 클래스. 구현의 기준. 7차: 첫 화면·캐러셀·하단 띠·강제 색상 블록을 `src/styles/title.css`와 같은 블록으로(`--bar-h`·`scroll-padding`·`bar-released`, `.keep-phrase`·`.pair` 컨테이너 쿼리, `.slides`/`.slide.is-active`, `.radio-card.is-disabled`, 주 버튼 hover 시스템 색 짝) |
| 대비 점검 | `contrast-report.md` (자동 생성) | 라이트 81쌍 + 다크 81쌍(토큰 쌍 77 + `doc.css` 장식 도장 3·띠 표기 1 — 불투명도 합성, QM3-5), 실패 0 |
| 심볼·로고 (A안) | `src/assets/symbol-a.svg`(정식), `logo-a.svg`(가로), `src/assets/brand/a/`: `symbol-dark/mono`, `symbol-small(-mono)`(단순화), `logo-dark/mono`, `logo-header(-dark/-mono)`(헤더용), `logo-stacked*`, `favicon.svg`, `favicon-32.png`, `apple-touch-icon.png`, `icon-512.png`, `app-icon.svg`; `src/assets/brand/wordmark*.svg` | 도형 원본 `scripts/design/{geo,brandSymbols,brandGeometry}.mjs` |
| 아이콘 스프라이트 | `src/assets/icons/ui-icons.svg`(24px 선 아이콘 18개), **`spoon-grades.svg`** | 수저 아이콘 심볼 10개: **`sp-1`~`sp-5` = 칩 변형**(≤ 24px: 칩 15×24·큰 칩 20×32·릴 — 무늬 없는 실루엣, `currentColor` 채움뿐. 강제 색상·단색에서도 **채운 실루엣**이며 외곽선 변수가 없다, R-190), **`sp-1-lg`~`sp-5-lg` = 큰 변형**(≥ 32px: 첫 화면 띠 32×52·컴포넌트판 — 닫힌 채움 표식만. 은·금의 광택은 밝은 채움 `fill="#fff" style="fill:var(--sp-mark,#fff)"` — 기본 흰빛, 변수는 `style`로만(속성 안 `var()`는 iOS Safari 등이 무시할 수 있다, REV-003-D-4), 강제 색상은 `Canvas`). developer는 칩에 `#sp-N`, 첫 화면 띠에만 `#sp-N-lg`. **아이콘을 이름·점 없이 단독으로 쓰지 않는다**(화면 시안은 테스트가 단언) |
| 얼굴 | `src/assets/faces/faceLayers.ts`, 문서 `faces.md` | 80조합 순수 함수. 4차: 중년 구레나룻 토막·노년 결 줄·청소년 남 앞머리 |
| 화면 시안(HTML) | `mockups/*.html` | `title-a`(**7차: 구현과 같은 모델의 캐러셀 14장 전부, `?slide=<id>`로 보이는 슬라이드 선택** — 예 `suicide-rate`·`marriage-count`), `title-continue`(**`?state=confirm`으로 확인 단계**), **`roulette-spin/result`·`roulette-result-reduced`(8차: `buildRoulette` 모델 — 왕복 릴·실제 확률표·한 프레임 고정 회전)**, **`birth`(8차: 지금 세상 시안 주인공, `?era=past` / `?era=future`는 구현 출생 생성기 출력의 지난·다가올 세상 — 비교 카드 없음)**, `dashboard-infant/adult`, `decision-infant/adult`, `note`, `ending`, `components`, `symbols`, `faces`, `faces-all`, **`spoon-sizes`**(아이콘 실제 크기 시트) (`?theme=dark`, `&motion=reduce`, 시트는 `?mono=1`). 하단 띠가 있는 시안은 `page()`의 흉내 스크립트가 `--bar-h`·`bar-released`를 걸고 FitPair(짧은 쌍)를 잰다(구현은 `watchBarRelease`·`ResizeObserver`) |
| **M5 시안** | `mockups/economy-m5.html` | 13차 손글 → **14차부터 생성기 `buildMockups.mjs#economyPage()` 출력**(구현 컴포넌트 `ImpactLine`·`ImpactHint`·`AssetsCard`·`StatusCard`·`FinalNetLine` + `IMPACT_SR`, D-35 닫힘). `?state=` 9상태: 선택지 영향 줄(47세 보증 결정 · 13세 「집안 살림」 · 항목 1·3·6개와 지속 비활성 견본 + 스크린리더 문장 표), 자산 카드(지금 세상 음수 · 지난 세상 「지금 가치로 환산」 · 폭 점검 극단값), 엔딩 최종 순자산(지금 · 지난 세상 음수 · 스무 살 전). 샷 `screens/003/economy-*.png`(`-panel`·`-list`·`-card` = 요소 단위) |
| 시안 스크린샷 | `screens/003/*.png` (화면 85장 + 9차 4장 + **10차 9장**(`dashboard-adult-{mobile-dark,320-text200,low}`, `system-superseded-{mobile,mobile-forced,desktop}`, `system-error-{mobile,mobile-dark,desktop}`) + 아이콘 시트 5장 + 상태색 색각 시트 1장 + 강제 색상 두 극성 띠 2장) | 모바일 360×740(DPR 2)·데스크톱 1280×800·320×640·**low 320×256**(400% 확대 상당), `-dark`·`-forced`·`-reduced`·**`-textNNN`(글자 크기 %)**·`-full`·`-bottom`. **8차 룰렛·출생신고 33장**: `roulette-spin-{mobile,desktop,320}`, `roulette-result-{mobile,mobile-dark,mobile-forced,desktop,320}`, `roulette-result-{mobile,desktop}-reduced`, `birth-top-{mobile,mobile-full,mobile-dark,mobile-forced,desktop,320,320-text200}`, `birth-bottom-{mobile,desktop}`, `birth-peers-{mobile,320}`, `birth-compare-{mobile,desktop,320}`, `birth-past-{mobile,mobile-full,desktop}`·`birth-past-bottom-desktop`, `birth-future-{mobile,mobile-full,desktop,320-full}`·`birth-future-bottom-desktop`. **7차 첫 화면(재촬영 + 8장 추가)**: `title-a-*`(기본 1/14 합계출산율), `title-a-suicide-mobile/-320`(B형 기준 줄 「27.8명」/「인구 10만 명당 · 2025년 기준」 + 상담전화 안내), `title-a-pair-split-320`(「통계 기준」 짧은 쌍의 두 줄 모드), `title-a-marriage-mobile/-desktop`(조혼인율 줄), `title-continue-*`, `title-confirm-mobile/-desktop`(확인 단계 배치), **`title-confirm-low`**(320×256 — 띠가 절반을 넘어 고정이 풀려 본문 끝에 놓인 모습, QM2-12). **`spoon-sizes-dpr1.png`** = DPR 1 실제 크기 + 4배 확대(밝은·다크·강제 색상·단색, 부분 파일 `spoon-sizes-dpr1-{light,dark,forced,mono}.png`). **`status-colors-cvd.png`** = 상태 4색 정상·protan·deutan·tritan 네 줄(라이트·다크, 수저 5색·▲▼·링크·포커스 견본 포함). `title-a-mobile-forced-band.png`·`-forced-dark-band.png` = 첫 화면 띠의 강제 색상 검은 글자·흰 글자 극성(은·금 표식 유지) |
| 자가 검수 | `self-review.md` | reviewer 기준 7항목, R-ID별 근거 이미지(이미지를 보고 판단한 결과만 적는다) |
| 저작권·라이선스·문구 대조 | `credits.md` | 외부 자산 0, 글꼴 결정 근거, 캡처 비복제(문구 인용 0)·상태 바 색 변경 사유 |
| 보관 | `archive/brand-bc/`(B·C 심볼·로고·아이콘), `archive/screens-r1/`(1회차 B·C 첫 화면·비교판 스크린샷) | 기록용. 구현 참조 금지 |
| 작업 기록 | `ai-log/2026-10-15_SPEC-003_design-M1.md`, `ai-log/2026-10-16_SPEC-003_design-M3prep.md`, `ai-log/2026-10-16_SPEC-003_design-M3.md`, `ai-log/2026-10-16_SPEC-003_design-M3r4.md`, `ai-log/2026-10-17_SPEC-003_design-M4prep.md`, `ai-log/2026-10-17_SPEC-003_design-M4.md`, `ai-log/2026-10-17_SPEC-003_design-M4r2.md` | 2차·3차·4차·5차·6차(후속) / 7차(M3 착수 정리) / 8차(M3 승인 뒤 시안 맞춤 R-270) / 9차(M3 r4 후속) / 10차(M4 착수 정리: R-251·폴백 문서·대시보드 시안 점검·`system.html`) / 11차(M4 구현 뒤: 문구 행·비활성 대비 결정·`diff-003.md` 1-1절·도구 줄 아래 한 줄 시안) / 12차(M4 r2 뒤: 「준비 중」 알약·`.ending__who`·제목 상한·D-20/D-23 닫힘·72px 중년 단서 검토) |

### 먼저 볼 스크린샷 (형진 님·검수자용)
1. `screens/003/spoon-sizes-dpr1.png` — **수저 아이콘 실제 픽셀 크기 시트**(R-121·R-190 완료 근거: 16·20·24px 칩 실루엣이 강제 색상·단색에서도 채움, 32·48px 큰 변형의 은·금 밝은 광택, 밝은·다크·강제 색상·단색, 실제 칩 24px·큰 칩 32px 줄)
2. `screens/003/title-a-mobile.png` — 첫 화면 모바일(다섯 자루 띠 = 큰 변형. 다크 `-dark`에서 은·금 광택이 밝은 채움, 강제 색상 `-forced`, 320px `title-a-320.png`)
3. `screens/003/roulette-result-mobile-reduced.png` — 움직임 줄이기 룰렛(결과 상태 + 안내), `roulette-result-mobile.png`(「흙수저(하위 25% 안쪽) · 경기」)
4. `screens/003/birth-top-mobile.png`, `dashboard-adult-mobile.png`(+`-forced`), `ending-mobile-full.png`, `components-desktop-full.png` — 수저 구간 표기(칩 + 「(하위 25% 안쪽)」, 엔딩 범례는 칩 시작점 들여쓰기), 상태 바 4색(연지·자주·파랑·보라)과 수저 5색·▲▼의 구분, 엔딩 문장(함수 출력 그대로, `REBIRTH_NOTE`, 시안 주석 표시)
5. `screens/003/faces-48-desktop-full.png`, `faces-small-sizes.png` — 얼굴(중년 구레나룻·노년 흰머리·청소년 남 수정, 48·72·96px 실제 크기)
6. `screens/003/status-colors-cvd.png` — **상태 4색 색각 시뮬레이션**(R-195: 정상·protan·deutan·tritan × 라이트·다크, 줄마다 최소 ΔE2000·ΔL\* 표기), `title-a-mobile-forced-dark-band.png` — 흰 글자 고대비에서도 은·금 표식이 남는 띠
7. **7차(M3 착수 정리)** `screens/003/title-a-desktop.png`(조작 줄이 카드 머리, 「0.80<small>명</small>」/「2025년 기준」 두 줄), `title-a-marriage-mobile.png`(조혼인율 줄), `title-a-suicide-320.png`·`title-a-pair-split-320.png`(B형 기준 줄, 「통계 기준」 쌍의 두 줄 모드), `title-confirm-mobile.png`(확인 단계 — 맨 아래 「돌아가기」), `title-confirm-low.png`(320×256에서 띠 고정 해제), `title-a-mobile-full.png`(「준비 중」 카드, 푸터 쉼표 나열)
8. **8차(M3 승인 뒤, R-270)** `screens/003/roulette-result-mobile.png`(왕복 릴 — 창 위아래가 「은 · 동 · [흙] · 동 · 은」, 「흙수저(하위 25% 안쪽) · 경기」), `roulette-spin-mobile.png`(가장 빠른 구간 프레임), `birth-top-desktop.png`(3열 격자 — 「태어난 곳」 두 칸), `birth-top-mobile-full.png`·`birth-bottom-desktop.png`(비교 표 3행 + 「(학생, 가구)」 안내 + 기대수명 한 줄 서술 + 하단 표기 4줄), `birth-peers-320.png`(또래 — 이름 옆 「여성/남성」, 칩이 이름 아래), `birth-top-320-text200.png`(띠 표기가 제목 아래 줄, 도장은 본문 기준), `birth-past-mobile-full.png`(1961년생 — 지난 세상 지역 표기·하단 5줄·비교 카드 없음), `birth-future-mobile-full.png`(다이아몬드수저·「전남광주통합특별시」), `birth-top-mobile-forced.png`(강제 색상 띠 글자 보임 — 구현 쪽 결함 D-07의 기대 모습)
(그 밖에 `components-desktop-full.png` 수저 절, `dashboard-infant-mobile-full.png` 자산 현황(칩 없음), `symbols-desktop-full.png`)

## 2. 심볼 A안 「담긴 땅」 — 확정 내용

- 뜻: 비스듬히 선 숟가락의 머리 안에 한반도가 비어 있다(음각) — **태어날 때 쥐는 숟가락 안에 이 땅의 인생이 들어 있다.** 한반도는 하나의 실루엣(분단선·국경선·행정 경계 없음), 제주·울릉도·독도 포함, 색은 쪽빛 하나(다크 크림색, 단색판 currentColor).
- **정식 심볼**(≥ 48px: 첫 화면·앱 아이콘·터치 아이콘): 머리 안 지도의 높이 = 머리 높이의 **74%**(기준 70% 이상, `buildBrand`가 측정·점검). 섬 면적은 제주 > 울릉도 > 독도(제주가 울릉도의 2배 이상, `tests/designAssets.test.ts`).
- **단순화 심볼**(≤ 40px: 모든 화면 헤더·파비콘): 지도 윤곽 14점, 섬 생략, 머리를 키우고 자루를 굵게. 28px에서도 금 간 숟가락·번개·열쇠로 읽히지 않는다(`symbols-desktop-full.png` 사다리). 돋보기 오독 여지는 마스터 결정으로 이번엔 손대지 않았다.
- 헤더 로고 `brand/a/logo-header.svg` 40px → 워드마크 글자 높이 약 23px(기준 ≥ 22px). 첫 화면 세로 로고 236px → 글자 약 62px(기준 ≥ 40px).
- 금지: 한반도 실루엣 단독 사용(항상 숟가락과 한 묶음), 하늘색·연파랑 계열, 기울임·늘임·임의 색.
- 고르지 않은 B 「상 위에」·C 「상차림」: `archive/brand-bc/`.

## 3-000. 8차(2026-10-16, M3 승인 뒤 시안 맞춤 — REV-003-M3-1 R-270)에서 바뀐 것 — 요약

| 영역 | 바뀐 것 | 근거 |
|---|---|---|
| 룰렛·출생신고 시안 ↔ 구현 | 생성기가 **구현 모델에서 읽는다**: 시안 주인공의 저장 상태(`HERO_STATE`, 저장 검증 통과) → `buildRoulette`(확률표·왕복 릴·멈출 자리)·`restCells/spinCells/reelPosition`(릴 칸·회전 프레임)·`birthSentence`·`reportPlaceLabel`·`bandLabel(startBandOf)`·`standingLabel(looksStanding/weightStanding)`·`peersOf(61)`·`placeLabel`·`buildComparison`·`lifeGapLine`·`REPORT_NOTES`·`getRegionFootnote`·`ROULETTE_TEXT`·`BIRTH_TEXT`·`HOUSING_LABEL`·`OCCUPATION_LABEL`·`parentingDocText`. 지난·다가올 세상 출생신고는 `generateBirthFromSeed(12·229)` 출력(`birth.html?era=`) | REV-003-M3-1 R-270·R-267·R-274, R-260~R-264·R-269·R-280·R-281, dev-M3·r2·r3 「시안과 다른 점」 |
| `ds.css` | 룰렛·출생신고·표·칩 블록을 `src/styles/doc.css`와 같은 블록으로(릴 `--reel-item-h`·`.is-fast`·`auto-fit`, 띠 `flex-wrap`·`.doc__tag`, 본문 기준 `.stamp`, `.span-2`·`.cell-sub`, `.people__who`, `.doc-notes`, `.table--cmp` 접힘·`.cmp__source/__note`, 칩 `flex-wrap` 규칙, `.fit-pair`), 강제 색상(창 화살표·**띠 Canvas/CanvasText**) | 구현 CSS 1:1 대조 |
| 생성기·촬영기 | `mockLib.mjs#fitPair` + `page()` FitPair 흉내 스크립트, `shootMockups.mjs` `text`(글자 크기 %) 옵션·`-textNNN` 접미사, 320px 전수 점검을 (파일, 질의) 조합으로, `overflowReport`가 clip으로 접은 조상 안을 제외(e2e 측정기와 같은 규칙), 룰렛·출생신고 샷 33장 | — |
| 문서 | `copy.md` 룰렛·출생신고 행 교체 + 3-2절(지역 표기·주거·점 읽기 이름), **`diff-003.md` 신설**, `design-system.md`(머리 요약·6절 수저 칩/표/출생신고 문서/룰렛 릴·10절 6·10항·11-5 시스템 색 배경 백플레이트·**11-7 신설**) | R-270 |
| 발견(구현 쪽) | **D-07** 강제 색상에서 출생신고 띠 제목·표기가 보이지 않음(토큰 `--c-brand: ButtonText`가 시스템 색이라 바탕이 남고 글자 뒤 백플레이트) — 구현 스크린샷에도 있음. developer가 `doc.css`에 `.doc__band { background: Canvas; color: CanvasText }` + e2e 단언 | `diff-003.md` D-07 |
| 검증 | `buildMockups` → `shootMockups`(전체 85장 + 320px 전수 점검 라이트·다크, (파일, 질의) 조합) **넘침 0** → `vitest tests/designAssets.test.ts` **42/42** | — |

## 3-00. 7차(2026-10-16, M3 착수 정리 — 소규모)에서 바뀐 것 — 요약

| 영역 | 바뀐 것 | 근거 |
|---|---|---|
| 첫 화면 시안 ↔ 구현 | `title-a.html`·`title-continue.html`을 구현과 같은 구조로: 격자 안 본문 → 카드 → 푸터(R-220), 캐러셀은 `core/carousel.ts#buildCarousel` 모델 14장 전부(조작 줄이 카드 머리, 값 줄 「27.8<small>명</small>」 + 기준 줄 「인구 10만 명당 · 2025년 기준」, 조혼인율 줄, 범례·출처·「통계 기준」 줄, `Glue`·`Pair` 마크업), 수저 띠 `flex-wrap`, 「약 1시간」 카드 「준비 중」(`is-disabled`), 푸터 4줄(이름 출처 링크·통계 출처 쉼표 나열·가상 인구 설명·빌드 버전), 확인 단계(`?state=confirm`) 안내문 + 「이전 판 지우고 태어나기」 / 맨 아래 「돌아가기」. 문구는 `titleText.ts`·`ERA_CONFIG`·`names.json`에서 읽는다(지금 세상 작은 글씨만 M3 목표값 「올해(2026) 태어나는 아이」) | dev-M2 r4~r6 로그 「시안과 다른 점」, QM2-4·6·10·11·12, R-200·R-204·R-220 |
| `ds.css` | 하단 띠(`--bar-h`·`.bottom-bar__ask/__stack`·`html.has-bottom-bar` scroll-padding·`html.bar-released`), 첫 화면 격자(960px 이상 2열 + 카드 2줄 걸침·`max-height`에 `--bar-h`), `.keep-phrase`·`.pair` + `@container` 14em/16.5em, 캐러셀 블록(`.carousel__head/__heading/__note/__status/__pause`, `.slides`/`.slide.is-active`, `.slide__value` 칸 폭 맞춤 `cqw`, `.slide__basis/__side`, 그래프 글자 13px + `paint-order`, 범례), `.radio-card.is-disabled`, 강제 색상(주 버튼 hover·active `Highlight` 짝, `GrayText`, `svg.logo`, 띠 `border-top`) | `src/styles/title.css`와 같은 블록 |
| 생성기·촬영기 | `mockLib.mjs#page()`에 띠 높이 흉내 스크립트(`--bar-h`·`bar-released`, `100svh` 탐침), `buildMockups.mjs` 첫 화면·캐러셀 재작성(그래프는 `StatsChart.tsx`와 같은 마크업), `shootMockups.mjs`에 `low` 320×256 뷰포트·`query`·`to` 옵션·`--check`(샷 없이 320px 전수 점검) | — |
| 문서 | `design-system.md` 11절 공통 패턴(11-1 고정 요소·포커스, 11-2 띠 해제, 11-3 글자 200%, 11-4 구분 기호·짧은 쌍·값 줄, 11-5 강제 색상 상태 색, 11-6 컨테이너 쿼리), 3절 R-251 메모, 6절 캐러셀·띠·라디오 카드·헤더 행, 10절 12항. `copy.md` 행 7개 보충 | CM10·CM11·QM2-1·3·5·10~12, REV-003-M2-5 R-251 |
| 검증 | `shootMockups title`(17장 + 넘침 0) · `--check`(320px 전수 라이트·다크 넘침 0) · `vitest tests/designAssets.test.ts tests/titleScreen.test.tsx` 84/84 | — |

## 3-0. 6차(REV-003-D-4 후속, M1 종결 뒤 소규모)에서 바뀐 것 — 요약

| 영역 | 바뀐 것 | 지적 |
|---|---|---|
| 은·금 큰 변형 표식 | `spoon-grades.svg`의 `sp-3-lg`·`sp-4-lg` 표식을 `fill="#fff" style="fill:var(--sp-mark,#fff)"`로 이중 지정(속성은 고정값, 변수는 `style`) — 속성 안 `var()`를 무시하는 엔진(iOS Safari 등)에서도 표식이 흰빛. id·경로·viewBox 그대로. 다른 SVG(로고·심볼)는 이미 `style`만 썼다. 테스트 「SVG 프레젠테이션 속성 값에 var() 금지」 추가 | 확인 못 한 것 |
| 강제 색상 표식 | `tokens.css` 강제 색상 블록에 `--sp-mark: Canvas` — 검은 글자·흰 글자 두 극성 모두 몸체(CanvasText) 위에 바탕색 표식이 남는다(`title-a-mobile-forced-band.png`·`-forced-dark-band.png`). `ds.css`·`title.css`에 따로 둘 규칙 없음(5절) | 관찰 (a) |
| 상태 4색 | 라이트 건강 #cb2360(유지)·행복 #d048a9·지식 #2778ff·관계 #6232b8, 다크 건강 #ef4d92(유지)·행복 #d243b8·지식 #3d7ff0·관계 #bb9ade. 이웃 쌍 ΔL\* 지식↔관계 18.4/14.2·행복↔관계 18.2/15.6, protan·deutan 최소 ΔE2000 10.6/10.8, 수저·▲▼ 최소 15.3/15.4, 링크·포커스 최소 11.3/16.0, 상태색끼리 15.5/12.2, 대비 실패 0. 지식 색 이름 「파랑」(쪽빛은 브랜드) | R-195 |
| 금지 범위 | 「35°~170° 일괄 금지」 → 자리별 금지(건강 녹 90~170°, 행복 황 35~70°, 캡처 계열 순서 금지) + 색상 차 ≥ 20°를 원형 거리로 실제 계산 | R-195·R-196 |
| 테스트 | `tests/designAssets.test.ts` 38 → **42건**: 자리별 금지·원형 색상 차, R-192에 링크·포커스(≥ 10), R-195① ΔL\*, R-195② 색각 시뮬레이션(Machado 2009 행렬 자기 점검 포함), SVG 속성 `var()` 금지, 화면 시안 열두 장의 수저 아이콘 단독 사용 0. `checkContrastLib.ts`에 `lightness`·`hueOf`·`hueDistance`·`simulateCvd` | R-195·R-196 |
| 도구·시트 | `scripts/design/previewStatColorsCvd.mjs` → `screens/003/status-colors-cvd.png`(정상·protan·deutan·tritan 네 줄 × 두 테마) | R-195 |
| 서술 정정 | `self-review.md` :15 절 번호(0-2절)·「0건」 서술, `design-system.md` §10.11 「테스트가 막는 것」을 사실대로(단독 사용은 시안 테스트가 막고 구현은 developer 몫), 테스트 주석 「20° 간격」을 실제 계산으로 | R-196 |

## 3. 5차(REV-003-D-3 마무리)에서 바뀐 것 — 요약

| 영역 | 바뀐 것 | 지적 |
|---|---|---|
| 수저 칩 아이콘 | 강제 색상·단색에서도 **CanvasText(currentColor)로 채운 실루엣**(외곽선 아님). `spoon-grades.svg`의 칩 변형에서 stroke·외곽선 변수 제거, ds.css 강제 색상 규칙은 `color: CanvasText`뿐. 시트의 칩 변형 줄을 실제 `.grade svg.spoon` CSS 경로로 재촬영 + 큰 칩 32px 줄 추가. `design-system.md` §1·§6·§10에 「아이콘은 이름·점 없이 단독 사용 금지」 | R-190(마스터 결정) |
| 엔딩 문구 | `copy.md`·생성기: 엔딩 문장은 `endingText.ts`·`lifeText.ts` 출력 그대로, 어체는 C1·M7e를 따른다(시안은 M7e 전 현행 출력 — 시안 주석으로 표시). 연표 사망 줄 = `deathEntryText`(요약과 같은 어체). 다시 태어나기 안내 = `REBIRTH_NOTE` 그대로. 출발선 막대 `aria-label` = `bandLabel`·`standingLabel`·`MOVEMENT_TEXT` 조합(생성기가 함수 호출) | R-191 |
| 상태 바 4색 | (5차 당시 값 — 6차에서 재조정, 3-0절) 건강 연지 #cb2360/#ef4d92 · 행복 자주 #a3248c/#d884dc · 지식 파랑 #1f4db6/#4a8de8 · 관계 보라 #7040c8/#a078f0 — 수저 5색·▲▼과 두 테마 모두 ΔE2000 ≥ 15, 서로 ≥ 12, 바↔트랙 3:1 이상, 녹·황 계열 아님. `checkContrastLib`에 CIEDE2000 추가, 테스트 2건 | R-192 |
| 큰 변형 은·금 | 광택을 evenodd 구멍 대신 **밝은 채움**(`var(--sp-mark,#fff)`)으로 — 다크 테마·강제 색상에서 「어두운 흠」으로 뒤집히지 않는다. id·경로·viewBox 그대로 | 관찰 |
| 엔딩 범례·주석 | 구간 글자가 줄바꿈될 때 칩 시작점에 들여쓰기(격자 2열 + `.grade-line`), 구간 글자 굵기를 출생신고와 통일(굵게), 시안 주석을 `.mock-tag`(점선)로 구분 | 관찰 |
| 문서 한정 | `credits.md` 「띠·강조색에 적갈색·청록을 쓰지 않았다」·「캡처 문구는 디자인 문서에는 옮겨 적지 않는다」(`copy.md`도 같게), `self-review.md` 잔여 인용 제거 | 관찰 |

## 3-1. 4차(REV-003-D-2 반영)에서 바뀐 것 — 요약

| 영역 | 바뀐 것 | 지적 |
|---|---|---|
| 수저 아이콘 | **규칙 변경**: 머리 안 선 무늬 금지(모든 크기). 칩 변형 `sp-N` = 실루엣, 큰 변형 `sp-N-lg` = 닫힌 채움 표식(흙 더미 / 동 없음 / 은 짧은 광택 / 금 점 / 다이아 마름모). DPR 1 실제 크기 시트 + 테스트 2건 | R-121(마스터 개입) |
| 수저 구간 표기 | `bandLabel(startBandOf(era, wealth))` 한 함수 출력, 「흙수저(하위 25% 안쪽)」 — 룰렛 결과·출생신고·프로필·엔딩 출발선. `copy.md` 3절 예시표(5단계 × 3시대). 엔딩 회고 문장은 `endingText.ts` 출력 그대로. 영유아 「자산 현황」 칩 제거 | R-170 |
| 룰렛 움직임 줄이기 | 별도 시안 `roulette-result-reduced`: 결과 상태 + 안내 한 줄 + 「출생신고 보기」. 릴 순서 = 확률표 순서로 고정 | R-171 |
| 문서 정합 | 「카드 접기」·「다른 집 아이들과 견주면」 통일, `copy.md`·`credits.md`에서 캡처 문구 인용 제거, 캐러셀 **7초**·「1 / 14」 일치, 상태 바 색에서 녹·황 계열 제거(5차에서 다시 조정) | R-172 |
| 얼굴 | 중년 구레나룻 짧은 토막, 노년 가는 윤곽선 + 회색 결 줄, 청소년 남 앞머리 | 관찰(마스터 추가) |
| 시안 데이터 | 또래 1 「대전광역시 서구 · 흙」 | 관찰 |
| 도구 | `shootSpoonSizes.mjs`(DPR 1 시트), `previewFaces.mjs`(얼굴 실제 크기), `zoomCrop.mjs`(픽셀 확대) | — |

3차(REV-003-D-1)에서 바뀐 것은 `REV-003-D-1.md` 하단 「반영 내역」에 있다.

## 4. 다시 만드는 법 (순서대로)

```
node scripts/design/buildBrand.mjs             # 심볼·로고 SVG, 앱 아이콘 PNG (크로미움 필요). 지도 70%·머리 안쪽 여유 점검 포함
npx vite-node scripts/design/buildIcons.mjs    # 아이콘 스프라이트 (sp-N·sp-N-lg 포함)
npx vite-node scripts/design/buildMockups.mjs  # 시안 HTML (koreaStats.json·koreaStatsAccess.ts·endingText.ts를 읽는다)
npx vite-node scripts/design/shootMockups.mjs [이름조각 | --check]  # 스크린샷 85장 + 넘침 점검(문서·요소 단위, 360·1280·320·low 320×256·다크·강제 색상·움직임 줄이기·글자 크기 %) — 0건이 아니면 종료 코드 1. 이름조각(예 title, birth)은 그 샷만, --check는 샷 없이 320px 전수 점검만(시안 파일 × 주소 질의 조합 × 라이트·다크)
npx vite-node scripts/design/shootSpoonSizes.mjs   # 수저 아이콘 DPR 1 실제 크기 시트 (spoon-sizes-dpr1.png)
npx vite-node scripts/design/previewStatColorsCvd.mjs   # 상태 4색 색각 시뮬레이션 시트 (status-colors-cvd.png) — 상태 토큰을 고치면 다시
npx vite-node scripts/checkContrast.ts --write     # 대비 보고서
npx vitest run tests/designAssets.test.ts          # 자산 계약(토큰·상태 색·얼굴·숟가락 도형·심볼·아이콘 R-121·문구 기록)
npx vite-node scripts/design/previewFaces.mjs [out.png]   # (작업용) 얼굴 48·72·96px 시트
node scripts/design/zoomCrop.mjs <in.png> <x> <y> <w> <h> <배율> <out.png>   # (작업용) 픽셀 확대
node scripts/design/previewBrand.mjs <png>     # (작업용) 심볼·로고 미리보기
```
시안 HTML은 `file://`로 바로 열린다(`?theme=dark`로 다크, `&motion=reduce`로 움직임 줄이기). 정적 서버가 필요 없다.

## 5. developer에게 (M2~ 구현 주의)
- **M3·M4(룰렛·출생신고·대시보드)**: 하단 띠·고정 헤더·글자 200%·구분 기호·강제 색상 상태 색·컨테이너 쿼리는 `design-system.md` **11절 공통 패턴**을 그대로 쓴다 — 첫 화면의 `watchBarRelease`·`focusReveal`·`Glue`·`Pair`와 e2e 도구(`auditFocus`·`STANDARD_VIEWPORTS`·`textResize`·`lineBreaks`)를 재사용한다. `tokens.css` 강제 색상 블록의 특이도(R-251)는 M4 착수 때 designer가 고친다(3절 메모).
- 헤더 로고는 `brand/a/logo-header.svg`(또는 인라인), 높이 `--logo-h-header`(40px). 첫 화면은 `brand/a/logo-stacked.svg`(모바일)·`logo-a.svg`(데스크톱 108px). 파비콘·터치 아이콘은 `brand/a/favicon.svg`·`favicon-32.png`·`apple-touch-icon.png`·`icon-512.png`.
- **수저 아이콘**: 칩·릴·서류·프로필·엔딩은 `#sp-N`, 첫 화면 띠(32×52)만 `#sp-N-lg`. 강제 색상에서 칩 아이콘은 `.grade svg.spoon { color: CanvasText }`만 — **외곽선으로 바꾸지 않는다**(R-190, 스프라이트에 외곽선 변수가 없다). 아이콘을 이름·점 없이 단독으로 쓰지 않는다. 은·금 큰 변형의 밝은 표식은 `--sp-mark`(기본 흰빛)로만 바꾼다. 머리 안에 선 무늬를 더하지 않는다(테스트가 막는다).
  - **6차 스프라이트 교체(M2 배포 전)**: `spoon-grades.svg`는 그대로 바꿔 끼운다 — id·경로·viewBox 동일, 바뀐 것은 `sp-3-lg`·`sp-4-lg` 표식의 `fill="var(--sp-mark,#fff)"` → `fill="#fff" style="fill:var(--sp-mark,#fff)"`뿐. 화면 코드 수정 없음.
  - **강제 색상 표식**: `tokens.css`의 `@media (forced-colors: active) { :root { --sp-mark: Canvas } }`가 이미 있고 앱은 `main.tsx`가 `tokens.css`를 읽으므로 **`title.css`에 넣을 것은 없다.** 만약 띠를 `tokens.css` 없이 그리거나 `title.css`의 강제 색상 블록에서 띠 아이콘에 `forced-color-adjust: none`을 주게 되면 그 블록에 한 줄만 더한다: `.spoon-lineup svg.spoon--lg { --sp-mark: Canvas; }`. 기대 모습: 검은 글자 고대비 = 검은 몸체 위 흰 표식, 흰 글자 고대비 = 흰 몸체 위 검은 표식(`screens/003/title-a-mobile-forced-band.png`·`-forced-dark-band.png`).
  - SVG 자산에 CSS 변수를 쓸 때는 프레젠테이션 속성(`fill="var(…)"`)이 아니라 `style="fill:var(…)"`로 — `tests/designAssets.test.ts`가 `src/assets` 전체를 단언한다.
- **엔딩**: 회고 문장·연표 사망 줄·다시 태어나기 안내는 `endingText.ts`(`deathLineText`·`choiceCountText`·`journeyText`·`MOVEMENT_TEXT`·`JOURNEY_NOTE`·`REBIRTH_LABEL`·`REBIRTH_NOTE`)·`lifeText.ts#deathEntryText` 출력 그대로(어체는 M7e가 바꾼다). 출발선 막대 `aria-label`은 「출발선 {bandLabel}, 마지막 {standingLabel}. {MOVEMENT_TEXT}」 조합(R-191). 범례의 칩 + 구간은 `.grade-line` 안에 함께.
- **상태 바 색**: 토큰 이름은 그대로, 값만 바뀌었다(5차·6차 모두 코드 수정 없음). 문서·코드 주석에서 지식 색은 「파랑」이라 부른다(「쪽빛」은 브랜드 `--c-brand`). 새 색을 더할 때는 `tests/designAssets.test.ts`의 네 규칙(수저 5색·▲▼과 ΔE2000 ≥ 15, 상태색끼리 ≥ 12, 링크·포커스 ≥ 10, 이웃 쌍 ΔL\* ≥ 12, protan·deutan 시뮬레이션 ≥ 8, 자리별 색상 금지)을 통과해야 한다. 상태 카드 안에 링크 글자(`--c-link`)를 두지 않는다.
- **수저 구간**: `bandLabel(startBandOf(era, wealth))`만, 형식 「흙수저(하위 25% 안쪽)」(`copy.md` 3절). `standingLabel`은 외모·체중·엔딩 도착 자리 전용. 대시보드 「자산 현황」에 칩 없음.
- **룰렛 움직임 줄이기**: 회전 상태를 만들지 않고 결과 상태 + `.motion-note`로 시작. 릴 순서는 수저 왕복(`WEALTH_REEL_ORDER`, R-274)·지역 확률표 순서.
- **M3 뒤 developer 몫(`diff-003.md`)**: ~~**D-07**~~ — r4에서 R-291로 반영됨(`doc.css` 강제 색상 띠 Canvas/CanvasText + e2e 렌더 픽셀 시험), designer가 구현 스크린샷으로 확인하고 닫았다. 새 화면(M4)의 낱말 끊김·제목 상한은 `design-system.md` **11-8절** 규칙을 그대로 따른다.
- 캐러셀: 자동 넘김 7초, 「{i} / {N}」의 N은 `getCarouselIndicators().length`(14).
- 문구는 `copy.md`, 컴포넌트 구조는 `mockups/ds.css`, 얼굴은 `faceLayers.ts`(`eyeDetail`·`noseBridge` 키는 없고, 4차에 추가된 머리 모양 변경은 API에 영향 없음). 자세한 목록은 `design-system.md` 10절.
