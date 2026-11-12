import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { EVENT_POOL } from '../src/data/events';
import { JOB_TABLE } from '../src/data/jobs';
import {
  FIELD_NAMES,
  autoChoiceWeights,
  autoResolveStep,
  parseGame,
  pickChoicesOf,
  previewPending,
  resolveChoiceStep,
  serializeGame,
  type GameState,
} from '../src/core';
import { useDecisionModel } from '../src/ui/dash/DecisionCard';
import type { LifeGame } from '../src/ui/dash/Cards';
import { forcedPending } from './helpers/forcedPending';
import { runToJobCard } from './helpers/careerTest';

vi.mock('../src/data/personaSwitch', () => ({ PERSONA_ENABLED: true }));

/**
 * `pickChoicesOf` 공통 인터페이스 (SPEC-018 PL4, 설계 4절): **렌더(`DecisionCard`)·효과 미리보기(`previewPending`)·해결(`resolveChoiceStep`)·자동 선택(`autoChoiceWeights`)·복원(`parseGame`)이
 * 모두 같은 선택지 목록**을 본다 — 정의 선택지(일반 사건)도 저장된 후보 id(진로 카드)도 같은 길이다.
 */

const asLife = (g: GameState): LifeGame => ({ ...g, character: g.character!, generation: g.generation!, birthReport: g.birthReport!, peerSeed: g.peerSeed! });

/** 훅을 렌더해 카드가 그리는 선택지 id·라벨을 읽는다 */
function rendered(g: GameState): { ids: string[]; labels: string[] } {
  let out: { ids: string[]; labels: string[] } = { ids: [], labels: [] };
  function Probe() {
    const model = useDecisionModel(asLife(g), EVENT_POOL);
    out = { ids: model?.choices.map((c) => c.id) ?? [], labels: model?.choices.map((c) => c.label) ?? [] };
    return null;
  }
  renderToStaticMarkup(<Probe />);
  return out;
}

describe('일반 사건: 정의 선택지를 저장된 id 순서대로 푼다(변경 전 동작과 같다)', () => {
  it('pickChoicesOf = pending.choiceIds의 순서·객체 그대로', () => {
    const s = forcedPending('school-club', 'millennial');
    const ev = EVENT_POOL.byId.get('school-club')!;
    const got = pickChoicesOf(s, s.pending!, EVENT_POOL);
    expect(got.map((c) => c.id)).toEqual(s.pending!.choiceIds);
    for (const c of got) expect(c).toBe(ev.choices!.find((x) => x.id === c.id));
  });
  it('모르는 id는 건너뛴다', () => {
    const s = forcedPending('school-club', 'millennial');
    const p = { ...s.pending!, choiceIds: [...s.pending!.choiceIds, 'no-such'] };
    expect(pickChoicesOf(s, p, EVENT_POOL).map((c) => c.id)).toEqual(s.pending!.choiceIds);
  });
  it('이벤트가 풀에 없으면 빈 목록', () => {
    const s = forcedPending('school-club', 'millennial');
    expect(pickChoicesOf(s, { ...s.pending!, eventId: 'nothing-here' }, EVENT_POOL)).toEqual([]);
  });
});

describe('진로 카드: 저장된 후보 id를 이름으로 푼다', () => {
  it('분야 카드: 라벨 = 분야 이름, 순서 = pending.choiceIds', () => {
    const s = runToJobCard(4, 'field');
    const got = pickChoicesOf(s, s.pending!, EVENT_POOL);
    expect(got.map((c) => c.id)).toEqual(s.pending!.choiceIds);
    expect(got.map((c) => c.label)).toEqual(s.pending!.choiceIds.map((id) => FIELD_NAMES[id as keyof typeof FIELD_NAMES]));
  });
  it('세부 카드: 라벨 = 직업 이름, 첫 자리는 입문, 효과 없음(미리 약속하지 않는다)', () => {
    const s = runToJobCard(4, 'detail');
    const got = pickChoicesOf(s, s.pending!, EVENT_POOL);
    expect(got).toHaveLength(3);
    expect(got.map((c) => c.label)).toEqual(s.pending!.choiceIds.map((id) => JOB_TABLE.byId.get(id)!.name));
    expect(JOB_TABLE.byId.get(got[0].id)!.open).toBe(true);
    for (const c of got) {
      expect(c.effects).toBeUndefined();
      expect(c.result.length).toBeGreaterThan(0);
    }
  });
  it('모르는 직업 id·분야 id는 건너뛴다', () => {
    const d = runToJobCard(4, 'detail');
    expect(pickChoicesOf(d, { ...d.pending!, choiceIds: [d.pending!.choiceIds[0], 'removed-job'] }, EVENT_POOL)).toHaveLength(1);
    const f = runToJobCard(4, 'field');
    expect(pickChoicesOf(f, { ...f.pending!, choiceIds: [f.pending!.choiceIds[0], 'clerk-call'] }, EVENT_POOL)).toHaveLength(1);
  });
  it('조건이 모자란 후보는 「무리한 도전」 표지가 붙는다(조건이 맞으면 붙지 않는다)', () => {
    const s = runToJobCard(4, 'detail');
    const poor: GameState = { ...s, stats: { ...s.stats, education: 0 } };
    const rich: GameState = { ...s, stats: { ...s.stats, education: 100 } };
    for (const c of pickChoicesOf(rich, rich.pending!, EVENT_POOL)) expect(c.stretch, c.id).toBeUndefined();
    for (const c of pickChoicesOf(poor, poor.pending!, EVENT_POOL)) {
      const job = JOB_TABLE.byId.get(c.id)!;
      expect(c.stretch === true, c.id).toBe(job.when?.stats?.education?.min !== undefined && job.when.stats.education.min > 0);
    }
  });
});

