import { expect, type Locator, type Page } from '@playwright/test';
import type { Character, Era, GameState, LifeLength, Settings } from '../src/core/types';
import { DEFAULT_ERA_CHOICE, DEFAULT_LIFE_LENGTH_CHOICE, GAME_KEY, SAVE_VERSION, SETTINGS_KEY, settingsEnvelope, type InjectedSettings } from './saves';

/**
 * e2e 공용 헬퍼 (R-022 d): 알려진 시드의 저장을 주입해 실패를 재현 가능하게 만든다.
 *
 * Playwright는 src/core를 직접 import할 수 없다(names.json이 import attribute 없는 JSON import라
 * Node ESM이 거부한다). 그래서
 *  - 저장 데이터는 손으로 만든 순수 객체로 주입하고(타입만 가져온다),
 *  - "core가 계산했을 기대값"은 개발 서버의 실제 모듈(/src/core/index.ts)을 브라우저에서 불러 구한다.
 * 키·버전이 core와 어긋나지 않는지는 tests/e2eHelpers.test.ts가 vitest에서 대조한다.
 */

export { GAME_KEY, KNOWN_SEED, PEER_SEED, SAVE_VERSION, SETTINGS_KEY, SETTINGS_VERSION, birthState, lifeState, report, rouletteState, settingsEnvelope, titleState, type InjectedSettings } from './saves';

/**
 * 이 페이지의 앱이 더 이상 저장하지 않게 한다: "다른 탭이 저장을 바꿨다"는 storage 이벤트를 흉내 낸다(R-011 동작).
 * 테스트가 같은 탭에서 localStorage를 직접 바꾼 뒤 이동/새로고침하면, 떠나는 앱이 pagehide에서 자기 상태를 다시 저장해
 * 심어 둔 값을 덮어쓰기 때문이다(사람이 같은 탭의 저장을 직접 바꾸는 일은 없다).
 */
async function stopAppSaving(page: Page): Promise<void> {
  await page.evaluate((key) => window.dispatchEvent(new StorageEvent('storage', { key })), GAME_KEY);
  // 앱이 실제로 「밀린 화면」으로 바뀌어 저장을 멈출 때까지 기다린다. 기다리지 않고 곧바로 이동하면 떠나는 앱의 pagehide 저장이 심어 둔 값을 덮어쓸 수 있다:
  // 심은 값이 진행 없는 타이틀이고 앱이 아는 값도 타이틀이면 A66(잃을 진행이 없는 첫 저장은 충돌이 아니다)에 따라 덮어쓰기가 허용되기 때문이다.
  // 밀린 화면이 끝내 뜨지 않으면 조용히 넘어가지 않고 그 자리에서 실패한다(R-217 ④: 예전에는 시간 초과를 삼켜서, 덮어쓰기 경합이 생겨도 테스트가 다른 곳에서 엉뚱하게 실패했다).
  await page.getByTestId('superseded-screen').waitFor({ state: 'attached', timeout: 3000 }).catch((error: unknown) => {
    throw new Error('앱이 「밀린 화면」으로 바뀌지 않았다(storage 이벤트를 받지 못했다): 심어 둔 저장이 떠나는 앱의 pagehide 저장에 덮일 수 있어 이어갈 수 없다', { cause: error });
  });
}

/** 게임 저장만 지운다(설정은 남긴다). 이 페이지의 앱이 지워진 저장을 되살리지 않게 한 뒤 호출하는 쪽이 이동/새로고침한다. */
export async function clearGameSave(page: Page): Promise<void> {
  await page.evaluate((key) => localStorage.removeItem(key), GAME_KEY);
  await stopAppSaving(page);
}

/**
 * 저장을 심고 target 경로를 연다. 먼저 앱을 한 번 연 뒤(같은 origin 확보) localStorage를 덮어쓰고
 * 다시 연다. addInitScript와 달리 이후 이동·리셋에서 저장이 되살아나지 않는다.
 */
export async function injectSave(page: Page, state: GameState, target = '/', settings?: InjectedSettings): Promise<void> {
  await page.goto('/');
  // 앱이 첫 렌더 뒤 자기 초기 상태를 저장한다. 그 저장이 우리가 심은 값을 덮어쓰지 않도록 기다린다.
  await page.waitForFunction((key) => localStorage.getItem(key) !== null, GAME_KEY);
  await page.evaluate(
    ([key, value, settingsKey, settingsValue]) => {
      localStorage.setItem(key, value);
      if (settingsValue !== null) localStorage.setItem(settingsKey, settingsValue);
    },
    [
      GAME_KEY,
      JSON.stringify({ version: SAVE_VERSION, data: state }),
      SETTINGS_KEY,
      settings ? settingsEnvelope(settings) : null,
    ] as const,
  );
  await stopAppSaving(page);
  await page.goto(target);
}

