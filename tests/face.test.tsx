import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import faceSource from '../src/ui/Face.tsx?raw';
import { AGE_GROUPS, ageGroupOf, faceNodes, faceSvg, looksTierOf, type AgeGroupId, type FaceNode, type LooksTier } from '../src/assets/faces/faceLayers';
import { Face } from '../src/ui/Face';

/**
 * 얼굴 그림 (SPEC-003 DS4·DS5·DB9): designer의 순수 함수(assets/faces/faceLayers.ts#faceNodes)가 만든 노드를 React 노드로 그린다.
 * 연령대 8 × 성별 2 × 외모 5단계 = 80조합이 모두 그려지고, 연령대 경계 나이에서만 그림이 바뀌며, 외모는 점수·단계 글자 없이 그림으로만 드러난다(R-135).
 */
const GROUPS = AGE_GROUPS.map((g) => g.id);
const TIERS: LooksTier[] = [1, 2, 3, 4, 5];
const GENDERS = ['female', 'male'] as const;
/** 단계 안의 대표 점수 */
const SCORE_OF_TIER: Record<LooksTier, number> = { 1: 10, 2: 35, 3: 50, 4: 65, 5: 90 };
const AGE_OF_GROUP: Record<AgeGroupId, number> = { infant: 1, toddler: 5, child: 10, teen: 16, young: 30, middle: 50, senior: 68, elder: 85 };

const markup = (age: number, gender: 'female' | 'male', looks: number, large?: boolean) => renderToStaticMarkup(<Face age={age} gender={gender} looks={looks} large={large} />);
const count = (text: string, re: RegExp) => (text.match(re) ?? []).length;
const tagCount = (nodes: FaceNode[], tag: FaceNode['tag']): number => nodes.reduce((a, n) => a + (n.tag === tag ? 1 : 0) + (n.tag === 'g' ? tagCount(n.children, tag) : 0), 0);
const dValues = (text: string) => [...text.matchAll(/ d="([^"]*)"/g)].map((m) => m[1]);

describe('Face: 80조합이 모두 그려진다', () => {
  it('연령대 8 × 성별 2 × 외모 5단계: 상자(.face)와 svg(viewBox, 장식 aria-hidden, 강제 색상에서도 그림 색 유지)가 모두 있다', () => {
    let n = 0;
    for (const group of GROUPS)
      for (const gender of GENDERS)
        for (const tier of TIERS) {
          const html = markup(AGE_OF_GROUP[group], gender, SCORE_OF_TIER[tier]);
          const where = `${group} ${gender} ${tier}단계`;
          expect(html, where).toMatch(/^<div class="face" data-testid="face" data-age-group="[a-z]+"><svg viewBox="0 0 120 120" aria-hidden="true" focusable="false" style="forced-color-adjust:none">/);
          expect(html, where).toContain(`data-age-group="${group}"`);
          expect(count(html, /<path /g) + count(html, /<ellipse /g) + count(html, /<rect /g), where).toBeGreaterThan(5);
          n++;
        }
    expect(n).toBe(80);
  });

  it('designer의 순수 함수와 같은 그림이다: 태그별 개수와 경로(d) 순서가 faceNodes·faceSvg와 같다', () => {
    for (const group of GROUPS)
      for (const gender of GENDERS)
        for (const tier of TIERS) {
          const html = markup(AGE_OF_GROUP[group], gender, SCORE_OF_TIER[tier]);
          const nodes = faceNodes({ ageGroup: group, gender, tier });
          const where = `${group} ${gender} ${tier}단계`;
          expect(count(html, /<path /g), where).toBe(tagCount(nodes, 'path'));
          expect(count(html, /<ellipse /g), where).toBe(tagCount(nodes, 'ellipse'));
          expect(count(html, /<rect /g), where).toBe(tagCount(nodes, 'rect'));
          expect(count(html, /<g /g), where).toBe(tagCount(nodes, 'g'));
          expect(dValues(html), where).toEqual(dValues(faceSvg({ ageGroup: group, gender, tier })));
        }
  });
});

