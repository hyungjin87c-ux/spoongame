import { describe, expect, it } from 'vitest';
import {
  ERAS,
  STAGES,
  STAT_KEYS,
  advanceYear,
  autoResolveStep,
  estimatePlaySeconds,
  holdDelayMs,
  holdMsFor,
  autoChoiceDelayMs,
  maxAgeOf,
  parseGame,
  playToEnd,
  resolveChoice,
  resolveChoiceStep,
  resolveEffects,
  stepYear,
  serializeGame,
  type Era,
  type GameState,
  type TickCounts,
} from '../src/core';
import { EVENT_POOL } from '../src/data/events';
import { CHOICE_PACING, EVENT_FREQUENCY, HISTORY_LIMITS, STATE_LIMITS } from '../src/data/lifeTable';
import { AUTO_CHOICE_MS, CHOICE_COUNT_TARGET, HOLD_MS, JUMP_OVERHEAD_SEC, READ_SEC_PER_CHOICE, TIME_TARGET_MIN } from '../src/data/timingTable';
import { balanceOf, chooserFor, encounterTable, reportEra, reportOf, simulateLife, simulateMany, startLife, type LifeSummary, type Strategy } from '../scripts/simulateLib';
import { syntheticEvents, syntheticPool } from '../scripts/syntheticPool';

/**
 * 헤드리스 시뮬레이션: UI 없이 core 순수 함수만으로 인생을 끝까지 돌린다.
 * 세 시대 × 시드 400개 × (자동 선택 / 무작위 수동 선택) = 2400판에서 에러 0건,
 * 매 걸음 스탯 범위·나이 단조·연표 상한·저장 가능성, 반드시 사망 도달을 확인한다.
 */
/** 무거운 시뮬레이션은 처음 쓰는 테스트에서 한 번만 돌린다(describe 본문에서 바로 돌리면 -t로 일부만 실행해도 전부 돈다). */
function lazy<T>(compute: () => T): () => T {
  let cache: { value: T } | null = null;
  return () => (cache ??= { value: compute() }).value;
}

const SEEDS = 400;

/** 실제 EVENT_POOL로 세 시대 x 시드 1000개를 '무작위 수동 선택'으로 한 번만 돌린 판들 — 수명·시간 모델·밸런스 단언이 함께 쓴다 (npm run sim과 같은 계산). */
const REPORT_SEEDS = 1000;
const sharedLives = lazy(() => Object.fromEntries(ERAS.map((era) => [era, simulateMany(era, REPORT_SEEDS, 'random')])) as Record<Era, LifeSummary[]>);
const seedOf = (i: number) => i * 7919 + 13;
const STRATEGIES: Strategy[] = ['auto', 'random'];

