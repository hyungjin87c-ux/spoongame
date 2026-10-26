import { expect, test, type Page } from '@playwright/test';
import { activeTestId, injectSave, readSettings, titleState } from './helpers';
import { measureTextResize, setRootFontPercent, textResizeViolations } from './textResize';

/**
 * 정보 패널 「새 소식과 소개」 (SPEC-005 QI7 NT4·NT5·FQ1, 완료 기준 12): 첫 화면 푸터의 두 링크가 같은 패널을 연다.
 * 구조·문구는 단위 시험(tests/infoPanel.test.tsx·releaseNotes.test.ts·aboutFaq.test.ts)이 본다. 여기서는 실제 브라우저에서:
 *  · 열기: 두 링크 → 구역 · 제목으로 포커스 · 바깥 inert · 스크롤 잠금 · 노트 최신 3개 펼침(지금은 세 버전 모두) · 질문 열 개는 접힘
 *  · 닫기 셋(Esc · 「닫기」 · 뒤로가기) → 열었던 링크로 포커스 · history 한 걸음 · 새로고침하면 복원하지 않음(SV3)
 *  · 「새」 표시와 notesSeen(설정 v5) · 패널 안 「의견 보내기」(새 탭, buildFeedbackUrl) · Q&A 키보드 조작 · Tab이 패널 밖으로 새지 않음
 *  · 320px·글자 200%·1280에서 가로 넘침 0 · 외부 요청 0
 */

test.describe.configure({ timeout: 90_000 });

/** 새 판 첫 화면을 열고(저장 없음) 입력 가드가 풀릴 때까지 기다린다 */
async function openTitle(page: Page, settings: { notesSeen?: string } = {}): Promise<void> {
  await injectSave(page, titleState(20261013), '/', { speed: 1, autoMode: false, noteCards: false, ...settings });
  await expect(page.getByTestId('title-screen')).toBeVisible();
  await expect(page.getByTestId('start-birth')).toBeEnabled();
}

const panel = (page: Page) => page.getByTestId('info-panel');

