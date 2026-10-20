import { expect, test, type Page } from '@playwright/test';
import { measureRenderedContrast } from './renderedContrast';
import { M4_SCREENS, isDash as isDashScreen, openM4Screen, readyButton, type M4Screen } from './m4States';
import { KNOWN_SEED, SETTINGS_KEY, injectSave, lifeState, startPageHidden } from './helpers';

/**
 * 새 화면(대시보드·엔딩·밀린 화면·오류 화면)의 색: 다크 모드·수동 테마·강제 색상(고대비)과 렌더 픽셀 대비 (SPEC-003 CM4, DS3, QM3-5, R-251 — M4 마일스톤).
 *  (1) 라이트·다크·수동 다크(OS 라이트)·수동 라이트(OS 다크)·강제 색상(라이트·다크) 6조합 × 화면 6상태: 글자를 품은 모든 색 바탕 상자를 요소 스크린샷으로 떠서 글자 자리의 **렌더 픽셀** 명도 대비를 잰다
 *      (일반·강제 색상 모두 ≥ 4.5:1 — R-323, QM3-5 (c): 강제 색상의 시스템 색 짝이 모두 4.5 이상이라 3:1로 낮출 이유가 없다. 예전 기준 3:1은 시험 약화였다).
 *      계산된 색이 아니라 픽셀이라 시스템 색이 바탕을 못 덮는 문제도 잡는다(e2e/renderedContrast.ts). 호출자의 **지속 비활성** 버튼(「다음 결정으로」·「생각 남기기」)도 면제 없이 잰다(R-337).
 *  (2) 강제 색상의 상태 표시: 눌린 배속·자동 모드는 이중 테두리, 상태 막대·올해 진행률 바의 채움이 바탕과 구분되고, 수저 칩·얼굴 테두리가 남는다.
 *  (3) R-251(REV-003-M2-5): 밝은 고대비 테마(강제 색상 + OS 라이트)에서 **수동 다크**(`data-theme='dark'`)를 켜도 시스템 색 매핑이 이긴다 — 헤더 로고·선택된 카드 글자·포커스 링이 Canvas 위에서 대비 ≥ 3:1.
 *      대조군: 같은 화면을 강제 색상 블록의 선택자가 `:root` 하나였던 옛 모양의 tokens.css로 열면 같은 측정이 실패한다(시험이 실제로 잡는다).
 * 모든 테스트가 뷰포트를 직접 지정하므로 mobile-360 프로젝트에서만 돈다.
 */

// 픽셀로 글자 색을 읽는 측정(e2e/renderedContrast.ts)은 LCD 글자 가장자리 번짐(서브픽셀 색 테두리)에 약하다: 작고 가는 글자(「세」)는 본래 글자색의 픽셀이 거의 없어 번진 색이 「글자 색」으로 읽혀 실제보다 낮은 대비가 나온다.
// 이 파일은 회색조 글자 렌더로 연다(--disable-lcd-text) — 화면의 색은 그대로이고 측정만 정확해진다.
test.use({ launchOptions: { args: ['--disable-lcd-text'] } });
// 또한 3배 화소로 뜬다: 14px 글자의 가는 획(1px)은 1배 화소에서 본래 글자색의 픽셀이 없어 연한 가장자리색이 글자 색으로 읽힌다. 3배에서는 획이 3픽셀 굵기라 본래 색이 나온다.
test.use({ deviceScaleFactor: 3 });

type Combo = 'light' | 'dark' | 'manual-dark' | 'manual-light' | 'forced-light' | 'forced-dark';
const COMBOS: readonly Combo[] = ['light', 'dark', 'manual-dark', 'manual-light', 'forced-light', 'forced-dark'];

async function applyCombo(page: Page, combo: Combo): Promise<void> {
  const forced = combo.startsWith('forced');
  const scheme = combo === 'dark' || combo === 'manual-light' || combo === 'forced-dark' ? 'dark' : 'light';
  await page.emulateMedia({ colorScheme: scheme, forcedColors: forced ? 'active' : 'none' });
}

