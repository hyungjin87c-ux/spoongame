import { expect, test, type Page } from '@playwright/test';
import type { GameState } from '../src/core/types';
import {
  GAME_KEY,
  KNOWN_SEED,
  SAVE_VERSION,
  birthState,
  evalCore,
  findPendingState,
  injectSave,
  lifeState,
  noHorizontalOverflow,
  oracleLife,
  pressBeginToLife,
  readSave,
  rouletteState,
  settle,
} from './helpers';

/**
 * M5 화면 정리 (QA-001-M3 사용감 1·2·3·5·6), R-054(밀린 화면 문구), R-056(비활성 "다음 결정으로"의 사유), A66(빈 저장소에서 두 탭 동시 열기).
 * 시간 실측이 필요한 사용감 4(8배·자동에서 결과 읽을 시간)는 M6 사람 실측 뒤 결정이라 여기서 다루지 않는다.
 */

async function lines(page: Page, selector: string): Promise<Array<{ text: string; lines: string[] }>> {
  return page.evaluate((sel) => {
    return [...document.querySelectorAll(sel)].map((el) => {
      const out: string[] = [];
      let lastTop: number | null = null;
      let pendingSpace = false;
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
        const t = node.textContent ?? '';
        for (let i = 0; i < t.length; i++) {
          if (t[i].trim() === '') {
            pendingSpace = true;
            continue;
          }
          const r = document.createRange();
          r.setStart(node, i);
          r.setEnd(node, i + 1);
          const top = Math.round(r.getBoundingClientRect().top);
          if (lastTop === null || Math.abs(top - lastTop) > 4) {
            out.push('');
          } else if (pendingSpace) {
            out[out.length - 1] += ' ';
          }
          pendingSpace = false;
          lastTop = top;
          out[out.length - 1] += t[i];
        }
      }
      return { text: (el.textContent ?? '').replace(/\s+/g, ' ').trim(), lines: out };
    });
  }, selector);
}

// ---------- 사용감 2: 제목 포커스 링 ----------

test('프로그램이 제목으로 옮긴 포커스에는 링이 없고, 키보드로 닿은 버튼의 포커스 링은 그대로다 (QA 사용감 2)', async ({ page }) => {
  await page.goto('/');
  await expect.poll(() => page.evaluate(() => document.activeElement?.tagName)).toBe('H1'); // 화면이 뜨면 제목으로 포커스가 간다
  await page.keyboard.press('Tab'); // 키보드 사용 시작(:focus-visible 모드): 제목 다음은 눌려 있는 세대 줄(라디오)
  await expect(page.getByTestId('gen-random')).toBeFocused();
  // 라디오 입력은 보이지 않고 줄(label.gen-row)이 :focus-within 링을 그린다
  const cardRing = await page.evaluate(() => {
    const cs = getComputedStyle(document.activeElement!.closest('.gen-row')!);
    return { outlineStyle: cs.outlineStyle, outlineWidth: cs.outlineWidth };
  });
  expect(cardRing.outlineStyle).toBe('solid');
  expect(parseFloat(cardRing.outlineWidth)).toBeGreaterThanOrEqual(2);
  // 하단 「태어나기」까지 Tab으로 간다(캐러셀의 점·버튼을 지나서)
  for (let i = 0; i < 40 && (await page.evaluate(() => document.activeElement?.getAttribute('data-testid'))) !== 'start-birth'; i++) await page.keyboard.press('Tab');
  const start = page.getByTestId('start-birth');
  await expect(start).toBeFocused();
  const ring = (selector: string) =>
    page.evaluate((sel) => {
      const el = document.querySelector(sel) as HTMLElement;
      const cs = getComputedStyle(el);
      return { tag: el.tagName, focused: document.activeElement === el, outlineStyle: cs.outlineStyle, outlineWidth: cs.outlineWidth };
    }, selector);
  const btn = await ring('[data-testid="start-birth"]');
  expect(btn.outlineStyle).toBe('solid');
  expect(parseFloat(btn.outlineWidth)).toBeGreaterThanOrEqual(2);
  await expect(start).toBeEnabled();
  await page.keyboard.press('Enter'); // 룰렛 화면: 프로그램이 제목으로 포커스를 옮긴다
  await expect(page.getByTestId('roulette-screen')).toBeVisible();
  await expect.poll(() => page.evaluate(() => document.activeElement?.tagName)).toBe('H1');
  const rouletteH1 = await ring('h1');
  expect(rouletteH1.focused).toBe(true);
  expect(rouletteH1.outlineStyle, '룰렛 제목 포커스 링').toBe('none');
  // 키보드로 닿은 다음 컨트롤(건너뛰기 버튼)에는 링이 있다
  await page.keyboard.press('Tab');
  const skipRing = await ring('[data-testid="skip-roulette"]');
  expect(skipRing.focused).toBe(true);
  expect(skipRing.outlineStyle).toBe('solid');
  expect(parseFloat(skipRing.outlineWidth)).toBeGreaterThanOrEqual(2);
  await expect(page.getByTestId('skip-roulette')).toBeEnabled();
  await page.keyboard.press('Enter'); // 건너뛰기 → 같은 버튼 요소가 「출생신고 보기」가 된다(포커스 유지)
  await expect(page.getByTestId('to-birth')).toBeFocused();
  await expect(page.getByTestId('to-birth')).toBeEnabled();
  await page.keyboard.press('Enter'); // 출생신고 화면: 프로그램이 제목으로 포커스를 옮긴다
  await expect(page.getByTestId('birth-screen')).toBeVisible();
  await expect.poll(() => page.evaluate(() => document.activeElement?.tagName)).toBe('H1');
  const h1 = await ring('h1');
  expect(h1.focused).toBe(true);
  expect(h1.outlineStyle, '제목 포커스 링').toBe('none');
  // 키보드로 닿은 다음 컨트롤(살아가기 버튼)에는 링이 있다
  await page.keyboard.press('Tab');
  const next = await page.evaluate(() => {
    const el = document.activeElement as HTMLElement;
    const cs = getComputedStyle(el);
    return { tag: el.tagName, id: el.dataset.testid, outlineStyle: cs.outlineStyle, outlineWidth: cs.outlineWidth };
  });
  expect(next.tag).toBe('BUTTON');
  expect(next.id).toBe('next-life');
  expect(next.outlineStyle).toBe('solid');
  expect(parseFloat(next.outlineWidth)).toBeGreaterThanOrEqual(2);
});

