import { expect, test, type CDPSession, type Page } from '@playwright/test';
import { BAR_MAIN_BUTTON, BAR_STATES, openBarState } from './titleStates';

/**
 * 강제 색상(고대비)에서 버튼·카드의 **상태별(hover·active·키보드 포커스)** 글자색 ≠ 배경색 (REV-003-M2-4 r6 후속, 마스터 지시).
 * 발견: 주 버튼(`.btn--primary`)에 마우스를 올리면 tokens.css가 강제 색상에서 `--c-brand-hover`를 ButtonText로 매핑해 배경이 ButtonText가 되는데 글자색도 ButtonText라
 * 글자가 사라졌다(배경 = 글자 = rgb(0, 0, 0)). 이 시험은 첫 화면의 모든 버튼(하단 띠 상태 3종·캐러셀 조작 버튼)과 라디오 카드를 대상으로, 강제 색상 에뮬레이션(라이트·다크)에서
 * 각 상태의 계산된 **글자색이 실제로 칠해지는 배경색과 같지 않고 대비가 3:1 이상**인지 본다. 상태는 CDP `CSS.forcePseudoState`로 **정확히** 켠다(마우스 위치·전환 시간에 기대지 않는다):
 * hover · hover+active · 키보드 포커스(focus + focus-visible) · 넷 모두. 배경은 요소에서 위로 올라가며 처음 불투명한 배경(없으면 Canvas)이다.
 * 마우스를 실제로 올리는 경로(`page.hover`)는 주 버튼에서 따로 한 번 더 본다. 모든 테스트가 뷰포트를 직접 지정하므로 mobile-360 프로젝트에서만 돈다.
 */

interface Rgb {
  r: number;
  g: number;
  b: number;
}

const luminance = ({ r, g, b }: Rgb): number => {
  const f = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
};
const contrast = (a: Rgb, b: Rgb): number => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

interface Sample {
  /** 글자를 가진 요소(자기 또는 후손)의 이름 */
  who: string;
  color: Rgb;
  bg: Rgb;
}

/** 요소와 그 후손 중 **자기 글자가 있는** 것(그리고 글자 없는 아이콘 버튼은 요소 자신)의 글자색·실제 배경색을 잰다 */
async function sampleColors(page: Page, selector: string, index: number): Promise<Sample[]> {
  return page.evaluate(
    ([sel, idx]) => {
      const el = document.querySelectorAll(sel as string)[idx as number] as HTMLElement;
      const parse = (css: string): { r: number; g: number; b: number; a: number } => {
        const m = /rgba?\(([^)]+)\)/.exec(css);
        if (m === null) return { r: 0, g: 0, b: 0, a: 0 };
        const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number);
        return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 };
      };
      const canvas = (() => {
        const probe = document.createElement('div');
        probe.style.backgroundColor = 'Canvas';
        document.body.appendChild(probe);
        const c = parse(getComputedStyle(probe).backgroundColor);
        probe.remove();
        return c;
      })();
      const backgroundOf = (start: Element): { r: number; g: number; b: number } => {
        for (let cur: Element | null = start; cur !== null; cur = cur.parentElement) {
          const c = parse(getComputedStyle(cur).backgroundColor);
          if (c.a > 0) return c;
        }
        return canvas;
      };
      const label = (e: Element) => `${e.tagName.toLowerCase()}${(e as HTMLElement).className ? `.${String((e as HTMLElement).className).trim().split(/\s+/)[0]}` : ''}`;
      const out: Array<{ who: string; color: { r: number; g: number; b: number }; bg: { r: number; g: number; b: number } }> = [];
      const hasOwnText = (e: Element) => Array.from(e.childNodes).some((n) => n.nodeType === Node.TEXT_NODE && (n.textContent ?? '').trim() !== '');
      const candidates = [el, ...Array.from(el.querySelectorAll('*'))].filter((e) => e === el || hasOwnText(e));
      for (const e of candidates) {
        const cs = getComputedStyle(e);
        if (cs.display === 'none' || cs.visibility === 'hidden') continue;
        if (e.closest('.sr-only') !== null) continue;
        const color = parse(cs.color);
        const bg = backgroundOf(e);
        out.push({ who: `${label(e)}${e === el ? '' : ' (안쪽 글자)'}`, color, bg });
      }
      return out;
    },
    [selector, index] as const,
  );
}

/** 문서 루트를 한 번만 받아 둔다 — DOM.getDocument를 다시 부르면 앞서 받은 nodeId가 무효가 된다 */
async function nodeIdsOf(cdp: CDPSession, rootId: number, selector: string): Promise<number[]> {
  const { nodeIds } = await cdp.send('DOM.querySelectorAll', { nodeId: rootId, selector });
  return nodeIds;
}

