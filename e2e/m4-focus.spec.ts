import { expect, test, type Page } from '@playwright/test';
import { auditFocus, sampleFocus, summarize } from './focusObscured';
import { M4_SCREENS, headingOf, isDash, openM4Screen, readyButton, type M4Screen } from './m4States';
import { settleDash } from './m4Fixed';
import { injectSave, startPageHidden } from './helpers';
import { findImpactState } from './m5States';
import { setRootFontPercent } from './textResize';
import { STANDARD_VIEWPORTS } from './viewports';

/**
 * 대시보드·엔딩·밀린 화면·오류 화면에서 고정 요소(위의 sticky 헤더, 모바일의 하단 고정 진행 줄)가 키보드 포커스를 가리지 않는다 (SPEC-003 CM10, QM2-1 (g) — M4 마일스톤의 완료 조건).
 * 첫 화면·룰렛·출생신고와 같은 방식(e2e/focusObscured.ts#auditFocus: 고정/sticky 요소 자동 수집 → Tab·Shift+Tab 전체 순회 → 프로그램 focus() → 제목 포커스)과 같은 뷰포트 11종 × 글자 100·200%를 적용한다.
 * 대시보드의 조작 요소: 진행 줄 7개(일시정지·1·2·4·8배·다음 결정으로·자동 모드) + 도구 줄 5개 + (선택지 카드가 있으면 선택지) + (열려 있으면 BGM 볼륨 슬라이더, **나가기 확인 단계의 버튼 둘** — R-322) + 인생 기록 스크롤 영역(방향키로 읽는다, tabindex 0) + 상태 설명 접기.
 * 헤더가 풀리는지(고정 요소 수집에서 빠지는지)는 높이로 정해진다 — 풀렸으면 수집되지 않고(position: static) 고정이면 수집되어 어느 포커스도 가리지 않는다.
 * 모든 테스트가 뷰포트를 직접 지정하므로 mobile-360 프로젝트에서만 돈다.
 */

/** 화면마다 반드시 순회에 들어와야 하는 조작 요소(공허 통과 방지) */
function mustTab(screen: M4Screen): string[] {
  switch (screen) {
    case 'ending':
      return ['rebirth'];
    case 'superseded':
      return ['take-over'];
    case 'error':
      return [];
    case 'dash-decision':
      return ['pause', 'skip', 'auto', 'tool-bgm', 'tool-note', 'tool-dark', 'tool-feedback', 'tool-exit', 'log-list'];
    case 'dash-exit-ask':
      // 확인 단계의 두 버튼도 순회에 든다(R-322) — 열린 동안 Tab 순서는 도구 줄 → 확인 단계 → 본문
      return ['pause', 'skip', 'auto', 'tool-bgm', 'tool-note', 'tool-dark', 'tool-feedback', 'tool-exit', 'exit-yes', 'exit-no', 'log-list'];
    case 'dash-tools-open':
      // 도구 줄이 열린 상태: BGM 켜짐이면 볼륨 슬라이더가 순회에 든다(R-322). 「생각 남기기」는 선택할 수 없어도 포커스를 받는다
      return ['pause', 'skip', 'auto', 'tool-bgm', 'tool-note', 'tool-dark', 'tool-feedback', 'tool-exit', 'bgm-volume-input', 'log-list'];
    default:
      return ['pause', 'skip', 'auto', 'tool-bgm', 'tool-note', 'tool-dark', 'tool-feedback', 'tool-exit', 'log-list'];
  }
}

async function isFixed(page: Page, testId: string): Promise<boolean> {
  const el = page.getByTestId(testId);
  if ((await el.count()) === 0) return false;
  return el.evaluate((e) => ['fixed', 'sticky'].includes(getComputedStyle(e).position));
}

