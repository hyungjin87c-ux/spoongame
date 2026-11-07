import { describe, expect, it } from 'vitest';
import {
  GENERATION_IDS,
  NO_DEATH_PLAN,
  coParentsAtPlan,
  coParentsFn,
  coParentsOf,
  familyViewOf,
  resolveDelegated,
  type CoParents,
  type FamilyData,
  type GameState,
  type ProfileId,
} from '../src/core';
import { CHILD_CHIP_TEXT, CHILD_FLOW_TEXT, FIRST_PARENT_HINT, PARENT_CHIP_TEXT, PARENT_DECIDED_TEXT, decidedByText, parentWording } from '../src/data/parentDecisionTable';
import { runYoungLife, seedOf } from '../scripts/parentReportLib';
import { EVENT_POOL } from '../src/data/events';
import { startLife } from '../scripts/simulateLib';
import { forcedPending } from './helpers/forcedPending';

/**
 * DS1 주어 판정 함수 `coParentsOf` · DS2 문구 함수 `parentWording` (SPEC-011 — DS3 엔딩 요약의 주어는 형진 님 요청으로 문장이 없어져 하지 않는다, 2026-11-08; `docs/data/ask-model.md` 10절 · 완료 기준 19~22).
 * 7000판(7세대 × 1000판, `FAMILY_INV_LIVES=1000`과 같은 크기) 전수는 계획만 읽는 순수 함수라 평소 `npm test`에서도 돈다(판당 가족 보기 계산이 무거운 대조는 나이 0~19 전부를 7000판에서 본다).
 * 줄 단위 건수 보고(게이트 아님)는 `SUBJECT_REPORT=1`로 돌릴 때만 찍는다.
 */

declare const process: { env: Record<string, string | undefined> };
const PER_GEN = 1000;
/** 줄 단위 건수(보고)는 어린 시절을 실제로 돌려 무겁다 — 평소는 세대당 200판, 보고(`SUBJECT_REPORT=1`)는 7000판 */
const LINE_LIVES = process.env.SUBJECT_REPORT !== undefined ? 1000 : 200;
const AGES = Array.from({ length: 20 }, (_, i) => i); // 0~19 (함께 사는 부모의 「어른」 경계는 20세 — familyViewOf의 FAMILY_ADULT_AGE)
const seedFor = (gi: number, i: number): number => 1 + i * 41 + gi * 1_000_003;

const withoutFlag = (s: GameState, flag: string): GameState => ({ ...s, flags: s.flags.filter((f) => f !== flag) });
const householdParents = (s: GameState, age: number): CoParents => {
  const ids = new Set(familyViewOf(s, age).household);
  const mother = ids.has('mother');
  const father = ids.has('father');
  return mother && father ? 'both' : mother ? 'mother' : father ? 'father' : 'none';
};

