import { describe, expect, it } from 'vitest';
import docSrc from '../docs/data/ask-model.md?raw';
import { ASK_BASE, ASK_EFFECTS, ASK_KINDS, ASK_KIND_INFO, ASK_MODEL, ASK_WEIGHT_LADDER, type AskEffectKey, type AskKind } from '../src/data/askTable';
import { FAMILY_TAG_ASK } from '../src/core';

/**
 * 설계 문서 ↔ 코드 표 (SPEC-011 AK2·AK3, 설계 문서 12절 `tests/askDoc.test.ts`): `docs/data/ask-model.md` 12절 끝의 「기계 판독 블록」(```ask-table)을 `?raw`로 읽어 파싱하고
 * `src/data/askTable.ts`의 `BASE`·`MODEL`·`KIND`·`EFFECT` 줄과 한 칸씩 같음을 단언한다 — 표를 고치면 문서도 같이 고쳐야 통과한다 (parentDecisionDoc.test.ts·economyConversion.test.ts와 같은 방식).
 * **`EVENT` 줄(사건 9개)은 사건 데이터가 들어오는 AK7에서 대조한다** — 지금은 사건 데이터가 없어 이 파일은 줄 모양과 가중이 사다리 안인지만 본다(사건 id·가중·나이의 대조는 AK7 시험 몫).
 */

type Cells = string[];

function block(): Cells[] {
  const m = /```ask-table\n([\s\S]*?)```/.exec(docSrc);
  if (m === null) throw new Error('설계 문서에 ```ask-table 블록이 없다');
  return m[1]
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l !== '' && !l.startsWith('#'))
    .map((l) => l.split('|').map((c) => c.trim()));
}

const rows = block();
const of = (head: string): Cells[] => rows.filter((r) => r[0] === head);

const parseStats = (cell: string): Record<string, number> => (cell === '-' ? {} : Object.fromEntries(cell.split(',').map((kv) => kv.split(':')).map(([k, v]) => [k, Number(v)])));

describe('설계 문서 기계 판독 블록 = 코드 표 (askTable.ts)', () => {
  it('BASE: 종류 3줄, 1~5단계 값이 코드와 같다', () => {
    const base = of('BASE');
    expect(base.map((r) => r[1])).toEqual([...ASK_KINDS]);
    for (const r of base) expect(r[2].split(/\s+/).map(Number), r[1]).toEqual([...ASK_BASE[r[1] as AskKind]]);
  });

  it('MODEL: 계수 9개가 코드와 같고 해시 태그가 FAMILY_TAG_ASK다', () => {
    const model = Object.fromEntries(of('MODEL').map((r) => [r[1], Number(r[2])]));
    const { hashTag, ...coefficients } = model;
    expect(coefficients).toEqual({ ...ASK_MODEL });
    expect(hashTag).toBe(FAMILY_TAG_ASK);
    expect(Object.keys(model).sort()).toEqual([...Object.keys(ASK_MODEL), 'hashTag'].sort());
  });

  it('KIND: 해시 번호와 나이 한계가 코드와 같다', () => {
    const kinds = of('KIND');
    expect(kinds.map((r) => r[1])).toEqual([...ASK_KINDS]);
    for (const r of kinds) expect({ no: Number(r[2]), ageMin: Number(r[3]), ageMax: Number(r[4]) }, r[1]).toEqual(ASK_KIND_INFO[r[1] as AskKind]);
  });

  it('EFFECT: 갈래 7줄의 스탯·집안 살림·플래그가 ASK_EFFECTS와 한 글자도 다르지 않다', () => {
    const effects = of('EFFECT');
    expect(effects.map((r) => r[1])).toEqual(Object.keys(ASK_EFFECTS));
    for (const r of effects) {
      const code = ASK_EFFECTS[r[1] as AskEffectKey];
      expect(parseStats(r[2]), `${r[1]} stats`).toEqual(code.stats ?? {});
      expect(Number(r[3]), `${r[1]} family`).toBe(code.family ?? 0);
      expect(r[4] === '-' ? [] : [r[4]], `${r[1]} flags`).toEqual(code.setFlags ?? []);
    }
  });

  it('EVENT: 9줄 — 종류가 알려진 값이고 가중이 사다리 안이다 (사건 데이터와의 대조는 AK7), 종류별 가중은 60·55·30 (AK10 실측 조정 — 반려동물이 꺼진 이번 배포의 장난감·예체능은 사다리 위쪽, 설계 문서 1-3절 「가중 조정 기록」)', () => {
    const events = of('EVENT');
    expect(events).toHaveLength(9);
    expect(new Set(events.map((r) => r[1])).size).toBe(9);
    const weightByKind: Record<string, number> = { toy: 60, lessons: 55, pet: 30 };
    for (const r of events) {
      const kind = r[2] as AskKind;
      expect(ASK_KINDS).toContain(kind);
      const w = Number(r[7]);
      expect(w, r[1]).toBe(weightByKind[kind]);
      expect(w, r[1]).toBeGreaterThanOrEqual(ASK_WEIGHT_LADDER[kind].min);
      expect(w, r[1]).toBeLessThanOrEqual(ASK_WEIGHT_LADDER[kind].max);
      expect(Number(r[5]), r[1]).toBeGreaterThanOrEqual(ASK_KIND_INFO[kind].ageMin);
      expect(Number(r[6]), r[1]).toBeLessThanOrEqual(ASK_KIND_INFO[kind].ageMax);
    }
    expect(events.filter((r) => r[2] === 'toy')).toHaveLength(4);
    expect(events.filter((r) => r[2] === 'lessons')).toHaveLength(3);
    expect(events.filter((r) => r[2] === 'pet')).toHaveLength(2);
  });

  it('변이 점검: 문서 블록의 한 칸을 바꾸면 이 대조가 실패한다 (공허 통과 방지)', () => {
    const toy = of('BASE').find((r) => r[1] === 'toy')!;
    const doctored = toy[2].split(/\s+/).map(Number);
    doctored[0] += 0.05;
    expect(doctored).not.toEqual([...ASK_BASE.toy]);
    const strained = of('EFFECT').find((r) => r[1] === 'strained')!;
    expect(parseStats(strained[2].replace('relationships:-1', 'relationships:-2'))).not.toEqual(ASK_EFFECTS.strained.stats);
  });
});

