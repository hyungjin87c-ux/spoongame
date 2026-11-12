import { describe, expect, it } from 'vitest';
import docSrc from '../docs/data/persona-model.md?raw';
import { PERSONA_TABLE } from '../src/data/personaTable';
import { FAMILY_TAG, FAMILY_TAG_ASK, FAMILY_TAG_PERSONA, ACT_KINDS, APT_KEYS, MAX_DEFINED_CHOICES, MAX_VISIBLE_CHOICES, ROLE_KINDS, TEMPER_IDS, OCCUPATIONS, PARENTING_STYLES, PARENT_WEALTHS, aptTierOf, seedCoefOf } from '../src/core';

/**
 * 설계 문서 ↔ 코드 표 (SPEC-018 PL1·PL2, `docs/data/persona-model.md` 9절): 끝의 「기계 판독 블록」(```persona-table)을 `?raw`로 읽어 파싱하고
 * `src/data/personaTable.ts`의 `PERSONA_TABLE`과 **한 칸씩** 같음을 단언한다 — 값의 정본은 문서 블록이고, 표를 고치면 문서도 같이 고쳐야 통과한다(askDoc.test.ts와 같은 방식).
 * 이어서 표의 번호·이름이 코드의 목록(`TEMPER_IDS`·`APT_KEYS`·`ROLE_KINDS`)과, 표의 모델 값이 코드가 읽는 상수(`MAX_DEFINED_CHOICES`·해시 태그·단계 경계)와 같은지 본다.
 */

type Row = readonly (number | string)[];

function parseBlock(): Record<string, Record<string, Row>> {
  const m = /```persona-table\n([\s\S]*?)```/.exec(docSrc);
  if (m === null) throw new Error('설계 문서에 ```persona-table 블록이 없다');
  const tables: Record<string, Record<string, Row>> = {};
  for (const raw of m[1].split('\n')) {
    const line = raw.trim();
    if (line === '' || line.startsWith('#')) continue;
    const [head, name, values] = line.split('|').map((c) => c.trim());
    const row = values.split(/\s+/).map((x) => (/^-?\d+(\.\d+)?$/.test(x) ? Number(x) : x));
    (tables[head] ??= {})[name] = row;
  }
  return tables;
}

const doc = parseBlock();
const code = PERSONA_TABLE as unknown as Record<string, Record<string, Row>>;

describe('설계 문서 기계 판독 블록 = 코드 표 (personaTable.ts)', () => {
  it('블록의 표 이름 목록이 코드와 같다(표가 한쪽에만 있지 않다)', () => {
    expect(Object.keys(code).sort()).toEqual(Object.keys(doc).sort());
  });

  for (const head of Object.keys(doc)) {
    it(`${head}: 줄 이름·순서·값이 코드와 한 칸씩 같다`, () => {
      expect(Object.keys(code[head])).toEqual(Object.keys(doc[head]));
      for (const [name, row] of Object.entries(doc[head])) expect(code[head][name], `${head} | ${name}`).toEqual(row);
    });
  }

  it('블록은 비어 있지 않다(공허 통과 방지): 표 17개 이상, 줄 130개 이상', () => {
    expect(Object.keys(doc).length).toBeGreaterThanOrEqual(17);
    expect(Object.values(doc).reduce((n, t) => n + Object.keys(t).length, 0)).toBeGreaterThanOrEqual(130);
  });
});

