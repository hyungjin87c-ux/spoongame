import { describe, expect, it, vi } from 'vitest';
import { EVENT_POOL } from '../src/data/events';
import { PERSONA_TABLE as T } from '../src/data/personaTable';
import {
  condContextOf,
  eventPool,
  eventWeight,
  isEventEligible,
  jobLookK,
  jobLookTerm,
  looksChannelBounds,
  looksChannelMult,
  looksEraOf,
  looksEraValues,
  looksZ,
  resolveEffects,
  wageLookMult,
  type CondContext,
  type EligibilityView,
  type EventDef,
  type GameState,
} from '../src/core';
import { looksTierOf } from '../src/assets/faces/faceLayers';
import { startLife } from '../scripts/simulateLib';
import { LOOKS_BUSINESS_EVENTS, LOOKS_ROMANCE_EVENTS } from './helpers/looksExceptions';

vi.mock('../src/data/personaSwitch', () => ({ PERSONA_ENABLED: true }));

/**
 * 외모 영향 (SPEC-018 PL16, 설계 4B·4C-1): 방향·시대·예외 목록·연애가 어느 단계에서도 막히지 않음. 외모 문장·반대 사례 사건(PL17)은 콘텐츠 뒤라 여기엔 자리만 있다.
 * `persona`가 없는 판·스위치를 끈 판에도 표준 표가 적용되는 것(F11)은 `personaSwitch.test.ts`가 본다.
 */

const pool = eventPool();
const byId = (id: string): EventDef => pool.byId.get(id)!;
/** 외모 단계의 대표 점수 */
const LOOKS_OF_TIER = [10, 35, 50, 65, 90] as const;

/** 인생(0세)을 `age`살로 옮기고 외모를 정한 판 — 연애 사건이 열리는 상태(짝 없음)로 만든다 */
function ctxFor(generation: 'boomer' | 'millennial' | 'genz', looks: number, age: number, over: { persona?: boolean } = {}): CondContext {
  const s: GameState = { ...startLife(11, generation, { looks }), age };
  const ctx = condContextOf(s);
  return over.persona === false ? { ...ctx, persona: null } : ctx;
}

describe('표준 표 값과 단계 (4B)', () => {
  it('LOOKW 연애 0.30 / 0.65 / 1.0 / 1.35 / 1.70 · 교우 0.85 / 0.925 / 1.0 / 1.075 / 1.15, z = −1 / −0.5 / 0 / 0.5 / 1', () => {
    expect([...T.LOOKW.romance]).toEqual([0.3, 0.65, 1, 1.35, 1.7]);
    expect([...T.LOOKW.friend]).toEqual([0.85, 0.925, 1, 1.075, 1.15]);
    expect([...T.LOOKZ['1 2 3 4 5']]).toEqual([-1, -0.5, 0, 0.5, 1]);
    LOOKS_OF_TIER.forEach((looks, i) => {
      expect(looksTierOf(looks)).toBe(i + 1);
      expect(looksZ(looks)).toBe(T.LOOKZ['1 2 3 4 5'][i]);
    });
  });

  it('연애 곱수는 k 0.70: 1 + 0.70·z 와 같다 (교우 1 + 0.15·z)', () => {
    T.LOOKW.romance.forEach((w, i) => expect(w).toBeCloseTo(1 + 0.7 * T.LOOKZ['1 2 3 4 5'][i], 12));
    T.LOOKW.friend.forEach((w, i) => expect(w).toBeCloseTo(1 + 0.15 * T.LOOKZ['1 2 3 4 5'][i], 12));
  });

  it('방향: 외모가 높을수록 곱수가 크고(연애·교우), 어느 단계에서도 0보다 크다', () => {
    for (const channel of ['romance', 'friend'] as const) {
      let prev = 0;
      for (const looks of LOOKS_OF_TIER) {
        const m = looksChannelMult(channel, looks, 2005, true);
        expect(m, `${channel} ${looks}`).toBeGreaterThan(prev);
        prev = m;
      }
    }
  });

  it('채널 곱 범위: 연애 [0.30, 1.70] · 교우 [0.85, 1.15] — 시대 배율은 폭을 줄이기만 한다', () => {
    expect(looksChannelBounds('romance')).toEqual([0.3, 1.7]);
    expect(looksChannelBounds('friend')).toEqual([0.85, 1.15]);
  });
});

