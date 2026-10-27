import { expect, test, type Page } from '@playwright/test';
import { injectSave, noHorizontalOverflow, titleState } from './helpers';
import { MANUAL } from './parentStates';
import { openBarState } from './titleStates';

/**
 * 첫 화면 캐러셀 21장(첫 장 세대 그래프 + 20장 — SPEC-005 QI4 2단계 FC1~FC5·SH1~SH7·HS3 ④) + QI6·QI7 뒤 마스터 결정 ①(WebKit 왼쪽 열)·③(펼친 동안 자동 넘김 멈춤)을 실제 브라우저에서 본다.
 *  · 「인생 길이」 제목이 분절 컨트롤 왼쪽 같은 줄에 있고 왼쪽 열 끝이 하단 띠(새 판 732 / 이어서 살기 680) 위다 — **Chromium·WebKit 모두** (결정 ①, `.slot--small { display: block }`)
 *  · 21장 모두 표제어·값이 스크롤 0에서 띠 위에 보인다(1280×800·1920×1080, 스위치 꺼짐·켜짐), 360×740은 카드 맨 위를 화면 맨 위에 둔 뒤 보인다 (HS3 ④)
 *  · 「전망」 칩(글자 + 아이콘)·한 줄 안내·숨긴 표·무늬(빗금·점무늬)와 강제 색상(빗금 막대는 stroke만 시스템 색)
 *  · 자살률 슬라이드를 「펼쳐 보기」로 연 동안 자동 넘김이 멈춘다 — 마우스·터치 모두, 접거나 떠나면 다시 돈다 (결정 ③)
 * 값·글자 자체(문구·좌표·20장 순서)는 단위 시험(tests/slideForms.test.ts·carousel.test.ts·statHeadlines.test.ts)이 본다. 여기서는 뷰포트를 직접 지정한다.
 */

test.describe.configure({ timeout: 180_000 });

type Rect = { x: number; y: number; w: number; h: number; right: number; bottom: number };

async function rectOf(page: Page, selector: string): Promise<Rect | null> {
  return page.evaluate((sel) => {
    const el = [...document.querySelectorAll(sel)].find((e) => {
      const b = e.getBoundingClientRect();
      return getComputedStyle(e).display !== 'none' && b.width > 0 && b.height > 0;
    }) as HTMLElement | undefined;
    if (el === undefined) return null;
    const b = el.getBoundingClientRect();
    return { x: b.x, y: b.y, w: b.width, h: b.height, right: b.right, bottom: b.bottom };
  }, selector);
}

const kindOf = (name: string): 'desktop' | 'mobile' => (name.endsWith('mobile-360') ? 'mobile' : 'desktop');
const DESKTOP_ONLY = '뷰포트를 직접 지정하므로 desktop 프로젝트에서만 실행';
const MOBILE_ONLY = '뷰포트를 직접 지정하므로 mobile-360 프로젝트에서만 실행';

/** 저장 없이 설정(무거운 장면 가리기 켜짐/꺼짐)만 주입해 첫 화면을 연다 */
async function openTitle(page: Page, width: number, height: number, gentle: boolean): Promise<void> {
  await page.setViewportSize({ width, height });
  await injectSave(page, titleState(20261013), '/', { ...MANUAL, gentle });
  await expect(page.getByTestId('title-screen')).toBeVisible();
  await expect(page.getByTestId('start-birth')).toBeEnabled({ timeout: 20_000 });
  await page.evaluate(() => document.fonts.ready);
}

/** 시스템 색 이름을 이 엔진이 실제로 내는 rgb()로 푼다 — Chromium의 ButtonText/CanvasText는 rgb(0, 0, 0)이지만 WebKit의 ButtonText는 rgba(0, 0, 0, 0.8)이다(엔진마다 시스템 색 값이 다르다) */
async function systemColor(page: Page, name: 'ButtonText' | 'CanvasText' | 'Canvas'): Promise<string> {
  return page.evaluate((n) => {
    const el = document.createElement('i');
    el.style.color = n;
    document.body.append(el);
    const c = getComputedStyle(el).color;
    el.remove();
    return c;
  }, name);
}

