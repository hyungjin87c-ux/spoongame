import { describe, expect, it } from 'vitest';
import {
  ERAS,
  EventDataError,
  RESERVED_EVENT_IDS,
  STAGES,
  createEventPool,
  createRng,
  eventWeight,
  flagsRead,
  flagsWritten,
  isChoiceEvent,
  isEventEligible,
  lastSeenAge,
  lintEventData,
  meetsCondition,
  resolveEffects,
  stageOfAge,
  validateEventFiles,
  visibleChoices,
  type Character,
  type CondContext,
  type EligibilityView,
  type EventDef,
  type Era,
  type Stage,
  type Stats,
} from '../src/core';
import { EVENT_FILES, EVENT_POOL } from '../src/data/events';
import { STAGE_TABLE } from '../src/data/lifeTable';
import { ENCOUNTER_GROUPS } from '../scripts/simulateLib';

/** 테스트용 최소 유효 이벤트 (서술 / 선택지) */
const narrative = (over: Record<string, unknown> = {}) => ({
  id: 'test-narrative',
  title: '시험 이벤트',
  text: '시험용 서술 이벤트의 본문 문장이다.',
  stages: ['school'],
  weight: 10,
  once: true,
  effects: { stats: { happiness: 1 } },
  ...over,
});
const choiceEvent = (over: Record<string, unknown> = {}) => ({
  id: 'test-choice',
  title: '시험 선택',
  text: '시험용 선택지 이벤트의 본문 문장이다.',
  stages: ['school'],
  weight: 10,
  once: true,
  choices: [
    { id: 'a', label: '첫째', result: '첫째를 골랐다. 결과 문장.', effects: { stats: { wealth: 1 } } },
    { id: 'b', label: '둘째', result: '둘째를 골랐다. 결과 문장.', effects: { stats: { wealth: -1 } } },
  ],
  ...over,
});
const file = (...events: unknown[]) => ({ 'test.json': { events } });
const problemsOf = (files: Record<string, unknown>): string[] => {
  try {
    validateEventFiles(files);
    return [];
  } catch (e) {
    if (e instanceof EventDataError) return e.problems;
    throw e;
  }
};

const character = (over: Partial<Character> = {}): Character => ({
  name: '김민준',
  gender: 'male',
  birthYear: 2012,
  parentWealth: 3,
  parenting: 'free',
  looks: 50,
  ...over,
});
const stats = (over: Partial<Stats> = {}): Stats => ({ wealth: 50, education: 50, health: 50, happiness: 50, relationships: 50, ...over });
const ctx = (over: { character?: Partial<Character>; stats?: Partial<Stats>; flags?: string[] } = {}): CondContext => ({
  character: character(over.character),
  stats: stats(over.stats),
  flags: new Set(over.flags ?? []),
});
const view = (age: number, era: Era, over: Parameters<typeof ctx>[0] = {}, seen: Record<string, number> = {}): EligibilityView => ({
  ...ctx(over),
  age,
  era,
  seen,
});
const one = (raw: unknown): EventDef => validateEventFiles(file(raw))[0];

describe('이벤트 스키마 검증: 유효한 데이터', () => {
  it('최소 유효 서술·선택지 이벤트가 통과하고 EventDef로 돌아온다', () => {
    const [n, c] = validateEventFiles(file(narrative(), choiceEvent()));
    expect(isChoiceEvent(n)).toBe(false);
    expect(isChoiceEvent(c)).toBe(true);
    expect(c.choices).toHaveLength(2);
  });

  it('선택지는 2개와 3개 모두 허용되고, 3번째 선택지에만 조건이 있어도 된다', () => {
    const three = choiceEvent({
      choices: [
        { id: 'a', label: '첫째', result: '첫째를 골랐다. 결과 문장.' },
        { id: 'b', label: '둘째', result: '둘째를 골랐다. 결과 문장.' },
        { id: 'c', label: '셋째', result: '셋째를 골랐다. 결과 문장.', requires: { parentWealth: { min: 4 } } },
      ],
    });
    expect(validateEventFiles(file(three))[0].choices).toHaveLength(3);
  });

  it('조건·보너스·가중치 배수·플래그가 모두 있는 이벤트도 통과한다', () => {
    const rich = narrative({
      id: 'rich-event',
      stages: ['youth', 'middle'],
      ageRange: { min: 30, max: 45 },
      eras: ['present', 'future'],
      cooldown: undefined,
      once: false,
      conditions: {
        stats: { wealth: { min: 10, max: 90 }, health: { min: 20 } },
        looks: { min: 10 },
        parentWealth: { max: 4 },
        parenting: ['free', 'strict'],
        gender: ['male', 'female'],
        flags: ['flag_a'],
        notFlags: ['flag_b'],
      },
      modifiers: [{ when: { looks: { min: 70 } }, weight: 2 }],
      bonuses: [{ when: { parenting: ['strict'] }, effects: { stats: { education: 2 }, setFlags: ['flag_c'], clearFlags: ['flag_d'] } }],
      effects: { stats: { happiness: -2 }, setFlags: ['flag_a', 'flag_b', 'flag_d'] },
    });
    delete (rich as Record<string, unknown>).cooldown;
    expect(() => validateEventFiles(file(rich))).not.toThrow();
  });
});

