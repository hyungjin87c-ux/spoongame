import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, playToEnd, stepYear, type EndingGame, type GameState, type Settings } from '../src/core';
import { ageText } from '../src/core/format';
import { EndingScreen } from '../src/screens/EndingScreen';
import { LifeScreen } from '../src/screens/LifeScreen';
import type { LifeGame } from '../src/ui/dash/Cards';
import type { YearClock } from '../src/ui/useYearClock';
import { chooserFor, startLife } from '../scripts/simulateLib';
import { inAgeView } from './helpers/ageView';

/**
 * 나이 보기가 화면에 따라 붙는다 (SPEC-019): 같은 판(같은 시드)을 한국 나이(기본)와 만 나이로 그려 헤더·기록 줄·가족 카드·엔딩이 함께 바뀌는지 본다.
 * 게임 상태는 두 번 모두 같은 객체다 — 바뀌는 것은 화면 숫자뿐이다.
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

function renderLife(game: GameState, ageView: Settings['ageView']): string {
  return renderToStaticMarkup(
    <LifeScreen
      game={asLife(game)}
      settings={{ ...DEFAULT_SETTINGS, speed: 1, autoMode: false, ageView }}
      clock={CLOCK}
      exitOpen={false}
      onExitOpen={noop}
      onChoose={noop}
      onSkip={noop}
      onSpeed={noop}
      onAuto={noop}
      onPause={noop}
      onBgm={noop}
      onTheme={noop}
      onExit={noop}
    />,
  );
}
const text = (html: string) => html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
const attrOf = (tag: string, name: string) => new RegExp(`\\s${name}="([^"]*)"`).exec(tag)?.[1] ?? null;
const tagOf = (html: string, testid: string) => {
  const at = html.indexOf(`data-testid="${testid}"`);
  expect(at, testid).toBeGreaterThan(-1);
  return html.slice(html.lastIndexOf('<', at), html.indexOf('>', at) + 1);
};
/** data-testid 요소 하나(span이면 </span>까지, p면 </p>까지)의 글자 — 공백은 모두 없앤다(숫자와 「세」 사이에 묶음 요소가 낄 수 있다) */
const blockOf = (html: string, testid: string) => {
  const at = html.indexOf(`data-testid="${testid}"`);
  const open = html.lastIndexOf('<', at);
  const tag = html.slice(open + 1, open + 5).startsWith('p') ? '</p>' : '</span>';
  return html.slice(open, html.indexOf(tag, at) + tag.length);
};
const flatText = (html: string) => text(html).replace(/\s/g, '');
const logAges = (html: string): string[] => [...html.matchAll(/<span class="log__age">([^<]*)(?:<small|<\/span>)/g)].map((m) => m[1]);
const familyAges = (html: string): number[] => [...html.matchAll(/<span class="family-who">([^<]*)<\/span>/g)].flatMap((m) => {
  const n = /(\d+)세$/.exec(m[1].trim());
  return n === null ? [] : [Number(n[1])];
});

