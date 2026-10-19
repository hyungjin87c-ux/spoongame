import { expect, test, type Page } from '@playwright/test';
import { KNOWN_SEED, injectSave, lifeState, noHorizontalOverflow, readSave, startPageHidden } from './helpers';
import { noteRows, sheetReady } from './m7cStates';

/**
 * 기록 입력 공격 (SPEC-003 M7c FR3·FR4, content-M7c 3-8절 A1~A20, 완료 기준 6): 대표 입력을 **실제 입력란**에서 — 붙여넣기(fill·insertText)·IME 조합(CDP)·1MB 붙여넣기.
 * 기대 저장값은 3-8절 표에서 사람이 직접 적은 값이다(구현의 `finalizeNote`를 다시 부르지 않는다). 규칙 자체의 단위 시험은 tests/notes.test.ts.
 * 한 인생 안에서 「생각 남기기」 수동 기록을 반복해 연다(최대 40개) — 입력마다 새 판을 띄우지 않아 빠르다. 스크린샷은 qa/screenshots/003/dev-M7c-attack-*.png.
 */

const SHOTS = 'qa/screenshots/003';
const NUL = String.fromCharCode(0);
const BEL = String.fromCharCode(7);
const SOH = String.fromCharCode(1);
const ESC = String.fromCharCode(27);

const REPEAT = (s: string, n: number): string => s.repeat(n);
const FAMILY = '👨\u200D👩\u200D👧';

interface Attack {
  id: string;
  raw: string;
  /** 저장되는 글 (null = 「빈 입력」이라 기록되지 않는다) */
  stored: string | null;
  /** 입력 직후 눈에 보이는 글자 수 「n/140」 (생략하면 확인하지 않는다) */
  count?: string;
  /** 알림 줄에 이 말이 나온다 */
  notice?: string;
}

const NOTICE_CUT = '140자까지 적을 수 있어 넘는 부분은 줄였습니다.';

const ATTACKS: Attack[] = [
  { id: 'A1 <script>', raw: '<script>alert(1)</script>', stored: '<script>alert(1)</script>', count: '25/140' },
  { id: 'A2 SQL·따옴표·백슬래시·엔티티', raw: `'; DROP TABLE users;-- " ${String.fromCharCode(92)}n &amp; &lt;b&gt;`, stored: `'; DROP TABLE users;-- " ${String.fromCharCode(92)}n &amp; &lt;b&gt;` },
  { id: 'A3 가족·깃발·피부색·키캡', raw: `${FAMILY} 🇰🇷 👍🏽 1\uFE0F\u20E3`, stored: `${FAMILY} 🇰🇷 👍🏽 1\uFE0F\u20E3`, count: '7/140' },
  { id: 'A4a 끝에 매달린 ZWJ', raw: '👍\u200D', stored: '👍', count: '1/140' },
  { id: 'A4b 글자 사이 ZWJ', raw: 'a\u200Db', stored: 'ab' },
  { id: 'A4c ZWSP만', raw: '\u200B', stored: null },
  { id: 'A7a 공백·탭·줄바꿈만', raw: ` ${String.fromCharCode(9)}\n \n `, stored: null },
  { id: 'A7b U+3164만', raw: '\u3164', stored: null },
  { id: 'A8 줄바꿈 5개 사이', raw: 'a\n\n\n\n\nb', stored: 'a\nb' },
  { id: 'A9 5줄', raw: '1\n2\n3\n4\n5', stored: '1\n2\n3 4 5', notice: '줄은 세 줄까지 적을 수 있습니다.' },
  { id: 'A10 히브리·아랍', raw: 'שלום עולם مرحبا بالعالم', stored: 'שלום עולם مرحبا بالعالم' },
  { id: 'A11 방향 제어', raw: '\u202Eabc\u2066def\u2069\u200E\u200F\u061Cg', stored: 'abcdefg' },
  { id: 'A12 제어 문자', raw: `a${SOH}${BEL}${ESC}[31m b${NUL}`, stored: 'a[31m b' },
  { id: 'A14a 분리된 한글 자모', raw: '\u1112\u1161\u11AB', stored: '\uD55C', count: '1/140' },
  { id: 'A14b 호환 자모', raw: 'ㅎㅏㄴ', stored: 'ㅎㅏㄴ', count: '3/140' },
  { id: 'A15 마크다운', raw: '**굵게** [링크](http://x) # 제목', stored: '**굵게** [링크](http://x) # 제목' },
  { id: 'A16 긴 URL', raw: `https://${REPEAT('a', 480)}`, stored: `https://${REPEAT('a', 132)}`, count: '140/140', notice: NOTICE_CUT },
  { id: 'A17a 139자', raw: REPEAT('가', 139), stored: REPEAT('가', 139), count: '139/140' },
  { id: 'A17b 140자', raw: REPEAT('나', 140), stored: REPEAT('나', 140), count: '140/140', notice: '140자까지 적었습니다.' },
  { id: 'A17c 141자', raw: REPEAT('다', 141), stored: REPEAT('다', 140), count: '140/140', notice: NOTICE_CUT },
  { id: 'A18a 단순 그림 문자 140개(280단위)', raw: REPEAT('👍', 140), stored: REPEAT('👍', 140), count: '140/140' },
  { id: 'A18b 가족 그림 문자 140개(단위 400 초과)', raw: REPEAT(FAMILY, 140), stored: REPEAT(FAMILY, 50), count: '50/140', notice: NOTICE_CUT },
];