describe('DS1 계획만으로 읽는 판정 (합성 계획 — 경계·단조·none 갈래)', () => {
  it('계획이 없으면 모든 나이에 두 분이다', () => {
    for (const age of AGES) expect(coParentsAtPlan({ firstGone: null, divorce: null }, age)).toBe('both');
  });

  it('별세: 별세가 난 해(age == at)는 두 분이고 다음 해부터 남은 한 분이다 (어머니 별세 → 아버지만 · 아버지 별세 → 어머니만)', () => {
    const mother = { firstGone: { who: 0 as const, at: 5 }, divorce: null };
    expect(coParentsAtPlan(mother, 4)).toBe('both');
    expect(coParentsAtPlan(mother, 5)).toBe('both');
    expect(coParentsAtPlan(mother, 6)).toBe('father');
    expect(coParentsAtPlan(mother, 19)).toBe('father');
    const father = { firstGone: { who: 1 as const, at: 1 }, divorce: null };
    expect(coParentsAtPlan(father, 0)).toBe('both');
    expect(coParentsAtPlan(father, 1)).toBe('both');
    expect(coParentsAtPlan(father, 2)).toBe('mother');
  });

  it('이혼·별거: 난 해(age == at)는 두 분이고 다음 해부터 함께 사는 분만이다 (떠난 쪽이 아버지면 어머니만 · 어머니면 아버지만)', () => {
    const fatherLeaves = { firstGone: null, divorce: { at: 4, leaver: 1 as const } };
    expect(coParentsAtPlan(fatherLeaves, 4)).toBe('both');
    expect(coParentsAtPlan(fatherLeaves, 5)).toBe('mother');
    const motherLeaves = { firstGone: null, divorce: { at: 9, leaver: 0 as const } };
    expect(coParentsAtPlan(motherLeaves, 9)).toBe('both');
    expect(coParentsAtPlan(motherLeaves, 10)).toBe('father');
  });

  it('같은 분이 이혼으로 나가고 별세도 하는 판은 남은 분이 그대로 한 분이다', () => {
    const plan = { firstGone: { who: 1 as const, at: 12 }, divorce: { at: 3, leaver: 1 as const } };
    expect(coParentsAtPlan(plan, 3)).toBe('both');
    expect(coParentsAtPlan(plan, 4)).toBe('mother');
    expect(coParentsAtPlan(plan, 13)).toBe('mother');
  });

  it('none 갈래(방어 분기): 두 분이 모두 떠난 상태의 계획(실제 계획에서는 만들어지지 않는다)을 합성하면 「없음」이고, 그 전에는 한 분이다', () => {
    const synthetic = { firstGone: { who: 0 as const, at: 3 }, divorce: { at: 6, leaver: 1 as const } };
    expect(coParentsAtPlan(synthetic, 3)).toBe('both');
    expect(coParentsAtPlan(synthetic, 4)).toBe('father');
    expect(coParentsAtPlan(synthetic, 6)).toBe('father');
    expect(coParentsAtPlan(synthetic, 7)).toBe('none');
    expect(coParentsAtPlan(synthetic, 19)).toBe('none');
    // 「없음」의 문구는 기본(부모님)이다 (결정 K10)
    expect(parentWording('none')).toEqual(parentWording('both'));
  });

  it('단조: 한 번 떠난 분은 돌아오지 않는다 — 나이가 오르면 두 분 → 한 분 → (없음) 순서로만 간다', () => {
    const order: Record<CoParents, number> = { both: 0, mother: 1, father: 1, none: 2 };
    const plans = [
      { firstGone: { who: 0 as const, at: 7 }, divorce: null },
      { firstGone: null, divorce: { at: 2, leaver: 0 as const } },
      { firstGone: { who: 1 as const, at: 15 }, divorce: { at: 5, leaver: 0 as const } },
    ];
    for (const plan of plans) {
      let prev = 0;
      for (const age of AGES) {
        const now = coParentsAtPlan(plan, age);
        expect(order[now], `${JSON.stringify(plan)} ${age}세`).toBeGreaterThanOrEqual(prev);
        prev = order[now];
      }
    }
  });
});

describe('DS1 7000판 전수 — 19세 미만 모든 나이에서 familyViewOf의 함께 사는 부모와 같다 (parents_gone을 끈 상태)', () => {
  const tally = { lives: 0, none: 0, checks: 0, nonBoth: 0 };
  const problems: string[] = [];

  for (const [gi, gen] of GENERATION_IDS.entries()) {
    it(`${gen}: ${PER_GEN}판 × 나이 0~19`, { timeout: 300_000 }, () => {
      for (let i = 0; i < PER_GEN; i++) {
        const s0 = startLife(seedFor(gi, i), gen as ProfileId);
        tally.lives++;
        const off = withoutFlag(s0, 'parents_gone');
        for (const age of AGES) {
          const mine = coParentsOf(s0, age);
          tally.checks++;
          if (mine === 'none') tally.none++;
          if (mine !== 'both') tally.nonBoth++;
          const view = householdParents(off, age);
          if (mine !== view && problems.length < 20) problems.push(`${gen}/${i} ${age}세: coParentsOf ${mine} ≠ familyViewOf ${view}`);
        }
      }
    });
  }

  it('위반 0 · 「없음」 0건(구조상 도달하지 않는다 — INV-2c·R-558, 1건이라도 나오면 문구 문제가 아니라 계획 버그) · 시험이 공허하지 않다(한 분이 된 나이가 실제로 있다)', () => {
    expect(problems).toEqual([]);
    expect(tally.lives).toBe(GENERATION_IDS.length * PER_GEN);
    expect(tally.none).toBe(0);
    expect(tally.nonBoth, '한 분만 함께 사는 (판 × 나이) 칸').toBeGreaterThan(0);
  });
});

