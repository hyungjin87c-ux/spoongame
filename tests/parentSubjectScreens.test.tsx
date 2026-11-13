import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SETTINGS,
  NO_DEATH_PLAN,
  buildTimeline,
  coParentsFn,
  coParentsOf,
  heavyKindOfEvent,
  playToEnd,
  possibleAgesOf,
  decisionFor,
  resolveDelegated,
  reviewEnding,
  type CoParents,
  type EndingGame,
  type FamilyData,
  type GameState,
  type HistoryEntry,
  type TickInfo,
} from '../src/core';
import { EVENT_POOL } from '../src/data/events';
import { HEAVY_KIND_TEXT } from '../src/data/gentleText';
import { PARENT_DECISION_TABLE, parentWording } from '../src/data/parentDecisionTable';
import { EndingScreen } from '../src/screens/EndingScreen';
import { LifeScreen } from '../src/screens/LifeScreen';
import type { LifeGame } from '../src/ui/dash/Cards';
import { LogCard } from '../src/ui/dash/LogCard';
import { ParentCard, parentCardModel } from '../src/ui/dash/ParentCard';
import type { YearClock } from '../src/ui/useYearClock';
import { startLife } from '../scripts/simulateLib';
import { forcedPending } from './helpers/forcedPending';

/**
 * DS2 도장 주어가 일곱 곳에 같은 함수로 그려진다 (SPEC-011, 완료 기준 20·21): ① 카드 칩·도장 ② 인생 기록 줄 ③ 엔딩 연표 줄 ④ 가린 줄·카드의 도장 ⑤ 첫 카드 안내 ⑥ 엔딩 요약 (⑦ 연출 필요량은 tests/parentSubject.test.ts).
 * 한 분만 함께 사는 해의 화면 문자열에 「부모님이」 도장·칩·안내가 0건이다. 서버 렌더로 DOM을 본다.
 */

const CLOCK: YearClock = { get: () => 0, subscribe: () => () => undefined };
const noop = () => undefined;
const asLife = (g: GameState): LifeGame => ({ ...g, character: g.character!, generation: g.generation!, birthReport: g.birthReport!, peerSeed: g.peerSeed! });
const plain = (s: string): string => s.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
const body = (html: string, testid: string): string => {
  const at = html.indexOf(`data-testid="${testid}"`);
  if (at < 0) return '';
  const start = html.indexOf('>', at) + 1;
  const tag = /<(\w+)/.exec(html.slice(html.lastIndexOf('<', at)))![1];
  return html.slice(start, html.indexOf(`</${tag}>`, start)).replace(/<[^>]*>/g, '');
};

/** 별세 계획을 심는다: 어머니·아버지가 주인공 `at`세에 떠나게(없으면 계획 없음) — tests/parentSubject.test.ts와 같은 방법 */
function planted(base: GameState, motherAt: number | null, fatherAt: number | null): GameState {
  const f = base.family as FamilyData;
  const report = base.birthReport!;
  const p = [
    { ...f.p[0], d: motherAt === null ? NO_DEATH_PLAN : report.mother.age + motherAt },
    { ...f.p[1], d: fatherAt === null ? NO_DEATH_PLAN : report.father.age + fatherAt },
  ] as FamilyData['p'];
  return { ...base, family: { ...f, p } };
}

/** 이벤트 하나를 부모가 정한 해로 만든다 (고른 길 하나로 줄여 `resolveDelegated`가 그 길을 고르게) */
function parentYear(base: GameState, choiceId: string, opts: { priorParent?: boolean } = {}): { game: GameState; tick: TickInfo } {
  const prior: HistoryEntry = { age: Math.max(0, base.pending!.age - 2), kind: 'choice', text: '앞선 부모 결정입니다.', choice: '길', eventId: 'infant-care', by: 'parent' };
  const before: GameState = { ...base, pending: { ...base.pending!, choiceIds: [choiceId] }, ...(opts.priorParent === true ? { history: [...base.history, prior] } : {}) };
  const r = resolveDelegated(before, 'parent');
  return { game: r.state, tick: r.tick };
}

const SUBJECTS: Array<[CoParents, string, string]> = [
  ['both', '부모님이 이렇게 정했습니다', '부모님의 결정'],
  ['mother', '어머니가 이렇게 정했습니다', '어머니의 결정'],
  ['father', '아버지가 이렇게 정했습니다', '아버지의 결정'],
];
/** 6세에 그 주어가 되도록 심은 판 */
const plantFor = (base: GameState, co: CoParents): GameState => (co === 'both' ? planted(base, null, null) : co === 'mother' ? planted(base, null, 2) : planted(base, 2, null));

