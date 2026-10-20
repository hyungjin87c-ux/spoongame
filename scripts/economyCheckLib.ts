import {
  ERAS,
  autoResolveStep,
  finalWealthStanding,
  movementOf,
  reachedIndependence,
  resolveChoiceStep,
  startBandOf,
  stepYear,
  type Era,
  type FinalDistribution,
  type GameState,
  type Movement,
  type ParentWealth,
} from '../src/core';
import { LIMITS } from '../src/data/economyTable';
import { EVENT_POOL } from '../src/data/events';
import { chooserFor, startLife, type Strategy } from './simulateLib';

/**
 * 경제 모델 밸런스 측정 (SPEC-003 EC7, docs/data/economy-model.md 9절). 순수 계산이라 `scripts/economyCheck.ts`(npm run check:economy)와
 * `tests/economyBalance.test.ts`가 함께 쓴다. Math.random·Date를 쓰지 않는다(시드 고정 → 같은 코드면 늘 같은 결과).
 *
 * 표본: 판마다 20세부터 죽을 때까지 **해마다 한 줄**(나이·부모 재력·순자산·부채·연 소득)을 남긴다(사람-년 표본).
 * 연령대 통계는 그 연령대에 든 모든 줄로 센다 — 통계(가계금융복지조사)의 "가구주 연령대"와 같은 단위는 아니지만(한 사람의 생애 곡선이라)
 * 같은 연령대에서 살아 있는 사람들의 분포라는 점에서 견줄 만하다(한계: 문서 12절 R2).
 */

/** 한 줄: 나이 a가 시작될 때(a-1세를 정산한 뒤)의 자산 */
export interface Sample {
  age: number;
  parentWealth: ParentWealth;
  /** 순자산(만 원, 음수 가능) */
  net: number;
  /** 부채(만 원) */
  debt: number;
  /** 그 해에 정산된 연 소득(만 원) */
  income: number;
}

/**
 * 한 판의 끝: 부모 재력(출발)·사망 나이·사망 시점 순자산(만 원, 엔딩이 읽는 값)·평생 가장 낮았던 순자산·엔딩 방향(앞섬/비슷함/뒤쪽, 스무 살 넘어 마친 판만).
 * 사망 시점 순자산은 사망한 해의 정산까지 끝난 값이라 마지막 줄(사망 나이가 시작될 때의 값)과 다를 수 있다.
 */
export interface LifeOutcome {
  parentWealth: ParentWealth;
  deathAge: number;
  /** 스무 살 넘어 마쳤는가(자산이 있는 판) */
  reached: boolean;
  net: number;
  minNet: number;
  movement: Movement | null;
}

/** 분포표를 주어 판들의 엔딩 방향을 다시 정한다(표를 바꿔 본다: 튜닝 도구용) */
export function withMovements(era: Era, lives: readonly LifeOutcome[], table: Record<Era, FinalDistribution>): LifeOutcome[] {
  return lives.map((l) => ({
    ...l,
    movement: l.reached ? movementOf(startBandOf(era, l.parentWealth), finalWealthStanding(era, l.net, table)) : null,
  }));
}

/** 한 판을 끝까지 돌려 20세부터의 줄과 끝(LifeOutcome)을 모은다 (core/life.ts#playToEnd와 같은 걸음 — 걸음 사이에 자산을 읽는 것만 다르다) */
export function playLife(seed: number, era: Era, strategy: Strategy): { samples: Sample[]; outcome: LifeOutcome } {
  let s: GameState = startLife(seed, era);
  const chooser = chooserFor(strategy, seed);
  const out: Sample[] = [];
  let lastAge = -1;
  const record = (st: GameState): void => {
    if (st.assets === null || st.character === null || st.age === lastAge) return;
    lastAge = st.age;
    out.push({ age: st.age, parentWealth: st.character.parentWealth, net: st.assets.net, debt: st.assets.debt, income: st.assets.income });
  };
  for (let i = 0; s.phase === 'life'; i++) {
    if (i >= 5000) throw new Error('samplesOfLife: 진행이 끝나지 않는다');
    const r =
      s.pending !== null
        ? (() => {
            const picked = chooser === null ? null : chooser(s);
            return picked === null ? autoResolveStep(s, s.pending.key) : resolveChoiceStep(s, s.pending.key, picked);
          })()
        : stepYear(s);
    s = r.state;
    record(s);
  }
  if (s.character === null || s.death === null) throw new Error('playLife: 사망에 도달하지 못했다');
  const reached = reachedIndependence(s.death.age) && s.assets !== null;
  const net = s.assets?.net ?? 0;
  const movement = reached ? movementOf(startBandOf(era, s.character.parentWealth), finalWealthStanding(era, net)) : null;
  const minNet = Math.min(net, ...out.map((x) => x.net));
  return { samples: out, outcome: { parentWealth: s.character.parentWealth, deathAge: s.death.age, reached, net, minNet, movement } };
}

/** 한 판의 20세부터의 줄만 */
export function samplesOfLife(seed: number, era: Era, strategy: Strategy): Sample[] {
  return playLife(seed, era, strategy).samples;
}

