import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { TitleScreen } from '../src/screens/TitleScreen';

/**
 * Noto Sans KR 정적 조각(plan B)의 잠금 (SPEC-004 GS11 · design-system.md 17-11-3·17-11-4 ⑤).
 * 조각 파일은 `node scripts/design/buildGm3Fonts.mjs`가 만든다 — 이 시험이 ① 게임 글자가 조각 밖으로 새지 않는지(글자가 더해지면 실패 = 조각 재생성 신호)
 * ② 첫 화면 글자가 첫 조각(s0)에 있는지 ③ CSS의 face 수·preload·fallback 수치 ④ 파일 바이트가 17-11-3 표의 ±10% 안인지 지킨다.
 */

const fsSpec = 'node:fs';
const fs = (await import(/* @vite-ignore */ fsSpec)) as {
  readFileSync(path: URL, encoding: 'utf-8'): string;
  statSync(path: URL): { size: number };
  existsSync(path: URL): boolean;
  readdirSync(path: URL, opts: { withFileTypes: true }): Array<{ name: string; isDirectory(): boolean }>;
};
const at = (relative: string): URL => new URL(relative, import.meta.url);
const read = (relative: string): string => fs.readFileSync(at(relative), 'utf-8');
const fontsCss = read('../src/styles/fonts.css');
const indexHtml = read('../index.html');
const tokensCss = read('../src/styles/tokens.css');

type Slice = 's0' | 's0b' | 's1' | 's2' | 's3';
const SLICES: readonly Slice[] = ['s0', 's0b', 's1', 's2', 's3'];

interface Face {
  weight: number;
  slice: Slice;
  ranges: Array<[number, number]>;
  src: string;
}

function parseRanges(list: string): Array<[number, number]> {
  return list.split(',').map((part) => {
    const m = /^U\+([0-9A-Fa-f]+)(?:-([0-9A-Fa-f]+))?$/.exec(part.trim());
    expect(m, `unicode-range 항목 ${part}`).not.toBeNull();
    const from = parseInt(m![1], 16);
    return [from, m![2] === undefined ? from : parseInt(m![2], 16)] as [number, number];
  });
}

const faces: Face[] = [...fontsCss.matchAll(/@font-face \{ font-family: 'Noto Sans KR'; ([^}]*)\}/g)].map((m) => {
  const body = m[1];
  const weight = Number(/font-weight: (\d+)/.exec(body)![1]);
  const src = /url\('\.\.\/assets\/fonts\/(NotoSansKR-\d+\.(s0b?|s1|s2|s3)\.woff2)'\)/.exec(body)!;
  return { weight, slice: src[2] as Slice, ranges: parseRanges(/unicode-range: ([^;]+);/.exec(body)![1]), src: src[1] };
});

const covers = (slice: readonly Slice[], weight: number, cp: number): boolean =>
  faces.some((f) => f.weight === weight && slice.includes(f.slice) && f.ranges.some(([a, b]) => cp >= a && cp <= b));

/** 글꼴 만들기 스크립트(`buildGm3Fonts.mjs`)의 `keep` 규칙 그대로: 공백·제어·변이 선택자·사용자 영역은 글자로 세지 않는다 */
const keep = (cp: number): boolean => cp > 0x20 && cp !== 0x7f && !(cp >= 0xfe00 && cp <= 0xfe0f) && !(cp >= 0xe000 && cp <= 0xf8ff);
const charsOf = (text: string, into = new Set<number>()): Set<number> => {
  for (const ch of text) {
    const cp = ch.codePointAt(0)!;
    if (keep(cp)) into.add(cp);
  }
  return into;
};
const hex = (cp: number): string => `U+${cp.toString(16).toUpperCase().padStart(4, '0')}(${String.fromCodePoint(cp)})`;

function walk(dir: string, exts: readonly string[], acc: string[] = []): string[] {
  for (const e of fs.readdirSync(at(dir), { withFileTypes: true })) {
    const p = `${dir}${e.name}`;
    if (e.isDirectory()) walk(`${p}/`, exts, acc);
    else if (exts.some((x) => p.endsWith(x))) acc.push(p);
  }
  return acc;
}

