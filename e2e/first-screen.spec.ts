import { expect, test, type Page } from '@playwright/test';
import {
  KNOWN_SEED,
  RAPID_METHODS,
  activeTestId,
  chooseEra,
  chooseLifeLength,
  evalCore,
  expectedBirth,
  injectSave,
  lifeState,
  birthState,
  noHorizontalOverflow,
  pressBegin,
  rapidInput,
  readSave,
  readSettings,
  replaceSaveAndReload,
  titleState,
} from './helpers';
import { SETTINGS_KEY } from './saves';
import { readThemeBlocks, themeTokens, type Theme } from '../scripts/checkContrastLib';

/**
 * 첫 화면 (SPEC-003 M2: FS1~FS8, VP1~VP2, SC1~SC7). 시안(docs/design/mockups/title-a.html·title-continue.html)과 같은 구조를 실제 브라우저에서 확인한다.
 * 가상 인구 계산·캐러셀 데이터·문구는 단위 테스트(tests/population.test.ts·carousel.test.ts·titleScreen.test.tsx)가 보고, 여기서는
 * 실제 폭·스크롤·타이머·키보드·다크·강제 색상·외부 요청을 본다. 모든 테스트는 mobile-360(360×740)과 desktop(1280×800) 두 뷰포트에서 돈다.
 */

const SHOTS = 'qa/screenshots/003';

/**
 * 디자인 토큰(src/styles/tokens.css, designer 소유)의 값 — 테마별. 색을 이 테스트에 적어 두지 않고 토큰 파일에서 읽어, designer가 토큰 값을 바꿔도(변수 이름은 유지) 테스트가 따라간다.
 * 값은 `rgb(r, g, b)` 모양으로 돌려준다(브라우저 computed style과 같은 모양).
 */
async function tokenColors(page: Page, theme: Theme): Promise<(name: string) => string> {
  const css = await page.evaluate(async () => ((await import('/src/styles/tokens.css?raw')) as { default: string }).default);
  const map = themeTokens(readThemeBlocks(css), theme);
  return (name) => {
    const hex = map[name];
    if (hex === undefined || !hex.startsWith('#')) throw new Error(`토큰 ${name}이 색(#rrggbb)이 아니다: ${hex}`);
    const h = hex.length === 4 ? `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}` : hex;
    return `rgb(${parseInt(h.slice(1, 3), 16)}, ${parseInt(h.slice(3, 5), 16)}, ${parseInt(h.slice(5, 7), 16)})`;
  };
}
/** 같은 토큰을 #rrggbb(소문자)로 — <meta name="theme-color"> 같은 속성 값과 대조할 때 */
async function tokenHex(page: Page, theme: Theme, name: string): Promise<string> {
  const css = await page.evaluate(async () => ((await import('/src/styles/tokens.css?raw')) as { default: string }).default);
  const hex = themeTokens(readThemeBlocks(css), theme)[name];
  if (hex === undefined || !hex.startsWith('#')) throw new Error(`토큰 ${name}이 색(#rrggbb)이 아니다: ${hex}`);
  return (hex.length === 4 ? `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}` : hex).toLowerCase();
}
const projectKey = (name: string): 'mobile' | 'desktop' => (name === 'mobile-360' ? 'mobile' : 'desktop');

/** 증거 스크린샷용: 하단 고정 띠가 카드를 덮지 않게 숨긴다(R-225). 띠 자체를 찍는 스크린샷에는 쓰지 않는다. */
async function hideBottomBar(page: Page): Promise<void> {
  await page.addStyleTag({ content: '[data-testid="bottom-bar"] { visibility: hidden !important; }' });
}

/** 첫 화면 캐러셀의 현재 순서 「3 / 14」 */
const countText = (page: Page) => page.getByTestId('carousel-count').innerText();
const slideCount = async (page: Page): Promise<number> => page.getByTestId('stat-slide').count();
const activeSlideId = (page: Page) => page.evaluate(() => document.querySelector('.slide.is-active')?.getAttribute('data-slide-id') ?? '');

/** 「다음 지표」를 눌러 index번째(0부터) 슬라이드로 간다. 지표가 6개 이상이면 점이 없어서(R-133) 버튼으로만 넘길 수 있다. */
async function goToSlide(page: Page, index: number): Promise<void> {
  const n = await slideCount(page);
  for (let guard = 0; guard < n + 1; guard++) {
    if ((await countText(page)) === `${index + 1} / ${n}`) return;
    await page.getByTestId('carousel-next').click();
  }
  throw new Error(`${index + 1}번째 슬라이드로 갈 수 없다`);
}

/** 가짜 시계를 ms만큼 흘린다. 1초씩 나눠 흘리고 그때마다 React가 다음 타이머를 다시 걸 시간을 준다(한 번에 길게 흘리면 다시 걸리기 전에 지나간다). */
async function tick(page: Page, ms: number): Promise<void> {
  for (let left = ms; left > 0; left -= 1000) {
    await page.clock.runFor(Math.min(1000, left));
    await page.waitForTimeout(40);
  }
}

/** 캐러셀 밖의 빈 곳을 눌러 포인터·포커스를 캐러셀에서 뺀다(포인터가 나간 것을 앱이 알 때까지는 시계를 흘리지 않는다). */
async function leaveCarousel(page: Page, expectAutoplay: 'on' | 'off' = 'on'): Promise<void> {
  await page.mouse.click(2, 2);
  await expect(page.getByTestId('carousel')).toHaveAttribute('data-autoplay', expectAutoplay);
}

/** 가짜 시계를 깔고(타이머를 직접 흘린다) 첫 화면을 연 뒤 흐름을 멈춘다. 실제 시간이 흘러 7초 타이머가 먼저 울리지 않게 열자마자 멈춘다. */
async function openWithClock(page: Page, url = '/'): Promise<void> {
  await page.clock.install({ time: new Date('2026-10-16T03:10:00Z') });
  await page.goto(url);
  await expect(page.getByTestId('carousel')).toBeVisible();
  const now = await page.evaluate(() => Date.now());
  await page.clock.pauseAt(new Date(now + 300));
}

// ---------- FS1·DS1: 구성과 로고 ----------

test('첫 화면 구성(FS1): 로고 → 한 줄 설명 → 수저 다섯 자루 → 가상 인구 문구 → 태어날 세상 → 인생 길이 → 캐러셀 → 푸터, 하단 고정 「태어나기」', async ({ page }) => {
  await page.goto('/');
  const ids = ['title-heading', 'spoon-lineup', 'population-line', 'population-note', 'era-group', 'life-length-group', 'carousel', 'title-foot', 'bottom-bar'];
  const tops = await page.evaluate((list) => list.map((id) => document.querySelector(`[data-testid="${id}"]`)!.getBoundingClientRect().top + window.scrollY), ids);
  const vw = page.viewportSize()!.width;
  // 좁은 화면은 세로로 쌓이고, 폭 ≥ 960에서는 캐러셀이 오른쪽 열이라 위에서 시작한다(선택 영역과 나란히)
  const order = vw >= 960 ? ids.filter((id) => id !== 'carousel' && id !== 'bottom-bar') : ids.filter((id) => id !== 'bottom-bar');
  for (let i = 1; i < order.length; i++) {
    const a = tops[ids.indexOf(order[i - 1])];
    const b = tops[ids.indexOf(order[i])];
    expect(b, `${order[i - 1]} → ${order[i]}`).toBeGreaterThan(a);
  }
  if (vw >= 960) {
    const side = await page.evaluate(() => {
      const c = document.querySelector('[data-testid="carousel"]')!.getBoundingClientRect();
      const era = document.querySelector('[data-testid="era-group"]')!.getBoundingClientRect();
      return { carouselLeft: c.left, eraRight: era.right, carouselTop: c.top, vh: innerHeight };
    });
    expect(side.carouselLeft, '캐러셀이 선택 영역 오른쪽 열에 있다 (FS3)').toBeGreaterThan(side.eraRight);
    expect(side.carouselTop, '캐러셀이 첫 화면 높이 안에서 시작한다').toBeLessThan(side.vh / 2);
  }
  await expect(page.getByTestId('start-birth')).toHaveText('태어나기');
  expect(await noHorizontalOverflow(page)).toBe(true);
});

test('로고(DS1): 게임명 워드마크 글자 높이 ≥ 40px — 좁은 화면은 세로 로고, 넓은 화면은 가로 로고, 제목(h1)의 읽히는 글자는 「수저 게임」', async ({ page }) => {
  await page.goto('/');
  const vw = page.viewportSize()!.width;
  const visibleId = vw >= 960 ? 'title-logo-row' : 'title-logo-stacked';
  const hiddenId = vw >= 960 ? 'title-logo-stacked' : 'title-logo-row';
  await expect(page.getByTestId(visibleId)).toBeVisible();
  await expect(page.getByTestId(hiddenId)).toBeHidden();
  const m = await page.evaluate((id) => {
    const svg = document.querySelector(`[data-testid="${id}"] svg`) as SVGSVGElement;
    const wordmark = svg.querySelector(':scope > g') as SVGGraphicsElement; // 워드마크(글자 도형 묶음)
    return { logo: svg.getBoundingClientRect().height, word: wordmark.getBoundingClientRect().height, width: svg.getBoundingClientRect().width, vw: innerWidth };
  }, visibleId);
  expect(m.word, `워드마크 글자 높이 ${m.word}px`).toBeGreaterThanOrEqual(40);
  expect(m.width).toBeLessThanOrEqual(m.vw);
  // 다른 심볼·로고보다 큰 글자: 로고가 화면에서 가장 큰 글자다(원문 「게임명 크게」)
  const biggest = await page.evaluate(() => Math.max(...[...document.querySelectorAll<HTMLElement>('.title-page p, .title-page h2, .title-page h3, .title-page legend, .title-page span, .title-page strong')].map((e) => parseFloat(getComputedStyle(e).fontSize))));
  expect(m.word, '로고가 본문 글자보다 훨씬 크다').toBeGreaterThan(biggest);
  await expect(page.getByRole('heading', { level: 1 })).toHaveAccessibleName('수저 게임');
  expect(await page.evaluate(() => document.activeElement?.tagName)).toBe('H1'); // 화면이 뜨면 제목으로 포커스(R-030)
});

test('수저 다섯 단계 띠: 이름이 글자로 보이고 모두 한 줄 안에 들어간다', async ({ page }) => {
  await page.goto('/');
  const names = await page.locator('[data-testid="spoon-lineup"] li').allInnerTexts();
  expect(names.map((n) => n.replace(/\s+/g, ''))).toEqual(['흙수저', '동수저', '은수저', '금수저', '다이아몬드수저']);
  const fits = await page.evaluate(() => {
    const row = document.querySelector('[data-testid="spoon-lineup"]')!.getBoundingClientRect();
    return [...document.querySelectorAll('[data-testid="spoon-lineup"] li')].every((li) => {
      const r = li.getBoundingClientRect();
      return r.left >= row.left - 1 && r.right <= row.right + 1;
    });
  });
  expect(fits).toBe(true);
  // 띠는 32x52의 큰 변형(sp-N-lg)을 쓰고, 참조한 도형이 문서에 실제로 있어 그려진다(디자이너 스프라이트가 바뀌어도 id만 지키면 된다)
  const icons = await page.evaluate(() =>
    [...document.querySelectorAll('[data-testid="spoon-lineup"] svg.spoon')].map((svg) => {
      const href = svg.querySelector('use')!.getAttribute('href') ?? '';
      const r = svg.getBoundingClientRect();
      return { href, exists: document.getElementById(href.slice(1)) !== null, w: Math.round(r.width), h: Math.round(r.height), drawn: (svg.querySelector('use') as SVGGraphicsElement).getBBox().width > 0 };
    }),
  );
  expect(icons.map((i) => i.href)).toEqual(['#sp-1-lg', '#sp-2-lg', '#sp-3-lg', '#sp-4-lg', '#sp-5-lg']);
  for (const i of icons) {
    expect(i.exists, i.href).toBe(true);
    expect(i.drawn, `${i.href}가 그려진다`).toBe(true);
    expect([i.w, i.h], `${i.href} 크기(32 이상 — 큰 변형은 칩 크기로 쓰지 않는다)`).toEqual([32, 52]);
  }
});

// ---------- FS2·VP: 가상 인구 ----------

test('가상 인구(FS2·VP1): 「N명이 이 시뮬레이션 속에서 각자의 삶을 살고 있어요.」, N은 이 기기의 시각(분)으로 계산한 값이고 분이 바뀌면 조금씩 바뀐다. 보조 문구는 항상 보인다', async ({ page }) => {
  await openWithClock(page);
  const minuteNow = () => page.evaluate(() => Math.floor(Date.now() / 60000));
  const shown = async () => Number((await page.getByTestId('population-count').innerText()).replace(/,/g, ''));
  const expected = (minute: number) => evalCore<number>(page, 'return core.virtualPopulation(arg);', minute);

  const m0 = await minuteNow();
  await expect(page.getByTestId('population-line')).toHaveText(/^[\d,]+명이 이 시뮬레이션 속에서 각자의 삶을 살고 있어요\.$/);
  expect(await shown()).toBe(await expected(m0));
  expect(await shown()).toBeGreaterThanOrEqual(50_000);
  expect(await shown()).toBeLessThan(60_000);
  // 천 단위 쉼표
  await expect(page.getByTestId('population-count')).toHaveText(/^\d{2},\d{3}$/);
  // 보조 문구는 항상 보인다
  await expect(page.getByTestId('population-note')).toBeVisible();
  await expect(page.getByTestId('population-note')).toContainText('가상의 사람들');
  await expect(page.getByTestId('population-note')).toContainText('실제로 게임하는 사람 수가 아니에요');

  // 시계를 흘리면 분이 바뀔 때 값이 다시 계산된다 (30분 동안 여러 번 바뀐다)
  const seen = new Set<number>([await shown()]);
  for (let i = 1; i <= 30; i++) {
    await page.clock.runFor(60_000); // 분 타이머는 스스로 다시 걸리므로 한 번에 흘려도 된다
    await page.waitForTimeout(60);
    const m = await minuteNow();
    await expect.poll(shown, { message: `${i}분 뒤 값` }).toBe(await expected(m));
    seen.add(await shown());
  }
  expect(seen.size, '분이 흐르면 값이 조금씩 바뀐다').toBeGreaterThan(5);
  const values = [...seen];
  expect(Math.max(...values) - Math.min(...values), '하루도 안 되는 30분 동안 변화폭은 작다').toBeLessThan(30);
});

test('정직한 표기(VP2): 화면 어디에도 「접속자」「동시 접속」이 없고, 가상 인구 설명이 한 곳 있으며, 서버·집계 요청이 없다', async ({ page }) => {
  const requests: string[] = [];
  page.on('request', (r) => requests.push(`${r.method()} ${r.url()}`));
  await page.goto('/');
  await expect(page.getByTestId('population-info')).toContainText('가상 인구');
  const text = await page.locator('body').innerText();
  expect(text).not.toMatch(/접속자|동시\s*접속|접속\s*중|접속한/);
  expect(await page.locator('html').innerHTML()).not.toMatch(/접속자|동시\s*접속/);
  // 데이터를 보내는 요청(POST·beacon)이 없다
  expect(requests.filter((r) => !r.startsWith('GET ')), requests.join('\n')).toEqual([]);
});

// ---------- FS4·FS5: 태어날 세상·인생 길이 ----------

test('태어날 세상(FS4): 라디오 카드 3개, 기본 지금 세상, 연도 안내는 ERA_CONFIG 범위(R-201), 고르면 설정에 저장되고 새로고침해도 유지된다', async ({ page }) => {
  await page.goto('/');
  const group = page.getByRole('radiogroup', { name: '태어날 세상' });
  await expect(group).toBeVisible();
  await expect(group.getByRole('radio')).toHaveCount(3);
  await expect(page.getByTestId('era-present')).toBeChecked();
  // 카드의 연도 안내는 출생 로직의 연도 범위(ERA_CONFIG.birthYears)에서 만든다(R-201): 지금 세상은 출생 연도가 2026 한 해일 때만 「올해(2026) 태어나는 아이」, 그 전에는 실제 범위.
  // 기대값은 앱의 문구 함수가 아니라 ERA_CONFIG 원자료에서 이 테스트가 따로 계산한다(앱 함수끼리 비교하면 같은 틀린 값이 통과한다).
  const years = await eraBirthYears(page);
  for (const era of ['past', 'present', 'future'] as const) {
    const { min, max } = years[era];
    const expected = era === 'present' && min === 2026 && max === 2026 ? '올해(2026) 태어나는 아이' : min === max ? `${min}년생` : `${min}~${max}년생`;
    await expect(eraMeta(page, era), era).toHaveText(expected);
  }
  await expect(group).toContainText(`${years.past.min}~${years.past.max}년생`);
  await expect(group).toContainText(`${years.future.min}~${years.future.max}년생`);
  // 선택 상태는 색에만 의존하지 않는다: 체크 아이콘이 눌린 카드에만 보이고 「선택됨」 글자가 스크린리더에 읽힌다
  const marks = await page.evaluate(() =>
    [...document.querySelectorAll('[data-testid="era-group"] .radio-card')].map((c) => ({
      selected: c.classList.contains('is-selected'),
      iconOpacity: getComputedStyle(c.querySelector('.radio-card__mark .icon')!).opacity,
      srText: c.querySelector('.sr-only')?.textContent ?? '',
      borderWidth: getComputedStyle(c).borderTopWidth,
    })),
  );
  expect(marks.filter((m) => m.selected).length).toBe(1);
  for (const m of marks) {
    expect(m.iconOpacity).toBe(m.selected ? '1' : '0');
    expect(m.srText).toBe(m.selected ? '선택됨' : '');
    expect(parseFloat(m.borderWidth)).toBe(m.selected ? 3 : 1);
  }
  await expect(page.getByTestId('start-birth')).toBeEnabled(); // 진입 가드가 풀린 뒤
  await page.getByTestId('era-group').locator('label', { hasText: '지난 세상' }).click();
  await expect(page.getByTestId('era-past')).toBeChecked();
  await expect.poll(async () => (await readSettings(page)).era).toBe('past');
  await page.reload();
  await expect(page.getByTestId('era-past')).toBeChecked();
  await expect(page.getByTestId('era-present')).not.toBeChecked();
  // 게임 저장(진행)에는 세상이 들어가지 않는다 — 태어날 때 정해진다
  const save = (await readSave(page)).data;
  expect(save.phase).toBe('title');
  expect(save.era).toBeNull();
});

