import { describe, expect, it } from 'vitest';
import { NO_CONTAINER_QUERIES, WITH_CONTAINER_QUERIES, blocksStartingWith, cssAppliedBy, evaluateSupports, normalizeCss, stripCssComments } from './helpers/browserCss';

/**
 * 컨테이너 질의를 모르는 브라우저(Safari 16 미만)의 폴백 (REV-003-M3-4 R-302, docs/design/design-system.md 11-6).
 * M3 r4가 룰렛 제목 상한(`100cqi`)을 `@supports` 밖에 두고, 비교 표 쌓기·서류 3열을 `@media`에서 `@container`로만 옮겨 구형 브라우저에서 제목이 본문 크기(16px)가 되고 비교 표가 휴대폰에서 3열로 남았다.
 * 이 시험은 `tests/helpers/browserCss.ts`로 「그 브라우저가 실제로 적용할 CSS」를 걸러 내 규칙 문자열로 지킨다(실제 화면 측정은 e2e/m3-css-fallback.spec.ts):
 *  ① `cqi`·`cqw` 같은 컨테이너 단위는 `@supports`/`@container` 안에만 있다 — 모르는 브라우저가 걸러 낸 CSS에는 남지 않는다
 *  ② 모르는 브라우저에서는 룰렛 제목이 `.t-title` 기본 크기(`--fs-2xl`)로 물러난다
 *  ③ 모르는 브라우저에서는 비교 표 쌓기가 뷰포트 < 640px의 `@media`로, 서류 3열이 뷰포트 ≥ 640px의 `@media`로 되살아난다 — 쌓기 본문은 `@container cmp`와 글자 그대로 같다
 *  ④ 아는 브라우저에서는 폴백 블록이 걸러져 예전 뷰포트 규칙이 컨테이너 규칙을 덮지 않는다
 */

/** vitest는 CSS의 ?raw 가져오기를 빈 문자열로 돌려주므로 파일 시스템으로 읽는다(tests/titleCap.test.tsx와 같은 방법) */
async function readText(relative: string): Promise<string> {
  const spec = 'node:fs';
  const fs = (await import(/* @vite-ignore */ spec)) as { readFileSync(path: URL, encoding: 'utf-8'): string };
  return fs.readFileSync(new URL(relative, import.meta.url), 'utf-8');
}
const docCss = await readText('../src/styles/doc.css');

