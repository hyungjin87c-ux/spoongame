# 2026-10-28 SPEC-004 design-GM4-followup — REV-004-GM4-2 낮은 지적의 디자인 문서 몫 (R-522 · R-523 · R-528)

- 누가: designer (마스터 지시 2026-10-28 — **문서만, `src/` 불변**. developer가 다음 회차(GM5)에서 코드에 옮긴다. QA와 같은 시각이라 dev 서버를 띄우지 않았고 `dist/`도 건드리지 않았다: 빌드는 `.taste-skill/004gm4/dist`(저장소 밖 폴더)로, preview 서버는 측정 스크립트가 띄우고 **그 PID만** `taskkill /PID … /T`로 닫았다. 정본: `docs/review/REV-004-GM4-2.md` 3절 R-522·R-523·R-528 + 2절 2(R-519 문구 제안)·7(구현이 문서와 다르게 정한 값)).
- 무엇: ① R-522 — `copy.md` 13-3 Q10 셋째 줄 「세상」 → 「세대」, 17-1 「무엇을 어디에 저장하나」 설정 목록을 GM4 실제 값(`types.ts#Settings` 12항목 = `policyText.ts#PRIVACY`)으로, 「외부 링크」의 없는 「통계 출처 링크」를 사실대로(기관 이름만), 「의견 보내기」 「세상」 → 「세대」, 17-2 「저작권」의 「(GM4부터)」 메모를 인용 밖으로. ② R-523 — `design-system.md` 17-12-5(하단 46em·24em 문턱)·**17-13-1(새)**(PC 목록 clamp·설정 2열·접힌 표 `display:none` + 실측 3창 + 판단 + 대안 비교·추천), `diff-004.md` **9-1절(새)** D4-76~D4-78, 캡처 `screens/004/gm4-list-1280x800.png`·`gm4-list-1366x768.png`·`gm4-list-1280x640.png`(3장, 93~131KB). ③ R-528 — `copy.md` 2절 「밀린 화면」 표에 합쇼체 불러오기 실패 한 줄을 정했고, 16-2 표에 R-519 안내 문구(reviewer 제안 채택)를 적었다. ④ 이 로그.
- 편집 범위: `docs/design/copy.md`·`design-system.md`·`diff-004.md`, (새) 캡처 3, 이 로그. `src/`·`tests/`·`e2e/`·`docs/spec/`·`docs/TODO.md`(R-522·R-523·R-528 줄은 코드 반영이 남아 `[ ]` 그대로) 불변. 새 외부 자원·자산·웹 접근 0. 측정 스크립트 `.taste-skill/004gm4/measureList.mjs`(gitignore 폴더).
- 띄운 프로세스: `vite build --outDir .taste-skill/004gm4/dist` 1회 · `vite preview --port 4177`(스크립트 자식 프로세스, 끝나면 PID로 종료 — `netstat`로 4177 LISTEN 없음 확인) · Playwright 크로뮴(스크립트가 닫음).

## 1. R-522 — developer 반영 문장 (글자 그대로)
| 곳 | 문장 |
|---|---|
| `src/data/aboutFaq.ts` 'feedback' 셋째 줄 | 「의견 작성 화면에 미리 채워지는 것은 화면 이름, 세대, 인생 길이, 버전뿐이에요. 캐릭터 이름이나 인생 기록은 담기지 않아요.」 |
| `src/data/policyText.ts#PRIVACY` 「외부 링크」 | 「이름 출처(법원 통계)와 상담전화(109) 링크를 누르면 그쪽 사이트나 전화 앱으로 넘어가요. 그 뒤의 처리는 그쪽 방침을 따라요. 통계 출처는 기관 이름만 적혀 있고 링크는 없어요.」 |
| `policyText.ts#PRIVACY` 「무엇을 어디에 저장하나」·「의견 보내기」, `TERMS` 「저작권」 | 이미 코드가 가진 문장과 copy.md를 맞췄다 — 바꿀 것 없음 |

