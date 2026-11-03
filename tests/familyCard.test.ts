import { describe, expect, it } from 'vitest';
import {
  GENERATION_IDS,
  adultSlotsOf,
  closenessOf,
  familyCardOf,
  familyNamePool,
  familyTables,
  familyViewOf,
  generateBirthFromSeed,
  isNamePoolFallback,
  isRejectedName,
  jobInfoOf,
  ownedPossessions,
  ownedSince,
  petLifeYears,
  petNameOf,
  petStatusOf,
  petsOf,
  possessionRate,
  possessionTiesOf,
  retireAgeOf,
  sceneFamilyOf,
  sceneLineOf,
  sceneInputOf,
  shownPossessions,
  peersOf,
  famSeedOf,
  type FamilyData,
  type GameState,
  type ProfileId,
} from '../src/core';
import { OCCUPATION_LABEL } from '../src/data/birthReportTable';
import { EVENT_POOL } from '../src/data/events';
import { FAMILY_CARD_TEXT, CLOSENESS_LABEL, JOB_LINE_LABEL } from '../src/data/familyCardText';
import { FAMILY_BASIS } from '../src/data/familyTables';
import { startLife } from '../scripts/simulateLib';
import { spreadSeeds } from './helpers/familyGolden';

/**
 * 가족과 삶 카드의 순수 계산 (SPEC-009 FM6 — FC1~FC9, FK1·FK2): 식구 이름 · 성인기 식구(배우자·자녀·친구) · 사이(`closenessOf`) · 직업 줄 · 가진 것 · 반려동물 · 카드 모델.
 * 화면(`ui/dash/Cards.tsx`)은 이 모델을 그리기만 한다 — 줄 수·순서·문구는 여기서, 마크업·키보드는 `tests/dashboard.test.tsx`·e2e가 본다.
 */

const N = 300;

/** 지금 판의 상태를 손으로 만든다: 어릴 때 만든 판의 나이·플래그·본 사건을 고른다 (가족 구성은 그 판의 출생 때 값 그대로) */
function craft(seed: number, gen: ProfileId, over: { age: number; flags?: string[]; seen?: Record<string, number> }): GameState {
  const base = startLife(seed, gen);
  return { ...base, age: over.age, flags: [...new Set([...base.flags, ...(over.flags ?? [])])].sort(), seen: { ...base.seen, ...(over.seen ?? {}) } };
}

/** 이 플래그를 켜는 사건 */
function settersOf(flag: string): string[] {
  return EVENT_POOL.events.filter((ev) => [ev.effects, ...(ev.choices ?? []).map((c) => c.effects)].some((e) => e?.setFlags?.includes(flag))).map((ev) => ev.id);
}
const CHILD_EVENTS = settersOf('has_child');
const FRIEND_EVENTS = settersOf('close_friend');

describe('식구 이름 (FA0-6 · DF5 · DF7): 시대별 이름 풀, 성 규칙, 겹침 0', () => {
  const births = GENERATION_IDS.flatMap((gen, gi) => spreadSeeds(N, gi).map((seed) => ({ gen, seed, b: generateBirthFromSeed(seed, gen) })));

  it('모든 식구에게 이름이 있고(한글 2~5자) 주인공·또래·식구 사이에 전체 이름이 겹치지 않는다 (7세대 × 300판)', () => {
    for (const { gen, seed, b } of births) {
      const f = b.family;
      const names = [f.p[0].n, f.p[1].n, ...f.g.map((g) => g.n), ...f.o.map((s) => s.n), ...f.y.map((s) => s.n)];
      const peers = peersOf(b.peerSeed, b.character.birthYear, b.report.month, b.character.name).map((p) => p.name);
      const all = [b.character.name, ...peers, ...(names as string[])];
      expect(names.every((n) => typeof n === 'string' && /^[가-힣]{2,5}$/.test(n)), `${gen} ${seed} 이름 모양`).toBe(true);
      expect(new Set(all).size, `${gen} ${seed} 이름 겹침`).toBe(all.length);
    }
  });

  it('성 규칙(DF5): 아버지·형제자매·친할아버지 = 주인공 성, 어머니 ≠ 주인공 성이고 외할아버지는 어머니와 같은 성, 친할머니는 주인공 성과 다르고 외할머니는 외할아버지와 다르다', () => {
    for (const { gen, seed, b } of births) {
      const S = b.character.name[0];
      const f = b.family;
      const [mother, father] = [f.p[0].n!, f.p[1].n!];
      const [pgf, pgm, mgf, mgm] = f.g.map((g) => g.n!);
      const tag = `${gen} ${seed}`;
      expect(father[0], `${tag} 아버지`).toBe(S);
      expect(mother[0], `${tag} 어머니`).not.toBe(S);
      expect(pgf[0], `${tag} 친할아버지`).toBe(S);
      expect(pgm[0], `${tag} 친할머니`).not.toBe(S);
      expect(mgf[0], `${tag} 외할아버지`).toBe(mother[0]);
      expect(mgm[0], `${tag} 외할머니`).not.toBe(mgf[0]);
      for (const s of [...f.o, ...f.y]) expect(s.n![0], `${tag} 형제`).toBe(S);
    }
  });

  it('이름 부분은 그 사람의 출생 연도 풀에서 온다 (1940년 앞은 가장 오래된 풀 — 설계값) 이고 금지·어색한 조합이 없다', () => {
    for (const { gen, seed, b } of births.filter((_, i) => i % 3 === 0)) {
      const Y = b.character.birthYear;
      const f = b.family;
      const check = (full: string, by: number, gender: 'male' | 'female', tag: string): void => {
        expect(familyNamePool(by, gender), `${gen} ${seed} ${tag} ${by}년생`).toContain(full.slice(1));
        expect(isRejectedName(full[0], full.slice(1)), `${gen} ${seed} ${tag} 금지 조합`).toBe(false);
      };
      const mBy = Y - b.report.mother.age;
      const fBy = Y - b.report.father.age;
      check(f.p[0].n!, mBy, 'female', '어머니');
      check(f.p[1].n!, fBy, 'male', '아버지');
      check(f.g[0].n!, fBy - f.g[0].a, 'male', '친할아버지');
      check(f.g[1].n!, fBy - f.g[1].a, 'female', '친할머니');
      check(f.g[2].n!, mBy - f.g[2].a, 'male', '외할아버지');
      check(f.g[3].n!, mBy - f.g[3].a, 'female', '외할머니');
      f.o.forEach((s, i) => check(s.n!, Y - s.k, s.g === 0 ? 'male' : 'female', `위 형제 ${i + 1}`));
      f.y.forEach((s, j) => check(s.n!, Y + s.k, s.g === 0 ? 'male' : 'female', `아래 동생 ${j + 1}`));
    }
  });

  it('1940년 앞 출생은 가장 오래된 이름 풀로 대신하고(설계값, 근거 칸에 밝힌다), 2020년 뒤 출생은 가장 최근 풀로 대신한다', () => {
    expect(isNamePoolFallback(1939)).toBe(true);
    expect(isNamePoolFallback(1940)).toBe(false);
    expect(isNamePoolFallback(2020)).toBe(false);
    expect(isNamePoolFallback(2021)).toBe(true);
    expect(isNamePoolFallback(2026)).toBe(false); // 시험 전용 R1 프로필
    expect(familyNamePool(1880, 'female')).toEqual(familyNamePool(1940, 'female'));
    expect(familyNamePool(2040, 'male')).toEqual(familyNamePool(2020, 'male'));
    expect(FAMILY_BASIS.find((b) => b.id === 'names')!.note).toMatch(/1940년대/);
  });

  it('이름이 비어 있는 구성(시험이 손으로 만든 것)도 같은 규칙으로 이름이 채워져 보인다 — 저장하지 않는다', () => {
    const g = startLife(7, 'genx');
    const bare: FamilyData = { ...g.family!, p: [{ d: g.family!.p[0].d }, { d: g.family!.p[1].d }], g: g.family!.g.map((x) => ({ a: x.a, d: x.d })) as FamilyData['g'], o: g.family!.o.map(({ n: _n, ...r }) => r), y: g.family!.y.map(({ n: _n, ...r }) => r) };
    const view = familyViewOf({ ...g, family: bare });
    expect(view.people.every((p) => /^[가-힣]{2,5}$/.test(p.name))).toBe(true);
    expect(familyViewOf({ ...g, family: bare }).people.map((p) => p.name)).toEqual(view.people.map((p) => p.name));
  });
});

