import { describe, expect, it, vi } from 'vitest';
import { JOB_TABLE } from '../src/data/jobs';
import { educationMultiplier, economyContextOf, incomeOf, flightMult, jobMulOf, occMultOf, type GameState } from '../src/core';
import { runToJobCard, playUntil } from './helpers/careerTest';
import { lifeAt } from './helpers/personaTest';
import { startLife } from '../scripts/simulateLib';

vi.mock('../src/data/personaSwitch', () => ({ PERSONA_ENABLED: true }));

/**
 * 직업 소득 (SPEC-018 PL4, 설계 5절): `jobMul = clamp((occMult(직업, 연도) × sizeMul ÷ 대표 학력 배수)^0.8, 0.5, 2.5)`를 경제 입력에 곱한다.
 * 연도 빈칸 규칙(2000~2004 = 2005 값, 2020~2021 직선 보간, 승무원 이음), 취업 판정 연도와 매년 소득 조회 연도 구분, `persona`가 없으면 1.
 */

const synth = { wage: [1, 2, 3, 4] as [number, number, number, number], eduRef: 50 };

describe('occMult — 앵커와 연도 빈칸', () => {
  it('앵커 연도(2009·2019·2022·2025)는 앵커 값, 사이는 직선 보간', () => {
    expect(occMultOf(synth, 2009)).toBe(1);
    expect(occMultOf(synth, 2019)).toBe(2);
    expect(occMultOf(synth, 2022)).toBe(3);
    expect(occMultOf(synth, 2025)).toBe(4);
    expect(occMultOf(synth, 2014)).toBeCloseTo(1.5, 10);
  });
  it('2020~2021은 2019와 2022 값의 직선 보간(2019 → 2022가 끊기지 않는다)', () => {
    expect(occMultOf(synth, 2020)).toBeCloseTo(2 + 1 / 3, 10);
    expect(occMultOf(synth, 2021)).toBeCloseTo(2 + 2 / 3, 10);
  });
  it('2000~2004(그리고 2009 앞 전부)는 2005~2008 구간 값 — 이 표는 2009 앵커로 이어 쓴다', () => {
    for (const y of [1940, 1990, 2000, 2004, 2005, 2008]) expect(occMultOf(synth, y), String(y)).toBe(1);
  });
  it('2026 이후는 2025 값을 그대로 이어 쓴다(carried)', () => {
    for (const y of [2026, 2050, 2100]) expect(occMultOf(synth, y)).toBe(4);
  });
  it('규모 보정 sizeMul을 곱한다', () => {
    expect(occMultOf({ ...synth, sizeMul: 1.33 }, 2025)).toBeCloseTo(5.32, 10);
  });
});

describe('승무원(운송 서비스 431) — 급변을 단일 해 값으로 쓰지 않는다', () => {
  it('2009~2019는 6차 중분류 43 배수 0.86 → 0.92 직선', () => {
    expect(flightMult(2009)).toBeCloseTo(0.86, 10);
    expect(flightMult(2014)).toBeCloseTo(0.89, 10);
    expect(flightMult(2019)).toBeCloseTo(0.92, 10);
  });
  it('2020·2021은 2019 값 0.92를 이어 쓴다(직선 보간이 아니다)', () => {
    expect(flightMult(2020)).toBeCloseTo(0.92, 10);
    expect(flightMult(2021)).toBeCloseTo(0.92, 10);
  });
  it('2022 = (0.92 + 0.92 + 0.85) ÷ 3 = 0.897, 이음이 끊기지 않는다(2019 0.92 → 2022 0.897)', () => {
    expect(flightMult(2022)).toBeCloseTo((0.92 + 0.92 + 0.85) / 3, 10);
    expect(Math.abs(flightMult(2022) - flightMult(2019))).toBeLessThan(0.05);
  });
  it('2023~2025는 각 해 값에 min(·, 1.2)를 씌운 3년 이동평균이고 2025 이후는 이어 쓴다', () => {
    expect(flightMult(2023)).toBeCloseTo((0.92 + 0.85 + 1.2) / 3, 10);
    expect(flightMult(2024)).toBeCloseTo((0.85 + 1.2 + 1.2) / 3, 10);
    expect(flightMult(2025)).toBeCloseTo(1.2, 10);
    expect(flightMult(2026)).toBeCloseTo(flightMult(2025), 10);
    expect(flightMult(2100)).toBeCloseTo(flightMult(2025), 10);
  });
  it('어느 해도 상한 1.2를 넘지 않고 단일 해 값 1.52를 쓰지 않는다', () => {
    for (let y = 1940; y <= 2100; y++) expect(flightMult(y)).toBeLessThanOrEqual(1.2 + 1e-9);
  });
  it('직업 표의 승무원이 이 규칙을 쓴다', () => {
    const crew = JOB_TABLE.byId.get('svc-crew')!;
    expect(crew.wageKind).toBe('flight');
    expect(occMultOf(crew, 2022)).toBeCloseTo(flightMult(2022), 10);
  });
});

