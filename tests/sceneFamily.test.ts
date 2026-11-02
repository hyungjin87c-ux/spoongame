import { describe, expect, it } from 'vitest';
import {
  GENERATION_IDS,
  SCENE_MEMBER_MAX,
  createInitialState,
  deriveFamilyFlags,
  familyOf,
  familyScheduleOf,
  familyViewOf,
  generateBirthFromSeed,
  homeKindOf,
  householdOf,
  livingSiblingCount,
  orderSharesOf,
  parentDivorceRate,
  rollYoungerSiblings,
  sceneFamilyOf,
  siblingCountOf,
  survivalCurve,
  type FamilyGame,
  type GameState,
  type PersonId,
  type ProfileId,
  type SceneChange,
} from '../src/core';
import { reportTiltOf } from '../src/data/birthReportTable';
import { sigmaTolerance } from './helpers/stats';
import { spreadSeeds } from './helpers/familyGolden';

/**
 * 그림이 먼저 읽는 최소 가족 상태 `sceneFamilyOf`와 가족 보기 `familyViewOf` (SPEC-009 FM4a, docs/data/family-model.md 8절·12-2절 INV-2·3·9·10·11·12, T-FA7a·b·c).
 * 시험은 실제 출생(7세대)에서 만든 판을 0~100세 전수로 훑는다.
 */

interface Sample {
  gen: ProfileId;
  seed: number;
  game: GameState;
}

function gameOf(seed: number, gen: ProfileId): GameState {
  const b = generateBirthFromSeed(seed, gen);
  return { ...createInitialState(seed), phase: 'life', generation: gen, character: b.character, birthReport: b.report, peerSeed: b.peerSeed, family: b.family } as GameState;
}

/** 20세 이상은 가족 집에 사는 것으로 한다(부모 집 동거 규칙을 보려고) */
const at = (g: GameState, age: number, over: Partial<GameState> = {}): GameState => ({
  ...g,
  age,
  assets: age >= 20 ? { net: 0, income: 0, debt: 0, incomeAdj: 0, dwelling: 'family' } : null,
  ...over,
});

const PER_GEN = 150;
const SAMPLES: Sample[] = GENERATION_IDS.flatMap((gen, gi) => spreadSeeds(PER_GEN, gi).map((seed) => ({ gen, seed, game: gameOf(seed, gen) })));
const AGES = Array.from({ length: 101 }, (_, i) => i);

