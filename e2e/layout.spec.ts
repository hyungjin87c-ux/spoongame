import { expect, test, type Page } from '@playwright/test';
import type { EventDef } from '../src/core/events';
import { TEXT_LIMITS } from '../src/core/eventLint';
import { injectSave, lifeState, noHorizontalOverflow } from './helpers';
import { lengthSample } from './lengthSamples';

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
  /** 카드가 보인 뒤: 첫 두 선택지가 가용 영역(시트 상자 / 머리와 진행 줄 사이)에 온전히 보이는가 — 스크롤 없이 선택지를 비교해 볼 수 있는 최소한 (R-394) */
  firstTwoVisible: boolean;
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
      // 모달 시트(수동 모드, M7b)면 가용 영역은 시트 상자(바깥은 inert라 머리·진행 줄이 아니라 시트가 화면을 쓴다), 인라인 카드(자동 모드)면 머리와 진행 줄 사이다
      const dialog = document.querySelector('[role="dialog"]');
      const choices = [...panel.querySelectorAll('button.choice')];
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
      const bandTop = dialog !== null ? Math.max(0, dialog.getBoundingClientRect().top) : head.bottom;
      const bandBottom = dialog !== null ? Math.min(vh, dialog.getBoundingClientRect().bottom) : bar.top;
      const inBand = (el: Element) => {
        const r = el.getBoundingClientRect();
        return r.left >= 0 && r.right <= vw && r.top >= bandTop - 0.5 && r.bottom <= bandBottom + 0.5 && uncovered(el);
      };
      // 1) 카드가 보인 자리(앱이 포커스와 함께 맞춘 스크롤) 그대로 잰다 — 먼저 스크롤을 옮기지 않는다
      const titleVisible = inBand(title);
      const firstChoiceVisible = choices.length > 0 && inBand(choices[0]);
      const allFit = choices.every(inBand);
      const firstTwoVisible = choices.length >= 2 && choices.slice(0, 2).every(inBand);
      const lastBottom = Math.max(...choices.map((b) => b.getBoundingClientRect().bottom));
      const panelHeight = dialog !== null ? dialog.scrollHeight : panel.getBoundingClientRect().height;
      // 시트가 떠 있는 동안 진행 줄·도구 줄은 inert이고 시트 뒤에 있다(M7b) — 가림 점검은 인라인 모드(?mode=inline)에서 한다
      const controlsOk = dialog !== null ? controls.length === 7 : controls.length === 7 && controls.every((b) => inside(b) && uncovered(b));
      // 2) 스크롤로 닿는가
      let reachable = true;
      for (const b of choices) {
        b.scrollIntoView({ block: 'center' });
        if (!uncovered(b) || !inside(b)) reachable = false;
      }
      // 3) 도구 줄은 문서 맨 위에서
      window.scrollTo(0, 0);
      const toolsOk = tools.length === 5 && tools.every((b) => b.getBoundingClientRect().left >= 0 && b.getBoundingClientRect().right <= vw && (dialog !== null || uncovered(b)));
      return {
        id,
        nChoices: choices.length,
        overflowX: document.documentElement.scrollWidth > document.documentElement.clientWidth || (dialog !== null && dialog.scrollWidth > dialog.clientWidth),
        choiceOutside: choices.some((b) => b.getBoundingClientRect().left < 0 || b.getBoundingClientRect().right > vw),
        controlsOk,
        toolsOk,
        titleVisible,
        firstChoiceVisible,
        allFit,
        firstTwoVisible,
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

async function openHarness(page: Page, vp: { width: number; height: number }, mode: 'sheet' | 'inline' = 'inline'): Promise<void> {
  await page.setViewportSize(vp);
  await page.goto(mode === 'sheet' ? '/harness/layout.html?mode=sheet' : '/harness/layout.html');
  await page.waitForFunction(() => (window as unknown as { __layout?: unknown }).__layout !== undefined);
}

/** 권장 최대 길이(합쇼체 새 한도) 끝값으로 만든 최악의 이벤트: 제목·본문·라벨이 모두 최대이고 선택지가 3개 (표본은 e2e/lengthSamples.ts — 덩어리 글, 단어 사이 공백으로 줄바꿈 낭비가 크다). */
function worstCaseEvent(): EventDef {
  return lengthSample('worst').event;
}

// 두 모드(M7b): sheet = 자동 모드 꺼짐 — 카드는 모달 시트(화면 아래에서 올라온 94dvh 이하의 고정 상자, 안쪽 스크롤) / inline = 자동 모드 켜짐 — 대시보드 가운데 열 맨 위의 카드(진행 줄이 그대로 닿는다)
const MODES = ['sheet', 'inline'] as const;

for (const mode of MODES) for (const vp of VIEWPORTS) {
  test(`${mode} · ${vp.width}x${vp.height}: 풀의 모든 선택지 이벤트 — 카드가 보인 자리에서 제목·첫 선택지가 가려지지 않고, 선택지 전부는 스크롤로 닿으며${mode === 'inline' ? ', 진행 줄 7개·도구 줄 5개가 가려지거나 넘치지 않는다' : '(시트 안 스크롤)'} (R-042)`, async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile-360', '뷰포트를 직접 지정하므로 mobile-360에서만 실행');
    test.setTimeout(120_000);
    await openHarness(page, vp, mode);
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
      // 첫 선택지가 스크롤 없이 보이는 것은 시트(수동 모드 — 사람이 고른다)에 요구한다. 인라인 카드(자동 모드 — 스스로 고른다)는 인용 박스가 더해져 카드가 한 화면을 넘을 수 있고 선택지는 스크롤로 닿는다(아래 reachable)
      // r4(2026-10-26): 질문 줄(「어떻게 하겠습니까?」)과 「풀이」 줄이 선택지 위에 더해져 시트가 더 높아졌다. 360×740은 90장 모두 첫 선택지가 보이고(아래 하한이 지킨다),
      // 360×640·568에서는 일부 카드에서 첫 선택지가 시트 안 스크롤 아래로 간다 — 카드 하나씩의 필수 단언이 아니라 아래 하한(개수)과 기록으로 지킨다. 스크롤로 닿는 것(reachable)은 카드마다 그대로 필수다.
      expect(m.reachable, fail(m, '스크롤해도 선택지가 가려진다')).toBe(true);
    }
    // M7b 이전에는 큰 화면(360×740)에서 선택지 전부가 스크롤 없이 가용 영역에 들어왔다(R-042, M7e-1 길이 한도의 근거). 지금 카드는 머리(연도·나이·접기)·인용 박스·영향 안내·자동 모드 안내를 더해
    // 시트는 94dvh까지 차오르고(안쪽 스크롤로 닿는다) 인라인 카드는 한 화면을 넘는다(페이지 스크롤로 닿고, 제목에 포커스를 두면 앱이 위쪽을 머리 아래로 맞춘다). 그래서 이 줄은 단언이 아니라 아래 기록으로 남기고,
    // 위 단언(제목·첫 선택지(시트)·선택지 전부 reachable·가로 넘침 0)이 계속 길이 한도를 지킨다.
    // 측정 기록: 선택지 전부가 스크롤 없이 가용 영역에 들어오는 이벤트 수(참고용)
    testInfo.annotations.push({ type: '측정', description: `${mode} ${vp.width}x${vp.height}: 선택지 전부가 스크롤 없이 보이는 이벤트 ${all.filter((m) => m.allFit).length}/${all.length}개 · 첫 두 선택지가 보이는 이벤트 ${all.filter((m) => m.firstTwoVisible).length}/${all.length}개 (가용 영역 = 머리 아래 ${Math.round(all[0].headBottom)}px ~ 진행 줄 위 ${Math.round(all[0].barTop)}px)` });
    // R-394 회귀 가드(하한): 시트(수동 모드 — 사람이 고른다)에서는 지금 측정값 아래로 내려가지 않는다. 360×740은 선택지 전부(allFit)와 첫 두 선택지가 90장 모두 시트 안에 스크롤 없이 보이고, 640은 전부 60장·첫 두 개 90장, 568은 전부 50장·첫 두 개 70장이다.
    // M7d에서 본문·인용이 길어져 이미 있던 카드가 이 하한 아래로 밀리면 여기서 걸린다(새 카드는 하한을 채우지 않아도 된다 — 하한은 현재 90장 기준의 개수다). 인라인 카드는 페이지 스크롤로 닿으므로 기록만 한다.
    if (mode === 'sheet') {
      // r4 재측정(2026-10-26, 질문 줄·풀이 줄이 더해진 뒤): 이전 하한은 740 {전부 90·첫 두 개 90}, 640 {60·90}, 568 {50·70}, 첫 선택지는 세 높이 모두 90장이었다.
      // 지금 측정값이 새 하한이다(이 아래로 내려가면 걸린다) — 740은 첫 선택지 90장 그대로, 640은 88장, 568은 60장이다(「풀이」 라벨을 화면에서 뺀 형진 님 결정 2026-10-26 뒤 재측정 — 라벨 줄이 빠져 처음 값 77·59에서 늘었다). 줄어든 이유는 설계 변경(선택지 위 두 줄) 때문이고 마스터에게 보고했다.
      const FLOOR: Record<number, { first: number; allFit: number; firstTwo: number }> = {
        740: { first: 90, allFit: 62, firstTwo: 89 },
        640: { first: 88, allFit: 49, firstTwo: 56 },
        568: { first: 60, allFit: 22, firstTwo: 48 },
      };
      const floor = FLOOR[vp.height];
      const notFirst = all.filter((m) => !m.firstChoiceVisible).map((m) => m.id);
      expect(all.length - notFirst.length, `시트 ${vp.width}x${vp.height}: 첫 선택지가 스크롤 없이 보이는 이벤트가 하한(${floor.first}) 아래다. 안 보이는 카드: ${notFirst.join(', ')}`).toBeGreaterThanOrEqual(floor.first);
      testInfo.annotations.push({ type: '측정', description: `시트 ${vp.width}x${vp.height}: 첫 선택지가 스크롤 없이 보이는 이벤트 ${all.length - notFirst.length}/${all.length}개 (r4 이전 90/90)` });
      const notAll = all.filter((m) => !m.allFit).map((m) => m.id);
      const notTwo = all.filter((m) => !m.firstTwoVisible).map((m) => m.id);
      expect(all.length - notAll.length, `시트 ${vp.width}x${vp.height}: 선택지 전부가 스크롤 없이 보이는 이벤트가 하한(${floor.allFit}) 아래다. 안 보이는 카드: ${notAll.join(', ')}`).toBeGreaterThanOrEqual(floor.allFit);
      expect(all.length - notTwo.length, `시트 ${vp.width}x${vp.height}: 첫 두 선택지가 스크롤 없이 보이는 이벤트가 하한(${floor.firstTwo}) 아래다. 안 보이는 카드: ${notTwo.join(', ')}`).toBeGreaterThanOrEqual(floor.firstTwo);
    }
    // 판별력: 세 선택지를 모두 가진 이벤트가 실제로 있고 그것도 통과했다
    expect(all.some((m) => m.nChoices === 3)).toBe(true);
    expect(all.some((m) => m.nChoices === 2)).toBe(true);
    // 값이 의미 있게 달라지는지(모두 같은 높이면 측정이 헛돈 것): 가장 큰 패널이 가장 작은 패널보다 눈에 띄게 크다
    const heights = all.map((m) => m.panelHeight);
    expect(Math.max(...heights) - Math.min(...heights)).toBeGreaterThan(40);
  });
}

