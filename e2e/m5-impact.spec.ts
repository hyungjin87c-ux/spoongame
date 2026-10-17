import { expect, test, type Page } from '@playwright/test';
import { auditFocus, summarize } from './focusObscured';
import { INTENDED_BREAK_WORDS } from './intendedBreaks';
import { describeWordBreak, measureLineBreaks, measureWordBreaks } from './lineBreaks';
import { dashViolations, measureDash, settleDash } from './m4Fixed';
import { IMPACT_SCREENS, openImpactScreen, readImpactDom, type ImpactScreen } from './m5States';
import { evalCore, readSave, startPageHidden } from './helpers';
import { setRootFontPercent } from './textResize';
import { STANDARD_VIEWPORTS } from './viewports';

/**
 * 선택지 영향 줄 (SPEC-003 M5 EC5 — docs/design/copy.md 4절 · design-system.md 6절·11-9절): 영향 줄이 있는 선택지 카드가 CM10·CM11·QM2-10 규칙 4·QM3-1·대비 기준을 지키는지, 화면의 표기가 실제 결과와 같은지.
 * 상태 둘(e2e/m5States.ts): impact-young(20세 미만, 첫 항목 「집안 살림」, 가장 긴 줄 4항목) · impact-adult(20세 이상, 가장 긴 줄 5항목). 성인 상태는 M4 감사의 `dash-decision`도 쓴다.
 * 모든 테스트가 뷰포트를 직접 지정하므로 mobile-360에서만 돈다(폭 1280은 desktop 프로젝트).
 */

/** 이 스크린의 선택지 카드에 있는 영향 줄 항목 수(공허 통과 방지) */
const MIN_ITEMS: Record<ImpactScreen, number> = { 'impact-young': 4, 'impact-adult': 5 };

async function impactCount(page: Page): Promise<number> {
  return page.locator('[data-testid="choice-panel"] .impact__item').count();
}

// ---------- CM10: 공통 뷰포트 11종 × 글자 100·200% — 포커스 가림 0 ----------

for (const vp of STANDARD_VIEWPORTS) {
  test.describe(`M5 영향 줄 포커스 ${vp.name}`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height }, hasTouch: vp.touch === true });
    for (const percent of [100, 200] as const) {
      for (const screen of IMPACT_SCREENS) {
        test(`${vp.name} · 글자 ${percent}% · ${screen}: Tab·Shift+Tab 전체 순회·프로그램 focus()에서 가려진 포커스 0, 선택지가 모두 순회에 든다 (CM10)`, async ({ page }, testInfo) => {
          test.skip(testInfo.project.name !== 'mobile-360', '뷰포트를 직접 지정하므로 mobile-360에서만 실행');
          // SPEC-003 QM2-1 r5 메모 4: 320×256에 글자 200%를 겹친 조합은 CM10 포커스 측정에서 제외한다(focus-not-obscured.spec.ts와 같다)
          test.skip(percent === 200 && vp.name === '320x256-zoom400', 'CM10 측정 제외 조합(QM2-1 r5 메모 4)');
          test.setTimeout(180_000);
          await openImpactScreen(page, screen);
          if (percent !== 100) await setRootFontPercent(page, percent);
          await settleDash(page);
          const audit = await auditFocus(page, `${vp.name}/${percent}%/${screen}`, { headingTestId: 'life-name' });
          expect(audit.violations, summarize(audit)).toEqual([]);
          const dom = await readImpactDom(page);
          expect(dom.length, '선택지 수').toBeGreaterThanOrEqual(3);
          for (const c of dom) {
            expect(audit.tabbables, `선택지 choice-${c.choiceId}가 순회에 든다`).toContain(`choice-${c.choiceId}`);
            expect(audit.forward.map((s) => s.id)).toContain(`choice-${c.choiceId}`);
            expect(audit.backward.map((s) => s.id)).toContain(`choice-${c.choiceId}`);
          }
          expect(await impactCount(page), '영향 줄 항목 수').toBeGreaterThanOrEqual(MIN_ITEMS[screen]);
        });
      }
    }
  });
}

// ---------- CM11: 글자 확대·고정 요소 규칙 + 가로 넘침·글자 잘림 0 ----------

