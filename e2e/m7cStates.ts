import { expect, type Page } from '@playwright/test';
import type { GameState, GenerationId as Era } from '../src/core/types';
import { evalCore, readSave } from './helpers';

/**
 * M7c 기록 카드 e2e의 상태 도우미 (SPEC-003 M7c). 앱 페이지가 열려 있어야 한다 — 개발 서버의 실제 core 모듈을 브라우저에서 불러 상태를 만든다(`evalCore`).
 * 기록 카드는 해의 첫머리에 뜨므로(`dueNote`는 대기 중인 선택지가 없을 때만 적격) 「뜰 차례인 상태」는 그대로 주입하면 로드와 동시에 시트가 열린다(새로고침 복원과 같다).
 * 그 상태의 설정은 e2e 기본이 `noteCards: false`이므로 기록 시험은 `{ speed, autoMode, noteCards: true }`를 명시한다.
 */

export interface DueState {
  state: GameState;
  /** 지금 뜰 차례인 카드 id */
  cardId: string;
}

/**
 * 기록 카드가 지금 뜰 차례인 인생 상태. 시드를 늘려 가며 선택지는 자동으로 풀면서 해를 넘겨, 나이 `minAge` 이상에서 `cardId`(없으면 아무 카드)가 처음 뜰 차례가 되는 상태를 돌려준다.
 */
export async function dueState(page: Page, opts: { minAge?: number; cardId?: string; era?: Era; fromSeed?: number } = {}): Promise<DueState> {
  const found = await evalCore<DueState | null>(
    page,
    `for (let seed = arg.fromSeed; seed < arg.fromSeed + 600; seed++) {
       let s = core.enterLife(core.enterBirth(core.beginBirth(core.createInitialState(seed), arg.era)));
       for (let guard = 0; guard < 800 && s.phase === 'life'; guard++) {
         if (s.pending !== null) { s = core.autoResolveStep(s, s.pending.key).state; continue; }
         if (s.age >= arg.minAge) {
           const due = core.dueNote(s);
           if (due !== null && (arg.cardId === null || due.id === arg.cardId)) return { state: s, cardId: due.id };
         }
         s = core.stepYear(s).state;
       }
     }
     return null;`,
    { minAge: opts.minAge ?? 0, cardId: opts.cardId ?? null, era: opts.era ?? 'alpha', fromSeed: opts.fromSeed ?? 1 },
  );
  expect(found, `기록 카드가 뜰 차례인 상태를 찾지 못했다 (${JSON.stringify(opts)})`).not.toBeNull();
  return found!;
}

/** 첫 기록 카드 ①(영유아기 기억, 5세, 인용 c-102 있음)이 뜰 차례인 상태 */
export const infantDue = (page: Page, era: Era = 'alpha'): Promise<DueState> => dueState(page, { cardId: 'note-infant-memory', era });

/** 인용이 없는 카드(②~⑦)가 뜰 차례인 상태 — 나이 13 이상 */
export const teenDue = (page: Page, era: Era = 'alpha'): Promise<DueState> => dueState(page, { minAge: 13, cardId: 'note-teen-envy', era });

/**
 * 결정 카드를 고르면 곧바로 다음 해의 기록 카드가 뜰 차례가 되는 상태 (content-M7c 5-4절 둘째 행): 대기 중인 선택지가 있는 상태 + 고를 선택지.
 * 결정 카드는 해의 끝에 뽑히고 기록 카드는 다음 해의 첫머리에 뜨므로 두 시트가 동시에 열리지 않고 결정 시트 → 기록 시트로 이어진다.
 */