describe('시대 배율 LOOKERA (4C-1)', () => {
  it('모든 칸이 (0, 1.0] 이다 — 확정 k를 키우지 않는다', () => {
    for (const kind of ['romance', 'friend', 'general', 'face', 'wage'] as const) for (const v of looksEraValues(kind)) expect(v, kind).toBeGreaterThan(0), expect(v, kind).toBeLessThanOrEqual(1);
  });

  it('1996~2019(밀레니얼 구간)는 모든 종류가 정확히 1.0이다 — 형진 님 확정 k 그대로', () => {
    for (const kind of ['romance', 'friend', 'general', 'face', 'wage'] as const) for (let y = 1996; y <= 2019; y++) expect(looksEraOf(kind, y), `${kind} ${y}`).toBe(1);
  });

  it('바깥은 ▲ 설계값: 연애 ~1995 0.8, 일반 취업 2020~ 0.8, 나머지 1.0', () => {
    expect(looksEraOf('romance', 1995)).toBe(0.8);
    expect(looksEraOf('romance', 1940)).toBe(0.8);
    expect(looksEraOf('romance', 1996)).toBe(1);
    expect(looksEraOf('romance', 2030)).toBe(1);
    expect(looksEraOf('general', 2019)).toBe(1);
    expect(looksEraOf('general', 2020)).toBe(0.8);
    expect(looksEraOf('friend', 1950)).toBe(1);
    expect(looksEraOf('face', 2030)).toBe(1);
    expect(looksEraOf('wage', 1950)).toBe(1);
  });

  it('연애 곱수: 1995년 이전 판은 폭이 0.8배 — 1단계 0.44 · 5단계 1.56, 곱수는 어느 시기에도 0보다 크다', () => {
    expect(looksChannelMult('romance', 10, 1990, true)).toBeCloseTo(1 + (0.3 - 1) * 0.8, 12);
    expect(looksChannelMult('romance', 90, 1990, true)).toBeCloseTo(1 + (1.7 - 1) * 0.8, 12);
    for (let y = 1940; y <= 2100; y++) for (const looks of LOOKS_OF_TIER) expect(looksChannelMult('romance', looks, y, true), `${y}/${looks}`).toBeGreaterThan(0);
  });

  it('시대 배율을 끄면(eraOn false = 맞춤 인생 없는 판) 표 값 그대로이고, 연도를 몰라도 표 값 그대로다', () => {
    expect(looksChannelMult('romance', 10, 1990, false)).toBe(0.3);
    expect(looksChannelMult('romance', 90, undefined, true)).toBe(1.7);
  });
});