test.describe('열기 (NT4·NT5)', () => {
  test('푸터의 「새 소식」 링크가 패널을 연다: 대화상자 · 제목으로 포커스 · 바깥 inert · 문서 스크롤 잠금 · 노트는 최신 위 · 질문 열 개는 접혀 있다', async ({ page }) => {
    await openTitle(page);
    const link = page.getByTestId('link-news');
    await expect(link).toBeVisible();
    await link.click();
    await expect(panel(page)).toBeVisible();
    await expect(panel(page)).toHaveAttribute('role', 'dialog');
    await expect(panel(page)).toHaveAttribute('aria-modal', 'true');
    await expect(page.getByTestId('info-title')).toHaveText('새 소식과 소개');
    await expect.poll(() => activeTestId(page)).toBe('info-title');
    // 바깥(본문·본문 끝 여백·하단 띠)은 inert, 문서 스크롤은 잠긴다
    expect(await page.locator('.title[inert], .page-end-space[inert], .bottom-bar[inert]').count()).toBe(3);
    expect(await page.evaluate(() => document.documentElement.classList.contains('sheet-open'))).toBe(true);
    // 새 소식: 최신이 위(v0.2.1 → v0.2.0 → v0.1.0), 최신 3개 펼침(지금은 세 버전 모두), 항목 종류는 글자 칩
    const versions = page.getByTestId('info-version');
    await expect(versions).toHaveCount(3);
    await expect(versions.nth(0)).toHaveAttribute('data-version', '0.2.1');
    await expect(versions.nth(1)).toHaveAttribute('data-version', '0.2.0');
    await expect(versions.nth(2)).toHaveAttribute('data-version', '0.1.0');
    expect(await versions.evaluateAll((els) => els.map((e) => (e as HTMLDetailsElement).open))).toEqual([true, true, true]);
    await expect(versions.nth(0)).toContainText('결정 카드의 통계·연구 아래에 풀이 한 줄이 생겼어요.');
    await expect(versions.nth(1)).toContainText('어린 시절의 큰 결정은 부모님이 정해요.');
    await expect(versions.nth(0).locator('.note-kind').first()).toHaveText('추가');
    // 소개: 질문 10개, 모두 접힘
    const faq = page.getByTestId('faq-item');
    await expect(faq).toHaveCount(10);
    expect(await faq.evaluateAll((els) => els.map((e) => (e as HTMLDetailsElement).open))).toEqual(Array(10).fill(false));
  });

  test('「소개」 링크로 열면 그 구역 머리가 패널 위쪽에 와 있다 (sticky 머리 아래)', async ({ page }) => {
    await openTitle(page);
    await page.getByTestId('link-intro').click();
    await expect(panel(page)).toBeVisible();
    await expect(panel(page)).toHaveAttribute('data-section', 'intro');
    const gap = await page.evaluate(() => {
      const sheet = document.querySelector('[data-testid="info-panel"]') as HTMLElement;
      const h = document.getElementById('info-intro-h') as HTMLElement;
      const head = sheet.querySelector('.sheet__head') as HTMLElement;
      return { top: h.getBoundingClientRect().top - sheet.getBoundingClientRect().top, headBottom: head.getBoundingClientRect().bottom - sheet.getBoundingClientRect().top, sheetH: sheet.clientHeight, scrolled: sheet.scrollTop };
    });
    expect(gap.scrolled, '소개 구역으로 스크롤됐다').toBeGreaterThan(0);
    expect(gap.top, '구역 제목이 머리 아래(가려지지 않음)').toBeGreaterThanOrEqual(gap.headBottom - 1);
    expect(gap.top, '구역 제목이 패널 위쪽 절반 안').toBeLessThan(gap.sheetH / 2);
  });

  test('패널이 열려 있는 동안 Tab은 바깥(본문·하단 띠)에 닿지 않는다 (바깥 inert) — 40번 눌러도 포커스는 패널 안이거나 문서 밖(브라우저)이다', async ({ page }) => {
    await openTitle(page);
    await page.getByTestId('link-news').click();
    await expect(panel(page)).toBeVisible();
    let inside = 0;
    for (let i = 0; i < 40; i++) {
      await page.keyboard.press('Tab');
      const where = await page.evaluate(() => {
        const a = document.activeElement;
        if (a === null || a === document.body || a === document.documentElement) return 'document';
        if (a.closest('[data-testid="info-panel"]') !== null) return 'panel';
        return `outside:${a.tagName}#${a.getAttribute('data-testid') ?? ''}`;
      });
      expect(where, `Tab ${i + 1}번째`).not.toMatch(/^outside:/);
      if (where === 'panel') inside++;
    }
    expect(inside, '패널 안의 조작 요소(닫기·버전 둘·질문 열·의견 보내기)를 실제로 돌았다').toBeGreaterThanOrEqual(14);
  });
});

test.describe('닫기 셋: Esc · 「닫기」 · 뒤로가기 (NT5)', () => {
  for (const way of ['Esc', '닫기 버튼', '뒤로가기'] as const) {
    for (const which of ['news', 'intro'] as const) {
      test(`${which === 'news' ? '「새 소식」' : '「소개」'} 링크로 연 패널을 ${way}로 닫으면 닫히고 포커스가 그 링크로 돌아오며 바깥 inert·스크롤 잠금이 풀린다`, async ({ page }) => {
        await openTitle(page);
        const link = page.getByTestId(`link-${which}`);
        await link.click();
        await expect(panel(page)).toBeVisible();
        // 열 때 history 항목 하나(주소는 그대로) — 표식이 달린다
        expect(await page.evaluate(() => (history.state as { suzeoInfoPanel?: string } | null)?.suzeoInfoPanel !== undefined)).toBe(true);
        expect(new URL(page.url()).pathname).toBe('/');
        if (way === 'Esc') await page.keyboard.press('Escape');
        else if (way === '닫기 버튼') await page.getByTestId('info-close').click();
        else await page.goBack();
        await expect(panel(page)).toHaveCount(0);
        await expect.poll(() => activeTestId(page)).toBe(`link-${which}`);
        expect(await page.locator('[inert]').count()).toBe(0);
        expect(await page.evaluate(() => document.documentElement.classList.contains('sheet-open'))).toBe(false);
        // history는 열기 전으로 돌아왔다(표식이 없다) — 닫는 길이 셋이어도 한 걸음이다
        expect(await page.evaluate(() => (history.state as { suzeoInfoPanel?: string } | null)?.suzeoInfoPanel)).toBeUndefined();
        // 다시 열 수 있다
        await link.click();
        await expect(panel(page)).toBeVisible();
      });
    }
  }

  test('뒤로가기는 패널만 닫고 첫 화면에 머문다 — 앱을 떠나지 않는다', async ({ page }) => {
    await openTitle(page);
    await page.getByTestId('link-news').click();
    await expect(panel(page)).toBeVisible();
    await page.goBack();
    await expect(panel(page)).toHaveCount(0);
    await expect(page.getByTestId('title-screen')).toBeVisible();
    expect(new URL(page.url()).pathname).toBe('/');
  });

  test('새로고침하면 패널을 복원하지 않는다 — 닫힌 첫 화면이다 (SV3), 그 뒤에도 다시 열린다(열림 표식이 옛 토큰이어도)', async ({ page }) => {
    await openTitle(page);
    await page.getByTestId('link-intro').click();
    await expect(panel(page)).toBeVisible();
    await page.reload();
    await expect(page.getByTestId('title-screen')).toBeVisible();
    await expect(panel(page)).toHaveCount(0);
    await expect(page.getByTestId('start-birth')).toBeEnabled();
    await page.getByTestId('link-news').click();
    await expect(panel(page)).toBeVisible();
    await page.goBack();
    await expect(panel(page)).toHaveCount(0);
  });
});

