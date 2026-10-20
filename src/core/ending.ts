import { FINAL_DISTRIBUTION } from '../data/finalDistribution';
import { STAGE_TABLE } from '../data/lifeTable';
import { standingOf, wealthBottomPercent, wealthTopPercent, type Standing } from './birth';
import { stageOfAge } from './events';
import { STAGES, type Character, type Death, type Era, type GameState, type HistoryEntry, type ParentWealth, type Stage, type Stats } from './types';

/**
 * 엔딩 회고의 계산 (순수 함수). React·타이머·Date·Math.random을 쓰지 않는다. 문구는 data/endingText.ts, 화면은 screens/EndingScreen.tsx.
 *
 * ## 출발선 대비 (R-045 c, R-091)
 * 출발은 **집안 형편**(재력 단계의 수저 구간)이고 도착은 **내가 가진 것**(최종 순자산, 만 원 — 스무 살에 core/economy.ts#initialAssets가 만든 자산)이다.
 * 뜻이 다른 값이라 원값을 빼서 견주지 않는다. 대신 **같은 시대 안에서의 자리(백분위)** 로 견준다.
 *  - 출발선: 재력 가중치표의 누적 비율로 구한 이 재력 단계의 **구간**(startBandOf). 출생 결과 화면은 구간의 한쪽 끝값("하위 약 40%")만 말하지만,
 *    엔딩은 구간 그대로("하위 40% 안쪽", "상위 8~28% 사이")를 말한다 — 방향 판정이 쓰는 숫자와 화면의 숫자가 같은 것이 되도록(R-091).
 *  - 도착: 같은 시대의 헤드리스 시뮬레이션 판들이 남긴 **최종 순자산 분위수표**(data/finalDistribution.ts, scripts/finalDistribution.ts로 생성, 0~100번째 백분위 101칸)에서
 *    이 인생의 최종 순자산이 상위/하위 몇 %인지. 같은 표현 규칙(core/birth.ts#standingOf)을 그대로 쓰므로 50을 넘는 숫자도 "약 0%/약 100%"도 나오지 않는다.
 *  - 스무 살이 되기 전에 끝난 인생은 재산이 아직 집안 형편이라 도착 자리를 말하지 않는다(reachedIndependence).
 *  - 방향(앞섬·비슷함·뒤쪽)은 도착 자리가 출발 구간의 위·안·아래 어디인지로 정한다(movementOf). 화면에 말한 숫자만 쓰므로 문장과 방향이 어긋날 수 없다.
 * 학력·행복·관계는 뜻이 변하지 않는 값이라 "처음 → 마지막" 원값을 그대로 보여 준다. 건강(나이 들며 줄 뿐)·외모(고정)는 견주지 않는다.
 */

// ---------- 분포표에서 자리 구하기 ----------

/** 한 시대의 최종 순자산 분위수표 (data/finalDistribution.ts, scripts/finalDistributionLib.ts#buildFinalDistribution이 만든다) */
export interface FinalDistribution {
  /** 시뮬레이션한 판 수 */
  simulated: number;
  /** 그중 스무 살 넘어 마친 판 수. 스무 살 전에 끝난 판은 자산이 아직 없어(집안 살림뿐이라) 세지 않는다. */
  lives: number;
  /** quantiles[p] = 스무 살 넘어 마친 판들의 최종 순자산(만 원)을 작은 것부터 놓았을 때 p번째 백분위 값 (p = 0..100, 101칸, 줄지 않는다. 0 = 최솟값, 100 = 최댓값) */
  quantiles: readonly number[];
}

/** 분위수표의 칸 수(0~100번째 백분위) */
export const QUANTILE_COUNT = 101;

/** 스무 살(청년 단계 진입) 이후까지 산 인생인가: 이때부터 자산이 있다. 분포표도 이런 인생만 센다. */
export function reachedIndependence(deathAge: number): boolean {
  return deathAge >= STAGE_TABLE.youth.startAge;
}

function checkQuantiles(q: readonly number[]): void {
  if (q.length !== QUANTILE_COUNT) throw new RangeError(`분위수표의 칸 수가 ${q.length}개다 (${QUANTILE_COUNT}칸이어야 한다)`);
}

