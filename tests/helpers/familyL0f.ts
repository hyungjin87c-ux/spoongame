import {
  CHILD_APART_MIN_AGE,
  DIVORCE_AGES,
  EARLY_LOSS_MAX_AGE,
  FAMILY_ADULT_AGE,
  FAMILY_AGE_CAP,
  FAMILY_DATA_VERSION,
  FAMILY_MAX_AGE,
  FAMILY_MAX_CHILDREN,
  FAMILY_SALT,
  FAMILY_TAG,
  GENERATION_IDS,
  GRAND_COHABIT_UNTIL,
  LOG_GRAND_GONE,
  LOG_PARENT_GONE,
  LOG_PARENTS_APART,
  LOG_PET_IN,
  LOG_PET_OUT,
  LOG_SIB_BORN,
  LOG_SIB_LEFT,
  LOG_SIB_LOST,
  MOTHER_BIRTH_MAX,
  NAME_KEY,
  NO_DEATH_PLAN,
  PARENT_GONE_MIN_AGE,
  YOUNGER_MOTHER_MAX,
  adultSlotsOf,
  childLeaveAgeOf,
  createInitialState,
  eventPool,
  familyNamePool,
  familyScheduleOf,
  familyTables,
  familyViewOf,
  flagRequirersOf,
  flagSettersOf,
  generateBirthFromSeed,
  namesApi,
  type FamilyData,
  type FamilySchedule,
  type FamilyView,
  type GameState,
  type Person,
  type ProfileId,
} from '../../src/core';
import { SIBLING_GAP, THIRD_PLUS_SPLIT } from '../../src/data/birthReportTable';
import { fnv, spreadSeeds } from './familyGolden';

/**
 * L0F 가족 골든의 표본·투영·직렬화 (SPEC-009 K6 직전, TODO 「L0F 가족 골든」 · FS2 예외 ①). 시험(`tests/familyGolden.test.ts`)과 다시 만드는 스크립트(`scripts/familyL0fGolden.ts`)가 같은 이 파일을 쓴다 —
 * **이 파일과 시험은 골든 파일을 쓰지 않는다.** 쓰는 곳은 스크립트 하나(`npm run golden:family -- --write`)뿐이다. 무엇이 어떻게 걸리는지는 `tests/familyGolden.test.ts` 머리 주석에 있다.
 *
 * 구성 (`tests/fixtures/family-golden.json`):
 *  - `tables`: 표·상수·이름 풀의 지문 — 표본이 지나지 않는 값도 고쳐지면 알아챈다(아래 「표 지문」).
 *  - `births`: 7세대 × 시드 — 출생 때 `family` 저장값 전체(부모·조부모·형제 구성·이름·집) + 파생 계획(`familyScheduleOf`의 부모 별세·이혼·형제 별세 Q3·조부모 별세, `childLeaveAgeOf`) + 대표 나이의 가족 보기 요약.
 *  - `adult`: 7세대 × 시드 × 시나리오 — 고정 `seen`·플래그로 `adultSlotsOf`가 돌려주는 성인기 식구(역할·이름·성별·출생 연도·`at`).
 *  - `wiring`: 성인기 식구 계산이 사건 풀에서 읽는 배선(어느 사건이 `has_partner`·`married`·`has_child`·`close_friend`·`parents_gone`을 켜고, 어느 사건이 `close_friend`를 요구하는가).
 * 모든 값은 시드·고정 입력의 순수 계산이다(시간·환경·난수 상태에 기대지 않는다). 실제 이름 풀과 실제 사건 풀을 읽는다.
 */

