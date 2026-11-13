import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, playToEnd, stepYear, type EndingGame, type GameState } from '../src/core';
import { ageText } from '../src/core/format';
import { EndingScreen } from '../src/screens/EndingScreen';
import { LifeScreen } from '../src/screens/LifeScreen';
import type { LifeGame } from '../src/ui/dash/Cards';
import type { YearClock } from '../src/ui/useYearClock';
import { chooserFor, startLife } from '../scripts/simulateLib';

/**
 * 나이 표시 (SPEC-019 r2): 화면의 사람 나이는 모두 한국 나이(게임 나이 + 1)이고, 인생 화면 헤더 알약 옆에만 작은 「만 N세」(게임 나이)가 있다.
 * 전환 버튼은 없다. 엔딩 머리를 포함한 다른 곳에는 「만」 표기가 없다.
 */

const CLOCK: YearClock = { get: () => 0, subscribe: () => () => undefined };
const noop = () => undefined;
const asLife = (g: GameState): LifeGame => ({ ...g, character: g.character!, generation: g.generation!, birthReport: g.birthReport!, peerSeed: g.peerSeed! });

function ageTo(g: GameState, age: number): GameState {
  let s = g;
  for (let i = 0; i < 300 && s.phase === 'life' && s.age < age; i++) s = s.pending ? { ...s, pending: null } : stepYear(s).state;
  return s;
}
const adult = ageTo(startLife(11, 'alpha', { looks: 97 }), 31);

const life = renderToStaticMarkup(
  <LifeScreen game={asLife(adult)} settings={{ ...DEFAULT_SETTINGS, speed: 1, autoMode: false }} clock={CLOCK} exitOpen={false} onExitOpen={noop} onChoose={noop} onSkip={noop} onSpeed={noop} onAuto={noop} onPause={noop} onBgm={noop} onTheme={noop} onExit={noop} />,
);
const text = (html: string) => html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
const flatText = (html: string) => text(html).replace(/\s/g, '');
const attrOf = (tag: string, name: string) => new RegExp(`\\s${name}="([^"]*)"`).exec(tag)?.[1] ?? null;
/** data-testid 요소 하나(p면 </p>, small이면 </small>, 아니면 </span>까지) */
const blockOf = (html: string, testid: string) => {
  const at = html.indexOf(`data-testid="${testid}"`);
  const open = html.lastIndexOf('<', at);
  const name = /^<(\w+)/.exec(html.slice(open))![1];
  return html.slice(open, html.indexOf(`</${name}>`, at) + name.length + 3);
};
const logAges = (html: string): string[] => [...html.matchAll(/<span class="log__age">([^<]*)(?:<small|<\/span>)/g)].map((m) => m[1]);
const familyAges = (html: string): number[] =>
  [...html.matchAll(/<span class="family-who">([^<]*)<\/span>/g)].flatMap((m) => {
    const n = /(\d+)세$/.exec(m[1].trim());
    return n === null ? [] : [Number(n[1])];
  });

describe('인생 화면: 한국 나이 + 헤더의 작은 만 나이', () => {
  it('알약은 한국 나이 「N+1세」, 옆에 작은 글자 「만 N세」, 묶음의 읽기 이름은 「한국 나이 N+1세, 만 N세」', () => {
    expect(flatText(blockOf(life, 'life-age'))).toBe(ageText(adult.age));
    expect(flatText(blockOf(life, 'life-age-man'))).toBe(`만${adult.age}세`);
    const group = life.slice(life.lastIndexOf('<span class="who__ages"', life.indexOf('data-testid="life-age"')), life.indexOf('data-testid="life-age"'));
    expect(attrOf(group, 'role')).toBe('img');
    expect(attrOf(group, 'aria-label')).toBe(`한국 나이 ${adult.age + 1}세, 만 ${adult.age}세`);
  });

  it('전환 버튼은 없다 (알약 묶음에 버튼이 없고 age-switch도 없다)', () => {
    expect(life).not.toContain('age-switch');
    expect(life).not.toContain('만 나이로 보기');
    expect(life).not.toContain('한국 나이로 보기');
    const header = life.slice(life.indexOf('data-testid="dash-head"'), life.indexOf('</header>'));
    expect(header).not.toMatch(/<button[^>]*>\s*(만 나이|한국 나이)/);
  });

  it('작은 글자 「만」은 헤더 밖에 없다: 기록 줄·가족 카드 나이에 「만」이 붙지 않는다', () => {
    const k = logAges(life);
    expect(k.length).toBeGreaterThan(5);
    expect(k.every((a) => /^\d+세$/.test(a))).toBe(true);
    const header = life.slice(life.indexOf('data-testid="dash-head"'), life.indexOf('</header>'));
    expect(text(header).match(/만 \d+세/g)).toHaveLength(1); // 헤더 한 곳(본문의 통계 문장 「만 19세 이하」 같은 것은 헤더 밖)
    expect(text(life.slice(life.indexOf('class="log__rows"'))).includes(`만 ${adult.age}세`)).toBe(false);
    expect(text(life.slice(life.indexOf('data-testid="family-card"')))).not.toMatch(/(^|\s)만 \d+세/);
  });

  it('인생 기록 줄 나이는 저장된 게임 나이 + 1이고, 가족 카드의 나이도 한국 나이다', () => {
    const history = adult.history;
    const rows = logAges(life);
    expect(rows.length).toBeGreaterThan(5);
    expect(Number.parseInt(rows[0], 10)).toBe(history[history.length - 1].age + 1);
    expect(familyAges(life).length).toBeGreaterThan(0);
  });
});

describe('엔딩: 한국 나이, 「만」 표기 없음', () => {
  const ended = playToEnd(startLife(7, 'alpha'), chooserFor('random', 7)).state as EndingGame;
  const html = renderToStaticMarkup(<EndingScreen game={ended} onRebirth={noop} />);

  it('머리 「… · N+1세」 · 사망 「N+1세에 …」 · 연표 줄 +1 · 구간 「영유아 · 1~7세」, 어디에도 「만 N세」가 없다', () => {
    expect(flatText(blockOf(html, 'ending-span'))).toContain(`·${ended.death.age + 1}세`);
    expect(text(html)).toContain(`${ended.death.age + 1}세에 세상을 떠났습니다`);
    expect(flatText(html)).toContain('영유아·1~7세');
    expect(text(html)).not.toMatch(/(^|\s)만 \d+세/);
    const ages = [...html.matchAll(/data-testid="timeline-entry"><span class="log__age">(\d+)세/g)].map((m) => Number(m[1]));
    expect(ages).toEqual(ended.history.map((h) => h.age + 1));
  });
});
