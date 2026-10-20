import { describe, expect, it } from 'vitest';
import docSrc from '../docs/data/parent-decision-model.md?raw';
import type { ParentingStyle } from '../src/core';
import { PARENT_DECISION_TABLE, PARENT_FIT, PARENT_MODEL, PARENT_PRIORITY, type DecisionArea } from '../src/data/parentDecisionTable';

/**
 * 설계 문서 ↔ 코드 표 (SPEC-005 PD2 검증 ④, 설계 문서 5절 T1b): `docs/data/parent-decision-model.md` 5절 끝의 「기계 판독 블록」(```parent-table)을 `?raw`로 읽어 파싱하고
 * `PARENT_DECISION_TABLE`과 행마다 같음을 단언한다. 표를 고치면 문서도 같이 고쳐야 통과한다 (economyConversion.test.ts·basisDocs.test.ts와 같은 방식).
 */

interface DocRow {
  id: string;
  areas: DecisionArea[];
  childActUntil?: number;
}

function parseBlock(): DocRow[] {
  const m = /```parent-table\n([\s\S]*?)```/.exec(docSrc);
  if (m === null) throw new Error('설계 문서에 ```parent-table 블록이 없다');
  const rows: DocRow[] = [];
  for (const raw of m[1].split('\n')) {
    const line = raw.trim();
    if (line === '' || line.startsWith('#')) continue;
    const cells = line.split('|').map((c) => c.trim());
    if (cells.length !== 3) throw new Error(`열이 3개가 아니다: ${line}`);
    const [id, areas, until] = cells;
    rows.push({ id, areas: areas.split(',').map((a) => a.trim()) as DecisionArea[], ...(until === '-' ? {} : { childActUntil: Number(until) }) });
  }
  return rows;
}

describe('T1b 설계 문서 기계 판독 블록 = 코드 분류표 (PD2)', () => {
  const rows = parseBlock();

  it('블록이 32줄이다 (문서의 헤더 주석은 건너뛴다)', () => {
    expect(rows).toHaveLength(32);
    expect(new Set(rows.map((r) => r.id)).size).toBe(32);
  });

  it('행마다 같다: 이벤트 id 순서·영역 목록·childActUntil이 코드와 문서에서 한 글자도 다르지 않다', () => {
    expect(rows.map((r) => r.id)).toEqual(Object.keys(PARENT_DECISION_TABLE));
    for (const r of rows) {
      const code = PARENT_DECISION_TABLE[r.id];
      expect(code, r.id).toBeDefined();
      expect([...code.areas], r.id).toEqual(r.areas);
      expect(code.childActUntil, r.id).toBe(r.childActUntil);
    }
  });

  it('변이 점검: 문서 블록의 한 줄을 바꾸면 이 대조가 실패한다 (공허 통과 방지)', () => {
    const doctored = rows.map((r) => (r.id === 'school-puppy' ? { ...r, areas: ['care'] as DecisionArea[] } : r));
    const bad = doctored.find((r) => r.id === 'school-puppy')!;
    expect([...PARENT_DECISION_TABLE['school-puppy'].areas]).not.toEqual(bad.areas);
  });
});

describe('설계 문서의 승인 값 = 코드 상수 (2절 · 7절 A3~A6)', () => {
  it('문서 2-3절 표의 양육 방식 계수가 PARENT_PRIORITY와 같다', () => {
    const section = docSrc.slice(docSrc.indexOf('### 2-3.'), docSrc.indexOf('### 2-4.'));
    const names: Record<string, ParentingStyle> = { 엄격: 'strict', 자유: 'free', 헬리콥터: 'helicopter', 방임: 'neglect' };
    for (const [ko, key] of Object.entries(names)) {
      const line = section.split('\n').find((l) => l.startsWith(`| ${ko} |`));
      expect(line, ko).toBeDefined();
      const nums = line!.split('|').slice(2, 7).map((c) => Number(c.trim()));
      const p = PARENT_PRIORITY[key];
      expect(nums, ko).toEqual([p.education, p.health, p.happiness, p.relationships, p.wealth]);
    }
  });

  it('문서 7절 승인표의 ε·T_p·지수 한계와 PARENT_FIT 값이 코드와 같다', () => {
    const a4 = docSrc.split('\n').find((l) => l.startsWith('| A4 |'))!;
    expect(a4).toContain(`\`ε = ${PARENT_MODEL.epsilon}\``);
    expect(a4).toContain(`\`T_p = ${PARENT_MODEL.temperature}\``);
    expect(a4).toContain(`지수 한계 ${PARENT_MODEL.exponentLimit}`);
    const a6 = docSrc.split('\n').find((l) => l.startsWith('| A6 |'))!;
    expect(a6).toContain(`\`fever.dismiss\` ${PARENT_FIT['infant-fever/dismiss']}`);
    expect(a6).toContain(`\`academy\`·\`tutor\`·\`one\` ${PARENT_FIT['school-tutoring/academy']}`); // 사교육(tutoring) 보정 상수는 승인값 그대로
  });

  it('A16 구현 실측 조정: 승인 초기값과 다른 PARENT_FIT은 academy-night(2.0/2.5 → 1.3/1.3)와 육아휴직(1.0 → 1.5)뿐이고, 모두 튜닝 사다리(보정 상수 1.0~4.0) 안이다 — 조정 기록은 PARENT_FIT 주석과 dev 로그', () => {
    const APPROVED: Record<string, number> = {
      'infant-fever/dismiss': 0.5,
      'school-tutoring/academy': 2.5,
      'school-tutoring/tutor': 2.5,
      'school-academy-night/many': 2.0,
      'school-academy-night/one': 2.5,
      'infant-parental-leave/one': 1.0,
      'infant-parental-leave/share': 1.0,
    };
    expect(Object.keys(PARENT_FIT).sort()).toEqual(Object.keys(APPROVED).sort());
    const changed = Object.keys(APPROVED).filter((k) => PARENT_FIT[k] !== APPROVED[k]);
    expect(changed.sort()).toEqual(['infant-parental-leave/one', 'infant-parental-leave/share', 'school-academy-night/many', 'school-academy-night/one']);
    for (const k of changed) {
      expect(PARENT_FIT[k], k).toBeGreaterThanOrEqual(1.0);
      expect(PARENT_FIT[k], k).toBeLessThanOrEqual(4.0);
    }
  });
});
