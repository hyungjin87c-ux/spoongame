import { describe, expect, it } from 'vitest';
import { isAskRollChoice } from '../src/core';
import { ASK_EFFECTS, ASK_KINDS } from '../src/data/askTable';
import { askEvent } from './helpers/askEvents';

/**
 * 선택지의 정적 효과를 읽는 시험·스크립트의 한 곳 규칙 (SPEC-011 AK4, 「`choices`를 읽는 29개 파일」 정리).
 * 조르기 사건의 조른다·떼쓴다에는 **데이터 효과가 없다**(갈래별 효과는 코드 표 `ASK_EFFECTS` — 결정 AQ1). 그래서 풀 전체의 선택지 `effects`·`bonuses`를 훑어 점수·영향·플래그를 읽는 코드는
 * 이 선택지를 효과 0으로 오독한다. 규칙은 하나다: **풀 전체를 훑는 읽기는 `isAskRollChoice`로 거르거나 `tests/helpers/askChoice.ts`(실제 효과 `resolvedChoiceEffects` · 기대 효과 `expectedStat`)를 거친다.**
 * 29개 파일을 훑어 본 결과(2026-11-09): 풀 전체를 훑어 갈래 선택지를 오독하는 곳은 `tests/impact.test.ts`(대기 상태 × 선택지 전부, 20세 미만 플래그 잠금) · `tests/pacing.test.ts`(행복·관계 전략) · `tests/simulation.test.ts`(학력 욕심 전략) 셋이었고
 * 위 규칙으로 고쳤다(`tests/familyCard.test.ts`의 사이 표 방향 시험은 `ASK_EFFECTS`를 함께 읽도록 고쳤다 — AK5). 나머지는 이름을 적은 사건·고정 목록(사건 id)만 읽거나 문장·조건·플래그 존재만 보는 읽기라 조르기 선택지에 닿지 않는다.
 * 아래 시험은 **선택지의 `effects`·`bonuses`를 읽는 파일의 목록을 잠근다** — 목록에 없는 파일이 새로 읽으면 실패하고, 읽을 때는 이 규칙을 따르는지 이유와 함께 이 목록에 올린다.
 */

const SOURCES = import.meta.glob(['./*.test.ts', './*.test.tsx', './helpers/*.ts', '../scripts/*.ts'], { query: '?raw', import: 'default', eager: true }) as Record<string, string>;

/** 선택지(`c`·`ch`·`choice`·`x`·`cc`·`k`)의 `effects`·`bonuses`를 읽거나 `choices … .effects`·`choiceOf(…).effects`·`.choices.find(…).effects` 꼴을 쓰는 줄 */
const READS = /\b(c|ch|choice|x|cc|k)\.(effects|bonuses)\b|choices[^;]*\)\.effects|choiceOf\([^)]*\)\.(effects|bonuses)|\.choices!?\.find[^;]*\.(effects|bonuses)/;

/** 허용 목록: 파일 → 이 규칙을 지키는 이유 */
const ALLOWED: Record<string, string> = {
  './impact.test.ts': '풀 전체 읽기 — `resolvedChoiceEffects`(실제 효과)로 읽고 갈래 선택지는 영향 줄이 비어 있음만 본다 · 20세 미만 플래그 잠금은 `ASK_EFFECTS` 플래그를 함께 센다',
  './familyCard.test.ts': '사이 표 방향 시험 — 사건 효과와 `ASK_EFFECTS`를 함께 읽는다(AK5)',
  './helpers/askChoice.ts': '한 곳 규칙의 구현 — 조르기 갈래 선택지는 `askOutcomeOf`·`askBranchProbs`로 읽는다',
  './economyConversion.test.ts': '이름을 적은 사건·고정 목록(`unchanged` 등)만 읽는다 — 조르기 사건은 돈(`assets`·`family`) 변환표에 없고 집안 살림 지출은 `ASK_EFFECTS`가 정한다(AK7이 사건 id 집합 단언을 갱신한다)',
  './events.test.ts': '이름을 적은 사건(`school-tutoring` 등)의 효과만 읽는다',
  './familyFm7a.test.ts': '`has_child`를 켜는 사건을 찾는다 — 조르기 사건은 그 플래그를 켜지 않는다',
  './familyLint.test.ts': '조부모 선택지의 플래그 · 효과 JSON의 가족 낱말 점검 — 문자열만 본다',
  './familyTick.test.ts': '가족 줄이 만드는 선택지(`fam-` 사건)의 효과만 읽는다',
  './flow.test.ts': '이름을 적은 사건의 플래그만 읽는다',
  './infantContent.test.ts': '고정 목록(`NEW` 사건 id)의 효과만 읽는다',
  './inherit.test.ts': '작별 장면 등 이름을 적은 사건과 `parents_gone`을 켜는 사건 찾기 — 조르기 사건은 그 플래그를 켜지 않는다',
  './m7eContent.test.ts': '이름을 적은 사건의 효과만 읽는다',
  './parentDecision.test.ts': '분류표에 있는 부모 결정 사건만 읽는다(조르기는 본인 카드)',
  '../scripts/baseline004Lib.ts': '옛 기준선 도구 — 이벤트가 켜는 플래그 목록만 센다(데이터 효과의 플래그, `ASK_EFFECTS` 플래그는 사건 데이터에 없다)',
  '../scripts/parentReportLib.ts': '부모 결정·흘러감 카드의 관찰자(`observe`)만 읽는다 — 조르기 카드는 본인 카드라 닿지 않는다',
  '../scripts/askReportLib.ts': '조르기 보고 도구 — 기대 행복 최대 전략이 조르기가 아닌 카드의 행복을 데이터 효과로 읽고, 조르기 갈래 선택지는 `askBranchProbs`·`ASK_EFFECTS`로 읽는다(AK10)',
  '../scripts/realismL0Lib.ts': '정석 선택자의 플래그 읽기 — 조르기 갈래 선택지는 정석 플래그(`married` 등)를 켜지 않는다',
};

