import { expect, test, type Page } from '@playwright/test';
import type { GameState } from '../src/core/types';
import { evalCore, injectSave, noHorizontalOverflow, withoutPlay } from './helpers';

/**
 * 가족과 삶 카드 개편 (SPEC-009 FM6, FC1~FC10) — 실제 브라우저(Chromium), desktop(1280×800)과 mobile-360 두 프로젝트.
 * 구조·순서·문구·사람 수 일치는 tests/familyCard.test.ts·tests/dashboard.test.tsx(서버 렌더)가 보고, 여기서는 **실제 폭·글자 크기·키보드**를 본다:
 * 가로 넘침 0(360 · 글자 200%), 「더 보기」를 키보드로 여닫기(aria-expanded), 떠난 사람이 글자로 보이는 것, 접이식 근거 칸, 강제 색상에서도 글자가 남는 것, 새로고침을 해도 같은 카드.
 */

const MANUAL = { speed: 1, autoMode: false, noteCards: false } as const;

/** 45세까지 첫 선택지로 산 인생에 혼인·자녀·친구 플래그를 켜 둔다(식구가 많이 보이게) — 부모님은 아직 계시거나 떠난 판이 섞여 있다 */
async function adultWithFamily(page: Page, seed: number, gen: string): Promise<GameState> {
  await page.goto('/');
  const s = await evalCore<GameState | null>(
    page,
    `let s = core.enterLife(core.enterBirth(core.beginBirth(core.createInitialState(arg.seed), arg.gen)));
     while (s.phase === 'life' && s.age < 45) {
       if (s.pending !== null) s = core.resolveChoiceStep(s, s.pending.key, s.pending.choiceIds[0]).state;
       else s = core.stepYear(s).state;
     }
     if (s.phase !== 'life' || s.pending !== null) return null;
     const flags = [...new Set([...s.flags, 'married', 'has_child', 'close_friend'])].sort();
     return { ...s, flags, paused: true };`,
    { seed, gen },
  );
  expect(s, '45세까지 산 인생을 만들지 못했다').not.toBeNull();
  return withoutPlay(s!);
}

async function openCard(page: Page, state: GameState): Promise<void> {
  await injectSave(page, state, '/', MANUAL);
  await expect(page.getByTestId('family-card')).toBeVisible();
}

test('사람 줄: 호칭 · 이름 · 나이 아래에 사이와 직업 줄이 있고 배우자·자녀·친구가 보인다 (FC1·FC5·FC6)', async ({ page }) => {
  await openCard(page, await adultWithFamily(page, 5, 'genx'));
  const card = page.getByTestId('family-card');
  const text = (await card.innerText()).replace(/\s+/g, ' ');
  expect(text).toMatch(/(아주 가까움|가까움|보통|데면데면함|멀어짐)/);
  await expect(card.getByTestId('family-spouse')).toHaveCount(1);
  expect(await card.getByTestId('family-child').count()).toBeGreaterThanOrEqual(1);
  expect(await card.getByTestId('family-friend').count()).toBeGreaterThanOrEqual(1);
  // 이름은 한글 2~5자 + 「N세」
  const first = await card.getByTestId('family-spouse').locator('.family-who').innerText();
  expect(first).toMatch(/^[가-힣]{2,5} \d+세$/);
  // 신원 카드: 「태어난 곳」과 「지금 사는 곳」이 나뉜다 (FC8)
  const profile = page.getByTestId('profile-card');
  await expect(profile).toContainText('태어난 곳');
  await expect(profile).toContainText('지금 사는 곳');
  await expect(page.getByTestId('profile-now')).toContainText(' · ');
});

test('보이는 사람 줄은 12줄 이하이고 「더 보기」를 키보드(Enter·Space)로 열고 닫는다 — 열면 줄이 늘고 aria-expanded가 바뀐다 (FC1)', async ({ page }) => {
  await openCard(page, await adultWithFamily(page, 5, 'genx'));
  const card = page.getByTestId('family-card');
  const people = card.locator('dd[data-testid^="family-"]:not([data-testid="family-pet"]):not([data-testid="family-things"])');
  const before = await people.count();
  expect(before).toBeLessThanOrEqual(12 + (await card.getByTestId('family-gone').locator('dd').count()));
  const more = card.getByTestId('family-more');
  if ((await more.count()) === 0) test.skip(true, '이 판은 줄이 12줄 이하라 「더 보기」가 없다');
  await expect(more).toHaveAttribute('aria-expanded', 'false');
  await more.focus();
  await page.keyboard.press('Enter');
  await expect(more).toHaveAttribute('aria-expanded', 'true');
  expect(await people.count()).toBeGreaterThanOrEqual(before);
  await page.keyboard.press('Space');
  await expect(more).toHaveAttribute('aria-expanded', 'false');
  expect(await people.count()).toBe(before);
});

