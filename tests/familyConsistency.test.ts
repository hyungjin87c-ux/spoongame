import { describe, expect, it } from 'vitest';
import {
  FAMILY_SYSTEM_FLAGS,
  GENERATION_IDS,
  STATE_WORD_RULES,
  YOUNGER_SIBLING_EVENT,
  deriveFamilyFlags,
  familyViewOf,
  heavyKindOfEntry,
  isValidFamily,
  sceneFamilyOf,
  siblingCountOf,
  type GameState,
  type PersonId,
  type ProfileId,
} from '../src/core';
import { EVENT_POOL } from '../src/data/events';
import { FAMILY_LINE_HEAVY } from '../src/data/familyLineText';
import { lifeSteps, seedsFor } from './helpers/familyLife';

/**
 * 가족 모순 0 — `playToEnd` 전수 (SPEC-009 FM4b, `docs/data/family-model.md` 12-2절 INV-1~12): 7세대 × 판을 끝까지 돌리며 **해가 끝날 때마다** 가족 보기·그림 상태·시스템 플래그·`family.log`·인생 기록을 맞춰 본다.
 * 위반 0이 합격이고, 시험이 공허하지 않도록 변화가 실제로 일어난 판 수를 센다(동생 출생·독립·조부모 별세·부모 별세·이혼·강제 사건).
 * INV-1(출산 나이)·INV-2(떠난 사람)·INV-10~12의 출생·보기 쪽은 tests/familyBirth.test.ts·tests/sceneFamily.test.ts가 0~100세 전수로 따로 본다 — 여기서는 **인생이 진행되며 쓰는 쪽**(줄·플래그·로그)이 보기와 같은지를 본다.
 */

const PER_GEN = 90;
/** 이 모듈이 켜고 끄는 플래그 (familyTick.ts#MANAGED_FLAGS와 같은 목록 — 시스템 플래그 중 보기에서 파생되는 것) */
const MANAGED = ['has_grandparent', 'lives_with_grandparent', 'has_older_sibling', 'has_younger_sibling', 'has_sibling', 'mother_gone', 'father_gone', 'mother_apart', 'father_apart'];
/** 로그 종류 → 줄을 남기는가 */
const LINE_KINDS = new Set([2, 4, 5, 6]);

const FAMILY_RULES = STATE_WORD_RULES.filter((r) => r.stages.includes('infant') && r.name !== '자식·손주' && r.name !== '일터');

interface Tally {
  lives: number;
  born: number;
  cards: number;
  left: number;
  gp: number;
  parentGone: number;
  apart: number;
  checks: number;
}

