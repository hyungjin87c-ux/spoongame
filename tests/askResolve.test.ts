import { describe, expect, it, vi } from 'vitest';
import '../src/data/installAll';
import {
  askBranchProbs,
  askCloseness,
  askGrantChance,
  askOutcomeOf,
  askRolls,
  askStrainChance,
  closenessOf,
  createEventPool,
  familyCardOf,
  playToEnd,
  previewChoice,
  previewPending,
  resolveChoiceStep,
  type EventDef,
  type GameState,
  type ParentingStyle,
  type ParentWealth,
} from '../src/core';
import { ASK_EFFECTS, ASK_KINDS, type AskChoiceId, type AskEffectKey, type AskKind } from '../src/data/askTable';
import { askEvent } from './helpers/askEvents';
import { askPendingState, askPoolOf } from './helpers/askForced';

/**
 * 조르기 해결 경로·사이 비용 (SPEC-011 AK4·AK5 — `docs/data/ask-model.md` 3·4절, 완료 기준 4·7·8·9의 코어 부분).
 * 실제 사건 9개는 AK7이라 합성 사건(`tests/helpers/askEvents.ts`)과 직접 만든 대기 상태(`tests/helpers/askForced.ts`)로 본다.
 * 큰 시험은 「조르기 해결 = 같은 효과를 가진 일반 선택의 해결」이라는 **동치**다: 일어난 갈래를 연표 문장으로 읽어(해결 코드와 따로) 그 갈래의 `ASK_EFFECTS` 효과를 가진 일반 사건으로 같은 상태를 해결한 결과와
 * 상태 전체(스탯·집안 살림·플래그·`lastChoiceAge`·연표 줄·`rngState`)가 한 글자도 다르지 않다 — 그래서 EC5(실제 효과 = 표의 해당 갈래)가 갈래별로 닫힌다.
 */

const PARENTINGS: readonly ParentingStyle[] = ['neglect', 'strict', 'free', 'helicopter'];
const WEALTHS: readonly ParentWealth[] = [1, 2, 3, 4, 5];
const EV: Record<AskKind, EventDef> = { toy: askEvent('ask-toy-x', 'toy'), lessons: askEvent('ask-lessons-x', 'lessons'), pet: askEvent('ask-pet-x', 'pet') };
const AGE_MIN: Record<AskKind, number> = { toy: 4, lessons: 5, pet: 5 };
const CHOICES: readonly AskChoiceId[] = ['beg', 'tantrum', 'endure'];

/** i번째 상태: 종류·재력·양육 방식·나이·시드를 돌려 가며 섞는다 */
function stateAt(kind: AskKind, i: number): GameState {
  const age = AGE_MIN[kind] + (i % (13 - AGE_MIN[kind]));
  return askPendingState(EV[kind], { seed: 1 + (i % 9), peerSeed: (i + 1) * 7919, parenting: PARENTINGS[i % 4], wealth: WEALTHS[(i >> 2) % 5], age });
}

/** 일어난 갈래를 연표 줄 문장에서 읽는다 — `askOutcomeOf`를 거치지 않는 독립 판독 */
function branchFromText(kind: AskKind, choiceId: AskChoiceId, text: string): AskEffectKey {
  const c = EV[kind].choices!.find((x) => x.id === choiceId)!;
  if (choiceId === 'endure') return 'endure';
  if (text === c.result) return `granted-${kind}`;
  if (text === c.askStrained) return 'strained';
  if (text === c.askDenied) return choiceId === 'beg' ? 'denied-beg' : 'denied-tantrum';
  throw new Error(`연표 문장이 어느 갈래도 아니다: ${text}`);
}

/** 그 사건이 남긴 연표 줄 (해 끝 규칙의 단계 줄 등이 뒤에 붙을 수 있다 — 마지막 줄이 아니라 사건 id로 찾는다) */
function lineOf(state: GameState, eventId: string): GameState['history'][number] {
  const line = state.history.filter((h) => h.eventId === eventId).pop();
  if (line === undefined) throw new Error(`연표에 ${eventId} 줄이 없다`);
  return line;
}

