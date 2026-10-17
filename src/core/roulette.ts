import { ERA_CONFIG } from '../data/birthTable';
import { regionsOf } from '../data/birthStats';
import { sortRegions } from '../data/regionNames';
import type { RegionBasis } from '../data/koreaStatsAccess';
import { PARENT_WEALTHS, type BirthReport, type Character, type Era, type ParentWealth } from './types';

/**
 * 출생 룰렛 (SPEC-003 RL1~RL6). 순수 함수 — 룰렛이 보이는 모든 값(릴의 칸 순서, 확률표, 멈출 자리)이 여기서 나온다.
 *
 * ## 결과는 먼저 정해져 있다 (RL2)
 * 릴이 멈추는 자리는 **출생 로직(core/birth.ts#generateBirth)이 이미 저장한 결과**(Character.parentWealth, BirthReport.region)에서 읽는다 — 여기서 난수를 뽑지 않는다.
 * 연출(회전·감속)은 확률을 바꾸지 않고, 연출 코드(ui/Reel.tsx·screens/RouletteScreen.tsx)에는 Math.random이 없다(tests/roulette.test.tsx가 소스를 점검).
 *
 * ## 확률 표기 (RL3)
 * 수저 = 선택한 세상의 `ERA_CONFIG[era].wealthWeights`(설계값)에서 계산해 합이 100이 되게 보정한 정수 %, 지역 = 시·도 출생아 비율(소수 첫째 자리, 합 100.0).
 * 보정은 가장 큰 나머지 방식(largestRemainder) — 반올림 때문에 합이 100에서 어긋나지 않는다.
 */

/**
 * 값들을 합이 정확히 100이 되도록 소수 decimals자리로 나타낸다(가장 큰 나머지 방식). 입력은 합이 100일 필요가 없다(비례로 정규화).
 * 반환값의 합은 정수 연산으로 정확히 100 × 10^decimals / 10^decimals이다(부동소수 오차 없이 `sumScaled`로 검사한다).
 */
export function largestRemainder(values: readonly number[], decimals: number): number[] {
  if (values.length === 0 || values.some((v) => !Number.isFinite(v) || v < 0)) throw new RangeError('largestRemainder: 잘못된 값');
  const total = values.reduce((a, b) => a + b, 0);
  if (!(total > 0)) throw new RangeError('largestRemainder: 합이 0 이하다');
  const scale = 10 ** decimals;
  const goal = 100 * scale;
  const raw = values.map((v) => (v / total) * goal);
  const floors = raw.map((r) => Math.floor(r + 1e-9));
  let left = goal - floors.reduce((a, b) => a + b, 0);
  const order = raw.map((r, i) => ({ i, frac: r - floors[i] })).sort((a, b) => b.frac - a.frac || a.i - b.i);
  for (let k = 0; left > 0 && k < order.length; k++, left--) floors[order[k].i]++;
  return floors.map((f) => f / scale);
}

/** 확률표 값들의 합을 정수 연산으로 구한다 (decimals자리 값 → 100 × 10^decimals가 나와야 한다) */
export function sumScaled(percents: readonly number[], decimals: number): number {
  const scale = 10 ** decimals;
  return percents.reduce((a, p) => a + Math.round(p * scale), 0);
}

export interface WealthOdd {
  wealth: ParentWealth;
  /** 정수 % (합 100) */
  percent: number;
}

export interface RegionOdd {
  /** 시·도 줄임 이름 */
  name: string;
  /** 소수 첫째 자리 % (합 100.0) */
  percent: number;
}

/**
 * 수저 릴의 칸 순서(R-274, 마스터 결정): **왕복** — 흙 동 은 금 다이아 금 은 동 (끝에서 흙으로 돌아온다). 이웃한 칸은 늘 한 단계 차이라서
 * 어느 결과에서 멈춰도 정지 직전에 지나는 칸이 이웃 단계다(흙수저 앞에 늘 다이아몬드수저가 지나가던 단순 순환의 「아깝게 놓침」 연출을 없앤다).
 * 확률표·결과 상태(복원·움직임 줄이기)의 단계 순서는 그대로 흙→다이아몬드이고, 릴만 이 순서다.
 */
export const WEALTH_REEL_ORDER: readonly ParentWealth[] = [1, 2, 3, 4, 5, 4, 3, 2];

/** 이 수저 단계가 릴에서 멈출 칸의 위치: 왕복 순서에서 처음 나오는 자리(결정적). 가운데 단계는 올라가는 쪽 칸이다. */
export function wealthReelIndex(wealth: ParentWealth): number {
  const i = WEALTH_REEL_ORDER.indexOf(wealth);
  if (i < 0) throw new RangeError(`wealthReelIndex: 수저 단계 ${wealth}`);
  return i;
}