/** 걸음마다 불변식을 검사하며 끝까지 진행한다. 위반하면 throw(메시지에 시드·시대·나이). */
function checkedPlay(seed: number, era: Era, strategy: Strategy, deepValidate: boolean): GameState {
  let s = startLife(seed, era);
  const pickRng = strategy === 'random' ? seed % 3 : 0;
  let prevAge = s.age;
  let prevHistory = s.history.length;
  for (let step = 0; s.phase === 'life'; step++) {
    if (step > 1000) throw new Error(`${era} ${seed}: 진행이 끝나지 않는다`);
    const where = `${era} seed ${seed} age ${s.age} step ${step}`;
    let next: GameState;
    if (s.pending !== null) {
      const ids = s.pending.choiceIds;
      next = strategy === 'auto' ? autoResolveStep(s, s.pending.key).state : resolveChoice(s, s.pending.key, ids[(step + pickRng) % ids.length]);
      if (next === s) throw new Error(`${where}: 선택이 적용되지 않았다`);
    } else {
      next = advanceYear(s);
      if (next === s) throw new Error(`${where}: 진행이 적용되지 않았다`);
    }
    // 스탯 0~100 정수
    for (const k of STAT_KEYS) {
      const v = next.stats[k];
      if (!Number.isInteger(v) || v < 0 || v > 100) throw new Error(`${where}: 스탯 ${k}=${v} 범위 밖`);
    }
    // 나이 단조: 줄지 않고, 한 걸음에 최대 1살
    if (next.age < prevAge || next.age - prevAge > 1) throw new Error(`${where}: 나이가 ${prevAge} → ${next.age}`);
    // 연표: 줄지 않고(상한 정책 전까지), 상한 이하, 나이가 거꾸로 가지 않는다
    if (next.history.length > HISTORY_LIMITS.maxEntries) throw new Error(`${where}: 연표 상한 초과`);
    if (next.history.length < prevHistory) throw new Error(`${where}: 연표가 줄었다`);
    for (let i = 1; i < next.history.length; i++) {
      if (next.history[i].age < next.history[i - 1].age) throw new Error(`${where}: 연표 나이가 거꾸로 간다`);
    }
    // 플래그: 정렬·중복 없음, 본 이벤트 수 상한
    if (next.flags.length > STATE_LIMITS.maxFlags || new Set(next.flags).size !== next.flags.length) throw new Error(`${where}: 플래그 이상`);
    if (Object.keys(next.seen).length > STATE_LIMITS.maxSeen) throw new Error(`${where}: seen 상한 초과`);
    // 대기 중인 선택지는 현재 나이·실제 이벤트와 맞는다
    if (next.pending !== null) {
      if (next.pending.age !== next.age) throw new Error(`${where}: 대기 나이 불일치`);
      if (!EVENT_POOL.byId.has(next.pending.eventId)) throw new Error(`${where}: 없는 이벤트`);
      if (next.pending.choiceIds.length < 2 || next.pending.choiceIds.length > 3) throw new Error(`${where}: 선택지 수 ${next.pending.choiceIds.length}`);
    }
    // 저장 가능성: 모든 걸음의 상태가 직렬화 → 검증을 통과한다(손상 저장이 되지 않는다)
    if (deepValidate && parseGame(serializeGame(next)) === null) throw new Error(`${where}: 저장 검증 실패`);
    prevAge = next.age;
    prevHistory = next.history.length;
    s = next;
  }
  return s;
}

describe('헤드리스 시뮬레이션: 세 시대 × 시드 400개 × 두 선택 전략, 에러 0건', () => {
  for (const era of ERAS) {
    for (const strategy of STRATEGIES) {
      it(`${era} / ${strategy}: ${SEEDS}판 모두 스탯 범위·나이 단조·연표 상한을 지키며 사망에 도달한다`, () => {
        let deaths = 0;
        for (let i = 1; i <= SEEDS; i++) {
          const end = checkedPlay(seedOf(i), era, strategy, i <= 25); // 앞 25판은 매 걸음 저장 검증까지
          expect(end.phase).toBe('ending');
          expect(end.death).not.toBeNull();
          expect(end.death!.age).toBeLessThanOrEqual(maxAgeOf(era));
          deaths++;
        }
        expect(deaths).toBe(SEEDS);
      });
    }
  }

  it('시뮬레이션 보조(simulateLife)도 같은 불변식으로 시대별 300판을 에러 없이 돌린다', () => {
    for (const era of ERAS) {
      for (let i = 1; i <= 300; i++) expect(() => simulateLife(seedOf(i) + 1, era, i % 2 ? 'auto' : 'random')).not.toThrow();
    }
  });

  it('합성 풀(형태만 갖춘 이벤트 40개, 참고용)에서도 에러 없이 끝난다', () => {
    const pool = syntheticPool();
    for (const era of ERAS) for (let i = 1; i <= 100; i++) expect(() => simulateLife(seedOf(i) + 2, era, 'auto', pool)).not.toThrow();
  });
});

describe('평균 수명·사망 분포 (시대별 계수)', () => {
  const lifeReports = lazy(() => Object.fromEntries(ERAS.map((era) => [era, reportOf(era, sharedLives()[era])])) as Record<Era, ReturnType<typeof reportOf>>);

  it('시대별 평균 사망 나이: 지난 세상 < 지금 세상 < 다가올 세상, 현실적인 범위 안', () => {
    const mean = (e: Era) => lifeReports()[e].deathAge.mean;
    expect(mean('past')).toBeLessThan(mean('present'));
    expect(mean('present')).toBeLessThan(mean('future'));
    expect(mean('past')).toBeGreaterThan(68);
    expect(mean('past')).toBeLessThan(82);
    expect(mean('present')).toBeGreaterThan(74);
    expect(mean('present')).toBeLessThan(88);
    expect(mean('future')).toBeGreaterThan(77);
    expect(mean('future')).toBeLessThan(92);
  });

  it('요절(20세 전 사망)은 드물다 (3% 미만), 대부분 70~90대에 사망한다', () => {
    for (const era of ERAS) {
      const r = lifeReports()[era];
      const early = Object.entries(r.deathByDecade)
        .filter(([k]) => Number.parseInt(k, 10) < 20)
        .reduce((a, [, v]) => a + v, 0);
      expect(early, era).toBeLessThan(3);
      const late = Object.entries(r.deathByDecade)
        .filter(([k]) => Number.parseInt(k, 10) >= 70)
        .reduce((a, [, v]) => a + v, 0);
      expect(late, era).toBeGreaterThan(75);
      expect(r.deathAge.max, era).toBeLessThanOrEqual(maxAgeOf(era));
    }
  });
});

