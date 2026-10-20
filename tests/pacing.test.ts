import { describe, expect, it } from 'vitest';
import {
  AUTO_EXPONENT_LIMIT,
  ERAS,
  STAGES,
  advanceYear,
  applyStatDeltas,
  autoChoiceWeights,
  autoResolveStep,
  birthFadeDelta,
  createEventPool,
  naturalDeltas,
  playToEnd,
  resolveChoice,
  resolveEffects,
  stageOf,
  validateEventFiles,
  type Character,
  type EventDef,
  type GameState,
  type Stats,
} from '../src/core';
import { EVENT_POOL } from '../src/data/events';
import { EVENT_FREQUENCY, MIN_YEARS_BETWEEN_CHOICES, MOOD_DRIFT } from '../src/data/lifeTable';
import { LIFE_LENGTH_MODES } from '../src/data/timingTable';
import { chooserFor, correlation, startLife } from '../scripts/simulateLib';

/**
 * 한 판의 선택지 수 조절(페이싱)은 인생 길이 모드 표에 있다(M8, data/timingTable.ts#LIFE_LENGTH_MODES) — 이 시험은 30분 모드(기본)의 표를 읽고, 상한 시험은 표 값을 **시험 안에서만** 낮춰 끼운다
 * (30분 모드의 hard 30은 판의 0.1 / 0.7 / 1.7%만 닿아, 표 값 그대로는 시험 표본(200판)에서 「상한에 닿는 판이 있다」를 안정적으로 확인하지 못한다 — content-M8.md 2-8절).
 */
const CHOICE_PACING = LIFE_LENGTH_MODES.short30.pacing;
/** 상한 시험에 끼우는 낮은 페이싱: 후보가 넉넉한 풀에서 판당 평균이 25 안팎이라 hard 24에 많은 판이 닿는다 */
const LOW_PACING = { soft: 18, softFactor: 0.3, hard: 24 };
function withPacing<T>(pacing: { soft: number; softFactor: number; hard: number }, fn: () => T): T {
  const saved = { ...CHOICE_PACING };
  try {
    Object.assign(CHOICE_PACING, pacing);
    return fn();
  } finally {
    Object.assign(CHOICE_PACING, saved);
  }
}

/** M4 밸런스 장치: 행복·관계의 출생 편차 걷어 내기(R-045 b, R-063), 한 판의 선택지 수 조절, 자동 선택 가중치의 지수 제한(R-046). */

const character = (over: Partial<Character> = {}): Character => ({ name: '김민준', gender: 'male', birthYear: 2012, parentWealth: 3, parenting: 'free', looks: 50, ...over });
const stats = (over: Partial<Stats> = {}): Stats => ({ education: 50, health: 50, happiness: 50, relationships: 50, ...over });
const drift = (age: number, over: Partial<Stats>, birth?: Pick<Stats, 'happiness' | 'relationships'>) =>
  naturalDeltas(age, character(), stats(over), 'present', birth);
const birthOf = (happiness: number, relationships: number = happiness) => ({ happiness, relationships });

/** 행복·관계를 가장 많이 올리는(sign=1) / 가장 많이 깎는(sign=-1) 선택지를 늘 고르는 전략 (현재 상태에서 보너스까지 계산한 실제 효과로 고른다) */
function moodChooser(sign: 1 | -1) {
  return (s: GameState): string => {
    const ev = EVENT_POOL.byId.get(s.pending!.eventId)!;
    let best = s.pending!.choiceIds[0];
    let bestValue = -Infinity;
    for (const id of s.pending!.choiceIds) {
      const c = ev.choices!.find((x) => x.id === id)!;
      const r = resolveEffects(c.effects, c.bonuses, { character: s.character!, stats: s.stats, flags: new Set(s.flags) });
      const value = sign * ((r.stats.happiness ?? 0) + (r.stats.relationships ?? 0));
      if (value > bestValue) {
        bestValue = value;
        best = id;
      }
    }
    return best;
  };
}

