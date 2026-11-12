import { describe, expect, it } from 'vitest';
import { PERSONA_ENABLED } from '../src/data/personaSwitch';
import { beginBirth, condContextOf, createInitialState, enterBirth, enterLife, eventPool, eventWeight, generateBirthFromSeed, personaViewOf } from '../src/core';
import { startLife } from '../scripts/simulateLib';
import { playUntil } from './helpers/careerTest';

/**
 * 출하 값 그대로의 롤백 스위치 (SPEC-018 3b단계 — 설계 6-3절): **이 파일은 mock 없이** 코드가 출하하는 값으로 돌린다. 3b에서 `PERSONA_ENABLED = true`로 켰다.
 * 끈 경로의 의미(저장된 persona 통과·갱신 멈춤·진로 트랙 정지·jobMul 유지)는 `personaSwitch.test.ts`가 mock으로 잠근다.
 */

describe('출하 값: 맞춤 인생이 켜져 있다 (3b)', () => {
  it('PERSONA_ENABLED는 true다', () => {
    expect(PERSONA_ENABLED).toBe(true);
  });

  it('새 판은 persona를 만들고(출생 결과·룰렛·인생) 맞춤 보기가 있다', () => {
    expect(generateBirthFromSeed(1, 'millennial').persona).toBeDefined();
    const life = enterLife(enterBirth(beginBirth(createInitialState(7), 'g86')));
    expect(life.persona).toBeDefined();
    expect(personaViewOf(life)).not.toBeNull();
  });

  it('켠 판에서는 진로 트랙이 일한다: 35세까지 진로 카드를 지나 직업이 정해지고 옛 첫 일 카드(youth-first-job)는 거둔다', () => {
    let jobs = 0;
    for (let seed = 1; seed <= 6; seed++) {
      const s = playUntil(startLife(seed, 'millennial'), (x) => x.age >= 36);
      expect(Object.keys(s.seen).some((k) => k.startsWith('job-pick-')), `seed ${seed}`).toBe(true);
      expect(s.seen['youth-first-job'], `seed ${seed}`).toBeUndefined();
      if (s.persona?.job?.id !== undefined) jobs++;
    }
    expect(jobs).toBeGreaterThanOrEqual(5);
  });

  it('시대 배율 LOOKERA가 켜져 있다: 1995년 이전을 사는 판의 연애 가중 폭이 표 값보다 작다(×0.8)', () => {
    const e = eventPool().byId.get('youth-meeting')!;
    const at = (looks: number) => condContextOf({ ...startLife(11, 'boomer', { looks }), age: 25 });
    expect(at(90).year!).toBeLessThanOrEqual(1995);
    expect(eventWeight(e, at(90)) / eventWeight(e, at(50))).toBeCloseTo(1 + 0.7 * 0.8, 12);
  });
});