/** 시대의 표본 i = 1..plays의 시드 (uint32) */
export function economySeed(i: number): number {
  return (i * 7368787 + 1009) >>> 0;
}

/** 시대·전략의 판 1..plays를 돌려 모은 모든 줄과 판마다의 끝 */
export function collectLives(era: Era, plays: number, strategy: Strategy): { rows: Sample[]; lives: LifeOutcome[] } {
  const rows: Sample[] = [];
  const lives: LifeOutcome[] = [];
  for (let i = 1; i <= plays; i++) {
    const r = playLife(economySeed(i), era, strategy);
    for (const smp of r.samples) rows.push(smp);
    lives.push(r.outcome);
  }
  return { rows, lives };
}

/** 시대·전략의 판 1..plays를 돌려 모은 모든 줄 */
export function collectEra(era: Era, plays: number, strategy: Strategy): Sample[] {
  return collectLives(era, plays, strategy).rows;
}

// ---------- 통계 도우미 ----------

export function median(values: readonly number[]): number {
  if (values.length === 0) return NaN;
  const v = [...values].sort((a, b) => a - b);
  const m = v.length >> 1;
  return v.length % 2 === 1 ? v[m] : (v[m - 1] + v[m]) / 2;
}

export function mean(values: readonly number[]): number {
  return values.length === 0 ? NaN : values.reduce((a, b) => a + b, 0) / values.length;
}

/** 가장 가까운 순위의 p번째 백분위 (p: 0..100) */
export function percentile(values: readonly number[], p: number): number {
  if (values.length === 0) return NaN;
  const v = [...values].sort((a, b) => a - b);
  return v[Math.round((p / 100) * (v.length - 1))];
}

/** 조건을 만족하는 줄의 비율(%) */
export function sharePct<T>(rows: readonly T[], pred: (r: T) => boolean): number {
  return rows.length === 0 ? NaN : (rows.filter(pred).length * 100) / rows.length;
}

// ---------- 연령대 ----------

export interface Band {
  id: string;
  label: string;
  from: number;
  to: number;
}

/** 연령대 (포함 구간) */
export const BANDS: readonly Band[] = [
  { id: 'b20', label: '20~29', from: 20, to: 29 },
  { id: 'b30', label: '30~39', from: 30, to: 39 },
  { id: 'b40', label: '40~49', from: 40, to: 49 },
  { id: 'b50', label: '50~59', from: 50, to: 59 },
  { id: 'b60', label: '60~64', from: 60, to: 64 },
  { id: 'b65', label: '65~79', from: 65, to: 79 },
  { id: 'b80', label: '80 이상', from: 80, to: 130 },
];

export const bandRows = (rows: readonly Sample[], from: number, to: number): Sample[] => rows.filter((r) => r.age >= from && r.age <= to);

export interface BandStats {
  band: Band;
  n: number;
  netMedian: number;
  netMean: number;
  netP10: number;
  netP90: number;
  debtShare: number;
  /** 부채 있는 줄의 부채 중앙값 */
  debtMedianOfHolders: number;
  netNegativeShare: number;
  incomeMedian: number;
}

export function statsOfBand(rows: readonly Sample[], band: Band): BandStats {
  const r = bandRows(rows, band.from, band.to);
  const nets = r.map((x) => x.net);
  return {
    band,
    n: r.length,
    netMedian: median(nets),
    netMean: mean(nets),
    netP10: percentile(nets, 10),
    netP90: percentile(nets, 90),
    debtShare: sharePct(r, (x) => x.debt > 0),
    debtMedianOfHolders: median(r.filter((x) => x.debt > 0).map((x) => x.debt)),
    netNegativeShare: sharePct(r, (x) => x.net < 0),
    incomeMedian: median(r.map((x) => x.income)),
  };
}

// ---------- 목표와 가드 (docs/data/economy-model.md 9-1절, 15절) ----------

/** 목표 하나: kind가 `rel`이면 허용 폭은 목표의 비율(±), `pp`이면 %p(±) */
export interface Target {
  id: string;
  label: string;
  /** 통계 값(지금 세상, 근거 s-030·s-031) */
  target: number;
  tol: number;
  kind: 'rel' | 'pp';
  /** 측정 함수 */
  measure: (rows: readonly Sample[]) => number;
  /** 근거 */
  basis: string;
}

const band = (id: string): Band => BANDS.find((b) => b.id === id)!;
const netMed = (id: string) => (rows: readonly Sample[]) => statsOfBand(rows, band(id)).netMedian;
const ages = (from: number, to: number) => (rows: readonly Sample[]) => bandRows(rows, from, to);

