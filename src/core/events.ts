import { DEFAULT_COOLDOWN, STAGE_TABLE } from '../data/lifeTable';
import { STAT_MAX, STAT_MIN, addDeltas, type StatDeltas } from './stats';
import {
  ERAS,
  GENDERS,
  PARENTING_STYLES,
  PARENT_WEALTHS,
  STAGES,
  STAT_KEYS,
  type Character,
  type Effects,
  type Era,
  type Gender,
  type ParentingStyle,
  type Stage,
  type StatKey,
  type Stats,
} from './types';

/**
 * 이벤트 엔진의 데이터 모델과 검증. React·DOM과 무관한 순수 모듈.
 * 이벤트는 src/data/events/*.json 에 있고, 작성법은 docs/data/events-schema.md 에 있다.
 * 코드 수정 없이 JSON만 추가해도 동작하고, 잘못된 데이터는 로드할 때 바로 예외로 드러난다(validateEventFiles).
 */

// ---------- 모델 ----------

/** 조건 검증용 상한: 형제 순서는 다섯째까지(출생신고 추첨 범위), 부모 나이(어머니 나이 포함)는 130살까지만 적을 수 있다 */
const BIRTH_ORDER_MAX = 5;
const PARENT_AGE_MAX = 130;

export interface Range {
  min?: number;
  max?: number;
}

/** 조건: 적힌 항목이 모두 맞아야(AND) 참이다. 배열 항목(parenting·gender)은 그중 하나면 맞다. */
export interface Condition {
  stats?: Partial<Record<StatKey, Range>>;
  looks?: Range;
  parentWealth?: Range;
  /** 형제 순서(1 첫째 ~ 5 다섯째) — 출생신고에서 정해진 값 (SPEC-003 BR6) */
  birthOrder?: Range;
  /** 두 부모 중 나이가 많은 쪽의 지금 나이 = 태어났을 때 나이 + 아이의 지금 나이 (SPEC-003 BR6). 부모의 병환·임종처럼 부모 나이와 어긋나면 안 되는 사건에 쓴다. */
  parentAge?: Range;
  /** 어머니의 지금 나이 = 태어났을 때 어머니 나이 + 아이의 지금 나이 (SPEC-003 BR6, R-268). 「동생이 생겼다」처럼 어머니 나이가 한계를 넘으면 안 되는 사건에 쓴다. */
  motherAge?: Range;
  parenting?: ParentingStyle[];
  gender?: Gender[];
  /** 모두 설정돼 있어야 한다 */
  flags?: string[];
  /** 하나도 설정돼 있지 않아야 한다 */
  notFlags?: string[];
}

/** 조건이 맞을 때 효과를 더한다(부모 재력·교육방식·외모 같은 캐릭터 속성을 효과에 반영하는 방법). */
export interface Bonus {
  when: Condition;
  effects: Effects;
}

/** 조건이 맞으면 이벤트 가중치에 weight를 곱한다(예: 외모가 높을수록 연애 이벤트 확률 상승). */
export interface Modifier {
  when: Condition;
  weight: number;
}

export interface ChoiceDef {
  id: string;
  label: string;
  /** 고른 뒤 보여 주는 결과 문구 */
  result: string;
  effects?: Effects;
  bonuses?: Bonus[];
  /** 이 조건을 만족할 때만 선택지가 보인다 */
  requires?: Condition;
}

export interface EventDef {
  id: string;
  title: string;
  text: string;
  stages: Stage[];
  ageRange?: Range;
  eras?: Era[];
  weight: number;
  once: boolean;
  /** once가 아닐 때 같은 이벤트가 다시 나오기까지의 최소 년수 (기본 DEFAULT_COOLDOWN) */
  cooldown?: number;
  conditions?: Condition;
  modifiers?: Modifier[];
  /** 서술 이벤트(선택지 없음)의 효과 */
  effects?: Effects;
  bonuses?: Bonus[];
  /** 선택지 이벤트(2~3개). 없으면 서술 이벤트. */
  choices?: ChoiceDef[];
}

export function isChoiceEvent(ev: EventDef): boolean {
  return ev.choices !== undefined && ev.choices.length > 0;
}

export interface EventPool {
  events: readonly EventDef[];
  byId: ReadonlyMap<string, EventDef>;
}

/** 이벤트 목록 → 풀. id가 겹치면 throw. 개별 이벤트의 형태 검증은 validateEventFiles가 한다. */
export function createEventPool(events: readonly EventDef[]): EventPool {
  const byId = new Map<string, EventDef>();
  for (const ev of events) {
    if (byId.has(ev.id)) throw new Error(`createEventPool: 이벤트 id가 겹친다 (${ev.id})`);
    byId.set(ev.id, ev);
  }
  return { events, byId };
}

