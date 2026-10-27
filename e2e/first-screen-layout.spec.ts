import { expect, test, type Page } from '@playwright/test';
import { noHorizontalOverflow } from './helpers';
import { auditFocus, summarize } from './focusObscured';
import { measureTextResize, setRootFontPercent, textResizeViolations } from './textResize';
import { openBarState, synthesizeBigSlot } from './titleStates';
import { readThemeBlocks, themeTokens, type Theme } from '../scripts/checkContrastLib';

/**
 * 첫 화면의 배치·크기·접근성 (SPEC-005 QI3 HS1~HS5·SH4~SH6 · SPEC-004 GS1·GS11 3차 — 오른쪽 위 일러스트와 지도 자산은 없어졌다).
 * 구조·문구는 단위 테스트(tests/homeScreen.test.tsx·titleScreen.test.tsx·statHeadlines.test.ts)가 보고, 여기서는 실제 브라우저에서 잰다:
 *  · 1280×800·1920×1080에서 통계 카드가 오른쪽 열 맨 위(그림 없음), 왼쪽 열 끝 < 하단 띠, 표제어·값이 스크롤 0에서 보인다 (GS11·HS3 ④)
 *  · 360×740·320×640에서 워드마크 글자 ≥ 40px · 가로 넘침 0 · 「태어날 세대」 제목이 스크롤 0에서 보인다 (DS1)
 *  · 세대 목록 창 높이: clamp(12rem, 100svh − 27rem, 24rem) · PC clamp(12rem, 100vh − 32rem, 24rem) (GS1)
 *  · 조작 줄 소형(보이는 28px, 포인터 ≥ 24, 거친 포인터 44)·표제어와 겹침 0(폭 320·360·1280 × 글자 100~200%)·눈에 보이는 머리글 없음·제목 단계 (SH4·SH5)
 *  · 인생 길이 영역 높이 ≤ 기준선의 50%(docs/data/spec-005-baseline.md 4절), 분절 컨트롤 클릭 대상 (HS2)
 *  · 큰 슬롯 카드 3장·8장 합성 시험: 고정 띠가 포커스를 가리지 않고(CM10) 가로 넘침 0(CM11) (HS3)
 * 모든 시험은 뷰포트를 직접 지정한다(표 형태의 기준 폭).
 */

/** HS2 ④의 「지금의 절반 이하」 기준 — docs/data/spec-005-baseline.md 4절의 인생 길이 영역 높이(글자 100%, QI0 측정) */
const LIFE_LENGTH_BASELINE = { '1280x800': 163.2, '1920x1080': 163.2, '360x740': 269.1 } as const;

type Rect = { x: number; y: number; w: number; h: number; right: number; bottom: number };

/** 요소의 화면 좌표 상자 (없거나 안 보이면 null) */
async function rectOf(page: Page, selector: string): Promise<Rect | null> {
  return page.evaluate((sel) => {
    // 보이는 첫 요소: 상자가 0이 아닌 것(숨은 figure 안의 img는 display가 block이어도 상자가 0이다)
    const el = [...document.querySelectorAll(sel)].find((e) => {
      const b = e.getBoundingClientRect();
      return getComputedStyle(e).display !== 'none' && b.width > 0 && b.height > 0;
    }) as HTMLElement | undefined;
    if (el === undefined) return null;
    const b = el.getBoundingClientRect();
    return { x: b.x, y: b.y, w: b.width, h: b.height, right: b.right, bottom: b.bottom };
  }, selector);
}

async function openTitle(page: Page, width: number, height: number): Promise<void> {
  await page.setViewportSize({ width, height });
  await page.goto('/');
  await expect(page.getByTestId('title-screen')).toBeVisible();
  await expect(page.getByTestId('start-birth')).toBeEnabled(); // 입력 가드가 풀린 뒤
  await page.evaluate(() => document.fonts.ready);
}

/** 토큰 값(색)을 rgb()로 — tokens.css를 읽는다(first-screen.spec.ts의 tokenColors와 같은 방법) */
async function tokenRgb(page: Page, theme: Theme, name: string): Promise<string> {
  const css = await page.evaluate(async () => ((await import('/src/styles/tokens.css?raw')) as { default: string }).default);
  const hex = themeTokens(readThemeBlocks(css), theme)[name];
  if (hex === undefined || !hex.startsWith('#')) throw new Error(`토큰 ${name}이 색(#rrggbb)이 아니다: ${hex}`);
  return `rgb(${parseInt(hex.slice(1, 3), 16)}, ${parseInt(hex.slice(3, 5), 16)}, ${parseInt(hex.slice(5, 7), 16)})`;
}