export const TARGETS: readonly Target[] = [
  { id: 'net30', label: '30~39세 순자산 중앙값', target: 15585, tol: 0.4, kind: 'rel', measure: netMed('b30'), basis: 's-030' },
  { id: 'net40', label: '40~49세 순자산 중앙값', target: 28384, tol: 0.4, kind: 'rel', measure: netMed('b40'), basis: 's-030' },
  { id: 'net50', label: '50~59세 순자산 중앙값', target: 31685, tol: 0.4, kind: 'rel', measure: netMed('b50'), basis: 's-030' },
  // D21(15-4절): 통계의 「60세 이상」「65세 이상」은 그 나이 이상 전체이므로 모델도 그 나이 이상 전체로 센다. 60~64세·65~79세 표는 참고(연령대별 표)로 남는다.
  { id: 'net60', label: '60세 이상 순자산 중앙값', target: 25000, tol: 0.6, kind: 'rel', measure: (r) => median(ages(60, 130)(r).map((x) => x.net)), basis: 's-030 (60세 이상)' },
  { id: 'net65', label: '65세 이상 순자산 중앙값', target: 22100, tol: 0.6, kind: 'rel', measure: (r) => median(ages(65, 130)(r).map((x) => x.net)), basis: 's-030 (65세 이상)' },
  { id: 'debt30', label: '30대 부채 보유 비율(%)', target: 69.0, tol: 15, kind: 'pp', measure: (r) => sharePct(ages(30, 39)(r), (x) => x.debt > 0), basis: 's-030' },
  { id: 'debt40', label: '40대 부채 보유 비율(%)', target: 73.5, tol: 15, kind: 'pp', measure: (r) => sharePct(ages(40, 49)(r), (x) => x.debt > 0), basis: 's-030' },
  { id: 'debt50', label: '50대 부채 보유 비율(%)', target: 67.0, tol: 15, kind: 'pp', measure: (r) => sharePct(ages(50, 59)(r), (x) => x.debt > 0), basis: 's-030' },
  { id: 'debt60', label: '60세 이상 부채 보유 비율(%)', target: 45.1, tol: 15, kind: 'pp', measure: (r) => sharePct(ages(60, 130)(r), (x) => x.debt > 0), basis: 's-030' },
  { id: 'under3', label: '30~79세 순자산 3억 원 미만 비율(%)', target: 57.0, tol: 8, kind: 'pp', measure: (r) => sharePct(ages(30, 79)(r), (x) => x.net < 30000), basis: 's-030' },
  { id: 'over10', label: '30~79세 순자산 10억 원 이상 비율(%)', target: 11.8, tol: 8, kind: 'pp', measure: (r) => sharePct(ages(30, 79)(r), (x) => x.net >= 100000), basis: 's-030' },
  { id: 'dm30', label: '30대 부채 보유자 부채 중앙값', target: 10732, tol: 0.4, kind: 'rel', measure: (r) => median(ages(30, 39)(r).filter((x) => x.debt > 0).map((x) => x.debt)), basis: 's-030' },
  { id: 'dm40', label: '40대 부채 보유자 부채 중앙값', target: 11000, tol: 0.4, kind: 'rel', measure: (r) => median(ages(40, 49)(r).filter((x) => x.debt > 0).map((x) => x.debt)), basis: 's-030' },
  { id: 'dm50', label: '50대 부채 보유자 부채 중앙값', target: 7500, tol: 0.4, kind: 'rel', measure: (r) => median(ages(50, 59)(r).filter((x) => x.debt > 0).map((x) => x.debt)), basis: 's-030' },
  { id: 'dm60', label: '60세 이상 부채 보유자 부채 중앙값', target: 5000, tol: 0.4, kind: 'rel', measure: (r) => median(ages(60, 130)(r).filter((x) => x.debt > 0).map((x) => x.debt)), basis: 's-030' },
  { id: 'inc30', label: '30대 소득 중앙값', target: 6219, tol: 0.3, kind: 'rel', measure: (r) => median(ages(30, 39)(r).map((x) => x.income)), basis: 's-031' },
  { id: 'inc40', label: '40대 소득 중앙값', target: 7801, tol: 0.3, kind: 'rel', measure: (r) => median(ages(40, 49)(r).map((x) => x.income)), basis: 's-031' },
  { id: 'inc50', label: '50대 소득 중앙값', target: 7805, tol: 0.3, kind: 'rel', measure: (r) => median(ages(50, 59)(r).map((x) => x.income)), basis: 's-031' },
  { id: 'inc60', label: '60세 이상 소득 중앙값', target: 3978, tol: 0.3, kind: 'rel', measure: (r) => median(ages(60, 130)(r).map((x) => x.income)), basis: 's-031' },
];

/**
 * 허용 폭 밖으로 **보고한** 항목(docs/data/economy-model.md 9-3절)과, 보고한 값보다 나빠지지 않도록 지키는 한계. 15-3절: 맞추지 못한 항목은 계수를 비틀지 않고
 * 남은 차이·시도한 레버·이유를 보고한다 — 점검 도구는 이 항목이 보고한 한계 안에서 어긋나 있는 동안 불합격으로 세지 않고 「알려진 차이」로 적는다(한계를 넘으면 불합격).
 * 허용 폭 안으로 들어오면 이 목록에서 뺀다(시험이 알려 준다).
 */
