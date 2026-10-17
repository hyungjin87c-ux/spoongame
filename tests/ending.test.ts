import { describe, expect, it } from 'vitest';
import endingSrc from '../src/core/ending.ts?raw';
import finalDistributionSrc from '../src/data/finalDistribution.ts?raw';
import {
  COMPARABLE_STATS,
  DEFAULT_ERA,
  DEFAULT_SETTINGS,
  ERAS,
  BAND_GRACE,
  STAGES,
  bandFromRange,
  buildTimeline,
  createInitialState,
  enterLife,
  finalWealthStanding,
  movementOf,
  parseGame,
  playToEnd,
  reachedIndependence,
  rebirth,
  reviewEnding,
  serializeGame,
  sessionReducer,
  createSession,
  beginBirth,
  enterBirth,
  shareAtLeast,
  shareAtMost,
  stageOf,
  stageRangeOf,
  standingOf,
  standingScore,
  startBandOf,
  validateFinalDistribution,
  wealthStanding,
  type Era,
  type EndingGame,
  type FinalDistribution,
  type GameState,
  type HistoryEntry,
  type ParentWealth,
  type Standing,
  type StartBand,
} from '../src/core';
import { FINAL_DISTRIBUTION, FINAL_DISTRIBUTION_SPEC } from '../src/data/finalDistribution';
import { JOURNEY_NOTE, MOVEMENT_TEXT, REBIRTH_LABEL, REBIRTH_NOTE, bandLabel, choiceCountText, deathLineText, journeyText, stageHeadingText } from '../src/data/endingText';
import { STAGE_TABLE } from '../src/data/lifeTable';
import { buildEraDistribution, buildFinalDistribution, distributionOf, finalDistributionSeed, finalLivesOf, FINAL_DISTRIBUTION_PARAMS, renderFinalDistributionModule, staleEras, type FinalLife } from '../scripts/finalDistributionLib';
import { ERA_CONFIG } from '../src/data/birthTable';
import { standingLabel } from '../src/data/birthText';
import { chooserFor, simulateLife, startLife } from '../scripts/simulateLib';
import { expectedMovement, numbersIn, readBand, readEnd } from '../scripts/endingReadback';

/**
 * 엔딩 회고 (SPEC-001 M5). 계산(자리·방향·연표 묶기)은 core/ending.ts의 순수 함수, 문구는 data/endingText.ts.
 * 화면 렌더는 tests/endingScreen.test.tsx, 실제 브라우저 동작은 e2e/ending.spec.ts.
 */

function lazy<T>(compute: () => T): () => T {
  let cache: { value: T } | null = null;
  return () => (cache ??= { value: compute() }).value;
}

/** 값 목록(최종 재산)으로 만든 작은 분포표 — 세 시대 모두 같다. 기대값은 아래에서 손으로 센다. */
function tableOf(values: readonly number[]): Record<Era, FinalDistribution> {
  const wealth = new Array<number>(101).fill(0);
  for (const v of values) wealth[v]++;
  const d: FinalDistribution = { simulated: values.length, lives: values.length, wealth };
  return { past: d, present: d, future: d };
}

/** 분포표를 만든 것과 같은 판들(시대마다 시드 1..4000, 무작위 전략): 표 재생성 검사와 방향 균형 검사가 함께 쓴다 (한 번만 돌린다, 약 12초) */
const FINAL_LIVES = lazy(() => Object.fromEntries(ERAS.map((era) => [era, finalLivesOf(era)])) as Record<Era, FinalLife[]>);

const EMOJI = /\p{Extended_Pictographic}/u;
const GRADE_NAMES = /(흙|동|은|금|다이아)\s*수저|다이아/;

const endingOf = (seed: number, era: Era, strategy: 'auto' | 'random' = 'random'): EndingGame => {
  const f = playToEnd(startLife(seed, era), chooserFor(strategy, seed)).state;
  return f as EndingGame;
};

describe('core 순수성: 엔딩 계산에 React·타이머·Date·Math.random이 없다', () => {
  it('core/ending.ts (주석 제외)', () => {
    const src = endingSrc.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    expect(src.length).toBeGreaterThan(1000);
    expect(src).not.toMatch(/Math\.random|Date\.now|new Date|performance\.now|setTimeout|setInterval|from 'react'|document\.|window\./);
  });
});

describe('분포표에서 자리 구하기: 직접 센 작은 표 (R-045 c)', () => {
  // 열 개의 최종 재산. 이상 비율 / 이하 비율을 손으로 센다.
  const VALUES = [10, 20, 20, 30, 40, 50, 60, 70, 80, 90];
  const table = tableOf(VALUES);
  const hist = table.present.wealth;

  it('shareAtLeast / shareAtMost: 경계(0·100·표 밖)와 동점을 포함한다', () => {
    expect(shareAtLeast(hist, 10)).toBe(100);
    expect(shareAtLeast(hist, 20)).toBe(90); // 20이 둘 있다
    expect(shareAtLeast(hist, 21)).toBe(70);
    expect(shareAtLeast(hist, 90)).toBe(10);
    expect(shareAtLeast(hist, 91)).toBe(0);
    expect(shareAtLeast(hist, 100)).toBe(0);
    expect(shareAtLeast(hist, 0)).toBe(100);
    expect(shareAtMost(hist, 10)).toBe(10);
    expect(shareAtMost(hist, 20)).toBe(30);
    expect(shareAtMost(hist, 19)).toBe(10);
    expect(shareAtMost(hist, 90)).toBe(100);
    expect(shareAtMost(hist, 0)).toBe(0);
    expect(shareAtMost(hist, 100)).toBe(100);
  });

  it('상위: 이상 비율이 50 이하 — 최고값 90은 상위 10%, 정확히 50%인 값(50)도 상위', () => {
    expect(finalWealthStanding('present', 90, table)).toEqual({ kind: 'top', percent: 10, within: false });
    expect(finalWealthStanding('present', 70, table)).toEqual({ kind: 'top', percent: 30, within: false });
    expect(finalWealthStanding('present', 50, table)).toEqual({ kind: 'top', percent: 50, within: false });
  });

  it('하위: 이상 비율이 50을 넘고 이하 비율이 50 이하 — 최저값 10은 하위 10%, 정확히 50%인 값(40)도 하위', () => {
    expect(finalWealthStanding('present', 10, table)).toEqual({ kind: 'bottom', percent: 10, within: false });
    expect(finalWealthStanding('present', 20, table)).toEqual({ kind: 'bottom', percent: 30, within: false }); // 동점 둘을 모두 센다
    expect(finalWealthStanding('present', 40, table)).toEqual({ kind: 'bottom', percent: 50, within: false });
  });

  it('중앙에 걸친 값은 퍼센트 없이 middle: 같은 값이 판의 대부분을 차지할 때', () => {
    const crowded = tableOf([10, 40, 40, 40, 40, 40, 40, 40, 40, 90]);
    expect(finalWealthStanding('present', 40, crowded)).toEqual({ kind: 'middle' });
  });

  it('표 밖의 값도 약 0%·약 100%가 아니다: 가장 높은 값보다 크면 "상위 1% 안쪽", 가장 낮은 값보다 작으면 "하위 1% 안쪽"', () => {
    expect(finalWealthStanding('present', 100, table)).toEqual({ kind: 'top', percent: 1, within: true });
    expect(finalWealthStanding('present', 0, table)).toEqual({ kind: 'bottom', percent: 1, within: true });
  });

  it('standingOf와 같은 규칙이다: 표의 모든 값(0~100)에서 퍼센트는 항상 1~50이고 상위/하위/중간 중 하나다', () => {
    for (const v of [0, ...VALUES, 100]) {
      const s = finalWealthStanding('present', v, table);
      expect(s).toEqual(standingOf(shareAtLeast(hist, v), shareAtMost(hist, v)));
      if (s.kind !== 'middle') {
        expect(s.percent).toBeGreaterThanOrEqual(1);
        expect(s.percent).toBeLessThanOrEqual(50);
      }
    }
  });

  it('빈 표(합 0)는 throw한다 — 조용히 0%로 만들지 않는다', () => {
    expect(() => shareAtLeast(new Array<number>(101).fill(0), 10)).toThrow(RangeError);
  });
});

describe('도착 자리의 점수 (standingScore)', () => {
  const top = (percent: number): Standing => ({ kind: 'top', percent, within: false });
  const bottom = (percent: number): Standing => ({ kind: 'bottom', percent, within: false });

  it('점수: 상위 N% → 100-N, 하위 N% → N, 중앙 → 50', () => {
    expect(standingScore(top(30))).toBe(70);
    expect(standingScore(top(1))).toBe(99);
    expect(standingScore(top(50))).toBe(50);
    expect(standingScore(bottom(20))).toBe(20);
    expect(standingScore(bottom(50))).toBe(50);
    expect(standingScore({ kind: 'middle' })).toBe(50);
    expect(standingScore({ kind: 'top', percent: 1, within: true })).toBe(99);
    expect(standingScore({ kind: 'bottom', percent: 1, within: true })).toBe(1);
  });
});

/** 세 시대 × 5단계의 출발선 구간: 가중치 표(birthTable.ts)에서 손으로 계산 — 구간 = [이 단계 아래 누적 %, 이 단계까지 누적 %] (아래에서부터 센 백분위). 마지막은 엔딩에 나오는 문구. */
const BANDS: Record<Era, ReadonlyArray<readonly [low: number, high: number, label: string]>> = {
  past: [
    // 가중치 40·32·20·7·1
    [0, 40, '하위 40% 안쪽'],
    [40, 72, '하위 40%와 상위 28% 사이'],
    [72, 92, '상위 8~28% 사이'],
    [92, 99, '상위 1~8% 사이'],
    [99, 100, '상위 1% 안쪽'],
  ],
  present: [
    // 25·30·28·14·3
    [0, 25, '하위 25% 안쪽'],
    [25, 55, '하위 25%와 상위 45% 사이'],
    [55, 83, '상위 17~45% 사이'],
    [83, 97, '상위 3~17% 사이'],
    [97, 100, '상위 3% 안쪽'],
  ],
  future: [
    // 30·28·24·13·5
    [0, 30, '하위 30% 안쪽'],
    [30, 58, '하위 30%와 상위 42% 사이'],
    [58, 82, '상위 18~42% 사이'],
    [82, 95, '상위 5~18% 사이'],
    [95, 100, '상위 5% 안쪽'],
  ],
};

/** 점수(1~99)로 화면에 말할 수 있는 도착 자리를 만든다: 1~49 하위, 50 딱 중간쯤, 51~99 상위 (core가 만드는 자리와 같은 모양이다) */
function standingAt(score: number): Standing {
  if (score === 50) return { kind: 'middle' };
  return score < 50 ? { kind: 'bottom', percent: score, within: false } : { kind: 'top', percent: 100 - score, within: false };
}