const DESKTOP_ONLY = '뷰포트를 직접 지정하므로 desktop 프로젝트에서만 실행';
const MOBILE_ONLY = '뷰포트를 직접 지정하므로 mobile-360 프로젝트에서만 실행';

/**
 * 프로젝트 이름 → 종류. Chromium(playwright.config.ts)은 `desktop`·`mobile-360`, WebKit(playwright.webkit.config.ts)은 `webkit-desktop`·`webkit-mobile-360`이다 —
 * 시험은 뷰포트를 직접 지정하므로 이름은 「어느 쪽 프로젝트에서 돌릴지」만 가른다(WebKit에서도 같은 단언이 돈다).
 */
const kindOf = (name: string): 'desktop' | 'mobile' => (name.endsWith('mobile-360') ? 'mobile' : 'desktop');

// ---------- HS1·HS3 ④: 넓은 화면 배치 ----------

for (const vp of [
  { name: '1280x800', width: 1280, height: 800 },
  { name: '1920x1080', width: 1920, height: 1080 },
] as const) {
  test(`배치 ${vp.name}: 그림 없이 통계 카드가 오른쪽 열 맨 위에서 시작하고, 표제어·값이 스크롤 0에서 하단 띠 위에 보이며 왼쪽 열 끝도 띠 위, 가로 넘침 0 (GS11·HS3 ④)`, async ({ page }, testInfo) => {
    test.skip(kindOf(testInfo.project.name) !== 'desktop', DESKTOP_ONLY);
    await openTitle(page, vp.width, vp.height);
    const m = {
      wordmark: await rectOf(page, '[data-testid="title-logo-word"] svg'),
      card: await rectOf(page, '[data-testid="carousel"]'),
      insight: await rectOf(page, '.slide.is-active .slide__insight'),
      value: await rectOf(page, '.slide.is-active [data-testid="slide-value"]'),
      bar: await rectOf(page, '[data-testid="bottom-bar"]'),
      main: await rectOf(page, '.title__main'),
      gen: await rectOf(page, '[data-testid="gen-list"]'),
      life: await rectOf(page, '[data-testid="life-length-group"]'),
      region: await rectOf(page, '[data-testid="region-slot"]'),
    };
    for (const [k, v] of Object.entries(m)) expect(v, `${k}가 화면에 있다`).not.toBeNull();
    // 그림은 없다 — 카드가 오른쪽 열 맨 위(화면 맨 위 근처)에서 시작하고 왼쪽 열 오른쪽에 있다
    expect(await page.locator('img').count(), '첫 화면에 그림(img)이 없다').toBe(0);
    expect(m.card!.x, '카드가 왼쪽 열 오른쪽에 있다').toBeGreaterThan(m.gen!.right);
    expect(m.card!.y, '카드가 오른쪽 열 맨 위(화면 맨 위 근처)').toBeLessThan(60);
    // 표제어·값이 스크롤 0에서 하단 띠 위에 보인다 (HS3 ④)
    expect(await page.evaluate(() => scrollY), '스크롤 0').toBe(0);
    expect(m.insight!.bottom, `표제어 아래끝 ${Math.round(m.insight!.bottom)} < 띠 위끝 ${Math.round(m.bar!.y)}`).toBeLessThan(m.bar!.y);
    expect(m.value!.bottom, `값 아래끝 ${Math.round(m.value!.bottom)} < 띠 위끝 ${Math.round(m.bar!.y)}`).toBeLessThan(m.bar!.y);
    // 고르는 컨트롤(세대 목록 → 태어나는 시도 → 인생 길이)이 스크롤 0에서 띠 위에 다 보인다. (그 아래 「내가 실제로 태어난 시도」·스위치 줄은 접이식·설정 줄이라 접힌 자리까지만 — 제목 키우기·두 줄 설명 같은 접는 선 정리는 GM4 2차)
    expect(m.gen!.bottom, `세대 목록 아래끝 ${Math.round(m.gen!.bottom)} < 띠 위끝 ${Math.round(m.bar!.y)}`).toBeLessThan(m.bar!.y);
    expect(m.region!.bottom, `시도 방법 아래끝 ${Math.round(m.region!.bottom)} < 띠 위끝 ${Math.round(m.bar!.y)}`).toBeLessThan(m.bar!.y);
    expect(m.life!.bottom, `인생 길이 아래끝 ${Math.round(m.life!.bottom)} < 띠 위끝 ${Math.round(m.bar!.y)}`).toBeLessThan(m.bar!.y);
    // 로고: 워드마크가 왼쪽 열 맨 위, 가로 넘침 0
    expect(m.wordmark!.x).toBeLessThan(m.gen!.x + 4);
    expect(await noHorizontalOverflow(page)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`QI3-layout-${vp.name}.png`) });
  });
}