export const KNOWN_GAPS: Record<string, { limit: (value: number) => boolean; why: string }> = {
  dm30: { limit: (v) => v >= 5_500, why: '30대 부채 보유자 부채 중앙값 6,243 (목표 10,732, 허용 6,439~) — D19 차입 한도가 생활비 때문에 지는 큰 빚(자동 대출)을 없애 부채 보유자의 중앙값이 내려갔다(한도 600 → 300이면 더 내려간다)' },
  dm40: { limit: (v) => v >= 5_500, why: '40대 부채 보유자 부채 중앙값 6,139 (목표 11,000, 허용 6,600~) — 같은 이유. 결혼 시작 부채를 6,000 → 7,500으로 올려도 +46뿐이라(부채 보유자 대부분이 작은 빚이다) 계수를 더 비틀지 않았다' },
  dm60: { limit: (v) => v <= 9_000, why: '60세 이상 부채 보유자 부채 중앙값 7,712 (목표 5,000, 허용 ~7,000) — D20 노년 안전망이 남은 부채를 동결해 노년 부채 보유자의 중앙값이 줄지 않는다(2a 18,532 → 7,712로 내려갔다)' },
  // M7e-3(E-4)가 새로 보고한 차이(economy-model.md 9-8절, 15-3절, planner E-12): `youth-lonely-city`를 독립 주거(월세·전세·자가)에서만 일어나게 하자 부모 집에 사는 판이 `lives_alone`을 얻지 않아
  // `youth-housing`의 「부모님 집에 머문다」(순자산 +400, 월세 없음)가 그대로 남는다 — 그 선택이 늘어 순자산이 오른다(그 이벤트만 되돌리면 50~59세 44,713 · 60세 이상 38,566 · 65세 이상 35,499 · 3억 미만 48.8%).
  // 레버(AGE 40~64세 ×1.71)를 1.76까지 올리면 이 네 항목은 돌아오지만 지금 세상 2단계 사망 시점 중앙값이 0으로 1단계와 붙고(end-g3) 60세 이상 부채 보유가 60.6%로 오른다 — 비틀지 않고 보고했다(마스터 결정 대기).
  // (debt60은 M7a r3 때 보고했던 차이였는데, 같은 이유로 순자산이 오르고 부채 보유가 59.4%로 내려가 허용 폭 안으로 돌아와 이 목록에서 뺐다.)
  net50: { limit: (v) => v <= 47_500, why: 'M7e-3 뒤 50~59세 순자산 중앙값 45,890 (허용 ~44,359; M7e-3 이전에는 허용 안) — E-4: 부모 집에 사는 판이 lonely-city에서 빠져 「부모님 집에 머문다」가 늘었다. AGE 1.76이면 43,804로 돌아오지만 지금 세상 end-g3가 깨진다(9-8절)' },
  // `net60`(60세 이상 순자산 중앙값)은 SPEC-005 QI5(PD13 본인 영역 가중 ×2.0)로 39,967이 되어 허용 폭(≤ 40,000) 안으로 **들어와 이 목록에서 뺐다**(M7e-3 40,868 → M8 40,467 → QI5 ×1.5 40,253 → ×2.0 39,967 — 한계까지 33만 원이라 가장자리다. 다시 넘으면 이 항목을 다시 올리고 마스터에게 보고한다).
  net65: { limit: (v) => v <= 39_500, why: 'M7e-3 뒤 65세 이상 순자산 중앙값 38,023 (허용 ~35,360) — 같은 이유(E-4)' },
  under3: { limit: (v) => v >= 46.5, why: 'M7e-3 뒤 30~79세 순자산 3억 원 미만 비율 47.8% (허용 49.0~) — 같은 이유(E-4). AGE 1.76이면 49.0%' },
  inc60: { limit: (v) => v >= 1_800, why: '60세 이상 소득 중앙값 2,169 (목표 3,978, 허용 2,785~) — R2(개인 모델의 연금 660 대 가구 소득, 마스터가 수용하고 계속 보고하기로 했다 — D21)' },
};

export interface TargetResult {
  target: Target;
  value: number;
  lo: number;
  hi: number;
  ok: boolean;
}

export function judgeTarget(t: Target, rows: readonly Sample[]): TargetResult {
  const value = t.measure(rows);
  const lo = t.kind === 'rel' ? t.target * (1 - t.tol) : t.target - t.tol;
  const hi = t.kind === 'rel' ? t.target * (1 + t.tol) : t.target + t.tol;
  return { target: t, value, lo, hi, ok: value >= lo && value <= hi };
}

/** 설계 가드(허용 폭과 별도): G3(수저 순서), M-2(20대 순자산<0 ≤ 60%), M-4(다가올 세상 65세 이상 순자산 중앙값 ≥ 0) */
export interface Guard {
  id: string;
  label: string;
  /** 사람이 읽는 측정값 */
  value: string;
  /** 숫자 측정값(알려진 차이의 한계 점검용): 비율은 %, 중앙값 비는 배 */
  metric: number;
  ok: boolean;
  /** true이면 참고 지표다: 어긋나도 불합격으로 세지 않는다(통계가 지금 세상 것이라 다른 시대에는 판정 기준이 아닌 가드) */
  reference?: boolean;
  /** metric이 여러 값의 최솟값일 때 그 구성 값(알려진 차이의 한계를 부분마다 다르게 걸 때 쓴다): end-g3는 인접한 두 재력 단계의 사망 시점 순자산 중앙값 차 [1→2, 2→3, 3→4, 4→5] */
  parts?: number[];
}

