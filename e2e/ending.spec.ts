import { expect, test, type Page } from '@playwright/test';
import type { GameState } from '../src/core/types';
import { expectedLooksLabel } from '../tests/helpers/standingExpectations';
import {
  KNOWN_SEED,
  RAPID_METHODS,
  activeTestId,
  evalCore,
  findPendingState,
  injectSave,
  lifeSnapshot,
  lifeState,
  noHorizontalOverflow,
  oracleAuto,
  oracleLife,
  pressBegin,
  pressBeginToLife,
  readSave,
  readSettings,
  recordClicks,
  recordedClicks,
  replaceSaveAndReload,
  settle,
  skipRoulette,
  startPageHidden,
  titleState,
  toBirthReport,
} from './helpers';

/**
 * 엔딩 (SPEC-001 M5): 담담한 회고(생애 연표·최종 스탯·출발선 대비)와 "다시 태어나기".
 * 계산은 core/ending.ts의 순수 함수가 하고, 여기서는 실제 브라우저에서 (1) 보이는 것이 core의 회고와 같은지, (2) 새로고침해도 그대로인지,
 * (3) 다시 태어나기가 새 시드의 첫 화면(마지막에 고른 세상·인생 길이가 그대로 눌려 있다)으로 가고 설정을 유지하는지, (4) 더블탭·3연타가 첫 화면을 건너뛰거나 세상·인생 길이 선택을 바꾸지 않는지(R-030 M5 몫),
 * (5) 키보드만으로 되는지, (6) 긴 연표·20세 전 사망이 360px에서 읽히는지를 본다.
 */

const SETTINGS = { speed: 8, autoMode: true } as const;
/** 엔딩 출발선 문장의 구간 표현 (R-091): 하위 N% 안쪽 / 상위 N% 안쪽 / 상위 A~B% 사이 / 하위 A%와 상위 B% 사이 (끝에 "의 집에서 태어" 가 이어진다) */
const BAND_SENTENCE = /^(하위 \d+% 안쪽|상위 \d+% 안쪽|상위 \d+~\d+% 사이|하위 \d+~\d+% 사이|하위 \d+%와 상위 \d+% 사이)의 집에서 태어(났|나, )/;
/** 등급명(흙/동/은/금/다이아 수저)·느낌표·이모지 */
const FORBIDDEN = /(흙|동|은|금|다이아)\s*수저|다이아|[!！]|\p{Extended_Pictographic}/u;

/** 알려진 시드의 엔딩 상태(core 자동 진행 결과)를 만든다. 앱 페이지가 열려 있어야 한다. */
async function endedState(page: Page, seed = KNOWN_SEED, era: 'past' | 'present' | 'future' = 'present'): Promise<GameState> {
  await page.goto('/');
  const ended = await oracleAuto(page, await oracleLife(page, seed, era));
  expect(ended.phase).toBe('ending');
  return ended;
}

interface ReviewOracle {
  journey: string;
  movement: string | null;
  death: string;
  picked: string[];
  choiceCount: number;
}

/** core가 계산한 회고와 문구 (개발 서버의 실제 모듈을 브라우저에서 불러 같은 코드를 쓴다) */
async function reviewOracle(page: Page, state: GameState): Promise<ReviewOracle> {
  return page.evaluate<ReviewOracle>(`(async () => {
    const core = await import('/src/core/index.ts');
    const text = await import('/src/data/endingText.ts');
    const state = ${JSON.stringify(state)};
    const r = core.reviewEnding(state);
    return {
      journey: text.journeyText(r.journey),
      movement: r.journey.kind === 'compared' ? text.MOVEMENT_TEXT[r.journey.movement] : null,
      death: text.deathLineText(state.death),
      picked: state.history.filter((h) => h.kind === 'choice').map((h) => h.choice),
      choiceCount: r.choiceCount,
    };
  })()`);
}

/** 한 요소의 글이 화면에서 몇 줄로 나뉘는지(글자 단위 위치로 잰다). 줄마다 그 줄의 글을 돌려준다. */
async function visualLines(page: Page, selector: string): Promise<string[][]> {
  return page.evaluate((sel) => {
    return [...document.querySelectorAll(sel)].map((el) => {
      const lines: string[] = [];
      let lastTop: number | null = null;
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
        const text = node.textContent ?? '';
        for (let i = 0; i < text.length; i++) {
          if (text[i].trim() === '') continue;
          const range = document.createRange();
          range.setStart(node, i);
          range.setEnd(node, i + 1);
          const top = Math.round(range.getBoundingClientRect().top);
          if (lastTop === null || Math.abs(top - lastTop) > 4) lines.push('');
          lastTop = top;
          lines[lines.length - 1] += text[i];
        }
      }
      return lines;
    });
  }, selector);
}

// ---------- 엔딩 화면의 내용 ----------

