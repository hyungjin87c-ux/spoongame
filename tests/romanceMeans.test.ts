import { describe, expect, it, vi } from 'vitest';
import { EVENT_POOL } from '../src/data/events';
import { FOCUS_TABLE } from '../src/data/focusTable';
import { LOOKS_CONDITION_ALLOWED, condContextOf, isEventEligible, lintEvent, playToEnd, visibleChoiceGrid, visibleChoiceGridProblems, type Condition, type EventDef, type GameState } from '../src/core';
import { NEW_ALL, NEW_CARDS, NEW_CIRCLE, sample } from '../scripts/romanceReportLib';
import { chooserFor, startLife } from '../scripts/simulateLib';
import { wiringGolden } from './helpers/familyL0f';
import { preRomancePool } from './helpers/preRomancePool';

vi.mock('../src/data/personaSwitch', () => ({ PERSONA_ENABLED: true }));

/**
 * 교제 카드 + 외모 반대 사례 (SPEC-018 PL17-R, 검토안 `docs/data/review-018-romance-means.md` 7절 r2 + 7-8절): 네 사건의 구조 계약.
 * 완료 기준 ① 맞춤 밖 노출 0 · ② 외모·성별 조건 0(lint) · ④ 문구 게이트·격자 · 변주 when(주거 가드). ③(결혼 비 0.02)은 시험이 아니라 측정 기록(`report:persona -- --only=romance`)이다.
 */

const byId = (id: string): EventDef => EVENT_POOL.byId.get(id)!;
const FOUR = NEW_ALL.map(byId);
const CARDS = [...NEW_CARDS, NEW_CIRCLE].filter((id) => id !== 'youth-late-word').map(byId);

/** 객체 안의 모든 키 이름(깊이 무관) */
function keysDeep(v: unknown, out: Set<string> = new Set()): Set<string> {
  if (Array.isArray(v)) for (const x of v) keysDeep(x, out);
  else if (v !== null && typeof v === 'object') {
    for (const [k, x] of Object.entries(v)) {
      out.add(k);
      keysDeep(x, out);
    }
  }
  return out;
}

/** 모든 조건 자리(사건 조건·가중 modifiers·선택지 requires·보너스·문장 변주 when)의 조건 객체 */
function conditionsOf(e: EventDef): Condition[] {
  const out: Array<Condition | undefined> = [e.conditions];
  for (const m of e.modifiers ?? []) out.push(m.when);
  for (const b of e.bonuses ?? []) out.push(b.when);
  for (const v of e.textVariants ?? []) out.push(v.when);
  for (const c of e.choices ?? []) {
    out.push(c.requires);
    for (const b of c.bonuses ?? []) out.push(b.when);
    for (const v of c.resultVariants ?? []) out.push(v.when);
  }
  return out.filter((c): c is Condition => c !== undefined);
}

describe('네 사건이 데이터에 있다 (구조)', () => {
  it('youth-date-budget · youth-two-news · youth-late-word · youth-hobby-circle — 청년 단계 · 22~36세 안', () => {
    expect(NEW_ALL).toEqual(['youth-date-budget', 'youth-two-news', 'youth-late-word', 'youth-hobby-circle']);
    for (const e of FOUR) {
      expect(e, e?.id).toBeDefined();
      expect(e.stages).toEqual(['youth']);
      expect(e.once).toBe(true);
      expect(e.ageRange!.min).toBeGreaterThanOrEqual(22);
      expect(e.ageRange!.max).toBeLessThanOrEqual(36);
    }
  });

  it('후속 서술 youth-late-word는 선택지·질문이 없는 서술이고, 카드 셋은 질문이 있다', () => {
    expect(byId('youth-late-word').choices).toBeUndefined();
    for (const e of CARDS) expect(e.question, e.id).toBeTruthy();
  });
});

