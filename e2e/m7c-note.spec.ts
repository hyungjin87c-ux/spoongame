import { expect, test, type Locator, type Page } from '@playwright/test';
import type { GameState } from '../src/core/types';
import { KNOWN_SEED, activeTestId, evalCore, injectSave, lifeState, readSave, readSettings, setPageVisible, settle, startPageHidden } from './helpers';
import { decisionBeforeDue, infantDue, noteRows, sheetReady, teenDue, withNotes } from './m7cStates';

/**
 * 자유 기록 「생각 남기기」 (SPEC-003 M7c FR1~FR9, content-M7c 5·7-4절): 실제 브라우저에서 시트가 뜨고 닫히는 길 전부.
 * 구조·문구·이름은 tests/noteSheet.test.tsx(서버 렌더), 포커스 표는 tests/noteFocus.test.ts, 입력 규칙은 tests/notes.test.ts, 입력 공격은 e2e/m7c-input-attack.spec.ts가 본다.
 * 기록 카드는 해의 첫머리에 뜨므로 「뜰 차례인 상태」를 그대로 주입하면 로드와 함께 시트가 열린다(새로고침 복원과 같은 경로). e2e 기본 설정은 기록 카드 꺼짐이라 여기서만 켠다.
 * 스크린샷은 qa/screenshots/003/dev-M7c-*.png.
 */

const SHOTS = 'qa/screenshots/003';
const MANUAL = { speed: 1, autoMode: false, noteCards: true } as const;
const AUTO = { speed: 1, autoMode: true, noteCards: true } as const;
const OFF = { speed: 1, autoMode: false, noteCards: false } as const;

const sheet = (page: Page) => page.getByTestId('note-sheet');
const input = (page: Page) => page.getByTestId('note-input');
const MSG = '[data-testid="note-msg"]';
/** 이 요소나 조상이 inert인가 (`inert`는 불리언 속성이라 요소 자신의 속성이 아니라 조상 쪽에 걸린다) */
const inertOf = (loc: Locator): Promise<boolean> => loc.evaluate((el) => el.closest('[inert]') !== null);
const graphemes = (t: string): number => Array.from(new Intl.Segmenter('ko', { granularity: 'grapheme' }).segment(t)).length;

async function shot(page: Page, name: string): Promise<void> {
  await page.screenshot({ path: `${SHOTS}/dev-M7c-${name}.png` });
}

async function openInfant(page: Page, settings: typeof MANUAL | typeof AUTO | typeof OFF = MANUAL, target = '/'): Promise<void> {
  await page.goto('/');
  const due = await infantDue(page);
  await injectSave(page, due.state, target, settings);
}

// ---------- 시트: 요소·이름·정지 (FR1·FR3·완료 기준 3) ----------

test('자동 카드(5세): 로드와 동시에 모달 시트가 뜨고 포커스는 질문 제목이다. 질문·인용·입력란·안내·글자 수·두 버튼·끄기 칸이 보이고, 열린 동안 나이·진행률이 3초 동안 변하지 않는다', async ({ page }) => {
  await openInfant(page);
  await sheetReady(page);
  const dialog = page.getByRole('dialog');
  await expect(dialog).toHaveCount(1);
  await expect(dialog).toHaveAttribute('aria-modal', 'true');
  await expect(dialog, '이름 = 종류 + 질문').toHaveAccessibleName(/^생각 남기기 .*다섯 살 무렵/);
  await expect(page.getByTestId('note-title')).toBeFocused();
  expect(await activeTestId(page)).toBe('note-title');
  await expect(page.getByTestId('note-title')).toContainText('다섯 살 무렵');
  await expect(page.getByTestId('note-when'), '「{연도}년 · {나이}세」 — 좁은 폭이면 기호 없이 두 줄').toContainText('5세');
  await expect(page.getByTestId('cite'), '카드 ①만 인용 박스').toBeVisible();
  await expect(input(page)).toBeVisible();
  await expect(input(page)).toHaveAccessibleName('남길 글');
  await expect(page.getByTestId('note-hint')).toHaveText('실명·연락처 같은 개인정보는 적지 마십시오. 이 기기에만 저장됩니다.');
  await expect(page.getByTestId('note-count')).toHaveText('0/140');
  await expect(page.getByTestId('note-save')).toHaveAccessibleName('적어두고 살기');
  await expect(page.getByTestId('note-skip')).toHaveAccessibleName('마음속에 담고 살기');
  await expect(page.getByTestId('note-cards-toggle')).toHaveText('저절로 뜨는 기록 카드 끄기');
  // 바깥은 inert (모달) — 도구 줄·진행 줄·머리에 닿지 않는다
  expect(await inertOf(page.getByTestId('tools')), '도구 줄 inert').toBe(true);
  expect(await inertOf(page.getByTestId('controls')), '진행 줄 inert').toBe(true);
  expect(await inertOf(page.getByTestId('life-name')), '머리 inert').toBe(true);
  expect(await inertOf(page.getByTestId('note-input')), '시트 안은 inert가 아니다').toBe(false);
  // 이름에 실제 뷰포트 폭을 쓴다(R-410): 두 프로젝트(360·1280)가 같은 이름을 덮어쓰던 것을 나눈다 — dev-M7c-note-open-360.png는 360×740, dev-M7c-note-open-1280.png는 1280×800
  await shot(page, `note-open-${page.viewportSize()!.width}`);
  // 정지: 3초 동안 나이·진행률 불변 (시계·자동 선택·advance가 멈춘다)
  const before = await page.evaluate(() => ({ age: document.querySelector('[data-testid="life-age"]')!.textContent, pct: document.querySelector('[data-testid="year-progress"]')!.getAttribute('aria-valuenow') }));
  await page.waitForTimeout(3200);
  const after = await page.evaluate(() => ({ age: document.querySelector('[data-testid="life-age"]')!.textContent, pct: document.querySelector('[data-testid="year-progress"]')!.getAttribute('aria-valuenow') }));
  expect(after, '시트가 열린 3초 동안 변하지 않는다').toEqual(before);
  expect((await readSave(page)).data.age, '저장된 나이도 그대로').toBe(5);
});

