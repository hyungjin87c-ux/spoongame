import { describe, expect, it } from 'vitest';
import {
  CHILD_APART_MIN_AGE,
  DIVORCE_AGES,
  GENERATION_IDS,
  PARENT_GONE_MIN_AGE,
  childLeaveAgeOf,
  createEventPool,
  createRng,
  deriveFamilyFlags,
  divorcePlan,
  famSeedOf,
  familyCardOf,
  familyChangesFor,
  familyScheduleOf,
  familyViewOf,
  flagBlockersOf,
  flagSettersOf,
  generateBirthFromSeed,
  goneAtMyAge,
  parentBirthYear,
  rollParentLife,
  sceneFamilyOf,
  stageOfAge,
  stepYear,
  syncPostEventFlags,
  withGoneYearRule,
  type EventDef,
  type GameState,
  type ProfileId,
} from '../src/core';
import { EVENT_POOL } from '../src/data/events';
import { FAMILY_LINE_ID } from '../src/data/familyLineText';
import { startLife } from '../scripts/simulateLib';
import { spreadSeeds } from './helpers/familyGolden';
import { lifeSteps, seedsFor } from './helpers/familyLife';

/**
 * FM7a 코어 (SPEC-009 「FM7 나눔」 2절): R-618(별세·이혼 하한 1세) · R-561(같은 해 겹침 정리) · R-586(자녀 독립 나이 + `lives_with_child` + `senior-alone`).
 * 어린 형제의 이른 별세(Q3)는 tests/siblingLoss.test.ts, 문장·승인 게이트는 tests/familyText.test.ts, 모든 걸음의 모순 0은 tests/familyConsistency.test.ts가 같은 계획으로 본다.
 */

// ---------- R-618 ----------

/** 출생만으로 일정을 읽는 보기용 상태 (진행 없이) */
function bornGame(seed: number, gen: ProfileId): GameState {
  return startLife(seed, gen);
}