describe('Noto Sans KR 조각 CSS (17-11-3·17-11-4 ③)', () => {
  it('face 10개 = 굵기 400·700 × 조각 s0·s0b·s1·s2·s3, 모두 font-display: swap, 파일은 저장소 안(외부 주소 0)', () => {
    expect(faces).toHaveLength(10);
    for (const weight of [400, 700]) expect(faces.filter((f) => f.weight === weight).map((f) => f.slice).sort()).toEqual([...SLICES].sort());
    const blocks = fontsCss.match(/@font-face \{[^}]*\}/g)!;
    for (const b of blocks.filter((x) => x.includes("'Noto Sans KR';"))) expect(b).toContain('font-display: swap');
    expect(fontsCss).not.toMatch(/https?:|\/\/[a-z]/i);
    for (const f of faces) expect(fs.existsSync(at(`../src/assets/fonts/${f.src}`)), f.src).toBe(true);
  });

  it("대체 글꼴 'Noto Sans KR Fallback' = 맑은 고딕에 size-adjust 92.12% · ascent 116.00% · descent 28.80% · line-gap 0.00% (바뀜 흔들림 방지)", () => {
    const m = /@font-face \{ font-family: 'Noto Sans KR Fallback'; src: local\('Malgun Gothic'\), local\('맑은 고딕'\); size-adjust: ([\d.]+%); ascent-override: ([\d.]+%); descent-override: ([\d.]+%); line-gap-override: ([\d.]+%); \}/.exec(fontsCss);
    expect(m, 'fallback face').not.toBeNull();
    expect(m!.slice(1)).toEqual(['92.12%', '116.00%', '28.80%', '0.00%']);
  });

  it("--font-sans는 'Noto Sans KR', 'Noto Sans KR Fallback'으로 시작하고 시스템 글꼴이 뒤를 받친다", () => {
    const m = /--font-sans:\s*([^;]+);/.exec(tokensCss);
    expect(m, '--font-sans').not.toBeNull();
    expect(m![1].startsWith("'Noto Sans KR', 'Noto Sans KR Fallback', ")).toBe(true);
    expect(m![1]).toMatch(/'Malgun Gothic'/);
    expect(m![1]).toMatch(/sans-serif$/);
  });

  it('index.html에는 글꼴 미리 받기(preload)·prefetch가 없다 — WebKit은 같은 출처 글꼴을 no-cors로 다시 받아 미리 받은 CORS 요청과 어긋나 s0 조각 둘을 두 번 내려받는다 (MG8 중복 요청 없음)', () => {
    expect(indexHtml).not.toMatch(/<link[^>]+rel="(?:preload|prefetch|prerender|modulepreload)"/);
    expect(indexHtml).not.toMatch(/\.woff2?["']/);
  });

  it('굵기는 400·700만 쓴다: 소스 CSS에 font-weight 500·600·800·900 선언이 없다 (없는 굵기는 브라우저가 합성해 한글이 번진다)', () => {
    const css = walk('../src/styles/', ['.css']).map((f) => read(f)).join('\n');
    expect(css).not.toMatch(/font-weight:\s*(?:500|600|800|900)\b/);
    expect(css).toMatch(/font-weight:/); // 공허 통과 방지
  });
});

describe('조각 파일 바이트 (17-11-3 표 ±10% · 마스터 결정: 정적 400+700 조각)', () => {
  const size = (f: Face): number => fs.statSync(at(`../src/assets/fonts/${f.src}`)).size;
  const sum = (slices: readonly Slice[]): number => faces.filter((f) => slices.includes(f.slice)).reduce((n, f) => n + size(f), 0);
  const within = (actual: number, expected: number): boolean => Math.abs(actual - expected) <= expected * 0.1;

  it('첫 화면이 처음 받는 s0 400+700 ≈ 77,784B (GM4 2차: 숨은 슬라이드·하단 글자까지 처음 그려지는 글자를 s0에 모았다 — 1차는 s0 57,780B + s0b 38,000B를 함께 받았다)', () => {
    expect(sum(['s0']), 's0').toSatisfy((n: number) => within(n, 77_784));
  });

  it('s3을 뺀 전체(s0+s0b+s1+s2) ≈ 204,760B, s3 꼬리 ≈ 211,600B', () => {
    expect(sum(['s0', 's0b', 's1', 's2']), 's0+s0b+s1+s2').toSatisfy((n: number) => within(n, 204_760));
    expect(sum(['s3']), 's3').toSatisfy((n: number) => within(n, 211_600));
  });

  it('라이선스 OFL.txt가 파일 옆에 있다 (SIL OFL 1.1)', () => {
    const ofl = read('../src/assets/fonts/OFL.txt');
    expect(ofl).toMatch(/SIL OPEN FONT LICENSE Version 1\.1/i);
  });
});

describe('글자 덮기 (17-11-4 ⑤): 게임 글자는 모두 s0·s0b·s1·s2 안에 있다 — 없는 글자가 생기면 조각을 다시 만든다', () => {
  const GAME_SLICES: readonly Slice[] = ['s0', 's0b', 's1', 's2'];
  const files = [...walk('../src/', ['.ts', '.tsx', '.json', '.css', '.html']), '../index.html'];

  it('src/** 와 index.html의 모든 글자가 두 굵기 모두 s0∪s0b∪s1∪s2의 unicode-range 안에 있다', () => {
    expect(files.length, '공허 통과 방지').toBeGreaterThan(100);
    const missing = new Map<string, string>();
    for (const file of files) {
      for (const cp of charsOf(read(file))) {
        for (const weight of [400, 700]) if (!covers(GAME_SLICES, weight, cp) && !missing.has(hex(cp))) missing.set(hex(cp), file);
      }
    }
    expect([...missing].map(([c, f]) => `${c} ← ${f}`), '조각 밖 글자: node scripts/design/buildGm3Fonts.mjs 로 다시 만든다').toEqual([]);
  });

  it('s3(KS X 1001 꼬리)는 게임 글자를 하나도 담지 않는다 — s3 파일은 입력란 같은 사용자 글자용이고 첫 화면·게임 화면에서 받지 않는다', () => {
    const s3 = faces.filter((f) => f.slice === 's3');
    let overlap = 0;
    for (const file of files) for (const cp of charsOf(read(file))) if (s3.some((f) => f.ranges.some(([a, b]) => cp >= a && cp <= b)) && !covers(GAME_SLICES, 400, cp)) overlap++;
    expect(overlap).toBe(0);
  });

  it('첫 화면의 눈에 보이는 핵심 글자(제목·세대 목록·설정·하단 띠)는 첫 조각 s0(400·700) 안에 있다', () => {
    const html = renderToStaticMarkup(<TitleScreen generation="random" lifeLength="short30" onSelectGeneration={() => {}} onSelectLifeLength={() => {}} onBegin={() => {}} />);
    const first = html.slice(html.indexOf('<main class="title__main">'), html.indexOf('<aside class="title__side">')); // 왼쪽 열: 설명·세대 목록·태어나는 시도·인생 길이
    const bar = html.slice(html.indexOf('data-testid="bottom-bar"'));
    const text = (markup: string): string => markup.replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&#x27;/g, "'").replace(/&quot;/g, '"');
    const chars = charsOf(text(first) + text(bar.slice(0, bar.indexOf('</div>') + 6)));
    expect(chars.size, '공허 통과 방지').toBeGreaterThan(100);
    const outside: string[] = [];
    for (const cp of chars) for (const weight of [400, 700]) if (!covers(['s0'], weight, cp) && !outside.includes(hex(cp))) outside.push(hex(cp));
    expect(outside, 's0 밖 글자').toEqual([]);
  });
});
