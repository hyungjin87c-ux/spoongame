import { describe, expect, it } from 'vitest';
import age0 from './fixtures/save-v030-age0.json';
import age20 from './fixtures/save-v030-age20.json';
import age65 from './fixtures/save-v030-age65.json';
import {
  GENERATION_IDS,
  R1_PRESENT,
  YOUNGER_SIBLING_EVENT,
  applyFamilyChanges,
  autoResolveStep,
  createEventPool,
  createInitialState,
  createRng,
  deriveFamilyFlags,
  enterLife,
  eventPool,
  familyChangesFor,
  familyScheduleOf,
  familyTables,
  familyViewOf,
  heavyKindOfEntry,
  legacyFamilyFrom,
  parseOpened,
  stepYear,
  type GameState,
  type ProfileId,
} from '../src/core';
import { startLife } from '../scripts/simulateLib';
import { withEarlyLoss } from '../scripts/familyRulesLib';
import { FAMILY_LINE_HEAVY } from '../src/data/familyLineText';
import { lifeSteps, seedsFor } from './helpers/familyLife';

/**
 * 해마다 바뀌는 가족 형편 (SPEC-009 FM4b FA7, K2 · `docs/data/family-model.md` 3·4-7·7-2절): `familyChangesFor`·`applyFamilyChanges`, `fam-` 줄, 시스템 플래그, `family.log`, 강제 슬롯, 이른 부모 별세 효과.
 */

const GEN: readonly ProfileId[] = GENERATION_IDS;

/** 조건에 맞는 판의 걸음(전, 후)을 처음 만나는 것까지 찾는다 (세대 순서대로, 세대마다 시드 열 `seedsFor`) */
function find(match: (before: GameState, after: GameState) => boolean, gens: readonly ProfileId[] = GEN, per = 200): { before: GameState; after: GameState; gen: ProfileId; seed: number } {
  for (const gen of gens) {
    for (const seed of seedsFor(per, GENERATION_IDS.indexOf(gen as (typeof GENERATION_IDS)[number]))) {
      for (const st of lifeSteps(seed, gen)) if (match(st.before, st.state)) return { before: st.before, after: st.state, gen, seed };
    }
  }
  throw new Error('조건에 맞는 판을 못 찾았다');
}

describe('familyChangesFor: 순수 계산', () => {
  it('같은 상태 → 같은 결과이고, 가족이 없는 상태(출생 전·family 없음)에는 아무 변화도 없다', () => {
    const s = startLife(7, 'genx');
    expect(familyChangesFor(s, 3, eventPool())).toEqual(familyChangesFor(s, 3, eventPool()));
    const empty = familyChangesFor({ ...createInitialState(1) }, 0);
    expect(empty.lines).toEqual([]);
    expect(empty.setFlags).toEqual([]);
    expect(empty.log).toEqual([]);
    const noFamily = familyChangesFor({ ...s, family: undefined }, 3);
    expect(noFamily.lines).toEqual([]);
    expect(applyFamilyChanges(s, noFamily)).toBe(s); // 바뀐 것이 없으면 같은 객체
  });

  it('진행 RNG를 쓰지 않는다: 변화를 적용해도 rngState·seen·lastChoiceAge가 그대로다', () => {
    const { before } = find((_b, a) => a.family!.l.length > 0);
    const age = before.age;
    const c = familyChangesFor(before, age, eventPool());
    const after = applyFamilyChanges(before, c);
    expect(after.rngState).toBe(before.rngState);
    expect(after.seen).toEqual(before.seen);
    expect(after.lastChoiceAge).toBe(before.lastChoiceAge);
  });

  it('시험 전용 R1 프로필은 얼린 세계다: 가족 변화도 시스템 플래그도 없다 (EY17)', () => {
    const r1 = startLife(11, R1_PRESENT);
    expect(r1.flags).toEqual([]);
    for (const { state } of lifeSteps(11, R1_PRESENT)) {
      expect(state.history.filter((h) => (h.eventId ?? '').startsWith('fam-'))).toEqual([]);
      expect(state.family!.l).toEqual([]);
    }
    expect(familyChangesFor(r1, 5, eventPool())).toEqual({ lines: [], setFlags: [], clearFlags: [], log: [] });
  });
});

