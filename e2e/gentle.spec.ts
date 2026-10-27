import { expect, test, type Locator, type Page } from '@playwright/test';
import type { GameState } from '../src/core/types';
import { GAME_KEY, activeTestId, evalCore, injectSave, readSave, readSettings, replaceSaveAndReload, titleState } from './helpers';
import { MANUAL, findDelegatedYear } from './parentStates';
import { heavyEnding, heavyLifeState, heavyPending, heavyRowsOf, noteDueState } from './gentleStates';
import { sheetReady } from './m7cStates';

/**
 * 무거운 장면 가리기 (SPEC-005 QI6 HV3·HV4·HV6·HV7·HV8, 완료 기준 11·13, 화면 규칙 (A)·M19·M20): 실제 브라우저에서 본다.
 * 구조·문구·원문이 새지 않는지(서버 렌더)는 tests/gentleScreens.test.tsx, 상태·저장·1000판 불변은 tests/gentle.test.ts가 본다.
 *  · 판 도중 켜고 끄면 지난 줄까지 바로 바뀐다 (화면 규칙 (A)) — 「나가기 → 첫 화면 → 스위치 → 이어서 살기」, 펼침은 설정이 바뀌면 초기화(M19)·저장하지 않는다(SV3)
 *  · 가린 결정 카드(시트·인라인·접힌 띠): 포커스·「펼쳐서 읽기」·「이번에는 자동으로 고르기」·자동 선택 타이머 그대로
 *  · 부모·흘러감 카드·live region·접근성 트리·엔딩 연표와 맨 위 한 줄·첫 화면 자살률 슬라이드·옛 v8 저장의 상속 줄·가려지지 않는 것(HV8)
 * 상태는 개발 서버의 실제 core로 만든다(e2e/gentleStates.ts). 일시정지한 인생을 심어 시간이 흐르지 않게 한 시험이 많다.
 */

test.describe.configure({ timeout: 120_000 });

const GENTLE_ON = { ...MANUAL, gentle: true };

/** 요소 안에서 **화면에 보이는 글자**(`hidden`·`display: none`은 빠진다) */
async function shown(target: Locator): Promise<string> {
  return target.evaluate((el) => (el as HTMLElement).innerText);
}

/** 「나가기 → 첫 화면 → 스위치 → 이어서 살기」: 판 도중 가림 설정을 바꾸는 유일한 길 (copy.md 12-7) */
async function setGentleViaTitle(page: Page, on: boolean): Promise<void> {
  const exit = page.getByTestId('tool-exit');
  await expect(exit).toBeEnabled();
  await exit.click();
  const yes = page.getByTestId('exit-yes');
  await expect(yes).toBeEnabled();
  await yes.click();
  await expect(page.getByTestId('title-screen')).toBeVisible();
  await expect(page.getByTestId('resume')).toBeEnabled(); // 입력 가드가 풀린 뒤
  const sw = page.getByTestId('gentle-switch');
  if ((await sw.getAttribute('aria-checked')) !== String(on)) await sw.click();
  await expect(sw).toHaveAttribute('aria-checked', String(on));
  await page.getByTestId('resume').click();
  await expect(page.getByTestId('life-screen')).toBeVisible();
}

