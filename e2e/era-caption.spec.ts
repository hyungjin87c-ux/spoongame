import { expect, test, type Page } from '@playwright/test';
import type { GameState } from '../src/core/types';
import { KNOWN_SEED, injectSave, lifeState, noHorizontalOverflow, type InjectedSettings } from './helpers';

/**
 * SPEC-013 T3·T7 시대의 창 캡션 · 빈 해 종이틀(안 B) · 가리기 (표준 레인, 실제 브라우저 Chromium — desktop 1280×800과 mobile-360 두 프로젝트).
 * 문구·접근 이름·DOM 모양은 tests/sceneCard.test.tsx·tests/eraChip.test.tsx(서버 렌더)가 보고, 여기서는 **실제 폭의 배치**를 본다:
 *  - 사건 해(2020 코로나19)의 창에 캡션이 항상 보이는 글자로 있고(툴팁 아님) 그림·「예측」 칩을 가리지 않는다(PC는 그림 아래, 휴대폰 띠는 그림 옆).
 *  - 사건이 없는 해(2021)의 창은 캡션 없이 종이틀 하나(링크 아님)이고, **창 칸의 자리·크기가 사건 해·가린 해·미래 해와 같다**(해가 바뀌어도 화면이 흔들리지 않는다 — 완료 기준 7).
 *  - 가리기를 켠 무거운 사건(2022 골목)의 창은 빈 해와 같은 틀 + 캡션 「가려 둔 장면」이다.
 *  - 360px·글자 200%에서 가로 넘침 0 · 캡션이 창 칸 밖으로 나가지 않는다.
 */

/** 알파 2016년생 `year`년의 멈춘 판 (부모 재력 3). 나이마다 기록 줄 하나, 20세 이상에는 자산이 필요하다 */
function atYear(year: number): GameState {
  const base = lifeState(KNOWN_SEED);
  const age = year - 2016;
  const history: GameState['history'] = [{ age: 0, kind: 'stage', text: '2016년 1월, 서울특별시의 평범한 가정에서 3.2kg 남자아이로 태어났습니다. 첫째입니다.' }];
  for (let a = 1; a <= age; a++) history.push({ age: a, kind: 'event', text: `${a}세의 일입니다.`, eventId: `e${a}` });
  const assets = age >= 20 ? { assets: { net: 5000, income: 4500, debt: 0, incomeAdj: 0, dwelling: 'rent' as const }, familyFund: 0 } : {};
  return { ...base, age, paused: true, history, ...assets };
}
const FAST = '/?__timescale=1000';
/** 사건이 있는 해(이 시험이 쓰는 것) — 그 해의 10년 덩어리가 오면 인생 기록에 `#log-y<해>` 줄이 선다 */
const EVENT_YEARS = new Set([2020, 2022, 2030]);
// 개발 서버가 처음 뜰 때(첫 페이지 로드가 길다)와 한 시험 안에서 판을 세 번 여는 시험을 위해 시간 한도를 넉넉히 둔다
test.setTimeout(90_000);
const MANUAL = { speed: 1, autoMode: false, noteCards: false } as const;

async function open(page: Page, year: number, settings: Partial<InjectedSettings> = {}): Promise<void> {
  await injectSave(page, atYear(year), FAST, { ...MANUAL, ...settings });
  await expect(page.getByTestId('family-scene')).toHaveAttribute('data-scene-art', 'ready', { timeout: 15_000 });
  await expect(page.locator('#scene-era')).toBeVisible();
  // 시대의 창 10년 덩어리는 집 그림과 따로 도착한다 — 그 덩어리가 온 뒤(인생 기록에 시대 줄이 선 뒤)에 잰다. 사건이 없는 해는 어느 시대 줄이든 하나가 서면 덩어리가 온 것이다
  await expect((EVENT_YEARS.has(year) ? page.locator(`#log-y${year}`) : page.locator('[data-tl="era"]').first()), `${year}: 시대의 창 덩어리`).toBeAttached({ timeout: 20_000 });
}
async function eraBox(page: Page): Promise<{ x: number; y: number; width: number; height: number }> {
  return (await page.locator('#scene-era').boundingBox())!;
}
const rect = (page: Page, selector: string): Promise<{ left: number; right: number; top: number; bottom: number }> =>
  page.locator(selector).first().evaluate((el) => {
    const r = el.getBoundingClientRect();
    return { left: r.left, right: r.right, top: r.top, bottom: r.bottom };
  });