export interface RouletteView {
  era: Era;
  birthYear: number;
  /** 수저 확률표 순서: 흙→동→은→금→다이아몬드 (결과·움직임 줄이기도 같은 순서, R-171) */
  wealthOdds: WealthOdd[];
  /** 수저 릴 칸 순서(왕복, `WEALTH_REEL_ORDER`) */
  wealthReel: ParentWealth[];
  /** 수저 릴이 멈출 칸 (wealthReel 안의 인덱스, 저장된 출생 결과에서 읽는다) */
  wealthReelIndex: number;
  /** 지역 릴·확률표 순서: REGION_ORDER(서울·부산·…·제주)의 부분 목록 */
  regionOdds: RegionOdd[];
  /** 멈출 자리: wealthOdds / regionOdds 안의 인덱스 */
  wealthIndex: number;
  regionIndex: number;
  /** 지역 확률의 성격(R-187): 지금 세상 = 통계 파생, 지난·다가올 세상 = 설계값 */
  basis: RegionBasis;
}

/**
 * 저장된 출생 결과로 룰렛을 만든다. 결과(멈출 자리)는 저장된 값 그대로이고 확률표만 계산한다.
 * 지역이 그 출생 연도의 목록에 없으면 throw — 저장 검증(isValidBirthReport)이 걸러 주므로 정상 경로에서는 일어나지 않는다.
 */
export function buildRoulette(era: Era, character: Pick<Character, 'birthYear' | 'parentWealth'>, report: Pick<BirthReport, 'region'>): RouletteView {
  const weights = ERA_CONFIG[era].wealthWeights;
  const wealthPercents = largestRemainder(weights, 0);
  const wealthOdds = PARENT_WEALTHS.map((wealth, i) => ({ wealth, percent: wealthPercents[i] }));

  const regions = regionsOf(character.birthYear);
  const sorted = sortRegions(regions.regions);
  const regionPercents = largestRemainder(
    sorted.map((r) => r.sharePct),
    1,
  );
  const regionOdds = sorted.map((r, i) => ({ name: r.name, percent: regionPercents[i] }));

  const regionIndex = regionOdds.findIndex((r) => r.name === report.region);
  if (regionIndex < 0) throw new RangeError(`buildRoulette: ${character.birthYear}년생 룰렛 지역에 ${report.region}이 없다`);
  return {
    era,
    birthYear: character.birthYear,
    wealthOdds,
    wealthReel: [...WEALTH_REEL_ORDER],
    wealthReelIndex: wealthReelIndex(character.parentWealth),
    regionOdds,
    wealthIndex: character.parentWealth - 1,
    regionIndex,
    basis: regions.basis,
  };
}

// ---------- 연출 시간 (RL1: 총 4~6초, 수저 릴이 마지막) ----------

/**
 * 연출 시간표(ms). 지역 릴이 먼저 멈추고 수저 릴이 마지막에 멈춘다(RL1). 총 연출 = wealthStopMs (5.4초, 4~6초 안).
 * 시간이 흐르는 연출이라 core의 순수 계산이 아니라 값만 여기 둔다 — 화면(ui/Reel.tsx)이 이 값으로 가속→회전→감속을 그린다. 확률에는 영향이 없다.
 */
export const ROULETTE_TIMING = {
  /** 가속: 이 시간 동안 속도가 0에서 최고 속도까지 오른다 */
  accelMs: 700,
  /** 지역 릴이 멈추는 시각 */
  regionStopMs: 4200,
  /** 수저 릴이 멈추는 시각 = 총 연출 시간 (지역 릴보다 늦다) */
  wealthStopMs: 5400,
} as const;

/**
 * 릴 위치 함수(순수): 시각 t(ms)에서 릴이 어디까지 내려갔는가(칸 단위, 0에서 total까지 단조 증가).
 * 가속 구간(0~accelMs)은 이차 곡선으로 속도가 0에서 vmax가 되고, 이후 감속하며 stopMs에 total에 정확히 닿아 멈춘다(속도 0).
 * 한 번도 되돌아가지 않고(단조), stopMs 이후에는 total에 머문다. 난수 없음.
 */
export function reelPosition(t: number, total: number, stopMs: number, accelMs: number = ROULETTE_TIMING.accelMs): number {
  if (!(total >= 0) || !(stopMs > accelMs) || !(accelMs > 0)) throw new RangeError('reelPosition: 잘못된 인자');
  if (t <= 0) return 0;
  if (t >= stopMs) return total;
  // 속도 곡선: [0, accelMs] 선형 증가(0→v), [accelMs, stopMs] 선형 감소(v→0) 의 삼각형 → 면적 = v × stopMs / 2 = total
  const v = (2 * total) / stopMs;
  if (t <= accelMs) return (v * t * t) / (2 * accelMs);
  const rest = stopMs - accelMs;
  const dt = t - accelMs;
  const atAccel = (v * accelMs) / 2;
  return atAccel + v * dt - (v * dt * dt) / (2 * rest);
}