/** 슬라이드 수: 첫 장 세대 그래프(gen-births) + 20장 (SPEC-004 GM4 2차, D4-71) */
const SLIDE_COUNT = 21;
/** 첫 장(세대 그래프)의 큰 값은 `slide-value`가 아니라 `.gen-chart__big`이다 — 둘을 한 선택자로 */
const VALUE_SEL = '.slide.is-active [data-testid="slide-value"], .slide.is-active .gen-chart__big';
const PROJECTION_IDS = ['projection-population-total', 'projection-aging-share', 'projection-one-person-households', 'heat-projection', 'projection-newborn-age-structure'];

// ---------- ① 왼쪽 열 (두 엔진) ----------

test('「인생 길이」 제목이 분절 컨트롤 왼쪽 같은 줄에 있고(제목 오른쪽 끝 ≤ 컨트롤 왼쪽 끝, 가운데 높이 차 ≤ 8px) 한 줄 안내는 그 아래다 — Chromium·WebKit 모두 (QI6·QI7 뒤 마스터 결정 ①)', async ({ page }, testInfo) => {
  test.skip(kindOf(testInfo.project.name) !== 'desktop', DESKTOP_ONLY);
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/');
  await expect(page.getByTestId('start-birth')).toBeEnabled({ timeout: 20_000 }); // 입력 가드(0.4초)가 풀린 뒤 — 콜드 스타트한 WebKit 작업자는 5초를 넘기기도 한다
  const m = {
    legend: await rectOf(page, 'fieldset:has([data-testid="life-length-group"]) > legend'), // (태어나는 시도 칸도 `.slot--small`이라 인생 길이 칸의 legend를 이름으로 고른다)
    seg: await rectOf(page, '[data-testid="life-length-group"]'),
    hint: await rectOf(page, '[data-testid="life-length-hint"]'),
  };
  for (const [k, v] of Object.entries(m)) expect(v, `${k}가 화면에 있다`).not.toBeNull();
  expect(m.legend!.right, `제목 오른쪽 끝 ${Math.round(m.legend!.right)} ≤ 컨트롤 왼쪽 끝 ${Math.round(m.seg!.x)}`).toBeLessThanOrEqual(m.seg!.x + 1);
  const dy = Math.abs(m.legend!.y + m.legend!.h / 2 - (m.seg!.y + m.seg!.h / 2));
  expect(dy, `제목과 컨트롤의 가운데 높이 차 ${dy.toFixed(1)}px`).toBeLessThanOrEqual(8);
  expect(m.hint!.y, '한 줄 안내는 컨트롤 아래').toBeGreaterThanOrEqual(m.seg!.bottom - 1);
  console.log(`[QI4 ① ${testInfo.project.name}] legend=(${Math.round(m.legend!.x)}~${Math.round(m.legend!.right)}, y ${Math.round(m.legend!.y)}) seg=(${Math.round(m.seg!.x)}~${Math.round(m.seg!.right)}, y ${Math.round(m.seg!.y)}~${Math.round(m.seg!.bottom)}) hint.y=${Math.round(m.hint!.y)}`);
});

