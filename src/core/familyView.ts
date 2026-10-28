import { FAMILY_ADULT_AGE, FAMILY_MAX_AGE, type SiblingKind } from './family';
import { goneAtMyAge, grandBirthYears, parentBirthYear } from './familyBirth';
import {
  DIVORCE_AGES,
  DIVORCE_FATHER_LEAVES,
  FAMILY_TAG,
  GRAND_COHABIT_UNTIL,
  GRAND_IDS,
  NO_DEATH_PLAN,
  SCENE_MEMBER_MAX,
  type FamilyData,
  type FamilyView,
  type Person,
  type PersonId,
  type PersonState,
  type SceneChange,
  type SceneFamilyState,
  type SceneMember,
} from './familyModel';
import { famHash01, famSeedOf } from './familyRng';
import { legacyFamilyFrom } from './familyStorage';
import { familyTables } from './gameData';
import type { GameState, Gender } from './types';

/**
 * 가족 보기 `FamilyView`와 그림 상태 `SceneFamilyState` (SPEC-009 FM4a, 설계 문서 3-1·8절). **저장된 `family`(출생 때 한 번 뽑은 값)와 주인공 나이·플래그·자산에서 다시 계산하는 순수 함수**다 —
 * 나이·생존·동거·사이는 저장하지 않는다. 같은 상태 → 같은 값(INV-12), 새로고침해도 같다. 난수는 쓰지 않고 해마다의 판정(부모 이혼)만 `famHash01`이다.
 *
 * FM4a는 **파생 상태**까지다: 조부모·부모 한 분의 별세, 부모 이혼·별거, 아래 동생의 출생, 형제의 독립이 나이에 따라 `people`·`household`에 반영된다. 이 변화를 인생 기록 줄·플래그·`family.log`로 알리는
 * `familyChangesFor`/`applyFamilyChanges`(4-7절)와 이른 부모 별세의 스탯·집안 살림 효과, `infant-new-sibling`을 구성에 맞추는 K2는 FM4b다 — 그래서 아직 어느 화면도 이 보기를 읽지 않는다(식구 카드는 `familyOf` 그대로).
 */

export type FamilyGame = Pick<GameState, 'age' | 'flags' | 'seen' | 'birthReport' | 'character' | 'peerSeed' | 'seed' | 'assets'> & { family?: FamilyData };

// ---------- 부모 이혼 비율 (4-7절 (2)) ----------

const clamp = (n: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, n));

/**
 * 해마다 미성년 자녀가 부모 이혼을 맞는 비율(%). 1993~2025는 표 값(확인(환산)), 2025 뒤는 2025 값 유지,
 * 1993 앞은 `h(1993) × 조이혼율(y) ÷ 조이혼율(1993)`(추정, 1970 앞은 1970 조이혼율 유지 — 설계값).
 */
export function parentDivorceRate(year: number): number {
  const d = familyTables().divorce;
  const last = d.rateFrom + d.rate.length - 1;
  if (year >= d.rateFrom) return d.rate[Math.min(year, last) - d.rateFrom];
  const crudeAt = (y: number): number => d.crude[clamp(y, d.crudeFrom, d.crudeFrom + d.crude.length - 1) - d.crudeFrom];
  return (d.rate[0] * crudeAt(year)) / crudeAt(d.rateFrom);
}

// ---------- 일정 (주인공 나이와 무관한 계획) ----------

export interface FamilySchedule {
  family: FamilyData;
  birthYear: number;
  famSeed: number;
  /** 부모 출생 연도 [어머니, 아버지] */
  parentBy: [number, number];
  /** 주인공 나이로 본 부모 별세 시점 (101 = 계획 없음 → Infinity) */
  parentGoneAt: [number, number];
  /** 먼저 떠나는 한 분 (같은 해면 아버지가 먼저 — 설계값). 두 번째 분의 별세는 모델이 정하지 않는다 (K3, 4-7절 (1)) */
  firstGone: { who: 0 | 1; at: number } | null;
  /** 부모 이혼·별거: 주인공 나이 `at`의 해에 일어나 `at + 1`부터 한 분이 따로 산다. `leaver` 0 어머니 · 1 아버지 */
  divorce: { at: number; leaver: 0 | 1 } | null;
  grandBy: [number, number, number, number];
  grandGoneAt: [number, number, number, number];
}

