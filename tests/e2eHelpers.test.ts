import { describe, expect, it } from 'vitest';
import {
  GAME_KEY as CORE_GAME_KEY,
  SETTINGS_KEY as CORE_SETTINGS_KEY,
  SCHEMA_VERSION,
  beginBirth,
  createInitialState,
  createRng,
  generateBirth,
  parseGame,
  selectEra,
  startGame,
  ERAS,
} from '../src/core';
import { GAME_KEY, KNOWN_SEED, SAVE_VERSION, SETTINGS_KEY, birthState, eraSelectState, lifeState } from '../e2e/saves';

/**
 * e2e가 localStorage에 주입하는 저장(e2e/saves.ts)이 core와 어긋나지 않는지 대조한다.
 * Playwright는 core를 import할 수 없어 키·버전·형태를 따로 적어 두었기 때문이다 (R-022 d).
 */
describe('e2e 저장 주입 헬퍼', () => {
  it('저장 키·스키마 버전이 core와 같다', () => {
    expect(GAME_KEY).toBe(CORE_GAME_KEY);
    expect(SETTINGS_KEY).toBe(CORE_SETTINGS_KEY);
    expect(SAVE_VERSION).toBe(SCHEMA_VERSION);
  });

  it('eraSelectState는 core의 startGame + selectEra 결과와 같고 core 검증기를 통과한다', () => {
    for (const era of ERAS) {
      const made = eraSelectState(KNOWN_SEED, era);
      expect(made).toEqual(selectEra(startGame(createInitialState(KNOWN_SEED)), era));
      expect(parseGame(JSON.stringify({ version: SAVE_VERSION, data: made }))).toEqual(made);
    }
    const noEra = eraSelectState(KNOWN_SEED);
    expect(noEra).toEqual(startGame(createInitialState(KNOWN_SEED)));
    expect(parseGame(JSON.stringify({ version: SAVE_VERSION, data: noEra }))).toEqual(noEra);
  });

  it('lifeState는 core 검증기를 통과하는 유효한 저장이다 (ErrorBoundary e2e가 clearGame을 실제로 검증하려면 유효해야 한다)', () => {
    const life = lifeState(424242);
    const parsed = parseGame(JSON.stringify({ version: SAVE_VERSION, data: life }));
    expect(parsed).not.toBeNull();
    expect(parsed).toEqual(life);
    expect(parsed!.phase).toBe('life');
    expect(parsed!.seed).toBe(424242);
  });

  it('birthState는 세 시대 × 재력 5단계 × 외모 경계 모두 core 검증기를 통과하는 출생 화면 저장이다 (R-018 e2e가 쓴다)', () => {
    for (const era of ERAS) {
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

  it('KNOWN_SEED는 세 시대 모두 "1회 추첨"과 "2회 추첨"의 결과가 달라서 e2e가 둘을 가른다', () => {
    for (const era of ERAS) {
      const once = beginBirth(eraSelectState(KNOWN_SEED, era));
      const second = generateBirth(createRng(once.rngState), era).character;
      expect(once.character, era).not.toBeNull();
      expect(second, era).not.toEqual(once.character);
    }
  });
});
