import rouletteSrc from '../src/core/roulette.ts?raw';
import reelSrc from '../src/ui/Reel.tsx?raw';
import rouletteScreenSrc from '../src/screens/RouletteScreen.tsx?raw';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  GENERATION_IDS,
  PARENT_WEALTHS,
  R1_PRESENT,
  ROULETTE_TIMING,
  WEALTH_REEL_ORDER,
  beginBirth,
  buildRoulette as buildRouletteOf,
  createInitialState,
  generateBirthFromSeed,
  largestRemainder,
  reelPosition,
  sumScaled,
  wealthMixtureOfGame,
  wealthReelIndex,
  type GenerationId,
  type ProfileId,
} from '../src/core';
import reference from './fixtures/gm3-mixture-reference.json';
import { GRADE_NAME, ROULETTE_GEN_TEXT, ROULETTE_TEXT, regionNoteText } from '../src/data/birthReportText';
import { bandLabel } from '../src/data/endingText';
import { startBandOf } from '../src/core/ending';
import { profileLabel } from '../src/core/birthProfile';
import { GENERATIONS } from '../src/data/generations';
import { REGION_ORDER } from '../src/data/regionNames';
import { RouletteScreen } from '../src/screens/RouletteScreen';
import { restCells, spinCells, spinCycles } from '../src/ui/Reel';
import { SIM_PROFILES } from '../scripts/simulateLib';
import { codeOnly } from './helpers/code';

/**
 * 출생 룰렛 (SPEC-003 RL1~RL6). 기준은 출생 로직이 저장한 결과와 원자료의 지역 비율이다 — 연출은 확률을 바꾸지 못한다(RL2).
 */

describe('largestRemainder: 합이 정확히 100이 되게 나타낸다 (RL3)', () => {
  it('정수 %: [25,30,28,14,3] 그대로, 합이 100이 아닌 입력은 비례로 정규화해 합 100을 만든다', () => {
    expect(largestRemainder([25, 30, 28, 14, 3], 0)).toEqual([25, 30, 28, 14, 3]);
    const odd = largestRemainder([1, 1, 1], 0); // 33.33.. 세 개 → 34·33·33 (가장 큰 나머지 먼저, 같으면 앞쪽)
    expect(odd).toEqual([34, 33, 33]);
    expect(sumScaled(odd, 0)).toBe(100);
    expect(sumScaled(largestRemainder([3, 3, 3, 3, 3, 3, 3], 0), 0)).toBe(100);
  });

  it('소수 첫째 자리: 합이 정확히 100.0 (정수 연산으로 검사)이고 모든 값이 0.1 단위다 — 임의 입력 2000개', () => {
    let seed = 12345;
    const rand = () => {
      seed = (seed * 1103515245 + 12345) >>> 0;
      return seed / 4294967296;
    };
    for (let t = 0; t < 2000; t++) {
      const n = 2 + Math.floor(rand() * 18);
      const values = Array.from({ length: n }, () => Math.round(rand() * 1000) / 10 + 0.1);
      const out = largestRemainder(values, 1);
      expect(sumScaled(out, 1), `${values.join(',')}`).toBe(1000);
      for (const v of out) expect(Math.abs(v * 10 - Math.round(v * 10))).toBeLessThan(1e-9);
      // 원래 비율과 0.1%p 이내
      const total = values.reduce((a, b) => a + b, 0);
      out.forEach((v, i) => expect(Math.abs(v - (values[i] / total) * 100)).toBeLessThan(0.1 + 1e-9));
    }
  });

  it('잘못된 입력은 throw: 빈 목록·음수·NaN·합 0', () => {
    for (const bad of [[], [-1, 2], [Number.NaN, 1], [0, 0]]) expect(() => largestRemainder(bad, 0)).toThrow(RangeError);
  });
});

/** 세대 7종의 섞음 비율 독립 기준값 (시안 생성기가 낸 값 — 정수 수저 %, 소수 첫째 자리 지역 %) */
const REF = (reference as unknown as { gens: Record<string, { wealth: number[]; region: Array<{ key: string; short: string; pct: string }> }> }).gens;

/** 출생 뒤의 GameState(인물이 있다)를 룰렛 입력으로 좁혀 부른다 */
const buildRoulette = (game: unknown, ...rest: [] | [Parameters<typeof buildRouletteOf>[1]]) => buildRouletteOf(game as Parameters<typeof buildRouletteOf>[0], ...rest);

