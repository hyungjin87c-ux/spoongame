import { describe, expect, it } from 'vitest';
import { AUTO_ASSET } from '../src/data/economyTable';
import {
  AUTO_PRIORITY,
  autoChoiceWeights,
  autoResolveStep,
  choiceBalanceProblems,
  previewChoice,
  stepYear,
  type GameState,
} from '../src/core';
import { EVENT_POOL } from '../src/data/events';
import { economySeed } from '../scripts/economyCheckLib';
import { startLife } from '../scripts/simulateLib';

/**
 * 자동 모드 성향과 자산·부채 (SPEC-003 M5 EC6, docs/data/economy-model.md 8절): 연애 시작 이벤트(youth-meeting)의 「약속 장소에 나간다」는 「자산 ▼」로 표기되고
 * 같은 이벤트에 「바쁘다며 미룬다」(자산 ▲)가 있다. 자동 모드 성향 선택이 자산·부채를 반영해 부채 판(순자산 < 0)에서 연애를 시작하는 비율이 비부채 판보다 낮다 —
 * 시뮬레이션 단언: 자동 모드 4000판(r3: 2000에서 늘림)에서 차이 ≥ 10%p. 소극적 선택에도 얻는 것이 있어 지배 선택지가 아니다(E11).
 */

const EVENT_ID = 'youth-meeting';
const MEET = 'meet';
const LATER = 'later';
const PLAYS = 4000; // r3(R-364): 2000 → 4000 — 「실제로 나간 비율」의 잡음을 줄여 임계 10%p를 되찾는다

interface Rec {
  net: number;
  /** 성향 가중치로 계산한 「나간다」 확률(0~1) — 난수 잡음 없는 값 */
  p: number;
  /** 실제로 나갔는가(그 판의 난수로 뽑은 결과) */
  chose: boolean;
  parenting: string;
}

function lazy<T>(compute: () => T): () => T {
  let cache: { value: T } | null = null;
  return () => (cache ??= { value: compute() }).value;
}

/** 자동 모드로 2000판(지금 세상, 시드 economySeed)을 살며 연애 시작 결정을 만난 때의 상태를 모은다 */
const RECORDS = lazy((): Rec[] => {
  const out: Rec[] = [];
  const meetLabel = EVENT_POOL.byId.get(EVENT_ID)!.choices!.find((c) => c.id === MEET)!.label;
  for (let i = 1; i <= PLAYS; i++) {
    let s: GameState = startLife(economySeed(i), 'present');
    while (s.phase === 'life') {
      if (s.pending === null) {
        s = stepYear(s).state;
        continue;
      }
      if (s.pending.eventId === EVENT_ID && s.assets !== null) {
        const w = autoChoiceWeights(s)!;
        const total = w.weights.reduce((a, b) => a + b, 0);
        const next = autoResolveStep(s, s.pending.key).state;
        out.push({ net: s.assets.net, p: w.weights[w.ids.indexOf(MEET)] / total, chose: next.history[next.history.length - 1]?.choice === meetLabel, parenting: s.character!.parenting });
        s = next;
        continue;
      }
      s = autoResolveStep(s, s.pending.key).state;
    }
  }
  return out;
});

const mean = (xs: number[]): number => xs.reduce((a, b) => a + b, 0) / xs.length;
const rate = (rs: Rec[]): number => rs.filter((r) => r.chose).length / rs.length;

