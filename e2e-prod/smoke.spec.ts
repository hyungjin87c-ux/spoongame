import { expect, test, type Page } from '@playwright/test';
import { holdMsFor } from '../src/core/timing';
import { readThemeBlocks, themeTokens } from '../scripts/checkContrastLib';
import { BASIS_B, SLIDE_FORMS, UNIT_WORD, VALUE_LINE, forbiddenIn } from '../e2e/carouselForms';
import { slideCount } from '../e2e/carouselHelpers';
import { SETTINGS_KEY, settingsEnvelope } from '../e2e/saves';
import { collectSlideDom, type SlideDom } from '../e2e/slideText';
import { measureTextResize, setRootFontPercent, textResizeViolations } from '../e2e/textResize';
import { NO_CONTAINER_QUERIES, WITH_CONTAINER_QUERIES, cssAppliedBy } from '../tests/helpers/browserCss';

/**
 * 프로덕션 번들 스모크 (R-043). `npm run e2e:prod`가 빌드한 dist를 vite preview로 띄운 서버에서 돈다.
 * 개발 서버 e2e가 못 보는 것: 번들이 실제로 실행되는가(이벤트 데이터 검증 포함), 개발 전용 탐침이 제품에서 꺼져 있는가.
 */

const GAME_KEY = 'suzeo-game:save';
/** 개발 전용 탐침 쿼리 이름. 제품 번들에는 문자열째 없어야 한다. */
const PROBES = ['__timescale', '__guard', '__crash', '__quota', '__exit', '__playTime'] as const;
/** 개발 전용 하니스가 window에 다는 이름(harness/layout.tsx). 하니스가 번들에 섞이면 이 문자열이 보인다 (R-071). */
const HARNESS_GLOBALS = ['__layout'] as const;
/** 하니스 페이지에만 있는 문구 (harness/guard.html · harness/layout.html의 title) */
const HARNESS_MARKERS = ['GuardedButton 하니스', '선택지 레이아웃 하니스', '/harness/guard.tsx', '/harness/layout.tsx'] as const;

function trackErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(`console.error: ${m.text()}`);
  });
  return errors;
}

async function toLifeScreen(page: Page): Promise<void> {
  await page.getByTestId('start-birth').click(); // 첫 화면의 하단 고정 「태어나기」. 가드가 풀릴 때까지 Playwright가 기다린다
  await expect(page.getByTestId('roulette-screen')).toBeVisible();
  await page.getByTestId('skip-roulette').click(); // 룰렛(M3): 연출은 건너뛴다(연출 시간은 아래 별도 시험이 본다)
  await page.getByTestId('to-birth').click();
  await expect(page.getByTestId('birth-screen')).toBeVisible();
  await page.getByTestId('next-life').click();
  await expect(page.getByTestId('life-screen')).toBeVisible();
}

test('프로덕션 번들: 첫 화면 → 태어나기 → 룰렛 → 출생신고 → 인생 화면까지 오류 없이 간다 (이벤트 데이터 검증 통과 후의 번들이 실제로 뜬다)', async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto('/');
  await expect(page).toHaveTitle('수저 게임');
  await expect(page.getByTestId('title-screen')).toBeVisible();
  await toLifeScreen(page);
  await expect(page.getByTestId('life-age')).toContainText('0세');
  for (const label of ['1배', '2배', '4배', '8배']) await expect(page.getByRole('button', { name: label, exact: true })).toBeVisible();
  await expect(page.getByTestId('auto')).toBeVisible();
  // M4 대시보드: 일시정지, 도구 줄 5개, 올해 진행률 바, 프로필·상태·자산·인생 기록·식구·같은 해 태어난 사람들 카드가 제품 번들에서도 그려진다
  await expect(page.getByTestId('pause')).toBeVisible();
  for (const id of ['tool-bgm', 'tool-note', 'tool-dark', 'tool-feedback', 'tool-exit']) await expect(page.getByTestId(id)).toBeVisible();
  // M7c D-75: 생각 남기기는 보통 버튼이다 — 「준비 중」 표식·점선이 없고 눌러서 기록 시트(dialog)가 열린다(제품 번들에서도)
  await expect(page.getByTestId('tool-note')).toHaveAccessibleName('생각 남기기');
  await expect(page.getByTestId('tool-note')).toHaveAttribute('aria-haspopup', 'dialog');
  await expect(page.getByTestId('tool-note')).not.toHaveAttribute('data-unavailable', /.*/);
  expect(await page.getByTestId('tool-note').evaluate((el) => getComputedStyle(el).borderTopStyle)).not.toBe('dashed');
  await expect(page.getByTestId('year-progress')).toHaveAttribute('role', 'progressbar');
  for (const id of ['profile-card', 'stats', 'assets-card', 'log', 'family-card', 'peers-now-card']) await expect(page.getByTestId(id)).toBeVisible();
  await expect(page.getByTestId('peer-now')).toHaveCount(4);
  await expect(page.getByTestId('error-screen')).toHaveCount(0);
  // 인생 화면으로 넘어가면 저장이 남는다
  const saved = await page.evaluate((k) => JSON.parse(localStorage.getItem(k) ?? 'null'), GAME_KEY);
  expect(saved?.data?.phase).toBe('life');
  expect(errors).toEqual([]);
});

test('프로덕션 번들: 「생각 남기기」 — 눌러 기록 시트가 열리고(모달·문서 스크롤 잠금·포커스는 질문), 글을 적어 저장하면 인생 기록에 「나의 기록」 줄이 생기며 Esc로 닫으면 포커스가 그 버튼으로 돌아온다', async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto('/');
  await toLifeScreen(page);
  const tool = page.getByTestId('tool-note');
  await expect(tool).toBeEnabled(); // 입력 가드가 풀릴 때까지
  await tool.click();
  const sheet = page.getByTestId('note-sheet');
  await expect(sheet).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveAccessibleName(/^생각 남기기 .*마음에 남아 있는 장면이나 생각/);
  await expect(page.getByTestId('note-title')).toBeFocused();
  expect(await page.evaluate(() => document.documentElement.classList.contains('sheet-open')), '문서 스크롤 잠금').toBe(true);
  expect(await page.getByTestId('note-input').evaluate((el) => parseFloat(getComputedStyle(el).fontSize)), '입력란 글자 크기 ≥ 16px').toBeGreaterThanOrEqual(16);
  await expect(page.getByTestId('note-input')).not.toHaveAttribute('maxlength', '140');
  await page.keyboard.press('Escape'); // 글이 없으니 확인 없이 닫힌다
  await expect(sheet).toHaveCount(0);
  await expect(tool).toBeFocused();
  expect(await page.evaluate(() => document.documentElement.classList.contains('sheet-open')), '닫으면 잠금이 풀린다').toBe(false);
  await tool.click();
  await expect(page.getByTestId('note-save')).toBeEnabled();
  await page.getByTestId('note-input').fill('제품 번들 수동 기록');
  await page.getByTestId('note-save').click();
  await expect(sheet).toHaveCount(0);
  await expect(page.getByTestId('note-text').last()).toHaveText('제품 번들 수동 기록');
  await expect(page.getByTestId('note-label').last()).toContainText('나의 기록');
  const saved = await page.evaluate((k) => JSON.parse(localStorage.getItem(k) ?? 'null'), GAME_KEY);
  expect(saved.data.history.filter((h: { kind: string }) => h.kind === 'note').map((h: { text: string }) => h.text)).toEqual(['제품 번들 수동 기록']);
  expect(await page.evaluate(() => localStorage.getItem('suzeo-game:settings')?.includes('제품 번들 수동 기록')), '설정 키에 글이 없다').toBe(false);
  expect(errors).toEqual([]);
});

test('프로덕션 번들: BGM은 기본 꺼짐이고 켜기 전에는 소리 장치(AudioContext)를 만들지 않으며, 켜면 하나만 만들고 끄면 멈춘다. 음원 파일 요청은 없다 (DB4)', async ({ page }) => {
  const errors = trackErrors(page);
  const requests: string[] = [];
  page.on('request', (r) => requests.push(r.url()));
  await page.addInitScript(() => {
    const w = window as unknown as { __audioContexts: number; AudioContext?: new () => unknown; webkitAudioContext?: unknown };
    w.__audioContexts = 0;
    const Original = w.AudioContext;
    if (Original === undefined) return;
    w.AudioContext = class extends (Original as unknown as new () => object) {
      constructor() {
        super();
        w.__audioContexts++;
      }
    } as unknown as new () => unknown;
  });
  await page.goto('/');
  await toLifeScreen(page);
  const count = () => page.evaluate(() => (window as unknown as { __audioContexts: number }).__audioContexts);
  expect(await count(), '켜기 전에는 AudioContext가 없다 (자동 재생 없음)').toBe(0);
  const bgm = page.getByTestId('tool-bgm');
  await expect(bgm).toHaveAttribute('aria-pressed', 'false');
  await expect(bgm).toBeEnabled();
  await bgm.click();
  await expect(bgm).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByTestId('bgm-volume-input')).toBeVisible();
  expect(await count(), '켜면 하나').toBe(1);
  expect(JSON.parse((await page.evaluate(() => localStorage.getItem('suzeo-game:settings')))!).data.bgm.on).toBe(true);
  await bgm.click();
  await expect(bgm).toHaveAttribute('aria-pressed', 'false');
  await expect(page.getByTestId('bgm-volume')).toHaveCount(0);
  await bgm.click();
  expect(await count(), '다시 켜도 장치는 새로 만들지 않는다(또는 하나만 더) — 폭주 없음').toBeLessThanOrEqual(2);
  const audioFiles = requests.filter((u) => /\.(mp3|ogg|wav|m4a|aac|flac|opus|weba)(\?|$)/i.test(u));
  expect(audioFiles, '음원 파일 요청').toEqual([]);
  expect(errors).toEqual([]);
});