/** 이미 심어 둔 페이지에서 저장(과 선택적으로 설정)만 바꾸고 새로고침(뷰포트 반복 실험용). 현재 주소의 쿼리(?__guard 등)는 그대로 유지된다. */
export async function replaceSaveAndReload(page: Page, state: GameState, settings?: InjectedSettings): Promise<void> {
  await page.evaluate(
    ([key, value, settingsKey, settingsValue]) => {
      localStorage.setItem(key, value);
      if (settingsValue !== null) localStorage.setItem(settingsKey, settingsValue);
    },
    [
      GAME_KEY,
      JSON.stringify({ version: SAVE_VERSION, data: state }),
      SETTINGS_KEY,
      settings ? settingsEnvelope(settings) : null,
    ] as const,
  );
  await stopAppSaving(page);
  await page.reload();
}

export interface Save {
  version: number;
  data: GameState;
}

export async function readSave(page: Page): Promise<Save> {
  const raw = await page.evaluate((k) => localStorage.getItem(k), GAME_KEY);
  expect(raw, '저장이 있어야 한다').not.toBeNull();
  return JSON.parse(raw!) as Save;
}

export async function noHorizontalOverflow(page: Page): Promise<boolean> {
  return page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth);
}

export interface BirthOracle {
  /** 주입한 상태에 core의 beginBirth를 정확히 한 번 적용한 결과 = 「태어나기」 직후의 저장(룰렛 단계, 출생 결과가 이미 확정돼 있다) */
  once: GameState;
  /** once에 enterBirth를 적용한 결과 = 「출생신고 보기」 뒤의 저장(출생 단계). 출생 결과는 once와 같다. */
  born: GameState;
  /** 만약 한 번 더 뽑았다면 나왔을 인물 — 1회/2회를 가르는 판별력 확인용 */
  second: Character;
}

/**
 * core 순수 함수가 계산한 기대값. 개발 서버의 실제 모듈을 브라우저에서 불러 같은 코드를 쓴다.
 * 앱 페이지가 열려 있어야 한다(같은 origin).
 */
export async function expectedBirth(page: Page, before: GameState, era: Era = DEFAULT_ERA_CHOICE, lifeLength: LifeLength = DEFAULT_LIFE_LENGTH_CHOICE): Promise<BirthOracle> {
  return page.evaluate<BirthOracle>(`(async () => {
    const core = await import('/src/core/index.ts');
    const before = ${JSON.stringify(before)};
    const once = core.beginBirth(before, ${JSON.stringify(era)}, ${JSON.stringify(lifeLength)});
    const born = core.enterBirth(once);
    const second = core.generateBirth(core.createRng(once.rngState), once.era).character;
    return { once, born, second };
  })()`);
}

/** 첫 화면에서 세상·인생 길이를 고른다(라디오 카드). 이미 골라져 있어도 된다. */
/**
 * 라디오 카드를 가운데로 스크롤한 뒤 누른다. 하단 고정 「태어나기」 띠가 화면 아래쪽 카드를 덮을 수 있어(사람은 스크롤해서 누른다),
 * 자동 스크롤(보이면 그대로 둔다)에 맡기지 않고 띠 위로 올려 둔다.
 */
async function checkRadio(page: Page, testId: string): Promise<void> {
  const input = page.getByTestId(testId);
  await expect(page.getByTestId('start-birth')).toBeEnabled(); // 화면 진입 입력 가드가 풀린 뒤(가드 중의 클릭은 선택을 바꾸지 않는다)
  await input.evaluate((el) => el.scrollIntoView({ block: 'center' }));
  await input.check();
  await expect(input).toBeChecked();
}

export async function chooseEra(page: Page, era: Era): Promise<void> {
  await checkRadio(page, `era-${era}`);
}

export async function chooseLifeLength(page: Page, lifeLength: LifeLength): Promise<void> {
  await checkRadio(page, `life-${lifeLength}`);
}

/** 첫 화면의 하단 고정 「태어나기」 (진입 가드가 풀릴 때까지 기다린 뒤 누른다) */
export async function pressBegin(page: Page): Promise<void> {
  const begin = page.getByTestId('start-birth');
  await expect(begin).toBeEnabled();
  await begin.click();
}