// 구간과 도착 점수만으로 방향을 정하는 규칙의 기준(expectedMovement)·문장을 다시 읽는 파서(readBand·readEnd)는 scripts/endingReadback.ts에 있다
// (core/ending.ts#movementOf를 호출하지 않고 화면에 적힌 숫자만 쓴다. 1000판 파이프라인 scripts/pipelineLib.ts도 같은 기준을 쓴다).

/**
 * 구간 15개 각각에서 "비슷함"인 점수의 범위(1~99로 자른 [from, to]): [low - 2, high + 2]를 손으로 계산했다.
 * 예외 하나 (R-095): 지금 세상 4단계 [83, 97]은 위쪽 끝 + 2 = 99라 점수 천장(99)에 닿는다 — 구간 바깥 칸(98·99)이 여유보다 넓지 않아 위쪽 여유가 0이고,
 * 그래서 비슷함은 [81, 97]까지, 98·99는 앞섬이다. 다른 14개 구간은 위쪽 끝 + 2가 98 이하이거나(지난 3단계 94·다가올 4단계 97) 구간 끝이 이미 99·100이다.
 * 아래쪽 여유가 0이 되는 구간(아래쪽 끝 - 2 <= 1)은 아래쪽 끝이 0인 맨 아래 단계뿐이라 값이 같다(점수 1부터 비슷함).
 */
const SAME_RANGE: Record<Era, ReadonlyArray<readonly [from: number, to: number]>> = {
  past: [[1, 42], [38, 74], [70, 94], [90, 99], [97, 99]],
  present: [[1, 27], [23, 57], [53, 85], [81, 97], [95, 99]],
  future: [[1, 32], [28, 60], [56, 84], [80, 97], [93, 99]],
};

describe('출발선 구간 (startBandOf·bandLabel, R-091): 재력 단계의 구간을 가중치 표에서 계산해 문장에 담는다', () => {
  it('세 시대 × 5단계: 구간의 끝값과 문구가 가중치 표에서 직접 계산한 값과 같다 (지난 세상 1단계 "하위 40% 안쪽", 지금 세상 2단계 "하위 25%와 상위 45% 사이")', () => {
    for (const era of ERAS) {
      expect(ERA_CONFIG[era].wealthWeights.reduce((a, b) => a + b, 0), `${era} 가중치 합`).toBe(100); // 위 계산이 성립하는 전제
      for (let w = 1; w <= 5; w++) {
        const [low, high, label] = BANDS[era][w - 1];
        const band = startBandOf(era, w as ParentWealth);
        expect([band.low, band.high], `${era} ${w}단계 구간`).toEqual([low, high]);
        expect(bandLabel(band), `${era} ${w}단계 문구`).toBe(label);
      }
    }
  });

  it('구간은 빈틈없이 이어진다: 1단계는 0에서 시작하고 한 단계의 위쪽 끝이 다음 단계의 아래쪽 끝이며 5단계는 100에서 끝난다 (출생아 전체를 덮는다)', () => {
    for (const era of ERAS) {
      expect(startBandOf(era, 1).low, era).toBe(0);
      expect(startBandOf(era, 5).high, era).toBe(100);
      for (let w = 1; w < 5; w++) expect(startBandOf(era, w as ParentWealth).high, `${era} ${w}→${w + 1}`).toBe(startBandOf(era, (w + 1) as ParentWealth).low);
    }
  });

  it('출생 결과 화면의 문구는 그대로고 이 구간의 한쪽 끝값이다: 퍼센트가 구간 문구 안에 들어 있다 (중앙에 걸친 단계는 출생 화면도 "딱 중간쯤")', () => {
    for (const era of ERAS) {
      for (let w = 1; w <= 5; w++) {
        const s = wealthStanding(era, w as ParentWealth);
        const band = startBandOf(era, w as ParentWealth);
        if (s.kind === 'middle') {
          expect(band.kind, `${era} ${w}단계 (출생 화면 "딱 중간쯤")`).toBe('center');
          continue;
        }
        expect(numbersIn(bandLabel(band)), `${era} ${w}단계 ${standingLabel(s)}`).toContain(s.percent);
      }
    }
    expect(standingLabel(wealthStanding('past', 1))).toBe('하위 약 40%');
    expect(standingLabel(wealthStanding('present', 3))).toBe('상위 약 45%');
    expect(standingLabel(wealthStanding('present', 2))).toBe('딱 중간쯤');
  });

  it('구간의 모양(bandFromRange): 맨 아래/맨 위/한쪽 절반/50%를 걸침/한쪽에 붙었지만 반대편이 50%를 넘음/전체', () => {
    const label = (low: number, high: number) => bandLabel(bandFromRange(low, high));
    expect(bandFromRange(0, 40)).toEqual({ low: 0, high: 40, kind: 'bottom', percent: 40 });
    expect(bandFromRange(97, 100)).toEqual({ low: 97, high: 100, kind: 'top', percent: 3 });
    expect(bandFromRange(55, 83)).toEqual({ low: 55, high: 83, kind: 'upper', from: 17, to: 45 });
    expect(bandFromRange(10, 30)).toEqual({ low: 10, high: 30, kind: 'lower', from: 10, to: 30 });
    expect(bandFromRange(25, 55)).toEqual({ low: 25, high: 55, kind: 'center', bottom: 25, top: 45 });
    expect(label(0, 50)).toBe('하위 50% 안쪽'); // 50까지는 그대로 말한다
    expect(label(50, 100)).toBe('상위 50% 안쪽');
    expect(label(0, 70)).toBe('상위 30% 밖'); // 한쪽에 붙었지만 70%라 "하위 70%"라고 말하지 않는다 (R-018: 퍼센트는 50 이하)
    expect(label(30, 100)).toBe('하위 30% 밖');
    expect(label(50, 70)).toBe('상위 30~50% 사이');
    expect(label(30, 50)).toBe('하위 30~50% 사이');
    expect(label(20, 80)).toBe('하위 20%와 상위 20% 사이');
    expect(label(0, 100)).toBe('모두가 같은 자리');
    // 폭이 0이거나 1% 안쪽으로 줄어도 "약 0%"·"0~"가 나오지 않는다
    expect(label(0, 0)).toBe('하위 1% 안쪽');
    expect(label(100, 100)).toBe('상위 1% 안쪽');
    expect(label(40, 40)).toBe('하위 약 40%');
    expect(label(60, 60)).toBe('상위 약 40%');
  });

  it('1% 안쪽으로 올려 말하는 구간은 판정에 쓰는 끝값도 같은 값이다 (R-096): [0, 0] → 0~1, [100, 100] → 99~100. 그 밖의 구간은 넘긴 값 그대로', () => {
    // 올려 말하기 전에는 화면이 "하위 1% 안쪽"(0~1)이라 하면서 판정은 0~0을 썼다 — 화면 숫자 ≠ 판정 숫자
    expect(bandFromRange(0, 0)).toEqual({ low: 0, high: 1, kind: 'bottom', percent: 1 });
    expect(bandFromRange(100, 100)).toEqual({ low: 99, high: 100, kind: 'top', percent: 1 });
    // 올려 말하지 않는 가장자리 구간은 그대로다: [0, 1]·[99, 100]은 이미 1%, [0, 2]·[98, 100]도 그대로
    expect(bandFromRange(0, 1)).toEqual({ low: 0, high: 1, kind: 'bottom', percent: 1 });
    expect(bandFromRange(99, 100)).toEqual({ low: 99, high: 100, kind: 'top', percent: 1 });
    expect(bandFromRange(0, 2)).toEqual({ low: 0, high: 2, kind: 'bottom', percent: 2 });
    expect(bandFromRange(98, 100)).toEqual({ low: 98, high: 100, kind: 'top', percent: 2 });
    // 올려 말한 구간에서 방향: 맨 아래 [0, 0]은 점수 1(하위 1% 안쪽)을 "구간 안"으로 읽는다(비슷함), 점수 4부터 앞섬. 맨 위 [100, 100]은 점수 99가 구간 안, 96까지 뒤쪽이 아니다
    const bottom = bandFromRange(0, 0);
    expect(movementOf(bottom, standingAt(1))).toBe('same');
    expect(movementOf(bottom, standingAt(3))).toBe('same'); // 구간 끝 1 + 여유 2
    expect(movementOf(bottom, standingAt(4))).toBe('up');
    const top = bandFromRange(100, 100);
    expect(movementOf(top, standingAt(99))).toBe('same');
    expect(movementOf(top, standingAt(97))).toBe('same'); // 구간 끝 99 - 여유 2
    expect(movementOf(top, standingAt(96))).toBe('down');
  });

  it('가능한 모든 구간(5151가지): 문구에서 읽은 구간 = 판정에 쓰는 band (R-096). 읽은 구간은 넘긴 구간과 같고, 다른 것은 1% 안쪽으로 올려 말한 [0, 0]·[100, 100]뿐이다', () => {
    let n = 0;
    const wrong: string[] = [];
    const raised: string[] = [];
    for (let low = 0; low <= 100; low++) {
      for (let high = low; high <= 100; high++) {
        const band = bandFromRange(low, high);
        const label = bandLabel(band);
        n++;
        let read: [number, number];
        try {
          read = readBand(label); // 문구 모양 10가지(하위·상위 안쪽 2, 하위·상위 밖 2, 하위·상위 A~B 사이 2, 하위·상위 약 N% 2, 하위 A%와 상위 B% 사이, 모두가 같은 자리) 전부를 읽는다
        } catch (e) {
          wrong.push(`[${low}, ${high}] "${label}": ${(e as Error).message}`);
          continue;
        }
        if (read[0] !== band.low || read[1] !== band.high) wrong.push(`[${low}, ${high}] "${label}": 문구는 ${read} 인데 판정은 [${band.low}, ${band.high}]`);
        if (band.low !== low || band.high !== high) raised.push(`[${low}, ${high}] → [${band.low}, ${band.high}]`);
      }
    }
    expect(n).toBe(5151);
    expect(wrong).toEqual([]);
    expect(raised).toEqual(['[0, 0] → [0, 1]', '[100, 100] → [99, 100]']);
  });

  it('문구 파서(readBand)가 문구의 모든 모양을 읽는다: 직접 적은 문구 → 구간', () => {
    expect(readBand('하위 40% 안쪽')).toEqual([0, 40]);
    expect(readBand('상위 3% 안쪽')).toEqual([97, 100]);
    expect(readBand('상위 30% 밖')).toEqual([0, 70]);
    expect(readBand('하위 30% 밖')).toEqual([30, 100]);
    expect(readBand('상위 8~28% 사이')).toEqual([72, 92]);
    expect(readBand('하위 30~50% 사이')).toEqual([30, 50]);
    expect(readBand('하위 약 40%')).toEqual([40, 40]);
    expect(readBand('상위 약 40%')).toEqual([60, 60]);
    expect(readBand('하위 25%와 상위 45% 사이')).toEqual([25, 55]);
    expect(readBand('모두가 같은 자리')).toEqual([0, 100]);
    expect(() => readBand('비슷한 자리')).toThrow();
  });

  it('가능한 모든 구간(0 <= low <= high <= 100, 5151가지): 문구에 0~·~100·약 0%가 없고 말하는 숫자는 모두 1~50이며, 두 끝값이 나오는 구간은 작은 수가 앞이다', () => {
    let n = 0;
    const bad: string[] = [];
    for (let low = 0; low <= 100; low++) {
      for (let high = low; high <= 100; high++) {
        const text = bandLabel(bandFromRange(low, high));
        n++;
        if (/(^|[^\d])0(~|%)|~100|약 0%|100%/.test(text)) bad.push(`${low}~${high}: ${text} (0·100 끝값)`);
        if (numbersIn(text).some((x) => x < 1 || x > 50)) bad.push(`${low}~${high}: ${text} (1~50 밖)`);
        const range = /(\d+)~(\d+)%/.exec(text);
        if (range && Number(range[1]) > Number(range[2])) bad.push(`${low}~${high}: ${text} (큰 수가 앞)`);
      }
    }
    expect(n).toBe(5151);
    expect(bad).toEqual([]);
  });

  it('맞지 않는 구간은 throw한다: 정수가 아니거나, 0~100 밖이거나, low가 high보다 크다', () => {
    for (const [low, high] of [
      [-1, 5],
      [5, 101],
      [60, 40],
      [1.5, 3],
      [3, 4.5],
      [Number.NaN, 5],
    ])
      expect(() => bandFromRange(low, high), `${low},${high}`).toThrow(RangeError);
  });
});

