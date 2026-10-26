import { expect, test, type Page } from '@playwright/test';
import type { GameState } from '../src/core/types';
import { GAME_KEY, KNOWN_SEED, evalCore, injectSave, lifeState, replaceSaveAndReload, startPageHidden, withPlay, type InjectedSettings } from './helpers';
import { cardReady } from './m7bStates';
import { infantDue, sheetReady, withNotes } from './m7cStates';
import { setRootFontPercent } from './textResize';
import { STANDARD_VIEWPORTS } from './viewports';

/**
 * 시트가 닫힌 직후의 입력 가드 (SPEC-003 CM5, content-M7c 11-1 F-1·G1~G9, 11-8 r2-1; QA-003-M7c 1회차 FAIL F-1의 재현 절차 그대로).
 * 사용자 동작으로 모달 시트(기록·결정)가 사라지는 **같은 렌더**에 인생 화면의 모든 가드 버튼에 400ms 가드가 걸려, 더블탭의 둘째 탭이 시트 뒤에 드러난 컨트롤을 누르지 못한다.
 *
 *  (a) 더블탭 88조합: 버튼 4종(자동 ① 1번 · 수동 1번 · 글 없는 2번 · 확인 단계 「글을 지우고 담아 두기」) × 공통 뷰포트 11종 × 글자 100·200% — 같은 지점을 60ms 안팎 간격으로 두 번 탭 →
 *      500ms 뒤 상태가 **한 번만 탭한 판과 같다**(= 컨트롤 작동 0: 배속·일시정지·자동 모드·나이·테마·BGM·나가기 확인·새 기록 시트·결정 선택·의견 보내기 링크 이동).
 *  (b) 결정 카드 선택지 22조합(모달 시트 × 11 × 2) + 자동 모드 인라인 카드의 사용자 선택 11조합(글자 100%).
 *  (c) 간격 스윕(B07): 1번 뒤 100·250·380ms에 「생각 남기기」 자리를 누르면 새 시트가 열리지 않고, 450·520ms에는 열린다.
 *  (d) 가드가 과하지 않다: 위 모든 조합에서 한 번만 탭한 뒤 450ms 넘어 배속을 누르면 바뀐다(110/110) · 자동 선택 직후 100ms · 시트 없이 소비된 직후(자동 모드·카드 끔·기록 40개)는 가드가 없다 ·
 *      평소 배속 연타(100ms × 4)는 마지막 값에 닿는다.
 *  (e) (a)(b)는 조합마다 두 번 돌린다(1회차는 같은 28조합이 두 번 재현됐다).
 *  G1 그림 전: 시트가 DOM에서 사라진 커밋 직후(그림이 그려지기 전)의 첫 관찰에서 모든 가드 컨트롤이 이미 aria-disabled다 — 한 프레임도 열린 채 그려지지 않는다. (효과가 이 시점 전에 돌았는지까지는 가르지 못한다 — 닫는 렌더에 세대를 싣는 방식 자체는 tests/sheetCloseGuard.test.tsx의 원본 단언이 고정한다.)
 * 시간은 멈추고(가려진 탭) 보는 조합이 대부분이라 「나이가 오르면 작동」으로 읽힌다. 뷰포트를 직접 지정하므로 mobile-360 프로젝트에서만 돈다.
 */

test.use({ hasTouch: true });
test.beforeEach(({}, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-360', '뷰포트를 직접 지정하므로 mobile-360에서만 실행');
});

const MANUAL: InjectedSettings = { speed: 1, autoMode: false, noteCards: true };
const AUTO: InjectedSettings = { speed: 1, autoMode: true, noteCards: true };
const OFF: InjectedSettings = { speed: 1, autoMode: false, noteCards: false };

type Kind = 'auto-keep' | 'manual-keep' | 'empty-skip' | 'confirm-discard' | 'decision-choice' | 'inline-choice';
const NOTE_KINDS: readonly Kind[] = ['auto-keep', 'manual-keep', 'empty-skip', 'confirm-discard'];