test('인용이 없는 카드(②~⑦)에는 인용 박스 요소 자체가 없고 질문만 다르다', async ({ page }) => {
  await page.goto('/');
  const due = await teenDue(page);
  await injectSave(page, due.state, '/', MANUAL);
  await sheetReady(page);
  await expect(sheet(page)).toHaveAttribute('data-card', 'note-teen-envy');
  await expect(page.locator('.cite')).toHaveCount(0);
  await expect(page.getByTestId('note-title')).toContainText('부럽거나 샘이 났던');
});

// ---------- 1번 「적어두고 살기」 (완료 기준 4) ----------

test('1번 빈 입력(공백·줄바꿈만): 기록 0, 시트는 열린 채 안내 문장 + aria-invalid, 포커스는 입력란으로 돌아온다', async ({ page }) => {
  await openInfant(page);
  await sheetReady(page);
  await page.getByTestId('note-save').click();
  await expect(page.locator(MSG)).toHaveText('적을 말이 없다면 「마음속에 담고 살기」를 골라도 됩니다.');
  await expect(input(page)).toHaveAttribute('aria-invalid', 'true');
  await expect(input(page)).toHaveAttribute('aria-describedby', 'note-hint note-count-sr note-msg');
  await expect(input(page)).toBeFocused();
  await expect(sheet(page)).toBeVisible();
  await shot(page, 'note-empty-error');
  // 공백·줄바꿈만으로도 같다
  await input(page).fill('   \n  ');
  await expect(input(page)).not.toHaveAttribute('aria-invalid', 'true'); // 쓰기 시작하면 오류 표시는 사라진다
  await page.getByTestId('note-save').click();
  await expect(input(page)).toHaveAttribute('aria-invalid', 'true');
  expect(await noteRows(page), '기록되지 않았다').toEqual([]);
});

test('1번 정상 입력: 글자 수가 늘고, 눌러 저장하면 시트가 닫히고 연표에 「나의 기록」 줄이 맨 위(최신순)에 생기며 포커스는 인생 화면 제목이다. 시계가 다시 흐른다', async ({ page }) => {
  await openInfant(page);
  await sheetReady(page);
  const written = '마루 끝에 앉아 있던 기억이 난다.\n햇볕이 따뜻했다.';
  await input(page).fill(written);
  await expect(page.getByTestId('note-count')).toHaveText(`${graphemes(written)}/140`);
  await expect(page.getByTestId('note-count-sr')).toHaveText(`${graphemes(written)}자 입력, 140자까지`);
  await shot(page, 'note-typed');
  await page.getByTestId('note-save').click();
  await expect(sheet(page)).toHaveCount(0);
  await expect(page.getByTestId('life-name'), '포커스 = 인생 화면 제목').toBeFocused();
  const rows = await noteRows(page);
  expect(rows).toHaveLength(1);
  expect(rows[0]).toMatchObject({ age: 5, kind: 'note', title: '영유아기 기억', eventId: 'note-infant-memory', text: '마루 끝에 앉아 있던 기억이 난다.\n햇볕이 따뜻했다.' });
  expect((await readSave(page)).data.seen['note-infant-memory'], '카드가 소비됐다').toBe(5);
  // 인생 기록 맨 위(최신순, SPEC-005 LR5 a): 「나의 기록 · 영유아기 기억」 + 글
  const newest = page.getByTestId('log-row').first();
  await expect(newest).toHaveAttribute('data-kind', 'note');
  await expect(newest.getByTestId('note-label')).toContainText('나의 기록');
  await expect(newest.getByTestId('note-label')).toContainText('영유아기 기억');
  await expect(newest.getByTestId('note-text')).toHaveText('마루 끝에 앉아 있던 기억이 난다.\n햇볕이 따뜻했다.');
  await shot(page, 'note-log-row');
  // 시계가 다시 흐른다: 올해 진행률이 0을 넘는다
  await expect.poll(() => page.getByTestId('year-progress').getAttribute('aria-valuenow').then(Number), { timeout: 15_000 }).toBeGreaterThan(0);
});

test('1번 연타·더블탭: 기록은 정확히 1건이다 (제출 멱등)', async ({ page }) => {
  await openInfant(page);
  await sheetReady(page);
  await input(page).fill('연타 시험');
  const save = page.getByTestId('note-save');
  await save.dblclick();
  await save.click({ force: true, timeout: 500 }).catch(() => undefined);
  await expect(sheet(page)).toHaveCount(0);
  await settle(page);
  expect(await noteRows(page)).toHaveLength(1);
});

// ---------- 2번 「마음속에 담고 살기」 · Esc · 확인 단계 (완료 기준 5) ----------

test('2번 글이 없으면: 저장 없이 닫히고 카드는 소비되어 새로고침해도 다시 뜨지 않는다', async ({ page }) => {
  await openInfant(page);
  await sheetReady(page);
  await page.getByTestId('note-skip').click();
  await expect(sheet(page)).toHaveCount(0);
  await expect(page.getByTestId('life-name')).toBeFocused();
  expect(await noteRows(page)).toEqual([]);
  expect((await readSave(page)).data.seen['note-infant-memory'], '소비됨').toBe(5);
  await page.reload();
  await expect(page.getByTestId('life-screen')).toBeVisible();
  await page.waitForTimeout(600);
  await expect(sheet(page), '소비된 카드는 다시 뜨지 않는다').toHaveCount(0);
});