/** 같은 효과를 가진 일반(조르기 아닌) 사건 — `ask`가 없고 선택지 하나가 그 갈래의 효과·문장을 가진다 */
function plainTwin(kind: AskKind, choiceId: AskChoiceId, branch: AskEffectKey, text: string): EventDef {
  const { ask: _ask, askPeers: _peers, ...rest } = EV[kind] as EventDef & { askPeers?: string[] };
  void _ask;
  void _peers;
  const label = EV[kind].choices!.find((c) => c.id === choiceId)!.label;
  return { ...rest, choices: [{ id: choiceId, label, result: text, effects: ASK_EFFECTS[branch] }, { id: 'other', label: '다른 길', result: '다른 길로 갔습니다.' }] } as EventDef;
}

describe('AK4 해결 경로 — 일어난 갈래의 실제 효과 = ASK_EFFECTS의 해당 갈래 (EC5 갈래별, 일반 선택과 같은 경로)', () => {
  it('종류 3 × 선택 3 × 상태 다수: 해결 결과가 「그 갈래의 효과를 가진 일반 선택」의 해결과 상태 전체가 같다 — 일곱 갈래가 모두 나온다', () => {
    const seen = new Map<AskEffectKey, number>();
    const N = 360;
    for (const kind of ASK_KINDS) {
      const pool = askPoolOf(EV[kind]);
      for (let i = 0; i < N; i++) {
        const s = stateAt(kind, i);
        for (const choiceId of CHOICES) {
          const r = resolveChoiceStep(s, s.pending!.key, choiceId, pool);
          expect(r.tick.kind, `${kind}#${i}/${choiceId}`).toBe('resolved');
          const line = lineOf(r.state, EV[kind].id);
          const branch = branchFromText(kind, choiceId, line.text);
          seen.set(branch, (seen.get(branch) ?? 0) + 1);
          // 일반 선택으로 같은 효과를 해결한 기준
          const twin = plainTwin(kind, choiceId, branch, line.text);
          const ref = resolveChoiceStep({ ...s, pending: { ...s.pending!, choiceIds: [choiceId, 'other'] } }, s.pending!.key, choiceId, createEventPool([twin]));
          expect(r.state, `${kind}#${i}/${choiceId}/${branch}`).toEqual(ref.state);
          expect(r.tick).toEqual(ref.tick);
        }
      }
    }
    // 일곱 갈래가 모두 시험됐다
    expect([...seen.keys()].sort()).toEqual(['denied-beg', 'denied-tantrum', 'endure', 'granted-lessons', 'granted-pet', 'granted-toy', 'strained']);
    for (const [k, n] of seen) expect(n, k).toBeGreaterThan(20);
  });

  it('결과 줄은 일반 선택 줄과 같은 모양이다 — kind choice, 제목·라벨·문장·eventId, by 없음 (새 줄 종류·새 저장 필드 없음)', () => {
    const s = stateAt('toy', 3);
    const r = resolveChoiceStep(s, s.pending!.key, 'tantrum', askPoolOf(EV.toy));
    const line = lineOf(r.state, 'ask-toy-x');
    expect(Object.keys(line).sort()).toEqual(['age', 'choice', 'eventId', 'kind', 'text', 'title']);
    expect(line).toMatchObject({ age: s.age, kind: 'choice', title: EV.toy.title, choice: '떼를 쓴다', eventId: 'ask-toy-x' });
    expect(r.state.pending).toBeNull();
    expect(r.state.lastChoiceAge).toBe(s.age);
    expect(r.tick).toMatchObject({ kind: 'resolved', fromAge: s.age, eventId: 'ask-toy-x' });
    expect('by' in r.tick).toBe(false);
  });

  it('갈래 판정 = 식 그대로: 조른다 → u1 < p이면 들어주기, 아니면 거절 · 떼쓴다 → u1 < p 들어주기, 아니면 u2 < s(C)이면 사이 나빠짐 (askOutcomeOf)', () => {
    let granted = 0;
    let strained = 0;
    let denied = 0;
    for (const kind of ASK_KINDS) {
      for (let i = 0; i < 300; i++) {
        const s = stateAt(kind, i);
        const { u1, u2 } = askRolls(s, EV[kind]);
        const sc = Math.min(0.8, Math.max(0.2, 0.5 + 0.1 * (3 - askCloseness(s))));
        expect(askStrainChance(s)).toBeCloseTo(sc, 12);
        const beg = askOutcomeOf(s, EV[kind], 'beg');
        expect(beg.branch).toBe(u1 < askGrantChance(s, EV[kind], 'beg') ? `granted-${kind}` : 'denied-beg');
        const tan = askOutcomeOf(s, EV[kind], 'tantrum');
        expect(tan.branch).toBe(u1 < askGrantChance(s, EV[kind], 'tantrum') ? `granted-${kind}` : u2 < sc ? 'strained' : 'denied-tantrum');
        expect(askOutcomeOf(s, EV[kind], 'endure').branch).toBe('endure');
        // u1을 조르기·떼쓰기가 공유한다: 조르기가 들어주기이면 떼쓰기도 들어주기
        if (beg.branch.startsWith('granted')) expect(tan.branch).toBe(`granted-${kind}`);
        if (tan.branch === `granted-${kind}`) granted++;
        else if (tan.branch === 'strained') strained++;
        else denied++;
      }
    }
    expect(granted).toBeGreaterThan(0);
    expect(strained).toBeGreaterThan(0);
    expect(denied).toBeGreaterThan(0);
  });

  it('효과·문장은 표와 선택지 필드에서 온다: 들어주기 = 표 granted-<종류> + result, 거절 = askDenied, 사이 나빠짐 = askStrained + 표 strained', () => {
    for (const kind of ASK_KINDS) {
      let found = 0;
      for (let i = 0; i < 400 && found < 3; i++) {
        const s = stateAt(kind, i);
        const o = askOutcomeOf(s, EV[kind], 'tantrum');
        const c = EV[kind].choices!.find((x) => x.id === 'tantrum')!;
        if (o.branch === 'strained') {
          expect(o.effects).toBe(ASK_EFFECTS.strained);
          expect(o.text).toBe(c.askStrained);
          found++;
        } else if (o.branch === 'denied-tantrum') {
          expect(o.effects).toBe(ASK_EFFECTS['denied-tantrum']);
          expect(o.text).toBe(c.askDenied);
        } else {
          expect(o.effects).toBe(ASK_EFFECTS[`granted-${kind}`]);
          expect(o.text).toBe(c.result);
        }
      }
      expect(found, kind).toBeGreaterThan(0);
    }
    const s = stateAt('toy', 0);
    expect(askOutcomeOf(s, EV.toy, 'endure')).toEqual({ branch: 'endure', effects: ASK_EFFECTS.endure, text: EV.toy.choices![2].result });
    expect(() => askOutcomeOf(s, { ...EV.toy, ask: undefined }, 'beg')).toThrow(/조르기 사건이 아니다/);
    expect(() => askOutcomeOf(s, { ...EV.toy, choices: [] }, 'beg')).toThrow(/선택지를 찾을 수 없다/);
    // 거절 문장이 빠진 사건(검증이 막는 모양)은 거절 갈래에서 던진다 — 문장 없이 조용히 다른 글을 쓰지 않는다
    const noDenied = { ...EV.toy, choices: EV.toy.choices!.map((c) => (c.id === 'beg' ? { ...c, askDenied: undefined } : c)) };
    let threw = 0;
    for (let i = 0; i < 100; i++) {
      const st = stateAt('toy', i);
      if (askOutcomeOf(st, EV.toy, 'beg').branch === 'denied-beg') {
        expect(() => askOutcomeOf(st, noDenied, 'beg')).toThrow(/askDenied/);
        threw++;
      }
    }
    expect(threw).toBeGreaterThan(0);
  });

  it('갈래 확률(askBranchProbs)의 합은 1이고 갈래 키가 표에 있다 — 조른다 둘 · 떼쓴다 셋 · 참는다 하나', () => {
    const lens = { beg: 2, tantrum: 3, endure: 1 };
    for (const kind of ASK_KINDS) {
      for (let i = 0; i < 60; i++) {
        const s = stateAt(kind, i);
        for (const c of CHOICES) {
          const probs = askBranchProbs(s, EV[kind], c);
          expect(probs.length).toBe(lens[c]);
          expect(probs.reduce((n, x) => n + x.prob, 0)).toBeCloseTo(1, 12);
          for (const { key, prob } of probs) {
            expect(Object.keys(ASK_EFFECTS)).toContain(key);
            expect(prob).toBeGreaterThanOrEqual(0);
          }
        }
        // 조른다·떼쓴다의 들어주기 확률 = askGrantChance
        expect(askBranchProbs(s, EV[kind], 'beg')[0].prob).toBe(askGrantChance(s, EV[kind], 'beg'));
        expect(askBranchProbs(s, EV[kind], 'tantrum')[0].prob).toBe(askGrantChance(s, EV[kind], 'tantrum'));
      }
    }
  });

  it('갈래 빈도 = 갈래 확률 (4σ): 해시 갈래의 실제 비율이 askBranchProbs의 기대값과 맞는다 — 조른다·떼쓴다 모두', () => {
    for (const choice of ['beg', 'tantrum'] as const) {
      const N = 4000;
      const exp = new Map<AskEffectKey, number>();
      const vari = new Map<AskEffectKey, number>();
      const got = new Map<AskEffectKey, number>();
      for (let i = 0; i < N; i++) {
        const s = stateAt('toy', i * 3 + 1);
        for (const { key, prob } of askBranchProbs(s, EV.toy, choice)) {
          exp.set(key, (exp.get(key) ?? 0) + prob);
          vari.set(key, (vari.get(key) ?? 0) + prob * (1 - prob));
        }
        const b = askOutcomeOf(s, EV.toy, choice).branch;
        got.set(b, (got.get(b) ?? 0) + 1);
      }
      for (const [key, e] of exp) expect(Math.abs((got.get(key) ?? 0) - e), `${choice}/${key} 기대 ${e.toFixed(1)} 실제 ${got.get(key) ?? 0}`).toBeLessThanOrEqual(4 * Math.sqrt(vari.get(key)!));
    }
  });

  it('진행 난수는 선택 하나에 한 칸 — 같은 상태에서 세 선택지 모두 이후 rngState가 같다 (완료 기준 4)', () => {
    for (const kind of ASK_KINDS) {
      const pool = askPoolOf(EV[kind]);
      for (let i = 0; i < 80; i++) {
        const s = stateAt(kind, i);
        const states = CHOICES.map((c) => resolveChoiceStep(s, s.pending!.key, c, pool).state.rngState);
        expect(new Set(states).size, `${kind}#${i}`).toBe(1);
        expect(states[0]).not.toEqual(s.rngState); // 난수 한 칸 + 해 끝 규칙
      }
    }
  });

  it('연타·새로고침: 같은 상태에서 같은 선택은 같은 결과, 해결된 뒤의 두 번째 입력·틀린 키·틀린 선택지는 아무 일도 아니다 — 한 번만 해결된다', () => {
    const s = stateAt('lessons', 5);
    const pool = askPoolOf(EV.lessons);
    for (const c of CHOICES) {
      const a = resolveChoiceStep(s, s.pending!.key, c, pool);
      const b = resolveChoiceStep(s, s.pending!.key, c, pool);
      expect(a.state).toEqual(b.state); // 새로고침 뒤 같은 카드를 다시 풀어도 같은 결과(해시)
      const again = resolveChoiceStep(a.state, s.pending!.key, c, pool); // 연타: 이미 해결됐다(pending이 비었다)
      expect(again.state).toBe(a.state);
      expect(a.state.history.filter((h) => h.eventId === 'ask-lessons-x')).toHaveLength(1);
    }
    expect(resolveChoiceStep(s, 'ask-lessons-x@99', 'beg', pool).state).toBe(s);
    expect(resolveChoiceStep(s, s.pending!.key, 'nothing', pool).state).toBe(s);
    expect(resolveChoiceStep({ ...s, pending: { ...s.pending!, choiceIds: ['endure'] } }, s.pending!.key, 'beg', pool).tick.kind).toBe('none'); // 화면에 보인 선택지가 아니면 무시
  });

  it('순수하다: 판정·해결이 입력 상태를 바꾸지 않고 Math.random·Date를 쓰지 않는다', () => {
    const s = stateAt('pet', 7);
    const before = JSON.stringify(s);
    const rnd = vi.spyOn(Math, 'random');
    const now = vi.spyOn(Date, 'now');
    for (const c of CHOICES) {
      askOutcomeOf(s, EV.pet, c);
      resolveChoiceStep(s, s.pending!.key, c, askPoolOf(EV.pet));
    }
    expect(rnd).not.toHaveBeenCalled();
    expect(now).not.toHaveBeenCalled();
    rnd.mockRestore();
    now.mockRestore();
    expect(JSON.stringify(s)).toBe(before);
  });

  it('들어주기: 집안 살림이 표대로 줄고(장난감 −100 · 예체능 −300 · 강아지 −150), 강아지 입양은 pet_dog를 켠다 — 참는다·거절은 집안 살림·플래그가 그대로다', () => {
    const FAM: Record<AskKind, number> = { toy: -100, lessons: -300, pet: -150 };
    for (const kind of ASK_KINDS) {
      const pool = askPoolOf(EV[kind]);
      let grantedN = 0;
      for (let i = 0; i < 200; i++) {
        const s = stateAt(kind, i);
        const base = resolveChoiceStep(s, s.pending!.key, 'endure', pool).state; // 참는다: 집안 살림 변화 없음 — 같은 한 해 규칙이 얹힌 기준
        expect(base.flags).toEqual(s.flags);
        const r = resolveChoiceStep(s, s.pending!.key, 'beg', pool);
        const branch = branchFromText(kind, 'beg', lineOf(r.state, EV[kind].id).text);
        if (branch === `granted-${kind}`) {
          grantedN++;
          expect(r.state.familyFund - base.familyFund, `${kind}#${i}`).toBe(FAM[kind]);
          expect(r.state.flags.includes('pet_dog')).toBe(kind === 'pet');
        } else {
          expect(r.state.familyFund, `${kind}#${i}`).toBe(base.familyFund);
          expect(r.state.flags).toEqual(s.flags);
        }
      }
      expect(grantedN, kind).toBeGreaterThan(0);
    }
  });

  it('영향 줄(PD8): 조른다·떼쓴다는 효과 필드가 없어 영향이 비어 있고(화면이 고정 한 줄), 참는다는 확정 효과가 영향 줄로 나온다', () => {
    const s = stateAt('toy', 2);
    const pool = askPoolOf(EV.toy);
    const [beg, tantrum, endure] = previewPending(s, pool)!;
    expect(beg.impact.items).toEqual([]);
    expect(tantrum.impact.items).toEqual([]);
    expect(endure.impact.items.map((it) => `${it.key}.${it.direction}`)).toEqual(['happiness.down']);
    expect(previewChoice(s, EV.toy.choices![0]).items).toEqual([]);
  });
});

