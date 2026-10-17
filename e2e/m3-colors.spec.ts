import { expect, test, type CDPSession, type Page } from '@playwright/test';
import { M3_SCREENS, freezeTime, isBirthScreen, mainButtonOf, openM3Screen, type M3Screen } from './m3States';
import { measureRenderedContrast } from './renderedContrast';

/**
 * 룰렛·출생신고 화면의 다크 모드와 강제 색상(고대비) 점검 (SPEC-003 CM4, DS3 — M3 마일스톤 개발자 점검).
 * `src/styles/tokens.css`는 손대지 않는다(M1 확정물). 여기서 문제가 나오면 고치지 않고 ai-log에 적어 designer·마스터에게 올린다.
 *  (1) 라이트·다크·강제 색상(라이트·다크) 5조합 × 화면 3상태: 글자를 가진 모든 보이는 요소의 글자색과 실제 배경색 대비를 잰다
 *      (일반 글자 ≥ 4.5:1, 큰 글자(≥ 24px 또는 굵은 ≥ 18.66px) ≥ 3:1, 강제 색상은 시스템 색이라 모두 ≥ 3:1). 배경이 그림·그라디언트면 그 글자는 세지 않고 개수를 센다(공허 통과 방지로 하한 확인).
 *  (2) 강제 색상: 하단 띠의 위끝 구분선이 보이고(테두리 두께 > 0), 띠 버튼의 hover·키보드 포커스 상태에서 글자색 ≠ 배경색이며, 릴의 결과 칸 표시(.reel__window)와 수저 칩이 지워지지 않는다.
 * 모든 테스트가 뷰포트를 직접 지정하므로 mobile-360 프로젝트에서만 돈다.
 */

interface ContrastReport {
  /** 잰 글자 요소 수 */
  measured: number;
  /** 배경이 그림·그라디언트라 세지 않은 요소 수 */
  skipped: number;
  /** 대비 미달 목록 */
  low: string[];
  /** 가장 낮은 대비 */
  min: number;
  /** 장식 도장 「접수」(aria-hidden)의 글자를 쟀는가 */
  stampText: boolean;
}

