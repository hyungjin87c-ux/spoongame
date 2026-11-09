import { describe, expect, it } from 'vitest';
import age20Legacy from './fixtures/save-v030-age20.json';
import bothRaw from './fixtures/save-v040-both-age20.json?raw';
import motherRaw from './fixtures/save-v040-mother-age20.json?raw';
import { SCHEMA_VERSION, appendHistory, clipEntry, createEventPool, parseGame, parseOpened, resolveChoice, serializeGame, stepYear, type EventPool, type GameState, type HistoryEntry } from '../src/core';
import { HISTORY_LIMITS } from '../src/data/lifeTable';
import { EVENT_POOL } from '../src/data/events';
import { startLife } from '../scripts/simulateLib';
import type { ProfileId } from '../src/core';

/**
 * SPEC-014 QS1 · 완료 기준 2·3·4 — 결정 줄의 질문 문장 저장.
 * ① `resolveChoiceCore` 한 곳이 본인 선택·부모 결정·흘러감 세 경로에 같은 `question`을 적는다(그 사건의 `question`과 같은 값).
 * ② 진행은 `question`이 있든 없든 같다 — 난수 수열·스탯·나이·본 이벤트가 같고 줄의 `question` 필드만 다르다.
 * ③ 저장: `SCHEMA_VERSION` 9 유지 · 이상한 값은 그 필드만 버린다 · 정상은 같은 객체 · 옛 줄은 소급하지 않아 save → load → save가 바이트까지 같다.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Doc = Record<string, any>;
const clone = (s: GameState): Doc => JSON.parse(JSON.stringify(s));
const raw = (d: Doc): string => JSON.stringify({ version: SCHEMA_VERSION, data: d });

/** 대기 중인 본인 선택은 첫 선택지로 풀며 나이 `upTo`까지 산다 */
function liveUntil(seed: number, profile: ProfileId, upTo: number, pool: EventPool = EVENT_POOL): GameState {
  let s = startLife(seed, profile);
  let guard = 0;
  while (s.phase === 'life' && s.age < upTo && guard++ < 400) {
    s = s.pending !== null ? resolveChoice(s, s.pending.key, s.pending.choiceIds[0], pool) : stepYear(s, pool).state;
  }
  return s;
}

const questionOf = (id: string | undefined): string | undefined => (id === undefined ? undefined : EVENT_POOL.byId.get(id)?.question);

describe('QS1 ① resolveChoiceCore 세 경로가 같은 question 을 적는다', () => {
  const lives = ([[1, 'alpha'], [2, 'genz'], [3, 'millennial'], [4, 'genx'], [5, 'alpha'], [6, 'genz']] as const).map(([seed, profile]) => liveUntil(seed, profile, 45));
  const choices = lives.flatMap((s) => s.history.filter((h) => h.kind === 'choice'));

  it('결정 줄마다 question 이 있고 그 사건의 question 과 한 글자도 다르지 않다', () => {
    expect(choices.length, '공허 통과 방지').toBeGreaterThan(20);
    for (const h of choices) {
      expect(h.question, `${h.age}세 ${h.eventId}`).toBe(questionOf(h.eventId));
      expect(typeof h.question).toBe('string');
    }
  });

  it('본인 선택 · 부모 결정 · 흘러감 줄이 모두 있고(by 없음 · parent · child) 모두 question 이 같은 규칙으로 들어간다', () => {
    const own = choices.filter((h) => h.by === undefined);
    const parent = choices.filter((h) => h.by === 'parent');
    const child = choices.filter((h) => h.by === 'child');
    expect(own.length, '본인 선택').toBeGreaterThan(0);
    expect(parent.length, '부모 결정').toBeGreaterThan(0);
    expect(child.length, '흘러감').toBeGreaterThan(0);
    for (const h of [...own, ...parent, ...child]) expect(h.question).toBe(questionOf(h.eventId));
  });

  it('question 은 결정 줄에만 있고 서술(event)·단계·사망·기록 줄에는 없다', () => {
    for (const s of lives) for (const h of s.history) if (h.kind !== 'choice') expect(Object.prototype.hasOwnProperty.call(h, 'question'), `${h.kind} ${h.age}세`).toBe(false);
  });

  it('title · choice · text · eventId · by 는 그대로다 (question 만 더해졌다)', () => {
    for (const h of choices) {
      const ev = EVENT_POOL.byId.get(h.eventId!)!;
      expect(h.title).toBe(ev.title);
      expect(ev.choices!.some((c) => c.label === h.choice || c.parentLabel === h.choice)).toBe(true);
    }
  });
});

