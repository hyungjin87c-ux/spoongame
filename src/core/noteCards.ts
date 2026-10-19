import { bannedWordsFor, TEXT_LIMITS } from './eventLint';
import {
  EVENT_ID_PATTERN,
  NOTE_ID_PREFIX,
  citationShapeProblems,
  conditionProblems,
  flagsWritten,
  type Condition,
  type EventDef,
  type NoCitationCode,
} from './events';
import { ERAS, type Era } from './types';

/**
 * 기록 카드(「생각 남기기」 자동 카드) 데이터 모델과 검증·문구 점검 (SPEC-003 M7c FR1·FR2, docs/data/content-M7c.md 1·2절). React·DOM과 무관한 순수 모듈.
 * 카드 정의는 `src/data/notes.json`(`src/data/noteCards.ts`가 읽는다)이고, 차례 판정은 `core/notes.ts#dueNote`다.
 * 이벤트와 같은 조건 문법(`Condition`)·인용 연결 모양(`citation`·`noCitation`)을 쓴다 — 인용 박스는 중대 결정 카드와 같은 `citationFor`가 그린다.
 */

/** 카드 id 형식: `note-`로 시작(이벤트 id는 이 접두를 쓸 수 없다 — 본 이벤트 기록 `seen`에서 키가 섞이지 않게) */
export const NOTE_ID_PATTERN = /^note-[a-z0-9-]{3,40}$/;
/** 「생각 남기기」 버튼으로 연 수동 기록의 연표 `eventId` — 카드 id가 될 수 없다 */
export const MANUAL_NOTE_ID = 'note-manual';

/** `any-of`(배열: 하나라도 맞으면) 또는 `all-of`(단일 조건: 적힌 항목이 모두 맞아야) */
export type NoteCondition = Condition | Condition[];

/** 적격 조건(`triggers`)의 한 갈래: 적힌 것이 모두 맞아야 이 갈래가 맞고, 갈래 중 하나라도 맞으면 적격이다 */
export interface NoteTrigger {
  /** 조건(이벤트와 같은 문법) */
  conditions?: Condition;
  /** 이 이벤트 중 하나라도 이 판에서 일어났어야 한다(`seen`) */
  seenAny?: string[];
  /** 이 나이 이상이어야 한다 */
  minAge?: number;
}

/** 때: `asap`은 적격이 된 첫 해, `jitter`는 시드로 정해지는 나이(최소 + 해시 % 폭) 이후의 첫 적격 해. 변형(`variants`)의 조건이 먼저 맞으면 흔들림 대신 바로 뜬다 */
export type NoteTiming = 'asap' | { jitter: { min: number; max: number } };

export interface NoteVariant {
  when: NoteCondition;
  prompt: string;
}

export interface NoteCardDef {
  id: string;
  /** 연표 라벨 「나의 기록 · {topic}」 (한글·공백, ≤ 12자) */
  topic: string;
  /** 카드 번호(같은 해에 둘 이상 적격이면 작은 쪽이 먼저) */
  order: number;
  ageRange: { min: number; max: number };
  /** 없으면 세 시대 모두 */
  eras?: Era[];
  /** 적격(모두 맞아야) */
  conditions?: Condition;
  /** 있으면 하나라도 맞아야 적격 */
  triggers?: NoteTrigger[];
  /** 이 이벤트를 하나라도 본 판은 제외 */
  unlessSeen?: string[];
  timing: NoteTiming;
  /** 질문(기본 문장). `{이름}`은 주인공 이름으로 바뀐다 */
  prompt: string;
  /** 첫 일치 변형의 문장을 쓴다. 변형이 맞는 것이 곧 「더 일찍 뜨는」 조건이다 */
  variants?: NoteVariant[];
  citation?: string | Partial<Record<Era, string>>;
  noCitation?: NoCitationCode;
  /** 이 카드의 글자 수 한도(그래핌, 140 이하만) */
  maxLength?: number;
}