// ---------- 사용감 3: 줄바꿈 ----------

test('한국어는 단어 중간에서 끊기지 않는다: word-break keep-all, 첫 화면·룰렛·출생신고 화면의 제목·문장이 띄어쓰기에서만 줄을 바꾼다 (360px, QA 사용감 3)', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await page.goto('/');
  await expect(page.getByTestId('title-screen')).toBeVisible();
  const check = async (selector: string) => {
    const groups = await lines(page, selector);
    expect(groups.length, selector).toBeGreaterThan(0);
    for (const g of groups) {
      // 줄을 이어 붙였을 때 원문과 같아야 한다 = 줄이 바뀐 자리마다 원문에 공백이 있다 (단어가 쪼개지지 않았다)
      expect(g.lines.join(' '), `단어 중간에서 끊김: ${g.lines.join(' / ')}`).toBe(g.text);
      if (g.lines.length > 1) for (const l of g.lines) expect(l.length, `한 글자 줄: ${g.lines.join(' / ')}`).toBeGreaterThan(1);
    }
  };
  await check('.hero__tag');
  await check('.hero__span');
  await check('.gen-row__name, .gen-row__desc, .gen-row__meta');
  await check('.slide.is-active .gen-chart__bigsub, .slide.is-active .slide__meta'); // 첫 장(세대 그래프)의 작은 글: 값 설명 줄·출처 줄
  expect(await page.evaluate(() => getComputedStyle(document.body).wordBreak)).toBe('keep-all');
  expect(await page.evaluate(() => getComputedStyle(document.querySelector('.title-page')!).wordBreak)).toBe('keep-all');
  // 룰렛(결과 상태)과 출생신고 화면 (M3: 새 디자인 — 제목·상태 줄·서술문·안내 글)
  await injectSave(page, rouletteState(KNOWN_SEED, 'alpha', 3, 50), '/');
  await expect(page.getByTestId('roulette-screen')).toBeVisible();
  await check('h1');
  // SPEC-004 GS6·17-11-6: 결과 줄은 시도(블록)와 수저 칩(구간 포함)이 다른 줄에 놓이는 두 덩이라 한 문단으로 합쳐 재지 않고 따로 잰다
  await check('.roulette__gen, .roulette__place');
  await check('.roulette__after');
  expect(await noHorizontalOverflow(page)).toBe(true);
  await injectSave(page, birthState(KNOWN_SEED, 'alpha', 3, 50), '/');
  await expect(page.getByTestId('birth-screen')).toBeVisible();
  await check('h1');
  await check('.doc__sentence');
  await check('.card__note');
  expect(await noHorizontalOverflow(page)).toBe(true);
});

/**
 * `lines`와 같은 줄 나누기인데 **눈에 보이는 글자만** 센다 — 두 줄로 나뉜 짧은 쌍에서 `display: none`인 「· 」 조각은 건너뛰고(상자가 없다), 글자 원문도 보이는 글자로 만든다.
 * 줄바꿈이 띄어쓰기에서만 일어났다면 `lines.join(' ')`이 `text`와 같다. 낱말 중간에서 끊겼다면 줄 사이에 원문에 없던 공백이 끼어 달라진다.
 */
