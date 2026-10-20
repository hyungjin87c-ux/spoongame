import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SETTINGS,
  ERAS,
  HEAVY_KINDS,
  HEAVY_LINES_WITHOUT_EVENT,
  autoChoiceWeights,
  createEventPool,
  createInitialState,
  createRng,
  createSession,
  heavyEvents,
  heavyKindOfEntry,
  heavyKindOfEvent,
  parseGame,
  parseSettings,
  playToEnd,
  resolveChoiceStep,
  serializeGame,
  serializeSettings,
  sessionReducer,
  validateEventFiles,
  EventDataError,
  type Era,
  type GameState,
  type HeavyKind,
  type HistoryEntry,
  type Session,
  type SessionAction,
} from '../src/core';
import { EVENT_FILES, EVENT_POOL } from '../src/data/events';
import { HEAVY_KIND_NAME_MAX, HEAVY_KIND_TEXT, HEAVY_SLIDE_TEXT, VEIL_TEXT } from '../src/data/gentleText';
import { INHERIT_NOTE_TEXT } from '../src/data/lifeTable';
import { startLife } from '../scripts/simulateLib';
import copyMd from '../docs/design/copy.md?raw';
import schemaMd from '../docs/data/events-schema.md?raw';
import specMd from '../docs/spec/SPEC-005-빠른개선.md?raw';
import legacyV8 from './fixtures/saveV8Inherit.json';

/**
 * 무거운 장면 가리기 (SPEC-005 QI6 HV2~HV8·SV1·SV3, 완료 기준 11·13) — 코어 쪽 시험.
 *  1. `heavy` 표 ↔ 데이터 (이벤트 23개 · 제외 4개·경계 3개에는 표지 없음 · 분류 이름 6개 1:1, R-469)
 *  2. 상속 줄 표지 (R-468·M20 — 옛 v8 저장 표본 포함)
 *  3. 저장·설정 (선택 필드 `gentleUsed`, 설정 v5 `gentle`·`notesSeen`, 이상한 값은 그 필드만 버린다)
 *  4. 세션 규칙 (`setGentle`·`autoPick`·`gentleUsed`는 판 도중 한 번이라도 켜졌으면 참)
 *  5. **같은 시드·같은 선택이면 켠 판과 끈 판의 상태 전체가 같다** (1000판 × 3시대) — **단 `gentleUsed`와 플레이 시간 `play`는 비교에서 뺀다**(R-474):
 *     `gentleUsed`는 정의상 켠 판에서만 참이라 다르고, 플레이 시간 `play`는 브라우저에서 사람이 하는 동안 쌓이는 값이라 같은 선택을 해도 판마다 다르다(이 시험은 시간을 재는 UI가 없어 `play`가 늘 없지만, e2e에서는 다르다).
 * 화면(가린 줄·카드·연표·슬라이드)은 tests/gentleScreens.test.tsx, 브라우저 동작은 e2e/gentle.spec.ts.
 */

// ---------- 1. heavy 표 ↔ 데이터 ----------

/** 부록 D-1의 이벤트 23개 (kind별) — SPEC-005 부록 D, REV-005-HV-1 8절 */
const HEAVY_TABLE: Record<HeavyKind, string[]> = {
  home: ['infant-neglect-night', 'school-early-work', 'school-family-priority'],
  school: ['school-bully', 'school-chat-room'],
  health: ['infant-fever', 'infant-hospital-stay', 'middle-health-check-later', 'middle-health-crisis', 'senior-illness', 'senior-illness-later', 'senior-fall'],
  loss: ['middle-parents-care', 'middle-parents-farewell', 'senior-spouse-care', 'senior-last-wishes', 'senior-old-friend'],
  bond: ['youth-partner-leaves', 'middle-marriage-crisis', 'senior-estranged-child'],
  work: ['youth-job-rejections', 'middle-layoff', 'middle-debt-guarantee'],
};
/** 제외 4개(R-462~R-464)와 경계 3개 — 부록 D-4. 시험은 이 7개에 `heavy`가 없음을 단언한다 */
const EXCLUDED = ['school-money-gap', 'youth-factory-night', 'senior-alone', 'middle-lonely-holiday'];
const BORDERLINE = ['middle-health-check', 'youth-work-pressure', 'school-academy-night'];