/** 지금 화면의 글자색·배경색 대비를 전부 잰다 */
async function contrastReport(page: Page, forced: boolean): Promise<ContrastReport> {
  return page.evaluate((isForced) => {
    const parse = (css: string): { r: number; g: number; b: number; a: number } => {
      const m = /rgba?\(([^)]+)\)/.exec(css);
      if (m === null) return { r: 0, g: 0, b: 0, a: 0 };
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
    const canvas = (() => {
      const probe = document.createElement('div');
      probe.style.backgroundColor = 'Canvas';
      document.body.appendChild(probe);
      const c = parse(getComputedStyle(probe).backgroundColor);
      probe.remove();
      return c;
    })();
    const blend = (top: { r: number; g: number; b: number; a: number }, under: { r: number; g: number; b: number }) => ({
      r: top.r * top.a + under.r * (1 - top.a),
      g: top.g * top.a + under.g * (1 - top.a),
      b: top.b * top.a + under.b * (1 - top.a),
    });
    /** 배경: 위로 올라가며 반투명 배경을 겹쳐 쌓는다. 그림·그라디언트를 만나면 null */
    const backgroundOf = (start: Element): { r: number; g: number; b: number } | null => {
      const layers: Array<{ r: number; g: number; b: number; a: number }> = [];
      let base = canvas as { r: number; g: number; b: number };
      for (let cur: Element | null = start; cur !== null; cur = cur.parentElement) {
        const cs = getComputedStyle(cur);
        if (cs.backgroundImage !== 'none') return null;
        const c = parse(cs.backgroundColor);
        if (c.a > 0) {
          layers.push(c);
          if (c.a >= 1) {
            base = c;
            break;
          }
        }
      }
      let out = base;
      for (const l of layers.reverse()) out = blend(l, out);
      return out;
    };
    const label = (e: Element) => `${e.tagName.toLowerCase()}${(e as HTMLElement).className ? `.${String((e as HTMLElement).className).trim().split(/\s+/)[0]}` : ''}${e.getAttribute('data-testid') ? `#${e.getAttribute('data-testid')}` : ''}`;
    const hasOwnText = (e: Element) => Array.from(e.childNodes).some((n) => n.nodeType === Node.TEXT_NODE && (n.textContent ?? '').trim() !== '');
    let measured = 0;
    let skipped = 0;
    let min = Infinity;
    let stampText = false;
    const low: string[] = [];
    for (const e of Array.from(document.body.querySelectorAll('*'))) {
      if (!hasOwnText(e)) continue;
      if (e.closest('.sr-only, svg, [aria-hidden="true"] .sprite')) continue;
      const cs = getComputedStyle(e);
      if (cs.display === 'none' || cs.visibility === 'hidden') continue;
      const r = e.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      // 장식(aria-hidden)이라도 눈에 보이는 글자는 면제하지 않는다 (QM3-5): 불투명도(opacity)는 건너뛰지 않고 합성한 **실제 렌더 색**으로 잰다(도장 「접수」가 불투명도 0.85로 라이트에서 3.72:1이었다).
      // 건너뛰는 것은 전환·애니메이션이 진행 중인 요소(중간 값)뿐이다.
      let opacity = 1;
      let animating = false;
      for (let cur: Element | null = e; cur !== null; cur = cur.parentElement) {
        opacity *= Number(getComputedStyle(cur).opacity);
        if (cur.getAnimations().length > 0) animating = true;
      }
      if (animating) {
        skipped++;
        continue;
      }
      const bg = backgroundOf(e);
      if (bg === null) {
        skipped++;
        continue;
      }
      const color = parse(cs.color);
      const fg = blend({ ...blend(color, bg), a: opacity }, bg);
      const c = ratio(fg, bg);
      const size = parseFloat(cs.fontSize);
      const bold = parseInt(cs.fontWeight, 10) >= 700;
      const large = size >= 24 || (bold && size >= 18.66);
      const need = isForced ? 3 : large ? 3 : 4.5;
      measured++;
      if (e.closest('.stamp') !== null) stampText = true;
      if (c < min) min = c;
      if (c < need) low.push(`${label(e)} 「${(e.textContent ?? '').trim().slice(0, 18)}」 ${c.toFixed(2)}:1 < ${need}`);
    }
    return { measured, skipped, low, min: Number.isFinite(min) ? min : 0, stampText };
  }, forced);
}

/**
 * 장식 도형(UI)의 테두리 대비 (QM3-5): 도장 `.stamp`의 테두리와 안쪽 가는 테두리(`::before`)가 불투명도까지 합성한 실제 렌더 색으로 바탕과 3:1 이상이다.
 * 계산된 테두리 색(`currentColor` = 글자색)에 조상 불투명도를 곱해 바탕 위에 얹는다. 도장이 화면에 있어야 한다(공허 통과 방지).
 */
