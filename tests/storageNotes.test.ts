import { describe, expect, it } from 'vitest';
import {
  CHARACTER_NAME_PATTERN,
  DEFAULT_SETTINGS,
  ERAS,
  GAME_KEY,
  GENDERS,
  HISTORY_KINDS,
  NOTE_LIMITS,
  SCHEMA_VERSION,
  SETTINGS_KEY,
  SETTINGS_VERSION,
  advanceUntilDecision,
  classifySavedGame,
  hasHiddenControl,
  loadGame,
  loadSettings,
  namePoolFor,
  notesOf,
  parseGame,
  parseSettings,
  playToEnd,
  saveGame,
  saveSettings,
  serializeGame,
  serializeSettings,
  surnameWeights,
  writeNote,
  type GameState,
  type StorageLike,
} from '../src/core';
import { ERA_CONFIG } from '../src/data/birthTable';
import { HISTORY_LIMITS } from '../src/data/lifeTable';
import { startLife } from '../scripts/simulateLib';

/**
 * 기록(note) 저장 (SPEC-003 M7c — docs/data/content-M7c.md 3-6·3-7절 H1~H6, T2 이름 한글 음절 화이트리스트, 설정 v3 → v4, 게임 스키마 v8 유지).
 * 핵심: 사용자가 쓴 글은 게임이 만든 글이 아니라서 `hasHiddenControl` 거부를 쓰지 않는다 — 이모지 하나(ZWJ)로 인생 전체가 날아가면 안 된다.
 */

const cp = (...codes: number[]): string => String.fromCodePoint(...codes);
const FAMILY = cp(0x1f468, 0x200d, 0x1f469, 0x200d, 0x1f467);
const FLAG_KR = cp(0x1f1f0, 0x1f1f7);
const THUMBS_TONE = cp(0x1f44d, 0x1f3fd);
const RLO = cp(0x202e);

function memoryStorage(): StorageLike & { map: Map<string, string> } {
  const map = new Map<string, string>();
  return { map, getItem: (k) => map.get(k) ?? null, setItem: (k, v) => void map.set(k, v), removeItem: (k) => void map.delete(k) };
}

/** 나이가 조금 든 유효한 인생 상태 */
const life = (): GameState => {
  const g = advanceUntilDecision(startLife(3, 'present')).state;
  return g.pending === null ? g : { ...g, pending: null, seen: Object.fromEntries(Object.entries(g.seen).filter(([k]) => k !== g.pending!.eventId)) };
};
const withNote = (g: GameState, text: string, extra: Partial<GameState['history'][number]> = {}): GameState => ({
  ...g,
  history: [...g.history, { age: g.age, kind: 'note', title: '지금의 생각', text, eventId: 'note-manual', ...extra }],
});
const json = (g: GameState): { version: number; data: Record<string, unknown> & { history: Array<Record<string, unknown>>; character: Record<string, unknown> } } =>
  JSON.parse(serializeGame(g)) as never;
const raw = (env: unknown): string => JSON.stringify(env);

