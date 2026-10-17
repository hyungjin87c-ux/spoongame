import { describe, expect, it } from 'vitest';
import indexHtml from '../index.html?raw';
import { DEFAULT_SETTINGS, SETTINGS_KEY, SETTINGS_VERSION, SPEEDS, THEMES, parseSettings, serializeSettings, type Settings } from '../src/core';

/**
 * 수동 테마 사전 적용 (QA-003-M4 O02): `index.html`의 짧은 인라인 스크립트가 JS 번들이 뜨기 전에 저장된 설정의 theme을 `<html data-theme>`에 미리 건다 —
 * 다크를 직접 고른 사용자가 JS가 늦게 올 때 밝은 바탕을 잠깐 보는 문제를 없앤다. 이 스크립트는 번들 밖이라 `src/core/storage.ts`의 함수를 부를 수 없고 키·형식·판정을 따로 적었으므로,
 * 여기서 같은 입력 수백 개로 **실제 `parseSettings`와 결과가 같은지** 대조한다(저장 형식이 바뀌면 이 시험이 먼저 깨진다). 첫 그림 바탕색 실측은 e2e-prod/smoke.spec.ts, 번들 전 attribute는 e2e/theme-first-paint.spec.ts.
 */

/** index.html에서 `src`가 없는 인라인 스크립트의 본문들 */
function inlineScripts(html: string): string[] {
  return [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
}

/** 인라인 스크립트를 가짜 저장소·가짜 문서로 실행해, 거는 `data-theme` 값(없으면 null)을 돌려준다. 저장소가 던지면 던지는 대로 둔다(스크립트가 삼켜야 한다). */
function runInline(code: string, storage: { getItem(key: string): string | null } | undefined): { theme: string | null; calls: number; error: unknown } {
  const attrs: Record<string, string> = {};
  let calls = 0;
  const doc = {
    documentElement: {
      setAttribute(name: string, value: string) {
        attrs[name] = value;
        calls++;
      },
    },
  };
  let error: unknown = null;
  try {
    // 인라인 스크립트는 전역의 localStorage·document만 쓴다 — 같은 이름의 인자로 가려서 실행한다
    new Function('document', 'localStorage', code)(doc, storage);
  } catch (e) {
    error = e;
  }
  return { theme: attrs['data-theme'] ?? null, calls, error };
}

const scripts = inlineScripts(indexHtml);

describe('index.html 인라인 테마 스크립트: 모양', () => {
  it('인라인 스크립트는 정확히 하나이고, <head> 안에서 번들 스크립트(main.tsx)보다 앞에 있다 — 첫 그림 전에 돈다', () => {
    expect(scripts).toHaveLength(1);
    const headEnd = indexHtml.indexOf('</head>');
    const inline = indexHtml.search(/<script>\s*\(function/);
    const bundle = indexHtml.indexOf('<script type="module" src="/src/main.tsx">');
    expect(inline).toBeGreaterThan(-1);
    expect(inline).toBeLessThan(headEnd);
    expect(bundle).toBeGreaterThan(headEnd);
    expect(inline).toBeLessThan(bundle);
  });

  it('짧고(1KB 이하), 네트워크 요청·동적 불러오기·외부 주소가 없으며, 전역 변수를 만들지 않는다(즉시 실행 함수)', () => {
    const code = scripts[0];
    expect(code.length).toBeLessThan(1024);
    expect(code).not.toMatch(/fetch\s*\(|XMLHttpRequest|import\s*\(|importScripts|sendBeacon|WebSocket|EventSource|https?:/);
    expect(code.trim()).toMatch(/^\(function\s*\(\)\s*\{[\s\S]*\}\)\(\);?$/);
    expect(code, '저장소 키는 src/core/storage.ts의 SETTINGS_KEY').toContain(`'${SETTINGS_KEY}'`);
    expect(code, 'data-theme만 건다(주소 표시줄 메타는 번들이 원래 값을 기억하며 바꾼다)').toMatch(/setAttribute\('data-theme', d\.theme\)/);
    expect(code.match(/setAttribute\(/g)).toHaveLength(1);
  });

  it('스크립트 태그에 src·type=module이 없는 일반 인라인 스크립트다(번들러가 건드리지 않는다) — 이 파일의 다른 src/href는 아이콘과 진입 파일뿐', () => {
    expect(indexHtml).toMatch(/<script>\s*\(function/);
    const refs = [...indexHtml.matchAll(/(?:src|href)="([^"]+)"/g)].map((m) => m[1]);
    expect(refs.every((r) => r.startsWith('/src/'))).toBe(true);
  });
});

describe('index.html 인라인 테마 스크립트: parseSettings와 같은 판정 (같은 입력 → 같은 theme)', () => {
  const code = scripts[0];
  /** 스크립트가 거는 값 — 안 걸면 시스템 설정을 따르는 'system' */
  const applied = (raw: string | null): string => runInline(code, { getItem: (k) => (k === SETTINGS_KEY ? raw : null) }).theme ?? 'system';

  const settingsOf = (patch: Partial<Settings>): string => serializeSettings({ ...DEFAULT_SETTINGS, ...patch });
  const envelope = (version: unknown, data: unknown): string => JSON.stringify({ version, data });

  it('정상 저장: theme 3종 × 배속 4종 × 자동 모드 2종 × BGM 켬/끔 — 수동 선택(light·dark)만 걸리고 system은 걸지 않는다', () => {
    let hit = 0;
    for (const theme of THEMES) {
      for (const speed of SPEEDS) {
        for (const autoMode of [true, false]) {
          for (const bgmOn of [true, false]) {
            const raw = settingsOf({ theme, speed, autoMode, bgm: { on: bgmOn, volume: 55 } });
            const expected = parseSettings(raw).theme;
            expect(expected, '시험 전제: 정상 저장은 그대로 읽힌다').toBe(theme);
            expect(applied(raw), raw).toBe(expected);
            if (theme !== 'system') hit++;
          }
        }
      }
    }
    expect(hit, '공허 통과 방지: 수동 선택 32건이 실제로 걸렸다').toBe(2 * 4 * 2 * 2);
    const calls = runInline(code, { getItem: () => settingsOf({ theme: 'system' }) });
    expect(calls.calls, 'system이면 문서를 건드리지 않는다').toBe(0);
  });

  it('다른 필드(세상·인생 길이·BGM 볼륨)가 달라도 theme 판정은 같다', () => {
    for (const era of ['past', 'present', 'future'] as const) {
      for (const lifeLength of ['short30', 'long60'] as const) {
        for (const theme of ['light', 'dark'] as const) {
          const raw = settingsOf({ era, lifeLength, theme, bgm: { on: true, volume: 0 } });
          expect(applied(raw)).toBe(parseSettings(raw).theme);
        }
      }
    }
  });

  it('봉투 버전: 읽을 수 있는 1·2·3은 data를 그대로 읽고, 그 밖(0·4·소수·문자열·없음)은 기본값(system)이다 — 현재 저장 버전은 3', () => {
    expect(SETTINGS_VERSION).toBe(3);
    const data = { ...DEFAULT_SETTINGS, theme: 'dark' };
    for (const version of [0, 1, 2, 3, 4, 5, 3.5, -1, '3', null, undefined, true]) {
      const raw = envelope(version, data);
      expect(applied(raw), `version=${String(version)}`).toBe(parseSettings(raw).theme);
    }
    expect(applied(JSON.stringify({ data }))).toBe('system');
    expect(applied(envelope(3, data))).toBe('dark'); // 대조: 정상 저장은 실제로 걸린다
    expect(applied(envelope(4, data))).toBe('system'); // 대조: 모르는 버전은 안 건다
  });

  it('data의 모양이 어긋나면 설정 전체가 기본값(system)이다: 배속·자동 모드가 형식에 안 맞는 경우, data가 객체가 아닌 경우', () => {
    const base = { ...DEFAULT_SETTINGS, theme: 'dark' };
    const variants: unknown[] = [
      { ...base, speed: 3 },
      { ...base, speed: '1' },
      { ...base, speed: null },
      { ...base, speed: 8.0 },
      { ...base, speed: 16 },
      { ...base, autoMode: 'true' },
      { ...base, autoMode: 1 },
      { ...base, autoMode: null },
      { theme: 'dark' },
      { speed: 1, theme: 'dark' },
      { autoMode: false, theme: 'dark' },
      { speed: 2, autoMode: true, theme: 'dark' }, // 필수 둘만 있어도 theme은 읽힌다
      null,
      [],
      [base],
      'dark',
      7,
      true,
    ];
    for (const data of variants) {
      const raw = envelope(3, data);
      expect(applied(raw), raw).toBe(parseSettings(raw).theme);
    }
    expect(applied(envelope(3, { speed: 2, autoMode: true, theme: 'dark' }))).toBe('dark');
    expect(applied(envelope(3, { theme: 'dark' }))).toBe('system');
  });

  it('theme 값이 이상하면 기본값(system)이다: 대소문자·공백·숫자·null·객체·배열·빈 문자열', () => {
    for (const theme of ['Dark', 'DARK', ' dark', 'dark ', 'dark\n', 'black', 'auto', '', 0, 1, null, true, {}, [], ['dark'], { toString: 'dark' }]) {
      const raw = envelope(3, { ...DEFAULT_SETTINGS, theme });
      expect(applied(raw), JSON.stringify(theme)).toBe(parseSettings(raw).theme);
      expect(applied(raw)).toBe('system');
    }
    // theme 필드가 없는 v1·v2 설정은 system
    const { theme: _drop, ...noTheme } = DEFAULT_SETTINGS;
    void _drop;
    for (const version of [1, 2, 3]) expect(applied(envelope(version, noTheme))).toBe('system');
  });

  it('손상·빈 저장: null·빈 문자열·깨진 JSON·JSON이지만 봉투가 아닌 값은 아무것도 안 건다', () => {
    const raws: Array<string | null> = [null, '', ' ', 'x', '{', '}', '{"version":3', '[]', '{}', 'null', 'undefined', '123', 'true', '"dark"', '["dark"]', '{"version":3}', '{"version":3,"data":null}', '\u0000', '{"version":3,"data":{"theme":"dark"}}'];
    for (const raw of raws) expect(applied(raw), JSON.stringify(raw)).toBe(parseSettings(raw).theme);
    for (const raw of raws.slice(0, -1)) expect(applied(raw), JSON.stringify(raw)).toBe('system');
  });

  it('저장소를 못 읽는 환경(getItem이 던짐, localStorage 자체가 없음, 접근이 막힘)에서도 던지지 않고 아무것도 안 건다', () => {
    const throwing = runInline(code, {
      getItem: () => {
        throw new Error('SecurityError');
      },
    });
    expect(throwing.error, '스크립트가 예외를 삼킨다').toBeNull();
    expect(throwing.calls).toBe(0);
    const missing = runInline(code, undefined);
    expect(missing.error).toBeNull();
    expect(missing.calls).toBe(0);
    const blocked = runInline(code, new Proxy({}, { get: () => { throw new Error('blocked'); } }) as { getItem(key: string): string | null });
    expect(blocked.error).toBeNull();
    expect(blocked.calls).toBe(0);
  });

  it('다른 저장 키의 값은 읽지 않는다(DP4): 게임 저장 키에 설정 모양이 들어 있어도 안 건다', () => {
    const dark = settingsOf({ theme: 'dark' });
    const other = runInline(code, { getItem: (k) => (k === SETTINGS_KEY ? null : dark) });
    expect(other.calls).toBe(0);
    const asked: string[] = [];
    runInline(code, {
      getItem: (k) => {
        asked.push(k);
        return null;
      },
    });
    expect(asked).toEqual([SETTINGS_KEY]);
  });

  it('무작위 변이(1500건): 정상 저장 JSON의 글자를 바꾸거나 지워도 parseSettings와 같은 theme을 건다 — 어긋남 0', () => {
    let seed = 20261017;
    const rnd = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 2 ** 32;
    };
    const pool = '{}[]":,0123456789abcdefghijklmnopqrstuvwxyz truefalsnl\\';
    const bases = ['light', 'dark', 'system'].map((theme) => settingsOf({ theme: theme as Settings['theme'], speed: 4, autoMode: true }));
    let mismatches = 0;
    let appliedCount = 0;
    for (let i = 0; i < 1500; i++) {
      let raw = bases[i % bases.length];
      const edits = 1 + Math.floor(rnd() * 3);
      for (let k = 0; k < edits; k++) {
        const at = Math.floor(rnd() * raw.length);
        const op = rnd();
        if (op < 0.4) raw = raw.slice(0, at) + pool[Math.floor(rnd() * pool.length)] + raw.slice(at + 1);
        else if (op < 0.7) raw = raw.slice(0, at) + raw.slice(at + 1);
        else raw = raw.slice(0, at) + pool[Math.floor(rnd() * pool.length)] + raw.slice(at);
      }
      const expected = parseSettings(raw).theme;
      const got = applied(raw);
      if (got !== expected) mismatches++;
      if (got !== 'system') appliedCount++;
    }
    expect(mismatches).toBe(0);
    expect(appliedCount, '공허 통과 방지: 변이된 입력 중에도 수동 테마가 걸리는 경우가 있다').toBeGreaterThan(100);
  });
});