describe('성인기 식구 (FC5·FC6·FC9, 설계 문서 10절): 플래그와 사건을 본 나이에서 다시 계산한다', () => {
  it('배우자: 혼인·연인·이혼 플래그에서 한 명, 성별은 주인공의 반대(K11), 나이 차는 남편 − 아내 −4~15, 이름은 식구와 겹치지 않는다', () => {
    let seen = 0;
    for (const [gi, gen] of GENERATION_IDS.entries()) {
      for (const seed of spreadSeeds(40, gi)) {
        for (const flag of ['married', 'has_partner', 'divorced']) {
          const g = craft(seed, gen, { age: 35, flags: [flag] });
          const spouse = adultSlotsOf(g, g.family!).filter((s) => s.role === 'spouse');
          expect(spouse, `${gen} ${seed} ${flag}`).toHaveLength(1);
          const Y = g.character!.birthYear;
          expect(spouse[0].gender).toBe(g.character!.gender === 'male' ? 'female' : 'male');
          // 남편 − 아내 나이 차 = (아내 출생 연도 − 남편 출생 연도) : −4~15
          const gap = g.character!.gender === 'male' ? spouse[0].birthYear - Y : Y - spouse[0].birthYear;
          expect(gap, `${gen} ${seed} ${flag} 나이 차`).toBeGreaterThanOrEqual(-4);
          expect(gap).toBeLessThanOrEqual(15);
          seen++;
        }
      }
    }
    expect(seen).toBe(7 * 40 * 3);
    // 플래그가 없으면 없다
    const none = craft(5, 'genx', { age: 40 });
    expect(adultSlotsOf(none, none.family!).filter((s) => s.role !== 'friend')).toHaveLength(0);
  });

  it('배우자·연인은 처음 만난 해에 20세 이상이다 — 22세에 만나도 나이 차가 커서 미성년이 되는 판이 없다 (R-573)', () => {
    const min = familyTables().design.adult.value.spouseMinAge;
    expect(min).toBe(20);
    let pulled = 0;
    for (const [gi, gen] of GENERATION_IDS.entries()) {
      for (const seed of spreadSeeds(200, gi)) {
        const g = craft(seed, gen, { age: 40, flags: ['has_partner'], seen: { 'youth-approached': 22 } });
        const spouse = adultSlotsOf(g, g.family!).find((s) => s.role === 'spouse')!;
        const Y = g.character!.birthYear;
        expect(Y + 22 - spouse.birthYear, `${gen} ${seed} 만난 해 배우자 나이`).toBeGreaterThanOrEqual(min);
        // 하한이 실제로 일한 판(표의 나이 차가 더 어리게 만들 판)이 있다 — 공허 통과 방지
        if (Y + 22 - spouse.birthYear === min) pulled++;
      }
    }
    expect(pulled, '하한이 출생 연도를 당긴 판').toBeGreaterThan(0);
  });

  it('자녀: 1~4명(표시 전용), 첫 자녀는 사건을 본 나이에 태어나고 둘째부터 2~5살 터울·주인공 45세까지, 아직 태어나지 않은 자녀는 보이지 않는다', () => {
    expect(CHILD_EVENTS.length).toBeGreaterThan(0);
    const counts = new Map<number, number>();
    for (const [gi, gen] of GENERATION_IDS.entries()) {
      for (const seed of spreadSeeds(60, gi)) {
        const late = craft(seed, gen, { age: 80, flags: ['married', 'has_child'], seen: { [CHILD_EVENTS[0]]: 27 } });
        const slots = adultSlotsOf(late, late.family!);
        const kids = slots.filter((s) => s.role === 'child');
        expect(kids.length, `${gen} ${seed}`).toBeGreaterThanOrEqual(1);
        // 아이는 아버지의 성을 따른다: 남자 주인공의 자녀는 주인공 성, 여자 주인공의 자녀는 배우자의 성
        const fatherSurname = late.character!.gender === 'male' ? late.character!.name[0] : slots.find((s) => s.role === 'spouse')!.name[0];
        for (const k of kids) expect(k.name[0], `${gen} ${seed} 자녀의 성`).toBe(fatherSurname);
        expect(kids.length).toBeLessThanOrEqual(4);
        expect(kids[0].at).toBe(27);
        kids.forEach((k, i) => {
          if (i === 0) return;
          const gap = k.at - kids[i - 1].at;
          expect(gap, `${gen} ${seed} 터울`).toBeGreaterThanOrEqual(2);
          expect(gap).toBeLessThanOrEqual(5);
          expect(k.at, `${gen} ${seed} 둘째 이후는 45세까지`).toBeLessThanOrEqual(45);
        });
        counts.set(kids.length, (counts.get(kids.length) ?? 0) + 1);
        // 나이를 낮춰 보면 그때까지 태어난 자녀만 있다
        const young = craft(seed, gen, { age: 28, flags: ['married', 'has_child'], seen: { [CHILD_EVENTS[0]]: 27 } });
        expect(adultSlotsOf(young, young.family!).filter((s) => s.role === 'child').every((k) => k.at <= 28)).toBe(true);
      }
    }
    expect([...counts.keys()].sort(), '자녀 수가 1~4명 모두 나온다(공허 통과 방지)').toEqual([1, 2, 3, 4]);
  });

  it('미룬 뒤에 낳은 자녀(child_late)는 마지막으로 본 사건의 나이에 태어난다', () => {
    if (CHILD_EVENTS.length < 2) return;
    const g = craft(9, 'genx', { age: 50, flags: ['married', 'has_child', 'child_late'], seen: { [CHILD_EVENTS[0]]: 28, [CHILD_EVENTS[1]]: 33 } });
    const first = adultSlotsOf(g, g.family!).find((s) => s.id === 'c1')!;
    expect(first.at).toBe(33);
    const early = craft(9, 'genx', { age: 50, flags: ['married', 'has_child'], seen: { [CHILD_EVENTS[0]]: 28, [CHILD_EVENTS[1]]: 33 } });
    expect(adultSlotsOf(early, early.family!).find((s) => s.id === 'c1')!.at).toBe(28);
  });

  it('친구: 1~3명, 처음 만난 나이가 고정이고, 이름은 식구·배우자·자녀·또래와 겹치지 않는다. 같은 상태 → 같은 사람', () => {
    expect(FRIEND_EVENTS.length).toBeGreaterThan(0);
    const counts = new Set<number>();
    for (const [gi, gen] of GENERATION_IDS.entries()) {
      for (const seed of spreadSeeds(40, gi)) {
        const g = craft(seed, gen, { age: 40, flags: ['close_friend', 'married', 'has_child'], seen: { [FRIEND_EVENTS[0]]: 12, [CHILD_EVENTS[0]]: 30 } });
        const slots = adultSlotsOf(g, g.family!);
        const friends = slots.filter((s) => s.role === 'friend');
        expect(friends.length, `${gen} ${seed}`).toBeGreaterThanOrEqual(1);
        expect(friends.length).toBeLessThanOrEqual(3);
        counts.add(friends.length);
        expect(friends.every((f) => f.at === 12)).toBe(true);
        const f = g.family!;
        const all = [g.character!.name, ...peersOf(g.peerSeed!, g.character!.birthYear, g.birthReport!.month, g.character!.name).map((p) => p.name), ...f.p.map((p) => p.n!), ...f.g.map((x) => x.n!), ...f.o.map((x) => x.n!), ...f.y.map((x) => x.n!), ...slots.map((s) => s.name)];
        expect(new Set(all).size, `${gen} ${seed} 이름 겹침`).toBe(all.length);
        expect(adultSlotsOf(g, g.family!)).toEqual(slots);
        // 나중에 같은 플래그를 켜는 사건을 더 봐도(처음 본 나이가 그대로) 친구는 그대로다
        const later = craft(seed, gen, { age: 40, flags: ['close_friend', 'married', 'has_child'], seen: { [FRIEND_EVENTS[0]]: 12, [FRIEND_EVENTS[FRIEND_EVENTS.length - 1]]: 35, [CHILD_EVENTS[0]]: 30 } });
        expect(adultSlotsOf(later, later.family!).filter((s) => s.role === 'friend')).toEqual(friends);
      }
    }
    expect([...counts].sort()).toEqual([1, 2, 3]);
  });

  it('친구를 잃는 사건을 본 판은 close_friend가 꺼져도 「멀어진 친구」로 남고 사이는 「멀어짐」이며, friend_back이면 돌아온다 (FC6)', () => {
    const requirers = EVENT_POOL.events.filter((ev) => ev.conditions?.flags?.includes('close_friend')).map((ev) => ev.id);
    expect(requirers.length).toBeGreaterThan(0);
    const g = craft(21, 'genx', { age: 40, flags: [], seen: { [FRIEND_EVENTS[0]]: 12, [requirers[0]]: 30 } });
    const card = familyCardOf(g);
    expect(card.friends.length).toBeGreaterThan(0);
    expect(card.friends.every((f) => f.label === FAMILY_CARD_TEXT.friendFaded && f.closeness === 1 && f.closenessText === CLOSENESS_LABEL[1])).toBe(true);
    const on = familyCardOf(craft(21, 'genx', { age: 40, flags: ['close_friend'], seen: { [FRIEND_EVENTS[0]]: 12 } }));
    expect(on.friends.every((f) => f.label === FAMILY_CARD_TEXT.friend && (f.closeness ?? 0) >= 3)).toBe(true);
    const back = familyCardOf(craft(21, 'genx', { age: 40, flags: ['close_friend', 'friend_back'], seen: { [FRIEND_EVENTS[0]]: 12 } }));
    expect(back.friends.map((f) => f.closeness!)).toEqual(on.friends.map((f) => Math.min(5, f.closeness! + 1)));
  });
});

