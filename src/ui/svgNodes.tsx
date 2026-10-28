import { createElement, type ReactNode } from 'react';

/**
 * 그림 조각 마크업(문자열) → React 노드 (SPEC-009 FM5). `dangerouslySetInnerHTML`을 쓰지 않는다(CR-UI, `tests/innerHtml.test.ts`) — 우리 저장소의 조각 마크업을 **허용 목록**(태그·속성)만 통과시켜 React 요소로 옮긴다:
 * 목록 밖 태그·`on*` 속성·`style`·바깥 주소(`href`는 `#id`만)·`<script>` 따위는 **버린다**. 조각 마크업은 `familyArt` 덩어리의 상수라 사용자 글이 들어올 길이 없지만, 그림이 늘 때(designer 파일 → 덩어리) 한 번 더 막는다.
 * 같은 화면에 그림이 둘일 때(교차 페이드) `<pattern id>`가 겹치지 않게 `id`·`url(#…)`·`href="#…"`에 **인스턴스 접두어**를 붙인다(family-scene.md 4절).
 */

const TAGS = new Set(['g', 'rect', 'circle', 'ellipse', 'path', 'line', 'polygon', 'polyline', 'defs', 'pattern', 'symbol', 'use']);
/** 하이픈 속성 → React 이름 */
const ATTR_NAME: Readonly<Record<string, string>> = {
  'stroke-width': 'strokeWidth',
  'stroke-linecap': 'strokeLinecap',
  'stroke-linejoin': 'strokeLinejoin',
  'stroke-dasharray': 'strokeDasharray',
  'stroke-opacity': 'strokeOpacity',
  'fill-opacity': 'fillOpacity',
  'fill-rule': 'fillRule',
  'clip-rule': 'clipRule',
};
const ATTRS = new Set([
  'x', 'y', 'x1', 'x2', 'y1', 'y2', 'cx', 'cy', 'r', 'rx', 'ry', 'width', 'height', 'd', 'points', 'transform', 'fill', 'stroke', 'opacity', 'id', 'href', 'viewBox', 'patternUnits', 'patternTransform',
  'strokeWidth', 'strokeLinecap', 'strokeLinejoin', 'strokeDasharray', 'strokeOpacity', 'fillOpacity', 'fillRule', 'clipRule',
]);
/** 값에 들어갈 수 없는 것: 태그 시작 · 스크립트 주소 · 바깥 주소 */
const BAD_VALUE = /[<>]|javascript:|data:|https?:|\/\//i;

export interface SvgNode {
  tag: string;
  props: Record<string, string>;
  children: SvgNode[];
}

/** 접두어를 붙인 값: `id` · `url(#x)` · `#x` */
function prefixed(name: string, value: string, inst: string): string {
  if (name === 'id') return `${inst}-${value}`;
  if (name === 'href') return value.startsWith('#') ? `#${inst}-${value.slice(1)}` : '';
  return value.replace(/url\(#([^)\s]+)\)/g, (_m, id: string) => `url(#${inst}-${id})`);
}

const TOKEN = /<(\/?)([a-zA-Z][\w:-]*)((?:\s+[a-zA-Z_:][-\w:.]*="[^"]*")*)\s*(\/?)>/g;
const ATTR = /([a-zA-Z_:][-\w:.]*)="([^"]*)"/g;

/** 마크업 → 노드 목록. 허용되지 않는 태그는 그 안쪽까지 버리고, 닫히지 않은 태그는 만난 데까지만 쓴다 */
export function parseSvgMarkup(markup: string, inst: string): SvgNode[] {
  const root: SvgNode = { tag: '#root', props: {}, children: [] };
  const stack: SvgNode[] = [root];
  /** 허용되지 않은 태그 안쪽을 건너뛰는 깊이 (0이면 건너뛰지 않는다) */
  let skip = 0;
  for (const m of markup.matchAll(TOKEN)) {
    const [, close, rawTag, rawAttrs, selfClose] = m;
    const tag = rawTag;
    if (close === '/') {
      if (skip > 0) {
        skip--;
        continue;
      }
      if (stack.length > 1 && stack[stack.length - 1].tag === tag) stack.pop();
      continue;
    }
    if (skip > 0) {
      if (selfClose !== '/') skip++;
      continue;
    }
    if (!TAGS.has(tag)) {
      if (selfClose !== '/') skip = 1;
      continue;
    }
    const props: Record<string, string> = {};
    for (const a of rawAttrs.matchAll(ATTR)) {
      const name = ATTR_NAME[a[1]] ?? a[1];
      if (!ATTRS.has(name) || /^on/i.test(name) || BAD_VALUE.test(a[2])) continue;
      const value = prefixed(name, a[2], inst);
      if (value === '' && name === 'href') continue;
      props[name] = value;
    }
    const node: SvgNode = { tag, props, children: [] };
    stack[stack.length - 1].children.push(node);
    if (selfClose !== '/') stack.push(node);
  }
  return root.children;
}

const cache = new Map<string, SvgNode[]>();
function parsed(markup: string, inst: string): SvgNode[] {
  const key = `${inst}\u0000${markup}`;
  let hit = cache.get(key);
  if (hit === undefined) {
    if (cache.size > 600) cache.clear();
    hit = parseSvgMarkup(markup, inst);
    cache.set(key, hit);
  }
  return hit;
}

function toElement(n: SvgNode, key: number): ReactNode {
  return createElement(n.tag, { key, ...n.props }, ...n.children.map(toElement));
}

/** 조각 마크업 하나를 SVG 안쪽 노드로 그린다 */
export function SvgMarkup({ markup, inst }: { markup: string; inst: string }) {
  return <>{parsed(markup, inst).map(toElement)}</>;
}