test('프로덕션 번들: 다크 모드 버튼은 수동 선택을 저장해 새로고침 뒤에도 유지하고, 의견 보내기는 새 탭 링크이며, 나가기는 확인 뒤 일시정지로 저장한다. 게임 중 외부 요청은 0이다 (DB6·DB7·DB8·CM3)', async ({ page }) => {
  const errors = trackErrors(page);
  const external: string[] = [];
  page.on('request', (r) => {
    const url = new URL(r.url());
    if (url.hostname !== 'localhost' && url.hostname !== '127.0.0.1') external.push(r.url());
  });
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('/');
  await toLifeScreen(page);
  const theme = () => page.evaluate(() => document.documentElement.getAttribute('data-theme'));

  // 다크 모드: 켜짐 표시 → data-theme=dark, 설정 저장, 새로고침 뒤에도 유지(첫 그림부터)
  const dark = page.getByTestId('tool-dark');
  await expect(dark).toHaveAttribute('aria-pressed', 'false');
  await expect(dark).toBeEnabled();
  await dark.click();
  await expect(dark).toHaveAttribute('aria-pressed', 'true');
  expect(await theme()).toBe('dark');
  expect(JSON.parse((await page.evaluate(() => localStorage.getItem('suzeo-game:settings')))!).data.theme).toBe('dark');
  await page.reload();
  await expect(page.getByTestId('life-screen')).toBeVisible();
  expect(await theme()).toBe('dark');
  await expect(page.getByTestId('tool-dark')).toHaveAttribute('aria-pressed', 'true');

  // 의견 보내기: 진짜 링크(새 탭), 주소에 이름·나이가 없다
  const feedback = page.getByTestId('tool-feedback');
  const href = (await feedback.getAttribute('href'))!;
  expect(href).toMatch(/^https:\/\/github\.com\/[^/]+\/[^/]+\/issues\/new\?template=feedback\.yml&screen=/);
  expect(await feedback.getAttribute('target')).toBe('_blank');
  expect(await feedback.getAttribute('rel')).toBe('noopener noreferrer');
  const name = (await page.getByTestId('life-name').innerText()).trim();
  expect(decodeURIComponent(href)).not.toContain(name);
  expect(decodeURIComponent(href)).toContain('인생 진행 중');

  // 나가기: 확인 단계 → 돌아가기로 닫기 → 다시 열어 나가기 → 첫 화면(이어서 살기) → 일시정지로 저장
  await page.getByTestId('tool-exit').click();
  await expect(page.getByTestId('exit-ask')).toBeVisible();
  await page.getByTestId('exit-no').click();
  await expect(page.getByTestId('exit-ask')).toHaveCount(0);
  await page.getByTestId('tool-exit').click();
  await page.getByTestId('exit-yes').click();
  await expect(page.getByTestId('resume')).toBeVisible();
  const saved = await page.evaluate((k) => JSON.parse(localStorage.getItem(k) ?? 'null'), GAME_KEY);
  expect(saved.data.phase).toBe('life');
  expect(saved.data.paused, '나가기는 일시정지로 저장한다').toBe(true);
  await page.getByTestId('resume').click();
  await expect(page.getByTestId('life-screen')).toBeVisible();
  await expect(page.getByTestId('pause')).toHaveText('다시 진행');
  expect(external, '게임 중 외부 요청').toEqual([]);
  expect(errors).toEqual([]);
});