describe('사이 말 (FC2): closenessOf — 호칭 기본값 + 양육 방식 + 시드 ±1 + 플래그가 만드는 변화', () => {
  it('항상 1~5이고 같은 상태 → 같은 값이며 라벨은 다섯 말이다', () => {
    expect(Object.values(CLOSENESS_LABEL)).toEqual(['멀어짐', '데면데면함', '보통', '가까움', '아주 가까움']); // 1 … 5
    for (const [gi, gen] of GENERATION_IDS.entries()) {
      for (const seed of spreadSeeds(40, gi)) {
        const g = craft(seed, gen, { age: 35, flags: ['married', 'has_child'] });
        for (const id of ['mother', 'father', 'pgf', 'pgm', 'o1', 'y1', 'spouse', 'c1', 'f1']) {
          const role = id === 'pgf' || id === 'pgm' ? 'grandparent' : id === 'o1' || id === 'y1' ? 'sibling' : id === 'c1' ? 'child' : id === 'f1' ? 'friend' : id === 'spouse' ? 'spouse' : (id as 'mother' | 'father');
          const c = closenessOf({ id, role }, g);
          expect(c).toBeGreaterThanOrEqual(1);
          expect(c).toBeLessThanOrEqual(5);
          expect(closenessOf({ id, role }, g)).toBe(c);
        }
      }
    }
  });

  it('표(CLOSENESS_FLAGS)의 방향이 그 플래그를 켜는 사건의 관계 점수 방향과 같다 — 가까워지는 표는 관계가 오르는 사건이, 멀어지는 표는 관계가 내리는 사건이 켠다', () => {
    const rules = familyTables().design.closeness.value.flags;
    let compared = 0;
    for (const r of rules) {
      // 「꺼져 있을 때」 규칙(close_friend)은 그 플래그를 **끄는** 사건이, 그 밖에는 **켜는** 사건이 방향을 정한다
      const all = EVENT_POOL.events.flatMap((ev) => [ev.effects, ...(ev.choices ?? []).map((c) => c.effects)]);
      const effects = all.filter((e) => (r.when === 'off' ? e?.clearFlags?.includes(r.flag) : e?.setFlags?.includes(r.flag)));
      if (effects.length === 0) continue; // 시스템이 켜는 플래그(별거 등)는 사건이 없다
      const rel = effects.reduce((n, e) => n + (e?.stats?.relationships ?? 0), 0);
      const dir = r.when === 'off' ? -1 : (r.delta ?? 0) > 0 || r.floor !== undefined ? 1 : -1;
      expect(Math.sign(rel), `${r.flag}: 표 방향 ${dir}, 사건의 관계 점수 ${rel}`).toBe(dir);
      compared++;
    }
    expect(compared, '사건이 켜는 플래그 규칙이 여럿 비교됐다').toBeGreaterThanOrEqual(7);
    // 표의 모든 플래그는 형식에 맞고 호칭은 알려진 것이다
    for (const r of rules) {
      expect(r.flag).toMatch(/^[a-z][a-z0-9_]{0,38}$/);
      expect(r.who.length).toBeGreaterThan(0);
      expect(r.delta !== undefined || r.floor !== undefined || r.cap !== undefined).toBe(true);
    }
  });

  it('플래그가 켜지는 때에만 단계가 바뀐다: sibling_close는 형제를, grandparent_close는 조부모를(켜진 판의 조부모는 「가까움」 이상), child_distant는 자녀를 낮춘다', () => {
    for (const [gi, gen] of GENERATION_IDS.entries()) {
      for (const seed of spreadSeeds(30, gi)) {
        const base = craft(seed, gen, { age: 30, flags: ['married', 'has_child'] });
        const mk = (flag: string): GameState => ({ ...base, flags: [...base.flags, flag].sort() });
        const sib = { id: 'o1', role: 'sibling' as const };
        expect(closenessOf(sib, mk('sibling_close'))).toBeGreaterThanOrEqual(closenessOf(sib, base));
        for (const gp of ['pgf', 'pgm', 'mgf', 'mgm']) expect(closenessOf({ id: gp, role: 'grandparent' }, mk('grandparent_close')), `${gen} ${seed} ${gp}`).toBeGreaterThanOrEqual(4);
        const kid = { id: 'c1', role: 'child' as const };
        expect(closenessOf(kid, mk('child_distant'))).toBeLessThanOrEqual(Math.max(1, closenessOf(kid, base) - 1));
        expect(closenessOf({ id: 'spouse', role: 'spouse' }, mk('divorced'))).toBe(1);
        // 사건이 아닌 플래그(관계 없는 것)는 사이를 바꾸지 않는다
        expect(closenessOf(sib, mk('has_career'))).toBe(closenessOf(sib, base));
      }
    }
  });
});

