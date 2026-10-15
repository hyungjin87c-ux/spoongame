import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SETTINGS,
  clearGame,
  GAME_KEY,
  PHASES,
  SCHEMA_VERSION,
  SETTINGS_VERSION,
  SETTINGS_KEY,
  createInitialState,
  decideSave,
  getBrowserStorage,
  isSupersedingChange,
  isTitleSave,
  loadGame,
  loadSettings,
  parseGame,
  parseSettings,
  saveGame,
  saveSettings,
  serializeGame,
  startGame,
  type GameState,
  type StorageLike,
} from '../src/core';

function memoryStorage(): StorageLike & { map: Map<string, string> } {
  const map = new Map<string, string>();
  return {
    map,
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
    removeItem: (k) => void map.delete(k),
  };
}

const throwing: StorageLike = {
  getItem() {
    throw new Error('denied');
  },
  setItem() {
    throw new Error('quota');
  },
  removeItem() {
    throw new Error('denied');
  },
};

function richState(): GameState {
  return {
    ...createInitialState(2024),
    phase: 'life',
    era: 'present',
    character: {
      name: '김서연',
      gender: 'female',
      birthYear: 2012, // 지금 세상 출생 연도 범위(2008~2025) 안
      parentWealth: 3,
      parenting: 'helicopter',
      looks: 71,
    },
    stats: { wealth: 10, education: 20, health: 30, happiness: 40, relationships: 50 },
    birthStats: { wealth: 45, education: 6, health: 70, happiness: 52, relationships: 56 },
    age: 17,
    history: [{ age: 7, kind: 'stage', text: '학교에 들어갈 나이가 되었다.' }],
    flags: ['college'],
    seen: { 'school-friend': 10 },
  };
}

describe('초기 상태', () => {
  it('타이틀 단계, 빈 캐릭터·연표, 시드가 RNG 상태로 들어간다', () => {
    const s = createInitialState(77);
    expect(s.phase).toBe('title');
    expect(s.era).toBeNull();
    expect(s.character).toBeNull();
    expect(s.age).toBe(0);
    expect(s.history).toEqual([]);
    expect(s.seed).toBe(77);
    expect(s.rngState).toBe(77);
    expect(PHASES).toContain(s.phase);
  });

  it('시작하면 시대 선택 단계로 간다', () => {
    expect(startGame(createInitialState(1)).phase).toBe('eraSelect');
  });
});

describe('직렬화 왕복', () => {
  it('초기 상태와 풍부한 상태 모두 동일하게 복원', () => {
    for (const s of [createInitialState(5), richState()]) {
      expect(parseGame(serializeGame(s))).toEqual(s);
    }
  });

  it('saveGame → loadGame 왕복', () => {
    const st = memoryStorage();
    expect(saveGame(st, richState())).toBe(true);
    expect(loadGame(st)).toEqual(richState());
  });

  it('저장 데이터에 스키마 버전이 들어간다', () => {
    expect(JSON.parse(serializeGame(createInitialState(1))).version).toBe(SCHEMA_VERSION);
  });
});

