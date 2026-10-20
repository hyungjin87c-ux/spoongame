import { expect, type Page } from '@playwright/test';
import type { GameState } from '../src/core/types';
import type { TickInfo } from '../src/core/life';
import { activeTestId, evalCore, injectSave, setPageVisible, withoutPlay, type InjectedSettings } from './helpers';

/**
 * 부모님이 정한·아이의 일로 흘러간 해의 e2e 상태 (SPEC-005 QI5, PD3·PD5·PD7).
 *
 * 어린 시절(0~18세)의 큰 결정 가운데 부모님이 정하거나 아이의 일로 흘러가는 카드는 `pending`이 되지 않는다 — 그 해 안에서 즉시 해결되고, 화면에는 결과 연출 대기 동안만
 * 비모달 카드(`parent-card`)가 뜬다. 그래서 예전에 「결정 시트를 심어서」 보던 e2e는 이 카드를 **띄워서** 본다: 그 해 직전 상태를 심고(`findDelegatedYear`) 카드가 뜨면 일시정지로 붙잡는다(`showParentCard`).
 * 모든 상태는 개발 서버의 실제 core 모듈로 찾는다(같은 시드·같은 선택 → 같은 상태, 오라클).
 */
export type Era = 'past' | 'present' | 'future';

export interface DelegatedYear {
  /** 그 해가 시작되기 직전 상태(본인 카드는 자동 성향으로 넘겼다) — 앱이 이 상태에서 한 해를 진행하면 카드가 뜬다 */
  start: GameState;
  /** 그 해가 끝난 상태와 틱(`by`·`choiceId`·`impact`·`readNeedMs`) */
  after: GameState;
  tick: TickInfo;
  /** 해결 직전에 보이던 선택지 id (고른 길 포함) */
  ids: string[];
  /** 카드에 보이는 고른 길 라벨(부모일 때 `parentLabel ?? label`)과 제목 */
  label: string;
  title: string;
}

export interface FindOpts {
  by?: 'parent' | 'child';
  eventId?: string;
  era?: Era;
  /** 부모 재력 단계 */
  tier?: number;
  firstBorn?: boolean;
  /** 해결 직전 선택지 id가 이만큼 이상 */
  minChoices?: number;
  /** 해결 직전 선택지에 이 id가 있어야 / 없어야 한다 */
  mustInclude?: string;
  mustExclude?: string;
  /** 고른 길이 이 id여야 한다 */
  chosen?: string;
  /** 카드가 일어나는 나이의 범위 */
  minAge?: number;
  maxAge?: number;
  from?: number;
  to?: number;
}

