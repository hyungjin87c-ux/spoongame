import { useEffect, type RefObject } from 'react';
import { watchBarRelease } from './barRelease';
import { revealWithinReleasedBar } from './focusReveal';
import { useIsoLayoutEffect } from './hooks';

/**
 * 하단 고정 띠를 가진 화면(룰렛·출생신고, 앞으로 M4 대시보드)의 공통 설정 (SPEC-003 CM10·CM11·QM2-12, REV-003-M2-5 R-250 이월).
 * 첫 화면(screens/TitleScreen.tsx)이 하던 일 가운데 확인 단계에 묶인 것을 뺀 공통 부분이다:
 *  1) 띠의 실제 높이를 문서 루트의 CSS 변수 `--bar-h`로 알리고 `<html class="has-bottom-bar">`를 걸어 본문 끝 여백(`.page-end-space`)과 **스크롤 여백**(scroll-padding-bottom, styles/title.css)이
 *     띠 높이를 따르게 한다 → 키보드 Tab·프로그램 focus()가 요소를 화면 안으로 스크롤할 때 고정 띠 위에 머문다(CM10).
 *  2) 띠가 **작은 뷰포트 높이(100svh)**의 절반을 넘으면 `bar-released`를 걸어 고정을 푼다(QM2-12) — 판정·측정은 `ui/barRelease.ts#watchBarRelease`(첫 화면과 같은 함수).
 *     클래스만 바꾸므로 포커스를 가진 요소는 포커스를 잃지 않는다. 풀리는 순간 포커스가 띠 안에 있으면 화면 안으로 맞춘다.
 * 화면이 떠 있는 동안만 걸고, 사라지면 클래스·변수를 지운다(옛 화면에는 띠가 없다).
 */
export function useBottomBar(barRef: RefObject<HTMLElement>): void {
  useIsoLayoutEffect(() => {
    const bar = barRef.current;
    if (bar === null) return;
    const root = document.documentElement;
    root.classList.add('has-bottom-bar');
    const revealBarFocus = () => {
      const active = document.activeElement;
      if (active !== null && bar.contains(active)) revealWithinReleasedBar(null, active);
    };
    const watch = watchBarRelease(bar, { root, onRelease: revealBarFocus, onReleasedResize: revealBarFocus });
    return () => {
      watch.dispose();
      root.classList.remove('has-bottom-bar');
    };
  }, [barRef]);
}

/** 새 디자인 화면이 떠 있는 동안 body에 토큰 바탕(`body.theme-surface`)을 건다 — 옛 화면은 아직 고정 색이라 이 클래스가 없다(styles/title.css) */
export function useThemeSurface(): void {
  useEffect(() => {
    document.body.classList.add('theme-surface');
    return () => document.body.classList.remove('theme-surface');
  }, []);
}

/** 화면이 새로 뜰 때 문서를 맨 위로 보낸다(이전 화면에서 스크롤해 내려와 있어도 새 화면의 제목이 보이게) */
export function useScrollTopOnMount(): void {
  useIsoLayoutEffect(() => {
    window.scrollTo(0, 0);
  }, []);
}
