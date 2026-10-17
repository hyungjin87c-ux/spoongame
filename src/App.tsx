import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import {
  GAME_KEY,
  SETTINGS_KEY,
  autoChoiceDelayMs,
  classifySavedGame,
  createInitialState,
  createSession,
  decideSave,
  getBrowserStorage,
  hasProgress,
  holdDelayMs,
  isSupersedingChange,
  parseGame,
  parseSettings,
  saveGame,
  saveSettings,
  serializeGame,
  serializeSettings,
  sessionReducer,
  type Session,
  type StorageLike,
} from './core';
import { BirthScreen } from './screens/BirthScreen';
import { RouletteScreen } from './screens/RouletteScreen';
import { EndingScreen } from './screens/EndingScreen';
import { ErrorBoundary } from './screens/ErrorBoundary';
import { LifeScreen } from './screens/LifeScreen';
import { SupersededScreen } from './screens/SupersededScreen';
import { TitleScreen } from './screens/TitleScreen';
import { LegacyLight } from './ui/legacyTheme';

/**
 * 개발 서버 전용 탐침 (프로덕션 빌드에서는 import.meta.env.DEV가 false라 아래 값들이 상수로 접히고 문자열째 제거된다.
 * ?__crash·?__guard와 같은 방식. 빌드 결과에 탐침 이름이 남지 않는지는 확인했다).
 *  - ?__quota : 저장이 항상 실패하는 저장소 (저장 실패 안내 e2e, R-006)
 *  - ?__timescale=N : 연출 시간을 N배 빠르게 (e2e가 실제 30분을 기다리지 않게)
 *  - ?__crash : 렌더 중 예외 (ErrorBoundary 탈출구 e2e)
 *  - ?__exit : 진행 중인 저장이 있어도 첫 화면을 다시 연 상태로 시작한다 (「나가기」(M4)가 같은 상태를 만든다 — 첫 화면의 「이어서 살기」 e2e)
 */
const PROBE_QUOTA = import.meta.env.DEV && new URLSearchParams(window.location.search).has('__quota');
const PROBE_CRASH = import.meta.env.DEV && new URLSearchParams(window.location.search).has('__crash');
const PROBE_EXIT = import.meta.env.DEV && new URLSearchParams(window.location.search).has('__exit');
const TIME_SCALE = import.meta.env.DEV ? readTimeScale() : 1;

function readTimeScale(): number {
  const n = Number(new URLSearchParams(window.location.search).get('__timescale') ?? 1);
  return Number.isFinite(n) && n > 0 ? n : 1;
}

function resolveStorage(): StorageLike | null {
  const base = getBrowserStorage();
  if (base && PROBE_QUOTA) {
    return {
      getItem: (k) => base.getItem(k),
      removeItem: (k) => base.removeItem(k),
      setItem: () => {
        throw new DOMException('quota probe', 'QuotaExceededError');
      },
    };
  }
  return base;
}

const storage = resolveStorage();

