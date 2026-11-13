import { PARENT_STATE_LABEL } from '../data/familyText';
import { FAMILY_CARD_TEXT, CLOSENESS_LABEL, jobText, personLabel } from '../data/familyCardText';
import { adultSlotsOf } from './familyAdult';
import { closenessOf, type Closeness } from './familyCloseness';
import { drawJob, jobInfoOf, type JobInfo } from './familyJobs';
import type { Person, PersonId, PersonRole, PersonState } from './familyModel';
import { NAME_KEY } from './familyNames';
import { petsOf, type PetInfo } from './familyPets';
import { famSeedOf } from './familyRng';
import { familyViewOf, familyScheduleOf, type FamilyGame } from './familyView';
import { familyTables, type ClosenessRole } from './gameData';
import { shownPossessions } from './possessions';
import type { Gender } from './types';

/**
 * 가족과 삶 카드의 모델 (SPEC-009 FC1~FC10, FM6): **`familyViewOf`가 만든 같은 사람들**(그림·아래 한 줄·대체 글이 읽는 것)을 카드의 줄로 바꾼다 — 카드가 따로 가족을 계산하지 않는다(FA0-1).
 * 순서(FC1): 함께 사는 식구(부모 → 조부모 → 형제) → 따로 사는 가족 → 배우자·자녀 → 친구 → 반려동물 → 가진 것 → (맨 아래) 떠난 가족.
 * 카드의 사람 수(친구 제외) = 함께 사는 사람 + 따로 사는 사람 + 떠난 사람 = `FamilyView.people` 전체 (FC10, R-542 해소).
 * 순수 함수 — 문구는 `data/familyCardText.ts`, 화면은 `ui/dash/Cards.tsx#FamilyCard`.
 */

export interface CardRow {
  key: string;
  role: PersonRole | 'friend';
  /** 호칭 (어머니 · 친할머니 · 누나 · 배우자 · 아들 · 친구 …) */
  label: string;
  name: string;
  /** 지금 나이 (떠난 사람은 떠난 때 나이) */
  age: number;
  gender: Gender;
  state: PersonState;
  /** 사이 단계 (떠난 사람은 null) */
  closeness: Closeness | null;
  closenessText: string | null;
  /** 직업 줄 글자 (직업 대분류 이름 · 학생 · 은퇴 · 집안일 · 쉬는 중) — 학령 전이거나 떠났으면 null */
  jobText: string | null;
  /** 부모의 병환 표지(「병환 중」 — 병간호 사건이 켠 `cared_parents`, 옛 카드가 보이던 상태 문구). 그 밖에는 null */
  statusText: string | null;
  /**
   * 「N세에 세상을 떠남」 / 「내가 태어나기 전에 세상을 떠남(N세)」 (떠난 사람만). **만 나이(게임 나이 그대로) 기준 문장**이다 — 화면은 이 글자를 쓰지 않고
   * 아래 `goneOwnAge`·`goneMyAge`로 나이 보기(SPEC-019)에 맞춰 다시 만든다.
   */
  goneText?: string;
  /** 펼치면 붙는 「내가 M세였던 해」 (떠난 사람 중 주인공이 태어난 뒤에 떠난 분만) — 만 나이 기준 문장(위와 같다) */
  goneMyText?: string;
  /** 떠난 사람의 별세 나이(게임 나이)와 주인공이 태어나기 전에 떠났는가 / 그때 주인공의 나이(게임 나이) — 화면이 나이 보기에 맞춰 문장을 만드는 재료 */
  goneOwnAge?: number;
  goneBeforeMe?: boolean;
  goneMyAge?: number;
}

export interface CardPetRow {
  name: string;
  species: PetInfo['species'];
  speciesText: string;
  status: PetInfo['status'];
  /** 「함께 삶」 또는 「N년을 함께하고 곁을 떠남」 */
  statusText: string;
}

export interface FamilyCardModel {
  /** 함께 사는 식구: 부모 → 조부모 → 형제 */
  together: CardRow[];
  /** 따로 사는 가족: 부모 → 조부모 → 형제 */
  apart: CardRow[];
  /** 배우자 · 자녀 (함께 살든 따로 살든) */
  adult: CardRow[];
  friends: CardRow[];
  /** 떠난 가족 (부모 → 조부모 → 형제 → 배우자 → 자녀) */
  gone: CardRow[];
  pets: CardPetRow[];
  /** 집에 있는 것 (일반 명사, 최대 `displayMax`개) */
  things: string[];
  /** 접이식 근거 칸 */
  basis: ReadonlyArray<{ id: string; kind: string; note: string }>;
  counts: { people: number; together: number; apart: number; adult: number; gone: number };
}

