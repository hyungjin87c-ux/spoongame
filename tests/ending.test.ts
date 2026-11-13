import { describe, expect, it } from 'vitest';
import endingSrc from '../src/core/ending.ts?raw';
import {
  COMPARABLE_STATS,
  DEFAULT_GENERATION,
  DEFAULT_SETTINGS,
  GENERATION_IDS,
  R1_PRESENT,
  STAGES,
  bandFromRange,
  buildTimeline,
  createInitialState,
  enterLife,
  parseGame,
  playToEnd,
  reachedIndependence,
  rebirth,
  reviewEnding,
  serializeGame,
  sessionReducer,
  createSession,
  beginBirth,
  enterBirth,
  stageOf,
  stageRangeOf,
  startBandOf,
  wealthMixtureOfProfile,
  wealthStanding,
  type ProfileId,
  type EndingGame,
  type GameState,
  type HistoryEntry,
  type ParentWealth,
} from '../src/core';
import { REBIRTH_LABEL, REBIRTH_NOTE, bandLabel, choiceCountText, deathLineText, stageHeadingText } from '../src/data/endingText';
import { STAGE_TABLE } from '../src/data/lifeTable';
import reference from './fixtures/gm3-mixture-reference.json';
import { standingLabel } from '../src/data/birthText';
import { SIM_PROFILES, chooserFor, startLife } from '../scripts/simulateLib';
import { numbersIn, readBand } from '../scripts/endingReadback';

/**
 * 엔딩 회고 (SPEC-001 M5). 계산(자리·방향·연표 묶기)은 core/ending.ts의 순수 함수, 문구는 data/endingText.ts.
 * 화면 렌더는 tests/endingScreen.test.tsx, 실제 브라우저 동작은 e2e/ending.spec.ts.
 */

/**
 * 가중치 표 세 벌 — SPEC-003 R1의 지난·지금·다가올 세상 표. 구간·문구 함수(`startBandOf`·`wealthStanding`·`bandLabel`)는 표(가중치 배열)를 받으므로 이 표 세 벌로 함수 자체를 시험한다(독립 계산의 15개 구간).
 * 세대 판이 쓰는 표(세대 섞음 비율)는 「세대 판」 시험이 따로 본다.
 */
type TableKey = 'past' | 'present' | 'future';
const TABLE_KEYS: readonly TableKey[] = ['past', 'present', 'future'];
const WEIGHTS: Record<TableKey, readonly number[]> = { past: [40, 32, 20, 7, 1], present: [25, 30, 28, 14, 3], future: [30, 28, 24, 13, 5] };
/** 세대 7종의 수저 섞음 비율(%, 정수) — 시안 생성기가 낸 독립 기준값 */
const MIX_REF = (reference as unknown as { gens: Record<string, { wealth: number[] }> }).gens;

function lazy<T>(compute: () => T): () => T {
  let cache: { value: T } | null = null;
  return () => (cache ??= { value: compute() }).value;
}

const EMOJI = /\p{Extended_Pictographic}/u;
const GRADE_NAMES = /(흙|동|은|금|다이아)\s*수저|다이아/;

const endingOf = (seed: number, era: ProfileId, strategy: 'auto' | 'random' = 'random'): EndingGame => {
  const f = playToEnd(startLife(seed, era), chooserFor(strategy, seed)).state;
  return f as EndingGame;
};

describe('core 순수성: 엔딩 계산에 React·타이머·Date·Math.random이 없다', () => {
  it('core/ending.ts (주석 제외)', () => {
    const src = endingSrc.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    expect(src.length).toBeGreaterThan(1000);
    expect(src).not.toMatch(/Math\.random|Date\.now|new Date|performance\.now|setTimeout|setInterval|from 'react'|document\.|window\./);
  });
});

