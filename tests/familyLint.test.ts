import { describe, expect, it } from 'vitest';
import {
  EventDataError,
  FAMILY_SYSTEM_FLAGS,
  isChoiceEvent,
  stateWordProblems,
  validateEventFiles,
  type EventDef,
} from '../src/core';
import { EVENT_FILES, EVENT_POOL } from '../src/data/events';

/**
 * 가족 낱말 ↔ 조건 점검 (SPEC-009 FA0-3 ④·K4, `docs/data/family-model.md` 6-3·13-2절)과 시스템 소유 플래그·`trigger` 검증.
 * 어린 시절(영유아·학창) 사건의 가족 낱말은 그 시점에 실제로 있는 사람과 맞는 조건(`requires`/`conditions`)을 가져야 한다 — 낱말 규칙은 `STATE_WORD_RULES`(eventLint.ts), 실제 판에서의 동적 확인은 tests/familyConsistency.test.ts.
 */

const textEv = (text: string, over: Partial<EventDef> = {}): EventDef =>
  ({ id: 'infant-zz-test', title: '시험 사건', text, stages: ['infant'], weight: 10, once: true, track: 'common', ...over }) as EventDef;

describe('낱말 → 조건: 규칙마다 어긴 사건은 잡히고, 조건을 달면 통과한다', () => {
  const cases: Array<[string, string, string[]]> = [
    // [낱말이 든 글, 이름, 통과시키는 조건 플래그(flags)]
    ['조부모님이 아이를 안아 주셨습니다.', '조부모', ['has_grandparent']],
    ['할머니가 노래를 불러 주셨습니다.', '조부모', ['has_grandparent']],
    ['동생이 장난감을 쥐었습니다.', '동생', ['has_younger_sibling']],
    ['형이 아이를 업어 주었습니다.', '형·누나', ['has_older_sibling']],
    ['누나가 책을 읽어 주었습니다.', '형·누나', ['has_older_sibling']],
    ['형제가 한 이불을 덮었습니다.', '형제', ['has_sibling']],
  ];
  for (const [text, name, flags] of cases) {
    it(`「${text}」: 조건이 없으면 ${name} 규칙에 걸리고, ${flags[0]}를 달면 통과한다`, () => {
      expect(stateWordProblems(textEv(text)).join('\n'), text).toContain(flags[0]);
      expect(stateWordProblems(textEv(text, { conditions: { flags } })), text).toEqual([]);
    });
  }

  it('형제 낱말은 손위·손아래 플래그 어느 쪽으로도 통과한다(어느 한쪽이 있으면 형제가 있다)', () => {
    const t = textEv('형제가 한 이불을 덮었습니다.');
    for (const f of ['has_sibling', 'has_older_sibling', 'has_younger_sibling']) expect(stateWordProblems({ ...t, conditions: { flags: [f] } })).toEqual([]);
  });

  it('아버지·어머니·부모님 낱말은 떠난 뒤에 나오지 않는 조건(notFlags)을 요구한다 — 부모님은 한 분이라도 떠난 판에 나오지 않는다', () => {
    const f = textEv('아버지가 아이를 안아 올렸습니다.');
    expect(stateWordProblems(f).join('\n')).toContain('father_gone');
    expect(stateWordProblems({ ...f, conditions: { notFlags: ['father_gone', 'parents_gone'] } })).toEqual([]);
    const m = textEv('엄마가 밤새 곁을 지켰습니다.');
    expect(stateWordProblems(m).join('\n')).toContain('mother_gone');
    expect(stateWordProblems({ ...m, conditions: { notFlags: ['mother_gone', 'parents_gone'] } })).toEqual([]);
    const both = textEv('부모님이 늦게 돌아오셨습니다.');
    expect(stateWordProblems(both).join('\n')).toContain('mother_gone');
    expect(stateWordProblems({ ...both, conditions: { notFlags: ['mother_gone', 'father_gone'] } }).join('\n'), 'parents_gone도 있어야 한다').toContain('parents_gone');
    expect(stateWordProblems({ ...both, conditions: { notFlags: ['mother_gone', 'father_gone', 'parents_gone'] } })).toEqual([]);
  });

  it('선택지의 글은 선택지 requires로 통과시킬 수 있다 (이벤트 조건이 아니라)', () => {
    const ev = textEv('아이가 하루를 보냈습니다.', {
      choices: [
        { id: 'a', label: '조부모님 곁에서 지낸다', result: '낮에는 조부모님 곁에서 지냈습니다.', requires: { flags: ['has_grandparent'] } },
        { id: 'b', label: '집에서 지낸다', result: '집에서 하루를 보냈습니다.' },
        { id: 'c', label: '이웃집에서 지낸다', result: '이웃집에서 하루를 보냈습니다.' },
      ],
    });
    expect(stateWordProblems(ev)).toEqual([]);
    const bad = { ...ev, choices: ev.choices!.map((c) => (c.id === 'a' ? { ...c, requires: undefined } : c)) };
    expect(stateWordProblems(bad).join('\n')).toContain('has_grandparent');
  });

  it('낱말이 아닌 글자는 걸리지 않는다: 인형·형편·형태·큰형님(합성)·조부모님의 「부모님」·학부모', () => {
    for (const t of ['인형이 곁에 있었습니다.', '형편이 어려웠던 시절입니다.', '모형 배를 만들었습니다.', '학부모 모임이 열렸습니다.']) {
      expect(stateWordProblems(textEv(t)), t).toEqual([]);
    }
    // 조부모님은 조부모 규칙만 본다(부모님 규칙의 notFlags를 요구하지 않는다)
    const r = stateWordProblems(textEv('조부모님이 오셨습니다.', { conditions: { flags: ['has_grandparent'] } }));
    expect(r).toEqual([]);
  });

  it('반려동물 낱말은 pet_* 플래그를 요구하되, 집 앞의 떠돌이 강아지 이야기(school-puppy)는 면제다 (K10: 입양 전)', () => {
    const t = textEv('강아지가 꼬리를 흔들었습니다.', { stages: ['school'] });
    expect(stateWordProblems(t).join('\n')).toContain('pet_dog');
    expect(stateWordProblems({ ...t, conditions: { flags: ['pet_dog'] } })).toEqual([]);
    expect(stateWordProblems({ ...t, id: 'school-puppy' })).toEqual([]);
  });

  it('어른 시점의 낱말은 이 규칙의 대상이 아니다(어른 시점 「부모님」은 FM7의 변형이 맡는다)', () => {
    expect(stateWordProblems(textEv('동생과 오랜만에 만났습니다.', { stages: ['youth'] }))).toEqual([]);
  });
});

