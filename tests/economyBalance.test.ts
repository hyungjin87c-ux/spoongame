import { describe, expect, it } from 'vitest';
import {
  BANDS,
  CONDITION_TOLERANCE,
  END_LIMITS,
  ERA_RATIO_RANGE,
  KNOWN_GAPS,
  KNOWN_GUARD_GAPS,
  TARGETS,
  autoGuardsOf,
  bandRows,
  conditionChecks,
  conditionPasses,
  deathNetMedians,
  economySeed,
  endingGuardsOf,
  guardsOf,
  judgeConditions,
  judgeTarget,
  mean,
  measureEconomy,
  median,
  movementShares,
  percentile,
  playLife,
  samplesOfLife,
  sharePct,
  statsOfBand,
  type EconomyReport,
  type LifeOutcome,
  type Sample,
} from '../scripts/economyCheckLib';

/**
 * 경제 모델 밸런스 (SPEC-003 M5 EC7, docs/data/economy-model.md 9절): 무작위 선택 6000판 × 세 시대(= \`npm run check:economy\`와 같은 표본·같은 시드)로 잰 연령대별 순자산·부채·소득이
 *  - 지금 세상 목표(가계금융복지조사 s-030·s-031)의 허용 폭 안에 있는가  - 설계 가드(G3 수저 순서, M-2 20대 순자산<0 ≤ 60%, M-4 다가올 세상 65세 이상 순자산 중앙값 ≥ 0)를 지키는가
 *  - 지난·다가올 세상의 40대 순자산이 지금 세상 대비 목표 비율 안에 있는가
 *  - 엔딩 가드(r2, 15-4절): 사망 시점 순자산<0 비율·하한 도달 판 0%·재력 단계별 중앙값 순서·지금 세상 4·5단계 「뒤쪽」 비율 / 자동 모드 가드(40대 순자산 ≤ 수동 흉내의 1.5배, 엔딩 「앞섬」 ≤ 45%)
 *  - 60세·65세 이상 비교는 통계와 같은 정의(그 나이 이상 전체, D21)다
 * 를 확인한다. **허용 폭 밖의 항목(KNOWN_GAPS)은 마스터 확인 요청으로 보고했다** — 이 시험은 그 항목들이 보고한 것보다 나빠지지 않았음을 지키고, 나머지는 통과를 지킨다.
 * 계수·이벤트·진행 규칙을 고쳐 값이 바뀌면 이 시험이 알려 준다: \`npm run check:economy\`로 다시 재고 문서 9-3절과 이 목록을 함께 고친다.
 */

function lazy<T>(compute: () => T): () => T {
  let cache: { value: T } | null = null;
  return () => (cache ??= { value: compute() }).value;
}

const REPORT = lazy((): EconomyReport => measureEconomy(6000, 'random'));
const AUTO_REPORT = lazy((): EconomyReport => measureEconomy(2000, 'auto'));

/** 판마다의 끝을 손으로 만든다 */
const life = (parentWealth: 1 | 2 | 3 | 4 | 5, net: number, movement: LifeOutcome['movement'] = 'same', over: Partial<LifeOutcome> = {}): LifeOutcome => ({
  parentWealth,
  deathAge: 80,
  reached: true,
  net,
  minNet: Math.min(0, net),
  movement,
  ...over,
});