/**
 * 룰렛 화면에서 「건너뛰기」를 눌러 결과 상태로 간다(연출은 4~6초라 흐름 테스트는 건너뛴다. 연출 자체는 e2e/roulette.spec.ts가 본다).
 * 회전 중이 아니면(움직임 줄이기·복원) 이미 결과 상태이므로 아무것도 누르지 않는다.
 */
export async function skipRoulette(page: Page): Promise<void> {
  const roulette = page.getByTestId('roulette-screen');
  await expect(roulette).toBeVisible();
  if ((await roulette.getAttribute('data-state')) === 'spinning') {
    const skip = page.getByTestId('skip-roulette');
    await expect(skip).toBeEnabled(); // 화면 진입 입력 가드가 풀린 뒤
    await skip.click();
  }
  await expect(roulette).toHaveAttribute('data-state', 'result');
}

/** 룰렛 결과 화면의 「출생신고 보기」 (진입 가드가 풀릴 때까지 기다린 뒤 누른다) */
export async function toBirthReport(page: Page): Promise<void> {
  const next = page.getByTestId('to-birth');
  await expect(next).toBeEnabled();
  await next.click();
  await expect(page.getByTestId('birth-screen')).toBeVisible();
}

/** 첫 화면 「태어나기」 → 룰렛 건너뛰기 → 「출생신고 보기」: 출생신고 화면까지 간다 */
export async function pressBeginToBirth(page: Page): Promise<void> {
  await pressBegin(page);
  await skipRoulette(page);
  await toBirthReport(page);
}

/** 첫 화면 「태어나기」 → 룰렛 → 출생신고 → 「살아가기」: 인생 화면까지 간다 */
export async function pressBeginToLife(page: Page): Promise<void> {
  await pressBeginToBirth(page);
  const live = page.getByTestId('next-life');
  await expect(live).toBeEnabled();
  await live.click();
  await expect(page.getByTestId('life-screen')).toBeVisible();
}

/** 사람의 더블클릭·연타에 해당하는 입력 방식 */
export type RapidMethod = 'dblclick' | 'mouse2' | 'mouse3' | 'human150';

export const RAPID_METHODS: readonly RapidMethod[] = ['dblclick', 'mouse2', 'mouse3', 'human150'];

/**
 * 버튼 중심 좌표에 빠르게 연속 입력한다. 첫 입력 직후 화면이 바뀌어도 같은 좌표에 둘째 이후 입력이 들어간다.
 * (Locator.click과 달리 좌표 입력은 요소의 활성 여부를 기다리지 않으므로, 호출 전에
 *  버튼이 활성화됐음을 expect(...).toBeEnabled()로 확인해야 한다.)
 */
export async function rapidInput(page: Page, method: RapidMethod, target: Locator): Promise<void> {
  // 낮은 화면에서는 버튼이 접힌 곳 아래에 있다. 좌표 입력 전에 보이는 위치로 스크롤해 둔다.
  await target.scrollIntoViewIfNeeded();
  const box = await target.boundingBox();
  expect(box, '버튼이 화면에 있어야 한다').not.toBeNull();
  const x = box!.x + box!.width / 2;
  const y = box!.y + box!.height / 2;
  if (method === 'dblclick') {
    await target.dblclick();
  } else if (method === 'mouse2') {
    await page.mouse.click(x, y);
    await page.mouse.click(x, y);
  } else if (method === 'mouse3') {
    await page.mouse.click(x, y);
    await page.mouse.click(x, y);
    await page.mouse.click(x, y);
  } else {
    // 사람이 실제로 더블클릭하는 간격(약 150ms)
    await page.mouse.click(x, y);
    await page.waitForTimeout(150);
    await page.mouse.click(x, y);
  }
}

/**
 * 페이지의 모든 click(캡처 단계)을 기록한다: window.__clicks = ["next-life", "speed-2", "auto(가드)", "비버튼:MAIN", ...].
 * "(가드)"는 그 버튼이 입력 가드로 닫혀 있었다(aria-disabled=true)는 뜻이다. addInitScript라서 새로고침해도 다시 설치된다.
 * 더블탭의 둘째 입력이 어디에 떨어졌는지를 눈으로 확인하는 용도(R-035).
 */
export async function recordClicks(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const w = window as unknown as { __clicks: string[] };
    w.__clicks = [];
    document.addEventListener(
      'click',
      (e) => {
        const b = e.target instanceof Element ? e.target.closest('button') : null;
        const name = b === null ? `비버튼:${(e.target as Element).tagName}` : b.dataset.testid ?? (b.dataset.speed ? `speed-${b.dataset.speed}` : (b.textContent ?? '').trim());
        w.__clicks.push(b !== null && b.getAttribute('aria-disabled') === 'true' ? `${name}(가드)` : name);
      },
      true,
    );
  });
}