describe('실제 이벤트 데이터 (13-2절 변경 목록)', () => {
  const ev = (id: string): EventDef => EVENT_POOL.byId.get(id)!;

  it('어린 시절 이벤트 전체에 낱말 ↔ 조건 위반이 없다 (check:events의 같은 점검)', () => {
    const kids = EVENT_POOL.events.filter((e) => e.stages.some((s) => s === 'infant' || s === 'school'));
    expect(kids.length).toBeGreaterThan(40);
    const problems = kids.flatMap((e) => stateWordProblems(e));
    expect(problems).toEqual([]);
  });

  it('infant-care·infant-daycare-wait: 조부모에게 맡기는 길은 has_grandparent가 있을 때만 보인다 (grandparent_close를 켜는 선택)', () => {
    for (const id of ['infant-care', 'infant-daycare-wait']) {
      const c = ev(id).choices!.find((x) => x.id === 'grandparents')!;
      expect(c.requires, id).toEqual({ flags: ['has_grandparent'] });
      expect(c.effects?.setFlags, id).toContain('grandparent_close');
    }
  });

  it('infant-grandparent-song은 has_grandparent도 요구하고, infant-sibling-toy는 동생이 태어난 다음 해부터(younger_sibling)·곁에 있는 동안(has_younger_sibling), infant-follow-sibling은 손위 형제가 있는 판이다', () => {
    expect(ev('infant-grandparent-song').conditions?.flags).toEqual(['grandparent_close', 'has_grandparent']);
    expect(ev('infant-sibling-toy').conditions?.flags).toEqual(['younger_sibling', 'has_younger_sibling']);
    expect(ev('infant-follow-sibling').conditions?.flags).toEqual(['has_older_sibling']);
    expect(ev('school-family-priority').conditions?.flags).toEqual(['has_sibling']);
  });

  it('「부모님」 낱말 사건(infant-care·infant-neglect-night·school-early-work)은 한 분이라도 떠난 판에 나오지 않고, school-teacher-notice의 의논 선택지(ask)도 그렇다', () => {
    const gone = ['mother_gone', 'father_gone', 'parents_gone'];
    for (const id of ['infant-care', 'infant-neglect-night', 'school-early-work']) for (const f of gone) expect(ev(id).conditions?.notFlags, `${id} ${f}`).toContain(f);
    const ask = ev('school-teacher-notice').choices!.find((c) => c.id === 'ask')!;
    expect(ask.requires?.notFlags).toEqual(gone);
    // 의논 선택지가 가려져도 두 선택지(accept·decline)가 남는다
    expect(ev('school-teacher-notice').choices!.filter((c) => c.requires === undefined).length).toBeGreaterThanOrEqual(2);
  });

  it('infant-new-sibling은 구성이 일으키는 사건이다: trigger family · once · 선택지 4개 중 grandma는 조부모가 계신 판에서만', () => {
    const e = ev('infant-new-sibling');
    expect(e.trigger).toBe('family');
    expect(e.once).toBe(true);
    expect(isChoiceEvent(e)).toBe(true);
    expect(e.choices!.map((c) => c.id)).toEqual(['help', 'sulk', 'grandma', 'notice']);
    expect(e.choices!.find((c) => c.id === 'grandma')!.requires).toEqual({ flags: ['grandparent_close', 'has_grandparent'] });
  });

  it('trigger 사건은 어떤 풀 후보에도 오르지 않는다: 일반 추첨에서 나올 수 있는 사건 가운데 trigger가 있는 것은 0', () => {
    const triggered = EVENT_POOL.events.filter((e) => e.trigger !== undefined).map((e) => e.id);
    expect(triggered).toEqual(['infant-new-sibling']);
  });
});