/** 수동 기록(「생각 남기기」 버튼)의 고정 질문과 연표 라벨 주제 */
export interface NoteManualDef {
  topic: string;
  prompt: string;
}

export interface NoteFile {
  manual: NoteManualDef;
  cards: NoteCardDef[];
}

export class NoteDataError extends Error {
  readonly problems: string[];
  constructor(problems: string[]) {
    super(`기록 카드 데이터 오류 ${problems.length}건:\n- ${problems.join('\n- ')}`);
    this.name = 'NoteDataError';
    this.problems = problems;
  }
}

// ---------- 스키마 검증 ----------

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const isInt = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v);
const CONTROL_CHARS = /[\u0000-\u001f\u007f]/;
const CARD_MAX_AGE = 110;
const CARD_KEYS = ['id', 'topic', 'order', 'ageRange', 'eras', 'conditions', 'triggers', 'unlessSeen', 'timing', 'prompt', 'variants', 'citation', 'noCitation', 'maxLength'] as const;

function textProblems(v: unknown, path: string, min: number, max: number, out: string[]): void {
  if (typeof v !== 'string') return void out.push(`${path}: 문자열이어야 한다`);
  if (v !== v.trim()) out.push(`${path}: 앞뒤 공백이 있다`);
  if (CONTROL_CHARS.test(v)) out.push(`${path}: 줄바꿈 등 제어 문자가 있다`);
  if (v.length < min || v.length > max) out.push(`${path}: 길이는 ${min}~${max}자여야 한다 (지금 ${v.length}자)`);
}

function idListProblems(v: unknown, path: string, out: string[]): void {
  if (!Array.isArray(v) || v.length === 0) return void out.push(`${path}: 비어 있지 않은 배열이어야 한다`);
  const seen = new Set<string>();
  v.forEach((id, i) => {
    if (typeof id !== 'string' || !EVENT_ID_PATTERN.test(id)) out.push(`${path}[${i}]: 이벤트 id 형식이어야 한다 (지금 ${JSON.stringify(id)})`);
    else if (seen.has(id)) out.push(`${path}[${i}]: 중복이다 (${id})`);
    else seen.add(id);
  });
}

function noteConditionProblems(v: unknown, path: string, out: string[]): void {
  if (Array.isArray(v)) {
    if (v.length === 0 || v.length > 4) out.push(`${path}: 조건 배열은 1~4개여야 한다 (배열은 하나라도 맞으면 참)`);
    v.forEach((c, i) => out.push(...conditionProblems(c, `${path}[${i}]`)));
  } else out.push(...conditionProblems(v, path));
}