describe('연표 종류에 note가 있다 (H1~H4)', () => {
  it('HISTORY_KINDS에 note가 더해졌고 게임 스키마는 v8 그대로다 (진행 중인 판을 잃지 않는다, NC-1)', () => {
    expect(HISTORY_KINDS).toEqual(['stage', 'event', 'choice', 'death', 'note']);
    expect(SCHEMA_VERSION).toBe(8);
    expect(json(life()).version).toBe(8);
  });

  it('H6 (a): 그림 문자·깃발·피부색·결합 문자·RTL 글을 담은 note 줄은 저장 → parseGame → 같은 글이다', () => {
    const texts = [FAMILY, `가${FLAG_KR}나${THUMBS_TONE}`, '한' + cp(0x301, 0x302), 'שלום עולם مرحبا', `1${cp(0xfe0f, 0x20e3)}`, '1\n2\n3 4', '<script>alert(1)</script> & "인용"'];
    for (const text of texts) {
      const g = withNote(life(), text);
      const loaded = parseGame(serializeGame(g));
      expect(loaded, JSON.stringify(text)).not.toBeNull();
      expect(loaded!.history.at(-1)!.text, JSON.stringify(text)).toBe(text);
      expect(loaded).toEqual(g);
    }
  });

  it('H6 (b): 같은 가족 그림 문자를 이름에 넣은 저장은 여전히 null이다 (이름·연표 글·사망 원인의 숨은 문자 거부는 그대로)', () => {
    const g = life();
    const env = json(g);
    env.data.character.name = `김${FAMILY}준`;
    expect(parseGame(raw(env))).toBeNull();
    // 연표 일반 줄·사망 원인의 숨은 문자 거부도 그대로
    const ev = json(withNote(g, '정상 글'));
    ev.data.history[0].text = `가${cp(0x200d)}나`;
    expect(parseGame(raw(ev)), '일반 줄의 ZWJ').toBeNull();
    const rlo = json(g);
    rlo.data.history[0].title = `제목${RLO}`;
    expect(parseGame(raw(rlo)), '일반 줄 title의 RLO').toBeNull();
    const ended = playToEnd(startLife(4, 'present')).state;
    const dead = JSON.parse(serializeGame(ended)) as { data: { death: { cause: string } } };
    dead.data.death.cause = `병${RLO}`;
    expect(parseGame(raw(dead)), '사망 원인의 RLO').toBeNull();
    expect(parseGame(serializeGame(ended))).not.toBeNull();
  });

  it('H6 (c): note 줄에 RLO(U+202E)를 직접 심은 저장은 null이 아니고 RLO만 없는 글이다 (거부하지 않고 걷는다, H3)', () => {
    const env = json(withNote(life(), 'x'));
    env.data.history.at(-1)!.text = `가${RLO}나${cp(0x200b)}다\x01${FAMILY}`;
    const loaded = parseGame(raw(env));
    expect(loaded).not.toBeNull();
    expect(loaded!.history.at(-1)!.text).toBe(`가나다${FAMILY}`);
    expect(hasHiddenControl(`가${RLO}`), 'hasHiddenControl 자체는 그대로다').toBe(true);
    expect(loadGame({ getItem: () => raw(env), setItem: () => undefined, removeItem: () => undefined })).not.toBeNull();
  });

  it('H6 (d): note 줄의 text가 문자열이 아니면 모양 위반이라 손상(null)이다 — 숫자·null·배열·객체·없음', () => {
    for (const bad of [7, null, ['a'], { a: 1 }, undefined, true]) {
      const env = json(withNote(life(), 'x'));
      if (bad === undefined) delete env.data.history.at(-1)!.text;
      else env.data.history.at(-1)!.text = bad;
      expect(parseGame(raw(env)), JSON.stringify(bad)).toBeNull();
    }
  });

  it('H6 (e)·H4: 20,000단위를 넘는 변조 값은 null이 아니고 그래핌 경계에서 자른다. 길이 140·400·3줄은 불러올 때 다시 자르지 않는다', () => {
    const env = json(withNote(life(), 'x'));
    env.data.history.at(-1)!.text = '가'.repeat(30_000);
    const huge = parseGame(raw(env));
    expect(huge).not.toBeNull();
    expect(huge!.history.at(-1)!.text).toBe('가'.repeat(NOTE_LIMITS.readUnits));
    // 다른 기기·다른 브라우저에서 쓴 정상 기록(길이 규칙이 다른 경우)이 잘리지 않는다
    const long = '가'.repeat(300) + '\n나\n다\n라\n마';
    expect(long.length).toBeGreaterThan(HISTORY_LIMITS.maxTextLength - 100);
    const g = withNote(life(), long);
    expect(parseGame(serializeGame(g))!.history.at(-1)!.text).toBe(long);
    const fam = FAMILY.repeat(120);
    expect(parseGame(serializeGame(withNote(life(), fam)))!.history.at(-1)!.text).toBe(fam);
  });

  it('걷고 나면 비는 note 줄은 그 줄만 버린다 (나머지 인생은 그대로) — 보이지 않는 글자·공백만 든 줄', () => {
    const base = withNote(withNote(life(), '남을 글'), 'tmp');
    const env = json(base);
    const rows = env.data.history;
    rows[rows.length - 1].text = `${cp(0x202e, 0x200b)}\x01  \n${cp(0x3164)}`;
    const loaded = parseGame(raw(env))!;
    expect(loaded).not.toBeNull();
    expect(notesOf(loaded).map((n) => n.text)).toEqual(['남을 글']);
    expect(loaded.history.length).toBe(base.history.length - 1);
  });

  it('H2: note 줄의 title(주제)·eventId(카드 id)는 게임이 만든 글이라 기존 검사를 그대로 받는다 — 숨은 문자·너무 긴 값은 null', () => {
    const env = json(withNote(life(), '글'));
    const row = () => env.data.history.at(-1)!;
    row().title = `주제${RLO}`;
    expect(parseGame(raw(env))).toBeNull();
    row().title = '지금의 생각';
    row().eventId = 'e'.repeat(49);
    expect(parseGame(raw(env))).toBeNull();
    row().eventId = 'note-manual';
    expect(parseGame(raw(env))).not.toBeNull();
    row().kind = 'memo';
    expect(parseGame(raw(env)), '알 수 없는 종류').toBeNull();
  });

  it('seen의 note- 키는 허용 범위 안이면 그대로 통과한다 (v8 저장이 새 규칙에서도 유효): 키 길이 48 · 나이 ≤ 현재 나이 · 개수', () => {
    const g = life();
    const seen = { ...g.seen, 'note-infant-memory': Math.min(5, g.age) };
    expect(parseGame(serializeGame({ ...g, seen }))!.seen['note-infant-memory']).toBe(Math.min(5, g.age));
    const env = json({ ...g, seen });
    (env.data.seen as Record<string, number>)['note-too-late'] = g.age + 1;
    expect(parseGame(raw(env)), '나이가 현재보다 크다').toBeNull();
  });

  it('엔딩에서도 note 줄이 새로고침을 넘어 남는다 (끝난 인생의 글은 다음 판을 시작할 때까지 남는다, P5)', () => {
    const ended = playToEnd(startLife(6, 'present')).state;
    const withRow = { ...ended, history: [...ended.history.slice(0, -1), { age: 20, kind: 'note' as const, title: '연애의 기억', text: `끝난 뒤에도 ${FAMILY}`, eventId: 'note-youth-romance' }, ended.history.at(-1)!] };
    const loaded = parseGame(serializeGame(withRow))!;
    expect(loaded.phase).toBe('ending');
    expect(notesOf(loaded)).toEqual([{ age: 20, cardId: 'note-youth-romance', text: `끝난 뒤에도 ${FAMILY}` }]);
    const st = memoryStorage();
    expect(saveGame(st, withRow)).toBe(true);
    expect(loadGame(st)).toEqual(withRow);
  });

  it('기록이 없는 v8 저장은 새 규칙에서도 그대로 이어진다 (진행 중인 판이 새 게임이 되지 않는다) — classifySavedGame도 valid', () => {
    const g = life();
    expect(g.history.some((h) => h.kind === 'note')).toBe(false);
    expect(Object.keys(g.seen).some((k) => k.startsWith('note-'))).toBe(false);
    expect(parseGame(serializeGame(g))).toEqual(g);
    expect(classifySavedGame(serializeGame(withNote(g, '글')))).toBe('valid');
  });

  it('writeNote가 만든 상태는 항상 저장 검증을 통과한다 (이모지·긴 글·여러 줄) — 쓰는 규칙과 읽는 규칙이 서로 맞는다', () => {
    let g = life();
    for (const text of [FAMILY.repeat(60), '가'.repeat(500), '1\n2\n3\n4\n5', `<b>${RLO}x${cp(0x200b)}</b>`, THUMBS_TONE + FLAG_KR, 'a' + cp(0x301).repeat(300)]) {
      g = writeNote(g, { cardId: null, text });
      expect(parseGame(serializeGame(g)), JSON.stringify(text.slice(0, 20))).toEqual(g);
    }
    expect(notesOf(g)).toHaveLength(6);
  });
});