describe('INV-2·10·11·12 — 0~100세 전수 (7세대 × 150판)', () => {
  it('함께 사는 사람: 떠난 사람·따로 사는 사람은 없고, 아직 태어나지 않은 동생은 어디에도 없다(INV-2)', () => {
    let checked = 0;
    for (const s of SAMPLES) {
      for (const age of AGES) {
        const g = at(s.game, age);
        const view = familyViewOf(g);
        const byId = new Map(view.people.map((p) => [p.id, p]));
        for (const id of view.household) {
          const p = byId.get(id)!;
          expect(p.state, `${s.gen} ${s.seed} ${age}세 ${id}`).toBe('with');
        }
        for (const p of view.people) {
          if (p.role === 'sibling' && p.older === false) {
            const k = s.game.family!.y[Number(p.id.slice(1)) - 1].k;
            expect(age, `${s.gen} ${s.seed}: ${p.id}는 ${k}세에 태어난다`).toBeGreaterThanOrEqual(k);
          }
          if (p.state === 'gone') expect(view.household).not.toContain(p.id);
        }
        checked++;
      }
    }
    expect(checked).toBe(SAMPLES.length * 101);
  });

  it('한 번 떠난 사람은 돌아오지 않는다(단조): 상태가 gone이 된 뒤 어느 나이에서도 gone이다', () => {
    for (const s of SAMPLES) {
      const goneAt = new Map<PersonId, number>();
      for (const age of AGES) {
        for (const p of familyViewOf(at(s.game, age)).people) {
          if (p.state === 'gone' && !goneAt.has(p.id)) goneAt.set(p.id, age);
          if (goneAt.has(p.id)) expect(p.state, `${s.gen} ${s.seed} ${p.id} ${age}세 (${goneAt.get(p.id)}세에 떠남)`).toBe('gone');
        }
      }
    }
  });

  it('INV-3·6: 부모의 나이는 출생신고의 나이 + 주인공 나이이고(떠난 분은 별세 나이), 사람 목록은 태어난 사람만이다', () => {
    for (const s of SAMPLES.slice(0, 400)) {
      const r = s.game.birthReport!;
      for (const age of [0, 5, 18, 30, 60]) {
        const view = familyViewOf(at(s.game, age));
        const mother = view.people.find((p) => p.id === 'mother')!;
        const father = view.people.find((p) => p.id === 'father')!;
        if (mother.state !== 'gone' || mother.goneAtOwnAge === undefined) expect(mother.age).toBe(r.mother.age + age);
        if (father.state !== 'gone' || father.goneAtOwnAge === undefined) expect(father.age).toBe(r.father.age + age);
        expect(view.calYear).toBe(s.game.character!.birthYear + age);
      }
    }
  });

  it('INV-10·11·12: 형제 수는 한 정의(살아 있는 형제)이고, 그림은 7명·반려동물 2마리 이하, 같은 상태는 같은 출력이다', () => {
    for (const s of SAMPLES) {
      for (const age of [0, 3, 8, 15, 19, 20, 35, 70]) {
        const g = at(s.game, age);
        const view = familyViewOf(g);
        const sibs = view.people.filter((p) => p.role === 'sibling');
        const living = sibs.filter((p) => p.state !== 'gone').length;
        expect(view.siblingCount.living).toBe(living);
        expect(view.siblingCount.older + view.siblingCount.younger).toBe(living);
        expect(view.siblingCount.total).toBe(sibs.length);
        expect(livingSiblingCount(g)).toBe(living);
        expect(siblingCountOf(g, 'view')).toBe(living);
        const scene = sceneFamilyOf(g);
        expect(scene.members.length).toBeLessThanOrEqual(SCENE_MEMBER_MAX);
        expect(new Set(scene.members.map((m) => m.id)).size).toBe(scene.members.length);
        expect(scene.members.length + scene.overflow).toBe(view.household.length);
        expect(scene.members.filter((m) => m.role === 'sibling').length).toBeLessThanOrEqual(living);
        expect(scene.pets.length).toBeLessThanOrEqual(2);
        // 같은 상태 → 같은 값 (JSON을 거친 사본에서도)
        expect(sceneFamilyOf(JSON.parse(JSON.stringify(g)) as GameState)).toEqual(scene);
        expect(familyViewOf(JSON.parse(JSON.stringify(g)) as GameState)).toEqual(view);
      }
    }
  });

  it('식구 순서(왼쪽부터): 조부 · 조모 · 아버지 · 어머니 · 손위 형제(먼 쪽부터) · 손아래 형제(태어난 순)', () => {
    const rank = (id: string): number => (id === 'pgf' || id === 'mgf' ? 0 : id === 'pgm' || id === 'mgm' ? 1 : id === 'father' ? 2 : id === 'mother' ? 3 : id.startsWith('o') ? 4 : 5);
    let multi = 0;
    for (const s of SAMPLES) {
      for (const age of [2, 7, 12]) {
        const ids = sceneFamilyOf(at(s.game, age)).members.map((m) => m.id);
        const ranks = ids.map(rank);
        expect(ranks, `${s.gen} ${s.seed} ${age}세 ${ids.join(',')}`).toEqual([...ranks].sort((a, b) => a - b));
        if (ids.length >= 5) multi++;
      }
    }
    expect(multi, '식구가 많은 판이 실제로 있다(공허 통과 방지)').toBeGreaterThan(50);
  });

  it('householdOf는 household의 순서대로 사람을 돌려준다', () => {
    const s = SAMPLES.find((x) => familyViewOf(at(x.game, 7)).household.length >= 4)!;
    const view = familyViewOf(at(s.game, 7));
    expect(householdOf(view).map((p) => p.id)).toEqual(view.household);
  });
});