for (const vp of STANDARD_VIEWPORTS) {
  test.describe(`M5 영향 줄 리플로 ${vp.name}`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height }, hasTouch: vp.touch === true });
    for (const percent of [100, 200] as const) {
      for (const screen of IMPACT_SCREENS) {
        test(`${vp.name} · 글자 ${percent}% · ${screen}: 가로 넘침 0px·글자 잘림 0·헤더/진행 줄 규칙·버튼 ≥ 44px (CM11)`, async ({ page }) => {
          test.skip(test.info().project.name !== 'mobile-360', '뷰포트를 직접 지정하므로 mobile-360에서만 실행');
          test.setTimeout(90_000);
          await openImpactScreen(page, screen);
          if (percent !== 100) await setRootFontPercent(page, percent);
          const m = await measureDash(page);
          expect(dashViolations(m, `${vp.name}/${percent}%/${screen}`)).toEqual([]);
        });
      }
    }
  });
}

// ---------- 줄바꿈·낱말 끊김 (QM2-10·QM3-1) ----------

for (const width of [320, 360, 1280] as const) {
  for (const percent of [100, 150, 200] as const) {
    for (const screen of IMPACT_SCREENS) {
      test(`${width}px · 글자 ${percent}% · ${screen}: 영향 줄·안내 한 줄의 낱말이 끊기지 않고(measureWordBreaks 0) 줄 끝·첫머리에 혼자 남는 기호가 없다`, async ({ page }, testInfo) => {
        const mobile = testInfo.project.name === 'mobile-360';
        test.skip(mobile !== (width < 960), width < 960 ? 'mobile-360에서만 실행' : 'desktop에서만 실행');
        test.setTimeout(90_000);
        await page.setViewportSize({ width, height: mobile ? 740 : 800 });
        await openImpactScreen(page, screen);
        if (percent !== 100) await setRootFontPercent(page, percent);
        const scope = '[data-testid="choice-panel"]';
        const plain = await measureLineBreaks(page, scope, { separators: true, keeps: true });
        expect(plain.violations).toEqual([]);
        const words = await measureWordBreaks(page, { scope });
        expect(words.checked, '잰 낱말 수(공허 통과 방지)').toBeGreaterThan(30);
        expect(words.broken.map(describeWordBreak), '한 줄 전체보다 짧은데 중간에서 끊긴 낱말(결함)').toEqual([]);
        if (percent === 100) expect(words.unavoidable.map(describeWordBreak)).toEqual([]);
        for (const i of words.intended) expect(INTENDED_BREAK_WORDS).toContain(i.word);
        expect(words.forced.map(describeWordBreak)).toEqual([]);
        if (words.unavoidable.length > 0) testInfo.annotations.push({ type: 'unavoidable(참고)', description: words.unavoidable.map(describeWordBreak).join(' · ') });
        // 영향 줄 이름·기호 낱말(「집안 살림」은 공백 포함 한 덩어리)이 실제로 잰 낱말에 들어 있다
        const impactWords = await page.evaluate(() => Array.from(document.querySelectorAll('.impact__name')).map((e) => e.textContent ?? ''));
        expect(impactWords.length).toBeGreaterThan(5);
      });
    }
  }
}

// ---------- 「·」는 CSS가 그린다: 항목 상자가 줄 안에 있고 줄 첫머리 항목의 기호는 컨테이너 밖에 놓여 가려진다 (11-9절) ----------

interface Geometry {
  containers: number;
  items: number;
  outside: string[];
  rows: number;
  firstInRowOffset: number[];
  innerGaps: number[];
  gapPx: number[];
  glyphInDom: boolean;
}