// ---------- 조건 평가 ----------

/** 조건이 읽는 출생 가족 정보 (출생신고 상세에서 온다: 형제 순서와 태어났을 때 부모 나이) */
export interface FamilyView {
  birthOrder: number;
  motherBirthAge: number;
  fatherBirthAge: number;
}

export interface CondContext {
  character: Character;
  stats: Stats;
  flags: ReadonlySet<string>;
  /** 지금 아이의 나이 (parentAge 조건에 필요) */
  age?: number;
  /** 출생 가족 정보 (birthOrder·parentAge 조건에 필요). 없으면 그 조건은 맞지 않는 것으로 본다. */
  family?: FamilyView | null;
}

const inRange = (value: number, r: Range | undefined): boolean =>
  r === undefined || ((r.min === undefined || value >= r.min) && (r.max === undefined || value <= r.max));

export function meetsCondition(cond: Condition | undefined, ctx: CondContext): boolean {
  if (cond === undefined) return true;
  if (cond.stats) {
    for (const key of STAT_KEYS) if (!inRange(ctx.stats[key], cond.stats[key])) return false;
  }
  if (!inRange(ctx.character.looks, cond.looks)) return false;
  if (!inRange(ctx.character.parentWealth, cond.parentWealth)) return false;
  if (cond.birthOrder !== undefined || cond.parentAge !== undefined || cond.motherAge !== undefined) {
    // 가족 정보를 모르는데 가족 조건이 걸려 있으면 맞지 않는다(말이 안 되는 사건이 일어나는 쪽보다 안 일어나는 쪽이 안전하다)
    const family = ctx.family;
    if (family === undefined || family === null) return false;
    if (!inRange(family.birthOrder, cond.birthOrder)) return false;
    if (cond.parentAge !== undefined) {
      if (ctx.age === undefined) return false;
      if (!inRange(Math.max(family.motherBirthAge, family.fatherBirthAge) + ctx.age, cond.parentAge)) return false;
    }
    if (cond.motherAge !== undefined) {
      if (ctx.age === undefined) return false;
      if (!inRange(family.motherBirthAge + ctx.age, cond.motherAge)) return false;
    }
  }
  if (cond.parenting && !cond.parenting.includes(ctx.character.parenting)) return false;
  if (cond.gender && !cond.gender.includes(ctx.character.gender)) return false;
  if (cond.flags && !cond.flags.every((f) => ctx.flags.has(f))) return false;
  if (cond.notFlags && cond.notFlags.some((f) => ctx.flags.has(f))) return false;
  return true;
}

/** 지금 보이는 선택지(requires를 만족하는 것). 순서는 이벤트에 적힌 순서 그대로. */
export function visibleChoices(ev: EventDef, ctx: CondContext): ChoiceDef[] {
  return (ev.choices ?? []).filter((c) => meetsCondition(c.requires, ctx));
}

/** 이벤트가 일어날 수 있는 상태의 요약 (state에서 필요한 것만) */
export interface EligibilityView extends CondContext {
  age: number;
  era: Era;
  /** id -> 마지막으로 일어난 나이 */
  seen: Readonly<Record<string, number>>;
}

export function stageOfAge(age: number): Stage {
  let found: Stage = 'infant';
  for (const s of STAGES) if (age >= STAGE_TABLE[s].startAge) found = s;
  return found;
}

/** 본 이벤트 기록에서 이 id를 마지막으로 본 나이. 자기 속성만 읽는다(`constructor` 같은 상속 속성이 "본 적 있음"으로 읽히지 않게, R-046). */
export function lastSeenAge(seen: Readonly<Record<string, number>>, id: string): number | undefined {
  return Object.prototype.hasOwnProperty.call(seen, id) ? seen[id] : undefined;
}

export function isEventEligible(ev: EventDef, view: EligibilityView): boolean {
  if (!ev.stages.includes(stageOfAge(view.age))) return false;
  if (!inRange(view.age, ev.ageRange)) return false;
  if (ev.eras && !ev.eras.includes(view.era)) return false;
  const last = lastSeenAge(view.seen, ev.id);
  if (last !== undefined) {
    if (ev.once) return false;
    if (view.age - last < (ev.cooldown ?? DEFAULT_COOLDOWN)) return false;
  }
  if (!meetsCondition(ev.conditions, view)) return false;
  if (isChoiceEvent(ev) && visibleChoices(ev, view).length < 2) return false;
  return true;
}

/** 기본 가중치 × 조건이 맞는 modifier 가중치들의 곱 */
export function eventWeight(ev: EventDef, ctx: CondContext): number {
  let w = ev.weight;
  for (const m of ev.modifiers ?? []) if (meetsCondition(m.when, ctx)) w *= m.weight;
  return w;
}

