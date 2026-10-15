import { expect, test, type Page } from '@playwright/test';
import type { EventDef } from '../src/core/events';
import { TEXT_LIMITS } from '../src/core/eventLint';
import { injectSave, lifeState, noHorizontalOverflow } from './helpers';

/**
 * R-042: 360px 레이아웃을 "첫 결정 하나"가 아니라 풀의 모든 선택지 이벤트로 잰다.
 *  1) 하니스(harness/layout.html — 실제 LifeScreen·실제 CSS)에서 모든 선택지 이벤트를 360×568·640·740으로 돌며
 *     선택지 전부(requires와 무관하게 그 이벤트의 선택지 전부, 최악의 경우)와 하단 컨트롤 6개가 첫 화면에 서로 가려지지 않고 가로로 넘치지 않는지 잰다.
 *  2) 길이 권장 최대(src/core/eventLint.ts#TEXT_LIMITS)로 만든 "최악의 이벤트"가 360×640·740에서 첫 화면에 다 들어오고,
 *     360×568에서는 스크롤로 모두 닿는지(고정 컨트롤 바에 영구히 가려지지 않는지) 본다.
 *  3) 가장 긴(패널이 가장 높은) 실제 이벤트를 실제 앱(저장 주입)에서도 같은 기준으로 확인한다.
 * 하니스는 개발 서버 전용이다(제품 번들에 없다).
 */

const VIEWPORTS = [
  { width: 360, height: 568 },
  { width: 360, height: 640 },
  { width: 360, height: 740 },
] as const;

interface Metrics {
  id: string;
  nChoices: number;
  overflowX: boolean;
  /** 선택지 버튼이 가로로 화면 밖에 있는가 */
  choiceOutside: boolean;
  /** 컨트롤 6개가 모두 화면 안에 있고 다른 요소에 가려지지 않는가 */
  controlsOk: boolean;
  /** 선택지 버튼 전부가 스크롤 없이 컨트롤 바 위에 온전히 보이는가(가려지지 않는가) */
  firstViewFit: boolean;
  /** 스크롤로 닿을 수 있는가: 각 선택지를 화면 가운데로 스크롤했을 때 어떤 요소에도 가려지지 않는가 */
  reachable: boolean;
  panelHeight: number;
  lastBottom: number;
  barTop: number;
}

/** 페이지 안에서 풀의 모든 선택지 이벤트(또는 주어진 custom 이벤트)를 보이고 레이아웃을 잰다. */
async function measureAll(page: Page, custom?: EventDef): Promise<Metrics[]> {
  return page.evaluate(async (customEvent) => {
    const w = window as unknown as { __layout: { ids: string[]; show: (id: string) => void; showCustom: (ev: unknown) => void } };
    const frames = () => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));
    const measure = (id: string): Metrics => {
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const panel = document.querySelector('[data-testid="choice-panel"]')!;
      const choices = [...panel.querySelectorAll('button')];
      const controls = [...document.querySelectorAll('[data-testid="controls"] button')];
      const bar = document.querySelector('[data-testid="controls"]')!.getBoundingClientRect();
      const uncovered = (el: Element) => {
        const r = el.getBoundingClientRect();
        const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
        return hit === el || el.contains(hit);
      };
      const inside = (el: Element) => {
        const r = el.getBoundingClientRect();
        return r.left >= 0 && r.right <= vw && r.top >= 0 && r.bottom <= vh;
      };
      window.scrollTo(0, 0);
      const firstViewFit = choices.every((b) => uncovered(b) && b.getBoundingClientRect().bottom <= bar.top && b.getBoundingClientRect().top >= 0);
      const lastBottom = Math.max(...choices.map((b) => b.getBoundingClientRect().bottom));
      const panelHeight = panel.getBoundingClientRect().height;
      let reachable = true;
      for (const b of choices) {
        b.scrollIntoView({ block: 'center' });
        if (!uncovered(b) || !inside(b)) reachable = false;
      }
      window.scrollTo(0, 0);
      return {
        id,
        nChoices: choices.length,
        overflowX: document.documentElement.scrollWidth > document.documentElement.clientWidth,
        choiceOutside: choices.some((b) => b.getBoundingClientRect().left < 0 || b.getBoundingClientRect().right > vw),
        controlsOk: controls.length === 6 && controls.every((b) => inside(b) && uncovered(b)),
        firstViewFit,
        reachable,
        panelHeight,
        lastBottom,
        barTop: bar.top,
      };
    };
    const out: Metrics[] = [];
    if (customEvent !== undefined) {
      w.__layout.showCustom(customEvent);
      await frames();
      out.push(measure((customEvent as { id: string }).id));
      return out;
    }
    for (const id of w.__layout.ids) {
      w.__layout.show(id);
      await frames();
      out.push(measure(id));
    }
    return out;
  }, custom);
}