async function impactGeometry(page: Page): Promise<Geometry> {
  return page.evaluate(() => {
    const out: string[] = [];
    let rows = 0;
    let items = 0;
    const firstInRowOffset: number[] = [];
    const innerGaps: number[] = [];
    const gapPx: number[] = [];
    const containers = Array.from(document.querySelectorAll<HTMLElement>('[data-testid="choice-panel"] .impact'));
    for (const c of containers) {
      const cb = c.getBoundingClientRect();
      const gap = parseFloat(getComputedStyle(c).columnGap);
      gapPx.push(gap);
      const list = Array.from(c.querySelectorAll<HTMLElement>('.impact__item'));
      items += list.length;
      let rowTop = -1;
      let prevRight = 0;
      for (const it of list) {
        const r = it.getBoundingClientRect();
        if (r.left < cb.left - 0.5 || r.right > cb.right + 0.5 || r.top < cb.top - 0.5 || r.bottom > cb.bottom + 0.5) out.push(`${it.getAttribute('data-key')}: 항목 상자가 줄 밖`);
        if (rowTop < 0 || Math.abs(r.top - rowTop) > 3) {
          rows++;
          rowTop = r.top;
          firstInRowOffset.push(r.left - cb.left); // 줄 첫머리 항목은 컨테이너 왼쪽 끝 — 그 ::before(left: −간격)는 컨테이너 밖이다
        } else innerGaps.push(r.left - prevRight); // 같은 줄의 이웃과는 간격(「·」가 가운데에 놓이는 자리)만큼 떨어져 있다
        prevRight = r.right;
      }
    }
    const glyph = containers.some((c) => (c.textContent ?? '').includes('·'));
    return { containers: containers.length, items, outside: out, rows, firstInRowOffset, innerGaps, gapPx, glyphInDom: glyph };
  });
}

for (const [width, percent] of [
  [360, 100],
  [360, 200],
  [320, 100],
  [320, 200],
  [1280, 100],
] as const) {
  for (const screen of IMPACT_SCREENS) {
    test(`영향 줄 기하 ${width}px · 글자 ${percent}% · ${screen}: 모든 항목 상자가 줄 안, 줄 첫머리 항목은 컨테이너 왼쪽 끝, 같은 줄 이웃 사이는 간격만큼, DOM 글자에 「·」 없음 (11-9절)`, async ({ page }, testInfo) => {
      const mobile = testInfo.project.name === 'mobile-360';
      test.skip(mobile !== (width < 960), width < 960 ? 'mobile-360에서만 실행' : 'desktop에서만 실행');
      test.setTimeout(60_000);
      await page.setViewportSize({ width, height: mobile ? 740 : 800 });
      await openImpactScreen(page, screen);
      if (percent !== 100) await setRootFontPercent(page, percent);
      const g = await impactGeometry(page);
      expect(g.containers, '영향 줄이 있는 선택지 수').toBeGreaterThanOrEqual(2);
      expect(g.items).toBeGreaterThanOrEqual(MIN_ITEMS[screen] + 2);
      expect(g.outside).toEqual([]);
      expect(g.glyphInDom, 'DOM 글자에 「·」가 없다').toBe(false);
      for (const off of g.firstInRowOffset) expect(Math.abs(off), '줄 첫머리 항목은 컨테이너 왼쪽 끝').toBeLessThanOrEqual(0.5);
      for (const gap of g.innerGaps) expect(gap, '같은 줄 이웃 사이 간격(「·」 자리)').toBeGreaterThanOrEqual(g.gapPx[0] - 0.5);
      testInfo.annotations.push({ type: '측정', description: `항목 ${g.items} · 줄 ${g.rows} · 같은 줄 이웃 사이 ${g.innerGaps.length}곳(최소 ${g.innerGaps.length ? Math.min(...g.innerGaps).toFixed(1) : '-'}px)` });
    });
  }
}

test('영향 줄 기하 대조: CSS 가장자리 감춤(overflow hidden)을 지우면 줄 첫머리 항목의 「·」가 컨테이너 밖으로 새어 나온다 — 규칙이 실제로 일한다', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-360', 'mobile-360에서만 실행');
  await page.setViewportSize({ width: 320, height: 568 });
  await openImpactScreen(page, 'impact-adult');
  await setRootFontPercent(page, 200);
  const probe = () =>
    page.evaluate(() => {
      let leaked = 0;
      for (const c of Array.from(document.querySelectorAll<HTMLElement>('.impact'))) {
        const cs = getComputedStyle(c);
        const gap = parseFloat(cs.columnGap);
        const cb = c.getBoundingClientRect();
        for (const it of Array.from(c.querySelectorAll<HTMLElement>('.impact__item'))) {
          const r = it.getBoundingClientRect();
          // 줄 첫머리 항목의 ::before 상자: 왼쪽 끝이 컨테이너 왼쪽 끝 − 간격
          if (Math.abs(r.left - cb.left) <= 0.5 && cs.overflow === 'visible') leaked += gap > 0 ? 1 : 0;
        }
      }
      return { leaked, overflow: Array.from(document.querySelectorAll<HTMLElement>('.impact')).map((c) => getComputedStyle(c).overflow) };
    });
  const before = await probe();
  expect(before.leaked, '규칙이 일하는 동안 새는 기호 0').toBe(0);
  expect(new Set(before.overflow)).toEqual(new Set(['hidden']));
  await page.addStyleTag({ content: '.impact { overflow: visible !important; }' });
  const after = await probe();
  expect(after.leaked, '규칙을 지우면 줄 첫머리 항목마다 기호가 새어 나올 자리가 생긴다').toBeGreaterThan(0);
});