async function stampBorderReport(page: Page): Promise<{ checked: number; low: string[]; min: number }> {
  return page.evaluate(() => {
    const parse = (css: string): { r: number; g: number; b: number; a: number } => {
      const m = /rgba?\(([^)]+)\)/.exec(css);
      if (m === null) return { r: 0, g: 0, b: 0, a: 0 };
      const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number);
      return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 };
    };
    const lin = (v: number) => {
      const s = v / 255;
      return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    };
    const lum = (c: { r: number; g: number; b: number }) => 0.2126 * lin(c.r) + 0.7152 * lin(c.g) + 0.0722 * lin(c.b);
    const ratio = (a: { r: number; g: number; b: number }, b: { r: number; g: number; b: number }) => {
      const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
      return (hi + 0.05) / (lo + 0.05);
    };
    const canvas = (() => {
      const probe = document.createElement('div');
      probe.style.backgroundColor = 'Canvas';
      document.body.appendChild(probe);
      const c = parse(getComputedStyle(probe).backgroundColor);
      probe.remove();
      return c;
    })();
    const backdrop = (el: Element): { r: number; g: number; b: number } => {
      for (let cur: Element | null = el.parentElement; cur !== null; cur = cur.parentElement) {
        const c = parse(getComputedStyle(cur).backgroundColor);
        if (c.a >= 1) return c;
      }
      return canvas;
    };
    let checked = 0;
    let min = Infinity;
    const low: string[] = [];
    for (const el of Array.from(document.querySelectorAll('.stamp'))) {
      let opacity = 1;
      for (let cur: Element | null = el; cur !== null; cur = cur.parentElement) opacity *= Number(getComputedStyle(cur).opacity);
      const bg = backdrop(el);
      for (const pseudo of [null, '::before'] as const) {
        const cs = getComputedStyle(el, pseudo);
        if (cs.borderTopStyle === 'none' || parseFloat(cs.borderTopWidth) === 0) continue;
        const b = parse(cs.borderTopColor);
        const shown = { r: b.r * b.a * opacity + bg.r * (1 - b.a * opacity), g: b.g * b.a * opacity + bg.g * (1 - b.a * opacity), b: b.b * b.a * opacity + bg.b * (1 - b.a * opacity) };
        const c = ratio(shown, bg);
        checked++;
        if (c < min) min = c;
        if (c < 3) low.push(`.stamp${pseudo ?? ''} 테두리 ${c.toFixed(2)}:1 < 3`);
      }
    }
    return { checked, low, min: Number.isFinite(min) ? min : 0 };
  });
}

const SCHEMES = [
  { name: '라이트', colorScheme: 'light', forced: false },
  { name: '다크', colorScheme: 'dark', forced: false },
  { name: '강제 색상(라이트)', colorScheme: 'light', forced: true },
  { name: '강제 색상(다크)', colorScheme: 'dark', forced: true },
] as const;

test.describe('M3 색 대비 360x740', () => {
  test.use({ viewport: { width: 360, height: 740 } });
  for (const scheme of SCHEMES) {
    for (const screen of M3_SCREENS) {
      test(`${scheme.name} · ${screen}: 글자와 실제 배경의 대비 — ${scheme.forced ? '시스템 색 3:1 이상' : '일반 글자 4.5:1·큰 글자 3:1 이상'}`, async ({ page }, testInfo) => {
        test.skip(testInfo.project.name !== 'mobile-360', '뷰포트를 직접 지정하므로 mobile-360에서만 실행');
        await page.emulateMedia({ colorScheme: scheme.colorScheme, forcedColors: scheme.forced ? 'active' : 'none' });
        await openM3Screen(page, screen);
        if (screen === 'roulette-spin') await freezeTime(page);
        const r = await contrastReport(page, scheme.forced);
        expect(r.measured, `잰 글자 요소 수(공허 통과 방지) — 건너뜀 ${r.skipped}`).toBeGreaterThan(isBirthScreen(screen) ? 40 : 15);
        expect(r.low, `가장 낮은 대비 ${r.min.toFixed(2)}:1`).toEqual([]);
        // 장식 도장(「접수」)은 예외가 아니다(QM3-5): 글자는 위 목록에 들어 있고(aria-hidden이라도 센다), 테두리(UI)는 3:1 이상
        if (isBirthScreen(screen)) {
          expect(r.stampText, '장식 도장 「접수」 글자도 잰 목록에 들어 있다').toBe(true);
          const stamp = await stampBorderReport(page);
          expect(stamp.checked, '도장 테두리 둘(바깥·안쪽)을 쟀다').toBe(2);
          expect(stamp.low, `도장 테두리 가장 낮은 대비 ${stamp.min.toFixed(2)}:1`).toEqual([]);
        }
      });
    }
  }
});

