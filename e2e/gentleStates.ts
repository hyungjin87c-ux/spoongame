import { expect, type Page } from '@playwright/test';
import type { GameState } from '../src/core/types';
import { evalCore, withoutPlay } from './helpers';

/**
 * 무거운 장면 가리기 e2e의 상태 (SPEC-005 QI6, e2e/gentle.spec.ts): 개발 서버의 실제 core 모듈로 필요한 상태를 찾는다(같은 시드·같은 선택 → 같은 상태, 오라클).
 * 모든 상태는 플레이 시간 기록(`play`)을 뺀다(`withoutPlay`).
 */

/**
 * 부모님의 임종(`middle-parents-farewell`)을 고르고 상속을 받은 뒤 66세인 **일시정지한** 인생 — 인생 기록에 무거운 줄(결정 줄·상속 줄·그 밖의 사건)이 쌓여 있고 시간이 흐르지 않아 화면이 그대로 머문다.
 * 식구 카드는 「세상을 떠남」을 그린다(HV8 확인용).
 */
export async function heavyLifeState(page: Page): Promise<GameState> {
  const s = await evalCore<GameState | null>(
    page,
    `for (let seed = 1; seed <= 2000; seed++) {
       let s = core.enterLife(core.enterBirth(core.beginBirth(core.createInitialState(seed), 'present')));
       let farewell = false;
       while (s.phase === 'life' && s.age < 66) {
         if (s.pending !== null) {
           if (s.pending.eventId === 'middle-parents-farewell') farewell = true;
           s = core.resolveChoiceStep(s, s.pending.key, s.pending.choiceIds[0]).state;
         } else s = core.stepYear(s).state;
       }
       const heavy = s.history.filter((h) => core.heavyKindOfEntry(h) !== null);
       if (s.phase === 'life' && farewell && s.pending === null && heavy.length >= 4 && s.history.some((h) => h.text === arg.inherit)) return { ...s, paused: true };
     }
     return null;`,
    { inherit: '부모님이 남기신 재산을 물려받았습니다.' },
  );
  expect(s, '임종·상속을 지난 무거운 줄이 쌓인 인생을 찾지 못했다').not.toBeNull();
  return withoutPlay(s!);
}

/**
 * 이벤트 하나가 **사람이 고르는 결정으로 대기 중인** 인생. 부모·흘러감 카드는 대기가 되지 않으므로(SPEC-005 PD) 이 도우미는 본인이 고르는 나이대의 이벤트에만 쓴다.
 * **실제로 그 나이까지 산 인생**에서 대기 카드를 직접 놓는다 — 20세 이상 판은 자산이 있어야 저장 검증을 통과한다(tests/helpers/forcedPending.ts는 서버 렌더만 보므로 0세 상태에서 나이만 옮겨 쓰지만 e2e는 앱이 저장을 읽는다).
 */
export async function heavyPending(page: Page, eventId: string, opts: { era?: 'past' | 'present' | 'future'; age?: number } = {}): Promise<GameState> {
  const s = await evalCore<GameState | null>(
    page,
    `const mod = await import('/src/data/events/index.ts');
     const ev = mod.EVENT_POOL.byId.get(arg.eventId);
     const ages = core.possibleAgesOf(ev);
     const target = arg.age ?? ages[Math.floor(ages.length / 2)];
     for (let seed = 1; seed <= 800; seed++) {
       let s = core.enterLife(core.enterBirth(core.beginBirth(core.createInitialState(seed), arg.era)));
       while (s.phase === 'life' && s.age < target) {
         if (s.pending !== null) s = core.resolveChoiceStep(s, s.pending.key, s.pending.choiceIds[0]).state;
         else s = core.stepYear(s).state;
       }
       if (s.phase !== 'life' || s.age !== target) continue;
       const visible = core.visibleChoices(ev, core.condContextOf(s));
       if (visible.length < 2) continue;
       return { ...s, seen: { ...s.seen, [arg.eventId]: target }, lastChoiceAge: target, pending: { eventId: arg.eventId, key: arg.eventId + '@' + target, age: target, choiceIds: visible.map((c) => c.id) } };
     }
     return null;`,
    { eventId, era: opts.era ?? 'present', age: opts.age ?? null },
  );
  expect(s, `${eventId}: 보이는 선택지가 2개 이상인 대기 상태를 찾지 못했다`).not.toBeNull();
  return withoutPlay(s!);
}

/** 연표에 무거운 줄(부모님이 정한 줄 포함)이 여럿 든 판이 막 끝난 엔딩 상태 */
export async function heavyEnding(page: Page): Promise<GameState> {
  const s = await evalCore<GameState | null>(
    page,
    `for (let seed = 1; seed <= 400; seed++) {
       const start = core.enterLife(core.enterBirth(core.beginBirth(core.createInitialState(seed), 'present')));
       const end = core.playToEnd(start, (s) => s.pending.choiceIds[0]).state;
       const heavy = end.history.filter((h) => core.heavyKindOfEntry(h) !== null);
       if (heavy.length >= 4 && heavy.some((h) => h.by !== undefined)) return end;
     }
     return null;`,
  );
  expect(s, '무거운 줄이 여럿 든 엔딩을 찾지 못했다').not.toBeNull();
  return withoutPlay(s!);
}

/** 무거운 장면 줄의 분류 이름과 원문을 알려 주는 오라클: 이 상태의 연표에서 무거운 줄만 {나이·종류·문장·고른 길·분류} */
export interface HeavyRow {
  age: number;
  kind: string;
  text: string;
  choice: string | null;
  heavyKind: string;
  by: string | null;
}

export async function heavyRowsOf(page: Page, game: GameState): Promise<HeavyRow[]> {
  return evalCore<HeavyRow[]>(
    page,
    `return arg.history.map((h) => ({ h, k: core.heavyKindOfEntry(h) })).filter((x) => x.k !== null).map(({ h, k }) => ({ age: h.age, kind: h.kind, text: h.text, choice: h.choice ?? null, heavyKind: k, by: h.by ?? null }));`,
    { history: game.history },
  );
}

/**
 * 기록 카드 `cardId`가 **지금 뜰 차례인** 일시정지한 인생 (R-490 — 기록 카드 ⑤ `note-illness`·⑥ `note-parents-aging`). 시드를 늘려 가며 선택지는 자동으로 풀고, 앞서 뜰 차례가 된 다른 카드는 소비(`consumeNote`)해 넘겨
 * 대상 카드가 처음 뜰 차례가 되는 해에서 멈춘다. 그대로 주입하면 로드와 동시에 기록 시트가 열린다(새로고침 복원과 같은 경로, e2e/m7cStates.ts#dueState와 같은 방법).
 */
export async function noteDueState(page: Page, cardId: string): Promise<GameState> {
  const s = await evalCore<GameState | null>(
    page,
    `for (let seed = 1; seed <= 1500; seed++) {
       let s = core.enterLife(core.enterBirth(core.beginBirth(core.createInitialState(seed), 'present')));
       for (let guard = 0; guard < 900 && s.phase === 'life'; guard++) {
         if (s.pending !== null) { s = core.autoResolveStep(s, s.pending.key).state; continue; }
         const due = core.dueNote(s);
         if (due !== null) {
           if (due.id === arg.cardId) return { ...s, paused: true };
           s = core.consumeNote(s, due);
         }
         s = core.stepYear(s).state;
       }
     }
     return null;`,
    { cardId },
  );
  expect(s, `${cardId}: 뜰 차례인 인생을 찾지 못했다`).not.toBeNull();
  return withoutPlay(s!);
}