/** 갱신 규칙 한 문단 — 골든 파일 머리(`updateRule`)와 시험 머리 주석이 같은 뜻을 담는다. 시험이 파일의 문장과 이 상수가 같은지 본다 */
export const L0F_UPDATE_RULE =
  '갱신 규칙(One-way): 공개 배포(K6) 뒤에 이 골든을 다시 만드는 것은 이어하던 판의 가족이 바뀌는 One-way 변경이다 — 가족 값 대부분(부모 별세·이혼 계획, 형제 별세, 자녀 독립 나이, 성인기 식구의 이름·출생 연도·at)은 저장하지 않고 출생 때 해시와 표에서 다시 계산하기 때문이다. ' +
  '그래서 다시 만들기 전에 마스터 승인과 형진 님 확인이 필요하다. 성인 식구 표(이름 풀·design.adult·NAME_KEY·성인 플래그를 켜는 사건)를 바꿀 때는 SPEC-009 FS2 예외 ③대로 「로드 때 family.ad 스냅샷」을 먼저 한 번 배포한다. ' +
  '다시 만드는 명령은 이 한 곳뿐이다: npm run golden:family -- --write (--write 없이 돌리면 쓰지 않고 달라진 칸만 알려 준다). 시험은 이 파일을 절대 쓰지 않는다. 이 골든은 알아채는 장치일 뿐 이미 저장된 판을 지켜 주지는 못한다.';

// ---------------------------------------------------------------- 표본

/** 가족 값 골든의 대표 나이 (0·1·7·19·20·40·65) */
export const L0F_AGES = [0, 1, 7, 19, 20, 40, 65] as const;
/** 세대마다 도는 퍼진 시드 수 (`spreadSeeds(n, 세대 번호)` — 장면 골든과 같은 시드 열의 앞쪽) */
export const L0F_SPREAD_SEEDS = 3;
/** 성인기 식구 골든이 세대마다 도는 시드 수 (퍼진 시드의 앞쪽) */
export const L0F_ADULT_SEEDS = 3;

export interface FeatureSeed {
  gen: ProfileId;
  seed: number;
  /** 이 판을 넣은 까닭이 되는 가지(의 이름) — 퍼진 시드로는 잘 안 닿는 가지(이혼·형제 별세·0세 해 별세 이동) */
  tag: string;
}

/**
 * 가지를 일부러 채우는 고정 시드. `scripts/familyL0fGolden.ts --scan`이 후보를 찾아 주고, 여기에 손으로 옮긴다 — 시험이 도는 시드는 늘 이 목록과 퍼진 시드뿐이다.
 * 규칙·표를 바꿔 이 판들의 가지가 사라지면 시험의 「가지 덮기」가 실패하므로 `--scan`으로 다시 고른다(그것도 One-way 갱신의 일부다).
 */
export const L0F_FEATURE_SEEDS: readonly FeatureSeed[] = [
  { gen: 'industrial', seed: 87, tag: 'loss-o' },
  { gen: 'industrial', seed: 41, tag: 'gone-moved' },
  { gen: 'boomer', seed: 16, tag: 'loss-y' },
  { gen: 'g86', seed: 126, tag: 'loss-o' },
  { gen: 'genx', seed: 57, tag: 'div-m' },
  { gen: 'genx', seed: 123, tag: 'div-f' },
  { gen: 'genz', seed: 26, tag: 'div-f' },
  { gen: 'alpha', seed: 32, tag: 'div-m' },
  { gen: 'millennial', seed: 747, tag: 'gone-moved' },
];

/** 가지 이름 → 설명. 시험(「골든 안에 모든 가지가 있다」)이 이 목록 전부를 요구한다 */
export const L0F_REQUIRED_TAGS: Readonly<Record<string, string>> = {
  'div-m': '부모 이혼 — 어머니가 떠남',
  'div-f': '부모 이혼 — 아버지가 떠남',
  'loss-o': '어린 형제의 이른 별세(Q3) — 위 형제',
  'loss-y': '어린 형제의 이른 별세(Q3) — 아래 동생',
  'gone1-m': '19세 이하에 어머니가 먼저 떠남',
  'gone1-f': '19세 이하에 아버지가 먼저 떠남',
  'gone-moved': '0세 해 별세가 1세 해로 옮겨진 판(R-618) — 별세 나이 d + 1',
  'cohab1': '친가 조부모와 함께 삶',
  'cohab2': '외가 조부모와 함께 삶',
  'sib-y3': '아래 동생 3명 이상',
  'sib-o2': '위 형제 2명 이상',
  'gp-before': '주인공이 태어나기 전에 떠난 조부모',
};