test.describe('화면 규칙 (A): 지금의 설정값으로 지난 줄까지 가린다 (HV3·R-475)', () => {
  test('판 도중 켜고 끄면 지난 줄까지 바로 바뀐다 (화면 규칙 (A)): 끈 상태 원문 → 켜면 모두 가림 → 펼침 → 끄면 모두 원문 → 다시 켜면 펼쳐 둔 줄도 다시 가려진다 (M19)', async ({ page }) => {
    await page.goto('/');
    const game = await heavyLifeState(page);
    const rows = await heavyRowsOf(page, game);
    expect(rows.length).toBeGreaterThanOrEqual(4);
    await injectSave(page, game, '/', { ...MANUAL, gentle: false });
    const log = page.getByTestId('log');
    await expect(page.getByTestId('life-screen')).toBeVisible();

    // 1. 끈 상태(기본): 모든 줄이 원문이고 가림 부품이 없다
    await expect(log.locator('[data-veiled]')).toHaveCount(0);
    for (const r of rows) await expect(log).toContainText(r.text, { useInnerText: true });
    expect(await page.evaluate((k) => (JSON.parse(localStorage.getItem(k)!).data as GameState).gentleUsed, GAME_KEY)).toBeUndefined();

    // 2. 켜기: 지난 줄까지 모든 무거운 줄이 가려진다 — 가린 줄의 수 = 무거운 줄의 수, 원문은 보이지 않는다
    await setGentleViaTitle(page, true);
    await expect(log.locator('[data-veiled="true"]')).toHaveCount(rows.length);
    const veiledText = await shown(log);
    for (const r of rows) {
      expect(veiledText, `${r.age}세 ${r.heavyKind}: 문장`).not.toContain(r.text);
      if (r.choice !== null) expect(veiledText, `${r.age}세: 고른 길`).not.toContain(r.choice);
    }
    expect(veiledText).toContain('무거운 일이 있었습니다');
    // 가려진 상태가 저장에 남지 않았다: 줄마다 가렸는지는 저장하지 않는다 — 판에는 gentleUsed만(참), 설정에는 gentle
    const save = (await readSave(page)).data;
    expect(save.gentleUsed).toBe(true);
    expect(JSON.stringify(save.history)).not.toMatch(/veil|heavy|gentle/i);
    expect((await readSettings(page)).gentle).toBe(true);

    // 3. 펼치기: 「펼쳐 보기」가 aria-expanded=true가 되고 원문이 보인다 — 같은 줄을 다시 누르면 접힌다
    const first = log.getByTestId('veil-btn').first();
    await expect(first).toHaveAttribute('aria-expanded', 'false');
    await first.click();
    await expect(first).toHaveAttribute('aria-expanded', 'true');
    await expect(first).toContainText('접기');
    const openRow = log.locator('[data-veiled="true"]').first();
    await expect(openRow.getByTestId('veil-body')).toBeVisible();
    const openedText = await shown(openRow);
    expect(rows.some((r) => openedText.includes(r.text)), '펼친 줄에는 그 줄의 원문이 보인다').toBe(true);
    await first.click();
    await expect(first).toHaveAttribute('aria-expanded', 'false');
    await expect(openRow.getByTestId('veil-body')).toBeHidden();
    await first.click(); // 다시 펼친 채로 두고 설정을 바꾼다
    await expect(first).toHaveAttribute('aria-expanded', 'true');

    // 4. 끄기: 지난 줄까지 모두 원문이 된다 (펼친 줄·접힌 줄 구분 없이)
    await setGentleViaTitle(page, false);
    await expect(log.locator('[data-veiled]')).toHaveCount(0);
    for (const r of rows) await expect(log).toContainText(r.text, { useInnerText: true });
    expect((await readSettings(page)).gentle).toBe(false);
    expect((await readSave(page)).data.gentleUsed, '켜고 나서 꺼도 판의 기록은 참').toBe(true);

    // 5. 다시 켜기: 그 전에 펼쳐 둔 줄도 다시 가려진다 (M19 — 설정이 바뀌면 펼침 초기화)
    await setGentleViaTitle(page, true);
    await expect(log.locator('[data-veiled="true"]')).toHaveCount(rows.length);
    for (const b of await log.getByTestId('veil-btn').all()) await expect(b).toHaveAttribute('aria-expanded', 'false');
    expect(await shown(log)).not.toContain(rows[0].text);

    // 6. 새로고침: 설정(gentle)은 남아 가림이 이어지고 펼침은 저장하지 않으므로 다시 가려진다 (SV3)
    await log.getByTestId('veil-btn').nth(1).click();
    await expect(log.getByTestId('veil-btn').nth(1)).toHaveAttribute('aria-expanded', 'true');
    await page.reload();
    await expect(page.getByTestId('life-screen')).toBeVisible();
    await expect(page.getByTestId('log').locator('[data-veiled="true"]')).toHaveCount(rows.length);
    for (const b of await page.getByTestId('log').getByTestId('veil-btn').all()) await expect(b).toHaveAttribute('aria-expanded', 'false');
  });

  test('키보드: 「펼쳐 보기」는 Tab으로 닿고 Enter·Space로 펼쳐지며 접근 가능한 이름은 「펼쳐 보기 {나이}세 {분류}」다 · 접근성 트리에 원문이 없다 (HV4 접근성)', async ({ page }) => {
    await page.goto('/');
    const game = await heavyLifeState(page);
    const rows = await heavyRowsOf(page, game);
    await injectSave(page, game, '/', GENTLE_ON);
    const list = page.getByTestId('log-list');
    const btn = list.getByTestId('veil-btn').first();
    const label = (await btn.getAttribute('aria-label'))!;
    expect(label).toMatch(/^펼쳐 보기 \d+세 (집안 사정|또래 사이|건강|돌봄과 이별|멀어진 사이|일과 생계)$/);
    // 접근성 트리: 가린 줄은 안내 + 버튼(이름)만 있고 원문은 없다
    const tree = await list.ariaSnapshot();
    for (const r of rows) expect(tree, `${r.age}세: 접근성 트리에 원문이 새지 않는다`).not.toContain(r.text);
    expect(tree).toContain('무거운 일이 있었습니다');
    expect(tree).toContain(label);
    // 키보드: 버튼에 닿아 Enter로 펼치고 Space로 접는다
    await btn.focus();
    expect(await activeTestId(page)).toBe('veil-btn');
    await page.keyboard.press('Enter');
    await expect(btn).toHaveAttribute('aria-expanded', 'true');
    await expect(btn).toHaveAttribute('aria-label', label.replace('펼쳐 보기', '접기'));
    await page.keyboard.press('Space');
    await expect(btn).toHaveAttribute('aria-expanded', 'false');
    // Tab으로 다음 가린 줄의 버튼에 닿는다 (버튼은 줄마다 한 개, 읽는 순서 = 화면 순서)
    await page.keyboard.press('Tab');
    expect(await activeTestId(page)).toBe('veil-btn');
    // 펼친 뒤 접근성 트리에는 그 줄의 원문이 들어온다
    await page.keyboard.press('Enter');
    expect(await list.ariaSnapshot()).toContain('접기');
    // live region은 그대로다: polite + additions (펼치기는 hidden 토글이라 「추가」로 다시 읽히지 않는다)
    await expect(list.locator('ol')).toHaveAttribute('aria-live', 'polite');
    await expect(list.locator('ol')).toHaveAttribute('aria-relevant', 'additions');
  });

  test('옛 v8 저장(표지 필드가 없는 이 변경 이전의 저장)의 상속 줄도 켜면 가려진다 (M20) — 필드 없는 줄을 상수로 잡는다', async ({ page }) => {
    await page.goto('/');
    // 이 변경 이전의 v8 저장과 같은 모양: 엔진이 만든 그대로의 판(표지·gentleUsed 필드가 없다 — 단위 시험 tests/gentle.test.ts는 이전에 저장된 표본 파일 tests/fixtures/saveV8Inherit.json으로도 같은 일을 본다)
    const base = await heavyLifeState(page);
    const legacy = { version: 8, data: base };
    expect(JSON.stringify(legacy)).not.toMatch(/gentleUsed|heavy|veil/);
    await injectSave(page, { ...legacy.data, paused: true }, '/', GENTLE_ON);
    const log = page.getByTestId('log');
    await expect(page.getByTestId('life-screen')).toBeVisible();
    const inherit = '부모님이 남기신 재산을 물려받았습니다.';
    await expect(log.locator('[data-veiled="true"]')).not.toHaveCount(0);
    expect(await shown(log)).not.toContain(inherit);
    // 상속 줄은 「돌봄과 이별」로 가려진 줄 안에 있다 (hidden 원문)
    const inheritRow = log.locator('[data-veiled="true"]', { has: page.locator('.veil__body', { hasText: inherit }) });
    await expect(inheritRow).toHaveCount(1);
    await expect(inheritRow).toContainText('돌봄과 이별');
    await inheritRow.getByTestId('veil-btn').click();
    await expect(inheritRow.getByTestId('veil-body')).toContainText(inherit, { useInnerText: true });
    // 끄면 원문 그대로 (켜 둔 설정을 인생 화면에서는 바꿀 수 없으므로 저장을 바꿔 연다)
    await replaceSaveAndReload(page, { ...legacy.data, paused: true }, { ...MANUAL, gentle: false }); // 앱이 떠 있는 페이지의 저장만 바꿔 새로고침한다(injectSave를 한 시험에서 두 번 쓰면 둘째는 앱이 뜨기 전에 storage 이벤트를 보내 WebKit에서 밀린다)
    await expect(page.getByTestId('log')).toContainText(inherit, { useInnerText: true });
    await expect(page.getByTestId('log').locator('[data-veiled]')).toHaveCount(0);
  });
});