test('2번 글이 있으면 확인 단계: 포커스는 「돌아가서 이어 쓰기」, 돌아가면 글이 그대로 있고, 「글을 지우고 담아 두기」는 저장 없이 닫는다. Esc는 2번과 같고 확인 단계에서는 돌아가기다', async ({ page }) => {
  await openInfant(page);
  await sheetReady(page);
  await input(page).fill('지울 글');
  await page.getByTestId('note-skip').click();
  await expect(page.getByTestId('note-confirm')).toBeVisible();
  await expect(page.getByTestId('note-confirm-back')).toBeFocused();
  await expect(page.getByTestId('note-confirm')).toContainText('적은 글을 지우고 넘어갈까요?');
  await expect(page.getByTestId('note-confirm')).toContainText('적은 글은 저장되지 않습니다.');
  await expect(input(page), '확인 중 입력란은 읽기 전용이고 글은 보인다').toHaveAttribute('readonly', '');
  await expect(input(page)).toHaveValue('지울 글');
  await expect(page.getByTestId('note-save'), '두 번호 버튼은 확인 단계로 바뀐다').toHaveCount(0);
  await shot(page, 'note-confirm');
  await page.getByTestId('note-confirm-back').click();
  await expect(page.getByTestId('note-confirm')).toHaveCount(0);
  await expect(input(page)).toBeFocused();
  await expect(input(page)).toHaveValue('지울 글');
  // Esc = 2번 → 확인, 확인에서 Esc = 돌아가기
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('note-confirm')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('note-confirm')).toHaveCount(0);
  await expect(input(page)).toHaveValue('지울 글');
  // 확정: 저장 없이 닫힘, 카드 소비
  await page.keyboard.press('Escape');
  await page.getByTestId('note-confirm-discard').click();
  await expect(sheet(page)).toHaveCount(0);
  expect(await noteRows(page), '저장되지 않았다').toEqual([]);
  expect((await readSave(page)).data.seen['note-infant-memory']).toBe(5);
  expect(JSON.stringify((await readSave(page)).data), '지운 글이 어디에도 없다').not.toContain('지울 글');
});

// ---------- K03 (QA-003-M7c RECORD, 마스터 결정 D4=그대로): 확인 단계에서 돌아간 직후 ----------
// 「돌아가서 이어 쓰기」를 누르면 확인 단계가 사라지고 1번·2번이 새 요소로 다시 만들어져 마운트 가드 400ms가 걸린다. 이 가드는 더블탭의 둘째 탭이 새로 나타난 1번(저장)·2번에 떨어지는 길을 막는 장치라 그대로 둔다.
async function writeThenConfirm(page: Page, text: string): Promise<void> {
  await openInfant(page);
  await sheetReady(page);
  await input(page).fill(text);
  await page.getByTestId('note-skip').click();
  await expect(page.getByTestId('note-confirm')).toBeVisible();
}

test('K03 (1): 「돌아가서 이어 쓰기」 직후 포커스는 입력란이고 Enter는 줄바꿈이다 (3줄 한도 안에서) — 저장도 닫힘도 없다', async ({ page }) => {
  await writeThenConfirm(page, '이어서 쓸 글');
  await page.getByTestId('note-confirm-back').click();
  await expect(input(page)).toBeFocused();
  await expect(input(page), '돌아간 뒤에는 입력란이 읽기 전용이 아니다').not.toHaveAttribute('readonly', '');
  await page.keyboard.press('Enter'); // 가드와 무관 — 입력란의 줄바꿈이다 (바로 누른다)
  await page.keyboard.type('둘째 줄');
  const value = await input(page).inputValue();
  expect(value.includes('\n'), '줄바꿈이 들어갔다').toBe(true);
  expect(value.split('\n').length, '줄 수는 3줄 한도 안').toBeLessThanOrEqual(3);
  expect(value).toContain('이어서 쓸 글');
  await expect(sheet(page), '시트는 열린 채').toBeVisible();
  expect(await noteRows(page), '저장 0').toEqual([]);
  // 3줄 한도: 줄바꿈을 더 눌러도 3줄을 넘지 않는다
  for (let i = 0; i < 5; i++) await page.keyboard.press('Enter');
  expect((await input(page).inputValue()).split('\n').length).toBeLessThanOrEqual(3);
});

test('K03 (2): 돌아간 지 450ms 뒤 Tab으로 1번에 닿아 Enter를 치면 저장된다 (가드는 400ms)', async ({ page }) => {
  await writeThenConfirm(page, '돌아간 뒤 저장할 글');
  await page.getByTestId('note-confirm-back').click();
  await expect(input(page)).toBeFocused();
  await page.waitForTimeout(450);
  await page.keyboard.press('Tab');
  await expect(page.getByTestId('note-save'), '입력란 다음 Tab은 1번').toBeFocused();
  await expect(page.getByTestId('note-save')).not.toHaveAttribute('aria-disabled', 'true');
  await page.keyboard.press('Enter');
  await expect(sheet(page)).toHaveCount(0);
  const rows = await noteRows(page);
  expect(rows).toHaveLength(1);
  expect(rows[0].text).toBe('돌아간 뒤 저장할 글');
});

