import { expect, test, type Page } from '@playwright/test';
import { KNOWN_SEED, injectSave, lifeState, startPageHidden } from './helpers';

/**
 * SPEC-016 H5 · QA-016 H5-01 — PC(≥ 960px)에서 BGM 볼륨 막대의 눌림 영역이 세로 44px이다(도구 줄 높이 36px와 막대 모양은 그대로).
 * 눌림 영역만 `.volume input[type='range']`의 `min-height: var(--hit)` + 음수 margin-block으로 넓혔다(배치 높이는 24px 그대로 — src/styles/dash.css).
 */

async function open(page: Page, width: number, height: number): Promise<void> {
  await startPageHidden(page);
  await page.setViewportSize({ width, height });
  await injectSave(page, { ...lifeState(KNOWN_SEED), paused: true }, '/?__timescale=1000', { speed: 1, autoMode: false, noteCards: false, bgm: { on: true, volume: 30 } });
  await expect(page.getByTestId('bgm-volume-input')).toBeVisible({ timeout: 15_000 });
}

/** 점 (x, y)에 닿는 요소가 data-testid 하나로 이름 붙은 어느 조상인가 */
const hitAt = (page: Page, x: number, y: number) =>
  page.evaluate(([px, py]) => document.elementFromPoint(px, py)?.closest('[data-testid]')?.getAttribute('data-testid') ?? null, [x, y] as const);

for (const [width, height] of [[1280, 800], [1100, 800]] as const) {
  test(`${width}px: 볼륨 막대 눌림 영역 세로 44px(중심 ±22px) · 도구 줄 36px · 막대 모양(배치 24px) 불변 · 이웃 버튼의 눌림을 가로채지 않는다`, async ({ page }) => {
    test.setTimeout(60_000);
    await open(page, width, height);
    const input = page.getByTestId('bgm-volume-input');
    const box = (await input.boundingBox())!;
    expect(box.height, '눌림 영역(입력 상자) 높이').toBeGreaterThanOrEqual(43.5);
    const label = (await page.getByTestId('bgm-volume').boundingBox())!;
    expect(label.height, '배치 높이는 그대로(막대 + 숫자 칸 24px 안팎, 도구 줄을 키우지 않는다)').toBeLessThanOrEqual(30);
    const bar = await page.evaluate(() => document.querySelector('.toolbar__inner')!.getBoundingClientRect().height);
    expect(Math.abs(bar - 36), '도구 줄 높이 36 불변').toBeLessThanOrEqual(1);
    const bgm = (await page.getByTestId('tool-bgm').boundingBox())!;
    const note = (await page.getByTestId('tool-note').boundingBox())!;

    // (c) 이웃 버튼: 막대 가로 범위 밖의 점은 막대에 닿지 않고, 버튼의 위·아래 가장자리 점도 각자 버튼에 간다
    for (const [id, b] of [['tool-bgm', bgm], ['tool-note', note]] as const) {
      for (const fy of [0.1, 0.5, 0.9]) expect(await hitAt(page, b.x + b.width / 2, b.y + b.height * fy), `${id} ${fy}`).toBe(id);
      for (const fx of [0.05, 0.95]) expect(await hitAt(page, b.x + b.width * fx, b.y + b.height / 2), `${id} 가로 ${fx}`).toBe(id);
    }
    expect(box.x, '막대 상자는 BGM 칸 오른쪽').toBeGreaterThanOrEqual(bgm.x + bgm.width - 1);
    expect(box.x + box.width, '막대 상자는 생각 남기기 칸 왼쪽').toBeLessThanOrEqual(note.x + 1);

    // (a) 중심 ±21px 세로 점: 막대에 닿고 눌러 값이 바뀐다 — BGM은 그대로 켜져 있다
    const cx = box.x + box.width * 0.9;
    const cy = box.y + box.height / 2;
    for (const dy of [-21, 21]) expect(await hitAt(page, cx, cy + dy), `중심 ${dy > 0 ? '+' : ''}${dy}px`).toBe('bgm-volume-input');
    for (const [dy, target] of [[-21, 90], [21, 10]] as const) {
      const x = box.x + box.width * (target / 100) + (target === 10 ? 4 : -4);
      await page.mouse.click(x, cy + dy);
      const v = Number(await input.inputValue());
      expect(Math.abs(v - target), `중심 ${dy}px를 눌러 값이 그 가로 위치로 바뀐다(${v})`).toBeLessThanOrEqual(15);
      await expect(page.getByTestId('tool-bgm')).toHaveAttribute('aria-pressed', 'true');
    }
    expect(Math.abs((await page.evaluate(() => document.querySelector('.toolbar__inner')!.getBoundingClientRect().height)) - 36)).toBeLessThanOrEqual(1);
    // 막대 위아래 한 칸 밖(±26px)은 막대가 아니다
    for (const dy of [-26, 26]) expect(await hitAt(page, cx, cy + dy), `중심 ${dy}px 밖`).not.toBe('bgm-volume-input');
    // 이웃 버튼은 실제 클릭이 각자 버튼에 간다: BGM 칸을 누르면 BGM이 꺼진다
    await page.getByTestId('tool-bgm').click();
    await expect(page.getByTestId('tool-bgm')).toHaveAttribute('aria-pressed', 'false');
    await expect(page.getByTestId('bgm-volume')).toHaveCount(0);
  });
}

test('360px 휴대폰: 볼륨 막대 눌림 영역은 그대로 44px 이상이다', async ({ page }) => {
  test.setTimeout(60_000);
  await open(page, 360, 740);
  expect((await page.getByTestId('bgm-volume-input').boundingBox())!.height).toBeGreaterThanOrEqual(43.5);
});