describe('R-618: 별세·이혼 하한 1세 (완료 기준 15)', () => {
  it('상수: DIVORCE_AGES = { min: 1, max: 18 } · PARENT_GONE_MIN_AGE = 1', () => {
    expect(DIVORCE_AGES).toEqual({ min: 1, max: 18 });
    expect(PARENT_GONE_MIN_AGE).toBe(1);
  });

  it('7세대 × 1000판: 부모 별세 계획의 최소 주인공 나이가 1이고(0세 해 없음) 이혼 계획의 최소 나이도 1이다 — 별세 나이 N(d)은 그대로 올려지지 않는다', () => {
    let lifted = 0;
    let divorces = 0;
    let minGone = Infinity;
    let minDivorce = Infinity;
    GENERATION_IDS.forEach((gen, gi) => {
      for (const seed of spreadSeeds(1000, gi)) {
        const b = generateBirthFromSeed(seed, gen);
        const game = { age: 0, flags: [], seen: {}, birthReport: b.report, character: b.character, peerSeed: b.peerSeed, seed: 1, assets: null, family: b.family } as unknown as GameState;
        const sc = familyScheduleOf(game);
        const famSeed = famSeedOf(b.peerSeed);
        const [dm, df] = rollParentLife(famSeed, b.character.birthYear, b.report.mother.age, b.report.father.age);
        // 별세 나이 N은 d 그대로다 (저장된 d = 출생 때 굴린 값)
        expect([b.family.p[0].d, b.family.p[1].d], `${gen}/${seed}: 부모 별세 나이 d`).toEqual([dm, df]);
        for (const i of [0, 1] as const) {
          const raw = goneAtMyAge(parentBirthYear(b.character.birthYear, i === 0 ? b.report.mother.age : b.report.father.age), b.family.p[i].d, b.character.birthYear);
          if (!Number.isFinite(sc.parentGoneAt[i])) continue;
          minGone = Math.min(minGone, sc.parentGoneAt[i]);
          expect(sc.parentGoneAt[i], `${gen}/${seed} 부모 ${i}`).toBeGreaterThanOrEqual(1);
          if (raw === 0) {
            lifted++;
            expect(sc.parentGoneAt[i], `${gen}/${seed}: 0세 해의 별세는 1세 해로 옮긴다`).toBe(1);
          } else expect(sc.parentGoneAt[i], `${gen}/${seed}: 0세가 아니면 그대로`).toBe(raw);
        }
        if (sc.firstGone !== null) expect(sc.firstGone.at, `${gen}/${seed}`).toBeGreaterThanOrEqual(1);
        if (sc.divorce !== null) {
          divorces++;
          minDivorce = Math.min(minDivorce, sc.divorce.at);
          expect(sc.divorce.at, `${gen}/${seed}`).toBeGreaterThanOrEqual(1);
        }
        // 이혼 계획은 별세 계획의 하한과 같은 규칙으로 정해진다 (null 포함)
        expect(sc.divorce, `${gen}/${seed}`).toEqual(divorcePlan(famSeed, b.character.birthYear, sc.firstGone));
      }
    });
    expect(lifted, '0세 해 별세가 1세 해로 옮겨진 부모 수(공허 통과 방지)').toBeGreaterThan(10);
    expect(divorces, '이혼 계획이 있는 판').toBeGreaterThan(100);
    expect(minGone, '부모 별세 계획의 최소 주인공 나이').toBe(1);
    expect(minDivorce, '이혼 계획의 최소 주인공 나이').toBe(1);
  });

  it('줄과 카드가 같은 값을 읽는다: 0세 해에 별세가 있던 판은 1세 해에 줄이 나고(0세 해에는 줄이 없다), 2세부터 카드가 「N세에 세상을 떠남」·「내가 1세였던 해」를 보인다', () => {
    let checked = 0;
    GENERATION_IDS.forEach((gen, gi) => {
      for (const seed of spreadSeeds(400, gi)) {
        const base = bornGame(seed, gen);
        const sc = familyScheduleOf(base);
        if (sc.firstGone === null || sc.firstGone.at !== 1) continue;
        const raw = goneAtMyAge(sc.parentBy[sc.firstGone.who], sc.family.p[sc.firstGone.who].d, sc.birthYear);
        if (raw !== 0) continue; // 옮겨진 판만(처음부터 1세인 판은 위 시험이 본다)
        checked++;
        const who = sc.firstGone.who === 0 ? 'mother' : 'father';
        const d = sc.family.p[sc.firstGone.who].d;
        const at = (age: number): GameState => ({ ...base, age });
        // 0세 해: 줄 없음. 1세 해: 줄 + 카드는 아직 함께 사는 사람
        expect(familyChangesFor(at(0), 0).lines.filter((l) => l.eventId === FAMILY_LINE_ID.parentGone), `${gen}/${seed}: 0세 해`).toHaveLength(0);
        const changes = familyChangesFor(at(1), 1);
        const line = changes.lines.find((l) => l.eventId === FAMILY_LINE_ID.parentGone);
        expect(line, `${gen}/${seed}: 1세 해의 줄`).toBeDefined();
        expect(line!.text, `${gen}/${seed}`).toContain(`${d}세에 세상을 떠나셨습니다.`);
        expect(familyViewOf(at(1)).people.find((p) => p.id === who)!.state, `${gen}/${seed}`).not.toBe('gone');
        const goneP = familyViewOf(at(2)).people.find((p) => p.id === who)!;
        expect(goneP.state, `${gen}/${seed}`).toBe('gone');
        expect(goneP.goneAtOwnAge, `${gen}/${seed}: 별세 나이 N은 d 그대로`).toBe(d);
        expect(goneP.goneAtMyAge, `${gen}/${seed}: 줄이 난 해 = 카드의 「내가 M세였던 해」`).toBe(1);
        const row = familyCardOf(at(2)).gone.find((r) => r.key === who);
        expect(row?.goneText, `${gen}/${seed}`).toBe(`${d}세에 세상을 떠남`);
        expect(row?.goneMyText, `${gen}/${seed}`).toBe('내가 1세였던 해');
      }
    });
    expect(checked, '확인한 판').toBeGreaterThan(5);
  });

  it('실제 판을 돌려도 0세 해에는 별세·이혼 줄이 없다 (7세대 × 60판 전수 걸음)', () => {
    let lives = 0;
    GENERATION_IDS.forEach((gen, gi) => {
      for (const seed of seedsFor(60, gi)) {
        const last = lifeSteps(seed, gen).slice(-1)[0].state;
        lives++;
        for (const h of last.history) if (h.age === 0) expect(h.eventId === FAMILY_LINE_ID.parentGone || h.eventId === FAMILY_LINE_ID.parentsApart, `${gen}/${seed}: 0세 해의 ${h.eventId}`).toBe(false);
      }
    });
    expect(lives).toBe(420);
  });

  it('골든 갱신 사유가 파일 주석에 있다 (tests/sceneGolden.test.ts의 FM7a 갱신 문단)', async () => {
    const spec = 'node:fs';
    const fs = (await import(/* @vite-ignore */ spec)) as { readFileSync(path: URL, encoding: 'utf-8'): string };
    const src = fs.readFileSync(new URL('./sceneGolden.test.ts', import.meta.url), 'utf-8');
    expect(src).toContain('FM7a 갱신(2026-11-06)');
    expect(src).toContain('R-618');
  });
});