for (const state of ['new', 'continue'] as const) {
  test(`왼쪽 열 끝 < 하단 띠 위끝 — ${state === 'new' ? '새 판 띠(732)' : '이어서 살기 띠(680)'}, 1280×800, Chromium·WebKit 모두 (QI6·QI7 뒤 마스터 결정 ①, HS3 ③)`, async ({ page }, testInfo) => {
    test.skip(kindOf(testInfo.project.name) !== 'desktop', DESKTOP_ONLY);
    await page.setViewportSize({ width: 1280, height: 800 });
    if (state === 'new') await page.goto('/');
    else {
      await page.goto('/?__exit=1');
      await openBarState(page, 'continue');
      await expect(page.getByTestId('resume')).toBeEnabled();
    }
    await expect(page.getByTestId('start-birth').or(page.getByTestId('resume'))).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    const m = { main: await rectOf(page, '.title__main'), bar: await rectOf(page, '[data-testid="bottom-bar"]'), life: await rectOf(page, '[data-testid="life-length-group"]') };
    // 복원(GM4 2차 ④): 1차에서 「인생 길이까지」로 줄여 두었던 단언을 되돌렸다 — 세대 목록 창(PC 하한 9rem · 식 100vh − 37.5rem)과 설정 둘을 한 줄에 놓아 왼쪽 열 끝이 띠 위에 든다
    expect(m.main!.bottom, `왼쪽 열 끝 ${Math.round(m.main!.bottom)} < 띠 위끝 ${Math.round(m.bar!.y)}`).toBeLessThan(m.bar!.y);
    expect(m.life!.bottom).toBeLessThan(m.bar!.y);
    expect(await noHorizontalOverflow(page)).toBe(true);
    console.log(`[QI4 ① ${testInfo.project.name} ${state}] main.bottom=${Math.round(m.main!.bottom)} bar.y=${Math.round(m.bar!.y)} (여유 ${Math.round(m.bar!.y - m.main!.bottom)}px)`);
  });
}

// ---------- HS3 ④: 21장 모두 스크롤 0에서 표제어·값이 띠 위에 보인다 ----------

for (const vp of [
  { name: '1280x800', width: 1280, height: 800 },
  { name: '1920x1080', width: 1920, height: 1080 },
] as const) {
  for (const gentle of [false, true] as const) {
    test(`HS3 ④ ${vp.name} · 스위치 ${gentle ? '켜짐' : '꺼짐'}: 21장 모두 칩·표제어·값이 스크롤 0에서 하단 띠 위에 보이고 값 아래끝 ≤ 오른쪽 열의 보이는 끝, 가로 넘침 0`, async ({ page }, testInfo) => {
      test.skip(kindOf(testInfo.project.name) !== 'desktop', DESKTOP_ONLY);
      await openTitle(page, vp.width, vp.height, gentle);
      await page.getByTestId('carousel-pause').click(); // 측정하는 동안 슬라이드가 바뀌지 않게
      expect(await page.getByTestId('stat-slide').count()).toBe(SLIDE_COUNT);
      const rows: string[] = [];
      for (let i = 0; i < SLIDE_COUNT; i++) {
        const id = (await page.locator('.slide.is-active').getAttribute('data-slide-id'))!;
        const m = {
          chip: await rectOf(page, '.slide.is-active .chip'),
          insight: await rectOf(page, '.slide.is-active .slide__insight'),
          value: await rectOf(page, VALUE_SEL),
          bar: await rectOf(page, '[data-testid="bottom-bar"]'),
          side: await rectOf(page, '.title__side'),
        };
        expect(await page.evaluate(() => scrollY), `${id} 스크롤 0`).toBe(0);
        expect(m.insight!.bottom, `${i + 1}번 ${id} 표제어 아래끝 ${Math.round(m.insight!.bottom)} < 띠 위끝 ${Math.round(m.bar!.y)}`).toBeLessThan(m.bar!.y);
        if (PROJECTION_IDS.includes(id)) {
          expect(m.chip, `${id}: 「전망」 칩이 보인다`).not.toBeNull();
          expect(m.chip!.bottom, `${id} 칩은 표제어 위`).toBeLessThanOrEqual(m.insight!.y + 1);
        } else {
          expect(m.chip, `${id}: 전망이 아니라 칩이 없다`).toBeNull();
        }
        const veiled = gentle && id === 'suicide-rate';
        if (veiled) expect(m.value, '켜면 자살률 값은 가려져 있다').toBeNull();
        else {
          expect(m.value, `${id} 값이 보인다`).not.toBeNull();
          expect(m.value!.bottom, `${i + 1}번 ${id} 값 아래끝 ${Math.round(m.value!.bottom)} < 띠 위끝 ${Math.round(m.bar!.y)}`).toBeLessThan(m.bar!.y);
          expect(m.value!.bottom, `${id} 값 아래끝 ≤ 열 끝 ${Math.round(m.side!.bottom)}`).toBeLessThanOrEqual(m.side!.bottom + 0.5);
        }
        rows.push(`${i + 1}:${id.replace('projection-', 'p-').slice(0, 14)} ins↓${Math.round(m.insight!.bottom)} val↓${m.value === null ? '-' : Math.round(m.value.bottom)}`);
        expect(await noHorizontalOverflow(page), `${id} 가로 넘침 0`).toBe(true);
        if (i < SLIDE_COUNT - 1) await page.getByTestId('carousel-next').click();
        await expect(page.locator('.slide.is-active')).toHaveCount(1);
      }
      console.log(`[QI4 HS3④ ${vp.name} ${gentle ? 'on ' : 'off'}] 띠 위끝=${Math.round((await rectOf(page, '[data-testid="bottom-bar"]'))!.y)} ${rows.join(' | ')}`);
    });
  }
}

