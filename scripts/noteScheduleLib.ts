import { NOTE_LIMITS, autoResolveStep, consumeNote, dueNote, resolveChoiceStep, stepYear, type Chooser, type GameState, type ProfileId, type NoteCardDef } from '../src/core';
import { NOTE_CARDS } from '../src/data/noteCards';
import { startLife } from './simulateLib';

/**
 * 기록 카드 스케줄 시뮬레이션 (SPEC-003 M7c 완료 기준 1 — content-M7c 7-4절): `dueNote`를 소비 모드(시트 없이 「마음속에 담고 살기」)로 돌려 한 판마다 어느 카드가 몇 살에 뜨는지 모으고,
 * 불변식(판당 ≤ 7 · 같은 종류 ≤ 1 · 한 해 ≤ 1장 · 간격 ≥ 2년 · 나이 창 밖 0장 · 에러 0)을 매 카드마다 검사한다. 평균 카드 수·종류별 도달률·결정 카드와 같은 해에 겹친 비율을 **보고**한다.
 * 실행: `npm run report:notes [-- 판수=1000]` / 시험: tests/noteCards.test.ts. 인생(스탯·자산·rngState)에는 영향이 없다(소비는 `seen`만 쓴다).
 */

export interface ShownNote {
  id: string;
  age: number;
  /** 같은 해에 중대 결정 카드(선택지 이벤트)가 뽑혔는가 — 기록 카드는 해의 첫머리, 결정 카드는 해의 끝이라 시트는 이어서 열린다(NC-7) */
  withDecision: boolean;
}

export interface LifeSchedule {
  seed: number;
  deathAge: number;
  shown: ShownNote[];
}

/** 한 판을 끝까지 돌리며 기록 카드 스케줄을 모은다. chooser가 null이면 자동 모드(성향 선택)와 같은 선택이다. */
export function scheduleOneLife(seed: number, era: ProfileId, chooser: Chooser | null, cards: readonly NoteCardDef[] = NOTE_CARDS): LifeSchedule {
  let s: GameState = startLife(seed, era);
  const shown: ShownNote[] = [];
  let guard = 0;
  while (s.phase === 'life') {
    if (++guard > 2000) throw new Error(`스케줄 시뮬레이션이 끝나지 않는다 (시드 ${seed})`);
    if (s.pending !== null) {
      const picked = chooser === null ? null : chooser(s);
      const r = picked === null ? autoResolveStep(s, s.pending.key) : resolveChoiceStep(s, s.pending.key, picked);
      if (r.state === s) throw new Error(`선택이 적용되지 않았다 (시드 ${seed})`);
      s = r.state;
      continue;
    }
    const due = dueNote(s, cards);
    let entry: ShownNote | null = null;
    if (due !== null) {
      entry = { id: due.id, age: s.age, withDecision: false };
      s = consumeNote(s, due);
    }
    const r = stepYear(s);
    if (entry !== null) {
      entry.withDecision = r.tick.kind === 'choice';
      shown.push(entry);
    }
    s = r.state;
  }
  return { seed, deathAge: s.death?.age ?? s.age, shown };
}

/** 한 판의 불변식 위반 목록 (비어 있어야 한다) */
export function scheduleProblems(life: LifeSchedule, cards: readonly NoteCardDef[] = NOTE_CARDS): string[] {
  const problems: string[] = [];
  const at = `시드 ${life.seed}`;
  if (life.shown.length > NOTE_LIMITS.autoCards) problems.push(`${at}: 자동 카드 ${life.shown.length}장 (최대 ${NOTE_LIMITS.autoCards})`);
  const ids = new Set<string>();
  life.shown.forEach((n, i) => {
    if (ids.has(n.id)) problems.push(`${at}: ${n.id}가 두 번 떴다`);
    ids.add(n.id);
    const card = cards.find((c) => c.id === n.id);
    if (card === undefined) problems.push(`${at}: 알 수 없는 카드 ${n.id}`);
    else if (n.age < card.ageRange.min || n.age > card.ageRange.max) problems.push(`${at}: ${n.id}가 나이 창(${card.ageRange.min}~${card.ageRange.max}) 밖인 ${n.age}세에 떴다`);
    if (i > 0) {
      const gap = n.age - life.shown[i - 1].age;
      if (gap === 0) problems.push(`${at}: 한 해(${n.age}세)에 카드가 둘이다 (${life.shown[i - 1].id}, ${n.id})`);
      else if (gap < NOTE_LIMITS.gapYears) problems.push(`${at}: ${life.shown[i - 1].id}(${life.shown[i - 1].age}세)와 ${n.id}(${n.age}세)의 간격이 ${gap}년이다 (최소 ${NOTE_LIMITS.gapYears})`);
      if (n.age < life.shown[i - 1].age) problems.push(`${at}: 카드가 나이 순서가 아니다`);
    }
  });
  return problems;
}

