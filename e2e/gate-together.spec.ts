import { expect, test, type Locator, type Page } from '@playwright/test';
import type { GameState } from '../src/core/types';
import type { TickInfo } from '../src/core/life';
import { activeTestId, evalCore, injectSave, readSave, withoutPlay, type InjectedSettings } from './helpers';
import { MANUAL } from './parentStates';

/**
 * SPEC-018 G2 「같은 해에 함께」 화면 (결정 후속 255·262 「G2 화면」 (1)~(4)·263 ③④, 시안 docs/design/mockups/g2-together/, 계획 ai-log/2026-11-17_SPEC-018_G2-plan.md 3-7절·7절 완료 기준 10·14).
 * 15세에 일반 추첨이 선택 카드를 뽑은 해에도 G2 「고등학교 원서」가 같은 해에 먼저 부모 결정으로 해결된다 — 그 해 화면에 원서 카드(`lead-card`)와 그 해 카드가 함께 있다.
 *  - 수동: 결정 시트 안 맨 위에 요약형(「자세히 보기」로 펼침) · 접으면 가운데 열에 전체형 · 다시 열면 요약형(닫힌 채) · 고르면 사라진다 · 새로고침하면 다시 뜨지 않고 기록 줄만 남는다.
 *  - 자동: 인라인 결정 카드 위에 전체형, 자동 선택은 원서 카드 읽기 필요량(÷ 배속 ÷ 시간 배율)까지 기다린다.
 *  - 그 해 카드도 부모·흘러감: 부모 카드 두 장 [원서 카드 → 그 해 카드].
 *  - 「다음 결정으로」로 15세 본인 카드에 도착해도 시트 안에 원서 카드가 함께 뜬다.
 * 상태는 개발 서버의 실제 core 모듈로 찾는다(같은 시드·같은 걸음 → 같은 틱, 오라클).
 */

const G2 = 'school-high-pick';

interface LeadYear {
  /** 15세 걸음 직전 상태(대기 없음) — 앱이 한 해를 진행하면 그 해가 열린다 */
  start: GameState;
  tick: TickInfo;
  /** 원서 카드의 고른 길 라벨(부모용)과 그 해 카드 X의 키 */
  leadLabel: string;
  key: string;
}

/** 15세 동반 해를 찾는다: `self` = 그 해 카드가 본인 카드, `delegated` = 그 해 카드도 부모·흘러감. `skipFrom`이면 그보다 앞(대기 없는 해)에서 「다음 결정으로」 한 번으로 그 해에 닿는 상태를 돌려준다 */
async function findLeadYear(page: Page, kind: 'self' | 'delegated', opts: { skipFrom?: boolean } = {}): Promise<LeadYear> {
  const found = await evalCore<{ start: GameState; tick: TickInfo; leadLabel: string } | null>(
    page,
    `const mod = await import('/src/data/events/index.ts');
     for (let seed = 1; seed < 4000; seed++) {
       let s = core.enterLife(core.enterBirth(core.beginBirth(core.createInitialState(seed), 'alpha')));
       let calm = null; // 대기 없이 해를 넘긴 가장 최근 상태(「다음 결정으로」의 출발점 후보)
       for (let guard = 0; guard < 60 && s.phase === 'life' && s.age <= 15; guard++) {
         if (s.pending !== null) { s = core.autoResolveStep(s, s.pending.key).state; calm = null; continue; }
         if (calm === null) calm = s;
         const r = core.stepYear(s);
         const t = r.tick;
         if (t.lead !== undefined && r.state.phase === 'life' && (arg.kind === 'self' ? t.kind === 'choice' : (t.kind === 'resolved' && t.by !== undefined))) {
           const start = arg.skipFrom ? calm : s;
           if (arg.skipFrom) {
             if (start.age >= 15) break;
             const k = core.advanceUntilDecision(start, undefined, 'consume');
             if (k.state.pending === null || k.state.pending.key !== t.eventId + '@' + t.fromAge || k.last.lead === undefined) break;
           }
           const ev = mod.EVENT_POOL.byId.get(t.lead.eventId);
           const c = ev.choices.find((x) => x.id === t.lead.choiceId);
           return { start, tick: t, leadLabel: c.parentLabel ?? c.label };
         }
         if (t.kind === 'choice' || r.state.pending !== null) calm = null;
         s = r.state;
       }
     }
     return null;`,
    { kind, skipFrom: opts.skipFrom === true },
  );
  expect(found, `${kind}${opts.skipFrom ? ' (다음 결정으로)' : ''}: 15세 동반 해를 찾지 못했다`).not.toBeNull();
  const f = found!;
  expect(f.tick.lead!.eventId).toBe(G2);
  return { start: withoutPlay(f.start), tick: f.tick, leadLabel: f.leadLabel, key: `${f.tick.eventId}@${f.tick.fromAge}` };
}

