import {
  APT_KEYS,
  TEMPER_IDS,
  autoChoiceWeights,
  calendarYear,
  condContextOf,
  createRng,
  familyChangesFor,
  isEventEligible,
  militaryDueOf,
  personaViewOf,
  resolveChoiceStep,
  stepYear,
  studyPlanOf,
  type AptTier,
  type EventPool,
  type GameState,
  type ParentWealth,
} from '../src/core';
import { EVENT_POOL } from '../src/data/events';
import { startLife } from './simulateLib';

/**
 * 맞춤 인생 측정 (SPEC-018 완료 기준 8·9, 설계 `docs/data/persona-model.md` 8-1절 — `npm run report:persona`가 쓴다). **판정이 아니라 보고**다.
 * 표본: 밀레니얼, 시드 `i × 7919 + 13`. 갈림길 G1~G5마다 **처음 나온 카드**의 보이는 id·결정자·선택 확률(자동 성향 또는 부모 확률 — 실제 해결과 같은 식)을 모은다.
 *  - 짝 시드(① — 인과): 같은 시드·같은 출생에서 **수저만** 1과 5로 덮어쓴 두 판(시험 전용 덮어쓰기 — 인생 시작 때 `character.parentWealth`만 바꾼다)
 *  - 자연 집단(② — 분포): 룰렛이 수저 1·5를 낸 시드만 걸러 뽑은 판
 *  - 기질 짝(③): 같은 시드·같은 수저에서 출생 기질만 덮어쓴 판(두드러진 기질 65 · 나머지 32)
 */

export const GATES = { G1: 'school-lessons', G2: 'school-high-pick', G3: 'school-exam', G4: 'job-pick-field', G5: 'job-pick-detail' } as const;
export type Gate = keyof typeof GATES;
export const GATE_KEYS = Object.keys(GATES) as Gate[];
const GATE_OF = new Map<string, Gate>(Object.entries(GATES).map(([g, id]) => [id, g as Gate]));

export const seedOf = (i: number): number => i * 7919 + 13;

export interface GateObs {
  age: number;
  by: 'parent' | 'child' | 'self';
  /** 보이는 선택지 id(카드 순서) */
  ids: string[];
  /** 선택 확률(합 1) — 부모는 `parentChoiceWeights`, 흘러감·본인은 `autoChoiceWeights` */
  weights: number[];
  chosen: string;
  tiers: Record<string, AptTier> | null;
}

export interface LifeObs {
  seed: number;
  wealth: ParentWealth;
  gender: string;
  gates: Partial<Record<Gate, GateObs>>;
  /** 15세 시점 적성 단계(맞춤 판) */
  tiers15: Record<string, AptTier> | null;
  /** 연표에 남은 사건 id 집합(미노출률·옛 G2 대조) */
  seen: Set<string>;
  /** 병역 줄 나이 · 첫 분야 카드 나이 · 대학 여부 · 35세 직업 확정 */
  militaryAge: number | null;
  firstFieldAge: number | null;
  college: boolean;
  hiredBy35: boolean;
  aliveAt35: boolean;
  /** 게임 나이 15세 해(G2 슬롯 나이)에 무슨 일이 있었는가 — 15세 해에 닿기 전에 죽었으면 null (`age15Branch`) */
  a15: Age15Obs | null;
}

/** 게임 나이 15세 해 한 걸음의 관찰 — 판 진행에 쓰이지 않는다(읽기 전용 계산만) */
export interface Age15Obs {
  /** G2 `school-high-pick`이 그 해 났는가(`seen[G2] === 15`) */
  shown: boolean;
  /** G2가 났을 때 그 결정자 — 「함께」 해(`tick.lead`)는 덧카드의 결정자, 그 밖에는 `tick.by`(없으면 본인) */
  g2By: 'parent' | 'child' | 'self' | null;
  /** G2가 「같은 해에 함께」 났는가(결정 후속 255 — 틱의 `lead`): 그 해 일반 추첨이 선택 카드를 뽑아 G2가 그 카드 앞에서 먼저 해결된 해. 이때 `choiceCard`는 그 해 카드 X다 */
  together: boolean;
  /** G2가 났을 때: 같은 해 일반 추첨이 서술 장면을 뽑았으면 그 장면을 G2가 대신한 것 — 반사실 걸음(G2를 `once`로 막고 같은 상태에서 한 해 더 돌린 틱)으로 가른다. 「함께」 해에는 서술 장면이 없어 판정하지 않는다(false) */
  g2Replaced: boolean | null;
  /** 가족 강제 사건이 그 해 있었는가(`familyChangesFor(...).forcedEvent`) */
  forced: boolean;
  /** 병역 슬롯 · 진로 카드가 그 해 열렸는가(15세에는 닿지 않는다 — 점검용) */
  militaryOrCareer: boolean;
  /** G2가 그 해 후보 자격을 통과하는가(`isEventEligible` — 가족 줄 거름은 못 본다) */
  eligible: boolean;
  leftSchool: boolean;
  /** 그 해 걸음이 선택 카드를 냈는가(본인 대기 · 부모·흘러감 즉시 해결) — G2 혼자 난 해는 제외, 「함께」 해는 X */
  choiceCard: { id: string; by: 'parent' | 'child' | 'self' } | null;
  /** 그 해 사망(걸음 또는 본인 카드 해결에서 `death`) */
  died: boolean;
}