/** 세 시대 × 5단계의 출발선 구간: 가중치 표(birthTable.ts)에서 손으로 계산 — 구간 = [이 단계 아래 누적 %, 이 단계까지 누적 %] (아래에서부터 센 백분위). 마지막은 엔딩에 나오는 문구. */
const BANDS: Record<TableKey, ReadonlyArray<readonly [low: number, high: number, label: string]>> = {
  past: [
    // 가중치 40·32·20·7·1
    [0, 40, '하위 40% 안쪽'],
    [40, 72, '하위 40% 선과 상위 28% 선 사이'],
    [72, 92, '상위 8~28% 사이'],
    [92, 99, '상위 1~8% 사이'],
    [99, 100, '상위 1% 안쪽'],
  ],
  present: [
    // 25·30·28·14·3
    [0, 25, '하위 25% 안쪽'],
    [25, 55, '하위 25% 선과 상위 45% 선 사이'],
    [55, 83, '상위 17~45% 사이'],
    [83, 97, '상위 3~17% 사이'],
    [97, 100, '상위 3% 안쪽'],
  ],
  future: [
    // 30·28·24·13·5
    [0, 30, '하위 30% 안쪽'],
    [30, 58, '하위 30% 선과 상위 42% 선 사이'],
    [58, 82, '상위 18~42% 사이'],
    [82, 95, '상위 5~18% 사이'],
    [95, 100, '상위 5% 안쪽'],
  ],
};

