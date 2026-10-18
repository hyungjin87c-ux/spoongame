import { describe, expect, it } from 'vitest';
import impactSrc from '../src/core/impact.ts?raw';
import legacyJson from './fixtures/wealthLegacy.json';
import { ECONOMY, IMPACT_STEPS } from '../src/data/economyTable';
import { EVENT_POOL } from '../src/data/events';
import {
  IMPACT_KEYS,
  advanceUntilDecision,
  applyResolved,
  applyStatDeltas,
  autoResolveStep,
  condContextOf,
  economyContextOf,
  impactOfEffects,
  incomeOf,
  inheritanceDue,
  initialAssets,
  meetsCondition,
  moneySteps,
  naturalDeltas,
  previewChoice,
  previewPending,
  resolveChoiceStep,
  resolveEffects,
  settleAssets,
  statSteps,
  stepYear,
  visibleChoices,
  workStateOf,
  yearlyAssets,
  type ChoiceDef,
  type EventDef,
  type GameState,
  type ParentWealth,
  type Era,
  type ResolvedEffects,
} from '../src/core';
import { economySeed } from '../scripts/economyCheckLib';
import { startLife } from '../scripts/simulateLib';

/**
 * 선택지 영향 표기 데이터 (SPEC-003 M5 EC5, docs/data/economy-model.md 7절): 항목·방향·칸 수·스크린리더 문장 키.
 *  ① 단계표 경계  ② 항목 순서·방향·칸 수·문장 키  ③ 20세 미만(집안 살림 + 독립 때 확정되는 학자금 부채 한 가지, R-351) / 20세 이상(자산·부채) 구분  ④ 표기 = 인생 진행이 선택을 적용하는 계산 그대로(숨은 효과 0)
 *  ⑤ 모든 이벤트 × 선택지 × 대표 캐릭터에서 표기 방향이 옛 재산 부호와 같다 — 같지 않은 곳은 문서 5-C의 부호 예외(D16) 7건뿐이다(승인된 3건 + 2a 전수 시험이 찾은 4건). r2의 부모 임종 상속 예외 2건은 r3에서 상속을 해 끝 규칙으로 옮겨 없어졌다(영향 표기에 상속이 없다).
 */

const adult = (net = 5000, over: Partial<NonNullable<GameState['assets']>> = {}): GameState => {
  const base = startLife(7, 'present');
  const s: GameState = { ...base, age: 40, stats: { ...base.stats, education: 50 }, flags: ['has_career'], assets: null, familyFund: 0 };
  const ctx = economyContextOf(s);
  return { ...s, assets: { net, income: incomeOf(ctx, 0), debt: Math.max(0, -net), incomeAdj: 0, dwelling: 'rent', ...over } };
};
const young = (age = 12): GameState => ({ ...startLife(7, 'present'), age, assets: null, familyFund: 0 });

const eff = (over: Partial<ResolvedEffects> & { net?: number; income?: number; debt?: number } = {}): ResolvedEffects => ({
  stats: over.stats ?? {},
  assets: { net: over.net ?? 0, income: over.income ?? 0, debt: over.debt ?? 0 },
  family: over.family ?? 0,
  setFlags: over.setFlags ?? [],
  clearFlags: over.clearFlags ?? [],
});
const keys = (s: GameState, e: ResolvedEffects): string[] => impactOfEffects(s, e).items.map((i) => i.sr);

describe('core 순수성: 영향 표기 계산에 React·타이머·Date·Math.random이 없다', () => {
  it('core/impact.ts (주석 제외)', () => {
    const src = impactSrc.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    expect(src.length).toBeGreaterThan(1500);
    expect(src).not.toMatch(/Math\.random|Date\.now|new Date|performance\.now|setTimeout|setInterval|from 'react'|document\.|window\.|createRng/);
  });
});

describe('단계표 (SPEC EC5 ▲ 값): 상태 4항목 |Δ| 1~2 / 3~6 / ≥ 7 → 1·2·3칸, 자산·집안 살림·부채(만 원) < 500 / 500~2,999 / ≥ 3,000 → 1·2·3칸', () => {
  it('상태 4항목의 경계 값', () => {
    expect([1, 2].map(statSteps)).toEqual([1, 1]);
    expect([3, 4, 5, 6].map(statSteps)).toEqual([2, 2, 2, 2]);
    expect([7, 8, 20, 50].map(statSteps)).toEqual([3, 3, 3, 3]);
    expect(IMPACT_STEPS.stat).toEqual({ oneUpTo: 2, twoUpTo: 6 });
  });

  it('돈 항목의 경계 값(만 원)', () => {
    expect([1, 100, 499].map(moneySteps)).toEqual([1, 1, 1]);
    expect([500, 1000, 2999].map(moneySteps)).toEqual([2, 2, 2]);
    expect([3000, 3001, 10000, 50000].map(moneySteps)).toEqual([3, 3, 3, 3]);
    expect(IMPACT_STEPS.money).toEqual({ oneUpTo: 499, twoUpTo: 2999 });
    expect(IMPACT_STEPS.cashFlowYears).toBe(3);
  });
});