/**
 * 15세 해의 서로 겹치지 않는 갈래(우선순위 위에서부터): ⓐ G2가 났다(ⓐ1 빈 해 · ⓐ2 서술 대신 · ⓐ3 같은 해에 함께 — 결정 후속 255, 그 해 카드의 결정자별) · ⓔ2 15세 해 사망(G2 없음) · ⓓ 가족 강제 사건 해 · ⓕ3 병역·진로 슬롯 · ⓕ1·2 자격 없음 ·
 * ⓑ 일반 추첨이 선택 카드를 뽑아 G2가 넘어갔다(결정자별) · ⓕ4 그 밖(자격은 있는데 안 났다 — 가족 줄 거름 등). ⓔ1 15세 전 사망은 a15가 null.
 */
export const AGE15_BRANCHES = [
  'ⓐ1 G2 났다 · 빈 해(그 해 일반 추첨이 아무것도 안 뽑음)',
  'ⓐ2 G2 났다 · 서술 장면을 G2가 대신함',
  'ⓑ1 선택 카드가 뽑혀 G2 넘어감 · 본인 카드',
  'ⓑ2 선택 카드가 뽑혀 G2 넘어감 · 부모 카드',
  'ⓑ3 선택 카드가 뽑혀 G2 넘어감 · 흘러감',
  'ⓓ 가족 강제 사건 해(G2 슬롯 없음)',
  'ⓔ1 15세 해 전에 사망',
  'ⓔ2 15세 해에 사망(G2 없음)',
  'ⓕ1 G2 자격 없음 · left_school',
  'ⓕ2 G2 자격 없음 · 그 밖 사유',
  'ⓕ3 병역·진로 슬롯 해(점검)',
  'ⓕ4 자격은 있는데 안 남(가족 줄 거름 등)',
  'ⓐ3a G2 함께 · 그 해 카드 본인',
  'ⓐ3b G2 함께 · 그 해 카드 부모',
  'ⓐ3c G2 함께 · 그 해 카드 흘러감',
] as const;

export function age15Branch(l: LifeObs): (typeof AGE15_BRANCHES)[number] {
  const a = l.a15;
  if (a === null) return AGE15_BRANCHES[6];
  if (a.shown && a.together) return a.choiceCard?.by === 'parent' ? AGE15_BRANCHES[13] : a.choiceCard?.by === 'child' ? AGE15_BRANCHES[14] : AGE15_BRANCHES[12];
  if (a.shown) return a.g2Replaced === true ? AGE15_BRANCHES[1] : AGE15_BRANCHES[0];
  if (a.died) return AGE15_BRANCHES[7];
  if (a.forced) return AGE15_BRANCHES[5];
  if (a.militaryOrCareer) return AGE15_BRANCHES[10];
  if (!a.eligible) return a.leftSchool ? AGE15_BRANCHES[8] : AGE15_BRANCHES[9];
  if (a.choiceCard !== null) return a.choiceCard.by === 'self' ? AGE15_BRANCHES[2] : a.choiceCard.by === 'parent' ? AGE15_BRANCHES[3] : AGE15_BRANCHES[4];
  return AGE15_BRANCHES[11];
}