const FOUND = (game: FamilyGame): { family: FamilyData } => ({ family: game.family ?? legacyFamilyFrom(game as GameState) });

/** 이 판의 계획. `family`가 없는 상태(옛 저장 · 시험이 직접 만든 상태)는 `legacyFamilyFrom`으로 즉석에서 만든다 — 저장하지 않는다 */
export function familyScheduleOf(game: FamilyGame): FamilySchedule {
  const { character, birthReport: report } = game;
  if (character === null || report === null) throw new Error('familyScheduleOf: 출생 전 상태에는 가족이 없다');
  const { family } = FOUND(game);
  const Y = character.birthYear;
  const famSeed = famSeedOf(game.peerSeed ?? game.seed);
  const parentBy: [number, number] = [parentBirthYear(Y, report.mother.age), parentBirthYear(Y, report.father.age)];
  const goneAt = (i: 0 | 1): number => {
    const d = family.p[i].d;
    return d >= NO_DEATH_PLAN ? Infinity : goneAtMyAge(parentBy[i], d, Y);
  };
  const parentGoneAt: [number, number] = [goneAt(0), goneAt(1)];
  let firstGone: FamilySchedule['firstGone'] = null;
  if (Number.isFinite(parentGoneAt[0]) || Number.isFinite(parentGoneAt[1])) {
    const who: 0 | 1 = parentGoneAt[1] <= parentGoneAt[0] ? 1 : 0;
    firstGone = { who, at: parentGoneAt[who] };
  }
  let divorce: FamilySchedule['divorce'] = null;
  for (let a = DIVORCE_AGES.min; a <= DIVORCE_AGES.max && divorce === null; a++) {
    if (firstGone !== null && a >= firstGone.at) break; // 한 분이 떠난 해부터는 일어나지 않는다
    if (famHash01(famSeed, FAMILY_TAG.DIVORCE, a, 0) * 100 < parentDivorceRate(Y + a)) {
      divorce = { at: a, leaver: famHash01(famSeed, FAMILY_TAG.DIVORCE, a, 1) < DIVORCE_FATHER_LEAVES ? 1 : 0 };
    }
  }
  const grandBy = grandBirthYears(Y, report.mother.age, report.father.age, family.g);
  const grandGoneAt = grandBy.map((by, i) => (family.g[i].d >= NO_DEATH_PLAN ? Infinity : goneAtMyAge(by, family.g[i].d, Y))) as FamilySchedule['grandGoneAt'];
  return { family, birthYear: Y, famSeed, parentBy, parentGoneAt, firstGone, divorce, grandBy, grandGoneAt };
}

// ---------- 보기 ----------

const GRAND_GENDER: Readonly<Record<string, Gender>> = { pgf: 'male', pgm: 'female', mgf: 'male', mgm: 'female' };
const SIB_O: readonly PersonId[] = ['o1', 'o2', 'o3', 'o4'];
const SIB_Y: readonly PersonId[] = ['y1', 'y2', 'y3', 'y4', 'y5', 'y6', 'y7'];

function siblingKindOf(older: boolean, gender: Gender): SiblingKind {
  return older ? (gender === 'male' ? 'olderBrother' : 'olderSister') : gender === 'male' ? 'youngerBrother' : 'youngerSister';
}