test.describe('닫기 요청이 겹쳐도 history는 한 걸음만 되돌아간다 (R-491)', () => {
  /**
   * 「닫기」 더블클릭·Esc 연타처럼 닫기 요청이 `history.back()`이 끝나기 전에 다시 오면, 고치기 전에는 표식이 아직 남아 있어 `back()`이 두 번 불려 두 걸음 뒤로 갔다(앱 밖으로 나갈 수 있음).
   * 두 걸음 뒤가 눈에 보이게 열기 전 history에 구별되는 항목(`/?before-panel`)을 하나 둔다 — 그 항목으로 가면 주소가 바뀌고 문서가 새로 로드돼 창에 심어 둔 표시도 사라진다.
   * 요청이 겹치는 순간을 확실히 만들려고 같은 JS 작업 안에서 두 번 누르는 변형(popstate는 작업이 끝나야 오므로 겹침이 항상 일어난다)과, 사람이 하는 더블클릭·연타 변형을 둘 다 돈다.
   */
  const OVERLAPS = {
    '「닫기」 더블클릭': (page: Page) => page.getByTestId('info-close').dblclick(),
    '「닫기」를 같은 작업 안에서 두 번 눌러': (page: Page) =>
      page.evaluate(() => {
        const b = document.querySelector('[data-testid="info-close"]') as HTMLButtonElement;
        b.click();
        b.click();
      }),
    'Esc 연타(키 두 번)': async (page: Page) => {
      await page.keyboard.press('Escape');
      await page.keyboard.press('Escape');
    },
    'Esc를 같은 작업 안에서 두 번 눌러': (page: Page) =>
      page.evaluate(() => {
        for (let i = 0; i < 2; i++) document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
      }),
    '「닫기」와 Esc를 같은 작업 안에서 섞어': (page: Page) =>
      page.evaluate(() => {
        (document.querySelector('[data-testid="info-close"]') as HTMLButtonElement).click();
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
      }),
  } as const;

  for (const [name, overlap] of Object.entries(OVERLAPS)) {
    for (const which of ['news', 'intro'] as const) {
      test(`${name} ${which === 'news' ? '「새 소식」' : '「소개」'} 패널을 닫으면 한 걸음만 되돌아가 주소 /와 첫 화면이 유지된다`, async ({ page }) => {
        await page.goto('/?before-panel');
        await openTitle(page);
        const origin = new URL(page.url()).origin;
        await page.evaluate(() => {
          (window as unknown as { __panelTestMark?: number }).__panelTestMark = 1;
        });
        const link = page.getByTestId(`link-${which}`);
        await link.click();
        await expect(panel(page)).toBeVisible();
        await overlap(page);
        await expect(panel(page)).toHaveCount(0);
        // 늦게 오는 두 번째 뒤로 가기가 있다면 이 시간 안에 주소·문서를 바꾼다 (보호 시간 500ms보다 길게)
        await page.waitForTimeout(900);
        expect(page.url(), '주소는 / 그대로(앞 항목 /?before-panel이나 about:blank로 가지 않았다)').toBe(`${origin}/`);
        expect(await page.evaluate(() => (window as unknown as { __panelTestMark?: number }).__panelTestMark), '같은 문서가 살아 있다(새로 로드되지 않았다)').toBe(1);
        await expect(page.getByTestId('title-screen')).toBeVisible();
        expect(await page.evaluate(() => (history.state as { suzeoInfoPanel?: string } | null)?.suzeoInfoPanel), '표식이 걷혔다(한 걸음 되돌렸다)').toBeUndefined();
        if (name !== '「닫기」 더블클릭') {
          await expect.poll(() => activeTestId(page)).toBe(`link-${which}`);
        }
        // (사람의 더블클릭은 포커스를 보지 않는다: 첫 클릭으로 패널이 걷힌 뒤 둘째 클릭이 「닫기」가 있던 자리 뒤의 요소 — 캐러셀 뷰포트나 빈 바탕 — 에 떨어져 포커스를 가져간다.
        // 포커스가 링크로 돌아온 뒤 둘째 클릭이 옮긴 것이라 앱이 틀린 것이 아니다. 키보드·같은 작업 안 변형은 링크로 돌아와야 한다.)
        // 그 뒤에도 정상: 다시 열고 한 번 닫아도 같은 자리, 앞 항목으로 가지 않는다
        await link.click();
        await expect(panel(page)).toBeVisible();
        await page.keyboard.press('Escape');
        await expect(panel(page)).toHaveCount(0);
        await page.waitForTimeout(300);
        expect(page.url()).toBe(`${origin}/`);
        expect(await page.evaluate(() => (window as unknown as { __panelTestMark?: number }).__panelTestMark)).toBe(1);
      });
    }
  }
});