test('배치 1280x800 · 이어서 살기 띠(120px): 인생 길이가 띠 위에 있다 — 띠가 고르는 컨트롤을 가리지 않는다 (diff-005 D5-19)', async ({ page }, testInfo) => {
  test.skip(kindOf(testInfo.project.name) !== 'desktop', DESKTOP_ONLY);
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/?__exit=1');
  // 진행 중인 판이 있는 첫 화면(「이어서 살기」 띠)은 e2e/titleStates.ts의 openBarState가 연다
  await openBarState(page, 'continue');
  await expect(page.getByTestId('resume')).toBeEnabled();
  const m = { life: await rectOf(page, '[data-testid="life-length-group"]'), bar: await rectOf(page, '[data-testid="bottom-bar"]') };
  expect(m.bar!.h, '이어서 살기 띠는 새 판 띠(68px)보다 높다').toBeGreaterThan(100);
  expect(m.life!.bottom, `인생 길이 아래끝 ${Math.round(m.life!.bottom)} < 띠 위끝 ${Math.round(m.bar!.y)}`).toBeLessThan(m.bar!.y);
});

// ---------- 세대 목록 창 높이 (GS1, design-system 17-11-5) ----------

for (const [w, h, expected, kind] of [
  [1280, 800, 288, 'desktop'], //            PC clamp(12rem, 100vh − 32rem, 24rem) = 800 − 512
  [1920, 1080, 384, 'desktop'], //           상한 24rem
  [1280, 640, 192, 'desktop'], //            하한 12rem (640 − 512 = 128 < 192) — 큰 글자에서 한 줄(약 11rem)이 창보다 커지지 않게 올린 값
  [360, 740, 308, 'mobile'], //              모바일 clamp(12rem, 100svh − 27rem, 24rem) = 740 − 432
  [320, 568, 192, 'mobile'], //              하한
] as const) {
  test(`세대 목록 창 ${w}x${h}: 높이 ${expected}px, 안에서 스크롤하고 8줄 전체는 창보다 길다 (GS1)`, async ({ page }, testInfo) => {
    test.skip(kindOf(testInfo.project.name) !== kind, kind === 'desktop' ? DESKTOP_ONLY : MOBILE_ONLY);
    await openTitle(page, w, h);
    const m = await page.evaluate(() => {
      const list = document.querySelector('[data-testid="gen-list"]') as HTMLElement;
      return { client: list.getBoundingClientRect().height, scrollH: list.scrollHeight, overflowY: getComputedStyle(list).overflowY, rows: list.querySelectorAll('.gen-row').length };
    });
    expect(m.rows).toBe(8);
    expect(m.overflowY).toBe('auto');
    expect(Math.abs(m.client - expected), `창 높이 ${m.client}px ≈ ${expected}px (+ 위아래 선 2px)`).toBeLessThanOrEqual(3);
    expect(m.scrollH, '8줄이 창보다 길어 안에서 스크롤한다').toBeGreaterThan(m.client);
  });
}

// ---------- 좁은 화면 배치 ----------

