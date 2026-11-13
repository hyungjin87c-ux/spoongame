import { describe, expect, it } from 'vitest';

/**
 * 나이 표시는 함수 한 곳만 거친다 (SPEC-019): 화면 코드(`src/screens`·`src/ui`·`src/data/*Text.ts`)가 사람의 나이에 「세」·「살」을 **바로** 붙이면
 * 한국 나이/만 나이 전환을 따르지 않는 곳이 생긴다. 사람 나이는 `core/format.ts`의 `ageText`·`ageHeadText`·`ageRangeText`(또는 `displayAge`)를 거친다.
 * 통계의 나이(연령 구간·기대수명·인구 구성 슬라이드)와 나이 차이(터울·「N살 위」)는 만 나이·차이라 허용 목록에 이유와 함께 둔다.
 */

const sources = {
  ...(import.meta.glob('../src/screens/*.tsx', { query: '?raw', import: 'default', eager: true }) as Record<string, string>),
  ...(import.meta.glob('../src/ui/**/*.{ts,tsx}', { query: '?raw', import: 'default', eager: true }) as Record<string, string>),
  ...(import.meta.glob('../src/data/*Text.ts', { query: '?raw', import: 'default', eager: true }) as Record<string, string>),
};

/** 주석을 뺀 코드만 본다 (줄 끝 주석은 앞에 공백이 있을 때만 지워 문자열 속 `https://`를 건드리지 않는다) */
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\s)\/\/.*$/gm, '$1');
}

/** 값이 들어가는 자리 바로 뒤의 「세」·「살」 (`${…}세`, JSX `{…}` 뒤 줄바꿈 포함 `세`), 옛 접미 상수 */
const DIRECT = /\}\s*세(?![계대상])|\}\s*살(?![아림펴리기])|ageSuffix/;

/**
 * 허용 파일: 사람의 나이가 아닌 값에만 「세」를 붙인다.
 *  - slideText.ts: 통계 슬라이드의 읽기 글(만 나이 기준 연령 구간·인구 구성)
 *  - familyText.ts: 형제 사이의 나이 차이(「{gap}세 위」)
 *  - birthCompareText 등 통계 문장은 이름이 *Text.ts가 아니거나 아래에 없다
 */
const ALLOWED_FILES: Readonly<Record<string, string>> = {
  'slideText.ts': '통계: 연령 구간·인구 구성 슬라이드(만 나이 기준)',
  'familyText.ts': '나이 차이(터울) — 나이가 아니다',
  'familyLineText.ts': '줄 문장은 만들 때 굳는 게임 나이이고, 화면은 familyLineViewText가 나이 보기를 따른다. 나이 차 「N살 위인」은 차이다',
};

const entries = Object.entries(sources).map(([path, raw]) => ({ file: path.slice(path.lastIndexOf('/') + 1), path, code: stripComments(raw) }));

describe('나이 표시는 함수 한 곳만 거친다 (SPEC-019)', () => {
  it('점검 대상이 실제로 잡혔다(빈 glob 방지)', () => {
    expect(entries.length).toBeGreaterThan(40);
    expect(entries.some((e) => e.file === 'LifeScreen.tsx')).toBe(true);
    expect(entries.some((e) => e.file === 'endingText.ts')).toBe(true);
  });

  it('화면 코드에서 나이 함수를 거치지 않고 값에 「세」·「살」을 바로 붙이는 곳이 0이다', () => {
    const bad = entries.filter((e) => ALLOWED_FILES[e.file] === undefined && DIRECT.test(e.code)).map((e) => `${e.path}: ${e.code.split('\n').filter((l) => DIRECT.test(l)).map((l) => l.trim()).join(' | ')}`);
    expect(bad).toEqual([]);
  });

  it('허용 목록의 파일은 실제로 있다(지워진 파일이 허용으로 남지 않는다)', () => {
    for (const f of Object.keys(ALLOWED_FILES)) expect(entries.some((e) => e.file === f), f).toBe(true);
  });

  it('나이 보기를 따라야 하는 화면은 나이 함수나 맥락을 실제로 쓴다', () => {
    const must: Array<[string, RegExp]> = [
      ['LifeScreen.tsx', /displayAge|ageText/],
      ['BirthScreen.tsx', /ageText\(/],
      ['EndingScreen.tsx', /ageText\(/],
      ['LogList.tsx', /ageText\(/],
      ['EraRow.tsx', /ageText\(/],
      ['Cards.tsx', /ageText\(/],
      ['DecisionCard.tsx', /ageText\(/],
      ['ParentCard.tsx', /ageText\(/],
      ['NoteSheet.tsx', /ageText\(/],
      ['SceneCard.tsx', /ageText\(/],
      ['TitleScreen.tsx', /genMetaText\(/],
    ];
    for (const [file, re] of must) expect(entries.find((e) => e.file === file)?.code ?? '', file).toMatch(re);
  });
});