describe('enterLife: 처음 시스템 플래그', () => {
  it('태어날 때의 가족 보기에서 파생한 플래그가 놓인다(조부모가 계시면 has_grandparent, 위 형제가 있으면 has_older_sibling·has_sibling)', () => {
    let withGrand = 0;
    let withOlder = 0;
    for (const seed of seedsFor(300, 2)) {
      const s = startLife(seed, 'genx');
      const v = familyViewOf(s, 0);
      expect(s.flags.includes('has_grandparent'), `${seed}`).toBe(v.people.some((p) => p.role === 'grandparent' && p.state !== 'gone'));
      expect(s.flags.includes('has_older_sibling'), `${seed}`).toBe(v.siblingCount.older > 0);
      expect(s.flags.includes('has_sibling'), `${seed}`).toBe(v.siblingCount.living > 0);
      expect(s.flags.includes('has_younger_sibling'), `${seed}`).toBe(v.siblingCount.younger > 0);
      if (s.flags.includes('has_grandparent')) withGrand++;
      if (s.flags.includes('has_older_sibling')) withOlder++;
    }
    expect(withGrand).toBeGreaterThan(100);
    expect(withOlder).toBeGreaterThan(100);
  });

  it('가족이 없는 상태에서는 플래그를 놓지 않는다(옛 시험 상태)', () => {
    const s = startLife(5, 'alpha');
    const birth = { ...s, phase: 'birth' as const, family: undefined, flags: [], history: [] };
    expect(enterLife(birth).flags).toEqual([]);
  });
});