/** 이 값 이상으로 마친 인생의 비율(%) — 분위수표 기준(1%포인트 해상도), 0~100 */
export function shareAtLeast(quantiles: readonly number[], value: number): number {
  checkQuantiles(quantiles);
  let n = 0;
  for (const q of quantiles) if (q >= value) n++;
  return (n * 100) / QUANTILE_COUNT;
}

/** 이 값 이하로 마친 인생의 비율(%) — 분위수표 기준(1%포인트 해상도), 0~100 */
export function shareAtMost(quantiles: readonly number[], value: number): number {
  checkQuantiles(quantiles);
  let n = 0;
  for (const q of quantiles) if (q <= value) n++;
  return (n * 100) / QUANTILE_COUNT;
}

/** 이 값 **미만**으로 마친 인생의 비율(%) — 분위수표 기준(1%포인트 해상도), 0~100. 같은 금액으로 마친 인생은 세지 않는다 (SPEC-003 M7e-3, 마스터 결정 C: 동률 불리) */
export function shareBelow(quantiles: readonly number[], value: number): number {
  checkQuantiles(quantiles);
  let n = 0;
  for (const q of quantiles) if (q < value) n++;
  return (n * 100) / QUANTILE_COUNT;
}

/**
 * 같은 시대의 최종 순자산 분위수표에서 이 최종 순자산(만 원)의 자리. 표현 규칙은 출생 화면과 같다(standingOf).
 * **동률 불리 (M7e-3, 마스터 결정 C — docs/design/copy.md 5-2 ①)**: 상위는 「이상(≥)」 비율 그대로, 하위는 「미만(<)」 비율이다 — 같은 금액으로 마친 사람을 내 아래로 세지 않는다.
 * 노년 안전망(D20·D20a)이 자산이 바닥난 뒤의 적자를 빚으로 만들지 않아 **정확히 0원으로 마치는 판이 많다**(분위수표의 0원 칸이 시대마다 인생의 10~18%). 이 0원을 모두 「내 아래」로 세던 예전 규칙(≤)은
 * 0원을 지금 세상에서 「하위 약 42%」·다가올 세상에서 「가운데쯤」으로 보여 흙수저가 0원으로 마쳐도 「앞섬」이 붙었다(QA-003-M5 O04, REV-003-M5-1 관찰 1). 하위를 미만으로 세면 두 쪽이 같은 규칙(동률이 불리한 쪽)이 되어
 * 0원이 「하위 약 26%」(지금 세상)처럼 「26%는 빚으로 마쳤다」는 사실 그대로 읽힌다. 0원이 아닌 값에서는 예전 규칙과 1칸 이내로 같다(분위수표가 연속이라 동률은 0원 근처뿐).
 * 표(table)를 주입할 수 있어 단위 테스트가 직접 적은 작은 표로 경계를 확인한다.
 */
export function finalWealthStanding(era: Era, net: number, table: Record<Era, FinalDistribution> = FINAL_DISTRIBUTION): Standing {
  const q = table[era].quantiles;
  return standingOf(shareAtLeast(q, net), shareBelow(q, net));
}

/** 자리 → 0~100 점수(높을수록 앞선 자리): 상위 N% → 100-N, 하위 N% → N, 중앙 → 50. 화면에 말한 자리 그대로에서 만든다. */
export function standingScore(s: Standing): number {
  if (s.kind === 'middle') return 50;
  return s.kind === 'top' ? 100 - s.percent : s.percent;
}

// ---------- 출발선 구간과 방향 ----------

/**
 * 출발선: 이 시대의 재력 단계가 출생아 가운데 차지하는 구간. low·high는 **아래에서부터 센 백분위**(정수, 0~100)다.
 * 예: 지난 세상 1단계(가중치 40%)는 [0, 40], 지금 세상 3단계는 [55, 83]. 점수(standingScore)와 같은 방향(클수록 부유)이다.
 * 화면은 이 구간을 R-018과 같은 규칙(퍼센트는 50을 넘지 않는다)으로 말한다 — kind가 말하는 방식을 정하고, 말하는 숫자는 모두 1~50이다.
 *  - bottom/top: 맨 아래/맨 위 단계 — "하위 N% 안쪽" / "상위 N% 안쪽"   - outsideTop/outsideBottom: 한쪽 끝에 붙었지만 반대편이 50%를 넘는 구간 — "상위 N% 밖" / "하위 N% 밖"
 *  - lower/upper: 한쪽 절반 안의 구간 — "하위 A~B% 사이" / "상위 A~B% 사이"   - center: 50%를 걸친 구간 — "하위 A% 선과 상위 B% 선 사이"   - whole: 구간이 전체(단계가 하나뿐인 표)
 */