describe('기존 사건: 외모 가중은 예외 목록 5곳이 표준 표로, 그 밖은 변경 0 (4B 예외 목록)', () => {
  it('looksChannel이 붙은 사건은 정확히 연애·소개·재회 5곳(school-first-love·youth-meeting·youth-meeting-again·youth-matchmaker·youth-workplace-romance)이다', () => {
    const withChannel = EVENT_POOL.events.filter((e) => e.looksChannel !== undefined).map((e) => e.id).sort();
    expect(withChannel).toEqual([...LOOKS_ROMANCE_EVENTS].sort());
    for (const id of LOOKS_ROMANCE_EVENTS) expect(byId(id).looksChannel).toBe('romance');
  });

  it('외모를 modifiers·bonuses·conditions에 쓰는 사건 전수 — 예외 밖은 4B가 확인한 목록 그대로다(결혼 사슬 4건은 바꾸지 않는다)', () => {
    const where = (e: EventDef): string[] => {
      const w: string[] = [];
      if ((e.modifiers ?? []).some((m) => m.when.looks !== undefined)) w.push('modifiers');
      if (e.conditions?.looks !== undefined) w.push('conditions');
      if ((e.bonuses ?? []).some((b) => b.when.looks !== undefined)) w.push('bonuses');
      if ((e.choices ?? []).some((c) => (c.bonuses ?? []).some((b) => b.when.looks !== undefined))) w.push('choice-bonuses');
      return w;
    };
    const found = Object.fromEntries(EVENT_POOL.events.map((e) => [e.id, where(e)] as const).filter(([, w]) => w.length > 0));
    expect(found).toEqual({
      'youth-marriage': ['modifiers'],
      'youth-marriage-again': ['modifiers'],
      'youth-reunion': ['modifiers'],
      'youth-second-chance': ['modifiers'],
      'youth-approached': ['conditions'],
      'school-mirror': ['bonuses'],
      'youth-meeting': ['choice-bonuses'],
      'school-first-love': ['choice-bonuses'],
    });
  });

  it('결혼 결정 사건 4곳의 외모 modifiers는 그대로다(종전 계단 ×1.5~1.8 / ×0.5~0.6)', () => {
    const want: Record<string, [number, number | undefined]> = { 'youth-marriage': [1.8, 0.5], 'youth-marriage-again': [1.5, 0.6], 'youth-reunion': [1.5, undefined], 'youth-second-chance': [1.8, 0.5] };
    for (const [id, [hi, lo]] of Object.entries(want)) {
      const mods = byId(id).modifiers!.filter((m) => m.when.looks !== undefined);
      expect(mods.find((m) => m.when.looks!.min === 70)?.weight, id).toBe(hi);
      expect(mods.find((m) => m.when.looks!.max === 30)?.weight, id).toBe(lo);
      expect(byId(id).looksChannel, id).toBeUndefined();
    }
  });

  it('연애 5곳의 가중은 표준 표 LOOKW.romance 비율이다 (외모 단계 k / 3단계) — 같은 사건의 다른 가중은 그대로', () => {
    for (const id of LOOKS_ROMANCE_EVENTS) {
      const ev = byId(id);
      // 외모 외 가중이 같은 상태에서 단계별 가중비 (persona 있는 판의 시대 배율 1.0 구간: 밀레니얼 판 25세)
      const base = eventWeight(ev, ctxFor('millennial', 50, 25));
      LOOKS_OF_TIER.forEach((looks, i) => expect(eventWeight(ev, ctxFor('millennial', looks, 25)) / base, `${id} 단계 ${i + 1}`).toBeCloseTo(T.LOOKW.romance[i], 12));
    }
  });

  it('youth-meeting의 first_love ×1.3은 그대로 곱해진다(외모 항만 표준 표로 옮겼다)', () => {
    const ev = byId('youth-meeting');
    const ctx = ctxFor('millennial', 90, 25);
    const withFlag: CondContext = { ...ctx, flags: new Set(['first_love']) };
    expect(eventWeight(ev, withFlag) / eventWeight(ev, ctx)).toBeCloseTo(1.3, 12);
  });

  it('1995년 이전을 사는 판(맞춤 인생 있음)은 연애 폭이 0.8배, persona 없는 판은 표 값 그대로다', () => {
    const ev = byId('youth-meeting');
    const ctx5 = ctxFor('boomer', 90, 25);
    const ctx3 = ctxFor('boomer', 50, 25);
    expect(ctx5.year!).toBeLessThanOrEqual(1995);
    expect(eventWeight(ev, ctx5) / eventWeight(ev, ctx3)).toBeCloseTo(1 + 0.7 * 0.8, 12);
    const bare5 = ctxFor('boomer', 90, 25, { persona: false });
    const bare3 = ctxFor('boomer', 50, 25, { persona: false });
    expect(eventWeight(ev, bare5) / eventWeight(ev, bare3)).toBeCloseTo(1.7, 12);
  });

  it('첫사랑 confess의 「외모 ≤ 30 → 행복 −3」은 없다(이중 감점 삭제, 결정 후속 233) — ≥ 70 보너스 +3/+2와 youth-meeting의 +1은 그대로다', () => {
    const confess = byId('school-first-love').choices!.find((c) => c.id === 'confess')!;
    expect(confess.bonuses).toEqual([{ when: { looks: { min: 70 } }, effects: { stats: { happiness: 3, relationships: 2 } } }]);
    const fx = (looks: number) => resolveEffects(confess.effects, confess.bonuses, ctxFor('millennial', looks, 16)).stats;
    expect(fx(0)).toEqual(fx(50));
    expect(fx(10)).toEqual(fx(50));
    expect(fx(90).happiness).toBe((fx(50).happiness ?? 0) + 3);
    expect(byId('youth-meeting').choices!.find((c) => c.id === 'meet')!.bonuses).toEqual([{ when: { looks: { min: 70 } }, effects: { stats: { happiness: 1 } } }]);
  });

  it('사업 제안 2곳은 외모 단계 사이에 가중·효과가 같다(외모 가중·소득 보너스 제거, k = 0) — 수저 등 다른 가중은 그대로', () => {
    for (const id of LOOKS_BUSINESS_EVENTS) {
      const ev = byId(id);
      const age = id === 'youth-startup' ? 30 : 45;
      const weights = LOOKS_OF_TIER.map((l) => eventWeight(ev, ctxFor('millennial', l, age)));
      expect(new Set(weights).size, id).toBe(1);
      for (const c of ev.choices!) {
        const fx = LOOKS_OF_TIER.map((l) => JSON.stringify(resolveEffects(c.effects, c.bonuses, ctxFor('millennial', l, age))));
        expect(new Set(fx).size, `${id}/${c.id}`).toBe(1);
      }
    }
    const wealth = (w: 1 | 5): number => eventWeight(byId('youth-startup'), { ...ctxFor('millennial', 50, 30), character: { ...ctxFor('millennial', 50, 30).character, parentWealth: w } });
    expect(wealth(5) / wealth(1)).toBeCloseTo(1.6, 12); // parentWealth ×1.6은 그대로
  });
});