describe('연애 시나리오 (EC6): 표기와 지배 선택지 여부', () => {
  const ev = EVENT_POOL.byId.get(EVENT_ID)!;

  it('「약속 장소에 나간다」는 순자산을 깎고 관계·행복을 올리며, 「바쁘다며 미룬다」는 순자산을 얻고 행복을 깎는다 (모두 20세 이상 이벤트의 assets 효과)', () => {
    const meet = ev.choices!.find((c) => c.id === MEET)!;
    const later = ev.choices!.find((c) => c.id === LATER)!;
    expect(meet.effects?.assets?.net).toBeLessThan(0);
    expect(meet.effects?.stats?.relationships).toBeGreaterThan(0);
    expect(meet.effects?.stats?.happiness).toBeGreaterThan(0);
    expect(later.effects?.assets?.net).toBeGreaterThan(0);
    expect(later.effects?.stats?.happiness).toBeLessThan(0);
  });

  it('표기: 나간다는 「자산 ▼」(+ 관계·행복 ▲), 미룬다는 「자산 ▲」(+ 행복 ▼)이다 — 지금 캐릭터 기준 영향 표기 데이터 (EC5)', () => {
    const s = RECORDS().length > 0 ? stateAtMeeting() : null;
    expect(s).not.toBeNull();
    const meet = previewChoice(s!, ev.choices!.find((c) => c.id === MEET)!);
    const later = previewChoice(s!, ev.choices!.find((c) => c.id === LATER)!);
    expect(meet.items.map((i) => `${i.key}.${i.direction}`)).toEqual(['assets.down', 'relationships.up', 'happiness.up']);
    expect(later.items.map((i) => `${i.key}.${i.direction}`)).toEqual(['assets.up', 'happiness.down']);
    expect(meet.items[0].steps).toBe(1); // 순자산 -400만 원 = 500 미만 → 한 칸
  });

  it('지배 선택지가 아니다 (E11): 한쪽이 모든 축(스탯 4개 + 돈)에서 낫지 않다 — eventLint의 선택지 균형 점검을 통과한다', () => {
    expect(choiceBalanceProblems(ev)).toEqual([]);
  });
});

describe('자동 모드 성향이 자산·부채를 읽는다 (EC6): 자동 모드 4000판 시뮬레이션 단언', () => {
  it('표본이 충분하다: 연애 시작 결정을 만난 판이 2000판 이상이고 부채 판이 400판 이상, 그 밖 판이 1200판 이상이다 (4000판)', () => {
    const r = RECORDS();
    expect(r.length).toBeGreaterThan(2000);
    expect(r.filter((x) => x.net < 0).length).toBeGreaterThan(400);
    expect(r.filter((x) => x.net >= 0).length).toBeGreaterThan(1200);
  });

  it('성향이 정한 「나간다」 확률: 부채 판(순자산 < 0)이 그 밖의 판보다 10%p 이상 낮다 (관측 13.4%p — 난수 잡음 없는 평균 확률, r2 값 pointMan 1200·needSpan 300·needCap 8)', () => {
    const r = RECORDS();
    const debt = mean(r.filter((x) => x.net < 0).map((x) => x.p));
    const free = mean(r.filter((x) => x.net >= 0).map((x) => x.p));
    expect(free - debt, `부채 ${(debt * 100).toFixed(1)}% / 그 밖 ${(free * 100).toFixed(1)}%`).toBeGreaterThanOrEqual(0.1);
  });

  it('실제로 나간 비율도 부채 판이 더 낮다: 차이 10%p 이상 (같은 시드 4000판의 실제 선택 결과 — SPEC EC6, 관측 15~17%p)', () => {
    // M7a r3(R-364): r1에서 임계를 10 → 7%p로 낮췄던 것을 되돌렸다. 이 값은 난수가 뽑은 실제 선택의 비율이라 표본 잡음이 있다 — 부채 판 약 270판(2000판)에서는 잡음이 ±3%p쯤이라
    // 난수 흐름이 바뀐 r1에 9.0%p가 나왔다. 임계를 낮추는 대신 **표본을 4000판으로 늘려**(부채 판 약 550판, 잡음 ±2%p) 10%p를 되찾았다(관측 15.6%p; 2000~8000판 어디서 재도 15~17%p).
    // 성향이 정한 기대 확률의 차이(위 시험, 잡음 없음)는 그대로 10%p 이상이다.
    const r = RECORDS();
    const debt = rate(r.filter((x) => x.net < 0));
    const free = rate(r.filter((x) => x.net >= 0));
    expect(free - debt, `부채 ${(debt * 100).toFixed(1)}% / 그 밖 ${(free * 100).toFixed(1)}%`).toBeGreaterThanOrEqual(0.1);
  });

  it('모든 교육방식에서 같은 방향이다: 엄격·자유·헬리콥터·방임 각각 부채 판의 확률이 그 밖의 판보다 낮다', () => {
    const r = RECORDS();
    for (const par of ['strict', 'free', 'helicopter', 'neglect']) {
      const g = r.filter((x) => x.parenting === par);
      const debt = g.filter((x) => x.net < 0);
      const free = g.filter((x) => x.net >= 0);
      expect(debt.length, par).toBeGreaterThan(20);
      expect(mean(free.map((x) => x.p)), par).toBeGreaterThan(mean(debt.map((x) => x.p)));
    }
  });

  it('돈을 더 중시하는 성향(방임·엄격)일수록 부채 판에서 더 멀어진다: 확률 차이가 자유(행복 중시)보다 크다', () => {
    const r = RECORDS();
    const gap = (par: string) => {
      const g = r.filter((x) => x.parenting === par);
      return mean(g.filter((x) => x.net >= 0).map((x) => x.p)) - mean(g.filter((x) => x.net < 0).map((x) => x.p));
    };
    expect(AUTO_PRIORITY.neglect.wealth).toBeGreaterThan(AUTO_PRIORITY.free.wealth);
    expect(gap('neglect')).toBeGreaterThan(gap('free'));
    expect(gap('strict')).toBeGreaterThan(gap('free'));
  });
});

