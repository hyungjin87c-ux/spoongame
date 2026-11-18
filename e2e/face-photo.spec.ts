import { expect, test, type Page } from '@playwright/test';
import type { GameState, GenerationId } from '../src/core/types';
import { KNOWN_SEED, injectSave, oracleAuto, oracleLife } from './helpers';

/**
 * 밀레니얼 얼굴 그림 80장 (PL13, IMG-001, 결정 후속 267): 밀레니얼 세대 판의 프로필 카드·엔딩은 `<img>`(192×192 WebP)로, 다른 세대는 지금의 `<svg>`로 그린다.
 * 그림 요청을 막으면(파일을 못 받음) svg로 대신한다. 처음 화면(타이틀)에서는 얼굴 그림을 요청하지 않는다. 80조합의 파일·이름 규칙은 tests/facePhoto.test.tsx가 본다.
 */

const FACE_URL = /\/faces\/millennial\/[^/]+\.webp(\?.*)?$/;

async function lifeOf(page: Page, era: GenerationId): Promise<GameState> {
  await page.goto('/');
  return oracleLife(page, KNOWN_SEED, era);
}
async function endedOf(page: Page, era: GenerationId): Promise<GameState> {
  await page.goto('/');
  const ended = await oracleAuto(page, await oracleLife(page, KNOWN_SEED, era));
  expect(ended.phase).toBe('ending');
  return ended;
}
const faceBox = (page: Page, where: 'profile-card' | 'ending-screen') => page.getByTestId(where).getByTestId('face');

/** 그림이 실제로 받아져 자연 크기 192로 그려졌다 */
async function expectLoaded192(page: Page, where: 'profile-card' | 'ending-screen'): Promise<void> {
  const img = faceBox(page, where).locator('img');
  await expect(img).toHaveCount(1);
  await expect.poll(() => img.evaluate((el: HTMLImageElement) => (el.complete ? el.naturalWidth : -1)), { timeout: 15_000 }).toBe(192);
  expect(await img.evaluate((el: HTMLImageElement) => el.naturalHeight)).toBe(192);
  expect(await img.getAttribute('alt')).toBe('');
  expect(await img.getAttribute('width')).toBe('192');
  expect(await img.getAttribute('height')).toBe('192');
  expect(await img.getAttribute('loading')).toBe('lazy');
  await expect(faceBox(page, where).locator('svg')).toHaveCount(0);
  // 상자 안에 맞는다: 96px 정사각, 그림이 상자를 넘지 않는다
  const box = await faceBox(page, where).boundingBox();
  const im = await img.boundingBox();
  expect(Math.round(box!.width)).toBe(96);
  expect(Math.round(box!.height)).toBe(96);
  expect(im!.width).toBeLessThanOrEqual(box!.width + 0.5);
  expect(im!.height).toBeLessThanOrEqual(box!.height + 0.5);
}

test('밀레니얼 판 프로필 카드: img가 뜨고 자연 크기 192로 로드된다(연령대 이름이 파일에 들어 있다)', async ({ page }) => {
  const start = await lifeOf(page, 'millennial');
  expect(start.character!.birthYear).toBeGreaterThanOrEqual(1981);
  expect(start.character!.birthYear).toBeLessThanOrEqual(1996);
  await injectSave(page, start);
  await expect(page.getByTestId('profile-card')).toBeVisible({ timeout: 30_000 });
  await expectLoaded192(page, 'profile-card');
  const src = await faceBox(page, 'profile-card').locator('img').getAttribute('src');
  expect(src).toMatch(/\/faces\/millennial\/millennial-infant-[fm]-t[1-5]-p1\.webp$/);
});

test('밀레니얼 판 엔딩: img가 뜨고 자연 크기 192로 로드된다', async ({ page }) => {
  const ended = await endedOf(page, 'millennial');
  await injectSave(page, ended, '/?__timescale=2000');
  await expect(page.getByTestId('ending-screen')).toBeVisible({ timeout: 30_000 });
  await expectLoaded192(page, 'ending-screen');
  const src = await faceBox(page, 'ending-screen').locator('img').getAttribute('src');
  expect(src).toMatch(/\/faces\/millennial\/millennial-[a-z]+-[fm]-t[1-5]-p1\.webp$/);
});

test('다른 세대 판(알파·X세대)은 svg를 그리고 얼굴 그림 요청이 0이다', async ({ page }) => {
  for (const era of ['alpha', 'genx'] as const) {
    const faceRequests: string[] = [];
    page.on('request', (r) => {
      if (FACE_URL.test(new URL(r.url()).pathname)) faceRequests.push(r.url());
    });
    const start = await lifeOf(page, era);
    await injectSave(page, start);
    await expect(page.getByTestId('profile-card')).toBeVisible({ timeout: 30_000 });
    await expect(faceBox(page, 'profile-card').locator('svg')).toHaveCount(1);
    await expect(faceBox(page, 'profile-card').locator('img')).toHaveCount(0);
    expect(faceRequests, era).toEqual([]);
    page.removeAllListeners('request');
  }
});

test('이미지 요청을 막은 밀레니얼 판은 프로필 카드·엔딩 모두 svg로 대신 그린다', async ({ page }) => {
  await page.route(FACE_URL, (route) => route.abort());
  const start = await lifeOf(page, 'millennial');
  await injectSave(page, start);
  await expect(page.getByTestId('profile-card')).toBeVisible({ timeout: 30_000 });
  await expect(faceBox(page, 'profile-card').locator('svg')).toHaveCount(1, { timeout: 15_000 });
  await expect(faceBox(page, 'profile-card').locator('img')).toHaveCount(0);

  const ended = await endedOf(page, 'millennial');
  await injectSave(page, ended, '/?__timescale=2000');
  await expect(page.getByTestId('ending-screen')).toBeVisible({ timeout: 30_000 });
  await expect(faceBox(page, 'ending-screen').locator('svg')).toHaveCount(1, { timeout: 15_000 });
  await expect(faceBox(page, 'ending-screen').locator('img')).toHaveCount(0);
});

test('처음 화면(타이틀)에서는 얼굴 그림 요청이 0이고, 프로필 카드가 뜰 때 한 장만 받는다', async ({ page }) => {
  const faceRequests: string[] = [];
  page.on('request', (r) => {
    if (FACE_URL.test(new URL(r.url()).pathname)) faceRequests.push(new URL(r.url()).pathname);
  });
  await page.goto('/');
  await expect(page.getByTestId('title-screen').or(page.locator('main')).first()).toBeVisible();
  await page.waitForTimeout(800);
  expect(faceRequests).toEqual([]);

  const start = await oracleLife(page, KNOWN_SEED, 'millennial');
  await injectSave(page, start);
  await expect(page.getByTestId('profile-card')).toBeVisible({ timeout: 30_000 });
  await expectLoaded192(page, 'profile-card');
  expect(new Set(faceRequests).size).toBe(1);
});
