import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, SETTINGS_KEY, createInitialState, createSession, parseSettings, serializeSettings, sessionReducer, type Session } from '../src/core';

/**
 * 집과 가족 그림의 접힘 설정 (SPEC-009 FH1 「접으면 아래 한 줄만 남고 설정에 저장」): 선택 필드 `sceneFold` — 접었을 때만 `true`로 있고 펼침은 필드가 없다.
 * 접은 적 없는 설정·옛 설정(필드 없음)의 모양이 변하지 않고, 이상한 값은 펼침으로 읽는다. 구조는 tests/titleSession·storage 시험이 보는 기존 설정 체계와 같다.
 */

const fresh = (): Session => createSession(createInitialState(7), { speed: 1, autoMode: false });
const send = (s: Session, fold: unknown): Session => sessionReducer(s, { type: 'setSceneFold', fold: fold as boolean });
const env = (data: Record<string, unknown>): string => JSON.stringify({ version: 6, data });
const BASE = { speed: 2, autoMode: false, generation: 'random', lifeLength: 'short30', bgm: { on: false, volume: 30 }, theme: 'system', noteCards: true, gentle: false, notesSeen: '' };

describe('설정 sceneFold (선택 필드)', () => {
  it('기본 설정에는 필드가 없다(펼침) — 접은 적 없는 설정의 모양이 기존과 같다', () => {
    expect('sceneFold' in DEFAULT_SETTINGS).toBe(false);
    expect('sceneFold' in parseSettings(null)).toBe(false);
    expect('sceneFold' in parseSettings(env(BASE))).toBe(false);
  });

  it('접기 → 필드가 true로 생기고, 펼치기 → 필드가 사라진다(접은 적 없는 설정과 같은 모양). 같은 값을 다시 보내면 같은 세션 객체다(연타)', () => {
    const s = fresh();
    const folded = send(s, true);
    expect(folded.settings.sceneFold).toBe(true);
    expect(send(folded, true)).toBe(folded);
    const open = send(folded, false);
    expect('sceneFold' in open.settings).toBe(false);
    expect(open.settings).toEqual(s.settings);
    expect(send(s, false)).toBe(s);
    expect(folded.game).toBe(s.game); // 인생 상태와 무관하다
  });

  it('불리언이 아닌 값은 무시한다(변조된 입력)', () => {
    const s = fresh();
    for (const bad of ['true', 1, null, undefined, {}]) expect(send(s, bad)).toBe(s);
  });

  it('저장·복원: true만 읽고(접힘), false·문자열·숫자 따위는 펼침(필드 없음)으로 읽는다 — 이상한 저장이 그림을 숨기지 않는다', () => {
    const roundTrip = parseSettings(serializeSettings({ ...parseSettings(null), sceneFold: true }));
    expect(roundTrip.sceneFold).toBe(true);
    expect(parseSettings(env({ ...BASE, sceneFold: true })).sceneFold).toBe(true);
    for (const bad of [false, 'true', 1, 0, null, [], {}]) expect('sceneFold' in parseSettings(env({ ...BASE, sceneFold: bad })), JSON.stringify(bad)).toBe(false);
    // 다른 설정은 그대로 읽힌다
    expect(parseSettings(env({ ...BASE, sceneFold: true })).speed).toBe(2);
  });

  it('설정 키·버전은 그대로다(스키마 버전을 올리지 않는다) — 옛 빌드가 새 설정을 읽어도 알 수 없는 필드만 무시한다', () => {
    expect(SETTINGS_KEY).toBe('suzeo-game:settings');
    const raw = serializeSettings({ ...parseSettings(null), sceneFold: true });
    expect(JSON.parse(raw)).toMatchObject({ version: 6, data: { sceneFold: true } });
  });
});