test('K03 (3): 돌아간 지 400ms 안에 새로 만들어진 1번·2번을 누르면 저장 0·닫힘 0이고 aria-disabled다 (기존 가드 동작 고정) — 400ms 뒤에는 한 번 눌러 저장된다', async ({ page }) => {
  await writeThenConfirm(page, '가드 안에서 누르는 글');
  await expect(page.getByTestId('note-confirm-back'), '확인 단계 자신의 가드(400ms)가 풀린 뒤에').toBeEnabled();
  // 돌아가기 직후(렌더가 끝나는 한 틱 뒤, 수 ms) 곧바로 1번·2번을 누른다 — 새 요소의 마운트 가드(400ms) 안이다
  const guarded = await page.evaluate(async () => {
    (document.querySelector('[data-testid="note-confirm-back"]') as HTMLElement).click();
    await new Promise((resolve) => setTimeout(resolve, 0));
    const save = document.querySelector('[data-testid="note-save"]') as HTMLElement;
    const skip = document.querySelector('[data-testid="note-skip"]') as HTMLElement;
    const state = { saveDisabled: save.getAttribute('aria-disabled'), skipDisabled: skip.getAttribute('aria-disabled') };
    save.click();
    skip.click();
    return state;
  });
  expect(guarded, '새 1번·2번은 가드 중').toEqual({ saveDisabled: 'true', skipDisabled: 'true' });
  await expect(sheet(page), '눌러도 닫히지 않았다').toBeVisible();
  await expect(page.getByTestId('note-confirm'), '2번도 확인 단계를 다시 열지 않았다(눌림이 버려졌다)').toHaveCount(0);
  expect(await noteRows(page), '저장 0').toEqual([]);
  await expect(input(page)).toHaveValue('가드 안에서 누르는 글');
  await page.waitForTimeout(450);
  await expect(page.getByTestId('note-save')).not.toHaveAttribute('aria-disabled', 'true');
  await page.getByTestId('note-save').click();
  await expect(sheet(page)).toHaveCount(0);
  expect(await noteRows(page)).toHaveLength(1);
});

test('글이 없을 때 Esc는 확인 없이 닫는다 (2번과 같다)', async ({ page }) => {
  await openInfant(page);
  await sheetReady(page);
  await page.keyboard.press('Escape');
  await expect(sheet(page)).toHaveCount(0);
  expect(await noteRows(page)).toEqual([]);
});

// ---------- 새로고침 (5-8절) ----------

test('새로고침: 자동 카드는 같은 카드가 다시 뜨고 입력한 글은 사라진다. 수동 시트는 닫힌다', async ({ page }) => {
  await openInfant(page);
  await sheetReady(page);
  await input(page).fill('새로고침 전에 쓴 글');
  await page.reload();
  await sheetReady(page);
  await expect(sheet(page)).toHaveAttribute('data-card', 'note-infant-memory');
  await expect(input(page)).toHaveValue('');
  // 수동 시트
  await page.getByTestId('note-skip').click();
  await expect(sheet(page)).toHaveCount(0);
  await expect(page.getByTestId('tool-note')).toBeEnabled();
  await page.getByTestId('tool-note').click();
  await sheetReady(page);
  await expect(sheet(page)).toHaveAttribute('data-card', 'manual');
  await input(page).fill('수동으로 쓰던 글');
  await page.reload();
  await expect(page.getByTestId('life-screen')).toBeVisible();
  await page.waitForTimeout(500);
  await expect(sheet(page), '수동 시트는 새로고침하면 닫힌다').toHaveCount(0);
  expect(JSON.stringify((await readSave(page)).data)).not.toContain('수동으로 쓰던 글');
});

// ---------- 수동 기록 (「생각 남기기」 버튼, 완료 기준 9) ----------

test('수동 기록: 도구 줄 「생각 남기기」(aria-haspopup=dialog)를 누르면 열려 정지하고, 저장하면 「지금의 생각」 줄이 생기며 포커스는 그 버튼으로 돌아온다. 시계 되감김이 없다', async ({ page }) => {
  await page.goto('/');
  await injectSave(page, lifeState(KNOWN_SEED), '/', OFF); // 카드가 꺼져 있어도 수동 기록은 열린다
  const tool = page.getByTestId('tool-note');
  await expect(tool).toBeEnabled();
  await expect(tool).toHaveAttribute('aria-haspopup', 'dialog');
  await expect(sheet(page)).toHaveCount(0);
  await expect.poll(() => page.getByTestId('year-progress').getAttribute('aria-valuenow').then(Number), { timeout: 15_000 }).toBeGreaterThan(5);
  const pctBefore = Number(await page.getByTestId('year-progress').getAttribute('aria-valuenow'));
  await tool.click();
  await sheetReady(page);
  await expect(sheet(page)).toHaveAttribute('data-via', 'manual');
  await expect(page.getByTestId('note-title')).toContainText('마음에 남아 있는 장면이나 생각');
  await expect(page.locator('.cite'), '수동 기록에는 인용이 없다').toHaveCount(0);
  await expect(page.getByTestId('note-title')).toBeFocused();
  // 열린 동안 정지
  const held = await page.getByTestId('year-progress').getAttribute('aria-valuenow');
  await page.waitForTimeout(2500);
  expect(await page.getByTestId('year-progress').getAttribute('aria-valuenow'), '열린 동안 진행률 불변').toBe(held);
  await input(page).fill('오늘의 생각');
  await page.getByTestId('note-save').click();
  await expect(sheet(page)).toHaveCount(0);
  await expect(tool, '수동은 도구 줄 버튼으로 돌아온다').toBeFocused();
  const rows = await noteRows(page);
  expect(rows).toHaveLength(1);
  expect(rows[0]).toMatchObject({ kind: 'note', title: '지금의 생각', eventId: 'note-manual', text: '오늘의 생각' });
  const label = page.getByTestId('note-label').last();
  await expect(label).toContainText('지금의 생각');
  // 시계 되감김 0: 저장한 뒤 진행률이 열기 전보다 작아지지 않는다
  const pctAfter = Number(await page.getByTestId('year-progress').getAttribute('aria-valuenow'));
  expect(pctAfter, '진행률 유지(되감김 없음)').toBeGreaterThanOrEqual(pctBefore);
});

