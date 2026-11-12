import { describe, expect, it, vi } from 'vitest';
import { EVENT_POOL } from '../src/data/events';
import { JOB_TABLE } from '../src/data/jobs';
import {
  EventDataError,
  MAX_DEFINED_CHOICES,
  MAX_TEXT_VARIANTS,
  choiceResultOf,
  condContextOf,
  conditionProblems,
  conditionsCompatible,
  eventTextOf,
  eventWeight,
  flagsRead,
  isEventEligible,
  lintEvent,
  lintEvents,
  looksGateProblems,
  jobTableProblems,
  meetsCondition,
  personaViewOf,
  resolveEffects,
  stepYear,
  usesPersonaCondition,
  validateEventFiles,
  variantProblems,
  visibleChoices,
  type CondContext,
  type Condition,
  type EventDef,
  type PersonaView,
} from '../src/core';
import { ch, ev, lifeAt, poolOf } from './helpers/personaTest';

vi.mock('../src/data/personaSwitch', () => ({ PERSONA_ENABLED: true }));

/**
 * PL3 인터페이스 (SPEC-018, 설계 3절): `Condition`의 새 필드(`temper`·`apt`·`job`·`year`·`tailored`) · 선택지 `requires`에서 읽기 · 문장 변주 · 선택지 정의 상한 6 ·
 * `validateEventFiles`·`eventLint`가 새 필드를 이해한다. 모르거나 없으면 **맞지 않는다**(안전한 쪽). 새 필드가 없는 기존 사건은 모든 판에서 이전과 같다(골든 시험이 따로 잠근다).
 */

const view = (over: Partial<PersonaView> = {}): PersonaView => ({ shown: 'warm', tiers: { study: 'mid', art: 'high', sport: 'low', craft: 'mid', people: 'high' }, ...over });
const ctxOf = (over: Partial<CondContext> = {}): CondContext => {
  const s = lifeAt(1, 10);
  return { ...condContextOf(s), ...over };
};
const problemsOf = (events: unknown[]): string => {
  try {
    validateEventFiles({ 't.json': { events } });
    return '';
  } catch (e) {
    return e instanceof EventDataError ? e.problems.join('\n') : String(e);
  }
};

describe('조건 평가: 모르거나 없으면 맞지 않는다', () => {
  it('persona가 없으면(null·undefined) temper·apt·job·tailored는 모두 맞지 않는다', () => {
    const conds: Condition[] = [{ temper: ['warm'] }, { apt: { art: ['high'] } }, { job: { field: ['clerk'] } }, { tailored: true }];
    for (const c of conds) {
      expect(meetsCondition(c, ctxOf({ persona: null }))).toBe(false);
      expect(meetsCondition(c, ctxOf({ persona: undefined }))).toBe(false);
    }
  });

  it('persona가 있으면 temper는 지금 두드러진 기질이 목록에 있을 때만 맞는다', () => {
    const c = ctxOf({ persona: view() });
    expect(meetsCondition({ temper: ['warm', 'easy'] }, c)).toBe(true);
    expect(meetsCondition({ temper: ['curious'] }, c)).toBe(false);
  });

  it('apt는 적힌 축이 모두(AND) 맞아야 하고 단계 목록 중 하나면 맞다', () => {
    const c = ctxOf({ persona: view() });
    expect(meetsCondition({ apt: { art: ['high'] } }, c)).toBe(true);
    expect(meetsCondition({ apt: { art: ['mid', 'high'], people: ['high'] } }, c)).toBe(true);
    expect(meetsCondition({ apt: { art: ['high'], sport: ['mid', 'high'] } }, c)).toBe(false);
    expect(meetsCondition({ apt: { study: ['low'] } }, c)).toBe(false);
  });

  it('job은 직업이 없으면 맞지 않고, 있으면 field·id가 적힌 대로 맞아야 한다', () => {
    expect(meetsCondition({ job: { field: ['clerk'] } }, ctxOf({ persona: view() }))).toBe(false);
    const withJob = ctxOf({ persona: view({ job: { field: 'clerk', id: 'bank-teller' } }) });
    expect(meetsCondition({ job: { field: ['clerk', 'sales'] } }, withJob)).toBe(true);
    expect(meetsCondition({ job: { id: ['bank-teller'] } }, withJob)).toBe(true);
    expect(meetsCondition({ job: { field: ['clerk'], id: ['other'] } }, withJob)).toBe(false);
    expect(meetsCondition({ job: { id: ['bank-teller'] } }, ctxOf({ persona: view({ job: { field: 'clerk' } }) }))).toBe(false); // field 상태(id 없음)
  });

  it('year는 달력 연도 구간이고, 연도를 모르면 맞지 않는다', () => {
    expect(meetsCondition({ year: { min: 2016, max: 2018 } }, ctxOf({ year: 2017 }))).toBe(true);
    expect(meetsCondition({ year: { min: 2016, max: 2018 } }, ctxOf({ year: 2019 }))).toBe(false);
    expect(meetsCondition({ year: { min: 2016 } }, ctxOf({ year: undefined }))).toBe(false);
  });

  it('tailored는 persona가 있을 때만 맞는다', () => {
    expect(meetsCondition({ tailored: true }, ctxOf({ persona: view() }))).toBe(true);
    expect(meetsCondition({ tailored: true }, ctxOf({ persona: null }))).toBe(false);
  });

  it('새 조건끼리·기존 조건과 AND로 읽힌다', () => {
    const c = ctxOf({ persona: view(), year: 2010 });
    expect(meetsCondition({ tailored: true, temper: ['warm'], year: { min: 2000 }, parentWealth: { min: 1 } }, c)).toBe(true);
    expect(meetsCondition({ tailored: true, temper: ['warm'], year: { min: 2011 } }, c)).toBe(false);
  });
});

