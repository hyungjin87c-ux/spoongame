import { expect, test, type Page } from '@playwright/test';
import type { EventDef } from '../src/core/events';
import { TEXT_LIMITS } from '../src/core/eventLint';
import { injectSave, lifeState, noHorizontalOverflow } from './helpers';

/**
 * R-042: 360px 레이아웃을 "첫 결정 하나"가 아니라 풀의 모든 선택지 이벤트로 잰다. (M4 대시보드로 갱신 — 아래 「바뀐 점」)
 *  1) 하니스(harness/layout.html — 실제 LifeScreen·실제 CSS)에서 모든 선택지 이벤트를 360×568·640·740으로 돌며
 *     선택지 전부(requires와 무관하게 그 이벤트의 선택지 전부, 최악의 경우)와 하단 진행 줄 7개가 서로 가려지지 않고 가로로 넘치지 않는지 잰다.
 *  2) 길이 권장 최대(src/core/eventLint.ts#TEXT_LIMITS)로 만든 "최악의 이벤트"가 360×640·740에서 카드가 보인 자리(포커스가 선택지 제목에 가며 카드를 보이게 한다)에 다 들어오고,
 *     360×568에서는 스크롤로 모두 닿는지(고정 진행 줄에 영구히 가려지지 않는지) 본다.
 *  3) 가장 긴(패널이 가장 높은) 실제 이벤트를 실제 앱(저장 주입)에서도 같은 기준으로 확인한다.
 * 하니스는 개발 서버 전용이다(제품 번들에 없다).
 *
 * 바뀐 점(M4, 대시보드): 예전에는 선택지가 화면 맨 위에서 시작해 「스크롤 없이 첫 화면에 선택지 전부가 컨트롤 바 위에 온전히 보이는가」를 쟀다. 대시보드는 위에 고정 머리(로고·이름·진행률 바 약 95px)와 도구 줄이 있고,
 * 선택지 카드가 뜨면 선택지 제목으로 포커스가 가면서 카드를 **머리 바로 아래(고정 요소 가용 영역의 위)로 보이게 한다**(ui/focusReveal.ts#revealCard, CM10). 그래서 기준을 「카드가 보인 자리」로 바꿨다:
 *   - 카드가 보인 뒤 제목과 첫 선택지가 머리와 진행 줄 사이(가용 영역)에 온전히 보이고,
 *   - 선택지 전부는 스크롤로 닿으며(가운데로 스크롤하면 머리·진행 줄에 가려지지 않는다),
 *   - 진행 줄 7개는 늘 화면 안에서 가려지지 않고, 도구 줄 5개는 문서 맨 위에서 가로로 넘치지 않는다.
 * 360×740에서는 선택지 전부가 가용 영역에 들어오는지도 본다(큰 화면의 기대). 360×568·640에서 세 번째 선택지가 진행 줄 밑으로 밀리는 것은 알려진 한계이고 스크롤로 닿는다 — 측정 결과는 아래 표(allFit)가 기록한다.
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
  /** 진행 줄 7개가 모두 화면 안에 있고 다른 요소에 가려지지 않는가 */
  controlsOk: boolean;
  /** 도구 줄 5개(BGM·생각 남기기·다크 모드·의견 보내기·나가기)가 문서 맨 위에서 가로로 화면 안에 있고 가려지지 않는가 */
  toolsOk: boolean;
  /** 카드가 보인 뒤: 선택지 제목이 머리와 진행 줄 사이에 온전히 보이는가 */
  titleVisible: boolean;
  /** 카드가 보인 뒤: 첫 선택지가 머리와 진행 줄 사이에 온전히 보이고 가려지지 않는가 */
  firstChoiceVisible: boolean;
  /** 카드가 보인 뒤: 선택지 전부가 머리와 진행 줄 사이에 온전히 보이는가(스크롤 없이) */
  allFit: boolean;
  /** 카드가 진행 줄 밑으로 내려가는 이벤트(스크롤 없이는 안 보이는 부분이 있는 경우)에서, 앱이 카드를 머리 바로 아래로 맞춰 보였는가 (CM10 revealCard). 그럴 필요가 없으면 true */
  revealed: boolean;
  /** 스크롤로 닿을 수 있는가: 각 선택지를 화면 가운데로 스크롤했을 때 어떤 요소에도 가려지지 않는가 */
  reachable: boolean;
  panelHeight: number;
  lastBottom: number;
  barTop: number;
  headBottom: number;
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
      const title = document.querySelector('[data-testid="choice-title"]')!;
      const choices = [...panel.querySelectorAll('button')];
      const controls = [...document.querySelectorAll('[data-testid="controls"] button')];
      const tools = [...document.querySelectorAll('[data-testid="tools"] button, [data-testid="tools"] a')];
      const bar = document.querySelector('[data-testid="controls"]')!.getBoundingClientRect();
      const head = document.querySelector('[data-testid="dash-head"]')!.getBoundingClientRect();
      const uncovered = (el: Element) => {
        const r = el.getBoundingClientRect();
        const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
        return hit === el || el.contains(hit);
      };
      const inside = (el: Element) => {
        const r = el.getBoundingClientRect();
        return r.left >= 0 && r.right <= vw && r.top >= 0 && r.bottom <= vh;
      };
      const inBand = (el: Element) => {
        const r = el.getBoundingClientRect();
        return r.left >= 0 && r.right <= vw && r.top >= head.bottom - 0.5 && r.bottom <= bar.top + 0.5 && uncovered(el);
      };
      // 1) 카드가 보인 자리(앱이 포커스와 함께 맞춘 스크롤) 그대로 잰다 — 먼저 스크롤을 옮기지 않는다
      const titleVisible = inBand(title);
      const firstChoiceVisible = choices.length > 0 && inBand(choices[0]);
      const allFit = choices.every(inBand);
      const panelRect = panel.getBoundingClientRect();
      // 카드의 문서 기준 아래끝이 진행 줄 위를 넘으면 스크롤 없이는 다 안 보인다 → 앱이 카드 위쪽을 머리 아래로 맞췄어야 한다(머리 아래 + scroll-padding 12px 안쪽)
      const needsReveal = panelRect.bottom + window.scrollY > bar.top + 0.5; // 스크롤 0에서 카드 아래끝(문서 기준)이 고정 진행 줄(뷰포트 기준 위끝) 아래로 내려가는가
      const revealed = !needsReveal || panelRect.top <= head.bottom + 16;
      const lastBottom = Math.max(...choices.map((b) => b.getBoundingClientRect().bottom));
      const panelHeight = panel.getBoundingClientRect().height;
      const controlsOk = controls.length === 7 && controls.every((b) => inside(b) && uncovered(b));
      // 2) 스크롤로 닿는가
      let reachable = true;
      for (const b of choices) {
        b.scrollIntoView({ block: 'center' });
        if (!uncovered(b) || !inside(b)) reachable = false;
      }
      // 3) 도구 줄은 문서 맨 위에서
      window.scrollTo(0, 0);
      const toolsOk = tools.length === 5 && tools.every((b) => b.getBoundingClientRect().left >= 0 && b.getBoundingClientRect().right <= vw && uncovered(b));
      return {
        id,
        nChoices: choices.length,
        overflowX: document.documentElement.scrollWidth > document.documentElement.clientWidth,
        choiceOutside: choices.some((b) => b.getBoundingClientRect().left < 0 || b.getBoundingClientRect().right > vw),
        controlsOk,
        toolsOk,
        titleVisible,
        firstChoiceVisible,
        allFit,
        revealed,
        reachable,
        panelHeight,
        lastBottom,
        barTop: bar.top,
        headBottom: head.bottom,
      };
    };
    const out: Metrics[] = [];
    if (customEvent !== undefined) {
      w.__layout.showCustom(customEvent);
      await frames();
      await frames();
      out.push(measure((customEvent as { id: string }).id));
      return out;
    }
    for (const id of w.__layout.ids) {
      w.__layout.show(id);
      await frames();
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
  test(`${vp.width}x${vp.height}: 풀의 모든 선택지 이벤트 — 카드가 보인 자리에서 제목·첫 선택지가 가려지지 않고, 선택지 전부는 스크롤로 닿으며, 진행 줄 7개·도구 줄 5개가 가려지거나 넘치지 않는다 (R-042)`, async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile-360', '뷰포트를 직접 지정하므로 mobile-360에서만 실행');
    test.setTimeout(120_000);
    await openHarness(page, vp);
    const all = await measureAll(page);
    expect(all.length, '풀의 선택지 이벤트가 충분히 있어야 한다').toBeGreaterThanOrEqual(40);
    const fail = (m: Metrics, why: string) =>
      `${m.id}: ${why} (선택지 ${m.nChoices}개, 패널 높이 ${Math.round(m.panelHeight)}px, 마지막 선택지 아래 ${Math.round(m.lastBottom)}px / 진행 줄 위 ${Math.round(m.barTop)}px, 머리 아래 ${Math.round(m.headBottom)}px)`;
    for (const m of all) {
      expect(m.overflowX, fail(m, '가로로 넘친다')).toBe(false);
      expect(m.choiceOutside, fail(m, '선택지가 화면 밖에 있다')).toBe(false);
      expect(m.controlsOk, fail(m, '진행 줄 7개가 화면 안에서 가려진다')).toBe(true);
      expect(m.toolsOk, fail(m, '도구 줄 5개가 문서 맨 위에서 가려지거나 넘친다')).toBe(true);
      expect(m.titleVisible, fail(m, '카드가 보인 자리에서 선택지 제목이 머리·진행 줄에 가려진다')).toBe(true);
      expect(m.firstChoiceVisible, fail(m, '카드가 보인 자리에서 첫 선택지가 머리·진행 줄에 가려진다')).toBe(true);
      expect(m.revealed, fail(m, '카드가 진행 줄 밑으로 내려가는데 앱이 카드를 머리 아래로 맞춰 보이지 않았다(포커스 스크롤)')).toBe(true);
      expect(m.reachable, fail(m, '스크롤해도 선택지가 가려진다')).toBe(true);
    }
    // 큰 화면(360×740): 선택지 전부가 스크롤 없이 가용 영역에 들어온다
    if (vp.height >= 740) for (const m of all) expect(m.allFit, fail(m, '360×740에서는 선택지 전부가 카드가 보인 자리에 들어와야 한다 — 문구를 줄인다(docs/data/events-schema.md 7절)')).toBe(true);
    // 측정 기록: 선택지 전부가 스크롤 없이 가용 영역에 들어오는 이벤트 수(참고용)
    testInfo.annotations.push({ type: '측정', description: `${vp.width}x${vp.height}: 선택지 전부가 스크롤 없이 보이는 이벤트 ${all.filter((m) => m.allFit).length}/${all.length}개 (가용 영역 = 머리 아래 ${Math.round(all[0].headBottom)}px ~ 진행 줄 위 ${Math.round(all[0].barTop)}px)` });
    // 판별력: 세 선택지를 모두 가진 이벤트가 실제로 있고 그것도 통과했다
    expect(all.some((m) => m.nChoices === 3)).toBe(true);
    expect(all.some((m) => m.nChoices === 2)).toBe(true);
    // 값이 의미 있게 달라지는지(모두 같은 높이면 측정이 헛돈 것): 가장 큰 패널이 가장 작은 패널보다 눈에 띄게 크다
    const heights = all.map((m) => m.panelHeight);
    expect(Math.max(...heights) - Math.min(...heights)).toBeGreaterThan(40);
  });
}