describe('행복·관계의 출생 편차 걷어 내기 (R-045 b, R-063): 출생값에는 덜 묶이고, 학창기 선택은 지워지지 않는다', () => {
  it('표: 학창기는 출생 편차의 80%를 7~19세에 걷어 내고, 어른이 되면 4년마다 36~64 밖의 값만 되돌린다', () => {
    expect(MOOD_DRIFT.school).toEqual({ fadeShare: 0.8, fromAge: 7, toAge: 19 });
    expect(MOOD_DRIFT.adult).toEqual({ low: 36, high: 64, every: 4 });
  });

  it('birthFadeDelta: 출생 값이 50이면 0, 높으면 음수·낮으면 양수, 7~19세 밖에서는 0이다', () => {
    for (let age = 0; age <= 30; age++) {
      expect(birthFadeDelta(50, age), `${age}세 출생 50`).toBe(0);
      if (age < 7 || age > 19) {
        expect(birthFadeDelta(68, age), `${age}세 출생 68`).toBe(0);
        expect(birthFadeDelta(32, age), `${age}세 출생 32`).toBe(0);
      }
    }
    for (let age = 7; age <= 19; age++) {
      expect(birthFadeDelta(68, age), `${age}세 출생 68`).toBeLessThanOrEqual(0);
      expect(birthFadeDelta(32, age), `${age}세 출생 32`).toBeGreaterThanOrEqual(0);
    }
  });

  it('birthFadeDelta: 13년 동안 합이 정확히 -round((출생 값 - 50) x 0.8)이고, 한 해의 변화는 -1·0·+1 (출생 편차 ±16 안; 출생값이 가장 벗어나는 ±19에서도 최대 ±2)', () => {
    for (let birth = 29; birth <= 71; birth++) {
      let sum = 0;
      for (let age = 7; age <= 19; age++) {
        const d = birthFadeDelta(birth, age);
        expect(Math.abs(d), `${age}세 출생 ${birth}`).toBeLessThanOrEqual(Math.abs(birth - 50) <= 16 ? 1 : 2);
        sum += d;
      }
      expect(sum, `출생 ${birth}`).toBe(Math.round(-(birth - 50) * MOOD_DRIFT.school.fadeShare) + 0); // + 0: -0을 0으로
    }
  });

  it('학창기 자연 변화는 출생 값만 본다: 현재 행복·관계가 출생 값과 달라도(선택으로 올랐든 내렸든) 되돌리지 않는다 (예전에는 매년 49~51로 되돌렸다)', () => {
    const born = birthOf(50);
    for (const age of [7, 12, 19]) {
      for (const now of [10, 30, 49, 51, 52, 70, 95]) {
        expect(drift(age, { happiness: now, relationships: now }, born).happiness, `${age}세 행복 ${now}`).toBeUndefined();
        expect(drift(age, { happiness: now, relationships: now }, born).relationships, `${age}세 관계 ${now}`).toBeUndefined();
      }
    }
  });

  it('출생 값을 주지 않으면 학창기 회귀는 없다 (부분 상태·옛 호출 방어)', () => {
    expect(drift(12, { happiness: 80 }).happiness).toBeUndefined();
    expect(naturalDeltas(12, character(), stats({ happiness: 80 }), 'present', null).happiness).toBeUndefined();
  });

  it('영유아기(0~6세)에는 걷어 내지 않는다 — 출생값은 어린 시절의 사실이다', () => {
    for (const age of [0, 3, 6]) {
      expect(drift(age, { happiness: 90, relationships: 10 }, birthOf(90, 10)).happiness).toBeUndefined();
      expect(drift(age, { happiness: 90, relationships: 10 }, birthOf(90, 10)).relationships).toBeUndefined();
    }
  });

  it('학창기 선택의 효과는 졸업할 때까지 그대로 남는다: 학창기 13년의 자연 변화만 거치면 출생+5로 시작한 값은 출생으로 시작한 값보다 정확히 5 높다', () => {
    const run = (startOffset: number) => {
      const born = birthOf(64, 36);
      let s = stats({ happiness: 64 + startOffset, relationships: 36 + startOffset });
      for (let age = 7; age <= 19; age++) s = applyStatDeltas(s, naturalDeltas(age, character(), s, 'present', born));
      return s;
    };
    const base = run(0);
    const lifted = run(5);
    expect(lifted.happiness - base.happiness).toBe(5);
    expect(lifted.relationships - base.relationships).toBe(5);
    // 대조: 옛 방식(현재 값을 매년 50 쪽으로 되돌리기)이라면 +5는 2~3년 안에 사라진다 — 지금은 출생 편차만 줄어든다
    expect(base.happiness).toBeLessThan(64);
    expect(base.relationships).toBeGreaterThan(36);
  });

  it('학창기 13년 동안 출생 편차가 크게 줄어든다: 행복 30과 70에서 시작해도 졸업할 즈음 가까워진다 (이벤트 없이 자연 변화만)', () => {
    const run = (start: number) => {
      const born = birthOf(start);
      let s = stats({ happiness: start, relationships: start });
      for (let age = 7; age <= 19; age++) s = applyStatDeltas(s, naturalDeltas(age, character(), s, 'present', born));
      return s;
    };
    const low = run(30);
    const high = run(70);
    expect(high.happiness - low.happiness).toBeLessThanOrEqual(40 * (1 - MOOD_DRIFT.school.fadeShare) + 1);
    expect(low.happiness).toBeGreaterThan(30);
    expect(high.happiness).toBeLessThan(70);
    expect(low.relationships).toBeGreaterThan(30);
    expect(high.relationships).toBeLessThan(70);
  });

  it('어른(20세~): every(4)의 배수 나이에만, 36~64 밖일 때만 되돌린다', () => {
    expect(drift(40, { happiness: 70 }).happiness).toBe(-1);
    expect(drift(40, { happiness: 30 }).happiness).toBe(1);
    expect(drift(40, { happiness: 64 }).happiness).toBeUndefined();
    expect(drift(40, { happiness: 36 }).happiness).toBeUndefined();
    expect(drift(41, { happiness: 90 }).happiness, '4의 배수가 아닌 나이').toBeUndefined();
    expect(drift(42, { happiness: 90 }).happiness).toBeUndefined();
    expect(drift(44, { relationships: 90 }).relationships).toBe(-1);
    // 노년에도 같은 규칙이고, 노년의 관계 자연 감소(4년마다 -1)와 합쳐진다
    expect(drift(72, { relationships: 30 }).relationships ?? 0, '72세: 관계 감소 -1 + 되돌림 +1 = 변화 없음').toBe(0);
    expect(drift(72, { relationships: 50 }).relationships, '72세: 관계 감소만').toBe(-1);
  });

  it('실제 한 판들에서 출생값과 최종값의 상관이 낮다: 행복·관계 모두 0.45 미만 (회귀 장치 없이는 M3 표본 풀에서 0.8)', () => {
    const born: number[][] = [[], []];
    const last: number[][] = [[], []];
    for (const era of ERAS) {
      for (let i = 1; i <= 250; i++) {
        const seed = i * 7919 + 13;
        const start = startLife(seed, era);
        const end = playToEnd(start, chooserFor('random', seed)).state;
        born[0].push(end.birthStats!.happiness);
        last[0].push(end.stats.happiness);
        born[1].push(end.birthStats!.relationships);
        last[1].push(end.stats.relationships);
      }
    }
    expect(correlation(born[0], last[0]), '행복').toBeLessThan(0.45);
    expect(correlation(born[1], last[1]), '관계').toBeLessThan(0.45);
  });

  describe('선택 민감도 (R-063, SPEC "선택이 스탯과 이후 이벤트에 영향"): 행복·관계를 노리는 전략과 깎는 전략의 최종 차이', () => {
    // 세 시대 x 시드 150개 = 450판을 같은 시드·같은 출생으로 세 번(올리는 전략 / 무작위 / 깎는 전략) 돌린다.
    // 측정(scripts/simulateLib 기준 같은 450판): 올리는 쪽 행복 73.8 · 관계 86.1 / 깎는 쪽 행복 30.2 · 관계 39.7 → 행복 43.6점 · 관계 46.4점 차이.
    // 평균의 표준오차는 약 0.6점이라 아래 하한(30점)은 측정값의 약 70% — 시드 몇 개나 우연으로는 깨지지 않고, 선택이 평균으로 흡수되면(차이가 10점 아래) 확실히 깨진다.
    // 같은 측정을 옛 학창기 회귀(현재 값을 매년 49~51로 되돌림)로 하면 최종 차이는 행복 41.4 · 관계 37.8이었다 — 어른 이후의 선택은 남았기 때문이다.
    // 옛 방식이 지운 것은 학창기 몫이라, 그것을 가르는 단언은 마지막 테스트(20세 시점 차이)다. SPEC-005 EK4(승인 A14)로 이 시험의 기준이 바뀌었다 — 아래 마지막 테스트의 주석.
    const SEEDS_PER_ERA = 150;
    const MIN_GAP = 30;
    const result = (() => {
      const acc = { up: { h: 0, r: 0 }, rand: { h: 0, r: 0 }, down: { h: 0, r: 0 }, n: 0 };
      for (const era of ERAS) {
        for (let i = 1; i <= SEEDS_PER_ERA; i++) {
          const seed = i * 7919 + 13;
          const up = playToEnd(startLife(seed, era), moodChooser(1)).state;
          const mid = playToEnd(startLife(seed, era), chooserFor('random', seed)).state;
          const down = playToEnd(startLife(seed, era), moodChooser(-1)).state;
          acc.up.h += up.stats.happiness;
          acc.up.r += up.stats.relationships;
          acc.rand.h += mid.stats.happiness;
          acc.rand.r += mid.stats.relationships;
          acc.down.h += down.stats.happiness;
          acc.down.r += down.stats.relationships;
          acc.n++;
        }
      }
      const m = (x: number) => x / acc.n;
      return { up: { h: m(acc.up.h), r: m(acc.up.r) }, rand: { h: m(acc.rand.h), r: m(acc.rand.r) }, down: { h: m(acc.down.h), r: m(acc.down.r) }, n: acc.n };
    })();

    it(`표본은 ${ERAS.length * SEEDS_PER_ERA}판이다`, () => {
      expect(result.n).toBe(ERAS.length * SEEDS_PER_ERA);
    });

    it(`행복: 올리는 전략의 최종 평균이 깎는 전략보다 ${MIN_GAP}점 이상 높다`, () => {
      expect(result.up.h - result.down.h).toBeGreaterThanOrEqual(MIN_GAP);
    });

    it(`관계: 올리는 전략의 최종 평균이 깎는 전략보다 ${MIN_GAP}점 이상 높다`, () => {
      expect(result.up.r - result.down.r).toBeGreaterThanOrEqual(MIN_GAP);
    });

    it('두 전략이 무작위 선택의 양쪽에 있다: 올리는 쪽은 무작위보다 확실히 높고 깎는 쪽은 확실히 낮다 (행복·관계 각각 8점 이상)', () => {
      expect(result.up.h - result.rand.h).toBeGreaterThanOrEqual(8);
      expect(result.rand.h - result.down.h).toBeGreaterThanOrEqual(8);
      expect(result.up.r - result.rand.r).toBeGreaterThanOrEqual(8);
      expect(result.rand.r - result.down.r).toBeGreaterThanOrEqual(8);
    });

    // SPEC-005 EK4·승인 A14 「기준의 교체이지 약화가 아님」: 이 시험의 옛 기준은 「0~18세 학창기의 *내 선택*이 20세까지 남는다 ≥ 18점(측정 28.0, 옛 회귀 10.3)」이었다.
    // QI5로 12세까지는 부모가, 13~18세의 부모 소관 카드도 부모가 고르므로(PD1·PD2) 20세 전에 사람이 고르는 카드가 약 7.1장 → 약 1.1장으로 줄었다 — 옛 기준은 구조적으로 닿을 수 없다(설계 문서 4-7절 예측 약 4~6점).
    // 새 기준은 같은 뜻을 새 구조로 옮긴다: 「13세 이후 *본인이 고른* 선택(본인 구간 카드 + 19~20세 카드)이 20세까지 남는다」. 부모·흘러감 해는 두 전략에 같은 확률 모델로 적용되고 전략을 보지 않으므로(PD3),
    // 이 차이는 본인이 고른 몫이 대부분이다. 한도는 측정값 − 3 SE (SPEC EK4): 시험 표본(시대 × 시드 60개 = 180판) PD13 ×2.0에서 7.37(×1.5였을 때 6.63 ± 0.40 → 5.42), 큰 표본(시대 × 300개 = 897판)은 ×1.5에서 5.55 ± 0.17 → 5.05(×2.0에서는 다시 재지 않았다 — 본인 카드가 늘어 같거나 더 크다)이고, 모두 아래 한도 5 위다.
    // 선택이 평균으로 흡수되면(차이가 1~2점 아래) 확실히 깨진다. 최종 차이(MIN_GAP 30, 위)는 청년 이후 카드가 지키므로 유지했다.
    it('13세 이후 본인이 고른 선택이 졸업(20세) 시점까지 남는다: 올리는 전략의 20세 행복+관계가 깎는 전략보다 평균 5점 이상 높다 (옛 기준 18점 → 측정값 − 3 SE로 교체; 시험 표본 ×2.0에서 7.37, ×1.5에서 6.63)', () => {
      let gap = 0;
      let n = 0;
      for (const era of ERAS) {
        for (let i = 1; i <= 60; i++) {
          const seed = i * 7919 + 13;
          const at20 = (sign: 1 | -1) => {
            let s = startLife(seed, era);
            const choose = moodChooser(sign);
            while (s.phase === 'life' && s.age < 20) s = s.pending !== null ? resolveChoice(s, s.pending.key, choose(s)) : advanceYear(s);
            return s;
          };
          const up = at20(1);
          const down = at20(-1);
          if (up.phase !== 'life' || down.phase !== 'life') continue;
          gap += up.stats.happiness + up.stats.relationships - (down.stats.happiness + down.stats.relationships);
          n++;
        }
      }
      expect(n).toBeGreaterThan(150);
      expect(gap / n, '20세 시점 행복+관계의 평균 차이').toBeGreaterThanOrEqual(5);
    });
  });
});