// ---------- 선택지 번호 원 (D-38): 원이 글자 크기를 따라가 숫자가 원 밖으로 걸치지 않는다 ----------

/**
 * 선택지 번호 원마다: 원 상자, 숫자 획이 원의 안쪽(테두리 안)에서 사방으로 얼마나 떨어져 있는가(margin, px).
 * 숫자의 획 범위는 글자 상자(Range)가 아니라 글꼴 지표로 잰다 — 글자 상자는 윗돌출·아랫돌출 여백을 품어 실제 획보다 크다. 캔버스 measureText의 actualBoundingBox*로 획 범위를 구하고,
 * 기준선은 글자 상자 윗끝 + fontBoundingBoxAscent다. 원은 원이어야 한다(가로 = 세로).
 */
async function numberCircles(page: Page) {
  return page.evaluate(() => {
    const ctx = document.createElement('canvas').getContext('2d');
    if (ctx === null) throw new Error('canvas 2d를 못 얻었다');
    return Array.from(document.querySelectorAll<HTMLElement>('[data-testid="choice-panel"] .choice__no')).map((el) => {
      const c = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      const bw = parseFloat(cs.borderTopWidth);
      const text = Array.from(el.childNodes).find((n) => n.nodeType === Node.TEXT_NODE && (n.textContent ?? '').trim() !== '');
      let margin = Number.NEGATIVE_INFINITY;
      let ink = { left: 0, top: 0, right: 0, bottom: 0 };
      if (text !== undefined) {
        const range = document.createRange();
        range.selectNodeContents(text);
        const g = range.getBoundingClientRect();
        ctx.font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
        const label = (text.textContent ?? '').trim();
        const m = ctx.measureText(label);
        const baseline = g.top + m.fontBoundingBoxAscent;
        ink = { left: g.left - m.actualBoundingBoxLeft, right: g.left + m.actualBoundingBoxRight, top: baseline - m.actualBoundingBoxAscent, bottom: baseline + m.actualBoundingBoxDescent };
        margin = Math.min(ink.left - (c.left + bw), c.right - bw - ink.right, ink.top - (c.top + bw), c.bottom - bw - ink.bottom);
      }
      return { label: (el.textContent ?? '').trim(), width: c.width, height: c.height, overflowY: el.scrollHeight - el.clientHeight, overflowX: el.scrollWidth - el.clientWidth, margin, ink, circle: { left: c.left, top: c.top, right: c.right, bottom: c.bottom }, fontPx: parseFloat(cs.fontSize) };
    });
  });
}

/** 숫자 획과 원 테두리 안쪽 사이에 두어야 할 최소 틈(px). 고친 원은 사방 5px 넘게 떨어지고, 26px 고정 원은 글자 200%에서 1px 안쪽이다 */
const MIN_NUMBER_MARGIN = 2;