test('떠난 가족은 소제목 아래 항상 보이고 「N세에 세상을 떠남」이 글자로 적힌다 — 접지 않는다 (FC4)', async ({ page }) => {
  await page.goto('/');
  const s = await evalCore<GameState | null>(
    page,
    `for (let seed = 1; seed <= 400; seed++) {
       let s = core.enterLife(core.enterBirth(core.beginBirth(core.createInitialState(seed), 'industrial')));
       while (s.phase === 'life' && s.age < 70) {
         if (s.pending !== null) s = core.resolveChoiceStep(s, s.pending.key, s.pending.choiceIds[0]).state;
         else s = core.stepYear(s).state;
       }
       if (s.phase === 'life' && s.pending === null && core.familyViewOf(s).people.filter((p) => p.state === 'gone').length >= 3) return { ...s, paused: true };
     }
     return null;`,
  );
  expect(s, '떠난 식구가 셋 이상인 70세 인생을 찾지 못했다').not.toBeNull();
  await openCard(page, withoutPlay(s!));
  const gone = page.getByTestId('family-gone');
  await expect(gone).toBeVisible();
  await expect(page.getByTestId('family-card').getByRole('heading', { name: '떠난 가족' })).toBeVisible();
  const text = await gone.innerText();
  expect(text.match(/\d+세에 세상을 떠남|내가 태어나기 전에 세상을 떠남/g)?.length ?? 0).toBeGreaterThanOrEqual(3);
  // 취소선·색에만 기대지 않는다: 글자 자체가 정보다
  expect(await gone.locator('dd').first().evaluate((el) => getComputedStyle(el).textDecorationLine)).toBe('none');
});

test('접이식 근거 칸 「이 칸은 어떻게 정했나요」: 키보드로 열리고 내부 이름·파일 경로가 없다 (FA0-4)', async ({ page }) => {
  await openCard(page, await adultWithFamily(page, 11, 'millennial'));
  const basis = page.getByTestId('family-basis');
  const summary = basis.locator('summary');
  await summary.focus();
  await page.keyboard.press('Enter');
  await expect(basis).toHaveAttribute('open', '');
  const text = await basis.innerText();
  expect(text).toContain('설계값');
  expect(text).not.toMatch(/docs\/|src\/|\.json|\.ts\b|FD\d|FM\d/);
});

test('가로 넘침 0: 지금 폭에서도, 글자 200%에서도, 강제 색상에서도 카드가 넘치지 않고 글자가 남는다 (FC10)', async ({ page }) => {
  await openCard(page, await adultWithFamily(page, 5, 'genx'));
  expect(await noHorizontalOverflow(page), '기본').toBe(true);
  await page.getByTestId('family-more').click().catch(() => undefined); // 펼친 상태로도 본다(없으면 건너뜀)
  expect(await noHorizontalOverflow(page), '펼침').toBe(true);
  await page.addStyleTag({ content: 'html { font-size: 200% !important; }' });
  expect(await noHorizontalOverflow(page), '글자 200%').toBe(true);
  const card = page.getByTestId('family-card');
  const box = await card.boundingBox();
  const vw = page.viewportSize()!.width;
  expect(box!.x + box!.width, '카드가 화면 안에 있다').toBeLessThanOrEqual(vw + 1);
  await page.emulateMedia({ forcedColors: 'active' });
  await expect(card.getByTestId('family-spouse')).toBeVisible();
  expect((await card.innerText()).length).toBeGreaterThan(100);
});

test('새로고침을 여러 번 해도 카드의 이름·나이·사이가 똑같다 (같은 상태 → 같은 식구)', async ({ page }) => {
  await openCard(page, await adultWithFamily(page, 21, 'g86'));
  const read = async () => (await page.getByTestId('family-card').innerText()).replace(/\s+/g, ' ');
  const first = await read();
  for (let i = 0; i < 3; i++) {
    await page.reload();
    await expect(page.getByTestId('family-card')).toBeVisible();
    expect(await read()).toBe(first);
  }
});