describe('이벤트 스키마 검증: 잘못된 데이터는 개발 중 바로 드러난다', () => {
  // [설명, 파일 묶음, 오류 메시지에 들어 있어야 할 조각]
  const bad: Array<[string, Record<string, unknown>, string]> = [
    ['최상위가 객체가 아님', { 'x.json': [] }, '최상위는'],
    ['events가 없음', { 'x.json': {} }, '"events"가 없다'],
    ['events가 빈 배열', { 'x.json': { events: [] } }, '비어 있지 않은 배열'],
    ['알 수 없는 최상위 항목', { 'x.json': { events: [narrative()], extra: 1 } }, '알 수 없는 항목 "extra"'],
    ['이벤트가 객체가 아님', file(5), '이벤트 객체여야'],
    ['필수 항목 id 없음', file(narrative({ id: undefined })), '필수 항목 "id"'],
    ['필수 항목 once 없음', file(narrative({ once: undefined })), '필수 항목 "once"'],
    ['id 형식(대문자)', file(narrative({ id: 'Bad_Id' })), '.id'],
    ['알 수 없는 이벤트 항목(오타 weigth)', file(narrative({ weigth: 3 })), '알 수 없는 항목 "weigth"'],
    ['제목이 빈 문자열', file(narrative({ title: '' })), '길이는 1~30자'],
    ['본문이 너무 짧음', file(narrative({ text: '짧다' })), '길이는 10~400자'],
    ['본문에 줄바꿈', file(narrative({ text: '첫 줄이다.\n둘째 줄이다.' })), '제어 문자'],
    ['본문 앞뒤 공백', file(narrative({ text: ' 앞에 공백이 있는 본문 문장이다.' })), '앞뒤 공백'],
    ['stages가 빈 배열', file(narrative({ stages: [] })), 'stages'],
    ['stages에 없는 단계', file(narrative({ stages: ['teen'] })), '허용되지 않는 값'],
    ['stages 중복', file(narrative({ stages: ['school', 'school'] })), '중복'],
    ['eras에 없는 시대', file(narrative({ eras: ['ancient'] })), '허용되지 않는 값'],
    ['weight 0', file(narrative({ weight: 0 })), 'weight'],
    ['weight 문자열', file(narrative({ weight: '10' })), 'weight'],
    ['weight 101', file(narrative({ weight: 101 })), 'weight'],
    ['once가 불리언이 아님', file(narrative({ once: 'yes' })), 'once'],
    ['cooldown과 once:true 동시', file(narrative({ cooldown: 5 })), 'cooldown이 필요 없다'],
    ['cooldown 범위 밖', file(narrative({ once: false, cooldown: 0 })), 'cooldown'],
    ['ageRange min>max', file(narrative({ ageRange: { min: 15, max: 10 } })), 'min(15)이 max(10)보다 크다'],
    ['ageRange가 단계와 안 겹침', file(narrative({ stages: ['school'], ageRange: { min: 30, max: 40 } })), '절대 일어나지 않는다'],
    ['ageRange 항목 없음', file(narrative({ ageRange: {} })), 'min 또는 max'],
    ['ageRange 소수', file(narrative({ ageRange: { min: 7.5 } })), '정수'],
    ['조건이 빈 객체', file(narrative({ conditions: {} })), '빈 조건'],
    ['조건의 알 수 없는 스탯', file(narrative({ conditions: { stats: { luck: { min: 1 } } } })), '알 수 없는 스탯'],
    ['조건 범위 101', file(narrative({ conditions: { stats: { health: { min: 101 } } } })), '0~100의 정수'],
    ['parentWealth 6', file(narrative({ conditions: { parentWealth: { min: 6 } } })), '1~5의 정수'],
    ['조건의 parenting 이상값', file(narrative({ conditions: { parenting: ['wild'] } })), '허용되지 않는 값'],
    ['플래그 형식(대문자)', file(narrative({ conditions: { flags: ['Has Job'] } })), '플래그 이름'],
    ['flags와 notFlags가 같은 플래그', file(narrative({ conditions: { flags: ['x_flag'], notFlags: ['x_flag'] } }), narrative({ id: 'setter', effects: { setFlags: ['x_flag'] } })), '절대 참이 될 수 없다'],
    ['효과가 빈 객체', file(narrative({ effects: {} })), '빈 효과'],
    ['효과의 알 수 없는 스탯', file(narrative({ effects: { stats: { luck: 3 } } })), '알 수 없는 스탯'],
    ['효과 변화량 0', file(narrative({ effects: { stats: { wealth: 0 } } })), '0이 아닌 정수'],
    ['효과 변화량 소수', file(narrative({ effects: { stats: { wealth: 1.5 } } })), '0이 아닌 정수'],
    ['효과 변화량 절댓값 51', file(narrative({ effects: { stats: { wealth: 51 } } })), '절댓값 50 이하'],
    ['같은 효과에서 플래그를 켜고 끔', file(narrative({ effects: { setFlags: ['same_flag'], clearFlags: ['same_flag'] } })), '켜고 끈다'],
    ['보너스에 when 없음', file(narrative({ bonuses: [{ effects: { stats: { wealth: 1 } } }] })), '필수 항목 "when"'],
    ['모디파이어 weight 11', file(narrative({ modifiers: [{ when: { looks: { min: 1 } }, weight: 11 }] })), '배수'],
    ['선택지 1개', file(choiceEvent({ choices: [{ id: 'a', label: '첫째', result: '첫째를 골랐다. 결과 문장.' }] })), '선택지는 2~3개'],
    [
      '선택지 4개',
      file(choiceEvent({ choices: ['a', 'b', 'c', 'd'].map((id) => ({ id, label: id, result: `${id}를 골랐다. 결과 문장.` })) })),
      '선택지는 2~3개',
    ],
    ['선택지 id 중복', file(choiceEvent({ choices: [{ id: 'a', label: '가', result: '가를 골랐다. 문장.' }, { id: 'a', label: '나', result: '나를 골랐다. 문장.' }] })), '선택지 id가 중복'],
    ['선택지 label 없음', file(choiceEvent({ choices: [{ id: 'a', result: '가를 골랐다. 문장.' }, { id: 'b', label: '나', result: '나를 골랐다. 문장.' }] })), '필수 항목 "label"'],
    ['선택지 result가 너무 짧음', file(choiceEvent({ choices: [{ id: 'a', label: '가', result: '짧음' }, { id: 'b', label: '나', result: '나를 골랐다. 문장.' }] })), '길이는 6~300자'],
    [
      '조건 없는 선택지가 2개 미만',
      file(
        choiceEvent({
          choices: [
            { id: 'a', label: '가', result: '가를 골랐다. 문장.' },
            { id: 'b', label: '나', result: '나를 골랐다. 문장.', requires: { parentWealth: { min: 4 } } },
            { id: 'c', label: '다', result: '다를 골랐다. 문장.', requires: { parentWealth: { min: 5 } } },
          ],
        }),
      ),
      '조건(requires) 없는 선택지가 2개 이상',
    ],
    ['선택지 이벤트에 이벤트 단위 effects', file(choiceEvent({ effects: { stats: { wealth: 1 } } })), '이벤트 단위의 effects'],
    ['선택지의 알 수 없는 항목', file(choiceEvent({ choices: [{ id: 'a', label: '가', result: '가를 골랐다. 문장.', cost: 3 }, { id: 'b', label: '나', result: '나를 골랐다. 문장.' }] })), '알 수 없는 항목 "cost"'],
    // R-046: 검증은 통과하지만 런타임을 깨는 비현실적 입력
    ['weight가 0에 가까운 양수(1e-300)', file(narrative({ weight: 1e-300 })), '0.1 이상'],
    ['weight 0.05(하한 미만)', file(narrative({ weight: 0.05 })), '0.1 이상'],
    ['모디파이어 배수 1e-300', file(narrative({ modifiers: [{ when: { looks: { min: 1 } }, weight: 1e-300 }] })), '0.1 이상'],
    ['모디파이어 배수 0.05(하한 미만)', file(narrative({ modifiers: [{ when: { looks: { min: 1 } }, weight: 0.05 }] })), '0.1 이상'],
    ['모디파이어 7개(상한 6개)', file(narrative({ modifiers: Array.from({ length: 7 }, (_, i) => ({ when: { looks: { min: i + 1 } }, weight: 1.1 })) })), '모디파이어는 최대 6개'],
    ['줄이는 모디파이어의 곱이 너무 작음(0.1 x 0.1 x 0.1 x weight 1)', file(narrative({ weight: 1, modifiers: [1, 2, 3].map((i) => ({ when: { looks: { min: i } }, weight: 0.1 })) })), '0.01 아래'],
    ['키우는 모디파이어의 곱이 너무 큼(10^6 x weight 100)', file(narrative({ weight: 100, modifiers: [1, 2, 3, 4, 5, 6].map((i) => ({ when: { looks: { min: i } }, weight: 10 })) })), '10000을 넘는다'],
    ['보너스 9개(상한 8개)', file(narrative({ bonuses: Array.from({ length: 9 }, (_, i) => ({ when: { looks: { min: i + 1 } }, effects: { stats: { happiness: 1 } } })) })), '보너스는 최대 8개'],
    [
      '서술 이벤트의 한 스탯 최대 합계가 50 초과(기본 +30, 보너스 +30)',
      file(narrative({ effects: { stats: { wealth: 30 } }, bonuses: [{ when: { looks: { min: 1 } }, effects: { stats: { wealth: 30 } } }] })),
      '최대 합계(+60)',
    ],
    [
      '선택지의 한 스탯 최소 합계가 -50 미만(기본 -30, 보너스 -30)',
      file(
        choiceEvent({
          choices: [
            { id: 'a', label: '가', result: '가를 골랐다. 문장.', effects: { stats: { health: -30 } }, bonuses: [{ when: { looks: { min: 1 } }, effects: { stats: { health: -30 } } }] },
            { id: 'b', label: '나', result: '나를 골랐다. 문장.' },
          ],
        }),
      ),
      '최소 합계(-60)',
    ],
    ['예약어 id(constructor)', file(narrative({ id: 'constructor' })), '예약어'],
    ['예약어 id(prototype)', file(narrative({ id: 'prototype' })), '예약어'],
    ['예약어 id(대문자 섞임 toString은 id 형식 오류)', file(narrative({ id: 'toString' })), '.id'],
    ['예약어 id(__proto__는 id 형식 오류)', file(narrative({ id: '__proto__' })), '.id'],
  ];

  for (const [name, files, fragment] of bad) {
    it(`${name} → EventDataError (메시지에 "${fragment}")`, () => {
      const problems = problemsOf(files);
      expect(problems.length, '문제가 하나도 보고되지 않았다').toBeGreaterThan(0);
      expect(problems.join('\n')).toContain(fragment);
    });
  }

  it('오류 메시지에는 파일 이름과 이벤트 id·경로가 들어 있다 (어디를 고칠지 바로 보인다)', () => {
    const problems = problemsOf(file(narrative({ id: 'where-am-i', weight: -1 })));
    expect(problems.some((p) => p.includes('test.json') && p.includes('where-am-i') && p.includes('weight'))).toBe(true);
  });

  it('문제가 여러 개면 한 번에 모두 보고한다', () => {
    const problems = problemsOf(file(narrative({ weight: 0, title: '' }), narrative({ id: 'second', once: 'x' })));
    expect(problems.length).toBeGreaterThanOrEqual(3);
  });

  it('id가 파일 사이에서 겹치면 오류', () => {
    const problems = problemsOf({ 'a.json': { events: [narrative()] }, 'b.json': { events: [narrative()] } });
    expect(problems.join('\n')).toContain('모든 파일에서 하나뿐');
  });

  it('조건에서 읽는 플래그를 켜는 이벤트가 없으면 오류 (오타 방지) / 있으면 통과', () => {
    const reader = narrative({ id: 'reader', conditions: { flags: ['typo_flag'] } });
    expect(problemsOf(file(reader)).join('\n')).toContain('"typo_flag"를 켜는 이벤트가 어디에도 없다');
    const setter = narrative({ id: 'setter', effects: { setFlags: ['typo_flag'] } });
    expect(problemsOf(file(reader, setter))).toEqual([]);
    // 선택지의 효과로 켜도, 다른 파일에서 켜도 인정된다
    const choiceSetter = choiceEvent({
      id: 'choice-setter',
      choices: [
        { id: 'a', label: '가', result: '가를 골랐다. 문장.', effects: { setFlags: ['typo_flag'] } },
        { id: 'b', label: '나', result: '나를 골랐다. 문장.' },
      ],
    });
    expect(problemsOf({ 'a.json': { events: [reader] }, 'b.json': { events: [choiceSetter] } })).toEqual([]);
    // notFlags·requires·보너스·모디파이어에서 읽는 플래그도 같은 규칙
    for (const patch of [
      { conditions: { notFlags: ['typo_flag'] } },
      { modifiers: [{ when: { flags: ['typo_flag'] }, weight: 2 }] },
      { bonuses: [{ when: { flags: ['typo_flag'] }, effects: { stats: { wealth: 1 } } }] },
    ]) {
      expect(problemsOf(file(narrative({ id: 'reader', ...patch }))).join('\n')).toContain('typo_flag');
    }
    const requiresReader = choiceEvent({
      id: 'requires-reader',
      choices: [
        { id: 'a', label: '가', result: '가를 골랐다. 문장.' },
        { id: 'b', label: '나', result: '나를 골랐다. 문장.' },
        { id: 'c', label: '다', result: '다를 골랐다. 문장.', requires: { flags: ['typo_flag'] } },
      ],
    });
    expect(problemsOf(file(requiresReader)).join('\n')).toContain('typo_flag');
  });

  it('clearFlags가 켜진 적 없는 플래그를 끄면 오류', () => {
    expect(problemsOf(file(narrative({ effects: { clearFlags: ['never_set'] } }))).join('\n')).toContain('never_set');
  });
});