describe('항목 순서·방향·칸 수·문장 키', () => {
  it('항목 순서: (집안 살림 | 자산) · 부채 · 관계 · 행복 · 건강 · 지식 — 변화가 있는 항목만', () => {
    expect([...IMPACT_KEYS]).toEqual(['family', 'assets', 'debt', 'relationships', 'happiness', 'health', 'education']);
    const out = impactOfEffects(adult(100), eff({ net: -3000, stats: { education: 5, health: -1, happiness: 2, relationships: -7 } }));
    expect(out.items.map((i) => i.key)).toEqual(['assets', 'debt', 'relationships', 'happiness', 'health', 'education']);
    expect(impactOfEffects(adult(), eff({ stats: { happiness: 3 } })).items.map((i) => i.key)).toEqual(['happiness']);
    expect(impactOfEffects(adult(), eff()).items).toEqual([]);
  });

  it('스크린리더 문장 키는 「<항목>.<방향>.<칸 수>」이고, 방향·칸 수가 항목과 같다', () => {
    const out = impactOfEffects(adult(100), eff({ net: -3000, stats: { relationships: 5, happiness: -1, health: 9 } }));
    for (const it of out.items) expect(it.sr).toBe(`${it.key}.${it.direction}.${it.steps}`);
    expect(out.items.map((i) => i.sr)).toEqual(['assets.down.3', 'debt.up.2', 'relationships.up.2', 'happiness.down.1', 'health.up.3']);
  });

  it('상태 4항목: 변화량의 부호가 방향, 크기가 칸 수 (+1 → ▲, -3 → ▼▼, +7 → ▲▲▲)', () => {
    expect(keys(adult(), eff({ stats: { happiness: 1 } }))).toEqual(['happiness.up.1']);
    expect(keys(adult(), eff({ stats: { happiness: -3 } }))).toEqual(['happiness.down.2']);
    expect(keys(adult(), eff({ stats: { education: 7 } }))).toEqual(['education.up.3']);
    expect(keys(adult(), eff({ stats: { relationships: -6, health: 2 } }))).toEqual(['relationships.down.2', 'health.up.1']);
  });

  it('자산 점수(Δ순자산 + 3 × Δ연 현금흐름)의 칸 수: 순자산 -499 → ▼, -500 → ▼▼, -3000 → ▼▼▼ · 순자산 +200 → ▲ (현금흐름 변화가 없는 효과)', () => {
    const s = adult(50000);
    expect(keys(s, eff({ net: -499 }))).toEqual(['assets.down.1']);
    expect(keys(s, eff({ net: -500 }))).toEqual(['assets.down.2']);
    expect(keys(s, eff({ net: -2999 }))).toEqual(['assets.down.2']);
    expect(keys(s, eff({ net: -3000 }))).toEqual(['assets.down.3']);
    expect(keys(s, eff({ net: 200 }))).toEqual(['assets.up.1']);
    expect(impactOfEffects(s, eff({ net: -499 })).detail).toMatchObject({ dNet: -499, dCashFlow: 0, assetScore: -499, dDebt: 0 });
  });

  it('소득 보정(income)은 연 현금흐름을 바꿔 3년치로 읽힌다: 연 소득 +200 → 점수 +600 → ▲▲ (순자산 변화 0)', () => {
    const s = adult(50000);
    const out = impactOfEffects(s, eff({ income: 200 }));
    expect(out.detail.dNet).toBe(0);
    expect(out.detail.dCashFlow).toBeGreaterThan(0);
    expect(out.detail.assetScore).toBe(3 * out.detail.dCashFlow);
    expect(out.items.map((i) => i.sr)).toEqual(['assets.up.2']);
    // 65세 이후에는 소득 보정이 0.3배로 줄어 같은 효과가 더 작게 읽힌다 (7절 예시)
    const old = { ...adult(50000), age: 70, flags: [] as string[] };
    expect(impactOfEffects(old, eff({ income: 200 })).detail.dCashFlow).toBeLessThan(out.detail.dCashFlow);
  });

  it('자동 대출: 순자산을 넘는 지출은 「자산 ▼」와 함께 「부채 ▲」로 표기된다 (순자산 100에서 -3,000 → 자산 ▼▼▼ · 부채 ▲▲)', () => {
    const out = impactOfEffects(adult(100), eff({ net: -3000 }));
    expect(out.detail).toMatchObject({ dNet: -3000, dDebt: 2900 });
    expect(out.items.map((i) => i.sr)).toEqual(['assets.down.3', 'debt.up.2']);
    // 자산이 넉넉하면 같은 지출에도 부채 항목이 없다
    expect(keys(adult(20000), eff({ net: -3000 }))).toEqual(['assets.down.3']);
    // 이미 빚이 있는 판은 지출이 곧 부채다
    expect(keys(adult(-4000), eff({ net: -600 }))).toEqual(['assets.down.2', 'debt.up.2']);
  });

  it('부채를 갚는 선택은 「부채 ▼」: 명시 부채 -8,000 (자산은 순자산 변화만)', () => {
    const s = adult(5000, { debt: 9000 });
    const out = impactOfEffects(s, eff({ net: 1500, debt: -8000 }));
    expect(out.items.map((i) => i.sr)).toEqual(['assets.up.2', 'debt.down.3']);
  });

  it('주거를 바꾸는 플래그의 파생 변화가 표기에 들어간다: 부모 집을 나와 결혼하면 연 현금흐름이 줄어든다 (결혼·전세/월세 전환)', () => {
    const base = adult(8000, { dwelling: 'family' });
    const s = { ...base, age: 33, flags: ['has_career'], character: { ...base.character!, parentWealth: 3 as ParentWealth } };
    const out = impactOfEffects(s, eff({ net: -800, setFlags: ['married'] }));
    expect(out.detail.dDebt).toBeGreaterThan(0); // 결혼 시작 부채(3단계는 전세)
    expect(out.detail.dCashFlow).toBeLessThan(0); // 월세·생활 인원 +0.5가 배우자 소득 ×1.3을 넘는다 (부모 집 → 전세로 주거비가 새로 생긴다)
    expect(out.items.map((i) => i.key)).toEqual(['assets', 'debt']);
  });
});