describe('jobMul — 대표 학력으로 나누고 지수 0.8, 범위 0.5~2.5', () => {
  it('설계 5절 손계산: 카페·홀 2025 occMult 0.614 · 대표 학력 50(EDU 1.10) → jobMul 0.627', () => {
    expect(educationMultiplier(50)).toBe(1.1);
    expect(jobMulOf({ wage: [0.614, 0.614, 0.614, 0.614], eduRef: 50 }, 2025)).toBeCloseTo(Math.pow(0.614 / 1.1, 0.8), 10);
    expect(jobMulOf({ wage: [0.614, 0.614, 0.614, 0.614], eduRef: 50 }, 2025)).toBeCloseTo(0.627, 3);
    // 학력 포함 노동소득 배수 EDU × jobMul = 0.690, 원래 배수보다 +12.4% (의도된 완화 — 지수 0.8)
    expect(1.1 * jobMulOf({ wage: [0.614, 0.614, 0.614, 0.614], eduRef: 50 }, 2025)).toBeCloseTo(0.69, 2);
  });
  it('상하한 [0.5, 2.5]', () => {
    expect(jobMulOf({ wage: [0.01, 0.01, 0.01, 0.01], eduRef: 50 }, 2025)).toBe(0.5);
    expect(jobMulOf({ wage: [9, 9, 9, 9], eduRef: 0 }, 2025)).toBe(2.5);
  });
  it('실제 직업 표 × 모든 연도(1940~2100)에서 유한하고 [0.5, 2.5] 안이다', () => {
    for (const j of JOB_TABLE.jobs) for (let y = 1940; y <= 2100; y++) {
      const m = jobMulOf(j, y);
      expect(Number.isFinite(m), `${j.id}/${y}`).toBe(true);
      expect(m, `${j.id}/${y}`).toBeGreaterThanOrEqual(0.5);
      expect(m, `${j.id}/${y}`).toBeLessThanOrEqual(2.5);
    }
  });
  it('대표 학력이 높은 직업은 같은 배수에서 jobMul이 낮다(이중 상승 완화)', () => {
    const lo = jobMulOf({ wage: [1.3, 1.3, 1.3, 1.3], eduRef: 20 }, 2020);
    const hi = jobMulOf({ wage: [1.3, 1.3, 1.3, 1.3], eduRef: 80 }, 2020);
    expect(hi).toBeLessThan(lo);
  });
});

describe('경제 입력과 소득', () => {
  const hiredOf = (): GameState => playUntil(runToJobCard(3, 'field'), (x) => x.persona?.job?.id !== undefined);

  it('persona가 없거나 직업 전이면 jobMul 키가 없다(= 1, 구형 소득은 변경 전과 같다)', () => {
    const base = lifeAt(2, 30);
    const { persona: _p, ...bare } = base;
    void _p;
    expect('jobMul' in economyContextOf(bare as GameState)).toBe(false);
    expect('jobMul' in economyContextOf(base)).toBe(false);
    expect('jobMul' in economyContextOf({ ...base, persona: { ...base.persona!, job: { field: 'clerk', since: 20 } } })).toBe(false); // field 상태
  });

  it('hired이면 매년 그 해(소득 조회 연도)의 jobMul을 읽는다 — 취업 판정 연도가 아니다', () => {
    const s = hiredOf();
    const job = JOB_TABLE.byId.get(s.persona!.job!.id!)!;
    const birth = s.character!.birthYear;
    for (const age of [25, 33, 41]) {
      const ctx = economyContextOf({ ...s, age });
      expect(ctx.jobMul).toBeCloseTo(jobMulOf(job, birth + age), 12);
    }
  });

  it('모르는 직업 id(콘텐츠 삭제)는 1이다', () => {
    const s = hiredOf();
    expect('jobMul' in economyContextOf({ ...s, persona: { ...s.persona!, job: { field: s.persona!.job!.field, id: 'removed-job', since: 22 } } })).toBe(false);
  });

  it('incomeOf는 노동소득에 jobMul을 곱한다 — 없으면 같은 값', () => {
    const s = { ...startLife(4, 'millennial'), age: 30, flags: ['has_career'] };
    const ctx = economyContextOf(s);
    const base = incomeOf(ctx, 0);
    expect(incomeOf({ ...ctx, jobMul: 1 }, 0)).toBe(base);
    const doubled = incomeOf({ ...ctx, jobMul: 2 }, 0);
    expect(doubled).toBeGreaterThan(base * 1.9);
    expect(doubled).toBeLessThan(base * 2.1);
    expect(incomeOf({ ...ctx, jobMul: 0.5 }, 0)).toBeLessThan(base);
  });
});