interface World {
  infant: GameState;
  life: GameState;
  decision: GameState;
  /** 결정 카드에서 누를 선택지 */
  choiceId: string;
}

/** 앱 페이지가 열려 있어야 한다. 선택지를 어느 쪽으로 골라도 곧바로 기록 카드가 뜨지 않는 짧은 결정(선택지 2개·인용 없음) — 시트 뒤에 드러난 컨트롤이 가려지지 않게 */
async function buildWorld(page: Page, timed = false): Promise<World> {
  await page.goto('/');
  const infant = (await infantDue(page)).state;
  const found = await evalCore<{ state: GameState; choiceId: string } | null>(
    page,
    `const { EVENT_POOL } = await import('/src/data/events/index.ts');
     for (let seed = 1; seed < 3000; seed++) {
       let s = core.enterLife(core.enterBirth(core.beginBirth(core.createInitialState(seed), 'present')));
       for (let guard = 0; guard < 80 && s.phase === 'life'; guard++) {
         s = core.advanceUntilDecision(s).state;
         if (s.phase !== 'life' || s.pending === null) break;
         const ev = EVENT_POOL.byId.get(s.pending.eventId);
         if (s.pending.choiceIds.length === 2 && ev !== undefined && core.citationIdFor(ev, 'present') === null && (ev.text ?? '').length < 120) {
           const quiet = s.pending.choiceIds.every((id) => { const after = core.resolveChoice(s, s.pending.key, id); return after.phase === 'life' && after.pending === null && core.dueNote(after) === null; });
           if (quiet) return { state: s, choiceId: s.pending.choiceIds[0] };
         }
         s = core.resolveChoice(s, s.pending.key, s.pending.choiceIds[0]);
       }
     }
     return null;`,
  );
  expect(found, '고르면 곧바로 기록 카드가 뜨지 않는 짧은 결정을 찾지 못했다').not.toBeNull();
  const world: World = { infant, life: lifeState(KNOWN_SEED), decision: found!.state, choiceId: found!.choiceId };
  // 시간을 재는 판(M8 플레이 시간, REV-003-M8-1 R-417): 세 상태 모두 play를 붙여 주입한다 — 닫힘 가드는 시간을 재는 판에서도 같아야 한다
  return timed ? { ...world, infant: withPlay(world.infant), life: withPlay(world.life), decision: withPlay(world.decision) } : world;
}

const targetOf = (kind: Kind, w: World): string => {
  switch (kind) {
    case 'auto-keep':
    case 'manual-keep':
      return 'note-save';
    case 'empty-skip':
      return 'note-skip';
    case 'confirm-discard':
      return 'note-confirm-discard';
    default:
      return `choice-${w.choiceId}`;
  }
};

const tick = (page: Page): Promise<void> => page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));

/** 심고(처음이면 `injectSave`, 아니면 새로고침) 시트를 연 모습으로 만든다 */
async function stage(page: Page, w: World, kind: Kind, percent: number, first: boolean): Promise<{ x: number; y: number }> {
  const load = (state: GameState, settings: InjectedSettings) => (first ? injectSave(page, state, '/', settings) : replaceSaveAndReload(page, state, settings));
  if (kind === 'auto-keep') {
    await load(w.infant, MANUAL);
    await sheetReady(page);
  } else if (kind === 'decision-choice') {
    await load(w.decision, MANUAL);
    await cardReady(page);
  } else if (kind === 'inline-choice') {
    await load(w.decision, AUTO);
    await expect(page.getByTestId('decision-fold-btn')).toBeEnabled();
  } else {
    await load(w.life, OFF);
    await expect(page.getByTestId('tool-note')).toBeEnabled();
    await page.evaluate(() => (document.querySelector('[data-testid="tool-note"]') as HTMLElement).click());
    await sheetReady(page);
  }
  if (percent !== 100) await setRootFontPercent(page, percent);
  if (kind === 'auto-keep' || kind === 'manual-keep' || kind === 'confirm-discard') await page.getByTestId('note-input').fill('기록 시험');
  if (kind === 'confirm-discard') {
    await page.evaluate(() => (document.querySelector('[data-testid="note-skip"]') as HTMLElement).click());
    await expect(page.getByTestId('note-confirm')).toBeVisible();
    await expect(page.getByTestId('note-confirm-discard')).toBeEnabled();
  }
  const target = page.getByTestId(targetOf(kind, w));
  await expect(target).toBeVisible();
  await expect(target, '눌리기 전에 자기 가드가 풀려 있다').not.toHaveAttribute('aria-disabled', 'true');
  await target.scrollIntoViewIfNeeded();
  await tick(page);
  const box = (await target.boundingBox())!;
  const vp = page.viewportSize()!;
  const point = { x: Math.round(box.x + box.width / 2), y: Math.round(box.y + box.height / 2) };
  expect(point.y, '누를 자리가 화면 안에 있다').toBeLessThan(vp.height);
  expect(point.x).toBeLessThan(vp.width);
  return point;
}