describe('heavy 표 ↔ 데이터 (HV2, 완료 기준 11)', () => {
  const actual = heavyEvents(EVENT_POOL);

  it('표지가 붙은 이벤트는 정확히 23개이고 id·분류가 부록 D-1 표와 같다 (home 3 · school 2 · health 7 · loss 5 · bond 3 · work 3)', () => {
    const expected = new Map<string, HeavyKind>();
    for (const [kind, ids] of Object.entries(HEAVY_TABLE) as Array<[HeavyKind, string[]]>) for (const id of ids) expected.set(id, kind);
    expect(expected.size).toBe(23);
    expect([...actual.keys()].sort()).toEqual([...expected.keys()].sort());
    for (const [id, kind] of expected) expect(actual.get(id), id).toBe(kind);
    const counts = Object.fromEntries(HEAVY_KINDS.map((k) => [k, [...actual.values()].filter((v) => v === k).length]));
    expect(counts).toEqual({ home: 3, school: 2, health: 7, loss: 5, bond: 3, work: 3 });
  });

  it('제외 4개와 경계 3개에는 표지가 없다 — 그 이벤트는 실제로 풀에 있다(없는 이름을 대조하는 공허한 시험이 아니다)', () => {
    for (const id of [...EXCLUDED, ...BORDERLINE]) {
      const ev = EVENT_POOL.byId.get(id);
      expect(ev, `${id}: 풀에 있다`).toBeDefined();
      expect(heavyKindOfEvent(ev), `${id}: 표지 없음`).toBeNull();
    }
    expect(EXCLUDED.length + BORDERLINE.length).toBe(7);
  });

  it('표지는 서술·선택지 이벤트에만 있고 마일스톤에는 없다 (모든 판에 일어나는 첫 걸음·첫 말을 가리지 않는다)', () => {
    for (const ev of EVENT_POOL.events) {
      if (ev.heavy !== undefined) expect(ev.milestone === true, ev.id).toBe(false);
    }
  });

  it('SPEC 부록 D-1 표와 events-schema.md 11절이 같은 이벤트 목록을 적는다 (문서 ↔ 데이터)', () => {
    const d1 = specMd.slice(specMd.indexOf('### D-1.'), specMd.indexOf('### D-2.'));
    for (const id of actual.keys()) {
      expect(d1, `SPEC 부록 D-1에 ${id}`).toContain(`${id} (`);
      expect(schemaMd, `events-schema.md 11절에 ${id}`).toContain(id);
    }
    for (const id of [...EXCLUDED, ...BORDERLINE]) {
      expect(d1.includes(`| ${id} (`) && d1.slice(d1.indexOf(`| ${id} (`) - 20, d1.indexOf(`| ${id} (`)).includes('home'), `${id}는 D-1 가림 표에 없다`).toBe(false);
    }
  });

  it('데이터 검증이 heavy의 모양을 막는다: 알 수 없는 분류·여분 키·마일스톤·객체가 아닌 값은 로드할 때 오류다', () => {
    const base = EVENT_FILES['./senior.json'] as { events: Array<Record<string, unknown>> };
    const ev = base.events.find((e) => e.id === 'senior-fall') as Record<string, unknown>;
    const bad = (heavy: unknown, extra: Record<string, unknown> = {}) => validateEventFiles({ 'x.json': { events: [{ ...ev, id: 'senior-fall-x', heavy, ...extra }] } });
    expect(() => bad({ kind: 'health' })).not.toThrow(EventDataError);
    expect(() => bad({ kind: 'sad' })).toThrow(/분류/);
    expect(() => bad({ kind: 'health', note: 1 })).toThrow(/알 수 없는 항목/);
    expect(() => bad({})).toThrow(/필수 항목/);
    expect(() => bad('health')).toThrow(/객체/);
    // 마일스톤 + heavy
    const milestone = (EVENT_FILES['./infant.json'] as { events: Array<Record<string, unknown>> }).events.find((e) => e.milestone === true) as Record<string, unknown>;
    expect(() => validateEventFiles({ 'x.json': { events: [{ ...milestone, id: 'ms-x', heavy: { kind: 'health' } }] } })).toThrow(/마일스톤/);
  });
});