export interface ResolvedEffects {
  stats: StatDeltas;
  setFlags: string[];
  clearFlags: string[];
}

/** 기본 효과 + 조건이 맞는 보너스 효과를 합친다. 보너스 조건은 효과를 적용하기 전 상태로 판정한다(보너스끼리 연쇄하지 않는다). */
export function resolveEffects(base: Effects | undefined, bonuses: Bonus[] | undefined, ctx: CondContext): ResolvedEffects {
  let stats: StatDeltas = { ...(base?.stats ?? {}) };
  const setFlags = [...(base?.setFlags ?? [])];
  const clearFlags = [...(base?.clearFlags ?? [])];
  for (const b of bonuses ?? []) {
    if (!meetsCondition(b.when, ctx)) continue;
    stats = addDeltas(stats, b.effects.stats ?? {});
    setFlags.push(...(b.effects.setFlags ?? []));
    clearFlags.push(...(b.effects.clearFlags ?? []));
  }
  return { stats, setFlags, clearFlags };
}

// ---------- 스키마 검증 ----------

export const FLAG_PATTERN = /^[a-z][a-z0-9_]{0,38}$/;
export const EVENT_ID_PATTERN = /^[a-z][a-z0-9-]{1,47}$/;
const CHOICE_ID_PATTERN = /^[a-z][a-z0-9-]{0,31}$/;
const MAX_AGE_ABS = 110;
const MAX_EFFECT_DELTA = 50;
const CONTROL_CHARS = /[\u0000-\u001f\u007f]/;

/**
 * 수치 한도 (R-046): 검증은 통과하지만 런타임을 깨는 값을 막는다.
 *  - 가중치: 이벤트 0.1~100, 모디파이어 배수 0.1~10. 0에 가까운 값은 곱할수록 언더플로해 확률이 사라진다.
 *  - 모디파이어는 이벤트당 최대 MAX_MODIFIERS개, 곱의 최악(모두 맞을 때/모두 안 맞을 때)도 [MIN_EFFECTIVE_WEIGHT, MAX_EFFECTIVE_WEIGHT]를 지킨다.
 *  - 보너스는 목록당 최대 MAX_BONUSES개. 한 스탯에 더해질 수 있는 변화량의 최악의 합(기본 효과 + 모든 보너스)도 ±MAX_TOTAL_DELTA 이내여야 한다.
 *    자동 선택이 점수의 지수(Math.exp)를 가중치로 쓰므로, 합이 한없이 커지면 Infinity가 된다.
 */
export const MIN_EVENT_WEIGHT = 0.1;
export const MAX_EVENT_WEIGHT = 100;
export const MIN_MODIFIER_WEIGHT = 0.1;
export const MAX_MODIFIER_WEIGHT = 10;
export const MAX_MODIFIERS = 6;
export const MIN_EFFECTIVE_WEIGHT = 0.01;
export const MAX_EFFECTIVE_WEIGHT = 10000;
export const MAX_BONUSES = 8;
export const MAX_TOTAL_DELTA = 50;

/**
 * 이벤트 id 예약어 (R-046): 본 이벤트 기록(seen)은 평범한 객체라 `constructor` 같은 이름이 상속 속성으로 읽힐 수 있다.
 * 읽는 쪽(lastSeenAge)도 자기 속성만 보지만, 데이터 단계에서도 막아 둔다. 대소문자는 구분하지 않는다.
 */
export const RESERVED_EVENT_IDS: ReadonlySet<string> = new Set([
  ...Object.getOwnPropertyNames(Object.prototype).map((n) => n.toLowerCase()),
  'prototype',
  'proto',
  '__proto__',
]);

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const isInt = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v);

export class EventDataError extends Error {
  readonly problems: string[];
  constructor(problems: string[]) {
    super(`이벤트 데이터 오류 ${problems.length}건:\n- ${problems.join('\n- ')}`);
    this.name = 'EventDataError';
    this.problems = problems;
  }
}

/** 문제 목록에 `경로: 메시지`를 쌓는 작은 도우미 */
class Problems {
  readonly list: string[] = [];
  constructor(private readonly prefix: string) {}
  add(path: string, msg: string): void {
    this.list.push(`${this.prefix}${path ? ` ${path}` : ''}: ${msg}`);
  }
}

function checkKeys(o: Obj, allowed: readonly string[], required: readonly string[], path: string, p: Problems): void {
  for (const k of Object.keys(o)) if (!allowed.includes(k)) p.add(path, `알 수 없는 항목 "${k}" (오타일 수 있다. 허용: ${allowed.join(', ')})`);
  for (const k of required) if (o[k] === undefined) p.add(path, `필수 항목 "${k}"가 없다`);
}