const sheet = (page: Page) => page.getByTestId('note-sheet');
const input = (page: Page) => page.getByTestId('note-input');

async function openManual(page: Page): Promise<void> {
  await page.getByTestId('tool-note').click();
  await sheetReady(page);
  await expect(input(page)).toBeVisible();
}

test('A1~A18 대표 입력이 실제 입력란에서 3-8절 기대대로 저장·표시된다 (실행·삽입·서식 0, 새로고침 뒤 같은 글, 가로 넘침 0)', async ({ page }, testInfo) => {
  test.setTimeout(240_000);
  // 가려진 탭으로 시계를 멈춘다 — 시트를 닫을 때마다 컨트롤 입력 가드(400ms, M7c r2 F-1)를 기다리는 동안 인생이 흘러 결정 카드(모달)가 「생각 남기기」를 가리지 않게
  await startPageHidden(page);
  const dialogs: string[] = [];
  page.on('dialog', async (d) => {
    dialogs.push(d.message());
    await d.dismiss();
  });
  await page.goto('/');
  await injectSave(page, lifeState(KNOWN_SEED), '/', { speed: 1, autoMode: false, noteCards: false });
  await expect(page.getByTestId('tool-note')).toBeEnabled();
  const scriptsBefore = await page.locator('script').count();
  const expected: string[] = [];
  for (const a of ATTACKS) {
    await openManual(page);
    await input(page).fill(a.raw);
    if (a.count !== undefined) await expect(page.getByTestId('note-count'), `${a.id} 글자 수`).toHaveText(a.count);
    if (a.notice !== undefined) await expect(page.locator('[data-testid="note-msg"]'), `${a.id} 알림`).toHaveText(a.notice);
    await page.getByTestId('note-save').click();
    if (a.stored === null) {
      // 빈 입력: 기록 0, 카드는 열린 채 안내, 포커스는 입력란
      await expect(page.locator('[data-testid="note-msg"]'), `${a.id} 빈 입력 안내`).toContainText('적을 말이 없다면');
      await expect(input(page)).toBeFocused();
      await expect(sheet(page)).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(sheet(page)).toHaveCount(0);
    } else {
      await expect(sheet(page), `${a.id} 저장 뒤 닫힘`).toHaveCount(0);
      expected.push(a.stored);
    }
    expect((await noteRows(page)).map((r) => r.text), `${a.id}: 저장된 글`).toEqual(expected);
    expect(await noHorizontalOverflow(page), `${a.id}: 가로 넘침 0`).toBe(true);
  }
  expect(expected.length).toBeGreaterThanOrEqual(18);
  expect(dialogs, '글이 실행되지 않았다(대화상자 0)').toEqual([]);
  expect(await page.locator('script').count(), '글이 script 요소를 만들지 않았다').toBe(scriptsBefore);
  // 인생 기록의 note 줄: 글 영역 안에는 요소가 없고(격리 요소 하나), 링크·이미지·서식이 없다
  const rows = page.locator('[data-testid="log-row"][data-kind="note"]');
  await expect(rows).toHaveCount(expected.length);
  expect(await rows.locator('a, img, script, strong, em, h1, h2, ul, ol, table, br, iframe').count(), '링크·이미지·서식·제목 0').toBe(0);
  expect(await page.locator('[data-testid="note-text"] *').count(), '글 영역 안에 요소가 없다').toBe(0);
  const shown = await page.getByTestId('note-text').allTextContents();
  expect(shown, '화면의 글 = 저장된 글').toEqual(expected);
  await page.getByTestId('log-list').evaluate((el) => el.scrollTo(0, 0));
  await page.screenshot({ path: `${SHOTS}/dev-M7c-attack-log-${testInfo.project.name}.png` });
  // 새로고침: 같은 글 (그림 문자·깃발·결합 문자·방향 글 포함)
  await page.reload();
  await expect(page.getByTestId('life-screen')).toBeVisible();
  expect((await noteRows(page)).map((r) => r.text), '새로고침 뒤 저장된 글').toEqual(expected);
  expect(await page.getByTestId('note-text').allTextContents(), '새로고침 뒤 화면의 글').toEqual(expected);
});

