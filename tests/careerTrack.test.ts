import { describe, expect, it, vi } from 'vitest';
import { EVENT_POOL } from '../src/data/events';
import { JOB_TABLE } from '../src/data/jobs';
import { lifeModeOf } from '../src/data/timingTable';
import {
  TRACK_END_AGE,
  careerKindDue,
  careerStateOf,
  condContextOf,
  isEventEligible,
  jobPickOutcome,
  stepYear,
  studyEndAgeOf,
  trackOpenAgeOf,
  type GameState,
  type PersonaState,
} from '../src/core';
import { startLife } from '../scripts/simulateLib';
import { isJobCard, playUntil, runToJobCard } from './helpers/careerTest';
import { lifeAt } from './helpers/personaTest';

vi.mock('../src/data/personaSwitch', () => ({ PERSONA_ENABLED: true }));

/**
 * 진로 트랙 (SPEC-018 PL4, 설계 4-1절): `persona.job`의 상태 전이 `none → field → hired`, 예약 조건, 강제 슬롯(2년 간격·`pacing.hard`를 받지 않고 `choicesSoFar`에는 센다),
 * 네 번째 지원 도달, 35세 닫힘(자동 배정 없음), 옛 첫 일 카드의 대체와 플래그 대응표.
 */

const withJob = (s: GameState, job: PersonaState['job']): GameState => ({ ...s, persona: { ...s.persona!, ...(job === undefined ? {} : { job }) } });
const noJob = (s: GameState): GameState => {
  const { job: _j, ...rest } = s.persona!;
  void _j;
  return { ...s, persona: rest as PersonaState };
};

describe('학업 종료 나이와 분야 카드 열림 나이', () => {
  it('college가 없으면 18세(고등학교)에 끝나 19세에 열리고, 있으면 22세에 끝나 23세에 열린다', () => {
    expect(studyEndAgeOf([])).toBe(18);
    expect(studyEndAgeOf(['college'])).toBe(22);
    expect(studyEndAgeOf(new Set(['college', 'x']))).toBe(22);
    expect(trackOpenAgeOf([])).toBe(19);
    expect(trackOpenAgeOf(['college'])).toBe(23);
  });
  it('열림 나이는 19~24세 창 안이다(상한 24)', () => {
    for (const f of [[], ['college']]) {
      expect(trackOpenAgeOf(f)).toBeGreaterThanOrEqual(19);
      expect(trackOpenAgeOf(f)).toBeLessThanOrEqual(24);
    }
  });
});

describe('예약 조건 careerKindDue', () => {
  const base = lifeAt(3, 19);
  it('persona가 없으면(구형 저장·스위치 끔) 트랙이 없다', () => {
    const { persona: _p, ...bare } = base;
    void _p;
    expect(careerKindDue(bare as GameState, 24)).toBeNull();
  });
  it('none: 열림 나이 앞은 없고, 열림 나이부터 35세까지 분야 카드다', () => {
    expect(careerKindDue(noJob(lifeAt(3, 18)), 18)).toBeNull();
    expect(careerKindDue(noJob(base), 19)).toBe('field');
    expect(careerKindDue(noJob(base), TRACK_END_AGE)).toBe('field');
    expect(careerKindDue(noJob(base), TRACK_END_AGE + 1)).toBeNull(); // 35세를 넘기면 닫힌다 — 자동 배정 없음
    const college = { ...noJob(base), flags: ['college'] };
    expect(careerKindDue(college, 22)).toBeNull();
    expect(careerKindDue(college, 23)).toBe('field');
  });
  it('field: 분야를 고른 다음 해부터 세부 카드, 35세까지', () => {
    const s = withJob(base, { field: 'clerk', since: 20 });
    expect(careerKindDue(s, 20)).toBeNull();
    expect(careerKindDue(s, 21)).toBe('detail');
    expect(careerKindDue(s, TRACK_END_AGE)).toBe('detail');
    expect(careerKindDue(s, TRACK_END_AGE + 1)).toBeNull();
  });
  it('hired: 카드가 더 없다', () => {
    expect(careerKindDue(withJob(base, { field: 'clerk', id: 'clerk-call', since: 22 }), 30)).toBeNull();
  });
  it('상태 이름', () => {
    expect(careerStateOf({})).toBe('none');
    expect(careerStateOf({ job: { field: 'clerk', since: 20 } })).toBe('field');
    expect(careerStateOf({ job: { field: 'clerk', id: 'clerk-call', since: 22 } })).toBe('hired');
  });
});