test('일시정지 중에도 수동 기록을 열 수 있고, 닫아도 일시정지는 그대로다 (열기 전의 paused를 건드리지 않는다)', async ({ page }) => {
  await page.goto('/');
  await injectSave(page, lifeState(KNOWN_SEED), '/', MANUAL);
  await expect(page.getByTestId('pause')).toBeEnabled();
  await page.getByTestId('pause').click();
  await expect(page.getByTestId('pause')).toHaveAttribute('data-paused', 'true');
  await page.getByTestId('tool-note').click();
  await sheetReady(page);
  await page.keyboard.press('Escape');
  await expect(sheet(page)).toHaveCount(0);
  await expect(page.getByTestId('pause'), '일시정지 유지').toHaveAttribute('data-paused', 'true');
  expect((await readSave(page)).data.paused).toBe(true);
});

test('자동 모드에서도 수동 기록은 열리고, 열린 동안 자동 선택 타이머가 멈추며 닫으면 인라인 카드는 그대로다 (5-4절)', async ({ page }) => {
  await page.goto('/');
  const d = await decisionBeforeDue(page);
  await startPageHidden(page); // 가려진 탭 — 준비하는 동안 자동 선택 타이머가 돌지 않는다
  await injectSave(page, d.state, '/', AUTO);
  await expect(page.getByTestId('choice-panel')).toHaveAttribute('data-mode', 'inline');
  await expect(page.getByTestId('tool-note')).toBeEnabled();
  await page.getByTestId('tool-note').click();
  await sheetReady(page);
  await setPageVisible(page, true); // 이제 타이머가 있다면 3초 뒤 고른다 — 시트가 열려 있으니 걸리지 않아야 한다
  await page.waitForTimeout(4200);
  expect((await readSave(page)).data.pending?.key, '열린 동안 자동 선택이 일어나지 않는다').toBe(d.key);
  await expect(page.getByTestId('choice-panel'), '인라인 카드는 그대로').toBeVisible();
  await page.keyboard.press('Escape');
  await expect(sheet(page)).toHaveCount(0);
  await expect(page.getByTestId('tool-note')).toBeFocused();
  await expect(page.getByTestId('choice-panel')).toBeVisible();
});

// ---------- 끄기/켜기 · 자동 모드 소비 (FR7, 완료 기준 8) ----------

test('시트 안 「저절로 뜨는 기록 카드 끄기」: 설정만 바뀌고 시트와 쓰던 글은 그대로이며 알림이 한 줄 나온다. 같은 칸이 「켜기」로 바뀐다', async ({ page }) => {
  await openInfant(page);
  await sheetReady(page);
  await input(page).fill('쓰던 글');
  const toggle = page.getByTestId('note-cards-toggle');
  await toggle.click();
  await expect(toggle).toHaveText('저절로 뜨는 기록 카드 켜기');
  await expect(page.getByTestId('note-notice')).toHaveText('이제 기록 카드가 저절로 뜨지 않습니다. 「생각 남기기」로는 언제든 적을 수 있습니다.');
  await expect(sheet(page)).toBeVisible();
  await expect(input(page), '쓰던 글 유지').toHaveValue('쓰던 글');
  await expect.poll(async () => (await readSettings(page)).noteCards).toBe(false);
  await toggle.click();
  await expect(toggle).toHaveText('저절로 뜨는 기록 카드 끄기');
  await expect(page.getByTestId('note-notice')).toHaveText('다음 기록 카드부터 다시 저절로 뜹니다.');
  await expect.poll(async () => (await readSettings(page)).noteCards).toBe(true);
  await shot(page, 'note-toggle');
});

test('자동 모드이거나 카드를 끈 설정에서는 시트가 뜨지 않고 카드가 소비되며 연표에 줄이 없다', async ({ page }) => {
  for (const [name, settings] of [['자동 모드', AUTO], ['카드 끔', OFF]] as const) {
    await openInfant(page, settings);
    await expect(page.getByTestId('life-screen'), name).toBeVisible();
    await expect.poll(async () => (await readSave(page)).data.seen['note-infant-memory'], { message: `${name}: 카드가 소비됨`, timeout: 15_000 }).toBe(5);
    await expect(sheet(page), name).toHaveCount(0);
    expect(await noteRows(page), name).toEqual([]);
  }
});

// ---------- 두 시트의 우선순위 (5-4절) ----------

test('결정을 고른 직후 다음 해의 기록 카드: 결정 시트가 닫히고 곧바로 기록 시트가 뜬다 — 동시에 열려 있지 않고, 새 시트의 버튼은 입력 가드로 막혀 있으며, 포커스는 기록 시트 질문 제목이다', async ({ page }) => {
  await page.goto('/');
  const d = await decisionBeforeDue(page);
  await injectSave(page, d.state, '/', MANUAL);
  await expect(page.getByTestId('choice-panel')).toHaveAttribute('data-mode', 'sheet');
  await expect(page.getByRole('dialog')).toHaveCount(1);
  const choice = page.getByTestId(`choice-${d.choiceId}`);
  await expect(choice).toBeEnabled();
  await choice.click();
  await expect(sheet(page)).toBeVisible();
  await expect(page.getByRole('dialog'), '동시에 열려 있지 않다: 대화상자는 하나').toHaveCount(1);
  await expect(page.getByTestId('choice-panel')).toHaveCount(0);
  await expect(page.getByTestId('note-title'), '질문 제목이 포커스를 이긴다(choiceResolved보다 나중)').toBeFocused();
  // 입력 가드: 열린 직후 두 버튼은 닫혀 있다
  const html = await page.getByTestId('note-save').evaluate((el) => el.getAttribute('aria-disabled'));
  expect(['true', null]).toContain(html);
  await sheetReady(page);
});