// ---------- R-561 ----------

/** 부모 한 분 별세 줄이 나는 걸음(전, 후)들 — 주인공 20세 이상(자산·경제가 있는 어른)만 */
function goneLineSteps(count: number): Array<{ before: GameState; seed: number; gen: ProfileId }> {
  const out: Array<{ before: GameState; seed: number; gen: ProfileId }> = [];
  for (const [gi, gen] of GENERATION_IDS.entries()) {
    for (const seed of seedsFor(80, gi)) {
      for (const { before, state } of lifeSteps(seed, gen)) {
        const added = state.history.slice(before.history.length);
        if (before.age >= 20 && added.some((h) => h.eventId === FAMILY_LINE_ID.parentGone)) out.push({ before, seed, gen });
      }
      if (out.length >= count) return out;
    }
  }
  return out;
}

const synthetic = (id: string, stage: EventDef['stages'][number], sets: boolean): EventDef =>
  ({
    id,
    title: id.slice(0, 8),
    text: '시험용 사건입니다.',
    stages: [stage],
    track: 'common',
    weight: 1,
    once: true,
    // 선택지 이벤트는 보이는 선택지가 둘 이상이어야 후보다(isEventEligible)
    choices: [
      { id: 'a', label: '시험 가', result: '시험 결과 가입니다.', ...(sets ? { effects: { setFlags: ['parents_gone'] } } : {}) },
      { id: 'b', label: '시험 나', result: '시험 결과 나입니다.', ...(sets ? { effects: { setFlags: ['parents_gone'] } } : {}) },
    ],
  }) as unknown as EventDef;

describe('R-561: 한 분 별세 줄이 난 해에는 parents_gone을 켜는 사건을 그 해 후보에서 뺀다 (완료 기준 5)', () => {
  const steps = goneLineSteps(6);

  it('공허 통과 방지: 한 분 별세 줄이 나는 어른 걸음이 실제로 있고, 사건 id를 박지 않고 풀의 세터 색인으로 원본·변형 사건을 모두 찾는다', () => {
    expect(steps.length).toBeGreaterThanOrEqual(4);
    expect([...flagSettersOf(EVENT_POOL, 'parents_gone')].sort()).toEqual(['middle-parents-farewell', 'middle-parents-farewell-father-gone', 'middle-parents-farewell-mother-gone']);
  });

  it('후보 목록만 줄고 추첨 칸 수는 그대로다: 후보 둘(별세 사건 + 보통 사건)이면 어느 쪽을 뽑든 한 칸이라 뺀 세계와 안 뺀 세계의 진행 RNG가 같고, 뺀 세계는 별세 사건을 뽑지 않는다', () => {
    let picked = 0;
    let legacyPickedGone = 0;
    for (const { before } of steps) {
      const stage = stageOfAge(before.age);
      const pool = createEventPool([synthetic('x-gone', stage, true), synthetic('x-plain', stage, false)]);
      for (let k = 1; k <= 120; k++) {
        const s = { ...before, rngState: k };
        const legacy = withGoneYearRule('legacy', () => stepYear(s, pool));
        const exclude = stepYear(s, pool);
        if (legacy.state.pending === null) {
          // 이 난수에서는 선택지가 뽑히지 않았다 — 뺀 세계도 같다
          expect(exclude.state.pending, `k=${k}`).toBeNull();
          continue;
        }
        picked++;
        if (legacy.state.pending.eventId === 'x-gone') legacyPickedGone++;
        expect(exclude.state.pending?.eventId, `k=${k}: 뺀 세계는 별세 사건을 뽑지 않는다`).toBe('x-plain');
        expect(exclude.state.rngState, `k=${k}: 추첨 칸 수 불변`).toBe(legacy.state.rngState);
      }
    }
    expect(picked, '선택지가 뽑힌 시도').toBeGreaterThan(20);
    expect(legacyPickedGone, '안 뺀 세계가 별세 사건을 뽑은 시도(공허 통과 방지)').toBeGreaterThan(3);
  });

  it('후보가 별세 사건 하나뿐이어서 비는 해에도 칸 수를 쓴다: 뺀 세계는 그 사건을 못 뽑고(seen·parents_gone 없음) 난수는 「추첨 칸 + 해 끝 사망 판정」만큼 나아간다', () => {
    let blocked = 0;
    for (const { before } of steps) {
      const stage = stageOfAge(before.age);
      const pool = createEventPool([synthetic('x-gone', stage, true)]);
      for (let k = 1; k <= 120; k++) {
        const s = { ...before, rngState: k };
        const legacy = withGoneYearRule('legacy', () => stepYear(s, pool));
        if (legacy.state.pending === null) continue;
        const exclude = stepYear(s, pool);
        blocked++;
        expect(exclude.state.pending, `k=${k}`).toBeNull();
        expect(exclude.state.seen['x-gone'], `k=${k}`).toBeUndefined();
        expect(exclude.state.flags.includes('parents_gone'), `k=${k}`).toBe(false);
        if (exclude.state.phase !== 'life') continue; // 사망 판정이 한 칸을 더 쓴 해는 건너뛴다
        // 난수: rollChoice · rollNarrative · 비어 버린 후보 목록의 대신 한 칸 · 해 끝 사망 판정 = 4칸
        const r = createRng(k);
        for (let i = 0; i < 4; i++) r.next();
        expect(exclude.state.rngState, `k=${k}: 칸 수 불변`).toBe(r.getState());
      }
    }
    expect(blocked, '별세 사건이 후보에서 빠진 시도').toBeGreaterThan(5);
  });

  it('정본 INV-9 「먼저 떠난 분의 별세 해 < parents_gone이 켜진 해」: 안 뺀(legacy) 세계에서는 같은 해 겹침이 실제로 생기고, 뺀 세계에서는 0건이다 (같은 시드)', () => {
    const sameYear = (rule: 'legacy' | 'exclude'): number => {
      let n = 0;
      for (const [gi, gen] of GENERATION_IDS.slice(0, 5).entries()) {
        for (const seed of seedsFor(160, gi)) {
          const run = (): GameState => lifeSteps(seed, gen).slice(-1)[0].state;
          const last = rule === 'legacy' ? withGoneYearRule('legacy', run) : run();
          const gone = last.family!.l.find((e) => e[0] === 5);
          const farewell = last.history.find((h) => (h.eventId ?? '').startsWith('middle-parents-farewell'));
          if (gone !== undefined && farewell !== undefined && gone[1] === farewell.age) n++;
        }
      }
      return n;
    };
    const legacy = sameYear('legacy');
    const exclude = sameYear('exclude');
    expect(legacy, '안 뺀 세계의 같은 해 겹침(공허 통과 방지)').toBeGreaterThan(0);
    expect(exclude, '뺀 세계의 같은 해 겹침').toBe(0);
  });
});

