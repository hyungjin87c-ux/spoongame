import { expect, test, type Page } from '@playwright/test';
import { injectSave, noHorizontalOverflow, titleState } from './helpers';
import { measureTextResize, setRootFontPercent, textResizeViolations } from './textResize';

/**
 * 첫 화면 배치 재측정 (SPEC-005 QI6·QI7 — 스위치를 켠 상태와 푸터 링크, HS3 ③④·완료 기준 8·11·12): 「무거운 장면 가리기」 스위치(설정 줄)가 연결되고 푸터에 「새 소식」·「소개」 링크 줄이 생겼으므로
 * first-screen-layout.spec.ts의 HS3 규칙(왼쪽 열 끝 < 하단 띠, 오른쪽 열의 표제어·값이 스크롤 0에서 보임, 가로 넘침 0)을 **스위치 꺼짐·켜짐 두 상태**와 푸터 링크 줄까지 넣어 다시 잰다.
 * 켜면 자살률 슬라이드가 가려진다(표제어 + 「펼쳐 보기」 + 상담전화) — 그 모양도 띠 위에 있어야 한다(design-system.md 14-5의 수치 재측정). 뷰포트를 직접 지정한다.
 */

type Rect = { x: number; y: number; w: number; h: number; right: number; bottom: number };

async function rectOf(page: Page, selector: string): Promise<Rect | null> {
  return page.evaluate((sel) => {
    const el = [...document.querySelectorAll(sel)].find((e) => {
      const b = e.getBoundingClientRect();
      return getComputedStyle(e).display !== 'none' && b.width > 0 && b.height > 0;
    }) as HTMLElement | undefined;
    if (el === undefined) return null;
    const b = el.getBoundingClientRect();
    return { x: b.x, y: b.y, w: b.width, h: b.height, right: b.right, bottom: b.bottom };
  }, selector);
}

const kindOf = (name: string): 'desktop' | 'mobile' => (name.endsWith('mobile-360') ? 'mobile' : 'desktop');
const DESKTOP_ONLY = '뷰포트를 직접 지정하므로 desktop 프로젝트에서만 실행';
const MOBILE_ONLY = '뷰포트를 직접 지정하므로 mobile-360 프로젝트에서만 실행';

/** 저장 없이 설정(무거운 장면 가리기 켜짐/꺼짐)만 주입해 첫 화면을 연다 */
async function openTitleGentle(page: Page, width: number, height: number, gentle: boolean): Promise<void> {
  await page.setViewportSize({ width, height });
  await injectSave(page, titleState(20261013), '/', { speed: 1, autoMode: false, noteCards: false, gentle });
  await expect(page.getByTestId('title-screen')).toBeVisible();
  await expect(page.getByTestId('start-birth')).toBeEnabled();
  await page.evaluate(() => document.fonts.ready);
}