export async function recordedClicks(page: Page): Promise<string[]> {
  return page.evaluate(() => (window as unknown as { __clicks: string[] }).__clicks.slice());
}

/** React가 상태를 반영하고 저장 효과까지 돌 시간을 준다(고정 대기가 아니라 렌더 두 프레임). */
export async function settle(page: Page): Promise<void> {
  await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
}

/** 인생 화면의 컨트롤·진행 상태를 화면(DOM)에서 읽는다 */
export interface LifeSnapshot {
  speed: string | null;
  auto: string | null;
  age: string;
  hasChoice: boolean;
}

export async function lifeSnapshot(page: Page): Promise<LifeSnapshot> {
  return page.evaluate(() => ({
    speed: document.querySelector('[data-speed][aria-pressed="true"]')?.getAttribute('data-speed') ?? null,
    auto: document.querySelector('[data-testid="auto"]')?.getAttribute('aria-pressed') ?? null,
    // 헤더의 나이 알약 「31세」(M4 대시보드: <b>31</b>세) — 예전에는 <strong>31세</strong>였다
    age: document.querySelector('[data-testid="life-age"]')?.textContent?.trim() ?? '',
    hasChoice: document.querySelector('[data-testid="choice-panel"]') !== null,
  }));
}

/**
 * 이 페이지의 앱을 "가려진 탭"처럼 멈춰 둔 채로 시작한다(visibilityState를 'hidden'으로 속임). 앱은 가려진 동안 진행·자동 선택 타이머를 걸지 않으므로
 * 테스트가 시간 경쟁 없이 화면을 준비할 수 있다. addInitScript라서 이동·새로고침 때마다 다시 설치된다. setPageVisible(page, true)로 다시 흐르게 한다.
 */
export async function startPageHidden(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const w = window as unknown as { __vis: string };
    w.__vis = 'hidden';
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => w.__vis });
  });
}

export async function setPageVisible(page: Page, visible: boolean): Promise<void> {
  await page.evaluate((v) => {
    (window as unknown as { __vis: string }).__vis = v ? 'visible' : 'hidden';
    document.dispatchEvent(new Event('visibilitychange'));
  }, visible);
}

/** 포커스된 요소의 data-testid(속도 버튼은 speed-N, 없으면 태그 이름) */
export async function activeTestId(page: Page): Promise<string> {
  return page.evaluate(() => {
    const a = document.activeElement;
    if (a === null) return 'none';
    return a.getAttribute('data-testid') ?? (a.getAttribute('data-speed') ? `speed-${a.getAttribute('data-speed')}` : a.tagName);
  });
}

export async function readSettings(page: Page): Promise<Settings> {
  const raw = await page.evaluate((k) => localStorage.getItem(k), SETTINGS_KEY);
  expect(raw, '설정 저장이 있어야 한다').not.toBeNull();
  return (JSON.parse(raw!) as { data: Settings }).data;
}

/**
 * 개발 서버의 실제 core 모듈을 브라우저에서 불러 순수 함수를 실행한다(기대값 계산용 "오라클").
 * body는 async 함수 본문이다: core(모듈)와 arg(JSON 직렬화 가능한 인자)를 쓰고 return 한다.
 */
export async function evalCore<T>(page: Page, body: string, arg: unknown = null): Promise<T> {
  return page.evaluate<T>(`(async () => {
    const core = await import('/src/core/index.ts');
    const arg = ${JSON.stringify(arg)};
    ${body}
  })()`);
}

/**
 * 앞으로 N해가 모두 「조용한 해」(사건도 선택지도 마일스톤도 없는 해 — tick.kind가 'quiet')인 인생 상태를 찾는다. 연출 시간이 일정해(HOLD_MS.quiet) 시간 측정이 흔들리지 않고 선택지가 끼지 않는다.
 * M7a 이전에는 0세에서 시작해도 첫 N해가 조용한 시드가 있었다. 지금은 0세에 첫 예방접종(마일스톤)이 늘 일어나고 영유아 빈도가 높아 영유아기에는 그런 시드가 없다 —
 * 그래서 영유아·학창기를 자동 성향으로 지나 20세 이후(중년은 사건이 드물다) 앞으로 N해가 조용한 첫 상태를 찾는다. 앱 페이지가 열려 있어야 한다.
 */
