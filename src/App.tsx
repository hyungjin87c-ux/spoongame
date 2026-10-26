import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import {
  GAME_KEY,
  SETTINGS_KEY,
  autoChoiceDelayMs,
  classifySavedGame,
  createInitialState,
  createSession,
  decideSave,
  dueNote,
  getBrowserStorage,
  hasProgress,
  holdDelayMs,
  isIdleOnlyChange,
  isNegligibleChange,
  isSupersedingChange,
  lifeLineCount,
  noteCount,
  noteResponse,
  parseGame,
  parseSettings,
  playBucketOf,
  playNotBehind,
  saveGame,
  saveSettings,
  serializeGame,
  serializeSettings,
  sessionReducer,
  type GameState,
  type PlayTime,
  type Session,
  type SessionAction,
  type StorageLike,
} from './core';
import { BirthScreen } from './screens/BirthScreen';
import { RouletteScreen } from './screens/RouletteScreen';
import { EndingScreen } from './screens/EndingScreen';
import { ErrorBoundary } from './screens/ErrorBoundary';
import { LifeScreen, type NoteSheetState } from './screens/LifeScreen';
import { SupersededScreen } from './screens/SupersededScreen';
import { TitleScreen } from './screens/TitleScreen';
import { useApplyTheme } from './ui/theme';
import { FOLD_INITIAL, autoChooseArmed, foldCard as foldState, isFolded, leaveLife, reopenCard as reopenState, type FoldState } from './ui/decisionFold';
import { useBgm } from './ui/useBgm';
import { usePlayTimer, type PlayTimer } from './ui/usePlayTimer';
import { useYearClock } from './ui/useYearClock';

/**
 * 개발 서버 전용 탐침 (프로덕션 빌드에서는 import.meta.env.DEV가 false라 아래 값들이 상수로 접히고 문자열째 제거된다.
 * ?__crash·?__guard와 같은 방식. 빌드 결과에 탐침 이름이 남지 않는지는 확인했다).
 *  - ?__quota : 저장이 항상 실패하는 저장소 (저장 실패 안내 e2e, R-006)
 *  - ?__timescale=N : 연출 시간을 N배 빠르게 (e2e가 실제 30분을 기다리지 않게). 플레이 시간 타이머는 연출(hold)에 흐른 시간에 N을 곱해 모델 시간으로 센다(core/playClock.ts#AccrueContext)
 *  - ?__crash : 렌더 중 예외 (ErrorBoundary 탈출구 e2e)
 *  - ?__exit : 진행 중인 저장이 있어도 첫 화면을 다시 연 상태로 시작한다 (「나가기」(M4)가 같은 상태를 만든다 — 첫 화면의 「이어서 살기」 e2e)
 *  - window.__playTime() : 플레이 시간 타이머가 지금까지 쌓은 기록을 저장하지 않고 읽는다 (e2e/m8-playtime — 저장으로 읽으면 수동적인 시간(idle)만 바뀐 기록은 쓰지 않으므로 R-417 이후 읽을 수 없다)
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
  // 이어하기 횟수(플레이 시간 기록 — 그 해 연출이 처음부터 다시 흘러 hold가 한 해 안쪽만큼 늘 수 있어 보정에서 감안한다, content-M8.md 5-2절)는 여기서 올리지 않는다: 읽은 원문과 상태가 달라져 사람이 아무것도 하지 않은 탭도 첫 저장 effect가 쓰기 때문이다(R-417).
  // 그 탭에서 hold·decide가 처음 쌓일 때 타이머가 올린다(core/playTimer.ts).
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

/** 인생 도중 플레이 시간 기록을 저장소에 쓰는 간격(ms) */
const PLAY_SAVE_MS = 10_000;

/** 자동 고르기 버튼의 전환 문장(낭독 영역)이 남아 있는 시간(ms) — 읽힌 뒤 비운다(자동 선택 때마다 낭독되지 않게, content-M7b 4-3) */
const AUTO_STATUS_MS = 2000;