describe('browserCss: 브라우저가 CSS를 읽는 방식 흉내 (합성 CSS)', () => {
  const sample = `
    /* 주석 안의 @container x { a { b: c } } 와 cqi 는 규칙이 아니다 */
    .box { container-type: inline-size; container-name: box; color: red; }
    @container box (max-width: 10rem) { .a { color: blue; } }
    @supports (width: 1cqi) { .t { font-size: calc(100cqi / 7); } }
    @supports not (container-type: inline-size) { @media (max-width: 639px) { .old { display: block; } } }
    @media (min-width: 640px) { @container box (min-width: 5rem) { .wide { color: green; } } .plain { color: black; } }
  `;

  it('@supports 조건: 아는 브라우저는 모두 참, 모르는 브라우저는 container-type·컨테이너 단위만 거짓 (`not`은 뒤집는다)', () => {
    expect(evaluateSupports('(width: 1cqi)', WITH_CONTAINER_QUERIES)).toBe(true);
    expect(evaluateSupports('(width: 1cqi)', NO_CONTAINER_QUERIES)).toBe(false);
    expect(evaluateSupports('not (container-type: inline-size)', WITH_CONTAINER_QUERIES)).toBe(false);
    expect(evaluateSupports('not (container-type: inline-size)', NO_CONTAINER_QUERIES)).toBe(true);
    expect(evaluateSupports('(display: grid)', NO_CONTAINER_QUERIES)).toBe(true);
    expect(() => evaluateSupports('(a: b) and (c: d)', NO_CONTAINER_QUERIES), '모르는 꼴은 조용히 틀리지 않고 던진다').toThrow();
  });

  it('R-489 @supports 값 안의 함수 호출: `(height: clamp(1px, 2px, 3px))`는 던지지 않고 두 브라우저 모두 참이다(함수 호출이 든 @supports 값의 예), `not`은 뒤집고, 조건이 둘이면 여전히 던진다', () => {
    const clamp = '(height: clamp(1px, 2px, 3px))';
    expect(evaluateSupports(clamp, WITH_CONTAINER_QUERIES)).toBe(true);
    expect(evaluateSupports(clamp, NO_CONTAINER_QUERIES), '컨테이너 질의를 모르는 브라우저도 clamp()는 지원한다').toBe(true);
    expect(evaluateSupports(` not ${clamp}`, NO_CONTAINER_QUERIES)).toBe(false);
    // 함수 안에 컨테이너 단위가 있으면 모르는 브라우저는 거짓이다(값 전체를 본다)
    expect(evaluateSupports('(width: calc(1cqi + 2px))', NO_CONTAINER_QUERIES)).toBe(false);
    expect(evaluateSupports('(width: calc(1cqi + 2px))', WITH_CONTAINER_QUERIES)).toBe(true);
    expect(() => evaluateSupports(`${clamp} and (c: d)`, NO_CONTAINER_QUERIES)).toThrow();
    expect(() => evaluateSupports('(a: b(c(d)))', NO_CONTAINER_QUERIES), '함수 두 겹은 풀지 않고 던진다').toThrow();
  });

  it('R-489 실제 소스 CSS: title.css의 모든 @supports 조건을 두 브라우저로 평가해도 던지지 않는다 (e2e-prod 번들 시험이 같은 걸러내기를 쓴다)', async () => {
    const titleCss = await readText('../src/styles/title.css');
    expect(() => cssAppliedBy(titleCss, NO_CONTAINER_QUERIES)).not.toThrow();
    expect(() => cssAppliedBy(titleCss, WITH_CONTAINER_QUERIES)).not.toThrow();
    // 공허 통과 방지: 컨테이너 단위 `@supports (width: 1cqw)` 규칙(SPEC-004 GS11 뒤 title.css에 남은 유일한 @supports)은 아는 브라우저에서만 올라온다.
    // (옛 낮은 창 그림 높이 `clamp()` 규칙은 오른쪽 위 그림과 함께 없어졌다)
    expect(normalizeCss(cssAppliedBy(titleCss, WITH_CONTAINER_QUERIES))).toContain('min(var(--fs-3xl),calc((100cqw');
    expect(normalizeCss(cssAppliedBy(titleCss, NO_CONTAINER_QUERIES))).not.toContain('100cqw');
  });

  it('모르는 브라우저: @container 블록·container-type 선언·cqi 규칙이 사라지고 `@supports not (…)` 안쪽(@media 포함)이 올라온다', () => {
    const css = normalizeCss(cssAppliedBy(sample, NO_CONTAINER_QUERIES));
    expect(css).not.toMatch(/container|cqi/);
    expect(css).toContain('.box{color:red;}');
    expect(css).toContain('@media (max-width:639px){.old{display:block;}}');
    expect(css).toContain('.plain{color:black;}');
    expect(css).not.toContain('.wide');
    expect(css).not.toContain('.a{');
  });

  it('아는 브라우저: @container·container-type·cqi 규칙이 그대로 남고 `@supports not (…)` 폴백은 걸러진다', () => {
    const css = normalizeCss(cssAppliedBy(sample, WITH_CONTAINER_QUERIES));
    expect(css).toContain('container-type:inline-size');
    expect(css).toContain('@container box (max-width:10rem){.a{color:blue;}}');
    expect(css).toContain('.t{font-size:calc(100cqi / 7);}');
    expect(css).toContain('@container box (min-width:5rem){.wide{color:green;}}');
    expect(css).not.toContain('.old');
  });

  it('blocksStartingWith: 머리가 같은 블록의 본문을 모두 찾는다(최상위·@media·@supports 안쪽까지)', () => {
    expect(blocksStartingWith(sample, '@container box (min-width: 5rem)').map(normalizeCss)).toEqual(['.wide{color:green;}']);
    expect(blocksStartingWith(sample, '@media (max-width: 639px)').map(normalizeCss)).toEqual(['.old{display:block;}']);
    expect(blocksStartingWith(sample, '@media (min-width: 1px)')).toEqual([]);
    expect(stripCssComments(sample)).not.toContain('주석 안의');
  });
});