async function visibleLines(page: Page, selector: string): Promise<Array<{ text: string; lines: string[] }>> {
  return page.evaluate((sel) => {
    return [...document.querySelectorAll(sel)].map((el) => {
      const out: string[] = [];
      let visible = '';
      let lastTop: number | null = null;
      let pendingSpace = false;
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
        const parent = node.parentElement;
        if (parent === null || parent.getClientRects().length === 0) continue; // display: none 안의 글자
        const t = node.textContent ?? '';
        for (let i = 0; i < t.length; i++) {
          visible += t[i];
          if (t[i].trim() === '') {
            pendingSpace = true;
            continue;
          }
          const r = document.createRange();
          r.setStart(node, i);
          r.setEnd(node, i + 1);
          const top = Math.round(r.getBoundingClientRect().top);
          if (lastTop === null || Math.abs(top - lastTop) > 4) out.push('');
          else if (pendingSpace) out[out.length - 1] += ' ';
          pendingSpace = false;
          lastTop = top;
          out[out.length - 1] += t[i];
        }
      }
      return { text: visible.replace(/\s+/g, ' ').trim(), lines: out };
    });
  }, selector);
}

for (const width of [320, 360] as const) {
  test(`한국어는 단어 중간에서 끊기지 않는다 — 캐러셀 21장의 모든 글자 블록 (${width}px, 글자 100%, REV-003-M2-4 R-244: 혼인 건수 정의의 「(신고월 기준) / 으로」)`, async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile-360', '뷰포트를 직접 지정하므로 mobile-360에서만 실행');
    test.setTimeout(120_000);
    await page.setViewportSize({ width, height: 740 });
    await page.goto('/');
    await expect(page.getByTestId('start-birth')).toBeEnabled();
    await page.getByTestId('carousel-pause').click();
    const slides = await page.locator('.slide').count();
    expect(slides, "첫 장 세대 그래프 + 지표 20장").toBe(21);
    // 값 줄(큰 숫자 + 작은 단위)은 글자 크기가 달라 줄 나누기 기준이 맞지 않으므로 뺀다 — 값 줄은 nowrap이라 갈라질 수 없다
    const BLOCKS = '.slide.is-active h3, .slide.is-active .slide__caption, .slide.is-active .slide__side, .slide.is-active .slide__basis, .slide.is-active .legend li, .slide.is-active .slide__meta, .slide.is-active p.t-muted, .slide.is-active .slide__help p';
    const problems: string[] = [];
    let blocks = 0;
    let multiLine = 0;
    let marriageDefinition = '';
    for (let i = 0; i < slides; i++) {
      const id = await page.evaluate(() => document.querySelector('.slide.is-active')!.getAttribute('data-slide-id')!);
      for (const g of await visibleLines(page, BLOCKS)) {
        blocks++;
        if (g.lines.length > 1) multiLine++;
        if (id === 'marriage-count' && g.text.startsWith('혼인 건수는')) marriageDefinition = g.lines.join(' / ');
        // 줄을 이어 붙였을 때 원문과 같아야 한다 = 줄이 바뀐 자리마다 원문에 공백이 있다 (낱말이 쪼개지지 않았다)
        if (g.lines.join(' ') !== g.text) problems.push(`${width}px ${id}: 단어 중간에서 끊김 — ${g.lines.join(' / ')}`);
      }
      if (i < slides - 1) await page.getByTestId('carousel-next').click();
    }
    expect(problems).toEqual([]);
    // 공허 통과 방지: 21장 × 블록 여러 개를 실제로 봤고, 여러 줄로 나뉜 블록도 많이 봤다. 혼인 건수 정의는 여러 줄이다
    expect(blocks, '검사한 글자 블록 수').toBeGreaterThan(70);
    expect(multiLine, '여러 줄로 나뉜 블록 수').toBeGreaterThan(20);
    expect(marriageDefinition, '혼인 건수 정의가 여러 줄로 나뉘었다').toContain(' / ');
    testInfo.annotations.push({ type: 'marriage-definition', description: `${width}px: ${marriageDefinition}` });
  });
}

test('긴 단어(공백 없는 긴 글)는 keep-all이어도 넘치지 않고 줄바꿈된다 (overflow-wrap)', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await page.goto('/');
  const state: GameState = { ...lifeState(KNOWN_SEED), phase: 'ending', age: 3, death: { age: 3, cause: '병' }, history: [{ age: 0, kind: 'stage', text: `${'가'.repeat(180)}` }, { age: 3, kind: 'death', text: '세상을 떠났다. 원인: 병.' }] };
  await injectSave(page, state, '/');
  await expect(page.getByTestId('ending-screen')).toBeVisible();
  expect(await noHorizontalOverflow(page)).toBe(true);
});