describe('설계 문서의 값 불변식 (2-2·3-1·11절)', () => {
  it('재력 단조 비감소 · 같은 칸에서 장난감 ≥ 예체능 ≥ 강아지 · 5단계−1단계 ≥ 0.30 · 사이 3의 1단계 하한', () => {
    for (const k of ASK_KINDS) {
      const b = ASK_BASE[k];
      for (let i = 1; i < 5; i++) expect(b[i], `${k}/${i}`).toBeGreaterThanOrEqual(b[i - 1]);
      expect(b[4] - b[0], k).toBeGreaterThanOrEqual(0.3);
    }
    for (let i = 0; i < 5; i++) {
      expect(ASK_BASE.toy[i]).toBeGreaterThanOrEqual(ASK_BASE.lessons[i]);
      expect(ASK_BASE.lessons[i]).toBeGreaterThanOrEqual(ASK_BASE.pet[i]);
    }
    expect(ASK_BASE.toy[0]).toBeGreaterThanOrEqual(0.3);
    expect(ASK_BASE.lessons[0]).toBeGreaterThanOrEqual(0.2);
    expect(ASK_BASE.pet[0]).toBeGreaterThanOrEqual(0.1);
  });

  it('효과 순서 불변식(11절 4번): 참는다 행복 > 거절(조른다) 행복 ≥ 거절(떼쓴다) 행복 · 들어줌의 행복 > 0 · 사이 나빠짐 갈래는 관계 < 0 · 사이 나빠짐 플래그는 그 갈래만 켠다', () => {
    const h = (k: AskEffectKey): number => ASK_EFFECTS[k].stats?.happiness ?? 0;
    expect(h('endure')).toBeGreaterThan(h('denied-beg'));
    expect(h('denied-beg')).toBeGreaterThanOrEqual(h('denied-tantrum'));
    for (const k of ['granted-toy', 'granted-lessons', 'granted-pet'] as const) expect(h(k), k).toBeGreaterThan(0);
    expect(ASK_EFFECTS.strained.stats?.relationships ?? 0).toBeLessThan(0);
    const flagged = (Object.keys(ASK_EFFECTS) as AskEffectKey[]).filter((k) => (ASK_EFFECTS[k].setFlags ?? []).includes('parent_strained'));
    expect(flagged).toEqual(['strained']);
    expect((Object.keys(ASK_EFFECTS) as AskEffectKey[]).filter((k) => (ASK_EFFECTS[k].setFlags ?? []).includes('pet_dog'))).toEqual(['granted-pet']);
  });

  it('효과 한도: 한 스탯 ±50 · 집안 살림 ±3000 안이고(R-046) 20세 미만 이벤트 문법(family)을 쓴다', () => {
    for (const e of Object.values(ASK_EFFECTS)) {
      for (const d of Object.values(e.stats ?? {})) expect(Math.abs(d)).toBeLessThanOrEqual(50);
      expect(Math.abs(e.family ?? 0)).toBeLessThanOrEqual(3000);
      expect(e.assets).toBeUndefined();
    }
  });
});