for (const gentle of [false, true] as const) {
  test(`HS3 ④ 360x740 · 스위치 ${gentle ? '켜짐' : '꺼짐'}: 21장 모두 카드 맨 위를 화면 맨 위에 둔 뒤 표제어·값이 하단 띠 위에 보이고 가로 넘침 0 (한 칸 레이아웃이라 카드는 스크롤해서 본다)`, async ({ page }, testInfo) => {
    test.skip(kindOf(testInfo.project.name) !== 'mobile', MOBILE_ONLY);
    await openTitle(page, 360, 740, gentle);
    await page.getByTestId('carousel-pause').click();
    const rows: string[] = [];
    for (let i = 0; i < SLIDE_COUNT; i++) {
      const id = (await page.locator('.slide.is-active').getAttribute('data-slide-id'))!;
      // 카드 맨 위(조작 줄)를 화면 맨 위에 둔다
      await page.evaluate(() => {
        const card = document.querySelector('[data-testid="carousel"]')!.getBoundingClientRect();
        window.scrollTo(0, window.scrollY + card.top - 4);
      });
      const m = {
        insight: await rectOf(page, '.slide.is-active .slide__insight'),
        value: await rectOf(page, VALUE_SEL),
        bar: await rectOf(page, '[data-testid="bottom-bar"]'),
        chip: await rectOf(page, '.slide.is-active .chip'),
      };
      expect(m.insight!.bottom, `${i + 1}번 ${id} 표제어 아래끝 ${Math.round(m.insight!.bottom)} < 띠 위끝 ${Math.round(m.bar!.y)}`).toBeLessThan(m.bar!.y);
      if (!(gentle && id === 'suicide-rate')) {
        expect(m.value, `${id} 값이 보인다`).not.toBeNull();
        expect(m.value!.bottom, `${i + 1}번 ${id} 값 아래끝 ${Math.round(m.value!.bottom)} < 띠 위끝 ${Math.round(m.bar!.y)}`).toBeLessThan(m.bar!.y);
      }
      if (PROJECTION_IDS.includes(id)) expect(m.chip, `${id} 칩`).not.toBeNull();
      expect(await noHorizontalOverflow(page), `${id} 가로 넘침 0`).toBe(true);
      rows.push(`${i + 1}:${id.replace('projection-', 'p-').slice(0, 14)} ins↓${Math.round(m.insight!.bottom)} val↓${m.value === null ? '-' : Math.round(m.value.bottom)}`);
      await page.getByTestId('carousel-next').click();
    }
    console.log(`[QI4 HS3④ 360x740 ${gentle ? 'on ' : 'off'}] ${rows.join(' | ')}`);
  });
}

// ---------- 전망 표시·숨긴 표·무늬 ----------

