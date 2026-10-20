import { expect, test, type Page } from '@playwright/test';
import { activeTestId, injectSave, readSettings, titleState } from './helpers';
import { measureTextResize, setRootFontPercent, textResizeViolations } from './textResize';

/**
 * 정보 패널 「새 소식과 소개」 (SPEC-005 QI7 NT4·NT5·FQ1, 완료 기준 12): 첫 화면 푸터의 두 링크가 같은 패널을 연다.
 * 구조·문구는 단위 시험(tests/infoPanel.test.tsx·releaseNotes.test.ts·aboutFaq.test.ts)이 본다. 여기서는 실제 브라우저에서:
 *  · 열기: 두 링크 → 구역 · 제목으로 포커스 · 바깥 inert · 스크롤 잠금 · 노트 최신 3개 펼침(지금은 두 버전 모두) · 질문 열 개는 접힘
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
    // 새 소식: 최신이 위(v0.2.0 → v0.1.0), 최신 3개 펼침(지금은 두 버전 모두), 항목 종류는 글자 칩
    const versions = page.getByTestId('info-version');
    await expect(versions).toHaveCount(2);
    await expect(versions.nth(0)).toHaveAttribute('data-version', '0.2.0');
    await expect(versions.nth(1)).toHaveAttribute('data-version', '0.1.0');
    expect(await versions.evaluateAll((els) => els.map((e) => (e as HTMLDetailsElement).open))).toEqual([true, true]);
    await expect(versions.nth(0)).toContainText('어린 시절의 큰 결정은 부모님이 정해요.');
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
    await expect.poll(async () => (await readSettings(page)).notesSeen).toBe('0.2.0');
    await page.reload();
    await expect(page.getByTestId('title-screen')).toBeVisible();
    await expect(page.getByTestId('news-badge')).toHaveCount(0);
  });

  test('「소개」 링크로 열어도 notesSeen이 갱신된다 (패널을 연 것이 기준)', async ({ page }) => {
    await openTitle(page);
    await expect(page.getByTestId('news-badge')).toBeVisible();
    await page.getByTestId('link-intro').click();
    await expect(panel(page)).toBeVisible();
    await expect.poll(async () => (await readSettings(page)).notesSeen).toBe('0.2.0');
  });

  test('이전 버전을 본 사람(notesSeen 0.1.0)에게는 뜨고, 현재 버전을 본 사람에게는 안 뜬다', async ({ page }) => {
    await openTitle(page, { notesSeen: '0.1.0' });
    await expect(page.getByTestId('news-badge')).toBeVisible();
    await openTitle(page, { notesSeen: '0.2.0' });
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
    expect(screen).toMatch(/^첫 화면, v0\.2\.0 \((?:[0-9a-f]{7}\+?|개발 빌드)\)$/);
    expect([...url.searchParams.keys()].sort()).toEqual(['screen', 'template']); // 이름·기록이 들어갈 자리는 없다
    // 입력 가드(열린 직후 0.4초)가 풀린 뒤 누르면 새 탭이 열린다
    await expect(link).not.toHaveAttribute('aria-disabled', 'true');
    const [popup] = await Promise.all([context.waitForEvent('page'), link.click()]);
    expect(popup.url()).toBe(href);
    await popup.close();
    await expect(panel(page)).toBeVisible(); // 패널은 그대로
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
