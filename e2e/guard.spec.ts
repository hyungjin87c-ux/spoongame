import { expect, test } from '@playwright/test';

/**
 * R-029: 같은 버튼 요소에서 guardKey만 바뀌는 경우의 실제 DOM 동작.
 * 하니스(harness/guard.html)는 개발 서버 전용이며, 인생 화면에서 다음 선택지가 같은 자리에 뜨는 상황과 같다.
 */
test.describe('GuardedButton: guardKey만 바뀌는 같은 버튼 (R-029)', () => {
  test('키가 바뀐 직후의 클릭은 무시되고, 가드 시간이 지나면 다시 눌린다 (키가 문자열→문자열→숫자로 바뀌어도)', async ({ page }) => {
    await page.goto('/harness/guard.html');
    const guarded = page.getByTestId('guarded');
    const clicks = page.getByTestId('clicks');
    const bump = page.getByTestId('bump');

    // 첫 마운트: 가드가 풀릴 때까지 기다린 뒤 누르면 기록된다
    await expect(guarded).toBeEnabled();
    await guarded.click();
    await expect(clicks).toHaveText('A');

    for (const next of ['B', '3']) {
      const before = await clicks.innerText();
      // 같은 JS 작업 안에서 키를 바꾸고 곧바로 누른다 → 시간이 끼어들 수 없어 결정적이다.
      const r = await page.evaluate(async () => {
        const q = (id: string) => document.querySelector<HTMLElement>(`[data-testid="${id}"]`)!;
        const button = q('guarded');
        q('bump').click();
        // React가 이벤트 직후(마이크로태스크)에 다시 그린다.
        for (let n = 0; n < 50; n++) await Promise.resolve();
        const sameElement = q('guarded') === button;
        const disabledRightAfter = q('guarded').getAttribute('aria-disabled') === 'true';
        q('guarded').click();
        for (let n = 0; n < 50; n++) await Promise.resolve();
        return { key: q('key').textContent, sameElement, disabledRightAfter, clicks: q('clicks').textContent };
      });
      expect(r.key).toBe(next);
      expect(r.sameElement, '버튼 요소가 재사용됐다(언마운트 없이 키만 바뀜)').toBe(true);
      expect(r.disabledRightAfter, '키가 바뀐 그 렌더에서 즉시 닫힌다').toBe(true);
      expect(r.clicks, '키가 바뀐 직후의 클릭은 기록되지 않는다').toBe(before);

      await expect(guarded).toBeEnabled(); // ms 뒤에 다시 열린다
      await guarded.click();
      await expect(clicks).toHaveText(`${before},${next}`);
    }
    // 바뀐 키마다 정확히 한 번씩만 기록됐다(연타가 새 키로 새어 들어가지 않았다)
    await expect(clicks).toHaveText('A,B,3');
    await expect(bump).toBeEnabled(); // bump는 가드 대상이 아니다
  });

  test('연타: 키가 바뀐 직후 같은 자리를 빠르게 여러 번 눌러도 한 번도 기록되지 않는다', async ({ page }) => {
    await page.goto('/harness/guard.html');
    const guarded = page.getByTestId('guarded');
    await expect(guarded).toBeEnabled();
    const result = await page.evaluate(async () => {
      const q = (id: string) => document.querySelector<HTMLElement>(`[data-testid="${id}"]`)!;
      q('bump').click();
      for (let n = 0; n < 50; n++) await Promise.resolve();
      for (let i = 0; i < 5; i++) q('guarded').click();
      for (let n = 0; n < 50; n++) await Promise.resolve();
      return q('clicks').textContent;
    });
    expect(result).toBe('');
    await expect(guarded).toBeEnabled();
    await guarded.click();
    await expect(page.getByTestId('clicks')).toHaveText('B');
  });

  test('대조군: 가드를 끄면(?__guard=0) 키가 바뀐 직후의 클릭도 기록된다 — 위 테스트가 가드를 실제로 가른다는 증거', async ({ page }) => {
    await page.goto('/harness/guard.html?__guard=0');
    const result = await page.evaluate(async () => {
      const q = (id: string) => document.querySelector<HTMLElement>(`[data-testid="${id}"]`)!;
      q('bump').click();
      for (let n = 0; n < 50; n++) await Promise.resolve();
      q('guarded').click();
      for (let n = 0; n < 50; n++) await Promise.resolve();
      return q('clicks').textContent;
    });
    expect(result).toBe('B');
  });
});