export interface L0fKey {
  gen: ProfileId;
  seed: number;
  key: string;
}

const keyOf = (gen: ProfileId, seed: number): string => `${gen}/${seed}`;

/** 가족 값 골든의 판 목록: 세대별 퍼진 시드 → 가지 시드(중복 없이) */
export function l0fSample(): L0fKey[] {
  const out: L0fKey[] = [];
  const seen = new Set<string>();
  const add = (gen: ProfileId, seed: number): void => {
    const key = keyOf(gen, seed);
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ gen, seed, key });
  };
  GENERATION_IDS.forEach((gen, gi) => {
    for (const seed of spreadSeeds(L0F_SPREAD_SEEDS, gi)) add(gen, seed);
  });
  for (const f of L0F_FEATURE_SEEDS) add(f.gen, f.seed);
  return out;
}

/** 성인기 식구 골든의 판 목록: 세대별 퍼진 시드의 앞쪽 */
export function l0fAdultSample(): L0fKey[] {
  return GENERATION_IDS.flatMap((gen, gi) => spreadSeeds(L0F_ADULT_SEEDS, gi).map((seed) => ({ gen, seed, key: keyOf(gen, seed) })));
}

// ---------------------------------------------------------------- 판 만들기

/** 출생 직후의 판 (장면 골든 `gameOf`와 같은 모양): 플래그 없음, 가족은 출생 때 저장값 그대로 */
export function bornGame(seed: number, gen: ProfileId): GameState {
  const b = generateBirthFromSeed(seed, gen);
  return { ...createInitialState(seed), phase: 'life', generation: gen, character: b.character, birthReport: b.report, peerSeed: b.peerSeed, family: b.family } as GameState;
}

/** 대표 나이의 판: 20세부터는 가족 집(독립 전) — 장면 골든의 `at`과 같다 */
const atAge = (g: GameState, age: number): GameState => ({ ...g, age, assets: age >= 20 ? { net: 0, income: 0, debt: 0, incomeAdj: 0, dwelling: 'family' } : null }) as GameState;

// ---------------------------------------------------------------- 가족 값 투영

const fin = (n: number): string => (Number.isFinite(n) ? String(n) : '∞');

/** 파생 계획 한 줄 (읽기 쉬운 글): 부모·조부모 출생 연도, 부모 별세(주인공 나이·별세 나이 N·먼저 떠나는 분), 이혼, 형제 별세(Q3), 조부모 별세, 자녀 독립 나이 */
export function planLine(s: FamilySchedule): string {
  const first = s.firstGone === null ? '-' : `${s.firstGone.who === 0 ? '모' : '부'}@${s.firstGone.at}`;
  const div = s.divorce === null ? '-' : `${s.divorce.leaver === 0 ? '모' : '부'}@${s.divorce.at}`;
  const loss = s.siblingLoss === null ? '-' : `${s.siblingLoss.id}@${s.siblingLoss.at}(a${s.siblingLoss.a})`;
  const kids = [0, 1, 2, 3].map((j) => childLeaveAgeOf(s.famSeed, j)).join('/');
  return `by ${s.parentBy.join('/')} · ${s.grandBy.join('/')} | gone ${s.parentGoneAt.map(fin).join('/')} own ${s.parentGoneOwn.join('/')} first ${first} | divorce ${div} | sibLoss ${loss} | grandGone ${s.grandGoneAt.map(fin).join('/')} | kidLeave ${kids}`;
}

const stateCode = (p: Person): string => (p.state === 'with' ? 'w' : p.state === 'apart' ? (p.apartBy === 'split' ? 's' : 'a') : 'g');