describe('시간 모델 (연도당 연출 시간 · 선택지 빈도 · 읽는 시간 가정치)', () => {
  const counts = (over: Partial<TickCounts> = {}): TickCounts => ({ quiet: 0, narrative: 0, choice: 0, resolved: 0, death: 0, ...over });

  it('상수 표: 연출 시간은 조용한 해 < 서술 이벤트 < 선택 결과 읽기 순이고, 선택지 빈도는 0~1 확률이다', () => {
    expect(HOLD_MS.quiet).toBeLessThan(HOLD_MS.narrative);
    expect(HOLD_MS.resolved).toBeLessThan(HOLD_MS.narrative * 1.5);
    expect(HOLD_MS.quiet).toBeGreaterThan(0);
    expect(READ_SEC_PER_CHOICE).toBeGreaterThan(0);
    for (const f of Object.values(EVENT_FREQUENCY)) {
      expect(f.choice).toBeGreaterThan(0);
      expect(f.choice).toBeLessThan(1);
      expect(f.narrative).toBeGreaterThan(0);
      expect(f.narrative).toBeLessThan(1);
    }
  });

  it('holdMsFor: 한 해의 연출 대기. 선택지·사망에는 타이머 대기가 없다(null)', () => {
    expect(holdMsFor('quiet')).toBe(HOLD_MS.quiet);
    expect(holdMsFor('narrative')).toBe(HOLD_MS.narrative);
    expect(holdMsFor('resolved')).toBe(HOLD_MS.resolved);
    expect(holdMsFor(null)).toBe(HOLD_MS.quiet); // 새로고침 직후
    expect(holdMsFor('none')).toBe(HOLD_MS.quiet);
    expect(holdMsFor('choice')).toBeNull();
    expect(holdMsFor('death')).toBeNull();
  });

  it('holdDelayMs: 배속으로 나누고(1/2/4/8배), 개발용 시간 배율로 더 나누며, 선택지·사망에는 null', () => {
    expect(holdDelayMs('quiet', 1)).toBe(HOLD_MS.quiet);
    expect(holdDelayMs('quiet', 2)).toBe(HOLD_MS.quiet / 2);
    expect(holdDelayMs('quiet', 4)).toBe(HOLD_MS.quiet / 4);
    expect(holdDelayMs('quiet', 8)).toBe(HOLD_MS.quiet / 8);
    expect(holdDelayMs('narrative', 8)).toBe(HOLD_MS.narrative / 8);
    expect(holdDelayMs('quiet', 1, 100)).toBe(HOLD_MS.quiet / 100);
    expect(holdDelayMs('choice', 8)).toBeNull();
    expect(holdDelayMs('death', 1)).toBeNull();
    expect(autoChoiceDelayMs(1)).toBe(AUTO_CHOICE_MS);
    expect(autoChoiceDelayMs(8)).toBe(AUTO_CHOICE_MS / 8);
    expect(autoChoiceDelayMs(8, 1000)).toBe(AUTO_CHOICE_MS / 8 / 1000);
  });

  it('estimatePlaySeconds: 직접 계산한 값과 같다 (건너뛰기 없음 = 연출 합/배속 + 선택지×읽기, 다음 결정으로 = 선택지×(읽기)+(선택지+1)×오버헤드)', () => {
    const c = counts({ quiet: 60, narrative: 10, resolved: 18, choice: 20 });
    const hold = (60 * HOLD_MS.quiet + 10 * HOLD_MS.narrative + 18 * HOLD_MS.resolved) / 1000;
    expect(estimatePlaySeconds(c, { speed: 1, skipToDecision: false })).toBeCloseTo(hold + 20 * READ_SEC_PER_CHOICE, 9);
    expect(estimatePlaySeconds(c, { speed: 8, skipToDecision: false })).toBeCloseTo(hold / 8 + 20 * READ_SEC_PER_CHOICE, 9);
    expect(estimatePlaySeconds(c, { speed: 8, skipToDecision: true })).toBeCloseTo(20 * READ_SEC_PER_CHOICE + 21 * JUMP_OVERHEAD_SEC, 9);
    // 건너뛰면 배속과 무관하고, 읽는 시간은 배속으로 줄지 않는다
    expect(estimatePlaySeconds(c, { speed: 1, skipToDecision: true })).toBe(estimatePlaySeconds(c, { speed: 8, skipToDecision: true }));
    expect(estimatePlaySeconds(c, { speed: 8, skipToDecision: false })).toBeGreaterThan(20 * READ_SEC_PER_CHOICE);
    expect(estimatePlaySeconds(counts(), { speed: 1, skipToDecision: false })).toBe(0);
  });

  it('배속이 빠를수록, 건너뛸수록 짧다: 1배 > 2배 > 4배 > 8배 > 8배+다음 결정으로', () => {
    const r = simulateLife(seedOf(7), 'present', 'random');
    const t = (speed: 1 | 2 | 4 | 8, skip: boolean) => estimatePlaySeconds(r.counts, { speed, skipToDecision: skip });
    expect(t(1, false)).toBeGreaterThan(t(2, false));
    expect(t(2, false)).toBeGreaterThan(t(4, false));
    expect(t(4, false)).toBeGreaterThan(t(8, false));
    expect(t(8, false)).toBeGreaterThan(t(8, true));
  });

  describe('목표 시간 (실제 이벤트 풀, R-042, R-064): 판당 선택지 20~25개, 1배속 수동 약 20~30분(30분 이내), 8배속 + 다음 결정으로 읽기 18초 가정 약 7~10.5분 (SPEC "10분 내외"의 하단, 최종 판정은 M6 사람 실측)', () => {
    // 세 시대 x 시드 1000개(REPORT_SEEDS)를 실제 EVENT_POOL로 한 번만 돌려 아래 단언들이 함께 쓴다 (npm run sim과 같은 계산)
    const reportsOf = lazy(() => Object.fromEntries(ERAS.map((era) => [era, reportOf(era, sharedLives()[era])])) as Record<Era, ReturnType<typeof reportOf>>);

    it('판당 선택지 수 분포: 시대마다 평균 20~25개, 25개를 넘는 판 30% 이하, 20개 미만인 판 20% 이하, 하드 상한을 넘는 판 없음', () => {
      for (const era of ERAS) {
        const r = reportsOf()[era];
        expect(r.choices.mean, `${era}: 선택지 수 평균`).toBeGreaterThanOrEqual(CHOICE_COUNT_TARGET.meanLow);
        expect(r.choices.mean, `${era}: 선택지 수 평균`).toBeLessThanOrEqual(CHOICE_COUNT_TARGET.meanHigh);
        expect(r.overTwentyFivePct / 100, `${era}: 25개 초과 비율`).toBeLessThanOrEqual(CHOICE_COUNT_TARGET.maxOverShare);
        expect(r.underTwentyPct / 100, `${era}: 20개 미만 비율`).toBeLessThanOrEqual(0.2);
        expect(r.choices.max, `${era}: 최대`).toBeLessThanOrEqual(CHOICE_PACING.hard);
        expect(r.choices.p05, `${era}: 5% 분위`).toBeGreaterThanOrEqual(16);
      }
    });

    it('단계별로 고르게 분포한다: 학창·청년·중년에 몰리되 영유아와 노년도 선택지가 있다', () => {
      for (const era of ERAS) {
        const m = reportsOf()[era].choicesByStageMean;
        expect(m.infant, `${era} 영유아`).toBeGreaterThanOrEqual(1.2);
        expect(m.school, `${era} 학창`).toBeGreaterThanOrEqual(3);
        expect(m.youth, `${era} 청년`).toBeGreaterThanOrEqual(5);
        expect(m.middle, `${era} 중년`).toBeGreaterThanOrEqual(5);
        expect(m.senior, `${era} 노년`).toBeGreaterThanOrEqual(3);
        // 어느 한 단계가 전체의 40%를 넘게 차지하지 않는다
        const total = STAGES.reduce((a, s) => a + m[s], 0);
        for (const s of STAGES) expect(m[s] / total, `${era} ${s}`).toBeLessThan(0.4);
      }
    });

    it('1배속 수동(읽는 시간 중앙 가정 18초/개): 평균이 목표 구간(약 20~30분) 안이고, 모든 판이 30분 이내', () => {
      for (const era of ERAS) {
        const r = reportsOf()[era];
        expect(r.minutes1x.mean, `${era}: 1배속 평균(분)`).toBeGreaterThanOrEqual(TIME_TARGET_MIN.manual1xLow);
        expect(r.minutes1x.mean, `${era}: 1배속 평균(분)`).toBeLessThanOrEqual(TIME_TARGET_MIN.manual1xMax);
        expect(r.minutes1x.max, `${era}: 1배속 최대(분)`).toBeLessThanOrEqual(TIME_TARGET_MIN.manual1xMax);
      }
    });

    it('1배속 수동(읽는 시간 상한 가정 30초/개)에서도 모든 판이 30분을 넘지 않는다', () => {
      for (const era of ERAS) expect(reportsOf()[era].minutes1xUpper.max, `${era}: 1배속(30초) 최대(분)`).toBeLessThanOrEqual(TIME_TARGET_MIN.manual1xMax);
    });

    it('8배속 + 다음 결정으로(중앙 가정 18초/개): 평균이 약 7~10.5분(실측 7.2~7.6분 — "10분 내외"의 하단), 24초 가정(QA 실측 상단)에서는 약 9~11분(실측 9.4~9.9분)', () => {
      for (const era of ERAS) {
        const r = reportsOf()[era];
        expect(r.minutesFast.mean, `${era}: 8배속+다음결정(18초) 평균(분)`).toBeGreaterThanOrEqual(TIME_TARGET_MIN.fastLow);
        expect(r.minutesFast.mean, `${era}: 8배속+다음결정(18초) 평균(분)`).toBeLessThanOrEqual(TIME_TARGET_MIN.fastHigh);
        expect(r.minutesFastHigh.mean, `${era}: 8배속+다음결정(24초) 평균(분)`).toBeGreaterThanOrEqual(9);
        expect(r.minutesFastHigh.mean, `${era}: 8배속+다음결정(24초) 평균(분)`).toBeLessThanOrEqual(11);
        // 보수 상한(30초)에서는 12~13분대 — 목표 구간을 넘지만 한계 안이다 (보고서에 기록)
        expect(r.minutesFastUpper.mean, `${era}: 8배속+다음결정(30초) 평균(분)`).toBeLessThanOrEqual(14);
      }
    });

    it('배속·건너뛰기 순서가 실제 풀에서도 성립한다: 1배속 > 8배속 > 8배속+다음 결정으로, 읽는 시간 가정이 길수록 길다', () => {
      for (const era of ERAS) {
        const r = reportsOf()[era];
        expect(r.minutes1x.mean).toBeGreaterThan(r.minutesFast.mean * 2);
        expect(r.minutes1xHigh.mean).toBeGreaterThan(r.minutes1x.mean);
        expect(r.minutes1xUpper.mean).toBeGreaterThan(r.minutes1xHigh.mean);
        expect(r.minutesFastUpper.mean).toBeGreaterThan(r.minutesFastHigh.mean);
        expect(r.minutesFastHigh.mean).toBeGreaterThan(r.minutesFast.mean);
      }
    });

    it('이벤트 글의 길이가 QA 실측 표본(선택지 이벤트 본문+라벨 평균 75.6자)과 크게 다르지 않아 읽는 시간 가정이 유효하다 (±25%)', () => {
      const choiceEvents = EVENT_POOL.events.filter((e) => e.choices !== undefined);
      const chars = choiceEvents.map((e) => e.text.length + e.choices!.reduce((a, c) => a + c.label.length, 0));
      const mean = chars.reduce((a, b) => a + b, 0) / chars.length;
      expect(mean).toBeGreaterThan(75.6 * 0.75);
      expect(mean).toBeLessThan(75.6 * 1.25);
    });

    it('선택지 빈도는 자동·수동 전략과 무관하게 비슷하다 (자동/첫 선택지 전략도 평균 20~25개, 시대별 100판)', () => {
      for (const strategy of ['auto', 'first'] as const) {
        for (const era of ERAS) {
          const r = reportEra(era, 100, strategy);
          expect(r.choices.mean, `${era}/${strategy}`).toBeGreaterThanOrEqual(19.5);
          expect(r.choices.mean, `${era}/${strategy}`).toBeLessThanOrEqual(25.5);
        }
      }
    });

    it('합성 풀(형태만 갖춘 이벤트 40개, 참고용)은 스키마 검증을 통과하는 40개 이벤트(선택지 26 + 서술 14)이고 모든 단계를 덮는다', () => {
      const ev = syntheticEvents() as Array<{ stages: string[]; choices?: unknown[] }>;
      expect(ev).toHaveLength(40);
      expect(ev.filter((e) => e.choices).length).toBe(26);
      expect(new Set(ev.flatMap((e) => e.stages)).size).toBe(5);
      expect(syntheticPool().events).toHaveLength(40);
    });
  });
});