describe('출발선 구간에서 도착 자리의 방향 (movementOf, BAND_GRACE, R-091): 구간 안은 비슷함, 위는 앞섬, 아래는 뒤쪽', () => {
  it('여유 BAND_GRACE는 2점이다 (근거: 분포표 표본 잡음 ±0.8점의 약 2.5배, 정수로 반올림해 말하는 1~2점 차)', () => {
    expect(BAND_GRACE).toBe(2);
  });

  it('세 시대 × 5단계 × 도착 점수 1~99: 비슷함의 범위가 손으로 계산한 경계와 같고, 그 아래는 뒤쪽, 그 위는 앞섬이다', () => {
    for (const era of ERAS) {
      for (let w = 1; w <= 5; w++) {
        const band = startBandOf(era, w as ParentWealth);
        const [from, to] = SAME_RANGE[era][w - 1];
        const wrong: string[] = [];
        for (let s = 1; s <= 99; s++) {
          const want = s < from ? 'down' : s > to ? 'up' : 'same';
          if (movementOf(band, standingAt(s)) !== want) wrong.push(`점수 ${s}: ${movementOf(band, standingAt(s))} (기대 ${want})`);
        }
        expect(wrong, `${era} ${w}단계 [${band.low}, ${band.high}]`).toEqual([]);
      }
    }
  });

  it('경계를 한 점씩: 지금 세상 3단계 "상위 17~45% 사이"(구간 [55, 83]) — 도착 상위 약 46%(점수 54)는 1점 차라 뒤쪽이 아니라 비슷함 (R-091 증상), 상위 약 48%(52)부터 뒤쪽', () => {
    const band = startBandOf('present', 3);
    const top = (percent: number): Standing => ({ kind: 'top', percent, within: false });
    expect(movementOf(band, top(45))).toBe('same'); // 구간의 끝 (55)
    expect(movementOf(band, top(46))).toBe('same'); // 54: 구간 밖 1점
    expect(movementOf(band, top(47))).toBe('same'); // 53: 구간 밖 2점 = 여유의 끝
    expect(movementOf(band, top(48))).toBe('down'); // 52: 구간 밖 3점
    expect(movementOf(band, top(17))).toBe('same'); // 83: 위쪽 끝
    expect(movementOf(band, top(15))).toBe('same'); // 85: 위로 2점
    expect(movementOf(band, top(14))).toBe('up'); // 86: 위로 3점
    // 여유를 0으로 두면 같은 1점 차가 뒤쪽/앞섬이 된다 (대조: 여유가 실제로 쓰인다)
    expect(movementOf(band, top(46), 0)).toBe('down');
    expect(movementOf(band, top(16), 0)).toBe('up');
    expect(movementOf(band, top(45), 0)).toBe('same');
    expect(movementOf(band, top(17), 0)).toBe('same');
  });

  it('구간 안은 언제나 비슷함이다: 여유와 상관없이(여유 0에서도) 세 시대 × 5단계 × 구간 안의 모든 점수', () => {
    for (const era of ERAS) {
      for (let w = 1; w <= 5; w++) {
        const band = startBandOf(era, w as ParentWealth);
        const wrong: string[] = [];
        for (let s = Math.max(1, band.low); s <= Math.min(99, band.high); s++) {
          if (movementOf(band, standingAt(s), 0) !== 'same' || movementOf(band, standingAt(s)) !== 'same') wrong.push(`점수 ${s}`);
        }
        expect(wrong, `${era} ${w}단계 [${band.low}, ${band.high}]`).toEqual([]);
      }
    }
  });

  it('구조상 없는 방향: 맨 아래 단계는 뒤쪽이, 맨 위 단계는 앞섬이 나올 수 없다 (어떤 도착 자리여도, 세 시대)', () => {
    for (const era of ERAS) {
      const lowest = startBandOf(era, 1);
      const highest = startBandOf(era, 5);
      const wrong: string[] = [];
      for (let s = 1; s <= 99; s++) {
        if (movementOf(lowest, standingAt(s)) === 'down') wrong.push(`1단계 점수 ${s}: 뒤쪽`);
        if (movementOf(highest, standingAt(s)) === 'up') wrong.push(`5단계 점수 ${s}: 앞섬`);
      }
      expect(wrong, era).toEqual([]);
      expect(movementOf(lowest, standingAt(99)), `${era} 1단계에서 맨 위로`).toBe('up'); // 반대쪽은 있다
      expect(movementOf(highest, standingAt(1)), `${era} 5단계에서 맨 아래로`).toBe('down');
    }
  });

  it('도착이 "딱 중간쯤"(점수 50)이면: 구간이 50을 걸치면 비슷함, 구간이 50보다 한참 아래면 앞섬, 한참 위면 뒤쪽 (구간 [25,55] / [0,40] / [72,92]), 여유 끝은 [0,48]까지 비슷함·[0,47]은 앞섬', () => {
    const middle: Standing = { kind: 'middle' };
    expect(movementOf(bandFromRange(25, 55), middle)).toBe('same');
    expect(movementOf(bandFromRange(0, 40), middle)).toBe('up');
    expect(movementOf(bandFromRange(72, 92), middle)).toBe('down');
    expect(movementOf(bandFromRange(0, 48), middle)).toBe('same'); // 50 - 48 = 2 = 여유
    expect(movementOf(bandFromRange(0, 47), middle)).toBe('up'); // 3
    expect(movementOf(bandFromRange(52, 80), middle)).toBe('same'); // 52 - 50 = 2
    expect(movementOf(bandFromRange(53, 80), middle)).toBe('down'); // 3
  });

  it('가능한 모든 구간(5151가지) × 도착 점수 1~99: 점수가 오를수록 방향은 뒤쪽 → 비슷함 → 앞섬 순서로만 바뀌고 (되돌아오지 않는다), 문구에서 읽은 구간으로 테스트가 따로 적은 규칙과 같다 (R-095·R-096)', () => {
    const rank = { down: 0, same: 1, up: 2 } as const;
    const wrong: string[] = [];
    for (let low = 0; low <= 100; low++) {
      for (let high = low; high <= 100; high++) {
        const band = bandFromRange(low, high);
        const [readLow, readHigh] = readBand(bandLabel(band)); // 기대값은 화면에 적힌 숫자에서 읽은 구간으로 정한다 (넘긴 값이 아니라)
        let prev = 0;
        for (let s = 1; s <= 99; s++) {
          const m = movementOf(band, standingAt(s));
          if (rank[m] < prev) wrong.push(`[${low}, ${high}] 점수 ${s}: 되돌아옴`);
          prev = rank[m];
          if (m !== expectedMovement(readLow, readHigh, s, BAND_GRACE)) wrong.push(`[${low}, ${high}] 점수 ${s}: ${m}`);
        }
      }
    }
    expect(wrong.slice(0, 10)).toEqual([]);
  });

  it('점수 천장·바닥에 닿는 여유는 0이다 (R-095): 지금 세상 4단계 "상위 3~17% 사이" [83, 97]에서 상위 약 2%(98)·상위 1% 안쪽(99)은 앞섬, 상위 약 3%(97)는 구간 끝이라 비슷함', () => {
    const band = startBandOf('present', 4);
    expect([band.low, band.high]).toEqual([83, 97]);
    const top = (percent: number, within = false): Standing => ({ kind: 'top', percent, within });
    expect(movementOf(band, top(3))).toBe('same'); // 97 = 구간의 끝
    expect(movementOf(band, top(2))).toBe('up'); // 98: 구간 끝 97 + 여유 2 = 99라 여유를 두면 천장(99)에 닿아 앞섬이 불가능했다
    expect(movementOf(band, top(1))).toBe('up'); // 99
    expect(movementOf(band, top(1, true))).toBe('up'); // 상위 1% 안쪽 (표 밖 재산)
    expect(movementOf(band, top(17))).toBe('same'); // 83 = 구간의 다른 끝
    // 아래쪽은 그대로 여유 2다: 구간 아래쪽 끝 83 - 2 = 81까지 비슷함
    expect(movementOf(band, top(19))).toBe('same'); // 81
    expect(movementOf(band, top(20))).toBe('down'); // 80
    // 같은 단계의 문장도 이어진다: 상위 3~17% 사이의 집 → 상위 1% 안쪽 = 앞선 자리 (예전에는 "비슷한 자리"라 부유한 집이 더 부유해진 것이 안 보였다)
    const l = endingOf(7, 'present');
    const table = tableOf([10, 20, 20, 30, 40, 50, 60, 70, 80, 90]);
    const g: EndingGame = { ...l, character: { ...l.character, parentWealth: 4 }, stats: { ...l.stats, wealth: 100 }, death: { age: 70, cause: '노환' }, age: 70 };
    const r = reviewEnding(g, table);
    expect(r.journey.kind === 'compared' && r.journey.end).toEqual({ kind: 'top', percent: 1, within: true });
    expect(journeyText(r.journey)).toBe('상위 3~17% 사이의 집에서 태어나, 상위 1% 안쪽의 형편으로 생을 마쳤다.');
    expect(r.journey.kind === 'compared' && r.journey.movement).toBe('up');
  });

  it('여유 0 처리의 일반 규칙 (R-095): 구간 바깥에 여유보다 넓은 칸이 남지 않는 쪽만 여유가 0이다 — 위쪽은 high + 2 >= 99, 아래쪽은 low - 2 <= 1', () => {
    const band = (low: number, high: number) => bandFromRange(low, high);
    // 위쪽: 구간 끝 97(바깥 칸 98·99 = 2칸 = 여유) → 98부터 앞섬 / 구간 끝 98(바깥 칸 99 = 1칸) → 99가 앞섬 / 구간 끝 96(바깥 칸 97·98·99 = 3칸 > 여유) → 여유를 두어 99만 앞섬
    expect(movementOf(band(60, 97), standingAt(98))).toBe('up');
    expect(movementOf(band(60, 98), standingAt(99))).toBe('up');
    expect(movementOf(band(60, 96), standingAt(98))).toBe('same'); // 구간 끝 96 + 여유 2 = 98까지 비슷함
    expect(movementOf(band(60, 96), standingAt(99))).toBe('up');
    expect(movementOf(band(60, 95), standingAt(97))).toBe('same');
    expect(movementOf(band(60, 95), standingAt(98))).toBe('up');
    // 구간 끝이 99·100이면 위쪽 바깥 칸이 없으니 앞섬은 구조상 없다
    expect(movementOf(band(60, 99), standingAt(99))).toBe('same');
    expect(movementOf(band(60, 100), standingAt(99))).toBe('same');
    // 아래쪽 (대칭): 구간 끝 3(바깥 칸 1·2 = 2칸 = 여유) → 2부터 뒤쪽 / 구간 끝 2(바깥 칸 1) → 1이 뒤쪽 / 구간 끝 4(바깥 칸 1·2·3) → 여유를 두어 1만 뒤쪽
    expect(movementOf(band(3, 40), standingAt(2))).toBe('down');
    expect(movementOf(band(2, 40), standingAt(1))).toBe('down');
    expect(movementOf(band(4, 40), standingAt(2))).toBe('same'); // 구간 끝 4 - 여유 2 = 2까지 비슷함
    expect(movementOf(band(4, 40), standingAt(1))).toBe('down');
    expect(movementOf(band(5, 40), standingAt(3))).toBe('same');
    expect(movementOf(band(5, 40), standingAt(2))).toBe('down');
    expect(movementOf(band(0, 40), standingAt(1))).toBe('same'); // 구간 끝이 0·1이면 아래쪽 바깥 칸이 없다
    expect(movementOf(band(1, 40), standingAt(1))).toBe('same');
    // 가운데 구간은 양쪽 모두 여유 2 그대로다 (천장·바닥과 멀다)
    expect(movementOf(band(30, 60), standingAt(62))).toBe('same');
    expect(movementOf(band(30, 60), standingAt(63))).toBe('up');
    expect(movementOf(band(30, 60), standingAt(28))).toBe('same');
    expect(movementOf(band(30, 60), standingAt(27))).toBe('down');
    // 여유를 직접 넘기는 경우도 같은 규칙이다 (grace 5: 위쪽 high + 5 >= 99면 0)
    expect(movementOf(band(60, 94), standingAt(95), 5)).toBe('up');
    expect(movementOf(band(60, 93), standingAt(95), 5)).toBe('same');
    expect(movementOf(band(60, 93), standingAt(99), 5)).toBe('up');
    // grace 0이면 언제나 구간 밖은 곧바로 앞섬/뒤쪽 (R-095와 무관하게 그대로)
    expect(movementOf(band(30, 60), standingAt(61), 0)).toBe('up');
    expect(movementOf(band(30, 60), standingAt(29), 0)).toBe('down');
  });

  it('여유 0 처리는 현재 15개 구간 중 지금 세상 4단계 하나에만 걸린다: 위쪽 높이 + 여유가 99 이상이거나 아래쪽 끝 - 여유가 1 이하인 구간', () => {
    const touched: string[] = [];
    for (const era of ERAS) {
      for (let w = 1; w <= 5; w++) {
        const b = startBandOf(era, w as ParentWealth);
        // 구간 끝이 99·100이거나 0인 구간은 어차피 그 방향이 없다(구조): 여유 0 처리가 값을 바꾸는 구간만 센다
        if (b.high < 99 && b.high + BAND_GRACE >= 99) touched.push(`${era} ${w}단계 위쪽 [${b.low}, ${b.high}]`);
        if (b.low > 1 && b.low - BAND_GRACE <= 1) touched.push(`${era} ${w}단계 아래쪽 [${b.low}, ${b.high}]`);
      }
    }
    expect(touched).toEqual(['present 4단계 위쪽 [83, 97]']);
  });
});