function checkText(v: unknown, path: string, min: number, max: number, p: Problems): void {
  if (typeof v !== 'string') return void p.add(path, '문자열이어야 한다');
  if (v !== v.trim()) p.add(path, '앞뒤 공백이 있다');
  if (CONTROL_CHARS.test(v)) p.add(path, '줄바꿈 등 제어 문자가 있다');
  if (v.length < min || v.length > max) p.add(path, `길이는 ${min}~${max}자여야 한다 (지금 ${v.length}자)`);
}

function checkRange(v: unknown, path: string, lo: number, hi: number, p: Problems): void {
  if (!isObj(v)) return void p.add(path, '{ min, max } 객체여야 한다');
  checkKeys(v, ['min', 'max'], [], path, p);
  if (v.min === undefined && v.max === undefined) p.add(path, 'min 또는 max가 하나는 있어야 한다');
  for (const k of ['min', 'max'] as const) {
    const x = v[k];
    if (x === undefined) continue;
    if (!isInt(x) || x < lo || x > hi) p.add(`${path}.${k}`, `${lo}~${hi}의 정수여야 한다`);
  }
  if (isInt(v.min) && isInt(v.max) && v.min > v.max) p.add(path, `min(${v.min})이 max(${v.max})보다 크다`);
}

/** 플래그 이름 목록 검사. 문제가 없으면 true. */
function checkFlagList(v: unknown, path: string, p: Problems): boolean {
  if (!Array.isArray(v) || v.length === 0) {
    p.add(path, '비어 있지 않은 배열이어야 한다');
    return false;
  }
  let ok = true;
  const seen = new Set<string>();
  v.forEach((f, i) => {
    if (typeof f !== 'string' || !FLAG_PATTERN.test(f)) {
      p.add(`${path}[${i}]`, `플래그 이름은 소문자·숫자·밑줄(예: first_job)이어야 한다 (지금 ${JSON.stringify(f)})`);
      ok = false;
    } else if (seen.has(f)) {
      p.add(`${path}[${i}]`, `플래그가 중복이다 (${f})`);
      ok = false;
    }
    seen.add(String(f));
  });
  return ok;
}

function checkEnumList<T extends string>(v: unknown, all: readonly T[], path: string, p: Problems): void {
  if (!Array.isArray(v) || v.length === 0) return void p.add(path, `비어 있지 않은 배열이어야 한다 (허용: ${all.join(', ')})`);
  const seen = new Set<unknown>();
  v.forEach((x, i) => {
    if (!all.includes(x as T)) p.add(`${path}[${i}]`, `허용되지 않는 값 ${JSON.stringify(x)} (허용: ${all.join(', ')})`);
    else if (seen.has(x)) p.add(`${path}[${i}]`, `값이 중복이다 (${String(x)})`);
    seen.add(x);
  });
}

function checkCondition(v: unknown, path: string, p: Problems): void {
  if (!isObj(v)) return void p.add(path, '조건 객체여야 한다');
  checkKeys(v, ['stats', 'looks', 'parentWealth', 'birthOrder', 'parentAge', 'motherAge', 'parenting', 'gender', 'flags', 'notFlags'], [], path, p);
  if (Object.keys(v).length === 0) p.add(path, '빈 조건이다 (항목을 쓰거나 조건 자체를 빼야 한다)');
  if (v.stats !== undefined) {
    if (!isObj(v.stats)) p.add(`${path}.stats`, '{ 스탯이름: { min, max } } 객체여야 한다');
    else {
      for (const [k, r] of Object.entries(v.stats)) {
        if (!(STAT_KEYS as readonly string[]).includes(k)) p.add(`${path}.stats.${k}`, `알 수 없는 스탯 (허용: ${STAT_KEYS.join(', ')})`);
        else checkRange(r, `${path}.stats.${k}`, STAT_MIN, STAT_MAX, p);
      }
      if (Object.keys(v.stats).length === 0) p.add(`${path}.stats`, '비어 있다');
    }
  }
  if (v.looks !== undefined) checkRange(v.looks, `${path}.looks`, 0, 100, p);
  if (v.parentWealth !== undefined) checkRange(v.parentWealth, `${path}.parentWealth`, PARENT_WEALTHS[0], PARENT_WEALTHS[PARENT_WEALTHS.length - 1], p);
  if (v.birthOrder !== undefined) checkRange(v.birthOrder, `${path}.birthOrder`, 1, BIRTH_ORDER_MAX, p);
  if (v.parentAge !== undefined) checkRange(v.parentAge, `${path}.parentAge`, 0, PARENT_AGE_MAX, p);
  if (v.motherAge !== undefined) checkRange(v.motherAge, `${path}.motherAge`, 0, PARENT_AGE_MAX, p);
  if (v.parenting !== undefined) checkEnumList(v.parenting, PARENTING_STYLES, `${path}.parenting`, p);
  if (v.gender !== undefined) checkEnumList(v.gender, GENDERS, `${path}.gender`, p);
  const flagsOk = v.flags === undefined ? true : checkFlagList(v.flags, `${path}.flags`, p);
  const notOk = v.notFlags === undefined ? true : checkFlagList(v.notFlags, `${path}.notFlags`, p);
  if (flagsOk && notOk && Array.isArray(v.flags) && Array.isArray(v.notFlags)) {
    for (const f of v.flags as string[]) if ((v.notFlags as string[]).includes(f)) p.add(path, `플래그 ${f}가 flags와 notFlags에 모두 있어 절대 참이 될 수 없다`);
  }
}