test('전망 5장: 칩 「전망」(글자 + 아이콘 i-proj, 14px)·정의 아래 한 줄 안내가 보이고, 격차·기존 14장에는 없다 · 그래프 밖 표는 눈에 보이지 않는다(sr-only) · 무늬는 스프라이트 하나에서 온다 (FC2, D5-69)', async ({ page }, testInfo) => {
  test.skip(kindOf(testInfo.project.name) !== 'desktop', DESKTOP_ONLY);
  await openTitle(page, 1280, 800, false);
  await page.getByTestId('carousel-pause').click();
  const seen: string[] = [];
  for (let i = 0; i < SLIDE_COUNT; i++) {
    const slide = page.locator('.slide.is-active');
    const id = (await slide.getAttribute('data-slide-id'))!;
    if (PROJECTION_IDS.includes(id)) {
      seen.push(id);
      const chip = slide.locator('.chip.chip--proj');
      await expect(chip).toHaveCount(1);
      await expect(chip).toHaveText('전망');
      const icon = await chip.locator('svg.icon use').getAttribute('href');
      expect(icon).toBe('#i-proj');
      const box = await chip.locator('svg.icon').boundingBox();
      expect(Math.round(box!.width), `${id} 칩 아이콘 14px`).toBe(14);
      await expect(slide.getByTestId('slide-projnote')).toHaveText('전망은 예측이 아니라 공식 추계입니다. 가정이 달라지면 값도 달라집니다.');
      // 칩은 표제어 위 첫 줄, 한 줄 안내는 정의 줄 아래·출처 줄 위
      const order = await slide.evaluate((el) => {
        const y = (sel: string) => (el.querySelector(sel) as HTMLElement).getBoundingClientRect().top;
        return [y('.slide__chips'), y('.slide__insight'), y('p.t-muted'), y('.slide__projnote'), y('.slide__meta')];
      });
      expect([...order].sort((a, b) => a - b), `${id} 칩 → 표제어 → 정의 → 한 줄 → 출처 순서`).toEqual(order);
      expect(await slide.getAttribute('aria-label'), `${id} 읽기 이름은 「n/21 전망, …」`).toMatch(/^\d+\/21 전망, /);
    } else {
      await expect(slide.locator('.chip')).toHaveCount(0);
      await expect(slide.getByTestId('slide-projnote')).toHaveCount(0);
    }
    // 그래프 밖 표(sr-only)는 화면에 상자가 1px 이하로 접혀 눈에 안 보인다
    for (const t of await slide.getByTestId('chart-table').all()) {
      const b = await t.boundingBox();
      expect(b === null || (b.width <= 1.5 && b.height <= 1.5), `${id} 그래프 밖 표는 눈에 보이지 않는다`).toBe(true);
    }
    if (i < SLIDE_COUNT - 1) await page.getByTestId('carousel-next').click();
  }
  expect(seen).toEqual(PROJECTION_IDS);
  // 무늬: 스프라이트에 한 번씩, 차트 SVG 안에는 <defs>·<pattern>이 없다
  const patterns = await page.evaluate(() => ({
    hatch: document.querySelectorAll('pattern#hatch').length,
    dots: document.querySelectorAll('pattern#dots').length,
    inChart: document.querySelectorAll('svg.chart pattern, svg.chart defs').length,
    iconProj: document.querySelectorAll('symbol#i-proj').length,
  }));
  expect(patterns).toEqual({ hatch: 1, dots: 1, inChart: 0, iconProj: 1 });
});

