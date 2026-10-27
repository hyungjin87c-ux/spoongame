import { describe, expect, it } from 'vitest';
import {
  STAGES,
  STAT_KEYS,
  advanceYear,
  autoResolveStep,
  estimatePlaySeconds,
  holdDelayMs,
  holdMsFor,
  autoChoiceDelayMs,
  readSecFor,
  maxAgeOf,
  parseGame,
  playToEnd,
  resolveChoice,
  resolveChoiceStep,
  resolveEffects,
  stepYear,
  serializeGame,
  type GameState,
  type ProfileId,
  lifeParamsOf,
  timingEraOfProfile,
  type TickCounts,
  emptyCounts,
  totalCards,
} from '../src/core';
import { EVENT_POOL } from '../src/data/events';
import { EVENT_FREQUENCY, HISTORY_LIMITS, STATE_LIMITS } from '../src/data/lifeTable';
import { AUTO_CHOICE_MS, HOLD_MS, INFANT_CHOICE_MEAN_MIN, JUMP_OVERHEAD_SEC, LIFE_LENGTH_MODES, READ_MODEL, SENIOR_CHOICE_MEAN_MIN } from '../src/data/timingTable';
import { SIM_PROFILES, balanceOf, chooserFor, encounterTable, reportOf, simulateLife, simulateMany, startLife, type LifeSummary, type Strategy } from '../scripts/simulateLib';
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
const mean = (xs: readonly number[]): number => xs.reduce((a, b) => a + b, 0) / (xs.length || 1);

/** 실제 EVENT_POOL로 세 시대 x 시드 1000개를 '무작위 수동 선택'으로 한 번만 돌린 판들 — 수명·시간 모델·밸런스 단언이 함께 쓴다 (npm run sim과 같은 계산). */
const REPORT_SEEDS = 1000;
const sharedLives = lazy(() => Object.fromEntries(SIM_PROFILES.map((era) => [era, simulateMany(era, REPORT_SEEDS, 'random')])) as Record<ProfileId, LifeSummary[]>);
const seedOf = (i: number) => i * 7919 + 13;
const STRATEGIES: Strategy[] = ['auto', 'random'];

/** 걸음마다 불변식을 검사하며 끝까지 진행한다. 위반하면 throw(메시지에 시드·시대·나이). */
function checkedPlay(seed: number, era: ProfileId, strategy: Strategy, deepValidate: boolean): GameState {
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
  for (const era of SIM_PROFILES) {
    for (const strategy of STRATEGIES) {
      it(`${era} / ${strategy}: ${SEEDS}판 모두 스탯 범위·나이 단조·연표 상한을 지키며 사망에 도달한다`, () => {
        let deaths = 0;
        for (let i = 1; i <= SEEDS; i++) {
          const end = checkedPlay(seedOf(i), era, strategy, i <= 25); // 앞 25판은 매 걸음 저장 검증까지
          expect(end.phase).toBe('ending');
          expect(end.death).not.toBeNull();
          expect(end.death!.age).toBeLessThanOrEqual(maxAgeOf(lifeParamsOf(era, 2000)));
          deaths++;
        }
        expect(deaths).toBe(SEEDS);
      });
    }
  }

  it('시뮬레이션 보조(simulateLife)도 같은 불변식으로 시대별 300판을 에러 없이 돌린다', () => {
    for (const era of SIM_PROFILES) {
      for (let i = 1; i <= 300; i++) expect(() => simulateLife(seedOf(i) + 1, era, i % 2 ? 'auto' : 'random')).not.toThrow();
    }
  });

  it('합성 풀(형태만 갖춘 이벤트 40개, 참고용)에서도 에러 없이 끝난다', () => {
    const pool = syntheticPool();
    for (const era of SIM_PROFILES) for (let i = 1; i <= 100; i++) expect(() => simulateLife(seedOf(i) + 2, era, 'auto', pool)).not.toThrow();
  });
});