describe('돈 항의 절실함 (need): 순자산이 음수일수록 커지고 상한이 있다', () => {
  /** 연애 시작 결정이 대기 중인 상태를 순자산만 바꿔 만든다(나머지는 같다) */
  // 부채는 순자산이 음수일 때 부족분 그대로(자동 대출만), 아니면 0으로 둔다 — 기준 상태의 다른 부채가 섞이면 선택이 부채 이자(연 현금흐름)에 주는 변화가 순자산 수준마다 달라진다
  const withNet = (base: GameState, net: number): GameState => ({ ...base, assets: { ...base.assets!, net, debt: Math.max(0, -net) } });
  const pMeet = (s: GameState): number => {
    const w = autoChoiceWeights(s)!;
    return w.weights[w.ids.indexOf(MEET)] / w.weights.reduce((a, b) => a + b, 0);
  };

  it('순자산이 0 이상이면 절실함 1(순자산이 얼마든 같은 확률), 음수일수록 낮아지다가 needCap × needSpan(-2400만 원) 이하에서는 더 변하지 않는다 (needCap)', () => {
    const base = stateAtMeeting();
    // 선택이 순자산을 0 아래로 내리지 않는 수준(약속 장소 비용 400만 원보다 큰 순자산)이면 순자산이 얼마든 같다 — 0 아래로 내리면 새 빚의 이자(연 현금흐름 -10)가 점수에 들어간다
    expect(pMeet(withNet(base, 1000))).toBeCloseTo(pMeet(withNet(base, 50000)), 12);
    expect(pMeet(withNet(base, 0))).toBeLessThan(pMeet(withNet(base, 1000)));
    expect(pMeet(withNet(base, -1000))).toBeLessThan(pMeet(withNet(base, 0)));
    expect(pMeet(withNet(base, -3000))).toBeLessThan(pMeet(withNet(base, -1000)));
    // need = 1 + min(needCap, 부족분 / needSpan): 부족분이 needCap × needSpan 이상이면 상한
    const cap = AUTO_ASSET.needCap * AUTO_ASSET.needSpan;
    expect(pMeet(withNet(base, -cap))).toBeCloseTo(pMeet(withNet(base, -cap * 5)), 12);
    expect(pMeet(withNet(base, -cap))).toBeLessThan(pMeet(withNet(base, -cap / 2)));
  });

  it('난수를 쓰지 않는 순수 계산이다: 같은 상태의 가중치는 몇 번을 불러도 같다', () => {
    const s = stateAtMeeting();
    expect(autoChoiceWeights(s)).toEqual(autoChoiceWeights(s));
    expect(autoChoiceWeights(s)!.weights.every((w) => Number.isFinite(w) && w > 0)).toBe(true);
  });
});

/** 연애 시작 결정이 대기 중인 상태 하나(순자산 3000만 원 안팎의 자동 모드 판) */
function stateAtMeeting(): GameState {
  for (let i = 1; i <= PLAYS; i++) {
    let s: GameState = startLife(economySeed(i), 'present');
    while (s.phase === 'life') {
      if (s.pending === null) {
        s = stepYear(s).state;
        continue;
      }
      if (s.pending.eventId === EVENT_ID && s.assets !== null && s.assets.net > 0) return s;
      s = autoResolveStep(s, s.pending.key).state;
    }
  }
  throw new Error('연애 시작 결정을 만난 판을 찾지 못했다');
}