describe('경제 밸런스 도구 (scripts/economyCheckLib.ts): 작은 표본을 손으로 계산한 값과 견준다', () => {
  it('median·mean·percentile·sharePct', () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 3, 2])).toBe(2.5);
    expect(Number.isNaN(median([]))).toBe(true);
    expect(mean([1, 2, 3, 4])).toBe(2.5);
    expect(percentile([10, 20, 30, 40, 50], 0)).toBe(10);
    expect(percentile([10, 20, 30, 40, 50], 50)).toBe(30);
    expect(percentile([10, 20, 30, 40, 50], 100)).toBe(50);
    expect(sharePct([1, 2, 3, 4], (x) => x > 2)).toBe(50);
    expect(Number.isNaN(sharePct([], () => true))).toBe(true);
  });

  const rows = (list: Array<[age: number, net: number, debt: number, income: number]>): Sample[] => list.map(([age, net, debt, income]) => ({ age, parentWealth: 3, net, debt, income }));

  it('statsOfBand: 연령대에 든 줄만, 중앙값·평균·부채 보유 비율·부채 보유자의 부채 중앙값·순자산<0 비율·소득 중앙값', () => {
    const s = rows([
      [30, 1000, 0, 4000],
      [31, -500, 500, 3000],
      [39, 3000, 2000, 5000],
      [40, 99999, 99999, 99999], // 다른 연령대
      [29, 99999, 99999, 99999],
    ]);
    const b30 = BANDS.find((b) => b.id === 'b30')!;
    expect(bandRows(s, 30, 39)).toHaveLength(3);
    const st = statsOfBand(s, b30);
    expect(st.n).toBe(3);
    expect(st.netMedian).toBe(1000);
    expect(st.netMean).toBeCloseTo(3500 / 3, 10);
    expect(st.debtShare).toBeCloseTo((2 * 100) / 3, 10);
    expect(st.debtMedianOfHolders).toBe(1250); // (500, 2000)의 중앙값
    expect(st.netNegativeShare).toBeCloseTo(100 / 3, 10);
    expect(st.incomeMedian).toBe(4000);
  });

  it('judgeTarget: 허용 폭은 rel이면 목표의 ±비율, pp면 ±%p — 경계 포함', () => {
    const t = TARGETS.find((x) => x.id === 'net40')!; // 28,384 ±40%
    expect(t.kind).toBe('rel');
    const at = (v: number) => judgeTarget({ ...t, measure: () => v }, []);
    expect(at(28384 * 0.6).ok).toBe(true);
    expect(at(28384 * 0.6 - 1).ok).toBe(false);
    expect(at(28384 * 1.4).ok).toBe(true);
    expect(at(28384 * 1.4 + 1).ok).toBe(false);
    const d = TARGETS.find((x) => x.id === 'debt40')!; // 73.5 ±15%p
    expect(d.kind).toBe('pp');
    const dj = judgeTarget({ ...d, measure: () => 58.5 }, []);
    expect(dj.ok).toBe(true);
    expect(judgeTarget({ ...d, measure: () => 58.4 }, []).ok).toBe(false);
    expect(dj.lo).toBeCloseTo(58.5, 10);
    expect(dj.hi).toBeCloseTo(88.5, 10);
  });

  it('목표 19개: 근거(s-030·s-031)·허용 폭이 문서 9-1절 표와 같다', () => {
    expect(TARGETS).toHaveLength(19);
    expect(TARGETS.map((t) => t.id)).toEqual(['net30', 'net40', 'net50', 'net60', 'net65', 'debt30', 'debt40', 'debt50', 'debt60', 'under3', 'over10', 'dm30', 'dm40', 'dm50', 'dm60', 'inc30', 'inc40', 'inc50', 'inc60']);
    const t = (id: string) => TARGETS.find((x) => x.id === id)!;
    expect([t('net30').target, t('net40').target, t('net50').target, t('net60').target, t('net65').target]).toEqual([15585, 28384, 31685, 25000, 22100]);
    expect([t('net30').tol, t('net60').tol, t('net65').tol]).toEqual([0.4, 0.6, 0.6]);
    expect([t('debt30').target, t('debt40').target, t('debt50').target, t('debt60').target]).toEqual([69.0, 73.5, 67.0, 45.1]);
    expect([t('under3').target, t('over10').target]).toEqual([57.0, 11.8]);
    expect([t('inc30').target, t('inc40').target, t('inc50').target, t('inc60').target]).toEqual([6219, 7801, 7805, 3978]);
    for (const x of TARGETS) expect(['s-030', 's-031'].some((b) => x.basis.startsWith(b)), x.id).toBe(true);
  });

  it('D21: 60세 이상·65세 이상 비교는 통계와 같은 정의(그 나이 이상 전체)다 — 60~64세·65~79세가 아니라 80세 이상까지 센다', () => {
    const t = (id: string) => TARGETS.find((x) => x.id === id)!;
    expect(t('net60').label).toContain('60세 이상');
    expect(t('net65').label).toContain('65세 이상');
    const mk = (age: number, net: number): Sample => ({ age, parentWealth: 3, net, debt: 0, income: 0 });
    // 60~64세만 센다면 중앙값 1000, 60세 이상 전체를 센다면 중앙값 100
    const rows = [mk(60, 1000), mk(62, 1000), mk(64, 1000), mk(70, 100), mk(80, 100), mk(90, 100), mk(95, 0)];
    expect(t('net60').measure(rows)).toBe(100);
    expect(t('net65').measure(rows)).toBe(100);
    expect(t('net65').measure([mk(64, 5000), mk(65, 10), mk(66, 20), mk(90, 30)])).toBe(20);
    // 참고 연령대 표(60~64, 65~79)는 그대로 남는다
    expect(BANDS.map((b) => b.label)).toEqual(expect.arrayContaining(['60~64', '65~79', '80 이상']));
  });

  it('playLife: 한 판의 끝 — 사망 시점 순자산·평생 가장 낮은 순자산·스무 살 넘어 마쳤는가·엔딩 방향 · 같은 시드는 같은 값', () => {
    const a = playLife(economySeed(5), 'present', 'random');
    expect(a.outcome.reached).toBe(a.outcome.deathAge >= 20);
    expect(a.outcome.minNet).toBeLessThanOrEqual(a.outcome.net);
    expect(a.outcome.movement === null).toBe(!a.outcome.reached);
    expect(a.samples.length).toBeGreaterThan(0);
    expect(playLife(economySeed(5), 'present', 'random')).toEqual(a);
    expect(a.samples).toEqual(samplesOfLife(economySeed(5), 'present', 'random'));
  });

  it("지금 세상 end-g3는 더 이상 알려진 차이가 아니다 (SPEC-005 QI5가 1·2단계 0 = 0 동률을 0 < 971로 되돌려 KNOWN_GUARD_GAPS에서 뺐다): 엄격한 순서만 통과이고, 어느 인접 단계의 동률·뒤집힘도 통과시키지 않는다 (REV-003-M8-1 R-419의 한계 시험을 이 뜻으로 옮김)", () => {
    expect(KNOWN_GUARD_GAPS['present:end-g3'], '목록에서 뺐다 — 다시 동률이 되면 마스터 보고와 함께 다시 올린다').toBeUndefined();
    const guardFor = (nets: number[]) => Object.fromEntries(endingGuardsOf('present', nets.map((n, i) => life((i + 1) as 1, n))).map((x) => [x.id, x]))['end-g3'];
    const passes = (nets: number[]) => guardFor(nets).ok;
    expect(guardFor([0, 0, 5, 9, 30]).parts).toEqual([0, 5, 4, 21]);
    expect(passes([0, 616, 1000, 2000, 5000]), '엄격한 순서').toBe(true);
    expect(passes([0, 971, 37360, 124518, 184411]), 'QI5 직후 지금 세상의 실제 값').toBe(true);
    expect(passes([0, 0, 5, 9, 30]), '1·2단계 동률 (옛 알려진 차이였던 것 — 이제는 어긋남)').toBe(false);
    expect(passes([0, 5, 5, 9, 30]), '2·3단계 동률').toBe(false);
    expect(passes([0, 5, 9, 9, 30]), '3·4단계 동률').toBe(false);
    expect(passes([0, 5, 9, 30, 30]), '4·5단계 동률').toBe(false);
    expect(passes([5, 0, 9, 20, 30]), '1·2단계 뒤집힘').toBe(false);
    expect(passes([0, 0, 0, 9, 30]), '1·2·3단계가 모두 같다').toBe(false);
  });

  it('엔딩 가드 도구: deathNetMedians·movementShares·endingGuardsOf를 손으로 만든 판으로 점검한다', () => {
    const lives = [life(1, -100), life(1, 0), life(1, 100), life(2, 500), life(3, 1000), life(4, 5000, 'down'), life(5, 9000, 'down'), life(5, 8000, 'up'), life(5, 7000, 'down', { reached: false, movement: null })];
    expect(deathNetMedians(lives)).toEqual([0, 500, 1000, 5000, 8500]);
    const sh = movementShares(lives);
    expect(sh.down).toBeCloseTo((2 * 100) / 8, 10); // 스무 살 전에 마친 판은 세지 않는다
    expect(sh.up).toBeCloseTo(100 / 8, 10);
    const g = (era: 'past' | 'present' | 'future') => Object.fromEntries(endingGuardsOf(era, lives).map((x) => [x.id, x]));
    expect(g('present')['end-negative'].ok).toBe(true); // 1/8 = 12.5%
    expect(g('present')['end-floor'].ok).toBe(true);
    expect(g('present')['end-g3'].ok).toBe(true);
    expect(g('present')['end-down4'].ok).toBe(false); // 4단계 1판 중 1판이 뒤쪽 = 100%
    expect(g('present')['end-down4'].reference).toBe(false);
    expect(g('past')['end-down4'].reference).toBe(true); // 엔딩 방향은 지금 세상만 판정
    expect(g('present')['end-down5'].ok).toBe(true); // 5단계 2판 중 1판 = 50%
    // 위반을 잡는다: 하한(-20억)에 닿은 판 · 중앙값이 같은 두 단계 · 음수 비율
    const floorHit = [...lives, life(1, -150000, 'same', { minNet: -200000 })];
    expect(Object.fromEntries(endingGuardsOf('present', floorHit).map((x) => [x.id, x]))['end-floor'].ok).toBe(false);
    const tie = [life(1, 0), life(2, 0), life(3, 1), life(4, 2), life(5, 3)];
    expect(Object.fromEntries(endingGuardsOf('present', tie).map((x) => [x.id, x]))['end-g3'].ok).toBe(false);
    const negs = Array.from({ length: 10 }, (_, i) => life(((i % 5) + 1) as 1, i < 4 ? -1 : 1));
    const negGuard = (era: 'past' | 'present' | 'future') => Object.fromEntries(endingGuardsOf(era, negs).map((x) => [x.id, x]))['end-negative'];
    expect(negGuard('present').ok).toBe(false); // 40% > 25%
    expect(negGuard('future').ok).toBe(false); // 40% > 35%
    expect(END_LIMITS.negativeShare).toEqual({ past: 25, present: 25, future: 35 });
  });

  it('자동 모드 가드 도구: 40대 순자산 중앙값 비 ≤ 1.5배 · 엔딩 「앞섬」 ≤ 45%', () => {
    const rows = (net: number): Sample[] => Array.from({ length: 30 }, (_, i) => ({ age: 40 + (i % 10), parentWealth: 3, net, debt: 0, income: 0 }));
    const lives = (ups: number, n = 20): LifeOutcome[] => Array.from({ length: n }, (_, i) => life(3, 1000, i < ups ? 'up' : 'same'));
    const manual = { rows: rows(1000), lives: lives(0) };
    const ok = autoGuardsOf(manual, { rows: rows(1500), lives: lives(9) });
    expect(ok.map((g) => g.ok)).toEqual([true, true]); // 1.5배, 45%는 경계 포함
    const bad = autoGuardsOf(manual, { rows: rows(1501), lives: lives(10) });
    expect(bad.map((g) => g.ok)).toEqual([false, false]);
    expect(END_LIMITS.autoNet40Ratio).toBe(1.5);
    expect(END_LIMITS.autoUpShare).toBe(45);
  });

  it('조건 통과율 도구(R-354): conditionPasses·judgeConditions를 손으로 만든 표본으로 점검한다 — 허용 폭은 옛 통과율의 ±15%(100% 상한), 수용한 곳은 판정하지 않는다', () => {
    expect(CONDITION_TOLERANCE).toBe(0.15);
    expect(conditionPasses({ netMin: 0 }, 0)).toBe(true);
    expect(conditionPasses({ netMin: 0 }, -1)).toBe(false);
    expect(conditionPasses({ netMax: -1500 }, -1500)).toBe(true);
    expect(conditionPasses({ netMax: -1500 }, -1499)).toBe(false);
    expect(conditionPasses({}, 123)).toBe(true);
    // 100줄 중 순자산 ≥ 1,000인 줄이 60개: 옛 통과율 66%의 허용 폭 56.1~75.9% 안
    const sample: Sample[] = Array.from({ length: 100 }, (_, i) => ({ age: 74, parentWealth: 3 as const, net: i < 60 ? 2000 : 0, debt: 0, income: 0 }));
    sample.push({ age: 30, parentWealth: 3, net: -999, debt: 999, income: 0 }); // 다른 나이는 센 줄이 아니다
    const checks = [
      { id: 'a', where: 'a', age: 74, oldRate: 66, condition: { netMin: 1000 } },
      { id: 'b', where: 'b', age: 74, oldRate: 90, condition: { netMin: 1000 } }, // 60%는 90%의 허용 폭(76.5~100%) 밖
      { id: 'c', where: 'c', age: 74, oldRate: 90, condition: { netMin: 1000 }, accepted: '문구 우선' }, // 수용한 곳은 판정하지 않는다
    ];
    const r = judgeConditions(sample, checks);
    expect(r.map((x) => x.rate)).toEqual([60, 60, 60]);
    expect(r.map((x) => x.n)).toEqual([100, 100, 100]);
    expect(r.map((x) => x.ok)).toEqual([true, false, true]);
    expect(r[0].lo).toBeCloseTo(56.1, 6);
    expect(r[0].hi).toBeCloseTo(75.9, 6);
    expect(r[1].hi).toBe(100); // 상한은 100%
    expect(r.map((x) => x.known)).toEqual([false, false, false]);
  });

  it('조건 통과율 도구: 보고한 차이(reported)는 허용 폭 밖이어도 보고한 한계 안이면 통과로 세고(known), 한계를 넘으면 불합격이다 (M7a)', () => {
    const sample: Sample[] = Array.from({ length: 100 }, (_, i) => ({ age: 74, parentWealth: 3 as const, net: i < 60 ? 2000 : 0, debt: 0, income: 0 }));
    const base = { id: 'b', where: 'b', age: 74, oldRate: 90, condition: { netMin: 1000 } }; // 60%는 90%의 허용 폭(76.5~100%) 밖
    const within = judgeConditions(sample, [{ ...base, reported: { limit: (rate: number) => rate >= 55, why: '보고함' } }])[0];
    expect(within.ok).toBe(true);
    expect(within.known).toBe(true);
    const beyond = judgeConditions(sample, [{ ...base, reported: { limit: (rate: number) => rate >= 65, why: '보고함' } }])[0];
    expect(beyond.ok).toBe(false);
    expect(beyond.known).toBe(false);
    // 허용 폭 안이면 reported가 있어도 known이 아니다(그 필드를 지운다)
    const inRange = judgeConditions(sample, [{ ...base, oldRate: 66, reported: { limit: () => true, why: '보고함' } }])[0];
    expect(inRange.ok).toBe(true);
    expect(inRange.known).toBe(false);
  });

  it('조건 7곳이 이벤트 데이터에서 읽힌다: 위치·나이·옛 통과율이 문서 5-A 표와 같다', () => {
    const checks = conditionChecks();
    expect(checks).toHaveLength(7);
    expect(checks.map((c) => [c.id, c.age, c.oldRate])).toEqual([
      ['senior-estate', 74, 66],
      ['youth-return-school', 29, 97],
      ['middle-child-school/fund', 57, 85],
      ['middle-layoff/open', 51, 91],
      ['middle-parents-care/facility', 55, 17],
      ['senior-retire(netMin)', 67, 30],
      ['senior-retire(netMax)', 67, 15],
    ]);
    expect(checks.find((c) => c.id === 'youth-return-school')!.accepted).toMatch(/R-355/);
    expect(checks.filter((c) => c.accepted !== undefined)).toHaveLength(1);
    // M7a r2까지는 senior-retire(netMax)가 보고한 차이였으나 r3(AGE 1.71)에서 허용 폭(12.8~17.3%) 안(16.5%)으로 돌아와 보고를 뺐다. M7e-3(E-4)는 순자산 상승으로 middle-parents-care/facility(21.4%, 허용 14.4~19.5%)를 새로 보고했다(economy-model.md 9-8절) — 보고 장치(reported)는 합성 시험도 계속 지킨다
    expect(checks.filter((c) => c.reported !== undefined).map((c) => c.id)).toEqual(['middle-parents-care/facility']);
  });

  it('samplesOfLife: 20세부터 해마다 한 줄, 나이가 1씩 늘고 불변식(부채 ≥ −순자산, 소득 ≥ 0)을 지킨다 · 같은 시드는 같은 줄', () => {
    const a = samplesOfLife(economySeed(3), 'present', 'random');
    expect(a.length).toBeGreaterThan(30);
    expect(a[0].age).toBe(20);
    a.forEach((r, i) => {
      if (i > 0) expect(r.age).toBe(a[i - 1].age + 1);
      expect(r.debt).toBeGreaterThanOrEqual(Math.max(0, -r.net));
      expect(r.income).toBeGreaterThanOrEqual(0);
    });
    expect(samplesOfLife(economySeed(3), 'present', 'random')).toEqual(a);
    expect(samplesOfLife(economySeed(4), 'present', 'random')).not.toEqual(a);
  });

  it('가드: M-2는 지금 세상만 판정하고 다른 시대는 참고(reference)다 · M-4는 다가올 세상에만 있다', () => {
    const lowAll: Sample[] = Array.from({ length: 200 }, (_, i) => ({ age: 20 + (i % 10), parentWealth: ((i % 5) + 1) as 1, net: -100, debt: 100, income: 100 }));
    const g = (era: 'past' | 'present' | 'future') => guardsOf(era, lowAll);
    const m2 = (era: 'past' | 'present' | 'future') => g(era).find((x) => x.id === 'm2-young')!;
    expect(m2('present').ok).toBe(false);
    expect(m2('present').reference).toBeFalsy();
    expect(m2('past').ok).toBe(false);
    expect(m2('past').reference).toBe(true);
    expect(g('present').some((x) => x.id === 'm4-future65')).toBe(false);
    expect(g('future').some((x) => x.id === 'm4-future65')).toBe(true);
  });
});

