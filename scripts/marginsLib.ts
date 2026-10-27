import { totalCards, timingEraOfProfile, type ProfileId } from '../src/core';
import { INFANT_CHOICE_MEAN_MIN, LIFE_LENGTH_MODES, SENIOR_CHOICE_MEAN_MIN } from '../src/data/timingTable';
import { infantLives } from './infantMetricsLib';
import { pipelineSeed } from './pipelineLib';
import { SIM_PROFILES, simulateLife, type LifeSummary, type Strategy } from './simulateLib';

/**
 * 판정 여유 표 (SPEC-003 M8, REV-003-M8-1 R-415 / LD-9): 30분 모드의 **새 판정 지표 전부**가 측정값에서 얼마나 떨어져 있는지를 표준오차(SE) 배수로 보인다.
 * `npm run report:time -- 1000 --only=margins`가 찍는다. 판정이 아니라 **보고**다 — 3 SE를 못 지키는 칸은 값을 바꾸지 않고 「3 SE 미만」으로 표시해 보고한다.
 *
 * **판정은 네 줄을 합친 표본으로 한다 (SPEC-005 QI5 마스터 결정 — 설계 문서 9절 1번, REV-003-M8-2 3번의 선택지 (b))**: 줄 하나(1000판)의 표준오차로 네 줄이 모두 3 SE를 지키라는 것은 모집단 값이 임계에서 4 SE쯤 떨어져 있어야 통과하는 엄격한 요구라,
 * 난수 흐름이 바뀌는 변경(예: QI5의 부모 결정)이 오면 칸마다 반쯤의 확률로 걸렸다. 같은 질문(측정값이 임계에서 3 SE 이상인가)을 **4000판을 합친 표본**(시드 줄 둘 × 전략 둘)으로 묻고, 줄별 값은 아래 표에 그대로 두되 **보고**(`lineUnder3`)로만 남긴다.
 * 임계는 그대로다(M-3 「임계를 더 내리지 않는다」와 충돌 없음).
 *
 * 시드 줄 둘:
 *  - 시험: tests/simulation.test.ts의 `simulateMany` 줄 (i × 7919 + 13) — 수동 흉내(random), 자동 성향(auto)
 *  - sim:1000: `npm run sim:1000`이 쓰는 줄 (`pipelineSeed(i, era, 전략, 'short30')`) — 수동 흉내(manual = random), 자동 성향(auto)
 *    파이프라인은 세션 reducer 경로와 playToEnd 경로의 인생이 같음을 점검하므로(`runPipelineLife`) 같은 시드의 playToEnd 결과가 곧 sim:1000의 칸 값이다.
 *
 * SE 정의: 평균 지표 = 판 단위 표준편차 ÷ √판 수. 비율 지표 = Agresti-Coull(비율 0이어도 SE가 0이 되지 않는다). 분위 지표(5% 분위 ≥ 16, 95% 분위 ≤ 40분)는 같은 뜻의 비율로 바꿔 쓴다
 * (5% 분위 ≥ 16 ⇔ 16장 미만 판 ≤ 5%, 95% 분위 ≤ 40분 ⇔ 40분 초과 판 ≤ 5%). 세 시대 평균 시간의 SE = √(세 시대 SE² 합) ÷ 3.
 */

export type MarginStrategy = Extract<Strategy, 'auto' | 'random'>;

export interface MarginLine {
  id: string;
  label: string;
  /** 시험(simulateMany의 시드 줄) / sim:1000(pipelineSeed 줄) */
  seedLine: 'test' | 'sim:1000';
  strategy: MarginStrategy;
}

export const MARGIN_LINES: readonly MarginLine[] = [
  { id: 'test-random', label: '시험 · 수동 흉내', seedLine: 'test', strategy: 'random' },
  { id: 'test-auto', label: '시험 · 자동 성향', seedLine: 'test', strategy: 'auto' },
  { id: 'sim-manual', label: 'sim:1000 · 수동 흉내', seedLine: 'sim:1000', strategy: 'random' },
  { id: 'sim-auto', label: 'sim:1000 · 자동 성향', seedLine: 'sim:1000', strategy: 'auto' },
];

export function marginSeeds(line: MarginLine, era: ProfileId, count: number): number[] {
  const out: number[] = [];
  for (let i = 1; i <= count; i++) out.push(line.seedLine === 'test' ? i * 7919 + 13 : pipelineSeed(i, era, line.strategy === 'auto' ? 'auto' : 'manual', 'short30'));
  return out;
}

export function marginLives(line: MarginLine, era: ProfileId, count: number): LifeSummary[] {
  return marginSeeds(line, era, count).map((seed) => simulateLife(seed, era, line.strategy, undefined, { lifeLength: 'short30' }));
}