describe('20세 미만: 집안 살림이 있고, 자산은 없고, 부채는 독립 때 확정되는 학자금 대출이 달라질 때만 있다 (R-351, 마스터 (a)안)', () => {
  it('집안 살림 -450 → 「집안 살림 ▼」(500 미만 한 칸) · -600 → ▼▼ · +3,000 → ▲▲▲, 자산·부채는 없다', () => {
    const s = young();
    expect(keys(s, eff({ family: -450 }))).toEqual(['family.down.1']);
    expect(keys(s, eff({ family: -600 }))).toEqual(['family.down.2']);
    expect(keys(s, eff({ family: 3000 }))).toEqual(['family.up.3']);
    expect(impactOfEffects(s, eff({ family: -450, stats: { education: 6, happiness: -3 } })).items.map((i) => i.sr)).toEqual(['family.down.1', 'happiness.down.2', 'education.up.2']);
    expect(impactOfEffects(s, eff({ family: -450 })).detail).toMatchObject({ dNet: 0, dCashFlow: 0, assetScore: 0, dDebt: 0, dFamily: -450 });
  });

  const youngTier = (tier: ParentWealth, age = 18, over: Partial<GameState> = {}): GameState => {
    const base = young(age);
    return { ...base, character: { ...base.character!, parentWealth: tier }, ...over };
  };

  it('college를 켜는 선택은 「부채 ▲」로 보인다: 학자금 대출 LOAN[재력] — 재력 1·2·3단계 2,300·1,500·600만 원(모두 두 칸), 4·5단계는 0이라 항목이 없다', () => {
    expect([...ECONOMY.collegeLoan]).toEqual([2300, 1500, 600, 0, 0]);
    for (const tier of [1, 2, 3] as const) {
      const out = impactOfEffects(youngTier(tier), eff({ setFlags: ['college'] }));
      expect(out.detail.dDebt, `재력 ${tier}단계`).toBe(ECONOMY.collegeLoan[tier - 1]);
      expect(out.items.map((i) => i.sr), `재력 ${tier}단계`).toEqual(['debt.up.2']);
    }
    for (const tier of [4, 5] as const) expect(keys(youngTier(tier), eff({ setFlags: ['college'] })), `재력 ${tier}단계`).toEqual([]);
    // 이미 college인 판이 같은 플래그를 또 켜면 변화가 없다 / 켠 플래그를 끄면 부채가 준다
    expect(keys(youngTier(1, 18, { flags: ['college'] }), eff({ setFlags: ['college'] }))).toEqual([]);
    expect(keys(youngTier(1, 18, { flags: ['college'] }), eff({ clearFlags: ['college'] }))).toEqual(['debt.down.2']);
  });

  it('집안 살림과 부채가 함께 나온다: 항목 순서는 집안 살림 · 부채 · 관계 · 행복 · 건강 · 지식이고, 집안 살림 변화는 부채 항목의 크기를 바꾸지 않는다', () => {
    const out = impactOfEffects(youngTier(1), eff({ family: -450, setFlags: ['college'], stats: { education: 7, happiness: -3 } }));
    expect(out.items.map((i) => i.sr)).toEqual(['family.down.1', 'debt.up.2', 'happiness.down.2', 'education.up.3']);
    // 집안 살림이 모자라 시작 부채가 더 생기는 판(지원 0 + 집안 살림 음수)에서도 표기하는 부채는 학자금 대출 몫뿐이다 — 집안 살림은 선택 전 값으로 고정해 본다
    const poor = impactOfEffects(youngTier(1, 18, { familyFund: -3000 }), eff({ family: -450, setFlags: ['college'] }));
    expect(poor.detail.dDebt).toBe(2300);
    expect(poor.detail).toMatchObject({ dNet: 0, dCashFlow: 0, assetScore: 0 });
  });

  it('school-exam의 apply·retry가 실제 선택지에서 부채를 보인다 (재력 1~3단계), work는 보이지 않는다 · 재력 4·5단계는 어느 선택지에도 부채가 없다', () => {
    const ev = EVENT_POOL.byId.get('school-exam')!;
    const preview = (tier: ParentWealth, id: string) => previewChoice(youngTier(tier, 17), ev.choices!.find((c) => c.id === id)!);
    for (const tier of [1, 2, 3] as const) {
      for (const id of ['apply', 'retry']) {
        const it = preview(tier, id).items.find((x) => x.key === 'debt');
        expect(it, `재력 ${tier} ${id}`).toMatchObject({ direction: 'up', steps: 2, sr: 'debt.up.2' });
      }
      expect(preview(tier, 'work').items.map((i) => i.key), `재력 ${tier} work`).toEqual(['family']);
    }
    for (const tier of [4, 5] as const) for (const id of ['apply', 'retry', 'work']) expect(preview(tier, id).items.map((i) => i.key), `재력 ${tier} ${id}`).not.toContain('debt');
  });

  it('독립 때 실제로 그 부채가 생긴다: college를 켠 판의 20세 시작 부채 = college가 없는 같은 판의 시작 부채 + 표기한 부채 (재력 1~5단계 × 세 시대 × 집안 살림 4가지)', () => {
    let checked = 0;
    for (const era of ['past', 'present', 'future'] as const) {
      for (const tier of [1, 2, 3, 4, 5] as const) {
        for (const fund of [-1200, 0, 900, 4000]) {
          const base = startLife(economySeed(tier), era);
          const s: GameState = { ...base, age: 17, assets: null, familyFund: fund, flags: base.flags.filter((f) => f !== 'college'), character: { ...base.character!, parentWealth: tier } };
          for (const id of ['apply', 'retry']) {
            const choice = EVENT_POOL.byId.get('school-exam')!.choices!.find((c) => c.id === id)!;
            const shown = previewChoice(s, choice).detail.dDebt;
            const chosen = applyResolved(s, resolveEffects(choice.effects, choice.bonuses, condContextOf(s)));
            // 독립 계산은 인생 진행이 쓰는 initialAssets 그대로다: 같은 집안 살림(선택 전 값)에서 college가 있는 판과 없는 판의 시작 부채 차이가 표기한 값과 같다
            const withCollege = initialAssets({ ...economyContextOf(chosen), age: 20 }, fund);
            const without = initialAssets({ ...economyContextOf(s), age: 20 }, fund);
            expect(withCollege.debt - without.debt, `${era} 재력${tier} 집안 살림 ${fund} ${id}`).toBe(shown);
            expect(withCollege.net - without.net, `${era} 재력${tier} ${id}: 순자산은 같은 만큼 줄어든다`).toBe(0 - shown);
            checked++;
          }
        }
      }
    }
    expect(checked).toBe(3 * 5 * 4 * 2);
  });

  it('엔진이 낸 실제 결과: 16~19세에 apply를 고르고 20세가 될 때까지 살면(그 사이 사건은 자동 선택) 시작 부채가 college 없는 같은 판보다 표기한 만큼 많다 (재력 1~5단계 × 세 시대 × 16~19세)', () => {
    // 같은 상태에서 college 플래그만 뺀 쌍둥이를 같은 난수로 20세까지 살려 견준다 (school-exam은 once라 이미 본 것으로 적어 두어 쌍둥이가 다시 college를 얻지 않는다)
    const toIndependence = (start: GameState): GameState => {
      let s = start;
      for (let guard = 0; guard < 50 && s.phase === 'life' && s.age < 20; guard++) s = s.pending !== null ? autoResolveStep(s, s.pending.key).state : stepYear(s).state;
      return s;
    };
    let checked = 0;
    for (const era of ['past', 'present', 'future'] as const) {
      for (const tier of [1, 2, 3, 4, 5] as const) {
        for (const age of [16, 17, 18, 19]) {
          const base = startLife(economySeed(tier * 7 + age), era);
          const s: GameState = { ...base, age, assets: null, familyFund: 300, flags: base.flags.filter((f) => f !== 'college'), seen: { ...base.seen, 'school-exam': age }, character: { ...base.character!, parentWealth: tier } };
          const pending: GameState = { ...s, pending: { key: `school-exam@${age}`, eventId: 'school-exam', age, choiceIds: ['apply'] } };
          const choice = EVENT_POOL.byId.get('school-exam')!.choices!.find((c) => c.id === 'apply')!;
          const shown = previewChoice(pending, choice).detail.dDebt;
          const a = resolveChoiceStep(pending, pending.pending!.key, 'apply').state;
          const where = `${era} 재력${tier} ${age}세`;
          const withCollege = toIndependence(a);
          expect(withCollege.assets, where).not.toBeNull();
          if (age === 19) {
            // 19세의 선택은 그 해를 마치며 바로 독립한다 — college 없는 쌍둥이를 따로 살릴 수 없어, 같은 집안 살림에서 college 없이 독립했다면의 시작 부채와 견준다
            const fund = applyResolved(pending, resolveEffects(choice.effects, choice.bonuses, condContextOf(pending))).familyFund;
            const baseline = initialAssets({ ...economyContextOf(withCollege), flags: new Set(withCollege.flags.filter((f) => f !== 'college')) }, fund);
            expect(withCollege.assets!.debt - baseline.debt, where).toBe(shown);
          } else {
            const without = toIndependence({ ...a, flags: a.flags.filter((f) => f !== 'college') });
            expect(without.assets, where).not.toBeNull();
            expect(withCollege.age, where).toBe(without.age);
            expect(withCollege.assets!.debt - without.assets!.debt, where).toBe(shown);
          }
          expect(shown, where).toBe(ECONOMY.collegeLoan[tier - 1]);
          checked++;
        }
      }
    }
    expect(checked).toBe(3 * 5 * 4);
  });

  it('예외 목록 잠금: 20세 미만 이벤트가 켜는 플래그 가운데 독립 초기값(시작 자산·시작 부채)을 바꾸는 것은 college 하나뿐이고, 일 상태(학생 상태 — 소득 ×0.15·생활비 ×0.7)를 바꾸는 것도 college 하나뿐이다 — 그 해마다 파생 효과는 표기하지 않는다(설계 7절의 예외)', () => {
    const youngEvents = EVENT_POOL.events.filter((e) => e.ageRange?.max !== undefined && e.ageRange.max < 20);
    expect(youngEvents.length).toBeGreaterThan(30);
    const flags = new Set<string>();
    for (const e of youngEvents) {
      const effs = [e.effects, ...(e.bonuses ?? []).map((b) => b.effects), ...(e.choices ?? []).flatMap((c) => [c.effects, ...(c.bonuses ?? []).map((b) => b.effects)])];
      for (const f of effs) for (const name of f?.setFlags ?? []) flags.add(name);
    }
    expect(flags.has('college'), 'school-exam이 college를 켠다').toBe(true);
    expect(flags.size, '20세 미만 이벤트가 켜는 플래그 수(공허 통과 방지)').toBeGreaterThan(10);
    const base = startLife(7, 'present');
    const startChanging: string[] = [];
    const stateChanging: string[] = [];
    for (const f of [...flags].sort()) {
      let startDiff = false;
      for (const tier of [1, 2, 3, 4, 5] as const) {
        for (const fund of [-2000, 0, 3000]) {
          const ctx = { ...economyContextOf({ ...base, age: 20, character: { ...base.character!, parentWealth: tier } }), flags: new Set<string>() };
          const a = initialAssets(ctx, fund);
          const b = initialAssets({ ...ctx, flags: new Set([f]) }, fund);
          if (a.net !== b.net || a.debt !== b.debt || a.dwelling !== b.dwelling) startDiff = true;
        }
      }
      if (startDiff) startChanging.push(f);
      if (workStateOf(new Set([f]), 20) !== workStateOf(new Set<string>(), 20)) stateChanging.push(f);
    }
    expect(startChanging, '독립 초기값을 바꾸는 20세 미만 플래그 — 새 플래그가 생기면 영향 표기에 같은 규칙을 적용하고 이 목록을 고친다').toEqual(['college']);
    expect(stateChanging, '일 상태를 바꾸는 20세 미만 플래그').toEqual(['college']);
    expect(workStateOf(new Set(['college']), 20)).toBe('student');
  });

  it('20세 이상에서는 집안 살림 항목이 나오지 않는다 (family 효과가 있어도 무시 — 스키마가 20세 이상 이벤트의 family를 막는다)', () => {
    expect(keys(adult(), eff({ family: -450 }))).toEqual([]);
  });

  it('M-1: 집안 살림 변화는 20세 시작 자산에 그대로 더해진다 — 표기가 말한 변화가 결과에 이어진다 (집안 살림 -600 → 20세 순자산 -600, 지원 0이면 시작 부채 600)', () => {
    const before = young(18);
    const after = applyResolved(before, eff({ family: -600 }));
    expect(after.familyFund).toBe(-600);
    const ctx = { ...economyContextOf({ ...after, age: 20 }), tier: 1 as ParentWealth };
    expect(initialAssets(ctx, after.familyFund)).toMatchObject({ net: -600, debt: 600 });
  });
});

