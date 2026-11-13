/**
 * 이벤트 파일 검증 (`validateEventFiles`와 이벤트 파일 전용 검사) — `core/events.ts`에서 옮겼다(SPEC-018 T3, 초기 로드 ≤ 400,000 B).
 * 이벤트 풀은 지연 로딩 덩어리(`data/events`)라 이 검증도 그 덩어리에만 들어간다. 조건·인용 형태 검사(기록 카드도 쓴다)와 공용 도우미는 `events.ts#EVENT_CHECK`에 있다.
 */
import { ASK_CHOICE_IDS, ASK_KIND_INFO, isAskKind } from '../data/askTable';
import { FAMILY_SYSTEM_FLAGS } from './familyFlags';
import { LOOKS_CHANNELS } from './looks';
import { ACT_KINDS, ROLE_KINDS } from './personaKinds';
import { HEAVY_KINDS, STAGES, STAT_KEYS, type Stage } from './types';
import {
  ASSET_DELTA_CAP, EVENT_CHECK, EVENT_ID_PATTERN, EVENT_TRACKS, EventDataError, FAMILY_DELTA_CAP, MAX_BONUSES, MAX_DEFINED_CHOICES, MAX_EFFECTIVE_WEIGHT, MAX_EVENT_WEIGHT,
  MAX_MODIFIERS, MAX_MODIFIER_WEIGHT, MAX_TEXT_VARIANTS, MAX_TOTAL_DELTA, MAX_VISIBLE_CHOICES, MIN_EFFECTIVE_WEIGHT, MIN_EVENT_WEIGHT, MIN_MODIFIER_WEIGHT, NOTE_ID_PREFIX,
  RESERVED_EVENT_IDS, flagsRead, flagsWritten, stageOfAge, type EventCheckObj, type EventDef,
} from './events';

type Obj = EventCheckObj;
type Problems = InstanceType<typeof EVENT_CHECK.Problems>;
const { isObj, isInt, checkKeys, checkText, checkRange, checkFlagList, checkEnumList, checkCondition, checkCitationShape, Problems, stageSpan, MAX_AGE_ABS, FIRST_BIRTH_YEAR_FOR_RANGE, LAST_BIRTH_YEAR_FOR_RANGE } = EVENT_CHECK;
const CHOICE_ID_PATTERN = /^[a-z][a-z0-9-]{0,31}$/;
const MAX_EFFECT_DELTA = 50;

function checkEffects(v: unknown, path: string, p: Problems): void {
  if (!isObj(v)) return void p.add(path, '효과 객체여야 한다');
  checkKeys(v, ['stats', 'assets', 'family', 'setFlags', 'clearFlags'], [], path, p);
  if (Object.keys(v).length === 0) p.add(path, '빈 효과다');
  if (v.assets !== undefined) {
    if (!isObj(v.assets) || Object.keys(v.assets).length === 0) p.add(`${path}.assets`, '{ net, income, debt } 객체여야 한다 (만 원, 하나 이상)');
    else {
      checkKeys(v.assets, ['net', 'income', 'debt'], [], `${path}.assets`, p);
      for (const [k, d] of Object.entries(v.assets)) {
        const cap = ASSET_DELTA_CAP[k as keyof typeof ASSET_DELTA_CAP];
        if (cap !== undefined && (!isInt(d) || d === 0 || Math.abs(d) > cap)) p.add(`${path}.assets.${k}`, `0이 아닌 정수 (절댓값 ${cap} 이하, 만 원)여야 한다 (지금 ${JSON.stringify(d)})`);
      }
    }
  }
  if (v.family !== undefined && (!isInt(v.family) || v.family === 0 || Math.abs(v.family) > FAMILY_DELTA_CAP)) {
    p.add(`${path}.family`, `0이 아닌 정수 (절댓값 ${FAMILY_DELTA_CAP} 이하, 만 원)여야 한다 (지금 ${JSON.stringify(v.family)})`);
  }
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
  checkTotalMoney(base, bonuses, path, p);
}