describe('시스템 소유 플래그: 이벤트는 읽을 수만 있고 쓸 수 없다 (6절)', () => {
  const file = (events: unknown[]): Record<string, unknown> => ({ 'x.json': { events, note: '시험' } });
  const ok = (over: Record<string, unknown> = {}): Record<string, unknown> => ({
    id: 'infant-zz-flag',
    title: '시험 사건',
    text: '아이가 하루를 조용히 보냈습니다. 별일 없이 지나갔습니다.',
    stages: ['infant'],
    track: 'common',
    weight: 10,
    once: true,
    ...over,
  });

  it('시스템 플래그를 setFlags·clearFlags로 쓰면 검증이 막는다 — 모든 시스템 플래그에 대해', () => {
    for (const flag of FAMILY_SYSTEM_FLAGS) {
      expect(() => validateEventFiles(file([ok({ effects: { setFlags: [flag] } })])), flag).toThrow(EventDataError);
      expect(() => validateEventFiles(file([ok({ effects: { clearFlags: [flag] } })])), `${flag} clear`).toThrow();
    }
  });

  it('읽는 것은 허용: 켜는 사건이 없어도 has_grandparent 같은 시스템 플래그를 조건에 쓸 수 있다 · 사건 소유 플래그(younger_sibling·pet_*)는 사건이 쓸 수 있다', () => {
    expect(() => validateEventFiles(file([ok({ conditions: { flags: ['has_grandparent'] } })]))).not.toThrow();
    expect(() => validateEventFiles(file([ok({ effects: { setFlags: ['younger_sibling'] } })]))).not.toThrow();
    expect(() => validateEventFiles(file([ok({ effects: { setFlags: ['pet_dog'] } })]))).not.toThrow();
    // 시스템 플래그가 아닌데 켜는 사건이 없는 플래그를 읽으면 여전히 막힌다(오타 방지)
    expect(() => validateEventFiles(file([ok({ conditions: { flags: ['has_grandparnt'] } })]))).toThrow(/켜는 이벤트가 어디에도 없다/);
  });

  it('실제 이벤트 데이터는 시스템 플래그를 한 번도 쓰지 않는다', () => {
    const sys = new Set(FAMILY_SYSTEM_FLAGS);
    for (const e of EVENT_POOL.events) {
      const text = JSON.stringify([e.effects, e.bonuses, ...(e.choices ?? []).flatMap((c) => [c.effects, c.bonuses])]);
      for (const f of sys) expect(text.includes(`"${f}"`), `${e.id} ${f}`).toBe(false);
    }
    void EVENT_FILES;
  });
});

describe('trigger 필드 검증', () => {
  const file = (events: unknown[]): Record<string, unknown> => ({ 'x.json': { events, note: '시험' } });
  const sibling = (over: Record<string, unknown> = {}): Record<string, unknown> => ({
    id: 'infant-zz-trig',
    title: '시험 사건',
    text: '아이가 하루를 조용히 보냈습니다. 별일 없이 지나갔습니다.',
    stages: ['infant'],
    track: 'common',
    ageRange: { min: 2, max: 5 },
    weight: 10,
    once: true,
    trigger: 'family',
    choices: [
      { id: 'a', label: '가만히 바라본다', result: '아이는 한참을 가만히 바라보았습니다. 그뿐이었습니다.' },
      { id: 'b', label: '곁으로 다가간다', result: '아이는 곁으로 다가가 앉았습니다. 말없이 한참을 있었습니다.' },
    ],
    ...over,
  });

  it('올바른 trigger 사건은 통과한다', () => {
    expect(() => validateEventFiles(file([sibling()]))).not.toThrow();
  });

  it('"family" 밖의 값 · once:false · 서술 사건 · ageRange 없음 · milestone과 함께는 막는다', () => {
    expect(() => validateEventFiles(file([sibling({ trigger: 'school' })]))).toThrow(/"family"만/);
    expect(() => validateEventFiles(file([sibling({ once: false, cooldown: 20 })]))).toThrow(/once:true/);
    expect(() => validateEventFiles(file([sibling({ choices: undefined, effects: { stats: { happiness: 1 } } })]))).toThrow(/선택지 이벤트/);
    expect(() => validateEventFiles(file([sibling({ ageRange: undefined })]))).toThrow(/ageRange/);
  });
});