test('권장 최대 길이(제목 16·본문 70·라벨 24자 ×3)로 만든 최악의 이벤트: 어느 화면 높이에서도 제목·첫 선택지가 보이고 선택지 전부가 스크롤로 닿으며, 360×740은 카드가 보인 자리에 다 들어온다 (R-042)', async ({ page }, testInfo) => {
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
    expect(m.toolsOk).toBe(true);
    expect(m.titleVisible, `${vp.height}: 선택지 제목이 가려진다`).toBe(true);
    expect(m.firstChoiceVisible, `${vp.height}: 첫 선택지가 가려진다`).toBe(true);
    expect(m.reachable, `${vp.height}: 스크롤해도 선택지가 가려진다`).toBe(true);
  }
  expect(results['360x740'].allFit, `360×740: 마지막 선택지 아래 ${results['360x740'].lastBottom}px / 진행 줄 위 ${results['360x740'].barTop}px`).toBe(true);
  // 360×568은 최악의 이벤트가 가용 영역을 넘는다(스크롤 필요). 알려진 한계로 기록해 둔다 — 고정 머리(약 95px)와 하단 진행 줄(약 112px)이 가용 높이를 줄인다.
  expect(results['360x568'].allFit).toBe(false);
  testInfo.annotations.push({ type: '측정', description: `최악의 이벤트 allFit: ${Object.entries(results).map(([k, v]) => `${k}=${v.allFit}`).join(', ')}` });
});