describe('유년기 사망 (R-045 a): 담담하게 끝난다', () => {
  // 20세 전 사망은 0.3~1.0% — 판을 많이 돌려 그런 판을 모은다
  // 20세까지만 진행해(20세 전 사망만 필요하다) 시드를 많이 훑는다
  const EARLY_SEEDS = 4000;
  const earlyDeathsOf = lazy(() => {
    const out: GameState[] = [];
    for (const era of ERAS) {
      for (let i = 1; i <= EARLY_SEEDS; i++) {
        const seed = i * 7919 + 13;
        const choose = chooserFor('random', seed)!;
        let s = startLife(seed, era);
        while (s.phase === 'life' && s.age < 20) s = s.pending !== null ? resolveChoiceStep(s, s.pending.key, choose(s)!).state : stepYear(s).state;
        if (s.phase === 'ending' && s.death !== null && s.death.age < 20) out.push(s);
      }
    }
    return out;
  });

  it('20세 전 사망은 드물지만 있다 (전체의 0.03~2%, 실측 약 0.14% — 지난 세상이 가장 높다)', () => {
    const earlyDeaths = earlyDeathsOf();
    const rate = earlyDeaths.length / (ERAS.length * EARLY_SEEDS);
    expect(earlyDeaths.length).toBeGreaterThanOrEqual(5);
    expect(rate).toBeGreaterThan(0.0003);
    expect(rate).toBeLessThan(0.02);
  });

  it('그런 판의 마지막 연표 항목은 사망 문구 하나이고, 원인은 어린 나이에 어울리는 것이다 (병·사고)', () => {
    for (const f of earlyDeathsOf()) {
      const last = f.history[f.history.length - 1];
      expect(last.kind).toBe('death');
      expect(last.text).toMatch(/^세상을 떠났다\. 원인: (갑작스러운 병|사고)\.$/);
      expect(f.death!.cause).toMatch(/^(갑작스러운 병|사고)$/);
      expect(f.history.filter((h) => h.kind === 'death')).toHaveLength(1);
    }
  });

  it('그런 판의 연표 어디에도 느낌표·이모지·과장된 표현이 없고, 사망 뒤에 기록이 더 붙지 않는다', () => {
    for (const f of earlyDeathsOf()) {
      for (const h of f.history) {
        expect(`${h.title ?? ''}${h.text}${h.choice ?? ''}`).not.toMatch(/[!?]|[\u{1F300}-\u{1FAFF}]|대박|엄청/u);
      }
      expect(f.history[f.history.length - 1].age).toBe(f.death!.age);
    }
  });

  it('어린 나이에 사망한 판이 선택지 이벤트에서 멈춘 채 끝나지 않는다 (대기가 없고 엔딩이다)', () => {
    for (const f of earlyDeathsOf()) {
      expect(f.phase).toBe('ending');
      expect(f.pending).toBeNull();
    }
  });
});