describe('year는 자격·가중·선택지 가시성·보너스·문장 변주가 같은 달력 연도를 읽는다 (보충 6)', () => {
  const boundary = 2016;
  const stateAtYear = (year: number) => {
    const s = lifeAt(5, 10);
    return { ...s, character: { ...s.character!, birthYear: year - 10 } };
  };

  it('condContextOf가 year(= 출생 연도 + 나이)와 persona 보기를 채운다', () => {
    const s = lifeAt(5, 10);
    const ctx = condContextOf(s);
    expect(ctx.year).toBe(s.character!.birthYear + 10);
    expect(ctx.persona).toEqual(personaViewOf(s));
    expect(ctx.persona).not.toBeNull();
  });

  it('경계 연도 −1·0·+1에서 다섯 문맥(자격·가중·가시성·보너스·변주)이 모두 같은 답을 낸다', () => {
    const event = validateEventFiles({
      't.json': {
        events: [
          ev({
            id: 'test-year',
            conditions: { year: { min: boundary } },
            modifiers: [{ when: { year: { min: boundary } }, weight: 3 }],
            textVariants: [{ when: { year: { min: boundary } }, text: '새 시대의 하루였습니다. 별일 없이 지나갔습니다.' }],
            choices: [ch('a', { bonuses: [{ when: { year: { min: boundary } }, effects: { stats: { happiness: 1 } } }], resultVariants: [{ when: { year: { min: boundary } }, text: '새 시대에 골랐습니다. 하루가 지났습니다.' }] }), ch('b', { requires: { year: { min: boundary } } }), ch('c')],
          }),
        ],
      },
    })[0] as EventDef;
    for (const year of [boundary - 1, boundary, boundary + 1]) {
      const s = stateAtYear(year);
      const ctx = condContextOf(s);
      const on = year >= boundary;
      expect(ctx.year, `${year}`).toBe(year);
      expect(isEventEligible(event, { ...ctx, age: 10, year, seen: {} }), `자격 ${year}`).toBe(on);
      expect(eventWeight(event, ctx), `가중 ${year}`).toBe(on ? 3 : 1);
      expect(visibleChoices(event, ctx).map((c) => c.id), `가시성 ${year}`).toEqual(on ? ['a', 'b', 'c'] : ['a', 'c']);
      expect(resolveEffects(undefined, event.choices![0].bonuses, ctx).stats.happiness ?? 0, `보너스 ${year}`).toBe(on ? 1 : 0);
      expect(eventTextOf(event, ctx).startsWith('새 시대'), `본문 변주 ${year}`).toBe(on);
      expect(choiceResultOf(event.choices![0], ctx).startsWith('새 시대'), `결과 변주 ${year}`).toBe(on);
    }
  });

  it('stepYear가 자격에 쓰는 연도와 condContextOf의 연도가 같다(연도 경계의 사건이 같은 해에 뜬다)', () => {
    const pool = poolOf([ev({ id: 'test-edge', once: true, cooldown: undefined, stages: ['school'], ageRange: { min: 10, max: 10 }, yearRange: { from: boundary, to: boundary }, weight: 100, text: '그해에만 있던 하루였습니다. 별일 없이 지나갔습니다.' })]);
    for (const year of [boundary - 1, boundary, boundary + 1]) {
      const s = stateAtYear(year);
      const r = stepYear(s, pool);
      // 사건이 일어날 수 있는 해는 경계 연도 하나뿐이고, 그 해에 사건이 일어날 칸(서술 빈도)이 열릴 때만 뜬다 — 다른 해에는 절대 뜨지 않는다
      if (year !== boundary) expect(r.tick.eventId, `${year}`).toBeUndefined();
      expect(condContextOf(s).year).toBe(year);
    }
  });
});

