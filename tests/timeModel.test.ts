import { describe, expect, it } from 'vitest';
import {
  ERAS,
  READ_LEVELS,
  autoChoiceDelayMs,
  cardReadChars,
  cardReadNeedMs,
  emptyCounts,
  estimatePlaySeconds,
  extraLineMsFor,
  holdDelayMs,
  holdMsFor,
  holdTotalMs,
  isChoiceEvent,
  isMilestoneEvent,
  playToEnd,
  readSecFor,
  stepYear,
  yearLineCount,
  type Era,
  type EventDef,
  type TickCounts,
  type TickInfo,
} from '../src/core';
import { EVENT_POOL } from '../src/data/events';
import { AUTO_CHOICE_MS, HOLD_MS, JUMP_OVERHEAD_SEC, LIFE_LENGTH_MODES, READ_MODEL } from '../src/data/timingTable';
import { exposureOf } from '../scripts/citationExposureLib';
import { chooserFor, startLife } from '../scripts/simulateLib';
import { charStatsOf, measureMany, parseCandidates, poolCharStats, preciseCardSec, summarize } from '../scripts/timeReportLib';

/**
 * 시간 모델 (SPEC-003 LM2, M8 — docs/data/content-M8.md 2절, 완료 기준 2~5): 연출 대기(모드 계수·한 해 여러 줄), 읽는 시간 r, `estimatePlaySeconds`를 **직접 계산한 값**과 맞추고,
 * 읽는 시간 모델의 글자 수·인용 노출률이 실제 데이터와 맞는지(±10%·±5%p) 대조한다. 이 값들은 출발점이고 사람의 r은 사람 실측이 정한다(LM7).
 */

const counts = (over: Partial<TickCounts> = {}): TickCounts => ({ ...emptyCounts(), ...over });
const len = (s: string): number => [...s].length;
const mean = (xs: readonly number[]): number => xs.reduce((a, b) => a + b, 0) / (xs.length || 1);