describe('분류 화면 이름 6개 ↔ heavy kind (R-469 끝, 완료 기준 11)', () => {
  it('이름 표의 키가 HEAVY_KINDS 여섯과 정확히 같다 — 이름이 빠지거나 남는 이름이 없다', () => {
    expect(Object.keys(HEAVY_KIND_TEXT).sort()).toEqual([...HEAVY_KINDS].sort());
    expect(HEAVY_KINDS).toHaveLength(6);
  });

  it('이름은 비어 있지 않고 서로 다르며 6자 이하다 (「무거운 일이 있었습니다 · {분류}」가 글자 200%에서 두 줄 모드로 접힌다)', () => {
    const names = HEAVY_KINDS.map((k) => HEAVY_KIND_TEXT[k]);
    expect(new Set(names).size).toBe(6);
    for (const n of names) {
      expect(n.trim()).toBe(n);
      expect(n.length).toBeGreaterThan(0);
      expect(n.length).toBeLessThanOrEqual(HEAVY_KIND_NAME_MAX);
    }
  });

  it('이름이 copy.md 12-1 확정 표와 같다 (문구 한 곳 — 이름을 바꾸면 이 표부터 고친다)', () => {
    const sec = copyMd.slice(copyMd.indexOf('### 12-1.'), copyMd.indexOf('### 12-2.'));
    const expected: Record<HeavyKind, string> = { home: '집안 사정', school: '또래 사이', health: '건강', loss: '돌봄과 이별', bond: '멀어진 사이', work: '일과 생계' };
    for (const k of HEAVY_KINDS) {
      expect(HEAVY_KIND_TEXT[k]).toBe(expected[k]);
      expect(sec, `copy.md 12-1의 ${k} 행`).toContain(`| ${k} | **${expected[k]}** |`);
    }
    expect(sec).toContain(`**${HEAVY_SLIDE_TEXT.name}**`);
  });

  it('죽음을 미리 알리는 이름이 없다 (R-469): 「사별」「상실」「이별」은 loss(돌봄과 이별) 한 곳에만 있고 loss는 두 낱말을 「과」로 묶은 주제 이름이다', () => {
    for (const k of HEAVY_KINDS) {
      if (k === 'loss') continue;
      expect(HEAVY_KIND_TEXT[k], k).not.toMatch(/사별|상실|이별|죽음|사망|자살/);
    }
    expect(HEAVY_KIND_TEXT.loss).toBe('돌봄과 이별');
    // bond는 loss와 낱말이 겹치지 않는다
    expect(HEAVY_KIND_TEXT.bond).not.toContain('이별');
  });

  it('가림 문구에 주제어(따돌림·실직·병…)와 느낌표·이모지가 없다 — 가린 줄에서 유일하게 보이는 글자라서', () => {
    const all = [...Object.values(HEAVY_KIND_TEXT), VEIL_TEXT.rowLead, VEIL_TEXT.cardLead, VEIL_TEXT.decisionNote, VEIL_TEXT.parentNote, VEIL_TEXT.endingLine, HEAVY_SLIDE_TEXT.title];
    for (const t of all) {
      expect(t).not.toMatch(/[!！]/);
      expect(t).not.toMatch(/\p{Extended_Pictographic}/u);
    }
    for (const k of HEAVY_KINDS) expect(HEAVY_KIND_TEXT[k]).not.toMatch(/따돌림|실직|해고|빚|암|병원|입원|임종|장례|이혼/);
  });
});

// ---------- 2. 상속 줄 (R-468·M20) ----------