/** 가족 보기 요약 한 줄: 사람마다 `id + 상태(w 함께 · a 따로 · s 이혼으로 따로 · g 떠남)`, 떠난 사람은 `own/my`(떠난 때 본인 나이/그때 주인공 나이), 형제 수 위/아래/산/전체, 부모 없음 */
export function viewLine(age: number, v: FamilyView): string {
  const people = v.people.map((p) => `${p.id}${stateCode(p)}${p.state === 'gone' ? `${p.goneAtOwnAge}/${p.goneAtMyAge}` : ''}`).join(' ');
  const c = v.siblingCount;
  return `${age}|${people}|sib ${c.older}/${c.younger}/${c.living}/${c.total}${v.parentsGone ? '|부모없음' : ''}`;
}

/** 이 판이 어떤 가지를 지났는가 — 시험이 「골든 안에 모든 가지가 있다」를 보는 데 쓴다 */
export function tagsOf(family: FamilyData, s: FamilySchedule): string[] {
  const tags: string[] = [];
  if (s.divorce !== null) tags.push(s.divorce.leaver === 0 ? 'div-m' : 'div-f');
  if (s.siblingLoss !== null) tags.push(s.siblingLoss.id.startsWith('o') ? 'loss-o' : 'loss-y');
  if (s.firstGone !== null && s.firstGone.at <= 19) tags.push(s.firstGone.who === 0 ? 'gone1-m' : 'gone1-f');
  if (s.parentGoneOwn.some((own, i) => Number.isFinite(s.parentGoneAt[i]) && own !== family.p[i].d)) tags.push('gone-moved');
  if (family.c === 1) tags.push('cohab1');
  if (family.c === 2) tags.push('cohab2');
  if (family.y.length >= 3) tags.push('sib-y3');
  if (family.o.length >= 2) tags.push('sib-o2');
  if (s.grandGoneAt.some((at) => at < 0)) tags.push('gp-before');
  return tags;
}

export interface FamilyCell {
  head: string;
  tags: string;
  family: FamilyData;
  plan: string;
  view: string[];
}

export function familyCell(seed: number, gen: ProfileId): FamilyCell {
  const g = bornGame(seed, gen);
  const s = familyScheduleOf(g);
  const c = g.character!;
  const r = g.birthReport!;
  return {
    head: `${c.name} ${c.gender === 'male' ? '남' : '여'} ${c.birthYear}년생 · 어머니 ${r.mother.age}세 아버지 ${r.father.age}세 · ${r.birthOrder}째 · famSeed ${s.famSeed}`,
    tags: tagsOf(s.family, s).join(' '),
    family: s.family,
    plan: planLine(s),
    view: L0F_AGES.map((age) => viewLine(age, familyViewOf(atAge(g, age)))),
  };
}

export function familyGolden(): Record<string, FamilyCell> {
  const out: Record<string, FamilyCell> = {};
  for (const { gen, seed, key } of l0fSample()) out[key] = familyCell(seed, gen);
  return out;
}

// ---------------------------------------------------------------- 성인기 식구 투영 (조건 ①)

export interface AdultScenario {
  id: string;
  /** 판의 주인공 나이 (`adultSlotsOf`는 이 나이까지 태어난 자녀만 돌려준다) */
  age: number;
  flags: string[];
  /** 사건 id → 그 사건을 본 주인공 나이. 실제 풀의 사건 id를 글자 그대로 적는다 — 풀에서 id가 바뀌거나 그 플래그를 더는 켜지 않으면 결과가 달라져 시험이 알아챈다 */
  seen: Record<string, number>;
}

