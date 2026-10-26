import { describe, expect, it } from 'vitest';
import { DASH_TEXT } from '../src/data/dashText';
import { listRepoTextFiles, readRepoText } from './helpers/repoFiles';
import copyMd from '../docs/design/copy.md?raw';

/**
 * 머리의 버튼 이름 바꾸기 (SPEC-005 r4 UX11·QI11, 완료 기준 3): 이전 이름을 `src/`·`tests/`·`e2e/`·`e2e-prod/` 어디에서도 쓰지 않고(과거 기록 `qa/results/`·문서는 제외),
 * 형진 님 원문의 낱말 계열도 쓰지 않는다(UX11-2 — R-124의 예외가 아니라 새로 지은 이름이다). 접근 가능한 이름 = `copy.md` 15-2의 새 이름.
 *
 * 이 파일 자신이 이전 이름을 글자 그대로 쓰면 스스로 걸리므로 점검 패턴은 대괄호로 한 칸을 가른 꼴(`카드[ ]접기`)이다 — 소스에 글자가 이어 나오지 않는다.
 * 예외 하나: 새 소식 v0.2.1의 개선 항목(`src/data/releaseNotes.ts`)은 「이름을 바꿨다」는 사실을 알리는 글이라 이전 이름이 한 번 들어간다(copy.md 15-7 확정 제안 그대로,
 * 시험 tests/releaseNotes.test.ts가 그 한 줄만 허용한다). 마스터가 노트에서 이전 이름을 빼기로 하면 이 예외도 지운다.
 */

const OLD_NAME = /카드[ ]접기/;
/** 형진 님 원문 계열 (붙여 쓴 꼴·띄어 쓴 꼴) */
const ORIGINAL_WORD = /내려[ ]?두기|내려[ ]?놓기/;
const SCOPE = /^(?:src|tests|e2e|e2e-prod)\//;
/** 이전 이름이 한 번 남는 곳 (새 소식 항목) */
const EXEMPT_OLD_NAME = new Set(['src/data/releaseNotes.ts']);

describe('「잠시 덮어 두기」로 이름 바꾸기 (UX11, 완료 기준 3)', () => {
  const files = listRepoTextFiles().paths.filter((p) => SCOPE.test(p));

  it('점검 범위가 비어 있지 않다 (공허 통과 방지): src · tests · e2e · e2e-prod의 텍스트 파일 수백 개', () => {
    expect(files.length).toBeGreaterThan(300);
    for (const dir of ['src/', 'tests/', 'e2e/', 'e2e-prod/']) expect(files.some((p) => p.startsWith(dir)), dir).toBe(true);
  });

  it('이전 이름은 새 소식 한 곳 말고는 어디에도 없다', () => {
    const hits: string[] = [];
    for (const path of files) {
      if (EXEMPT_OLD_NAME.has(path)) continue;
      const text = readRepoText(path);
      if (text !== null && OLD_NAME.test(text)) hits.push(path);
    }
    expect(hits).toEqual([]);
  });

  it('새 소식의 예외는 그 파일에 정확히 한 번뿐이다 (이름을 바꿨다는 알림 한 줄)', () => {
    const text = readRepoText('src/data/releaseNotes.ts') as string;
    expect((text.match(new RegExp(OLD_NAME, 'g')) ?? []).length).toBe(1);
  });

  it('형진 님 원문 계열 낱말은 어디에도 없다', () => {
    const hits: string[] = [];
    for (const path of files) {
      const text = readRepoText(path);
      if (text !== null && ORIGINAL_WORD.test(text)) hits.push(path);
    }
    expect(hits).toEqual([]);
  });

  it('화면 이름과 접근 가능한 이름은 copy.md 15-2의 새 이름이고, copy.md에 「새로 지은 이름」(R-124의 예외 아님) 기록이 있다', () => {
    expect(DASH_TEXT.foldCard).toBe('잠시 덮어 두기');
    const sec = copyMd.slice(copyMd.indexOf('### 15-2.'), copyMd.indexOf('### 15-3.'));
    expect(sec).toContain('**「잠시 덮어 두기」**');
    expect(sec).toContain('R-124의 예외가 아니라 새로 지은 이름');
    expect(copyMd.slice(copyMd.indexOf('## 15.'))).toContain('UX11-2');
  });
});