describe('상속 줄 표지 (HV2-6·R-468·M20) — 줄에 필드를 더하지 않고 글자 상수로 잡는다', () => {
  const inherit = (over: Partial<HistoryEntry> = {}): HistoryEntry => ({ age: 57, kind: 'event', text: INHERIT_NOTE_TEXT, ...over });

  it('eventId가 없는 사건 줄 「부모님이 남기신 재산을 물려받았습니다.」는 loss다', () => {
    expect(heavyKindOfEntry(inherit())).toBe('loss');
    expect(HEAVY_LINES_WITHOUT_EVENT.get(INHERIT_NOTE_TEXT)).toBe('loss');
    expect(HEAVY_LINES_WITHOUT_EVENT.size, 'eventId 없는 무거운 줄은 지금 상속 줄 하나뿐이다').toBe(1);
  });

  it('다른 글자·다른 종류의 줄은 잡지 않는다 (사망·단계·기록 줄은 가리지 않는다 — HV8)', () => {
    expect(heavyKindOfEntry(inherit({ text: '부모님이 남기신 재산을 물려받았습니다' }))).toBeNull();
    expect(heavyKindOfEntry(inherit({ kind: 'choice' }))).toBeNull();
    expect(heavyKindOfEntry(inherit({ kind: 'stage' }))).toBeNull();
    expect(heavyKindOfEntry(inherit({ kind: 'death', text: '세상을 떠났습니다. 원인은 사고였습니다.' }))).toBeNull();
    expect(heavyKindOfEntry({ age: 30, kind: 'note', text: '내 글', eventId: 'note-manual', title: '주제' })).toBeNull();
  });

  it('이벤트에서 온 줄은 그 이벤트의 표지를 따른다 (서술·선택 결과 모두) — 풀에 없는 이벤트는 null(옛 저장의 사라진 이벤트는 원문 그대로)', () => {
    for (const [id, kind] of heavyEvents(EVENT_POOL)) {
      expect(heavyKindOfEntry({ age: 50, kind: 'event', text: '글', eventId: id }), id).toBe(kind);
      expect(heavyKindOfEntry({ age: 50, kind: 'choice', text: '글', choice: '길', eventId: id }), id).toBe(kind);
    }
    expect(heavyKindOfEntry({ age: 50, kind: 'event', text: '글', eventId: 'removed-event' })).toBeNull();
    expect(heavyKindOfEntry({ age: 50, kind: 'event', text: '글', eventId: EXCLUDED[0] })).toBeNull();
  });

  it('엔진이 만드는 eventId 없는 사건 줄은 상속 줄뿐이다 — 새로 이벤트 밖의 줄이 생기면 이 시험이 알려 표 갱신을 강제한다 (세 시대 × 120판)', () => {
    const texts = new Set<string>();
    let inheritLines = 0;
    for (const era of ERAS) {
      for (let seed = 1; seed <= 120; seed++) {
        const end = playToEnd(startLife(seed, era), null).state;
        for (const h of end.history) {
          if (h.kind === 'event' && h.eventId === undefined) {
            texts.add(h.text);
            if (h.text === INHERIT_NOTE_TEXT) inheritLines++;
          }
        }
      }
    }
    expect([...texts]).toEqual([INHERIT_NOTE_TEXT]);
    expect(inheritLines, '표본에 상속 줄이 실제로 있다(공허하지 않다)').toBeGreaterThan(0);
  });

  it('새 판에서 상속을 받은 해의 줄이 loss로 잡히고, 바로 앞 「마지막 인사」 줄과 같은 분류다 (가린 farewell 줄 바로 뒤에서 내용이 새지 않는다)', () => {
    let found = 0;
    for (let seed = 1; seed <= 400 && found < 3; seed++) {
      const end = playToEnd(startLife(seed, 'present'), (s) => (s.pending?.eventId === 'middle-parents-farewell' ? s.pending.choiceIds[0] : null)).state;
      const at = end.history.findIndex((h) => h.text === INHERIT_NOTE_TEXT);
      if (at < 0) continue;
      found++;
      expect(heavyKindOfEntry(end.history[at])).toBe('loss');
      const farewell = end.history.find((h) => h.eventId === 'middle-parents-farewell');
      if (farewell !== undefined) expect(heavyKindOfEntry(farewell)).toBe('loss');
    }
    expect(found).toBeGreaterThan(0);
  });

  it('옛 v8 저장 표본(표지·gentleUsed 필드가 없는 이 변경 이전의 저장)이 그대로 열리고 그 상속 줄도 loss로 잡힌다 (M20, 저장 스키마 v8 유지)', () => {
    const raw = JSON.stringify(legacyV8);
    expect(legacyV8.version, '저장 스키마는 v8 그대로').toBe(8);
    expect(raw).not.toContain('gentleUsed');
    expect(raw).not.toContain('heavy');
    const game = parseGame(raw);
    expect(game, '옛 저장이 그대로 열린다').not.toBeNull();
    expect(game!.gentleUsed, '필드가 없는 판은 켠 적이 없는 판').toBeUndefined();
    const line = game!.history.find((h) => h.kind === 'event' && h.eventId === undefined && h.text === INHERIT_NOTE_TEXT);
    expect(line, '표본에 상속 줄이 있다').toBeDefined();
    expect(Object.keys(line!).sort(), '줄에는 표지 필드가 없다').toEqual(['age', 'kind', 'text']);
    expect(heavyKindOfEntry(line!)).toBe('loss');
    // 같은 표본의 무거운 이벤트 줄(「마지막 인사」)도 데이터의 표지로 잡힌다
    const farewell = game!.history.find((h) => h.eventId === 'middle-parents-farewell');
    expect(farewell).toBeDefined();
    expect(heavyKindOfEntry(farewell!)).toBe('loss');
  });
});

// ---------- 3. 저장·설정 (SV1·SV2) ----------

describe('저장: 선택 필드 gentleUsed (SV1) — 스키마는 v8 그대로, 이상한 값은 그 필드만 버린다', () => {
  const life = (): GameState => startLife(7, 'present');
  const parsedWith = (state: GameState, patch: Record<string, unknown>): GameState | null => parseGame(JSON.stringify({ version: 8, data: { ...state, ...patch } }));

  it('gentleUsed: true인 판은 저장·복원에서 유지된다 (인생·엔딩 단계)', () => {
    const g = { ...life(), gentleUsed: true };
    expect(parseGame(serializeGame(g))).toEqual(g);
    const end = { ...playToEnd(startLife(3, 'present'), null).state, gentleUsed: true };
    expect(parseGame(serializeGame(end))?.gentleUsed).toBe(true);
    // false도 유효한 불리언이다(앱은 쓰지 않지만 버리지 않는다)
    expect(parsedWith(life(), { gentleUsed: false })?.gentleUsed).toBe(false);
  });

  it('필드가 없는 v8 저장(이전의 모든 판)은 그대로 유효하다 — 끈 판의 직렬화에는 필드가 아예 없다', () => {
    const g = life();
    expect(Object.prototype.hasOwnProperty.call(g, 'gentleUsed')).toBe(false);
    expect(serializeGame(g)).not.toContain('gentleUsed');
    expect(parseGame(serializeGame(g))).toEqual(g);
  });

  it('값이 이상하면 판을 버리지 않고 그 필드만 버린다 (withValidPlay 방식): 불리언이 아닌 값·첫 화면 단계의 필드', () => {
    for (const bad of [1, 0, 'true', 'yes', null, {}, [], [true]]) {
      const game = parsedWith(life(), { gentleUsed: bad });
      expect(game, `${JSON.stringify(bad)}: 판은 열린다`).not.toBeNull();
      expect(Object.prototype.hasOwnProperty.call(game!, 'gentleUsed'), `${JSON.stringify(bad)}: 필드는 사라진다`).toBe(false);
      expect(game!.history, '나머지는 그대로').toEqual(life().history);
    }
    // 첫 화면 단계(아직 살기 전)에는 있을 수 없다
    const title = createInitialState(5);
    const t = parsedWith(title, { gentleUsed: true });
    expect(t).not.toBeNull();
    expect(Object.prototype.hasOwnProperty.call(t!, 'gentleUsed')).toBe(false);
  });
});

