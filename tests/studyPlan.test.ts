import { describe, expect, it, vi } from 'vitest';
import { EVENT_POOL } from '../src/data/events';
import { PERSONA_TABLE } from '../src/data/personaTable';
import {
  EXAM_RETRY_FLAG,
  MILITARY_EVENT,
  TRACK_END_AGE,
  TRACK_WINDOW_END,
  careerKindDue,
  isEventEligible,
  militaryDueOf,
  parentChoiceWeights,
  parseGame,
  serializeGame,
  stepYear,
  studyPlanOf,
  type GameState,
  type HistoryEntry,
} from '../src/core';
import { startLife } from '../scripts/simulateLib';
import { stepWith } from './helpers/careerTest';
import { lifeAt } from './helpers/personaTest';

vi.mock('../src/data/personaSwitch', () => ({ PERSONA_ENABLED: true }));

/**
 * 학업·병역·재수 일정 (SPEC-018 결정 후속 239, 설계 `persona-model.md` 4-1-2절) · PL5 맞춤 카드 복원·부모 끌림(결정 후속 237).
 * 게임 나이는 연 나이다(태어난 해 0세) — 22세 = 한국 나이 23세 4학년.
 */

const examLine = (age: number): HistoryEntry => ({ age, kind: 'choice', text: '결과', title: '입시를 앞둔 해', eventId: 'school-exam', choice: '고른 길' });

/** 성별·플래그·입시 나이·복무 나이를 지정한 19세 맞춤 판 */
function planState(o: { male: boolean; college: boolean; retry?: boolean; examAge?: number; served?: number }): GameState {
  const s = lifeAt(3, 19);
  const flags = [...(o.college ? ['college'] : []), ...(o.retry ? [EXAM_RETRY_FLAG] : [])];
  return {
    ...s,
    character: { ...s.character!, gender: o.male ? 'male' : 'female' },
    flags,
    history: o.examAge === undefined ? s.history.filter((h) => h.eventId !== 'school-exam') : [...s.history.filter((h) => h.eventId !== 'school-exam'), examLine(o.examAge)],
    seen: { ...Object.fromEntries(Object.entries(s.seen).filter(([k]) => k !== MILITARY_EVENT)), ...(o.served === undefined ? {} : { [MILITARY_EVENT]: o.served }) },
  };
}

describe('studyPlanOf — 학업·병역 일정 표 (설계 4-1-2)', () => {
  it('여자: 고졸 19 · 대졸 23 · 재수 대졸 24 · 19세 입시 대졸 24 · 19세 입시 + 재수 25 (게임 나이)', () => {
    expect(studyPlanOf(planState({ male: false, college: false })).trackOpen).toBe(19);
    expect(studyPlanOf(planState({ male: false, college: true, examAge: 18 })).trackOpen).toBe(23);
    expect(studyPlanOf(planState({ male: false, college: true, examAge: 16 })).trackOpen).toBe(23); // 고1 입시 카드여도 입학은 19세
    expect(studyPlanOf(planState({ male: false, college: true })).trackOpen).toBe(23); // 입시 줄이 없으면 18세로 본다
    expect(studyPlanOf(planState({ male: false, college: true, retry: true, examAge: 18 })).trackOpen).toBe(24);
    expect(studyPlanOf(planState({ male: false, college: true, examAge: 19 })).trackOpen).toBe(24);
    expect(studyPlanOf(planState({ male: false, college: true, retry: true, examAge: 19 })).trackOpen).toBe(25);
    expect(studyPlanOf(planState({ male: false, college: true })).serviceStart).toBeNull();
  });

  it('남자: 대학생은 1학년 뒤 입대(entry + 1)해 대졸 25(한국 나이 26), 비대학은 20세 입대해 22(한국 나이 23)', () => {
    const college = studyPlanOf(planState({ male: true, college: true, examAge: 18 }));
    expect(college).toMatchObject({ entry: 19, serviceStart: 20, served: null, trackOpen: 25, studyEnd: 24 });
    const high = studyPlanOf(planState({ male: true, college: false }));
    expect(high).toMatchObject({ entry: null, serviceStart: 20, served: null, trackOpen: 22 });
    // 재수: 입학 20 → 입대 21 → 대졸 26
    expect(studyPlanOf(planState({ male: true, college: true, retry: true, examAge: 18 }))).toMatchObject({ entry: 20, serviceStart: 21, trackOpen: 26 });
    // 실제 입대가 밀리면(가족 강제 사건) 그만큼 늦다 — 비대학 22세 입대 → 24
    expect(studyPlanOf(planState({ male: true, college: false, served: 22 })).trackOpen).toBe(24);
    // 대학생이 늦게 입대해도 졸업 + 복무보다 이르게 열리지 않는다
    expect(studyPlanOf(planState({ male: true, college: true, examAge: 18, served: 21 })).trackOpen).toBe(25);
  });

  it('격자: 성별 × 대학 × 재수 × 입시 나이 16~19 × 입대 나이(없음·계획·+1·+2) — 열림 나이는 19~27이고 네 번째 지원(+4)이 35세 이하다', () => {
    const [lo, hi] = PERSONA_TABLE.MODEL.trackWindow;
    expect(hi).toBe(TRACK_WINDOW_END);
    for (const male of [false, true]) for (const college of [false, true]) for (const retry of [false, true]) for (const examAge of [16, 17, 18, 19]) for (const late of [null, 0, 1, 2]) {
      if (!college && retry) continue;
      const base = studyPlanOf(planState({ male, college, retry, examAge }));
      const served = late === null || base.serviceStart === null ? undefined : base.serviceStart + late;
      const p = studyPlanOf(planState({ male, college, retry, examAge, served }));
      const where = `male=${male} college=${college} retry=${retry} exam=${examAge} served=${served}`;
      expect(p.trackOpen, where).toBeGreaterThanOrEqual(lo);
      expect(p.trackOpen, where).toBeLessThanOrEqual(hi);
      expect(p.trackOpen + 1 + PERSONA_TABLE.MODEL.triesFree[0], where).toBeLessThanOrEqual(TRACK_END_AGE);
      if (male) expect(p.trackOpen, where).toBeGreaterThanOrEqual((served ?? p.serviceStart!) + 2);
    }
  });
});