test('A13 결합 문자 범람: 한 글자에 코드 포인트 8개까지만 남고, 줄 높이·옆 줄을 침범하지 않는다', async ({ page }) => {
  await page.goto('/');
  await injectSave(page, lifeState(KNOWN_SEED), '/', { speed: 1, autoMode: false, noteCards: false });
  await expect(page.getByTestId('tool-note')).toBeEnabled();
  await openManual(page);
  await input(page).fill('평범한 줄');
  await page.getByTestId('note-save').click();
  await expect(sheet(page)).toHaveCount(0);
  await openManual(page);
  await input(page).fill(`a${REPEAT('\u0301', 300)}b`);
  await expect(page.getByTestId('note-count')).toHaveText('2/140');
  await page.getByTestId('note-save').click();
  await expect(sheet(page)).toHaveCount(0);
  const rows = await noteRows(page);
  expect(Array.from(rows[1].text).length, '코드 포인트 8개(기본 글자 1 + 결합 7) + b').toBe(9);
  expect(rows[1].text.normalize('NFD').startsWith('a'), '기본 글자는 a(NFC로 00E1가 될 수 있다)').toBe(true);
  expect(rows[1].text.endsWith('b')).toBe(true);
  // 행 높이: 평범한 줄과 결합 문자 줄의 높이 차이가 작다(글자 위로 쌓인 결합 문자가 옆 줄을 밀지 않는다)
  const heights = await page.locator('[data-testid="log-row"][data-kind="note"]').evaluateAll((els) => els.map((el) => el.getBoundingClientRect().height));
  expect(heights).toHaveLength(2);
  expect(Math.abs(heights[1] - heights[0]), `행 높이 ${heights.join(' / ')}`).toBeLessThanOrEqual(12);
  expect(await noHorizontalOverflow(page)).toBe(true);
});