describe('Face: 연령대 경계에서만 그림이 바뀐다', () => {
  const bounds: Array<[age: number, group: AgeGroupId]> = [
    [0, 'infant'],
    [2, 'infant'],
    [3, 'toddler'],
    [6, 'toddler'],
    [7, 'child'],
    [12, 'child'],
    [13, 'teen'],
    [19, 'teen'],
    [20, 'young'],
    [39, 'young'],
    [40, 'middle'],
    [59, 'middle'],
    [60, 'senior'],
    [74, 'senior'],
    [75, 'elder'],
    [100, 'elder'],
    [120, 'elder'],
  ];

  it('경계 나이 17개: 표시된 연령대와 그림이 기대와 같다', () => {
    for (const [age, group] of bounds) {
      const html = markup(age, 'female', 50);
      expect(html, `${age}세`).toContain(`data-age-group="${group}"`);
      expect(ageGroupOf(age)).toBe(group);
    }
  });

  it('같은 연령대 안에서는 나이가 달라도 그림이 같고, 경계를 넘으면 그림이 달라진다 (0~120세 전수)', () => {
    let changes = 0;
    let prev = markup(0, 'male', 50);
    for (let age = 1; age <= 120; age++) {
      const html = markup(age, 'male', 50);
      const boundary = AGE_GROUPS.some((g) => g.minAge === age);
      if (boundary) {
        expect(html, `${age}세는 연령대 경계 — 그림이 바뀐다`).not.toBe(prev);
        changes++;
      } else expect(html, `${age}세는 경계가 아님 — 그림이 같다`).toBe(prev);
      prev = html;
    }
    expect(changes).toBe(AGE_GROUPS.length - 1);
  });

  it('나이가 이상한 값이어도 던지지 않는다 (음수·소수·NaN은 영아/내림)', () => {
    expect(markup(-5, 'female', 50)).toContain('data-age-group="infant"');
    expect(markup(Number.NaN, 'female', 50)).toContain('data-age-group="infant"');
    expect(markup(2.9, 'female', 50)).toContain('data-age-group="infant"');
    expect(markup(3.1, 'female', 50)).toContain('data-age-group="toddler"');
  });
});

describe('Face: 외모와 성별은 그림으로만 드러난다', () => {
  it('외모 5단계가 모두 다른 그림이고, 같은 단계 안의 점수는 같은 그림이다 (단계 경계 점수 포함)', () => {
    for (const group of GROUPS)
      for (const gender of GENDERS) {
        const age = AGE_OF_GROUP[group];
        const byTier = TIERS.map((t) => markup(age, gender, SCORE_OF_TIER[t]));
        expect(new Set(byTier).size, `${group} ${gender}: 5단계가 서로 다르다`).toBe(5);
      }
    const same: Array<[number, number]> = [
      [0, 27],
      [28, 40],
      [41, 59],
      [60, 71],
      [72, 100],
    ];
    same.forEach(([lo, hi], i) => {
      expect(looksTierOf(lo)).toBe(i + 1);
      expect(looksTierOf(hi)).toBe(i + 1);
      expect(markup(30, 'female', lo), `${lo}~${hi}점`).toBe(markup(30, 'female', hi));
    });
    expect(markup(30, 'female', 59)).not.toBe(markup(30, 'female', 60));
  });

  it('성별이 다르면 그림이 다르다', () => {
    for (const group of GROUPS) expect(markup(AGE_OF_GROUP[group], 'female', 50), group).not.toBe(markup(AGE_OF_GROUP[group], 'male', 50));
  });

  it('화면 글자는 하나도 없다: 외모 점수·단계 숫자·연령대 이름·data-* 힌트가 마크업에 새지 않는다 (R-135)', () => {
    for (const looks of [3, 27, 28, 41, 60, 72, 88, 100]) {
      const html = markup(30, 'female', looks);
      expect(html.replace(/<[^>]*>/g, ''), `${looks}점`).toBe('');
      expect(html).not.toMatch(/data-tier|data-looks|data-score|aria-label|title=/);
      // data-* 속성은 연령대(상자)·테스트 id(상자)·그림 층 이름(data-layer) 셋뿐 — 외모 단계·점수 힌트가 속성에 새지 않는다
      expect(Object.keys(Object.fromEntries([...html.matchAll(/ (data-[a-z-]+)=/g)].map((m) => [m[1], 1]))).sort()).toEqual(['data-age-group', 'data-layer', 'data-testid']);
    }
  });

  it('색은 CSS 변수(--c-face-*)를 읽는다: 고정 색 몇 개(흰자·머리선)를 빼면 직접 박은 hex가 없다', () => {
    const html = markup(30, 'female', 50);
    const fills = [...html.matchAll(/(?:fill|stroke)="([^"]*)"/g)].map((m) => m[1]).filter((v) => v !== 'none');
    expect(fills.length).toBeGreaterThan(5);
    const vars = fills.filter((v) => v.startsWith('var(--c-face-'));
    expect(vars.length).toBeGreaterThan(fills.length / 2);
    for (const v of fills.filter((x) => !x.startsWith('var('))) expect(v, '변수가 아닌 색').toMatch(/^#(?:FFFFFF|000000)$/i);
  });
});

describe('Face: 크기·구조', () => {
  it('large면 .face--lg (엔딩·데스크톱 프로필 96px), 아니면 없다', () => {
    expect(markup(30, 'female', 50, true)).toContain('class="face face--lg"');
    expect(markup(30, 'female', 50, false)).toContain('class="face"');
    expect(markup(30, 'female', 50)).toContain('class="face"');
  });

  it('React 노드로 직접 그린다: dangerouslySetInnerHTML·innerHTML 없음, 메모로 같은 입력은 다시 만들지 않는다', () => {
    expect(faceSource).not.toMatch(/dangerouslySetInnerHTML=|\.innerHTML\s*=/);
    expect(faceSource).toMatch(/memo\(function Face/);
    expect(faceSource).toMatch(/useMemo\(\(\) => faceNodes\(\{ ageGroup, gender, tier \}\), \[ageGroup, gender, tier\]\)/);
  });
});