describe('① ⑤ 비모달 카드: 칩·도장·첫 카드 안내가 그 해 함께 사는 부모를 따른다', () => {
  const base = forcedPending('infant-fever', 'present', { age: 6 });
  for (const [co, stamp, chip] of SUBJECTS) {
    it(`${co}: 칩 「${chip}」 · 도장 「${stamp}」 · 안내 첫 문장의 주어`, () => {
      const g = plantFor(base, co);
      expect(coParentsOf(g, 6)).toBe(co);
      const { game, tick } = parentYear(g, 'dismiss');
      const model = parentCardModel(asLife(game), tick, EVENT_POOL)!;
      expect(model.subject).toBe(co);
      const html = renderToStaticMarkup(<ParentCard model={model} />);
      expect(body(html, 'parent-chip')).toBe(chip);
      expect(body(html, 'parent-stamp')).toBe(stamp);
      expect(body(html, 'parent-hint')).toBe(parentWording(co).hint);
      expect(body(html, 'parent-hint').startsWith(`어린 시절의 큰 결정은 ${parentWording(co).ga} 내립니다.`)).toBe(true);
      if (co !== 'both') expect(plain(html)).not.toMatch(/부모님이|부모님의 결정/); // 한 분만 함께 사는 해에 「부모님이」 도장·칩·안내 0건
    });
  }

  it('안내 한 줄은 첫 부모 카드에만 붙는다 — 앞선 부모 결정이 있으면 없다(주어와 무관)', () => {
    const g = plantFor(base, 'mother');
    const { game, tick } = parentYear(g, 'dismiss', { priorParent: true });
    const html = renderToStaticMarkup(<ParentCard model={parentCardModel(asLife(game), tick, EVENT_POOL)!} />);
    expect(html).not.toContain('parent-hint');
    expect(body(html, 'parent-stamp')).toBe('어머니가 이렇게 정했습니다');
  });

  it('흘러간 카드(아이의 일)는 주어가 없어 그대로다', () => {
    const g = plantFor(forcedPending('infant-new-sibling', 'present', { age: 6 }), 'mother');
    const before: GameState = { ...g, pending: { ...g.pending!, choiceIds: ['sulk'] } };
    const r = resolveDelegated(before, 'child');
    const model = parentCardModel(asLife(r.state), r.tick, EVENT_POOL)!;
    const html = renderToStaticMarkup(<ParentCard model={model} />);
    expect(body(html, 'parent-chip')).toBe('아이의 일');
    expect(body(html, 'parent-stamp')).toBe('이렇게 흘러갔습니다');
  });
});

describe('④ 가린 카드: 무거운 장면 가리기를 켠 채 부모 결정 카드의 도장도 그 해의 주어다', () => {
  /** 부모가 정하는 카드 가운데 `heavy` 표지가 있는 사건 하나와 그 나이 */
  const heavyParent = (() => {
    for (const eventId of Object.keys(PARENT_DECISION_TABLE)) {
      const ev = EVENT_POOL.byId.get(eventId)!;
      if (heavyKindOfEvent(ev) === null) continue;
      const age = possibleAgesOf(ev).find((a) => a >= 4 && decisionFor(eventId, a) === 'parent');
      if (age !== undefined) return { eventId, age, kind: heavyKindOfEvent(ev)! };
    }
    throw new Error('부모가 정하는 무거운 카드가 없다');
  })();

  for (const [co, stamp] of SUBJECTS.slice(1)) {
    it(`${co}: 가린 카드에는 라벨 없는 도장 「${stamp}」만 보인다`, () => {
      const base = forcedPending(heavyParent.eventId, 'present', { age: heavyParent.age });
      const g = plantFor(base, co);
      // 이 나이에 그 주어가 되도록 심은 별세 해(2세)가 맞는지
      expect(coParentsOf(g, heavyParent.age)).toBe(co);
      const choiceId = EVENT_POOL.byId.get(heavyParent.eventId)!.choices![0].id;
      const { game, tick } = parentYear(g, choiceId);
      const model = parentCardModel(asLife(game), tick, EVENT_POOL)!;
      const html = renderToStaticMarkup(<ParentCard model={model} gentle />);
      expect(html).toContain('data-veiled="true"');
      expect(body(html, 'parent-stamp')).toBe(stamp);
      expect(body(html, 'parent-chip')).toBe(parentWording(co).chip);
      expect(plain(html)).not.toMatch(/부모님이/);
    });
  }

  it('가린 줄(인생 기록): 「{나이}세 무거운 일이 있었습니다 · {분류} (어머니가 이렇게 정했습니다) 펼쳐 보기」 — 제목도 가린 원문 안이다', () => {
    const history: HistoryEntry[] = [
      { age: 0, kind: 'stage', text: '태어났다.' },
      { age: 1, kind: 'choice', title: '열', text: '열이 올랐다.', choice: '병원에 간다', eventId: 'infant-fever', by: 'parent' },
    ];
    const html = renderToStaticMarkup(<LogCard history={history} live={false} gentle subjectOf={() => 'mother'} />);
    const row = plain(html.slice(html.indexOf('data-veiled="true"')));
    expect(row).toContain(`2세 무거운 일이 있었습니다 · ${HEAVY_KIND_TEXT.health} (어머니가 이렇게 정했습니다) 펼쳐 보기`);
    // SPEC-012 QF4: 펼친 원문은 「제목 → 도장·고른 길 → 결과」 세 줄(괄호 없음). 제목은 `.veil__body`(hidden) 안이라 접힌 줄에서 함께 가려진다
    expect(row).toContain('열 어머니가 이렇게 정했습니다: 병원에 간다 열이 올랐다.'); // 펼친 원문 쪽 도장(라벨 포함, hidden)도 같은 주어
    expect(/<span class="veil__body"[^>]*hidden=""[^>]*>s*<span class="log__q"/.test(html), '제목은 veil__body 안(hidden)에 있다').toBe(true);
    expect(row).not.toContain('부모님이');
  });
});