function checkEffects(v: unknown, path: string, p: Problems): void {
  if (!isObj(v)) return void p.add(path, '효과 객체여야 한다');
  checkKeys(v, ['stats', 'setFlags', 'clearFlags'], [], path, p);
  if (Object.keys(v).length === 0) p.add(path, '빈 효과다');
  if (v.stats !== undefined) {
    if (!isObj(v.stats) || Object.keys(v.stats).length === 0) p.add(`${path}.stats`, '{ 스탯이름: 변화량 } 객체여야 한다');
    else {
      for (const [k, d] of Object.entries(v.stats)) {
        if (!(STAT_KEYS as readonly string[]).includes(k)) p.add(`${path}.stats.${k}`, `알 수 없는 스탯 (허용: ${STAT_KEYS.join(', ')})`);
        else if (!isInt(d) || d === 0 || Math.abs(d) > MAX_EFFECT_DELTA) p.add(`${path}.stats.${k}`, `0이 아닌 정수 (절댓값 ${MAX_EFFECT_DELTA} 이하)여야 한다 (지금 ${JSON.stringify(d)})`);
      }
    }
  }
  const setOk = v.setFlags === undefined ? true : checkFlagList(v.setFlags, `${path}.setFlags`, p);
  const clrOk = v.clearFlags === undefined ? true : checkFlagList(v.clearFlags, `${path}.clearFlags`, p);
  if (setOk && clrOk && Array.isArray(v.setFlags) && Array.isArray(v.clearFlags)) {
    for (const f of v.setFlags as string[]) if ((v.clearFlags as string[]).includes(f)) p.add(path, `플래그 ${f}를 같은 효과에서 켜고 끈다`);
  }
}

/**
 * 기본 효과 + 모든 보너스(조건과 무관하게 전부 맞는다고 가정)가 한 스탯에 더할 수 있는 최악의 합이 ±MAX_TOTAL_DELTA 이내인지 본다(R-046).
 * 개별 효과의 형태가 이미 맞는 것만 센다(형태 오류는 checkEffects가 따로 보고한다).
 */
function checkTotalDelta(base: unknown, bonuses: unknown, path: string, p: Problems): void {
  const pos: Record<string, number> = {};
  const neg: Record<string, number> = {};
  const add = (eff: unknown) => {
    if (!isObj(eff) || !isObj(eff.stats)) return;
    for (const [k, d] of Object.entries(eff.stats)) {
      if (!(STAT_KEYS as readonly string[]).includes(k) || !isInt(d)) continue;
      if (d > 0) pos[k] = (pos[k] ?? 0) + d;
      else neg[k] = (neg[k] ?? 0) + d;
    }
  };
  add(base);
  if (Array.isArray(bonuses)) for (const b of bonuses) if (isObj(b)) add(b.effects);
  for (const k of Object.keys(pos)) if (pos[k] > MAX_TOTAL_DELTA) p.add(path, `스탯 ${k}의 변화량 최대 합계(+${pos[k]})가 상한 ${MAX_TOTAL_DELTA}을 넘는다 (기본 효과 + 모든 보너스)`);
  for (const k of Object.keys(neg)) if (neg[k] < -MAX_TOTAL_DELTA) p.add(path, `스탯 ${k}의 변화량 최소 합계(${neg[k]})가 하한 -${MAX_TOTAL_DELTA}을 넘는다 (기본 효과 + 모든 보너스)`);
}