describe.each(['field', 'detail'] as const)('%s 카드 — 다섯 소비자가 같은 후보를 본다', (kind) => {
  const s = runToJobCard(8, kind);
  const ids = s.pending!.choiceIds;

  it('렌더: DecisionCard의 선택지 = pickChoicesOf', () => {
    const r = rendered(s);
    expect(r.ids).toEqual(ids);
    expect(r.labels).toEqual(pickChoicesOf(s, s.pending!, EVENT_POOL).map((c) => c.label));
  });

  it('효과 미리보기: previewPending의 선택지 id가 같다(영향 줄은 비어 있다)', () => {
    const p = previewPending(s, EVENT_POOL)!;
    expect(p.map((x) => x.choiceId)).toEqual(ids);
    for (const x of p) expect(x.impact.items).toEqual([]);
  });

  it('해결: 보이는 id는 모두 받아들이고, 보이지 않는 id는 같은 상태를 돌려준다', () => {
    for (const id of ids) expect(resolveChoiceStep(s, s.pending!.key, id).state.pending, id).toBeNull();
    expect(resolveChoiceStep(s, s.pending!.key, 'not-shown').state).toBe(s);
  });

  it('자동 선택: 가중치의 id가 같고 모두 유한한 0 이상이다 — autoResolveStep = 같은 선택을 수동으로 고른 것(R-039)', () => {
    const w = autoChoiceWeights(s, EVENT_POOL)!;
    expect(w.ids).toEqual(ids);
    expect(w.weights.every((x) => Number.isFinite(x) && x >= 0)).toBe(true);
    expect(w.weights.some((x) => x > 0)).toBe(true);
    const auto = autoResolveStep(s, s.pending!.key, EVENT_POOL).state;
    const picked = w.ids[0];
    void picked;
    const same = ids.map((id) => resolveChoiceStep(s, s.pending!.key, id).state).some((x) => JSON.stringify(x) === JSON.stringify(auto));
    expect(same).toBe(true);
  });

  it('복원: 저장 → 읽기 뒤에도 후보 id·순서·라벨이 같다(상태에서 다시 계산하지 않는다)', () => {
    const back = parseGame(serializeGame(s))!;
    expect(back.pending!.choiceIds).toEqual(ids);
    expect(pickChoicesOf(back, back.pending!, EVENT_POOL).map((c) => c.label)).toEqual(pickChoicesOf(s, s.pending!, EVENT_POOL).map((c) => c.label));
    expect(rendered(back).ids).toEqual(ids);
  });

  it('연타: 같은 키를 두 번 눌러도 두 번째는 상태를 바꾸지 않는다', () => {
    const once = resolveChoiceStep(s, s.pending!.key, ids[0]).state;
    expect(resolveChoiceStep(once, s.pending!.key, ids[0]).state).toBe(once);
  });
});

describe('자동·흘러감 가중: 같은 후보·점수 × 소득 호감, 보장이 실제로 쓰인다', () => {
  it('tries ≥ 3이고 보이는 후보에 입문이 있으면 그 후보만 고른다(가중치가 입문에만 있다)', () => {
    const s = runToJobCard(6, 'detail');
    const withTries: GameState = { ...s, persona: { ...s.persona!, tries: 3 } };
    const w = autoChoiceWeights(withTries, EVENT_POOL)!;
    w.ids.forEach((id, i) => expect(w.weights[i] > 0, id).toBe(JOB_TABLE.byId.get(id)!.hire === 'open'));
  });
  it('tries < 3이면 모든 후보에 양의 가중치', () => {
    const w = autoChoiceWeights(runToJobCard(6, 'detail'), EVENT_POOL)!;
    expect(w.weights.every((x) => x > 0)).toBe(true);
  });
  it('여러 시드의 세부·분야 카드에서 가중치가 모두 양의 유한수다', () => {
    for (let seed = 1; seed <= 40; seed++) {
      for (const kind of ['field', 'detail'] as const) {
        const w = autoChoiceWeights(runToJobCard(seed, kind), EVENT_POOL)!;
        expect(w.weights.every((x) => Number.isFinite(x) && x > 0), `${seed}/${kind}`).toBe(true);
      }
    }
  });
});