describe('직업 줄 (FC3): 학생 · 직업 · 은퇴 · 집안일', () => {
  it('새 낱말은 「집안일」「쉬는 중」「은퇴」「학생」뿐이다', () => {
    expect(Object.values(JOB_LINE_LABEL).sort()).toEqual(['쉬는 중', '은퇴', '집안일', '학생'].sort());
  });

  it('나이 값(학생 6~22세 · 은퇴 농림어업 65~75·그 밖 55~65)은 코드가 아니라 표에 있고, 근거 칸 글이 그 값으로 조립된다 (R-582)', () => {
    const jobs = familyTables().design.adult.value.jobs;
    expect(jobs).toEqual({ studentAge: { min: 6, max: 22 }, retireAge: { agri: { min: 65, max: 75 }, other: { min: 55, max: 65 } }, homemakerRetireAge: 65 });
    const note = (id: string): string => FAMILY_BASIS.find((b) => b.id === id)!.note;
    expect(note('parent-job-retire')).toContain(`농림어업 ${jobs.retireAge.agri.min}~${jobs.retireAge.agri.max}세, 그 밖 ${jobs.retireAge.other.min}~${jobs.retireAge.other.max}세`);
    expect(note('relatives-job')).toContain(`${jobs.studentAge.min}~${jobs.studentAge.max}세는 「학생」`);
    // 표 값을 바꾸면 동작이 따라 바뀐다(값이 코드에 박혀 있지 않다): 학생 나이와 은퇴 나이의 경계가 표 값 그대로다
    const base = { famSeed: 77, key: 5, job: 'service' as const };
    expect(jobInfoOf({ ...base, age: jobs.studentAge.min - 1 }).line).toBeNull();
    expect(jobInfoOf({ ...base, age: jobs.studentAge.min }).line).toBe('student');
    expect(jobInfoOf({ ...base, age: jobs.studentAge.max + 1 }).line).toBe('employed');
    for (let key = 0; key < 200; key++) {
      const o = retireAgeOf(77, key, 'service');
      const a = retireAgeOf(77, key, 'agri');
      expect(o).toBeGreaterThanOrEqual(jobs.retireAge.other.min);
      expect(o).toBeLessThanOrEqual(jobs.retireAge.other.max);
      expect(a).toBeGreaterThanOrEqual(jobs.retireAge.agri.min);
      expect(a).toBeLessThanOrEqual(jobs.retireAge.agri.max);
    }
    expect(jobInfoOf({ ...base, age: jobs.homemakerRetireAge - 1, homemaker: true, grownUp: true }).line).toBe('homemaker');
    expect(jobInfoOf({ ...base, age: jobs.homemakerRetireAge, homemaker: true, grownUp: true }).line).toBe('retired');
  });

  it('학령 전은 줄이 없고, 6~22세는 학생, 그 뒤는 직업, 은퇴 나이부터는 은퇴다. 직업 종류는 평생 한 번 정해진다', () => {
    const base = { famSeed: 1234, key: 12, job: 'service' as const };
    expect(jobInfoOf({ ...base, age: 5 }).line).toBeNull();
    expect(jobInfoOf({ ...base, age: 6 }).line).toBe('student');
    expect(jobInfoOf({ ...base, age: 22 }).line).toBe('student');
    expect(jobInfoOf({ ...base, age: 23 })).toEqual({ line: 'employed', job: 'service' });
    const r = retireAgeOf(1234, 12, 'service');
    expect(r).toBeGreaterThanOrEqual(55);
    expect(r).toBeLessThanOrEqual(65);
    expect(jobInfoOf({ ...base, age: r - 1 }).line).toBe('employed');
    expect(jobInfoOf({ ...base, age: r }).line).toBe('retired');
    const farm = retireAgeOf(1234, 12, 'agri');
    expect(farm).toBeGreaterThanOrEqual(65);
    expect(farm).toBeLessThanOrEqual(75);
    // 부모(어른)는 학생 나이를 건너뛰고, 집안일(FA2 `w`)이면 은퇴 나이까지 「집안일」
    expect(jobInfoOf({ ...base, age: 20, grownUp: true }).line).toBe('employed');
    expect(jobInfoOf({ ...base, age: 40, homemaker: true, grownUp: true }).line).toBe('homemaker');
    expect(jobInfoOf({ ...base, age: 70, homemaker: true, grownUp: true }).line).toBe('retired');
  });

  it('카드의 부모 직업은 출생신고의 직업이고(INV-3), 집안일 값 `w`가 있으면 직업 대신 「집안일」이다', () => {
    const g = craft(33, 'genx', { age: 5 });
    const row = familyCardOf(g);
    const mother = [...row.together, ...row.apart].find((r) => r.role === 'mother')!;
    expect(mother.jobText).toBe(OCCUPATION_LABEL[g.birthReport!.mother.job]);
    const father = [...row.together, ...row.apart].find((r) => r.role === 'father')!;
    expect(father.jobText).toBe(OCCUPATION_LABEL[g.birthReport!.father.job]);
    const homemaker = familyCardOf({ ...g, family: { ...g.family!, p: [{ ...g.family!.p[0], w: 1, r: 70 }, g.family!.p[1]] } });
    expect([...homemaker.together, ...homemaker.apart].find((r) => r.role === 'mother')!.jobText).toBe('집안일');
  });
});