/** 컨트롤 작동을 보는 상태 (11-1-6): 배속 · 일시정지 · 자동 모드 · 나이 · 테마 · BGM · 나가기 확인 · 기록 시트 · 결정 카드 · 인생 기록 줄 · 새로 열린 탭(의견 보내기) */
async function snapshot(page: Page): Promise<Record<string, unknown>> {
  const dom = await page.evaluate(() => {
    const q = (s: string) => document.querySelector(s);
    const pressed = (s: string) => q(s)?.getAttribute('aria-pressed') ?? null;
    return {
      speed: Array.from(document.querySelectorAll('[data-speed]')).find((b) => b.getAttribute('aria-pressed') === 'true')?.getAttribute('data-speed') ?? null,
      paused: q('[data-testid="pause"]')?.getAttribute('data-paused') ?? null,
      auto: pressed('[data-testid="auto"]'),
      age: q('[data-testid="life-age"]')?.textContent ?? null,
      theme: document.documentElement.getAttribute('data-theme'),
      bgm: pressed('[data-testid="tool-bgm"]'),
      dark: pressed('[data-testid="tool-dark"]'),
      exitAsk: q('[data-testid="exit-ask"]') !== null,
      noteSheets: document.querySelectorAll('[data-testid="note-sheet"]').length,
      cards: document.querySelectorAll('[data-testid="choice-panel"]').length,
      folds: document.querySelectorAll('[data-testid="decision-fold"]').length,
      pendingKey: q('[data-testid="choice-panel"]')?.getAttribute('data-key') ?? null,
      logRows: document.querySelectorAll('[data-testid="log"] li').length,
    };
  });
  return { ...dom, pages: page.context().pages().length };
}

async function installClickLog(page: Page): Promise<void> {
  await page.evaluate(() => {
    const w = window as unknown as { __clicks: number[] };
    w.__clicks = [];
    window.addEventListener('click', () => w.__clicks.push(performance.now()), true);
  });
}
const readClickLog = (page: Page): Promise<number[]> => page.evaluate(() => (window as unknown as { __clicks: number[] }).__clicks);

async function tapAt(page: Page, mode: 'touch' | 'mouse', p: { x: number; y: number }): Promise<void> {
  if (mode === 'touch') await page.touchscreen.tap(p.x, p.y);
  else await page.mouse.click(p.x, p.y);
}

/** 한 번 탭하고 500ms 뒤 상태 + (d) 그 뒤 배속을 눌러 바뀌는지 */
async function singleRun(page: Page, w: World, kind: Kind, mode: 'touch' | 'mouse', percent: number, first: boolean): Promise<Record<string, unknown>> {
  const p = await stage(page, w, kind, percent, first);
  await tapAt(page, mode, p);
  await page.waitForTimeout(500);
  const snap = await snapshot(page);
  const two = page.locator('[data-speed="2"]');
  await two.scrollIntoViewIfNeeded();
  expect(await two.getAttribute('aria-disabled'), '(d) 한 번 탭하고 500ms가 지난 뒤에는 컨트롤의 가드가 풀려 있다').not.toBe('true');
  if (mode === 'touch') await two.tap();
  else await two.click();
  await expect(two, '(d) 가드 뒤 한 번 누른 배속이 바뀐다').toHaveAttribute('aria-pressed', 'true');
  return snap;
}

