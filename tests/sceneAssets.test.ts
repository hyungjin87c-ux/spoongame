import { describe, expect, it } from 'vitest';
import { contrastRatio, parseHex, readThemeBlocks, themeTokens } from '../scripts/checkContrastLib';
import { ART_PIECE_IDS, FAMILY_ART } from '../src/data/familyArt';
import { figureMarkup, infantCarriedMarkup } from '../src/data/familyArt/figure';
import { detachedH1Markup } from '../src/data/familyArt/house';
import piecesJson from '../src/data/familyArt/pieces.json';
import { SCENE_LIGHT } from '../src/data/familyArt/svg';
import { FIGURE_GEO, FIGURE_ID, INFANT_CARRIED, MAX_PIECES, PIECE_BY_ID, SCENE_PIECES, SCENE_PIECE_COUNT, SCENE_RULES, SCENE_TOKEN_NAMES, type FigureGroup, type OutfitEra, type PieceMeta } from '../src/data/sceneTables';
import { ALLOWED_CLASSES, parseSvgMarkup } from '../src/ui/svgNodes';

/**
 * 집과 가족 그림 조각의 계약 (SPEC-009 FM5, FH2·FH6·FH7·FH8, family-scene.md 2·4절): 표(`sceneTables`)와 그림 덩어리(`familyArt`)가 어긋나지 않고, 색은 토큰뿐이며, 크기가 예산 안이다.
 */

async function readText(relative: string): Promise<string> {
  const spec = 'node:fs';
  const fs = (await import(/* @vite-ignore */ spec)) as { readFileSync(path: URL, encoding: 'utf-8'): string };
  return fs.readFileSync(new URL(relative, import.meta.url), 'utf-8');
}
async function gzipBytes(text: string): Promise<number> {
  const spec = 'node:zlib';
  const zlib = (await import(/* @vite-ignore */ spec)) as { gzipSync(b: unknown): { length: number } };
  const buf = (await import(/* @vite-ignore */ 'node:buffer' as string)) as { Buffer: { from(s: string, e: string): unknown } };
  return zlib.gzipSync(buf.Buffer.from(text, 'utf8')).length;
}

const tokensCss = await readText('../src/styles/tokens.css');
const blocks = readThemeBlocks(tokensCss);
const PIECES = piecesJson as Record<string, string>;
const GROUPS = Object.keys(FIGURE_GEO) as FigureGroup[];
const ERAS: OutfitEra[] = ['e1', 'e2', 'e3'];