for (const vp of STANDARD_VIEWPORTS) {
  test.describe(`M4 포커스 가림 없음 ${vp.name}`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height }, hasTouch: vp.touch === true });

    for (const percent of [100, 200] as const) {
      for (const screen of M4_SCREENS) {
        test(`${vp.name} · 글자 ${percent}% · ${screen}: Tab·Shift+Tab 전체 순회·프로그램 focus()·제목 포커스에서 가려진 포커스 0 (CM10)`, async ({ page }, testInfo) => {
          test.skip(testInfo.project.name !== 'mobile-360', '뷰포트를 직접 지정하므로 mobile-360에서만 실행');
          // SPEC-003 QM2-1 r5 메모 4: 320×256에 글자 200%를 겹친 조합(800% 확대 상당)은 CM10 포커스 측정에서 제외한다(WCAG 1.4.10의 400% 기준을 넘는다 — focus-not-obscured.spec.ts와 같다).
          // M5부터 선택지 카드에 영향 줄·안내 한 줄이 붙어 선택지 하나가 그 높이(가용 높이 약 100px)보다 커졌으므로 선택지 카드가 있는 상태만 빼고 나머지 화면은 그대로 잰다.
          test.skip(percent === 200 && vp.name === '320x256-zoom400' && screen === 'dash-decision', 'CM10 측정 제외 조합(QM2-1 r5 메모 4): 320×256 × 글자 200% × 선택지 카드');
          test.setTimeout(180_000);
          await openM4Screen(page, screen);
          if (percent !== 100) await setRootFontPercent(page, percent);
          // 고정·해제 판정이 정착할 때까지 기다린다. 측정용 스크롤(measureDash)은 쓰지 않는다 — 스크롤이 순차 포커스의 출발점을 옮겨 Tab 순회가 중간에서 시작하게 만든다.
          if (isDash(screen)) await settleDash(page);
          const audit = await auditFocus(page, `${vp.name}/${percent}%/${screen}`, { headingTestId: headingOf(screen) });
          expect(audit.violations, summarize(audit)).toEqual([]);
          // 공허 통과 방지: 이 화면의 주요 조작 요소가 순회·프로그램 focus()에 실제로 들어왔다
          for (const id of mustTab(screen)) {
            expect(audit.tabbables, `조작 요소 ${audit.tabbables.join(' → ')}`).toContain(id);
            expect(audit.forward.map((s) => s.id), `Tab 순회 ${id}`).toContain(id);
            expect(audit.backward.map((s) => s.id), `Shift+Tab 순회 ${id}`).toContain(id);
          }
          expect(audit.forward.length).toBe(audit.tabbables.length);
          expect(audit.programmatic.length, '프로그램 focus() 측정 수').toBeGreaterThanOrEqual(audit.tabbables.length);
          if (isDash(screen)) {
            // 고정 요소 자동 수집: 헤더·진행 줄이 고정이면 모이고 풀렸으면(position: static) 모이지 않는다 (QM2-12)
            const headFixed = await isFixed(page, 'dash-head');
            const barFixed = await isFixed(page, 'controls');
            if (headFixed) expect(audit.fixedIds, '헤더가 고정이면 고정 요소로 모인다').toContain('dash-head');
            else expect(audit.fixedIds, '헤더가 풀렸으면 고정 요소로 모이지 않는다').not.toContain('dash-head');
            if (barFixed) expect(audit.fixedIds, '진행 줄이 고정이면 고정 요소로 모인다').toContain('controls');
            else expect(audit.fixedIds, '진행 줄이 풀렸거나 데스크톱이면 고정 요소로 모이지 않는다').not.toContain('controls');
            testInfo.annotations.push({ type: 'fixed', description: `헤더 ${headFixed ? '고정' : '해제'} · 진행 줄 ${barFixed ? '고정' : '해제'}` });
          }
        });
      }
    }
  });
}

test('화면 전환 직후 제목 포커스: 출생신고 → 살아가기 → 대시보드 제목(이름) → 엔딩까지 새 화면이 뜰 때마다 제목에 포커스가 가고 고정 요소에 가려지지 않는다 (360x568 · 320x568 · 글자 200%)', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-360', '뷰포트를 직접 지정하므로 mobile-360에서만 실행');
  test.setTimeout(90_000);
  for (const vp of [
    { width: 360, height: 568 },
    { width: 320, height: 568 },
  ]) {
    await page.setViewportSize(vp);
    for (const screen of ['dash-infant', 'ending'] as const) {
      await openM4Screen(page, screen);
      await setRootFontPercent(page, 200);
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.getByTestId(headingOf(screen)!).evaluate((el) => (el as HTMLElement).focus());
      const stop = await sampleFocus(page);
      expect(stop.judgement.violations, `${vp.width}x${vp.height} ${screen} 제목 포커스`).toEqual([]);
      await expect(readyButton(page, screen)).toBeEnabled();
    }
  }
});

