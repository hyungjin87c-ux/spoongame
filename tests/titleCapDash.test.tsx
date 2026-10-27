import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { playToEnd, type EndingGame } from '../src/core';
import { SYSTEM_TITLE, SYSTEM_TITLE_CHARS, titleCharsFor } from '../src/data/dashText';
import { ErrorBoundary } from '../src/screens/ErrorBoundary';
import { EndingScreen } from '../src/screens/EndingScreen';
import { SupersededScreen } from '../src/screens/SupersededScreen';
import { chooserFor, startLife } from '../scripts/simulateLib';

/**
 * 새 화면(엔딩·밀린 화면·오류 화면·대시보드)의 제목(h1) 글자 크기 상한 (SPEC-003 QM3-2, R-321 / REV-003-M4-1).
 * 룰렛 제목(tests/titleCap.test.tsx)과 같은 방식: h1이 가장 긴 낱말의 글자 수 + 1을 CSS 변수 `--title-chars`로 넘기고, CSS가 `font-size: max(바닥, min(기본, 100cqi ÷ 칸 수))`로 줄여
 * 폭 320 · 글자 200%에서도 제목 낱말이 중간에서 끊기지 않게 한다. 실제 폭·글자 크기 조합(11뷰포트 × 글자 100~200%)의 렌더 측정은 e2e/m4-titles.spec.ts가 한다(레이아웃이 필요해 브라우저로 돈다).
 */

/** vitest는 CSS의 ?raw 가져오기를 빈 문자열로 돌려주므로 파일 시스템으로 읽는다(tests/titleCap.test.tsx와 같은 방법) */
async function readText(relative: string): Promise<string> {
  const spec = 'node:fs';
  const fs = (await import(/* @vite-ignore */ spec)) as { readFileSync(path: URL, encoding: 'utf-8'): string };
  return fs.readFileSync(new URL(relative, import.meta.url), 'utf-8');
}
const dashCss = (await readText('../src/styles/dash.css')).replace(/\/\*[^]*?\*\//g, '');

const h1Of = (html: string): { text: string; style: string | null } => {
  const m = /<h1 ([^>]*)>([^]*?)<\/h1>/.exec(html);
  expect(m, 'h1').not.toBeNull();
  return { text: m![2].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim(), style: /style="([^"]*)"/.exec(m![1])?.[1] ?? null };
};

const ending = playToEnd(startLife(2024, 'alpha'), chooserFor('random', 2024)).state as EndingGame;

describe('엔딩 「{이름}의 인생」 (R-320·R-321)', () => {
  const html = renderToStaticMarkup(<EndingScreen game={ending} onRebirth={() => {}} />);

  it('h1이 제목 문구의 가장 긴 낱말 + 1을 --title-chars로 넘긴다 (이름 길이에 따라 달라진다)', () => {
    const { text, style } = h1Of(html);
    expect(text).toBe(`${ending.character.name}의 인생`);
    expect(style).toBe(`--title-chars:${titleCharsFor(text)}`);
    expect(titleCharsFor(text)).toBe([...ending.character.name].length + 1 + 1); // 「{이름}의」 = 이름 + 1글자, 여유 1
    // 이름이 길어지면 칸 수도 커진다 — 상수가 아니라 실제 제목에서 계산한다
    const longer = renderToStaticMarkup(<EndingScreen game={{ ...ending, character: { ...ending.character, name: '남궁민수정' } }} onRebirth={() => {}} />);
    expect(h1Of(longer).style).toBe('--title-chars:7');
  });

  it('얼굴 타일과 텍스트 칸이 서로 다른 요소다: 얼굴은 head의 직접 자식, 시대 이름·h1·생애 기간 줄은 .ending__who 안 (얼굴이 flex로 늘어나지 않는다)', () => {
    const head = html.slice(html.indexOf('<div class="ending__head">'), html.indexOf('</main>'));
    expect(head).toMatch(/^<div class="ending__head"><div class="face face--lg" data-testid="face"/);
    const who = /<div class="ending__who">([^]*?)<\/div><\/div>/.exec(head);
    expect(who, '텍스트 칸').not.toBeNull();
    expect(who![1]).toContain('<h1');
    expect(who![1]).toContain('data-testid="ending-span"'); // M7e-3: 「{출생 연월} ~ {사망 연도}년 · {나이}세」 (예전 출생 줄 ending-born 대신)
    expect(who![1]).not.toContain('data-testid="face"');
  });
});