function cardProblems(c: unknown, path: string): string[] {
  const out: string[] = [];
  if (!isObj(c)) return [`${path}: 카드 객체여야 한다`];
  for (const k of Object.keys(c)) if (!(CARD_KEYS as readonly string[]).includes(k)) out.push(`${path}: 알 수 없는 항목 "${k}" (허용: ${CARD_KEYS.join(', ')})`);
  for (const k of ['id', 'topic', 'order', 'ageRange', 'timing', 'prompt']) if (c[k] === undefined) out.push(`${path}: 필수 항목 "${k}"가 없다`);

  if (typeof c.id !== 'string' || !NOTE_ID_PATTERN.test(c.id)) out.push(`${path}.id: ${NOTE_ID_PREFIX}로 시작하는 소문자·숫자·하이픈 7~45자(예: note-first-love)여야 한다`);
  else if (c.id === MANUAL_NOTE_ID) out.push(`${path}.id: ${MANUAL_NOTE_ID}는 수동 기록 전용이라 카드 id로 쓸 수 없다`);
  if (c.topic !== undefined) {
    textProblems(c.topic, `${path}.topic`, 2, 12, out);
    if (typeof c.topic === 'string' && !/^[가-힣 ]+$/.test(c.topic)) out.push(`${path}.topic: 연표 라벨은 한글과 공백만 쓴다 (스크린 리더가 기호를 읽지 않게)`);
  }
  if (c.order !== undefined && (!isInt(c.order) || c.order < 1 || c.order > 20)) out.push(`${path}.order: 1~20의 정수여야 한다`);

  let ageMin = 0;
  let ageMax = CARD_MAX_AGE;
  if (c.ageRange !== undefined) {
    const r = c.ageRange;
    if (!isObj(r) || !isInt(r.min) || !isInt(r.max)) out.push(`${path}.ageRange: { min, max } 정수 객체여야 한다`);
    else {
      for (const k of Object.keys(r)) if (k !== 'min' && k !== 'max') out.push(`${path}.ageRange: 알 수 없는 항목 "${k}"`);
      if (r.min < 0 || r.max > CARD_MAX_AGE || r.min > r.max) out.push(`${path}.ageRange: 0~${CARD_MAX_AGE}이고 min이 max를 넘지 않아야 한다 (지금 ${r.min}~${r.max})`);
      else {
        ageMin = r.min;
        ageMax = r.max;
      }
    }
  }
  if (c.eras !== undefined) {
    if (!Array.isArray(c.eras) || c.eras.length === 0) out.push(`${path}.eras: 비어 있지 않은 배열이어야 한다 (생략하면 세 시대 모두)`);
    else {
      const seen = new Set<unknown>();
      c.eras.forEach((e, i) => {
        if (!(ERAS as readonly unknown[]).includes(e)) out.push(`${path}.eras[${i}]: 허용되지 않는 값 ${JSON.stringify(e)} (허용: ${ERAS.join(', ')})`);
        else if (seen.has(e)) out.push(`${path}.eras[${i}]: 중복이다`);
        seen.add(e);
      });
    }
  }
  if (c.conditions !== undefined) out.push(...conditionProblems(c.conditions, `${path}.conditions`));
  if (c.triggers !== undefined) {
    if (!Array.isArray(c.triggers) || c.triggers.length === 0 || c.triggers.length > 4) out.push(`${path}.triggers: 1~4개 갈래의 배열이어야 한다 (하나라도 맞으면 적격)`);
    else {
      c.triggers.forEach((t: unknown, i: number) => {
        const tp = `${path}.triggers[${i}]`;
        if (!isObj(t) || Object.keys(t).length === 0) return void out.push(`${tp}: { conditions?, seenAny?, minAge? } 객체여야 하고 비어 있으면 안 된다`);
        for (const k of Object.keys(t)) if (k !== 'conditions' && k !== 'seenAny' && k !== 'minAge') out.push(`${tp}: 알 수 없는 항목 "${k}"`);
        if (t.conditions !== undefined) out.push(...conditionProblems(t.conditions, `${tp}.conditions`));
        if (t.seenAny !== undefined) idListProblems(t.seenAny, `${tp}.seenAny`, out);
        if (t.minAge !== undefined && (!isInt(t.minAge) || t.minAge < 0 || t.minAge > CARD_MAX_AGE)) out.push(`${tp}.minAge: 0~${CARD_MAX_AGE}의 정수여야 한다`);
      });
    }
  }
  if (c.unlessSeen !== undefined) idListProblems(c.unlessSeen, `${path}.unlessSeen`, out);

  if (c.timing !== undefined && c.timing !== 'asap') {
    const t = c.timing;
    if (!isObj(t) || !isObj(t.jitter) || Object.keys(t).length !== 1) out.push(`${path}.timing: "asap" 또는 { jitter: { min, max } }여야 한다`);
    else {
      const j = t.jitter;
      if (!isInt(j.min) || !isInt(j.max) || Object.keys(j).length !== 2) out.push(`${path}.timing.jitter: { min, max } 정수여야 한다`);
      else if (j.min > j.max || j.min < ageMin || j.max > ageMax) out.push(`${path}.timing.jitter: ${j.min}~${j.max}는 ageRange ${ageMin}~${ageMax} 안이어야 한다 (min ≤ max)`);
    }
  }
  if (c.prompt !== undefined) textProblems(c.prompt, `${path}.prompt`, 10, 120, out);
  if (c.variants !== undefined) {
    if (!Array.isArray(c.variants) || c.variants.length === 0 || c.variants.length > 3) out.push(`${path}.variants: 1~3개의 배열이어야 한다`);
    else {
      c.variants.forEach((v: unknown, i: number) => {
        const vp = `${path}.variants[${i}]`;
        if (!isObj(v)) return void out.push(`${vp}: { when, prompt } 객체여야 한다`);
        for (const k of Object.keys(v)) if (k !== 'when' && k !== 'prompt') out.push(`${vp}: 알 수 없는 항목 "${k}"`);
        if (v.when === undefined) out.push(`${vp}: 필수 항목 "when"이 없다`);
        else noteConditionProblems(v.when, `${vp}.when`, out);
        if (v.prompt === undefined) out.push(`${vp}: 필수 항목 "prompt"가 없다`);
        else textProblems(v.prompt, `${vp}.prompt`, 10, 120, out);
      });
    }
  }
  out.push(...citationShapeProblems(c, `${path}`));
  if (c.maxLength !== undefined && (!isInt(c.maxLength) || c.maxLength < 1 || c.maxLength > 140)) out.push(`${path}.maxLength: 1~140의 정수여야 한다 (그래핌)`);
  return out;
}