/** 자산·집안 살림의 최악의 합(기본 + 모든 보너스)이 ASSET_DELTA_CAP·FAMILY_DELTA_CAP 이내인지 본다 */
function checkTotalMoney(base: unknown, bonuses: unknown, path: string, p: Problems): void {
  const sums: Record<string, { pos: number; neg: number; cap: number }> = {
    net: { pos: 0, neg: 0, cap: ASSET_DELTA_CAP.net },
    income: { pos: 0, neg: 0, cap: ASSET_DELTA_CAP.income },
    debt: { pos: 0, neg: 0, cap: ASSET_DELTA_CAP.debt },
    family: { pos: 0, neg: 0, cap: FAMILY_DELTA_CAP },
  };
  const add = (eff: unknown): void => {
    if (!isObj(eff)) return;
    const put = (k: string, d: unknown): void => {
      if (!isInt(d)) return;
      if (d > 0) sums[k].pos += d;
      else sums[k].neg += d;
    };
    if (isObj(eff.assets)) for (const k of ['net', 'income', 'debt']) put(k, eff.assets[k]);
    put('family', eff.family);
  };
  add(base);
  if (Array.isArray(bonuses)) for (const b of bonuses) if (isObj(b)) add(b.effects);
  for (const [k, s] of Object.entries(sums)) {
    if (s.pos > s.cap) p.add(path, `${k}의 변화량 최대 합계(+${s.pos})가 상한 ${s.cap}을 넘는다 (기본 효과 + 모든 보너스, 만 원)`);
    if (s.neg < -s.cap) p.add(path, `${k}의 변화량 최소 합계(${s.neg})가 하한 -${s.cap}을 넘는다 (기본 효과 + 모든 보너스, 만 원)`);
  }
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
  checkKeys(c, ['id', 'label', 'result', 'resultVariants', 'act', 'role', 'parentLabel', 'parentResult', 'askDenied', 'askStrained', 'effects', 'bonuses', 'requires'], ['id', 'label', 'result'], path, p);
  if (typeof c.id !== 'string' || !CHOICE_ID_PATTERN.test(c.id)) p.add(`${path}.id`, '소문자·숫자·하이픈(예: study-alone)이어야 한다');
  if (c.label !== undefined) checkText(c.label, `${path}.label`, 1, 40, p);
  if (c.result !== undefined) checkText(c.result, `${path}.result`, 6, 300, p);
  if (c.parentLabel !== undefined) checkText(c.parentLabel, `${path}.parentLabel`, 1, 40, p);
  if (c.parentResult !== undefined) checkText(c.parentResult, `${path}.parentResult`, 6, 300, p);
  if (c.askDenied !== undefined) checkText(c.askDenied, `${path}.askDenied`, 6, 300, p);
  if (c.askStrained !== undefined) checkText(c.askStrained, `${path}.askStrained`, 6, 300, p);
  if (c.effects !== undefined) checkEffects(c.effects, `${path}.effects`, p);
  if (c.bonuses !== undefined) checkBonuses(c.bonuses, `${path}.bonuses`, p);
  checkTotalDelta(c.effects, c.bonuses, path, p);
  if (c.requires !== undefined) checkCondition(c.requires, `${path}.requires`, p);
  if (c.resultVariants !== undefined) checkVariants(c.resultVariants, `${path}.resultVariants`, 6, 300, p);
  if (c.act !== undefined && !(ACT_KINDS as readonly unknown[]).includes(c.act)) p.add(`${path}.act`, `활동 표지(${ACT_KINDS.join(', ')}) 중 하나여야 한다`);
  if (c.role !== undefined && !(ROLE_KINDS as readonly unknown[]).includes(c.role)) p.add(`${path}.role`, `본보기 표지(${ROLE_KINDS.join(', ')}) 중 하나여야 한다`);
}

/** 문장 변주 목록의 형태: 1~`MAX_TEXT_VARIANTS`개, 각각 `{ when, text }` — `when`은 조건 문법 그대로, 글 길이는 본문·결과와 같은 범위 */
function checkVariants(v: unknown, path: string, min: number, max: number, p: Problems): void {
  if (!Array.isArray(v) || v.length === 0) return void p.add(path, '비어 있지 않은 배열이어야 한다');
  if (v.length > MAX_TEXT_VARIANTS) p.add(path, `문장 변주는 최대 ${MAX_TEXT_VARIANTS}개다 (지금 ${v.length}개)`);
  v.forEach((x: unknown, i: number) => {
    const vp = `${path}[${i}]`;
    if (!isObj(x)) return void p.add(vp, '{ when, text } 객체여야 한다');
    checkKeys(x, ['when', 'text'], ['when', 'text'], vp, p);
    if (x.when !== undefined) checkCondition(x.when, `${vp}.when`, p);
    if (x.text !== undefined) checkText(x.text, `${vp}.text`, min, max, p);
  });
}

const EVENT_KEYS = [
  'id', 'title', 'text', 'textVariants', 'role', 'question', 'stages', 'ageRange', 'yearRange', 'track', 'weight', 'once', 'cooldown',
  'conditions', 'modifiers', 'effects', 'bonuses', 'choices', 'milestone', 'trigger', 'citation', 'noCitation', 'heavy', 'ask', 'pick', 'retiredWith', 'looksChannel',
] as const;

