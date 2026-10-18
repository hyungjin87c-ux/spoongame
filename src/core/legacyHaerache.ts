/**
 * 이행 목록 (SPEC-003 M7e-1, 마스터 결정 C1·R2): 아직 해라체(「~했다.」)로 쓰여 있는 기존 이벤트의 id.
 *
 * 이 게임의 사건 본문·결과 문구는 합쇼체(「~했습니다.」)로 통일된다. 기존 이벤트 112개는 M7e 본 작업에서 한 파일씩 재작성하므로, 그때까지는 이 목록의 이벤트만
 * 옛 규칙(해라체 · 옛 길이 한도 `LEGACY_TEXT_LIMITS`)으로 점검하고, **목록에 없는 이벤트(M7a부터 새로 쓰는 것)는 합쇼체 · 새 길이 한도 `TEXT_LIMITS`**로 점검한다.
 *
 * 이 목록은 **줄어들기만 하고 늘 수 없다.** (M7a r3: 영유아 기존 9개를 합쇼체로 다시 써 뺐다 — infant.json 묶음이 통째로 사라졌다. 현재 101개)
 *  - 이벤트를 합쇼체로 고쳤으면 그 id를 여기서 뺀다. 「목록에 있는데 이미 합쇼체」면 점검이 실패한다(core/eventLint.ts#lintEvent) — 고치고 안 빼면 걸린다.
 *  - 새 id를 더하지 않는다. 시작 시점의 112개를 `tests/fixtures/legacy-haerache-baseline.json`에 얼려 두었고, `tests/eventLint.test.ts`가 「이 목록 ⊆ 시작 목록」을 단언한다.
 *    (시작 목록 파일도 해시로 잠겨 있어 고치면 시험이 실패한다.) 새 이벤트가 해라체라서 걸리면 이 목록에 넣지 말고 문구를 합쇼체로 쓴다.
 *  - **되돌림 방지(R-361)**: 이미 뺀 id는 같은 파일의 `removed`(덧붙이기 전용)에 적혀 있고, 시험이 「목록 ∩ 뺀 id = ∅」·「목록 ∪ 뺀 id = 시작 목록」·「현재 개수 = 시험에 적힌 수」를 함께 본다 —
 *    뺀 id를 해라체로 되돌려 목록에 다시 넣으면 교집합·개수 시험이 실패한다. 줄일 때는 `removed`에 id를 덧붙이고 시험의 개수를 함께 줄인다(M7e에서 한 파일씩).
 *  - 목록이 비면(M7e 끝) 이 파일과 이행 장치(`LEGACY_TEXT_LIMITS`, 어체 혼용·목록 점검)를 함께 걷어낸다.
 *
 * 파일마다 묶어 두었으니 M7e에서 한 파일을 다 고치면 그 묶음을 통째로 지운다. 순서는 `src/data/events/*.json` 안의 이벤트 순서와 같다.
 */
export const LEGACY_HAERACHE_IDS: readonly string[] = Object.freeze([
  // school.json (22개)
  'school-lunch',
  'school-friend',
  'school-tutoring',
  'school-first-love',
  'school-exam',
  'school-early-work',
  'school-bully',
  'school-club',
  'school-teacher-notice',
  'school-scholarship',
  'school-friend-quarrel',
  'school-academy-night',
  'school-family-priority',
  'school-career-choice',
  'school-parttime',
  'school-puppy',
  'school-mirror',
  'school-money-gap',
  'school-chat-room',
  'school-long-walk',
  'school-academy-talk',
  'school-virtual-class',
  // youth.json (31개)
  'youth-military',
  'youth-work-pressure',
  'youth-first-job',
  'youth-meeting',
  'youth-marriage',
  'youth-marriage-again',
  'youth-partner-leaves',
  'youth-reunion',
  'youth-second-chance',
  'youth-meeting-again',
  'youth-matchmaker',
  'youth-approached',
  'youth-child',
  'youth-child-again',
  'youth-workplace-romance',
  'youth-housing',
  'youth-exam-prep',
  'youth-exam-passed',
  'youth-exam-failed',
  'youth-friend-wedding',
  'youth-colleague',
  'youth-startup',
  'youth-night-study',
  'youth-return-school',
  'youth-rent-hike',
  'youth-gig-work',
  'youth-machine-partner',
  'youth-lonely-city',
  'youth-single-years',
  'youth-job-rejections',
  'youth-factory-night',
  // middle.json (25개)
  'middle-business',
  'middle-parents-care',
  'middle-health-check',
  'middle-health-check-later',
  'middle-health-crisis',
  'middle-new-skills',
  'middle-remote-work',
  'middle-child-school',
  'middle-child-leaves',
  'middle-child-grows',
  'middle-late-child',
  'middle-home-loan',
  'middle-career-peak',
  'middle-layoff',
  'middle-job-again',
  'middle-friend-reunion',
  'middle-marriage-crisis',
  'middle-hobby',
  'middle-parents-farewell',
  'middle-debt-guarantee',
  'middle-retirement-prep',
  'middle-both-working',
  'middle-back-pain',
  'middle-lonely-holiday',
  'middle-own-shop-year',
  // senior.json (23개)
  'senior-retire',
  'senior-gathering',
  'senior-illness',
  'senior-illness-later',
  'senior-grandchildren',
  'senior-estate',
  'senior-move-home',
  'senior-travel',
  'senior-estranged-child',
  'senior-spouse-care',
  'senior-alone',
  'senior-new-device',
  'senior-long-life',
  'senior-last-wishes',
  'senior-old-friend',
  'senior-fall',
  'senior-classmates',
  'senior-diet',
  'senior-memoir',
  'senior-stairs',
  'senior-photo',
  'senior-grandchild-visit',
  'senior-quiet-pride',
]);

/** 조회용 집합 (같은 내용 — 목록을 고치려면 위 배열을 고친다) */
export const LEGACY_HAERACHE_SET: ReadonlySet<string> = new Set(LEGACY_HAERACHE_IDS);