async function openHarness(page: Page, vp: { width: number; height: number }): Promise<void> {
  await page.setViewportSize(vp);
  await page.goto('/harness/layout.html');
  await page.waitForFunction(() => (window as unknown as { __layout?: unknown }).__layout !== undefined);
}

/** 권장 최대 길이 끝값으로 만든 최악의 이벤트: 제목·본문·라벨이 모두 최대이고 선택지가 3개. 글자는 단어 사이 공백으로 줄바꿈 낭비가 큰 한글 덩어리를 쓴다. */
function worstCaseEvent(): EventDef {
  const chunk = '가나다라마 바사아자차 카타파하가 나다라마바 사아자차카 타파하가나 다라마바사 아자차카타 파하가나다 라마바사아 자차카타파 하가나다라';
  const fit = (n: number) => chunk.slice(0, n).trim();
  return {
    id: 'layout-worst-case',
    title: fit(TEXT_LIMITS.title),
    text: fit(TEXT_LIMITS.text),
    stages: ['youth'],
    weight: 10,
    once: true,
    choices: [1, 2, 3].map((i) => ({ id: `c${i}`, label: fit(TEXT_LIMITS.label - 1) + '다', result: '결과 문장이다.' })),
  };
}

for (const vp of VIEWPORTS) {
  test(`${vp.width}x${vp.height}: 풀의 모든 선택지 이벤트 — 선택지 전부와 컨트롤 6개가 첫 화면에서 서로 가려지지 않고 가로로 넘치지 않는다 (R-042)`, async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile-360', '뷰포트를 직접 지정하므로 mobile-360에서만 실행');
    test.setTimeout(120_000);
    await openHarness(page, vp);
    const all = await measureAll(page);
    expect(all.length, '풀의 선택지 이벤트가 충분히 있어야 한다').toBeGreaterThanOrEqual(40);
    const fail = (m: Metrics, why: string) =>
      `${m.id}: ${why} (선택지 ${m.nChoices}개, 패널 높이 ${Math.round(m.panelHeight)}px, 마지막 선택지 아래 ${Math.round(m.lastBottom)}px / 컨트롤 바 위 ${Math.round(m.barTop)}px)`;
    for (const m of all) {
      expect(m.overflowX, fail(m, '가로로 넘친다')).toBe(false);
      expect(m.choiceOutside, fail(m, '선택지가 화면 밖에 있다')).toBe(false);
      expect(m.controlsOk, fail(m, '컨트롤 6개가 화면 안에서 가려진다')).toBe(true);
      expect(m.reachable, fail(m, '스크롤해도 선택지가 가려진다')).toBe(true);
      expect(m.firstViewFit, fail(m, '선택지가 첫 화면에서 컨트롤 바에 가려지거나 화면 밖으로 밀린다 — 문구를 줄인다(docs/data/events-schema.md 7절)')).toBe(true);
    }
    // 판별력: 세 선택지를 모두 가진 이벤트가 실제로 있고 그것도 통과했다
    expect(all.some((m) => m.nChoices === 3)).toBe(true);
    expect(all.some((m) => m.nChoices === 2)).toBe(true);
    // 값이 의미 있게 달라지는지(모두 같은 높이면 측정이 헛돈 것): 가장 큰 패널이 가장 작은 패널보다 눈에 띄게 크다
    const heights = all.map((m) => m.panelHeight);
    expect(Math.max(...heights) - Math.min(...heights)).toBeGreaterThan(40);
  });
}

