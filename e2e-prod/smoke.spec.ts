import { expect, test, type Page } from '@playwright/test';
import { HOLD_MS } from '../src/data/timingTable';
import { readThemeBlocks, themeTokens } from '../scripts/checkContrastLib';
import { BASIS_B_SPLIT, SLIDE_FORMS, UNIT_WORD, VALUE_LINE, forbiddenIn } from '../e2e/carouselForms';
import { slideCount } from '../e2e/carouselHelpers';
import { collectSlideDom, type SlideDom } from '../e2e/slideText';
import { measureTextResize, setRootFontPercent, textResizeViolations } from '../e2e/textResize';

/**
 * 프로덕션 번들 스모크 (R-043). `npm run e2e:prod`가 빌드한 dist를 vite preview로 띄운 서버에서 돈다.
 * 개발 서버 e2e가 못 보는 것: 번들이 실제로 실행되는가(이벤트 데이터 검증 포함), 개발 전용 탐침이 제품에서 꺼져 있는가.
 */

const GAME_KEY = 'suzeo-game:save';
/** 개발 전용 탐침 쿼리 이름. 제품 번들에는 문자열째 없어야 한다. */
const PROBES = ['__timescale', '__guard', '__crash', '__quota', '__exit'] as const;
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
  await expect(page.getByTestId('birth-screen')).toBeVisible();
  await page.getByTestId('next-life').click();
  await expect(page.getByTestId('life-screen')).toBeVisible();
}