describe('한 판의 선택지 수 조절 (CHOICE_PACING)', () => {
  /** 선택지 이벤트가 단계마다 넉넉한 풀(확률 장치를 시험하려고 후보 부족이 변수가 되지 않게 한다) */
  const paceEvents = (withNarrative: boolean): unknown[] => {
    const events: unknown[] = [];
    for (const stage of STAGES) {
      for (let i = 0; i < 25; i++) {
        events.push({
          id: `pace-${stage}-${i}`,
          title: `시험 ${stage} ${i}`,
          text: `시험용 선택지 이벤트 ${stage} ${i}의 본문 문장이다.`,
          stages: [stage],
          weight: 10,
          once: true,
          choices: [
            { id: 'a', label: '첫째', result: '첫째를 골랐다. 결과 문장.', effects: { stats: { education: 1 } } },
            { id: 'b', label: '둘째', result: '둘째를 골랐다. 결과 문장.', effects: { stats: { education: -1 } } },
          ],
        });
        if (withNarrative) {
          events.push({
            id: `pace-narr-${stage}-${i}`,
            title: `서술 ${stage} ${i}`,
            text: `시험용 서술 이벤트 ${stage} ${i}의 본문 문장이다.`,
            stages: [stage],
            weight: 10,
            once: true,
            effects: { stats: { happiness: 1 } },
          });
        }
      }
    }
    return events;
  };
  const bigPool = createEventPool(validateEventFiles({ 'pace.json': { events: paceEvents(false) } }));
  /** 같은 선택지 이벤트 + 서술 이벤트 (하드 상한 뒤에도 서술 이벤트가 이어지는지 볼 때) */
  const mixedPool = createEventPool(validateEventFiles({ 'pace.json': { events: paceEvents(true) } }));

  const choicesIn = (final: GameState) => final.history.filter((h) => h.kind === 'choice').length;
  const playMany = (n: number, era: (typeof ERAS)[number] = 'present') => {
    const counts: number[] = [];
    for (let i = 1; i <= n; i++) {
      const seed = i * 7919 + 13;
      counts.push(choicesIn(playToEnd(startLife(seed, era), chooserFor('random', seed), bigPool).state));
    }
    return counts;
  };

  it('표: 부드러운 상한 < 하드 상한이고, 선택지 최소 간격은 2년이다', () => {
    expect(CHOICE_PACING.soft).toBeLessThan(CHOICE_PACING.hard);
    expect(CHOICE_PACING.softFactor).toBeGreaterThan(0);
    expect(CHOICE_PACING.softFactor).toBeLessThan(1);
    expect(MIN_YEARS_BETWEEN_CHOICES).toBe(2);
    for (const stage of STAGES) {
      expect(EVENT_FREQUENCY[stage].choice).toBeGreaterThan(0);
      expect(EVENT_FREQUENCY[stage].choice).toBeLessThan(1);
    }
  });

  it('후보가 아무리 넉넉해도 한 판의 선택지는 하드 상한을 넘지 않는다 (그리고 상한까지 가는 판이 있다)', () => {
    // 표의 값 그대로(30분 모드 hard 30)에서는 상한을 넘지 않는 것만 보고, 상한에 닿는 판이 있는지는 낮춰 끼운 페이싱으로 확인한다(M8)
    const tableCounts = playMany(200);
    expect(Math.max(...tableCounts)).toBeLessThanOrEqual(CHOICE_PACING.hard);
    withPacing(LOW_PACING, () => {
      const counts = playMany(200);
      expect(Math.max(...counts)).toBeLessThanOrEqual(LOW_PACING.hard);
      expect(Math.max(...counts), '상한에 닿는 판이 하나도 없으면 이 시험이 상한을 확인하지 못한다').toBe(LOW_PACING.hard);
    });
  });

  it('부드러운 상한은 윗꼬리만 줄인다: 같은 시드에서 softFactor를 1로 두면(감속 없음) 상한 근처에 몰리는 판이 더 많다', () => {
    withPacing(LOW_PACING, () => {
      const withSoft = playMany(200);
      CHOICE_PACING.softFactor = 1;
      const without = playMany(200);
      const nearCap = (xs: number[]) => xs.filter((c) => c >= CHOICE_PACING.hard).length;
      expect(nearCap(without)).toBeGreaterThan(nearCap(withSoft));
      const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
      expect(mean(without)).toBeGreaterThan(mean(withSoft));
    });
  });

  it('선택지가 없는 판도, 하드 상한에 닿은 뒤에도 인생은 계속된다 (서술 이벤트·조용한 해로 사망까지)', () => {
    const saved = { ...CHOICE_PACING };
    try {
      CHOICE_PACING.hard = 3;
      CHOICE_PACING.soft = 2;
      const end = playToEnd(startLife(11, 'present'), chooserFor('random', 11), mixedPool).state;
      expect(end.phase).toBe('ending');
      expect(choicesIn(end), '하드 상한(3)까지 선택지를 다 쓴다').toBe(3);
      // R-066: 예전 단언(서술 이벤트 수 >= 0)은 항상 참이었다. 상한 뒤에도 서술 이벤트가 실제로 나오고, 인생이 마지막 선택지 뒤로 이어져 사망한다.
      const lastChoiceAge = Math.max(...end.history.filter((h) => h.kind === 'choice').map((h) => h.age));
      expect(end.history.some((h) => h.kind === 'event' && h.age > lastChoiceAge), '마지막 선택지 뒤에 서술 이벤트가 있다').toBe(true);
      expect(end.death!.age, '마지막 선택지 뒤로도 살아간다').toBeGreaterThan(lastChoiceAge);
    } finally {
      Object.assign(CHOICE_PACING, saved);
    }
  });
});