describe('완료 기준 ① 맞춤 판만 — 맞춤 밖 노출 0', () => {
  it('네 사건 모두 conditions.tailored: true다', () => {
    for (const e of FOUR) expect(e.conditions?.tailored, e.id).toBe(true);
  });

  it('맞춤 인생이 없는 판(persona 없음)에서는 어느 나이·어느 플래그에서도 자격이 없다', () => {
    const s: GameState = startLife(11, 'millennial');
    const base = condContextOf(s);
    for (const e of FOUR) {
      for (let age = 18; age <= 40; age++) {
        for (const flags of [['has_partner', 'unspoken'], ['has_partner', 'unspoken', 'missed_signal'], ['has_career'], []]) {
          const ctx = { ...base, persona: null, flags: new Set(flags) };
          expect(isEventEligible(e, { ...ctx, age, year: 2010 + age, seen: {} }), `${e.id} ${age}`).toBe(false);
        }
      }
    }
  });

  it('맞춤 없는 판 60판을 살아도 새 사건이 한 번도 연표에 남지 않는다', () => {
    const lives = sample(60, EVENT_POOL, { neutral: true }, 41);
    for (const l of lives) {
      expect(Object.keys(l.seenNew), `seed ${l.seed}`).toEqual([]);
      expect(l.cards, `seed ${l.seed}`).toEqual([]);
    }
  });
});

describe('완료 기준 ② 외모·성별은 조건·가중·requires·보너스·변주 어디에도 쓰지 않는다', () => {
  it('조건 자리 전부에서 looks·gender 키가 없다', () => {
    for (const e of FOUR) {
      for (const c of conditionsOf(e)) {
        expect(Object.keys(c), e.id).not.toContain('looks');
        expect(Object.keys(c), e.id).not.toContain('gender');
      }
    }
  });

  it('사건 정의 전체의 키에도 looks·looksChannel·gender가 없다 — 연애 외모 표(LOOKW.romance)가 곱해지지 않는다', () => {
    for (const e of FOUR) {
      const keys = keysDeep(e);
      for (const bad of ['looks', 'looksChannel', 'gender']) expect(keys.has(bad), `${e.id} ${bad}`).toBe(false);
      expect(e.modifiers, e.id).toBeUndefined();
    }
  });

  it('외모 자격 조건 허용 목록(youth-approached)에 새 사건이 없다', () => {
    for (const id of NEW_ALL) expect(LOOKS_CONDITION_ALLOWED).not.toContain(id);
  });
});

describe('결혼 사슬 — 반대 사례 stay 한 곳만 has_partner를 준다 (결정 후속 265 Q8)', () => {
  const chain = ['has_partner', 'married', 'marriage_waited', 'marriage_waited_twice', 'broke_up'];
  const flagsOf = (e: EventDef, key: 'setFlags' | 'clearFlags'): string[] => {
    const out: string[] = [];
    const eff = (x: { setFlags?: string[]; clearFlags?: string[] } | undefined): void => void out.push(...(x?.[key] ?? []));
    eff(e.effects);
    for (const b of e.bonuses ?? []) eff(b.effects);
    for (const c of e.choices ?? []) {
      eff(c.effects);
      for (const b of c.bonuses ?? []) eff(b.effects);
    }
    return out;
  };

  it('사슬 플래그를 set하는 곳은 youth-hobby-circle의 stay의 has_partner 하나뿐이다', () => {
    const where: string[] = [];
    for (const e of FOUR) {
      for (const c of e.choices ?? []) for (const f of [...(c.effects?.setFlags ?? []), ...(c.bonuses ?? []).flatMap((b) => b.effects.setFlags ?? [])]) if (chain.includes(f)) where.push(`${e.id}/${c.id}/${f}`);
      for (const f of [...(e.effects?.setFlags ?? [])]) if (chain.includes(f)) where.push(`${e.id}/${f}`);
    }
    expect(where).toEqual(['youth-hobby-circle/stay/has_partner']);
  });

  it('사슬 플래그를 지우는 곳(clearFlags)은 네 사건 어디에도 없다 — 이별 선택지도 없다', () => {
    for (const e of FOUR) {
      expect(flagsOf(e, 'clearFlags').filter((f) => chain.includes(f)), e.id).toEqual([]);
      for (const c of e.choices ?? []) expect(c.effects?.setFlags ?? [], `${e.id}/${c.id}`).not.toContain('broke_up');
    }
  });

  it('stay의 관계 효과는 +3(형진 님 확정 — 맞선 youth-matchmaker/meet과 같은 값 이상), 행복 +2', () => {
    const stay = byId(NEW_CIRCLE).choices!.find((c) => c.id === 'stay')!;
    expect(stay.effects!.stats).toEqual({ relationships: 3, happiness: 2 });
    const meet = byId('youth-matchmaker').choices!.find((c) => c.id === 'meet')!;
    expect(stay.effects!.stats!.relationships!).toBeGreaterThanOrEqual(meet.effects!.stats!.relationships!);
  });

  it('반대 사례는 짝이 없는 판(notFlags has_partner·married)에서만 열린다 — 다른 만남 길과 서로 배타', () => {
    const c = byId(NEW_CIRCLE).conditions!;
    expect(c.notFlags).toEqual(expect.arrayContaining(['has_partner', 'married']));
    expect(c.flags).toBeUndefined();
  });

  it('교제 카드 A·B는 짝이 있는 판(has_partner)이고, 결혼 전(married 제외)이다', () => {
    for (const id of ['youth-date-budget', 'youth-two-news']) {
      expect(byId(id).conditions!.flags).toContain('has_partner');
      expect(byId(id).conditions!.notFlags).toContain('married');
    }
    expect(byId('youth-late-word').conditions!.flags).toEqual(expect.arrayContaining(['unspoken', 'has_partner']));
  });
});

