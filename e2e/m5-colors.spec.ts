import { expect, test, type Page } from '@playwright/test';
import { openImpactScreen } from './m5States';
import { analyze, measureRenderedContrast } from './renderedContrast';

/**
 * 선택지 영향 줄의 색 (SPEC-003 M5 EC5, CM4, DS3, QM3-5, design-system.md 2절 「M5 영향 줄의 대비 쌍」): 라이트·다크·강제 색상 × 영향 줄이 있는 선택지 카드 둘 — 렌더 픽셀 대비 ≥ 4.5:1(일반 면과 hover 면), 기호의 톤 색.
 * e2e/m4-colors.spec.ts와 같은 방식(요소 스크린샷의 픽셀로 잰다)에 영향 줄 이름·기호를 **줄 단위 클립 스크린샷**으로 한 번 더 잰다 — 요소 스크린샷은 뷰포트보다 큰 카드를 못 뜨는 낮은 화면(320×568)에서도 되도록.
 * 모든 테스트가 뷰포트를 직접 지정하므로 mobile-360 프로젝트에서만 돈다.
 */

// 픽셀로 글자 색을 읽는 측정은 LCD 글자 가장자리 번짐과 1배 화소에 약하다 — 회색조 글자 렌더·3배 화소로 연다(e2e/m4-colors.spec.ts와 같은 이유, 화면의 색은 그대로다)
test.use({ launchOptions: { args: ['--disable-lcd-text'] }, deviceScaleFactor: 3 });

const IMPACT_SCREENS = ['impact-young', 'impact-adult'] as const;

// ---------- 색: 렌더 픽셀 대비 (라이트·다크·강제 색상, 선택지 hover 면 포함) ----------

type Combo = 'light' | 'dark' | 'forced-light' | 'forced-dark';
const COMBOS: readonly Combo[] = ['light', 'dark', 'forced-light', 'forced-dark'];

async function applyCombo(page: Page, combo: Combo): Promise<void> {
  const forced = combo.startsWith('forced');
  const scheme = combo === 'dark' || combo === 'forced-dark' ? 'dark' : 'light';
  await page.emulateMedia({ colorScheme: scheme, forcedColors: forced ? 'active' : 'none' });
}

/** 영향 줄의 이름·기호 하나하나를 그 자리의 렌더 픽셀로 잰다(요소 스크린샷이 뷰포트보다 큰 카드를 못 뜨는 320×568에서도 되도록 줄 단위 클립 스크린샷) */
async function measureImpactLines(page: Page, min: number): Promise<{ checked: number; lowest: number; low: string[] }> {
  const count = await page.locator('[data-testid="choice-panel"] .impact__show').count();
  const low: string[] = [];
  let lowest = Infinity;
  let checked = 0;
  for (let i = 0; i < count; i++) {
    const show = page.locator('[data-testid="choice-panel"] .impact__show').nth(i);
    await show.scrollIntoViewIfNeeded();
    const rects = await show.evaluate((el) => {
      const b = el.getBoundingClientRect();
      const name = el.querySelector('.impact__name')?.textContent ?? '';
      return { x: b.left, y: b.top, w: b.width, h: b.height, name, parts: Array.from(el.children).map((c) => { const r = c.getBoundingClientRect(); return { text: (c.textContent ?? '').slice(0, 14), x: r.left - b.left, y: r.top - b.top, w: r.width, h: r.height }; }) };
    });
    // 줄 상자 둘레 6px를 포함해 클립 스크린샷(바탕 색이 둘레에 있어야 바탕을 읽는다)
    const pad = 6;
    const vp = page.viewportSize()!;
    const clip = { x: Math.max(0, rects.x - pad), y: Math.max(0, rects.y - pad), width: Math.min(vp.width - Math.max(0, rects.x - pad), rects.w + 2 * pad), height: Math.min(vp.height - Math.max(0, rects.y - pad), rects.h + 2 * pad) };
    if (clip.width < 4 || clip.height < 4) continue;
    const png = await page.screenshot({ clip, animations: 'disabled' });
    const shifted = rects.parts.map((p) => ({ ...p, x: p.x + (rects.x - clip.x), y: p.y + (rects.y - clip.y) }));
    const results = await analyze(page, png, shifted, { width: clip.width, height: clip.height });
    for (const r of results) {
      checked++;
      lowest = Math.min(lowest, r.ratio);
      if (r.ratio < min) low.push(`영향 줄 ${i}번째 「${r.text}」 ${r.ratio.toFixed(2)}:1 < ${min} (바탕 ${r.bg} · 글자 ${r.fg})`);
    }
  }
  return { checked, lowest: Number.isFinite(lowest) ? lowest : 0, low };
}