describe('DS1 현재 플래그를 읽지 않는다 — parents_gone 등이 켜져도 같은 값이다', () => {
  it('7세대 × 판: 플래그 5개를 모두 켜도 coParentsOf는 같고, 같은 상태의 familyViewOf는 달라진다(그래서 이 함수가 따로 있다)', () => {
    const flags = ['parents_gone', 'mother_gone', 'father_gone', 'mother_apart', 'father_apart'];
    let familyViewDiffers = 0;
    for (const [gi, gen] of GENERATION_IDS.entries()) {
      for (let i = 0; i < 60; i++) {
        const s0 = startLife(seedFor(gi, i), gen as ProfileId);
        const on: GameState = { ...s0, flags: [...new Set([...s0.flags, ...flags])] };
        for (const age of AGES) expect(coParentsOf(on, age), `${gen}/${i} ${age}세`).toBe(coParentsOf(s0, age));
        if (householdParents(on, 5) !== householdParents(withoutFlag(s0, 'parents_gone'), 5)) familyViewDiffers++;
      }
    }
    expect(familyViewDiffers, 'parents_gone이 familyViewOf의 함께 사는 부모를 바꾼 판').toBeGreaterThan(0);
  });

  it('나이 20 이상(어른)에서도 계획만 읽으므로 늦은 나이의 별세·사건에 끌려가지 않는다', () => {
    const s0 = startLife(seedFor(0, 3), 'genx');
    expect(coParentsOf(s0, 5)).toBe(coParentsOf({ ...s0, age: 70 }, 5));
  });
});

describe('DS1 부모 결정 줄 단위 건수 (보고 — 게이트 아님): 0~19세 판을 돌려 줄마다 그 해의 주어를 센다', () => {
  it('7세대 × (평소 200판 · 보고 1000판): 줄 단위로 「없음」 0 · 두 분·어머니만·아버지만 건수와 비율을 보고한다', { timeout: 300_000 }, () => {
    const counts: Record<CoParents, number> = { both: 0, mother: 0, father: 0, none: 0 };
    let lines = 0;
    let livesWithOne = 0;
    let lives = 0;
    /** 한 분만 함께 사는 해의 부모 결정 카드·줄 글에 내 부모를 가리키는 「부모님」 낱말(기존 이벤트 데이터 문장)이 있는 줄(사건 id별 수) — 도장 주어는 한 분인데 카드 글이 「부모님」이면 어긋난다. 데이터 문장은 이 SPEC 범위 밖이라 보고만 한다 */
    const leaks = new Map<string, number>();
    for (const [gi, gen] of GENERATION_IDS.entries()) {
      for (let i = 1; i <= LINE_LIVES; i++) {
        const seed = seedOf(i) + gi * 7;
        const start = startLife(seed, gen as ProfileId);
        const life = runYoungLife(start, seed, 'random');
        const at = coParentsFn(start);
        let one = false;
        for (const h of life.history) {
          if (h.kind !== 'choice' || h.by !== 'parent') continue;
          const co = at(h.age);
          counts[co]++;
          lines++;
          if (co !== 'both') {
            one = true;
            const ev = EVENT_POOL.byId.get(h.eventId!)!;
            const shown = [ev.title, ev.text, h.text, h.choice ?? ''].join(' ');
            if (/(?<!조)부모님/.test(shown)) leaks.set(h.eventId!, (leaks.get(h.eventId!) ?? 0) + 1);
          }
        }
        lives++;
        if (one) livesWithOne++;
      }
    }
    expect(counts.none, '「없음」 줄').toBe(0);
    expect(lines).toBe(counts.both + counts.mother + counts.father);
    expect(counts.mother, '어머니만 줄').toBeGreaterThan(0);
    expect(counts.father, '아버지만 줄').toBeGreaterThan(0);
    if (process.env.SUBJECT_REPORT !== undefined) {
      const pct = (n: number): string => `${((100 * n) / lines).toFixed(2)}%`;
      console.info(`[DS1 한 분 줄의 데이터 문장에 「부모님」] ${JSON.stringify(Object.fromEntries(leaks))}`);
      console.info(`[DS1 줄 단위] 판 ${lives} · 부모 결정 줄 ${lines} · 두 분 ${counts.both}(${pct(counts.both)}) · 어머니만 ${counts.mother}(${pct(counts.mother)}) · 아버지만 ${counts.father}(${pct(counts.father)}) · 없음 ${counts.none} · 한 분 줄이 있는 판 ${livesWithOne}(${((100 * livesWithOne) / lives).toFixed(2)}%)`);
    }
  });
});