describe('설정 v5: gentle·notesSeen (SV2)', () => {
  const env = (version: number, data: Record<string, unknown>) => JSON.stringify({ version, data });
  const base = { speed: 4, autoMode: true };

  it('v1~v4 설정은 그대로 읽고 새 필드는 기본값(꺼짐·본 적 없음)으로 채운다 — 이미 고른 값을 잃지 않는다', () => {
    for (const version of [1, 2, 3, 4]) {
      const s = parseSettings(env(version, { ...base, era: 'future', theme: 'dark' }));
      expect(s.gentle, `v${version}`).toBe(false);
      expect(s.notesSeen, `v${version}`).toBe('');
      expect(s.speed).toBe(4);
      expect(s.autoMode).toBe(true);
    }
    expect(parseSettings(env(4, { ...base, era: 'future', theme: 'dark' })).era).toBe('future');
    expect(parseSettings(env(4, { ...base, era: 'future', theme: 'dark' })).theme).toBe('dark');
  });

  it('v5가 저장되고(왕복) 켜진 gentle·본 버전이 유지된다', () => {
    const s = { ...DEFAULT_SETTINGS, gentle: true, notesSeen: '0.2.0' };
    expect(JSON.parse(serializeSettings(s)).version).toBe(5);
    expect(parseSettings(serializeSettings(s))).toEqual(s);
    expect(DEFAULT_SETTINGS.gentle, '기본 꺼짐 = 모든 장면 그대로').toBe(false);
    expect(DEFAULT_SETTINGS.notesSeen).toBe('');
  });

  it('이상한 값은 그 필드만 기본값으로 읽는다 — 다른 설정은 그대로 (gentle이 불리언이 아니면 꺼짐 · notesSeen이 x.y.z 꼴이 아니면 빈 글자)', () => {
    for (const bad of ['true', 1, 0, null, {}, [], 'on']) {
      const s = parseSettings(env(5, { ...base, gentle: bad }));
      expect(s.gentle, JSON.stringify(bad)).toBe(false);
      expect(s.speed).toBe(4);
    }
    for (const bad of [2, null, '', 'abc', '0.2', '0.2.0.1', '1.2.x', ' 0.2.0', '0.2.0\n', '99999.1.1', {}, []]) {
      const s = parseSettings(env(5, { ...base, gentle: true, notesSeen: bad }));
      expect(s.notesSeen, JSON.stringify(bad)).toBe('');
      expect(s.gentle, '다른 필드는 그대로').toBe(true);
    }
    expect(parseSettings(env(5, { ...base, notesSeen: '0.10.3' })).notesSeen).toBe('0.10.3');
  });
});

// ---------- 4. 세션 규칙 ----------

const send = (s: Session, a: SessionAction): Session => sessionReducer(s, a);