/** ERA_CONFIG(출생 로직의 연도 범위)를 개발 서버의 실제 모듈에서 읽는다 */
const eraBirthYears = (page: Page) =>
  page.evaluate<Record<'past' | 'present' | 'future', { min: number; max: number }>>(`(async () => {
    const { ERA_CONFIG } = await import('/src/data/birthTable.ts');
    return Object.fromEntries(Object.entries(ERA_CONFIG).map(([era, c]) => [era, c.birthYears]));
  })()`);
const eraMeta = (page: Page, era: string) => page.getByTestId(`era-${era}`).locator('xpath=ancestor::label').locator('.radio-card__meta');

test('화면 사이 거짓 안내 없음(R-201): 세상 카드에서 읽은 출생 연도 안내와 출생 화면의 실제 출생 연도가 어긋나지 않는다 — 세 세상 모두', async ({ page }) => {
  for (const [i, era] of (['past', 'present', 'future'] as const).entries()) {
    await injectSave(page, titleState(KNOWN_SEED + i), '/', { speed: 1, autoMode: false, era });
    const range = await eraBirthYears(page);
    const text = await eraMeta(page, era).innerText();
    await pressBegin(page);
    await expect(page.getByTestId('birth-screen')).toBeVisible();
    const year = Number(/^(\d{4})년/.exec(await page.getByTestId('birth-year').innerText())![1]);
    const { min, max } = range[era];
    expect(year, `${era}: 출생 연도 ${year}가 ERA_CONFIG 범위 ${min}~${max} 안`).toBeGreaterThanOrEqual(min);
    expect(year).toBeLessThanOrEqual(max);
    if (text.includes('올해(2026)')) {
      expect(year, `${era}: 카드가 「올해(2026)」라고 했으면 출생 연도는 2026`).toBe(2026);
    } else {
      const m = /^(\d{4})(?:~(\d{4}))?년생$/.exec(text)!;
      expect(m, `카드 문구 모양: ${text}`).not.toBeNull();
      expect(year, `${era}: 카드 ${text} ⇔ 출생 ${year}년`).toBeGreaterThanOrEqual(Number(m[1]));
      expect(year).toBeLessThanOrEqual(Number(m[2] ?? m[1]));
    }
  }
});

test('인생 길이(FS5, R-202): 「약 30분」 기본·선택, 「약 1시간」 카드는 보이되 선택할 수 없고 「준비 중」이 적혀 있다(라디오 그룹 접근성 유지) — 눌러도 아무 일도 없다', async ({ page }) => {
  await page.goto('/');
  const group = page.getByRole('radiogroup', { name: '인생 길이' });
  await expect(group.getByRole('radio')).toHaveCount(2); // 카드를 숨기지 않는다
  await expect(page.getByTestId('life-short30')).toBeChecked();
  await expect(page.getByTestId('life-short30')).toBeEnabled();
  await expect(group).toContainText('약 30분');
  await expect(group).toContainText('약 1시간');
  await expect(page.getByTestId('life-length-hint')).toHaveText('평균 수명까지 살아 보는 데 걸리는 시간이에요. 도중에 나가도 진행은 이 기기에 남습니다.');
  // 비활성 + 이유: 접근 가능한 이름에 「준비 중」이 들어 있어 스크린리더도 이유를 듣는다
  const long = page.getByRole('radio', { name: /약 1시간/ });
  await expect(long).toBeDisabled();
  await expect(long).not.toBeChecked();
  await expect(long).toHaveAccessibleName(/약 1시간.*준비 중.*결정을 더 많이/);
  await expect(page.getByTestId('life-long60').locator('xpath=ancestor::label').locator('.radio-card__meta')).toHaveText('준비 중');
  await expect(page.getByTestId('life-short30').locator('xpath=ancestor::label').locator('.radio-card__meta')).toHaveCount(0);
  // 색에만 의존하지 않는다: 비활성 카드는 점선 테두리이고 커서도 금지 표시
  const look = await page.evaluate(() => {
    const card = document.querySelector('[data-testid="life-long60"]')!.closest('label')!;
    const ok = document.querySelector('[data-testid="life-short30"]')!.closest('label')!;
    return { disabled: getComputedStyle(card).borderTopStyle, enabled: getComputedStyle(ok).borderTopStyle, cursor: getComputedStyle(card).cursor };
  });
  expect(look.disabled).toBe('dashed');
  expect(look.enabled).not.toBe('dashed');
  expect(look.cursor).toBe('not-allowed');
  // 눌러도(마우스·강제 클릭) 선택도 저장도 바뀌지 않는다
  await expect(page.getByTestId('start-birth')).toBeEnabled();
  // 하단 고정 띠가 낮은 카드를 덮을 수 있어(강제 클릭은 좌표로 누른다) 카드를 화면 가운데로 올린 뒤 누른다
  await page.getByTestId('life-long60').evaluate((el) => el.scrollIntoView({ block: 'center' }));
  await group.locator('label', { hasText: '약 1시간' }).click({ force: true });
  await page.getByTestId('life-long60').click({ force: true }).catch(() => undefined); // 비활성 입력은 눌러도 이벤트가 없다
  await expect(page.getByTestId('life-short30')).toBeChecked();
  await expect(page.getByTestId('life-long60')).not.toBeChecked();
  expect((await readSettings(page)).lifeLength).toBe('short30');
  await expect(page.getByTestId('title-screen')).toBeVisible(); // 아무 데도 넘어가지 않았다
  // 약 30분을 다시 눌러도 그대로(저장은 약 30분), 새로고침해도 유지
  await chooseLifeLength(page, 'short30');
  await page.reload();
  await expect(page.getByTestId('life-short30')).toBeChecked();
  expect((await readSettings(page)).era, '세상 선택은 그대로').toBe('present');
});

test('저장된 설정의 인생 길이가 「약 1시간」(long60)이어도 첫 화면은 「약 30분」을 눌러 보이고, 태어나면 판의 인생 길이도 short30이다 (R-202: 저장된 값을 short30으로 읽는다)', async ({ page }) => {
  await injectSave(page, titleState(KNOWN_SEED), '/', { speed: 2, autoMode: false, era: 'past', lifeLength: 'long60' });
  await expect(page.getByTestId('title-screen')).toBeVisible();
  await expect(page.getByTestId('life-short30')).toBeChecked();
  await expect(page.getByTestId('life-long60')).not.toBeChecked();
  await expect(page.getByTestId('era-past')).toBeChecked(); // 다른 선택·배속은 그대로
  await expect.poll(async () => (await readSettings(page)).lifeLength, { message: '읽은 값(약 30분)이 다시 저장된다' }).toBe('short30');
  expect((await readSettings(page)).speed).toBe(2);
  await pressBegin(page);
  await expect(page.getByTestId('birth-screen')).toBeVisible();
  const born = (await readSave(page)).data;
  expect(born.lifeLength).toBe('short30');
  expect(born.era).toBe('past');
});

test('키보드: 라디오 묶음에서 방향키로 선택을 바꾸고(Tab 정지점은 묶음마다 하나) 설정에 저장된다', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('start-birth')).toBeEnabled();
  await page.getByTestId('era-present').focus();
  await page.keyboard.press('ArrowDown');
  await expect(page.getByTestId('era-future')).toBeChecked();
  await expect(page.getByTestId('era-future')).toBeFocused();
  await page.keyboard.press('ArrowUp');
  await page.keyboard.press('ArrowUp');
  await expect(page.getByTestId('era-past')).toBeChecked();
  await expect.poll(async () => (await readSettings(page)).era).toBe('past');
  // Tab: 세상 묶음 → 인생 길이 묶음 (묶음 안의 나머지 라디오는 건너뛴다)
  await page.keyboard.press('Tab');
  expect(await activeTestId(page)).toBe('life-short30');
  // 「약 1시간」은 준비 중이라 방향키가 건너뛴다: 선택은 약 30분에 머문다(비활성 카드로 선택이 옮겨 가지 않는다)
  await page.keyboard.press('ArrowRight');
  await expect(page.getByTestId('life-short30')).toBeChecked();
  await expect(page.getByTestId('life-short30')).toBeFocused();
  await expect(page.getByTestId('life-long60')).not.toBeChecked();
  await page.keyboard.press('ArrowLeft');
  await expect(page.getByTestId('life-short30')).toBeChecked();
  expect((await readSettings(page)).lifeLength).toBe('short30');
});

// ---------- FS6: 태어나기 ----------

for (const era of ['past', 'present', 'future'] as const) {
  for (const lifeLength of ['short30'] as const) { // 「약 1시간」은 준비 중이라 고를 수 없다(R-202) — 저장된 long60이 short30으로 읽히는 것은 위 테스트가 본다
    test(`태어나기(FS6): ${era} × ${lifeLength} — 고른 세상·인생 길이로 출생하고(저장 = core 기대값) 출생 화면에 머문다`, async ({ page }) => {
      await injectSave(page, titleState(KNOWN_SEED));
      await expect(page.getByTestId('title-screen')).toBeVisible();
      await chooseEra(page, era);
      await chooseLifeLength(page, lifeLength);
      const oracle = await expectedBirth(page, titleState(KNOWN_SEED), era, lifeLength);
      await pressBegin(page);
      await expect(page.getByTestId('birth-screen')).toBeVisible();
      const save = (await readSave(page)).data;
      expect(save).toEqual(oracle.once);
      expect(save.era).toBe(era);
      expect(save.lifeLength).toBe(lifeLength);
      const settings = await readSettings(page);
      expect([settings.era, settings.lifeLength]).toEqual([era, lifeLength]);
      // 새로고침해도 같은 출생 화면(첫 화면이 아니라 저장된 화면, C3)
      await page.reload();
      await expect(page.getByTestId('birth-screen')).toBeVisible();
      expect((await readSave(page)).data).toEqual(oracle.once);
    });
  }
}

/** 하단 띠의 세 상태: 새 판(「태어나기」) · 이어하기(「이어서 살기」+「새로 태어나기」) · 확인 단계(안내+「새로 태어나기」+「돌아가기」) */
type BarState = 'new' | 'continue' | 'confirm';

/** 상태에 맞는 첫 화면을 연다. 이어하기·확인 단계는 진행 중인 판을 둔 채 첫 화면을 다시 연 상태(?__exit)다. */
async function openBarState(page: Page, state: BarState, seed = KNOWN_SEED): Promise<void> {
  if (state === 'new') {
    await page.goto('/');
    await expect(page.getByTestId('start-birth')).toBeVisible();
    return;
  }
  await injectSave(page, lifeState(seed), '/?__exit=1', { speed: 1, autoMode: false });
  await expect(page.getByTestId('resume')).toBeVisible();
  if (state === 'confirm') {
    await expect(page.getByTestId('begin-new')).toBeEnabled();
    await page.getByTestId('begin-new').click();
    await expect(page.getByTestId('confirm-new-ask')).toBeVisible();
  }
}

for (const [i, vp] of [
  { width: 360, height: 568 },
  { width: 360, height: 740 },
  { width: 320, height: 568 },
  { width: 1280, height: 800 },
  { width: 667, height: 375 },
].entries()) {
  for (const state of ['new', 'continue', 'confirm'] as const) {
    test(`하단 고정(FS6) ${vp.width}x${vp.height} ${state}: 스크롤해도 하단 띠가 같은 자리·화면 안·가운데에 있고, 본문 끝 여백이 띠 높이 이상이라 푸터 마지막 줄·캐러셀을 가리지 않는다 (R-203: 이어하기·확인 단계 포함)`, async ({ page }, testInfo) => {
      test.skip(testInfo.project.name !== 'mobile-360', '뷰포트를 직접 지정하므로 mobile-360에서만 실행');
      await page.setViewportSize(vp);
      await openBarState(page, state, KNOWN_SEED + i);
      const barId = state === 'new' ? 'start-birth' : state === 'continue' ? 'resume' : 'confirm-new-no'; // 띠에서 가장 눈에 띄는(큰) 버튼
      const main = page.getByTestId(barId);
      await expect(main).toBeVisible();
      const box0 = (await main.boundingBox())!;
      expect(box0.y + box0.height, '화면 안').toBeLessThanOrEqual(vp.height + 0.5);
      expect(Math.abs(box0.x + box0.width / 2 - vp.width / 2), '가운데').toBeLessThanOrEqual(2);
      expect(box0.width).toBeGreaterThanOrEqual(240);
      expect(box0.height).toBeGreaterThanOrEqual(44);
      // 띠 안의 모든 버튼이 화면 안이고 44px 이상이다
      const ids = state === 'new' ? ['start-birth'] : state === 'continue' ? ['resume', 'begin-new'] : ['confirm-new-yes', 'confirm-new-no'];
      for (const id of ids) {
        const r = (await page.getByTestId(id).boundingBox())!;
        expect(r.y, `${id} 위쪽이 화면 안`).toBeGreaterThanOrEqual(0);
        expect(r.y + r.height, `${id} 아래쪽이 화면 안`).toBeLessThanOrEqual(vp.height + 0.5);
        expect(r.height, `${id} 높이`).toBeGreaterThanOrEqual(44);
      }
      expect(await page.getByTestId('bottom-bar').evaluate((el) => getComputedStyle(el).position)).toBe('fixed');
      for (const y of [300, 900, 99999]) {
        await page.evaluate((to) => window.scrollTo(0, to), y);
        const box = (await main.boundingBox())!;
        expect(Math.abs(box.y - box0.y), `scrollY ${y}: 같은 자리`).toBeLessThanOrEqual(1);
        expect(Math.abs(box.x - box0.x)).toBeLessThanOrEqual(1);
      }
      // 맨 아래: 푸터의 마지막 줄(빌드 버전)과 캐러셀이 하단 띠에 가려지지 않는다. 본문 끝 여백(page-end-space)은 이 상태의 띠 높이 이상이다.
      const tail = await page.evaluate(() => {
        const bar = document.querySelector('[data-testid="bottom-bar"]')!.getBoundingClientRect();
        const spacer = document.querySelector('.page-end-space')!.getBoundingClientRect();
        return {
          barTop: bar.top,
          barHeight: bar.height,
          spacerHeight: spacer.height,
          version: document.querySelector('[data-testid="build-version"]')!.getBoundingClientRect().bottom,
          carousel: document.querySelector('[data-testid="carousel"]')!.getBoundingClientRect().bottom,
          atEnd: Math.ceil(window.scrollY + innerHeight) >= document.documentElement.scrollHeight - 1,
        };
      });
      expect(tail.atEnd, `${i}: 맨 아래까지 내려갔다`).toBe(true);
      expect(tail.spacerHeight, `${state}: 본문 끝 여백 ${tail.spacerHeight}px ≥ 하단 띠 ${tail.barHeight}px`).toBeGreaterThanOrEqual(tail.barHeight);
      expect(tail.version, '빌드 버전 줄이 가려지지 않는다').toBeLessThanOrEqual(tail.barTop);
      expect(tail.carousel, '캐러셀이 가려지지 않는다').toBeLessThanOrEqual(tail.barTop);
      // 띠 한가운데를 눌러 맞는 요소는 띠의 큰 버튼이다(그 위로 다른 요소가 가려 눌리지 않는다)
      const hit = await page.evaluate((id) => {
        const r = document.querySelector(`[data-testid="${id}"]`)!.getBoundingClientRect();
        return document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)?.closest('[data-testid]')?.getAttribute('data-testid');
      }, barId);
      expect(hit).toBe(barId);
      expect(await noHorizontalOverflow(page)).toBe(true);
      if (state === 'continue' && vp.width === 360 && vp.height === 740) await expect(page.getByTestId('resume')).toBeEnabled(); // 입력 가드가 풀려 버튼이 흐리지 않은 모습으로 찍는다
      if (state === 'continue' && vp.width === 360 && vp.height === 740) await page.screenshot({ path: `${SHOTS}/dev-M2-continue-mobile-bottom.png` }); // 이어하기 상태, 맨 아래(푸터 마지막 줄이 띠 위에 보인다)
    });
  }
}