/**
 * `notes.json` 내용을 검증하고 카드 목록(번호 순)을 돌려준다. 문제가 하나라도 있으면 모아서 `NoteDataError`로 던진다.
 * 형식: `{ "manual": { "topic", "prompt" }, "cards": [ ... ] }` (그 밖의 최상위 항목은 "note"만). id·번호 중복, 카드 id 형식, 조건 문법, 때(`timing`)와 나이 창의 일관성을 본다.
 * 풀(이벤트)과의 교차 점검(플래그·본 이벤트 id)은 `noteCardPoolProblems`, 문구 점검은 `lintNoteFile`이 한다.
 */
export function validateNoteFile(raw: unknown): NoteFile {
  const problems: string[] = [];
  if (!isObj(raw)) throw new NoteDataError(['최상위는 { "manual": {...}, "cards": [...] } 객체여야 한다']);
  for (const k of Object.keys(raw)) if (k !== 'cards' && k !== 'manual' && k !== 'note') problems.push(`알 수 없는 항목 "${k}" (허용: cards, manual, note)`);
  if (raw.manual === undefined) problems.push('필수 항목 "manual"이 없다');
  else if (!isObj(raw.manual)) problems.push('manual: { topic, prompt } 객체여야 한다');
  else {
    for (const k of Object.keys(raw.manual)) if (k !== 'topic' && k !== 'prompt') problems.push(`manual: 알 수 없는 항목 "${k}"`);
    textProblems(raw.manual.topic, 'manual.topic', 2, 12, problems);
    textProblems(raw.manual.prompt, 'manual.prompt', 10, 120, problems);
    if (typeof raw.manual.topic === 'string' && !/^[가-힣 ]+$/.test(raw.manual.topic)) problems.push('manual.topic: 연표 라벨은 한글과 공백만 쓴다');
  }
  if (!Array.isArray(raw.cards) || raw.cards.length === 0) problems.push('cards: 비어 있지 않은 배열이어야 한다');
  else {
    const ids = new Set<string>();
    const orders = new Set<number>();
    raw.cards.forEach((c: unknown, i: number) => {
      const label = isObj(c) && typeof c.id === 'string' ? `cards[${i}](${c.id})` : `cards[${i}]`;
      problems.push(...cardProblems(c, label));
      if (isObj(c)) {
        if (typeof c.id === 'string') {
          if (ids.has(c.id)) problems.push(`${label}: id가 중복이다`);
          ids.add(c.id);
        }
        if (isInt(c.order)) {
          if (orders.has(c.order)) problems.push(`${label}: 번호(order) ${c.order}가 중복이다`);
          orders.add(c.order);
        }
      }
    });
  }
  if (problems.length > 0) throw new NoteDataError(problems);
  const file = raw as unknown as NoteFile;
  return { manual: { ...file.manual }, cards: [...file.cards].sort((a, b) => a.order - b.order) };
}

