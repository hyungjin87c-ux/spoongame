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

/**
 * GM4(SPEC-004)에서 보고하는 차이: 시간 모델·판정 임계(`timingTable`)는 아직 옛 시대 3구간(과거·지금·다가올)의 상수이고(연도 축 시간 모델은 GM10 — TL), 세대 판은 프로필에서 구간을 고른다
 * (`timingEraOfProfile`: 산업화 → 과거, X → 지금, 알파 → 다가올). 알파 세대(2013~2020년생)의 노년 결정 카드 평균은 옛 「다가올 세상」(2030~2060년생) 기준의 하한 5.00에 3 SE 미만으로 닿아 있다
 * (처음 측정 −0.4 SE: 평균이 하한 위로 0.0 근처). 하한 5.00 자체는 마스터 결정(M-3)의 값이라 바꾸지 않고, GM10이 세대별 시간 모델로 다시 정할 때까지 이 한계(−2.5 SE)보다 나빠지지 않게 지킨다.
 * **SPEC-009 FM4b 보고(2026-10-28) · 검수 R-555 재측정(2026-11-02)**: 한계를 −1.5 → −2.5 SE로 넓혔다. 판정 표본(합친 4줄)의 알파 노년 평균은 FM4b 전 풀에서 4.987(−0.4 SE)이었는데 지금 풀에서 4.926(−2.10 SE), 이른 부모 별세 효과를 켜면 4.925(−2.16 SE)다.
 * **이 이동은 잡음이 아니라 구조적이다**(`docs/data/family-remeasure.md` 5절, `npm run report:family`): 같은 시드끼리 짝지은 차이가 K2·K4(FM4b 전 풀 → 지금 풀) −0.060(−4.4 SE)이고 시드 1001~4000의 독립 줄에서도 −0.047(−4.1 SE)로 같은 방향·비슷한 크기다. 이른 부모 별세 효과는 −0.002(−0.5 SE)로 원인이 아니다.
 * 원인은 K2로 읽는다(추정 — 직접 센 것은 아니다): 동생 반응 카드가 선택지 간격·페이싱과 무관하게 더해져 앞 나이의 카드 수가 늘고, 판당 선택지 수 조절(페이싱)이 뒤 나이(노년) 카드를 그만큼 줄인다.
 * 더 큰 사실: **독립 줄에서는 FM4b 전 풀도 4.903(−3.3 SE)으로 이미 하한 5.00 아래**였다. 판정 표본의 4.987은 운이 좋은 시드 줄이었고, 알파의 모집단 노년 평균은 하한 아래에 있다(지금 풀 4.854 ± 0.029, 하한까지 −5.0 SE).
 * 그래서 −2.5 SE는 판정 표본에 대한 수용(크기는 약 0.05장 — 플레이에서 느낄 수 없다)이고, 알파에 5.00(마스터 결정 M-3, 옛 「다가올 세상」 구간)을 쓰는 것이 맞지 않는다. 세대별 시간 모델(GM10)에서 알파의 노년 하한을 다시 정한다(docs/TODO.md).
 * **SPEC-018 3b(2026-11-12, 결정 후속 233 D6)**: 한계를 −2.5 → −5.0 SE로 넓혔다. 맞춤 인생을 켜면 판정 표본의 알파 노년 평균이 4.92 → 4.84(−2.2 → −4.6 SE, 약 0.08장)로 내려간다 — 진로 카드는 페이싱에 한 장만 세지만(D2) 강제 슬롯이 선택 간격을 옮겨 노년 몫이 조금 준다(산업화 −0.03 · X −0.07도 같은 방향, 하한 여유 안).
 * 하한 5.00이 알파에 맞지 않는다는 위 판단이 그대로이고 크기는 플레이에서 느낄 수 없다. GM10에서 알파 하한을 다시 정할 때 이 한계도 함께 거둔다.
 */
/**
 * `lineOnly`: 합친 표본은 3 SE 이상인데 줄별(1000판) 표본 한 칸만 2 SE 아래로 내려간 **표본 잡음**이라 줄별 경보에서만 예외로 둔다(합친 판정은 그대로 3 SE를 지킨다).
 * **SPEC-011 AK10(2026-11-09, 마스터 결정)**: `노년(65세+) 결정 카드 평균 / genx / sim:1000 · 수동 흉내`(1.9 SE) — 조르기 사건이 풀에 들어와 난수 흐름이 옮겨 가며 이 한 칸의 표본 평균이 하한 4.72 쪽으로 조금 붙었다(합친 4줄은 3 SE 이상). 줄 단위 허용은 1.5 SE까지다(`floor` 3 − 1.5).
 * **SPEC-018 3b(2026-11-12, 결정 후속 233 D6)**: 맞춤 인생을 켜면 X세대 노년이 4.97 → 4.90장(약 0.07장, 알파와 같은 방향)으로 내려가 `sim:1000` 두 줄(수동 흉내 1.1 SE · 자동 성향 0.8 SE)이 하한 위에 남은 채 1.5 SE 아래로 붙었다(합친 4줄은 3 SE 이상) — 줄 단위 허용을 0.5 SE까지로 넓힌다(`floor` 2 − 1.5).
 */