describe('격자·변주 (7-0, 7-8)', () => {
  it('세 선택 카드 모두 어느 칸에서도 보이는 선택지가 3개다(검사 최소 = 최대 = 3) — 형편은 글과 플래그만 바꾼다', () => {
    for (const e of CARDS) {
      const g = visibleChoiceGrid(e);
      expect(g.min, e.id).toBe(3);
      expect(g.max, e.id).toBe(3);
      expect(visibleChoiceGridProblems(e), e.id).toEqual([]);
      for (const c of e.choices!) expect(c.requires, `${e.id}/${c.id}`).toBeUndefined();
    }
  });

  it('네 사건 모두 문구 검사(lintEvent)를 통과한다 — 합쇼체·길이·시대어·상태 어휘·균형', () => {
    for (const e of FOUR) expect(lintEvent(e), e.id).toEqual([]);
  });

  it('「본가」 변주(수저 1~2)는 본가에 사는 판·부모가 모두 떠난 판을 거른다 — notFlags lives_with_parents, parents_gone (R-690)', () => {
    const talk = byId('youth-date-budget').choices!.find((c) => c.id === 'talk')!;
    const later = byId('youth-two-news').choices!.find((c) => c.id === 'later')!;
    for (const v of [...talk.resultVariants!, ...later.resultVariants!].filter((v) => v.text.includes('본가'))) {
      expect(v.when.parentWealth, v.text).toEqual({ max: 2 });
      expect(v.when.notFlags, v.text).toEqual(['lives_with_parents', 'parents_gone']);
    }
    expect([...talk.resultVariants!, ...later.resultVariants!].filter((v) => v.text.includes('본가'))).toHaveLength(2);
  });

  it('「넉넉함」 경계 ▲는 카드 A의 일곱 곳이 같은 값이다 — 상황 변주 1 · 결과 변주 3 · 보너스 3(빠듯 보너스는 ▲−1)', () => {
    const a = byId('youth-date-budget');
    const mins: number[] = [];
    const maxs: number[] = [];
    for (const c of conditionsOf(a)) {
      if (c.assets?.netMin !== undefined) mins.push(c.assets.netMin);
      if (c.assets?.netMax !== undefined) maxs.push(c.assets.netMax);
    }
    expect(mins).toHaveLength(6); // 상황 변주 1 + 결과 변주 3(go·talk·switch) + 보너스 2(go·switch)
    expect(maxs).toHaveLength(1); // 빠듯 보너스(switch) 하나
    expect(new Set(mins).size).toBe(1);
    expect(maxs[0]).toBe(mins[0] - 1);
  });

  it('변주 순서 (7-2) — 카드 B의 상황: 일하는 중 → 2020년부터 → 2009년까지, 변주는 최대 3개다', () => {
    const b = byId('youth-two-news');
    expect(b.textVariants!.map((v) => Object.keys(v.when).sort())).toEqual([['flags'], ['year'], ['year']]);
    expect(b.textVariants![0].when.flags).toEqual(['has_career']);
    expect(b.textVariants![1].when.year).toEqual({ min: 2020 });
    expect(b.textVariants![2].when.year).toEqual({ max: 2009 });
  });

  it('후속 서술의 변주 순서 (7-3) — unspoken_money → missed_signal → kept_news → 기본', () => {
    const l = byId('youth-late-word');
    expect(l.textVariants!.map((v) => v.when.flags![0])).toEqual(['unspoken_money', 'missed_signal', 'kept_news']);
    expect(l.effects!.clearFlags).toEqual(['unspoken', 'unspoken_money', 'missed_signal', 'kept_news']);
  });

  it('교제 카드가 만드는 플래그는 unspoken·unspoken_money·missed_signal·kept_news 넷뿐이고 후속 서술이 모두 지운다', () => {
    const made = new Set<string>();
    for (const e of [byId('youth-date-budget'), byId('youth-two-news')]) {
      for (const c of e.choices!) for (const f of [...(c.effects?.setFlags ?? []), ...(c.bonuses ?? []).flatMap((b) => b.effects.setFlags ?? [])]) made.add(f);
    }
    expect([...made].sort()).toEqual(['kept_news', 'missed_signal', 'unspoken', 'unspoken_money']);
    expect(byId('youth-late-word').effects!.clearFlags!.slice().sort()).toEqual([...made].sort());
  });
});

