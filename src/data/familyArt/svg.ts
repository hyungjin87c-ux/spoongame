/**
 * 집과 가족 그림 조각을 만드는 도우미 (SPEC-009 FM5). designer의 시안 생성기 `scripts/design/buildFamilyMockups.mjs`의 `mk('s1')`(그림체 「종이 오림」 — 선 없음, 평면 조각 + (3,3) 밀린 반투명 그림자)을 그대로 옮겼다.
 * 결과는 **마크업 조각(문자열)** 이고, 화면(`ui/svgNodes.tsx`)이 허용된 태그·속성만 React 노드로 바꿔 그린다(`dangerouslySetInnerHTML` 없음 — CR-UI).
 * 색은 모두 디자인 토큰 `var(--c-scene-*, 라이트 값)`이다 — 하드코딩 색 0(기본값은 CSS가 없는 뷰어를 위한 fallback이고 `tokens.css`의 라이트 값과 같다, `tests/sceneAssets.test.ts`가 대조한다).
 */

/** 라이트 값 24개 — SVG fallback이자 `tokens.css` 라이트 블록의 값과 같아야 한다 */
export const SCENE_LIGHT = {
  sky: '#dfe6ed', far: '#b9c4d0', far2: '#cfd8e2', ground: '#e4dccb', ground2: '#cfc5ae',
  wall: '#f5f0e5', wall2: '#cdc3ac', roof: '#5b6879', roof2: '#404b58', wood: '#8a6b4c', clay: '#926f52',
  ink: '#2b2a27', shade: 'rgba(38,50,74,0.2)', glass: '#fbf3d4', green: '#6e8a5b',
  cloth1: '#26324a', cloth2: '#8a6a14', cloth3: '#f7f2e8', cloth4: '#6c7f9e',
  skin: '#f1c9a5', hair: '#2b2420', hairw: '#d6d2ca', pet: '#a98c66', pet2: '#4a453d', face: '#4a362c',
} as const;
export type SceneToken = keyof typeof SCENE_LIGHT;

export const T = (n: string): string => `var(--c-scene-${n},${SCENE_LIGHT[n as SceneToken]})`;
export const r1 = (n: number): number => Math.round(n * 10) / 10;

interface Opt {
  shade?: boolean;
  flat?: boolean;
  rx?: number;
  tf?: string;
}

/** 그림체 s1의 그리기 도우미: 반환은 모두 마크업 문자열 */
export const h = {
  path: (d: string, fill: string, o: Opt = {}): string => (o.shade ? `<path d="${d}" fill="${T('shade')}" transform="translate(3 3)"/>` : '') + `<path d="${d}" fill="${fill}"/>`,
  rect: (x: number, y: number, w: number, hh: number, fill: string, o: Opt = {}): string => {
    const attrs = `x="${r1(x)}" y="${r1(y)}" width="${r1(w)}" height="${r1(hh)}"${o.rx ? ` rx="${o.rx}"` : ''}${o.tf ? ` transform="${o.tf}"` : ''}`;
    return (o.shade ? `<rect ${attrs} fill="${T('shade')}" transform="translate(3 3)"/>` : '') + `<rect ${attrs} fill="${fill}"/>`;
  },
  circle: (cx: number, cy: number, r: number, fill: string, o: Opt = {}): string => {
    const attrs = `cx="${r1(cx)}" cy="${r1(cy)}" r="${r1(r)}"`;
    return (o.shade ? `<circle ${attrs} fill="${T('shade')}" transform="translate(3 3)"/>` : '') + `<circle ${attrs} fill="${fill}"/>`;
  },
  ellipse: (cx: number, cy: number, rx: number, ry: number, fill: string, o: Opt = {}): string => {
    const attrs = `cx="${r1(cx)}" cy="${r1(cy)}" rx="${r1(rx)}" ry="${r1(ry)}"`;
    return (o.shade ? `<ellipse ${attrs} fill="${T('shade')}" transform="translate(3 3)"/>` : '') + `<ellipse ${attrs} fill="${fill}"/>`;
  },
  /** 가는 띠(전선·안테나·자전거 살): 어두운 조각 색 */
  stroke: (d: string, w = 3, tok = 'roof2'): string => `<path d="${d}" fill="none" stroke="${T(tok)}" stroke-width="${Math.max(2, w - 0.5)}" stroke-linecap="round" stroke-linejoin="round"/>`,
};

/** 기와 물결 — 반복 도형 (family-scene.md 4절: 호마다 path 하나가 아니라 한 path에 이어 쓴다) */
export const tiles = (x0: number, x1: number, y: number, n: number): string => {
  let d = '';
  const step = (x1 - x0) / n;
  for (let i = 0; i < n; i++) d += `M ${r1(x0 + i * step)},${y} a ${r1(step / 2)} ${r1(step / 2)} 0 0 0 ${r1(step)} 0 Z `;
  return h.path(d.trim(), T('roof2'));
};
/** 창호(문살) — 마루 뒤의 방문 */
export const lattice = (x: number, y: number, w: number, hh: number): string =>
  h.rect(x, y, w, hh, T('cloth3')) + h.stroke(`M ${r1(x + w / 2)},${y} V ${r1(y + hh)} M ${x},${r1(y + hh / 3)} H ${r1(x + w)} M ${x},${r1(y + (2 * hh) / 3)} H ${r1(x + w)}`, 1.5, 'wood');