describe('DS2 문구 함수 parentWording — 도장·칩·안내가 한 함수에서 나온다 (SPEC 4절 표)', () => {
  it('세 꼴: 두 분(기본) · 어머니만 · 아버지만, 「없음」은 기본 문구', () => {
    expect(parentWording('both')).toEqual({ subject: '부모님', ga: '부모님이', stamp: '부모님이 이렇게 정했습니다', chip: '부모님의 결정', hint: '어린 시절의 큰 결정은 부모님이 내립니다. 열세 살부터는 공부·친구·취미를 직접 고릅니다.' });
    expect(parentWording('mother')).toEqual({ subject: '어머니', ga: '어머니가', stamp: '어머니가 이렇게 정했습니다', chip: '어머니의 결정', hint: '어린 시절의 큰 결정은 어머니가 내립니다. 열세 살부터는 공부·친구·취미를 직접 고릅니다.' });
    expect(parentWording('father')).toEqual({ subject: '아버지', ga: '아버지가', stamp: '아버지가 이렇게 정했습니다', chip: '아버지의 결정', hint: '어린 시절의 큰 결정은 아버지가 내립니다. 열세 살부터는 공부·친구·취미를 직접 고릅니다.' });
    expect(parentWording('none')).toEqual(parentWording('both'));
    expect(parentWording()).toEqual(parentWording('both'));
  });

  it('상수는 두 분 함께의 기본 문구로 남는다 (소개 Q&A가 인용한다)', () => {
    expect(PARENT_DECIDED_TEXT).toBe('부모님이 이렇게 정했습니다');
    expect(PARENT_DECIDED_TEXT).toBe(parentWording('both').stamp);
    expect(PARENT_CHIP_TEXT).toBe('부모님의 결정');
    expect(PARENT_CHIP_TEXT).toBe(parentWording('both').chip);
    expect(FIRST_PARENT_HINT).toBe(parentWording('both').hint);
    expect(CHILD_FLOW_TEXT).toBe('이렇게 흘러갔습니다');
    expect(CHILD_CHIP_TEXT).toBe('아이의 일');
  });

  it('세 주어의 길이가 같다 — 주어(세 글자)·조사까지 붙인 앞부분(네 글자)·도장·칩·안내 전체 글자 수가 같아 연출 필요량·판 길이가 그대로다 (완료 기준 20·22)', () => {
    const w = (['both', 'mother', 'father'] as const).map((c) => parentWording(c));
    for (const x of w) {
      expect(x.subject.length).toBe(3);
      expect(x.ga.length).toBe(4);
    }
    expect(new Set(w.map((x) => x.stamp.length)).size).toBe(1);
    expect(new Set(w.map((x) => x.chip.length)).size).toBe(1);
    expect(new Set(w.map((x) => x.hint.length)).size).toBe(1);
  });

  it('decidedByText: 부모는 주어에 따라, 흘러감은 주어가 없어 그대로다', () => {
    expect(decidedByText('parent')).toBe('부모님이 이렇게 정했습니다');
    expect(decidedByText('parent', 'both')).toBe('부모님이 이렇게 정했습니다');
    expect(decidedByText('parent', 'mother')).toBe('어머니가 이렇게 정했습니다');
    expect(decidedByText('parent', 'father')).toBe('아버지가 이렇게 정했습니다');
    expect(decidedByText('parent', 'none')).toBe('부모님이 이렇게 정했습니다');
    for (const co of ['both', 'mother', 'father', 'none'] as const) expect(decidedByText('child', co)).toBe(CHILD_FLOW_TEXT);
  });

  it('새 문구도 합쇼체·평가어·느낌표 없음 (기존 lint와 같은 기준)', () => {
    for (const co of ['mother', 'father'] as const) {
      const x = parentWording(co);
      expect(x.stamp).toMatch(/습니다$/);
      expect(x.hint).toMatch(/니다\.$/);
      for (const t of [x.stamp, x.chip, x.hint]) expect(t).not.toMatch(/[!?！？]|좋은|나쁜|잘못|탓|덕분|다행|안타깝|야 합니다|말아야|수저/);
    }
  });
});

