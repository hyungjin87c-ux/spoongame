import { describe, expect, it } from 'vitest';
import {
  GAME_KEY as CORE_GAME_KEY,
  SETTINGS_KEY as CORE_SETTINGS_KEY,
  SCHEMA_VERSION,
  DEFAULT_SETTINGS,
  SETTINGS_VERSION as CORE_SETTINGS_VERSION,
  beginBirth,
  createInitialState,
  createRng,
  generateBirth,
  parseGame,
  parseSettings,
  GENERATION_IDS,
} from '../src/core';
import { DEFAULT_GENERATION_CHOICE, DEFAULT_LIFE_LENGTH_CHOICE, GAME_KEY, KNOWN_SEED, SAVE_VERSION, SETTINGS_KEY, SETTINGS_VERSION, birthState, lifeState, settingsEnvelope, titleState } from '../e2e/saves';

/**
 * e2e가 localStorage에 주입하는 저장(e2e/saves.ts)이 core와 어긋나지 않는지 대조한다.
 * Playwright는 core를 import할 수 없어 키·버전·형태를 따로 적어 두었기 때문이다 (R-022 d).
 */
describe('e2e 저장 주입 헬퍼', () => {
  it('저장 키·스키마 버전이 core와 같다', () => {
    expect(GAME_KEY).toBe(CORE_GAME_KEY);
    expect(SETTINGS_KEY).toBe(CORE_SETTINGS_KEY);
    expect(SAVE_VERSION).toBe(SCHEMA_VERSION);
    expect(SETTINGS_VERSION).toBe(CORE_SETTINGS_VERSION);
    expect(DEFAULT_GENERATION_CHOICE).toBe(DEFAULT_SETTINGS.generation);
    expect(DEFAULT_LIFE_LENGTH_CHOICE).toBe(DEFAULT_SETTINGS.lifeLength);
  });

  it('titleState는 core의 createInitialState와 같고 core 검증기를 통과한다 (새 게임 = 첫 화면)', () => {
    const made = titleState(KNOWN_SEED);
    expect(made).toEqual(createInitialState(KNOWN_SEED));
    expect(parseGame(JSON.stringify({ version: SAVE_VERSION, data: made }))).toEqual(made);
  });

  it('settingsEnvelope는 core 설정 검증기가 그대로 읽는 현재 버전 봉투이고, 비어 있는 필드(세대·인생 길이·BGM·테마)는 기본값으로 채운다 — 기록 카드(noteCards)만 e2e 기본이 꺼짐이다 (M7c)', () => {
    expect(parseSettings(settingsEnvelope({ speed: 8, autoMode: true }))).toEqual({ ...DEFAULT_SETTINGS, speed: 8, autoMode: true, noteCards: false });
    expect(parseSettings(settingsEnvelope({ speed: 2, autoMode: false, generation: 'genx', lifeLength: 'short30' }))).toEqual({ ...DEFAULT_SETTINGS, speed: 2, autoMode: false, generation: 'genx', lifeLength: 'short30', noteCards: false });
    // 새 기록 시험만 켠다: 명시한 값이 e2e 기본을 이긴다
    expect(parseSettings(settingsEnvelope({ speed: 1, autoMode: false, noteCards: true })).noteCards).toBe(true);
    expect(DEFAULT_SETTINGS.noteCards).toBe(true); // 앱의 기본은 켜짐 — e2e 기본만 꺼짐
    // 아직 고를 수 없는 「약 1시간」(long60)이 저장돼 있으면 약 30분으로 읽는다(R-202: 이 단언이 바뀐 이유 — 예전에는 long60이 그대로 읽혔다)
    expect(parseSettings(settingsEnvelope({ speed: 2, autoMode: false, generation: 'genx', lifeLength: 'long60' }))).toEqual({ ...DEFAULT_SETTINGS, speed: 2, autoMode: false, generation: 'genx', lifeLength: 'short30', noteCards: false });
    // M4: BGM·테마도 주입할 수 있고 그대로 읽힌다
    expect(parseSettings(settingsEnvelope({ speed: 1, autoMode: false, bgm: { on: true, volume: 40 }, theme: 'dark' }))).toMatchObject({ bgm: { on: true, volume: 40 }, theme: 'dark' });
  });

  it('lifeState는 core 검증기를 통과하는 유효한 저장이다 (ErrorBoundary e2e가 clearGame을 실제로 검증하려면 유효해야 한다)', () => {
    const life = lifeState(424242);
    const parsed = parseGame(JSON.stringify({ version: SAVE_VERSION, data: life }));
    expect(parsed).not.toBeNull();
    expect(parsed).toEqual(life);
    expect(parsed!.phase).toBe('life');
    expect(parsed!.seed).toBe(424242);
  });

  it('birthState는 일곱 세대 × 재력 5단계 × 외모 경계 모두 core 검증기를 통과하는 출생 화면 저장이다 (R-018 e2e가 쓴다)', () => {
    for (const era of GENERATION_IDS) {
      for (const wealth of [1, 2, 3, 4, 5] as const) {
        for (const looks of [0, 50, 100]) {
          const made = birthState(KNOWN_SEED, era, wealth, looks);
          expect(parseGame(JSON.stringify({ version: SAVE_VERSION, data: made })), `${era} ${wealth} ${looks}`).toEqual(made);
          expect(made.phase).toBe('birth');
          expect(made.character!.parentWealth).toBe(wealth);
          expect(made.character!.looks).toBe(looks);
        }
      }
    }
  });

  it('KNOWN_SEED는 일곱 세대 모두 "1회 추첨"과 "2회 추첨"의 결과가 달라서 e2e가 둘을 가른다', () => {
    for (const era of GENERATION_IDS) {
      const once = beginBirth(titleState(KNOWN_SEED), era);
      const second = generateBirth(createRng(once.rngState), era).character;
      expect(once.character, era).not.toBeNull();
      expect(second, era).not.toEqual(once.character);
    }
  });
});