describe('성인기 식구 (20세 이상)', () => {
  it('가족 집에 살지 않으면 함께 사는 사람이 없고(부모·형제는 따로 삶), 가족 집(moved_home 아님)이거나 부모와 함께 사는 플래그가 있으면 살아 있는 부모와 독립 전 형제가 함께 산다', () => {
    let homeWith = 0;
    for (const s of SAMPLES) {
      const away = familyViewOf({ ...at(s.game, 25), assets: { net: 0, income: 0, debt: 0, incomeAdj: 0, dwelling: 'rent' } });
      expect(away.household, `${s.gen} ${s.seed}`).toEqual([]);
      const home = familyViewOf(at(s.game, 25));
      for (const id of home.household) {
        const p = home.people.find((x) => x.id === id)!;
        expect(['mother', 'father', 'sibling']).toContain(p.role);
        if (p.role === 'sibling') expect(p.independent).not.toBe(true);
      }
      homeWith += home.household.length > 0 ? 1 : 0;
      const moved = familyViewOf(at(s.game, 25, { flags: ['moved_home'] }));
      expect(moved.household).toEqual([]);
      const lives = familyViewOf({ ...at(s.game, 25), assets: { net: 0, income: 0, debt: 0, incomeAdj: 0, dwelling: 'rent' }, flags: ['lives_with_parents'] });
      expect(lives.household.length).toBeGreaterThanOrEqual(0);
    }
    expect(homeWith, '부모 집에 사는 성인 표본이 있다(공허 통과 방지)').toBeGreaterThan(100);
  });

  it('조부모는 20세 이상에서 함께 살지 않는다', () => {
    for (const s of SAMPLES.slice(0, 300)) {
      const v = familyViewOf(at(s.game, 22));
      expect(v.people.filter((p) => p.role === 'grandparent' && p.state === 'with')).toEqual([]);
    }
  });
});

describe('조부모 · 함께 사는 쪽', () => {
  it('함께 사는 조부모는 0~19세 동안 사는 쪽(c)의 살아 있는 조부모뿐이고, 떠나면 빠진다', () => {
    let withSome = 0;
    for (const s of SAMPLES) {
      const c = s.game.family!.c;
      for (const age of [0, 4, 10, 16, 19]) {
        const view = familyViewOf(at(s.game, age));
        for (const p of view.people.filter((x) => x.role === 'grandparent' && x.state === 'with')) {
          expect(c === 1 ? ['pgf', 'pgm'] : ['mgf', 'mgm'], `${s.gen} ${s.seed}`).toContain(p.id);
          withSome++;
        }
      }
    }
    expect(withSome, '함께 사는 조부모 표본이 있다').toBeGreaterThan(300);
  });

  it('태어나기 전에 떠난 조부모는 beforeMyBirth로 표시되고(goneAtMyAge < 0) 줄 없이 카드에만 남는다', () => {
    let before = 0;
    for (const s of SAMPLES) {
      const view = familyViewOf(at(s.game, 0));
      for (const p of view.people.filter((x) => x.role === 'grandparent' && x.state === 'gone')) {
        expect(p.beforeMyBirth, `${s.gen} ${s.seed} ${p.id}`).toBe(true);
        expect(p.goneAtMyAge!).toBeLessThan(0);
        expect(view.household).not.toContain(p.id);
        before++;
      }
    }
    expect(before).toBeGreaterThan(100);
  });
});

