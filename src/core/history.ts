import { HISTORY_LIMITS } from '../data/lifeTable';
import type { HistoryEntry } from './types';

/**
 * 생애 연표 기록. 저장 용량이 무한히 늘지 않도록 상한을 둔다(data/lifeTable.ts#HISTORY_LIMITS).
 * 정상 플레이에서는 상한에 닿지 않는다(해마다 이벤트는 최대 하나). 넘치면:
 *   1) 가장 오래된 서술 이벤트(선택이 없는 것)부터, 2) 그다음 가장 오래된 선택지 기록,
 *   3) 그다음 첫 항목(출생)과 사망을 뺀 가장 오래된 단계 기록 순으로 버린다.
 * 출생 기록(맨 앞)과 사망 기록은 끝까지 남긴다.
 */

function clip(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

/** 길이 상한을 지킨 항목(원본은 건드리지 않는다) */
export function clipEntry(e: HistoryEntry): HistoryEntry {
  const out: HistoryEntry = { ...e, text: clip(e.text, HISTORY_LIMITS.maxTextLength) };
  if (e.title !== undefined) out.title = clip(e.title, HISTORY_LIMITS.maxTitleLength);
  if (e.choice !== undefined) out.choice = clip(e.choice, HISTORY_LIMITS.maxChoiceLength);
  return out;
}

export function appendHistory(history: readonly HistoryEntry[], entry: HistoryEntry): HistoryEntry[] {
  const next = [...history, clipEntry(entry)];
  while (next.length > HISTORY_LIMITS.maxEntries) {
    // 맨 앞(출생)은 건너뛰고 찾는다. 마지막(방금 넣은 항목)도 버리지 않는다.
    const droppable = (kind: HistoryEntry['kind']) => {
      for (let i = 1; i < next.length - 1; i++) if (next[i].kind === kind) return i;
      return -1;
    };
    let i = droppable('event');
    if (i === -1) i = droppable('choice');
    if (i === -1) i = droppable('stage');
    if (i === -1) i = 1; // 남은 것이 사망뿐인 극단적인 경우: 출생 다음 항목
    next.splice(i, 1);
  }
  return next;
}