describe('스무 살 전에 끝난 인생 (reachedIndependence)', () => {
  it('청년 단계 진입(20세) 전에 죽으면 false, 20세부터 true — 그때부터 재산이 "내가 가진 것"이다', () => {
    expect(STAGE_TABLE.youth.startAge).toBe(20);
    expect(reachedIndependence(0)).toBe(false);
    expect(reachedIndependence(19)).toBe(false);
    expect(reachedIndependence(20)).toBe(true);
    expect(reachedIndependence(85)).toBe(true);
  });

  it('실제로 스무 살 전에 끝난 인생(분포표와 같은 시드 4000판에서 찾는다, 지난 세상)은 early, 스무 살 넘어 끝난 인생은 compared다', () => {
    // 19세 이하에서 죽은 판은 재산이 집안 형편 그대로고, 20세 이상까지 산 판은 독립 환산을 거쳤다 — 근거: core/life.ts#finishYear
    const lives = Array.from({ length: 4000 }, (_, i) => endingOf(finalDistributionSeed(i + 1), 'past'));
    const early = lives.filter((l) => l.death.age < 20);
    expect(early.length).toBeGreaterThan(0); // 유년기 사망은 드물지만 있다(R-045 a)
    for (const l of early) {
      const r = reviewEnding(l);
      expect(r.journey.kind).toBe('early');
      expect(journeyText(r.journey)).not.toContain('형편으로 생을 마쳤다');
    }
    for (const l of lives.filter((x) => x.death.age >= 20).slice(0, 300)) expect(reviewEnding(l).journey.kind).toBe('compared');
  });
});