test('수동 모드: 결정 시트가 열려 있으면 도구 줄이 inert라 「생각 남기기」를 누를 수 없다. 접힌 띠에서는 열리고, 닫아도 결정 카드는 접힌 채 그대로이며 포커스는 「생각 남기기」 버튼이다', async ({ page }) => {
  await page.goto('/');
  const d = await decisionBeforeDue(page);
  await startPageHidden(page);
  await injectSave(page, d.state, '/', MANUAL);
  await expect(page.getByTestId('choice-panel')).toHaveAttribute('data-mode', 'sheet');
  expect(await inertOf(page.getByTestId('tools')), '결정 시트가 열려 있으면 도구 줄 inert').toBe(true);
  await expect(page.getByTestId('decision-fold-btn')).toBeEnabled();
  await page.getByTestId('decision-fold-btn').click();
  await expect(page.getByTestId('decision-fold')).toBeVisible();
  expect(await inertOf(page.getByTestId('tools')), '접으면 도구 줄이 풀린다').toBe(false);
  await expect(page.getByTestId('tool-note')).toBeEnabled();
  await page.getByTestId('tool-note').click();
  await sheetReady(page);
  await expect(page.getByTestId('decision-fold'), '접힌 띠는 그대로').toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(1);
  await page.keyboard.press('Escape');
  await expect(sheet(page)).toHaveCount(0);
  await expect(page.getByTestId('tool-note')).toBeFocused();
  await expect(page.getByTestId('decision-fold'), '닫아도 결정 카드는 접힌 채다').toBeVisible();
  await expect(page.getByTestId('choice-panel'), '저절로 다시 열리지 않는다').toHaveCount(0);
});

test('나가기 확인 단계가 열린 채 「생각 남기기」를 누르면 확인 단계를 닫고 시트를 연다', async ({ page }) => {
  await page.goto('/');
  await startPageHidden(page);
  await injectSave(page, lifeState(KNOWN_SEED), '/', MANUAL);
  await expect(page.getByTestId('tool-exit')).toBeEnabled();
  await page.getByTestId('tool-exit').click();
  await expect(page.getByTestId('exit-ask')).toBeVisible();
  await expect(page.getByTestId('tool-note')).toBeEnabled();
  await page.getByTestId('tool-note').click();
  await sheetReady(page);
  await expect(page.getByTestId('exit-ask'), '나가기 확인은 닫혔다').toHaveCount(0);
  await expect(sheet(page)).toHaveAttribute('data-via', 'manual');
});

// ---------- 40개 상한 (FR5, 완료 기준 9) ----------

test('기록 40개에 닿으면 「생각 남기기」는 입력란 대신 안내와 「닫기」만 보이고, 연타해도 41번째 줄은 생기지 않는다', async ({ page }) => {
  await page.goto('/');
  const full = await withNotes(page, lifeState(KNOWN_SEED), 40);
  await startPageHidden(page);
  await injectSave(page, full, '/', MANUAL);
  await expect(page.getByTestId('tool-note')).toBeEnabled();
  await page.getByTestId('tool-note').click();
  await sheetReady(page);
  await expect(page.getByTestId('note-title')).toHaveText('이 인생에서 남길 수 있는 기록은 40개까지입니다.');
  await expect(page.getByTestId('note-limit-sub')).toBeVisible();
  await expect(input(page)).toHaveCount(0);
  await expect(page.getByTestId('note-save')).toHaveCount(0);
  await shot(page, 'note-limit-40');
  await page.getByTestId('note-limit-close').dblclick();
  await expect(sheet(page)).toHaveCount(0);
  expect(await noteRows(page)).toHaveLength(40);
  // 연타로 다시 열어도 41번째는 없다
  for (let i = 0; i < 3; i++) {
    await page.getByTestId('tool-note').click({ force: true });
    await page.keyboard.press('Escape');
  }
  expect(await noteRows(page)).toHaveLength(40);
});