describe('강제 슬롯 — 일반 선택지 규칙을 받지 않는다', () => {
  it('분야 카드 다음 해 세부 카드가 바로 뜬다(2년 간격을 받지 않음), 카드를 낸 해의 lastChoiceAge는 갱신된다', () => {
    const f = runToJobCard(5, 'field');
    expect(f.age).toBe(19);
    expect(f.lastChoiceAge).toBe(19);
    expect(f.seen['job-pick-field']).toBe(19);
    const next = playUntil(f, (s) => isJobCard(s, 'detail'));
    expect(next.age).toBe(20);
    expect(next.lastChoiceAge).toBe(20);
  });

  it('연표의 선택 줄에 남아 choicesSoFar에 센다', () => {
    const s = playUntil(runToJobCard(5, 'field'), (x) => x.persona?.job?.id !== undefined);
    const lines = s.history.filter((h) => h.kind === 'choice' && h.eventId?.startsWith('job-pick-'));
    expect(lines.length).toBeGreaterThanOrEqual(2); // 분야 1 + 세부 ≥ 1
    expect(lines[0].choice).toBeTruthy();
    expect(lines.every((h) => h.age >= 19)).toBe(true);
  });

  it('pacing.hard를 채운 판에서도 카드가 막히지 않는다', () => {
    const s = noJob(lifeAt(4, 19));
    const hard = lifeModeOf(s.lifeLength).pacing.hard;
    const padded = { ...s, history: Array.from({ length: hard }, (_, i) => ({ age: 10, kind: 'choice' as const, text: `선택 ${i}`, title: '시험', choice: '고른다' })) };
    const r = stepYear(padded);
    expect(r.state.pending?.eventId).toBe('job-pick-field');
  });

  it('후보 id가 pending.choiceIds에 저장된다(3개, 중복 없음)', () => {
    const f = runToJobCard(9, 'field');
    expect(f.pending!.choiceIds).toHaveLength(3);
    expect(new Set(f.pending!.choiceIds).size).toBe(3);
    expect(f.pending!.key).toBe('job-pick-field@19');
  });
});

describe('상태 전이와 지원 순번', () => {
  it('분야를 고르면 field 상태(since = 고른 나이), 합격하면 hired(since = 합격 나이)이고 tries는 되돌리지 않는다', () => {
    const f0 = runToJobCard(1, 'field');
    const field = f0.pending!.choiceIds[0];
    const picked = playUntil(f0, (x) => x.persona?.job !== undefined, () => field);
    expect(picked.persona!.job).toMatchObject({ field, since: 19 });
    expect(picked.persona!.job!.id).toBeUndefined();
    const hired = playUntil(picked, (x) => x.persona?.job?.id !== undefined);
    expect(hired.persona!.job!.id).toBeDefined();
    expect(hired.flags).toEqual(expect.arrayContaining(['has_career', 'job_picked']));
    // 합격해도 tries를 0으로 되돌리지 않는다(지원 난수 키 (60, tries)의 재사용 방지): 불합격 횟수 = 세부 카드 수 − 1
    const failsBefore = hired.history.filter((h) => h.eventId === 'job-pick-detail').length - 1;
    expect(hired.persona!.tries ?? 0).toBe(failsBefore);
  });

  it('자동 진행은 네 번째 지원(tries = 3)까지 가기 전에 합격하거나 그 지원에서 입문으로 합격한다 — 열림 나이 + 4 이내', () => {
    for (let seed = 1; seed <= 60; seed++) {
      const s = playUntil(startLife(seed, 'millennial'), (x) => x.persona?.job?.id !== undefined);
      if (s.phase !== 'life') continue; // 35세 전에 세상을 떠난 판(드묾)
      const open = trackOpenAgeOf(s.flags);
      expect(s.persona!.job!.since, `seed ${seed}`).toBeLessThanOrEqual(open + 4);
      expect(s.persona!.job!.since, `seed ${seed}`).toBeLessThanOrEqual(TRACK_END_AGE);
    }
  });

  it('보장 후보를 계속 피해 35세를 넘기는 판은 카드가 더 나오지 않고 job이 없는 채로 남는다(자동 배정 없음)', () => {
    const avoid = (s: GameState): string | null => {
      const ids = s.pending!.choiceIds;
      if (s.pending!.eventId === 'job-pick-field') return ids[0];
      return ids.find((id) => JOB_TABLE.byId.get(id)?.hire !== 'open') ?? ids[0];
    };
    // 입문이 아닌 직업만 고르면 지원마다 확률이라 운이 나쁘면 35세까지 계속 떨어진다 — 시드를 훑어 그런 판을 찾는다
    let found: GameState | null = null;
    for (let seed = 1; seed <= 500 && found === null; seed++) {
      const s = playUntil(startLife(seed, 'millennial'), (x) => x.age > TRACK_END_AGE + 1, avoid, 900);
      if (s.phase === 'life' && s.persona!.job?.id === undefined) found = s;
    }
    expect(found, '조건에 맞는 판을 500시드 안에서 찾지 못했다').not.toBeNull();
    expect(isJobCard(found!)).toBe(false);
    expect(found!.history.filter((h) => h.eventId?.startsWith('job-pick-') && h.age > TRACK_END_AGE)).toHaveLength(0);
  });

  it('지원 난수는 나이가 아니라 tries로 정해진다: 지원 나이가 달라도 같은 tries의 합격 여부가 같다', () => {
    const s0 = runToJobCard(7, 'detail');
    const id = s0.pending!.choiceIds.find((x) => JOB_TABLE.byId.get(x)?.hire === 'open')!;
    const base = { ...s0, persona: { ...s0.persona!, tries: 1 } };
    const a = jobPickOutcome(base, 'detail', id, 21);
    const b = jobPickOutcome({ ...base, age: 27 }, 'detail', id, 27);
    expect(b.passed).toBe(a.passed);
  });
});