describe('평균 수명·사망 분포 (시대별 계수)', () => {
  const lifeReports = lazy(() => Object.fromEntries(SIM_PROFILES.map((era) => [era, reportOf(era, sharedLives()[era])])) as Record<ProfileId, ReturnType<typeof reportOf>>);

  it('세대별 평균 사망 나이: 현실적인 범위(74~88세) 안이다 — 사망 모형은 GM10 전까지 모든 세대가 같은 값을 쓴다(연도 축 사망 모형은 SPEC-004 MG4·GM10)', () => {
    const mean = (e: ProfileId) => lifeReports()[e].deathAge.mean;
    for (const era of SIM_PROFILES) {
      expect(mean(era), era).toBeGreaterThan(74);
      expect(mean(era), era).toBeLessThan(88);
    }
  });

  it('요절(20세 전 사망)은 드물다 (3% 미만), 대부분 70~90대에 사망한다', () => {
    for (const era of SIM_PROFILES) {
      const r = lifeReports()[era];
      const early = Object.entries(r.deathByDecade)
        .filter(([k]) => Number.parseInt(k, 10) < 20)
        .reduce((a, [, v]) => a + v, 0);
      expect(early, era).toBeLessThan(3);
      const late = Object.entries(r.deathByDecade)
        .filter(([k]) => Number.parseInt(k, 10) >= 70)
        .reduce((a, [, v]) => a + v, 0);
      expect(late, era).toBeGreaterThan(75);
      expect(r.deathAge.max, era).toBeLessThanOrEqual(maxAgeOf(lifeParamsOf(era, 2000)));
    }
  });
});