for (const method of RAPID_METHODS) {
  test(`태어나기 ${method}: 연타·더블탭에도 출생은 한 번만 일어나고 출생 화면에 머문다 (FS6, R-014 방식)`, async ({ page }) => {
    await injectSave(page, titleState(KNOWN_SEED));
    const oracle = await expectedBirth(page, titleState(KNOWN_SEED), 'present');
    expect(oracle.second, '이 시드는 두 번 뽑으면 다른 인물이다').not.toEqual(oracle.once.character);
    const begin = page.getByTestId('start-birth');
    await expect(begin).toBeEnabled();
    await rapidInput(page, method, begin);
    await expect(page.getByTestId('birth-screen')).toBeVisible();
    await expect(page.getByTestId('next-life')).toBeEnabled(); // 출생 화면의 가드가 풀린 뒤에도
    await expect(page.getByTestId('birth-screen')).toBeVisible();
    await expect(page.getByTestId('life-screen')).toHaveCount(0);
    expect((await readSave(page)).data).toEqual(oracle.once);
  });
}

test('태어나기 연타는 출생 화면의 「살아가기」를 건너뛰지 않는다 — 하단 고정 버튼 자리에 출생 화면의 버튼이 겹치는 낮은 화면(360x480·667x375)에서도', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-360', '뷰포트를 직접 지정하므로 mobile-360에서만 실행');
  for (const vp of [
    { width: 360, height: 480 },
    { width: 667, height: 375 },
    { width: 360, height: 800 },
  ]) {
    await page.setViewportSize(vp);
    for (const method of ['mouse3', 'human150'] as const) {
      await injectSave(page, titleState(KNOWN_SEED + vp.height));
      await expect(page.getByTestId('start-birth')).toBeEnabled(); // 입력 가드가 풀린 뒤(좌표 입력은 활성 여부를 기다리지 않는다)
      await rapidInput(page, method, page.getByTestId('start-birth'));
      await expect(page.getByTestId('birth-screen'), `${vp.width}x${vp.height} ${method}`).toBeVisible();
      await expect(page.getByTestId('next-life')).toBeEnabled();
      await expect(page.getByTestId('life-screen')).toHaveCount(0);
      expect((await readSave(page)).data.phase).toBe('birth');
    }
  }
});

// ---------- SC: 캐러셀 ----------

test('캐러셀(SC1·SC2): 지표 10개 이상, 요청의 5개 포함, 슬라이드마다 값·기준 연도·출처·정의, 값은 koreaStats.json 실제 값', async ({ page }) => {
  await page.goto('/');
  const n = await slideCount(page);
  expect(n).toBeGreaterThanOrEqual(10);
  await expect(page.getByTestId('carousel')).toHaveAttribute('aria-roledescription', '캐러셀');
  const ids = await page.evaluate(() => [...document.querySelectorAll('[data-testid="stat-slide"]')].map((s) => s.getAttribute('data-slide-id')));
  for (const id of ['tfr', 'cdr', 'elderly-poverty', 'suicide-rate', 'region-population-registered']) expect(ids).toContain(id);
  expect(ids).not.toContain('region-population'); // 17개 시도 센서스 지표는 뺐다(마스터 결정: 2026 주민등록 16개 시·도)
  // 첫 슬라이드: 합계출산율 — 시안의 가짜 값(0.68·2023)이 아니라 실제 값 0.80명·2025년 기준
  const first = page.locator('.slide.is-active');
  await expect(first).toContainText('합계출산율');
  await expect(first.getByTestId('slide-value')).toHaveText('0.80');
  await expect(first).toContainText('2025년 기준');
  await expect(first).toContainText('출처: 국가데이터처, 2025년 출생 통계');
  await expect(first).toContainText('(2026-10-15 조회)');
  await expect(first).toContainText('합계출산율은 한 여자가 가임 기간');
  await expect(first.getByTestId('slide-basis')).toHaveText(/^통계 기준: 2025년 · 마지막 갱신 \d{4}-\d{2}-\d{2}$/); // 슬라이드마다 「통계 기준·마지막 갱신」(SC4)
  await expect(first).not.toContainText('0.68');
  // 그래프(SVG)와 대체 텍스트
  const label = await first.locator('svg.chart').getAttribute('aria-label');
  expect(label).toContain('1970년부터 2025년까지 합계출산율 추이 그래프');
  expect(label).toContain('마지막 0.80명');
  // 자동 전환 안내(7초)
  await expect(page.getByTestId('carousel-auto-note')).toHaveText('7초마다 다음 지표');
  // 보이는 슬라이드는 하나뿐이다(나머지는 스크린리더·화면에서 숨는다)
  const visible = await page.evaluate(() => [...document.querySelectorAll<HTMLElement>('[data-testid="stat-slide"]')].filter((s) => getComputedStyle(s).visibility === 'visible').length);
  expect(visible).toBe(1);
});

test('캐러셀(SC5): 이전·다음·키보드 ←/→·스와이프, 위치는 「3 / 14」 한 줄, 지표가 6개 이상이면 점이 없다(R-133), 끝에서는 반대쪽으로 돈다', async ({ page }) => {
  await page.goto('/');
  const n = await slideCount(page);
  await expect(page.getByTestId('start-birth')).toBeEnabled(); // 입력 가드가 풀린 뒤
  expect(await countText(page)).toBe(`1 / ${n}`);
  await page.getByTestId('carousel-next').click();
  expect(await countText(page)).toBe(`2 / ${n}`);
  await page.getByTestId('carousel-prev').click();
  await page.getByTestId('carousel-prev').click();
  expect(await countText(page)).toBe(`${n} / ${n}`); // 처음에서 이전 → 마지막
  await page.getByTestId('carousel-next').click();
  expect(await countText(page)).toBe(`1 / ${n}`);
  // 지표가 많으면(14개) 점을 그리지 않는다 — 점 10개가 두 줄로 꺾이던 문제(R-133). 위치는 「n / N」 한 줄로 보인다
  expect(n).toBeGreaterThan(5);
  await expect(page.getByTestId('carousel-dots')).toHaveCount(0);
  await expect(page.locator('[data-testid^="carousel-dot-"]')).toHaveCount(0);
  const countBox = await page.getByTestId('carousel-count').evaluate((el) => {
    const r = el.getBoundingClientRect();
    return { height: r.height, lineHeight: parseFloat(getComputedStyle(el).lineHeight) || r.height };
  });
  expect(countBox.height, '「n / N」이 한 줄이다').toBeLessThan(countBox.lineHeight * 1.5);
  const third = await page.evaluate(() => {
    const s = document.querySelectorAll('[data-testid="stat-slide"]')[2];
    return { id: s.getAttribute('data-slide-id'), title: s.querySelector('h3')!.textContent };
  });
  await page.getByTestId('carousel-next').click();
  await page.getByTestId('carousel-next').click();
  expect(await countText(page)).toBe(`3 / ${n}`);
  expect(await activeSlideId(page)).toBe(third.id);
  await expect(page.locator('.slide.is-active')).toHaveAccessibleName(`3/${n} ${third.title}`);
  // 키보드 ←/→ (슬라이드 영역에 포커스가 있을 때)
  await page.getByTestId('carousel-viewport').focus();
  await page.keyboard.press('ArrowRight');
  expect(await countText(page)).toBe(`4 / ${n}`);
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('ArrowLeft');
  expect(await countText(page)).toBe(`2 / ${n}`);
  // 터치 스와이프: 왼쪽으로 밀면 다음, 오른쪽으로 밀면 이전, 세로 움직임이 크면 넘기지 않는다
  const swipe = (from: [number, number], to: [number, number]) =>
    page.evaluate(
      ([a, b]) => {
        const el = document.querySelector('[data-testid="carousel-viewport"]')!;
        const fire = (type: string, p: number[]) => el.dispatchEvent(new PointerEvent(type, { bubbles: true, pointerType: 'touch', isPrimary: true, clientX: p[0], clientY: p[1] }));
        fire('pointerdown', a);
        fire('pointerup', b);
      },
      [from, to] as const,
    );
  await swipe([250, 300], [120, 305]);
  expect(await countText(page)).toBe(`3 / ${n}`);
  await swipe([120, 300], [260, 302]);
  expect(await countText(page)).toBe(`2 / ${n}`);
  await swipe([200, 200], [150, 330]);
  expect(await countText(page)).toBe(`2 / ${n}`); // 세로 스크롤 동작은 넘기지 않는다
});

test('캐러셀 자동 전환(SC5): 7초마다 다음 슬라이드, 포인터가 올라가면 정지, 포커스가 안에 있으면 정지, 일시정지 버튼으로 멈추고 다시 시작', async ({ page }) => {
  await openWithClock(page);
  const n = await slideCount(page);
  const carousel = page.getByTestId('carousel');
  const count = page.getByTestId('carousel-count');
  await leaveCarousel(page); // 포인터는 캐러셀 밖
  expect(await countText(page)).toBe(`1 / ${n}`);
  await expect(page.locator('.slides')).toHaveAttribute('aria-live', 'off'); // 자동 전환은 스크린리더가 읽지 않는다
  await tick(page, 6_000);
  expect(await countText(page)).toBe(`1 / ${n}`); // 아직 7초가 안 됐다
  await tick(page, 1_500);
  await expect(count).toHaveText(`2 / ${n}`);
  await tick(page, 7_100);
  await expect(count).toHaveText(`3 / ${n}`);

  // 포인터가 올라가면 정지
  await carousel.scrollIntoViewIfNeeded(); // 좁은 화면에서는 캐러셀이 아래에 있다
  const box = (await carousel.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + 60);
  await expect(carousel).toHaveAttribute('data-autoplay', 'off');
  await expect(page.locator('.slides')).toHaveAttribute('aria-live', 'polite'); // 포인터로 멈췄으면 직접 넘길 때 읽는다(R-205)
  await tick(page, 20_000);
  await expect(count).toHaveText(`3 / ${n}`);
  await leaveCarousel(page);
  await expect(page.locator('.slides')).toHaveAttribute('aria-live', 'off'); // 다시 자동 전환 중이면 읽지 않는다
  await tick(page, 7_100);
  await expect(count).toHaveText(`4 / ${n}`);

  // 키보드 포커스가 안에 있으면 정지 (키보드 사용자)
  await page.keyboard.press('Tab'); // 키보드 사용 시작(:focus-visible)
  await page.getByTestId('carousel-next').focus();
  await expect(carousel).toHaveAttribute('data-autoplay', 'off');
  await expect(page.locator('.slides')).toHaveAttribute('aria-live', 'polite'); // 키보드 포커스로 멈췄을 때도 polite(R-205: 예전에는 일시정지·움직임 줄이기만 polite였다)
  await tick(page, 20_000);
  await expect(count).toHaveText(`4 / ${n}`);
  await leaveCarousel(page);
  await expect(page.locator('.slides')).toHaveAttribute('aria-live', 'off');
  await tick(page, 7_100);
  await expect(count).toHaveText(`5 / ${n}`);

  // 일시정지 버튼: 멈추고(이름이 「다시 시작」으로 바뀐다, 읽어 주도록 live=polite), 다시 누르면 이어서 돈다
  const pause = page.getByTestId('carousel-pause');
  await expect(pause).toHaveAccessibleName('자동 넘김 일시정지');
  await pause.click();
  await expect(pause).toHaveAccessibleName('자동 넘김 다시 시작');
  await expect(page.locator('.slides')).toHaveAttribute('aria-live', 'polite');
  await expect(page.getByTestId('carousel-auto-note')).toHaveText('자동 넘김 멈춤');
  await leaveCarousel(page, 'off');
  await tick(page, 30_000);
  await expect(count).toHaveText(`5 / ${n}`);
  await pause.click(); // 마우스로 다시 시작: 버튼에 포커스가 남아도(마우스 포커스는 정지 사유가 아니다) 포인터가 나가면 바로 돈다
  await expect(pause).toHaveAccessibleName('자동 넘김 일시정지');
  await page.mouse.move(2, 2, { steps: 8 });
  await expect(carousel).toHaveAttribute('data-autoplay', 'on');
  await tick(page, 7_100);
  await expect(count).toHaveText(`6 / ${n}`);
  // 손으로 넘기면 7초를 다시 센다
  await page.getByTestId('carousel-next').click();
  await expect(count).toHaveText(`7 / ${n}`);
  await leaveCarousel(page);
  await tick(page, 6_000);
  await expect(count).toHaveText(`7 / ${n}`);
  await tick(page, 1_200);
  await expect(count).toHaveText(`8 / ${n}`);
});

test('움직임 줄이기(SC5·CM4): 자동 전환이 꺼지고(일시정지 버튼도 없다) 손으로만 넘긴다 — 시스템 설정과 <html data-motion="reduce"> 둘 다', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await openWithClock(page);
  const n = await slideCount(page);
  await page.mouse.click(2, 2);
  await tick(page, 60_000);
  await expect(page.getByTestId('carousel-count')).toHaveText(`1 / ${n}`);
  await expect(page.getByTestId('carousel-pause')).toHaveCount(0);
  await expect(page.getByTestId('carousel-auto-note')).toHaveText('자동 넘김 멈춤');
  await expect(page.locator('.slides')).toHaveAttribute('aria-live', 'polite');
  await expect(page.getByTestId('start-birth')).toBeEnabled();
  await page.getByTestId('carousel-next').click();
  await expect(page.getByTestId('carousel-count')).toHaveText(`2 / ${n}`);
  // 전환 애니메이션도 없다
  expect(await page.evaluate(() => getComputedStyle(document.querySelector('.slide.is-active')!).transitionDuration)).toMatch(/^(0s|0\.01ms|1e-05s)$/);

  // 앱 설정(data-motion)만 켜져 있어도 같다 (시스템 설정은 움직임 허용)
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.evaluate(() => document.documentElement.setAttribute('data-motion', 'reduce'));
  await expect(page.getByTestId('carousel-pause')).toHaveCount(0);
  await page.getByTestId('carousel-prev').click();
  await page.mouse.click(2, 2);
  await tick(page, 60_000);
  await expect(page.getByTestId('carousel-count')).toHaveText(`1 / ${n}`);
  // 설정을 끄면 다시 자동 전환
  await page.evaluate(() => document.documentElement.removeAttribute('data-motion'));
  await expect(page.getByTestId('carousel-pause')).toBeVisible();
  await tick(page, 7_100);
  await expect(page.getByTestId('carousel-count')).toHaveText(`2 / ${n}`);
});

test('탭이 가려지면 자동 전환이 멈추고 다시 보이면 이어진다', async ({ page }) => {
  await openWithClock(page);
  const n = await slideCount(page);
  await leaveCarousel(page);
  const setVisibility = (v: 'hidden' | 'visible') =>
    page.evaluate((value) => {
      Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => value });
      document.dispatchEvent(new Event('visibilitychange'));
    }, v);
  await setVisibility('hidden');
  await tick(page, 30_000);
  await expect(page.getByTestId('carousel-count')).toHaveText(`1 / ${n}`);
  await setVisibility('visible');
  await tick(page, 7_100);
  await expect(page.getByTestId('carousel-count')).toHaveText(`2 / ${n}`);
});

test('자살률 슬라이드(SC6): 값·기준 연도·출처와 자살예방 상담전화 109(24시간) 안내가 같은 슬라이드 안에 있고, 다른 슬라이드에는 없다', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('start-birth')).toBeEnabled();
  const n = await slideCount(page);
  let found = false;
  for (let i = 0; i < n; i++) {
    await goToSlide(page, i);
    const id = await activeSlideId(page);
    const help = page.locator('.slide.is-active [data-testid="slide-help"]');
    if (id === 'suicide-rate') {
      found = true;
      const slide = page.locator('.slide.is-active');
      await expect(slide).toContainText('자살률');
      await expect(slide.getByTestId('slide-value')).toHaveText('27.8');
      // 값 옆 칸은 단위 낱말(「명」)만, 분모 문구는 기준 줄에(QM2-4): 예전에는 「인구 10만 명당 명」이라 「명당 명」이 겹쳐 읽혔다
      await expect(slide.getByTestId('slide-value').locator('xpath=following-sibling::small')).toHaveText('명');
      await expect(slide.locator('.slide__basis').first()).toHaveText('인구 10만 명당 · 2025년 기준');
      await expect(slide).not.toContainText('명당 명');
      await expect(slide).toContainText('출처: 국가데이터처');
      await expect(help).toBeVisible();
      await expect(help).toContainText('자살예방 상담전화 109 (24시간)');
      await expect(help.getByRole('link', { name: '109' })).toHaveAttribute('href', 'tel:109');
      expect(await slide.innerText()).not.toMatch(/방법|장소|동기/);
      // 안내가 슬라이드 안(같은 article)에 있다
      expect(await help.evaluate((el) => el.closest('[data-testid="stat-slide"]')?.getAttribute('data-slide-id'))).toBe('suicide-rate');
    } else {
      await expect(help, `${id}`).toHaveCount(0);
    }
  }
  expect(found, '자살률 슬라이드가 있다').toBe(true);
});