// ---------- 별세 해 후보 정리 ② (후속 199) ----------

/** 별세 줄이 난 걸음(전)들 — 주인공 나이 범위로 거른다 */
function goneLineStepsAt(minAge: number, maxAge: number, count: number, gens: number): Array<{ before: GameState; seed: number; gen: ProfileId; flag: string }> {
  const out: Array<{ before: GameState; seed: number; gen: ProfileId; flag: string }> = [];
  for (const [gi, gen] of GENERATION_IDS.slice(0, gens).entries()) {
    for (const seed of seedsFor(300, gi)) {
      for (const { before, state } of lifeSteps(seed, gen)) {
        if (before.age < minAge || before.age > maxAge) continue;
        if (!state.history.slice(before.history.length).some((h) => h.eventId === FAMILY_LINE_ID.parentGone)) continue;
        const who = familyScheduleOf(before).firstGone!.who;
        out.push({ before, seed, gen, flag: who === 0 ? 'mother_gone' : 'father_gone' });
      }
      if (out.length >= count) return out;
    }
  }
  return out;
}

/** 조건을 붙인 시험용 사건 (선택지 둘, 별세 플래그를 notFlags 또는 flags로 읽는다) */
const withConditions = (ev: EventDef, conditions: NonNullable<EventDef['conditions']>): EventDef => ({ ...ev, conditions }) as EventDef;
/** 시험용 서술 사건 */
const narrativeEvent = (id: string, stage: EventDef['stages'][number], conditions?: NonNullable<EventDef['conditions']>): EventDef =>
  ({ id, title: id.slice(0, 8), text: '시험용 서술입니다.', stages: [stage], track: 'common', weight: 1, once: true, ...(conditions !== undefined ? { conditions } : {}) }) as unknown as EventDef;