export type StartBand = { low: number; high: number } & (
  | { kind: 'bottom'; percent: number }
  | { kind: 'top'; percent: number }
  | { kind: 'outsideTop'; percent: number }
  | { kind: 'outsideBottom'; percent: number }
  | { kind: 'lower'; from: number; to: number }
  | { kind: 'upper'; from: number; to: number }
  | { kind: 'center'; bottom: number; top: number }
  | { kind: 'whole' }
);

/**
 * [low, high] (아래에서부터 센 백분위, 0 <= low <= high <= 100인 정수) → 말하는 방식이 정해진 구간. 화면의 퍼센트는 항상 1~50이고 "0~"·"~100" 같은 끝값이 나오지 않는다.
 *
 * **돌려주는 구간(low·high)은 화면 문구가 말하는 구간과 언제나 같다** (R-096). 폭이 0인 맨 아래·맨 위 구간 [0, 0]·[100, 100]은 "약 0%"·"약 100%"를 말할 수 없어
 * "하위 1% 안쪽"·"상위 1% 안쪽"으로 올려 말하는데, 그때 판정(movementOf)이 쓰는 끝값도 같은 값으로 맞춘다: [0, 0] → low 0·high 1, [100, 100] → low 99·high 100.
 * 그 밖의 구간은 넘긴 값 그대로다. (현재 재력 가중치표에는 이런 구간이 없다 — 가중치가 0인 단계가 생기면 나온다.)
 */
export function bandFromRange(low: number, high: number): StartBand {
  if (!Number.isInteger(low) || !Number.isInteger(high) || low < 0 || high > 100 || low > high) throw new RangeError(`bandFromRange: 구간이 맞지 않는다 (${low}, ${high})`);
  const base = { low, high };
  if (low === 0 && high === 100) return { ...base, kind: 'whole' };
  if (low === 0) {
    if (high > 50) return { ...base, kind: 'outsideTop', percent: 100 - high };
    const top = Math.max(1, high); // 폭 0인 맨 아래 구간은 "하위 1% 안쪽"으로 올려 말하고, 판정 끝값도 1로 맞춘다 (R-096)
    return { low, high: top, kind: 'bottom', percent: top };
  }
  if (high === 100) {
    if (low < 50) return { ...base, kind: 'outsideBottom', percent: low };
    const bottom = Math.min(99, low); // 폭 0인 맨 위 구간은 "상위 1% 안쪽"으로 올려 말하고, 판정 끝값도 99로 맞춘다 (R-096)
    return { low: bottom, high, kind: 'top', percent: 100 - bottom };
  }
  if (low >= 50) return { ...base, kind: 'upper', from: 100 - high, to: 100 - low };
  if (high <= 50) return { ...base, kind: 'lower', from: low, to: high };
  return { ...base, kind: 'center', bottom: low, top: 100 - high };
}

/**
 * 이 시대·이 재력 단계 출생아의 출발선 구간. 숫자는 재력 가중치표의 누적에서 계산한다(하드코딩 없음).
 * 구간 = [이 단계보다 낮은 단계의 비율, 이 단계까지의 비율]을 정수로 반올림한 값 (현재 표는 가중치가 정수라 반올림이 값을 바꾸지 않는다).
 */
export function startBandOf(era: Era, wealth: ParentWealth): StartBand {
  return bandFromRange(Math.round(100 - wealthTopPercent(era, wealth)), Math.round(wealthBottomPercent(era, wealth)));
}

export type Movement = 'up' | 'same' | 'down';

/**
 * 구간의 양 끝에서 이 점수 안쪽까지는 구간 밖이어도 "비슷함"으로 본다 (standingScore 기준, 0~100).
 * 근거: (1) 도착 자리는 4000판짜리 분포표에서 읽으므로 가운데 근처 백분위가 표본 잡음으로 약 ±0.8점(√(0.25/4000)) 흔들린다 — 그 2.5배 안은 방향을 정하지 않는다.
 * (2) 화면에 말하는 숫자는 정수로 반올림돼 있어 1~2점 차이는 읽는 사람에게 같은 자리다("상위 약 45%"와 "상위 약 46%"가 앞섬/뒤쪽으로 갈리면 R-091 증상이다).
 * 구간 안은 이 값과 무관하게 언제나 "비슷함"이고, 구간 밖이어도 이 값 이내만 "비슷함"이다. 가장 아래 단계의 "뒤쪽"과 가장 위 단계의 "앞섬"은 구조상 없다(점수 0·100 밖).
 * 단, 구간 바깥에 이 값보다 넓은 칸이 남지 않는 쪽에서는 여유가 0이다(movementOf, R-095) — 도착 점수가 가질 수 있는 값은 1~99뿐이라, 그 쪽의 칸이 모두 여유 안이면 그 방향은 영영 나올 수 없다.
 */