test('권장 최대 길이(제목 16·본문 70·라벨 24자 ×3)로 만든 최악의 이벤트: 360×640·740은 첫 화면에 다 들어오고, 360×568은 스크롤로 모두 닿는다 (R-042)', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-360', '뷰포트를 직접 지정하므로 mobile-360에서만 실행');
  const ev = worstCaseEvent();
  expect(ev.text.length).toBe(TEXT_LIMITS.text);
  expect(ev.title.length).toBeLessThanOrEqual(TEXT_LIMITS.title);
  const results: Record<string, Metrics> = {};
  for (const vp of VIEWPORTS) {
    await openHarness(page, vp);
    const [m] = await measureAll(page, ev);
    results[`${vp.width}x${vp.height}`] = m;
    expect(m.nChoices).toBe(3);
    expect(m.overflowX).toBe(false);
    expect(m.choiceOutside).toBe(false);
    expect(m.controlsOk).toBe(true);
    expect(m.reachable, `${vp.height}: 스크롤해도 선택지가 가려진다`).toBe(true);
  }
  expect(results['360x640'].firstViewFit, `360×640 첫 화면: 마지막 선택지 아래 ${results['360x640'].lastBottom}px / 컨트롤 바 위 ${results['360x640'].barTop}px`).toBe(true);
  expect(results['360x740'].firstViewFit).toBe(true);
  // 360×568은 최악의 이벤트가 첫 화면을 넘는다(스크롤 필요). 이것이 알려진 한계임을 기록해 둔다 — 고정 컨트롤 바의 높이 때문이며 화면 정리는 M5 몫이다.
  expect(results['360x568'].firstViewFit).toBe(false);
});

test('가장 긴(패널이 가장 높은) 실제 이벤트를 실제 앱에서 열어도 360×568·640에서 선택지 3개와 컨트롤이 가려지지 않는다 (R-042)', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-360', '뷰포트를 직접 지정하므로 mobile-360에서만 실행');
  test.setTimeout(90_000);
  // 1) 하니스에서 360×568 기준으로 패널이 가장 높은 이벤트를 찾는다
  await openHarness(page, VIEWPORTS[0]);
  const all = await measureAll(page);
  const tallest = [...all].sort((a, b) => b.panelHeight - a.panelHeight)[0];
  expect(tallest.nChoices).toBe(3);
  // 2) 같은 이벤트를 실제 앱에서 열어 같은 기준으로 잰다(선택지는 requires와 무관하게 전부 보이도록 저장에 넣는다)
  const choiceIds = await page.evaluate<string[]>(`(async () => {
    const mod = await import('/src/data/events/index.ts');
    return mod.EVENT_POOL.byId.get(${JSON.stringify(tallest.id)}).choices.map((c) => c.id);
  })()`);
  const base = lifeState(777);
  const age = 30;
  const state = {
    ...base,
    age,
    seen: { [tallest.id]: age },
    pending: { eventId: tallest.id, key: `${tallest.id}@${age}`, age, choiceIds },
    lastChoiceAge: age,
  };
  for (const vp of [VIEWPORTS[0], VIEWPORTS[1]]) {
    await page.setViewportSize(vp);
    await injectSave(page, state, '/');
    const panel = page.getByTestId('choice-panel');
    await expect(panel).toBeVisible();
    expect(await panel.getAttribute('data-key')).toBe(`${tallest.id}@${age}`);
    for (const id of choiceIds) await expect(page.getByTestId(`choice-${id}`)).toBeEnabled();
    const m = await page.evaluate(() => {
      const vh = window.innerHeight;
      const rect = (el: Element) => {
        const r = el.getBoundingClientRect();
        const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
        return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, covered: !(hit === el || el.contains(hit)), name: (el.textContent ?? '').trim() };
      };
      return {
        vw: window.innerWidth,
        vh,
        choices: [...document.querySelectorAll('[data-testid="choice-panel"] button')].map(rect),
        controls: [...document.querySelectorAll('[data-testid="controls"] button')].map(rect),
      };
    });
    expect(m.choices).toHaveLength(3);
    expect(m.controls).toHaveLength(6);
    for (const b of [...m.choices, ...m.controls]) {
      expect(b.left, b.name).toBeGreaterThanOrEqual(0);
      expect(b.right, b.name).toBeLessThanOrEqual(m.vw);
      expect(b.top, b.name).toBeGreaterThanOrEqual(0);
      expect(b.bottom, `${tallest.id} @${vp.height}: ${b.name}`).toBeLessThanOrEqual(m.vh);
      expect(b.covered, `${tallest.id} @${vp.height}: ${b.name}이(가) 다른 요소에 가려져 눌리지 않는다`).toBe(false);
    }
    expect(await noHorizontalOverflow(page)).toBe(true);
  }
});