describe('holdMsFor: 모드 × 종류 × 줄 수 표 (직접 계산 — 완료 기준 2)', () => {
  it('30분 모드(계수 1.35 — SPEC-005 TM4, 마스터 승인 A13: 1.25에서 올림): 조용한 해 9450 · 서술 해 22950 · 결과 17550 ms, 줄마다 +6750 ms (HOLD_MS는 그대로 두고 계수만 곱한다)', () => {
    expect(HOLD_MS).toEqual({ quiet: 7000, narrative: 17000, resolved: 13000 }); // 기본 표는 바꾸지 않았다
    expect(LIFE_LENGTH_MODES.short30.holdScale).toBe(1.35);
    expect(holdMsFor('quiet', { mode: 'short30' })).toBe(9450);
    expect(holdMsFor('narrative', { mode: 'short30' })).toBe(22950);
    expect(holdMsFor('resolved', { mode: 'short30' })).toBe(17550);
    expect(extraLineMsFor('short30')).toBe(6750);
    // 한 해 여러 줄: 서술·결과 해만 둘째 줄부터 더한다. 1세의 세 줄 서술 해 = (17000 + 2 × 5000) × 1.35 = 36450
    expect(holdMsFor('narrative', { mode: 'short30', lines: 1 })).toBe(22950);
    expect(holdMsFor('narrative', { mode: 'short30', lines: 2 })).toBe(29700);
    expect(holdMsFor('narrative', { mode: 'short30', lines: 3 })).toBe(36450);
    expect(holdMsFor('resolved', { mode: 'short30', lines: 2 })).toBe(24300);
    expect(holdMsFor('resolved', { mode: 'short30', lines: 3 })).toBe(31050);
  });

  it('부모님이 정한·흘러간 해(SPEC-005 PD5-d): 결과 해의 연출 대기 = max(기본 결과 대기 + 줄 대기, 카드 읽기 필요량) — 필요량이 없으면 사람이 고른 결과 해와 같고, 짧으면 기본이 이기고, 길면 필요량이 이긴다', () => {
    const base = holdMsFor('resolved', { mode: 'short30' }) as number; // 17550
    expect(holdMsFor('resolved', { mode: 'short30', readNeedMs: undefined })).toBe(base);
    expect(holdMsFor('resolved', { mode: 'short30', readNeedMs: 20_500 })).toBe(20_500); // 인용 없는 카드 평균 필요량 20.5초 안팎 > 17.55
    expect(holdMsFor('resolved', { mode: 'short30', readNeedMs: 33_500 })).toBe(33_500); // 인용 있는 카드
    expect(holdMsFor('resolved', { mode: 'short30', readNeedMs: 9_000 })).toBe(base); // 짧은 필요량은 기본 대기를 줄이지 않는다
    expect(holdMsFor('resolved', { mode: 'short30', lines: 2, readNeedMs: 20_000 })).toBe(24_300); // 줄 대기가 붙은 기본이 더 길다
    expect(holdMsFor('resolved', { mode: 'short30', readNeedMs: Number.NaN })).toBe(base); // 이상한 값은 무시
    // 다른 종류에는 쓰이지 않는다 (서술 해·조용한 해·선택지·사망)
    expect(holdMsFor('narrative', { mode: 'short30', readNeedMs: 90_000 })).toBe(22950);
    expect(holdMsFor('quiet', { mode: 'short30', readNeedMs: 90_000 })).toBe(9450);
    expect(holdMsFor('choice', { mode: 'short30', readNeedMs: 90_000 })).toBeNull();
    expect(holdDelayMs('resolved', 8, 1, { mode: 'short30', readNeedMs: 33_500 })).toBe(33_500 / 8); // 8배속은 대기 ÷ 8
  });

  it('cardReadNeedMs: 느린 독자(500자/분) 글자 읽기 + 여유 3초 + 인용 박스 13초(있을 때만), 정수 ms — 약 146자 카드는 인용 없이 20.5초 · 있으면 33.5초 (설계 문서 4-3절)', () => {
    expect(cardReadNeedMs(0, false)).toBe(3000);
    expect(cardReadNeedMs(500, false)).toBe(63_000); // 500자 ÷ 500자/분 = 60초 + 3초
    expect(cardReadNeedMs(146, false)).toBe(Math.round((146 / 500) * 60 * 1000 + 3000));
    expect(cardReadNeedMs(146, true)).toBe(cardReadNeedMs(146, false) + READ_MODEL.citeSec.high * 1000);
    expect(READ_MODEL.cpm.high).toBe(500);
    expect(READ_MODEL.citeSec.high).toBe(13);
    expect(cardReadNeedMs(-5, false)).toBe(3000);
  });

  it('약 1시간 모드(계수 2.0 — 1차는 닫혀 있고 표만 준비): 14000 · 34000 · 26000 ms, 줄마다 +10000 ms', () => {
    expect(holdMsFor('quiet', { mode: 'long60' })).toBe(14000);
    expect(holdMsFor('narrative', { mode: 'long60' })).toBe(34000);
    expect(holdMsFor('resolved', { mode: 'long60' })).toBe(26000);
    expect(extraLineMsFor('long60')).toBe(10000);
    expect(holdMsFor('narrative', { mode: 'long60', lines: 3 })).toBe(54000);
  });

  it('조용한 해는 줄 수를 보지 않고, 선택지·사망에는 대기가 없으며(null), 새로고침 직후(null)·알 수 없는 걸음은 조용한 해 값이다', () => {
    expect(holdMsFor('quiet', { mode: 'short30', lines: 5 })).toBe(9450);
    expect(holdMsFor('choice', { mode: 'short30', lines: 2 })).toBeNull();
    expect(holdMsFor('death', { mode: 'long60' })).toBeNull();
    expect(holdMsFor(null, { mode: 'short30' })).toBe(9450);
    expect(holdMsFor('none')).toBe(9450);
    // 모드를 모르면(출생 전·변조) 기본 모드
    expect(holdMsFor('quiet', { mode: null })).toBe(9450);
    expect(holdMsFor('quiet')).toBe(9450);
  });

  it('줄 수가 이상해도(0·음수·소수·NaN·Infinity) 기본 대기 아래로 내려가지 않고 터지지 않는다', () => {
    for (const lines of [0, -3, 0.5, Number.NaN, Number.NEGATIVE_INFINITY]) expect(holdMsFor('narrative', { mode: 'short30', lines }), String(lines)).toBe(22950);
    expect(holdMsFor('narrative', { mode: 'short30', lines: 2.9 })).toBe(29700); // 소수는 버린다
  });

  it('holdDelayMs: 배속으로 나누고 개발용 시간 배율로 더 나눈다. 줄 대기도 같이 나뉜다', () => {
    expect(holdDelayMs('quiet', 1)).toBe(9450);
    expect(holdDelayMs('quiet', 8)).toBe(1181.25);
    expect(holdDelayMs('narrative', 2, 1, { mode: 'short30', lines: 3 })).toBe(36450 / 2);
    expect(holdDelayMs('narrative', 8, 4, { mode: 'long60', lines: 2 })).toBe(44000 / 8 / 4);
    expect(holdDelayMs('choice', 1, 1, { mode: 'short30' })).toBeNull();
    expect(autoChoiceDelayMs(1)).toBe(AUTO_CHOICE_MS); // 자동 선택은 모드 계수의 대상이 아니다
  });

  it('조용한 해 < 서술 해, 결과 해 < 서술 해 × 1.5는 두 모드 모두에서 성립한다', () => {
    for (const mode of ['short30', 'long60'] as const) {
      const q = holdMsFor('quiet', { mode }) as number;
      const n = holdMsFor('narrative', { mode }) as number;
      const r = holdMsFor('resolved', { mode }) as number;
      expect(q).toBeLessThan(n);
      expect(r).toBeLessThan(n * 1.5);
    }
  });
});