const overlaps = (a: { left: number; right: number; top: number; bottom: number }, b: { left: number; right: number; top: number; bottom: number }): boolean => a.left < b.right - 0.5 && b.left < a.right - 0.5 && a.top < b.bottom - 0.5 && b.top < a.bottom - 0.5;

test('사건 해(2020 코로나19): 캡션이 항상 보이는 글자로 창 칸 안에 있고, 접근 이름이 캡션으로 시작한다 — 툴팁이 아니다', async ({ page }) => {
  await open(page, 2020);
  await expect(page.locator('#scene-era')).toHaveAttribute('data-era', 'era-2020-screening-tent-queue', { timeout: 15_000 });
  const cap = page.getByTestId('era-caption');
  await expect(cap).toBeVisible();
  await expect(cap).toHaveText('코로나19');
  await expect(page.locator('#scene-era')).toHaveAccessibleName(/^코로나19\. 1월, 새 감염병이 들어와 온 나라가 마스크를 썼습니다\. 집에서는 .+ 그해 기록으로$/);
  // 12px(--fs-xs) 보통 굵기의 작은 글자 — 하한(12px)보다 작지 않다
  const style = await cap.evaluate((el) => {
    const cs = getComputedStyle(el);
    return { size: parseFloat(cs.fontSize), weight: cs.fontWeight, vis: cs.visibility, display: cs.display };
  });
  expect(style.size).toBeGreaterThanOrEqual(12);
  expect(style.weight).toBe('400');
  expect(style.display).not.toBe('none');
  // 창 칸 안, 그림을 가리지 않는다
  const era = await rect(page, '#scene-era');
  const pic = await rect(page, '#scene-era .era__pic');
  const c = await rect(page, '[data-testid="era-caption"]');
  expect(c.left).toBeGreaterThanOrEqual(era.left - 0.5);
  expect(c.right).toBeLessThanOrEqual(era.right + 0.5);
  expect(c.bottom).toBeLessThanOrEqual(era.bottom + 0.5);
  expect(overlaps(c, pic), '캡션이 그림 상자와 겹치지 않는다').toBe(false);
  if (page.viewportSize()!.width <= 480) expect(c.left, '휴대폰 띠: 캡션은 그림(100px) 옆').toBeGreaterThanOrEqual(pic.right - 0.5);
  else expect(c.top, 'PC: 캡션은 그림 아래').toBeGreaterThanOrEqual(pic.bottom - 0.5);
  expect(await noHorizontalOverflow(page)).toBe(true);
});

test('빈 해(2021): 캡션도 링크도 그림도 없고 종이틀(era__sheet)뿐이다 — 칸의 자리·크기는 사건 해(2020)·가린 해(2022)·미래 해(2030)와 같다', async ({ page }) => {
  const boxes: Record<string, { x: number; y: number; width: number; height: number }> = {};
  for (const [label, year, gentle] of [['사건', 2020, false], ['빈', 2021, false], ['가림', 2022, true], ['미래', 2030, false]] as const) {
    await open(page, year, { gentle });
    if (label === '빈') {
      await expect(page.locator('#scene-era')).toHaveAttribute('data-empty', 'true');
      expect(await page.locator('#scene-era a, a#scene-era').count(), '빈 해는 링크가 아니다').toBe(0);
      expect(await page.getByTestId('era-caption').count(), '빈 해에는 캡션이 없다').toBe(0);
      await expect(page.locator('#scene-era .era__sheet')).toHaveCount(1);
      expect(await page.locator('#scene-era svg').count(), '점무늬 SVG가 없다(안 B 종이틀은 CSS뿐)').toBe(0);
      expect(await page.locator('[data-tl="era"]#log-y2021').count(), '빈 해의 인생 기록에는 시대 줄이 없다').toBe(0);
    } else {
      await expect(page.locator('#scene-era')).not.toHaveAttribute('data-empty', 'true', { timeout: 15_000 });
    }
    boxes[label] = await eraBox(page);
  }
  const ref = boxes['사건'];
  for (const [label, b] of Object.entries(boxes)) {
    expect(Math.abs(b.width - ref.width), `${label}: 칸 너비`).toBeLessThan(1);
    expect(Math.abs(b.height - ref.height), `${label}: 칸 높이`).toBeLessThan(1);
    expect(Math.abs(b.y - ref.y), `${label}: 칸 위치`).toBeLessThan(1);
  }
});