// ---------- 풀과의 교차 점검 ----------

function conditionFlags(cond: NoteCondition | undefined, out: Set<string>): void {
  for (const c of cond === undefined ? [] : Array.isArray(cond) ? cond : [cond]) {
    for (const f of c.flags ?? []) out.add(f);
    for (const f of c.notFlags ?? []) out.add(f);
  }
}

/** 카드가 조건에서 읽는 모든 플래그 */
export function noteFlagsRead(card: NoteCardDef): Set<string> {
  const out = new Set<string>();
  conditionFlags(card.conditions, out);
  for (const t of card.triggers ?? []) conditionFlags(t.conditions, out);
  for (const v of card.variants ?? []) conditionFlags(v.when, out);
  return out;
}

/**
 * 카드가 읽는 플래그를 켜는 이벤트가 있는지, `seenAny`·`unlessSeen`의 이벤트 id가 실제 이벤트인지 본다(오타 방지 — 켜지지 않는 플래그를 조건에 쓰면 카드가 영원히 안 뜬다).
 * 카드 id가 이벤트 id와 겹치지 않는지도 본다.
 */
export function noteCardPoolProblems(cards: readonly NoteCardDef[], events: readonly EventDef[]): string[] {
  const problems: string[] = [];
  const ids = new Set(events.map((e) => e.id));
  const setAnywhere = new Set<string>();
  for (const ev of events) for (const f of flagsWritten(ev).set) setAnywhere.add(f);
  for (const c of cards) {
    if (ids.has(c.id)) problems.push(`기록 카드 "${c.id}": 같은 id의 이벤트가 있다`);
    for (const f of noteFlagsRead(c)) if (!setAnywhere.has(f)) problems.push(`기록 카드 "${c.id}": 조건에서 읽는 플래그 "${f}"를 켜는 이벤트가 어디에도 없다 (오타이거나 setFlags가 빠졌다)`);
    const seenIds = [...(c.unlessSeen ?? []), ...(c.triggers ?? []).flatMap((t) => t.seenAny ?? [])];
    for (const id of seenIds) if (!ids.has(id)) problems.push(`기록 카드 "${c.id}": seenAny·unlessSeen의 "${id}"는 이벤트 풀에 없는 id다`);
  }
  return problems;
}

// ---------- 문구 점검 (content-M7c 1-1 R7, 1-2 S1~S4) ----------

/** S1: 자살·자해·학대·폭행·성적 내용을 묻거나 암시하는 낱말(부분 문자열) */
export const NOTE_SAFETY_WORDS = ['자살', '자해', '목숨', '죽', '학대', '폭행', '폭력', '구타', '성폭', '성추행', '강간', '트라우마'] as const;
/** S2: 원인·이유·책임을 캐묻는 낱말 */
export const NOTE_CAUSE_WORDS = ['왜', '어째서', '이유', '때문'] as const;
/** S4: 질문이 먼저 꺼내면 안 되는 감정 형용사 줄기. 주제 낱말(부럽다·샘·아팠다·나이 들다·헤어짐)은 여기에 없다 */
export const NOTE_EMOTION_WORDS = ['행복', '기쁨', '기쁘', '슬픔', '슬프', '외로움', '외롭', '후회', '분노', '두려움', '두렵', '무섭', '무서', '불안', '우울', '괴롭', '부끄', '그리움'] as const;
/** R7: 이름 뒤에는 변하지 않는 조사만 (이/가·은/는을 붙이지 않는다) */
export const NOTE_NAME_PARTICLES = ['에게도', '에게', '의'] as const;
/** 질문 문장에서 `{이름}`을 5자로 센다 — 이름은 한글 3~5자만 저장 검증을 통과하므로(`CHARACTER_NAME_PATTERN`, NC-13) 5자가 최대다 (M7c r2 T01; 예전 4자는 가정이었다) */
export const NOTE_NAME_WIDTH = 5;
/** S3: 질문은 「있습니까?」류로 끝나 「없다」도 정답이다 */
const QUESTION_ENDING = /(?:있습니까|있었습니까|느껴집니까)\?$/;
const PICTOGRAPH = /\p{Extended_Pictographic}/u;