for (const vp of [
  { width: 360, height: 740 },
  { width: 320, height: 640 },
] as const) {
  test(`배치 ${vp.width}x${vp.height}: 워드마크 글자 높이 ≥ 40px(DS1), 머리 글은 왼쪽 정렬, 「태어날 세대」 제목이 스크롤 0에서 띠 위에 보이고 그림이 없으며 가로 넘침 0 (GS11·D5-31)`, async ({ page }, testInfo) => {
    test.skip(kindOf(testInfo.project.name) !== 'mobile', MOBILE_ONLY);
    await openTitle(page, vp.width, vp.height);
    const m = await page.evaluate(() => {
      const svg = document.querySelector('[data-testid="title-logo-word"] svg') as SVGSVGElement;
      const word = svg.querySelector(':scope > g') as SVGGraphicsElement;
      const r = (el: Element) => {
        const b = el.getBoundingClientRect();
        return { x: b.x, y: b.y, w: b.width, h: b.height, bottom: b.bottom, right: b.right };
      };
      return {
        glyphH: word.getBoundingClientRect().height,
        logo: r(svg),
        tag: r(document.querySelector('.hero__tag')!),
        legend: r(document.querySelector('[data-testid="gen-list"]')!.closest('fieldset')!.querySelector('legend')!),
        bar: r(document.querySelector('[data-testid="bottom-bar"]')!),
        heroAlign: getComputedStyle(document.querySelector('.hero')!).textAlign,
        images: document.querySelectorAll('img').length,
      };
    });
    expect(m.glyphH, `워드마크 글자 높이 ${m.glyphH}px ≥ 40 (DS1)`).toBeGreaterThanOrEqual(40);
    expect(m.logo.x, '로고가 왼쪽 정렬').toBeLessThan(20);
    expect(m.images, '그림(img)이 없다').toBe(0);
    expect(m.tag.y, '한 줄 설명은 로고 줄 아래').toBeGreaterThanOrEqual(m.logo.bottom - 1);
    expect(m.heroAlign).toBe('left');
    expect(m.legend.bottom, `「태어날 세대」 제목 아래끝 ${Math.round(m.legend.bottom)} < 띠 위끝 ${Math.round(m.bar.y)} (선택 영역이 스크롤 0에서 보인다)`).toBeLessThan(m.bar.y);
    expect(await noHorizontalOverflow(page)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`QI3-layout-${vp.width}x${vp.height}.png`) });
  });
}

for (const theme of ['light', 'dark'] as const) {
  test(`통계 카드 색 ${theme}: 테두리 --c-card-border · 위쪽 띠 --c-card-tint · 실측 선 --c-chart (카드 안에서만), 공용 카드는 그대로 (D5-27)`, async ({ page }, testInfo) => {
    test.skip(kindOf(testInfo.project.name) !== 'desktop', DESKTOP_ONLY);
    await page.emulateMedia({ colorScheme: theme });
    await openTitle(page, 1280, 800);
    const c = await page.evaluate(() => {
      const card = document.querySelector('[data-testid="carousel"]') as HTMLElement;
      const line = card.querySelector('.slide.is-active .chart .line') as SVGPathElement;
      const genList = document.querySelector('[data-testid="gen-list"]') as HTMLElement;
      return { border: getComputedStyle(card).borderTopColor, bg: getComputedStyle(card).backgroundImage, line: getComputedStyle(line).stroke, eraBorder: getComputedStyle(genList).borderTopColor, shadow: getComputedStyle(card).boxShadow };
    });
    expect(c.border, '카드 테두리 = --c-card-border').toBe(await tokenRgb(page, theme, '--c-card-border'));
    expect(c.line, '실측 선 = --c-chart').toBe(await tokenRgb(page, theme, '--c-chart'));
    const tint = await tokenRgb(page, theme, '--c-card-tint');
    expect(c.bg, '위쪽 띠 그라데이션이 --c-card-tint로 시작').toContain(tint);
    expect(c.bg).toContain('linear-gradient');
    expect(c.eraBorder, '세대 목록의 선은 공용 테두리색 그대로(카드 전용 토큰이 아니다)').not.toBe(c.border);
    if (theme === 'light') expect(c.shadow, '라이트는 푸른빛 그림자').not.toBe('none');
    else expect(c.shadow, '다크는 그림자 없음').toBe('none');
  });
}

test('강제 색상: 카드·차트는 시스템 색이다 — 실측 선 ButtonText, 카드 배경 Canvas·테두리 CanvasText, 조작 상자·분절 컨트롤 CanvasText 테두리 (D5-29)', async ({ page, browserName }, testInfo) => {
  test.skip(kindOf(testInfo.project.name) !== 'desktop', DESKTOP_ONLY);
  test.skip(browserName === 'webkit', '강제 색상 에뮬레이션은 Chromium에서만');
  await page.emulateMedia({ forcedColors: 'active' });
  await openTitle(page, 1280, 800);
  const c = await page.evaluate(() => {
    const probe = (value: string, prop: 'color' | 'backgroundColor') => {
      const d = document.createElement('div');
      d.style[prop] = value;
      document.body.appendChild(d);
      const out = getComputedStyle(d)[prop];
      d.remove();
      return out;
    };
    const card = document.querySelector('[data-testid="carousel"]') as HTMLElement;
    const line = card.querySelector('.slide.is-active .chart .line') as SVGPathElement;
    return {
      line: getComputedStyle(line).stroke,
      buttonText: probe('ButtonText', 'color'),
      cardBg: getComputedStyle(card).backgroundColor,
      canvas: probe('Canvas', 'backgroundColor'),
      cardBorder: getComputedStyle(card).borderTopColor,
      canvasText: probe('CanvasText', 'color'),
      navBox: getComputedStyle(document.querySelector('.nav-btn__box')!).borderTopColor,
      seg: getComputedStyle(document.querySelector('.seg')!).borderTopColor,
    };
  });
  expect(c.line).toBe(c.buttonText);
  expect(c.cardBg).toBe(c.canvas);
  expect(c.cardBorder).toBe(c.canvasText);
  expect(c.navBox).toBe(c.canvasText);
  expect(c.seg).toBe(c.canvasText);
});