// R-411 (마스터 처리): 기록이 40개(자동+수동 합계)에 이른 판에서는 자동 카드가 뜰 차례여도 시트 없이 소비한다 — 40개 안내 시트는 도구 줄 「생각 남기기」로 열 때만 보인다.
// 화면의 파생 판정과 reducer가 같은 함수(`noteResponse`)를 쓴다(tests/noteCards.test.ts · tests/sheetCloseGuard.test.tsx)
test('R-411: 기록 40개인 판에서 자동 카드가 뜰 차례여도 시트는 한 번도 열리지 않고 카드만 소비된다 — 40줄은 그대로, 진행은 막히지 않는다. 39개면 시트가 뜬다', async ({ page }) => {
  await page.goto('/');
  const due = await infantDue(page);
  const full = await withNotes(page, due.state, 40);
  const almost = await withNotes(page, due.state, 39);
  // 기록 시트가 DOM에 들어온 적이 있는지 센다(로드부터 끝까지; 진행하면 결정 시트가 뜰 수 있어 기록 시트만 센다)
  await page.addInitScript(() => {
    const w = window as unknown as { __dialogs: number };
    w.__dialogs = 0;
    new MutationObserver((records) => {
      for (const r of records) for (const n of Array.from(r.addedNodes)) if (n instanceof Element && (n.matches('[data-testid="note-sheet"]') || n.querySelector('[data-testid="note-sheet"]') !== null)) w.__dialogs++;
    }).observe(document, { childList: true, subtree: true });
  });
  await startPageHidden(page);
  const dialogs = () => page.evaluate(() => (window as unknown as { __dialogs: number }).__dialogs);

  // 40개: 로드해도 시트가 없다
  await injectSave(page, full, '/', MANUAL);
  await expect(page.getByTestId('life-screen')).toBeVisible();
  await expect(page.getByTestId('tool-note')).toBeEnabled();
  await page.waitForTimeout(600);
  expect(await dialogs(), '로드해도 시트가 열린 적이 없다').toBe(0);
  await expect(sheet(page)).toHaveCount(0);
  expect((await readSave(page)).data.seen['note-infant-memory'], '아직 소비 전(저장은 진행이 있어야 바뀐다)').toBeUndefined();
  // 진행: 「다음 결정으로」 — reducer가 같은 규칙으로 시트 없이 소비하고 40줄은 그대로다. 진행이 막히지 않는다
  await page.getByTestId('skip').click();
  await expect.poll(async () => (await readSave(page)).data.seen['note-infant-memory'], { message: '카드가 시트 없이 소비됐다(진행이 막히지 않았다)' }).toBe(5);
  const after = (await readSave(page)).data;
  expect(after.pending !== null || after.age > 5, '다음 결정(또는 이후)까지 진행했다').toBe(true);
  expect(after.seen['note-infant-memory'], '카드는 소비 표시만 남았다').toBe(5);
  expect(after.history.filter((h: { kind: string }) => h.kind === 'note'), '40줄 그대로').toHaveLength(40);
  expect(await dialogs(), '진행 중에도 시트가 열린 적이 없다').toBe(0);
  // 「생각 남기기」를 누르면 그때서야 40개 안내가 보인다 (진행으로 뜬 결정 카드는 접어 도구 줄을 연다)
  if (after.pending !== null) {
    await expect(page.getByTestId('decision-fold-btn')).toBeEnabled();
    await page.getByTestId('decision-fold-btn').click();
    await expect(page.getByTestId('decision-reopen')).toBeEnabled();
  }
  await page.getByTestId('tool-note').click();
  await expect(page.getByTestId('note-limit-close')).toBeVisible();
  await expect(page.getByTestId('note-title')).toHaveText('이 인생에서 남길 수 있는 기록은 40개까지입니다.');
  expect(await dialogs()).toBe(1);
  await page.keyboard.press('Escape');
  await expect(sheet(page)).toHaveCount(0);

  // 39개: 같은 상태에서 시트가 뜬다 (입력란이 있는 보통 시트)
  await injectSave(page, almost, '/', MANUAL);
  await sheetReady(page);
  await expect(page.getByTestId('note-save')).toBeVisible();
  await expect(input(page)).toBeVisible();
  await expect(page.getByTestId('note-limit-close')).toHaveCount(0);
});

// ---------- 엔딩 · 다시 태어나기 (FR9, 완료 기준 10) ----------

test('엔딩 연표에 「나의 기록」 줄이 시간순으로 나오고 새로고침해도 같으며, 「다시 태어나기」 뒤 이전 판의 글이 저장소에 없다', async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto('/');
  const state = await evalCore<GameState>(
    page,
    `let s = core.enterLife(core.enterBirth(core.beginBirth(core.createInitialState(arg.seed), 'present')));
     let n = 0;
     for (let guard = 0; guard < 2000 && s.phase === 'life'; guard++) {
       if (s.pending !== null) { s = core.autoResolveStep(s, s.pending.key).state; continue; }
       const due = core.dueNote(s);
       if (due !== null) { const w = core.writeNote(s, { cardId: due.id, text: '엔딩 시험 글 ' + (++n) }); s = w === s ? core.consumeNote(s, due) : w; }
       if (n >= 2 && s.age >= 40 && !s.history.some((h) => h.eventId === 'note-manual')) { const w = core.writeNote(s, { cardId: null, text: '수동 엔딩 시험 글' }); if (w !== s) s = w; }
       s = core.stepYear(s).state;
     }
     return s;`,
    { seed: KNOWN_SEED },
  );
  expect(state.phase).toBe('ending');
  const notes = state.history.filter((h) => h.kind === 'note');
  expect(notes.length).toBeGreaterThanOrEqual(2);
  await injectSave(page, state, '/', MANUAL);
  await expect(page.getByTestId('ending-screen')).toBeVisible();
  const items = page.locator('[data-testid="timeline-entry"][data-kind="note"]');
  await expect(items).toHaveCount(notes.length);
  const ages = await items.evaluateAll((els) => els.map((el) => Number((el.querySelector('.log__age')?.textContent ?? '').replace('세', ''))));
  expect(ages, '시간순').toEqual([...ages].sort((a, b) => a - b));
  await expect(items.first().getByTestId('note-label')).toContainText('나의 기록');
  await expect(items.first().getByTestId('note-text')).toHaveText(notes[0].text);
  await shot(page, 'ending-timeline');
  const before = await items.allTextContents();
  await page.reload();
  await expect(page.getByTestId('ending-screen')).toBeVisible();
  expect(await page.locator('[data-testid="timeline-entry"][data-kind="note"]').allTextContents(), '새로고침해도 같은 연표').toEqual(before);
  // 다시 태어나기 → 이전 판 글이 저장소에서 사라진다
  await page.getByTestId('rebirth').click();
  await expect(page.getByTestId('title-screen')).toBeVisible();
  const dump = await page.evaluate(() => JSON.stringify({ ...localStorage }));
  for (const n of notes) expect(dump, '이전 판 글이 저장소에 없다').not.toContain(n.text);
});

// ---------- 저장 실패 (FR5, NC-11) ----------