test.describe('가린 결정 카드 (HV4 ②⑤, 접근성 확인 사항 (a)(b))', () => {
  const TITLE = '정리 대상이 된 아침'; // middle-layoff

  async function layoffOracle(page: Page, game: GameState): Promise<{ title: string; text: string; labels: string[]; chosenLabel: string; chosenId: string }> {
    return evalCore(
      page,
      `const mod = await import('/src/data/events/index.ts');
       const ev = mod.EVENT_POOL.byId.get(arg.state.pending.eventId);
       const w = core.autoChoiceWeights(arg.state);
       const id = w.ids[core.createRng(arg.state.rngState).weightedIndex(w.weights)];
       return { title: ev.title, text: ev.text, labels: ev.choices.map((c) => c.label), chosenId: id, chosenLabel: ev.choices.find((c) => c.id === id).label };`,
      { state: game },
    );
  }

  test('시트: 제목 자리에 「무거운 주제 · {분류}」, 안내 한 줄, 버튼 둘만 보이고 상황·선택지·영향 줄이 없다 · 포커스는 제목 · 접기 → 다시 열기도 가림 그대로 · 「펼쳐서 읽기」 뒤 포커스는 제목(원문) · 새로고침하면 다시 가림', async ({ page }) => {
    await page.goto('/');
    const game = await heavyPending(page, 'middle-layoff');
    const o = await layoffOracle(page, game);
    expect(o.title).toBe(TITLE);
    await injectSave(page, game, '/', GENTLE_ON);
    const sheet = page.getByTestId('choice-panel');
    await expect(sheet).toBeVisible();
    await expect(sheet).toHaveAttribute('data-veiled', 'true');
    await expect(sheet).toHaveAttribute('data-mode', 'sheet');
    await expect(page.getByTestId('choice-title')).toHaveText('무거운 주제 · 일과 생계');
    await expect.poll(() => activeTestId(page)).toBe('choice-title'); // 포커스 표 그대로 — 대화상자 이름도 이 제목이다
    // 보이는 글자에 원문이 없다
    const body = await shown(page.locator('body'));
    for (const t of [o.title, o.text, ...o.labels]) expect(body, t).not.toContain(t);
    // 가린 결정 카드도 「결정할 일이 있다」는 사실과 버튼 둘은 보인다
    await expect(page.getByTestId('veil-note')).toHaveText(/결정할 일이 있습니다/);
    await expect(page.getByTestId('veil-open')).toHaveText('펼쳐서 읽기');
    await expect(page.getByTestId('veil-auto')).toHaveText('이번에는 자동으로 고르기');
    expect(await sheet.locator('.choice').count(), '선택지 버튼 없음').toBe(0);
    expect(await sheet.locator('[data-testid="impact"], [data-testid="cite"], [data-testid="choice-text"]').count()).toBe(0);
    // 대화상자 이름 = 분류 문구 (aria-labelledby=dc-title)
    expect(await sheet.evaluate((el) => document.getElementById(el.getAttribute('aria-labelledby')!)!.textContent)).toBe('무거운 주제 · 일과 생계');
    // 접기(Esc) → 접힌 띠의 제목도 분류 문구 → 다시 열기: 여전히 가려져 있다
    await page.keyboard.press('Escape');
    const fold = page.getByTestId('decision-fold');
    await expect(fold).toBeVisible();
    await expect(page.getByTestId('decision-fold-title')).toHaveText('무거운 주제 · 일과 생계');
    expect(await shown(page.locator('body'))).not.toContain(o.title);
    await expect(page.getByTestId('decision-reopen')).toBeEnabled();
    await page.getByTestId('decision-reopen').click();
    await expect(page.getByTestId('choice-title')).toHaveText('무거운 주제 · 일과 생계');
    // 펼쳐서 읽기: 원래 카드(제목·상황·선택지·영향 안내)가 되고 포커스는 제목으로
    await expect(page.getByTestId('veil-open')).toBeEnabled();
    await page.getByTestId('veil-open').click();
    await expect(page.getByTestId('choice-title')).toHaveText(o.title);
    await expect(page.getByTestId('choice-text')).toContainText(o.text.slice(0, 10));
    expect(await sheet.locator('.choice').count()).toBeGreaterThanOrEqual(2);
    await expect(sheet).not.toHaveAttribute('data-veiled', 'true');
    await expect.poll(() => activeTestId(page)).toBe('choice-title');
    // 펼침은 카드가 떠 있는 동안만: 접기 → 다시 열기에서는 유지, 새로고침하면 다시 가린다
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('decision-fold-title')).toHaveText(o.title); // 펼친 카드를 접으면 띠 제목도 원문
    await expect(page.getByTestId('decision-reopen')).toBeEnabled();
    await page.getByTestId('decision-reopen').click();
    await expect(page.getByTestId('choice-title')).toHaveText(o.title);
    await page.reload();
    await expect(page.getByTestId('choice-title')).toHaveText('무거운 주제 · 일과 생계');
    await expect(page.getByTestId('choice-panel')).toHaveAttribute('data-veiled', 'true');
  });

  test('「이번에는 자동으로 고르기」: 자동 모드가 꺼져 있어도 지금의 자동 선택 성향으로 고르고 카드가 닫힌다 — 남은 가린 줄을 펼치면 고른 길과 결과가 보인다 · 판의 인생은 수동으로 고른 것과 같다 (R-039)', async ({ page }) => {
    await page.goto('/');
    const game = await heavyPending(page, 'middle-layoff');
    const o = await layoffOracle(page, game);
    await injectSave(page, game, '/', GENTLE_ON);
    await expect(page.getByTestId('choice-panel')).toBeVisible();
    await expect(page.getByTestId('veil-auto')).toBeEnabled();
    await page.getByTestId('veil-auto').click();
    await expect(page.getByTestId('choice-panel')).toHaveCount(0);
    // 저장: 대기가 풀렸고 고른 길은 성향이 고른 선택지다 (그 선택지를 수동으로 고른 것과 같은 기록 줄 — 본인 줄)
    await expect.poll(async () => (await readSave(page)).data.pending).toBeNull();
    const save = (await readSave(page)).data;
    const line = save.history.find((h) => h.kind === 'choice' && h.eventId === 'middle-layoff')!;
    expect(line.choice).toBe(o.chosenLabel);
    expect(line.by, '본인이 고른 줄(by 없음)').toBeUndefined();
    expect(save.gentleUsed).toBe(true);
    // 가린 줄: 원문(고른 길·결과)은 안 보이고, 펼치면 보인다 (자동으로 고른 뒤에도 같은 길)
    const row = page.getByTestId('log').locator('[data-veiled="true"]', { has: page.locator('.veil__body', { hasText: o.chosenLabel }) });
    await expect(row).toHaveCount(1);
    expect(await shown(row)).not.toContain(o.chosenLabel);
    await row.getByTestId('veil-btn').click();
    await expect(row.getByTestId('veil-body')).toContainText(`(선택: ${o.chosenLabel})`, { useInnerText: true });
    // 오라클: 같은 상태에서 그 선택지를 수동으로 고른 인생과 같다 (연표 줄 전체)
    const manual = await evalCore<{ choice: string; text: string }>(
      page,
      `const r = core.resolveChoiceStep(arg.state, arg.state.pending.key, arg.id).state; const h = r.history.find((x) => x.kind === 'choice' && x.eventId === 'middle-layoff'); return { choice: h.choice, text: h.text };`,
      { state: game, id: o.chosenId },
    );
    expect(line.text).toBe(manual.text);
    expect(line.choice).toBe(manual.choice);
  });

  test('인라인(자동 모드 켜짐): 같은 두 버튼과 안내가 보이고 자동 선택 타이머는 그대로 돈다 — 가림은 상태 기계를 바꾸지 않는다', async ({ page }) => {
    await page.goto('/');
    const game = await heavyPending(page, 'middle-layoff');
    await injectSave(page, game, '/', { speed: 1, autoMode: true, noteCards: false, gentle: true });
    const card = page.getByTestId('choice-panel');
    await expect(card).toBeVisible();
    await expect(card).toHaveAttribute('data-mode', 'inline');
    await expect(card).toHaveAttribute('data-veiled', 'true');
    await expect(page.getByTestId('veil-open')).toBeVisible();
    await expect(page.getByTestId('veil-auto')).toBeVisible();
    await expect(page.getByTestId('auto-note')).toHaveText('자동 모드가 켜져 있습니다. 잠시 뒤 성향에 따라 고릅니다.');
    // 타이머가 그대로 돌아(1배속 3초) 저절로 고른다 — 카드가 사라지고 연표에 가린 결정 줄이 남는다
    await expect(card).toHaveCount(0, { timeout: 20_000 });
    await expect.poll(async () => (await readSave(page)).data.history.some((h) => h.eventId === 'middle-layoff')).toBe(true);
    await expect(page.getByTestId('log').locator('[data-veiled="true"]', { has: page.locator('.veil__body') })).not.toHaveCount(0);
  });

  test('무거운 장면이 아닌 결정 카드는 켜도 그대로다 (middle-health-check — 경계, 가리지 않음)', async ({ page }) => {
    await page.goto('/');
    const game = await heavyPending(page, 'middle-health-check');
    await injectSave(page, game, '/', GENTLE_ON);
    await expect(page.getByTestId('choice-panel')).toBeVisible();
    await expect(page.getByTestId('choice-panel')).not.toHaveAttribute('data-veiled', 'true');
    await expect(page.getByTestId('choice-title')).toHaveText('검진 결과표');
    expect(await page.getByTestId('choice-panel').locator('.choice').count()).toBeGreaterThanOrEqual(2);
  });
});

