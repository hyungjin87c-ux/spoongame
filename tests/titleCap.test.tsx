import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { beginBirth, createInitialState } from '../src/core';
import { BIRTH_TEXT, ROULETTE_TEXT, ROULETTE_TITLE_CHARS, ROULETTE_TITLE_LONGEST_WORD, longestWordLength } from '../src/data/birthReportText';
import { RouletteScreen } from '../src/screens/RouletteScreen';

/**
 * 제목(h1) 글자 크기 상한 (SPEC-003 QM3-2, QA-003-M3 M3-L02): 룰렛 제목의 가장 긴 낱말(「정해졌습니다」)이 폭 320 · 글자 200%에서도 한 줄에 들어가도록 글자 크기를 **줄 폭 ÷ (글자 수 + 여유)** 로 줄인다.
 * 글자 수는 문구 상수에서 계산하고(`ROULETTE_TITLE_LONGEST_WORD`), 이 시험이 그 값이 실제 화면 제목의 가장 긴 낱말과 같음을 단언해 새 제목이 상한을 조용히 넘지 않게 한다.
 * 실제 폭·글자 크기 조합의 렌더 측정은 e2e/m3-title-cap.spec.ts가 한다(레이아웃이 필요해 브라우저로 돈다).
 */

/** vitest는 CSS의 ?raw 가져오기를 빈 문자열로 돌려주므로 파일 시스템으로 읽는다(tests/birthScreen.test.tsx와 같은 방법) */
async function readText(relative: string): Promise<string> {
  const spec = 'node:fs';
  const fs = (await import(/* @vite-ignore */ spec)) as { readFileSync(path: URL, encoding: 'utf-8'): string };
  return fs.readFileSync(new URL(relative, import.meta.url), 'utf-8');
}
const docCss = await readText('../src/styles/doc.css');

/** 룰렛 화면 h1의 안쪽 글자와 style 속성 */
function headingOf(spin: boolean): { text: string; style: string | null } {
  const born = beginBirth(createInitialState(11), 'present');
  const html = renderToStaticMarkup(<RouletteScreen era="present" character={born.character!} report={born.birthReport!} spin={spin} onFinishSpin={() => {}} onNext={() => {}} />);
  const m = /<h1 ([^>]*)>([^]*?)<\/h1>/.exec(html);
  expect(m, 'h1').not.toBeNull();
  return { text: m![2].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim(), style: /style="([^"]*)"/.exec(m![1])?.[1] ?? null };
}

describe('longestWordLength: 공백으로 가른 낱말 중 가장 긴 것의 글자 수', () => {
  it('낱말 하나·여러 문구·여러 공백·이모지(코드 포인트 한 글자)', () => {
    expect(longestWordLength(['태어날 곳이 정해졌습니다'])).toBe(6);
    expect(longestWordLength(['가나', '다라마바 사'])).toBe(4);
    expect(longestWordLength(['  가   나나나  '])).toBe(3);
    expect(longestWordLength(['👍👍 a'])).toBe(2);
  });
});

describe('룰렛 제목 글자 크기 상한 (QM3-2)', () => {
  it('ROULETTE_TITLE_LONGEST_WORD = 실제 화면 제목(회전 중·결과)의 가장 긴 낱말 글자 수이고(「정해졌습니다」 6글자), 상한의 칸 수는 거기에 여유 1글자를 더한 값이다', () => {
    const spin = headingOf(true).text;
    const done = headingOf(false).text;
    expect(spin).toBe(ROULETTE_TEXT.spinTitle);
    expect(done).toBe(ROULETTE_TEXT.doneTitle);
    expect(ROULETTE_TITLE_LONGEST_WORD).toBe(longestWordLength([spin, done]));
    expect(ROULETTE_TITLE_LONGEST_WORD).toBe(6);
    expect(done.split(' ').sort((a, b) => b.length - a.length)[0]).toBe('정해졌습니다');
    expect(ROULETTE_TITLE_CHARS).toBe(ROULETTE_TITLE_LONGEST_WORD + 1);
  });

  it('h1이 상한의 칸 수를 CSS 변수(--title-chars)로 받는다 — 회전 중·결과 모두 같은 값(제목이 바뀌어도 글자 크기가 바뀌지 않는다)', () => {
    for (const spin of [true, false]) expect(headingOf(spin).style, `spin=${spin}`).toBe(`--title-chars:${ROULETTE_TITLE_CHARS}`);
  });

  it('CSS: 제목 글자 크기는 rem 고정 상한이 아니라 줄 폭(100cqi) ÷ 칸 수의 min() — 바닥은 본문보다 큰 --fs-lg, 제목 상자(.roulette__lead)가 컨테이너다', () => {
    const css = docCss.replace(/\/\*[^]*?\*\//g, '');
    const lead = /\.roulette__lead \{([^}]*)\}/.exec(css)![1];
    expect(lead, '제목을 담은 상자가 inline-size 컨테이너').toMatch(/container-type:\s*inline-size/);
    const title = /\.roulette__lead \.t-title \{([^}]*)\}/.exec(css)![1];
    expect(title).toContain('font-size: max(var(--fs-lg), min(var(--fs-2xl), calc(100cqi / var(--title-chars, 8))))');
    // 고정 rem 상한만 있는 규칙이 아니다: 기본 크기(--fs-2xl)와 줄 폭 기준 값 둘의 min이다
    expect(title).toMatch(/min\(var\(--fs-2xl\),\s*calc\(100cqi \/ var\(--title-chars/);
  });

  it('출생신고 제목은 두 글자 낱말뿐이라(「출생」「신고」) 기본 크기가 어떤 폭·글자 크기에서도 한 줄 전체보다 훨씬 작다 — 새 제목이 이 사실을 넘으면 이 시험이 알린다', () => {
    expect(longestWordLength([BIRTH_TEXT.docTitle])).toBe(2);
  });
});