describe('K2 강제 슬롯: 첫째의 첫 동생 반응 카드는 구성이 정한 해에 일어난다', () => {
  it('카드가 일어난 해는 family.y[0].k이고, 로그 [1, k, 21, 1]이 있으며, 그 해 fam-sib-born 줄은 없다 (줄 하나 규칙)', () => {
    let checked = 0;
    for (const gi of [0, 3, 6]) {
      for (const seed of seedsFor(120, gi)) {
        const steps = lifeSteps(seed, GENERATION_IDS[gi]);
        const last = steps[steps.length - 1].state;
        const f = last.family!;
        if (last.birthReport!.birthOrder !== 1 || f.y.length === 0 || last.age < f.y[0].k) continue;
        const k = f.y[0].k;
        const lines = last.history.filter((h) => h.age === k && (h.eventId === 'fam-sib-born' || h.eventId === YOUNGER_SIBLING_EVENT));
        expect(lines, `${GENERATION_IDS[gi]}/${seed}`).toHaveLength(1);
        expect(lines[0].eventId).toBe(YOUNGER_SIBLING_EVENT);
        expect(f.l.some((e) => e[0] === 1 && e[1] === k && e[2] === 21 && e[3] === 1)).toBe(true);
        expect(last.seen[YOUNGER_SIBLING_EVENT]).toBe(k);
        checked++;
      }
    }
    expect(checked, '공허 통과 방지').toBeGreaterThan(100);
  });

  it('선택지 간격(MIN_YEARS_BETWEEN_CHOICES)·페이싱을 무시하고 일으키며, 그 해 일반 선택 추첨은 건너뛴다 (lastChoiceAge를 갱신한다)', () => {
    const { before, after } = find((b, a) => a.seen[YOUNGER_SIBLING_EVENT] !== undefined && b.seen[YOUNGER_SIBLING_EVENT] === undefined && b.lastChoiceAge !== null && b.age - b.lastChoiceAge < 2, GEN, 200);
    expect(after.seen[YOUNGER_SIBLING_EVENT]).toBe(before.age);
    expect(after.lastChoiceAge).toBe(before.age);
    // 방금 선택 카드가 있었는데도(간격 < 2) 일어났다
    expect(before.age - before.lastChoiceAge!).toBeLessThan(2);
    const r = stepYear(before);
    expect(r.tick.eventId ?? r.state.history.filter((h) => h.age === before.age).map((h) => h.eventId).find((id) => id === YOUNGER_SIBLING_EVENT)).toBeDefined();
  });

  it('난수 한 칸 규칙: 강제 해에도 rollChoice·rollNarrative와 추첨 한 번이 소비된다 — 일반 해(추첨 1~2번)와 달리 늘 같은 칸이 나아간다', () => {
    const { before } = find((b, a) => a.seen[YOUNGER_SIBLING_EVENT] !== undefined && b.seen[YOUNGER_SIBLING_EVENT] === undefined);
    // 같은 상태에서 강제 사건이 없는 풀로 돌리면 동생 출생은 상태 줄이 된다 — 두 갈래 모두 한 해가 정상 진행된다
    const without = createEventPool(eventPool().events.filter((e) => e.id !== YOUNGER_SIBLING_EVENT));
    const a = stepYear(before);
    const b = stepYear(before, without);
    expect(a.state.age).toBe(before.age + 1);
    expect(b.state.age).toBe(before.age + 1);
    expect(b.state.history.some((h) => h.age === before.age && h.eventId === 'fam-sib-born')).toBe(true);
    expect(b.state.history.some((h) => h.eventId === YOUNGER_SIBLING_EVENT)).toBe(false);
    expect(b.state.family!.l.some((e) => e[0] === 1 && e[2] === 21 && e[3] === 0)).toBe(true); // 풀에 사건이 없으면 로그의 부가는 0(상태 줄)
  });

  it('난수 한 칸 규칙을 칸 수로 센다 (R-560): 강제 해는 아무것도 뽑지 않은 해보다 정확히 두 칸 더 쓰고(강제 슬롯 한 칸 + 카드 해결 한 칸), 일반 추첨으로 같은 카드를 뽑은 해와 칸 수가 같다', () => {
    // 칸 수 = createRng(before.rngState)을 한 칸씩 나아가게 해 해 끝의 rngState와 만날 때까지의 횟수.
    // 아무것도 뽑지 않은 해: rollChoice · rollNarrative · (마일스톤 따짐) · 해 끝 굴림. 카드가 있는 해는 거기에 카드를 고르는 난수 한 칸(선택 해결, R-039)이 더해지고,
    // 일반 추첨의 카드는 추첨 한 칸(pickWeighted)을, 강제 카드는 추첨을 대신하는 강제 슬롯 한 칸을 더 쓴다 — 그래서 둘 다 통제 해보다 두 칸 많다.
    const used = (from: number, to: number): number => {
      const rng = createRng(from);
      for (let n = 0; n <= 40; n++) {
        if (rng.getState() === to) return n;
        rng.next();
      }
      return -1;
    };
    const card = eventPool().byId.get(YOUNGER_SIBLING_EVENT)!;
    const milestones = eventPool().events.filter((e) => e.milestone === true); // 후보가 마일스톤뿐이면 일반 추첨이 아무것도 뽑지 않는다(추첨 0칸)
    const withTrigger = createEventPool([...milestones, card]);
    const noTrigger = createEventPool(milestones);
    const asNormal = createEventPool([...milestones, { ...card, trigger: undefined }]); // 같은 카드를 일반 추첨 후보로 둔 풀
    let forcedChecked = 0;
    let normalChecked = 0;
    for (const gen of GEN) {
      for (const seed of seedsFor(40, GENERATION_IDS.indexOf(gen as (typeof GENERATION_IDS)[number]))) {
        for (const st of lifeSteps(seed, gen)) {
          const { before, state: real } = st;
          if (before.age < 2 || before.age > 5 || before.seen[YOUNGER_SIBLING_EVENT] !== undefined || before.phase !== 'life') continue;
          const control = stepYear(before, noTrigger);
          if (control.state.phase !== 'life') continue; // 사망 해는 사망 원인 뽑기가 더해져 칸 수가 달라진다
          const c = used(before.rngState, control.state.rngState);
          expect(c, `${gen}/${seed} ${before.age}세: 통제 해 칸 수(rollChoice · rollNarrative · 해 끝 굴림 + 마일스톤 따짐)`).toBeGreaterThanOrEqual(3);
          // 구성이 정한 해: 강제 슬롯
          if (real.seen[YOUNGER_SIBLING_EVENT] !== undefined) {
            const forced = stepYear(before, withTrigger);
            expect(forced.state.seen[YOUNGER_SIBLING_EVENT], `${gen}/${seed}: 강제 사건이 일어났다`).toBe(before.age);
            if (forced.state.phase === 'life') {
              expect(used(before.rngState, forced.state.rngState) - c, `${gen}/${seed} ${before.age}세: 강제 해 − 통제 해`).toBe(2);
              forcedChecked++;
            }
          }
          // 일반 추첨으로 같은 카드가 뽑힌 해(트리거 없는 풀): 강제 해와 같은 두 칸
          if (normalChecked < 40) {
            const normal = stepYear(before, asNormal);
            if (normal.state.seen[YOUNGER_SIBLING_EVENT] === before.age && normal.state.phase === 'life' && normal.tick.kind === 'resolved') {
              expect(used(before.rngState, normal.state.rngState) - c, `${gen}/${seed} ${before.age}세: 일반 추첨 해 − 통제 해`).toBe(2);
              normalChecked++;
            }
          }
        }
      }
    }
    expect(forcedChecked, '공허 통과 방지: 강제 해가 실제로 여러 번 있다').toBeGreaterThan(30);
    expect(normalChecked, '공허 통과 방지: 일반 추첨으로 뽑힌 같은 카드 해도 있다').toBeGreaterThan(10);
  });

  it('첫째가 아닌 판의 동생은 사건 없이 상태 줄로 알리고 younger_sibling을 더한다 — 둘째 이후 동생은 순서가 붙는다', () => {
    let second = 0;
    let first = 0;
    for (const seed of seedsFor(300, 2)) {
      const steps = lifeSteps(seed, 'genx');
      const last = steps[steps.length - 1].state;
      const f = last.family!;
      if (last.birthReport!.birthOrder === 1) continue;
      for (const [j, y] of f.y.entries()) {
        if (y.k > last.age) continue;
        const line = last.history.find((h) => h.age === y.k && h.eventId === 'fam-sib-born' && (j === 0 ? !h.text.includes('동생으로') : h.text.includes('동생으로')));
        expect(line, `${seed} 동생 ${j + 1}`).toBeDefined();
        expect(last.flags).toContain('younger_sibling');
        if (j === 0) first++;
        else second++;
      }
    }
    expect(first).toBeGreaterThan(30);
    expect(second).toBeGreaterThan(5);
  });

  it('구형 저장(lg)의 동생은 사건이 이미 일으켰으므로 다시 일으키지 않는다', () => {
    for (const fixture of [age0, age20]) {
      const s = parseOpened(JSON.stringify(fixture))!;
      const c = familyChangesFor(s, s.age, eventPool());
      expect(c.forcedEvent).toBeUndefined();
    }
  });
});