const SIB_KEY = (id: PersonId): number => (id.startsWith('o') ? NAME_KEY.older(Number(id.slice(1)) - 1) : NAME_KEY.younger(Number(id.slice(1)) - 1));
const KEY_OF: Readonly<Record<string, number>> = { mother: NAME_KEY.mother, father: NAME_KEY.father, pgf: NAME_KEY.pgf, pgm: NAME_KEY.pgm, mgf: NAME_KEY.mgf, mgm: NAME_KEY.mgm, spouse: NAME_KEY.spouse };

function keyOf(id: string): number {
  if (KEY_OF[id] !== undefined) return KEY_OF[id];
  if (/^[oy][1-7]$/.test(id)) return SIB_KEY(id as PersonId);
  if (/^c[1-4]$/.test(id)) return NAME_KEY.child(Number(id.slice(1)) - 1);
  if (/^f[1-3]$/.test(id)) return NAME_KEY.friend(Number(id.slice(1)) - 1);
  return 99;
}

const ROLE_ORDER: Readonly<Record<string, number>> = { mother: 0, father: 1, grandparent: 2, sibling: 3, spouse: 4, child: 5 };

function orderOf(p: Person): number[] {
  // 호칭 순서 → 조부모 4자리 → 형제 (위는 가까운 순, 아래는 태어난 순)
  const gp = ['pgf', 'pgm', 'mgf', 'mgm'].indexOf(p.id);
  return [ROLE_ORDER[p.role] ?? 9, gp, p.role === 'sibling' ? (p.older === true ? 0 : 1) : 0, p.role === 'sibling' ? Number(p.id.slice(1)) : 0, p.role === 'child' ? Number(p.id.slice(1)) : 0];
}
const byOrder = (a: Person, b: Person): number => {
  const x = orderOf(a);
  const y = orderOf(b);
  for (let i = 0; i < x.length; i++) if (x[i] !== y[i]) return x[i] - y[i];
  return 0;
};

