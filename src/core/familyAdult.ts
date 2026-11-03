import type { EventDef, EventPool } from './events';
import { FAMILY_TAG, type FamilyData, type PersonId } from './familyModel';
import { NAME_KEY, NameBook, pickSurname, rollFamilyNames, type FamilyNames } from './familyNames';
import { famHash01, famSeedOf } from './familyRng';
import { eventPool, familyTables } from './gameData';
import { peersOf } from './peers';
import type { Effects, Gender, GameState } from './types';

/**
 * 성인기 식구 (SPEC-009 FC5·FC6·FC9, 설계 문서 10절 FM6 확장): 배우자 · 자녀 각각 · 가까운 친구.
 * **저장도 로그도 쓰지 않는다** — 기존 플래그(`married`·`has_partner`·`divorced`·`has_child`·`close_friend`)와 사건을 본 나이(`seen`), 판 시드에서 **다시 계산하는 순수 함수**다(같은 상태 → 같은 식구, 새로고침 동일).
 * 자녀의 **인생 사건은 만들지 않고**(나이에 따른 상태만) 자녀 수는 **표시 전용**이다 — 경제는 `has_child` 참/거짓만 읽는다(K1, `core/economy.ts#livingEquivalent`). 난수는 `famHash01`뿐이라 진행 RNG를 쓰지 않는다.
 *
 * 언제 생기는가(`at` = 주인공 나이): 그 플래그를 켜는 사건(풀의 `setFlags`로 찾는다 — 사건 id를 코드에 박지 않는다)을 본 나이다.
 *  - 첫 자녀: `child_late`가 켜진 판은 마지막으로 본 사건(미뤘다가 낳은 사건), 아니면 처음 본 사건. 둘째 이후는 터울 2~5살씩(설계값), 주인공 45세까지.
 *  - 친구: 처음 본 사건(이후 같은 플래그를 켜는 사건이 더 나와도 처음 만난 나이가 그대로다).
 *  - 배우자: 만남(`has_partner`)이나 혼인(`married`)을 켜는 사건 중 처음 본 나이. 호칭은 「배우자」(K11 — 이름·그림은 혼인 통계가 집계하는 이성 부부, 이성 성별).
 * 이름은 `NameBook`이 사람마다 앞서 생긴 식구(가족·주인공·또래 포함)와 겹치지 않게 준다. 직업 줄·사이는 `familyCard.ts`가 붙인다.
 */

export type AdultId = 'spouse' | 'c1' | 'c2' | 'c3' | 'c4' | 'f1' | 'f2' | 'f3';

export interface AdultSlot {
  id: AdultId;
  role: 'spouse' | 'child' | 'friend';
  gender: Gender;
  name: string;
  birthYear: number;
  /** 주인공 나이: 자녀는 태어난 나이, 배우자·친구는 처음 만난 나이 */
  at: number;
}

export type AdultSource = Pick<GameState, 'age' | 'flags' | 'seen' | 'birthReport' | 'character' | 'peerSeed' | 'seed'> & { family?: FamilyData };

// ---------- 플래그를 켜는 사건 찾기 (풀에서 — 코드에 사건 id를 박지 않는다) ----------

interface FlagIndex {
  setters: Map<string, string[]>;
  requirers: Map<string, string[]>;
}
const indexCache = new WeakMap<EventPool, FlagIndex>();

function effectsOf(ev: EventDef): Effects[] {
  const out: Effects[] = [];
  if (ev.effects !== undefined) out.push(ev.effects);
  for (const b of ev.bonuses ?? []) out.push(b.effects);
  for (const c of ev.choices ?? []) {
    if (c.effects !== undefined) out.push(c.effects);
    for (const b of c.bonuses ?? []) out.push(b.effects);
  }
  return out;
}

