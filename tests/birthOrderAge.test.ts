import birthReportSrc from '../src/core/birthReport.ts?raw';
import familySrc from '../src/core/family.ts?raw';
import { describe, expect, it } from 'vitest';
import {
  MAX_OLDER_SIBLINGS as FAMILY_MAX_OLDER,
  MIN_FIRST_BIRTH_AGE as FAMILY_MIN_FIRST,
  SIBLING_GAP as FAMILY_SIBLING_GAP,
  birthSentence,
  createRng,
  familyOf,
  generateBirth,
  mixSeed,
  rollParentAges,
  type ProfileId,
  type ParentWealth,
  type Rng,
} from '../src/core';
import {
  ERA_REPORT_ADJUST,
  FATHER_GAP,
  MAX_OLDER_SIBLINGS,
  MIN_FIRST_BIRTH_AGE,
  PARENT_AGE_LIMITS,
  SIBLING_GAP,
  THIRD_PLUS_SPLIT,
  minMotherAgeForOrder,
  olderSiblingLimit,
  olderSiblingsOf,
} from '../src/data/birthReportTable';
import { getBirthStats } from '../src/data/birthStats';
import { codeOnly } from './helpers/code';
import { EPS, sigmaTolerancePct } from './helpers/stats';
import { SIM_PROFILES } from '../scripts/simulateLib';
import type { ReportTilt } from '../src/data/birthReportTable';

/** 부모 나이·형제 순서 보정의 두 갈래(SPEC-004 NR3 — 1989년 이전 출생 `past` · 1990년 이후 `present`; 옛 「다가올 세상」 갈래는 없어졌다) */
const ERAS: readonly ReportTilt[] = ['past', 'present'];
type Era = ReportTilt;
/** 출생 생성기 시험의 세대 표본: 산업화·X(1989년 이전 갈래) · 알파(1990년 이후 갈래) */
const tiltOfProfile = (p: ProfileId): ReportTilt => (p === 'alpha' ? 'present' : 'past');

/**
 * 출생 순서 ↔ 어머니 나이 정합 (SPEC-003 BR6·CM9, REV-003-M4-1 R-330 r3, 마스터 결정: **생성기를 고친다**).
 * 위 형제 수 ≤ ⌊(어머니 나이 − 16) / 2⌋ — 최소 첫 출산 나이 16·형제마다 최소 터울 2년. 출생 생성기(core/birthReport.ts#rollParentAges)와 식구 카드(core/family.ts#familyOf)가
 * 같은 상수(data/birthReportTable.ts)를 쓴다. 형제 순서를 먼저 뽑고 어머니 나이를 그 순서가 가능한 나이로 제한(조건부 재추첨)하므로 **공표 출산 순위 비중은 그대로**다.
 */

const WORDS = ['첫째', '둘째', '셋째', '넷째', '다섯째 이상'] as const; // 출생신고 문장의 형제 순서 낱말 (구현의 표를 읽지 않고 따로 적었다)
const ORDER_RE = /(첫째|둘째|셋째|넷째|다섯째 이상)입니다\./;
const model = getBirthStats().parentAges;
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
const bucketOf = (order: number): 0 | 1 | 2 => (order >= 3 ? 2 : ((order - 1) as 0 | 1));
const WEALTHS: ParentWealth[] = [1, 2, 3, 4, 5];

/** 이 오름차순 순서를 따르는 가짜 RNG: weightedIndex가 받은 가중치를 기록하고 정해 둔 인덱스를 돌려준다 */
function scripted(picks: number[]): { rng: Rng; calls: number[][] } {
  const calls: number[][] = [];
  const rng = {
    next: () => 0,
    int: () => 0,
    pick: () => {
      throw new Error('쓰지 않는다');
    },
    weightedIndex: (w: readonly number[]) => {
      calls.push([...w]);
      return picks[calls.length - 1];
    },
    getState: () => 0,
  } as Rng;
  return { rng, calls };
}