test('선택지 카드가 뜨면 포커스가 선택지 제목으로 가고(수동 모드·모달 시트 — 시트 안에 제목·첫 선택지가 보인다. 자동 모드의 인라인 카드는 인생 화면 제목에 머문 채 카드 제목이 고정 헤더·진행 줄 사이에 보인다), D-52·D-59 (CM10 예외 ② revealCard) — 모바일 4가지 높이', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-360', '뷰포트를 직접 지정하므로 mobile-360에서만 실행');
  test.setTimeout(120_000);
  for (const vp of [
    { width: 360, height: 568 },
    { width: 360, height: 640 },
    { width: 360, height: 740 },
    { width: 320, height: 568 },
  ]) {
    await page.setViewportSize(vp);
    // 수동 모드: 모달 시트. 포커스는 선택지 제목으로 가고(D-52), 시트는 화면 안에 있으며 제목·첫 선택지가 시트 안에서 보인다 (시트 뒤의 머리·진행 줄은 inert + 스크림)
    await startPageHidden(page);
    await page.goto('/');
    await injectSave(page, await findImpactState(page, 'adult'), '/', { speed: 1, autoMode: false });
    await expect(page.getByTestId('choice-panel')).toBeVisible();
    await expect(page.getByTestId('choice-title')).toBeFocused();
    const stop = await sampleFocus(page);
    expect(stop.judgement.violations, `${vp.width}x${vp.height} 시트 선택지 제목 포커스`).toEqual([]);
    const sheet = await page.evaluate(() => {
      const panel = document.querySelector('[data-testid="choice-panel"]')!.getBoundingClientRect();
      const first = document.querySelector('[data-testid="choice-panel"] button.choice')!.getBoundingClientRect();
      const title = document.querySelector('[data-testid="choice-title"]')!.getBoundingClientRect();
      return { panelTop: panel.top, panelBottom: panel.bottom, titleTop: title.top, firstTop: first.top, firstBottom: first.bottom, vh: window.innerHeight };
    });
    expect(sheet.panelTop, `${vp.height}: 시트가 화면 위 안`).toBeGreaterThanOrEqual(0);
    expect(sheet.panelBottom, `${vp.height}: 시트가 화면 아래 안`).toBeLessThanOrEqual(sheet.vh + 0.5);
    expect(sheet.titleTop, `${vp.height}: 제목이 시트 안`).toBeGreaterThanOrEqual(sheet.panelTop);
    expect(sheet.firstBottom, `${vp.height}: 첫 선택지가 시트 안(스크롤 없이)`).toBeLessThanOrEqual(sheet.panelBottom + 0.5);
    // 자동 모드: 비모달 인라인 카드. 포커스는 인생 화면 제목에 머물고(D-52) 카드 제목은 머리 아래·진행 줄 위에 보인다
    await injectSave(page, await findImpactState(page, 'adult'), '/', { speed: 1, autoMode: true });
    await expect(page.getByTestId('choice-panel')).toBeVisible();
    await expect(page.getByTestId('life-name')).toBeFocused();
    const inline = await page.evaluate(() => {
      const head = document.querySelector('[data-testid="dash-head"]')!.getBoundingClientRect();
      const bar = document.querySelector('[data-testid="controls"]')!.getBoundingClientRect();
      const title = document.querySelector('[data-testid="choice-title"]')!.getBoundingClientRect();
      return { headBottom: head.bottom, barTop: bar.top, titleTop: title.top, titleBottom: title.bottom };
    });
    expect(inline.titleTop, `${vp.height}: 인라인 카드 제목이 헤더 아래`).toBeGreaterThanOrEqual(inline.headBottom);
    expect(inline.titleBottom, `${vp.height}: 인라인 카드 제목이 진행 줄 위`).toBeLessThanOrEqual(inline.barTop + 0.5);
  }
});

// ---------- 나가기 확인 단계를 열고 닫는 프로그램 포커스 경로 (R-322) ----------
// 확인 단계가 열리면 앱이 「돌아가기」에 focus()를 걸고(문서 어디에서 열었든 브라우저가 그 자리로 스크롤한다), 닫으면 「나가기」 도구로 focus()를 돌려준다.
// 이 두 번의 프로그램 포커스가 고정 요소(위의 sticky 헤더, 모바일의 하단 고정 진행 줄)에 가려지지 않아야 한다. 일부러 문서 맨 아래로 스크롤한 채(확인 단계가 화면 밖 위쪽에 있다) 열어
// 브라우저의 스크롤이 일해야만 포커스가 닿게 하고, 열기·닫기는 프로그램 click()으로 해서 사용자의 스크롤 보정(scrollIntoView)이 끼지 않게 한다.