test.describe('「새」 표시와 notesSeen (NT4, 설정 v5)', () => {
  test('본 적이 없으면 「새 소식」 옆에 「새」 알약(색 + 글자)이 뜨고, 패널을 열면 사라지며 notesSeen이 지금 버전으로 저장되어 새로고침 뒤에도 없다', async ({ page }) => {
    await openTitle(page);
    const badge = page.getByTestId('news-badge');
    await expect(badge).toBeVisible();
    await expect(badge).toHaveText('새');
    await expect(badge).toHaveAttribute('aria-hidden', 'true');
    // 링크 이름: 알약 글자는 읽히지 않고 뜻은 읽기 전용 꼬리가 전한다
    expect((await page.getByTestId('link-news').innerText()).replace(/\s+/g, ' ').trim()).toContain('새 소식');
    await expect(page.getByTestId('link-news').locator('.sr-only')).toHaveText('(읽지 않은 소식 있음)');
    await expect(page.getByTestId('link-intro').locator('.news-badge')).toHaveCount(0);
    expect((await readSettings(page)).notesSeen ?? '').toBe(''); // 아직 본 적이 없다 (이전 설정에는 필드가 없을 수 있다)
    await page.getByTestId('link-news').click();
    await expect(panel(page)).toBeVisible();
    await page.getByTestId('info-close').click();
    await expect(panel(page)).toHaveCount(0);
    await expect(page.getByTestId('news-badge')).toHaveCount(0);
    await expect.poll(async () => (await readSettings(page)).notesSeen).toBe('0.2.1');
    await page.reload();
    await expect(page.getByTestId('title-screen')).toBeVisible();
    await expect(page.getByTestId('news-badge')).toHaveCount(0);
  });

  test('「소개」 링크로 열어도 notesSeen이 갱신된다 (패널을 연 것이 기준)', async ({ page }) => {
    await openTitle(page);
    await expect(page.getByTestId('news-badge')).toBeVisible();
    await page.getByTestId('link-intro').click();
    await expect(panel(page)).toBeVisible();
    await expect.poll(async () => (await readSettings(page)).notesSeen).toBe('0.2.1');
  });

  test('이전 버전을 본 사람(notesSeen 0.1.0·0.2.0)에게는 뜨고, 현재 버전을 본 사람에게는 안 뜬다', async ({ page }) => {
    await openTitle(page, { notesSeen: '0.1.0' });
    await expect(page.getByTestId('news-badge')).toBeVisible();
    await openTitle(page, { notesSeen: '0.2.0' });
    await expect(page.getByTestId('news-badge')).toBeVisible(); // 0.2.1이 나왔으니 0.2.0까지 본 사람에게도 뜬다
    await openTitle(page, { notesSeen: '0.2.1' });
    await expect(page.getByTestId('news-badge')).toHaveCount(0);
    await expect(page.getByTestId('link-news')).toBeVisible();
  });
});