// ---------- 사용감 1·6: 낮은 화면, 저장 실패 안내 ----------

// 바뀐 기준(M4): 예전에는 컨트롤 바 높이 상한을 뷰포트마다 정했다(100px·60px, 예전 117px). 대시보드의 진행 줄은 디자인 시스템 11절의 하단 고정 띠(두 줄, 약 112px)이고, 규칙은 높이가 아니라
// 「작은 뷰포트 높이의 절반 이하일 때만 고정, 넘으면 문서 흐름 끝으로 풀린다」(QM2-12)이다 — 두 뷰포트 모두 절반(240px·187px) 이하라 고정이고, 풀리는 경우는 e2e/m4-fixed-elements.spec.ts가 글자 확대로 본다.
const LOW = [
  { width: 360, height: 480, label: '낮은 폰 세로' },
  { width: 667, height: 375, label: '가로 모드' },
] as const;

for (const vp of LOW) {
  test(`${vp.width}x${vp.height} (${vp.label}): 진행 줄이 작은 뷰포트 높이의 절반 이하로 화면 아래에 고정되고, 선택지와 컨트롤의 모든 버튼에 스크롤로 닿으며 서로 가려지지 않는다 (QA 사용감 1, M4 기준)`, async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile-360', '뷰포트를 직접 지정하므로 mobile-360에서만 실행');
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await page.goto('/');
    const decision = await findPendingState(page, 'alpha', { minChoices: 3 });
    await injectSave(page, decision, '/');
    await expect(page.getByTestId('choice-panel')).toBeVisible();
    await expect(page.getByTestId('auto')).toBeEnabled();
    const controls = (await page.getByTestId('controls').boundingBox())!;
    expect(controls.height, '진행 줄 높이 ≤ 작은 뷰포트 높이의 절반(QM2-12)').toBeLessThanOrEqual(vp.height / 2);
    expect(controls.y + controls.height).toBeLessThanOrEqual(vp.height + 1); // 화면 아래에 붙어 있다
    expect(await page.getByTestId('controls').evaluate((el) => getComputedStyle(el).position), '절반 이하라 고정').toBe('fixed');
    expect(await noHorizontalOverflow(page)).toBe(true);
    // 컨트롤 버튼은 한 줄(가로)이거나 두 줄이어도 서로 겹치지 않고 글이 잘리지 않는다
    const buttons = await page.evaluate(() => [...document.querySelectorAll<HTMLElement>('[data-testid="controls"] button')].map((b) => ({ text: b.textContent, w: b.scrollWidth - b.clientWidth, h: b.scrollHeight - b.clientHeight, r: b.getBoundingClientRect().toJSON() })));
    expect(buttons).toHaveLength(7); // 일시정지·1·2·4·8배·다음 결정으로·자동 모드
    for (const b of buttons) {
      expect(b.w, `${b.text}: 글이 옆으로 잘림`).toBeLessThanOrEqual(1);
      expect(b.h, `${b.text}: 글이 위아래로 잘림`).toBeLessThanOrEqual(1);
    }
    for (let i = 0; i < buttons.length; i++) {
      for (let j = i + 1; j < buttons.length; j++) {
        const a = buttons[i].r;
        const c = buttons[j].r;
        const overlap = Math.min(a.right, c.right) - Math.max(a.left, c.left) > 1 && Math.min(a.bottom, c.bottom) - Math.max(a.top, c.top) > 1;
        expect(overlap, `${buttons[i].text}와 ${buttons[j].text}가 겹침`).toBe(false);
      }
    }
    // 선택지 버튼 모두: 가운데로 스크롤하면 그 버튼이 맨 위에 보인다(컨트롤 바에 가려지지 않는다)
    for (const id of decision.pending!.choiceIds) {
      const hit = await page.evaluate((testId) => {
        const el = document.querySelector(`[data-testid="${testId}"]`) as HTMLElement;
        el.scrollIntoView({ block: 'center' });
        const r = el.getBoundingClientRect();
        const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
        return { covered: top === null || !(top === el || el.contains(top)), visibleTop: r.top, visibleBottom: r.bottom };
      }, `choice-${id}`);
      expect(hit.covered, `선택지 ${id}가 가려짐`).toBe(false);
      expect(hit.visibleTop).toBeGreaterThanOrEqual(0);
      expect(hit.visibleBottom).toBeLessThanOrEqual(vp.height);
    }
    // 맨 아래까지 내리면 마지막 카드(같은 해 태어난 사람들)가 진행 줄 위에 온전히 보인다(본문 끝 여백이 줄 높이를 담는다). 예전에는 스탯 영역이 마지막이었다.
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await settle(page);
    const tail = await page.evaluate(() => ({ last: document.querySelector('[data-testid="peers-now-card"]')!.getBoundingClientRect().bottom, controls: document.querySelector('[data-testid="controls"]')!.getBoundingClientRect().top }));
    expect(tail.last).toBeLessThanOrEqual(tail.controls + 1);
  });
}