// ---------- SH4~SH6: 머리글 삭제 · 조작 줄 소형 ----------

test('머리글 삭제(SH4): 눈에 보이는 글자에 「한국 사회 통계」「7초마다」「9초마다」「다음 지표」「자동 넘김 멈춤」이 없고, h2.sr-only와 영역 이름이 남으며 제목 단계(h1 → h2 → h3)를 건너뛰지 않는다', async ({ page }, testInfo) => {
  test.skip(kindOf(testInfo.project.name) !== 'desktop', DESKTOP_ONLY);
  await openTitle(page, 1280, 800);
  const { visible, headings } = await page.evaluate(() => {
    const card = document.querySelector('[data-testid="carousel"]')!;
    const texts: string[] = [];
    const walker = document.createTreeWalker(card, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n !== null; n = walker.nextNode()) {
      const el = (n as Text).parentElement!;
      if (el.closest('.sr-only') !== null || (n as Text).data.trim() === '') continue;
      texts.push((n as Text).data.trim());
    }
    return { visible: texts.join(' '), headings: [...document.querySelectorAll('.title-page h1, .title-page h2, .title-page h3')].filter((h) => getComputedStyle(h.closest('.slide') ?? h).visibility !== 'hidden').map((h) => Number(h.tagName[1])) };
  });
  for (const gone of ['한국 사회 통계', '7초마다', '9초마다', '다음 지표', '자동 넘김 멈춤', '자동 넘김']) expect(visible, `눈에 보이는 글자에 「${gone}」`).not.toContain(gone);
  expect(visible, '공허 통과 방지: 눈에 보이는 슬라이드 글자는 모였다').toContain('합계출산율');
  await expect(page.getByRole('heading', { level: 2, name: '한국 사회 통계' })).toHaveCount(1); // 읽기 도구에는 제목이 남는다
  await expect(page.getByRole('region', { name: '한국 사회 통계 캐러셀' })).toBeVisible();
  for (let i = 1; i < headings.length; i++) expect(headings[i] - headings[i - 1], `제목 단계 ${headings.join(' → ')}`).toBeLessThanOrEqual(1);
  expect(headings[0]).toBe(1);
  expect(headings.includes(2) && headings.includes(3), 'h2 위에 슬라이드 h3').toBe(true);
});