export async function quietStart(page: Page, years: number, era: Era = 'present'): Promise<GameState> {
  const s = await evalCore<GameState | null>(
    page,
    `for (let seed = 1; seed < 8000; seed++) {
       let s = core.enterLife(core.enterBirth(core.beginBirth(core.createInitialState(seed), arg.era)));
       for (let guard = 0; guard < 400 && s.phase === 'life'; guard++) {
         if (s.pending !== null) { s = core.autoResolveStep(s, s.pending.key).state; continue; }
         if (s.age >= 20) {
           let t = s;
           let ok = true;
           for (let i = 0; i < arg.years; i++) { const r = core.stepYear(t); if (r.tick.kind !== 'quiet') { ok = false; break; } t = r.state; }
           if (ok) return s;
         }
         s = core.stepYear(s).state;
       }
     }
     return null;`,
    { years, era },
  );
  expect(s, `앞으로 ${years}해가 모두 조용한 해인 상태를 찾지 못했다`).not.toBeNull();
  return s!;
}

/** 시드·시대로 만든 "인생 0세" 상태 (core 순수 함수로 계산) */
export async function oracleLife(page: Page, seed: number, era: Era): Promise<GameState> {
  return evalCore<GameState>(
    page,
    'return core.enterLife(core.enterBirth(core.beginBirth(core.createInitialState(arg.seed), arg.era)));',
    { seed, era },
  );
}

/** 다음 결정(선택지 또는 사망)까지 진행한 상태 */
export async function oracleDecision(page: Page, state: GameState): Promise<GameState> {
  return evalCore<GameState>(page, 'return core.advanceUntilDecision(arg).state;', state);
}

/** 끝(사망)까지 자동 모드로 진행한 상태 */
export async function oracleAuto(page: Page, state: GameState): Promise<GameState> {
  return evalCore<GameState>(page, 'return core.playToEnd(arg, null).state;', state);
}

/**
 * 첫 결정(선택지)이 있는 시드를 찾아 그 상태(대기 중인 선택지 포함)를 돌려준다.
 * minChoices: 보이는 선택지가 최소 이만큼인 것(3개짜리 레이아웃 검사용). 앱 페이지가 열려 있어야 한다(같은 origin).
 */
export async function findPendingState(page: Page, era: Era, opts: { minChoices?: number; fromSeed?: number } = {}): Promise<GameState> {
  const found = await evalCore<GameState | null>(
    page,
    `for (let seed = arg.from; seed < arg.from + 400; seed++) {
       const start = core.enterLife(core.enterBirth(core.beginBirth(core.createInitialState(seed), arg.era)));
       const s = core.advanceUntilDecision(start).state;
       if (s.phase === 'life' && s.pending && s.pending.choiceIds.length >= arg.min) return s;
     }
     return null;`,
    { era, from: opts.fromSeed ?? 1000, min: opts.minChoices ?? 2 },
  );
  expect(found, `${era}: 선택지가 있는 시드를 찾지 못했다`).not.toBeNull();
  return found!;
}

/** 저장의 history에서 특정 종류의 항목 수 */
export function countKind(save: Save, kind: string): number {
  return save.data.history.filter((h) => h.kind === kind).length;
}

/** Tab을 count번 눌러, 누를 때마다 포커스가 닿은 요소(activeTestId)를 순서대로 돌려준다 */
export async function tabWalk(page: Page, count: number): Promise<string[]> {
  const stops: string[] = [];
  for (let i = 0; i < count; i++) {
    await page.keyboard.press('Tab');
    stops.push(await activeTestId(page));
  }
  return stops;
}

/**
 * 인생 화면 컨트롤 그룹 안에서 Tab으로 포커스를 받을 수 있는 요소를 DOM 순서대로(속도 버튼은 speed-N). disabled 버튼과 tabindex<0 요소는 빠진다 —
 * 선택지가 뜨든 사라지든 이 목록이 같아야 한다(R-036).
 */
export async function controlFocusables(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const root = document.querySelector('[data-testid="controls"]');
    if (root === null) return [];
    return [...root.querySelectorAll<HTMLElement>('button, a[href], input, select, textarea, [tabindex]')]
      .filter((el) => !(el as HTMLButtonElement).disabled && el.tabIndex >= 0)
      .map((el) => el.getAttribute('data-testid') ?? (el.getAttribute('data-speed') ? `speed-${el.getAttribute('data-speed')}` : el.tagName));
  });
}

/** 진행 줄 그룹의 Tab 순서(DOM 순서)가 이래야 한다: 일시정지 → 속도 4개 → 다음 결정으로 → 자동 모드. 선택지·자동 모드·일시정지와 무관하다. (M4: 일시정지가 맨 앞에 더해졌다) */
export const CONTROL_TAB_ORDER = ['pause', 'speed-1', 'speed-2', 'speed-4', 'speed-8', 'skip', 'auto'] as const;
