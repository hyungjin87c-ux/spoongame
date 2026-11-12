import { describe, expect, it, vi } from 'vitest';
import { JOB_TABLE } from '../src/data/jobs';
import { PERSONA_TABLE as T } from '../src/data/personaTable';
import { applyProbOf, applyRollOf, hireYearOf, jobApplyOf, jobPickOutcome, personaFamSeedOf, type ApplyInput, type JobHire, type GameState } from '../src/core';
import { runToJobCard } from './helpers/careerTest';

vi.mock('../src/data/personaSwitch', () => ({ PERSONA_ENABLED: true }));

/**
 * 취업 지원 판정 (SPEC-018 PL4, 설계 4B·4C-3): `p = clamp(p_first × (1 + kJob·z) + retry + rel, 0.10, 0.95)`, `p_first`에 `HIREYEAR[판정 연도]`,
 * 난수 키 `(60, tries)`(지원 순번), `tries ≥ 3`이면 `open` 합격(p = 1, `HIREYEAR` 무관), 합격해도 `tries`를 되돌리지 않는다. **외모 항 `kJob`은 3a에서 0 — 자리만.**
 */

const input = (over: Partial<ApplyInput> = {}): ApplyInput => ({ hire: 'selective', education: 50, stretch: false, hireYear: 1, tries: 0, relationships: 0, ...over });

describe('p 식', () => {
  it('설계 손계산(4B): selective 직업·학력 70·적성 mid·첫 지원 → p0 = 0.40 + 0.06 = 0.46', () => {
    const { pFirst, p } = applyProbOf(input({ education: 70, aptTier: 'mid' }));
    expect(pFirst).toBeCloseTo(0.46, 12);
    expect(p).toBeCloseTo(0.46, 12);
  });

  it('기본 합격률 P_BASE: open 0.85 · normal 0.60 · selective 0.40 (학력 50·적성 없음·HIREYEAR 1)', () => {
    for (const [hire, want] of [['open', 0.85], ['normal', 0.6], ['selective', 0.4]] as [JobHire, number][]) expect(applyProbOf(input({ hire })).p).toBeCloseTo(want, 12);
    expect(T.HIRE.open[0]).toBe(0.85);
  });

  it('적성 가산 low −0.08 · mid 0 · high +0.10, 학력 항 0.15 × (education − 50)/50', () => {
    expect(applyProbOf(input({ aptTier: 'low' })).p).toBeCloseTo(0.32, 12);
    expect(applyProbOf(input({ aptTier: 'mid' })).p).toBeCloseTo(0.4, 12);
    expect(applyProbOf(input({ aptTier: 'high' })).p).toBeCloseTo(0.5, 12);
    expect(applyProbOf(input({ education: 100 })).p).toBeCloseTo(0.55, 12);
    expect(applyProbOf(input({ education: 0 })).p).toBeCloseTo(0.25, 12);
  });

  it('무리한 도전(stretch) −0.15', () => {
    expect(applyProbOf(input({ stretch: true })).p).toBeCloseTo(0.25, 12);
  });

  it('HIREYEAR는 첫 지원 항 p_first에만 곱한다 — 재도전·관계 가산은 곱 뒤에 더한다', () => {
    const r = applyProbOf(input({ hireYear: 0.75, tries: 2, relationships: 60 }));
    expect(r.pFirst).toBeCloseTo(0.4 * 0.75, 12);
    expect(r.p).toBeCloseTo(0.4 * 0.75 + 0.16 + 0.06, 12); // 곱한 뒤에 retry 0.16 + rel 0.06
  });

  it('재도전 가산 +0.08/회, 상한 +0.24(tries 3 이상은 같다)', () => {
    for (const [tries, add] of [[0, 0], [1, 0.08], [2, 0.16], [3, 0.24], [4, 0.24], [9, 0.24]]) expect(applyProbOf(input({ tries })).p, `tries ${tries}`).toBeCloseTo(0.4 + add, 12);
  });

  it('관계 가산 +0.06은 관계 60부터(경계 59/60)', () => {
    expect(applyProbOf(input({ relationships: 59 })).p).toBeCloseTo(0.4, 12);
    expect(applyProbOf(input({ relationships: 60 })).p).toBeCloseTo(0.46, 12);
  });

  it('클램프 [0.10, 0.95]', () => {
    expect(applyProbOf(input({ education: 0, stretch: true, aptTier: 'low', hireYear: 0.75 })).p).toBe(0.1);
    expect(applyProbOf(input({ hire: 'open', education: 100, aptTier: 'high', hireYear: 1.1, tries: 3, relationships: 100 })).p).toBe(0.95);
  });

  it('외모 항 kJob·z는 3a에서 0이라 아무것도 바꾸지 않는다(자리만) — 구조: 곱은 p_first에만, 만회는 곱 뒤', () => {
    const a = applyProbOf(input({ tries: 2 }));
    const zero = applyProbOf(input({ tries: 2, lookTerm: 0 }));
    expect(zero).toEqual(a);
    const shifted = applyProbOf(input({ tries: 2, lookTerm: 0.1 }));
    expect(shifted.p).toBeCloseTo(0.4 * 1.1 + 0.16, 12); // 곱수는 p_first에만
  });
});

