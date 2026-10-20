# 2026-10-21 SPEC-005 design-QI6-QI7 (무거운 장면 가리기 · 새 소식과 소개 — 시안·문구 확정)

- 누가: designer (마스터 지시 2026-10-21 — 「QI6·QI7의 시안·문구 확정, `src/`는 건드리지 않음(시안 생성기·mockups·문서만)」 + 작업 중 전달된 마스터 결정 M19(설정이 바뀌면 펼침 상태 전부 초기화·저장 안 함)·M20(옛 v8 저장의 상속 줄도 같은 모양으로 가림)). 편집 범위: `docs/design/copy.md`(**새 12·13절**), `docs/design/design-system.md`(**새 14절** + 6절 표 두 행), `docs/design/diff-005.md`(**새 11절** D5-40~D5-54), `docs/design/README.md`(36차 머리 + 먼저 볼 스크린샷 17), `docs/design/mockups/ds.css`(끝 두 블록 「무거운 장면 가리기」·「새 소식과 소개 패널」), `docs/design/mockups/title-005.css`(푸터 링크·「새」 표시·가린 슬라이드 블록), `docs/design/mockups/title-005.html`(푸터 링크 이름·패널 템플릿·`?gentle=1` 가림·`?panel=` 스크립트), **새 파일** `docs/design/mockups/qi6/veil.html` · `scripts/design/shootGentlePanel.mjs` · `docs/design/screens/005/qi6-*.png` 18장 + `qi7-*.png` 7장, 이 로그. `src/`·`tests/`·`e2e/`·`docs/spec/`·`docs/data/`는 읽기만. 커밋·푸시 없음. 띄운 프로세스: 촬영 스크립트의 Playwright 크로미움(스크립트가 띄우고 닫음, 서버 없음 `file://`)과 `npm test -- tests/designAssets.test.ts`(vitest, 자체 종료). npx 사용 없음, 외부 요청 없음.
- 읽은 것: `docs/review/REV-005-HV-1.md` 전체(1·6·7·8절, 마스터 결정 M13) · `docs/data/release-notes-faq-draft.md` 전체(1~2절, 5절 N1~N8) · `docs/spec/SPEC-005-빠른개선.md` HS·HV·NT·FQ·SV·부록 D · `docs/design/copy.md` 3·9-5·9-8·11절 · `design-system.md` 1~6·11-10·12·13절 · `diff-005.md` · `README.md` · `src/screens/TitleScreen.tsx`·`LifeScreen.tsx`(도구 줄)·`EndingScreen.tsx`(연표·사망 줄) · `src/ui/dash/LogList.tsx`·`LogCard.tsx`·`DecisionCard.tsx`·`ParentCard.tsx` · `src/ui/StatsCarousel.tsx`·`FeedbackLink.tsx` · `src/core/carousel.ts`(슬라이드 모델·상담전화) · `src/data/titleText.ts`·`dashText.ts`·`parentDecisionTable.ts`·`lifeText.ts`·`endingText.ts`·`lifeTable.ts`(상속 줄)·`koreaStats.json`(자살률·`helpLine`)·이벤트 JSON(가릴 장면 본문)·`citations.json`(c-081~c-083) · `src/styles/tokens.css` · `docs/design/mockups/ds.css`·`title-005.css`·`title-005.html`·`decision-adult.html`·`ending.html`·`dashboard-adult.html`·`qi5/parent-card.html` · `scripts/design/shootParentCard.mjs`·`auditMockup.mjs`·`mockLib.mjs`(FitPair 흉내) · `tests/designAssets.test.ts` 628~653행(화면 시안 수).

## 1. QI6 — 확정한 것 (`copy.md` 12절 · `design-system.md` 14-1~14-6)