describe('한 판에서 같은 문구가 되풀이되지 않는다 (QA 사용감 7)', () => {
  it('연표의 서술·선택 항목에서 같은 이벤트 id가 두 번 나오지 않고, 같은 (제목, 본문) 쌍도 되풀이되지 않는다 — 세 시대 x 150판', () => {
    for (const era of ERAS) {
      for (let i = 1; i <= 150; i++) {
        const seed = i * 7919 + 13;
        const final = playToEnd(startLife(seed, era), chooserFor('random', seed)).state;
        const ids = final.history.filter((h) => h.eventId !== undefined).map((h) => h.eventId!);
        expect(new Set(ids).size, `${era} seed ${seed}: 이벤트 id 중복`).toBe(ids.length);
        const texts = final.history.filter((h) => h.kind === 'event' || h.kind === 'choice').map((h) => `${h.title}|${h.text}`);
        expect(new Set(texts).size, `${era} seed ${seed}: 같은 문구 반복`).toBe(texts.length);
      }
    }
  });

  it('검진 결과표(QA가 45세·59세에 두 번 본 문구)는 한 판에 한 번만 나온다 — 나중의 검진은 다른 이벤트(다시 받은 결과)다', () => {
    const first = EVENT_POOL.byId.get('middle-health-check')!;
    const later = EVENT_POOL.byId.get('middle-health-check-later')!;
    expect(first.once).toBe(true);
    expect(later.once).toBe(true);
    expect(first.text).not.toBe(later.text);
    for (let i = 1; i <= 300; i++) {
      const final = playToEnd(startLife(i * 7919 + 13, 'present'), chooserFor('random', i)).state;
      expect(final.history.filter((h) => h.eventId === 'middle-health-check').length).toBeLessThanOrEqual(1);
    }
  });
});