test.describe('가린 부모·흘러감 카드와 live region (HV4 ③, HV8)', () => {
  test('부모님이 정한 무거운 카드(infant-fever): 칩·도장은 보이고 제목·상황·고른 길·영향은 가려진다 — 「펼쳐서 읽기」 뒤 포커스는 제목, 기록 줄도 가려진다', async ({ page }) => {
    await page.goto('/');
    const y = await findDelegatedYear(page, { by: 'parent', eventId: 'infant-fever' });
    await injectSave(page, y.start, '/?__timescale=8', GENTLE_ON);
    const card = page.getByTestId('parent-card');
    await expect(card).toBeVisible({ timeout: 30_000 });
    await page.getByTestId('pause').click();
    await expect(page.getByTestId('pause')).toHaveAttribute('data-paused', 'true');
    await expect(card).toHaveAttribute('data-veiled', 'true');
    await expect(page.getByTestId('parent-chip')).toHaveText('부모님의 결정');
    await expect(page.getByTestId('parent-stamp')).toHaveText('부모님이 이렇게 정했습니다');
    await expect(page.getByTestId('parent-title')).toHaveText('무거운 주제 · 건강');
    const cardText = await shown(card);
    for (const t of [y.title, y.label]) expect(cardText, t).not.toContain(t);
    expect(await card.locator('.impact__item, [data-testid="cite"], [data-testid="parent-label"], [data-testid="parent-text"]').count()).toBe(0);
    // 같은 해의 기록 줄: 가려지고 도장 낱말·아이콘은 보인다 (HV8)
    const row = page.getByTestId('log').locator('[data-veiled="true"]').first();
    await expect(row.getByTestId('veil-by')).toBeVisible();
    await expect(row.getByTestId('veil-by')).toContainText('부모님이 이렇게 정했습니다');
    expect(await shown(page.getByTestId('log'))).not.toContain(y.label);
    // 포커스는 평소 움직이지 않지만 「펼쳐서 읽기」를 누르면 버튼이 사라지므로 제목으로 간다
    await card.getByTestId('veil-open').click();
    await expect(page.getByTestId('parent-title')).toHaveText(y.title);
    await expect(page.getByTestId('parent-label')).toHaveText(y.label);
    await expect(card.locator('.impact__item')).toHaveCount(y.tick.impact!.length);
    await expect(card).not.toHaveAttribute('data-veiled', 'true');
    expect(await activeTestId(page)).toBe('parent-title');
  });

  test('아이의 일로 흘러간 무거운 카드(school-bully 12세 이하)도 같은 규칙: 흘러감 도장·칩은 보이고 글은 가려진다', async ({ page }) => {
    await page.goto('/');
    const y = await findDelegatedYear(page, { by: 'child', eventId: 'school-bully', maxAge: 12 });
    await injectSave(page, y.start, '/?__timescale=8', GENTLE_ON);
    const card = page.getByTestId('parent-card');
    await expect(card).toBeVisible({ timeout: 30_000 });
    await page.getByTestId('pause').click();
    await expect(card).toHaveAttribute('data-by', 'child');
    await expect(card).toHaveAttribute('data-veiled', 'true');
    await expect(page.getByTestId('parent-chip')).toHaveText('아이의 일');
    await expect(page.getByTestId('parent-stamp')).toHaveText('이렇게 흘러갔습니다');
    await expect(page.getByTestId('parent-title')).toHaveText('무거운 주제 · 또래 사이');
    expect(await shown(card)).not.toContain(y.title);
    expect(await shown(page.locator('body'))).not.toContain('학교폭력'); // 인용 박스(c-050)까지 가려진다
  });

  test('live region(HV4 접근성 (c)): 새 줄이 쌓일 때 렌더되는 글에 원문이 없다 — 가린 줄은 「무거운 일이 있었습니다 {분류}」와 버튼 이름만', async ({ page }) => {
    await page.addInitScript(() => {
      const w = window as unknown as { __added: Array<{ text: string; veiled: string | null }> };
      w.__added = [];
      new MutationObserver((records) => {
        for (const r of records)
          for (const n of r.addedNodes) {
            if (!(n instanceof HTMLElement)) continue;
            const rows = n.matches('li.log__row') ? [n] : [...n.querySelectorAll('li.log__row')];
            for (const li of rows) w.__added.push({ text: (li as HTMLElement).innerText, veiled: li.getAttribute('data-veiled') });
          }
      }).observe(document, { childList: true, subtree: true });
    });
    await page.goto('/');
    const y = await findDelegatedYear(page, { by: 'parent', eventId: 'infant-fever' });
    await injectSave(page, y.start, '/?__timescale=8', GENTLE_ON);
    await expect(page.getByTestId('parent-card')).toBeVisible({ timeout: 30_000 });
    const added = await page.evaluate(() => (window as unknown as { __added: Array<{ text: string; veiled: string | null }> }).__added);
    const veiledAdds = added.filter((a) => a.veiled === 'true');
    expect(veiledAdds.length, '가린 새 줄이 쌓였다').toBeGreaterThan(0);
    for (const a of veiledAdds) {
      expect(a.text, '렌더된(읽힐) 글').toContain('무거운 일이 있었습니다');
      expect(a.text).not.toContain(y.label);
    }
    for (const a of added) expect(a.text).not.toContain(y.label);
  });
});

