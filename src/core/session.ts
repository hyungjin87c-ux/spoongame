import { EVENT_POOL } from '../data/events';
import type { EventPool } from './events';
import { advanceUntilDecision, autoResolveStep, resolveChoiceStep, stepYear, type RunResult, type TickInfo } from './life';
import { consumeNote, dueNote, noteResponse, writeNote, type NoteMode } from './notes';
import { playEqual, playNotBehind, readPlay } from './playClock';
import { DEFAULT_SETTINGS, beginBirth, createInitialState, enterBirth, enterLife, rebirth, setPaused } from './state';
import {
  BGM_VOLUME_MAX,
  BGM_VOLUME_MIN,
  ERAS,
  SPEEDS,
  THEMES,
  isLifeLengthSelectable,
  type BgmSettings,
  type Era,
  type GameState,
  type LifeLength,
  type PlaySettings,
  type PlayTime,
  type Settings,
  type Speed,
  type ThemeChoice,
} from './types';

/**
 * 화면(UI)이 쓰는 상태 묶음과 reducer. 순수 함수라서 React 없이 vitest로 검증한다(R-005).
 *
 * 모든 갱신은 이 reducer 하나를 거친다: 타이머·클릭·자동 모드·다른 탭의 변경이 겹쳐도 항상 "가장 최신 상태"에 적용되고,
 * 각 액션은 자기가 알고 있던 상황(나이 / 선택지 키)을 함께 들고 와서 상황이 달라졌으면 무시된다(멱등):
 *  - advance(fromAge): 나이가 다르거나 선택지가 대기 중이면 무시 → 같은 해가 두 번 진행되지 않는다(StrictMode 이중 실행, 겹친 타이머)
 *  - choose(key, choiceId) / autoChoose(key): 대기 중인 이벤트 인스턴스의 키와 다르면 무시 → 연타가 다음 선택지를 누르지 못한다
 *  - autoChoose: 자동 모드가 꺼져 있으면 무시 → 타이머가 울리기 직전에 사용자가 자동 모드를 해제했다면 그 선택은 일어나지 않는다(R-038)
 *  - skip(다음 결정으로): 자동 모드에서는 무시 → 자동 모드의 선택은 타이머(autoChoose)로만 일어난다. 화면도 자동 모드에서는 이 버튼을 비활성화한다(R-038)
 *    기록 카드 앞에서 멈췄고 직전 해가 부모님이 정한·흘러간 해였다면 그 걸음(tick)은 남기지 않는다 → 부모·흘러감 카드가 기록 시트 뒤에 뜨지 않는다(R-451, PD7-3). `tickAfterSkip` 참고.
 *  - begin / beginNew: 첫 화면의 「태어나기」. title 단계(begin) 또는 첫 화면을 다시 연 상태(beginNew)에서만 동작하고 한 번 동작하면 단계가 바뀌어
 *    더블탭·연타의 둘째 입력은 같은 객체를 돌려받는다 → 출생은 한 번만 일어난다(FS6). 이 순간 출생 결과가 정해져 저장되고 화면은 룰렛(roulette 단계)으로 간다(RL5).
 *  - finishSpin: 룰렛 연출이 끝났거나 「건너뛰기」를 눌렀다. 연출 중임을 나타내는 세션 상태(spin)를 끈다 — 이미 꺼져 있으면 무시(건너뛰기 연타). 저장되는 값이 아니라서
 *    룰렛 도중·직후 새로고침하면 spin이 꺼진 채 열려 룰렛이 다시 돌지 않고 결과가 확정된 모습으로 복원된다(RL5).
 *  - enterBirth(「출생신고 보기」): roulette 단계에서만 동작하고 한 번 동작하면 단계가 바뀌어 연타해도 한 번이다. 연출 중(spin)에는 무시 — 건너뛰기를 먼저 눌러야 한다(결과가 확정되어 보이기 전에 넘어가지 않는다).
 *  - rebirth(seed): ending 단계에서만 동작하고 새 판은 첫 화면(title)에서 시작한다 → 더블탭·연타의 둘째 입력은 같은 객체를 돌려받아 두 판이 시작되지 않는다. 설정(배속·자동 모드·세상·인생 길이)은 그대로다.
 *  - setPaused(paused): 인생 화면의 「일시정지/다시 진행」(DB3). 인생 단계에서만, 값이 같으면 같은 객체(연타가 상태를 흔들지 않는다). 연출 시간 결정용 걸음(tick)은 그대로 둔다 — 멈췄다 풀어도 그 해의 연출이 이어진다.
 *    멈춰 있는 동안에는 해마다 진행(advance)과 자동 선택(autoChoose)이 무시된다(늦게 울린 타이머가 멈춘 인생을 한 걸음 진행시키지 않게). 사람이 하는 선택(choose)과 「다음 결정으로」(skip)는 막지 않는다.
 *  - openTitle(「나가기」): 인생 단계에서는 **일시정지 상태로** 첫 화면을 연다(DB8) — 일시정지는 저장되는 판 상태라 새로고침해도, 「이어서 살기」로 돌아와도 멈춘 채 열린다(사용자가 「다시 진행」을 눌러야 흐른다).
 *  - syncPlay(seed, play): 플레이 시간 타이머(ui/usePlayTimer.ts)가 쌓은 기록을 판 상태의 선택 필드 `play`로 옮긴다(M8). 인생 단계·같은 판·줄지 않는 올바른 기록일 때만 받고 아니면 같은 객체다.
 *  - setBgm / setTheme: 대시보드 도구 줄의 BGM(켬/끔·볼륨)과 다크 모드(수동 선택 저장). 설정이라 어느 화면에서든 받는다.
 *  - 기록 카드(M7c, core/notes.ts): 적격 카드(`dueNote` — 해의 첫머리, 결정 대기 없음)를 만나면 `advance`·`skip`은 **수동 + `noteCards` 켜짐**이면 멈추고(화면이 시트를 띄운다 — 시트는 파생 상태다),
 *    **자동 모드이거나 `noteCards`가 꺼져 있으면** 시트 없이 소비한다(`seen` 표시, 연표 줄 없음 = 「마음속에 담고 살기」와 같다). `choose`·`autoChoose`가 해를 마치고 새 해의 첫머리에서 카드를 만나면 소비 모드에서는 바로 소비한다(멈춤 모드는 파생).
 *    saveNote(cardId|null, text, expectCount?): 「적어두고 살기」 — 글을 정규화해 연표에 더한다(자동 카드는 지금 뜰 차례의 카드여야 하고, 수동 기록은 cardId null). 빈 입력·40개 도달·이미 늘어난 기록 수(연타)·이미 소비된 카드는 같은 객체.
 *    dismissNote(cardId): 「마음속에 담고 살기」 — 지금 뜰 차례의 카드를 소비한다(저장 없음). 이미 소비됐으면 같은 객체(연타). setNoteCards(on): 「자동 기록 카드 끄기/켜기」(설정, 새 인생으로 넘어가도 유지).
 *    기록은 인생(스탯·자산·플래그·rngState)을 바꾸지 않는다 — 카드를 어떻게 처리하든 인생이 같다(tests/noteInvariance.test.ts).
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
  /** 인생 화면: 일시정지/다시 진행 (인생 단계에서만, 저장되는 판 상태) */
  | { type: 'setPaused'; paused: boolean }
  /** 인생 화면 도구 줄: BGM 켬/끔·볼륨(일부만 줘도 된다. 볼륨은 0~100 정수로 맞춘다) */
  | { type: 'setBgm'; bgm: Partial<BgmSettings> }
  /** 인생 화면 도구 줄: 화면 테마 수동 선택 */
  | { type: 'setTheme'; theme: ThemeChoice }
  /** 기록 시트의 「1. 적어두고 살기」: cardId는 지금 뜰 차례인 자동 카드 id 또는 null(「생각 남기기」 수동 기록). expectCount는 열 때의 기록 수(연타 방어). */
  | { type: 'saveNote'; cardId: string | null; text: string; expectCount?: number }
  /** 기록 시트의 「2. 마음속에 담고 살기」: 지금 뜰 차례인 자동 카드를 소비한다(저장 없음) */
  | { type: 'dismissNote'; cardId: string }
  /** 기록 시트의 「자동 기록 카드 끄기/켜기」: 설정만 바꾼다 */
  | { type: 'setNoteCards'; on: boolean }
  /** 엔딩에서 새 시드로 새 판을 시작해 첫 화면으로 간다(설정은 그대로). 시드는 UI가 정해 넘긴다. */
  | { type: 'rebirth'; seed: number }
  /** 플레이 시간 타이머(ui/usePlayTimer.ts)가 쌓은 기록을 판 상태에 옮긴다. seed는 그 기록이 속한 판의 시드(다른 판의 오래된 기록이 새 판에 새지 않게). 인생 단계에서만, 줄어드는 기록·같은 기록은 같은 객체. */
  | { type: 'syncPlay'; seed: number; play: PlayTime }
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