describe('스키마 검증이 새 필드를 받고 잘못된 값은 거절한다', () => {
  const okCond = (c: Record<string, unknown>) => problemsOf([ev({ id: 'test-cond', conditions: c })]);

  it('올바른 새 필드는 통과한다', () => {
    expect(okCond({ temper: ['warm'], apt: { art: ['high', 'mid'] }, job: { field: ['clerk'], id: ['bank-teller'] }, year: { min: 2010 }, tailored: true })).toBe('');
  });

  it('잘못된 값: 모르는 기질·단계·축·분야, 빈 목록, tailored false, 연도 범위 밖, 직업 id 모양', () => {
    expect(okCond({ temper: ['grumpy'] })).toContain('허용되지 않는 값');
    expect(okCond({ temper: [] })).toContain('비어 있지 않은 배열');
    expect(okCond({ apt: { art: ['great'] } })).toContain('허용되지 않는 값');
    expect(okCond({ apt: { music: ['high'] } })).toContain('알 수 없는 적성축');
    expect(okCond({ apt: {} })).toContain('적성축');
    expect(okCond({ job: { field: ['pirate'] } })).toContain('허용되지 않는 값');
    expect(okCond({ job: {} })).toContain('하나 이상');
    expect(okCond({ job: { id: ['Bad Id'] } })).toContain('직업 id');
    expect(okCond({ year: { min: 1800 } })).toContain('1900~2300');
    expect(okCond({ year: {} })).toContain('min 또는 max');
    expect(okCond({ tailored: false })).toContain('true여야 한다');
    expect(okCond({ temper: ['warm', 'warm'] })).toContain('중복');
  });

  it('기록 카드가 쓰는 conditionProblems도 새 필드를 같은 문법으로 본다', () => {
    expect(conditionProblems({ temper: ['warm'], tailored: true }, 'x')).toEqual([]);
    expect(conditionProblems({ temper: ['nope'] }, 'x').join('\n')).toContain('허용되지 않는 값');
  });

  it('선택지 act·role: 모르는 값은 거절한다 / 사건 단위 role은 서술 사건만', () => {
    expect(problemsOf([ev({ id: 'test-act', choices: [ch('a', { act: 'sport' }), ch('b', { role: 'coach' })] })])).toBe('');
    expect(problemsOf([ev({ id: 'test-act', choices: [ch('a', { act: 'dance' }), ch('b')] })])).toContain('활동 표지');
    expect(problemsOf([ev({ id: 'test-act', choices: [ch('a', { role: 'king' }), ch('b')] })])).toContain('본보기 표지');
    expect(problemsOf([ev({ id: 'test-narr', role: 'teacher' })])).toBe('');
    expect(problemsOf([ev({ id: 'test-narr', role: 'teacher', choices: [ch('a'), ch('b')] })])).toContain('서술 이벤트');
  });
});