describe('DS2 ⑦ 연출 필요량: 세 주어가 같은 길이라 readNeedMs가 같다 (resolveDelegated의 글자 수가 같은 문구 함수를 쓴다)', () => {
  /** 부모의 별세 계획을 심는다: 어머니(0)·아버지(1)가 주인공 `at`세에 떠나게(없으면 NO_DEATH_PLAN) */
  const planted = (base: GameState, motherAt: number | null, fatherAt: number | null): GameState => {
    const f = base.family as FamilyData;
    const report = base.birthReport!;
    const p = [
      { ...f.p[0], d: motherAt === null ? NO_DEATH_PLAN : report.mother.age + motherAt },
      { ...f.p[1], d: fatherAt === null ? NO_DEATH_PLAN : report.father.age + fatherAt },
    ] as FamilyData['p'];
    return { ...base, family: { ...f, p } };
  };

  it('같은 카드(첫 부모 카드, 안내 한 줄 포함) × 세 주어: 필요량·안내 유무가 같고 한 분 판은 한 분의 주어를 쓴다', () => {
    const base = forcedPending('infant-fever', 'present', { age: 6 });
    const need = (s: GameState) => {
      const before: GameState = { ...s, pending: { ...s.pending!, choiceIds: ['dismiss'] } };
      const r = resolveDelegated(before, 'parent');
      return { ms: r.tick.readNeedMs, first: r.tick.firstParent, line: r.state.history.filter((h) => h.eventId === 'infant-fever').pop()!, state: r.state };
    };
    const both = planted(base, null, null);
    const motherOnly = planted(base, null, 2); // 아버지가 2세에 떠났다 → 6세에는 어머니만
    const fatherOnly = planted(base, 2, null);
    expect(coParentsOf(both, 6)).toBe('both');
    expect(coParentsOf(motherOnly, 6)).toBe('mother');
    expect(coParentsOf(fatherOnly, 6)).toBe('father');
    const a = need(both);
    const b = need(motherOnly);
    const c = need(fatherOnly);
    expect(a.first).toBe(true);
    expect(b.first).toBe(true);
    expect(c.first).toBe(true);
    expect(b.ms).toBe(a.ms);
    expect(c.ms).toBe(a.ms);
    // 저장하는 줄은 같다 — 주어는 그릴 때 정한다 (저장 필드 불변)
    expect(Object.keys(b.line).sort()).toEqual(Object.keys(a.line).sort());
    expect(b.line.by).toBe('parent');
    expect(c.line.by).toBe('parent');
  });
});