describe('출발선 구간 (startBandOf·bandLabel, R-091): 재력 단계의 구간을 가중치 표에서 계산해 문장에 담는다', () => {
  it('세 시대 × 5단계: 구간의 끝값과 문구가 가중치 표에서 직접 계산한 값과 같다 (지난 세상 1단계 "하위 40% 안쪽", 지금 세상 2단계 "하위 25% 선과 상위 45% 선 사이")', () => {
    for (const era of TABLE_KEYS) {
      expect(WEIGHTS[era].reduce((a, b) => a + b, 0), `${era} 가중치 합`).toBe(100); // 위 계산이 성립하는 전제
      for (let w = 1; w <= 5; w++) {
        const [low, high, label] = BANDS[era][w - 1];
        const band = startBandOf(WEIGHTS[era], w as ParentWealth);
        expect([band.low, band.high], `${era} ${w}단계 구간`).toEqual([low, high]);
        expect(bandLabel(band), `${era} ${w}단계 문구`).toBe(label);
      }
    }
  });

  it('구간은 빈틈없이 이어진다: 1단계는 0에서 시작하고 한 단계의 위쪽 끝이 다음 단계의 아래쪽 끝이며 5단계는 100에서 끝난다 (출생아 전체를 덮는다)', () => {
    for (const era of TABLE_KEYS) {
      expect(startBandOf(WEIGHTS[era], 1).low, era).toBe(0);
      expect(startBandOf(WEIGHTS[era], 5).high, era).toBe(100);
      for (let w = 1; w < 5; w++) expect(startBandOf(WEIGHTS[era], w as ParentWealth).high, `${era} ${w}→${w + 1}`).toBe(startBandOf(WEIGHTS[era], (w + 1) as ParentWealth).low);
    }
  });

  it('세대 판: 출발선 구간은 세대 섞음 비율(독립 기준값 `gm3-mixture-reference.json`)의 누적이고, 문구에서 다시 읽은 구간과 같다 — 7세대 × 5단계 (D4-48)', () => {
    for (const g of GENERATION_IDS) {
      const w = MIX_REF[g].wealth;
      expect(wealthMixtureOfProfile(g), g).toEqual(w);
      let acc = 0;
      for (let tier = 1; tier <= 5; tier++) {
        const band = startBandOf(wealthMixtureOfProfile(g), tier as ParentWealth);
        expect([band.low, band.high], `${g} ${tier}단계`).toEqual([acc, acc + w[tier - 1]]);
        expect(readBand(bandLabel(band)), `${g} ${tier}단계 문구`).toEqual([acc, acc + w[tier - 1]]);
        acc += w[tier - 1];
      }
      expect(acc, g).toBe(100);
    }
  });

  it('출생 결과 화면의 문구는 그대로고 이 구간의 한쪽 끝값이다: 퍼센트가 구간 문구 안에 들어 있다 (중앙에 걸친 단계는 출생 화면도 "가운데쯤")', () => {
    for (const era of TABLE_KEYS) {
      for (let w = 1; w <= 5; w++) {
        const s = wealthStanding(WEIGHTS[era], w as ParentWealth);
        const band = startBandOf(WEIGHTS[era], w as ParentWealth);
        if (s.kind === 'middle') {
          expect(band.kind, `${era} ${w}단계 (출생 화면 "가운데쯤")`).toBe('center');
          continue;
        }
        expect(numbersIn(bandLabel(band)), `${era} ${w}단계 ${standingLabel(s)}`).toContain(s.percent);
      }
    }
    expect(standingLabel(wealthStanding(WEIGHTS.past, 1))).toBe('하위 약 40%');
    expect(standingLabel(wealthStanding(WEIGHTS.present, 3))).toBe('상위 약 45%');
    expect(standingLabel(wealthStanding(WEIGHTS.present, 2))).toBe('가운데쯤');
  });

  it('구간의 모양(bandFromRange): 맨 아래/맨 위/한쪽 절반/50%를 걸침/한쪽에 붙었지만 반대편이 50%를 넘음/전체', () => {
    const label = (low: number, high: number) => bandLabel(bandFromRange(low, high));
    expect(bandFromRange(0, 40)).toEqual({ low: 0, high: 40, kind: 'bottom', percent: 40 });
    expect(bandFromRange(97, 100)).toEqual({ low: 97, high: 100, kind: 'top', percent: 3 });
    expect(bandFromRange(55, 83)).toEqual({ low: 55, high: 83, kind: 'upper', from: 17, to: 45 });
    expect(bandFromRange(10, 30)).toEqual({ low: 10, high: 30, kind: 'lower', from: 10, to: 30 });
    expect(bandFromRange(25, 55)).toEqual({ low: 25, high: 55, kind: 'center', bottom: 25, top: 45 });
    expect(label(0, 50)).toBe('하위 50% 안쪽'); // 50까지는 그대로 말한다
    expect(label(50, 100)).toBe('상위 50% 안쪽');
    expect(label(0, 70)).toBe('상위 30% 밖'); // 한쪽에 붙었지만 70%라 "하위 70%"라고 말하지 않는다 (R-018: 퍼센트는 50 이하)
    expect(label(30, 100)).toBe('하위 30% 밖');
    expect(label(50, 70)).toBe('상위 30~50% 사이');
    expect(label(30, 50)).toBe('하위 30~50% 사이');
    expect(label(20, 80)).toBe('하위 20% 선과 상위 20% 선 사이');
    expect(label(0, 100)).toBe('모두가 같은 자리');
    // 폭이 0이거나 1% 안쪽으로 줄어도 "약 0%"·"0~"가 나오지 않는다
    expect(label(0, 0)).toBe('하위 1% 안쪽');
    expect(label(100, 100)).toBe('상위 1% 안쪽');
    expect(label(40, 40)).toBe('하위 약 40%');
    expect(label(60, 60)).toBe('상위 약 40%');
  });

  it('1% 안쪽으로 올려 말하는 구간은 판정에 쓰는 끝값도 같은 값이다 (R-096): [0, 0] → 0~1, [100, 100] → 99~100. 그 밖의 구간은 넘긴 값 그대로', () => {
    // 올려 말하기 전에는 화면이 "하위 1% 안쪽"(0~1)이라 하면서 판정은 0~0을 썼다 — 화면 숫자 ≠ 판정 숫자
    expect(bandFromRange(0, 0)).toEqual({ low: 0, high: 1, kind: 'bottom', percent: 1 });
    expect(bandFromRange(100, 100)).toEqual({ low: 99, high: 100, kind: 'top', percent: 1 });
    // 올려 말하지 않는 가장자리 구간은 그대로다: [0, 1]·[99, 100]은 이미 1%, [0, 2]·[98, 100]도 그대로
    expect(bandFromRange(0, 1)).toEqual({ low: 0, high: 1, kind: 'bottom', percent: 1 });
    expect(bandFromRange(99, 100)).toEqual({ low: 99, high: 100, kind: 'top', percent: 1 });
    expect(bandFromRange(0, 2)).toEqual({ low: 0, high: 2, kind: 'bottom', percent: 2 });
    expect(bandFromRange(98, 100)).toEqual({ low: 98, high: 100, kind: 'top', percent: 2 });
    // (올려 말한 구간에서의 이동 방향 점검은 movementOf 삭제와 함께 걷었다 — 결정 후속 256. 구간 끝값이 문구와 같다는 것은 위와 아래 전수 시험이 지킨다)
  });

  it('가능한 모든 구간(5151가지): 문구에서 읽은 구간 = 판정에 쓰는 band (R-096). 읽은 구간은 넘긴 구간과 같고, 다른 것은 1% 안쪽으로 올려 말한 [0, 0]·[100, 100]뿐이다', () => {
    let n = 0;
    const wrong: string[] = [];
    const raised: string[] = [];
    for (let low = 0; low <= 100; low++) {
      for (let high = low; high <= 100; high++) {
        const band = bandFromRange(low, high);
        const label = bandLabel(band);
        n++;
        let read: [number, number];
        try {
          read = readBand(label); // 문구 모양 10가지(하위·상위 안쪽 2, 하위·상위 밖 2, 하위·상위 A~B 사이 2, 하위·상위 약 N% 2, 하위 A%와 상위 B% 사이, 모두가 같은 자리) 전부를 읽는다
        } catch (e) {
          wrong.push(`[${low}, ${high}] "${label}": ${(e as Error).message}`);
          continue;
        }
        if (read[0] !== band.low || read[1] !== band.high) wrong.push(`[${low}, ${high}] "${label}": 문구는 ${read} 인데 판정은 [${band.low}, ${band.high}]`);
        if (band.low !== low || band.high !== high) raised.push(`[${low}, ${high}] → [${band.low}, ${band.high}]`);
      }
    }
    expect(n).toBe(5151);
    expect(wrong).toEqual([]);
    expect(raised).toEqual(['[0, 0] → [0, 1]', '[100, 100] → [99, 100]']);
  });

  it('문구 파서(readBand)가 문구의 모든 모양을 읽는다: 직접 적은 문구 → 구간', () => {
    expect(readBand('하위 40% 안쪽')).toEqual([0, 40]);
    expect(readBand('상위 3% 안쪽')).toEqual([97, 100]);
    expect(readBand('상위 30% 밖')).toEqual([0, 70]);
    expect(readBand('하위 30% 밖')).toEqual([30, 100]);
    expect(readBand('상위 8~28% 사이')).toEqual([72, 92]);
    expect(readBand('하위 30~50% 사이')).toEqual([30, 50]);
    expect(readBand('하위 약 40%')).toEqual([40, 40]);
    expect(readBand('상위 약 40%')).toEqual([60, 60]);
    expect(readBand('하위 25% 선과 상위 45% 선 사이')).toEqual([25, 55]);
    expect(readBand('모두가 같은 자리')).toEqual([0, 100]);
    expect(() => readBand('비슷한 자리')).toThrow();
  });

  it('가능한 모든 구간(0 <= low <= high <= 100, 5151가지): 문구에 0~·~100·약 0%가 없고 말하는 숫자는 모두 1~50이며, 두 끝값이 나오는 구간은 작은 수가 앞이다', () => {
    let n = 0;
    const bad: string[] = [];
    for (let low = 0; low <= 100; low++) {
      for (let high = low; high <= 100; high++) {
        const text = bandLabel(bandFromRange(low, high));
        n++;
        if (/(^|[^\d])0(~|%)|~100|약 0%|100%/.test(text)) bad.push(`${low}~${high}: ${text} (0·100 끝값)`);
        if (numbersIn(text).some((x) => x < 1 || x > 50)) bad.push(`${low}~${high}: ${text} (1~50 밖)`);
        const range = /(\d+)~(\d+)%/.exec(text);
        if (range && Number(range[1]) > Number(range[2])) bad.push(`${low}~${high}: ${text} (큰 수가 앞)`);
      }
    }
    expect(n).toBe(5151);
    expect(bad).toEqual([]);
  });

  it('맞지 않는 구간은 throw한다: 정수가 아니거나, 0~100 밖이거나, low가 high보다 크다', () => {
    for (const [low, high] of [
      [-1, 5],
      [5, 101],
      [60, 40],
      [1.5, 3],
      [3, 4.5],
      [Number.NaN, 5],
    ])
      expect(() => bandFromRange(low, high), `${low},${high}`).toThrow(RangeError);
  });
});

