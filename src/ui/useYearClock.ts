import { useEffect, useMemo, useRef } from 'react';
import { advanceFraction } from '../core/progress';
import { useIsoLayoutEffect } from './hooks';

/**
 * 올해 시계 (SPEC-003 DB2): 한 해의 연출 시간 동안 진행률을 0 → 1로 올리고, 다 차면 `onElapsed`(= 다음 해로 진행)를 **한 번** 부른다. 진행 타이머와 헤더 진행률 바가 **같은 시계**를 쓴다 —
 * 바가 100%가 되는 순간이 곧 나이가 오르는 순간이라 둘이 어긋나지 않는다(예전에는 `setTimeout` 하나가 진행을 맡았다).
 *
 *  - `resetKey`가 바뀌면(한 해가 끝나 새 걸음이 시작됐다) 진행률이 0으로 돌아가고, 같은 키에서는 단조 증가한다.
 *  - `running`이 false(일시정지·카드 대기·선택지 대기·탭 가림·첫 화면 다시 열기·밀린 화면)이면 시계가 멈춘다. 진행률은 그 자리에 머물고, 다시 켜지면 **이어서** 흐른다(처음부터 다시 재지 않는다).
 *  - `durationMs`가 바뀌면(배속 변경) 진행률(비율)은 그대로이고 남은 비율만 새 속도로 채워진다 — 바가 되감기거나 건너뛰지 않는다. null이면 연출 시간이 없는 상태(선택지 대기·사망)라 바가 가득 찬 채 멈춘다.
 *  - 시간은 `setTimeout`으로 흘린다(`performance.now()` 차이로 누적): 한 번에 최대 FRAME_MS(40ms)씩이고, 남은 시간이 더 짧으면 그만큼만 기다려 끝나는 순간이 정확하다.
 *    개발 서버의 `?__timescale=N`(연출을 N배 빠르게)에서도 한 해가 1프레임을 기다리지 않는다.
 * React 렌더를 일으키지 않는다: 진행률은 `YearClock`(읽기·구독)으로만 나가고, 바 컴포넌트가 직접 DOM을 갱신한다(ui/YearBar.tsx).
 */

export const FRAME_MS = 40;

export interface YearClock {
  /** 지금 진행률 0~1 (연출 시간이 없는 상태는 1) */
  get(): number;
  /** 진행률이 바뀔 때 부르는 구독. 해제 함수를 돌려준다. */
  subscribe(listener: () => void): () => void;
}

interface Args {
  resetKey: string;
  durationMs: number | null;
  running: boolean;
  onElapsed: () => void;
}

export function useYearClock({ resetKey, durationMs, running, onElapsed }: Args): YearClock {
  const fraction = useRef(0);
  const keyRef = useRef(resetKey);
  const durationRef = useRef<number | null>(durationMs);
  const listeners = useRef(new Set<() => void>());
  const elapsedRef = useRef(onElapsed);

  // 렌더 중에 키가 바뀐 것을 반영한다(멱등: 같은 키로 다시 렌더돼도 한 번만 0이 된다). 자식(바)의 첫 읽기보다 먼저여야 해서 효과가 아니라 렌더에서 한다.
  if (keyRef.current !== resetKey) {
    keyRef.current = resetKey;
    fraction.current = 0;
  }
  durationRef.current = durationMs;
  elapsedRef.current = onElapsed;

  const clock = useMemo<YearClock>(
    () => ({
      get: () => (durationRef.current === null ? 1 : fraction.current),
      subscribe(listener) {
        listeners.current.add(listener);
        return () => {
          listeners.current.delete(listener);
        };
      },
    }),
    [],
  );

  // 키(해)나 연출 시간이 바뀐 커밋에서 바를 **그림이 그려지기 전에** 지금 값으로 맞춘다. 아래 passive 효과에서만 알리면 새 나이가 먼저 그려지고 바는 한 프레임 동안 이전 해의 100%로 남는다(e2e/m4-dashboard.spec.ts가 잡았다).
  useIsoLayoutEffect(() => {
    for (const l of listeners.current) l();
  }, [resetKey, durationMs]);

  useEffect(() => {
    const notify = () => {
      for (const l of listeners.current) l();
    };
    notify(); // 키·연출 시간이 바뀌었으니 바를 지금 값으로 맞춘다
    if (!running || durationMs === null) return;
    let last = performance.now();
    let timer = 0;
    const step = () => {
      const now = performance.now();
      fraction.current = advanceFraction(fraction.current, now - last, durationMs);
      last = now;
      notify();
      if (fraction.current >= 1) {
        // 한 번 부르고 이 시계는 끝난다(이 효과 실행에서 다시 불리지 않는다). 진행이 일시정지 같은 이유로 무시됐다면 running이 바뀌어 효과가 다시 돌 때 다시 부른다.
        elapsedRef.current();
        return;
      }
      const remaining = (1 - fraction.current) * durationMs;
      timer = window.setTimeout(step, Math.max(0, Math.min(FRAME_MS, remaining)));
    };
    const remaining = (1 - fraction.current) * durationMs;
    timer = window.setTimeout(step, Math.max(0, Math.min(FRAME_MS, remaining)));
    return () => window.clearTimeout(timer);
  }, [resetKey, durationMs, running]);

  return clock;
}