test('무늬 채움: 폭염 전망 막대는 빗금(#hatch) · 아기 65세 이상 칸은 점무늬(#dots) · 놋쇠 빗금은 아기 슬라이드에 쓰지 않는다 (R-477) — 강제 색상에서도 채움이 남고 막대 테두리만 시스템 색이다', async ({ page }, testInfo) => {
  test.skip(kindOf(testInfo.project.name) !== 'desktop', DESKTOP_ONLY);
  await openTitle(page, 1280, 800, false);
  await page.getByTestId('carousel-pause').click();
  const go = async (id: string) => {
    for (let i = 0; i < SLIDE_COUNT && (await page.locator('.slide.is-active').getAttribute('data-slide-id')) !== id; i++) await page.getByTestId('carousel-next').click();
    await expect(page.locator('.slide.is-active')).toHaveAttribute('data-slide-id', id);
  };
  const fills = () =>
    page.evaluate(() => {
      const q = (sel: string) => {
        const el = document.querySelector(`.slide.is-active ${sel}`);
        if (el === null) return null;
        const cs = getComputedStyle(el);
        return { fill: cs.fill, stroke: cs.stroke };
      };
      return {
        projBar: q('.chart-bar--proj'),
        nowBar: q('.chart-bar:not(.chart-bar--proj)'),
        old: q('.chart-seg--old'),
        young: q('.chart-seg--young'),
        work: q('.chart-seg--work'),
        swProj: q('.swatch-rect--proj'),
        swOld: q('.swatch-rect--old'),
      };
    });
  await go('heat-projection');
  let f = await fills();
  expect(f.projBar!.fill, '전망 막대 = 빗금').toContain('#hatch');
  expect(f.nowBar!.fill, '현재 막대는 실선 채움').not.toContain('url');
  expect(f.swProj!.fill).toContain('#hatch');
  expect(f.old, '폭염 슬라이드에는 점무늬 칸이 없다').toBeNull();
  await go('projection-newborn-age-structure');
  f = await fills();
  expect(f.old!.fill, '65세 이상 칸 = 점무늬').toContain('#dots');
  expect(f.swOld!.fill).toContain('#dots');
  expect(f.projBar, '아기 슬라이드에는 놋쇠 빗금 막대가 없다 (빗금은 「전망」 전용)').toBeNull();
  expect(f.young!.fill, '0~14세 칸은 빈 칸(면 색)').not.toContain('url');
  // 강제 색상: 채움은 그대로, 빗금 막대의 테두리만 시스템 색(검정) — 막대 전체에 fill 시스템 색을 주면 빗금이 사라진다
  await page.emulateMedia({ forcedColors: 'active', colorScheme: 'light' });
  const canvasText = await systemColor(page, 'CanvasText');
  const buttonText = await systemColor(page, 'ButtonText');
  await go('heat-projection');
  f = await fills();
  expect(f.projBar!.fill, '강제 색상에서도 빗금 채움이 남는다').toContain('#hatch');
  expect(f.projBar!.stroke, '빗금 막대 테두리 = CanvasText').toBe(canvasText);
  await expect(page.locator('.slide.is-active .chip')).toHaveCSS('color', canvasText);
  await go('projection-newborn-age-structure');
  f = await fills();
  expect(f.old!.fill).toContain('#dots');
  expect(f.old!.stroke).toBe(canvasText);
  expect(f.work!.fill, `채움 칸 = ButtonText(${buttonText}) — 엔진이 내는 시스템 색 값과 비교한다`).toBe(buttonText);
});

// ---------- ③ 펼쳐 보기 동안 자동 넘김 멈춤 ----------

