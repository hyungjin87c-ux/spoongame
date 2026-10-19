/**
 * 기록 카드에 사용자가 적는 글의 규칙 (SPEC-003 M7c FR3·FR4, docs/data/content-M7c.md 3절). React·DOM·난수·시각과 무관한 순수 모듈이다.
 *
 * 세 함수가 이 모듈의 얼굴이다.
 *  - `finalizeNote(raw)`   : 제출·저장 직전의 정규화(3-2절). 같은 입력 → 같은 출력이고 **멱등**이다(`finalizeNote(finalizeNote(x).text).text === finalizeNote(x).text`).
 *  - `sanitizeLive(raw)`   : 입력란 `onChange`에서 쓰는 가벼운 정리(3-2절 끝). 앞뒤 공백 제거·공백 접기는 하지 않는다(입력 중 띄어쓰기를 칠 수 있어야 한다).
 *                            `finalizeNote(sanitizeLive(x)).text === finalizeNote(x).text`가 성립한다 — 한도(그래핌 140·단위 400)는 「저장될 글」 기준으로 잰다.
 *  - `cleanNoteForLoad(t)` : 저장에서 불러올 때(3-6절 H3·H4). **거부하지 않고** 위험한 글자만 걷어 낸다. 길이(140·400·3줄)는 다시 자르지 않는다.
 *
 * 글자 셈의 단위: 「한 글자」 = 사용자가 한 글자로 보는 그래핌(`Intl.Segmenter`). 그래핌 140개만으로는 저장 크기가 막히지 않아(결합 문자 범람·긴 이모지 시퀀스)
 * UTF-16 단위 400(= HISTORY_LIMITS.maxTextLength)과 그래핌당 코드 포인트 상한(비이모지 8·이모지 시퀀스 12)을 함께 둔다. `Intl.Segmenter`가 없는 환경은
 * 코드 포인트 단위로 세고 ZWJ·변이 선택자·태그 문자를 모두 지운다(이모지 시퀀스가 흩어지지만 안전하고 한도는 더 보수적이다).
 * 이 모듈은 글을 **읽지 않는다**(키워드·감정 분석 없음, S8) — 글자의 종류만 본다. 오류 메시지·로그에 글을 넣지 않는다(P3).
 */

/** 기록 글·카드의 한도. JSON이 아니라 코드에 둔다(content-M7c 1-5절). */
export const NOTE_LIMITS = {
  /** 그래핌(사용자가 한 글자로 센 단위) */
  graphemes: 140,
  /** UTF-16 단위 = HISTORY_LIMITS.maxTextLength — 이만큼이면 연표 기록(clipEntry)이 글을 자르지 않는다 */
  units: 400,
  /** 줄(줄바꿈 문자 2개). 넘는 줄은 앞 줄 끝에 공백 하나로 이어 붙인다 */
  lines: 3,
  /** 입력에서 읽는 양(앞부분만). 1MB 붙여넣기가 화면을 멈추지 않게 */
  readUnits: 20_000,
  /** 비이모지 그래핌 하나가 가질 수 있는 코드 포인트(기본 글자 + 결합 문자) */
  clusterCodePoints: 8,
  /** 이모지 시퀀스 그래핌 하나가 가질 수 있는 코드 포인트(4인 가족 + 피부색이 최대 11) */
  emojiCodePoints: 12,
  /**
   * 하위 지역 깃발(검은 깃발 + 태그 글자 + 취소 태그)의 태그 글자 수: 소문자·숫자 2~6개 (RGI 깃발은 5개까지 — 스코틀랜드 gbsct). **쓸 때(`finalizeNote`)와 불러올 때(`cleanNoteForLoad`)가 이 한 쌍을 같이 쓴다** —
   * 두 함수가 다른 상한을 쓰면 「`finalizeNote`의 결과는 `cleanNoteForLoad`의 고정점」이 깨지고(R-406), 태그 글자 안에 임의 글자를 숨길 수 있다.
   */
  tagLettersMin: 2,
  tagLettersMax: 6,
  /** 판당 자동 카드 수(종류당 1회 × 7종) */
  autoCards: 7,
  /** 한 인생에서 남길 수 있는 기록(note 행) 전체 */
  total: 40,
  /** 자동 카드 사이의 최소 나이 차 */
  gapYears: 2,
} as const;

