import rouletteSrc from '../src/core/roulette.ts?raw';
import reelSrc from '../src/ui/Reel.tsx?raw';
import rouletteScreenSrc from '../src/screens/RouletteScreen.tsx?raw';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  ERAS,
  PARENT_WEALTHS,
  ROULETTE_TIMING,
  WEALTH_REEL_ORDER,
  beginBirth,
  buildRoulette,
  createInitialState,
  generateBirthFromSeed,
  largestRemainder,
  reelPosition,
  sumScaled,
  wealthReelIndex,
  type Era,
} from '../src/core';
import { ERA_CONFIG } from '../src/data/birthTable';
import { GRADE_NAME, ROULETTE_TEXT, regionOddsNote } from '../src/data/birthReportText';
import { bandLabel } from '../src/data/endingText';
import { startBandOf } from '../src/core/ending';
import { REGION_ORDER } from '../src/data/regionNames';
import { getUsableIndicator } from '../src/data/koreaStatsAccess';
import { RouletteScreen } from '../src/screens/RouletteScreen';
import { restCells, spinCells, spinCycles } from '../src/ui/Reel';
import { rawRegions } from '../scripts/pipelineLib';
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

describe('buildRoulette: 확률표와 멈출 자리 (RL2·RL3)', () => {
  for (const era of ERAS) {
    it(`${era}: 수저 확률 = 시대 가중치(합 100), 지역 확률 = 원자료 시·도 출생아 비율(합 100.0, 룰렛 순서), 멈출 자리 = 저장된 출생 결과`, () => {
      const born = beginBirth(createInitialState(99), era);
      const view = buildRoulette(era, born.character!, born.birthReport!);
      expect(view.wealthOdds.map((o) => o.wealth)).toEqual([...PARENT_WEALTHS]);
      expect(view.wealthOdds.map((o) => o.percent)).toEqual([...ERA_CONFIG[era].wealthWeights]);
      expect(sumScaled(view.wealthOdds.map((o) => o.percent), 0)).toBe(100);
      const raw = rawRegions(born.character!.birthYear)!; // 지역 목록은 출생 연도에 따라 다르다(지난 세상은 1950~89 중 그 판의 연도)
      expect(view.regionOdds).toHaveLength(raw.length);
      expect(sumScaled(view.regionOdds.map((o) => o.percent), 1)).toBe(1000);
      for (const o of view.regionOdds) expect(o.percent, o.name).toBe(raw.find((r) => r.name === o.name)!.sharePct);
      // 룰렛 순서: REGION_ORDER의 부분 목록(회전·결과·움직임 줄이기가 같은 순서, R-171)
      expect(view.regionOdds.map((o) => o.name)).toEqual(REGION_ORDER.filter((n) => raw.some((r) => r.name === n)));
      expect(view.wealthIndex).toBe(born.character!.parentWealth - 1);
      expect(view.regionOdds[view.regionIndex].name).toBe(born.birthReport!.region);
    });
  }

  it('RL2: 결과 = 출생 로직 결과 — 세 시대 × 시드 1000개 전부, 룰렛이 멈출 자리는 generateBirth가 정한 값이다 (룰렛은 난수를 뽑지 않는다)', () => {
    for (const era of ERAS) {
      for (let seed = 1; seed <= 1000; seed++) {
        const b = generateBirthFromSeed(seed * 8191, era);
        const view = buildRoulette(era, b.character, b.report);
        expect(view.wealthOdds[view.wealthIndex].wealth, `${era} ${seed}`).toBe(b.character.parentWealth);
        expect(view.regionOdds[view.regionIndex].name, `${era} ${seed}`).toBe(b.report.region);
      }
    }
  });

  it('같은 입력이면 같은 룰렛이다(순수 함수) — 호출을 되풀이해도 결과가 바뀌지 않는다 (다시 굴리기 없음)', () => {
    const born = beginBirth(createInitialState(5), 'present');
    const a = buildRoulette('present', born.character!, born.birthReport!);
    for (let i = 0; i < 20; i++) expect(buildRoulette('present', born.character!, born.birthReport!)).toEqual(a);
  });

  it('R-187: 지역 확률의 성격 — 지금 세상은 통계 파생, 지난·다가올 세상은 설계값', () => {
    const view = (era: Era) => {
      const b = beginBirth(createInitialState(7), era);
      return buildRoulette(era, b.character!, b.birthReport!);
    };
    expect(view('present').basis).toBe('statistic-derived');
    expect(view('past').basis).toBe('design');
    expect(view('future').basis).toBe('design');
  });

  it('지역이 그 출생 연도의 목록에 없으면 throw (손상된 저장은 저장 검증이 먼저 거른다)', () => {
    const born = beginBirth(createInitialState(7), 'present');
    expect(() => buildRoulette('present', born.character!, { region: '울산광역시' })).toThrow(RangeError);
  });
});

