import { expect, test, type Page } from '@playwright/test';
import type { GameState } from '../src/core/types';
import {
  GAME_KEY,
  KNOWN_SEED,
  SAVE_VERSION,
  birthState,
  eraSelectState,
  evalCore,
  findPendingState,
  injectSave,
  lifeState,
  noHorizontalOverflow,
  oracleLife,
  readSave,
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
  await page.keyboard.press('Tab'); // 키보드 사용 시작(:focus-visible 모드): 제목 다음의 시작 버튼
  const start = page.getByRole('button', { name: '시작' });
  await expect(start).toBeFocused();
  const ring = (selector: string) =>
    page.evaluate((sel) => {
      const el = document.querySelector(sel) as HTMLElement;
      const cs = getComputedStyle(el);
      return { tag: el.tagName, focused: document.activeElement === el, outlineStyle: cs.outlineStyle, outlineWidth: cs.outlineWidth };
    }, selector);
  const btn = await ring('button');
  expect(btn.outlineStyle).toBe('solid');
  expect(parseFloat(btn.outlineWidth)).toBeGreaterThanOrEqual(2);
  await expect(start).toBeEnabled();
  await page.keyboard.press('Enter'); // 시대 선택 화면: 프로그램이 제목으로 포커스를 옮긴다
  await expect(page.getByTestId('era-screen')).toBeVisible();
  await expect.poll(() => page.evaluate(() => document.activeElement?.tagName)).toBe('H1');
  const h1 = await ring('h1');
  expect(h1.focused).toBe(true);
  expect(h1.outlineStyle, '제목 포커스 링').toBe('none');
  // 키보드로 닿은 다음 컨트롤(시대 카드)에는 링이 있다
  await page.keyboard.press('Tab');
  const card = await page.evaluate(() => {
    const el = document.activeElement as HTMLElement;
    const cs = getComputedStyle(el);
    return { tag: el.tagName, era: el.dataset.era, outlineStyle: cs.outlineStyle, outlineWidth: cs.outlineWidth };
  });
  expect(card.tag).toBe('BUTTON');
  expect(card.outlineStyle).toBe('solid');
  expect(parseFloat(card.outlineWidth)).toBeGreaterThanOrEqual(2);
});

// ---------- 사용감 3: 줄바꿈 ----------

test('한국어는 단어 중간에서 끊기지 않는다: word-break keep-all, 시대 선택·출생 화면의 제목·문장이 띄어쓰기에서만 줄을 바꾼다 (360px, QA 사용감 3)', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await injectSave(page, eraSelectState(KNOWN_SEED), '/');
  await expect(page.getByTestId('era-screen')).toBeVisible();
  const check = async (selector: string) => {
    const groups = await lines(page, selector);
    expect(groups.length, selector).toBeGreaterThan(0);
    for (const g of groups) {
      // 줄을 이어 붙였을 때 원문과 같아야 한다 = 줄이 바뀐 자리마다 원문에 공백이 있다 (단어가 쪼개지지 않았다)
      expect(g.lines.join(' '), `단어 중간에서 끊김: ${g.lines.join(' / ')}`).toBe(g.text);
      if (g.lines.length > 1) for (const l of g.lines) expect(l.length, `한 글자 줄: ${g.lines.join(' / ')}`).toBeGreaterThan(1);
    }
  };
  await check('h1');
  await check('.sub');
  await check('.era-card strong, .era-card span');
  expect(await page.evaluate(() => getComputedStyle(document.body).wordBreak)).toBe('keep-all');
  // 출생 화면
  await injectSave(page, birthState(KNOWN_SEED, 'present', 3, 50), '/');
  await expect(page.getByTestId('birth-screen')).toBeVisible();
  await check('h1');
  await check('.facts p');
  expect(await noHorizontalOverflow(page)).toBe(true);
});

test('긴 단어(공백 없는 긴 글)는 keep-all이어도 넘치지 않고 줄바꿈된다 (overflow-wrap)', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await page.goto('/');
  const state: GameState = { ...lifeState(KNOWN_SEED), phase: 'ending', age: 3, death: { age: 3, cause: '병' }, history: [{ age: 0, kind: 'stage', text: `${'가'.repeat(180)}` }, { age: 3, kind: 'death', text: '세상을 떠났다. 원인: 병.' }] };
  await injectSave(page, state, '/');
  await expect(page.getByTestId('ending-screen')).toBeVisible();
  expect(await noHorizontalOverflow(page)).toBe(true);
});

// ---------- 사용감 1·6: 낮은 화면, 저장 실패 안내 ----------

const LOW = [
  { width: 360, height: 480, maxControls: 100, label: '낮은 폰 세로' },
  { width: 667, height: 375, maxControls: 60, label: '가로 모드' },
] as const;