/** 수동 테마를 설정으로 건다(대시보드·엔딩은 저장된 설정을 읽어 data-theme을 건다) */
async function openWithTheme(page: Page, screen: M4Screen, combo: Combo): Promise<void> {
  await applyCombo(page, combo);
  await openM4Screen(page, screen);
  if (combo === 'manual-dark' || combo === 'manual-light') {
    const theme = combo === 'manual-dark' ? 'dark' : 'light';
    await page.evaluate((t) => document.documentElement.setAttribute('data-theme', t), theme);
  }
}

/** 고정 요소가 다른 상자를 가리지 않게 흐름 안에 둔다(대비는 색의 문제이고 위치와 무관하다) */
async function flowFixedElements(page: Page): Promise<void> {
  await page.addStyleTag({ content: '.dash-head, .controls-fixed, .site-head { position: static !important; box-shadow: none !important; }' });
}

for (const combo of COMBOS) {
  for (const screen of M4_SCREENS) {
    test(`${combo} · ${screen}: 글자를 품은 모든 색 바탕 상자의 렌더 픽셀 대비가 4.5:1 이상이다 (강제 색상도 같다 — QM3-5 (c), R-323)`, async ({ page }, testInfo) => {
      test.skip(testInfo.project.name !== 'mobile-360', '뷰포트를 직접 지정하므로 mobile-360에서만 실행');
      test.setTimeout(120_000);
      await page.setViewportSize({ width: 360, height: 740 });
      await openWithTheme(page, screen, combo);
      await flowFixedElements(page);
      // 입력 가드(0.4초, 과도 상태)가 모두 풀린 뒤에 잰다: 가드만 닫힌 버튼(aria-disabled이면서 data-unavailable가 아닌 것)은 흐린 채라 지금 재면 안 된다.
      // 호출자가 넘긴 **지속 비활성**(자동 모드 내내인 「다음 결정으로」)은 data-unavailable로 구분되며 면제하지 않고 4.5:1로 잰다 (R-337, design-system.md 2절)
      await expect(page.locator('[aria-disabled="true"]:not([data-unavailable="true"])'), '입력 가드가 풀린 뒤').toHaveCount(0);
      const report = await measureRenderedContrast(page, { min: 4.5 });
      expect(report.low, `가장 낮은 대비 ${report.min.toFixed(2)}:1`).toEqual([]);
      expect(report.boxes, '잰 색 바탕 상자 수(공허 통과 방지)').toBeGreaterThan(screen === 'error' ? 0 : 2);
      expect(report.texts, '잰 글자 수').toBeGreaterThan(screen === 'error' ? 0 : 8);
      // 도구 줄의 「생각 남기기」(M7c부터 보통 버튼)는 모든 대시보드 상태에 있고 실제로 쟀다
      if (isDashScreen(screen)) expect(report.measured.some((m) => m.startsWith('button.btn#tool-note|')), '「생각 남기기」의 글자를 쟀다').toBe(true);
      testInfo.annotations.push({ type: '대비', description: `${report.boxes}상자 ${report.texts}글자 최저 ${report.min.toFixed(2)}:1` });
    });
  }
}

test('수동 테마 확인: 수동 다크는 OS가 라이트여도 바탕이 다크 토큰이고, 수동 라이트는 OS가 다크여도 라이트 토큰이다 (모든 새 화면)', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-360', '뷰포트를 직접 지정하므로 mobile-360에서만 실행');
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 360, height: 740 });
  for (const screen of M4_SCREENS) {
    await page.emulateMedia({ colorScheme: 'light' });
    await openM4Screen(page, screen);
    await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
    expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor), `${screen}: OS 라이트 + 수동 다크`).toBe('rgb(20, 23, 31)');
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'light'));
    expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor), `${screen}: OS 다크 + 수동 라이트`).toBe('rgb(246, 243, 236)');
    await page.evaluate(() => document.documentElement.removeAttribute('data-theme'));
    expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor), `${screen}: 수동 선택 없음 → OS(다크)를 따른다`).toBe('rgb(20, 23, 31)');
  }
});

// ---------- 강제 색상의 상태 표시 ----------