describe('② 인생 기록 줄: 줄의 나이로 그 해의 주어를 그린다 — 같은 판 안에서 줄마다 다르다', () => {
  const history: HistoryEntry[] = [
    { age: 0, kind: 'stage', text: '태어났다.' },
    { age: 3, kind: 'choice', title: '열', text: '열이 올랐다.', choice: '병원에 간다', eventId: 'infant-fever', by: 'parent' },
    { age: 7, kind: 'choice', title: '입학', text: '입학 준비를 했다.', choice: '새로 산다', eventId: 'school-supplies', by: 'parent' },
    { age: 9, kind: 'choice', title: '동생', text: '동생이 생겼다.', choice: '삐친다', eventId: 'infant-new-sibling', by: 'child' },
    { age: 14, kind: 'choice', title: '동아리', text: '동아리에 들어갔다.', choice: '한다', eventId: 'school-club' },
  ];
  const subjectOf = (age: number): CoParents => (age <= 3 ? 'both' : 'father');

  it('3세(두 분) 줄은 「부모님이」, 7세(아버지만) 줄은 「아버지가」, 흘러감·본인 줄은 그대로', () => {
    const html = renderToStaticMarkup(<LogCard history={history} live={false} subjectOf={subjectOf} />);
    const text = plain(html);
    // SPEC-012 QF4: 「제목 → 도장·고른 길 → 결과」 세 줄(괄호 없음)
    expect(text).toContain('열 부모님이 이렇게 정했습니다: 병원에 간다 열이 올랐다.');
    expect(text).toContain('입학 아버지가 이렇게 정했습니다: 새로 산다 입학 준비를 했다.');
    expect(text).toContain('동생 이렇게 흘러갔습니다: 삐친다 동생이 생겼다.');
    expect(text).toContain('동아리 선택: 한다 동아리에 들어갔다.');
    expect(text.match(/부모님이 이렇게/g)).toHaveLength(1);
  });

  it('주어를 주지 않으면 기존 문구다(두 분)', () => {
    const text = plain(renderToStaticMarkup(<LogCard history={history} live={false} />));
    expect(text.match(/부모님이 이렇게 정했습니다/g)).toHaveLength(2);
  });

  it('LifeScreen이 판의 가족 계획에서 줄마다의 주어를 정해 LogCard에 준다', () => {
    const base = forcedPending('infant-fever', 'present', { age: 6 });
    const g = plantFor(base, 'mother'); // 아버지가 2세에 떠났다
    // 3세 줄(아버지가 떠난 해 뒤 → 어머니만) · 2세 줄(떠난 해 → 두 분) · 1세 줄(두 분)
    const lines: HistoryEntry[] = [1, 2, 3].map((age) => ({ age, kind: 'choice', title: `일${age}`, text: `${age}세의 결과입니다.`, choice: `길${age}`, eventId: 'infant-care', by: 'parent' }));
    const withLines: GameState = { ...g, history: [...g.history, ...lines] };
    const html = renderToStaticMarkup(
      <LifeScreen
        game={asLife(withLines)}
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
        buildLabel="v0.1.0 (abc1234)"
      />,
    );
    const log = plain(html.slice(html.indexOf('data-testid="log"')));
    expect(log).toContain('일1 부모님이 이렇게 정했습니다: 길1 1세의 결과입니다.');
    expect(log).toContain('일2 부모님이 이렇게 정했습니다: 길2 2세의 결과입니다.'); // 떠난 해 자체는 두 분이 함께 있던 해다
    expect(log).toContain('일3 어머니가 이렇게 정했습니다: 길3 3세의 결과입니다.');
    expect(coParentsFn(withLines)(3)).toBe('mother');
  });
});