test('캐러셀 모든 슬라이드: 조작 줄(이전·다음·일시정지)은 슬라이드가 바뀌어도 같은 자리에 있고, 좁은 화면은 카드 높이가 변하지 않으며(아래가 흔들리지 않는다), 가로 넘침·그래프 잘림이 없다 (320·360·1280)', async ({ page }, testInfo) => {
  const mobile = testInfo.project.name === 'mobile-360';
  const widths = mobile ? [320, 360] : [1280];
  for (const w of widths) {
    await page.setViewportSize({ width: w, height: mobile ? 740 : 800 });
    await page.goto('/');
    await expect(page.getByTestId('start-birth')).toBeEnabled();
    const n = await slideCount(page);
    const heights = new Set<number>();
    const ctrlTops = new Set<number>();
    for (let i = 0; i < n; i++) {
      await goToSlide(page, i);
      const m = await page.evaluate(() => {
        const card = document.querySelector('[data-testid="carousel"]')!.getBoundingClientRect();
        const slide = document.querySelector('.slide.is-active')!;
        const svg = slide.querySelector('svg.chart')!.getBoundingClientRect();
        // 슬라이드 안의 모든 요소가 카드 안쪽 폭에 들어간다
        const stray = [...slide.querySelectorAll<HTMLElement | SVGElement>('*')].filter((e) => {
          if (e.closest('.sr-only') !== null) return false; // 화면에서 숨긴 표(R-207)는 1px로 잘려 있어 보이는 요소가 아니다
          const r = e.getBoundingClientRect();
          return r.width > 0 && (r.right > card.right + 0.5 || r.left < card.left - 0.5);
        }).length;
        const prev = document.querySelector('[data-testid="carousel-prev"]')!.getBoundingClientRect();
        return { cardH: Math.round(card.height), cardTop: card.top + window.scrollY, ctrlTop: Math.round(prev.top - card.top), svgRight: svg.right, cardRight: card.right, stray, overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth };
      });
      heights.add(m.cardH);
      ctrlTops.add(m.ctrlTop);
      expect(m.stray, `${w}px ${i + 1}번째 슬라이드 요소가 카드 밖`).toBe(0);
      expect(m.svgRight).toBeLessThanOrEqual(m.cardRight);
      expect(m.overflow, `${w}px ${i + 1}번째 슬라이드 가로 넘침`).toBe(false);
    }
    expect([...ctrlTops], `${w}px 조작 줄이 슬라이드마다 다른 자리에 있다(카드 머리에서의 위치): ${[...ctrlTops]}`).toHaveLength(1);
    if (w < 960) {
      // 한 칸 레이아웃: 모든 슬라이드를 같은 칸에 겹쳐 두어 카드 높이가 같다 — 전환 때 아래(푸터)가 흔들리지 않는다
      expect(heights.size, `${w}px 카드 높이가 슬라이드마다 다르다: ${[...heights]}`).toBe(1);
    } else {
      // 오른쪽 열(폭 ≥ 960): 카드 높이는 보이는 슬라이드만큼이다(R-200) — 짧은 슬라이드 아래에 빈 칸이 없다. 아래 내용은 열이 달라 흔들리지 않는다.
      expect(heights.size, `${w}px 카드 높이가 슬라이드마다 같다(고정 높이 해제가 안 됐다): ${[...heights]}`).toBeGreaterThan(3);
    }
    // 점은 없고(지표 14개, R-133) 위치 「n / N」은 한 줄이다(두 줄로 꺾이지 않는다)
    await expect(page.getByTestId('carousel-dots')).toHaveCount(0);
    const countRows = await page.evaluate(() => {
      const el = document.querySelector('[data-testid="carousel-count"]')!;
      const lh = parseFloat(getComputedStyle(el).lineHeight) || el.getBoundingClientRect().height;
      return el.getBoundingClientRect().height / lh;
    });
    expect(countRows, `${w}px 위치 표기가 한 줄`).toBeLessThan(1.5);
    // 이전·다음·일시정지는 44×44 이상
    const targets = await page.evaluate(() =>
      ['carousel-prev', 'carousel-next', 'carousel-pause'].map((id) => {
        const r = document.querySelector(`[data-testid="${id}"]`)!.getBoundingClientRect();
        return [r.width, r.height];
      }),
    );
    for (const [tw, th] of targets) {
      expect(tw).toBeGreaterThanOrEqual(44);
      expect(th).toBeGreaterThanOrEqual(44);
    }
    expect(await noHorizontalOverflow(page)).toBe(true);
  }
});

// ---------- R-200: 캐러셀 카드 전체가 하단 띠 위 (폭 ≥ 960) ----------

/** 이 순간의 카드·조작 줄·하단 띠 위치 (viewport 좌표) */
async function carouselGeometry(page: Page) {
  return page.evaluate(() => {
    const rect = (sel: string) => document.querySelector(sel)!.getBoundingClientRect();
    const card = rect('[data-testid="carousel"]');
    const side = document.querySelector('.title__side')!;
    const bar = rect('[data-testid="bottom-bar"]');
    const ctrl = ['carousel-prev', 'carousel-next', 'carousel-pause'].map((id) => {
      const r = rect(`[data-testid="${id}"]`);
      const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)?.closest('[data-testid]')?.getAttribute('data-testid');
      return { id, top: r.top, bottom: r.bottom, hit };
    });
    return {
      cardTop: card.top,
      cardBottom: card.bottom,
      barTop: bar.top,
      sideBottom: side.getBoundingClientRect().bottom,
      innerScroll: side.scrollHeight - side.clientHeight,
      ctrl,
      vh: innerHeight,
      slide: document.querySelector('.slide.is-active')!.getAttribute('data-slide-id')!,
    };
  });
}

for (const vp of [
  { width: 1280, height: 800 },
  { width: 1024, height: 768 },
]) {
  for (const state of ['new', 'continue'] as const) {
    test(`캐러셀 카드 전체(조작 줄 포함)가 하단 띠 위에 있다 — ${vp.width}x${vp.height} ${state === 'new' ? '새 판' : '이어하기'}: 모든 슬라이드 × scrollY 0·중간·맨 아래(따라다니는 상태) (R-200)`, async ({ page }, testInfo) => {
      test.skip(testInfo.project.name !== 'desktop', '폭 ≥ 960의 뷰포트를 직접 지정하므로 desktop 프로젝트에서만 실행');
      test.setTimeout(90_000);
      await page.setViewportSize(vp);
      await openBarState(page, state);
      await expect(page.getByTestId('carousel')).toBeVisible();
      await page.waitForTimeout(450); // 입력 가드(0.4초)가 풀린 뒤에 「다음 지표」를 누른다
      const n = await slideCount(page);
      const tops = new Set<number>();
      let tallest = { slide: '', height: 0 };
      for (let i = 0; i < n; i++) {
        // scrollY 0: 캐러셀 카드 맨 아래가 하단 띠 위끝보다 위에 있다(예전에는 카드가 띠 아래로 약 60~70px 가려졌다)
        await page.evaluate(() => window.scrollTo(0, 0));
        const g0 = await carouselGeometry(page);
        expect(g0.cardBottom, `scrollY 0 · ${g0.slide}: carousel.bottom ${Math.round(g0.cardBottom)} ≤ bar.top ${Math.round(g0.barTop)}`).toBeLessThanOrEqual(g0.barTop);
        expect(g0.cardTop).toBeGreaterThanOrEqual(0);
        expect(g0.innerScroll, `${g0.slide}: 카드 안쪽이 스크롤돼야 할 만큼 크지 않다`).toBeLessThanOrEqual(1);
        for (const c of g0.ctrl) {
          expect(c.bottom, `${g0.slide} ${c.id}이 띠 위`).toBeLessThanOrEqual(g0.barTop);
          expect(c.hit, `${g0.slide} ${c.id} 한가운데를 누르면 그 버튼이다(다른 것이 가리지 않는다)`).toBe(c.id);
        }
        tops.add(Math.round(g0.ctrl[0].top));
        if (g0.cardBottom - g0.cardTop > tallest.height) tallest = { slide: g0.slide, height: Math.round(g0.cardBottom - g0.cardTop) };
        // 따라다니는(sticky) 상태: 페이지를 내렸을 때 카드는 위쪽(24px)에 붙어 있고 카드 전체가 띠 위다.
        // 붙어 있는 마지막 위치(열 끝 − 카드 높이 − 24)와, 맨 아래(열 끝에 맞춰 카드가 위로 밀려 올라간 상태)도 본다.
        const stuckEnd = await page.evaluate(() => {
          const row = document.querySelector('.title')!.getBoundingClientRect();
          const card = document.querySelector('[data-testid="carousel"]')!.getBoundingClientRect();
          return Math.max(0, Math.floor(row.bottom + window.scrollY - card.height - 24 - 2));
        });
        for (const y of [Math.min(200, stuckEnd), stuckEnd, 99999]) { // 열이 그리 길지 않아(약 1000px) 붙어 있는 구간은 맨 위부터 약 380px까지다
          await page.evaluate((to) => window.scrollTo(0, to), y);
          const g = await carouselGeometry(page);
          expect(g.cardBottom, `scrollY ${y} · ${g.slide}: carousel.bottom ${Math.round(g.cardBottom)} ≤ bar.top ${Math.round(g.barTop)}`).toBeLessThanOrEqual(g.barTop);
          for (const c of g.ctrl) expect(c.bottom).toBeLessThanOrEqual(g.barTop);
          if (y !== 99999) {
            expect(g.cardTop, `scrollY ${y}: 붙어 있는 동안 카드 머리(조작 줄 포함)가 화면 위에 보인다`).toBeGreaterThanOrEqual(0);
            for (const c of g.ctrl) expect(c.top, `scrollY ${y} ${c.id}`).toBeGreaterThanOrEqual(0);
          }
        }
        if (i < n - 1) {
          await page.evaluate(() => window.scrollTo(0, 0));
          await page.getByTestId('carousel-next').click();
        }
      }
      expect(tops.size, `조작 줄이 슬라이드마다 움직였다: ${[...tops]}`).toBe(1);
      // 증거 스크린샷: 가장 큰 슬라이드로 가서 scrollY 0에서 한 장
      await page.evaluate(() => window.scrollTo(0, 0));
      const idx = await page.evaluate((id) => [...document.querySelectorAll('[data-testid="stat-slide"]')].findIndex((s) => s.getAttribute('data-slide-id') === id), tallest.slide);
      await goToSlide(page, idx);
      await page.waitForTimeout(350);
      await page.screenshot({ path: `${SHOTS}/dev-M2-r200-${vp.width}x${vp.height}-${state}-tallest.png` });
    });
  }
}

test('낮은 데스크톱 창(1280x620)에서도 카드가 하단 띠 위에 머문다: 카드가 더 크면 카드 안쪽이 스크롤되고 조작 줄은 머리에 남아 누를 수 있다 (R-200 보강)', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'desktop 프로젝트에서만 실행');
  test.setTimeout(60_000);
  await page.setViewportSize({ width: 1280, height: 620 });
  await openBarState(page, 'continue');
  await page.waitForTimeout(450);
  const n = await slideCount(page);
  let scrolled = 0;
  for (let i = 0; i < n; i++) {
    await page.evaluate(() => window.scrollTo(0, 0));
    const g = await carouselGeometry(page);
    expect(g.sideBottom, `${g.slide}: 오른쪽 열 맨 아래 ${Math.round(g.sideBottom)} ≤ bar.top ${Math.round(g.barTop)}`).toBeLessThanOrEqual(g.barTop + 0.5);
    for (const c of g.ctrl) {
      expect(c.bottom).toBeLessThanOrEqual(g.barTop);
      expect(c.hit, `${g.slide} ${c.id}`).toBe(c.id);
    }
    if (g.innerScroll > 1) scrolled++;
    if (i < n - 1) await page.getByTestId('carousel-next').click();
  }
  expect(scrolled, '이 높이에서는 큰 슬라이드의 안쪽 스크롤이 실제로 쓰인다(공허 통과 방지)').toBeGreaterThan(0);
});

// ---------- R-220: 따라다니는 카드는 어느 스크롤 위치에서든 같은 자리 (폭 ≥ 960) ----------

/** 스크롤 위치 y로 가서 그 자리의 조작 줄·카드·오른쪽 열·하단 띠·푸터 위치를 잰다 (viewport 좌표. 푸터·문서 높이는 문서 기준도) */
async function geometryAt(page: Page, y: number) {
  return page.evaluate((to) => {
    window.scrollTo(0, to);
    const rect = (sel: string) => document.querySelector(sel)!.getBoundingClientRect();
    const card = rect('[data-testid="carousel"]');
    const foot = rect('[data-testid="title-foot"]');
    const ctrl = ['carousel-prev', 'carousel-next', 'carousel-pause'].map((id) => {
      const r = rect(`[data-testid="${id}"]`);
      const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)?.closest('[data-testid]')?.getAttribute('data-testid');
      return { id, top: r.top, bottom: r.bottom, hit };
    });
    return {
      y: window.scrollY,
      cardTop: card.top,
      cardBottom: card.bottom,
      sideBottom: rect('.title__side').bottom,
      barTop: rect('[data-testid="bottom-bar"]').top,
      footDocTop: foot.top + window.scrollY,
      docHeight: document.documentElement.scrollHeight,
      ctrl,
      slide: document.querySelector('.slide.is-active')!.getAttribute('data-slide-id')!,
    };
  }, y);
}

/** 맨 위부터 맨 아래까지 훑을 스크롤 위치: 0·1·3·10·50, 100px 간격, 맨 아래 직전·맨 아래 */
function scrollStops(maxY: number): number[] {
  const ys = new Set<number>([0, 1, 3, 10, 50, Math.max(0, maxY - 1), maxY]);
  for (let y = 100; y < maxY; y += 100) ys.add(y);
  return [...ys].filter((y) => y >= 0 && y <= maxY).sort((a, b) => a - b);
}

for (const vp of [
  { width: 1280, height: 800 },
  { width: 1024, height: 768 },
]) {
  for (const state of ['new', 'continue'] as const) {
    test(`조작 줄은 슬라이드와 무관하게 어느 스크롤 위치에서든 한 자리에 있고 화면 위·하단 띠 아래로 나가지 않는다 — ${vp.width}x${vp.height} ${state === 'new' ? '새 판' : '이어하기'}: 모든 슬라이드 × 맨 위부터 맨 아래까지 모든 스크롤 위치 (R-220)`, async ({ page }, testInfo) => {
      test.skip(testInfo.project.name !== 'desktop', '폭 ≥ 960의 뷰포트를 직접 지정하므로 desktop 프로젝트에서만 실행');
      test.setTimeout(120_000);
      await page.setViewportSize(vp);
      await openBarState(page, state);
      await expect(page.getByTestId('carousel')).toBeVisible();
      await page.waitForTimeout(450); // 입력 가드(0.4초)가 풀린 뒤에 버튼을 누른다
      await page.getByTestId('carousel-pause').click(); // 훑는 동안 자동 전환이 슬라이드를 바꾸지 않게
      const ids = await page.evaluate(() => [...document.querySelectorAll('[data-testid="stat-slide"]')].map((s) => s.getAttribute('data-slide-id')!));
      const maxY = await page.evaluate(() => document.documentElement.scrollHeight - innerHeight);
      expect(maxY, '페이지가 스크롤되고 따라다니는 구간(scrollY ≥ 3)이 있다(공허 통과 방지)').toBeGreaterThan(100);
      const stops = scrollStops(maxY);
      const topsByY = new Map<number, Set<number>>(); // 스크롤 위치 → 모든 슬라이드에서 잰 조작 줄 위끝
      const stuckTops = new Set<number>(); // 따라다니는 동안(scrollY ≥ 10) 모든 위치·슬라이드의 조작 줄 위끝
      const footTops = new Set<number>();
      const docHeights = new Set<number>();
      let tallest = { index: 0, height: 0 };
      for (let i = 0; i < ids.length; i++) {
        await page.evaluate(() => window.scrollTo(0, 0));
        if (i > 0) await page.getByTestId('carousel-next').click();
        for (const y of stops) {
          const g = await geometryAt(page, y);
          const tag = `${ids[i]} scrollY ${y}`;
          expect(g.slide, `${tag}: 지금 슬라이드`).toBe(ids[i]);
          expect(g.y, `${tag}: 실제로 그 위치까지 갔다`).toBeCloseTo(y, 0);
          expect(g.cardBottom, `${tag}: 카드 아래끝 ${Math.round(g.cardBottom)} ≤ 띠 위끝 ${Math.round(g.barTop)}`).toBeLessThanOrEqual(g.barTop + 0.5);
          for (const c of g.ctrl) {
            expect(c.top, `${tag} ${c.id}: 화면 위로 잘리지 않는다 (ctrl.top ≥ 0)`).toBeGreaterThanOrEqual(0);
            expect(c.bottom, `${tag} ${c.id}: 하단 띠 위`).toBeLessThanOrEqual(g.barTop + 0.5);
            expect(c.hit, `${tag} ${c.id} 한가운데를 누르면 그 버튼이다(다른 것이 가리지 않는다)`).toBe(c.id);
          }
          const top = Math.round(g.ctrl[0].top * 10) / 10;
          if (!topsByY.has(y)) topsByY.set(y, new Set());
          topsByY.get(y)!.add(top);
          if (y >= 10) stuckTops.add(top);
          footTops.add(Math.round(g.footDocTop * 10) / 10);
          docHeights.add(g.docHeight);
          if (y === 0 && g.cardBottom - g.cardTop > tallest.height) tallest = { index: i, height: g.cardBottom - g.cardTop };
        }
      }
      // ① 같은 스크롤 위치에서는 슬라이드가 바뀌어도 조작 줄 위치가 하나다
      for (const y of stops) expect([...topsByY.get(y)!], `scrollY ${y}: 슬라이드마다 조작 줄 위끝이 다르다`).toHaveLength(1);
      // 따라다니는 동안에는 맨 아래까지 한 자리다 — 카드가 열 끝에 밀려 올라가지 않는다(예전에는 맨 아래에서 가장 큰 슬라이드의 카드 머리가 화면 위로 잘렸다)
      expect([...stuckTops], `scrollY ≥ 10에서 조작 줄이 움직였다(밀려 올라감): ${[...stuckTops]}`).toHaveLength(1);
      // ④ 아래 내용(푸터)·문서 높이는 슬라이드와 무관하다
      expect([...footTops], `슬라이드마다 푸터 위끝이 다르다: ${[...footTops]}`).toHaveLength(1);
      expect([...docHeights], `슬라이드마다 문서 높이가 다르다: ${[...docHeights]}`).toHaveLength(1);
      // 증거 스크린샷: 가장 큰 슬라이드로 가서 맨 아래(카드 머리가 잘리지 않고 띠 위에 있다)
      await page.evaluate(() => window.scrollTo(0, 0));
      await goToSlide(page, tallest.index);
      await page.waitForTimeout(350);
      await page.evaluate(() => window.scrollTo(0, 99999));
      await page.screenshot({ path: `${SHOTS}/dev-M2-r220-${vp.width}x${vp.height}-${state}-bottom.png` });
    });
  }
}