describe('buildRoulette: 세대 전체 기준의 확률표와 멈출 자리 (RL2·RL3 · GS6·GS7)', () => {
  for (const g of GENERATION_IDS) {
    it(`${g}: 수저 확률 = 세대 섞음 비율(합 100), 지역 확률 = 세대 섞음 지역 비율(합 100.0, 룰렛 순서) — 독립 기준값과 같고, 멈출 자리 = 저장된 출생 결과`, () => {
      const born = beginBirth(createInitialState(99), g);
      const view = buildRoulette(born);
      expect(view.wealthOdds.map((o) => o.wealth)).toEqual([...PARENT_WEALTHS]);
      expect(view.wealthOdds.map((o) => o.percent)).toEqual(REF[g].wealth);
      expect(sumScaled(view.wealthOdds.map((o) => o.percent), 0)).toBe(100);
      expect(view.regionOdds.map((o) => o.name)).toEqual(REF[g].region.map((r) => r.short));
      expect(view.regionOdds.map((o) => o.percent)).toEqual(REF[g].region.map((r) => Number(r.pct)));
      expect(sumScaled(view.regionOdds.map((o) => o.percent), 1)).toBe(1000);
      // 룰렛 순서: REGION_ORDER의 부분 목록(회전·결과·움직임 줄이기가 같은 순서, R-171)
      expect(view.regionOdds.map((o) => o.name)).toEqual(REGION_ORDER.filter((n) => view.regionOdds.some((o) => o.name === n)));
      expect(view.wealthIndex).toBe(born.character!.parentWealth - 1);
      expect(view.regionReel[view.regionIndex]).toBe(born.birthReport!.region);
      const def = GENERATIONS.find((x) => x.id === g)!;
      expect(view.range).toEqual({ from: def.birth.from, to: def.birth.to });
    });
  }

  it('RL2: 결과 = 출생 로직 결과 — 세대 표본 3종 × 시드 1000개 전부, 룰렛이 멈출 자리는 generateBirth가 정한 값이다 (룰렛은 난수를 뽑지 않는다)', () => {
    for (const g of SIM_PROFILES) {
      for (let seed = 1; seed <= 1000; seed++) {
        const b = generateBirthFromSeed(seed * 8191, g);
        const view = buildRoulette({ generation: g, character: b.character, birthReport: b.report });
        expect(view.wealthOdds[view.wealthIndex].wealth, `${g} ${seed}`).toBe(b.character.parentWealth);
        expect(view.regionReel[view.regionIndex], `${g} ${seed}`).toBe(b.report.region);
      }
    }
  });

  it('GS7: 표는 뽑힌 해·시도·수저와 무관하다 — 같은 세대의 어느 결과로 열어도 두 확률표가 같다(도는 동안 바뀌지 않는다)', () => {
    for (const g of SIM_PROFILES) {
      const first = buildRoulette(beginBirth(createInitialState(1), g));
      for (let seed = 2; seed <= 60; seed++) {
        const v = buildRoulette(beginBirth(createInitialState(seed), g));
        expect(v.wealthOdds, `${g} ${seed}`).toEqual(first.wealthOdds);
        expect(v.regionOdds, `${g} ${seed}`).toEqual(first.regionOdds);
      }
    }
  });

  it('같은 입력이면 같은 룰렛이다(순수 함수) — 호출을 되풀이해도 결과가 바뀌지 않는다 (다시 굴리기 없음)', () => {
    const born = beginBirth(createInitialState(5), 'millennial');
    const a = buildRoulette(born);
    for (let i = 0; i < 20; i++) expect(buildRoulette(born)).toEqual(a);
  });

  it('R-187 · GS7: 연도 가중의 성격 — 출생 통계가 있는 1970년 이후 세대는 출생아 수 비례(births), 산업화·베이비붐·86은 균등(uniform)이다', () => {
    const view = (g: GenerationId) => buildRoulette(beginBirth(createInitialState(7), g));
    for (const g of ['industrial', 'boomer', 'g86'] as const) expect(view(g).basis, g).toBe('uniform');
    for (const g of ['genx', 'millennial', 'genz', 'alpha'] as const) expect(view(g).basis, g).toBe('births');
    // 1981년 앞의 해가 들어 있는 세대(지역 값이 인구 비례) — 산업화~X
    for (const g of ['industrial', 'boomer', 'g86', 'genx'] as const) expect(view(g).popYears, g).toBe(true);
    for (const g of ['millennial', 'genz', 'alpha'] as const) expect(view(g).popYears, g).toBe(false);
  });

  it('시도를 직접 고르면(RG2): 지역 릴은 고른 칸에 멈추고 지역 표는 비며, 수저 표는 그 시도가 있던 해만으로 다시 섞는다 — 세종 × Z 세대는 2012년생만 후보다', () => {
    const picked = beginBirth(createInitialState(7), 'genz', 'short30', '세종');
    const view = buildRoulette(picked);
    expect(picked.character!.birthYear).toBe(2012);
    expect(view.picked).toBe(true);
    expect(view.regionOdds).toEqual([]);
    expect(view.regionReel[view.regionIndex]).toBe('세종');
    // 수저 표 = 2012년 한 해의 수저 비율(독립 기준값 `wealthFor`)
    expect(view.wealthOdds.map((o) => o.percent)).toEqual((reference as unknown as { wealthFor: Record<string, number[]> }).wealthFor['2012']);
    expect(view.wealthOdds.map((o) => o.percent)).toEqual(wealthMixtureOfGame(picked));
    // 서울을 고르면 모든 해가 후보라 세대 전체 기준과 같다
    const seoul = beginBirth(createInitialState(7), 'genz', 'short30', '서울');
    expect(buildRoulette(seoul).wealthOdds.map((o) => o.percent)).toEqual(REF.genz.wealth);
  });

  it('지역이 그 출생 연도의 목록에 없고 직접 고른 시도도 아니면 throw (손상된 저장은 저장 검증이 먼저 거른다)', () => {
    const born = beginBirth(createInitialState(7), 'genx');
    expect(() => buildRoulette({ ...born, birthReport: { ...born.birthReport!, region: '세종' } } as never)).toThrow(RangeError);
  });

  it('R-515 b: 지역 릴의 칸 = 세대 범위의 시·도 합집합(확률표의 줄과 같다) — 어느 해가 뽑혀도 칸 구성이 같아 칸으로 연도 대를 짐작할 수 없다 (Z 릴에 세종이 늘 있다)', () => {
    for (const g of GENERATION_IDS) {
      const base = buildRoulette(beginBirth(createInitialState(1), g));
      expect(base.regionReel, `${g}: 릴 칸 = 지역 표의 줄(룰렛 순서)`).toEqual(base.regionOdds.map((o) => o.name));
      const years = new Set<number>();
      for (let seed = 1; seed <= 120; seed++) {
        const born = beginBirth(createInitialState(seed * 31), g);
        years.add(born.character!.birthYear);
        const v = buildRoulette(born);
        expect(v.regionReel, `${g} ${seed}`).toEqual(base.regionReel);
        expect(v.regionReel[v.regionIndex], `${g} ${seed}: 멈출 칸 = 저장된 출생 시도`).toBe(born.birthReport!.region);
      }
      expect(years.size, `${g}: 표본이 여러 해를 덮는다`).toBeGreaterThan(1);
    }
    // 합집합이라 Z·알파 릴에는 세종이 있고, 산업화·밀레니얼 릴에는 없다
    const reelOf = (g: GenerationId) => buildRoulette(beginBirth(createInitialState(2), g)).regionReel;
    expect(reelOf('genz')).toContain('세종');
    expect(reelOf('alpha')).toContain('세종');
    expect(reelOf('industrial')).not.toContain('세종');
    expect(reelOf('millennial')).not.toContain('세종');
    // 직접 고른 시도가 합집합에 없으면(산업화의 대구 등) 그 칸이 더해진다 — 멈출 칸은 늘 저장된 시도
    const picked = buildRoulette(beginBirth(createInitialState(7), 'industrial', 'short30', '대구'));
    expect(picked.regionReel[picked.regionIndex]).toBe('대구');
  });

  it('시험 전용 R1 프로필: 수저는 고정 비율, 지역은 2026년 행정구역 16개 (EY17 항등 기준)', () => {
    const born = beginBirth(createInitialState(99), R1_PRESENT);
    const view = buildRoulette(born);
    expect(view.wealthOdds.map((o) => o.percent)).toEqual([25, 30, 28, 14, 3]);
    expect(view.regionOdds).toHaveLength(16);
    expect(sumScaled(view.regionOdds.map((o) => o.percent), 1)).toBe(1000);
  });
});