for (const vp of [
  { width: 320, height: 640, mobile: true },
  { width: 360, height: 740, mobile: true },
  { width: 1280, height: 800, mobile: false },
] as const) {
  for (const percent of [100, 150, 200] as const) {
    test(`조작 줄 ${vp.width}px · 글자 ${percent}%: 오른쪽 위에 소형(보이는 상자 28px ≤ 32, 클릭 대상 ≥ 24×24), 표제어와 겹침 0, 일시정지가 보인다, 가로 넘침·가려진 글자 0 (SH5·CM11)`, async ({ page }, testInfo) => {
      test.skip(kindOf(testInfo.project.name) !== (vp.mobile ? 'mobile' : 'desktop'), '뷰포트를 직접 지정하므로 해당 프로젝트에서만 실행');
      await openTitle(page, vp.width, vp.height);
      if (percent !== 100) await setRootFontPercent(page, percent);
      const m = await page.evaluate(() => {
        const r = (el: Element) => {
          const b = el.getBoundingClientRect();
          return { x: b.x, y: b.y, w: b.width, h: b.height, right: b.right, bottom: b.bottom };
        };
        const card = document.querySelector('[data-testid="carousel"]')!;
        const nav = document.querySelector('[data-testid="carousel-nav"]')!;
        const buttons = [...nav.querySelectorAll('button')].map((b) => ({ id: b.getAttribute('data-testid'), rect: r(b), box: r(b.querySelector('.nav-btn__box')!), name: b.getAttribute('aria-label') }));
        const active = document.querySelector('.slide.is-active')!;
        return { card: r(card), nav: r(nav), buttons, insight: r(active.querySelector('.slide__insight')!), official: r(active.querySelector('.slide__official')!), count: r(document.querySelector('[data-testid="carousel-count"]')!) };
      });
      expect(m.buttons.map((b) => b.id)).toEqual(['carousel-prev', 'carousel-next', 'carousel-pause']);
      for (const b of m.buttons) {
        expect(Math.round(b.box.w), `${b.id} 보이는 상자 폭`).toBeLessThanOrEqual(32);
        expect(Math.round(b.box.h), `${b.id} 보이는 상자 높이`).toBeLessThanOrEqual(32);
        expect(b.rect.w, `${b.id} 클릭 대상 폭 ≥ 24 (WCAG 2.5.8)`).toBeGreaterThanOrEqual(24);
        expect(b.rect.h, `${b.id} 클릭 대상 높이 ≥ 24`).toBeGreaterThanOrEqual(24);
        expect(b.rect.right, `${b.id}가 카드 오른쪽 안`).toBeLessThanOrEqual(m.card.right + 0.5);
        expect(b.rect.y, `${b.id}가 카드 위쪽 안(오른쪽 위)`).toBeLessThan(m.card.y + 40 * (percent / 100) + 24);
      }
      expect(m.nav.right, '조작 줄이 카드 오른쪽 모서리에 붙는다').toBeGreaterThan(m.card.right - 24);
      // 표제어(와 공식 통계명 줄)는 조작 줄 아래 — 어느 폭·글자 크기에서도 겹침 0 (SH5 ③)
      expect(m.insight.y, `표제어 위끝 ${Math.round(m.insight.y)} ≥ 조작 줄 아래끝 ${Math.round(m.nav.bottom)}`).toBeGreaterThanOrEqual(m.nav.bottom - 0.5);
      expect(m.official.y).toBeGreaterThan(m.insight.y);
      // 일시정지 버튼은 늘 보인다(WCAG 2.2.2): 이름 + 아이콘
      await expect(page.getByTestId('carousel-pause')).toBeVisible();
      await expect(page.getByTestId('carousel-pause')).toHaveAccessibleName('자동 넘김 일시정지');
      // 가로 넘침·잘림 0 (CM11) — 첫 슬라이드와 가장 큰 슬라이드 몇 장
      expect(await noHorizontalOverflow(page)).toBe(true);
      const problems = textResizeViolations(await measureTextResize(page), `${vp.width}px/${percent}%`);
      expect(problems).toEqual([]);
      if (percent === 200) await page.screenshot({ path: testInfo.outputPath(`QI3-nav-${vp.width}x${vp.height}-text200.png`) });
    });
  }
}

test.describe('거친 포인터(터치)', () => {
  test.use({ hasTouch: true, isMobile: true, viewport: { width: 360, height: 740 } });
  test('360x740 터치: 조작 버튼 자신이 44×44(보이는 상자는 28), 분절 컨트롤 라디오가 높이 44, 요소가 부모 밖으로 넘치지 않는다 (SH5 ①·HS2 ⑤)', async ({ page }, testInfo) => {
    test.skip(kindOf(testInfo.project.name) !== 'mobile', MOBILE_ONLY);
    await page.goto('/');
    await expect(page.getByTestId('title-screen')).toBeVisible();
    await expect(page.getByTestId('start-birth')).toBeEnabled();
    expect(await page.evaluate(() => matchMedia('(pointer: coarse)').matches), '거친 포인터 환경이다(공허 통과 방지)').toBe(true);
    const m = await page.evaluate(() => {
      const r = (el: Element) => {
        const b = el.getBoundingClientRect();
        return { w: b.width, h: b.height, x: b.x, right: b.right };
      };
      const card = document.querySelector('[data-testid="carousel"]')!;
      return {
        card: r(card),
        buttons: [...document.querySelectorAll('[data-testid="carousel-nav"] button')].map((b) => ({ rect: r(b), box: r(b.querySelector('.nav-btn__box')!) })),
        segInput: r(document.querySelector('[data-testid="life-short30"]')!),
        segOpt: r(document.querySelector('[data-testid="life-short30"]')!.closest('label')!),
        disabledInput: r(document.querySelector('[data-testid="life-long60"]')!),
      };
    });
    for (const b of m.buttons) {
      expect(b.rect.w).toBeGreaterThanOrEqual(44);
      expect(b.rect.h).toBeGreaterThanOrEqual(44);
      expect(Math.round(b.box.w), '보이는 상자는 28px 그대로').toBe(28);
      expect(b.rect.right, '버튼이 카드 밖으로 넘치지 않는다(요소 넘침 0)').toBeLessThanOrEqual(m.card.right + 0.5);
    }
    expect(m.segInput.h, '분절 컨트롤 라디오 클릭 영역 ≥ 44').toBeGreaterThanOrEqual(44);
    expect(m.segOpt.h, '보이는 칸은 32px').toBeLessThanOrEqual(36);
    expect(await noHorizontalOverflow(page)).toBe(true);
  });
});