describe('별세 해 후보 정리 ②: 별세 줄이 난 해에는 그 한 분의 플래그를 notFlags로 읽는 사건도 그 해 후보에서 뺀다 (후속 199, 완료 기준 3 「켜진 해부터」 = 그 해 포함)', () => {
  it('풀 색인으로 찾는다(사건 id를 박지 않는다): 사건 수준 notFlags가 mother_gone·father_gone을 읽는 사건은 병환·임종 원본과 「아빠/엄마」 어린 시절 사건 셋이고, 변형(flags로 읽음)은 아니다', () => {
    const want = ['infant-care', 'infant-neglect-night', 'middle-parents-care', 'middle-parents-farewell', 'school-early-work'];
    for (const flag of ['mother_gone', 'father_gone']) expect([...flagBlockersOf(EVENT_POOL, flag)].sort(), flag).toEqual(want);
    // 독립 계산: 풀을 직접 훑은 결과와 같다
    const direct = EVENT_POOL.events.filter((e) => (e.conditions?.notFlags ?? []).includes('mother_gone')).map((e) => e.id).sort();
    expect(direct).toEqual(want);
    expect(want.filter((id) => EVENT_POOL.byId.get(id)!.stages.some((st) => st === 'infant' || st === 'school')), '어린 시절 사건').toEqual(['infant-care', 'infant-neglect-night', 'school-early-work']);
    // 선택지 수준 requires.notFlags(school-teacher-notice)는 사건 후보가 아니라 선택지 노출이라 이 규칙의 대상이 아니다
    expect(want).not.toContain('school-teacher-notice');
  });

  it('후보 목록만 줄고 추첨 칸 수는 그대로다 — 어른 걸음: 후보 둘(읽는 사건 + 보통 사건)이면 뺀 세계(exclude)는 읽는 사건을 뽑지 않고 진행 RNG는 안 뺀 세계와 같다. R-561만 켠 세계(setters)는 읽는 사건을 그대로 뽑는다(규칙이 따로다)', () => {
    const steps = goneLineStepsAt(20, 100, 6, 7);
    expect(steps.length, '별세 줄이 나는 어른 걸음').toBeGreaterThanOrEqual(4);
    let picked = 0;
    let legacyReader = 0;
    let settersReader = 0;
    for (const { before, flag } of steps) {
      const stage = stageOfAge(before.age);
      const pool = createEventPool([withConditions(synthetic('x-reader', stage, false), { notFlags: [flag] }), synthetic('x-plain', stage, false)]);
      for (let k = 1; k <= 120; k++) {
        const s = { ...before, rngState: k };
        const legacy = withGoneYearRule('legacy', () => stepYear(s, pool));
        const setters = withGoneYearRule('setters', () => stepYear(s, pool));
        const exclude = stepYear(s, pool);
        if (legacy.state.pending === null) {
          expect(exclude.state.pending, `k=${k}`).toBeNull();
          continue;
        }
        picked++;
        if (legacy.state.pending.eventId === 'x-reader') legacyReader++;
        if (setters.state.pending?.eventId === 'x-reader') settersReader++;
        expect(setters.state.pending?.eventId, `k=${k}: R-561만 켜면 안 뺀 세계와 같은 사건`).toBe(legacy.state.pending.eventId);
        expect(exclude.state.pending?.eventId, `k=${k}: 뺀 세계는 읽는 사건을 뽑지 않는다`).toBe('x-plain');
        expect(exclude.state.rngState, `k=${k}: 추첨 칸 수 불변`).toBe(legacy.state.rngState);
      }
    }
    expect(picked, '선택지가 뽑힌 시도').toBeGreaterThan(20);
    expect(legacyReader, '안 뺀 세계가 읽는 사건을 뽑은 시도(공허 통과 방지)').toBeGreaterThan(3);
    expect(settersReader, 'R-561만 켠 세계가 읽는 사건을 뽑은 시도(②는 따로 켠다)').toBeGreaterThan(3);
  });

  it('한 방향만이다: 그 플래그를 요구하는 사건(flags로 읽음)은 별세 해에 새로 뽑히지 않는다(해 시작 상태 그대로 — 뺄 것도 더할 것도 없다), 다른 한 분의 플래그를 읽는 사건은 건드리지 않는다', () => {
    const steps = goneLineStepsAt(20, 100, 6, 7);
    for (const { before, flag } of steps) {
      const stage = stageOfAge(before.age);
      const other = flag === 'mother_gone' ? 'father_gone' : 'mother_gone';
      const pool = createEventPool([withConditions(synthetic('x-needs', stage, false), { flags: [flag] }), withConditions(synthetic('x-other', stage, false), { notFlags: [other] })]);
      for (let k = 1; k <= 60; k++) {
        const s = { ...before, rngState: k };
        for (const rule of ['legacy', 'setters', 'exclude'] as const) {
          const r = withGoneYearRule(rule, () => stepYear(s, pool));
          expect(r.state.pending?.eventId, `k=${k} ${rule}: 변형처럼 플래그를 요구하는 사건은 별세 해에 안 뽑힌다`).not.toBe('x-needs');
        }
        // 다른 한 분의 플래그를 notFlags로 읽는 사건은 그 해에도 후보다 — 세 규칙에서 같은 결과
        const a = withGoneYearRule('legacy', () => stepYear(s, pool));
        const b = stepYear(s, pool);
        expect(b.state.pending?.eventId, `k=${k}`).toBe(a.state.pending?.eventId);
        expect(b.state.rngState, `k=${k}`).toBe(a.state.rngState);
      }
    }
  });

  it('후보가 읽는 사건 하나뿐이어서 비는 해에도 칸 수를 쓴다(난수 4칸: 추첨 둘 · 대신 한 칸 · 해 끝 사망 판정) — 어른 걸음', () => {
    const steps = goneLineStepsAt(20, 100, 6, 7);
    let blocked = 0;
    for (const { before, flag } of steps) {
      const stage = stageOfAge(before.age);
      const pool = createEventPool([withConditions(synthetic('x-reader', stage, false), { notFlags: [flag] })]);
      for (let k = 1; k <= 120; k++) {
        const s = { ...before, rngState: k };
        const legacy = withGoneYearRule('legacy', () => stepYear(s, pool));
        if (legacy.state.pending === null) continue;
        const exclude = stepYear(s, pool);
        blocked++;
        expect(exclude.state.pending, `k=${k}`).toBeNull();
        expect(exclude.state.seen['x-reader'], `k=${k}`).toBeUndefined();
        if (exclude.state.phase !== 'life') continue;
        const r = createRng(k);
        for (let i = 0; i < 4; i++) r.next();
        expect(exclude.state.rngState, `k=${k}: 칸 수 불변`).toBe(r.getState());
      }
    }
    expect(blocked, '읽는 사건이 후보에서 빠진 시도').toBeGreaterThan(5);
  });

  it('어린 시절 사건 표본(infant-neglect-night의 조건 notFlags를 그대로 쓴 서술 사건): 별세 해(주인공 1~6세)에는 후보에서 빠지고, 안 뺀 세계는 실제로 뽑으며, 진행 RNG는 같다', () => {
    const real = EVENT_POOL.byId.get('infant-neglect-night')!;
    expect(real.stages, '표본은 영유아 사건').toContain('infant');
    const steps = goneLineStepsAt(1, 6, 8, 3);
    expect(steps.length, '주인공 1~6세에 한 분이 떠나는 걸음').toBeGreaterThanOrEqual(3);
    let legacyPicked = 0;
    for (const { before } of steps) {
      const stage = stageOfAge(before.age);
      const pool = createEventPool([narrativeEvent('x-neglect', stage, { notFlags: [...real.conditions!.notFlags!] }), narrativeEvent('x-plain-n', stage)]);
      for (let k = 1; k <= 120; k++) {
        const s = { ...before, rngState: k };
        const legacy = withGoneYearRule('legacy', () => stepYear(s, pool));
        const exclude = stepYear(s, pool);
        const added = (r: typeof legacy): string[] => r.state.history.slice(before.history.length).map((h) => h.eventId ?? '');
        if (added(legacy).includes('x-neglect')) legacyPicked++;
        expect(added(exclude), `k=${k}: 별세 해에는 그 사건이 후보가 아니다`).not.toContain('x-neglect');
        expect(exclude.state.rngState, `k=${k}: 추첨 칸 수 불변`).toBe(legacy.state.rngState);
      }
    }
    expect(legacyPicked, '안 뺀 세계가 그 사건을 뽑은 시도(공허 통과 방지)').toBeGreaterThan(3);
  });

  it('실제 판: 별세 줄과 같은 해에 병환 원본이 일어난 판 — 안 뺀(legacy) 세계에서는 실제로 생기고(완료 기준 3 같은 해 포함이 깨진다), 뺀 세계(지금)는 0건이다 (같은 시드)', () => {
    const sameYearCare = (rule: 'legacy' | 'exclude'): number => {
      let n = 0;
      for (const [gi, gen] of GENERATION_IDS.slice(0, 5).entries()) {
        for (const seed of seedsFor(160, gi)) {
          const run = (): GameState => lifeSteps(seed, gen).slice(-1)[0].state;
          const last = rule === 'legacy' ? withGoneYearRule('legacy', run) : run();
          const gone = last.family!.l.find((e) => e[0] === 5);
          const care = last.seen['middle-parents-care'];
          if (gone !== undefined && care !== undefined && gone[1] === care) n++;
        }
      }
      return n;
    };
    expect(sameYearCare('legacy'), '안 뺀 세계의 같은 해 병환 원본(공허 통과 방지)').toBeGreaterThan(0);
    expect(sameYearCare('exclude'), '뺀 세계(지금)의 같은 해 병환 원본').toBe(0);
  });
});