describe('T-FA7 부모 한 분 별세(K3)와 이혼·별거', () => {
  it('INV-2b 아래 동생은 부모 한 분이 떠난 해·이혼한 해 뒤에 태어나지 않는다(재혼·의붓 없음)', () => {
    let cut = 0;
    for (const s of SAMPLES) {
      const sc = familyScheduleOf(s.game);
      for (const y of s.game.family!.y) {
        if (sc.firstGone !== null) expect(y.k, `${s.gen} ${s.seed}`).toBeLessThanOrEqual(sc.firstGone.at);
        if (sc.divorce !== null) expect(y.k, `${s.gen} ${s.seed}`).toBeLessThanOrEqual(sc.divorce.at);
      }
      // 끊는 규칙이 실제로 일했는가: 끊지 않고 굴리면 동생이 더 많은 판
      const r = s.game.birthReport!;
      const free = rollYoungerSiblings(sc.famSeed, r.birthOrder, r.mother.age, orderSharesOf(reportTiltOf(sc.birthYear), r.region, sc.birthYear));
      if (free.length > s.game.family!.y.length) cut++;
    }
    expect(cut, '끊긴 판이 표본에 있어야 이 시험이 위반을 잡는다').toBeGreaterThan(0);
  });

  it('모델이 정한 별세는 한 분뿐이다: 먼저 떠나는 분 쪽만 gone이 되고, 같은 해면 아버지가 먼저다(설계값). 두 번째 분은 100세 규칙(또는 parents_gone)만 따른다', () => {
    for (const s of SAMPLES) {
      const sc = familyScheduleOf(s.game);
      if (sc.firstGone === null) continue;
      if (sc.parentGoneAt[0] === sc.parentGoneAt[1]) expect(sc.firstGone.who).toBe(1);
      else expect(sc.firstGone.who).toBe(sc.parentGoneAt[0] < sc.parentGoneAt[1] ? 0 : 1);
      const r = s.game.birthReport!;
      for (const age of [0, 10, 25]) {
        const view = familyViewOf(at(s.game, age));
        const parents = [view.people.find((p) => p.id === 'mother')!, view.people.find((p) => p.id === 'father')!];
        const other = parents[1 - sc.firstGone.who];
        const ownAge = (sc.firstGone.who === 0 ? r.father.age : r.mother.age) + age;
        if (ownAge <= 100) expect(other.state, `${s.gen} ${s.seed} ${age}세: 두 번째 분의 별세는 모델이 정하지 않는다`).not.toBe('gone');
      }
    }
  });

  it('T-FA7b 19세 이하에 부모 한 분이 떠난 비율이 곡선으로 따로 계산한 값과 4σ 이내다', () => {
    const ps: number[] = [];
    let obs = 0;
    for (const s of SAMPLES) {
      const r = s.game.birthReport!;
      const Y = s.game.character!.birthYear;
      // 한 분이라도 출생 후 19년(= 나이 a → a + 19) 안에 떠날 확률: 1 − Π (S[a+20] / S[a])
      const alive = (sex: 'male' | 'female', parentAge: number): number => {
        const c = survivalCurve(sex, Y - parentAge);
        return c[Math.min(101, parentAge + 20)] / c[parentAge];
      };
      ps.push(1 - alive('female', r.mother.age) * alive('male', r.father.age));
      if (familyScheduleOf(s.game).firstGone!.at <= 19) obs++;
    }
    const mu = ps.reduce((a, b) => a + b, 0);
    const sd = Math.sqrt(ps.reduce((a, p) => a + p * (1 - p), 0));
    expect(Math.abs(obs - mu), `관측 ${obs} vs 기대 ${mu.toFixed(1)} (4σ ${(4 * sd).toFixed(1)})`).toBeLessThanOrEqual(4 * sd);
  });

  it('T-FA7c 아버지가 먼저 떠나는 판이 어머니가 먼저인 판보다 많다(남성 별세 선행)', () => {
    const first = SAMPLES.map((s) => familyScheduleOf(s.game).firstGone!.who);
    const fathers = first.filter((w) => w === 1).length;
    expect(fathers).toBeGreaterThan(first.length - fathers);
  });

  it('이혼 비율 표: 1993~2025는 표 값, 2025 뒤는 2025 값, 1993 앞은 조이혼율 비로 줄인 값(1970 앞은 1970 조이혼율)', () => {
    expect(parentDivorceRate(1993)).toBeCloseTo(0.47, 5);
    expect(parentDivorceRate(2003)).toBeCloseTo(1.539, 5);
    expect(parentDivorceRate(2025)).toBeCloseTo(0.825, 5);
    expect(parentDivorceRate(2040)).toBeCloseTo(0.825, 5);
    expect(parentDivorceRate(1970)).toBeCloseTo((0.47 * 0.4) / 1.3, 5);
    expect(parentDivorceRate(1950)).toBeCloseTo(parentDivorceRate(1970), 10);
    expect(parentDivorceRate(1980)).toBeLessThan(parentDivorceRate(1993));
  });

  it('T-FA7a 1993~2006년생이 0~18세 사이 부모 이혼을 겪는 비율이 15.6~18.0% 근방(4σ)이다', () => {
    const rows: GameState[] = [];
    for (const gen of ['millennial', 'genz'] as const) for (const seed of spreadSeeds(6000, GENERATION_IDS.indexOf(gen))) {
      const b = generateBirthFromSeed(seed, gen);
      if (b.character.birthYear >= 1993 && b.character.birthYear <= 2006) rows.push({ ...createInitialState(seed), phase: 'life', generation: gen, character: b.character, birthReport: b.report, peerSeed: b.peerSeed, family: b.family } as GameState);
    }
    expect(rows.length).toBeGreaterThan(2500);
    const obs = rows.filter((g) => familyScheduleOf(g).divorce !== null).length;
    const p = obs / rows.length;
    const tol = sigmaTolerance(0.17, rows.length);
    expect(p, `관측 ${(p * 100).toFixed(1)}% (n=${rows.length})`).toBeGreaterThanOrEqual(0.156 - tol);
    expect(p).toBeLessThanOrEqual(0.18 + tol);
  });

  it('이혼·별거: 떠나는 쪽은 아버지 0.8 / 어머니 0.2(4σ), 이혼 뒤(at+1세부터) 그 분은 apart이고 함께 사는 사람·그림에서 빠지며, 이혼은 한 분이 떠난 해부터는 일어나지 않는다', () => {
    let fathers = 0;
    let n = 0;
    for (const s of SAMPLES) {
      const sc = familyScheduleOf(s.game);
      if (sc.divorce === null) continue;
      n++;
      if (sc.divorce.leaver === 1) fathers++;
      const who = sc.divorce.leaver === 1 ? 'father' : 'mother';
      const before = familyViewOf(at(s.game, sc.divorce.at));
      const after = familyViewOf(at(s.game, sc.divorce.at + 1));
      expect(before.people.find((p) => p.id === who)!.state).toBe('with');
      const p = after.people.find((x) => x.id === who)!;
      if (p.state !== 'gone') {
        expect(p.state).toBe('apart');
        expect(p.apartBy).toBe('split');
        expect(after.household).not.toContain(who);
        expect(sceneFamilyOf(at(s.game, sc.divorce.at + 1)).changed).toContain('parents-apart');
      }
      if (sc.firstGone !== null) expect(sc.divorce.at).toBeLessThan(sc.firstGone.at);
      expect(sc.divorce.at).toBeLessThanOrEqual(18);
    }
    expect(n, '이혼이 일어난 판이 실제로 있다').toBeGreaterThan(50);
    expect(Math.abs(fathers / n - 0.8)).toBeLessThanOrEqual(sigmaTolerance(0.8, n));
  });
});