// ---------- 글자 처분표 (3-3절) ----------

export type Disposition =
  /** 그대로 둔다 */
  | 'keep'
  /** 지운다 */
  | 'drop'
  /** 공백(U+0020)으로 바꾼다 */
  | 'space'
  /** 줄바꿈(\n)으로 바꾼다 */
  | 'newline'
  /** ZWJ(U+200D): 이모지 시퀀스 안에서만 둔다 */
  | 'joiner'
  /** 변이 선택자 U+FE0E·U+FE0F: 이모지 시퀀스·키캡 안에서만 둔다 */
  | 'variation'
  /** 태그 문자 U+E0000~E007F: 하위 지역 깃발 안에서만 둔다 */
  | 'tag';

/** 코드 포인트 하나의 처분 (3-3절 표). 배정되지 않은 코드 포인트도 지우지 않는다 — 브라우저가 모르는 새 이모지를 잃지 않게. */
export function dispositionOf(cp: number): Disposition {
  if (cp < 0x20) {
    if (cp === 0x09) return 'space';
    if (cp === 0x0a || cp === 0x0b || cp === 0x0c || cp === 0x0d) return 'newline';
    return 'drop';
  }
  if (cp === 0x20) return 'space';
  if (cp < 0x7f) return 'keep';
  if (cp <= 0x9f) return cp === 0x85 ? 'newline' : 'drop';
  // 가로 공백류
  if (cp === 0xa0 || cp === 0x1680 || (cp >= 0x2000 && cp <= 0x200a) || cp === 0x202f || cp === 0x205f || cp === 0x3000) return 'space';
  // 보이는 빈칸 글자: 지우면 낱말이 붙고 이름이 비어 보이게 하는 글자와 같은 부류 — 공백으로 (QA A12d)
  if (cp === 0x3164 || cp === 0x115f || cp === 0x1160 || cp === 0xffa0 || cp === 0x2800 || cp === 0x180e) return 'space';
  if (cp === 0x2028 || cp === 0x2029) return 'newline';
  if (cp === 0x200d) return 'joiner';
  if (cp === 0xfe0e || cp === 0xfe0f) return 'variation';
  if (cp >= 0xe0000 && cp <= 0xe007f) return 'tag';
  // 방향 제어 · 제로폭 · 서식 · 변이 선택자(이모지용 FE0E·FE0F 밖) · 짝 없는 서러게이트 · 개인 사용 영역 · 비문자
  if (
    cp === 0xad ||
    cp === 0x34f ||
    cp === 0x61c ||
    cp === 0x200b ||
    cp === 0x200c ||
    cp === 0x200e ||
    cp === 0x200f ||
    (cp >= 0x202a && cp <= 0x202e) ||
    (cp >= 0x2060 && cp <= 0x2064) ||
    (cp >= 0x2066 && cp <= 0x206f) ||
    (cp >= 0xfe00 && cp <= 0xfe0d) ||
    cp === 0xfeff ||
    (cp >= 0xfff9 && cp <= 0xfffb) ||
    (cp >= 0xd800 && cp <= 0xdfff) ||
    (cp >= 0xe000 && cp <= 0xf8ff) ||
    (cp >= 0xfdd0 && cp <= 0xfdef) ||
    cp === 0xfffe ||
    cp === 0xffff ||
    (cp >= 0xe0100 && cp <= 0xe01ef) ||
    cp >= 0xf0000
  ) {
    return 'drop';
  }
  return 'keep'; // U+FFFD(대체 문자)도 보이는 글자라 둔다
}

/** 보이는 글자가 하나도 없는가 (공백·줄바꿈·지워질 글자뿐). 쉼표·마침표만 있는 글은 보이는 표현이라 아니다. */
export function isInvisibleOnly(text: string): boolean {
  for (const ch of text) if (dispositionOf(ch.codePointAt(0)!) === 'keep') return false;
  return true;
}