describe('한 해 여러 줄: tick.lines · counts.extraLines (TODO M8 220행)', () => {
  const lineCountsIndependently = (final: ReturnType<typeof playToEnd>['state']): number => {
    // 연표로 다시 센 둘째 줄 수의 합: 사망 직전까지의 해마다 max(0, 줄 − 1) — 그 나이의 event·choice 줄 전부(조용한 해는 줄 0, 해 끝 규칙의 상속 줄도 그 나이의 event 줄이다)
    const byAge = new Map<number, number>();
    for (const h of final.history) {
      if (h.kind === 'event' || h.kind === 'choice') byAge.set(h.age, (byAge.get(h.age) ?? 0) + 1);
    }
    let extra = 0;
    for (const [age, n] of byAge) if (age < (final.death?.age ?? 0)) extra += Math.max(0, n - 1);
    return extra;
  };

  it('yearLineCount: 그 나이의 event·choice 줄만 센다 (stage·death·note 줄은 세지 않는다)', () => {
    const h = [
      { age: 1, kind: 'stage' as const, text: 'a' },
      { age: 1, kind: 'event' as const, text: 'b' },
      { age: 1, kind: 'event' as const, text: 'c' },
      { age: 1, kind: 'choice' as const, text: 'd' },
      { age: 1, kind: 'note' as const, text: 'e' },
      { age: 2, kind: 'event' as const, text: 'f' },
      { age: 2, kind: 'death' as const, text: 'g' },
    ];
    expect(yearLineCount(h, 1)).toBe(3);
    expect(yearLineCount(h, 2)).toBe(1);
    expect(yearLineCount(h, 3)).toBe(0);
  });

  it('실제 풀: 1세에는 걸음마·첫 말이 한 해에 겹쳐 세 줄 서술 해(또는 결과 해)가 나오고 tick.lines가 그 줄 수와 같다', () => {
    let found = 0;
    for (let seed = 1; seed <= 300 && found < 3; seed++) {
      let s = startLife(seed * 7919 + 13, 'present');
      for (let i = 0; i < 6 && s.phase === 'life' && s.pending === null; i++) {
        const r = stepYear(s);
        if (r.tick.fromAge === 1 && (r.tick.kind === 'narrative' || r.tick.kind === 'choice')) {
          const lines = yearLineCount(r.state.history, 1);
          if (r.tick.kind === 'narrative') {
            expect(r.tick.lines, `시드 ${seed}`).toBe(lines);
            if (lines >= 3) {
              found++;
              expect(holdMsFor('narrative', { mode: 'short30', lines: r.tick.lines })).toBe(36450);
            }
          }
        }
        s = r.state;
      }
    }
    expect(found, '세 줄 서술 해가 실제로 나오는 판이 있다').toBeGreaterThanOrEqual(1);
  });

  it('counts.extraLines = 연표로 독립 계산한 둘째 줄 수의 합이다 (세 시대 × 60판, 결정 카드를 고른 해 포함)', () => {
    for (const era of ERAS as readonly Era[]) {
      for (let i = 1; i <= 60; i++) {
        const seed = i * 7919 + 13;
        const run = playToEnd(startLife(seed, era), chooserFor('random', seed));
        expect(run.counts.extraLines, `${era} 시드 ${seed}`).toBe(lineCountsIndependently(run.state));
      }
    }
  });

  it('둘째 줄이 있는 해가 한 판에 평균 2~3줄 있다 (M7a r3: 0~7세 중 평균 1.9해가 두 줄 이상)', () => {
    const extra = ERAS.map((era) => mean(measureMany(era, 100, 'random', 'short30').map((l) => l.counts.extraLines)));
    for (const e of extra) {
      expect(e).toBeGreaterThan(1.5);
      expect(e).toBeLessThan(5);
    }
  });

  it('사망 걸음·선택지 걸음의 tick에는 lines가 없다 (연출 대기가 없다)', () => {
    let s = startLife(321, 'present');
    for (let i = 0; i < 400 && s.phase === 'life'; i++) {
      if (s.pending !== null) {
        s = playToEnd({ ...s }, chooserFor('random', 321)).state;
        continue;
      }
      const r = stepYear(s);
      const t: TickInfo = r.tick;
      if (t.kind === 'choice' || t.kind === 'death' || t.kind === 'quiet') expect(t.lines, `${t.kind} 나이 ${t.fromAge}`).toBeUndefined();
      s = r.state;
    }
  });
});

