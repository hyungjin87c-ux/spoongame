import { NOTE_LIMITS, finalizeNote, liveGraphemes } from '../core';
import { NOTE_TEXT } from '../data/noteSheetText';

/**
 * 기록 입력란의 순수 보조 함수 (SPEC-003 M7c FR3, docs/data/content-M7c.md 3-5·6-2절) — DOM 없이 단위 테스트한다(tests/noteSheet.test.tsx).
 */

/** 남은 글자가 이만큼에 닿을 때 「20자 남았습니다.」 (6-2절) */
export const REMAINING_NOTICE_AT = 20;

/** 줄 수: 줄바꿈으로 가른 칸 수 (입력 중이라 끝의 빈 줄도 센다) */
export function lineCount(text: string): number {
  return text.split('\n').length;
}

/**
 * 입력이 바뀐 직후 알림 줄(role=status)에 띄울 문장 — 글자마다 읽지 않도록 **다음 순간에만** 있고 그 밖에는 빈 글자다(6-2절).
 *  1. 잘렸다(붙여넣기·조합 끝·141번째 글자): 「140자까지 적을 수 있어 넘는 부분은 줄였습니다.」
 *  2. 140에 닿았다: 「140자까지 적었습니다.」
 *  3. 남은 글자가 20이 되었다: 「20자 남았습니다.」
 *  4. 줄이 3줄에 닿았다: 「줄은 세 줄까지 적을 수 있습니다.」 (또는 붙여넣은 줄이 넘쳐 이어 붙었다)
 * `prev`는 직전 입력란 값, `raw`는 브라우저가 준 값(정리 전), `next`는 `sanitizeLive(raw)` 결과.
 */
export function inputNotice(prev: string, raw: string, next: string, limit: number = NOTE_LIMITS.graphemes): string {
  const f = finalizeNote(raw, limit);
  if (f.truncated) return NOTE_TEXT.truncated(limit);
  const before = liveGraphemes(prev, limit);
  const now = liveGraphemes(next, limit);
  if (now >= limit && before < limit) return NOTE_TEXT.reachedMax(limit);
  if (now >= limit - REMAINING_NOTICE_AT && before < limit - REMAINING_NOTICE_AT) return NOTE_TEXT.remaining(REMAINING_NOTICE_AT);
  if (f.linesMerged || (lineCount(next) >= NOTE_LIMITS.lines && lineCount(prev) < NOTE_LIMITS.lines)) return NOTE_TEXT.linesFull;
  return '';
}

/**
 * 입력란 값이 `raw`에서 `next`로 정리되어 바뀌었을 때 캐럿을 둘 자리. 값이 바뀌지 않았으면 브라우저의 캐럿(`selStart`)을 그대로 둔다.
 * 바뀌었다면 바뀐 곳이 캐럿 뒤(끝이 잘린 경우)면 그대로, 앞(걷어 낸 글자)이면 걷어 낸 만큼 당긴다. 항상 `next` 길이 안이다.
 */
export function caretAfterSanitize(raw: string, next: string, selStart: number): number {
  if (raw === next) return selStart;
  let p = 0;
  const max = Math.min(raw.length, next.length);
  while (p < max && raw.charCodeAt(p) === next.charCodeAt(p)) p++;
  const caret = p >= selStart ? selStart : Math.max(p, selStart - (raw.length - next.length));
  return Math.max(0, Math.min(next.length, caret));
}

/** 「적어두고 살기」(1번)를 눌렀을 때: 빈 입력(공백만·보이지 않는 글자만)이면 기록하지 않고 안내(`empty`), 아니면 저장(`save`) — 3-8절 A7 */
export function decideKeep(raw: string, limit: number = NOTE_LIMITS.graphemes): 'empty' | 'save' {
  return finalizeNote(raw, limit).empty ? 'empty' : 'save';
}

/**
 * 「마음속에 담고 살기」(2번)를 눌렀을 때: 글이 없거나 40개 안내 상태(`full`)면 확인 없이 닫는다(`dismiss`), 글이 있으면 확인 단계(`confirm`)를 연다 (5-2절).
 * Esc도 같은 판단을 쓴다.
 */
export function decideSkip(raw: string, full: boolean, limit: number = NOTE_LIMITS.graphemes): 'dismiss' | 'confirm' {
  if (full) return 'dismiss';
  return finalizeNote(raw, limit).empty ? 'dismiss' : 'confirm';
}

/** Esc를 눌렀을 때의 처분 입력 */
export interface EscContext {
  key: string;
  /** 키 이벤트가 IME 조합 중이었는가(`KeyboardEvent.isComposing`) */
  isComposing: boolean;
  /** 이 시트가 `compositionstart`~`compositionend` 사이임을 알고 있는가 (일부 브라우저는 마지막 keydown의 isComposing이 false다) */
  composing: boolean;
  /** 다른 처리기가 이미 처리했는가(`defaultPrevented`) */
  handled: boolean;
  /** 확인 단계가 열려 있는가 */
  confirm: boolean;
}

/**
 * Esc = 「마음속에 담고 살기」와 같다(글이 있으면 같은 확인) — 확인 단계에서는 돌아가기. IME 조합 중에는 무시한다(조합 취소가 시트를 닫지 않게, D-68·5-2절).
 * `ignore`면 아무것도 하지 않고 이벤트도 막지 않는다.
 */
export function decideEsc(ctx: EscContext): 'ignore' | 'back' | 'skip' {
  if (ctx.key !== 'Escape' || ctx.handled || ctx.isComposing || ctx.composing) return 'ignore';
  return ctx.confirm ? 'back' : 'skip';
}
