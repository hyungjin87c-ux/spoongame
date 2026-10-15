import { describe, expect, it, vi } from 'vitest';
import populationSrc from '../src/core/population.ts?raw';
import formatSrc from '../src/core/format.ts?raw';
import statsJson from '../src/data/koreaStats.json';
import {
  POPULATION_DRIFT_CAP,
  POPULATION_EPOCH_MINUTE,
  getPopulationModel,
  POPULATION_NOISE_MAX,
  buildPopulationModel,
  createRng,
  formatCount,
  populationModelInputs,
  tryVirtualPopulation,
  virtualPopulation,
} from '../src/core';

/**
 * 가상 인구 (SPEC-003 VP1·VP2): 결정적이고 범위·연속성을 지키는 순수 함수. 서버·접속자 집계와 무관하다.
 * 시각(분)은 UI가 넣는다 — core에는 Date·Math.random이 없다(CM2).
 */

const MIN_PER_DAY = 24 * 60;
const MIN_PER_YEAR = 365 * MIN_PER_DAY;
/** 2020-01-01 ~ 2080-01-01 (에포크 분) */
const FROM = 26_297_280;
const TO = FROM + 60 * MIN_PER_YEAR;

describe('모델 상수는 근거 통계(koreaStats)에서 계산된다', () => {
  it('규모 = 주민등록 인구(2026.09, 51,082,431명) ÷ 1,000 = 51,082명 — 약 5만 명대', () => {
    const { registeredPopulation } = populationModelInputs();
    expect(registeredPopulation).toBe(51_082_431);
    expect(getPopulationModel().base).toBe(Math.round(registeredPopulation / 1000));
    expect(getPopulationModel().base).toBe(51_082);
    expect(getPopulationModel().base).toBeGreaterThanOrEqual(50_000);
    expect(getPopulationModel().base).toBeLessThan(60_000);
  });

  it('연 자연 증감 = (출생아 수 254,341 − 사망자 수 362,968) ÷ 1,000 = −108.627명', () => {
    const { annualBirths, annualDeaths } = populationModelInputs();
    expect(annualBirths).toBe(254_341);
    expect(annualDeaths).toBe(362_968);
    expect(getPopulationModel().driftPerYear).toBeCloseTo(-108.627, 9);
  });

  it('근거 값은 koreaStats.json 원자료와 같다 (지표 id로 직접 읽어 대조)', () => {
    const inds = (statsJson as unknown as { indicators: Array<{ id: string; latest: { value: number } | null; deaths2025?: number }> }).indicators;
    const get = (id: string) => inds.find((i) => i.id === id)!;
    expect(populationModelInputs()).toEqual({
      registeredPopulation: get('region-population-registered').latest!.value,
      annualBirths: get('births').latest!.value,
      annualDeaths: get('cdr').deaths2025,
    });
  });

  it('buildPopulationModel: 입력만으로 계산된다', () => {
    expect(buildPopulationModel({ registeredPopulation: 10_000_000, annualBirths: 100, annualDeaths: 300 })).toEqual({ base: 10_000, driftPerYear: -0.2 });
  });

  it('설계값: 추세 상한 ±900명, 흔들림 진폭 합 ±126명 — 모두 5만 명대 안에 머문다', () => {
    expect(POPULATION_DRIFT_CAP).toBe(900);
    expect(POPULATION_NOISE_MAX).toBe(126);
    expect(getPopulationModel().base - POPULATION_DRIFT_CAP - POPULATION_NOISE_MAX).toBeGreaterThanOrEqual(50_000);
    expect(getPopulationModel().base + POPULATION_DRIFT_CAP + POPULATION_NOISE_MAX).toBeLessThan(60_000);
  });
});