// ---------- R-220 ④: 슬라이드가 바뀌어도 아래 내용(푸터)이 움직이지 않는다 — 모든 폭(모바일 포함) ----------

const FOOTER_VIEWPORTS = [
  { width: 320, height: 568 },
  { width: 360, height: 740 },
  { width: 768, height: 1024 },
  { width: 959, height: 800 },
  { width: 960, height: 800 },
  { width: 1024, height: 768 },
  { width: 1280, height: 800 },
];

/** 문서 기준 푸터 위끝·빌드 버전 줄·본문 끝 여백과 문서 높이 — 슬라이드가 바뀌어도 변하면 안 되는 「아래 내용」 */
async function belowContent(page: Page) {
  return page.evaluate(() => {
    const doc = (sel: string) => {
      const r = document.querySelector(sel)!.getBoundingClientRect();
      return [Math.round((r.top + window.scrollY) * 10) / 10, Math.round((r.bottom + window.scrollY) * 10) / 10];
    };
    return {
      key: JSON.stringify([doc('[data-testid="title-foot"]'), doc('[data-testid="build-version"]'), doc('.page-end-space'), document.documentElement.scrollHeight]),
      slide: document.querySelector('.slide.is-active')!.getAttribute('data-slide-id')!,
    };
  });
}

for (const vp of FOOTER_VIEWPORTS) {
  test(`전환 때 아래 내용(푸터·본문 끝 여백·문서 높이)이 움직이지 않는다 — 「다음」 ${vp.width}x${vp.height}: 모든 슬라이드 (R-220 ④)`, async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', '뷰포트를 직접 지정하므로 desktop 프로젝트에서만 실행(레이아웃은 폭만 본다)');
    test.setTimeout(60_000);
    await page.setViewportSize(vp);
    await page.goto('/');
    await expect(page.getByTestId('start-birth')).toBeEnabled();
    await page.getByTestId('carousel-pause').click(); // 자동 전환이 끼어들지 않게
    const n = await slideCount(page);
    const seen = new Set<string>();
    const slides = new Set<string>();
    for (let i = 0; i < n; i++) {
      await goToSlide(page, i);
      const b = await belowContent(page);
      seen.add(b.key);
      slides.add(b.slide);
    }
    expect(slides.size, '모든 슬라이드를 지났다(공허 통과 방지)').toBe(n);
    expect([...seen], `${vp.width}px: 슬라이드가 바뀔 때 아래 내용이 움직였다`).toHaveLength(1);
  });

  test(`전환 때 아래 내용(푸터·본문 끝 여백·문서 높이)이 움직이지 않는다 — 자동 전환 ${vp.width}x${vp.height}: 7초마다 모든 슬라이드 (R-220 ④)`, async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', '뷰포트를 직접 지정하므로 desktop 프로젝트에서만 실행(레이아웃은 폭만 본다)');
    test.setTimeout(120_000);
    await page.setViewportSize(vp);
    await openWithClock(page);
    const n = await slideCount(page);
    await leaveCarousel(page);
    const seen = new Set<string>([(await belowContent(page)).key]);
    for (let k = 1; k < n; k++) {
      await tick(page, 7_100);
      await expect(page.getByTestId('carousel-count')).toHaveText(`${k + 1} / ${n}`);
      seen.add((await belowContent(page)).key);
    }
    expect([...seen], `${vp.width}px: 자동 전환 때 아래 내용이 움직였다`).toHaveLength(1);
  });
}

// ---------- R-224: 낮은 창의 안쪽 스크롤 (키보드) ----------

