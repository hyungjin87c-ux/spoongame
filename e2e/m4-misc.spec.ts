import { expect, test, type Page } from '@playwright/test';
import type { GameState } from '../src/core/types';
import {
  GAME_KEY,
  KNOWN_SEED,
  SETTINGS_KEY,
  activeTestId,
  findPendingState,
  injectSave,
  lifeState,
  oracleAuto,
  oracleLife,
  pressBeginToLife,
  quietStart,
  readSave,
  readSettings,
  settle,
  startPageHidden,
  tabWalk,
} from './helpers';
import { adultState, openM4Screen } from './m4States';

/**
 * 대시보드 M4의 나머지 완료 기준 (SPEC-003 CM2·CM3·CM4·DP4, DB4·DB9, QM3-3 — 움직임 줄이기·키보드만으로 조작·연타·새로고침 복원·외부 요청 0·저장 키 격리·외모 점수 숫자 없음).
 * 대시보드 구조·동작은 e2e/m4-dashboard.spec.ts, 고정 요소·포커스는 m4-fixed·m4-focus, 줄바꿈은 m4-breaks, 색은 m4-colors가 본다.
 */

const MANUAL = { speed: 1, autoMode: false } as const;

/** 앞으로 N해가 모두 「조용한 해」인 상태 — M7a 이후 0세는 늘 첫 예방접종이 있어 20세 이후 상태다(e2e/helpers.ts#quietStart) */
const quietLife = (page: Page, years: number): Promise<GameState> => quietStart(page, years);

async function recordPct(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const w = window as unknown as { __pcts: number[]; __ages: number[] };
    w.__pcts = [];
    w.__ages = [];
    new MutationObserver(() => {
      const bar = document.querySelector('[data-testid="year-progress"]');
      const ageEl = document.querySelector('[data-testid="life-age"]');
      if (bar === null || ageEl === null) return;
      w.__pcts.push(Number(bar.getAttribute('aria-valuenow')));
      const age = Number((ageEl.textContent ?? '').split('세')[0]);
      if (w.__ages[w.__ages.length - 1] !== age) w.__ages.push(age);
    }).observe(document, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['aria-valuenow'] });
  });
}

// ---------- 움직임 줄이기 ----------

for (const reduced of [true, false]) {
  test(`움직임 줄이기 ${reduced ? '켜짐(시스템 설정)' : '꺼짐'}: 올해 진행률 바는 ${reduced ? '10% 단계로만 바뀌고 전환·애니메이션이 없다' : '부드럽게 1% 단위로 차오른다'} (CM4·DB2)`, async ({ page }) => {
    test.setTimeout(60_000);
    await page.emulateMedia({ reducedMotion: reduced ? 'reduce' : 'no-preference' });
    await page.goto('/');
    const start = await quietLife(page, 4);
    await recordPct(page);
    await injectSave(page, start, '/?__timescale=7', MANUAL);
    await expect(page.getByTestId('pause')).toBeEnabled();
    await expect.poll(() => page.evaluate(() => (window as unknown as { __ages: number[] }).__ages.length), { timeout: 20_000 }).toBeGreaterThanOrEqual(3);
    const pcts = await page.evaluate(() => (window as unknown as { __pcts: number[] }).__pcts.slice());
    expect(pcts.length).toBeGreaterThan(5);
    if (reduced) {
      for (const p of pcts) expect(p % 10, `움직임 줄이기: ${p}%는 10% 단계가 아니다`).toBe(0);
      expect(new Set(pcts).size, '단계 수').toBeLessThanOrEqual(11);
      const style = await page.evaluate(() => ({
        fill: getComputedStyle(document.querySelector('.year-progress__fill')!).transitionDuration,
        meter: getComputedStyle(document.querySelector('.meter__fill')!).transitionDuration,
        scroll: getComputedStyle(document.querySelector('.log__list')!).scrollBehavior,
        animations: document.getAnimations().length,
      }));
      expect(parseFloat(style.fill), '진행률 바 전환').toBeLessThanOrEqual(0.01);
      expect(parseFloat(style.meter), '상태 막대 전환').toBeLessThanOrEqual(0.01);
      expect(style.scroll, '인생 기록 스크롤').toBe('auto');
      expect(style.animations, '진행 중인 애니메이션 없음').toBe(0);
    } else {
      expect(pcts.some((p) => p % 10 !== 0), '부드러운 모드에서는 10의 배수가 아닌 값이 있다').toBe(true);
    }
  });
}