test('A10 방향 글(히브리·아랍): 줄 안의 「나의 기록」 라벨과 나이의 논리 순서·위치가 평범한 글 줄과 같다 (격리 <bdi dir="auto">)', async ({ page }) => {
  await page.goto('/');
  await injectSave(page, lifeState(KNOWN_SEED), '/', { speed: 1, autoMode: false, noteCards: false });
  await expect(page.getByTestId('tool-note')).toBeEnabled();
  for (const text of ['평범한 한국어 글입니다', 'שלום עולם, זה טקסט בעברית', 'مرحبا بالعالم هذا نص عربي']) {
    await openManual(page);
    await input(page).fill(text);
    await page.getByTestId('note-save').click();
    await expect(sheet(page)).toHaveCount(0);
  }
  const geo = await page.locator('[data-testid="log-row"][data-kind="note"]').evaluateAll((rows) =>
    rows.map((row) => {
      const age = row.querySelector('.log__age')!.getBoundingClientRect();
      const label = row.querySelector('[data-testid="note-label"]')!.getBoundingClientRect();
      const text = row.querySelector('[data-testid="note-text"]') as HTMLElement;
      return { ageLeft: Math.round(age.left), labelLeft: Math.round(label.left), textLeft: Math.round(text.getBoundingClientRect().left), dir: getComputedStyle(text).direction, bidi: getComputedStyle(text).unicodeBidi };
    }),
  );
  expect(geo).toHaveLength(3);
  for (const g of geo) {
    expect(g.ageLeft, '나이가 왼쪽 첫 칸').toBeLessThan(g.labelLeft);
    expect(g.bidi, '격리').toMatch(/isolate/);
  }
  // 라벨·나이의 위치가 글의 방향과 무관하게 같다
  expect(geo[1].labelLeft).toBe(geo[0].labelLeft);
  expect(geo[2].labelLeft).toBe(geo[0].labelLeft);
  expect(geo[1].ageLeft).toBe(geo[0].ageLeft);
  expect(geo[2].ageLeft).toBe(geo[0].ageLeft);
  // 글 자체의 방향은 글을 따른다(auto): 히브리·아랍은 rtl, 한국어는 ltr — 그래도 글 상자의 왼쪽 시작은 같은 칸이다
  expect(geo.map((g) => g.dir)).toEqual(['ltr', 'rtl', 'rtl']);
  expect(geo[1].textLeft).toBe(geo[0].textLeft);
  expect(geo[2].textLeft).toBe(geo[0].textLeft);
});

test('A5·A6 붙여넣기: 1만 자·1MB를 넣어도 140글자로 줄이고 알림이 뜨며 입력란은 멈추지 않는다 (읽는 양 20,000)', async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto('/');
  await injectSave(page, lifeState(KNOWN_SEED), '/', { speed: 1, autoMode: false, noteCards: false });
  await expect(page.getByTestId('tool-note')).toBeEnabled();
  await openManual(page);
  // 붙여넣기 흉내(insertText): 브라우저가 maxlength 4000으로 먼저 자른다 — 그래도 140글자로 줄고 알림이 뜬다
  await input(page).focus();
  await page.keyboard.insertText(REPEAT('가', 10_000));
  await expect(page.getByTestId('note-count')).toHaveText('140/140');
  await expect(page.locator('[data-testid="note-msg"]')).toHaveText(NOTICE_CUT);
  expect((await input(page).inputValue()).length).toBe(140);
  // 프로그램이 값을 통째로 바꾸는 1MB (maxlength를 거치지 않는 경로)
  const t0 = Date.now();
  await input(page).fill(REPEAT('나', 1_000_000));
  await expect(page.getByTestId('note-count')).toHaveText('140/140');
  expect(Date.now() - t0, '1MB 입력에도 화면이 멈추지 않는다').toBeLessThan(15_000);
  expect((await input(page).inputValue()).length, '값이 140글자로 줄었다').toBe(140);
  await page.getByTestId('note-save').click();
  await expect(sheet(page)).toHaveCount(0);
  expect((await noteRows(page))[0].text).toBe(REPEAT('나', 140));
  expect(JSON.stringify((await readSave(page)).data).length, '저장 크기가 커지지 않았다').toBeLessThan(200_000);
});

test('IME 조합: 조합 중에는 글자 수·알림을 건드리지 않고 값을 다시 쓰지 않으며, 조합 중 Esc는 무시되고, 조합 중 「적어두고 살기」도 마지막 글자가 빠지지 않는다', async ({ page }) => {
  await page.goto('/');
  await injectSave(page, lifeState(KNOWN_SEED), '/', { speed: 1, autoMode: false, noteCards: false });
  await expect(page.getByTestId('tool-note')).toBeEnabled();
  await openManual(page);
  const cdp = await page.context().newCDPSession(page);
  await input(page).focus();
  // 「한」을 조합 중 (ㅎ → 하 → 한)
  await cdp.send('Input.imeSetComposition', { text: 'ㅎ', selectionStart: 1, selectionEnd: 1 });
  await cdp.send('Input.imeSetComposition', { text: '하', selectionStart: 1, selectionEnd: 1 });
  await cdp.send('Input.imeSetComposition', { text: '한', selectionStart: 1, selectionEnd: 1 });
  await expect(input(page)).toHaveValue('한');
  await expect(page.getByTestId('note-count'), '조합 중에는 글자 수를 갱신하지 않는다').toHaveText('0/140');
  // 조합 중 Esc는 시트를 닫지 않는다
  await page.keyboard.press('Escape');
  await expect(sheet(page)).toBeVisible();
  await expect(page.getByTestId('note-confirm')).toHaveCount(0);
  // 조합이 끝나면(확정) 글자 수가 갱신된다
  await cdp.send('Input.insertText', { text: '한' });
  await expect(input(page)).toHaveValue('한');
  await expect(page.getByTestId('note-count')).toHaveText('1/140');
  // 이제 Esc는 2번과 같다: 글이 있으니 확인 단계
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('note-confirm')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('note-confirm')).toHaveCount(0);
  // 조합 중에 「적어두고 살기」: 마지막 글자(조합 중인 글자)까지 저장된다
  await input(page).focus();
  await cdp.send('Input.imeSetComposition', { text: '글', selectionStart: 1, selectionEnd: 1 });
  await page.getByTestId('note-save').click();
  await expect(sheet(page)).toHaveCount(0);
  const rows = await noteRows(page);
  expect(rows).toHaveLength(1);
  expect(rows[0].text, '조합 중인 마지막 글자가 빠지지 않는다').toBe('한글');
});