describe('초점 표 (PL10 게이트 — 모든 표지 대상 사건에 행)', () => {
  it('교제 카드 A·B → 관계, 반대 사례 → 취미·관계, 후속 서술 → 표지 없음(닥쳐오는 일 — 서술)', () => {
    expect([...FOCUS_TABLE['youth-date-budget']]).toEqual(['bond']);
    expect([...FOCUS_TABLE['youth-two-news']]).toEqual(['bond']);
    expect([...FOCUS_TABLE['youth-hobby-circle']]).toEqual(['hobby', 'bond']);
    expect([...FOCUS_TABLE['youth-late-word']]).toEqual([]);
  });
});

describe('맞춤 판에서는 실제로 나온다 (닫힌 사건이 아님)', () => {
  it('맞춤 켠 판 300판에서 반대 사례와 카드 A가 한 번 이상 나온다', () => {
    const lives = sample(300, EVENT_POOL, {}, 41);
    const seen = (id: string): number => lives.filter((l) => l.seenNew[id] !== undefined).length;
    expect(seen(NEW_CIRCLE)).toBeGreaterThan(0);
    expect(seen('youth-date-budget')).toBeGreaterThan(0);
  });
});

describe('맞춤 없는 판은 데이터 전과 바이트 동일 · 가족 배선은 「골든 + youth-hobby-circle」 (마스터 판단 2026-11-18)', () => {
  it('맞춤 인생이 없는 판은 새 사건 넷을 뺀 풀과 넣은 풀에서 전 생애 결과(상태·카운트·마지막 틱)가 글자까지 같다 — 세대 3 × 시드 25 × 전략 2', () => {
    const full = EVENT_POOL;
    const pre = preRomancePool();
    for (const gen of ['millennial', 'industrial', 'alpha'] as const) {
      for (const strategy of ['auto', 'first'] as const) {
        for (let i = 1; i <= 25; i++) {
          const seed = i * 7919 + 13;
          const s0 = startLife(seed, gen);
          const { persona: _p, ...rest } = s0;
          void _p;
          const start = rest as GameState;
          const a = playToEnd(start, chooserFor(strategy, seed), full);
          const b = playToEnd(start, chooserFor(strategy, seed), pre);
          expect(JSON.stringify([a.state, a.counts, a.last]), `${gen}/${strategy}/${seed}`).toBe(JSON.stringify([b.state, b.counts, b.last]));
        }
      }
    }
  });
  // 같은 요구를 이미 잠그는 시험(이 시험과 별개): tests/rngSnapshot.test.ts · tests/familyHash.test.ts · tests/eligibilityGoldenBoundary.test.ts · tests/personaCondition.test.ts

  it('가족 배선: 지금 풀의 배선은 얼린 골든(PL17-R 전 풀) + youth-hobby-circle의 has_partner 하나뿐이다', () => {
    const now = wiringGolden(EVENT_POOL);
    const was = wiringGolden();
    for (const key of Object.keys(was)) {
      const want = key === 'has_partner:set' ? [...was[key], 'youth-hobby-circle'].sort() : was[key];
      expect(now[key], key).toEqual(want);
    }
  });
});
