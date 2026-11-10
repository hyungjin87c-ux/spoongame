import { expect, test, type Page } from '@playwright/test';
import { KNOWN_SEED, injectSave, lifeState, noHorizontalOverflow, startPageHidden } from './helpers';
import type { GameState } from '../src/core/types';
import { setRootFontPercent } from './textResize';

/**
 * SPEC-016 H2(첫 화면 CI 안 B)·H4(시대의 창 따로 칸)·H5(BGM 볼륨 막대) — 폭 320·360·768·1280 · 라이트·다크 · 글자 200%의 가로 넘침 0과 배치.
 * 뷰포트를 직접 지정하므로 어느 프로젝트에서나 돈다(desktop·mobile-360 모두 같은 결과). 구조·문구는 vitest(tests/titleScreen·sceneCard·eraChip·dashboard), 엔딩 로고 확인 단계와 로고 연타는 e2e/logo-home.spec.ts.
 */

const MANUAL = { speed: 1, autoMode: false, noteCards: false } as const;
const FAST = '/?__timescale=1000';

/** 1975년생 X세대 5세 = 1980년의 멈춘 판 — 시대의 창 그림(금남로)이 있는 해 */
function era1980(age = 5): GameState {
  const base = lifeState(KNOWN_SEED);
  const history: GameState['history'] = [{ age: 0, kind: 'stage', text: '1975년 1월, 서울특별시의 평범한 가정에서 3.2kg 남자아이로 태어났습니다. 첫째입니다.' }];
  for (let a = 1; a <= age; a++) history.push({ age: a, kind: 'event', text: `${a}세 일입니다.`, eventId: `e${a}` });
  return { ...base, generation: 'genx', character: { ...base.character!, birthYear: 1975 }, age, paused: true, history };
}

async function openEra(page: Page, width: number, height: number, bgmOn: boolean, scheme: 'light' | 'dark' = 'light', percent = 100): Promise<void> {
  await page.setViewportSize({ width, height });
  await page.emulateMedia({ colorScheme: scheme });
  await injectSave(page, era1980(), FAST, { ...MANUAL, bgm: { on: bgmOn, volume: 30 } });
  await expect(page.getByTestId('family-scene')).toHaveAttribute('data-scene-art', 'ready', { timeout: 15_000 });
  await expect(page.locator('#scene-era')).toHaveAttribute('data-era', /.+/, { timeout: 15_000 });
  if (percent !== 100) await setRootFontPercent(page, percent);
}

const rect = (page: Page, sel: string) =>
  page.evaluate((s) => {
    const r = document.querySelector(s)!.getBoundingClientRect();
    return { x: r.x, y: r.y, w: r.width, h: r.height, right: r.right, bottom: r.bottom };
  }, sel);