// ---------- 그래핌 ----------

interface SegmenterLike {
  segment(input: string): Iterable<{ segment: string }>;
}
type SegmenterCtor = new (locales?: string | string[], options?: { granularity: 'grapheme' }) => SegmenterLike;

let segmenterCache: { ctor: unknown; instance: SegmenterLike } | null = null;

/** `Intl.Segmenter`(그래핌). 없거나 만들 수 없으면 null — 호출할 때마다 확인해 시험이 Segmenter를 지운 환경으로도 돌 수 있게 한다. */
function graphemeSegmenter(): SegmenterLike | null {
  const ctor = typeof Intl === 'undefined' ? undefined : (Intl as unknown as { Segmenter?: SegmenterCtor }).Segmenter;
  if (typeof ctor !== 'function') return null;
  if (segmenterCache !== null && segmenterCache.ctor === ctor) return segmenterCache.instance;
  try {
    const instance = new ctor(undefined, { granularity: 'grapheme' });
    segmenterCache = { ctor, instance };
    return instance;
  } catch {
    return null;
  }
}

/** 결합 문자(Mn·Me·Mc) 한 글자인가 — Segmenter가 없을 때 앞 글자에 붙여 한 칸으로 센다 */
const MARK = /^\p{M}$/u;

/** 글을 그래핌 조각으로 나눈다. Segmenter가 없으면 코드 포인트 하나(+ 이어지는 결합 문자)가 한 조각이다. */
export function splitGraphemes(text: string): string[] {
  const seg = graphemeSegmenter();
  if (seg !== null) return Array.from(seg.segment(text), (s) => s.segment);
  const out: string[] = [];
  for (const ch of text) {
    if (out.length > 0 && MARK.test(ch)) out[out.length - 1] += ch;
    else out.push(ch);
  }
  return out;
}

/** 그래핌 수 (글자 수 표시와 한도 판정) */
export function countGraphemes(text: string): number {
  return splitGraphemes(text).length;
}

// ---------- 이모지 시퀀스 (3-4절) ----------

