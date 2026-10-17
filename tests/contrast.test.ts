import { describe, expect, it } from 'vitest';
import { PAIRS, checkTheme, docCssPairs, docTagPair, formatReport, readOpacityRules, readThemeBlocks, stampPairs, themeTokens } from '../scripts/checkContrastLib';

/**
 * 장식 포함 대비 전수 (SPEC-003 DS3, QM3-5, QA-003-M3 M3-O02). DS3의 대비 기준은 **눈에 보이는 모든 글자와 UI 도형**에 적용된다 — 장식(`aria-hidden`)도 면제하지 않는다.
 * 글자(도장 「접수」 14px 굵게 포함) ≥ 4.5:1, UI 도형(도장 테두리) ≥ 3:1. 불투명도(`opacity`)로 합성되는 색은 **합성 뒤의 실제 렌더 색**으로 잰다 — 토큰 색만으로 재면 안 된다
 * (장식 도장은 `opacity: 0.85`를 걸어 라이트에서 3.72:1이었다). 렌더 쪽 검증은 e2e/m3-colors.spec.ts가 한다(실제 계산된 색, 라이트·다크·강제 색상).
 * 이 파일은 `scripts/checkContrast.ts`가 쓰는 쌍(`scripts/checkContrastLib.ts#docCssPairs`)이 **화면 CSS(src/styles/doc.css)의 불투명도를 직접 읽어** 만들어지는지와 그 결과를 본다.
 */

/** vitest는 CSS의 ?raw 가져오기를 빈 문자열로 돌려주므로 파일 시스템으로 읽는다(tests/designAssets.test.ts와 같은 방법) */
async function readText(relative: string): Promise<string> {
  const spec = 'node:fs';
  const fs = (await import(/* @vite-ignore */ spec)) as { readFileSync(path: URL, encoding: 'utf-8'): string };
  return fs.readFileSync(new URL(relative, import.meta.url), 'utf-8');
}
const tokensCss = await readText('../src/styles/tokens.css');
const docCss = await readText('../src/styles/doc.css');
const titleCss = await readText('../src/styles/title.css');
const dashCss = await readText('../src/styles/dash.css');
const blocks = readThemeBlocks(tokensCss);