test('프로덕션 번들: "다음 결정으로" → 첫 선택지 선택을 되풀이해 사망(엔딩 화면)까지 가고, 다시 태어나기로 새 판의 첫 화면까지 간다 — 타이머를 기다리지 않고 제품 번들에서 엔진 전체가 돈다 (R-051, M5)', async ({ page }) => {
  test.setTimeout(180_000);
  const errors = trackErrors(page);
  await page.goto('/');
  await toLifeScreen(page);

  const ending = page.getByTestId('ending-screen');
  // 마지막으로 쓴 속도는 다음 판에도 유지된다(SPEC): 8배로 바꿔 두고 끝까지 간다
  await page.getByRole('button', { name: '8배', exact: true }).click();
  const panel = page.getByTestId('choice-panel');
  const skip = page.getByTestId('skip');
  let choices = 0;
  let skips = 0;
  let notesWritten = 0;
  let notesSeen = 0;
  // 선택지가 떠 있으면 첫 선택지를 고르고, 없으면 "다음 결정으로"를 누른다. 연출 타이머가 끼어들어 상태가 바뀌면(드물다) 다시 판단한다.
  // 기록 카드(M7c)가 뜨면 시트가 모달이라 바깥이 inert다: 처음 한 번은 글을 적어 두고(1번), 나머지는 마음속에 담고 넘어간다(2번, 글이 없어 확인 없이 닫힌다).
  for (let step = 0; step < 400 && !(await ending.isVisible()); step++) {
    try {
      if (await page.getByTestId('note-sheet').isVisible()) {
        notesSeen++;
        if (notesWritten === 0) {
          await page.getByTestId('note-input').fill('제품 번들에서 적은 글');
          await page.getByTestId('note-save').click({ timeout: 5_000 }); // 입력 가드(0.4초)가 풀릴 때까지 기다린다
          notesWritten++;
        } else {
          await page.getByTestId('note-skip').click({ timeout: 5_000 });
        }
        continue;
      }
      if (await panel.isVisible()) {
        await panel.locator('button.choice').first().click({ timeout: 5_000 }); // 선택지 가드가 풀릴 때까지 기다린다 (M7b: 카드 머리의 「잠시 덮어 두기」가 첫 버튼이라 선택지 버튼만 고른다)
        choices++;
      } else {
        await skip.click({ timeout: 5_000 }); // 컨트롤 가드가 풀리고 선택지가 없을 때 눌린다
        skips++;
      }
    } catch {
      // 판단과 클릭 사이에 화면이 바뀌었다(타이머로 선택지가 뜨거나 엔딩으로 감) → 다음 반복에서 다시 본다
    }
  }
  await expect(ending).toBeVisible();
  expect(choices, '선택지를 한 번 이상 골랐다').toBeGreaterThan(0);
  expect(skips, '"다음 결정으로"를 한 번 이상 눌렀다').toBeGreaterThan(0);
  expect(notesSeen, '기록 카드가 한 번 이상 떠서 시트가 보였다(수동 모드 · 카드 켜짐이 기본)').toBeGreaterThan(0);
  expect(notesWritten, '글을 한 번 적었다').toBe(1);

  // 저장: 엔딩 단계, 사망 정보가 있고, 고른 선택이 연표에 남아 있다
  const saved = await page.evaluate((k) => JSON.parse(localStorage.getItem(k) ?? 'null'), GAME_KEY);
  expect(saved?.data?.phase).toBe('ending');
  expect(saved?.data?.death, '사망 정보가 저장돼 있다').toBeTruthy();
  const history = saved.data.history as Array<{ kind: string; age: number; text: string; by?: 'parent' | 'child' }>;
  // R-489: 연표의 「선택」 줄은 둘로 나뉜다 — 본인이 고른 선택(`by` 없음)과 어린 시절에 부모님이 정한(`by: 'parent'`)·아이의 일로 흘러간(`by: 'child'`) 큰 결정(SPEC-005 PD6). 옛 단언은 `kind === 'choice'` 전부(25)를
  // 이 시험이 누른 선택지 버튼 수(`choices` = 18, 본인이 고른 것)와 비교해 QI5 뒤로 맞지 않았다. 「본인이 고른 선택 수」의 정의는 core/ending.ts#reviewEnding `choiceCount`(= `by`가 없는 선택 줄)이고
  // 엔딩의 「살아오며 N번의 선택」(data/endingText.ts#choiceCountText)이 그 수다 — 부모·흘러감 줄은 그 수에 들지 않고 따로 「어린 시절의 큰 결정 가운데 …」 줄에서 센다.
  const choiceEntries = history.filter((h) => h.kind === 'choice');
  const ownEntries = choiceEntries.filter((h) => h.by === undefined);
  const parentEntries = choiceEntries.filter((h) => h.by === 'parent');
  const childEntries = choiceEntries.filter((h) => h.by === 'child');
  expect(ownEntries.length, '연표의 본인이 고른 선택 수(by 없음) = 누른 선택지 버튼 수').toBe(choices);
  expect(ownEntries.length + parentEntries.length + childEntries.length, '선택 줄은 본인·부모님·흘러감 셋뿐이다').toBe(choiceEntries.length);
  expect(history.filter((h) => h.kind === 'note').map((h) => h.text), '적은 글 한 건만 연표에 남았다(마음속에 담은 카드는 줄이 없다)').toEqual(['제품 번들에서 적은 글']);
  expect(history.some((h) => h.kind === 'death')).toBe(true);
  // 새로고침해도 엔딩에 머무른다
  await page.reload();
  await expect(page.getByTestId('ending-screen')).toBeVisible();
  await expect(page.getByTestId('error-screen')).toHaveCount(0);

  // 엔딩 회고(제품 번들): 사망 한 줄·출발선 대비(같은 세상 안의 자리)·최종 스탯·연표(선택한 순간이 빠짐없이)
  await expect(page.getByTestId('ending-death')).toContainText(`${saved.data.death.age}세에 세상을 떠났습니다`);
  await expect(page.getByTestId('ending-journey')).toContainText('의 집에서 태어');
  // 이 판의 플레이 시간(M8 LM6, 완료 기준 16 스모크): 제품 번들에서 저장된 기록(play)이 엔딩에 mm:ss로 보이고(표시값 = 버킷별 초 버림 뒤 합), 8배속과 「다음 결정으로」를 쓴 판이라 짧게 잡힌다는 문장이 있다.
  // 이어하기 횟수(resumes)는 화면에 없다.
  const play = saved.data.play as { hold: number; decide: number; skips: number; resumes: number } | undefined;
  expect(play, '시간 기록이 저장돼 있다').toBeTruthy();
  expect(play!.skips, '「다음 결정으로」를 쓴 횟수가 기록됐다').toBeGreaterThan(0);
  const shownSeconds = Math.floor(play!.hold / 1000) + Math.floor(play!.decide / 1000);
  const mmss = `${String(Math.floor(shownSeconds / 60)).padStart(2, '0')}:${String(shownSeconds % 60).padStart(2, '0')}`;
  await expect(page.getByTestId('ending-playtime-value').locator('[aria-hidden="true"]')).toHaveText(mmss);
  await expect(page.getByTestId('ending-playtime-value').locator('.sr-only')).toHaveText(`${Math.floor(shownSeconds / 60)}분 ${shownSeconds % 60}초`);
  await expect(page.getByTestId('ending-playtime')).toContainText('이 판의 플레이 시간');
  await expect(page.getByTestId('ending-playtime-note')).toContainText('짧게 잡힙니다');
  await expect(page.getByTestId('ending-playtime-note')).toContainText('이 기기에만 저장됩니다.');
  // 방향 문장은 스무 살(독립) 이후 사망한 판에만 있다(core/ending.ts#reviewEnding — 그 전이면 `early`). 시드가 무작위라 드물게(약 0.2%) 일찍 떠난 판이 걸린다
  if (saved.data.death.age >= 20) await expect(page.getByTestId('ending-movement')).toBeVisible();
  else await expect(page.getByTestId('ending-movement')).toHaveCount(0);
  // 재산 스탯은 없어졌다(M5 2a, 저장 v8) — 최종 순자산 줄은 2b에서 더해진다
  for (const key of ['education', 'health', 'happiness', 'relationships']) await expect(page.getByTestId(`final-${key}`)).toBeVisible();
  // 바뀐 기대(M4): 외모는 점수 숫자가 아니라 「상위/하위 약 N%」 한 가지로만 (R-135)
  await expect(page.getByTestId('final-looks')).toContainText(/상위|하위|가운데쯤/);
  await expect(page.getByTestId('timeline-entry')).toHaveCount(history.length);
  // 고른 길 표시(`timeline-picked`)는 모든 선택 줄에 붙는다: 본인이 고른 선택은 `data-by`가 없고, 부모님이 정한·흘러간 줄은 `data-by`가 있다(R-489)
  await expect(page.locator('[data-testid="timeline-picked"]:not([data-by])')).toHaveCount(ownEntries.length);
  await expect(page.locator('[data-testid="timeline-picked"][data-by="parent"]')).toHaveCount(parentEntries.length);
  await expect(page.locator('[data-testid="timeline-picked"][data-by="child"]')).toHaveCount(childEntries.length);
  // 엔딩의 「살아오며 N번의 선택」은 본인이 고른 선택 수이고, 부모님·흘러감 횟수는 다른 줄에 따로 있다(둘 다 0이면 그 줄이 없다)
  await expect(page.getByTestId('ending-choices')).toHaveText(`살아오며 ${ownEntries.length}번의 선택을 했습니다.`);
  if (parentEntries.length + childEntries.length > 0) await expect(page.getByTestId('ending-delegated')).toContainText(/부모님이 내렸|아이의 일로 흘러갔/);
  else await expect(page.getByTestId('ending-delegated')).toHaveCount(0);
  // M7e-3: 출발선 범례의 수저 칩(.grade — designer 결정, 막대의 이름표) 한 곳을 뺀 글에서 등급명·느낌표가 없다
  const endingText = (await page.getByTestId('ending-screen').evaluate((el) => {
    const clone = el.cloneNode(true) as HTMLElement;
    clone.querySelectorAll('.grade').forEach((n) => n.remove());
    return clone.textContent ?? '';
  })).replace(/\s+/g, ' ');
  expect(endingText).not.toMatch(/(흙|동|은|금|다이아)\s*수저|다이아|!/);
  await expect(page.locator('[data-testid="ending-legend"] .grade')).toHaveCount(1);

  // 다시 태어나기: 새 시드의 새 판, 첫 화면(기본 지금 세상·약 30분), 설정(8배) 유지, 포커스는 새 화면 제목
  const settingsBefore = await page.evaluate(() => localStorage.getItem('suzeo-game:settings'));
  expect(JSON.parse(settingsBefore!).data.speed).toBe(8);
  await page.getByTestId('rebirth').click(); // 가드가 풀릴 때까지 Playwright가 기다린다
  await expect(page.getByTestId('title-screen')).toBeVisible();
  await expect(page.getByTestId('era-present')).toBeChecked();
  await expect(page.getByTestId('life-short30')).toBeChecked();
  await expect.poll(() => page.evaluate(() => `${document.activeElement?.tagName}:${document.activeElement?.textContent?.trim()}`)).toBe('H1:수저 게임');
  await expect.poll(() => page.evaluate((k) => JSON.parse(localStorage.getItem(k) ?? 'null')?.data?.phase, GAME_KEY)).toBe('title');
  const fresh = await page.evaluate((k) => JSON.parse(localStorage.getItem(k) ?? 'null'), GAME_KEY);
  expect(fresh.data.seed, '새 시드').not.toBe(saved.data.seed);
  expect(fresh.data.history).toEqual([]);
  expect(fresh.data.character).toBeNull();
  expect(fresh.data.death).toBeNull();
  expect(await page.evaluate(() => localStorage.getItem('suzeo-game:settings'))).toBe(settingsBefore);
  // 새 판도 끝까지 시작할 수 있다: 태어나기를 누르면 새 인물의 룰렛 화면
  await page.getByTestId('start-birth').click();
  await expect(page.getByTestId('roulette-screen')).toBeVisible();
  await expect(page.getByTestId('error-screen')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('프로덕션 번들: 룰렛이 실제로 돌고(회전 중 → 결과) 총 4~6초에 끝나며 결과가 저장된 출생 결과이고, 새로고침해도 다시 돌지 않는다 (RL1·RL5, M3)', async ({ page }) => {
  test.setTimeout(60_000);
  const errors = trackErrors(page);
  await page.goto('/');
  await expect(page.getByTestId('title-screen')).toBeVisible();
  await page.getByTestId('start-birth').click();
  const screen = page.getByTestId('roulette-screen');
  await expect(screen).toHaveAttribute('data-state', 'spinning');
  const startedAt = Date.now();
  const saved = await page.evaluate((k) => JSON.parse(localStorage.getItem(k) ?? 'null'), GAME_KEY);
  expect(saved?.data?.phase).toBe('roulette');
  expect(saved?.data?.birthReport, '출생 결과(상세)가 「태어나기」 순간에 저장됐다').toBeTruthy();
  await expect(screen).toHaveAttribute('data-state', 'result', { timeout: 8_000 });
  const seconds = (Date.now() - startedAt) / 1000;
  expect(seconds, `총 연출 ${seconds.toFixed(2)}초`).toBeGreaterThanOrEqual(3.8);
  expect(seconds, `총 연출 ${seconds.toFixed(2)}초`).toBeLessThanOrEqual(6.5);
  expect(await page.evaluate((k) => JSON.parse(localStorage.getItem(k) ?? 'null'), GAME_KEY), '연출 전후 저장이 같다').toEqual(saved);
  expect((await page.locator('[data-testid="reel-region"] [data-result="true"]').innerText()).trim()).toBe(saved.data.birthReport.region);
  // 새로고침: 다시 돌지 않고 결과 상태, 같은 저장
  await page.reload();
  await expect(screen).toHaveAttribute('data-state', 'result');
  expect(await page.evaluate((k) => JSON.parse(localStorage.getItem(k) ?? 'null'), GAME_KEY)).toEqual(saved);
  await expect(page.getByTestId('error-screen')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('프로덕션 번들: 룰렛·출생신고의 안내 문구 — 없는 기능(대시보드 오른쪽 칸)을 가리키지 않고(QM3-3), 비교 표 안내는 합쇼체·룰렛 안내는 해요체로 통일돼 있다 (QM3-4)', async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto('/');
  await page.getByTestId('start-birth').click();
  await expect(page.getByTestId('roulette-screen')).toHaveAttribute('data-state', 'spinning');
  expect((await page.getByTestId('roulette-status').innerText()).replace(/\s+/g, ' ').trim()).toBe('어느 집, 어느 땅에 태어날지는 고를 수 없어요. 확률대로 돌아가요.');
  await page.getByTestId('skip-roulette').click();
  await page.getByTestId('to-birth').click();
  await expect(page.getByTestId('birth-screen')).toBeVisible();
  const text = (await page.getByTestId('birth-screen').innerText()).replace(/\s+/g, ' ');
  expect(text).not.toMatch(/대시보드|오른쪽 칸/);
  // M4: 대시보드 또래 칸(VP4)이 생겨 안내에 둘째 문장이 더해졌다 — 문구가 가리키는 칸이 실제로 있는지는 아래에서 살아가기를 눌러 확인한다(문구 ⇔ 기능)
  expect((await page.locator('[data-testid="peers-card"] p.card__note').innerText()).trim()).toBe(
    '네 사람도 같은 세상에서 나이를 먹습니다. 살아가기를 누르면 「같은 해 태어난 사람들」 칸에서 요즘 모습을 볼 수 있습니다.',
  );
  // 지금 세상(첫 화면의 기본 선택)이라 비교 표 안내가 있다
  expect((await page.getByTestId('compare-note').innerText()).replace(/\s+/g, ' ').trim()).toBe(
    '평균은 각 통계의 전체 대상(학생, 가구) 기준이고, 이 가정 열은 수저 단계에 맞춘 소득 구간의 값입니다. 단계와 소득 구간의 대응은 게임의 설계값입니다.',
  );
  await page.getByTestId('next-life').click();
  await expect(page.getByTestId('life-screen')).toBeVisible();
  await expect(page.getByTestId('peers-now-card').getByRole('heading', { name: '같은 해 태어난 사람들' })).toBeVisible();
  await expect(page.getByTestId('peer-now')).toHaveCount(4);
  await expect(page.getByTestId('error-screen')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('개발 탐침 쿼리(?__timescale·__guard·__crash·__quota)는 프로덕션에서 아무 효과가 없다', async ({ page }) => {
  const errors = trackErrors(page);
  // 첫 렌더에 입력 가드(aria-disabled)가 한 번이라도 걸렸는지 기록한다 — ?__guard=0이 먹혔다면 가드가 한 번도 안 걸린다.
  await page.addInitScript(() => {
    const w = window as unknown as { __sawGuard: boolean };
    w.__sawGuard = false;
    new MutationObserver(() => {
      if (document.querySelector('[aria-disabled="true"]')) w.__sawGuard = true;
    }).observe(document, { subtree: true, childList: true, attributes: true });
  });
  await page.goto('/?__timescale=1000&__guard=0&__crash=1&__quota=1');

  // __crash: 렌더 중 예외로 ErrorBoundary가 뜨면 안 된다
  await expect(page.getByTestId('title-screen')).toBeVisible();
  await expect(page.getByTestId('error-screen')).toHaveCount(0);
  // __guard=0: 가드가 실제로 걸렸다
  expect(await page.evaluate(() => (window as unknown as { __sawGuard: boolean }).__sawGuard), '입력 가드가 걸렸다 (?__guard=0 무시)').toBe(true);

  await toLifeScreen(page);
  // __timescale=1000: 1배속의 첫 한 해(M7a 이후 0세에는 첫 예방접종이 늘 일어나 조용한 해보다 길 수 있다 — 아래 하한은 조용한 해 연출 대기 — HOLD_MS.quiet × 30분 모드 계수, M8 — 기준)가 실제로 그만큼 걸린다. 탐침이 먹혔다면 수 ms 만에 나이가 오르거나 선택지가 뜬다.
  const shownAt = Date.now();
  await expect
    .poll(() => page.evaluate(() => !document.querySelector('[data-testid="life-age"]')?.textContent?.includes('0세') || document.querySelector('[data-testid="choice-panel"]') !== null), {
      timeout: 15_000,
    })
    .toBe(true);
  const firstYearMs = Date.now() - shownAt;
  expect(firstYearMs, `첫 한 해가 ${firstYearMs}ms 만에 지났다 — 1배속의 한 해는 적어도 조용한 해 ${holdMsFor('quiet')}ms에 가까워야 한다 (?__timescale 무시)`).toBeGreaterThanOrEqual((holdMsFor('quiet') as number) * 0.75);

  // __quota: 저장이 실패하는 저장소가 되면 안 된다 — 저장 안내가 없고 저장이 실제로 남아 있다
  await expect(page.getByTestId('save-notice')).toHaveCount(0);
  expect(await page.evaluate((k) => localStorage.getItem(k) !== null, GAME_KEY)).toBe(true);
  expect(errors).toEqual([]);
});

test('제품 번들 파일에 개발 탐침 문자열이 없고, 개발 전용 하니스 페이지는 제공되지 않는다', async ({ request }) => {
  const html = await (await request.get('/')).text();
  const scripts = [...html.matchAll(/<script[^>]+src="([^"]+)"/g)].map((m) => m[1]);
  expect(scripts.length, 'index.html에 번들 스크립트가 있다').toBeGreaterThan(0);
  for (const src of scripts) {
    expect(src, '개발 서버(/src/main.tsx)가 아니라 빌드 산출물을 가리킨다').toMatch(/^\/assets\/.+\.js$/);
    const body = await (await request.get(src)).text();
    expect(body.length).toBeGreaterThan(10_000);
    for (const probe of PROBES) expect(body, `${src}에 ${probe}가 있다`).not.toContain(probe);
    for (const name of HARNESS_GLOBALS) expect(body, `${src}에 개발 하니스의 ${name}가 있다 (R-071)`).not.toContain(name);
  }
  // R-071: 하니스 두 페이지(guard.html · layout.html) 모두 제공되지 않는다. vite preview는 없는 경로에 index.html을 돌려주므로,
  // 404이거나 앱의 index.html과 똑같은 내용이면 "제공되지 않음"이다 — 하니스 문구·스크립트 경로는 어디에도 없어야 한다.
  for (const path of ['/harness/guard.html', '/harness/layout.html']) {
    const res = await request.get(path);
    const text = await res.text();
    for (const marker of HARNESS_MARKERS) expect(text, `${path}에 하니스 문구 "${marker}"가 있다`).not.toContain(marker);
    expect(res.status() === 404 || text === html, `${path}: 404이거나 앱의 index.html이어야 한다 (지금 ${res.status()})`).toBe(true);
  }
});

test('다크 OS에서 JS가 뜨기 전(스크립트를 막은 상태)에도 바탕이 다크 토큰이다 — 첫 화면이 라이트로 번쩍이지 않는다 (R-223). 라이트 OS는 라이트 토큰이다', async ({ page }) => {
  // 토큰 값은 파일(designer 소유)에서 읽는다 — 색을 이 테스트에 적어 두지 않는다
  // (e2e의 타입 설정에는 Node 타입이 없어 모듈 이름을 변수로 둔 동적 import를 쓴다 — tests/designAssets.test.ts와 같은 방법)
  const nodeFs = 'node:fs';
  const fs = (await import(nodeFs)) as { readFileSync(path: string, encoding: 'utf-8'): string };
  const blocks = readThemeBlocks(fs.readFileSync('src/styles/tokens.css', 'utf-8'));
  const rgb = (hex: string) => `rgb(${parseInt(hex.slice(1, 3), 16)}, ${parseInt(hex.slice(3, 5), 16)}, ${parseInt(hex.slice(5, 7), 16)})`;
  const bg = { light: rgb(themeTokens(blocks, 'light')['--c-bg']), dark: rgb(themeTokens(blocks, 'dark')['--c-bg']) };
  expect(bg.light).not.toBe(bg.dark); // 공허 통과 방지
  // 제품 번들의 CSS는 <link>로 먼저 받아 그려지므로(렌더를 막는다) 스크립트를 모두 막아도 첫 그림의 바탕을 볼 수 있다
  await page.route('**/*.js', (route) => route.abort());
  for (const scheme of ['dark', 'light'] as const) {
    await page.emulateMedia({ colorScheme: scheme });
    await page.goto('/');
    await expect(page.locator('#root')).toBeEmpty(); // React가 뜨기 전이다(첫 화면이 아직 없다)
    const seen = await page.evaluate(() => ({ body: getComputedStyle(document.body).backgroundColor, scheme: getComputedStyle(document.documentElement).colorScheme }));
    expect(seen.body, `${scheme} OS: JS 전 body 바탕`).toBe(bg[scheme]);
    expect(seen.scheme, `${scheme} OS: 색 구성표`).toBe(scheme);
  }
});

/**
 * 수동 테마 사전 적용 (QA-003-M4 O02): 다크·라이트를 직접 고른 사용자는 JS 번들이 늦게 와도 첫 그림부터 고른 테마다. `index.html`의 인라인 스크립트가 저장된 설정의 theme을
 * <html data-theme>에 미리 건다(제품 번들의 CSS는 <link>로 먼저 받아 그려지므로 JS 없이도 첫 그림의 바탕을 실측할 수 있다). 개발 서버용은 e2e/theme-first-paint.spec.ts(번들 전 속성), 판정 대조는 tests/themeInline.test.ts.
 */
async function lightDarkBackgrounds(): Promise<{ light: string; dark: string }> {
  // 토큰 값은 파일(designer 소유)에서 읽는다 — 색을 이 테스트에 적어 두지 않는다(위 R-223 테스트와 같은 방법)
  const nodeFs = 'node:fs';
  const fs = (await import(nodeFs)) as { readFileSync(path: string, encoding: 'utf-8'): string };
  const blocks = readThemeBlocks(fs.readFileSync('src/styles/tokens.css', 'utf-8'));
  const rgb = (hex: string) => `rgb(${parseInt(hex.slice(1, 3), 16)}, ${parseInt(hex.slice(3, 5), 16)}, ${parseInt(hex.slice(5, 7), 16)})`;
  const bg = { light: rgb(themeTokens(blocks, 'light')['--c-bg']), dark: rgb(themeTokens(blocks, 'dark')['--c-bg']) };
  expect(bg.light).not.toBe(bg.dark); // 공허 통과 방지
  return bg;
}

test('수동 테마 사전 적용: 저장된 수동 선택이 OS 설정과 반대여도, 번들(JS)이 늦게 오는 동안의 첫 그림 바탕이 고른 테마다 — 라이트로 번쩍이지 않는다 (O02). 번들이 뜬 뒤에도 같다', async ({ page }) => {
  const bg = await lightDarkBackgrounds();
  // JS 응답을 붙잡는다(지연) — 그 사이가 「JS가 아직 안 온」 첫 그림이다
  let release: () => void = () => undefined;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
    setTimeout(resolve, 4_000);
  });
  await page.route('**/*.js', async (route) => {
    await gate;
    await route.continue();
  });
  await page.emulateMedia({ colorScheme: 'light' }); // OS는 라이트, 사용자가 고른 것은 다크
  await page.addInitScript(([key, value]) => localStorage.setItem(key, value), [SETTINGS_KEY, settingsEnvelope({ speed: 1, autoMode: false, theme: 'dark' })] as const);
  await page.goto('/', { waitUntil: 'commit' });
  // CSS가 적용돼 바탕이 투명이 아니게 된 첫 순간의 값을 본다
  await expect.poll(() => page.evaluate(() => getComputedStyle(document.body).backgroundColor)).not.toBe('rgba(0, 0, 0, 0)');
  const seen = await page.evaluate(() => ({ body: getComputedStyle(document.body).backgroundColor, scheme: getComputedStyle(document.documentElement).colorScheme, rootEmpty: document.getElementById('root')?.childElementCount === 0 }));
  expect(seen.rootEmpty, '번들 지연 중이라 React가 아직 안 떴다').toBe(true);
  expect(seen.body, 'OS는 라이트지만 수동 다크: JS 전 body 바탕이 다크 토큰').toBe(bg.dark);
  expect(seen.scheme, '색 구성표도 다크').toBe('dark');
  release();
  await expect(page.getByTestId('title-screen')).toBeVisible();
  expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor), '번들이 뜬 뒤에도 같은 바탕').toBe(bg.dark);
});

test('수동 테마 사전 적용(매트릭스, 스크립트 차단): 수동 라이트·다크는 OS와 상관없이 그 테마이고, system·저장 없음·깨진 저장·모르는 버전은 OS 색을 따른다 (O02)', async ({ browser }) => {
  const bg = await lightDarkBackgrounds();
  const manual = (theme: 'light' | 'dark' | 'system') => settingsEnvelope({ speed: 1, autoMode: false, theme });
  const cases: Array<{ label: string; saved: string | null; os: 'light' | 'dark'; expected: 'light' | 'dark' }> = [
    { label: '수동 다크 · OS 라이트', saved: manual('dark'), os: 'light', expected: 'dark' },
    { label: '수동 다크 · OS 다크', saved: manual('dark'), os: 'dark', expected: 'dark' },
    { label: '수동 라이트 · OS 다크', saved: manual('light'), os: 'dark', expected: 'light' },
    { label: '수동 라이트 · OS 라이트', saved: manual('light'), os: 'light', expected: 'light' },
    { label: 'system · OS 다크', saved: manual('system'), os: 'dark', expected: 'dark' },
    { label: 'system · OS 라이트', saved: manual('system'), os: 'light', expected: 'light' },
    { label: '저장 없음 · OS 다크', saved: null, os: 'dark', expected: 'dark' },
    { label: '저장 없음 · OS 라이트', saved: null, os: 'light', expected: 'light' },
    { label: '깨진 저장(수동 다크로 읽지 않는다) · OS 라이트', saved: '{"version":3,"data":', os: 'light', expected: 'light' },
    { label: '모르는 버전의 다크 · OS 라이트', saved: JSON.stringify({ version: 6, data: { speed: 1, autoMode: false, theme: 'dark' } }), os: 'light', expected: 'light' },
  ];
  for (const c of cases) {
    const context = await browser.newContext({ viewport: { width: 360, height: 740 } });
    const p = await context.newPage();
    await p.route('**/*.js', (route) => route.abort());
    await p.emulateMedia({ colorScheme: c.os });
    if (c.saved !== null) await p.addInitScript(([key, value]) => localStorage.setItem(key, value), [SETTINGS_KEY, c.saved] as const);
    await p.goto('/');
    await expect(p.locator('#root')).toBeEmpty(); // React가 뜨기 전이다
    await expect.poll(() => p.evaluate(() => getComputedStyle(document.body).backgroundColor), { message: c.label }).toBe(bg[c.expected]);
    await context.close();
  }
});

test('수동 테마 사전 적용(대조): 인라인 스크립트를 뺀 문서에서는 수동 다크 저장이 있어도 JS 전 첫 그림이 OS 색(라이트)이다 — 위 시험이 스크립트의 부재를 실제로 잡는다 (O02)', async ({ page }) => {
  const bg = await lightDarkBackgrounds();
  await page.route('**/*.js', (route) => route.abort());
  await page.route(/\/$/, async (route) => {
    const res = await route.fetch();
    await route.fulfill({ response: res, body: (await res.text()).replace(/<script>[\s\S]*?<\/script>/, '') });
  });
  await page.emulateMedia({ colorScheme: 'light' });
  await page.addInitScript(([key, value]) => localStorage.setItem(key, value), [SETTINGS_KEY, settingsEnvelope({ speed: 1, autoMode: false, theme: 'dark' })] as const);
  await page.goto('/');
  await expect(page.locator('#root')).toBeEmpty();
  expect(await page.evaluate(() => document.documentElement.getAttribute('data-theme')), '스크립트가 없으면 건 값이 없다').toBeNull();
  expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor), '스크립트가 없으면 OS 라이트 색으로 번쩍인다').toBe(bg.light);
});

test('제품 문서(dist/index.html)에 인라인 테마 스크립트가 그대로 들어 있고 base 경로·외부 주소를 만들지 않으며 번들 스크립트보다 앞에 있다 (O02)', async ({ request }) => {
  const html = await (await request.get('/')).text();
  const inline = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
  expect(inline, '인라인(src 없는) 스크립트 하나').toHaveLength(1);
  expect(inline[0]).toContain("'suzeo-game:settings'");
  expect(inline[0]).toContain("setAttribute('data-theme'");
  expect(inline[0]).not.toMatch(/https?:|\/assets\/|\/spoongame/);
  expect(html.indexOf('<script>'), '번들 스크립트(type=module)보다 앞').toBeLessThan(html.indexOf('<script type="module"'));
});

/**
 * 푸터의 빌드 버전 = 배포 커밋 (SPEC-003 QM2-7, FS7). 로컬 빌드는 작업 트리 HEAD 앞 7자이고 커밋되지 않은 변경이 있으면 끝에 「+」가 붙는다 — 이 테스트가 같은 규칙으로 기대값을 다시 계산한다.
 * (e2e 설정에는 Node 타입이 없어 모듈 이름을 변수로 둔 동적 import를 쓴다 — 위 R-223 테스트와 같은 방법)
 */
async function gitOutput(args: string[]): Promise<string | null> {
  const mod = 'node:child_process';
  const cp = (await import(mod)) as { execFileSync(file: string, args: string[], options: { encoding: 'utf-8'; stdio: string[] }): string };
  try {
    return cp.execFileSync('git', args, { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return null;
  }
}

test('푸터 빌드 버전(QM2-7): 「v버전 (커밋7자)」이고, 로컬 빌드는 HEAD 앞 7자(커밋 안 된 변경이 있으면 「+」), 깃이 없으면 「개발 빌드」 — 빌드한 때와 같은 작업 트리 상태에서 확인한다', async ({ page }) => {
  await page.goto('/');
  const label = (await page.getByTestId('build-version').innerText()).trim();
  expect(label).toMatch(/^v\d+\.\d+\.\d+ \(([0-9a-f]{7}\+?|개발 빌드)\)$/);
  const head = await gitOutput(['rev-parse', 'HEAD']);
  if (head === null) {
    expect(label).toContain('(개발 빌드)');
    return;
  }
  const dirty = ((await gitOutput(['status', '--porcelain'])) ?? '') !== '';
  // 빌드 뒤에 작업 트리가 더 바뀌었을 수 있다(예: 이 테스트 직전에 파일을 고쳤다). 해시는 반드시 같고, 「+」는 빌드 시점의 상태라 지금 상태와 다를 수 있어 해시만 엄격히 본다.
  expect(label, `HEAD ${head.slice(0, 7)}${dirty ? ' (작업 트리에 변경 있음)' : ''}`).toContain(`(${head.slice(0, 7)}`);
  if (!dirty) expect(label, '변경이 없는 작업 트리에서 빌드했다면 「+」가 없다').not.toContain('+)');
});

/**
 * DP8 배포 확인(QM2-7 c): 공개 주소 푸터의 커밋 7자 = 방금 푸시한 main HEAD 앞 7자. 공개 주소로 나가는 요청이라 기본은 건너뛰고,
 * qa가 배포 직후 환경변수로 켠다 — `DEPLOY_URL=https://hyungjin87c-ux.github.io/spoongame/ DEPLOY_COMMIT=<main HEAD 앞 7자> npx playwright test -c playwright.prod.config.ts -g "DP8"`.
 */
test('DP8 배포 확인(QM2-7 c): 공개 주소 푸터의 커밋 7자가 방금 푸시한 main HEAD 앞 7자와 같고 「+」·「개발 빌드」가 아니다 (DEPLOY_URL·DEPLOY_COMMIT이 있을 때만)', async ({ page }) => {
  const env = (globalThis as unknown as { process?: { env: Record<string, string | undefined> } }).process?.env ?? {};
  test.skip(!env.DEPLOY_URL || !env.DEPLOY_COMMIT, 'DEPLOY_URL·DEPLOY_COMMIT 환경변수가 없어 공개 주소 확인은 건너뛴다');
  expect(env.DEPLOY_COMMIT).toMatch(/^[0-9a-f]{7}$/);
  await page.goto(env.DEPLOY_URL!);
  await expect(page.getByTestId('title-screen')).toBeVisible();
  await expect(page.getByTestId('build-version')).toHaveText(new RegExp(`^v\\d+\\.\\d+\\.\\d+ \\(${env.DEPLOY_COMMIT}\\)$`));
});

/**
 * 제품 번들의 캐러셀 화면 글자 (REV-003-M2-4 R-243). 개발 서버 e2e(e2e/slide-text.spec.ts)는 기대값을 개발 서버의 `/src` 모듈(앱 모델)에서 가져오므로 제품 번들에서는 돌지 않는다 —
 * 형진 님이 보는 것은 Pages의 최소화된 번들이라 **CSS 최소화가 `@container`·`cqw`를 바꾸거나 빠뜨려도** 그쪽 e2e로는 못 잡는다. 이 시험은 **모델 없이 화면 DOM만으로** 가장 나쁜 조건
 * (폭 320px · 글자 200%)의 20장을 본다: ① 번들 CSS가 짧은 쌍의 컨테이너 쿼리·슬라이드 칸 컨테이너·`cqw` 값 크기를 유지한다 ② 20장 금지 패턴 0·값 줄 모양·기준 줄 모양
 * ③ 혼인 건수 슬라이드의 「조혼인율 인구 1천 명당 N.N건」 줄 ④ B형 기준 줄(조사망률·자살률)은 두 줄로 나뉘고 가운뎃점이 감춰진다 ⑤ 가로 넘침·글자 잘림 0.
 */
test('제품 번들 캐러셀(폭 320px·글자 200%): 최소화된 CSS가 컨테이너 쿼리를 유지하고, 화면 글자가 20장 금지 패턴 0·조혼인율 줄·B형 기준 줄 두 줄(기호 숨김)·넘침 0이다 (R-243, 모델 없이 DOM만)', async ({ page, request }) => {
  test.setTimeout(120_000);

  // ① 번들 CSS (vite 최소화 결과) — 컨테이너 쿼리와 슬라이드 칸 컨테이너가 살아 있다
  const html = await (await request.get('/')).text();
  const sheets = [...html.matchAll(/<link[^>]+rel="stylesheet"[^>]*href="([^"]+)"/g)].map((m) => m[1]).concat([...html.matchAll(/<link[^>]+href="([^"]+\.css)"[^>]*>/g)].map((m) => m[1]));
  const hrefs = [...new Set(sheets)];
  expect(hrefs.length, 'index.html에 번들 CSS가 있다').toBeGreaterThan(0);
  const css = (await Promise.all(hrefs.map(async (href) => (await request.get(href)).text()))).join('\n');
  expect(css.length).toBeGreaterThan(3_000);
  expect(css, '기준 줄 쌍: 14em 이하에서 두 항목을 블록으로, 기호를 감춘다').toMatch(/@container\s*\(\s*max-width:\s*14em\s*\)\s*\{\s*\.pair--basis \.pair__item\s*\{\s*display:\s*block;?\s*\}\s*\.pair--basis \.pair__sep\s*\{\s*display:\s*none;?\s*\}\s*\}/);
  expect(css, '통계 기준 줄 쌍: 16.5em 이하').toMatch(/@container\s*\(\s*max-width:\s*16\.5em\s*\)\s*\{\s*\.pair--meta \.pair__item\s*\{\s*display:\s*block;?\s*\}\s*\.pair--meta \.pair__sep\s*\{\s*display:\s*none;?\s*\}\s*\}/);
  expect(css, '슬라이드 칸이 컨테이너다').toMatch(/\.slide\s*\{[^}]*container-type:\s*inline-size/);
  expect(css, '값 글자 크기가 칸 폭(cqw)에 맞춘다').toMatch(/@supports\s*\(\s*width:\s*1cqw\s*\)\s*\{\s*\.slide__value\s*\{[^}]*100cqw/);

  // ② 화면: 폭 320px · 글자 200%, 20장을 모두 넘기며 눈에 보이는 글자를 모은다
  await page.setViewportSize({ width: 320, height: 740 });
  await page.goto('/');
  await expect(page.getByTestId('start-birth')).toBeEnabled();
  await page.getByTestId('carousel-pause').click();
  await setRootFontPercent(page, 200);
  const n = await slideCount(page);
  expect(n).toBe(20);
  const doms: SlideDom[] = [];
  const problems: string[] = [];
  for (let i = 0; i < n; i++) {
    const dom = await collectSlideDom(page);
    doms.push(dom);
    const bad = (msg: string) => problems.push(`${dom.id}: ${msg}`);
    // 금지 패턴 (명당 명 · 같은 단위 연속) — 구성 요소마다 + 전체
    for (const [where, text] of [
      ['표제어', dom.insight],
      ['공식 통계명 줄', dom.official],
      ['캡션', dom.captions.join(' ')],
      ['값 줄', dom.valueLines.map((v) => `${v.label ?? ''} ${v.text}`).join(' / ')],
      ['보조 값 줄', dom.sideLines.join(' / ')],
      ['기준 줄', dom.basisLines.join(' ')],
      ['통계 기준 줄', dom.statLines.join(' ')],
      ['정의', dom.definition],
      ['전체', dom.all.replace(/\s+/g, ' ')],
    ] as const) {
      for (const name of forbiddenIn(text)) bad(`${where}에 금지 패턴(${name}): 「${text.slice(0, 60)}」`);
    }
    // 값 줄 모양: 「숫자 + 단위 낱말」, 값 옆 단위 칸은 단위 낱말 하나
    for (const v of dom.valueLines) {
      if (!VALUE_LINE.test(v.text)) bad(`값 줄 「${v.text}」이 「숫자 + 단위 낱말」이 아니다`);
      if (v.unit !== '' && !UNIT_WORD.test(v.unit)) bad(`단위 칸 「${v.unit}」이 단위 낱말 하나가 아니다`);
    }
    // 표제어·공식 통계명 줄·기준 줄 모양 (SPEC-005 SH1~SH3, 형식표 A·B·C·D): 모델 없이 DOM의 글자만으로 — 공식 통계명 줄 끝 괄호가 기준 연도(월)·범위를 말하고, 기준 줄은 분모가 있는 B형에만 남는다
    if (dom.insight === '' || /[0-9]/.test(dom.insight)) bad(`표제어가 비었거나 숫자가 있다: 「${dom.insight}」`);
    const form = SLIDE_FORMS[dom.id];
    // 공식 전망(형식 P, QI4)은 「이름(2023년 발표, 2022년 기준[, 시나리오])」, 나머지는 「이름(기준)」
    if (form === 'P') {
      if (!/\(\d{4}년 발표, [^()]+ 기준(, [^()]+)?\)$/.test(dom.official.replace(/\s+/g, ' ').trim())) bad(`공식 전망 통계명 줄 모양(「이름(발표 연도 발표, 기준 기준[, 시나리오])」): 「${dom.official}」`);
    } else if (!/\(\d{4}년( \d{1,2}월)?(, [^()]+)?\)$/.test(dom.official.replace(/\s+/g, ' ').trim())) bad(`공식 통계명 줄 모양(「이름(기준)」): 「${dom.official}」`);
    if (form === undefined) bad('형식표(SLIDE_FORMS)에 없는 슬라이드다');
    else if (form === 'B') {
      // 글자 200%·폭 320에서도 분모만 한 줄이다(쌍이 아니라 나뉘지 않는다)
      if (dom.basisLines.length !== 1 || !BASIS_B.test(dom.basisLines[0])) bad(`형식 B 기준 줄이 「인구 N 명당」(분모만, 한 줄)이 아니다: 「${dom.basisLines.join(' / ')}」`);
    } else if (dom.basisLines.length !== 0) bad(`형식 ${form}에 기준 줄이 남아 있다(연도는 공식 통계명 줄이 맡는다): 「${dom.basisLines.join(' / ')}」`);
    // 「통계 기준」 줄: 쌍이 나뉘어도 글자는 「통계 기준: {연도}년 · 마지막 갱신 {날짜}」다(두 줄이면 사이의 기호가 감춰진다)
    // 전망 슬라이드(형식 P)는 「발표: 2023-12-14 · 마지막 갱신 …」(마스터 결정 8)
    if (form === 'P') {
      if (!/^발표: \d{4}-\d{2}-\d{2}\s+마지막 갱신 \d{4}-\d{2}-\d{2}$/.test(dom.statLines.join(' '))) bad(`전망 기준 줄 모양(「발표: … · 마지막 갱신 …」): 「${dom.statLines.join(' / ')}」`);
    } else if (!/^통계 기준: \d{4}년\s+마지막 갱신 \d{4}-\d{2}-\d{2}$/.test(dom.statLines.join(' '))) bad(`「통계 기준」 줄 모양: 「${dom.statLines.join(' / ')}」`);
    // 가로 넘침·글자 잘림 0 (최소화된 CSS에서도 cqw 값 크기·nowrap이 살아 있다)
    problems.push(...textResizeViolations(await measureTextResize(page), `320px/200% ${dom.id}`));
    if (i < n - 1) await page.getByTestId('carousel-next').click();
  }
  expect(problems).toEqual([]);

  // ③ 혼인 건수 슬라이드의 조혼인율 줄
  const marriage = doms.find((d) => d.id === 'marriage-count')!;
  expect(marriage.sideLines, '큰 값 아래 줄').toHaveLength(1);
  expect(marriage.sideLines[0].replace(/\s+/g, ' '), '조혼인율 줄').toMatch(/^조혼인율 인구 1천 명당 \d\.\d건$/);
  expect(marriage.sideLines[0], '데이터 라벨의 괄호 단위를 그대로 쓰지 않는다').not.toContain('(');
  expect(marriage.legend, '조혼인율은 범례(선 무늬)가 아니라 값 줄 아래 줄이다').toEqual([]);
  // ④ B형 두 장(조사망률·자살률)이 실제로 있었고 둘 다 분모만 한 줄(기준 연도는 공식 통계명 줄로 옮겼다)
  const basisB = doms.filter((d) => SLIDE_FORMS[d.id] === 'B');
  expect(basisB.map((d) => d.id).sort()).toEqual(['cdr', 'suicide-rate']);
  for (const d of basisB) expect(d.basisLines, `${d.id} 기준 줄(분모만)`).toHaveLength(1);
  // 공허 통과 방지: 모은 글자·그래프 글자·값 줄이 실제로 있다
  expect(doms.reduce((sum, d) => sum + d.all.length, 0), '모은 화면 글자 수').toBeGreaterThan(2500);
  expect(doms.filter((d) => d.chartTexts.length > 0), '그래프 글자가 모인 슬라이드').toHaveLength(20);
  expect(doms.filter((d) => d.valueLines.length > 0).length, '값 줄이 있는 슬라이드').toBeGreaterThanOrEqual(12);
});

/**
 * 제품 번들의 M3 컨테이너 규칙 (REV-003-M3-4 R-302 ③). M3 r4가 룰렛 제목 상한(`cqi`)·서류 본문(`docbody`)·비교 카드(`cmp`)의 컨테이너 규칙을 새로 넣었는데, 개발 서버 e2e는 소스 CSS를 보므로
 * **vite의 CSS 최소화가 `@container`·`container-type`·`cqi`를 바꾸거나 빠뜨려도** 못 잡는다(R-243이 캐러셀 규칙에 한 것과 같은 이유). 이 시험은 최소화된 번들 CSS를 정규식으로 본다:
 * ① 세 컨테이너(`.roulette__lead`·`.doc__body` = docbody·`.card--cmp` = cmp)가 `container-type: inline-size`를 가진다 ② `@container docbody`(1열 < 11.5rem · 3열 ≥ 17.75rem)·`@container cmp`(쌓기 < 35rem) 규칙이 살아 있다
 * ③ 제목 상한 식(`100cqi`)이 `@supports (width: 1cqi)` 안에 있고, `cqi`는 번들 어디에도 그 밖에 없다 ④ 컨테이너 질의를 모르는 브라우저용 폴백(`@supports not (container-type: inline-size)` 안의 예전 `@media` 쌓기·3열)이 있다
 * ⑤ 그 브라우저가 실제로 적용할 CSS(tests/helpers/browserCss.ts)로 걸러 보면 `@container`·`cqi`·`container-type`이 남지 않고 폴백 `@media` 쌓기·3열이 올라온다. 공백은 최소화 방식이 바뀌어도 견디게 `\s*`로 느슨하게 맞춘다.
 */
test('제품 번들 CSS(M3, R-302): 컨테이너 3종·@container docbody/cmp·cqi 제목 상한이 최소화 뒤에도 살아 있고, cqi는 @supports 안에만 있으며, 컨테이너 질의를 모르는 브라우저용 폴백이 있다', async ({ request }) => {
  const html = await (await request.get('/')).text();
  const hrefs = [...new Set([...html.matchAll(/<link[^>]+href="([^"]+\.css)"[^>]*>/g)].map((m) => m[1]))];
  expect(hrefs.length, 'index.html에 번들 CSS가 있다').toBeGreaterThan(0);
  const css = (await Promise.all(hrefs.map(async (href) => (await request.get(href)).text()))).join('\n');
  expect(css.length).toBeGreaterThan(3_000);

  // ① 컨테이너 세 곳
  expect(css, '룰렛 제목 상자(.roulette__lead)가 컨테이너다').toMatch(/\.roulette__lead\s*\{[^}]*container-type:\s*inline-size/);
  expect(css, '서류 본문(.doc__body)이 이름 있는 컨테이너 docbody다').toMatch(/\.doc__body\s*\{[^}]*container-type:\s*inline-size\s*;\s*container-name:\s*docbody/);
  expect(css, '비교 카드(.card--cmp)가 이름 있는 컨테이너 cmp다').toMatch(/\.card--cmp\s*\{\s*container-type:\s*inline-size\s*;\s*container-name:\s*cmp/);

  // ② @container 규칙
  expect(css, '서류 격자 1열: docbody 11.5rem 미만').toMatch(
    /@container\s+docbody\s*\(\s*max-width:\s*11\.5rem\s*\)\s*\{\s*\.doc__grid\s*\{\s*grid-template-columns:\s*minmax\(0,\s*1fr\)\s*\}\s*\.doc__grid \.span-2\s*\{\s*grid-column:\s*1\s*\/\s*-1\s*\}\s*\}/,
  );
  expect(css, '서류 격자 3열: 뷰포트 640px 이상 안의 docbody 17.75rem 이상').toMatch(
    /@media\s*\(\s*min-width:\s*640px\s*\)\s*\{\s*@container\s+docbody\s*\(\s*min-width:\s*17\.75rem\s*\)\s*\{\s*\.doc__grid\s*\{\s*grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)\s*\}\s*\}\s*\}/,
  );
  expect(css, '비교 표 쌓기: cmp 35rem 미만에서 표를 블록으로, 행을 격자로, 머리글을 가린다').toMatch(
    /@container\s+cmp\s*\(\s*max-width:\s*35rem\s*\)\s*\{\s*\.table--cmp,\s*\.table--cmp tbody\s*\{\s*display:\s*block\s*\}\s*\.table--cmp thead\s*\{\s*position:\s*absolute;[^}]*clip:[^}]*\}\s*\.table--cmp tr\s*\{\s*display:\s*grid;/,
  );

  // ③ 제목 상한 식은 @supports (width: 1cqi) 안에만 있다
  const guarded = /@supports\s*\(\s*width:\s*1cqi\s*\)\s*\{\s*\.roulette__lead \.t-title\s*\{\s*font-size:\s*max\(\s*var\(--fs-lg\)\s*,\s*min\(\s*var\(--fs-2xl\)\s*,\s*calc\(\s*100cqi\s*\/\s*var\(--title-chars\s*,\s*8\)\s*\)\s*\)\s*\)\s*;?\s*\}\s*\}/;
  expect(css, '제목 상한: @supports (width: 1cqi) 안의 max(바닥, min(상한, 100cqi ÷ 칸 수))').toMatch(guarded);
  expect(css, '공허 통과 방지: 번들에 cqi 식이 있다').toMatch(/100cqi/);
  // M4(R-321): 엔딩 「{이름}의 인생」·밀린·오류 화면 메시지의 제목 상한도 같은 모양으로 한 @supports 블록에 있고, 컨테이너(.ending__who·.system .card)가 최소화 뒤에도 살아 있다
  const guardedDash = /@supports\s*\(\s*width:\s*1cqi\s*\)\s*\{\s*\.ending__who \.t-title\s*\{\s*font-size:\s*max\(\s*var\(--fs-lg\)\s*,\s*min\(\s*var\(--fs-2xl\)\s*,\s*calc\(\s*100cqi\s*\/\s*var\(--title-chars\s*,\s*8\)\s*\)\s*\)\s*\)\s*;?\s*\}\s*\.system h1\s*\{\s*font-size:\s*max\(\s*var\(--fs-md\)\s*,\s*min\(\s*var\(--fs-xl\)\s*,\s*calc\(\s*100cqi\s*\/\s*var\(--title-chars\s*,\s*8\)\s*\)\s*\)\s*\)\s*;?\s*\}\s*\}/;
  expect(css, '엔딩·밀린·오류 화면 제목 상한: @supports (width: 1cqi) 안의 max(바닥, min(상한, 100cqi ÷ 칸 수))').toMatch(guardedDash);
  expect(css, '엔딩 이름 칸(.ending__who)이 컨테이너다').toMatch(/\.ending__who\s*\{[^}]*container-type:\s*inline-size/);
  expect(css, '밀린·오류 화면 카드(.system .card)가 컨테이너다').toMatch(/\.system \.card\s*\{\s*container-type:\s*inline-size/);
  // M7b(D-55): 중대 결정 카드 제목(h2.decision__title)의 상한도 같은 모양으로 자기 @supports 블록에 있고, 컨테이너(.decision__body)가 최소화 뒤에도 살아 있다
  const guardedDecision = /@supports\s*\(\s*width:\s*1cqi\s*\)\s*\{\s*\.decision__title\s*\{\s*font-size:\s*max\(\s*var\(--fs-lg\)\s*,\s*min\(\s*var\(--fs-xl\)\s*,\s*calc\(\s*100cqi\s*\/\s*var\(--title-chars\s*,\s*8\)\s*\)\s*\)\s*\)\s*;?\s*\}\s*\}/;
  expect(css, '카드 제목 상한: @supports (width: 1cqi) 안의 max(바닥, min(상한, 100cqi ÷ 칸 수))').toMatch(guardedDecision);
  expect(css, '카드 몸(.decision__body)이 컨테이너다').toMatch(/\.decision__body\s*\{[^}]*container-type:\s*inline-size/);
  // M7c(D-68): 기록 시트 질문(h2.sheet__title)의 상한도 같은 모양으로 자기 @supports 블록에 있다 (컨테이너는 .sheet__body)
  const guardedNote = /@supports\s*\(\s*width:\s*1cqi\s*\)\s*\{\s*\.sheet__title\s*\{\s*font-size:\s*max\(\s*var\(--fs-lg\)\s*,\s*min\(\s*var\(--fs-xl\)\s*,\s*calc\(\s*100cqi\s*\/\s*var\(--title-chars\s*,\s*8\)\s*\)\s*\)\s*\)\s*;?\s*\}\s*\}/;
  expect(css, '기록 시트 질문 상한: @supports (width: 1cqi) 안의 max(바닥, min(상한, 100cqi ÷ 칸 수))').toMatch(guardedNote);
  expect(css, '시트 몸(.sheet__body)이 컨테이너다').toMatch(/\.sheet__body\s*\{[^}]*container-type:\s*inline-size/);
  expect(css.replace(guarded, '').replace(guardedDash, '').replace(guardedDecision, '').replace(guardedNote, ''), 'cqi는 그 @supports 블록들 밖에 없다(밖에 있으면 모르는 브라우저에서 font-size가 unset)').not.toMatch(/\dcqi\b/);

  // ④ 폴백
  expect(css, '폴백: 컨테이너 질의를 모르는 브라우저에서 뷰포트 639px 이하 비교 표 쌓기').toMatch(
    /@supports\s+not\s*\(\s*container-type:\s*inline-size\s*\)\s*\{\s*@media\s*\(\s*max-width:\s*639px\s*\)\s*\{\s*\.table--cmp,\s*\.table--cmp tbody\s*\{\s*display:\s*block\s*\}[^@]*\.table--cmp tr\s*\{\s*display:\s*grid;/,
  );
  expect(css, '폴백: 뷰포트 640px 이상 서류 격자 3열').toMatch(/@media\s*\(\s*min-width:\s*640px\s*\)\s*\{\s*\.doc__grid\s*\{\s*grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)\s*\}\s*\}\s*\}/);

  // ⑤ 모르는 브라우저가 걸러 낸 번들 CSS
  const legacy = cssAppliedBy(css, NO_CONTAINER_QUERIES);
  expect(legacy.length, '걸러 낸 CSS가 비어 있지 않다').toBeGreaterThan(3_000);
  expect(legacy, '모르는 브라우저: @container가 없다').not.toMatch(/@container/);
  expect(legacy, '모르는 브라우저: 컨테이너 단위가 없다').not.toMatch(/\dcq(?:w|h|i|b|min|max)\b/);
  expect(legacy, '모르는 브라우저: container-type이 없다').not.toMatch(/container-(?:type|name)/);
  expect(legacy, '모르는 브라우저: 폴백 @media 쌓기가 올라와 있다').toMatch(/@media\s*\(\s*max-width:\s*639px\s*\)\s*\{\s*\.table--cmp,\s*\.table--cmp tbody\s*\{\s*display:\s*block\s*\}/);
  expect(legacy, '모르는 브라우저: 제목 상한 식이 없어 .t-title 기본이 남는다').not.toMatch(/\.roulette__lead \.t-title/);
  expect(legacy, '모르는 브라우저: 엔딩 제목 상한 식이 없어 .t-title 기본이 남는다').not.toMatch(/\.ending__who \.t-title/);
  const modern = cssAppliedBy(css, WITH_CONTAINER_QUERIES);
  expect(modern, '아는 브라우저: 폴백 @media 쌓기는 걸러진다').not.toMatch(/@media\s*\(\s*max-width:\s*639px\s*\)\s*\{\s*\.table--cmp/);
  expect(modern, '아는 브라우저: @container cmp가 남는다').toMatch(/@container\s+cmp/);
});
