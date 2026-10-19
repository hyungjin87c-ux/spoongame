import { accruePlay, addResume, addSkip, type PlayBucket } from './playClock';
import type { GameState, PlayTime } from './types';

/**
 * 플레이 시간 타이머의 **상태 기계** (SPEC-003 LM5·LM6, M8 — REV-003-M8-1 R-417·R-422). 시계(Date·performance.now)와 문서(`document`)는 만지지 않는다 — 시각과 탭 가림 여부는 호출하는 쪽(ui/usePlayTimer.ts)이 넣는다.
 * 그래서 노드에서 시각을 직접 넘겨 가며 시험할 수 있다(tests/playTimer.test.ts). 모든 함수는 새 상태를 돌려준다(원본을 바꾸지 않는다).
 *
 * 두 규칙이 이 파일의 이유다:
 *  1. **이어하기 횟수는 hold·decide가 처음 쌓일 때 올린다** (R-417). 앱이 뜰 때 곧바로 올리면 사람이 아무것도 하지 않은 탭도 저장이 달라져 첫 저장 effect가 쓰고,
 *     그러면 열기만 한 탭이 활성 탭을 밀어내거나(R-047) 저장이 막힌 기기에서 열자마자 실패 안내가 뜬다(R-006·NC-11). 저장에서 불러온 판(`resumePending`)만 센다 — 이 탭이 시작한 새 판은 이어하기가 아니다.
 *  2. **탭이 가려진 동안 흐른 시간은 어느 버킷이었든 idle이다** (R-422). 렌더가 버킷을 idle로 바꾸기 전에 모바일에서 페이지가 멈추면(앱 전환·절전) 돌아왔을 때 멈춘 시간이
 *     렌더 전 버킷(hold)에 들어간다 — 그래서 가려짐을 렌더가 아니라 타이머가 직접 안다(`setHidden`: 바뀌는 순간까지의 시간을 이전 상태로 더하고 갈아탄다).
 */

export interface PlayTimerState {
  /** 지금 쌓고 있는 판의 시드 (아직 판을 안 불러왔으면 null) */
  seed: number | null;
  /** 지금까지 쌓은 기록 (시간을 재지 않는 판이면 null) */
  play: PlayTime | null;
  /** 렌더가 마지막으로 알려 준 버킷 (탭이 가려졌다는 사실은 `hidden`이 따로 덮는다) */
  bucket: PlayBucket;
  speedOne: boolean;
  auto: boolean;
  /** 탭이 가려져 있다 — 가려진 동안 흐른 시간은 버킷과 무관하게 idle */
  hidden: boolean;
  /** 마지막 표본의 시각(ms) */
  last: number;
  /** 저장에서 불러온(또는 다른 탭에서 이어받은) 판이라 hold·decide가 처음 쌓일 때 이어하기 횟수를 하나 올려야 한다 */
  resumePending: boolean;
}

export function newPlayTimerState(hidden = false): PlayTimerState {
  return { seed: null, play: null, bucket: 'off', speedOne: true, auto: false, hidden, last: 0, resumePending: false };
}

/** 렌더가 알려 주는 지금의 판·버킷·배속·자동 모드 */
export interface PlayLive {
  seed: number;
  play: PlayTime | undefined;
  bucket: PlayBucket;
  speedOne: boolean;
  auto: boolean;
}

/**
 * 이 판의 기록을 불러온다(판이 바뀌었거나 기록이 새로 생겼을 때). 이미 이 판을 쌓는 중이면 같은 상태.
 * 이 탭이 **처음** 판을 불러올 때 기록이 이미 있으면 저장에서 불러온 판이다(`resumePending`). 그 뒤에 판이 바뀌거나 기록이 새로 생기면(첫 화면에서 태어나기·다시 태어나기) 이 탭이 시작한 새 판이다.
 */
export function ensurePlay(s: PlayTimerState, live: Pick<PlayLive, 'seed' | 'play'>, now: number): PlayTimerState {
  if (s.seed === live.seed && !(s.play === null && live.play !== undefined)) return s;
  return { ...s, seed: live.seed, play: live.play ?? null, last: now, resumePending: s.seed === null && live.play !== undefined };
}

/** 마지막 표본 이후 흐른 시간을 그동안의 버킷(가려져 있었다면 idle)에 더한다. hold·decide가 처음 쌓이는 표본이면 이어하기 횟수를 하나 올린다. */
export function samplePlay(s: PlayTimerState, now: number, timeScale = 1): PlayTimerState {
  if (s.play === null) return { ...s, last: now };
  const bucket: PlayBucket = s.hidden && s.bucket !== 'off' ? 'idle' : s.bucket;
  let play = accruePlay(s.play, bucket, now - s.last, { speedOne: s.speedOne, auto: s.auto, timeScale });
  let resumePending = s.resumePending;
  if (resumePending && (bucket === 'hold' || bucket === 'decide') && play !== s.play) {
    play = addResume(play);
    resumePending = false;
  }
  return { ...s, play, resumePending, last: now };
}

/** 지금 상태(렌더가 넘긴 버킷·배속·자동 모드)를 다음 구간의 기준으로 삼는다 */
export function retargetPlay(s: PlayTimerState, live: Pick<PlayLive, 'bucket' | 'speedOne' | 'auto'>): PlayTimerState {
  return { ...s, bucket: live.bucket, speedOne: live.speedOne, auto: live.auto };
}

/** 탭이 가려졌거나 다시 보인다: 바뀌는 순간까지의 시간을 이전 상태로 더한 뒤 갈아탄다. 이미 같은 값이면 같은 상태. */
export function setHidden(s: PlayTimerState, hidden: boolean, now: number, timeScale = 1): PlayTimerState {
  if (s.hidden === hidden) return s;
  return { ...samplePlay(s, now, timeScale), hidden };
}

/** 「다음 결정으로」 한 번 (기록이 없으면 같은 상태) */
export function skipPlay(s: PlayTimerState): PlayTimerState {
  return s.play === null ? s : { ...s, play: addSkip(s.play) };
}

/** 다른 탭의 판을 이어받았다: 그 판의 기록에서 다시 쌓는다. 이어받은 판도 이 탭에서는 이어하기다(`resumePending`). */
export function adoptPlay(s: PlayTimerState, game: GameState, now: number): PlayTimerState {
  return { ...s, seed: game.seed, play: game.play ?? null, last: now, resumePending: game.play !== undefined };
}

/** 한 번에 표본·갈아타기까지 하는 흔한 순서: 판 확인 → 시간 더하기 → 지금 상태로 갈아타기 */
export function advancePlay(s: PlayTimerState, live: PlayLive, now: number, timeScale = 1): PlayTimerState {
  return retargetPlay(samplePlay(ensurePlay(s, live, now), now, timeScale), live);
}