test.describe('H2 첫 화면 CI (안 B 가로 결합 로고)', () => {
  for (const [width, height] of [[320, 640], [360, 740], [768, 1024], [1280, 800]] as const) {
    for (const scheme of ['light', 'dark'] as const) {
      test(`${width}px · ${scheme}: 로고(심볼 + 워드마크)가 칸 안에서 보이고 가로 넘침 0 · 제목 h1은 「수저 게임」 · 로고는 링크가 아니다`, async ({ page }) => {
        await page.setViewportSize({ width, height });
        await page.emulateMedia({ colorScheme: scheme });
        await page.goto('/');
        await expect(page.getByTestId('title-screen')).toBeVisible();
        const logo = await rect(page, '[data-testid="title-logo-word"] svg');
        const hero = await rect(page, '.hero');
        expect(logo.x, '로고는 머리 칸 왼쪽 끝에서 시작').toBeGreaterThanOrEqual(hero.x - 1);
        expect(logo.right, '로고는 머리 칸 안').toBeLessThanOrEqual(hero.right + 1);
        expect(logo.right, '로고는 화면 안').toBeLessThanOrEqual(width + 0.5);
        const glyph = await page.evaluate(() => (document.querySelector('[data-testid="title-logo-word"] svg > g') as SVGGraphicsElement).getBoundingClientRect().height);
        // DS1 글자 높이 ≥ 40px — 320px에서는 칸 폭(288px)에 맞춰 로고가 줄어 39px까지 허용(마스터, title-ci.md 0절)
        expect(glyph, `워드마크 글자 높이 ${glyph}px`).toBeGreaterThanOrEqual(width <= 320 ? 38.5 : 40);
        // 심볼(정식)은 보이는 크기 ≥ 48px
        const sym = await page.evaluate(() => (document.querySelector('[data-testid="title-logo-word"] svg > path') as SVGGraphicsElement).getBoundingClientRect().height);
        expect(sym, `심볼 높이 ${sym}px`).toBeGreaterThanOrEqual(48);
        await expect(page.getByRole('heading', { level: 1 })).toHaveAccessibleName('수저 게임');
        expect(await page.locator('[data-testid="title-logo-word"]').evaluate((el) => el.closest('a, button') === null && el.getAttribute('aria-hidden') === 'true')).toBe(true);
        expect(await noHorizontalOverflow(page), '가로 넘침 0').toBe(true);
        // 로고 아래 요소(부제)는 로고와 겹치지 않는다
        const tag = await rect(page, '.hero__tag');
        expect(tag.y, '부제는 로고 아래').toBeGreaterThanOrEqual(logo.bottom - 1);
      });
    }
  }

  test('글자 200% · 320px: 로고가 넘치지 않는다', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    await page.goto('/');
    await expect(page.getByTestId('title-screen')).toBeVisible();
    await setRootFontPercent(page, 200);
    expect(await noHorizontalOverflow(page), '가로 넘침 0').toBe(true);
    expect((await rect(page, '[data-testid="title-logo-word"] svg')).right).toBeLessThanOrEqual(320.5);
  });

  test('강제 색상: 로고 심볼·글자가 시스템 글자색(투명이 아니다)이다', async ({ page }) => {
    await page.emulateMedia({ forcedColors: 'active' });
    await page.goto('/');
    await expect(page.getByTestId('title-screen')).toBeVisible();
    const c = await page.evaluate(() => ({
      sym: getComputedStyle(document.querySelector('[data-testid="title-logo-word"] svg > path')!).fill,
      word: getComputedStyle(document.querySelector('[data-testid="title-logo-word"] svg g path')!).stroke,
    }));
    expect(c.sym).not.toBe('rgba(0, 0, 0, 0)');
    expect(c.word).toBe(c.sym);
  });
});

test.describe('H4 시대의 창 따로 칸 — 넘침 0 · 다크 · 글자 200%', () => {
  for (const [width, height] of [[320, 640], [360, 740], [768, 1024], [1280, 800]] as const) {
    for (const scheme of ['light', 'dark'] as const) {
      test(`${width}px · ${scheme}: 시대의 창 카드가 보이고 가로 넘침 0 · ${width >= 960 ? '오른쪽 열 맨 위(식구 위)' : '집 그림 카드 바로 아래'}`, async ({ page }) => {
        test.setTimeout(60_000);
        await startPageHidden(page);
        await openEra(page, width, height, false, scheme);
        const card = await rect(page, '[data-testid="era-card"]');
        const scene = await rect(page, '[data-testid="family-scene"]');
        const family = await rect(page, '[data-testid="family-card"]');
        expect(card.right, '카드가 화면 안').toBeLessThanOrEqual(width + 0.5);
        if (width >= 960) {
          expect(card.x, '가운데 열 오른쪽').toBeGreaterThan(scene.right - 1);
          expect(card.bottom, '식구 카드 위').toBeLessThanOrEqual(family.y + 1);
        } else {
          expect(card.y, '집 그림 카드 아래').toBeGreaterThanOrEqual(scene.bottom - 1);
          expect(card.y - scene.bottom, '바로 아래').toBeLessThan(24);
        }
        expect(await noHorizontalOverflow(page), '가로 넘침 0').toBe(true);
      });
    }
  }

  test('글자 200% · 320px / 360px: 시대의 창 카드 캡션이 잘리지 않고 넘침 0', async ({ page }) => {
    test.setTimeout(60_000);
    await startPageHidden(page);
    for (const width of [320, 360]) {
      await openEra(page, width, 640, false, 'light', 200);
      expect(await noHorizontalOverflow(page), `${width}px 글자 200% 가로 넘침 0`).toBe(true);
      const cap = await page.evaluate(() => {
        const el = document.querySelector<HTMLElement>('[data-testid="era-caption"]')!;
        const box = document.querySelector<HTMLElement>('#scene-era')!;
        const r = el.getBoundingClientRect();
        const b = box.getBoundingClientRect();
        return { bottom: r.bottom, boxBottom: b.bottom, right: r.right, boxRight: b.right };
      });
      expect(cap.bottom, '캡션이 칸 밖으로 잘리지 않는다').toBeLessThanOrEqual(cap.boxBottom + 1);
      expect(cap.right, '캡션이 칸 오른쪽을 넘지 않는다').toBeLessThanOrEqual(cap.boxRight + 1);
    }
  });

  test('해가 바뀌어도(1980 → 빈 해) 시대의 창 카드 크기와 식구 카드 자리는 그대로다 (PC)', async ({ page }) => {
    test.setTimeout(60_000);
    await startPageHidden(page);
    await openEra(page, 1280, 800, false);
    const withPic = await rect(page, '[data-testid="era-card"]');
    const famWith = await rect(page, '[data-testid="family-card"]');
    // 사건이 없는 해(1975년생 2세 = 1977)로 바꿔 빈 종이틀 카드의 크기를 비교한다
    await injectSave(page, era1980(2), FAST, { ...MANUAL, bgm: { on: false, volume: 30 } });
    await expect(page.getByTestId('family-scene')).toHaveAttribute('data-scene-art', 'ready', { timeout: 15_000 });
    await expect(page.locator('#scene-era')).toHaveAttribute('data-empty', 'true', { timeout: 15_000 });
    const without = await rect(page, '[data-testid="era-card"]');
    const famWithout = await rect(page, '[data-testid="family-card"]');
    expect(Math.abs(without.h - withPic.h), '카드 높이(px)가 해와 무관하다').toBeLessThanOrEqual(1);
    expect(Math.abs(famWithout.y - famWith.y), '식구 카드 위치가 해마다 밀리지 않는다').toBeLessThanOrEqual(1);
  });
});

