import { describe, expect, it, vi } from 'vitest';
import '../src/data/installAll';
import { FAMILY_TAG, FAMILY_TAG_ASK, askAgeOf, askCloseness, askGrantChance, askRolls, closenessOf, coParentsOf, famHash01, famSeedOf, type AskState, type CoParents, type GameState, type ParentingStyle } from '../src/core';
import { ASK_BASE, ASK_KINDS, ASK_KIND_INFO, ASK_MODEL, type AskKind } from '../src/data/askTable';
import { startLife } from '../scripts/simulateLib';
import { askEvent } from './helpers/askEvents';

/**
 * 조르기 판정 순수 함수 `askGrantChance`·`askRolls` (SPEC-011 AK3 — `docs/data/ask-model.md` 2절, 완료 기준 4·5·6의 코어 부분).
 * 격자: 종류 3 × 재력 5 × 사이 `C` 1~5 × 선택 2. 사이는 `closenessOf`가 정하므로 시드·양육 방식을 바꿔 가며 `C`가 1~5인 상태를 찾는다(찾은 상태가 모든 칸을 덮는지도 단언한다).
 * 해결 경로·사이 비용·자동 모드(AK4~AK6)는 이 파일의 범위가 아니다 — 난수 해시 두 칸과 확률 `p`만 본다.
 */

const BASE_STATE = startLife(7, 'alpha');
const PARENTINGS: readonly ParentingStyle[] = ['neglect', 'strict', 'free', 'helicopter'];
const AGE = 6;
const TOY = askEvent('ask-toy-x', 'toy');
const EV: Record<AskKind, ReturnType<typeof askEvent>> = { toy: TOY, lessons: askEvent('ask-lessons-x', 'lessons'), pet: askEvent('ask-pet-x', 'pet') };

interface Make {
  peerSeed?: number;
  parenting?: ParentingStyle;
  wealth?: 1 | 2 | 3 | 4 | 5;
  flags?: string[];
  age?: number;
  pending?: boolean;
}
const stateOf = ({ peerSeed = 12345, parenting = 'free', wealth = 3, flags = [], age = AGE, pending = true }: Make = {}): GameState => ({
  ...BASE_STATE,
  age,
  flags,
  peerSeed,
  character: { ...BASE_STATE.character!, parenting, parentWealth: wealth },
  pending: pending ? { eventId: 'ask-toy-x', key: `ask-toy-x@${age}`, age, choiceIds: ['beg', 'tantrum', 'endure'] } : null,
});

/** 설계 문서 2-2절 식 그대로 (시험이 독립으로 다시 쓴 것) */
const clamp = (n: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, n));
const expected = (kind: AskKind, wealth: number, c: number, tantrum: boolean): number => clamp(ASK_BASE[kind][wealth - 1] + 0.06 * (c - 3) + (tantrum ? 0.1 : 0), 0.05, 0.95);

/** 독립 계산: 함께 사는 부모 중 가장 가까운 분의 사이 (없으면 3) — DS1 `coParentsOf` + `closenessOf` */
function independentC(s: AskState, age = s.age): { c: number; co: CoParents } {
  const co = coParentsOf(s, age);
  const m = closenessOf({ id: 'mother', role: 'mother' }, s);
  const f = closenessOf({ id: 'father', role: 'father' }, s);
  return { c: co === 'both' ? Math.max(m, f) : co === 'mother' ? m : co === 'father' ? f : 3, co };
}

/** C 1~5가 모두 나오고 함께 사는 부모가 두 분·어머니만·아버지만인 상태를 모은다 (peerSeed × 양육 방식) */
const FOUND = new Map<number, AskState>();
const COSEEN = new Map<CoParents, number>();
for (let seed = 1; seed <= 6000 && (FOUND.size < 5 || COSEEN.size < 3 || [...COSEEN.values()].some((n) => n < 3)); seed++) {
  for (const parenting of PARENTINGS) {
    const s = stateOf({ peerSeed: seed * 7919, parenting });
    const { c, co } = independentC(s);
    if (!FOUND.has(c)) FOUND.set(c, s);
    COSEEN.set(co, (COSEEN.get(co) ?? 0) + 1);
  }
}

