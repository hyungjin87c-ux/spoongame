import { describe, expect, it } from 'vitest';
import {
  FAMILY_SYSTEM_FLAGS,
  GENERATION_IDS,
  childLeaveAgeOf,
  famSeedOf,
  flagSettersOf,
  STATE_WORD_RULES,
  YOUNGER_SIBLING_EVENT,
  CHILD_APART_MIN_AGE,
  adultSlotsOf,
  deriveFamilyFlags,
  familyCardOf,
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

// tests/는 Node 타입을 쓰지 않는다(tsconfig.json) — 환경 변수 읽기에 필요한 모양만 선언한다 (R-559 diff는 이 선언 없이는 typecheck를 통과하지 못한다)
declare const process: { env: Record<string, string | undefined> };
/** 평소 npm test는 세대당 90판, 12-2절 전수(1000판)는 FAMILY_INV_LIVES=1000으로 돌린다 */
const PER_GEN = Number(process.env.FAMILY_INV_LIVES ?? 90);
/** 이 모듈이 켜고 끄는 플래그 (familyTick.ts#MANAGED_FLAGS와 같은 목록 — 시스템 플래그 중 보기에서 파생되는 것) */
const MANAGED = ['has_grandparent', 'lives_with_grandparent', 'has_older_sibling', 'has_younger_sibling', 'has_sibling', 'lives_with_child', 'mother_gone', 'father_gone', 'mother_apart', 'father_apart'];
/** 로그 종류 → 줄을 남기는가 (FM7a: 3 = 어린 형제의 이른 별세) */
const LINE_KINDS = new Set([2, 3, 4, 5, 6]);
/** `parents_gone`을 켜는 사건 id들 (원본·변형 모두 — 풀의 세터 색인) */
const PG_SETTERS = new Set(flagSettersOf(EVENT_POOL, 'parents_gone'));

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
  /** 분류가 붙은 줄(loss·home) · 분류 없는 줄 수 (4-9절 가림) */
  heavy: number;
  plain: number;
  /** 판 끝의 `family` 저장 길이(JSON 글자 수) 최댓값 · 로그 줄 수 최댓값 (2-3절 ≤ 1000자) */
  maxLen: number;
  maxLog: number;
  /** FM7a: 어린 형제의 이른 별세 줄 · 자녀가 따로 사는 해 수 · 함께 사는 해 수 (R-586) · 별세·이혼 줄이 0세 해에 난 수 (R-618) · 한 분 별세 해에 `parents_gone` 사건이 난 수 (R-561) · `senior-alone` 본 판 */
  sibLost: number;
  kidApart: number;
  kidWith: number;
  atZero: number;
  sameYear: number;
  /** 별세 줄이 난 해에 그 한 분의 플래그를 notFlags로 읽는 사건이 같은 해에 일어난 수 (후속 199 — 0이어야 한다) */
  sameYearReader: number;
  seniorAlone: number;
  /** FM6 카드: 배우자·자녀·친구가 보인 판 수 */
  spouse: number;
  child: number;
  friend: number;
  /** 판 끝에 문장과 견준 성인기 식구 이름 수 (R-576 안 B ②) */
  adultNames: number;
}