describe('세션: setGentle·gentleUsed (HV3) — 판 도중 한 번이라도 켜졌으면 참', () => {
  const lifeSession = (gentle = false): Session => createSession(startLife(11, 'present'), { ...DEFAULT_SETTINGS, noteCards: false, gentle });

  it('설정만 바꾼다: 같은 값이면 같은 객체, 이상한 입력은 무시', () => {
    const s = lifeSession();
    expect(send(s, { type: 'setGentle', on: false })).toBe(s);
    const on = send(s, { type: 'setGentle', on: true });
    expect(on.settings.gentle).toBe(true);
    expect(send(on, { type: 'setGentle', on: true }).game, '같은 값을 또 켜도 판 상태는 그대로').toBe(on.game);
    expect(send(s, { type: 'setGentle', on: 'yes' as unknown as boolean })).toBe(s);
  });

  it('진행 중인 판(인생)에서 켜면 gentleUsed가 참이 되고, 끄고 다시 켜도 참으로 남는다 (켜고 나서 꺼도 참)', () => {
    let s = lifeSession();
    expect(s.game.gentleUsed).toBeUndefined();
    s = send(s, { type: 'setGentle', on: true });
    expect(s.game.gentleUsed).toBe(true);
    s = send(s, { type: 'setGentle', on: false });
    expect(s.settings.gentle).toBe(false);
    expect(s.game.gentleUsed, '꺼도 참').toBe(true);
    s = send(s, { type: 'advance', fromAge: s.game.age });
    expect(s.game.gentleUsed, '진행해도 참').toBe(true);
  });

  it('켠 채 시작한 판(begin·beginNew)은 처음부터 참이고, 끈 채 시작한 판은 필드가 없다', () => {
    const t = (gentle: boolean) => createSession(createInitialState(9), { ...DEFAULT_SETTINGS, gentle });
    const on = send(t(true), { type: 'begin' });
    expect(on.game.phase).toBe('roulette');
    expect(on.game.gentleUsed).toBe(true);
    const off = send(t(false), { type: 'begin' });
    expect(Object.prototype.hasOwnProperty.call(off.game, 'gentleUsed')).toBe(false);
    // 첫 화면에서만 켰다 끈 뒤 시작: 판은 아직 시작 전이라 켠 판이 아니다
    let s = t(false);
    s = send(s, { type: 'setGentle', on: true });
    s = send(s, { type: 'setGentle', on: false });
    s = send(s, { type: 'begin' });
    expect(Object.prototype.hasOwnProperty.call(s.game, 'gentleUsed')).toBe(false);
    // 「새로 태어나기」(beginNew)도 설정을 따른다
    const reopened = send(send(createSession(startLife(11, 'present'), { ...DEFAULT_SETTINGS, gentle: true }), { type: 'openTitle' }), { type: 'beginNew', seed: 77 });
    expect(reopened.game.phase).toBe('roulette');
    expect(reopened.game.gentleUsed).toBe(true);
    const reopenedOff = send(send(createSession(startLife(11, 'present'), { ...DEFAULT_SETTINGS, gentle: false }), { type: 'openTitle' }), { type: 'beginNew', seed: 77 });
    expect(Object.prototype.hasOwnProperty.call(reopenedOff.game, 'gentleUsed')).toBe(false);
  });

  it('첫 화면을 다시 열어(나가기) 스위치를 바꿔도 같다: 「나가기 → 스위치 → 이어서 살기」가 판 도중 토글과 같은 결과다 (HV3 판 도중 바꾸는 자리)', () => {
    let s = lifeSession();
    s = send(s, { type: 'openTitle' });
    expect(s.showTitle).toBe(true);
    s = send(s, { type: 'setGentle', on: true });
    expect(s.game.gentleUsed).toBe(true);
    s = send(s, { type: 'resume' });
    expect(s.showTitle).toBe(false);
    expect(s.settings.gentle).toBe(true);
  });

  it('새 판(다시 태어나기)은 가림을 켠 기록 없이 시작한다 — 설정값은 다음 판의 기본값으로 남는다', () => {
    const end = { ...playToEnd(startLife(3, 'present'), null).state, gentleUsed: true };
    let s = createSession(end, { ...DEFAULT_SETTINGS, gentle: false });
    s = send(s, { type: 'rebirth', seed: 5 });
    expect(s.game.phase).toBe('title');
    expect(Object.prototype.hasOwnProperty.call(s.game, 'gentleUsed')).toBe(false);
    const onNext = send(createSession(end, { ...DEFAULT_SETTINGS, gentle: true }), { type: 'rebirth', seed: 5 });
    expect(onNext.settings.gentle, '설정은 다음 판의 기본값').toBe(true);
    expect(Object.prototype.hasOwnProperty.call(onNext.game, 'gentleUsed')).toBe(false);
  });
});

