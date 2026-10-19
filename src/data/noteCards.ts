import { validateNoteFile, type NoteCardDef, type NoteFile, type NoteManualDef } from '../core/noteCards';
import notesJson from './notes.json';

/**
 * 기록 카드 데이터 로더. `src/data/notes.json`을 읽어 앱이 뜰 때(그리고 테스트·빌드에서) 바로 검증한다 — 잘못된 데이터는 이벤트 데이터(src/data/events/index.ts)와 같이 문제 목록과 함께 드러난다.
 * 문구 점검(`lintNoteFile`)과 이벤트 풀과의 교차 점검(`noteCardPoolProblems`)은 `npm run check:events`(빌드의 일부)와 `npm test`가 한다.
 */
export const NOTE_FILE_RAW: unknown = notesJson;

const FILE: NoteFile = validateNoteFile(NOTE_FILE_RAW);

/** 기록 카드 7종 (카드 번호 순) */
export const NOTE_CARDS: readonly NoteCardDef[] = Object.freeze(FILE.cards);
/** 수동 기록(「생각 남기기」 버튼)의 고정 질문과 연표 라벨 주제 */
export const NOTE_MANUAL: NoteManualDef = Object.freeze({ ...FILE.manual });
