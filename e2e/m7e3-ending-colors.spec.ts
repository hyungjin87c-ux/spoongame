import { expect, test } from '@playwright/test';
import { injectSave } from './helpers';
import { geometry, stateOf } from './m7e3Ending';
import { measureRenderedContrast } from './renderedContrast';

/**
 * 엔딩 새 디자인의 색 (SPEC-003 M7e-3, docs/design/copy.md 5-4, dash.css 강제 색상 블록): 라이트·다크·강제 색상 × 앞섬·뒤쪽 — 막대의 그림(띠 테두리·마름모·50% 눈금·선)과 화면의 모든 글자의 렌더 픽셀 대비.
 * e2e/m5-colors.spec.ts와 같은 방식(회색조 글자 렌더·3배 화소)이라 `test.use`가 파일 최상위에 있어야 해서 형태 시험(e2e/m7e3-ending.spec.ts)과 파일을 나눴다. mobile-360에서만 돈다.
 */

// 픽셀로 글자 색을 읽는 측정은 LCD 글자 가장자리 번짐과 1배 화소에 약하다 — 회색조 글자 렌더·3배 화소로 연다(e2e/m5-colors.spec.ts와 같은 이유, 화면의 색은 그대로다)
test.use({ launchOptions: { args: ['--disable-lcd-text'] }, deviceScaleFactor: 3 });

type Combo = 'light' | 'dark' | 'forced-light' | 'forced-dark';
const COMBOS: readonly Combo[] = ['light', 'dark', 'forced-light', 'forced-dark'];