// ---------- 통계 ----------

const mean = (xs: readonly number[]): number => xs.reduce((a, b) => a + b, 0) / (xs.length || 1);
const sd = (xs: readonly number[]): number => {
  const m = mean(xs);
  return Math.sqrt(mean(xs.map((x) => (x - m) ** 2)));
};
/** 평균의 표준오차 */
export const meanSe = (xs: readonly number[]): number => sd(xs) / Math.sqrt(xs.length || 1);
/** 비율의 표준오차 (Agresti-Coull — 비율이 0이거나 1이어도 0이 되지 않는다) */
export function propSe(hits: number, n: number): number {
  const nn = n + 4;
  const p = (hits + 2) / nn;
  return Math.sqrt((p * (1 - p)) / nn);
}
const quantile = (xs: readonly number[], p: number): number => {
  const v = [...xs].sort((a, b) => a - b);
  return v[Math.min(v.length - 1, Math.floor((p / 100) * v.length))];
};

// ---------- 한 칸(시대 × 줄)의 지표 ----------

export interface MarginValue {
  /** 측정값 (표시 단위로) */
  value: number;
  /** 측정값의 표준오차 (표시 단위로, 없으면 null) */
  se: number | null;
  /** 한계까지의 여유 — 표준오차 배수 (안쪽이 +). 한계가 없거나 표준오차를 못 쓰는 지표는 null */
  margin: number | null;
  digits: number;
}

export interface MarginMetric {
  id: string;
  label: string;
  /** 한계를 말로 */
  limit: string;
  /** 시대·줄 하나에서 값을 낸다 */
  of: (lives: readonly LifeSummary[], era: ProfileId) => MarginValue;
}

const minutesOf = (l: LifeSummary): number => l.seconds1x / 60;
const highMinutesOf = (l: LifeSummary): number => l.seconds1xHigh / 60;
const infantCards = (l: LifeSummary): number => l.final.history.filter((h) => h.kind === 'choice' && h.age <= 7).length;

const mode = LIFE_LENGTH_MODES.short30;
/** 시대별 모델 시간 판정 구간 (tests/simulation.test.ts — modelLow − 1.5 ~ modelHigh + 1.5) */
export const ERA_TIME_BAND = { low: mode.timeMin.modelLow - 1.5, high: mode.timeMin.modelHigh + 1.5 };

/** 평균 ≥ 하한 / 평균 ≤ 상한 꼴 */
const meanMetric = (id: string, label: string, limit: string, pick: (l: LifeSummary) => number, bound: (era: ProfileId) => number, dir: 'min' | 'max', digits = 2): MarginMetric => ({
  id,
  label,
  limit,
  of: (lives, era) => {
    const xs = lives.map(pick);
    const m = mean(xs);
    const se = meanSe(xs);
    const b = bound(era);
    return { value: m, se, margin: (dir === 'min' ? m - b : b - m) / se, digits };
  },
});

/** 비율 ≤ 한계 꼴 (value는 %) */
const shareMetric = (id: string, label: string, limit: string, pop: (lives: readonly LifeSummary[]) => LifeSummary[], hit: (l: LifeSummary) => boolean, max: number): MarginMetric => ({
  id,
  label,
  limit,
  of: (lives) => {
    const group = pop(lives);
    const hits = group.filter(hit).length;
    const n = group.length || 1;
    const se = propSe(hits, n);
    return { value: (hits / n) * 100, se: se * 100, margin: (max - hits / n) / se, digits: 2 };
  },
});

