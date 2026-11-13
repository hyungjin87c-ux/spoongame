import {
  DWELLINGS,
  GENDERS,
  HOUSINGS,
  PARENTING_STYLES,
  STAGES,
  autoChoiceWeights,
  createRng,
  resolveChoiceStep,
  decisionFor,
  eventPool,
  eventWeight,
  isChoiceEvent,
  isEventEligible,
  resolveEffects,
  selfAreaWeightFactor,
  stepYear,
  visibleChoices,
  type Condition,
  type CondContext,
  type EligibilityView,
  type EventDef,
  type EventPool,
  type GameState,
  type ProfileId,
} from '../../src/core';
import { STAGE_TABLE } from '../../src/data/lifeTable';
import { startLife } from '../../scripts/simulateLib';
import { LOOKS_BUSINESS_EVENTS, LOOKS_EXCEPTION_EVENTS, LOOKS_ROMANCE_EVENTS } from './looksExceptions';

/**
 * 기존 사건 자격 골든(SPEC-018 1단계, docs/data/persona-model.md 3절 `[CX-002-004]`)의 격자·표본 정의와 비교 도구.
 * 생성 스크립트(`scripts/genEligibilityGolden.ts`)와 시험(`tests/personaCondition.test.ts`·`tests/eligibilityGoldenBoundary.test.ts`)이 **같은 코드**를 쓴다.
 *
 * 골든은 **변경 전 코드**(SPEC-018 구현 전, 커밋 SHA는 골든 파일 `meta.baseSha`)에서만 생성한다. 재생성은 One-way에 가까워 마스터 승인이 필요하다.
 *
 * 골든은 입력(상태 표·나이·연도·본 기록)과 출력을 함께 담는다 — 시험은 골든의 입력을 지금 코드에 넣어 출력만 다시 계산해 견준다(그래서 나중에 `Character`·`GameState`에 필드가 늘어도 「persona 없음」 입력은 그대로다).
 */

// ---------- 공통 도구 ----------