export const BAND_GRACE = 2;

/** 도착 점수가 가질 수 있는 값의 범위(standingScore): 상위 1% 안쪽 = 99, 하위 1% 안쪽 = 1 (0·100은 "약 0%"·"약 100%"라 말하지 않는다) */
const SCORE_MIN = 1;
const SCORE_MAX = 99;

/**
 * 출발선 구간에서 도착 자리로의 방향. 도착 점수(화면에 말한 자리 그대로)가 구간 위쪽 끝보다 grace를 넘어 더 부유하면 up,
 * 구간 아래쪽 끝보다 grace를 넘어 더 가난하면 down, 그 사이(구간 안 + 양쪽 grace)는 same. grace의 기본값은 BAND_GRACE(다른 값은 비교·측정용).
 * 문장에 쓰인 숫자(구간의 끝값·도착 자리)만 쓰므로 "하위 40% 안쪽의 집 → 하위 32%인데 앞선 자리" 같은 어긋남이 생길 수 없다.
 *
 * R-095: 구간 바깥에 grace보다 넓은 칸이 남지 않는 쪽은 그 쪽의 여유를 0으로 한다 — 위쪽은 `band.high + grace >= 99`, 아래쪽은 `band.low - grace <= 1`.
 * 안 그러면 여유 2점이 점수의 천장(99)·바닥(1)에 닿아 그 방향이 구조상 불가능해진다(지금 세상 4단계 [83, 97]은 98·99가 모두 "비슷함"이 돼 "상위 3~17% 사이의 집 → 상위 1% 안쪽"이 앞섬이 못 됐다).
 * 여유는 "구간 끝의 반올림 잡음을 덮는" 용도라, 구간 끝에서 천장·바닥까지가 여유 이내인 쪽은 덮을 경계가 없다 — 구간 밖이면 곧바로 앞섬/뒤쪽이다.
 */
export function movementOf(band: StartBand, end: Standing, grace: number = BAND_GRACE): Movement {
  const score = standingScore(end);
  const upGrace = band.high + grace >= SCORE_MAX ? 0 : grace;
  const downGrace = band.low - grace <= SCORE_MIN ? 0 : grace;
  if (score > band.high + upGrace) return 'up';
  if (score < band.low - downGrace) return 'down';
  return 'same';
}

// ---------- 생애 연표 ----------

export interface TimelineGroup {
  stage: Stage;
  /** 이 단계의 연표 항목 (시간순, 하나도 빼지 않는다) */
  entries: readonly HistoryEntry[];
}

/**
 * 연표를 생애 단계(영유아·학창·청년·중년·노년)별로 묶는다. 항목은 하나도 버리지 않는다 — 선택한 순간(choice)은 물론 서술 이벤트와 단계 기록도 그대로다.
 * (정상 플레이의 연표는 약 40~50줄이고 최대 약 117줄이다. 요약으로 줄이지 않고 단계 제목으로 나눠 읽게 한다.)
 */
export function buildTimeline(history: readonly HistoryEntry[]): TimelineGroup[] {
  const byStage = new Map<Stage, HistoryEntry[]>();
  for (const h of history) {
    const stage = stageOfAge(h.age);
    const list = byStage.get(stage);
    if (list === undefined) byStage.set(stage, [h]);
    else list.push(h);
  }
  return STAGES.filter((s) => byStage.has(s)).map((stage) => ({ stage, entries: byStage.get(stage)! }));
}

/** 단계 제목에 붙이는 나이 범위: 영유아 0~6세 / 학창 7~19세 / … / 노년 65세~ */
export function stageRangeOf(stage: Stage): { from: number; to: number | null } {
  const i = STAGES.indexOf(stage);
  const next = STAGES[i + 1];
  return { from: STAGE_TABLE[stage].startAge, to: next === undefined ? null : STAGE_TABLE[next].startAge - 1 };
}