describe('시간 모델 (연도당 연출 시간 · 선택지 빈도 · 읽는 시간 모델, SPEC-003 LM2 — M8)', () => {
  const counts = (over: Partial<TickCounts> = {}): TickCounts => ({ ...emptyCounts(), ...over });
  const slow = { speed: 1 as const, skipToDecision: false };

  it('상수 표: 연출 시간은 조용한 해 < 서술 이벤트 < 선택 결과 읽기 순이고, 선택지 빈도는 0~1 확률이다', () => {
    expect(HOLD_MS.quiet).toBeLessThan(HOLD_MS.narrative);
    expect(HOLD_MS.resolved).toBeLessThan(HOLD_MS.narrative * 1.5);
    expect(HOLD_MS.quiet).toBeGreaterThan(0);
    for (const era of SIM_PROFILES) expect(readSecFor(timingEraOfProfile(era))).toBeGreaterThan(0);
    for (const f of Object.values(EVENT_FREQUENCY)) {
      expect(f.choice).toBeGreaterThan(0);
      expect(f.choice).toBeLessThan(1);
      expect(f.narrative).toBeGreaterThan(0);
      expect(f.narrative).toBeLessThan(1);
    }
  });

  it('holdMsFor: 한 해의 연출 대기 = HOLD_MS × 판의 모드 계수. 선택지·사망에는 타이머 대기가 없다(null) (HOLD_MS를 직접 비교하던 SPEC-001 시험의 갱신 — 모드 계수가 곱해진다)', () => {
    const k = LIFE_LENGTH_MODES.short30.holdScale;
    expect(holdMsFor('quiet')).toBe(Math.round(HOLD_MS.quiet * k)); // 기본 모드는 short30
    expect(holdMsFor('narrative')).toBe(Math.round(HOLD_MS.narrative * k));
    expect(holdMsFor('resolved')).toBe(Math.round(HOLD_MS.resolved * k));
    expect(holdMsFor(null)).toBe(holdMsFor('quiet')); // 새로고침 직후
    expect(holdMsFor('none')).toBe(holdMsFor('quiet'));
    expect(holdMsFor('choice')).toBeNull();
    expect(holdMsFor('death')).toBeNull();
  });

  it('holdDelayMs: 배속으로 나누고(1/2/4/8배), 개발용 시간 배율로 더 나누며, 선택지·사망에는 null', () => {
    const q = holdMsFor('quiet') as number;
    expect(holdDelayMs('quiet', 1)).toBe(q);
    expect(holdDelayMs('quiet', 2)).toBe(q / 2);
    expect(holdDelayMs('quiet', 4)).toBe(q / 4);
    expect(holdDelayMs('quiet', 8)).toBe(q / 8);
    expect(holdDelayMs('narrative', 8)).toBe((holdMsFor('narrative') as number) / 8);
    expect(holdDelayMs('quiet', 1, 100)).toBe(q / 100);
    expect(holdDelayMs('choice', 8)).toBeNull();
    expect(holdDelayMs('death', 1)).toBeNull();
    expect(autoChoiceDelayMs(1)).toBe(AUTO_CHOICE_MS);
    expect(autoChoiceDelayMs(8)).toBe(AUTO_CHOICE_MS / 8);
    expect(autoChoiceDelayMs(8, 1000)).toBe(AUTO_CHOICE_MS / 8 / 1000);
  });

  it('estimatePlaySeconds: 직접 계산한 값과 같다 (건너뛰지 않으면 = 연출 합/배속 + 결정 카드 수 × r, 다음 결정으로 = 결정 카드 수 × r + (결정 카드 수 + 1) × 오버헤드)', () => {
    const c = counts({ quiet: 60, narrative: 10, resolved: 18, choice: 20, extraLines: 5 });
    // 30분 모드(계수 1.6875, SPEC-005 LM7b 형진 님 결정 2026-10-26 — 바뀌기 전 1.35): 조용한 해 11.813초 · 서술 해 28.688초 · 결과 21.938초 · 둘째 줄 +8.438초
    const hold = (60 * 11813 + 10 * 28688 + 18 * 21938 + 5 * 8438) / 1000;
    const r = readSecFor('present');
    expect(estimatePlaySeconds(c, slow, 'short30', 'present')).toBeCloseTo(hold + 20 * r, 9);
    expect(estimatePlaySeconds(c, { speed: 8, skipToDecision: false }, 'short30', 'present')).toBeCloseTo(hold / 8 + 20 * r, 9);
    expect(estimatePlaySeconds(c, { speed: 8, skipToDecision: true }, 'short30', 'present')).toBeCloseTo(20 * r + 21 * JUMP_OVERHEAD_SEC, 9);
    // 건너뛰면 배속과 무관하고, 읽는 시간은 배속으로 줄지 않는다
    expect(estimatePlaySeconds(c, slow, 'short30', 'present')).toBeGreaterThan(estimatePlaySeconds(c, { speed: 8, skipToDecision: false }, 'short30', 'present'));
    expect(estimatePlaySeconds(c, { speed: 1, skipToDecision: true }, 'short30', 'present')).toBe(estimatePlaySeconds(c, { speed: 8, skipToDecision: true }, 'short30', 'present'));
    expect(estimatePlaySeconds(c, { speed: 8, skipToDecision: false }, 'short30', 'present')).toBeGreaterThan(20 * r);
    expect(estimatePlaySeconds(counts(), slow, 'short30', 'present')).toBe(0);
    // 참고 항(기록 카드 입력 시간 등)은 합에 더해지지만 판정(0)에서는 빠진다
    expect(estimatePlaySeconds(c, slow, 'short30', 'present', 'median', 120)).toBeCloseTo(estimatePlaySeconds(c, slow, 'short30', 'present') + 120, 9);
  });

  it('배속이 빠를수록, 건너뛸수록 짧다: 1배 > 2배 > 4배 > 8배 > 8배+다음 결정으로', () => {
    const r = simulateLife(seedOf(7), 'alpha', 'random');
    const t = (speed: 1 | 2 | 4 | 8, skip: boolean) => estimatePlaySeconds(r.counts, { speed, skipToDecision: skip }, 'short30', 'present');
    expect(t(1, false)).toBeGreaterThan(t(2, false));
    expect(t(2, false)).toBeGreaterThan(t(4, false));
    expect(t(4, false)).toBeGreaterThan(t(8, false));
    expect(t(8, false)).toBeGreaterThan(t(8, true));
  });

  describe(
    '목표 시간 (실제 이벤트 풀, SPEC-003 LM2·LM4, M8 — SPEC-001의 시간 시험(`TIME_TARGET_MIN` 1배속 19.5~30분·8배속 7~10.5분, 읽기 18초, 판당 20~25개)을 모드별 구간으로 **교체**한다, 마스터 결정 LD-12: 기준의 교체이지 약화가 아니다 — 옛 기준은 SPEC-003 개편(합쇼체 글자 수·인용 박스·영유아 콘텐츠)으로 전제가 달라졌고 SPEC 83행이 LM으로 대체한다고 적었다)',
    () => {
      // 세 시대 x 시드 1000개(REPORT_SEEDS)를 실제 EVENT_POOL로 한 번만 돌려 아래 단언들이 함께 쓴다 (npm run sim과 같은 계산)
      const reportsOf = lazy(() => Object.fromEntries(SIM_PROFILES.map((era) => [era, reportOf(era, sharedLives()[era])])) as Record<ProfileId, ReturnType<typeof reportOf>>);
      const mode = LIFE_LENGTH_MODES.short30;

      // 임계 규칙(content-M8.md 7-4절, LD-9): 임계 = 측정값 + 표준오차 3배 이상. 최댓값은 판정하지 않고(보고) 평균·비율·분위수를 판정한다. 이 시험에는 「25장 초과 판 ≤ 30%」·「측정값 + 0.1%p」 단언이 없다(폐기).
      // 카드 수 판정 구간(마스터 결정 2026-10-20 — 페이싱 soft 24 / hard 30 확정, 목표는 판 길이이고 카드 수는 수단)과 노년 하한은 data/timingTable.ts(#LIFE_LENGTH_MODES.short30.cards · SENIOR_CHOICE_MEAN_MIN)에 있다.
      // 임계 계산(M-3, LD-9: 임계 ≤ 가장 불리한 표본 줄의 측정값 − 3 SE): 카드 평균 하한은 1000판 줄 네 개(시험·sim:1000 × 수동 흉내·자동 성향) 중 sim:1000 수동 흉내 지난 세상 23.690 ± 0.097 → 23.40 이하 → **23.3**,
      // 노년 하한은 지난 세상 sim:1000 수동 흉내 4.171 ± 0.069 → 3.96 이하 → **3.95**, 다가올 세상 sim:1000 자동 5.211 ± 0.067 → 5.01 이하 → **5.00**(지금 세상 4.72는 그대로). 계산과 모든 줄의 여유는 tests/judgeMargins.test.ts가 3 SE 이상으로 지킨다.
      // 처음 임계(23.5 / 3.97 / 5.03)는 이 네 칸이 2.0 · 2.9 · 2.9 · 2.7 SE라 3 SE에 못 미쳤다.

      // 같은 판정을 자동 성향 전략에도 1000판 단위로 건다(REV-003-M8-1 R-416 — 파이프라인 칸(시대 × 전략)에서 SPEC-001 판정을 빼면서 자동 성향의 카드 수 판정이 1000판 단위에서 사라졌었다).
      // 시드 줄은 수동 흉내와 같은 `simulateMany`(i × 7919 + 13)다. 측정(report:time -- 1000 --only=margins, 시험 · 자동 성향): 카드 평균 23.85 / 24.84 / 25.00(표준오차 0.08~0.09, 하한 23.3까지 6.0 SE 이상),
      // 하드−1↑ 1.0 / 3.7 / 4.3%(10%까지 8.7 SE 이상), 5% 분위 19 / 20 / 21(16장 미만 판 ≤ 5%까지 9 SE 이상), 70세+ 중 20장 미만 1.8 / 0.95 / 0.63%(10%까지 17 SE 이상), 노년 4.28 / 5.19 / 5.33(하한 3.95 / 4.72 / 5.00까지 4.7 SE 이상) — 모두 3 SE 이상이다.
      const autoLives = lazy(() => Object.fromEntries(SIM_PROFILES.map((era) => [era, simulateMany(era, REPORT_SEEDS, 'auto')])) as Record<ProfileId, LifeSummary[]>);
      const autoReportsOf = lazy(() => Object.fromEntries(SIM_PROFILES.map((era) => [era, reportOf(era, autoLives()[era])])) as Record<ProfileId, ReturnType<typeof reportOf>>);
      type Reports = Record<ProfileId, ReturnType<typeof reportOf>>;
      const judgeCards = (reports: Reports, who: string): void => {
        for (const era of SIM_PROFILES) {
          const r = reports[era];
          expect(r.choices.mean, `${who} ${era}: 결정 카드 수 평균`).toBeGreaterThanOrEqual(mode.cards.meanLow);
          expect(r.choices.mean, `${who} ${era}: 결정 카드 수 평균`).toBeLessThanOrEqual(mode.cards.meanHigh);
          expect(r.overHardCount, `${who} ${era}: 하드 상한(${mode.pacing.hard}) 초과 판`).toBe(0);
          expect(r.nearCapPct / 100, `${who} ${era}: 하드−1 이상 판 비율`).toBeLessThanOrEqual(mode.cards.nearCapShareMax);
          expect(r.choices.p05, `${who} ${era}: 5% 분위`).toBeGreaterThanOrEqual(16);
          // SPEC-005 TM5: 본인이 읽고 고르는 카드 c_self의 평균 하한(측정값 − 3 SE) — 읽기 시간 r은 이 카드에만 붙는다
          expect(r.choicesSelf.mean, `${who} ${era}: 본인 카드 c_self 평균`).toBeGreaterThanOrEqual(mode.cardsSelf.meanLow);
          expect(r.choicesSelf.mean, `${who} ${era}: c_self는 총 카드 수보다 적다(부모님이 정한·흘러간 카드가 있다)`).toBeLessThan(r.choices.mean - 3);
          expect(r.under20Of70PlusPct, `${who} ${era}: 사망 나이 70세+ 중 20장 미만 판 비율(%)`).toBeLessThanOrEqual(10);
        }
      };

      it('판당 결정 카드 수 분포 (30분 모드): 시대마다 평균이 모드 구간(23.3~29) 안, 하드 상한을 넘는 판 없음, 하드−1 이상인 판 ≤ 10%, 5% 분위 ≥ 16', () => {
        judgeCards(reportsOf(), '수동 흉내');
      });

      it('판당 결정 카드 수 분포 (30분 모드, 자동 성향 1000판): 수동 흉내와 같은 판정 — 평균이 모드 구간(23.3~29) 안, 하드 상한 초과 0, 하드−1 이상 ≤ 10%, 5% 분위 ≥ 16, 70세+ 중 20장 미만 ≤ 10% (R-416)', () => {
        judgeCards(autoReportsOf(), '자동 성향');
      });

      it('단계별 분포: 노년은 M7a가 굶긴 몫을 돌려받았고(하한 3.95 / 4.72 / 5.00 이상 — 처음 HEAD − 0.3에서 M-3으로 내림), 영유아(0~7세)는 IN2 하한(2.8)을 지키며, 어느 한 단계가 전체의 40%를 넘게 차지하지 않는다 (수동 흉내 · 자동 성향 1000판)', () => {
        const strategies: Array<[string, Reports, Record<ProfileId, LifeSummary[]>]> = [
          ['수동 흉내', reportsOf(), sharedLives()],
          ['자동 성향', autoReportsOf(), autoLives()],
        ];
        for (const [who, reports, lives] of strategies) {
        for (const era of SIM_PROFILES) {
          const m = reports[era].choicesByStageMean;
          expect(m.infant, `${who} ${era} 영유아`).toBeGreaterThanOrEqual(1.2);
          expect(m.school, `${who} ${era} 학창`).toBeGreaterThanOrEqual(3);
          expect(m.youth, `${who} ${era} 청년`).toBeGreaterThanOrEqual(5);
          expect(m.middle, `${who} ${era} 중년`).toBeGreaterThanOrEqual(5);
          expect(m.senior, `${who} ${era} 노년`).toBeGreaterThanOrEqual(SENIOR_CHOICE_MEAN_MIN[timingEraOfProfile(era)]);
          const total = STAGES.reduce((a, s) => a + m[s], 0);
          for (const s of STAGES) expect(m[s] / total, `${who} ${era} ${s}`).toBeLessThan(0.4);
          // 0~7세(영유아 빈도표 구간) 평균은 연표의 나이로 센다
          const upTo7 = lives[era].reduce((a, l) => a + l.final.history.filter((h) => h.kind === 'choice' && h.age <= 7).length, 0) / lives[era].length;
          expect(upTo7, `${who} ${era} 0~7세`).toBeGreaterThanOrEqual(INFANT_CHOICE_MEAN_MIN);
        }
        }
      });

      // M-3으로 노년 하한을 내려도 기준의 뜻이 유지되는지의 근거 (REV-003-M8-2 R-425·R-426, dev 로그 11-9): 하한이 「M7a가 굶긴 몫을 돌려받았는가」를 여전히 가른다.
      // 옛 페이싱(soft 23 / hard 26 — M7a 뒤 M8 이전)은 노년 평균을 3.87 / 4.35 / 4.54로 굶겼다. 지금 세상(4.35 < 4.72)·다가올 세상(4.54 < 5.00)은 하한에서 0.37·0.46 아래라 표본이 달라져도 뒤집히지 않는다.
      // 지난 세상(3.87 대 하한 3.95)은 0.08 차이(약 1 SE)라 단언하지 않는다 — 하한이 3 SE 여유를 가지도록 내린 값의 대가다.
      it('굶긴 상태는 잡힌다: 옛 페이싱(soft 23 / hard 26)으로 되돌리면 지금·다가올 세상의 노년 평균(4.35 / 4.54)이 노년 하한(4.72 / 5.00) 아래다', () => {
        const saved = { ...mode.pacing };
        try {
          Object.assign(mode.pacing, { soft: 23, softFactor: 0.3, hard: 26 });
          for (const era of ['genx', 'alpha'] as const) {
            const lives = simulateMany(era, REPORT_SEEDS, 'random');
            const senior = mean(lives.map((l) => l.choicesByStage.senior));
            expect(senior, `${era}: 옛 페이싱의 노년 평균 ${senior.toFixed(2)}`).toBeLessThan(SENIOR_CHOICE_MEAN_MIN[timingEraOfProfile(era)]);
          }
        } finally {
          Object.assign(mode.pacing, saved);
        }
      });

      it('1배속 수동(읽는 시간 중앙): 시대별 모델 평균이 모드 구간(25.5~36.5분 — M24로 상단을 올렸다) 안, 세 시대 평균이 27~35분, 판 하나하나의 95%가 40분 이하이고 최대 45분 이하', () => {
        let sum = 0;
        for (const era of SIM_PROFILES) {
          const r = reportsOf()[era];
          expect(r.minutes1x.mean, `${era}: 1배속 평균(분)`).toBeGreaterThanOrEqual(mode.timeMin.modelLow - 1.5);
          expect(r.minutes1x.mean, `${era}: 1배속 평균(분)`).toBeLessThanOrEqual(mode.timeMin.modelHigh + 1.5);
          expect(r.minutes1x.p95, `${era}: 1배속 95% 분위(분)`).toBeLessThanOrEqual(40);
          expect(r.minutes1x.max, `${era}: 1배속 최대(분)`).toBeLessThanOrEqual(45);
          sum += r.minutes1x.mean;
        }
        expect(sum / SIM_PROFILES.length, '세 시대 평균(분)').toBeGreaterThanOrEqual(mode.timeMin.modelLow);
        expect(sum / SIM_PROFILES.length, '세 시대 평균(분)').toBeLessThanOrEqual(mode.timeMin.modelHigh);
      });

      it('읽는 시간 수준별 보고 (판정 아님 — 사람 실측이 정한다): 낮음 < 중앙 < 높음 < 상한, 높음의 세 시대 평균이 40분을 넘지 않는다', () => {
        for (const era of SIM_PROFILES) {
          const r = reportsOf()[era];
          expect(r.minutes1xHigh.mean).toBeGreaterThan(r.minutes1x.mean);
          expect(r.minutes1xUpper.mean).toBeGreaterThan(r.minutes1xHigh.mean);
          expect(r.minutes1xHigh.mean, `${era}: 높음(느린 독자) 평균(분)`).toBeLessThanOrEqual(40);
        }
      });

      it('배속·건너뛰기 순서가 실제 풀에서도 성립한다: 1배속 > 8배속 > 8배속+다음 결정으로 (8배속 + 다음 결정으로의 시간은 참고로만 본다 — 판정 단언 삭제, LD-12)', () => {
        for (const era of SIM_PROFILES) {
          const r = reportsOf()[era];
          expect(r.minutes1x.mean).toBeGreaterThan(r.minutesFast.mean);
          expect(r.minutesFastUpper.mean).toBeGreaterThan(r.minutesFastHigh.mean);
          expect(r.minutesFastHigh.mean).toBeGreaterThan(r.minutesFast.mean);
        }
      });

      it('이벤트 글의 길이가 읽는 시간 모델(READ_MODEL)의 글자 수와 ±10% 안이다 — 합쇼체 실제 글자 수로 다시 쟀다(SPEC-003 완료 기준 15·LM2, 옛 「본문+라벨 75.6자」 가정의 교체)', () => {
        const choiceEvents = EVENT_POOL.events.filter((e) => e.choices !== undefined);
        const near = (value: number, target: number) => {
          expect(value).toBeGreaterThan(target * 0.9);
          expect(value).toBeLessThan(target * 1.1);
        };
        near(mean(choiceEvents.map((e) => [...e.title].length)), READ_MODEL.chars.title);
        near(mean(choiceEvents.map((e) => [...e.text].length)), READ_MODEL.chars.body);
        near(mean(choiceEvents.flatMap((e) => e.choices!.map((c) => [...c.label].length))), READ_MODEL.chars.label);
      });

      // 「선택지 빈도는 전략과 무관하다」(100판 × 하한 23.5 / 상한 29.5)의 교체 (REV-003-M8-1 R-416): 100판 표본의 표준오차는 약 0.29장이라 하한 23.5가 측정값(첫 선택지 지난 세상 23.75)에서 1 SE도 안 떨어져 있었다(LD-9 위반).
      // 표본을 1000판(표준오차 0.09)으로 늘리고, 판정을 「구간 안」이 아니라 「수동 흉내(shared 1000판)와의 차」로 바꾼다 — 이 시험의 뜻이 전략 무관이기 때문이다. 자동 성향의 구간 판정은 위 「자동 성향 1000판」 시험이 맡는다.
      // 한계 계산: 측정된 차의 최댓값 0.23장(자동 성향 지금 세상 24.84 − 24.61) + 차의 표준오차(√(0.09² + 0.08²) ≈ 0.12)의 3배 0.36 = 0.59 → 0.6장 (여유 3.0 SE 이상). 첫 선택지: 지난 −0.11 · 지금 +0.14 · 다가올 −0.04.
      it('선택지 빈도는 자동·수동 전략과 무관하게 비슷하다 (자동 성향·첫 선택지 1000판의 카드 수 평균이 수동 흉내와 0.6장 안, 시대별) (R-416: 100판 → 1000판)', () => {
        const STRATEGY_GAP_MAX = 0.6;
        const strategies = { auto: autoLives(), first: Object.fromEntries(SIM_PROFILES.map((era) => [era, simulateMany(era, REPORT_SEEDS, 'first')])) as Record<ProfileId, LifeSummary[]> };
        for (const [name, lives] of Object.entries(strategies)) {
          for (const era of SIM_PROFILES) {
            const strategyMean = mean(lives[era].map((l) => totalCards(l.counts)));
            const randomMean = mean(sharedLives()[era].map((l) => totalCards(l.counts)));
            expect(Math.abs(strategyMean - randomMean), `${era}/${name}: 카드 수 평균 ${strategyMean.toFixed(2)} 대 수동 흉내 ${randomMean.toFixed(2)}`).toBeLessThanOrEqual(STRATEGY_GAP_MAX);
            expect(strategyMean, `${era}/${name}`).toBeLessThanOrEqual(mode.cards.meanHigh);
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

      describe('LM4 약 1시간 모드 (1차는 닫혀 있다 — 표·시험·시뮬레이션 준비): 세 시대 × 1000판에서 에러 0·모순 0이고 카드 수·시간은 보고만 한다', () => {
        const longLives = lazy(() => Object.fromEntries(SIM_PROFILES.map((era) => [era, simulateMany(era, REPORT_SEEDS, 'random', undefined, { lifeLength: 'long60' })])) as Record<ProfileId, LifeSummary[]>);

        it('모든 판이 사망에 도달하고 판의 인생 길이가 long60이며 하드 상한을 넘지 않는다', () => {
          const hard = LIFE_LENGTH_MODES.long60.pacing.hard;
          for (const era of SIM_PROFILES) {
            for (const l of longLives()[era]) {
              expect(l.final.phase, `${era} 시드 ${l.seed}`).toBe('ending');
              expect(l.final.lifeLength).toBe('long60');
              expect(totalCards(l.counts)).toBeLessThanOrEqual(hard);
            }
          }
        });

        it('영유아(0~7세) 평균은 IN2 하한(2.8) 이상이고, 같은 시드라면 연출 계수만 달라 카드 수는 30분 모드와 같으며(임시 페이싱 = 30분 모드와 같은 값) 모델 시간은 연출 몫이 계수 비를 따라 길다(읽기 몫은 계수와 무관해 전체 비는 계수 비보다 작다)', () => {
          for (const era of SIM_PROFILES) {
            const upTo7 = longLives()[era].reduce((a, l) => a + l.final.history.filter((h) => h.kind === 'choice' && h.age <= 7).length, 0) / REPORT_SEEDS;
            expect(upTo7, `${era} 0~7세`).toBeGreaterThanOrEqual(INFANT_CHOICE_MEAN_MIN);
            const shortLives = sharedLives()[era];
            expect(longLives()[era].map((l) => totalCards(l.counts)), `${era}: 임시 페이싱이 같으면 카드 수가 같다`).toEqual(shortLives.map((l) => totalCards(l.counts)));
            const longMin = longLives()[era].reduce((a, l) => a + l.seconds1x / 60, 0) / REPORT_SEEDS;
            const shortMin = shortLives.reduce((a, l) => a + l.seconds1x / 60, 0) / REPORT_SEEDS;
            // LM7b(형진 님 결정 2026-10-26): 30분 모드의 연출 계수가 1.35 → 1.6875로 올라 1시간 모드(계수 2.0, 닫혀 있고 2차 착수 때 정한다)와의 연출 비가 1.48배에서 1.19배로 좁아졌다 —
            // 연출 몫만 늘어나므로 모델 시간의 비는 1.2 아래(약 1.1)가 된다. 「1시간이 30분보다 길다」는 뜻은 그대로 지킨다(5% 이상). 1시간 모드의 계수는 2차 착수 때 다시 정한다.
            // R-495(REV-005-LM7b-1): 예전의 매직 넘버 ×1.05를 계수에서 계산한다. 모델 시간 = 연출 몫(계수에 비례) + 읽기 몫(계수와 무관) → 비 = 1 + 연출 몫 비율 × (계수 비 − 1).
            // 연출 몫은 한 판의 절반 이상이다(1배속 수동 모델에서 연출 합 23.9 / 25.4 / 25.8분 대 전체 30.4 / 33.5 / 33.9분 ≈ 75~79%) → 하한은 연출 몫 50%로 잡는다. 1시간 모드의 계수(2.0)는 닫혀 있고 2차 착수 때 다시 정한다(TODO 후속).
            const holdRatio = LIFE_LENGTH_MODES.long60.holdScale / LIFE_LENGTH_MODES.short30.holdScale;
            expect(holdRatio, '1시간 모드의 연출 계수가 30분 모드보다 크다').toBeGreaterThan(1);
            expect(longMin, `${era}: 약 1시간 모드의 모델 시간(분, 보고) — 30분 모드 ${shortMin.toFixed(1)}분 × (1 + 0.5 × (${holdRatio.toFixed(3)} − 1))`).toBeGreaterThan(shortMin * (1 + 0.5 * (holdRatio - 1)));
          }
        });
      });
    },
  );
});

describe('유년기 사망 (R-045 a): 담담하게 끝난다', () => {
  // 20세 전 사망은 0.3~1.0% — 판을 많이 돌려 그런 판을 모은다
  // 20세까지만 진행해(20세 전 사망만 필요하다) 시드를 많이 훑는다
  const EARLY_SEEDS = 4000;
  const earlyDeathsOf = lazy(() => {
    const out: GameState[] = [];
    for (const era of SIM_PROFILES) {
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
    const rate = earlyDeaths.length / (SIM_PROFILES.length * EARLY_SEEDS);
    expect(earlyDeaths.length).toBeGreaterThanOrEqual(5);
    expect(rate).toBeGreaterThan(0.0003);
    expect(rate).toBeLessThan(0.02);
  });

  it('그런 판의 마지막 연표 항목은 사망 문구 하나이고, 원인은 어린 나이에 어울리는 것이다 (병·사고)', () => {
    for (const f of earlyDeathsOf()) {
      const last = f.history[f.history.length - 1];
      expect(last.kind).toBe('death');
      expect(last.text).toMatch(/^세상을 떠났습니다\. 원인은 (갑작스러운 병이었|사고였)습니다\.$/);
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
    for (const era of SIM_PROFILES) {
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
      const final = playToEnd(startLife(i * 7919 + 13, 'alpha'), chooserFor('random', i)).state;
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
  const balanceLazy = lazy(() => balanceOf(SIM_PROFILES.flatMap((era) => sharedLives()[era])));

  it('출생값과 최종값의 상관계수: 행복·관계 모두 0.45 미만', () => {
    const b = balanceLazy();
    expect(b.correlation.happiness).toBeLessThan(0.45);
    expect(b.correlation.relationships).toBeLessThan(0.45);
  });

  it('부모 재력 단계별 최종 행복·관계 평균의 차이가 작다 (표본이 충분한 1~4단계 사이 행복 10 이하 · 관계 6 이하)', () => {
    const b = balanceLazy();
    // SPEC-005 QI5(마스터 결정 — 설계 문서 9절 2번): 표본 필터를 제목이 말하는 「표본이 충분한 1~4단계」에 맞춰 `n >= 200`으로 했다. 예전 `n >= 60`은 재력 5단계(세 시대 합쳐 약 80판, 평균의 표준오차 약 1.3)까지 끼워
    // 고정 시드 줄에서는 부모 결정과 상관없이 단계 차가 8.87 ↔ 10.72로 출렁였다. 한도 10은 그대로다. 독립 표본 12000판(시드 1001~5000)에서 PD 전/후 단계 차는 9.02 / 8.90으로 같았다.
    const big = b.tiers.filter((t) => t.n >= 200);
    expect(big.map((t) => t.tier)).toEqual([1, 2, 3, 4]);
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
    for (const era of SIM_PROFILES) {
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