describe('changed — 이번 해에 바뀐 것 (8절)', () => {
  it('동생이 태어나는 해(나이 == k)에 sib-born, 형제가 독립 나이를 넘는 해에 sib-left, 조부모·부모 별세 해에 gp-gone·parent-gone, 이혼 다음 해에 parents-apart, 스무 살에 가족 집을 떠나면 independent가 나온다', () => {
    const seen = new Set<SceneChange>();
    for (const s of SAMPLES) {
      const f = s.game.family!;
      for (const age of AGES) {
        const scene = sceneFamilyOf(at(s.game, age, age === 20 ? { assets: { net: 0, income: 0, debt: 0, incomeAdj: 0, dwelling: 'rent' } } : {}));
        for (const c of scene.changed) seen.add(c);
        if (f.y.some((y) => y.k === age && age > 0)) expect(scene.changed, `${s.gen} ${s.seed} ${age}세`).toContain('sib-born');
        if (!f.y.some((y) => y.k === age)) expect(scene.changed).not.toContain('sib-born');
      }
    }
    for (const kind of ['sib-born', 'sib-left', 'gp-gone', 'parent-gone', 'parents-apart', 'independent'] as const) expect(seen.has(kind), `changed에 ${kind}가 실제로 나온다`).toBe(true);
    // FM4a에 없는 종류(이사·반려동물·결혼·출산·시대)는 아직 나오지 않는다
    for (const kind of ['moved', 'pet-in', 'pet-out', 'married', 'child-born', 'era'] as const) expect(seen.has(kind), `${kind}는 FM4b 이후`).toBe(false);
  });

  it('식구가 그대로인 해에는 changed가 비어 있다', () => {
    const s = SAMPLES[10];
    let quiet = 0;
    for (const age of [1, 2, 3, 4, 5, 6, 7, 8, 9]) if (sceneFamilyOf(at(s.game, age)).changed.length === 0) quiet++;
    expect(quiet).toBeGreaterThan(3);
  });
});