test('데스크톱(1280x800): 선택지가 떠도 상태 4개(건강·행복·지식·관계)와 선택지 카드가 접힘 아래로 밀려나지 않고 진행 줄·머리에 가려지지 않는다 (QA 사용감 1, M4 3열)', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', '기본 뷰포트(1280x800)를 쓰므로 desktop에서만 실행');
  await page.goto('/');
  const decision = await findPendingState(page, 'alpha', { minChoices: 3 });
  // 연표가 길게 쌓인 인생(사건 기록 6줄 가득)에서 선택지가 뜬 상태
  const s = await evalCore<GameState>(
    page,
    `let st = arg;
     for (let i = 0; i < 40 && !(st.phase === 'life' && st.pending && st.history.length >= 9 && st.pending.choiceIds.length >= 2); i++) {
       if (st.pending) st = core.resolveChoice(st, st.pending.key, st.pending.choiceIds[0]);
       st = core.advanceUntilDecision(st).state;
       if (st.phase !== 'life') break;
     }
     return st;`,
    decision,
  );
  expect(s.phase).toBe('life');
  expect(s.history.length).toBeGreaterThanOrEqual(9);
  await injectSave(page, s, '/');
  await expect(page.getByTestId('choice-panel')).toBeVisible();
  await expect(page.getByTestId('auto')).toBeEnabled();
  // 바뀐 기대(M4): 데스크톱(폭 ≥ 960)은 3열이고 진행 줄이 머리 아래 위쪽에 놓인다(하단 고정이 아니다). 왼쪽 열의 상태 카드(4개)와 가운데의 선택지 카드가 1280×800 첫 화면에 들어온다.
  const rects = await page.evaluate(() => ({
    vh: innerHeight,
    headBottom: document.querySelector('[data-testid="dash-head"]')!.getBoundingClientRect().bottom,
    controlsPosition: getComputedStyle(document.querySelector('[data-testid="controls"]')!).position,
    meters: [...document.querySelectorAll('[data-testid="stats"] .meter')].map((e) => ({ top: e.getBoundingClientRect().top, bottom: e.getBoundingClientRect().bottom })),
    panel: document.querySelector('[data-testid="choice-panel"]')!.getBoundingClientRect().toJSON(),
  }));
  expect(rects.meters).toHaveLength(4);
  for (const m of rects.meters) {
    expect(m.bottom, '상태 막대가 접힘 아래로 밀림').toBeLessThanOrEqual(rects.vh);
    expect(m.top, '상태 막대가 머리에 가려짐').toBeGreaterThanOrEqual(rects.headBottom);
  }
  expect(rects.panel.bottom, '선택지 카드가 접힘 아래로 밀림').toBeLessThanOrEqual(rects.vh);
  expect(rects.controlsPosition, '데스크톱 진행 줄은 고정이 아니다').toBe('static');
  const bar = (await page.getByTestId('controls').boundingBox())!;
  expect(bar.height, '데스크톱 진행 줄은 한 줄').toBeLessThanOrEqual(70);
});

for (const vp of [
  { width: 360, height: 740 },
  { width: 360, height: 568 },
] as const) {
  test(`${vp.width}x${vp.height}: 저장 실패 안내 바는 따라다니지 않고 첫 화면의 하단 고정 「태어나기」와 겹치지 않는다 (QA 사용감 6)`, async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile-360', '뷰포트를 직접 지정하므로 mobile-360에서만 실행');
    await page.setViewportSize(vp);
    await page.goto('/?__quota=1'); // 저장이 항상 실패하는 저장소(개발 서버 전용 탐침)
    await expect(page.getByTestId('save-notice')).toBeVisible();
    await expect(page.getByTestId('title-screen')).toBeVisible();
    const m = await page.evaluate(() => ({
      vh: innerHeight,
      notice: document.querySelector('[data-testid="save-notice"]')!.getBoundingClientRect().toJSON(),
      noticePosition: getComputedStyle(document.querySelector('[data-testid="save-notice"]')!).position,
      bar: document.querySelector('[data-testid="bottom-bar"]')!.getBoundingClientRect().toJSON(),
      barPosition: getComputedStyle(document.querySelector('[data-testid="bottom-bar"]')!).position,
    }));
    expect(m.noticePosition, '안내 바가 화면에 고정(sticky/fixed)되지 않는다').toBe('static');
    expect(m.notice.height).toBeLessThanOrEqual(64);
    expect(m.barPosition, '태어나기 띠는 화면에 고정된다(FS6)').toBe('fixed');
    expect(m.bar.bottom, '태어나기 띠가 화면 안에 있다').toBeLessThanOrEqual(m.vh + 0.5);
    expect(m.notice.bottom, '안내 바가 위, 태어나기 띠가 아래라 서로 겹치지 않는다').toBeLessThanOrEqual(m.bar.top);
    expect(await noHorizontalOverflow(page)).toBe(true);
  });
}