test.describe('엔딩 (HV4 ④·HV6·HV8)', () => {
  test('연표의 무거운 줄이 가려지고(지난 줄까지) 펼치면 제목 → 고른 길 → 결과 · 맨 위 한 줄은 gentleUsed 기준 · 사망 줄은 원인까지 그대로', async ({ page }) => {
    await page.goto('/');
    const end = await heavyEnding(page);
    const rows = await heavyRowsOf(page, end);
    const deathText = end.history.find((h) => h.kind === 'death')!.text;
    // 켠 판(gentleUsed) + 설정 켜짐
    await injectSave(page, { ...end, gentleUsed: true }, '/', GENTLE_ON);
    await expect(page.getByTestId('ending-screen')).toBeVisible();
    const line = page.getByTestId('ending-gentle');
    await expect(line).toHaveText('이 판은 무거운 장면을 가린 채 살았습니다.');
    const timeline = page.getByTestId('ending-timeline');
    await expect(timeline.locator('[data-veiled="true"]')).toHaveCount(rows.length);
    const text = await shown(timeline);
    for (const r of rows) expect(text, `${r.age}세: 원문`).not.toContain(r.text);
    // 사망 줄은 원인 낱말까지 그대로
    expect(text).toContain(deathText);
    await expect(page.getByTestId('ending-death')).toContainText('세상을 떠났습니다');
    const deathBefore = await shown(page.getByTestId('ending-death'));
    // 펼치기(키보드): 제목 → 고른 길 → 결과 문장
    const btn = timeline.getByTestId('veil-btn').first();
    await btn.focus();
    await page.keyboard.press('Enter');
    await expect(btn).toHaveAttribute('aria-expanded', 'true');
    const openRow = timeline.locator('[data-veiled="true"]').first();
    await expect(openRow.getByTestId('veil-body')).toBeVisible();
    const openedText = await shown(openRow);
    expect(openedText, '펼친 줄에는 가장 오래된 무거운 줄의 원문이 보인다').toContain(rows[0].text);
    if (rows[0].choice !== null) expect(openedText).toContain(rows[0].choice);
    // 설정을 끈 채 같은 엔딩을 열면: 연표는 모두 원문, 맨 위 한 줄은 판의 기록이라 그대로 보인다
    await replaceSaveAndReload(page, { ...end, gentleUsed: true }, { ...MANUAL, gentle: false });
    await expect(page.getByTestId('ending-gentle')).toBeVisible();
    await expect(page.getByTestId('ending-timeline').locator('[data-veiled]')).toHaveCount(0);
    for (const r of rows) await expect(page.getByTestId('ending-timeline')).toContainText(r.text, { useInnerText: true });
    expect(await shown(page.getByTestId('ending-death'))).toBe(deathBefore);
    // 켠 적이 없는 판은 설정이 켜져 있어도 한 줄이 없다 (설정값이 아니라 판의 기록)
    await replaceSaveAndReload(page, end, GENTLE_ON);
    await expect(page.getByTestId('ending-screen')).toBeVisible();
    await expect(page.getByTestId('ending-gentle')).toHaveCount(0);
    await expect(page.getByTestId('ending-timeline').locator('[data-veiled="true"]')).toHaveCount(rows.length);
  });

  test('20세 미만 사망도 원인 낱말이 그대로 보인다 (R-470) — 가림 설정과 무관', async ({ page }) => {
    await page.goto('/');
    const end = await heavyEnding(page);
    const deathText = await evalCore<string>(page, "return (await import('/src/data/lifeText.ts')).deathEntryText(arg);", '사고');
    // 9세에 마친 판으로 줄인다: 9세 이하의 줄·본 이벤트만 남기고 자산은 없다(20세 전)
    const seen = Object.fromEntries(Object.entries(end.seen).filter(([, a]) => a <= 9));
    const young: GameState = {
      ...end,
      age: 9,
      death: { age: 9, cause: '사고' },
      history: [...end.history.filter((h) => h.age <= 9 && h.kind !== 'death'), { age: 9, kind: 'death', text: deathText }],
      seen,
      lastChoiceAge: null,
      assets: null,
      familyFund: 0,
      gentleUsed: true,
    };
    await injectSave(page, young, '/', GENTLE_ON);
    await expect(page.getByTestId('ending-screen')).toBeVisible();
    await expect(page.getByTestId('ending-death')).toContainText('사고');
    expect(await shown(page.getByTestId('ending-timeline'))).toContain(deathText);
  });
});