describe('표와 그림 덩어리의 일치', () => {
  it('그린(drawn) 조각은 모두 덩어리에 마크업이 있고, 덩어리의 조각은 모두 표에 그렸다고 적혀 있다(고아 조각 0)', () => {
    for (const p of SCENE_PIECES.filter((x) => x.drawn)) expect(FAMILY_ART.piece(p.id), `${p.id}: 그렸다고 했는데 마크업이 없다`).toBeTypeOf('string');
    for (const id of ART_PIECE_IDS) expect(PIECE_BY_ID.get(id)?.drawn, `${id}: 덩어리에는 있는데 표에는 그리지 않았다고 적혀 있다`).toBe(true);
    expect(new Set(ART_PIECE_IDS).size).toBe(ART_PIECE_IDS.length);
  });

  it('FM5b: 모든 조각이 그려졌다(안 그린 조각 0) — 집 22 · 배경 12 · 소품 · 반려동물 6', () => {
    expect(SCENE_PIECES.filter((p) => !p.drawn).map((p) => p.id)).toEqual([]);
    expect(SCENE_PIECES.filter((p) => p.layer === 'house').length).toBe(22);
    expect(SCENE_PIECES.filter((p) => p.layer === 'bg').length).toBe(12);
    expect(SCENE_PIECES.filter((p) => p.layer === 'pet').length).toBe(6);
    // 상자 · 슬롯이 designer 인계표(family-scene.md 2-8절)와 같은 형태다: 집마다 창 슬롯이 있다
    for (const p of SCENE_PIECES.filter((x) => x.layer === 'house')) expect(p.slots?.window ?? p.slots?.porch, `${p.id}: 반려동물 자리`).toBeDefined();
  });

  /** designer 대기 허용 목록 — 대신 그리는 조각의 연도가 요청 연도를 덮지 않는 조각은 여기에만 둘 수 있다. **0이어야 한다**(R-544) */
  const STAND_YEAR_WAIT: readonly string[] = [];

  /** 대신 그리는(`stand`) 조각의 연도가 요청 조각의 연도를 덮지 않는 조각 id들 (순수 점검 — 합성 표로도 시험한다) */
  function standYearGaps(pieces: readonly Pick<PieceMeta, 'id' | 'years' | 'drawn' | 'stand'>[]): string[] {
    const byId = new Map(pieces.map((p) => [p.id, p]));
    const covers = (outer: PieceMeta['years'], inner: PieceMeta['years']): boolean => {
      if (outer === null) return true;
      if (inner === null) return false;
      const innerEnd = inner[1] ?? Infinity;
      const outerEnd = outer[1] ?? Infinity;
      return outer[0] <= inner[0] && outerEnd >= innerEnd;
    };
    return pieces.filter((p) => !p.drawn && p.stand !== null && !covers(byId.get(p.stand.id)?.years ?? null, p.years)).map((p) => p.id);
  }

  it('대신 그리는 조각(stand)의 연도가 요청 조각의 연도를 덮지 않으면 허용 목록(designer 대기)에만 둔다 — 허용 목록은 0이다 (R-544, pieceInYear 구멍)', () => {
    expect(STAND_YEAR_WAIT.length, '허용 목록은 0이어야 한다').toBe(0);
    const gaps = standYearGaps(SCENE_PIECES);
    for (const id of gaps) expect(STAND_YEAR_WAIT, `${id}: 대신 그리는 조각의 연도가 요청 연도를 덮지 않는다 — 허용 목록(designer 대기)에만 둘 수 있다`).toContain(id);
    expect(gaps).toEqual([]);
  });

  it('standYearGaps 점검 자체: 합성 표에서 연도가 덮이지 않는 대신 그림을 잡는다(1970~99 셋방으로 2000년대 집을 그리는 경우)', () => {
    const drawnRent = { id: 'r2', years: [1970, 1999] as const, drawn: true, stand: null };
    const wantsH3 = { id: 'h3', years: [2000, null] as const, drawn: false, stand: { id: 'r2' } };
    const wantsH2 = { id: 'h2', years: [1970, 1999] as const, drawn: false, stand: { id: 'r2' } };
    const anyYear = { id: 'any', years: null, drawn: false, stand: { id: 'r2' } };
    expect(standYearGaps([drawnRent, wantsH3, wantsH2, anyYear])).toEqual(['h3', 'any']);
    expect(standYearGaps([drawnRent, wantsH2])).toEqual([]);
  });

  it('안 그린 조각이 생기면(있다면) 대신 그림은 그려진 조각이거나 null이고, 집의 상자·자리는 대신 그리는 조각과 같다 — 집·배경은 대신 그릴 조각이 반드시 있다', () => {
    const undrawn = SCENE_PIECES.filter((p) => !p.drawn);
    for (const p of undrawn) {
      if (p.stand === null) continue;
      const target = PIECE_BY_ID.get(p.stand.id);
      expect(target?.drawn, `${p.id} → ${p.stand.id}: 대신 그리는 조각이 그려져 있지 않다`).toBe(true);
      if (p.layer === 'house') {
        expect(p.box, p.id).toEqual(target!.box);
        expect(p.slots, p.id).toEqual(target!.slots);
      }
    }
    for (const p of undrawn.filter((x) => x.layer === 'bg' || x.layer === 'house')) expect(p.stand, p.id).not.toBeNull();
  });

  it('조각 id가 유일하고, 연도 범위가 올바르다(처음 ≤ 마지막)', () => {
    expect(new Set(SCENE_PIECES.map((p) => p.id)).size).toBe(SCENE_PIECES.length);
    for (const p of SCENE_PIECES) if (p.years !== null && p.years[1] !== null) expect(p.years[0], p.id).toBeLessThanOrEqual(p.years[1]);
  });

  it('조각 수 예산(FH8): 표가 세는 조각 ≤ 상한 110 — 그린 것 / 안 그린 것을 센다', () => {
    const drawn = SCENE_PIECES.filter((p) => p.drawn).length;
    console.log(`[FH8] 조각 ${SCENE_PIECE_COUNT}(식구 22·틀 4 포함, 계획 87) — 그림 조각 ${SCENE_PIECES.length}: 그림 ${drawn} · 대신 그림 ${SCENE_PIECES.length - drawn}`);
    expect(SCENE_PIECE_COUNT).toBeLessThanOrEqual(MAX_PIECES);
  });
});

