import { expect, type Page } from '@playwright/test';
import type { GameState, GenerationId } from '../src/core/types';
import { evalCore, injectSave, startPageHidden } from './helpers';

/**
 * M5 선택지 영향 줄의 e2e 상태 (SPEC-003 EC5, CM10·CM11·QM2-10 규칙 4·QM3-1).
 *  - impact-young  20세 미만의 결정 대기: 첫 항목이 「집안 살림」, 선택지 중 영향 줄이 가장 긴 것이 4항목(집안 살림 · 관계 · 행복 · 지식 …)
 *  - impact-adult  20세 이상의 결정 대기: 선택지 3개 이상, 영향 줄이 가장 긴 선택지가 5항목(자산 · 부채 · 관계 · 행복 · …) — 이 판이 현재 이벤트 풀에서 만들 수 있는 가장 긴 줄이다
 * 상태는 앱 페이지가 연 개발 서버의 core로 찾는다(같은 시드·같은 선택 → 같은 상태, 오라클). 가려진 탭처럼 시간을 멈춰(startPageHidden) 연다.
 */
export type ImpactScreen = 'impact-young' | 'impact-adult';
export const IMPACT_SCREENS: readonly ImpactScreen[] = ['impact-young', 'impact-adult'];

/** 영향 줄이 가장 긴 선택지가 minItems 항목 이상이고 선택지가 3개 이상인 결정 대기 상태를 찾는다 (앱 페이지가 열려 있어야 한다) */
/** (기본 세대는 X세대: 알파는 20대 이후가 전망 구간이라 영향 줄이 긴 어른 카드 표본이 얇다 — SPEC-004 이전의 「지금 세상」 어른 카드 자리) */
export async function findImpactState(page: Page, kind: 'young' | 'adult', era: GenerationId = 'genx'): Promise<GameState> {
  const found = await evalCore<GameState | null>(
    page,
    `const { EVENT_POOL } = await import('/src/data/events/index.ts');
     const young = arg.kind === 'young';
     for (let seed = 1000; seed < 1400; seed++) {
       let s = core.enterLife(core.enterBirth(core.beginBirth(core.createInitialState(seed), arg.era)));
       for (let guard = 0; guard < 40 && s.phase === 'life'; guard++) {
         s = core.advanceUntilDecision(s).state;
         if (s.phase !== 'life' || s.pending === null) break;
         const okAge = young ? s.age >= 8 && s.age < 20 : s.age >= 22;
         if (okAge && s.pending.choiceIds.length >= 3) {
           const longest = Math.max(...core.previewPending(s, EVENT_POOL).map((p) => p.impact.items.length));
           if (longest >= arg.min) return s;
         }
         s = core.resolveChoice(s, s.pending.key, s.pending.choiceIds[0]);
       }
     }
     return null;`,
    { kind, era, min: kind === 'young' ? 4 : 5 },
  );
  expect(found, `${era}/${kind}: 영향 줄이 긴 결정 대기 상태를 찾지 못했다`).not.toBeNull();
  return found!;
}

/** 영향 줄이 있는 선택지 카드가 떠 있는 대시보드를 연다. 입력 가드가 풀린 뒤에 돌려준다. */
export async function openImpactScreen(page: Page, screen: ImpactScreen): Promise<GameState> {
  await startPageHidden(page);
  await page.goto('/');
  const state = await findImpactState(page, screen === 'impact-young' ? 'young' : 'adult');
  // 자동 모드 켜짐 = 비모달 인라인 카드(M7b): 진행 줄·도구 줄이 카드와 함께 닿는다(M5 측정이 버튼을 누른다). 모달 시트는 e2e/m7b-*가 잰다
  await injectSave(page, state, '/', { speed: 1, autoMode: true });
  await expect(page.getByTestId('choice-panel')).toBeVisible();
  await expect(page.getByTestId('auto')).toBeEnabled();
  await expect(page.getByTestId('impact').first()).toBeVisible();
  return state;
}

/** 선택지 카드의 영향 줄을 DOM에서 읽는다: 선택지마다 [{ key, direction, steps, text(sr-only 문장) }] */
export async function readImpactDom(page: Page): Promise<Array<{ choiceId: string; label: string; name: string; items: Array<{ key: string; direction: string; steps: number; sentence: string; shown: string }> }>> {
  return page.evaluate(() =>
    Array.from(document.querySelectorAll<HTMLElement>('[data-testid="choice-panel"] .choice')).map((btn) => ({
      choiceId: (btn.getAttribute('data-testid') ?? '').replace(/^choice-/, ''),
      label: btn.querySelector('.choice__label')?.textContent ?? '',
      name: '',
      items: Array.from(btn.querySelectorAll<HTMLElement>('.impact__item')).map((it) => ({
        key: it.getAttribute('data-key') ?? '',
        direction: it.getAttribute('data-direction') ?? '',
        steps: Number(it.getAttribute('data-steps')),
        sentence: it.querySelector('.sr-only')?.textContent ?? '',
        shown: (it.querySelector('.impact__show')?.textContent ?? '').replace(/\s+/g, ' ').trim(),
      })),
    })),
  );
}