/** 시나리오: 플래그 `has_partner`·`married`·`divorced`·`has_child`·`child_late`·`close_friend`와 본 사건의 나이를 고정한다 */
export const ADULT_SCENARIOS: readonly AdultScenario[] = [
  { id: 'partner', age: 40, flags: ['has_partner'], seen: { 'youth-meeting': 23 } },
  { id: 'ex', age: 50, flags: ['divorced'], seen: { 'youth-marriage': 26, 'middle-marriage-crisis': 44 } },
  { id: 'kids', age: 70, flags: ['married', 'has_child'], seen: { 'youth-marriage': 25, 'youth-child': 27 } },
  { id: 'young', age: 33, flags: ['married', 'has_child'], seen: { 'youth-marriage': 29, 'youth-child': 31 } },
  { id: 'late', age: 80, flags: ['child_late', 'close_friend', 'has_child', 'married'], seen: { 'youth-marriage': 28, 'youth-child': 30, 'youth-child-again': 36, 'school-friend': 13 } },
  { id: 'friend', age: 25, flags: ['close_friend'], seen: { 'school-friend': 12 } },
  { id: 'faded', age: 60, flags: ['married'], seen: { 'youth-marriage': 28, 'school-friend': 13, 'youth-friend-wedding': 30 } },
  { id: 'bare', age: 50, flags: ['close_friend', 'has_child', 'married'], seen: {} },
];

/** 풀 배선: 성인기 식구 계산(`familyAdult.ts`)과 가족 보기(`familyView.ts`)가 사건 풀에서 읽는 것 — 어느 사건이 그 플래그를 켜는가(`set`)·요구하는가(`req`) */
export const WIRING_READS: ReadonlyArray<{ flag: string; kind: 'set' | 'req' }> = [
  { flag: 'has_partner', kind: 'set' },
  { flag: 'married', kind: 'set' },
  { flag: 'has_child', kind: 'set' },
  { flag: 'close_friend', kind: 'set' },
  { flag: 'close_friend', kind: 'req' },
  { flag: 'parents_gone', kind: 'set' },
];

export function wiringGolden(): Record<string, string[]> {
  const pool = eventPool();
  const out: Record<string, string[]> = {};
  for (const { flag, kind } of WIRING_READS) out[`${flag}:${kind}`] = [...(kind === 'set' ? flagSettersOf(pool, flag) : flagRequirersOf(pool, flag))].sort();
  return out;
}

const SEX = (g: string): string => (g === 'male' ? '남' : '여');

/** 성인기 식구 한 줄: `역할id 이름 성별 출생연도@at` 들을 ` | `로 잇는다. 없으면 `-` */
export function adultLine(game: GameState): string {
  const slots = adultSlotsOf(game, game.family!);
  return slots.length === 0 ? '-' : slots.map((s) => `${s.id} ${s.name} ${SEX(s.gender)} ${s.birthYear}@${s.at}`).join(' | ');
}

export function adultGameOf(seed: number, gen: ProfileId, sc: AdultScenario): GameState {
  const g = bornGame(seed, gen);
  return { ...g, age: sc.age, flags: [...sc.flags].sort(), seen: { ...sc.seen } } as GameState;
}

export function adultGolden(): Record<string, Record<string, string>> {
  const out: Record<string, Record<string, string>> = {};
  for (const { gen, seed, key } of l0fAdultSample()) {
    const row: Record<string, string> = {};
    for (const sc of ADULT_SCENARIOS) row[sc.id] = adultLine(adultGameOf(seed, gen, sc));
    out[key] = row;
  }
  return out;
}

// ---------------------------------------------------------------- 표 지문 (표본이 건드리지 않는 값도 알아챈다)

/**
 * 표본의 판들이 지나지 않는 표 값(예: 가중표의 한 칸, 안 뽑힌 이름 하나)도 고쳐지면 알아채도록, 가족 값·성인기 식구를 만드는 **표·상수·이름 풀을 직접** 얼린다.
 *  - `constants`: 해시 소금·태그·사람 번호(`NAME_KEY`)·나이 상한·계획 경계 같은 코드 상수 — 값을 그대로 적는다.
 *  - `fingerprints`: 가족 표(`family/tables.json`의 생존 곡선·어머니 나이·가구·이혼율·집)와 `FAMILY_DESIGN`의 가족 값 설계값(`adult`·`leaveAge`·`siblingLoss` …)의 지문(FNV-1a 32비트) — 한 글자만 고쳐도 지문이 바뀐다.
 *  - `namePools`: 출생 연도별 이름 풀(남·여)과 성씨 분포의 지문 — 같은 풀이 이어지는 연도는 한 줄로 묶는다.
 * 문구·사이(closeness)·반려동물·가진 것·직업 줄·이른 부모 별세 효과 수치 표는 가족 값을 바꾸지 않으므로 넣지 않는다.
 */
