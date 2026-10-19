import {
  NOTE_LIMITS,
  createSession,
  dueNote,
  isNoteKey,
  noteCount,
  noteResponse,
  sessionReducer,
  type GameState,
  type NoteCardDef,
  type PlaySettings,
  type Session,
  type SessionAction,
  type Settings,
} from '../../src/core';

/**
 * 기록 카드 시험 도우미 (SPEC-003 M7c): 세션 reducer로 한 인생을 끝까지 몰되, 화면이 하는 일(적격 카드가 있으면 시트 응답을 보낸다)을 흉내 낸다.
 * 선택은 늘 첫 번째 선택지라 카드 응답 방식이 달라도 같은 선택을 한다 — 인생이 같은지 비교할 수 있다.
 */

/** 인생 상태에서 기록 카드가 건드리는 것(`seen`의 note- 키와 연표의 note 줄)을 뺀 비교용 모습 — 나머지 전부(스탯·자산·플래그·rngState·연표 …)가 같아야 한다 */
export function lifeView(g: GameState): Omit<GameState, 'seen' | 'history'> & { seen: Record<string, number>; history: GameState['history'] } {
  return {
    ...g,
    seen: Object.fromEntries(Object.entries(g.seen).filter(([id]) => !isNoteKey(id))),
    history: g.history.filter((h) => h.kind !== 'note'),
  };
}

export type NoteResponder = (card: NoteCardDef, s: Session) => SessionAction;

export const writeIt: NoteResponder = (card) => ({ type: 'saveNote', cardId: card.id, text: `${card.topic}에 남기는 글` });
export const skipIt: NoteResponder = (card) => ({ type: 'dismissNote', cardId: card.id });

export interface PlayOptions {
  settings?: Partial<Settings>;
  /** 수동 + 켜짐에서 카드가 뜰 차례일 때 보낼 응답 (기본: 글을 쓴다) */
  respond?: NoteResponder;
  /** 해마다 `advance`(기본) 대신 `skip`(다음 결정으로)으로 몬다 */
  useSkip?: boolean;
  /** 세션의 기록 카드 처리 (기본 live) */
  handling?: 'live' | 'ignore';
  /**
   * 선택지가 없는 해마다 수동 기록(도구 줄 「생각 남기기」)을 하나씩 더한다 — 기록이 40개에 이를 때까지(그 뒤는 상한이 막는다). 자동 카드 응답과 별개다.
   * 수동 기록은 `seen`·스탯·rngState를 건드리지 않아야 한다(관찰 2, M7c r2 r2-9).
   */
  manualNotes?: boolean;
}

export interface PlayResult {
  session: Session;
  /** 시트가 뜰 차례였던 카드(수동 + 켜짐일 때만 생긴다) */
  asked: Array<{ id: string; age: number }>;
}

/** 인생(life) 시작 상태에서 사망(ending)까지 세션 reducer로 몬다 */
export function playSession(start: GameState, options: PlayOptions = {}): PlayResult {
  const play: PlaySettings & Partial<Settings> = { speed: 1, autoMode: false, ...options.settings };
  let s = createSession(start, play);
  const asked: PlayResult['asked'] = [];
  const respond = options.respond ?? writeIt;
  const send = (a: SessionAction): Session => sessionReducer(s, a, undefined, options.handling ?? 'live');
  for (let guard = 0; s.game.phase === 'life'; guard++) {
    if (guard > 3000) throw new Error('playSession: 끝나지 않는다');
    const g = s.game;
    if (g.pending !== null) {
      const next = send({ type: 'choose', key: g.pending.key, choiceId: g.pending.choiceIds[0] });
      if (next === s) throw new Error('playSession: 선택이 적용되지 않았다');
      s = next;
      continue;
    }
    const due = options.handling === 'ignore' ? null : dueNote(g);
    if (due !== null && noteResponse(s.settings, g) === 'stop') {
      asked.push({ id: due.id, age: g.age });
      const next = send(respond(due, s));
      if (next === s) throw new Error(`playSession: 카드 응답이 적용되지 않았다 (${due.id})`);
      s = next;
      continue;
    }
    if (options.manualNotes === true && noteCount(g) < NOTE_LIMITS.total) {
      // 도구 줄 「생각 남기기」 → 시트 열 때의 기록 수를 들고(expectCount) 1번. 받아들여지지 않으면 시험 도우미의 잘못이다
      const written = send({ type: 'saveNote', cardId: null, text: `수동 기록 ${noteCount(g) + 1}`, expectCount: noteCount(g) });
      if (written === s) throw new Error(`playSession: 수동 기록이 적용되지 않았다 (나이 ${g.age})`);
      s = written;
    }
    const next = send(options.useSkip === true ? { type: 'skip' } : { type: 'advance', fromAge: s.game.age });
    if (next === s) throw new Error(`playSession: 진행이 멈췄다 (나이 ${g.age})`);
    s = next;
  }
  return { session: s, asked };
}