/** 규칙 하나의 본문 (주석을 뺀 CSS에서) */
function ruleBody(css: string, selector: string): string {
  const stripped = css.replace(/\/\*[^]*?\*\//g, '');
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const m = new RegExp(`(?:^|\\})\\s*${escaped}\\s*\\{([^}]*)\\}`).exec(stripped);
  expect(m, `규칙 ${selector}`).not.toBeNull();
  return m![1];
}

describe('readOpacityRules: CSS 글에서 불투명도 규칙을 읽는다 (합성 CSS)', () => {
  it('선택자·불투명도·색 토큰을 읽고, background-color·border-color의 color를 색으로 착각하지 않으며, 미디어 블록 안 규칙도 읽는다', () => {
    const css = `
      /* .gone { opacity: 0.1; } 주석 안은 읽지 않는다 */
      .a { color: var(--c-accent); opacity: 0.85; border: 1px solid currentColor; }
      .b { background-color: var(--c-brand); opacity: .5 }
      .c { border-color: var(--c-border); color: red; }
      @media (min-width: 640px) {
        .d, .e { opacity: 0.92; color: var(--c-text); }
      }
    `;
    expect(readOpacityRules(css)).toEqual([
      { selector: '.a', opacity: 0.85, colorToken: '--c-accent' },
      { selector: '.b', opacity: 0.5, colorToken: null },
      { selector: '.d, .e', opacity: 0.92, colorToken: '--c-text' },
    ]);
  });
});

describe('장식 도장 「접수」 (QM3-5): 글자·테두리가 전수 쌍에 든다', () => {
  it('`.stamp` 규칙: 색은 --c-accent(테두리는 currentColor)이고 불투명도를 걸지 않는다 — 합성으로 대비를 잃지 않는다', () => {
    const body = ruleBody(docCss, '.stamp');
    expect(body).toMatch(/color:\s*var\(--c-accent\)/);
    expect(body).toMatch(/border:\s*2\.5px solid currentColor/);
    expect(body, '불투명도 규칙 없음').not.toMatch(/opacity\s*:/);
    expect(readOpacityRules(docCss).map((r) => r.selector)).not.toContain('.stamp');
  });

  for (const theme of ['light', 'dark'] as const) {
    it(`${theme}: 도장 글자 ≥ 4.5:1, 바깥·안쪽 테두리 ≥ 3:1 (불투명도 반영 — 면제 목록 없음)`, () => {
      const results = checkTheme(themeTokens(blocks, theme), theme, docCssPairs(docCss));
      const stamp = results.filter((r) => r.pair.use.startsWith('장식 도장'));
      expect(stamp, '글자 1 + 테두리 2').toHaveLength(3);
      expect(stamp.map((r) => r.pair.kind).sort()).toEqual(['text', 'ui', 'ui']);
      expect(stamp.find((r) => r.pair.kind === 'text')!.pair.min).toBe(4.5);
      for (const r of stamp) expect(r.pass, `${r.pair.use} ${r.ratio.toFixed(2)}:1 (기준 ${r.pair.min}:1)`).toBe(true);
    });
  }

  it('이전 구현(opacity 0.85)에서는 라이트 도장 글자가 3.72:1이라 실패한다 — 쌍이 불투명도를 실제로 반영한다 (다크는 6.5:1이라 통과)', () => {
    const light = checkTheme(themeTokens(blocks, 'light'), 'light', stampPairs(0.85));
    const dark = checkTheme(themeTokens(blocks, 'dark'), 'dark', stampPairs(0.85));
    const lightText = light.find((r) => r.pair.kind === 'text')!;
    expect(lightText.ratio).toBeCloseTo(3.72, 1);
    expect(lightText.pass).toBe(false);
    expect(dark.find((r) => r.pair.kind === 'text')!.pass).toBe(true);
    // 불투명도 1이면 같은 쌍이 통과한다(대조군)
    expect(checkTheme(themeTokens(blocks, 'light'), 'light', stampPairs(1)).every((r) => r.pass)).toBe(true);
  });

  it('`.doc__tag`(띠 오른쪽 표기, 불투명도 0.92)도 합성 뒤 4.5:1 이상이다 — 라이트·다크', () => {
    const tag = readOpacityRules(docCss).find((r) => r.selector === '.doc__tag');
    expect(tag?.opacity).toBe(0.92);
    for (const theme of ['light', 'dark'] as const) {
      const [r] = checkTheme(themeTokens(blocks, theme), theme, [docTagPair(tag!.opacity)]);
      expect(r.pass, `${theme} ${r.ratio.toFixed(2)}:1`).toBe(true);
    }
  });

  it('docCssPairs는 doc.css에서 읽은 불투명도로 쌍을 만든다: 도장(규칙에 불투명도가 없으면 1)·띠 표기(0.92). 토큰 쌍(PAIRS)은 그대로 있고 이 쌍들이 더해진다', () => {
    const pairs = docCssPairs(docCss);
    expect(pairs).toHaveLength(4);
    expect(pairs.slice(0, 3).every((p) => p.alpha === undefined), '도장은 합성 없음').toBe(true);
    expect(pairs[3].alpha).toBe(0.92);
    expect(PAIRS.length + pairs.length).toBeGreaterThanOrEqual(80);
  });

  it('doc.css의 모든 opacity 규칙은 대비 쌍이 덮거나, 글자·도형이 아닌 가림막임을 이유와 함께 올린 것뿐이다 — 새 불투명도 규칙이 조용히 대비를 잃지 못한다', () => {
    const COVERED = new Set(['.doc__tag']); // docCssPairs의 쌍
    const NOT_TEXT = new Map([['.reel.is-fast::after', '회전 중 줄무늬 가림막 — 글자·도형이 아니라 움직임 흐림 효과(결과 칸의 글자는 이 규칙 밖)']]);
    const rules = readOpacityRules(docCss);
    expect(rules.length).toBeGreaterThan(0);
    for (const r of rules) expect(COVERED.has(r.selector) || NOT_TEXT.has(r.selector), `${r.selector}의 opacity ${r.opacity} — 대비 쌍을 더하거나 NOT_TEXT에 이유와 함께 올린다`).toBe(true);
  });
});

describe('title.css·dash.css의 opacity 규칙 잠금 (D-26, designer 제안 — 대비 보고서 범위 밖의 두 파일)', () => {
  // scripts/checkContrast.ts는 tokens.css + doc.css만 읽는다. 나머지 두 화면 CSS에 새 불투명도 규칙이 조용히 들어와 글자 대비를 잃지 못하게, 지금 있는 규칙을 이유와 함께 모두 적는다.
  // 규칙을 더하면 이 표에 이유를 올려야 하고(글자·도형이 아닌 것인지, 과도 상태인지), 지우면 표에서도 지워야 한다(표가 현재 CSS와 정확히 같다).
  const ALLOWED = {
    'title.css': new Map<string, string>([
      ["`.btn[aria-disabled='true'], .btn:disabled`|0.55", '0.4초 입력 가드(GuardedButton)의 과도 상태 — 읽으라고 둔 글자가 아니라 더블탭을 삼키는 흐림. 지속 비활성은 data-unavailable로 불투명도 없이 그린다(R-337)'],
      ["`.btn[data-unavailable='true']`|1", '지속 비활성의 불투명도를 1로 되돌리는 규칙 — 옅은 글자 --c-text-3(라이트 5.78:1·다크 5.96:1)과 점선 테두리가 대비를 지킨다(R-337, 렌더 대비는 e2e/m4-colors.spec.ts)'],
      ['`.radio-card input`|0', '라디오 카드의 실제 input을 시각적으로 숨긴다(글자 없음, 카드 label이 모양을 그린다)'],
      ['`.radio-card__mark .icon`|0', '선택 표시 체크 아이콘 숨김(선택되지 않은 카드) — 글자가 아니다'],
      ['`.radio-card.is-selected .radio-card__mark .icon`|1', '선택된 카드의 체크 아이콘을 보인다(불투명도 1)'],
      ['`.slide`|0', '캐러셀의 보이지 않는 슬라이드(visibility: hidden과 함께) — 전환 흐림'],
      ['`.slide.is-active`|1', '캐러셀의 보이는 슬라이드(불투명도 1)'],
    ]),
    'dash.css': new Map<string, string>([["`.choice[aria-disabled='true']`|0.55", '선택지 카드의 0.4초 입력 가드 — 과도 상태(지속 비활성이 아니다)']]),
  } as const;
  const key = (r: { selector: string; opacity: number }) => `\`${r.selector}\`|${r.opacity}`;

  for (const [file, css] of [
    ['title.css', titleCss],
    ['dash.css', dashCss],
  ] as const) {
    it(`${file}의 opacity 규칙은 표에 이유와 함께 올라 있는 것뿐이고 표에 있는 규칙은 모두 실제로 있다`, () => {
      const rules = readOpacityRules(css);
      const found = new Set(rules.map(key));
      const allowed = ALLOWED[file];
      for (const k of found) expect(allowed.has(k), `${file}에 새 opacity 규칙 ${k} — 글자 대비를 잃지 않는지 확인하고 이 표에 이유와 함께 올린다`).toBe(true);
      for (const k of allowed.keys()) expect(found.has(k), `표에는 있는데 ${file}에는 없는 규칙 ${k} — 표에서도 지운다`).toBe(true);
      expect(rules.length).toBeGreaterThan(0);
    });
  }

  it('조용히 끼어드는 규칙을 실제로 잡는다(공허 통과 방지): 합성 CSS에 새 불투명도 규칙을 더하면 표에 없는 규칙으로 읽힌다', () => {
    const rules = readOpacityRules(`${dashCss}
.sneaky { color: var(--c-text); opacity: 0.4; }`);
    expect(rules.map(key)).toContain('`.sneaky`|0.4');
    expect(ALLOWED['dash.css'].has('`.sneaky`|0.4')).toBe(false);
  });
});

describe('보고서 머리글 (REV-003-M3-5 관찰, designer 제안 문구 — docs/design/diff-003.md 4절)', () => {
  it('머리글은 doc.css가 만드는 화면 쌍을 정확히 말한다: 띠 표기(.doc__tag)만 불투명도로 쌓이고 장식 도장 「접수」는 불투명도 없이 토큰 색 그대로다 — 옛 문구(도장이 불투명도로 쌓인다)는 없다', () => {
    const results = [...checkTheme(themeTokens(blocks, 'light'), 'light', PAIRS), ...checkTheme(themeTokens(blocks, 'dark'), 'dark', PAIRS)];
    const head = formatReport(results, { mismatch: [] }).split('\n').slice(0, 6).join('\n');
    expect(head).toContain('`src/styles/doc.css`가 만드는 화면 쌍');
    expect(head).toContain('띠 표기 `.doc__tag`처럼 불투명도로 쌓이는 글자');
    expect(head).toContain('불투명도 없이 토큰 색 그대로인 장식 도장 「접수」의 글자·테두리');
    expect(head).not.toContain('도장 「접수」·띠 표기처럼 바탕 위에 불투명도로 쌓이는 글자');
  });
});