// ---------- 회고 한 벌 ----------

/** 엔딩 화면이 필요로 하는 상태: 사망·시대·캐릭터·출생 스냅샷이 모두 있다(저장 검증이 ending 단계에서 보장한다). */
export type EndingGame = GameState & { era: Era; character: Character; death: Death; birthStats: Stats };

/** 학력·행복·관계: 처음 값과 마지막 값을 그대로 견줄 수 있는(뜻이 변하지 않는) 스탯 */
export const COMPARABLE_STATS = ['education', 'happiness', 'relationships'] as const;
export type ComparableStat = (typeof COMPARABLE_STATS)[number];

export interface StatChange {
  stat: ComparableStat;
  from: number;
  to: number;
}

/** 재산의 출발선 대비: 견줄 수 있으면 compared, 스무 살 전에 끝났으면 early(집안 형편만 말한다) */
export type WealthJourney = { kind: 'compared'; start: StartBand; end: Standing; movement: Movement } | { kind: 'early'; start: StartBand };

export interface EndingReview {
  journey: WealthJourney;
  changes: StatChange[];
  /** 본인이 고른 선택의 수 (연표의 선택 기록 중 `by`가 없는 것) — 부모님이 정한·흘러간 선택은 세지 않는다 (SPEC-005 PD9) */
  choiceCount: number;
  /** 어린 시절의 큰 결정 가운데 부모님이 내린 횟수(`by: 'parent'`)와 아이의 일로 흘러간 횟수(`by: 'child'`) — 엔딩의 둘째 줄 「어린 시절의 큰 결정 가운데 M번은 부모님이 내렸고, K번은 아이의 일로 흘러갔습니다」 (PD9, copy.md 11-1 ③) */
  delegated: { parent: number; child: number };
  timeline: TimelineGroup[];
}

export function reviewEnding(game: EndingGame, table: Record<Era, FinalDistribution> = FINAL_DISTRIBUTION): EndingReview {
  const start = startBandOf(game.era, game.character.parentWealth);
  let journey: WealthJourney = { kind: 'early', start };
  if (reachedIndependence(game.death.age) && game.assets !== null) {
    const end = finalWealthStanding(game.era, game.assets.net, table);
    journey = { kind: 'compared', start, end, movement: movementOf(start, end) };
  }
  return {
    journey,
    changes: COMPARABLE_STATS.map((stat) => ({ stat, from: game.birthStats[stat], to: game.stats[stat] })),
    choiceCount: game.history.reduce((n, h) => (h.kind === 'choice' && h.by === undefined ? n + 1 : n), 0),
    delegated: {
      parent: game.history.reduce((n, h) => (h.kind === 'choice' && h.by === 'parent' ? n + 1 : n), 0),
      child: game.history.reduce((n, h) => (h.kind === 'choice' && h.by === 'child' ? n + 1 : n), 0),
    },
    timeline: buildTimeline(game.history),
  };
}

/** 분포표의 모양이 맞는가 (생성 스크립트와 테스트가 쓴다): 시대마다 0~100번째 백분위 101칸, 정수, 줄지 않음, lives는 1 이상이고 simulated 이하 */
export function validateFinalDistribution(table: Record<Era, FinalDistribution>): string[] {
  const problems: string[] = [];
  for (const era of Object.keys(table) as Era[]) {
    const d = table[era];
    if (d.quantiles.length !== QUANTILE_COUNT) problems.push(`${era}: 칸 수가 ${d.quantiles.length}개다 (${QUANTILE_COUNT}칸이어야 한다)`);
    if (!d.quantiles.every((n) => Number.isInteger(n))) problems.push(`${era}: 정수가 아닌 칸이 있다`);
    for (let i = 1; i < d.quantiles.length; i++) {
      if (d.quantiles[i] < d.quantiles[i - 1]) {
        problems.push(`${era}: ${i}번째 백분위가 앞 칸보다 작다 (줄지 않아야 한다)`);
        break;
      }
    }
    if (!(d.lives > 0)) problems.push(`${era}: lives가 0 이하다`);
    if (d.lives > d.simulated) problems.push(`${era}: lives ${d.lives}가 simulated ${d.simulated}보다 크다`);
  }
  return problems;
}