describe('스무 살 전에 끝난 인생 (reachedIndependence)', () => {
  it('청년 단계 진입(20세) 전에 죽으면 false, 20세부터 true — 그때부터 재산이 "내가 가진 것"이다', () => {
    expect(STAGE_TABLE.youth.startAge).toBe(20);
    expect(reachedIndependence(0)).toBe(false);
    expect(reachedIndependence(19)).toBe(false);
    expect(reachedIndependence(20)).toBe(true);
    expect(reachedIndependence(85)).toBe(true);
  });

});

describe('reviewEnding: 처음 → 마지막 원값·선택 수·연표 (출발선 대비는 결정 후속 256으로 삭제)', () => {
  const lives = lazy(() => SIM_PROFILES.flatMap((era) => Array.from({ length: 120 }, (_, i) => endingOf(i * 104729 + 5, era, i % 2 === 0 ? 'random' : 'auto'))));

  it('원값을 빼서 견주지 않는다: 소득·부채·소득 보정·주거 형태가 달라도 회고는 같다 (출발선 대비가 없어져 회고는 자산을 읽지 않는다 — 결정 후속 256)', () => {
    const l = lives().find((x) => x.death.age >= 20)!;
    const base = reviewEnding(l);
    for (const [income, debt, dwelling] of [[0, 0, 'rent'], [9000, 20000, 'own'], [300, 5, 'care']] as const) {
      const assets = { ...l.assets!, income, debt: Math.max(debt, -l.assets!.net), dwelling };
      expect(reviewEnding({ ...l, assets })).toEqual(base);
    }
    expect(Object.keys(base).sort()).toEqual(['changes', 'choiceCount', 'delegated', 'timeline']);
  });

  it('학력·행복·관계만 처음 → 마지막 원값으로 견준다 (재산·건강·외모는 견주지 않는다)', () => {
    expect(COMPARABLE_STATS).toEqual(['education', 'happiness', 'relationships']);
    for (const l of lives().slice(0, 50)) {
      const r = reviewEnding(l);
      expect(r.changes.map((c) => c.stat)).toEqual(['education', 'happiness', 'relationships']);
      for (const c of r.changes) {
        expect(c.from).toBe(l.birthStats[c.stat]);
        expect(c.to).toBe(l.stats[c.stat]);
      }
    }
  });

  it('선택의 순간 수는 연표의 선택 기록 수와 같다 — SPEC-005 PD9로 기준을 나눴다: 본인이 고른 선택(`by` 없음) = choiceCount, 부모님이 정한(`by: parent`)·흘러간(`by: child`) 선택 = delegated이고, 셋을 더하면 연표의 선택 기록 전부다', () => {
    for (const l of lives().slice(0, 40)) {
      const r = reviewEnding(l);
      const records = l.history.filter((h) => h.kind === 'choice');
      expect(r.choiceCount).toBe(records.filter((h) => h.by === undefined).length);
      expect(r.delegated.parent).toBe(records.filter((h) => h.by === 'parent').length);
      expect(r.delegated.child).toBe(records.filter((h) => h.by === 'child').length);
      expect(r.choiceCount + r.delegated.parent + r.delegated.child).toBe(records.length);
    }
  });
});