describe('AK3 판정 격자 — 종류 × 재력 × 사이 × 선택 (설계 문서 2-2절 식)', () => {
  it('찾은 상태가 사이 1·2·3·4·5를 모두 덮고, 함께 사는 부모가 두 분·어머니만·아버지만인 판을 모두 포함한다', () => {
    expect([...FOUND.keys()].sort()).toEqual([1, 2, 3, 4, 5]);
    expect(COSEEN.get('both')).toBeGreaterThan(0);
    expect(COSEEN.get('mother')).toBeGreaterThan(0);
    expect(COSEEN.get('father')).toBeGreaterThan(0);
    expect(COSEEN.get('none') ?? 0).toBe(0); // 구조상 0건(INV-2c)
  });

  it('askCloseness = 함께 사는 부모 중 가장 가까운 분의 사이 — 독립 계산과 같다 (두 분은 최댓값, 한 분은 그분)', () => {
    let both = 0;
    let one = 0;
    for (let seed = 1; seed <= 800; seed++) {
      for (const parenting of PARENTINGS) {
        const s = stateOf({ peerSeed: seed * 104729, parenting });
        const { c, co } = independentC(s);
        expect(askCloseness(s), `${seed}/${parenting}/${co}`).toBe(c);
        if (co === 'both') both++;
        else one++;
      }
    }
    expect(both).toBeGreaterThan(0);
    expect(one).toBeGreaterThan(0);
  });

  it('p = clamp(BASE[종류][재력] + 0.06 × (C − 3) (+0.10 떼쓰기), 0.05, 0.95) — 3 × 5 × (찾은 C 5개) × 2 전수', () => {
    let cells = 0;
    for (const kind of ASK_KINDS) {
      for (const wealth of [1, 2, 3, 4, 5] as const) {
        for (const [c, s0] of FOUND) {
          const s = { ...s0, character: { ...s0.character!, parentWealth: wealth } };
          expect(askCloseness(s)).toBe(c);
          for (const choice of ['beg', 'tantrum'] as const) {
            expect(askGrantChance(s, EV[kind], choice), `${kind}/W${wealth}/C${c}/${choice}`).toBeCloseTo(expected(kind, wealth, c, choice === 'tantrum'), 12);
            cells++;
          }
        }
      }
    }
    expect(cells).toBe(3 * 5 * 5 * 2);
  });

  it('설계 문서 2-2절 손계산 격자(C = 1·3·5)와 한 칸씩 같다 — 떼쓰기는 같은 칸에 +0.10을 더한 뒤 상·하한 0.05~0.95로 자른다 (강아지 1단계 사이 1 = 0.08 — 「가장 낮은 칸도 떼쓰기까지 하면 약 0.08~0.18」)', () => {
    // 행: 종류 · C → 1~5단계 (조르기). 문서 표를 그대로 옮겼다
    const GRID: Array<[AskKind, number, number[]]> = [
      ['toy', 1, [0.23, 0.38, 0.53, 0.68, 0.78]],
      ['toy', 3, [0.35, 0.5, 0.65, 0.8, 0.9]],
      ['toy', 5, [0.47, 0.62, 0.77, 0.92, 0.95]],
      ['lessons', 1, [0.13, 0.28, 0.43, 0.58, 0.68]],
      ['lessons', 3, [0.25, 0.4, 0.55, 0.7, 0.8]],
      ['lessons', 5, [0.37, 0.52, 0.67, 0.82, 0.92]],
      ['pet', 1, [0.05, 0.08, 0.23, 0.38, 0.53]],
      ['pet', 3, [0.1, 0.2, 0.35, 0.5, 0.65]],
      ['pet', 5, [0.22, 0.32, 0.47, 0.62, 0.77]],
    ];
    expect(expected('pet', 1, 1, true)).toBeCloseTo(0.08, 12);
    for (const [kind, c, row] of GRID) {
      const s0 = FOUND.get(c)!;
      row.forEach((want, i) => {
        const s = { ...s0, character: { ...s0.character!, parentWealth: (i + 1) as 1 | 2 | 3 | 4 | 5 } };
        expect(askGrantChance(s, EV[kind], 'beg'), `${kind}/C${c}/W${i + 1}`).toBeCloseTo(want, 12);
        expect(askGrantChance(s, EV[kind], 'tantrum'), `${kind}/C${c}/W${i + 1} 떼쓰기`).toBeCloseTo(expected(kind, i + 1, c, true), 12);
      });
    }
  });

  it('재력 단조: 사이·종류·선택이 같으면 재력이 오를 때 p가 줄지 않는다 (5단계 − 1단계 ≥ 0.30 — 사이 3 기준)', () => {
    for (const [c, s0] of FOUND) {
      for (const kind of ASK_KINDS) {
        for (const choice of ['beg', 'tantrum'] as const) {
          const ps = ([1, 2, 3, 4, 5] as const).map((w) => askGrantChance({ ...s0, character: { ...s0.character!, parentWealth: w } }, EV[kind], choice));
          for (let i = 1; i < 5; i++) expect(ps[i], `${kind}/C${c}/${choice}/W${i + 1}`).toBeGreaterThanOrEqual(ps[i - 1]);
        }
      }
    }
    const s3 = FOUND.get(3)!;
    for (const kind of ASK_KINDS) {
      const at = (w: 1 | 5) => askGrantChance({ ...s3, character: { ...s3.character!, parentWealth: w } }, EV[kind], 'beg');
      expect(at(5) - at(1), kind).toBeGreaterThanOrEqual(0.3);
    }
  });

  it('사이 단조: 재력·종류·선택이 같으면 사이가 가까울수록 p가 줄지 않는다 (사이 한 단계 = 0.06, 상·하한 안에서)', () => {
    for (const kind of ASK_KINDS) {
      for (const wealth of [1, 2, 3, 4, 5] as const) {
        for (const choice of ['beg', 'tantrum'] as const) {
          const ps = [1, 2, 3, 4, 5].map((c) => askGrantChance({ ...FOUND.get(c)!, character: { ...FOUND.get(c)!.character!, parentWealth: wealth } }, EV[kind], choice));
          for (let i = 1; i < 5; i++) {
            expect(ps[i], `${kind}/W${wealth}/${choice}/C${i + 1}`).toBeGreaterThanOrEqual(ps[i - 1]);
            const raw = ASK_BASE[kind][wealth - 1] + (choice === 'tantrum' ? 0.1 : 0);
            const unclamped = [raw + 0.06 * (i - 2), raw + 0.06 * (i - 3)];
            if (unclamped.every((u) => u > 0.05 && u < 0.95)) expect(ps[i] - ps[i - 1], `${kind}/W${wealth}/${choice}`).toBeCloseTo(0.06, 12);
          }
        }
      }
    }
  });

  it('떼쓰기 = 조르기 + 0.10 (상·하한 안에서) — 조르기보다 낮은 적이 없다', () => {
    for (const kind of ASK_KINDS) {
      for (const wealth of [1, 2, 3, 4, 5] as const) {
        for (const [c, s0] of FOUND) {
          const s = { ...s0, character: { ...s0.character!, parentWealth: wealth } };
          const beg = askGrantChance(s, EV[kind], 'beg');
          const tan = askGrantChance(s, EV[kind], 'tantrum');
          expect(tan, `${kind}/W${wealth}/C${c}`).toBeGreaterThanOrEqual(beg);
          const raw = ASK_BASE[kind][wealth - 1] + 0.06 * (c - 3);
          if (raw >= 0.05 && raw + 0.1 <= 0.95) expect(tan - beg).toBeCloseTo(0.1, 12);
        }
      }
    }
  });

  it('상·하한: 어느 칸에서도 p는 0.05~0.95 안이다 — 확정 거절·확정 승낙이 없다 (하한 0.05는 사이 ≤ 2 강아지 1단계에서만 닿는다)', () => {
    let lowest = 1;
    let highest = 0;
    const floorCells: string[] = [];
    for (const kind of ASK_KINDS) {
      for (const wealth of [1, 2, 3, 4, 5] as const) {
        for (const [c, s0] of FOUND) {
          for (const choice of ['beg', 'tantrum'] as const) {
            const p = askGrantChance({ ...s0, character: { ...s0.character!, parentWealth: wealth } }, EV[kind], choice);
            lowest = Math.min(lowest, p);
            highest = Math.max(highest, p);
            if (p === 0.05) floorCells.push(`${kind}/W${wealth}/C${c}/${choice}`);
          }
        }
      }
    }
    expect(lowest).toBeGreaterThanOrEqual(ASK_MODEL.pMin);
    expect(highest).toBeLessThanOrEqual(ASK_MODEL.pMax);
    expect(lowest).toBe(0.05);
    expect(highest).toBe(0.95);
    // 하한에 닿는 칸은 강아지 1단계 조르기뿐 (사이가 3 아래)
    expect(floorCells.every((x) => x.startsWith('pet/W1/') && x.endsWith('/beg'))).toBe(true);
    expect(floorCells.length).toBeGreaterThan(0);
  });

  it('낙인 방지(G4): 사이 3의 1단계에서 장난감 ≥ 0.30 · 예체능 ≥ 0.20 · 강아지 ≥ 0.10 — 어느 판에서도 「늘 거절」인 칸이 장난감·예체능에 없다', () => {
    const s = { ...FOUND.get(3)!, character: { ...FOUND.get(3)!.character!, parentWealth: 1 as const } };
    expect(askGrantChance(s, EV.toy, 'beg')).toBeGreaterThanOrEqual(0.3);
    expect(askGrantChance(s, EV.lessons, 'beg')).toBeGreaterThanOrEqual(0.2);
    expect(askGrantChance(s, EV.pet, 'beg')).toBeGreaterThanOrEqual(0.1 - 1e-12);
    // 사이가 가장 먼 집(1)의 1단계 장난감·예체능도 조르기만으로 0보다 한참 크다 (0.23·0.13 — 떼쓰기까지 하면 0.33·0.23)
    const s1 = { ...FOUND.get(1)!, character: { ...FOUND.get(1)!.character!, parentWealth: 1 as const } };
    expect(askGrantChance(s1, EV.toy, 'tantrum')).toBeGreaterThanOrEqual(0.3);
    expect(askGrantChance(s1, EV.lessons, 'tantrum')).toBeGreaterThanOrEqual(0.2);
  });

  it('입력은 재력·사이·종류·선택 네 가지뿐 — 직업·부모 나이·성별·이름·지역·형제 순서·집안 살림 잔액·아이의 스탯·외모·달력 연도를 바꿔도 사이(C)가 같으면 p가 같다', () => {
    const base = stateOf({ peerSeed: 99991, parenting: 'strict', wealth: 2 });
    const r = base.birthReport!;
    const mutations: Array<[string, GameState]> = [
      ['외모', { ...base, character: { ...base.character!, looks: 3 } }],
      ['성별', { ...base, character: { ...base.character!, gender: base.character!.gender === 'male' ? 'female' : 'male' } }],
      ['이름', { ...base, character: { ...base.character!, name: '박하늘' } }],
      ['지역', { ...base, birthReport: { ...r, region: r.region === '서울' ? '제주' : '서울' } }],
      ['형제 순서', { ...base, birthReport: { ...r, birthOrder: r.birthOrder === 1 ? 4 : 1 } }],
      ['집안 살림 잔액', { ...base, familyFund: -1200 }],
      ['아이의 스탯', { ...base, stats: { education: 3, health: 3, happiness: 3, relationships: 3 } }],
      ['본 사건', { ...base, seen: { 'some-card': 3 }, lastChoiceAge: 3 }],
      ['대기 카드 id', { ...base, pending: { ...base.pending!, eventId: 'other-card', key: 'other-card@6' } }],
      ['부모 직업', { ...base, birthReport: { ...r, mother: { ...r.mother, job: r.mother.job === 'manager' ? 'labor' : 'manager' }, father: { ...r.father, job: r.father.job === 'agri' ? 'clerk' : 'agri' } } }],
    ];
    for (const kind of ASK_KINDS) {
      for (const choice of ['beg', 'tantrum'] as const) {
        const want = askGrantChance(base, EV[kind], choice);
        for (const [name, m] of mutations) expect(askGrantChance(m, EV[kind], choice), `${name}/${kind}/${choice}`).toBe(want);
      }
    }
    // 부모 나이·출생 연도처럼 가족 계획(별세·이혼)을 바꿀 수 있는 입력은 계획이 바꾼 사이(C)로만 p에 닿는다 — C가 같으면 p가 같고 C가 달라지면 식대로 달라진다
    const planMutations: Array<[string, GameState]> = [
      ['어머니 나이', { ...base, birthReport: { ...r, mother: { ...r.mother, age: r.mother.age + 6 } } }],
      ['아버지 나이', { ...base, birthReport: { ...r, father: { ...r.father, age: r.father.age + 6 } } }],
      ['달력 연도(출생 연도)', { ...base, character: { ...base.character!, birthYear: base.character!.birthYear - 9 } }],
    ];
    for (const [name, m] of planMutations) {
      const c = independentC(m).c;
      for (const kind of ASK_KINDS) expect(askGrantChance(m, EV[kind], 'beg'), `${name}/${kind}`).toBeCloseTo(expected(kind, 2, c, false), 12);
    }
  });

  it('양육 방식은 사이로만 들어간다 — 방임·엄격·자유·헬리콥터가 같은 사이로 나오면 같은 p이고, 다른 사이면 식대로 다르다', () => {
    const byC = new Map<number, number[]>();
    for (const parenting of PARENTINGS) {
      for (let seed = 1; seed <= 300; seed++) {
        const s = stateOf({ peerSeed: seed * 31, parenting, wealth: 4 });
        const c = askCloseness(s);
        const p = askGrantChance(s, TOY, 'beg');
        byC.set(c, [...(byC.get(c) ?? []), p]);
        expect(p).toBeCloseTo(expected('toy', 4, c, false), 12);
      }
    }
    for (const [c, ps] of byC) expect(new Set(ps.map((p) => p.toFixed(12))).size, `C${c}`).toBe(1);
  });

  it('흘러간 상태에서도 읽는다: 대기 카드가 없으면 지금 나이를 쓴다 (pending.age 우선)', () => {
    const s = stateOf({ pending: false, age: 8 });
    expect(askAgeOf(s)).toBe(8);
    expect(askAgeOf(stateOf({ age: 6 }))).toBe(6);
    expect(askAgeOf({ ...stateOf({ age: 8 }), pending: { eventId: 'x', key: 'x@5', age: 5, choiceIds: ['beg', 'tantrum'] } })).toBe(5);
  });

  it('참는다(endure)·조르기 사건이 아닌 사건·출생 전 상태는 확률을 묻지 못한다 (throw)', () => {
    const s = stateOf();
    expect(() => askGrantChance(s, TOY, 'endure' as unknown as 'beg')).toThrow('조른다');
    const { ask: _ask, ...plain } = TOY as typeof TOY & { ask?: unknown };
    void _ask;
    expect(() => askGrantChance(s, plain as unknown as typeof TOY, 'beg')).toThrow('조르기 사건이 아니다');
    expect(() => askRolls(s, plain as unknown as typeof TOY)).toThrow('조르기 사건이 아니다');
    expect(() => askGrantChance({ ...s, character: null }, TOY, 'beg')).toThrow();
  });
});