describe('인생 기록 줄 · 로그 · 플래그 (4-7절)', () => {
  it('한 해에 여러 줄이면 마일스톤 줄 → 가족 줄(종류 코드 오름차순) → 일반 사건 줄 순서다', () => {
    const hit = find((b, a) => {
      const added = a.history.slice(b.history.length);
      const hasFam = added.some((h) => (h.eventId ?? '').startsWith('fam-'));
      const hasMile = added.some((h) => h.kind === 'event' && !(h.eventId ?? '').startsWith('fam-') && eventPool().byId.get(h.eventId ?? '')?.milestone === true);
      return hasFam && hasMile;
    }, GEN, 300);
    const added = hit.after.history.slice(hit.before.history.length);
    const rank = (id: string | undefined): number => ((id ?? '').startsWith('fam-') ? 1 : eventPool().byId.get(id ?? '')?.milestone === true ? 0 : 2);
    const ranks = added.filter((h) => h.kind === 'event' || h.kind === 'choice').map((h) => rank(h.eventId));
    expect(ranks).toEqual([...ranks].sort());
  });

  it('줄 종류별 형식: 별세·이혼은 합쇼체 한 문장이고 원인·책임·금액이 없다 · 같은 판에서 같은 문장이 되풀이되지 않는다', () => {
    for (const seed of seedsFor(60, 0)) {
      const last = lifeSteps(seed, 'industrial').slice(-1)[0].state;
      const texts = last.history.filter((h) => (h.eventId ?? '').startsWith('fam-')).map((h) => h.text);
      expect(new Set(texts).size, `${seed}`).toBe(texts.length);
      for (const t of texts) {
        expect(t).toMatch(/습니다\.$/);
        expect(t).not.toMatch(/[!?…]|원망|탓|잘못|[0-9]+원|만 원/);
      }
    }
  });

  it('부모 한 분 별세: 줄 fam-parent-gone, mother_gone 또는 father_gone(둘 중 하나), 로그 종류 5, 다음 해부터 보기에서 gone', () => {
    const { before, after } = find((_b, a) => a.history.some((h) => h.eventId === 'fam-parent-gone') && !_b.history.some((h) => h.eventId === 'fam-parent-gone'));
    const who = after.family!.l.find((e) => e[0] === 5)!;
    expect(who[1]).toBe(before.age);
    const flag = who[2] === 1 ? 'mother_gone' : 'father_gone';
    expect(after.flags).toContain(flag);
    expect(after.flags).not.toContain(who[2] === 1 ? 'father_gone' : 'mother_gone');
    expect(familyViewOf(after).people.find((p) => p.id === (who[2] === 1 ? 'mother' : 'father'))!.state).toBe('gone');
    expect(familyViewOf(before).people.find((p) => p.id === (who[2] === 1 ? 'mother' : 'father'))!.state).not.toBe('gone');
  });

  it('조부모 별세: 줄 fam-gp-gone, has_grandparent는 마지막 분이 떠난 해에 꺼진다, 주인공이 태어나기 전에 떠난 분은 줄이 없다', () => {
    let lastGone = 0;
    for (const seed of seedsFor(200, 0)) {
      const steps = lifeSteps(seed, 'industrial');
      const fin = steps[steps.length - 1].state;
      const gpLogs = fin.family!.l.filter((e) => e[0] === 4);
      const before = fin.family!.g.length;
      void before;
      const view0 = familyViewOf(fin, 0);
      const preBirth = view0.people.filter((p) => p.role === 'grandparent' && p.state === 'gone').length;
      expect(gpLogs.length + preBirth, `${seed}: 줄이 있는 별세 + 태어나기 전 별세 ≤ 4`).toBeLessThanOrEqual(4);
      for (const e of gpLogs) expect(fin.history.some((h) => h.age === e[1] && h.eventId === 'fam-gp-gone'), `${seed}`).toBe(true);
      if (gpLogs.length + preBirth === 4 && fin.age > (gpLogs.length > 0 ? gpLogs[gpLogs.length - 1][1] : 0)) {
        lastGone++;
        expect(fin.flags).not.toContain('has_grandparent');
      }
    }
    expect(lastGone).toBeGreaterThan(5);
  });

  it('이혼·별거: 줄 fam-parents-apart, father_apart 또는 mother_apart, 떠난 쪽 조부모는 다음 해부터 따로 산다 (R-537), 재혼·의붓 없음', () => {
    let sameSide = 0;
    let otherSide = 0;
    for (const gi of [4, 5, 6]) {
      for (const seed of seedsFor(250, gi)) {
        const steps = lifeSteps(seed, GENERATION_IDS[gi]);
        const fin = steps[steps.length - 1].state;
        const sc = familyScheduleOf(fin);
        if (sc.divorce === null) continue;
        const at = sc.divorce.at;
        if (fin.age <= at) continue;
        const flag = sc.divorce.leaver === 1 ? 'father_apart' : 'mother_apart';
        expect(fin.flags, `${seed}`).toContain(flag);
        expect(fin.history.some((h) => h.age === at && h.eventId === 'fam-parents-apart')).toBe(true);
        const side = sc.divorce.leaver === 1 ? 1 : 2;
        const cohab = fin.family!.c;
        const afterView = familyViewOf(fin, Math.min(at + 1, 19));
        const grandsWith = afterView.people.filter((p) => p.role === 'grandparent' && p.state === 'with');
        if (cohab === side && at + 1 <= 19) {
          expect(grandsWith, `${seed}: 떠난 부모 쪽 조부모는 따로 산다`).toEqual([]);
          sameSide++;
        } else if (cohab !== 0 && cohab !== side && at + 1 <= 19) {
          // 반대 쪽 조부모는 살아 계시면 계속 함께 산다(별세는 따로)
          const stillAlive = afterView.people.some((p) => p.role === 'grandparent' && p.state !== 'gone' && (cohab === 1 ? p.id === 'pgf' || p.id === 'pgm' : p.id === 'mgf' || p.id === 'mgm'));
          if (stillAlive) expect(grandsWith.length, `${seed}`).toBeGreaterThan(0);
          otherSide++;
        }
      }
    }
    expect(sameSide, '공허 통과 방지').toBeGreaterThan(0);
    expect(otherSide, '공허 통과 방지').toBeGreaterThan(0);
  });

  it('형제 독립: 함께 살던 형제가 독립 나이를 넘기는 해에 줄 하나, 주인공이 어른이 되어 따로 사는 형제는 줄이 없다', () => {
    let lines = 0;
    for (const seed of seedsFor(120, 2)) {
      const steps = lifeSteps(seed, 'genx');
      for (const { before, state } of steps) {
        const added = state.history.slice(before.history.length).filter((h) => h.eventId === 'fam-sib-left');
        for (const h of added) {
          expect(h.text).toMatch(/살 (위인|아래인) .+ 독립해 집을 나섰습니다\.$/);
          // 줄이 남는 해에는 그 형제가 함께 살고 있었다
          const v = familyViewOf(before);
          expect(v.household.some((id) => id.startsWith('o') || id.startsWith('y')), `${seed} ${h.age}세`).toBe(true);
          lines++;
        }
      }
    }
    expect(lines).toBeGreaterThan(20);
  });

  it('가림(4-9절): 설정이 켜져 있어도 상태·플래그·로그는 그대로다 — 줄의 분류는 글자 표(eventId 접두어)로 잡는다', () => {
    const s = lifeSteps(seedsFor(1, 0)[0], 'industrial').slice(-1)[0].state;
    expect(s.family!.l.length).toBeGreaterThan(0);
  });

  it('가림 전수 (R-560): 7세대 × 120판의 모든 가족 줄이 글자 표대로 분류되고, 분류가 붙은 줄(별세·이혼)은 가림을 켜면 문장이 가려지는 줄이다 — 분류 없는 줄(동생 출생·독립)은 가리지 않는다', () => {
    const counts = { loss: 0, home: 0, plain: 0 };
    for (const gen of GEN) {
      for (const seed of seedsFor(120, GENERATION_IDS.indexOf(gen as (typeof GENERATION_IDS)[number]))) {
        const last = lifeSteps(seed, gen).slice(-1)[0].state;
        for (const h of last.history.filter((x) => (x.eventId ?? '').startsWith('fam-'))) {
          const want = FAMILY_LINE_HEAVY[h.eventId!] ?? null;
          const kind = heavyKindOfEntry(h);
          expect(kind, `${gen}/${seed} ${h.eventId}`).toBe(want);
          // 가림이 켜진 로그(LogList·EndingScreen)는 분류가 있는 줄의 문장을 보이지 않는다 — 그 분류의 줄만 가림 대상이다
          if (kind === 'loss') counts.loss++;
          else if (kind === 'home') counts.home++;
          else {
            expect(kind).toBeNull();
            counts.plain++;
          }
        }
      }
    }
    expect(counts.loss, '별세 줄').toBeGreaterThan(50);
    expect(counts.home, '이혼 줄').toBeGreaterThan(5);
    expect(counts.plain, '분류 없는 줄').toBeGreaterThan(50);
  });
});