describe('선택지의 정적 효과를 읽는 파일 목록 잠금 (SPEC-011 AK4)', () => {
  const readers = Object.entries(SOURCES)
    .filter(([file]) => !file.endsWith('askStaticEffects.test.ts'))
    .filter(([, src]) => src.split('\n').some((line) => !line.trim().startsWith('//') && !line.trim().startsWith('*') && READS.test(line)))
    .map(([file]) => file)
    .sort();

  it('허용 목록에 없는 파일이 선택지의 effects·bonuses를 읽지 않는다 — 풀 전체를 훑는다면 isAskRollChoice로 거르거나 tests/helpers/askChoice.ts를 거쳐야 하고 이 목록에 이유와 함께 올린다', () => {
    const extra = readers.filter((f) => ALLOWED[f] === undefined);
    expect(extra, '허용 목록에 없는 새 읽기(조르기 갈래 선택지를 효과 0으로 오독하지 않는지 확인하고 ALLOWED에 이유를 적는다)').toEqual([]);
  });

  it('허용 목록의 모든 파일이 실제로 있고 선택지 효과를 읽는다 — 읽지 않게 된 항목은 목록에서 뺀다', () => {
    const stale = Object.keys(ALLOWED).filter((f) => !readers.includes(f));
    expect(stale).toEqual([]);
    expect(readers.length).toBe(Object.keys(ALLOWED).length);
  });

  it('풀 전체를 훑어 읽던 세 파일은 한 곳 규칙(tests/helpers/askChoice.ts)을 거친다 — 행복·관계 전략(pacing)·학력 욕심 전략(simulation)은 기대값, 대기 상태 전수(impact)는 실제 효과', () => {
    const uses = (file: string): boolean => SOURCES[file].includes("from './helpers/askChoice'");
    expect(uses('./impact.test.ts') && SOURCES['./impact.test.ts'].includes('resolvedChoiceEffects')).toBe(true);
    expect(uses('./pacing.test.ts') && SOURCES['./pacing.test.ts'].includes('expectedStat')).toBe(true);
    expect(uses('./simulation.test.ts') && SOURCES['./simulation.test.ts'].includes('expectedStat')).toBe(true);
  });

  it('조르기 갈래 선택지만 `isAskRollChoice`다 — 조른다·떼쓴다는 참, 참는다·일반 사건은 거짓 (조르기 사건 + 어느 선택지든)', () => {
    for (const kind of ASK_KINDS) {
      const ev = askEvent(`ask-${kind}-x`, kind);
      expect(ev.choices!.map((c) => [c.id, isAskRollChoice(ev, c.id)])).toEqual([['beg', true], ['tantrum', true], ['endure', false]]);
      // 갈래 선택지는 데이터 효과가 없고 참는다는 표 endure 행과 같다 — 그래서 위 규칙이 필요하고 충분하다
      for (const c of ev.choices!) expect(c.effects === undefined, `${kind}/${c.id}`).toBe(c.id !== 'endure');
      expect(ev.choices![2].effects).toEqual(ASK_EFFECTS.endure);
      for (const c of ev.choices!) expect(isAskRollChoice({}, c.id), `${kind}/${c.id} ask 없는 사건`).toBe(false);
    }
  });
});