function checkBonuses(v: unknown, path: string, p: Problems): void {
  if (!Array.isArray(v) || v.length === 0) return void p.add(path, '비어 있지 않은 배열이어야 한다');
  if (v.length > MAX_BONUSES) p.add(path, `보너스는 최대 ${MAX_BONUSES}개다 (지금 ${v.length}개)`);
  v.forEach((b, i) => {
    const bp = `${path}[${i}]`;
    if (!isObj(b)) return void p.add(bp, '{ when, effects } 객체여야 한다');
    checkKeys(b, ['when', 'effects'], ['when', 'effects'], bp, p);
    if (b.when !== undefined) checkCondition(b.when, `${bp}.when`, p);
    if (b.effects !== undefined) checkEffects(b.effects, `${bp}.effects`, p);
  });
}

function checkChoice(c: unknown, path: string, p: Problems): void {
  if (!isObj(c)) return void p.add(path, '선택지 객체여야 한다');
  checkKeys(c, ['id', 'label', 'result', 'effects', 'bonuses', 'requires'], ['id', 'label', 'result'], path, p);
  if (typeof c.id !== 'string' || !CHOICE_ID_PATTERN.test(c.id)) p.add(`${path}.id`, '소문자·숫자·하이픈(예: study-alone)이어야 한다');
  if (c.label !== undefined) checkText(c.label, `${path}.label`, 1, 40, p);
  if (c.result !== undefined) checkText(c.result, `${path}.result`, 6, 300, p);
  if (c.effects !== undefined) checkEffects(c.effects, `${path}.effects`, p);
  if (c.bonuses !== undefined) checkBonuses(c.bonuses, `${path}.bonuses`, p);
  checkTotalDelta(c.effects, c.bonuses, path, p);
  if (c.requires !== undefined) checkCondition(c.requires, `${path}.requires`, p);
}

const EVENT_KEYS = [
  'id', 'title', 'text', 'stages', 'ageRange', 'eras', 'weight', 'once', 'cooldown',
  'conditions', 'modifiers', 'effects', 'bonuses', 'choices',
] as const;

/** 단계가 덮는 나이 구간 [시작, 끝] (노년은 상한 없음) */
function stageSpan(stage: Stage): [number, number] {
  const i = STAGES.indexOf(stage);
  const next = STAGES[i + 1];
  return [STAGE_TABLE[stage].startAge, next ? STAGE_TABLE[next].startAge - 1 : MAX_AGE_ABS];
}