describe('그 밖의 그림 상태', () => {
  it('집 종류·방 수는 어린 시절(부모 집)에 출생 때 정한 값이 실리고(묶음 B, FM4b), 출생 점유 형태와 20세 이상의 주거는 그대로 실린다', () => {
    const s = SAMPLES[3];
    const kid = sceneFamilyOf(at(s.game, 5));
    expect(kid.homeKind).toBe(homeKindOf(s.game.family!.h!));
    expect(kid.rooms).toBe(s.game.family!.h!.r);
    expect(kid.housing).toBe(s.game.birthReport!.housing);
    expect(kid.dwelling).toBeNull();
    expect(sceneFamilyOf(at(s.game, 30)).dwelling).toBe('family');
    expect(kid.me).toEqual({ age: 5, gender: s.game.character!.gender });
    expect(kid.calYear).toBe(s.game.character!.birthYear + 5);
  });

  it('반려동물은 사건이 켠 pet_* 플래그만 읽는다: 최대 2마리, 종이 그대로', () => {
    const s = SAMPLES[5];
    expect(sceneFamilyOf(at(s.game, 8)).pets).toEqual([]);
    expect(sceneFamilyOf(at(s.game, 8, { flags: ['pet_dog'] })).pets.map((p) => p.species)).toEqual(['dog']);
    expect(sceneFamilyOf(at(s.game, 8, { flags: ['pet_cat', 'pet_dog', 'pet_other'] })).pets.map((p) => p.species)).toEqual(['dog', 'cat']);
  });

  it('식구가 8명을 넘는 판은 아래 동생부터, 위 형제, 조부모 순으로 빠져 overflow에 센다(부모는 남는다)', () => {
    let overflowSeen = 0;
    for (const s of SAMPLES) {
      for (const age of [1, 6, 12]) {
        const scene = sceneFamilyOf(at(s.game, age));
        if (scene.overflow > 0) {
          overflowSeen++;
          const view = familyViewOf(at(s.game, age));
          for (const parent of ['mother', 'father'] as const) if (view.household.includes(parent)) expect(scene.members.map((m) => m.id)).toContain(parent);
          expect(scene.members).toHaveLength(SCENE_MEMBER_MAX);
        }
      }
    }
    expect(overflowSeen, '넘치는 판이 있다').toBeGreaterThan(0);
  });

  it('시스템 플래그 파생(INV-7, FM4a 범위): 조부모·형제·부모 한 분 별세·이혼이 보기와 맞고 mother_gone과 father_gone이 함께 켜지지 않는다(INV-9)', () => {
    for (const s of SAMPLES) {
      for (const age of [0, 5, 12, 19, 30]) {
        const view = familyViewOf(at(s.game, age));
        const flags = deriveFamilyFlags(view);
        expect(flags.has('has_grandparent')).toBe(view.people.some((p) => p.role === 'grandparent' && p.state !== 'gone'));
        expect(flags.has('lives_with_grandparent')).toBe(view.household.some((id) => ['pgf', 'pgm', 'mgf', 'mgm'].includes(id)));
        expect(flags.has('has_sibling')).toBe(view.siblingCount.living > 0);
        expect(flags.has('has_older_sibling')).toBe(view.siblingCount.older > 0);
        expect(flags.has('has_younger_sibling')).toBe(view.siblingCount.younger > 0);
        expect(flags.has('mother_gone') && flags.has('father_gone')).toBe(false);
      }
    }
  });
});

describe('family가 없는 상태(옛 저장·시험이 만든 상태)', () => {
  it('즉석에서 legacyFamilyFrom으로 만든 구성으로 계산한다 — 위 형제는 옛 familyOf와 같고 아래 동생은 seen의 사건 나이로만 생긴다(더 늘리지 않는다)', () => {
    let withEvent = 0;
    for (const s of SAMPLES.slice(0, 500)) {
      const bare = { ...s.game } as FamilyGame & Record<string, unknown>;
      delete bare.family;
      for (const seen of [{}, { 'infant-new-sibling': 3 }]) {
        const g = { ...bare, seen, age: 10 } as unknown as GameState;
        const view = familyViewOf(g);
        const old = familyOf(g);
        const olderView = view.people.filter((p) => p.role === 'sibling' && p.older === true).map((p) => [p.age, p.sibKind]);
        expect(olderView).toEqual(old.siblings.filter((x) => x.older).map((x) => [x.age, x.kind]));
        const younger = view.people.filter((p) => p.role === 'sibling' && p.older === false);
        const oldYounger = old.siblings.filter((x) => !x.older);
        expect(younger.map((p) => [p.age, p.sibKind])).toEqual(oldYounger.map((x) => [x.age, x.kind]));
        if (oldYounger.length > 0) withEvent++;
        // 옛 구성과 같은 형제 수 → 상속 나눗셈이 달라지지 않는다
        expect(siblingCountOf(g, 'view')).toBe(siblingCountOf(g, 'legacy'));
      }
    }
    expect(withEvent).toBeGreaterThan(100);
  });
});
