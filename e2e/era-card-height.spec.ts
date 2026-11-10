import { expect, test, type Page } from '@playwright/test';
import { KNOWN_SEED, injectSave, lifeState, noHorizontalOverflow, startPageHidden } from './helpers';
import type { GameState } from '../src/core/types';

/**
 * SPEC-016 H4 r2(형진 님 2026-11-10) — PC(≥ 960px)에서 「시대의 창」 카드의 높이 = 「집과 가족 그림」 카드의 높이(위·아래 끝이 같은 선).
 * 뷰포트를 직접 지정하므로 어느 프로젝트에서나 돈다. 높이를 재서 CSS 변수로 알리는 일은 `ui/scene/usePairedEraHeight.ts`, 모양은 `styles/family.css`의 `.era-card[data-paired='true']`.
 */

const MANUAL = { speed: 1, autoMode: false, noteCards: false } as const;
const FAST = '/?__timescale=1000';

/** 1975년생 X세대 age세의 멈춘 판 — 5세 = 1980년(사건 있는 해, 그림 + 캡션), 2세 = 1977년(빈 해, 빈 종이틀) */
function era(age: number): GameState {
  const base = lifeState(KNOWN_SEED);
  const history: GameState['history'] = [{ age: 0, kind: 'stage', text: '1975년 1월, 서울특별시의 평범한 가정에서 3.2kg 남자아이로 태어났습니다. 첫째입니다.' }];
  for (let a = 1; a <= age; a++) history.push({ age: a, kind: 'event', text: `${a}세 일입니다.`, eventId: `e${a}` });
  return { ...base, generation: 'genx', character: { ...base.character!, birthYear: 1975 }, age, paused: true, history };
}

async function open(page: Page, width: number, height: number, age: number, extra: Record<string, unknown> = {}): Promise<void> {
  await startPageHidden(page);
  await page.setViewportSize({ width, height });
  await injectSave(page, era(age), FAST, { ...MANUAL, bgm: { on: false, volume: 30 }, ...extra });
  await expect(page.getByTestId('family-scene')).toHaveAttribute('data-scene-art', 'ready', { timeout: 15_000 });
  await expect(page.locator('#scene-era')).toHaveAttribute(age === 5 ? 'data-era' : 'data-empty', /.+/, { timeout: 15_000 });
  await expect(page.getByTestId('era-card')).toHaveAttribute('data-paired', 'true');
}

const box = (page: Page, testId: string) =>
  page.evaluate((id) => {
    const r = document.querySelector(`[data-testid="${id}"]`)!.getBoundingClientRect();
    return { y: r.y, h: r.height, bottom: r.bottom, x: r.x, w: r.width };
  }, testId);