describe('상수·함수 한 곳 (R-330 r3: 생성기와 식구 카드가 같은 규칙을 쓴다)', () => {
  it('olderSiblingLimit = ⌊(어머니 나이 − 16) / 2⌋: 16·17세 0, 18세 1 … 24세 4, 56세 20 (음수 방어 포함)', () => {
    const table: Array<[number, number]> = [[10, 0], [15, 0], [16, 0], [17, 0], [18, 1], [19, 1], [20, 2], [22, 3], [23, 3], [24, 4], [25, 4], [40, 12], [56, 20]];
    for (const [age, limit] of table) expect(olderSiblingLimit(age), `어머니 ${age}세`).toBe(limit);
  });

  it('olderSiblingsOf: N째이면 위로 N−1명, 다섯째 이상은 4명 (0·음수·6 이상도 안전)', () => {
    expect([0, 1, 2, 3, 4, 5, 6, 9].map(olderSiblingsOf)).toEqual([0, 0, 1, 2, 3, 4, 4, 4]);
  });

  it('minMotherAgeForOrder: 첫째 16·둘째 18·셋째 20·넷째 22·다섯째 이상 24 — 직접 적은 표', () => {
    expect([1, 2, 3, 4, 5].map(minMotherAgeForOrder)).toEqual([16, 18, 20, 22, 24]);
  });

  it('두 함수는 서로 역이다: (위 형제 수 ≤ 한도) ⇔ (어머니 나이 ≥ 순서의 최소 나이) — 모든 어머니 나이 × 형제 순서', () => {
    for (let age = PARENT_AGE_LIMITS.min; age <= PARENT_AGE_LIMITS.max; age++) {
      for (let order = 1; order <= 5; order++) {
        expect(olderSiblingsOf(order) <= olderSiblingLimit(age), `어머니 ${age}세 ${order}째`).toBe(age >= minMotherAgeForOrder(order));
      }
    }
  });

  it('식구 카드(family.ts)가 내보내는 상수는 생성기가 쓰는 표의 상수와 같은 객체다 — 한쪽만 바뀔 수 없다', () => {
    expect(FAMILY_SIBLING_GAP).toBe(SIBLING_GAP);
    expect(FAMILY_MAX_OLDER).toBe(MAX_OLDER_SIBLINGS);
    expect(FAMILY_MIN_FIRST).toBe(MIN_FIRST_BIRTH_AGE);
    expect(MIN_FIRST_BIRTH_AGE).toBe(PARENT_AGE_LIMITS.min);
    expect(SIBLING_GAP).toEqual({ min: 2, max: 5 });
    expect(MAX_OLDER_SIBLINGS).toBe(4);
  });

  it('두 소스가 같은 규칙을 따로 다시 적지 않는다: 생성기는 minMotherAgeForOrder를, 식구 카드는 olderSiblingLimit·olderSiblingsOf를 표에서 가져다 쓴다', () => {
    const gen = codeOnly(birthReportSrc);
    const fam = codeOnly(familySrc);
    expect(gen).toMatch(/minMotherAgeForOrder\(order\)/);
    expect(fam).toMatch(/olderSiblingLimit\(report\.mother\.age\)/);
    expect(fam).toMatch(/olderSiblingsOf\(report\.birthOrder\)/);
    for (const [name, code] of [['birthReport.ts', gen], ['family.ts', fam]] as const) {
      expect(code, `${name}가 나이 차 범위를 새로 정의`).not.toMatch(/(const|let)\s+SIBLING_GAP\b/);
      expect(code, `${name}가 위 형제 상한을 새로 정의`).not.toMatch(/(const|let)\s+MAX_OLDER_SIBLINGS\b/);
      expect(code, `${name}가 최소 첫 출산 나이를 새로 정의`).not.toMatch(/(const|let)\s+MIN_FIRST_BIRTH_AGE\b/);
    }
  });
});

