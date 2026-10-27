import { expect, type Page } from '@playwright/test';
import type { GameState } from '../src/core/types';
import { KNOWN_SEED, evalCore, injectSave, lifeState, startPageHidden } from './helpers';
import { dueState, infantDue, sheetReady, withNotes } from './m7cStates';

/**
 * M7c 기록 시트의 감사용 상태 (포커스 가림·글자 확대·낱말 끊김·색 e2e가 함께 쓴다). 모두 가려진 탭처럼 시간을 멈춘 채 연다(시계가 측정에 끼어들지 않게).
 *  - open: 저절로 뜬 카드 ①(인용 박스 있음 — 가장 높은 시트)  - confirm: 글을 쓰다 「마음속에 담고 살기」를 눌러 확인 단계  - limit: 기록 40개 뒤 「생각 남기기」(안내 + 닫기)
 */

export type NoteUi = 'open' | 'confirm' | 'limit';
export const NOTE_UI_STATES: readonly NoteUi[] = ['open', 'confirm', 'limit'];

/** 시트에 보일 카드: ① 영유아기 기억(인용 박스 있음) / ③ 첫사랑(가장 긴 질문 + 주인공 이름 5글자) */
export type NoteSubject = 'infant' | 'long-question';

const MANUAL = { speed: 1, autoMode: false, noteCards: true } as const;
const OFF = { speed: 1, autoMode: false, noteCards: false } as const;

/** 이름을 허용 최대 길이(한글 5글자, 풀 갱신이 저장을 무효화하지 않게 한 core의 패턴)로 바꾼다 */
function longName(state: GameState): GameState {
  return { ...state, character: { ...state.character!, name: '남궁민준이' } };
}

/** 한 번 앱 페이지를 가려진 탭으로 연다 (같은 page로 상태를 갈아 끼울 때 injectSave가 새로 연다) */
export async function startNoteHidden(page: Page): Promise<void> {
  await startPageHidden(page);
  await page.goto('/');
}

/** 상태를 심고 기록 시트를 해당 모습으로 연다. 입력 가드가 풀린 뒤 돌려준다 */
export async function openNoteIn(page: Page, ui: NoteUi, subject: NoteSubject = 'infant'): Promise<void> {
  if (ui === 'limit') {
    const full = await withNotes(page, lifeState(KNOWN_SEED), 40);
    await injectSave(page, full, '/', OFF);
    await expect(page.getByTestId('tool-note')).toBeEnabled();
    await page.evaluate(() => (document.querySelector('[data-testid="tool-note"]') as HTMLElement).click());
    await sheetReady(page);
    await expect(page.getByTestId('note-limit-close')).toBeVisible();
    return;
  }
  const due = subject === 'infant' ? await infantDue(page) : await dueState(page, { cardId: 'note-first-love', minAge: 15 });
  await injectSave(page, subject === 'infant' ? due.state : longName(due.state), '/', MANUAL);
  await sheetReady(page);
  if (ui === 'confirm') {
    await page.getByTestId('note-input').fill('쓰다 만 글입니다. 확인 단계를 보려고 적었습니다.');
    await page.getByTestId('note-skip').click();
    await expect(page.getByTestId('note-confirm')).toBeVisible();
    await expect(page.getByTestId('note-confirm-back')).toBeEnabled();
  }
}

/** 사용자 글 시험 문자열 — 줄바꿈 없는 긴 글·URL·방향 글·세 줄 */
export const LONG_NOTE_TEXTS: readonly string[] = [
  `https://${'a'.repeat(480)}`,
  '가'.repeat(140),
  `${'x'.repeat(50)}\n${'y'.repeat(50)}\n${'z'.repeat(30)}`,
  'שלום עולם, זה טקסט ארוך בעברית שממשיך עוד קצת ועוד קצת',
  'مرحبا بالعالم هذا نص عربي طويل يستمر قليلا وأكثر',
];

/** 인생 화면: 기록 줄(긴 글 5건)이 든 20세 이후 상태 (core의 writeNote로 만든다) */
export async function lifeWithLongNotes(page: Page): Promise<GameState> {
  return evalCore<GameState>(
    page,
    `let g = arg.state;
     for (const text of arg.texts) {
       const next = core.writeNote(g, { cardId: null, text });
       if (next === g) throw new Error('기록을 더할 수 없다');
       g = next;
     }
     return g;`,
    { state: lifeState(KNOWN_SEED), texts: LONG_NOTE_TEXTS },
  );
}

/** 엔딩 화면: 긴 글 기록이 든 끝난 인생 (자동 카드는 쓰고, 수동 기록은 나이를 나눠 더한다) */
export async function endedWithLongNotes(page: Page): Promise<GameState> {
  const state = await evalCore<GameState>(
    page,
    `let s = core.enterLife(core.enterBirth(core.beginBirth(core.createInitialState(arg.seed), 'alpha')));
     let i = 0;
     const marks = [12, 22, 33, 44, 55];
     for (let guard = 0; guard < 2000 && s.phase === 'life'; guard++) {
       if (s.pending !== null) { s = core.autoResolveStep(s, s.pending.key).state; continue; }
       const due = core.dueNote(s);
       if (due !== null) { const w = core.writeNote(s, { cardId: due.id, text: arg.texts[i % arg.texts.length] }); s = w === s ? core.consumeNote(s, due) : w; i++; }
       if (i < arg.texts.length && s.age >= marks[i]) { const w = core.writeNote(s, { cardId: null, text: arg.texts[i] }); if (w !== s) { s = w; i++; } }
       s = core.stepYear(s).state;
     }
     return s;`,
    { seed: KNOWN_SEED, texts: LONG_NOTE_TEXTS },
  );
  expect(state.phase).toBe('ending');
  expect(state.history.filter((h) => h.kind === 'note').length, '긴 글 기록 줄').toBeGreaterThanOrEqual(3);
  return state;
}