test.describe('소개 Q&A와 의견 보내기 (FQ1·N2)', () => {
  test('질문은 키보드로 펼쳐진다: summary에 포커스 → Enter로 열고 Space로 닫는다 · 답은 해요체 문단', async ({ page }) => {
    await openTitle(page);
    await page.getByTestId('link-intro').click();
    const first = page.getByTestId('faq-item').first();
    const summary = first.locator('summary');
    await summary.focus();
    expect(await first.evaluate((e) => (e as HTMLDetailsElement).open)).toBe(false);
    await page.keyboard.press('Enter');
    expect(await first.evaluate((e) => (e as HTMLDetailsElement).open)).toBe(true);
    await expect(first.locator('.faq__a p').first()).toBeVisible();
    await expect(first).toContainText('시뮬레이션이에요');
    await page.keyboard.press('Space');
    expect(await first.evaluate((e) => (e as HTMLDetailsElement).open)).toBe(false);
    // 다섯 개 이상 질문이 펼쳐진다 (FQ2)
    const items = page.getByTestId('faq-item');
    for (let i = 0; i < 6; i++) {
      await items.nth(i).locator('summary').click();
      expect(await items.nth(i).evaluate((e) => (e as HTMLDetailsElement).open), `질문 ${i + 1}`).toBe(true);
    }
  });

  test('Q7(무거운 장면 가리기)·Q8(힘든 마음)·Q9(만든 사람)의 답: 도구 이름·상담전화·일러스트 도구가 보인다 (N3·N4·N7)', async ({ page }) => {
    await openTitle(page);
    await page.getByTestId('link-intro').click();
    const open = async (id: string) => {
      const item = page.locator(`[data-faq="${id}"]`);
      await item.locator('summary').click();
      return item;
    };
    const gentle = await open('gentle');
    await expect(gentle).toContainText('켜거나 끄면 지난 기록까지 바로 바뀌어요.');
    await expect(gentle).toContainText('판 도중에 바꾸려면 「나가기」로 첫 화면에 간 뒤 스위치를 바꾸고 「이어서 살기」를 누르면 돼요.');
    const help = await open('help');
    await expect(help).toContainText('자살예방 상담전화 109(24시간)로 전화할 수 있어요.');
    expect(await help.innerText()).not.toMatch(/자해|내용이 없/);
    const maker = await open('maker');
    await expect(maker).toContainText('AI(Anthropic의 Claude)');
    await expect(maker).toContainText('AI 이미지 도구(OpenAI의 ChatGPT)');
  });

  test('패널 끝 「의견 보내기」: 새 탭 링크이고 주소가 buildFeedbackUrl의 값(첫 화면·빌드 표기)이며 읽기 이름에 「(새 탭으로 열립니다)」가 붙는다 — 누르면 새 탭이 열린다', async ({ page, context }) => {
    await context.route('https://github.com/**', (route) => route.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><title>ok</title>' }));
    await openTitle(page);
    await page.getByTestId('link-news').click();
    const link = page.getByTestId('info-feedback');
    await link.scrollIntoViewIfNeeded();
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute('target', '_blank');
    await expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    await expect(link).toContainText('의견 보내기');
    await expect(link.locator('.sr-only')).toHaveText('(새 탭으로 열립니다)');
    const href = (await link.getAttribute('href'))!;
    const url = new URL(href);
    expect(`${url.origin}${url.pathname}`).toBe('https://github.com/hyungjin87c-ux/spoongame/issues/new');
    expect(url.searchParams.get('template')).toBe('feedback.yml');
    const screen = url.searchParams.get('screen')!;
    expect(screen).toMatch(/^첫 화면, v0\.2\.1 \((?:[0-9a-f]{7}\+?|개발 빌드)\)$/);
    expect([...url.searchParams.keys()].sort()).toEqual(['screen', 'template']); // 이름·기록이 들어갈 자리는 없다
    // 입력 가드(열린 직후 0.4초)가 풀린 뒤 누르면 새 탭이 열린다
    await expect(link).not.toHaveAttribute('aria-disabled', 'true');
    const [popup] = await Promise.all([context.waitForEvent('page'), link.click()]);
    expect(popup.url()).toBe(href);
    await popup.close();
    await expect(panel(page)).toBeVisible(); // 패널은 그대로
  });
});

/**
 * 한 줄 구분 목록 (REV-005-B1-1 R-493, diff-005 D5-76·D5-77): 정보 패널의 1px 테두리 상자(버전 2 · 질문 10 · 종류 칩 16)를 걷고 행 사이 한 줄 + 글자 칸으로 바꿨다.
 * 상자가 사라진 뒤에도 「누를 수 있다」는 표시가 남는지(꺾쇠 · 44px 행 · hover 면 · 포커스 링 · 강제 색상의 구분줄)와 구분줄이 정말 행 사이에만 있는지를 계산된 스타일로 본다.
 * 색은 토큰(`--c-border` · `--c-text-2` · `--c-surface-2`)을 화면에서 풀어 비교한다 — 색 값을 글자로 박지 않으니 라이트·다크 어느 쪽에서도 같은 단언이다.
 */
test.describe('한 줄 구분 목록 (R-493·D5-77)', () => {
  /** 토큰·시스템 색을 이 화면에서 푼 색(rgb 글자) */
  const resolveColor = (page: Page, value: string): Promise<string> =>
    page.evaluate((v) => {
      const el = document.createElement('span');
      el.style.color = v;
      document.body.appendChild(el);
      const c = getComputedStyle(el).color;
      el.remove();
      return c;
    }, value);

  interface RowStyle {
    top: string;
    topColor: string;
    others: number;
    radius: string;
    height: number;
    chevronW: string;
    chevronColor: string;
    bg: string;
  }
  /** 같은 부류(`.info__ver` 또는 `.faq__item`) 행들의 계산된 스타일 */
  const rowsOf = (page: Page, selector: string): Promise<RowStyle[]> =>
    page.evaluate((sel) => {
      return [...document.querySelectorAll(sel)].map((item) => {
        const cs = getComputedStyle(item);
        const summary = item.querySelector('summary') as HTMLElement;
        const before = getComputedStyle(summary, '::before');
        return {
          top: cs.borderTopWidth,
          topColor: cs.borderTopColor,
          others: parseFloat(cs.borderRightWidth) + parseFloat(cs.borderBottomWidth) + parseFloat(cs.borderLeftWidth),
          radius: cs.borderTopLeftRadius,
          height: summary.getBoundingClientRect().height,
          chevronW: before.borderRightWidth,
          chevronColor: before.borderRightColor,
          bg: getComputedStyle(summary).backgroundColor,
        };
      });
    }, selector);

  test('상자 테두리가 없다: 버전 2·질문 10·종류 글자 칸 어느 것도 네 변이 모두 테두리가 아니고, 행 사이에만 1px 구분줄이 있다 (첫 행은 없음)', async ({ page }) => {
    await openTitle(page);
    await page.getByTestId('link-news').click();
    await expect(panel(page)).toBeVisible();
    const boxes = await page.evaluate(() => {
      const sides = ['top', 'right', 'bottom', 'left'];
      const isBox = (el: Element) => {
        const cs = getComputedStyle(el);
        return sides.every((s) => parseFloat(cs.getPropertyValue(`border-${s}-width`)) >= 1 && cs.getPropertyValue(`border-${s}-style`) !== 'none');
      };
      const all = [...document.querySelectorAll('.info__ver, .faq__item, .note-kind')];
      return { total: all.length, vers: document.querySelectorAll('.info__ver').length, boxed: all.filter(isBox).length, kinds: document.querySelectorAll('.note-kind').length, kindBorders: [...document.querySelectorAll('.note-kind')].filter((el) => parseFloat(getComputedStyle(el).borderTopWidth) > 0).length };
    });
    expect(boxes.kinds, '공허 통과 방지: 종류 글자 칸이 실제로 있다').toBeGreaterThanOrEqual(8);
    // 제목의 「버전 2」는 R-493 당시 개수다(옛 기록이 이 제목을 가리켜 그대로 둔다). v0.2.1부터 새 소식 버전은 3개이고, 이 시험은 개수를 세어 맞춘다.
    expect(boxes.vers, '공허 통과 방지: 새 소식 버전 상자가 실제로 있다(v0.2.1·v0.2.0·v0.1.0)').toBe(3);
    expect(boxes.total, '버전 3 + 질문 10 + 종류 글자 칸').toBe(boxes.vers + 10 + boxes.kinds);
    expect(boxes.boxed, '테두리 상자는 0').toBe(0);
    expect(boxes.kindBorders, '종류 글자 칸에는 테두리가 없다').toBe(0);
    const border = await resolveColor(page, 'var(--c-border)');
    for (const selector of ['.info__ver', '.faq__item']) {
      const rows = await rowsOf(page, selector);
      expect(rows.length, `${selector} 행 수`).toBe(selector === '.info__ver' ? 3 : 10);
      rows.forEach((r, i) => {
        expect(r.others, `${selector} ${i + 1}번째: 구분줄 말고 다른 변에 테두리가 없다`).toBe(0);
        expect(r.top, `${selector} ${i + 1}번째: 윗줄`).toBe(i === 0 ? '0px' : '1px');
        if (i > 0) expect(r.topColor, `${selector} ${i + 1}번째: 구분줄 색은 --c-border`).toBe(border);
      });
    }
  });

  test('누를 수 있다는 표시가 남는다: 꺾쇠(2px 선, --c-text-2) · 행 높이 44px 이상 · hover 때 면 한 단(--c-surface-2) · 키보드 포커스 링 3px', async ({ page }) => {
    await openTitle(page);
    await page.getByTestId('link-intro').click();
    await expect(panel(page)).toBeVisible();
    const text2 = await resolveColor(page, 'var(--c-text-2)');
    const surface2 = await resolveColor(page, 'var(--c-surface-2)');
    for (const selector of ['.info__ver', '.faq__item']) {
      const rows = await rowsOf(page, selector);
      for (const [i, r] of rows.entries()) {
        expect(r.chevronW, `${selector} ${i + 1}번째: 꺾쇠 선 굵기`).toBe('2px');
        expect(r.chevronColor, `${selector} ${i + 1}번째: 꺾쇠 색`).toBe(text2);
        expect(r.height, `${selector} ${i + 1}번째: 행 높이`).toBeGreaterThanOrEqual(44);
        expect(r.radius, `${selector} ${i + 1}번째: 항목(details)은 둥근 상자가 아니다 — 둥근 모서리는 summary(hover 면·포커스 링)의 것`).toBe('0px');
      }
    }
    // hover: 면이 한 단 어두워진다 (평소는 투명)
    const summary = page.getByTestId('faq-item').nth(2).locator('summary');
    await summary.scrollIntoViewIfNeeded();
    await page.mouse.move(0, 0);
    expect(await summary.evaluate((el) => getComputedStyle(el).backgroundColor), '평소는 투명').toBe('rgba(0, 0, 0, 0)');
    await summary.hover();
    await expect.poll(() => summary.evaluate((el) => getComputedStyle(el).backgroundColor)).toBe(surface2);
    // 키보드 포커스 링: 닫기 버튼에서 Tab으로 첫 행에 닿으면 3px 실선 링
    await page.getByTestId('info-close').focus();
    await page.keyboard.press('Tab');
    const ring = await page.evaluate(() => {
      const a = document.activeElement as HTMLElement;
      const cs = getComputedStyle(a);
      return { tag: a.tagName, inRow: a.closest('.info__ver, .faq__item') !== null, style: cs.outlineStyle, width: cs.outlineWidth, radius: cs.borderTopLeftRadius };
    });
    expect(ring.tag).toBe('SUMMARY');
    expect(ring.inRow, '포커스가 첫 행 머리에 닿았다').toBe(true);
    expect(ring.style).toBe('solid');
    expect(ring.width).toBe('3px');
    expect(parseFloat(ring.radius), '링이 summary의 둥근 모서리를 따른다').toBeGreaterThan(0);
  });

  test('다크 모드: 구분줄·꺾쇠 색이 다크 토큰(--c-border · --c-text-2)이고 라이트와 다르다', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await openTitle(page);
    const lightBorder = await resolveColor(page, 'var(--c-border)');
    await page.emulateMedia({ colorScheme: 'dark' });
    await openTitle(page);
    await page.getByTestId('link-intro').click();
    await expect(panel(page)).toBeVisible();
    const border = await resolveColor(page, 'var(--c-border)');
    expect(border, '공허 통과 방지: 다크 토큰이 라이트와 다르다').not.toBe(lightBorder);
    const rows = await rowsOf(page, '.faq__item');
    expect(rows[1].topColor).toBe(border);
    expect(rows[1].chevronColor).toBe(await resolveColor(page, 'var(--c-text-2)'));
    expect(rows[0].top).toBe('0px');
  });

  test('강제 색상: 행 사이 구분줄과 꺾쇠가 CanvasText이고 행은 여전히 44px 이상이다', async ({ page }) => {
    await page.emulateMedia({ forcedColors: 'active' });
    await openTitle(page);
    await page.getByTestId('link-intro').click();
    await expect(panel(page)).toBeVisible();
    const canvasText = await resolveColor(page, 'CanvasText');
    for (const selector of ['.info__ver', '.faq__item']) {
      const rows = await rowsOf(page, selector);
      rows.forEach((r, i) => {
        if (i > 0) {
          expect(r.top, `${selector} ${i + 1}번째: 구분줄`).toBe('1px');
          expect(r.topColor, `${selector} ${i + 1}번째: 구분줄 색`).toBe(canvasText);
        }
        expect(r.chevronColor, `${selector} ${i + 1}번째: 꺾쇠 색`).toBe(canvasText);
        expect(r.height).toBeGreaterThanOrEqual(44);
      });
    }
  });
});