test('자동 모드로 사망까지 → 엔딩 화면: 연표·최종 스탯·출발선 대비가 보이고 core의 회고와 같다. 등급명·감탄사가 없고 가로로 넘치지 않는다', async ({ page }) => {
  await page.goto('/');
  const found = await findPendingState(page, 'present');
  const start = await oracleLife(page, found.seed, 'present');
  await injectSave(page, start, '/?__timescale=2000', SETTINGS);
  await expect(page.getByTestId('ending-screen')).toBeVisible({ timeout: 30_000 });
  const save = (await readSave(page)).data;
  expect(save).toEqual(await oracleAuto(page, start));
  const c = save.character!;
  const oracle = await reviewOracle(page, save);

  // 제목에 포커스가 있다 (R-030). M4: 제목은 「{이름}의 인생」(copy.md 엔딩 헤더 행)이고, 그 위에 공통 헤더(게임명 로고 + 화면 이름 「엔딩」)가 있다
  await expect.poll(() => page.evaluate(() => `${document.activeElement?.tagName}:${document.activeElement?.textContent?.trim()}`)).toBe(`H1:${c.name}의 인생`);
  await expect(page.getByTestId('site-head')).toContainText('엔딩');
  await expect(page.getByTestId('header-logo')).toBeVisible();
  await expect(page.locator('h1')).toHaveCount(1);
  await expect(page.getByTestId('ending-born')).toContainText(`${c.birthYear}년, ${c.gender === 'male' ? '남자아이' : '여자아이'}로 태어났다.`);
  await expect(page.getByTestId('ending-death')).toHaveText(oracle.death);
  await expect(page.getByTestId('ending-choices')).toContainText(`${oracle.choiceCount}번의 선택`);

  // 출발선 대비: 같은 세상 안의 자리 문장 + 방향 + 설명
  await expect(page.getByTestId('ending-journey')).toHaveText(oracle.journey);
  expect(oracle.journey).toMatch(/의 집에서 태어나, .+의 형편으로 생을 마쳤다\.$/);
  expect(oracle.journey, '출발선은 재력 단계의 구간 표현 (R-091)').toMatch(BAND_SENTENCE);
  await expect(page.getByTestId('ending-movement')).toHaveText(oracle.movement!);
  await expect(page.getByTestId('ending-note')).toContainText('같은 세상 안의 자리로 견주었습니다');
  for (const m of oracle.journey.matchAll(/(\d+)%/g)) expect(Number(m[1])).toBeLessThanOrEqual(50);
  expect(oracle.journey).not.toMatch(/약 (0|100)%/);

  // 최종 스탯: 마지막 값. 처음 값은 학력·행복·관계에만 (재산 스탯은 없어졌고 최종 순자산 줄은 M5 2b에서 화면에 더해진다)
  for (const key of ['education', 'health', 'happiness', 'relationships'] as const) await expect(page.getByTestId(`final-${key}`)).toHaveText(String(save.stats[key]));
  // M4(R-135): 외모는 원점수가 아니라 「상위/하위 약 N%」 한 가지로만 보인다(얼굴 그림 옆). 원점수 숫자는 화면 어디에도 없다.
  await expect(page.getByTestId('final-looks')).toContainText(expectedLooksLabel(c.looks));
  expect(await page.getByTestId('final-looks').innerText()).not.toMatch(/(?<![\d.])\d+\s*점/);
  for (const key of ['education', 'happiness', 'relationships'] as const) await expect(page.getByTestId(`started-${key}`)).toHaveText(`처음 ${save.birthStats![key]}`);
  for (const key of ['wealth', 'health', 'looks']) await expect(page.getByTestId(`started-${key}`)).toHaveCount(0);

  // 생애 연표: 연표의 모든 항목, 선택한 순간마다 고른 문구
  await expect(page.getByTestId('timeline-entry')).toHaveCount(save.history.length);
  await expect(page.getByTestId('timeline-picked')).toHaveCount(oracle.choiceCount);
  expect(oracle.choiceCount).toBeGreaterThan(5);
  const pickedTexts = await page.getByTestId('timeline-picked').allInnerTexts();
  expect(pickedTexts).toEqual(oracle.picked.map((p) => `선택: ${p}`));
  await expect(page.getByTestId('timeline-infant')).toBeVisible(); // 출생은 영유아 단계의 첫 줄
  // 연표의 첫 줄은 출생신고의 한 줄 서술문과 같은 문장(합쇼체, SPEC-003 BR3·C1) — M3 이전에는 「~로 태어났다」였다
  await expect(page.getByTestId('timeline-entry').first()).toContainText('로 태어났습니다');
  await expect(page.getByTestId('timeline-entry').last()).toContainText('세상을 떠났다');

  // 위에서 아래로: 출발선 대비 → 최종 스탯 → 연표 → 다시 태어나기
  const tops = await page.evaluate(() => ['ending-journey-section', 'ending-stats', 'ending-timeline', 'rebirth'].map((id) => document.querySelector(`[data-testid="${id}"]`)!.getBoundingClientRect().top + window.scrollY));
  expect(tops).toEqual([...tops].sort((a, b) => a - b));

  // 금지된 것: 등급명·느낌표·이모지, 링크·이미지·공유, 가로 넘침. 버튼은 "다시 태어나기" 하나뿐
  const text = await page.getByTestId('ending-screen').innerText();
  expect(text).not.toMatch(FORBIDDEN);
  expect(text).not.toMatch(/공유|SNS|복사|이미지로 저장/);
  // M4: 공통 헤더의 로고·얼굴 그림·아이콘이 svg라 svg는 세지 않는다. 링크·이미지·캔버스·소리·영상은 여전히 0.
  expect(await page.locator('a, img, canvas, audio, video').count()).toBe(0);
  await expect(page.getByRole('button')).toHaveCount(1);
  expect(await noHorizontalOverflow(page)).toBe(true);
  expect(countOf(save, 'death')).toBe(1);
});

function countOf(save: GameState, kind: string): number {
  return save.history.filter((h) => h.kind === kind).length;
}

test('엔딩 화면은 새로고침해도 그대로다: 같은 회고, 저장 불변, 엔딩이 되살아나거나 진행이 다시 시작되지 않는다', async ({ page }) => {
  const ended = await endedState(page);
  await injectSave(page, ended, '/?__timescale=2000', SETTINGS);
  await expect(page.getByTestId('ending-screen')).toBeVisible();
  const journey = await page.getByTestId('ending-journey').innerText();
  const before = (await readSave(page)).data;
  expect(before).toEqual(ended);
  for (let i = 0; i < 3; i++) {
    await page.reload();
    await expect(page.getByTestId('ending-screen')).toBeVisible();
    await expect(page.getByTestId('ending-journey')).toHaveText(journey);
    await expect(page.getByTestId('timeline-entry')).toHaveCount(ended.history.length);
    await expect(page.getByTestId('error-screen')).toHaveCount(0);
  }
  // 자동 모드(8배속)가 켜져 있어도 엔딩에서는 아무 것도 진행되지 않는다: 잠시 기다려도 저장이 그대로다
  await page.waitForTimeout(800);
  await settle(page);
  expect((await readSave(page)).data).toEqual(ended);
  await expect(page.getByTestId('ending-screen')).toBeVisible();
  await expect(page.getByTestId('life-screen')).toHaveCount(0);
});