describe('선택지 정의 상한 6', () => {
  const six = ['a', 'b', 'c', 'd', 'e', 'f'].map((id, i) => ch(id, i < 2 ? {} : i < 4 ? { requires: { parentWealth: { max: 2 } } } : { requires: { parentWealth: { min: 3 } } }));

  it('정의 6개까지 통과하고 7개는 거절한다(보이는 최대 3은 lint가 지킨다)', () => {
    expect(MAX_DEFINED_CHOICES).toBe(6);
    expect(problemsOf([ev({ id: 'test-six', choices: six })])).toBe('');
    expect(problemsOf([ev({ id: 'test-seven', choices: [...six, ch('g')] })])).toContain('선택지는 2~6개');
  });

  it('정의 5·6개여도 어느 상태에서나 보이는 선택지가 3개를 넘으면 lint가 막는다', () => {
    const pool = poolOf([ev({ id: 'test-many', choices: ['a', 'b', 'c', 'd', 'e'].map((id) => ch(id)) })]);
    expect(lintEvent(pool.byId.get('test-many')!).join('\n')).toContain('선택지가');
  });
});

describe('맞춤 조건 사건은 「조건 없는 선택지 ≥ 2」 대신 격자 하한을 받는다', () => {
  it('조건 없는 선택지가 1개여도 맞춤 조건(temper·apt·job·tailored)을 쓰면 스키마는 통과한다 (격자는 eventLint)', () => {
    const e = ev({ id: 'test-grid', choices: [ch('common'), ch('a', { requires: { apt: { art: ['high'] } } }), ch('b', { requires: { apt: { art: ['low', 'mid'] } } })] });
    expect(problemsOf([e])).toBe('');
  });

  it('맞춤 조건이 없으면 지금 규칙 그대로다(조건 없는 선택지 2개 이상)', () => {
    const e = ev({ id: 'test-old', choices: [ch('common'), ch('a', { requires: { parentWealth: { min: 3 } } }), ch('b', { requires: { parentWealth: { max: 2 } } })] });
    expect(problemsOf([e])).toContain('조건(requires) 없는 선택지가 2개 이상');
  });

  it('trigger 사건은 지금 규칙 그대로다', () => {
    const e = ev({ id: 'test-trig', trigger: 'family', once: true, cooldown: undefined, ageRange: { min: 3, max: 5 }, stages: ['infant'], choices: [ch('common'), ch('a', { requires: { tailored: true } }), ch('b', { requires: { tailored: true } })] });
    expect(problemsOf([e])).toContain('조건(requires) 없는 선택지가 2개 이상');
  });
});

