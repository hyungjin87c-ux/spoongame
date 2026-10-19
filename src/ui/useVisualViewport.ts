import { useEffect, useState } from 'react';

/**
 * 가상 키보드를 아는 시트 높이 (SPEC-003 M7c K1~K7, docs/data/content-M7c.md 6-1절, design-system.md 11-10 「입력란이 있는 시트의 가상 키보드」, 잠정값 NC-14 — 실기기 확인(M9) 뒤 조정).
 * `dvh`는 주소창 변화만 반영하고 키보드는 반영하지 않으며, iOS는 키보드가 올라와도 레이아웃 뷰포트가 줄지 않고 `visualViewport`만 줄어든다. 그래서 입력란이 있는 시트가 열려 있는 동안
 * `window.visualViewport`의 `resize`·`scroll`을 듣고 보이는 영역의 높이·`offsetTop`을 돌려준다 — 호출자가 `.overlay`에 `--vv-h`·`--vv-top`으로 건다. `visualViewport`가 없으면 null(`dvh`로 물러남).
 */

export interface VisualViewportState {
  /** 보이는 영역의 높이(px, 정수) */
  height: number;
  /** 보이는 영역 위쪽이 레이아웃 뷰포트 위쪽에서 떨어진 거리(px, 정수) */
  offsetTop: number;
}

/**
 * 이 높이(px) 이상이면 입력란 전체 + 두 버튼이 보이는 영역 안에 함께 보이는 것이 보장된다 — 잠정 NC-14 (글자 100%. 글자 200%·폭 320처럼 compact 시트도 이 높이에 안 들어가는 조합은 K7: 포커스를 가진 입력란은 늘 보이고 두 버튼은 시트 안 스크롤로 닿는다).
 * compact의 기준은 **고정 문턱이 아니라 시트가 들어가는가**다(마스터 결정 2026-10-19): 전체 시트의 높이가 시트가 가질 수 있는 최대 높이를 넘을 때만 compact — 예전 고정 문턱 520은 인용 박스가 있는 전체 시트(약 616px)가 보이는 높이 520~616에서 두 버튼을 시트 안 스크롤 밖에 두었다.
 */
export const GUARANTEE_AT = 340;

/** `window.visualViewport`의 지금 값 (없으면 null) */
export function readVisualViewport(source: { visualViewport?: { height: number; offsetTop: number } | null } | null = typeof window === 'undefined' ? null : window): VisualViewportState | null {
  const vv = source?.visualViewport;
  if (vv === undefined || vv === null) return null;
  return { height: Math.round(vv.height), offsetTop: Math.round(vv.offsetTop) };
}

const same = (a: VisualViewportState | null, b: VisualViewportState | null): boolean => (a === null || b === null ? a === b : a.height === b.height && a.offsetTop === b.offsetTop);

/** 켜져 있는 동안 보이는 영역을 따라간다. 꺼져 있거나 `visualViewport`가 없으면 null */
export function useVisualViewport(enabled: boolean): VisualViewportState | null {
  const [state, setState] = useState<VisualViewportState | null>(() => (enabled ? readVisualViewport() : null));
  useEffect(() => {
    if (!enabled || typeof window === 'undefined' || window.visualViewport === undefined || window.visualViewport === null) {
      setState(null);
      return;
    }
    const vv = window.visualViewport;
    const update = () => {
      const next = readVisualViewport();
      setState((prev) => (same(prev, next) ? prev : next));
    };
    update();
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    return () => {
      vv.removeEventListener('resize', update);
      vv.removeEventListener('scroll', update);
    };
  }, [enabled]);
  return enabled ? state : null;
}

/** 시트의 맞춤: `natural` = compact가 아닐 때 시트 전체의 높이(px, 테두리 포함), `max` = 시트가 가질 수 있는 최대 높이(px, 계산된 `max-height` — `min(94dvh, 보이는 높이 − 8px)`) */
export interface SheetFit {
  natural: number;
  max: number;
}

/** 전체 시트가 최대 높이에 안 들어가는가 (반올림 오차 0.5px 허용) */
export function needsCompact(fit: SheetFit | null): boolean {
  return fit !== null && fit.natural > fit.max + 0.5;
}

/**
 * compact(K2): 포커스가 입력 영역에 있고, 전체 시트가 보이는 영역(최대 높이)에 들어가지 않을 때 — 인용 박스·두 버튼의 보조 설명을 숨겨 높이를 줄인다.
 * `visualViewport`를 모르면(null) 아니다(dvh로 물러난다). 키보드가 내려가 전체 시트가 다시 들어가면(또는 포커스가 입력 영역을 떠나면) 풀린다(K6).
 */
export function isCompact(zoneFocused: boolean, vv: VisualViewportState | null, fit: SheetFit | null): boolean {
  return zoneFocused && vv !== null && needsCompact(fit);
}