- 확인한 사실: 의견 주소 값은 `feedback.ts#FeedbackFields.generation`(세대 표시 이름, 출생 연도·시도 없음). 설정 항목은 `types.ts#Settings` 12개(`speed`·`autoMode`·`generation`·`lifeLength`·`bgm`·`theme`·`noteCards`·`gentle`·`notesSeen`·`lived`·`homeRegion`·`moneyView`) = 글의 나열 12개. 통계 출처 줄(`TitleFooter` `stats-credit`)은 `Glue` 글자뿐이고 `<a>`가 없다 — 첫 화면의 바깥 링크는 이름 출처·`tel:109`·`mailto:`·GitHub 넷.
- **시험**: `tests/aboutFaq.test.ts` 「copy.md 13-3 확정 문구와 글자 그대로 같다」가 **지금은 1건 실패**한다(copy.md는 「세대」, `aboutFaq.ts`는 아직 「세상」 — 설계대로 developer가 옮기면 통과). 그 밖 `designAssets` 88 · `titleFooter` 18 · `titleScreen` 52 · `docCssFallback` 13 · `homeScreen` 24 통과(212/213). QA가 `npm test`를 돌리면 이 1건이 빨갛다 — 마스터가 developer에게 한 낱말 교체를 먼저 맡기면 바로 녹색.

## 2. R-523 — 실측과 판단 (`design-system.md` 17-13-1)
| 창 | 목록 창 | 온전/반 줄 | 왼쪽 열 끝 / 띠 | 키보드 ↓ 7번 |
|---|---|---|---|---|
| 1280×800 | 200px | 3 / 1 (≈ 3.9줄) | 724 / 732 안 | 모두 창 안 |
| 1366×768 | 168px | 3 / 1 (≈ 3.3줄) | 692 / 700 안 | 모두 창 안 |
| 1280×640 | 144px(하한) | 2 / 1 (≈ 2.8줄) | **668 / 572 띠 아래** | 모두 창 안 |

- 판단: 1280×800·1366×768 **충분(조건부)** — 시안 288px의 70%라 훑는 맛은 줄었지만 고르기에는 된다. 1280×640 **부족** — 하한에 걸린 구간은 불변식도 못 지키면서 창만 줄어든다(1366×768 노트북의 실제 뷰포트가 이 높이).
- **추천 C**: PC 식 하한 `9rem` → `10.5rem`(168px). 800·768 값 불변, 768 미만만 +24px(2.8 → 3.3줄). A(설정 줄 접기)는 HV3 스위치가 숨어 안 함, B(줄 여백)는 0.3줄, D(태어나는 시도·인생 길이 2열)는 라벨·안내가 접혀 절반이 돌아와 보류. **코드는 고치지 않았다** — 마스터 결정 뒤 developer(`title.css`:460 + `e2e/first-screen-layout.spec.ts` clamp 글자).
- 구현이 정한 값 셋(clamp·설정 2열·`display:none`)과 하단 문턱(46em·24em)은 추인해 17-12-5·17-13-1·diff-004 9-1에 적었다.

## 3. R-528 — 확정 문구
- 밀린 화면 불러오기 실패(합쇼체): **「게임 데이터를 불러오지 못했습니다. 연결을 확인하고 「이 탭에서 이어하기」를 다시 누르세요.」** — 같은 화면의 「…아래 버튼을 누르세요.」와 꼬리를 맞췄다(reviewer 예시의 「눌러 주세요」는 해요체 꼬리라 피함). developer: 새 상수(예: `dashText.ts#SUPERSEDED_LOAD_FAILED`) + `SupersededScreen.tsx`:43 + `tests/titleScreen.test.tsx`:621. 첫 화면 `TITLE_TEXT.loadFailed`는 그대로.
- R-519 안내(reviewer 제안 채택): **「시·도를 하나 고르거나 「룰렛에 맡기기」로 바꿔 주세요.」** — 쉼표·「고르/골라」 겹침을 풀고 분절 컨트롤의 동사를 「바꾸다」로. developer: `generationText.ts#regionPickNeeded` + `tests/titleScreen.test.tsx`:626 + `e2e/first-screen.spec.ts`:295.

## 4. design-taste 절차
- 화면·토큰·CSS를 바꾸지 않은 문서 회차라 inspect/lint 전·후는 돌리지 않았다(지난 기록 `2026-10-27_SPEC-004_design-GM3r5.md` 4절 그대로). 캡처 3장은 검사가 아니라 R-523 시각 확인용(기본 상태, 라이트, 가로 넘침 0).

## 5. 다음 단계
- developer(GM5): 1절 문장 2 + 3절 문장 2 반영, aboutFaq 시험 녹색 확인.
- 마스터: 추천 C(하한 10.5rem) 채택 여부 → developer. 형진 님이 「목록이 더 보였으면」 하면 D를 다음 수단으로.
- TODO R-522·R-523·R-528 줄은 코드 반영 뒤 `[x]`(근거: 위 파일·시험).