function checkEvent(ev: unknown, path: string, p: Problems): void {
  if (!isObj(ev)) return void p.add(path, '이벤트 객체여야 한다');
  checkKeys(ev, EVENT_KEYS, ['id', 'title', 'text', 'stages', 'weight', 'once'], path, p);
  if (typeof ev.id !== 'string' || !EVENT_ID_PATTERN.test(ev.id)) p.add(`${path}.id`, '소문자·숫자·하이픈 2~48자(예: school-exam)여야 한다');
  else if (RESERVED_EVENT_IDS.has(ev.id.toLowerCase())) p.add(`${path}.id`, `예약어라 id로 쓸 수 없다 (${ev.id}) — 본 이벤트 기록에서 상속 속성과 헷갈릴 수 있다`);
  if (ev.title !== undefined) checkText(ev.title, `${path}.title`, 1, 30, p);
  if (ev.text !== undefined) checkText(ev.text, `${path}.text`, 10, 400, p);
  if (ev.stages !== undefined) checkEnumList(ev.stages, STAGES, `${path}.stages`, p);
  if (ev.eras !== undefined) checkEnumList(ev.eras, ERAS, `${path}.eras`, p);
  if (ev.ageRange !== undefined) {
    checkRange(ev.ageRange, `${path}.ageRange`, 0, MAX_AGE_ABS, p);
    // 단계와 겹치는 나이가 없으면 영원히 일어나지 않는 이벤트다
    if (Array.isArray(ev.stages) && isObj(ev.ageRange)) {
      const lo = isInt(ev.ageRange.min) ? ev.ageRange.min : 0;
      const hi = isInt(ev.ageRange.max) ? ev.ageRange.max : MAX_AGE_ABS;
      const stages = (ev.stages as unknown[]).filter((s): s is Stage => (STAGES as readonly unknown[]).includes(s));
      if (stages.length > 0 && !stages.some((s) => stageSpan(s)[0] <= hi && stageSpan(s)[1] >= lo)) {
        p.add(`${path}.ageRange`, `나이 범위 ${lo}~${hi}가 stages(${stages.join(', ')})의 나이와 겹치지 않아 절대 일어나지 않는다`);
      }
    }
  }
  if (typeof ev.weight !== 'number' || !Number.isFinite(ev.weight) || ev.weight < MIN_EVENT_WEIGHT || ev.weight > MAX_EVENT_WEIGHT) {
    p.add(`${path}.weight`, `${MIN_EVENT_WEIGHT} 이상 ${MAX_EVENT_WEIGHT} 이하의 수여야 한다 (0에 가까운 값은 곱할수록 언더플로한다)`);
  }
  if (typeof ev.once !== 'boolean') p.add(`${path}.once`, 'true 또는 false여야 한다');
  if (ev.cooldown !== undefined) {
    if (!isInt(ev.cooldown) || ev.cooldown < 1 || ev.cooldown > 60) p.add(`${path}.cooldown`, '1~60의 정수여야 한다');
    if (ev.once === true) p.add(`${path}.cooldown`, 'once:true 이벤트에는 cooldown이 필요 없다');
  }
  if (ev.conditions !== undefined) checkCondition(ev.conditions, `${path}.conditions`, p);
  if (ev.modifiers !== undefined) {
    if (!Array.isArray(ev.modifiers) || ev.modifiers.length === 0) p.add(`${path}.modifiers`, '비어 있지 않은 배열이어야 한다');
    else {
      if (ev.modifiers.length > MAX_MODIFIERS) p.add(`${path}.modifiers`, `모디파이어는 최대 ${MAX_MODIFIERS}개다 (지금 ${ev.modifiers.length}개)`);
      ev.modifiers.forEach((m: unknown, i: number) => {
        const mp = `${path}.modifiers[${i}]`;
        if (!isObj(m)) return void p.add(mp, '{ when, weight } 객체여야 한다');
        checkKeys(m, ['when', 'weight'], ['when', 'weight'], mp, p);
        if (m.when !== undefined) checkCondition(m.when, `${mp}.when`, p);
        if (
          m.weight !== undefined &&
          (typeof m.weight !== 'number' || !Number.isFinite(m.weight) || m.weight < MIN_MODIFIER_WEIGHT || m.weight > MAX_MODIFIER_WEIGHT)
        ) {
          p.add(`${mp}.weight`, `${MIN_MODIFIER_WEIGHT} 이상 ${MAX_MODIFIER_WEIGHT} 이하의 배수여야 한다`);
        }
      });
      // 최악의 곱: 줄이는 배수가 전부 맞을 때 / 키우는 배수가 전부 맞을 때도 유한한 양의 가중치여야 한다
      const mults = ev.modifiers.map((m: unknown) => (isObj(m) && typeof m.weight === 'number' && Number.isFinite(m.weight) ? m.weight : 1));
      if (typeof ev.weight === 'number' && Number.isFinite(ev.weight)) {
        const low = mults.filter((w: number) => w < 1).reduce((a: number, w: number) => a * w, ev.weight);
        const high = mults.filter((w: number) => w > 1).reduce((a: number, w: number) => a * w, ev.weight);
        if (low < MIN_EFFECTIVE_WEIGHT) p.add(`${path}.modifiers`, `줄이는 배수가 모두 맞을 때 가중치가 ${low}로 ${MIN_EFFECTIVE_WEIGHT} 아래다`);
        if (high > MAX_EFFECTIVE_WEIGHT) p.add(`${path}.modifiers`, `키우는 배수가 모두 맞을 때 가중치가 ${high}로 ${MAX_EFFECTIVE_WEIGHT}을 넘는다`);
      }
    }
  }

  const hasChoices = ev.choices !== undefined;
  if (hasChoices) {
    if (!Array.isArray(ev.choices) || ev.choices.length < 2 || ev.choices.length > 3) {
      p.add(`${path}.choices`, `선택지는 2~3개여야 한다 (서술 이벤트는 choices를 아예 쓰지 않는다. 지금 ${Array.isArray(ev.choices) ? ev.choices.length : '배열 아님'}개)`);
    } else {
      const ids = new Set<string>();
      let unconditional = 0;
      ev.choices.forEach((c: unknown, i: number) => {
        checkChoice(c, `${path}.choices[${i}]`, p);
        if (isObj(c)) {
          if (typeof c.id === 'string') {
            if (ids.has(c.id)) p.add(`${path}.choices[${i}].id`, `선택지 id가 중복이다 (${c.id})`);
            ids.add(c.id);
          }
          if (c.requires === undefined) unconditional++;
        }
      });
      if (unconditional < 2) p.add(`${path}.choices`, `조건(requires) 없는 선택지가 2개 이상 있어야 한다 (항상 2개 이상 보여야 한다. 지금 ${unconditional}개)`);
    }
    if (ev.effects !== undefined || ev.bonuses !== undefined) {
      p.add(path, '선택지 이벤트는 이벤트 단위의 effects·bonuses를 쓰지 않는다 (효과는 선택지마다 적는다)');
    }
  } else {
    if (ev.effects !== undefined) checkEffects(ev.effects, `${path}.effects`, p);
    if (ev.bonuses !== undefined) checkBonuses(ev.bonuses, `${path}.bonuses`, p);
    checkTotalDelta(ev.effects, ev.bonuses, path, p);
  }
}

