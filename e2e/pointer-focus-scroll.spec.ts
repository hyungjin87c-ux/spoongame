import { expect, test, type Page } from '@playwright/test';
import { setRootFontPercent } from './textResize';
import { BAR_MAIN_BUTTON, openBarState } from './titleStates';

/**
 * 눌러서 생긴 포커스는 화면을 점프시키지 않는다 (REV-003-M2-4 R-241, QA-003-M2 M2-S01의 회귀 시험).
 * 첫 화면 전체의 `focusin`이 하는 「가용 높이보다 큰 포커스 대상의 위쪽 변 맞춤」(TitleScreen → ui/focusReveal.ts#revealTopOfTallFocus)은 **키보드 포커스(:focus-visible)에만** 일한다.
 * 마우스 클릭·터치 탭으로 라디오 카드를 눌러 생긴 포커스에는 scrollY가 그대로여야 한다 — 눌렀는데 화면이 점프하면 안 된다.
 *
 * 조건: 360×568, 글자 200%, 확인 단계(띠 약 254px → 가용 높이 약 290px). 이때 「다가올 세상」 카드(약 314px)는 가용 높이보다 커서 키보드 포커스라면 반드시 맞춤이 일어난다(공허 통과 방지: 아래에서 확인).
 * 카드는 두 위치에서 누른다 — 위쪽 변이 화면 위로 40px 잘린 채, 위쪽 변이 화면 안(위에서 100px)에 있는 채. 라디오 카드 네 장(세상 3 + 약 30분)을 모두, 마우스와 터치로.
 * 대조: 같은 카드를 키보드 포커스로 받으면 맞춤이 일어나 scrollY가 바뀌고 카드 위쪽 변이 보인다(측정기가 맞춤을 실제로 보고 있다).
 */

const SHOTS = 'qa/screenshots/003';
const CARDS = ['era-past', 'era-present', 'era-future', 'life-short30'] as const;
type Kind = 'mouse' | 'touch';

async function prepare(page: Page): Promise<void> {
  await page.setViewportSize({ width: 360, height: 568 });
  await openBarState(page, 'confirm');
  await setRootFontPercent(page, 200);
  // SPEC-005 D5-05: 큰 슬롯의 카드가 작은 변형(`radio-card--compact`)이 되어 「다가올 세상」 카드(216px)가 확인 단계의 가용 높이(약 290px)보다 작아졌다 — 키보드 포커스라면 맞춤이 일어날 만큼 큰 카드가
  // 있어야 이 시험이 공허하지 않다. SPEC-004의 세대 카드처럼 소개 문장이 긴 카드를 합성한다(글자만 늘린다 — React는 값이 바뀌지 않은 글자 노드를 다시 쓰지 않는다)
  await page.evaluate(() => {
    const desc = document.querySelector('[data-testid="era-future"]')!.closest('label')!.querySelector('.radio-card__desc')!;
    desc.textContent = `${desc.textContent} ${'소개 문장이 길게 이어지는 합성 카드입니다.'.repeat(5)}`;
  });
  await expect(page.getByTestId(BAR_MAIN_BUTTON.confirm)).toBeEnabled(); // 입력 가드가 풀린 뒤 — 눌러도 선택이 막히지 않게
  await settle(page);
}

/** 두 프레임 + 150ms: 포커스 맞춤 스크롤이 있었다면 끝났을 시간 */
async function settle(page: Page): Promise<void> {
  await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(resolve, 150)))));
}

interface CardBox {
  /** 카드(label)의 문서 좌표 위끝 */
  docTop: number;
  height: number;
  /** 가용 높이 = 화면 − 위·아래 스크롤 여백 */
  available: number;
}

async function cardBox(page: Page, testId: string): Promise<CardBox> {
  return page.evaluate((id) => {
    const input = document.querySelector(`[data-testid="${id}"]`) as HTMLInputElement;
    const card = input.closest('label') as HTMLElement;
    const r = card.getBoundingClientRect();
    const cs = getComputedStyle(document.documentElement);
    return { docTop: r.top + window.scrollY, height: r.height, available: window.innerHeight - (parseFloat(cs.scrollPaddingTop) || 0) - (parseFloat(cs.scrollPaddingBottom) || 0) };
  }, testId);
}

/** 카드의 위쪽 변이 화면의 `top`px 자리에 오게 스크롤하고, 카드의 보이는 부분(띠 위) 한가운데 좌표를 돌려준다 */
async function scrollCardTo(page: Page, testId: string, top: number): Promise<{ x: number; y: number }> {
  const box = await cardBox(page, testId);
  await page.evaluate((y) => window.scrollTo(0, y), Math.max(0, box.docTop - top));
  await settle(page);
  return page.evaluate((id) => {
    const input = document.querySelector(`[data-testid="${id}"]`) as HTMLInputElement;
    const r = (input.closest('label') as HTMLElement).getBoundingClientRect();
    const barTop = (document.querySelector('[data-testid="bottom-bar"]') as HTMLElement).getBoundingClientRect().top;
    const y = (Math.max(r.top, 0) + Math.min(r.bottom, barTop)) / 2;
    return { x: r.left + r.width / 2, y };
  }, testId);
}

