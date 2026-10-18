import { ERAS, autoResolveStep, resolveChoiceStep, stepYear, type Era, type EventPool, type GameState } from '../src/core';
import { EVENT_POOL } from '../src/data/events';
import { chooserFor, startLife, type Strategy } from './simulateLib';

/**
 * SPEC-003 M7a 영유아(0~7세) 콘텐츠 지표 (IN1~IN7 단언의 측정 도우미). 순수 계산 — tests/infantContent.test.ts와 scripts/infantMetrics.ts가 함께 쓴다.
 * 헤드리스 시뮬레이션: 0세에서 시작해 8세가 되기 전까지만(영유아기 0~7세 여덟 해, 마스터 결정 M-3: 영유아 집계는 단계가 아니라 나이) 돌린다 — 끝까지 사는 시뮬레이션보다 훨씬 빠르다.
 */

/** 영유아기로 세는 마지막 나이 (0~7세 여덟 해) */
export const INFANT_LAST_AGE = 7;

export interface InfantLife {
  seed: number;
  era: Era;
  /** 0~7세 안에서 죽었으면 사망 나이, 아니면 null */
  deathAge: number | null;
  /** 0~7세 여덟 해(사망 전까지) 중 인생 기록에 사건·선택 줄이 하나도 없는 해 */
  emptyYears: number;
  /** 0~7세 인생 기록의 사건·선택 줄 수 (출생 줄 제외) */
  lines: number;
  /** 0~7세에 만난 선택지 이벤트 수 (나이 기준) */
  choices: number;
  /** 영유아 단계(0~6세)만 센 선택지 이벤트 수 — 기준선 V1(1.44~1.45)과 같은 정의 */
  choicesInfantStage: number;
  /** 0~7세에 한 해 두 줄 이상이 남은 해의 수 (마일스톤 + 일반 사건) */
  doubleYears: number;
  /** 일어난 이벤트 id → 나이 (본 이벤트 기록 중 0~7세) */
  seen: Record<string, number>;
  /** 보인 선택지 구성: 선택지 이벤트 id → 그때 보인 선택지 id 목록 */
  shown: Record<string, string[]>;
  /** 8세가 되었을 때 상태(사망했으면 마지막 상태) */
  final: GameState;
}

/** 한 판을 0~7세까지 돌린다. strategy: auto(성향) / first / random */
export function infantLife(seed: number, era: Era, strategy: Strategy, pool: EventPool = EVENT_POOL, start?: GameState): InfantLife {
  let s = start ?? startLife(seed, era);
  const chooser = chooserFor(strategy, seed);
  const shown: Record<string, string[]> = {};
  let guard = 0;
  while (s.phase === 'life' && s.age <= INFANT_LAST_AGE) {
    if (++guard > 200) throw new Error(`infantLife: 진행이 끝나지 않는다 (seed ${seed} ${era})`);
    if (s.pending !== null) {
      shown[s.pending.eventId] = [...s.pending.choiceIds];
      const picked = chooser === null ? null : chooser(s);
      const r = picked === null ? autoResolveStep(s, s.pending.key, pool) : resolveChoiceStep(s, s.pending.key, picked, pool);
      if (r.state === s) throw new Error('infantLife: 선택이 적용되지 않았다');
      s = r.state;
    } else {
      s = stepYear(s, pool).state;
    }
  }
  const deathAge = s.phase === 'ending' && s.death !== null && s.death.age <= INFANT_LAST_AGE ? s.death.age : null;
  const perAge = new Array<number>(INFANT_LAST_AGE + 1).fill(0);
  let choices = 0;
  let choicesInfantStage = 0;
  for (const h of s.history) {
    if (h.age > INFANT_LAST_AGE) continue;
    if (h.kind === 'event' || h.kind === 'choice') perAge[h.age]++;
    if (h.kind === 'choice') {
      choices++;
      if (h.age <= 6) choicesInfantStage++;
    }
  }
  let emptyYears = 0;
  let lines = 0;
  let doubleYears = 0;
  for (let a = 0; a <= INFANT_LAST_AGE; a++) {
    if (deathAge !== null && a > deathAge) break;
    if (perAge[a] === 0) emptyYears++;
    if (perAge[a] >= 2) doubleYears++;
    lines += perAge[a];
  }
  const seen: Record<string, number> = {};
  for (const [id, age] of Object.entries(s.seen)) if (age <= INFANT_LAST_AGE) seen[id] = age;
  return { seed, era, deathAge, emptyYears, lines, choices, choicesInfantStage, doubleYears, seen, shown, final: s };
}

export interface InfantSummary {
  era: Era;
  lives: number;
  emptyMean: number;
  emptyMax: number;
  linesMean: number;
  choicesMean: number;
  choicesInfantStageMean: number;
  doubleYearsMean: number;
}

const mean = (xs: readonly number[]): number => xs.reduce((a, b) => a + b, 0) / (xs.length || 1);

export function summarizeInfant(lives: readonly InfantLife[]): InfantSummary {
  return {
    era: lives[0].era,
    lives: lives.length,
    emptyMean: mean(lives.map((l) => l.emptyYears)),
    emptyMax: Math.max(...lives.map((l) => l.emptyYears)),
    linesMean: mean(lives.map((l) => l.lines)),
    choicesMean: mean(lives.map((l) => l.choices)),
    choicesInfantStageMean: mean(lives.map((l) => l.choicesInfantStage)),
    doubleYearsMean: mean(lives.map((l) => l.doubleYears)),
  };
}

/** 시대별로 count판을 돌린다 (시드는 시드 간격 7919로 고정 — 같은 입력이면 같은 결과) */
export function infantLives(era: Era, count: number, strategy: Strategy, pool: EventPool = EVENT_POOL): InfantLife[] {
  const out: InfantLife[] = [];
  for (let i = 0; i < count; i++) out.push(infantLife(i * 7919 + 13, era, strategy, pool));
  return out;
}

export { ERAS };