// ---------- SH6: 일시정지 버튼 = 상태 ----------

test('일시정지 버튼(SH6): 늘 보이고 아이콘·이름이 상태를 맡는다 — 누르면 재생 아이콘 + 「자동 넘김 다시 시작」, 다시 누르면 일시정지 아이콘 + 「자동 넘김 일시정지」 (머리글 문구 없이)', async ({ page }, testInfo) => {
  test.skip(kindOf(testInfo.project.name) !== 'desktop', DESKTOP_ONLY);
  await openTitle(page, 1280, 800);
  const pause = page.getByTestId('carousel-pause');
  const icon = pause.locator('use');
  await expect(pause).toBeVisible();
  await expect(pause).toHaveAccessibleName('자동 넘김 일시정지');
  await expect(icon).toHaveAttribute('href', '#i-pause');
  await pause.click();
  await expect(pause).toHaveAccessibleName('자동 넘김 다시 시작');
  await expect(icon).toHaveAttribute('href', '#i-play');
  await expect(page.getByTestId('carousel')).toHaveAttribute('data-autoplay', 'off');
  await page.mouse.move(2, 2, { steps: 4 });
  await expect(icon, '포인터가 나가도 사용자가 멈춘 상태는 버튼이 말한다').toHaveAttribute('href', '#i-play');
  await pause.click();
  await expect(pause).toHaveAccessibleName('자동 넘김 일시정지');
  await expect(icon).toHaveAttribute('href', '#i-pause');
  await expect(page.getByTestId('carousel-auto-note')).toHaveCount(0);
});

// ---------- HS2: 인생 길이 영역 높이 ----------

for (const vp of [
  { key: '1280x800', width: 1280, height: 800, desktop: true },
  { key: '1920x1080', width: 1920, height: 1080, desktop: true },
  { key: '360x740', width: 360, height: 740, desktop: false },
] as const) {
  test(`인생 길이 영역 ${vp.key}: 높이가 기준선(${LIFE_LENGTH_BASELINE[vp.key]}px)의 50% 이하, 한 줄 안내, 비활성 「약 1시간」 + 「준비 중」 (HS2 ④ · 완료 기준 8)`, async ({ page, browserName }, testInfo) => {
    test.skip(kindOf(testInfo.project.name) !== (vp.desktop ? 'desktop' : 'mobile'), '뷰포트를 직접 지정하므로 해당 프로젝트에서만 실행');
    await openTitle(page, vp.width, vp.height);
    const m = await page.evaluate(() => {
      const fs = document.querySelector('[data-testid="life-length-group"]')!.closest('fieldset')!;
      const hint = document.querySelector('[data-testid="life-length-hint"]')!;
      const lh = parseFloat(getComputedStyle(hint).lineHeight);
      return { fieldset: fs.getBoundingClientRect().height, hintLines: Math.round(hint.getBoundingClientRect().height / lh), long: (document.querySelector('[data-testid="life-long60"]') as HTMLInputElement).disabled };
    });
    // 기준선(QI0)은 Chromium에서 쟀다 — 50%·한 줄 안내는 Chromium에서 잰다. WebKit(Windows 번들)은 한글 대체 글꼴이 더 넓어 안내가 두 줄이 될 수 있어 「지금(카드 둘)보다 작다」만 본다
    if (browserName === 'chromium') {
      expect(m.fieldset, `영역 높이 ${m.fieldset.toFixed(1)}px ≤ ${(LIFE_LENGTH_BASELINE[vp.key] / 2).toFixed(1)}px`).toBeLessThanOrEqual(LIFE_LENGTH_BASELINE[vp.key] / 2);
      if (vp.desktop) expect(m.hintLines, '넓은 화면에서 안내는 한 줄').toBe(1);
    } else {
      expect(m.fieldset, `영역 높이 ${m.fieldset.toFixed(1)}px < 기준선 ${LIFE_LENGTH_BASELINE[vp.key]}px`).toBeLessThan(LIFE_LENGTH_BASELINE[vp.key] * 0.75);
    }
    expect(m.long, '「약 1시간」은 비활성').toBe(true);
    await expect(page.getByRole('radio', { name: /약 1시간/ })).toHaveAccessibleName(/약 1시간.*준비 중/);
    // 포인터 환경 클릭 대상 ≥ 24×24 (WCAG 2.5.8): 칸 전체가 눌린다
    const hit = await page.evaluate(() => {
      const b = document.querySelector('[data-testid="life-short30"]')!.closest('label')!.getBoundingClientRect();
      return { w: b.width, h: b.height };
    });
    expect(hit.w).toBeGreaterThanOrEqual(24);
    expect(hit.h).toBeGreaterThanOrEqual(24);
  });
}