// ---------- 플래그 교차 검증 ----------

function flagsInCondition(c: Condition | undefined, out: Set<string>): void {
  for (const f of c?.flags ?? []) out.add(f);
  for (const f of c?.notFlags ?? []) out.add(f);
}

/** 이 이벤트가 조건에서 읽는 모든 플래그 */
export function flagsRead(ev: EventDef): Set<string> {
  const out = new Set<string>();
  flagsInCondition(ev.conditions, out);
  for (const m of ev.modifiers ?? []) flagsInCondition(m.when, out);
  for (const b of ev.bonuses ?? []) flagsInCondition(b.when, out);
  for (const c of ev.choices ?? []) {
    flagsInCondition(c.requires, out);
    for (const b of c.bonuses ?? []) flagsInCondition(b.when, out);
  }
  return out;
}

function effectsFlags(e: Effects | undefined, set: Set<string>, clear: Set<string>): void {
  for (const f of e?.setFlags ?? []) set.add(f);
  for (const f of e?.clearFlags ?? []) clear.add(f);
}

/** 이 이벤트가 켜거나 끄는 모든 플래그 */
export function flagsWritten(ev: EventDef): { set: Set<string>; clear: Set<string> } {
  const set = new Set<string>();
  const clear = new Set<string>();
  effectsFlags(ev.effects, set, clear);
  for (const b of ev.bonuses ?? []) effectsFlags(b.effects, set, clear);
  for (const c of ev.choices ?? []) {
    effectsFlags(c.effects, set, clear);
    for (const b of c.bonuses ?? []) effectsFlags(b.effects, set, clear);
  }
  return { set, clear };
}

/**
 * 여러 파일의 이벤트 데이터를 검증하고 EventDef 목록으로 돌려준다. 문제가 하나라도 있으면 모두 모아 EventDataError로 throw.
 * 파일 형식: { "events": [ ... ] } (그 밖의 최상위 항목은 "note"만 허용).
 * 파일 사이 검증: id 중복, 읽는 플래그가 어디선가는 켜지는지(오타 방지).
 */
export function validateEventFiles(files: Readonly<Record<string, unknown>>): EventDef[] {
  const problems: string[] = [];
  const all: EventDef[] = [];
  const seenIds = new Map<string, string>();
  for (const [file, raw] of Object.entries(files)) {
    const p = new Problems(file);
    if (!isObj(raw)) {
      p.add('', '최상위는 { "events": [...] } 객체여야 한다');
      problems.push(...p.list);
      continue;
    }
    checkKeys(raw, ['events', 'note'], ['events'], '', p);
    if (!Array.isArray(raw.events) || raw.events.length === 0) {
      p.add('events', '비어 있지 않은 배열이어야 한다');
      problems.push(...p.list);
      continue;
    }
    raw.events.forEach((ev: unknown, i: number) => {
      const label = isObj(ev) && typeof ev.id === 'string' ? `events[${i}](${ev.id})` : `events[${i}]`;
      const before = p.list.length;
      checkEvent(ev, label, p);
      if (isObj(ev) && typeof ev.id === 'string') {
        const prev = seenIds.get(ev.id);
        if (prev !== undefined) p.add(label, `id "${ev.id}"가 ${prev}에도 있다 (id는 모든 파일에서 하나뿐이어야 한다)`);
        seenIds.set(ev.id, file);
      }
      if (p.list.length === before) all.push(ev as unknown as EventDef);
    });
    problems.push(...p.list);
  }

  // 읽는 플래그는 어딘가에서 켜져야 한다 (켜지지 않는 플래그를 조건에 쓰면 그 이벤트/선택지는 영원히 안 열린다)
  const setAnywhere = new Set<string>();
  const clearAnywhere = new Set<string>();
  for (const ev of all) {
    const w = flagsWritten(ev);
    w.set.forEach((f) => setAnywhere.add(f));
    w.clear.forEach((f) => clearAnywhere.add(f));
  }
  for (const ev of all) {
    for (const f of flagsRead(ev)) {
      if (!setAnywhere.has(f)) problems.push(`이벤트 "${ev.id}": 조건에서 읽는 플래그 "${f}"를 켜는 이벤트가 어디에도 없다 (오타이거나 setFlags가 빠졌다)`);
    }
    for (const f of flagsWritten(ev).clear) {
      if (!setAnywhere.has(f)) problems.push(`이벤트 "${ev.id}": clearFlags의 플래그 "${f}"를 켜는 이벤트가 어디에도 없다`);
    }
  }
  if (problems.length > 0) throw new EventDataError(problems);
  return all;
}