for (const vp of STANDARD_VIEWPORTS) {
  test.describe(`M4 확인 단계 열고 닫기 포커스 ${vp.name}`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height }, hasTouch: vp.touch === true });
    for (const percent of [100, 200] as const) {
      test(`${vp.name} · 글자 ${percent}%: 맨 아래에서 확인 단계를 열면 「돌아가기」 포커스가, Esc로 닫으면 「나가기」 포커스가, 「돌아가기」를 눌러 닫아도 「나가기」 포커스가 고정 요소에 가려지지 않는다 (R-322)`, async ({ page }, testInfo) => {
        test.skip(testInfo.project.name !== 'mobile-360', '뷰포트를 직접 지정하므로 mobile-360에서만 실행');
        test.setTimeout(120_000);
        await openM4Screen(page, 'dash-adult');
        if (percent !== 100) await setRootFontPercent(page, percent);
        await settleDash(page);
        await page.keyboard.press('Shift'); // 키보드 사용 중이라는 신호(:focus-visible)
        const problems: string[] = [];
        const check = async (label: string, expectedId: string) => {
          await expect.poll(() => page.evaluate(() => document.activeElement?.getAttribute('data-testid') ?? '(none)'), `${label}: 포커스 위치`).toBe(expectedId);
          const stop = await sampleFocus(page);
          for (const v of stop.judgement.violations) problems.push(`${vp.name}/${percent}% ${label} (scrollY ${stop.scrollY}): ${v}`);
        };
        const scrollToBottom = () => page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
        const clickExit = () => page.getByTestId('tool-exit').evaluate((el) => (el as HTMLButtonElement).click()); // 프로그램 click — 브라우저가 버튼을 보이게 스크롤하지 않는다
        // 1) 맨 아래에서 열기 → 「돌아가기」
        await scrollToBottom();
        await clickExit();
        await expect(page.getByTestId('exit-ask')).toBeVisible();
        await check('열기', 'exit-no');
        // 2) Esc로 닫기 → 「나가기」
        await page.keyboard.press('Escape');
        await expect(page.getByTestId('exit-ask')).toHaveCount(0);
        await check('Esc로 닫기', 'tool-exit');
        // 3) 다시 맨 아래에서 열고 「돌아가기」(Enter)로 닫기 → 「나가기」
        await scrollToBottom();
        await clickExit();
        await expect(page.getByTestId('exit-ask')).toBeVisible();
        await expect(page.getByTestId('exit-no')).toBeEnabled();
        await check('다시 열기', 'exit-no');
        await scrollToBottom();
        await page.getByTestId('exit-no').evaluate((el) => (el as HTMLElement).focus()); // 맨 아래에서 포커스를 다시 걸어 스크롤이 필요하게 한다
        await page.keyboard.press('Enter');
        await expect(page.getByTestId('exit-ask')).toHaveCount(0);
        await check('돌아가기로 닫기', 'tool-exit');
        expect(problems).toEqual([]);
      });
    }
  });
}

// ---------- R-438: 「새 기록 N개 · 맨 위로」 알약이 떠 있는 대시보드 (스크롤 영역 안 위 가장자리) ----------

/**
 * 인생 기록을 아래로 읽는 중에 새 줄이 쌓여 「새 기록 N개 · 맨 위로」 알약이 떠 있게 한다. 이미 떠 있으면 그대로 둔다.
 * 「다음 결정으로」는 결정 시트(수동 모드의 모달 — 뒤가 inert)를 열고, 선택하면 시트가 닫힌다. 알약이 떴어도 시트가 열려 있으면(알약은 줄이 쌓일 때 뜨고 시트는 그 직후 비동기로 열린다) 한 번 더 골라 닫는다 —
 * 시트가 닫혀 포커스가 인생 화면으로 돌아온 상태에서 끝나야 다음 측정이 흔들리지 않는다.
 */
async function ensureJumpPill(page: Page): Promise<void> {
  const sheetOpen = async (): Promise<boolean> => (await page.getByTestId('choice-panel').count()) > 0;
  if ((await page.getByTestId('log-jump').count()) > 0 && !(await sheetOpen())) return;
  await page.getByTestId('log-list').evaluate((el) => el.scrollTo({ top: 220, behavior: 'instant' }));
  for (let i = 0; i < 80 && ((await page.getByTestId('log-jump').count()) === 0 || (await sheetOpen())); i++) {
    // 선택지가 떠 있으면 첫 선택지를, 아니면 「다음 결정으로」를 누른다(입력 가드 중이면 눌리지 않고 다음 바퀴에 다시)
    await page.evaluate(() => {
      const choice = document.querySelector('[data-testid="choice-panel"] button[data-testid^="choice-"]') as HTMLElement | null;
      const skip = document.querySelector('[data-testid="skip"]') as HTMLElement | null;
      (choice ?? skip)?.click();
    });
    await settleDash(page);
  }
  await expect(page.getByTestId('log-jump'), '알약이 떴다').toHaveCount(1);
  await expect(page.getByTestId('choice-panel'), '결정 시트가 닫혀 있다').toHaveCount(0);
  await expect(page.getByTestId('life-name'), '시트가 닫히면 포커스는 인생 화면으로 돌아온다').toBeFocused();
}