describe('이름 한글 음절 화이트리스트 (T2·NC-13, QA-003-M7b A12d)', () => {
  it('(a) 이름 풀 전체가 통과한다: 세 시대의 모든 출생 연도 × 성별의 모든 이름 × 모든 성씨 조합', () => {
    const surnames = surnameWeights().map((s) => s.name);
    const given = new Set<string>();
    for (const era of ERAS) {
      const { min, max } = ERA_CONFIG[era].birthYears;
      for (let year = min; year <= max; year++) for (const gender of GENDERS) for (const n of namePoolFor(year, gender)) given.add(n);
    }
    expect(surnames.length).toBeGreaterThanOrEqual(10);
    expect(given.size).toBeGreaterThan(100);
    let checked = 0;
    for (const s of surnames) {
      for (const n of given) {
        expect(CHARACTER_NAME_PATTERN.test(s + n), `${s}${n}`).toBe(true);
        checked++;
      }
    }
    expect(checked).toBe(surnames.length * given.size);
  });

  it('(a-2) 실제로 출생한 인물의 이름이 든 저장이 통과한다 (세 시대 × 시드 60개)', () => {
    for (const era of ERAS) {
      for (let seed = 1; seed <= 60; seed++) {
        const g = startLife(seed, era);
        expect(parseGame(serializeGame(g)), `${era} ${seed} ${g.character!.name}`).not.toBeNull();
      }
    }
  });

  it('(b) 보이지 않는 글자만의 이름·빈 이름·공백·결합 문자만·방향 문자가 든 이름을 담은 저장은 null이다', () => {
    const bad: Array<[string, string]> = [
      ['U+3164 한글 채움 3개', cp(0x3164, 0x3164, 0x3164)],
      ['U+115F 초성 채움', cp(0x115f, 0x115f, 0x115f)],
      ['U+1160 중성 채움', cp(0x1160, 0x1160, 0x1160)],
      ['U+2060 단어 결합자', cp(0x2060, 0x2060, 0x2060)],
      ['U+FFA0 반각 채움', cp(0xffa0, 0xffa0, 0xffa0)],
      ['U+2800 점자 빈칸', cp(0x2800, 0x2800, 0x2800)],
      ['공백 단독', '   '],
      ['빈 문자열', ''],
      ['결합 문자만', cp(0x301, 0x302, 0x303)],
      ['U+061C 포함', `김${cp(0x61c)}민준`],
      ['제로폭 포함', `김${cp(0x200b)}민준`],
      ['한글 + 채움 글자', `김민${cp(0x3164)}`],
      ['두 글자', '김민'],
      ['너무 긴 한글', '가'.repeat(21)],
      ['영문', 'Alex Kim'],
      ['호환 자모', 'ㅎㅏㄴ'],
      ['한글 + 숫자', '김민준2'],
      ['한글 + 공백', '김 민준'],
      ['분리된 자모(NFD)', cp(0x1100, 0x1161, 0x1109, 0x1165, 0x11ab)],
    ];
    for (const [label, name] of bad) {
      const env = json(life());
      env.data.character.name = name;
      expect(parseGame(raw(env)), label).toBeNull();
    }
    // 대조: 같은 모양에서 이름만 정상으로 돌리면 통과한다(위 변조 때문에 거부된 것이다)
    const ok = json(life());
    ok.data.character.name = '김민준';
    expect(parseGame(raw(ok))).not.toBeNull();
  });

  it('(c) 기존 hasHiddenControl은 그대로다: 15개 문자를 잡고 일반 글자·가로 공백은 잡지 않는다', () => {
    for (const code of [0x200b, 0x200c, 0x200d, 0x200e, 0x200f, 0x202a, 0x202b, 0x202c, 0x202d, 0x202e, 0x2066, 0x2067, 0x2068, 0x2069, 0xfeff]) expect(hasHiddenControl(`가${cp(code)}나`), `U+${code.toString(16)}`).toBe(true);
    for (const code of [0x200a, 0x2010, 0x2029, 0x202f, 0x2065, 0x206a, 0xfefe, 0x20, 0xa0, 0x3000, 0x3164, 0x61c]) expect(hasHiddenControl(`가${cp(code)}나`), `U+${code.toString(16)}`).toBe(false);
  });

  it('패턴은 한글 음절 3~5자이다 (성 1~2자 + 이름 2~3자)', () => {
    expect(CHARACTER_NAME_PATTERN.source).toBe('^[가-힣]{3,5}$');
    for (const n of ['김민준', '남궁민준', '황보민준이']) expect(CHARACTER_NAME_PATTERN.test(n), n).toBe(true);
    for (const n of ['김민', '김민준이름이', '', ' 김민준', '김민준\n']) expect(CHARACTER_NAME_PATTERN.test(n), JSON.stringify(n)).toBe(false);
  });
});