const byWealth = (rows: readonly Sample[], w: ParentWealth): Sample[] => rows.filter((r) => r.parentWealth === w);

/** 엔딩 쪽 가드의 한계 (15-4절): 사망 시점 순자산<0 비율(%) 지난·지금 ≤ 25, 다가올 ≤ 35 · 하한에 닿은 판 0% · 지금 세상 4단계 「뒤쪽」 ≤ 50%, 5단계 ≤ 70% · 자동 모드 40대 ≤ 수동의 1.5배, 앞섬 ≤ 45% */
export const END_LIMITS = {
  negativeShare: { past: 25, present: 25, future: 35 } as Record<Era, number>,
  floorShare: 0,
  downShare: { 4: 50, 5: 70 } as Record<number, number>,
  autoNet40Ratio: 1.5,
  autoUpShare: 45,
} as const;

const reachedLives = (lives: readonly LifeOutcome[]): LifeOutcome[] => lives.filter((l) => l.reached);
const lifeTier = (lives: readonly LifeOutcome[], w: ParentWealth): LifeOutcome[] => lives.filter((l) => l.parentWealth === w);

/** 사망 시점 순자산 단계별 중앙값(재력 1~5) */
export function deathNetMedians(lives: readonly LifeOutcome[]): number[] {
  return ([1, 2, 3, 4, 5] as const).map((w) => median(reachedLives(lifeTier(lives, w)).map((l) => l.net)));
}

/** 단계별 엔딩 방향 비율(%) — 앞섬/비슷함/뒤쪽 */
export function movementShares(lives: readonly LifeOutcome[]): Record<Movement, number> {
  const r = reachedLives(lives);
  return {
    up: sharePct(r, (l) => l.movement === 'up'),
    same: sharePct(r, (l) => l.movement === 'same'),
    down: sharePct(r, (l) => l.movement === 'down'),
  };
}

/**
 * 허용 폭 밖으로 **보고한** 가드(키 `시대:가드 id`)와 보고한 값보다 나빠지지 않도록 지키는 한계 (KNOWN_GAPS와 같은 규칙, 15-3절). 못 맞춘 이유·시도한 레버는 docs/data/economy-model.md 9-3절.
 */
export const KNOWN_GUARD_GAPS: Record<string, { limit: (metric: number, guard?: Guard) => boolean; why: string }> = {
  'past:g3-ratio': { limit: (v) => v >= 3.2, why: '지난 세상 5단계 대 1단계 40대 순자산 비 3.6배(≥ 4배; M7a r3 뒤 3.5배) — 지난 세상 5단계는 전체의 약 1%(6000판 중 약 60판)라 중앙값 잡음이 ±10%이고, 지난 세상은 생활비·집값이 낮아(0.7·0.6) 가난한 집이 그만큼 더 모은다. 지난 세상 생활비 계수를 0.75로 올리면 4.7배가 되지만 사망 시점 순자산<0이 32%가 된다' },
  'past:end-negative': { limit: (v) => v <= 30, why: '사망 시점 순자산<0 26.8%(≤ 25%; M7a r3 뒤 28.9%) — 1·2단계의 일부가 평생 빚에서 못 나온 채 끝난다(노년 안전망이 부채를 동결할 뿐 없애지 않는다)' },
  'present:end-negative': { limit: (v) => v <= 30, why: '사망 시점 순자산<0 26.5%(≤ 25%; M7a r3 뒤 26.4%) — 같은 이유. 사망 시점 순자산의 하한을 0으로 두는 규칙(상속 포기·한정승인의 근사, D22)이면 0%가 되지만 마스터가 채택하지 않았다(15-6절) — 빚으로 끝나는 인생도 엔딩에 그대로 보인다' },
  'future:end-negative': { limit: (v) => v <= 41, why: '사망 시점 순자산<0 38.3%(≤ 35%; M7a r3 뒤 38.3%) — 같은 이유 + 다가올 세상의 소득 대 생활·주거 계수(1.15 대 1.2·1.3)가 가난한 집에 더 무겁다' },
  // `present:end-g3`(지금 세상 재력 1·2단계 사망 시점 순자산 중앙값 0 = 0 동률, M8이 보고·마스터 승인 2026-10-20)은 SPEC-005 QI5(부모 결정)로 **통과로 돌아와 뺐다** — 2단계 중앙값이 0 → 1,251(PD13 본인 영역 가중 ×2.0 최종값: 1·2·3·4·5단계 0 < 1,251 < 36,353 < 124,629 < 178,212; 처음 ×1.5로 쟀을 때는 0 < 971 < 37,360 < 124,518 < 184,411).
  // 다만 2단계 중앙값은 0 근처에서 출렁이는 지표라(표본 1805판, 중앙값의 표준오차 약 1,700) 다음 콘텐츠 변경에서 다시 동률이 될 수 있다 — 그때는 이 목록에 다시 올리고 마스터에게 보고한다(옛 한계 기록: 1·2단계의 차만 0 이상, 나머지 인접 차는 0 초과).
  // M7a r2가 보고했던 지금 세상 4단계 엔딩 「뒤쪽」(51.4%)은 M7e-3의 「동률 불리」 규칙(엔딩 마스터 결정 C, 9-8절)과 순자산 상승으로 47.4%가 되어 통과로 돌아와 뺐다(M7e-4: 주석의 45.8%는 오기였다 — 9-8절·로그의 47.4%가 맞다, REV-003-M7e-1 R-382 (c)) — `present:end-down4`.
};

