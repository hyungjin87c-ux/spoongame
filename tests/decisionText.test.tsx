import { createRef } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { startLife } from '../scripts/simulateLib';
import { autoResolveStep, condContextOf, createEventPool, eventTextOf, stepYear, type GameState } from '../src/core';
import { EVENT_POOL } from '../src/data/events';
import { DecisionCard, decisionTextOf, useDecisionModel, type DecisionModel } from '../src/ui/dash/DecisionCard';
import type { LifeGame } from '../src/ui/dash/Cards';
import { preRomancePool } from './helpers/preRomancePool';

vi.mock('../src/data/personaSwitch', () => ({ PERSONA_ENABLED: true }));

/**
 * 선택 카드 본문의 변주 (Codex CX-007-001): 사건의 `textVariants`가 있으면 카드 화면의 본문(`data-testid="choice-text"`)은 대기 중인 판의 조건 문맥으로 고른 글이다.
 * 교제 카드(SPEC-018 PL17-R)가 선택 카드에 본문 변주를 처음 넣었는데, 화면은 `ev.text`만 그려 넉넉한 판·근무 중·시대·적성의 상황이 플레이어에게 가지 않았고
 * 고른 뒤의 결과·연표 변주와 엇갈렸다. 아래 경우는 Codex 재현(findings.md 001 표·재현 부록)과 같은 조건이다.
 */

const asLife = (g: GameState): LifeGame => ({ ...g, character: g.character!, generation: g.generation!, birthReport: g.birthReport!, peerSeed: g.peerSeed! });

/** 실제 코어로 그 나이(대기 없음)까지 진행한 판 — 교제 카드가 없는 풀(PL17-R 전)로 진행해 시작 상태가 새 사건에 흔들리지 않게 한다 */
function baseAt(gen: 'millennial' | 'industrial', age: number): GameState {
  const pool = preRomancePool();
  for (let seed = 1; seed < 100; seed++) {
    let s = startLife(seed, gen);
    for (let guard = 0; guard < 400 && s.phase === 'life' && (s.age < age || s.pending !== null); guard++) s = s.pending ? autoResolveStep(s, s.pending.key, pool).state : stepYear(s, pool).state;
    if (s.phase === 'life' && s.age === age && s.pending === null) return s;
  }
  throw new Error(`${gen} ${age}세 시작 상태를 찾지 못했다`);
}

const BLOCKED = ['has_partner', 'married', 'divorced', 'marriage_waited', 'broke_up', 'has_career', 'own_business', 'lives_with_parents', 'parents_gone', 'unspoken', 'unspoken_money', 'missed_signal', 'kept_news'];

/** 그 판의 조건(순자산·플래그·적성)을 덮어쓴 뒤, 그 사건 하나만 든 풀에서 실제 `stepYear`로 카드를 띄운다 — 자격·보이는 선택지·대기 생성은 진짜 코어다 */
function pendingWith(id: string, gen: 'millennial' | 'industrial', age: number, net: number, flags: readonly string[], apt?: readonly number[]): GameState {
  const base = baseAt(gen, age);
  const persona = apt === undefined || base.persona === undefined ? base.persona : { ...base.persona, g: [...apt] };
  const prepared = { ...base, assets: { ...base.assets!, net }, flags: [...base.flags.filter((f) => !BLOCKED.includes(f)), ...flags], persona, lastChoiceAge: base.age - 10, pending: null } as GameState;
  const one = createEventPool([EVENT_POOL.byId.get(id)!]);
  for (let roll = 1; roll <= 500; roll++) {
    const s = stepYear({ ...prepared, rngState: roll * 7919 + 13 }, one).state;
    if (s.pending?.eventId === id) return s;
  }
  throw new Error(`${id}: 카드가 열리지 않았다`);
}