test('저장 실패 안내는 인생 화면에서도 화면 위에 고정되지 않아 낮은 화면을 계속 가리지 않는다 (QA 사용감 1)', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-360', '뷰포트를 직접 지정하므로 mobile-360에서만 실행');
  await page.setViewportSize({ width: 667, height: 375 });
  await page.goto('/?__quota=1');
  await expect(page.getByTestId('save-notice')).toBeVisible();
  await pressBeginToLife(page); // 첫 화면 → 룰렛 → 출생신고 → 인생
  await expect(page.getByTestId('save-notice')).toBeVisible();
  const position = await page.evaluate(() => getComputedStyle(document.querySelector('[data-testid="save-notice"]')!).position);
  expect(position, '안내 바가 화면 위에 고정(sticky/fixed)되지 않는다').toBe('static');
  // 컨트롤 바는 여전히 화면 아래에 붙어 있고 가로 넘침이 없다
  const bar = (await page.getByTestId('controls').boundingBox())!;
  expect(bar.y + bar.height).toBeLessThanOrEqual(375 + 1);
  expect(await noHorizontalOverflow(page)).toBe(true);
});

// ---------- 사용감 5: 강제 색상(고대비) ----------

test('강제 색상 모드: 눌린 속도·자동 상태가 눌리지 않은 것과 구분되고, 스탯 막대가 사라지지 않는다 (QA 사용감 5)', async ({ page }) => {
  await page.emulateMedia({ forcedColors: 'active' });
  expect(await page.evaluate(() => matchMedia('(forced-colors: active)').matches), '강제 색상 모드가 켜졌다').toBe(true);
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
  expect(pressed.borderStyle, '눌린 버튼은 이중 테두리').toBe('double');
  expect(plain.borderStyle).toBe('solid');
  expect(pressed.bg, '눌린 버튼은 배경 색도 다르다').not.toBe(plain.bg);
  const autoOn = await style('[data-testid="auto"]');
  expect(autoOn.borderStyle).toBe('double');
  // 상태 막대(M4: .meter__track / .meter__fill, 예전 .bar / .bar-fill): 채움이 바탕과 구분된다
  const bar = await page.evaluate(() => {
    const track = document.querySelector('.meter__track') as HTMLElement;
    const fill = document.querySelector('.meter__fill') as HTMLElement;
    return { track: getComputedStyle(track).backgroundColor, fill: getComputedStyle(fill).backgroundColor, fillWidth: fill.getBoundingClientRect().width, trackBorder: getComputedStyle(track).borderTopStyle };
  });
  expect(bar.fill, '막대 채움이 바탕과 같은 색(사라짐)').not.toBe(bar.track);
  expect(bar.fillWidth).toBeGreaterThan(0);
  expect(bar.trackBorder).toBe('solid');
});

test('강제 색상 모드: 첫 화면의 세대 줄 선택 상태도 구분된다 (고른 줄은 Highlight 바탕 + 체크 표식 + 3px 막대, 나머지는 아니다)', async ({ page }) => {
  await page.emulateMedia({ forcedColors: 'active' });
  await page.goto('/');
  await expect(page.getByTestId('title-screen')).toBeVisible();
  const look = (id: string) =>
    page.evaluate((e) => {
      const row = document.querySelector(`[data-testid="gen-row-${e}"]`)!;
      return { bg: getComputedStyle(row).backgroundColor, mark: getComputedStyle(row.querySelector('.gen-row__mark .icon')!).opacity, bar: getComputedStyle(row, '::before').width };
    }, id);
  const selected = await look('random');
  const plain = await look('genx');
  expect(selected.bg).not.toBe(plain.bg);
  expect([selected.mark, plain.mark]).toEqual(['1', '0']);
  expect(selected.bar).toBe('3px');
});

// ---------- R-056: 비활성 "다음 결정으로"의 사유 ----------