// ---------- 옛 재산 조건 7곳의 「같은 통과율」 (R-354, economy-model.md 5-A) ----------

/** 옛 재산 스탯 조건을 순자산 조건으로 옮긴 곳 하나: 이 나이에서 조건을 만족하는 줄의 비율이 옛 통과율(%)과 같아야 한다 */
export interface ConditionCheck {
  id: string;
  /** 사람이 읽는 위치 (이벤트·선택지·보너스) */
  where: string;
  /** 옛 통과율을 잰 나이 (5-A 표) */
  age: number;
  /** 옛 재산 조건의 통과율(%) — 프로토타입 4000판, 지금 세상 */
  oldRate: number;
  /** 지금 데이터의 순자산 조건 (이벤트 JSON에서 읽는다 — 값을 고치면 측정도 따라간다) */
  condition: { netMin?: number; netMax?: number };
  /** 마스터가 통과율 변화를 받아들인 곳(문구를 우선한 변경) — 같은 통과율을 요구하지 않고 이유를 보고한다 */
  accepted?: string;
  /**
   * 개발자가 맞추지 못해 **보고한** 차이(15-3절, 마스터 수용 전): 통과율이 허용 폭 밖이어도 `limit`(보고한 값보다 나빠지지 않는 한계) 안이면 불합격으로 세지 않고 「알려진 차이」로 적는다.
   * 허용 폭 안으로 들어오면 이 필드를 지운다(시험이 알려 준다).
   */
  reported?: { limit: (rate: number) => boolean; why: string };
}

/** 허용 폭: 옛 통과율의 ±15% (상대) — 5-A의 「±15% 측정 오차」와 같은 크기 */
export const CONDITION_TOLERANCE = 0.15;

function assetsOf(c: { assets?: { netMin?: number; netMax?: number } } | undefined, where: string): { netMin?: number; netMax?: number } {
  if (c?.assets === undefined) throw new Error(`conditionChecks: ${where}에 자산 조건이 없다`);
  return c.assets;
}

/** 7곳의 조건을 이벤트 데이터에서 읽어 만든다 */
export function conditionChecks(): ConditionCheck[] {
  const ev = (id: string) => {
    const e = EVENT_POOL.byId.get(id);
    if (e === undefined) throw new Error(`conditionChecks: 이벤트 ${id}가 없다`);
    return e;
  };
  const choice = (id: string, cid: string) => {
    const c = ev(id).choices?.find((x) => x.id === cid);
    if (c === undefined) throw new Error(`conditionChecks: 선택지 ${id}/${cid}가 없다`);
    return c;
  };
  const bonusWith = (bonuses: ReadonlyArray<{ when: { assets?: { netMin?: number; netMax?: number } } }> | undefined, key: 'netMin' | 'netMax', where: string) => {
    const b = bonuses?.find((x) => x.when.assets?.[key] !== undefined);
    if (b === undefined) throw new Error(`conditionChecks: ${where}에 ${key} 보너스가 없다`);
    return b.when.assets!;
  };
  return [
    { id: 'senior-estate', where: 'senior-estate 이벤트 조건', age: 74, oldRate: 66, condition: assetsOf(ev('senior-estate').conditions, 'senior-estate') },
    {
      id: 'youth-return-school',
      where: 'youth-return-school 이벤트 조건',
      age: 29,
      oldRate: 97,
      condition: assetsOf(ev('youth-return-school').conditions, 'youth-return-school'),
      accepted: 'R-355 마스터 결정: 본문 「모아 둔 돈이 어느 정도 쌓였다」에 맞춰 netMin 0 — 통과율 변화는 수용(문구 우선)',
    },
    { id: 'middle-child-school/fund', where: 'middle-child-school/fund 선택지 조건', age: 57, oldRate: 85, condition: assetsOf(choice('middle-child-school', 'fund').requires, 'middle-child-school/fund') },
    { id: 'middle-layoff/open', where: 'middle-layoff/open 선택지 조건', age: 51, oldRate: 91, condition: assetsOf(choice('middle-layoff', 'open').requires, 'middle-layoff/open') },
    {
      id: 'middle-parents-care/facility',
      where: 'middle-parents-care/facility 보너스',
      age: 55,
      oldRate: 17,
      condition: bonusWith(choice('middle-parents-care', 'facility').bonuses, 'netMin', 'middle-parents-care/facility'),
      reported: {
        limit: (rate) => rate <= 24,
        why: 'M7e-3 뒤 통과율 21.4% (옛 17%, 허용 14.4 ~ 19.5%) — 순자산 상승(E-4, 위 KNOWN_GAPS의 net50 등과 같은 이유)으로 10억 원 이상인 55세가 늘었다. 보고하고 계수는 비틀지 않았다(15-3절, 9-8절)',
      },
    },
    { id: 'senior-retire(netMin)', where: 'senior-retire 보너스(행복 +3)', age: 67, oldRate: 30, condition: bonusWith(ev('senior-retire').bonuses, 'netMin', 'senior-retire') },
    {
      id: 'senior-retire(netMax)',
      where: 'senior-retire 보너스(행복 −3)',
      age: 67,
      oldRate: 15,
      condition: bonusWith(ev('senior-retire').bonuses, 'netMax', 'senior-retire'),
    },
  ];
}