/**
 * 360px 사람 줄의 줄 수 (SPEC-009 FC10 「360px에서 사람 줄 3줄 이하」, R-577 마스터 결정 2026-11-03 — 보조 줄이 항목마다 줄이던 때는 가장 긴 줄이 5줄이었다).
 * 사람 줄 = `dd` 하나: 이름 · 나이 줄(`.family-who`) + 보조 줄(사이 · 직업 · 병환 중 · 따로 삶, FitList). 글자가 실제로 놓인 줄(글자 상자의 위쪽 좌표 묶음)을 센다.
 * 가장 긴 줄은 판을 훑어 `이름 나이 + 보조 항목`의 글자 수가 가장 큰 사람으로 고른다.
 */
async function longestRowCase(page: Page): Promise<{ state: GameState; name: string; items: string[] }> {
  await page.goto('/');
  const best = await evalCore<{ state: GameState | null; name: string; items: string[]; len: number }>(
    page,
    `const best = { len: 0, state: null, name: '', items: [] };
     for (const gen of arg.gens) {
       for (let seed = 1; seed <= arg.seeds; seed++) {
         let s = core.enterLife(core.enterBirth(core.beginBirth(core.createInitialState(seed), gen)));
         while (s.phase === 'life' && s.age < 45) {
           if (s.pending !== null) s = core.resolveChoiceStep(s, s.pending.key, s.pending.choiceIds[0]).state;
           else s = core.stepYear(s).state;
         }
         if (s.phase !== 'life' || s.pending !== null) continue;
         const flags = [...new Set([...s.flags, 'married', 'has_child', 'close_friend', 'cared_parents'])].sort();
         const cand = { ...s, flags, paused: true };
         const card = core.familyCardOf(cand);
         for (const r of [...card.together, ...card.apart, ...card.adult, ...card.friends]) {
           const items = [r.closenessText, r.jobText, r.statusText, r.state === 'apart' && r.role !== 'friend' ? '따로 삶' : null].filter((x) => x !== null);
           const len = (r.name + ' ' + r.age + '세').length + items.join(' · ').length;
           if (len > best.len) { best.len = len; best.state = cand; best.name = r.name; best.items = items; }
         }
       }
     }
     return best;`,
    { gens: ['alpha', 'millennial', 'genx'], seeds: 40 },
  );
  expect(best.state, '긴 줄을 가진 판을 찾지 못했다').not.toBeNull();
  return { state: withoutPlay(best.state!), name: best.name, items: best.items };
}

/** 한 요소 안에서 글자가 놓인 줄 수 (보이지 않는 탐침·읽기 전용 글자는 뺀다) */
async function textLines(row: ReturnType<Page['locator']>): Promise<number> {
  return row.evaluate((el) => {
    const range = document.createRange();
    const tops: number[] = [];
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n !== null; n = walker.nextNode()) {
      const parent = n.parentElement;
      if (parent === null || parent.closest('.fit-pair__probe, .sr-only') !== null || (n.textContent ?? '').trim() === '') continue;
      range.selectNodeContents(n);
      for (const r of Array.from(range.getClientRects())) if (r.width > 0 && r.height > 0) tops.push(r.top);
    }
    tops.sort((a, b) => a - b);
    let lines = 0;
    let last = -Infinity;
    for (const t of tops) {
      if (t - last > 4) lines++;
      last = t;
    }
    return lines;
  });
}

/** 줄 첫머리·끝에 혼자 남은 구분 기호(쉼표 · 가운뎃점)가 있는 줄의 글자들 — 쉼표는 줄 끝에 남아도 되지만 첫머리에는 오면 안 되고, 가운뎃점은 어느 쪽에도 남으면 안 된다 (QM2-10 규칙 3) */
async function strayMarks(row: ReturnType<Page['locator']>): Promise<string[]> {
  return row.evaluate((el) => {
    const chars: Array<{ ch: string; top: number; left: number }> = [];
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n !== null; n = walker.nextNode()) {
      const parent = n.parentElement;
      if (parent === null || parent.closest('.fit-pair__probe, .sr-only') !== null) continue;
      const text = n.textContent ?? '';
      for (let k = 0; k < text.length; k++) {
        if (text[k].trim() === '') continue;
        const range = document.createRange();
        range.setStart(n, k);
        range.setEnd(n, k + 1);
        const r = range.getClientRects()[0];
        if (r !== undefined && r.width > 0) chars.push({ ch: text[k], top: r.top, left: r.left });
      }
    }
    chars.sort((a, b) => a.top - b.top || a.left - b.left);
    const lines: Array<typeof chars> = [];
    for (const c of chars) {
      const last = lines[lines.length - 1];
      if (last !== undefined && Math.abs(last[0].top - c.top) <= 4) last.push(c);
      else lines.push([c]);
    }
    const stray: string[] = [];
    for (const line of lines) {
      line.sort((a, b) => a.left - b.left);
      const first = line[0].ch;
      const end = line[line.length - 1].ch;
      if (first === ',' || first === '·') stray.push(`첫머리 ${first}`);
      if (end === '·' || (line.length === 1 && end === ',')) stray.push(`줄 끝 ${end}`);
    }
    return stray;
  });
}