describe('virtualPopulation(분): 결정성', () => {
  it('같은 입력이면 항상 같은 값이다 (1만 회)', () => {
    const rng = createRng(1);
    for (let i = 0; i < 10_000; i++) {
      const m = rng.int(FROM, TO);
      expect(virtualPopulation(m)).toBe(virtualPopulation(m));
    }
  });

  it('정수이고 유한하다. 소수 분은 내림, 유한하지 않은 입력은 기준 시각으로 본다', () => {
    const m = 29_850_123;
    expect(Number.isInteger(virtualPopulation(m))).toBe(true);
    expect(virtualPopulation(m + 0.9)).toBe(virtualPopulation(m));
    for (const bad of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
      expect(virtualPopulation(bad)).toBe(virtualPopulation(POPULATION_EPOCH_MINUTE));
      expect(Number.isFinite(virtualPopulation(bad))).toBe(true);
    }
  });

  it('기준 시각 근처에서는 규모(51,082명) 주변의 값이다 (1일 동안 모든 분)', () => {
    for (let m = POPULATION_EPOCH_MINUTE; m < POPULATION_EPOCH_MINUTE + MIN_PER_DAY; m++) {
      const n = virtualPopulation(m);
      expect(Math.abs(n - getPopulationModel().base)).toBeLessThanOrEqual(POPULATION_NOISE_MAX + 1);
    }
  });
});

describe('virtualPopulation(분): 범위·연속성 (임의 시각 1만 표본, 2020~2080년)', () => {
  const rng = createRng(20261015);
  const samples = Array.from({ length: 10_000 }, () => rng.int(FROM, TO));

  it('범위: 항상 5만 명대(50,000~59,999)이고 규모의 ±2% 이내', () => {
    for (const m of samples) {
      const n = virtualPopulation(m);
      expect(n, `분 ${m}`).toBeGreaterThanOrEqual(50_000);
      expect(n, `분 ${m}`).toBeLessThan(60_000);
      expect(Math.abs(n - getPopulationModel().base) / getPopulationModel().base, `분 ${m}`).toBeLessThanOrEqual(0.02);
    }
  });

  it('연속성: 1분 사이 변화량은 0.05% 이하(최대 25명)이고, 실제로는 2명 이내로 아주 조금씩 변한다', () => {
    let maxStep = 0;
    for (const m of samples) {
      const a = virtualPopulation(m);
      const b = virtualPopulation(m + 1);
      const step = Math.abs(b - a);
      maxStep = Math.max(maxStep, step);
      expect(step / a, `분 ${m}`).toBeLessThanOrEqual(0.0005);
    }
    expect(maxStep).toBeLessThanOrEqual(2);
  });

  it('하루 사이 변동폭은 0.5% 이하다 (24시간 뒤와의 차이)', () => {
    for (const m of samples) {
      const a = virtualPopulation(m);
      const b = virtualPopulation(m + MIN_PER_DAY);
      expect(Math.abs(b - a) / a, `분 ${m}`).toBeLessThanOrEqual(0.005);
    }
  });

  it('값이 실제로 변한다: 1시간 안에 서로 다른 값이 여러 개 나오고, 하루에 걸친 폭이 있다 (상수 아님)', () => {
    const hour = new Set<number>();
    for (let m = 29_850_000; m < 29_850_060; m++) hour.add(virtualPopulation(m));
    expect(hour.size).toBeGreaterThan(5);
    let lo = Infinity;
    let hi = -Infinity;
    for (let m = 29_850_000; m < 29_850_000 + MIN_PER_DAY; m++) {
      const n = virtualPopulation(m);
      lo = Math.min(lo, n);
      hi = Math.max(hi, n);
    }
    expect(hi - lo).toBeGreaterThan(20);
  });

  it('분포가 한쪽으로 쏠리지 않는다: 표본의 평균은 추세선 근처이고 규모의 위·아래가 모두 나온다', () => {
    const rng2 = createRng(9);
    const around = Array.from({ length: 5000 }, () => virtualPopulation(rng2.int(POPULATION_EPOCH_MINUTE - MIN_PER_YEAR, POPULATION_EPOCH_MINUTE + MIN_PER_YEAR)));
    const avg = around.reduce((a, b) => a + b, 0) / around.length;
    expect(Math.abs(avg - getPopulationModel().base)).toBeLessThan(40);
    expect(around.some((n) => n > getPopulationModel().base)).toBe(true);
    expect(around.some((n) => n < getPopulationModel().base)).toBe(true);
  });
});