/** 가족과 삶 카드. 출생 전 상태에는 가족이 없다(throw — `familyViewOf`와 같다) */
export function familyCardOf(game: FamilyGame): FamilyCardModel {
  const view = familyViewOf(game);
  const { character, birthReport: report } = game;
  if (character === null || report === null) throw new Error('familyCardOf: 출생 전 상태에는 가족이 없다');
  const sc = familyScheduleOf(game);
  const famSeed = famSeedOf(game.peerSeed ?? game.seed);
  const player = character.gender;
  const wealth = character.parentWealth;
  const hasPartnerOnly = game.flags.includes('has_partner') && !game.flags.includes('married');
  const isExSpouse = game.flags.includes('divorced') && !game.flags.includes('married') && !game.flags.includes('has_partner');
  const closenessRole = (role: PersonRole | 'friend', id: string): ClosenessRole => (role === 'grandparent' ? 'grandparent' : role === 'mother' || role === 'father' ? role : role === 'sibling' ? 'sibling' : role === 'spouse' ? 'spouse' : role === 'child' ? 'child' : id.startsWith('f') ? 'friend' : 'friend');

  const jobOf = (p: Person): JobInfo => {
    if (p.state === 'gone') return { line: null };
    const key = keyOf(p.id);
    if (p.role === 'mother' || p.role === 'father') {
      const i = p.role === 'mother' ? 0 : 1;
      const parent = sc.family.p[i];
      return jobInfoOf({ famSeed, key, age: p.age, job: i === 0 ? report.mother.job : report.father.job, homemaker: parent.w === 1, ...(parent.r === undefined ? {} : { retireAt: parent.r }), grownUp: true });
    }
    const job = drawJob(famSeed, key, p.gender, p.birthYear, wealth);
    return jobInfoOf({ famSeed, key, age: p.age, job, grownUp: p.role === 'grandparent' });
  };

  const rowOf = (p: Person): CardRow => {
    const gone = p.state === 'gone';
    const closeness = gone ? null : closenessOf({ id: p.id, role: closenessRole(p.role, p.id) }, game);
    const job = jobOf(p);
    const row: CardRow = {
      key: p.id,
      role: p.role,
      label: p.role === 'spouse' && isExSpouse ? FAMILY_CARD_TEXT.exSpouse : personLabel(p.id, p.role, p.gender, player, p.sibKind, p.role === 'spouse' && hasPartnerOnly),
      name: p.name,
      age: p.age,
      gender: p.gender,
      state: p.state,
      closeness,
      closenessText: closeness === null ? null : CLOSENESS_LABEL[closeness],
      jobText: jobText(job.line, job.job),
      statusText: !gone && (p.role === 'mother' || p.role === 'father') && game.flags.includes('cared_parents') ? PARENT_STATE_LABEL.ill : null,
    };
    if (gone && p.goneAtOwnAge !== undefined) {
      row.goneText = p.beforeMyBirth === true ? FAMILY_CARD_TEXT.goneBeforeMe(p.goneAtOwnAge) : FAMILY_CARD_TEXT.goneAt(p.goneAtOwnAge);
      row.goneOwnAge = p.goneAtOwnAge;
      row.goneBeforeMe = p.beforeMyBirth === true;
      if (p.goneAtMyAge !== undefined && p.goneAtMyAge >= 0) {
        row.goneMyText = FAMILY_CARD_TEXT.goneMyAge(p.goneAtMyAge);
        row.goneMyAge = p.goneAtMyAge;
      }
    }
    return row;
  };

  const family = [...view.people].filter((p) => p.role !== 'spouse' && p.role !== 'child').sort(byOrder);
  const adultPeople = [...view.people].filter((p) => (p.role === 'spouse' || p.role === 'child') && p.state !== 'gone').sort(byOrder);
  const together = family.filter((p) => p.state === 'with').map(rowOf);
  const apart = family.filter((p) => p.state === 'apart').map(rowOf);
  const adult = adultPeople.map(rowOf);
  const gone = [...view.people].filter((p) => p.state === 'gone').sort(byOrder).map(rowOf);

  // 친구 (FC6): 가까운 친구 최대 3명. 가까운 친구 플래그가 꺼져 있으면 「멀어진 친구」로 남는다
  const friendOn = game.flags.includes('close_friend');
  const friends: CardRow[] = adultSlotsOf(game, sc.family)
    .filter((s) => s.role === 'friend' && s.at <= game.age)
    .map((s) => {
      const age = view.calYear - s.birthYear;
      const closeness = closenessOf({ id: s.id, role: 'friend' }, game);
      const job = jobInfoOf({ famSeed, key: keyOf(s.id), age, job: drawJob(famSeed, keyOf(s.id), s.gender, s.birthYear, wealth) });
      return {
        key: s.id,
        role: 'friend' as const,
        label: friendOn ? FAMILY_CARD_TEXT.friend : FAMILY_CARD_TEXT.friendFaded,
        name: s.name,
        age,
        gender: s.gender,
        state: 'apart' as const,
        closeness,
        closenessText: CLOSENESS_LABEL[closeness],
        jobText: jobText(job.line, job.job),
        statusText: null,
      };
    });

  const pets: CardPetRow[] = petsOf({ flags: game.flags, peerSeed: game.peerSeed, seed: game.seed, family: game.family })
    .sort((a, b) => (a.status === b.status ? a.slot - b.slot : a.status === 'with' ? -1 : 1))
    .map((p) => ({
      name: p.name,
      species: p.species,
      speciesText: FAMILY_CARD_TEXT.petSpecies[p.species],
      status: p.status,
      statusText: p.status === 'with' ? FAMILY_CARD_TEXT.petWith : FAMILY_CARD_TEXT.petGone(p.years),
    }));

  const things = shownPossessions(game).map((o) => o.name);
  const basis = familyTables().basis.map((b) => ({ id: b.id, kind: FAMILY_CARD_TEXT.basisKind[b.basis], note: b.note }));
  return {
    together,
    apart,
    adult,
    friends,
    gone,
    pets,
    things,
    basis,
    counts: { people: view.people.length, together: together.length, apart: apart.length, adult: adult.length, gone: gone.length },
  };
}