/**
 * R-036: 호출자가 aria-disabled를 넘기는 GuardedButton("held")과 가드의 합 — 가드 × 호출자 비활성의 4칸 진리표를 실제 DOM에서 본다.
 * 비활성이면(어느 쪽이든) aria-disabled="true", 클릭·Enter·Space 모두 무시, 그래도 포커스는 받고(disabled 속성 아님) Tab 순서에 남는다.
 * 가드가 풀려도 호출자 비활성은 유지되고, 호출자가 풀어 주면 그때부터 눌린다. (held는 guarded와 같은 키 → guarded가 활성화되면 held의 가드도 풀린 것이다.)
 */
test.describe('GuardedButton: 호출자 aria-disabled × 가드 (R-036)', () => {
  test('가드 닫힘/열림 × 호출자 비활성/활성 4칸 진리표: 클릭·Enter·Space 반영 여부, 포커스·Tab 순서 유지', async ({ page }) => {
    await page.goto('/harness/guard.html');
    const held = page.getByTestId('held');
    const heldClicks = page.getByTestId('held-clicks');
    const guarded = page.getByTestId('guarded');
    const toggle = page.getByTestId('toggle-held');

    /** 같은 JS 작업 안에서 가드를 닫고(키 바꾸기) 곧바로 상태를 읽고 클릭해 본다 → 시간이 끼어들 수 없다 */
    const closeGuardAndProbe = () =>
      page.evaluate(async () => {
        const q = (id: string) => document.querySelector<HTMLButtonElement>(`[data-testid="${id}"]`)!;
        q('bump').click();
        for (let n = 0; n < 50; n++) await Promise.resolve();
        const before = q('held-clicks').textContent;
        const ariaDisabled = q('held').getAttribute('aria-disabled');
        const caller = q('held-state').textContent;
        q('held').click();
        for (let n = 0; n < 50; n++) await Promise.resolve();
        return { caller, ariaDisabled, ignored: q('held-clicks').textContent === before, hasDisabledAttr: q('held').disabled };
      });

    // 가드 닫힘 × 호출자 비활성
    expect(await closeGuardAndProbe()).toEqual({ caller: 'inactive', ariaDisabled: 'true', ignored: true, hasDisabledAttr: false });

    // 가드 닫힘 × 호출자 활성 (호출자가 풀어도 가드가 닫혀 있는 동안은 무시)
    await toggle.click();
    await expect(page.getByTestId('held-state')).toHaveText('active');
    expect(await closeGuardAndProbe()).toEqual({ caller: 'active', ariaDisabled: 'true', ignored: true, hasDisabledAttr: false });

    // 가드 열림 × 호출자 활성: 클릭·Enter·Space가 모두 반영된다
    await expect(guarded).toBeEnabled();
    await expect(held).toBeEnabled();
    expect(await held.getAttribute('aria-disabled')).toBeNull();
    await held.click();
    await expect(heldClicks).toHaveText('1');
    await held.focus();
    await page.keyboard.press('Enter');
    await expect(heldClicks).toHaveText('2');
    await page.keyboard.press('Space');
    await expect(heldClicks).toHaveText('3');

    // 가드 열림 × 호출자 비활성: 가드가 이미 풀려 있어도 aria-disabled="true"가 유지되고, 클릭·Enter·Space 모두 무시된다. 포커스는 받는다
    await toggle.click();
    await expect(page.getByTestId('held-state')).toHaveText('inactive');
    await expect(held).toHaveAttribute('aria-disabled', 'true');
    await expect(held).toBeDisabled(); // Playwright는 aria-disabled=true를 비활성으로 본다
    expect(await held.evaluate((el: HTMLButtonElement) => el.disabled), 'disabled 속성은 쓰지 않는다').toBe(false);
    await held.focus();
    expect(await page.evaluate(() => document.activeElement?.getAttribute('data-testid')), '비활성이어도 포커스를 받는다').toBe('held');
    await page.keyboard.press('Enter');
    await page.keyboard.press('Space');
    await held.evaluate((el: HTMLButtonElement) => el.click());
    await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
    await expect(heldClicks).toHaveText('3');
    expect(await page.evaluate(() => document.activeElement?.getAttribute('data-testid'))).toBe('held'); // 눌러도 포커스는 그대로

    // Tab 순서에 남아 있다: 앞 버튼(토글)에서 Tab 두 번(출력 요소는 건너뜀) 안에 닿는다 — 비활성이어도 순서에서 빠지지 않는다
    await toggle.focus();
    const reached: string[] = [];
    for (let i = 0; i < 4; i++) {
      await page.keyboard.press('Tab');
      reached.push((await page.evaluate(() => document.activeElement?.getAttribute('data-testid'))) ?? '?');
    }
    expect(reached).toContain('held');

    // 호출자가 다시 풀어 주면 그때부터 눌린다
    await toggle.click();
    await expect(held).toBeEnabled();
    await held.click();
    await expect(heldClicks).toHaveText('4');
  });
});