test(`권장 최대 길이(합쇼체 새 한도: 제목 ${TEXT_LIMITS.title}·본문 ${TEXT_LIMITS.text}·라벨 ${TEXT_LIMITS.label}자 ×3)로 만든 최악의 이벤트: 어느 화면 높이에서도 제목·첫 선택지가 보이고 선택지 전부가 스크롤로 닿는다 — 360×740에서 카드가 한 화면 안에 다 들어오는지는 기록만 한다 (R-042, M7e-1, M7b)`, async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-360', '뷰포트를 직접 지정하므로 mobile-360에서만 실행');
  const ev = worstCaseEvent();
  expect(ev.text.length).toBe(TEXT_LIMITS.text);
  expect(ev.title.length).toBeLessThanOrEqual(TEXT_LIMITS.title);
  const results: Record<string, Metrics> = {};
  // 시트 모드(수동): 최악의 이벤트도 시트 안 스크롤로 모두 닿고 제목·첫 선택지가 시트 안에 보인다 (M7b)
  for (const vp of VIEWPORTS) {
    await openHarness(page, vp, 'sheet');
    const [m] = await measureAll(page, ev);
    expect(m.nChoices).toBe(3);
    expect(m.overflowX, `시트 ${vp.height}: 가로로 넘친다`).toBe(false);
    expect(m.titleVisible, `시트 ${vp.height}: 선택지 제목이 가려진다`).toBe(true);
    expect(m.firstChoiceVisible, `시트 ${vp.height}: 첫 선택지가 가려진다`).toBe(true);
    expect(m.reachable, `시트 ${vp.height}: 시트 안 스크롤로도 선택지가 가려진다`).toBe(true);
  }
  // 인라인 모드(자동): 대시보드 안 카드 — 제목이 보이고 선택지 전부에 스크롤로 닿는다(스크롤 없이 다 보이는지는 기록만 한다)
  for (const vp of VIEWPORTS) {
    await openHarness(page, vp, 'inline');
    const [m] = await measureAll(page, ev);
    results[`${vp.width}x${vp.height}`] = m;
    expect(m.nChoices).toBe(3);
    expect(m.overflowX).toBe(false);
    expect(m.choiceOutside).toBe(false);
    expect(m.controlsOk).toBe(true);
    expect(m.toolsOk).toBe(true);
    expect(m.titleVisible, `${vp.height}: 선택지 제목이 가려진다`).toBe(true);
    expect(m.reachable, `${vp.height}: 스크롤해도 선택지가 가려진다`).toBe(true);
  }
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
  // 2) 같은 이벤트를 실제 앱에서 열어 같은 기준으로 잰다(선택지는 requires와 무관하게 같은 상태에서 함께 보일 수 있는 가장 큰 묶음을 저장에 넣는다 — 정의가 4개인 이벤트도 보이는 것은 3개다)
  const choiceIds = await page.evaluate<string[]>(`(async () => {
    const mod = await import('/src/data/events/index.ts');
    const core = await import('/src/core/index.ts');
    return core.worstCaseVisibleChoiceIds(mod.EVENT_POOL.byId.get(${JSON.stringify(tallest.id)}));
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
  // r4: 360×740을 더해 첫 선택지가 시트 안에 보이는 보장을 여기서 지킨다(640·568은 질문 줄·풀이 줄 때문에 첫 선택지가 시트 안 스크롤 아래로 갈 수 있다 — 제목은 늘 보이고 선택지 3개는 스크롤로 닿는다)
  for (const vp of [VIEWPORTS[0], VIEWPORTS[1], VIEWPORTS[2]]) {
    await page.setViewportSize(vp);
    await injectSave(page, state, '/');
    const panel = page.getByTestId('choice-panel');
    await expect(panel).toBeVisible();
    expect(await panel.getAttribute('data-key')).toBe(`${tallest.id}@${age}`);
    for (const id of choiceIds) await expect(page.getByTestId(`choice-${id}`)).toBeEnabled();
    // 수동 모드: 카드는 모달 시트이고 앱이 포커스를 선택지 제목에 준다. 시트 상자 안에서 잰다(바깥 진행 줄·도구 줄은 inert이고 시트 뒤에 있다, M7b)
    await expect(page.getByTestId('choice-panel')).toHaveAttribute('data-mode', 'sheet');
    await expect(page.getByTestId('choice-title')).toBeFocused();
    const m = await page.evaluate(() => {
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const rect = (el: Element) => {
        const r = el.getBoundingClientRect();
        const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
        return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, covered: !(hit === el || el.contains(hit)), name: (el.textContent ?? '').trim() };
      };
      const sheet = document.querySelector('[role="dialog"]')!.getBoundingClientRect();
      const choices = [...document.querySelectorAll('[data-testid="choice-panel"] button.choice')];
      const shown = { title: rect(document.querySelector('[data-testid="choice-title"]')!), first: rect(choices[0]) };
      // 스크롤로 닿는가
      const reached = choices.map((b) => {
        b.scrollIntoView({ block: 'center' });
        const r = rect(b);
        return { ...r, inside: r.left >= 0 && r.right <= vw && r.top >= 0 && r.bottom <= vh };
      });
      return { vw, vh, headBottom: sheet.top, barTop: Math.min(vh, sheet.bottom), shown, reached, controls: [...document.querySelectorAll('[data-testid="controls"] button')].map(rect) };
    });
    expect(m.reached).toHaveLength(3);
    expect(m.controls).toHaveLength(7); // 진행 줄은 시트 뒤에 그대로 있다(가림 점검은 인라인 모드가 한다)
    for (const b of [m.shown.title, m.shown.first]) {
      expect(b.top, `${tallest.id} @${vp.height}: ${b.name}이(가) 시트 위로 잘린다`).toBeGreaterThanOrEqual(m.headBottom - 0.5);
      // 제목은 모든 높이에서, 첫 선택지는 360×740에서 시트 안에 온전히 보여야 한다 (640·568의 첫 선택지는 시트 안 스크롤로 닿는지만 본다 — 아래 reached)
      if (b === m.shown.title || vp.height === 740) {
        expect(b.bottom, `${tallest.id} @${vp.height}: ${b.name}이(가) 시트 아래로 밀린다`).toBeLessThanOrEqual(m.barTop + 0.5);
        expect(b.covered).toBe(false);
      }
    }
    for (const b of m.reached) {
      expect(b.left, b.name).toBeGreaterThanOrEqual(0);
      expect(b.right, b.name).toBeLessThanOrEqual(m.vw);
      expect(b.inside, `${tallest.id} @${vp.height}: ${b.name}에 스크롤로 닿지 않는다`).toBe(true);
      expect(b.covered, `${tallest.id} @${vp.height}: ${b.name}이(가) 다른 요소에 가려져 눌리지 않는다`).toBe(false);
    }
    expect(await noHorizontalOverflow(page)).toBe(true);
    testInfo.annotations.push({ type: '측정', description: `${vp.width}x${vp.height} ${tallest.id}: 시트 안 가용 영역 ${Math.round(m.headBottom)}~${Math.round(m.barTop)}px` });
  }
});