describe('판 길이 모델 (FA0-7): 가족 줄은 연표 줄과 같은 규칙으로 센다', () => {
  it('yearLineCount는 fam- 줄을 센다 · 가족 줄만 있는 해는 서술 해(tick.kind narrative, familyIds, lines)로 센다 · 다른 줄이 있는 해는 lines에 합쳐진다', () => {
    let famOnly = 0;
    let mixed = 0;
    for (const seed of seedsFor(160, 2)) {
      let s = startLife(seed, 'genx');
      for (let g = 0; s.phase === 'life' && g < 400; g++) {
        const before = s;
        const r = stepYear(s);
        const added = r.state.history.slice(before.history.length);
        const fam = added.filter((h) => (h.eventId ?? '').startsWith('fam-'));
        if (r.state.pending === null && fam.length > 0 && r.tick.by === undefined && r.tick.kind !== 'death' && r.tick.kind !== 'resolved') {
          expect(r.tick.familyIds, `${seed} ${before.age}세`).toEqual(fam.map((h) => h.eventId));
          expect(r.tick.kind, `${seed} ${before.age}세: 가족 줄이 있는 해는 서술 해`).toBe('narrative');
          const others = added.filter((h) => (h.kind === 'event' || h.kind === 'choice') && !(h.eventId ?? '').startsWith('fam-'));
          expect(r.tick.lines, `${seed} ${before.age}세`).toBe(fam.length + others.length);
          if (others.length === 0) famOnly++;
          else mixed++;
        }
        s = r.state;
        while (s.pending !== null) s = autoResolveStep(s, s.pending.key).state;
      }
    }
    expect(famOnly, '가족 줄만 있는 해').toBeGreaterThan(20);
    expect(mixed, '다른 줄과 함께 있는 해').toBeGreaterThan(5);
  });
});

