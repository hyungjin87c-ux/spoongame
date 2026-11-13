import { describe, expect, it, vi } from 'vitest';
import { EVENT_POOL } from '../src/data/events';
import { JOB_TABLE } from '../src/data/jobs';
import { PERSONA_TABLE as T } from '../src/data/personaTable';
import { autoResolveStep, careerIncomeOf, jobPickOutcome, parseGame, resolveChoiceStep, serializeGame, stepYear, type GameState } from '../src/core';
import { startLife } from '../scripts/simulateLib';
import { runToJobCard } from './helpers/careerTest';

vi.mock('../src/data/personaSwitch', () => ({ PERSONA_ENABLED: true }));

/**
 * 합격 소득 이전 [결정 후속 233]: 진로 트랙 합격이 옛 첫 일 카드 `youth-first-job`의 평생 소득 가산(`assets.income`)의 소득 몫을 그대로 준다.
 * 값의 출처는 9절 `MODEL careerIncome`이고 이 시험이 옛 카드 데이터와 같음을 잠근다. 행복·관계는 옮기지 않는다(PL6).
 */

const old = EVENT_POOL.byId.get('youth-first-job')!;
const choiceOf = (id: string) => old.choices!.find((c) => c.id === id)!;
const withState = (s: GameState, over: { education?: number; flags?: string[] }): GameState => ({
  ...s,
  stats: { ...s.stats, education: over.education ?? 50 },
  flags: [...(over.flags ?? [])].sort(),
});

describe('MODEL careerIncome = 옛 youth-first-job의 소득 값', () => {
  it('stable +800 · family +1,600 · 보너스 지식 ≥70 +600 · early_work +400 · skilled_trade +400', () => {
    const [base, family, edu, early, trade] = T.MODEL.careerIncome;
    expect(choiceOf('stable').effects!.assets!.income).toBe(base);
    expect(choiceOf('family').effects!.assets!.income).toBe(family);
    expect(choiceOf('family').bonuses).toBeUndefined();
    const b = choiceOf('stable').bonuses!;
    expect(b.find((x) => x.when.stats?.education?.min === 70)!.effects.assets!.income).toBe(edu);
    expect(b.find((x) => x.when.flags?.includes('early_work'))!.effects.assets!.income).toBe(early);
    expect(b.find((x) => x.when.flags?.includes('skilled_trade'))!.effects.assets!.income).toBe(trade);
    expect(b.length).toBe(3);
  });
});

describe('합격 소득이 닿는 나이', () => {
  it('합격은 빨라야 20세다: 분야 카드 하한(trackWindow) + 1 ≥ 20 — 자산(20세가 되는 해에 생김)이 늘 먼저 있어 assets.income이 버려지지 않는다', () => {
    expect(T.MODEL.trackWindow[0] + 1).toBeGreaterThanOrEqual(20);
    const s = runToJobCard(5, 'detail');
    expect(s.age).toBeGreaterThanOrEqual(20);
    expect(s.assets).not.toBeNull();
  });
});

describe('careerIncomeOf · jobPickOutcome', () => {
  const s0 = runToJobCard(5, 'detail');
  const general = JOB_TABLE.jobs.find((j) => j.setFlags === undefined || !j.setFlags.includes('family_business'))!;
  const familyJob = JOB_TABLE.jobs.find((j) => j.setFlags?.includes('family_business'))!;

  it('일반 직업: 800 + 조건 보너스(지식 ≥70 · early_work · skilled_trade), 경계 69/70', () => {
    expect(careerIncomeOf(withState(s0, { education: 50 }), general)).toBe(800);
    expect(careerIncomeOf(withState(s0, { education: 69 }), general)).toBe(800);
    expect(careerIncomeOf(withState(s0, { education: 70 }), general)).toBe(1400);
    expect(careerIncomeOf(withState(s0, { flags: ['early_work'] }), general)).toBe(1200);
    expect(careerIncomeOf(withState(s0, { flags: ['skilled_trade'] }), general)).toBe(1200);
    expect(careerIncomeOf(withState(s0, { education: 90, flags: ['early_work', 'skilled_trade'] }), general)).toBe(800 + 600 + 400 + 400);
  });

  it('가업 직업: 1,600이고 보너스가 없다', () => {
    expect(careerIncomeOf(withState(s0, { education: 90, flags: ['early_work', 'skilled_trade'] }), familyJob)).toBe(1600);
  });

  it('합격 효과: income + 플래그만 — 행복·관계는 옮기지 않는다. 불합격은 효과가 없다', () => {
    const open = JOB_TABLE.jobs.find((j) => j.field === s0.persona!.job!.field && j.open === true)!;
    const s: GameState = { ...s0, persona: { ...s0.persona!, tries: 3 } };
    const r = jobPickOutcome(s, 'detail', open.id, s.age);
    expect(r.passed).toBe(true);
    expect(r.effects!.assets!.income).toBe(careerIncomeOf(s, open));
    expect(r.effects!.stats).toBeUndefined();
    expect(r.effects!.setFlags).toEqual(expect.arrayContaining(['has_career', 'job_picked']));
  });
});

