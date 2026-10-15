import { birthEntryText } from '../data/lifeText';
import { generateBirth } from './birth';
import { appendHistory } from './history';
import { createRng } from './rng';
import type { Era, GameState, Settings, Stats } from './types';

/** 출생 전 자리표시 스탯. 실제 값은 beginBirth가 채운다(건강은 0이 되지 않게 중립값). */
export const INITIAL_STATS: Stats = {
  wealth: 50,
  education: 50,
  health: 50,
  happiness: 50,
  relationships: 50,
};

export const DEFAULT_SETTINGS: Settings = { speed: 1, autoMode: false };

/** 시대 선택 화면에서 처음 눌려 있는 시대 */
export const DEFAULT_ERA: Era = 'present';

/** 새 게임의 초기 상태. 시드는 주입한다(테스트·재현용). */
export function createInitialState(seed: number): GameState {
  const s = seed >>> 0;
  return {
    phase: 'title',
    era: null,
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

/** 타이틀 → 시대 선택 */
export function startGame(state: GameState): GameState {
  return state.phase === 'title' ? { ...state, phase: 'eraSelect' } : state;
}

/**
 * 엔딩 → 다시 태어나기: 새 시드로 새 판을 시작해 곧바로 시대 선택 화면으로 간다(타이틀을 거치지 않는다 — R-030 M5 몫).
 * 시대는 고르지 않은 상태(null)라 화면의 기본 선택(DEFAULT_ERA, 지금 세상)이 눌려 있다. 이전 판은 이 상태로 대체되고 되돌릴 수 없다.
 * ending 단계에서만 동작하므로 연타·더블탭이 와도 두 번째부터는 같은 상태를 돌려준다(두 판이 시작되거나 시대 선택을 건너뛰지 않는다).
 * 시드는 호출하는 쪽(UI)이 정해 넘긴다 — core는 난수 원천을 직접 만들지 않는다. 설정(배속·자동 모드)은 게임 상태가 아니라 세션에 있어 그대로 유지된다.
 */
export function rebirth(state: GameState, seed: number): GameState {
  return state.phase === 'ending' ? startGame(createInitialState(seed)) : state;
}

/** 시대 선택 화면에서 시대를 고른다(새로고침해도 유지되도록 상태에 저장). */
export function selectEra(state: GameState, era: Era): GameState {
  return state.phase === 'eraSelect' ? { ...state, era } : state;
}

/**
 * 시대 선택 확정 → 출생 결과 생성. 시드 RNG만 사용한다.
 * eraSelect 단계에서만 동작하므로 연타해도 두 번 뽑히지 않는다.
 */
export function beginBirth(state: GameState): GameState {
  if (state.phase !== 'eraSelect') return state;
  const era = state.era ?? DEFAULT_ERA;
  const rng = createRng(state.rngState);
  const { character, stats } = generateBirth(rng, era);
  return {
    ...state,
    phase: 'birth',
    era,
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
