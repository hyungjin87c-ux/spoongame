import { describe, expect, it } from 'vitest';
import {
  GAME_KEY,
  SCHEMA_VERSION,
  advanceUntilDecision,
  createEventPool,
  createInitialState,
  hasHiddenControl,
  loadGame,
  parseGame,
  playToEnd,
  resolveChoice,
  saveGame,
  serializeGame,
  type EventPool,
  type GameState,
  type StorageLike,
} from '../src/core';
import { EVENT_POOL } from '../src/data/events';
import { HISTORY_LIMITS } from '../src/data/lifeTable';
import { startLife } from '../scripts/simulateLib';

/**
 * M3 저장 검증: 스탯 0~100 정수(R-024), 인생 진행 필드(대기 선택지·플래그·본 이벤트·사망)의 정합성(R-008 잔여).
 * 손상된 저장이 인생 화면을 죽이지 않고 새 게임으로 시작하는지 본다. (기존 형태·정합성 케이스는 tests/storage.test.ts)
 */

function memoryStorage(): StorageLike & { map: Map<string, string> } {
  const map = new Map<string, string>();
  return { map, getItem: (k) => map.get(k) ?? null, setItem: (k, v) => void map.set(k, v), removeItem: (k) => void map.delete(k) };
}

/** 선택지 이벤트에서 멈춘 유효한 life 상태 (minChoices개 이상의 선택지가 보이는 것) */
function pendingLife(minChoices = 2): GameState {
  for (let seed = 1; seed < 3000; seed++) {
    const s = advanceUntilDecision(startLife(seed, 'present')).state;
    if (s.phase === 'life' && s.pending && s.pending.choiceIds.length >= minChoices) return s;
  }
  throw new Error('선택지가 있는 시드를 찾지 못했다');
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Doc = Record<string, any>;
const clone = (s: GameState): Doc => JSON.parse(JSON.stringify(s));
const raw = (d: Doc): string => JSON.stringify({ version: SCHEMA_VERSION, data: d });
const load = (text: string, pool?: EventPool): GameState | null => {
  const st = memoryStorage();
  st.map.set(GAME_KEY, text);
  return loadGame(st, pool);
};

const ok = pendingLife();
const okThree = pendingLife(3);
const ended = playToEnd(startLife(5, 'present')).state;
const evId = ok.pending!.eventId;
/** 인생 중간(대기 없음)의 유효한 상태: 스탯·연표 변조용 */
const midDecision = advanceUntilDecision(startLife(2, 'present')).state;
const mid: GameState = midDecision.pending ? resolveChoice(midDecision, midDecision.pending.key, midDecision.pending.choiceIds[0]) : midDecision;

describe('스탯은 0~100의 정수여야 한다 (R-024)', () => {
  const stat = (patch: (d: Doc) => void): string => {
    const d = clone(mid);
    patch(d);
    return raw(d);
  };
  const cases: Record<string, string> = {
    'wealth 키(옛 v7 모양) → 손상': stat((d) => (d.stats.wealth = 50)),
    'education -1': stat((d) => (d.stats.education = -1)),
    'health 100.5': stat((d) => (d.stats.health = 100.5)),
    'happiness 50.5(소수)': stat((d) => (d.stats.happiness = 50.5)),
    'relationships 1000': stat((d) => (d.stats.relationships = 1000)),
    'birthStats wealth 키(옛 v7 모양) → 손상': stat((d) => (d.birthStats.wealth = 45)),
    'birthStats happiness 101': stat((d) => (d.birthStats.happiness = 101)),
    'birthStats education -3': stat((d) => (d.birthStats.education = -3)),
    'birthStats health 70.2(소수)': stat((d) => (d.birthStats.health = 70.2)),
  };
  for (const [name, text] of Object.entries(cases)) {
    it(`${name} → 새 게임(null)`, () => expect(load(text)).toBeNull());
  }

  it('기준: 변조하지 않은 상태는 통과한다', () => expect(load(raw(clone(mid)))).not.toBeNull());

  it('경계값 0과 100은 통과한다 (모든 스탯 0 / 모든 스탯 100)', () => {
    for (const v of [0, 100]) {
      const text = stat((d) => {
        for (const k of Object.keys(d.stats)) d.stats[k] = v;
        for (const k of Object.keys(d.birthStats)) d.birthStats[k] = v;
      });
      expect(load(text), `모든 스탯 ${v}`).not.toBeNull();
    }
  });
});

describe('인생 진행 필드의 정합성: 손상된 저장이 인생 화면을 죽이지 않는다', () => {
  it('유효한 대기 중 선택지(2개·3개)·사망·출생 직후 상태는 왕복해도 같다', () => {
    for (const s of [ok, okThree, ended, startLife(1, 'past'), startLife(1, 'future'), mid]) expect(parseGame(serializeGame(s))).toEqual(s);
    expect(okThree.pending!.choiceIds).toHaveLength(3);
    expect(ended.phase).toBe('ending');
    expect(ended.death).not.toBeNull();
  });

  const d = (base: GameState, patch: (x: Doc) => void): string => {
    const x = clone(base);
    patch(x);
    return raw(x);
  };
  const bad: Record<string, string> = {
    // 대기 중인 선택지
    // (이벤트가 풀에서 사라졌거나 바뀐 대기 — 없는 이벤트 id·서술 이벤트 id·이벤트에 없는 선택지 id — 는 아래 "콘텐츠 갱신" 블록: 저장 전체를 버리지 않고 대기만 푼다, R-046)
    'pending: key가 이벤트@나이와 다름': d(ok, (x) => (x.pending.key = `${evId}@${x.age + 1}`)),
    'pending: key 형식 이상': d(ok, (x) => (x.pending.key = 'abc')),
    'pending: age가 현재 나이와 다름': d(ok, (x) => (x.pending.age = x.age - 1)),
    'pending: 선택지 1개': d(ok, (x) => (x.pending.choiceIds = [x.pending.choiceIds[0]])),
    'pending: 선택지 0개': d(ok, (x) => (x.pending.choiceIds = [])),
    'pending: 선택지 4개': d(ok, (x) => (x.pending.choiceIds = ['a', 'b', 'c', 'd'])),
    'pending: 선택지 id 중복': d(ok, (x) => (x.pending.choiceIds = [x.pending.choiceIds[0], x.pending.choiceIds[0]])),
    'pending: 선택지 id가 문자열이 아님': d(ok, (x) => (x.pending.choiceIds = [1, 2])),
    'pending: choiceIds가 배열이 아님': d(ok, (x) => (x.pending.choiceIds = 'ab')),
    'pending: seen에 이 이벤트가 이 나이로 기록돼 있지 않음': d(ok, (x) => (x.seen[evId] = x.age - 1)),
    'pending: 객체가 아님': d(ok, (x) => (x.pending = 'x')),
    'pending: ending에 남아 있음': d(ended, (x) => (x.pending = clone(ok).pending)),
    'pending: 출생 화면에 있음': d(ok, (x) => {
      x.phase = 'birth';
      x.age = 0;
      x.history = [];
      x.flags = [];
      x.seen = {};
      x.lastChoiceAge = null;
    }),
    // 사망 정보
    'death: life인데 death가 있음': d(mid, (x) => (x.death = { age: x.age, cause: '노환' })),
    'death: ending인데 death가 null': d(ended, (x) => (x.death = null)),
    'death: age가 현재 나이와 다름': d(ended, (x) => (x.death.age = x.age - 1)),
    'death: 원인이 빈 문자열': d(ended, (x) => (x.death.cause = '')),
    'death: 원인이 너무 김': d(ended, (x) => (x.death.cause = '가'.repeat(41))),
    'death: 원인이 숫자': d(ended, (x) => (x.death.cause = 3)),
    'death: age가 소수': d(ended, (x) => (x.death.age = 70.5)),
    // 나이 상한(시대별)
    '지금 세상 106세(상한 105 초과)': d(ended, (x) => {
      x.age = 106;
      x.death.age = 106;
    }),
    '지난 세상 101세(상한 100 초과)': d(ended, (x) => {
      x.era = 'past';
      x.character.birthYear = 1960;
      x.age = 101;
      x.death.age = 101;
    }),
    '나이 111세(어느 시대도 초과)': d(ended, (x) => {
      x.era = 'future';
      x.character.birthYear = 2040;
      x.age = 111;
      x.death.age = 111;
    }),
    // 플래그
    'flags: 배열이 아님': d(mid, (x) => (x.flags = {})),
    'flags: 대문자 플래그': d(mid, (x) => (x.flags = ['Has_Job'])),
    'flags: 숫자 플래그': d(mid, (x) => (x.flags = [1])),
    'flags: 중복': d(mid, (x) => (x.flags = ['a_flag', 'a_flag'])),
    'flags: 너무 긴 이름': d(mid, (x) => (x.flags = ['a'.repeat(41)])),
    'flags: 201개': d(mid, (x) => (x.flags = Array.from({ length: 201 }, (_, i) => `flag_${i}`))),
    // 본 이벤트
    'seen: 배열': d(mid, (x) => (x.seen = [])),
    'seen: 나이가 현재 나이보다 큼': d(mid, (x) => (x.seen['x-event'] = x.age + 1)),
    'seen: 음수 나이': d(mid, (x) => (x.seen['x-event'] = -1)),
    'seen: 소수 나이': d(mid, (x) => (x.seen['x-event'] = 1.5)),
    'seen: 문자열 나이': d(mid, (x) => (x.seen['x-event'] = '3')),
    'seen: 빈 id': d(mid, (x) => (x.seen[''] = 1)),
    'seen: 401개': d(mid, (x) => {
      for (let i = 0; i < 401; i++) x.seen[`e${i}`] = 0;
    }),
    // 마지막 선택지 나이
    'lastChoiceAge: 현재 나이보다 큼': d(mid, (x) => (x.lastChoiceAge = x.age + 1)),
    'lastChoiceAge: 음수': d(mid, (x) => (x.lastChoiceAge = -1)),
    'lastChoiceAge: 문자열': d(mid, (x) => (x.lastChoiceAge = '3')),
    'lastChoiceAge: 없음(undefined)': d(mid, (x) => delete x.lastChoiceAge),
    // 연표
    'history: kind 없음': d(mid, (x) => (x.history[0] = { age: 0, text: '태어났다' })),
    'history: kind 이상값': d(mid, (x) => (x.history[0].kind = 'rumor')),
    'history: text가 너무 김': d(mid, (x) => (x.history[0].text = '가'.repeat(401))),
    'history: title이 숫자': d(mid, (x) => (x.history[0].title = 5)),
    'history: title이 너무 김': d(mid, (x) => (x.history[0].title = '가'.repeat(61))),
    'history: choice가 너무 김': d(mid, (x) => (x.history[0].choice = '가'.repeat(81))),
    'history: 항목 나이가 현재 나이보다 큼': d(mid, (x) => x.history.push({ age: x.age + 1, kind: 'event', text: '미래' })),
    'history: 301개(상한 초과)': d(mid, (x) => (x.history = Array.from({ length: 301 }, () => ({ age: 0, kind: 'event', text: 'x' })))),
    // 인생 시작 전에는 진행 기록이 비어 있어야 한다
    'title인데 연표가 있음': d(mid, (x) => {
      x.phase = 'title';
      x.era = null;
      x.lifeLength = null;
      x.character = null;
      x.birthStats = null;
      x.age = 0;
      x.flags = [];
      x.seen = {};
      x.lastChoiceAge = null;
    }),
    'birth인데 플래그가 있음': d(mid, (x) => {
      x.phase = 'birth';
      x.age = 0;
      x.history = [];
      x.seen = {};
      x.flags = ['some_flag'];
      x.lastChoiceAge = null;
    }),
    'birth인데 본 이벤트가 있음': d(mid, (x) => {
      x.phase = 'birth';
      x.age = 0;
      x.history = [];
      x.flags = [];
      x.seen = { 'x-event': 0 };
      x.lastChoiceAge = null;
    }),
    'title인데 lastChoiceAge가 있음': d(createInitialState(3), (x) => (x.lastChoiceAge = 0)),
  };

  it('위 표에는 의미 있는 케이스가 충분히 있고, 기준 상태(변조 전)는 모두 통과한다', () => {
    expect(Object.keys(bad).length).toBeGreaterThanOrEqual(50);
    for (const base of [ok, mid, ended]) expect(load(raw(clone(base)))).not.toBeNull();
  });

  for (const [name, text] of Object.entries(bad)) {
    it(`${name} → 새 게임(null)`, () => expect(load(text)).toBeNull());
  }

  it('시대별 상한 나이 경계는 통과: 지난 100 / 지금 105 / 다가올 110', () => {
    for (const [era, year, max] of [
      ['past', 1960, 100],
      ['present', 2026, 105],
      ['future', 2040, 110],
    ] as const) {
      const x = clone(ended);
      x.era = era;
      x.character.birthYear = year;
      x.age = max;
      x.death.age = max;
      expect(load(raw(x)), `${era} ${max}세`).not.toBeNull();
    }
  });

  it('풀(pool)이 바뀌어 대기 중인 이벤트가 사라졌어도 저장 전체를 버리지 않는다 — 대기만 풀고 이어간다 (R-046, 아래 "콘텐츠 갱신" 블록에서 자세히)', () => {
    expect(parseGame(serializeGame(ok), EVENT_POOL)).toEqual(ok);
    const without: EventPool = createEventPool(EVENT_POOL.events.filter((e) => e.id !== evId));
    const repaired = parseGame(serializeGame(ok), without);
    expect(repaired).not.toBeNull();
    expect(repaired!.pending).toBeNull();
    // 대기 중인 선택지가 없는 상태는 풀과 무관하게 그대로 통과
    const fresh = startLife(1, 'present');
    expect(parseGame(serializeGame(fresh), without)).toEqual(fresh);
  });

  it('저장된 상태로 이어 진행해도 끊김이 없다: 복원한 대기 선택지를 풀면 원본과 같은 결과', () => {
    const st = memoryStorage();
    saveGame(st, ok);
    const restored = loadGame(st)!;
    const id = ok.pending!.choiceIds[0];
    expect(resolveChoice(restored, restored.pending!.key, id)).toEqual(resolveChoice(ok, ok.pending!.key, id));
  });

  it('v3 저장(M2 스키마: 플래그·대기·사망 필드 없음)은 새 게임으로 시작한다. 버전이 4여도 필드가 없으면 거부한다', () => {
    const v3 = clone(startLife(1, 'present'));
    for (const key of ['flags', 'seen', 'pending', 'lastChoiceAge', 'death']) delete v3[key];
    expect(load(JSON.stringify({ version: 3, data: v3 }))).toBeNull();
    expect(load(JSON.stringify({ version: 4, data: v3 }))).toBeNull();
  });
});

describe('콘텐츠 갱신으로 대기 중이던 이벤트가 사라진 저장: 대기만 풀고 이어간다 (R-046)', () => {
  /**
   * 결정(R-046): 예전에는 대기 중인 선택지가 풀의 이벤트와 맞지 않으면 저장 전체가 새 게임이 되었다. 콘텐츠를 갈아엎으면 그 순간 플레이 중이던 사용자의
   * 인생이 통째로 날아간다. 이제 저장의 모양(이벤트 id 형식·나이·키·본 이벤트 기록·선택지 id 목록)이 멀쩡하면 pending만 null로 풀어 이어가고
   * (그 해는 다시 진행된다), 모양이 어긋난 것(손상·변조)만 새 게임으로 보낸다. 저장 형식은 그대로라 SCHEMA_VERSION은 4로 유지한다.
   */
  const withoutEvent: EventPool = createEventPool(EVENT_POOL.events.filter((e) => e.id !== evId));
  const trimmedChoice: EventPool = createEventPool(
    EVENT_POOL.events.map((e) => (e.id === evId ? { ...e, choices: e.choices!.filter((c) => c.id !== ok.pending!.choiceIds[0]) } : e)),
  );
  const asNarrative: EventPool = createEventPool(EVENT_POOL.events.map((e) => (e.id === evId ? { ...e, choices: undefined, effects: { stats: { happiness: 1 } } } : e)));

  const scenarios: Array<[string, string, EventPool | undefined]> = [
    ['풀에 그 이벤트가 없다(삭제)', serializeGame(ok), withoutEvent],
    ['그 이벤트에서 저장된 선택지가 사라졌다(선택지 삭제)', serializeGame(ok), trimmedChoice],
    ['그 이벤트가 서술 이벤트로 바뀌었다', serializeGame(ok), asNarrative],
    ['저장이 가리키는 이벤트 id가 현재 풀에 한 번도 없었다', d(ok, (x) => {
      x.pending.eventId = 'no-such-event';
      x.pending.key = `no-such-event@${x.age}`;
      x.seen['no-such-event'] = x.age;
    }), undefined],
    ['저장된 선택지 id 중 하나가 이벤트에 없다', d(ok, (x) => (x.pending.choiceIds = ['no-such', x.pending.choiceIds[0]])), undefined],
  ];

  function d(base: GameState, patch: (x: Doc) => void): string {
    const x = clone(base);
    patch(x);
    return raw(x);
  }

  for (const [name, text, pool] of scenarios) {
    it(`${name} -> 새 게임이 아니라 대기만 풀린 같은 인생`, () => {
      const loaded = parseGame(text, pool ?? EVENT_POOL);
      expect(loaded, '저장 전체가 버려졌다').not.toBeNull();
      const before = JSON.parse(text).data as GameState;
      expect(loaded!.pending).toBeNull();
      // 대기 말고는 아무것도 바뀌지 않았다: 인물·나이·스탯·플래그·연표·본 이벤트·난수 상태
      expect({ ...loaded!, pending: before.pending }).toEqual(before);
      expect(loaded!.phase).toBe('life');
      expect(loaded!.age).toBe(ok.age);
    });

    it(`${name} -> 풀린 상태는 다시 저장·복원해도 같고, 끝까지 이어 진행된다`, () => {
      const loaded = parseGame(text, pool ?? EVENT_POOL)!;
      expect(parseGame(serializeGame(loaded), pool ?? EVENT_POOL)).toEqual(loaded);
      const end = playToEnd(loaded, null, pool ?? EVENT_POOL);
      expect(end.state.phase).toBe('ending');
      expect(end.state.death).not.toBeNull();
    });
  }

  it('모양이 어긋난 대기(키·나이·본 이벤트 기록·선택지 개수·id 형식)는 풀과 상관없이 여전히 새 게임이다 — 손상과 콘텐츠 갱신을 구분한다', () => {
    const shapeBroken: Array<[string, string]> = [
      ['key가 이벤트@나이와 다름', d(ok, (x) => (x.pending.key = `${evId}@${x.age + 1}`))],
      ['age가 현재 나이와 다름', d(ok, (x) => (x.pending.age = x.age - 1))],
      ['seen에 기록이 없음', d(ok, (x) => delete x.seen[evId])],
      ['선택지 1개', d(ok, (x) => (x.pending.choiceIds = [x.pending.choiceIds[0]]))],
      ['선택지 id가 숫자', d(ok, (x) => (x.pending.choiceIds = [1, 2]))],
      ['이벤트 id 형식 오류', d(ok, (x) => {
        x.pending.eventId = 'Bad Id';
        x.pending.key = `Bad Id@${x.age}`;
        x.seen['Bad Id'] = x.age;
      })],
    ];
    for (const [name, text] of shapeBroken) expect(parseGame(text, withoutEvent), name).toBeNull();
  });

  it('상속 속성 이름(constructor)이 본 이벤트 id로 저장돼 있어도 안전하다: 자기 속성만 본다 (R-046)', () => {
    // JSON.parse가 만든 객체는 "__proto__"를 자기 속성으로 가진다. 이 저장도 프로토타입을 오염시키지 않고 끝까지 진행된다.
    const x = clone(mid);
    x.seen = JSON.parse('{"__proto__": 0, "constructor": 0}');
    const loaded = parseGame(raw(x));
    expect(loaded, '형식이 맞는 저장이 거부되었다').not.toBeNull();
    expect(Object.getPrototypeOf(loaded!.seen)).toBe(Object.prototype);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    const end = playToEnd(loaded!);
    expect(end.state.phase).toBe('ending');
    expect(Object.getPrototypeOf({})).toBe(Object.prototype);
    // 대기 중인 선택지가 eventId "constructor"를 가리키는 저장은 (seen에 자기 속성이 없으면) 새 게임이다
    const y = clone(ok);
    y.pending.eventId = 'constructor';
    y.pending.key = `constructor@${y.age}`;
    expect(parseGame(raw(y))).toBeNull();
  });
});


describe('연표 상한 300 (SPEC-003 DB12)과 저장 크기', () => {
  it('상한은 300이다: 300줄은 저장·복원되고 301줄은 손상으로 새 게임이다', () => {
    expect(HISTORY_LIMITS.maxEntries).toBe(300);
    const make = (n: number) => {
      const x = clone(mid);
      x.history = Array.from({ length: n }, (_, i) => ({ age: 0, kind: i === 0 ? 'stage' : 'event', text: `기록 ${i}` }));
      return x;
    };
    expect(parseGame(raw(make(300)))?.history).toHaveLength(300);
    expect(parseGame(raw(make(301)))).toBeNull();
  });

  it('최악 판의 저장 크기 ≤ 200KB(▲): 모든 줄이 길이 상한(본문 400·제목 60·선택 80자)을 꽉 채운 300줄과 상한 가까운 플래그·본 이벤트가 있어도 JSON이 20만 자를 넘지 않는다', () => {
    const { maxTextLength, maxTitleLength, maxChoiceLength, maxEntries } = HISTORY_LIMITS;
    const x = clone(mid);
    x.history = Array.from({ length: maxEntries }, () => ({
      age: 0,
      kind: 'choice',
      text: '가'.repeat(maxTextLength),
      title: '나'.repeat(maxTitleLength),
      choice: '다'.repeat(maxChoiceLength),
      eventId: 'e'.repeat(48),
    }));
    x.flags = Array.from({ length: 60 }, (_, i) => `flag_${String(i).padStart(2, '0')}`).sort();
    const text = raw(x);
    expect(parseGame(text), '최악 판도 검증을 통과해 복원된다').not.toBeNull();
    // 화면 글자 수(UTF-16 코드 단위) 기준 — 브라우저 저장소 용량도 글자 수로 센다. 실제 이벤트 글(권장 최대 제목 16·본문 70·라벨 24·결과 80자)은 이 상한보다 훨씬 짧다.
    expect(text.length, `최악 판 저장 ${text.length}자`).toBeLessThanOrEqual(200_000);
    expect(text.length, '공허 통과 방지: 실제로 상한을 꽉 채운 판이다').toBeGreaterThan(150_000);
  });

  it('정상 플레이의 저장은 훨씬 작다: 세 시대 자동 완주 판의 저장이 30KB(글자 수)를 넘지 않는다', () => {
    for (const era of ['past', 'present', 'future'] as const) {
      const end = playToEnd(startLife(11, era)).state;
      const text = serializeGame(end);
      expect(text.length, era).toBeLessThanOrEqual(30_000);
    }
  });
});

describe('보이지 않는 방향·너비 제어 문자가 든 저장은 손상으로 본다 (QA-003-M7b A12b)', () => {
  /** 양방향 제어(U+202A~202E·U+2066~2069·U+200E·U+200F)와 제로폭(U+200B~200D·U+FEFF) 전부 — 코드 포인트마다 */
  const HIDDEN: number[] = [
    0x200b, 0x200c, 0x200d, 0x200e, 0x200f, 0x202a, 0x202b, 0x202c, 0x202d, 0x202e, 0x2066, 0x2067, 0x2068, 0x2069, 0xfeff,
  ];
  const at = (where: 'start' | 'middle' | 'end', text: string, cp: number): string => {
    const ch = String.fromCodePoint(cp);
    return where === 'start' ? ch + text : where === 'end' ? text + ch : text.slice(0, 1) + ch + text.slice(1);
  };

  it('이름: 위 15개 문자가 앞·가운데·끝 어디에 있어도 저장 전체를 거부한다(첫 화면 정리). 이름은 한글 음절 3~5자(이름 풀 전체가 통과하는 패턴, M7c T2)라 한글 이름은 통과하고 영문·공백·이모지가 든 이름은 거부한다', () => {
    const base = clone(mid);
    const name = base.character.name as string;
    expect(parseGame(raw(base)), '고치지 않은 저장은 통과').not.toBeNull();
    for (const cp of HIDDEN) {
      for (const where of ['start', 'middle', 'end'] as const) {
        const x = clone(mid);
        x.character.name = at(where, name, cp);
        expect(parseGame(raw(x)), `이름 ${where} U+${cp.toString(16).toUpperCase()}`).toBeNull();
        expect(load(raw(x)), `loadGame도 거부(새 게임) U+${cp.toString(16).toUpperCase()}`).toBeNull();
      }
    }
    for (const fine of ['김민준', '박서연', '이지우']) {
      const x = clone(mid);
      x.character.name = fine;
      expect(parseGame(raw(x)), `보통 이름 ${fine}`).not.toBeNull();
    }
    // M7c T2: 한글 음절 화이트리스트라 한글이 아닌 글자(영문·공백·이모지·기호)가 든 이름은 거부한다 — 이름은 이름 풀에서만 오므로 정상 저장을 잃지 않는다
    for (const bad of ['Alex Kim', '이 서 윤', 'Zoë', '김🙂준', '이름-에·점']) {
      const x = clone(mid);
      x.character.name = bad;
      expect(parseGame(raw(x)), `한글이 아닌 이름 ${bad}`).toBeNull();
    }
  });

  it('연표 글(text·title·choice)과 사망 원인도 같다: 화면에 그대로 나가는 글이라 방향 제어 문자가 글자 순서를 뒤집는다', () => {
    const rlo = String.fromCodePoint(0x202e);
    const zwsp = String.fromCodePoint(0x200b);
    const cases: Record<string, string> = {
      'history text': (() => {
        const x = clone(mid);
        x.history[0].text = `${x.history[0].text}${rlo}`;
        return raw(x);
      })(),
      'history title': (() => {
        const x = clone(mid);
        x.history[0].title = `${zwsp}제목`;
        return raw(x);
      })(),
      'history choice': (() => {
        const x = clone(mid);
        x.history[0].choice = `선택${rlo}`;
        return raw(x);
      })(),
      'death cause': (() => {
        const x = clone(ended);
        x.death.cause = `${x.death.cause}${rlo}`;
        return raw(x);
      })(),
    };
    for (const [name, text] of Object.entries(cases)) expect(parseGame(text), name).toBeNull();
    // 고치지 않은 사망·연표는 통과한다(공허 통과 방지: 위 변조가 아니라 문자 때문에 거부됐다)
    expect(parseGame(serializeGame(ended))).not.toBeNull();
    expect(parseGame(serializeGame(mid))).not.toBeNull();
  });

  it('hasHiddenControl: 15개 문자 전부를 잡고, 그 바로 앞·뒤 코드 포인트(U+200A 얇은 공백·U+2010 하이픈·U+2029·U+206A·U+FEFE)와 일반 글자는 잡지 않는다', () => {
    for (const cp of HIDDEN) expect(hasHiddenControl(`가${String.fromCodePoint(cp)}나`), `U+${cp.toString(16)}`).toBe(true);
    for (const cp of [0x200a, 0x2010, 0x2029, 0x202f, 0x2065, 0x206a, 0xfefe, 0x0020, 0x00a0, 0x3000]) expect(hasHiddenControl(`가${String.fromCodePoint(cp)}나`), `U+${cp.toString(16)}`).toBe(false);
    expect(hasHiddenControl('보통의 한글 이름과 English 123 🙂')).toBe(false);
  });
});