test.describe('자살률 슬라이드를 펼쳐 둔 동안 자동 넘김이 멈춘다 (QI6·QI7 뒤 마스터 결정 ③)', () => {
  const autoplay = (page: Page) => page.getByTestId('carousel').getAttribute('data-autoplay');
  const active = (page: Page) => page.locator('.slide.is-active').getAttribute('data-slide-id');

  /** 마우스 시험: 포인터가 카드 위에 있으면 그것만으로 멈추므로 카드 밖으로 치워 둔다 */
  async function parkMouse(page: Page): Promise<void> {
    await page.mouse.move(2, 2);
  }

  async function openGentleTitle(page: Page): Promise<void> {
    await page.setViewportSize({ width: 1280, height: 800 });
    await injectSave(page, titleState(20261013), '/', { ...MANUAL, gentle: true });
    await expect(page.getByTestId('start-birth')).toBeEnabled({ timeout: 20_000 });
  }

  test('마우스: 펼치면 data-autoplay가 꺼지고(포인터는 카드 밖) 9초가 넘게 지나도 슬라이드가 그대로이며, 접으면 다시 켜져 넘어간다 · 펼친 채 다음으로 가면 다시 가려진 채 돈다', async ({ page }, testInfo) => {
    test.skip(kindOf(testInfo.project.name) !== 'desktop', DESKTOP_ONLY);
    await openGentleTitle(page);
    // 자살률 슬라이드까지 손으로 넘긴 뒤 포인터를 카드 밖에 둔다 (일시정지 버튼은 누르지 않는다)
    for (let i = 0; i < SLIDE_COUNT && (await active(page)) !== 'suicide-rate'; i++) await page.getByTestId('carousel-next').click();
    expect(await active(page)).toBe('suicide-rate');
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    await parkMouse(page);
    await expect.poll(() => autoplay(page), '카드 밖·포커스 없음이면 자동 넘김이 돈다').toBe('on');
    const btn = page.locator('.slide.is-active').getByTestId('slide-veil-btn');
    await btn.click();
    await expect(btn).toHaveAttribute('aria-expanded', 'true');
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    await parkMouse(page);
    await expect.poll(() => autoplay(page), '펼친 동안은 멈춘다(held — 접으면 이어 간다)').toBe('held');
    await page.waitForTimeout(10_500); // 한 주기(9초)가 넘게 기다린다
    expect(await active(page), '펼친 동안 슬라이드가 넘어가지 않는다').toBe('suicide-rate');
    await expect(btn).toHaveAttribute('aria-expanded', 'true');
    // 접으면 다시 돈다
    await btn.click();
    await expect(btn).toHaveAttribute('aria-expanded', 'false');
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    await parkMouse(page);
    await expect.poll(() => autoplay(page), '접으면 다시 돈다').toBe('on');
    await expect.poll(() => active(page), { timeout: 12_000, message: '접은 뒤 한 주기 안에 다음으로 넘어간다' }).not.toBe('suicide-rate');
    // 펼친 채 떠나면(이전) 다시 가린다 — 떠나는 동작은 그대로
    await page.getByTestId('carousel-prev').click();
    const back = page.locator('.slide.is-active');
    await expect(back).toHaveAttribute('data-slide-id', 'suicide-rate');
    await back.getByTestId('slide-veil-btn').click();
    await expect(back.getByTestId('slide-veil-btn')).toHaveAttribute('aria-expanded', 'true');
    await page.getByTestId('carousel-next').click();
    await page.getByTestId('carousel-prev').click();
    await expect(page.locator('.slide.is-active').getByTestId('slide-veil-btn')).toHaveAttribute('aria-expanded', 'false');
  });

  test.describe('터치', () => {
    test.use({ hasTouch: true });
    test('터치: 펼치면 멈추고(터치는 포인터 정지 사유가 아니라서 펼침이 유일한 사유), 접거나 떠나면 다시 돈다', async ({ page }, testInfo) => {
      test.skip(kindOf(testInfo.project.name) !== 'desktop', DESKTOP_ONLY);
      await openGentleTitle(page);
      for (let i = 0; i < SLIDE_COUNT && (await active(page)) !== 'suicide-rate'; i++) await page.getByTestId('carousel-next').tap();
      expect(await active(page)).toBe('suicide-rate');
      await expect.poll(() => autoplay(page), '터치만으로는 정지 사유가 아니다 — 돈다').toBe('on');
      const btn = page.locator('.slide.is-active').getByTestId('slide-veil-btn');
      await btn.tap();
      await expect(btn).toHaveAttribute('aria-expanded', 'true');
      await expect.poll(() => autoplay(page), '펼친 동안은 멈춘다(터치 포함)').toBe('held');
      await page.waitForTimeout(10_500);
      expect(await active(page), '펼친 동안 슬라이드가 넘어가지 않는다').toBe('suicide-rate');
      await expect(btn).toHaveAttribute('aria-expanded', 'true');
      await btn.tap(); // 접기
      await expect(btn).toHaveAttribute('aria-expanded', 'false');
      await expect.poll(() => autoplay(page), '접으면 다시 돈다').toBe('on');
      // 펼친 채 다음으로 가면(슬라이드를 떠남) 다시 돈다
      await btn.tap();
      await expect(btn).toHaveAttribute('aria-expanded', 'true');
      await expect.poll(() => autoplay(page)).toBe('held');
      await page.getByTestId('carousel-next').tap();
      await expect.poll(() => active(page)).not.toBe('suicide-rate');
      await expect.poll(() => autoplay(page), '떠나면 다시 돈다').toBe('on');
      await page.getByTestId('carousel-prev').tap();
      await expect(page.locator('.slide.is-active').getByTestId('slide-veil-btn')).toHaveAttribute('aria-expanded', 'false');
    });
  });
});