export const CARD_METRICS: readonly MarginMetric[] = [
  meanMetric('cards-low', '결정 카드 평균 ≥ 하한', `≥ ${mode.cards.meanLow}장`, (l) => totalCards(l.counts), () => mode.cards.meanLow, 'min'),
  // 본인이 읽고 고르는 카드 c_self의 평균 하한 (SPEC-005 TM5): 총 카드 수 구간(23.3~29)은 그대로이고 c_self 하한을 따로 둔다 — 측정값 − 3 SE 규칙(LD-9)
  meanMetric('cards-self-low', '본인 카드 c_self 평균 ≥ 하한', `≥ ${mode.cardsSelf.meanLow}장`, (l) => l.counts.choice, () => mode.cardsSelf.meanLow, 'min'),
  meanMetric('cards-high', '결정 카드 평균 ≤ 상한', `≤ ${mode.cards.meanHigh}장`, (l) => totalCards(l.counts), () => mode.cards.meanHigh, 'max'),
  shareMetric('near-cap', '하드−1 이상인 판 비율 (%)', `≤ ${mode.cards.nearCapShareMax * 100}%`, (lives) => [...lives], (l) => totalCards(l.counts) >= mode.pacing.hard - 1, mode.cards.nearCapShareMax),
  {
    id: 'p05',
    label: '5% 분위 (16장 미만 판 ≤ 5%와 같은 뜻)',
    limit: '5% 분위 ≥ 16장',
    of: (lives) => {
      const cards = lives.map((l) => totalCards(l.counts));
      const hits = cards.filter((c) => c < 16).length;
      const se = propSe(hits, cards.length);
      return { value: quantile(cards, 5), se: null, margin: (0.05 - hits / cards.length) / se, digits: 0 };
    },
  },
  shareMetric('under20', '사망 70세+ 중 20장 미만 판 비율 (%)', '≤ 10%', (lives) => lives.filter((l) => l.deathAge >= 70), (l) => totalCards(l.counts) < 20, 0.1),
  meanMetric('senior', '노년(65세+) 결정 카드 평균', `≥ 시대별 하한 (${SIM_PROFILES.map((e) => SENIOR_CHOICE_MEAN_MIN[timingEraOfProfile(e)].toFixed(2)).join(' / ')})`, (l) => l.choicesByStage.senior, (era) => SENIOR_CHOICE_MEAN_MIN[timingEraOfProfile(era)], 'min'),
  meanMetric('infant7', '영유아(0~7세) 결정 카드 평균', `≥ ${INFANT_CHOICE_MEAN_MIN}`, infantCards, () => INFANT_CHOICE_MEAN_MIN, 'min'),
];

export const TIME_METRICS: readonly MarginMetric[] = [
  meanMetric('time-low', '시대별 모델 시간(분) ≥ 하한', `≥ ${ERA_TIME_BAND.low}분`, minutesOf, () => ERA_TIME_BAND.low, 'min'),
  meanMetric('time-high', '시대별 모델 시간(분) ≤ 상한', `≤ ${ERA_TIME_BAND.high}분`, minutesOf, () => ERA_TIME_BAND.high, 'max'),
  {
    id: 'time-p95',
    label: '판 시간 95% 분위 (40분 초과 판 ≤ 5%와 같은 뜻)',
    limit: '95% 분위 ≤ 40분',
    of: (lives) => {
      const mins = lives.map(minutesOf);
      const hits = mins.filter((m) => m > 40).length;
      const se = propSe(hits, mins.length);
      return { value: quantile(mins, 95), se: null, margin: (0.05 - hits / mins.length) / se, digits: 1 };
    },
  },
  {
    id: 'time-max',
    label: '판 시간 최댓값 (분) — 표준오차가 없는 값 (보고만)',
    limit: '≤ 45분',
    of: (lives) => ({ value: Math.max(...lives.map(minutesOf)), se: null, margin: null, digits: 1 }),
  },
  meanMetric('time-reader-high', '읽기 「높음」(느린 독자) 평균 시간(분)', '≤ 40분', highMinutesOf, () => 40, 'max'),
];

export const ALL_METRICS: readonly MarginMetric[] = [...CARD_METRICS, ...TIME_METRICS];

// ---------- 표 ----------

export interface MarginCellResult {
  line: MarginLine;
  era: ProfileId;
  lives: LifeSummary[];
}

/** 세 시대 평균 시간의 여유 (줄마다 하나): 하한 27, 상한 33 */
export function threeEraAverage(cells: readonly MarginCellResult[], line: MarginLine): { mean: number; se: number; marginLow: number; marginHigh: number } {
  const eras = SIM_PROFILES.map((era) => cells.find((c) => c.line.id === line.id && c.era === era)!.lives.map(minutesOf));
  const avg = mean(eras.map(mean));
  const se = Math.sqrt(eras.reduce((a, xs) => a + meanSe(xs) ** 2, 0)) / eras.length;
  return { mean: avg, se, marginLow: (avg - mode.timeMin.modelLow) / se, marginHigh: (mode.timeMin.modelHigh - avg) / se };
}

const f = (n: number, d: number) => n.toFixed(d);
const fmt = (v: MarginValue): string => {
  const flag = v.margin !== null && v.margin < 3 ? ' ⚠' : '';
  return `${f(v.value, v.digits)}${v.se !== null ? ` ±${f(v.se, v.digits)}` : ''} (${v.margin === null ? '-' : `${f(v.margin, 1)} SE`})${flag}`;
};