describe('문장 변주', () => {
  const withVariants = (v: unknown, cv?: unknown) =>
    ev({ id: 'test-var', textVariants: v, choices: [ch('a', cv === undefined ? {} : { resultVariants: cv }), ch('b')] });
  const variant = (when: Record<string, unknown>, text = '변주 글입니다. 다르게 읽히는 하루였습니다.') => ({ when, text });

  it(`사건·선택지당 최대 ${MAX_TEXT_VARIANTS}개, 글 길이는 본문·결과와 같은 스키마 한도`, () => {
    const four = [1, 2, 3, 4].map((n) => variant({ year: { min: 2000 + n } }));
    expect(problemsOf([withVariants([variant({ tailored: true })])])).toBe('');
    expect(problemsOf([withVariants(four)])).toContain(`최대 ${MAX_TEXT_VARIANTS}개`);
    expect(problemsOf([withVariants(undefined, four)])).toContain(`최대 ${MAX_TEXT_VARIANTS}개`);
    expect(problemsOf([withVariants([variant({ tailored: true }, '짧음')])])).toContain('길이는 10~400자');
    expect(problemsOf([withVariants(undefined, [variant({ tailored: true }, '짧음')])])).toContain('길이는 6~300자');
    expect(problemsOf([withVariants([{ when: { tailored: true } }])])).toContain('필수 항목 "text"');
    expect(problemsOf([withVariants([])])).toContain('비어 있지 않은 배열');
  });

  it('변주의 when이 잘못되면 거절한다', () => {
    expect(problemsOf([withVariants([variant({ temper: ['grumpy'] })])])).toContain('허용되지 않는 값');
  });

  it('먼저 맞는 것이 이기고 맞는 것이 없으면 기본 글이다 / 글만 바뀌고 선택지·효과는 그대로다', () => {
    const [e] = validateEventFiles({
      't.json': { events: [ev({ id: 'test-var', text: '기본 본문입니다. 별일 없는 하루였습니다.', textVariants: [variant({ temper: ['warm'] }, '붙임성 변주입니다. 사람들 사이에서 보낸 하루였습니다.'), variant({ tailored: true }, '맞춤 변주입니다. 이 아이만의 하루였습니다.')], choices: [ch('a', { result: '기본 결과입니다. 하루가 지났습니다.', resultVariants: [variant({ temper: ['curious'] }, '호기심 변주 결과입니다. 낯선 길로 갔습니다.')], effects: { stats: { education: 1 } } }), ch('b')] })] },
    }) as EventDef[];
    expect(eventTextOf(e, ctxOf({ persona: view({ shown: 'warm' }) }))).toContain('붙임성 변주');
    expect(eventTextOf(e, ctxOf({ persona: view({ shown: 'quiet' }) }))).toContain('맞춤 변주'); // 둘째가 먼저 맞는 것
    expect(eventTextOf(e, ctxOf({ persona: null }))).toBe('기본 본문입니다. 별일 없는 하루였습니다.');
    expect(choiceResultOf(e.choices![0], ctxOf({ persona: view({ shown: 'curious' }) }))).toContain('호기심 변주');
    expect(choiceResultOf(e.choices![0], ctxOf({ persona: view({ shown: 'warm' }) }))).toBe('기본 결과입니다. 하루가 지났습니다.');
    expect(e.choices![0].effects).toEqual({ stats: { education: 1 } });
  });

  it('변주의 when 플래그도 플래그 교차 검증(읽는 플래그는 어디선가 켜져야 한다)에 든다', () => {
    const e = ev({ id: 'test-flag', textVariants: [variant({ flags: ['never_set'] })], choices: [ch('a'), ch('b')] });
    expect(problemsOf([e])).toContain('never_set');
    const f = poolOf([ev({ id: 'test-flag2', textVariants: [variant({ flags: ['set_here'] })], choices: [ch('a', { effects: { setFlags: ['set_here'] } }), ch('b')] })]);
    expect([...flagsRead(f.byId.get('test-flag2')!)]).toContain('set_here');
  });

  it('lint가 변주 글을 본문·결과와 같은 규칙으로 본다(느낌표·해라체·길이·시대어)', () => {
    const bad = poolOf([withVariants([variant({ tailored: true }, '아이가 달렸다! 아주 빨랐다.')], [variant({ tailored: true }, '골랐다. 하루가 지났다.')])]).byId.get('test-var')!;
    const problems = lintEvent(bad).join('\n');
    expect(problems).toContain('test-var.textVariants[0]');
    expect(problems).toContain('느낌표');
    expect(problems).toContain('해라체');
    expect(problems).toContain('resultVariants[0]');
  });

  it('lint: when이 사건 조건과 같이 맞을 수 없거나 앞의 변주와 같으면 보이지 않는 변주라 막는다', () => {
    const e = poolOf([
      ev({
        id: 'test-dead',
        conditions: { parentWealth: { min: 4 } },
        textVariants: [variant({ parentWealth: { max: 2 } }), variant({ tailored: true }), variant({ tailored: true })],
        choices: [ch('a'), ch('b')],
      }),
    ]).byId.get('test-dead')!;
    const problems = variantProblems(e).join('\n');
    expect(problems).toContain('textVariants[0]');
    expect(problems).toContain('같이 맞을 수 없어');
    expect(problems).toContain('textVariants[2]');
    expect(problems).toContain('when이 같아');
  });
});

describe('conditionsCompatible가 새 조건을 이해한다', () => {
  it('서로 겹치지 않는 기질·적성 단계·직업 분야·연도 구간은 같이 보일 수 없다', () => {
    expect(conditionsCompatible([{ temper: ['warm'] }, { temper: ['quiet'] }])).toBe(false);
    expect(conditionsCompatible([{ temper: ['warm', 'quiet'] }, { temper: ['quiet'] }])).toBe(true);
    expect(conditionsCompatible([{ apt: { art: ['high'] } }, { apt: { art: ['low'] } }])).toBe(false);
    expect(conditionsCompatible([{ apt: { art: ['high'] } }, { apt: { sport: ['low'] } }])).toBe(true);
    expect(conditionsCompatible([{ job: { field: ['clerk'] } }, { job: { field: ['sales'] } }])).toBe(false);
    expect(conditionsCompatible([{ job: { id: ['a-b'] } }, { job: { id: ['a-c'] } }])).toBe(false);
    expect(conditionsCompatible([{ year: { max: 2016 } }, { year: { min: 2017 } }])).toBe(false);
    expect(conditionsCompatible([{ year: { max: 2017 } }, { year: { min: 2017 } }])).toBe(true);
    expect(conditionsCompatible([{ tailored: true }, { temper: ['warm'] }])).toBe(true);
  });
});

