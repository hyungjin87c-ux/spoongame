import type { Character, Era, GameState, LifeLength, ParentWealth, PlaySettings, Settings } from '../src/core/types';

/**
 * e2e가 주입하는 저장 데이터(순수 객체). Playwright에 의존하지 않으므로 vitest에서도
 * core의 검증기(parseGame)와 대조할 수 있다(tests/e2eHelpers.test.ts).
 */

export const GAME_KEY = 'suzeo-game:save';
export const SETTINGS_KEY = 'suzeo-game:settings';
export const SAVE_VERSION = 5;
/** 설정 봉투 버전(core/storage.ts#SETTINGS_VERSION)과 첫 화면의 기본 선택(core/state.ts#DEFAULT_SETTINGS) — tests/e2eHelpers.test.ts가 core와 같은지 대조한다. */
export const SETTINGS_VERSION = 2;
export const DEFAULT_ERA_CHOICE: Era = 'present';
export const DEFAULT_LIFE_LENGTH_CHOICE: LifeLength = 'short30';
/** 재현 가능한 실패를 위한 기본 시드 */
export const KNOWN_SEED = 20261013;

const PLACEHOLDER_STATS = { wealth: 50, education: 50, health: 50, happiness: 50, relationships: 50 };

/** 인생이 시작되기 전(title·birth)에는 진행 기록이 모두 비어 있다. */
const FRESH = { flags: [] as string[], seen: {} as Record<string, number>, pending: null, lastChoiceAge: null, death: null };

/** e2e가 주입하는 설정: 배속·자동 모드만 줘도 되고(세상·인생 길이는 첫 화면의 기본 선택) 첫 화면의 선택까지 줄 수도 있다. */
export type InjectedSettings = PlaySettings & Partial<Settings>;

/** 설정 봉투(JSON 문자열). 비어 있는 필드는 기본값으로 채운다. */
export function settingsEnvelope(settings: InjectedSettings): string {
  return JSON.stringify({ version: SETTINGS_VERSION, data: { era: DEFAULT_ERA_CHOICE, lifeLength: DEFAULT_LIFE_LENGTH_CHOICE, ...settings } });
}

/** 새 게임: 첫 화면(title). 세상·인생 길이는 아직 정해지지 않았다(첫 화면의 선택은 설정에 있다). */
export function titleState(seed: number): GameState {
  return {
    phase: 'title',
    era: null,
    lifeLength: null,
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
    lifeLength: 'short30',
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
    lifeLength: 'short30',
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
