import { expect, type Page } from '@playwright/test';
import type { GameState, GenerationId } from '../src/core/types';
import { evalCore, injectSave, startPageHidden } from './helpers';

/**
 * M7a(영유아 0~7세 콘텐츠, SPEC-003 IN1~IN8)의 e2e 상태 — 마일스톤 줄(한 해 두 줄)·동생 맞이 카드·재력 문턱 카드·7세 카드·시대 전용 장면.
 * 상태는 앱 페이지가 연 개발 서버의 core로 찾는다(같은 시드·같은 선택 → 같은 상태, 오라클). 가려진 탭처럼 시간을 멈춰(startPageHidden) 연다.
 */
export type Era = GenerationId;

/** 영유아 결정 카드(pending)가 떠 있는 상태 중 eventId인 것을 찾는다. 앞선 결정은 첫 선택지로 넘긴다. 앱 페이지가 열려 있어야 한다. */
export async function findInfantDecision(
  page: Page,
  eventId: string,
  opts: { era?: Era; tier?: number; minChoices?: number; firstBorn?: boolean; mustInclude?: string; mustExclude?: string; from?: number; to?: number } = {},
): Promise<GameState> {
  const found = await evalCore<GameState | null>(
    page,
    `for (let seed = arg.from; seed < arg.to; seed++) {
       let s = core.enterLife(core.enterBirth(core.beginBirth(core.createInitialState(seed), arg.era)));
       if (arg.tier !== null && s.character.parentWealth !== arg.tier) continue;
       if (arg.firstBorn && s.birthReport.birthOrder !== 1) continue;
       for (let guard = 0; guard < 60 && s.phase === 'life' && s.age <= 8; guard++) {
         s = core.advanceUntilDecision(s).state;
         if (s.phase !== 'life' || s.pending === null) break;
         if (s.pending.eventId === arg.id && s.pending.choiceIds.length >= arg.min && (arg.inc === null || s.pending.choiceIds.includes(arg.inc)) && (arg.exc === null || !s.pending.choiceIds.includes(arg.exc))) return s;
         s = core.resolveChoice(s, s.pending.key, s.pending.choiceIds[0]);
       }
     }
     return null;`,
    { id: eventId, era: opts.era ?? 'alpha', tier: opts.tier ?? null, min: opts.minChoices ?? 2, firstBorn: opts.firstBorn ?? false, inc: opts.mustInclude ?? null, exc: opts.mustExclude ?? null, from: opts.from ?? 1, to: opts.to ?? 8000 },
  );
  expect(found, `${eventId}${opts.tier ? ' 재력 ' + opts.tier : ''}: 결정 카드가 떠 있는 영유아 상태를 찾지 못했다`).not.toBeNull();
  return found!;
}

/**
 * 영유아기를 지나 선택지 없이 멈춘 대시보드 상태: age 이상이고, includeAny 중 하나가 연표에 있고, minPerYear(기본 1)줄 이상이 한 해에 남은 나이가 있다(doubleYear는 2의 옛 이름) — 1세는 걸음마 + 첫 말 + 일반 사건으로 3줄(r3).
 * 앞선 결정은 첫 선택지로 넘긴다.
 */
export async function findInfantLog(page: Page, era: Era, opts: { minAge: number; includeAny?: string[]; doubleYear?: boolean; minPerYear?: number; from?: number; to?: number }): Promise<GameState> {
  const found = await evalCore<GameState | null>(
    page,
    `const lines = (h) => h.filter((x) => x.kind === 'event' || x.kind === 'choice');
     for (let seed = arg.from; seed < arg.to; seed++) {
       let s = core.enterLife(core.enterBirth(core.beginBirth(core.createInitialState(seed), arg.era)));
       for (let guard = 0; guard < 80 && s.phase === 'life' && s.age <= 12; guard++) {
         if (s.pending !== null) s = core.resolveChoice(s, s.pending.key, s.pending.choiceIds[0]);
         else s = core.stepYear(s).state;
         if (s.phase !== 'life' || s.pending !== null || s.age < arg.minAge) continue;
         const h = lines(s.history);
         if (arg.any !== null && !h.some((x) => arg.any.includes(x.eventId))) continue;
         if (arg.minPerYear > 1) {
           const per = {};
           for (const x of h) per[x.age] = (per[x.age] || 0) + 1;
           if (!Object.values(per).some((n) => n >= arg.minPerYear)) continue;
         }
         return s;
       }
     }
     return null;`,
    { era, minAge: opts.minAge, any: opts.includeAny ?? null, minPerYear: opts.minPerYear ?? (opts.doubleYear === true ? 2 : 1), from: opts.from ?? 1, to: opts.to ?? 4000 },
  );
  expect(found, `${era}: 연표에 ${opts.includeAny?.join('·') ?? '(조건 없음)'}이(가) 있는 영유아 대시보드 상태를 찾지 못했다`).not.toBeNull();
  return found!;
}