/** 그림 문자 + (U+FE0E/FE0F) + (피부색 U+1F3FB~1F3FF)를 U+200D로 이은 열 */
const EMOJI_SEQUENCE = /^\p{Extended_Pictographic}[\uFE0E\uFE0F]?[\u{1F3FB}-\u{1F3FF}]?(?:\u200D\p{Extended_Pictographic}[\uFE0E\uFE0F]?[\u{1F3FB}-\u{1F3FF}]?)*$/u;
/** 깃발: 지역 표시 글자 2개 */
const FLAG = /^[\u{1F1E6}-\u{1F1FF}]{2}$/u;
/** 키캡: [0-9#*] + (U+FE0F) + U+20E3 */
const KEYCAP = /^[0-9#*]\uFE0F?\u20E3$/u;
/** 하위 지역 깃발의 바탕 글자(검은 깃발)와 취소 태그 */
const FLAG_BASE = String.fromCodePoint(0x1f3f4);
const TAG_CANCEL = 0xe007f;
/** 태그 글자: 태그 숫자 U+E0030~E0039 · 태그 소문자 U+E0061~E007A (하위 지역 코드는 소문자와 숫자뿐이다) */
const TAG_LETTER_CLASS = '[\u{E0030}-\u{E0039}\u{E0061}-\u{E007A}]';
/** 하위 지역 깃발: 검은 깃발 + 태그 글자 `tagLettersMin`~`tagLettersMax`개 + 취소 태그. 개수 상한은 `NOTE_LIMITS`의 한 쌍이고 불러올 때도 같이 쓴다 */
const TAG_FLAG = new RegExp('^' + FLAG_BASE + TAG_LETTER_CLASS + '{' + NOTE_LIMITS.tagLettersMin + ',' + NOTE_LIMITS.tagLettersMax + '}' + String.fromCodePoint(TAG_CANCEL) + '$', 'u');
/** 태그 글자 한 개인가 (불러올 때 깃발 안의 태그 글자 판정) */
const TAG_LETTER = new RegExp('^' + TAG_LETTER_CLASS + '$', 'u');

function codePointCount(text: string): number {
  return Array.from(text).length;
}

/**
 * 이 그래핌이 통째로 유효한 이모지(시퀀스·깃발·키캡·하위 지역 깃발)이면 코드 포인트 12개 이하로 줄인 것을, 아니면 null을 돌려준다.
 * 12개를 넘는 ZWJ 시퀀스는 12개 안에 드는 앞쪽 요소까지만 남긴다(여전히 유효한 시퀀스). 깃발·키캡·태그 깃발이 12개를 넘으면 이모지로 보지 않는다(숨은 글자 심기 차단).
 */
function emojiCluster(cluster: string): string | null {
  if (EMOJI_SEQUENCE.test(cluster)) {
    if (codePointCount(cluster) <= NOTE_LIMITS.emojiCodePoints) return cluster;
    let out = '';
    for (const element of cluster.split('\u200D')) {
      const next = out === '' ? element : `${out}\u200D${element}`;
      if (codePointCount(next) > NOTE_LIMITS.emojiCodePoints) break;
      out = next;
    }
    return out === '' ? null : out;
  }
  if ((FLAG.test(cluster) || KEYCAP.test(cluster) || TAG_FLAG.test(cluster)) && codePointCount(cluster) <= NOTE_LIMITS.emojiCodePoints) return cluster;
  return null;
}

/** 그래핌 하나를 처분표대로 걸러 낸다. 유효한 이모지는 그대로, 아니면 코드 포인트마다 처분하고 보이는 글자는 8개까지만 남긴다. */
function scrubCluster(cluster: string, segmented: boolean): string {
  if (segmented) {
    const emoji = emojiCluster(cluster);
    if (emoji !== null) return emoji;
  }
  let out = '';
  let kept = 0;
  for (const ch of cluster) {
    const d = dispositionOf(ch.codePointAt(0)!);
    if (d === 'drop' || d === 'joiner' || d === 'variation' || d === 'tag') continue; // 시퀀스 밖의 ZWJ·변이 선택자·태그는 지운다
    if (d === 'space') out += ' ';
    else if (d === 'newline') out += '\n';
    else {
      if (kept >= NOTE_LIMITS.clusterCodePoints) continue; // 결합 문자 범람: 뒤의 결합 문자부터 버린다
      out += ch;
      kept++;
    }
  }
  return out;
}

function scrubText(text: string): string {
  const seg = graphemeSegmenter();
  const segmented = seg !== null;
  return splitGraphemes(text)
    .map((c) => scrubCluster(c, segmented))
    .join('');
}

// ---------- 읽는 양 · 줄 · 공백 · 한도 ----------

/** 입력의 앞 20,000 단위만 읽는다. 끝이 서러게이트 쌍의 앞쪽에서 끊기면 그 홀로 남은 앞쪽을 버린다. */
function readCap(raw: string): { text: string; truncated: boolean } {
  if (raw.length <= NOTE_LIMITS.readUnits) return { text: raw, truncated: false };
  let text = raw.slice(0, NOTE_LIMITS.readUnits);
  const last = text.charCodeAt(text.length - 1);
  if (last >= 0xd800 && last <= 0xdbff) text = text.slice(0, -1);
  return { text, truncated: true };
}

/** 줄마다 앞뒤 공백을 걷고 안쪽 연속 공백을 하나로, 빈 줄을 없앤다. 3줄을 넘으면 4번째 줄부터를 3번째 줄 끝에 공백 하나로 잇는다. */
function layoutText(text: string): { text: string; merged: boolean } {
  let lines = text
    .split('\n')
    .map((l) => l.replace(/ +/g, ' ').replace(/^ | $/g, ''))
    .filter((l) => l !== '');
  let merged = false;
  if (lines.length > NOTE_LIMITS.lines) {
    lines = [...lines.slice(0, NOTE_LIMITS.lines - 1), lines.slice(NOTE_LIMITS.lines - 1).join(' ')];
    merged = true;
  }
  return { text: lines.join('\n'), merged };
}

/** 그래핌 140개와 단위 400을 넘으면 그래핌 경계에서 자른다. 자른 끝의 공백·줄바꿈은 걷는다(멱등을 지키려고). */
function capText(text: string, limit: number): { text: string; truncated: boolean } {
  let units = 0;
  let count = 0;
  let out = '';
  let truncated = false;
  for (const g of splitGraphemes(text)) {
    if (count >= limit || units + g.length > NOTE_LIMITS.units) {
      truncated = true;
      break;
    }
    out += g;
    units += g.length;
    count++;
  }
  if (truncated) out = out.replace(/[ \n]+$/, '');
  return { text: out, truncated };
}

export interface FinalizedNote {
  /** 정규화된 글 (연표에 저장되는 값) */
  text: string;
  /** 그래핌 수 (≤ 140) */
  graphemes: number;
  /** 입력이 읽는 양(20,000단위)·그래핌 140·단위 400을 넘어 잘렸는가 */
  truncated: boolean;
  /** 3줄을 넘는 줄을 앞 줄에 이어 붙였는가 */
  linesMerged: boolean;
  /** 보이는 글자가 없는 입력인가 (공백만·보이지 않는 글자만·제어 문자만). 이때 「적어두고 살기」는 기록하지 않는다 */
  empty: boolean;
}

interface PassResult {
  text: string;
  truncated: boolean;
  linesMerged: boolean;
}

/** 정규화 한 번: 읽는 양 → NFC → 글자 처분 → 줄바꿈·공백 정리 → 줄 수 → 한도 */
function pass(input: string, limit: number): PassResult {
  const read = readCap(input);
  const clean = scrubText(read.text.normalize('NFC'));
  const laid = layoutText(clean);
  const capped = capText(laid.text, limit);
  return { text: capped.text, truncated: read.truncated || capped.truncated, linesMerged: laid.merged };
}

/** 정규화를 더 이상 바뀌지 않을 때까지 되풀이하는 상한. 글자를 지운 자리에 앞뒤 글자가 붙어 새 그래핌이 생기는 드문 경우를 흡수한다(보통 1~2번이면 끝난다). */
const MAX_PASSES = 8;

/**
 * 제출·저장 직전의 정규화 (3-2절). 순서: 읽는 양(앞 20,000단위) → NFC → 그래핌마다 글자 처분(이모지 시퀀스는 통째로 보존) → 줄바꿈 통일·공백 정리·빈 줄 제거 → 3줄 →
 * 그래핌 140 · 단위 400 자르기 → 빈 입력 판정. 결과가 다시 입력으로 들어가도 같다(멱등 — 더 바뀌지 않을 때까지 되풀이해 보장한다).
 */
export function finalizeNote(raw: string, limit: number = NOTE_LIMITS.graphemes): FinalizedNote {
  let current = raw;
  let truncated = false;
  let linesMerged = false;
  for (let i = 0; i < MAX_PASSES; i++) {
    const r = pass(current, limit);
    truncated ||= r.truncated;
    linesMerged ||= r.linesMerged;
    if (r.text === current) break;
    current = r.text;
  }
  return { text: current, graphemes: countGraphemes(current), truncated, linesMerged, empty: current === '' };
}

// ---------- 입력 중 정리 ----------

/**
 * 입력 중 줄 모양: 빈 줄을 없애되(저장 때 어차피 없어진다) 마지막에 막 누른 줄바꿈 하나와 그 줄의 공백은 남긴다. 3줄이 차면 4번째 줄을 만드는 줄바꿈은 무시하고,
 * 붙여넣기로 3줄을 넘은 줄은 3번째 줄 끝에 공백 하나로 잇는다(저장 때와 같은 규칙). 줄 안의 공백은 건드리지 않는다.
 */
function shapeLive(text: string): string {
  const segments = text.split('\n');
  const blank = (l: string): boolean => /^ *$/.test(l);
  let lines: string[] = [];
  let trailing: string | null = null;
  segments.forEach((seg, i) => {
    if (!blank(seg)) lines.push(seg);
    else if (i === segments.length - 1 && (lines.length > 0 || segments.length === 1)) trailing = seg;
  });
  if (lines.length > NOTE_LIMITS.lines) lines = [...lines.slice(0, NOTE_LIMITS.lines - 1), lines.slice(NOTE_LIMITS.lines - 1).join(' ')];
  if (lines.length >= NOTE_LIMITS.lines) trailing = null; // 4번째 줄을 만드는 Enter는 무시한다
  if (lines.length === 0) return trailing ?? '';
  return trailing === null ? lines.join('\n') : `${lines.join('\n')}\n${trailing}`;
}

/** 저장될 글(공백 정리·줄 정리 뒤)이 그래핌 140·단위 400 안인가 — 입력란의 한도는 이것으로 잰다 */
function fitsAfterLayout(text: string, limit: number): boolean {
  const laid = layoutText(scrubText(text.normalize('NFC'))).text;
  return countGraphemes(laid) <= limit && laid.length <= NOTE_LIMITS.units;
}

/**
 * 입력란 `onChange`용 정리 (3-2절 끝). 읽는 양 · NFC · 글자 처분 · 줄바꿈 통일 · 줄 모양 · 한도 자르기만 하고, **앞뒤 공백 제거와 공백 접기는 하지 않는다**(입력 중 띄어쓰기를 칠 수 있게).
 * 한도는 「저장될 글」 기준이라 `finalizeNote(sanitizeLive(x)).text === finalizeNote(x).text`가 성립한다. 한도를 넘으면 한도를 지키는 가장 긴 앞부분을 돌려준다(자르는 자리의 연속 공백은 하나만 남긴다).
 */
export function sanitizeLive(raw: string, limit: number = NOTE_LIMITS.graphemes): string {
  let current = readCap(raw).text;
  for (let i = 0; i < MAX_PASSES; i++) {
    const next = shapeLive(scrubText(current.normalize('NFC')));
    if (next === current) break;
    current = next;
  }
  if (fitsAfterLayout(current, limit)) return current;
  const parts = splitGraphemes(current);
  let lo = 0; // 한도 안인 가장 긴 앞부분의 조각 수 (빈 앞부분은 늘 한도 안이다)
  let hi = parts.length;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (fitsAfterLayout(parts.slice(0, mid).join(''), limit)) lo = mid;
    else hi = mid - 1;
  }
  return parts.slice(0, lo).join('').replace(/ {2,}$/, ' ');
}