describe('확률 표기 문구 (RL3 · GS7)', () => {
  it('지역 표 주석: births/uniform + 1981년 앞은 인구 비례 + 범위 도중에 생긴 시·도 — 설계값·출처 낱말을 정직하게 적는다', () => {
    const births = regionNoteText({ basis: 'births', popYears: false, later: [] });
    expect(births).toBe(ROULETTE_GEN_TEXT.regionNoteBirths);
    expect(regionNoteText({ basis: 'uniform', popYears: false, later: [] })).toBe(ROULETTE_GEN_TEXT.regionNoteUniform);
    const full = regionNoteText({ basis: 'births', popYears: true, later: ['대구', '인천'] });
    expect(full).toContain(ROULETTE_GEN_TEXT.regionNotePop);
    expect(full).toContain(ROULETTE_GEN_TEXT.regionNoteLater('대구·인천'));
    expect(ROULETTE_TEXT.wealthOddsNote).toBe('게임의 설계값이에요(통계가 아님).');
    for (const t of [births, full, ...Object.values(ROULETTE_TEXT)]) expect(t).not.toMatch(/[!！]|접속자/);
  });

  it('수저 표 주석은 세대 범위의 양 끝과 「설계값」을 말한다 (연도별 값을 해마다 섞은 값)', () => {
    expect(ROULETTE_GEN_TEXT.wealthNote(1981, 1996)).toBe('1981~1996년생의 설계값을 해마다 섞은 값이에요. 게임의 설계값이에요(통계가 아님).');
    expect(ROULETTE_GEN_TEXT.oddsHead('X세대')).toBe('X세대 전체 기준');
  });
});

describe('릴 연출 (RL1): 가속 → 회전 → 감속, 총 4~6초, 수저 릴이 마지막', () => {
  it('시간표: 지역 릴이 먼저, 수저 릴이 마지막에 멈추고 총 연출은 4~6초 안이다', () => {
    expect(ROULETTE_TIMING.regionStopMs).toBeLessThan(ROULETTE_TIMING.wealthStopMs);
    expect(ROULETTE_TIMING.wealthStopMs).toBeGreaterThanOrEqual(4000);
    expect(ROULETTE_TIMING.wealthStopMs).toBeLessThanOrEqual(6000);
    expect(ROULETTE_TIMING.accelMs).toBeGreaterThan(0);
    expect(ROULETTE_TIMING.accelMs).toBeLessThan(ROULETTE_TIMING.regionStopMs);
  });

  it('reelPosition: 0에서 시작해 정확히 total에서 멈추고, 한 번도 되돌아가지 않으며(단조), 처음엔 가속·끝엔 감속(속도 0으로 멈춤)이다', () => {
    for (const [total, stop] of [[30, 5400], [32, 4200], [33, 4200]] as const) {
      expect(reelPosition(0, total, stop)).toBe(0);
      expect(reelPosition(-5, total, stop)).toBe(0);
      expect(reelPosition(stop, total, stop)).toBe(total);
      expect(reelPosition(stop + 1000, total, stop)).toBe(total);
      let prev = 0;
      let maxSpeed = 0;
      for (let t = 0; t <= stop; t += 10) {
        const p = reelPosition(t, total, stop);
        expect(p, `t=${t}`).toBeGreaterThanOrEqual(prev - 1e-9);
        maxSpeed = Math.max(maxSpeed, (p - prev) / 10);
        prev = p;
      }
      // 속도: 시작 직후 느리고(가속), 끝 직전 느리다(감속) — 가운데 최고 속도의 20% 미만
      const speedAt = (t: number) => (reelPosition(t + 10, total, stop) - reelPosition(t, total, stop)) / 10;
      expect(speedAt(0)).toBeLessThan(maxSpeed * 0.2);
      expect(speedAt(stop - 10)).toBeLessThan(maxSpeed * 0.2);
      // 연속: 가속 구간 끝에서 값이 끊기지 않는다
      expect(Math.abs(reelPosition(ROULETTE_TIMING.accelMs + 0.001, total, stop) - reelPosition(ROULETTE_TIMING.accelMs - 0.001, total, stop))).toBeLessThan(0.01);
    }
    expect(() => reelPosition(1, 30, 500)).toThrow(RangeError); // 멈춤 시각이 가속 구간보다 짧다
  });

  it('spinCycles: 수저 5칸·지역 10~16칸 모두 총 이동이 30칸 이상(속도감)이고 한 바퀴는 칸 수의 정수배다', () => {
    for (const n of [5, 8, 10, 11, 13, 14, 15, 16]) {
      const total = spinCycles(n) * n;
      expect(total, `${n}칸`).toBeGreaterThanOrEqual(30);
      expect(total % n).toBe(0);
    }
  });

  it('연출 코드에 Math.random·Date 난수가 없다: 룰렛 순수 함수·릴·화면 소스, 주석은 빼고 코드만 본다 (RL2)', () => {
    // 공허 통과 방지: 점검 도구가 코드의 Math.random()은 잡고 주석 속 언급은 넘긴다
    expect(codeOnly('const x = Math.random();')).toContain('Math.random');
    expect(codeOnly(['// Math.random 없음', '/* Math.random 금지 */', 'const y = 1;'].join('\n'))).not.toContain('Math.random');
    for (const src of [rouletteSrc, reelSrc, rouletteScreenSrc]) {
      const code = codeOnly(src);
      expect(code.trim().length).toBeGreaterThan(200);
      expect(code).not.toContain('Math.random');
      expect(code).not.toMatch(/crypto\.getRandomValues|Date\.now|new Date/);
    }
  });
});