describe('세션: autoPick — 「이번에는 자동으로 고르기」 (HV4 ②)', () => {
  /** 본인이 고르는 중대 결정이 대기 중인 상태 (middle-layoff — 가린 카드의 예) */
  function pendingSession(autoMode: boolean): Session {
    for (let seed = 1; seed <= 600; seed++) {
      let s = createSession(startLife(seed, 'present'), { ...DEFAULT_SETTINGS, noteCards: false, autoMode });
      for (let guard = 0; guard < 400 && s.game.phase === 'life'; guard++) {
        if (s.game.pending !== null) {
          if (s.game.pending.eventId === 'middle-layoff') return s;
          s = send(s, { type: 'choose', key: s.game.pending.key, choiceId: s.game.pending.choiceIds[0] });
        } else s = send(s, { type: 'advance', fromAge: s.game.age });
      }
    }
    throw new Error('middle-layoff 대기 상태를 찾지 못했다');
  }

  it('자동 모드가 꺼져 있어도 지금의 자동 선택 성향으로 한 번 고른다 — 결과는 그 선택지를 수동으로 고른 것과 상태 전체가 같다 (R-039)', () => {
    const s = pendingSession(false);
    expect(s.settings.autoMode).toBe(false);
    const key = s.game.pending!.key;
    const w = autoChoiceWeights(s.game)!;
    const id = w.ids[createRng(s.game.rngState).weightedIndex(w.weights)];
    const picked = send(s, { type: 'autoPick', key });
    expect(picked.game.pending).toBeNull();
    // 같은 reducer 경로(기록 카드 처리 포함)로 그 선택지를 수동으로 고른 것과 같다
    const manual = send(s, { type: 'choose', key, choiceId: id }).game;
    expect(picked.game).toEqual(manual);
    // 그리고 코어의 선택 해결과도, 기록 카드 소비(seen 표시)를 뺀 모든 곳이 같다
    const core = resolveChoiceStep(s.game, key, id).state;
    expect({ ...picked.game, seen: core.seen }).toEqual(core);
    // 연표 줄은 보통 선택과 같은 꼴(by 없음 — 본인 줄)이고 고른 길이 남는다
    const line = picked.game.history.find((h) => h.eventId === 'middle-layoff' && h.kind === 'choice');
    expect(line?.by).toBeUndefined();
    expect(line?.choice).toBe(EVENT_POOL.byId.get('middle-layoff')!.choices!.find((c) => c.id === id)!.label);
  });

  it('자동 모드가 켜져 있어도, 일시정지 중에도 동작한다(사람이 누른 입력). 키가 다르면 같은 객체 — 연타·늦게 온 입력이 다음 카드를 고르지 못한다', () => {
    const s = pendingSession(true);
    const key = s.game.pending!.key;
    expect(send(s, { type: 'autoPick', key: `${key}-x` })).toBe(s);
    const paused = send(s, { type: 'setPaused', paused: true });
    expect(paused.game.paused).toBe(true);
    const picked = send(paused, { type: 'autoPick', key });
    expect(picked.game.pending).toBeNull();
    // 두 번째(같은 키)는 이미 처리돼 같은 객체
    expect(send(picked, { type: 'autoPick', key })).toBe(picked);
  });

  it('첫 화면을 다시 연 동안에는 무시한다 (인생이 흐르지 않는다)', () => {
    const s = send(pendingSession(false), { type: 'openTitle' });
    expect(s.showTitle).toBe(true);
    expect(send(s, { type: 'autoPick', key: s.game.pending!.key })).toBe(s);
  });
});

// ---------- 5. 같은 시드·같은 선택이면 켠 판과 끈 판의 상태 전체가 같다 ----------

/** 두 판 비교에서 뺀 필드: `gentleUsed`(정의상 켠 판에서만 참)와 플레이 시간 `play`(사람이 하는 동안 쌓이는 값 — R-474) */
function withoutFlagAndPlay(g: GameState): Omit<GameState, 'gentleUsed' | 'play'> {
  const rest: Partial<GameState> = { ...g };
  delete rest.gentleUsed;
  delete rest.play;
  return rest as Omit<GameState, 'gentleUsed' | 'play'>;
}

/**
 * 한 판을 끝까지 사람이 하듯(수동 선택 + 해마다 진행) 세션 reducer로 돌린다. `toggle`이 켜져 있으면 판 도중 가림 설정을 켜고 끈다:
 * 시작부터 켠 판, 도중에 켜는 판, 켰다 끄는 판이 섞이고, 절반은 「나가기 → 스위치 → 이어서 살기」 길(`openTitle`·`resume`)로 바꾼다.
 * **끈 판은 같은 행동 열에서 `setGentle`만 뺀 것**이다(나가기·이어서 살기 같은 다른 행동은 그대로 한다 — 일시정지가 저장되는 판 상태라 같이 해야 한다).
 * 선택은 두 판이 같은 난수열에서 고른다(같은 시점에 같은 선택).
 */