describe('이벤트 데이터(src/data/events/*.json): 60개 이상, 시대·단계 분포, 흐름, 어조 (SPEC-001 M4)', () => {
  const events = EVENT_POOL.events;
  const cellOf = (era: Era, stage: Stage) => events.filter((e) => e.stages.includes(stage) && (e.eras === undefined || e.eras.includes(era)));

  /** M3 표본 20개의 id: 저장(seen·대기 중인 선택지)이 가리키므로 콘텐츠를 갈아엎어도 남아 있어야 한다 (R-046). */
  const ORIGINAL_SAMPLE_IDS = [
    'infant-first-word', 'infant-care', 'school-lunch', 'school-friend', 'school-tutoring', 'school-first-love', 'school-exam', 'school-early-work',
    'youth-military', 'youth-work-pressure', 'youth-first-job', 'youth-meeting', 'youth-marriage', 'middle-business', 'middle-parents-care',
    'middle-health-check', 'middle-new-skills', 'senior-retire', 'senior-gathering', 'senior-illness',
  ];

  it('파일 5개(생애 단계별)가 모두 읽히고 스키마 검증을 통과해 풀에 들어 있다 (로드 시점에 검증하므로 잘못된 데이터면 이 import에서 이미 실패한다)', () => {
    expect(Object.keys(EVENT_FILES).sort()).toEqual(['./infant.json', './middle.json', './school.json', './senior.json', './youth.json']);
    expect(() => validateEventFiles(EVENT_FILES)).not.toThrow();
    expect(events.length).toBe(Object.values(EVENT_FILES).reduce((n: number, f) => n + (f as { events: unknown[] }).events.length, 0));
  });

  it('이벤트는 60개 이상(SPEC)이고 id가 모두 다르며, 선택지(2~3개)와 서술이 충분히 섞여 있다', () => {
    expect(events.length).toBeGreaterThanOrEqual(60);
    expect(new Set(events.map((e) => e.id)).size).toBe(events.length);
    const choices = events.filter(isChoiceEvent);
    expect(choices.length).toBeGreaterThanOrEqual(40);
    expect(events.length - choices.length).toBeGreaterThanOrEqual(20);
    for (const e of choices) expect([2, 3]).toContain(e.choices!.length);
    expect(choices.some((e) => e.choices!.length === 3)).toBe(true);
  });

  it('M3 표본 20개의 id가 모두 남아 있다 (콘텐츠 갱신이 기존 저장을 깨지 않게, R-046)', () => {
    expect(ORIGINAL_SAMPLE_IDS).toHaveLength(20);
    for (const id of ORIGINAL_SAMPLE_IDS) expect(EVENT_POOL.byId.has(id), id).toBe(true);
  });

  it('세 시대 x 다섯 단계의 모든 칸에 서술 이벤트와 선택지 이벤트가 충분하다 (영유아는 7년뿐이라 하한이 낮다)', () => {
    const MIN: Record<Stage, { narrative: number; choice: number }> = {
      infant: { narrative: 4, choice: 4 },
      school: { narrative: 4, choice: 10 },
      youth: { narrative: 5, choice: 12 },
      middle: { narrative: 4, choice: 12 },
      senior: { narrative: 4, choice: 10 },
    };
    for (const era of ERAS) {
      for (const stage of STAGES) {
        const here = cellOf(era, stage);
        const choice = here.filter(isChoiceEvent).length;
        expect(choice, `${era}/${stage}: 선택지 이벤트`).toBeGreaterThanOrEqual(MIN[stage].choice);
        expect(here.length - choice, `${era}/${stage}: 서술 이벤트`).toBeGreaterThanOrEqual(MIN[stage].narrative);
      }
    }
  });

  it('시대마다 고유한 이벤트가 있다: 지난 세상·지금 세상·다가올 세상 전용이 각각 있고, 시대 중립 공용이 대부분이다 (R-045 d)', () => {
    const only = (era: Era) => events.filter((e) => e.eras !== undefined && e.eras.length === 1 && e.eras[0] === era);
    expect(only('past').length).toBeGreaterThanOrEqual(4);
    expect(only('present').length).toBeGreaterThanOrEqual(2);
    expect(only('future').length).toBeGreaterThanOrEqual(3);
    expect(events.filter((e) => e.eras === undefined).length).toBeGreaterThan(events.length / 2);
    // 시대 전용 이벤트가 여러 단계에 흩어져 있다 (한 단계에만 몰리지 않는다)
    for (const era of ERAS) expect(new Set(only(era).flatMap((e) => e.stages)).size, era).toBeGreaterThanOrEqual(2);
  });

  it('0세에는 일어날 수 있는 이벤트가 없다: 첫 해는 항상 조용한 해다 (프로덕션 스모크·e2e가 "새 판의 첫 한 해는 선택지 없이 지나간다"에 기댄다)', () => {
    for (const era of ERAS) expect(cellOf(era, 'infant').filter((e) => (e.ageRange?.min ?? 0) <= 0).map((e) => e.id), era).toEqual([]);
  });

  it('모든 이벤트는 한 판에 한 번만 나온다(once:true) — 같은 문구가 한 판에서 되풀이되지 않는다 (QA 사용감 7)', () => {
    expect(events.filter((e) => !e.once).map((e) => e.id)).toEqual([]);
  });

  it('문구 점검을 통과한다: 느낌표·이모지·URL·달력 연도·실제 이름·구어체·길이·시대 소재 — `npm run check:events`(= 빌드)와 같은 함수 (QA 사용감 8)', () => {
    expect(lintEventData(events, EVENT_FILES)).toEqual([]);
  });

  it('외모가 연애·결혼·사업 이벤트 확률에 직접 반영된다: 연애·결혼·사업 묶음의 모든 이벤트가 외모 모디파이어나 외모 조건을 가진다 (R-044)', () => {
    for (const [group, ids] of Object.entries(ENCOUNTER_GROUPS)) {
      for (const id of ids) {
        const ev = EVENT_POOL.byId.get(id);
        expect(ev, `${group}: ${id}가 풀에 없다`).toBeDefined();
        const reflectsLooks = (ev!.modifiers ?? []).some((m) => m.when.looks !== undefined) || ev!.conditions?.looks !== undefined;
        expect(reflectsLooks, `${group}: ${id}에 외모 모디파이어/조건이 없다`).toBe(true);
      }
    }
    // 결혼에도 직접 반영: 결혼 이벤트의 외모 높음 배수가 1보다 크고 낮음 배수가 1보다 작다
    for (const id of ENCOUNTER_GROUPS.marriage) {
      const mods = EVENT_POOL.byId.get(id)!.modifiers!.filter((m) => m.when.looks !== undefined);
      const high = mods.find((m) => m.when.looks!.min !== undefined)!.weight;
      const low = mods.find((m) => m.when.looks!.max !== undefined)!.weight;
      expect(high, id).toBeGreaterThan(1);
      expect(low, id).toBeLessThan(1);
    }
  });

  it('부모 재력·교육방식이 이벤트 노출·효과에 충분히 반영된다 (조건·확률 배수·선택지 노출·보너스에 쓰인다)', () => {
    const conds = (e: EventDef) => [
      e.conditions,
      ...(e.modifiers ?? []).map((m) => m.when),
      ...(e.bonuses ?? []).map((b) => b.when),
      ...(e.choices ?? []).flatMap((c) => [c.requires, ...(c.bonuses ?? []).map((b) => b.when)]),
    ];
    const uses = (e: EventDef, key: 'parentWealth' | 'parenting') => conds(e).some((c) => c !== undefined && c[key] !== undefined);
    expect(events.filter((e) => uses(e, 'parentWealth')).length).toBeGreaterThanOrEqual(20);
    expect(events.filter((e) => uses(e, 'parenting')).length).toBeGreaterThanOrEqual(10);
    expect(events.filter((e) => uses(e, 'parentWealth') || uses(e, 'parenting')).length).toBeGreaterThanOrEqual(30);
    // 효과(보너스)로 반영되는 것, 노출(선택지 requires)로 반영되는 것, 확률(모디파이어)로 반영되는 것이 모두 있다
    expect(events.some((e) => (e.choices ?? []).some((c) => c.requires?.parentWealth !== undefined))).toBe(true);
    expect(events.some((e) => (e.choices ?? []).some((c) => (c.bonuses ?? []).some((b) => b.when.parentWealth !== undefined || b.when.parenting !== undefined)))).toBe(true);
    expect(events.some((e) => (e.modifiers ?? []).some((m) => m.when.parenting !== undefined))).toBe(true);
  });

  describe('플래그 연결: 선택이 이후 이벤트를 여닫는다 (R-045 e)', () => {
    // [플래그, 켜는 이벤트, 읽는 이벤트들]
    const CHAINS: Array<[string, string, string[]]> = [
      ['has_partner', 'youth-meeting', ['youth-marriage', 'youth-marriage-again', 'youth-partner-leaves']],
      ['met_intro', 'youth-meeting', ['youth-meeting-again']],
      ['marriage_waited', 'youth-marriage', ['youth-marriage-again']],
      ['marriage_waited_twice', 'youth-marriage-again', ['youth-partner-leaves']],
      ['broke_up', 'youth-marriage', ['youth-reunion']],
      ['married', 'youth-marriage', ['youth-child', 'middle-marriage-crisis', 'senior-spouse-care', 'middle-business']],
      ['child_postponed', 'youth-child', ['youth-child-again']],
      ['has_child', 'youth-child', ['middle-child-school', 'middle-child-leaves', 'senior-grandchildren', 'senior-grandchild-visit', 'senior-gathering', 'senior-estranged-child']],
      ['child_distant', 'middle-child-school', ['senior-estranged-child', 'senior-grandchildren', 'senior-grandchild-visit', 'senior-gathering', 'senior-move-home']],
      ['exam_prep', 'youth-exam-prep', ['youth-exam-passed', 'youth-exam-failed']],
      ['saving_for_school', 'youth-night-study', ['youth-return-school']],
      ['health_ignored', 'middle-health-check', ['middle-health-crisis', 'middle-health-check-later']],
      ['laid_off', 'middle-layoff', ['middle-job-again']],
      ['close_friend', 'school-friend', ['youth-friend-wedding', 'middle-friend-reunion', 'senior-old-friend']],
      ['mentor_teacher', 'school-teacher-notice', ['school-exam']],
      ['scholar', 'school-scholarship', ['school-exam']],
      ['own_business', 'middle-business', ['middle-own-shop-year', 'senior-retire']],
      ['has_career', 'youth-first-job', ['middle-business', 'middle-layoff', 'youth-colleague']],
      // REV-001-M4-1 R-057~R-062: 이미 일어난 일이 뒤의 이벤트를 닫고 여는 연결
      ['parents_gone', 'middle-parents-farewell', ['middle-parents-care']],
      ['child_left', 'middle-child-leaves', ['middle-child-grows', 'middle-child-school', 'middle-late-child']],
      ['child_late', 'youth-child-again', ['middle-child-grows', 'middle-child-school', 'middle-child-leaves', 'middle-late-child', 'middle-both-working']],
      ['left_school', 'school-family-priority', ['school-exam', 'school-tutoring', 'school-friend', 'school-lunch', 'school-career-choice']],
      ['renting', 'youth-housing', ['youth-rent-hike']],
      ['reunited', 'youth-reunion', ['youth-second-chance']],
      ['checked_up', 'middle-health-check', ['middle-health-check-later']],
      ['family_business', 'youth-first-job', ['middle-layoff']],
      ['passed_exam', 'youth-exam-passed', ['middle-layoff', 'youth-factory-night']],
      // REV-001-M4-2 R-072~R-075 (M5): 사업·늦게 맞은 아이·부모님 집·살던 집을 떠남
      ['own_business', 'youth-startup', ['youth-first-job', 'youth-job-rejections', 'youth-gig-work', 'youth-factory-night']],
      ['child_late', 'youth-child-again', ['senior-gathering']],
      ['lives_with_parents', 'youth-housing', ['youth-lonely-city']],
      ['moved_home', 'senior-move-home', ['senior-alone', 'senior-illness-later']],
      // REV-001-M5-1 R-082: 혼자 사는 방이면 부모님 집에 머물 수 없고, 돌봄 시설이면 손주를 맡을 수 없다(자식 곁 이주는 moved_home만)
      ['lives_alone', 'youth-lonely-city', ['youth-housing']],
      ['in_care', 'senior-move-home', ['senior-grandchildren', 'senior-gathering']],
    ];
    for (const [flag, setter, readers] of CHAINS) {
      it(`${flag}: ${setter} -> ${readers.join(', ')}`, () => {
        expect(flagsWritten(EVENT_POOL.byId.get(setter)!).set.has(flag), `${setter}가 ${flag}를 켜지 않는다`).toBe(true);
        for (const r of readers) expect(flagsRead(EVENT_POOL.byId.get(r)!).has(flag), `${r}가 ${flag}를 읽지 않는다`).toBe(true);
      });
    }

    it('플래그를 끄는 선택도 있다: 헤어짐·퇴직·친구와의 멀어짐·별거', () => {
      const clears = (id: string, flag: string) => flagsWritten(EVENT_POOL.byId.get(id)!).clear.has(flag);
      expect(clears('youth-marriage', 'has_partner')).toBe(true);
      expect(clears('middle-layoff', 'has_career')).toBe(true);
      expect(clears('youth-friend-wedding', 'close_friend')).toBe(true);
      expect(clears('middle-marriage-crisis', 'married')).toBe(true);
      // R-062: 이혼하면 연인 상태도 풀린다 / 화해하면 소원한 상태가 풀린다 / 재회 뒤 결혼·이별을 정하면 재회 표시가 풀린다
      expect(clears('middle-marriage-crisis', 'has_partner')).toBe(true);
      expect(clears('senior-estranged-child', 'child_distant')).toBe(true);
      expect(clears('youth-second-chance', 'reunited')).toBe(true);
    });

    it('켜는 플래그의 종류가 충분하다: 서로 다른 플래그 25개 이상', () => {
      const all = new Set<string>();
      for (const e of events) for (const f of flagsWritten(e).set) all.add(f);
      expect(all.size).toBeGreaterThanOrEqual(25);
    });
  });

  it('원문 인용을 피한다: 모든 파일 note에 "모티브로만 새로 쓴 글"이라고 밝혀 있고 "출처"·"원문"·"퍼옴" 같은 인용 표지가 없다', () => {
    for (const f of Object.values(EVENT_FILES)) {
      const json = JSON.stringify(f);
      expect(json).not.toMatch(/출처|원문|퍼옴|펌|커뮤니티 글|링크/);
      expect((f as { note: string }).note).toContain('모티브로만 새로 쓴 글');
    }
  });
});