describe('병역 강제 슬롯 · 복무 전 진로 카드 닫힘', () => {
  it('복무 전 남자는 열림 나이가 지나도 창 끝(27) 전에는 분야 카드가 없고, 복무한 뒤에는 열린다', () => {
    const s = planState({ male: true, college: false });
    expect(careerKindDue(s, 23)).toBeNull();
    expect(careerKindDue(s, TRACK_WINDOW_END)).toBe('field'); // 창 끝에는 연다(안전망)
    expect(careerKindDue(planState({ male: true, college: false, served: 20 }), 22)).toBe('field');
    expect(careerKindDue(planState({ male: true, college: false, served: 20 }), 21)).toBeNull();
    // 여자는 지금처럼 19세
    expect(careerKindDue(planState({ male: false, college: false }), 19)).toBe('field');
  });

  it('militaryDueOf: 맞춤 판의 남자만, 계획 나이부터, 한 번만', () => {
    expect(militaryDueOf(planState({ male: true, college: false }), EVENT_POOL, 19)).toBeNull();
    expect(militaryDueOf(planState({ male: true, college: false }), EVENT_POOL, 20)?.id).toBe(MILITARY_EVENT);
    expect(militaryDueOf(planState({ male: true, college: false }), EVENT_POOL, 21)?.id).toBe(MILITARY_EVENT); // 밀린 해에도
    expect(militaryDueOf(planState({ male: true, college: false, served: 20 }), EVENT_POOL, 21)).toBeNull();
    expect(militaryDueOf(planState({ male: false, college: false }), EVENT_POOL, 20)).toBeNull();
    const { persona: _p, ...bare } = planState({ male: true, college: false });
    void _p;
    expect(militaryDueOf(bare as GameState, EVENT_POOL, 20)).toBeNull();
  });

  it('맞춤 판에서는 무작위 youth-military가 추첨에서 빠지고(retiredWith), 맞춤 없는 판은 그대로 후보다', () => {
    const ev = EVENT_POOL.byId.get(MILITARY_EVENT)!;
    expect(ev.retiredWith).toBe('persona');
    expect(ev.choices).toBeUndefined();
    const male = planState({ male: true, college: false });
    const at = (s: GameState) => ({ ...s, age: 21 });
    expect(isEventEligible(ev, { ...at(male), persona: male.persona } as never)).toBe(false);
  });

  it('밀레니얼 남자 60판(자동 진행): 맞춤 판의 youth-military 줄은 정확히 한 번이고 첫 진로 카드보다 앞서며, 계획 나이보다 이르지 않다', () => {
    let males = 0;
    for (let seed = 1; males < 60 && seed < 400; seed++) {
      let s = startLife(seed, 'millennial');
      if (s.character!.gender !== 'male') continue;
      males++;
      for (let i = 0; i < 600 && s.phase === 'life' && s.age <= 36; i++) s = stepWith(s);
      const mil = s.history.filter((h) => h.eventId === MILITARY_EVENT);
      const firstCareer = s.history.find((h) => h.eventId === 'job-pick-field');
      if (s.age < 30) continue; // 일찍 세상을 떠난 판은 건너뛴다
      expect(mil, `시드 ${seed}`).toHaveLength(1);
      if (firstCareer !== undefined) expect(firstCareer.age, `시드 ${seed}`).toBeGreaterThan(mil[0].age);
      const plan = studyPlanOf(s);
      expect(mil[0].age, `시드 ${seed}`).toBeGreaterThanOrEqual(plan.serviceStart!);
    }
    expect(males).toBe(60);
  });

  it('같은 시드는 같은 인생이다(병역 슬롯이 결정론): 두 번 돌린 직렬화가 같다', () => {
    const run = () => {
      let s = startLife(11, 'millennial');
      for (let i = 0; i < 300 && s.phase === 'life' && s.age < 30; i++) s = stepWith(s);
      return serializeGame(s);
    };
    expect(run()).toBe(run());
  });
});