test.describe('첫 화면 자살률 슬라이드 (HV7)', () => {
  /** 자동 넘김을 멈추고 자살률 슬라이드까지 손으로 넘긴다 */
  async function toSuicideSlide(page: Page): Promise<Locator> {
    await page.getByTestId('carousel-pause').click();
    for (let i = 0; i < 20 && (await page.locator('.slide.is-active').getAttribute('data-slide-id')) !== 'suicide-rate'; i++) await page.getByTestId('carousel-next').click();
    const slide = page.locator('.slide.is-active');
    await expect(slide).toHaveAttribute('data-slide-id', 'suicide-rate');
    return slide;
  }

  test('켜면: 표제어 「무거운 주제 · 마음 건강 통계」 · 「펼쳐 보기」 하나 · 상담전화 묶음은 늘 보이고 이름 그대로 · 읽기 이름도 분류 문구 · 펼치면 원문 · 슬라이드를 떠나면 다시 가린다', async ({ page }) => {
    await injectSave(page, titleState(20261013), '/', GENTLE_ON);
    await expect(page.getByTestId('title-screen')).toBeVisible();
    await expect(page.getByTestId('gentle-switch')).toHaveAttribute('aria-checked', 'true');
    const slide = await toSuicideSlide(page);
    await expect(slide.locator('.slide__insight')).toHaveText('무거운 주제 · 마음 건강 통계');
    expect(await slide.getAttribute('aria-label')).toMatch(/^\d+\/\d+ 무거운 주제, 마음 건강 통계$/);
    const btn = slide.getByTestId('slide-veil-btn');
    await expect(btn).toHaveCount(1);
    await expect(btn).toHaveAttribute('aria-expanded', 'false');
    // 가려진 것: 공식 통계명·값·그래프·정의·출처 — 보이는 글자에 없다
    await expect(slide.getByTestId('slide-veiled-top')).toBeHidden();
    await expect(slide.getByTestId('slide-veiled-bottom')).toBeHidden();
    const text = await shown(slide);
    for (const t of ['삶을 스스로 마감', '자살률(', '인구 10만 명당', '출처:']) expect(text, t).not.toContain(t);
    // 상담전화: 늘 보이고 이름·번호·시간은 그대로
    const help = slide.getByTestId('slide-help');
    await expect(help).toBeVisible();
    await expect(help).toContainText('힘든 마음을 혼자 견디지 않아도 됩니다.');
    await expect(help).toContainText('자살예방 상담전화');
    await expect(help.getByRole('link', { name: '109' })).toBeVisible();
    await expect(help).toContainText('24시간');
    // 읽기 이름: 접근성 트리에 자살률 낱말이 없다 (상담전화 이름은 공식 서비스 이름이라 그대로)
    const tree = await slide.ariaSnapshot();
    expect(tree).not.toContain('삶을 스스로 마감');
    expect(tree).not.toContain('인구 10만 명당');
    // 펼치기
    await btn.click();
    await expect(btn).toHaveAttribute('aria-expanded', 'true');
    await expect(slide.locator('.slide__insight')).toHaveText('삶을 스스로 마감하는 사람은 얼마나 될까?');
    await expect(slide.getByTestId('slide-veiled-top')).toBeVisible();
    await expect(slide.getByTestId('slide-official')).toContainText('자살률');
    await expect(help).toBeVisible(); // 펼친 뒤에도 그대로
    // 떠나면 다시 가린다: 다음 슬라이드로 갔다 돌아온다
    await page.getByTestId('carousel-next').click();
    await page.getByTestId('carousel-prev').click();
    const back = page.locator('.slide.is-active');
    await expect(back).toHaveAttribute('data-slide-id', 'suicide-rate');
    await expect(back.getByTestId('slide-veil-btn')).toHaveAttribute('aria-expanded', 'false');
    await expect(back.locator('.slide__insight')).toHaveText('무거운 주제 · 마음 건강 통계');
    // 다른 지표(조사망률)는 가리지 않는다
    while ((await page.locator('.slide.is-active').getAttribute('data-slide-id')) !== 'cdr') await page.getByTestId('carousel-next').click();
    await expect(page.locator('.slide.is-active .slide__veil-btn')).toHaveCount(0);
    expect(await shown(page.locator('.slide.is-active'))).toContain('조사망률');
  });

  test('끄면 원문이다: 표제어 「삶을 스스로 마감하는 사람은 얼마나 될까?」, 가림 부품이 없다 — 스위치가 슬라이드를 바로 바꾼다 (화면 규칙 (A))', async ({ page }) => {
    await injectSave(page, titleState(20261013), '/', { ...MANUAL, gentle: false });
    const slide = await toSuicideSlide(page);
    await expect(slide.locator('.slide__insight')).toHaveText('삶을 스스로 마감하는 사람은 얼마나 될까?');
    await expect(slide.getByTestId('slide-veil-btn')).toHaveCount(0);
    // 스위치를 켜면 지금 보고 있는 슬라이드가 바로 가려진다 (판 도중 설정과 같은 규칙) — 입력 가드(0.4초)가 풀린 뒤
    await expect(page.getByTestId('start-birth')).toBeEnabled();
    await page.getByTestId('gentle-switch').click();
    await expect(page.getByTestId('gentle-switch')).toHaveAttribute('aria-checked', 'true');
    await expect(slide.locator('.slide__insight')).toHaveText('무거운 주제 · 마음 건강 통계');
    await page.getByTestId('gentle-switch').click();
    await expect(slide.locator('.slide__insight')).toHaveText('삶을 스스로 마감하는 사람은 얼마나 될까?');
  });
});