for (const percent of [100, 150, 200] as const) {
  for (const screen of IMPACT_SCREENS) {
    test(`선택지 번호 원 · 글자 ${percent}% · ${screen}: 숫자 획이 원 테두리 안쪽에서 사방 ${MIN_NUMBER_MARGIN}px 넘게 떨어지고 원은 글자 크기(+12px)를 따라 커진다 (D-38)`, async ({ page }, testInfo) => {
      test.skip(testInfo.project.name !== 'mobile-360', 'mobile-360에서만 실행');
      await page.setViewportSize({ width: 320, height: 740 });
      await openImpactScreen(page, screen);
      if (percent !== 100) await setRootFontPercent(page, percent);
      const circles = await numberCircles(page);
      expect(circles.length, '번호 원이 있는 선택지 수').toBeGreaterThanOrEqual(2);
      for (const c of circles) {
        expect(c.margin, `숫자 ${c.label}가 원 테두리에 닿거나 걸침 (원 ${JSON.stringify(c.circle)}, 획 ${JSON.stringify(c.ink)})`).toBeGreaterThanOrEqual(MIN_NUMBER_MARGIN);
        expect(c.overflowY, `원 ${c.label}의 안쪽이 숫자 줄 상자를 담지 못한다(scrollHeight > clientHeight)`).toBeLessThanOrEqual(0);
        expect(c.overflowX, `원 ${c.label}의 안쪽이 숫자 폭을 담지 못한다(scrollWidth > clientWidth)`).toBeLessThanOrEqual(0);
        expect(Math.abs(c.width - c.height), `원 ${c.label}의 가로 = 세로`).toBeLessThanOrEqual(0.5);
        expect(Math.abs(c.width - (c.fontPx + 12)), `원 ${c.label}의 크기 = 글자 크기 + 12px`).toBeLessThanOrEqual(0.5);
      }
      expect(circles[0].fontPx, '글자 크기가 실제로 바뀌었다(공허 통과 방지)').toBeCloseTo(14 * (percent / 100), 0);
      testInfo.annotations.push({ type: '측정', description: `원 ${circles[0].width.toFixed(1)}px · 숫자 글자 ${circles[0].fontPx}px · 획과 테두리 사이 최소 ${Math.min(...circles.map((x) => x.margin)).toFixed(1)}px · ${circles.length}개` });
    });
  }
}

test('선택지 번호 원 대조: 원을 26px로 고정하거나 숫자가 본문 줄 높이를 물려받으면 글자 200%에서 원 안쪽을 넘는다 — 측정이 실제로 일한다', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-360', 'mobile-360에서만 실행');
  await page.setViewportSize({ width: 320, height: 740 });
  await openImpactScreen(page, 'impact-adult');
  await setRootFontPercent(page, 200);
  const before = await numberCircles(page);
  expect(Math.min(...before.map((c) => c.margin)), '고친 원은 숫자 둘레에 틈이 있다').toBeGreaterThanOrEqual(MIN_NUMBER_MARGIN);
  expect(Math.max(...before.map((c) => c.overflowY)), '고친 원은 안쪽이 숫자 줄 상자를 담는다(scrollHeight ≤ clientHeight)').toBeLessThanOrEqual(0);
  // 크기만 글자에 묶고 line-height: 1을 빼면(숫자가 본문 줄 높이 1.6을 물려받으면) 숫자의 줄 상자가 원 안쪽을 넘는다
  const lh = await page.addStyleTag({ content: '.choice__no { line-height: 1.6 !important; }' });
  const inherited = await numberCircles(page);
  expect(Math.max(...inherited.map((c) => c.overflowY)), 'line-height: 1을 빼면 scrollHeight > clientHeight').toBeGreaterThan(0);
  await lh.evaluate((el) => (el as Element).remove());
  // 글자 크기에 묶지 않고 26px로 고정하면 숫자 획이 테두리에 닿거나 걸치고 줄 상자도 넘는다
  await page.addStyleTag({ content: '.choice__no { width: 26px !important; height: 26px !important; }' });
  const after = await numberCircles(page);
  expect(Math.min(...after.map((c) => c.margin)), '26px 고정이면 숫자 획이 테두리에 닿거나 걸친다').toBeLessThan(MIN_NUMBER_MARGIN);
  expect(Math.max(...after.map((c) => c.overflowY)), '26px 고정이면 scrollHeight > clientHeight').toBeGreaterThan(0);
});

// ---------- 접근성: 선택지 버튼의 이름과 안내 한 줄 (copy.md 4-3·4-4) ----------

