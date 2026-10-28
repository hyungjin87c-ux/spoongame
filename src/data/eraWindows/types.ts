import type { EraWindow } from '../../core/eraWindow';

/**
 * 시대의 창 10년 덩어리 하나의 모양 (SPEC-009 FM5, family-model.md 9-5절). `windows`는 **승인된(approved: true) 장면만** 담고, `art`는 그 장면의 그림 조각 마크업(40×32 좌표계, 색은 `var(--c-scene-*)` 토큰만)이다 —
 * `EraWindow.draw`가 `art`의 열쇠다. 장면의 `years`는 이 10년대 안에 있어야 한다(`tests/eraWindows.test.ts`).
 */
export interface EraDecadeData {
  readonly windows: readonly EraWindow[];
  readonly art: Readonly<Record<string, string>>;
}