describe('수저 릴 칸 순서: 왕복 (R-274, 마스터 결정) — 정지 직전에 지나는 칸이 늘 이웃 단계다', () => {
  const level = (index: number): number => WEALTH_REEL_ORDER[((index % WEALTH_REEL_ORDER.length) + WEALTH_REEL_ORDER.length) % WEALTH_REEL_ORDER.length];

  it('순서는 흙 동 은 금 다이아 금 은 동(8칸): 다섯 단계가 모두 있고 흙·다이아몬드는 한 번, 나머지는 두 번 나온다', () => {
    expect([...WEALTH_REEL_ORDER]).toEqual([1, 2, 3, 4, 5, 4, 3, 2]);
    for (const w of PARENT_WEALTHS) expect(WEALTH_REEL_ORDER.filter((x) => x === w), `${w}단계`).toHaveLength(w === 1 || w === 5 ? 1 : 2);
  });

  it('이웃한 칸(끝에서 처음으로 돌아가는 칸 포함)은 늘 한 단계 차이다', () => {
    for (let i = 0; i < WEALTH_REEL_ORDER.length; i++) expect(Math.abs(level(i) - level(i + 1)), `${i}번째와 다음 칸`).toBe(1);
  });

  it('wealthReelIndex: 저장된 수저 단계가 릴 칸 번호로 바뀌고 그 칸의 단계가 다시 그 수저 단계다(결과 무결성), 가운데 단계는 올라가는 쪽 칸', () => {
    for (const w of PARENT_WEALTHS) {
      expect(WEALTH_REEL_ORDER[wealthReelIndex(w)]).toBe(w);
      expect(wealthReelIndex(w)).toBe(w - 1);
    }
    expect(() => wealthReelIndex(9 as never)).toThrow(RangeError);
  });

  it('회전 중 목록: 정지 위치(pos = total)의 가운데 칸이 결과이고, 그 직전에 가운데를 지나는 칸과 바로 뒤 칸은 이웃 단계다 — 다섯 수저 단계 모두, 칸 수·바퀴 수가 달라도', () => {
    const n = WEALTH_REEL_ORDER.length;
    for (const cycles of [spinCycles(n), spinCycles(n) + 1, 2]) {
      const total = cycles * n;
      for (const w of PARENT_WEALTHS) {
        const cells = spinCells(n, wealthReelIndex(w), total);
        const center = (pos: number) => cells[pos + 2]; // 위치 pos에서 가운데에 보이는 칸
        expect(level(center(total)), `${w}단계: 정지 위치의 가운데 칸 = 결과`).toBe(w);
        expect(Math.abs(level(center(total - 1)) - w), `${w}단계: 정지 직전에 지나는 칸`).toBe(1);
        expect(Math.abs(level(center(total - 2)) - level(center(total - 1))), `${w}단계: 그 앞 칸`).toBe(1);
        // 마지막 6칸(감속 구간에서 천천히 지나는 칸)은 모두 이웃 단계끼리 이어진다
        for (let k = total - 6; k < total; k++) expect(Math.abs(level(center(k)) - level(center(k + 1))), `${w}단계 ${k}→${k + 1}`).toBe(1);
        expect(cells).toHaveLength(total + 5);
      }
    }
  });

  it('멈춘 목록: 결과 칸 앞뒤 두 칸씩이 이웃 단계로 이어진다(흙수저 앞뒤가 다이아몬드수저로 이어지지 않는다)', () => {
    const n = WEALTH_REEL_ORDER.length;
    for (const w of PARENT_WEALTHS) {
      const rest = restCells(n, wealthReelIndex(w));
      expect(rest).toHaveLength(5);
      expect(level(rest[2])).toBe(w);
      for (let k = 0; k < 4; k++) expect(Math.abs(level(rest[k]) - level(rest[k + 1])), `${w}단계 ${k}`).toBe(1);
    }
    // 흙수저: 은 동 [흙] 동 은 — 다이아몬드수저는 보이지 않는다
    expect(restCells(n, wealthReelIndex(1)).map(level)).toEqual([3, 2, 1, 2, 3]);
    expect(restCells(n, wealthReelIndex(5)).map(level)).toEqual([3, 4, 5, 4, 3]);
  });

  it('판별력: 예전 순환 순서(흙→동→은→금→다이아몬드→흙)였다면 흙수저 직전에 다이아몬드수저가 지나갔다 — 위 시험이 그 순서를 잡는다', () => {
    const old = [1, 2, 3, 4, 5];
    const n = old.length;
    const cells = spinCells(n, 0, spinCycles(n) * n); // 흙수저(칸 0)에서 멈춤
    const total = spinCycles(n) * n;
    expect(old[cells[total - 1 + 2]]).toBe(5); // 정지 직전에 다이아몬드수저
    expect(Math.abs(old[cells[total - 1 + 2]] - 1)).toBe(4); // 이웃 단계(1)가 아니다
  });

  it('buildRoulette: 세대 표본 3종 × 시드 500개 전부, 릴 칸 목록은 왕복 순서이고 멈출 칸의 단계 = 저장된 출생 결과 (결과 무결성 — 릴은 저장된 결과에서 멈춘다)', () => {
    for (const g of SIM_PROFILES) {
      for (let seed = 1; seed <= 500; seed++) {
        const b = generateBirthFromSeed(seed * 6007, g);
        const view = buildRoulette({ generation: g, character: b.character, birthReport: b.report });
        expect(view.wealthReel, `${g} ${seed}`).toEqual([...WEALTH_REEL_ORDER]);
        expect(view.wealthReel[view.wealthReelIndex], `${g} ${seed}`).toBe(b.character.parentWealth);
      }
    }
  });

  it('릴 칸 수가 바뀐 만큼 바퀴 수도 따라간다: 수저 릴 8칸도 총 이동이 30칸 이상이고 한 바퀴의 정수배다', () => {
    const total = spinCycles(WEALTH_REEL_ORDER.length) * WEALTH_REEL_ORDER.length;
    expect(total).toBeGreaterThanOrEqual(30);
    expect(total % WEALTH_REEL_ORDER.length).toBe(0);
  });
});