describe('생애 연표 (buildTimeline): 하나도 빠뜨리지 않고 단계별로 묶는다', () => {
  const lives = lazy(() => SIM_PROFILES.flatMap((era) => Array.from({ length: 150 }, (_, i) => endingOf(i * 7919 + 13, era))));

  it('모든 항목이 시간순 그대로 들어 있다: 묶은 것을 이어 붙이면 연표와 같다', () => {
    for (const l of lives()) {
      const groups = buildTimeline(l.history);
      expect(groups.flatMap((g) => g.entries)).toEqual(l.history);
    }
  });

  it('선택한 순간(choice)은 한 줄도 빠지지 않고 고른 선택지 문구와 함께 있다', () => {
    for (const l of lives()) {
      const groups = buildTimeline(l.history);
      const picked = groups.flatMap((g) => g.entries).filter((e) => e.kind === 'choice');
      expect(picked.length).toBe(l.history.filter((h) => h.kind === 'choice').length);
      for (const e of picked) {
        expect(e.choice, `${l.generation} ${l.seed}: 고른 선택지 문구`).toBeTruthy();
        expect(e.title).toBeTruthy();
      }
    }
  });

  it('단계 순서(영유아 → 노년)로 나뉘고, 항목은 자기 나이가 속한 단계에 있으며, 출생은 영유아 맨 앞·사망은 마지막 항목이다', () => {
    for (const l of lives()) {
      const groups = buildTimeline(l.history);
      const order = groups.map((g) => STAGES.indexOf(g.stage));
      expect(order).toEqual([...order].sort((a, b) => a - b));
      expect(new Set(order).size).toBe(order.length);
      for (const g of groups) for (const e of g.entries) expect(stageOf(e.age)).toBe(g.stage);
      expect(groups[0].stage).toBe('infant');
      expect(groups[0].entries[0].age).toBe(0);
      const last = groups[groups.length - 1].entries;
      expect(last[last.length - 1].kind).toBe('death');
      expect(stageOf(l.death.age)).toBe(groups[groups.length - 1].stage);
    }
  });

  it('가장 긴 연표(약 117줄)도 한 줄도 줄이지 않는다: 단계 기록 5 + 서술 + 선택 40 + 사망', () => {
    const history: HistoryEntry[] = [{ age: 0, kind: 'stage', text: '출생' }];
    let age = 1;
    for (const stage of ['school', 'youth', 'middle', 'senior'] as const) history.push({ age: STAGE_TABLE[stage].startAge, kind: 'stage', text: `${stage} 진입` });
    while (history.length < 116) {
      history.push(age % 3 === 0 ? { age, kind: 'choice', title: `선택${age}`, choice: `고른 것${age}`, text: '결과' } : { age, kind: 'event', title: `일${age}`, text: '일어난 일' });
      age = (age + 1) % 109;
      history.sort((a, b) => a.age - b.age);
    }
    history.push({ age: 110, kind: 'death', text: '세상을 떠났다.' });
    const groups = buildTimeline(history);
    expect(groups.flatMap((g) => g.entries)).toHaveLength(history.length);
    expect(groups.flatMap((g) => g.entries).filter((e) => e.kind === 'choice')).toHaveLength(history.filter((h) => h.kind === 'choice').length);
    expect(history.length).toBeGreaterThanOrEqual(117);
  });

  it('stageRangeOf: 영유아 0~6 / 학창 7~19 / 청년 20~39 / 중년 40~64 / 노년 65~', () => {
    expect(stageRangeOf('infant')).toEqual({ from: 0, to: 6 });
    expect(stageRangeOf('school')).toEqual({ from: 7, to: 19 });
    expect(stageRangeOf('youth')).toEqual({ from: 20, to: 39 });
    expect(stageRangeOf('middle')).toEqual({ from: 40, to: 64 });
    expect(stageRangeOf('senior')).toEqual({ from: 65, to: null });
  });
});