describe('길을 막지 않는다 — 연애는 어느 외모 단계에서도 열려 있다 (4B 원칙 ①·PL17)', () => {
  const view = (ctx: CondContext): EligibilityView => ({ ...ctx, age: ctx.age!, year: ctx.year!, seen: {} });

  it('연애 사건의 자격은 외모와 무관하다: 모든 외모 단계에서 같은 판이 같은 사건에 자격이 있다', () => {
    for (const id of LOOKS_ROMANCE_EVENTS) {
      const ev = byId(id);
      const age = Math.max(ev.ageRange?.min ?? 20, 26);
      for (const gen of ['millennial', 'boomer', 'genz'] as const) {
        const states = [0, 10, 30, 50, 70, 90, 100].map((l) => isEventEligible(ev, view(ctxFor(gen, l, age))));
        expect(new Set(states).size, `${id} ${gen}`).toBe(1);
      }
    }
  });

  it('외모 1단계(점수 0)에서도 연애 사건의 가중은 기본 가중의 0.30배 이상이다 — 0이 되지 않는다', () => {
    for (const id of LOOKS_ROMANCE_EVENTS) {
      const ev = byId(id);
      const w1 = eventWeight(ev, ctxFor('millennial', 0, 26));
      expect(w1, id).toBeGreaterThanOrEqual(ev.weight * 0.3 * 0.7 - 1e-9);
      expect(w1, id).toBeGreaterThan(0);
    }
  });

  it('소개·재회·직장 연애 경로 사건이 모든 외모 단계에 열려 있다(각 단계에서 후보로 나올 연애 사건이 둘 이상)', () => {
    // 26세·짝 없음·진로 있음·소개를 받은 적 있는 판: 연애 후보 수는 외모 단계와 무관하다
    for (const looks of LOOKS_OF_TIER) {
      const ctx = { ...ctxFor('millennial', looks, 32), flags: new Set(['has_career', 'met_intro']) };
      const open = LOOKS_ROMANCE_EVENTS.filter((id) => id !== 'school-first-love').filter((id) => isEventEligible(byId(id), view({ ...ctx, year: 2012 })));
      expect(open.length, `외모 ${looks}`).toBeGreaterThanOrEqual(2);
    }
  });

  // 이번 단계(3b)는 확률·효과만 — 반대 사례 사건 존재 시험은 콘텐츠(문장 designer 문구 → reviewer 낙인 판독 → 형진 님 확인)가 들어오는 PL17에서 이 자리를 채운다(설계 4B PL17 연결)
  it.todo('PL17 반대 사례 사건: 외모 1~2단계여도 붙임성·적성·취미 모임으로 풀리는 사건 ⓐ와 외모 4~5단계여도 외모로만 보이는 피로를 겪는 사건 ⓑ가 각 1개 이상 있다');
});