describe('인생 화면: 헤더 · 기록 · 가족 카드가 나이 보기를 따른다', () => {
  const korean = renderLife(adult, 'korean');
  const man = renderLife(adult, 'man');

  it('헤더 알약: 한국 나이 「N+1세」(읽기 이름 「한국 나이 …」) · 만 나이 「만 N세」(「만 나이 …」)', () => {
    expect(flatText(blockOf(korean, 'life-age'))).toBe(ageText(adult.age, 'korean'));
    expect(attrOf(tagOf(korean, 'life-age'), 'aria-label')).toBe(`한국 나이 ${adult.age + 1}세`);
    expect(flatText(blockOf(man, 'life-age'))).toBe(`만${adult.age}세`);
    expect(attrOf(tagOf(man, 'life-age'), 'aria-label')).toBe(`만 나이 ${adult.age}세`);
  });

  it('전환 버튼: 한국 나이일 때 「만 나이」(이름 「만 나이로 보기」) · 만 나이일 때 「한국 나이」(이름 「한국 나이로 보기」) — 지금과 반대 기준을 적는다', () => {
    const kSwitch = tagOf(korean, 'age-switch');
    expect(attrOf(kSwitch, 'aria-label')).toBe('만 나이로 보기');
    expect(korean.slice(korean.indexOf(kSwitch), korean.indexOf('</button>', korean.indexOf(kSwitch)))).toContain('>만 나이');
    const mSwitch = tagOf(man, 'age-switch');
    expect(attrOf(mSwitch, 'aria-label')).toBe('한국 나이로 보기');
    expect(man.slice(man.indexOf(mSwitch), man.indexOf('</button>', man.indexOf(mSwitch)))).toContain('>한국 나이');
    expect(attrOf(kSwitch, 'type')).toBe('button');
  });

  it('인생 기록 줄: 한국 나이는 +1, 만 나이는 저장된 나이 그대로이고 목록에는 「만」을 붙이지 않는다', () => {
    const k = logAges(korean);
    const m = logAges(man);
    expect(k.length).toBeGreaterThan(5);
    expect(m).toHaveLength(k.length);
    for (let i = 0; i < k.length; i++) expect(Number.parseInt(k[i], 10)).toBe(Number.parseInt(m[i], 10) + 1);
    expect(m.every((a) => /^\d+세$/.test(a))).toBe(true);
  });

  it('가족 카드: 모든 가족 나이가 한 살씩 어리다(떠난 사람의 별세 나이 포함)', () => {
    const k = familyAges(korean);
    const m = familyAges(man);
    expect(k.length).toBeGreaterThan(0);
    expect(k).toEqual(m.map((n) => n + 1));
    const goneK = [...korean.matchAll(/(\d+)세에 세상을 떠남/g)].map((x) => Number(x[1]));
    const goneM = [...man.matchAll(/(\d+)세에 세상을 떠남/g)].map((x) => Number(x[1]));
    expect(goneK).toEqual(goneM.map((n) => n + 1));
  });

  it('두 화면의 나머지는 같다: 나이 글자를 지우면 같은 글자다 (표시만 바뀐다)', () => {
    const strip = (h: string) => text(h).replace(/만?\s*\d+\s*세/g, '').replace(/만\s*나이|한국\s*나이/g, '').replace(/\s+/g, '');
    expect(strip(man)).toBe(strip(korean));
  });
});

describe('엔딩: 머리 「만」 · 사망 문장 · 연표 · 생애 구간', () => {
  const ended = playToEnd(startLife(7, 'alpha'), chooserFor('random', 7)).state as EndingGame;
  const render = (view: Settings['ageView']) => renderToStaticMarkup(inAgeView(<EndingScreen game={ended} onRebirth={noop} />, view));

  it('한국 나이: 머리 「… · N+1세」 · 사망 「N+1세에 …」 · 연표 줄 +1 · 구간 「영유아 · 1~7세」', () => {
    const html = render('korean');
    const flat = text(html);
    expect(flatText(blockOf(html, 'ending-span'))).toContain(`·${ended.death.age + 1}세`);
    expect(flatText(blockOf(html, 'ending-span'))).not.toContain('만');
    expect(flat).toContain(`${ended.death.age + 1}세에 세상을 떠났습니다`);
    expect(flatText(html)).toContain('영유아·1~7세');
  });

  it('만 나이: 머리에만 「만 N세」, 사망 문장·연표 줄·구간에는 「만」이 없다', () => {
    const html = render('man');
    const flat = text(html);
    expect(flatText(blockOf(html, 'ending-span'))).toContain(`·만${ended.death.age}세`);
    expect(flat).toContain(`${ended.death.age}세에 세상을 떠났습니다`);
    expect(flat).not.toContain(`만 ${ended.death.age}세에`);
    expect(flatText(html)).toContain('영유아·0~6세');
    const ages = [...html.matchAll(/data-testid="timeline-entry"><span class="log__age">(\d+)세/g)].map((m) => Number(m[1]));
    expect(ages).toEqual(ended.history.map((h) => h.age));
  });
});