describe('옛 첫 일 카드(youth-first-job)와 플래그 대응표', () => {
  const firstJob = EVENT_POOL.byId.get('youth-first-job')!;
  const viewOf = (s: GameState) => ({ ...condContextOf(s), age: s.age, year: s.character!.birthYear + s.age, seen: s.seen });

  it('retiredWith: persona가 켜진 판에서는 일어나지 않고, persona가 없는 판은 그대로다', () => {
    expect(firstJob.retiredWith).toBe('persona');
    const s = lifeAt(11, 25);
    expect(s.persona).toBeDefined();
    expect(isEventEligible(firstJob, viewOf(s))).toBe(false);
    const { persona: _p, ...bare } = s;
    void _p;
    expect(isEventEligible(firstJob, viewOf(bare as GameState))).toBe(true);
  });

  it('persona가 켜진 판은 인생 내내 옛 첫 일 카드를 만나지 않는다', () => {
    for (let seed = 1; seed <= 12; seed++) {
      const s = playUntil(startLife(seed, 'millennial'), (x) => x.age > 33);
      expect(s.seen['youth-first-job'], `seed ${seed}`).toBeUndefined();
    }
  });

  it('대응표: 옛 카드가 켜던 플래그 전부를 진로 트랙이 켠다(has_career·job_picked + 직업의 setFlags)', () => {
    const old = new Set<string>();
    for (const c of firstJob.choices ?? []) for (const f of c.effects?.setFlags ?? []) old.add(f);
    expect([...old].sort()).toEqual(['family_business', 'has_career']); // 옛 카드의 출력
    const track = new Set(['has_career', 'job_picked']);
    for (const j of JOB_TABLE.jobs) for (const f of j.setFlags ?? []) track.add(f);
    for (const f of old) expect(track.has(f), f).toBe(true);
    // 가업은 형편(수저 4 이상)이 있는 판의 후보일 뿐이다 — 옛 카드의 `requires: parentWealth ≥ 4`와 같다
    expect(JOB_TABLE.byId.get('sales-family')!.when).toEqual({ parentWealth: { min: 4 } });
  });

  it('합격 효과: 직업의 setFlags까지 켠다(가업 이어받기 → family_business)', () => {
    let hit = 0;
    for (let seed = 1; seed <= 80 && hit < 3; seed++) {
      const s0 = runToJobCard(seed, 'field');
      const fieldState = { ...s0, persona: { ...s0.persona!, job: { field: 'sales' as const, since: s0.age } } };
      const o = jobPickOutcome({ ...fieldState, age: s0.age + 1 }, 'detail', 'sales-family', s0.age + 1);
      if (o.passed) {
        expect(o.effects!.setFlags).toEqual(expect.arrayContaining(['has_career', 'job_picked', 'family_business']));
        hit++;
      }
    }
    expect(hit).toBeGreaterThan(0);
  });
});

describe('persona 없는 판', () => {
  it('진로 카드가 하나도 없고 기존 흐름 그대로다', () => {
    const { persona: _p, ...bare } = startLife(2, 'millennial');
    void _p;
    const s = playUntil(bare as GameState, (x) => x.age > 36);
    expect(Object.keys(s.seen).some((k) => k.startsWith('job-pick-'))).toBe(false);
  });
});
