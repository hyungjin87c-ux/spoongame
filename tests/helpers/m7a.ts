/**
 * SPEC-003 M7a(영유아 0~7세 콘텐츠)의 기대 목록 — 시험이 같이 쓴다. 문안·효과는 docs/data/content-M7a-infant.md 3절과 12절(마스터 결정)이 기준이다.
 * 이 목록은 **데이터를 읽어 만든 것이 아니라** 문서에서 옮겨 적은 기대값이다 — 데이터가 문서와 어긋나면 시험이 알려 준다.
 */

/** 1차 신규 28개 (서술 16 + 선택 12). 7세 전용 4개는 마스터 결정 M-3대로 `school-` id다 */
export const M7A_NEW_EVENT_IDS = [
  'infant-vaccine',
  'infant-hundred-days',
  'infant-night-wake',
  'infant-meal-start',
  'infant-checkup',
  'infant-parental-leave',
  'infant-care-alert',
  'infant-first-steps',
  'infant-first-birthday',
  'infant-daycare-wait',
  'infant-follow-sibling',
  'infant-coal-winter',
  'infant-tantrum',
  'infant-market-day',
  'infant-talking-toy',
  'infant-heat-day',
  'infant-noise',
  'infant-questions',
  'infant-kindergarten',
  'infant-sibling-toy',
  'infant-hospital-stay',
  'infant-moving',
  'infant-early-lessons',
  'infant-first-book',
  'school-first-day',
  'school-supplies',
  'school-after-hours',
  'school-first-walk',
] as const;

/** 선택지 이벤트 12개 */
export const M7A_NEW_CHOICE_IDS = [
  'infant-meal-start',
  'infant-parental-leave',
  'infant-first-birthday',
  'infant-daycare-wait',
  'infant-noise',
  'infant-kindergarten',
  'infant-sibling-toy',
  'infant-hospital-stay',
  'infant-moving',
  'infant-early-lessons',
  'school-supplies',
  'school-after-hours',
] as const;

/** 마일스톤 3종과 나이 창 (IN3) */
export const M7A_MILESTONES: ReadonlyArray<{ id: string; min: number; max: number }> = [
  { id: 'infant-vaccine', min: 0, max: 0 },
  { id: 'infant-first-steps', min: 1, max: 1 }, // r3(R-362): 걷기 12~15개월(c-041·c-034) — 만 1세 해에 모든 판
  { id: 'infant-first-word', min: 1, max: 1 }, // r3: 문안을 「낱말 하나」로 낮춰 1세에 둔다(월령 주장 없음). 한 해 여러 마일스톤(id 오름차순: 걸음마 → 첫 말)
];

/** 시대 전용 이벤트 (IN6): 지난 세상 3개(+ 기존 `infant-village`) / 지금 세상 3개 / 다가올 세상 3개 */
export const M7A_ERA_ONLY = {
  past: ['infant-coal-winter', 'infant-market-day', 'school-first-walk'],
  present: ['infant-parental-leave', 'infant-daycare-wait', 'infant-noise'],
  future: ['infant-care-alert', 'infant-talking-toy', 'infant-heat-day'],
} as const;

/** 재력에 따라 보이는 선택지·결과가 달라지는 신규 이벤트 10개와 그 장치 (IN7, 6절 표 — 기존 3개 `infant-care`·`infant-stories`·`infant-fever`와 합쳐 13개) */
export const M7A_WEALTH_GATES: ReadonlyArray<readonly [eventId: string, choiceId: string]> = [
  ['infant-parental-leave', 'share'],
  ['infant-first-birthday', 'grand'],
  ['infant-daycare-wait', 'sitter'],
  ['infant-noise', 'move'],
  ['infant-kindergarten', 'famous'],
  ['infant-hospital-stay', 'room'],
  ['infant-moving', 'buy'],
  ['infant-early-lessons', 'english'],
  ['school-supplies', 'brand'],
  ['school-after-hours', 'academy'],
];