/** 같은 자리를 ~60ms 간격으로 두 번 탭하고 500ms 뒤 상태 */
async function doubleRun(page: Page, w: World, kind: Kind, mode: 'touch' | 'mouse', percent: number): Promise<Record<string, unknown>> {
  const p = await stage(page, w, kind, percent, false);
  await installClickLog(page);
  await tapAt(page, mode, p);
  await page.waitForTimeout(25);
  await tapAt(page, mode, p);
  await page.waitForTimeout(500);
  const clicks = await readClickLog(page);
  expect(clicks.length, '탭 두 번이 모두 클릭이 됐다').toBe(2);
  expect(clicks[1] - clicks[0], '둘째 탭이 첫째 탭 뒤 300ms 안(더블탭 간격, 가드 400ms 안)이다').toBeLessThan(300);
  return snapshot(page);
}

async function mockExternal(page: Page): Promise<void> {
  // 가드가 뚫려 의견 보내기 링크가 눌리면 새 탭이 GitHub로 가려 한다 — 외부 요청은 막고 새 탭이 열렸다는 사실(pages 수)만 본다
  await page.context().route(/github\.com/, (route) => route.abort());
}

// ---------- (a)(b)(d)(e): 11 뷰포트 × 글자 100·200% ----------

/** (a)(b)(d)(e)의 한 조합: 뷰포트 × 글자 크기에서 기록 버튼 4종 + 결정 시트 선택지(+ 인라인 카드)를 한 번 탭 대 더블탭(두 번)으로 비교한다. timed면 시간을 재는 판(withPlay)으로 돈다. */
async function checkDoubleTap(page: Page, vp: (typeof STANDARD_VIEWPORTS)[number], percent: 100 | 200, timed: boolean): Promise<void> {
  const tag = `${vp.name} ${percent}%${timed ? ' 시간을 재는 판' : ''}`;
  await mockExternal(page);
  await page.setViewportSize({ width: vp.width, height: vp.height });
  await startPageHidden(page);
  const w = await buildWorld(page, timed);
  const mode: 'touch' | 'mouse' = vp.touch === true ? 'touch' : 'mouse';
  const kinds: Kind[] = [...NOTE_KINDS, 'decision-choice', ...(percent === 100 ? (['inline-choice'] as const) : [])];
  for (const kind of kinds) {
    const single = await singleRun(page, w, kind, mode, percent, kind === kinds[0]);
    // 한 번 탭으로 시트는 닫혔다(공허 통과 방지) — 기록 시트: 열린 시트 0, 결정 카드: 카드 0
    if (kind === 'decision-choice' || kind === 'inline-choice') expect.soft(single.cards, `${tag} ${kind}: 한 번 탭으로 카드가 사라졌다`).toBe(0);
    else expect.soft(single.noteSheets, `${tag} ${kind}: 한 번 탭으로 시트가 닫혔다`).toBe(0);
    for (const round of [1, 2]) {
      const double = await doubleRun(page, w, kind, mode, percent);
      expect.soft(double, `${tag} ${kind} #${round}: 더블탭 뒤 상태가 한 번 탭한 판과 같다(컨트롤 작동 0)`).toEqual(single);
    }
  }
}

for (const vp of STANDARD_VIEWPORTS) {
  for (const percent of [100, 200] as const) {
    test(`F-1 (a)(b)(d)(e) ${vp.name} · 글자 ${percent}%: 시트가 닫힌 직후 더블탭 — 기록 버튼 4종${percent === 100 ? ' + 인라인 카드' : ''} + 결정 시트 선택지에서 컨트롤 작동 0 (두 번), 한 번 탭 뒤 배속은 먹는다`, async ({ page }) => {
      test.setTimeout(360_000);
      await checkDoubleTap(page, vp, percent, false);
    });
  }
}