test('스무 살 전에 끝난 인생: 도착 자리를 말하지 않고 집안 형편만 말한다 (재산이 아직 집안 형편이다)', async ({ page }) => {
  const base = lifeState(KNOWN_SEED);
  const early: GameState = {
    ...base,
    phase: 'ending',
    age: 9,
    history: [
      { age: 0, kind: 'stage', text: '2012년, 남자아이로 태어났다.' },
      { age: 3, kind: 'event', title: '첫 말', text: '아이가 처음으로 또렷한 말을 했다.', eventId: 'infant-first-word' },
      { age: 7, kind: 'stage', text: '학교에 들어갈 나이가 되었다.' },
      { age: 9, kind: 'death', text: '세상을 떠났다. 원인: 갑작스러운 병.' },
    ],
    death: { age: 9, cause: '갑작스러운 병' },
  };
  await page.goto('/');
  await injectSave(page, early, '/');
  await expect(page.getByTestId('ending-screen')).toBeVisible();
  await expect(page.getByTestId('ending-death')).toHaveText('9세에 세상을 떠났다. 원인: 갑작스러운 병.');
  // R-083: 출발선만 담담하게 — 게임 용어("내가 가진 것")도, 윗줄이 이미 말한 "생이 끝났다"도 되풀이하지 않는다
  await expect(page.getByTestId('ending-journey')).toHaveText(/^.+의 집에서 태어났다\.$/);
  await expect(page.getByTestId('ending-journey')).toHaveText(BAND_SENTENCE); // R-091: 20세 전 사망 줄도 구간 표현
  await expect(page.getByTestId('ending-journey')).toHaveText((await reviewOracle(page, early)).journey);
  await expect(page.getByTestId('ending-journey')).not.toContainText(/내가 가진 것|생이 끝|견줄|스무 살/);
  await expect(page.getByTestId('ending-journey')).not.toContainText('형편으로 생을 마쳤다');
  await expect(page.getByTestId('ending-movement')).toHaveCount(0);
  // 재산 막대는 M5 2a에서 임시로 빠졌다(재산 스탯 폐지) — 「재산」이든 「집안 형편」이든 막대가 없다. 2b가 20세 전은 「집안 살림」 줄로 되살린다.
  await expect(page.getByTestId('ending-stats')).not.toContainText(/재산|집안 형편/);
  await expect(page.getByTestId('final-health')).toBeVisible();
  await expect(page.getByTestId('timeline-entry')).toHaveCount(4);
  expect(await noHorizontalOverflow(page)).toBe(true);
  expect(await page.getByTestId('ending-screen').innerText()).not.toMatch(FORBIDDEN);
});

test('가장 긴 연표(세 시대에서 찾은 가장 긴 인생)도 360px와 320px에서 읽힌다: 가로 넘침·잘림 없고, 다시 태어나기 버튼에 스크롤로 닿는다', async ({ page }) => {
  await page.goto('/');
  const longest = await evalCore<GameState>(
    page,
    `let best = null;
     for (const era of ['past', 'present', 'future']) {
       for (let seed = 1; seed <= 150; seed++) {
         const s = core.enterLife(core.enterBirth(core.beginBirth(core.createInitialState(seed), era)));
         const f = core.playToEnd(s, null).state;
         if (best === null || f.history.length > best.history.length) best = f;
       }
     }
     return best;`,
  );
  expect(longest.history.length).toBeGreaterThanOrEqual(40);
  for (const width of [360, 320]) {
    await page.setViewportSize({ width, height: 640 });
    await injectSave(page, longest, '/');
    await expect(page.getByTestId('ending-screen')).toBeVisible();
    await expect(page.getByTestId('timeline-entry')).toHaveCount(longest.history.length);
    expect(await noHorizontalOverflow(page), `${width}px 가로 넘침`).toBe(true);
    // M4: 옛 클래스(.ending-section·.ending-head·.stat)가 새 틀(.ending .card·.ending__head·.meter)로 바뀌었다 — 선택자가 아무것도 못 잡아 공허하게 통과하지 않도록 잰 요소 수의 하한도 단언한다
    const measured = await page.evaluate(() => [...document.querySelectorAll<HTMLElement>('.timeline li, .ending .card p, .ending__head p, .ending .meter')].map((el) => el.scrollWidth - el.clientWidth));
    expect(measured.length, `${width}px 잰 요소 수`).toBeGreaterThan(longest.history.length);
    expect(measured.filter((d) => d > 1).length, `${width}px 잘린 줄`).toBe(0);
    // 글자 크기는 읽을 만하다: 연표·본문은 13px 이상, 디자인 시스템의 가장 작은 보조 글자(.t-xs, 안내 한 줄)도 12px 이상 (M4: 새 틀의 보조 글자 12px를 따로 본다)
    const fonts = await page.evaluate(() => ({
      body: Math.min(...[...document.querySelectorAll<HTMLElement>('.timeline li, .ending .card p:not(.t-xs)')].map((el) => parseFloat(getComputedStyle(el).fontSize))),
      caption: Math.min(...[...document.querySelectorAll<HTMLElement>('.ending .card p.t-xs')].map((el) => parseFloat(getComputedStyle(el).fontSize))),
    }));
    expect(fonts.body).toBeGreaterThanOrEqual(13);
    expect(fonts.caption).toBeGreaterThanOrEqual(12);
    // 끝까지 내려가면 다시 태어나기 버튼이 화면 안에 온전히 보인다
    const rebirth = page.getByTestId('rebirth');
    await rebirth.scrollIntoViewIfNeeded();
    const box = (await rebirth.boundingBox())!;
    const vp = page.viewportSize()!;
    expect(box.y).toBeGreaterThanOrEqual(0);
    expect(box.y + box.height).toBeLessThanOrEqual(vp.height);
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(vp.width);
  }
});