describe('QS1 ② 진행은 question 이 있든 없든 같다 (난수·판 결과 불변)', () => {
  const withoutQuestion: EventPool = createEventPool(EVENT_POOL.events.map((e) => { const { question: _q, ...rest } = e; void _q; return rest; }));

  it('같은 시드·같은 선택 → 나이·스탯·난수 상태·본 이벤트·연표(question 만 뺀)가 같다', () => {
    for (const [seed, profile] of [[11, 'alpha'], [12, 'genz'], [13, 'genx'], [14, 'boomer']] as const) {
      const a = liveUntil(seed, profile, 60, EVENT_POOL);
      const b = liveUntil(seed, profile, 60, withoutQuestion);
      const strip = (h: HistoryEntry): HistoryEntry => { const { question: _q, ...rest } = h; void _q; return rest as HistoryEntry; };
      expect(a.history.some((h) => h.question !== undefined)).toBe(true);
      expect(b.history.some((h) => h.question !== undefined)).toBe(false);
      expect({ ...a, history: a.history.map(strip) }).toEqual({ ...b, history: b.history.map(strip) });
      expect(a.rngState).toBe(b.rngState);
    }
  });
});

describe('QS1 ③ 저장: 이상한 question 은 그 필드만 버리고 판은 열린다', () => {
  const base = liveUntil(21, 'alpha', 30);
  const idx = base.history.findIndex((h) => h.kind === 'choice');
  const eventIdx = base.history.findIndex((h) => h.kind === 'event');
  const first = base.history[idx];

  it('SCHEMA_VERSION 은 9 그대로다', () => {
    expect(SCHEMA_VERSION).toBe(9);
  });

  it('정상 저장: question 이 있는 줄은 그대로 열리고 줄 객체도 새로 만들어지지 않는다 (왕복이 같다)', () => {
    expect(first.question).toBeDefined();
    const back = parseGame(serializeGame(base))!;
    expect(back).not.toBeNull();
    expect(back.history).toEqual(base.history);
    expect(serializeGame(back)).toBe(serializeGame(base));
  });

  it('문자열이 아니거나 비었거나 60자를 넘거나 위험한 글자가 있으면 그 줄의 question 만 사라진다', () => {
    const bads: unknown[] = [7, 0, null, true, false, {}, ['갈까?'], '', 'ㅇ'.repeat(HISTORY_LIMITS.maxQuestionLength + 1), `갈까${String.fromCodePoint(0)}말까?`, `갈까${String.fromCodePoint(0x202e)}말까?`, `갈까${String.fromCodePoint(0x200b)}말까?`, `갈까${String.fromCodePoint(10)}말까?`];
    for (const bad of bads) {
      const d = clone(base);
      d.history[idx].question = bad;
      const back = parseGame(raw(d));
      expect(back, `question=${JSON.stringify(bad)} 때문에 판이 버려졌다`).not.toBeNull();
      expect(Object.prototype.hasOwnProperty.call(back!.history[idx], 'question'), JSON.stringify(bad)).toBe(false);
      const expected = { ...first } as Record<string, unknown>;
      delete expected.question;
      expect(back!.history[idx]).toEqual(expected);
      expect(back!.history.filter((_, i) => i !== idx)).toEqual(base.history.filter((_, i) => i !== idx));
      expect(back!.stats).toEqual(base.stats);
      expect(back!.age).toBe(base.age);
    }
  });

  it('60자 딱 맞는 값은 남는다 (경계)', () => {
    const d = clone(base);
    d.history[idx].question = '가'.repeat(HISTORY_LIMITS.maxQuestionLength);
    expect(parseGame(raw(d))!.history[idx].question).toBe('가'.repeat(60));
  });

  it('choice 가 아닌 줄(event·stage·death·note)에 달린 question 은 값이 멀쩡해도 그 필드만 사라진다', () => {
    for (const i of [0, eventIdx].filter((x) => x >= 0)) {
      const d = clone(base);
      d.history[i].question = '갈까 말까?';
      const back = parseGame(raw(d))!;
      expect(back).not.toBeNull();
      expect(Object.prototype.hasOwnProperty.call(back.history[i], 'question'), base.history[i].kind).toBe(false);
      expect(back.history[idx].question).toBe(first.question); // 진짜 choice 줄은 그대로
    }
    const note = clone(base);
    note.history.push({ age: base.age, kind: 'note', title: '가', text: '내가 쓴 글', question: '갈까 말까?' });
    const back = parseGame(raw(note))!;
    expect(back).not.toBeNull();
    expect(Object.prototype.hasOwnProperty.call(back.history[back.history.length - 1], 'question')).toBe(false);
  });
});