test('움직임 줄이기(앱 설정 data-motion=reduce)도 같다: 문서에 걸면 진행률 바가 10% 단계로 바뀌고 기록 스크롤이 즉시다', async ({ page }) => {
  test.setTimeout(60_000);
  await page.goto('/');
  const start = await quietLife(page, 4);
  await recordPct(page);
  await injectSave(page, start, '/?__timescale=7', MANUAL);
  await expect(page.getByTestId('pause')).toBeEnabled();
  // 앱 설정(문서의 data-motion)을 화면이 뜬 뒤에 건다(init script는 documentElement가 생기기 전에 돌 수 있다) — 훅이 속성 변화를 지켜본다. 켠 뒤의 값만 본다.
  await page.evaluate(() => document.documentElement.setAttribute('data-motion', 'reduce'));
  // 속성을 건 뒤 React가 다시 그려 바가 10% 단계로 바뀔 때까지 기다린다(r4 안정화): 속성 변화는 MutationObserver → React 상태로 한 박자 늦게 전해져서, 바로 표본을 비우면 그 사이에 찍힌 부드러운 모드의 마지막 값
  // (예: 86%)이 켠 뒤의 표본으로 섞여 부하가 클 때 가끔 실패했다(120회 반복 중 2~9회). 부드러운 모드는 연속 표본이 1%씩 오르므로 「마지막 표본 12개가 모두 10의 배수」는 단계 모드가 적용됐다는 확실한 신호다.
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const last = (window as unknown as { __pcts: number[] }).__pcts.slice(-12);
          return last.length === 12 && last.every((p) => p % 10 === 0);
        }),
      { message: '움직임 줄이기가 적용돼 진행률 바가 10% 단계로만 바뀐다', timeout: 10_000 },
    )
    .toBe(true);
  await page.evaluate(() => {
    (window as unknown as { __pcts: number[]; __ages: number[] }).__pcts.length = 0;
    (window as unknown as { __pcts: number[]; __ages: number[] }).__ages.length = 0;
  });
  await expect.poll(() => page.evaluate(() => (window as unknown as { __ages: number[] }).__ages.length), { timeout: 20_000 }).toBeGreaterThanOrEqual(2);
  const pcts = await page.evaluate(() => (window as unknown as { __pcts: number[] }).__pcts.slice());
  expect(pcts.length).toBeGreaterThan(3);
  for (const p of pcts) expect(p % 10, `앱 설정 움직임 줄이기: ${p}%는 10% 단계가 아니다`).toBe(0);
  expect(await page.evaluate(() => getComputedStyle(document.querySelector('.log__list')!).scrollBehavior)).toBe('auto');
});

// ---------- 키보드만으로 모든 조작 ----------

