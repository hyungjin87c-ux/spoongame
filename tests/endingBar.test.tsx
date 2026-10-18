import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ERAS, PARENT_WEALTHS, finalWealthStanding, playToEnd, reviewEnding, standingScore, startBandOf, type EndingGame, type Era } from '../src/core';
import { ERA_CONFIG } from '../src/data/birthTable';
import { standingLabel } from '../src/data/birthText';
import { ENDING_HEAD_LABEL, JOURNEY_BAR_LEGEND, MOVEMENT_TEXT, bandLabel, endingSpanText, journeyBarLabel } from '../src/data/endingText';
import { EndingScreen } from '../src/screens/EndingScreen';
import { EXPECTED_START_BANDS } from '../scripts/pipelineLib';
import { chooserFor, startLife } from '../scripts/simulateLib';

/**
 * 엔딩 새 디자인 (SPEC-003 M7e-3, REV-003-M4-1 R-327, docs/design/copy.md 5-4): 머리 「{세상} · 생애 기록」 + 「{출생 연월} ~ {사망 연도}년 · {나이}세」, 출발선 막대(구간 띠 + 50% 눈금 + 마지막 마름모),
 * 범례(출발선 = 수저 칩 + 「({구간})」, 마지막 = 자리), 읽기용 이름(role="img" aria-label = 함수 조합). 막대의 숫자는 모두 구현 함수(startBandOf·standingScore)에서 오고, 이 시험은 손으로 적은 표
 * (scripts/pipelineLib.ts#EXPECTED_START_BANDS — 재력 가중치 누적을 따로 계산한 값)와 대조한다. 색·넘침·글자 크기·강제 색상은 e2e/m7e3-ending.spec.ts가 실제 브라우저로 본다.
 */

/** vitest는 CSS의 ?raw 가져오기를 빈 문자열로 돌려주므로 파일 시스템으로 읽는다(tests/contrast.test.ts와 같은 방법) */
async function readText(relative: string): Promise<string> {
  const spec = 'node:fs';
  const fs = (await import(/* @vite-ignore */ spec)) as { readFileSync(path: URL, encoding: 'utf-8'): string };
  return fs.readFileSync(new URL(relative, import.meta.url), 'utf-8');
}
const dashCss = await readText('../src/styles/dash.css');

const endingOf = (seed: number, era: Era): EndingGame => playToEnd(startLife(seed, era), chooserFor('random', seed)).state as EndingGame;
const render = (g: EndingGame) => renderToStaticMarkup(<EndingScreen game={g} onRebirth={() => {}} />);
const textOf = (html: string) => html.replace(/<\/?(?:span|strong|em)[^>]*>/g, '').replace(/<[^>]+>/g, ' ').replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();

/** 부모 재력 단계와 최종 순자산(만 원)을 정해 그린다 */
function gameWith(base: EndingGame, wealth: 1 | 2 | 3 | 4 | 5, net: number): EndingGame {
  return { ...base, character: { ...base.character, parentWealth: wealth }, assets: { ...base.assets!, net, debt: Math.max(base.assets!.debt, -net) } };
}
const attr = (html: string, name: string): string => new RegExp(`${name}="([^"]*)"`).exec(html)![1];
const barOf = (html: string): string => html.slice(html.indexOf('<div class="journey__bar"'), html.indexOf('</div></div>', html.indexOf('<div class="journey__bar"')) + 12);

