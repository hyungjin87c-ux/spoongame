import type { EraDecadeData } from './types';

/**
 * 시대의 창 10년 하위 덩어리 (SPEC-009 FM5, 마스터 결정: 판 하나가 한 번에 받는 양 ≤ 75KB). 그림 덩어리 `familyArt`와 따로, **필요한 10년대를 필요할 때 하나씩** 받는다 — 주인공이 사는 동안 지나는 10년대가 많아야 열 개라
 * 덩어리 하나는 작고(승인된 106장 기준 9~22KB gzip, 한 10년 덩어리 ≤ 24KB), 판의 첫 구간만 받고 나이가 들며 이어받는다. 받지 못해도 게임은 계속되고 창이 빈 틀로 남는다.
 * 이 파일은 `familyArt`와 함께 지연 로드되며 첫 화면은 닿지 않는다(`tests/lazyBoundary.test.ts`).
 */
export const ERA_DECADE_LOADERS: Readonly<Record<number, () => Promise<EraDecadeData>>> = {
  1940: () => import('./d1940').then((m) => m.ERA_DECADE),
  1950: () => import('./d1950').then((m) => m.ERA_DECADE),
  1960: () => import('./d1960').then((m) => m.ERA_DECADE),
  1970: () => import('./d1970').then((m) => m.ERA_DECADE),
  1980: () => import('./d1980').then((m) => m.ERA_DECADE),
  1990: () => import('./d1990').then((m) => m.ERA_DECADE),
  2000: () => import('./d2000').then((m) => m.ERA_DECADE),
  2010: () => import('./d2010').then((m) => m.ERA_DECADE),
  2020: () => import('./d2020').then((m) => m.ERA_DECADE),
  2030: () => import('./d2030').then((m) => m.ERA_DECADE),
};

/** 승인된 그림이 있는 10년대 — 없는 10년대는 아무것도 받지 않는다. 데이터를 더할 때 여기에도 적는다(`tests/eraWindows.test.ts`가 파일 내용과 대조한다). SPEC-010: 2030년대는 묶음 A, 2040~2100년대는 묶음 B·C가 들어올 때 */
export const ERA_DECADES_WITH_DATA: readonly number[] = [1940, 1950, 1960, 1970, 1980, 1990, 2000, 2010, 2020, 2030];