describe('느린 독자(500자/분)가 그 해의 모든 줄을 읽는 시간 + 3초가 연출 대기 안에 든다 (완료 기준 3 — 가장 긴 줄 조합의 최악)', () => {
  const readSec = (chars: number): number => (chars / READ_MODEL.cpm.high) * 60;
  const texts = (pred: (e: EventDef) => boolean): number[] => EVENT_POOL.events.filter(pred).map((e) => len(e.text)).sort((a, b) => b - a);

  it('서술 해(마일스톤 슬롯 최대 3줄 + 일반 사건 1줄 = 4줄): 가장 긴 서술 본문 네 줄을 모두 읽어도 대기 안이다', () => {
    const narrative = texts((e) => !isChoiceEvent(e));
    for (const mode of ['short30', 'long60'] as const) {
      for (let lines = 1; lines <= 4; lines++) {
        const chars = narrative.slice(0, lines).reduce((a, b) => a + b, 0);
        const need = readSec(chars) + 3;
        const hold = (holdMsFor('narrative', { mode, lines }) as number) / 1000;
        expect(need, `${mode} ${lines}줄: 읽기 ${need.toFixed(1)}초 ≤ 대기 ${hold}초`).toBeLessThanOrEqual(hold);
      }
    }
  });

  it('결과 해(마일스톤 줄 + 고른 결과 줄): 가장 긴 결과 문구 하나와 가장 긴 마일스톤 본문들을 모두 읽어도 대기 안이다', () => {
    const results = EVENT_POOL.events.flatMap((e) => (e.choices ?? []).map((c) => len(c.result))).sort((a, b) => b - a);
    const milestones = texts(isMilestoneEvent);
    expect(milestones.length).toBeGreaterThanOrEqual(3);
    for (const mode of ['short30', 'long60'] as const) {
      for (let extra = 0; extra <= 3; extra++) {
        const chars = results[0] + milestones.slice(0, extra).reduce((a, b) => a + b, 0);
        const need = readSec(chars) + 3;
        const hold = (holdMsFor('resolved', { mode, lines: 1 + extra }) as number) / 1000;
        expect(need, `${mode} 결과 + 마일스톤 ${extra}줄: 읽기 ${need.toFixed(1)}초 ≤ 대기 ${hold}초`).toBeLessThanOrEqual(hold);
      }
    }
  });
});

describe('읽는 시간 r = 글자 읽기 + 고르는 시간 + 인용 읽기 (직접 계산 — 완료 기준 4·5)', () => {
  const c = READ_MODEL.chars;

  it('카드 한 장이 읽는 글자 수 = 제목 + 본문 + 보이는 라벨 × 라벨 글자 + 영향 줄 × 가중치', () => {
    expect(cardReadChars()).toBeCloseTo(c.title + c.body + c.visibleLabels * c.label + c.visibleLabels * c.impactPerChoice * c.impactWeight, 9);
    expect(cardReadChars()).toBeGreaterThan(95);
    expect(cardReadChars()).toBeLessThan(125);
  });

  it('readSecFor: 수준별 값을 손으로 계산한 식과 같다 (지금 세상 중앙 = 글자 ÷ 600 × 60 + 10 + 노출률 × 10)', () => {
    const chars = cardReadChars();
    expect(readSecFor('present', 'median')).toBeCloseTo((chars / 600) * 60 + 10 + READ_MODEL.citeExposure.present * 10, 9);
    expect(readSecFor('present', 'low')).toBeCloseTo((chars / 700) * 60 + 5 + READ_MODEL.citeExposure.present * 7, 9);
    expect(readSecFor('present', 'high')).toBeCloseTo((chars / 500) * 60 + 15 + READ_MODEL.citeExposure.present * 13, 9);
    expect(readSecFor('present', 'upper')).toBeCloseTo(readSecFor('present', 'high') * READ_MODEL.upperFactor, 9);
    expect(readSecFor('present')).toBe(readSecFor('present', 'median'));
  });

  it('낮음 < 중앙 < 높음 < 상한, 인용이 드문 지난 세상이 가장 짧다 (모델의 r이 옛 18초 가정에서 지금 세상 +40% 안팎으로 늘었다)', () => {
    for (const era of ERAS as readonly Era[]) {
      const [low, median, high, upper] = READ_LEVELS.map((l) => readSecFor(era, l));
      expect(low).toBeLessThan(median);
      expect(median).toBeLessThan(high);
      expect(high).toBeLessThan(upper);
    }
    expect(readSecFor('past')).toBeLessThan(readSecFor('future'));
    expect(readSecFor('future')).toBeLessThanOrEqual(readSecFor('present'));
    expect(readSecFor('present')).toBeGreaterThan(18 * 1.3);
    expect(readSecFor('present')).toBeLessThan(18 * 1.6);
  });
});