// 시간을 재는 판 한 조합 (REV-003-M8-1 R-417): `play`를 가진 판(타이머·저장 경로가 도는 판)에서도 닫힘 가드가 같은 결과를 내는지 본다. 대표 조합 하나(모바일 터치 · 글자 100%).
// 주의(REV-003-M8-2 R-426): 이 조합은 `startPageHidden`으로 **가려진 채** 돈다 — 타이머의 버킷이 처음부터 끝까지 idle이라 hold·decide가 쌓이는 보이는 상태의 가드는 여기서 보지 않는다.
// 보이는 상태에서 시간이 쌓이는 판의 입력 가드는 QA의 G-*(시간을 재는 판)가 맡는다.
for (const vp of STANDARD_VIEWPORTS.filter((v) => v.name === '360x740-touch')) {
  test(`F-1 (a)(b)(d)(e) 시간을 재는 판(withPlay) ${vp.name} · 글자 100%: 더블탭 뒤 상태가 한 번 탭한 판과 같다 — 기록 버튼 4종 + 결정 시트 선택지 + 인라인 카드`, async ({ page }) => {
    test.setTimeout(360_000);
    await checkDoubleTap(page, vp, 100, true);
  });
}

// ---------- (c) 간격 스윕 B07 ----------

for (const vp of STANDARD_VIEWPORTS.filter((v) => ['360x740-touch', '1280x800', '320x568'].includes(v.name))) {
  test(`F-1 (c) B07 ${vp.name}: 1번 뒤 100·250·380ms에 「생각 남기기」 자리를 누르면 새 시트가 열리지 않고, 450·520ms에는 열린다`, async ({ page }) => {
    test.setTimeout(240_000);
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await startPageHidden(page);
    const w = await buildWorld(page);
    let first = true;
    for (const delay of [100, 250, 380, 450, 520]) {
      let measured = false; // 유효한 측정(타이머가 늦게 울려 가드 400ms를 넘기지 않은 것)이 있었는가 — 없으면 이 지연값은 아무것도 단언하지 않고 지나간 것이라 실패다 (R-412)
      for (let attempt = 1; attempt <= 3; attempt++) {
        if (first) await injectSave(page, w.life, '/', OFF);
        else await replaceSaveAndReload(page, w.life, OFF);
        first = false;
        await expect(page.getByTestId('tool-note')).toBeEnabled();
        await page.getByTestId('tool-note').scrollIntoViewIfNeeded();
        await page.evaluate(() => (document.querySelector('[data-testid="tool-note"]') as HTMLElement).click());
        await sheetReady(page);
        await page.getByTestId('note-input').fill('기록 시험');
        // 1번을 누른 뒤 정확히 `delay`ms에(실제 경과를 잰다) 그 자리의 요소를 누른다
        const r = await page.evaluate(async (d) => {
          const tool = document.querySelector('[data-testid="tool-note"]') as HTMLElement;
          const rect = tool.getBoundingClientRect();
          const x = rect.left + rect.width / 2;
          const y = rect.top + rect.height / 2;
          const save = document.querySelector('[data-testid="note-save"]') as HTMLElement;
          const t0 = performance.now();
          save.click();
          await new Promise((resolve) => setTimeout(resolve, d));
          const elapsed = performance.now() - t0;
          const hit = (document.elementFromPoint(x, y) as HTMLElement | null)?.closest('button,a') as HTMLElement | null;
          const guarded = hit?.getAttribute('aria-disabled') === 'true';
          const hitId = hit?.getAttribute('data-testid') ?? null;
          hit?.click();
          await new Promise((resolve) => setTimeout(resolve, 80));
          return { elapsed, guarded, hitId, opened: document.querySelector('[data-testid="note-sheet"]') !== null };
        }, delay);
        if (delay < 400 && r.elapsed >= 396) continue; // 느린 머신에서 타이머가 늦게 울려 가드 400ms를 넘겼다 — 다시 (세 번까지)
        measured = true;
        expect(r.hitId, `${delay}ms: 그 자리의 요소는 「생각 남기기」`).toBe('tool-note');
        if (delay < 400) {
          expect(r.guarded, `${delay}ms(실제 ${r.elapsed.toFixed(0)}ms): 가드 중`).toBe(true);
          expect(r.opened, `${delay}ms: 새 시트가 열리지 않는다`).toBe(false);
        } else {
          expect(r.guarded, `${delay}ms(실제 ${r.elapsed.toFixed(0)}ms): 가드가 풀렸다`).toBe(false);
          expect(r.opened, `${delay}ms: 새 시트가 열린다`).toBe(true);
        }
        break;
      }
      expect(measured, `${delay}ms: 세 번 안에 유효한 측정이 없다(타이머가 계속 늦게 울렸다) — 단언 없이 통과하지 않는다`).toBe(true);
    }
  });
}

