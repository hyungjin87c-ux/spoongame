import { useEffect, useRef, useState, type ReactNode } from 'react';
import { reelPosition } from '../core/roulette';

/**
 * 룰렛 릴 하나 (SPEC-003 RL1·RL2·RL6, docs/design/mockups/roulette-spin.html의 `.reel`). 칸 목록(지역 릴은 확률표 순서, 수저 릴은 왕복 순서 — core/roulette.ts#WEALTH_REEL_ORDER)을 세로로 돌려 **정해진 자리에서 멈춘다**.
 *  - 멈출 자리(resultIndex)는 저장된 출생 결과에서 읽은 값이다. 이 컴포넌트는 난수를 쓰지 않는다(Math.random 없음 — tests/roulette.test.tsx가 소스를 점검) —
 *    연출은 `core/roulette.ts#reelPosition`(가속 → 회전 → 감속, 단조 증가)의 순수 함수 하나로 위치를 그릴 뿐이라 확률을 바꾸지 못한다(RL2).
 *  - 회전 중에는 긴 목록(칸을 여러 바퀴 반복)을 `requestAnimationFrame`으로 위로 밀어 올린다. 멈추면(stopMs) 결과 칸을 가운데 두고 앞뒤 두 칸씩만 남긴 목록으로 바꾼다 — 눈에 같은 그림.
 *  - 회전 중에는 `aria-hidden="true"`(스크린리더가 읽지 않는다, RL6). 결과는 화면의 상태 문장(role="status")과 확률표가 알린다.
 *  - 움직임 줄이기·복원·건너뛰기(`spinning=false`)에서는 처음부터 결과 모양이다.
 * 칸 높이는 CSS 변수 `--reel-item-h`(rem 기반)라 글자를 키워도 칸이 그 크기를 따른다(CM11).
 */

/** 칸 목록을 몇 바퀴 돌릴지: 한 바퀴가 짧은 릴(수저 8칸)은 더 많이 돌아 속도감이 비슷하다 (총 이동 약 30~40칸) */
export function spinCycles(count: number): number {
  return Math.max(2, Math.ceil(30 / count));
}

export interface ReelProps {
  /** 칸 내용(릴 칸 순서 — 순환한다). 칸 수 ≥ 2 */
  items: readonly ReactNode[];
  /** 멈출 자리(items 안의 인덱스) */
  resultIndex: number;
  /** 연출 중인가(true면 돌고, stopMs에 멈춘다. false면 처음부터 결과 모양) */
  spinning: boolean;
  /** 이 릴이 멈추는 시각(ms) */
  stopMs: number;
  /** 멈췄다(연출 시간이 다 됐다) */
  onStop?: () => void;
  testId: string;
}

const SLOT_BEFORE = 2; // 가운데 칸 위에 보이는 칸 수 (릴 높이 = 5칸)

/**
 * 회전 중 목록의 칸 번호(항목 인덱스): 칸 e(0..total+4)는 (e − 2 + startIndex) 번째 항목. 위치 pos에서 가운데 칸(e = pos + 2)이 멈출 때(pos = total) 결과 항목이 되도록 startIndex를 정한다.
 * 그래서 정지 직전에 가운데를 지나는 칸(e = total + 1)은 목록에서 결과의 바로 앞 항목이다 — 수저 릴은 왕복 순서라 그 칸이 늘 이웃 단계다(core/roulette.ts#WEALTH_REEL_ORDER, R-274).
 */
export function spinCells(n: number, resultIndex: number, total: number): number[] {
  const startIndex = (((resultIndex - total) % n) + n) % n;
  return Array.from({ length: total + SLOT_BEFORE * 2 + 1 }, (_, e) => (((e - SLOT_BEFORE + startIndex) % n) + n) % n);
}

/** 멈춘 목록의 칸 번호: 결과 칸을 가운데 두고 앞뒤 두 칸씩(릴이 5칸보다 짧으면 순환해 채운다) */
export function restCells(n: number, resultIndex: number): number[] {
  return Array.from({ length: SLOT_BEFORE * 2 + 1 }, (_, e) => (((resultIndex + e - SLOT_BEFORE) % n) + n) % n);
}

export function Reel({ items, resultIndex, spinning, stopMs, onStop, testId }: ReelProps) {
  const n = items.length;
  const listRef = useRef<HTMLUListElement>(null);
  const reelRef = useRef<HTMLDivElement>(null);
  const onStopRef = useRef(onStop);
  const [stopped, setStopped] = useState(false);

  useEffect(() => {
    onStopRef.current = onStop;
  });

  const total = spinCycles(n) * n;
  const running = spinning && !stopped;

  useEffect(() => {
    if (!spinning) return;
    const list = listRef.current;
    const reel = reelRef.current;
    if (list === null || reel === null) return;
    const t0 = performance.now();
    let raf = 0;
    let prevPos = 0;
    let prevT = t0;
    const frame = (now: number) => {
      const t = now - t0;
      const pos = reelPosition(t, total, stopMs);
      list.style.transform = `translate3d(0, calc(var(--reel-item-h) * ${-pos}), 0)`;
      // 빠를 때만 흐리게(감속해 천천히 지나갈 때는 칸이 읽힌다)
      const speed = now > prevT ? ((pos - prevPos) / (now - prevT)) * 1000 : 0;
      reel.classList.toggle('is-fast', speed > 4);
      prevPos = pos;
      prevT = now;
      if (t >= stopMs) {
        setStopped(true);
        onStopRef.current?.();
        return;
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [spinning, total, stopMs]);

  const spinList = spinCells(n, resultIndex, total);
  const restList = restCells(n, resultIndex);

  return (
    <div className={`reel${running ? ' is-spinning' : ''}`} ref={reelRef} aria-hidden="true" data-testid={testId} data-state={running ? 'spinning' : 'stopped'}>
      <div className="reel__window" />
      {running ? (
        <ul className="reel__list" ref={listRef} key="spin">
          {spinList.map((idx, e) => (
            <li className="reel__item" key={e}>
              {items[idx]}
            </li>
          ))}
        </ul>
      ) : (
        <ul className="reel__list" key="rest">
          {restList.map((idx, e) => (
            <li className={`reel__item${e === SLOT_BEFORE ? ' is-result' : ''}`} key={e} data-result={e === SLOT_BEFORE ? 'true' : undefined}>
              {items[idx]}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