describe('R-046: 예약어 id와 상속 속성 (런타임 방어)', () => {
  it('lastSeenAge는 자기 속성만 읽는다: constructor·toString·__proto__ 같은 이름이 본 적 있음으로 읽히지 않는다', () => {
    const seen: Record<string, number> = { 'real-event': 12 };
    expect(lastSeenAge(seen, 'real-event')).toBe(12);
    for (const name of ['constructor', 'toString', 'valueOf', '__proto__', 'hasOwnProperty', 'prototype']) expect(lastSeenAge(seen, name), name).toBeUndefined();
  });

  it('id가 constructor인 이벤트가 (검증을 우회해) 풀에 있어도, 본 적 없으면 후보가 되고 본 적 있으면 once에 걸린다', () => {
    const ev = { ...one(narrative({ id: 'plain-event' })), id: 'constructor' } as EventDef;
    expect(isEventEligible(ev, view(10, 'present', {}, {}))).toBe(true);
    expect(isEventEligible(ev, view(15, 'present', {}, { constructor: 10 }))).toBe(false);
  });

  it('예약어 목록: constructor·prototype·__proto__와 Object.prototype의 모든 속성 이름(소문자)', () => {
    for (const name of ['constructor', 'prototype', '__proto__', 'tostring', 'valueof', 'hasownproperty']) expect(RESERVED_EVENT_IDS.has(name), name).toBe(true);
    expect(RESERVED_EVENT_IDS.has('school-friend')).toBe(false);
  });

  it('풀에 있는 이벤트 id는 하나도 예약어가 아니다', () => {
    for (const e of EVENT_POOL.events) expect(RESERVED_EVENT_IDS.has(e.id.toLowerCase()), e.id).toBe(false);
  });
});