describe('룰렛 화면 서버 렌더 (결과 모양 · 회전 모양 · 세대 뽑기)', () => {
  const render = (g: ProfileId | 'random', seed: number, spin: boolean, regionPick: string | null = null): { html: string; text: string; wealth: number; region: string; year: number; game: ReturnType<typeof beginBirth> } => {
    const born = beginBirth(createInitialState(seed), g, 'short30', regionPick);
    const html = renderToStaticMarkup(<RouletteScreen game={born as never} spin={spin} onFinishSpin={() => {}} onNext={() => {}} />);
    // 줄바꿈 묶음(ui/Glue.tsx)의 span은 글자를 바꾸지 않는 표시일 뿐이라 벗겨 낸다 — 태그를 공백으로 바꾸는 규칙이 묶음 안에 공백을 넣어 「흙수저(하위…」가 「흙수저 (하위…」로 읽히지 않�
    const unglued = html.replace(/<span class="nowrap">([^<]*)<\/span>/g, '$1').replace(/<span class="keep-phrase">([^<]*)<\/span>/g, '$1');
    return { html, text: unglued.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(), wealth: born.character!.parentWealth, region: born.birthReport!.region, year: born.character!.birthYear, game: born };
  };
  const GENS = ['industrial', 'boomer', 'g86', 'genx', 'millennial', 'genz', 'alpha'] as const;

  it('결과 상태(복원·움직임 줄이기·건너뛴 뒤): 제목 「태어날 곳이 정해졌습니다」, 세대 줄 「{세대} {범위}년생 가운데」, 상태 줄에 「{수저}({구간}) · {시·도}」, 결과 아래 작은 글, 「출생신고 보기」 — 건너뛰기는 없다', () => {
    for (const g of GENS) {
      for (let seed = 1; seed <= 20; seed++) {
        const { html, text, wealth, region, game } = render(g, seed * 13, false);
        expect(text, `${g} ${seed}`).toContain(ROULETTE_TEXT.doneTitle);
        const def = GENERATIONS.find((x) => x.id === g)!;
        expect(text).toContain(profileLabel(g));
        expect(text).toContain(ROULETTE_GEN_TEXT.among(def.birth.from, def.birth.to));
        expect(text.replace(/\s+/g, '')).toContain(`${GRADE_NAME[wealth as 1]}(${bandLabel(startBandOf(wealthMixtureOfGame(game), wealth as 1))})`.replace(/\s+/g, ''));
        expect(text).toContain(region);
        expect(text).toContain(ROULETTE_TEXT.afterNote);
        expect(html).toContain('data-testid="to-birth"');
        expect(html).not.toContain('data-testid="skip-roulette"');
        expect(html).not.toContain(ROULETTE_TEXT.spinTitle);
        // 릴은 처음부터 멈춘 모양이고 가운데 칸이 결과다 (aria-hidden — 스크린리더는 상태 문장과 확률표를 읽는다)
        expect(html).toMatch(/data-testid="reel-wealth" data-state="stopped"/);
        expect(html).toMatch(/data-testid="reel-region" data-state="stopped"/);
        expect(html.match(/data-result="true"/g)).toHaveLength(2);
        expect(html).toContain('role="status"');
      }
    }
  });

  it('GS6: 릴은 지역과 수저 둘뿐이고 출생 연도 릴·연도 확률표는 없다 — 룰렛 화면 어디에도 뽑힌 연도가 나오지 않는다 (네 자리 연도는 세대 범위의 양 끝뿐; 1981년 앞 출생 자료 안내의 「1981년」은 정해진 문구)', () => {
    const rangeEnds = new Set<number>(GENERATIONS.flatMap((g) => [g.birth.from, g.birth.to]));
    for (const g of GENS) {
      for (const spin of [false, true]) {
        for (let seed = 1; seed <= 25; seed++) {
          const { html, text, year } = render(g, seed * 7, spin);
          expect(html.match(/data-testid="reel-[a-z]+"/g)?.sort(), `${g} ${seed}`).toEqual(['data-testid="reel-region"', 'data-testid="reel-wealth"']);
          expect(html).not.toContain('reel-year');
          expect(html).not.toContain('odds-year');
          // 정해진 문구(1981년 안내)를 빼고 센다
          const scan = text.replace(ROULETTE_GEN_TEXT.regionNotePop, '');
          const years = [...scan.matchAll(/(?<!\d)(19[4-9]\d|20[0-2]\d)(?!\d)/g)].map((m) => Number(m[1]));
          for (const y of years) expect(rangeEnds.has(y), `${g} ${seed} 룰렛 화면의 연도 ${y} (뽑힌 해 ${year})`).toBe(true);
          // 뽑힌 해가 범위의 끝과 겹치지 않는 판에서는 그 해가 어디에도 없다(결과 상태·회전 상태 모두)
          if (!rangeEnds.has(year)) expect(scan, `${g} ${seed}: 뽑힌 해 ${year}`).not.toContain(String(year));
          // R-515 a: 글자뿐 아니라 속성(aria-label·data-*·title·style 등)까지 — 마크업 전체에서 뽑힌 해가 한 번도 안 나온다. 정해진 문구(1981년 안내)는 빼고 센다
          const markup = html.replace(/ xmlns="[^"]*"/g, '').replace(/<span class="(?:nowrap|keep-phrase)">([^<]*)<\/span>/g, '$1').replace(ROULETTE_GEN_TEXT.regionNotePop, '');
          for (const m of markup.matchAll(/(?<!\d)(19[4-9]\d|20[0-2]\d)(?!\d)/g)) expect(rangeEnds.has(Number(m[1])), `${g} ${seed} 마크업(속성 포함)의 연도 ${m[1]} (뽑힌 해 ${year})`).toBe(true);
          if (!rangeEnds.has(year)) expect(markup, `${g} ${seed}: 마크업에 뽑힌 해 ${year}`).not.toContain(String(year));
        }
      }
    }
  });

  it('GS7: 회전 중에도 결과 상태에도 두 확률표(수저·지역)가 글자까지 같다 — 도는 동안 표가 바뀌지 않는다', () => {
    const block = (html: string, id: string): string => new RegExp(`data-testid="${id}">([^]*?)</table>`).exec(html)![1];
    for (const g of GENS) {
      const rest = render(g, 5, false).html;
      const spin = render(g, 5, true).html;
      for (const id of ['odds-wealth', 'odds-region']) expect(block(spin, id), `${g} ${id}`).toBe(block(rest, id));
      // 같은 세대의 다른 시드(다른 해·시도·수저)로 열어도 표는 같다
      const other = render(g, 77, false).html;
      for (const id of ['odds-wealth', 'odds-region']) expect(block(other, id), `${g} ${id} 다른 시드`).toBe(block(rest, id));
    }
  });

  it('M3-O13: 결과 문장의 구간 표기 「(상위 3% 안쪽)」은 괄호째 한 묶음(keep-phrase)이다 — 줄이 바뀌어도 「(상위 / 3% 안쪽)」으로 갈리지 않는다 (세대 7종 × 시드 30개, 다섯 수저 단계 모두, 수저 이름 · 구간이 괄호째)', () => {
    const grades = new Set<number>();
    for (const g of GENS) {
      for (let seed = 1; seed <= 30; seed++) {
        const { html, wealth, game } = render(g, seed * 13, false);
        const status = /data-testid="roulette-status">([^]*?)<\/p>/.exec(html)![1].replace(/<span class="nowrap">([^<]*)<\/span>/g, '$1');
        const band = bandLabel(startBandOf(wealthMixtureOfGame(game), wealth as 1));
        expect(status, `${g} ${seed}: 구간 「(${band})」가 한 묶음`).toContain(`<span class="grade-line__range" data-testid="grade-range"><span class="keep-phrase">(${band})</span></span>`);
        expect(status.replace(/<[^>]+>/g, '')).toContain(GRADE_NAME[wealth as 1]);
        // 괄호가 묶음 밖에 따로 남지 않는다(묶음 하나뿐; 눈에 안 보이는 한 줄 폭 탐침의 data-text는 글자가 아니라 속성이다)
        expect(status.replace(/<span class="fit-pair__probe"[^>]*><\/span>/, '').replace(/<span class="keep-phrase">\([^<]*\)<\/span>/, '')).not.toMatch(/[()]/);
        grades.add(wealth);
      }
    }
    expect([...grades].sort(), '공허 통과 방지: 다섯 수저 단계가 모두 나왔다').toEqual([1, 2, 3, 4, 5]);
  });

  it('R-274: 결과 상태의 수저 릴은 가운데 칸이 저장된 수저 단계이고 위아래 두 칸이 이웃 단계로 이어진다 (흙수저 위아래에 다이아몬드수저가 없다)', () => {
    for (const g of ['industrial', 'genx', 'alpha'] as const) {
      for (let seed = 1; seed <= 60; seed++) {
        const { html, wealth } = render(g, seed * 29, false);
        const reel = /data-testid="reel-wealth"[^>]*>([^]*?)<\/ul>/.exec(html)![1];
        const grades = [...reel.matchAll(/<li class="reel__item[^"]*"[^>]*>[^]*?data-grade="(\d)"/g)].map((m) => Number(m[1]));
        expect(grades, `${g} ${seed}`).toHaveLength(5);
        expect(grades[2]).toBe(wealth);
        for (let k = 0; k < 4; k++) expect(Math.abs(grades[k] - grades[k + 1]), `${g} ${seed} ${grades.join('')}`).toBe(1);
      }
    }
  });

  it('회전 상태: 제목 「태어날 집과 땅을 고르는 중」, 건너뛰기 버튼, 결과 문장·고지는 보이지 않는다(고지 줄은 자리만 차지하고 aria-hidden) — 릴은 aria-hidden', () => {
    const { html, text } = render('genx', 1, true);
    expect(text).toContain(ROULETTE_TEXT.spinTitle);
    expect(text).toContain(ROULETTE_TEXT.spinNote);
    expect(text).not.toContain(ROULETTE_TEXT.doneTitle);
    expect(html).toContain('data-testid="skip-roulette"');
    expect(html).not.toContain('data-testid="to-birth"');
    expect(html).toMatch(/data-testid="reel-wealth" data-state="spinning"/);
    expect(html.match(/class="reel[^"]*" aria-hidden="true"/g)).toHaveLength(2);
    expect(html).toMatch(/class="t-xs t-faint roulette__after" data-testid="page-foot" aria-hidden="true"/);
  });

  it('GS3 · N3: 「랜덤 세대」로 태어난 판의 회전은 먼저 세대 뽑기 단계(일곱 세대 릴, 세대별 1/7 표)를 거친다 — 고른 세대로 태어난 판에는 이 단계가 없다', () => {
    const rnd = render('random', 3, true);
    expect(rnd.game.fromRandom).toBe(true);
    expect(rnd.text).toContain(ROULETTE_GEN_TEXT.drawTitle);
    expect(rnd.text).toContain(ROULETTE_GEN_TEXT.drawNote);
    expect(rnd.html).toContain('data-testid="reel-generation"');
    expect(rnd.html).toContain('data-testid="odds-generation"');
    expect(rnd.html.match(/1\/7/g)).toHaveLength(7);
    expect(rnd.html).toContain('data-testid="skip-roulette"');
    // 세대 뽑기 단계에도 뽑힌 해는 없다
    const drawRangeEnds = GENERATIONS.flatMap((x) => [x.birth.from, x.birth.to]);
    if (!drawRangeEnds.includes(rnd.year)) expect(rnd.text).not.toContain(String(rnd.year));
    const chosen = render('genx', 3, true);
    expect(chosen.html).not.toContain('reel-generation');
    // 복원된 판(연출 아님)은 곧바로 결과 상태다
    const restored = render('random', 3, false);
    expect(restored.html).not.toContain('reel-generation');
    expect(restored.text).toContain(ROULETTE_TEXT.doneTitle);
    expect(restored.text).toContain(ROULETTE_GEN_TEXT.fromRandom);
  });

  it('직접 고른 시도(RG2 d): 지역 릴은 고른 칸에 멈춰 있고, 지역 표 자리에는 「직접 고른 시도」만 있다 — 확률을 지어내지 않는다', () => {
    const { html, text, region } = render('genx', 4, false, '서울');
    expect(region).toBe('서울');
    expect(html).toMatch(/data-testid="reel-region" data-state="stopped"/);
    expect(text).toContain(ROULETTE_GEN_TEXT.pickedRegion);
    expect(html).not.toContain('data-testid="odds-region-note"');
    const regionTable = /data-testid="odds-region">([^]*?)<\/table>/.exec(html);
    expect(regionTable === null || !/<td>\d+\.\d%<\/td>/.test(regionTable[1])).toBe(true);
    // 회전 중에는 시도를 직접 골랐다는 안내가 나온다
    expect(render('genx', 4, true, '서울').text).toContain(ROULETTE_GEN_TEXT.spinNotePicked);
  });

  it('QM3-4(마스터 확인 2): 회전 중 안내 문단은 화면 안내문이라 해요체로 통일한다 — 문구 전체 단언 「…고를 수 없어요. 확률대로 돌아가요.」, 합쇼체 종결(「…ㅂ니다.」)이 없고 화면에 그대로 나온다', () => {
    const note = '어느 집, 어느 땅에 태어날지는 고를 수 없어요. 확률대로 돌아가요.';
    expect(ROULETTE_TEXT.spinNote).toBe(note);
    const sentences = note.split(/(?<=\.)\s+/);
    expect(sentences).toHaveLength(2);
    for (const sentence of sentences) {
      expect(sentence, `해요체 종결: ${sentence}`).toMatch(/요\.$/);
      expect(sentence, `합쇼체 종결 없음: ${sentence}`).not.toMatch(/(니다)\.$/);
    }
    const { text } = render('genx', 1, true);
    expect(text).toContain(note);
    expect(text).not.toContain('돌아갑니다');
  });

  it('확률표: 수저 5행(합 100%)과 지역 행(합 100.0%)이 모두 화면에 있고, 주석(설계값·표 머리 「{세대} 전체 기준」)이 붙는다 — 세대 7종', () => {
    for (const g of GENS) {
      const { html, text } = render(g, 3, false);
      const wealthTable = /data-testid="odds-wealth">([^]*?)<\/table>/.exec(html)![1];
      const wealthPercents = [...wealthTable.matchAll(/<td>(\d+)%<\/td>/g)].map((m) => Number(m[1]));
      expect(wealthPercents).toEqual(REF[g].wealth);
      const regionTable = /data-testid="odds-region">([^]*?)<\/table>/.exec(html)![1];
      const regionPercents = [...regionTable.matchAll(/<td>(\d+\.\d)%<\/td>/g)].map((m) => Math.round(Number(m[1]) * 10));
      expect(regionPercents.reduce((a, b) => a + b, 0)).toBe(1000);
      expect(regionPercents.length).toBe(REF[g].region.length);
      expect(text).toContain(ROULETTE_GEN_TEXT.oddsHead(profileLabel(g)));
      expect(text).toContain('설계값');
      expect(text).not.toMatch(/외모\s*\d+\s*점|접속자/);
    }
  });

  it('RL1 · M3-O09 · R-301: 움직임 줄이기(결과 상태)에서도 후보 전체는 릴 아래 확률표로 보인다 — 릴은 결과 칸 앞뒤 2칸(5칸: 지역은 확률표 순서의 이웃 칸, 수저는 왕복 순서의 이웃 단계)뿐이고, 릴의 칸은 모두 확률표에 있다', () => {
    for (const g of GENS) {
      const { html, wealth, region } = render(g, 7, false);
      const items = (testId: string) => {
        const reel = new RegExp(`data-testid="${testId}"[^>]*>([^]*?)</ul>`).exec(html)![1];
        return [...reel.matchAll(/<li class="reel__item[^"]*"[^>]*>([^]*?)<\/li>/g)].map((m) => m[1].replace(/<[^>]+>/g, '').trim());
      };
      const wealthReel = items('reel-wealth');
      const regionReel = items('reel-region');
      const table = /data-testid="odds-region">([^]*?)<\/table>/.exec(html)![1];
      const tableNames = [...table.matchAll(/<th scope="row">([^<]*)<\/th>/g)].map((m) => m[1]);
      expect(tableNames.length, `${g}: 확률표의 지역 후보`).toBe(REF[g].region.length);
      expect(tableNames.length, `${g}: 지역 후보가 릴 5칸보다 많다 — 릴에는 일부만 보인다`).toBeGreaterThan(5);
      expect(regionReel, `${g}: 지역 릴은 결과 칸 앞뒤 2칸`).toHaveLength(5);
      expect(regionReel[2], `${g}: 가운데 칸이 결과`).toBe(region);
      for (const name of regionReel) expect(tableNames, `${g}: 릴의 칸 「${name}」은 확률표에도 있다`).toContain(name);
      expect(new Set(tableNames).size, '확률표의 후보 이름은 겹치지 않는다').toBe(tableNames.length);
      // 수저 릴도 결과 칸 앞뒤 2칸(5칸)이다 — 왕복 순서라 5단계가 다 보이는 것은 은수저 결과뿐이고, 후보 5단계 전체는 확률표 5행이 보인다
      const wealthTable = /data-testid="odds-wealth">([^]*?)<\/table>/.exec(html)![1];
      const wealthNames = [...wealthTable.matchAll(/<th scope="row">([^<]*)<\/th>/g)].map((m) => m[1]);
      expect(wealthNames, `${g}: 수저 확률표는 후보 5단계 전체`).toEqual([1, 2, 3, 4, 5].map((n) => GRADE_NAME[n as 1]));
      expect(wealthReel, `${g}: 수저 릴은 결과 칸 앞뒤 2칸`).toHaveLength(5);
      expect(wealthReel[2], `${g}: 가운데 칸이 결과`).toBe(GRADE_NAME[wealth as 1]);
      for (const name of wealthReel) expect(wealthNames, `${g}: 릴의 칸 「${name}」은 확률표에도 있다`).toContain(name);
    }
  });

  it('R-301: 결과 상태의 수저 릴은 결과 ±2칸이 이웃 단계(한 단계씩 이어진다)이고, 다섯 수저 단계 어느 결과에서도 5칸이다 — 5단계가 다 보이는 것은 은수저 결과뿐이라 나머지 단계의 후보는 확률표가 보인다', () => {
    const level = (name: string): number => [1, 2, 3, 4, 5].find((n) => GRADE_NAME[n as 1] === name)!;
    const seen = new Set<number>();
    for (const g of ['industrial', 'genx', 'alpha'] as const) {
      for (let seed = 1; seed <= 600 && seen.size < 5; seed++) {
        const { html, wealth } = render(g, seed * 17, false);
        const reel = /data-testid="reel-wealth" data-state="stopped"[^>]*>([^]*?)<\/ul>/.exec(html)![1];
        const names = [...reel.matchAll(/<li class="reel__item[^"]*"[^>]*>([^]*?)<\/li>/g)].map((m) => m[1].replace(/<[^>]+>/g, '').trim());
        expect(names, `${g} ${seed}`).toHaveLength(5);
        const levels = names.map(level);
        expect(levels[2], `${g} ${seed}: 가운데 칸이 결과`).toBe(wealth);
        for (let k = 0; k < 4; k++) expect(Math.abs(levels[k] - levels[k + 1]), `${g} ${seed} ${levels.join('')}: 이웃 단계`).toBe(1);
        expect(levels, `${g} ${seed}: 왕복 순서의 결과 앞뒤 2칸`).toEqual(restCells(WEALTH_REEL_ORDER.length, wealthReelIndex(wealth as 1)).map((i) => WEALTH_REEL_ORDER[i]));
        expect(new Set(levels).size === 5, `${g} ${seed} ${levels.join('')}: 5단계가 모두 보이는 것은 은수저(3단계) 결과뿐`).toBe(wealth === 3);
        seen.add(wealth);
      }
    }
    expect([...seen].sort(), '공허 통과 방지: 다섯 수저 단계가 모두 한 번 이상 나왔다').toEqual([1, 2, 3, 4, 5]);
  });

  it('수저 이름 「다이아몬드수저」가 확률표·릴에 그대로 나온다 (RL4)', () => {
    const { text } = render('genx', 4, false);
    expect(text).toContain('다이아몬드수저');
    expect(text).toContain(GRADE_NAME[5]);
  });
});
