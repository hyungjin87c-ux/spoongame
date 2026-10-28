import type { ReactNode } from 'react';
import type { ScenePlacement, SceneSpec } from '../../core/scene';
import { PIECE_BY_ID, type FamilyArt, type PieceOpt } from '../../data/sceneTables';
import { SvgMarkup } from '../svgNodes';

/**
 * `renderScene`: `SceneSpec` → SVG (SPEC-009 FM5, family-scene.md 1절). 층마다 `<g data-layer>`를 만들고 조각을 `<g data-piece transform="translate(x y) scale(s)">`로 놓는다.
 * 그리는 순서 = 배경 → 소품-뒤 → 집 → 소품-앞 → 반려동물 → 식구. 조각 마크업은 지연 덩어리 `familyArt`에서 온다 — 아직 그리지 않은 조각은 표(`data/sceneTables.ts`)가 가리키는 가장 가까운 조각으로 대신 그리고,
 * 대신 그릴 것도 없으면(새·어항 따위) 그리지 않는다(대체 글에는 있다 — FH6). 색은 모두 `var(--c-scene-*)` 토큰이라 다크·라이트는 CSS가 바꾼다.
 */

export const LAYER_NAMES = ['배경', '소품-뒤', '집', '소품-앞', '반려동물', '식구'] as const;

interface Resolved {
  markup: string;
  /** 대신 그린 조각이면 그 id */
  via?: string;
}

/** 조각 id → 마크업. 안 그린 조각은 표의 대신 그릴 조각으로, 표에 없는 id(식구)는 덩어리의 규칙으로 */
export function resolvePiece(art: FamilyArt, id: string, opt?: PieceOpt): Resolved | null {
  const meta = PIECE_BY_ID.get(id);
  if (meta === undefined || meta.drawn) {
    const m = art.piece(id, opt);
    return m === null ? null : { markup: m };
  }
  if (meta.stand === null) return null;
  const m = art.piece(meta.stand.id, { ...meta.stand.opt, ...opt });
  return m === null ? null : { markup: m, via: meta.stand.id };
}

function Piece({ art, p, inst, self }: { art: FamilyArt; p: ScenePlacement; inst: string; self?: boolean }) {
  const r = resolvePiece(art, p.id, p.opt);
  if (r === null) return null;
  const transform = `translate(${p.x} ${p.y})${p.scale !== undefined && p.scale !== 1 ? ` scale(${p.scale})` : ''}`;
  return (
    <g data-piece={p.id} data-via={r.via} data-self={self === true ? 'true' : undefined} transform={transform}>
      <SvgMarkup markup={r.markup} inst={inst} />
    </g>
  );
}

function Layer({ name, items, art, inst }: { name: (typeof LAYER_NAMES)[number]; items: readonly (ScenePlacement & { who?: string })[]; art: FamilyArt; inst: string }): ReactNode {
  return (
    <g data-layer={name}>
      {items.map((p, i) => (
        <Piece key={`${p.id}-${i}`} art={art} p={p} inst={inst} self={p.who === 'me'} />
      ))}
    </g>
  );
}

interface Props {
  spec: SceneSpec;
  art: FamilyArt;
  /** 같은 화면에 그림이 둘일 때 `<pattern id>`가 겹치지 않게 붙이는 접두어 */
  inst: string;
  /** 접근 이름: 연도 표 · 아래 한 줄 · 반려동물 문장 요소의 id들 (`aria-labelledby`) */
  labelledBy?: string;
  /** 겹쳐 두는 이전 그림(교차 페이드)은 보조기기에서 숨긴다 */
  decorative?: boolean;
  className?: string;
}

export function SceneSvg({ spec, art, inst, labelledBy, decorative = false, className = 'scene__svg' }: Props) {
  const a11y = decorative ? { 'aria-hidden': true as const } : { role: 'img' as const, 'aria-labelledby': labelledBy };
  return (
    <svg className={className} viewBox="0 0 640 256" preserveAspectRatio="xMidYMid slice" focusable="false" {...a11y}>
      <Layer name="배경" items={[spec.bg]} art={art} inst={inst} />
      <Layer name="소품-뒤" items={spec.back} art={art} inst={inst} />
      <Layer name="집" items={[spec.house]} art={art} inst={inst} />
      <Layer name="소품-앞" items={spec.front} art={art} inst={inst} />
      <Layer name="반려동물" items={spec.pets} art={art} inst={inst} />
      <Layer name="식구" items={spec.family} art={art} inst={inst} />
    </svg>
  );
}