test('가장 긴(패널이 가장 높은) 실제 이벤트를 실제 앱에서 열어도 360×568·640에서 선택지 제목·첫 선택지·진행 줄이 가려지지 않고 선택지 3개 모두 스크롤로 닿는다 (R-042)', async ({ page }, testInfo) => {
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
    // 스키마 v8: 20세 이상 인생에는 자산이 있고 집안 살림은 0이다 (M5 2a)
    assets: { net: 5000, income: 4500, debt: 0, incomeAdj: 0, dwelling: 'rent' as const },
    familyFund: 0,
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
    // 앱이 포커스를 선택지 제목에 주며 카드를 보인 뒤의 자리에서 잰다
    await expect(page.getByTestId('choice-title')).toBeFocused();
    const m = await page.evaluate(() => {
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const head = document.querySelector('[data-testid="dash-head"]')!.getBoundingClientRect();
      const bar = document.querySelector('[data-testid="controls"]')!.getBoundingClientRect();
      const rect = (el: Element) => {
        const r = el.getBoundingClientRect();
        const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
        return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, covered: !(hit === el || el.contains(hit)), name: (el.textContent ?? '').trim() };
      };
      const choices = [...document.querySelectorAll('[data-testid="choice-panel"] button')];
      const shown = { title: rect(document.querySelector('[data-testid="choice-title"]')!), first: rect(choices[0]) };
      // 스크롤로 닿는가
      const reached = choices.map((b) => {
        b.scrollIntoView({ block: 'center' });
        const r = rect(b);
        return { ...r, inside: r.left >= 0 && r.right <= vw && r.top >= 0 && r.bottom <= vh };
      });
      return { vw, vh, headBottom: head.bottom, barTop: bar.top, shown, reached, controls: [...document.querySelectorAll('[data-testid="controls"] button')].map(rect) };
    });
    expect(m.reached).toHaveLength(3);
    expect(m.controls).toHaveLength(7);
    for (const b of [m.shown.title, m.shown.first]) {
      expect(b.top, `${tallest.id} @${vp.height}: ${b.name}이(가) 머리에 가려진다`).toBeGreaterThanOrEqual(m.headBottom - 0.5);
      expect(b.bottom, `${tallest.id} @${vp.height}: ${b.name}이(가) 진행 줄 밑으로 밀린다`).toBeLessThanOrEqual(m.barTop + 0.5);
      expect(b.covered).toBe(false);
    }
    for (const b of m.reached) {
      expect(b.left, b.name).toBeGreaterThanOrEqual(0);
      expect(b.right, b.name).toBeLessThanOrEqual(m.vw);
      expect(b.inside, `${tallest.id} @${vp.height}: ${b.name}에 스크롤로 닿지 않는다`).toBe(true);
      expect(b.covered, `${tallest.id} @${vp.height}: ${b.name}이(가) 다른 요소에 가려져 눌리지 않는다`).toBe(false);
    }
    for (const b of m.controls) {
      expect(b.left, b.name).toBeGreaterThanOrEqual(0);
      expect(b.right, b.name).toBeLessThanOrEqual(m.vw);
      expect(b.bottom, b.name).toBeLessThanOrEqual(m.vh);
      expect(b.covered, `${tallest.id} @${vp.height}: ${b.name}이(가) 다른 요소에 가려진다`).toBe(false);
    }
    expect(await noHorizontalOverflow(page)).toBe(true);
    testInfo.annotations.push({ type: '측정', description: `${vp.width}x${vp.height} ${tallest.id}: 카드가 보인 자리 가용 영역 ${Math.round(m.headBottom)}~${Math.round(m.barTop)}px` });
  }
});