describe('색은 디자인 토큰뿐 (FH6 — 하드코딩 색 0)', () => {
  const COLOR_ATTR = /\s(?:fill|stroke)="([^"]*)"/g;
  const allMarkups: Array<[string, string]> = [
    ...Object.entries(PIECES),
    ['house-detached-h1(thatch)', detachedH1Markup('thatch')],
    ['house-detached-h1(tile)', detachedH1Markup('tile')],
    [INFANT_CARRIED, infantCarriedMarkup()],
    ...GROUPS.flatMap((g) => (['f', 'm'] as const).flatMap((sex) => ERAS.flatMap((e) => [0, 1, 2].map((v): [string, string] => [`fig-${g}-${sex}-${e}#${v}`, figureMarkup(g, sex, e, { v })])))),
  ];

  it('모든 조각의 fill·stroke는 none 이거나 var(--c-scene-<이름>, <라이트 값>)이고, 이름이 승인된 토큰(25개)이며 기본값이 라이트 값과 같다', () => {
    let n = 0;
    for (const [id, markup] of allMarkups) {
      for (const m of markup.matchAll(COLOR_ATTR)) {
        n++;
        if (m[1] === 'none' || /^url\(#[\w-]+\)$/.test(m[1])) continue; // 반복 무늬(<pattern>) 참조
        const t = /^var\(--c-scene-([a-z0-9]+),([^)]+\)?)\)$/.exec(m[1]);
        expect(t, `${id}: 토큰이 아닌 색 ${m[1]}`).not.toBeNull();
        const name = t![1] as keyof typeof SCENE_LIGHT;
        expect(SCENE_LIGHT[name], `${id}: 승인되지 않은 토큰 ${name}`).toBeDefined();
        expect(t![2], `${id}: ${name}의 기본값이 라이트 값과 다르다`).toBe(SCENE_LIGHT[name]);
      }
      expect(markup, `${id}: 그림 안 글자 0`).not.toMatch(/<text|<tspan|<image|<foreignObject|<script|style=|on[a-z]+=/i);
    }
    expect(n).toBeGreaterThan(1000);
  });

  it('tokens.css: --c-scene-* 25개(디자인 문서는 24개라 적었지만 시안의 팔레트는 25개다)가 라이트·다크 두 블록(미디어쿼리·data-theme)에 있고 라이트 값은 조각의 기본값과 같다. --c-era·--c-era-soft는 세 곳 + 강제 색상', () => {
    const names = Object.keys(SCENE_LIGHT);
    expect(names.length).toBe(25);
    const light = themeTokens(blocks, 'light');
    const dark = themeTokens(blocks, 'dark');
    for (const n of names) {
      expect(light[`--c-scene-${n}`], `라이트 --c-scene-${n}`).toBe(SCENE_LIGHT[n as keyof typeof SCENE_LIGHT]);
      expect(dark[`--c-scene-${n}`], `다크 --c-scene-${n}`).toBeTypeOf('string');
    }
    expect(Object.keys(blocks.darkAttr).filter((k) => k.startsWith('--c-scene-')).length).toBe(25);
    expect(Object.keys(blocks.darkMedia).filter((k) => k.startsWith('--c-scene-')).length).toBe(25);
    for (const n of names) expect(blocks.darkMedia[`--c-scene-${n}`], `두 다크 블록이 어긋난다: ${n}`).toBe(blocks.darkAttr[`--c-scene-${n}`]);
    expect(light['--c-era']).toBe('#6d2f4e');
    expect(light['--c-era-soft']).toBe('#f4e3ec');
    expect(dark['--c-era']).toBe('#f5a8d6');
    expect(dark['--c-era-soft']).toBe('#3a2434');
    expect(tokensCss).toMatch(/--c-era: CanvasText;/);
    expect(tokensCss).toMatch(/--c-era-soft: Canvas;/);
  });

  it('대비(WCAG): 시대 줄 표지 --c-era와 문장 --c-text가 줄 면(--c-surface·파인 면 --c-surface-2·강조 면 --c-era-soft) 위에서 4.5 이상, 연도 표 글자 --c-text가 --c-surface 위에서 4.5 이상 (라이트·다크)', () => {
    for (const theme of ['light', 'dark'] as const) {
      const t = themeTokens(blocks, theme);
      const ratio = (fg: string, bg: string): number => contrastRatio(parseHex(t[fg]), parseHex(t[bg]));
      for (const bg of ['--c-surface', '--c-surface-2', '--c-era-soft']) {
        expect(ratio('--c-era', bg), `${theme} --c-era on ${bg}`).toBeGreaterThanOrEqual(4.5);
        expect(ratio('--c-text', bg), `${theme} --c-text on ${bg}`).toBeGreaterThanOrEqual(4.5);
      }
    }
  });
});