describe('외모 구간별 평생 조우율 (R-044): 외모가 연애·결혼·사업 확률에 실제로 반영된다', () => {
  // 같은 시드·같은 시대의 인생에서 외모만 구간 대표값(15 / 50 / 85)으로 바꿔 세 시대 x 400판씩(총 1200판 x 3구간) 돌린다. (M7a: 200판씩 600판이던 표본을 늘렸다 — 난수 흐름이 바뀐 뒤 결혼 이벤트 격차가 600판에서 19.5%p로 잡음에 걸렸고 1200·1800판에서는 21.4·22.0%p다.)
  const rowsOf = lazy(() => encounterTable(400, 'random'));

  it('구간 표본: 낮음 15점 / 보통 50점 / 높음 85점, 각 1200판', () => {
    const rows = rowsOf();
    expect(rows.map((r) => r.looks)).toEqual([15, 50, 85]);
    expect(rows.every((r) => r.lives === 1200)).toBe(true);
  });

  it('연애 이벤트를 한 번이라도 만나는 비율이 외모가 높을수록 높다 (낮음 < 보통 < 높음, 높음-낮음 8%p 이상)', () => {
    const [low, mid, high] = rowsOf();
    expect(low.romancePct).toBeLessThan(mid.romancePct);
    expect(mid.romancePct).toBeLessThan(high.romancePct);
    expect(high.romancePct - low.romancePct).toBeGreaterThanOrEqual(8);
  });

  it('결혼 이벤트를 만나는 비율도 외모가 높을수록 높다 (높음-낮음 20%p 이상) — 결혼에도 외모가 직접 반영된다', () => {
    const [low, mid, high] = rowsOf();
    expect(low.marriageEventPct).toBeLessThan(mid.marriageEventPct);
    expect(mid.marriageEventPct).toBeLessThan(high.marriageEventPct);
    expect(high.marriageEventPct - low.marriageEventPct).toBeGreaterThanOrEqual(20);
  });

  it('실제로 결혼하는 판의 비율도 외모가 높을수록 높다 (높음-낮음 6%p 이상)', () => {
    const [low, mid, high] = rowsOf();
    expect(low.marriedPct).toBeLessThan(mid.marriedPct);
    expect(mid.marriedPct).toBeLessThan(high.marriedPct);
    expect(high.marriedPct - low.marriedPct).toBeGreaterThanOrEqual(6);
  });

  it('사업 이벤트를 만나는 비율도 외모가 높을수록 높다 (높음-낮음 15%p 이상)', () => {
    const [low, mid, high] = rowsOf();
    expect(low.businessPct).toBeLessThan(mid.businessPct);
    expect(mid.businessPct).toBeLessThan(high.businessPct);
    expect(high.businessPct - low.businessPct).toBeGreaterThanOrEqual(15);
  });

  it('외모가 낮아도 연애·결혼 이벤트를 만날 길은 막혀 있지 않다 (낮음 구간도 연애 70% 이상, 결혼 이벤트 30% 이상)', () => {
    const [low] = rowsOf();
    expect(low.romancePct).toBeGreaterThanOrEqual(70);
    expect(low.marriageEventPct).toBeGreaterThanOrEqual(30);
  });
});