/** 질문 하나의 문구 문제 목록 (`where`는 위치 표시) */
export function notePromptProblems(prompt: string, where: string, eras?: readonly Era[]): string[] {
  const out: string[] = [];
  const add = (msg: string) => out.push(`${where}: ${msg} — "${prompt}"`);
  const counted = prompt.replaceAll('{이름}', '가'.repeat(NOTE_NAME_WIDTH));
  if (counted.length > TEXT_LIMITS.sentence) add(`한 문장이 ${TEXT_LIMITS.sentence}자를 넘는다 ({이름}을 ${NOTE_NAME_WIDTH}자로 센 ${counted.length}자)`);
  if ((prompt.match(/\?/g) ?? []).length !== 1) add('물음표가 정확히 하나여야 한다');
  if (/[!！]/.test(prompt)) add('느낌표가 있다');
  if (/[.。…]/.test(prompt)) add('마침표·말줄임표가 있다 (한 문장, 물음표로 끝난다)');
  if (PICTOGRAPH.test(prompt)) add('이모지·그림 기호가 있다');
  if (!QUESTION_ENDING.test(prompt)) add('「있습니까?」「있었습니까?」「느껴집니까?」로 끝나야 한다 (S3: 「없다」도 정답인 질문)');
  const braces = prompt.match(/\{[^}]*\}/g) ?? [];
  if (braces.some((b) => b !== '{이름}')) add('자리 표시는 {이름}뿐이다');
  if (/[{}]/.test(prompt.replaceAll('{이름}', ''))) add('짝이 맞지 않는 중괄호가 있다');
  for (const m of prompt.matchAll(/\{이름\}/g)) {
    const rest = prompt.slice((m.index ?? 0) + m[0].length);
    if (!NOTE_NAME_PARTICLES.some((p) => rest.startsWith(p))) add(`{이름} 뒤에는 ${NOTE_NAME_PARTICLES.join(', ')}만 올 수 있다 (이/가·은/는은 이름에 따라 달라져 쓰지 않는다)`);
  }
  for (const w of NOTE_SAFETY_WORDS) if (prompt.includes(w)) add(`안전 기준(S1)에 걸리는 낱말이 있다 (${w})`);
  for (const w of NOTE_CAUSE_WORDS) if (prompt.includes(w)) add(`원인·이유를 캐묻는 낱말이 있다 (S2: ${w})`);
  for (const w of NOTE_EMOTION_WORDS) if (prompt.includes(w)) add(`질문이 먼저 꺼내면 안 되는 감정 낱말이 있다 (S4: ${w})`);
  for (const w of bannedWordsFor(eras)) if (prompt.includes(w)) add(`이 카드가 뜨는 시대에 어울리지 않는 소재다 (R8: ${w})`);
  return out;
}

/** 파일 전체의 문구 점검: 카드 질문·변형·수동 질문. `check:events`(빌드)와 `npm test`가 같은 함수를 부른다. */
export function lintNoteFile(file: NoteFile): string[] {
  const out = notePromptProblems(file.manual.prompt, '수동 기록 질문');
  for (const c of file.cards) {
    out.push(...notePromptProblems(c.prompt, `${c.id} 기본 질문`, c.eras));
    (c.variants ?? []).forEach((v, i) => out.push(...notePromptProblems(v.prompt, `${c.id} 변형 ${i + 1}`, c.eras)));
  }
  return out;
}