test('낮은 데스크톱 창(1280x620)에서 키보드로 카드 안쪽을 끝까지 내릴 수 있다 (R-224): 슬라이드 영역 포커스 → PageDown → 안쪽 scrollTop > 0, 「통계 기준」 줄이 하단 띠 위에 보이고, PageUp으로 조작 줄이 다시 보인다', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'desktop 프로젝트에서만 실행');
  test.setTimeout(60_000);
  await page.setViewportSize({ width: 1280, height: 620 });
  await openBarState(page, 'continue');
  await page.waitForTimeout(450);
  await page.getByTestId('carousel-pause').click(); // 키보드 포커스·자동 전환과 무관하게 슬라이드를 고정
  // 카드 안쪽 스크롤이 필요한 슬라이드(이 높이에서는 막대 그래프 큰 슬라이드)로 간다
  const n = await slideCount(page);
  let found = '';
  for (let i = 0; i < n && found === ''; i++) {
    if (i > 0) await page.getByTestId('carousel-next').click();
    const g = await carouselGeometry(page);
    if (g.innerScroll > 1) found = g.slide;
  }
  expect(found, '안쪽 스크롤이 필요한 슬라이드가 있다(공허 통과 방지)').not.toBe('');
  const scrollTop = () => page.evaluate(() => document.querySelector('.title__side')!.scrollTop);
  expect(await scrollTop()).toBe(0);
  const viewport = page.getByTestId('carousel-viewport');
  await viewport.focus(); // 슬라이드 영역(tabindex=0)에 포커스
  await expect(viewport).toBeFocused();
  await page.keyboard.press('PageDown');
  await expect.poll(scrollTop, { message: 'PageDown으로 카드 안쪽이 내려간다' }).toBeGreaterThan(0);
  await expect.poll(async () => (await page.evaluate(() => { const el = document.querySelector('.title__side')!; return el.scrollHeight - el.clientHeight - el.scrollTop; }))).toBeLessThanOrEqual(1); // 끝까지(이 여유는 한 쪽 안)
  const after = await page.evaluate(() => {
    const side = document.querySelector('.title__side')!.getBoundingClientRect();
    const basis = document.querySelector('.slide.is-active [data-testid="slide-basis"]')!.getBoundingClientRect();
    const bar = document.querySelector('[data-testid="bottom-bar"]')!.getBoundingClientRect();
    return { basisTop: basis.top, basisBottom: basis.bottom, sideTop: side.top, sideBottom: side.bottom, barTop: bar.top };
  });
  expect(after.basisBottom, `「통계 기준」 줄 아래끝 ${Math.round(after.basisBottom)} ≤ 하단 띠 위끝 ${Math.round(after.barTop)}`).toBeLessThanOrEqual(after.barTop);
  expect(after.basisBottom, '카드 안쪽 영역 안').toBeLessThanOrEqual(after.sideBottom + 0.5);
  expect(after.basisTop).toBeGreaterThanOrEqual(after.sideTop);
  expect(after.basisTop).toBeGreaterThanOrEqual(0);
  await expect(page.locator('.slide.is-active').getByTestId('slide-basis')).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/dev-M2-r224-1280x620-pagedown.png` });
  // 되돌리기: PageUp으로 맨 위로 오면 조작 줄이 다시 보이고 눌린다
  await page.keyboard.press('PageUp');
  await expect.poll(scrollTop).toBe(0);
  const back = await carouselGeometry(page);
  for (const c of back.ctrl) {
    expect(c.top).toBeGreaterThanOrEqual(0);
    expect(c.bottom).toBeLessThanOrEqual(back.barTop);
    expect(c.hit, `${c.id} 한가운데를 누르면 그 버튼이다`).toBe(c.id);
  }
});

test('1024x768 「새로 태어나기」 확인 단계(하단 띠가 가장 높은 상태)에서도 오른쪽 열 아래끝이 하단 띠 위끝 이하이고 조작 줄이 보인다 (R-224): 모든 슬라이드 × 맨 위·중간·맨 아래', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'desktop 프로젝트에서만 실행');
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 1024, height: 768 });
  await openBarState(page, 'confirm');
  await page.waitForTimeout(450);
  await page.getByTestId('carousel-pause').click();
  const barHeight = await page.getByTestId('bottom-bar').evaluate((el) => el.getBoundingClientRect().height);
  expect(barHeight, '확인 단계의 띠는 새 판(약 68px)·이어하기(약 120px)보다 높다(공허 통과 방지)').toBeGreaterThan(140);
  const n = await slideCount(page);
  const maxY = await page.evaluate(() => document.documentElement.scrollHeight - innerHeight);
  let scrolled = 0;
  const stuckTops = new Set<number>(); // 따라다니는 동안(scrollY ≥ 10) 모든 슬라이드·위치의 조작 줄 위끝 — 안쪽 스크롤을 쓰는 큰 슬라이드도 맨 아래까지 한 자리다
  const stuckWhere: string[] = [];
  for (let i = 0; i < n; i++) {
    await page.evaluate(() => window.scrollTo(0, 0));
    if (i > 0) await page.getByTestId('carousel-next').click();
    for (const y of [0, Math.floor(maxY / 2), maxY]) {
      const g = await geometryAt(page, y);
      const side = await carouselGeometry(page);
      const tag = `${g.slide} scrollY ${y}`;
      expect(side.sideBottom, `${tag}: 오른쪽 열 아래끝 ${Math.round(side.sideBottom)} ≤ 띠 위끝 ${Math.round(g.barTop)}`).toBeLessThanOrEqual(g.barTop + 0.5);
      // (카드 전체의 아래끝은 안쪽 스크롤이 쓰일 때 보이는 영역 아래로 이어지므로 보지 않는다 — 보이는 영역인 오른쪽 열 아래끝이 띠 위다)
      for (const c of g.ctrl) {
        expect(c.top, `${tag} ${c.id}`).toBeGreaterThanOrEqual(0);
        expect(c.bottom, `${tag} ${c.id}`).toBeLessThanOrEqual(g.barTop + 0.5);
        expect(c.hit, `${tag} ${c.id}`).toBe(c.id);
      }
      if (y === 0 && side.innerScroll > 1) scrolled++;
      if (y >= 10) {
        stuckTops.add(Math.round(g.ctrl[0].top * 10) / 10);
        stuckWhere.push(`${g.slide}@${y}:${Math.round(g.ctrl[0].top * 10) / 10}`);
      }
    }
  }
  expect(scrolled, '이 높이에서는 큰 슬라이드의 안쪽 스크롤이 실제로 쓰인다(공허 통과 방지)').toBeGreaterThan(0);
  expect([...stuckTops], `확인 단계에서도 따라다니는 동안 조작 줄이 한 자리다: ${[...stuckTops]} (${stuckWhere.join(' ')})`).toHaveLength(1);
});

// ---------- R-206: 차트 글자 12px 이상 (320px 포함) ----------

test('차트 글자는 어느 폭에서나 실제 화면에서 12px 이상이다 (R-206): 320·360·1280, 모든 슬라이드의 모든 SVG 글자', async ({ page }, testInfo) => {
  test.setTimeout(60_000);
  const mobile = testInfo.project.name === 'mobile-360';
  for (const w of mobile ? [320, 360] : [1280]) {
    await page.setViewportSize({ width: w, height: mobile ? 740 : 800 });
    await page.goto('/');
    await expect(page.getByTestId('start-birth')).toBeEnabled();
    const n = await slideCount(page);
    let minPx = Infinity;
    let counted = 0;
    for (let i = 0; i < n; i++) {
      await goToSlide(page, i);
      const fonts = await page.evaluate(() => {
        const svg = document.querySelector('.slide.is-active svg.chart') as SVGSVGElement;
        const scale = svg.getBoundingClientRect().width / svg.viewBox.baseVal.width; // viewBox 한 칸이 화면에서 몇 px인가
        return { id: document.querySelector('.slide.is-active')!.getAttribute('data-slide-id'), scale, sizes: [...svg.querySelectorAll('text')].map((t) => parseFloat(getComputedStyle(t).fontSize) * scale) };
      });
      expect(fonts.sizes.length, `${fonts.id}: 그래프에 글자가 있다`).toBeGreaterThan(1);
      // 그래프 좌표계가 화면 폭과 같다: 1칸 ≈ 1px (4px 단위 내림이라 1.00~1.02)
      expect(fonts.scale, `${w}px ${fonts.id}: 좌표계 폭이 그려지는 폭과 어긋났다`).toBeGreaterThanOrEqual(0.99);
      expect(fonts.scale).toBeLessThanOrEqual(1.03);
      for (const px of fonts.sizes) {
        minPx = Math.min(minPx, px);
        counted++;
        expect(px, `${w}px ${fonts.id}: 차트 글자 ${px.toFixed(2)}px`).toBeGreaterThanOrEqual(12);
      }
    }
    expect(counted, '글자를 실제로 잰 개수(공허 통과 방지)').toBeGreaterThan(100);
    expect(minPx).toBeGreaterThanOrEqual(12);
  }
});

// ---------- R-207: 막대 그래프 값 표 ----------

test('막대 그래프(시·도별)의 값은 시각적으로 숨긴 표로도 읽힌다 (R-207): 16개·17개 값 전부, 큰 값부터, 단위 포함, 화면에는 보이지 않는다', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('start-birth')).toBeEnabled();
  for (const [id, rows] of [['region-population-registered', 16], ['tfr-by-sido', 17]] as const) {
    const index = await page.evaluate((target) => [...document.querySelectorAll('[data-testid="stat-slide"]')].findIndex((s) => s.getAttribute('data-slide-id') === target), id);
    await goToSlide(page, index);
    const slide = page.locator('.slide.is-active');
    const table = slide.getByRole('table'); // 접근성 트리에 표로 있다(보조기기가 읽는다)
    await expect(table).toHaveCount(1);
    await expect(table.locator('caption')).toContainText('큰 값부터');
    expect(await table.locator('tbody tr').count(), id).toBe(rows);
    const cells = await table.locator('tbody tr').evaluateAll((trs) => trs.map((tr) => ({ label: tr.querySelector('th')!.textContent!, value: tr.querySelector('td')!.textContent! })));
    for (const c of cells) expect(c.value, `${id} ${c.label}`).toMatch(/^[\d,.]+명$/);
    const nums = cells.map((c) => Number(c.value.replace(/[^\d.]/g, '')));
    expect([...nums].sort((a, b) => b - a), `${id}: 큰 값부터`).toEqual(nums);
    expect(new Set(cells.map((c) => c.label)).size, `${id}: 이름이 모두 다르다`).toBe(rows);
    // 화면에는 보이지 않는다: 1px 상자로 잘려 있고 그래프의 글자와 겹쳐 보이지 않는다
    const box = await slide.getByTestId('chart-table').evaluate((el) => {
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      return { w: r.width, h: r.height, clip: cs.clip, overflow: cs.overflow };
    });
    expect(box.w).toBeLessThanOrEqual(1);
    expect(box.h).toBeLessThanOrEqual(1);
  }
  // 선 그래프 슬라이드에는 표가 없다
  await goToSlide(page, 0);
  await expect(page.locator('.slide.is-active').getByTestId('chart-table')).toHaveCount(0);
});

// ---------- R-215: 옛 화면의 전역 규칙이 첫 화면에 새지 않는다 ----------

test('스타일 새어 듦(R-215): 첫 화면의 그래프 막대는 의도한 높이이고(옛 인생 화면의 .bar 규칙이 새지 않는다), 옛 화면(출생·인생)의 제목·버튼·상태 막대는 그대로다', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('start-birth')).toBeEnabled();
  const index = await page.evaluate(() => [...document.querySelectorAll('[data-testid="stat-slide"]')].findIndex((s) => s.getAttribute('data-slide-id') === 'region-population-registered'));
  await goToSlide(page, index);
  const bars = await page.evaluate(() =>
    [...document.querySelectorAll<SVGRectElement>('.slide.is-active svg rect')].map((r) => ({ attr: Number(r.getAttribute('height')), box: r.getBoundingClientRect().height, scale: r.ownerSVGElement!.getBoundingClientRect().width / r.ownerSVGElement!.viewBox.baseVal.width })),
  );
  expect(bars.length).toBe(16);
  for (const b of bars) expect(b.box, `막대 높이: 의도 ${b.attr}px(×${b.scale.toFixed(2)})인데 ${b.box.toFixed(1)}px`).toBeCloseTo(b.attr * b.scale, 0);
  // 첫 화면의 제목(h1)·버튼은 옛 화면용 전역 크기·색을 받지 않는다
  const first = await page.evaluate(() => ({
    h1: getComputedStyle(document.querySelector('.title-page h1')!).fontSize,
    pageFont: getComputedStyle(document.querySelector('.title-page')!).fontSize,
    btnBg: getComputedStyle(document.querySelector('[data-testid="start-birth"]')!).backgroundColor,
    btnRadius: getComputedStyle(document.querySelector('[data-testid="start-birth"]')!).borderTopLeftRadius,
  }));
  expect(first.h1, '첫 화면 h1은 본문 크기를 물려받는다(옛 화면의 2rem·2.5rem이 아니다)').toBe(first.pageFont);
  expect(first.btnRadius).toBe('10px'); // --r-md (옛 button은 8px)
  expect(first.btnBg).not.toBe('rgb(58, 58, 58)'); // 옛 button의 #3a3a3a가 아니라 토큰의 쪽빛

  // 옛 화면 회귀 없음: 출생 화면의 제목·버튼 / 인생 화면의 상태 막대
  const vw = page.viewportSize()!.width;
  await injectSave(page, birthState(KNOWN_SEED, 'present', 3, 50));
  await expect(page.getByTestId('birth-screen')).toBeVisible();
  const birth = await page.evaluate(() => {
    const btn = getComputedStyle(document.querySelector('[data-testid="next-life"]')!);
    return { h1: getComputedStyle(document.querySelector('[data-testid="birth-name"]')!).fontSize, bg: btn.backgroundColor, minH: btn.minHeight, radius: btn.borderTopLeftRadius, color: btn.color };
  });
  expect(birth.h1).toBe(vw >= 768 ? '40px' : '32px'); // 2rem / 768px 이상 2.5rem
  expect(birth.bg).toBe('rgb(58, 58, 58)');
  expect(birth.color).toBe('rgb(255, 255, 255)');
  expect(birth.minH).toBe('44px');
  expect(birth.radius).toBe('8px');
  await injectSave(page, lifeState(KNOWN_SEED), '/', { speed: 1, autoMode: false });
  await expect(page.getByTestId('life-screen')).toBeVisible();
  const meter = await page.evaluate(() => {
    const bar = document.querySelector('.stats .bar')!;
    const cs = getComputedStyle(bar);
    return { h: cs.height, bg: cs.backgroundColor, radius: cs.borderTopLeftRadius };
  });
  expect(meter).toEqual({ h: '6px', bg: 'rgb(221, 216, 204)', radius: '3px' });
});

// ---------- FS7: 푸터 ----------

test('푸터(FS7): 이름 통계 출처·통계 출처 기관·가상 인구 설명·빌드 버전이 있고 360·320px에서 넘치거나 잘리지 않는다', async ({ page }, testInfo) => {
  for (const w of testInfo.project.name === 'mobile-360' ? [360, 320] : [1280]) {
    await page.setViewportSize({ width: w, height: 740 });
    await page.goto('/');
    const foot = page.getByTestId('title-foot');
    await foot.scrollIntoViewIfNeeded();
    await expect(page.getByTestId('names-credit')).toContainText('대한민국 법원 전자가족관계등록시스템');
    await expect(page.getByTestId('stats-credit')).toContainText('국가데이터처');
    await expect(page.getByTestId('stats-credit')).toContainText('행정안전부');
    await expect(page.getByTestId('population-info')).toContainText('가상 인구');
    await expect(page.getByTestId('build-version')).toHaveText(/^v\d+\.\d+\.\d+ \(([0-9a-f]{7}\+?|개발 빌드)\)$/); // 「+」: 커밋 안 된 변경이 있는 로컬 빌드(QM2-7)
    const fits = await page.evaluate(() =>
      [...document.querySelectorAll<HTMLElement>('[data-testid="title-foot"] > p')].map((p) => {
        const r = p.getBoundingClientRect();
        return { left: r.left, right: r.right, vw: document.documentElement.clientWidth, scrollW: p.scrollWidth, clientW: p.clientWidth, font: parseFloat(getComputedStyle(p).fontSize) };
      }),
    );
    for (const f of fits) {
      expect(f.left).toBeGreaterThanOrEqual(0);
      expect(f.right).toBeLessThanOrEqual(f.vw);
      expect(f.scrollW).toBeLessThanOrEqual(f.clientW);
      expect(f.font, '출처·주석은 12px 이상').toBeGreaterThanOrEqual(12);
    }
    expect(await noHorizontalOverflow(page)).toBe(true);
  }
});

// ---------- FS8·CM3: 외부 요청 0 ----------

test('외부 요청 0건(FS8·CM3): 첫 화면 로드·캐러셀 전부 훑기·선택·태어나기까지 같은 출처(localhost) 밖으로 나가는 요청이 없다', async ({ page }) => {
  const requests: string[] = [];
  page.on('request', (r) => requests.push(r.url()));
  await page.goto('/');
  await expect(page.getByTestId('start-birth')).toBeEnabled();
  const n = await slideCount(page);
  for (let i = 0; i < n; i++) await page.getByTestId('carousel-next').click();
  await chooseEra(page, 'future');
  await chooseLifeLength(page, 'short30');
  await pressBegin(page);
  await expect(page.getByTestId('birth-screen')).toBeVisible();
  const origin = new URL(page.url()).origin;
  const outside = requests.filter((u) => {
    if (u.startsWith('data:') || u.startsWith('blob:')) return false;
    const url = new URL(u);
    return !(url.origin === origin || (url.protocol === 'ws:' && url.host === new URL(origin).host));
  });
  expect(outside, `외부로 나가는 요청: ${outside.join(', ')}`).toEqual([]);
  expect(requests.length).toBeGreaterThan(3); // 공허 통과 방지: 요청이 실제로 기록됐다
});

// ---------- C3: 이어하기 ----------

test('이어하기(FS6·C3): 진행 중인 판이 있는 채 첫 화면을 다시 열면 「이어서 살기」가 기본 버튼, 「새로 태어나기」는 보조. 첫 화면이 떠 있는 동안 인생이 흐르지 않고, 새로고침하면 저장된 화면이 복원된다', async ({ page }) => {
  await injectSave(page, lifeState(KNOWN_SEED), '/?__exit=1&__timescale=2000', { speed: 8, autoMode: true }); // 자동 모드·아주 빠른 시간: 인생이 흐른다면 금방 변한다
  await expect(page.getByTestId('title-screen')).toBeVisible();
  await expect(page.getByTestId('resume')).toBeVisible();
  await expect(page.getByTestId('begin-new')).toBeVisible();
  await expect(page.getByTestId('start-birth')).toHaveCount(0);
  await expect(page.getByTestId('resume')).toHaveText('이어서 살기');
  await expect(page.getByTestId('begin-new')).toHaveText('새로 태어나기');
  // 기본 버튼이 위(주), 보조가 아래 — 둘 다 화면 안, 같은 하단 띠
  const [r1, r2] = await page.evaluate(() => ['resume', 'begin-new'].map((id) => document.querySelector(`[data-testid="${id}"]`)!.getBoundingClientRect().toJSON()));
  expect(r1.top).toBeLessThan(r2.top);
  expect(r2.bottom).toBeLessThanOrEqual(page.viewportSize()!.height + 0.5);
  expect(r1.width).toBeGreaterThan(r2.width);
  // 인생이 흐르지 않는다: 1.5초 뒤에도 저장의 나이·연표가 그대로다
  await page.waitForTimeout(1500);
  const held = (await readSave(page)).data;
  expect(held.age).toBe(0);
  expect(held.history).toEqual(lifeState(KNOWN_SEED).history);
  // 이어서 살기 → 저장된 인생 화면, 이제 인생이 흐른다
  await page.getByTestId('resume').click();
  await expect(page.getByTestId('life-screen')).toBeVisible();
  await expect.poll(async () => (await readSave(page)).data.age, { timeout: 20_000 }).toBeGreaterThan(0);
  // 첫 화면은 저장되는 단계가 아니다: 다시 연 뒤 탐침 없이 새로고침하면 저장된 화면이 그대로 복원된다
  expect((await readSave(page)).data.phase).toBe('life');
  await page.goto('/?__exit=1&__timescale=0.001');
  await expect(page.getByTestId('resume')).toBeVisible();
  await page.goto('/');
  await expect(page.getByTestId('life-screen')).toBeVisible();
  await expect(page.getByTestId('title-screen')).toHaveCount(0);
});

test('입력 가드: 첫 화면이 막 떴을 때(진입 가드가 닫혀 있는 동안)의 클릭은 세상·인생 길이 선택과 캐러셀 버튼을 바꾸지 않고, 가드가 풀리면 정상 동작한다 (R-014·R-030 방식)', async ({ page }) => {
  await page.goto('/?__guard=600000'); // 개발 서버 전용 탐침: 진입 가드가 사실상 풀리지 않는다 = 「막 떴을 때」가 계속된다
  await expect(page.getByTestId('title-screen')).toBeVisible();
  await expect(page.getByTestId('start-birth')).toHaveAttribute('aria-disabled', 'true');
  const labelFor = (testId: string) => page.getByTestId(testId).locator('xpath=ancestor::label');
  for (const id of ['era-past', 'era-future']) { // (인생 길이 「약 1시간」은 준비 중이라 가드와 무관하게 선택되지 않는다 — 위 FS5 테스트)
    await labelFor(id).scrollIntoViewIfNeeded();
    const box = (await labelFor(id).boundingBox())!;
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  }
  await expect(page.getByTestId('era-present')).toBeChecked();
  await expect(page.getByTestId('life-short30')).toBeChecked();
  const n = await slideCount(page);
  await page.getByTestId('carousel-next').click({ force: true });
  await page.getByTestId('carousel-prev').click({ force: true });
  expect(await countText(page)).toBe(`1 / ${n}`);
  await page.getByTestId('start-birth').click({ force: true });
  await expect(page.getByTestId('birth-screen')).toHaveCount(0);
  expect((await readSettings(page)).era).toBe('present');
  // 가드가 정상 시간(400ms)이면 같은 클릭이 선택을 바꾼다
  await page.goto('/');
  await expect(page.getByTestId('start-birth')).toBeEnabled();
  await labelFor('era-future').click();
  await expect(page.getByTestId('era-future')).toBeChecked();
});

test('이어하기: 출생 화면(진행 있음)에서 다시 연 첫 화면도 「이어서 살기」로 출생 화면에 돌아간다', async ({ page }) => {
  await injectSave(page, birthState(KNOWN_SEED, 'past', 2, 40), '/?__exit=1');
  await expect(page.getByTestId('resume')).toBeVisible();
  await page.getByTestId('resume').click();
  await expect(page.getByTestId('birth-screen')).toBeVisible();
  await expect(page.getByTestId('birth-name')).toHaveText('김민준');
});

test('새로 태어나기(FS6): 누르면 이전 판이 사라진다는 확인이 뜨고, 「돌아가기」·Esc로 닫을 수 있으며, 확인하면 새 시드로 설정의 세상·인생 길이로 태어난다 (연타도 한 번)', async ({ page }) => {
  const old = lifeState(KNOWN_SEED);
  await injectSave(page, old, '/?__exit=1', { speed: 1, autoMode: false, era: 'future', lifeLength: 'short30' });
  await expect(page.getByTestId('begin-new')).toBeEnabled();
  await page.getByTestId('begin-new').click();
  await expect(page.getByTestId('confirm-new-ask')).toHaveText('이전 판이 사라집니다. 새로 태어날까요?');
  await expect(page.getByTestId('confirm-new-no')).toBeFocused(); // 안전한 쪽에 포커스
  await expect(page.getByTestId('resume')).toHaveCount(0);
  // 아직 아무것도 바뀌지 않았다
  expect((await readSave(page)).data.seed).toBe(KNOWN_SEED);
  // 돌아가기
  await page.getByTestId('confirm-new-no').click();
  await expect(page.getByTestId('resume')).toBeVisible();
  await expect(page.getByTestId('confirm-new-ask')).toHaveCount(0);
  // Esc로도 닫힌다
  await page.getByTestId('begin-new').click();
  await expect(page.getByTestId('confirm-new-ask')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('confirm-new-ask')).toHaveCount(0);
  expect((await readSave(page)).data.seed).toBe(KNOWN_SEED);
  // 확인: 연타해도 새 판은 하나
  await page.getByTestId('begin-new').click();
  const yes = page.getByTestId('confirm-new-yes');
  await expect(yes).toBeEnabled();
  await rapidInput(page, 'mouse3', yes);
  await expect(page.getByTestId('birth-screen')).toBeVisible();
  const born = (await readSave(page)).data;
  expect(born.phase).toBe('birth');
  expect(born.seed).not.toBe(KNOWN_SEED);
  expect(born.era).toBe('future');
  expect(born.lifeLength).toBe('short30');
  expect(JSON.stringify(born)).not.toContain(old.character!.name);
  await expect(page.getByTestId('next-life')).toBeEnabled();
  await expect(page.getByTestId('birth-screen')).toBeVisible();
});

// ---------- C6: 이전 버전 저장 ----------

test('이전 버전(v4) 저장은 새 게임으로 시작하고 첫 화면에 안내 한 줄이 한 번 뜬다. 설정(배속·자동 모드)은 그대로다', async ({ page }) => {
  await page.addInitScript(
    ([gameKey, settingsKey]) => {
      if (localStorage.getItem(gameKey) === null) {
        const stats = { wealth: 45, education: 6, health: 70, happiness: 52, relationships: 54 };
        const v4 = { phase: 'life', era: 'present', character: { name: '김민준', gender: 'male', birthYear: 2012, parentWealth: 3, parenting: 'free', looks: 50 }, stats, birthStats: stats, age: 0, history: [], flags: [], seen: {}, pending: null, lastChoiceAge: null, death: null, seed: 5, rngState: 5 };
        localStorage.setItem(gameKey, JSON.stringify({ version: 4, data: v4 }));
        localStorage.setItem(settingsKey, JSON.stringify({ version: 1, data: { speed: 4, autoMode: true } })); // 이전 버전의 설정
      }
    },
    ['suzeo-game:save', SETTINGS_KEY] as const,
  );
  await page.goto('/');
  await expect(page.getByTestId('title-screen')).toBeVisible();
  await expect(page.getByTestId('old-save-notice')).toHaveText('이전 버전에서 저장된 판은 이어서 할 수 없어 새 게임으로 시작합니다.');
  await expect(page.getByTestId('resume')).toHaveCount(0); // 새 게임이라 이어하기가 없다
  const save = await readSave(page);
  expect(save.version).toBe(5);
  expect(save.data.phase).toBe('title');
  expect(save.data.seed).not.toBe(5);
  // 설정은 유지(v1 → v2로 올라가며 새 필드는 기본값)
  expect(await readSettings(page)).toEqual({ speed: 4, autoMode: true, era: 'present', lifeLength: 'short30' });
  // 태어나면 안내가 사라지고, 새로고침해도 다시 뜨지 않는다
  await pressBegin(page);
  await expect(page.getByTestId('birth-screen')).toBeVisible();
  await page.reload();
  await expect(page.getByTestId('birth-screen')).toBeVisible();
  await expect(page.getByTestId('old-save-notice')).toHaveCount(0);
});

test('안내는 이전 저장이 없을 때(처음 연 사용자)·손상된 저장일 때는 뜨지 않는다', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('title-screen')).toBeVisible();
  await expect(page.getByTestId('old-save-notice')).toHaveCount(0);
  await page.evaluate((k) => localStorage.setItem(k, '{"version":4,"data":{'), 'suzeo-game:save');
  await page.reload();
  await expect(page.getByTestId('title-screen')).toBeVisible();
  await expect(page.getByTestId('old-save-notice')).toHaveCount(0); // 손상 저장은 버전을 알 수 없다
});

// ---------- CM4: 키보드·접근성 ----------

test('키보드(CM4): Tab 순서는 제목 → 세상 → 인생 길이 → 캐러셀(머리의 이전·다음·일시정지 → 슬라이드) → 출처 링크 → 「태어나기」, 모든 컨트롤에 포커스 링이 있고 Enter로 태어난다', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('start-birth')).toBeEnabled();
  expect(await page.evaluate(() => document.activeElement?.tagName)).toBe('H1');
  const stops: string[] = [];
  for (let i = 0; i < 40; i++) {
    await page.keyboard.press('Tab');
    const id = await activeTestId(page);
    stops.push(id);
    if (id === 'start-birth') break;
  }
  expect(stops[stops.length - 1], `Tab 정지점: ${stops.join(' → ')}`).toBe('start-birth');
  // 조작 줄(이전·다음·일시정지)이 카드 머리로 옮겨져(R-200) 슬라이드 영역보다 먼저 닿는다 — 이 순서가 바뀐 이유는 ai-log dev-M2-r2. APG 캐러셀도 회전 제어를 슬라이드보다 앞에 두기를 권한다.
  const expected = ['era-present', 'life-short30', 'carousel-prev', 'carousel-next', 'carousel-pause', 'carousel-viewport', 'A', 'start-birth'];
  expect(stops).toEqual(expected);
  // 포커스 링: 하단 버튼은 :focus-visible 링(3px 이상), 화면 안에 있다
  const ring = await page.evaluate(() => {
    const el = document.activeElement as HTMLElement;
    const cs = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    return { outlineStyle: cs.outlineStyle, outlineWidth: parseFloat(cs.outlineWidth), inView: r.top >= 0 && r.bottom <= innerHeight };
  });
  expect(ring.outlineStyle).toBe('solid');
  expect(ring.outlineWidth).toBeGreaterThanOrEqual(3);
  expect(ring.inView).toBe(true);
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('birth-screen')).toBeVisible();
  await expect.poll(() => page.evaluate(() => document.activeElement?.getAttribute('data-testid'))).toBe('birth-name');
});

test('버튼·카드의 접근 가능한 이름: 라디오는 카드 글, 캐러셀 버튼은 한국어 이름, 로고는 장식', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('radio', { name: /지금 세상/ })).toBeChecked();
  await expect(page.getByRole('radio', { name: /약 30분/ })).toBeChecked();
  await expect(page.getByRole('button', { name: '이전 지표' })).toBeVisible();
  await expect(page.getByRole('button', { name: '다음 지표' })).toBeVisible();
  await expect(page.getByRole('button', { name: '자동 넘김 일시정지' })).toBeVisible();
  await expect(page.getByRole('region', { name: '한국 사회 통계 캐러셀' })).toBeVisible();
  // 이름 없는 버튼이 없다
  const unnamed = await page.evaluate(() => [...document.querySelectorAll('.title-page button')].filter((b) => !(b.getAttribute('aria-label') ?? b.textContent ?? '').trim()).length);
  expect(unnamed).toBe(0);
  // 장식(로고·아이콘 스프라이트)은 보조기기에서 숨겨져 있다
  expect(await page.locator('[data-testid^="title-logo"][aria-hidden="true"]').count()).toBe(2);
});

// ---------- 다크·강제 색상·스크린샷 ----------

test.describe('색 구성표(DB6 기반·CM4)', () => {
  test('다크: 시스템 설정을 따른다 — 바탕·글자·버튼·로고가 다크 토큰이고 가로 넘침·가림이 없다. 출생 화면 이후(옛 화면)는 아직 라이트다', async ({ page }, testInfo) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.goto('/');
    await expect(page.getByTestId('title-screen')).toBeVisible();
    const c = await page.evaluate(() => {
      const css = (el: Element, prop: string) => getComputedStyle(el).getPropertyValue(prop) || (getComputedStyle(el) as unknown as Record<string, string>)[prop];
      const logoPath = document.querySelector(`[data-testid="${innerWidth >= 960 ? 'title-logo-row' : 'title-logo-stacked'}"] svg path`)!;
      return {
        body: getComputedStyle(document.body).backgroundColor,
        page: getComputedStyle(document.querySelector('.title-page')!).backgroundColor,
        text: getComputedStyle(document.querySelector('.hero__pop')!).color,
        btnBg: getComputedStyle(document.querySelector('[data-testid="start-birth"]')!).backgroundColor,
        btnText: getComputedStyle(document.querySelector('[data-testid="start-birth"]')!).color,
        card: getComputedStyle(document.querySelector('.carousel')!).backgroundColor,
        logo: getComputedStyle(logoPath).fill,
        scheme: css(document.documentElement, 'color-scheme'),
      };
    });
    const dark = await tokenColors(page, 'dark');
    expect(c.body, 'body 바탕 = --c-bg 다크').toBe(dark('--c-bg'));
    expect(c.page).toBe(dark('--c-bg'));
    expect(c.card, '카드 = --c-surface 다크').toBe(dark('--c-surface'));
    expect(c.text, '글자 = --c-text 다크').toBe(dark('--c-text'));
    expect(c.btnBg, '주요 버튼 = --c-brand 다크').toBe(dark('--c-brand'));
    expect(c.btnText).toBe(dark('--c-on-brand'));
    expect(c.logo, '로고 = --c-logo 다크(크림색)').toBe(dark('--c-logo'));
    expect(dark('--c-bg'), '다크 바탕은 라이트 바탕과 다르다(공허 통과 방지)').not.toBe((await tokenColors(page, 'light'))('--c-bg'));
    expect(await noHorizontalOverflow(page)).toBe(true);
    await expect(page.getByTestId('start-birth')).toBeEnabled(); // 입력 가드가 풀려 버튼이 흐리지 않은 모습으로 찍는다
    await page.screenshot({ path: `${SHOTS}/dev-M2-title-${projectKey(testInfo.project.name)}-dark.png` });
    // 옛 화면은 아직 라이트 디자인: 출생 화면의 바탕이 라이트다 (M3·M4에서 새 디자인으로 바뀐다).
    // R-223: body 바탕은 토큰이라 옛 화면은 LegacyLight가 건 <html data-theme="light">로 라이트 토큰(--c-bg)을 받는다(예전에는 고정 색 #f5f2ec였다).
    await pressBegin(page);
    await expect(page.getByTestId('birth-screen')).toBeVisible();
    expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe((await tokenColors(page, 'light'))('--c-bg'));
    expect(await page.evaluate(() => getComputedStyle(document.body).color), '글자색도 라이트 토큰').toBe((await tokenColors(page, 'light'))('--c-text'));
    expect(await page.evaluate(() => document.body.classList.contains('theme-surface'))).toBe(false);
  });

  test('라이트: 바탕·버튼·로고가 라이트 토큰이다', async ({ page }, testInfo) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await page.goto('/');
    await expect(page.getByTestId('title-screen')).toBeVisible();
    const c = await page.evaluate(() => ({
      body: getComputedStyle(document.body).backgroundColor,
      btnBg: getComputedStyle(document.querySelector('[data-testid="start-birth"]')!).backgroundColor,
      btnText: getComputedStyle(document.querySelector('[data-testid="start-birth"]')!).color,
      logo: getComputedStyle(document.querySelector(`[data-testid="${innerWidth >= 960 ? 'title-logo-row' : 'title-logo-stacked'}"] svg path`)!).fill,
    }));
    const light = await tokenColors(page, 'light');
    expect(c.body).toBe(light('--c-bg'));
    expect(c.btnBg).toBe(light('--c-brand'));
    expect(c.btnText).toBe(light('--c-on-brand'));
    expect(c.logo).toBe(light('--c-logo'));
    await expect(page.getByTestId('start-birth')).toBeEnabled(); // 입력 가드가 풀려 버튼이 흐리지 않은 모습으로 찍는다
    await page.screenshot({ path: `${SHOTS}/dev-M2-title-${projectKey(testInfo.project.name)}.png` });
    if (testInfo.project.name === 'mobile-360') await page.screenshot({ path: `${SHOTS}/dev-M2-title-mobile-full.png`, fullPage: true });
  });

  test('강제 색상(고대비): 선택된 카드는 이중 테두리, 주요 버튼은 굵은 테두리, 로고는 시스템 글자색 — 색이 아니라 모양으로 구분된다', async ({ page }, testInfo) => {
    await page.emulateMedia({ forcedColors: 'active' });
    await page.goto('/');
    await expect(page.getByTestId('title-screen')).toBeVisible();
    const s = await page.evaluate(() => {
      const card = (id: string) => getComputedStyle(document.querySelector(`[data-testid="${id}"]`)!.closest('.radio-card')!);
      const btn = getComputedStyle(document.querySelector('[data-testid="start-birth"]')!);
      const logo = document.querySelector(`[data-testid="${innerWidth >= 960 ? 'title-logo-row' : 'title-logo-stacked'}"] svg path`)!;
      return {
        selected: card('era-present').borderTopStyle,
        plain: card('era-past').borderTopStyle,
        selectedWidth: parseFloat(card('era-present').borderTopWidth),
        btnBorder: btn.borderTopStyle,
        btnWidth: parseFloat(btn.borderTopWidth),
        logoFill: getComputedStyle(logo).fill,
        bodyBg: getComputedStyle(document.body).backgroundColor,
      };
    });
    expect(s.selected).toBe('double');
    expect(s.plain).toBe('solid');
    expect(s.selectedWidth).toBeGreaterThanOrEqual(3);
    expect(s.btnBorder).toBe('solid');
    expect(s.btnWidth).toBeGreaterThanOrEqual(3);
    expect(s.logoFill, '로고가 보인다(투명이 아니다)').not.toBe('rgba(0, 0, 0, 0)');
    expect(await noHorizontalOverflow(page)).toBe(true);
    await expect(page.getByTestId('start-birth')).toBeEnabled(); // 입력 가드가 풀려 버튼이 흐리지 않은 모습으로 찍는다
    if (testInfo.project.name === 'mobile-360') await page.screenshot({ path: `${SHOTS}/dev-M2-title-mobile-forced.png` });
  });

  test('이어하기 화면 스크린샷(시안 title-continue와 비교용)', async ({ page }, testInfo) => {
    await injectSave(page, lifeState(KNOWN_SEED), '/?__exit=1', { speed: 1, autoMode: false });
    await expect(page.getByTestId('resume')).toBeVisible();
    await expect(page.getByTestId('resume')).toBeEnabled();
    await page.screenshot({ path: `${SHOTS}/dev-M2-continue-${projectKey(testInfo.project.name)}.png` });
    await page.getByTestId('begin-new').click();
    await expect(page.getByTestId('confirm-new-ask')).toBeVisible();
    await expect(page.getByTestId('confirm-new-yes')).toBeEnabled();
    await page.screenshot({ path: `${SHOTS}/dev-M2-continue-confirm-${projectKey(testInfo.project.name)}.png` });
  });

  test('슬라이드 스크린샷: 자살률(상담전화 안내)·지역 인구(막대)·초혼 연령(두 계열)', async ({ page }, testInfo) => {
    await page.goto('/');
    await expect(page.getByTestId('start-birth')).toBeEnabled();
    for (const [id, name] of [['suicide-rate', 'suicide'], ['region-population-registered', 'region'], ['first-marriage-age', 'marriage-age']] as const) {
      const index = await page.evaluate((target) => [...document.querySelectorAll('[data-testid="stat-slide"]')].findIndex((s) => s.getAttribute('data-slide-id') === target), id);
      await goToSlide(page, index);
      await page.waitForTimeout(300);
      await page.getByTestId('carousel').screenshot({ path: `${SHOTS}/dev-M2-slide-${name}-${projectKey(testInfo.project.name)}.png` });
    }
  });
});

test('저장 변경 후 다른 화면에서 돌아와도 선택이 유지된다(다시 태어나기 뒤) — 설정 키는 게임 저장과 독립이다', async ({ page }) => {
  await injectSave(page, titleState(KNOWN_SEED), '/', { speed: 2, autoMode: false, era: 'past', lifeLength: 'short30' });
  await expect(page.getByTestId('era-past')).toBeChecked();
  await expect(page.getByTestId('life-short30')).toBeChecked();
  // 게임 저장만 지워도(새 판) 선택은 남는다
  await replaceSaveAndReload(page, titleState(KNOWN_SEED + 1));
  await expect(page.getByTestId('era-past')).toBeChecked();
  await expect(page.getByTestId('life-short30')).toBeChecked();
  expect((await readSettings(page)).speed).toBe(2);
});

// ---------- R-204: 「새로 태어나기」 확인 단계의 자리 배치와 가드 (R-050 방식: 겹침을 측정하고, 가드를 끈 대조군으로 가른다) ----------

/** 두 상자의 겹치는 넓이(px²) */
const overlapArea = (a: { x: number; y: number; width: number; height: number }, b: { x: number; y: number; width: number; height: number }): number => {
  const w = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
  const h = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
  return w > 0 && h > 0 ? w * h : 0;
};

test('확인 단계 자리(R-204, 측정): 이전 판을 지우는 「새로 태어나기」 확인은 보조 버튼 「새로 태어나기」가 있던 자리와 겹치지 않고, 그 자리에는 안전한 「돌아가기」가 놓인다', async ({ page }) => {
  await openBarState(page, 'continue');
  await expect(page.getByTestId('begin-new')).toBeEnabled();
  const beginNew = (await page.getByTestId('begin-new').boundingBox())!; // 눌리기 전, 보조 버튼의 자리
  await page.getByTestId('begin-new').click();
  await expect(page.getByTestId('confirm-new-ask')).toBeVisible();
  const yes = (await page.getByTestId('confirm-new-yes').boundingBox())!;
  const no = (await page.getByTestId('confirm-new-no').boundingBox())!;
  expect(overlapArea(beginNew, yes), `확정 버튼(${Math.round(yes.x)},${Math.round(yes.y)} ${Math.round(yes.width)}x${Math.round(yes.height)})이 보조 버튼 자리(${Math.round(beginNew.x)},${Math.round(beginNew.y)} ${Math.round(beginNew.width)}x${Math.round(beginNew.height)})와 겹친다`).toBe(0);
  expect(overlapArea(beginNew, no), '보조 버튼 자리는 「돌아가기」가 덮는다(둘째 입력이 떨어질 곳)').toBeGreaterThan(beginNew.width * beginNew.height * 0.99);
  // 보조 버튼 한가운데를 다시 누르면 맞는 것은 「돌아가기」다
  const cx = beginNew.x + beginNew.width / 2;
  const cy = beginNew.y + beginNew.height / 2;
  expect(await page.evaluate(([x, y]) => document.elementFromPoint(x, y)?.closest('[data-testid]')?.getAttribute('data-testid'), [cx, cy])).toBe('confirm-new-no');
  // 확정 버튼은 위 줄, 돌아가기는 맨 아래 줄 — 같은 줄에 나란히 있지 않다
  expect(yes.y + yes.height).toBeLessThanOrEqual(no.y);
});

test('확인 단계 가드(R-204): 「새로 태어나기」를 더블탭해도(둘째 입력이 확인 단계에 떨어져도) 이전 판은 지워지지 않고 확인 단계가 그대로 남는다. 가드를 끈 대조군에서는 둘째 입력이 「돌아가기」에 떨어져 닫힌다', async ({ page }) => {
  for (const method of ['dblclick', 'mouse3', 'human150'] as const) {
    await openBarState(page, 'continue', KNOWN_SEED + 7);
    const beginNew = page.getByTestId('begin-new');
    await expect(beginNew).toBeEnabled();
    await rapidInput(page, method, beginNew);
    // 확인 단계가 떴고(첫 입력), 둘째 이후의 입력은 가드에 막혀 확인 단계는 그대로다 — 새 판도 시작되지 않는다
    await expect(page.getByTestId('confirm-new-ask'), method).toBeVisible();
    await expect(page.getByTestId('confirm-new-yes')).toHaveAttribute('aria-disabled', 'true');
    await expect(page.getByTestId('confirm-new-no')).toHaveAttribute('aria-disabled', 'true');
    await expect(page.getByTestId('title-screen')).toBeVisible();
    await expect(page.getByTestId('birth-screen')).toHaveCount(0);
    expect((await readSave(page)).data.seed, `${method}: 이전 판(시드)이 그대로다`).toBe(KNOWN_SEED + 7);
    expect((await readSave(page)).data.phase).toBe('life');
    // 가드(표준 0.4초)가 풀리면 두 버튼 모두 정상이다
    await expect(page.getByTestId('confirm-new-yes')).toBeEnabled();
    await expect(page.getByTestId('confirm-new-no')).toBeEnabled();
  }
  // 대조군: 가드를 끄면(?__guard=0, 개발 서버 전용) 같은 더블탭의 둘째 입력이 같은 자리의 「돌아가기」에 떨어져 확인 단계가 닫힌다 — 가드가 실제로 둘째 입력을 막고 있었다는 증거.
  // (그리고 확정 버튼은 그 자리가 아니라서 이전 판은 여전히 지워지지 않는다: 자리 분리가 확인 없는 삭제를 막는다.)
  await injectSave(page, lifeState(KNOWN_SEED + 9), '/?__exit=1&__guard=0', { speed: 1, autoMode: false });
  await expect(page.getByTestId('begin-new')).toBeVisible();
  await rapidInput(page, 'mouse2', page.getByTestId('begin-new')); // 두 번: 첫째가 확인 단계를 열고, 둘째가 같은 자리의 「돌아가기」를 누른다
  await expect(page.getByTestId('resume')).toBeVisible(); // 둘째 입력이 「돌아가기」를 눌러 닫혔다
  await expect(page.getByTestId('confirm-new-ask')).toHaveCount(0);
  expect((await readSave(page)).data.seed).toBe(KNOWN_SEED + 9);
  expect((await readSave(page)).data.phase).toBe('life');
  // 대조군 2: 가드가 없으면 확정 버튼은 뜨자마자 눌린다(가드 400ms가 그 사이를 막는다)
  await page.getByTestId('begin-new').click();
  await page.getByTestId('confirm-new-yes').click();
  await expect(page.getByTestId('birth-screen')).toBeVisible();
  // 가드가 있으면 뜨자마자(강제) 누른 확정은 무시된다
  await injectSave(page, lifeState(KNOWN_SEED + 11), '/?__exit=1', { speed: 1, autoMode: false });
  await expect(page.getByTestId('begin-new')).toBeEnabled();
  await page.getByTestId('begin-new').click();
  await expect(page.getByTestId('confirm-new-ask')).toBeVisible();
  await page.getByTestId('confirm-new-yes').click({ force: true });
  await expect(page.getByTestId('confirm-new-ask')).toBeVisible();
  expect((await readSave(page)).data.seed).toBe(KNOWN_SEED + 11);
});

// ---------- R-212: 확인 단계를 닫으면 포커스가 「새로 태어나기」로 돌아간다 ----------

test('확인 단계를 닫으면 포커스가 「새로 태어나기」로 돌아간다 (R-212): 「돌아가기」 버튼·Esc 모두 — 포커스가 body로 빠지지 않는다', async ({ page }) => {
  await openBarState(page, 'continue');
  const beginNew = page.getByTestId('begin-new');
  await expect(beginNew).toBeEnabled();
  await beginNew.click();
  await expect(page.getByTestId('confirm-new-no')).toBeFocused(); // 열리면 안전한 쪽에 포커스
  // Esc
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('confirm-new-ask')).toHaveCount(0);
  await expect(beginNew).toBeFocused();
  expect(await activeTestId(page)).toBe('begin-new');
  // 「돌아가기」 버튼(가드가 풀린 뒤)
  await expect(beginNew).toBeEnabled(); // 다시 그려진 버튼의 입력 가드(0.4초)가 풀린 뒤
  await page.keyboard.press('Enter'); // 포커스된 「새로 태어나기」를 키보드로 다시 연다
  await expect(page.getByTestId('confirm-new-ask')).toBeVisible();
  await expect(page.getByTestId('confirm-new-no')).toBeEnabled();
  await page.getByTestId('confirm-new-no').click();
  await expect(page.getByTestId('confirm-new-ask')).toHaveCount(0);
  await expect(beginNew).toBeFocused();
  // 키보드만으로도: Enter로 열고 Enter로 닫는다 (포커스가 계속 띠 안에 있다)
  await expect(beginNew).toBeEnabled();
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('confirm-new-no')).toBeEnabled();
  await page.keyboard.press('Enter');
  await expect(beginNew).toBeFocused();
});

// ---------- R-208: 옛 화면이 떠 있는 동안 색 구성표 라이트 ----------

test('색 구성표(R-208): 다크 OS에서 첫 화면은 시스템을 따르고(color-scheme·theme-color 다크), 출생 이후의 옛 화면·오류 화면이 떠 있는 동안에는 라이트로 고정된다', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  const scheme = () => page.evaluate(() => getComputedStyle(document.documentElement).colorScheme);
  const metas = () =>
    page.evaluate(() => ({
      scheme: document.querySelector('meta[name="color-scheme"]')!.getAttribute('content'),
      theme: [...document.querySelectorAll('meta[name="theme-color"]')].map((m) => ({ content: m.getAttribute('content'), media: m.getAttribute('media') })),
      dataTheme: document.documentElement.getAttribute('data-theme'),
    }));
  // 첫 화면: 시스템(다크)
  await page.goto('/');
  await expect(page.getByTestId('title-screen')).toBeVisible();
  expect(await scheme()).toBe('dark');
  const systemMetas = await metas();
  expect(systemMetas.scheme).toBe('light dark');
  expect(systemMetas.dataTheme).toBeNull();
  expect(systemMetas.theme.map((t) => t.media)).toEqual(['(prefers-color-scheme: light)', '(prefers-color-scheme: dark)']);
  // 태어나면 옛 화면(출생): 라이트 고정 — 스크롤바·입력 부품·주소 표시줄 색이 본문과 어긋나지 않는다
  await pressBegin(page);
  await expect(page.getByTestId('birth-screen')).toBeVisible();
  expect(await scheme(), '출생 화면은 다크 OS에서도 라이트').toBe('light');
  const legacyMetas = await metas();
  expect(legacyMetas.scheme).toBe('light');
  expect(legacyMetas.dataTheme).toBe('light');
  const legacyBgHex = await tokenHex(page, 'light', '--c-bg');
  for (const t of legacyMetas.theme) {
    expect(t.content, 'theme-color가 옛 화면 바탕색(라이트 --c-bg 토큰)').toBe(legacyBgHex);
    expect(t.media, '다크 OS에서도 같은 색이라 media 조건이 없다').toBeNull();
  }
  expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor), '옛 화면 body 바탕 = 라이트 토큰').toBe((await tokenColors(page, 'light'))('--c-bg'));
  // 인생 화면도
  await expect(page.getByTestId('next-life')).toBeEnabled();
  await page.getByTestId('next-life').click();
  await expect(page.getByTestId('life-screen')).toBeVisible();
  expect(await scheme()).toBe('light');
  // 새로고침해도 저장된 옛 화면은 라이트
  await page.reload();
  await expect(page.getByTestId('life-screen')).toBeVisible();
  expect(await scheme()).toBe('light');
  expect((await metas()).scheme).toBe('light');

  // 첫 화면을 다시 연 상태(이어하기)는 다시 시스템(다크), 「이어서 살기」를 누르면 옛 화면이라 라이트
  await injectSave(page, lifeState(KNOWN_SEED), '/?__exit=1', { speed: 1, autoMode: false });
  await expect(page.getByTestId('resume')).toBeVisible();
  expect(await scheme()).toBe('dark');
  expect((await metas()).dataTheme).toBeNull();
  await expect(page.getByTestId('resume')).toBeEnabled();
  await page.getByTestId('resume').click();
  await expect(page.getByTestId('life-screen')).toBeVisible();
  expect(await scheme()).toBe('light');

  // 오류 화면(옛 화면)도 라이트
  await page.goto('/?__crash=1');
  await expect(page.getByTestId('error-screen')).toBeVisible();
  expect(await scheme()).toBe('light');
  expect((await metas()).theme.every((t) => t.content === legacyBgHex)).toBe(true);
});

// ---------- R-214: 진행 전 단계의 이전 버전 저장에는 안내를 띄우지 않는다 ----------

for (const phase of ['title', 'eraSelect'] as const) {
  test(`이전 버전(v4) 저장이 진행 전 단계(${phase})였으면 안내 없이 새 게임으로 시작한다 (R-214) — 잃은 진행이 없다`, async ({ page }) => {
    await page.addInitScript(
      ([gameKey, p]) => {
        if (localStorage.getItem(gameKey) === null) {
          const stats = { wealth: 50, education: 50, health: 50, happiness: 50, relationships: 50 };
          const v4 = { phase: p, era: null, character: null, stats, birthStats: null, age: 0, history: [], flags: [], seen: {}, pending: null, lastChoiceAge: null, death: null, seed: 5, rngState: 5 };
          localStorage.setItem(gameKey, JSON.stringify({ version: 4, data: v4 }));
        }
      },
      ['suzeo-game:save', phase] as const,
    );
    await page.goto('/');
    await expect(page.getByTestId('title-screen')).toBeVisible();
    await expect(page.getByTestId('old-save-notice')).toHaveCount(0);
    await expect(page.getByTestId('resume')).toHaveCount(0);
    const save = await readSave(page);
    expect(save.version).toBe(5);
    expect(save.data.phase).toBe('title');
    expect(save.data.seed).not.toBe(5); // 새 게임
  });
}

// ---------- 320px 차트 슬라이드 스크린샷 (R-206·R-225 증거) ----------

/**
 * 선 그래프의 글자(text) 상자가 선분·점과 겹치는 것을 센다 — 실제 SVG의 getBBox(글자 상자)와 polyline/점의 좌표로 계산한다(R-225).
 * 돌려주는 값은 겹친 글자 설명 목록(비면 겹침 없음). 글자 뒤 테두리(CSS paint-order)는 상자에 들어가지 않는다.
 */
async function chartTextOverlaps(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const svg = document.querySelector('.slide.is-active svg.chart') as SVGSVGElement;
    type Box = { left: number; top: number; right: number; bottom: number };
    const segs: Array<[number, number, number, number]> = [];
    for (const pl of svg.querySelectorAll('polyline')) {
      for (let k = 1; k < pl.points.numberOfItems; k++) {
        const a = pl.points.getItem(k - 1);
        const b = pl.points.getItem(k);
        segs.push([a.x, a.y, b.x, b.y]);
      }
    }
    const dots: Box[] = [...svg.querySelectorAll('.dot')].map((d) => {
      const b = (d as SVGGraphicsElement).getBBox();
      return { left: b.x, top: b.y, right: b.x + b.width, bottom: b.y + b.height };
    });
    const hits = (x1: number, y1: number, x2: number, y2: number, r: Box): boolean => {
      const inside = (x: number, y: number) => x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
      if (inside(x1, y1) || inside(x2, y2)) return true;
      if (Math.max(x1, x2) < r.left || Math.min(x1, x2) > r.right || Math.max(y1, y2) < r.top || Math.min(y1, y2) > r.bottom) return false;
      const cr = (ax: number, ay: number, bx: number, by: number, cx: number, cy: number) => (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
      const x = (cx: number, cy: number, dx: number, dy: number) => cr(x1, y1, x2, y2, cx, cy) * cr(x1, y1, x2, y2, dx, dy) <= 0 && cr(cx, cy, dx, dy, x1, y1) * cr(cx, cy, dx, dy, x2, y2) <= 0;
      return x(r.left, r.top, r.right, r.top) || x(r.right, r.top, r.right, r.bottom) || x(r.right, r.bottom, r.left, r.bottom) || x(r.left, r.bottom, r.left, r.top);
    };
    const out: string[] = [];
    for (const t of svg.querySelectorAll('text')) {
      const bb = t.getBBox();
      const r: Box = { left: bb.x, top: bb.y, right: bb.x + bb.width, bottom: bb.y + bb.height };
      const text = t.textContent ?? '';
      if (segs.some(([x1, y1, x2, y2]) => hits(x1, y1, x2, y2, r))) out.push(`${text} × 선`);
      if (dots.some((d) => r.left < d.right && d.left < r.right && r.top < d.bottom && d.top < r.bottom)) out.push(`${text} × 점`);
    }
    return out;
  });
}

test('320px 차트 슬라이드 스크린샷: 선 그래프(초혼 연령)·막대 그래프(지역 인구) — 하단 띠가 카드를 덮지 않고, 초혼 연령 처음 값 글자는 선·점과 겹치지 않는다 (R-206·R-225)', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-360', '뷰포트를 직접 지정하므로 mobile-360에서만 실행');
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto('/');
  await expect(page.getByTestId('start-birth')).toBeEnabled();
  await hideBottomBar(page); // 증거 스크린샷: 고정 띠가 카드 아래를 덮은 채 찍히지 않게(R-225). 띠 위치는 「하단 고정(FS6)」 테스트가 따로 본다.
  expect(await page.getByTestId('bottom-bar').evaluate((el) => getComputedStyle(el).visibility)).toBe('hidden');
  for (const [id, name] of [['first-marriage-age', 'marriage-age'], ['region-population-registered', 'region']] as const) {
    const index = await page.evaluate((target) => [...document.querySelectorAll('[data-testid="stat-slide"]')].findIndex((s) => s.getAttribute('data-slide-id') === target), id);
    await goToSlide(page, index);
    await page.waitForTimeout(350);
    if (id === 'first-marriage-age') {
      expect(await page.locator('.slide.is-active svg.chart text').count(), '글자가 있다').toBeGreaterThan(4);
      expect(await chartTextOverlaps(page), '320px 초혼 연령: 처음 값 글자(30.9·27.7)가 선이나 점과 겹치지 않는다').toEqual([]);
    }
    await page.getByTestId('carousel').scrollIntoViewIfNeeded();
    await page.getByTestId('carousel').screenshot({ path: `${SHOTS}/dev-M2-slide-${name}-320.png` });
  }
});

test('선 그래프의 값 글자는 실제 화면에서 선·점과 겹치지 않는다 (R-225): 320·360·1280, 선이 촘촘히 겹쳐 흐르는 두 지표(평균 수명·혼인 건수)와 바닥에서 가파르게 시작하는 고령화율(320)만 예외', async ({ page }, testInfo) => {
  test.setTimeout(60_000);
  const mobile = testInfo.project.name === 'mobile-360';
  let checked = 0;
  for (const w of mobile ? [320, 360] : [1280]) {
    await page.setViewportSize({ width: w, height: mobile ? 740 : 800 });
    await page.goto('/');
    await expect(page.getByTestId('start-birth')).toBeEnabled();
    const n = await slideCount(page);
    for (let i = 0; i < n; i++) {
      await goToSlide(page, i);
      const id = await activeSlideId(page);
      if (!(await page.locator('.slide.is-active svg.chart .line').count())) continue; // 막대 그래프
      checked++;
      if (['life-expectancy', 'marriage-count'].includes(id) || (id === 'aging-rate' && w === 320)) continue; // 어느 자리도 선을 완전히 피할 수 없는 지표 — 글자 뒤 테두리가 읽히게 한다(tests/carousel.test.ts가 이유를 적어 둔다)
      expect(await chartTextOverlaps(page), `${w}px ${id}`).toEqual([]);
    }
  }
  expect(checked, '선 그래프를 실제로 검사한 개수(공허 통과 방지)').toBeGreaterThan(8);
});

// ---------- 모바일 빈 칸: 카드 높이는 고정이되 남는 빈 칸은 카드 끝에 (REV-003-M2-2 마스터 결정) ----------

test('모바일(폭 < 960): 카드 높이는 고정이고, 짧은 슬라이드의 남는 빈 칸은 「출처」와 「통계 기준」 사이가 아니라 카드 끝에 있다 (320·360)', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-360', '뷰포트를 직접 지정하므로 mobile-360에서만 실행');
  test.setTimeout(60_000);
  for (const w of [320, 360]) {
    await page.setViewportSize({ width: w, height: 740 });
    await page.goto('/');
    await expect(page.getByTestId('start-birth')).toBeEnabled();
    await hideBottomBar(page);
    await page.getByTestId('carousel-pause').click(); // 측정 중 자동 전환이 슬라이드를 바꾸지 않게
    const n = await slideCount(page);
    const heights = new Set<number>();
    let widest = { index: 0, blank: -1, id: '' };
    for (let i = 0; i < n; i++) {
      await goToSlide(page, i);
      const m = await page.evaluate(() => {
        const slide = document.querySelector('.slide.is-active')!.getBoundingClientRect();
        const basis = document.querySelector('.slide.is-active [data-testid="slide-basis"]')!;
        const source = basis.previousElementSibling!;
        const b = basis.getBoundingClientRect();
        const src = source.getBoundingClientRect();
        return {
          card: Math.round(document.querySelector('[data-testid="carousel"]')!.getBoundingClientRect().height),
          sourceText: source.textContent ?? '',
          gapBetween: b.top - src.bottom, // 「출처」 줄과 「통계 기준」 줄 사이
          blankAtEnd: slide.bottom - b.bottom, // 「통계 기준」 줄 아래 ~ 슬라이드(카드 안쪽) 끝
        };
      });
      const id = await activeSlideId(page);
      heights.add(m.card);
      expect(m.sourceText.startsWith('출처:'), `${w}px ${id}: 「통계 기준」 바로 위 줄이 출처`).toBe(true);
      expect(m.gapBetween, `${w}px ${id}: 출처와 통계 기준 사이가 벌어지지 않는다(줄 간격만)`).toBeLessThanOrEqual(8);
      expect(m.gapBetween).toBeGreaterThanOrEqual(0);
      expect(m.blankAtEnd, `${w}px ${id}`).toBeGreaterThanOrEqual(-0.5);
      if (m.blankAtEnd > widest.blank) widest = { index: i, blank: m.blankAtEnd, id };
    }
    expect(heights.size, `${w}px 카드 높이는 슬라이드마다 같다(고정): ${[...heights]}`).toBe(1);
    expect(widest.blank, `${w}px 가장 짧은 슬라이드(${widest.id})에 실제로 빈 칸이 있다 — 공허 통과 방지`).toBeGreaterThan(40);
    if (w === 360) {
      await page.getByTestId('carousel-pause').click(); // 일시정지를 풀어 평소 모습(자동 넘김 중)으로 찍는다 — 찍는 동안 포인터가 올라가 있어 슬라이드는 바뀌지 않는다
      await goToSlide(page, widest.index);
      await page.waitForTimeout(350);
      await page.getByTestId('carousel').scrollIntoViewIfNeeded();
      await page.getByTestId('carousel').screenshot({ path: `${SHOTS}/dev-M2-r3-mobile-blank-at-card-end.png` });
    }
  }
});