// ---------- G1: 닫히는 같은 렌더 ----------

const GUARDED_SELECTORS = ['[data-testid="pause"]', '[data-speed="1"]', '[data-speed="2"]', '[data-speed="4"]', '[data-speed="8"]', '[data-testid="skip"]', '[data-testid="auto"]', '[data-testid="tool-bgm"]', '[data-testid="tool-note"]', '[data-testid="tool-dark"]', '[data-testid="tool-feedback"]', '[data-testid="tool-exit"]'];

for (const kind of ['manual-keep', 'empty-skip', 'confirm-discard', 'decision-choice', 'inline-choice'] as const) {
  test(`F-1 G1 ${kind}: 시트(카드)가 DOM에서 사라진 직후 — 그림이 그려지기 전의 첫 관찰에서 — 진행 줄 7개·도구 줄 5개가 이미 aria-disabled다`, async ({ page }) => {
    test.setTimeout(120_000);
    await startPageHidden(page);
    const w = await buildWorld(page);
    const p = await stage(page, w, kind, 100, true);
    const sheetSelector = kind === 'decision-choice' || kind === 'inline-choice' ? '[data-testid="choice-panel"]' : '[data-testid="note-sheet"]';
    await page.evaluate(
      ([sheet, controls]) => {
        const w2 = window as unknown as { __after: null | Array<{ sel: string; disabled: string | null }>; __seenSheet: boolean };
        w2.__after = null;
        w2.__seenSheet = document.querySelector(sheet) !== null;
        new MutationObserver(() => {
          const present = document.querySelector(sheet) !== null;
          if (present) w2.__seenSheet = true;
          else if (w2.__seenSheet && w2.__after === null) {
            // 시트가 사라진 커밋 직후의 마이크로태스크 — 아직 그림이 그려지기 전이다. 효과(useEffect)가 이 시점 전에 돌았는지는 보장하지 않는다(이산 입력의 일반 효과는 커밋 끝에서 동기로 비워질 수 있다).
            // 그래서 이 시험이 지키는 것은 「그림이 그려지기 전에 이미 가드 중」이라는 결과이고, 가드가 닫히는 방식(닫는 렌더에 세대를 실음, 효과로 다음 렌더에 올리지 않음)은 tests/sheetCloseGuard.test.tsx의 원본 단언이 고정한다
            w2.__after = controls.map((sel) => ({ sel, disabled: document.querySelector(sel)?.getAttribute('aria-disabled') ?? null }));
          }
        }).observe(document.body, { childList: true, subtree: true });
      },
      [sheetSelector, GUARDED_SELECTORS] as const,
    );
    await tapAt(page, 'touch', p);
    await page.waitForFunction(() => (window as unknown as { __after: unknown }).__after !== null, undefined, { timeout: 5000 });
    const after = await page.evaluate(() => (window as unknown as { __after: Array<{ sel: string; disabled: string | null }> }).__after);
    expect(after.length).toBe(GUARDED_SELECTORS.length);
    for (const c of after) expect(c.disabled, `${c.sel}: 시트가 사라진 첫 관찰`).toBe('true');
  });
}

// ---------- (d) 가드가 과하지 않다: 사용자가 누르지 않은 사라짐 · 평소 입력 ----------