const STATES: ReadonlyArray<{ name: string; classes: string[] }> = [
  { name: 'hover', classes: ['hover'] },
  { name: 'hover+active', classes: ['hover', 'active'] },
  { name: '키보드 포커스', classes: ['focus', 'focus-visible'] },
  { name: 'hover+active+포커스', classes: ['hover', 'active', 'focus', 'focus-visible'] },
];

interface Target {
  name: string;
  /** 글자를 재는 요소 */
  selector: string;
}

const TARGETS: readonly Target[] = [
  { name: '하단 띠 버튼', selector: '[data-testid="bottom-bar"] button' },
  { name: '캐러셀 조작 버튼', selector: '[data-testid="carousel"] .carousel__nav button' },
  { name: '라디오 카드', selector: '.radio-card' },
  // SPEC-005 HS2: 인생 길이는 라디오 카드가 아니라 작은 분절 컨트롤의 칸(`.seg__opt`)이다 — 선택(Highlight 면)·비활성(GrayText 점선) 칸도 같은 규칙으로 잰다
  { name: '분절 컨트롤 칸', selector: '.seg__opt' },
];

/** 한 화면(상태)의 모든 대상 × 모든 상태를 재고 위반 목록(비어 있으면 통과)과 잰 횟수를 돌려준다 */
async function auditStates(page: Page, label: string): Promise<{ problems: string[]; measured: number; targets: string[] }> {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('DOM.enable');
  await cdp.send('CSS.enable');
  const rootId = (await cdp.send('DOM.getDocument', { depth: 0 })).root.nodeId;
  const problems: string[] = [];
  const names: string[] = [];
  let measured = 0;
  for (const t of TARGETS) {
    const ids = await nodeIdsOf(cdp, rootId, t.selector);
    for (let i = 0; i < ids.length; i++) {
      const id = (await page.evaluate(([sel, idx]) => (document.querySelectorAll(sel as string)[idx as number] as HTMLElement).getAttribute('data-testid') ?? (document.querySelectorAll(sel as string)[idx as number] as HTMLElement).textContent?.trim().slice(0, 12) ?? '', [t.selector, i] as const)) || `#${i}`;
      names.push(`${t.name}:${id}`);
      // 입력 안쪽(라디오 카드): 포커스는 안쪽 input이 받는다
      const innerIds = t.selector === '.radio-card' || t.selector === '.seg__opt' ? await nodeIdsOf(cdp, rootId, `${t.selector} input`) : [];
      for (const s of [{ name: '쉬는 상태', classes: [] as string[] }, ...STATES]) {
        const focusish = s.classes.includes('focus');
        const nonFocus = s.classes.filter((c) => c !== 'focus' && c !== 'focus-visible');
        await cdp.send('CSS.forcePseudoState', { nodeId: ids[i], forcedPseudoClasses: nonFocus });
        if (innerIds.length > 0) await cdp.send('CSS.forcePseudoState', { nodeId: innerIds[i], forcedPseudoClasses: focusish ? ['focus', 'focus-visible'] : [] });
        else if (focusish) await cdp.send('CSS.forcePseudoState', { nodeId: ids[i], forcedPseudoClasses: s.classes });
        await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
        for (const sample of await sampleColors(page, t.selector, i)) {
          measured++;
          const same = sample.color.r === sample.bg.r && sample.color.g === sample.bg.g && sample.color.b === sample.bg.b;
          const ratio = contrast(sample.color, sample.bg);
          const rgb = (c: Rgb) => `rgb(${c.r}, ${c.g}, ${c.b})`;
          if (same) problems.push(`${label} ${t.name} 「${id}」 ${s.name}: ${sample.who} 글자 ${rgb(sample.color)} = 배경 ${rgb(sample.bg)} (글자가 안 보인다)`);
          else if (ratio < 3) problems.push(`${label} ${t.name} 「${id}」 ${s.name}: ${sample.who} 글자 ${rgb(sample.color)} / 배경 ${rgb(sample.bg)} 대비 ${ratio.toFixed(2)}:1 < 3:1`);
        }
        // 되돌린다
        await cdp.send('CSS.forcePseudoState', { nodeId: ids[i], forcedPseudoClasses: [] });
        if (innerIds.length > 0) await cdp.send('CSS.forcePseudoState', { nodeId: innerIds[i], forcedPseudoClasses: [] });
      }
    }
  }
  return { problems, measured, targets: names };
}

async function noTransitions(page: Page): Promise<void> {
  await page.addStyleTag({ content: '*, *::before, *::after { transition: none !important; }' });
}

