import { EVENT_FILES } from '../src/data/events';
import { createEventPool, validateEventFiles, type EventPool } from '../src/core';
import infant from '../tests/fixtures/pre-fm4b-events/infant.json';
import school from '../tests/fixtures/pre-fm4b-events/school.json';
import youth from '../tests/fixtures/pre-fm7a-events/youth.json';
import middle from '../tests/fixtures/pre-fm7a-events/middle.json';
import senior from '../tests/fixtures/pre-fm7a-events/senior.json';

/**
 * FM4b **전**의 이벤트 풀 (SPEC-009 K2·K4 측정용): 영유아·학창 이벤트 파일 둘을 FM4a 시점(커밋 73e9754)의 원문으로 되돌리고, **청년·중년·노년 파일 셋은 FM7a 전(커밋 a6b55e0)의 원문**으로 되돌린다
 * (FM7a가 「남은 한 분」 변형 사건·`senior-alone` 조건·「본가」·「비어 가는 방」 문장을 넣어, 한 분이 먼저 떠난 판의 사건 흐름이 옛 세계와 달라지기 때문 — 해시 불변 L1 시험의 뜻이 「가족 줄·플래그·로그는 기록 전용」인 채로 남게 한다).
 * 이 풀에서는 동생 반응 카드가 옛 추첨 사건이고(`trigger` 없음 → 강제 슬롯이 일어나지 않는다) 가족 낱말 사건에 가족 조건이 없다 — 분포 재측정(`scripts/familyRemeasure.ts`)이 「원인별로 하나씩 켜는」 기준 세계이고,
 * 해시 불변 L1 시험(`tests/familyHash.test.ts`)이 「가족 줄·시스템 플래그·로그는 기록 전용」을 같은 풀·같은 시드로 잠근다. 앱·검증은 이 풀을 쓰지 않는다.
 */
let cache: EventPool | null = null;
let cacheFm7a: EventPool | null = null;

export function preFm4bPool(): EventPool {
  if (cache === null) cache = createEventPool(validateEventFiles({ ...EVENT_FILES, './infant.json': infant, './school.json': school, './youth.json': youth, './middle.json': middle, './senior.json': senior }));
  return cache;
}

/** FM7a **전**의 풀 (재측정 V2~V5용): 지금 풀에서 청년·중년·노년 파일 셋만 FM7a 전 원문으로 되돌린다 — FM4b의 K2·K4는 켜진 채다 */
export function preFm7aPool(): EventPool {
  if (cacheFm7a === null) cacheFm7a = createEventPool(validateEventFiles({ ...EVENT_FILES, './youth.json': youth, './middle.json': middle, './senior.json': senior }));
  return cacheFm7a;
}

/** K2만 켠 풀: 옛 풀에서 동생 반응 카드(`infant-new-sibling`)만 지금 정의(`trigger: "family"`)로 바꾼다 — 사건 조건·낱말 조건(K4)은 옛 그대로 */
export function k2OnlyPool(): EventPool {
  const now = createEventPool(validateEventFiles({ ...EVENT_FILES })).byId.get('infant-new-sibling')!;
  const old = preFm4bPool();
  return createEventPool(old.events.map((e) => (e.id === now.id ? now : e)));
}

/**
 * FM7a의 원인을 하나씩 켠 풀 (재측정 V6~V10, SPEC-009 완료 기준 11): 영유아·학창은 지금(K2·K4가 켜진) 것이고 청년·중년·노년은 FM7a 전 원문에서 시작해
 *  - `fm7aVariantsPool()`: 중년만 지금 것 — 「남은 한 분」 변형 사건 4개와 원본의 한 분 별세 제외 조건(`middle-child-leaves`의 문장 변경은 효과가 같다)
 *  - `fm7aSeniorPool()`: 위 + 노년도 지금 것 — `senior-alone`이 함께 사는 자녀가 있는 판을 거른다(R-586). 청년 「본가」는 문장만 바뀌어 효과가 없다
 * 마지막(V11)은 지금 풀(`eventPool`)이다.
 */
let cacheVariants: EventPool | null = null;
let cacheSenior: EventPool | null = null;

export function fm7aVariantsPool(): EventPool {
  if (cacheVariants === null) cacheVariants = createEventPool(validateEventFiles({ ...EVENT_FILES, './youth.json': youth, './senior.json': senior }));
  return cacheVariants;
}

export function fm7aSeniorPool(): EventPool {
  if (cacheSenior === null) cacheSenior = createEventPool(validateEventFiles({ ...EVENT_FILES, './youth.json': youth }));
  return cacheSenior;
}