test('IME 조합으로 140글자를 넘기면 조합이 끝난 뒤에 줄이고 알림을 띄운다 (조합 중에 글을 자르지 않는다)', async ({ page }) => {
  await page.goto('/');
  await injectSave(page, lifeState(KNOWN_SEED), '/', { speed: 1, autoMode: false, noteCards: false });
  await expect(page.getByTestId('tool-note')).toBeEnabled();
  await openManual(page);
  await input(page).fill(REPEAT('가', 140));
  await expect(page.getByTestId('note-count')).toHaveText('140/140');
  const cdp = await page.context().newCDPSession(page);
  await input(page).focus();
  await page.keyboard.press('End');
  await cdp.send('Input.imeSetComposition', { text: '한', selectionStart: 1, selectionEnd: 1 });
  await cdp.send('Input.insertText', { text: '한' });
  await expect(page.getByTestId('note-count')).toHaveText('140/140');
  expect((await input(page).inputValue()).length, '넘친 글자는 조합이 끝난 뒤 줄었다').toBe(140);
  await expect(page.locator('[data-testid="note-msg"]')).toHaveText(NOTICE_CUT);
});

test('A16 긴 URL·공백 없는 긴 글이 든 「나의 기록」 줄: 폭 320·360 × 글자 100~200%에서 가로 넘침 0, <a> 요소 0, 줄 안 라벨이 그대로 읽힌다', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-360', '뷰포트를 직접 지정하므로 mobile-360에서만 실행');
  test.setTimeout(120_000);
  await page.goto('/');
  await injectSave(page, lifeState(KNOWN_SEED), '/', { speed: 1, autoMode: false, noteCards: false });
  await expect(page.getByTestId('tool-note')).toBeEnabled();
  for (const text of [`https://${REPEAT('a', 480)}`, REPEAT('가', 140), `${REPEAT('x', 50)}\n${REPEAT('y', 50)}\n${REPEAT('z', 30)}`]) {
    await openManual(page);
    await input(page).fill(text);
    await page.getByTestId('note-save').click();
    await expect(sheet(page)).toHaveCount(0);
  }
  for (const width of [320, 360]) {
    for (const percent of [100, 150, 200]) {
      await page.setViewportSize({ width, height: 740 });
      await page.evaluate((p) => (document.documentElement.style.fontSize = `${p}%`), percent);
      expect(await noHorizontalOverflow(page), `폭 ${width} × 글자 ${percent}%`).toBe(true);
      const over = await page.locator('[data-testid="log-row"][data-kind="note"]').evaluateAll((els) =>
        els.filter((el) => el.scrollWidth > el.clientWidth + 1 || el.getBoundingClientRect().right > document.documentElement.clientWidth + 1).length,
      );
      expect(over, `폭 ${width} × 글자 ${percent}%: 줄이 넘치지 않는다`).toBe(0);
    }
  }
  expect(await page.locator('[data-testid="log-row"][data-kind="note"] a').count()).toBe(0);
  await page.evaluate(() => (document.documentElement.style.fontSize = ''));
});