test('엔딩의 제목·문장은 단어 중간에서 끊기지 않고 한 글자만 홀로 남는 줄이 없다 (360px)', async ({ page }) => {
  const ended = await endedState(page);
  await page.setViewportSize({ width: 360, height: 740 });
  await injectSave(page, ended, '/');
  await expect(page.getByTestId('ending-screen')).toBeVisible();
  const groups = await visualLines(page, 'h1, h2, .ending__head p, [data-testid="ending-journey"], [data-testid="ending-movement"], [data-testid="ending-note"]');
  expect(groups.length).toBeGreaterThan(6);
  for (const lines of groups) {
    if (lines.length < 2) continue;
    for (const line of lines) expect(line.length, `한 글자 줄: ${lines.join(' / ')}`).toBeGreaterThan(1);
  }
  const wordBreak = await page.evaluate(() => getComputedStyle(document.querySelector('[data-testid="ending-journey"]')!).wordBreak);
  expect(wordBreak).toBe('keep-all');
  // 순위 표현("상위 약 23%의")이 "%"와 조사 사이에서 쪼개져 "의"가 다음 줄 맨 앞에 오지 않는다 (ui/KeepStanding)
  const journey = (await visualLines(page, '[data-testid="ending-journey"]'))[0];
  for (const line of journey) expect(line, `줄머리의 조사: ${journey.join(' / ')}`).not.toMatch(/^[의%]/);
  // 덩어리 수는 문장이 말하는 순위 표현의 수다(출발선 구간이 "하위 25%와 상위 45% 사이의"처럼 두 덩어리면 3개) — 같은 규칙(KeepStanding)에서 구한다
  const units = await page.evaluate<number>(`(async () => {
    const { splitStanding } = await import('/src/ui/KeepStanding.tsx');
    return (splitStanding(document.querySelector('[data-testid="ending-journey"]').textContent).length - 1) / 2;
  })()`);
  expect(units).toBeGreaterThanOrEqual(2);
  expect(await page.locator('[data-testid="ending-journey"] .nowrap').count()).toBe(units);
});

test('출발선 구간 문장(맨 아래·가운데·한쪽 절반·맨 위 단계 × 360px·320px): 숫자 중간에서 끊기지 않고, 조사가 줄머리에 오지 않으며, 덩어리가 화면 밖으로 나가지 않는다 (R-091)', async ({ page }) => {
  const ended = await endedState(page);
  const labels: string[] = [];
  for (const [wealth, final] of [
    [1, 12000],
    [2, 0],
    [3, -3000],
    [4, 80000],
    [5, 3000],
  ] as const) {
    // 최종 순자산(만 원) — 음수이면 불변식(debt ≥ −net)을 지키도록 부채를 맞춘다
    const assets = { ...ended.assets!, net: final, debt: Math.max(ended.assets!.debt, -final) };
    const state: GameState = { ...ended, character: { ...ended.character!, parentWealth: wealth }, assets };
    const oracle = await reviewOracle(page, state);
    expect(oracle.journey).toMatch(BAND_SENTENCE);
    labels.push(`${wealth}단계: ${oracle.journey}`);
    for (const width of [360, 320]) {
      await page.setViewportSize({ width, height: 740 });
      await injectSave(page, state, '/');
      await expect(page.getByTestId('ending-screen')).toBeVisible();
      await expect(page.getByTestId('ending-journey')).toHaveText(oracle.journey);
      await expect(page.getByTestId('ending-movement')).toHaveText(oracle.movement!);
      expect(await noHorizontalOverflow(page), `${wealth}단계 ${width}px 가로 넘침`).toBe(true);
      const journey = (await visualLines(page, '[data-testid="ending-journey"]'))[0];
      for (const line of journey) {
        expect(line.length, `한 글자 줄 ${width}px: ${journey.join(' / ')}`).toBeGreaterThan(1);
        expect(line, `줄머리의 조사 ${width}px: ${journey.join(' / ')}`).not.toMatch(/^[의%와]/);
      }
      // 한 덩어리(.nowrap)는 줄 하나 안에 온전히 들어간다: 자기 부모 폭을 넘지 않는다
      const overflowing = await page.evaluate(() => {
        const box = document.querySelector<HTMLElement>('[data-testid="ending-journey"]')!.getBoundingClientRect();
        return [...document.querySelectorAll<HTMLElement>('[data-testid="ending-journey"] .nowrap')].filter((el) => el.getBoundingClientRect().right > box.right + 1).map((el) => el.textContent);
      });
      expect(overflowing, `${wealth}단계 ${width}px`).toEqual([]);
    }
  }
  expect(new Set(labels.map((l) => l.split('의 집에서')[0])).size, labels.join(' / ')).toBe(5); // 다섯 단계의 출발선 구간 표현이 모두 다르다
});

// ---------- 다시 태어나기 ----------