/** 질문 문장의 길이 상한 (SPEC-014 규칙 2 — 윗줄 12px·360px에서 한 줄 약 19자, 두 줄 안) */
export const QUESTION_MAX_CHARS = 30;

/** `question`의 형태: 선택지 이벤트(정의 `choices` 또는 동적 후보 `pick` — SPEC-018 PL5)에만, 한 문장, 「…ㄹ까?」로 끝나고 물음표는 맨 끝 하나 (SPEC-014 규칙 1·2). 모든 선택지 이벤트에 있는지·서로 다른지는 `eventLint.ts#questionProblems`가 본다. */
function checkQuestion(ev: Obj, path: string, p: Problems): void {
  if (ev.question === undefined) return;
  const at = `${path}.question`;
  checkText(ev.question, at, 4, QUESTION_MAX_CHARS, p);
  if (typeof ev.question !== 'string') return;
  if (ev.choices === undefined && ev.pick === undefined) p.add(at, '질문 문장은 선택지 이벤트에만 쓴다 (서술 이벤트는 결정 줄이 없다 — 동적 후보 카드 `pick`은 선택 카드다)');
  if (!/까\?$/.test(ev.question) || ev.question.indexOf('?') !== ev.question.length - 1) p.add(at, '「…할까?」 꼴이어야 한다 — 「까?」로 끝나고 물음표는 맨 끝에 하나뿐이다');
}

/** 단계가 덮는 나이 구간 [시작, 끝] (노년은 상한 없음) */

/**
 * 자산 효과·조건은 20세 이상으로만 일어나는 이벤트에서만, 집안 살림 효과는 20세 미만(영유아·학창)으로만 일어나는 이벤트에서만 쓴다 —
 * 20세 미만에는 자산이 없고(집안 살림만 쌓는다), 20세 이상에는 집안 살림이 없다(SPEC-003 EC1).
 */
function checkMoneyKinds(ev: Obj, path: string, p: Problems): void {
  if (!Array.isArray(ev.stages)) return;
  const stages = ev.stages.filter((s): s is Stage => (STAGES as readonly unknown[]).includes(s));
  if (stages.length === 0) return;
  const youngStages: readonly Stage[] = ['infant', 'school'];
  const young = stages.every((s) => youngStages.includes(s));
  const adult = stages.every((s) => !youngStages.includes(s));
  const effects: unknown[] = [ev.effects, ...((Array.isArray(ev.bonuses) ? ev.bonuses : []) as unknown[]).map((b) => (isObj(b) ? b.effects : undefined))];
  const conds: unknown[] = [ev.conditions, ...((Array.isArray(ev.modifiers) ? ev.modifiers : []) as unknown[]).map((m) => (isObj(m) ? m.when : undefined))];
  for (const b of (Array.isArray(ev.bonuses) ? ev.bonuses : []) as unknown[]) if (isObj(b)) conds.push(b.when);
  for (const c of (Array.isArray(ev.choices) ? ev.choices : []) as unknown[]) {
    if (!isObj(c)) continue;
    effects.push(c.effects);
    conds.push(c.requires);
    for (const b of (Array.isArray(c.bonuses) ? c.bonuses : []) as unknown[]) {
      if (!isObj(b)) continue;
      effects.push(b.effects);
      conds.push(b.when);
    }
  }
  const usesAssets = effects.some((e) => isObj(e) && e.assets !== undefined);
  const usesFamily = effects.some((e) => isObj(e) && e.family !== undefined);
  const usesAssetCond = conds.some((c) => isObj(c) && c.assets !== undefined);
  if (usesFamily && !young) p.add(path, 'effects.family(집안 살림)는 20세 미만(영유아·학창)으로만 일어나는 이벤트에서만 쓸 수 있다');
  if ((usesAssets || usesAssetCond) && !adult) p.add(path, 'assets(자산) 효과·조건은 20세 이상(청년·중년·노년)으로만 일어나는 이벤트에서만 쓸 수 있다');
}

/** `heavy`(무거운 장면 표지, SPEC-005 HV2)의 형태: `{ kind }` 하나뿐이고 kind는 분류 여섯 중 하나. 마일스톤(모든 판에 일어나는 첫 걸음·첫 말 같은 일)에는 쓰지 않는다. */
function checkHeavy(ev: Obj, path: string, p: Problems): void {
  if (ev.heavy === undefined) return;
  if (!isObj(ev.heavy)) return void p.add(`${path}.heavy`, '{ "kind": "..." } 객체여야 한다');
  checkKeys(ev.heavy, ['kind'], ['kind'], `${path}.heavy`, p);
  if (ev.heavy.kind !== undefined && !(HEAVY_KINDS as readonly unknown[]).includes(ev.heavy.kind)) p.add(`${path}.heavy.kind`, `분류(${HEAVY_KINDS.join(', ')}) 중 하나여야 한다`);
  if (ev.milestone === true) p.add(`${path}.heavy`, '마일스톤(모든 판에 일어나는 일)에는 무거운 장면 표지를 쓰지 않는다');
}

