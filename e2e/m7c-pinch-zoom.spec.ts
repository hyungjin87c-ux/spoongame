import { expect, test, type CDPSession, type Page } from '@playwright/test';
import { KNOWN_SEED, injectSave, lifeState, startPageHidden } from './helpers';
import { cardReady } from './m7bStates';
import { sheetReady, shortDecision } from './m7cStates';

/**
 * 시트가 열린 동안 핀치 확대 (SPEC-003 M7c r2 R-405, content-M7c 11-8 r2-2): 스크림의 `touch-action`이 `none`이면 크로뮴 계열은 스크롤 상자(.sheet)에서 pan 비트만 되살려
 * 시트의 유효값이 `pan-y`로 줄고 핀치 확대가 시트가 떠 있는 동안 화면 어디서도 안 된다. 값이 `pinch-zoom`이면 두 손가락 벌리기가 된다 — 실제 핀치(CDP `Input.dispatchTouchEvent` 두 손가락,
 * 터치 입력)를 두 시트(기록·결정) 위에서 보내 `visualViewport.scale > 1`을 본다.
 *  - 시트 위 / 스크림(시트 바깥 바탕) 위 모두 확대된다.
 *  - 변이 점검: 스크림을 `touch-action: none`으로 되돌리면 같은 핀치가 확대되지 않는다 — 이 시험이 R-405의 실패를 실제로 잡는다(공허하지 않다).
 * T1 (a)(h)(스크림 한 손가락 끌기가 문서를 움직이지 않는다)는 e2e/m7c-scroll-lock.spec.ts가 그대로 본다.
 */

// 핀치 확대는 터치 화면의 동작이다 — 터치 화면 에뮬레이션(hasTouch)이 있어야 두 손가락 입력이 핀치 제스처로 인식된다. 데스크톱 프로젝트는 같은 시험을 되풀이하지 않는다
test.use({ hasTouch: true });
test.beforeEach(({}, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-360', '터치 전용 — mobile-360에서만 본다');
});

const MANUAL = { speed: 1, autoMode: false, noteCards: true } as const;
const OFF = { speed: 1, autoMode: false, noteCards: false } as const;

type Kind = '기록 시트' | '결정 시트';

async function open(page: Page, kind: Kind): Promise<void> {
  await page.goto('/');
  if (kind === '기록 시트') {
    await startPageHidden(page);
    await injectSave(page, lifeState(KNOWN_SEED), '/', OFF);
    await expect(page.getByTestId('tool-note')).toBeEnabled();
    await page.evaluate(() => (document.querySelector('[data-testid="tool-note"]') as HTMLElement).click());
    await sheetReady(page);
  } else {
    const state = await shortDecision(page);
    await startPageHidden(page);
    await injectSave(page, state, '/', MANUAL);
    await cardReady(page);
  }
}

const scale = (page: Page): Promise<number> => page.evaluate(() => window.visualViewport!.scale);

async function touchSession(page: Page): Promise<CDPSession> {
  return page.context().newCDPSession(page);
}

/**
 * 두 손가락 벌리기: (x, y)를 가운데로 두 손가락이 가로로 30px 간격에서 시작해 12걸음에 걸쳐 126px 간격까지 벌어진다(터치 시작 → 이동 × 12 → 끝).
 * 터치 이벤트는 브라우저가 핀치 제스처를 알아보는 실제 경로(touch-action 규칙 포함)를 그대로 거친다. (`Input.synthesizePinchGesture`는 이 헤드리스 환경에서 배율을 바꾸지 못해 쓰지 않는다.)
 */
async function pinchAt(page: Page, cdp: CDPSession, x: number, y: number): Promise<void> {
  const fingers = (half: number) => [
    { x: x - half, y, id: 1 },
    { x: x + half, y, id: 2 },
  ];
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: fingers(30) });
  for (let i = 1; i <= 12; i++) {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: fingers(30 + i * 8) });
    await page.waitForTimeout(16);
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await page.waitForTimeout(400);
}

for (const kind of ['기록 시트', '결정 시트'] as const) {
  test(`R-405 ${kind}가 열린 채 시트 위에서 핀치(두 손가락 벌리기)하면 visualViewport.scale > 1 이다`, async ({ page }) => {
    await open(page, kind);
    expect(await scale(page), '시작 배율').toBe(1);
    const box = (await page.getByRole('dialog').boundingBox())!;
    const cdp = await touchSession(page);
    await pinchAt(page, cdp, Math.round(box.x + box.width / 2), Math.round(box.y + Math.min(box.height / 2, 120)));
    expect(await scale(page), '시트 위 핀치 뒤 배율').toBeGreaterThan(1.3);
  });

  test(`R-405 ${kind}가 열린 채 스크림(시트 위쪽 바탕)에서 핀치해도 확대된다`, async ({ page }) => {
    await open(page, kind);
    const box = (await page.getByRole('dialog').boundingBox())!;
    expect(box.y, '스크림이 보이는 자리가 있다').toBeGreaterThan(60);
    const cdp = await touchSession(page);
    await pinchAt(page, cdp, Math.round(box.x + box.width / 2), Math.round(box.y / 2));
    expect(await scale(page), '스크림 위 핀치 뒤 배율').toBeGreaterThan(1.3);
  });

  test(`변이 점검 ${kind}: 스크림을 touch-action: none으로 되돌리면 같은 핀치가 확대되지 않는다 — R-405의 실패를 이 시험이 잡는다`, async ({ page }) => {
    await open(page, kind);
    await page.addStyleTag({ content: '.overlay { touch-action: none !important; }' });
    const box = (await page.getByRole('dialog').boundingBox())!;
    const cdp = await touchSession(page);
    await pinchAt(page, cdp, Math.round(box.x + box.width / 2), Math.round(box.y + Math.min(box.height / 2, 120)));
    expect(await scale(page), 'none이면 시트 안 유효 touch-action이 pan-y로 줄어 확대되지 않는다').toBe(1);
  });
}
