import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { FORCED_BREAKS, FORCED_BREAK_WORDS, INTENDED_BREAKS, INTENDED_BREAK_WORDS } from '../e2e/intendedBreaks';
import { TitleScreen } from '../src/screens/TitleScreen';
import { GradeChip } from '../src/ui/Grade';
import { findBreakHints, findLineBreakTags, stripComments } from './helpers/breakHints';
import { listRepoTextFiles, readRepoText } from './helpers/repoFiles';

/**
 * 의도된 줄바꿈 지점 목록 ↔ 코드 (SPEC-003 QM3-1 (b)·(e), QA-003-M3 M3-L02). 낱말 한가운데에 줄이 바뀔 수 있는 자리를 코드에 적는 방법은 `<wbr>`·`&shy;`·소프트 하이픈(U+00AD)뿐이고,
 * 그 낱말은 e2e/intendedBreaks.ts의 `INTENDED_BREAKS`에 이유와 함께 올린다. 이 시험이 `src/` 전체의 사용처를 모아 목록과 같음을 단언한다 —
 * 목록에 없는 사용도, 코드에 없는 목록 항목도 실패한다(e2e 감사기는 목록의 낱말만 `intended`로 센다).
 * 감사기 판정식 자체(공백 노드·구두점 줄바꿈 오탐 방지, intended/unavoidable/broken 분류)는 e2e/word-breaks-audit.spec.ts가 합성 DOM으로 시험한다(레이아웃이 필요해 브라우저로 돈다).
 */

describe('findBreakHints: 코드의 줄바꿈 지점 표시를 찾는다 (합성 소스)', () => {
  it('`<wbr>`·`<wbr />`·대문자: 앞뒤로 이어 붙은 한글·영숫자 덩어리를 한 낱말로 묶는다', () => {
    expect(findBreakHints('<>다이아몬드<wbr />수저</>').map((h) => [h.kind, h.word])).toEqual([['wbr', '다이아몬드수저']]);
    expect(findBreakHints('<span>흙<wbr>수저</span>').map((h) => h.word)).toEqual(['흙수저']);
    expect(findBreakHints('<p>AB<WBR/>CD 다른낱말</p>').map((h) => h.word)).toEqual(['ABCD']);
  });

  it('소프트 하이픈: `&shy;`·숫자 엔티티·U+00AD 글자 자체·역슬래시 이스케이프(u00AD, xAD)를 찾는다', () => {
    // 글자·이스케이프는 코드로 만든다(소스에 숨은 글자를 그대로 적지 않는다)
    const BS = String.fromCharCode(92);
    const SHY = String.fromCharCode(0xad);
    const src = ['<i>가나&shy;다라</i>', '<i>마바&#173;사아</i>', '<i>자차&#xAD;카타</i>', `'파하${SHY}가나'`, `'다라${BS}u00ADma'`, `'바사${BS}xADab'`].join(' ');
    expect(findBreakHints(src).map((h) => [h.kind, h.word])).toEqual([
      ['shy-entity', '가나다라'],
      ['shy-entity', '마바사아'],
      ['shy-entity', '자차카타'],
      ['soft-hyphen', '파하가나'],
      ['soft-hyphen', '다라ma'],
      ['soft-hyphen', '바사ab'],
    ]);
  });

  it('주석 안의 언급(`// …<wbr>…`·`/* …&shy;… */`·JSX 주석)은 사용이 아니다 — 문서화하는 글이 목록 단언에 걸리지 않는다', () => {
    const src = `// 이 칩은 <wbr>로 줄을 나눈다\n/* &shy; 는 쓰지 않는다 */\n<p>{/* <wbr> 설명 */}본문</p>\nconst a = 1; // <wbr>`;
    expect(stripComments(src)).not.toMatch(/wbr|shy/);
    expect(findBreakHints(src)).toEqual([]);
  });

  it('표시가 없으면 아무것도 찾지 않는다 (대조군)', () => {
    expect(findBreakHints('<span>다이아몬드수저</span> <br /> <b>흙수저</b>')).toEqual([]);
  });
});