describe('가진 것 (FK2): POSSESSIONS — 단조 · 시대에 없던 물건 0 · 보급률 · 평균 보존', () => {
  const d = familyTables().design.possessions.value;

  it('표: 항목은 일반 명사이고(상호·숫자 없음), 보급률 시계열은 처음 보급된 해에서 시작해 줄지 않으며 0~100이다. 근거 구분은 설계값이다', () => {
    expect(familyTables().design.possessions.basis).toBe('design');
    expect(d.items.length).toBeGreaterThanOrEqual(12);
    expect(new Set(d.items.map((i) => i.id)).size).toBe(d.items.length);
    for (const item of d.items) {
      expect(item.name, item.id).toMatch(/^[가-힣 ]{2,8}$/);
      expect(item.points[0][0], `${item.id} 첫 점은 보급 시작 해`).toBe(item.start);
      item.points.forEach(([y, v], i) => {
        expect(v).toBeGreaterThan(0);
        expect(v).toBeLessThanOrEqual(100);
        if (i > 0) {
          expect(y).toBeGreaterThan(item.points[i - 1][0]);
          expect(v, `${item.id} ${y}년 보급률이 줄었다`).toBeGreaterThanOrEqual(item.points[i - 1][1]);
        }
      });
      if (item.supersedes !== undefined) expect(d.items.some((o) => o.id === item.supersedes)).toBe(true);
    }
    // 2025년 뒤에는 새 물건이 없다: 마지막 점이 2025 이하이거나(마지막 값 유지) 보급이 이미 끝났다
    for (const item of d.items) expect(possessionRate(item, 2060), item.id).toBe(possessionRate(item, Math.max(2025, item.points[item.points.length - 1][0])));
  });

  it('시대에 없던 물건 0건 · 한 번 가지면 사라지지 않는다(단조): 7세대 × 150판 × 3년마다 0~100세', () => {
    for (const [gi, gen] of GENERATION_IDS.entries()) {
      for (const seed of spreadSeeds(150, gi)) {
        const b = generateBirthFromSeed(seed, gen);
        const base = { character: b.character, peerSeed: b.peerSeed, seed };
        let prev = new Set<string>();
        for (let age = 0; age <= 100; age += 3) {
          const year = b.character.birthYear + age;
          const owned = ownedPossessions({ ...base, age });
          for (const o of owned) {
            const item = d.items.find((i) => i.id === o.id)!;
            expect(item.start, `${gen} ${seed} ${year}년 ${o.id}는 ${item.start}년에 보급되기 시작했다`).toBeLessThanOrEqual(year);
            expect(o.since).toBeGreaterThanOrEqual(item.start);
          }
          const now = new Set(owned.map((o) => o.id));
          for (const id of prev) expect(now.has(id), `${gen} ${seed} ${year}년 ${id}가 사라졌다`).toBe(true);
          prev = now;
        }
      }
    }
  });

  it('1000판 가진 비율이 보급률과 4σ 안이다 (평균 보존 — 수저 단계 기울임이 가중 평균을 바꾸지 않는다)', () => {
    let checks = 0;
    const years = [1960, 1975, 1985, 1995, 2005, 2015, 2025];
    for (const [gi, gen] of GENERATION_IDS.entries()) {
      const births = spreadSeeds(1000, gi).map((seed) => ({ seed, b: generateBirthFromSeed(seed, gen) }));
      for (const year of years) {
        const own = new Map<string, number>();
        let n = 0;
        for (const { seed, b } of births) {
          const age = year - b.character.birthYear;
          if (age < 0 || age > 100) continue;
          n++;
          for (const o of ownedPossessions({ character: b.character, peerSeed: b.peerSeed, seed, age })) own.set(o.id, (own.get(o.id) ?? 0) + 1);
        }
        if (n < 100) continue;
        for (const item of d.items) {
          const rate = possessionRate(item, year);
          const k = own.get(item.id) ?? 0;
          expect(Math.abs(k - n * rate), `${gen} ${item.id} ${year}년: ${k}/${n} (보급률 ${rate.toFixed(3)})`).toBeLessThanOrEqual(4 * Math.sqrt(n * rate * (1 - rate)) + 2);
          checks++;
        }
      }
    }
    expect(checks, '공허 통과 방지').toBeGreaterThan(200);
  });

  it('수저 기울임은 부유한 단계가 더 일찍 가지는 방향이다 (평균은 그대로)', () => {
    const gen = 'genx' as const;
    const births = spreadSeeds(2000, 2).map((seed) => ({ seed, b: generateBirthFromSeed(seed, gen) }));
    const year = 1985;
    const share = (tier: number): number => {
      const g = births.filter(({ b }) => b.character.parentWealth === tier);
      return g.filter(({ seed, b }) => ownedPossessions({ character: b.character, peerSeed: b.peerSeed, seed, age: year - b.character.birthYear }).some((o) => o.id === 'refrigerator')).length / Math.max(1, g.length);
    };
    expect(share(5)).toBeGreaterThan(share(1));
    expect(share(4)).toBeGreaterThan(share(2));
  });

  it('카드에는 최근에 들인 순으로 최대 8개만, 컬러 텔레비전이 있으면 흑백은 가리고, 그림과 묶인 소품은 가진 항목만 낳는다', () => {
    let both = 0;
    for (const [gi, gen] of GENERATION_IDS.entries()) {
      for (const seed of spreadSeeds(150, gi)) {
        const b = generateBirthFromSeed(seed, gen);
        const base = { character: b.character, peerSeed: b.peerSeed, seed };
        const age = Math.min(100, 2025 - b.character.birthYear);
        if (age < 0) continue;
        const shown = shownPossessions({ ...base, age });
        const owned = ownedPossessions({ ...base, age });
        expect(shown.length).toBeLessThanOrEqual(8);
        expect(shown.every((s, i) => i === 0 || shown[i - 1].since >= s.since)).toBe(true);
        if (owned.some((o) => o.id === 'tv-color')) {
          both++;
          expect(shown.some((s) => s.id === 'tv-bw')).toBe(false);
        }
        const ties = possessionTiesOf({ ...base, age });
        expect(ties.has('tv')).toBe(owned.some((o) => o.id === 'tv-bw' || o.id === 'tv-color'));
        expect(ties.has('car')).toBe(owned.some((o) => o.id === 'car'));
        expect(ties.has('aircon')).toBe(owned.some((o) => o.id === 'aircon'));
      }
    }
    expect(both, '컬러 텔레비전 대체 경로가 실제로 시험됐다').toBeGreaterThan(10);
    expect(ownedSince(d.items[0], 0.5)).toBeGreaterThanOrEqual(d.items[0].start);
  });

  it('본문에 보급률 숫자·상호가 없다: 카드 문구는 일반 명사뿐이다', () => {
    const g = craft(5, 'millennial', { age: 30 });
    const things = familyCardOf(g).things;
    for (const t of things) expect(t, t).toMatch(/^[가-힣 ]+$/);
    expect(things.join(' ')).not.toMatch(/\d|%|삼성|엘지|LG|애플|iPhone|갤럭시/);
  });
});