describe('엔딩 문구 (data/endingText.ts): 담담하다 (도착 자리·방향 문장은 결정 후속 256으로 삭제)', () => {
  it('사망·선택 수·단계 제목', () => {
    expect(deathLineText({ age: 83, cause: '노환' })).toBe('84세에 세상을 떠났습니다. 원인은 노환이었습니다.'); // M7e-3: 합쇼체 (copy.md 5-3)
    expect(deathLineText({ age: 12, cause: '사고' })).toBe('13세에 세상을 떠났습니다. 원인은 사고였습니다.'); // 받침이 없으면 「였습니다」
    expect(choiceCountText(22)).toBe('살아오며 22번의 선택을 했습니다.');
    expect(choiceCountText(0)).toBe('선택을 내려야 하는 순간이 오기 전이었습니다.');
    expect(STAGES.map((s) => stageHeadingText(s))).toEqual(['영유아 · 1~7세', '학창 · 8~20세', '청년 · 21~40세', '중년 · 41~65세', '노년 · 66세~']);
  });

  it('모든 문구에 느낌표·이모지·등급명(흙/동/은/금/다이아 수저)이 없다', () => {
    const texts = [
      REBIRTH_LABEL,
      REBIRTH_NOTE,
      choiceCountText(0),
      choiceCountText(9),
      deathLineText({ age: 3, cause: '사고' }),
      ...STAGES.map((s) => stageHeadingText(s)),
    ];
    for (const t of texts) {
      expect(t, t).not.toMatch(/[!！]/);
      expect(t, t).not.toMatch(EMOJI);
      expect(t, t).not.toMatch(GRADE_NAMES);
    }
  });

});