describe('reviewEnding: 출발선 대비 (R-045 c)', () => {
  const lives = lazy(() => ERAS.flatMap((era) => Array.from({ length: 120 }, (_, i) => endingOf(i * 104729 + 5, era, i % 2 === 0 ? 'random' : 'auto'))));

  it('출발선은 재력 단계의 구간이다: startBandOf(시대, 부모 재력) — 출생 결과 화면과 같은 가중치 표에서 계산한다 (R-091)', () => {
    for (const l of lives()) {
      const j = reviewEnding(l).journey;
      expect(j.start).toEqual(startBandOf(l.era, l.character.parentWealth));
    }
  });

  it('도착은 분포표에서 구한 자리다: 최종 재산과 시대만으로 정해진다', () => {
    for (const l of lives().filter((x) => x.death.age >= 20)) {
      const j = reviewEnding(l).journey;
      expect(j.kind).toBe('compared');
      if (j.kind === 'compared') {
        expect(j.end).toEqual(finalWealthStanding(l.era, l.stats.wealth));
        expect(j.movement).toBe(movementOf(j.start, j.end));
      }
    }
  });

  it('원값을 빼서 견주지 않는다: 출생 스냅샷의 재산(집안 형편)을 바꿔도 회고는 같고, 부모 재력이 달라야 출발선이 달라진다', () => {
    const l = lives().find((x) => x.death.age >= 20)!;
    const base = reviewEnding(l);
    for (const wealth of [0, 50, 100]) expect(reviewEnding({ ...l, birthStats: { ...l.birthStats, wealth } })).toEqual(base);
    const richer = { ...l, character: { ...l.character, parentWealth: 5 as const } };
    const j = reviewEnding(richer).journey;
    expect(j.start).toEqual(startBandOf(l.era, 5));
  });

  it('작은 표로 문장까지: 지금 세상 4단계(상위 3~17% 사이)·1단계(하위 25% 안쪽)·3단계(상위 17~45% 사이)·2단계(하위 25%와 상위 45% 사이) 출발선에서 도착 문장과 방향이 직접 적은 기대와 같다', () => {
    const l = lives().find((x) => x.death.age >= 20 && x.era === 'present')!;
    const table = tableOf([10, 20, 20, 30, 40, 50, 60, 70, 80, 90]);
    const born = (wealth: ParentWealth, final: number): EndingGame => ({ ...l, character: { ...l.character, parentWealth: wealth }, stats: { ...l.stats, wealth: final } });
    const sentence = (g: EndingGame) => {
      const r = reviewEnding(g, table);
      return `${journeyText(r.journey)} ${r.journey.kind === 'compared' ? MOVEMENT_TEXT[r.journey.movement] : ''}`;
    };
    // 4단계: 구간 [83, 97]. 재산 90 = 상위 약 10% = 점수 90 -> 구간 안
    const rich = reviewEnding(born(4, 90), table);
    expect(rich.journey).toEqual({
      kind: 'compared',
      start: { low: 83, high: 97, kind: 'upper', from: 3, to: 17 },
      end: { kind: 'top', percent: 10, within: false },
      movement: 'same',
    });
    expect(sentence(born(4, 90))).toBe('상위 3~17% 사이의 집에서 태어나, 상위 약 10%의 형편으로 생을 마쳤다. 출발선과 비슷한 자리에 머물렀다.');
    // 1단계: 구간 [0, 25]. 하위 약 10%도, 재산 0(하위 1% 안쪽)도 구간 안이라 비슷함 — 맨 아래 단계는 뒤쪽이 될 수 없다 (R-084 증상: 예전에는 "뒤쪽")
    expect(sentence(born(1, 10))).toBe('하위 25% 안쪽의 집에서 태어나, 하위 약 10%의 형편으로 생을 마쳤다. 출발선과 비슷한 자리에 머물렀다.');
    expect(sentence(born(1, 0))).toBe('하위 25% 안쪽의 집에서 태어나, 하위 1% 안쪽의 형편으로 생을 마쳤다. 출발선과 비슷한 자리에 머물렀다.');
    expect(sentence(born(1, 90))).toBe('하위 25% 안쪽의 집에서 태어나, 상위 약 10%의 형편으로 생을 마쳤다. 출발선보다 앞선 자리에 이르렀다.');
    // 3단계: 구간 [55, 83]. 하위 약 10%는 구간 아래(뒤쪽), 상위 약 10%(점수 90)는 구간 위(앞섬), 상위 약 30%(점수 70)는 구간 안
    expect(sentence(born(3, 10))).toBe('상위 17~45% 사이의 집에서 태어나, 하위 약 10%의 형편으로 생을 마쳤다. 출발선보다 뒤쪽에 서 있었다.');
    expect(sentence(born(3, 90))).toBe('상위 17~45% 사이의 집에서 태어나, 상위 약 10%의 형편으로 생을 마쳤다. 출발선보다 앞선 자리에 이르렀다.');
    expect(sentence(born(3, 70))).toBe('상위 17~45% 사이의 집에서 태어나, 상위 약 30%의 형편으로 생을 마쳤다. 출발선과 비슷한 자리에 머물렀다.');
    // 2단계: 구간 [25, 55]. 재산 50 = 상위 약 50%(점수 50) 구간 안, 재산 20 = 하위 약 30%(점수 30) 구간 안, 재산 10 = 하위 약 10% 구간 아래(뒤쪽)
    expect(sentence(born(2, 50))).toBe('하위 25%와 상위 45% 사이의 집에서 태어나, 상위 약 50%의 형편으로 생을 마쳤다. 출발선과 비슷한 자리에 머물렀다.');
    expect(sentence(born(2, 20))).toBe('하위 25%와 상위 45% 사이의 집에서 태어나, 하위 약 30%의 형편으로 생을 마쳤다. 출발선과 비슷한 자리에 머물렀다.');
    expect(sentence(born(2, 10))).toBe('하위 25%와 상위 45% 사이의 집에서 태어나, 하위 약 10%의 형편으로 생을 마쳤다. 출발선보다 뒤쪽에 서 있었다.');
  });

  it('학력·행복·관계만 처음 → 마지막 원값으로 견준다 (재산·건강·외모는 견주지 않는다)', () => {
    expect(COMPARABLE_STATS).toEqual(['education', 'happiness', 'relationships']);
    for (const l of lives().slice(0, 50)) {
      const r = reviewEnding(l);
      expect(r.changes.map((c) => c.stat)).toEqual(['education', 'happiness', 'relationships']);
      for (const c of r.changes) {
        expect(c.from).toBe(l.birthStats[c.stat]);
        expect(c.to).toBe(l.stats[c.stat]);
      }
    }
  });

  it('20세 전에 끝난 인생: 도착 자리를 말하지 않고 출발선(집안 형편)만 있다', () => {
    const l = lives().find((x) => x.death.age >= 20)!;
    const young: EndingGame = { ...l, age: 9, death: { age: 9, cause: '갑작스러운 병' } };
    const r = reviewEnding(young);
    expect(r.journey).toEqual({ kind: 'early', start: startBandOf(l.era, l.character.parentWealth) });
    const text = journeyText(r.journey);
    // R-083: 출발선만 담담하게. 게임 용어("내가 가진 것")도, 윗줄(사망·선택 수)이 이미 말한 "생이 끝났다"도 되풀이하지 않는다.
    expect(text).toBe(`${bandLabel(startBandOf(l.era, l.character.parentWealth))}의 집에서 태어났다.`);
    expect(text).not.toContain('형편으로 생을 마쳤다');
    expect(text).not.toContain('내가 가진 것');
    expect(text).not.toContain('생이 끝');
    expect(text).not.toContain('견줄');
  });

  it('선택의 순간 수는 연표의 선택 기록 수와 같다', () => {
    for (const l of lives().slice(0, 40)) expect(reviewEnding(l).choiceCount).toBe(l.history.filter((h) => h.kind === 'choice').length);
  });
});

describe('생애 연표 (buildTimeline): 하나도 빠뜨리지 않고 단계별로 묶는다', () => {
  const lives = lazy(() => ERAS.flatMap((era) => Array.from({ length: 150 }, (_, i) => endingOf(i * 7919 + 13, era))));

  it('모든 항목이 시간순 그대로 들어 있다: 묶은 것을 이어 붙이면 연표와 같다', () => {
    for (const l of lives()) {
      const groups = buildTimeline(l.history);
      expect(groups.flatMap((g) => g.entries)).toEqual(l.history);
    }
  });

  it('선택한 순간(choice)은 한 줄도 빠지지 않고 고른 선택지 문구와 함께 있다', () => {
    for (const l of lives()) {
      const groups = buildTimeline(l.history);
      const picked = groups.flatMap((g) => g.entries).filter((e) => e.kind === 'choice');
      expect(picked.length).toBe(l.history.filter((h) => h.kind === 'choice').length);
      for (const e of picked) {
        expect(e.choice, `${l.era} ${l.seed}: 고른 선택지 문구`).toBeTruthy();
        expect(e.title).toBeTruthy();
      }
    }
  });

  it('단계 순서(영유아 → 노년)로 나뉘고, 항목은 자기 나이가 속한 단계에 있으며, 출생은 영유아 맨 앞·사망은 마지막 항목이다', () => {
    for (const l of lives()) {
      const groups = buildTimeline(l.history);
      const order = groups.map((g) => STAGES.indexOf(g.stage));
      expect(order).toEqual([...order].sort((a, b) => a - b));
      expect(new Set(order).size).toBe(order.length);
      for (const g of groups) for (const e of g.entries) expect(stageOf(e.age)).toBe(g.stage);
      expect(groups[0].stage).toBe('infant');
      expect(groups[0].entries[0].age).toBe(0);
      const last = groups[groups.length - 1].entries;
      expect(last[last.length - 1].kind).toBe('death');
      expect(stageOf(l.death.age)).toBe(groups[groups.length - 1].stage);
    }
  });

  it('가장 긴 연표(약 117줄)도 한 줄도 줄이지 않는다: 단계 기록 5 + 서술 + 선택 40 + 사망', () => {
    const history: HistoryEntry[] = [{ age: 0, kind: 'stage', text: '출생' }];
    let age = 1;
    for (const stage of ['school', 'youth', 'middle', 'senior'] as const) history.push({ age: STAGE_TABLE[stage].startAge, kind: 'stage', text: `${stage} 진입` });
    while (history.length < 116) {
      history.push(age % 3 === 0 ? { age, kind: 'choice', title: `선택${age}`, choice: `고른 것${age}`, text: '결과' } : { age, kind: 'event', title: `일${age}`, text: '일어난 일' });
      age = (age + 1) % 109;
      history.sort((a, b) => a.age - b.age);
    }
    history.push({ age: 110, kind: 'death', text: '세상을 떠났다.' });
    const groups = buildTimeline(history);
    expect(groups.flatMap((g) => g.entries)).toHaveLength(history.length);
    expect(groups.flatMap((g) => g.entries).filter((e) => e.kind === 'choice')).toHaveLength(history.filter((h) => h.kind === 'choice').length);
    expect(history.length).toBeGreaterThanOrEqual(117);
  });

  it('stageRangeOf: 영유아 0~6 / 학창 7~19 / 청년 20~39 / 중년 40~64 / 노년 65~', () => {
    expect(stageRangeOf('infant')).toEqual({ from: 0, to: 6 });
    expect(stageRangeOf('school')).toEqual({ from: 7, to: 19 });
    expect(stageRangeOf('youth')).toEqual({ from: 20, to: 39 });
    expect(stageRangeOf('middle')).toEqual({ from: 40, to: 64 });
    expect(stageRangeOf('senior')).toEqual({ from: 65, to: null });
  });
});

describe('엔딩 문구 (data/endingText.ts): 담담하고 R-018 표현 규칙을 지킨다', () => {
  const top = (percent: number, within = false): Standing => ({ kind: 'top', percent, within });
  const bottom = (percent: number, within = false): Standing => ({ kind: 'bottom', percent, within });

  it('출발선 대비 문장: 직접 적은 기대 문장 (맨 아래·한쪽 절반·가운데 걸침·맨 위 구간 × 상위·하위·중앙·1% 안쪽 도착)', () => {
    const j = (start: StartBand, end: Standing) => journeyText({ kind: 'compared', start, end, movement: movementOf(start, end) });
    expect(j(bandFromRange(55, 83), top(23))).toBe('상위 17~45% 사이의 집에서 태어나, 상위 약 23%의 형편으로 생을 마쳤다.');
    expect(j(bandFromRange(0, 40), bottom(4))).toBe('하위 40% 안쪽의 집에서 태어나, 하위 약 4%의 형편으로 생을 마쳤다.');
    expect(j(bandFromRange(25, 55), { kind: 'middle' })).toBe('하위 25%와 상위 45% 사이의 집에서 태어나, 딱 중간쯤의 형편으로 생을 마쳤다.');
    expect(j(bandFromRange(0, 25), top(1, true))).toBe('하위 25% 안쪽의 집에서 태어나, 상위 1% 안쪽의 형편으로 생을 마쳤다.');
    expect(j(bandFromRange(97, 100), bottom(1, true))).toBe('상위 3% 안쪽의 집에서 태어나, 하위 1% 안쪽의 형편으로 생을 마쳤다.');
    expect(j(bandFromRange(92, 99), top(30))).toBe('상위 1~8% 사이의 집에서 태어나, 상위 약 30%의 형편으로 생을 마쳤다.');
  });

  it('20세 전 사망 줄도 같은 구간 표현이다: "{구간}의 집에서 태어났다."', () => {
    expect(journeyText({ kind: 'early', start: bandFromRange(0, 40) })).toBe('하위 40% 안쪽의 집에서 태어났다.');
    expect(journeyText({ kind: 'early', start: bandFromRange(25, 55) })).toBe('하위 25%와 상위 45% 사이의 집에서 태어났다.');
    expect(journeyText({ kind: 'early', start: bandFromRange(72, 92) })).toBe('상위 8~28% 사이의 집에서 태어났다.');
    expect(journeyText({ kind: 'early', start: bandFromRange(99, 100) })).toBe('상위 1% 안쪽의 집에서 태어났다.');
  });

  it('방향 문장 세 가지', () => {
    expect(MOVEMENT_TEXT).toEqual({
      up: '출발선보다 앞선 자리에 이르렀다.',
      same: '출발선과 비슷한 자리에 머물렀다.',
      down: '출발선보다 뒤쪽에 서 있었다.',
    });
    // R-083: "뒤쪽 자리에 이르렀다"는 성취처럼 읽혀 어색했다. 세 문장은 모두 한 문장이고, 앞 문장("…생을 마쳤다.")의 "마쳤다"를 되풀이하지 않는다.
    for (const t of Object.values(MOVEMENT_TEXT)) {
      expect(t.startsWith('출발선')).toBe(true);
      expect(t).not.toContain('마쳤다');
    }
    expect(MOVEMENT_TEXT.down).not.toContain('이르렀다');
  });

  it('사망·선택 수·단계 제목', () => {
    expect(deathLineText({ age: 83, cause: '노환' })).toBe('83세에 세상을 떠났다. 원인: 노환.');
    expect(choiceCountText(22)).toBe('살아오며 22번의 선택을 했다.');
    expect(choiceCountText(0)).toBe('선택을 내려야 하는 순간이 오기 전에 생이 끝났다.');
    expect(STAGES.map(stageHeadingText)).toEqual(['영유아 · 0~6세', '학창 · 7~19세', '청년 · 20~39세', '중년 · 40~64세', '노년 · 65세~']);
  });

  it('모든 문구에 느낌표·이모지·등급명(흙/동/은/금/다이아 수저)이 없다', () => {
    const texts = [
      ...Object.values(MOVEMENT_TEXT),
      JOURNEY_NOTE,
      REBIRTH_LABEL,
      REBIRTH_NOTE,
      choiceCountText(0),
      choiceCountText(9),
      deathLineText({ age: 3, cause: '사고' }),
      journeyText({ kind: 'early', start: bandFromRange(55, 83) }),
      journeyText({ kind: 'compared', start: bandFromRange(0, 30), end: top(20), movement: 'up' }),
      journeyText({ kind: 'compared', start: bandFromRange(25, 55), end: bottom(20), movement: 'same' }),
      ...STAGES.map(stageHeadingText),
    ];
    for (const t of texts) {
      expect(t, t).not.toMatch(/[!！]/);
      expect(t, t).not.toMatch(EMOJI);
      expect(t, t).not.toMatch(GRADE_NAMES);
    }
  });

  it('전수 확인: 세 시대 × 판들의 출발선 대비 문장에 50을 넘는 숫자도, 약 0%·약 100%도, 0~·~100 같은 끝값도 없다', () => {
    let n = 0;
    for (const era of ERAS) {
      for (let i = 0; i < 250; i++) {
        const l = endingOf(i * 15485863 + 7, era, i % 3 === 0 ? 'auto' : 'random');
        const text = journeyText(reviewEnding(l).journey);
        n++;
        for (const p of numbersIn(text)) {
          expect(p, text).toBeGreaterThanOrEqual(1);
          expect(p, text).toBeLessThanOrEqual(50);
        }
        expect(text).not.toMatch(/약 (0|100)%|(^|[^\d])0~|~100/);
        expect(text).not.toMatch(/!/);
      }
    }
    expect(n).toBe(750);
  });
});