describe('설정 v3 → v4: noteCards (FR7)', () => {
  it('현재 설정 버전은 5(v4에서 noteCards, v5에서 gentle·notesSeen이 더해졌다 — SPEC-005 QI6·QI7)이고 기본값은 noteCards 켜짐이다', () => {
    expect(SETTINGS_VERSION).toBe(5);
    expect(DEFAULT_SETTINGS.noteCards).toBe(true);
    expect(JSON.parse(serializeSettings(DEFAULT_SETTINGS))).toEqual({ version: 5, data: { ...DEFAULT_SETTINGS, noteCards: true } });
  });

  it('v1·v2·v3 설정은 그대로 읽고 noteCards는 기본값(켜짐)으로 채운다 — 이미 고른 값(배속·세상·BGM·테마)을 잃지 않는다', () => {
    const v3 = { speed: 4, autoMode: true, era: 'future', lifeLength: 'short30', bgm: { on: true, volume: 55 }, theme: 'dark' };
    for (const version of [1, 2, 3]) {
      const read = parseSettings(JSON.stringify({ version, data: version === 3 ? v3 : { speed: 4, autoMode: true } }));
      expect(read.noteCards, `v${version}`).toBe(true);
      expect(read.speed).toBe(4);
      expect(read.autoMode).toBe(true);
    }
    expect(parseSettings(JSON.stringify({ version: 3, data: v3 }))).toEqual({ ...v3, noteCards: true, gentle: false, notesSeen: '' }); // v5의 새 필드 둘도 기본값으로 채워진다
  });

  it('v4: noteCards 켬/끔이 저장·복원된다. 불리언이 아니면 그 필드만 기본값(켜짐)이고 다른 설정은 그대로다', () => {
    const st = memoryStorage();
    saveSettings(st, { ...DEFAULT_SETTINGS, noteCards: false, speed: 2 });
    expect(loadSettings(st)).toEqual({ ...DEFAULT_SETTINGS, noteCards: false, speed: 2 });
    expect(JSON.parse(st.map.get(SETTINGS_KEY)!).version).toBe(5); // 저장은 현재 버전(5)으로 쓴다 — v4 봉투도 아래에서 그대로 읽힌다
    const read = (noteCards: unknown) => parseSettings(JSON.stringify({ version: 4, data: { speed: 2, autoMode: false, theme: 'dark', noteCards } }));
    for (const bad of ['no', 0, 1, null, {}, []]) {
      const r = read(bad);
      expect(r.noteCards, JSON.stringify(bad)).toBe(true);
      expect(r.theme).toBe('dark');
      expect(r.speed).toBe(2);
    }
    expect(read(false).noteCards).toBe(false);
  });

  it('모르는 버전(6)은 기본값이다. 게임 저장과 설정은 따로다 (설정을 읽는 일이 게임 저장 키를 건드리지 않는다)', () => {
    // 설정 v5(SPEC-005 QI6·QI7)부터 5는 읽을 수 있는 버전이라, 아직 없는 다음 버전 6으로 올렸다 — 경계(읽을 수 없는 첫 버전)를 보는 시험의 뜻은 그대로다
    expect(parseSettings(JSON.stringify({ version: 6, data: { speed: 2, autoMode: true, noteCards: false } }))).toEqual(DEFAULT_SETTINGS);
    expect(GAME_KEY).not.toBe(SETTINGS_KEY);
  });
});