describe('이른 부모 별세 효과 (4-7절 (1), A-6 초안)', () => {
  const rule = () => familyTables().design.earlyLoss.value;

  it('주인공 19세 이하에 한 분이 떠나는 해에 한 번만 행복 −8 · 관계 −2 · 건강 −1과 집안 살림이 더해진다 (켜짐 vs 꺼짐)', () => {
    let checked = 0;
    for (const gi of [0, 1, 2]) {
      for (const seed of seedsFor(200, gi)) {
        const on = lifeSteps(seed, GENERATION_IDS[gi]);
        const idx = on.findIndex((st) => st.state.history.some((h) => h.eventId === 'fam-parent-gone' && h.age === st.before.age && !st.before.history.some((x) => x.eventId === 'fam-parent-gone')));
        if (idx < 0 || on[idx].before.age > rule().maxAge) continue;
        const { before } = on[idx];
        const c = familyChangesFor(before, before.age, eventPool());
        expect(c.effects, `${seed}`).toBeDefined();
        expect(c.effects!.stats).toEqual({ happiness: -8, relationships: -2, health: -1 });
        const who = c.log.find((e) => e[0] === 5)![2];
        const w = before.family!.p[0].w === 1;
        const base = who === 2 ? rule().family.father : w ? rule().family.motherHomemaker : rule().family.mother;
        expect(c.effects!.family).toBe(Math.round(base * rule().wealthMultiplier[before.character!.parentWealth - 1]));
        // 적용: 스탯·집안 살림이 그만큼 바뀐다(스탯은 0~100으로 자른다)
        const applied = applyFamilyChanges(before, c);
        expect(applied.stats.happiness).toBe(Math.max(0, before.stats.happiness - 8));
        expect(applied.stats.relationships).toBe(Math.max(0, before.stats.relationships - 2));
        expect(applied.stats.health).toBe(Math.max(0, before.stats.health - 1));
        expect(applied.familyFund).toBe(Math.max(-3000, Math.min(3000, before.familyFund + c.effects!.family)));
        // 한 번만: 다음 해에는 효과가 없다
        expect(familyChangesFor(applied, before.age + 1, eventPool()).effects).toBeUndefined();
        checked++;
        break;
      }
    }
    expect(checked, '공허 통과 방지').toBeGreaterThan(0);
  });

  it('20세 이상에 떠나면 기록 전용이다(스탯·집안 살림·자산 영향 0) · 효과를 끄면(enabled: false) 19세 이하도 기록 전용이다', () => {
    let late = 0;
    for (const seed of seedsFor(300, 0)) {
      const on = lifeSteps(seed, 'industrial');
      for (const { before, state } of on) {
        const gone = state.history.find((h) => h.eventId === 'fam-parent-gone' && h.age === before.age);
        if (gone === undefined || before.history.some((h) => h.eventId === 'fam-parent-gone')) continue;
        const c = familyChangesFor(before, before.age, eventPool());
        if (before.age > rule().maxAge) {
          expect(c.effects).toBeUndefined();
          late++;
        } else {
          withEarlyLoss(false, () => expect(familyChangesFor(before, before.age, eventPool()).effects).toBeUndefined());
        }
      }
    }
    expect(late).toBeGreaterThan(5);
  });

  it('수치는 설계 표에서 읽는다(A-6 초안): 행복 −8 · 관계 −2 · 건강 −1, 아버지 −500 · 어머니 −300(집안일 −150), 재력 배율 0.8~2.0, 19세 이하', () => {
    const r = rule();
    expect(r.stats).toEqual({ happiness: -8, relationships: -2, health: -1 });
    expect(r.family).toEqual({ father: -500, mother: -300, motherHomemaker: -150 });
    expect(r.wealthMultiplier).toEqual([0.8, 1.0, 1.2, 1.6, 2.0]);
    expect(r.maxAge).toBe(19);
    expect(r.enabled).toBe(true);
  });
});