describe('estimatePlaySeconds 손계산 시나리오 (30분·1시간 × 배속 1/8 × 건너뛰기 유무 × 참고 항 — 완료 기준 5)', () => {
  const c = counts({ quiet: 40, narrative: 12, resolved: 24, choice: 25, extraLines: 3 });
  const r = readSecFor('present'); // 중앙

  it('30분 모드(계수 1.35): 연출 합 = 40 × 9.45 + 12 × 22.95 + 24 × 17.55 + 3 × 6.75 = 1094.85초', () => {
    const hold = 40 * 9.45 + 12 * 22.95 + 24 * 17.55 + 3 * 6.75;
    expect(hold).toBeCloseTo(1094.85, 9);
    expect(holdTotalMs(c, 'short30') / 1000).toBeCloseTo(hold, 9);
    expect(estimatePlaySeconds(c, { speed: 1, skipToDecision: false }, 'short30', 'present')).toBeCloseTo(hold + 25 * r, 9);
    expect(estimatePlaySeconds(c, { speed: 8, skipToDecision: false }, 'short30', 'present')).toBeCloseTo(hold / 8 + 25 * r, 9);
    expect(estimatePlaySeconds(c, { speed: 1, skipToDecision: true }, 'short30', 'present')).toBeCloseTo(25 * r + 26 * JUMP_OVERHEAD_SEC, 9);
    expect(estimatePlaySeconds(c, { speed: 8, skipToDecision: true }, 'short30', 'present')).toBeCloseTo(25 * r + 26 * JUMP_OVERHEAD_SEC, 9);
  });

  it('1시간 모드: 연출 합 = 40 × 14 + 12 × 34 + 24 × 26 + 3 × 10 = 1622초, 읽는 시간은 모드와 무관하다', () => {
    const hold = 40 * 14 + 12 * 34 + 24 * 26 + 3 * 10;
    expect(hold).toBe(1622);
    expect(estimatePlaySeconds(c, { speed: 1, skipToDecision: false }, 'long60', 'present')).toBeCloseTo(hold + 25 * r, 9);
    expect(estimatePlaySeconds(c, { speed: 8, skipToDecision: false }, 'long60', 'present')).toBeCloseTo(hold / 8 + 25 * r, 9);
    expect(estimatePlaySeconds(c, { speed: 8, skipToDecision: true }, 'long60', 'present')).toBeCloseTo(estimatePlaySeconds(c, { speed: 8, skipToDecision: true }, 'short30', 'present'), 9);
  });

  it('참고 항(기록 카드 입력 시간 등)은 합에만 더해진다 — 판정은 0으로 부른다 (LD-1)', () => {
    const base = estimatePlaySeconds(c, { speed: 1, skipToDecision: false }, 'short30', 'present');
    expect(estimatePlaySeconds(c, { speed: 1, skipToDecision: false }, 'short30', 'present', 'median', 300)).toBeCloseTo(base + 300, 9);
    expect(estimatePlaySeconds(c, { speed: 1, skipToDecision: true }, 'short30', 'present', 'median', 300)).toBeCloseTo(estimatePlaySeconds(c, { speed: 1, skipToDecision: true }, 'short30', 'present') + 300, 9);
  });

  it('읽기 수준·시대에 따라 읽는 시간만 달라진다 (연출 합은 같다)', () => {
    const hold = holdTotalMs(c, 'short30') / 1000;
    for (const era of ERAS as readonly Era[]) {
      for (const level of READ_LEVELS) {
        expect(estimatePlaySeconds(c, { speed: 1, skipToDecision: false }, 'short30', era, level), `${era} ${level}`).toBeCloseTo(hold + 25 * readSecFor(era, level), 9);
      }
    }
  });

  it('카드가 없는 판은 연출 합만, 아무것도 없으면 0이다', () => {
    expect(estimatePlaySeconds(counts(), { speed: 1, skipToDecision: false }, 'short30', 'present')).toBe(0);
    expect(estimatePlaySeconds(counts({ quiet: 10 }), { speed: 1, skipToDecision: false }, 'short30', 'present')).toBeCloseTo(94.5, 9);
  });

  it('부모님이 정한·흘러간 해(SPEC-005 TM1): 결과 해와 같은 기본 대기 + 카드 읽기 필요량 연장분만 센다 — 읽고 고르는 시간 r은 본인이 고르는 카드(choice = c_self)에만 붙는다', () => {
    const withParent = counts({ quiet: 40, narrative: 12, resolved: 19, parent: 4, child: 1, choice: 20, extraLines: 3, delegatedExtraMs: 55_000 });
    // 연출 합 = 40 × 9.45 + 12 × 22.95 + (19 + 4 + 1) × 17.55 + 3 × 6.75 + 연장 55초
    const hold = 40 * 9.45 + 12 * 22.95 + 24 * 17.55 + 3 * 6.75 + 55;
    expect(holdTotalMs(withParent, 'short30') / 1000).toBeCloseTo(hold, 9);
    expect(estimatePlaySeconds(withParent, { speed: 1, skipToDecision: false }, 'short30', 'present')).toBeCloseTo(hold + 20 * r, 9);
    // 8배속: 연출(연장분 포함)만 나뉘고 읽는 시간은 그대로
    expect(estimatePlaySeconds(withParent, { speed: 8, skipToDecision: false }, 'short30', 'present')).toBeCloseTo(hold / 8 + 20 * r, 9);
    // 다음 결정으로: 연출 없음 — 본인 카드만 읽고 오버헤드를 센다
    expect(estimatePlaySeconds(withParent, { speed: 1, skipToDecision: true }, 'short30', 'present')).toBeCloseTo(20 * r + 21 * JUMP_OVERHEAD_SEC, 9);
    // 같은 해 수라도 결과 해 대신 부모님이 정한 해로 세면 읽기 20장만 빠진다 (연장분이 0이면 연출 합은 같다)
    const asSelf = counts({ quiet: 40, narrative: 12, resolved: 24, choice: 25, extraLines: 3 });
    const asParent = counts({ quiet: 40, narrative: 12, resolved: 19, parent: 5, choice: 20, extraLines: 3 });
    expect(holdTotalMs(asParent, 'short30')).toBe(holdTotalMs(asSelf, 'short30'));
    expect(estimatePlaySeconds(asSelf, { speed: 1, skipToDecision: false }, 'short30', 'present') - estimatePlaySeconds(asParent, { speed: 1, skipToDecision: false }, 'short30', 'present')).toBeCloseTo(5 * r, 9);
  });
});