describe('표기 = 선택이 실제로 하는 일 (숨은 효과 0): 표기가 쓰는 applyResolved + 해마다 규칙 = 인생 진행의 결과', () => {
  const lives = (era: Era, n: number): GameState[] => {
    const out: GameState[] = [];
    for (let i = 1; i <= n; i++) {
      let s: GameState = startLife(economySeed(i), era);
      for (let guard = 0; guard < 400 && s.phase === 'life'; guard++) {
        if (s.pending !== null) {
          out.push(s);
          s = autoResolveStep(s, s.pending.key).state;
        } else s = advanceUntilDecision(s).state;
        if (s.phase !== 'life') break;
      }
    }
    return out;
  };

  it('선택 대기 상태 수천 개 × 보이는 선택지 전부: 인생 진행의 결과 상태가 (applyResolved → 자연 변화 → 해마다 정산/독립)와 정확히 같다', () => {
    let checked = 0;
    for (const era of ['past', 'present', 'future'] as const) {
      for (const p of lives(era, 60)) {
        const ev = EVENT_POOL.byId.get(p.pending!.eventId)!;
        for (const id of p.pending!.choiceIds) {
          const choice = ev.choices!.find((c) => c.id === id)!;
          const a = applyResolved(p, resolveEffects(choice.effects, choice.bonuses, condContextOf(p)));
          const e = resolveChoiceStep(p, p.pending!.key, id).state;
          const where = `${era} ${ev.id}/${id} ${p.age}세`;
          // 스탯: 선택 직후 값에 그 해의 자연 변화
          expect(e.stats, where).toEqual(applyStatDeltas(a.stats, naturalDeltas(p.age, p.character!, a.stats, p.era!, p.birthStats)));
          // 플래그: 효과가 켜고 끈 그대로
          expect(e.flags, where).toEqual(a.flags);
          if (p.assets !== null) {
            // 20세 이상: 해마다 정산 한 번 (자연 변화로 바뀐 지식을 반영) + 그 해 끝에 부모가 처음 모두 떠났다면 간이 상속(core/inherit.ts — 해 끝 규칙, 선택 적용·영향 표기에는 없다).
            // 기준은 이 해를 시작할 때의 상태(p)이고, 끝 시점은 사망이면 같은 나이·아니면 한 살 많은 나이다.
            const yearly = yearlyAssets(a.assets!, { ...economyContextOf(a), education: e.stats.education });
            const inherited = inheritanceDue(p, { ...a, age: e.phase === 'ending' ? a.age : a.age + 1, assets: yearly });
            expect(e.assets, where).toEqual(inherited > 0 ? settleAssets({ ...yearly, net: yearly.net + inherited }) : yearly);
            expect(e.familyFund, where).toBe(0);
          } else if (p.age === 19) {
            // 독립: 집안 살림이 시작 자산에 합쳐진다 (M-1)
            expect(e.familyFund, where).toBe(0);
            expect(e.assets, where).toEqual(initialAssets(economyContextOf(e), a.familyFund));
            // 표기한 부채 = 독립 때 실제로 생긴 시작 부채가 선택 전 플래그의 시작 부채보다 많은 만큼 (R-351, 집안 살림은 같다)
            const baseline = initialAssets({ ...economyContextOf(e), flags: new Set(p.flags) }, a.familyFund);
            expect(e.assets!.debt - baseline.debt, where).toBe(previewChoice(p, choice).detail.dDebt);
          } else {
            expect(e.assets, where).toBeNull();
            expect(e.familyFund, where).toBe(a.familyFund);
          }
          // 표기가 말하는 순자산·부채 변화는 applyResolved 결과 그대로다
          const impact = previewChoice(p, choice);
          if (p.assets !== null) {
            expect(impact.detail.dNet, where).toBe(a.assets!.net - p.assets.net);
            expect(impact.detail.dDebt, where).toBe(a.assets!.debt - p.assets.debt);
          } else if (Math.abs(a.familyFund) < 3000) expect(impact.detail.dFamily, where).toBe(a.familyFund - p.familyFund); // 한계(±3000)에 닿으면 잘려서 달라질 수 있다
          checked++;
        }
      }
    }
    expect(checked).toBeGreaterThan(1500);
  }, 120_000);

  it('previewPending: 대기 중인 선택지의 보이는 선택지마다 영향을 낸다 · 선택지가 없거나 인생이 아니면 null', () => {
    const p = lives('present', 3).find((s) => s.assets !== null)!;
    const out = previewPending(p, EVENT_POOL)!;
    expect(out.map((o) => o.choiceId)).toEqual(p.pending!.choiceIds);
    const ev = EVENT_POOL.byId.get(p.pending!.eventId)!;
    for (const o of out) expect(o.impact).toEqual(previewChoice(p, ev.choices!.find((c) => c.id === o.choiceId)!));
    expect(previewPending({ ...p, pending: null }, EVENT_POOL)).toBeNull();
    expect(previewPending({ ...p, phase: 'ending' }, EVENT_POOL)).toBeNull();
  });

  it('보너스가 반영된다: 같은 선택지도 부모 재력에 따라 영향이 다르다 (학원 학원비: 재력 1단계는 집안 살림 -750, 3단계는 -450)', () => {
    const choice = EVENT_POOL.byId.get('school-tutoring')!.choices!.find((c) => c.id === 'academy')!;
    const base = young(12);
    const tier = (t: ParentWealth): GameState => ({ ...base, character: { ...base.character!, parentWealth: t } });
    expect(previewChoice(tier(3), choice).detail.dFamily).toBe(-450);
    expect(previewChoice(tier(1), choice).detail.dFamily).toBe(-750);
    expect(previewChoice(tier(3), choice).items.map((i) => i.sr)).toContain('family.down.1');
    expect(previewChoice(tier(1), choice).items.map((i) => i.sr)).toContain('family.down.2');
  });
});