describe('③ 엔딩 연표: 줄마다 그 해의 주어 — 요약 문장(PD9 둘째 줄)은 없어졌다 (형진 님 요청, 2026-11-08)', () => {
  const ended = startLife(2024, 'genx');

  /** 끝까지 산 판의 어린 시절 부모 결정 줄을 우리가 정한 줄로 바꾼다(계획은 어머니 별세 3세 → 4세부터 아버지만) */
  function endingWith(parentLineAges: number[]): EndingGame {
    const g = planted(ended, 3, null);
    const end = playToEnd(g, null).state as EndingGame;
    const lines: HistoryEntry[] = parentLineAges.map((age) => ({ age, kind: 'choice', title: `일${age}`, text: `${age}세의 결과입니다.`, choice: `길${age}`, eventId: 'infant-care', by: 'parent' }));
    const rest = end.history.filter((h) => !(h.kind === 'choice' && h.by === 'parent'));
    return { ...end, history: [...rest, ...lines].sort((a, b) => a.age - b.age) };
  }

  it('연표 줄: 3세(떠난 해 — 두 분) 줄은 「부모님이」, 5·9세 줄은 「아버지가」', () => {
    const game = endingWith([1, 3, 5, 9]);
    expect(coParentsFn(game)(3)).toBe('both');
    expect(coParentsFn(game)(5)).toBe('father');
    const html = renderToStaticMarkup(<EndingScreen game={game} onRebirth={noop} />);
    const picked = [...html.matchAll(/data-testid="timeline-picked"[^>]*>([\s\S]*?)<\/span>/g)].map((m) => plain(m[1]));
    expect(picked).toContain('부모님이 이렇게 정했습니다: 길1');
    expect(picked).toContain('부모님이 이렇게 정했습니다: 길3');
    expect(picked).toContain('아버지가 이렇게 정했습니다: 길5');
    expect(picked).toContain('아버지가 이렇게 정했습니다: 길9');
  });

  it('review.timeline의 subjects가 entries와 같은 길이로 줄마다 주어를 싣는다 (저장하지 않는 파생값)', () => {
    const review = reviewEnding(endingWith([1, 3, 5, 9]));
    for (const g of review.timeline) expect(g.subjects).toHaveLength(g.entries.length);
    const flat = review.timeline.flatMap((g) => g.entries.map((e, i) => ({ e, s: g.subjects[i] })));
    expect(flat.filter((x) => x.e.by === 'parent').map((x) => [x.e.age, x.s])).toEqual([[1, 'both'], [3, 'both'], [5, 'father'], [9, 'father']]);
    // buildTimeline은 주어 함수를 주지 않으면 모두 두 분(기존 문구)이다
    for (const g of buildTimeline(endingWith([1, 5]).history)) expect(g.subjects.every((s) => s === 'both')).toBe(true);
  });

  it('엔딩 「생애 기록」 카드에 부모 결정·흘러감 횟수 요약 문장이 없다 — 부모 결정 줄이 있어도 한 분만 계셔도 같다 (「살아오며 N번의 선택」은 그대로)', () => {
    for (const ages of [[1, 3, 5, 9], [5, 9, 12], []]) {
      const game = endingWith(ages);
      const html = renderToStaticMarkup(<EndingScreen game={game} onRebirth={noop} />);
      expect(html).not.toContain('data-testid="ending-delegated"');
      expect(plain(html)).not.toMatch(/큰 결정 가운데|번은 부모님이 내렸|번은 어머니가 내렸|번은 아버지가 내렸|번은 아이의 일로 흘러갔/);
      expect(body(html, 'ending-choices')).toBe(`살아오며 ${reviewEnding(game).choiceCount}번의 선택을 했습니다.`);
    }
  });
});
