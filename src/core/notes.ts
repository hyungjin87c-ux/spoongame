import { NOTE_CARDS, NOTE_MANUAL } from '../data/noteCards';
import { condContextOf } from './apply';
import { lastSeenAge, meetsCondition, NOTE_ID_PREFIX, type CondContext } from './events';
import { appendHistory } from './history';
import { MANUAL_NOTE_ID, type NoteCardDef, type NoteCondition, type NoteManualDef } from './noteCards';
import { NOTE_LIMITS, finalizeNote } from './noteText';
import { mixSeed } from './rng';
import type { GameState, HistoryEntry, Settings } from './types';

/**
 * 기록 카드(「생각 남기기」 자동 카드)의 차례 판정과 기록 저장 (SPEC-003 M7c FR1·FR5~FR7·FR9, docs/data/content-M7c.md 1·3-7·5절). 순수 함수 모음이다 —
 * **난수를 쓰지 않는다**: 차례는 시드·나이·플래그·본 이벤트·스탯의 함수이고(흔들림은 `mixSeed(시드, 카드 id 해시)`), 기록은 스탯·자산·플래그·`rngState`를 바꾸지 않는다(숨은 효과 0, S9).
 * 그래서 카드를 모두 쓴 판·모두 건너뛴 판·자동 모드 판·카드를 끈 판의 인생이 같다(tests/noteInvariance.test.ts).
 *
 * 저장 모양(NC-1 A): 쓴 글은 연표 `history`의 `kind: 'note'` 줄(`eventId` = 카드 id 또는 `note-manual`), 카드를 이미 보였는가는 `seen['note-…'] = 나이`(쓴 카드든 건너뛴 카드든 소비 표시).
 * 게임 상태 모양은 늘지 않는다(스키마 v8 유지).
 */

/** 기록 카드를 다루는 방식: `ignore` 보지 않는다(시뮬레이션·기록 시트가 아직 없는 화면) / `stop` 적격 카드 앞에서 멈춘다(수동 + 켜짐: 화면이 시트를 띄운다) / `consume` 시트 없이 「마음속에 담고 살기」로 소비한다(자동 모드·카드 끔) */
export type NoteMode = 'ignore' | 'stop' | 'consume';

/**
 * 기록 카드 처리 (FR7, R-411 — content-M7c 11-7): 자동 모드이거나 `noteCards`가 꺼져 있거나 **기록(note 줄, 자동+수동 합계)이 `NOTE_LIMITS.total`(40)에 이르렀으면 소비**(시트 없이 `seen`에만 표시), 아니면 멈춤.
 * 이 함수가 규칙의 **한 곳**이다 — 세션 reducer의 `advance`·`skip`·`autoChoose`·`choose` 경로와 `App`의 자동 카드 파생 판정이 같은 함수를 부른다. 40개 안내 시트는 도구 줄 「생각 남기기」로 열 때만 보인다.
 */
export function noteResponse(settings: Pick<Settings, 'autoMode' | 'noteCards'>, game: Pick<GameState, 'history'>): 'stop' | 'consume' {
  return settings.autoMode || !settings.noteCards || noteCount(game) >= NOTE_LIMITS.total ? 'consume' : 'stop';
}

/** `seen`의 키가 기록 카드 키인가 (`note-` 접두는 예약 — 이벤트 id는 쓸 수 없다) */
export const isNoteKey = (id: string): boolean => id.startsWith(NOTE_ID_PREFIX);