/** 끝까지 자동으로 살아 엔딩에 닿은 판 중 영유아기에 한 해 minPerYear줄(기본 3 — 1세의 걸음마 + 첫 말 + 일반 사건)이 있는 것 (엔딩 연표의 영유아 묶음이 한 해의 여러 줄을 그대로 보인다) */
export async function findInfantEnding(page: Page, era: Era = 'alpha', minPerYear = 3): Promise<GameState> {
  const found = await evalCore<GameState | null>(
    page,
    `for (let seed = 1; seed < 300; seed++) {
       const start = core.enterLife(core.enterBirth(core.beginBirth(core.createInitialState(seed), arg.era)));
       const end = core.playToEnd(start, null).state;
       if (end.phase !== 'ending' || end.death === null || end.death.age < 30) continue;
       const per = {};
       for (const x of end.history) if ((x.kind === 'event' || x.kind === 'choice') && x.age <= 7) per[x.age] = (per[x.age] || 0) + 1;
       if (Object.values(per).some((n) => n >= arg.minPerYear)) return end;
     }
     return null;`,
    { era, minPerYear },
  );
  expect(found, `영유아기에 한 해 ${minPerYear}줄이 있는 엔딩 상태를 찾지 못했다`).not.toBeNull();
  return found!;
}

/** 상태를 심고 대시보드(또는 엔딩)를 연다. 입력 가드가 풀린 뒤에 돌려준다. */
export async function openState(page: Page, state: GameState): Promise<void> {
  await startPageHidden(page);
  await page.goto('/');
  // 자동 모드 켜짐 = 비모달 인라인 카드(M7b): 카드 전체가 문서 안에 놓여 글자 확대·낱말 끊김 측정이 카드 전부를 본다(가려진 탭이라 자동 선택은 일어나지 않는다). 모달 시트는 e2e/m7b-*가 잰다
  await injectSave(page, state, '/', { speed: 1, autoMode: true });
  if (state.phase === 'ending') {
    await expect(page.getByTestId('ending-screen')).toBeVisible();
    await expect(page.getByTestId('rebirth')).toBeEnabled();
  } else {
    await expect(page.getByTestId('life-screen')).toBeVisible();
    await expect(page.getByTestId('auto')).toBeEnabled();
  }
}

/** 연표(인생 기록)의 줄 — 나이 알약 글과 줄 글 */
export async function readLogRows(page: Page): Promise<Array<{ age: string; text: string; kind: string }>> {
  return page.evaluate(() =>
    Array.from(document.querySelectorAll<HTMLElement>('[data-testid="log-row"]')).map((row) => ({
      age: (row.querySelector('.log__age')?.textContent ?? '').trim(),
      text: (row.querySelector('.log__text')?.textContent ?? '').replace(/\s+/g, ' ').trim(),
      kind: row.getAttribute('data-kind') ?? '',
    })),
  );
}

/**
 * 출생신고의 사는 집(housing)이 own·rent·free인 판의 출생 직후(birth 단계) 상태와, 같은 판을 8세까지 첫 선택지로 살아 본 상태 (r3 T05 증거: 자가 판에는 이삿짐이 없다).
 * 재력 3 이하(이삿짐의 재력 조건 안)만 센다 — 자가 판이 이삿짐 후보가 될 수 있던 판이다. 8세까지 이삿짐이 일어났는지는 seen으로 돌려준다.
 */
export async function findHousingLife(page: Page, era: Era, housing: 'own' | 'rent', from = 1, to = 4000): Promise<{ birth: GameState; life: GameState; moved: boolean }> {
  const found = await evalCore<{ birth: GameState; life: GameState; moved: boolean } | null>(
    page,
    `for (let seed = arg.from; seed < arg.to; seed++) {
       const birth = core.enterBirth(core.beginBirth(core.createInitialState(seed), arg.era));
       const r = birth.birthReport;
       if (r === null || birth.character === null || birth.character.parentWealth > 3) continue;
       const own = r.housing === 'own';
       if ((arg.housing === 'own') !== own) continue;
       if (arg.housing === 'rent' && r.housing !== 'rent') continue;
       let s = core.enterLife(birth);
       for (let guard = 0; guard < 80 && s.phase === 'life' && s.age <= 8; guard++) {
         s = s.pending !== null ? core.resolveChoice(s, s.pending.key, s.pending.choiceIds[0]) : core.stepYear(s).state;
       }
       if (s.phase !== 'life' || s.pending !== null || s.age < 8) continue;
       const moved = Object.prototype.hasOwnProperty.call(s.seen, 'infant-moving');
       if (arg.housing === 'own' && moved) continue;
       if (arg.housing === 'rent' && !moved) continue;
       return { birth, life: s, moved };
     }
     return null;`,
    { era, housing, from, to },
  );
  expect(found, `${era}: 사는 집이 ${housing}인 판(재력 3 이하)을 찾지 못했다`).not.toBeNull();
  return found!;
}