describe('외모 함수 — 취업·임금 (4B·5절)', () => {
  it('취업 k: 일반 0.05(~2019 시대 불변, 2020~ ×0.8 = 0.04) · 대면 ~2016 0.20 · 2017~2018 0.12 · 2019~ 0.08', () => {
    expect(jobLookK('general', 2005, true)).toBe(0.05);
    expect(jobLookK('general', 2019, true)).toBe(0.05);
    expect(jobLookK('general', 2020, true)).toBeCloseTo(0.04, 12);
    expect(jobLookK('general', 2020, false)).toBe(0.05); // 맞춤 인생이 없으면 시대 배율을 곱하지 않는다
    for (const [y, k] of [[1990, 0.2], [2016, 0.2], [2017, 0.12], [2018, 0.12], [2019, 0.08], [2040, 0.08]] as [number, number][]) {
      expect(jobLookK('face', y, true), `${y}`).toBe(k);
      expect(jobLookK('face', y, false), `${y} off`).toBe(k);
    }
  });

  it('설계 4B 손계산: 일반 직종 5단계 0.483 / 1단계 0.437, 대면 2010 0.552 / 0.368 · 2018 0.515 / 0.405 · 2020 0.497 / 0.423 (p0 0.46)', () => {
    const at = (sens: 'general' | 'face', looks: number, year: number): number => 0.46 * (1 + jobLookTerm(sens, looks, year, true));
    expect(at('general', 90, 2010)).toBeCloseTo(0.483, 3);
    expect(at('general', 10, 2010)).toBeCloseTo(0.437, 3);
    expect(at('face', 90, 2010)).toBeCloseTo(0.552, 3);
    expect(at('face', 10, 2010)).toBeCloseTo(0.368, 3);
    expect(at('face', 90, 2018)).toBeCloseTo(0.515, 3);
    expect(at('face', 10, 2018)).toBeCloseTo(0.405, 3);
    expect(at('face', 90, 2020)).toBeCloseTo(0.497, 3);
    expect(at('face', 10, 2020)).toBeCloseTo(0.423, 3);
  });

  it('입사 뒤 임금: 1 + 0.03·z — 최대 ±3%', () => {
    expect(wageLookMult(10)).toBeCloseTo(0.97, 12);
    expect(wageLookMult(35)).toBeCloseTo(0.985, 12);
    expect(wageLookMult(50)).toBe(1);
    expect(wageLookMult(65)).toBeCloseTo(1.015, 12);
    expect(wageLookMult(90)).toBeCloseTo(1.03, 12);
    for (let looks = 0; looks <= 100; looks++) expect(Math.abs(wageLookMult(looks) - 1)).toBeLessThanOrEqual(0.03 + 1e-12);
  });
});
