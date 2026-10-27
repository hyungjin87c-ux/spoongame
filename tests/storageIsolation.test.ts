import { describe, expect, it } from 'vitest';
import {
  DEFAULT_BGM,
  DEFAULT_SETTINGS,
  GAME_KEY,
  SETTINGS_KEY,
  clearGame,
  createInitialState,
  loadGame,
  loadSettings,
  saveGame,
  saveSettings,
  type StorageLike,
} from '../src/core';
import { startLife } from '../scripts/simulateLib';

/**
 * 같은 계정의 다른 GitHub Pages와 localStorage 키가 충돌하지 않는다 (SPEC-003 DP4 「남은 것」).
 * GitHub Pages는 한 계정의 모든 프로젝트 사이트가 한 출처(`https://<계정>.github.io`)를 쓰므로 localStorage도 하나를 같이 쓴다(경로가 달라도 같은 저장소다).
 * 그래서 (1) 이 앱이 쓰는 키는 모두 `suzeo-game:` 접두어를 갖고, (2) 이 앱은 자기 키만 읽고 쓰고 지우며(전체 지우기·열거 없음), (3) 다른 프로젝트가 쓰는 키(접두어가 없거나 비슷한 이름 포함)는 한 글자도 건드리지 않는다.
 * 실제 브라우저에서 같은 일을 보는 e2e는 e2e/storage-isolation.spec.ts.
 */

const PREFIX = 'suzeo-game:';

/** 호출 기록을 남기는 가짜 저장소 */
function recorder(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  const log: Array<{ op: 'get' | 'set' | 'remove'; key: string }> = [];
  const storage: StorageLike = {
    getItem: (key) => {
      log.push({ op: 'get', key });
      return data.get(key) ?? null;
    },
    setItem: (key, value) => {
      log.push({ op: 'set', key });
      data.set(key, value);
    },
    removeItem: (key) => {
      log.push({ op: 'remove', key });
      data.delete(key);
    },
  };
  return { storage, data, log };
}

/** 다른 프로젝트가 같은 출처에 둘 법한 키들 — 접두어가 없는 것, 비슷한 것, 대소문자만 다른 것, 우리 키 이름에 덧붙은 것 */
const FOREIGN: Record<string, string> = {
  save: '{"version":7,"data":{"phase":"title"}}',
  settings: '{"version":3,"data":{"speed":8}}',
  theme: 'dark',
  'other-game:save': '{"x":1}',
  'suzeo-game': 'no-colon',
  'suzeo:save': 'close-prefix',
  'Suzeo-Game:save': 'case-differs',
  'suzeo-game2:save': 'longer-prefix-name',
  'suzeo-game:save2': 'our-prefix-but-not-our-key',
  'suzeo-game:settings-old': 'ours-prefixed-neighbour',
  '': 'empty-key',
};