for (const screen of IMPACT_SCREENS) {
  test(`${screen}: 선택지 버튼의 접근 가능한 이름 = 「{선택지 이름} {영향 문장들}」이고 눈에 보이는 기호·번호는 이름에 들지 않는다. 안내 한 줄의 둘째 문장은 대체 글자로 읽힌다`, async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile-360', 'mobile-360에서만 실행');
    await page.setViewportSize({ width: 360, height: 740 });
    await openImpactScreen(page, screen);
    const dom = await readImpactDom(page);
    expect(dom.length).toBeGreaterThanOrEqual(3);
    let withImpact = 0;
    for (const c of dom) {
      const expected = c.items.length === 0 ? c.label : `${c.label} ${c.items.map((i) => i.sentence).join(' ')}`;
      // Playwright의 접근성 이름(브라우저의 이름 계산): exact로 하나만 찾힌다
      await expect(page.getByRole('button', { name: expected, exact: true }), `선택지 ${c.choiceId}`).toHaveCount(1);
      expect(expected).not.toMatch(/[▲▼]/);
      if (c.items.length > 0) withImpact++;
      // 눈에 보이는 글자는 「이름 기호」, 문장은 sr-only
      for (const it of c.items) {
        expect(it.shown).toMatch(/^(자산|집안 살림|부채|관계|행복|건강|지식)s*[▲▼]{1,3}$/); // 이름과 기호 사이의 틈은 CSS gap이라 글자에는 없다
        expect(it.sentence.endsWith('.')).toBe(true);
      }
    }
    expect(withImpact, '영향 줄이 있는 선택지').toBeGreaterThanOrEqual(2);
    const hint = page.getByTestId('choice-hint');
    await expect(hint).toBeVisible();
    const parts = await hint.evaluate((el) => ({ visible: Array.from(el.childNodes).filter((n) => !(n instanceof HTMLElement && (n.classList.contains('sr-only') || n.getAttribute('aria-hidden') === 'true'))).map((n) => n.textContent ?? '').join(''), hidden: el.querySelector('[aria-hidden="true"]')?.textContent ?? '', sr: el.querySelector('.sr-only')?.textContent ?? '' }));
    expect(parts.visible.trim()).toMatch(/^선택지 아래 글씨는 지금 .+에게 일어날 변화입니다\.$/);
    expect(parts.hidden).toBe('▲는 늘어남, ▼는 줄어듦이며 표시가 많을수록 변화가 큽니다.');
    expect(parts.sr).toBe('위쪽 세모는 늘어남, 아래쪽 세모는 줄어듦이며 표시가 많을수록 변화가 큽니다.');
  });
}

// ---------- 표기 = 실제 결과 (숨은 효과 0) ----------

