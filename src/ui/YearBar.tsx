import { useRef, useState } from 'react';
import { percentOf } from '../core/progress';
import { DASH_TEXT } from '../data/dashText';
import { useIsoLayoutEffect, useReducedMotion } from './hooks';
import type { YearClock } from './useYearClock';

/**
 * 헤더 둘째 줄: 「{연도}년」 · 올해 진행률 바 · 「{N}%」 (SPEC-003 DB2). 바는 그 해의 연출 시간 동안 0 → 100%로 차오르고(ui/useYearClock.ts의 시계를 구독해 **DOM을 직접 갱신**한다 — 해마다 수십 번씩
 * 화면 전체를 다시 그리지 않는다), 100%가 되는 순간 나이가 +1 된다. 일시정지·카드 대기·선택지 대기 중에는 시계가 멈춰 바도 그 자리에 머문다(선택지 대기는 가득 찬 채).
 * 움직임 줄이기(시스템 설정 또는 앱 설정): 부드럽게 차오르는 대신 10% 단계로만 바뀐다(바 애니메이션을 끈다 — 디자인 시스템 3절 5번, CM4). 진행 정보 자체는 그대로 있다.
 * 접근성: `role="progressbar"` + 이름 「올해 진행률」 + 값(정수 %)과 일시정지 중임을 `aria-valuetext`로 알린다. 값은 스크린리더가 읽지 않는 속도로 바뀌므로 live 영역이 아니다.
 */

/** 움직임 줄이기에서 바가 움직이는 단계(비율) */
export const REDUCED_STEP = 0.1;

export function YearRow({ year, clock, paused }: { year: number; clock: YearClock; paused: boolean }) {
  const reduced = useReducedMotion();
  const barRef = useRef<HTMLDivElement>(null);
  const fillRef = useRef<HTMLDivElement>(null);
  const pctRef = useRef<HTMLSpanElement>(null);
  // 첫 그림(서버 렌더 포함)의 값. 이후 갱신은 DOM 직접 — React가 다시 그려도 이 상수 때문에 속성을 덮어쓰지 않는다.
  const [initial] = useState(() => percentOf(clock.get()));

  useIsoLayoutEffect(() => {
    const apply = () => {
      const f = clock.get();
      const shown = reduced ? Math.floor(f / REDUCED_STEP + 1e-9) * REDUCED_STEP : f;
      const pct = percentOf(shown);
      if (fillRef.current !== null) fillRef.current.style.width = `${Math.min(100, shown * 100)}%`;
      if (pctRef.current !== null) pctRef.current.textContent = `${pct}%`;
      const bar = barRef.current;
      if (bar !== null) {
        bar.setAttribute('aria-valuenow', String(pct));
        bar.setAttribute('aria-valuetext', paused ? `${pct}%, ${DASH_TEXT.progressPausedValue}` : `${pct}%`);
      }
    };
    apply();
    return clock.subscribe(apply);
  }, [clock, reduced, paused]);

  return (
    <div className="year-row">
      <span className="num" data-testid="life-year">
        {year}
        {DASH_TEXT.yearSuffix}
      </span>
      <div
        className="year-progress"
        role="progressbar"
        aria-label={DASH_TEXT.yearProgressLabel}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={initial}
        data-testid="year-progress"
        data-paused={paused ? 'true' : 'false'}
        ref={barRef}
      >
        <div className="year-progress__fill" style={{ width: `${initial}%` }} data-testid="year-progress-fill" ref={fillRef} />
      </div>
      <span className="year-row__pct num" data-testid="year-pct" ref={pctRef}>
        {initial}%
      </span>
    </div>
  );
}