describe('옛 저장(lg) 이어하기: 지난 해를 소급하지 않고 앞으로의 해만 새 규칙이다', () => {
  for (const [name, fixture] of [['0세', age0], ['20세', age20], ['65세', age65]] as const) {
    it(`${name}: 열린 뒤 끝까지 돌려도 fam- 줄과 로그는 연 나이 이후에만 생기고, 옛 인생 기록은 그대로다`, () => {
      const opened = parseOpened(JSON.stringify(fixture))!;
      expect(opened.family!.lg).toBe(1);
      const startAge = opened.age;
      const oldHistory = opened.history;
      let s: GameState = opened;
      for (let g = 0; s.phase === 'life' && g < 300; g++) {
        let r = stepYear(s);
        while (r.state.pending !== null) r = autoResolveStep(r.state, r.state.pending.key);
        s = r.state;
      }
      expect(s.history.slice(0, oldHistory.length), `${name}: 옛 줄이 그대로`).toEqual(oldHistory);
      for (const h of s.history.filter((x) => (x.eventId ?? '').startsWith('fam-'))) expect(h.age, `${name}: 소급 줄`).toBeGreaterThanOrEqual(startAge);
      for (const e of s.family!.l) expect(e[1], `${name}: 소급 로그`).toBeGreaterThanOrEqual(startAge);
      expect(s.family!.lg).toBe(1);
    });

    it(`${name}: 시스템 플래그는 첫 걸음의 차이로 맞춰진다 — 보기에서 파생한 집합과 같아진다`, () => {
      const opened = parseOpened(JSON.stringify(fixture))!;
      if (opened.phase !== 'life' || opened.pending !== null) return;
      const r = stepYear(opened);
      const managed = ['has_grandparent', 'lives_with_grandparent', 'has_older_sibling', 'has_younger_sibling', 'has_sibling', 'mother_gone', 'father_gone', 'mother_apart', 'father_apart'];
      const view = familyViewOf(r.state);
      const have = new Set(r.state.flags.filter((f) => managed.includes(f)));
      for (const f of managed) {
        // 옛 저장에는 이미 지난 변화의 로그가 없어(소급 0) 먼저 떠난 분의 플래그는 보기에서 파생한다
        const derived = deriveFamilyFlags(view, r.state.family!.l);
        expect(have.has(f), `${name} ${f}`).toBe(derived.has(f));
      }
    });
  }
});

