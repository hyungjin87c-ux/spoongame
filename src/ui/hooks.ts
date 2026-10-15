import { useEffect, useLayoutEffect, useState } from 'react';

/**
 * 브라우저에서는 layout effect(첫 그림 전에 실행), 서버 렌더(vitest의 renderToStaticMarkup)에서는 일반 effect(서버에서는 실행되지 않는다).
 * React 18은 서버 렌더 중 useLayoutEffect를 만나면 console.error를 내는데, 첫 화면 테스트는 수집(import) 시점에 렌더해서 그 출력이 vitest list의 리포터를 죽였다(check:todo 실패).
 */
export const useIsoLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

/**
 * 움직임 줄이기: 시스템 설정(prefers-reduced-motion)이나 앱 설정(<html data-motion="reduce">, M4에서 설정 화면이 쓴다) 중 하나라도 켜져 있으면 true.
 * 캐러셀 자동 전환·룰렛 회전 같은 움직임은 이 신호를 읽어 끈다(디자인 시스템 3절 5번, CM4).
 */
export function useReducedMotion(): boolean {
  const read = () =>
    typeof window !== 'undefined' &&
    ((typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) || document.documentElement.getAttribute('data-motion') === 'reduce');
  const [reduced, setReduced] = useState(read);
  useEffect(() => {
    const update = () => setReduced(read());
    const mq = typeof window.matchMedia === 'function' ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
    mq?.addEventListener('change', update);
    const obs = new MutationObserver(update);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-motion'] });
    update();
    return () => {
      mq?.removeEventListener('change', update);
      obs.disconnect();
    };
  }, []);
  return reduced;
}

/** 탭이 가려졌는가 (가려진 탭에서는 자동 전환을 멈춘다) */
export function usePageHidden(): boolean {
  const [hidden, setHidden] = useState(() => typeof document !== 'undefined' && document.visibilityState === 'hidden');
  useEffect(() => {
    const on = () => setHidden(document.visibilityState === 'hidden');
    document.addEventListener('visibilitychange', on);
    return () => document.removeEventListener('visibilitychange', on);
  }, []);
  return hidden;
}

/**
 * 지금 시각의 에포크 분(분 단위). 가상 인구(core/population.ts)에 UI가 시각을 넘기는 통로 — core는 Date를 쓰지 않는다(CM2).
 * 분이 바뀔 때마다 갱신하고, 탭이 다시 보일 때도 바로 갱신한다. 서버와 통신하지 않고 이 기기의 시계만 읽는다.
 */
export function useEpochMinute(): number {
  const now = () => Math.floor(Date.now() / 60000);
  const [minute, setMinute] = useState(now);
  useEffect(() => {
    let timer = 0;
    const tick = () => {
      setMinute(now());
      timer = window.setTimeout(tick, 60000 - (Date.now() % 60000) + 30);
    };
    timer = window.setTimeout(tick, 60000 - (Date.now() % 60000) + 30);
    const onVisible = () => {
      if (document.visibilityState === 'visible') setMinute(now());
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);
  return minute;
}
