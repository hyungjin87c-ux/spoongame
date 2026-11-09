import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { startLife } from '../scripts/simulateLib';
import { DEFAULT_SETTINGS, advanceUntilDecision, resolveChoice, type GameState, type Settings } from '../src/core';
import { ASK_UNKNOWN_IMPACT_TEXT } from '../src/data/askTable';
import { LifeScreen } from '../src/screens/LifeScreen';
import type { LifeGame } from '../src/ui/dash/Cards';
import type { YearClock } from '../src/ui/useYearClock';

/**
 * 조르기 카드 화면 (SPEC-011 AK8 — `docs/design/copy.md` 20-2): 지금의 선택 카드(모달 시트 · 자동 모드 인라인)를 그대로 쓴다. 조른다·떼를 쓴다에는 영향 줄 대신 **고정 한 줄**
 * 「들어주실지는 알 수 없습니다」, 참는다에는 지금의 영향 줄(「행복 ▼」). 새 화면·새 줄 종류는 없다. 실제 사건(`src/data/events/ask.json`)으로 본다.
 */

const CLOCK: YearClock = { get: () => 0, subscribe: () => () => undefined };
const noop = () => undefined;
const asLife = (g: GameState): LifeGame => ({ ...g, character: g.character!, generation: g.generation!, birthReport: g.birthReport!, peerSeed: g.peerSeed! });
const settingsOf = (o: Partial<Settings> = {}): Settings => ({ ...DEFAULT_SETTINGS, speed: 1, autoMode: false, ...o });

function render(game: GameState, auto = false): string {
  return renderToStaticMarkup(
    <LifeScreen game={asLife(game)} settings={settingsOf({ autoMode: auto })} clock={CLOCK} exitOpen={false} onExitOpen={noop} folded={false} guardEpoch={0} onFold={noop} onReopen={noop} onChoose={noop} onSkip={noop} onSpeed={noop} onAuto={noop} onPause={noop} onBgm={noop} onTheme={noop} onExit={noop} minute={29_846_880} repoUrl="https://github.com/hyungjin87c-ux/spoongame" buildLabel="v0.1.0 (abc1234)" />,
  );
}

/** 조르기 카드가 대기 중인 판 — 「다음 결정으로」가 멈춘 자리 */
function askCardState(): GameState {
  for (let seed = 1; seed <= 400; seed++) {
    const s = advanceUntilDecision(startLife(seed, 'millennial')).state;
    if (s.pending !== null && s.pending.eventId.startsWith('ask-')) return s;
  }
  throw new Error('조르기 카드가 대기 중인 판을 찾지 못했다');
}
/** 일반 선택 카드가 대기 중인 판 (조르기가 아닌 첫 본인 카드) — 대조용 */
function plainCardState(): GameState {
  for (let seed = 1; seed <= 400; seed++) {
    let s = startLife(seed, 'millennial');
    for (let guard = 0; guard < 40 && s.phase === 'life'; guard++) {
      s = advanceUntilDecision(s).state;
      if (s.pending === null) break;
      if (!s.pending.eventId.startsWith('ask-') && s.pending.choiceIds.length >= 2) return s;
      s = resolveChoice(s, s.pending.key, s.pending.choiceIds[0]);
    }
  }
  throw new Error('일반 선택 카드를 찾지 못했다');
}

const choiceHtml = (html: string, id: string): string => {
  const at = html.indexOf(`data-testid="choice-${id}"`);
  expect(at, `choice-${id}`).toBeGreaterThan(-1);
  const end = html.indexOf('</button>', at);
  return html.slice(at, end);
};
const text = (html: string) => html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

describe('조르기 카드: 조른다·떼를 쓴다는 고정 한 줄, 참는다는 영향 줄', () => {
  const state = askCardState();
  for (const [name, auto] of [['모달 시트(자동 모드 꺼짐)', false], ['비모달 인라인(자동 모드 켜짐)', true]] as const) {
    it(`${name}: 라벨 셋이 이 순서이고 조른다·떼를 쓴다에는 「${ASK_UNKNOWN_IMPACT_TEXT}」, 참는다에는 행복 ▼ 영향 줄이 있다`, () => {
      const html = render(state, auto);
      const labels = [...html.matchAll(/class="choice__label">([^<]*)</g)].map((m) => m[1]);
      expect(labels).toEqual(['조른다', '떼를 쓴다', '참는다']);
      for (const id of ['beg', 'tantrum']) {
        const c = choiceHtml(html, id);
        expect(c, id).toContain('data-testid="impact-fixed"');
        expect(c, id).not.toContain('data-testid="impact"');
        // 고정 한 줄의 글자는 그 문장 하나뿐이다 — 확률의 방향·숫자를 말하지 않는다
        expect(text(c.slice(c.indexOf('>', c.indexOf('impact-fixed')) + 1)), id).toBe(ASK_UNKNOWN_IMPACT_TEXT);
      }
      const endure = choiceHtml(html, 'endure');
      expect(endure).not.toContain('impact-fixed');
      expect(endure).toContain('data-testid="impact"');
      expect(endure).toContain('data-key="happiness"');
      expect(endure).toContain('data-direction="down"');
      expect((html.match(/data-testid="impact-fixed"/g) ?? []).length).toBe(2);
    });
  }

  it('고정 한 줄은 새 줄 종류가 아니다: 영향 줄과 같은 .impact 안에 앉고, 일반 선택 카드에는 나오지 않는다', () => {
    const html = render(state);
    expect(html).toContain('class="impact impact--fixed"');
    expect(render(plainCardState())).not.toContain('impact-fixed');
  });
});