describe('INV 전수: 7세대 × 판 × 해마다 (playToEnd)', () => {
  const tally: Tally = { lives: 0, born: 0, cards: 0, left: 0, gp: 0, parentGone: 0, apart: 0, checks: 0, heavy: 0, plain: 0, maxLen: 0, maxLog: 0, sibLost: 0, kidApart: 0, kidWith: 0, atZero: 0, sameYear: 0, sameYearReader: 0, seniorAlone: 0, spouse: 0, child: 0, friend: 0, adultNames: 0 };
  const problems: string[] = [];
  const bad = (where: string, msg: string): void => {
    if (problems.length < 40) problems.push(`${where}: ${msg}`);
  };

  for (const [gi, gen] of GENERATION_IDS.entries()) {
    it(`${gen}: ${PER_GEN}판`, { timeout: Math.max(120_000, PER_GEN * 1_500) }, () => {
      for (const seed of seedsFor(PER_GEN, gi)) {
        const steps = lifeSteps(seed, gen as ProfileId);
        tally.lives++;
        const where = `${gen}/${seed}`;
        const goneEver = new Set<PersonId>();
        let prevLogLen = 0;
        // 사이는 사건 없이 슬며시 바뀌지 않는다(FC2): 사람마다 (사이, 사이에 닿는 플래그 모음)을 기억해 플래그가 같은데 사이가 바뀌면 위반
        const closeSeen = new Map<string, { closeness: number; sig: string }>();
        const kinds = { spouse: false, child: false, friend: false };
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
          // INV-2c (R-558): 20세 전에는 함께 사는 부모가 한 분 이상이다 — 이혼 뒤 함께 살던 분이 미성년 때 별세해 아이 곁에 부모가 없는 판이 없다
          if (age < 20 && !view.household.some((id) => id === 'mother' || id === 'father')) bad(where, `${age}세 함께 사는 부모가 없다`);
          // 사망 걸음(R-559): 사망 해는 나이가 오르지 않지만 그 해의 가족 변화·플래그는 해 끝의 보기(age + 1)로 맞춰져 있으므로, 같은 나이로 견주어 INV-7·8을 건너뛰지 않는다
          const dead = state.phase !== 'life';
          // INV-7: 시스템 소유 플래그 = 파생 집합 (보기 + 로그). 해가 끝난 상태(age)의 보기와 같다
          const derived = deriveFamilyFlags(dead ? familyViewOf(state, age + 1) : view, f.l);
          const have = new Set(state.flags.filter((x) => MANAGED.includes(x)));
          for (const x of MANAGED) {
            if (derived.has(x) !== have.has(x)) bad(where, `${age}세 플래그 ${x}: 파생 ${derived.has(x)} 실제 ${have.has(x)}`);
          }
          // 시스템이 쓰지 않는 시스템 플래그(값이 아직 없는 것)가 켜져 있지 않다
          for (const x of FAMILY_SYSTEM_FLAGS) if (!MANAGED.includes(x) && state.flags.includes(x)) bad(where, `${age}세 값이 없는 시스템 플래그 ${x}가 켜졌다`);
          // INV-9 (R-561로 정본대로 「<」): 한 분 별세 플래그는 동시에 켜지지 않고, 먼저 떠난 분의 별세 해가 parents_gone이 켜진 해보다 **앞선다**(같은 해 겹침은 R-561이 그 해 후보에서 뺀다)
          if (state.flags.includes('mother_gone') && state.flags.includes('father_gone')) bad(where, `${age}세 mother_gone·father_gone 동시`);
          if (state.flags.includes('parents_gone')) {
            const logged = f.l.find((e) => e[0] === 5);
            const farewell = state.history.find((h) => PG_SETTERS.has(h.eventId ?? ''));
            if (logged !== undefined && farewell !== undefined && logged[1] >= farewell.age) bad(where, `한 분 별세(${logged[1]}세)가 parents_gone(${farewell.age}세)보다 앞서지 않는다`);
          }
          // R-586: 자녀의 「따로 삶」은 나이를 본다 — 19세 미만은 따로 살지 않고, child_left가 없으면 그 자녀의 독립 나이(20~30)부터 따로 산다, 75세 이상에서는 함께 사는 자녀가 없다
          const famSeed = famSeedOf(state.peerSeed ?? state.seed);
          for (const p of view.people) {
            if (p.role !== 'child') continue;
            const j = Number(p.id.slice(1)) - 1;
            if (p.age < CHILD_APART_MIN_AGE && p.state === 'apart') bad(where, `${age}세 ${p.age}세 자녀 ${p.id}가 따로 산다`);
            if (p.state !== 'gone') {
              const must = p.age >= CHILD_APART_MIN_AGE && (state.flags.includes('child_left') || p.age >= childLeaveAgeOf(famSeed, j));
              if (must !== (p.state === 'apart')) bad(where, `${age}세 자녀 ${p.id}(${p.age}세) 상태 ${p.state} ≠ 규칙 ${must ? 'apart' : 'with'}`);
              if (p.state === 'apart') tally.kidApart++;
              else tally.kidWith++;
            }
            if (age >= 75 && p.state === 'with') bad(where, `${age}세 함께 사는 자녀 ${p.id}`);
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
          // FC10 (R-542 해소): 카드의 사람 수(친구 제외) = 함께 사는 사람 + 따로 사는 사람 + 떠난 사람 = 보기의 사람 전체, 카드의 형제 줄(떠난 형제 제외) = 상속이 읽는 형제 수(INV-10)
          const card = familyCardOf(state);
          const together = view.people.filter((p) => p.state === 'with').length;
          const apart = view.people.filter((p) => p.state === 'apart').length;
          const goneN = view.people.filter((p) => p.state === 'gone').length;
          // 독립 기준: 저장된 구성과 성인기 식구 계획에서 센 사람 수 — 보기가 사람을 빠뜨리면 여기서 걸린다
          const expected = 6 + f.o.length + f.y.filter((s) => s.k <= age).length + adultSlotsOf(state, f).filter((s) => s.role !== 'friend' && s.at <= age).length;
          if (view.people.length !== expected) bad(where, `${age}세 보기 사람 ${view.people.length} ≠ 구성 ${expected}`);
          if (card.together.length + card.apart.length + card.adult.length + card.gone.length !== expected || together + apart + goneN !== expected) bad(where, `${age}세 카드 사람 수 ≠ 구성 ${expected}`);
          if (card.together.length + card.adult.filter((r) => r.state === 'with').length !== view.household.length) bad(where, `${age}세 카드의 함께 사는 사람 ≠ 보기의 함께 사는 사람`);
          const sibRows = [...card.together, ...card.apart].filter((r) => r.role === 'sibling').length;
          if (sibRows !== siblingCountOf(state)) bad(where, `${age}세 카드의 형제 줄 ${sibRows} ≠ 상속의 형제 수 ${siblingCountOf(state)}`);
          const everyone = [...card.together, ...card.apart, ...card.adult, ...card.friends, ...card.gone];
          const fullNames = [state.character!.name, ...everyone.map((r) => r.name)];
          if (new Set(fullNames).size !== fullNames.length) bad(where, `${age}세 이름이 겹친다`);
          if (everyone.some((r) => !/^[가-힣]{2,5}$/.test(r.name))) bad(where, `${age}세 이름 모양이 이상하다`);
          const kids = card.adult.filter((r) => r.role === 'child').length;
          if (kids > 4 || card.adult.filter((r) => r.role === 'spouse').length > 1 || card.friends.length > 3) bad(where, `${age}세 자녀 ${kids}·배우자·친구 ${card.friends.length} 한도`);
          const partner = card.adult.find((r) => r.role === 'spouse');
          if (partner !== undefined && partner.age < 20) bad(where, `${age}세 배우자·연인이 ${partner.age}세다 (R-573)`);
          if (card.things.length > 8) bad(where, `${age}세 가진 것 ${card.things.length} > 8`);
          for (const r of card.gone) if (r.goneText === undefined && r.role !== 'friend') bad(where, `${age}세 떠난 ${r.key}의 「N세에 세상을 떠남」이 없다`);
          for (const r of everyone) {
            if (r.state === 'gone') continue;
            if (r.closeness === null || r.closeness < 1 || r.closeness > 5) bad(where, `${age}세 ${r.key} 사이 ${r.closeness}`);
            // 사이에 닿는 플래그 모음: 표의 플래그 + 시스템 별거 플래그. 같은 모음에서 사이가 바뀌면 안 된다
            const sig = ['sibling_close', 'grandparent_close', 'cared_parents', 'child_distant', 'child_left', 'friend_back', 'close_friend', 'divorced', 'mother_apart', 'father_apart'].map((x) => (state.flags.includes(x) ? 1 : 0)).join('');
            const prev = closeSeen.get(r.key);
            if (prev !== undefined && prev.sig === sig && prev.closeness !== r.closeness) bad(where, `${age}세 ${r.key} 사이가 사건 없이 바뀌었다 (${prev.closeness} → ${r.closeness})`);
            closeSeen.set(r.key, { closeness: r.closeness ?? 0, sig });
          }
          if (card.adult.some((r) => r.role === 'spouse')) kinds.spouse = true;
          if (kids > 0) kinds.child = true;
          if (card.friends.length > 0) kinds.friend = true;
          // INV-11: 그림은 7명·반려동물 2마리 이하
          const scene = sceneFamilyOf(state);
          // FC10: 그림의 식구(밀려난 사람 포함) = 함께 사는 사람 = 카드의 함께 사는 사람
          if (scene.members.length + scene.overflow !== together) bad(where, `${age}세 그림 식구 ${scene.members.length}+${scene.overflow} ≠ 함께 사는 사람 ${together}`);
          if (scene.members.length > 7 || scene.pets.length > 2) bad(where, `${age}세 그림 식구 ${scene.members.length}`);
          // INV-10: 보기의 형제 수 = 상속이 실제로 쓰는 형제 수 (K1을 켰다 — 규칙 인자를 주지 않고 지금 규칙 그대로 부른다. 'view'를 넘기면 동어반복이다, R-559)
          if (siblingCountOf(state) !== view.siblingCount.living) bad(where, `${age}세 형제 수 불일치`);
          // 이 걸음에서 새로 생긴 줄만 센다
          const added = state.history.slice(before.history.length);
          for (const h of added) {
            if (h.eventId === 'fam-sib-born') tally.born++;
            else if (h.eventId === 'fam-sib-left') tally.left++;
            else if (h.eventId === 'fam-gp-gone') tally.gp++;
            else if (h.eventId === 'fam-parent-gone') tally.parentGone++;
            else if (h.eventId === 'fam-parents-apart') tally.apart++;
            else if (h.eventId === 'fam-sib-lost') tally.sibLost++;
            else if (h.eventId === YOUNGER_SIBLING_EVENT) tally.cards++;
            // R-618: 별세·이혼 줄은 주인공 0세 해에 나지 않는다 · R-561: 한 분 별세 줄이 난 해에 parents_gone을 켜는 사건이 일어나지 않는다 · R-586: 함께 사는 자녀가 있는 해에 senior-alone이 일어나지 않는다
            if (h.age === 0 && (h.eventId === 'fam-parent-gone' || h.eventId === 'fam-parents-apart')) {
              tally.atZero++;
              bad(where, `0세 해에 ${h.eventId}`);
            }
            if (h.eventId === 'fam-parent-gone' && added.some((x) => PG_SETTERS.has(x.eventId ?? '') && x.age === h.age)) {
              tally.sameYear++;
              bad(where, `${h.age}세 한 분 별세 줄과 parents_gone 사건이 같은 해에 났다`);
            }
            if (h.eventId === 'senior-alone') {
              tally.seniorAlone++;
              if (familyViewOf(before).people.some((p) => p.role === 'child' && p.state === 'with')) bad(where, `${h.age}세 함께 사는 자녀가 있는데 senior-alone이 일어났다 (R-586)`);
            }
            // 어린 형제의 이른 별세 (Q3): 줄이 난 걸음에서 보기·카드·그림·플래그가 같은 해에 함께 바뀐다
            if (h.eventId === 'fam-sib-lost') {
              const lost = f.l.find((e) => e[0] === 3);
              if (lost === undefined) bad(where, `${h.age}세 형제 별세 줄은 있는데 로그(종류 3)가 없다`);
              else {
                const id = (lost[2] > 20 ? `y${lost[2] - 20}` : `o${lost[2] - 10}`) as PersonId;
                const after = dead ? familyViewOf(state, age + 1) : view;
                const was = familyViewOf(before).people.find((p) => p.id === id);
                const sib = after.people.find((p) => p.id === id);
                if (state.birthReport === null || state.character!.birthYear > 1969) bad(where, '1970년 이후 출생 판에서 형제가 떠났다');
                if (lost[3] < 1 || lost[3] > 11) bad(where, `형제 별세 나이 ${lost[3]} (1~11이 아니다)`);
                if (h.age < 1 || h.age > 19) bad(where, `주인공 ${h.age}세에 형제가 떠났다 (1~19가 아니다)`);
                if (was === undefined || was.state === 'gone') bad(where, `${h.age}세 떠나기 전 형제 ${id}가 없거나 이미 떠났다`);
                if (sib === undefined || sib.state !== 'gone' || sib.goneAtOwnAge !== lost[3] || sib.goneAtMyAge !== h.age) bad(where, `${h.age}세 형제 ${id}의 떠남 표시가 로그와 다르다`);
                if (!dead && !card.gone.some((r) => r.key === id && r.goneText !== undefined)) bad(where, `${h.age + 1}세 카드 「떠난 가족」에 형제 ${id}가 없다`);
                if (!dead && (scene.members.some((m) => m.id === id) || !scene.changed.includes('sib-gone'))) bad(where, `${h.age + 1}세 그림에서 형제 ${id}가 안 빠졌거나 바뀐 때(sib-gone)가 없다`);
              }
            }
            // 후속 199(완료 기준 3 「켜진 해부터」 = 별세 줄이 난 그 해 포함): 별세 줄이 난 해에는 그 한 분의 플래그(mother_gone·father_gone)를 notFlags로 읽는 사건(병환·임종 원본, 「아빠/엄마」 어린 시절 사건)도 같은 해에 일어나지 않는다
            if (h.eventId === 'fam-parent-gone') {
              const goneFlag = f.l.find((e) => e[0] === 5)![2] === 1 ? 'mother_gone' : 'father_gone';
              const reader = added.find((x) => x.age === h.age && (EVENT_POOL.byId.get(x.eventId ?? '')?.conditions?.notFlags ?? []).includes(goneFlag));
              if (reader !== undefined) {
                tally.sameYearReader++;
                bad(where, `${h.age}세 별세 줄과 같은 해에 ${goneFlag}를 notFlags로 읽는 사건 ${reader.eventId}가 일어났다`);
              }
            }
            // 가림(4-9절): 모든 가족 줄의 분류가 글자 표와 같고, 분류가 붙은 줄(별세·이혼)은 가림을 켜면 문장이 가려지는 줄이다 (R-560)
            if ((h.eventId ?? '').startsWith('fam-')) {
              const want = FAMILY_LINE_HEAVY[h.eventId!] ?? null;
              if (heavyKindOfEntry(h) !== want) bad(where, `${age}세 ${h.eventId}: 가림 분류 ${heavyKindOfEntry(h)} ≠ ${want}`);
              if (want === null) tally.plain++;
              else tally.heavy++;
            }
          }
        }
        // 한 판 전체: 동생이 태어나는 해마다 인생 기록 줄이 정확히 하나(상태 줄 또는 반응 카드, 둘째 이후 동생은 상태 줄)
        const last = steps[steps.length - 1].state;
        const f = last.family!;
        // 크기(2-3절): 판을 끝까지 돌린 뒤의 family도 저장 한도 안이다 (R-560)
        if (kinds.spouse) tally.spouse++;
        if (kinds.child) tally.child++;
        if (kinds.friend) tally.friend++;
        const size = JSON.stringify(f).length;
        tally.maxLen = Math.max(tally.maxLen, size);
        tally.maxLog = Math.max(tally.maxLog, f.l.length);
        if (size > 1000) bad(where, `판 끝 family가 ${size}자`);
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
        // 성인기 식구(배우자·자녀·친구)의 이름은 사건·인생 기록 문장에 쓰이지 않는다 (SPEC-009 FS2 예외 ②, R-576 안 B): 이 식구는 저장하지 않고 다시 계산하므로 표·이름 풀이 개정되면 이름이 바뀔 수 있다.
        // 문장에 쓰려면 먼저 이름을 저장으로 옮겨야 한다 — 옮기기 전에 쓰면 여기서 걸린다
        const adultNames = adultSlotsOf(last, f).map((s) => s.name);
        tally.adultNames += adultNames.length;
        for (const h of last.history) {
          const text = `${h.title ?? ''} ${h.text} ${h.choice ?? ''}`;
          for (const n of adultNames) if (text.includes(n)) bad(where, `${h.age}세 ${h.eventId}: 성인기 식구 이름 「${n}」이 문장에 쓰였다 (R-576)`);
        }
      }
    });
  }

  it('위반 0건, 시험이 공허하지 않다: 변화가 일어난 판이 충분하다', () => {
    // 전수 실행(FAMILY_INV_LIVES)일 때만 위반 수와 tally를 찍는다 — ai-log에 옮겨 적는 값 (R-559)
    if (process.env.FAMILY_INV_LIVES !== undefined) console.info(`[INV 전수] 위반 ${problems.length}건 · tally ${JSON.stringify(tally)}`);
    expect(problems).toEqual([]);
    expect(tally.lives).toBe(GENERATION_IDS.length * PER_GEN);
    expect(tally.checks, '해마다 점검 횟수').toBeGreaterThan(20_000);
    expect(tally.born, '동생 출생 줄').toBeGreaterThan(100);
    expect(tally.cards, '강제 사건(동생 반응 카드)').toBeGreaterThan(100);
    expect(tally.left, '형제 독립 줄').toBeGreaterThan(100);
    expect(tally.gp, '조부모 별세 줄').toBeGreaterThan(100);
    expect(tally.parentGone, '부모 한 분 별세 줄').toBeGreaterThan(30);
    expect(tally.apart, '이혼·별거 줄').toBeGreaterThan(10);
    expect(tally.spouse, 'FM6 카드: 배우자가 보인 판').toBeGreaterThan(30);
    expect(tally.child, 'FM6 카드: 자녀가 보인 판').toBeGreaterThan(30);
    expect(tally.friend, 'FM6 카드: 친구가 보인 판').toBeGreaterThan(30);
    expect(tally.adultNames, '성인기 식구 이름을 문장과 견준 수 (공허 통과 방지, R-576)').toBeGreaterThan(100);
    expect(tally.heavy, '가림 분류가 붙은 줄(별세·이혼·형제 별세)').toBeGreaterThan(100);
    // FM7a 공허 통과 방지: 어린 형제의 이른 별세 줄 · 자녀가 함께/따로 사는 해 · senior-alone 본 판이 실제로 있었다 (R-561·R-586·R-618 위반은 위 problems가 센다)
    expect(tally.sibLost, '어린 형제의 이른 별세 줄').toBeGreaterThan(10);
    expect(tally.kidApart, '자녀가 따로 사는 해').toBeGreaterThan(500);
    expect(tally.kidWith, '자녀가 함께 사는 해').toBeGreaterThan(500);
    expect(tally.seniorAlone, 'senior-alone이 일어난 판').toBeGreaterThan(5);
    expect(tally.atZero + tally.sameYear + tally.sameYearReader, '0세 해 별세·이혼 줄 + 같은 해 겹침(parents_gone 세터 · 한 분 플래그를 notFlags로 읽는 사건)').toBe(0);
    expect(tally.plain, '분류 없는 줄(동생 출생·독립)').toBeGreaterThan(100);
    expect(tally.maxLen, `판 끝 family 최대 ${tally.maxLen}자 · 로그 최대 ${tally.maxLog}줄`).toBeLessThanOrEqual(1000);
  });

  it('성인기 식구 이름은 코드에서도 카드·보기에만 닿는다 — 인생 기록 줄을 쓰는 모듈은 이름을 읽지 않는다 (SPEC-009 FS2 예외 ②, R-576 안 B)', () => {
    const files = import.meta.glob('../src/**/*.{ts,tsx}', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;
    const code = (src: string): string => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    const users = Object.entries(files)
      .filter(([, src]) => /\b(adultSlotsOf|namesOfFamily|AdultSlot)\b/.test(code(src)))
      .map(([path]) => path.replace('../src/', ''))
      .sort();
    expect(users, '성인기 식구 이름을 만드는 함수를 부르는 곳 — 늘리려면 이름을 저장으로 옮긴 뒤에 한다').toEqual(['core/familyAdult.ts', 'core/familyCard.ts', 'core/familyView.ts']);
    // 인생 기록 줄·가족 변화 문장을 만드는 곳은 사람의 이름을 읽지 않는다
    for (const path of ['core/familyTick.ts', 'data/familyLineText.ts', 'core/familyLife.ts']) {
      const src = files[`../src/${path}`];
      expect(src, path).toBeDefined();
      expect(code(src), `${path}가 사람 이름을 읽는다`).not.toMatch(/\.name\b|\bNameBook\b|\bnamesOfFamily\b/);
    }
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