export interface TablesGolden {
  constants: Record<string, unknown>;
  fingerprints: Record<string, string>;
  namePools: string[];
}

const fp = (v: unknown): string => fnv(JSON.stringify(v));

/** 가족 값을 바꾸는 설계값 (`FAMILY_DESIGN`의 칸 이름) — 사이·반려동물·가진 것·이른 부모 별세 효과는 뺀다 */
const DESIGN_KEYS = ['paternalSideShare', 'divorceFatherLeaves', 'maleShare', 'leaveAge', 'continueCap', 'home', 'highOrderContinue', 'siblingLoss', 'adult'] as const;

export function tablesGolden(): TablesGolden {
  const t = familyTables();
  const design = t.design as unknown as Record<string, { value: unknown }>;
  const fingerprints: Record<string, string> = {
    mortality: fp(t.mortality),
    motherAge: fp(t.motherAge),
    household: fp(t.household),
    divorce: fp(t.divorce),
    housing: fp(t.housing),
    surnames: fp(namesApi().surnames),
  };
  for (const k of DESIGN_KEYS) fingerprints[`design.${k}`] = fp(design[k].value);

  const constants: Record<string, unknown> = {
    FAMILY_SALT,
    FAMILY_TAG,
    // family.log 종류 코드 — 저장된 로그 항목의 뜻을 정한다("코드는 바꾸지 않는다", familyModel.ts). 바꾸면 이어하던 판이 같은 변화를 다시 알린다
    LOG_KINDS: { SIB_BORN: LOG_SIB_BORN, SIB_LEFT: LOG_SIB_LEFT, SIB_LOST: LOG_SIB_LOST, GRAND_GONE: LOG_GRAND_GONE, PARENT_GONE: LOG_PARENT_GONE, PARENTS_APART: LOG_PARENTS_APART, PET_IN: LOG_PET_IN, PET_OUT: LOG_PET_OUT },
    NAME_KEY: { ...NAME_KEY, older: [0, 1, 2, 3].map(NAME_KEY.older), younger: [0, 1, 2, 3, 4, 5, 6].map(NAME_KEY.younger), child: [0, 1, 2, 3].map(NAME_KEY.child), friend: [0, 1, 2].map(NAME_KEY.friend) },
    DIVORCE_AGES,
    PARENT_GONE_MIN_AGE,
    CHILD_APART_MIN_AGE,
    GRAND_COHABIT_UNTIL,
    EARLY_LOSS_MAX_AGE,
    FAMILY_MAX_CHILDREN,
    MOTHER_BIRTH_MAX,
    YOUNGER_MOTHER_MAX,
    FAMILY_AGE_CAP,
    NO_DEATH_PLAN,
    FAMILY_MAX_AGE,
    FAMILY_ADULT_AGE,
    FAMILY_DATA_VERSION,
    SIBLING_GAP,
    THIRD_PLUS_SPLIT,
  };

  // 이름 풀: 출생 연도 1940~2020 + 2026(시험 전용 R1)마다, 같은 풀이 이어지면 한 줄로
  const namePools: string[] = [];
  const years = [...Array.from({ length: 81 }, (_, i) => 1940 + i), 2026];
  for (const gender of ['male', 'female'] as const) {
    const sigOf = (y: number): string => {
      const pool = familyNamePool(y, gender);
      return `${fnv(pool.join(','))} n${pool.length}`;
    };
    let from = years[0];
    let last = sigOf(from);
    for (let i = 1; i <= years.length; i++) {
      const sig = i < years.length ? sigOf(years[i]) : null;
      if (sig !== null && sig === last && years[i] !== 2026) continue; // 같은 풀이 이어진다(2026은 시험 전용 R1 풀이라 따로 둔다)
      namePools.push(`${gender === 'male' ? '남' : '여'} ${from}-${years[i - 1]} ${last}`);
      if (sig !== null) {
        from = years[i];
        last = sig;
      }
    }
  }
  return { constants, fingerprints, namePools };
}