describe('키 이름', () => {
  it('이 앱의 키는 모두 「suzeo-game:」 접두어를 갖고, 서로 다르다', () => {
    expect(GAME_KEY.startsWith(PREFIX)).toBe(true);
    expect(SETTINGS_KEY.startsWith(PREFIX)).toBe(true);
    expect(GAME_KEY).not.toBe(SETTINGS_KEY);
    expect(GAME_KEY).toBe('suzeo-game:save');
    expect(SETTINGS_KEY).toBe('suzeo-game:settings');
  });

  it('소스 점검: 저장소를 직접 다루는 곳은 core/storage.ts 하나뿐이고, 키는 상수(GAME_KEY·SETTINGS_KEY)뿐이며, 전체 지우기·열거·쿠키·IndexedDB가 없다', () => {
    const files = import.meta.glob('../src/**/*.{ts,tsx}', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;
    const names = Object.keys(files);
    expect(names.length).toBeGreaterThan(50);
    const strip = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
    const users: string[] = [];
    for (const [name, raw] of Object.entries(files)) {
      const src = strip(raw);
      // data/policyText.ts는 개인정보 처리방침 초안의 글에 낱말 「localStorage」를 적을 뿐 저장소를 부르지 않는다(키 이름은 core/storage.ts의 상수에서 가져온다)
      if (name !== '../src/data/policyText.ts' && /\b(?:window\.)?(?:localStorage|sessionStorage)\b/.test(src)) users.push(name);
      expect(src, `${name}: 저장소 전체 지우기`).not.toMatch(/(?:localStorage|sessionStorage|storage)\.clear\s*\(/);
      expect(src, `${name}: 저장소 열거`).not.toMatch(/Object\.(?:keys|entries|values)\(\s*(?:window\.)?(?:localStorage|sessionStorage)\s*\)|(?:localStorage|sessionStorage)\.(?:key|length)\b/);
      expect(src, `${name}: 쿠키·IndexedDB`).not.toMatch(/document\.cookie|indexedDB|openDatabase/);
    }
    expect(users, '저장소를 직접 부르는 파일').toEqual(['../src/core/storage.ts']);
    // 저장소 메서드 호출의 첫 인자는 상수 키뿐이다(리터럴 문자열 키를 새로 만들지 않는다)
    const calls: string[] = [];
    for (const [name, raw] of Object.entries(files)) {
      const src = strip(raw);
      for (const m of src.matchAll(/\b(?:storage|base|store)\??\.(getItem|setItem|removeItem)\(\s*([^,)]*)/g)) calls.push(`${name}:${m[1]}(${m[2].trim()})`);
    }
    expect(calls.length, '호출이 한 군데도 안 잡히면 점검이 공허하다').toBeGreaterThan(4);
    for (const c of calls) {
      const arg = c.slice(c.indexOf('(') + 1, -1);
      // 상수 키, 또는 App.tsx의 얇은 래퍼가 받는 매개변수 k·key(래퍼는 위임만 한다)
      expect(['GAME_KEY', 'SETTINGS_KEY', 'k', 'key']).toContain(arg);
    }
  });
});

describe('다른 프로젝트의 키를 건드리지 않는다', () => {
  it('읽기: 다른 키가 잔뜩 있어도 이 앱은 자기 두 키만 읽고, 없으면 기본값이다 (남의 save·settings를 내 것으로 읽지 않는다)', () => {
    const { storage, log } = recorder(FOREIGN);
    expect(loadGame(storage)).toBeNull();
    expect(loadSettings(storage)).toEqual(DEFAULT_SETTINGS);
    expect(new Set(log.map((l) => l.key))).toEqual(new Set([GAME_KEY, SETTINGS_KEY]));
    expect(log.every((l) => l.op === 'get')).toBe(true);
  });

  it('쓰기·지우기: 저장·설정 저장·저장 지우기를 어떤 순서로 해도 다른 키의 값과 키 집합이 그대로이고, 바뀌는 것은 자기 두 키뿐이다', () => {
    const { storage, data, log } = recorder(FOREIGN);
    const before = new Map(data);
    expect(saveGame(storage, createInitialState(5))).toBe(true);
    expect(saveGame(storage, startLife(9, 'alpha'))).toBe(true);
    expect(saveSettings(storage, { ...DEFAULT_SETTINGS, speed: 4, bgm: { ...DEFAULT_BGM, on: true }, theme: 'dark' })).toBe(true);
    expect(loadGame(storage)).not.toBeNull();
    expect(loadSettings(storage).theme).toBe('dark');
    expect(clearGame(storage)).toBe(true);
    expect(loadGame(storage)).toBeNull();
    // 모든 호출은 자기 키에만 갔다
    expect(new Set(log.map((l) => l.key))).toEqual(new Set([GAME_KEY, SETTINGS_KEY]));
    // 남의 키는 값까지 그대로
    for (const [k, v] of before) expect(data.get(k), `남의 키 「${k}」`).toBe(v);
    // 키 집합: 남의 키 전부 + 설정 키 하나(저장은 지웠다)
    expect([...data.keys()].sort()).toEqual([...Object.keys(FOREIGN), SETTINGS_KEY].sort());
  });

  it('남의 키가 우리 키 이름과 비슷해도(접두어 뒤에 글자가 더 붙음) 혼동하지 않는다', () => {
    const { storage, data } = recorder({ 'suzeo-game:save2': '{"version":7}', 'suzeo-game:settings2': '{"version":3}' });
    expect(loadGame(storage)).toBeNull();
    expect(loadSettings(storage)).toEqual(DEFAULT_SETTINGS);
    clearGame(storage);
    expect(data.get('suzeo-game:save2')).toBe('{"version":7}');
    expect(data.get('suzeo-game:settings2')).toBe('{"version":3}');
  });

  it('남의 save·settings 키에 우리 형식의 저장이 들어 있어도 읽지 않는다', () => {
    const ours = JSON.stringify({ version: 7, data: startLife(3, 'alpha') });
    const { storage } = recorder({ save: ours, settings: JSON.stringify({ version: 3, data: { ...DEFAULT_SETTINGS, theme: 'dark' } }) });
    expect(loadGame(storage)).toBeNull();
    expect(loadSettings(storage).theme).toBe('system');
  });

  it('저장소를 쓸 수 없는 환경(차단·가득 참)에서도 던지지 않고 남의 키는 그대로다', () => {
    const data = new Map(Object.entries(FOREIGN));
    const failing: StorageLike = {
      getItem: (k) => data.get(k) ?? null,
      setItem: () => {
        throw new DOMException('quota', 'QuotaExceededError');
      },
      removeItem: () => {
        throw new DOMException('denied', 'SecurityError');
      },
    };
    expect(saveGame(failing, createInitialState(1))).toBe(false);
    expect(saveSettings(failing, DEFAULT_SETTINGS)).toBe(false);
    expect(clearGame(failing)).toBe(false);
    expect(Object.fromEntries(data)).toEqual(FOREIGN);
  });
});