describe('반려동물 (FK1): 상태 함수 — 함께 삶 · 곁을 떠남 · 없음', () => {
  const g = (flags: string[], l: number[][] = []): GameState => {
    const base = craft(3, 'genx', { age: 30, flags });
    return { ...base, family: { ...base.family!, l } };
  };

  it('플래그가 켜진 종은 「함께 삶」, 이별 로그(13)가 있으면 「곁을 떠남」, 아무것도 없으면 「없음」', () => {
    expect(petStatusOf(g([]), 'dog')).toBe('none');
    expect(petStatusOf(g(['pet_dog']), 'dog')).toBe('with');
    expect(petStatusOf(g(['pet_dog']), 'cat')).toBe('none');
    const left = g(['pet_farewell'], [[12, 10, 30, 1], [13, 22, 30, 0]]);
    expect(petStatusOf(left, 'dog')).toBe('gone');
    const pets = petsOf(left);
    expect(pets).toHaveLength(1);
    expect(pets[0]).toMatchObject({ species: 'dog', status: 'gone', since: 10, goneAt: 22, years: 12 });
    // 떠난 뒤 같은 종을 다시 들이면 다시 함께 산다
    expect(petStatusOf(g(['pet_dog'], [[12, 10, 30, 1], [13, 22, 30, 0]]), 'dog')).toBe('with');
  });

  it('입양(플래그)이 카드·그림·가족 보기에 함께 보인다: 같은 종, 같은 이름, 그림에는 실내(마당 개는 아직 아니다)', () => {
    const dog = g(['pet_dog']);
    const card = familyCardOf(dog);
    const view = familyViewOf(dog);
    const scene = sceneFamilyOf(dog);
    expect(card.pets).toHaveLength(1);
    expect(view.pets).toHaveLength(1);
    expect(scene.pets).toHaveLength(1);
    expect(card.pets[0].name).toBe(view.pets[0].name);
    expect(card.pets[0].species).toBe(view.pets[0].species);
    expect(scene.pets[0].species).toBe('dog');
    // 이별(로그 13)은 가족 보기·그림에서 빠지고 카드의 「곁을 떠남」으로 남는다
    const gone = familyCardOf(g([], [[12, 10, 30, 1], [13, 22, 30, 0]]));
    expect(gone.pets[0].status).toBe('gone');
    expect(sceneFamilyOf(g([], [[12, 10, 30, 1], [13, 22, 30, 0]])).pets).toHaveLength(0);
    expect(familyViewOf(g([], [[12, 10, 30, 1], [13, 22, 30, 0]])).pets).toHaveLength(0);
  });

  it('최대 2마리가 함께 살고, 이름은 한 판 안에서 겹치지 않으며 목록의 이름이다', () => {
    const three = petsOf(g(['pet_dog', 'pet_cat', 'pet_other']));
    expect(three).toHaveLength(3);
    expect(new Set(three.map((p) => p.name)).size).toBe(3);
    const names = familyTables().design.pets.value.names;
    for (const p of three) expect(names).toContain(p.name);
    expect(familyViewOf(g(['pet_dog', 'pet_cat', 'pet_other'])).pets.length).toBeLessThanOrEqual(2);
    expect(familyViewOf(g(['pet_dog'])).pets[0]).toMatchObject({ species: 'dog' });
  });

  it('이름 목록은 끝에만 추가한다: 앞 열여섯 개가 바뀌지 않는다(알려진 시드의 이름)', () => {
    const names = familyTables().design.pets.value.names;
    expect(names.slice(0, 16)).toEqual(['바둑이', '누렁이', '흰둥이', '쫑이', '별이', '초코', '콩이', '보리', '나비', '구름', '두부', '몽이', '하루', '달이', '밤이', '복실이']);
    expect(new Set(names).size).toBe(names.length);
    for (const n of names) expect(n).toMatch(/^[가-힣]{2,4}$/);
    expect(petNameOf(famSeedOf(7), 0)).toBe(petNameOf(famSeedOf(7), 0));
  });

  it('수명(설계값): 개 10~16년 · 고양이 12~18년 · 그 밖 2~8년', () => {
    const range = { dog: [10, 16], cat: [12, 18], other: [2, 8] } as const;
    for (const species of ['dog', 'cat', 'other'] as const) {
      const seen = new Set<number>();
      for (let seed = 1; seed <= 400; seed++) {
        const y = petLifeYears(famSeedOf(seed), 0, species);
        expect(y).toBeGreaterThanOrEqual(range[species][0]);
        expect(y).toBeLessThanOrEqual(range[species][1]);
        seen.add(y);
      }
      expect(seen.size, `${species} 모든 값이 나온다`).toBe(range[species][1] - range[species][0] + 1);
    }
  });

  it('카드의 동물 줄: 함께 삶 / 「N년을 함께하고 곁을 떠남」 (입양 나이를 모르면 「곁을 떠남」)', () => {
    const withPet = familyCardOf(g(['pet_dog']));
    expect(withPet.pets[0]).toMatchObject({ speciesText: '개', status: 'with', statusText: '함께 삶' });
    const gone = familyCardOf(g(['pet_farewell'], [[12, 10, 30, 2], [13, 24, 30, 0]]));
    expect(gone.pets[0]).toMatchObject({ speciesText: '고양이', status: 'gone', statusText: '14년을 함께하고 곁을 떠남' });
    expect(FAMILY_CARD_TEXT.petGone(undefined)).toBe('곁을 떠남');
  });
});

