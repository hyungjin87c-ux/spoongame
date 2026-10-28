import type { EraWindow } from '../../core/eraWindow';

/**
 * 시대의 창 10년 덩어리 하나의 모양 (SPEC-009 FM5, family-model.md 9-5절). `windows`는 **승인된(approved: true) 장면만** 담고, `art`는 그 장면의 그림 조각 마크업(40×32 좌표계)이다 — `EraWindow.draw`가 `art`의 열쇠다.
 *  - 색은 `class`(`e-<토큰>` 채움 · `es-` 선 · `et-`·`eb-`·`eh-`·`ek-` 사람 색 변수)로만 준다. 클래스 규칙은 `styles/family.css`의 토큰 규칙이고, 화면의 파서(`ui/svgNodes.tsx`)는 이 목록에 있는 class만 통과시킨다 (FM5b R-549).
 *  - `defs`는 이 10년 덩어리의 그림들이 함께 쓰는 반복 무늬(`<pattern>`)와 사람 `<symbol>`(`FIG_DEFS`)을 **10년 덩어리마다 한 번만** 둔 `<defs>…</defs>`다. 화면은 그릴 때 `defs + art[id]`를 한 SVG에 넣는다.
 * 장면의 `years`는 이 10년대 안에 있어야 한다(`tests/eraWindows.test.ts`). 이 파일들은 `npm run gen:era`(scripts/genEraWindows.ts)가 designer 조각에서 만든다.
 */
export interface EraDecadeData {
  readonly windows: readonly EraWindow[];
  readonly art: Readonly<Record<string, string>>;
  /** 이 10년 덩어리의 그림이 함께 쓰는 `<defs>…</defs>` (없으면 생략) */
  readonly defs?: string;
}