test.describe('PC: 시대의 창 카드 높이 = 집과 가족 그림 카드 높이 (≤ 1px)', () => {
  for (const [width, height] of [[1280, 800], [1440, 900], [1920, 1080], [960, 700]] as const) {
    for (const age of [5, 2] as const) {
      test(`${width}×${height} · ${age === 5 ? '사건 있는 해(그림 + 캡션)' : '빈 해(빈 종이틀)'}: 두 카드의 위끝·아래끝·높이 차 ≤ 1px · 그림은 5:4 그대로(잘림 0) · 캡션은 카드 안 · 넘침 0`, async ({ page }) => {
        test.setTimeout(60_000);
        await open(page, width, height, age);
        const scene = await box(page, 'family-scene');
        const eraCard = await box(page, 'era-card');
        expect(Math.abs(eraCard.h - scene.h), `높이 차 ${eraCard.h} vs ${scene.h}`).toBeLessThanOrEqual(1);
        expect(Math.abs(eraCard.y - scene.y), '위끝').toBeLessThanOrEqual(1);
        expect(Math.abs(eraCard.bottom - scene.bottom), '아래끝').toBeLessThanOrEqual(1);
        // 그림 상자: 5:4 그대로, 카드 폭 안, 가운데
        const pic = await page.evaluate(() => {
          const p = document.querySelector('#scene-era .era__pic')!.getBoundingClientRect();
          const c = document.querySelector('[data-testid="era-card"]')!.getBoundingClientRect();
          const e = document.querySelector('#scene-era')!.getBoundingClientRect();
          const cap = document.querySelector('[data-testid="era-caption"]')?.getBoundingClientRect() ?? null;
          return { w: p.width, h: p.height, left: p.left, right: p.right, cardBottom: c.bottom, cardLeft: c.left, cardRight: c.right, eraMid: (e.left + e.right) / 2, capBottom: cap === null ? null : cap.bottom };
        });
        expect(Math.abs(pic.w / pic.h - 1.25), `그림 비율 ${pic.w}×${pic.h}`).toBeLessThan(0.02);
        expect(pic.h, '그림이 남는 높이에 맞춰 줄어도 눈에 보이는 크기는 남는다').toBeGreaterThan(80);
        expect(pic.left).toBeGreaterThanOrEqual(pic.cardLeft - 1);
        expect(pic.right).toBeLessThanOrEqual(pic.cardRight + 1);
        expect(Math.abs((pic.left + pic.right) / 2 - pic.eraMid), '가운데 맞춤').toBeLessThanOrEqual(1);
        if (pic.capBottom !== null) expect(pic.capBottom, '캡션이 카드 아래로 잘리지 않는다').toBeLessThanOrEqual(pic.cardBottom + 1);
        expect(await noHorizontalOverflow(page), '가로 넘침 0').toBe(true);
      });
    }
  }

  test('사건 있는 해(1980)와 빈 해(1977)에서 시대의 창 카드의 높이가 같다 — 캡션 두 줄 예약이 그대로다', async ({ page }) => {
    test.setTimeout(60_000);
    await open(page, 1280, 800, 5);
    const withPic = await box(page, 'era-card');
    await open(page, 1280, 800, 2);
    const without = await box(page, 'era-card');
    expect(Math.abs(withPic.h - without.h)).toBeLessThanOrEqual(1);
  });

  test('「그림 접기」: 집 그림 카드는 짧아져도 시대의 창 카드는 계속 보이고 펼쳐진 때의 높이 그대로다(찌그러지지 않는다) — 다시 펼치면 두 카드가 다시 같다', async ({ page }) => {
    test.setTimeout(60_000);
    await open(page, 1280, 800, 5);
    const before = await box(page, 'era-card');
    const sceneBefore = await box(page, 'family-scene');
    await page.getByTestId('scene-fold').click();
    await expect(page.getByTestId('family-scene')).toHaveAttribute('data-fold', 'true');
    const scene = await box(page, 'family-scene');
    const eraCard = await box(page, 'era-card');
    expect(scene.h, '접으면 집 카드는 짧아진다').toBeLessThan(sceneBefore.h - 100);
    await expect(page.getByTestId('era-card')).toBeVisible();
    expect(Math.abs(eraCard.h - before.h), '시대의 창 카드는 펼쳐진 때의 높이 그대로').toBeLessThanOrEqual(1);
    expect(Math.abs(eraCard.h - sceneBefore.h), '= 집 카드의 펼쳐진 높이').toBeLessThanOrEqual(1);
    // 접힌 채 새로고침해도 같다(처음부터 접혀 있어도 펼쳐진 높이를 잰다)
    await page.reload();
    await expect(page.getByTestId('family-scene')).toHaveAttribute('data-fold', 'true');
    await expect(page.getByTestId('era-card')).toHaveAttribute('data-paired', 'true');
    expect(Math.abs((await box(page, 'era-card')).h - before.h), '접힌 채로 열어도 펼쳐진 높이').toBeLessThanOrEqual(1);
    await page.getByTestId('scene-fold').click();
    await expect(page.getByTestId('family-scene')).toHaveAttribute('data-fold', 'false');
    const a = await box(page, 'family-scene');
    const b = await box(page, 'era-card');
    expect(Math.abs(a.h - b.h)).toBeLessThanOrEqual(1);
  });

  test('「함께 사는 사람」을 펼쳐 집 카드가 길어져도 시대의 창 카드(와 아래 식구 카드)는 밀리지 않는다', async ({ page }) => {
    test.setTimeout(60_000);
    await open(page, 1280, 800, 5);
    const before = await box(page, 'era-card');
    const familyBefore = await box(page, 'family-card');
    await page.getByTestId('scene-more').locator('summary').click();
    await expect(page.getByTestId('scene-people')).toBeVisible();
    expect((await box(page, 'family-scene')).h, '펼치면 집 카드는 길어진다').toBeGreaterThan(before.h + 20);
    expect(Math.abs((await box(page, 'era-card')).h - before.h)).toBeLessThanOrEqual(1);
    expect(Math.abs((await box(page, 'family-card')).y - familyBefore.y)).toBeLessThanOrEqual(1);
  });
});

test.describe('휴대폰(< 960px)은 그대로다 — 집 그림 카드 아래 80px 띠', () => {
  test('360×740: 시대의 창 칸의 높이가 80px 띠이고 카드는 집 그림 카드 바로 아래다', async ({ page }) => {
    test.setTimeout(60_000);
    await startPageHidden(page);
    await page.setViewportSize({ width: 360, height: 740 });
    await injectSave(page, era(5), FAST, { ...MANUAL, bgm: { on: false, volume: 30 } });
    await expect(page.getByTestId('family-scene')).toHaveAttribute('data-scene-art', 'ready', { timeout: 15_000 });
    await expect(page.locator('#scene-era')).toHaveAttribute('data-era', /.+/, { timeout: 15_000 });
    const band = await page.evaluate(() => document.querySelector('#scene-era')!.getBoundingClientRect().height);
    expect(band, '띠 높이').toBeGreaterThanOrEqual(79.5);
    expect(band).toBeLessThanOrEqual(81);
    const scene = await box(page, 'family-scene');
    const eraCard = await box(page, 'era-card');
    expect(eraCard.y - scene.bottom, '집 그림 카드 바로 아래').toBeLessThan(24);
    expect(eraCard.h, '집 카드와 같은 높이로 맞추지 않는다').toBeLessThan(scene.h);
  });
});