export interface ConditionResult {
  check: ConditionCheck;
  /** 지금 모델에서 이 나이에 조건을 만족하는 줄의 비율(%) */
  rate: number;
  lo: number;
  hi: number;
  /** 허용 폭 안인가 (accepted인 곳은 판정하지 않고, reported인 곳은 보고한 한계 안이면 true) */
  ok: boolean;
  /** 허용 폭 밖이지만 보고한 한계 안이라 통과로 센 경우(reported) */
  known: boolean;
  n: number;
}

export const conditionPasses = (c: ConditionCheck['condition'], net: number): boolean => (c.netMin === undefined || net >= c.netMin) && (c.netMax === undefined || net <= c.netMax);

/** 표본(지금 세상)에서 7곳의 통과율을 재 옛 통과율의 ±15%와 견준다 */
export function judgeConditions(rows: readonly Sample[], checks: readonly ConditionCheck[] = conditionChecks()): ConditionResult[] {
  return checks.map((check) => {
    const at = rows.filter((r) => r.age === check.age);
    const rate = sharePct(at, (r) => conditionPasses(check.condition, r.net));
    const lo = check.oldRate * (1 - CONDITION_TOLERANCE);
    const hi = Math.min(100, check.oldRate * (1 + CONDITION_TOLERANCE));
    const inRange = rate >= lo && rate <= hi;
    const known = check.accepted === undefined && !inRange && check.reported !== undefined && check.reported.limit(rate);
    return { check, rate, lo, hi, ok: check.accepted !== undefined ? true : inRange || known, known, n: at.length };
  });
}

/** 한 시대(지금 세상 기준)의 가드. rows는 그 시대의 표본, lives는 그 시대의 판마다의 끝(없으면 엔딩 쪽 가드는 건너뛴다) */
export function guardsOf(era: Era, rows: readonly Sample[], lives: readonly LifeOutcome[] = []): Guard[] {
  const out: Guard[] = [];
  const m40 = (w: ParentWealth) => median(bandRows(byWealth(rows, w), 40, 49).map((x) => x.net));
  const m1 = m40(1);
  const m5 = m40(5);
  out.push({
    id: 'g3-ratio',
    label: '재력 5단계 대 1단계의 40대 순자산 중앙값 비 ≥ 4배',
    value: `${Math.round(m5)} / ${Math.round(m1)} = ${m1 > 0 ? (m5 / m1).toFixed(1) : '(1단계 ≤ 0)'}배`,
    metric: m1 > 0 ? m5 / m1 : Number.POSITIVE_INFINITY,
    ok: m1 > 0 ? m5 >= 4 * m1 : m5 > 0,
  });
  const n50 = median(bandRows(byWealth(rows, 1), 50, 59).map((x) => x.net));
  out.push({ id: 'g3-poor50', label: '재력 1단계의 50대 순자산 중앙값 > 0', value: `${Math.round(n50)}`, metric: n50, ok: n50 > 0 });
  const neg60 = sharePct(bandRows(byWealth(rows, 5), 60, 69), (x) => x.net < 0);
  out.push({ id: 'g3-rich60', label: '재력 5단계의 60대 순자산<0 비율 < 15%', value: `${neg60.toFixed(1)}%`, metric: neg60, ok: neg60 < 15 });
  const neg20 = sharePct(bandRows(rows, 20, 29), (x) => x.net < 0);
  // M-2의 근거(통계: 가구주 29세 이하 순자산 중앙값 5,000만 원 > 0)는 지금 세상 것이라 다른 시대는 참고로만 본다
  out.push({ id: 'm2-young', label: '20~29세 순자산<0 비율 ≤ 60% (M-2)', value: `${neg20.toFixed(1)}%`, metric: neg20, ok: neg20 <= 60, reference: era !== 'present' });
  if (era === 'future') {
    const m65 = median(bandRows(rows, 65, 130).map((x) => x.net));
    out.push({ id: 'm4-future65', label: '다가올 세상 65세 이상 순자산 중앙값 ≥ 0 (M-4)', value: `${Math.round(m65)}`, metric: m65, ok: m65 >= 0 });
  }
  if (lives.length > 0) out.push(...endingGuardsOf(era, lives));
  return out;
}