export interface MarginReport {
  cells: MarginCellResult[];
  /** 마크다운 */
  text: string;
  /** 합친 표본(네 줄 4000판)으로 3 SE 미만인 칸 — **판정** (지표·시대·여유) */
  under3: Array<{ metric: string; era: string; line: string; margin: number }>;
  /** 줄별(1000판)로 3 SE 미만인 칸 — **보고만** (판정 아님) */
  lineUnder3: Array<{ metric: string; era: string; line: string; margin: number }>;
  problems: string[];
}

/** 줄 넷을 합친 표본을 가리키는 가짜 줄 (판정용) */
export const POOLED_LINE: MarginLine = { id: 'pooled', label: '합친 4줄 (판정)', seedLine: 'test', strategy: 'random' };

export function marginReport(count: number, lines: readonly MarginLine[] = MARGIN_LINES, onProgress?: (msg: string) => void): MarginReport {
  const cells: MarginCellResult[] = [];
  const problems: string[] = [];
  for (const line of lines) {
    for (const era of SIM_PROFILES) {
      onProgress?.(`${line.label} / ${era}`);
      const lives = marginLives(line, era, count);
      for (const l of lives) if (totalCards(l.counts) > mode.pacing.hard) problems.push(`${line.id}/${era} 시드 ${l.seed}: 결정 카드 ${totalCards(l.counts)}장이 하드 상한을 넘었다`);
      cells.push({ line, era, lives });
    }
  }
  const under3: MarginReport['under3'] = [];
  const lineUnder3: MarginReport['lineUnder3'] = [];
  const out: string[] = [];
  // 합친 표본: 시대마다 모든 줄의 판을 이어 붙인다
  for (const era of SIM_PROFILES) cells.push({ line: POOLED_LINE, era, lives: lines.flatMap((line) => cells.find((c) => c.line.id === line.id && c.era === era)!.lives) });
  const valueOf = (m: MarginMetric, line: MarginLine, era: ProfileId): MarginValue => m.of(cells.find((c) => c.line.id === line.id && c.era === era)!.lives, era);

  out.push(`### 시대 × 전략 × 시드 줄별 모델 시간·카드 평균 (${count}판, 30분 모드 — 연출 계수 ${mode.holdScale}, 페이싱 soft ${mode.pacing.soft} / hard ${mode.pacing.hard}, 읽기 중앙, 1배속 수동)`);
  out.push(`| 시드 줄 · 전략 | 시대 | 카드 평균 ± SE | 모델 시간(분) ± SE | 시간 표준편차(분) | 사망 나이 |`);
  out.push(`|---|---|---:|---:|---:|---:|`);
  for (const line of lines) {
    for (const era of SIM_PROFILES) {
      const lv = cells.find((c) => c.line.id === line.id && c.era === era)!.lives;
      const cards = lv.map((l) => totalCards(l.counts));
      const mins = lv.map(minutesOf);
      out.push(`| ${line.label} | ${era} | ${f(mean(cards), 2)} ±${f(meanSe(cards), 2)} | ${f(mean(mins), 2)} ±${f(meanSe(mins), 2)} | ${f(sd(mins), 2)} | ${f(mean(lv.map((l) => l.deathAge)), 1)} |`);
    }
    const a = threeEraAverage(cells, line);
    out.push(`| ${line.label} | **세 시대 평균** | | **${f(a.mean, 2)}** ±${f(a.se, 2)} | | |`);
  }
  for (const era of SIM_PROFILES) {
    const lv = cells.find((c) => c.line.id === POOLED_LINE.id && c.era === era)!.lives;
    const cards = lv.map((l) => totalCards(l.counts));
    const mins = lv.map(minutesOf);
    out.push(`| ${POOLED_LINE.label} | ${era} | ${f(mean(cards), 2)} ±${f(meanSe(cards), 2)} | ${f(mean(mins), 2)} ±${f(meanSe(mins), 2)} | ${f(sd(mins), 2)} | ${f(mean(lv.map((l) => l.deathAge)), 1)} |`);
  }
  {
    const a = threeEraAverage(cells, POOLED_LINE);
    out.push(`| ${POOLED_LINE.label} | **세 시대 평균** | | **${f(a.mean, 2)}** ±${f(a.se, 2)} | | |`);
  }

  out.push('');
  out.push(`### 판정 여유 — 한계까지의 거리를 표준오차(SE) 배수로 (안쪽이 +, 3 SE 미만은 ⚠, LD-9: 임계는 측정값에서 3 SE 이상). 값 ±SE (여유). **판정은 맨 오른쪽 「합친 4줄」**(4000판), 줄별 칸의 ⚠는 보고다`);
  for (const metric of ALL_METRICS) {
    out.push('');
    out.push(`**${metric.label}** — 한계 ${metric.limit}`);
    out.push(`| 시대 | ${lines.map((l) => l.label).join(' | ')} | **${POOLED_LINE.label}** |`);
    out.push(`|---|${lines.map(() => '---:').join('|')}|---:|`);
    for (const era of SIM_PROFILES) {
      const row = lines.map((line) => {
        const v = valueOf(metric, line, era);
        if (v.margin !== null && v.margin < 3) lineUnder3.push({ metric: metric.label, era, line: line.label, margin: v.margin });
        return fmt(v);
      });
      const pooled = valueOf(metric, POOLED_LINE, era);
      if (pooled.margin !== null && pooled.margin < 3) under3.push({ metric: metric.label, era, line: POOLED_LINE.label, margin: pooled.margin });
      out.push(`| ${era} | ${row.join(' | ')} | **${fmt(pooled)}** |`);
    }
  }

  out.push('');
  out.push(`**세 시대 평균 시간(분)** — 한계 ${mode.timeMin.modelLow}~${mode.timeMin.modelHigh}분 (아래쪽 / 위쪽 여유)`);
  out.push(`| 줄 | 평균 ± SE | 하한 ${mode.timeMin.modelLow}분까지 | 상한 ${mode.timeMin.modelHigh}분까지 |`);
  out.push(`|---|---:|---:|---:|`);
  for (const line of [...lines, POOLED_LINE]) {
    const a = threeEraAverage(cells, line);
    for (const [name, m] of [['아래', a.marginLow], ['위', a.marginHigh]] as const) if (m < 3) (line.id === POOLED_LINE.id ? under3 : lineUnder3).push({ metric: `세 시대 평균 시간 (${name})`, era: '평균', line: line.label, margin: m });
    out.push(`| ${line.label} | ${f(a.mean, 2)} ±${f(a.se, 2)} | ${f(a.marginLow, 1)} SE${a.marginLow < 3 ? ' ⚠' : ''} | ${f(a.marginHigh, 1)} SE${a.marginHigh < 3 ? ' ⚠' : ''} |`);
  }

  // 판정마다 쓰는 줄이 다르다: 카드·시간 판정은 시험 · 수동 흉내(tests/simulation.test.ts)가 하고 나머지 줄은 보고(sim:1000)·R-416의 자동 성향 판정이다.
  out.push('');
  out.push(under3.length === 0 ? '**판정 — 합친 4줄에서 3 SE 미만인 칸: 없음**' : `**판정 — 합친 4줄에서 3 SE 미만인 칸 ${under3.length}개**: ${under3.map((u) => `${u.metric} / ${u.era} (${f(u.margin, 1)} SE)`).join(' · ')}`);
  out.push(lineUnder3.length === 0 ? '줄별 3 SE 미만인 칸(보고): 없음' : `줄별 3 SE 미만인 칸(보고만) ${lineUnder3.length}개: ${lineUnder3.map((u) => `${u.metric} / ${u.era} / ${u.line} (${f(u.margin, 1)} SE)`).join(' · ')}`);
  return { cells, text: out.join('\n'), under3, lineUnder3, problems };
}