/** a가 문서 순서상 b보다 앞인가 */
async function precedes(a: Locator, b: Locator): Promise<boolean> {
  const ha = await a.elementHandle();
  const hb = await b.elementHandle();
  return a.page().evaluate(([x, y]) => (x!.compareDocumentPosition(y!) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0, [ha, hb] as const);
}

/** 입력 가드(400ms)가 풀릴 때까지 기다린다 — 가드 중인 단추는 눌러도 무시된다 */
const guardPass = (page: Page) => page.waitForTimeout(500);

test.describe('G2 같은 해에 함께 — 원서 카드 화면', () => {
  // 상태 찾기(오라클 — 수천 시드를 걷는다)와 1/8 속도의 연출 대기가 합쳐 기본 30초를 넘을 수 있다
  test.describe.configure({ timeout: 120_000 });
  test('수동: 시트 맨 위 요약 카드 · 「자세히 보기」 · Esc로 접으면 전체형이 띠 위 · 다시 열면 요약형 · 고르면 사라진다', async ({ page }) => {
    await page.goto('/');
    const y = await findLeadYear(page, 'self');
    await injectSave(page, y.start, '/?__timescale=8', MANUAL);
    const sheet = page.getByTestId('choice-panel');
    await expect(sheet).toBeVisible({ timeout: 30_000 });
    await expect(sheet).toHaveAttribute('data-mode', 'sheet');
    await expect(sheet).toHaveAttribute('data-key', y.key);
    await expect(sheet).toHaveAttribute('aria-describedby', 'lc-chip lc-title lc-label');
    await expect(sheet).toHaveAttribute('aria-labelledby', 'dc-title');

    // 시트 안 맨 위 요약형: 칩 · 제목 · 고른 길 · 영향 줄만 보이고 상황 문장·도장은 숨어 있다
    const lead = sheet.getByTestId('lead-card');
    await expect(lead).toHaveCount(1);
    await expect(page.getByTestId('lead-card')).toHaveCount(1); // 한 곳에만
    await expect(lead).toHaveClass(/lead-card--compact/);
    await expect(lead).toHaveAttribute('data-key', `${G2}@15`);
    await expect(lead.getByTestId('lead-label')).toHaveText(y.leadLabel);
    await expect(lead.getByTestId('lead-text')).toBeHidden();
    await expect(lead.getByTestId('lead-stamp')).toBeHidden();
    await expect(lead.getByTestId('lead-when')).toHaveCount(0);
    expect(await precedes(lead, sheet.getByTestId('choice-title'))).toBe(true);
    // 첫 포커스는 결정 카드 제목(지금 규칙)
    await expect.poll(() => activeTestId(page), { timeout: 5_000 }).toBe('choice-title');
    // 원서 카드 아래끝 < 결정 제목 위끝(시안 8절 갈고리)
    const leadBox = (await lead.boundingBox())!;
    const titleBox = (await sheet.getByTestId('choice-title').boundingBox())!;
    expect(leadBox.y + leadBox.height).toBeLessThanOrEqual(titleBox.y);

    // 「자세히 보기」: 펼치면 상황·도장이 보이고 이름은 그대로, 초점은 단추에 남는다
    const more = lead.getByTestId('lead-more');
    await expect(more).toHaveAttribute('aria-expanded', 'false');
    await expect(more).toHaveAccessibleName('자세히 보기');
    // 키보드로 누른다 — WebKit은 마우스 클릭으로 단추에 초점을 주지 않아(엔진 동작) 「초점이 단추에 남는다」를 두 엔진에서 같게 보려면 키보드 경로가 맞다
    await guardPass(page);
    await more.focus();
    await page.keyboard.press('Enter');
    await expect(more).toHaveAttribute('aria-expanded', 'true');
    await expect(lead.getByTestId('lead-text')).toBeVisible();
    await expect(lead.getByTestId('lead-stamp')).toBeVisible();
    await expect(more).toHaveAccessibleName('자세히 보기');
    expect(await activeTestId(page)).toBe('lead-more');

    // Esc = 잠시 덮어 두기: 시트가 접히고 원서 카드는 가운데 열에 전체형으로 띠 위에 남는다
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('decision-overlay')).toHaveCount(0);
    const fold = page.getByTestId('decision-fold');
    await expect(fold).toBeVisible();
    const full = page.getByTestId('lead-card');
    await expect(full).toHaveCount(1);
    await expect(full).toBeVisible();
    await expect(full).not.toHaveClass(/lead-card--compact/);
    await expect(full.getByTestId('lead-when')).toBeVisible();
    await expect(full.getByTestId('lead-text')).toBeVisible();
    expect(await precedes(full, fold)).toBe(true);

    // 다시 열면 시트 안 요약형(펼침은 닫힌 채)
    await guardPass(page);
    await page.getByTestId('decision-reopen').click();
    await expect(sheet).toBeVisible();
    await expect(sheet.getByTestId('lead-card')).toHaveClass(/lead-card--compact/);
    await expect(sheet.getByTestId('lead-more')).toHaveAttribute('aria-expanded', 'false');
    await expect(page.getByTestId('lead-card')).toHaveCount(1);

    // 고르면 원서 카드는 사라지고, 연표에는 G2 줄이 남는다
    await guardPass(page);
    await sheet.locator('.choice').first().click();
    await expect(page.getByTestId('lead-card')).toHaveCount(0);
    await expect(page.getByTestId('log-by').filter({ hasText: y.leadLabel })).toHaveCount(1);
  });

  test('새로고침: 15세 결정 카드가 대기 중이어도 원서 카드는 다시 뜨지 않고 G2 기록 줄만 남는다 (PD7-5)', async ({ page }) => {
    await page.goto('/');
    const y = await findLeadYear(page, 'self');
    await injectSave(page, y.start, '/?__timescale=8', MANUAL);
    const sheet = page.getByTestId('choice-panel');
    await expect(sheet.getByTestId('lead-card')).toBeVisible({ timeout: 30_000 });
    // 저장된 판: 그 해 결정 대기 + G2 줄
    await expect.poll(async () => (await readSave(page)).data.pending?.key ?? null).toBe(y.key);
    await page.reload();
    await expect(sheet).toBeVisible({ timeout: 30_000 });
    await expect(sheet).toHaveAttribute('data-key', y.key);
    await expect(page.getByTestId('lead-card')).toHaveCount(0);
    await expect(sheet).not.toHaveAttribute('aria-describedby', /.+/);
    await expect(page.getByTestId('log-by').filter({ hasText: y.leadLabel })).toHaveCount(1);
    const save = await readSave(page);
    expect(save.data.history.filter((h) => h.eventId === G2 && h.age === 15)).toHaveLength(1);
  });

  test('「다음 결정으로」로 15세 본인 카드에 도착해도 시트 안에 원서 요약 카드가 함께 뜬다 (후속 262 (3))', async ({ page }) => {
    await page.goto('/');
    const y = await findLeadYear(page, 'self', { skipFrom: true });
    expect(y.start.age).toBeLessThan(15);
    await injectSave(page, { ...y.start, paused: true }, '/', MANUAL);
    await expect(page.getByTestId('life-screen')).toBeVisible();
    await guardPass(page);
    await page.getByTestId('skip').click();
    const sheet = page.getByTestId('choice-panel');
    await expect(sheet).toBeVisible({ timeout: 10_000 });
    await expect(sheet).toHaveAttribute('data-key', y.key);
    await expect(sheet.getByTestId('lead-card')).toHaveClass(/lead-card--compact/);
    await expect(sheet.getByTestId('lead-label')).toHaveText(y.leadLabel);
    await expect(page.getByTestId('lead-card')).toHaveCount(1);
  });

  test('자동 모드: 인라인 결정 카드 위에 원서 전체형 · 자동 선택은 원서 카드 읽기 필요량만큼 기다린다 (후속 262 (4))', async ({ page }) => {
    await page.goto('/');
    const y = await findLeadYear(page, 'self');
    const need = y.tick.lead!.readNeedMs;
    expect(need).toBeGreaterThan(3000 * 2); // 기본 지연(3초)과 구별될 만큼 길다
    const scale = 8;
    const settings: InjectedSettings = { speed: 1, autoMode: true, noteCards: false };
    await injectSave(page, y.start, `/?__timescale=${scale}`, settings);
    const inline = page.locator('[data-testid="choice-panel"][data-mode="inline"]');
    await expect(inline).toBeVisible({ timeout: 30_000 });
    const seenAt = Date.now();
    await expect(inline).toHaveAttribute('data-key', y.key);
    const lead = page.getByTestId('lead-card');
    await expect(lead).toHaveCount(1);
    await expect(lead).not.toHaveClass(/lead-card--compact/);
    await expect(lead.getByTestId('lead-text')).toBeVisible();
    await expect(page.locator('[role="dialog"]')).toHaveCount(0);
    expect(await precedes(lead, inline)).toBe(true);
    // 기본 지연(3초 ÷ 8 ≈ 0.4초)이 지나도 아직 고르지 않는다 — 원서 카드 필요량 ÷ 8까지
    const base = 3000 / scale;
    const waitFor = need / scale;
    await page.waitForTimeout(Math.min(waitFor - 400, base + 1200));
    await expect(inline).toBeVisible();
    await expect(inline).toHaveAttribute('data-key', y.key);
    // 필요량이 지나면 고른다(카드가 사라진다)
    await expect(page.getByTestId('lead-card')).toHaveCount(0, { timeout: waitFor + 8_000 });
    expect(Date.now() - seenAt).toBeGreaterThanOrEqual(waitFor - 600);
  });

  test('그 해 카드도 부모·흘러감: 부모 카드 두 장을 쌓는다 [원서 카드 → 그 해 카드] — id가 겹치지 않는다 (후속 262 (2))', async ({ page }) => {
    await page.goto('/');
    const y = await findLeadYear(page, 'delegated');
    await injectSave(page, y.start, '/?__timescale=8', MANUAL);
    const main = page.getByTestId('parent-card');
    await expect(main).toBeVisible({ timeout: 30_000 });
    await page.getByTestId('pause').click();
    await expect(page.getByTestId('pause')).toHaveAttribute('data-paused', 'true');
    const lead = page.getByTestId('lead-card');
    await expect(lead).toBeVisible();
    await expect(lead).toHaveAttribute('data-key', `${G2}@15`);
    await expect(main).toHaveAttribute('data-key', y.key);
    await expect(lead).not.toHaveClass(/lead-card--compact/);
    expect(await precedes(lead, main)).toBe(true);
    await expect(page.locator('#pc-title')).toHaveCount(1);
    await expect(page.locator('#lc-title')).toHaveCount(1);
    await expect(page.locator('[role="dialog"]')).toHaveCount(0);
    // 두 카드 모두 초점을 가져가지 않는다(지금 부모 카드 규칙) — 클릭이 단추에 초점을 주는지는 엔진마다 달라(WebKit은 주지 않는다) 「초점이 카드 안에 없다」로 본다
    expect(await page.evaluate(() => document.activeElement?.closest('[data-testid="lead-card"], [data-testid="parent-card"]') != null)).toBe(false);
    // 다시 진행하면 해가 넘어가며 원서 카드는 사라진다(다음 해 카드는 그 해의 것 — 같은 키의 카드는 남지 않는다)
    await page.getByTestId('pause').click();
    await expect(lead).toHaveCount(0, { timeout: 30_000 });
    await expect(page.locator(`[data-testid="parent-card"][data-key="${y.key}"]`)).toHaveCount(0);
  });
});