describe('조건 평가', () => {
  const c = ctx({ character: { looks: 70, parentWealth: 4, parenting: 'strict', gender: 'female' }, stats: { wealth: 30, health: 80 }, flags: ['married', 'has_career'] });

  it('조건이 없으면 항상 참', () => {
    expect(meetsCondition(undefined, c)).toBe(true);
  });

  it('스탯 범위: min·max 경계 포함, 둘 중 하나만 있어도 된다', () => {
    expect(meetsCondition({ stats: { wealth: { min: 30 } } }, c)).toBe(true);
    expect(meetsCondition({ stats: { wealth: { min: 31 } } }, c)).toBe(false);
    expect(meetsCondition({ stats: { wealth: { max: 30 } } }, c)).toBe(true);
    expect(meetsCondition({ stats: { wealth: { max: 29 } } }, c)).toBe(false);
    expect(meetsCondition({ stats: { health: { min: 80, max: 80 } } }, c)).toBe(true);
  });

  it('여러 스탯 조건은 모두 맞아야 한다(AND)', () => {
    expect(meetsCondition({ stats: { wealth: { max: 40 }, health: { min: 70 } } }, c)).toBe(true);
    expect(meetsCondition({ stats: { wealth: { max: 40 }, health: { min: 90 } } }, c)).toBe(false);
  });

  it('외모 조건', () => {
    expect(meetsCondition({ looks: { min: 70 } }, c)).toBe(true);
    expect(meetsCondition({ looks: { min: 71 } }, c)).toBe(false);
    expect(meetsCondition({ looks: { max: 69 } }, c)).toBe(false);
  });

  it('부모 재력 조건', () => {
    expect(meetsCondition({ parentWealth: { min: 4 } }, c)).toBe(true);
    expect(meetsCondition({ parentWealth: { max: 3 } }, c)).toBe(false);
  });

  it('교육방식·성별은 목록 중 하나면 맞다', () => {
    expect(meetsCondition({ parenting: ['free', 'strict'] }, c)).toBe(true);
    expect(meetsCondition({ parenting: ['free'] }, c)).toBe(false);
    expect(meetsCondition({ gender: ['female'] }, c)).toBe(true);
    expect(meetsCondition({ gender: ['male'] }, c)).toBe(false);
  });

  it('flags는 모두 설정돼 있어야, notFlags는 하나도 없어야 한다', () => {
    expect(meetsCondition({ flags: ['married'] }, c)).toBe(true);
    expect(meetsCondition({ flags: ['married', 'has_career'] }, c)).toBe(true);
    expect(meetsCondition({ flags: ['married', 'own_business'] }, c)).toBe(false);
    expect(meetsCondition({ notFlags: ['own_business'] }, c)).toBe(true);
    expect(meetsCondition({ notFlags: ['own_business', 'married'] }, c)).toBe(false);
  });

  it('서로 다른 종류의 조건은 모두 맞아야 한다(AND)', () => {
    expect(meetsCondition({ looks: { min: 60 }, flags: ['married'], gender: ['female'] }, c)).toBe(true);
    expect(meetsCondition({ looks: { min: 60 }, flags: ['married'], gender: ['male'] }, c)).toBe(false);
  });
});

