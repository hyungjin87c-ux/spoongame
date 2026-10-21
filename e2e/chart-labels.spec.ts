import { expect, test, type Page } from '@playwright/test';
import { slideCount } from './carouselHelpers';

/**
 * 그래프 첫 값 글자 겹침 — 조건부 허용 범위 (SPEC-003 QM2-8, QA-003-M2 인상·R-225). 실제 화면(320·360·1280)에서:
 *  ① 허용 목록(KNOWN_FIRST_LABEL_OVERLAPS) 밖의 선 그래프는 글자가 선·점·다른 글자와 겹치지 않는다 — 목록 밖의 새 겹침은 실패.
 *  ② 목록 안(평균 수명·혼인 건수 전 폭, 고령인구 비율 320px)에서도 겹침은 자기 선뿐이다 — 점(마커)·다른 글자와는 0.
 *  ③ 모든 그래프 글자는 선 위에 그려지고(paint-order: stroke) 카드 바탕색 테두리 ≥ 3px, 글자 크기 ≥ 12px, 글자 색의 카드 바탕 대비 ≥ 4.5:1 (라이트·다크). 채움 칸 안 글자(`seg-text`)만 후광 없이 칸 색 대비 ≥ 4.5:1로 본다.
 * 단위 테스트(tests/carousel.test.ts)가 같은 목록을 좌표 계산으로 보고, 이 e2e는 실제로 그려진 SVG(getBBox)로 본다.
 */

const SHOTS = 'qa/screenshots/003';

/** 선에 걸리는 것이 허용되는 (지표, 화면 폭) — tests/carousel.test.ts의 KNOWN_FIRST_LABEL_OVERLAPS와 같다 (그 그래프 폭 252 = 320px 화면) */
const KNOWN_FIRST_LABEL_OVERLAPS: ReadonlyArray<{ id: string; viewportWidths?: readonly number[] }> = [{ id: 'life-expectancy' }, { id: 'marriage-count' }, { id: 'aging-rate', viewportWidths: [320] }];
const isKnown = (id: string, width: number): boolean => KNOWN_FIRST_LABEL_OVERLAPS.some((k) => k.id === id && (k.viewportWidths === undefined || k.viewportWidths.includes(width)));