for (const scheme of ['light', 'dark'] as const) {
  for (const state of BAR_STATES) {
    test(`강제 색상 · ${scheme} · ${state}: 버튼·라디오 카드의 hover·active·키보드 포커스 상태에서 글자색 ≠ 배경색이고 대비 3:1 이상이다`, async ({ page }, testInfo) => {
      test.skip(testInfo.project.name !== 'mobile-360', '뷰포트를 직접 지정하므로 mobile-360에서만 실행');
      test.setTimeout(90_000);
      await page.setViewportSize({ width: 360, height: 740 });
      await page.emulateMedia({ forcedColors: 'active', colorScheme: scheme });
      await openBarState(page, state);
      expect(await page.evaluate(() => matchMedia('(forced-colors: active)').matches)).toBe(true);
      await expect(page.getByTestId(BAR_MAIN_BUTTON[state])).toBeEnabled(); // 입력 가드가 풀린 뒤(가드 중에는 반투명이다)
      await noTransitions(page);
      const audit = await auditStates(page, `${scheme}/${state}`);
      expect(audit.problems).toEqual([]);
      // 공허 통과 방지: 하단 띠 버튼(상태에 맞는 개수)·캐러셀 조작 버튼 3개·라디오 카드 3장(태어날 세상)·분절 컨트롤 칸 2개(인생 길이 — SPEC-005 HS2 전에는 라디오 카드 5장이었다)를 실제로 쟀다
      const expectedBar = state === 'new' ? 1 : 2;
      expect(audit.targets.filter((n) => n.startsWith('하단 띠 버튼')), '하단 띠 버튼').toHaveLength(expectedBar);
      expect(audit.targets.filter((n) => n.startsWith('캐러셀 조작 버튼')), '캐러셀 조작 버튼').toHaveLength(3);
      expect(audit.targets.filter((n) => n.startsWith('라디오 카드')), '라디오 카드').toHaveLength(3);
      expect(audit.targets.filter((n) => n.startsWith('분절 컨트롤 칸')), '분절 컨트롤 칸').toHaveLength(2);
      expect(audit.measured, '잰 (요소, 상태, 글자) 수').toBeGreaterThan((expectedBar + 3 + 5) * 5);
      testInfo.annotations.push({ type: 'forced-states', description: `${audit.targets.length}개 대상 × 5상태, 잰 글자 ${audit.measured}` });
    });
  }
}

test('강제 색상: 주 버튼에 마우스를 실제로 올리면(page.hover) 배경 Highlight·글자 HighlightText라 글자가 보이고, 눌러도(마우스 누름) 같다 — 올리기 전과 다른 짝이라 눌릴 수 있다는 변화도 보인다', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-360', '뷰포트를 직접 지정하므로 mobile-360에서만 실행');
  await page.setViewportSize({ width: 360, height: 740 });
  await page.emulateMedia({ forcedColors: 'active' });
  await page.goto('/');
  await expect(page.getByTestId('start-birth')).toBeEnabled();
  await noTransitions(page);
  const read = () =>
    page.evaluate(() => {
      const el = document.querySelector('[data-testid="start-birth"]') as HTMLElement;
      const cs = getComputedStyle(el);
      const sys = (name: string) => {
        const p = document.createElement('div');
        p.style.color = name;
        document.body.appendChild(p);
        const c = getComputedStyle(p).color;
        p.remove();
        return c;
      };
      return { bg: cs.backgroundColor, color: cs.color, hover: el.matches(':hover'), highlight: sys('Highlight'), highlightText: sys('HighlightText'), buttonFace: sys('ButtonFace'), buttonText: sys('ButtonText') };
    });
  const rest = await read();
  expect(rest.hover).toBe(false);
  expect(rest.bg, '쉬는 상태: ButtonFace').toBe(rest.buttonFace);
  expect(rest.color, '쉬는 상태: ButtonText').toBe(rest.buttonText);
  await page.hover('[data-testid="start-birth"]');
  await page.waitForTimeout(100);
  const hovered = await read();
  expect(hovered.hover, '마우스가 실제로 올라가 있다').toBe(true);
  expect(hovered.bg, 'hover: 배경 Highlight').toBe(hovered.highlight);
  expect(hovered.color, 'hover: 글자 HighlightText').toBe(hovered.highlightText);
  expect(hovered.bg).not.toBe(hovered.color);
  expect(hovered.bg, '올리기 전과 다른 짝이다').not.toBe(rest.bg);
  await page.screenshot({ path: 'qa/screenshots/003/dev-M2-r6-forced-colors-primary-hover.png', clip: { x: 0, y: 640, width: 360, height: 100 } });
  await page.mouse.down();
  const pressed = await read();
  expect(pressed.bg, '누름: 배경 Highlight').toBe(pressed.highlight);
  expect(pressed.color, '누름: 글자 HighlightText').toBe(pressed.highlightText);
  await page.mouse.move(1, 1); // 버튼 밖에서 놓아 클릭이 일어나지 않게 한다
  await page.mouse.up();
  testInfo.annotations.push({ type: 'hover', description: `쉬는 ${rest.bg}/${rest.color} → hover ${hovered.bg}/${hovered.color}` });
});