describe('다시 태어나기 (rebirth): 새 시드로 새 판, 첫 화면(title)에서 시작 (SPEC-003 규칙 19)', () => {
  const ended = (seed = 77): GameState => playToEnd(startLife(seed, 'alpha'), chooserFor('random', seed)).state;

  it('ending → 첫 화면(title): 새 시드, 세상·인생 길이 미정(첫 화면의 선택은 설정에 있다), 이전 판의 흔적이 하나도 없다', () => {
    const before = ended();
    expect(before.phase).toBe('ending');
    const r = rebirth(before, 9001);
    expect(r).toEqual(createInitialState(9001));
    expect(r.phase).toBe('title');
    expect(r.seed).toBe(9001);
    expect(r.rngState).toBe(9001);
    expect(r.generation).toBeNull(); // 첫 화면의 기본 선택 = DEFAULT_GENERATION (설정, 「랜덤 세대」)
    expect(r.lifeLength).toBeNull();
    expect(DEFAULT_GENERATION).toBe('random');
    for (const key of ['character', 'birthStats', 'death', 'pending', 'lastChoiceAge'] as const) expect(r[key], key).toBeNull();
    expect(r.history).toEqual([]);
    expect(r.flags).toEqual([]);
    expect(r.seen).toEqual({});
    expect(r.age).toBe(0);
    // 이전 판의 시드·인물은 남지 않는다
    expect(r.seed).not.toBe(before.seed);
  });

  it('ending이 아닐 때는 같은 객체를 돌려준다 (title·roulette·birth·life에서 호출돼도 아무 일도 없다)', () => {
    const title = createInitialState(1);
    const roulette = beginBirth(title, 'industrial');
    const birth = enterBirth(roulette);
    const life = enterLife(birth);
    for (const s of [title, roulette, birth, life]) expect(rebirth(s, 5)).toBe(s);
  });

  it('연타·더블탭: 두 번째부터는 같은 객체라 두 판이 시작되거나 첫 화면을 건너뛰지 않는다', () => {
    const r1 = rebirth(ended(), 11);
    expect(r1.phase).toBe('title');
    const r2 = rebirth(r1, 22);
    expect(r2).toBe(r1);
    expect(r2.seed).toBe(11); // 둘째 입력의 시드는 버려진다
    // 세션 reducer: 같은 세션 객체
    const s0 = createSession(ended(), { speed: 8, autoMode: true });
    const s1 = sessionReducer(s0, { type: 'rebirth', seed: 11 });
    const s2 = sessionReducer(s1, { type: 'rebirth', seed: 22 });
    const s3 = sessionReducer(s2, { type: 'rebirth', seed: 33 });
    expect(s1.game.phase).toBe('title');
    expect(s2).toBe(s1);
    expect(s3).toBe(s1);
    // 새 판이 시작되려면 첫 화면에서 「태어나기」를 눌러야 하고, 그 전의 진행·이동 입력은 전부 무시된다
    for (const a of [{ type: 'enterLife' }, { type: 'skip' }, { type: 'advance', fromAge: 0 }, { type: 'resume' }, { type: 'openTitle' }] as const) expect(sessionReducer(s1, a), a.type).toBe(s1);
  });

  it('설정(배속·자동 모드·고른 세상과 인생 길이)은 그대로 유지된다, tick은 비워진다, 인생 도중의 rebirth는 무시된다', () => {
    const s0 = createSession(ended(), { speed: 4, autoMode: true, generation: 'genz', lifeLength: 'long60', bgm: { on: true, volume: 70 }, theme: 'dark' });
    const s1 = sessionReducer(s0, { type: 'rebirth', seed: 5 });
    expect(s1.settings).toBe(s0.settings);
    // M4: 설정에 BGM·테마가 더해졌고, 다시 태어나도 그대로 유지된다 (M7c: 자동 기록 카드 켬/끔 noteCards도 기본값 켜짐 그대로)
    expect(s1.settings).toEqual({ ...DEFAULT_SETTINGS, speed: 4, autoMode: true, generation: 'genz', lifeLength: 'long60', bgm: { on: true, volume: 70 }, theme: 'dark' }); // SPEC-005 QI6·QI7: 설정 v5의 새 필드 둘(가림 꺼짐·본 소식 없음)도 기본값 그대로
    expect(s1.tick).toBeNull();
    const life = createSession(startLife(3, 'alpha'), { speed: 2, autoMode: false });
    expect(sessionReducer(life, { type: 'rebirth', seed: 5 })).toBe(life);
  });

  it('새 판: 세대를 고르지 않고 태어나면 「랜덤 세대」(7세대 중 하나), 고르면 그 세대로 태어난다. 같은 시드면 같은 인물이고 시드가 다르면 다른 인물이다', () => {
    const born = (seed: number, generation?: ProfileId) => {
      let s = sessionReducer(createSession(ended(), { speed: 1, autoMode: false }), { type: 'rebirth', seed });
      if (generation !== undefined && generation !== R1_PRESENT) s = sessionReducer(s, { type: 'setGeneration', generation });
      return sessionReducer(s, { type: 'begin' }).game;
    };
    const a = born(1001);
    expect(a.phase).toBe('roulette');
    expect(GENERATION_IDS as readonly string[]).toContain(a.generation);
    expect(a.fromRandom).toBe(true);
    expect(born(1001)).toEqual(a);
    expect(born(1002).character).not.toEqual(a.character);
    expect(born(1001, 'genz').generation).toBe('genz');
    expect(born(1001, 'industrial').generation).toBe('industrial');
    // 이전 판과 상관없이 시드에서만 정해진다
    expect(sessionReducer(sessionReducer(createSession(ended(5), { speed: 1, autoMode: false }), { type: 'rebirth', seed: 1001 }), { type: 'begin' }).game).toEqual(a);
  });

  it('새 판 상태는 저장·복원이 된다 (첫 화면 단계로 새로고침해도 같은 새 판)', () => {
    const r = rebirth(ended(), 4242);
    expect(parseGame(serializeGame(r))).toEqual(r);
  });

  it('죽음 → 다시 태어나기를 여러 번 되풀이해도 매번 새 판이고 끝까지 갈 수 있다', () => {
    let session = createSession(ended(1), { speed: 8, autoMode: true });
    const seeds: number[] = [];
    for (let round = 0; round < 4; round++) {
      session = sessionReducer(session, { type: 'rebirth', seed: 500 + round });
      session = sessionReducer(session, { type: 'begin' });
      session = sessionReducer(session, { type: 'finishSpin' });
      session = sessionReducer(session, { type: 'enterBirth' });
      session = sessionReducer(session, { type: 'enterLife' });
      seeds.push(session.game.seed);
      const end = playToEnd(session.game, null).state;
      expect(end.phase).toBe('ending');
      session = { ...session, game: end };
    }
    expect(seeds).toEqual([500, 501, 502, 503]);
    expect(session.settings).toEqual({ ...DEFAULT_SETTINGS, speed: 8, autoMode: true });
  });
});