test.describe('첫 화면 스위치와 설정·저장 (HV3·SV2)', () => {
  test('스위치를 켜면 설정(gentle)이 저장되고 새로고침 뒤에도 켜져 있다 · 켠 채 태어나면 처음부터 gentleUsed가 참이다 · 끈 채 태어나면 필드가 없다', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('start-birth')).toBeEnabled();
    const sw = page.getByTestId('gentle-switch');
    await expect(sw).toHaveAttribute('aria-checked', 'false'); // 기본 꺼짐
    await sw.click();
    await expect(sw).toHaveAttribute('aria-checked', 'true');
    await expect.poll(async () => (await readSettings(page)).gentle).toBe(true);
    expect(JSON.parse((await page.evaluate(() => localStorage.getItem('suzeo-game:settings')))!).version).toBe(6); // v6: SPEC-004 MG1(세대 선택·살아본 세대·출신 시도·금액 보기)
    await page.reload();
    await expect(page.getByTestId('gentle-switch')).toHaveAttribute('aria-checked', 'true');
    // 켠 채 태어나기 → 저장된 판의 gentleUsed
    await expect(page.getByTestId('start-birth')).toBeEnabled();
    await page.getByTestId('start-birth').click();
    await expect.poll(async () => (await readSave(page)).data.phase).toBe('roulette');
    expect((await readSave(page)).data.gentleUsed).toBe(true);
  });

  test('끈 채 태어난 판은 gentleUsed 필드가 없다 (이전 버전의 저장과 같은 모양)', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('start-birth')).toBeEnabled();
    await expect(page.getByTestId('gentle-switch')).toHaveAttribute('aria-checked', 'false');
    await page.getByTestId('start-birth').click();
    await expect.poll(async () => (await readSave(page)).data.phase).toBe('roulette');
    expect(Object.prototype.hasOwnProperty.call((await readSave(page)).data, 'gentleUsed')).toBe(false);
  });

  test('판 도중 바꾸는 자리는 「나가기 → 첫 화면」의 스위치 하나다 — 도구 줄에 가림 버튼이 없다 (designer 판단 copy.md 12-7)', async ({ page }) => {
    await page.goto('/');
    const game = await heavyLifeState(page);
    await injectSave(page, game, '/', MANUAL);
    const tools = page.getByTestId('tools');
    await expect(tools).toBeVisible();
    expect(await tools.locator('button, a').count(), 'BGM·생각 남기기·다크 모드·의견 보내기·나가기 다섯').toBe(5);
    expect(await tools.getByText('무거운 장면 가리기').count()).toBe(0);
  });
});

