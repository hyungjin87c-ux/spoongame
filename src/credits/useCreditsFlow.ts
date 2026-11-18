import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { elapsedAt, planOf, positionAt, type Plan } from './timing';

/**
 * 「이 삶의 이름들」의 자동 흐름 (SPEC-022 EC1 7항): 문서 스크롤 위치를 시간 → 위치 순수 함수(`timing.ts#positionAt`)로 선형 이동한다. UI 메모리뿐 — 저장하지 않고 RNG·소리가 없다.
 * 진입할 때 한 번 재서(`planOf`) 자동 흐름이 가능한 판이면 처음 4초 정지 뒤 흐르기 시작하고, 아니면 정지 목록이다. 멈추는 때: 수동 스크롤(휠·터치·방향키·PageUp/Down·Home/End·스크롤 위치 이탈) ·
 * 다른 조작 요소에 초점 · 창 폭 변경 · 루트 글자 크기 변경 · 움직임 줄이기 변경 · 탭 숨김 · 가림 펼침(`pause`를 직접 부른다). 돌아왔다고 임의로 다시 시작하지 않는다.
 * 창 폭·글자 크기·움직임 설정이 바뀌면 판정을 다시 재되 **자동 → 정지 목록**으로만 바꾼다(정지 목록이 저절로 자동이 되지 않는다 — 넓힌 뒤 「처음부터 보기」가 새 진입이다).
 */

export interface CreditsFlow {
  /** 진입 때 잰 판정 — 아직 재기 전이면 null */
  plan: Plan | null;
  /** 지금 흐르는 중 */
  running: boolean;
  pause(): void;
  /** 「일시정지」 ↔ 「이어 보기」 */
  toggle(): void;
}

const SCROLL_KEYS = new Set(['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End']);
const INTERACTIVE = 'button, a, summary, input, select, textarea';

interface Measure {
  distance: number;
  plan: Plan;
  rootPx: number;
  reduced: boolean;
}

function measure(n: number, people: number): Measure {
  const doc = document.documentElement;
  const distance = doc.scrollHeight - doc.clientHeight;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches || doc.dataset.motion === 'reduce';
  const rootPx = parseFloat(getComputedStyle(doc).fontSize);
  return { distance, rootPx, reduced, plan: planOf({ n, people, distance, reduced, rootPx }) };
}

const jump = (y: number): void => window.scrollTo({ top: y, behavior: 'instant' as ScrollBehavior });

