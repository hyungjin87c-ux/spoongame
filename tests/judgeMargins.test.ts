import { describe, expect, it } from 'vitest';
import { LIFE_LENGTH_MODES, SENIOR_CHOICE_MEAN_MIN } from '../src/data/timingTable';
import { ALL_METRICS, ERA_TIME_BAND, MARGIN_LINES, POOLED_LINE, marginReport, propSe, meanSe } from '../scripts/marginsLib';

/**
 * 30분 모드 판정 임계의 여유 (LD-9, REV-003-M8-1 R-415, 마스터 결정 M-3 2026-10-20): 새 판정 지표의 임계는 **측정값에서 표준오차(SE) 3배 이상** 떨어져 있어야 한다.
 * 판정을 하는 시험 줄(simulation.test.ts의 `simulateMany` 시드 줄)뿐 아니라 `npm run sim:1000`이 쓰는 시드 줄에서도, 수동 흉내와 자동 성향 모두에서 지킨다 —
 * 그러지 않으면 시드가 달라지거나 콘텐츠가 한 줄 바뀔 때 임계가 측정값에 닿아 같은 지적(R-415)이 되풀이된다.
 * 여유 표는 `npm run report:time -- 1000 --only=margins`가 낸다(scripts/marginsLib.ts). 이 시험이 실패하면 값을 몰래 맞추지 말고 표를 다시 내 보고한다.
 *
 * **판정 방식의 변경 (SPEC-005 QI5, 마스터 결정 — 설계 문서 9절 1번)**: 3 SE는 **네 줄을 합친 표본(시대마다 4000판)**으로 판정하고, 줄별(1000판) 3 SE 미만 칸은 **보고**로 남긴다(임계는 그대로).
 * 줄 하나의 표준오차로 네 줄이 모두 3 SE를 지키라는 요구는 모집단 값이 임계에서 4 SE쯤 떨어져 있어야 통과하는 엄격한 것이라, 난수 흐름이 바뀌는 변경이 오면 칸마다 반쯤의 확률로 걸렸다(REV-003-M8-2 3번이 예견).
 * QI5의 부모 결정으로 실제로 노년 평균 지난 세상 4.09(2.2 SE) 같은 줄별 칸이 걸렸지만, 시드 1001~4000의 독립 표본에서 PD 전/후가 같았고(4.186 / 4.164) 합친 표본의 최소 여유는 7.6 SE다.
 * 합친 표본의 독립성 한계: 시험 줄의 수동·자동은 같은 시드(같은 출생)를 써서 4000판의 실효 표본은 2000~4000판이다 — 표준오차를 √2배로 잡아도 최소 여유는 5 SE를 넘는다.
 *
 * 임계를 어떻게 정했나 (M-3: 「가장 불리한 표본 측정값 − 3 SE」 이하로 내림, 계산은 timingTable.ts 주석): 처음 임계(카드 평균 하한 23.5, 노년 하한 3.97 / 4.72 / 5.03)에서는 네 칸이 3 SE에 못 미쳤다 —
 * 카드 평균 하한 지난 세상 sim:1000 줄 2.0 / 2.9 SE, 노년 하한 지난 세상 sim:1000 수동 2.9 SE · 다가올 세상 sim:1000 자동 2.7 SE. 모든 줄의 (측정값 − 3 SE)의 최솟값 이하로 내렸다.
 */

describe('30분 모드 판정 임계는 모든 표본 줄에서 측정값과 3 SE 이상 떨어져 있다 (시대 × 전략 × 시드 줄: 시험 · sim:1000)', () => {
  it('새 판정 지표 전부(카드 평균 하·상한, 하드−1↑, 5% 분위, 70세+ 중 20장 미만, 노년, 영유아, 시대별 시간 하·상한, 95% 분위, 느린 독자) + 세 시대 평균 시간의 여유가 합친 4줄 표본으로 3 SE 이상이다 (줄별 값은 보고)', () => {
    const report = marginReport(1000);
    expect(report.problems).toEqual([]);
    // 판정: 합친 4줄(시대마다 4000판)에서 3 SE 미만인 칸 0
    expect(report.under3.map((u) => `${u.metric} / ${u.era} (${u.margin.toFixed(1)} SE)`)).toEqual([]);
    // 줄별(1000판) 3 SE 미만 칸은 보고만 한다 — 다만 2 SE 아래로 내려가면(모집단 값이 임계에 닿아 간다는 뜻) 알린다
    expect(report.lineUnder3.filter((u) => u.margin < 2).map((u) => `${u.metric} / ${u.era} / ${u.line} (${u.margin.toFixed(1)} SE)`)).toEqual([]);
    // 공허 통과 방지: 줄별 칸은 시대 3 × 줄 4 = 12개 + 합친 칸 3개이고, 합친 칸은 네 줄의 판을 모두 담는다
    expect(report.cells.filter((c) => c.line.id !== POOLED_LINE.id)).toHaveLength(12);
    const pooled = report.cells.filter((c) => c.line.id === POOLED_LINE.id);
    expect(pooled).toHaveLength(3);
    for (const c of pooled) expect(c.lives).toHaveLength(4000);
    expect(ALL_METRICS.length).toBeGreaterThanOrEqual(12);
    expect(MARGIN_LINES.map((l) => l.id)).toEqual(['test-random', 'test-auto', 'sim-manual', 'sim-auto']);
  }, 300_000);

  it('임계 값 자체: 카드 평균 구간 23.3~29, 노년 하한 3.95 / 4.72 / 5.0, 시대별 시간 25.5~36.5분 (바뀌면 위 여유 시험과 timingTable.ts 주석의 계산을 함께 다시 한다)', () => {
    expect(LIFE_LENGTH_MODES.short30.cards.meanLow).toBe(23.3);
    expect(LIFE_LENGTH_MODES.short30.cards.meanHigh).toBe(29);
    expect(SENIOR_CHOICE_MEAN_MIN).toEqual({ past: 3.95, present: 4.72, future: 5 });
    // 상단 34.5 → 36.5: SPEC-005 r4 마스터 결정 M24(2026-10-26, 형진 님 「플레이시간은 몰입의 결과」) — 하단 25.5와 3 SE 규칙은 그대로다 (timingTable.ts timeMin 주석)
    expect(ERA_TIME_BAND).toEqual({ low: 25.5, high: 36.5 });
  });
});

describe('표준오차 도우미 (여유 표의 계산)', () => {
  it('평균의 SE = 표준편차 ÷ √n, 비율의 SE는 Agresti-Coull이라 0이어도 0이 되지 않는다', () => {
    expect(meanSe([1, 2, 3, 4, 5])).toBeCloseTo(Math.sqrt(2) / Math.sqrt(5), 9);
    expect(propSe(0, 1000)).toBeGreaterThan(0);
    expect(propSe(0, 4000)).toBeCloseTo(Math.sqrt(((2 / 4004) * (1 - 2 / 4004)) / 4004), 9);
    expect(propSe(500, 1000)).toBeCloseTo(0.0158, 3);
  });
});