describe('doc.css 폴백 (R-302)', () => {
  const noCq = cssAppliedBy(docCss, NO_CONTAINER_QUERIES);
  const withCq = cssAppliedBy(docCss, WITH_CONTAINER_QUERIES);

  it('공허 통과 방지: 걸러 낸 CSS가 비어 있지 않고, 아는 브라우저의 CSS에는 컨테이너 규칙이 실제로 있다', () => {
    expect(noCq.length).toBeGreaterThan(3_000);
    expect(withCq).toMatch(/@container cmp \(max-width:\s*35rem\)/);
    expect(withCq).toMatch(/@container docbody \(max-width:\s*11\.5rem\)/);
    expect(withCq).toMatch(/@container docbody \(min-width:\s*17\.75rem\)/);
    expect(withCq).toContain('100cqi');
    expect(withCq).toMatch(/container-type:\s*inline-size/);
  });

  it('① 컨테이너 단위(cqi·cqw …)와 container-type·@container가 모르는 브라우저의 CSS에는 하나도 남지 않는다 — 단위를 쓰는 식은 모두 @supports 안에 있다 (식이 통째로 무효가 되어 제목이 16px가 되던 R-302 ①)', () => {
    expect(noCq).not.toMatch(/\dcq(?:w|h|i|b|min|max)\b/i);
    expect(noCq).not.toMatch(/@container/);
    expect(noCq).not.toMatch(/container-(?:type|name)/);
    // 컨테이너 단위를 쓰는 선언은 doc.css에 정확히 `@supports (width: 1cqi)` 안에 있다
    const source = stripCssComments(docCss).replace(/@supports\s*\(\s*width:\s*1cqi\s*\)/g, '@supports (조건식)'); // 조건식 자체의 1cqi는 사용이 아니다
    const uses =[...source.matchAll(/\dcq(?:w|h|i|b|min|max)\b/gi)].length;
    expect(uses, '공허 통과 방지: doc.css가 컨테이너 단위를 실제로 쓴다').toBeGreaterThanOrEqual(1);
    const guarded = blocksStartingWith(docCss, '@supports (width: 1cqi)').join('\n');
    expect([...guarded.matchAll(/\dcq(?:w|h|i|b|min|max)\b/gi)].length, '컨테이너 단위 사용이 모두 @supports (width: 1cqi) 안에 있다').toBe(uses);
  });

  it('② 제목 글자 크기: 모르는 브라우저에서는 `.roulette__lead .t-title`의 font-size 규칙이 사라지고 `.t-title` 기본(--fs-2xl)이 남는다. 아는 브라우저에서는 식이 살아 있다', () => {
    expect(noCq).not.toMatch(/\.roulette__lead \.t-title/);
    expect(noCq).toMatch(/\.t-title\s*\{[^}]*font-size:\s*var\(--fs-2xl\)/);
    expect(withCq).toMatch(/\.roulette__lead \.t-title\s*\{\s*font-size:\s*max\(var\(--fs-lg\), min\(var\(--fs-2xl\), calc\(100cqi \/ var\(--title-chars, 8\)\)\)\);\s*\}/);
    // 식의 모양(바닥 --fs-lg, 상한 100cqi ÷ 칸 수)은 tests/titleCap.test.tsx가 지킨다 — 여기서는 가드가 있는지만
    expect(normalizeCss(stripCssComments(docCss))).toContain('@supports (width:1cqi){.roulette__lead .t-title{');
  });

  it('③ 비교 표 쌓기: 모르는 브라우저에서는 뷰포트 < 640px의 @media로 되살아나고, 쌓기 본문은 `@container cmp (max-width: 35rem)`와 글자 그대로 같다', () => {
    const container = blocksStartingWith(docCss, '@container cmp (max-width: 35rem)');
    expect(container, '컨테이너 쌓기 블록이 하나').toHaveLength(1);
    const stack = blocksStartingWith(noCq, '@media (max-width: 639px)');
    expect(stack.length, '모르는 브라우저에서 살아난 < 640px 블록').toBeGreaterThanOrEqual(1);
    expect(stack.map(normalizeCss), '폴백 쌓기 본문 = 컨테이너 쌓기 본문').toContain(normalizeCss(container[0]));
    // 쌓기의 핵심 규칙이 둘 다에 있다(위 동일성이 빈 본문끼리의 일치가 아님)
    expect(normalizeCss(container[0])).toContain('.table--cmp tr{display:grid;');
    expect(normalizeCss(container[0])).toContain('.table--cmp td::before{content:attr(data-label);');
    expect(normalizeCss(container[0])).toContain('.table--cmp thead{position:absolute;');
  });

  it('③ 서류 격자: 모르는 브라우저에서는 뷰포트 ≥ 640px의 @media가 3열을 되살린다(컨테이너 질의가 없어도). 1열 쌓기는 되살리지 않는다', () => {
    const wide = blocksStartingWith(noCq, '@media (min-width: 640px)').map(normalizeCss).join(' ');
    expect(wide).toContain('.doc__grid{grid-template-columns:repeat(3,minmax(0,1fr));}');
    // 기본(좁은 화면)은 2열
    expect(normalizeCss(noCq)).toMatch(/\.doc__grid\{display:grid;grid-template-columns:repeat\(2,minmax\(0,1fr\)\);/);
    // 1열(컨테이너 폭이 11.5rem 아래)은 컨테이너 질의가 있어야 하는 규칙이라 폴백에 없다
    expect(noCq).not.toMatch(/grid-template-columns:\s*minmax\(0,\s*1fr\)\s*;/);
  });

  it('④ 아는 브라우저에서는 폴백 블록이 걸러진다: 뷰포트 < 640px의 비교 표 쌓기 규칙이 없고, 3열은 컨테이너 질의(@container docbody)를 거친 것뿐이다', () => {
    expect(blocksStartingWith(withCq, '@media (max-width: 639px)').map(normalizeCss).join(' ')).not.toContain('.table--cmp');
    const wide = blocksStartingWith(withCq, '@media (min-width: 640px)').map(normalizeCss).join(' ');
    expect(wide).toContain('@container docbody (min-width:17.75rem){.doc__grid{grid-template-columns:repeat(3,minmax(0,1fr));}}');
    // @media 안쪽 최상위 규칙에는 3열이 없다(컨테이너 안쪽에만)
    expect(wide.replace(/@container docbody \(min-width:17\.75rem\)\{[^}]*\}\}/, '')).not.toContain('repeat(3');
  });

  it('폴백 블록은 `@supports not (container-type: inline-size)` 하나이고 비교 표 쌓기(@media max-width 639px)와 서류 3열(@media min-width 640px)만 담는다 — 다른 규칙이 폴백 안에 슬쩍 들어가지 않는다', () => {
    const fallback = blocksStartingWith(docCss, '@supports not (container-type: inline-size)');
    expect(fallback).toHaveLength(1);
    const inner = normalizeCss(fallback[0]);
    expect(inner.startsWith('@media (max-width:639px){')).toBe(true);
    expect(inner).toContain('@media (min-width:640px){.doc__grid{grid-template-columns:repeat(3,minmax(0,1fr));}}');
    // 선택자 목록(규칙 머리)만 모아 본다: 폴백이 만지는 선택자는 비교 표와 서류 격자뿐
    const selectors = [...inner.matchAll(/([^{}]+)\{[^{}]*\}/g)].map((m) => m[1].trim()).filter((s) => !s.startsWith('@'));
    for (const s of selectors) expect(s, `폴백 안의 선택자 ${s}`).toMatch(/^\.table--cmp|^\.doc__grid$/);
    expect(selectors.length).toBeGreaterThanOrEqual(8);
  });
});