/** 15세 해 갈래 표: 갈래별 판 수(합 = 판 수) · G2가 난 판의 결정자 · G2가 15세가 아닌 나이에 난 판 · ⓑ가 보여 준 카드 id 분포 · G2가 났는데 그 해 사망한 판 */
export function age15Table(lives: readonly LifeObs[]): { n: number; rows: Array<{ label: string; count: number }>; g2By: Record<'parent' | 'child' | 'self', number>; g2OtherAge: number; choiceIds: Array<[string, number]>; diedWithCard: number } {
  const counts = new Map<string, number>(AGE15_BRANCHES.map((b) => [b, 0]));
  const g2By = { parent: 0, child: 0, self: 0 };
  const ids = new Map<string, number>();
  let g2OtherAge = 0;
  let diedWithCard = 0;
  for (const l of lives) {
    const b = age15Branch(l);
    counts.set(b, (counts.get(b) ?? 0) + 1);
    const a = l.a15;
    if (a?.shown === true && a.g2By !== null) g2By[a.g2By]++;
    if ((b.startsWith('ⓑ') || b.startsWith('ⓐ3')) && a?.choiceCard) ids.set(a.choiceCard.id, (ids.get(a.choiceCard.id) ?? 0) + 1);
    if (a?.shown !== true && l.gates.G2 !== undefined && l.gates.G2.age !== 15) g2OtherAge++;
    if (a?.died === true && a.shown) diedWithCard++;
  }
  return { n: lives.length, rows: AGE15_BRANCHES.map((label) => ({ label, count: counts.get(label) ?? 0 })), g2By, g2OtherAge, choiceIds: [...ids].sort((x, y) => y[1] - x[1] || (x[0] < y[0] ? -1 : 1)), diedWithCard };
}

const G2_ID = GATES.G2;

/** 게임 나이 15세 해 걸음 하나를 관찰한다 — `pre`는 걸음 직전(대기 없음) 상태, `r`은 그 걸음 결과. 난수·상태를 바꾸지 않는다(반사실 걸음은 복사본에서 돌린다) */
function observeAge15(pre: GameState, r: ReturnType<typeof stepYear>, pool: EventPool): Age15Obs {
  const age = pre.age;
  const ev = pool.byId.get(G2_ID);
  const ctx = condContextOf(pre);
  const eligible = ev !== undefined && isEventEligible(ev, { ...ctx, age, year: calendarYear(pre.character!.birthYear, age), seen: pre.seen });
  const shown = pre.seen[G2_ID] === undefined && r.state.seen[G2_ID] === age;
  const t = r.tick;
  // 「같은 해에 함께」(결정 후속 255): 틱의 `lead`가 G2 덧카드다 — 최상위 `by`·`eventId`는 그 해 카드 X의 것이라 G2의 결정자·반사실 판정에 쓰면 안 된다
  const together = shown && t.lead !== undefined;
  let g2Replaced: boolean | null = null;
  if (shown && !together) {
    // 반사실: G2를 once로 막은 같은 상태에서 한 해 — 일반 추첨이 서술 장면을 뽑았으면 그 장면(마일스톤 아님)이 G2에 자리를 내준 것
    const cf = stepYear({ ...pre, seen: { ...pre.seen, [G2_ID]: 0 } }, pool);
    g2Replaced = cf.tick.eventId !== undefined && !(cf.tick.milestoneIds ?? []).includes(cf.tick.eventId);
  }
  const choiceCard = (!shown || together) && (t.kind === 'choice' || t.by !== undefined) && t.eventId !== undefined ? { id: t.eventId, by: (t.by ?? 'self') as 'parent' | 'child' | 'self' } : null;
  return {
    shown,
    g2By: shown ? (together ? t.lead!.by : ((t.by ?? 'self') as 'parent' | 'child' | 'self')) : null,
    together,
    g2Replaced,
    forced: familyChangesFor(pre, age, pool).forcedEvent !== undefined,
    militaryOrCareer: militaryDueOf(pre, pool, age) !== null || t.career === true,
    eligible,
    leftSchool: pre.flags.includes('left_school'),
    choiceCard,
    died: t.kind === 'death',
  };
}

/** 시험 전용 덮어쓰기: 수저 · 출생 기질(두드러진 기질 65, 나머지 32) · 맞춤 인생 없음 */
export function overridden(s: GameState, o: { wealth?: ParentWealth; temper?: number; neutral?: boolean }): GameState {
  let out = s;
  if (o.wealth !== undefined && out.character !== null) out = { ...out, character: { ...out.character, parentWealth: o.wealth } };
  if (o.temper !== undefined && out.persona !== undefined) {
    const w = TEMPER_IDS.map((_, i) => (i === o.temper ? 65 : 32));
    out = { ...out, persona: { ...out.persona, born: o.temper, shown: o.temper, w } };
  }
  if (o.neutral === true) {
    const { persona: _p, ...rest } = out;
    void _p;
    out = rest as GameState;
  }
  return out;
}

