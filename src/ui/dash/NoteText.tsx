import type { HistoryEntry } from '../../core';
import { NOTE_MANUAL } from '../../data/noteCards';
import { NOTE_TEXT } from '../../data/noteSheetText';
import { Icon } from '../Brand';
import { FitPair } from '../FitPair';

/**
 * 「나의 기록」 줄의 부품 (SPEC-003 M7c FR4·FR5·FR9, D-69; docs/design/copy.md 7-4, 시안 mockups/note-rows.html) — **인생 기록(`LogCard`)과 엔딩 연표(`TimelineItem`)가 같은 부품을 쓴다.**
 *
 *  - 라벨 `NoteLabel`: 연필 아이콘(`aria-hidden`) + 「나의 기록 · {주제}」 — `FitPair hideSeparator`라 좁거나 글자가 크면 기호 없이 두 줄이고, 한 줄 모양의 가운뎃점은 접근성 트리에서 숨는다(낭독 「나의 기록 영유아기 기억」).
 *  - 글 `NoteText`: **사용자가 쓴 글**이다. `<bdi dir="auto" data-user-text>` 안에 React 텍스트 자식으로만 그린다(D1·D2) — `dangerouslySetInnerHTML`·`<a>`·`<img>`·`Glue`·`FitPair`·`<br>` 없음(D5), 줄바꿈은
 *    CSS `white-space: pre-line`이 보이고, 방향 글(히브리·아랍)이 라벨·나이의 순서를 끌고 가지 않으며, 전역 `word-break: keep-all` 대신 `word-break: normal` + `overflow-wrap: anywhere`(우리 문구가 아니므로
 *    어디서든 끊겨도 된다 — 낱말 끊김 감사는 `[data-user-text]`를 뺀다, design-system.md 11-8). 게임은 글을 읽지 않는다(S8) — 이 부품은 글자의 모양만 정한다.
 */

/** 연표 줄(`kind: 'note'`)의 주제 라벨. 주제는 게임이 만든 글(`HistoryEntry.title`)이고, 없으면 수동 기록의 주제 */
export function NoteLabel({ topic }: { topic: string }) {
  return (
    <span className="log__note-label" data-testid="note-label">
      <Icon name="i-pencil" className="icon--sm" /> <FitPair a={NOTE_TEXT.rowLabel} b={topic} hideSeparator />
    </span>
  );
}

/** 사용자가 쓴 글 한 덩어리 (두 화면 공통). `className`은 화면별 추가 클래스(엔딩 연표의 `tl-text`) */
export function NoteText({ text, className }: { text: string; className?: string }) {
  return (
    <bdi className={className === undefined ? 'note-text' : `${className} note-text`} dir="auto" data-user-text="" data-testid="note-text">
      {text}
    </bdi>
  );
}

/** 라벨 + 글 (연표 줄의 문장 칸 안쪽) */
export function NoteBody({ entry, textClassName }: { entry: Pick<HistoryEntry, 'title' | 'text'>; textClassName?: string }) {
  return (
    <>
      <NoteLabel topic={entry.title ?? NOTE_MANUAL.topic} />
      <NoteText text={entry.text} className={textClassName} />
    </>
  );
}