describe('R-540: 옛 저장 스냅샷에서 이미 본 동생보다 앞선 이혼·별세 계획은 없다', () => {
  it('동생을 이미 본(seen) 첫째 판의 스냅샷: 이혼 계획 없음 또는 동생 뒤, 부모 별세 시점 ≥ 동생이 태어난 나이 (INV-2b)', () => {
    let checked = 0;
    for (const gi of [0, 2, 4]) {
      for (const seed of seedsFor(400, gi)) {
        const base = startLife(seed, GENERATION_IDS[gi]);
        if (base.birthReport!.birthOrder !== 1) continue;
        for (const k of [2, 3, 4, 5]) {
          const legacy: GameState = { ...base, family: undefined, seen: { [YOUNGER_SIBLING_EVENT]: k }, age: k + 1 };
          const fam = legacyFamilyFrom(legacy);
          expect(fam.y).toHaveLength(1);
          const sc = familyScheduleOf({ ...legacy, family: fam });
          if (sc.divorce !== null) expect(sc.divorce.at, `${GENERATION_IDS[gi]}/${seed}/k${k}: 이혼 ≥ 동생`).toBeGreaterThanOrEqual(k);
          if (sc.firstGone !== null) expect(sc.firstGone.at, `${GENERATION_IDS[gi]}/${seed}/k${k}: 별세 ≥ 동생`).toBeGreaterThanOrEqual(k);
          checked++;
        }
      }
    }
    expect(checked).toBeGreaterThan(400);
  });

  it('새 판 방식으로 만든 가족은 이 규칙을 쓰지 않는다(lg가 없다): 동생을 구성이 정하고 계획이 동생을 끊는다', () => {
    const b = startLife(3, 'genx');
    expect(b.family!.lg).toBeUndefined();
  });
});