describe('표 ↔ 코드 상수', () => {
  const M = (k: string): readonly (number | string)[] => doc.MODEL[k];

  it('기질·적성·본보기: 표의 번호가 코드 목록의 순서다(저장 `w`·`g`의 순서와 해시 키가 여기에 묶여 있다 — One-way)', () => {
    expect(TEMPER_IDS.map((id) => doc.TEMPER[id]?.[0])).toEqual([0, 1, 2, 3, 4, 5]);
    expect(APT_KEYS.map((k) => doc.APT[k]?.[0])).toEqual([0, 1, 2, 3, 4]);
    expect(ROLE_KINDS.map((k) => doc.ROLE[k]?.[0])).toEqual([1, 2, 3, 4, 5]);
    // 활동 표의 줄 순서는 표마다 다르다(ACT·ACTAPT) — 이름 집합이 코드 목록과 같으면 된다(코드는 이름으로 읽는다)
    expect(Object.keys(doc.ACT).sort()).toEqual([...ACT_KINDS].sort());
    expect(Object.keys(doc.ACTAPT).sort()).toEqual([...ACT_KINDS].sort());
    expect(Object.keys(doc.TP)).toEqual([...TEMPER_IDS]);
    expect(Object.keys(doc.AFF)).toEqual([...TEMPER_IDS]);
  });

  it('열 수: 기질 표는 6칸, 적성 표는 5칸, 성향 표는 5칸, 양육·수저 곱수는 6칸', () => {
    for (const t of ['ACT', 'PATH', 'BORNM', 'BORNN']) for (const [name, row] of Object.entries(doc[t])) expect(row, `${t} | ${name}`).toHaveLength(6);
    for (const t of ['ACTAPT', 'AFF', 'INVEST', 'INVESTMUL']) for (const [name, row] of Object.entries(doc[t])) expect(row, `${t} | ${name}`).toHaveLength(5);
    for (const [name, row] of Object.entries(doc.TP)) expect(row, `TP | ${name}`).toHaveLength(5);
    for (const [name, row] of Object.entries(doc.ADV)) expect(row, `ADV | ${name}`).toHaveLength(3);
  });

  it('수저·양육 방식 행이 코드의 값 목록과 같다', () => {
    for (const t of ['BORNM', 'INVESTMUL', 'DRIFT']) expect(Object.keys(doc[t]).sort(), t).toEqual([...PARENTING_STYLES].sort());
    expect(Object.keys(doc.BORNN)).toEqual(PARENT_WEALTHS.map(String));
    expect(Object.keys(doc.INVEST)).toEqual(PARENT_WEALTHS.map(String));
  });

  it('해시 태그 21 = FAMILY_TAG_PERSONA이고 기존 가족 태그·조르기 태그와 겹치지 않는다', () => {
    expect(M('hashTag')).toEqual([FAMILY_TAG_PERSONA]);
    expect(FAMILY_TAG_PERSONA).toBe(21);
    expect(Object.values(FAMILY_TAG)).not.toContain(FAMILY_TAG_PERSONA);
    expect(FAMILY_TAG_PERSONA).not.toBe(FAMILY_TAG_ASK);
  });

  it('선택지 정의 상한 6 = MAX_DEFINED_CHOICES, 보이는 최대는 3 그대로', () => {
    expect(M('maxDefinedChoices')).toEqual([MAX_DEFINED_CHOICES]);
    expect(MAX_DEFINED_CHOICES).toBe(6);
    expect(MAX_VISIBLE_CHOICES).toBe(3);
  });

  it('적성 단계 경계(35·65)와 싹 계수 표 SEEDCOEF[v=1] = 0.7', () => {
    expect(aptTierOf(34)).toBe('low');
    expect(aptTierOf(35)).toBe('mid');
    expect(aptTierOf(64)).toBe('mid');
    expect(aptTierOf(65)).toBe('high');
    expect(M('tierMid')).toEqual([35]);
    expect(M('tierHigh')).toEqual([65]);
    expect(seedCoefOf(1)).toBe(0.7);
    expect(M('seedCoef')).toEqual([0.7]);
    expect(M('seedCoefByV')).toEqual([1, 0.7]);
    expect(() => seedCoefOf(2)).toThrow();
  });

  it('저장 범위 값: 세기 5~95 · 키움 저장 0~40(성장 상한 30과 별개) · 예산 12 · 지원 9회', () => {
    expect([M('wMin'), M('wMax')]).toEqual([[5], [95]]);
    expect([M('gStoreMax'), M('gMax')]).toEqual([[40], [30]]);
    expect([M('advLifeCap'), M('roleUsedMax'), M('triesMax')]).toEqual([[12], [12], [9]]);
    expect(M('roleStep')[0] as number).toBe(3);
    expect((M('roleLifeCap')[0] as number) * (M('roleStep')[0] as number)).toBe(M('roleUsedMax')[0]);
  });

  it('값 제약(1-3절·2-1절·사다리): 활동 행의 양의 합 ≤ 15 · 음의 합 ≥ −7 · 곱수 범위 · 수저 단조', () => {
    for (const [act, row] of Object.entries(doc.ACT)) {
      const pos = (row as number[]).filter((x) => x > 0).reduce((a, b) => a + b, 0);
      const neg = (row as number[]).filter((x) => x < 0).reduce((a, b) => a + b, 0);
      expect(pos, `${act} 양의 합`).toBeLessThanOrEqual(15);
      expect(neg, `${act} 음의 합`).toBeGreaterThanOrEqual(-7);
      for (const x of row as number[]) expect(Math.abs(x), `${act} 한 칸`).toBeLessThanOrEqual(5);
    }
    for (const [name, row] of Object.entries(doc.BORNM)) for (const x of row as number[]) expect(x, `BORNM ${name}`).toBeGreaterThanOrEqual(0.9), expect(x).toBeLessThanOrEqual(1.15);
    for (const [name, row] of Object.entries(doc.BORNN)) for (const x of row as number[]) expect(x, `BORNN ${name}`).toBeGreaterThanOrEqual(0.95), expect(x).toBeLessThanOrEqual(1.1);
    for (let k = 0; k < APT_KEYS.length; k++) {
      const col = PARENT_WEALTHS.map((w) => (doc.INVEST[String(w)] as number[])[k]);
      expect(col, `INVEST ${APT_KEYS[k]} 수저에 따라 줄지 않는다`).toEqual([...col].sort((a, b) => a - b));
    }
    for (const [name, row] of Object.entries(doc.ADV)) expect((row as number[]).reduce((a, b) => a + b, 0), `ADV ${name} 합`).toBeCloseTo(1, 9);
    for (const [name, row] of Object.entries(doc.PATH)) expect((row as number[]).reduce((a, b) => a + Math.abs(b), 0), `PATH ${name} 한 번 합`).toBeLessThanOrEqual(6);
  });

  it('직업 분야 9종은 그대로다(다음 단계가 쓴다)', () => {
    expect(OCCUPATIONS).toHaveLength(9);
  });
});