describe('rollParentAges: 형제 순서가 가능한 어머니 나이만 만든다 (조건부 재추첨)', () => {
  const mAt = (age: number) => age - model.motherMin; // 어머니 확률표의 인덱스

  it('첫 추첨이 맞으면 한 번만 뽑는다(어머니 한 번 + 아버지 한 번), 가중치는 모델 그대로', () => {
    const { rng, calls } = scripted([mAt(30), 7]);
    const r = rollParentAges(rng, 'present', 3, 1, 2); // 둘째(가능한 최소 18세), 어머니 30세
    expect(calls).toHaveLength(2);
    expect(calls[0]).toEqual(model.motherGiven[1][2]);
    expect(calls[1]).toEqual(model.fatherGivenMother[30 - model.motherMin]);
    expect(r).toEqual({ mother: 30, father: model.fatherMin + 7 });
  });

  it('둘째가 어머니 16세로 뽑히면 불가능한 나이(18세 미만)의 가중치를 0으로 두고 한 번 더 뽑는다', () => {
    const { rng, calls } = scripted([mAt(16), mAt(31), 3]);
    const r = rollParentAges(rng, 'present', 3, 1, 2);
    expect(calls).toHaveLength(3);
    expect(calls[0]).toEqual(model.motherGiven[1][2]);
    calls[1].forEach((w, i) => expect(w, `${model.motherMin + i}세`).toBe(model.motherMin + i < 18 ? 0 : model.motherGiven[1][2][i]));
    expect(calls[1].some((w) => w > 0)).toBe(true);
    expect(r.mother).toBe(31);
    expect(calls[2]).toEqual(model.fatherGivenMother[31 - model.motherMin]); // 아버지는 다시 뽑은 어머니의 조건부 분포에서
  });

  it('경계: 둘째 18세는 맞고 17세는 어긋난다 / 다섯째 이상은 24세부터 (지금 세상)', () => {
    const s18 = scripted([mAt(18), 0]);
    expect(rollParentAges(s18.rng, 'present', 3, 1, 2).mother).toBe(18);
    expect(s18.calls).toHaveLength(2);
    const s17 = scripted([mAt(17), mAt(40), 0]);
    expect(rollParentAges(s17.rng, 'present', 3, 1, 2).mother).toBe(40);
    expect(s17.calls).toHaveLength(3);
    const s23 = scripted([mAt(23), mAt(41), 0]);
    expect(rollParentAges(s23.rng, 'present', 3, 2, 5).mother).toBe(41);
    expect(s23.calls[1].filter((w, i) => w > 0 && model.motherMin + i < 24)).toHaveLength(0);
    const s24 = scripted([mAt(24), 0]);
    expect(rollParentAges(s24.rng, 'present', 3, 2, 5).mother).toBe(24);
    expect(s24.calls).toHaveLength(2);
  });

  it('시대 보정을 더한 뒤의 나이로 판단한다: 지난 세상(−6)은 보정 전 24세부터 둘째가 가능하고, 첫째는 16세 아래로 잘려도 맞다', () => {
    const past = ERA_REPORT_ADJUST.past.parentAgeShift;
    expect(past).toBe(-6);
    // 보정 전 23세 → 최종 17세: 둘째에게는 어긋난다 → 보정 전 24세 미만이 0
    const s = scripted([mAt(23), mAt(35), 0]);
    expect(rollParentAges(s.rng, 'past', 3, 1, 2).mother).toBe(29);
    expect(s.calls).toHaveLength(3);
    s.calls[1].forEach((w, i) => expect(w, `보정 전 ${model.motherMin + i}세`).toBe(model.motherMin + i < 24 ? 0 : model.motherGiven[1][2][i]));
    // 보정 전 24세 → 최종 18세: 둘째에게 맞는다(재추첨 없음)
    const ok = scripted([mAt(24), 0]);
    expect(rollParentAges(ok.rng, 'past', 3, 1, 2).mother).toBe(18);
    expect(ok.calls).toHaveLength(2);
    // 첫째: 보정 전 16세 → 최종 10 → 16세로 맞춰짐, 재추첨 없음
    const first = scripted([mAt(16), 0]);
    expect(rollParentAges(first.rng, 'past', 3, 0, 1).mother).toBe(PARENT_AGE_LIMITS.min);
    expect(first.calls).toHaveLength(2);
  });

  it('order를 안 주면 첫째로 본다(제한 없음): 어머니 16세도 그대로', () => {
    const { rng, calls } = scripted([0, 0]);
    expect(rollParentAges(rng, 'present', 1, 0).mother).toBe(model.motherMin);
    expect(calls).toHaveLength(2);
  });

  it('모든 (시대 × 형제 순서 × 수저 단계) 칸에 가능한 나이가 있다 — 재추첨 가중치 합이 0이 되어 던지는 일이 없다', () => {
    for (const era of ERAS) {
      const shift = ERA_REPORT_ADJUST[era].parentAgeShift;
      for (let order = 1; order <= 5; order++) {
        for (const w of WEALTHS) {
          const weights = model.motherGiven[bucketOf(order)][w - 1];
          const feasible = weights.reduce((acc, p, i) => (clamp(model.motherMin + i + shift, PARENT_AGE_LIMITS.min, PARENT_AGE_LIMITS.max) >= minMotherAgeForOrder(order) ? acc + p : acc), 0);
          expect(feasible, `${era} ${order}째 ${w}단계: 가능한 나이의 확률`).toBeGreaterThan(0.5);
        }
      }
    }
  });

  it('대량 추첨(갈래 2 × 순서 5 × 수저 5 × 400): 어머니 최종 나이 ≥ 순서의 최소 나이, 허용 범위·아버지 나이 차 안, 아버지는 다시 뽑은 어머니의 조건부 분포', () => {
    let n = 0;
    for (const era of ERAS) {
      for (let order = 1; order <= 5; order++) {
        for (const w of WEALTHS) {
          for (let i = 0; i < 400; i++) {
            const rng = createRng(mixSeed(order * 1000 + w * 10 + ERAS.indexOf(era), i));
            const r = rollParentAges(rng, era, w, bucketOf(order), order);
            const at = `${era} ${order}째 ${w}단계 #${i}`;
            expect(r.mother, at).toBeGreaterThanOrEqual(minMotherAgeForOrder(order));
            expect(olderSiblingsOf(order), at).toBeLessThanOrEqual(olderSiblingLimit(r.mother));
            expect(r.mother, at).toBeLessThanOrEqual(PARENT_AGE_LIMITS.max);
            expect(r.father - r.mother, at).toBeGreaterThanOrEqual(FATHER_GAP.min);
            expect(r.father - r.mother, at).toBeLessThanOrEqual(FATHER_GAP.max);
            n++;
          }
        }
      }
    }
    expect(n).toBe(ERAS.length * 5 * 5 * 400);
  });

  /** 예전 구현(순서를 몰랐다) 그대로 — 첫 추첨이 맞은 판은 새 구현과 같고 난수 소비도 같아야 한다 */
  function legacy(rng: Rng, era: Era, wealth: ParentWealth, bucket: 0 | 1 | 2): { mother: number; father: number } {
    const mother = model.motherMin + rng.weightedIndex(model.motherGiven[bucket][wealth - 1]);
    const father = model.fatherMin + rng.weightedIndex(model.fatherGivenMother[mother - model.motherMin]);
    const shift = ERA_REPORT_ADJUST[era].parentAgeShift;
    return { mother: clamp(mother + shift, PARENT_AGE_LIMITS.min, PARENT_AGE_LIMITS.max), father: clamp(father + shift, PARENT_AGE_LIMITS.min, PARENT_AGE_LIMITS.max) };
  }

  it('예전 구현과 대조: 예전 결과가 순서에 맞는 판은 결과와 난수 소비가 그대로이고, 어긋난 판만 한 번 더 뽑아 맞는 나이로 바뀐다', () => {
    const stat: Record<string, { same: number; fixed: number }> = {};
    for (const era of ERAS) {
      stat[era] = { same: 0, fixed: 0 };
      for (let order = 1; order <= 5; order++) {
        for (const w of WEALTHS) {
          for (let i = 0; i < 600; i++) {
            const seed = mixSeed(0xabc00 + order * 100 + w, i + 1000 * ERAS.indexOf(era));
            const a = createRng(seed);
            const b = createRng(seed);
            const before = legacy(a, era, w, bucketOf(order));
            const after = rollParentAges(b, era, w, bucketOf(order), order);
            if (before.mother >= minMotherAgeForOrder(order)) {
              expect(after, `${era} ${order}째 ${w}단계 #${i}`).toEqual(before);
              expect(b.getState(), '난수 소비도 같다').toBe(a.getState());
              stat[era].same++;
            } else {
              expect(after.mother).toBeGreaterThanOrEqual(minMotherAgeForOrder(order));
              expect(b.getState(), '어긋난 판만 한 번 더 뽑는다').not.toBe(a.getState());
              stat[era].fixed++;
            }
          }
        }
      }
    }
    // 공허 통과 방지: 두 갈래가 모두 실제로 일어났다 (지난 세상은 어긋남이 많다)
    for (const era of ERAS) expect(stat[era].same, era).toBeGreaterThan(5000);
    expect(stat.past.fixed, JSON.stringify(stat)).toBeGreaterThan(100);
    expect(stat.present.fixed, JSON.stringify(stat)).toBeGreaterThan(0);
  });

  it('다시 뽑은 나이는 「순서가 가능한 나이만 남긴 조건부 분포」를 따른다 (예전 분포에서 불가능한 칸을 잘라 다시 맞춘 것): 4σ 이내', () => {
    const N = 200000;
    for (const [era, order, w] of [['present', 2, 3], ['present', 5, 2], ['past', 3, 4]] as const) {
      const shift = ERA_REPORT_ADJUST[era].parentAgeShift;
      const need = minMotherAgeForOrder(order);
      const weights = model.motherGiven[bucketOf(order)][w - 1];
      const expected = new Map<number, number>();
      let total = 0;
      weights.forEach((p, i) => {
        const fin = clamp(model.motherMin + i + shift, PARENT_AGE_LIMITS.min, PARENT_AGE_LIMITS.max);
        if (fin < need) return;
        expected.set(fin, (expected.get(fin) ?? 0) + p);
        total += p;
      });
      const rng = createRng(mixSeed(0x5eed, order * 10 + w + ERAS.indexOf(era) * 100));
      const seen = new Map<number, number>();
      for (let i = 0; i < N; i++) {
        const m = rollParentAges(rng, era, w, bucketOf(order), order).mother;
        seen.set(m, (seen.get(m) ?? 0) + 1);
      }
      let checked = 0;
      for (const [age, p] of expected) {
        const pct = (p / total) * 100;
        const observed = ((seen.get(age) ?? 0) / N) * 100;
        expect(Math.abs(observed - pct), `${era} ${order}째 ${w}단계 어머니 ${age}세 관측 ${observed.toFixed(3)}% / 기대 ${pct.toFixed(3)}%`).toBeLessThanOrEqual(sigmaTolerancePct(pct, N) + EPS);
        checked++;
      }
      expect(checked).toBeGreaterThan(10);
      for (const age of seen.keys()) expect(expected.has(age), `${era} ${order}째: 불가능한 어머니 나이 ${age}세가 나왔다`).toBe(true);
    }
  });
});