/** 훅으로 카드 모델을 만들고 실제 카드를 그려 본문을 읽는다 */
function render(g: GameState): { model: DecisionModel; html: string } {
  let model: DecisionModel | null = null;
  function Probe() {
    model = useDecisionModel(asLife(g), EVENT_POOL);
    return null;
  }
  renderToStaticMarkup(<Probe />);
  if (model === null) throw new Error('모델이 없다');
  const m: DecisionModel = model;
  const html = renderToStaticMarkup(<DecisionCard model={m} auto={false} epoch={0} titleRef={createRef<HTMLHeadingElement>()} onFold={() => {}} onChoose={() => {}} />);
  return { model: m, html };
}

const CASES: ReadonlyArray<{ name: string; state: () => GameState; variant: boolean }> = [
  { name: 'A-high: 약속 장소 · 순자산 12,000(경계) — 넉넉한 쪽 본문', state: () => pendingWith('youth-date-budget', 'millennial', 30, 12000, ['has_partner']), variant: true },
  { name: 'A-low: 약속 장소 · 순자산 11,999 — 기본 본문', state: () => pendingWith('youth-date-budget', 'millennial', 30, 11999, ['has_partner']), variant: false },
  { name: 'B-career: 같은 주에 온 소식 · 일하는 중 — 근무 본문', state: () => pendingWith('youth-two-news', 'millennial', 30, 11999, ['has_partner', 'has_career']), variant: true },
  { name: 'B-past: 같은 주에 온 소식 · 산업화 30세(2009년 이전) — 입사 시험 본문', state: () => pendingWith('youth-two-news', 'industrial', 30, 11999, ['has_partner']), variant: true },
  { name: 'C-sport: 주말마다 가는 모임 · 운동 적성 높음 — 운동 모임 본문', state: () => pendingWith('youth-hobby-circle', 'millennial', 30, 11999, [], [11, 3, 40, 2, 2]), variant: true },
];

describe('선택 카드 본문은 대기 중인 판의 조건으로 고른 변주다 (Codex CX-007-001)', () => {
  for (const c of CASES) {
    it(c.name, () => {
      const g = c.state();
      const ev = EVENT_POOL.byId.get(g.pending!.eventId)!;
      const want = eventTextOf(ev, condContextOf(g));
      // 공허 통과 방지: 변주 경우는 고른 글이 기본 본문과 달라야 하고, 기본 경우는 같아야 한다
      expect(want !== ev.text, `${c.name}: 고른 글이 기본 본문과 ${c.variant ? '달라야' : '같아야'} 한다`).toBe(c.variant);
      const { model, html } = render(g);
      expect(model.text).toBe(want);
      expect(decisionTextOf(g, ev)).toBe(want);
      // 실제 카드 화면에 그 글이 있고, 변주 경우에는 기본 본문이 없다
      expect(html).toContain(want);
      if (c.variant) expect(html).not.toContain(ev.text);
    });
  }
});

describe('본문 변주는 사람이 고르는 카드에서만 쓴다 — 부모·흘러감 카드(19세 미만)는 기본 본문을 그대로 그린다', () => {
  it('19세 미만에 열릴 수 있는 선택 사건에는 본문 변주가 없다 (ParentCard·core/life.ts의 카드 읽기 필요량이 `ev.text`를 쓴다 — 변주를 넣으려면 그 둘도 같은 문맥으로 바꾼다)', () => {
    const withVariants = EVENT_POOL.events.filter((ev) => (ev.choices?.length ?? 0) > 0 && (ev.textVariants?.length ?? 0) > 0);
    expect(withVariants.filter((ev) => (ev.ageRange?.min ?? 0) < 19).map((ev) => ev.id)).toEqual([]);
    // 공허 통과 방지: 본문 변주가 있는 선택 사건이 실제로 있다(교제 카드 둘 · 반대 사례)
    expect(withVariants.map((ev) => ev.id).sort()).toEqual(['youth-date-budget', 'youth-hobby-circle', 'youth-two-news']);
  });
});