describe('QS1 ④ 옛 저장: 소급하지 않는다 — save → load → save 가 바이트까지 같다', () => {
  const sources: Array<[string, string]> = [
    ['v0.4.0 둘 다 계신 20세', bothRaw],
    ['v0.4.0 어머니 20세', motherRaw],
    ['v0.3.0 20세', JSON.stringify(age20Legacy)],
  ];

  it('옛 저장의 결정 줄에 question 이 없고 열어도 채워지지 않는다', () => {
    for (const [name, text] of sources) {
      const opened = parseOpened(text);
      if (opened === null) continue; // 새 게임으로 시작해야 하는 버전은 이 시험의 대상이 아니다
      expect(opened.history.filter((h) => h.kind === 'choice').length, name).toBeGreaterThan(0);
      for (const h of opened.history) expect(Object.prototype.hasOwnProperty.call(h, 'question'), `${name} ${h.age}세`).toBe(false);
    }
    expect(sources.some(([, t]) => parseOpened(t) !== null), '공허 통과 방지: 적어도 한 저장은 열린다').toBe(true);
  });

  it('save → load → save 가 바이트 단위로 같다 (옛 저장 · 질문이 섞인 새 저장)', () => {
    const mixed = (() => {
      const live = liveUntil(31, 'alpha', 25);
      // 앞쪽 절반의 질문을 지워 한 판 안에 옛 줄(제목)과 새 줄(질문)이 섞인 판을 만든다
      const cut = Math.floor(live.history.length / 2);
      return { ...live, history: live.history.map((h, i) => { if (i >= cut) return h; const { question: _q, ...rest } = h; void _q; return rest as HistoryEntry; }) };
    })();
    expect(mixed.history.some((h) => h.question !== undefined) && mixed.history.some((h) => h.kind === 'choice' && h.question === undefined)).toBe(true);
    const cases: Array<[string, string]> = [...sources.filter(([, t]) => parseOpened(t) !== null), ['옛 줄·새 줄이 섞인 판', serializeGame(mixed)]];
    for (const [name, text] of cases) {
      const once = serializeGame(parseOpened(text)!);
      const twice = serializeGame(parseOpened(once)!);
      expect(twice, name).toBe(once);
      if (name === '옛 줄·새 줄이 섞인 판') expect(once, name).toBe(text); // 질문이 있든 없든 한 글자도 바뀌지 않는다
    }
  });

  it('question 을 모르는 앱(v0.4.1)이 새 저장을 여는 길: 줄 검증이 모르는 필드를 막지 않는다 — question 이 달린 줄을 지우지 않고도 판이 열린다', () => {
    // 같은 데이터의 question 을 이상한 값(60자 초과)으로 바꿔도 판은 열린다 = 이 필드는 판을 버릴 사유가 아니다. 옛 앱은 필드를 읽지 않아 아예 무시한다
    const live = liveUntil(41, 'alpha', 20);
    const d = clone(live);
    for (const h of d.history) if (h.kind === 'choice') h.question = '가'.repeat(500);
    expect(parseGame(raw(d))).not.toBeNull();
  });
});

describe('QS1 ⑤ 길이: clipEntry · appendHistory 가 question 을 자른다', () => {
  it('60자를 넘는 question 은 … 로 잘려 60자가 된다, 없으면 키를 만들지 않는다', () => {
    const long: HistoryEntry = { age: 5, kind: 'choice', text: '결과', title: '제목', choice: '선택', question: '가'.repeat(120) };
    const clipped = clipEntry(long);
    expect(clipped.question!.length).toBe(HISTORY_LIMITS.maxQuestionLength);
    expect(clipped.question!.endsWith('…')).toBe(true);
    expect(Object.prototype.hasOwnProperty.call(clipEntry({ age: 5, kind: 'choice', text: '결과' }), 'question')).toBe(false);
    expect(appendHistory([], long)[0].question!.length).toBe(60);
  });
});
