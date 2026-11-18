import { describe, expect, it } from 'vitest';

/**
 * `src/styles/credits.css` 정적 검사 (SPEC-022 EC1 8항 · 완료 기준 18 — 새 정적 검사 둘). 이 파일은 버튼을 누른 뒤에 받는 **지연 CSS 덩어리**라, 한 번 받으면 문서에 남아 회고와 다음 판 화면에도 걸린다.
 *  ① 새 색·글꼴·굵기를 만들지 않는다(토큰만) · 불투명도·전환·애니메이션이 없다(이 화면에는 페이드가 없다).
 *  ② 모든 선택자가 `.credits`로 시작하고, 이 파일이 정의하는 클래스 이름은 `credits`·`credits-*`뿐이다 — 앱의 전역 클래스와 이름이 겹칠 수 없다(전역 단추 클래스 `.btn`은 `.credits … .btn`처럼 쓰기만 한다).
 */

const fsSpec = 'node:fs';
const fs = (await import(/* @vite-ignore */ fsSpec)) as { readFileSync(path: URL, encoding: 'utf-8'): string; readdirSync(path: URL): string[] };
const read = (p: string): string => fs.readFileSync(new URL(p, import.meta.url), 'utf-8');

const raw = read('../src/styles/credits.css');
const css = raw.replace(/\/\*[^]*?\*\//g, '');

/** 규칙의 선택자 목록(@media·@container·@supports 안의 규칙 포함, @-규칙 머리는 제외) */
function selectors(source: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let buf = '';
  const atRule: boolean[] = [];
  for (const ch of source) {
    if (ch === '{') {
      const head = buf.trim();
      if (head.startsWith('@')) atRule.push(true);
      else {
        atRule.push(false);
        out.push(head);
      }
      buf = '';
      depth++;
    } else if (ch === '}') {
      depth--;
      atRule.pop();
      buf = '';
    } else if (ch === ';' && depth >= 0) {
      buf = '';
    } else buf += ch;
  }
  return out.flatMap((s) => s.split(',').map((x) => x.trim())).filter((s) => s !== '');
}

const sels = selectors(css);

describe('credits.css 정적 검사 (SPEC-022 EC1 8항)', () => {
  it('공허 통과 방지: 규칙이 실제로 읽힌다', () => {
    expect(sels.length).toBeGreaterThan(40);
    expect(sels).toContain('.credits .credits-bar');
  });

  it('새 색·글꼴·굵기가 없다: `#`색 · rgb( · hsl( · 직접 font-family · 400/700 밖 굵기 · 숫자 굵기 직접 지정 0 (강제 색상의 시스템 색 낱말은 허용)', () => {
    expect(css).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(css).not.toMatch(/\b(?:rgb|rgba|hsl|hsla)\(/);
    expect(css).not.toMatch(/font-family\s*:/);
    for (const m of css.matchAll(/font-weight\s*:\s*([^;}]+)/g)) expect(m[1].trim(), 'font-weight').toMatch(/^var\(--fw-(?:regular|bold)\)$/);
    expect(css).not.toMatch(/\b(?:red|green|blue|orange|gold|brass)\b/);
    // 색 값은 토큰 변수나 시스템 색뿐이다
    for (const m of css.matchAll(/(?:^|[;{\s])(?:color|background(?:-color)?|border(?:-[a-z]+)?-color)\s*:\s*([^;}]+)/g)) expect(m[1].trim(), 'color').toMatch(/^(?:var\(--c-[a-z0-9-]+\)|CanvasText|transparent|currentColor)$/);
  });

  it('불투명도·전환·애니메이션이 없다 — 이 화면의 상태 바뀜(가림 펼침·띠의 고정/풀림)은 즉시 바뀐다', () => {
    expect(css).not.toMatch(/\bopacity\s*:/);
    expect(css).not.toMatch(/\btransition\s*:|\banimation\s*:|@keyframes/);
  });

  it('모든 선택자가 `.credits`로 시작한다(전역에 걸리는 규칙 0)', () => {
    const bad = sels.filter((s) => !/^\.credits(?:\[[^\]]+\])?(?:\s|$)/.test(s));
    expect(bad, '`.credits` 밖에 걸리는 선택자').toEqual([]);
  });

  it('이 파일이 쓰는 클래스 이름은 `credits`·`credits-*`와 전역 단추 `btn`뿐이고, `btn`은 `.credits` 아래 자손으로만 쓴다', () => {
    const names = new Set([...css.matchAll(/\.([a-zA-Z_][\w-]*)/g)].filter((m) => !/\d$/.test(m[1]) || true).map((m) => m[1]));
    // 속성 값·숫자(`0.55`)에서 잡힌 가짜 이름 제거: 선택자에서만 다시 뽑는다
    const inSelectors = new Set(sels.flatMap((s) => [...s.matchAll(/\.([a-zA-Z_][\w-]*)/g)].map((m) => m[1])));
    expect(names.size).toBeGreaterThan(0);
    for (const n of inSelectors) expect(n === 'credits' || n.startsWith('credits-') || n === 'btn', `클래스 ${n}`).toBe(true);
    for (const s of sels) if (/\.btn\b/.test(s)) expect(s.startsWith('.credits '), s).toBe(true);
    // 단수 `.credit`은 첫 화면 푸터가 쓰고 있어 쓰지 않는다
    expect(inSelectors.has('credit')).toBe(false);
  });

  it('이 파일이 정의하는 클래스 이름이 다른 CSS 파일의 클래스와 같지 않다(전역 클래스 이름 충돌 0)', () => {
    const dir = new URL('../src/styles/', import.meta.url);
    const mine = new Set(sels.flatMap((s) => [...s.matchAll(/\.([a-zA-Z_][\w-]*)/g)].map((m) => m[1])).filter((n) => n !== 'btn'));
    const others = new Set<string>();
    for (const f of fs.readdirSync(dir)) {
      if (!f.endsWith('.css') || f === 'credits.css') continue;
      const text = fs.readFileSync(new URL(f, dir), 'utf-8').replace(/\/\*[^]*?\*\//g, '');
      for (const s of selectors(text)) for (const m of s.matchAll(/\.([a-zA-Z_][\w-]*)/g)) others.add(m[1]);
    }
    const mainCss = read('../src/styles.css').replace(/\/\*[^]*?\*\//g, '');
    for (const s of selectors(mainCss)) for (const m of s.matchAll(/\.([a-zA-Z_][\w-]*)/g)) others.add(m[1]);
    expect(others.size).toBeGreaterThan(100); // 공허 통과 방지
    expect([...mine].filter((n) => others.has(n))).toEqual([]);
  });

  it('`credits.css`는 지연 덩어리 안에서만 import된다 — `main.tsx`·다른 CSS가 가져오지 않는다', () => {
    const main = read('../src/main.tsx');
    expect(main).not.toContain('credits.css');
    const importers = ['../src/credits/CreditsScreen.tsx'].filter((p) => read(p).includes("'../styles/credits.css'"));
    expect(importers).toEqual(['../src/credits/CreditsScreen.tsx']);
    for (const f of fs.readdirSync(new URL('../src/styles/', import.meta.url))) if (f.endsWith('.css')) expect(read(`../src/styles/${f}`)).not.toMatch(/@import[^;]*credits\.css/);
  });
});