/** 부모가 곧 세상을 떠나는 결정(middle-parents-farewell)이 대기 중인 상태 — 재력 `minWealth` 이상(상속이 보이는 크기) */
export async function findFarewellState(page: Page, minWealth = 4): Promise<GameState> {
  const found = await evalCore<GameState | null>(
    page,
    `for (let seed = 1000; seed < 2400; seed++) {
       let s = core.enterLife(core.enterBirth(core.beginBirth(core.createInitialState(seed), 'alpha')));
       if (s.character.parentWealth < arg.min) continue;
       for (let guard = 0; guard < 40 && s.phase === 'life'; guard++) {
         s = core.advanceUntilDecision(s).state;
         if (s.phase !== 'life' || s.pending === null) break;
         if (s.pending.eventId === 'middle-parents-farewell') return s;
         s = core.resolveChoice(s, s.pending.key, s.pending.choiceIds[0]);
       }
     }
     return null;`,
    { min: minWealth },
  );
  expect(found, '사별 결정이 대기 중인 상태를 찾지 못했다').not.toBeNull();
  return found!;
}

/**
 * 특정 이벤트가 결정을 기다리는 상태를 찾는다 (R-351·R-352 증거 샷용): 시드를 차례로 돌려 그 이벤트를 만날 때까지 앞선 결정은 첫 선택지로 넘긴다.
 * tier를 주면 부모 재력 단계가 그 값인 판만 본다. 앱 페이지가 열려 있어야 한다.
 */
export async function findPendingEvent(page: Page, eventId: string, opts: { era?: GenerationId; tier?: number; seedFrom?: number; seedTo?: number } = {}): Promise<GameState> {
  const found = await evalCore<GameState | null>(
    page,
    `for (let seed = arg.from; seed < arg.to; seed++) {
       let s = core.enterLife(core.enterBirth(core.beginBirth(core.createInitialState(seed), arg.era)));
       if (arg.tier !== null && s.character.parentWealth !== arg.tier) continue;
       for (let guard = 0; guard < 80 && s.phase === 'life'; guard++) {
         s = core.advanceUntilDecision(s).state;
         if (s.phase !== 'life' || s.pending === null) break;
         if (s.pending.eventId === arg.id) return s;
         s = core.resolveChoice(s, s.pending.key, s.pending.choiceIds[0]);
       }
     }
     return null;`,
    { id: eventId, era: opts.era ?? 'alpha', tier: opts.tier ?? null, from: opts.seedFrom ?? 1000, to: opts.seedTo ?? 6000 },
  );
  expect(found, `${eventId}${opts.tier ? ' 재력 ' + opts.tier : ''}: 결정을 기다리는 상태를 찾지 못했다`).not.toBeNull();
  return found!;
}

/** 20세 전에 끝난 인생(엔딩): 자동 진행으로 일찍 사망한 판 */
export async function findEarlyDeath(page: Page): Promise<GameState> {
  const found = await evalCore<GameState | null>(
    page,
    `for (let seed = 1; seed < 4000; seed++) {
       const start = core.enterLife(core.enterBirth(core.beginBirth(core.createInitialState(seed), 'alpha')));
       const end = core.playToEnd(start, null).state;
       if (end.phase === 'ending' && end.death.age < 20) return end;
     }
     return null;`,
  );
  expect(found, '스무 살 전에 끝난 판을 찾지 못했다').not.toBeNull();
  return found!;
}

/** 시대의 한 판을 40세까지 자동으로 살게 한 성인 상태(선택지 없음) — 자산 카드 시안용 */
export async function adultStateOf(page: Page, era: GenerationId, seed = 777): Promise<GameState> {
  return evalCore<GameState>(
    page,
    `let s = core.enterLife(core.enterBirth(core.beginBirth(core.createInitialState(arg.seed), arg.era)));
     while (s.phase === 'life' && (s.age < 40 || s.pending !== null)) s = s.pending ? core.autoResolveStep(s, s.pending.key).state : core.stepYear(s).state;
     return s;`,
    { era, seed },
  );
}