test('키보드만으로: 선택지 고르기 → 일시정지 → 배속 → 다음 결정으로 → BGM·생각 남기기·다크 모드·나가기 확인까지 마우스 없이 되고, 포커스가 문서 밖(body)으로 떨어지지 않는다 (CM2)', async ({ page }) => {
  test.setTimeout(90_000);
  await startPageHidden(page); // 타이머가 끼어들지 않게
  await page.goto('/');
  const decision = await findPendingState(page, 'present', { minChoices: 2 });
  await injectSave(page, decision, '/', MANUAL);
  await expect(page.getByTestId('choice-panel')).toBeVisible();
  await expect.poll(() => activeTestId(page)).toBe('choice-title');
  const notBody = async (label: string) => expect(await page.evaluate(() => document.activeElement !== document.body && document.activeElement !== null), `${label}: 포커스가 문서 밖으로 떨어졌다`).toBe(true);

  // 1) 선택지: 제목에서 Tab → 첫 선택지 → Enter
  const firstId = decision.pending!.choiceIds[0];
  await expect(page.getByTestId(`choice-${firstId}`)).toBeEnabled();
  await page.keyboard.press('Tab');
  expect(await activeTestId(page)).toBe(`choice-${firstId}`);
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('choice-panel')).toHaveCount(0);
  await expect.poll(() => activeTestId(page), '선택한 버튼이 사라진 뒤 포커스는 인생 화면 제목').toBe('life-name');
  await notBody('선택 뒤');

  // 2) 진행 줄: 일시정지(Space) → 배속 2배(Space) → 다음 결정으로(Enter)
  // 선택지를 고른 직후 400ms는 인생 화면 컨트롤에 입력 가드가 걸려 있다(M7c r2 F-1: 시트·카드가 사라진 자리의 더블탭 보호) — 가드가 풀린 뒤에 누른다. 키보드로 Tab 이동은 가드와 무관하다
  await expect(page.getByTestId('pause')).not.toHaveAttribute('aria-disabled', 'true');
  expect(await tabWalk(page, 1)).toEqual(['pause']);
  await page.keyboard.press('Space');
  await expect(page.getByTestId('pause')).toHaveText('다시 진행');
  await page.keyboard.press('Space');
  await expect(page.getByTestId('pause')).toHaveText('일시정지');
  expect(await tabWalk(page, 2)).toEqual(['speed-1', 'speed-2']);
  await page.keyboard.press('Space');
  await expect(page.locator('[data-speed="2"]')).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(async () => (await readSettings(page)).speed).toBe(2);
  expect(await tabWalk(page, 3)).toEqual(['speed-4', 'speed-8', 'skip']);
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('choice-panel')).toBeVisible(); // 다음 결정까지 즉시 진행
  await expect.poll(() => activeTestId(page), '버튼이 아니라 선택지 제목으로').toBe('choice-title');
  await notBody('다음 결정으로 뒤');
  // 수동 모드의 카드는 모달 시트라 도구 줄이 inert다 — Esc로 접으면(M7b U7) 포커스는 「결정 다시 열기」로 가고 컨트롤에 닿는다
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('decision-fold')).toBeVisible();
  await expect.poll(() => activeTestId(page), '접으면 「결정 다시 열기」로').toBe('decision-reopen');
  await notBody('카드 접은 뒤');

  // 3) 도구 줄: 인생 화면 제목 → Tab으로 도구까지 (진행 줄 7개 다음이 도구 5개)
  await page.getByTestId('life-name').focus();
  const walk = await tabWalk(page, 12);
  expect(walk).toEqual(['pause', 'speed-1', 'speed-2', 'speed-4', 'speed-8', 'skip', 'auto', 'tool-bgm', 'tool-note', 'tool-dark', 'tool-feedback', 'tool-exit']);
  // 지금 포커스는 나가기. 거꾸로 올라가 BGM·생각 남기기·다크 모드를 연다
  await page.keyboard.press('Shift+Tab');
  await page.keyboard.press('Shift+Tab'); // tool-dark
  expect(await activeTestId(page)).toBe('tool-dark');
  await expect(page.getByTestId('tool-dark')).toBeEnabled(); // 카드를 접은 직후 0.4초는 컨트롤의 입력 가드가 눌림을 삼킨다 (M7b U9)
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('tool-dark')).toHaveAttribute('aria-pressed', 'true');
  expect((await readSettings(page)).theme).toBe('dark');
  await page.keyboard.press('Shift+Tab'); // tool-note: 보통 버튼이다(M7c) — 키보드로 열면 기록 시트가 뜨고 Esc로 닫으면 포커스가 돌아온다
  expect(await activeTestId(page)).toBe('tool-note');
  await expect(page.getByTestId('tool-note')).toBeEnabled();
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('note-sheet')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('note-sheet')).toHaveCount(0);
  await expect.poll(() => activeTestId(page), '닫으면 포커스는 「생각 남기기」로').toBe('tool-note');
  await page.keyboard.press('Shift+Tab'); // tool-bgm
  expect(await activeTestId(page)).toBe('tool-bgm');
  await expect(page.getByTestId('tool-bgm'), '기록 시트를 닫은 직후 0.4초는 컨트롤의 입력 가드가 눌림을 삼킨다 (M7c r2 F-1)').not.toHaveAttribute('aria-disabled', 'true');
  await page.keyboard.press('Space');
  await expect(page.getByTestId('tool-bgm')).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(async () => (await readSettings(page)).bgm.on).toBe(true);
  await expect(page.getByTestId('bgm-volume-input')).toBeVisible();
  await notBody('도구 조작 뒤');

  // 4) 볼륨은 키보드(방향키)로 5% 단위
  await page.getByTestId('bgm-volume-input').focus();
  const volume = (await readSettings(page)).bgm.volume;
  await page.keyboard.press('ArrowRight');
  await expect.poll(async () => (await readSettings(page)).bgm.volume).toBe(volume + 5);

  // 5) 나가기: Enter → 확인 단계의 「돌아가기」에 포커스 → Esc로 닫으면 포커스는 「나가기」
  await page.getByTestId('tool-exit').focus();
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('exit-ask')).toBeVisible();
  await expect.poll(() => activeTestId(page)).toBe('exit-no');
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('exit-ask')).toHaveCount(0);
  await expect.poll(() => activeTestId(page)).toBe('tool-exit');
  // 확인 단계에서 Tab으로 「첫 화면으로 나가기」에 닿아 Enter → 첫 화면
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('exit-ask')).toBeVisible();
  await page.keyboard.press('Shift+Tab');
  expect(await activeTestId(page)).toBe('exit-yes');
  await expect(page.getByTestId('exit-yes')).toBeEnabled();
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('title-screen')).toBeVisible();
  await expect(page.getByTestId('resume')).toBeVisible();
});