- **분류 화면 이름 6개**(12-1, 장면마다 점검): home **집안 사정** · school **또래 사이** · health **건강** · loss **돌봄과 이별** · bond **멀어진 사이** · work **일과 생계** — 후보 그대로 채택. 각 이름이 그 분류의 모든 장면(REV 8절 + 상속 줄)에 참이고 일어나지 않은 죽음·이별을 알리지 않으며 주제어(따돌림·실직…)를 드러내지 않는다. 버린 후보(사별·상실·이별·관계·실직·따돌림·학교·병 …)와 이유를 표에 적었다. 자살률 슬라이드는 HV7 확정 「무거운 주제 · 마음 건강 통계」. 이름 목록은 한 곳 상수 `HEAVY_KIND_TEXT`로 `heavy` 표 시험에 묶는다(D5-40).
- **가린 줄**(12-2·14-2): 「무거운 일이 있었습니다 · {분류}」(FitPair hideSeparator) + 「펼쳐 보기 ▾」/「접기 ▴」(`aria-expanded`·`aria-controls`, 이름 「펼쳐 보기 {나이}세 {분류}」). 본인 결정 줄은 「(선택: 라벨)」 통째로 가림, 부모·흘러감 줄은 도장 상수 글자(쌍점·라벨 없이) + 글리프 유지 — 펼치면 원문 쪽에 라벨 포함으로 옮겨 간다. 원문은 `hidden`(DOM에 있되 화면·접근성 트리·찾기·live region 「추가」에서 빠짐). live region 낭독 문장 확정. 상속 줄은 loss, 옛 v8 저장도 같은 모양(M20). 펼침은 저장 안 함, 설정 변경 때 초기화(M19).
- **가린 결정 카드**(12-3·14-3): 머리(종류·연도·나이·카드 접기) 그대로, 제목 h2 자리에 「무거운 주제 · {분류}」, 안내 「결정할 일이 있습니다. 펼쳐서 읽고 직접 고르거나, 이번에는 성향에 따라 자동으로 고르게 할 수 있습니다.」, 버튼 「펼쳐서 읽기」(기본)·「이번에는 자동으로 고르기」(보조), 자동 모드 안내 그대로. 「펼쳐서 읽기」 뒤 포커스는 제목 h2(시트 `preventScroll`, 인라인 위쪽 변). 접힌 띠 제목도 분류 문구(버튼 이름 「결정 다시 열기 무거운 주제 · {분류}」). 자동 고르기 뒤 줄은 가린 결정 줄.
- **가린 부모·흘러감 카드**(12-4·14-4): 칩·연도·도장 낱말·글리프·첫 부모 안내는 보이고 제목·상황·라벨·영향 줄·인용은 가림. 안내 「펼치면 무슨 일이었는지 읽을 수 있습니다.」 + 「펼쳐서 읽기」 하나 → 포커스 제목 h2(`tabindex=-1` 추가).
- **엔딩**(12-5): 맨 위 한 줄 **「이 판은 무거운 장면을 가린 채 살았습니다.」**(합쇼체, 기준은 `gentleUsed`), 연표 줄은 같은 부품, 사망 줄은 원인 낱말까지 그대로(R-470).
- **자살률 슬라이드**(12-6·14-5, REV 7절 표대로): h3 「무거운 주제 · 마음 건강 통계」, 「펼쳐 보기」 하나(h3 바로 아래, 두 묶음 제어), 상담전화 묶음은 두 묶음 사이에서 늘 보임(이름 그대로), `article` aria-label·`dotLabel` 「{n}/{N} 무거운 주제, 마음 건강 통계」, 슬라이드를 떠나면 다시 가림.
- **도구 줄 6번째 버튼 — 두지 않는다**(12-7·14-6, D5-48): 시안 측정 360×740 여섯 칸 각 48px에서 이름 「무거운 장면 가리기」가 **3줄**(R-122 「낱말 단위 두 줄까지」 위반, 도구 줄 56 → 77px), 320 · 200%는 3 + 3 두 줄 218px. 이름을 줄이면 설정 이름과 달라지고, R-475 (A)라 「나가기 → 첫 화면 → 스위치 → 이어서 살기」가 같은 결과. Q7에 그 길을 한 문장으로 적었다.
- **첫 화면 스위치 켠 상태 1280×800**(HS3 ③④, D5-47): 왼쪽 열 끝(스위치) 655 < 띠 732, 오른쪽 열 — 표제어 아래 488 · 「펼쳐 보기」 아래 526 · 상담전화 아래 606 · 열 끝 626 < 732. 가림 없음.
- 모양 원칙: 글자 + 버튼으로만 말하고 점선·회색 상자·새 색을 쓰지 않는다(점선 = 준비 중·지속 비활성). 새 토큰·새 색 쌍 0.

## 2. QI7 — 확정한 것 (`copy.md` 13절 · `design-system.md` 14-7)