/**
 * 한 나이(`age`)에서의 가족 보기. `at`을 주면 그 나이로 계산한다(그림의 `changed`가 바로 앞 나이와 견주려고 부른다) — 플래그·자산은 지금 값을 그대로 쓴다.
 * `people`에는 **태어난 사람만** 있고(아직 안 태어난 동생 없음), 떠난 사람도 있다(`state: 'gone'` — 카드의 「떠난 가족」). `household`(함께 사는 사람, 주인공 제외)에는 떠난 사람·따로 사는 사람이 없다 (INV-2).
 */
export function familyViewOf(game: FamilyGame, at: number = game.age): FamilyView {
  const sc = familyScheduleOf(game);
  const { family: f, birthYear: Y } = sc;
  const report = game.birthReport!;
  const age = at;
  const calYear = Y + age;
  const flags = game.flags;
  const adult = age >= FAMILY_ADULT_AGE;
  const parentsGoneFlag = flags.includes('parents_gone');
  /** 어른이 된 뒤 부모 집에 사는가 (3-1절): 가족 집이고 자식 곁으로 옮기지 않았거나, 부모와 함께 사는 플래그 */
  const adultHome = adult && ((game.assets?.dwelling === 'family' && !flags.includes('moved_home')) || flags.includes('lives_with_parents'));

  const people: Person[] = [];
  const stateOf = (gone: boolean, apartByEvent: boolean, wouldLive: boolean): PersonState => (gone ? 'gone' : apartByEvent || !wouldLive ? 'apart' : 'with');

  // 부모
  (['mother', 'father'] as const).forEach((role, i) => {
    const ownAge = (i === 0 ? report.mother.age : report.father.age) + age;
    const flagGone = flags.includes(`${role}_gone`);
    const modeledGone = sc.firstGone !== null && sc.firstGone.who === i && age > sc.firstGone.at;
    const gone = parentsGoneFlag || flagGone || modeledGone || ownAge > FAMILY_MAX_AGE;
    const apartByEvent = flags.includes(`${role}_apart`) || (sc.divorce !== null && sc.divorce.leaver === i && age > sc.divorce.at);
    const p: Person = {
      id: role,
      role,
      name: f.p[i].n ?? '',
      gender: role === 'mother' ? 'female' : 'male',
      birthYear: sc.parentBy[i],
      age: ownAge,
      state: stateOf(gone, apartByEvent, !adult || adultHome),
    };
    if (p.state === 'apart') p.apartBy = apartByEvent ? 'split' : 'away';
    if (gone && modeledGone && !parentsGoneFlag && !flagGone) {
      p.goneAtOwnAge = f.p[i].d;
      p.goneAtMyAge = sc.parentGoneAt[i];
      p.age = f.p[i].d;
    }
    people.push(p);
  });

  // 조부모
  GRAND_IDS.forEach((id, i) => {
    const gp = f.g[i];
    const ownAge = calYear - sc.grandBy[i];
    const gone = ownAge > Math.min(gp.d, FAMILY_MAX_AGE);
    const side: 1 | 2 = i < 2 ? 1 : 2;
    const lives = !adult && age <= GRAND_COHABIT_UNTIL && f.c === side;
    const p: Person = { id, role: 'grandparent', name: gp.n ?? '', gender: GRAND_GENDER[id], birthYear: sc.grandBy[i], age: ownAge, state: stateOf(gone, false, lives) };
    if (gone) {
      p.goneAtOwnAge = Math.min(gp.d, FAMILY_MAX_AGE);
      p.goneAtMyAge = sc.grandGoneAt[i];
      p.age = p.goneAtOwnAge;
      if (sc.grandGoneAt[i] < 0) p.beforeMyBirth = true;
    }
    people.push(p);
  });

  // 형제: 위(가까운 순) · 아래(태어난 순)
  const sibling = (id: PersonId, s: FamilyData['o'][number], older: boolean): Person | null => {
    const ownAge = older ? age + s.k : age - s.k;
    if (ownAge < 0) return null; // 아직 태어나지 않았다
    const gender: Gender = s.g === 0 ? 'male' : 'female';
    const gone = ownAge > FAMILY_MAX_AGE;
    const independent = ownAge >= s.s;
    const home = !adult || adultHome;
    const person: Person = {
      id,
      role: 'sibling',
      name: s.n ?? '',
      gender,
      birthYear: older ? Y - s.k : Y + s.k,
      age: ownAge,
      state: stateOf(gone, independent, home),
      sibKind: siblingKindOf(older, gender),
      older,
    };
    if (independent) person.independent = true;
    return person;
  };
  f.o.forEach((s, i) => {
    const p = sibling(SIB_O[i], s, true);
    if (p !== null) people.push(p);
  });
  f.y.forEach((s, j) => {
    const p = sibling(SIB_Y[j], s, false);
    if (p !== null) people.push(p);
  });

  // 형제 수 (K1): 태어났고 떠나지 않은 위·아래 형제 전원 — 독립 여부 무관
  const sibs = people.filter((p) => p.role === 'sibling');
  const livingOlder = sibs.filter((p) => p.older === true && p.state !== 'gone').length;
  const livingYounger = sibs.filter((p) => p.older === false && p.state !== 'gone').length;

  const withIds = new Set(people.filter((p) => p.state === 'with').map((p) => p.id));
  const household = displayOrder(people).filter((id) => withIds.has(id));

  const bothParentsGone = people.filter((p) => p.role === 'mother' || p.role === 'father').every((p) => p.state === 'gone');
  const pets: FamilyView['pets'] = [];
  for (const [flag, species] of [['pet_dog', 'dog'], ['pet_cat', 'cat'], ['pet_other', 'other']] as const) if (flags.includes(flag)) pets.push({ species, name: '', since: null });

  return {
    age,
    calYear,
    people,
    siblingCount: { older: livingOlder, younger: livingYounger, living: livingOlder + livingYounger, total: sibs.length },
    household,
    pets: pets.slice(0, 2),
    parentsGone: parentsGoneFlag || bothParentsGone,
  };
}