for (const vp of LOW) {
  test(`${vp.width}x${vp.height} (${vp.label}): 컨트롤 바가 ${vp.maxControls}px 이하(예전 117px)로 얇아지고, 선택지와 컨트롤의 모든 버튼에 스크롤로 닿으며 서로 가려지지 않는다 (QA 사용감 1)`, async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile-360', '뷰포트를 직접 지정하므로 mobile-360에서만 실행');
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await page.goto('/');
    const decision = await findPendingState(page, 'present', { minChoices: 3 });
    await injectSave(page, decision, '/');
    await expect(page.getByTestId('choice-panel')).toBeVisible();
    await expect(page.getByTestId('auto')).toBeEnabled();
    const controls = (await page.getByTestId('controls').boundingBox())!;
    expect(controls.height, '컨트롤 바 높이').toBeLessThanOrEqual(vp.maxControls);
    expect(controls.y + controls.height).toBeLessThanOrEqual(vp.height + 1); // 화면 아래에 붙어 있다
    expect(await noHorizontalOverflow(page)).toBe(true);
    // 컨트롤 버튼은 한 줄(가로)이거나 두 줄이어도 서로 겹치지 않고 글이 잘리지 않는다
    const buttons = await page.evaluate(() => [...document.querySelectorAll<HTMLElement>('[data-testid="controls"] button')].map((b) => ({ text: b.textContent, w: b.scrollWidth - b.clientWidth, h: b.scrollHeight - b.clientHeight, r: b.getBoundingClientRect().toJSON() })));
    expect(buttons).toHaveLength(6);
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
    // 맨 아래까지 내리면 스탯이 컨트롤 바 위에 온전히 보인다
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await settle(page);
    const tail = await page.evaluate(() => ({ stats: document.querySelector('[data-testid="stats"]')!.getBoundingClientRect().bottom, controls: document.querySelector('[data-testid="controls"]')!.getBoundingClientRect().top }));
    expect(tail.stats).toBeLessThanOrEqual(tail.controls + 1);
  });
}

test('데스크톱(1280x800): 선택지가 떠도 스탯(재산·학력·건강·행복·관계·외모)이 접힘 아래로 밀려나지 않고 컨트롤 바에 가려지지 않는다 (QA 사용감 1)', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', '기본 뷰포트(1280x800)를 쓰므로 desktop에서만 실행');
  await page.goto('/');
  const decision = await findPendingState(page, 'present', { minChoices: 3 });
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
  const rects = await page.evaluate(() => ({
    vh: innerHeight,
    controls: document.querySelector('[data-testid="controls"]')!.getBoundingClientRect().top,
    stats: [...document.querySelectorAll('[data-testid="stats"] .stat')].map((e) => e.getBoundingClientRect().bottom),
  }));
  expect(rects.stats).toHaveLength(6);
  for (const b of rects.stats) expect(b, '스탯이 컨트롤 바 아래로 가려짐').toBeLessThanOrEqual(rects.controls + 1);
  const bar = (await page.getByTestId('controls').boundingBox())!;
  expect(bar.height, '데스크톱 컨트롤 바는 한 줄').toBeLessThanOrEqual(70);
});

for (const vp of [
  { width: 360, height: 740 },
  { width: 360, height: 568 },
] as const) {
  test(`${vp.width}x${vp.height}: 저장 실패 안내 바는 따라다니지 않고 타이틀에 세로 스크롤을 만들지 않으며 출처 표기를 밀어내지 않는다 (QA 사용감 6)`, async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile-360', '뷰포트를 직접 지정하므로 mobile-360에서만 실행');
    await page.setViewportSize(vp);
    await page.goto('/?__quota=1'); // 저장이 항상 실패하는 저장소(개발 서버 전용 탐침)
    await expect(page.getByTestId('save-notice')).toBeVisible();
    await expect(page.getByTestId('title-screen')).toBeVisible();
    const m = await page.evaluate(() => ({
      docH: document.documentElement.scrollHeight,
      vh: innerHeight,
      noticeH: document.querySelector('[data-testid="save-notice"]')!.getBoundingClientRect().height,
      noticePosition: getComputedStyle(document.querySelector('[data-testid="save-notice"]')!).position,
      creditBottom: document.querySelector('[data-testid="names-credit"]')!.getBoundingClientRect().bottom,
    }));
    expect(m.noticePosition, '안내 바가 화면에 고정(sticky/fixed)되지 않는다').toBe('static');
    expect(m.noticeH).toBeLessThanOrEqual(64);
    expect(m.docH, '타이틀에 세로 스크롤이 생기지 않는다').toBeLessThanOrEqual(m.vh);
    expect(m.creditBottom, '출처 표기가 화면 안에 있다').toBeLessThanOrEqual(m.vh);
    expect(await noHorizontalOverflow(page)).toBe(true);
  });
}