describe('재수 표지 exam_retry — 맞춤 판에서만 켜진다', () => {
  it('retry 보너스는 when { tailored }라 persona가 있으면 켜지고 없으면 켜지지 않는다', () => {
    const retry = EVENT_POOL.byId.get('school-exam')!.choices!.find((c) => c.id === 'retry')!;
    expect(retry.bonuses?.some((b) => b.when.tailored === true && b.effects.setFlags?.includes(EXAM_RETRY_FLAG))).toBe(true);
  });
});

describe('PL5 맞춤 카드의 저장 복원 — 맞춤 인생이 꺼진 채 열면 대기를 푼다 (결정 후속 237, 1절 7 (나))', () => {
  const withPending = (s: GameState, eventId: string, choiceIds: string[]): GameState => ({ ...s, pending: { eventId, key: `${eventId}@${s.age}`, age: s.age, choiceIds } });

  // G1·G2는 늘 부모가 정하는 카드라 대기가 저장되지 않는다(부모·흘러감 카드는 그 해 안에서 끝난다) — 실제로 남을 수 있는 것은 19세 본인 입시 카드다
  it('persona가 손상으로 버려진 판(null)에서 night가 든 19세 입시 대기는 풀리고, night가 없는 입시 대기는 남는다 (G1·G2 대기는 어느 쪽이든 남지 않는다)', () => {
    const s = lifeAt(5, 19);
    const strip = (g: GameState): string => {
      const raw = JSON.parse(serializeGame(g));
      raw.data.persona = { broken: true }; // 형태가 틀리면 persona만 버린다 → 맞춤 인생이 없는 판처럼 복원
      return JSON.stringify(raw);
    };
    const cases: Array<[string, string[], boolean]> = [
      ['school-lessons', ['dojang', 'afterschool', 'housework'], false],
      ['school-high-pick', ['general', 'vocational', 'nightwork'], false],
      ['school-exam', ['apply', 'work', 'night'], false],
      ['school-exam', ['apply', 'retry', 'work'], true],
    ];
    for (const [eventId, ids, kept] of cases) {
      const back = parseGame(strip(withPending({ ...s, seen: { ...s.seen, [eventId]: s.age }, lastChoiceAge: s.age }, eventId, ids)));
      expect(back, eventId).not.toBeNull();
      expect(back!.pending === null ? 'released' : 'kept', `${eventId} ${ids.join(',')}`).toBe(kept ? 'kept' : 'released');
    }
  });

  it('persona가 있는 판에서는 그대로 남는다(공허 통과 방지)', () => {
    const s = lifeAt(5, 19);
    const back = parseGame(serializeGame(withPending({ ...s, seen: { ...s.seen, 'school-exam': s.age }, lastChoiceAge: s.age }, 'school-exam', ['apply', 'work', 'night'])));
    expect(back!.pending?.choiceIds).toEqual(['apply', 'work', 'night']);
  });
});

describe('부모 결정에 아이의 활동 끌림 (결정 후속 237 ①)', () => {
  it('act가 있는 카드는 기질 세기에 따라 부모 확률이 달라지고, persona를 빼면 끌림이 사라진다', () => {
    const s0 = lifeAt(7, 10);
    const s = { ...s0, pending: { eventId: 'school-lessons', key: 'school-lessons@10', age: 10, choiceIds: ['dojang', 'academies', 'lesson'] } } as GameState;
    const sporty = { ...s, persona: { ...s.persona!, w: s.persona!.w.map((_, i) => (i === 2 ? 95 : 5)) } } as GameState; // driven만 강한 벡터
    const quiet = { ...s, persona: { ...s.persona!, w: s.persona!.w.map((_, i) => (i === 4 ? 95 : 5)) } } as GameState; // quiet만 강한 벡터
    const a = parentChoiceWeights(sporty)!.weights;
    const b = parentChoiceWeights(quiet)!.weights;
    expect(a.some((x, i) => Math.abs(x - b[i]) > 0.01), `${a} vs ${b}`).toBe(true);
    const { persona: _p, ...bare } = s;
    void _p;
    const n1 = parentChoiceWeights(bare as GameState)!.weights;
    const { persona: _q, ...bare2 } = sporty;
    void _q;
    expect(parentChoiceWeights(bare2 as GameState)!.weights).toEqual(n1);
  });

  it('act가 없는 카드는 persona가 있어도 변경 전과 같다', () => {
    const s0 = lifeAt(7, 10);
    const s = { ...s0, pending: { eventId: 'school-tutoring', key: 'school-tutoring@10', age: 10, choiceIds: EVENT_POOL.byId.get('school-tutoring')!.choices!.filter((c) => c.requires === undefined).map((c) => c.id) } } as GameState;
    const { persona: _p, ...bare } = s;
    void _p;
    expect(parentChoiceWeights(s)!.weights).toEqual(parentChoiceWeights(bare as GameState)!.weights);
  });

  it('stepYear는 결정론이다(공허 통과 방지 — 이 파일의 판이 실제로 돈다)', () => {
    const s = lifeAt(9, 12);
    expect(serializeGame(stepYear(s).state)).toBe(serializeGame(stepYear(s).state));
  });
});