describe('표기 기준 지배 점검 (R-352, E11): 같은 이벤트의 선택지 쌍을 화면에 보이는 영향 줄(방향 × 칸 수)로 견준다', () => {
  /**
   * eventLint의 균형 점검(E11)은 명시 효과만 세서 일 상태·주거 같은 파생 효과로 생기는 지배를 못 잡는다. 이 점검은 사람이 선택 순간에 보는 것 — previewChoice 항목 — 으로 견준다.
   * 축: 돈(자산 또는 집안 살림, ▲ = 좋음) · 부채(▲ = 나쁨이라 부호를 뒤집는다) · 관계 · 행복 · 건강 · 지식. 값 = ±칸 수. a가 b를 지배 = 모든 축에서 a ≥ b이고 어느 한 축에서 a > b.
   * 대표 상태: 재력 {1, 3, 5} × 세 시대 × 주거 {월세, 부모 집(20세 이상만)} — 순자산 5,000·지식 50, 이벤트 나이대의 한가운데, 이벤트·선택지 조건이 요구하는 플래그를 켠다. 선택지는 그 상태에서 보이는 것만 견준다.
   */
  type Axis = 'money' | 'debt' | 'relationships' | 'happiness' | 'health' | 'education';
  const AXES: Axis[] = ['money', 'debt', 'relationships', 'happiness', 'health', 'education'];

  const vectorOf = (s: GameState, c: ChoiceDef): Record<Axis, number> => {
    const v: Record<Axis, number> = { money: 0, debt: 0, relationships: 0, happiness: 0, health: 0, education: 0 };
    for (const it of previewChoice(s, c).items) {
      const sign = it.direction === 'up' ? 1 : -1;
      if (it.key === 'assets' || it.key === 'family') v.money = sign * it.steps;
      else if (it.key === 'debt') v.debt = -sign * it.steps;
      else v[it.key] = sign * it.steps;
    }
    return v;
  };

  /** 선택지의 requires.notFlags에 쓰이는 플래그 — 이 플래그가 꺼진 상태에서만 보이는 선택지가 있다(infant-new-sibling의 notice, M7a r3) */
  const notFlagsOf = (ev: EventDef): string[] => [...new Set((ev.choices ?? []).flatMap((c) => c.requires?.notFlags ?? []))];

  const repState = (ev: EventDef, tier: ParentWealth, era: Era, dwelling: 'rent' | 'family', flagsOff = false): GameState => {
    const lo = ev.ageRange?.min ?? 0;
    const hi = ev.ageRange?.max ?? 110;
    const age = Math.round((lo + hi) / 2);
    const base = startLife(7, era);
    const flags = new Set<string>([...(ev.conditions?.flags ?? []), ...(ev.choices ?? []).flatMap((c) => c.requires?.flags ?? [])]);
    // 플래그가 꺼진 변형(M7a r3): notFlags 선택지가 보이는 상태 — requires.flags로 켠 플래그 가운데 어떤 선택지의 notFlags에 든 것을 끈다
    if (flagsOff) for (const f of notFlagsOf(ev)) flags.delete(f);
    const s: GameState = { ...base, age, stats: { ...base.stats, education: 50 }, flags: [...flags].sort(), character: { ...base.character!, parentWealth: tier }, assets: null, familyFund: 0 };
    if (age < 20) return s;
    return { ...s, assets: { net: 5000, income: incomeOf(economyContextOf(s), 0), debt: 0, incomeAdj: 0, dwelling } };
  };

  /** 대표 상태 전체에서 찾은 지배 쌍 「이벤트:나은 선택지>못한 선택지」 → 처음 나온 상태의 값(보고용) */
  function findDominance(): { pairs: Map<string, { count: number; first: string }>; states: number } {
    const pairs = new Map<string, { count: number; first: string }>();
    let states = 0;
    for (const ev of EVENT_POOL.events) {
      if ((ev.choices ?? []).length < 2) continue;
      for (const tier of [1, 3, 5] as const) {
        for (const era of ['past', 'present', 'future'] as const) {
          for (const dwelling of ['rent', 'family'] as const) {
           for (const flagsOff of notFlagsOf(ev).length > 0 ? [false, true] : [false]) {
            const s = repState(ev, tier, era, dwelling, flagsOff);
            if (s.age < 20 && dwelling === 'family') continue;
            states++;
            const cs = visibleChoices(ev, condContextOf(s));
            const vs = cs.map((c) => vectorOf(s, c));
            for (let a = 0; a < cs.length; a++) {
              for (let b = 0; b < cs.length; b++) {
                if (a === b) continue;
                let allGe = true;
                let strict = false;
                for (const k of AXES) {
                  if (vs[a][k] < vs[b][k]) allGe = false;
                  if (vs[a][k] > vs[b][k]) strict = true;
                }
                if (!(allGe && strict)) continue;
                const id = `${ev.id}:${cs[a].id}>${cs[b].id}`;
                const prev = pairs.get(id);
                if (prev !== undefined) prev.count++;
                else pairs.set(id, { count: 1, first: `${era} 재력${tier} ${dwelling} ${s.age}세 나은 쪽 ${JSON.stringify(vs[a])} 못한 쪽 ${JSON.stringify(vs[b])}` });
              }
            }
           }
          }
        }
      }
    }
    return { pairs, states };
  }

  /**
   * 알려진 지배 쌍 22개 (R-352 처리 시점 24개에서 M7a가 `infant-new-sibling:help>grandma`(grandma에 건강 +1)·`infant-stories:tell>book`(tell의 지식 +3 → +2)을 고쳐 둘이 사라졌다 — 마스터에게 보고했다, 콘텐츠 판단은 마스터). 고치지 않고 잠가 둔다: 새 지배 쌍이 생기거나 이 목록의 쌍이 사라지면 실패해서 알려 준다.
   * 대부분 한쪽이 대표 상태에서 보너스를 받지 못하는 위험한 선택(창업·대출·맞서기)이거나 칸 수가 거칠어 생긴 같은 값의 쌍이다.
   * youth-gig-work의 settle > juggle(자산 ▲▲▲ · 행복 ▲ 대 자산 ▲▲ · 건강 ▼▼ · 행복 ▼)은 마스터 결정으로 콘텐츠를 고쳐(juggle에 관계 +2, settle에 순자산 −800·행복 −1) 사라졌다.
   */
  const KNOWN_DOMINANCE: readonly string[] = [
    'middle-business:stay>start',
    'middle-business:talk>start',
    'middle-child-school:support>fund',
    'middle-child-school:support>push',
    'middle-debt-guarantee:lend>sign',
    'middle-health-check-later:exercise>treat',
    'middle-home-loan:stay>shrink',
    'middle-job-again:skill>rest',
    'middle-marriage-crisis:space>apart',
    'middle-parents-farewell:share>stay',
    'school-career-choice:skill>look',
    'school-tutoring:alone>academy',
    'senior-estate:donate>give',
    'senior-travel:near>go',
    'youth-colleague:object>leave',
    'youth-first-job:dream>family',
    'youth-first-job:dream>stable',
    'youth-housing:rent>loan',
    'youth-marriage:marry>wait',
    'youth-rent-hike:share>pay',
    'youth-startup:decline>start',
    'youth-startup:side>start',
  ];

  it('표기 기준 지배 쌍이 알려진 22개뿐이다: 새 쌍이 생기면 실패한다 (고치지 말고 목록과 수치를 보고 — 콘텐츠 판단은 마스터)', () => {
    const { pairs, states } = findDominance();
    expect(states, '대표 상태 수(공허 통과 방지)').toBeGreaterThan(1000);
    const found = [...pairs.keys()].sort();
    const added = found.filter((id) => !KNOWN_DOMINANCE.includes(id));
    const gone = KNOWN_DOMINANCE.filter((id) => !pairs.has(id));
    expect(added.map((id) => `${id} (${pairs.get(id)!.count}상태) ${pairs.get(id)!.first}`), '새 지배 쌍').toEqual([]);
    expect(gone, '목록이 낡았다 — 이 쌍은 더 이상 지배하지 않는다').toEqual([]);
  }, 120_000);

  it('R-352: youth-gig-work는 어느 쪽도 다른 쪽을 지배하지 않는다 (settle 소득 보정 −200 → 순자산 −800·행복 −1, juggle 관계 +2) — 모든 대표 상태에서', () => {
    const ev = EVENT_POOL.byId.get('youth-gig-work')!;
    let n = 0;
    for (const tier of [1, 3, 5] as const) {
      for (const era of ['present', 'future'] as const) {
        for (const dwelling of ['rent', 'family'] as const) {
          const s = repState(ev, tier, era, dwelling);
          const [juggle, settle, learn] = ['juggle', 'settle', 'learn'].map((id) => ev.choices!.find((c) => c.id === id)!);
          const vs = [juggle, settle, learn].map((c) => vectorOf(s, c));
          for (let a = 0; a < 3; a++) {
            for (let b = 0; b < 3; b++) {
              if (a === b) continue;
              const dominates = AXES.every((k) => vs[a][k] >= vs[b][k]) && AXES.some((k) => vs[a][k] > vs[b][k]);
              expect(dominates, `${era} 재력${tier} ${dwelling}: ${['juggle', 'settle', 'learn'][a]} > ${['juggle', 'settle', 'learn'][b]}`).toBe(false);
            }
          }
          // 결정된 내용: settle은 순자산 −800(구직 공백)·행복 −1, juggle은 관계 +2
          expect(settle.effects?.assets?.net).toBe(-800);
          expect(settle.effects?.assets?.income).toBeUndefined();
          expect(settle.effects?.stats?.happiness).toBe(-1);
          expect(juggle.effects?.stats?.relationships).toBe(2);
          n++;
        }
      }
    }
    expect(n).toBe(12);
  });

  it('지배하는 쪽이 5-C 예외인 쌍은 `youth-marriage:marry > wait` 하나뿐이다: 알려진 지배 쌍에서 지배하는 쪽(나은 선택지)이 5-C의 예외 8건에 드는 것은 이 한 쌍이다 (그 밖의 예외로 표기가 부호와 달라져도 선택의 균형은 깨지 않는다)', () => {
    const EXCEPTION_IDS = new Set([
      'middle-layoff:leave',
      'youth-gig-work:settle',
      'youth-startup:start',
      'middle-marriage-crisis:apart',
      'youth-marriage:marry',
      'youth-housing:loan',
      'middle-home-loan:move',
      'youth-marriage-again:marry',
    ]);
    const { pairs } = findDominance();
    const dominators = [...pairs.keys()].map((id) => id.split('>')[0]).filter((x) => EXCEPTION_IDS.has(x));
    // youth-marriage:marry > wait 한 쌍이 있다 — 재력 5단계(옛 기본 −4 + 지원 보너스 +5)에서 결혼이 기다림보다 모든 줄에서 낫게 보인다(지원 보너스). 보고에 적었다.
    expect(dominators.sort()).toEqual(['youth-marriage:marry']);
  }, 120_000);
});