test.describe('가려지지 않는 것 (HV8·R-471) — 켠 상태에서도 그대로', () => {
  test('식구 카드의 상태 문구(세상을 떠남)·스탯 미터·자산 현황·인생 기록의 단계 줄 · 기록 카드 ⑤⑥ 시트는 가려지지 않는다', async ({ page }) => {
    await page.goto('/');
    const game = await heavyLifeState(page);
    await injectSave(page, game, '/', GENTLE_ON);
    await expect(page.getByTestId('life-screen')).toBeVisible();
    // 식구 카드: 부모님 「세상을 떠남」 — 가림과 무관한 사실
    await expect(page.getByTestId('family-card')).toContainText('세상을 떠남');
    // 스탯 미터·자산 현황
    for (const stat of ['health', 'happiness', 'education', 'relationships']) await expect(page.locator(`.meter[data-stat="${stat}"]`).first()).toBeVisible();
    await expect(page.getByTestId('assets-card')).toBeVisible();
    // 단계 줄·출생 줄은 가려지지 않는다
    const rows = page.getByTestId('log').getByTestId('log-row');
    await expect(rows.filter({ hasText: '어느덧 마흔이 되었습니다' }).first()).toBeVisible();
    await expect(page.getByTestId('log').locator('[data-kind="stage"][data-veiled]')).toHaveCount(0);
    // 같은 판에서 가린 줄은 있다(비교 대상이 공허하지 않다)
    await expect(page.getByTestId('log').locator('[data-veiled="true"]')).not.toHaveCount(0);

    // 기록 카드 ⑤ note-illness · ⑥ note-parents-aging 시트 (R-490): 켠 상태의 질문 글·대화상자 이름(접근성 트리)이 끈 상태와 같고 시트 안에 가림 부품이 없다 —
    // 기록 시트는 가림 설정을 받지 않는다(구조상 가려질 수 없음). 앞 단언들과 같은 시험 안에 두어 이 제목이 말하는 것을 실제로 단언한다.
    for (const cardId of ['note-illness', 'note-parents-aging']) {
      const due = await noteDueState(page, cardId);
      const question = await evalCore<string>(page, 'return core.noteQuestion(core.dueNote(arg.state), arg.state);', { state: due });
      expect(question.length, `${cardId}: 질문이 있다`).toBeGreaterThan(10);
      const seen = {} as Record<'off' | 'on', { title: string; tree: string }>;
      for (const gentle of [false, true]) {
        // 같은 판을 가림 꺼짐 → 켜짐 설정으로 각각 연다: 뜰 차례인 상태를 그대로 주입하면 로드와 함께 시트가 열린다(새로고침 복원과 같은 경로)
        await injectSave(page, due, '/', { speed: 1, autoMode: false, noteCards: true, gentle });
        await sheetReady(page);
        expect((await readSettings(page)).gentle, `${cardId}: 설정이 ${gentle ? '켜짐' : '꺼짐'}`).toBe(gentle);
        const sheet = page.getByTestId('note-sheet');
        await expect(sheet).toHaveAttribute('data-card', cardId);
        const title = await page.getByTestId('note-title').innerText();
        expect(title.replace(/\s+/g, ' ').trim(), `${cardId}: 질문 글(gentle ${gentle})`).toBe(question);
        // 가림 부품이 시트 안에 없고, 분류 문구가 질문을 대신하지 않는다
        await expect(sheet.locator('[data-veiled], [data-testid="veil-btn"], .veil__btn')).toHaveCount(0);
        expect(await shown(sheet), `${cardId}: 분류 문구가 없다`).not.toMatch(/무거운 일이 있었습니다|무거운 주제/);
        seen[gentle ? 'on' : 'off'] = { title, tree: await page.getByRole('dialog').ariaSnapshot() };
      }
      expect(seen.on.title, `${cardId}: 켠 질문 글 = 끈 질문 글`).toBe(seen.off.title);
      expect(seen.on.tree, `${cardId}: 켠 대화상자의 접근성 트리(이름 포함) = 끈 것`).toBe(seen.off.tree);
    }
  });

  test('외부 요청 0: 켜고·펼치고·접고·끄는 동안 localhost 밖으로 나가는 요청이 없다 (CM-A)', async ({ page }) => {
    const external: string[] = [];
    page.on('request', (r) => {
      const u = new URL(r.url());
      if (u.protocol.startsWith('http') && u.hostname !== 'localhost' && u.hostname !== '127.0.0.1') external.push(r.url());
    });
    await page.goto('/');
    const game = await heavyLifeState(page);
    await injectSave(page, game, '/', MANUAL);
    await setGentleViaTitle(page, true);
    await page.getByTestId('log').getByTestId('veil-btn').first().click();
    await setGentleViaTitle(page, false);
    expect(external, '같은 출처 밖 요청').toEqual([]);
  });
});