test('360px 사람 줄 줄 수 (FC10 「사람 줄 3줄 이하」, R-577): 가장 긴 사람 줄이 글자 100%에서 3줄 이하이고, 150·200%는 재서 남긴다. 구분 기호가 줄 가장자리에 혼자 남지 않고 낭독 글자에 구분이 있다', async ({ page }) => {
  test.skip((page.viewportSize()?.width ?? 0) > 400, '360px 폭에서만 잰다');
  const { state, name, items } = await longestRowCase(page);
  await openCard(page, state);
  const card = page.getByTestId('family-card');
  const more = card.getByTestId('family-more');
  if ((await more.count()) > 0) await more.click(); // 12줄 밖에 있는 사람도 잰다
  const rows = card.locator('dd[data-testid^="family-"]:not([data-testid="family-pet"]):not([data-testid="family-things"])');
  const longest = rows.filter({ has: page.locator('.family-who', { hasText: name }) });
  await expect(longest).toHaveCount(1);
  const measured: Record<string, { longest: number; worst: number; worstText: string; histogram: Record<number, number>; stray: string[] }> = {};
  for (const pct of [100, 150, 200]) {
    await page.addStyleTag({ content: `html { font-size: ${pct}% !important; }` });
    await page.waitForTimeout(150); // 탐침(ResizeObserver)이 항목 쪼개기를 마칠 때까지
    const count = await rows.count();
    let worst = 0;
    let worstText = '';
    const histogram: Record<number, number> = {};
    const stray: string[] = [];
    for (let i = 0; i < count; i++) {
      const lines = await textLines(rows.nth(i));
      histogram[lines] = (histogram[lines] ?? 0) + 1;
      stray.push(...(await strayMarks(rows.nth(i))));
      if (lines > worst) {
        worst = lines;
        worstText = (await rows.nth(i).innerText()).replace(/\s+/g, ' ');
      }
    }
    measured[`${pct}%`] = { longest: await textLines(longest), worst, worstText, histogram, stray };
  }
  const report = `가장 긴 줄 「${name} + ${items.join(' · ')}」 (histogram = 줄 수별 사람 수) ${JSON.stringify(measured)}`;
  console.log(`[R-577 줄 수] ${report}`);
  test.info().annotations.push({ type: 'R-577 줄 수', description: report });
  // FC10: 360px · 글자 100%에서 가장 긴 사람 줄은 3줄 이하(이름 줄 + 보조 줄 최대 2줄). 150%·200%는 재서 남기기만 한다
  expect(measured['100%'].longest, `가장 긴 줄 「${name}」 100%`).toBeLessThanOrEqual(3);
  expect(measured['100%'].worst, `모든 사람 줄 100% ${measured['100%'].worstText}`).toBeLessThanOrEqual(3);
  // QM2-10 규칙 3: 구분 기호가 줄 첫머리·끝에 혼자 남지 않는다 (세 크기 모두)
  for (const [pct, m] of Object.entries(measured)) expect(m.stray, `${pct} 줄 가장자리 구분 기호`).toEqual([]);
  // 낭독: 항목 사이 구분이 글자로 남는다 — 안 들어가 흐름으로 바뀐 줄은 쉼표로 이어진다(들어가면 「 · 」)
  await page.addStyleTag({ content: 'html { font-size: 100% !important; }' });
  await page.waitForTimeout(150);
  const spoken = (await longest.innerText()).replace(/\s+/g, ' ');
  expect(spoken, '긴 줄의 항목 사이 구분').toContain(items.join(', '));
  expect(spoken).not.toMatch(/ · /);
  // 접근성 트리(낭독이 읽는 것)에도 같은 글자가 있다
  expect((await longest.ariaSnapshot()).replace(/\s+/g, ' '), '접근성 트리의 항목 사이 구분').toMatch(new RegExp(items.join(' ?, ')));
});