async function press(page: Page, kind: Kind, x: number, y: number): Promise<void> {
  if (kind === 'mouse') await page.mouse.click(x, y);
  else await page.touchscreen.tap(x, y);
}

async function runPointerCase(page: Page, kind: Kind): Promise<void> {
  await prepare(page);
  // 공허 통과 방지: 키보드 포커스라면 맞춤이 일어날 만큼 큰 카드(가용 높이 − 링 여유 14px 초과)가 실제로 있다
  const tall = (await Promise.all(CARDS.map(async (id) => ({ id, ...(await cardBox(page, id)) })))).filter((c) => c.height + 14 > c.available);
  expect(tall.map((c) => c.id), `가용 높이보다 큰 카드 (가용 ${Math.round((await cardBox(page, 'era-future')).available)}px)`).toContain('era-future');
  const checks: string[] = [];
  for (const id of CARDS) {
    // 위쪽 변이 화면 위로 잘린 만큼: 큰 카드는 40px. 분절 컨트롤 칸(32px, SPEC-005 HS2)처럼 작은 대상은 통째로 화면 밖으로 나가면 누를 자리가 없으니 절반 안쪽까지만 자른다
    const cut = Math.min(40, Math.floor((await cardBox(page, id)).height / 2) - 4);
    for (const top of [-cut, 100]) {
      const at = await scrollCardTo(page, id, top);
      const hit = await page.evaluate(([x, y, testId]) => {
        const el = document.elementFromPoint(x as number, y as number);
        const input = document.querySelector(`[data-testid="${testId}"]`) as HTMLInputElement;
        return el !== null && (el === input || input.closest('label')!.contains(el));
      }, [at.x, at.y, id] as const);
      expect(hit, `${id} top=${top}: 누를 자리(${Math.round(at.x)},${Math.round(at.y)})가 카드 위다`).toBe(true);
      const before = await page.evaluate(() => window.scrollY);
      await press(page, kind, at.x, at.y);
      await settle(page);
      const after = await page.evaluate(
        (testId) => ({ y: window.scrollY, focused: (document.activeElement as HTMLElement | null)?.getAttribute('data-testid') ?? '', checked: (document.querySelector(`[data-testid="${testId}"]`) as HTMLInputElement | null)?.checked ?? false }),
        id,
      );
      expect(after.focused, `${kind} ${id} top=${top}: 눌러서 카드의 입력이 포커스를 받았다(포커스 이벤트가 실제로 있었다)`).toBe(id);
      expect(after.checked, `${kind} ${id}: 눌러서 선택됐다`).toBe(true);
      expect(after.y, `${kind} ${id} top=${top}: 눌러서 생긴 포커스는 scrollY를 바꾸지 않는다 (전 ${before} → 후 ${after.y})`).toBe(before);
      checks.push(`${id}@${top}`);
    }
  }
  expect(checks, '눌러 본 (카드, 위치) 조합').toHaveLength(CARDS.length * 2);
}

test.describe('마우스', () => {
  test('360×568 글자 200% 확인 단계: 라디오 카드 네 장을 두 위치에서 마우스로 눌러도 scrollY가 변하지 않는다 (R-241)', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile-360', '뷰포트를 직접 지정하므로 mobile-360에서만 실행');
    test.setTimeout(90_000);
    await runPointerCase(page, 'mouse');
  });
});

test.describe('터치', () => {
  test.use({ hasTouch: true });
  test('360×568 글자 200% 확인 단계: 라디오 카드 네 장을 두 위치에서 터치로 탭해도 scrollY가 변하지 않는다 (R-241)', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile-360', '뷰포트를 직접 지정하므로 mobile-360에서만 실행');
    test.setTimeout(90_000);
    await runPointerCase(page, 'touch');
  });
});

test('대조: 같은 큰 카드를 키보드 포커스로 받으면 위쪽 변 맞춤이 일어나 scrollY가 바뀌고 카드 위쪽 변이 화면 안에 온다 — 위 시험이 맞춤을 실제로 볼 수 있다 (R-241)', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-360', '뷰포트를 직접 지정하므로 mobile-360에서만 실행');
  await prepare(page);
  await page.keyboard.press('Tab'); // 키보드 사용 시작(:focus-visible 모드)
  await page.evaluate(() => window.scrollTo(0, 0));
  await settle(page);
  const before = await page.evaluate(() => window.scrollY);
  await page.evaluate(() => (document.querySelector('[data-testid="era-future"]') as HTMLInputElement).focus());
  await settle(page);
  const after = await page.evaluate(() => {
    const card = (document.querySelector('[data-testid="era-future"]') as HTMLInputElement).closest('label') as HTMLElement;
    return { y: window.scrollY, top: card.getBoundingClientRect().top };
  });
  expect(before).toBe(0);
  expect(after.y, '키보드 포커스: 큰 카드 쪽으로 스크롤됐다').toBeGreaterThan(0);
  expect(after.top - 7, '카드 위쪽 변과 포커스 링이 화면 안에 있다').toBeGreaterThanOrEqual(-0.5);
  await page.screenshot({ path: `${SHOTS}/dev-M2-r6-r241-keyboard-focus-tall-card.png` });
});
