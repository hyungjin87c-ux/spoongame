import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { PARENT_WEALTHS, playToEnd, reviewEnding, startBandOf, wealthMixtureOfProfile, type EndingGame, type GenerationId, type ProfileId } from '../src/core';
import { genLine } from '../src/data/birthReportText';
import { profileLabel } from '../src/core/birthProfile';
import { ENDING_HEAD_LABEL, endingSpanText } from '../src/data/endingText';
import { EndingScreen } from '../src/screens/EndingScreen';
import { EXPECTED_START_BANDS, roundTrip } from '../scripts/pipelineLib';
import { SIM_PROFILES } from '../scripts/simulateLib';
import { chooserFor, startLife } from '../scripts/simulateLib';

/**
 * 엔딩 화면 시험 (SPEC-003 M7e-3 머리 + 결정 후속 256 삭제 잠금). 머리 「{세상} · 생애 기록」 + 「{출생 연월} ~ {사망 연도}년 · {나이}세」는 그대로이고,
 * 출발선 막대·범례·도착 자리·이동 판정(R-327)은 2026-11-13에 삭제했다 — 이 파일은 그것이 **없다**는 것과, 남긴 것(최종 순자산 줄·수저 구간 함수·저장을 다시 열어도 같은 회고)을 잠근다.
 * (파일 이름의 「Bar」는 옛 막대 시험에서 온 것이다.)
 */

/** vitest는 CSS의 ?raw 가져오기를 빈 문자열로 돌려주므로 파일 시스템으로 읽는다(tests/contrast.test.ts와 같은 방법) */
async function readText(relative: string): Promise<string> {
  const spec = 'node:fs';
  const fs = (await import(/* @vite-ignore */ spec)) as { readFileSync(path: URL, encoding: 'utf-8'): string };
  return fs.readFileSync(new URL(relative, import.meta.url), 'utf-8');
}
const dashCss = await readText('../src/styles/dash.css');

const endingOf = (seed: number, era: ProfileId): EndingGame => playToEnd(startLife(seed, era), chooserFor('random', seed)).state as EndingGame;
const render = (g: EndingGame) => renderToStaticMarkup(<EndingScreen game={g} onRebirth={() => {}} />);
const textOf = (html: string) => html.replace(/<\/?(?:span|strong|em)[^>]*>/g, '').replace(/<[^>]+>/g, ' ').replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();

/** 부모 재력 단계와 최종 순자산(만 원)을 정해 그린다 */
function gameWith(base: EndingGame, wealth: 1 | 2 | 3 | 4 | 5, net: number): EndingGame {
  return { ...base, character: { ...base.character, parentWealth: wealth }, assets: { ...base.assets!, net, debt: Math.max(base.assets!.debt, -net) } };
}