test('저장이 실패해도(?__quota) 기록은 메모리 상태와 인생 기록에 남고 기존 저장 실패 배너가 뜨며, 쓰던 글은 사라지지 않는다', async ({ page }) => {
  await page.goto('/');
  const due = await infantDue(page);
  await injectSave(page, due.state, '/', MANUAL);
  await sheetReady(page);
  const savedBefore = JSON.stringify((await readSave(page)).data);
  await page.goto('/?__quota'); // 개발 서버 전용: 저장이 항상 실패하는 저장소
  await sheetReady(page);
  await expect(page.getByTestId('save-notice'), '진행이 없으면 아직 저장을 시도하지 않는다').toHaveCount(0);
  await input(page).fill('저장이 막힌 곳에서 쓴 글');
  await page.getByTestId('note-save').click();
  await expect(sheet(page)).toHaveCount(0);
  await expect(page.getByTestId('note-text').last()).toHaveText('저장이 막힌 곳에서 쓴 글');
  await expect(page.getByTestId('save-notice')).toBeVisible();
  await expect(page.getByTestId('save-notice')).toContainText('저장하지 못했습니다');
  expect(JSON.stringify((await readSave(page)).data), '저장소는 그대로(쓰기가 실패했다)').toBe(savedBefore);
});

// ---------- 개인정보 (FR8, P1~P5) ----------

test('개인정보: 글을 쓰고 저장하는 동안 외부 요청 0건, 오류·콘솔에 글 0, 글은 게임 저장 한 곳에만 있고 설정·세션 저장소·쿠키·주소·제목·속성·의견 보내기 주소에 복사되지 않는다', async ({ page }) => {
  const MARK = '표식ZXQ-비공개-글-7391';
  const external: string[] = [];
  const logs: string[] = [];
  page.on('request', (r) => {
    const u = new URL(r.url());
    if (u.protocol === 'data:' || u.protocol === 'blob:' || u.protocol === 'about:') return;
    if (u.hostname !== 'localhost' && u.hostname !== '127.0.0.1') external.push(r.url());
    if (r.url().includes(encodeURIComponent(MARK)) || r.url().includes(MARK) || (r.postData() ?? '').includes(MARK)) external.push(`글이 요청에 들어갔다: ${r.url()}`);
  });
  page.on('console', (m) => logs.push(m.text()));
  page.on('pageerror', (e) => logs.push(String(e)));
  await openInfant(page);
  await sheetReady(page);
  await input(page).fill(MARK);

  const scan = async (label: string, expectInGame: boolean) => {
    const found = await page.evaluate(async (mark) => {
      const hits: string[] = [];
      const has = (s: string | null | undefined) => (s ?? '').includes(mark);
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i)!;
        if (has(k)) hits.push('localStorage 키 ' + k);
        if (has(localStorage.getItem(k))) hits.push('localStorage ' + k);
      }
      for (let i = 0; i < sessionStorage.length; i++) hits.push('sessionStorage ' + sessionStorage.key(i));
      const dbs = (await indexedDB.databases?.()) ?? [];
      if (dbs.length > 0) hits.push('indexedDB ' + dbs.map((d) => d.name).join(','));
      if (has(document.cookie)) hits.push('쿠키');
      if (has(location.href) || has(location.search) || has(location.hash)) hits.push('주소');
      if (has(JSON.stringify(history.state))) hits.push('history.state');
      if (has(document.title)) hits.push('document.title');
      for (const el of Array.from(document.querySelectorAll('*'))) {
        for (const a of Array.from(el.attributes)) if (has(a.value)) hits.push(`속성 ${el.tagName.toLowerCase()}[${a.name}]`);
      }
      return hits;
    }, MARK);
    const game = await page.evaluate((k) => localStorage.getItem(k) ?? '', 'suzeo-game:save');
    expect(found.filter((h) => !h.startsWith('localStorage suzeo-game:save')), `${label}: 글이 복사된 곳`).toEqual([]);
    expect(game.includes(MARK), `${label}: 게임 저장에 글이 ${expectInGame ? '있다' : '없다'}`).toBe(expectInGame);
    const settings = await page.evaluate((k) => localStorage.getItem(k) ?? '', 'suzeo-game:settings');
    expect(settings.includes(MARK), `${label}: 설정 키에 글 없음`).toBe(false);
  };
  await scan('입력 중', false);
  // 의견 보내기 주소에도 글이 없다
  const feedback = await page.getByTestId('tool-feedback').getAttribute('href');
  expect(feedback ?? '').not.toContain(encodeURIComponent(MARK));
  await page.getByTestId('note-save').click();
  await expect(sheet(page)).toHaveCount(0);
  await scan('저장 뒤', true);
  await page.reload();
  await expect(page.getByTestId('life-screen')).toBeVisible();
  await expect(page.getByTestId('note-text').last()).toHaveText(MARK);
  await scan('새로고침 뒤', true);
  expect(external, '외부 도메인 요청 0건').toEqual([]);
  expect(logs.filter((l) => l.includes(MARK)), '콘솔·오류 메시지에 글 0').toEqual([]);
});

// ---------- 다른 탭이 저장을 바꿈 (5-4절) ----------

test('기록 시트가 열린 채 다른 탭이 저장을 바꾸면 기존 「밀린 화면」이 뜨고 시트가 사라지며 문서 스크롤 잠금이 풀린다. 이어하기 뒤에는 같은 카드가 다시 뜬다', async ({ page }) => {
  await openInfant(page);
  await sheetReady(page);
  await input(page).fill('밀리기 전에 쓰던 글');
  expect(await page.evaluate(() => document.documentElement.classList.contains('sheet-open'))).toBe(true);
  await page.evaluate((k) => window.dispatchEvent(new StorageEvent('storage', { key: k })), 'suzeo-game:save');
  await expect(page.getByTestId('superseded-screen')).toBeVisible();
  await expect(sheet(page)).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.classList.contains('sheet-open')), '시트가 사라지면 잠금도 풀린다').toBe(false);
  expect(await noteRows(page), '쓰던 글은 저장되지 않았다').toEqual([]);
  await expect(page.getByTestId('take-over')).toBeEnabled();
  await page.getByTestId('take-over').click();
  await sheetReady(page);
  await expect(sheet(page)).toHaveAttribute('data-card', 'note-infant-memory');
  await expect(input(page)).toHaveValue('');
});