describe('선택지 스키마 완화와 trigger 사건 (R-563): 가족 플래그로만 갈리는 선택지는 일반 추첨에서만 허용된다', () => {
  const file = (events: unknown[]): Record<string, unknown> => ({ 'x.json': { events, note: '시험' } });
  const A = { id: 'a', label: '가만히 바라본다', result: '아이는 한참을 가만히 바라보았습니다. 그뿐이었습니다.' };
  const B = { id: 'b', label: '곁으로 다가간다', result: '아이는 곁으로 다가가 앉았습니다. 말없이 한참을 있었습니다.' };
  const ev = (choices: unknown[], over: Record<string, unknown> = {}): Record<string, unknown> => ({
    id: 'infant-zz-schema',
    title: '시험 사건',
    text: '아이가 하루를 조용히 보냈습니다. 별일 없이 지나갔습니다.',
    stages: ['infant'],
    track: 'common',
    weight: 10,
    once: true,
    choices,
    ...over,
  });
  const trig = { ageRange: { min: 2, max: 5 }, trigger: 'family' };
  const familyOnly = { ...B, id: 'c', requires: { flags: ['has_grandparent'] } }; // 가족 플래그로만 갈리는 선택지
  const otherCond = { ...B, id: 'c', requires: { parentWealth: { min: 4 } } }; // 가족 플래그가 아닌 조건

  it('일반 사건: 조건 없음 1 + 가족 플래그 선택지 1은 통과한다 (그 가족이 없는 판에서는 isEventEligible이 후보에서 뺀다)', () => {
    expect(() => validateEventFiles(file([ev([A, familyOnly])]))).not.toThrow();
  });

  it('일반 사건: 조건 없음 1 + 다른 requires 1은 실패한다 (완화는 가족 시스템 플래그에만)', () => {
    expect(() => validateEventFiles(file([ev([A, otherCond])]))).toThrow(/조건\(requires\) 없는 선택지가 2개 이상/);
  });

  it('일반 사건: 조건 없음 0 + 가족 플래그 선택지 둘은 실패한다 (보이는 선택지가 0개일 수 있다)', () => {
    expect(() => validateEventFiles(file([ev([{ ...A, requires: { flags: ['has_grandparent'] } }, { ...familyOnly, id: 'b' }])]))).toThrow(/조건\(requires\) 없는 선택지가 2개 이상/);
  });

  it('일반 사건: 조건 없음 2는 통과한다 (완화 없이도)', () => {
    expect(() => validateEventFiles(file([ev([A, B])]))).not.toThrow();
  });

  it('trigger 사건: 조건 없음 1 + 가족 플래그 선택지 1은 실패한다 — 강제 슬롯은 isEventEligible을 거치지 않아 선택지 1개로 대기가 생긴다', () => {
    expect(() => validateEventFiles(file([ev([A, familyOnly], trig)]))).toThrow(/trigger 사건은 조건 없는 선택지가 2개 이상/);
  });

  it('trigger 사건: 조건 없음 1 + 다른 requires 1도 실패한다 (기존 메시지)', () => {
    expect(() => validateEventFiles(file([ev([A, otherCond], trig)]))).toThrow(/조건\(requires\) 없는 선택지가 2개 이상/);
  });

  it('trigger 사건: 조건 없음 2 + 가족 플래그 선택지(infant-new-sibling 모양)는 통과한다', () => {
    expect(() => validateEventFiles(file([ev([A, B, familyOnly], trig)]))).not.toThrow();
  });

  it('실제 trigger 사건(infant-new-sibling)은 조건 없는 선택지가 2개 이상이다', () => {
    const e = EVENT_POOL.byId.get('infant-new-sibling')!;
    expect(e.trigger).toBe('family');
    expect(e.choices!.filter((c) => c.requires === undefined).length).toBeGreaterThanOrEqual(2);
  });
});