/** 저장소의 원문(없거나 읽을 수 없으면 null). 이 탭이 마지막으로 쓴 값과 비교해 "밖에서 바뀌었는지" 알아내는 데 쓴다. */
function readRaw(key: string): string | null {
  try {
    return storage?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

/** 이 탭이 마지막으로 읽었거나 쓴 저장 원문("내가 아는 저장소의 모습"). 저장 effect가 쓰기 직전 저장소와 비교한다. */
interface WrittenRaw {
  game: string | null;
  settings: string | null;
}

function newSeed(): number {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return buf[0];
}

interface Boot {
  session: Session;
  written: WrittenRaw;
  /** 이전 버전(v4 이하) 저장을 읽지 못해 새 게임으로 시작했는가 — 첫 화면에 안내 한 줄(C6) */
  oldSave: boolean;
}

/**
 * 앱이 뜰 때 저장소를 읽는 곳 — 키마다 원문을 딱 한 번 읽고, 그 같은 원문으로 상태를 파싱하고 기준값("내가 아는 값")도 삼는다(R-052).
 * 따로 두 번 읽으면 그 사이에 다른 탭이 쓴 값 때문에 "파싱한 상태"와 "기준값"이 서로 다른 시점의 것이 되어,
 * 첫 저장이 다른 탭의 진행을 덮어쓸 수 있다.
 */
function readBoot(): Boot {
  const game = readRaw(GAME_KEY);
  const settings = readRaw(SETTINGS_KEY);
  const parsed = parseGame(game) ?? createInitialState(newSeed());
  // 진행 중인 판이 저장돼 있으면 새로고침해도 저장된 화면이 그대로 복원된다(C3). 첫 화면은 「나가기」로 다시 연 때에만 보인다(개발 서버 탐침 ?__exit은 그 상태로 시작).
  return {
    session: createSession(parsed, parseSettings(settings), PROBE_EXIT && hasProgress(parsed)),
    written: { game, settings },
    oldSave: classifySavedGame(game) === 'old-version',
  };
}

/** 개발 서버에서만: ?__crash=1 이면 렌더 중 예외를 던져 ErrorBoundary 탈출구를 e2e로 검증한다. */
function CrashProbe() {
  if (PROBE_CRASH) throw new Error('crash probe');
  return null;
}

/** 탭이 보이는 동안만 true. 보이지 않는 탭의 타이머는 브라우저가 늦추므로, 아예 멈췄다가 돌아오면 이어서 진행한다. */
function usePageVisible(): boolean {
  const [visible, setVisible] = useState(() => typeof document === 'undefined' || document.visibilityState !== 'hidden');
  useEffect(() => {
    const on = () => setVisible(document.visibilityState !== 'hidden');
    document.addEventListener('visibilitychange', on);
    return () => document.removeEventListener('visibilitychange', on);
  }, []);
  return visible;
}

/**
 * 다른 탭이 저장(게임 키)을 바꾸면 true (R-011). 마지막 쓰기 우선: 이 탭은 멈추고 저장하지 않으며,
 * 사용자가 "이 탭에서 이어하기"를 눌러야 저장된 최신 상태를 이어받는다. 같은 탭의 쓰기는 이 이벤트를 일으키지 않는다.
 * 예외(A66): 이 탭이 아는 저장이 비어 있거나 진행 없는 타이틀 상태인데 바뀐 값도 진행 없는 타이틀 상태라면 잃을 것이 없으므로 밀리지 않는다
 * (빈 저장소에서 두 탭을 동시에 열면 둘 다 첫 저장을 쓰는데, 서로의 첫 저장 때문에 둘 다 밀리던 문제). 진행이 있는 쪽의 충돌 감지는 그대로다.
 */
function useSuperseded(written: WrittenRaw): [boolean, (v: boolean) => void] {
  const [superseded, setSuperseded] = useState(false);
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === null) setSuperseded(true);
      else if (e.key === GAME_KEY && isSupersedingChange(e.newValue, written.game)) setSuperseded(true);
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [written]);
  return [superseded, setSuperseded];
}