/** 입력란 글자 수 표시: 저장될 글의 그래핌 수. 입력 중 글의 공백이 정리돼 줄어든 값이라 한도(140)를 넘는 일이 없다. */
export function liveGraphemes(live: string, limit: number = NOTE_LIMITS.graphemes): number {
  return finalizeNote(live, limit).graphemes;
}

// ---------- 불러올 때 ----------

const PICTOGRAPH = /^\p{Extended_Pictographic}$/u;
const EMOJI_MODIFIER = /^[\u{1F3FB}-\u{1F3FF}]$/u;

/** 짝 없는 서러게이트를 피해 앞 `maxUnits` 단위 안의 마지막 그래핌 경계에서 자른다 */
function cutAtBoundary(text: string, maxUnits: number): string {
  const head = text.slice(0, maxUnits + 64); // 마지막 그래핌이 경계에 걸쳐도 온전히 나누도록 조금 더 읽는다
  let units = 0;
  let out = '';
  for (const g of splitGraphemes(head)) {
    if (units + g.length > maxUnits) break;
    out += g;
    units += g.length;
  }
  return out;
}

/**
 * 저장에서 불러온 기록 글을 정리한다 (3-6절 H3·H4). **거부하지 않는다**: 위험한 글자(제어·방향·제로폭·서식·짝 없는 서러게이트·개인 사용 영역·비문자,
 * 이모지 시퀀스 밖의 ZWJ·변이 선택자·태그)만 걷어 내고 나머지는 그대로 둔다. 20,000단위를 넘는 변조 값은 그래핌 경계에서 자른다.
 * 그래핌 140 · 단위 400 · 3줄은 **다시 적용하지 않는다** — 기기마다 그래핌 셈이 달라(새 이모지 등) 정상 기록이 잘리는 일을 막는다. 상한은 쓰는 순간(`finalizeNote`)에만 지킨다.
 * 이모지 안의 ZWJ·변이 선택자는 앞뒤 글자를 보고 판단한다(그래핌 분할에 기대지 않는다 — 불러오는 기기의 `Intl.Segmenter`가 달라도 같은 결과). `finalizeNote`가 남긴 글은 이 함수를 거쳐도 그대로다.
 */