describe('손상 데이터 복구', () => {
  const bad: Record<string, string> = {
    '깨진 JSON': '{"version":1,"data":{',
    '빈 문자열': '',
    '버전 불일치': JSON.stringify({ version: 999, data: createInitialState(1) }),
    '버전 없음': JSON.stringify({ data: createInitialState(1) }),
    '형태 오류(data가 문자열)': JSON.stringify({ version: SCHEMA_VERSION, data: 'x' }),
    '형태 오류(필드 누락)': JSON.stringify({ version: SCHEMA_VERSION, data: { phase: 'life' } }),
    '형태 오류(잘못된 phase)': JSON.stringify({
      version: SCHEMA_VERSION,
      data: { ...createInitialState(1), phase: 'hacked' },
    }),
    '형태 오류(rngState가 문자열)': JSON.stringify({
      version: SCHEMA_VERSION,
      data: { ...createInitialState(1), rngState: 'abc' },
    }),
    'null': 'null',
    '배열': '[]',
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  type Doc = Record<string, any>;
  const withData = (patch: (d: Doc) => void): string => {
    const d = JSON.parse(JSON.stringify(richState())) as Doc;
    patch(d);
    return JSON.stringify({ version: SCHEMA_VERSION, data: d });
  };
  Object.assign(bad, {
    // R-001 필드 간 정합성
    '정합성: life인데 character null': withData((d) => (d.character = null)),
    '정합성: life인데 era null': withData((d) => (d.era = null)),
    '정합성: life인데 birthStats null': withData((d) => (d.birthStats = null)),
    '정합성: birth인데 character null': withData((d) => {
      d.phase = 'birth';
      d.age = 0;
      d.character = null;
    }),
    '정합성: ending인데 character null': withData((d) => {
      d.phase = 'ending';
      d.character = null;
    }),
    '정합성: title인데 character 있음': withData((d) => (d.phase = 'title')),
    '정합성: eraSelect인데 birthStats 있음': withData((d) => {
      d.phase = 'eraSelect';
      d.character = null;
    }),
    '정합성: 출생연도가 시대 범위 밖': withData((d) => (d.era = 'past')),
    '정합성: birth 단계인데 age != 0': withData((d) => (d.phase = 'birth')),
    // validCharacter 거부 분기
    'character: name 빈 문자열': withData((d) => (d.character.name = '')),
    'character: name 숫자': withData((d) => (d.character.name = 7)),
    'character: name 너무 김': withData((d) => (d.character.name = '가'.repeat(21))),
    'character: gender 이상값': withData((d) => (d.character.gender = 'x')),
    'character: birthYear 소수': withData((d) => (d.character.birthYear = 2012.5)),
    'character: birthYear 문자열': withData((d) => (d.character.birthYear = '2012')),
    'character: parentWealth 0': withData((d) => (d.character.parentWealth = 0)),
    'character: parentWealth 6': withData((d) => (d.character.parentWealth = 6)),
    'character: parentWealth 문자열': withData((d) => (d.character.parentWealth = '3')),
    'character: parenting 이상값': withData((d) => (d.character.parenting = 'wild')),
    'character: 구 필드명 education만 있음': withData((d) => {
      d.character.education = d.character.parenting;
      delete d.character.parenting;
    }),
    'character: looks 음수': withData((d) => (d.character.looks = -1)),
    'character: looks 101': withData((d) => (d.character.looks = 101)),
    'character: looks 소수': withData((d) => (d.character.looks = 50.5)),
    'character: 배열': withData((d) => (d.character = [])),
    // stats
    'stats: 필드 누락': withData((d) => delete d.stats.health),
    'stats: 값이 null(NaN 직렬화)': withData((d) => (d.stats.wealth = null)),
    'stats: 값이 문자열': withData((d) => (d.stats.happiness = '40')),
    'birthStats: 형태 오류': withData((d) => (d.birthStats = { wealth: 1 })),
    // age 경계
    'age: 음수': withData((d) => (d.age = -1)),
    'age: 151': withData((d) => (d.age = 151)),
    'age: 소수': withData((d) => (d.age = 1.5)),
    'age: 문자열': withData((d) => (d.age = '17')),
    // history
    'history: 배열 아님': withData((d) => (d.history = {})),
    'history: 항목 age 문자열': withData((d) => (d.history = [{ age: '7', kind: 'event', text: 'x' }])),
    'history: 항목 text 숫자': withData((d) => (d.history = [{ age: 7, kind: 'event', text: 1 }])),
    'history: 항목 age 범위 밖': withData((d) => (d.history = [{ age: 200, kind: 'event', text: 'x' }])),
    'history: 항목이 null': withData((d) => (d.history = [null])),
    // seed / rngState 경계
    'seed: 음수': withData((d) => (d.seed = -1)),
    'seed: 2^32': withData((d) => (d.seed = 4294967296)),
    'seed: 소수': withData((d) => (d.seed = 1.5)),
    'seed: 문자열': withData((d) => (d.seed = '1')),
    'rngState: 음수': withData((d) => (d.rngState = -5)),
    'rngState: 2^32': withData((d) => (d.rngState = 4294967296)),
    'rngState: 소수': withData((d) => (d.rngState = 0.5)),
    'rngState: null': withData((d) => (d.rngState = null)),
    // R-012: 지금 세상 출생 연도 범위가 1990~2025 → 2008~2025로 바뀌었다
    '정합성: 지금 세상인데 2007년생(새 범위 밖)': withData((d) => (d.character.birthYear = 2007)),
    '정합성: 지금 세상인데 1995년생(구 범위에서는 유효)': withData((d) => (d.character.birthYear = 1995)),
    '정합성: 지금 세상인데 2026년생': withData((d) => (d.character.birthYear = 2026)),
    '정합성: 지난 세상인데 1990년생': withData((d) => {
      d.era = 'past';
      d.character.birthYear = 1990;
    }),
    '정합성: 다가올 세상인데 2029년생': withData((d) => {
      d.era = 'future';
      d.character.birthYear = 2029;
    }),
    '정합성: 다가올 세상인데 2061년생': withData((d) => {
      d.era = 'future';
      d.character.birthYear = 2061;
    }),
    // 구 스키마(v2) — 구 범위(1990~2025)에서는 유효했던 저장도 새 게임으로 시작한다
    'v2 저장(지금 세상 1995년생, 구 범위에서는 유효)': JSON.stringify({
      version: 2,
      data: { ...richState(), character: { ...richState().character, birthYear: 1995 } },
    }),
    'v2 저장(2012년생, 형태는 현행과 같음)': JSON.stringify({ version: 2, data: richState() }),
    // 구 스키마(v1) 흔적
    'v1 저장(recentRolls)': JSON.stringify({ version: 1, data: { ...createInitialState(1), recentRolls: [] } }),
  });

  for (const [name, raw] of Object.entries(bad)) {
    it(`${name} → 새 게임(null)`, () => {
      const st = memoryStorage();
      st.map.set(GAME_KEY, raw);
      expect(loadGame(st)).toBeNull();
    });
  }

  it('경계값은 통과: age 105(지금 세상 상한), seed·rngState 0 / 2^32-1, looks 0·100, 연표 비어 있음', () => {
    const patches: Array<(d: Doc) => void> = [
      (d) => (d.age = 105),
      (d) => {
        d.seed = 0;
        d.rngState = 0;
      },
      (d) => {
        d.seed = 4294967295;
        d.rngState = 4294967295;
      },
      (d) => (d.character.looks = 0),
      (d) => (d.character.looks = 100),
      (d) => (d.history = []),
    ];
    for (const patch of patches) {
      const st = memoryStorage();
      st.map.set(GAME_KEY, withData(patch));
      expect(loadGame(st)).not.toBeNull();
    }
  });

  it('시대별 출생 연도 경계는 통과: 지난 1950·1989 / 지금 2008·2025 / 다가올 2030·2060 (R-012)', () => {
    const cases: Array<[string, number]> = [
      ['past', 1950],
      ['past', 1989],
      ['present', 2008],
      ['present', 2025],
      ['future', 2030],
      ['future', 2060],
    ];
    for (const [era, year] of cases) {
      const st = memoryStorage();
      st.map.set(
        GAME_KEY,
        withData((d) => {
          d.era = era;
          d.character.birthYear = year;
        }),
      );
      expect(loadGame(st), `${era} ${year}`).not.toBeNull();
    }
  });

  it('스키마 버전은 4이다 (3: 지금 세상 출생 연도 범위 변경 R-012 / 4: 인생 진행 필드 추가 R-008)', () => {
    expect(SCHEMA_VERSION).toBe(4);
    expect(JSON.parse(serializeGame(richState())).version).toBe(4);
  });

  it('title/eraSelect 상태(캐릭터 없음, era는 null 또는 선택값)는 통과', () => {
    for (const phase of ['title', 'eraSelect'] as const) {
      const s: GameState = { ...createInitialState(3), phase, era: phase === 'title' ? null : 'future' };
      expect(parseGame(serializeGame(s))).toEqual(s);
    }
  });

  it('clearGame은 게임 저장만 지우고 설정은 남긴다', () => {
    const st = memoryStorage();
    saveGame(st, richState());
    saveSettings(st, { speed: 8, autoMode: true });
    expect(clearGame(st)).toBe(true);
    expect(loadGame(st)).toBeNull();
    expect(loadSettings(st)).toEqual({ speed: 8, autoMode: true });
    expect(clearGame(null)).toBe(false);
    expect(clearGame(throwing)).toBe(false);
  });

  it('저장값이 없으면 null', () => {
    expect(loadGame(memoryStorage())).toBeNull();
  });
});

describe('localStorage 접근 불가', () => {
  it('저장소가 없거나(null) 예외를 던져도 죽지 않는다', () => {
    expect(loadGame(null)).toBeNull();
    expect(saveGame(null, createInitialState(1))).toBe(false);
    expect(loadGame(throwing)).toBeNull();
    expect(saveGame(throwing, createInitialState(1))).toBe(false);
    expect(loadSettings(throwing)).toEqual(DEFAULT_SETTINGS);
    expect(saveSettings(throwing, DEFAULT_SETTINGS)).toBe(false);
  });

  it('window가 없는 환경에서 getBrowserStorage는 null', () => {
    expect(getBrowserStorage()).toBeNull();
  });
});

describe('설정은 게임과 독립', () => {
  it('설정 키와 게임 키가 다르다', () => {
    expect(SETTINGS_KEY).not.toBe(GAME_KEY);
  });

  it('기본값: 1배속, 자동 꺼짐', () => {
    expect(loadSettings(memoryStorage())).toEqual({ speed: 1, autoMode: false });
  });

  it('설정 저장 왕복', () => {
    const st = memoryStorage();
    saveSettings(st, { speed: 8, autoMode: true });
    expect(loadSettings(st)).toEqual({ speed: 8, autoMode: true });
  });

  it('게임을 리셋/삭제/손상시켜도 설정은 유지', () => {
    const st = memoryStorage();
    saveSettings(st, { speed: 4, autoMode: false });
    saveGame(st, richState());
    // 새 판(리셋)
    saveGame(st, createInitialState(123));
    expect(loadSettings(st)).toEqual({ speed: 4, autoMode: false });
    // 게임 저장이 손상돼도
    st.map.set(GAME_KEY, '###');
    expect(loadGame(st)).toBeNull();
    expect(loadSettings(st)).toEqual({ speed: 4, autoMode: false });
  });

  it('손상된 설정은 기본값, 게임에는 영향 없음', () => {
    const st = memoryStorage();
    saveGame(st, richState());
    for (const raw of ['{{', JSON.stringify({ version: SETTINGS_VERSION, data: { speed: 3, autoMode: false } }), JSON.stringify({ version: 2, data: { speed: 2, autoMode: true } })]) {
      st.map.set(SETTINGS_KEY, raw);
      expect(loadSettings(st)).toEqual(DEFAULT_SETTINGS);
    }
    expect(loadGame(st)).toEqual(richState());
  });
});

/**
 * R-052: 저장 effect가 쓰기 직전에 하는 판단. stored = 지금 저장소, known = 이 탭이 마지막으로 읽거나 쓴 값, next = 지금 상태를 직렬화한 값.
 * 표는 사람이 적은 기대값이다. 실제 화면 동작(밀린 화면·실패 안내 지움)은 e2e/robust.spec.ts가 본다.
 */
describe('decideSave: 쓰기 직전 판단 (R-052)', () => {
  // 세 값은 모두 진행이 있는 상태(시대 선택)다. 진행 없는 타이틀끼리는 충돌로 보지 않는다(A66, 아래 블록) — 이 블록은 진행이 있는 쪽의 충돌 감지가 그대로임을 지킨다.
  const A = serializeGame(startGame(createInitialState(1))); // 이 탭이 아는 값
  const B = serializeGame(startGame(createInitialState(2))); // 다른 탭이 쓴 값
  const C = serializeGame(startGame(createInitialState(3))); // 이 탭의 지금 상태

  it('내가 아는 값 그대로인 저장소에 새 상태를 쓴다 (진행)', () => {
    expect(decideSave(A, A, C)).toBe('write');
  });

  it('빈 저장소(첫 실행)와 손상된 저장 원문도 내가 읽은 그대로라면 쓴다 (복구)', () => {
    expect(decideSave(null, null, C)).toBe('write');
    expect(decideSave('###', '###', C)).toBe('write');
  });

  it('저장소가 이미 지금 상태 그대로면 쓰지 않는다 (새 탭의 마운트 직후, 이어하기 직후)', () => {
    expect(decideSave(A, A, A)).toBe('unchanged');
  });

  it('저장소가 내가 아는 값과 다르고 내 상태와도 다르면 다른 탭이 바꾼 것이다 — 덮어쓰지 않는다 (리스너를 붙이기 전의 변경 포함)', () => {
    expect(decideSave(B, A, C)).toBe('conflict');
    expect(decideSave(B, null, C)).toBe('conflict'); // 빈 저장소를 읽은 뒤 다른 탭이 먼저 썼다
    expect(decideSave(null, A, C)).toBe('conflict'); // 읽은 뒤 저장이 지워졌다
  });

  it('저장소가 내가 아는 값과 달라도 마침 내 상태와 같으면 쓸 것이 없다 (다른 탭이 같은 값을 썼다)', () => {
    expect(decideSave(C, A, C)).toBe('unchanged');
  });

  it('판단은 서로 다른 세 값의 모든 관계에서 정해진 하나다: 같음/다름 8가지 조합 표', () => {
    // [stored===known, stored===next, known===next] → 결과. (known===next이면서 stored가 그 둘과 다른 경우는 stored!==known이 되어 conflict)
    expect(decideSave(A, A, A)).toBe('unchanged'); // 셋 다 같음
    expect(decideSave(A, A, C)).toBe('write'); // stored=known≠next
    expect(decideSave(C, A, C)).toBe('unchanged'); // stored=next≠known
    expect(decideSave(B, A, A)).toBe('conflict'); // known=next≠stored (내 상태는 그대로인데 저장소만 바뀜: 다른 탭의 진행을 되돌리지 않는다)
    expect(decideSave(B, A, C)).toBe('conflict'); // 셋 다 다름
  });

  it('parseGame/parseSettings: 같은 원문에서 상태와 설정을 파싱한다 (앱은 원문을 한 번만 읽어 이 둘과 기준값에 함께 쓴다, R-052)', () => {
    const raw = serializeGame(createInitialState(7));
    expect(parseGame(raw)).toEqual(createInitialState(7));
    expect(parseGame(null)).toBeNull();
    expect(parseGame('###')).toBeNull();
    expect(parseSettings(null)).toEqual(DEFAULT_SETTINGS);
    expect(parseSettings('###')).toEqual(DEFAULT_SETTINGS);
  });
});

/**
 * A66 (QA-001-M3): 빈 저장소에서 두 탭을 동시에 열면 둘 다 "비어 있음"을 읽고 각자의 새 게임(타이틀)을 첫 저장으로 쓰는데,
 * 서로의 첫 저장을 "다른 탭의 변경"으로 받아들여 12번 중 12번 두 탭이 모두 밀렸다. 잃을 진행이 없는 첫 저장끼리는 충돌로 보지 않는다.
 * 진행이 있는 쪽의 충돌 감지는 약화하지 않는다 — 아래에서 함께 단언한다.
 */
describe('A66: 잃을 진행이 없는 첫 저장은 충돌이 아니다 (진행이 있는 충돌 감지는 그대로)', () => {
  const T1 = serializeGame(createInitialState(1)); // 타이틀(진행 없음)
  const T2 = serializeGame(createInitialState(2));
  const T3 = serializeGame(createInitialState(3));
  const P1 = serializeGame(startGame(createInitialState(1))); // 시대 선택(진행 있음)
  const P2 = serializeGame(startGame(createInitialState(2)));
  const L = serializeGame(richState()); // 인생 진행 중

  it('빈 저장소를 읽은 두 탭: 먼저 쓴 탭의 타이틀이 저장소에 있어도 나중 탭은 자기 타이틀을 쓴다 (밀리지 않는다)', () => {
    expect(decideSave(T2, null, T1)).toBe('write');
    expect(decideSave(T2, T1, T1)).toBe('write'); // 이 탭이 아는 값이 타이틀이어도 마찬가지
  });

  it('이 탭이 시작을 눌러 진행한 첫 저장(시대 선택)도, 저장소에 다른 탭의 타이틀뿐이면 쓴다', () => {
    expect(decideSave(T2, null, P1)).toBe('write');
    expect(decideSave(T2, T1, P1)).toBe('write');
  });

  it('손상 저장을 읽어 새 게임이 된 탭 두 개도 같다 (잃을 진행이 이미 없다)', () => {
    expect(decideSave(T2, '###', T1)).toBe('write');
  });

  it('약화하지 않았다 (1): 저장소에 다른 탭의 진행(시대 선택 이후)이 있으면 이 탭이 비었든 타이틀이든 충돌이다', () => {
    expect(decideSave(P2, null, T1)).toBe('conflict');
    expect(decideSave(P2, T1, T3)).toBe('conflict');
    expect(decideSave(P2, T1, P1)).toBe('conflict');
    expect(decideSave(L, null, T1)).toBe('conflict');
    expect(decideSave(L, T1, P1)).toBe('conflict');
  });

  it('약화하지 않았다 (2): 이 탭이 이미 진행했다면(아는 값이 진행 있는 저장) 저장소가 타이틀로 바뀌어도 충돌이다 — 다른 탭이 되돌린 진행을 덮어쓰지 않는다', () => {
    expect(decideSave(T2, P1, P1)).toBe('conflict');
    expect(decideSave(T2, L, L)).toBe('conflict');
    expect(decideSave(T2, P1, T3)).toBe('conflict');
  });

  it('약화하지 않았다 (3): 저장이 지워졌거나(null) 읽을 수 없게 됐으면(손상) 아는 값이 타이틀이어도 전처럼 충돌이다', () => {
    expect(decideSave(null, T1, T3)).toBe('conflict');
    expect(decideSave('###', T1, T3)).toBe('conflict');
    expect(decideSave('###', null, T3)).toBe('conflict');
  });

  it('쓸 것이 없는(unchanged) 판단이 가장 먼저다: 저장소가 이미 지금 상태 그대로면 어떤 경우든 쓰지 않는다', () => {
    expect(decideSave(T1, null, T1)).toBe('unchanged');
    expect(decideSave(P1, T2, P1)).toBe('unchanged');
  });

  it('isTitleSave: 유효한 타이틀 저장만 true (진행 있는 저장·손상·빈 저장소·구 버전은 false)', () => {
    expect(isTitleSave(T1)).toBe(true);
    expect(isTitleSave(P1)).toBe(false);
    expect(isTitleSave(L)).toBe(false);
    expect(isTitleSave(null)).toBe(false);
    expect(isTitleSave('###')).toBe(false);
    expect(isTitleSave(JSON.stringify({ version: SCHEMA_VERSION - 1, data: createInitialState(1) }))).toBe(false);
  });

  it('isSupersedingChange (storage 이벤트): 둘 다 잃을 진행이 없는 타이틀이면 밀지 않고, 그 밖에는 전처럼 민다', () => {
    expect(isSupersedingChange(T2, null)).toBe(false); // 내가 아는 값이 비어 있고 다른 탭이 타이틀을 썼다
    expect(isSupersedingChange(T2, T1)).toBe(false);
    expect(isSupersedingChange(T2, '###')).toBe(false);
    expect(isSupersedingChange(P2, null)).toBe(true); // 다른 탭이 진행했다
    expect(isSupersedingChange(P2, T1)).toBe(true);
    expect(isSupersedingChange(L, T1)).toBe(true);
    expect(isSupersedingChange(T2, P1)).toBe(true); // 이 탭이 진행했는데 저장소가 타이틀로 바뀌었다
    expect(isSupersedingChange(T2, L)).toBe(true);
    expect(isSupersedingChange(null, T1)).toBe(true); // 저장이 지워졌다
    expect(isSupersedingChange('###', null)).toBe(true); // 손상된 값이 들어왔다
  });
});