/**
 * 「다음 결정으로」(`skip`)가 세션에 남기는 걸음 (R-451, SPEC-005 PD7-3 「이 경우 카드는 화면에 뜨지 않는다」).
 * 기록 카드(수동 + `noteCards` 켜짐)가 해의 첫머리에서 건너뛰기를 멈춰 세우면 `r.last`는 **그 직전 해**의 걸음이다 — 그 해가 부모님이 정했거나 흘러간 해(`by`)였다면
 * 새 해의 나이가 `fromAge + 1`이라 부모·흘러감 카드(`parentCardModel`)가 기록 시트 뒤에 뜨고, 시트를 닫으면 카드의 필요량(18~44초)만큼 기다리게 된다.
 * 건너뛴 해는 연출 없이 지나갔으므로 그 걸음을 남기지 않는다(null = 새로고침 직후와 같다: 카드 없음, 기록 줄만 남는다).
 * 위임이 아닌 해(서술·본인이 고른 해)의 걸음은 그대로 둔다 — 그 뒤의 연출 대기 계산은 지금과 같다.
 */
function tickAfterSkip(r: RunResult): TickInfo | null {
  return r.stoppedForNote !== undefined && r.last.by !== undefined ? null : r.last;
}

/**
 * 세션이 기록 카드를 어떻게 다루는가: `live`(기본)는 위 설명대로 설정(자동 모드·`noteCards`)을 따르고, `ignore`는 진행 액션이 카드를 아예 보지 않는다 —
 * 기록 시트가 없는 화면(M7c UI 전의 배포 판)과 시뮬레이션이 쓴다. `saveNote`·`dismissNote`·`setNoteCards`는 어느 쪽이든 동작한다.
 */
