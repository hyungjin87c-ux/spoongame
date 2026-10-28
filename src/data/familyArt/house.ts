import { T, h, lattice, tiles } from './svg';

/**
 * 지붕을 바꿔 그릴 수 있는 집 조각 하나 (SPEC-009 FM5): `house-detached-h1`(~1969 단독주택)의 지붕은 초가(`thatch`) 또는 기와(`tile`)다 — 조각을 늘리지 않는 변형(family-scene.md 2-3절 `params.roof`).
 * designer 시안 생성기의 같은 조각을 그대로 옮겼다. 나머지 집·배경·소품·반려동물은 파라미터가 없어 `scripts/genFamilyArt.ts`가 시안 SVG 파일에서 그대로 뽑는다(`pieces.json`).
 */
export function detachedH1Markup(roof: 'thatch' | 'tile' = 'thatch'): string {
  const thatch = roof === 'thatch';
  return [
    // 사립문·돌담(왼쪽) — 낮은 담, 나뭇가지 문
    h.rect(0, -34, 44, 34, T('wall2'), { shade: true }),
    h.rect(10, -30, 24, 30, T('wood')),
    h.stroke('M 14,-28 V -4 M 22,-28 V -4 M 30,-28 V -4', 1.5, 'wall2'),
    // 본채 — 흙벽, 마루 가운데, 양옆 방문(창호)
    h.rect(56, -78, 300, 78, T(thatch ? 'wall2' : 'wall'), { shade: true }),
    h.rect(56, -12, 300, 12, T('ground2')),
    // 마루: 나무 판 + 기둥
    h.rect(150, -72, 130, 60, T('wood')),
    h.stroke('M 150,-56 H 280 M 150,-40 H 280 M 150,-24 H 280', 1.5, 'clay'),
    h.rect(146, -78, 6, 66, T('clay')),
    h.rect(278, -78, 6, 66, T('clay')),
    lattice(76, -66, 50, 44),
    lattice(304, -66, 40, 44),
    lattice(170, -70, 36, 34),
    lattice(232, -70, 36, 34),
    // 지붕 — 초가(둥근 어깨) 또는 기와(물결)
    thatch
      ? h.path('M 34,-76 Q 40,-92 70,-108 Q 110,-124 206,-124 Q 302,-124 342,-108 Q 372,-92 378,-76 Q 300,-82 206,-82 Q 112,-82 34,-76 Z', T('clay'), { shade: true }) +
        h.path('M 96,-114 Q 150,-121 206,-121 Q 262,-121 316,-114 Q 262,-110 206,-110 Q 150,-110 96,-114 Z', T('wood'))
      : h.path('M 36,-78 L 72,-112 L 338,-112 L 376,-78 Z', T('roof'), { shade: true }) + h.rect(72, -115, 266, 5, T('roof2'), { rx: 1 }) + h.rect(36, -81, 340, 6, T('roof2'), { rx: 1 }) + tiles(38, 374, -75, 21),
    // 연통(주방 쪽)
    h.rect(330, -100, 7, 24, T('clay'), { rx: 1 }),
  ].join('');
}