// ---------- IN2 (빈 해) ----------

export interface InfantMarginRow {
  era: ProfileId;
  strategy: 'auto' | 'random';
  five: { hits: number; n: number; shareMax: number; margin: number };
  four: { hits: number; n: number };
  emptyMean: { value: number; se: number; margin: number };
  choices: { value: number; se: number; margin: number };
}

/** IN2 판정(tests/infantContent.test.ts: 빈 해 5개 이상인 판 ≤ 0.5%·평균 ≤ 1.5 / 선택지 평균 ≥ 2.8)의 여유 */
export function infantMargins(count: number): InfantMarginRow[] {
  const out: InfantMarginRow[] = [];
  for (const strategy of ['auto', 'random'] as const) {
    for (const era of SIM_PROFILES) {
      const lives = infantLives(era, count, strategy);
      const five = lives.filter((l) => l.emptyYears >= 5).length;
      const four = lives.filter((l) => l.emptyYears >= 4).length;
      const empty = lives.map((l) => l.emptyYears);
      const ch = lives.map((l) => l.choices);
      out.push({
        era,
        strategy,
        five: { hits: five, n: count, shareMax: 0.005, margin: (0.005 - five / count) / propSe(five, count) },
        four: { hits: four, n: count },
        emptyMean: { value: mean(empty), se: meanSe(empty), margin: (1.5 - mean(empty)) / meanSe(empty) },
        choices: { value: mean(ch), se: meanSe(ch), margin: (mean(ch) - 2.8) / meanSe(ch) },
      });
    }
  }
  return out;
}

