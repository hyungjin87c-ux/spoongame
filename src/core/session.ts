import { EVENT_POOL } from '../data/events';
import type { EventPool } from './events';
import { advanceUntilDecision, autoResolveStep, resolveChoiceStep, stepYear, type TickInfo } from './life';
import { DEFAULT_SETTINGS, beginBirth, createInitialState, enterBirth, enterLife, rebirth } from './state';
import { ERAS, SPEEDS, isLifeLengthSelectable, type Era, type GameState, type LifeLength, type PlaySettings, type Settings, type Speed } from './types';

/**
 * 화면(UI)이 쓰는 상태 묶음과 reducer. 순수 함수라서 React 없이 vitest로 검증한다(R-005).
 *
 * 모든 갱신은 이 reducer 하나를 거친다: 타이머·클릭·자동 모드·다른 탭의 변경이 겹쳐도 항상 "가장 최신 상태"에 적용되고,
 * 각 액션은 자기가 알고 있던 상황(나이 / 선택지 키)을 함께 들고 와서 상황이 달라졌으면 무시된다(멱등):
 *  - advance(fromAge): 나이가 다르거나 선택지가 대기 중이면 무시 → 같은 해가 두 번 진행되지 않는다(StrictMode 이중 실행, 겹친 타이머)
 *  - choose(key, choiceId) / autoChoose(key): 대기 중인 이벤트 인스턴스의 키와 다르면 무시 → 연타가 다음 선택지를 누르지 못한다
 *  - autoChoose: 자동 모드가 꺼져 있으면 무시 → 타이머가 울리기 직전에 사용자가 자동 모드를 해제했다면 그 선택은 일어나지 않는다(R-038)
 *  - skip(다음 결정으로): 자동 모드에서는 무시 → 자동 모드의 선택은 타이머(autoChoose)로만 일어난다. 화면도 자동 모드에서는 이 버튼을 비활성화한다(R-038)
 *  - begin / beginNew: 첫 화면의 「태어나기」. title 단계(begin) 또는 첫 화면을 다시 연 상태(beginNew)에서만 동작하고 한 번 동작하면 단계가 바뀌어
 *    더블탭·연타의 둘째 입력은 같은 객체를 돌려받는다 → 출생은 한 번만 일어난다(FS6). 이 순간 출생 결과가 정해져 저장되고 화면은 룰렛(roulette 단계)으로 간다(RL5).
 *  - finishSpin: 룰렛 연출이 끝났거나 「건너뛰기」를 눌렀다. 연출 중임을 나타내는 세션 상태(spin)를 끈다 — 이미 꺼져 있으면 무시(건너뛰기 연타). 저장되는 값이 아니라서
 *    룰렛 도중·직후 새로고침하면 spin이 꺼진 채 열려 룰렛이 다시 돌지 않고 결과가 확정된 모습으로 복원된다(RL5).
 *  - enterBirth(「출생신고 보기」): roulette 단계에서만 동작하고 한 번 동작하면 단계가 바뀌어 연타해도 한 번이다. 연출 중(spin)에는 무시 — 건너뛰기를 먼저 눌러야 한다(결과가 확정되어 보이기 전에 넘어가지 않는다).
 *  - rebirth(seed): ending 단계에서만 동작하고 새 판은 첫 화면(title)에서 시작한다 → 더블탭·연타의 둘째 입력은 같은 객체를 돌려받아 두 판이 시작되지 않는다. 설정(배속·자동 모드·세상·인생 길이)은 그대로다.
 * 무시되는 경우에는 같은 객체를 돌려준다(React가 다시 그리지 않는다).
 *
 * 첫 화면을 다시 연 상태(showTitle): 「나가기」(M4)가 진행 중인 판(birth·life)을 그대로 두고 첫 화면만 보여 줄 때 켜진다.
 * 저장되는 화면 단계가 아니라 이 세션(탭)에만 있는 상태라서, 새로고침하면 꺼지고 저장된 화면이 그대로 복원된다(마스터 결정 C3).
 * 켜져 있는 동안은 인생이 흐르지 않는다(진행 액션을 모두 무시).
 */
export interface Session {
  game: GameState;
  settings: Settings;
  /** 직전에 처리한 걸음(연출 시간 결정용). 저장하지 않으며 복원 직후에는 null. */
  tick: TickInfo | null;
  /** 첫 화면을 다시 열어 둔 상태(위 설명). 저장하지 않는다. */
  showTitle: boolean;
  /** 룰렛이 돌고 있는 중인가(「태어나기」를 막 눌렀고 연출이 끝나지 않았다). 저장하지 않으며 복원 직후에는 false다(RL5). */
  spin: boolean;
}

