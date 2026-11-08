import { describe, expect, it } from 'vitest';
import {
  EventDataError,
  askPoolProblems,
  askProblems,
  condContextOf,
  createEventPool,
  flagsWritten,
  isEventEligible,
  lintEvent,
  lintEvents,
  textPartsOf,
  validateEventFiles,
  type EligibilityView,
  type EventDef,
} from '../src/core';
import { ASK_KINDS, ASK_WEIGHT_LADDER } from '../src/data/askTable';
import { startLife } from '../scripts/simulateLib';
import { askEvent } from './helpers/askEvents';

/**
 * 조르기 사건의 데이터 모양·lint·종류당 1장 (SPEC-011 AK2 — `docs/data/ask-model.md` 1-2·1-4·1-6절 L1~L7, 완료 기준 1·14·15의 코어 부분).
 * 실제 사건 9개는 AK7(데이터·문장)이라 아직 없다 — 합성 사건(`tests/helpers/askEvents.ts`)으로 시험한다. 문장 전수 판독은 reviewer 몫이다.
 */

const load = (events: unknown[]) => validateEventFiles({ 'ask.json': { events } });
const problemsOf = (events: unknown[]): string[] => {
  try {
    load(events);
    return [];
  } catch (e) {
    if (e instanceof EventDataError) return e.problems;
    throw e;
  }
};
const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