// ---------- HS3: 큰 슬롯(세대 목록) 줄 3줄 / 8줄 합성 — 줄 수·내용에 의존하지 않는 슬롯 ----------

for (const count of [3, 8] as const) {
  for (const vp of [
    { name: '1280x800', width: 1280, height: 800, desktop: true },
    { name: '1920x1080', width: 1920, height: 1080, desktop: true },
    { name: '360x740', width: 360, height: 740, desktop: false },
  ] as const) {
    test(`슬롯 합성 ${count}줄 · ${vp.name}: 목록이 한 열로 이어지고 가로 넘침 0, Tab 전체 순회에서 고정 띠가 포커스를 가리지 않는다 (HS3 ①·CM10·CM11)`, async ({ page, browserName }, testInfo) => {
      test.skip(kindOf(testInfo.project.name) !== (vp.desktop ? 'desktop' : 'mobile'), '뷰포트를 직접 지정하므로 해당 프로젝트에서만 실행');
      test.setTimeout(90_000);
      await openTitle(page, vp.width, vp.height);
      await synthesizeBigSlot(page, count);
      const m = await page.evaluate(() => {
        const grid = document.querySelector('[data-testid="gen-list"]')!;
        const cards = [...grid.querySelectorAll('label')].map((l) => l.getBoundingClientRect());
        const cols = new Set(cards.map((c) => Math.round(c.x))).size;
        return { cards: cards.length, cols, gridW: grid.getBoundingClientRect().width, maxRight: Math.max(...cards.map((c) => c.right)), gridRight: grid.getBoundingClientRect().right };
      });
      expect(m.cards).toBeGreaterThanOrEqual(Math.min(count, 8)); // 세대 목록은 이미 8줄이다 — 합성은 8줄 미만이면 늘리지 않는다
      expect(m.maxRight, '카드가 격자 밖으로 넘치지 않는다').toBeLessThanOrEqual(m.gridRight + 0.5);
      expect(m.cols, '세대 목록은 한 열이다(GS1) — 줄이 늘어도 열이 늘지 않는다').toBe(1);
      expect(await noHorizontalOverflow(page)).toBe(true);
      // 포커스 가림 점검(CM10)은 Chromium 규칙(링크·버튼까지 Tab, 프로그램 focus()가 scroll-padding 안으로 스크롤)을 전제로 한 감사라 Chromium에서만 돌린다 — WebKit은 Tab이 링크에 닿지 않는 기본값이라 감사 전제가 다르다(가로 넘침은 두 브라우저 모두 본다)
      if (browserName !== 'chromium') return;
      const audit = await auditFocus(page, `슬롯 ${count}장 ${vp.name}`);
      expect(audit.violations, summarize(audit)).toEqual([]);
      expect(audit.tabbables.length, `Tab 순회에 조작 요소가 들어 있다(공허 통과 방지) ${audit.tabbables.join(' → ')}`).toBeGreaterThanOrEqual(12);
      if (count === 8) await page.screenshot({ path: testInfo.outputPath(`QI3-slot8-${vp.name}.png`) });
    });
  }
}

test('슬롯 합성 8줄 · 320px · 글자 200%: 가로 넘침 0·가려진 글자 0 (CM11)', async ({ page }, testInfo) => {
  test.skip(kindOf(testInfo.project.name) !== 'mobile', MOBILE_ONLY);
  await openTitle(page, 320, 640);
  await synthesizeBigSlot(page, 8);
  await setRootFontPercent(page, 200);
  expect(await noHorizontalOverflow(page)).toBe(true);
  expect(textResizeViolations(await measureTextResize(page), '슬롯 8줄 320px/200%')).toEqual([]);
});