/** 저장 직전, 타이머가 쌓은 기록이 상태의 기록보다 새로우면(같은 판·줄어들지 않음) 담는다. 그 밖에는 상태 그대로. */
function withPlayNow(game: GameState, now: { seed: number; play: PlayTime } | null): GameState {
  return now !== null && game.phase === 'life' && game.play !== undefined && game.seed === now.seed && playNotBehind(now.play, game.play) ? { ...game, play: now.play } : game;
}

function Game() {
  // 저장소는 여기서 한 번만 읽는다(lazy 초기값). 이 탭이 마지막으로 읽거나 쓴 원문(written)은 아래 effect들이 갱신하는 가변 객체다.
  const [{ session: initial, written, oldSave }] = useState(readBoot);
  const [session, rawDispatch] = useReducer(sessionReducer, initial);
  // 상태를 바꾸는 모든 액션은 이 dispatch를 거친다: 그 직전에 플레이 시간 타이머가 지금까지의 시간을 판 상태로 옮긴다(syncPlay) — 사망으로 엔딩에 들어가는 액션 직전의 시간까지 정확히 담긴다. 타이머는 아래에서 만들어 ref에 넣는다.
  const timerRef = useRef<PlayTimer | null>(null);
  const dispatch = useCallback((a: SessionAction) => {
    timerRef.current?.sync();
    rawDispatch(a);
  }, []);
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
  // 나가기 확인 단계가 열려 있는가(DB8): 열려 있는 동안은 인생이 흐르지 않는다. 인생 화면을 떠나면(첫 화면 다시 열기·엔딩 등) 닫는다.
  const [exitAsk, setExitAsk] = useState(false);
  useEffect(() => {
    if (game.phase !== 'life' || showTitle) setExitAsk(false);
  }, [game.phase, showTitle]);
  // 중대 결정 카드의 접힘 (M7b U10 — 상태는 App 수준이라 M7c의 생각 남기기 카드가 읽는다): 접힌 선택지의 키 + 접기·다시 열기 횟수(epoch — 입력 가드를 새로 건다, U9).
  // UI 상태일 뿐 저장하지 않는다 — 새로고침하면 열린 카드로 복원된다(U5, 저장 스키마 불변). 키로 묶여 있어 다음 선택지는 늘 열린 채 뜨고, 인생 화면을 떠나면(첫 화면 다시 열기·엔딩) 지운다.
  const [fold, setFold] = useState<FoldState>(FOLD_INITIAL);
  const pendingKey = game.pending?.key ?? null;
  const folded = isFolded(fold, pendingKey);
  useEffect(() => {
    if (game.phase !== 'life' || showTitle) setFold(leaveLife);
  }, [game.phase, showTitle]);
  const foldCard = useCallback(() => setFold((f) => foldState(f, pendingKey)), [pendingKey]);
  const reopenCard = useCallback(() => setFold(reopenState), []);
  // 가린 결정 카드의 펼침 (SPEC-005 QI6 HV4 ②, M19): 「펼쳐서 읽기」로 연 선택지의 키 + 그때의 설정값. 접힘처럼 App 메모리 상태일 뿐 저장하지 않는다 — 접기 → 다시 열기에서는 유지되고(같은 키),
  // 설정값이 바뀌면 키가 같아도 다시 가려지며(펼침 초기화), 인생 화면을 떠나면(첫 화면 다시 열기·엔딩) 지운다. 새로고침하면 다시 가린다.
  const [veilOpen, setVeilOpen] = useState<{ gentle: boolean; key: string | null }>({ gentle: false, key: null });
  const veilOpened = pendingKey !== null && veilOpen.key === pendingKey && veilOpen.gentle === settings.gentle;
  useEffect(() => {
    if (game.phase !== 'life' || showTitle) setVeilOpen((v) => (v.key === null ? v : { gentle: v.gentle, key: null }));
  }, [game.phase, showTitle]);
  // 입력 가드 세대 (M7c r2 F-1, content-M7c 11-1): 사용자가 모달 시트(기록·결정)를 닫는 **같은 이벤트·같은 렌더**에서 올린다 — 시트가 사라지며 `inert`가 풀리는 순간 그 자리에 드러나는 컨트롤이
  // 이미 400ms 가드 중이어야 더블탭의 둘째 탭이 눌리지 않는다(`useEffect`로 다음 렌더에 올리면 한 프레임 열린 채 그려진다). 접기·다시 열기의 `fold.epoch`와 더해 한 값으로 LifeScreen에 넘긴다(둘 다 단조 증가).
  // 자동 선택(`autoChoose`)·시트 없는 소비(자동 모드·카드 끔·기록 40개)는 사용자가 누른 것이 아니라 올리지 않는다(G8).
  const [inputEpoch, setInputEpoch] = useState(0);
  const bumpGuard = useCallback(() => setInputEpoch((n) => n + 1), []);
  // 가린 카드의 두 버튼: 「펼쳐서 읽기」는 사라지는 버튼 자리에 선택지 버튼이 드러나므로 같은 렌더에서 입력 가드를 올린다(더블탭의 둘째 탭이 선택지를 누르지 않게, F-1과 같은 이유).
  // 「이번에는 자동으로 고르기」는 지금의 자동 선택 성향으로 한 번 고르는 일이라 reducer가 `choose`와 같은 경로를 탄다(autoPick) — 카드가 사라지는 자리의 컨트롤도 같은 이유로 가드를 올린다.
  const openVeil = useCallback(() => {
    setVeilOpen({ gentle: settings.gentle, key: pendingKey });
    bumpGuard();
  }, [settings.gentle, pendingKey, bumpGuard]);
  const autoPick = useCallback(
    (key: string) => {
      dispatch({ type: 'autoPick', key });
      bumpGuard();
    },
    [bumpGuard],
  );
  // 결정 카드 맨 끝의 자동 고르기 버튼 (SPEC-005 r4 UX12·QI12 — 마스터 결정 M-6을 이 버튼 하나에 한해 개정): 새 상태·새 설정 키 없이 기존 자동 모드(`setAuto`)를 켜고 끄는 또 하나의 길이다 — 도구 줄 「자동 모드」와 같은 액션이라
  // 같은 시드·같은 선택이면 두 길로 켠 판의 상태 전체·플레이 시간의 자동 모드 표시·엔딩 보조 문장이 같다. 이 길이 더 하는 일 둘: ① 같은 렌더에서 입력 가드 세대를 올린다 — 시트가 사라지며 `inert`가 풀리는(켬) 또는 시트가 생기는(끔) 자리의 컨트롤이
  // 더블탭의 둘째 탭에 눌리지 않게 한다(F-1·U9; 새로 마운트되는 카드의 버튼은 마운트 가드도 걸린다) ② 전환을 스크린리더가 한 번 알리는 문장(`autoStatus`)을 켜고 잠시 뒤 비운다. 포커스는 `useLifeFocus`의 `autoTurnedOn`·`autoTurnedOff`가 제목으로 옮긴다.
  // 자동 선택 타이머는 `settings.autoMode`가 바뀐 그 순간부터 `AUTO_CHOICE_MS`를 센다(아래 효과의 의존 값) — 전환 뒤에도 선택지를 직접 골라도 된다.
  const [autoStatus, setAutoStatus] = useState<'on' | 'off' | null>(null);
  const autoFromCard = useCallback(
    (auto: boolean) => {
      dispatch({ type: 'setAuto', auto });
      bumpGuard();
      setAutoStatus(auto ? 'on' : 'off');
    },
    [bumpGuard],
  );
  useEffect(() => {
    if (autoStatus === null) return;
    const id = window.setTimeout(() => setAutoStatus(null), AUTO_STATUS_MS);
    return () => window.clearTimeout(id);
  }, [autoStatus]);
  useEffect(() => {
    if (game.phase !== 'life' || showTitle) setAutoStatus(null);
  }, [game.phase, showTitle]);

  // 기록 시트 「생각 남기기」(M7c, FR1~FR9): 열려 있는지는 App 수준 한 값 `noteOpen`이다 — 연출 시계·자동 선택 타이머가 멈추고(LM5) M8의 플레이 시간 타이머가 같은 값을 읽는다.
  // 두 길로 열린다. ① 저절로 뜬 카드: 적격 카드(`dueNote` — 해의 첫머리, 결정 대기 없음)는 **파생 상태**다 — 수동 + 「자동 기록 카드」 켜짐일 때 시트가 뜨고(reducer의 `advance`·`skip`도 같은 판정으로 멈춘다),
  // 자동 모드이거나 카드를 끄면 reducer가 시트 없이 소비한다. 새로고침하면 같은 카드가 다시 뜬다(입력한 글은 사라진다 — 초안을 저장하지 않는다, NC-8).
  // 시트 안에서 「저절로 뜨는 기록 카드 끄기」를 눌러도 시트와 글은 그대로여야 하므로, 한 번 뜬 카드는 닫힐 때까지 붙든다(`heldNoteId`). ② 도구 줄 「생각 남기기」: 수동 기록은 UI 상태 `manualNote`다(저장하지 않는다 — 새로고침하면 닫힌다).
  const inLifeNow = game.phase === 'life' && !showTitle && !superseded;
  const dueCard = inLifeNow ? dueNote(game) : null;
  const [heldNoteId, setHeldNoteId] = useState<string | null>(null);
  const autoNote = dueCard !== null && (noteResponse(settings, game) === 'stop' || heldNoteId === dueCard.id) ? dueCard : null;
  useEffect(() => {
    setHeldNoteId(autoNote === null ? null : autoNote.id);
  }, [autoNote]);
  const [manualNote, setManualNote] = useState<{ token: number; count: number } | null>(null);
  const noteTokens = useRef(0);
  useEffect(() => {
    if (!inLifeNow || autoNote !== null) setManualNote(null); // 인생 화면을 떠나거나 저절로 뜬 카드가 뜰 차례면 수동 시트는 닫힌다
  }, [inLifeNow, autoNote]);
  const noteSheet: NoteSheetState | null = autoNote !== null ? { via: 'auto', card: autoNote, token: 0 } : manualNote !== null ? { via: 'manual', card: null, token: manualNote.token } : null;
  const noteOpen = noteSheet !== null;

  // 플레이 시간 타이머 (M8 LM5·LM6): 시간을 어느 버킷에 쌓을지는 연출 시계의 `running`·자동 선택 타이머(`autoChooseArmed`)와 **같은 입력**에서 한 순수 함수(core/playClock.ts#playBucketOf)가 정한다 —
  // 시계가 도는 상태는 모두 hold, 자동 선택이 걸린 상태는 decide로 어긋나지 않는다(tests/playClock.test.ts). 누적은 ui/usePlayTimer.ts. 시간 기록이 없는 판(M8 이전 저장)은 재지 않는다.
  const playBucket = playBucketOf({
    timed: game.play !== undefined,
    inLife: game.phase === 'life',
    superseded,
    showTitle,
    exitAsk,
    visible,
    paused: game.paused,
    noteOpen,
    hasPending: game.pending !== null,
    folded,
  });
  const playTimer = usePlayTimer({ seed: game.seed, phase: game.phase, play: game.play, bucket: playBucket, speedOne: settings.speed === 1, auto: settings.autoMode, timeScale: TIME_SCALE, dispatch: rawDispatch });
  timerRef.current = playTimer;
  useEffect(() => {
    if (import.meta.env.DEV) {
      const probe = window as unknown as { __playTime?: () => PlayTime | null };
      probe.__playTime = () => timerRef.current?.peek()?.play ?? null;
      return () => {
        delete probe.__playTime;
      };
    }
  }, []);
  const playBucketRef = useRef(playBucket);
  const openNote = useCallback(() => {
    // 나가기 확인 단계가 열린 채 「생각 남기기」: 확인 단계를 닫고 시트를 연다(5-4절)
    setExitAsk(false);
    noteTokens.current += 1;
    setManualNote({ token: noteTokens.current, count: noteCount(game) });
  }, [game]);
  const saveNote = useCallback(
    (text: string) => {
      // 수동 기록은 열 때의 기록 수를 들고 가서, 이미 늘어난 상태면 두 번째 제출을 무시한다(연타·더블탭 → 1건). 자동 카드는 소비되면 적격이 사라져 무시된다
      dispatch({ type: 'saveNote', cardId: autoNote === null ? null : autoNote.id, text, ...(autoNote === null && manualNote !== null ? { expectCount: manualNote.count } : {}) });
      setManualNote(null);
      bumpGuard(); // 시트가 사라지는 같은 렌더에서 컨트롤에 가드를 건다 (F-1)
    },
    [autoNote, manualNote, bumpGuard],
  );
  const dismissNote = useCallback(() => {
    if (autoNote !== null) dispatch({ type: 'dismissNote', cardId: autoNote.id });
    setManualNote(null);
    bumpGuard(); // 2번·확인 단계의 「글을 지우고 담아 두기」·40개 안내의 「닫기」·Esc가 모두 여기를 지난다 (F-1)
  }, [autoNote, bumpGuard]);
  const setNoteCards = useCallback((on: boolean) => dispatch({ type: 'setNoteCards', on }), []);
  // 화면 테마(DB6): 설정의 수동 선택을 문서에 건다(시스템 설정을 따르는 기본은 data-theme를 지운다). 모든 화면이 새 디자인이라 한 곳에서 건다.
  useApplyTheme(settings.theme);
  // BGM(DB4): 인생 화면에서만, 사용자가 한 번이라도 누른 뒤에만 소리가 난다. 탭이 가려지면 멈춘다.
  useBgm({ on: settings.bgm.on, volume: settings.bgm.volume, active: game.phase === 'life' && !showTitle && !superseded });

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
    playBucketRef.current = playBucket;
  });
  useEffect(() => {
    // 저장소가 이 탭이 쓴 값 그대로일 때만 쓴다(decideSave === 'write'): 개발자 도구로 저장을 지우거나 바꾼 뒤 새로고침하면 그 변경이 존중된다.
    // 쓰고 나면 "내가 아는 값"도 갱신해야 이어지는 저장 effect가 자기 쓰기를 남의 변경으로 오해하지 않는다.
    // 플레이 시간 기록(M8): 상태(game.play)에는 마지막 syncPlay까지만 들어 있으므로, 쓰기 직전에 타이머가 지금까지 쌓은 기록을 담아 쓴다(탭을 닫기 직전의 시간을 거의 잃지 않는다 — 마지막 쓰기 뒤 1.5초 미만은 아래 isNegligibleChange가 건너뛴다). 인생 도중 10초마다도 같은 flush를 돈다.
    // 수동적인 시간(idle)만 늘었으면 쓰지 않는다 (R-417): 열기만 한 탭·일시정지해 둔 채 배경으로 간 탭·가려진 탭을 닫는 일이 저장소에 쓰면 활성 탭이 밀린 화면으로 간다(R-047),
    // 저장이 막힌 기기에서는 진행이 없는데 열자마자 실패 안내가 뜬다(R-006·NC-11). hold·decide·fold·note·skips가 마지막 쓰기 뒤에 늘었거나 인생 상태가 다르면 쓴다.
    // 단 마지막 쓰기 뒤에 쌓인 사람의 시간이 1.5초(NEGLIGIBLE_PLAY_MS)에 못 미치면 쓰지 않는다 — 열자마자 곧바로 닫은 탭(수십~수백 ms의 decide·hold가 쌓여 있다)이 활성 탭을 밀어내지 않게(content-M8 13-3 TB01-close).
    // 보이는 탭이 결정 카드를 10초 넘게 띄워 decide가 쌓이면 그 탭이 쓰게 되고, 열기만 한 다른 탭이 밀린 화면이 되는 것은 **허용한다**(마스터 결정 M-1, content-M8 13-6): 보이는 탭에서 사람이 실제로 읽은 시간이고,
    // 쓰면 다른 탭이 밀리는 마지막 쓰기 우선(R-011)의 연장이다(R-047의 약속은 「열기만 한 탭은 쓰지 않는다」이지 「다른 탭이 쓴 뒤에도 안 밀린다」가 아니다). 진행 손실은 0이다(decideSave의 충돌 판정 그대로). 가려진 탭은 idle이라 쓰지 않는다.
    // 이 flush(10초마다·가림·pagehide)의 저장 실패는 **안내를 띄우지 않는다**(마스터 결정 M-2): 안내(save-notice)는 인생 상태를 담는 저장 effect가 실패할 때만 뜬다(R-006·NC-11). 여기서 잃는 것은 다음 주기에 다시 시도하기 전에 탭이 닫힐 때의 시간 값(표시값 오차, 아래 「잃는 시간」 범위)이지
    // 인생이 아니고, 안내를 띄우면 진행이 없는 탭이 카드를 10초 읽을 때마다 배너가 뜬다. 그래서 아래 saveGame의 결과는 written.game 갱신에만 쓰고 gameSaveFailed를 건드리지 않는다. 시험: e2e/m8-playtime-save.spec.ts 「M-2」.
    const flush = () => {
      if (supersededRef.current) return;
      const game = withPlayNow(latest.current.game, timerRef.current?.peek() ?? null);
      const gameRaw = serializeGame(game);
      if (!isIdleOnlyChange(written.game, game) && !isNegligibleChange(written.game, game) && decideSave(readRaw(GAME_KEY), written.game, gameRaw) === 'write' && saveGame(storage, game)) written.game = gameRaw;
      const settingsRaw = serializeSettings(latest.current.settings);
      if (readRaw(SETTINGS_KEY) === written.settings && settingsRaw !== written.settings && saveSettings(storage, latest.current.settings)) written.settings = settingsRaw;
    };
    const onHide = () => {
      if (document.visibilityState === 'hidden') flush();
    };
    // 인생 도중에는 10초마다(연출·결정 읽기·접기·기록 버킷이 흐르는 동안만 — 멈춘 동안에는 셀 시간이 없다). 잃는 시간(content-M8 13-8, R-423): 닫는 이벤트(pagehide·가림)가 오면 1.5초 미만, 오지 않으면 최대 약 11.5초(10초 주기 + 1.5초) — storage.ts#isNegligibleChange 참고.
    const periodic = window.setInterval(() => {
      const b = playBucketRef.current;
      if (b !== 'off' && b !== 'idle') flush();
    }, PLAY_SAVE_MS);
    window.addEventListener('pagehide', flush);
    document.addEventListener('visibilitychange', onHide);
    return () => {
      window.clearInterval(periodic);
      window.removeEventListener('pagehide', flush);
      document.removeEventListener('visibilitychange', onHide);
    };
  }, [written]);

  // 한 해 진행 시계(DB2). 시계는 UI 계층에만 있고, 상태 갱신은 reducer 하나로만 한다(R-005). 헤더 진행률 바가 이 시계를 구독해 같이 차오르고, 100%가 되는 순간 한 해를 진행한다(ui/useYearClock.ts).
  // 'advance'는 자기가 알던 나이(fromAge)를 들고 가서 상황이 달라졌으면 무시되므로, 겹치거나 지연된 시계가 한 해를 두 번 진행하지 못한다.
  // 선택지가 대기 중이거나 사망했거나 탭이 가려져 있거나 일시정지·나가기 확인 중이면 시계가 멈춘다(배속·자동 모드와 무관하게 선택지에서 멈춘다). 멈춘 자리에서 이어 흐른다.
  const inLife = game.phase === 'life' && !showTitle && !superseded;
  // 연출 대기 = HOLD_MS × 이 판의 인생 길이 모드 계수 + 한 해 둘째 줄부터의 줄 대기 (SPEC-003 LM2·LM3) — 설정(settings.lifeLength)이 아니라 **판의 값**(game.lifeLength)을 읽는다.
  // 새로고침 직후(tick 없음)에는 조용한 해 값으로 대기한다.
  // 부모님이 정한·흘러간 해(tick.by)는 카드 읽기 필요량(tick.readNeedMs)이 기본 결과 대기보다 길면 필요량만큼 기다린다 — 느린 독자가 카드와 결과 문장을 다 읽기 전에 해가 넘어가지 않는다 (SPEC-005 PD5-d, core/timing.ts#holdMsFor)
  const hold = holdDelayMs(tick?.kind ?? null, settings.speed, TIME_SCALE, { mode: game.lifeLength, lines: tick?.lines, readNeedMs: tick?.readNeedMs });
  const clock = useYearClock({
    resetKey: `${game.age}|${lifeLineCount(game.history)}|${game.pending?.key ?? ''}`, // 기록(note) 줄은 세지 않는다 — 「생각 남기기」 한 줄이 올해 진행률을 되감지 않게(M7c 5-3절)
    durationMs: game.pending !== null ? null : hold,
    running: inLife && visible && !game.paused && !exitAsk && !noteOpen && game.pending === null,
    onElapsed: () => dispatch({ type: 'advance', fromAge: game.age }),
  });

  // 자동 모드: 선택지를 잠깐 보여 준 뒤 성향대로 고른다. 해제하면 타이머가 정리되고 선택지는 그대로 남는다. 일시정지·나가기 확인 중에는 고르지 않는다(reducer도 막는다).
  // 카드를 접은 동안에도 고르지 않는다(M7b U3(a)) — 접기는 「지금 내가 보고 있다」는 신호다. 다시 열면 효과가 다시 돌아 `AUTO_CHOICE_MS` 뒤부터 센다(접힌 시간은 세지 않는다).
  useEffect(() => {
    if (!autoChooseArmed({ autoMode: settings.autoMode, hasPending: game.pending !== null, superseded, visible, showTitle, paused: game.paused, exitAsk, folded, noteOpen })) return;
    const key = game.pending?.key;
    if (key === undefined) return;
    const id = window.setTimeout(() => dispatch({ type: 'autoChoose', key }), autoChoiceDelayMs(settings.speed, TIME_SCALE));
    return () => window.clearTimeout(id);
  }, [settings.autoMode, settings.speed, game.pending, game.paused, exitAsk, folded, noteOpen, superseded, visible, showTitle]);

  const takeOver = useCallback(() => {
    // 저장소를 한 번만 읽어, 그 원문을 파싱해 이어받고 "내가 아는 값"으로도 기록한다(R-052). 이어받은 값은 저장소에 이미 있는 값이라 같은 값을 다시 쓰지 않는다.
    const raw = readRaw(GAME_KEY);
    written.game = raw;
    const adopted = parseGame(raw) ?? createInitialState(newSeed());
    timerRef.current?.adopt(adopted); // 이어받은 판의 플레이 시간 기록에서 다시 쌓는다(이어받은 값을 그대로 쓴다)
    dispatch({ type: 'adopt', game: adopted });
    setSuperseded(false);
  }, [setSuperseded, written]);

  let screen;
  // 모든 화면이 새 디자인이다(첫 화면·룰렛·출생신고·대시보드·엔딩·밀린 화면·오류 화면) — 시스템의 라이트·다크를 따르거나 설정의 수동 선택을 따른다. 옛 화면을 라이트로 고정하던 장치는 M4에서 없어졌다.
  if (superseded) {
    screen = <SupersededScreen onTakeOver={takeOver} />;
  } else if (game.phase === 'title' || showTitle) {
    // 첫 화면: 새 판의 시작(title 단계) 또는 진행 중인 판을 둔 채 다시 연 화면(showTitle, 「나가기」). 후자는 「이어서 살기」가 기본 버튼이다.
    screen = (
      <TitleScreen
        era={settings.era}
        lifeLength={settings.lifeLength}
        gentle={{ on: settings.gentle, onToggle: () => dispatch({ type: 'setGentle', on: !settings.gentle }) }}
        notesSeen={settings.notesSeen}
        onSeeNotes={(version) => dispatch({ type: 'seeNotes', version })}
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
  } else if (game.phase === 'life' && game.character && game.era && game.birthReport && game.peerSeed !== null) {
    screen = (
      <LifeScreen
        game={{ ...game, character: game.character, era: game.era, birthReport: game.birthReport, peerSeed: game.peerSeed }}
        settings={settings}
        tick={tick}
        clock={clock}
        exitOpen={exitAsk}
        onExitOpen={setExitAsk}
        folded={folded}
        guardEpoch={fold.epoch + inputEpoch}
        onFold={foldCard}
        onReopen={reopenCard}
        veilOpened={veilOpened}
        onVeilOpen={openVeil}
        onAutoPick={autoPick}
        onAutoFromCard={autoFromCard}
        autoStatus={autoStatus}
        noteSheet={noteSheet}
        onOpenNote={openNote}
        onNoteSave={saveNote}
        onNoteDismiss={dismissNote}
        onNoteCards={setNoteCards}
        onChoose={(key, choiceId) => {
          dispatch({ type: 'choose', key, choiceId });
          bumpGuard(); // 사용자가 결정 시트(또는 인라인 카드)에서 고른 순간 — 사라지는 카드 자리의 컨트롤에 같은 렌더에서 가드 (F-1)
        }}
        onSkip={() => {
          // 「다음 결정으로」 횟수(깨끗한 판 표시용): reducer가 실제로 움직이는 조건과 같을 때만 센다
          if (!settings.autoMode && game.pending === null && !showTitle) playTimer.noteSkip();
          dispatch({ type: 'skip' });
        }}
        onSpeed={(speed) => dispatch({ type: 'setSpeed', speed })}
        onAuto={(auto) => dispatch({ type: 'setAuto', auto })}
        onPause={(paused) => dispatch({ type: 'setPaused', paused })}
        onBgm={(bgm) => dispatch({ type: 'setBgm', bgm })}
        onTheme={(theme) => dispatch({ type: 'setTheme', theme })}
        onExit={() => {
          // 확인 단계를 거쳐 나간다: 일시정지 상태로 저장하고(reducer가 paused를 켠다) 첫 화면을 다시 연다. 새로고침하면 저장된 화면(대시보드)이 멈춘 채 복원된다(C3).
          setExitAsk(false);
          dispatch({ type: 'openTitle' });
        }}
      />
    );
  } else if (game.phase === 'ending' && game.character && game.death && game.era && game.birthStats) {
    // 다시 태어나기: 새 시드를 UI에서 한 번 뽑아 넘긴다(core는 난수 원천을 만들지 않는다). reducer는 ending에서만 받아들여 연타에도 새 판은 하나뿐이다.
    screen = (
      <EndingScreen
        game={{ ...game, character: game.character, death: game.death, era: game.era, birthStats: game.birthStats }}
        onRebirth={() => dispatch({ type: 'rebirth', seed: newSeed() })}
        gentle={settings.gentle}
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