test.describe('H5 BGM 볼륨 — 휴대폰(< 960px)은 도구 줄 바로 아래 한 줄, 도구 다섯 칸은 그대로', () => {
  for (const [width, height, percent] of [[360, 740, 100], [320, 568, 100], [320, 568, 200], [768, 1024, 100]] as const) {
    test(`${width}px · 글자 ${percent}%: BGM을 켜면 볼륨 막대 + 숫자가 생기고 도구 다섯 칸은 움직이지 않으며 넘침 0`, async ({ page }) => {
      test.setTimeout(60_000);
      await startPageHidden(page);
      await openEra(page, width, height, false, 'light', percent);
      const ids = ['tool-bgm', 'tool-note', 'tool-dark', 'tool-feedback', 'tool-exit'];
      const read = () =>
        page.evaluate((list) => Object.fromEntries(list.map((id) => {
          const r = document.querySelector(`[data-testid="${id}"]`)!.getBoundingClientRect();
          return [id, { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }];
        })), ids);
      const before = await read();
      await page.getByTestId('tool-bgm').scrollIntoViewIfNeeded();
      await page.getByTestId('tool-bgm').click();
      const volume = page.getByTestId('bgm-volume');
      await expect(volume).toBeVisible();
      await expect(volume.locator('output')).toHaveText('30%');
      await expect(page.getByTestId('bgm-volume-input')).toHaveAttribute('aria-valuetext', '30%');
      // 이름 「BGM 볼륨」은 읽기 전용 글자로 남는다
      await expect(volume).toContainText('BGM 볼륨');
      const after = await read();
      for (const id of ids) expect(after[id], `${id} 자리 그대로`).toEqual(before[id]);
      const vb = (await volume.boundingBox())!;
      expect(vb.x, '막대 줄이 화면 안(왼쪽)').toBeGreaterThanOrEqual(-0.5);
      expect(vb.x + vb.width, '막대 줄이 화면 안(오른쪽)').toBeLessThanOrEqual(width + 0.5);
      const toolsBottom = Math.max(...ids.map((id) => after[id].y + after[id].h));
      expect(vb.y, '막대는 도구 줄 바로 아래').toBeGreaterThanOrEqual(toolsBottom - 1);
      expect(await noHorizontalOverflow(page), '가로 넘침 0').toBe(true);
      // 키보드로 조절(→)
      await page.getByTestId('bgm-volume-input').focus();
      await page.keyboard.press('ArrowRight');
      await expect(volume.locator('output')).toHaveText('35%');
    });
  }
});