describe('식구 조각 — 연령대 7 × 성별 2 × 시대 옷 3 × 옷 색 변형 3 (코드 분기)', () => {
  it('모든 조합이 마크업을 만들고, 같은 입력은 같은 마크업이며, 얼굴 조각이 없다(머리·옷으로 읽는다)', () => {
    let n = 0;
    for (const g of GROUPS)
      for (const sex of ['f', 'm'] as const)
        for (const e of ERAS)
          for (const v of [0, 1, 2]) {
            const a = figureMarkup(g, sex, e, { v });
            expect(a.length, `${g}-${sex}-${e}#${v}`).toBeGreaterThan(200);
            expect(a).toBe(figureMarkup(g, sex, e, { v }));
            expect(FAMILY_ART.piece(`fig-${g}-${sex}-${e}`, { v })).toBe(a);
            expect(FIGURE_ID.test(`fig-${g}-${sex}-${e}`)).toBe(true);
            n++;
          }
    expect(n).toBe(7 * 2 * 3 * 3);
  });
  it('옷 색 변형(v)은 같은 몸·다른 배색이다: v 0·1·2의 마크업이 서로 다르다(노인은 흰 옷 고정이라 같다)', () => {
    expect(new Set([0, 1, 2].map((v) => figureMarkup('young', 'f', 'e2', { v }))).size).toBe(3);
    expect(new Set([0, 1, 2].map((v) => figureMarkup('senior', 'f', 'e1', { v }))).size).toBe(1);
  });
  it('시대 옷: 장년·노년은 e2까지 한복(e1과 같은 마크업), 청년은 e1과 e2가 다르다', () => {
    expect(figureMarkup('senior', 'f', 'e2')).toBe(figureMarkup('senior', 'f', 'e1'));
    expect(figureMarkup('young', 'f', 'e2')).not.toBe(figureMarkup('young', 'f', 'e1'));
  });
  it('업힌 아기: 업은 사람의 키(H)가 바뀌면 같은 자리에 맞게 다시 그려진다', () => {
    expect(infantCarriedMarkup({ H: 94 })).not.toBe(infantCarriedMarkup({ H: 80 }));
    expect(FAMILY_ART.piece(INFANT_CARRIED, { H: 86, tok: 'cloth4' })).toContain('cloth4');
  });
  it('초가·기와: 같은 집의 지붕만 바뀐다', () => {
    expect(detachedH1Markup('thatch')).not.toBe(detachedH1Markup('tile'));
    expect(FAMILY_ART.piece('house-detached-h1', { roof: 'tile' })).toBe(detachedH1Markup('tile'));
  });
});