test('프로덕션 번들: 첫 화면 → 태어나기 → 출생 → 인생 화면까지 오류 없이 간다 (이벤트 데이터 검증 통과 후의 번들이 실제로 뜬다)', async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto('/');
  await expect(page).toHaveTitle('수저 게임');
  await expect(page.getByTestId('title-screen')).toBeVisible();
  await toLifeScreen(page);
  await expect(page.getByTestId('life-age')).toContainText('0세');
  for (const label of ['1배', '2배', '4배', '8배']) await expect(page.getByRole('button', { name: label, exact: true })).toBeVisible();
  await expect(page.getByTestId('auto')).toBeVisible();
  await expect(page.getByTestId('error-screen')).toHaveCount(0);
  // 인생 화면으로 넘어가면 저장이 남는다
  const saved = await page.evaluate((k) => JSON.parse(localStorage.getItem(k) ?? 'null'), GAME_KEY);
  expect(saved?.data?.phase).toBe('life');
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
  // 선택지가 떠 있으면 첫 선택지를 고르고, 없으면 "다음 결정으로"를 누른다. 연출 타이머가 끼어들어 상태가 바뀌면(드물다) 다시 판단한다.
  for (let step = 0; step < 400 && !(await ending.isVisible()); step++) {
    try {
      if (await panel.isVisible()) {
        await panel.getByRole('button').first().click({ timeout: 5_000 }); // 선택지 가드가 풀릴 때까지 기다린다
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

  // 저장: 엔딩 단계, 사망 정보가 있고, 고른 선택이 연표에 남아 있다
  const saved = await page.evaluate((k) => JSON.parse(localStorage.getItem(k) ?? 'null'), GAME_KEY);
  expect(saved?.data?.phase).toBe('ending');
  expect(saved?.data?.death, '사망 정보가 저장돼 있다').toBeTruthy();
  const history = saved.data.history as Array<{ kind: string; age: number }>;
  expect(history.filter((h) => h.kind === 'choice').length, '연표의 선택 기록 수').toBe(choices);
  expect(history.some((h) => h.kind === 'death')).toBe(true);
  // 새로고침해도 엔딩에 머무른다
  await page.reload();
  await expect(page.getByTestId('ending-screen')).toBeVisible();
  await expect(page.getByTestId('error-screen')).toHaveCount(0);

  // 엔딩 회고(제품 번들): 사망 한 줄·출발선 대비(같은 세상 안의 자리)·최종 스탯·연표(선택한 순간이 빠짐없이)
  await expect(page.getByTestId('ending-death')).toContainText(`${saved.data.death.age}세에 세상을 떠났다`);
  await expect(page.getByTestId('ending-journey')).toContainText('의 집에서 태어');
  await expect(page.getByTestId('ending-movement')).toBeVisible();
  for (const key of ['wealth', 'education', 'health', 'happiness', 'relationships', 'looks']) await expect(page.getByTestId(`final-${key}`)).toBeVisible();
  await expect(page.getByTestId('timeline-entry')).toHaveCount(history.length);
  await expect(page.getByTestId('timeline-picked')).toHaveCount(choices);
  const endingText = (await page.getByTestId('ending-screen').innerText()).replace(/\s+/g, ' ');
  expect(endingText).not.toMatch(/(흙|동|은|금|다이아)\s*수저|다이아|!/);

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
  // 새 판도 끝까지 시작할 수 있다: 태어나기를 누르면 새 인물의 출생 화면
  await page.getByTestId('start-birth').click();
  await expect(page.getByTestId('birth-screen')).toBeVisible();
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
  // __timescale=1000: 1배속의 첫 한 해(0세는 이벤트가 없는 조용한 해, HOLD_MS.quiet)가 실제로 그만큼 걸린다. 탐침이 먹혔다면 수 ms 만에 나이가 오르거나 선택지가 뜬다.
  const shownAt = Date.now();
  await expect
    .poll(() => page.evaluate(() => !document.querySelector('[data-testid="life-age"]')?.textContent?.includes('0세') || document.querySelector('[data-testid="choice-panel"]') !== null), {
      timeout: 15_000,
    })
    .toBe(true);
  const firstYearMs = Date.now() - shownAt;
  expect(firstYearMs, `첫 한 해가 ${firstYearMs}ms 만에 지났다 — 1배속의 조용한 한 해는 약 ${HOLD_MS.quiet}ms여야 한다 (?__timescale 무시)`).toBeGreaterThanOrEqual(HOLD_MS.quiet * 0.75);

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
 * (폭 320px · 글자 200%)의 14장을 본다: ① 번들 CSS가 짧은 쌍의 컨테이너 쿼리·슬라이드 칸 컨테이너·`cqw` 값 크기를 유지한다 ② 14장 금지 패턴 0·값 줄 모양·기준 줄 모양
 * ③ 혼인 건수 슬라이드의 「조혼인율 인구 1천 명당 N.N건」 줄 ④ B형 기준 줄(조사망률·자살률)은 두 줄로 나뉘고 가운뎃점이 감춰진다 ⑤ 가로 넘침·글자 잘림 0.
 */
test('제품 번들 캐러셀(폭 320px·글자 200%): 최소화된 CSS가 컨테이너 쿼리를 유지하고, 화면 글자가 14장 금지 패턴 0·조혼인율 줄·B형 기준 줄 두 줄(기호 숨김)·넘침 0이다 (R-243, 모델 없이 DOM만)', async ({ page, request }) => {
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

  // ② 화면: 폭 320px · 글자 200%, 14장을 모두 넘기며 눈에 보이는 글자를 모은다
  await page.setViewportSize({ width: 320, height: 740 });
  await page.goto('/');
  await expect(page.getByTestId('start-birth')).toBeEnabled();
  await page.getByTestId('carousel-pause').click();
  await setRootFontPercent(page, 200);
  const n = await slideCount(page);
  expect(n).toBe(14);
  const doms: SlideDom[] = [];
  const problems: string[] = [];
  for (let i = 0; i < n; i++) {
    const dom = await collectSlideDom(page);
    doms.push(dom);
    const bad = (msg: string) => problems.push(`${dom.id}: ${msg}`);
    // 금지 패턴 (명당 명 · 같은 단위 연속) — 구성 요소마다 + 전체
    for (const [where, text] of [
      ['제목', dom.title],
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
    // 기준 줄 모양 (형식표 A·B·C·D): 모델 없이 DOM의 글자만으로
    const form = SLIDE_FORMS[dom.id];
    if (form === undefined) bad('형식표(SLIDE_FORMS)에 없는 슬라이드다');
    else if (form === 'A' || form === 'C') {
      if (!/^\d{4}년 기준$/.test(dom.basisLines.join('\n'))) bad(`형식 ${form} 기준 줄이 「{연도}년 기준」이 아니다: 「${dom.basisLines.join(' / ')}」`);
    } else if (form === 'B') {
      // 글자 200%·폭 320: 쌍이 두 줄로 나뉘고 가운뎃점이 눈에 보이지 않는다
      if (dom.basisLines.length !== 2 || !BASIS_B_SPLIT.every((re, k) => re.test(dom.basisLines[k]))) bad(`형식 B 기준 줄이 두 줄(「인구 N 명당」/「{연도}년 기준」)이 아니다: 「${dom.basisLines.join(' / ')}」`);
      if (dom.pairSepVisible !== false) bad('형식 B 기준 줄이 두 줄인데 「·」가 눈에 보인다(또는 쌍이 아니다)');
    } else if (!/^\d{4}년( \d{1,2}월)? 기준\(\d+개 시·도/.test(dom.basisLines.join(' '))) bad(`형식 D 기준 줄 모양: 「${dom.basisLines.join(' ')}」`);
    // 「통계 기준」 줄: 쌍이 나뉘어도 글자는 「통계 기준: {연도}년 · 마지막 갱신 {날짜}」다(두 줄이면 사이의 기호가 감춰진다)
    if (!/^통계 기준: \d{4}년\s+마지막 갱신 \d{4}-\d{2}-\d{2}$/.test(dom.statLines.join(' '))) bad(`「통계 기준」 줄 모양: 「${dom.statLines.join(' / ')}」`);
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
  // ④ B형 두 장(조사망률·자살률)이 실제로 있었고 둘 다 두 줄 + 기호 숨김
  const basisB = doms.filter((d) => SLIDE_FORMS[d.id] === 'B');
  expect(basisB.map((d) => d.id).sort()).toEqual(['cdr', 'suicide-rate']);
  for (const d of basisB) {
    expect(d.basisLines, `${d.id} 기준 줄`).toHaveLength(2);
    expect(d.pairSepVisible, `${d.id}: 「·」가 감춰졌다`).toBe(false);
  }
  // 공허 통과 방지: 모은 글자·그래프 글자·값 줄이 실제로 있다
  expect(doms.reduce((sum, d) => sum + d.all.length, 0), '모은 화면 글자 수').toBeGreaterThan(2500);
  expect(doms.filter((d) => d.chartTexts.length > 0), '그래프 글자가 모인 슬라이드').toHaveLength(14);
  expect(doms.filter((d) => d.valueLines.length > 0).length, '값 줄이 있는 슬라이드').toBeGreaterThanOrEqual(12);
});