test('저장 실패 안내는 인생 화면에서도 화면 위에 고정되지 않아 낮은 화면을 계속 가리지 않는다 (QA 사용감 1)', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-360', '뷰포트를 직접 지정하므로 mobile-360에서만 실행');
  await page.setViewportSize({ width: 667, height: 375 });
  await page.goto('/?__quota=1');
  await expect(page.getByTestId('save-notice')).toBeVisible();
  await page.getByRole('button', { name: '시작' }).click();
  await page.getByTestId('confirm-era').click();
  await page.getByTestId('next-life').click();
  await expect(page.getByTestId('life-screen')).toBeVisible();
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
  // 스탯 막대: 채움이 바탕과 구분된다
  const bar = await page.evaluate(() => {
    const track = document.querySelector('.bar') as HTMLElement;
    const fill = document.querySelector('.bar-fill') as HTMLElement;
    return { track: getComputedStyle(track).backgroundColor, fill: getComputedStyle(fill).backgroundColor, fillWidth: fill.getBoundingClientRect().width, trackBorder: getComputedStyle(track).borderTopStyle };
  });
  expect(bar.fill, '막대 채움이 바탕과 같은 색(사라짐)').not.toBe(bar.track);
  expect(bar.fillWidth).toBeGreaterThan(0);
  expect(bar.trackBorder).toBe('solid');
});

test('강제 색상 모드: 시대 선택 카드의 선택 상태도 구분된다', async ({ page }) => {
  await page.emulateMedia({ forcedColors: 'active' });
  await page.goto('/');
  await injectSave(page, eraSelectState(KNOWN_SEED), '/');
  await expect(page.getByTestId('era-screen')).toBeVisible();
  const border = (era: string) => page.evaluate((e) => getComputedStyle(document.querySelector(`[data-era="${e}"]`)!).borderTopStyle, era);
  expect(await border('present')).toBe('double');
  expect(await border('past')).toBe('solid');
});

// ---------- R-056: 비활성 "다음 결정으로"의 사유 ----------

test('비활성 "다음 결정으로"는 왜 눌리지 않는지를 보조기기에 알린다: 선택지 대기 중 / 자동 모드 (R-056)', async ({ page }) => {
  await page.goto('/');
  const decision = await findPendingState(page, 'present');
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
  const start = await oracleLife(page, decision.seed, 'present');
  await injectSave(page, start, '/?__timescale=0.01', { speed: 1, autoMode: false });
  await expect(page.getByTestId('life-screen')).toBeVisible();
  await expect(page.getByTestId('choice-panel')).toHaveCount(0);
  await expect(skip).toHaveAccessibleDescription('');
  await expect(page.getByTestId('skip-reason')).toHaveCount(0);
});

// ---------- R-054: 밀린 화면의 문구 ----------

test('밀린 화면: 어디서 바뀌었는지 단정하지 않고(다른 탭·같은 탭의 직접 변경 모두), 이어받을 저장이 없으면 새 게임이 시작된다고 버튼 옆에 알린다 (R-054)', async ({ page }) => {
  await page.goto('/');
  const decision = await findPendingState(page, 'present');
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
    // A가 진행하면(시작) 저장에 진행이 생기고, 아직 타이틀인 B는 그 진행에 밀린다 (진행이 있는 쪽의 충돌 감지는 그대로)
    const startA = a.getByRole('button', { name: '시작' });
    await expect(startA).toBeEnabled();
    await startA.click();
    await expect(a.getByTestId('era-screen')).toBeVisible();
    await expect(b.getByTestId('superseded-screen')).toBeVisible();
    await expect.poll(async () => (await readSave(a)).data.phase).toBe('eraSelect');
    // B의 이어하기 한 번으로 A의 진행(시대 선택)을 이어받는다
    await expect(b.getByTestId('take-over')).toBeEnabled();
    await b.getByTestId('take-over').click();
    await expect(b.getByTestId('era-screen')).toBeVisible();
    await expect(a.getByTestId('era-screen')).toBeVisible();
    await expect(a.getByTestId('superseded-screen')).toHaveCount(0);
    await context.close();
  }
});

test('A66 (결정적): 앱이 빈 저장소를 읽은 직후 다른 탭이 "진행 없는 타이틀"을 쓰면 밀리지 않고 자기 타이틀을 저장한다. 다른 탭이 진행(시대 선택)을 썼다면 전처럼 밀린다', async ({ page, browser }) => {
  await page.goto('/');
  const titleRaw = JSON.stringify({ version: SAVE_VERSION, data: await evalCore<GameState>(page, 'return core.createInitialState(7);') });
  const progressRaw = JSON.stringify({ version: SAVE_VERSION, data: eraSelectState(8) });

  for (const [label, raw, superseded] of [
    ['다른 탭이 타이틀을 썼다', titleRaw, false],
    ['다른 탭이 시대 선택까지 진행했다', progressRaw, true],
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
      await page2.getByRole('button', { name: '시작' }).click();
      await expect(page2.getByTestId('era-screen')).toBeVisible();
      await expect.poll(async () => (await readSave(page2)).data.phase).toBe('eraSelect');
    }
    await context.close();
  }
});

test('A66: 진행이 있는 저장은 약화되지 않았다 — 빈 저장소를 읽은 탭이 아니라 진행한 탭이 이기고, 되돌아온 타이틀로 진행을 덮어쓰지 않는다', async ({ page, context }) => {
  await page.goto('/');
  const decision = await findPendingState(page, 'present');
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