function driveLife(seed: number, era: Era, toggle: boolean): { game: GameState; settings: Session['settings']; everOn: boolean } {
  const plan = createRng((seed * 2654435761) >>> 0);
  const startOn = plan.next() < 0.34;
  const flips = new Set<number>();
  const n = Math.floor(plan.next() * 5);
  for (let i = 0; i < n; i++) flips.add(1 + Math.floor(plan.next() * 140));
  const viaTitle = new Set<number>([...flips].filter(() => plan.next() < 0.5));
  const chooseRng = createRng((seed ^ 0x5bd1e995) >>> 0);

  let s = createSession(createInitialState(seed), { ...DEFAULT_SETTINGS, era, noteCards: false, gentle: toggle && startOn });
  let everOn = toggle && startOn;
  for (const a of [{ type: 'begin' }, { type: 'finishSpin' }, { type: 'enterBirth' }, { type: 'enterLife' }] as SessionAction[]) s = send(s, a);
  for (let step = 1; s.game.phase === 'life' && step < 3000; step++) {
    if (flips.has(step)) {
      const next = !s.settings.gentle;
      if (viaTitle.has(step)) {
        s = send(s, { type: 'openTitle' });
        if (toggle) s = send(s, { type: 'setGentle', on: next });
        s = send(s, { type: 'resume' });
        s = send(s, { type: 'setPaused', paused: false });
      } else if (toggle) {
        s = send(s, { type: 'setGentle', on: next });
      }
      if (toggle && next) everOn = true;
    }
    if (s.game.pending !== null) {
      const ids = s.game.pending.choiceIds;
      s = send(s, { type: 'choose', key: s.game.pending.key, choiceId: chooseRng.pick(ids) });
    } else {
      s = send(s, { type: 'advance', fromAge: s.game.age });
    }
  }
  return { game: s.game, settings: s.settings, everOn };
}

describe('같은 시드·같은 선택이면 켠 판과 끈 판의 상태 전체가 같다 (HV4, 완료 기준 11) — 단 gentleUsed와 play는 비교에서 뺀다 (R-474)', () => {
  const LIVES = 1000;

  for (const era of ERAS) {
    it(`${era} 세상 ${LIVES}판: 판 도중 가림을 켜고 끄는 판의 최종 상태(연표·스탯·자산·플래그·난수 상태 포함)가 끈 판과 정확히 같고, gentleUsed는 한 번이라도 켠 판에서만 참이다`, () => {
      let withGentle = 0;
      let toggledMidway = 0;
      let mismatches = 0;
      const seedOffset = ERAS.indexOf(era) * 100000;
      for (let i = 1; i <= LIVES; i++) {
        const seed = seedOffset + i;
        const off = driveLife(seed, era, false);
        const on = driveLife(seed, era, true);
        expect(off.game.phase, `seed ${seed}: 끝까지 살았다`).toBe('ending');
        const a = JSON.stringify(withoutFlagAndPlay(off.game));
        const b = JSON.stringify(withoutFlagAndPlay(on.game));
        if (a !== b) {
          mismatches++;
          // 어긋나면 어디가 다른지 보이게 한 번만 깊게 비교한다
          if (mismatches === 1) expect(withoutFlagAndPlay(on.game), `seed ${seed}: 켠 판과 끈 판의 상태가 다르다`).toEqual(withoutFlagAndPlay(off.game));
        }
        // 설정도 gentle만 다를 수 있다
        expect({ ...on.settings, gentle: false }, `seed ${seed}`).toEqual({ ...off.settings, gentle: false });
        // gentleUsed: 끈 판에는 필드가 없고, 켠 판은 한 번이라도 켰으면 참(켜고 나서 꺼도 참)이다
        expect(Object.prototype.hasOwnProperty.call(off.game, 'gentleUsed'), `seed ${seed}: 끈 판`).toBe(false);
        expect(on.game.gentleUsed, `seed ${seed}: 켠 판`).toBe(on.everOn ? true : undefined);
        if (on.everOn) withGentle++;
        if (on.everOn && !on.settings.gentle) toggledMidway++;
      }
      expect(mismatches, '상태가 다른 판').toBe(0);
      // 표본이 공허하지 않다: 켠 판이 충분하고, 켰다 끄고 끝난 판도 있다
      expect(withGentle).toBeGreaterThan(LIVES * 0.3);
      expect(toggledMidway).toBeGreaterThan(0);
    }, 240_000);
  }

  it('대조(시험이 일을 하는지): 가림과 무관한 필드를 일부러 바꾸면 비교가 어긋난다 — gentleUsed·play만 비교에서 빠진다', () => {
    const a = driveLife(5, 'present', false).game;
    expect(withoutFlagAndPlay({ ...a, gentleUsed: true, play: undefined })).toEqual(withoutFlagAndPlay(a));
    expect(JSON.stringify(withoutFlagAndPlay({ ...a, rngState: a.rngState + 1 }))).not.toBe(JSON.stringify(withoutFlagAndPlay(a)));
    expect(JSON.stringify(withoutFlagAndPlay({ ...a, paused: !a.paused }))).not.toBe(JSON.stringify(withoutFlagAndPlay(a)));
  });
});

describe('풀 공유: 시험이 쓰는 이벤트 풀이 앱의 풀과 같다', () => {
  it('createEventPool(validateEventFiles(EVENT_FILES))가 EVENT_POOL과 같은 이벤트·표지를 만든다', () => {
    const rebuilt = createEventPool(validateEventFiles(EVENT_FILES));
    expect(rebuilt.events.length).toBe(EVENT_POOL.events.length);
    expect([...heavyEvents(rebuilt)]).toEqual([...heavyEvents(EVENT_POOL)]);
  });
});