describe('난수 키: 지원 순번(tries)이지 나이가 아니다', () => {
  it('같은 가족 시드·같은 tries는 같은 난수이고 tries가 달라지면 다르다', () => {
    const f = personaFamSeedOf(2024);
    expect(applyRollOf(f, 0)).toBe(applyRollOf(f, 0));
    const rolls = new Set([0, 1, 2, 3, 4].map((t) => applyRollOf(f, t)));
    expect(rolls.size).toBe(5);
    for (const r of rolls) {
      expect(r).toBeGreaterThanOrEqual(0);
      expect(r).toBeLessThan(1);
    }
  });

  it('jobApplyOf: 지원 나이를 옮겨도 같은 tries의 난수는 같다(다시 뽑기 방지)', () => {
    const s0 = runToJobCard(7, 'detail');
    const job = JOB_TABLE.byId.get(s0.pending!.choiceIds[1])!;
    const base: GameState = { ...s0, persona: { ...s0.persona!, tries: 1 } };
    expect(jobApplyOf(base, job, 21).roll).toBe(jobApplyOf({ ...base, age: 28 }, job, 28).roll);
  });
});

describe('입문 보장: tries ≥ 3이면 open은 합격(p = 1, HIREYEAR 무관)', () => {
  const open = JOB_TABLE.jobs.find((j) => j.field === 'clerk' && j.open === true)!;
  const normal = JOB_TABLE.jobs.find((j) => j.field === 'clerk' && j.hire === 'normal')!;

  it('경계: tries 2는 보장이 아니고 3부터 보장이다', () => {
    const s0 = runToJobCard(5, 'detail');
    const at = (tries: number): GameState => ({ ...s0, persona: { ...s0.persona!, tries } });
    expect(jobApplyOf(at(2), open, 22).guaranteed).toBe(false);
    expect(jobApplyOf(at(3), open, 22).guaranteed).toBe(true);
    expect(jobApplyOf(at(3), open, 22).p).toBe(1);
    expect(jobApplyOf(at(9), open, 22).pass).toBe(true);
  });

  it('입문이 아닌 직업은 tries가 아무리 커도 보장이 없다', () => {
    const s0 = runToJobCard(5, 'detail');
    const r = jobApplyOf({ ...s0, persona: { ...s0.persona!, tries: 9 } }, normal, 22);
    expect(r.guaranteed).toBe(false);
    expect(r.p).toBeLessThan(1);
  });

  it('HIREYEAR가 가장 어려운 해(0.75, 1998·1999)에도 보장은 깨지지 않는다 — 모든 출생 연도에서 tries 3 입문 합격', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const s0 = runToJobCard(seed, 'detail');
      const state: GameState = { ...s0, persona: { ...s0.persona!, tries: 3 } };
      for (const year of [1998, 1999, 2016, 2017]) {
        const born: GameState = { ...state, character: { ...state.character!, birthYear: year - state.age } };
        for (const j of JOB_TABLE.jobs.filter((x) => x.open === true)) expect(jobApplyOf(born, j, state.age).pass, `${seed}/${year}/${j.id}`).toBe(true);
      }
    }
  });

  it('최악 입력에서도 p ≥ 0.10이고 입문의 첫 지원 p_first 최악은 0.85 × 0.75', () => {
    expect(hireYearOf(1998)).toBe(0.75);
    expect(applyProbOf(input({ hire: 'open', hireYear: 0.75 })).pFirst).toBeCloseTo(0.6375, 12);
    for (const hire of ['open', 'normal', 'selective'] as JobHire[]) for (const education of [0, 50, 100]) for (const tier of ['low', 'mid', 'high'] as const) for (const stretch of [false, true]) for (const hireYear of [0.75, 1, 1.1]) {
      const { p } = applyProbOf(input({ hire, education, aptTier: tier, stretch, hireYear }));
      expect(p).toBeGreaterThanOrEqual(0.1);
      expect(p).toBeLessThanOrEqual(0.95);
    }
  });
});

describe('해결: 합격해도 tries를 되돌리지 않는다, 불합격은 tries + 1(상한 9)', () => {
  it('합격: hired + 플래그, tries 유지', () => {
    const s0 = runToJobCard(5, 'detail');
    const open = JOB_TABLE.jobs.find((j) => j.field === s0.persona!.job!.field && j.open === true)!;
    const s: GameState = { ...s0, persona: { ...s0.persona!, tries: 3 } };
    const o = jobPickOutcome(s, 'detail', open.id, s.age);
    expect(o.passed).toBe(true);
    expect(o.persona.job).toEqual({ field: open.field, id: open.id, since: s.age });
    expect(o.persona.tries).toBe(3);
    expect(o.effects!.setFlags).toEqual(expect.arrayContaining(['has_career', 'job_picked']));
  });

  it('불합격: tries + 1, 상태는 field 그대로(since 유지), 효과 없음, 상한 9', () => {
    let hit = 0;
    for (let seed = 1; seed <= 60 && hit < 3; seed++) {
      const s0 = runToJobCard(seed, 'detail');
      const selective = JOB_TABLE.jobs.find((j) => j.field === s0.persona!.job!.field && j.hire === 'selective');
      if (selective === undefined) continue;
      const o = jobPickOutcome({ ...s0, stats: { ...s0.stats, education: 0 } }, 'detail', selective.id, s0.age);
      if (o.passed) continue;
      hit++;
      expect(o.persona.tries).toBe((s0.persona!.tries ?? 0) + 1);
      expect(o.persona.job).toEqual(s0.persona!.job);
      expect(o.effects).toBeUndefined();
      const capped = jobPickOutcome({ ...s0, stats: { ...s0.stats, education: 0 }, persona: { ...s0.persona!, tries: 9 } }, 'detail', selective.id, s0.age);
      if (!capped.passed) expect(capped.persona.tries).toBe(9);
    }
    expect(hit).toBeGreaterThan(0);
  });
});