// ---------- 연타 ----------

test('연타: 일시정지를 10번 빠르게 눌러도 짝이 맞게 켜지고 꺼지며(상태와 저장이 어긋나지 않는다), 배속 버튼을 번갈아 연타하면 마지막 입력이 남는다', async ({ page }) => {
  test.setTimeout(60_000);
  await startPageHidden(page);
  await page.goto('/');
  await injectSave(page, lifeState(KNOWN_SEED), '/', MANUAL);
  const pause = page.getByTestId('pause');
  await expect(pause).toBeEnabled();
  const box = (await pause.boundingBox())!;
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  for (let i = 0; i < 10; i++) await page.mouse.click(x, y);
  await settle(page);
  await expect(pause).toHaveText('일시정지'); // 10번 = 짝수
  await expect.poll(async () => (await readSave(page)).data.paused).toBe(false);
  for (let i = 0; i < 7; i++) await page.mouse.click(x, y);
  await settle(page);
  await expect(pause).toHaveText('다시 진행'); // 7번 = 홀수
  await expect.poll(async () => (await readSave(page)).data.paused).toBe(true);
  // 배속 번갈아 연타
  const center = async (speed: number) => {
    const b = (await page.locator(`[data-speed="${speed}"]`).boundingBox())!;
    return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
  };
  const points = new Map([1, 2, 4, 8].map((s) => [s, undefined as { x: number; y: number } | undefined]));
  for (const s of [1, 2, 4, 8]) points.set(s, await center(s));
  for (const s of [8, 2, 4, 1, 8, 2]) await page.mouse.click(points.get(s)!.x, points.get(s)!.y);
  await expect(page.locator('[data-speed="2"]')).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(async () => (await readSettings(page)).speed).toBe(2);
});

test('연타: 「다음 결정으로」를 두 번 눌러도 선택지 한 곳에서만 멈추고, 선택지를 두 번 눌러도 선택은 한 번만 기록된다', async ({ page }) => {
  test.setTimeout(60_000);
  await startPageHidden(page);
  await page.goto('/');
  const found = await findPendingState(page, 'present');
  const start = await oracleLife(page, found.seed, 'present');
  await injectSave(page, start, '/', MANUAL);
  const skip = page.getByTestId('skip');
  await expect(skip).toBeEnabled();
  const b = (await skip.boundingBox())!;
  await page.mouse.dblclick(b.x + b.width / 2, b.y + b.height / 2);
  await expect(page.getByTestId('choice-panel')).toBeVisible();
  await settle(page);
  const pending = (await readSave(page)).data.pending!;
  expect(pending.key).toBe(found.pending!.key); // 첫 결정에서 멈췄다(둘째 입력이 더 진행시키지 못한다)
  const choice = page.getByTestId(`choice-${pending.choiceIds[0]}`);
  await expect(choice).toBeEnabled();
  const c = (await choice.boundingBox())!;
  await page.mouse.dblclick(c.x + c.width / 2, c.y + c.height / 2);
  await expect(page.getByTestId('choice-panel')).toHaveCount(0);
  await settle(page);
  const choices = (await readSave(page)).data.history.filter((h) => h.kind === 'choice' && h.eventId === pending.eventId);
  expect(choices, '같은 이벤트의 선택 기록은 하나').toHaveLength(1);
});

// ---------- 새로고침 복원 ----------