export interface ScheduleReport {
  era: ProfileId;
  lives: number;
  problems: string[];
  /** 판당 카드 수의 평균 (전체 / 사망 나이 70세 이상) */
  meanCards: number;
  meanCardsLong: number;
  longLives: number;
  /** 판당 카드 수 분포 (0~7장인 판의 수) */
  histogram: number[];
  /** 카드 id → 도달률 (전체 / 70세 이상) */
  reach: Record<string, number>;
  reachLong: Record<string, number>;
  /** 카드 id → 뜬 나이의 (최소, 평균, 최대) */
  ages: Record<string, { min: number; mean: number; max: number; shown: number }>;
  /** 결정 카드와 같은 해에 겹친 기록 카드의 비율 (전체 / 카드별) */
  overlap: number;
  overlapByCard: Record<string, number>;
  totalCards: number;
}

export function runNoteSchedule(era: ProfileId, lives: number, chooser: (seed: number) => Chooser | null, seed0 = 1, cards: readonly NoteCardDef[] = NOTE_CARDS): ScheduleReport {
  const problems: string[] = [];
  const histogram = Array.from({ length: NOTE_LIMITS.autoCards + 1 }, () => 0);
  const count: Record<string, number> = {};
  const countLong: Record<string, number> = {};
  const agesAcc: Record<string, { sum: number; min: number; max: number; n: number }> = {};
  const overlapAcc: Record<string, { n: number; withDecision: number }> = {};
  let total = 0;
  let longLives = 0;
  let cardsInLong = 0;
  let overlapped = 0;
  for (let i = 0; i < lives; i++) {
    const life = scheduleOneLife(seed0 + i, era, chooser(seed0 + i), cards);
    for (const p of scheduleProblems(life, cards)) problems.push(p);
    histogram[Math.min(life.shown.length, NOTE_LIMITS.autoCards)]++;
    total += life.shown.length;
    const long = life.deathAge >= 70;
    if (long) {
      longLives++;
      cardsInLong += life.shown.length;
    }
    for (const n of life.shown) {
      count[n.id] = (count[n.id] ?? 0) + 1;
      if (long) countLong[n.id] = (countLong[n.id] ?? 0) + 1;
      const a = (agesAcc[n.id] ??= { sum: 0, min: Infinity, max: -Infinity, n: 0 });
      a.sum += n.age;
      a.min = Math.min(a.min, n.age);
      a.max = Math.max(a.max, n.age);
      a.n++;
      const o = (overlapAcc[n.id] ??= { n: 0, withDecision: 0 });
      o.n++;
      if (n.withDecision) {
        o.withDecision++;
        overlapped++;
      }
    }
  }
  const ids = cards.map((c) => c.id);
  return {
    era,
    lives,
    problems,
    meanCards: total / lives,
    meanCardsLong: longLives === 0 ? 0 : cardsInLong / longLives,
    longLives,
    histogram,
    reach: Object.fromEntries(ids.map((id) => [id, (count[id] ?? 0) / lives])),
    reachLong: Object.fromEntries(ids.map((id) => [id, longLives === 0 ? 0 : (countLong[id] ?? 0) / longLives])),
    ages: Object.fromEntries(ids.map((id) => [id, { min: agesAcc[id]?.min ?? 0, mean: agesAcc[id] ? agesAcc[id].sum / agesAcc[id].n : 0, max: agesAcc[id]?.max ?? 0, shown: agesAcc[id]?.n ?? 0 }])),
    overlap: total === 0 ? 0 : overlapped / total,
    overlapByCard: Object.fromEntries(ids.map((id) => [id, overlapAcc[id] ? overlapAcc[id].withDecision / overlapAcc[id].n : 0])),
    totalCards: total,
  };
}