function flagIndexOf(pool: EventPool): FlagIndex {
  const hit = indexCache.get(pool);
  if (hit !== undefined) return hit;
  const setters = new Map<string, string[]>();
  const requirers = new Map<string, string[]>();
  const push = (m: Map<string, string[]>, flag: string, id: string): void => {
    const list = m.get(flag);
    if (list === undefined) m.set(flag, [id]);
    else if (!list.includes(id)) list.push(id);
  };
  for (const ev of pool.events) {
    for (const e of effectsOf(ev)) for (const f of e.setFlags ?? []) push(setters, f, ev.id);
    for (const f of ev.conditions?.flags ?? []) push(requirers, f, ev.id);
  }
  const built = { setters, requirers };
  indexCache.set(pool, built);
  return built;
}

/** 이 플래그를 켜는 사건 중 이미 본 것의 주인공 나이들 (오름차순) */
function seenAges(game: Pick<AdultSource, 'seen' | 'age'>, ids: readonly string[] | undefined): number[] {
  return (ids ?? [])
    .map((id) => game.seen[id])
    .filter((a): a is number => typeof a === 'number' && a <= game.age)
    .sort((a, b) => a - b);
}

/** 어떤 플래그를 켜는 사건을 가장 나중에 본 주인공 나이 (없으면 undefined) — 그 플래그가 막 켜졌다면 그 사건이 켠 것이다 (부모의 별세 나이를 알 때 쓴다) */
export function latestSetterAge(game: Pick<AdultSource, 'seen' | 'age'>, flag: string): number | undefined {
  const ages = seenAges(game, flagIndexOf(eventPool()).setters.get(flag));
  return ages.length === 0 ? undefined : ages[ages.length - 1];
}

// ---------- 설계값 ----------

/** 배우자와의 나이 차(남편 − 아내) 가중: `FATHER_GAP`(−4~15)과 같은 모양 — 봉우리 2.5살, 퍼짐 3.5 (설계값) */
function spouseGap(famSeed: number, gap: { min: number; max: number; peak: number; spread: number }): number {
  const ws: number[] = [];
  for (let g = gap.min; g <= gap.max; g++) ws.push(Math.exp(-0.5 * ((g - gap.peak) / gap.spread) ** 2));
  let x = famHash01(famSeed, FAMILY_TAG.ADULT, 1, 0) * ws.reduce((a, b) => a + b, 0);
  for (let i = 0; i < ws.length; i++) {
    x -= ws[i];
    if (x < 0) return gap.min + i;
  }
  return gap.max;
}

function childCountOf(famSeed: number, firstBirthYear: number): number {
  const rows = familyTables().design.adult.value.childCount;
  const w = (rows.find((r) => firstBirthYear <= r.upTo) ?? rows[rows.length - 1]).weights;
  let x = famHash01(famSeed, FAMILY_TAG.ADULT, 2, 0) * w.reduce((a, b) => a + b, 0);
  for (let i = 0; i < w.length; i++) {
    x -= w[i];
    if (x < 0) return i + 1;
  }
  return w.length;
}

// ---------- 이름 규칙에 쓰는 식구 이름 ----------

/** 저장된 식구 이름. 이름 없는 구성(시험이 손으로 만든 것 · 이름이 생기기 전의 저장)은 같은 규칙으로 다시 만든다 — 저장하지 않는다 */
const rebuilt = new WeakMap<FamilyData, FamilyNames>();

export function namesOfFamily(game: AdultSource, family: FamilyData): FamilyNames {
  const stored = family.p.every((p) => p.n !== undefined) && family.g.every((g) => g.n !== undefined) && family.o.every((s) => s.n !== undefined) && family.y.every((s) => s.n !== undefined);
  if (stored) return { p: [family.p[0].n!, family.p[1].n!], g: family.g.map((g) => g.n!) as FamilyNames['g'], o: family.o.map((s) => s.n!), y: family.y.map((s) => s.n!) };
  const hit = rebuilt.get(family);
  if (hit !== undefined) return hit;
  const { character, birthReport } = game;
  if (character === null || birthReport === null) throw new Error('namesOfFamily: 출생 전 상태에는 가족이 없다');
  const made = rollFamilyNames(famSeedOf(game.peerSeed ?? game.seed), {
    birthYear: character.birthYear,
    name: character.name,
    report: birthReport,
    avoid: avoidNamesOf(game),
    g: family.g,
    o: family.o,
    y: family.y,
  });
  rebuilt.set(family, made);
  return made;
}

