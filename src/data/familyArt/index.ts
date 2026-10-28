import { FIGURE_ID, INFANT_CARRIED, type FamilyArt, type FigureGroup, type OutfitEra, type PieceOpt } from '../sceneTables';
import { figureMarkup, infantCarriedMarkup } from './figure';
import { ERA_DECADES_WITH_DATA } from '../eraWindows';
import { detachedH1Markup } from './house';
import piecesJson from './pieces.json';

/**
 * 집과 가족 그림 덩어리 `familyArt` (SPEC-009 FM5, family-model.md A-10): 그림 조각(마크업)과 식구를 만드는 코드. 표 덩어리 `familyData`(`data/familyTables.ts`)와 **따로** 「태어나기」 뒤에 지연 로드된다 —
 * 첫 화면은 이 파일을 정적으로 import하지 않는다(`tests/lazyBoundary.test.ts`가 잠근다). 로드가 실패해도 게임은 계속되고 그림 칸만 빈다(`ui/scene/useFamilyArt.ts`).
 *
 * 조각 마크업은 `pieces.json`(designer가 그린 SVG에서 `npm run gen:art`가 뽑은 25개) + 코드(식구 `figure.ts` · 지붕을 바꾸는 집 `house.ts`)이다. 색은 모두 `var(--c-scene-*, 라이트 값)` 토큰뿐이다.
 * 시대의 창 그림은 이 덩어리가 아니라 10년 하위 덩어리(`data/eraWindows/`)에 있다 — 판 하나가 한 번에 받는 양을 줄이려고(마스터 결정: ≤ 75KB).
 */
const PIECES = piecesJson as Readonly<Record<string, string>>;

export const FAMILY_ART: FamilyArt = {
  piece(id: string, opt: PieceOpt = {}): string | null {
    const fig = FIGURE_ID.exec(id);
    if (fig !== null) return figureMarkup(fig[1] as FigureGroup, fig[2] as 'f' | 'm', fig[3] as OutfitEra, opt);
    if (id === INFANT_CARRIED) return infantCarriedMarkup(opt);
    if (id === 'house-detached-h1') return detachedH1Markup(opt.roof ?? 'tile'); // 초가는 sceneOf가 명시한 때만 — 기본은 기와
    return PIECES[id] ?? null;
  },
  eraDecades: ERA_DECADES_WITH_DATA,
};

/** 지금 이 덩어리가 마크업을 가진 조각 id (그림 조각 25 + 지붕을 바꾸는 집 1) — 식구는 규칙으로 만든다 */
export const ART_PIECE_IDS: readonly string[] = [...Object.keys(PIECES), 'house-detached-h1'].sort();