const KNOWN_UNDER3: ReadonlyArray<{ metric: string; era: string; floor: number; lineOnly?: boolean }> = [
  { metric: '노년(65세+) 결정 카드 평균', era: 'alpha', floor: -5.0 },
  { metric: '노년(65세+) 결정 카드 평균', era: 'genx', floor: 2, lineOnly: true },
];
/** 합친 표본은 `floor`(알파 노년 −5.0 SE), 줄별 표본은 그보다 1.5 SE 더 넓은 잡음을 인정한다(줄 하나는 표본이 4분의 1이라 SE가 두 배다) */
const isKnownUnder3 = (u: { metric: string; era: string; margin: number }, line = false): boolean => KNOWN_UNDER3.some((k) => (line || k.lineOnly !== true) && k.metric === u.metric && k.era === u.era && u.margin >= k.floor);

describe('30분 모드 판정 임계는 모든 표본 줄에서 측정값과 3 SE 이상 떨어져 있다 (시대 × 전략 × 시드 줄: 시험 · sim:1000)', () => {
  it('새 판정 지표 전부(카드 평균 하·상한, 하드−1↑, 5% 분위, 70세+ 중 20장 미만, 노년, 영유아, 시대별 시간 하·상한, 95% 분위, 느린 독자) + 세 시대 평균 시간의 여유가 합친 4줄 표본으로 3 SE 이상이다 (줄별 값은 보고)', () => {
    const report = marginReport(1000);
    expect(report.problems).toEqual([]);
    // 판정: 합친 4줄(프로필마다 4000판)에서 3 SE 미만인 칸 0 — 단 보고한 차이(KNOWN_UNDER3)는 보고한 한계 안이면 통과로 센다
    expect(report.under3.filter((u) => !isKnownUnder3(u)).map((u) => `${u.metric} / ${u.era} (${u.margin.toFixed(1)} SE)`)).toEqual([]);
    // 보고한 차이는 아직 3 SE 미만이어야 한다(여유가 생기면 목록에서 뺀다)
    for (const k of KNOWN_UNDER3.filter((x) => x.lineOnly !== true)) expect(report.under3.some((u) => u.metric === k.metric && u.era === k.era), `${k.metric} / ${k.era}가 3 SE 안으로 들어왔다 — KNOWN_UNDER3에서 뺀다`).toBe(true);
    // 줄별(1000판) 3 SE 미만 칸은 보고만 한다 — 다만 2 SE 아래로 내려가면(모집단 값이 임계에 닿아 간다는 뜻) 알린다
    expect(report.lineUnder3.filter((u) => u.margin < 2 && !isKnownUnder3({ ...u, margin: u.margin + 1.5 }, true)).map((u) => `${u.metric} / ${u.era} / ${u.line} (${u.margin.toFixed(1)} SE)`)).toEqual([]);
    // 공허 통과 방지: 줄별 칸은 시대 3 × 줄 4 = 12개 + 합친 칸 3개이고, 합친 칸은 네 줄의 판을 모두 담는다
    expect(report.cells.filter((c) => c.line.id !== POOLED_LINE.id)).toHaveLength(12);
    const pooled = report.cells.filter((c) => c.line.id === POOLED_LINE.id);
    expect(pooled).toHaveLength(3);
    for (const c of pooled) expect(c.lives).toHaveLength(4000);
    expect(ALL_METRICS.length).toBeGreaterThanOrEqual(12);
    expect(MARGIN_LINES.map((l) => l.id)).toEqual(['test-random', 'test-auto', 'sim-manual', 'sim-auto']);
  }, 300_000);

  it('임계 값 자체: 카드 평균 구간 23.3~29, 노년 하한 3.95 / 4.72 / 5.0, 시대별 시간 25.5~37.5분 (바뀌면 위 여유 시험과 timingTable.ts 주석의 계산을 함께 다시 한다)', () => {
    expect(LIFE_LENGTH_MODES.short30.cards.meanLow).toBe(23.3);
    expect(LIFE_LENGTH_MODES.short30.cards.meanHigh).toBe(29);
    expect(SENIOR_CHOICE_MEAN_MIN).toEqual({ past: 3.95, present: 4.72, future: 5 });
    // 상단 34.5 → 36.5: SPEC-005 r4 마스터 결정 M24(2026-10-26, 형진 님 「플레이시간은 몰입의 결과」) — 하단 25.5와 3 SE 규칙은 그대로다 (timingTable.ts timeMin 주석)
    // 상단 36.5 → 37.5: SPEC-011 Q1(2026-11-09, 어린 시절 조르기 — 형진 님 「내용을 줄이지 않고 임계를 올린다」, 실측 세 시대 평균 35.29분) — `timeMin.modelHigh` 35 → 36
    expect(ERA_TIME_BAND).toEqual({ low: 25.5, high: 37.5 });
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