describe('INV 전수: 7세대 × 판 × 해마다 (playToEnd)', () => {
  const tally: Tally = { lives: 0, born: 0, cards: 0, left: 0, gp: 0, parentGone: 0, apart: 0, checks: 0 };
  const problems: string[] = [];
  const bad = (where: string, msg: string): void => {
    if (problems.length < 40) problems.push(`${where}: ${msg}`);
  };

  for (const [gi, gen] of GENERATION_IDS.entries()) {
    it(`${gen}: ${PER_GEN}판`, { timeout: 120_000 }, () => {
      for (const seed of seedsFor(PER_GEN, gi)) {
        const steps = lifeSteps(seed, gen as ProfileId);
        tally.lives++;
        const where = `${gen}/${seed}`;
        const goneEver = new Set<PersonId>();
        let prevLogLen = 0;
        for (const { state, before } of steps) {
          tally.checks++;
          const f = state.family!;
          const age = state.age;
          // INV-12: 같은 상태 → 같은 보기·그림 상태
          const view = familyViewOf(state);
          if (JSON.stringify(familyViewOf(state)) !== JSON.stringify(view)) bad(where, `${age}세 보기가 같은 상태에서 다르다`);
          // INV-2(단조): 한 번 떠난 사람은 돌아오지 않는다
          for (const p of view.people) {
            if (p.state === 'gone') goneEver.add(p.id);
            else if (goneEver.has(p.id)) bad(where, `${age}세 ${p.id}가 떠난 뒤 돌아왔다`);
          }
          if (state.phase !== 'life') continue;
          // INV-7: 시스템 소유 플래그 = 파생 집합 (보기 + 로그). 해가 끝난 상태(age)의 보기와 같다
          const derived = deriveFamilyFlags(view, f.l);
          const have = new Set(state.flags.filter((x) => MANAGED.includes(x)));
          for (const x of MANAGED) {
            if (derived.has(x) !== have.has(x)) bad(where, `${age}세 플래그 ${x}: 파생 ${derived.has(x)} 실제 ${have.has(x)}`);
          }
          // 시스템이 쓰지 않는 시스템 플래그(값이 아직 없는 것)가 켜져 있지 않다
          for (const x of FAMILY_SYSTEM_FLAGS) if (!MANAGED.includes(x) && state.flags.includes(x)) bad(where, `${age}세 값이 없는 시스템 플래그 ${x}가 켜졌다`);
          // INV-9: 한 분 별세 플래그는 동시에 켜지지 않고, 켜진 해가 parents_gone이 켜진 해보다 늦지 않다
          if (state.flags.includes('mother_gone') && state.flags.includes('father_gone')) bad(where, `${age}세 mother_gone·father_gone 동시`);
          if (state.flags.includes('parents_gone')) {
            const logged = f.l.find((e) => e[0] === 5);
            const farewell = state.history.find((h) => h.eventId === 'middle-parents-farewell');
            if (logged !== undefined && farewell !== undefined && logged[1] > farewell.age) bad(where, `한 분 별세(${logged[1]}세)가 parents_gone(${farewell.age}세)보다 늦다`);
          }
          // INV-8: (종류, 대상) 중복 0, 인생 기록 fam- 줄 수 = 줄을 쓴 로그 수, 로그는 추가만
          const keys = f.l.map((e) => `${e[0]}:${e[2]}`);
          if (new Set(keys).size !== keys.length) bad(where, `${age}세 로그 중복`);
          const lineLogs = f.l.filter((e) => LINE_KINDS.has(e[0]) || (e[0] === 1 && e[3] === 0)).length;
          const famLines = state.history.filter((h) => (h.eventId ?? '').startsWith('fam-')).length;
          if (famLines !== lineLogs) bad(where, `${age}세 fam- 줄 ${famLines} ≠ 줄을 쓴 로그 ${lineLogs}`);
          if (f.l.length < prevLogLen) bad(where, `${age}세 로그가 줄었다`);
          prevLogLen = f.l.length;
          // 저장 검증을 통과한다
          if (!isValidFamily(f, state)) bad(where, `${age}세 family가 저장 검증을 통과하지 못한다`);
          // INV-11: 그림은 7명·반려동물 2마리 이하
          const scene = sceneFamilyOf(state);
          if (scene.members.length > 7 || scene.pets.length > 2) bad(where, `${age}세 그림 식구 ${scene.members.length}`);
          // INV-10: 보기의 형제 수 = 새 정의의 상속 형제 수
          if (siblingCountOf(state, 'view') !== view.siblingCount.living) bad(where, `${age}세 형제 수 불일치`);
          // 이 걸음에서 새로 생긴 줄만 센다
          const added = state.history.slice(before.history.length);
          for (const h of added) {
            if (h.eventId === 'fam-sib-born') tally.born++;
            else if (h.eventId === 'fam-sib-left') tally.left++;
            else if (h.eventId === 'fam-gp-gone') tally.gp++;
            else if (h.eventId === 'fam-parent-gone') tally.parentGone++;
            else if (h.eventId === 'fam-parents-apart') tally.apart++;
            else if (h.eventId === YOUNGER_SIBLING_EVENT) tally.cards++;
          }
        }
        // 한 판 전체: 동생이 태어나는 해마다 인생 기록 줄이 정확히 하나(상태 줄 또는 반응 카드, 둘째 이후 동생은 상태 줄)
        const last = steps[steps.length - 1].state;
        const f = last.family!;
        f.y.forEach((s, j) => {
          const lived = s.k <= last.age;
          const lines = last.history.filter((h) => h.age === s.k && (h.eventId === 'fam-sib-born' || h.eventId === YOUNGER_SIBLING_EVENT)).length;
          const bornLog = f.l.filter((e) => e[0] === 1 && e[2] === 21 + j).length;
          if (lived && j === 0 && last.birthReport!.birthOrder === 1) {
            if (lines !== 1) bad(where, `첫째의 첫 동생(${s.k}세): 줄 ${lines}개`);
          } else if (lived && lines < 1) bad(where, `동생 ${j + 1}(${s.k}세): 줄이 없다`);
          if (lived && bornLog !== 1) bad(where, `동생 ${j + 1}(${s.k}세): 로그 ${bornLog}개`);
          if (!lived && (bornLog !== 0 || lines !== 0)) bad(where, `동생 ${j + 1}: 태어나기 전에 죽었는데 줄·로그가 있다`);
        });
        // INV-4(동적): 어린 시절 사건의 가족 낱말이 그 시점에 실제로 있는 사람과 맞는다
        for (const h of last.history) {
          if (h.eventId === undefined || h.eventId.startsWith('fam-') || h.age > 18) continue;
          const ev = EVENT_POOL.byId.get(h.eventId);
          if (ev === undefined) continue;
          const text = `${h.title ?? ''} ${h.text} ${h.choice ?? ''}`;
          // 그 해를 시작할 때의 상태로 본다(`parents_gone`은 지금 플래그를 읽는 입력이라 마지막 상태로 지난 나이를 보면 소급된다)
          const view = familyViewOf(steps.find((st) => st.before.age === h.age)?.before ?? last, h.age);
          const alive = (ids: readonly PersonId[]): boolean => view.people.some((p) => ids.includes(p.id) && p.state !== 'gone');
          for (const rule of FAMILY_RULES) {
            if (rule.exceptions.includes(h.eventId) || !rule.words.test(text)) continue;
            const grand = rule.name.startsWith('조부모');
            const younger = rule.name.startsWith('동생');
            const older = rule.name.startsWith('형·누나') ;
            const sib = rule.name.startsWith('형제');
            const father = rule.name.startsWith('아버지');
            const mother = rule.name.startsWith('어머니');
            const both = rule.name.startsWith('부모님');
            if (grand && !alive(['pgf', 'pgm', 'mgf', 'mgm'])) bad(where, `${h.age}세 ${h.eventId}: 조부모 낱말인데 계신 분이 없다`);
            if (younger && view.siblingCount.younger === 0) bad(where, `${h.age}세 ${h.eventId}: 동생 낱말인데 동생이 없다`);
            if (older && view.siblingCount.older === 0) bad(where, `${h.age}세 ${h.eventId}: 형·누나 낱말인데 손위 형제가 없다`);
            if (sib && view.siblingCount.living === 0) bad(where, `${h.age}세 ${h.eventId}: 형제 낱말인데 형제가 없다`);
            if (father && !alive(['father'])) bad(where, `${h.age}세 ${h.eventId}: 아버지 낱말인데 떠나셨다`);
            if (mother && !alive(['mother'])) bad(where, `${h.age}세 ${h.eventId}: 어머니 낱말인데 떠나셨다`);
            if (both && !(alive(['father']) && alive(['mother']))) bad(where, `${h.age}세 ${h.eventId}: 부모님 낱말인데 한 분이 떠나셨다`);
          }
        }
      }
    });
  }

  it('위반 0건, 시험이 공허하지 않다: 변화가 일어난 판이 충분하다', () => {
    expect(problems).toEqual([]);
    expect(tally.lives).toBe(GENERATION_IDS.length * PER_GEN);
    expect(tally.checks, '해마다 점검 횟수').toBeGreaterThan(20_000);
    expect(tally.born, '동생 출생 줄').toBeGreaterThan(100);
    expect(tally.cards, '강제 사건(동생 반응 카드)').toBeGreaterThan(100);
    expect(tally.left, '형제 독립 줄').toBeGreaterThan(100);
    expect(tally.gp, '조부모 별세 줄').toBeGreaterThan(100);
    expect(tally.parentGone, '부모 한 분 별세 줄').toBeGreaterThan(30);
    expect(tally.apart, '이혼·별거 줄').toBeGreaterThan(10);
  });

  it('가림 분류(4-9절): 별세·이혼 줄은 loss·home으로 잡히고 동생 출생·독립 줄은 가리지 않는다', () => {
    const steps = lifeSteps(seedsFor(1, 0)[0], 'industrial');
    const final = steps[steps.length - 1].state;
    for (const h of final.history) {
      if (!(h.eventId ?? '').startsWith('fam-')) continue;
      const want = FAMILY_LINE_HEAVY[h.eventId!] ?? null;
      expect(heavyKindOfEntry(h), h.eventId).toBe(want);
    }
    expect(FAMILY_LINE_HEAVY['fam-parent-gone']).toBe('loss');
    expect(FAMILY_LINE_HEAVY['fam-gp-gone']).toBe('loss');
    expect(FAMILY_LINE_HEAVY['fam-parents-apart']).toBe('home');
    expect(FAMILY_LINE_HEAVY['fam-sib-born']).toBeUndefined();
    expect(FAMILY_LINE_HEAVY['fam-sib-left']).toBeUndefined();
  });
});

export type { GameState };