/** 그림·한 줄의 사람 순서 (왼쪽부터): 조부 · 조모 · 아버지 · 어머니 · 손위 형제(먼 쪽부터) · 손아래 형제 · 배우자 · 자녀 (family-scene.md 3절) */
function displayOrder(people: readonly Person[]): PersonId[] {
  const rank = (p: Person): number => {
    switch (p.id) {
      case 'pgf':
      case 'mgf':
        return 0;
      case 'pgm':
      case 'mgm':
        return 1;
      case 'father':
        return 2;
      case 'mother':
        return 3;
      default:
        return p.role === 'sibling' ? (p.older === true ? 4 : 5) : p.role === 'spouse' ? 6 : 7;
    }
  };
  const tie = (p: Person): number => (p.role === 'sibling' && p.older === true ? -p.age : p.role === 'grandparent' ? (p.id === 'pgf' || p.id === 'pgm' ? 0 : 1) : 0);
  return [...people].sort((a, b) => rank(a) - rank(b) || tie(a) - tie(b)).map((p) => p.id);
}

/** 함께 사는 사람 (주인공 제외, 그림 순서) */
export function householdOf(view: FamilyView): Person[] {
  const byId = new Map(view.people.map((p) => [p.id, p]));
  return view.household.map((id) => byId.get(id)!);
}

/** 형제 수의 새 정의 하나 (K1): 태어났고 떠나지 않은 위·아래 형제 전원 */
export function livingSiblingCount(game: FamilyGame): number {
  return familyViewOf(game).siblingCount.living;
}

// ---------- 그림 상태 (8절) ----------

/** 한 사람이 「함께 사는 사람」이었는가를 나이 하나 앞의 보기에서 찾는다 */
function wasWith(prev: FamilyView, id: PersonId): boolean {
  return prev.household.includes(id);
}