test('비활성 "다음 결정으로"는 왜 눌리지 않는지를 보조기기에 알린다: 선택지 대기 중 / 자동 모드 (R-056)', async ({ page }) => {
  await page.goto('/');
  const decision = await findPendingState(page, 'alpha');
  const skip = page.getByTestId('skip');
  // 수동 모드 + 선택지 대기 중
  await injectSave(page, decision, '/', { speed: 1, autoMode: false });
  await expect(page.getByTestId('choice-panel')).toBeVisible();
  await expect(skip).toHaveAttribute('aria-disabled', 'true');
  await expect(skip).toHaveAccessibleDescription('선택지가 나와 있어 먼저 하나를 골라야 합니다.');
  // R-090: 사유 요소는 화면에도, 접근성 트리의 둘러보기 내용에도 없다(hidden). 그래도 aria-describedby 설명으로는 계산된다(바로 위 단언).
  const reason = page.getByTestId('skip-reason');
  await expect(reason).toHaveAttribute('hidden', '');
  await expect(reason).not.toHaveClass(/sr-only/);
  expect(await reason.evaluate((el) => getComputedStyle(el).display)).toBe('none');
  await expect(reason).toBeHidden();
  // 자동 모드
  await injectSave(page, decision, '/?__timescale=0.01', { speed: 1, autoMode: true });
  await expect(page.getByTestId('choice-panel')).toBeVisible();
  await expect(skip).toHaveAttribute('aria-disabled', 'true');
  await expect(skip).toHaveAccessibleDescription('자동 모드에서는 선택지를 스스로 고르므로 누를 수 없습니다.');
  await expect(page.getByTestId('skip-reason')).toBeHidden();
  // 눌 수 있을 때(수동·선택지 없음)에는 설명이 없다
  const start = await oracleLife(page, decision.seed, 'alpha');
  await injectSave(page, start, '/?__timescale=0.01', { speed: 1, autoMode: false });
  await expect(page.getByTestId('life-screen')).toBeVisible();
  await expect(page.getByTestId('choice-panel')).toHaveCount(0);
  await expect(skip).toHaveAccessibleDescription('');
  await expect(page.getByTestId('skip-reason')).toHaveCount(0);
});

// ---------- R-054: 밀린 화면의 문구 ----------

test('밀린 화면: 어디서 바뀌었는지 단정하지 않고(다른 탭·같은 탭의 직접 변경 모두), 이어받을 저장이 없으면 새 게임이 시작된다고 버튼 옆에 알린다 (R-054)', async ({ page }) => {
  await page.goto('/');
  const decision = await findPendingState(page, 'alpha');
  await injectSave(page, decision, '/?__timescale=0.01');
  await expect(page.getByTestId('choice-panel')).toBeVisible();
  // 같은 탭에서 저장을 직접 지운 뒤 앱이 알게 되는 경우(개발자 도구)를 storage 이벤트로 흉내 낸다
  await page.evaluate((k) => {
    localStorage.removeItem(k);
    window.dispatchEvent(new StorageEvent('storage', { key: k }));
  }, GAME_KEY);
  await expect(page.getByTestId('superseded-screen')).toBeVisible();
  await expect(page.getByTestId('superseded-text')).toHaveText('저장된 게임이 이 화면 밖에서 바뀌었습니다.');
  const screen = await page.getByTestId('superseded-screen').innerText();
  expect(screen).not.toContain('다른 탭에서 저장된 게임이 바뀌었습니다');
  expect(screen).toContain('저장이 직접 지워지거나 바뀌었을 수 있습니다');
  await expect(page.getByTestId('take-over-note')).toHaveText('저장된 게임이 없거나 읽을 수 없으면 새 게임이 시작됩니다.');
  // 버튼 바로 곁에 있다 (같은 영역: 세로 간격이 작다)
  const gap = await page.evaluate(() => {
    const b = document.querySelector('[data-testid="take-over"]')!.getBoundingClientRect();
    const n = document.querySelector('[data-testid="take-over-note"]')!.getBoundingClientRect();
    return n.top - b.bottom;
  });
  expect(gap).toBeLessThan(40);
  // 저장이 없는데 이어하기를 누르면 새 게임(타이틀)이다 — 안내한 그대로
  await expect(page.getByTestId('take-over')).toBeEnabled();
  await page.getByTestId('take-over').click();
  await expect(page.getByTestId('title-screen')).toBeVisible();
  expect(await noHorizontalOverflow(page)).toBe(true);
});

// ---------- A66: 빈 저장소에서 두 탭 동시에 열기 ----------

test('A66: 빈 저장소에서 두 탭을 동시에 열어도 둘 다 타이틀이다(밀린 화면 없음). 한 탭이 진행하면 그때 다른 탭이 밀리고 이어하기 한 번으로 이어받는다', async ({ browser }) => {
  for (let round = 0; round < 3; round++) {
    const context = await browser.newContext();
    const a = await context.newPage();
    const b = await context.newPage();
    await Promise.all([a.goto('/'), b.goto('/')]);
    await expect(a.getByTestId('title-screen')).toBeVisible();
    await expect(b.getByTestId('title-screen')).toBeVisible();
    await a.waitForTimeout(300);
    await expect(a.getByTestId('superseded-screen')).toHaveCount(0);
    await expect(b.getByTestId('superseded-screen')).toHaveCount(0);
    // A가 진행하면(태어나기) 저장에 진행이 생기고, 아직 타이틀인 B는 그 진행에 밀린다 (진행이 있는 쪽의 충돌 감지는 그대로)
    const startA = a.getByTestId('start-birth');
    await expect(startA).toBeEnabled();
    await startA.click();
    await expect(a.getByTestId('roulette-screen')).toBeVisible();
    await expect(b.getByTestId('superseded-screen')).toBeVisible();
    await expect.poll(async () => (await readSave(a)).data.phase).toBe('roulette');
    // B의 이어하기 한 번으로 A의 진행(출생 결과가 정해진 룰렛 단계)을 이어받는다
    await expect(b.getByTestId('take-over')).toBeEnabled();
    await b.getByTestId('take-over').click();
    await expect(b.getByTestId('roulette-screen')).toBeVisible();
    await expect(a.getByTestId('roulette-screen')).toBeVisible();
    await expect(a.getByTestId('superseded-screen')).toHaveCount(0);
    await context.close();
  }
});