for (const scheme of ['light', 'dark'] as const) {
  test(`강제 색상(${scheme}) 대시보드: 눌린 배속·자동 모드는 이중 테두리, 상태 막대와 올해 진행률 바의 채움이 바탕과 구분되고 수저 칩·얼굴 테두리가 남는다`, async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile-360', '뷰포트를 직접 지정하므로 mobile-360에서만 실행');
    await page.setViewportSize({ width: 360, height: 740 });
    await page.emulateMedia({ colorScheme: scheme, forcedColors: 'active' });
    expect(await page.evaluate(() => matchMedia('(forced-colors: active)').matches), '강제 색상 모드').toBe(true);
    await startPageHidden(page);
    await page.goto('/');
    await injectSave(page, lifeState(KNOWN_SEED), '/', { speed: 4, autoMode: true });
    await expect(page.getByTestId('life-screen')).toBeVisible();
    const style = (selector: string) =>
      page.evaluate((sel) => {
        const el = document.querySelector(sel) as HTMLElement;
        const cs = getComputedStyle(el);
        return { bg: cs.backgroundColor, color: cs.color, borderStyle: cs.borderTopStyle, borderWidth: cs.borderTopWidth };
      }, selector);
    const pressed = await style('[data-speed="4"]');
    const plain = await style('[data-speed="1"]');
    expect(pressed.borderStyle, '눌린 배속은 이중 테두리').toBe('double');
    expect(plain.borderStyle).toBe('solid');
    expect((await style('[data-testid="auto"]')).borderStyle, '켜진 자동 모드').toBe('double');
    expect(pressed.bg, '눌린 버튼은 배경 색도 다르다').not.toBe(plain.bg);
    // 상태 막대·진행률 바: 채움이 바탕과 구분된다(사라지지 않는다)
    const fills = await page.evaluate(() => {
      const pairs: Array<[string, string]> = [
        ['.meter__track', '.meter__fill'],
        ['.year-progress', '.year-progress__fill'],
      ];
      return pairs.map(([track, fill]) => {
        const t = document.querySelector(track) as HTMLElement;
        const f = document.querySelector(fill) as HTMLElement;
        return { track: getComputedStyle(t).backgroundColor, fill: getComputedStyle(f).backgroundColor, trackBorder: getComputedStyle(t).borderTopStyle, trackBorderWidth: parseFloat(getComputedStyle(t).borderTopWidth) };
      });
    });
    for (const f of fills) {
      expect(f.fill, '채움이 바탕과 같은 색(사라짐)').not.toBe(f.track);
      expect(f.trackBorder).toBe('solid');
      expect(f.trackBorderWidth).toBeGreaterThanOrEqual(1);
    }
    // 수저 칩·얼굴·카드 테두리가 남는다
    const edges = await page.evaluate(() => ({
      chip: getComputedStyle(document.querySelector('.grade')!).borderTopStyle,
      face: getComputedStyle(document.querySelector('.face')!).borderTopWidth,
      card: getComputedStyle(document.querySelector('.card')!).borderTopWidth,
    }));
    expect(edges.chip).not.toBe('none');
    expect(parseFloat(edges.face)).toBeGreaterThan(0);
    expect(parseFloat(edges.card)).toBeGreaterThan(0);
  });
}

// ---------- R-251: 밝은 고대비 테마 + 수동 다크 ----------