describe('밸런스 (R-045 b): 행복·관계는 출생값에 종속되지 않고, 낮은 계층에도 길이 있고, 높은 계층의 재산이 100에 붙지 않는다', () => {
  const balanceLazy = lazy(() => balanceOf(ERAS.flatMap((era) => sharedLives()[era])));

  it('출생값과 최종값의 상관계수: 행복·관계 모두 0.45 미만', () => {
    const b = balanceLazy();
    expect(b.correlation.happiness).toBeLessThan(0.45);
    expect(b.correlation.relationships).toBeLessThan(0.45);
  });

  it('부모 재력 단계별 최종 행복·관계 평균의 차이가 작다 (표본이 충분한 1~4단계 사이 행복 10 이하 · 관계 6 이하)', () => {
    const b = balanceLazy();
    const big = b.tiers.filter((t) => t.n >= 60);
    expect(big.length).toBeGreaterThanOrEqual(4);
    const spread = (key: 'happiness' | 'relationships') => Math.max(...big.map((t) => t.mean[key])) - Math.min(...big.map((t) => t.mean[key]));
    expect(spread('happiness')).toBeLessThanOrEqual(10);
    expect(spread('relationships')).toBeLessThanOrEqual(6);
  });

  it('행복·관계의 최종값이 한 점에 몰리지 않는다: 표준편차가 6 이상이고 평균은 40~65 사이', () => {
    const b = balanceLazy();
    expect(b.happiness.sd).toBeGreaterThanOrEqual(6);
    expect(b.relationships.sd).toBeGreaterThanOrEqual(5);
    expect(b.happiness.mean).toBeGreaterThan(40);
    expect(b.happiness.mean).toBeLessThan(65);
    expect(b.relationships.mean).toBeGreaterThan(40);
    expect(b.relationships.mean).toBeLessThan(65);
  });

  it('최상위 재산이 폭주하지 않는다 (옛 「재산 100에 붙지 않는다」의 새 모델 판): 부모 재력 4·5단계의 최종 순자산이 데이터 상한(200억 원)에 닿은 판이 1% 이하이고 중앙값은 30억 원(300,000만 원) 미만이다', () => {
    const b = balanceLazy();
    const top = b.tiers.filter((t) => t.tier >= 4);
    const n = top.reduce((a, t) => a + t.n, 0);
    const atCap = top.reduce((a, t) => a + (t.netAtCapPct * t.n) / 100, 0);
    expect(n).toBeGreaterThan(100);
    expect(atCap / n).toBeLessThanOrEqual(0.01);
    expect(top.every((t) => t.netMedian < 300_000)).toBe(true);
    // 대조: 위쪽이 실제로 두텁다(4·5단계 중앙값은 1단계보다 크다) — G3 방향
    const t1 = b.tiers.find((t) => t.tier === 1)!;
    expect(top.every((t) => t.netMedian > t1.netMedian)).toBe(true);
  });

  it('최하위 계층(재력 1단계)도 학력 문턱(40)에 닿는 판이 70% 이상이다', () => {
    const b = balanceLazy();
    const t1 = b.tiers.find((t) => t.tier === 1)!;
    expect(t1.n).toBeGreaterThan(200);
    expect(t1.education40Pct).toBeGreaterThanOrEqual(70);
  });

  it('최하위 계층도 학력 70 문턱에 닿는 길이 있다: 학력을 노리고 고르면 재력 1단계의 10% 이상이 70에 닿는다 (무작위 선택으로는 드물다)', () => {
    const greedy = (s: GameState) => {
      const ev = EVENT_POOL.byId.get(s.pending!.eventId)!;
      let best = s.pending!.choiceIds[0];
      let bestV = -Infinity;
      for (const id of s.pending!.choiceIds) {
        const c = ev.choices!.find((x) => x.id === id)!;
        const r = resolveEffects(c.effects, c.bonuses, { character: s.character!, stats: s.stats, flags: new Set(s.flags) });
        const v = r.stats.education ?? 0;
        if (v > bestV) {
          bestV = v;
          best = id;
        }
      }
      return best;
    };
    let n = 0;
    let reached = 0;
    for (const era of ERAS) {
      for (let i = 1; i <= 400; i++) {
        const start = startLife(i * 7919 + 13, era);
        if (start.character!.parentWealth !== 1) continue;
        n++;
        if (playToEnd(start, greedy).state.stats.education >= 70) reached++;
      }
    }
    expect(n).toBeGreaterThan(200);
    expect(reached / n).toBeGreaterThanOrEqual(0.1);
  });
});