/** 조건에 맞는 부모님이 정한 / 흘러간 해를 찾는다. 앱 페이지가 열려 있어야 한다(같은 origin에서 core 모듈을 불러온다). */
export async function findDelegatedYear(page: Page, opts: FindOpts = {}): Promise<DelegatedYear> {
  const found = await evalCore<(Omit<DelegatedYear, 'label' | 'title'>) | null>(
    page,
    `for (let seed = arg.from; seed < arg.to; seed++) {
       let s = core.enterLife(core.enterBirth(core.beginBirth(core.createInitialState(seed), arg.era)));
       if (arg.tier !== null && s.character.parentWealth !== arg.tier) continue;
       if (arg.firstBorn && s.birthReport.birthOrder !== 1) continue;
       for (let guard = 0; guard < 80 && s.phase === 'life' && s.age <= arg.maxAge; guard++) {
         if (s.pending !== null) { s = core.autoResolveStep(s, s.pending.key).state; continue; }
         let cap = null;
         const r = core.stepYear(s, undefined, (e) => { cap = e; });
         if (cap !== null && r.tick.kind === 'resolved' && r.state.phase === 'life' && r.tick.fromAge >= arg.minAge
           && (arg.by === null || r.tick.by === arg.by) && (arg.id === null || r.tick.eventId === arg.id)
           && cap.ids.length >= arg.min && (arg.inc === null || cap.ids.includes(arg.inc)) && (arg.exc === null || !cap.ids.includes(arg.exc))
           && (arg.chosen === null || r.tick.choiceId === arg.chosen)) {
           return { start: s, after: r.state, tick: r.tick, ids: [...cap.ids] };
         }
         s = r.state;
       }
     }
     return null;`,
    {
      by: opts.by ?? null,
      id: opts.eventId ?? null,
      era: opts.era ?? 'present',
      tier: opts.tier ?? null,
      firstBorn: opts.firstBorn ?? false,
      min: opts.minChoices ?? 2,
      inc: opts.mustInclude ?? null,
      exc: opts.mustExclude ?? null,
      chosen: opts.chosen ?? null,
      minAge: opts.minAge ?? 0,
      maxAge: opts.maxAge ?? 19,
      from: opts.from ?? 1,
      to: opts.to ?? 8000,
    },
  );
  expect(found, `${opts.eventId ?? opts.by ?? '부모 결정'}${opts.tier ? ' 재력 ' + opts.tier : ''}: 부모님이 정한·흘러간 해를 찾지 못했다`).not.toBeNull();
  const y = found!;
  const names = await evalCore<{ title: string; label: string }>(
    page,
    `const mod = await import('/src/data/events/index.ts');
     const ev = mod.EVENT_POOL.byId.get(arg.eventId);
     const c = ev.choices.find((x) => x.id === arg.choiceId);
     return { title: ev.title, label: arg.by === 'parent' ? (c.parentLabel ?? c.label) : c.label };`,
    { eventId: y.tick.eventId, choiceId: y.tick.choiceId, by: y.tick.by },
  );
  return { start: withoutPlay(y.start), after: withoutPlay(y.after), tick: y.tick, ids: y.ids, label: names.label, title: names.title };
}

/** 수동·1배속·기록 카드 꺼짐 — 기록 카드는 이 시험들과 상관없이 시계를 멈추고 「다음 결정으로」를 가로챈다(e2e 기본) */
/**
 * 도구 줄의 일시정지 버튼에 포커스를 두고 그 자리에 머무는지 확인한다. 인생 화면의 진입 포커스(`life-name`)가 자리 잡기 전에 버튼에 포커스를 두면 진입 포커스가 뒤늦게 그것을 가져간다
 * (WebKit에서 CPU가 바쁠 때 관찰) — 그래서 먼저 진입 포커스가 닿기를 기다린다(닿지 않는 환경이면 5초 뒤 그대로 진행).
 */
export async function focusPauseAfterEntry(page: Page): Promise<void> {
  await expect(page.getByTestId('life-screen')).toBeVisible();
  await expect.poll(() => activeTestId(page), { timeout: 5_000 }).toBe('life-name').catch(() => undefined);
  await page.getByTestId('pause').focus();
  expect(await activeTestId(page)).toBe('pause');
}

export const MANUAL: InjectedSettings = { speed: 1, autoMode: false, noteCards: false };

/**
 * 그 해 직전 상태를 심고 카드가 뜨면 일시정지로 붙잡는다 — 카드는 이 자리에 머문다(일시정지하면 연출 대기도 함께 멈춘다, PD7-4).
 * `timescale`은 개발 서버 전용 탐침(`?__timescale=N`): 카드의 연출 대기(1배속 18~44초)를 N배 빠르게 해 기다리는 시간을 줄인다.
 */
export async function showParentCard(page: Page, y: DelegatedYear, opts: { timescale?: number; settings?: InjectedSettings } = {}): Promise<void> {
  await injectSave(page, y.start, `/?__timescale=${opts.timescale ?? 8}`, opts.settings ?? MANUAL);
  // 같은 페이지에서 앞서 가려진 탭(`startPageHidden`)으로 상태를 열었다면 init 스크립트가 이 이동에서도 visibilityState를 'hidden'으로 속인다 — 카드는 시계가 흘러야 뜨므로 보이게 되돌린다
  if (await page.evaluate(() => (window as unknown as { __vis?: string }).__vis === 'hidden')) await setPageVisible(page, true);
  const card = page.getByTestId('parent-card');
  await expect(card).toBeVisible({ timeout: 30_000 });
  await page.getByTestId('pause').click();
  await expect(page.getByTestId('pause')).toHaveAttribute('data-paused', 'true');
  await expect(card).toBeVisible();
}