- **이름**(13-1, N6): 패널 **「새 소식과 소개」**, 구역 **「새 소식」·「소개」**, 푸터 링크 둘 「새 소식」·「소개」(같은 패널의 두 구역), 「새」 표시 = 놋쇠 알약 「새」(aria-hidden) + 링크 이름 꼬리 「(읽지 않은 소식 있음)」, 「닫기」, 구역 머리 한 줄 둘(「새 소식에는 눈에 보이는 달라진 점만 적어요.」 / 「이 게임에 대해 질문과 답으로 정리했어요.」), 종류 칩 「추가/개선/수정/내용」. 「자주 묻는 질문」은 아직 아무도 묻지 않은 글이라(정직함) 쓰지 않았다.
- **노트**(13-2): v0.2.0 8항목(최대 66자 — 3번 「글만 가려요」, 4번 「처음부터 차례로 읽어요」(R-437 회피), 8번 「소개」로 이름 반영), 요약 「어린 시절의 결정, 인생 기록, 첫 화면이 달라졌어요.」, 날짜는 배포일 자리. v0.1.0 8항목 초안 그대로(2026-10-20).
- **Q&A 10문항**(13-3): 해요체(N1 — Q9 「만들었어요」), Q9 ChatGPT 문장(N3), Q8 109만·「자살·자해 내용 없음」 삭제(N4), Q10 「아래 「의견 보내기」…」 + 도구 줄에도 있음(N2), Q7 「켜거나 끄면 지난 기록까지 바로 바뀌어요」 + 판 도중의 길(N7·12-7), Q6 「큰 결정」(11절 낱말). 자리표시자 6개 글자 유지, 데이터 자리 확정(`{가상 인구 계산 기준}`은 `populationInfo`와 한 상수에서 두 어체 문장 — D5-51).
- **패널 규격**(13-4·14-7): 11-10 틀 + 머리 sticky(제목 + 「닫기」) + `<details>` 아코디언(네이티브 키보드, 꺾쇠는 선 그림) + 뒤로가기 = 닫기 + 닫히면 열었던 링크로 포커스 + 「소개」로 열면 구역으로 스크롤(`scroll-margin-top`) + 발의 「의견 보내기」.

## 3. 시안·측정

- `mockups/qi6/veil.html` `?state=rows|sheet|inline|fold|parent|ending|tools6`(`&theme=dark`) — 구현과 같은 DOM·클래스, 실제 이벤트 JSON 문장. `title-005.html`에 `?gentle=1[&veil=open]`(자살률 슬라이드 가림/펼침), `?panel=news|intro[&faq=N][&seen=1]`(패널), 푸터 링크 이름·「새」 알약.
- `scripts/design/shootGentlePanel.mjs`(`node`로 실행): 25장 — 문서·요소 넘침 0(320px CSS 시각 숨김 라벨은 `clip` 제외), 모두 ≤ 300 KB(최대 289 KB), 합계 약 2.2 MB. 측정 둘(첫 화면 HS3 수치·도구 줄 이름 줄 수)은 위 1절.
- 눈 확인: 360 가린 줄은 긴 분류 이름(「돌봄과 이별」「일과 생계」)에서 FitPair 두 줄 모드 + 버튼이 다음 줄 오른쪽, 「건강」은 한 줄 · 320 · 200% 끊김 0 · 시트는 제목 큰 글자 + 버튼 세로 둘 · 부모 카드는 도장만 남고 안내 한 줄 · 엔딩은 한 줄 + 연표 가린/펼친/사망 줄 · 패널은 sticky 머리, 320 · 200%에서 제목 두 줄 + 「닫기」 아래 줄(처음 질문 글자 칸의 `min-width 12em` 때문에 꺾쇠만 한 줄에 남던 것을 `flex: 1 1 0; min-width: 0`으로 고침).
- `npm test -- tests/designAssets.test.ts` 결과는 4절.

## 4. 점검

- `npm test -- tests/designAssets.test.ts`: **79/79 통과**(2026-10-21 02:53 — 화면 시안 수 13 유지, 새 시안은 하위 폴더 `qi6/`; `title-005.html`은 띠가 있어 그대로 화면 시안으로 센다).
- 촬영 25장 합계 약 2.3 MB(qi6 18장 약 1.55 MB · qi7 7장 약 0.8 MB), 최대 289 KB.

## 5. 마스터가 정할 것

- 없음(도구 줄 6번째 버튼은 SPEC HV3의 조건부 문장대로 designer가 판단 — 뒤집으려면 이름을 두 줄에 드는 것으로 바꾸는 결정이 필요).
- 참고: 패널 이름 「새 소식과 소개」·구역 「소개」는 N6대로 designer가 정했다. 다른 이름을 원하면 `copy.md` 13-1의 버린 후보에서 고르면 시안은 글자만 바뀐다.

## 6. 다음

1. **planner**: SPEC HV3(판 도중 변경 자리 = 「나가기 → 첫 화면」), HV4(분류 이름·안내 문구는 `copy.md` 12절), NT4·FQ1(패널 이름 「새 소식과 소개」·구역 「소개」)에 한 줄씩 반영.
2. **developer QI6**: `diff-005.md` D5-40~D5-49 → dev 로그. **developer QI7**: D5-50~D5-54.
3. **reviewer**: 시안 25장 + `copy.md` 12·13절(특히 분류 이름 점검표, Q8) 판독 → `docs/review/REV-005-QI6-1.md`.
4. **QA → designer**: 구현 캡처 뒤 `screens/005/qi6-*`·`qi7-*`와 대조해 `diff-005.md` 11절에 차이 추가.