describe('생애 단계와 이벤트 후보 판정', () => {
  const edges: Array<[number, Stage]> = [
    [0, 'infant'],
    [6, 'infant'],
    [7, 'school'],
    [19, 'school'],
    [20, 'youth'],
    [39, 'youth'],
    [40, 'middle'],
    [64, 'middle'],
    [65, 'senior'],
    [110, 'senior'],
  ];
  for (const [age, stage] of edges) {
    it(`${age}세는 ${stage}`, () => expect(stageOfAge(age)).toBe(stage));
  }

  it('나이 경계 표(STAGE_TABLE)가 직접 적은 값과 같다: 영유아 0~6 / 학창 7~19 / 청년 20~39 / 중년 40~64 / 노년 65~', () => {
    expect(STAGES.map((s) => STAGE_TABLE[s].startAge)).toEqual([0, 7, 20, 40, 65]);
    expect(STAGES.map((s) => STAGE_TABLE[s].label)).toEqual(['영유아', '학창', '청년', '중년', '노년']);
  });

  const ev = one(narrative({ stages: ['school'], ageRange: { min: 10, max: 12 }, eras: ['present'], once: false, cooldown: 4 }));

  it('단계·나이 범위·시대가 모두 맞아야 후보가 된다', () => {
    expect(isEventEligible(ev, view(11, 'present'))).toBe(true);
    expect(isEventEligible(ev, view(9, 'present'))).toBe(false);
    expect(isEventEligible(ev, view(13, 'present'))).toBe(false);
    expect(isEventEligible(ev, view(11, 'past'))).toBe(false);
    expect(isEventEligible(ev, view(11, 'future'))).toBe(false);
    // 단계 밖(나이 범위는 맞지만 단계가 다름)
    const youthOnly = one(narrative({ stages: ['youth'], ageRange: { min: 20, max: 25 } }));
    expect(isEventEligible(youthOnly, view(18, 'present'))).toBe(false);
  });

  it('once 이벤트는 한 번 본 뒤 다시 나오지 않고, 반복 이벤트는 cooldown 동안 쉰다', () => {
    const once = one(narrative({ once: true }));
    expect(isEventEligible(once, view(10, 'present', {}, {}))).toBe(true);
    expect(isEventEligible(once, view(15, 'present', {}, { 'test-narrative': 10 }))).toBe(false);
    // cooldown 4: 11세에 봤으면 14세까지 쉰다, 15세부터 다시
    const wide = one(narrative({ once: false, cooldown: 4, ageRange: { min: 7, max: 19 } }));
    expect(isEventEligible(wide, view(14, 'present', {}, { 'test-narrative': 11 }))).toBe(false);
    expect(isEventEligible(wide, view(15, 'present', {}, { 'test-narrative': 11 }))).toBe(true);
  });

  it('cooldown을 안 쓰면 기본 10년', () => {
    const rep = one(narrative({ once: false, stages: ['middle'] }));
    expect(isEventEligible(rep, view(50, 'present', {}, { 'test-narrative': 41 }))).toBe(false);
    expect(isEventEligible(rep, view(51, 'present', {}, { 'test-narrative': 41 }))).toBe(true);
  });

  it('조건(스탯·플래그·외모·부모 재력)이 안 맞으면 후보가 아니다', () => {
    const cond = one(narrative({ conditions: { flags: ['has_job'], looks: { min: 60 }, parentWealth: { min: 3 } }, effects: { setFlags: ['has_job'] } }));
    const ok = { character: { looks: 60, parentWealth: 3 as const }, flags: ['has_job'] };
    expect(isEventEligible(cond, view(10, 'present', ok))).toBe(true);
    expect(isEventEligible(cond, view(10, 'present', { ...ok, flags: [] }))).toBe(false);
    expect(isEventEligible(cond, view(10, 'present', { ...ok, character: { ...ok.character, looks: 59 } }))).toBe(false);
    expect(isEventEligible(cond, view(10, 'present', { ...ok, character: { ...ok.character, parentWealth: 2 } }))).toBe(false);
  });

  it('선택지 이벤트는 보이는 선택지가 2개 이상일 때만 후보이고, requires로 3번째 선택지가 열린다', () => {
    const e = one(
      choiceEvent({
        choices: [
          { id: 'a', label: '가', result: '가를 골랐다. 문장.' },
          { id: 'b', label: '나', result: '나를 골랐다. 문장.' },
          { id: 'c', label: '다', result: '다를 골랐다. 문장.', requires: { parentWealth: { min: 4 } } },
        ],
      }),
    );
    expect(visibleChoices(e, ctx({ character: { parentWealth: 3 } })).map((c) => c.id)).toEqual(['a', 'b']);
    expect(visibleChoices(e, ctx({ character: { parentWealth: 5 } })).map((c) => c.id)).toEqual(['a', 'b', 'c']);
    expect(isEventEligible(e, view(10, 'present'))).toBe(true);
  });

  it('visibleChoices가 2개 미만이 되도록 만든 선택지 이벤트는 후보가 아니다 (런타임 방어)', () => {
    const fake = { ...one(choiceEvent()), choices: [one(choiceEvent()).choices![0]] } as EventDef;
    expect(isEventEligible(fake, view(10, 'present'))).toBe(false);
  });
});