export function useCreditsFlow(opts: { n: number; people: number; /** 이 진입에서 「목록으로 보기」를 눌렀다 */ pinned: boolean; /** 진입 때 초점을 줄 첫 제목 */ headingRef: RefObject<HTMLElement> }): CreditsFlow {
  const { n, people, pinned, headingRef } = opts;
  const [plan, setPlan] = useState<Plan | null>(null);
  const [running, setRunning] = useState(false);
  const planRef = useRef<Plan | null>(null);
  const runningRef = useRef(false);
  const elapsed = useRef(0);
  const startedAt = useRef(0);
  const raf = useRef(0);
  const distance = useRef(0);
  const lastSet = useRef(0);
  const last = useRef({ width: 0, rootPx: 0, reduced: false });
  const pinnedRef = useRef(pinned);
  pinnedRef.current = pinned;

  const stop = useCallback(() => {
    if (!runningRef.current) return;
    runningRef.current = false;
    window.cancelAnimationFrame(raf.current);
    setRunning(false);
  }, []);

  const start = useCallback((from: number) => {
    const p = planRef.current;
    if (p === null || p.mode !== 'auto') return;
    elapsed.current = from;
    startedAt.current = performance.now() - from * 1000;
    runningRef.current = true;
    setRunning(true);
    const tick = (now: number) => {
      if (!runningRef.current) return;
      const e = (now - startedAt.current) / 1000;
      elapsed.current = e;
      const pos = positionAt(e, p.readSec, distance.current);
      lastSet.current = pos;
      jump(pos);
      if (e >= p.readSec) {
        elapsed.current = p.readSec;
        runningRef.current = false;
        setRunning(false);
        return;
      }
      raf.current = window.requestAnimationFrame(tick);
    };
    raf.current = window.requestAnimationFrame(tick);
  }, []);

  const toggle = useCallback(() => {
    if (runningRef.current) {
      stop();
      return;
    }
    const p = planRef.current;
    if (p === null || p.mode !== 'auto' || elapsed.current >= p.readSec) return;
    const expected = positionAt(elapsed.current, p.readSec, distance.current);
    const y = window.scrollY;
    start(Math.abs(y - expected) > 2 ? elapsedAt(y, p.readSec, distance.current) : elapsed.current);
  }, [start, stop]);

  // 진입: 맨 위 · 첫 제목에 초점 · 판정 → 자동이면 시작
  useEffect(() => {
    jump(0);
    headingRef.current?.focus({ preventScroll: true });
    const m = measure(n, people);
    distance.current = m.distance;
    last.current = { width: window.innerWidth, rootPx: m.rootPx, reduced: m.reduced };
    planRef.current = m.plan;
    setPlan(m.plan);
    if (m.plan.mode === 'auto' && !pinnedRef.current) start(0);
    return () => {
      runningRef.current = false;
      window.cancelAnimationFrame(raf.current);
    };
  }, [n, people, headingRef, start]);

  // 멈추는 때 + 판정 다시 재기
  useEffect(() => {
    const replan = () => {
      stop();
      const m = measure(n, people);
      distance.current = m.distance;
      last.current = { width: window.innerWidth, rootPx: m.rootPx, reduced: m.reduced };
      if (planRef.current !== null && planRef.current.mode === 'auto' && m.plan.mode === 'list') {
        planRef.current = m.plan;
        setPlan(m.plan);
      }
    };
    const onWheel = () => stop();
    const onKey = (e: KeyboardEvent) => {
      const t = e.target instanceof Element ? e.target : null;
      if (SCROLL_KEYS.has(e.key) || (e.key === ' ' && (t === null || t.closest(INTERACTIVE) === null))) stop();
    };
    const onScroll = () => {
      if (runningRef.current && Math.abs(window.scrollY - lastSet.current) > 3) stop();
    };
    const onFocusIn = (e: FocusEvent) => {
      const t = e.target instanceof Element ? e.target : null;
      if (t !== null && t.closest(INTERACTIVE) !== null && !t.hasAttribute('data-flow-toggle')) stop();
    };
    const onResize = () => {
      if (window.innerWidth !== last.current.width) replan();
    };
    const onFontOrMotion = () => {
      const doc = document.documentElement;
      const px = parseFloat(getComputedStyle(doc).fontSize);
      const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches || doc.dataset.motion === 'reduce';
      if (px !== last.current.rootPx || reduced !== last.current.reduced) replan();
    };
    const onVisibility = () => {
      if (document.hidden) stop();
    };
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const mo = new MutationObserver(onFontOrMotion);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['style', 'class', 'data-motion'] });
    window.addEventListener('wheel', onWheel, { passive: true });
    window.addEventListener('touchstart', onWheel, { passive: true });
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onResize);
    document.addEventListener('keydown', onKey);
    document.addEventListener('focusin', onFocusIn);
    document.addEventListener('visibilitychange', onVisibility);
    mq.addEventListener('change', onFontOrMotion);
    return () => {
      mo.disconnect();
      window.removeEventListener('wheel', onWheel);
      window.removeEventListener('touchstart', onWheel);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onResize);
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('focusin', onFocusIn);
      document.removeEventListener('visibilitychange', onVisibility);
      mq.removeEventListener('change', onFontOrMotion);
    };
  }, [n, people, stop]);

  return { plan, running, pause: stop, toggle };
}