/** 지금 보이는 슬라이드의 그래프 글자 상자가 선·점·다른 글자와 겹치는 것 (글자 뒤 테두리는 상자에 들어가지 않는다) */
async function overlaps(page: Page): Promise<{ lines: string[]; dots: string[]; texts: string[] }> {
  return page.evaluate(() => {
    const svg = document.querySelector('.slide.is-active svg.chart') as SVGSVGElement;
    type Box = { left: number; top: number; right: number; bottom: number };
    const segs: Array<[number, number, number, number]> = [];
    for (const pl of Array.from(svg.querySelectorAll('polyline'))) {
      for (let k = 1; k < pl.points.numberOfItems; k++) {
        const a = pl.points.getItem(k - 1);
        const b = pl.points.getItem(k);
        segs.push([a.x, a.y, b.x, b.y]);
      }
    }
    const dots: Box[] = Array.from(svg.querySelectorAll('.dot')).map((d) => {
      const b = (d as SVGGraphicsElement).getBBox();
      return { left: b.x, top: b.y, right: b.x + b.width, bottom: b.y + b.height };
    });
    const hits = (x1: number, y1: number, x2: number, y2: number, r: Box): boolean => {
      const inside = (x: number, y: number) => x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
      if (inside(x1, y1) || inside(x2, y2)) return true;
      if (Math.max(x1, x2) < r.left || Math.min(x1, x2) > r.right || Math.max(y1, y2) < r.top || Math.min(y1, y2) > r.bottom) return false;
      const cr = (ax: number, ay: number, bx: number, by: number, cx: number, cy: number) => (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
      const x = (cx: number, cy: number, dx: number, dy: number) => cr(x1, y1, x2, y2, cx, cy) * cr(x1, y1, x2, y2, dx, dy) <= 0 && cr(cx, cy, dx, dy, x1, y1) * cr(cx, cy, dx, dy, x2, y2) <= 0;
      return x(r.left, r.top, r.right, r.top) || x(r.right, r.top, r.right, r.bottom) || x(r.right, r.bottom, r.left, r.bottom) || x(r.left, r.bottom, r.left, r.top);
    };
    // 글자끼리의 겹침은 글자 잉크 상자(기준선 위 0.75em ~ 아래 0.2em)로 본다 — getBBox는 글꼴의 줄 높이(위아래 여백 포함)라 숫자 글자가 실제로 닿지 않아도 겹쳐 보인다. 선·점과의 겹침은 getBBox 그대로(더 엄격).
    const boxes = Array.from(svg.querySelectorAll('text')).map((t) => {
      const b = t.getBBox();
      const fs = parseFloat(getComputedStyle(t).fontSize);
      const y = parseFloat(t.getAttribute('y') ?? '0');
      return { text: t.textContent ?? '', r: { left: b.x, top: b.y, right: b.x + b.width, bottom: b.y + b.height } as Box, ink: { left: b.x, top: y - 0.75 * fs, right: b.x + b.width, bottom: y + 0.2 * fs } as Box };
    });
    const out = { lines: [] as string[], dots: [] as string[], texts: [] as string[] };
    boxes.forEach(({ text, r }, i) => {
      if (segs.some(([x1, y1, x2, y2]) => hits(x1, y1, x2, y2, r))) out.lines.push(text);
      if (dots.some((d) => r.left < d.right && d.left < r.right && r.top < d.bottom && d.top < r.bottom)) out.dots.push(text);
      boxes.forEach((o, j) => {
        if (j <= i) return;
        const a = boxes[i].ink;
        if (a.left < o.ink.right && o.ink.left < a.right && a.top < o.ink.bottom && o.ink.top < a.bottom) out.texts.push(`${text} × ${o.text}`);
      });
    });
    return out;
  });
}

for (const width of [320, 360, 1280]) {
  test(`${width}px: 허용 목록 밖의 선 그래프는 글자가 선·점·다른 글자와 겹치지 않고, 목록 안에서는 자기 선과만 겹친다 (QM2-8 ①②)`, async ({ page }, testInfo) => {
    const mobile = testInfo.project.name === 'mobile-360';
    test.skip(mobile !== (width < 960), width < 960 ? 'mobile-360에서만 실행' : 'desktop에서만 실행');
    test.setTimeout(60_000);
    await page.setViewportSize({ width, height: mobile ? 740 : 800 });
    await page.goto('/');
    await expect(page.getByTestId('start-birth')).toBeEnabled();
    await page.getByTestId('carousel-pause').click();
    const n = await slideCount(page);
    let lineCharts = 0;
    const known: string[] = [];
    const problems: string[] = [];
    for (let i = 0; i < n; i++) {
      const id = await page.evaluate(() => document.querySelector('.slide.is-active')!.getAttribute('data-slide-id')!);
      if ((await page.locator('.slide.is-active svg.chart .line').count()) > 0) {
        lineCharts++;
        const o = await overlaps(page);
        if (isKnown(id, width)) {
          known.push(id);
          if (o.dots.length > 0) problems.push(`${width}px ${id}(허용 목록): 점과 겹침 ${o.dots.join(',')}`);
          if (o.texts.length > 0) problems.push(`${width}px ${id}(허용 목록): 다른 글자와 겹침 ${o.texts.join(',')}`);
        } else {
          if (o.lines.length > 0) problems.push(`${width}px ${id}: 선과 겹침 ${o.lines.join(',')} — 허용 목록에 없는 새 겹침`);
          if (o.dots.length > 0) problems.push(`${width}px ${id}: 점과 겹침 ${o.dots.join(',')}`);
          if (o.texts.length > 0) problems.push(`${width}px ${id}: 다른 글자와 겹침 ${o.texts.join(',')}`);
        }
      }
      if (i < n - 1) await page.getByTestId('carousel-next').click();
    }
    expect(lineCharts, '선 그래프를 실제로 검사한 개수(공허 통과 방지)').toBeGreaterThan(8);
    expect(known.sort(), '허용 목록의 지표가 이 폭에서 실제로 검사됐다').toEqual(width === 320 ? ['aging-rate', 'life-expectancy', 'marriage-count'] : ['life-expectancy', 'marriage-count']);
    expect(problems).toEqual([]);
  });
}

for (const scheme of ['light', 'dark'] as const) {
  test(`그래프 글자의 모양(QM2-8 ③④) ${scheme}: paint-order stroke, 테두리 = 카드 바탕색 ≥ 3px, 글자 ≥ 12px, 글자 색의 카드 바탕 대비 ≥ 4.5:1 — 허용 목록 슬라이드 스크린샷`, async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile-360', '뷰포트를 직접 지정하므로 mobile-360에서만 실행');
    test.setTimeout(60_000);
    await page.emulateMedia({ colorScheme: scheme });
    await page.setViewportSize({ width: 320, height: 568 });
    await page.goto('/');
    await expect(page.getByTestId('start-birth')).toBeEnabled();
    await page.getByTestId('carousel-pause').click();
    await page.addStyleTag({ content: '[data-testid="bottom-bar"] { visibility: hidden !important; }' }); // 증거 스크린샷: 띠가 카드를 덮지 않게
    const n = await slideCount(page);
    let measured = 0;
    for (let i = 0; i < n; i++) {
      const m = await page.evaluate(() => {
        const svg = document.querySelector('.slide.is-active svg.chart') as SVGSVGElement;
        const card = document.querySelector('[data-testid="carousel"]') as HTMLElement;
        // 카드 바탕 = 그래프가 놓인 면 `--c-surface`(SPEC-005 D5-27: 카드는 위쪽 88px만 옅은 하늘 띠 그라데이션이라 `background-color`가 투명하다 — 그래프는 띠 아래 면 위에 있고 글자 테두리(`stroke`)도 같은 면 색이다)
        const probe = document.createElement('div');
        probe.style.backgroundColor = 'var(--c-surface)';
        card.appendChild(probe);
        const cardBg = getComputedStyle(probe).backgroundColor;
        probe.remove();
        const scale = svg.getBoundingClientRect().width / svg.viewBox.baseVal.width;
        const lum = (rgb: string): number => {
          const [r, g, b] = (rgb.match(/[\d.]+/g) ?? []).slice(0, 3).map(Number).map((v) => {
            const c = v / 255;
            return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
          });
          return 0.2126 * r + 0.7152 * g + 0.0722 * b;
        };
        const ratio = (a: string, b: string): number => {
          const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
          return (hi + 0.05) / (lo + 0.05);
        };
        // 채움 칸 안 글자(아기 슬라이드 15~64세 칸의 「68.8%」, designer 15-2 `seg-text`)는 면 위가 아니라 칸 위에 놓인다 — 후광 없이 칸 색(--c-brand) 대비로 본다 (SPEC-005 QI4 2단계)
        const segFill = svg.querySelector('.chart-seg--work') ? getComputedStyle(svg.querySelector('.chart-seg--work') as Element).fill : null;
        return Array.from(svg.querySelectorAll('text')).map((t) => {
          const cs = getComputedStyle(t);
          const onSeg = t.classList.contains('seg-text') && segFill !== null;
          return { text: t.textContent ?? '', onSeg, paintOrder: cs.paintOrder, stroke: cs.stroke, strokeWidth: parseFloat(cs.strokeWidth) * scale, fontPx: parseFloat(cs.fontSize) * scale, contrast: ratio(cs.fill, onSeg ? (segFill as string) : cardBg), cardBg };
        });
      });
      for (const t of m) {
        measured++;
        if (t.onSeg) {
          expect(t.stroke, `${t.text}: 칸 안 글자는 후광이 없다`).toBe('none');
        } else {
          expect(t.paintOrder, `${t.text}: 글자 뒤에 테두리를 먼저 그린다`).toMatch(/^stroke/);
          expect(t.stroke, `${t.text}: 테두리는 카드 바탕색`).toBe(t.cardBg);
          expect(t.strokeWidth, `${t.text}: 테두리 두께`).toBeGreaterThanOrEqual(3 - 0.01);
        }
        expect(t.fontPx, `${t.text}: 글자 크기`).toBeGreaterThanOrEqual(12);
        expect(t.contrast, `${t.text}: 글자 색 대 ${t.onSeg ? '칸' : '카드 바탕'} 대비`).toBeGreaterThanOrEqual(4.5);
      }
      const id = await page.evaluate(() => document.querySelector('.slide.is-active')!.getAttribute('data-slide-id')!);
      if (scheme === 'light' && ['life-expectancy', 'marriage-count', 'aging-rate'].includes(id)) {
        await page.getByTestId('carousel').scrollIntoViewIfNeeded();
        await page.getByTestId('carousel').screenshot({ path: `${SHOTS}/dev-M2-r4-qm28-${id}-320.png` });
      }
      if (i < n - 1) await page.getByTestId('carousel-next').click();
    }
    expect(measured, '그래프 글자를 실제로 잰 개수(공허 통과 방지)').toBeGreaterThan(100);
  });
}