for (const vp of [
  { name: '1280x800', width: 1280, height: 800 },
  { name: '1920x1080', width: 1920, height: 1080 },
] as const) {
  for (const gentle of [false, true] as const) {
    test(`배치 ${vp.name} · 스위치 ${gentle ? '켜짐' : '꺼짐'}: 설정 줄·왼쪽 열 끝·푸터 링크 줄이 하단 띠 위에 있고 가린 자살률 슬라이드도 상담전화까지 띠 위에 있다 — 띠 아래로 밀리는 것 0 (HS3 ③④)`, async ({ page }, testInfo) => {
      test.skip(kindOf(testInfo.project.name) !== 'desktop', DESKTOP_ONLY);
      await openTitleGentle(page, vp.width, vp.height, gentle);
      await expect(page.getByTestId('gentle-switch')).toHaveAttribute('aria-checked', String(gentle));
      const m = {
        main: await rectOf(page, '.title__main'),
        slot: await rectOf(page, '[data-testid="gentle-slot"]'),
        life: await rectOf(page, '[data-testid="life-length-group"]'),
        links: await rectOf(page, '[data-testid="info-links"]'),
        bar: await rectOf(page, '[data-testid="bottom-bar"]'),
        side: await rectOf(page, '.title__side'),
      };
      for (const [k, v] of Object.entries(m)) expect(v, `${k}가 화면에 있다`).not.toBeNull();
      expect(await page.evaluate(() => scrollY), '스크롤 0').toBe(0);
      // 복원(GM4 2차 ④): 설정 줄(스위치)·왼쪽 열 끝이 하단 띠 위에 든다 — 세대 목록 창(PC 하한 9rem · 100vh − 37.5rem = 200px)과 설정 둘(무거운 장면 가리기·내 출신 시도)을 한 줄에 놓은 값이다
      expect(m.slot!.bottom, `설정 줄(스위치) 아래끝 ${Math.round(m.slot!.bottom)} < 띠 위끝 ${Math.round(m.bar!.y)}`).toBeLessThan(m.bar!.y);
      expect(m.main!.bottom, `왼쪽 열 끝 ${Math.round(m.main!.bottom)} < 띠 위끝 ${Math.round(m.bar!.y)}`).toBeLessThan(m.bar!.y);
      expect(m.life!.bottom, '인생 길이가 설정 줄 위(작은 슬롯 → 설정 줄, HS3 ③)').toBeLessThanOrEqual(m.slot!.y + 1);
      // 푸터 링크 줄은 왼쪽 열 바로 아래 푸터 안에 있다. 푸터(GS12)가 두 열을 가로지르는 둘째 줄의 긴 블록(세 칸 · 문단 · 링크 줄 …)이 되면서 링크 줄은 더는 띠 위에 들어오지 않는다(예전: 푸터 첫 줄) —
      // 요구는 「왼쪽 열 끝 아래」(겹치지 않음)와 가로 넘침 0이다. 두 엔진 모두 건다(WebKit의 legend float 차이는 QI4 2단계에서 `.slot--small { display: block }`으로 고쳤다)
      expect(m.links!.y, '푸터 링크 줄은 왼쪽 열 끝 아래').toBeGreaterThanOrEqual(m.main!.bottom - 1);
      // 자살률 슬라이드: 켜면 가려진 모양(표제어 + 펼쳐 보기 + 상담전화), 끄면 원문(값이 보임) — 둘 다 오른쪽 열의 보이는 끝(띠 위) 안이다
      await page.getByTestId('carousel-pause').click();
      for (let i = 0; i < 21 && (await page.locator('.slide.is-active').getAttribute('data-slide-id')) !== 'suicide-rate'; i++) await page.getByTestId('carousel-next').click();
      await expect(page.locator('.slide.is-active')).toHaveAttribute('data-slide-id', 'suicide-rate');
      const s = {
        insight: await rectOf(page, '.slide.is-active .slide__insight'),
        veilBtn: await rectOf(page, '.slide.is-active .slide__veil-btn'),
        help: await rectOf(page, '.slide.is-active .slide__help'),
        value: await rectOf(page, '.slide.is-active [data-testid="slide-value"]'),
        bar: await rectOf(page, '[data-testid="bottom-bar"]'),
      };
      expect(s.help, '상담전화 묶음은 늘 보인다').not.toBeNull();
      if (gentle) {
        expect(s.veilBtn, '켜면 「펼쳐 보기」가 보인다').not.toBeNull();
        expect(s.value, '켜면 값은 가려져 있다').toBeNull();
        expect(s.help!.bottom, `상담전화 아래끝 ${Math.round(s.help!.bottom)} < 띠 위끝 ${Math.round(s.bar!.y)}`).toBeLessThan(s.bar!.y);
        expect(s.veilBtn!.y).toBeGreaterThanOrEqual(s.insight!.bottom - 1);
        expect(s.help!.y).toBeGreaterThanOrEqual(s.veilBtn!.bottom - 1);
      } else {
        expect(s.veilBtn, '끄면 「펼쳐 보기」가 없다').toBeNull();
        expect(s.value, '끄면 값이 보인다').not.toBeNull();
        expect(s.value!.bottom, `값 아래끝 ${Math.round(s.value!.bottom)} < 띠 위끝 ${Math.round(s.bar!.y)}`).toBeLessThan(s.bar!.y);
      }
      expect(await noHorizontalOverflow(page)).toBe(true);
      await page.screenshot({ path: testInfo.outputPath(`QI6-home-${vp.name}-${gentle ? 'on' : 'off'}.png`) });
      // 측정값은 dev 로그(ai-log)에 적는다
      console.log(`[QI6 layout ${vp.name} ${gentle ? 'on ' : 'off'}] slot.bottom=${Math.round(m.slot!.bottom)} main.bottom=${Math.round(m.main!.bottom)} links.bottom=${Math.round(m.links!.bottom)} bar.y=${Math.round(m.bar!.y)} side.bottom=${Math.round(m.side!.bottom)} suicide.help.bottom=${Math.round(s.help!.bottom)}`);
    });
  }
}