test('다시 태어나기: 새 시드의 새 판이 첫 화면(마지막에 고른 세상·인생 길이)에서 시작되고, 설정(배속·자동 모드·세상·인생 길이)은 유지되며, 이전 판의 저장은 대체된다', async ({ page }) => {
  const ended = await endedState(page);
  await startPageHidden(page); // 새 판이 자동 모드로 곧바로 흐르지 않게 타이머를 멈춰 둔다
  // 이 판은 지금 세상이었지만 첫 화면의 마지막 선택은 다가올 세상·약 30분. (「약 1시간」은 준비 중이라 고를 수 없다 — R-202. 이 테스트의 인생 길이 쪽 값이 long60에서 short30으로 바뀐 이유.)
  const SETTINGS_CHOSEN = { ...SETTINGS, era: 'future', lifeLength: 'short30' } as const;
  await injectSave(page, ended, '/', SETTINGS_CHOSEN);
  await expect(page.getByTestId('ending-screen')).toBeVisible();
  const rebirth = page.getByTestId('rebirth');
  await expect(rebirth).toBeEnabled(); // 화면 진입 가드가 풀릴 때까지
  await expect(rebirth).toHaveText('다시 태어나기');
  await rebirth.click();

  // 곧바로 첫 화면: 마지막에 고른 세상(다가올 세상)·인생 길이(약 30분)가 눌려 있고, 포커스는 새 화면 제목 (R-030 M5 몫)
  await expect(page.getByTestId('title-screen')).toBeVisible();
  await expect(page.getByTestId('era-future')).toBeChecked();
  await expect(page.getByTestId('era-present')).not.toBeChecked();
  await expect(page.getByTestId('era-past')).not.toBeChecked();
  await expect(page.getByTestId('life-short30')).toBeChecked();
  await expect(page.getByTestId('life-long60')).not.toBeChecked();
  await expect.poll(() => page.evaluate(() => `${document.activeElement?.tagName}:${document.activeElement?.textContent?.trim()}`)).toBe('H1:수저 게임');

  // 저장: 새 시드, 이전 판의 흔적 없음 (이전 판은 대체돼 되돌릴 수 없다)
  await expect.poll(async () => (await readSave(page)).data.phase).toBe('title');
  const fresh = (await readSave(page)).data;
  expect(fresh.seed).not.toBe(ended.seed);
  expect(fresh.era).toBeNull(); // 세상·인생 길이는 설정에 있고, 판에는 태어날 때 들어간다
  expect(fresh.lifeLength).toBeNull();
  expect(fresh.character).toBeNull();
  expect(fresh.history).toEqual([]);
  expect(fresh.death).toBeNull();
  expect(fresh.flags).toEqual([]);
  expect(JSON.stringify(fresh)).not.toContain(ended.character!.name);
  // 설정은 그대로. M4: 설정 봉투 v3에 BGM(꺼짐·볼륨 30)과 테마(시스템)가 더해져 기본값이 함께 저장된다 — 값은 바뀌지 않는다.
  expect(await readSettings(page)).toEqual({ ...SETTINGS_CHOSEN, bgm: { on: false, volume: 30 }, theme: 'system' });

  // 새로고침해도 첫 화면에서 이어진다 (엔딩이 되살아나지 않는다)
  await page.reload();
  await expect(page.getByTestId('title-screen')).toBeVisible();
  await expect(page.getByTestId('ending-screen')).toHaveCount(0);

  // 태어나기를 누르면 새 인물: 같은 시드·마지막 선택(다가올 세상·약 30분)의 core 출생 결과와 같다
  const expected = await evalCore<GameState>(page, 'return core.beginBirth(arg, "future", "short30");', fresh);
  await pressBegin(page);
  await skipRoulette(page); // 룰렛(결과는 태어나기 순간에 이미 정해져 있다) → 출생신고
  await toBirthReport(page);
  const born = (await readSave(page)).data;
  expect(born.character).toEqual(expected.character);
  expect(born.era).toBe('future');
  expect(born.lifeLength).toBe('short30');
  // 살아가기 → 새 인생: 설정(8배속·자동 모드)이 그대로 눌려 있고 0세다
  const next = page.getByTestId('next-life');
  await expect(next).toBeEnabled();
  await next.click();
  await expect(page.getByTestId('life-screen')).toBeVisible();
  const snap = await lifeSnapshot(page);
  expect(snap.speed).toBe('8');
  expect(snap.auto).toBe('true');
  expect(snap.age).toBe('0세');
  expect(snap.hasChoice).toBe(false);
});

test('색 구성표(M4): 다크 OS에서 엔딩도 시스템을 따르고(옛 화면 라이트 고정은 없어졌다), 「다시 태어나기」로 첫 화면에 돌아와도 같다', async ({ page }) => {
  // 바뀐 기대(M4): 예전에는 옛 화면(인생·엔딩)이 라이트로 고정(ui/legacyTheme.tsx)이라 다크 OS에서도 엔딩이 라이트였다. 이제 모든 화면이 새 디자인이라 엔딩도 시스템 설정(다크)을 따른다.
  const ended = await endedState(page);
  await page.emulateMedia({ colorScheme: 'dark' });
  await startPageHidden(page);
  await injectSave(page, ended, '/', SETTINGS);
  await expect(page.getByTestId('ending-screen')).toBeVisible();
  const state = () =>
    page.evaluate(() => ({
      scheme: getComputedStyle(document.documentElement).colorScheme,
      dataTheme: document.documentElement.getAttribute('data-theme'),
      metaScheme: document.querySelector('meta[name="color-scheme"]')!.getAttribute('content'),
      themeMedia: [...document.querySelectorAll('meta[name="theme-color"]')].map((m) => m.getAttribute('media')),
      background: getComputedStyle(document.body).backgroundColor,
    }));
  const DARK_STATE = { scheme: 'dark', dataTheme: null, metaScheme: 'light dark', themeMedia: ['(prefers-color-scheme: light)', '(prefers-color-scheme: dark)'], background: 'rgb(20, 23, 31)' };
  expect(await state(), '엔딩: 다크 OS를 따른다(바탕은 다크 토큰 --c-bg #14171f)').toEqual(DARK_STATE);
  await expect(page.getByTestId('rebirth')).toBeEnabled();
  await page.getByTestId('rebirth').click();
  await expect(page.getByTestId('title-screen')).toBeVisible();
  expect(await state(), '첫 화면: 같다').toEqual(DARK_STATE);
});