/**
 * 인용 연결 필드의 형태 (M7b): `citation`은 인용 id 문자열 또는 `{ past?, present?, future? }`(비어 있지 않은 객체, 값은 id), `noCitation`은 사유 코드.
 * 둘은 함께 쓰지 않고, 선택지 이벤트(중대 결정 카드)에서만 쓴다. 인용 id가 `citations.json`에 실제로 있는지는 데이터 파일을 아는 `core/citations.ts#citationLinkProblems`가 점검한다
 * (이 함수는 데이터 파일 없이 형태만 본다 — 가짜 풀을 만드는 시험이 인용 파일에 묶이지 않게).
 */
function checkCitationFields(ev: Obj, path: string, p: Problems): void {
  if (ev.citation === undefined && ev.noCitation === undefined) return;
  if (ev.choices === undefined) p.add(path, 'citation·noCitation은 선택지 이벤트(중대 결정 카드)에서만 쓴다');
  checkCitationShape(ev, path, p);
}


/**
 * `yearRange`의 형태 (SPEC-004 MG2): `{ from?, to? }` 정수(1900~2300), `from ≤ to`. 이 이벤트가 일어날 수 있는 달력 연도(출생 1940~2020 + 단계·나이 범위)와 겹쳐야 한다 —
 * 겹치지 않으면 영원히 일어나지 않는 이벤트다(예: 알파가 2026년 이후 영유아가 없어 후보가 없던 이벤트 — `event-conversion.md` 5절).
 */
function checkYearRange(ev: Obj, path: string, p: Problems): void {
  const r = ev.yearRange;
  const at = `${path}.yearRange`;
  if (!isObj(r)) return void p.add(at, '{ "from": 연도, "to": 연도 } 객체여야 한다 (한쪽은 생략할 수 있다)');
  const before = p.list.length;
  checkKeys(r, ['from', 'to'], [], at, p);
  for (const k of ['from', 'to'] as const) {
    const v = r[k];
    if (v !== undefined && (!isInt(v) || v < 1900 || v > 2300)) p.add(`${at}.${k}`, '1900~2300의 정수(달력 연도)여야 한다');
  }
  if (isInt(r.from) && isInt(r.to) && r.from > r.to) p.add(at, `from(${r.from})이 to(${r.to})보다 크다`);
  if (p.list.length !== before || !Array.isArray(ev.stages)) return;
  const stages = ev.stages.filter((s): s is Stage => (STAGES as readonly unknown[]).includes(s));
  if (stages.length === 0) return;
  const lo = isObj(ev.ageRange) && isInt(ev.ageRange.min) ? ev.ageRange.min : 0;
  const hi = isObj(ev.ageRange) && isInt(ev.ageRange.max) ? ev.ageRange.max : MAX_AGE_ABS;
  const ageLo = Math.max(lo, Math.min(...stages.map((s) => stageSpan(s)[0])));
  const ageHi = Math.min(hi, Math.max(...stages.map((s) => stageSpan(s)[1])));
  const first = FIRST_BIRTH_YEAR_FOR_RANGE + ageLo;
  const last = LAST_BIRTH_YEAR_FOR_RANGE + ageHi;
  if ((isInt(r.from) && r.from > last) || (isInt(r.to) && r.to < first)) p.add(at, `이 이벤트가 일어날 수 있는 달력 연도(${first}~${last})와 겹치지 않아 절대 일어나지 않는다`);
}


/**
 * 어린 시절 조르기 사건의 모양 (SPEC-011 AK2, `docs/data/ask-model.md` 1-2·1-6절 L1~L3): `ask: { kind }` 하나(종류는 `toy`·`lessons`·`pet`)이고, 선택지가 정확히 `beg`·`tantrum`·`endure`(이 순서, `requires` 없음)이며,
 * `beg`·`tantrum`은 효과 필드(`effects`·`bonuses`·`parentLabel`·`parentResult`)가 없고(갈래별 효과는 코드 표 `ASK_EFFECTS` 한 곳 — 결정 AQ1) 거절 문장 `askDenied`가 있고 `tantrum`만 `askStrained`가 있다. `endure`는 일반 선택지라 효과가 있다.
 * `once: true` · `track: 'common'` · `stages: ['infant','school']` · 나이 범위가 종류 한계 안(`toy` 4~12 · `lessons`·`pet` 5~12) · `heavy` 없음 · `trigger`·`milestone` 없음. `ask` 없이 `askDenied`·`askStrained`를 쓰면 오류다.
 * 문장·가중·`endure` 효과 일치·같은 종류 안 `yearRange` 겹침 같은 점검은 eventLint가 한다(여기는 데이터 모양만 본다).
 */