describe('AK2 데이터 모양 — 스키마 검증 (L1~L3: 빌드·로드 실패)', () => {
  it('합성 조르기 사건(장난감·예체능)은 통과한다 — 파생 필드 askPeers는 데이터에 없다', () => {
    expect(problemsOf([askEvent('ask-toy-x', 'toy'), askEvent('ask-lessons-x', 'lessons')])).toEqual([]);
    expect(load([askEvent('ask-toy-x', 'toy')])).toHaveLength(1);
  });

  it('데이터에 파생 필드 askPeers를 쓰면 알 수 없는 항목이다 (eras와 같은 방식 — 풀이 만든다)', () => {
    const ev = { ...clone(askEvent('ask-toy-x', 'toy')), askPeers: ['ask-toy-y'] };
    expect(problemsOf([ev]).join('\n')).toContain('알 수 없는 항목 "askPeers"');
  });

  it('종류가 모르는 값·객체가 아님·kind 없음·다른 키는 실패한다', () => {
    const base = clone(askEvent('ask-toy-x', 'toy'));
    expect(problemsOf([{ ...base, ask: { kind: 'game' } }]).join('\n')).toContain('종류');
    expect(problemsOf([{ ...base, ask: 'toy' }]).join('\n')).toContain('객체여야');
    expect(problemsOf([{ ...base, ask: {} }]).join('\n')).toContain('필수 항목 "kind"');
    expect(problemsOf([{ ...base, ask: { kind: 'toy', weight: 3 } }]).join('\n')).toContain('알 수 없는 항목 "weight"');
  });

  it('선택지는 정확히 beg·tantrum·endure 셋이고 이 순서다 — 순서 바뀜·빠짐·넷은 실패', () => {
    const ev = clone(askEvent('ask-toy-x', 'toy')) as unknown as { choices: unknown[] };
    const swap = { ...ev, choices: [ev.choices[1], ev.choices[0], ev.choices[2]] };
    const two = { ...ev, choices: [ev.choices[0], ev.choices[2]] };
    const four = { ...ev, choices: [...ev.choices, { id: 'other', label: '다른 것', result: '다른 길을 택했습니다.' }] };
    for (const bad of [swap, two, four]) expect(problemsOf([bad]).join('\n')).toContain('정확히 beg, tantrum, endure');
  });

  it('beg·tantrum에 effects·bonuses·parentLabel·parentResult가 있으면 실패한다 (갈래별 효과는 코드 표 한 곳 — AQ1)', () => {
    const fields: Record<string, unknown> = {
      effects: { stats: { happiness: 1 } },
      bonuses: [{ when: { parenting: ['free'] }, effects: { stats: { happiness: 1 } } }],
      parentLabel: '어른이 정했다',
      parentResult: '어른들이 그렇게 정했습니다.',
    };
    for (const id of ['beg', 'tantrum'] as const) {
      for (const [k, v] of Object.entries(fields)) {
        const text = problemsOf([askEvent('ask-toy-x', 'toy', {}, { [id]: { [k]: v } })]).join('\n');
        expect(text, `${id}.${k}`).toContain('갈래별 효과·문구는 데이터에 쓰지 않는다');
      }
    }
  });

  it('거절 문장: beg·tantrum은 askDenied 필수, tantrum만 askStrained 필수·beg는 쓰지 않는다, endure는 둘 다 쓰지 않고 effects가 있어야 한다', () => {
    expect(problemsOf([askEvent('ask-toy-x', 'toy', {}, { beg: { askDenied: undefined } })]).join('\n')).toContain('askDenied가 필요');
    expect(problemsOf([askEvent('ask-toy-x', 'toy', {}, { tantrum: { askDenied: undefined } })]).join('\n')).toContain('askDenied가 필요');
    expect(problemsOf([askEvent('ask-toy-x', 'toy', {}, { tantrum: { askStrained: undefined } })]).join('\n')).toContain('askStrained가 필요');
    expect(problemsOf([askEvent('ask-toy-x', 'toy', {}, { beg: { askStrained: '졸랐지만 서먹해졌습니다.' } })]).join('\n')).toContain('조른다(beg)는 사이가 나빠지지 않아');
    expect(problemsOf([askEvent('ask-toy-x', 'toy', {}, { endure: { askDenied: '참았지만 거절당했습니다.' } })]).join('\n')).toContain('확정 결과라 거절 문장이 없다');
    expect(problemsOf([askEvent('ask-toy-x', 'toy', {}, { endure: { effects: undefined } })]).join('\n')).toContain('effects가 있어야');
  });

  it('세 선택지는 항상 보인다 — requires가 있으면 실패한다', () => {
    for (const id of ['beg', 'tantrum', 'endure'] as const) {
      expect(problemsOf([askEvent('ask-toy-x', 'toy', {}, { [id]: { requires: { parentWealth: { min: 3 } } } })]).join('\n'), id).toContain('항상 보인다');
    }
  });

  it('once:true · track common · stages [infant, school] · heavy·milestone·trigger 없음', () => {
    expect(problemsOf([askEvent('ask-toy-x', 'toy', { once: false, cooldown: 15 })]).join('\n')).toContain('once:true');
    expect(problemsOf([askEvent('ask-toy-x', 'toy', { track: 'standard' })]).join('\n')).toContain('track이 "common"');
    expect(problemsOf([askEvent('ask-toy-x', 'toy', { heavy: { kind: 'home' } })]).join('\n')).toContain('heavy');
    expect(problemsOf([askEvent('ask-toy-x', 'toy', { stages: ['school'] })]).join('\n')).toContain('stages');
    expect(problemsOf([askEvent('ask-toy-x', 'toy', { stages: ['infant', 'school', 'youth'] })]).join('\n')).toContain('stages');
  });

  it('나이 범위: min·max 모두 있어야 하고 종류 한계 안이다 — toy 4~12 · lessons·pet 5~12', () => {
    const at = (kind: 'toy' | 'lessons' | 'pet', min?: number, max?: number): string =>
      problemsOf([askEvent('ask-x', kind, { ageRange: { ...(min === undefined ? {} : { min }), ...(max === undefined ? {} : { max }) } as { min: number; max: number } })]).join('\n');
    expect(at('toy', 4, 12)).not.toContain('나이 범위');
    expect(at('lessons', 5, 12)).not.toContain('나이 범위');
    expect(at('toy', 3, 12)).toContain('4~12세 안');
    expect(at('toy', 4, 13)).toContain('4~12세 안');
    expect(at('lessons', 4, 12)).toContain('5~12세 안');
    expect(at('toy', 6, undefined)).toContain('min과 max가 모두');
    expect(problemsOf([askEvent('ask-toy-x', 'toy', { ageRange: undefined })]).join('\n')).toContain('min과 max가 모두');
  });

  it('ask 없이 askDenied·askStrained를 쓰면 실패한다 (조르기 사건의 선택지에서만)', () => {
    const plain = {
      id: 'plain-card',
      title: '그냥 카드',
      text: '평범한 선택 카드의 상황입니다. 어느 쪽이든 괜찮습니다.',
      stages: ['school'],
      track: 'common',
      weight: 10,
      once: true,
      noCitation: 'D',
      choices: [
        { id: 'a', label: '가다', result: '그쪽으로 갔습니다.', askDenied: '거절당했습니다.' },
        { id: 'b', label: '서다', result: '그 자리에 섰습니다.' },
      ],
    };
    expect(problemsOf([plain]).join('\n')).toContain('ask 사건(ask 필드가 있는 사건)의 선택지에서만');
  });

  it('flagsWritten: 조르기 사건은 코드 표가 켜는 플래그(들어줌·사이 나빠짐)를 함께 센다 — 읽는 플래그 교차 검증이 놓치지 않게', () => {
    expect([...flagsWritten(askEvent('ask-toy-x', 'toy')).set].sort()).toEqual(['parent_strained']);
    expect([...flagsWritten(askEvent('ask-pet-x', 'pet')).set].sort()).toEqual(['parent_strained', 'pet_dog']);
    expect([...flagsWritten(askEvent('ask-lessons-x', 'lessons')).set]).toEqual(['parent_strained']);
  });
});