describe('분포표 (data/finalDistribution.ts): 현재 엔진·이벤트에서 다시 만든 표와 같다 (R-045 c)', () => {
  it('표의 모양: 시대마다 101칸·음이 아닌 정수·합 = lives, 판 수 4000 중 스무 살 넘어 마친 판이 99% 이상', () => {
    expect(validateFinalDistribution(FINAL_DISTRIBUTION)).toEqual([]);
    for (const era of ERAS) {
      const d = FINAL_DISTRIBUTION[era];
      expect(d.simulated, era).toBe(FINAL_DISTRIBUTION_PARAMS.simulated);
      expect(d.lives / d.simulated, era).toBeGreaterThan(0.99);
      expect(d.lives, era).toBeLessThanOrEqual(d.simulated);
    }
  });

  it('표의 근거 표기(시드·판 수·전략)가 생성 상수와 같다', () => {
    expect(FINAL_DISTRIBUTION_SPEC.simulated).toBe(FINAL_DISTRIBUTION_PARAMS.simulated);
    expect(FINAL_DISTRIBUTION_SPEC.strategy).toBe(FINAL_DISTRIBUTION_PARAMS.strategy);
    expect(FINAL_DISTRIBUTION_SPEC.seed).toBe(`i * ${FINAL_DISTRIBUTION_PARAMS.seedMul} + ${FINAL_DISTRIBUTION_PARAMS.seedAdd}`);
    expect(finalDistributionSeed(1)).toBe((FINAL_DISTRIBUTION_PARAMS.seedMul + FINAL_DISTRIBUTION_PARAMS.seedAdd) >>> 0);
  });

  it('파일은 생성기의 출력 그대로다 (손으로 고치지 않았다)', () => {
    expect(finalDistributionSrc.replace(/\r\n/g, '\n')).toBe(renderFinalDistributionModule(FINAL_DISTRIBUTION));
  });

  it(
    '현재 엔진·이벤트로 같은 시드·판 수로 다시 만들면 같은 표다 — 다르면 표가 낡았다: npx vite-node scripts/finalDistribution.ts (또는 점검만: npm run check:dist)',
    () => {
      const regenerated = Object.fromEntries(ERAS.map((era) => [era, distributionOf(FINAL_LIVES()[era])])) as Record<Era, FinalDistribution>;
      expect(
        staleEras(regenerated, FINAL_DISTRIBUTION),
        '분포표가 낡았다 (이벤트·밸런스를 고쳤다면 npx vite-node scripts/finalDistribution.ts 로 다시 만든다. 절차: docs/data/events-schema.md 10절)',
      ).toEqual([]);
    },
    180_000,
  );

  it('생성기(buildFinalDistribution)는 판 수를 줄여도 판들에서 센 것과 같다: 시대별 200판', () => {
    const small = buildFinalDistribution(200);
    for (const era of ERAS) expect(small[era], era).toEqual(distributionOf(finalLivesOf(era, 200)));
    expect(staleEras(small, FINAL_DISTRIBUTION)).toEqual([...ERAS]); // 판 수가 다르면 "낡았다"로 걸린다
    expect(staleEras(FINAL_DISTRIBUTION, FINAL_DISTRIBUTION)).toEqual([]);
  });

  it('생성기는 결정적이고 다른 경로로 센 값과 같다: 처음 300판을 simulateLife로 따로 세어 본다', () => {
    for (const era of ERAS) {
      const wealth = new Array<number>(101).fill(0);
      let lives = 0;
      for (let i = 1; i <= 300; i++) {
        const l = simulateLife(finalDistributionSeed(i), era, FINAL_DISTRIBUTION_PARAMS.strategy);
        if (l.deathAge < 20) continue; // 스무 살 전에 끝난 판은 세지 않는다
        wealth[l.final.stats.wealth]++;
        lives++;
      }
      const d = buildEraDistribution(era, 300);
      expect(d).toEqual({ simulated: 300, lives, wealth });
      expect(buildEraDistribution(era, 300)).toEqual(d);
    }
  });

  it('표가 합리적이다: 재산 중앙값이 20~60, 시대마다 값이 넓게 퍼지고 0·100에 몰려 있지 않다', () => {
    for (const era of ERAS) {
      const d = FINAL_DISTRIBUTION[era];
      let acc = 0;
      let median = -1;
      for (let v = 0; v <= 100; v++) {
        acc += d.wealth[v];
        if (median < 0 && acc >= d.lives / 2) median = v;
      }
      expect(median, era).toBeGreaterThanOrEqual(20);
      expect(median, era).toBeLessThanOrEqual(60);
      expect(d.wealth[0] / d.lives, `${era}: 재산 0에 몰림`).toBeLessThan(0.05);
      expect(d.wealth[100] / d.lives, `${era}: 재산 100에 몰림`).toBeLessThan(0.05);
      expect(d.wealth.filter((n) => n > 0).length, era).toBeGreaterThan(60);
    }
  });

  it('실제 인생의 도착 자리를 표에서 직접 세어 본 값과 같다 (모든 재산 값 0~100, 세 시대)', () => {
    for (const era of ERAS) {
      const d = FINAL_DISTRIBUTION[era];
      for (let v = 0; v <= 100; v++) {
        let ge = 0;
        let le = 0;
        for (let k = 0; k <= 100; k++) {
          if (k >= v) ge += d.wealth[k];
          if (k <= v) le += d.wealth[k];
        }
        expect(finalWealthStanding(era, v)).toEqual(standingOf((ge * 100) / d.lives, (le * 100) / d.lives));
      }
    }
  });

  it('시대마다 표가 다르다 (같은 시대 안에서 견주기 때문): 세 시대의 표가 서로 같지 않다', () => {
    expect(FINAL_DISTRIBUTION.past.wealth).not.toEqual(FINAL_DISTRIBUTION.present.wealth);
    expect(FINAL_DISTRIBUTION.present.wealth).not.toEqual(FINAL_DISTRIBUTION.future.wealth);
  });
});