describe('엔딩 출발선 막대: 기하는 구현 함수가 정하고, 손으로 적은 구간표와 같다 (R-327)', () => {
  const bases = Object.fromEntries(ERAS.map((era) => [era, endingOf(2024, era)])) as Record<Era, EndingGame>;

  it('세 시대 × 재력 5단계 × 도착 자리(분위수표의 5·50·95번째 칸 순자산): 띠의 --from·--to는 손으로 계산한 구간과 같고, 마름모 --at은 도착 점수(standingScore)다', () => {
    let checked = 0;
    for (const era of ERAS) {
      for (const wealth of PARENT_WEALTHS) {
        for (const net of [-3000, 0, 5000, 90000]) {
          const g = gameWith(bases[era], wealth, net);
          const html = render(g);
          const bar = barOf(html);
          const [low, high] = EXPECTED_START_BANDS[era][wealth - 1];
          const band = /<span class="journey__band" style="([^"]*)"/.exec(bar)![1];
          expect(band, `${era} ${wealth}단계`).toBe(`--from:${low}%;--to:${high}%`);
          const review = reviewEnding(g);
          expect(review.journey.kind).toBe('compared');
          if (review.journey.kind !== 'compared') continue;
          const at = /<span class="journey__end" style="--at:(\d+)%"/.exec(bar)![1];
          expect(Number(at), `${era} ${wealth}단계 순자산 ${net}`).toBe(standingScore(finalWealthStanding(era, net)));
          expect(Number(at)).toBeGreaterThanOrEqual(1);
          expect(Number(at)).toBeLessThanOrEqual(99);
          checked++;
        }
      }
    }
    expect(checked).toBe(3 * 5 * 4);
  });

  it('구현 함수와 손으로 적은 표가 같다: startBandOf의 low·high가 모든 시대·단계에서 EXPECTED_START_BANDS와 같고, 0 ≤ low ≤ high ≤ 100이다', () => {
    for (const era of ERAS) {
      for (const wealth of PARENT_WEALTHS) {
        const b = startBandOf(era, wealth);
        expect([b.low, b.high], `${era} ${wealth}`).toEqual([...EXPECTED_START_BANDS[era][wealth - 1]]);
        expect(b.low).toBeGreaterThanOrEqual(0);
        expect(b.high).toBeLessThanOrEqual(100);
        expect(b.low).toBeLessThanOrEqual(b.high);
      }
    }
  });

  it('막대는 읽기용 이름 하나를 가진다: role="img" + aria-label = 「출발선 {구간}, 마지막 {자리}.」 (함수 조합 — 방향 문장은 바로 아래 문장이 읽는다, M7e-4 관찰 7), 축 글자(하위·상위)는 aria-hidden이다', () => {
    for (const era of ERAS) {
      const g = gameWith(bases[era], 3, 20000);
      const html = render(g);
      const review = reviewEnding(g);
      expect(review.journey.kind).toBe('compared');
      if (review.journey.kind !== 'compared') continue;
      expect((html.match(/role="img" aria-label="출발선/g) ?? []).length, era).toBe(1);
      const label = attr(/<div class="journey__bar"[^>]*>/.exec(html)![0], 'aria-label');
      expect(label).toBe(journeyBarLabel(review.journey));
      expect(label).toBe(`출발선 ${bandLabel(review.journey.start)}, 마지막 ${standingLabel(review.journey.end)}.`);
      // 방향 문장은 aria-label에 없고(스크린리더 중복 제거) 그 아래 문장 한 곳에만 있다
      for (const m of Object.values(MOVEMENT_TEXT)) expect(label, m).not.toContain(m);
      expect(html).toContain(`data-testid="ending-movement">${MOVEMENT_TEXT[review.journey.movement]}</p>`);
      expect(html).toContain('<div class="journey__axis" aria-hidden="true"><span>하위</span><span>상위</span></div>');
      expect(html).toContain('<span class="journey__mid"></span>');
    }
  });

  it('스무 살 전에 끝난 인생: 띠만 그리고 마름모·「마지막」 줄이 없다. 읽기용 이름은 「출발선 {구간}.」', () => {
    for (const era of ERAS) {
      const base = bases[era];
      const young: EndingGame = { ...base, age: 9, assets: null, character: { ...base.character, parentWealth: 2 }, death: { ...base.death, age: 9, cause: '사고' } };
      const html = render(young);
      expect(html).not.toContain('journey__end"');
      expect(html).not.toContain('journey__key--end');
      expect(html).not.toContain('data-testid="ending-legend-end"');
      expect(html).toContain('journey__band');
      const label = attr(/<div class="journey__bar"[^>]*>/.exec(html)![0], 'aria-label');
      expect(label).toBe(`출발선 ${bandLabel(startBandOf(era, 2))}.`);
      expect(label).not.toContain('마지막');
    }
  });
});

describe('엔딩 범례와 머리 (R-327)', () => {
  const base = endingOf(2024, 'present');

  it('범례: 출발선 = 수저 칩(이 인물의 부모 재력 단계) + 「({구간})」, 마지막 = 자리 글자. 표식 두 개는 aria-hidden이고 모양이 다르다(띠 모양 · 마름모)', () => {
    for (const wealth of PARENT_WEALTHS) {
      const g = gameWith(base, wealth, 8000);
      const html = render(g);
      const legend = /<dl class="journey__legend"[^>]*>[^]*?<\/dl>/.exec(html)![0];
      expect(legend).toContain(`data-grade="${wealth}"`);
      expect(textOf(/data-testid="grade-range">([^]*?)<\/dd>/.exec(legend)![1])).toBe(`(${bandLabel(startBandOf('present', wealth))})`);
      expect(legend).toContain('<i class="journey__key journey__key--band" aria-hidden="true"></i>');
      expect(legend).toContain('<i class="journey__key journey__key--end" aria-hidden="true"></i>');
      expect(textOf(legend)).toContain(JOURNEY_BAR_LEGEND.start);
      expect(textOf(legend)).toContain(JOURNEY_BAR_LEGEND.end);
      expect(textOf(/data-testid="ending-legend-end">([^]*?)<\/dd>/.exec(legend)![1])).toBe(standingLabel(finalWealthStanding('present', 8000)));
    }
  });

  it('머리: 라벨 「{세상} · 생애 기록」(Glue)과 셋째 줄 「{출생 연월} ~ {사망 연도}년 · {나이}세」 — 예전 출생 줄은 없다', () => {
    for (const era of ERAS) {
      const g = endingOf(7, era);
      const html = render(g);
      expect(textOf(/data-testid="ending-era">([^]*?)<\/p>/.exec(html)![1])).toBe(`${ERA_CONFIG[era].label} · ${ENDING_HEAD_LABEL}`);
      const c = g.character;
      expect(textOf(/data-testid="ending-span">([^]*?)<\/p>/.exec(html)![1])).toBe(endingSpanText(c.birthYear, g.birthReport!.month, c.birthYear + g.death.age, g.death.age));
      expect(textOf(/data-testid="ending-span">([^]*?)<\/p>/.exec(html)![1])).toMatch(/^\d{4}년 \d{1,2}월 ~ \d{4}년 · \d+세$/);
      expect(html).not.toContain('data-testid="ending-born"');
    }
    expect(endingSpanText(2026, 1, 2110, 84)).toBe('2026년 1월 ~ 2110년 · 84세');
    expect(endingSpanText(2026, null, 2110, 84)).toBe('2026년 ~ 2110년 · 84세');
  });
});

describe('엔딩 막대 CSS (dash.css): 시안 ds.css 블록을 글자 그대로 옮겼고 색은 토큰만 쓰며 강제 색상 다섯 줄이 있다', () => {
  const rule = (sel: string): string => {
    const i = dashCss.indexOf(`${sel} {`);
    expect(i, sel).toBeGreaterThan(-1);
    return dashCss.slice(i, dashCss.indexOf('}', i) + 1);
  };

  it('띠(left/width = --from/--to)·마름모(left = --at)·가운데 눈금·축·범례·표식 규칙이 있다', () => {
    expect(rule('.journey__band')).toMatch(/left: var\(--from, 0%\)/);
    expect(rule('.journey__band')).toMatch(/width: calc\(var\(--to, 0%\) - var\(--from, 0%\)\)/);
    expect(rule('.journey__end')).toMatch(/left: var\(--at, 50%\)/);
    expect(rule('.journey__mid')).toMatch(/left: 50%/);
    expect(rule('.journey__track')).toMatch(/margin: 0 12px/);
    expect(rule('.journey__legend > div')).toMatch(/flex-wrap: wrap/);
    expect(rule('.journey__key')).toMatch(/border: 2px solid var\(--c-brand\)/);
    expect(rule('.journey__key--end')).toMatch(/transform: rotate\(45deg\)/);
  });

  it('색 값을 직접 적지 않는다(토큰만): 막대 규칙 본문에 16진 색이 없다. 자리 글자 규칙 .final-net__standing은 없어졌다', () => {
    const block = dashCss.slice(dashCss.indexOf('.journey {'), dashCss.indexOf('.journey__key--end'));
    expect(block.length).toBeGreaterThan(500);
    expect(block).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(dashCss).not.toContain('.final-net__standing');
  });

  it('강제 색상(forced-colors): 선·눈금·띠 테두리는 CanvasText, 띠 안은 Canvas, 마름모는 CanvasText 채움 + Canvas 테두리 — 다섯 줄', () => {
    const forced = dashCss.slice(dashCss.indexOf('@media (forced-colors: active)', dashCss.indexOf('강제 색상(고대비)')));
    expect(forced).toMatch(/\.journey__track::before \{ background: CanvasText; \}/);
    expect(forced).toMatch(/\.journey__mid \{ border-left-color: CanvasText; \}/);
    expect(forced).toMatch(/\.journey__band, \.journey__key \{ background: Canvas; border-color: CanvasText; \}/);
    expect(forced).toMatch(/\.journey__end, \.journey__key--end \{ forced-color-adjust: none; background: CanvasText; border-color: Canvas; \}/);
  });
});