// ---------- R-586 ----------

describe('R-586: 자녀 독립 나이 · lives_with_child · senior-alone (완료 기준 6·7)', () => {
  const CHILD_EVENT = EVENT_POOL.events.find((e) => (e.choices ?? []).some((c) => (c.effects?.setFlags ?? []).includes('has_child')))!.id;
  const craft = (seed: number, gen: ProfileId, age: number, left: boolean): GameState => {
    const base = startLife(seed, gen);
    return { ...base, age, flags: [...new Set([...base.flags, 'married', 'has_child', ...(left ? ['child_left'] : [])])].sort(), seen: { ...base.seen, [CHILD_EVENT]: 30 } };
  };

  it('공식: 자녀 「따로 삶」 ⇔ ownAge ≥ 19 && (child_left || ownAge ≥ leaveAge) — 7세대 × 나이 0~100 전수에서 ① 19세 미만 자녀가 따로 사는 경우 0 ② child_left 없는 판에서 leaveAge(20~30) 이상이면 따로 삶 ③ 75세 이상에 함께 사는 자녀 0', () => {
    let kids = 0;
    let apartYoung = 0;
    GENERATION_IDS.forEach((gen, gi) => {
      for (const seed of spreadSeeds(40, gi)) {
        for (const left of [false, true]) {
          for (let age = 0; age <= 100; age++) {
            const g = craft(seed, gen, age, left);
            const view = familyViewOf(g);
            const famSeed = famSeedOf(g.peerSeed ?? g.seed);
            for (const p of view.people.filter((x) => x.role === 'child' && x.state !== 'gone')) {
              kids++;
              const j = Number(p.id.slice(1)) - 1;
              const leaveAge = childLeaveAgeOf(famSeed, j);
              expect(leaveAge, `${gen}/${seed} ${p.id}: 독립 나이는 20~30`).toBeGreaterThanOrEqual(20);
              expect(leaveAge).toBeLessThanOrEqual(30);
              if (p.age < CHILD_APART_MIN_AGE) {
                expect(p.state, `${gen}/${seed} ${age}세 ${p.age}세 자녀 ${p.id} (child_left ${left})`).toBe('with'); // ① 19세 미만은 child_left여도 함께 산다
                if (left) apartYoung++;
              } else if (left) expect(p.state, `${gen}/${seed} ${age}세 ${p.age}세 자녀 (child_left)`).toBe('apart');
              else expect(p.state, `${gen}/${seed} ${age}세 ${p.age}세 자녀 ${p.id} (leaveAge ${leaveAge})`).toBe(p.age >= leaveAge ? 'apart' : 'with'); // ②
              if (age >= 75) expect(p.state, `${gen}/${seed} ${age}세 자녀 ${p.id}`).toBe('apart'); // ③ 자녀는 늦어도 주인공 45세에 태어나 75세에는 30세 이상이다
            }
          }
        }
      }
    });
    expect(kids, '확인한 자녀 칸').toBeGreaterThan(10_000);
    expect(apartYoung, 'child_left인데 19세 미만이라 함께 사는 칸(공허 통과 방지)').toBeGreaterThan(100);
  });

  it('같은 판이 나이가 오르며 한 자녀씩 독립한다: 형제 독립과 같은 표(20~30)를 쓰되 자녀마다 해시가 달라 같은 나이에 모두 나가지 않을 수 있고, 그림·카드·함께 사는 사람이 같은 값을 읽는다 (FC10)', () => {
    let differ = 0;
    for (const seed of spreadSeeds(120, 3)) {
      const g = craft(seed, 'genx', 40, false);
      const famSeed = famSeedOf(g.peerSeed ?? g.seed);
      const ages = [0, 1, 2, 3].map((j) => childLeaveAgeOf(famSeed, j));
      if (new Set(ages).size > 1) differ++;
      for (let age = 18; age <= 80; age += 7) {
        const s = { ...g, age };
        const view = familyViewOf(s);
        const withKids = view.people.filter((p) => p.role === 'child' && p.state === 'with').length;
        const card = familyCardOf(s);
        const scene = sceneFamilyOf(s);
        expect(card.adult.filter((r) => r.role === 'child' && r.state === 'with').length, `${seed} ${age}세: 카드`).toBe(withKids);
        expect(scene.members.filter((m) => m.role === 'child').length, `${seed} ${age}세: 그림(식구가 8명을 넘으면 낮은 쪽부터 밀려난다)`).toBeLessThanOrEqual(withKids);
        expect(view.household.filter((id) => id.startsWith('c')).length, `${seed} ${age}세: 함께 사는 사람`).toBe(withKids);
      }
    }
    expect(differ, '자녀마다 독립 나이가 다른 판').toBeGreaterThan(50);
  });

  it('sceneOf 출력이 자녀 독립으로 바뀐다 (FH4): 자녀가 독립 나이를 넘는 나이에서 그림의 식구가 줄어 열쇠가 달라진다', () => {
    let changed = 0;
    for (const seed of spreadSeeds(60, 4)) {
      const g = craft(seed, 'millennial', 40, false);
      const famSeed = famSeedOf(g.peerSeed ?? g.seed);
      const leave = childLeaveAgeOf(famSeed, 0);
      const first = familyViewOf(g).people.find((p) => p.id === 'c1');
      if (first === undefined) continue;
      const heroAtLeave = leave + (first.birthYear - g.character!.birthYear); // 첫째가 독립 나이에 닿는 주인공 나이 = 첫째 출생 나이 + 독립 나이
      const members = (age: number): string => sceneFamilyOf({ ...g, age }).members.map((m) => m.id).join(',');
      if (members(heroAtLeave - 1) !== members(heroAtLeave)) changed++;
    }
    expect(changed, '그림이 바뀐 판').toBeGreaterThan(5);
  });

  it('lives_with_child: deriveFamilyFlags가 보기에서 내고 syncPostEventFlags가 해마다 맞춘다 — 함께 사는 자녀가 있을 때만 켜지고, 자녀가 독립(또는 child_left 이후 19세 이상)하면 꺼진다', () => {
    let on = 0;
    let off = 0;
    for (const seed of spreadSeeds(60, 5)) {
      for (const age of [20, 30, 36, 45, 58, 66, 80]) {
        const g = craft(seed, 'millennial', age, false);
        const withKid = familyViewOf(g).people.some((p) => p.role === 'child' && p.state === 'with');
        expect(deriveFamilyFlags(familyViewOf(g), g.family!.l).has('lives_with_child'), `${seed} ${age}세`).toBe(withKid);
        const synced = syncPostEventFlags(g);
        expect(synced.flags.includes('lives_with_child'), `${seed} ${age}세`).toBe(withKid);
        if (withKid) on++;
        else off++;
        // 이미 맞는 상태는 같은 객체다 (불필요한 복사 없음)
        expect(syncPostEventFlags(synced)).toBe(synced);
      }
    }
    expect(on).toBeGreaterThan(20);
    expect(off).toBeGreaterThan(20);
  });

  it('구형 저장(lives_with_child 없음)을 열면 첫 해 끝에 맞게 채워지고 이미 본 줄·값은 바뀌지 않는다', () => {
    let checked = 0;
    for (const seed of spreadSeeds(200, 5)) {
      const steps = lifeSteps(seed, 'millennial');
      const mid = steps.find((s) => s.state.age === 40 && s.state.flags.includes('lives_with_child'));
      if (mid === undefined) continue;
      checked++;
      const old: GameState = { ...mid.state, flags: mid.state.flags.filter((f) => f !== 'lives_with_child') };
      let s = old;
      let guard = 0;
      do {
        const r = stepYear(s);
        s = r.state;
        guard++;
      } while (s.pending !== null && guard < 3);
      if (s.pending !== null) continue;
      // 구형 상태에서 한 해를 걸은 뒤: 플래그가 그 해 끝의 보기에 맞게 돌아와 있다
      const want = deriveFamilyFlags(familyViewOf(s), s.family!.l).has('lives_with_child');
      expect(s.flags.includes('lives_with_child'), `${seed}`).toBe(want);
      // 이미 본 줄은 그대로다 (새 줄은 뒤에만 붙는다)
      expect(s.history.slice(0, old.history.length), `${seed}`).toEqual(old.history);
      expect(s.family!.l.slice(0, old.family!.l.length), `${seed}`).toEqual(old.family!.l);
      if (checked >= 12) break;
    }
    expect(checked, '확인한 판').toBeGreaterThan(3);
  });

  it('senior-alone: notFlags에 lives_with_child가 있어 함께 사는 자녀가 있는 판에서는 후보가 아니다 — 실제로 일어난 판의 그 해 시작 상태에는 함께 사는 자녀가 없다 (완료 기준 6 ④)', () => {
    const ev = EVENT_POOL.byId.get('senior-alone')!;
    expect(ev.conditions?.notFlags).toContain('lives_with_child');
    let seen = 0;
    GENERATION_IDS.forEach((gen, gi) => {
      for (const seed of seedsFor(60, gi)) {
        for (const { before, state } of lifeSteps(seed, gen)) {
          if (!state.history.slice(before.history.length).some((h) => h.eventId === 'senior-alone')) continue;
          seen++;
          expect(familyViewOf(before).people.some((p) => p.role === 'child' && p.state === 'with'), `${gen}/${seed} ${before.age}세`).toBe(false);
        }
      }
    });
    expect(seen, 'senior-alone이 일어난 판').toBeGreaterThan(10);
  });
});