describe('저장 검증: 엔딩 상태', () => {
  const ended = playToEnd(startLife(88, 'genz'), chooserFor('random', 88)).state;

  it('사망 상태는 저장·복원해도 그대로고, 복원한 상태로 회고를 만들 수 있다 (새로고침해도 엔딩 유지)', () => {
    const back = parseGame(serializeGame(ended));
    expect(back).toEqual(ended);
    expect(back!.phase).toBe('ending');
    expect(reviewEnding(back as EndingGame)).toEqual(reviewEnding(ended as EndingGame));
  });

  it('엔딩 저장이 어긋나면 새 게임이다: 사망 정보 없음·사망 나이 불일치·대기 중인 선택지·캐릭터/세대/출생 스냅샷 없음', () => {
    const bad = (patch: Partial<GameState>) => parseGame(serializeGame({ ...ended, ...patch }));
    expect(bad({})).not.toBeNull();
    expect(bad({ death: null })).toBeNull();
    expect(bad({ death: { age: ended.age + 1, cause: '노환' } })).toBeNull();
    expect(bad({ death: { age: ended.age, cause: '' } })).toBeNull();
    expect(bad({ character: null })).toBeNull();
    expect(bad({ generation: null })).toBeNull();
    expect(bad({ birthStats: null })).toBeNull();
    expect(bad({ pending: { eventId: 'school-exam', key: `school-exam@${ended.age}`, age: ended.age, choiceIds: ['a', 'b'] } })).toBeNull();
  });

  it('엔딩 상태에서는 진행도 선택도 되지 않는다 (엔딩이 되살아나거나 진행이 다시 시작되지 않는다)', () => {
    const s0 = createSession(ended, { speed: 8, autoMode: true });
    for (const a of [{ type: 'advance', fromAge: ended.age }, { type: 'skip' }, { type: 'autoChoose', key: 'x@1' }, { type: 'choose', key: 'x@1', choiceId: 'a' }, { type: 'enterLife' }, { type: 'begin' }, { type: 'resume' }, { type: 'openTitle' }] as const) {
      expect(sessionReducer(s0, a), a.type).toBe(s0);
    }
  });
});