test('impact-adult: 선택지마다 화면의 영향 줄이 그 상태에서 선택이 하는 일과 같다 — 항목은 core 미리보기와 같고, 고른 뒤 저장된 상태가 core의 해결 결과와 같으며 상태 변화의 방향이 표기와 맞다', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-360', 'mobile-360에서만 실행');
  test.setTimeout(240_000);
  await page.setViewportSize({ width: 360, height: 740 });
  const state = await openImpactScreen(page, 'impact-adult');
  const dom = await readImpactDom(page);
  const preview = await evalCore<Array<{ choiceId: string; items: Array<{ key: string; direction: string; steps: number }>; detail: { dNet: number; dDebt: number; stats: Record<string, number> } }>>(
    page,
    `const { EVENT_POOL } = await import('/src/data/events/index.ts');
     return core.previewPending(arg, EVENT_POOL).map((p) => ({ choiceId: p.choiceId, items: p.impact.items.map((i) => ({ key: i.key, direction: i.direction, steps: i.steps })), detail: { dNet: p.impact.detail.dNet, dDebt: p.impact.detail.dDebt, stats: p.impact.detail.stats } }));`,
    state,
  );
  expect(dom.map((d) => d.choiceId)).toEqual(preview.map((p) => p.choiceId));
  // 화면의 항목 = core 미리보기 (순서·방향·칸 수)
  for (const d of dom) {
    const p = preview.find((x) => x.choiceId === d.choiceId)!;
    expect(d.items.map((i) => ({ key: i.key, direction: i.direction, steps: i.steps })), `선택지 ${d.choiceId}`).toEqual(p.items);
  }
  // 실제로 고른다: 선택지마다 같은 상태에서 다시 열어 클릭 → 저장된 결과가 core 해결 결과와 같고, 상태(건강·행복·지식·관계) 변화의 방향이 표기와 맞다(칸 2 이상 = |Δ| ≥ 3)
  let stateChecks = 0;
  let assetChecks = 0;
  for (const d of dom) {
    await startPageHidden(page);
    await openImpactScreen(page, 'impact-adult');
    const before = (await readSave(page)).data as unknown as { stats: Record<string, number>; assets: { net: number; debt: number }; age: number; pending: { key: string } };
    const expected = await evalCore<{ stats: Record<string, number>; assets: { net: number; debt: number }; flags: string[]; age: number }>(
      page,
      `return core.resolveChoiceStep(arg.state, arg.key, arg.id).state;`,
      { state, key: before.pending.key, id: d.choiceId },
    );
    await page.getByTestId(`choice-${d.choiceId}`).click();
    await expect(page.getByTestId('choice-panel')).toHaveCount(0);
    const after = (await readSave(page)).data as unknown as { stats: Record<string, number>; assets: { net: number; debt: number }; flags: string[]; age: number };
    expect(after.stats, `선택지 ${d.choiceId}: 저장된 상태 = core 해결 결과`).toEqual(expected.stats);
    expect(after.assets, `선택지 ${d.choiceId}: 자산`).toEqual(expected.assets);
    expect(after.flags).toEqual(expected.flags);
    for (const it of d.items) {
      if (['relationships', 'happiness', 'health', 'education'].includes(it.key) && it.steps >= 2) {
        const delta = after.stats[it.key] - before.stats[it.key];
        // 한 해의 자연 변화(최대 ±2)가 섞여도 표기 방향이 실제 변화의 방향이다
        expect(it.direction === 'up' ? delta : -delta, `선택지 ${d.choiceId} ${it.key} ${it.direction}`).toBeGreaterThan(0);
        stateChecks++;
      }
      if (it.key === 'assets' && it.steps >= 3) {
        // 자산 ▲▲▲ / ▼▼▼ (점수 ≥ 3,000만 원)는 한 해의 정산(연 현금흐름)보다 커서 순자산 변화의 방향이 표기와 같다
        const delta = after.assets.net - before.assets.net;
        expect(it.direction === 'up' ? delta : -delta, `선택지 ${d.choiceId} 자산 ${it.direction}`).toBeGreaterThan(0);
        assetChecks++;
      }
    }
  }
  expect(stateChecks + assetChecks, '방향을 대조한 항목 수(공허 통과 방지)').toBeGreaterThan(2);
});

test('impact-young: 20세 미만 선택지는 첫 항목이 「집안 살림」이고 「자산」은 없다 — 「부채」는 독립 때 확정되는 학자금 대출을 만드는 선택(apply·retry)에만 있다. 고르면 저장된 집안 살림이 core 해결 결과와 같다', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-360', 'mobile-360에서만 실행');
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 360, height: 740 });
  const state = await openImpactScreen(page, 'impact-young');
  const dom = await readImpactDom(page);
  const keys = dom.flatMap((d) => d.items.map((i) => i.key));
  expect(keys).toContain('family');
  expect(keys).not.toContain('assets');
  // R-351: 부채 항목은 college를 켜는 school-exam의 apply·retry에만 나온다 (그 밖의 20세 미만 선택지에는 없다)
  for (const d of dom) if (d.items.some((i) => i.key === 'debt')) expect(['apply', 'retry'], `선택지 ${d.choiceId}`).toContain(d.choiceId);
  for (const d of dom) if (d.items.some((i) => i.key === 'family')) expect(d.items[0].key, `선택지 ${d.choiceId}: 집안 살림이 첫 항목`).toBe('family');
  const pick = dom.find((d) => d.items.some((i) => i.key === 'family'))!;
  const expected = await evalCore<{ familyFund: number; stats: Record<string, number> }>(page, `return core.resolveChoiceStep(arg.state, arg.state.pending.key, arg.id).state;`, { state, id: pick.choiceId });
  await page.getByTestId(`choice-${pick.choiceId}`).click();
  await expect(page.getByTestId('choice-panel')).toHaveCount(0);
  const after = (await readSave(page)).data as unknown as { familyFund: number; stats: Record<string, number> };
  expect(after.familyFund).toBe(expected.familyFund);
  expect(after.stats).toEqual(expected.stats);
});