test('다시 태어나기를 거친 새 판도 끝까지 가서 다시 엔딩이 된다 (죽음 → 다시 태어나기 → 죽음)', async ({ page }) => {
  test.setTimeout(120_000);
  const ended = await endedState(page);
  await injectSave(page, ended, '/?__timescale=3000', SETTINGS);
  await page.getByTestId('rebirth').click();
  await pressBeginToLife(page);
  // 자동 모드(8배속)가 켜져 있으니 새 판은 스스로 끝까지 간다
  await expect(page.getByTestId('ending-screen')).toBeVisible({ timeout: 60_000 });
  const second = (await readSave(page)).data;
  expect(second.phase).toBe('ending');
  expect(second.seed).not.toBe(ended.seed);
  expect(second.character!.name).toBeTruthy();
  await expect(page.getByTestId('timeline-entry')).toHaveCount(second.history.length);
});

for (const fraction of [1 / 4, 1 / 2, 3 / 4]) {
  for (const method of RAPID_METHODS) {
    test(`다시 태어나기 ${method === 'dblclick' ? '더블클릭' : method === 'mouse2' ? '더블탭' : method === 'mouse3' ? '3연타' : '사람 속도 더블탭(150ms)'} — 버튼 폭 ${Math.round(fraction * 100)}% 지점: 새 판은 하나뿐이고 첫 화면을 건너뛰거나 선택을 바꾸지 않으며 외부 링크로 가지 않는다 (R-030)`, async ({ page, context }) => {
      const ended = await endedState(page);
      await recordClicks(page);
      await replaceSaveAndReload(page, ended, SETTINGS);
      await expect(page.getByTestId('ending-screen')).toBeVisible();
      const rebirth = page.getByTestId('rebirth');
      await expect(rebirth).toBeEnabled();
      const url = page.url();
      await rebirth.scrollIntoViewIfNeeded();
      const box = (await rebirth.boundingBox())!;
      const x = box.x + box.width * fraction;
      const y = box.y + box.height / 2;
      const taps = method === 'mouse3' ? 3 : 2;
      for (let i = 0; i < taps; i++) {
        if (method === 'dblclick' && i === 0) {
          await page.mouse.dblclick(x, y);
          break;
        }
        await page.mouse.click(x, y);
        if (method === 'human150' && i < taps - 1) await page.waitForTimeout(150);
      }
      await expect(page.getByTestId('title-screen')).toBeVisible();
      await settle(page);
      await page.waitForTimeout(500); // 가드가 풀린 뒤에도 첫 화면에 머무른다 (늦게 도착한 입력이 없다)
      await expect(page.getByTestId('title-screen')).toBeVisible();
      await expect(page.getByTestId('roulette-screen')).toHaveCount(0); // 둘째 입력이 첫 화면의 「태어나기」에 떨어져 룰렛이 열리지 않았다
      await expect(page.getByTestId('birth-screen')).toHaveCount(0);
      expect(page.url(), '외부 링크로 이동하지 않았다').toBe(url);
      expect(context.pages().length, '새 창이 열리지 않았다').toBe(1);
      const save = (await readSave(page)).data;
      expect(save.phase).toBe('title');
      expect(save.era, '태어나기가 눌리지 않았다(판에는 아직 세상이 없다)').toBeNull();
      expect(save.history).toEqual([]);
      const chosen = await readSettings(page);
      expect([chosen.era, chosen.lifeLength], '세상·인생 길이 선택이 바뀌지 않았다').toEqual(['present', 'short30']);
      // 첫 입력은 "다시 태어나기", 이후 입력은 새 화면의 닫힌 버튼(가드)이나 버튼이 아닌 곳에 떨어졌다
      const clicks = await recordedClicks(page);
      expect(clicks[0]).toBe('rebirth');
      for (const c of clicks.slice(1)) expect(c.endsWith('(가드)') || c.startsWith('비버튼:'), `둘째 이후 입력이 열린 버튼에 떨어졌다: ${c}`).toBe(true);
    });
  }
}

test('키보드만으로 엔딩 → 다시 태어나기: Tab으로 버튼에 닿고 Enter(또는 Space)로 첫 화면에 가며, 새 화면 제목에 포커스가 가고 다음 Tab은 눌려 있는 세상 카드로 간다', async ({ page }) => {
  const ended = await endedState(page);
  for (const key of ['Enter', 'Space'] as const) {
    await injectSave(page, ended, '/', SETTINGS);
    await expect(page.getByTestId('ending-screen')).toBeVisible();
    await expect(page.getByTestId('rebirth')).toBeEnabled();
    await expect.poll(() => page.evaluate(() => document.activeElement?.tagName)).toBe('H1'); // 제목에 포커스
    await page.keyboard.press('Tab'); // 연표는 Tab 정지점이 아니다: 다음이 바로 버튼
    expect(await activeTestId(page)).toBe('rebirth');
    await page.keyboard.press(key);
    await expect(page.getByTestId('title-screen')).toBeVisible();
    await expect.poll(() => page.evaluate(() => `${document.activeElement?.tagName}:${document.activeElement?.textContent?.trim()}`)).toBe('H1:수저 게임');
    // 곧바로 같은 키를 또 눌러도(제목에 포커스가 있다) 첫 화면을 건너뛰지 않는다
    await page.keyboard.press(key);
    await page.waitForTimeout(500);
    await expect(page.getByTestId('title-screen')).toBeVisible();
    expect((await readSave(page)).data.phase).toBe('title');
    // 다음 Tab은 외부 링크가 아니라 눌려 있는 세상 카드(라디오 묶음은 Tab 정지점이 하나)
    await page.keyboard.press('Tab');
    expect(await activeTestId(page)).toBe('era-present');
  }
});

// ---------- 다시 태어나기 더블탭: 겹침을 측정으로 정한다 (R-050 방식) ----------