test('가리기를 켠 무거운 사건(2022 골목): 그림 없는 종이틀 + 캡션 「가려 둔 장면」이고 문장·사건 캡션은 어디에도 없다, 창은 그해 기록으로 가는 링크 하나다', async ({ page }) => {
  await open(page, 2022, { gentle: true });
  const era = page.locator('#scene-era');
  await expect(era).toHaveAttribute('data-hidden', 'true', { timeout: 15_000 });
  await expect(page.getByTestId('era-caption')).toHaveText('가려 둔 장면');
  await expect(era).toHaveAccessibleName(/^가려 둔 장면\. 그해 기록으로$/);
  await expect(era.locator('.era__sheet')).toHaveCount(1);
  expect(await era.locator('svg').count(), '그림 없음').toBe(0);
  const body = await page.locator('body').innerText();
  expect(body).not.toContain('골목');
  await expect(era).toHaveAttribute('href', '#log-y2022');
});

test('캡션과 「예측」 칩이 함께 있는 해(2030)에도 둘이 겹치지 않고 그림을 가리지 않는다', async ({ page }) => {
  await open(page, 2030);
  await expect(page.locator('#scene-era')).toHaveAttribute('data-future', 'true', { timeout: 15_000 });
  const fc = await rect(page, '[data-testid="era-fc"]');
  const cap = await rect(page, '[data-testid="era-caption"]');
  const pic = await rect(page, '#scene-era .era__pic');
  expect(overlaps(fc, cap), '칩과 캡션').toBe(false);
  if (page.viewportSize()!.width <= 480) {
    expect(overlaps(fc, pic), '휴대폰: 칩이 그림(100×80)을 가리지 않는다').toBe(false);
    expect(overlaps(cap, pic), '휴대폰: 캡션이 그림을 가리지 않는다').toBe(false);
    expect(cap.top, '캡션은 칩 아래').toBeGreaterThanOrEqual(fc.bottom - 0.5);
  }
  expect(await noHorizontalOverflow(page)).toBe(true);
});

for (const [w, h] of [[360, 740], [320, 640]] as const) {
  test(`넘침 0 · 글자 200% · ${w}px: 캡션이 창 칸 밖으로 나가지 않고 가로 넘침이 없으며, 칸 높이가 사건 해·빈 해·미래 해에서 같다`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: h });
    const heights: number[] = [];
    for (const year of [2020, 2021, 2030]) {
      await open(page, year);
      await page.addStyleTag({ content: 'html { font-size: 200% !important; }' });
      expect(await noHorizontalOverflow(page), `${year}: 가로 넘침`).toBe(true);
      if (year !== 2021) {
        const era = await rect(page, '#scene-era');
        const cap = await rect(page, '[data-testid="era-caption"]');
        expect(cap.left).toBeGreaterThanOrEqual(era.left - 0.5);
        expect(cap.right, `${year}: 캡션이 칸 안`).toBeLessThanOrEqual(era.right + 0.5);
        expect(cap.bottom, `${year}: 캡션이 칸 안(아래)`).toBeLessThanOrEqual(era.bottom + 1);
      }
      heights.push((await eraBox(page)).height);
    }
    expect(Math.max(...heights) - Math.min(...heights), `글자 200%의 칸 높이 ${heights.join(' · ')}`).toBeLessThan(1);
  });
}

for (const theme of ['dark'] as const) {
  test(`다크: 캡션 글자색이 파인 면 위에서 읽히고(대비 ≥ 4.5:1) 종이틀·캡션이 보인다 (${theme})`, async ({ page }) => {
    await open(page, 2020, { theme });
    const ratio = await page.evaluate(() => {
      const cap = document.querySelector('[data-testid="era-caption"]')!;
      const parse = (s: string): number[] => (s.match(/[\d.]+/g) ?? []).slice(0, 3).map(Number);
      const lum = ([r, g, b]: number[]): number => {
        const f = (v: number): number => ((v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
        return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
      };
      let bgEl: Element | null = cap;
      let bg = 'rgba(0, 0, 0, 0)';
      while (bgEl !== null && /rgba\(0, 0, 0, 0\)|transparent/.test(bg)) {
        bg = getComputedStyle(bgEl).backgroundColor;
        bgEl = bgEl.parentElement;
      }
      const a = lum(parse(getComputedStyle(cap).color));
      const b = lum(parse(bg));
      return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
    });
    expect(ratio, `캡션 대비 ${ratio.toFixed(2)}`).toBeGreaterThanOrEqual(4.5);
  });
}