describe('출생 생성기 대량 표본 (세대 표본 3종 × 60000판): 출생신고 형제 순서 ⇔ 식구 카드 위 형제 수 (모순 0, R-330 r3)', () => {
  const N = 60000;
  const sample = (era: ProfileId) => {
    const rng = createRng(20261017 + SIM_PROFILES.indexOf(era));
    return Array.from({ length: N }, () => generateBirth(rng, era));
  };

  for (const era of SIM_PROFILES) {
    it(`${era}: 모든 판에서 위 형제 수 ≤ ⌊(어머니 나이 − 16) / 2⌋이고, 출생신고 문장의 「N째입니다」와 식구 카드의 위 형제 수가 같다`, () => {
      const draws = sample(era);
      let withOlder = 0;
      for (const d of draws) {
        const r = d.report;
        const at = `${era} 어머니 ${r.mother.age}세 ${r.birthOrder}째`;
        expect(olderSiblingsOf(r.birthOrder), at).toBeLessThanOrEqual(olderSiblingLimit(r.mother.age));
        expect(r.mother.age, at).toBeGreaterThanOrEqual(minMotherAgeForOrder(r.birthOrder));
        // 출생신고 문장이 말하는 형제 순서 (구현의 표 대신 따로 적은 낱말로 읽는다)
        const m = ORDER_RE.exec(birthSentence(d.character, r));
        expect(m, `${at}: 서술문에 형제 순서가 없다`).not.toBeNull();
        const said = WORDS.indexOf(m![1] as (typeof WORDS)[number]) + 1;
        expect(said, at).toBe(r.birthOrder);
        const card = familyOf({ age: 0, flags: [], seen: {}, birthReport: r, character: d.character, peerSeed: d.peerSeed, seed: 1 });
        const older = card.siblings.filter((s) => s.older);
        expect(older.length, `${at}: 서술문 「${m![1]}입니다」 ⇔ 식구 카드 위 형제 ${older.length}명`).toBe(Math.min(4, said - 1));
        if (older.length > 0) {
          withOlder++;
          expect(older.at(-1)!.gap, at).toBeLessThanOrEqual(r.mother.age - MIN_FIRST_BIRTH_AGE);
        }
      }
      expect(withOlder, '공허 통과 방지: 위 형제가 있는 판').toBeGreaterThan(N * 0.35);
    });
  }

  it('공표 출산 순위 비중은 그대로다: 1989년 이전 출생(산업화·X)은 26·26·48(설계 비중), 1990년 이후(알파)는 전국 62.4·31.2·6.4(공표)와 같고, 셋째 이상의 셋째·넷째·다섯째 분할(74·19·7)도 그대로 — 순서를 먼저 뽑고 어머니 나이를 그 순서에 맞추기 때문', () => {
    const expectedShares: Record<ReportTilt, [number, number, number]> = { past: [...ERA_REPORT_ADJUST.past.orderShares!], present: [62.4, 31.2, 6.4] };
    expect(THIRD_PLUS_SPLIT).toEqual([74, 19, 7]);
    for (const era of SIM_PROFILES) {
      const draws = sample(era);
      const count = (pick: (o: number) => boolean) => draws.filter((d) => pick(d.report.birthOrder)).length;
      const observed = [count((o) => o === 1), count((o) => o === 2), count((o) => o >= 3)].map((c) => (c / N) * 100);
      observed.forEach((pct, i) => {
        const expected = expectedShares[tiltOfProfile(era)][i];
        // 지금 세상의 기대값은 지역별 통계를 출생아 수로 가중한 값이라 공표 전국값과 조금 다르다 → 표본 오차 4σ에 0.3%p를 더한다
        const slack = tiltOfProfile(era) === 'present' ? 0.3 : 0;
        expect(Math.abs(pct - expected), `${era} 순위 ${i + 1} 관측 ${pct.toFixed(2)}% / 기대 ${expected}%`).toBeLessThanOrEqual(sigmaTolerancePct(expected, N) + slack + EPS);
      });
      const thirdPlus = count((o) => o >= 3);
      THIRD_PLUS_SPLIT.forEach((share, i) => {
        const pct = (count((o) => o === 3 + i) / thirdPlus) * 100;
        expect(Math.abs(pct - share), `${era} 셋째 이상 중 ${3 + i}째 관측 ${pct.toFixed(2)}% / 기대 ${share}%`).toBeLessThanOrEqual(sigmaTolerancePct(share, thirdPlus) + EPS);
      });
    }
  });
});