describe('경제 밸런스 측정 (무작위 선택 6000판 × 3시대, 시드 고정 — npm run check:economy와 같은 값)', () => {
  it('표본이 충분하다: 시대마다 20세 이상 줄이 30만 개를 넘고 연령대마다 1만 줄을 넘는다', () => {
    const r = REPORT();
    for (const era of ['past', 'present', 'future'] as const) {
      expect(r.rows[era].length, era).toBeGreaterThan(300_000);
      for (const b of BANDS) expect(bandRows(r.rows[era], b.from, b.to).length, `${era} ${b.label}`).toBeGreaterThan(10_000);
    }
  }, 180_000);

  it('지금 세상 목표 19개: 허용 폭 밖의 보고된 항목(KNOWN_GAPS)을 빼면 모두 허용 폭 안이다', () => {
    const bad = REPORT().targets.filter((t) => !t.ok && KNOWN_GAPS[t.target.id] === undefined);
    expect(bad.map((t) => `${t.target.label} ${t.value.toFixed(1)} (허용 ${t.lo.toFixed(1)}~${t.hi.toFixed(1)})`)).toEqual([]);
  }, 180_000);

  it('보고한 항목은 보고한 값보다 나빠지지 않았고(KNOWN_GAPS), 지금도 허용 폭 밖이다 — 허용 폭 안으로 들어오면 이 목록에서 뺀다', () => {
    const r = REPORT();
    for (const [id, gap] of Object.entries(KNOWN_GAPS)) {
      const t = r.targets.find((x) => x.target.id === id)!;
      expect(gap.limit(t.value), `${gap.why}: 지금 ${t.value.toFixed(0)}`).toBe(true);
      expect(t.ok, `${id}가 허용 폭 안으로 들어왔다 — KNOWN_GAPS에서 빼고 문서 9-3절을 고친다`).toBe(false);
    }
  }, 180_000);

  it('설계 가드: G3(재력 5단계 대 1단계 40대 순자산 ≥ 4배 · 1단계 50대 > 0 · 5단계 60대 순자산<0 < 15%)는 세 시대 모두, M-2(20대 순자산<0 ≤ 60%)는 지금 세상, M-4(다가올 세상 65세 이상 중앙값 ≥ 0)는 다가올 세상 — 보고한 가드 차이(KNOWN_GUARD_GAPS)를 빼면 모두 통과', () => {
    const r = REPORT();
    for (const era of ['past', 'present', 'future'] as const) {
      const judged = r.guards[era].filter((g) => g.reference !== true);
      expect(judged.length, era).toBeGreaterThanOrEqual(3);
      expect(judged.filter((g) => !g.ok && KNOWN_GUARD_GAPS[`${era}:${g.id}`] === undefined).map((g) => `${g.label}: ${g.value}`), era).toEqual([]);
    }
    expect(r.guards.present.find((g) => g.id === 'm2-young')!.ok).toBe(true);
    expect(r.guards.future.find((g) => g.id === 'm4-future65')!.ok).toBe(true);
  }, 180_000);

  it('G3 방향: 부모 재력이 높을수록 40대 순자산 중앙값이 단계마다 커진다 (세 시대, 1<2<3<4<5)', () => {
    const r = REPORT();
    for (const era of ['past', 'present', 'future'] as const) {
      const m = [1, 2, 3, 4, 5].map((w) => median(bandRows(r.rows[era].filter((x) => x.parentWealth === w), 40, 49).map((x) => x.net)));
      for (let i = 1; i < 5; i++) {
        // 지난 세상 5단계는 전체의 약 1%(6000판 중 약 60판)라 40대 중앙값의 표본 잡음이 ±10%다(KNOWN_GUARD_GAPS past:g3-ratio) — 4단계와 5단계의 차가 잡음 안(5% 이내)이면 순서가 뒤집힌 것으로 세지 않는다. 다른 단계·시대는 엄격하다.
        const noise = era === 'past' && i === 4 ? 0.95 : 1;
        expect(m[i], `${era} ${i + 1}단계`).toBeGreaterThan(m[i - 1] * noise);
      }
    }
  }, 180_000);

  it('R-354: 옛 재산 조건 7곳을 최종 모델로 같은 나이에서 재니 통과율이 옛 통과율의 ±15% 안이다 (youth-return-school은 R-355로 문구를 우선해 수용 — 옛 97% → netMin 0의 통과율)', () => {
    const results = judgeConditions(REPORT().rows.present);
    for (const r of results) expect(r.n, `${r.check.where} ${r.check.age}세 표본 줄`).toBeGreaterThan(3000);
    const out = results.filter((r) => !r.ok).map((r) => `${r.check.where} ${r.check.age}세: 지금 ${r.rate.toFixed(1)}% (옛 ${r.check.oldRate}%, 허용 ${r.lo.toFixed(1)}~${r.hi.toFixed(1)}%)`);
    expect(out, '같은 통과율에서 벗어난 조건 (값을 다시 정하거나 마스터 수용을 기록한다)').toEqual([]);
    // 수용한 한 곳: 문구에 맞춘 netMin 0은 옛 97%와 크게 다르다(약 58%) — 이유는 문서 5-A, 값이 더 벗어나면 알려 준다
    const ret = results.find((r) => r.check.id === 'youth-return-school')!;
    expect(ret.check.condition).toEqual({ netMin: 0 });
    expect(ret.rate).toBeGreaterThan(45);
    expect(ret.rate).toBeLessThan(70);
  });

  it('지난·다가올 세상의 40대 순자산 중앙값이 지금 세상 대비 목표 비율 안이다 (지난 0.5~0.9배, 다가올 0.3~0.9배)', () => {
    const r = REPORT();
    expect(ERA_RATIO_RANGE).toEqual({ past: [0.5, 0.9], future: [0.3, 0.9] });
    for (const x of r.ratios) expect(x.ok, `${x.era} ${x.ratio.toFixed(2)}배 (목표 ${x.lo}~${x.hi})`).toBe(true);
  }, 180_000);

  it('엔딩 가드 (15-4절): 순자산 하한(-20억)에 닿은 판 0% · 재력 단계별 사망 시점 순자산 중앙값 1 < 2 < 3 < 4 < 5 (세 시대, 엄격) · 지금 세상 4단계 「뒤쪽」 ≤ 50%, 5단계 ≤ 70%', () => {
    const r = REPORT();
    for (const era of ['past', 'present', 'future'] as const) {
      const g = (id: string) => r.guards[era].find((x) => x.id === id)!;
      expect(g('end-floor').ok, `${era} 하한 ${g('end-floor').value}`).toBe(true);
      expect(g('end-floor').metric, era).toBe(0);
      // 보고한 차이(KNOWN_GUARD_GAPS)는 보고한 한계 안이어야 한다 — 다가올 세상의 2단계·3단계 중앙값이 같은 0이라 엄격한 순서는 어긋난다(M7a 재보정, economy-model.md 9-7절). 거꾸로 가는 단계는 없다.
      const gap = KNOWN_GUARD_GAPS[`${era}:end-g3`];
      if (gap === undefined) {
        expect(g('end-g3').ok, `${era} ${g('end-g3').value}`).toBe(true);
        const med = deathNetMedians(r.lives[era]);
        for (let i = 1; i < 5; i++) expect(med[i], `${era} ${i + 1}단계`).toBeGreaterThan(med[i - 1]);
      } else {
        expect(g('end-g3').ok, `${era}가 통과했다 — KNOWN_GUARD_GAPS에서 뺀다`).toBe(false);
        expect(gap.limit(g('end-g3').metric, g('end-g3')), `${gap.why}: 지금 ${g('end-g3').value}`).toBe(true);
      }
    }
    const present = (id: string) => r.guards.present.find((x) => x.id === id)!;
    const down4 = KNOWN_GUARD_GAPS['present:end-down4'];
    if (down4 === undefined) expect(present('end-down4').ok, `지금 세상 4단계 뒤쪽 ${present('end-down4').value}`).toBe(true);
    else {
      expect(present('end-down4').ok, '지금 세상 4단계 뒤쪽이 통과했다 — KNOWN_GUARD_GAPS에서 뺀다').toBe(false);
      expect(down4.limit(present('end-down4').metric), `${down4.why}: 지금 ${present('end-down4').value}`).toBe(true);
    }
    const down5 = KNOWN_GUARD_GAPS['present:end-down5'];
    if (down5 === undefined) expect(present('end-down5').ok, `지금 세상 5단계 뒤쪽 ${present('end-down5').value}`).toBe(true);
    else {
      expect(present('end-down5').ok, '지금 세상 5단계 뒤쪽이 통과했다 — KNOWN_GUARD_GAPS에서 뺀다').toBe(false);
      expect(down5.limit(present('end-down5').metric), `${down5.why}: 지금 ${present('end-down5').value}`).toBe(true);
    }
    expect(present('end-down4').reference).toBeFalsy();
  }, 180_000);

  it('사망 시점 순자산<0 비율 (15-4절: 지난·지금 ≤ 25%, 다가올 ≤ 35%): 보고한 차이(KNOWN_GUARD_GAPS)는 보고한 한계 안이고 아직 어긋나 있다 — 한계 안으로 들어오면 목록에서 뺀다', () => {
    const r = REPORT();
    for (const era of ['past', 'present', 'future'] as const) {
      const g = r.guards[era].find((x) => x.id === 'end-negative')!;
      const gap = KNOWN_GUARD_GAPS[`${era}:end-negative`];
      if (g.ok) expect(gap, `${era}가 통과했다 — KNOWN_GUARD_GAPS에서 빼고 문서 9-3절을 고친다`).toBeUndefined();
      else {
        expect(gap, `${era} ${g.value}: 보고하지 않은 차이`).toBeDefined();
        expect(gap.limit(g.metric), `${gap.why}: 지금 ${g.value}`).toBe(true);
      }
    }
    for (const [key, gap] of Object.entries(KNOWN_GUARD_GAPS)) {
      const [era, id] = key.split(':') as ['past' | 'present' | 'future', string];
      const g = r.guards[era].find((x) => x.id === id)!;
      expect(g.ok, `${key}가 통과했다 — KNOWN_GUARD_GAPS에서 뺀다`).toBe(false);
      expect(gap.limit(g.metric, g), `${gap.why}: 지금 ${g.value}`).toBe(true);
    }
  }, 180_000);

  it('자동 모드 가드 (15-4절, EC6 우선): 자동 2000판 × 세 시대의 40대 순자산 중앙값이 수동 흉내의 1.5배 이하이고 엔딩 「앞섬」이 45% 이하다', () => {
    const manual = REPORT();
    const auto = AUTO_REPORT();
    for (const era of ['past', 'present', 'future'] as const) {
      const gs = autoGuardsOf({ rows: manual.rows[era], lives: manual.lives[era] }, { rows: auto.rows[era], lives: auto.lives[era] });
      expect(gs.filter((g) => !g.ok).map((g) => `${g.label}: ${g.value}`), era).toEqual([]);
      expect(movementShares(auto.lives[era]).up, era).toBeLessThanOrEqual(45);
    }
  }, 240_000);
});
