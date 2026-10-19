import { usedByIndex, type CitedCard } from '../src/core/citations';
import type { EventDef } from '../src/core/events';

/**
 * `src/data/citations.json`의 `usedBy`(인용 → 그 인용을 쓰는 이벤트)를 이벤트의 `citation`에서 다시 만드는 순수 함수 (SPEC-003 M7b, 마스터 결정 M-5).
 * 파일을 읽고 쓰는 쪽은 `scripts/syncCitations.ts`(`npm run gen:citations`·`check:citations`)이고, 시험(tests/citationLink.test.ts)도 이 함수를 불러 저장소 파일과 같은지 본다.
 * JSON의 손으로 정리한 서식(한 줄 `refs`·`facts`)을 지키려고 파일을 다시 직렬화하지 않고 `usedBy` 항목만 글자 단위로 바꾼다. `candidateEvents`는 M7b에서 없어졌다(후보 기록의 역할이 `usedBy`로 넘어갔다).
 */

/** 인용 하나의 `usedBy` 항목 글자 (키 들여쓰기 6칸, 항목 8칸) */
function usedByText(ids: readonly string[]): string {
  return ids.length === 0 ? '      "usedBy": []' : `      "usedBy": [\n${ids.map((id) => `        "${id}"`).join(',\n')}\n      ]`;
}

/** 파일 글자를 받아 `usedBy`를 이벤트(와 기록 카드 `notes` — M7c, id `note-…`)의 `citation` 역색인으로 바꾸고 `candidateEvents`를 지운 글자를 돌려준다 */
export function syncedCitationsText(text: string, events: readonly EventDef[], notes: readonly CitedCard[] = []): string {
  const index = usedByIndex(events, notes);
  const parts = text.split(/(?=\n    \{\n      "(?:id|kind)": )/);
  const out = [parts[0]];
  for (const part of parts.slice(1)) {
    const id = /"id": "(c-\d+)"/.exec(part)![1];
    let b = part.replace(/\n {6}"candidateEvents": \[[^\]]*\],\n/, '\n');
    if (!/\n {6}"usedBy": \[[^\]]*\]/.test(b)) throw new Error(`${id}: usedBy 항목이 없다`);
    b = b.replace(/\n {6}"usedBy": \[[^\]]*\]/, `\n${usedByText(index[id] ?? [])}`);
    out.push(b);
  }
  return out.join('');
}