function checkAsk(ev: Obj, path: string, p: Problems): void {
  const choices = Array.isArray(ev.choices) ? (ev.choices as unknown[]) : [];
  if (ev.ask === undefined) {
    choices.forEach((c, i) => {
      if (!isObj(c)) return;
      for (const k of ['askDenied', 'askStrained']) if (c[k] !== undefined) p.add(`${path}.choices[${i}].${k}`, 'ask 사건(ask 필드가 있는 사건)의 선택지에서만 쓴다');
    });
    return;
  }
  const at = `${path}.ask`;
  if (!isObj(ev.ask)) return void p.add(at, '{ "kind": "toy" | "lessons" | "pet" } 객체여야 한다');
  checkKeys(ev.ask, ['kind'], ['kind'], at, p);
  if (ev.ask.kind === undefined) return;
  if (!isAskKind(ev.ask.kind)) return void p.add(`${at}.kind`, `종류(${Object.keys(ASK_KIND_INFO).join(', ')}) 중 하나여야 한다 (지금 ${JSON.stringify(ev.ask.kind)})`);
  const info = ASK_KIND_INFO[ev.ask.kind];
  if (ev.once !== true) p.add(at, 'ask 사건은 once:true여야 한다 (한 종류 최대 1장)');
  if (ev.track !== 'common') p.add(at, 'ask 사건은 track이 "common"이어야 한다');
  if (ev.heavy !== undefined) p.add(at, 'ask 사건에는 heavy(무거운 장면 표지)를 쓰지 않는다');
  if (ev.milestone !== undefined || ev.trigger !== undefined) p.add(at, 'ask 사건에는 milestone·trigger를 쓰지 않는다');
  const stages = Array.isArray(ev.stages) ? (ev.stages as unknown[]) : [];
  if (stages.length !== 2 || !stages.includes('infant') || !stages.includes('school')) p.add(`${path}.stages`, 'ask 사건의 stages는 ["infant", "school"]여야 한다 (4~12세에 걸친다)');
  const r = ev.ageRange;
  if (!isObj(r) || !isInt(r.min) || !isInt(r.max)) p.add(`${path}.ageRange`, `ask 사건은 ageRange의 min과 max가 모두 있어야 한다 (${ev.ask.kind}은 ${info.ageMin}~${info.ageMax}세 안)`);
  else if (r.min < info.ageMin || r.max > info.ageMax) p.add(`${path}.ageRange`, `${ev.ask.kind} 사건의 나이 범위는 ${info.ageMin}~${info.ageMax}세 안이어야 한다 (지금 ${r.min}~${r.max})`);
  if (choices.length !== ASK_CHOICE_IDS.length || !ASK_CHOICE_IDS.every((id, i) => isObj(choices[i]) && (choices[i] as Obj).id === id)) {
    return void p.add(`${path}.choices`, `ask 사건의 선택지는 정확히 ${ASK_CHOICE_IDS.join(', ')} 셋이고 이 순서다 (지금 ${choices.map((c) => (isObj(c) ? String(c.id) : '?')).join(', ')})`);
  }
  choices.forEach((raw, i) => {
    const c = raw as Obj;
    const cp = `${path}.choices[${i}](${String(c.id)})`;
    if (c.requires !== undefined) p.add(cp, 'ask 사건의 세 선택지는 어느 판에서도 항상 보인다 (requires를 쓰지 않는다)');
    if (c.id === 'endure') {
      for (const k of ['askDenied', 'askStrained']) if (c[k] !== undefined) p.add(`${cp}.${k}`, '참는다(endure)는 확정 결과라 거절 문장이 없다');
      if (c.effects === undefined) p.add(cp, '참는다(endure)는 일반 선택지라 effects가 있어야 한다 (코드 표 ASK_EFFECTS의 endure 행과 같게)');
      return;
    }
    for (const k of ['effects', 'bonuses', 'parentLabel', 'parentResult']) {
      if (c[k] !== undefined) p.add(`${cp}.${k}`, `조른다·떼쓴다의 갈래별 효과·문구는 데이터에 쓰지 않는다 (효과는 코드 표 ASK_EFFECTS 한 곳이 정한다 — ${k})`);
    }
    if (c.askDenied === undefined) p.add(cp, '거절 문장 askDenied가 필요하다');
    if (c.id === 'tantrum' && c.askStrained === undefined) p.add(cp, '사이 나빠짐 문장 askStrained가 필요하다 (떼쓰기만)');
    if (c.id === 'beg' && c.askStrained !== undefined) p.add(`${cp}.askStrained`, '조른다(beg)는 사이가 나빠지지 않아 askStrained가 없다 (떼쓰기만)');
  });
}