export type NoteHandling = 'live' | 'ignore';

/** 소비 모드에서는 해가 바뀐 직후의 새 해 첫머리 카드를 바로 소비한다(멈춤·무시 모드는 그대로) */
function settleNotes(game: GameState, mode: NoteMode): GameState {
  if (mode !== 'consume') return game;
  const due = dueNote(game);
  return due === null ? game : consumeNote(game, due);
}

export function sessionReducer(s: Session, a: SessionAction, pool: EventPool = EVENT_POOL, handling: NoteHandling = 'live'): Session {
  const mode: NoteMode = handling === 'ignore' ? 'ignore' : noteResponse(s.settings, s.game);
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
      // 인생 중이면 일시정지 상태로 저장한다(DB8). 출생신고·룰렛 단계는 흐르는 시간이 없어 일시정지가 의미 없다.
      return s.showTitle || !hasProgress(s.game) ? s : { ...s, game: setPaused(s.game, true), showTitle: true, tick: null, spin: false };
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
      if (s.game.age !== a.fromAge || s.game.paused) return s;
      let game = s.game;
      if (mode !== 'ignore') {
        const due = dueNote(game);
        if (due !== null) {
          if (mode === 'stop') return s; // 기록 시트가 열릴 차례 — 해를 진행하지 않는다(시트에서 쓰거나 담아 두면 진행이 이어진다)
          game = consumeNote(game, due);
        }
      }
      const r = stepYear(game, pool);
      return withGame(s, settleNotes(r.state, mode), r.tick);
    }
    case 'choose': {
      const r = resolveChoiceStep(s.game, a.key, a.choiceId, pool);
      return withGame(s, settleNotes(r.state, mode), r.tick);
    }
    case 'autoChoose': {
      if (!s.settings.autoMode || s.game.paused) return s;
      const r = autoResolveStep(s.game, a.key, pool);
      return withGame(s, settleNotes(r.state, mode), r.tick);
    }
    case 'skip': {
      // 다음 결정으로: 선택지(또는 사망)까지 연출 없이 즉시. 선택은 사람이 한다(자동 모드에서는 이 동작이 없다 — 위 설명).
      // 일시정지(`paused`) 중에도 동작한다 — 사용자가 직접 누르는 입력이라 시계(advance·autoChoose가 멈춘다)와 상관이 없고, 선택지에서 멈춘 판은 일시정지 그대로다(R-331, tests/dashSession.test.ts).
      if (s.settings.autoMode || s.game.phase !== 'life' || s.game.pending !== null) return s;
      const r = advanceUntilDecision(s.game, pool, mode);
      return withGame(s, r.state, tickAfterSkip(r));
    }
    case 'setSpeed':
      return !(SPEEDS as readonly number[]).includes(a.speed) || a.speed === s.settings.speed
        ? s
        : { ...s, settings: { ...s.settings, speed: a.speed } };
    case 'setAuto':
      return a.auto === s.settings.autoMode ? s : { ...s, settings: { ...s.settings, autoMode: a.auto } };
    case 'setPaused': {
      if (s.showTitle) return s;
      const game = setPaused(s.game, a.paused);
      return game === s.game ? s : { ...s, game }; // tick은 그대로(위 설명)
    }
    case 'setBgm': {
      const on = typeof a.bgm.on === 'boolean' ? a.bgm.on : s.settings.bgm.on;
      const raw = a.bgm.volume;
      const volume = typeof raw === 'number' && Number.isFinite(raw) ? Math.min(BGM_VOLUME_MAX, Math.max(BGM_VOLUME_MIN, Math.round(raw))) : s.settings.bgm.volume;
      return on === s.settings.bgm.on && volume === s.settings.bgm.volume ? s : { ...s, settings: { ...s.settings, bgm: { on, volume } } };
    }
    case 'setTheme':
      return !(THEMES as readonly string[]).includes(a.theme) || a.theme === s.settings.theme ? s : { ...s, settings: { ...s.settings, theme: a.theme } };
    case 'saveNote': {
      if (s.showTitle) return s;
      const game = writeNote(s.game, { cardId: a.cardId, text: a.text, expectCount: a.expectCount });
      return game === s.game ? s : { ...s, game }; // tick은 그대로(연출 시간 결정용 걸음은 기록과 무관하다)
    }
    case 'dismissNote': {
      if (s.showTitle) return s;
      const due = dueNote(s.game);
      return due === null || due.id !== a.cardId ? s : { ...s, game: consumeNote(s.game, due) };
    }
    case 'setNoteCards':
      return typeof a.on !== 'boolean' || a.on === s.settings.noteCards ? s : { ...s, settings: { ...s.settings, noteCards: a.on } };
    case 'rebirth':
      return withGame(s, rebirth(s.game, a.seed));
    case 'syncPlay': {
      // 플레이 시간 기록 옮기기(M8): 이 판의 기록이 있는 인생 단계에서만, 같은 판(seed)의 값이고 줄어들지 않는 올바른 기록일 때만 받는다. 아니면 같은 객체(연타·늦게 도착한 오래된 기록이 상태를 흔들지 않는다).
      const current = s.game.play;
      const next = readPlay(a.play);
      if (s.game.phase !== 'life' || current === undefined || next === undefined || a.seed !== s.game.seed || !playNotBehind(next, current) || playEqual(next, current)) return s;
      return { ...s, game: { ...s.game, play: next } }; // tick은 그대로(연출 시간 결정용 걸음은 시간 기록과 무관하다)
    }
    case 'adopt':
      return { ...s, game: a.game, tick: null, showTitle: false, spin: false };
  }
}