describe('읽는 시간 모델 ↔ 실제 데이터 (완료 기준 4): 글자 수 ±10%, 인용 노출률 ±5%p, 시대 상수 T ↔ 카드별 정밀 합계 ±5%', () => {
  const near = (value: number, target: number, tol = 0.1) => {
    expect(value).toBeGreaterThan(target * (1 - tol));
    expect(value).toBeLessThan(target * (1 + tol));
  };

  it('풀(정적): 결정 카드 제목·본문·선택지 라벨의 평균 글자 수가 READ_MODEL과 ±10% 안이다', () => {
    const pool = poolCharStats();
    near(pool.title, READ_MODEL.chars.title);
    near(pool.body, READ_MODEL.chars.body);
    near(pool.label, READ_MODEL.chars.label);
    // 보이는 선택지는 정의된 것(카드당 2.87개)보다 적다 — 조건(requires)으로 가려진 몫
    expect(pool.labels).toBeGreaterThan(READ_MODEL.chars.visibleLabels);
    // 합쇼체로 길어진 결과·서술 문구는 연출 대기 안에서 읽는다 (옛 해라체 가정 44.5자보다 길다 — 50자 안팎)
    near(pool.result, 50, 0.15);
    near(pool.narrativeBody, 52, 0.15);
  });

  const lives = (era: Era) => measureMany(era, 300, 'random', 'short30');

  it('뜬 카드(시대별 300판): 보인 선택지 수와 영향 줄 글자 수가 READ_MODEL과 ±10% 안이고 불변식 위반이 없다', () => {
    for (const era of ERAS as readonly Era[]) {
      const ls = lives(era);
      expect(ls.flatMap((l) => l.problems), era).toEqual([]);
      const s = charStatsOf(ls);
      near(s.visibleLabels, READ_MODEL.chars.visibleLabels);
      near(s.impactPerChoice, READ_MODEL.chars.impactPerChoice);
      near(s.title, READ_MODEL.chars.title);
      near(s.body, READ_MODEL.chars.body);
    }
  });

  it('시대별 인용 노출률(report:citations — 자동 성향 1000판)이 READ_MODEL.citeExposure와 ±5%p 안이다', () => {
    for (const era of ERAS as readonly Era[]) {
      const row = exposureOf(era, 1000);
      expect(Math.abs(row.rate - READ_MODEL.citeExposure[era]), `${era}: 측정 ${row.rate.toFixed(3)} / 상수 ${READ_MODEL.citeExposure[era]}`).toBeLessThanOrEqual(0.05);
    }
  });

  it('시대 상수 모델 T(중앙)가 카드별 정밀 합계(실제 글자 수·인용 박스 길이)와 ±5% 안이다 (시대별 300판 평균)', () => {
    for (const era of ERAS as readonly Era[]) {
      const sum = summarize(era, 'short30', lives(era));
      const diff = Math.abs(sum.constantMin - sum.preciseMin) / sum.preciseMin;
      expect(diff, `${era}: 상수 ${sum.constantMin.toFixed(2)}분 / 정밀 ${sum.preciseMin.toFixed(2)}분`).toBeLessThanOrEqual(0.05);
    }
  });

  it('정밀 합계는 낮음 < 중앙 < 높음 순이고, 인용이 있는 카드가 없는 카드보다 오래 걸린다', () => {
    const ls = lives('present');
    const cards = ls.flatMap((l) => l.cards);
    const cited = cards.filter((f) => f.cited);
    const plain = cards.filter((f) => !f.cited);
    expect(cited.length).toBeGreaterThan(20);
    expect(plain.length).toBeGreaterThan(20);
    expect(mean(cited.map((f) => preciseCardSec(f, 'median')))).toBeGreaterThan(mean(plain.map((f) => preciseCardSec(f, 'median'))));
    for (const f of cards.slice(0, 50)) {
      expect(preciseCardSec(f, 'low')).toBeLessThan(preciseCardSec(f, 'median'));
      expect(preciseCardSec(f, 'median')).toBeLessThan(preciseCardSec(f, 'high'));
    }
  });
});