const peerCache = new Map<string, string[]>();
/** 주인공과 또래(VP3)의 전체 이름 — 가족 이름이 피해야 하는 것 */
export function avoidNamesOf(game: Pick<AdultSource, 'character' | 'birthReport' | 'peerSeed'>): string[] {
  const { character, birthReport } = game;
  if (character === null) return [];
  if (game.peerSeed === null || birthReport === null) return [character.name];
  const key = `${game.peerSeed}|${character.birthYear}|${birthReport.month}|${character.name}`;
  const hit = peerCache.get(key);
  if (hit !== undefined) return hit;
  const names = [character.name, ...peersOf(game.peerSeed, character.birthYear, birthReport.month, character.name).map((p) => p.name)];
  if (peerCache.size > 400) peerCache.clear();
  peerCache.set(key, names);
  return names;
}

// ---------- 계획 ----------

interface PlanSlot {
  id: AdultId;
  role: AdultSlot['role'];
  gender: Gender;
  birthYear: number;
  at: number;
  /** 같은 `at`일 때의 순서: 배우자 · 자녀 · 친구 */
  rank: number;
  key: number;
}

const planCache = new Map<string, AdultSlot[]>();

/**
 * 지금 있는 성인기 식구 (순서: 배우자 → 자녀 → 친구). `family`는 그 판의 가족 구성(이름이 겹치지 않게 피할 식구 이름의 출처).
 * 플래그가 하나도 없으면 사건 풀도 부르지 않고 빈 목록이다(어린 시절 상태·풀이 아직 없는 시험 상태).
 */