/** 한 판을 `untilAge`까지 자동으로 살며 갈림길 관찰을 모은다 (본인 카드는 자동 성향으로 고른다 — `autoResolveStep`과 같은 난수) */
export function playObserve(start: GameState, seed: number, untilAge = 36, pool: EventPool = EVENT_POOL): LifeObs {
  let s = start;
  const gates: Partial<Record<Gate, GateObs>> = {};
  let tiers15: Record<string, AptTier> | null = null;
  let a15: Age15Obs | null = null;
  const tiersNow = (x: GameState): Record<string, AptTier> | null => (personaViewOf(x)?.tiers as Record<string, AptTier> | undefined) ?? null;
  for (let guard = 0; guard < 2000 && s.phase === 'life' && s.age <= untilAge; guard++) {
    if (s.age === 15 && tiers15 === null) tiers15 = tiersNow(s);
    if (s.pending !== null) {
      const w = autoChoiceWeights(s, pool)!;
      const id = w.ids[createRng(s.rngState).weightedIndex(w.weights)];
      const g = GATE_OF.get(s.pending.eventId);
      const total = w.weights.reduce((x, y) => x + y, 0); // 자동 가중은 합이 1이 아니다(`weightedIndex`가 합으로 나눈다) — 확률로 맞춘다
      if (g !== undefined && gates[g] === undefined) gates[g] = { age: s.pending.age, by: 'self', ids: [...w.ids], weights: w.weights.map((x) => x / total), chosen: id, tiers: tiersNow(s) };
      const resolved = resolveChoiceStep(s, s.pending.key, id, pool);
      if (a15 !== null && s.pending.age === 15 && resolved.tick.kind === 'death') a15.died = true; // 15세 해 본인 카드 해결에서 죽은 판
      s = resolved.state;
      continue;
    }
    // 한 걸음에 관찰이 둘일 수 있다(15세 「같은 해에 함께」 — 덧카드 G2, 그 뒤 그 해 카드 X): 변수 하나에 덮어쓰면 G2 갈림길 관찰이 빠지므로 호출마다 쌓는다
    const seen: Array<{ state: GameState; by: 'parent' | 'child'; ids: readonly string[]; weights: readonly number[]; choiceId: string }> = [];
    const r = stepYear(s, pool, (e) => {
      seen.push(e);
    });
    if (s.age === 15 && a15 === null) a15 = observeAge15(s, r, pool);
    for (const e of seen) {
      const g = GATE_OF.get(e.state.pending!.eventId);
      if (g !== undefined && gates[g] === undefined) gates[g] = { age: e.state.pending!.age, by: e.by, ids: [...e.ids], weights: [...e.weights], chosen: e.choiceId, tiers: tiersNow(e.state) };
    }
    s = r.state;
  }
  const mil = s.history.find((h) => h.eventId === 'youth-military');
  const field = s.history.find((h) => h.eventId === GATES.G4);
  return {
    seed,
    wealth: start.character!.parentWealth,
    gender: start.character!.gender,
    gates,
    tiers15,
    seen: new Set(Object.keys(s.seen)),
    militaryAge: mil?.age ?? null,
    firstFieldAge: field?.age ?? null,
    college: s.flags.includes('college'),
    hiredBy35: s.persona?.job?.id !== undefined,
    aliveAt35: s.age >= 35 || s.phase === 'life',
    a15,
  };
}

// ---------- 표본 ----------

/** 자연 집단: 룰렛이 그 수저를 낸 시드만 n판 (시드 i × 7919 + 13을 차례로 훑는다) */
export function naturalSample(wealth: ParentWealth, n: number, untilAge = 36): LifeObs[] {
  const out: LifeObs[] = [];
  for (let i = 1; out.length < n && i < n * 40; i++) {
    const seed = seedOf(i);
    const s = startLife(seed, 'millennial');
    if (s.character!.parentWealth !== wealth) continue;
    out.push(playObserve(s, seed, untilAge));
  }
  return out;
}

/** 짝 시드: 같은 출생에서 수저만 1·5로 덮어쓴 두 판 */
export function pairedSample(n: number, untilAge = 36): Array<[LifeObs, LifeObs]> {
  const out: Array<[LifeObs, LifeObs]> = [];
  for (let i = 1; i <= n; i++) {
    const seed = seedOf(i);
    const s = startLife(seed, 'millennial');
    out.push([playObserve(overridden(s, { wealth: 1 }), seed, untilAge), playObserve(overridden(s, { wealth: 5 }), seed, untilAge)]);
  }
  return out;
}

