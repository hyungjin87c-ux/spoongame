import { STAGES, createEventPool, validateEventFiles, type EventPool, type Stage } from '../src/core';

/**
 * 합성 이벤트 풀 (참고용): 형태만 갖춘 이벤트 40개로, 엔진이 실제 풀이 아닌 다른 풀에서도 안 깨지는지(tests/simulation.test.ts 합성 풀 시험)와
 * `npm run sim -- 300 random synthetic`의 비교 기준으로만 쓴다. M3까지는 실제 풀(표본 20개)이 모자라 시간 모델의 상수를 이 풀로 맞췄지만,
 * M4부터 시간 모델은 **실제 EVENT_POOL(112개)** 로 맞추고 단언한다(R-042). 실제 이벤트 문구가 아니라 형태만 갖춘 자리표시이며,
 * 제품 번들에는 들어가지 않는다(테스트·스크립트 전용). 스키마 검증(validateEventFiles)을 그대로 통과한다.
 */
const PER_STAGE: Record<Stage, { choice: number; narrative: number; ageRange?: { min: number; max: number } }> = {
  infant: { choice: 3, narrative: 2, ageRange: { min: 1, max: 6 } },
  school: { choice: 6, narrative: 3 },
  youth: { choice: 6, narrative: 3 },
  middle: { choice: 6, narrative: 3 },
  senior: { choice: 5, narrative: 3 },
};

export function syntheticEvents(): unknown[] {
  const events: unknown[] = [];
  for (const stage of STAGES) {
    const spec = PER_STAGE[stage];
    for (let i = 0; i < spec.choice; i++) {
      events.push({
        id: `syn-${stage}-c${i}`,
        title: `합성 선택 ${stage} ${i}`,
        text: `합성 표본 이벤트(${stage} 선택지 ${i}). 형태만 갖춘 자리표시 문장이다.`,
        stages: [stage],
        ...(spec.ageRange ? { ageRange: spec.ageRange } : {}),
        weight: 10,
        once: true,
        choices: [
          { id: 'a', label: '앞으로 나아간다', result: '앞으로 나아갔다. 합성 결과 문장이다.', effects: { stats: { wealth: 2, happiness: -1 } } },
          { id: 'b', label: '잠시 멈춘다', result: '잠시 멈춰 섰다. 합성 결과 문장이다.', effects: { stats: { happiness: 2, wealth: -1 } } },
        ],
      });
    }
    for (let i = 0; i < spec.narrative; i++) {
      events.push({
        id: `syn-${stage}-n${i}`,
        title: `합성 서술 ${stage} ${i}`,
        text: `합성 표본 이벤트(${stage} 서술 ${i}). 형태만 갖춘 자리표시 문장이다.`,
        stages: [stage],
        ...(spec.ageRange ? { ageRange: spec.ageRange } : {}),
        weight: 10,
        once: true,
        effects: { stats: { relationships: 1 } },
      });
    }
  }
  return events;
}

/** 검증을 통과한 합성 풀: 이벤트 40개(선택지 26 + 서술 14)를 세 시대가 모두 공유한다(시대별 필터가 없다). */
export function syntheticPool(): EventPool {
  return createEventPool(validateEventFiles({ 'synthetic.json': { events: syntheticEvents() } }));
}