describe('추세: 출생·사망 통계를 반영해 천천히 줄어든다 (자연 감소)', () => {
  it('한 해 뒤 평균이 약 108명 줄어든다 (잡음은 60일 창에서 모든 분의 평균으로 걸러서 본다)', () => {
    const windowMean = (start: number) => {
      const days = 60 * MIN_PER_DAY;
      let sum = 0;
      for (let i = 0; i < days; i += 7) sum += virtualPopulation(start + i);
      return sum / Math.ceil(days / 7);
    };
    const a = windowMean(POPULATION_EPOCH_MINUTE);
    const b = windowMean(POPULATION_EPOCH_MINUTE + MIN_PER_YEAR);
    expect(a - b).toBeGreaterThan(70);
    expect(a - b).toBeLessThan(150);
  });

  it('아주 먼 미래·과거에도 추세 상한(900명)에서 멈춰 5만 명대를 벗어나지 않는다', () => {
    const far = [FROM - 100 * MIN_PER_YEAR, TO + 400 * MIN_PER_YEAR];
    for (const m of far) {
      const n = virtualPopulation(m);
      expect(n).toBeGreaterThanOrEqual(50_000);
      expect(n).toBeLessThan(60_000);
    }
  });
});

describe('모델은 호출할 때 계산한다 — 모듈을 불러오는 것만으로는 던지지 않는다 (R-211)', () => {
  it('근거 통계를 읽을 수 없어도 모듈 import는 성공하고, 계산을 요청한 때에만 분명한 오류를 던진다 (흰 화면 방지). 화면용 tryVirtualPopulation은 null을 돌려준다', async () => {
    vi.resetModules();
    vi.doMock('../src/data/koreaStatsAccess', () => ({ getUsableIndicator: () => undefined }));
    try {
      const mod = await import('../src/core/population');
      expect(() => mod.getPopulationModel()).toThrow(/가상 인구의 근거 통계/);
      expect(() => mod.virtualPopulation(POPULATION_EPOCH_MINUTE)).toThrow(/가상 인구의 근거 통계/);
      expect(mod.tryVirtualPopulation(POPULATION_EPOCH_MINUTE)).toBeNull();
      // 실패한 계산은 저장하지 않는다: 다시 불러도 같은 오류(조용히 다른 값을 쓰지 않는다)
      expect(() => mod.getPopulationModel()).toThrow(/가상 인구의 근거 통계/);
    } finally {
      vi.doUnmock('../src/data/koreaStatsAccess');
      vi.resetModules();
    }
  });

  it('정상 데이터에서는 모델을 한 번만 만들어 같은 객체를 돌려주고, tryVirtualPopulation은 virtualPopulation과 같은 값이다', () => {
    expect(getPopulationModel()).toBe(getPopulationModel());
    for (const m of [POPULATION_EPOCH_MINUTE, POPULATION_EPOCH_MINUTE + 12345, 0, Number.NaN]) expect(tryVirtualPopulation(m)).toBe(virtualPopulation(m));
  });
});

describe('core 순수성 (CM2) · 정직한 표기 (VP2)', () => {
  it('가상 인구·표기 코드에 Date·Math.random·타이머·React·브라우저 전역이 없다 (주석은 제외하고 코드만 본다)', () => {
    for (const raw of [populationSrc, formatSrc]) {
      const src = raw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
      expect(src).not.toMatch(/Math\.random|Date\.now|new Date|performance\.now|setTimeout|setInterval|requestAnimationFrame|from 'react'|document\.|window\./);
    }
  });

  it('코드 주석·식별자에서도 접속자 집계를 하지 않는다고 밝힌다 (「접속자」 낱말은 부정문으로만 나온다)', () => {
    expect(populationSrc).toContain('실제 접속자 수가 아니다');
    // 이 파일은 서버·네트워크 호출을 하지 않는다
    expect(populationSrc).not.toMatch(/fetch\(|XMLHttpRequest|WebSocket|navigator\.sendBeacon/);
  });
});

describe('표기 함수', () => {
  it('formatCount: 천 단위 쉼표, 반올림, 음수', () => {
    expect(formatCount(51_284)).toBe('51,284');
    expect(formatCount(999)).toBe('999');
    expect(formatCount(1000)).toBe('1,000');
    expect(formatCount(1_234_567)).toBe('1,234,567');
    expect(formatCount(51_283.6)).toBe('51,284');
    expect(formatCount(0)).toBe('0');
    expect(formatCount(-1500)).toBe('-1,500');
  });
});
