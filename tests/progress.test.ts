import { describe, expect, it } from 'vitest';
import { HOLD_MS } from '../src/data/timingTable';
import { advanceFraction, holdDelayMs, percentOf, yearProgress, SPEEDS } from '../src/core';

/**
 * 올해 진행률 (SPEC-003 DB2): 바는 그 해의 연출 시간 동안 0 → 100%로 차오르고, 100%가 되면 나이가 +1 된다.
 * 순수 함수(yearProgress·advanceFraction·percentOf)를 단위로 본다. 시계(ui/useYearClock.ts)·바의 DOM은 e2e/m4-dashboard.spec.ts가 본다(단조 증가, 나이 증가 시 0으로 리셋).
 */
describe('yearProgress(경과, 연출 시간)', () => {
  it('경과 / 연출 시간이고 0~1 안에 머문다', () => {
    expect(yearProgress(0, 1200)).toBe(0);
    expect(yearProgress(300, 1200)).toBeCloseTo(0.25, 10);
    expect(yearProgress(600, 1200)).toBe(0.5);
    expect(yearProgress(1200, 1200)).toBe(1);
    expect(yearProgress(5000, 1200)).toBe(1); // 넘쳐도 1 — 100%를 넘지 않는다
    expect(yearProgress(-50, 1200)).toBe(0); // 시간은 거꾸로 가지 않는다
  });

  it('경과가 늘기만 하면 진행률은 줄지 않는다 (단조 증가)', () => {
    let last = -1;
    for (let t = 0; t <= 1500; t += 7) {
      const p = yearProgress(t, 1200);
      expect(p).toBeGreaterThanOrEqual(last);
      last = p;
    }
    expect(last).toBe(1);
  });

  it('연출 시간이 없는 상태(선택지 대기·사망 = null)는 가득 찬 채 멈춘 모습이다 — 0으로 나누지 않는다', () => {
    expect(yearProgress(0, null)).toBe(1);
    expect(yearProgress(999, null)).toBe(1);
    for (const bad of [0, -5, Number.NaN, Number.POSITIVE_INFINITY]) expect(yearProgress(10, bad), String(bad)).toBe(1);
  });

  it('유한하지 않은 경과는 0으로 본다', () => {
    expect(yearProgress(Number.NaN, 1200)).toBe(0);
    expect(yearProgress(Number.NEGATIVE_INFINITY, 1200)).toBe(0);
  });
});

describe('advanceFraction(비율, dt, 연출 시간): 시계가 흐르는 방식', () => {
  it('dt / 연출 시간만큼 오르고 1에서 멈춘다', () => {
    expect(advanceFraction(0, 300, 1200)).toBeCloseTo(0.25, 10);
    expect(advanceFraction(0.25, 300, 1200)).toBeCloseTo(0.5, 10);
    expect(advanceFraction(0.9, 600, 1200)).toBe(1);
    expect(advanceFraction(1, 100, 1200)).toBe(1);
  });

  it('시간은 거꾸로 가지 않는다: dt가 0·음수·유한하지 않으면 그대로', () => {
    for (const dt of [0, -10, Number.NaN]) expect(advanceFraction(0.4, dt, 1200), String(dt)).toBe(0.4);
  });

  it('한 해 도중에 배속이 바뀌어도 바는 되감기거나 건너뛰지 않는다: 이미 찬 비율은 그대로이고 남은 비율만 새 속도로 채운다', () => {
    const base = HOLD_MS.quiet;
    // 1배속으로 절반을 지난 뒤 8배속으로 바꾼다
    let f = advanceFraction(0, base / 2, base);
    expect(f).toBeCloseTo(0.5, 10);
    const slow = holdDelayMs('quiet', 1)!;
    const fast = holdDelayMs('quiet', 8)!;
    expect(fast).toBeCloseTo(slow / 8, 10);
    // 남은 절반을 새 연출 시간으로 채우는 데는 fast / 2가 걸린다
    f = advanceFraction(f, fast / 2, fast);
    expect(f).toBeCloseTo(1, 10);
    // 반대로 8배속에서 느리게 바꿔도 이미 찬 비율은 줄지 않는다
    let g = advanceFraction(0, fast / 4, fast);
    const before = g;
    g = advanceFraction(g, 0, slow);
    expect(g).toBe(before);
  });

  it('모든 걸음의 종류 × 배속에서 연출 시간 동안 흐르면 정확히 한 해(100%)다 (선택지·사망은 연출 시간이 없다)', () => {
    for (const kind of ['quiet', 'narrative', 'resolved'] as const) {
      for (const speed of SPEEDS) {
        const duration = holdDelayMs(kind, speed)!;
        expect(duration, `${kind} ${speed}배`).toBeGreaterThan(0);
        // 40ms 프레임으로 흘려 보낸다
        let f = 0;
        let t = 0;
        while (f < 1) {
          const step = Math.min(40, (1 - f) * duration);
          f = advanceFraction(f, step, duration);
          t += step;
          expect(t, `${kind} ${speed}배: 무한 반복 방지`).toBeLessThan(duration * 1.0001 + 1);
        }
        expect(t).toBeCloseTo(duration, 6);
      }
    }
    for (const kind of ['choice', 'death'] as const) expect(holdDelayMs(kind, 1)).toBeNull();
  });
});

describe('percentOf(비율): 표시용 정수', () => {
  it('내림이라 가득 차기 전에는 100이 되지 않는다', () => {
    expect(percentOf(0)).toBe(0);
    expect(percentOf(0.384)).toBe(38);
    expect(percentOf(0.999)).toBe(99);
    expect(percentOf(1)).toBe(100);
    expect(percentOf(1.5)).toBe(100);
    expect(percentOf(-1)).toBe(0);
    expect(percentOf(Number.NaN)).toBe(0);
  });

  it('0.07처럼 부동소수 오차가 낀 값도 한 칸 아래로 떨어지지 않는다', () => {
    for (let n = 0; n <= 100; n++) expect(percentOf(n / 100), `${n}%`).toBe(n);
  });
});