const SWEEP_VIEWPORTS = [
  { width: 360, height: 480 },
  { width: 360, height: 568 },
  { width: 320, height: 568 },
  { width: 360, height: 640 },
  { width: 360, height: 667 },
  { width: 667, height: 375 },
] as const;
const MIN_OVERLAP_PX = 4;
/**
 * 시험이 의미를 가지려면 필요한 하한(공허 통과 방지). M4에서 엔딩 화면의 끝 여백이 하단 고정 띠보다 커져 「다시 태어나기」 버튼이 첫 화면의 「태어나기」 띠·카드와 **자연적으로는 겹치지 않는다**(겹침 측정 0: 아래 report).
 * 겹침이 없다는 것이 둘째 입력이 안전하다는 증거는 아니므로(스크롤 위치·글자 크기·기기에 따라 달라진다), 둘째 입력을 **첫 화면에서 손가락 아래에 놓일 수 있는 모든 조작 요소의 한가운데**(landing)에 떨어뜨리는 최악의 경우로 확장했다:
 * 첫 입력은 「다시 태어나기」, 이후 입력은 화면에 보이는 조작 요소(「태어나기」 띠, 보이는 카드·캐러셀 버튼) 위. 가드가 없으면 실제로 건너뛰거나 선택이 바뀐다는 대조군도 같은 방식으로 본다.
 */
const MIN_LANDING_VIEWPORTS = 5;

interface Hit {
  id: string;
  x: number;
  y: number;
}

/** 이 뷰포트에서 "다시 태어나기" 버튼(맨 아래까지 스크롤한 위치)이 첫 화면의 세상·인생 길이 카드·캐러셀 버튼·하단 「태어나기」와 겹치는 곳(hits)과, 첫 화면(스크롤 맨 위)에서 화면 안에 한가운데가 보이는 조작 요소(landings)를 잰다 */
async function measureOverlap(page: Page, ended: GameState): Promise<{ rect: { x: number; y: number; width: number; height: number }; hits: Hit[]; landings: Hit[] }> {
  await replaceSaveAndReload(page, ended, SETTINGS);
  const rebirth = page.getByTestId('rebirth');
  await expect(rebirth).toBeEnabled();
  await rebirth.scrollIntoViewIfNeeded();
  const rect = (await rebirth.boundingBox())!;
  await replaceSaveAndReload(page, titleState(KNOWN_SEED), SETTINGS);
  await expect(page.getByTestId('title-screen')).toBeVisible();
  const els = await page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>('.radio-card, [data-testid="start-birth"], [data-testid="carousel-prev"], [data-testid="carousel-next"], [data-testid="carousel-pause"], [data-testid^="carousel-dot-"]')].map((b) => {
      const r = b.getBoundingClientRect();
      const id = b.dataset.testid ?? b.querySelector('input')?.dataset.testid ?? b.tagName;
      return { id, left: r.left, right: r.right, top: r.top, bottom: r.bottom };
    }),
  );
  const hits: Hit[] = [];
  for (const e of els) {
    const left = Math.max(rect.x, e.left);
    const right = Math.min(rect.x + rect.width, e.right);
    const top = Math.max(rect.y, e.top);
    const bottom = Math.min(rect.y + rect.height, e.bottom);
    if (right - left >= MIN_OVERLAP_PX && bottom - top >= MIN_OVERLAP_PX) hits.push({ id: e.id, x: (left + right) / 2, y: (top + bottom) / 2 });
  }
  const vp = page.viewportSize()!;
  const landings: Hit[] = els
    .map((e) => ({ id: e.id, x: (e.left + e.right) / 2, y: (e.top + e.bottom) / 2 }))
    .filter((e) => e.x > 0 && e.x < vp.width && e.y > 0 && e.y < vp.height);
  return { rect, hits, landings };
}

async function burst(page: Page, ended: GameState, at: { x: number; y: number }, method: 'mouse3' | 'human150', url: string, landing?: { x: number; y: number }): Promise<{ eraStillShown: boolean; birth: boolean; eraChosen: string | null; landed: string[] }> {
  // eraStillShown = 첫 화면에 머문다 / birth = 태어나기가 눌렸다 / eraChosen = 세상·인생 길이 선택이 기본(지금 세상·약 30분)에서 바뀌었다면 그 값
  await replaceSaveAndReload(page, ended, SETTINGS);
  await page.goto(url);
  const rebirth = page.getByTestId('rebirth');
  await expect(rebirth).toBeEnabled();
  await rebirth.scrollIntoViewIfNeeded(); // 점을 잰 때와 같은 스크롤 위치
  await page.evaluate(() => ((window as unknown as { __clicks: string[] }).__clicks.length = 0)); // 이 연타의 입력만 기록
  const taps = method === 'mouse3' ? 3 : 2;
  for (let i = 0; i < taps; i++) {
    // 첫 입력은 「다시 태어나기」 위, landing이 있으면 이후 입력은 첫 화면의 조작 요소 위(최악의 경우)
    await page.mouse.click(i === 0 || landing === undefined ? at.x : landing.x, i === 0 || landing === undefined ? at.y : landing.y);
    if (method === 'human150' && i < taps - 1) await page.waitForTimeout(150);
  }
  await settle(page);
  await page.waitForTimeout(600);
  const save = (await readSave(page)).data;
  const chosen = await readSettings(page);
  return {
    eraStillShown: save.phase === 'title' && (await page.getByTestId('title-screen').count()) === 1,
    birth: save.phase !== 'title',
    eraChosen: chosen.era !== 'present' || chosen.lifeLength !== 'short30' ? `${chosen.era}/${chosen.lifeLength}` : null,
    landed: (await recordedClicks(page)).slice(1), // 첫 입력(다시 태어나기)을 뺀 나머지
  };
}

