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
  flagRequirersOf,
  flagSettersOf,
  GRANDPARENT_LINE_FLAGS,
  SIBLING_LINE_FLAGS,
  generateBirthFromSeed,
  goneAtMyAge,
  lineClearedFlags,
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
import { EVENT_FREQUENCY } from '../src/data/lifeTable';
import { FAMILY_LINE_ID } from '../src/data/familyLineText';
import { CLEARED_READER_IDS, GONE_READER_IDS } from '../scripts/familyRemeasureLib';
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

  it('7세대 × 1000판: 부모 별세 계획의 최소 주인공 나이가 1이고(0세 해 없음) 이혼 계획의 최소 나이도 1이다 — 저장된 d는 그대로고 별세 나이 N은 옮겨진 별세만 d + 1이다 (R-634 (a))', () => {
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
        // 저장된 d는 출생 때 굴린 값 그대로다 (별세 나이 N은 아래 `parentGoneOwn` — 옮겨진 별세만 d + 1)
        expect([b.family.p[0].d, b.family.p[1].d], `${gen}/${seed}: 부모 별세 나이 d`).toEqual([dm, df]);
        for (const i of [0, 1] as const) {
          const raw = goneAtMyAge(parentBirthYear(b.character.birthYear, i === 0 ? b.report.mother.age : b.report.father.age), b.family.p[i].d, b.character.birthYear);
          if (!Number.isFinite(sc.parentGoneAt[i])) continue;
          minGone = Math.min(minGone, sc.parentGoneAt[i]);
          expect(sc.parentGoneAt[i], `${gen}/${seed} 부모 ${i}`).toBeGreaterThanOrEqual(1);
          const d = b.family.p[i].d;
          if (raw === 0) {
            lifted++;
            expect(sc.parentGoneAt[i], `${gen}/${seed}: 0세 해의 별세는 1세 해로 옮긴다`).toBe(1);
            expect(sc.parentGoneOwn[i], `${gen}/${seed}: 옮겨진 별세는 별세 나이 N = d + (at − raw) = d + 1`).toBe(d + 1);
          } else {
            expect(sc.parentGoneAt[i], `${gen}/${seed}: 0세가 아니면 그대로`).toBe(raw);
            expect(sc.parentGoneOwn[i], `${gen}/${seed}: 옮겨지지 않은 별세는 N = d 그대로`).toBe(d);
          }
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

  it('줄과 카드가 같은 값을 읽는다: 0세 해에 별세가 있던 판은 1세 해에 줄이 나고(0세 해에는 줄이 없다), 2세부터 카드가 「N세에 세상을 떠남」·「내가 1세였던 해」를 보인다 — 옮겨진 별세의 N은 d + 1이다 (R-634 (a))', () => {
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
        const own = d + 1; // 옮겨진 별세: 그 분은 주인공 1세 해의 카드에 d + 1세로 살아 있다가 그 해 줄에서 떠난다 (R-634 (a))
        const at = (age: number): GameState => ({ ...base, age });
        // 0세 해: 줄 없음. 1세 해: 줄 + 카드는 아직 함께 사는 사람
        expect(familyChangesFor(at(0), 0).lines.filter((l) => l.eventId === FAMILY_LINE_ID.parentGone), `${gen}/${seed}: 0세 해`).toHaveLength(0);
        const changes = familyChangesFor(at(1), 1);
        const line = changes.lines.find((l) => l.eventId === FAMILY_LINE_ID.parentGone);
        expect(line, `${gen}/${seed}: 1세 해의 줄`).toBeDefined();
        expect(line!.text, `${gen}/${seed}`).toContain(`${own}세에 세상을 떠나셨습니다.`);
        expect(familyViewOf(at(1)).people.find((p) => p.id === who)!.age, `${gen}/${seed}: 1세 해 카드의 나이 = 줄의 N`).toBe(own);
        expect(familyViewOf(at(1)).people.find((p) => p.id === who)!.state, `${gen}/${seed}`).not.toBe('gone');
        const goneP = familyViewOf(at(2)).people.find((p) => p.id === who)!;
        expect(goneP.state, `${gen}/${seed}`).toBe('gone');
        expect(goneP.goneAtOwnAge, `${gen}/${seed}: 옮겨진 별세의 N = d + 1`).toBe(own);
        expect(goneP.goneAtMyAge, `${gen}/${seed}: 줄이 난 해 = 카드의 「내가 M세였던 해」`).toBe(1);
        const row = familyCardOf(at(2)).gone.find((r) => r.key === who);
        expect(row?.goneText, `${gen}/${seed}`).toBe(`${own}세에 세상을 떠남`);
        expect(row?.goneMyText, `${gen}/${seed}`).toBe('내가 1세였던 해');
      }
    });
    expect(checked, '확인한 판').toBeGreaterThan(5);
  });

  it('옮겨지지 않은 판은 별세 나이 N이 d 그대로다: 줄·카드·보기가 같은 값이고 d는 건드리지 않는다 (R-634 (a) — 해시 L1이 같은 판을 잠근다)', () => {
    let checked = 0;
    GENERATION_IDS.forEach((gen, gi) => {
      for (const seed of spreadSeeds(120, gi)) {
        const base = bornGame(seed, gen);
        const sc = familyScheduleOf(base);
        if (sc.firstGone === null || sc.firstGone.at < 2) continue;
        const who = sc.firstGone.who === 0 ? 'mother' : 'father';
        const d = sc.family.p[sc.firstGone.who].d;
        const raw = goneAtMyAge(sc.parentBy[sc.firstGone.who], d, sc.birthYear);
        expect(raw, `${gen}/${seed}: 옮겨지지 않은 판`).toBe(sc.firstGone.at);
        checked++;
        const at = (age: number): GameState => ({ ...base, age });
        const line = familyChangesFor(at(sc.firstGone.at), sc.firstGone.at).lines.find((l) => l.eventId === FAMILY_LINE_ID.parentGone);
        expect(line?.text, `${gen}/${seed}`).toContain(`${d}세에 세상을 떠나셨습니다.`);
        const goneP = familyViewOf(at(sc.firstGone.at + 1)).people.find((p) => p.id === who)!;
        expect(goneP.goneAtOwnAge, `${gen}/${seed}`).toBe(d);
        expect(familyCardOf(at(sc.firstGone.at + 1)).gone.find((r) => r.key === who)?.goneText, `${gen}/${seed}`).toBe(`${d}세에 세상을 떠남`);
      }
    });
    expect(checked, '확인한 판').toBeGreaterThan(300);
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
    // 재측정 도구가 따로 세는 사건 목록(scripts/familyRemeasureLib.ts#GONE_READER_IDS)이 풀과 같다
    expect([...GONE_READER_IDS].sort(), '재측정 도구의 사건 목록').toEqual(want);
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

// ---------- R-631 · R-632 · R-633 (REV-009-FM7a-1, 마스터 확장 2026-11-06) ----------

/** 가족 줄 뒤(같은 해) 꺼지는 형제·조부모 플래그가 있는 걸음(전) — 줄 계산(`familyChangesFor`)이 낸 값으로 고른다. `line`은 어느 쪽 플래그를 보는가 */
function clearedSteps(line: 'sib' | 'gp', gens: number, perGen: number, count: number): Array<{ before: GameState; cleared: string[]; seed: number; gen: ProfileId }> {
  const names = line === 'sib' ? SIBLING_LINE_FLAGS : GRANDPARENT_LINE_FLAGS;
  const out: Array<{ before: GameState; cleared: string[]; seed: number; gen: ProfileId }> = [];
  for (const [gi, gen] of GENERATION_IDS.slice(0, gens).entries()) {
    for (const seed of seedsFor(perGen, gi)) {
      for (const { before } of lifeSteps(seed, gen)) {
        const cleared = lineClearedFlags(familyChangesFor(before, before.age, EVENT_POOL)).filter((x) => names.includes(x));
        if (cleared.length > 0) out.push({ before, cleared, seed, gen });
      }
      if (out.length >= count) return out;
    }
  }
  return out;
}

/** 선택지 셋짜리 K18 꼴 사건 — 가운데 선택지만 조건(`requires`)이 있다 (school-teacher-notice 꼴) */
const noticeEvent = (id: string, stage: EventDef['stages'][number], requires: NonNullable<EventDef['choices']>[number]['requires']): EventDef =>
  ({
    id,
    title: id.slice(0, 8),
    text: '시험용 사건입니다.',
    stages: [stage],
    track: 'common',
    weight: 1,
    once: true,
    choices: [
      { id: 'accept', label: '시험 받아들인다', result: '시험 결과 가입니다.' },
      { id: 'ask', label: '시험 의논한다', result: '시험 결과 나입니다.', requires },
      { id: 'decline', label: '시험 거절한다', result: '시험 결과 다입니다.' },
    ],
  }) as unknown as EventDef;

describe('R-631: 어린 형제·마지막 조부모가 떠난 해에는 줄 뒤 꺼지는 플래그를 요구하는 사건을 그 해 후보에서 뺀다 (형제 · 조부모, 후보 목록만 줄고 칸 수 그대로)', () => {
  it('이름을 적은 배열이 실제로 꺼지는 플래그와 맞다: 형제 줄(fam-sib-lost)·조부모 줄(fam-gp-gone)이 난 해에 clearFlags에 든 플래그는 그 두 배열 안에 있다 (fam.clearFlags 전체를 쓰지 않는다)', () => {
    expect([...SIBLING_LINE_FLAGS]).toEqual(['has_older_sibling', 'has_younger_sibling', 'has_sibling']);
    expect([...GRANDPARENT_LINE_FLAGS]).toEqual(['has_grandparent', 'lives_with_grandparent']);
    const named = new Set<string>([...SIBLING_LINE_FLAGS, ...GRANDPARENT_LINE_FLAGS]);
    const seen = new Set<string>();
    let lineYears = 0;
    for (const [gi, gen] of GENERATION_IDS.slice(0, 4).entries()) {
      for (const seed of seedsFor(40, gi)) {
        for (const { before } of lifeSteps(seed, gen)) {
          const c = familyChangesFor(before, before.age, EVENT_POOL);
          if (!c.lines.some((l) => l.eventId === FAMILY_LINE_ID.sibLost || l.eventId === FAMILY_LINE_ID.grandGone)) continue;
          lineYears++;
          for (const x of c.clearFlags) {
            seen.add(x);
            expect(named.has(x), `${gen}/${seed} ${before.age}세: 줄이 난 해에 꺼진 ${x}가 이름 배열에 없다`).toBe(true);
          }
          // 이름 배열 ∩ 이 해의 clearFlags가 곧 「줄 뒤 꺼지는 플래그」다(그 줄이 난 해일 때만)
          const expectSib = c.lines.some((l) => l.eventId === FAMILY_LINE_ID.sibLost) ? SIBLING_LINE_FLAGS.filter((x) => c.clearFlags.includes(x)) : [];
          const expectGp = c.lines.some((l) => l.eventId === FAMILY_LINE_ID.grandGone) ? GRANDPARENT_LINE_FLAGS.filter((x) => c.clearFlags.includes(x)) : [];
          expect(lineClearedFlags(c).sort(), `${gen}/${seed} ${before.age}세`).toEqual([...expectSib, ...expectGp].sort());
        }
      }
    }
    expect(lineYears, '형제·조부모 줄이 난 해(공허 통과 방지)').toBeGreaterThan(50);
    expect(seen.has('has_grandparent'), '마지막 조부모가 떠나 has_grandparent가 꺼진 해').toBe(true);
  });

  it('풀 색인으로 찾는다(사건 id를 박지 않는다): 형제·조부모 플래그를 사건 수준 flags로 요구하는 사건은 영유아 형제 사건 셋과 조부모 노래이고, 이름 배열에 든 플래그마다 합성 풀에서도 같다', () => {
    expect([...flagRequirersOf(EVENT_POOL, 'has_younger_sibling')], 'has_younger_sibling').toContain('infant-sibling-toy');
    expect([...flagRequirersOf(EVENT_POOL, 'has_older_sibling')], 'has_older_sibling').toContain('infant-follow-sibling');
    expect([...flagRequirersOf(EVENT_POOL, 'has_sibling')], 'has_sibling').toContain('school-family-priority');
    expect([...flagRequirersOf(EVENT_POOL, 'has_grandparent')], 'has_grandparent').toContain('infant-grandparent-song');
    // 독립 계산: 풀을 직접 훑은 결과와 같다
    for (const flag of [...SIBLING_LINE_FLAGS, ...GRANDPARENT_LINE_FLAGS]) {
      const direct = EVENT_POOL.events.filter((e) => (e.conditions?.flags ?? []).includes(flag)).map((e) => e.id).sort();
      expect([...flagRequirersOf(EVENT_POOL, flag)].sort(), flag).toEqual(direct);
    }
    // 재측정 도구가 따로 세는 사건 목록(scripts/familyRemeasureLib.ts#CLEARED_READER_IDS)이 풀과 같다
    const named = new Set<string>([...SIBLING_LINE_FLAGS, ...GRANDPARENT_LINE_FLAGS]);
    expect([...CLEARED_READER_IDS].sort(), '재측정 도구의 사건 목록').toEqual(EVENT_POOL.events.filter((e) => (e.conditions?.flags ?? []).some((f) => named.has(f))).map((e) => e.id).sort());
  });

  it('형제: 하나뿐이던 형제가 떠난 해 — 꺼진 형제 플래그를 요구하는 사건을 exclude는 뽑지 않고 legacy는 뽑으며, 후보 목록만 줄어 진행 RNG(추첨 칸 수)는 같다. 별세 해 notFlags 규칙까지만 켠 세계(notflags)는 legacy와 같다(③이 따로 켜진다)', () => {
    const steps = clearedSteps('sib', 3, 400, 16);
    expect(steps.length, '형제 플래그가 줄 뒤 꺼지는 걸음').toBeGreaterThanOrEqual(8);
    const flagsSeen = new Set<string>();
    let picked = 0;
    let legacyReader = 0;
    for (const { before, cleared } of steps) {
      const stage = stageOfAge(before.age);
      for (const flag of cleared) {
        flagsSeen.add(flag);
        const pool = createEventPool([withConditions(synthetic('x-needs', stage, false), { flags: [flag] }), synthetic('x-plain', stage, false)]);
        for (let k = 1; k <= 120; k++) {
          const s = { ...before, rngState: k };
          const legacy = withGoneYearRule('legacy', () => stepYear(s, pool));
          const notflags = withGoneYearRule('notflags', () => stepYear(s, pool));
          const exclude = stepYear(s, pool);
          if (legacy.state.pending === null) {
            expect(exclude.state.pending, `k=${k}`).toBeNull();
            continue;
          }
          picked++;
          if (legacy.state.pending.eventId === 'x-needs') legacyReader++;
          expect(notflags.state.pending?.eventId, `k=${k} ${flag}: ③ 없이는 legacy와 같다`).toBe(legacy.state.pending.eventId);
          expect(exclude.state.pending?.eventId, `k=${k} ${flag}: 꺼진 플래그를 요구하는 사건은 그 해 후보가 아니다`).toBe('x-plain');
          expect(exclude.state.rngState, `k=${k} ${flag}: 추첨 칸 수 불변`).toBe(legacy.state.rngState);
        }
      }
    }
    expect(picked, '선택지가 뽑힌 시도').toBeGreaterThan(30);
    expect(legacyReader, '안 뺀 세계가 그 사건을 뽑은 시도(공허 통과 방지)').toBeGreaterThan(5);
    expect(flagsSeen.size, '확인한 형제 플래그 종류').toBeGreaterThanOrEqual(2);
  });

  it('조부모: 마지막 한 분이 떠난 해 — 꺼진 조부모 플래그를 요구하는 사건을 exclude는 뽑지 않고 legacy는 뽑으며 진행 RNG는 같다', () => {
    const steps = clearedSteps('gp', 7, 40, 10);
    expect(steps.length, '조부모 플래그가 줄 뒤 꺼지는 걸음').toBeGreaterThanOrEqual(8);
    let picked = 0;
    let legacyReader = 0;
    for (const { before, cleared } of steps) {
      const stage = stageOfAge(before.age);
      for (const flag of cleared) {
        const pool = createEventPool([withConditions(synthetic('x-needs', stage, false), { flags: [flag] }), synthetic('x-plain', stage, false)]);
        for (let k = 1; k <= 120; k++) {
          const s = { ...before, rngState: k };
          const legacy = withGoneYearRule('legacy', () => stepYear(s, pool));
          const exclude = stepYear(s, pool);
          if (legacy.state.pending === null) {
            expect(exclude.state.pending, `k=${k}`).toBeNull();
            continue;
          }
          picked++;
          if (legacy.state.pending.eventId === 'x-needs') legacyReader++;
          expect(exclude.state.pending?.eventId, `k=${k} ${flag}: 꺼진 플래그를 요구하는 사건은 그 해 후보가 아니다`).toBe('x-plain');
          expect(exclude.state.rngState, `k=${k} ${flag}: 추첨 칸 수 불변`).toBe(legacy.state.rngState);
        }
      }
    }
    expect(picked, '선택지가 뽑힌 시도').toBeGreaterThan(30);
    expect(legacyReader, '안 뺀 세계가 그 사건을 뽑은 시도(공허 통과 방지)').toBeGreaterThan(5);
  });

  it('한 방향만이다: 줄이 안 난 해에는 아무것도 빼지 않고(exclude = legacy), 꺼지지 않은 플래그(형제가 더 있는 판)를 읽는 사건은 줄이 난 해에도 후보다', () => {
    // 줄이 안 난 해: 별세·조부모·형제 줄이 하나도 없는 걸음은 세 규칙의 결과가 같다
    let compared = 0;
    for (const [gi, gen] of GENERATION_IDS.slice(0, 2).entries()) {
      for (const seed of seedsFor(6, gi)) {
        for (const { before } of lifeSteps(seed, gen).slice(0, 40)) {
          const c = familyChangesFor(before, before.age, EVENT_POOL);
          if (c.lines.some((l) => l.eventId === FAMILY_LINE_ID.sibLost || l.eventId === FAMILY_LINE_ID.grandGone || l.eventId === FAMILY_LINE_ID.parentGone)) continue;
          const stage = stageOfAge(before.age);
          const pool = createEventPool([withConditions(synthetic('x-needs', stage, false), { flags: ['has_grandparent'] }), noticeEvent('x-notice', stage, { notFlags: ['mother_gone'] })]);
          for (let k = 1; k <= 20; k++) {
            const s = { ...before, rngState: k };
            const a = withGoneYearRule('legacy', () => stepYear(s, pool));
            const b = stepYear(s, pool);
            expect(b.state.pending?.eventId, `${gen}/${seed} ${before.age}세 k=${k}`).toBe(a.state.pending?.eventId);
            expect(b.state.pending?.choiceIds, `${gen}/${seed} ${before.age}세 k=${k}`).toEqual(a.state.pending?.choiceIds);
            expect(b.state.rngState).toBe(a.state.rngState);
            compared++;
          }
        }
      }
    }
    expect(compared, '비교한 시도').toBeGreaterThan(500);
  });
});

describe('R-632: 가족 줄이 난 해에 보이는 선택지 = 해 시작 ctx로 보이는 것 ∩ 줄 뒤 ctx로 보이는 것 (한 방향 — 새로 열리는 선택지 없음)', () => {
  it('K18 꼴 합성(school-teacher-notice 꼴): 한 분 별세 줄이 난 해, 떠난 분의 _gone을 notFlags로 읽는 선택지는 exclude에서 안 보이고(legacy에서는 보이고) 사건과 나머지 선택지·진행 RNG는 그대로다', () => {
    const steps = goneLineStepsAt(20, 100, 6, 7);
    expect(steps.length).toBeGreaterThanOrEqual(4);
    let picked = 0;
    for (const { before, flag } of steps) {
      const stage = stageOfAge(before.age);
      const pool = createEventPool([noticeEvent('x-notice', stage, { notFlags: [flag] })]);
      for (let k = 1; k <= 120; k++) {
        const s = { ...before, rngState: k };
        const legacy = withGoneYearRule('legacy', () => stepYear(s, pool));
        const exclude = stepYear(s, pool);
        if (legacy.state.pending === null) {
          expect(exclude.state.pending, `k=${k}`).toBeNull();
          continue;
        }
        picked++;
        expect(legacy.state.pending.choiceIds, `k=${k}: legacy는 해 시작 ctx로 본다`).toEqual(['accept', 'ask', 'decline']);
        expect(exclude.state.pending?.eventId, `k=${k}`).toBe('x-notice');
        expect(exclude.state.pending?.choiceIds, `k=${k}: 줄 뒤 ctx로 안 보이는 선택지는 뺀다`).toEqual(['accept', 'decline']);
        expect(exclude.state.rngState, `k=${k}: 추첨 칸 수 불변`).toBe(legacy.state.rngState);
      }
    }
    expect(picked, '선택지가 뽑힌 시도').toBeGreaterThan(20);
  });

  it('교집합이 2개 미만이 되는 선택지 사건은 그해 후보에서 빠지고 칸 수는 그대로다(난수 4칸), 줄 뒤 ctx에서 새로 열리는 선택지는 없다(한 방향)', () => {
    const steps = goneLineStepsAt(20, 100, 6, 7);
    let blocked = 0;
    for (const { before, flag } of steps) {
      const stage = stageOfAge(before.age);
      const other = flag === 'mother_gone' ? 'father_gone' : 'mother_gone';
      // 선택지 둘뿐인 사건: ask가 줄 뒤에 안 보여 하나가 되면 사건이 후보에서 빠진다
      const two = withConditions(noticeEvent('x-two', stage, { notFlags: [flag] }), {});
      (two as { choices: unknown[] }).choices = (two.choices ?? []).filter((c) => c.id !== 'decline');
      const poolTwo = createEventPool([two]);
      // 떠난 분의 _gone을 **요구하는** 선택지는 해 시작 ctx에서 안 보이므로 줄 뒤에도 새로 열리지 않는다 (교집합)
      const needs = noticeEvent('x-needs-choice', stage, { flags: [flag] });
      const poolNeeds = createEventPool([needs]);
      // 다른 한 분의 플래그를 읽는 선택지는 건드리지 않는다
      const untouched = noticeEvent('x-untouched', stage, { notFlags: [other] });
      const poolOther = createEventPool([untouched]);
      for (let k = 1; k <= 120; k++) {
        const s = { ...before, rngState: k };
        const legacy = withGoneYearRule('legacy', () => stepYear(s, poolTwo));
        if (legacy.state.pending !== null) {
          const exclude = stepYear(s, poolTwo);
          blocked++;
          expect(exclude.state.pending, `k=${k}`).toBeNull();
          expect(exclude.state.seen['x-two'], `k=${k}`).toBeUndefined();
          if (exclude.state.phase === 'life') {
            const r = createRng(k);
            for (let i = 0; i < 4; i++) r.next();
            expect(exclude.state.rngState, `k=${k}: 칸 수 불변(추첨 둘 · 대신 한 칸 · 해 끝 사망 판정)`).toBe(r.getState());
          }
        }
        for (const pool of [poolNeeds, poolOther]) {
          const a = withGoneYearRule('legacy', () => stepYear(s, pool));
          const b = stepYear(s, pool);
          expect(b.state.pending?.choiceIds, `k=${k}: 새로 열리거나 다른 한 분의 선택지가 바뀌지 않는다`).toEqual(a.state.pending?.choiceIds);
          expect(b.state.rngState).toBe(a.state.rngState);
        }
      }
    }
    expect(blocked, '사건이 후보에서 빠진 시도(공허 통과 방지)').toBeGreaterThan(5);
  });

  it('조부모 줄이 난 해: 꺼진 조부모 플래그를 requires로 읽는 선택지(infant-care의 grandparents 꼴)도 줄 뒤에는 안 보인다', () => {
    const steps = clearedSteps('gp', 7, 40, 10).filter((st) => st.cleared.includes('has_grandparent'));
    expect(steps.length).toBeGreaterThanOrEqual(6);
    let picked = 0;
    for (const { before } of steps) {
      const stage = stageOfAge(before.age);
      const pool = createEventPool([noticeEvent('x-grand', stage, { flags: ['has_grandparent'] })]);
      for (let k = 1; k <= 120; k++) {
        const s = { ...before, rngState: k };
        const legacy = withGoneYearRule('legacy', () => stepYear(s, pool));
        const exclude = stepYear(s, pool);
        if (legacy.state.pending === null) {
          expect(exclude.state.pending, `k=${k}`).toBeNull();
          continue;
        }
        picked++;
        expect(legacy.state.pending.choiceIds).toEqual(['accept', 'ask', 'decline']);
        expect(exclude.state.pending?.choiceIds, `k=${k}`).toEqual(['accept', 'decline']);
        expect(exclude.state.rngState).toBe(legacy.state.rngState);
      }
    }
    expect(picked, '선택지가 뽑힌 시도').toBeGreaterThan(20);
  });

  it('실제 사건 school-teacher-notice(12~18세): 한 분 별세 줄이 난 해에 「집에 가서 부모님과 의논한다」(ask)가 legacy에서는 골라지고(공허 통과 방지) 지금 규칙에서는 한 번도 골라지지 않는다', () => {
    const real = EVENT_POOL.byId.get('school-teacher-notice')!;
    const askDef = real.choices!.find((c) => c.id === 'ask')!;
    expect(askDef.requires?.notFlags, '원본의 ask는 한 분 별세 플래그를 notFlags로 읽는다').toEqual(['mother_gone', 'father_gone', 'parents_gone']);
    const steps = goneLineStepsAt(12, 18, 24, 7);
    expect(steps.length, '주인공 12~18세에 한 분이 떠나는 걸음').toBeGreaterThanOrEqual(8);
    const chosen = (r: ReturnType<typeof stepYear>, before: GameState): string[] => {
      if (r.state.pending !== null) return r.state.pending.eventId === real.id ? [...r.state.pending.choiceIds] : [];
      return r.state.history
        .slice(before.history.length)
        .filter((h) => h.eventId === real.id && h.kind === 'choice')
        .map((h) => real.choices!.find((c) => c.label === h.choice || c.parentLabel === h.choice)?.id ?? '?');
    };
    let legacyAsk = 0;
    let events = 0;
    for (const { before } of steps) {
      const filler = narrativeEvent('x-filler', stageOfAge(before.age));
      const pool = createEventPool([real, filler]);
      for (let k = 1; k <= 300; k++) {
        const s = { ...before, rngState: k };
        const legacy = withGoneYearRule('legacy', () => stepYear(s, pool));
        const exclude = stepYear(s, pool);
        const a = chosen(legacy, before);
        const b = chosen(exclude, before);
        if (a.length > 0) events++;
        // 대기 중인 카드면 보이는 선택지 목록에, 흘러간 카드면 고른 선택지에 ask가 있다
        if (a.includes('ask')) legacyAsk++;
        expect(b, `k=${k}: 줄이 난 해에는 ask가 보이지도 골라지지도 않는다`).not.toContain('ask');
      }
    }
    expect(events, '그 사건이 일어난 시도').toBeGreaterThan(10);
    expect(legacyAsk, 'legacy에서 ask가 보이거나 골라진 시도(공허 통과 방지)').toBeGreaterThan(3);
  });

  it('강제 사건(K2, trigger: "family")의 안전망은 닿지 않는다: 조건(requires) 없는 선택지가 둘 이상이라 줄 뒤 교집합이 늘 2개 이상이다', () => {
    const forced = EVENT_POOL.events.filter((e) => e.trigger === 'family');
    expect(forced.length, '강제 사건(공허 통과 방지)').toBeGreaterThan(0);
    for (const ev of forced) {
      const free = (ev.choices ?? []).filter((c) => c.requires === undefined);
      expect(free.length, `${ev.id}: requires 없는 선택지가 둘 미만이면 life.ts의 안전망(해 시작 값)이 R-632를 깬다`).toBeGreaterThanOrEqual(2);
    }
  });
});

describe('R-632 가드: 이혼 줄이 켜는 플래그(*_apart)를 읽는 사건·선택지가 풀에 없다 — 줄 뒤 ctx는 이혼 줄을 보지 않는다 (후속 200)', () => {
  it('이혼 줄(fam-parents-apart)이 난 해에 켜지는 플래그는 mother_apart·father_apart이고, 이 플래그를 사건 수준 conditions·선택지 수준 requires(flags·notFlags)·modifiers·bonuses로 읽는 사건이 풀에 0개다', () => {
    const APART = ['mother_apart', 'father_apart'];
    // 코드에서 이름 확인: 실제 판에서 이혼 줄이 난 해의 setFlags에 *_apart가 들어 있다(공허 통과 방지)
    let divorceYears = 0;
    const named = new Set<string>();
    outer: for (const [gi, gen] of GENERATION_IDS.entries()) {
      for (const seed of seedsFor(60, gi)) {
        for (const { before } of lifeSteps(seed, gen)) {
          const c = familyChangesFor(before, before.age, EVENT_POOL);
          if (!c.lines.some((l) => l.eventId === FAMILY_LINE_ID.parentsApart)) continue;
          divorceYears++;
          for (const x of c.setFlags) if (x.endsWith('_apart')) named.add(x);
          if (divorceYears >= 6) break outer;
        }
      }
    }
    expect(divorceYears, '이혼 줄이 난 해').toBeGreaterThanOrEqual(3);
    expect(named.size, '이혼 줄이 켜는 *_apart 플래그(공허 통과 방지)').toBeGreaterThan(0);
    for (const x of named) expect(APART, `이혼 줄이 켜는 ${x}가 가드 목록에 없다 — 목록을 고친다`).toContain(x);
    // 풀을 훑는다: 사건·선택지·modifier·bonus가 이 플래그를 읽는 곳
    const readers: string[] = [];
    const reads = (c: { flags?: string[]; notFlags?: string[] } | undefined): boolean => [...(c?.flags ?? []), ...(c?.notFlags ?? [])].some((f) => APART.includes(f));
    for (const ev of EVENT_POOL.events) {
      if (reads(ev.conditions)) readers.push(`${ev.id} (conditions)`);
      for (const m of ev.modifiers ?? []) if (reads(m.when)) readers.push(`${ev.id} (modifier)`);
      for (const b of ev.bonuses ?? []) if (reads(b.when)) readers.push(`${ev.id} (bonus)`);
      for (const ch of ev.choices ?? []) {
        if (reads(ch.requires)) readers.push(`${ev.id}/${ch.id} (requires)`);
        for (const b of ch.bonuses ?? []) if (reads(b.when)) readers.push(`${ev.id}/${ch.id} (bonus)`);
      }
    }
    expect(readers, '이 플래그를 읽는 사건이 생기면 R-632의 줄 뒤 ctx에 이혼 줄을 넣어야 한다(후속 200)').toEqual([]);
  });
});

describe('R-633: 선택지 후보가 별세 해 정리로 비면 그 해의 추첨 칸은 쓴 것으로 본다 — 서술 추첨으로 넘어가지 않는다 (R-560 「한 칸 규칙」)', () => {
  it('「빼는 선택지 사건 하나 + 서술 사건 하나」 풀: 안 뺀 세계가 선택지를 뽑은 해에 뺀 세계는 서술 사건을 뽑지 않고 난수 4칸(추첨 둘 · 비어 버린 선택지 칸 · 해 끝 사망 판정)만 쓴다', () => {
    const steps = goneLineStepsAt(20, 100, 6, 7);
    expect(steps.length).toBeGreaterThanOrEqual(4);
    let blocked = 0;
    let legacyNarrativeToo = 0;
    for (const { before, flag } of steps) {
      const stage = stageOfAge(before.age);
      const pool = createEventPool([withConditions(synthetic('x-reader', stage, false), { notFlags: [flag] }), narrativeEvent('x-narr', stage)]);
      for (let k = 1; k <= 200; k++) {
        const s = { ...before, rngState: k };
        const legacy = withGoneYearRule('legacy', () => stepYear(s, pool));
        if (legacy.state.pending === null) continue;
        const exclude = stepYear(s, pool);
        blocked++;
        expect(exclude.state.pending, `k=${k}`).toBeNull();
        expect(exclude.state.history.slice(before.history.length).map((h) => h.eventId), `k=${k}: 서술 사건으로 넘어가지 않는다`).not.toContain('x-narr');
        expect(exclude.state.seen['x-narr'], `k=${k}`).toBeUndefined();
        if (exclude.state.phase !== 'life') continue;
        const r = createRng(k);
        for (let i = 0; i < 4; i++) r.next();
        expect(exclude.state.rngState, `k=${k}: 칸 수 불변`).toBe(r.getState());
        // 이 난수에서 서술 추첨 값이 서술 빈도 안이었는지 — 고친 규칙이 실제로 막은 시도(공허 통과 방지)
        const rr = createRng(k);
        rr.next();
        if (rr.next() < EVENT_FREQUENCY[stage].narrative) legacyNarrativeToo++;
      }
    }
    expect(blocked, '선택지 후보가 비어 버린 시도').toBeGreaterThan(10);
    expect(legacyNarrativeToo, '서술 추첨이 닿았을 시도(고치지 않았다면 칸 수가 하나 늘었을 시도)').toBeGreaterThan(3);
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