describe('밀린 화면·오류 화면의 메시지 (R-321)', () => {
  it('밀린 화면: h1 글자는 현행 그대로이고 --title-chars는 두 메시지의 가장 긴 낱말 + 1(8)', () => {
    const { text, style } = h1Of(renderToStaticMarkup(<SupersededScreen onTakeOver={() => {}} />));
    expect(text).toBe(SYSTEM_TITLE.superseded);
    expect(style).toBe(`--title-chars:${SYSTEM_TITLE_CHARS}`);
    expect(SYSTEM_TITLE_CHARS).toBe(8);
  });

  it('오류 화면: h1 글자는 현행 그대로이고 같은 --title-chars다 (두 메시지가 같은 규칙 아래 있다)', () => {
    const boundary = new ErrorBoundary({ children: null });
    boundary.state = { failed: true };
    const { text, style } = h1Of(renderToStaticMarkup(boundary.render() as never));
    expect(text).toBe(SYSTEM_TITLE.error);
    expect(style).toBe(`--title-chars:${SYSTEM_TITLE_CHARS}`);
  });
});

describe('CSS (dash.css): 제목 글자 크기는 rem 고정 상한이 아니라 줄 폭(100cqi) ÷ 칸 수의 min()이다', () => {
  // @supports (width: 1cqi) 블록이 셋이다: 중대 결정 카드 제목(M7b) · 기록 시트 질문(M7c, .sheet__title) · 엔딩/밀린·오류 화면 제목. 셋을 한 덩어리로 본다
  const blocks = [...dashCss.matchAll(/@supports \(width: 1cqi\) \{([^]*?)\n\}/g)];
  const supports = blocks.length === 0 ? null : ([blocks.map((b) => b[0]).join('\n'), blocks.map((b) => b[1]).join('\n')] as unknown as RegExpExecArray);

  it('식은 @supports (width: 1cqi)로 감싼다 — cqi를 모르는 브라우저는 식이 통째로 무효가 되므로 기본 크기로 물러난다 (doc.css R-302와 같은 방법)', () => {
    expect(supports, '@supports 블록').not.toBeNull();
    expect(blocks.length, '블록 수(카드 제목 + 기록 시트 질문 + 엔딩·시스템)').toBe(3);
    expect(supports![1]).toContain('.sheet__title { font-size: max(var(--fs-lg), min(var(--fs-xl), calc(100cqi / var(--title-chars, 8)))); }');
    expect(supports![1]).toContain('.decision__title { font-size: max(var(--fs-lg), min(var(--fs-xl), calc(100cqi / var(--title-chars, 8)))); }');
    expect(supports![1]).toContain('.ending__who .t-title { font-size: max(var(--fs-lg), min(var(--fs-2xl), calc(100cqi / var(--title-chars, 8)))); }');
    expect(supports![1]).toContain('.system h1 { font-size: max(var(--fs-md), min(var(--fs-xl), calc(100cqi / var(--title-chars, 8)))); }');
    // 블록 밖에는 cqi가 없다
    expect(blocks.reduce((css, b) => css.replace(b[0], ''), dashCss)).not.toContain('cqi');
  });

  it('컨테이너: 엔딩은 이름 칸(.ending__who), 밀린·오류 화면은 카드(.system .card) — 둘 다 inline-size 컨테이너다', () => {
    expect(/\.ending__who \{([^}]*)\}/.exec(dashCss)![1]).toMatch(/container-type:\s*inline-size/);
    expect(/\.system \.card \{ container-type: inline-size; \}/.test(dashCss)).toBe(true);
  });

  it('엔딩의 flex 늘림은 이름 칸에만 걸린다: 얼굴 타일(div.face)을 고르는 `.ending__head > div` 선택자가 없다 (R-320 — 예전 규칙이 96px 정사각을 가로로 늘렸다)', () => {
    expect(dashCss).not.toMatch(/\.ending__head\s*>\s*div/);
    expect(/\.ending__who \{[^}]*flex:\s*1 1 9rem/.test(dashCss)).toBe(true);
    expect(/\.face \{[^}]*flex:\s*none/.test(dashCss)).toBe(true);
    expect(/\.face--lg \{ --face-size: 96px; \}/.test(dashCss)).toBe(true);
  });

  it('대시보드 이름(h1)은 줄일 상한이 없고(기본이 본문 크기) 이름과 나이 알약은 flex-wrap으로 줄을 나눈다', () => {
    const who = /\.who \{([^}]*)\}/.exec(dashCss)![1];
    expect(who).toMatch(/flex-wrap:\s*wrap/);
    expect(/\.who__name \{[^}]*font-size:\s*var\(--fs-md\)/.test(dashCss)).toBe(true);
  });

  it('확인 단계의 버튼은 낱말 단위로 줄바꿈한다 (R-336): .exit-ask__actions > .btn { white-space: normal } 이 .toolbar .btn { white-space: nowrap }보다 뒤에 있다', () => {
    const nowrapAt = dashCss.indexOf('.toolbar .btn { white-space: nowrap; }');
    const normalAt = dashCss.indexOf('.exit-ask__actions > .btn { white-space: normal;');
    expect(nowrapAt).toBeGreaterThan(-1);
    expect(normalAt).toBeGreaterThan(nowrapAt);
    expect(dashCss.slice(normalAt, dashCss.indexOf('}', normalAt))).toMatch(/word-break:\s*keep-all/);
  });
});