describe('자동 선택 가중치의 지수 제한 (R-046): 비정상적으로 큰 효과에서도 Infinity·0이 되지 않는다', () => {
  // 검증(validateEventFiles)을 일부러 우회해 런타임 방어만 시험한다
  const huge: EventDef = {
    id: 'huge-event',
    title: '거대한 효과',
    text: '시험용 거대한 효과 이벤트의 본문 문장이다.',
    stages: ['youth'],
    weight: 10,
    once: true,
    choices: [
      { id: 'up', label: '크게 오른다', result: '크게 올랐다. 결과 문장이다.', effects: { stats: { health: 1e9, education: 1e9, happiness: 1e9 } } },
      { id: 'down', label: '크게 내린다', result: '크게 내렸다. 결과 문장이다.', effects: { stats: { health: -1e9, education: -1e9, happiness: -1e9 } } },
    ],
  };
  const pool = createEventPool([huge]);
  const pendingState = (): GameState => {
    const base = startLife(5, 'present');
    const age = 25;
    return { ...base, age, seen: { 'huge-event': age }, lastChoiceAge: age, pending: { eventId: 'huge-event', key: `huge-event@${age}`, age, choiceIds: ['up', 'down'] } };
  };

  it('지수 한도는 40이다 (exp(40)은 유한하고 세 선택지를 더해도 유한하다)', () => {
    expect(AUTO_EXPONENT_LIMIT).toBe(40);
    expect(Number.isFinite(Math.exp(AUTO_EXPONENT_LIMIT) * 3)).toBe(true);
  });

  it('가중치가 모두 유한한 양수이고, 큰 쪽이 압도적으로 크다', () => {
    const w = autoChoiceWeights(pendingState(), pool)!;
    expect(w.ids).toEqual(['up', 'down']);
    for (const x of w.weights) {
      expect(Number.isFinite(x)).toBe(true);
      expect(x).toBeGreaterThan(0);
    }
    expect(w.weights[0]).toBeGreaterThan(w.weights[1] * 1e6);
  });

  it('자동 선택은 예외 없이 한 쪽을 고르고 인생이 이어진다', () => {
    const s = pendingState();
    const r = autoResolveStep(s, s.pending!.key, pool);
    expect(r.state).not.toBe(s);
    expect(r.state.history.some((h) => h.kind === 'choice')).toBe(true);
    // 수동 선택과도 같은 결과(R-039)
    const manual = resolveChoice(s, s.pending!.key, 'up', pool);
    expect(r.state).toEqual(manual);
    // 그 뒤 한 해를 더 진행해도 문제없다
    expect(() => advanceYear(r.state, pool)).not.toThrow();
    expect(stageOf(r.state.age)).toBe('youth');
  });
});