describe('엔딩에 「출발선 대비」 카드가 없다 (결정 후속 256, 2026-11-13 삭제): 막대·범례·도착 자리·이동 판정·안내 줄', () => {
  const bases = Object.fromEntries(SIM_PROFILES.map((era) => [era, endingOf(2024, era)])) as Record<ProfileId, EndingGame>;

  it('세 시대 × 재력 5단계 × 20세 넘어 마친 판: 출발선 카드의 마크업·testid·문구가 하나도 없다', () => {
    let checked = 0;
    for (const era of SIM_PROFILES) {
      for (const wealth of PARENT_WEALTHS) {
        for (const net of [-3000, 0, 5000, 90000]) {
          const html = render(gameWith(bases[era], wealth, net));
          for (const id of ['ending-journey-section', 'ending-journey', 'ending-bar', 'ending-bar-end', 'ending-movement', 'ending-legend', 'ending-legend-end', 'ending-note']) {
            expect(html, `${era} ${wealth}단계 ${id}`).not.toContain(`data-testid="${id}"`);
          }
          expect(html).not.toContain('journey');
          expect(html).not.toContain('출발선보다');
          expect(html).not.toContain('출발선과 비슷한');
          expect(html).not.toContain('출발선에서 마지막까지');
          expect(html).not.toContain('형편으로 생을 마쳤습니다');
          checked++;
        }
      }
    }
    expect(checked).toBe(3 * 5 * 4);
  });

  it('최종 순자산 줄: 20세 넘어 마친 판에만 금액이 있고(final-net-value), 20세 전에 끝난 판에는 금액 없이 안내 한 줄(final-net-none)뿐이다', () => {
    for (const era of SIM_PROFILES) {
      const base = bases[era];
      expect(base.death.age, `${era} 기준 판은 20세 넘어 마쳤다`).toBeGreaterThanOrEqual(20);
      const adult = render(gameWith(base, 3, 20000));
      expect(adult).toContain('data-testid="final-net"');
      expect(adult).toContain('data-testid="final-net-value"');
      expect(adult).not.toContain('data-testid="final-net-none"');
      const young: EndingGame = { ...base, age: 9, assets: null, character: { ...base.character, parentWealth: 2 }, death: { ...base.death, age: 9, cause: '사고' } };
      const html = render(young);
      expect(html).toContain('data-testid="final-net"');
      expect(html).toContain('data-testid="final-net-none"');
      expect(html).not.toContain('data-testid="final-net-value"');
      // 20세 넘어 마쳤어도 자산이 없는 상태(이어 받은 저장 따위)면 금액을 그리지 않는다
      const noAssets = render({ ...base, assets: null });
      expect(noAssets).not.toContain('data-testid="final-net-value"');
    }
  });

  it('구현 함수와 손으로 적은 표가 같다: startBandOf의 low·high가 모든 시대·단계에서 EXPECTED_START_BANDS와 같고, 0 ≤ low ≤ high ≤ 100이다 (룰렛·출생신고·프로필의 수저 구간이 쓰는 함수 — 엔딩에서는 안 쓰지만 남긴다)', () => {
    for (const era of SIM_PROFILES) {
      for (const wealth of PARENT_WEALTHS) {
        const b = startBandOf(wealthMixtureOfProfile(era), wealth);
        expect([b.low, b.high], `${era} ${wealth}`).toEqual([...EXPECTED_START_BANDS[era as GenerationId][wealth - 1]]);
        expect(b.low).toBeGreaterThanOrEqual(0);
        expect(b.high).toBeLessThanOrEqual(100);
        expect(b.low).toBeLessThanOrEqual(b.high);
      }
    }
  });

  it('엔딩 회고(reviewEnding)는 저장하지 않고 열 때마다 계산한다: 같은 판을 저장했다 다시 열어도 같은 회고이고, 회고에 출발선 대비(journey)가 없다', () => {
    for (const era of SIM_PROFILES) {
      const game = bases[era];
      const reopened = roundTrip(game, `${era} 엔딩 저장`);
      expect(reopened.problems, era).toEqual([]);
      expect(reviewEnding(reopened.restored as EndingGame), era).toEqual(reviewEnding(game));
      expect(Object.keys(reviewEnding(game)).sort(), era).toEqual(['changes', 'choiceCount', 'delegated', 'timeline']);
      expect(JSON.stringify(game)).not.toContain('journey');
    }
  });
});

describe('엔딩 머리 (R-327)', () => {
  it('머리: 라벨 「{세상} · 생애 기록」(Glue)과 셋째 줄 「{출생 연월} ~ {사망 연도}년 · {나이}세」 — 예전 출생 줄은 없다', () => {
    for (const era of SIM_PROFILES) {
      const g = endingOf(7, era);
      const html = render(g);
      expect(textOf(/data-testid="ending-era">([^]*?)<\/p>/.exec(html)![1])).toBe(ENDING_HEAD_LABEL);
      // 세대·출생 연도는 머리의 「{세대} · {연도}년생」 줄이 처음 보인다 (GS9·GD2)
      expect(textOf(/data-testid="ending-gen">([^]*?)<\/p>/.exec(html)![1])).toContain(genLine(profileLabel(era), g.character.birthYear));
      const c = g.character;
      expect(textOf(/data-testid="ending-span">([^]*?)<\/p>/.exec(html)![1])).toBe(endingSpanText(c.birthYear, g.birthReport!.month, c.birthYear + g.death.age, g.death.age));
      expect(textOf(/data-testid="ending-span">([^]*?)<\/p>/.exec(html)![1])).toMatch(/^\d{4}년 \d{1,2}월 ~ \d{4}년 · \d+세$/);
      expect(html).not.toContain('data-testid="ending-born"');
    }
    expect(endingSpanText(2026, 1, 2110, 84)).toBe('2026년 1월 ~ 2110년 · 85세');
    expect(endingSpanText(2026, null, 2110, 84)).toBe('2026년 ~ 2110년 · 85세');
    expect(endingSpanText(2026, 1, 2110, 84)).not.toContain('만'); // 엔딩 머리에도 「만」 표기가 없다(SPEC-019 r2 — 만 나이는 인생 화면 헤더에만)
  });
});

describe('엔딩 CSS (dash.css): 출발선 막대 규칙(.journey*)이 없고, 최종 순자산 줄 규칙은 남아 있다', () => {
  it('.journey* 규칙·강제 색상 줄이 없다', () => {
    expect(dashCss).not.toContain('.journey');
    expect(dashCss).not.toContain('엔딩 출발선 막대');
    expect(dashCss).not.toContain('.final-net__standing');
  });

  it('최종 순자산 줄(.final-net)과 연표(.timeline) 규칙은 그대로다', () => {
    expect(dashCss).toContain('.final-net {');
    expect(dashCss).toContain('.final-net__value');
    expect(dashCss).toContain('.timeline li {');
  });
});