describe('표기 방향과 옛 재산 부호 (EC3 부호 점검): 모든 이벤트 × 선택지 × 대표 상태', () => {
  type Legacy = { event: string; choice: string | null; base?: number | null; bonuses?: Array<{ idx: number; when: Record<string, unknown>; wealth: number }>; condition?: string };
  const legacy = (legacyJson as unknown as Legacy[]).filter((l) => l.condition === undefined && l.choice !== null && l.base != null);

  const employed = (s: GameState): boolean => s.flags.includes('has_career') || s.flags.includes('own_business');
  const dwellingOf = (s: GameState): string | null => s.assets?.dwelling ?? null;

  /**
   * 부호가 옛 wealth와 반대로 표기되는 곳 — (선택지 id, 조건) 단위로 잠근다 (R-353). 문서 5-C와 한 줄씩 같다. 이유는 모두 「옛 모델은 일 상태·부양가족·주거의 지속 비용을 몰랐다」.
   * 조건에 맞지 않는 상태의 뒤집힘(문서에 없는 조건)은 실패하고, 조건마다 실제로 한 번 이상 일어나야 한다(예외가 낡으면 실패).
   *  승인된 3건 (D16)
   *   1) middle-layoff/leave — 퇴직금(+)이지만 has_career 해제로 연 소득이 줄어 3년치가 더 크다 (모든 상태)
   *   2) youth-gig-work/settle — 안정된 일자리(has_career 켜짐)의 파생 소득이 명시 순자산 −800(구직 몇 달의 공백)보다 크다 (모든 상태)
   *   3) youth-startup/start — own_business 켜짐(0.55 → 0.8)의 파생 소득이 창업 자금(−)보다 크다 (지원·지식·외모 보너스가 없는 판: 재력 1~3단계 · 지식 < 60 · 외모 < 70)
   *  2a 전수 시험이 찾은 4건
   *   4) middle-marriage-crisis/apart — 배우자와 갈라서면 배우자 소득이 빠지지만 생활 인원 −0.5가 더 커서 연 현금흐름이 늘어 보인다 (모든 상태)
   *   5) youth-marriage/marry — 재력 4~5단계(옛 기본 −4 + 지원 보너스 +5 = +1): 결혼의 지속 비용이 지원 보너스를 넘는다
   *   6) youth-housing/loan — 월세 → 자가 전환의 주거비 절약(3년치)이 명시 변화(약 −200)를 넘는다
   *   7) middle-home-loan/move — 같은 이유(월세 → 자가 절약)
   *  R-353이 상태를 넓히며 찾은 새 조건 (D16: 사유와 함께 5-C에 적고 보고)
   *   5b) youth-marriage/marry — 재력 1~3단계라도 취업·창업 상태에서 지식 ≥ 70이면 배우자 소득 ×1.3이 결혼 비용보다 크다 (반대 방향: 옛 −4 → 자산 ▲, 점수 +34 한 칸)
   *   6b) youth-housing/loan — 재력 4~5단계가 부모 집에서 자가로 가면 생활비 ×0.25 → ×1·주거비·이자의 지속 비용이 새로 생겨 옛 +2~+5가 「자산 ▼▼▼」
   *   6c) youth-housing/loan — 월세 + 취업·창업 상태: 소득이 높아 월세(소득의 15.8%)가 커서 주거비 절약이 더 크다
   *   7b) middle-home-loan/move — 6b와 같은 이유(부모 집 · 재력 4~5단계, 부채 11,000과 지속 비용)
   *   7c) middle-home-loan/move — 6c와 같은 이유(월세 + 취업·창업)
   *   8) youth-marriage-again/marry — 취업 상태에서 지식 ≥ 70이면 배우자 소득 ×1.3이 생활 인원 +0.5·주거 전환 비용보다 크다 (옛 −3 → 자산 ▲)
   */
  interface SignException {
    id: string;
    label: string;
    when: (s: GameState) => boolean;
  }
  const edu = (s: GameState): number => s.stats.education;
  const tierOf = (s: GameState): number => s.character!.parentWealth;
  const EXCEPTIONS: SignException[] = [
    { id: 'middle-layoff/leave', label: '모든 상태', when: () => true },
    { id: 'youth-gig-work/settle', label: '모든 상태', when: () => true },
    { id: 'youth-startup/start', label: '재력 1~3단계 · 지식 < 60 · 외모 < 70', when: (s) => tierOf(s) <= 3 && edu(s) < 60 && s.character!.looks < 70 },
    { id: 'middle-marriage-crisis/apart', label: '모든 상태', when: () => true },
    { id: 'youth-marriage/marry', label: '재력 4~5단계', when: (s) => tierOf(s) >= 4 },
    { id: 'youth-marriage/marry', label: '재력 1~3단계 · 취업(has_career) · 지식 ≥ 70', when: (s) => tierOf(s) <= 3 && s.flags.includes('has_career') && edu(s) >= 70 },
    { id: 'youth-housing/loan', label: '월세 · (다가올 세상 또는 취업·창업) · 지식 ≥ 50', when: (s) => dwellingOf(s) === 'rent' && edu(s) >= 50 && (s.era === 'future' || employed(s)) },
    { id: 'youth-housing/loan', label: '부모 집 · 재력 4~5단계', when: (s) => dwellingOf(s) === 'family' && tierOf(s) >= 4 },
    { id: 'middle-home-loan/move', label: '월세 · 지식 ≥ 50 · (지식 ≥ 65 또는 취업·창업)', when: (s) => dwellingOf(s) === 'rent' && edu(s) >= 50 && (edu(s) >= 65 || employed(s)) },
    { id: 'middle-home-loan/move', label: '부모 집 · 재력 4~5단계', when: (s) => dwellingOf(s) === 'family' && tierOf(s) >= 4 },
    { id: 'youth-marriage-again/marry', label: '취업(has_career) · 지식 ≥ 70', when: (s) => s.flags.includes('has_career') && edu(s) >= 70 },
  ];

  /** 대표 상태의 변형 (R-353): 기본(월세·순자산 5,000) 위에 하나씩 바꾼다 — 7절 ①: 외모 0·100, 결혼·자녀·취업·창업·월세·자가·학생에 부모 집·순자산 음수를 더했다 */
  interface Variant {
    name: string;
    dwelling?: 'rent' | 'family' | 'own';
    net?: number;
    looks?: number;
    addFlags?: string[];
  }
  const VARIANTS: Variant[] = [
    { name: '기본(월세·순자산 5,000)' },
    { name: '부모 집', dwelling: 'family' },
    { name: '자가', dwelling: 'own' },
    { name: '순자산 −3,000(빚 3,000)', net: -3000 },
    { name: '외모 0', looks: 0 },
    { name: '외모 100', looks: 100 },
    { name: '결혼', addFlags: ['married'] },
    { name: '결혼 + 자녀', addFlags: ['married', 'has_child'] },
    { name: '취업', addFlags: ['has_career'] },
    { name: '창업', addFlags: ['own_business'] },
    { name: '학생', addFlags: ['college'] },
  ];

  const stateFor = (ev: EventDef, choice: ChoiceDef, tier: ParentWealth, era: Era, education: number, v: Variant = VARIANTS[0]): GameState => {
    const lo = ev.ageRange?.min ?? 0;
    const hi = ev.ageRange?.max ?? 110;
    const age = Math.round((lo + hi) / 2);
    const base = startLife(7, era);
    const flags = new Set<string>([...(ev.conditions?.flags ?? []), ...(choice.requires?.flags ?? []), ...(v.addFlags ?? [])]);
    const s: GameState = { ...base, age, stats: { ...base.stats, education }, flags: [...flags].sort(), character: { ...base.character!, parentWealth: tier, looks: v.looks ?? base.character!.looks }, assets: null, familyFund: 0 };
    if (age < 20) return s;
    const net = v.net ?? 5000;
    return { ...s, assets: { net, income: incomeOf(economyContextOf(s), 0), debt: Math.max(0, -net), incomeAdj: 0, dwelling: v.dwelling ?? 'rent' } };
  };

  /** 변형 상태가 실제로 일어날 수 있는가: 이벤트 조건·선택지 조건에 맞고, 이 선택이 켜려는 플래그가 이미 켜져 있지 않으며(once 이벤트), 20세 미만은 외모 변형만 의미가 있다 */
  const reachable = (ev: EventDef, choice: ChoiceDef, s: GameState, v: Variant): boolean => {
    if (v === VARIANTS[0]) return true; // 기본 상태는 예전처럼 거르지 않는다
    if (s.age < 20 && v.looks === undefined) return false;
    const ctx = condContextOf(s);
    if (!meetsCondition(ev.conditions, ctx)) return false;
    if (!visibleChoices(ev, ctx).some((c) => c.id === choice.id)) return false;
    return !(choice.effects?.setFlags ?? []).some((f) => s.flags.includes(f));
  };

  /** 옛 보너스의 조건이 이 대표 캐릭터에서 맞는가 (옛 재산 조건이면 알 수 없어 null) */
  const oldWhen = (when: Record<string, unknown>, s: GameState): boolean | null => {
    const inR = (v: number, r?: { min?: number; max?: number }) => r === undefined || ((r.min === undefined || v >= r.min) && (r.max === undefined || v <= r.max));
    const stats = when.stats as Record<string, { min?: number; max?: number }> | undefined;
    if (stats?.wealth !== undefined) return null;
    if (stats?.education !== undefined && !inR(s.stats.education, stats.education)) return false;
    if (when.parentWealth !== undefined && !inR(s.character!.parentWealth, when.parentWealth as { min?: number; max?: number })) return false;
    if (when.looks !== undefined && !inR(s.character!.looks, when.looks as { min?: number; max?: number })) return false;
    if (Array.isArray(when.flags) && !(when.flags as string[]).every((f) => s.flags.includes(f))) return false;
    return true;
  };

  it('옛 효과가 있는 선택지 128개 × 재력 {1, 3, 5} × 세 시대 × 지식 {10, 50, 80} × 대표 상태 11가지(월세·부모 집·자가·순자산 음수·외모 0·100·결혼·자녀·취업·창업·학생): 표기 방향이 옛 부호와 같다 — 다른 곳은 문서 5-C에 (id, 조건)으로 적은 11개뿐이고, 조건마다 실제로 일어난다', () => {
    const wrong: string[] = [];
    const hit = new Map<string, number>();
    let checked = 0;
    for (const v of VARIANTS) {
      for (const l of legacy) {
        const ev = EVENT_POOL.byId.get(l.event)!;
        const choice = ev.choices!.find((c) => c.id === l.choice)!;
        for (const tier of [1, 3, 5] as const) {
          for (const era of ['past', 'present', 'future'] as const) {
            for (const education of [10, 50, 80]) {
              const s = stateFor(ev, choice, tier, era, education, v);
              if (!reachable(ev, choice, s, v)) continue;
              let old = l.base as number;
              let unknown = false;
              for (const b of l.bonuses ?? []) {
                const w = oldWhen(b.when, s);
                if (w === null) unknown = true;
                else if (w) old += b.wealth;
              }
              if (unknown || old === 0) continue; // 옛 재산 조건 보너스(알 수 없음) / 기본과 보너스가 상쇄(방향 없음)
              const impact = previewChoice(s, choice);
              const money = impact.items.find((i) => i.key === 'assets' || i.key === 'family');
              const dir = money?.direction ?? 'none';
              const want = old > 0 ? 'up' : 'down';
              checked++;
              if (dir === want) continue;
              const id = `${l.event}/${l.choice}`;
              const matched = EXCEPTIONS.filter((x) => x.id === id && x.when(s));
              if (matched.length === 0) wrong.push(`${id} [${v.name}] ${era} 재력${tier} 지식${education} ${s.age}세 ${dwellingOf(s) ?? '-'}: 옛 ${old} → 표기 ${dir} (점수 ${impact.detail.assetScore})`);
              for (const x of matched) hit.set(`${x.id} — ${x.label}`, (hit.get(`${x.id} — ${x.label}`) ?? 0) + 1);
            }
          }
        }
      }
    }
    expect(checked).toBeGreaterThan(20000);
    expect(wrong.slice(0, 10), `문서에 없는 조건의 뒤집힘 ${wrong.length}건 (D16: 사유를 5-C에 적고 EXCEPTIONS에 조건을 더한다)`).toEqual([]);
    const names = EXCEPTIONS.map((x) => `${x.id} — ${x.label}`);
    expect([...hit.keys()].sort(), '예외 조건이 낡았다 — 조건마다 실제로 한 번 이상 반대로 표기되어야 한다').toEqual([...names].sort());
    expect(new Set(EXCEPTIONS.map((x) => x.id)).size, '예외 선택지 id 수 (5-C의 8건)').toBe(8);
  }, 300_000);

  it('20세 미만 이벤트(집안 살림)는 예외 없이 옛 부호와 같다: family 효과의 방향 = 옛 wealth 부호 (15개 초과 이벤트 전부)', () => {
    let n = 0;
    for (const l of legacy) {
      const ev = EVENT_POOL.byId.get(l.event)!;
      if (!ev.stages.every((s) => s === 'infant' || s === 'school')) continue;
      const choice = ev.choices!.find((c) => c.id === l.choice)!;
      const base = (choice.effects?.family ?? 0) * Math.sign(l.base as number);
      expect(base, `${l.event}/${l.choice}`).toBeGreaterThan(0);
      n++;
    }
    expect(n).toBeGreaterThan(20);
  });
});
