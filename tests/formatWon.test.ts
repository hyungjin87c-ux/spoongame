import { describe, expect, it } from 'vitest';
import { formatCount, formatWon } from '../src/core/format';

/**
 * 원 단위 금액 표기 (SPEC-003 DB11, 자산 현황의 순자산·연 소득·부채 — 값을 채우는 것은 경제 모델 M5이고, 표기 함수는 M4가 준비했다).
 * 1만 원 미만은 그대로, 이상은 만 원 단위 반올림 + 조·억·만 큰 단위부터, 음수는 수학 빼기 부호(−).
 */
describe('formatWon', () => {
  it('1만 원 미만은 정확한 원 단위다', () => {
    expect(formatWon(0)).toBe('0원');
    expect(formatWon(1)).toBe('1원');
    expect(formatWon(999)).toBe('999원');
    expect(formatWon(9_999)).toBe('9,999원');
  });

  it('1만 원 이상은 만 원 단위로 쓴다 (숫자와 단위 사이는 한 칸, 「만 원」)', () => {
    expect(formatWon(10_000)).toBe('1만 원');
    expect(formatWon(12_000_000)).toBe('1,200만 원');
    expect(formatWon(34_560_000)).toBe('3,456만 원');
    expect(formatWon(99_990_000)).toBe('9,999만 원');
  });

  it('억·조는 큰 단위부터 쓰고 0인 단위는 건너뛴다', () => {
    expect(formatWon(100_000_000)).toBe('1억 원');
    expect(formatWon(120_000_000)).toBe('1억 2,000만 원');
    expect(formatWon(1_000_050_000)).toBe('10억 5만 원');
    expect(formatWon(1_000_000_000_000)).toBe('1조 원');
    expect(formatWon(1_200_000_000_000)).toBe('1조 2,000억 원');
    expect(formatWon(1_000_100_000_000)).toBe('1조 1억 원');
    expect(formatWon(12_345_670_000_000)).toBe('12조 3,456억 7,000만 원');
  });

  it('만 원 아래 자리는 반올림한다 (읽기 쉽게). 반올림이 단위 경계를 넘으면 단위를 올려 적는다', () => {
    expect(formatWon(12_340_000 + 4_999)).toBe('1,234만 원');
    expect(formatWon(12_340_000 + 5_000)).toBe('1,235만 원');
    expect(formatWon(99_995_000)).toBe('1억 원'); // 9,999만 5,000원 → 1억 원
    expect(formatWon(99_994_999)).toBe('9,999만 원');
    expect(formatWon(999_999_995_000)).toBe('1조 원'); // 9,999억 9,999만 5,000원 → 1조 원
    expect(formatWon(999_995_000_000)).toBe('9,999억 9,500만 원'); // 1조 경계에 못 미친다
  });

  it('음수는 맨 앞에 수학 빼기 부호(U+2212)를 붙인다. 1만 원 미만 음수는 반올림하지 않는다', () => {
    expect(formatWon(-12_000_000)).toBe('−1,200만 원');
    expect(formatWon(-100_000_000)).toBe('−1억 원');
    expect(formatWon(-500)).toBe('−500원');
    expect(formatWon(-9_999)).toBe('−9,999원');
    expect(formatWon(-1)).not.toBe('0원');
    expect(formatWon(-12_000_000).startsWith('-')).toBe(false); // 하이픈이 아니다
  });

  it('유한하지 않은 수는 던진다 (조용히 「NaN원」을 그리지 않는다)', () => {
    for (const bad of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) expect(() => formatWon(bad), String(bad)).toThrow(RangeError);
  });

  it('단조: 금액이 커지면 읽은 값(만 원)이 줄지 않는다 — 1만 원 근처 전수', () => {
    const toMan = (won: number) => Math.round(Math.abs(won) / 10_000);
    for (let w = 0; w <= 200_000; w += 137) {
      expect(toMan(w + 137)).toBeGreaterThanOrEqual(toMan(w));
      expect(formatWon(w)).toMatch(/원$/);
    }
  });

  it('formatCount와 같은 쉼표 표기를 쓴다 (한 곳의 규칙)', () => {
    expect(formatCount(1_234)).toBe('1,234');
    expect(formatWon(1_234)).toBe('1,234원');
  });
});