describe('카드 모델 (FC1·FC4·FC9·FC10): 줄 순서 · 떠난 사람 글자 · 호칭', () => {
  it('순서: 함께 사는 식구(부모 → 조부모 → 형제) → 따로 사는 가족 → 배우자·자녀 → 친구 → 떠난 가족 (모델의 구획)', () => {
    const g = craft(12, 'boomer', { age: 8 });
    const c = familyCardOf(g);
    const order = (rows: typeof c.together): number[] => rows.map((r) => ({ mother: 0, father: 1, grandparent: 2, sibling: 3 })[r.role as 'mother'] ?? 9);
    expect(order(c.together)).toEqual([...order(c.together)].sort((a, b) => a - b));
    expect(c.together.every((r) => r.state === 'with') && c.apart.every((r) => r.state === 'apart') && c.gone.every((r) => r.state === 'gone')).toBe(true);
    expect(c.counts.people).toBe(c.together.length + c.apart.length + c.adult.length + c.gone.length);
  });

  it('떠난 사람은 「N세에 세상을 떠남」을 글자로 적고, 주인공이 태어난 뒤에 떠난 분에게는 「내가 M세였던 해」가 붙으며, 태어나기 전에 떠난 분은 그렇게 쓴다 (FC4)', () => {
    let gone = 0;
    let before = 0;
    let after = 0;
    for (const [gi, gen] of GENERATION_IDS.entries()) {
      for (const seed of spreadSeeds(60, gi)) {
        const g = craft(seed, gen, { age: 70, flags: ['parents_gone'] });
        for (const r of familyCardOf(g).gone) {
          gone++;
          expect(r.goneText, `${gen} ${seed} ${r.key}`).toBeDefined();
          expect(r.age).toBeLessThanOrEqual(100);
          if (r.goneText!.startsWith('내가 태어나기 전에')) {
            before++;
            expect(r.goneText).toBe(FAMILY_CARD_TEXT.goneBeforeMe(r.age));
            expect(r.goneMyText).toBeUndefined();
          } else {
            after++;
            expect(r.goneText).toBe(FAMILY_CARD_TEXT.goneAt(r.age));
            expect(r.goneMyText, `${gen} ${seed} ${r.key}`).toMatch(/^내가 \d+세였던 해$/);
          }
        }
      }
    }
    expect(gone).toBeGreaterThan(200);
    expect(before, '태어나기 전에 떠난 조부모 경로가 시험됐다').toBeGreaterThan(5);
    expect(after).toBeGreaterThan(100);
  });

  it('호칭(FC9): 조부모 친·외, 자녀 아들·딸, 배우자(연인은 혼인 전), 형제는 주인공 성별 기준, 병환 중인 부모에게는 상태 표지', () => {
    const m = craft(41, 'genx', { age: 40, flags: ['married', 'has_child', 'cared_parents'] });
    const c = familyCardOf(m);
    const all = [...c.together, ...c.apart, ...c.adult];
    expect(all.filter((r) => r.role === 'grandparent').every((r) => /^(친|외)할(아버지|머니)$/.test(r.label))).toBe(true);
    expect(c.adult.filter((r) => r.role === 'child').every((r) => r.label === '아들' || r.label === '딸')).toBe(true);
    expect(c.adult.find((r) => r.role === 'spouse')!.label).toBe('배우자');
    expect(familyCardOf(craft(41, 'genx', { age: 40, flags: ['has_partner'] })).adult.find((r) => r.role === 'spouse')!.label).toBe('연인');
    const siblings = all.filter((r) => r.role === 'sibling');
    const player = m.character!.gender;
    const labels = player === 'male' ? /^(형|누나|남동생|여동생)$/ : /^(오빠|언니|남동생|여동생)$/;
    for (const s of siblings) expect(labels.test(s.label), s.label).toBe(true);
    expect([...c.together, ...c.apart].filter((r) => r.role === 'mother' || r.role === 'father').every((r) => r.statusText === '병환 중' || r.state === 'gone')).toBe(true);
  });

  it('이혼한 배우자는 따로 살고(사이 「멀어짐」), 독립한 자녀(child_left)도 따로 산다 — 둘 다 카드에 남는다', () => {
    const g = craft(52, 'genx', { age: 55, flags: ['divorced', 'has_child', 'child_left'] });
    const c = familyCardOf(g);
    expect(c.adult.find((r) => r.role === 'spouse')).toMatchObject({ state: 'apart', closeness: 1, label: '전 배우자' });
    expect(c.adult.filter((r) => r.role === 'child').every((r) => r.state === 'apart')).toBe(true);
  });

  it('성인기 식구는 그림·아래 한 줄에도 같은 사람으로 나온다(FA0-1): 혼인 중 배우자와 독립하지 않은 자녀가 함께 사는 사람에 있고, 연인·이혼한 배우자·독립한 자녀는 빠진다. 자녀가 태어난 해에 child-born가 붙는다', () => {
    const base = craft(61, 'millennial', { age: 36, flags: ['married', 'has_child'], seen: { [CHILD_EVENTS[0]]: 30 } });
    const view = familyViewOf(base);
    const kids = view.people.filter((p) => p.role === 'child');
    const spouse = view.people.find((p) => p.role === 'spouse')!;
    expect(kids.length).toBeGreaterThanOrEqual(1);
    expect(spouse.state).toBe('with');
    expect(view.household).toContain('spouse');
    for (const k of kids) expect(view.household).toContain(k.id);
    const scene = sceneFamilyOf(base);
    expect(scene.members.filter((m) => m.role === 'spouse')).toHaveLength(1);
    expect(scene.members.filter((m) => m.role === 'child')).toHaveLength(kids.length);
    expect(scene.members.length).toBeLessThanOrEqual(7);
    expect(sceneLineOf(sceneInputOf(base))).toMatch(/배우자/);
    // 연인·이혼·독립은 함께 살지 않는다
    expect(familyViewOf({ ...base, flags: ['has_partner'] }).household).not.toContain('spouse');
    expect(familyViewOf({ ...base, flags: [...base.flags, 'divorced'].filter((f) => f !== 'married').sort() }).household).not.toContain('spouse');
    expect(familyViewOf({ ...base, flags: [...base.flags, 'child_left'].sort() }).household.some((id) => id.startsWith('c'))).toBe(false);
    // 자녀가 태어난 해(30세)에 child-born
    const birthYear = craft(61, 'millennial', { age: 30, flags: ['married', 'has_child'], seen: { [CHILD_EVENTS[0]]: 30 } });
    expect(sceneFamilyOf(birthYear).changed).toContain('child-born');
    expect(sceneFamilyOf(craft(61, 'millennial', { age: 31, flags: ['married', 'has_child'], seen: { [CHILD_EVENTS[0]]: 30 } })).changed).not.toContain('child-born');
  });

  it('접이식 근거 칸: 항목마다 구분(확인·확인(환산)·추정·설계값)과 한 줄 설명이 있고, 파일 경로·내부 이름이 없다', () => {
    const c = familyCardOf(craft(5, 'genx', { age: 30 }));
    expect(c.basis.length).toBeGreaterThanOrEqual(15);
    for (const b of c.basis) {
      expect(['확인', '확인(환산)', '추정', '설계값']).toContain(b.kind);
      expect(b.note.length, b.id).toBeGreaterThan(15);
      expect(b.note, b.id).not.toMatch(/docs\/|src\/|scripts\/|\.json|\.ts|`|fd-[a-z]|FM\d|R-\d/);
      // 가운뎃점 목록(「형제·배우자·…」)은 좁은 폭에서 줄 끝에 「·」가 혼자 남는다(QM2-10) — 쉼표·「과」로 잇는다
      expect(b.note, b.id).not.toContain('·');
    }
    for (const id of ['names', 'closeness', 'possessions', 'pets', 'adult-family', 'relatives-job', 'parent-job-retire']) expect(c.basis.some((b) => b.id === id && b.kind === '설계값'), id).toBe(true);
  });
});