test('낮은 화면(겹침과 최악의 착지점을 측정): 다시 태어나기 더블탭의 둘째 입력이 세상·인생 길이 카드·캐러셀 버튼·「태어나기」에 떨어져도 첫 화면은 그대로다. 가드를 끈 대조군에서는 실제로 건너뛰거나 바뀐다 (R-030 M5 몫)', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-360', '뷰포트를 직접 지정하므로 mobile-360에서만 실행');
  test.setTimeout(420_000);
  await page.goto('/');
  const ended = await oracleAuto(page, await oracleLife(page, KNOWN_SEED, 'present'));
  let withLandings = 0;
  let controlChanged = 0;
  const report: string[] = [];
  await startPageHidden(page);
  await recordClicks(page);
  for (const vp of SWEEP_VIEWPORTS) {
    await page.setViewportSize(vp);
    const { rect, hits, landings } = await measureOverlap(page, ended);
    report.push(`${vp.width}x${vp.height}: 겹침 ${hits.length > 0 ? hits.map((h) => h.id).join('·') : '없음'} / 최악의 둘째 입력 지점 ${landings.map((h) => h.id).join('·') || '없음'}`);
    // 버튼 폭의 좌·우 1/4 지점도 함께 누른다. 겹치는 곳이 있으면 그 한가운데도 누른다.
    const points = [
      { x: rect.x + rect.width / 4, y: rect.y + rect.height / 2 },
      { x: rect.x + (rect.width * 3) / 4, y: rect.y + rect.height / 2 },
      ...hits.map((h) => ({ x: h.x, y: h.y })),
    ];
    for (const method of ['human150', 'mouse3'] as const) {
      for (const p of points) {
        const r = await burst(page, ended, p, method, '/');
        expect(r.eraStillShown, `${vp.width}x${vp.height} ${method} (${Math.round(p.x)},${Math.round(p.y)}): 첫 화면이 건너뛰어졌다`).toBe(true);
        expect(r.birth).toBe(false);
        expect(r.eraChosen, `${vp.width}x${vp.height} ${method}: 세상·인생 길이 선택이 바뀌었다`).toBeNull();
        for (const c of r.landed) expect(c.endsWith('(가드)') || c.startsWith('비버튼:'), `${vp.width}x${vp.height} ${method}: 열린 버튼에 떨어졌다 (${c})`).toBe(true);
      }
    }
    // 최악의 경우: 첫 입력은 「다시 태어나기」 한가운데, 이후 입력은 첫 화면에서 보이는 조작 요소 한가운데(「태어나기」 띠 포함)
    const first = { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
    for (const method of ['human150', 'mouse3'] as const) {
      for (const l of landings) {
        const r = await burst(page, ended, first, method, '/', l);
        expect(r.eraStillShown, `${vp.width}x${vp.height} ${method} → ${l.id}: 첫 화면이 건너뛰어졌다`).toBe(true);
        expect(r.birth, `${vp.width}x${vp.height} ${method} → ${l.id}: 태어나기가 눌렸다`).toBe(false);
        expect(r.eraChosen, `${vp.width}x${vp.height} ${method} → ${l.id}: 세상·인생 길이 선택이 바뀌었다`).toBeNull();
        for (const c of r.landed) expect(c.endsWith('(가드)') || c.startsWith('비버튼:'), `${vp.width}x${vp.height} ${method} → ${l.id}: 열린 버튼에 떨어졌다 (${c})`).toBe(true);
      }
    }
    if (landings.length === 0) continue;
    withLandings++;
    // 대조군: 가드를 끄면(?__guard=0, 개발 서버 전용) 같은 조작(둘째 입력이 「태어나기」 띠 위)이 첫 화면을 건너뛰거나 선택을 바꾼다
    const target = landings.find((l) => l.id === 'start-birth') ?? landings[0];
    const control = await burst(page, ended, first, 'mouse3', '/?__guard=0', target);
    if (control.birth || control.eraChosen !== null) controlChanged++;
  }
  testInfo.annotations.push({ type: '측정', description: report.join(' | ') });
  expect(withLandings, `둘째 입력이 떨어질 조작 요소가 보이는 뷰포트가 너무 적다 (공허 통과 방지): ${report.join(' | ')}`).toBeGreaterThanOrEqual(MIN_LANDING_VIEWPORTS);
  expect(controlChanged, `가드를 끈 대조군에서 변화가 관측된 뷰포트가 너무 적다 (공허 통과 방지): ${report.join(' | ')}`).toBeGreaterThanOrEqual(MIN_LANDING_VIEWPORTS);
});

test('엔딩이 막 떴을 때(진입 가드가 닫혀 있는 동안)의 클릭은 "다시 태어나기"에 떨어지지 않고, 가드가 풀리면 같은 버튼이 눌린다 (R-086: 가드를 시간에 기대지 않고 닫아 둔다)', async ({ page }) => {
  const ended = await endedState(page);
  await startPageHidden(page);
  await recordClicks(page);
  // 개발 서버 전용 탐침 ?__guard=600000: 진입 가드가 사실상 풀리지 않는다 = "엔딩이 막 뜬 순간"이 계속된다. 조건부 단언이 없다.
  await injectSave(page, ended, '/?__guard=600000', SETTINGS);
  await expect(page.getByTestId('ending-screen')).toBeVisible();
  const rebirth = page.getByTestId('rebirth');
  await expect(rebirth, '진입 가드가 닫혀 있다').toHaveAttribute('aria-disabled', 'true');
  await rebirth.scrollIntoViewIfNeeded();
  const box = (await rebirth.boundingBox())!;
  const center = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  await page.mouse.click(center.x, center.y); // 더블클릭의 둘째 입력이 떨어지는 순간
  await page.mouse.click(center.x, center.y);
  await settle(page);
  await expect(page.getByTestId('ending-screen')).toBeVisible();
  await expect(page.getByTestId('title-screen')).toHaveCount(0);
  expect((await readSave(page)).data.phase, '저장은 아직 엔딩이다').toBe('ending');
  expect((await recordedClicks(page)).slice(0, 2), '두 입력 모두 닫힌 버튼에 닿았다').toEqual(['rebirth(가드)', 'rebirth(가드)']);

  // 가드가 정상 시간(400ms)이면 같은 버튼이 눌리고, 다시 태어나기가 된다
  await page.goto('/');
  await expect(page.getByTestId('ending-screen')).toBeVisible();
  await expect(rebirth).toBeEnabled();
  await expect(rebirth).not.toHaveAttribute('aria-disabled', 'true');
  await rebirth.click();
  await expect(page.getByTestId('title-screen')).toBeVisible();
});