describe('방향 판정의 균형 (R-091): 시대 × 재력 단계별 앞섬·비슷함·뒤쪽', () => {
  interface Tally {
    n: number;
    up: number;
    same: number;
    down: number;
  }
  /** 분포표를 만든 판들 중 스무 살 넘어 마친 판을 부모 재력 단계(1~5)별로 센다. grace: 구간 밖 여유(기본 BAND_GRACE) */
  function tallyByStage(era: Era, grace: number = BAND_GRACE): Tally[] {
    const out: Tally[] = [1, 2, 3, 4, 5].map(() => ({ n: 0, up: 0, same: 0, down: 0 }));
    for (const l of FINAL_LIVES()[era]) {
      if (!reachedIndependence(l.deathAge)) continue;
      const m = movementOf(startBandOf(era, l.parentWealth), finalWealthStanding(era, l.wealth), grace);
      const t = out[l.parentWealth - 1];
      t.n++;
      t[m]++;
    }
    return out;
  }
  const sum = (ts: Tally[]): Tally => ts.reduce((a, x) => ({ n: a.n + x.n, up: a.up + x.up, same: a.same + x.same, down: a.down + x.down }), { n: 0, up: 0, same: 0, down: 0 });
  const share = (t: Tally, k: 'up' | 'same' | 'down') => t[k] / t.n;
  const pct = (x: number) => `${Math.round(x * 100)}%`;
  const row = (t: Tally) => `n=${t.n} 앞섬 ${pct(share(t, 'up'))} / 비슷함 ${pct(share(t, 'same'))} / 뒤쪽 ${pct(share(t, 'down'))}`;

  it('표본: 어느 시대든 1~4단계는 100판 이상이다 (5단계는 상위 1~5%라 적다)', () => {
    for (const era of ERAS) {
      const t = tallyByStage(era);
      for (let w = 0; w < 4; w++) expect(t[w].n, `${era} ${w + 1}단계`).toBeGreaterThanOrEqual(100);
      expect(sum(t).n, era).toBe(FINAL_DISTRIBUTION[era].lives); // 분포표를 센 판과 같은 판이다
    }
  }, 180_000);

  it('가장 낮은 단계 출생이 구간 안에서 마치면 "뒤쪽"이 될 수 없다: 1단계의 뒤쪽은 구조상 0이고, 대부분(50% 이상)은 비슷함이며, 앞서는 판도 실제로 있다 (R-084 증상 해소)', () => {
    for (const era of ERAS) {
      const t = tallyByStage(era)[0];
      expect(t.down, `${era} 1단계 ${row(t)}`).toBe(0);
      expect(share(t, 'same'), `${era} 1단계 ${row(t)}`).toBeGreaterThanOrEqual(0.5);
      expect(share(t, 'up'), `${era} 1단계 ${row(t)}`).toBeGreaterThanOrEqual(0.15); // 대조: 앞섬이 하나도 없는 규칙이 아니다
      expect(share(t, 'up'), `${era} 1단계 ${row(t)}`).toBeLessThanOrEqual(0.45);
    }
  }, 180_000);

  it('가장 높은 단계(5) 출생은 앞설 수 없다 (구조상 앞섬 0). 대신 구간이 좁아(상위 1~5%) 뒤쪽이 많다 — 쏠림이 아니라 천장이다: 앞섬 0, 뒤쪽 60% 이하', () => {
    for (const era of ERAS) {
      const t = tallyByStage(era)[4];
      expect(t.n, `${era} 5단계 표본`).toBeGreaterThanOrEqual(40);
      expect(t.up, `${era} 5단계 ${row(t)}`).toBe(0);
      expect(share(t, 'down'), `${era} 5단계 ${row(t)}`).toBeLessThanOrEqual(0.6);
    }
  }, 180_000);

  it('어느 단계도 한 방향이 몰리지 않는다: 표본 100판 이상인 단계의 앞섬·뒤쪽은 각각 60% 이하 (50% + 100판 표본오차 약 5%p의 2배 안쪽, 관측 최대 52%)', () => {
    for (const era of ERAS) {
      tallyByStage(era).forEach((x, i) => {
        if (x.n < 100) return;
        expect(share(x, 'up'), `${era} ${i + 1}단계 ${row(x)}`).toBeLessThanOrEqual(0.6);
        expect(share(x, 'down'), `${era} ${i + 1}단계 ${row(x)}`).toBeLessThanOrEqual(0.6);
      });
    }
  }, 180_000);

  it('시대 전체로는 비슷함이 가장 많고 앞섬·뒤쪽도 나온다: 앞섬·뒤쪽 각 10~30%, 비슷함 50~75% (구간이 넓은 가운데 단계가 많아 구간 안에서 마치는 판이 다수다)', () => {
    for (const era of ERAS) {
      const t = sum(tallyByStage(era));
      expect(share(t, 'up'), `${era} ${row(t)}`).toBeGreaterThanOrEqual(0.1);
      expect(share(t, 'up'), `${era} ${row(t)}`).toBeLessThanOrEqual(0.3);
      expect(share(t, 'down'), `${era} ${row(t)}`).toBeGreaterThanOrEqual(0.1);
      expect(share(t, 'down'), `${era} ${row(t)}`).toBeLessThanOrEqual(0.3);
      expect(share(t, 'same'), `${era} ${row(t)}`).toBeGreaterThanOrEqual(0.5);
      expect(share(t, 'same'), `${era} ${row(t)}`).toBeLessThanOrEqual(0.75);
    }
  }, 180_000);

  // R-095: 4단계(금수저급)의 앞섬은 시대마다 구조가 다르다 — 구간 위쪽 끝이 점수 천장(99)에 얼마나 가까운가에 달렸다. 시대별로 나눠 사실대로 적는다(관측값은 이 판들의 비율).
  it('지난 세상 4단계 "상위 1~8% 사이"(구간 [92, 99]): 위쪽 끝이 천장(99)이라 앞섬은 구조상 0이다 — 쏠림이 아니라 천장', () => {
    const t = tallyByStage('past')[3];
    expect(startBandOf('past', 4).high).toBe(99);
    expect(t.n, `past 4단계 표본`).toBeGreaterThanOrEqual(100);
    expect(t.up, `past 4단계 ${row(t)}`).toBe(0);
    expect(share(t, 'same'), `past 4단계 ${row(t)}`).toBeGreaterThanOrEqual(0.6); // 관측 83%
  }, 180_000);

  it('지금 세상 4단계 "상위 3~17% 사이"(구간 [83, 97]): 구간 위쪽 끝 + 여유가 천장에 닿아 여유가 0이라 상위 2%·1%에 이른 판은 앞섬이다 — 0%가 아니고 3% 이상 15% 이하 (R-095)', () => {
    const t = tallyByStage('present')[3];
    expect([startBandOf('present', 4).low, startBandOf('present', 4).high]).toEqual([83, 97]);
    expect(t.n, `present 4단계 표본`).toBeGreaterThanOrEqual(100);
    expect(t.up, `present 4단계 ${row(t)}`).toBeGreaterThan(0); // R-095 이전에는 구조상 0이었다 (앞섬 0%)
    expect(share(t, 'up'), `present 4단계 ${row(t)}`).toBeGreaterThanOrEqual(0.03); // 관측 10%
    expect(share(t, 'up'), `present 4단계 ${row(t)}`).toBeLessThanOrEqual(0.15);
    expect(share(t, 'down'), `present 4단계 ${row(t)}`).toBeLessThanOrEqual(0.3); // 관측 18%
  }, 180_000);

  it('다가올 세상 4단계 "상위 5~18% 사이"(구간 [82, 95]): 천장에서 떨어져 있어 여유 2가 그대로 쓰이고 앞섬은 12% 이하다 (관측 9%)', () => {
    const t = tallyByStage('future')[3];
    expect([startBandOf('future', 4).low, startBandOf('future', 4).high]).toEqual([82, 95]);
    expect(t.n, `future 4단계 표본`).toBeGreaterThanOrEqual(100);
    expect(t.up, `future 4단계 ${row(t)}`).toBeGreaterThan(0);
    expect(share(t, 'up'), `future 4단계 ${row(t)}`).toBeLessThanOrEqual(0.12);
  }, 180_000);

  it('대조: 여유를 0으로 두면 앞섬·뒤쪽이 더 많아진다 — 구간 밖 1~2점 차 판이 실제로 있어서 여유가 쓰이고, 그 판은 시대 전체의 12% 이하다', () => {
    for (const era of ERAS) {
      const withGrace = sum(tallyByStage(era));
      const without = sum(tallyByStage(era, 0));
      expect(without.n).toBe(withGrace.n);
      expect(without.up + without.down, era).toBeGreaterThan(withGrace.up + withGrace.down);
      const moved = (without.up + without.down - withGrace.up - withGrace.down) / withGrace.n;
      expect(moved, `${era} 여유로 "비슷함"이 된 판의 비율`).toBeLessThanOrEqual(0.12);
    }
  }, 180_000);
});

describe('화면에 보이는 숫자와 판정이 항상 서로 맞는다 (R-091): 분포표를 만든 모든 판의 문장을 다시 읽어 검사', () => {
  // 문장을 다시 읽는 파서(readBand·readEnd)와 방향의 기준(expectedMovement)은 scripts/endingReadback.ts (R-096: 「밖」·「약 N%」·「하위 A~B%」·「모두가 같은 자리」까지 읽는다)

  it('파서 자체 검증: 15개 출발선 문구를 읽은 구간이 가중치 표에서 계산한 구간과 같다', () => {
    for (const era of ERAS) for (const [low, high, label] of BANDS[era]) expect(readBand(label), `${era} ${label}`).toEqual([low, high]);
    expect(readEnd('상위 약 23%')).toBe(77);
    expect(readEnd('하위 1% 안쪽')).toBe(1);
    expect(readEnd('상위 1% 안쪽')).toBe(99);
    expect(readEnd('딱 중간쯤')).toBe(50);
  });

  it('모든 판(세 시대, 스무 살 넘어 마친 약 12000판)의 reviewEnding 결과: 문장에서 읽은 숫자로 방향을 다시 정하면 같다. 구간 안인데 앞섬/뒤쪽, 구간 밖 여유(2점) 너머인데 비슷함이 0건이다 (천장·바닥 쪽은 여유 0 — R-095)', () => {
    const tally = { total: 0, inside: 0, graceSame: 0, up: 0, down: 0, ceilingUp: 0 };
    const wrong: string[] = [];
    for (const era of ERAS) {
      const base = endingOf(finalDistributionSeed(1), era);
      for (const l of FINAL_LIVES()[era]) {
        if (!reachedIndependence(l.deathAge)) continue;
        const game: EndingGame = {
          ...base,
          character: { ...base.character, parentWealth: l.parentWealth },
          stats: { ...base.stats, wealth: l.wealth },
          death: { age: l.deathAge, cause: base.death.cause },
        };
        const j = reviewEnding(game).journey;
        if (j.kind !== 'compared') {
          wrong.push(`${era}: 스무 살 넘어 마쳤는데 early`);
          continue;
        }
        const text = journeyText(j);
        const m = /^(.+)의 집에서 태어나, (.+)의 형편으로 생을 마쳤다\.$/.exec(text);
        if (m === null) {
          wrong.push(`${era}: 문장 모양이 다르다 ${text}`);
          continue;
        }
        const [low, high] = readBand(m[1]);
        const end = readEnd(m[2]);
        const want = expectedMovement(low, high, end, BAND_GRACE);
        const where = `${era} ${l.parentWealth}단계 재산 ${l.wealth}: ${text} → ${MOVEMENT_TEXT[j.movement]}`;
        tally.total++;
        if (j.movement !== want) wrong.push(`${where} (기대 ${want})`);
        if (end >= low && end <= high) {
          tally.inside++;
          if (j.movement !== 'same') wrong.push(`구간 안인데 ${j.movement}: ${where}`);
        } else if (j.movement === 'same') {
          tally.graceSame++;
          const gap = end > high ? end - high : low - end;
          if (gap > BAND_GRACE) wrong.push(`구간 밖 ${gap}점인데 비슷함: ${where}`);
        }
        if (j.movement === 'up') {
          tally.up++;
          // 앞섬은 구간 위쪽 끝보다 여유(2점)를 넘어 앞선 것이다. 단 구간 위쪽 끝에서 천장(99)까지 칸이 여유 이내인 구간은 여유가 0이라 끝값을 넘기만 하면 앞섬이다 (R-095)
          const nearCeiling = 99 - high <= BAND_GRACE;
          if (!(end > high) || (!nearCeiling && !(end - high > BAND_GRACE))) wrong.push(`앞섬인데 구간 위쪽 끝(${high})보다 충분히 앞서지 않음: ${where}`);
          if (nearCeiling) tally.ceilingUp++;
        }
        if (j.movement === 'down') {
          tally.down++;
          const nearFloor = low - 1 <= BAND_GRACE;
          if (!(end < low) || (!nearFloor && !(low - end > BAND_GRACE))) wrong.push(`뒤쪽인데 구간 아래쪽 끝(${low})보다 충분히 뒤지지 않음: ${where}`);
        }
      }
    }
    expect(wrong.slice(0, 10), `어긋난 판 ${wrong.length}건`).toEqual([]);
    expect(tally.total).toBeGreaterThan(11000);
    // R-095가 실제 판에서 일어난다: 지금 세상 4단계에서 상위 2%·1%에 이른 판이 앞섬이다 (여유 2점이면 비슷함이 돼 이 칸이 0이었다)
    expect(tally.ceilingUp).toBeGreaterThan(20);
    // 검사가 공허하지 않다: 네 경우가 모두 실제로 있다 (구간 안 / 구간 밖이지만 여유 안 / 앞섬 / 뒤쪽)
    expect(tally.inside).toBeGreaterThan(5000);
    expect(tally.graceSame).toBeGreaterThan(200);
    expect(tally.up).toBeGreaterThan(1000);
    expect(tally.down).toBeGreaterThan(1000);
    // 여유 안이라 구간 밖인데 비슷함으로 읽히는 판은 전체의 12% 이하다 (여유는 "작은" 여유다)
    expect(tally.graceSame / tally.total).toBeLessThanOrEqual(0.12);
  }, 180_000);

  it('방향 문장이 판정과 같다: 앞섬 → "앞선 자리", 비슷함 → "비슷한 자리", 뒤쪽 → "뒤쪽에 서 있었다"', () => {
    expect(MOVEMENT_TEXT.up).toContain('앞선');
    expect(MOVEMENT_TEXT.same).toContain('비슷한');
    expect(MOVEMENT_TEXT.down).toContain('뒤쪽');
  });
});