describe('모드 표와 시간 모델이 함께 닫힌다 (REV-003-M8-1 R-418 — 확정 설정의 시대별 측정 평균으로 계산한다)', () => {
  // 한 판의 평균 모양(해 수 q·n·결과·결정 카드·둘째 줄)을 시대별로 300판 재서 쓴다(report:time 1000판 측정값과 같은 줄: 지난 42.1·13.4·23.6·23.9·3.22 / 지금 45.2·13.1·24.4·24.6·3.28 / 다가올 46.3·13.3·24.8·25.0·3.24).
  // 폐기된 제안값(카드 26.5장·결과 해 26)으로 계산하던 옛 시험은 낡은 입력 덕에 초록이었다 — 확정 설정(페이싱 24/30, 연출 계수 1.25)의 측정 평균으로 다시 썼다.
  const MODE = LIFE_LENGTH_MODES.short30;
  const shapes: Partial<Record<Era, ReturnType<typeof summarize>>> = {};
  const shapeOf = (era: Era) => (shapes[era] ??= summarize(era, 'short30', measureMany(era, 300, 'random', 'short30')));
  const avgCounts = (era: Era): TickCounts => {
    const sum = shapeOf(era);
    // choice는 본인이 읽고 고르는 카드(c_self) — 부모님이 정한·흘러간 해는 parent·child와 연출 연장분(delegatedExtraMs)으로 센다 (SPEC-005 TM1·TM5)
    return { ...emptyCounts(), quiet: sum.q, narrative: sum.n, resolved: sum.r, choice: sum.cSelf, parent: sum.cParent, child: sum.cChild, death: 1, extraLines: sum.extraLines, delegatedExtraMs: sum.delegatedExtraSec * 1000 };
  };
  /** 계수 1.0 기준 연출 합(초) — 계수를 바꿔 보는 계산용 */
  const holdSecAtScaleOne = (c: TickCounts): number => holdTotalMsAtScale(c, 1) / 1000;
  /** 부모님이 정한 해의 연출 연장분(초) — 카드 읽기 필요량이 기본 대기보다 긴 몫이라 계수 k에 거의 묶이지 않는다(k ≤ 1.57에서 필요량에 묶임, 설계 문서 4-3절): 현재 계수의 측정값을 그대로 쓴다 */
  const extraSec = (c: TickCounts): number => c.delegatedExtraMs / 1000;
  const minutes = (c: TickCounts, k: number, r: number): number => (k * holdSecAtScaleOne(c) + extraSec(c) + c.choice * r) / 60;
  /** 연출 계수 레버의 범위 (SPEC-005 TM4, 마스터 승인 A13): 1.1 ~ 상한 1.45 — SPEC-003의 1.1~1.3을 넓혔다 */
  const K_LOW = 1.1;
  const K_HIGH = 1.45;
  /** 계수 1.1~1.45 한 칸으로 25~35분(사람 실측 허용 구간)에 닿는 읽는 시간 r(초)의 구간 = [(25분 − 1.45배 연출 − 연장) ÷ c_self, (35분 − 1.1배 연출 − 연장) ÷ c_self] */
  const coveredR = (c: TickCounts): { lo: number; hi: number } => ({
    lo: (MODE.timeMin.humanLow * 60 - K_HIGH * holdSecAtScaleOne(c) - extraSec(c)) / c.choice,
    hi: (MODE.timeMin.humanHigh * 60 - K_LOW * holdSecAtScaleOne(c) - extraSec(c)) / c.choice,
  });

  it('보정 레버의 범위: 연출 계수의 초기값(모드 표)은 1.1~1.45 안이다(SPEC-005 TM4가 상한을 1.3에서 1.45로 넓혔다 — 기준의 교체이지 약화가 아니다: 판정 구간 25~35분·시대별 25.5~34.5분은 그대로) — 모드 표의 값으로 estimatePlaySeconds와 직접 계산이 같다', () => {
    expect(MODE.holdScale).toBeGreaterThanOrEqual(K_LOW);
    expect(MODE.holdScale).toBeLessThanOrEqual(K_HIGH);
    for (const era of ERAS as readonly Era[]) {
      const c = avgCounts(era);
      const viaEstimate = estimatePlaySeconds(c, { speed: 1, skipToDecision: false }, 'short30', era) / 60;
      expect(minutes(c, MODE.holdScale, readSecFor(era)), era).toBeCloseTo(viaEstimate, 9);
    }
  });

  it('30분 모드 모델 시간(시대별 측정 평균 한 판 · 연출 계수 1.35 · 읽기 중앙)이 사람 실측 허용 구간 25~35분 안에 든다 (content-M8.md 2-6절 계산표를 확정 설정의 측정값으로)', () => {
    for (const era of ERAS as readonly Era[]) {
      const t = estimatePlaySeconds(avgCounts(era), { speed: 1, skipToDecision: false }, 'short30', era) / 60;
      expect(t, `${era}: ${t.toFixed(2)}분`).toBeGreaterThanOrEqual(MODE.timeMin.humanLow);
      expect(t, `${era}: ${t.toFixed(2)}분`).toBeLessThanOrEqual(MODE.timeMin.humanHigh);
    }
  });

  it('연출 계수 1.1~1.45가 25~35분으로 덮는 읽는 시간 r의 구간(시대별)이 중앙·높음(느린 독자)·상한 독자를 모두 덮는다 — 보정 첫 레버가 연출 계수인 이유', () => {
    for (const era of ERAS as readonly Era[]) {
      const { lo, hi } = coveredR(avgCounts(era));
      expect(hi - lo, `${era}: 덮는 폭(초)`).toBeGreaterThan(25);
      for (const level of ['median', 'high', 'upper'] as const) {
        const r = readSecFor(era, level);
        expect(r, `${era} ${level}: r ${r.toFixed(1)}초가 ${lo.toFixed(1)}~${hi.toFixed(1)}초 안`).toBeGreaterThanOrEqual(lo);
        expect(r, `${era} ${level}: r ${r.toFixed(1)}초가 ${lo.toFixed(1)}~${hi.toFixed(1)}초 안`).toBeLessThanOrEqual(hi);
      }
      // 구간의 두 끝은 정의 그대로다: 끝에서 계수가 1.45 / 1.1이면 25 / 35분이다
      expect(minutes(avgCounts(era), K_HIGH, lo)).toBeCloseTo(MODE.timeMin.humanLow, 9);
      expect(minutes(avgCounts(era), K_LOW, hi)).toBeCloseTo(MODE.timeMin.humanHigh, 9);
    }
  });

  it('알려진 한계가 사라졌다(보고, content-M8.md 6-3절 6번 (iii)): SPEC-003에서는 읽기 「낮음」(빠른 독자)이 연출 계수 상한 1.3으로도 25분에 닿지 않는 시대가 지난 세상뿐이었다 — 상한을 1.45로 넓힌 지금(SPEC-005 TM4)은 세 시대 모두 닿는다. 이 목록이 다시 비지 않으면(콘텐츠·페이싱·읽기 모델이 달라졌다) dev 로그의 보고 표를 다시 낸다', () => {
    const notCovered = (ERAS as readonly Era[]).filter((era) => readSecFor(era, 'low') < coveredR(avgCounts(era)).lo);
    expect(notCovered).toEqual([]);
  });
});