/** 0xRRGGBB 형태가 아니라 계산된 rgb()끼리의 명도 대비를 페이지 안에서 잰다 */
async function rendered(page: Page) {
  return page.evaluate(() => {
    const parse = (css: string) => {
      const m = /rgba?\(([^)]+)\)/.exec(css);
      if (m === null) return null;
      const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number);
      return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 };
    };
    const lum = ({ r, g, b }: { r: number; g: number; b: number }) => {
      const f = (v: number) => {
        const s = v / 255;
        return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
      };
      return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
    };
    const ratio = (a: { r: number; g: number; b: number }, b: { r: number; g: number; b: number }) => {
      const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
      return (hi + 0.05) / (lo + 0.05);
    };
    /** 요소가 놓인 자리의 실제 배경: 위로 올라가며 처음 불투명한 배경(없으면 문서 Canvas) */
    const backgroundOf = (el: Element) => {
      for (let cur: Element | null = el; cur !== null; cur = cur.parentElement) {
        const c = parse(getComputedStyle(cur).backgroundColor);
        if (c !== null && c.a >= 1) return c;
      }
      const probe = document.createElement('div');
      probe.style.backgroundColor = 'Canvas';
      document.body.appendChild(probe);
      const c = parse(getComputedStyle(probe).backgroundColor)!;
      probe.remove();
      return c;
    };
    const out: { logo: Array<{ fill: string; ratio: number }>; cardText: Array<{ where: string; ratio: number }>; ring: { outline: string; ratio: number } | null } = { logo: [], cardText: [], ring: null };
    for (const path of Array.from(document.querySelectorAll('[data-testid="title-logo-word"] svg path, [data-testid="header-logo"] svg path'))) {
      const rect = path.getBoundingClientRect();
      if (rect.width < 1 || rect.height < 1) continue; // 보이지 않는 로고는 건너뛴다
      const cs = getComputedStyle(path);
      // 헤더 로고는 면(fill)으로, 첫 화면 워드마크(SPEC-005 D5-01 A안)는 선(stroke)으로 그린다 — 칠해진 쪽의 색을 잰다
      const paint = cs.fill !== 'none' ? cs.fill : cs.stroke;
      const fill = parse(paint);
      if (fill === null || fill.a === 0) continue;
      out.logo.push({ fill: paint, ratio: ratio(fill, backgroundOf(path)) });
    }
    for (const sel of ['.radio-card:has(input:checked) .radio-card__meta', '.radio-card:has(input:checked) .radio-card__desc', '.radio-card:has(input:checked) .radio-card__title']) {
      const el = document.querySelector(sel);
      if (el === null) continue;
      const color = parse(getComputedStyle(el).color);
      if (color !== null) out.cardText.push({ where: sel.split(' ').pop()!, ratio: ratio(color, backgroundOf(el)) });
    }
    const active = document.activeElement;
    if (active !== null && active !== document.body) {
      const cs = getComputedStyle(active);
      const outline = parse(cs.outlineColor);
      if (outline !== null && cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0) out.ring = { outline: cs.outlineColor, ratio: ratio(outline, backgroundOf(active.parentElement ?? active)) };
    }
    return out;
  });
}

/** 밝은 고대비 + 수동 다크로 첫 화면을 열어 로고·선택된 카드·포커스 링의 대비를 잰다 */
async function r251Measure(page: Page) {
  await page.setViewportSize({ width: 360, height: 740 });
  await page.emulateMedia({ colorScheme: 'light', forcedColors: 'active' });
  // 수동 다크: 설정에 저장된 테마 「dark」로 연다 — main.tsx가 첫 그림 전에 <html data-theme="dark">를 건다(실제 경로)
  await page.addInitScript(
    ([key, value]) => {
      if (localStorage.getItem(key) === null) localStorage.setItem(key, value);
    },
    [SETTINGS_KEY, JSON.stringify({ version: 3, data: { speed: 1, autoMode: false, era: 'present', lifeLength: 'short30', bgm: { on: false, volume: 30 }, theme: 'dark' } })] as const,
  );
  await page.goto('/');
  await expect(page.getByTestId('title-screen')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.getAttribute('data-theme'))).toBe('dark');
  expect(await page.evaluate(() => matchMedia('(forced-colors: active)').matches && matchMedia('(prefers-color-scheme: light)').matches)).toBe(true);
  const start = page.getByTestId('start-birth');
  await expect(start).toBeEnabled();
  await page.keyboard.press('Shift');
  await start.focus();
  await page.keyboard.press('Shift+Tab');
  await start.focus();
  const r = await rendered(page);
  const pixels = await measureRenderedContrast(page, { min: 3 });
  return { r, pixels };
}

