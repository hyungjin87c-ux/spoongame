import type { FocusCode } from '../core/types';

/**
 * 올해의 초점 표 (SPEC-018 PL10, `docs/data/focus-spend-model.md` 1·2절 · 11절 기계 판독 블록 — `tests/focusDoc.test.ts`가 줄마다 대조한다).
 *
 * - 주제 6개: 공부 `learn`(0) · 일 `work`(1) · 관계 `bond`(2) · 건강 `health`(3) · 취미 `hobby`(4) · 돈 `money`(5). **저장되는 번호는 이 순서의 색인이다(One-way)** — 코드 이름은 저장되지 않는다.
 * - 구간 `FOCUS_SECTIONS` = 13·20·40·65세 시작. 저장의 `sec` 번호(0~3)의 뜻이다(One-way).
 * - 표지 기준(결정 후속 265 Q6): **그 사람이 다가가는 일에만** 주제를 단다 — 검진·운동·식단·공부 기회·모임·저축·이직 고민. 병·사고·낙상·해고·보증 사고·사별·재난·환경 변화처럼 **닥쳐오는 일과 서술 장면(배경)은 `[]`**.
 * - 한 사건에 주제 최대 2개, 곱은 한 번(`FOCUS_TOPICS_PER_EVENT_MAX`). 행이 없는 사건은 `focusTaggable`이 거짓인 사건이다 — `src/core/focus.ts#focusTableProblems`(빌드 게이트 `check:events`)가 막는다.
 * - 값(`FOCUS_MODEL`)은 저장되지 않아 Two-way(튜닝 사다리)다.
 */
export const FOCUS_TOPICS = ['learn', 'work', 'bond', 'health', 'hobby', 'money'] as const;

/** 구간 시작 나이: 0 = 13~19 · 1 = 20~39 · 2 = 40~64 · 3 = 65+ */
export const FOCUS_SECTIONS = [13, 20, 40, 65] as const;

/** 설계 문서 11절 `MODEL` 행과 같은 값 (`tests/focusDoc.test.ts`) */
export const FOCUS_MODEL = {
  focusK: 2.5,
  focusKRange: [1.5, 3.0],
  focusKMax: 3.0,
  minEvents: 2,
  topicsPerEventMax: 2,
  pickWeightMax: 10000,
  exposureMin: 1.3,
  exposureBigShare: 0.6,
  cardDiffMax: 0.1,
  timeDiffMax: 0.15,
  dominanceStatsMin: 3,
  dominanceSumDiff: 1.5,
  dominanceSEMul: 2,
  dominanceSumBand: 3.0,
} as const;

/** 곱하는 배수 `FOCUS_K` (사다리 1.5~3.0, 하드 상한 `FOCUS_K_MAX`) */
export const FOCUS_K: number = FOCUS_MODEL.focusK;
export const FOCUS_K_MAX: number = FOCUS_MODEL.focusKMax;
/** 구간 목록에 보이려면 그 주제를 가진 사건이 이만큼 있어야 한다 */
export const FOCUS_MIN_EVENTS: number = FOCUS_MODEL.minEvents;
export const FOCUS_TOPICS_PER_EVENT_MAX: number = FOCUS_MODEL.topicsPerEventMax;

/** 사건 id → 주제 코드 0~2개 (`[]` = 표지 없음). 순서는 설계 문서 11절 블록과 같다 */
export const FOCUS_TABLE: Readonly<Record<string, readonly FocusCode[]>> = {
  // 13~19세 (school.json)
  'school-lunch': [],
  'school-friend': ['bond'],
  'school-tutoring': ['learn'],
  'school-first-love': ['bond'],
  'school-exam': ['learn'],
  'school-early-work': [],
  'school-bully': [],
  'school-club': ['hobby', 'bond'],
  'school-teacher-notice': ['learn'],
  'school-scholarship': ['learn', 'money'],
  'school-friend-quarrel': [],
  'school-academy-night': ['learn'],
  'school-family-priority': [],
  'school-parttime': ['work', 'money'],
  'school-puppy': ['bond'],
  'school-mirror': [],
  'school-money-gap': [],
  'school-chat-room': [],
  'school-academy-talk': [],
  'school-virtual-class': [],
  'school-long-walk': [],
  // 20~39세 (youth.json)
  'youth-work-pressure': [],
  'youth-meeting': ['bond'],
  'youth-marriage': ['bond'],
  'youth-marriage-again': ['bond'],
  'youth-partner-leaves': [],
  'youth-reunion': ['bond'],
  'youth-second-chance': ['bond'],
  'youth-meeting-again': ['bond'],
  'youth-matchmaker': ['bond'],
  'youth-approached': ['bond'],
  'youth-child': ['bond'],
  'youth-child-again': ['bond'],
  'youth-workplace-romance': ['bond'],
  'youth-housing': ['money'],
  'youth-exam-prep': ['learn', 'work'],
  'youth-exam-passed': [],
  'youth-exam-failed': [],
  'youth-friend-wedding': ['bond'],
  'youth-colleague': [],
  'youth-startup': ['work', 'money'],
  'youth-night-study': ['learn', 'work'],
  'youth-return-school': ['learn'],
  'youth-rent-hike': [],
  'youth-gig-work': ['work'],
  'youth-machine-partner': ['work'],
  'youth-lonely-city': [],
  'youth-single-years': [],
  'youth-job-rejections': [],
  'youth-factory-night': [],
  // 40~64세 (middle.json)
  'middle-business': ['work', 'money'],
  'middle-parents-care': [],
  'middle-parents-care-mother-gone': [],
  'middle-parents-care-father-gone': [],
  'middle-health-check': ['health'],
  'middle-health-check-later': ['health'],
  'middle-health-crisis': [],
  'middle-new-skills': ['work', 'learn'],
  'middle-remote-work': [],
  'middle-child-school': ['bond'],
  'middle-child-leaves': [],
  'middle-child-grows': [],
  'middle-late-child': [],
  'middle-home-loan': ['money'],
  'middle-career-peak': ['work'],
  'middle-layoff': [],
  'middle-job-again': ['work'],
  'middle-friend-reunion': ['bond'],
  'middle-marriage-crisis': [],
  'middle-hobby': ['hobby'],
  'middle-parents-farewell': [],
  'middle-parents-farewell-mother-gone': [],
  'middle-parents-farewell-father-gone': [],
  'middle-debt-guarantee': [],
  'middle-retirement-prep': ['money', 'work'],
  'middle-both-working': [],
  'middle-back-pain': [],
  'middle-lonely-holiday': [],
  'middle-own-shop-year': [],
  // 65세 이후 (senior.json)
  'senior-retire': [],
  'senior-gathering': ['bond', 'hobby'],
  'senior-illness': [],
  'senior-illness-later': [],
  'senior-grandchildren': ['bond'],
  'senior-estate': ['money'],
  'senior-move-home': ['money', 'bond'],
  'senior-travel': ['hobby'],
  'senior-estranged-child': ['bond'],
  'senior-spouse-care': [],
  'senior-alone': ['bond'],
  'senior-new-device': ['learn'],
  'senior-long-life': ['work', 'learn'],
  'senior-last-wishes': [],
  'senior-old-friend': [],
  'senior-fall': [],
  'senior-classmates': ['bond', 'hobby'],
  'senior-diet': ['health'],
  'senior-memoir': ['hobby'],
  'senior-stairs': [],
  'senior-photo': [],
  'senior-grandchild-visit': [],
  'senior-quiet-pride': [],
};