test('F-1 (d) 자동 선택(autoChoose)으로 카드가 사라진 100ms 뒤 배속 탭이 먹는다 — 자동 선택에는 가드를 걸지 않는다 (G8)', async ({ page }) => {
  test.setTimeout(120_000);
  const w = await buildWorld(page);
  await injectSave(page, w.decision, '/', { speed: 2, autoMode: true, noteCards: true });
  await expect(page.getByTestId('choice-panel')).toBeVisible();
  const r = await page.evaluate(async () => {
    if (document.querySelector('[data-testid="choice-panel"]') === null) return { skipped: true as const };
    await new Promise<void>((resolve) => {
      const mo = new MutationObserver(() => {
        if (document.querySelector('[data-testid="choice-panel"]') === null) {
          mo.disconnect();
          resolve();
        }
      });
      mo.observe(document.body, { childList: true, subtree: true });
    });
    await new Promise((resolve) => setTimeout(resolve, 100));
    const btn = document.querySelector('[data-speed="1"]') as HTMLElement;
    const guarded = btn.getAttribute('aria-disabled') === 'true';
    btn.click();
    await new Promise((resolve) => setTimeout(resolve, 50));
    return { skipped: false as const, guarded, pressed: btn.getAttribute('aria-pressed') };
  });
  expect(r.skipped, '카드가 자동 선택 전에 사라졌다 — 시험이 늦게 시작했다').toBe(false);
  if (!r.skipped) {
    expect(r.guarded, '자동 선택 100ms 뒤 컨트롤은 가드가 아니다').toBe(false);
    expect(r.pressed, '그 탭이 먹어 배속이 1배로 바뀌었다').toBe('true');
  }
});

for (const variant of ['자동 모드', '카드 끔', '기록 40개'] as const) {
  test(`F-1 (d) 시트 없이 소비된 직후(${variant}) — 소비 뒤 500ms 동안 컨트롤에 가드가 걸린 프레임이 0이다 (G8)`, async ({ page }) => {
    // SPEC-005 QI5: 영유아기(5세의 첫 기록 카드)에는 더 이상 사람이 고르는 결정 카드가 없다 — 자동 모드 변형은 기록 카드를 소비한 뒤 첫 본인 결정(13세 이후)까지 부모님이 정한·흘러간 해를 지나가야 해서
    // 배속 8로 올리고 기다리는 한도를 늘렸다(소비 시점이 마운트 가드 700ms 뒤라는 조건은 첫 해 대기 11.81초(계수 1.6875, LM7b) ÷ 8 = 1.5초로 그대로 지킨다)
    test.setTimeout(300_000);
    const w = await buildWorld(page);
    const settings: InjectedSettings = variant === '자동 모드' ? { speed: 8, autoMode: true, noteCards: true } : variant === '카드 끔' ? { speed: 4, autoMode: false, noteCards: false } : { speed: 4, autoMode: false, noteCards: true }; // 4배속: 한 해가 약 1.75초라 소비가 화면 진입 가드(400ms) 창 밖에서 일어난다
    const state = variant === '기록 40개' ? await withNotes(page, w.infant, 40) : w.infant;
    await injectSave(page, state, '/', settings);
    await expect(page.getByTestId('life-screen')).toBeVisible();
    await page.evaluate(
      ([key, controls]) => {
        const w2 = window as unknown as { __frames: Array<{ t: number; guarded: boolean; consumed: boolean; cards: number; notes: number }>; __stop: boolean };
        w2.__frames = [];
        w2.__stop = false;
        const t0 = performance.now();
        const loop = () => {
          let consumed = false;
          try {
            consumed = JSON.parse(localStorage.getItem(key) as string).data.seen['note-infant-memory'] !== undefined;
          } catch {
            consumed = false;
          }
          const guarded = controls.some((sel) => Array.from(document.querySelectorAll(sel)).some((el) => el.getAttribute('aria-disabled') === 'true'));
          w2.__frames.push({ t: performance.now() - t0, guarded, consumed, cards: document.querySelectorAll('[data-testid="choice-panel"]').length, notes: document.querySelectorAll('[data-testid="note-sheet"]').length });
          if (!w2.__stop) requestAnimationFrame(loop);
        };
        requestAnimationFrame(loop);
      },
      [GAME_KEY, GUARDED_SELECTORS.filter((s) => s !== '[data-testid="skip"]')] as const,
    );
    // 소비될 때까지(자동 모드는 카드가 자동 선택으로 사라질 때까지) 기다린 뒤 500ms 더 본다
    await page.waitForFunction(() => (window as unknown as { __frames: Array<{ consumed: boolean }> }).__frames.some((f) => f.consumed), undefined, { timeout: 20_000 });
    if (variant === '자동 모드') {
      await page.waitForFunction(
        () => {
          const f = (window as unknown as { __frames: Array<{ cards: number }> }).__frames;
          return f.some((x) => x.cards > 0) && f[f.length - 1].cards === 0;
        },
        undefined,
        { timeout: 200_000 },
      );
    }
    await page.waitForTimeout(500);
    const frames = await page.evaluate(() => {
      const w2 = window as unknown as { __frames: Array<{ t: number; guarded: boolean; consumed: boolean; cards: number; notes: number }>; __stop: boolean };
      w2.__stop = true;
      return w2.__frames;
    });
    expect(frames.some((f) => f.consumed), '카드가 소비됐다(공허 통과 방지)').toBe(true);
    expect(frames.filter((f) => f.notes > 0).length, '기록 시트가 한 번도 보이지 않았다(시트 없이 소비)').toBe(0);
    const consumedAt = frames.find((f) => f.consumed)!.t;
    // 소비가 화면에 들어온 직후의 마운트 가드(400ms) 창 안에서 일어났다면 잘못 걸린 가드가 마운트 가드에 가려진다 — 그 시험은 무효이므로 실패로 둔다(R-412)
    expect(consumedAt, '첫 소비 프레임이 마운트 가드(400ms) 창 밖이다').toBeGreaterThan(700);
    const afterConsume = frames.filter((f) => f.t >= consumedAt && f.t <= consumedAt + 500);
    expect(afterConsume.length, '소비 뒤 500ms 창을 충분히 쟀다').toBeGreaterThan(15);
    expect(afterConsume.filter((f) => f.guarded).map((f) => Math.round(f.t)), '소비 시점부터 500ms 동안 컨트롤에 가드가 걸린 프레임').toEqual([]);
    const settled = frames.filter((f) => f.t > 700); // 마운트 가드가 지난 뒤 전체(자동 선택 포함)
    expect(settled.length, '충분히 쟀다').toBeGreaterThan(30);
    expect(settled.filter((f) => f.guarded).map((f) => Math.round(f.t)), '소비·자동 선택이 일어난 동안 컨트롤에 가드가 걸린 프레임').toEqual([]);
  });
}