export function cleanNoteForLoad(text: string): string {
  const src = text.length > NOTE_LIMITS.readUnits ? cutAtBoundary(text, NOTE_LIMITS.readUnits) : text;
  const chars = Array.from(src); // 코드 포인트 (짝 없는 서러게이트는 한 칸씩)
  let out = '';
  let prev = ''; // 직전에 남긴 글자
  /** 하위 지역 깃발의 태그 글자 — 취소 태그가 와서 깃발이 닫힐 때에만 남긴다(닫히지 않은 태그는 숨은 글자라 지운다) */
  let run = '';
  let tagRun = 0;
  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i];
    const cp = ch.codePointAt(0)!;
    switch (dispositionOf(cp)) {
      case 'drop':
        continue;
      case 'newline': // 변조 저장에만 남는 줄바꿈류(세로 탭·쪽 나눔·CR·U+0085·U+2028·U+2029)는 줄바꿈 하나로 — `finalizeNote`의 결과에는 줄바꿈 하나뿐이라 고정점은 그대로다
        out += String.fromCharCode(10);
        prev = String.fromCharCode(10);
        run = '';
        tagRun = 0;
        continue;
      case 'joiner': {
        const before = prev !== '' && (PICTOGRAPH.test(prev) || EMOJI_MODIFIER.test(prev) || prev === '\uFE0F' || prev === '\uFE0E');
        const after = i + 1 < chars.length && PICTOGRAPH.test(chars[i + 1]);
        if (!(before && after)) continue;
        break;
      }
      case 'variation': {
        const pictograph = prev !== '' && PICTOGRAPH.test(prev);
        const keycap = prev !== '' && /^[0-9#*]$/.test(prev) && chars[i + 1] === '\u20E3';
        if (!(pictograph || keycap)) continue;
        break;
      }
      case 'tag': {
        // 깃발 안의 태그만, `finalizeNote`가 남기는 깃발과 같은 꼴로: 검은 깃발 바로 뒤 또는 앞 태그 글자 뒤, 태그 글자(소문자·숫자)는 `tagLettersMax`개까지, 취소 태그는 글자가 `tagLettersMin`개 이상일 때 하나만
        const afterFlag = run !== '' || prev === FLAG_BASE;
        if (!afterFlag) continue;
        if (cp === TAG_CANCEL) {
          if (tagRun < NOTE_LIMITS.tagLettersMin) continue;
          out += run + ch; // 깃발이 닫혔다 — 모은 태그 글자와 함께 남긴다
          prev = ch;
          run = '';
          tagRun = 0;
          continue;
        }
        if (!TAG_LETTER.test(ch) || tagRun >= NOTE_LIMITS.tagLettersMax) continue;
        run += ch; // 보류: 취소 태그가 와야 남는다
        tagRun++;
        continue;
      }
      default:
        break;
    }
    // 태그가 아닌 글자를 만났다: 닫히지 않은 태그 글자는 버린다
    run = '';
    tagRun = 0;
    out += ch;
    prev = ch;
  }
  return out; // 끝까지 닫히지 않은 태그 글자(run)도 버린다
}