describe('AK2 lint — askProblems·askPoolProblems (L2~L7)', () => {
  it('합성 사건은 기존 문구 규칙(lintEvent)까지 통과한다 (장난감·예체능·강아지 — 강아지는 L7 예외 id 사용)', () => {
    expect(lintEvent(askEvent('ask-toy-x', 'toy'))).toEqual([]);
    expect(lintEvent(askEvent('ask-lessons-x', 'lessons'))).toEqual([]);
    const pet = askEvent('ask-pet-a', 'pet', { text: '길에서 만난 강아지를 집에 데려오고 싶었습니다.' });
    expect(lintEvent(pet)).toEqual([]);
  });

  it('L2 endure.effects가 코드 표 ASK_EFFECTS.endure와 다르면 실패한다 (행복 값·다른 스탯·돈·플래그·보너스)', () => {
    const wrong: Array<Record<string, unknown>> = [
      { effects: { stats: { happiness: -2 } } },
      { effects: { stats: { happiness: -1, health: 1 } } },
      { effects: { stats: { happiness: -1 }, family: -100 } },
      { effects: { stats: { happiness: -1 }, setFlags: ['x'] } },
      { effects: { stats: { relationships: -1 } } },
    ];
    for (const w of wrong) expect(askProblems(askEvent('ask-toy-x', 'toy', {}, { endure: w })).join('\n'), JSON.stringify(w)).toContain('endure 행');
    expect(askProblems(askEvent('ask-toy-x', 'toy', {}, { endure: { bonuses: [{ when: { parenting: ['free'] }, effects: { stats: { happiness: 1 } } }] } })).join('\n')).toContain('보너스·requires 없는');
    // 같은 값이면 키 순서가 달라도 통과한다
    expect(askProblems(askEvent('ask-toy-x', 'toy', {}, { endure: { effects: { stats: { happiness: -1 } } } }))).toEqual([]);
  });

  it('L3 가중이 사다리 안이어야 한다 — toy·lessons 25~70 · pet 15~45 (승인 값 45·40·30은 안이다)', () => {
    for (const k of ASK_KINDS) {
      const { min, max } = ASK_WEIGHT_LADDER[k];
      const make = (w: number) => askEvent(k === 'pet' ? 'ask-pet-a' : `ask-${k}-x`, k, { weight: w });
      expect(askProblems(make(min)), `${k} ${min}`).toEqual([]);
      expect(askProblems(make(max)), `${k} ${max}`).toEqual([]);
      expect(askProblems(make(min - 1)).join('\n'), `${k} ${min - 1}`).toContain('사다리');
      expect(askProblems(make(max + 1)).join('\n'), `${k} ${max + 1}`).toContain('사다리');
    }
    expect(ASK_WEIGHT_LADDER.toy).toEqual({ min: 25, max: 70 });
    expect(ASK_WEIGHT_LADDER.pet).toEqual({ min: 15, max: 45 });
  });

  it('L3 같은 종류의 조르기 사건 yearRange가 겹치면 풀 점검이 실패한다 (다른 종류·겹치지 않는 구간·ask 아닌 사건은 통과)', () => {
    const a = askEvent('ask-toy-a', 'toy', { yearRange: { to: 1979 } });
    const b = askEvent('ask-toy-b', 'toy', { yearRange: { from: 1980, to: 2000 } });
    const c = askEvent('ask-toy-c', 'toy', { yearRange: { from: 2001 } });
    expect(askPoolProblems([a, b, c])).toEqual([]);
    expect(askPoolProblems([a, b, askEvent('ask-toy-d', 'toy', { yearRange: { from: 2000 } })]).join('\n')).toContain('ask-toy-b·ask-toy-d');
    expect(askPoolProblems([a, askEvent('ask-toy-z', 'toy')]).join('\n')).toContain('yearRange가 겹친다'); // yearRange가 없으면 모든 연도 — 반드시 겹친다
    expect(askPoolProblems([askEvent('ask-toy-q', 'toy'), askEvent('ask-lessons-q', 'lessons')])).toEqual([]);
    expect(lintEvents([a, askEvent('ask-toy-z', 'toy')]).join('\n')).toContain('yearRange가 겹친다'); // 풀 점검에 이어진다
  });

  it('L4 noCitation은 D 하나다 (X1~X6은 이 사건에 맞지 않는다) — citation과 함께 쓰는 것은 기존 스키마 규칙이 막는다', () => {
    expect(askProblems(askEvent('ask-toy-x', 'toy', { noCitation: 'X4' }))[0]).toContain("noCitation은 'D' 하나");
    expect(askProblems(askEvent('ask-toy-x', 'toy', { noCitation: 'D' }))).toEqual([]);
    expect(problemsOf([askEvent('ask-toy-x', 'toy', { citation: 'c-006' })]).join('\n')).toContain('함께 쓸 수 없다');
  });

  it('L5 조르기 사건의 모든 글(제목·본문·라벨·결과·askDenied·askStrained)에 가족 낱말이 없다', () => {
    const words = ['부모님', '부모', '엄마', '아빠', '어머니', '아버지', '동생', '조부모', '할머니', '할아버지', '형제', '남매', '형이', '누나가', '언니와', '오빠는'];
    const places: Array<{ where: string; apply: (w: string) => EventDef }> = [
      { where: 'title', apply: (w) => askEvent('ask-toy-x', 'toy', { title: `${w} 이야기` }) },
      { where: 'text', apply: (w) => askEvent('ask-toy-x', 'toy', { text: `${w} 곁에서 갖고 싶은 물건을 바라보았습니다.` }) },
      { where: 'label', apply: (w) => askEvent('ask-toy-x', 'toy', {}, { beg: { label: `${w}께 조른다` } }) },
      { where: 'result', apply: (w) => askEvent('ask-toy-x', 'toy', {}, { beg: { result: `${w}가 사 주었습니다.` } }) },
      { where: 'askDenied', apply: (w) => askEvent('ask-toy-x', 'toy', {}, { beg: { askDenied: `${w}와 돌아섰습니다.` } }) },
      { where: 'askStrained', apply: (w) => askEvent('ask-toy-x', 'toy', {}, { tantrum: { askStrained: `${w}와 서먹해졌습니다.` } }) },
    ];
    for (const { where, apply } of places) {
      for (const w of words) expect(askProblems(apply(w)).join('\n'), `${where} ${w}`).toContain('가족 낱말');
    }
    // 「인형」·「형편」은 가족 낱말이 아니다 (형편은 L6이 따로 막는다)
    expect(askProblems(askEvent('ask-toy-x', 'toy', { text: '인형 가게 앞에서 오래 바라보았습니다.' }))).toEqual([]);
  });

  it('L5 어른은 「어른」·「집안 어른」 또는 주어 생략으로 쓴다 — 그 표현은 통과한다', () => {
    expect(askProblems(askEvent('ask-toy-x', 'toy', {}, { beg: { askDenied: '집안 어른은 고개를 저었고 그대로 돌아섰습니다.', result: '어른이 말없이 사 주었습니다.' } }))).toEqual([]);
  });

  it('L6 거절 문장(askDenied·askStrained)에 원인 단정·평가어·설교가 없다 — 형편·가난·돈이 없·여유·비싸·「~해서」·「~때문」', () => {
    const words = ['형편이 어려워', '가난하다', '돈이 없어', '돈이 부족하여', '여유가 없어', '너무 비싸', '비싼 물건이라', '때문에', '돌아가야 해서', '버릇이 나빠', '철없는 일이라', '잘못이라', '참아야 합니다'];
    for (const w of words) {
      expect(askProblems(askEvent('ask-toy-x', 'toy', {}, { beg: { askDenied: `${w} 돌아섰습니다.` } })).join('\n'), `askDenied ${w}`).toContain('원인 단정');
      expect(askProblems(askEvent('ask-toy-x', 'toy', {}, { tantrum: { askStrained: `${w} 돌아섰습니다.` } })).join('\n'), `askStrained ${w}`).toContain('원인 단정');
    }
    // 이유를 말하지 않는 거절은 통과한다. 들어줌·참음(result)에는 L6이 닿지 않는다
    expect(askProblems(askEvent('ask-toy-x', 'toy'))).toEqual([]);
    expect(askProblems(askEvent('ask-toy-x', 'toy', {}, { beg: { result: '여유가 생겨 사 주었습니다.' } }))).toEqual([]);
  });

  it('L7 반려동물 조르기 사건은 notFlags에 pet_dog·pet_cat·pet_other가 모두 있어야 한다', () => {
    expect(askProblems(askEvent('ask-pet-a', 'pet'))).toEqual([]);
    for (const drop of ['pet_dog', 'pet_cat', 'pet_other']) {
      const flags = ['pet_dog', 'pet_cat', 'pet_other'].filter((f) => f !== drop);
      expect(askProblems(askEvent('ask-pet-a', 'pet', { conditions: { notFlags: flags } })).join('\n'), drop).toContain(`빠진 것 ${drop}`);
    }
    expect(askProblems(askEvent('ask-pet-a', 'pet', { conditions: undefined })).join('\n')).toContain('빠진 것');
    // 장난감·예체능에는 이 조건이 필요 없다
    expect(askProblems(askEvent('ask-toy-x', 'toy'))).toEqual([]);
  });

  it('L7 「강아지」는 반려동물 상태 어휘 규칙의 예외 id(ask-pet-a·b)에서만 조건 없이 쓸 수 있다 — 입양 전 이야기라 school-puppy와 같은 이유', () => {
    const text = '길에서 만난 강아지를 집에 데려오고 싶었습니다.';
    expect(lintEvent(askEvent('ask-pet-a', 'pet', { text }))).toEqual([]);
    expect(lintEvent(askEvent('ask-pet-b', 'pet', { text }))).toEqual([]);
    expect(lintEvent(askEvent('ask-pet-z', 'pet', { text })).join('\n')).toContain('반려동물(함께 사는 판에서만)');
  });

  it('L8 기존 규칙이 거절 문장에도 닿는다 — 길이·느낌표·이모지·합쇼체·연도·수저 이름이 askDenied·askStrained에서 걸린다 (textPartsOf가 두 필드를 낸다)', () => {
    const parts = textPartsOf(askEvent('ask-toy-x', 'toy')).map((p) => p.where);
    expect(parts).toContain('ask-toy-x.choices[0](beg).askDenied');
    expect(parts).toContain('ask-toy-x.choices[1](tantrum).askDenied');
    expect(parts).toContain('ask-toy-x.choices[1](tantrum).askStrained');
    const bad = (choiceOver: Record<string, unknown>) => lintEvent(askEvent('ask-toy-x', 'toy', {}, choiceOver)).join('\n');
    expect(bad({ beg: { askDenied: '졸랐지만 돌아섰습니다!' } })).toContain('느낌표');
    expect(bad({ tantrum: { askStrained: '울며 버텼지만 돌아섰습니다. 😀' } })).toContain('이모지');
    expect(bad({ beg: { askDenied: '졸랐지만 돌아섰다.' } })).toContain('합쇼체');
    expect(bad({ beg: { askDenied: `${'아주 오랫동안 졸랐지만 끝내 돌아섰습니다. '.repeat(4)}` } })).toContain('권장 최대');
  });

  it('조르기가 아닌 사건에는 askProblems가 닿지 않는다', () => {
    const { ask: _ask, ...plain } = askEvent('ask-toy-x', 'toy') as EventDef & { ask?: unknown };
    void _ask;
    expect(askProblems(plain as unknown as EventDef)).toEqual([]);
  });
});