/** CDP로 hover·포커스 의사 상태를 정확히 켠다 */
async function forceState(cdp: CDPSession, selector: string, classes: string[]): Promise<void> {
  const rootId = (await cdp.send('DOM.getDocument', { depth: 0 })).root.nodeId;
  const { nodeId } = await cdp.send('DOM.querySelector', { nodeId: rootId, selector });
  expect(nodeId, selector).toBeGreaterThan(0);
  await cdp.send('CSS.forcePseudoState', { nodeId, forcedPseudoClasses: classes });
}

for (const screen of M3_SCREENS) {
  test.describe(`M3 강제 색상 ${screen}`, () => {
    test.use({ viewport: { width: 360, height: 740 } });
    for (const colorScheme of ['light', 'dark'] as const) {
      test(`${colorScheme} · ${screen}: 하단 띠 위끝 구분선이 보이고, 띠 버튼의 hover·키보드 포커스에서도 글자색 ≠ 배경색, 릴 결과 칸 표시·수저 칩이 남아 있다`, async ({ page }, testInfo) => {
        test.skip(testInfo.project.name !== 'mobile-360', '뷰포트를 직접 지정하므로 mobile-360에서만 실행');
        await page.emulateMedia({ colorScheme, forcedColors: 'active' });
        await openM3Screen(page, screen);
        if (screen === 'roulette-spin') await freezeTime(page);
        // 전환(transition) 중간 값을 읽지 않게 끈다(e2e/forced-colors-states.spec.ts와 같다) — 계산된 색은 이 시점의 스타일이다
        await page.addStyleTag({ content: '*, *::before, *::after { transition: none !important; }' });
        // 띠 위끝 구분선: 강제 색상에서는 그림자가 사라지므로 테두리가 있어야 한다 (design-system.md 11-2)
        const border = await page.getByTestId('bottom-bar').evaluate((el) => {
          const cs = getComputedStyle(el);
          return { style: cs.borderTopStyle, width: parseFloat(cs.borderTopWidth), color: cs.borderTopColor, position: cs.position };
        });
        if (border.position === 'fixed' || border.position === 'sticky') {
          expect(border.style, '강제 색상 띠 위끝 테두리 모양').not.toBe('none');
          expect(border.width, '강제 색상 띠 위끝 테두리 두께').toBeGreaterThan(0);
        }
        // 띠 버튼 상태별 글자색 ≠ 배경색
        const cdp = await page.context().newCDPSession(page);
        await cdp.send('DOM.enable');
        await cdp.send('CSS.enable');
        const sel = `[data-testid="${mainButtonOf(screen)}"]`;
        for (const [name, classes] of [
          ['hover', ['hover']],
          ['hover+active', ['hover', 'active']],
          ['키보드 포커스', ['focus', 'focus-visible']],
        ] as const) {
          await forceState(cdp, sel, [...classes]);
          const c = await page.evaluate((s) => {
            const el = document.querySelector(s) as HTMLElement;
            const cs = getComputedStyle(el);
            return { color: cs.color, bg: cs.backgroundColor };
          }, sel);
          expect(c.color, `${name}: 글자색 ≠ 배경색 (${c.color} / ${c.bg})`).not.toBe(c.bg);
        }
        await cdp.detach();
        // 릴 결과 칸 표시와 수저 칩이 강제 색상에서도 눈에 보인다 (룰렛 화면)
        if (!isBirthScreen(screen)) {
          const reel = await page.evaluate(() => {
            const w = document.querySelector('[data-testid="reel-wealth"] .reel__window');
            const cs = w === null ? null : getComputedStyle(w);
            return cs === null ? null : { border: cs.borderTopStyle, outline: cs.outlineStyle, shadow: cs.boxShadow, display: cs.display };
          });
          expect(reel, '릴 결과 칸 표시(.reel__window)가 있다').not.toBeNull();
          expect(reel!.border !== 'none' || reel!.outline !== 'none', `강제 색상에서 릴 결과 칸 표시가 테두리·윤곽으로 남는다 (${JSON.stringify(reel)})`).toBe(true);
        }
        const chips = await page.locator('.grade').count();
        expect(chips, '수저 칩이 화면에 있다').toBeGreaterThan(0);
        for (const chip of await page.locator('.grade').all()) expect((await chip.innerText()).trim().length, '칩에 수저 이름 글자가 있다(색에만 의존하지 않는다)').toBeGreaterThan(0);
      });
    }
  });
}