/**
 * FM5 그림이 먼저 읽는 최소 가족 상태. 식구 구성(`members`)·조부모 동거·형제(위·아래·독립·별세)·부모 별세·이혼은 채워지고, 집 종류·방 수는 묶음 B 표가 오기 전이라 `null`(그림은 점유 형태 기본 모양),
 * 반려동물은 사건이 켠 `pet_*` 플래그만 읽는다(부모 집 반려동물 유무는 묶음 D 뒤). 배우자·자녀(성인기 식구 자리)·이사·시대 변화는 FM4b/FM4c — `changed`에도 아직 없다.
 */
export function sceneFamilyOf(game: FamilyGame): SceneFamilyState {
  const view = familyViewOf(game);
  const byId = new Map(view.people.map((p) => [p.id, p]));
  const all = view.household.map((id) => byId.get(id)!);
  const members: SceneMember[] = [];
  // 8명(주인공 포함)을 넘으면 낮은 쪽부터 뺀다: 아래 동생(어린 쪽부터) → 위 형제(먼 쪽부터) → 조부모. 부모는 마지막까지 남긴다
  const drop = new Set<PersonId>();
  let overflow = Math.max(0, all.length - SCENE_MEMBER_MAX);
  if (overflow > 0) {
    const order: Person[] = [
      ...all.filter((p) => p.role === 'sibling' && p.older === false).sort((a, b) => a.age - b.age),
      ...all.filter((p) => p.role === 'sibling' && p.older === true).sort((a, b) => b.age - a.age),
      ...all.filter((p) => p.role === 'grandparent').reverse(),
    ];
    for (const p of order) {
      if (overflow === 0) break;
      drop.add(p.id);
      overflow--;
    }
  }
  const dropped = drop.size;
  for (const p of all) {
    if (drop.has(p.id)) continue;
    members.push({ id: p.id, role: p.role === 'mother' || p.role === 'father' ? 'parent' : p.role, gender: p.gender, age: p.age });
  }

  const changed: SceneChange[] = [];
  if (game.age > 0) {
    const prev = familyViewOf(game, game.age - 1);
    const prevById = new Map(prev.people.map((p) => [p.id, p]));
    for (const p of view.people) {
      const before = prevById.get(p.id);
      if (before === undefined) {
        if (p.role === 'sibling' && p.state !== 'gone') changed.push('sib-born');
        continue;
      }
      // 형제가 독립한 때: 독립 나이를 넘긴 해 (주인공이 스무 살이 되어 집을 나서는 것은 아래 `independent`가 따로 알린다)
      if (p.role === 'sibling' && p.independent === true && before.independent !== true && p.state !== 'gone' && wasWith(prev, p.id)) {
        changed.push('sib-left');
        continue;
      }
      if (before.state === p.state) continue;
      if (p.role === 'sibling' && p.state === 'gone') changed.push('sib-gone');
      else if (p.role === 'grandparent' && p.state === 'gone' && wasWith(prev, p.id)) changed.push('gp-gone');
      else if ((p.role === 'mother' || p.role === 'father') && p.state === 'gone' && wasWith(prev, p.id)) changed.push('parent-gone');
      else if ((p.role === 'mother' || p.role === 'father') && p.state === 'apart' && wasWith(prev, p.id) && game.age < FAMILY_ADULT_AGE) changed.push('parents-apart');
    }
    if (game.age === FAMILY_ADULT_AGE && game.assets !== null && game.assets.dwelling !== 'family') changed.push('independent');
  }

  return {
    calYear: view.calYear,
    me: { age: game.age, gender: game.character!.gender },
    members,
    overflow: dropped,
    housing: game.birthReport!.housing,
    dwelling: game.assets?.dwelling ?? null,
    homeKind: null,
    rooms: null,
    pets: view.pets.map((p) => ({ species: p.species, place: 'indoor' as const })),
    changed,
  };
}