test('A66 (결정적): 앱이 빈 저장소를 읽은 직후 다른 탭이 "진행 없는 타이틀"을 쓰면 밀리지 않고 자기 타이틀을 저장한다. 다른 탭이 진행(출생)을 썼다면 전처럼 밀린다', async ({ page, browser }) => {
  await page.goto('/');
  const titleRaw = JSON.stringify({ version: SAVE_VERSION, data: await evalCore<GameState>(page, 'return core.createInitialState(7);') });
  const progressRaw = JSON.stringify({ version: SAVE_VERSION, data: birthState(8, 'alpha', 3, 50) });

  for (const [label, raw, superseded] of [
    ['다른 탭이 타이틀을 썼다', titleRaw, false],
    ['다른 탭이 출생까지 진행했다', progressRaw, true],
  ] as const) {
    const context = await browser.newContext();
    const page2 = await context.newPage();
    // 앱이 저장소를 읽은 뒤 storage 리스너를 붙이는 순간에 "다른 탭"이 저장을 쓴 것처럼 한다 (e2e/robust.spec.ts R-052와 같은 결정적 방법)
    await page2.addInitScript(
      ({ key, value }) => {
        const w = window as unknown as { __wrote: boolean };
        w.__wrote = false;
        const original = window.addEventListener.bind(window) as (type: string, listener: unknown, options?: unknown) => void;
        (window as unknown as { addEventListener: typeof original }).addEventListener = (type, listener, options) => {
          if (type === 'storage' && !w.__wrote) {
            w.__wrote = true;
            window.localStorage.setItem(key, value);
          }
          original(type, listener, options);
        };
      },
      { key: GAME_KEY, value: raw },
    );
    await page2.goto('/');
    await settle(page2);
    expect(await page2.evaluate(() => (window as unknown as { __wrote: boolean }).__wrote), `${label}: 흉내 냄`).toBe(true);
    if (superseded) {
      await expect(page2.getByTestId('superseded-screen'), label).toBeVisible();
      expect(await page2.evaluate((k) => localStorage.getItem(k), GAME_KEY), `${label}: 다른 탭의 진행이 보존된다`).toBe(raw);
    } else {
      await expect(page2.getByTestId('title-screen'), label).toBeVisible();
      await expect(page2.getByTestId('superseded-screen'), label).toHaveCount(0);
      const saved = (await readSave(page2)).data;
      expect(saved.phase).toBe('title');
      expect(saved.seed, '이 탭의 새 게임이 저장됐다(다른 탭의 타이틀을 대체)').not.toBe(7);
      // 이 탭이 진행해도 문제없다
      await page2.getByTestId('start-birth').click();
      await expect(page2.getByTestId('roulette-screen')).toBeVisible();
      await expect.poll(async () => (await readSave(page2)).data.phase).toBe('roulette');
    }
    await context.close();
  }
});

test('A66: 진행이 있는 저장은 약화되지 않았다 — 빈 저장소를 읽은 탭이 아니라 진행한 탭이 이기고, 되돌아온 타이틀로 진행을 덮어쓰지 않는다', async ({ page, context }) => {
  await page.goto('/');
  const decision = await findPendingState(page, 'alpha');
  await injectSave(page, decision, '/?__timescale=0.01');
  await expect(page.getByTestId('choice-panel')).toBeVisible();
  // 다른 탭이 저장을 "타이틀"로 바꿨다고 알려 온다: 이 탭은 진행이 있으므로(아는 값이 진행 있는 저장) 밀린다
  const title = await evalCore<GameState>(page, 'return core.createInitialState(5);');
  await page.evaluate(
    ([k, v]) => {
      localStorage.setItem(k, v);
      window.dispatchEvent(new StorageEvent('storage', { key: k, newValue: v }));
    },
    [GAME_KEY, JSON.stringify({ version: SAVE_VERSION, data: title })] as const,
  );
  await expect(page.getByTestId('superseded-screen')).toBeVisible();
  expect(context.pages()).toHaveLength(1);
});