export type SessionAction =
  /** 첫 화면: 태어날 세상 고르기(설정에 저장되어 다음 판의 기본값이 된다) */
  | { type: 'setEra'; era: Era }
  /** 첫 화면: 인생 길이 고르기(설정에 저장). 고를 수 없는 값(SELECTABLE_LIFE_LENGTHS 밖, 지금은 long60)은 무시한다. */
  | { type: 'setLifeLength'; lifeLength: LifeLength }
  /** 첫 화면의 「태어나기」: 설정의 세상·인생 길이로 출생 결과를 만든다(title 단계에서만). */
  | { type: 'begin' }
  /** 진행 중인 판을 그대로 두고 첫 화면을 다시 연다(「나가기」, M4가 부른다). birth·life 단계에서만. */
  | { type: 'openTitle' }
  /** 첫 화면에서 「이어서 살기」: 저장된 화면으로 돌아간다. */
  | { type: 'resume' }
  /** 첫 화면에서 「새로 태어나기」: 이전 판을 버리고 새 시드로 새 판을 시작한다(첫 화면을 다시 연 상태에서만). 시드는 UI가 정해 넘긴다. */
  | { type: 'beginNew'; seed: number }
  /** 룰렛 연출이 끝났다/건너뛰었다: 회전 중 상태를 끈다. */
  | { type: 'finishSpin' }
  /** 룰렛 → 출생신고(「출생신고 보기」). roulette 단계에서만. */
  | { type: 'enterBirth' }
  | { type: 'enterLife' }
  | { type: 'advance'; fromAge: number }
  | { type: 'choose'; key: string; choiceId: string }
  | { type: 'autoChoose'; key: string }
  | { type: 'skip' }
  | { type: 'setSpeed'; speed: Speed }
  | { type: 'setAuto'; auto: boolean }
  /** 엔딩에서 새 시드로 새 판을 시작해 첫 화면으로 간다(설정은 그대로). 시드는 UI가 정해 넘긴다. */
  | { type: 'rebirth'; seed: number }
  /** 다른 탭이 진행한 저장 상태를 이어받는다(R-011) */
  | { type: 'adopt'; game: GameState };

/** 설정은 재생 설정(배속·자동 모드)만 줘도 된다 — 세상·인생 길이는 기본값으로 채운다. */
export function createSession(game: GameState, settings: PlaySettings & Partial<Settings>, showTitle = false): Session {
  return { game, settings: { ...DEFAULT_SETTINGS, ...settings }, tick: null, showTitle, spin: false };
}

/** 첫 화면에서 「이어서 살기」를 보일 만큼 진행된 판인가(출생 결과 이후, 엔딩 전 — 룰렛 단계도 결과가 이미 정해진 판이다). */
export function hasProgress(game: GameState): boolean {
  return game.phase === 'roulette' || game.phase === 'birth' || game.phase === 'life';
}

function withGame(s: Session, game: GameState, tick: TickInfo | null = null): Session {
  return game === s.game ? s : { ...s, game, tick };
}

export function sessionReducer(s: Session, a: SessionAction, pool: EventPool = EVENT_POOL): Session {
  // 첫 화면을 다시 연 동안에는 인생이 흐르지 않는다(늦게 울린 타이머·입력이 와도 무시).
  if (s.showTitle && (a.type === 'advance' || a.type === 'choose' || a.type === 'autoChoose' || a.type === 'skip' || a.type === 'enterLife' || a.type === 'enterBirth' || a.type === 'finishSpin')) return s;
  switch (a.type) {
    case 'setEra':
      return !(ERAS as readonly string[]).includes(a.era) || a.era === s.settings.era ? s : { ...s, settings: { ...s.settings, era: a.era } };
    case 'setLifeLength':
      // 지금 고를 수 있는 값(SELECTABLE_LIFE_LENGTHS)만 받는다: 「약 1시간」(long60)은 2차(M8)라 화면이 막아 두지만 변조된 입력·늦게 울린 이벤트도 설정을 바꾸지 못하게 reducer에서도 막는다(REV-003-M2-2 마스터 결정).
      // 목록에 없는 값(알 수 없는 문자열 포함)은 isLifeLengthSelectable이 false다.
      return !isLifeLengthSelectable(a.lifeLength) || a.lifeLength === s.settings.lifeLength ? s : { ...s, settings: { ...s.settings, lifeLength: a.lifeLength } };
    case 'begin': {
      if (s.showTitle) return s; // 진행 중인 판이 있는 첫 화면에서는 beginNew(이전 판을 버린다는 확인을 거친 길)만 새 판을 시작한다
      const game = beginBirth(s.game, s.settings.era, s.settings.lifeLength);
      return game === s.game ? s : { ...s, game, tick: null, spin: true };
    }
    case 'openTitle':
      return s.showTitle || !hasProgress(s.game) ? s : { ...s, showTitle: true, tick: null, spin: false };
    case 'resume':
      return s.showTitle ? { ...s, showTitle: false } : s;
    case 'beginNew': {
      if (!s.showTitle) return s;
      return { ...s, game: beginBirth(createInitialState(a.seed), s.settings.era, s.settings.lifeLength), tick: null, showTitle: false, spin: true };
    }
    case 'finishSpin':
      return s.spin ? { ...s, spin: false } : s;
    case 'enterBirth':
      // 연출 중에는 넘어가지 않는다: 「건너뛰기」(또는 연출 끝)가 결과를 확정해 보인 뒤에만 「출생신고 보기」가 동작한다
      return s.spin ? s : withGame(s, enterBirth(s.game));
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
      return { ...s, game: a.game, tick: null, showTitle: false, spin: false };
  }
}
