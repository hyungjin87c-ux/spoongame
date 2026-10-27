import { autoChoiceWeights, createRng, resolveChoiceStep, stepYear, type Chooser, type EventDef, type ProfileId, type GameState, type StepResult } from '../src/core';
import { EVENT_POOL } from '../src/data/events';
import { snapshotAt, type LifeRecord, type Snapshot } from './baseline004Lib';
import { chooserFor, startLife } from './simulateLib';

/**
 * SPEC-004 현실성 보정 1단계 L0(측정 정정)의 순수 계산 부분 (실행은 scripts/realismL0.ts, 결과는 docs/data/realism-calibration.md 「L0 측정 결과」).
 * **측정용**이다 — 게임 코드(`src/`)는 바꾸지 않는다. 선택자 `course`는 현실의 선택 성향이 아니라 **구조 상한**(선택자가 전부 「예」를 골랐을 때 도달 가능한 비율)을 재는 도구다(realism-calibration.md 4절 P3).
 */

// ---------- 선택자 3종 ----------

export type L0Selector = 'random' | 'auto' | 'course';
export const L0_SELECTORS: readonly L0Selector[] = ['random', 'auto', 'course'];

/** 정석 사슬의 문을 켜는 플래그. 한 선택지가 여럿을 켜면 앞쪽이 우선한다 */
export const COURSE_FLAGS = ['married', 'has_child', 'own_home', 'has_partner', 'has_career'] as const;

/** 선택지가 켜는 플래그(기본 효과 + 보너스 효과) */
export function choiceSetFlags(ev: EventDef, choiceId: string): string[] {
  const c = ev.choices?.find((x) => x.id === choiceId);
  if (!c) return [];
  const out = new Set<string>(c.effects?.setFlags ?? []);
  for (const b of c.bonuses ?? []) for (const f of b.effects?.setFlags ?? []) out.add(f);
  return [...out];
}

/** 구조 상한 선택자: 보이는 선택지 중 정석 문(COURSE_FLAGS)을 켜는 것이 있으면 그것을, 없으면 시드 난수로 고른다 */
export function courseChooser(seed: number): Chooser {
  const rng = createRng(seed ^ 0x9e3779b9);
  return (s) => {
    const p = s.pending!;
    const ev = EVENT_POOL.byId.get(p.eventId)!;
    let best: string | null = null;
    let bestRank = Infinity;
    for (const id of p.choiceIds) {
      const ranks = choiceSetFlags(ev, id)
        .map((f) => (COURSE_FLAGS as readonly string[]).indexOf(f))
        .filter((i) => i >= 0);
      const rank = ranks.length ? Math.min(...ranks) : Infinity;
      if (rank < bestRank) {
        bestRank = rank;
        best = id;
      }
    }
    return best ?? rng.pick(p.choiceIds);
  };
}

/** `auto`와 같은 확률로 고르는 선택자 — `autoResolveStep`과 같은 난수(상태의 rngState 첫 값)를 쓰므로 상태 전체가 같다(R-039). 고른 id를 기록하려고 풀어 쓴다 */
export function autoPickChooser(): Chooser {
  return (s) => {
    const w = autoChoiceWeights(s, EVENT_POOL);
    if (w === null) throw new Error('autoPickChooser: 자동 선택 가중치를 만들 수 없다');
    return w.ids[createRng(s.rngState).weightedIndex(w.weights)];
  };
}

export function selectorChooser(sel: L0Selector, seed: number): Chooser {
  if (sel === 'course') return courseChooser(seed);
  if (sel === 'auto') return autoPickChooser();
  return chooserFor('random', seed) as Chooser;
}

// ---------- 한 판 기록 ----------

export interface PickLog {
  age: number;
  eventId: string;
  choiceId: string;
}

export interface L0Record extends LifeRecord {
  selector: L0Selector;
  gender: string;
  looks: number;
  parentWealth: number;
  /** 평생 모든 선택(나이 제한 없음) */
  pickLog: PickLog[];
  /** 끝 상태에서 본 이벤트 id → 마지막으로 일어난 나이 */
  finalSeen: Readonly<Record<string, number>>;
  /** 내 집(own_home 플래그 또는 주거 own)이 처음 켜진 걸음의 원인: 「이벤트/선택지」 또는 'year'(한 해 넘어감). 내 집이 없으면 null */
  homeCause: string | null;
}