test('새로고침 복원: 프로필·식구·또래·상태·가상 인구 줄이 새로고침을 여러 번 해도 똑같다 (결정적)', async ({ page }) => {
  test.setTimeout(60_000);
  await startPageHidden(page);
  await page.goto('/');
  await injectSave(page, await adultState(page), '/', MANUAL);
  const ids = ['profile-card', 'family-card', 'peers-now-card', 'stats', 'log-pin', 'life-name', 'life-age', 'life-year'] as const;
  const snapshot = async (): Promise<Record<string, string>> => Object.fromEntries(await Promise.all(ids.map(async (id): Promise<[string, string]> => [id, (await page.getByTestId(id).innerText()).replace(/\s+/g, ' ')])));
  await expect(page.getByTestId('auto')).toBeEnabled();
  const before = await snapshot();
  expect(Object.values(before).every((v) => v.length > 0)).toBe(true);
  for (let i = 0; i < 3; i++) {
    await page.reload();
    await expect(page.getByTestId('life-screen')).toBeVisible();
    expect(await snapshot(), `${i + 1}번째 새로고침`).toEqual(before);
  }
  // 저장은 새로고침이 바꾸지 않는다(타이머가 멈춰 있다)
  expect((await readSave(page)).data.history.length).toBeGreaterThan(20);
});

// ---------- 외부 요청 0 ----------

test('외부 요청 0: 첫 화면 → 태어나기 → 인생(자동 모드 고속)으로 사망·엔딩·다시 태어나기까지 같은 출처(localhost) 밖으로 나가는 요청이 없고 오류도 없다 (CM3)', async ({ page }) => {
  test.setTimeout(180_000);
  const external: string[] = [];
  const errors: string[] = [];
  page.on('request', (r) => {
    const u = new URL(r.url());
    if (u.hostname !== 'localhost' && u.hostname !== '127.0.0.1') external.push(r.url());
  });
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  await page.goto('/');
  await expect(page.getByTestId('title-screen')).toBeVisible();
  await page.goto('/?__timescale=3000');
  await injectSave(page, lifeState(KNOWN_SEED), '/?__timescale=3000', { speed: 8, autoMode: true });
  await expect(page.getByTestId('ending-screen')).toBeVisible({ timeout: 90_000 });
  // 도구 줄·엔딩·다시 태어나기도 외부로 나가지 않는다
  await expect(page.getByTestId('rebirth')).toBeEnabled();
  await page.getByTestId('rebirth').click();
  await expect(page.getByTestId('title-screen')).toBeVisible();
  expect(external, '같은 출처 밖 요청').toEqual([]);
  expect(errors, '오류').toEqual([]);
});

// ---------- 저장 키 격리 (DP4) ----------

test('저장 키 격리(DP4): 같은 출처의 다른 프로젝트 키가 있어도 이 앱은 자기 두 키(suzeo-game:save·settings)만 쓰고 남의 키를 한 글자도 바꾸지 않는다. 저장 지우고 새로 시작도 남의 키를 지우지 않는다', async ({ page }) => {
  test.setTimeout(90_000);
  const FOREIGN: Record<string, string> = {
    save: '{"version":7,"data":"남의 저장"}',
    settings: '{"theme":"neon"}',
    theme: 'dark',
    'other-game:save': '{"x":1}',
    'suzeo-game': 'no-colon',
    'Suzeo-Game:save': 'case',
    'suzeo-game2:save': 'longer',
  };
  await page.addInitScript(
    ([entries]) => {
      for (const [k, v] of Object.entries(entries)) if (localStorage.getItem(k) === null) localStorage.setItem(k, v);
    },
    [FOREIGN] as const,
  );
  const dump = () => page.evaluate(() => Object.fromEntries(Object.keys(localStorage).sort().map((k) => [k, localStorage.getItem(k)!])));
  await page.goto('/');
  await expect(page.getByTestId('title-screen')).toBeVisible();
  await pressBeginToLife(page);
  // 설정을 바꿔 본다: 배속·BGM·다크·일시정지
  await expect(page.getByTestId('pause')).toBeEnabled();
  await page.locator('[data-speed="4"]').click();
  await page.getByTestId('tool-bgm').click();
  await page.getByTestId('tool-dark').click();
  await page.getByTestId('pause').click();
  await expect.poll(async () => (await readSettings(page)).theme).toBe('dark');
  const stored = await dump();
  for (const [k, v] of Object.entries(FOREIGN)) expect(stored[k], `남의 키 「${k}」`).toBe(v);
  const own = Object.keys(stored).filter((k) => !(k in FOREIGN));
  expect(own.sort(), '이 앱이 쓴 키는 접두어가 있는 두 개뿐').toEqual([GAME_KEY, SETTINGS_KEY].sort());
  for (const k of own) expect(k.startsWith('suzeo-game:')).toBe(true);

  // 오류 화면의 「저장 지우고 새로 시작」: 내 저장만 지운다
  await page.goto('/?__crash=1');
  await expect(page.getByTestId('error-screen')).toBeVisible();
  await page.getByRole('button', { name: '저장 지우고 새로 시작' }).click();
  await expect(page.getByTestId('title-screen')).toBeVisible();
  const after = await dump();
  for (const [k, v] of Object.entries(FOREIGN)) expect(after[k], `저장 지운 뒤에도 남의 키 「${k}」`).toBe(v);
  expect(Object.keys(after).filter((k) => !(k in FOREIGN)).every((k) => k.startsWith('suzeo-game:'))).toBe(true);
});