describe('INTENDED_BREAKS ↔ src/ 사용처 (QM3-1 (e))', () => {
  const files = listRepoTextFiles().paths.filter((p) => p.startsWith('src/') && /\.(ts|tsx|css|html)$/.test(p));
  const sites = files.flatMap((file) => {
    const text = readRepoText(file);
    return text === null ? [] : findBreakHints(text).map((h) => ({ file, ...h }));
  });

  it('공허 통과 방지: src의 ts·tsx·css·html 파일을 실제로 훑었고, 줄바꿈 지점 표시가 하나 이상 있다', () => {
    expect(files.length, '훑은 소스 파일 수').toBeGreaterThan(30);
    expect(sites.length).toBeGreaterThanOrEqual(1);
  });

  it('src에서 줄바꿈 지점이 찍힌 낱말의 집합 = 목록의 낱말의 집합 (목록에 없는 사용도, 코드에 없는 목록 항목도 실패)', () => {
    const used = [...new Set(sites.map((s) => s.word))].sort();
    expect(used, `코드의 사용처: ${sites.map((s) => `${s.file}「${s.word}」(${s.kind})`).join(', ')}`).toEqual([...INTENDED_BREAK_WORDS].sort());
  });

  it('목록은 지금 「다이아몬드수저」 하나이고, 쓰는 파일(file)과 이유(why)가 적혀 있으며 실제 사용 파일과 같다', () => {
    expect(INTENDED_BREAKS.map((b) => b.word)).toEqual(['다이아몬드수저']);
    for (const b of INTENDED_BREAKS) {
      expect(b.why.length, `${b.word}: 이유`).toBeGreaterThan(10);
      const inFile = sites.filter((s) => s.word === b.word).map((s) => s.file);
      expect(inFile, `${b.word}는 ${b.file}에서 쓰인다`).toContain(b.file);
      expect([...new Set(inFile)], `${b.word}의 사용 파일이 목록의 file과 같다`).toEqual([b.file]);
    }
  });

  it('목록의 낱말이 중복되지 않는다', () => {
    expect(new Set(INTENDED_BREAK_WORDS).size).toBe(INTENDED_BREAK_WORDS.length);
  });

  it('「다이아몬드수저」의 화면 글자(textContent)는 `<wbr>`가 있어도 「다이아몬드수저」다 — 읽는 이름·복사되는 글자는 같다', () => {
    const html = renderToStaticMarkup(createElement(GradeChip, { grade: 5, size: 'reel' }));
    expect(html, '마크업에는 줄바꿈 지점이 있다').toContain('<wbr');
    expect(html.replace(/<[^>]+>/g, '')).toBe('다이아몬드수저');
    // 칩 전체(점 5개 포함)도 이름은 같다
    const full = renderToStaticMarkup(createElement(GradeChip, { grade: 5 }));
    expect(full.replace(/<[^>]+>/g, '')).toBe('다이아몬드수저');
    expect(full).toContain('aria-label="5단계 중 5단계"');
  });

  it('다른 수저 이름(흙·동·은·금)에는 줄바꿈 지점이 없다', () => {
    for (const g of [1, 2, 3, 4] as const) expect(renderToStaticMarkup(createElement(GradeChip, { grade: g }))).not.toContain('<wbr');
  });
});

/**
 * 강제 줄바꿈 `<br>`도 등록제다 (REV-003-M3-4 R-300). SPEC 「허용은 둘뿐」(한 줄보다 긴 낱말 · 코드에 명시한 줄바꿈 지점)에서 둘째에 `<br>`가 등록 없이 끼어들 수 없다:
 * 글자 사이에 바로 붙은 `<br>`(「다이아몬드<br>수저」)는 낱말 한가운데를 가르므로, `src/`의 `<br>` 사용처가 e2e/intendedBreaks.ts의 `FORCED_BREAKS`와 같아야 한다.
 * e2e 감사기는 등록 없는 낱말의 `<br>`를 폭과 상관없이 `broken`으로, 등록한 낱말은 `forced`로 따로 보고한다(e2e/word-breaks-audit.spec.ts·line-breaks.spec.ts).
 */
