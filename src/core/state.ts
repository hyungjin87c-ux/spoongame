import { birthEntryText } from '../data/lifeText';
import { generateBirth } from './birth';
import { appendHistory } from './history';
import { createRng } from './rng';
import type { Era, GameState, LifeLength, Settings, Stats } from './types';

/** 출생 전 자리표시 스탯. 실제 값은 beginBirth가 채운다(건강은 0이 되지 않게 중립값). */
export const INITIAL_STATS: Stats = {
  wealth: 50,
  education: 50,
  health: 50,
  happiness: 50,
  relationships: 50,
};

/** 첫 화면에서 처음 눌려 있는 시대(지금 세상, FS4)와 인생 길이(약 30분 ▲, FS5) */
export const DEFAULT_ERA: Era = 'present';
export const DEFAULT_LIFE_LENGTH: LifeLength = 'short30';

export const DEFAULT_SETTINGS: Settings = { speed: 1, autoMode: false, era: DEFAULT_ERA, lifeLength: DEFAULT_LIFE_LENGTH };

/** 새 게임의 초기 상태. 시드는 주입한다(테스트·재현용). */
export function createInitialState(seed: number): GameState {
  const s = seed >>> 0;
  return {
    phase: 'title',
    era: null,
    lifeLength: null,
    character: null,
    stats: { ...INITIAL_STATS },
    birthStats: null,
    age: 0,
    history: [],
    flags: [],
    seen: {},
    pending: null,
    lastChoiceAge: null,
    death: null,
    seed: s,
    rngState: s,
  };
}

/**
 * 엔딩 → 다시 태어나기: 새 시드로 새 판을 시작해 첫 화면(title)으로 돌아간다(SPEC-003 규칙 19). 이전 판은 이 상태로 대체되고 되돌릴 수 없다.
 * 세상·인생 길이는 판 상태가 아니라 설정에 있어 첫 화면에 마지막 선택이 그대로 눌려 있다.
 * ending 단계에서만 동작하므로 연타·더블탭이 와도 두 번째부터는 같은 상태를 돌려준다(두 판이 시작되지 않는다).
 * 시드는 호출하는 쪽(UI)이 정해 넘긴다 — core는 난수 원천을 직접 만들지 않는다. 설정(배속·자동 모드)은 세션에 있어 그대로 유지된다.
 */
export function rebirth(state: GameState, seed: number): GameState {
  return state.phase === 'ending' ? createInitialState(seed) : state;
}

/**
 * 「태어나기」: 첫 화면(title)에서 고른 세상·인생 길이로 출생 결과를 만든다. 시드 RNG만 사용한다(M3의 룰렛이 이 결과를 보여 준다).
 * title 단계에서만 동작하므로 연타해도 두 번 뽑히지 않는다. 인생 길이는 여기서 판에 고정된다(LM3).
 */
export function beginBirth(state: GameState, era: Era = DEFAULT_ERA, lifeLength: LifeLength = DEFAULT_LIFE_LENGTH): GameState {
  if (state.phase !== 'title') return state;
  const rng = createRng(state.rngState);
  const { character, stats } = generateBirth(rng, era);
  return {
    ...state,
    phase: 'birth',
    era,
    lifeLength,
    character,
    stats,
    birthStats: { ...stats },
    age: 0,
    history: [],
    flags: [],
    seen: {},
    pending: null,
    lastChoiceAge: null,
    death: null,
    rngState: rng.getState(),
  };
}

/** 출생 결과 → 인생 진행. 생애 연표의 첫 줄(출생)을 남긴다. */
export function enterLife(state: GameState): GameState {
  if (state.phase !== 'birth' || state.character === null) return state;
  return {
    ...state,
    phase: 'life',
    history: appendHistory(state.history, {
      age: 0,
      kind: 'stage',
      text: birthEntryText(state.character.birthYear, state.character.gender),
    }),
  };
}