/** 기질 짝: 같은 시드·같은 수저(덮어쓰기)에서 출생 기질만 바꾼 판들 — 기질마다 n판 */
export function temperSample(wealth: ParentWealth, n: number, untilAge = 36): LifeObs[][] {
  return TEMPER_IDS.map((_, t) => {
    const out: LifeObs[] = [];
    for (let i = 1; i <= n; i++) {
      const seed = seedOf(i);
      out.push(playObserve(overridden(startLife(seed, 'millennial'), { wealth, temper: t }), seed, untilAge));
    }
    return out;
  });
}

// ---------- 지표 ----------

/** (a)·(b): 짝마다 두 판 모두 그 갈림길을 본 쌍만 — 한쪽에만 보이는 id 수(각 쪽 평균·최소)와 Jaccard 거리 평균 */
export function pairDiff(pairs: Array<[LifeObs, LifeObs]>, g: Gate): { pairs: number; onlyLowMean: number; onlyHighMean: number; onlyLowMin: number; onlyHighMin: number; jaccard: number; failA: number } {
  let n = 0;
  let lo = 0;
  let hi = 0;
  let loMin = Infinity;
  let hiMin = Infinity;
  let jac = 0;
  let failA = 0;
  const need = g === 'G1' || g === 'G2' ? 2 : 1;
  for (const [a, b] of pairs) {
    const x = a.gates[g];
    const y = b.gates[g];
    if (x === undefined || y === undefined) continue;
    n++;
    const A = new Set(x.ids);
    const B = new Set(y.ids);
    const onlyA = [...A].filter((id) => !B.has(id)).length;
    const onlyB = [...B].filter((id) => !A.has(id)).length;
    const inter = [...A].filter((id) => B.has(id)).length;
    const uni = new Set([...A, ...B]).size;
    lo += onlyA;
    hi += onlyB;
    loMin = Math.min(loMin, onlyA);
    hiMin = Math.min(hiMin, onlyB);
    jac += 1 - inter / uni;
    if (onlyA < need || onlyB < need) failA++;
  }
  return { pairs: n, onlyLowMean: n ? lo / n : 0, onlyHighMean: n ? hi / n : 0, onlyLowMin: n ? loMin : 0, onlyHighMin: n ? hiMin : 0, jaccard: n ? jac / n : 0, failA };
}

/** 갈림길의 선택 확률 평균 분포(카드를 본 판만) — id → 평균 확률 */
export function meanChoiceDist(lives: readonly LifeObs[], g: Gate): Map<string, number> {
  const sum = new Map<string, number>();
  let n = 0;
  for (const l of lives) {
    const o = l.gates[g];
    if (o === undefined) continue;
    n++;
    o.ids.forEach((id, i) => sum.set(id, (sum.get(id) ?? 0) + o.weights[i]));
  }
  for (const [k, v] of sum) sum.set(k, v / Math.max(1, n));
  return sum;
}

/** 총변동거리 ½ Σ |p − q| */
export function tvDistance(p: Map<string, number>, q: Map<string, number>): number {
  const keys = new Set([...p.keys(), ...q.keys()]);
  let d = 0;
  for (const k of keys) d += Math.abs((p.get(k) ?? 0) - (q.get(k) ?? 0));
  return d / 2;
}

/** (c): 기질 쌍 중 가장 먼 총변동거리 */
export function temperTv(byTemper: readonly LifeObs[][], g: Gate): { max: number; pair: string } {
  const dists = byTemper.map((lives) => meanChoiceDist(lives, g));
  let max = 0;
  let pair = '-';
  for (let i = 0; i < dists.length; i++) for (let j = i + 1; j < dists.length; j++) {
    const d = tvDistance(dists[i], dists[j]);
    if (d > max) {
      max = d;
      pair = `${TEMPER_IDS[i]}↔${TEMPER_IDS[j]}`;
    }
  }
  return { max, pair };
}