function checkEvent(ev: unknown, path: string, p: Problems): void {
  if (!isObj(ev)) return void p.add(path, '이벤트 객체여야 한다');
  checkKeys(ev, EVENT_KEYS, ['id', 'title', 'text', 'stages', 'weight', 'once', 'track'], path, p);
  if (typeof ev.id !== 'string' || !EVENT_ID_PATTERN.test(ev.id)) p.add(`${path}.id`, '소문자·숫자·하이픈 2~48자(예: school-exam)여야 한다');
  else if (RESERVED_EVENT_IDS.has(ev.id.toLowerCase())) p.add(`${path}.id`, `예약어라 id로 쓸 수 없다 (${ev.id}) — 본 이벤트 기록에서 상속 속성과 헷갈릴 수 있다`);
  else if (ev.id.startsWith(NOTE_ID_PREFIX)) p.add(`${path}.id`, `「${NOTE_ID_PREFIX}」로 시작하는 id는 기록 카드(notes.json) 전용 예약이라 이벤트 id로 쓸 수 없다 (본 이벤트 기록 seen에서 둘의 키가 섞이지 않게)`);
  if (ev.title !== undefined) checkText(ev.title, `${path}.title`, 1, 30, p);
  if (ev.text !== undefined) checkText(ev.text, `${path}.text`, 10, 400, p);
  if (ev.textVariants !== undefined) checkVariants(ev.textVariants, `${path}.textVariants`, 10, 400, p);
  if (ev.role !== undefined) {
    if (!(ROLE_KINDS as readonly unknown[]).includes(ev.role)) p.add(`${path}.role`, `본보기 표지(${ROLE_KINDS.join(', ')}) 중 하나여야 한다`);
    if (ev.choices !== undefined) p.add(`${path}.role`, '사건 단위 role은 서술 이벤트(선택지 없음)만 쓴다 — 선택지 이벤트는 선택지마다 role을 둔다');
  }
  checkQuestion(ev, path, p);
  if (ev.stages !== undefined) checkEnumList(ev.stages, STAGES, `${path}.stages`, p);
  checkMoneyKinds(ev, path, p);
  if (ev.track !== undefined && !(EVENT_TRACKS as readonly unknown[]).includes(ev.track)) p.add(`${path}.track`, `${EVENT_TRACKS.join(' · ')} 중 하나여야 한다`);
  if (ev.yearRange !== undefined) checkYearRange(ev, path, p);
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

  if (ev.milestone !== undefined) {
    if (typeof ev.milestone !== 'boolean') p.add(`${path}.milestone`, 'true 또는 false여야 한다');
    else if (ev.milestone) {
      // 마일스톤은 「창 안의 모든 판에 한 번」이라 서술 전용·once 전용이고, 마지막 해(100%)를 알려면 창의 양 끝이 있어야 한다
      if (ev.choices !== undefined) p.add(`${path}.milestone`, '마일스톤은 서술 이벤트만 된다 (선택지가 있으면 안 된다)');
      if (ev.once !== true) p.add(`${path}.milestone`, 'once:true여야 한다');
      const r = ev.ageRange;
      if (!isObj(r) || !isInt(r.min) || !isInt(r.max)) p.add(`${path}.milestone`, 'ageRange의 min과 max가 모두 있어야 한다 (창의 마지막 해에 100%로 일어난다)');
      else if (Array.isArray(ev.stages)) {
        // R-371 ①: 창의 모든 나이가 stages에 덮여야 한다 — 단계가 7세를 덮지 않으면 일반 후보에서 빠져 창의 마지막 해 100%가 조용히 깨진다
        for (let age = r.min; age <= r.max && age <= 130; age++) {
          const st = stageOfAge(age);
          if (!ev.stages.includes(st)) p.add(`${path}.milestone`, `창의 ${age}세는 ${st} 단계인데 stages에 없다 — 마일스톤은 창의 모든 나이에 일어날 수 있어야 한다`);
        }
      }
    }
  }

  if (ev.trigger !== undefined) {
    if (ev.trigger !== 'family') p.add(`${path}.trigger`, `"family"만 쓸 수 있다 (지금 ${JSON.stringify(ev.trigger)})`);
    else {
      // 가족 구성이 정한 해에 한 번 일으키는 선택지 사건: 일반 후보가 아니라서 once·나이 창(구성의 나이 차와 같다)이 있어야 하고 마일스톤과 함께 쓰지 않는다
      if (ev.once !== true) p.add(`${path}.trigger`, 'trigger: "family" 사건은 once:true여야 한다');
      if (ev.choices === undefined) p.add(`${path}.trigger`, 'trigger: "family" 사건은 선택지 이벤트여야 한다 (서술 줄은 familyChangesFor가 상태 줄로 낸다)');
      if (ev.ageRange === undefined) p.add(`${path}.trigger`, 'trigger: "family" 사건은 ageRange가 있어야 한다 (구성이 일으킬 수 있는 나이)');
      if (ev.milestone === true) p.add(`${path}.trigger`, 'trigger: "family"와 milestone은 함께 쓸 수 없다');
    }
  }

  checkCitationFields(ev, path, p);
  checkHeavy(ev, path, p);
  checkAsk(ev, path, p);
  checkPick(ev, path, p);

  const hasChoices = ev.choices !== undefined;
  if (hasChoices) {
    if (!Array.isArray(ev.choices) || ev.choices.length < 2 || ev.choices.length > MAX_DEFINED_CHOICES) {
      p.add(`${path}.choices`, `선택지는 2~${MAX_DEFINED_CHOICES}개여야 한다 (서술 이벤트는 choices를 아예 쓰지 않는다. 지금 ${Array.isArray(ev.choices) ? ev.choices.length : '배열 아님'}개). 정의가 ${MAX_VISIBLE_CHOICES}개를 넘으면 어떤 상태에서도 보이는 선택지가 ${MAX_VISIBLE_CHOICES}개 이하여야 한다(eventLint가 점검)`);
    } else {
      const ids = new Set<string>();
      let unconditional = 0;
      let familyGated = 0; // requires가 시스템 가족 플래그만 읽는 선택지(조부모가 계신 판에서만 보인다 등) — 보이는 수는 런타임이 지킨다(isEventEligible: 보이는 선택지 ≥ 2)
      ev.choices.forEach((c: unknown, i: number) => {
        checkChoice(c, `${path}.choices[${i}]`, p);
        if (isObj(c)) {
          if (typeof c.id === 'string') {
            if (ids.has(c.id)) p.add(`${path}.choices[${i}].id`, `선택지 id가 중복이다 (${c.id})`);
            ids.add(c.id);
          }
          if (c.requires === undefined) unconditional++;
          else if (isObj(c.requires) && Object.keys(c.requires).every((k) => k === 'flags') && Array.isArray(c.requires.flags) && c.requires.flags.every((x: unknown) => typeof x === 'string' && FAMILY_SYSTEM_FLAGS.includes(x))) familyGated++;
        }
      });
      // 조건 없는 선택지가 2개 이상이거나(항상 2개 이상 보인다), 1개 + 가족 플래그로만 갈리는 선택지로 2개 이상이다(그 가족이 없는 판에서는 이벤트가 후보에서 빠진다, K4)
      // 맞춤 조건(temper·apt·job·tailored)을 쓰는 사건은 이 규칙 대신 격자 하한(수저 × 적성 단계 × 기질 × 연도 경계 × 중립에서 보이는 선택지 2~3개)을 eventLint가 본다 — 설계 3절 `[CX-002-003]`. trigger 사건은 지금 규칙 그대로다
      if (unconditional < 2 && !(unconditional >= 1 && unconditional + familyGated >= 2) && !(ev.trigger === undefined && rawUsesPersona(ev))) p.add(`${path}.choices`, `조건(requires) 없는 선택지가 2개 이상 있어야 한다 (항상 2개 이상 보여야 한다. 지금 ${unconditional}개)`);
      // 강제 슬롯은 isEventEligible을 거치지 않는다 — 보이는 선택지가 1개면 대기 저장이 깨진다(pendingShapeOk)
      else if (ev.trigger !== undefined && unconditional < 2) p.add(`${path}.choices`, `trigger 사건은 조건 없는 선택지가 2개 이상이어야 한다 (지금 ${unconditional}개)`);
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

/** `pick`(동적 후보 카드)·`retiredWith`(대체된 옛 사건)의 형태 (SPEC-018 PL4): `pick`은 선택지·효과·보너스·`trigger`·`milestone`·`once`·`ask`와 함께 쓰지 않고, `retiredWith`는 `"persona"`뿐이다(선택지·서술 사건 모두 — 결정 후속 239) */
function checkPick(ev: Obj, path: string, p: Problems): void {
  if (ev.retiredWith !== undefined) {
    if (ev.retiredWith !== 'persona') p.add(`${path}.retiredWith`, '"persona"만 쓸 수 있다');
    // 서술 사건도 쓸 수 있다(결정 후속 239 — `youth-military`는 맞춤 판에서 강제 서술 슬롯이 대신한다). 동적 후보 카드(`pick`)에는 쓰지 않는다(아래)
  }
  if (ev.looksChannel !== undefined && !(LOOKS_CHANNELS as readonly unknown[]).includes(ev.looksChannel)) p.add(`${path}.looksChannel`, `${LOOKS_CHANNELS.map((c) => `"${c}"`).join(' 또는 ')}여야 한다`);
  if (ev.pick === undefined) return;
  const at = `${path}.pick`;
  if (!isObj(ev.pick)) return void p.add(at, '{ "kind": "field" | "detail" } 객체여야 한다');
  checkKeys(ev.pick, ['kind'], ['kind'], at, p);
  if (ev.pick.kind !== 'field' && ev.pick.kind !== 'detail') p.add(`${at}.kind`, '"field" 또는 "detail"이어야 한다');
  if (ev.choices !== undefined) p.add(at, 'pick 사건은 정의 choices가 없다 (후보는 카드가 열릴 때 정해진다)');
  if (ev.effects !== undefined || ev.bonuses !== undefined) p.add(at, 'pick 사건은 효과·보너스가 없다 (결과는 지원 판정이 정한다)');
  // `question`은 쓸 수 있다(SPEC-018 PL5 — 인생 기록·엔딩 연표의 윗줄, `resolveChoiceCore`가 줄에 적는다)
  for (const k of ['trigger', 'milestone', 'ask', 'heavy', 'citation', 'noCitation', 'retiredWith', 'looksChannel'] as const) if (ev[k] !== undefined) p.add(at, `pick 사건에는 ${k}를 쓰지 않는다`);
  if (ev.once === true) p.add(`${path}.once`, 'pick 사건은 once가 아니다 — 진로 트랙 상태가 카드를 정한다');
}

/** 날것 데이터에서 맞춤 조건(`temper`·`apt`·`job`·`tailored`)을 쓰는지 본다 — 형태 검증 단계라 타입 변환 전의 값을 읽는다 */
function rawUsesPersona(ev: Obj): boolean {
  const conds: unknown[] = [ev.conditions];
  const addAll = (list: unknown, key: string): void => {
    for (const x of Array.isArray(list) ? (list as unknown[]) : []) if (isObj(x)) conds.push(x[key]);
  };
  addAll(ev.modifiers, 'when');
  addAll(ev.bonuses, 'when');
  addAll(ev.textVariants, 'when');
  for (const c of Array.isArray(ev.choices) ? (ev.choices as unknown[]) : []) {
    if (!isObj(c)) continue;
    conds.push(c.requires);
    addAll(c.bonuses, 'when');
    addAll(c.resultVariants, 'when');
  }
  return conds.some((c) => isObj(c) && (c.temper !== undefined || c.apt !== undefined || c.job !== undefined || c.tailored !== undefined));
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
  // 시스템 소유 가족 플래그(SPEC-009 6절)는 `familyChangesFor`·`enterLife`가 켜고 끈다: 이벤트는 읽을 수만 있고(어디선가 켜진다고 본다) 쓸 수 없다
  const systemOwned: ReadonlySet<string> = new Set(FAMILY_SYSTEM_FLAGS);
  for (const ev of all) {
    const w = flagsWritten(ev);
    for (const f of [...w.set, ...w.clear]) {
      if (systemOwned.has(f)) problems.push(`이벤트 "${ev.id}": 시스템이 소유한 가족 플래그 "${f}"를 이벤트가 켜거나 끌 수 없다 (familyChangesFor만 쓴다 — 읽는 것은 된다)`);
    }
  }
  for (const ev of all) {
    for (const f of flagsRead(ev)) {
      if (!setAnywhere.has(f) && !systemOwned.has(f)) problems.push(`이벤트 "${ev.id}": 조건에서 읽는 플래그 "${f}"를 켜는 이벤트가 어디에도 없다 (오타이거나 setFlags가 빠졌다)`);
    }
    for (const f of flagsWritten(ev).clear) {
      if (!setAnywhere.has(f)) problems.push(`이벤트 "${ev.id}": clearFlags의 플래그 "${f}"를 켜는 이벤트가 어디에도 없다`);
    }
  }
  if (problems.length > 0) throw new EventDataError(problems);
  return all;
}