describe('기존 사건은 새 규칙에 닿지 않는다', () => {
  it('풀의 모든 기존 사건에는 맞춤 조건·변주가 없고 lint는 그대로 통과한다', () => {
    expect(EVENT_POOL.events.some(usesPersonaCondition)).toBe(false);
    expect(EVENT_POOL.events.every((e) => e.textVariants === undefined && e.role === undefined)).toBe(true);
    expect(lintEvents(EVENT_POOL.events)).toEqual([]);
  });
});

describe('외모 lint (PL16, 설계 3절 「외모 가림 금지」): looks는 조건·선택지 requires·직업 when에 쓰지 않는다', () => {
  const base = (over: Record<string, unknown>): EventDef => poolOf([ev({ id: 'test-lk', choices: [ch('a'), ch('b')], ...over })]).byId.get('test-lk')!;

  it('사건 conditions의 looks는 빌드가 막는다(허용 목록 youth-approached 한 곳 말고)', () => {
    const e = base({ conditions: { looks: { min: 60 } } });
    expect(looksGateProblems(e).join('\n')).toContain('자격 조건');
    expect(lintEvent(e).join('\n')).toContain('looks를 자격 조건에');
  });

  it('선택지 requires의 looks는 빌드가 막는다(허용 목록 없음)', () => {
    const e = base({ choices: [ch('a'), ch('b'), ch('c', { requires: { looks: { min: 70 } } })] });
    expect(looksGateProblems(e).join('\n')).toContain('선택지 조건');
    expect(lintEvent(e).join('\n')).toContain('looks를 선택지 조건에');
  });

  it('허용 목록은 youth-approached 한 곳뿐이고 그 사건은 지금도 통과한다 — 풀 전체의 외모 자격 조건은 그 한 곳이다', () => {
    const withCond = EVENT_POOL.events.filter((e) => e.conditions?.looks !== undefined).map((e) => e.id);
    expect(withCond).toEqual(['youth-approached']);
    expect(looksGateProblems(EVENT_POOL.byId.get('youth-approached')!)).toEqual([]);
    expect(looksGateProblems({ ...EVENT_POOL.byId.get('youth-approached')!, id: 'youth-approached-copy' })).not.toEqual([]); // 이름이 다르면 허용이 아니다
    const withRequires = EVENT_POOL.events.filter((e) => (e.choices ?? []).some((c) => c.requires?.looks !== undefined));
    expect(withRequires).toEqual([]);
  });

  it('modifiers·bonuses·문장 변주 when에서의 looks는 허용된다(가중·효과·글만 바꾼다)', () => {
    const e = base({
      modifiers: [{ when: { looks: { min: 70 } }, weight: 1.5 }],
      bonuses: undefined,
      choices: [ch('a', { bonuses: [{ when: { looks: { max: 30 } }, effects: { stats: { happiness: -1 } } }], resultVariants: [{ when: { looks: { min: 70 } }, text: '밝은 얼굴로 하루를 마쳤습니다.' }] }), ch('b')],
    });
    expect(looksGateProblems(e)).toEqual([]);
    expect(lintEvent(e).filter((m) => m.includes('looks'))).toEqual([]);
  });

  it('직업 when의 looks는 직업 표 점검이 막는다(성별도 막는다)', () => {
    const j = { ...JOB_TABLE.jobs.find((x) => x.when === undefined && x.open !== true)!, id: 'x-job', when: { looks: { min: 60 } } };
    expect(jobTableProblems([j]).join('\n')).toContain('looks');
    expect(jobTableProblems([{ ...j, when: { gender: ['female' as const] } }]).join('\n')).toContain('gender');
  });

  it('looksChannel은 romance·friend만 받는다(스키마)', () => {
    expect(problemsOf([ev({ id: 'test-ch', looksChannel: 'romance', choices: [ch('a'), ch('b')] })])).toBe('');
    expect(problemsOf([ev({ id: 'test-ch', looksChannel: 'friend', choices: [ch('a'), ch('b')] })])).toBe('');
    expect(problemsOf([ev({ id: 'test-ch', looksChannel: 'job', choices: [ch('a'), ch('b')] })])).toContain('looksChannel');
  });
});