describe('다시 태어나기 (rebirth): 새 시드로 새 판, 첫 화면(title)에서 시작 (SPEC-003 규칙 19)', () => {
  const ended = (seed = 77): GameState => playToEnd(startLife(seed, 'present'), chooserFor('random', seed)).state;

  it('ending → 첫 화면(title): 새 시드, 세상·인생 길이 미정(첫 화면의 선택은 설정에 있다), 이전 판의 흔적이 하나도 없다', () => {
    const before = ended();
    expect(before.phase).toBe('ending');
    const r = rebirth(before, 9001);
    expect(r).toEqual(createInitialState(9001));
    expect(r.phase).toBe('title');
    expect(r.seed).toBe(9001);
    expect(r.rngState).toBe(9001);
    expect(r.era).toBeNull(); // 첫 화면의 기본 선택 = DEFAULT_ERA (설정)
    expect(r.lifeLength).toBeNull();
    expect(DEFAULT_ERA).toBe('present');
    for (const key of ['character', 'birthStats', 'death', 'pending', 'lastChoiceAge'] as const) expect(r[key], key).toBeNull();
    expect(r.history).toEqual([]);
    expect(r.flags).toEqual([]);
    expect(r.seen).toEqual({});
    expect(r.age).toBe(0);
    // 이전 판의 시드·인물은 남지 않는다
    expect(r.seed).not.toBe(before.seed);
  });

  it('ending이 아닐 때는 같은 객체를 돌려준다 (title·roulette·birth·life에서 호출돼도 아무 일도 없다)', () => {
    const title = createInitialState(1);
    const roulette = beginBirth(title, 'past');
    const birth = enterBirth(roulette);
    const life = enterLife(birth);
    for (const s of [title, roulette, birth, life]) expect(rebirth(s, 5)).toBe(s);
  });

  it('연타·더블탭: 두 번째부터는 같은 객체라 두 판이 시작되거나 첫 화면을 건너뛰지 않는다', () => {
    const r1 = rebirth(ended(), 11);
    expect(r1.phase).toBe('title');
    const r2 = rebirth(r1, 22);
    expect(r2).toBe(r1);
    expect(r2.seed).toBe(11); // 둘째 입력의 시드는 버려진다
    // 세션 reducer: 같은 세션 객체
    const s0 = createSession(ended(), { speed: 8, autoMode: true });
    const s1 = sessionReducer(s0, { type: 'rebirth', seed: 11 });
    const s2 = sessionReducer(s1, { type: 'rebirth', seed: 22 });
    const s3 = sessionReducer(s2, { type: 'rebirth', seed: 33 });
    expect(s1.game.phase).toBe('title');
    expect(s2).toBe(s1);
    expect(s3).toBe(s1);
    // 새 판이 시작되려면 첫 화면에서 「태어나기」를 눌러야 하고, 그 전의 진행·이동 입력은 전부 무시된다
    for (const a of [{ type: 'enterLife' }, { type: 'skip' }, { type: 'advance', fromAge: 0 }, { type: 'resume' }, { type: 'openTitle' }] as const) expect(sessionReducer(s1, a), a.type).toBe(s1);
  });

  it('설정(배속·자동 모드·고른 세상과 인생 길이)은 그대로 유지된다, tick은 비워진다, 인생 도중의 rebirth는 무시된다', () => {
    const s0 = createSession(ended(), { speed: 4, autoMode: true, era: 'future', lifeLength: 'long60', bgm: { on: true, volume: 70 }, theme: 'dark' });
    const s1 = sessionReducer(s0, { type: 'rebirth', seed: 5 });
    expect(s1.settings).toBe(s0.settings);
    // M4: 설정에 BGM·테마가 더해졌고, 다시 태어나도 그대로 유지된다
    expect(s1.settings).toEqual({ speed: 4, autoMode: true, era: 'future', lifeLength: 'long60', bgm: { on: true, volume: 70 }, theme: 'dark' });
    expect(s1.tick).toBeNull();
    const life = createSession(startLife(3, 'present'), { speed: 2, autoMode: false });
    expect(sessionReducer(life, { type: 'rebirth', seed: 5 })).toBe(life);
  });

  it('새 판: 세상을 고르지 않고 태어나면 지금 세상, 고르면 그 세상으로 태어난다. 같은 시드면 같은 인물이고 시드가 다르면 다른 인물이다', () => {
    const born = (seed: number, era?: Era) => {
      let s = sessionReducer(createSession(ended(), { speed: 1, autoMode: false }), { type: 'rebirth', seed });
      if (era !== undefined) s = sessionReducer(s, { type: 'setEra', era });
      return sessionReducer(s, { type: 'begin' }).game;
    };
    const a = born(1001);
    expect(a.phase).toBe('roulette');
    expect(a.era).toBe('present');
    expect(born(1001)).toEqual(a);
    expect(born(1002).character).not.toEqual(a.character);
    expect(born(1001, 'future').era).toBe('future');
    expect(born(1001, 'past').era).toBe('past');
    // 이전 판과 상관없이 시드에서만 정해진다
    expect(sessionReducer(sessionReducer(createSession(ended(5), { speed: 1, autoMode: false }), { type: 'rebirth', seed: 1001 }), { type: 'begin' }).game).toEqual(a);
  });

  it('새 판 상태는 저장·복원이 된다 (첫 화면 단계로 새로고침해도 같은 새 판)', () => {
    const r = rebirth(ended(), 4242);
    expect(parseGame(serializeGame(r))).toEqual(r);
  });

  it('죽음 → 다시 태어나기를 여러 번 되풀이해도 매번 새 판이고 끝까지 갈 수 있다', () => {
    let session = createSession(ended(1), { speed: 8, autoMode: true });
    const seeds: number[] = [];
    for (let round = 0; round < 4; round++) {
      session = sessionReducer(session, { type: 'rebirth', seed: 500 + round });
      session = sessionReducer(session, { type: 'begin' });
      session = sessionReducer(session, { type: 'finishSpin' });
      session = sessionReducer(session, { type: 'enterBirth' });
      session = sessionReducer(session, { type: 'enterLife' });
      seeds.push(session.game.seed);
      const end = playToEnd(session.game, null).state;
      expect(end.phase).toBe('ending');
      session = { ...session, game: end };
    }
    expect(seeds).toEqual([500, 501, 502, 503]);
    expect(session.settings).toEqual({ ...DEFAULT_SETTINGS, speed: 8, autoMode: true });
  });
});

describe('저장 검증: 엔딩 상태', () => {
  const ended = playToEnd(startLife(88, 'future'), chooserFor('random', 88)).state;

  it('사망 상태는 저장·복원해도 그대로고, 복원한 상태로 회고를 만들 수 있다 (새로고침해도 엔딩 유지)', () => {
    const back = parseGame(serializeGame(ended));
    expect(back).toEqual(ended);
    expect(back!.phase).toBe('ending');
    expect(reviewEnding(back as EndingGame)).toEqual(reviewEnding(ended as EndingGame));
  });

  it('엔딩 저장이 어긋나면 새 게임이다: 사망 정보 없음·사망 나이 불일치·대기 중인 선택지·캐릭터/시대/출생 스냅샷 없음', () => {
    const bad = (patch: Partial<GameState>) => parseGame(serializeGame({ ...ended, ...patch }));
    expect(bad({})).not.toBeNull();
    expect(bad({ death: null })).toBeNull();
    expect(bad({ death: { age: ended.age + 1, cause: '노환' } })).toBeNull();
    expect(bad({ death: { age: ended.age, cause: '' } })).toBeNull();
    expect(bad({ character: null })).toBeNull();
    expect(bad({ era: null })).toBeNull();
    expect(bad({ birthStats: null })).toBeNull();
    expect(bad({ pending: { eventId: 'school-exam', key: `school-exam@${ended.age}`, age: ended.age, choiceIds: ['a', 'b'] } })).toBeNull();
  });

  it('엔딩 상태에서는 진행도 선택도 되지 않는다 (엔딩이 되살아나거나 진행이 다시 시작되지 않는다)', () => {
    const s0 = createSession(ended, { speed: 8, autoMode: true });
    for (const a of [{ type: 'advance', fromAge: ended.age }, { type: 'skip' }, { type: 'autoChoose', key: 'x@1' }, { type: 'choose', key: 'x@1', choiceId: 'a' }, { type: 'enterLife' }, { type: 'begin' }, { type: 'resume' }, { type: 'openTitle' }] as const) {
      expect(sessionReducer(s0, a), a.type).toBe(s0);
    }
  });
});