/** 50세 대시보드 + 알약 */
async function openDashWithJumpPill(page: Page): Promise<void> {
  await openM4Screen(page, 'dash-adult');
  await ensureJumpPill(page);
}

for (const vpName of ['320x568', '360x740-touch', '1280x800', '640x400-zoom200']) {
  const vp = STANDARD_VIEWPORTS.find((v) => v.name === vpName)!;
  test.describe(`R-438 알약이 떠 있는 대시보드 포커스 가림 없음 ${vp.name}`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height }, hasTouch: vp.touch === true });

    for (const percent of [100, 200] as const) {
      test(`${vp.name} · 글자 ${percent}% · 알약 표시: Tab·Shift+Tab 전체 순회·프로그램 focus()에서 가려진 포커스 0이고 알약(log-jump)이 순회에 든다 (CM10, R-438)`, async ({ page }, testInfo) => {
        test.skip(testInfo.project.name !== 'mobile-360', '뷰포트를 직접 지정하므로 mobile-360에서만 실행');
        test.setTimeout(240_000);
        await openDashWithJumpPill(page);
        if (percent !== 100) await setRootFontPercent(page, percent);
        await settleDash(page);
        // SPEC-010 이후 인생 기록 안에 「근거 보기」 단추가 줄마다 있다(50세 판 38개). 첫 단추에 포커스가 가면 브라우저가 기록을 맨 위로 끌어 올리고, 기록이 맨 위에 닿으면 알약은 **앱 설계대로** 사라진다(logOrder.isAtLogTop).
        // 그래서 ① 순회마다 알약이 뜬 상태에서 시작하게 되돌리고(restore) ② 알약은 순회 도중 사라져도 되되 **실제로 문서에서 사라졌을 때만** 허용한다(mayVanish). 알약이 Shift+Tab 순서에서 단추 바로 앞인지는 아래에서 따로 본다.
        const audit = await auditFocus(page, `${vp.name}/${percent}%/dash-adult+알약`, {
          headingTestId: 'life-name',
          mayVanish: ['log-jump'],
          restore: async () => {
            await ensureJumpPill(page);
            await settleDash(page);
          },
        });
        expect(audit.violations, summarize(audit)).toEqual([]);
        // mayVanish(알약은 순회 도중 사라져도 된다)가 「프로그램 focus()로 알약을 재는 일」까지 건너뛰게 두지 않는다 — 알약은 첫 「근거 보기」 단추보다 앞이라 그 칸에서는 아직 떠 있다
        expect(audit.programmatic.map((s) => s.id), '프로그램 focus()로 알약을 쟀다').toContain('log-jump');
        for (const id of ['pause', 'skip', 'auto', 'tool-exit', 'log-list', 'log-jump']) {
          expect(audit.tabbables, `조작 요소 ${audit.tabbables.join(' → ')}`).toContain(id);
          expect(audit.forward.map((s) => s.id), `Tab 순회 ${id}`).toContain(id);
          // 알약은 첫 「근거 보기」 단추에 닿으면 사라지므로 뒤로 한 바퀴에는 못 든다 — 아래의 「알약 바로 뒤에서 Shift+Tab」이 대신 본다
          if (id !== 'log-jump') expect(audit.backward.map((s) => s.id), `Shift+Tab 순회 ${id}`).toContain(id);
        }
        // 키보드 순서: 인생 기록 영역 다음이 알약이다(스크롤 영역 안, 줄 목록 앞)
        const order = audit.forward.map((s) => s.id);
        expect(order.indexOf('log-jump'), '알약은 영역 바로 다음').toBe(order.indexOf('log-list') + 1);
        // 뒤로 순서: 알약 바로 뒤의 첫 「근거 보기」 단추에 **스크롤 없이** 포커스를 주고(기록이 맨 위로 끌리면 알약이 사라진다) Shift+Tab — 알약에 닿고 가려지지 않는다
        await ensureJumpPill(page);
        await settleDash(page);
        await page.keyboard.press('Shift');
        await page.getByTestId('why-btn').first().evaluate((el) => (el as HTMLElement).focus({ preventScroll: true }));
        await page.keyboard.press('Shift+Tab');
        await expect(page.getByTestId('log-jump'), '첫 「근거 보기」 단추에서 Shift+Tab → 알약').toBeFocused();
        const pillStop = await sampleFocus(page);
        expect(pillStop.judgement.violations, '알약 포커스(Shift+Tab으로 도착)').toEqual([]);
      });
    }
  });
}