/** 키를 정렬한 JSON(결정론) */
export function canon(value: unknown): string {
  if (value === undefined) return 'null';
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canon).join(',')}]`;
  const o = value as Record<string, unknown>;
  return `{${Object.keys(o)
    .filter((k) => o[k] !== undefined)
    .sort()
    .map((k) => `${JSON.stringify(k)}:${canon(o[k])}`)
    .join(',')}}`;
}

/** 32비트 FNV-1a(16진 8자) */
export function fnv32(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

/** 가중치 비교용 반올림(부동소수 표기 차이 방어) */
const round9 = (n: number): number => Number(n.toFixed(9));

const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v));

// ---------- 상태 표(입력) ----------

/**
 * 상태 한 칸의 입력(압축 배열): [부모 재력, 외모, 양육(PARENTING_STYLES 번호), 성별(GENDERS 번호), 학력, 건강, 행복, 관계, 플래그("a,b"), 자산|null, 가족|null]
 * 자산 = [순자산, 연 소득, 부채, 소득 보정, 주거(DWELLINGS 번호)] (나이 20세 미만 칸에서는 쓰지 않는다), 가족 = [형제 순서, 어머니 출생 나이, 아버지 출생 나이, 집(HOUSINGS 번호)]
 */
export type StateDesc = [number, number, number, number, number, number, number, number, string, number[] | null, number[] | null];
type Mut = { pw: number; lk: number; pa: number; g: number; st: [number, number, number, number]; fl: Set<string>; as: number[] | null; fa: number[] | null };

const STAT_ORDER = ['education', 'health', 'happiness', 'relationships'] as const;

function neutral(): Mut {
  return { pw: 3, lk: 50, pa: PARENTING_STYLES.indexOf('free'), g: 0, st: [50, 50, 50, 50], fl: new Set(), as: [0, 3000, 0, 0, DWELLINGS.indexOf('rent')], fa: [1, 28, 31, HOUSINGS.indexOf('rent')] };
}
const toDesc = (m: Mut): StateDesc => [m.pw, m.lk, m.pa, m.g, m.st[0], m.st[1], m.st[2], m.st[3], [...m.fl].sort().join(','), m.as === null ? null : [...m.as], m.fa === null ? null : [...m.fa]];
const fromDesc = (d: StateDesc): Mut => ({ pw: d[0], lk: d[1], pa: d[2], g: d[3], st: [d[4], d[5], d[6], d[7]], fl: new Set(d[8] === '' ? [] : d[8].split(',')), as: d[9] === null ? null : [...d[9]], fa: d[10] === null ? null : [...d[10]] });
const cloneMut = (m: Mut): Mut => fromDesc(toDesc(m));

/** 입력(상태 표 한 칸 + 나이·연도·본 기록) → 자격·가중이 읽는 `ctx`와 `view`(`stepYear`와 같은 모양: view = ctx + 나이·연도·seen) */
export function ctxOf(desc: StateDesc, age: number, year: number): CondContext {
  const m = fromDesc(desc);
  return {
    character: { name: '골든', gender: GENDERS[m.g], birthYear: year - age, parentWealth: m.pw as 1 | 2 | 3 | 4 | 5, parenting: PARENTING_STYLES[m.pa], looks: m.lk },
    stats: { education: m.st[0], health: m.st[1], happiness: m.st[2], relationships: m.st[3] },
    flags: m.fl,
    age,
    family: m.fa === null ? null : { birthOrder: m.fa[0], motherBirthAge: m.fa[1], fatherBirthAge: m.fa[2], housing: HOUSINGS[m.fa[3]] },
    assets: age >= 20 && m.as !== null ? { net: m.as[0], income: m.as[1], debt: m.as[2], incomeAdj: m.as[3], dwelling: DWELLINGS[m.as[4]] } : null,
  };
}

// ---------- 조건 → 상태 (만족시키기·경계 변주) ----------

type Cond = Condition | undefined;

/** 조건을 만족하도록 `m`을 최소한만 고친다(이미 맞으면 그대로). `age`를 주면 부모 나이 조건도 그 나이에서 맞춘다. */
function satisfy(base: Mut, cond: Cond, age?: number): Mut {
  const m = cloneMut(base);
  if (cond === undefined) return m;
  for (const [i, key] of STAT_ORDER.entries()) {
    const r = cond.stats?.[key];
    if (r !== undefined) m.st[i] = clamp(m.st[i], r.min ?? 0, r.max ?? 100);
  }
  if (cond.looks !== undefined) m.lk = clamp(m.lk, cond.looks.min ?? 0, cond.looks.max ?? 100);
  if (cond.parentWealth !== undefined) m.pw = clamp(m.pw, cond.parentWealth.min ?? 1, cond.parentWealth.max ?? 5);
  if (cond.assets !== undefined) {
    const a = (m.as ??= [0, 3000, 0, 0, DWELLINGS.indexOf('rent')]);
    const c = cond.assets;
    if (c.netMin !== undefined) a[0] = Math.max(a[0], c.netMin);
    if (c.netMax !== undefined) a[0] = Math.min(a[0], c.netMax);
    if (c.debtMax !== undefined) a[2] = Math.min(a[2], c.debtMax);
    if (c.incomeMin !== undefined) a[1] = Math.max(a[1], c.incomeMin);
    if (c.dwelling !== undefined && !c.dwelling.includes(DWELLINGS[a[4]])) a[4] = DWELLINGS.indexOf(c.dwelling[0]);
  }
  if (cond.birthOrder !== undefined || cond.parentAge !== undefined || cond.motherAge !== undefined || cond.housing !== undefined) {
    const f = (m.fa ??= [1, 28, 31, HOUSINGS.indexOf('rent')]);
    if (cond.birthOrder !== undefined) f[0] = clamp(f[0], cond.birthOrder.min ?? 1, cond.birthOrder.max ?? 5);
    if (cond.housing !== undefined && !cond.housing.includes(HOUSINGS[f[3]])) f[3] = HOUSINGS.indexOf(cond.housing[0]);
    if (age !== undefined && cond.motherAge !== undefined) f[1] = clamp(f[1] + age, cond.motherAge.min ?? 0, cond.motherAge.max ?? 200) - age;
    if (age !== undefined && cond.parentAge !== undefined) {
      const top = clamp(Math.max(f[1], f[2]) + age, cond.parentAge.min ?? 0, cond.parentAge.max ?? 200) - age;
      f[1] = Math.min(f[1], top);
      f[2] = top;
      if (f[1] > f[2]) f[1] = f[2];
    }
  }
  if (cond.parenting !== undefined && !cond.parenting.includes(PARENTING_STYLES[m.pa])) m.pa = PARENTING_STYLES.indexOf(cond.parenting[0]);
  if (cond.gender !== undefined && !cond.gender.includes(GENDERS[m.g])) m.g = GENDERS.indexOf(cond.gender[0]);
  for (const f of cond.flags ?? []) m.fl.add(f);
  for (const f of cond.notFlags ?? []) m.fl.delete(f);
  return m;
}

/** 조건이 읽는 모든 항목의 경계값(안쪽·바깥쪽)과 플래그 켜고 끔을 만드는 변주 함수들 */
function leafMutators(cond: Cond, baseAge: number): ((m: Mut) => void)[] {
  const out: ((m: Mut) => void)[] = [];
  if (cond === undefined) return out;
  const bounds = (r: { min?: number; max?: number } | undefined, lo: number, hi: number): number[] => {
    if (r === undefined) return [];
    const v: number[] = [];
    if (r.min !== undefined) v.push(clamp(r.min - 1, lo, hi), clamp(r.min, lo, hi));
    if (r.max !== undefined) v.push(clamp(r.max, lo, hi), clamp(r.max + 1, lo, hi));
    return [...new Set(v)];
  };
  for (const [i, key] of STAT_ORDER.entries()) for (const v of bounds(cond.stats?.[key], 0, 100)) out.push((m) => void (m.st[i] = v));
  for (const v of bounds(cond.looks, 0, 100)) out.push((m) => void (m.lk = v));
  for (const v of bounds(cond.parentWealth, 1, 5)) out.push((m) => void (m.pw = v));
  for (const v of bounds(cond.birthOrder, 1, 5)) out.push((m) => void ((m.fa ??= [1, 28, 31, 1])[0] = v));
  for (const v of bounds(cond.motherAge, 0, 200)) out.push((m) => void ((m.fa ??= [1, 28, 31, 1])[1] = v - baseAge));
  for (const v of bounds(cond.parentAge, 0, 200))
    out.push((m) => {
      const f = (m.fa ??= [1, 28, 31, 1]);
      f[1] = v - baseAge;
      f[2] = v - baseAge;
    });
  const a = cond.assets;
  if (a !== undefined) {
    const asset = (m: Mut): number[] => (m.as ??= [0, 3000, 0, 0, DWELLINGS.indexOf('rent')]);
    if (a.netMin !== undefined) for (const v of [a.netMin - 1, a.netMin]) out.push((m) => void (asset(m)[0] = v));
    if (a.netMax !== undefined) for (const v of [a.netMax, a.netMax + 1]) out.push((m) => void (asset(m)[0] = v));
    if (a.debtMax !== undefined) for (const v of [a.debtMax, a.debtMax + 1]) out.push((m) => void (asset(m)[2] = v));
    if (a.incomeMin !== undefined) for (const v of [a.incomeMin - 1, a.incomeMin]) out.push((m) => void (asset(m)[1] = v));
    if (a.dwelling !== undefined) for (const d of DWELLINGS) out.push((m) => void (asset(m)[4] = DWELLINGS.indexOf(d)));
    out.push((m) => void (m.as = null));
  }
  if (cond.housing !== undefined) {
    for (const h of HOUSINGS) out.push((m) => void ((m.fa ??= [1, 28, 31, 1])[3] = HOUSINGS.indexOf(h)));
  }
  if (cond.birthOrder !== undefined || cond.parentAge !== undefined || cond.motherAge !== undefined || cond.housing !== undefined) out.push((m) => void (m.fa = null));
  if (cond.parenting !== undefined) for (const p of PARENTING_STYLES) out.push((m) => void (m.pa = PARENTING_STYLES.indexOf(p)));
  if (cond.gender !== undefined) for (const g of GENDERS) out.push((m) => void (m.g = GENDERS.indexOf(g)));
  for (const f of [...(cond.flags ?? []), ...(cond.notFlags ?? [])]) {
    out.push((m) => void m.fl.add(f));
    out.push((m) => void m.fl.delete(f));
  }
  return out;
}

// ---------- 사건 한 개의 격자 정의 ----------

/** 이 사건이 읽는 모든 조건(사건 조건 · 가중 항 · 효과 보너스 · 선택지 조건 · 선택지 보너스)을 이름과 함께 */
function conditionsOf(ev: EventDef): { label: string; cond: Condition | undefined }[] {
  const list: { label: string; cond: Condition | undefined }[] = [{ label: 'cond', cond: ev.conditions }];
  (ev.modifiers ?? []).forEach((m, i) => list.push({ label: `mod${i}`, cond: m.when }));
  (ev.bonuses ?? []).forEach((b, i) => list.push({ label: `bon${i}`, cond: b.when }));
  for (const c of ev.choices ?? []) {
    list.push({ label: `req:${c.id}`, cond: c.requires });
    (c.bonuses ?? []).forEach((b, i) => list.push({ label: `cbon:${c.id}${i}`, cond: b.when }));
  }
  return list;
}

const YEAR_STEP_FIRST = 1940;
const YEAR_STEP_LAST = 2100;
/** 연도 격자의 10년 간격 칸(1940~2100) + 2105 */
const DECADE_YEARS: readonly number[] = [...Array.from({ length: (YEAR_STEP_LAST - YEAR_STEP_FIRST) / 10 + 1 }, (_, i) => YEAR_STEP_FIRST + i * 10), 2105];
const AGE_MAX = 110;

function stageSpan(stage: (typeof STAGES)[number]): [number, number] {
  const i = STAGES.indexOf(stage);
  const next = STAGES[i + 1];
  return [STAGE_TABLE[stage].startAge, next === undefined ? AGE_MAX : STAGE_TABLE[next].startAge - 1];
}

/** 연도 축: 10년 간격 + `yearRange` 경계 −1·0·+1 (+ 기준 연도) */
export function yearsOf(ev: EventDef): number[] {
  const s = new Set<number>(DECADE_YEARS);
  const r = ev.yearRange;
  if (r?.from !== undefined) for (const d of [-1, 0, 1]) s.add(r.from + d);
  if (r?.to !== undefined) for (const d of [-1, 0, 1]) s.add(r.to + d);
  s.add(baseYearOf(ev));
  return [...s].sort((a, b) => a - b);
}

/** 나이 축: `ageRange` 경계 −1·0·+1 + 사건 단계 경계 −1·0·+1 (+ 기준 나이). 부모 나이 조건을 읽는 사건은 0~110 전부 */
export function agesOf(ev: EventDef): number[] {
  const s = new Set<number>();
  const add = (v: number): void => void s.add(clamp(v, 0, AGE_MAX));
  const r = ev.ageRange;
  if (r?.min !== undefined) for (const d of [-1, 0, 1]) add(r.min + d);
  if (r?.max !== undefined) for (const d of [-1, 0, 1]) add(r.max + d);
  for (const st of ev.stages) {
    const [a, b] = stageSpan(st);
    for (const d of [-1, 0, 1]) {
      add(a + d);
      add(b + d);
    }
  }
  add(baseAgeOf(ev));
  const readsParentAge = conditionsOf(ev).some((c) => c.cond?.parentAge !== undefined || c.cond?.motherAge !== undefined);
  if (readsParentAge) for (let a = 0; a <= AGE_MAX; a++) s.add(a);
  return [...s].sort((a, b) => a - b);
}

export function baseAgeOf(ev: EventDef): number {
  const r = ev.ageRange;
  if (r?.min !== undefined && r.max !== undefined) return clamp(Math.floor((r.min + r.max) / 2), 0, AGE_MAX);
  if (r?.min !== undefined) return clamp(r.min, 0, AGE_MAX);
  if (r?.max !== undefined) return clamp(r.max, 0, AGE_MAX);
  const [a, b] = stageSpan(ev.stages[0] ?? 'infant');
  return Math.floor((a + b) / 2);
}

export function baseYearOf(ev: EventDef): number {
  const r = ev.yearRange;
  if (r?.from !== undefined && r.to !== undefined) return Math.floor((r.from + r.to) / 2);
  if (r?.from !== undefined) return r.from + 5;
  if (r?.to !== undefined) return r.to - 5;
  return 2000;
}

/** 「본 기록」 변형: n 본 적 없음 · d<k> k년 전에 봤다 · p:<id> 같은 종류의 다른 조르기 사건을 봤다 */
export function seenVariantsOf(ev: EventDef): string[] {
  const cd = ev.cooldown ?? 3;
  const out = new Set<string>(['n', 'd1', `d${Math.max(1, cd - 1)}`, `d${cd}`, `d${cd + 1}`]);
  for (const p of ev.askPeers ?? []) out.add(`p:${p}`);
  return [...out];
}

export function seenOf(ev: EventDef, label: string, age: number): Record<string, number> {
  if (label === 'n') return {};
  if (label.startsWith('p:')) return { [label.slice(2)]: age - 1 };
  return { [ev.id]: age - Number(label.slice(1)) };
}

// ---------- 칸 계산(출력) ----------

/**
 * 칸 하나의 출력(배열): [자격, 가중(`eventWeight`, `stepYear`처럼 view가 아닌 ctx), 추첨 가중(선택지 사건은 `selfAreaWeightFactor`까지), 결정자, 보이는 선택지 id(쉼표),
 * 효과 해시(보이는 선택지 순서대로 쉼표 · 서술 사건은 사건 효과 하나), (view로 본 보이는 선택지가 ctx와 다를 때만) 보이는 선택지 id]
 */
export type Cell = [number, number, number, string, string, string, string?];
export const CELL_FIELDS = ['el', 'w', 'dw', 'who', 'vc', 'fx', 'vv'] as const;

const effectsHash = (e: ReturnType<typeof resolveEffects>): string => fnv32(canon(e));

export function evalCell(ev: EventDef, desc: StateDesc, age: number, year: number, seen: Record<string, number>): Cell {
  const ctx = ctxOf(desc, age, year);
  const view: EligibilityView = { ...ctx, age, year, seen };
  const eligible = isEventEligible(ev, view) ? 1 : 0;
  const choice = isChoiceEvent(ev);
  const w = round9(eventWeight(ev, ctx));
  const dw = round9(eventWeight(ev, ctx) * (choice ? selfAreaWeightFactor(ev.id, age) : 1));
  const vis = visibleChoices(ev, ctx);
  const visView = visibleChoices(ev, view);
  const fx = choice ? vis.map((c) => effectsHash(resolveEffects(c.effects, c.bonuses, ctx))).join(',') : effectsHash(resolveEffects(ev.effects, ev.bonuses, ctx));
  const vc = vis.map((c) => c.id).join(',');
  const vv = visView.map((c) => c.id).join(',');
  const cell: Cell = [eligible, w, dw, choice ? decisionFor(ev.id, age) : '', vc, fx];
  if (vv !== vc) cell.push(vv);
  return cell;
}

/** 칸 → 필드 이름 → 글(비교용). 효과 해시는 선택지 id별로 풀어 둔다 */
export function cellFields(cell: Cell, ev: EventDef): Record<string, string> {
  const out: Record<string, string> = { el: String(cell[0]), w: String(cell[1]), dw: String(cell[2]), who: cell[3], vc: cell[4], vv: cell[6] ?? cell[4] };
  if (isChoiceEvent(ev)) {
    const ids = cell[4] === '' ? [] : cell[4].split(',');
    const hs = cell[5] === '' ? [] : cell[5].split(',');
    ids.forEach((id, i) => (out[`fx.${id}`] = hs[i] ?? ''));
  } else out['fx._'] = cell[5];
  return out;
}

// ---------- 격자 만들기 ----------

export interface EventGolden {
  /** 사건의 정적 정의(자격·가중·효과가 읽는 필드) */
  static: Record<string, unknown>;
  /** 칸 이름 `연도.나이.상태번호.본기록` → 출력 */
  cells: Record<string, Cell>;
}

export interface GridGolden {
  meta: Record<string, unknown>;
  states: StateDesc[];
  events: Record<string, EventGolden>;
}

/** 사건의 정적 정의: 풀의 사건 객체에서 자격·가중·효과가 읽는 필드만(문구는 제외), 선택지는 id를 키로 */
export function staticOf(ev: EventDef): Record<string, unknown> {
  const s: Record<string, unknown> = {
    stages: ev.stages,
    ageRange: ev.ageRange,
    yearRange: ev.yearRange,
    weight: ev.weight,
    once: ev.once,
    cooldown: ev.cooldown,
    conditions: ev.conditions,
    modifiers: ev.modifiers,
    effects: ev.effects,
    bonuses: ev.bonuses,
    trigger: ev.trigger,
    milestone: ev.milestone,
    ask: ev.ask,
    askPeers: ev.askPeers,
    eras: ev.eras,
    choiceOrder: ev.choices?.map((c) => c.id),
    choices: ev.choices === undefined ? undefined : Object.fromEntries(ev.choices.map((c) => [c.id, { requires: c.requires, effects: c.effects, bonuses: c.bonuses }])),
  };
  return JSON.parse(canon(s)) as Record<string, unknown>;
}

export const GRID_DESCRIPTION = [
  '사건 격자(사건마다 네 묶음의 합집합, 모든 칸은 변경 전 코드의 출력):',
  'G1 연도 축 = 연도(1940~2100 10년 간격 + 2105 + 그 사건 yearRange 경계 −1·0·+1) × 기준 나이 × 상태{조건 만족, 중립} × 본 적 없음',
  'G2 나이 축 = 나이(ageRange 경계 −1·0·+1 + 사건 단계 경계 −1·0·+1 + 기준 나이, 부모 나이 조건을 읽는 사건은 0~110 전부) × 기준 연도 × 상태{조건 만족, 중립} × 본 적 없음',
  'G3 상태 축 = 기준 연도·나이에서, 사건이 읽는 모든 조건(사건·가중 항·효과 보너스·선택지 조건·선택지 보너스)을 하나씩 만족시킨 상태와, 그 조건의 모든 항목 경계값(안쪽·바깥쪽)·플래그 켬/끔·열거 값 전부 변주',
  'G4 본 기록 축 = 기준 연도·나이·조건 만족 상태 × 본 기록{n, 1년 전, 쿨다운−1, 쿨다운, 쿨다운+1, 같은 종류 조르기 사건}',
  '줄인 축: 연도×나이×상태의 완전 곱은 만들지 않고 위 네 묶음(한 번에 한 축만 변주)으로 줄였다 — 연도는 yearRange만, 나이는 단계·ageRange·부모 나이만, 상태는 사건 조건이 읽는 항목만 자격·가중에 닿기 때문이다.',
  'G5 고정 표본 = 기준 연도·나이에서 사건이 읽는 플래그를 반반으로 켜고 재력·외모 대표값(0·20·35·50·65·70·85·100)·양육·성별·스탯·자산·가족을 의사 난수로 흩뜨린 상태 40개(사건 id에서 파생한 고정 시드)',
  '상태는 사건 조건을 읽어 만든다(사건별 조건 기반 상태 + 고정 표본 — 중복 없이 `states`에 쌓인다). 외모 50은 중립값(기존 모든 외모 항이 맞지 않는다).',
].join('\n');

const SAMPLE_STATES = 40;
/** 고정 의사 난수(결정론) */
function lcg(seed: number): () => number {
  let x = seed >>> 0;
  return () => {
    x = (Math.imul(x, 1664525) + 1013904223) >>> 0;
    return x / 0x100000000;
  };
}

export function buildGrid(pool: EventPool = eventPool(), baseSha = ''): GridGolden {
  const states: StateDesc[] = [];
  const stateIndex = new Map<string, number>();
  const idxOf = (m: Mut): number => {
    const d = toDesc(m);
    const k = canon(d);
    let i = stateIndex.get(k);
    if (i === undefined) {
      i = states.length;
      states.push(d);
      stateIndex.set(k, i);
    }
    return i;
  };
  const events: Record<string, EventGolden> = {};
  let cellCount = 0;
  for (const ev of pool.events) {
    const cells: Record<string, Cell> = {};
    const baseAge = baseAgeOf(ev);
    const baseYear = baseYearOf(ev);
    const put = (m: Mut, age: number, year: number, seenLabel: string): void => {
      const si = idxOf(m);
      const key = `${year}.${age}.${si}.${seenLabel}`;
      if (cells[key] === undefined) cells[key] = evalCell(ev, states[si], age, year, seenOf(ev, seenLabel, age));
    };
    const neut = neutral();
    const sat = satisfy(neut, ev.conditions, baseAge);
    const satBase = satisfy(neut, ev.conditions);
    // G1 연도 축
    for (const y of yearsOf(ev)) for (const m of [sat, neut]) put(m, baseAge, y, 'n');
    // G2 나이 축 (부모 나이 조건은 나이마다 맞춰야 하므로 나이를 적용하지 않은 만족 상태)
    for (const a of agesOf(ev)) for (const m of [satBase, neut]) put(m, a, baseYear, 'n');
    // G3 상태 축
    put(sat, baseAge, baseYear, 'n');
    put(neut, baseAge, baseYear, 'n');
    const conds = conditionsOf(ev);
    const readFlags = new Set<string>();
    for (const { cond } of conds) for (const f of [...(cond?.flags ?? []), ...(cond?.notFlags ?? [])]) readFlags.add(f);
    for (const { cond } of conds) {
      const base = satisfy(sat, cond, baseAge);
      put(base, baseAge, baseYear, 'n');
      for (const mut of leafMutators(cond, baseAge)) {
        for (const from of [base, sat]) {
          const m = cloneMut(from);
          mut(m);
          put(m, baseAge, baseYear, 'n');
        }
      }
    }
    // 읽는 플래그 전부 켬·전부 끔
    if (readFlags.size > 0) {
      const all = cloneMut(sat);
      for (const f of readFlags) all.fl.add(f);
      put(all, baseAge, baseYear, 'n');
      const none = cloneMut(sat);
      for (const f of readFlags) none.fl.delete(f);
      put(none, baseAge, baseYear, 'n');
    }
    // 선택지 조건을 하나씩 만족시킨 상태에서 부모 재력 1~5·양육 전부
    for (let pw = 1; pw <= 5; pw++) {
      const m = cloneMut(sat);
      m.pw = pw;
      put(m, baseAge, baseYear, 'n');
    }
    // G5 고정 표본: 사건이 읽는 플래그를 반반으로 켠 의사 난수 상태(사건 id에서 파생한 고정 시드)
    const rnd = lcg(Number.parseInt(fnv32(ev.id), 16));
    const looksPick = [0, 20, 35, 50, 50, 65, 70, 85, 100];
    for (let i = 0; i < SAMPLE_STATES; i++) {
      const m = cloneMut(sat);
      m.pw = 1 + Math.floor(rnd() * 5);
      m.lk = looksPick[Math.floor(rnd() * looksPick.length)];
      m.pa = Math.floor(rnd() * PARENTING_STYLES.length);
      m.g = Math.floor(rnd() * GENDERS.length);
      m.st = [Math.floor(rnd() * 101), Math.floor(rnd() * 101), Math.floor(rnd() * 101), Math.floor(rnd() * 101)];
      for (const f of readFlags) {
        if (rnd() < 0.5) m.fl.add(f);
        else m.fl.delete(f);
      }
      if (m.as !== null) m.as = [Math.floor(rnd() * 20001) - 5000, Math.floor(rnd() * 8001), Math.floor(rnd() * 10001), 0, Math.floor(rnd() * DWELLINGS.length)];
      if (m.fa !== null) m.fa = [1 + Math.floor(rnd() * 5), 22 + Math.floor(rnd() * 20), 24 + Math.floor(rnd() * 22), Math.floor(rnd() * HOUSINGS.length)];
      put(m, baseAge, baseYear, 'n');
    }
    // G4 본 기록 축
    for (const q of seenVariantsOf(ev)) put(sat, baseAge, baseYear, q);
    events[ev.id] = { static: staticOf(ev), cells: Object.fromEntries(Object.entries(cells).sort(([a], [b]) => (a < b ? -1 : 1))) };
    cellCount += Object.keys(cells).length;
  }
  return {
    meta: {
      kind: 'eligibility-grid',
      baseSha,
      events: pool.events.length,
      cells: cellCount,
      states: states.length,
      description: GRID_DESCRIPTION,
      cellFields: [...CELL_FIELDS],
      keyFormat: '연도.나이.상태번호.본기록',
      stateFormat: '[부모재력, 외모, 양육, 성별, 학력, 건강, 행복, 관계, 플래그, 자산|null, 가족|null]',
    },
    states,
    events,
  };
}

// ---------- 진행 표본 ----------

export const PROGRESS_GENERATIONS = ['industrial', 'boomer', 'g86', 'genx', 'millennial', 'genz', 'alpha'] as const;
/** 외모 50 고정 판(예외 목록 사건의 외모 항에 닿지 않는다 — 이후 단계에서도 그대로여야 한다) */
export const PROGRESS_NEUTRAL_SEEDS = 12;
/** 외모를 판에서 나온 대로 둔 판(예외 목록 사건의 외모 항이 바뀌면 달라질 수 있다) */
export const PROGRESS_NATURAL_SEEDS = 6;

export const progressSeeds = (n: number, gi: number, offset: number): number[] => Array.from({ length: n }, (_, i) => offset + 1 + i * 37 + gi * 1009);

/**
 * 한 판을 자동 모드로 끝까지 진행하며 해마다 한 줄을 남긴다:
 * `나이|후보수|후보 id 해시|후보 가중 해시|틱 종류|사건 id|(위임 by:선택)|대기 선택지(쉼표)>고른 선택지|진행 난수 상태`
 * 후보는 그 해 시작 상태에서 `isEventEligible`을 통과하는 풀의 사건(R-561 등 걸러내기 전), 가중은 `eventWeight`(ctx)다.
 */
export function progressTrace(seed: number, generation: ProfileId, looks: number | undefined, pool: EventPool = eventPool(), touched?: boolean[]): string[] {
  let s: GameState = startLife(seed, generation, looks === undefined ? {} : { looks });
  const lines: string[] = [];
  for (let guard = 0; s.phase === 'life' && guard < 1000; guard++) {
    if (s.pending !== null) {
      const w = autoChoiceWeights(s, pool);
      if (w === null) throw new Error('progressTrace: 자동 선택 가중을 만들 수 없다');
      // `autoResolveStep`과 같은 고르기(같은 난수 한 칸)를 풀어 써서 고른 선택지 id를 기록한다
      const choiceId = w.ids[createRng(s.rngState).weightedIndex(w.weights)];
      const r = resolveChoiceStep(s, s.pending.key, choiceId, pool);
      lines[lines.length - 1] += `>${choiceId}|${(r.state.rngState >>> 0).toString(16)}`;
      s = r.state;
      continue;
    }
    const c = s.character!;
    const age = s.age;
    const year = c.birthYear + age;
    const ctx: CondContext = {
      character: c,
      stats: s.stats,
      flags: new Set(s.flags),
      age,
      family: s.birthReport === null ? null : { birthOrder: s.birthReport.birthOrder, motherBirthAge: s.birthReport.mother.age, fatherBirthAge: s.birthReport.father.age, housing: s.birthReport.housing },
      assets: s.assets,
    };
    const view: EligibilityView = { ...ctx, age, year, seen: s.seen };
    const cands = pool.events.filter((ev) => isEventEligible(ev, view));
    const ids = cands.map((e) => e.id).sort();
    const wts = cands.map((e) => `${e.id}:${round9(eventWeight(e, ctx))}`).sort();
    const r = stepYear(s, pool);
    const t = r.tick;
    const by = t.by === undefined ? '' : `${t.by}:${t.choiceId ?? ''}`;
    const pend = r.state.pending === null ? '' : r.state.pending.choiceIds.join(',');
    // 외모 표준 표(PL16 예외 목록)가 닿는 사건이 그 해 후보에 있었는가 — 자연 외모 판의 허용 규칙이 읽는다
    touched?.push(cands.some((e) => LOOKS_EXCEPTION_EVENTS.includes(e.id)));
    lines.push(`${age}|${ids.length}|${fnv32(ids.join(','))}|${fnv32(wts.join(','))}|${t.kind}|${t.eventId ?? ''}|${by}|${pend}`);
    if (r.state.pending === null) lines[lines.length - 1] += `|${(r.state.rngState >>> 0).toString(16)}`;
    s = r.state;
  }
  return lines;
}

export interface ProgressGolden {
  meta: Record<string, unknown>;
  lives: Record<string, string[]>;
}

export const PROGRESS_DESCRIPTION = [
  '진행 표본: 세대 7종 × (외모 50 고정 판 12개 + 외모 자연 판 6개)를 자동 모드(`autoResolveStep`)로 끝까지 `stepYear`로 진행하며 해마다 한 줄을 남긴다.',
  '줄 모양: `나이|후보수|후보 id 해시|후보 가중 해시|틱 종류|사건 id|(위임 by:선택)|대기 선택지>고른 선택지|진행 난수 상태` — 선택지 대기 해는 해결 때 `>고른 선택지|난수 상태`가 이어 붙는다.',
  '키: `세대/시드/neutral50` (외모 50 고정) · `세대/시드/natural` (자연 외모). 외모 50 고정 판은 이후 단계에서도 한 줄도 달라지면 안 된다.',
].join('\n');

export function buildProgress(pool: EventPool = eventPool(), baseSha = ''): ProgressGolden {
  const lives: Record<string, string[]> = {};
  PROGRESS_GENERATIONS.forEach((gen, gi) => {
    for (const seed of progressSeeds(PROGRESS_NEUTRAL_SEEDS, gi, 0)) lives[`${gen}/${seed}/neutral50`] = progressTrace(seed, gen, 50, pool);
    for (const seed of progressSeeds(PROGRESS_NATURAL_SEEDS, gi, 500_000)) lives[`${gen}/${seed}/natural`] = progressTrace(seed, gen, undefined, pool);
  });
  return {
    meta: { kind: 'eligibility-progress', baseSha, lives: Object.keys(lives).length, description: PROGRESS_DESCRIPTION },
    lives: Object.fromEntries(Object.entries(lives).sort(([a], [b]) => (a < b ? -1 : 1))),
  };
}

// ---------- 파일 쓰기(결정론: 키 정렬, LF, 사건·판 한 줄씩) ----------

export function serializeGrid(g: GridGolden): string {
  const states = g.states.map((s) => canon(s)).join(',\n');
  const events = Object.entries(g.events)
    .map(([id, e]) => `${JSON.stringify(id)}:{"cells":{${Object.entries(e.cells).map(([k, c]) => `${JSON.stringify(k)}:${canon(c)}`).join(',')}},"static":${canon(e.static)}}`)
    .join(',\n');
  return `{"meta":${canon(g.meta)},\n"states":[\n${states}\n],\n"events":{\n${events}\n}}\n`;
}

export function serializeProgress(g: ProgressGolden): string {
  const lives = Object.entries(g.lives)
    .map(([k, v]) => `${JSON.stringify(k)}:${canon(v)}`)
    .join(',\n');
  return `{"meta":${canon(g.meta)},\n"lives":{\n${lives}\n}}\n`;
}

// ---------- 비교 ----------

/**
 * 허용된 필드별 차이 (설계 persona-model.md 3절·4B절 「기존 사건 예외」): 사건 id + 허용 필드 경로(접두).
 * 경로 모양: `static.modifiers…` · `static.choices.<선택지>.bonuses…` · `cell.<필드>` (칸 필드: el·w·dw·who·vc·vv·fx.<선택지 id>).
 * `whenLooksNot50`: 외모가 50이 아닌 칸의 차이만 허용한다.
 */
export interface AllowedDiff {
  event: string;
  path: string;
  whenLooksNot50?: boolean;
}

/**
 * 설계 4B 「기존 사건 예외」 — 외모 표준 표(`LOOKW`)로 옮긴 연애·소개·재회 5곳과 외모 가중·소득 보너스를 뺀 사업 제안 2곳 (SPEC-018 PL16, 설계 persona-model.md 4B `[CX-002-004]`).
 * 이 목록이 골든 허용 차이의 전부다: 예외 사건의 외모 `modifiers` 항(사건 단위가 아니라 필드 단위), 사업 선택지의 외모 `bonuses` 항, 그 결과로 달라지는 칸(외모 50이 아닌 칸의 `w`·`dw`·사업 `fx`).
 * 결혼 사슬 4건·`school-mirror`·`youth-approached`·`youth-meeting`/`school-first-love`의 선택지 외모 보너스는 이 목록에 없다(변경 0 — 골든 그대로 대조).
 */
export { LOOKS_BUSINESS_EVENTS, LOOKS_EXCEPTION_EVENTS, LOOKS_ROMANCE_EVENTS };

export const LOOKS_ALLOWED: readonly AllowedDiff[] = [
  // 첫사랑 `confess`의 「looks ≤ 30 → 행복 −3」 보너스 삭제 [결정 후속 233, 설계 4B ②] — 연애 가중 0.30배와 겹치는 이중 감점. ≥ 70 보너스·`youth-meeting` +1은 그대로(골든과 대조)
  { event: 'school-first-love', path: 'static.choices.confess.bonuses' },
  { event: 'school-first-love', path: 'cell.fx.confess', whenLooksNot50: true },
  ...LOOKS_ROMANCE_EVENTS.flatMap((event): AllowedDiff[] => [
    { event, path: 'static.modifiers' },
    { event, path: 'cell.w', whenLooksNot50: true },
    { event, path: 'cell.dw', whenLooksNot50: true },
  ]),
  ...LOOKS_BUSINESS_EVENTS.flatMap((event): AllowedDiff[] => [
    { event, path: 'static.modifiers' },
    { event, path: 'static.choices.start.bonuses' },
    { event, path: 'cell.w', whenLooksNot50: true },
    { event, path: 'cell.dw', whenLooksNot50: true },
    { event, path: 'cell.fx.start', whenLooksNot50: true },
  ]),
];

/** 정적 정의에서 외모 항만 뺀다: 예외 사건의 `modifiers`(외모 항)·사업 선택지 `start`의 `bonuses`(외모 항). 빈 배열은 없는 것으로 본다. 나머지는 그대로 남아 골든과 정확히 같아야 한다 */
export function withoutLooksTerms(id: string, s: Record<string, unknown>): Record<string, unknown> {
  const out = JSON.parse(JSON.stringify(s)) as Record<string, unknown>;
  const hasLooks = (x: unknown): boolean => JSON.stringify((x as { when?: unknown })?.when ?? null).includes('"looks"');
  if (Array.isArray(out.modifiers)) {
    const keep = (out.modifiers as unknown[]).filter((m) => !hasLooks(m));
    if (keep.length > 0) out.modifiers = keep;
    else delete out.modifiers;
  }
  if (id === 'school-first-love') {
    const confess = (out.choices as Record<string, { bonuses?: unknown[] }> | undefined)?.confess;
    if (confess?.bonuses !== undefined) {
      const keep = confess.bonuses.filter((b) => !JSON.stringify((b as { when?: unknown }).when ?? null).includes('"max":30'));
      if (keep.length > 0) confess.bonuses = keep;
      else delete confess.bonuses;
    }
  }
  if (LOOKS_BUSINESS_EVENTS.includes(id)) {
    const start = (out.choices as Record<string, { bonuses?: unknown[] }> | undefined)?.start;
    if (start?.bonuses !== undefined) {
      const keep = start.bonuses.filter((b) => !hasLooks(b));
      if (keep.length > 0) start.bonuses = keep;
      else delete start.bonuses;
    }
  }
  return out;
}

export interface Diff {
  event: string;
  where: string;
  field: string;
  golden: string;
  now: string;
  /** 칸 차이일 때 그 칸의 외모(정적 차이는 없음) */
  looks?: number;
}

const flattenInto = (prefix: string, value: unknown, out: Map<string, string>): void => {
  if (value !== null && typeof value === 'object') {
    const entries = Array.isArray(value) ? value.map((v, i) => [String(i), v] as const) : Object.entries(value as Record<string, unknown>);
    if (entries.length === 0) out.set(prefix, Array.isArray(value) ? '[]' : '{}');
    for (const [k, v] of entries) flattenInto(`${prefix}.${k}`, v, out);
  } else out.set(prefix, JSON.stringify(value));
};

/** 사건의 정적 정의 차이 */
export function staticDiffs(id: string, golden: Record<string, unknown>, now: Record<string, unknown>): Diff[] {
  const a = new Map<string, string>();
  const b = new Map<string, string>();
  flattenInto('static', golden, a);
  flattenInto('static', now, b);
  const diffs: Diff[] = [];
  for (const k of new Set([...a.keys(), ...b.keys()])) {
    if (a.get(k) !== b.get(k)) diffs.push({ event: id, where: 'static', field: k, golden: a.get(k) ?? '(없음)', now: b.get(k) ?? '(없음)' });
  }
  return diffs;
}

/** 칸 하나의 차이 */
export function cellDiffs(ev: EventDef, key: string, golden: Cell, desc: StateDesc, seenLabel: string): Diff[] {
  const [year, age] = key.split('.').map(Number);
  const now = evalCell(ev, desc, age, year, seenOf(ev, seenLabel, age));
  const a = cellFields(golden, ev);
  const b = cellFields(now, ev);
  const diffs: Diff[] = [];
  for (const f of new Set([...Object.keys(a), ...Object.keys(b)])) {
    if (a[f] !== b[f]) diffs.push({ event: ev.id, where: `칸 ${key} (상태 ${JSON.stringify(desc)}, 본 기록 ${seenLabel})`, field: `cell.${f}`, golden: a[f] ?? '(없음)', now: b[f] ?? '(없음)', looks: desc[1] });
  }
  return diffs;
}

/** 허용 목록에 걸리는 차이를 뺀다 */
/**
 * SPEC-018 PL5(결정 후속 237) — 옛 사건에 더한 **맞춤 인생 전용 선택지**: `school-exam`의 `night`(`requires: { parentWealth ≤ 1, tailored }`). 맞춤 인생이 없는 판에서는 `tailored`가 맞지 않아
 * 보이지 않으므로 칸(자격·가중·보이는 선택지·효과)은 한 칸도 달라지지 않는다 — 허용은 정적 정의의 그 선택지와 선택지 순서의 넷째 자리뿐이다(`cell.*` 허용 없음).
 * `act` 표지·`retiredWith`는 정적 정의(`staticOf`)가 담지 않는 맞춤 인생 전용 필드라 이 목록에 없다.
 */
export const PL5_ALLOWED: readonly AllowedDiff[] = [
  { event: 'school-exam', path: 'static.choiceOrder.3' },
  { event: 'school-exam', path: 'static.choices.night' },
];

export function withoutAllowed(diffs: Diff[], allowed: readonly AllowedDiff[]): Diff[] {
  return diffs.filter((d) => !allowed.some((a) => a.event === d.event && (d.field === a.path || d.field.startsWith(`${a.path}.`)) && (a.whenLooksNot50 !== true || d.looks !== 50)));
}

export function formatDiffs(diffs: readonly Diff[], limit = 12): string {
  const head = diffs.slice(0, limit).map((d) => `  - 사건 ${d.event} · ${d.where} · 필드 ${d.field}\n      골든: ${d.golden}\n      지금: ${d.now}`);
  return `골든과 다른 곳 ${diffs.length}건${diffs.length > limit ? ` (앞 ${limit}건)` : ''}\n${head.join('\n')}`;
}

// ---------- 칸 이름·경계 칸 ----------

/** 칸 이름 `연도.나이.상태번호.본기록` 쪼개기 (본 기록 라벨에는 `.`이 없다 — 사건 id는 `-`만 쓴다) */
export function parseKey(key: string): { year: number; age: number; state: number; seen: string } {
  const [y, a, s, ...rest] = key.split('.');
  return { year: Number(y), age: Number(a), state: Number(s), seen: rest.join('.') };
}

/** 골든의 정적 정의에서 경계 칸(연도가 `yearRange` 경계 −1·0·+1 이거나 나이가 `ageRange` 경계 −1·0·+1)인가 */
export function isBoundaryCell(staticDef: Record<string, unknown>, year: number, age: number): boolean {
  const yr = staticDef.yearRange as { from?: number; to?: number } | undefined;
  const ar = staticDef.ageRange as { min?: number; max?: number } | undefined;
  const near = (v: number, b: number | undefined): boolean => b !== undefined && Math.abs(v - b) <= 1;
  return near(year, yr?.from) || near(year, yr?.to) || near(age, ar?.min) || near(age, ar?.max);
}