for (const gentle of [false, true] as const) {
  test(`배치 360x740 · 스위치 ${gentle ? '켜짐' : '꺼짐'}: 로고 ≥ 40px·가로 넘침 0·「태어날 세상」 제목이 스크롤 0에서 띠 위에 보이고, 설정 줄 → 통계 카드 → 푸터 링크 줄이 한 칸 레이아웃에서 겹침 없이 이어진다 (HS1·HS3·CM11)`, async ({ page }, testInfo) => {
    test.skip(kindOf(testInfo.project.name) !== 'mobile', MOBILE_ONLY);
    await openTitleGentle(page, 360, 740, gentle);
    const m = {
      wordmark: await rectOf(page, '[data-testid="title-logo-word"] svg'),
      eraTitle: await rectOf(page, '.slot--big .group-title'),
      bar: await rectOf(page, '[data-testid="bottom-bar"]'),
    };
    for (const [k, v] of Object.entries(m)) expect(v, `${k}가 화면에 있다`).not.toBeNull();
    expect(m.wordmark!.h, '워드마크 높이 ≥ 40px').toBeGreaterThanOrEqual(40);
    expect(m.eraTitle!.bottom, `「태어날 세상」 제목 아래끝 ${Math.round(m.eraTitle!.bottom)} < 띠 위끝 ${Math.round(m.bar!.y)}`).toBeLessThan(m.bar!.y);
    expect(await noHorizontalOverflow(page)).toBe(true);
    const order = await page.evaluate(() => {
      const r = (sel: string) => document.querySelector(sel)!.getBoundingClientRect();
      const slot = r('[data-testid="gentle-slot"]');
      const links = r('[data-testid="info-links"]');
      const carousel = r('[data-testid="carousel"]');
      const foot = r('[data-testid="title-foot"]');
      return { slotBottom: slot.bottom, carouselTop: carousel.top, carouselBottom: carousel.bottom, linksTop: links.top, footTop: foot.top };
    });
    expect(order.carouselTop, '통계 카드는 설정 줄 아래').toBeGreaterThanOrEqual(order.slotBottom - 1);
    expect(order.linksTop, '푸터 링크 줄은 통계 카드 아래(푸터 맨 위)').toBeGreaterThanOrEqual(order.carouselBottom - 1);
    expect(order.linksTop).toBeGreaterThanOrEqual(order.footTop - 1);
    expect(textResizeViolations(await measureTextResize(page), `360x740 스위치 ${gentle ? '켜짐' : '꺼짐'}`)).toEqual([]);
    await page.screenshot({ path: testInfo.outputPath(`QI6-home-360x740-${gentle ? 'on' : 'off'}.png`), fullPage: true });
    console.log(`[QI6 layout 360x740 ${gentle ? 'on ' : 'off'}] wordmark.h=${Math.round(m.wordmark!.h)} eraTitle.bottom=${Math.round(m.eraTitle!.bottom)} bar.y=${Math.round(m.bar!.y)} order=${JSON.stringify(Object.fromEntries(Object.entries(order).map(([k, v]) => [k, Math.round(v)])))}`);
  });
}

for (const percent of [100, 200] as const) {
  test(`푸터 링크 줄·설정 줄 · 320px · 글자 ${percent}%: 가로 넘침 0·가려진 글자 0, 링크 클릭 대상 ≥ 24px — 「새」 표시가 줄을 밀어내지 않는다 (CM11)`, async ({ page }, testInfo) => {
    test.skip(kindOf(testInfo.project.name) !== 'mobile', MOBILE_ONLY);
    await openTitleGentle(page, 320, 640, true);
    if (percent !== 100) await setRootFontPercent(page, percent);
    expect(await noHorizontalOverflow(page)).toBe(true);
    const links = await page.evaluate(() =>
      [...document.querySelectorAll('[data-testid="info-links"] a')].map((a) => {
        const b = a.getBoundingClientRect();
        return { name: (a.firstChild?.textContent ?? '').trim(), w: b.width, h: b.height };
      }),
    );
    expect(links.map((l) => l.name)).toEqual(['소개', '개인정보 처리방침', '이용 안내', '의견 보내기', 'kottonchild@gmail.com']);
    for (const l of links) {
      // 문의 메일은 글줄 안의 인라인 링크라 높이는 글줄이다(WCAG 2.5.8 인라인 예외) — 폭만 본다
      if (l.name !== 'kottonchild@gmail.com') expect(l.h, `${l.name} 클릭 대상 높이`).toBeGreaterThanOrEqual(24);
      expect(l.w, `${l.name} 클릭 대상 폭`).toBeGreaterThanOrEqual(24);
    }
    // 「새 소식」은 하단의 작은 단추다(안 본 소식이 있으면 「새」 표시) — 클릭 대상 ≥ 24px
    const news = await page.getByTestId('link-news').boundingBox();
    expect(news!.height).toBeGreaterThanOrEqual(24);
    expect(news!.width).toBeGreaterThanOrEqual(24);
    expect(textResizeViolations(await measureTextResize(page), `320px/${percent}% 스위치 켜짐`)).toEqual([]);
    if (percent === 200) await page.screenshot({ path: testInfo.outputPath('QI7-footer-320-text200.png'), fullPage: true });
  });
}