/** `playRecorded`와 같은 걸음으로 한 판을 끝까지 돌리며 나이마다 상태와 모든 선택을 남긴다 (게임 규칙은 그대로) */
export function playL0(seed: number, era: ProfileId, selector: L0Selector): L0Record {
  let s: GameState = startLife(seed, era);
  const chooser = selectorChooser(selector, seed);
  const at = new Map<number, Snapshot>();
  const pickLog: PickLog[] = [];
  let homeCause: string | null = null;
  const hasHome = (st: GameState) => st.flags.includes('own_home') || st.assets?.dwelling === 'own';
  const snap = (st: GameState) => at.set(st.age, { age: st.age, flags: new Set(st.flags), dwelling: st.assets?.dwelling ?? null, seen: { ...st.seen } });
  snap(s);
  for (let i = 0; s.phase === 'life'; i++) {
    if (i >= 2000) throw new Error('playL0: 진행이 끝나지 않는다');
    let r: StepResult;
    let cause = 'year';
    if (s.pending !== null) {
      const id = chooser(s);
      if (id === null) throw new Error('playL0: 선택자가 null을 돌려줬다');
      pickLog.push({ age: s.age, eventId: s.pending.eventId, choiceId: id });
      cause = `${s.pending.eventId}/${id}`;
      r = resolveChoiceStep(s, s.pending.key, id, EVENT_POOL);
    } else {
      r = stepYear(s, EVENT_POOL);
    }
    if (homeCause === null && !hasHome(s) && hasHome(r.state)) homeCause = cause;
    s = r.state;
    snap(s);
  }
  const c = s.character!;
  return {
    seed,
    era,
    selector,
    birthYear: c.birthYear,
    gender: c.gender,
    looks: c.looks,
    parentWealth: c.parentWealth,
    deathAge: s.death?.age ?? s.age,
    at,
    picks: pickLog.filter((p) => p.age >= 19 && p.age <= 64).map((p) => `${p.eventId}/${p.choiceId}`),
    lines: new Map(),
    pickLog,
    finalSeen: { ...s.seen },
    homeCause,
  };
}

// ---------- 한 판에서 뽑는 값 ----------

export interface Firsts {
  career: number | null;
  /** has_career 또는 own_business 처음 켜진 나이 */
  employed: number | null;
  /** has_partner 또는 married 처음 켜진 나이 */
  partner: number | null;
  married: number | null;
  child: number | null;
  /** own_home 플래그 또는 주거 own 처음 나이(기준선 `courseOf`와 같은 합친 정의) */
  home: number | null;
  /** own_home 플래그만 */
  homeFlag: number | null;
  /** 주거 own만 */
  homeDwelling: number | null;
  divorced: number | null;
  college: number | null;
}

export function firstsOf(rec: LifeRecord): Firsts {
  const f: Firsts = { career: null, employed: null, partner: null, married: null, child: null, home: null, homeFlag: null, homeDwelling: null, divorced: null, college: null };
  for (let a = 0; a <= rec.deathAge; a++) {
    const s = rec.at.get(a);
    if (!s) continue;
    const has = (k: string) => s.flags.has(k);
    if (f.career === null && has('has_career')) f.career = a;
    if (f.employed === null && (has('has_career') || has('own_business'))) f.employed = a;
    if (f.partner === null && (has('has_partner') || has('married'))) f.partner = a;
    if (f.married === null && has('married')) f.married = a;
    if (f.child === null && has('has_child')) f.child = a;
    if (f.homeFlag === null && has('own_home')) f.homeFlag = a;
    if (f.homeDwelling === null && s.dwelling === 'own') f.homeDwelling = a;
    if (f.home === null && (has('own_home') || s.dwelling === 'own')) f.home = a;
    if (f.divorced === null && has('divorced')) f.divorced = a;
    if (f.college === null && has('college')) f.college = a;
  }
  return f;
}

/** 나이 a(그 나이까지 산 판)의 시점 상태 (규칙 M2의 `at(a)`) */
export interface PointState {
  married: boolean;
  hasPartner: boolean;
  child: boolean;
  /** 주거 own */
  ownDwelling: boolean;
  /** 주거 own 또는 own_home 플래그 */
  ownUnion: boolean;
  /** has_career 또는 own_business(은퇴 전) */
  employed: boolean;
  business: boolean;
  /** 파트너도 결혼도 아님 */
  solo: boolean;
  divorced: boolean;
}

