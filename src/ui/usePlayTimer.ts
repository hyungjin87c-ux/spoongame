import { useCallback, useEffect, useRef } from 'react';
import {
  adoptPlay,
  advancePlay,
  ensurePlay,
  newPlayTimerState,
  playNotBehind,
  setHidden,
  skipPlay,
  type GameState,
  type PlayBucket,
  type PlayTime,
  type PlayTimerState,
  type SessionAction,
} from '../core';

/**
 * 플레이 시간 타이머 (SPEC-003 LM5·LM6, M8 — docs/data/content-M8.md 5절). 시간을 **어느 버킷에 쌓을지**는 순수 함수 `core/playClock.ts#playBucketOf`가 정하고(앱이 시계와 같은 입력으로 만들어 넘긴다),
 * 쌓는 규칙(표본·가려짐·이어하기 횟수)은 순수 상태 기계 `core/playTimer.ts`에 있다. 이 훅은 시각(`performance.now()` — 연출 시계와 같은 시계)과 탭 가림(`document.visibilityState`)을 넣어 주고 ref에 상태를 들고 있을 뿐이다 —
 * 1초마다 렌더가 일어나지 않게 React 상태가 아니라 ref다.
 * 판 상태(`game.play`)로 옮기는 것은 `sync()`가 `syncPlay` 액션으로 한다: App이 상태를 바꾸는 모든 액션 직전에 부른다(그래서 사망으로 엔딩에 들어가기 직전의 시간까지 정확히 담긴다).
 * 저장은 App의 저장 effect(상태가 바뀔 때)와 flush(탭을 닫을 때·10초마다)가 `peek()`한 기록을 담아 쓴다 — 단 **수동적인 시간(idle)만 늘었으면 쓰지 않는다**(App.tsx#flush, R-417).
 *
 * 세는 규칙: 버킷이 바뀌는 순간과 1초마다 「마지막 표본 이후 흐른 시간」을 **그동안의 버킷**에 더한다(`accruePlay`). 한 번에 5초를 넘게 건너뛴 틱은 5초만 센다(기기 절전·가려진 탭의 늦은 타이머).
 * 탭이 가려진 동안 흐른 시간은 버킷과 무관하게 idle이다 — 렌더를 기다리지 않고 `visibilitychange`를 직접 듣고(R-422), 표본 때마다 `document.visibilityState`도 본다(이벤트를 놓쳐도 어긋나지 않는다).
 * 새 판(시드가 바뀜)이면 기록을 그 판 것으로 다시 시작하고, 시간 기록이 없는 판(`game.play` 없음 — M8 이전 저장)은 재지 않는다.
 */

export interface PlayTimerArgs {
  seed: number;
  phase: GameState['phase'];
  /** 판 상태에 들어 있는 기록(없으면 시간을 재지 않는 판) */
  play: PlayTime | undefined;
  /** 지금 시간을 쌓을 버킷 — playBucketOf(시계의 running·자동 선택 타이머와 같은 입력) */
  bucket: PlayBucket;
  speedOne: boolean;
  auto: boolean;
  /** 개발 서버의 ?__timescale=N (배포 번들에서는 1) */
  timeScale: number;
  dispatch: (a: SessionAction) => void;
}

export interface PlayTimer {
  /** 지금까지의 시간을 표본으로 더하고 판 상태로 옮긴다(`syncPlay`). 상태를 바꾸는 액션 직전에 부른다. */
  sync: () => void;
  /** 「다음 결정으로」 한 번 */
  noteSkip: () => void;
  /** 지금까지 쌓은 기록(표본을 더한 뒤). 저장 flush가 판 상태에 담아 쓴다. 이 판의 기록이 없으면 null */
  peek: () => { seed: number; play: PlayTime } | null;
  /** 다른 탭의 판을 이어받았다: 그 판의 기록에서 다시 쌓는다 */
  adopt: (game: GameState) => void;
}

const SAMPLE_MS = 1000;

const hiddenNow = (): boolean => typeof document !== 'undefined' && document.visibilityState === 'hidden';

export function usePlayTimer(args: PlayTimerArgs): PlayTimer {
  const live = useRef(args);
  live.current = args;
  const acc = useRef<PlayTimerState | null>(null);
  if (acc.current === null) acc.current = newPlayTimerState(hiddenNow());
  const now = () => performance.now();
  const get = (): PlayTimerState => acc.current as PlayTimerState;

  /** 지금 렌더가 알려 준 판·버킷·배속·자동 모드 */
  const liveOf = () => {
    const l = live.current;
    return { seed: l.seed, play: l.play, bucket: l.bucket, speedOne: l.speedOne, auto: l.auto };
  };

  /**
   * 판 확인 → (탭 가림이 바뀌었으면 바뀐 순간으로 갈아타고) → 시간 더하기 → 지금 상태로 갈아타기.
   * 가림은 렌더가 버킷을 idle로 바꾸기 전에도 먼저 반영한다(R-422): `document.visibilityState`가 이전 표본과 다르면 그 순간까지를 이전 상태로 센다.
   */
  const step = useCallback((): PlayTimerState => {
    const t = now();
    const scale = live.current.timeScale;
    let s = ensurePlay(get(), live.current, t);
    s = setHidden(s, hiddenNow(), t, scale);
    s = advancePlay(s, liveOf(), t, scale);
    acc.current = s;
    return s;
  }, []);

  // 버킷·배속·자동 모드가 바뀌는 커밋마다: 그때까지의 시간을 옛 버킷에 더하고 새 버킷으로 갈아탄다
  useEffect(() => {
    step();
  }, [args.bucket, args.speedOne, args.auto, args.seed, args.play === undefined, step]);

  // 1초마다 표본 (가려진 탭에서는 브라우저가 늦춰도 5초까지만 센다)
  useEffect(() => {
    const id = window.setInterval(() => {
      if (live.current.bucket === 'off' && get().bucket === 'off') return;
      step();
    }, SAMPLE_MS);
    return () => window.clearInterval(id);
  }, [step]);

  // 탭이 가려지거나 다시 보이는 순간을 렌더보다 먼저 안다 (R-422 — 모바일에서 앱을 벗어나면 렌더 전에 페이지가 멈출 수 있다)
  useEffect(() => {
    const onVisibility = () => {
      step();
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [step]);

  const peek = useCallback((): { seed: number; play: PlayTime } | null => {
    const s = step();
    return s.play !== null && s.seed !== null ? { seed: s.seed, play: s.play } : null;
  }, [step]);

  const sync = useCallback(() => {
    const p = peek();
    const l = live.current;
    if (p === null || l.phase !== 'life' || l.seed !== p.seed) return;
    if (l.play !== undefined && !playNotBehind(p.play, l.play)) return; // 이미 상태에 더 새 기록이 있다(다른 경로로 바뀜) — 되돌리지 않는다
    l.dispatch({ type: 'syncPlay', seed: p.seed, play: p.play });
  }, [peek]);

  const noteSkip = useCallback(() => {
    acc.current = skipPlay(ensurePlay(get(), live.current, now()));
  }, []);

  const adopt = useCallback((game: GameState) => {
    acc.current = adoptPlay(get(), game, now());
  }, []);

  return { sync, noteSkip, peek, adopt };
}