/** 문자열 → uint32 (FNV-1a). 카드 id로 흔들림을 시드와 섞는 데 쓴다. 정수 연산뿐이라 환경에 따라 달라지지 않는다. */
function hashId(id: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/**
 * 카드가 뜨기 시작하는 나이의 흔들림: `최소 + (mixSeed(시드, 카드 id 해시) % 폭)`. 같은 시드 → 같은 나이라 새로고침해도 같다.
 * `asap` 카드는 나이 창의 첫 해다.
 */
export function noteJitterAge(card: NoteCardDef, seed: number): number {
  if (card.timing === 'asap') return card.ageRange.min;
  const { min, max } = card.timing.jitter;
  return min + (mixSeed(seed, hashId(card.id)) % (max - min + 1));
}

const matchesWhen = (when: NoteCondition, ctx: CondContext): boolean => (Array.isArray(when) ? when.some((c) => meetsCondition(c, ctx)) : meetsCondition(when, ctx));

/** 이 카드의 변형 조건이 지금 맞는가 — 맞으면 흔들림을 기다리지 않고 바로 뜬다(「더 일찍 뜨는」 조건) */
function variantMatches(card: NoteCardDef, ctx: CondContext): boolean {
  return (card.variants ?? []).some((v) => matchesWhen(v.when, ctx));
}

/** 이 카드가 지금 상태에서 적격인가(나이 창·시대·조건·적격 갈래·제외 이벤트). 때(timing)와 간격은 보지 않는다 */
function eligible(card: NoteCardDef, game: GameState, ctx: CondContext): boolean {
  const age = game.age;
  if (age < card.ageRange.min || age > card.ageRange.max) return false;
  if (card.eras !== undefined && game.era !== null && !card.eras.includes(game.era)) return false;
  if (!meetsCondition(card.conditions, ctx)) return false;
  for (const id of card.unlessSeen ?? []) if (lastSeenAge(game.seen, id) !== undefined) return false;
  if (card.triggers !== undefined) {
    const some = card.triggers.some(
      (t) =>
        (t.conditions === undefined || meetsCondition(t.conditions, ctx)) &&
        (t.seenAny === undefined || t.seenAny.some((id) => lastSeenAge(game.seen, id) !== undefined)) &&
        (t.minAge === undefined || age >= t.minAge),
    );
    if (!some) return false;
  }
  return true;
}

/**
 * 지금 뜰 차례인 기록 카드(없으면 null). 순수 함수 — 난수·시각을 쓰지 않는다.
 * 조건: 인생(life) 단계이고 대기 중인 선택지가 없을 때만(해의 첫머리 — 결정 카드는 해의 끝에 뽑혀 두 시트가 동시에 열리지 않는다, NC-7).
 * 이미 본 카드(`seen`의 `note-…` 키)는 다시 안 뜨고, 판당 자동 카드는 최대 `NOTE_LIMITS.autoCards`(7), 마지막 자동 카드와 `gapYears`(2년) 이상 떨어져야 한다 → 한 해 최대 1장.
 * 같은 해에 둘 이상 적격이면 카드 번호가 작은 쪽이 먼저고, 간격 때문에 못 뜬 카드는 자기 나이 창 안의 다음 적격 해로 넘어간다(창이 끝나면 사라진다).
 * 때(timing): `asap`은 적격이 된 첫 해, `jitter`는 흔들림 나이(`noteJitterAge`) 이후의 첫 적격 해이고, 변형 조건이 먼저 맞으면 바로 뜬다.
 */
export function dueNote(game: GameState, cards: readonly NoteCardDef[] = NOTE_CARDS): NoteCardDef | null {
  if (game.phase !== 'life' || game.pending !== null || game.character === null || game.era === null) return null;
  const age = game.age;
  let shown = 0;
  let lastAge = Number.NEGATIVE_INFINITY;
  for (const [id, at] of Object.entries(game.seen)) {
    if (!isNoteKey(id)) continue;
    shown++;
    if (at > lastAge) lastAge = at;
  }
  if (shown >= NOTE_LIMITS.autoCards || age - lastAge < NOTE_LIMITS.gapYears) return null;
  const ctx = condContextOf(game);
  for (const card of cards) {
    if (lastSeenAge(game.seen, card.id) !== undefined) continue;
    if (!eligible(card, game, ctx)) continue;
    if (card.timing !== 'asap' && !variantMatches(card, ctx) && age < noteJitterAge(card, game.seed)) continue;
    return card;
  }
  return null;
}

/** 카드를 소비한다(`seen`에 표시, 연표 줄 없음 = 「마음속에 담고 살기」). 스탯·자산·플래그·`rngState`는 건드리지 않는다. 이미 본 카드면 같은 객체. */
export function consumeNote(game: GameState, card: Pick<NoteCardDef, 'id'>): GameState {
  return lastSeenAge(game.seen, card.id) !== undefined ? game : { ...game, seen: { ...game.seen, [card.id]: game.age } };
}

/** `{이름}`을 주인공 이름으로 바꾼다 */
export function fillNoteName(prompt: string, name: string): string {
  return prompt.replaceAll('{이름}', name);
}

/** 카드가 지금 상태에서 묻는 질문(변형이 맞으면 첫 일치 변형, 아니면 기본 문장). 이름은 아직 바꾸지 않은 원문이다 */
export function notePromptOf(card: NoteCardDef, game: GameState): string {
  if (game.character === null || card.variants === undefined) return card.prompt;
  const ctx = condContextOf(game);
  return card.variants.find((v) => matchesWhen(v.when, ctx))?.prompt ?? card.prompt;
}

/** 화면에 보일 질문: 변형 선택 + 이름 채우기. 수동 기록(`card === null`)은 고정 질문이다 */
export function noteQuestion(card: NoteCardDef | null, game: GameState, manual: NoteManualDef = NOTE_MANUAL): string {
  const name = game.character?.name ?? '';
  return fillNoteName(card === null ? manual.prompt : notePromptOf(card, game), name);
}

// ---------- 쓴 글 ----------

/** 쓴 글 한 건 (`notes` 목록은 연표 `note` 줄에서 파생한다 — 저장 필드가 아니다, NC-1) */
export interface NoteEntry {
  age: number;
  /** 자동 카드 id, 「생각 남기기」 버튼으로 쓴 글이면 null */
  cardId: string | null;
  text: string;
}

export const isNoteRow = (h: HistoryEntry): boolean => h.kind === 'note';

/** 이 인생에 쓴 글(시간순) */
export function notesOf(game: Pick<GameState, 'history'>): NoteEntry[] {
  return game.history.filter(isNoteRow).map((h) => ({ age: h.age, cardId: h.eventId === undefined || h.eventId === MANUAL_NOTE_ID ? null : h.eventId, text: h.text }));
}

/** 이 인생에 쓴 글의 수 (한도 NOTE_LIMITS.total) */
export function noteCount(game: Pick<GameState, 'history'>): number {
  return game.history.reduce((n, h) => (isNoteRow(h) ? n + 1 : n), 0);
}

/** 연표에서 기록 줄을 뺀 줄 수 — 한 해 진행 시계의 `resetKey`에 넣는다(수동 기록 한 줄이 올해 진행률을 되감지 않게, 5-3절) */
export function lifeLineCount(history: readonly HistoryEntry[]): number {
  return history.reduce((n, h) => (isNoteRow(h) ? n : n + 1), 0);
}

export interface WriteNoteInput {
  /** 자동 카드 id(지금 뜰 차례인 카드여야 한다) 또는 null(「생각 남기기」 수동 기록) */
  cardId: string | null;
  /** 입력란의 글(원문 — 여기서 `finalizeNote`로 정규화한다) */
  text: string;
  /** 열 때의 기록 수 — 이미 늘어난 상태면 두 번째 제출을 무시한다(연타·더블탭 → 1건, 5-2절) */
  expectCount?: number;
}

/**
 * 「적어두고 살기」: 글을 정규화해 연표에 `note` 줄로 더하고(자동 카드면 소비 표시도), 아무것도 못 하면 같은 객체를 돌려준다. 못 하는 경우:
 * 인생 단계가 아님 · 글이 문자열이 아님 · 한 인생의 기록이 이미 40개 · `expectCount`와 기록 수가 다름 · 자동 카드가 지금 뜰 차례의 카드가 아님(이미 소비됨) · 정규화한 글이 비어 있음.
 * 스탯·자산·플래그·`rngState`는 건드리지 않는다. 글을 에러 메시지·로그에 넣지 않는다(P3).
 */
export function writeNote(game: GameState, input: WriteNoteInput, cards: readonly NoteCardDef[] = NOTE_CARDS, manual: NoteManualDef = NOTE_MANUAL): GameState {
  if (game.phase !== 'life' || game.character === null || typeof input.text !== 'string') return game;
  const count = noteCount(game);
  if (count >= NOTE_LIMITS.total) return game;
  if (input.expectCount !== undefined && input.expectCount !== count) return game;
  let topic = manual.topic;
  let eventId = MANUAL_NOTE_ID;
  let limit: number = NOTE_LIMITS.graphemes;
  let seen = game.seen;
  if (input.cardId !== null) {
    const due = dueNote(game, cards);
    if (due === null || due.id !== input.cardId) return game;
    topic = due.topic;
    eventId = due.id;
    limit = Math.min(limit, due.maxLength ?? limit);
    seen = { ...game.seen, [due.id]: game.age };
  }
  const note = finalizeNote(input.text, limit);
  if (note.empty) return game;
  return { ...game, seen, history: appendHistory(game.history, { age: game.age, kind: 'note', title: topic, text: note.text, eventId }) };
}