describe('확률 표기 문구 (RL3)', () => {
  const stats = getUsableIndicator('birth-by-sido')!;
  const source = { org: stats.source.org, year: stats.latest.year };

  it('지금 세상: 기준 연도·출처·합산 안내, 지난·다가올 세상: 「지금 통계를 바탕으로 한 설계값」', () => {
    const now = regionOddsNote('statistic-derived', 'present', source);
    expect(now).toContain(`${source.year}년`);
    expect(now).toContain(source.org);
    expect(now).toContain('광주·전남은 통합(2026)에 맞춰 합산');
    expect(now).not.toContain('설계값');
    const past = regionOddsNote('design', 'past', source);
    expect(past).toContain('지금 통계를 바탕으로 한 설계값');
    expect(past).toContain('실제 당시 분포가 아니에요');
    const future = regionOddsNote('design', 'future', source);
    expect(future).toContain('지금 통계를 바탕으로 한 설계값');
    expect(ROULETTE_TEXT.wealthOddsNote).toBe('게임의 설계값이에요(통계가 아님).');
    for (const t of [now, past, future, ...Object.values(ROULETTE_TEXT)]) expect(t).not.toMatch(/[!！]|접속자/);
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

  it('buildRoulette: 세 시대 × 시드 500개 전부, 릴 칸 목록은 왕복 순서이고 멈출 칸의 단계 = 저장된 출생 결과 (결과 무결성 — 릴은 저장된 결과에서 멈춘다)', () => {
    for (const era of ERAS) {
      for (let seed = 1; seed <= 500; seed++) {
        const b = generateBirthFromSeed(seed * 6007, era);
        const view = buildRoulette(era, b.character, b.report);
        expect(view.wealthReel, `${era} ${seed}`).toEqual([...WEALTH_REEL_ORDER]);
        expect(view.wealthReel[view.wealthReelIndex], `${era} ${seed}`).toBe(b.character.parentWealth);
      }
    }
  });

  it('릴 칸 수가 바뀐 만큼 바퀴 수도 따라간다: 수저 릴 8칸도 총 이동이 30칸 이상이고 한 바퀴의 정수배다', () => {
    const total = spinCycles(WEALTH_REEL_ORDER.length) * WEALTH_REEL_ORDER.length;
    expect(total).toBeGreaterThanOrEqual(30);
    expect(total % WEALTH_REEL_ORDER.length).toBe(0);
  });
});

describe('룰렛 화면 서버 렌더 (결과 모양 · 회전 모양)', () => {
  const render = (era: Era, seed: number, spin: boolean): { html: string; text: string; wealth: number; region: string; year: number } => {
    const born = beginBirth(createInitialState(seed), era);
    const html = renderToStaticMarkup(<RouletteScreen era={era} character={born.character!} report={born.birthReport!} spin={spin} onFinishSpin={() => {}} onNext={() => {}} />);
    // 줄바꿈 묶음(ui/Glue.tsx)의 span은 글자를 바꾸지 않는 표시일 뿐이라 벗겨 낸다 — 태그를 공백으로 바꾸는 규칙이 묶음 안에 공백을 넣어 「흙수저(하위…」가 「흙수저 (하위…」로 읽히지 않게 (tests/titleScreen.test.tsx와 같다)
    const unglued = html.replace(/<span class="nowrap">([^<]*)<\/span>/g, '$1').replace(/<span class="keep-phrase">([^<]*)<\/span>/g, '$1');
    return { html, text: unglued.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(), wealth: born.character!.parentWealth, region: born.birthReport!.region, year: born.character!.birthYear };
  };

  it('결과 상태(복원·움직임 줄이기·건너뛴 뒤): 제목 「태어날 곳이 정해졌습니다」, 상태 줄에 「{수저}({구간}) · {시·도}」, 결과 아래 작은 글, 「출생신고 보기」 — 건너뛰기는 없다', () => {
    for (const era of ERAS) {
      for (let seed = 1; seed <= 30; seed++) {
        const { html, text, wealth, region } = render(era, seed * 13, false);
        expect(text, `${era} ${seed}`).toContain(ROULETTE_TEXT.doneTitle);
        expect(text).toContain(`${GRADE_NAME[wealth as 1]}(${bandLabel(startBandOf(era, wealth as 1))})`);
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

  it('M3-O13: 결과 문장의 구간 표기 「(상위 3% 안쪽)」은 괄호째 한 묶음(keep-phrase)이다 — 줄이 바뀌어도 「(상위 / 3% 안쪽)」으로 갈리지 않는다 (세 시대 × 시드 30개, 다섯 수저 단계 모두, 수저 이름은 묶음 밖)', () => {
    const grades = new Set<number>();
    for (const era of ERAS) {
      for (let seed = 1; seed <= 30; seed++) {
        const { html, wealth } = render(era, seed * 13, false);
        const status = /data-testid="roulette-status">([^]*?)<\/p>/.exec(html)![1].replace(/<span class="nowrap">([^<]*)<\/span>/g, '$1');
        const band = bandLabel(startBandOf(era, wealth as 1));
        expect(status, `${era} ${seed}: 구간 「(${band})」가 한 묶음`).toContain(`${GRADE_NAME[wealth as 1]}<span class="keep-phrase">(${band})</span>`);
        // 괄호가 묶음 밖에 따로 남지 않는다(묶음 하나뿐; 눈에 안 보이는 한 줄 폭 탐침의 data-text는 글자가 아니라 속성이다)
        expect(status.replace(/<span class="fit-pair__probe"[^>]*><\/span>/, '').replace(/<span class="keep-phrase">\([^<]*\)<\/span>/, '')).not.toMatch(/[()]/);
        grades.add(wealth);
      }
    }
    expect([...grades].sort(), '공허 통과 방지: 다섯 수저 단계가 모두 나왔다').toEqual([1, 2, 3, 4, 5]);
  });

  it('R-274: 결과 상태의 수저 릴은 가운데 칸이 저장된 수저 단계이고 위아래 두 칸이 이웃 단계로 이어진다 (흙수저 위아래에 다이아몬드수저가 없다)', () => {
    for (const era of ERAS) {
      for (let seed = 1; seed <= 60; seed++) {
        const { html, wealth } = render(era, seed * 29, false);
        const reel = /data-testid="reel-wealth"[^>]*>([^]*?)<\/ul>/.exec(html)![1];
        const grades = [...reel.matchAll(/<li class="reel__item[^"]*"[^>]*>[^]*?data-grade="(\d)"/g)].map((m) => Number(m[1]));
        expect(grades, `${era} ${seed}`).toHaveLength(5);
        expect(grades[2]).toBe(wealth);
        for (let k = 0; k < 4; k++) expect(Math.abs(grades[k] - grades[k + 1]), `${era} ${seed} ${grades.join('')}`).toBe(1);
      }
    }
  });

  it('회전 상태: 제목 「태어날 집과 땅을 고르는 중」, 건너뛰기 버튼, 결과 문장·고지는 보이지 않는다(고지 줄은 자리만 차지하고 aria-hidden) — 릴은 aria-hidden', () => {
    const { html, text } = render('present', 1, true);
    expect(text).toContain(ROULETTE_TEXT.spinTitle);
    expect(text).toContain(ROULETTE_TEXT.spinNote);
    expect(text).not.toContain(ROULETTE_TEXT.doneTitle);
    expect(html).toContain('data-testid="skip-roulette"');
    expect(html).not.toContain('data-testid="to-birth"');
    expect(html).toMatch(/data-testid="reel-wealth" data-state="spinning"/);
    expect(html.match(/class="reel[^"]*" aria-hidden="true"/g)).toHaveLength(2);
    expect(html).toMatch(/class="t-xs t-faint roulette__after" data-testid="page-foot" aria-hidden="true"/);
  });

  it('QM3-4(마스터 확인 2): 회전 중 안내 문단은 화면 안내문이라 해요체로 통일한다 — 문구 전체 단언 「…고를 수 없어요. 확률대로 돌아가요.」, 합쇼체 종결(「…ㅂ니다.」)이 없고 화면에 그대로 나온다 (이전 구현은 「…돌아갑니다.」)', () => {
    const note = '어느 집, 어느 땅에 태어날지는 고를 수 없어요. 확률대로 돌아가요.';
    expect(ROULETTE_TEXT.spinNote).toBe(note);
    const sentences = note.split(/(?<=\.)\s+/);
    expect(sentences).toHaveLength(2);
    for (const sentence of sentences) {
      expect(sentence, `해요체 종결: ${sentence}`).toMatch(/요\.$/);
      expect(sentence, `합쇼체 종결 없음: ${sentence}`).not.toMatch(/(니다)\.$/);
    }
    const { text } = render('present', 1, true);
    expect(text).toContain(note);
    expect(text).not.toContain('돌아갑니다');
  });

  it('확률표: 수저 5행(합 100%)과 지역 행(합 100.0%)이 모두 화면에 있고, 주석(설계값·출처)이 붙는다 — 세 시대', () => {
    for (const era of ERAS) {
      const { html, text, year } = render(era, 3, false);
      const wealthTable = /data-testid="odds-wealth">([^]*?)<\/table>/.exec(html)![1];
      const wealthPercents = [...wealthTable.matchAll(/<td>(\d+)%<\/td>/g)].map((m) => Number(m[1]));
      expect(wealthPercents).toHaveLength(5);
      expect(wealthPercents.reduce((a, b) => a + b, 0)).toBe(100);
      const regionTable = /data-testid="odds-region">([^]*?)<\/table>/.exec(html)![1];
      const regionPercents = [...regionTable.matchAll(/<td>(\d+\.\d)%<\/td>/g)].map((m) => Math.round(Number(m[1]) * 10));
      expect(regionPercents.reduce((a, b) => a + b, 0)).toBe(1000);
      expect(regionPercents.length).toBe(rawRegions(year)!.length); // 지역 칸 수는 그 판의 출생 연도 기준
      expect(text).toContain(ROULETTE_TEXT.wealthOddsNote);
      expect(text).toContain(era === 'present' ? '국가데이터처' : '지금 통계를 바탕으로 한 설계값');
      expect(text).not.toMatch(/외모\s*\d+\s*점|접속자/);
    }
  });

  it('RL1 · M3-O09 · R-301: 움직임 줄이기(결과 상태)에서도 후보 전체는 릴 아래 확률표로 보인다 — 릴은 결과 칸 앞뒤 2칸(5칸: 지역은 확률표 순서의 이웃 칸, 수저는 왕복 순서의 이웃 단계)뿐이고, 수저 후보 5단계와 지역 후보 전체(14~16곳)는 확률표(합 100%)가 보인다', () => {
    for (const era of ERAS) {
      const { html, wealth, region, year } = render(era, 7, false);
      const items = (testId: string) => {
        const reel = new RegExp(`data-testid="${testId}"[^>]*>([^]*?)</ul>`).exec(html)![1];
        return [...reel.matchAll(/<li class="reel__item[^"]*"[^>]*>([^]*?)<\/li>/g)].map((m) => m[1].replace(/<[^>]+>/g, '').trim());
      };
      const wealthReel = items('reel-wealth');
      const regionReel = items('reel-region');
      const table = /data-testid="odds-region">([^]*?)<\/table>/.exec(html)![1];
      const tableNames = [...table.matchAll(/<th scope="row">([^<]*)<\/th>/g)].map((m) => m[1]);
      expect(tableNames.length, `${era}: 확률표의 지역 후보`).toBe(rawRegions(year)!.length);
      expect(tableNames.length, `${era}: 지역 후보가 릴 5칸보다 많다 — 릴에는 일부만 보인다`).toBeGreaterThan(5);
      expect(regionReel, `${era}: 지역 릴은 결과 칸 앞뒤 2칸`).toHaveLength(5);
      expect(regionReel[2], `${era}: 가운데 칸이 결과`).toBe(region);
      for (const name of regionReel) expect(tableNames, `${era}: 릴의 칸 「${name}」은 확률표에도 있다`).toContain(name);
      expect(new Set(tableNames).size, '확률표의 후보 이름은 겹치지 않는다').toBe(tableNames.length);
      // 수저 릴도 결과 칸 앞뒤 2칸(5칸)이다 — 왕복 순서라 5단계가 다 보이는 것은 은수저 결과뿐이고, 후보 5단계 전체는 확률표 5행이 보인다 (아래 시험이 다섯 단계를 모두 훑는다)
      const wealthTable = /data-testid="odds-wealth">([^]*?)<\/table>/.exec(html)![1];
      const wealthNames = [...wealthTable.matchAll(/<th scope="row">([^<]*)<\/th>/g)].map((m) => m[1]);
      expect(wealthNames, `${era}: 수저 확률표는 후보 5단계 전체`).toEqual([1, 2, 3, 4, 5].map((g) => GRADE_NAME[g as 1]));
      expect(wealthReel, `${era}: 수저 릴은 결과 칸 앞뒤 2칸`).toHaveLength(5);
      expect(wealthReel[2], `${era}: 가운데 칸이 결과`).toBe(GRADE_NAME[wealth as 1]);
      for (const name of wealthReel) expect(wealthNames, `${era}: 릴의 칸 「${name}」은 확률표에도 있다`).toContain(name);
    }
  });

  it('R-301: 결과 상태의 수저 릴은 결과 ±2칸이 이웃 단계(한 단계씩 이어진다)이고, 다섯 수저 단계 어느 결과에서도 5칸이다 — 5단계가 다 보이는 것은 은수저 결과뿐이라 나머지 단계의 후보는 확률표로 보인다', () => {
    const level = (name: string): number => [1, 2, 3, 4, 5].find((g) => GRADE_NAME[g as 1] === name)!;
    const seen = new Set<number>();
    for (const era of ERAS) {
      for (let seed = 1; seed <= 400 && seen.size < 5 * ERAS.length; seed++) {
        const { html, wealth } = render(era, seed * 17, false);
        const reel = /data-testid="reel-wealth" data-state="stopped"[^>]*>([^]*?)<\/ul>/.exec(html)![1];
        const names = [...reel.matchAll(/<li class="reel__item[^"]*"[^>]*>([^]*?)<\/li>/g)].map((m) => m[1].replace(/<[^>]+>/g, '').trim());
        expect(names, `${era} ${seed}`).toHaveLength(5);
        const levels = names.map(level);
        expect(levels[2], `${era} ${seed}: 가운데 칸이 결과`).toBe(wealth);
        for (let k = 0; k < 4; k++) expect(Math.abs(levels[k] - levels[k + 1]), `${era} ${seed} ${levels.join('')}: 이웃 단계`).toBe(1);
        expect(levels, `${era} ${seed}: 왕복 순서의 결과 앞뒤 2칸`).toEqual(restCells(WEALTH_REEL_ORDER.length, wealthReelIndex(wealth as 1)).map((i) => WEALTH_REEL_ORDER[i]));
        expect(new Set(levels).size === 5, `${era} ${seed} ${levels.join('')}: 5단계가 모두 보이는 것은 은수저(3단계) 결과뿐`).toBe(wealth === 3);
        seen.add(wealth * 10 + ERAS.indexOf(era));
      }
    }
    expect([...new Set([...seen].map((v) => Math.floor(v / 10)))].sort(), '공허 통과 방지: 다섯 수저 단계가 모두 한 번 이상 나왔다').toEqual([1, 2, 3, 4, 5]);
  });

  it('수저 이름 「다이아몬드수저」가 확률표·릴에 그대로 나온다 (RL4)', () => {
    const { text } = render('present', 4, false);
    expect(text).toContain('다이아몬드수저');
    expect(text).toContain(GRADE_NAME[5]);
  });
});