function Game() {
  // 저장소는 여기서 한 번만 읽는다(lazy 초기값). 이 탭이 마지막으로 읽거나 쓴 원문(written)은 아래 effect들이 갱신하는 가변 객체다.
  const [{ session: initial, written, oldSave }] = useState(readBoot);
  const [session, dispatch] = useReducer(sessionReducer, initial);
  const { game, settings, tick, showTitle, spin } = session;
  // 이전 버전 저장 안내는 첫 화면에 한 번만: 새 판이 시작되면(첫 화면을 떠나면) 다시 보이지 않는다.
  const [showOldNotice, setShowOldNotice] = useState(oldSave);
  useEffect(() => {
    if (game.phase !== 'title') setShowOldNotice(false);
  }, [game.phase]);
  const visible = usePageVisible();
  const [superseded, setSuperseded] = useSuperseded(written);
  const [gameSaveFailed, setGameSaveFailed] = useState(false);
  const [settingsSaveFailed, setSettingsSaveFailed] = useState(false);

  // 상태가 바뀔 때마다 자동 저장. setItem은 키 단위로 원자적이라 쓰기 도중 새로고침돼도 이전 값 또는 새 값 중 하나만 남는다.
  // 저장 effect는 쓰기 직전에 저장소를 다시 읽어 "내가 아는 값"(처음 읽었거나 마지막으로 쓴 값, written)과 비교한다(decideSave, R-052):
  //  - 저장소가 이미 지금 상태 그대로면 쓰지 않는다(새 탭이 마운트 직후 읽은 값을 그대로 다시 쓰다가 그 사이 다른 탭이 진행한 값을 한 걸음 되돌리는 일을 막는다, R-047).
  //    쓸 것이 없다는 것은 잃을 것이 없다는 뜻이라 저장 실패 안내도 지운다(저장이 막혔다가 "이어하기"로 저장된 최신 상태를 이어받은 뒤에 안내가 남지 않게).
  //  - 저장소가 내가 아는 값과 다르면 그 사이 다른 탭이 바꾼 것이므로(storage 이벤트 리스너를 붙이기 전의 변경 포함) 덮어쓰지 않고 밀린 화면으로 보낸다(R-011).
  //  - 그 밖에는 쓴다. 저장에 실패하면 가벼운 안내만 띄우고 계속 동작한다(R-006). 다른 탭에 밀린 탭은 저장하지 않는다.
  useEffect(() => {
    if (superseded) return;
    const raw = serializeGame(game);
    const stored = readRaw(GAME_KEY);
    const decision = decideSave(stored, written.game, raw);
    if (decision === 'conflict') {
      setSuperseded(true);
      return;
    }
    if (decision === 'unchanged') {
      written.game = stored;
      setGameSaveFailed(false);
      return;
    }
    const ok = saveGame(storage, game);
    if (ok) written.game = raw;
    setGameSaveFailed(!ok);
  }, [game, superseded, setSuperseded, written]);
  // 설정은 마지막 쓰기 우선이다(진행을 잃지 않으므로 밀린 화면 대상이 아니다). 이미 저장소에 있는 값이면 쓰지 않고 실패 안내도 지운다.
  useEffect(() => {
    const raw = serializeSettings(settings);
    if (raw === written.settings) {
      setSettingsSaveFailed(false);
      return;
    }
    const ok = saveSettings(storage, settings);
    if (ok) written.settings = raw;
    setSettingsSaveFailed(!ok);
  }, [settings, written]);

  // 탭을 닫거나 새로고침하는 순간에도 가장 최신 상태를 한 번 더 저장한다(효과가 돌기 전에 떠나는 경우 대비).
  const latest = useRef(session);
  const supersededRef = useRef(superseded);
  useEffect(() => {
    latest.current = session;
    supersededRef.current = superseded;
  });
  useEffect(() => {
    // 저장소가 이 탭이 쓴 값 그대로일 때만 쓴다(decideSave === 'write'): 개발자 도구로 저장을 지우거나 바꾼 뒤 새로고침하면 그 변경이 존중된다.
    // 쓰고 나면 "내가 아는 값"도 갱신해야 이어지는 저장 effect가 자기 쓰기를 남의 변경으로 오해하지 않는다.
    const flush = () => {
      if (supersededRef.current) return;
      const gameRaw = serializeGame(latest.current.game);
      if (decideSave(readRaw(GAME_KEY), written.game, gameRaw) === 'write' && saveGame(storage, latest.current.game)) written.game = gameRaw;
      const settingsRaw = serializeSettings(latest.current.settings);
      if (readRaw(SETTINGS_KEY) === written.settings && settingsRaw !== written.settings && saveSettings(storage, latest.current.settings)) written.settings = settingsRaw;
    };
    const onHide = () => {
      if (document.visibilityState === 'hidden') flush();
    };
    window.addEventListener('pagehide', flush);
    document.addEventListener('visibilitychange', onHide);
    return () => {
      window.removeEventListener('pagehide', flush);
      document.removeEventListener('visibilitychange', onHide);
    };
  }, [written]);

  // 한 해 진행 타이머. 타이머는 UI 계층에만 있고, 상태 갱신은 reducer 하나로만 한다(R-005).
  // 'advance'는 자기가 알던 나이(fromAge)를 들고 가서 상황이 달라졌으면 무시되므로, 겹치거나 지연된 타이머가 한 해를 두 번 진행하지 못한다.
  // 선택지가 대기 중이거나 사망했거나 탭이 가려져 있으면 타이머를 걸지 않는다(배속·자동 모드와 무관하게 선택지에서 멈춘다).
  useEffect(() => {
    if (game.phase !== 'life' || game.pending !== null || superseded || !visible || showTitle) return;
    const delay = holdDelayMs(tick?.kind ?? null, settings.speed, TIME_SCALE);
    if (delay === null) return;
    const fromAge = game.age;
    const id = window.setTimeout(() => dispatch({ type: 'advance', fromAge }), delay);
    return () => window.clearTimeout(id);
  }, [game.phase, game.age, game.pending, tick, settings.speed, superseded, visible, showTitle]);

  // 자동 모드: 선택지를 잠깐 보여 준 뒤 성향대로 고른다. 해제하면 타이머가 정리되고 선택지는 그대로 남는다.
  useEffect(() => {
    if (!settings.autoMode || game.pending === null || superseded || !visible || showTitle) return;
    const key = game.pending.key;
    const id = window.setTimeout(() => dispatch({ type: 'autoChoose', key }), autoChoiceDelayMs(settings.speed, TIME_SCALE));
    return () => window.clearTimeout(id);
  }, [settings.autoMode, settings.speed, game.pending, superseded, visible, showTitle]);

  const takeOver = useCallback(() => {
    // 저장소를 한 번만 읽어, 그 원문을 파싱해 이어받고 "내가 아는 값"으로도 기록한다(R-052). 이어받은 값은 저장소에 이미 있는 값이라 같은 값을 다시 쓰지 않는다.
    const raw = readRaw(GAME_KEY);
    written.game = raw;
    dispatch({ type: 'adopt', game: parseGame(raw) ?? createInitialState(newSeed()) });
    setSuperseded(false);
  }, [setSuperseded, written]);

  let screen;
  // 첫 화면·룰렛·출생신고는 새 디자인(시스템의 라이트·다크를 따른다)이고, 나머지(인생·엔딩·밀린 화면·오류 화면)는 아직 고정 색의 옛 화면이라 그동안 색 구성표를 라이트로 고정한다(R-208).
  // 새 디자인 화면이 늘면(M4 대시보드·엔딩) 이 목록에 더한다.
  const onNewDesign = !superseded && (game.phase === 'title' || game.phase === 'roulette' || game.phase === 'birth' || showTitle);
  if (superseded) {
    screen = <SupersededScreen onTakeOver={takeOver} />;
  } else if (game.phase === 'title' || showTitle) {
    // 첫 화면: 새 판의 시작(title 단계) 또는 진행 중인 판을 둔 채 다시 연 화면(showTitle, 「나가기」). 후자는 「이어서 살기」가 기본 버튼이다.
    screen = (
      <TitleScreen
        era={settings.era}
        lifeLength={settings.lifeLength}
        onSelectEra={(era) => dispatch({ type: 'setEra', era })}
        onSelectLifeLength={(lifeLength) => dispatch({ type: 'setLifeLength', lifeLength })}
        onBegin={() => dispatch({ type: 'begin' })}
        saved={showTitle && hasProgress(game) ? { onResume: () => dispatch({ type: 'resume' }), onBeginNew: () => dispatch({ type: 'beginNew', seed: newSeed() }) } : null}
        oldSaveNotice={showOldNotice && game.phase === 'title'}
      />
    );
  } else if (game.phase === 'roulette' && game.era && game.character && game.birthReport) {
    // 룰렛: 결과는 「태어나기」 순간 이미 저장돼 있고(RL5) 이 화면은 그 결과를 연출로 보여 준다. spin은 저장되지 않는 세션 상태라 새로고침하면 결과가 확정된 모습으로 열린다.
    screen = (
      <RouletteScreen
        era={game.era}
        character={game.character}
        report={game.birthReport}
        spin={spin}
        onFinishSpin={() => dispatch({ type: 'finishSpin' })}
        onNext={() => dispatch({ type: 'enterBirth' })}
      />
    );
  } else if (game.phase === 'birth' && game.era && game.character && game.birthReport && game.peerSeed !== null) {
    screen = <BirthScreen era={game.era} character={game.character} report={game.birthReport} peerSeed={game.peerSeed} onNext={() => dispatch({ type: 'enterLife' })} />;
  } else if (game.phase === 'life' && game.character) {
    screen = (
      <LifeScreen
        game={{ ...game, character: game.character }}
        settings={settings}
        tick={tick}
        onChoose={(key, choiceId) => dispatch({ type: 'choose', key, choiceId })}
        onSkip={() => dispatch({ type: 'skip' })}
        onSpeed={(speed) => dispatch({ type: 'setSpeed', speed })}
        onAuto={(auto) => dispatch({ type: 'setAuto', auto })}
      />
    );
  } else if (game.phase === 'ending' && game.character && game.death && game.era && game.birthStats) {
    // 다시 태어나기: 새 시드를 UI에서 한 번 뽑아 넘긴다(core는 난수 원천을 만들지 않는다). reducer는 ending에서만 받아들여 연타에도 새 판은 하나뿐이다.
    screen = (
      <EndingScreen
        game={{ ...game, character: game.character, death: game.death, era: game.era, birthStats: game.birthStats }}
        onRebirth={() => dispatch({ type: 'rebirth', seed: newSeed() })}
      />
    );
  } else {
    // 저장 검증을 통과했다면 올 수 없는 상태 — ErrorBoundary의 탈출구("저장 지우고 새로 시작")로 보낸다.
    throw new Error(`알 수 없는 화면 상태: ${game.phase}`);
  }

  return (
    <>
      {gameSaveFailed || settingsSaveFailed ? (
        <p className="notice" role="status" data-testid="save-notice">
          저장하지 못했습니다. 이 화면을 닫으면 진행이 사라질 수 있습니다.
        </p>
      ) : null}
      {onNewDesign ? null : <LegacyLight />}
      {screen}
    </>
  );
}

export function App() {
  return (
    <ErrorBoundary>
      <CrashProbe />
      <Game />
    </ErrorBoundary>
  );
}

