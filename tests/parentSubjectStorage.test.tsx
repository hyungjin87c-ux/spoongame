import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import age20Legacy from './fixtures/save-v030-age20.json';
import bothRaw from './fixtures/save-v040-both-age20.json?raw';
import fatherRaw from './fixtures/save-v040-father-ended.json?raw';
import motherRaw from './fixtures/save-v040-mother-age20.json?raw';
import { DEFAULT_SETTINGS, SCHEMA_VERSION, coParentsFn, coParentsOf, ensureFamily, parseGame, playToEnd, reviewEnding, serializeGame, type CoParents, type EndingGame, type GameState, type HistoryEntry } from '../src/core';
import { EndingScreen } from '../src/screens/EndingScreen';
import { LifeScreen } from '../src/screens/LifeScreen';
import type { LifeGame } from '../src/ui/dash/Cards';
import type { YearClock } from '../src/ui/useYearClock';

/**
 * DS4 저장·소급 (SPEC-011, 완료 기준 22): `HistoryEntry`·저장 스키마·`family` 필드를 바꾸지 않고, v0.4.0이 낸 실제 저장 원문(`scripts/genSaveFixtures040.ts` — 태그 v0.4.0과 같은 src에서 만든 고정 파일)을
 * 열자마자 어린 시절 줄이 **그 줄의 나이로** 바른 주어를 그리며, 저장 JSON이 save → load → save에서 바이트 단위로 같다. 세 판(전부 같은 줄이 어디에 있는지는 생성 스크립트 머리말):
 *   - both(genx 5)   : 20세, 두 분 함께 — 부모 결정 줄 나이 0·2·4·11·16 모두 두 분
 *   - mother(genz 61): 20세, 아버지가 5세에 떠남(이혼) — 줄 1·5(떠난 해, 두 분)·12·18(어머니만)
 *   - father(genx 1502): 엔딩, 어머니가 3세에 별세 + `parents_gone` 켜짐 — 줄 0·3(별세한 해, 두 분)·7·12(아버지만)
 */

const CLOCK: YearClock = { get: () => 0, subscribe: () => () => undefined };
const noop = () => undefined;
const asLife = (g: GameState): LifeGame => ({ ...g, character: g.character!, generation: g.generation!, birthReport: g.birthReport!, peerSeed: g.peerSeed! });
const plain = (s: string): string => s.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

const FIXTURES: Array<{ name: string; raw: string; ending: boolean; golden: Record<number, CoParents> }> = [
  { name: 'both-age20', raw: bothRaw, ending: false, golden: { 0: 'both', 2: 'both', 4: 'both', 11: 'both', 16: 'both' } },
  { name: 'mother-age20', raw: motherRaw, ending: false, golden: { 1: 'both', 5: 'both', 12: 'mother', 18: 'mother' } },
  { name: 'father-ended', raw: fatherRaw, ending: true, golden: { 0: 'both', 3: 'both', 7: 'father', 12: 'father' } },
];
const NAME_OF: Record<CoParents, string> = { both: '부모님이', mother: '어머니가', father: '아버지가', none: '부모님이' };
const parentLines = (g: GameState): HistoryEntry[] => g.history.filter((h) => h.kind === 'choice' && h.by === 'parent');

function renderLife(game: GameState): string {
  return renderToStaticMarkup(
    <LifeScreen
      game={asLife(game)}
      tick={null}
      settings={{ ...DEFAULT_SETTINGS, speed: 1, autoMode: false }}
      clock={CLOCK}
      exitOpen={false}
      onExitOpen={noop}
      folded={false}
      guardEpoch={0}
      onFold={noop}
      onReopen={noop}
      onChoose={noop}
      onSkip={noop}
      onSpeed={noop}
      onAuto={noop}
      onPause={noop}
      onBgm={noop}
      onTheme={noop}
      onExit={noop}
      minute={29_846_880}
      repoUrl="https://github.com/hyungjin87c-ux/spoongame"
      buildLabel="v0.4.0 (6aadd90)"
    />,
  );
}