const rgb = (css: string): [number, number, number] => {
  const m = /rgba?\((\d+)[, ]+(\d+)[, ]+(\d+)/.exec(css);
  if (m === null) throw new Error(`색을 읽지 못했다: ${css}`);
  return [Number(m[1]), Number(m[2]), Number(m[3])];
};
const lum = ([r, g, b]: [number, number, number]): number => {
  const f = (v: number): number => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
};
const ratio = (a: [number, number, number], b: [number, number, number]): number => {
  const [hi, lo] = lum(a) >= lum(b) ? [lum(a), lum(b)] : [lum(b), lum(a)];
  return (hi + 0.05) / (lo + 0.05);
};

for (const combo of COMBOS) {
  for (const kind of ['ahead', 'behind'] as const) {
    test(`${combo} · ${kind}: 막대의 그림(띠 테두리·마름모·선·눈금)과 범례·글자의 대비가 충분하다 (그림 3:1, 글자 렌더 픽셀 4.5:1) — 360×740`, async ({ page }, testInfo) => {
      test.skip(testInfo.project.name !== 'mobile-360', 'mobile-360에서만 실행');
      test.setTimeout(120_000);
      await page.setViewportSize({ width: 360, height: 740 });
      const forced = combo.startsWith('forced');
      const scheme = combo === 'dark' || combo === 'forced-dark' ? 'dark' : 'light';
      await page.emulateMedia({ colorScheme: scheme, forcedColors: forced ? 'active' : 'none' });
      const state = await stateOf(page, kind);
      await injectSave(page, state, '/');
      await expect(page.getByTestId('ending-screen')).toBeVisible();
      await expect(page.getByTestId('rebirth')).toBeEnabled(); // 입력 가드가 풀린 뒤
      await page.addStyleTag({ content: '.site-head { position: static !important; box-shadow: none !important; }' });

      // 계산된 색: 그림 부분
      const colors = await page.evaluate(() => {
        const cs = (sel: string, pseudo?: string) => getComputedStyle(document.querySelector(sel)!, pseudo ?? null);
        const probe = (value: string, prop: 'color' | 'backgroundColor') => {
          const d = document.createElement('i');
          d.style.color = value;
          d.style.backgroundColor = value;
          document.body.appendChild(d);
          const c = getComputedStyle(d)[prop];
          d.remove();
          return c;
        };
        return {
          surface: getComputedStyle(document.querySelector('[data-testid="ending-journey-section"]')!).backgroundColor,
          line: cs('.journey__track', '::before').backgroundColor,
          mid: cs('.journey__mid').borderLeftColor,
          bandBorder: cs('.journey__band').borderTopColor,
          bandFill: cs('.journey__band').backgroundColor,
          end: cs('[data-testid="ending-bar-end"]').backgroundColor,
          endBorder: cs('[data-testid="ending-bar-end"]').borderTopColor,
          keyBand: cs('.journey__key--band').borderTopColor,
          keyEnd: cs('.journey__key--end').backgroundColor,
          canvasText: probe('CanvasText', 'color'),
          canvas: probe('Canvas', 'backgroundColor'),
        };
      });
      if (forced) {
        // 강제 색상: 선·눈금·띠 테두리는 CanvasText, 띠 안은 Canvas(비어 보이는 네모), 마름모는 CanvasText 채움 + Canvas 테두리 — 모양으로 구별
        expect(colors.line).toBe(colors.canvasText);
        expect(colors.mid).toBe(colors.canvasText);
        expect(colors.bandBorder).toBe(colors.canvasText);
        expect(colors.bandFill).toBe(colors.canvas);
        expect(colors.end).toBe(colors.canvasText);
        expect(colors.endBorder).toBe(colors.canvas);
        expect(colors.keyBand).toBe(colors.canvasText);
        expect(colors.keyEnd).toBe(colors.canvasText);
        expect(ratio(rgb(colors.canvasText), rgb(colors.canvas)), '강제 색상 글자 대 바탕').toBeGreaterThanOrEqual(7);
      } else {
        const surface = rgb(colors.surface);
        // 의미 있는 그림(띠 테두리·마름모·눈금)은 3:1 이상, 선은 배경과 구별된다
        expect(ratio(rgb(colors.bandBorder), surface), `${combo} 띠 테두리`).toBeGreaterThanOrEqual(3);
        expect(ratio(rgb(colors.end), surface), `${combo} 마름모`).toBeGreaterThanOrEqual(3);
        expect(ratio(rgb(colors.mid), surface), `${combo} 50% 눈금`).toBeGreaterThanOrEqual(3);
        expect(ratio(rgb(colors.line), surface), `${combo} 선`).toBeGreaterThanOrEqual(1.5);
        expect(ratio(rgb(colors.keyEnd), surface), `${combo} 마름모 표식`).toBeGreaterThanOrEqual(3);
      }

      // 렌더 픽셀로 잰 글자 대비: 화면의 모든 글자 (범례·축·문장·칩 포함)
      const report = await measureRenderedContrast(page, { min: 4.5 });
      expect(report.low, `${combo} ${kind}: 가장 낮은 대비 ${report.min.toFixed(2)}:1`).toEqual([]);
      expect(report.texts, '잰 글자 수(공허 통과 방지)').toBeGreaterThan(30);

      // 렌더 픽셀로 잰 그림 대비: 마름모 한가운데 대 카드 바탕, 띠 테두리 대 카드 바탕 (색이 CSS 변수가 아니라 실제로 칠해졌는가)
      // 글자 대비 측정이 문서를 훑으며 스크롤을 옮기므로 막대를 다시 화면 한가운데로 가져온다 — 클립이 화면 밖이면 빈 픽셀을 읽어 공허하게 통과한다
      await page.getByTestId('ending-bar').evaluate((el) => el.scrollIntoView({ block: 'center' }));
      const g = await geometry(page);
      const pad = 8;
      expect(g.bar.top, '막대가 화면 안에 있다').toBeGreaterThanOrEqual(pad);
      expect(g.bar.bottom + pad, '막대가 화면 안에 있다').toBeLessThanOrEqual(740);
      const clip = { x: Math.max(0, g.bar.left - pad), y: Math.max(0, g.bar.top - pad), width: Math.min(360 - Math.max(0, g.bar.left - pad), g.bar.width + 2 * pad), height: g.bar.height + 2 * pad };
      const png = await page.screenshot({ clip, animations: 'disabled' });
      const pixels = await page.evaluate(
        async ({ b64, points }) => {
          const img = new Image();
          img.src = `data:image/png;base64,${b64}`;
          await img.decode();
          const c = document.createElement('canvas');
          c.width = img.width;
          c.height = img.height;
          const ctx = c.getContext('2d')!;
          ctx.drawImage(img, 0, 0);
          const scale = img.width / (points.cssWidth);
          return points.list.map(([x, y]: [number, number]) => Array.from(ctx.getImageData(Math.round(x * scale), Math.round(y * scale), 1, 1).data.slice(0, 3)));
        },
        {
          b64: png.toString('base64'),
          points: {
            cssWidth: clip.width,
            list: [
              [2, 2], // 카드 바탕(막대 둘레 여백)
              [(g.band.left + 1) - clip.x, (g.band.top + g.band.height / 2) - clip.y], // 띠 왼쪽 테두리 한가운데
              ...(g.end === null ? [] : [[(g.end.left + g.end.right) / 2 - clip.x, (g.end.top + g.end.bottom) / 2 - clip.y]]),
            ] as Array<[number, number]>,
          },
        },
      );
      const bg = pixels[0] as [number, number, number];
      const bandEdge = pixels[1] as [number, number, number];
      expect(ratio(bandEdge, bg), `${combo} 렌더된 띠 테두리 대 바탕 ${JSON.stringify({ bandEdge, bg, band: g.band, clip })}`).toBeGreaterThanOrEqual(forced ? 7 : 3);
      if (g.end !== null) expect(ratio(pixels[2] as [number, number, number], bg), `${combo} 렌더된 마름모 대 바탕`).toBeGreaterThanOrEqual(forced ? 7 : 3);
      testInfo.annotations.push({ type: '대비', description: `${report.boxes}상자 ${report.texts}글자 최저 ${report.min.toFixed(2)}:1` });
    });
  }
}