describe('AK5 사이 비용 — 떼쓰다 거절당했을 때만 parent_strained · 관계 −1 · 사이 한 단계 아래', () => {
  it('s(C) = clamp(0.50 + 0.10 × (3 − C), 0.20, 0.80): C 1~5가 0.70 · 0.60 · 0.50 · 0.40 · 0.30', () => {
    const byC = new Map<number, number>();
    for (let i = 0; i < 4000 && byC.size < 5; i++) {
      const s = stateAt('toy', i);
      const c = askCloseness(s);
      if (!byC.has(c)) byC.set(c, askStrainChance(s));
    }
    expect([...byC.keys()].sort()).toEqual([1, 2, 3, 4, 5]);
    for (const [c, sc] of byC) expect(sc, `C${c}`).toBeCloseTo([0, 0.7, 0.6, 0.5, 0.4, 0.3][c], 12);
  });

  it('parent_strained는 떼쓰기가 거절당한 갈래에서만 켜진다 — 조른다·참는다·들어주기에서는 0건, 켜진 갈래는 askStrained 문장이다', () => {
    const tally = { strainedBranch: 0, flagElsewhere: 0 };
    for (const kind of ASK_KINDS) {
      const pool = askPoolOf(EV[kind]);
      for (let i = 0; i < 300; i++) {
        const s = stateAt(kind, i);
        for (const c of CHOICES) {
          const r = resolveChoiceStep(s, s.pending!.key, c, pool);
          const branch = branchFromText(kind, c, lineOf(r.state, EV[kind].id).text);
          const on = r.state.flags.includes('parent_strained');
          if (branch === 'strained') {
            tally.strainedBranch++;
            expect(on, `${kind}#${i}`).toBe(true);
            expect(c).toBe('tantrum');
          } else {
            if (on) tally.flagElsewhere++;
            expect(on, `${kind}#${i}/${c}/${branch}`).toBe(false);
          }
        }
      }
    }
    expect(tally.strainedBranch).toBeGreaterThan(30);
    expect(tally.flagElsewhere).toBe(0);
    // 표의 두 가지 불변: 사이 나빠짐 갈래만 플래그를 켜고, 방향(관계 −1)이 사이 표(−1)와 같다
    const setters = (Object.keys(ASK_EFFECTS) as AskEffectKey[]).filter((k) => (ASK_EFFECTS[k].setFlags ?? []).includes('parent_strained'));
    expect(setters).toEqual(['strained']);
    expect(ASK_EFFECTS.strained.stats?.relationships).toBe(-1);
  });

  it('떼쓰다 거절당한 가운데 사이 나빠짐의 비율 = s(C)의 기대값과 4σ 안이다 (완료 기준 7)', () => {
    let denied = 0;
    let strained = 0;
    let e = 0;
    let v = 0;
    for (let i = 0; i < 6000; i++) {
      const s = stateAt('toy', i * 2 + 1);
      const o = askOutcomeOf(s, EV.toy, 'tantrum');
      if (o.branch === 'granted-toy') continue;
      denied++;
      const sc = askStrainChance(s);
      e += sc;
      v += sc * (1 - sc);
      if (o.branch === 'strained') strained++;
    }
    expect(denied).toBeGreaterThan(500);
    expect(Math.abs(strained - e), `기대 ${e.toFixed(1)} 실제 ${strained}`).toBeLessThanOrEqual(4 * Math.sqrt(v));
  });

  it('켜진 뒤 closenessOf(어머니·아버지)가 한 단계 내려가고(최소 1), 가족 카드의 사이 말도 같이 바뀐다 · 다른 호칭은 안 바뀐다 — 「아주 가까움」(5)이 합산 6 이상에서 온 부모만 5에 남는다 (아래 흡수 계수)', () => {
    let lowered = 0;
    let floored = 0;
    let top = 0;
    let absorbed = 0;
    for (let i = 0; i < 1500; i++) {
      const s = stateAt('toy', i);
      const on: GameState = { ...s, flags: [...s.flags, 'parent_strained'].sort() };
      for (const [id, role] of [['mother', 'mother'], ['father', 'father']] as const) {
        const before = closenessOf({ id, role }, s);
        const after = closenessOf({ id, role }, on);
        if (before === 5) {
          // 합산이 5를 넘는 부모(기본 4 + 과보호 +1 + 시드 +1 = 6)는 한 칸 내려도 5로 잘려 사이 말이 그대로다 — 표(`closenessOf`)가 합을 마지막에 한 번 자르는 기존 구조(FM6)의 결과
          top++;
          expect([4, 5], `${i}/${id}`).toContain(after);
          if (after === 5) absorbed++;
        } else expect(after, `${i}/${id}`).toBe(Math.max(1, before - 1)); // 1~4단계는 정확히 한 단계(최소 1)
        if (before > 1) lowered++;
        else floored++;
      }
      for (const [id, role] of [['pgf', 'grandparent'], ['o1', 'sibling'], ['f1', 'friend']] as const) expect(closenessOf({ id, role }, on)).toBe(closenessOf({ id, role }, s));
    }
    expect(lowered).toBeGreaterThan(100);
    expect(floored).toBeGreaterThan(0); // 이미 1단계인 판은 1에서 멈춘다
    expect(top).toBeGreaterThan(0);
    expect(absorbed, '5단계 부모 가운데 흡수되는 비율').toBeLessThan(top); // 5단계 부모의 일부만 흡수된다 (나머지는 4로 내려간다)
    // 가족 카드의 사이 말이 한 단계 내려간다 (부모 줄)
    let carded = 0;
    const rowsOf = (g: GameState) => {
      const card = familyCardOf(g);
      return [...card.together, ...card.apart].filter((r) => r.role === 'mother' || r.role === 'father');
    };
    for (let i = 0; i < 200 && carded < 30; i++) {
      const s = stateAt('toy', i);
      const on: GameState = { ...s, flags: [...s.flags, 'parent_strained'].sort() };
      const b = rowsOf(s);
      const a = rowsOf(on);
      expect(a.map((r) => r.key)).toEqual(b.map((r) => r.key));
      for (let k = 0; k < b.length; k++) {
        const was = b[k].closeness!;
        if (was === 5) expect([4, 5]).toContain(a[k].closeness);
        else expect(a[k].closeness).toBe(Math.max(1, was - 1));
        if (was > 1 && was < 5) {
          expect(a[k].closenessText).not.toBe(b[k].closenessText);
          carded++;
        }
      }
    }
    expect(carded).toBeGreaterThan(0);
  });

  it('켜진 판의 이후 조르기 카드는 같은 조건에서 p가 0.06 낮고 s가 0.10 높다 (C가 한 단계 낮다 — 하한·상한 안에서)', () => {
    let compared = 0;
    for (let i = 0; i < 600; i++) {
      const s = stateAt('lessons', i);
      const on: GameState = { ...s, flags: [...s.flags, 'parent_strained'].sort() };
      const c0 = askCloseness(s);
      if (c0 <= 1) {
        expect(askCloseness(on)).toBe(1);
        continue;
      }
      const c1 = askCloseness(on);
      expect([c0 - 1, c0], `${i}`).toContain(c1); // 5단계가 합산 6 이상에서 온 부모는 흡수돼 그대로
      if (c1 !== c0 - 1) continue;
      const wealth = s.character!.parentWealth;
      for (const ch of ['beg', 'tantrum'] as const) {
        const unclamped = [0.25, 0.4, 0.55, 0.7, 0.8][wealth - 1] + 0.06 * (c0 - 3) + (ch === 'tantrum' ? 0.1 : 0);
        if (unclamped - 0.06 >= 0.05 && unclamped <= 0.95) {
          expect(askGrantChance(s, EV.lessons, ch) - askGrantChance(on, EV.lessons, ch), `${i}/${ch}`).toBeCloseTo(0.06, 12);
          compared++;
        }
      }
      expect(askStrainChance(on) - askStrainChance(s)).toBeCloseTo(0.1, 12);
    }
    expect(compared).toBeGreaterThan(100);
  });

  it('한 번 켜지면 안 꺼지고 쌓이지 않는다 — 인생 끝까지 플래그가 하나로 남고 사이는 한 단계 아래다 (평생 유지)', () => {
    let s: GameState | null = null;
    for (let i = 0; i < 300 && s === null; i++) {
      const st = stateAt('toy', i);
      if (askOutcomeOf(st, EV.toy, 'tantrum').branch === 'strained') s = st;
    }
    expect(s).not.toBeNull();
    const r = resolveChoiceStep(s!, s!.pending!.key, 'tantrum', askPoolOf(EV.toy));
    expect(r.state.flags.filter((f) => f === 'parent_strained')).toHaveLength(1);
    const end = playToEnd(r.state);
    expect(end.state.flags.filter((f) => f === 'parent_strained')).toHaveLength(1);
    const m = closenessOf({ id: 'mother', role: 'mother' }, end.state);
    const without = closenessOf({ id: 'mother', role: 'mother' }, { ...end.state, flags: end.state.flags.filter((f) => f !== 'parent_strained') });
    expect(m).toBe(Math.max(1, without - 1));
  });

  it('참는다(endure)는 확정 결과 — 어떤 상태에서도 parent_strained가 켜지지 않고 같은 갈래·같은 문장이다 (완료 기준 8)', () => {
    for (let i = 0; i < 300; i++) {
      const kind = ASK_KINDS[i % 3];
      const s = stateAt(kind, i);
      expect(askOutcomeOf(s, EV[kind], 'endure').branch).toBe('endure');
      const r = resolveChoiceStep(s, s.pending!.key, 'endure', askPoolOf(EV[kind]));
      expect(r.state.flags.includes('parent_strained')).toBe(false);
      expect(lineOf(r.state, EV[kind].id).text).toBe(EV[kind].choices![2].result);
    }
  });
});