describe('확률 가중치와 효과에 캐릭터 속성이 반영된다', () => {
  it('eventWeight: 외모 모디파이어가 연애 이벤트 확률을 바꾼다 (외모 높음 ×2, 낮음 ×0.6, 보통 ×1)', () => {
    const love = EVENT_POOL.byId.get('school-first-love')!;
    const w = (looks: number) => eventWeight(love, ctx({ character: { looks } }));
    expect(w(50)).toBe(love.weight);
    expect(w(70)).toBe(love.weight * 2);
    expect(w(100)).toBe(love.weight * 2);
    expect(w(30)).toBeCloseTo(love.weight * 0.6, 10);
    expect(w(0)).toBeCloseTo(love.weight * 0.6, 10);
  });

  it('여러 모디파이어는 곱해진다 (소개 이벤트: 외모 높음 배수 x 첫사랑 플래그 배수 — 배수는 데이터에서 읽는다)', () => {
    const meet = EVENT_POOL.byId.get('youth-meeting')!;
    const high = meet.modifiers!.find((m) => m.when.looks?.min !== undefined)!.weight;
    const love = meet.modifiers!.find((m) => m.when.flags?.includes('first_love'))!.weight;
    expect(high).toBeGreaterThan(1);
    expect(eventWeight(meet, ctx({ character: { looks: 80 }, flags: ['first_love'] }))).toBeCloseTo(meet.weight * high * love, 10);
  });

  it('외모 높은 쪽이 연애 이벤트를 실제로 더 자주 만난다 (시드 RNG 표집, 가중 추첨 경유)', () => {
    const love = EVENT_POOL.byId.get('school-first-love')!;
    const other = one(narrative({ id: 'other-event', weight: love.weight, stages: ['school'], ageRange: { min: 15, max: 19 } }));
    const share = (looks: number) => {
      const rng = createRng(4242);
      let hits = 0;
      for (let i = 0; i < 4000; i++) {
        const list = [love, other];
        const idx = rng.weightedIndex(list.map((e) => eventWeight(e, ctx({ character: { looks } }))));
        if (list[idx] === love) hits++;
      }
      return hits / 4000;
    };
    // 기대: 높음 2/3, 보통 1/2, 낮음 0.6/1.6 = 0.375
    expect(share(90)).toBeGreaterThan(share(50) + 0.1);
    expect(share(50)).toBeGreaterThan(share(10) + 0.07);
  });

  it('resolveEffects: 보너스는 조건이 맞을 때만 더해지고 같은 스탯은 합산된다', () => {
    const tutoring = EVENT_POOL.byId.get('school-tutoring')!.choices!.find((c) => c.id === 'academy')!;
    const eff = (parenting: Character['parenting'], parentWealth: Character['parentWealth']) =>
      resolveEffects(tutoring.effects, tutoring.bonuses, ctx({ character: { parenting, parentWealth } })).stats;
    expect(eff('free', 3)).toEqual({ education: 6, happiness: -3, wealth: -3 });
    expect(eff('strict', 3)).toEqual({ education: 8, happiness: -3, wealth: -3 }); // 엄격한 교육방식: 학력 +2
    expect(eff('free', 1)).toEqual({ education: 6, happiness: -3, wealth: -5 }); // 형편이 어려우면 학원비 부담 -2
    expect(eff('strict', 2)).toEqual({ education: 8, happiness: -3, wealth: -5 }); // 둘 다
  });

  it('resolveEffects: 보너스 조건은 효과 적용 전 상태로 판정한다 (보너스끼리 연쇄하지 않는다) / 플래그도 합친다', () => {
    const e = one(
      narrative({
        effects: { stats: { wealth: 5 }, setFlags: ['base_flag'] },
        bonuses: [
          { when: { stats: { wealth: { min: 60 } } }, effects: { stats: { happiness: 3 }, setFlags: ['rich_flag'] } },
          { when: { flags: ['rich_flag'] }, effects: { stats: { health: 3 } } },
        ],
      }),
    );
    const r = resolveEffects(e.effects, e.bonuses, ctx({ stats: { wealth: 60 } }));
    expect(r.stats).toEqual({ wealth: 5, happiness: 3 }); // 두 번째 보너스(rich_flag)는 아직 켜지지 않은 상태로 판정 → 적용 안 됨
    expect(r.setFlags.sort()).toEqual(['base_flag', 'rich_flag']);
    expect(resolveEffects(e.effects, e.bonuses, ctx({ stats: { wealth: 10 } })).stats).toEqual({ wealth: 5 });
  });

  it('createEventPool: 같은 id가 둘이면 throw, 조회 맵이 id로 찾아진다', () => {
    const a = one(narrative());
    expect(() => createEventPool([a, a])).toThrow(/id가 겹친다/);
    const pool = createEventPool([a]);
    expect(pool.byId.get('test-narrative')).toBe(a);
  });
});
