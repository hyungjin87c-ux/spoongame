import { EVENT_POOL } from '../data/events';
import type { EventPool } from './events';
import { advanceUntilDecision, autoResolveStep, resolveChoiceStep, stepYear, type TickInfo } from './life';
import { beginBirth, enterLife, rebirth, selectEra, startGame } from './state';
import { SPEEDS, type Era, type GameState, type Settings, type Speed } from './types';

/**
 * 화면(UI)이 쓰는 상태 묶음과 reducer. 순수 함수라서 React 없이 vitest로 검증한다(R-005).
 *
 * 모든 갱신은 이 reducer 하나를 거친다: 타이머·클릭·자동 모드·다른 탭의 변경이 겹쳐도 항상 "가장 최신 상태"에 적용되고,
 * 각 액션은 자기가 알고 있던 상황(나이 / 선택지 키)을 함께 들고 와서 상황이 달라졌으면 무시된다(멱등):
 *  - advance(fromAge): 나이가 다르거나 선택지가 대기 중이면 무시 → 같은 해가 두 번 진행되지 않는다(StrictMode 이중 실행, 겹친 타이머)
 *  - choose(key, choiceId) / autoChoose(key): 대기 중인 이벤트 인스턴스의 키와 다르면 무시 → 연타가 다음 선택지를 누르지 못한다
 *  - autoChoose: 자동 모드가 꺼져 있으면 무시 → 타이머가 울리기 직전에 사용자가 자동 모드를 해제했다면 그 선택은 일어나지 않는다(R-038)
 *  - skip(다음 결정으로): 자동 모드에서는 무시 → 자동 모드의 선택은 타이머(autoChoose)로만 일어난다. 화면도 자동 모드에서는 이 버튼을 비활성화한다(R-038)
 *  - rebirth(seed): ending 단계에서만 동작하고 새 판은 시대 선택(eraSelect)에서 시작한다 → 더블탭·연타의 둘째 입력은 같은 객체를 돌려받아 두 판이 시작되거나 시대 선택을 건너뛰지 않는다. 설정(배속·자동 모드)은 그대로다.
 * 무시되는 경우에는 같은 객체를 돌려준다(React가 다시 그리지 않는다).
 */
export interface Session {
  game: GameState;
  settings: Settings;
  /** 직전에 처리한 걸음(연출 시간 결정용). 저장하지 않으며 복원 직후에는 null. */
  tick: TickInfo | null;
}

export type SessionAction =
  | { type: 'start' }
  | { type: 'selectEra'; era: Era }
  | { type: 'confirmEra' }
  | { type: 'enterLife' }
  | { type: 'advance'; fromAge: number }
  | { type: 'choose'; key: string; choiceId: string }
  | { type: 'autoChoose'; key: string }
  | { type: 'skip' }
  | { type: 'setSpeed'; speed: Speed }
  | { type: 'setAuto'; auto: boolean }
  /** 엔딩에서 새 시드로 새 판을 시작해 시대 선택 화면으로 간다(설정은 그대로). 시드는 UI가 정해 넘긴다. */
  | { type: 'rebirth'; seed: number }
  /** 다른 탭이 진행한 저장 상태를 이어받는다(R-011) */
  | { type: 'adopt'; game: GameState };

export function createSession(game: GameState, settings: Settings): Session {
  return { game, settings, tick: null };
}

function withGame(s: Session, game: GameState, tick: TickInfo | null = null): Session {
  return game === s.game ? s : { ...s, game, tick };
}

export function sessionReducer(s: Session, a: SessionAction, pool: EventPool = EVENT_POOL): Session {
  switch (a.type) {
    case 'start':
      return withGame(s, startGame(s.game));
    case 'selectEra':
      return withGame(s, selectEra(s.game, a.era));
    case 'confirmEra':
      return withGame(s, beginBirth(s.game));
    case 'enterLife':
      return withGame(s, enterLife(s.game));
    case 'advance': {
      if (s.game.age !== a.fromAge) return s;
      const r = stepYear(s.game, pool);
      return withGame(s, r.state, r.tick);
    }
    case 'choose': {
      const r = resolveChoiceStep(s.game, a.key, a.choiceId, pool);
      return withGame(s, r.state, r.tick);
    }
    case 'autoChoose': {
      if (!s.settings.autoMode) return s;
      const r = autoResolveStep(s.game, a.key, pool);
      return withGame(s, r.state, r.tick);
    }
    case 'skip': {
      // 다음 결정으로: 선택지(또는 사망)까지 연출 없이 즉시. 선택은 사람이 한다(자동 모드에서는 이 동작이 없다 — 위 설명).
      if (s.settings.autoMode || s.game.phase !== 'life' || s.game.pending !== null) return s;
      const r = advanceUntilDecision(s.game, pool);
      return withGame(s, r.state, r.last);
    }
    case 'setSpeed':
      return !(SPEEDS as readonly number[]).includes(a.speed) || a.speed === s.settings.speed
        ? s
        : { ...s, settings: { ...s.settings, speed: a.speed } };
    case 'setAuto':
      return a.auto === s.settings.autoMode ? s : { ...s, settings: { ...s.settings, autoMode: a.auto } };
    case 'rebirth':
      return withGame(s, rebirth(s.game, a.seed));
    case 'adopt':
      return { ...s, game: a.game, tick: null };
  }
}