describe('findLineBreakTags: 코드의 `<br>` 사용처를 찾는다 (합성 소스)', () => {
  it('`<br>`·`<br />`·`<BR/>`와 createElement("br")를 찾고, `<wbr>`·주석 안의 언급은 세지 않는다', () => {
    expect(findLineBreakTags('<p>가<br />나<br>다<BR/>라</p>')).toHaveLength(3);
    expect(findLineBreakTags("createElement('br') + createElement(\"br\")")).toHaveLength(2);
    expect(findLineBreakTags('<span>다이아몬드<wbr />수저</span>')).toEqual([]);
    expect(findLineBreakTags('// <br> 설명\n/* <br /> */\n<p>{/* <br> */}본문</p>')).toEqual([]);
    expect(findLineBreakTags('<span>없음</span> <bro>')).toEqual([]);
  });
});

describe('FORCED_BREAKS ↔ src/ 사용처 (R-300)', () => {
  const files = listRepoTextFiles().paths.filter((p) => p.startsWith('src/') && /\.(ts|tsx|html)$/.test(p));
  const sites = files.flatMap((file) => {
    const text = readRepoText(file);
    return text === null ? [] : findLineBreakTags(text).map((h) => ({ file, ...h }));
  });
  const perFile = (): Record<string, number> => {
    const out: Record<string, number> = {};
    for (const s of sites) out[s.file] = (out[s.file] ?? 0) + 1;
    return out;
  };

  it('공허 통과 방지: src의 ts·tsx·html 파일을 실제로 훑었고, `<br>` 사용처가 하나 이상 있다', () => {
    expect(files.length, '훑은 소스 파일 수').toBeGreaterThan(30);
    expect(sites.length).toBeGreaterThanOrEqual(1);
  });

  it('src의 `<br>` 사용처(파일별 개수) = 등록 목록(파일별 tags 합) — 목록에 없는 `<br>`도, 코드에 없는 목록 항목도 실패한다', () => {
    const registered: Record<string, number> = {};
    for (const b of FORCED_BREAKS) registered[b.file] = (registered[b.file] ?? 0) + b.tags;
    expect(perFile(), `코드의 사용처: ${sites.map((s) => s.file).join(', ')}`).toEqual(registered);
  });

  it('목록은 지금 「다이아몬드수저」 하나이고, 쓰는 파일(file)·태그 수(tags)·이유(why)가 적혀 있다', () => {
    expect(FORCED_BREAKS.map((b) => b.word)).toEqual(['다이아몬드수저']);
    for (const b of FORCED_BREAKS) {
      expect(b.why.length, `${b.word}: 이유`).toBeGreaterThan(10);
      expect(b.tags, `${b.word}: 태그 수`).toBeGreaterThanOrEqual(1);
      expect(sites.filter((s) => s.file === b.file).length, `${b.word}는 ${b.file}에서 쓰인다`).toBe(b.tags);
    }
    expect(new Set(FORCED_BREAK_WORDS).size, '중복 없음').toBe(FORCED_BREAK_WORDS.length);
  });

  it('데이터로 채워지는 `<br>`의 낱말: 첫 화면을 서버 렌더한 마크업에서 `<br>` 앞뒤로 이어 붙은 낱말의 집합 = 등록 낱말의 집합이고, 렌더된 `<br>` 수와 같다', () => {
    const html = renderToStaticMarkup(createElement(TitleScreen, { era: 'present', lifeLength: 'short30', onSelectEra: () => {}, onSelectLifeLength: () => {}, onBegin: () => {}, minute: 29_850_000 }))
      .replace(/<!-- -->/g, ''); // React가 이웃한 글자 사이에 넣는 주석 표시 (글자 사이의 `<br>`를 가리지 않게)
    const brs = [...html.matchAll(/<br\s*\/?>/gi)];
    const words = [...html.matchAll(/([가-힣A-Za-z0-9]+)<br\s*\/?>([가-힣A-Za-z0-9]+)/g)].map((m) => m[1] + m[2]);
    expect(brs.length, '공허 통과 방지: 첫 화면에 `<br>`가 실제로 그려진다').toBeGreaterThanOrEqual(1);
    expect(words.length, '그려진 `<br>`는 모두 글자 사이에 붙어 있다(낱말 한가운데를 가른다)').toBe(brs.length);
    expect([...new Set(words)].sort(), '그려진 `<br>`가 가르는 낱말 = 등록 낱말').toEqual([...FORCED_BREAK_WORDS].sort());
  });
});
