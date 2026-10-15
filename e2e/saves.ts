import type { Character, Era, GameState, ParentWealth } from '../src/core/types';

/**
 * e2e가 주입하는 저장 데이터(순수 객체). Playwright에 의존하지 않으므로 vitest에서도
 * core의 검증기(parseGame)와 대조할 수 있다(tests/e2eHelpers.test.ts).
 */

export const GAME_KEY = 'suzeo-game:save';
export const SETTINGS_KEY = 'suzeo-game:settings';
export const SAVE_VERSION = 4;
/** 재현 가능한 실패를 위한 기본 시드 */
export const KNOWN_SEED = 20261013;

const PLACEHOLDER_STATS = { wealth: 50, education: 50, health: 50, happiness: 50, relationships: 50 };

/** 인생이 시작되기 전(title·eraSelect·birth)에는 진행 기록이 모두 비어 있다. */
const FRESH = { flags: [] as string[], seen: {} as Record<string, number>, pending: null, lastChoiceAge: null, death: null };

/** 타이틀을 막 넘긴 상태(시대 선택 화면). era가 null이면 화면의 기본값(지금 세상)이 눌려 있다. */
export function eraSelectState(seed: number, era: Era | null = null): GameState {
  return {
    phase: 'eraSelect',
    era,
    character: null,
    stats: { ...PLACEHOLDER_STATS },
    birthStats: null,
    age: 0,
    history: [],
    ...FRESH,
    seed,
    rngState: seed,
  };
}

/** 검증기를 통과하는 유효한 "인생 진행 중"(0세, 출생 직후) 저장. */
export function lifeState(seed: number): GameState {
  const character: Character = {
    name: '김민준',
    gender: 'male',
    birthYear: 2012, // 지금 세상 출생 연도 범위(2008~2025) 안
    parentWealth: 3,
    parenting: 'free',
    looks: 50,
  };
  const stats = { wealth: 45, education: 6, health: 70, happiness: 52, relationships: 54 };
  return {
    phase: 'life',
    era: 'present',
    character,
    stats,
    birthStats: { ...stats },
    age: 0,
    history: [{ age: 0, kind: 'stage', text: '2012년, 남자아이로 태어났다.' }],
    ...FRESH,
    seed,
    rngState: seed + 1,
  };
}

/** 시대별로 범위 안의 출생 연도 하나 (출생 화면 표현 e2e용) */
const SAMPLE_BIRTH_YEAR: Record<Era, number> = { past: 1960, present: 2012, future: 2040 };

/** 검증기를 통과하는 "출생 결과 화면" 저장. 재력 단계·외모를 지정해 표현(상위/하위/중간)을 전수 확인할 때 쓴다. */
export function birthState(seed: number, era: Era, parentWealth: ParentWealth, looks: number): GameState {
  const character: Character = {
    name: '김민준',
    gender: 'male',
    birthYear: SAMPLE_BIRTH_YEAR[era],
    parentWealth,
    parenting: 'free',
    looks,
  };
  const stats = { wealth: 45, education: 6, health: 70, happiness: 52, relationships: 54 };
  return {
    phase: 'birth',
    era,
    character,
    stats,
    birthStats: { ...stats },
    age: 0,
    history: [],
    ...FRESH,
    seed,
    rngState: seed + 1,
  };
}