describe('AK3 해시 난수 — 진행 RNG를 쓰지 않는다 (결정 K5, 설계 문서 2-3절)', () => {
  it('값은 famHash01(가족 시드, 20, 종류 번호, 나이×2+칸) 그대로다 — u1은 칸 0, u2는 칸 1', () => {
    for (const kind of ASK_KINDS) {
      for (const age of [4, 5, 9, 12]) {
        const s = stateOf({ peerSeed: 424242, age });
        const { u1, u2 } = askRolls(s, EV[kind]);
        const fam = famSeedOf(424242);
        expect(u1).toBe(famHash01(fam, 20, ASK_KIND_INFO[kind].no, age * 2));
        expect(u2).toBe(famHash01(fam, 20, ASK_KIND_INFO[kind].no, age * 2 + 1));
        expect(u1).toBeGreaterThanOrEqual(0);
        expect(u1).toBeLessThan(1);
        expect(u2).toBeGreaterThanOrEqual(0);
        expect(u2).toBeLessThan(1);
      }
    }
    expect(ASK_KINDS.map((k) => ASK_KIND_INFO[k].no)).toEqual([1, 2, 3]);
  });

  it('peerSeed가 없으면 판 시드를 쓴다 (가족 계획과 같다)', () => {
    const s = { ...stateOf(), peerSeed: null };
    expect(askRolls(s, TOY).u1).toBe(famHash01(famSeedOf(s.seed), 20, 1, AGE * 2));
  });

  it('새 해시 태그 20은 기존 FAMILY_TAG와 겹치지 않고 마지막 태그(SIB_LOSS = 19) 다음이다 — FAMILY_TAG 객체 밖에 둔 이유는 familyModel.ts 주석', () => {
    expect(FAMILY_TAG_ASK).toBe(20);
    expect(Object.values(FAMILY_TAG)).not.toContain(FAMILY_TAG_ASK);
    expect(FAMILY_TAG_ASK).toBe(Math.max(...Object.values(FAMILY_TAG)) + 1);
    expect(ASK_MODEL.closeStep).toBe(0.06);
  });

  it('같은 상태 → 같은 값 (결정성). 새로고침·다시 계산해도 같고, 사건 id가 달라도 같은 종류면 같다 (사건 번호가 아니라 종류 번호)', () => {
    const s = stateOf({ peerSeed: 777 });
    const a = askRolls(s, TOY);
    expect(askRolls(JSON.parse(JSON.stringify(s)) as AskState, TOY)).toEqual(a);
    expect(askRolls(s, askEvent('ask-toy-zzz', 'toy'))).toEqual(a);
    expect(askGrantChance(s, askEvent('ask-toy-zzz', 'toy'), 'beg')).toBe(askGrantChance(s, TOY, 'beg'));
  });

  it('종류·나이·판 시드가 다르면 값이 다르다 (한 종류는 나이마다 한 번)', () => {
    const s = stateOf({ peerSeed: 777 });
    const seen = new Set<string>();
    for (const kind of ASK_KINDS) for (const age of [4, 5, 6, 7, 8, 9, 10, 11, 12]) seen.add(askRolls({ ...s, age, pending: { ...s.pending!, age } }, EV[kind]).u1.toFixed(15));
    expect(seen.size).toBe(27);
    expect(askRolls(stateOf({ peerSeed: 778 }), TOY).u1).not.toBe(askRolls(s, TOY).u1);
  });

  it('진행 RNG·시각·Math.random을 읽거나 쓰지 않는다 — 상태가 그대로이고(rngState 포함) 난수·시각 함수가 불리지 않는다', () => {
    const s = stateOf();
    const before = JSON.stringify(s);
    const rnd = vi.spyOn(Math, 'random');
    const now = vi.spyOn(Date, 'now');
    try {
      for (const kind of ASK_KINDS) {
        askRolls(s, EV[kind]);
        askGrantChance(s, EV[kind], 'beg');
        askGrantChance(s, EV[kind], 'tantrum');
        askCloseness(s);
      }
      expect(rnd).not.toHaveBeenCalled();
      expect(now).not.toHaveBeenCalled();
    } finally {
      rnd.mockRestore();
      now.mockRestore();
    }
    expect(JSON.stringify(s)).toBe(before);
    expect(s.rngState).toBe(BASE_STATE.rngState);
  });

  it('u1은 조르기·떼쓰기가 공유한다 — 「조른다가 들어줌이면 떼쓰기도 들어줌」이 모든 칸·모든 시드에서 성립한다', () => {
    let begGranted = 0;
    let tantrumOnly = 0;
    for (let seed = 1; seed <= 1500; seed++) {
      for (const kind of ASK_KINDS) {
        const s = stateOf({ peerSeed: seed * 13, parenting: PARENTINGS[seed % 4], wealth: ((seed % 5) + 1) as 1 | 2 | 3 | 4 | 5, age: 4 + (seed % 9) });
        const { u1 } = askRolls(s, EV[kind]);
        const beg = u1 < askGrantChance(s, EV[kind], 'beg');
        const tan = u1 < askGrantChance(s, EV[kind], 'tantrum');
        if (beg) {
          begGranted++;
          expect(tan, `${seed}/${kind}`).toBe(true);
        }
        if (tan && !beg) tantrumOnly++;
      }
    }
    expect(begGranted).toBeGreaterThan(0);
    expect(tantrumOnly).toBeGreaterThan(0); // 떼쓰기만 들어주는 구간(+0.10)이 실제로 있다
  });

  it('u1·u2는 서로 독립이고 [0,1)에 고르게 퍼진다 (표본 6000 — 상관 |r| < 0.05, 평균 0.5 ± 0.02, 사분위 칸 ±10%)', () => {
    const n = 6000;
    const u1s: number[] = [];
    const u2s: number[] = [];
    for (let i = 1; i <= n; i++) {
      const s = stateOf({ peerSeed: i * 2654435 + 17, age: 4 + (i % 9) });
      const r = askRolls(s, EV[ASK_KINDS[i % 3]]);
      u1s.push(r.u1);
      u2s.push(r.u2);
    }
    const mean = (a: number[]) => a.reduce((x, y) => x + y, 0) / a.length;
    const m1 = mean(u1s);
    const m2 = mean(u2s);
    let cov = 0;
    let v1 = 0;
    let v2 = 0;
    for (let i = 0; i < n; i++) {
      cov += (u1s[i] - m1) * (u2s[i] - m2);
      v1 += (u1s[i] - m1) ** 2;
      v2 += (u2s[i] - m2) ** 2;
    }
    expect(Math.abs(cov / Math.sqrt(v1 * v2))).toBeLessThan(0.05);
    expect(m1).toBeGreaterThan(0.48);
    expect(m1).toBeLessThan(0.52);
    expect(m2).toBeGreaterThan(0.48);
    expect(m2).toBeLessThan(0.52);
    for (const us of [u1s, u2s]) {
      const bins = [0, 0, 0, 0];
      for (const u of us) bins[Math.min(3, Math.floor(u * 4))]++;
      for (const b of bins) expect(Math.abs(b / n - 0.25)).toBeLessThan(0.025);
    }
  });

  it('실측 들어줌 비율이 식의 기대값과 4σ 안이다 — 시드·양육 방식·재력·나이를 흩뿌린 4000판에서 (u1 < p)의 개수 대 p의 합 (해시와 확률이 한 몸으로 맞물린다)', () => {
    const n = 4000;
    for (const choice of ['beg', 'tantrum'] as const) {
      let granted = 0;
      let mean = 0;
      let variance = 0;
      for (let i = 1; i <= n; i++) {
        const s = stateOf({ peerSeed: i * 2654435 + 3, parenting: PARENTINGS[i % 4], wealth: ((i % 5) + 1) as 1 | 2 | 3 | 4 | 5, age: 4 + (i % 9) });
        const kind = ASK_KINDS[i % 3];
        const p = askGrantChance(s, EV[kind], choice);
        if (askRolls(s, EV[kind]).u1 < p) granted++;
        mean += p;
        variance += p * (1 - p);
      }
      expect(Math.abs(granted - mean), choice).toBeLessThan(4 * Math.sqrt(variance));
    }
  });
});