describe('v0.4.0 저장 원문 — 열자마자 줄의 나이로 바른 주어 (DS4)', () => {
  for (const f of FIXTURES) {
    describe(f.name, () => {
      const game = parseGame(f.raw)!;

      it('열린다 · 스키마 버전 그대로(9) · save → load → save가 바이트 단위로 같다', () => {
        expect(game).not.toBeNull();
        expect(SCHEMA_VERSION).toBe(9);
        expect(serializeGame(game) + '\n').toBe(f.raw);
        // 저장 필드는 늘지 않았다: 부모 결정 줄은 `by`만 갖고 주어는 어디에도 저장되지 않는다
        for (const h of parentLines(game)) expect(Object.keys(h).sort()).toEqual(['age', 'by', 'choice', 'eventId', 'kind', 'text', 'title']);
        expect(f.raw).not.toMatch(/어머니가 이렇게|아버지가 이렇게|부모님이 이렇게/);
      });

      it('줄마다 그 줄 나이의 주어가 정해진다 (고정한 기대표와 같다)', () => {
        const at = coParentsFn(game);
        const got = Object.fromEntries(parentLines(game).map((h) => [h.age, at(h.age)]));
        expect(got).toEqual(f.golden);
        for (const [age, co] of Object.entries(f.golden)) expect(coParentsOf(game, Number(age))).toBe(co);
      });

      if (!f.ending) {
        it('인생 화면의 기록 줄: 부모 결정 줄 모두 「{제목} / 그 해 주어가 이렇게 정했습니다: 라벨 / 결과」 (제목이 없는 옛 줄은 괄호 꼴)', () => {
          const log = plain(renderLife(game).slice(renderLife(game).indexOf('data-testid="log"')));
          // SPEC-012 QF4: v0.4.0 저장의 줄도 열자마자 저장된 title이 제목으로 나온다(새 필드 0). 제목이 없는 줄이면 지금 모양(괄호)
          for (const h of parentLines(game)) {
            const want = h.title ? `${h.title} ${NAME_OF[f.golden[h.age]]} 이렇게 정했습니다: ${h.choice} ${h.text}` : `${h.text} (${NAME_OF[f.golden[h.age]]} 이렇게 정했습니다: ${h.choice})`;
            expect(log, `${h.age}세 줄`).toContain(want);
          }
          expect(parentLines(game).filter((h) => h.title).length, '제목이 있는 줄이 실제로 있다(공허 통과 방지)').toBeGreaterThan(0);
          const singles = Object.values(f.golden).filter((c) => c !== 'both').length;
          const motherLines = (log.match(/어머니가 이렇게 정했습니다: /g) ?? []).length;
          expect(motherLines).toBe(f.name === 'mother-age20' ? singles : 0);
        });
      }

      it('끝까지 살아 엔딩을 열어도 같다: 연표 줄은 줄의 나이로 — 어른이 된 뒤(parents_gone) 그려도 어린 시절 줄의 주어는 그 해의 값이다 (요약 문장은 없다)', () => {
        const end = (f.ending ? game : playToEnd(game, null).state) as EndingGame;
        expect(end.phase).toBe('ending');
        const lines = parentLines(end);
        const html = renderToStaticMarkup(<EndingScreen game={end} onRebirth={noop} />);
        const picked = [...html.matchAll(/data-testid="timeline-picked"[^>]*>([\s\S]*?)<\/span>/g)].map((m) => plain(m[1]));
        for (const h of lines) expect(picked, `${h.age}세 연표 줄`).toContain(`${NAME_OF[f.golden[h.age]]} 이렇게 정했습니다: ${h.choice}`);
        const singles = Object.values(f.golden).filter((c) => c !== 'both').length;
        expect(html).not.toContain('data-testid="ending-delegated"'); // 형진 님 요청으로 요약 문장을 없앴다(2026-11-08)
        if (f.ending) {
          expect(end.flags).toContain('parents_gone'); // 어른이 된 뒤 사별 사건이 켠 플래그가 켜져 있어도
          expect(singles).toBeGreaterThan(0);
        }
      });
    });
  }

  it('v0.4.0 저장도 같은 판의 계획으로 소급한다: 같은 시드로 새로 태어난 판의 계획과 같은 값(저장은 출생 때 계획만 갖는다)', () => {
    // 저장에는 `family`(출생 때 한 번 뽑은 값)가 있다 — 이혼·별세 계획은 그 값과 시드에서 다시 계산한다
    const mother = parseGame(motherRaw)!;
    expect(mother.family).toBeDefined();
    expect(coParentsOf(mother, 5)).toBe('both');
    expect(coParentsOf(mother, 6)).toBe('mother');
  });
});

describe('family가 없는 구형 저장(v0.3.0)도 열린다 — legacyFamilyFrom이 계획을 즉석에서 만들고 주어는 같다', () => {
  it('열자마자 계획이 없으면 즉석에서 만든 계획과 ensureFamily가 채운 계획이 같은 주어를 낸다 (0~19세)', () => {
    const legacy = parseGame(JSON.stringify(age20Legacy))!;
    expect(legacy).not.toBeNull();
    expect(legacy.family).toBeUndefined();
    const filled = ensureFamily(legacy);
    expect(filled.family).toBeDefined();
    const a = coParentsFn(legacy);
    const b = coParentsFn(filled);
    for (let age = 0; age < 20; age++) expect(a(age), `${age}세`).toBe(b(age));
    // 엔딩까지 돌려도 던지지 않고, 부모 결정 줄이 있으면 주어를 단다
    const end = playToEnd(filled, null).state as EndingGame;
    const review = reviewEnding(end);
    for (const g of review.timeline) expect(g.subjects).toHaveLength(g.entries.length);
  });
});