describe('[CX-003-001] 첫 일 소득은 한 판에 한 번 — 옛 카드의 조건(notFlags has_career·own_business)도 옮긴다', () => {
  const s0 = runToJobCard(5, 'detail');
  const general = JOB_TABLE.jobs.find((j) => j.setFlags === undefined || !j.setFlags.includes('family_business'))!;
  const familyJob = JOB_TABLE.jobs.find((j) => j.setFlags?.includes('family_business'))!;

  it('이미 has_career(옛 첫 일 카드를 풀었거나 다시 합격)거나 own_business면 0 — 옛 카드도 그 판에는 뜨지 않았다', () => {
    expect(old.conditions?.notFlags).toEqual(['has_career', 'own_business']);
    for (const flag of ['has_career', 'own_business']) {
      expect(careerIncomeOf(withState(s0, { education: 90, flags: [flag, 'early_work'] }), general), flag).toBe(0);
      expect(careerIncomeOf(withState(s0, { flags: [flag] }), familyJob), `${flag} 가업`).toBe(0);
    }
  });

  it('모르는 직업 id를 정리한 뒤 다시 합격해도 incomeAdj가 늘지 않는다 (Codex 재현: 밀레니얼 시드 4 — PL5 뒤 시드 4는 21세 「한 곳에 자리 잡을 길」로 첫 일 소득을 먼저 받아 진로 합격 몫이 0이므로, 첫 합격에서 소득을 받는 첫 시드를 쓴다)', () => {
    const firstHire = (seed: number): GameState => {
      let s: GameState = startLife(seed, 'millennial');
      for (let i = 0; i < 400 && s.phase === 'life' && s.persona?.job?.id === undefined; i++) s = s.pending === null ? stepYear(s).state : autoResolveStep(s, s.pending.key).state;
      return s;
    };
    let s: GameState = firstHire(4);
    for (let seed = 5; seed <= 60 && !(s.persona?.job?.id !== undefined && (s.assets?.incomeAdj ?? 0) > 0); seed++) s = firstHire(seed);
    expect(s.persona?.job?.id, '첫 합격').toBeDefined();
    const paid = s.assets!.incomeAdj;
    expect(paid).toBeGreaterThan(0);
    const raw = JSON.parse(serializeGame(s));
    raw.data.persona.job.id = 'removed-job';
    let back = parseGame(JSON.stringify(raw))!;
    expect(back.persona!.job!.id, '모르는 id는 지워져 field로').toBeUndefined();
    expect(back.flags).toEqual(expect.arrayContaining(['has_career', 'job_picked']));
    back = { ...back, persona: { ...back.persona!, tries: 3 } }; // 입문 합격 보장으로 다시 합격시킨다
    let before: number | null = null;
    for (let i = 0; i < 40 && back.phase === 'life' && back.persona?.job?.id === undefined; i++) {
      if (back.pending === null) { back = stepYear(back).state; continue; }
      const ev = EVENT_POOL.byId.get(back.pending.eventId)!;
      const pickOpen = ev.pick?.kind === 'detail' ? back.pending.choiceIds.find((id) => JOB_TABLE.byId.get(id)?.hire === 'open') : undefined;
      before = back.assets!.incomeAdj;
      back = resolveChoiceStep(back, back.pending.key, pickOpen ?? back.pending.choiceIds[0]).state;
    }
    expect(back.persona?.job?.id, '다시 합격').toBeDefined();
    expect(back.assets!.incomeAdj, '다시 합격한 해결이 첫 일 소득을 더하지 않는다').toBe(before);
    expect(paid, '첫 합격에서는 받았다').toBeGreaterThan(0);
  });
});