export async function decisionBeforeDue(page: Page, opts: { era?: Era; fromSeed?: number } = {}): Promise<{ state: GameState; choiceId: string; key: string; cardId: string }> {
  const found = await evalCore<{ state: GameState; choiceId: string; key: string; cardId: string } | null>(
    page,
    `for (let seed = arg.fromSeed; seed < arg.fromSeed + 800; seed++) {
       let s = core.enterLife(core.enterBirth(core.beginBirth(core.createInitialState(seed), arg.era)));
       for (let guard = 0; guard < 800 && s.phase === 'life'; guard++) {
         if (s.pending !== null) {
           const choiceId = s.pending.choiceIds[0];
           const after = core.resolveChoice(s, s.pending.key, choiceId);
           const due = after.phase === 'life' ? core.dueNote(after) : null;
           if (due !== null) return { state: s, choiceId, key: s.pending.key, cardId: due.id };
           s = core.autoResolveStep(s, s.pending.key).state;
           continue;
         }
         const due = core.dueNote(s);
         if (due !== null) s = core.consumeNote(s, due);
         s = core.stepYear(s).state;
       }
     }
     return null;`,
    { era: opts.era ?? 'alpha', fromSeed: opts.fromSeed ?? 1 },
  );
  expect(found, '결정 카드를 고르면 곧바로 기록 카드가 뜰 차례인 상태를 찾지 못했다').not.toBeNull();
  return found!;
}

/** 이미 기록 `count`개(수동)가 쌓인 인생 상태 — 40개 상한 시험용. 글은 `기록 {n}`이다 */
export async function withNotes(page: Page, state: GameState, count: number): Promise<GameState> {
  return evalCore<GameState>(
    page,
    `let g = arg.state;
     for (let i = 0; i < arg.count; i++) {
       const next = core.writeNote(g, { cardId: null, text: '기록 ' + (i + 1) });
       if (next === g) throw new Error('기록을 더할 수 없다: ' + i);
       g = next;
     }
     return g;`,
    { state, count },
  );
}

/** 저장된 게임의 note 줄들 */
export async function noteRows(page: Page): Promise<Array<{ age: number; kind: string; text: string; title?: string; eventId?: string }>> {
  const save = await readSave(page);
  return (save.data.history as Array<{ age: number; kind: string; text: string; title?: string; eventId?: string }>).filter((h) => h.kind === 'note');
}

/** 시트가 뜨고 두 버튼의 입력 가드(0.4초)가 풀릴 때까지 기다린다 */
export async function sheetReady(page: Page): Promise<void> {
  await expect(page.getByTestId('note-sheet')).toBeVisible();
  const save = page.getByTestId('note-save');
  const close = page.getByTestId('note-limit-close');
  await expect(save.or(close)).toBeEnabled();
}

/**
 * 짧은 결정 시트(선택지 2개·인용 없음)가 대기 중인 상태 — 시트 안에 스크롤이 없어(넘침 없음) 휠·키가 곧바로 문서로 넘어가는 최악의 경우 (T1 (b)(c)).
 */
export async function shortDecision(page: Page, era: Era = 'alpha'): Promise<GameState> {
  const found = await evalCore<GameState | null>(
    page,
    `const { EVENT_POOL } = await import('/src/data/events/index.ts');
     for (let seed = 1; seed < 3000; seed++) {
       let s = core.enterLife(core.enterBirth(core.beginBirth(core.createInitialState(seed), arg.era)));
       for (let guard = 0; guard < 80 && s.phase === 'life'; guard++) {
         s = core.advanceUntilDecision(s).state;
         if (s.phase !== 'life' || s.pending === null) break;
         const ev = EVENT_POOL.byId.get(s.pending.eventId);
         if (s.pending.choiceIds.length === 2 && ev !== undefined && core.citationIdFor(ev, 'present') === null && (ev.text ?? '').length < 120) return s;
         s = core.resolveChoice(s, s.pending.key, s.pending.choiceIds[0]);
       }
     }
     return null;`,
    { era },
  );
  expect(found, '짧은 결정 시트(선택지 2개·인용 없음)를 찾지 못했다').not.toBeNull();
  return found!;
}