// 픽셀로 글자 색을 읽는 측정은 LCD 글자 가장자리 번짐과 1배 화소에 약하다 — 회색조 글자 렌더·3배 화소로 연다(e2e/m4-colors.spec.ts와 같은 이유, 화면의 색은 그대로다)
for (const combo of COMBOS) {
  for (const screen of IMPACT_SCREENS) {
    test(`${combo} · ${screen}: 선택지 카드의 모든 색 바탕 상자와 영향 줄 이름·기호의 렌더 픽셀 대비가 4.5:1 이상이다 — 일반 면과 hover 면 (360×740)`, async ({ page }, testInfo) => {
      test.skip(testInfo.project.name !== 'mobile-360', 'mobile-360에서만 실행');
      test.setTimeout(120_000);
      await page.setViewportSize({ width: 360, height: 740 });
      await applyCombo(page, combo);
      await openImpactScreen(page, screen);
      await page.addStyleTag({ content: '.dash-head, .controls-fixed, .site-head { position: static !important; box-shadow: none !important; }' });
      await expect(page.locator('[aria-disabled="true"]:not([data-unavailable="true"])'), '입력 가드가 풀린 뒤').toHaveCount(0);
      const report = await measureRenderedContrast(page, { min: 4.5 });
      expect(report.low, `가장 낮은 대비 ${report.min.toFixed(2)}:1`).toEqual([]);
      // 선택지 버튼(색 바탕 상자) 안의 영향 줄 이름·기호 글자를 실제로 쟀다(공허 통과 방지)
      expect(report.measured.some((m) => /^button.choice#choice-[^|]*|(자산|집안 살림|부채|관계|행복|건강|지식)/.test(m)), '영향 줄 이름을 쟀다').toBe(true);
      expect(report.measured.some((m) => /^button.choice#choice-[^|]*|[▲▼]+/.test(m)), '영향 줄 기호를 쟀다').toBe(true);
      const plain = await measureImpactLines(page, 4.5);
      expect(plain.low, `영향 줄 일반 면 최저 ${plain.lowest.toFixed(2)}:1`).toEqual([]);
      expect(plain.checked, '잰 영향 줄 글자 수').toBeGreaterThan(10);
      // hover 면(--c-brand-soft): 마우스를 첫 선택지에 올리고 그 선택지의 영향 줄을 잰다
      await page.getByTestId('choice-panel').locator('.choice').first().hover();
      const hover = await measureImpactLines(page, 4.5);
      expect(hover.low, `영향 줄 hover 면 최저 ${hover.lowest.toFixed(2)}:1`).toEqual([]);
      testInfo.annotations.push({ type: '대비', description: `${report.boxes}상자 ${report.texts}글자 최저 ${report.min.toFixed(2)}:1 · 영향 줄 일반 ${plain.lowest.toFixed(2)}:1 · hover ${hover.lowest.toFixed(2)}:1` });
    });
  }
}

test('320×568에서도 영향 줄 대비를 줄 단위로 잰다 (요소 스크린샷 한계 보완) — 라이트·다크', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-360', 'mobile-360에서만 실행');
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 320, height: 568 });
  for (const scheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme: scheme });
    await openImpactScreen(page, 'impact-adult');
    const r = await measureImpactLines(page, 4.5);
    expect(r.low, `${scheme}: 최저 ${r.lowest.toFixed(2)}:1`).toEqual([]);
    expect(r.checked).toBeGreaterThan(10);
  }
});

test('부채 ▲는 해로운 색(--c-down), 부채 ▼와 다른 항목의 ▲는 이로운 색(--c-up) — 색이 톤을 따른다 (D-37, 강제 색상에서는 모두 글자색)', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-360', 'mobile-360에서만 실행');
  await page.setViewportSize({ width: 360, height: 740 });
  await openImpactScreen(page, 'impact-adult');
  const colors = await page.evaluate(() => {
    const css = (n: string) => { const d = document.createElement('i'); d.style.color = `var(${n})`; document.body.appendChild(d); const c = getComputedStyle(d).color; d.remove(); return c; };
    const items = Array.from(document.querySelectorAll<HTMLElement>('.impact__item')).map((it) => ({ key: it.getAttribute('data-key')!, dir: it.getAttribute('data-direction')!, color: getComputedStyle(it.querySelector('.impact__step')!).color, glyph: (it.querySelector('.impact__step')!.textContent ?? '')[0] }));
    return { up: css('--c-up'), down: css('--c-down'), items };
  });
  expect(colors.items.length).toBeGreaterThan(5);
  for (const it of colors.items) {
    const bad = it.key === 'debt' ? it.dir === 'up' : it.dir === 'down';
    expect(it.color, `${it.key} ${it.dir}`).toBe(bad ? colors.down : colors.up);
    expect(it.glyph).toBe(it.dir === 'up' ? '▲' : '▼');
  }
  // 강제 색상: 톤 둘 다 글자색(CanvasText)이라 색 차이가 없어지고 모양·개수만 남는다
  await page.emulateMedia({ forcedColors: 'active' });
  const forced = await page.evaluate(() => Array.from(document.querySelectorAll<HTMLElement>('.impact__step')).map((e) => getComputedStyle(e).color));
  expect(new Set(forced).size, '강제 색상에서는 기호 색이 하나').toBe(1);
});

