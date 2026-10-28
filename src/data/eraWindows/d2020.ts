import type { EraDecadeData } from './types';

/**
 * 시대의 창 2020년대 덩어리. 승인된 장면이 올 때 `windows`에 데이터 한 줄, `art`에 조각 마크업 한 줄을 더한다 — 그리고 `index.ts`의 `ERA_DECADES_WITH_DATA`에 2020를 적는다(시험이 일치를 잠근다).
 * 지금(FM5)은 승인된 그림이 0장이다. `approved`는 `true`만 쓸 수 있다(`EraWindow.approved`의 타입) — 미승인 장면은 이 파일에 넣을 수 없다(FT3 「승인한 것만」).
 */
export const ERA_DECADE: EraDecadeData = { windows: [], art: {} };