export function pointAt(rec: LifeRecord, age: number): PointState | null {
  const s = snapshotAt(rec, age);
  if (!s) return null;
  const has = (k: string) => s.flags.has(k);
  const retired = 'senior-retire' in s.seen && s.seen['senior-retire'] <= age;
  return {
    married: has('married'),
    hasPartner: has('has_partner') || has('married'),
    child: has('has_child'),
    ownDwelling: s.dwelling === 'own',
    ownUnion: s.dwelling === 'own' || has('own_home'),
    employed: (has('has_career') || has('own_business')) && !retired,
    business: has('own_business') && !retired,
    solo: !has('has_partner') && !has('married'),
    divorced: has('divorced'),
  };
}

// ---------- 통계 도우미 ----------

export const share = (xs: readonly boolean[]): number => (xs.length === 0 ? NaN : xs.filter(Boolean).length / xs.length);
export const sum = (xs: readonly number[]): number => xs.reduce((a, b) => a + b, 0);
export const mean = (xs: readonly number[]): number => (xs.length === 0 ? NaN : sum(xs) / xs.length);
export function quantile(xs: readonly number[], q: number): number {
  if (xs.length === 0) return NaN;
  const v = [...xs].sort((a, b) => a - b);
  return v[Math.min(v.length - 1, Math.floor(q * v.length))];
}
/** 비율의 표준오차(이항) */
export const seOf = (p: number, n: number): number => (n === 0 || Number.isNaN(p) ? NaN : Math.sqrt((p * (1 - p)) / n));
export const alive = <T extends LifeRecord>(recs: readonly T[], age: number): T[] => recs.filter((r) => r.deathAge >= age);

/** 정석 사슬의 문 이벤트 (H3: 노출 병목 점검용) — 이름 → 정석 쪽 선택지 */
export const CHAIN_EVENTS: ReadonlyArray<{ id: string; yes: string; door: string }> = [
  { id: 'youth-first-job', yes: 'stable|dream|family', door: '취업' },
  { id: 'youth-meeting', yes: 'meet', door: '파트너' },
  { id: 'youth-matchmaker', yes: 'meet', door: '파트너' },
  { id: 'youth-approached', yes: 'give', door: '파트너' },
  { id: 'youth-workplace-romance', yes: 'ask', door: '파트너' },
  { id: 'youth-meeting-again', yes: 'meet', door: '파트너' },
  { id: 'youth-reunion', yes: 'meet', door: '파트너' },
  { id: 'youth-marriage', yes: 'marry', door: '결혼' },
  { id: 'youth-marriage-again', yes: 'marry', door: '결혼' },
  { id: 'youth-second-chance', yes: 'marry', door: '결혼' },
  { id: 'youth-child', yes: 'have', door: '출산' },
  { id: 'youth-child-again', yes: 'have', door: '출산' },
  { id: 'youth-housing', yes: 'loan', door: '내 집' },
  { id: 'middle-home-loan', yes: 'move', door: '내 집' },
];

/** 한 판이 그 사슬 이벤트를 만났는가 / 정석 쪽 선택지를 골랐는가 */
export function chainOutcome(rec: L0Record, ev: { id: string; yes: string }): { seen: boolean; yes: boolean } {
  const seen = ev.id in rec.finalSeen;
  const yesSet = new Set(ev.yes.split('|'));
  const yes = rec.pickLog.some((p) => p.eventId === ev.id && yesSet.has(p.choiceId));
  return { seen, yes };
}

/** 내 집이 켜진 경로의 이름 (homeCause를 묶는다) */
export function homePathOf(rec: L0Record): string | null {
  const c = rec.homeCause;
  if (c === null) return null;
  if (c === 'youth-housing/loan') return 'youth-housing/loan (빚내서 마련)';
  if (c === 'middle-home-loan/move') return 'middle-home-loan/move (무리해서 옮김)';
  if (/^youth-(marriage|marriage-again|second-chance)\/marry$/.test(c)) return '결혼 때 자동 자가 (재력 4~5단계, own_home 플래그 없음)';
  return `그 밖 (${c})`;
}