/** (e): 칸(보이는 id 집합)마다 자동·부모 확률 평균의 최대 몫 — 칸 분모 30 이상만 */
export function dominance(lives: readonly LifeObs[], g: Gate, minCell = 30): { cell: string; id: string; share: number; n: number } | null {
  const cells = new Map<string, { n: number; sum: Map<string, number> }>();
  for (const l of lives) {
    const o = l.gates[g];
    if (o === undefined) continue;
    const key = [...o.ids].sort().join(',');
    const c = cells.get(key) ?? { n: 0, sum: new Map<string, number>() };
    c.n++;
    o.ids.forEach((id, i) => c.sum.set(id, (c.sum.get(id) ?? 0) + o.weights[i]));
    cells.set(key, c);
  }
  let best: { cell: string; id: string; share: number; n: number } | null = null;
  for (const [cell, c] of cells) {
    if (c.n < minCell) continue;
    for (const [id, v] of c.sum) {
      const share = v / c.n;
      if (best === null || share > best.share) best = { cell, id, share, n: c.n };
    }
  }
  return best;
}

/** 미노출률: 그 갈림길을 한 번도 못 본 판의 비율 (35세까지 산 판만) */
export function unseenRate(lives: readonly LifeObs[], g: Gate): { rate: number; n: number } {
  const alive = lives.filter((l) => l.aliveAt35 || g === 'G1' || g === 'G2' || g === 'G3');
  const miss = alive.filter((l) => l.gates[g] === undefined).length;
  return { rate: alive.length ? miss / alive.length : 0, n: alive.length };
}

/** 결정자별 분모 */
export function deciders(lives: readonly LifeObs[], g: Gate): Record<'parent' | 'child' | 'self', number> {
  const out = { parent: 0, child: 0, self: 0 };
  for (const l of lives) {
    const o = l.gates[g];
    if (o !== undefined) out[o.by]++;
  }
  return out;
}

/** 칸(수저·적성 단계)별 보이는 id 집합 — (f) 문서 표와 대조용 */
export function visibleSets(lives: readonly LifeObs[], g: Gate, axes: readonly string[]): Map<string, Map<string, number>> {
  const out = new Map<string, Map<string, number>>();
  for (const l of lives) {
    const o = l.gates[g];
    if (o === undefined) continue;
    const key = `수저${l.wealth} ${axes.map((a) => `${a}:${o.tiers?.[a] ?? '-'}`).join(' ')}`;
    const m = out.get(key) ?? new Map<string, number>();
    const set = [...o.ids].join(' · ');
    m.set(set, (m.get(set) ?? 0) + 1);
    out.set(key, m);
  }
  return out;
}

/** 9: 수저 1에서 적성 한 축이 높은 판 · 수저 5에서 한 축이 낮은 판의 비율(15세) */
export function aptitudeSpread(lives: readonly LifeObs[], tier: AptTier): number {
  const withTiers = lives.filter((l) => l.tiers15 !== null);
  return withTiers.length ? withTiers.filter((l) => APT_KEYS.some((k) => l.tiers15![k] === tier)).length / withTiers.length : 0;
}

/** 진로 일정(결정 후속 239): 성별 × 대학 여부별 첫 분야 카드 나이 중앙값 · 병역 줄 나이 중앙값 · 35세 직업 확정 도달률 */
export function careerSchedule(lives: readonly LifeObs[]): Array<{ group: string; n: number; fieldMedian: number | null; militaryMedian: number | null; hired35: number }> {
  const med = (xs: number[]): number | null => {
    if (xs.length === 0) return null;
    const s = [...xs].sort((a, b) => a - b);
    return s[Math.floor(s.length / 2)];
  };
  const groups: Array<[string, (l: LifeObs) => boolean]> = [
    ['여자 · 대학', (l) => l.gender !== 'male' && l.college],
    ['여자 · 비대학', (l) => l.gender !== 'male' && !l.college],
    ['남자 · 대학', (l) => l.gender === 'male' && l.college],
    ['남자 · 비대학', (l) => l.gender === 'male' && !l.college],
  ];
  return groups.map(([group, f]) => {
    const g = lives.filter(f);
    const alive = g.filter((l) => l.aliveAt35);
    return {
      group,
      n: g.length,
      fieldMedian: med(g.flatMap((l) => (l.firstFieldAge === null ? [] : [l.firstFieldAge]))),
      militaryMedian: med(g.flatMap((l) => (l.militaryAge === null ? [] : [l.militaryAge]))),
      hired35: alive.length ? alive.filter((l) => l.hiredBy35).length / alive.length : 0,
    };
  });
}

/** 맞춤 판의 학업 일정 표본 점검용(시험이 쓴다) */
export const planOf = studyPlanOf;