test('R-251: 밝은 고대비 테마(강제 색상 + OS 라이트)에서 수동 다크를 켜도 로고·선택된 카드 글자·포커스 링이 Canvas 위에서 대비 ≥ 3:1이다 (REV-003-M2-5)', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-360', '뷰포트를 직접 지정하므로 mobile-360에서만 실행');
  test.setTimeout(90_000);
  const { r, pixels } = await r251Measure(page);
  expect(r.logo.length, '로고 도형을 실제로 쟀다(공허 통과 방지)').toBeGreaterThan(0);
  for (const l of r.logo) expect(l.ratio, `로고 ${l.fill}`).toBeGreaterThanOrEqual(3);
  expect(r.cardText.length, '선택된 카드의 글자를 실제로 쟀다').toBeGreaterThanOrEqual(2);
  for (const t of r.cardText) expect(t.ratio, `선택된 카드 ${t.where}`).toBeGreaterThanOrEqual(3);
  expect(r.ring, '포커스 링이 그려졌다').not.toBeNull();
  expect(r.ring!.ratio, `포커스 링 ${r.ring!.outline}`).toBeGreaterThanOrEqual(3);
  expect(pixels.low, `렌더 픽셀 대비(가장 낮은 ${pixels.min.toFixed(2)}:1)`).toEqual([]);
  expect(pixels.texts).toBeGreaterThan(10);
  testInfo.annotations.push({ type: 'R-251', description: `로고 ${r.logo.map((l) => l.ratio.toFixed(1)).join('/')} · 선택 카드 ${r.cardText.map((t) => t.ratio.toFixed(1)).join('/')} · 링 ${r.ring!.ratio.toFixed(1)} · 픽셀 최저 ${pixels.min.toFixed(1)}` });
});

test('R-251 대조군: 강제 색상 블록의 선택자가 옛 모양(`:root` 하나)인 tokens.css로 열면 같은 측정이 실패한다 — 시험이 실제로 잡는다', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-360', '뷰포트를 직접 지정하므로 mobile-360에서만 실행');
  test.setTimeout(90_000);
  let replaced = 0;
  await page.route('**/src/styles/tokens.css*', async (route) => {
    const res = await route.fetch();
    const body = await res.text();
    // 개발 서버는 CSS를 JS 모듈(글자열)로 내려 준다 — 줄바꿈은 \\n 글자로 들어 있다. 강제 색상 블록의 선택자 목록 세 개를 `:root` 하나로 되돌린다.
    const old = body.replace(/(@media \(forced-colors: active\) \{(?:\\n|\s)*):root,(?:\\n|\s)*:root:not\(\[data-theme='light'\]\),(?:\\n|\s)*:root\[data-theme='dark'\]/, '$1:root');
    if (old !== body) replaced++;
    await route.fulfill({ response: res, body: old });
  });
  const { r, pixels } = await r251Measure(page);
  expect(replaced, '옛 선택자로 되돌렸다(대조군이 실제로 적용됐다)').toBeGreaterThan(0);
  const worst = Math.min(...r.logo.map((l) => l.ratio), ...r.cardText.map((t) => t.ratio), r.ring?.ratio ?? Infinity, pixels.min || Infinity);
  expect(worst, `옛 선택자에서는 로고·선택 카드·포커스 링 중 하나가 3:1 아래로 떨어진다 (로고 ${r.logo.map((l) => l.ratio.toFixed(2))} 카드 ${r.cardText.map((t) => t.ratio.toFixed(2))} 링 ${r.ring?.ratio.toFixed(2)})`).toBeLessThan(3);
  testInfo.annotations.push({ type: 'R-251 대조군', description: `최저 ${worst.toFixed(2)}:1` });
});

test('강제 색상 + 수동 다크 대시보드: 헤더 로고·진행률 바·눌린 버튼이 Canvas 위에서 구분된다 (R-251 이어서, 대시보드 헤더)', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-360', '뷰포트를 직접 지정하므로 mobile-360에서만 실행');
  await page.setViewportSize({ width: 360, height: 740 });
  await page.emulateMedia({ colorScheme: 'light', forcedColors: 'active' });
  await openM4Screen(page, 'dash-infant');
  await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
  const r = await rendered(page);
  expect(r.logo.length).toBeGreaterThan(0);
  for (const l of r.logo) expect(l.ratio, `헤더 로고 ${l.fill}`).toBeGreaterThanOrEqual(3);
  await readyButton(page, 'dash-infant').focus();
  const ring = (await rendered(page)).ring;
  expect(ring, '포커스 링').not.toBeNull();
  expect(ring!.ratio).toBeGreaterThanOrEqual(3);
});