describe('AK2 종류당 1장 — createEventPool의 askPeers 파생 필드 + isEventEligible (결정 AQ2, 이벤트 풀 공개 인터페이스 변경)', () => {
  const a = askEvent('ask-toy-a', 'toy', { yearRange: { to: 2000 } });
  const c = askEvent('ask-toy-c', 'toy', { yearRange: { from: 2001 } });
  const l = askEvent('ask-lessons-b', 'lessons', { yearRange: { from: 2001, to: 2025 } });
  const p1 = askEvent('ask-pet-a', 'pet', { yearRange: { to: 2000 } });
  const p2 = askEvent('ask-pet-b', 'pet', { yearRange: { from: 2001 } });
  const plain: EventDef = { id: 'plain-card', title: '평범한 카드', text: '평범한 선택 카드의 상황입니다. 어느 쪽이든 괜찮습니다.', stages: ['school'], weight: 10, once: true, choices: [{ id: 'a', label: '가다', result: '그쪽으로 갔습니다.' }, { id: 'b', label: '서다', result: '그 자리에 섰습니다.' }] };
  const pool = createEventPool([a, c, l, p1, p2, plain]);

  it('askPeers = 같은 종류의 다른 조르기 사건 id (자기 제외, 입력 순서) — 종류가 하나뿐이면 빈 배열, ask가 없는 사건은 필드가 없다', () => {
    expect(pool.byId.get('ask-toy-a')!.askPeers).toEqual(['ask-toy-c']);
    expect(pool.byId.get('ask-toy-c')!.askPeers).toEqual(['ask-toy-a']);
    expect(pool.byId.get('ask-lessons-b')!.askPeers).toEqual([]);
    expect(pool.byId.get('ask-pet-a')!.askPeers).toEqual(['ask-pet-b']);
    expect(pool.byId.get('ask-pet-b')!.askPeers).toEqual(['ask-pet-a']);
    expect('askPeers' in pool.byId.get('plain-card')!).toBe(false);
    // 종류가 다른 사건은 서로의 peers가 아니다
    for (const id of ['ask-toy-a', 'ask-toy-c']) expect(pool.byId.get(id)!.askPeers).not.toContain('ask-lessons-b');
  });

  it('입력 객체는 건드리지 않는다 (eras와 같은 방식) — ask가 없는 사건은 같은 객체 그대로다', () => {
    expect('askPeers' in a).toBe(false);
    expect(pool.byId.get('plain-card')).toBe(plain);
  });

  const viewOf = (age: number, seen: Record<string, number>): EligibilityView => {
    const s = startLife(1, 'alpha');
    // 2000년과 2001년을 가르는 출생 연도: 출생 연도 + 나이 = 달력 연도
    return { ...condContextOf({ ...s, age }), age, year: s.character!.birthYear + age, seen };
  };
  const view = (year: number, age: number, seen: Record<string, number>): EligibilityView => ({ ...viewOf(age, seen), year });

  it('같은 종류의 다른 사건을 이미 본 판에서는 후보가 아니다 — 시대 경계(2000/2001)를 넘는 판에서도 한 종류 최대 1장', () => {
    // 아직 아무것도 못 봤으면 구간이 맞는 사건이 후보다
    expect(isEventEligible(pool.byId.get('ask-toy-a')!, view(2000, 6, {}))).toBe(true);
    expect(isEventEligible(pool.byId.get('ask-toy-c')!, view(2001, 7, {}))).toBe(true);
    // 2000년에 ask-toy-a를 본 판은 2001년에 ask-toy-c가 구간에 맞아도 후보가 아니다
    expect(isEventEligible(pool.byId.get('ask-toy-c')!, view(2001, 7, { 'ask-toy-a': 6 }))).toBe(false);
    expect(isEventEligible(pool.byId.get('ask-toy-a')!, view(2000, 6, { 'ask-toy-c': 5 }))).toBe(false);
    // once라 본 자기 자신도 후보가 아니다
    expect(isEventEligible(pool.byId.get('ask-toy-a')!, view(2000, 8, { 'ask-toy-a': 6 }))).toBe(false);
    // 다른 종류를 본 것은 막지 않는다 (판당 최대 3장 — 종류 셋)
    expect(isEventEligible(pool.byId.get('ask-lessons-b')!, view(2005, 8, { 'ask-toy-a': 6, 'ask-pet-a': 7 }))).toBe(true);
    expect(isEventEligible(pool.byId.get('ask-pet-b')!, view(2005, 8, { 'ask-toy-c': 6 }))).toBe(true);
  });

  it('askPeers가 없는 사건(풀을 거치지 않은 합성 사건)에는 이 제한이 없다 — 기존 사건의 후보 규칙은 그대로다', () => {
    expect(isEventEligible(plain, view(2005, 8, { 'ask-toy-a': 6 }))).toBe(true);
    expect(isEventEligible(a, view(2000, 6, { 'ask-toy-c': 5 }))).toBe(true); // 풀을 거치지 않아 askPeers가 없다
  });

});