export function adultSlotsOf(game: AdultSource, family: FamilyData): AdultSlot[] {
  const { flags, character, birthReport } = game;
  if (character === null || birthReport === null) return [];
  const has = (f: string): boolean => flags.includes(f);
  const spouseOn = has('married') || has('has_partner') || has('divorced');
  const childOn = has('has_child');
  // 학령 전에는 친구를 잃는 사건을 본 적이 없다 — 사건 풀을 부르지 않고 끝낸다
  if (!spouseOn && !childOn && !has('close_friend') && game.age < 8) return [];
  const idx = flagIndexOf(eventPool());
  // 친구: 지금 켜져 있거나, 그 플래그를 요구하는 사건(친구를 잃는 사건 등)을 본 적이 있으면 있었던 것이다
  const friendEver = has('close_friend') || seenAges(game, idx.requirers.get('close_friend')).length > 0;
  if (!spouseOn && !childOn && !friendEver) return [];

  const famSeed = famSeedOf(game.peerSeed ?? game.seed);
  const Y = character.birthYear;
  const design = familyTables().design.adult.value;
  const plans: PlanSlot[] = [];

  if (spouseOn) {
    const ages = seenAges(game, [...(idx.setters.get('has_partner') ?? []), ...(idx.setters.get('married') ?? [])]);
    const at = ages[0] ?? Math.min(game.age, design.fallbackAt.spouse);
    const gap = spouseGap(famSeed, design.spouseGap);
    // 처음 만난 해에 배우자는 어른이다 (R-573). `at`은 처음 본 사건의 나이라 실제 만남보다 늦지 않다 — 안전한 쪽
    const birthYear = Math.min(character.gender === 'male' ? Y + gap : Y - gap, Y + at - design.spouseMinAge);
    plans.push({ id: 'spouse', role: 'spouse', gender: character.gender === 'male' ? 'female' : 'male', birthYear, at, rank: 0, key: NAME_KEY.spouse });
  }
  if (childOn) {
    const ages = seenAges(game, idx.setters.get('has_child'));
    const at1 = ages.length === 0 ? Math.min(game.age, design.fallbackAt.child) : has('child_late') ? ages[ages.length - 1] : ages[0];
    const total = childCountOf(famSeed, Y + at1);
    let at = at1;
    for (let j = 0; j < total; j++) {
      if (j > 0) at += design.childGap.min + Math.floor(famHash01(famSeed, FAMILY_TAG.ADULT, 10 + j, 1) * (design.childGap.max - design.childGap.min + 1));
      if (at > game.age || (j > 0 && at > design.childLastAge)) break;
      plans.push({ id: `c${j + 1}` as AdultId, role: 'child', gender: famHash01(famSeed, FAMILY_TAG.ADULT, 10 + j, 2) < 0.5 ? 'male' : 'female', birthYear: Y + at, at, rank: 1, key: NAME_KEY.child(j) });
    }
  }
  if (friendEver) {
    const ages = seenAges(game, [...(idx.setters.get('close_friend') ?? []), ...(idx.requirers.get('close_friend') ?? [])]);
    const at = ages[0] ?? Math.min(game.age, design.fallbackAt.friend);
    const r = famHash01(famSeed, FAMILY_TAG.ADULT, 3, 0);
    let n = 1;
    let acc = 0;
    for (let i = 0; i < design.friendCount.length; i++) {
      acc += design.friendCount[i];
      if (r < acc) {
        n = i + 1;
        break;
      }
      n = i + 1;
    }
    for (let j = 0; j < n; j++) {
      const off = design.friendAgeOffset.min + Math.floor(famHash01(famSeed, FAMILY_TAG.ADULT, 20 + j, 1) * (design.friendAgeOffset.max - design.friendAgeOffset.min + 1));
      plans.push({ id: `f${j + 1}` as AdultId, role: 'friend', gender: famHash01(famSeed, FAMILY_TAG.ADULT, 20 + j, 2) < 0.5 ? 'male' : 'female', birthYear: Y + off, at, rank: 2, key: NAME_KEY.friend(j) });
    }
  }
  if (plans.length === 0) return [];

  const fam = namesOfFamily(game, family);
  const cacheKey = `${famSeed}|${character.name}|${[...fam.p, ...fam.g, ...fam.o, ...fam.y].join(',')}|${plans.map((p) => `${p.id}:${p.gender[0]}${p.birthYear}@${p.at}`).join(',')}`;
  const hit = planCache.get(cacheKey);
  if (hit !== undefined) return hit;

  // 이름: 만들어진 순서(나이 → 배우자·자녀·친구)대로 장부에 적어, 뒤에 생긴 식구가 앞선 식구와 겹치지 않게 한다
  const book = new NameBook(famSeed, avoidNamesOf(game));
  for (const n of [...fam.p, ...fam.g, ...fam.o, ...fam.y]) book.take(n);
  const S = character.name.slice(0, 1);
  const names = new Map<AdultId, string>();
  // 배우자의 성: 배우자가 먼저 이름을 받든 나중에 받든 같은 값이다(아이는 아버지의 성을 따르므로 여자 주인공의 자녀는 이 성)
  const spouseSurname = pickSurname(famSeed, NAME_KEY.spouse, [S]);
  for (const p of [...plans].sort((a, b) => a.at - b.at || a.rank - b.rank || a.key - b.key)) {
    let surname: string;
    if (p.role === 'spouse') surname = spouseSurname;
    else if (p.role === 'child') surname = character.gender === 'male' ? S : spouseSurname;
    else surname = pickSurname(famSeed, p.key);
    names.set(p.id, book.give(p.key, surname, p.birthYear, p.gender));
  }
  // 순서: 배우자 → 자녀 → 친구
  const out = plans.sort((a, b) => a.rank - b.rank || a.key - b.key).map((p): AdultSlot => ({ id: p.id, role: p.role, gender: p.gender, name: names.get(p.id)!, birthYear: p.birthYear, at: p.at }));
  if (planCache.size > 2000) planCache.clear();
  planCache.set(cacheKey, out);
  return out;
}

/** 자녀·배우자의 `PersonId` (그림·카드가 쓰는 id) */
export const adultPersonId = (id: AdultId): PersonId | null => (id === 'spouse' || /^c[1-4]$/.test(id) ? (id as PersonId) : null);