/** 계수 1.0 기준 연출 합(ms) — 계수를 바꿔 보는 계산용 */
function holdTotalMsAtScale(c: TickCounts, scale: number): number {
  return ((c.quiet) * HOLD_MS.quiet + c.narrative * HOLD_MS.narrative + (c.resolved + c.parent + c.child) * HOLD_MS.resolved + c.extraLines * LIFE_LENGTH_MODES.short30.extraLineMs) * scale;
}

describe('report:time --cands 인자 검증 (REV-003-M8-1 R-420 — NaN 후보가 조용히 돌지 않는다)', () => {
  it('soft:hard[:빈도+] 꼴을 후보로 읽고 소프트 계수는 0.3이다', () => {
    const c = parseCandidates('25:28,29:33:0.05');
    expect(c).not.toBeTypeOf('string');
    const list = c as Exclude<typeof c, string>;
    expect(list).toHaveLength(2);
    expect(list[0].pacing).toEqual({ soft: 25, softFactor: 0.3, hard: 28 });
    expect(list[0].freq).toBeUndefined();
    expect(list[1].pacing).toEqual({ soft: 29, softFactor: 0.3, hard: 33 });
    expect(list[1].freq).toEqual({ youth: 0.05, middle: 0.05, senior: 0.05 });
  });

  it('숫자가 아니거나 모자라거나 범위 밖인 값은 이유를 적은 문자열로 거절한다 (NaN·빈 칸·소수·하드 < 소프트·빈도 범위·칸 수)', () => {
    for (const bad of ['', 'a:b', '24', '24:', ':30', '24:30:x', '24.5:30', '24:30:0.6', '24:30:-0.1', '30:24', '0:30', '24:300', '24:30:0.1:5', '24:28,x:y']) {
      const r = parseCandidates(bad);
      expect(typeof r, `「${bad}」`).toBe('string');
      expect(r as string).toContain('--cands');
    }
  });
});
