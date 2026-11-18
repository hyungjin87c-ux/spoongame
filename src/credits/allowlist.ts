/**
 * 「이 삶의 이름들」(SPEC-022 EC1)이 「기록에 남은 선택」으로 싣는 큰 결정의 사건 ID 허용 목록 — **데이터 파일 한 곳**이다(코드에 ID를 흩어 적지 않는다).
 * 근거: `docs/design/codex/DSN-001-ending-credits/plan-2.md` 4-1의 38개 표(결정 후속 261 확인 3 — 38개 승인, 새 사건을 넣을 때 같은 변경에서 이 목록에 넣을지 판단한다). 목록 순서는 우선순위가 아니다.
 * 파일은 모두 `src/data/events/` 아래다: school(5) · career(2) · youth(12) · middle(13) · senior(6).
 *
 * 지금 규칙의 사실(이 목록이 어긋나 보이지 않게 적어 둔다):
 *  - `school-early-work`·`school-family-priority`·`school-career-choice`·`school-high-pick` 넷은 부모 결정 분류표(`src/data/parentDecisionTable.ts`)가 사건 나이 전 구간(게임 12~17세)을 부모·흘러감으로 정해
 *    본인 선택 기록이 새로 생기지 않는다(`by` 없는 옛 기록만 본인으로 읽는다).
 *  - `school-exam`(게임 16~19세)은 게임 19세에 일어난 때만 본인이 고른다.
 *  - `school-career-choice`·`youth-first-job`은 맞춤 인생 판에서 추첨되지 않는다.
 * 일상 선택(장난감·학원·모임·취미·소개 자리·식사·기기)과 부모·자녀가 정한 일(`by`)은 빈 단계를 채우는 데 쓰지 않는다 — 이 목록 밖의 ID는 후보가 아니다.
 */
export const CREDITS_DECISION_IDS: readonly string[] = [
  // school.json
  'school-exam',
  'school-early-work',
  'school-family-priority',
  'school-career-choice',
  'school-high-pick',
  // career.json
  'job-pick-field',
  'job-pick-detail',
  // youth.json
  'youth-first-job',
  'youth-marriage',
  'youth-marriage-again',
  'youth-second-chance',
  'youth-child',
  'youth-child-again',
  'youth-housing',
  // 이 id는 예비 지표 id(koreaStatsReserve)와 글자가 같아 따옴표 한 덩어리로 쓰지 않는다(tests/koreaStatsReserve.test.ts — src/data/focusTable.ts와 같은 처리)
  'youth-exam-' + 'prep',
  'youth-startup',
  'youth-night-study',
  'youth-return-school',
  'youth-rent-hike',
  // middle.json
  'middle-business',
  'middle-parents-care',
  'middle-parents-care-mother-gone',
  'middle-parents-care-father-gone',
  'middle-health-crisis',
  'middle-child-school',
  'middle-home-loan',
  'middle-career-peak',
  'middle-layoff',
  'middle-job-again',
  'middle-marriage-crisis',
  'middle-debt-guarantee',
  // senior.json
  'senior-illness',
  'senior-illness-later',
  'senior-grandchildren',
  'senior-estate',
  'senior-move-home',
  'senior-spouse-care',
  'senior-last-wishes',
];

const SET: ReadonlySet<string> = new Set(CREDITS_DECISION_IDS);

/** 이 사건 ID가 큰 결정 허용 목록에 있는가 */
export const isCreditsDecision = (eventId: string | undefined): boolean => eventId !== undefined && SET.has(eventId);