// ---------- 외모 점수 숫자 없음 ----------

for (const looks of [88, 97]) {
  test(`외모 ${looks}점인 인물: 대시보드·엔딩 어디에도 점수 숫자가 없고 「상위/하위 약 N%」 한 가지뿐이다 (R-135)`, async ({ page }) => {
    test.setTimeout(90_000);
    await startPageHidden(page);
    await page.goto('/');
    const base = lifeState(KNOWN_SEED);
    const life: GameState = { ...base, character: { ...base.character!, looks }, stats: { ...base.stats, education: 12, health: 64, happiness: 41, relationships: 22 } };
    await injectSave(page, life, '/', MANUAL);
    await expect(page.getByTestId('auto')).toBeEnabled();
    const textOf = async (testId: string) => (await page.getByTestId(testId).innerText()).replace(/\s+/g, ' ');
    const standalone = new RegExp(`(?<![\\d,.])${looks}(?![\\d,.]|%)`);
    expect(await textOf('life-screen')).not.toMatch(standalone);
    expect(await textOf('profile-looks')).toMatch(/^또래 사이에서 (상위|하위)/);
    // 엔딩
    const ended = await oracleAuto(page, { ...life, age: 0, history: life.history, character: life.character });
    expect(ended.phase).toBe('ending');
    // 엔딩에는 사망 나이·연표 나이·재산 같은 다른 숫자가 많다. 점수와 우연히 같은 숫자가 있으면 점수 노출과 구별할 수 없으므로,
    // 먼저 원래 외모(50)의 엔딩 글에서 홀로 나오지 않는 숫자를 점수로 골라(후보: 이 시험의 값 → 97·88·79·71·66) 그 점수로 바꿔 열었을 때도 홀로 나오지 않음을 본다.
    const pattern = (n: number) => new RegExp(String.raw`(?<![\d,.])` + String(n) + String.raw`(?![\d,.]|%)`);
    const baseline = { ...ended, character: { ...ended.character!, looks: 50 } };
    await injectSave(page, baseline, '/', MANUAL);
    await expect(page.getByTestId('rebirth')).toBeEnabled();
    const baseText = await textOf('ending-screen');
    const lk = [looks, 97, 88, 79, 71, 66].find((c) => !pattern(c).test(baseText));
    expect(lk, '엔딩 글에 없는 숫자를 점수로 고를 수 있어야 한다').toBeDefined();
    const lkPattern = pattern(lk!);
    await injectSave(page, { ...ended, character: { ...ended.character!, looks: lk! } }, '/', MANUAL);
    await expect(page.getByTestId('rebirth')).toBeEnabled();
    const ending = await textOf('ending-screen');
    expect(ending).not.toMatch(lkPattern);
    expect(await textOf('final-looks')).toMatch(/(상위|하위)/);
    expect(ending).not.toMatch(/외모\s*\d/);
  });
}

test('M4 기본 화면 확인: 첫 화면 → 인생 → 엔딩의 옛 <h1>수저 게임</h1> 문구가 새 공통 헤더(로고 + 화면 이름)로 바뀌었다 (밀린 화면·오류 화면 포함)', async ({ page }) => {
  test.setTimeout(90_000);
  for (const screen of ['ending', 'superseded', 'error'] as const) {
    await openM4Screen(page, screen);
    await expect(page.getByTestId('header-logo')).toBeVisible();
    const h1s = await page.locator('h1').allInnerTexts();
    expect(h1s, `${screen}: h1은 하나`).toHaveLength(1);
    expect(h1s[0], `${screen}: 옛 게임명 h1이 아니다`).not.toBe('수저 게임');
    const head = await page.getByTestId('site-head').innerText();
    expect(head).toContain({ ending: '엔딩', superseded: '저장 안내', error: '오류' }[screen]);
  }
});
