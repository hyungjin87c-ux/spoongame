import { EVENT_FILES } from '../src/data/events';
import { createEventPool, validateEventFiles, type EventPool } from '../src/core';
import infant from '../tests/fixtures/pre-fm4b-events/infant.json';
import school from '../tests/fixtures/pre-fm4b-events/school.json';

/**
 * FM4b **전**의 이벤트 풀 (SPEC-009 K2·K4 측정용): 영유아·학창 이벤트 파일 둘을 FM4a 시점(커밋 73e9754)의 원문으로 되돌리고 나머지 파일은 지금 것을 그대로 쓴다.
 * 이 풀에서는 동생 반응 카드가 옛 추첨 사건이고(`trigger` 없음 → 강제 슬롯이 일어나지 않는다) 가족 낱말 사건에 가족 조건이 없다 — 분포 재측정(`scripts/familyRemeasure.ts`)이 「원인별로 하나씩 켜는」 기준 세계이고,
 * 해시 불변 L1 시험(`tests/familyHash.test.ts`)이 「가족 줄·시스템 플래그·로그는 기록 전용」을 같은 풀·같은 시드로 잠근다. 앱·검증은 이 풀을 쓰지 않는다.
 */
let cache: EventPool | null = null;

export function preFm4bPool(): EventPool {
  if (cache === null) cache = createEventPool(validateEventFiles({ ...EVENT_FILES, './infant.json': infant, './school.json': school }));
  return cache;
}

/** K2만 켠 풀: 옛 풀에서 동생 반응 카드(`infant-new-sibling`)만 지금 정의(`trigger: "family"`)로 바꾼다 — 사건 조건·낱말 조건(K4)은 옛 그대로 */
export function k2OnlyPool(): EventPool {
  const now = createEventPool(validateEventFiles({ ...EVENT_FILES })).byId.get('infant-new-sibling')!;
  const old = preFm4bPool();
  return createEventPool(old.events.map((e) => (e.id === now.id ? now : e)));
}