describe('크기 예산 (FH8·완료 기준 11): 조각 덩어리 gzip', () => {
  it('조각 덩어리(그림 조각 JSON + 식구 코드 소스) gzip ≤ 45KB, 조각 평균 gzip ≤ 0.45KB', async () => {
    const piecesGz = await gzipBytes(JSON.stringify(PIECES));
    const codeGz = await gzipBytes((await readText('../src/data/familyArt/figure.ts')) + (await readText('../src/data/familyArt/house.ts')) + (await readText('../src/data/familyArt/svg.ts')));
    console.log(`[FH8] 조각 JSON gzip ${piecesGz}B · 식구·집 코드 소스 gzip ${codeGz}B (조각 ${Object.keys(PIECES).length}개)`);
    expect(piecesGz + codeGz).toBeLessThanOrEqual(45 * 1024);
    expect(piecesGz / Object.keys(PIECES).length).toBeLessThanOrEqual(0.45 * 1024);
  });
});

describe('마크업 → React 노드 (CR-UI: dangerouslySetInnerHTML 없음)', () => {
  it('허용된 태그·속성만 통과한다: script·on* 속성·style·바깥 주소·허용 밖 태그는 버린다', () => {
    const nodes = parseSvgMarkup('<rect x="1" y="2" width="3" height="4" fill="var(--c-scene-sky,#dfe6ed)" onclick="x()" style="color:red"/><script>alert(1)</script><g><circle cx="1" cy="2" r="3" href="https://evil.example/x"/></g><use href="//evil/x"/><image href="a.png"/>', 'i');
    expect(nodes.map((n) => n.tag)).toEqual(['rect', 'g', 'use']);
    expect(nodes[0].props).toEqual({ x: '1', y: '2', width: '3', height: '4', fill: 'var(--c-scene-sky,#dfe6ed)' });
    expect(nodes[1].children[0].props).toEqual({ cx: '1', cy: '2', r: '3' });
    expect(nodes[2].props.href).toBeUndefined();
  });
  it('인스턴스 접두어: id·url(#…)·href(#…)가 함께 바뀌어 같은 화면의 두 그림이 서로 id를 덮지 않는다(교차 페이드)', () => {
    const m = '<defs><pattern id="s1-win" width="22" height="18" patternUnits="userSpaceOnUse"><rect x="5" y="5" width="12" height="8" fill="red"/></pattern></defs><rect x="0" y="0" width="9" height="9" fill="url(#s1-win)"/><use href="#s1-win"/>';
    const a = parseSvgMarkup(m, 'A');
    const b = parseSvgMarkup(m, 'B');
    expect(a[0].children[0].props.id).toBe('A-s1-win');
    expect(a[1].props.fill).toBe('url(#A-s1-win)');
    expect(a[2].props.href).toBe('#A-s1-win');
    expect(b[1].props.fill).toBe('url(#B-s1-win)');
    expect(a[0].children[0].props.patternUnits).toBe('userSpaceOnUse');
  });
  it('실제 조각은 한 개도 버려지지 않는다: 파싱한 노드의 도형 수 = 마크업의 도형 태그 수', () => {
    const count = (nodes: ReturnType<typeof parseSvgMarkup>): number => nodes.reduce((a, n) => a + 1 + count(n.children), 0);
    for (const [id, markup] of Object.entries(PIECES)) {
      const tags = (markup.match(/<(?:g|rect|circle|ellipse|path|line|defs|pattern)\b/g) ?? []).length;
      expect(count(parseSvgMarkup(markup, 'x')), id).toBe(tags);
    }
  });
});