// ---------- 강제 색상: 렌더 픽셀 대비 (SPEC-003 QM3-5 (c), R-291) ----------
// 계산된 글자색 대 배경색 비교는 시스템 색 토큰이 바탕을 덮어쓰지 못해 글자 뒤에 백플레이트가 깔리는 결함(출생신고 띠 제목이 흰 상자에 흰 글자로 사라짐)을 못 잡는다.
// 색 바탕 상자(계산된 배경이 투명이 아니고 눈에 보이는 글자를 품은 요소)를 자동으로 모아 요소 스크린샷을 뜨고, 글자 자리의 픽셀 명도 대비가 4.5:1 이상인지 잰다(e2e/renderedContrast.ts).

const RENDERED_SCREENS: readonly M3Screen[] = ['roulette-result', 'birth', 'birth-dirt', 'birth-diamond'];

for (const colorScheme of ['light', 'dark'] as const) {
  for (const screen of RENDERED_SCREENS) {
    test.describe(`강제 색상 렌더 픽셀 ${colorScheme} ${screen}`, () => {
      test.use({ viewport: { width: 360, height: 740 } });
      test(`강제 색상(${colorScheme}) · ${screen}: 색 바탕 상자마다 요소 스크린샷의 글자 픽셀 ↔ 바탕 픽셀 명도 대비 ≥ 4.5:1 — 백플레이트가 글자를 가리지 않는다 (R-291)`, async ({ page }, testInfo) => {
        test.skip(testInfo.project.name !== 'mobile-360', '뷰포트를 직접 지정하므로 mobile-360에서만 실행');
        test.setTimeout(120_000);
        await page.emulateMedia({ colorScheme, forcedColors: 'active' });
        await openM3Screen(page, screen);
        await page.addStyleTag({ content: '*, *::before, *::after { transition: none !important; animation: none !important; }' });
        const r = await measureRenderedContrast(page, {
          evidence: async (name, png) => {
            await testInfo.attach(`미달 상자 ${name}`, { body: png, contentType: 'image/png' });
          },
        });
        // 공허 통과 방지: 상자·글자를 실제로 쟀다
        expect(r.boxes, `색 바탕 상자 ${r.boxNames.join(', ')}`).toBeGreaterThanOrEqual(isBirthScreen(screen) ? 8 : 4);
        expect(r.texts, '잰 글자 수').toBeGreaterThanOrEqual(isBirthScreen(screen) ? 60 : 4);
        if (isBirthScreen(screen)) {
          // 출생신고 띠(R-291): 제목 「출생 신고」와 오른쪽 표기가 잰 글자에 들어 있다
          const band = r.measured.filter((m) => m.startsWith('div.doc__band|') || m.includes('doc__band'));
          expect(band.length, `띠에서 잰 글자 ${r.measured.slice(0, 12).join(' / ')}`).toBeGreaterThanOrEqual(2);
          expect(r.measured.some((m) => m.endsWith('|출생 신고') && m.includes('doc__band')), '띠 제목 「출생 신고」').toBe(true);
        }
        expect(r.low, `가장 낮은 대비 ${r.min.toFixed(2)}:1`).toEqual([]);
      });
    });
  }
}