/** 엔딩(사망 시점 순자산) 가드 (15-4절) */
export function endingGuardsOf(era: Era, lives: readonly LifeOutcome[]): Guard[] {
  const out: Guard[] = [];
  const reached = reachedLives(lives);
  const neg = sharePct(reached, (l) => l.net < 0);
  out.push({ id: 'end-negative', label: `사망 시점 순자산<0 비율 ≤ ${END_LIMITS.negativeShare[era]}%`, value: `${neg.toFixed(1)}%`, metric: neg, ok: neg <= END_LIMITS.negativeShare[era] });
  const floor = sharePct(lives, (l) => l.minNet <= LIMITS.netMin);
  out.push({ id: 'end-floor', label: '순자산 하한(−20억 원)에 닿은 판 0%', value: `${floor.toFixed(2)}%`, metric: floor, ok: floor <= END_LIMITS.floorShare });
  const med = deathNetMedians(lives);
  out.push({
    id: 'end-g3',
    label: '재력 단계별 사망 시점 순자산 중앙값 1 < 2 < 3 < 4 < 5',
    value: med.map((m) => Math.round(m)).join(' < '),
    metric: Math.min(...med.map((m, i) => (i === 0 ? Number.POSITIVE_INFINITY : m - med[i - 1]))),
    ok: med.every((m, i) => i === 0 || m > med[i - 1]),
    parts: med.slice(1).map((m, i) => m - med[i]),
  });
  // 엔딩 방향은 지금 세상이 판정 기준이다(다른 시대는 참고)
  for (const w of [4, 5] as const) {
    const down = sharePct(reachedLives(lifeTier(lives, w)), (l) => l.movement === 'down');
    out.push({
      id: `end-down${w}`,
      label: `${w}단계 엔딩 「뒤쪽」 ≤ ${END_LIMITS.downShare[w]}%`,
      value: `${down.toFixed(1)}%`,
      metric: down,
      ok: down <= END_LIMITS.downShare[w],
      reference: era !== 'present',
    });
  }
  return out;
}

/** 자동 모드 가드 (15-4절, EC6 우선): 40대 순자산 중앙값 ≤ 수동 흉내의 1.5배 · 엔딩 「앞섬」 ≤ 45%. manual·auto는 같은 시대의 표본 */
export function autoGuardsOf(
  manual: { rows: readonly Sample[]; lives: readonly LifeOutcome[] },
  auto: { rows: readonly Sample[]; lives: readonly LifeOutcome[] },
): Guard[] {
  const m = statsOfBand(manual.rows, band('b40')).netMedian;
  const a = statsOfBand(auto.rows, band('b40')).netMedian;
  const ratio = a / m;
  const up = movementShares(auto.lives).up;
  return [
    {
      id: 'auto-net40',
      label: `자동 모드 40대 순자산 중앙값 ≤ 수동 흉내의 ${END_LIMITS.autoNet40Ratio}배`,
      value: `${Math.round(a)} / ${Math.round(m)} = ${ratio.toFixed(2)}배`,
      metric: ratio,
      ok: m > 0 ? ratio <= END_LIMITS.autoNet40Ratio : a <= 0,
    },
    { id: 'auto-up', label: `자동 모드 엔딩 「앞섬」 ≤ ${END_LIMITS.autoUpShare}%`, value: `${up.toFixed(1)}%`, metric: up, ok: up <= END_LIMITS.autoUpShare },
  ];
}

/** 지난·다가올 세상의 40대 순자산 중앙값을 지금 세상과 견준 비율의 목표 구간 (9-1절) */
export const ERA_RATIO_RANGE: Record<Exclude<Era, 'present'>, readonly [number, number]> = { past: [0.5, 0.9], future: [0.3, 0.9] };

export interface EraRatio {
  era: Exclude<Era, 'present'>;
  ratio: number;
  lo: number;
  hi: number;
  ok: boolean;
}

export function eraRatios(byEra: Record<Era, readonly Sample[]>): EraRatio[] {
  const base = statsOfBand(byEra.present, band('b40')).netMedian;
  return (['past', 'future'] as const).map((era) => {
    const ratio = statsOfBand(byEra[era], band('b40')).netMedian / base;
    const [lo, hi] = ERA_RATIO_RANGE[era];
    return { era, ratio, lo, hi, ok: ratio >= lo && ratio <= hi };
  });
}

/** 전체 측정: 시대별 표본을 모아 목표·가드·시대 비율을 판정한다 */
export interface EconomyReport {
  plays: number;
  strategy: Strategy;
  rows: Record<Era, Sample[]>;
  lives: Record<Era, LifeOutcome[]>;
  targets: TargetResult[];
  guards: Record<Era, Guard[]>;
  ratios: EraRatio[];
}

export function measureEconomy(plays: number, strategy: Strategy): EconomyReport {
  const collected = Object.fromEntries(ERAS.map((era) => [era, collectLives(era, plays, strategy)])) as Record<Era, { rows: Sample[]; lives: LifeOutcome[] }>;
  const rows = Object.fromEntries(ERAS.map((era) => [era, collected[era].rows])) as Record<Era, Sample[]>;
  const lives = Object.fromEntries(ERAS.map((era) => [era, collected[era].lives])) as Record<Era, LifeOutcome[]>;
  return {
    plays,
    strategy,
    rows,
    lives,
    targets: TARGETS.map((t) => judgeTarget(t, rows.present)),
    guards: Object.fromEntries(ERAS.map((era) => [era, guardsOf(era, rows[era], lives[era])])) as Record<Era, Guard[]>,
    ratios: eraRatios(rows),
  };
}