test('F-1 (d) 평소 배속 연타(100ms 간격 4번)는 마지막 값에 닿는다 — 연타하는 사용자를 가드가 막지 않는다', async ({ page }) => {
  test.setTimeout(120_000);
  await startPageHidden(page);
  const w = await buildWorld(page);
  await injectSave(page, w.life, '/', OFF);
  await expect(page.getByTestId('life-screen')).toBeVisible();
  await page.waitForTimeout(700); // 화면 진입 가드가 지난 뒤
  const centers: Record<string, { x: number; y: number }> = {};
  for (const s of ['1', '2', '4', '8']) {
    const loc = page.locator(`[data-speed="${s}"]`);
    await loc.scrollIntoViewIfNeeded();
    const b = (await loc.boundingBox())!;
    centers[s] = { x: Math.round(b.x + b.width / 2), y: Math.round(b.y + b.height / 2) };
  }
  await installClickLog(page);
  for (const s of ['2', '4', '8', '2']) {
    await page.touchscreen.tap(centers[s].x, centers[s].y);
    await page.waitForTimeout(100);
  }
  await page.waitForTimeout(200);
  expect(await page.evaluate(() => Array.from(document.querySelectorAll('[data-speed]')).find((b) => b.getAttribute('aria-pressed') === 'true')?.getAttribute('data-speed')), '마지막으로 누른 2배').toBe('2');
  expect((await readClickLog(page)).length, '네 번 모두 클릭이 됐다').toBe(4);
});

