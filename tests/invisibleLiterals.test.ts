import { describe, expect, it } from 'vitest';
import { listRepoTextFiles, readRepoText } from './helpers/repoFiles';

/**
 * 소스에 보이지 않는 글자를 글자 그대로 쓰지 않는다 (SPEC-003 M7c r2 R-407, REV-003-M7c-1 · REV-003-M7b-3의 위생 기준).
 * 제로폭 이음(ZWJ)·변이 선택자(VS15·VS16)·키캡 결합 문자·방향 제어·BOM·한글 채움 문자 같은 글자가 소스에 그대로 들어 있으면 화면(편집기·서식기·리뷰 화면)에서는 구별되지 않아,
 * 편집기가 지우는 순간 ZWJ로 가르던 코드가 빈 문자열로 가르는 코드로 조용히 바뀌는 식의 사고가 난다. 코드와 시험 문자열은 백슬래시-u 이스케이프나 String.fromCodePoint로 쓴다.
 * 대상은 **저장소 전체의 코드 파일**(어느 폴더든 ts·tsx·mts·cts·js·mjs·cjs)과 `src` 안의 JSON 자료이고, 이 시험에 걸리는 글자 목록의 정의는 아래 한 곳이다.
 * designer 소유 파일(tests/designAssets.test.ts · scripts/design/)도 같은 기준으로 감시한다 — M7c r2에서 시험이 이 둘을 빼 둔 채로 초록이 되어 맨 글자가 남았던 것이 R-407 재지적이다(r3에서 이스케이프로 바꾸고 제외를 지움).
 * 유일한 제외는 `qa/` 폴더다: QA가 공격 입력으로 일부러 보이지 않는 글자를 넣어 만든 산출물(스크립트·결과 JSON·기록)이라 앱 코드가 아니고, 맨 글자 자체가 그 입력이다. 앱이 읽는 코드·자료에는 들어가지 않는다.
 */

/** 보이지 않거나 눈에 띄지 않는 글자의 코드 포인트 범위 (이 목록은 이스케이프로 적는다 — 이 파일 자신도 걸리지 않게) */
const INVISIBLE = /[\u00AD\u034F\u061C\u115F\u1160\u17B4\u17B5\u180B-\u180F\u200B-\u200F\u2028-\u202F\u2060-\u206F\u20E3\u3164\uFE00-\uFE0F\uFEFF\uFFA0\u{E0000}-\u{E007F}\u{E0100}-\u{E01EF}]/u;
/** 감시 범위: qa 폴더 밖의 모든 코드 파일 + src 폴더 아래의 JSON 자료 */
const CODE = /^(?!qa\/).*\.(?:ts|tsx|mts|cts|js|mjs|cjs)$|^src\/.*\.json$/;

describe('보이지 않는 글자 직접 입력 금지 (R-407)', () => {
  it('감지기 자체 시험: 코드 포인트로 만든 글자는 잡고 보이는 글자는 잡지 않는다', () => {
    for (const cp of [0x200d, 0xfe0f, 0xfe0e, 0x20e3, 0x202e, 0x2066, 0x200b, 0xfeff, 0x3164, 0x061c, 0xe007f]) expect(INVISIBLE.test(String.fromCodePoint(cp)), cp.toString(16)).toBe(true);
    for (const ch of ['가', 'a', '1', ' ', String.fromCharCode(10), '·', '👍', '한', '→', '…']) expect(INVISIBLE.test(ch), ch).toBe(false);
  });

  it('코드 파일 어디에도 그런 글자가 글자 그대로 들어 있지 않다', () => {
    const files = listRepoTextFiles().paths.filter((p) => CODE.test(p));
    expect(files.length, '공허 통과 방지: 코드 파일을 읽었다').toBeGreaterThan(150);
    // 범위 확인: designer 소유 파일과 src의 JSON 자료가 감시 대상에 들어 있고, qa/ 산출물만 빠져 있다
    for (const must of ['tests/designAssets.test.ts', 'scripts/design/buildMockups.mjs', 'src/data/notes.json', 'src/core/noteText.ts', 'e2e/m7c-input-attack.spec.ts']) expect(files, must).toContain(must);
    expect(files.filter((p) => p.startsWith('qa/')), 'qa/ 산출물은 범위 밖').toEqual([]);
    const hits: string[] = [];
    for (const p of files) {
      const text = readRepoText(p);
      if (text === null) continue;
      text.split(String.fromCharCode(10)).forEach((line, i) => {
        const found = new Set<string>();
        for (const ch of line) if (INVISIBLE.test(ch)) found.add('U+' + ch.codePointAt(0)!.toString(16).toUpperCase());
        if (found.size > 0) hits.push(p + ':' + (i + 1) + ' ' + [...found].join(','));
      });
    }
    expect(hits, '이스케이프나 String.fromCodePoint로 바꾼다').toEqual([]);
  });
});