describe('그림 조각의 색 class와 토큰 규칙 (FM5b R-549)', () => {
  it('색 토큰 이름 25개(sceneTables)가 그림 덩어리의 라이트 값 표(SCENE_LIGHT)와 이름·순서가 같다 — class 허용 목록과 CSS 규칙이 이 이름에서 나온다', () => {
    expect([...SCENE_TOKEN_NAMES]).toEqual(Object.keys(SCENE_LIGHT));
    expect(SCENE_TOKEN_NAMES.length).toBe(25);
    expect(ALLOWED_CLASSES.size).toBe(25 * 6);
    for (const c of ['e-sky', 'es-ink', 'et-cloth3', 'eb-cloth1', 'eh-hair', 'ek-roof2']) expect(ALLOWED_CLASSES.has(c), c).toBe(true);
    for (const c of ['e-nope', 'ex-sky', 'sky', 'btn', 'scene__svg', 'e-sky e-ink']) expect(ALLOWED_CLASSES.has(c), c).toBe(false);
  });

  it('family.css의 토큰 규칙 블록이 25개 × 6가지(채움·선·윗옷·아래·머리·모자) 전부 있고 값은 --c-scene-* 토큰이다 — 하드코딩 색(#rrggbb) 0', async () => {
    const css = await readText('../src/styles/family.css');
    const expected = SCENE_TOKEN_NAMES.map(
      (k) => `.e-${k}{fill:var(--c-scene-${k})}.es-${k}{stroke:var(--c-scene-${k})}.et-${k}{--t:var(--c-scene-${k})}.eb-${k}{--b:var(--c-scene-${k})}.eh-${k}{--h:var(--c-scene-${k})}.ek-${k}{--k:var(--c-scene-${k})}`,
    ).join('\n');
    expect(css, '토큰 규칙 블록이 SCENE_TOKEN_NAMES에서 만든 글과 다르다 — 손으로 고치지 않는다').toContain(expected);
    // 규칙의 class 이름은 파서의 허용 목록과 정확히 같은 집합이다(허용 목록에 없는 규칙도, 규칙 없는 허용 이름도 없다)
    const ruleNames = new Set([...css.matchAll(/\.(e|es|et|eb|eh|ek)-([a-z0-9]+)\{/g)].map((m) => `${m[1]}-${m[2]}`));
    expect([...ruleNames].sort()).toEqual([...ALLOWED_CLASSES].sort());
  });

  it('톤 A 「바랜 인쇄물」: 10년대별 세피아 필터가 1940 → 1990으로 옅어지고(0.62 → 0.05) 2000년대는 채도·대비만, 2010년대~는 규칙이 없다. 다크는 약하게(1980년대까지) — 시스템 다크(media)와 수동 다크(data-theme) 둘 다 (era-window.md 2절)', async () => {
    const css = await readText('../src/styles/family.css');
    const filterOf = (decade: number, scope = ''): string | undefined => new RegExp(`${scope}\\.era\\[data-dec='${decade}'\\] svg \\{ filter: ([^;]+); \\}`).exec(css)?.[1];
    const sepia = (f: string | undefined): number => Number(/sepia\(([\d.]+)\)/.exec(f ?? '')?.[1] ?? 0);
    const light = [1940, 1950, 1960, 1970, 1980, 1990].map((d) => sepia(filterOf(d)));
    expect(light).toEqual([0.62, 0.55, 0.42, 0.3, 0.18, 0.05]);
    expect(filterOf(2000)).toBe('saturate(1.04) contrast(1.02)');
    expect(css).not.toMatch(/\.era\[data-dec='20(10|20)'\]/);
    const dark = [1940, 1950, 1960, 1970, 1980].map((d) => sepia(filterOf(d, ":root\\[data-theme='dark'\\] ")));
    expect(dark).toEqual([0.3, 0.26, 0.2, 0.14, 0.08]);
    for (let i = 0; i < dark.length; i++) expect(dark[i], '다크 필터는 라이트보다 약하다').toBeLessThan(light[i]);
    const media = css.slice(css.indexOf('@media (prefers-color-scheme: dark)'));
    expect(media).toContain(":root:not([data-theme='light']) .era[data-dec='1940'] svg { filter: sepia(.3) saturate(.75); }");
    // 망점은 그림 안의 한 겹(불투명도가 10년대별로 줄어 2000년대부터 0)이라 CSS 필터에는 없다 — 필터에 blur·url()·drop-shadow가 없다
    expect(css.match(/\.era\[data-dec='\d+'\] svg \{ filter: [^}]*\}/g)!.join('')).not.toMatch(/blur|url\(|drop-shadow/);
  });

  it('파서: class는 허용 목록 이름만 통과한다 — 목록 밖 이름(스타일 훅·임의 class)은 버리고, `<style>` 태그는 허용 목록 밖이라 안쪽 규칙과 함께 버린다', () => {
    const nodes = parseSvgMarkup(
      '<style>.e-sky{fill:red}body{display:none}</style><rect class="e-sky nope es-ink" x="1" y="2" width="3" height="4"/><rect class="evil" x="0" y="0" width="1" height="1"/><use href="#ps" class="et-cloth3 eb-cloth1 eh-hair" x="1" y="2" width="3" height="4"/>',
      'i',
    );
    expect(nodes.map((n) => n.tag)).toEqual(['rect', 'rect', 'use']);
    expect(nodes[0].props.className).toBe('e-sky es-ink');
    expect(nodes[1].props.className).toBeUndefined();
    expect(nodes[2].props.className).toBe('et-cloth3 eb-cloth1 eh-hair');
    expect(nodes[2].props.href).toBe('#i-ps');
  });

  it('파서: 사람 심볼에 필요한 속성만 더 통과한다 — preserveAspectRatio는 정해진 값, overflow는 visible뿐, style·on* 은 그대로 막힌다', () => {
    const nodes = parseSvgMarkup('<symbol id="ps" viewBox="0 0 30 100" preserveAspectRatio="none" overflow="visible"><rect x="0" y="23" width="30" height="40" fill="var(--t,#f7f2e8)"/></symbol><symbol id="b" preserveAspectRatio="javascript:x" overflow="hidden" onload="x()" style="a:b"></symbol>', 'i');
    expect(nodes[0].tag).toBe('symbol');
    expect(nodes[0].props).toEqual({ id: 'i-ps', viewBox: '0 0 30 100', preserveAspectRatio: 'none', overflow: 'visible' });
    expect(nodes[0].children[0].props.fill).toBe('var(--t,#f7f2e8)');
    expect(nodes[1].props).toEqual({ id: 'i-b' });
  });
});

describe('장면 규칙 상수 SCENE_RULES (R-545, CR-DATA)', () => {
  it('코어에 박았던 설계값(초가 조건·전봇대 시골 연도·마당 반려 연도·집 크기·소품 개수)이 표에 있고 모두 근거 칸이 「설계값」이다', () => {
    for (const [name, rule] of Object.entries(SCENE_RULES)) expect((rule as { basis: string }).basis, name).toBe('설계값');
    expect(SCENE_RULES.thatch).toMatchObject({ lastYear: 1975, maxWealth: 2, regions: ['rural', 'coast'] });
    expect(SCENE_RULES.poleRuralFrom.year).toBe(1970);
    expect(SCENE_RULES.yardPetBefore.year).toBe(1990);
    expect(SCENE_RULES.houseScale).toMatchObject({ shack: 0.86, low: 0.86, mid: 0.92, high: 1, crowded: 0.86, crowdedFrom: 7 });
    expect(SCENE_RULES.propCount).toMatchObject({ min: 2, spread: 3 });
  });
  it('코어(scene.ts)에는 이 숫자들이 직접 남아 있지 않다: 집 크기 0.86·삼항의 0.92, 연도 1975·1970·1990 리터럴 없음(식구 몸 배율 0.92는 배치 규칙이라 별개)', async () => {
    const src = (await readText('../src/core/scene.ts')).replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\s)\/\/.*$/gm, '$1');
    for (const lit of ['0.86', '? 0.92', '1975', '1970', '1990']) expect(src, lit).not.toContain(lit);
  });
});