test.describe('크기·넘침·외부 요청 (CM-A·CM-B)', () => {
  for (const vp of [
    { name: '1280x800', width: 1280, height: 800, font: 100 },
    { name: '360x740', width: 360, height: 740, font: 100 },
    { name: '320x640 글자 200%', width: 320, height: 640, font: 200 },
  ] as const) {
    test(`패널 ${vp.name}: 가로 넘침 0·글자 잘림 0, 닫기 버튼과 제목이 보이고 구역 둘 모두 스크롤로 닿는다`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await openTitle(page);
      if (vp.font !== 100) await setRootFontPercent(page, vp.font);
      await page.getByTestId('link-news').click();
      await expect(panel(page)).toBeVisible();
      // 모든 질문을 펼친 가장 긴 모양에서 잰다
      await page.getByTestId('info-news').scrollIntoViewIfNeeded();
      for (const item of await page.getByTestId('faq-item').all()) await item.locator('summary').click();
      const m = await measureTextResize(page);
      expect(textResizeViolations(m, `패널 ${vp.name}`)).toEqual([]);
      expect(m.overflowPx).toBeLessThanOrEqual(0);
      // 머리(제목·닫기)는 sticky라 스크롤해도 보인다
      await page.getByTestId('info-feedback').scrollIntoViewIfNeeded();
      await expect(page.getByTestId('info-close')).toBeVisible();
      await expect(page.getByTestId('info-title')).toBeVisible();
      const box = await page.getByTestId('info-close').boundingBox();
      expect(box!.x + box!.width, '닫기 버튼이 화면 안').toBeLessThanOrEqual(vp.width);
      await page.screenshot({ path: testInfo.outputPath(`QI7-panel-${vp.name.replace(/\s/g, '-')}.png`) });
    });
  }

  test('외부 요청 0: 패널을 열고 두 구역을 훑고 닫는 동안 localhost 밖으로 나가는 요청이 없다 (CM-A)', async ({ page }) => {
    const external: string[] = [];
    page.on('request', (r) => {
      const u = new URL(r.url());
      if (u.protocol.startsWith('http') && u.hostname !== 'localhost' && u.hostname !== '127.0.0.1') external.push(r.url());
    });
    await openTitle(page);
    await page.getByTestId('link-news').click();
    await expect(panel(page)).toBeVisible();
    await page.getByTestId('info-intro').scrollIntoViewIfNeeded();
    for (const item of await page.getByTestId('faq-item').all()) await item.locator('summary').click();
    await page.keyboard.press('Escape');
    await expect(panel(page)).toHaveCount(0);
    expect(external, '같은 출처 밖 요청').toEqual([]);
  });
});