// ---------------------------------------------------------------- 파일 모양

export interface L0fGolden {
  note: string;
  updateRule: string;
  meta: {
    ages: number[];
    spreadSeeds: number;
    adultSeeds: number;
    featureSeeds: FeatureSeed[];
    requiredTags: string[];
    adultScenarios: AdultScenario[];
    wiringReads: Array<{ flag: string; kind: string }>;
  };
  wiring: Record<string, string[]>;
  tables: TablesGolden;
  births: Record<string, FamilyCell>;
  adult: Record<string, Record<string, string>>;
}

export const L0F_NOTE = '가족 값 고정 골든(L0F) — scripts/familyL0fGolden.ts가 만든다. 출생 때 family 저장값·파생 계획·대표 나이 가족 보기 요약·성인기 식구(adultSlotsOf)·사건 풀 배선·표 지문(표·상수·이름 풀)을 얼린다.';

export function l0fGolden(): L0fGolden {
  return {
    note: L0F_NOTE,
    updateRule: L0F_UPDATE_RULE,
    meta: {
      ages: [...L0F_AGES],
      spreadSeeds: L0F_SPREAD_SEEDS,
      adultSeeds: L0F_ADULT_SEEDS,
      featureSeeds: L0F_FEATURE_SEEDS.map((f) => ({ ...f })),
      requiredTags: Object.keys(L0F_REQUIRED_TAGS),
      adultScenarios: ADULT_SCENARIOS.map((s) => ({ ...s, flags: [...s.flags], seen: { ...s.seen } })),
      wiringReads: WIRING_READS.map((w) => ({ ...w })),
    },
    wiring: wiringGolden(),
    tables: tablesGolden(),
    births: familyGolden(),
    adult: adultGolden(),
  };
}

/**
 * 골든 파일의 글: 큰 묶음(`meta`·`wiring`·`tables`·`births`·`adult`)은 한 줄에 한 칸씩 펼치고, 칸 안은 필드마다 한 줄(가족 저장값 `family`와 짧은 배열은 한 줄로 붙인다. `tables.constants`는 상수 하나에 한 줄).
 * 줄 단위로 읽고 git diff로 어느 판의 어느 값이 바뀌었는지 보게 한다. LF만 쓰고 사용자 경로는 넣지 않는다.
 */
export function serializeL0f(golden: L0fGolden): string {
  const LEAF = new Set(['family', 'ages', 'featureSeeds', 'requiredTags', 'adultScenarios', 'wiringReads', 'seen']);
  const emit = (v: unknown, depth: number, indent: string, key: string | null): string => {
    if (key === 'constants' && v !== null && typeof v === 'object' && !Array.isArray(v)) {
      const pad = `${indent} `;
      return `{\n${Object.entries(v)
        .map(([k, x]) => `${pad}${JSON.stringify(k)}: ${JSON.stringify(x)}`)
        .join(',\n')}\n${indent}}`;
    }
    if ((key === 'view' || key === 'namePools') && Array.isArray(v)) {
      const pad = `${indent} `;
      return `[\n${v.map((x) => `${pad}${JSON.stringify(x)}`).join(',\n')}\n${indent}]`;
    }
    if (v === null || typeof v !== 'object' || Array.isArray(v) || depth >= 4 || (key !== null && LEAF.has(key))) return JSON.stringify(v);
    const pad = `${indent} `;
    return `{\n${Object.entries(v)
      .map(([k, x]) => `${pad}${JSON.stringify(k)}: ${emit(x, depth + 1, pad, k)}`)
      .join(',\n')}\n${indent}}`;
  };
  return `${emit(golden, 0, '', null)}\n`;
}
