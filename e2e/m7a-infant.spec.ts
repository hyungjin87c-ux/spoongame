import { expect, test, type Page } from '@playwright/test';
import type { GameState } from '../src/core/types';
import { INTENDED_BREAK_WORDS } from './intendedBreaks';
import { auditFocus } from './focusObscured';
import { injectSave, startPageHidden } from './helpers';
import { describeWordBreak, measureLineBreaks, measureWordBreaks } from './lineBreaks';
import { findHousingLife, findInfantDecision, findInfantEnding, findInfantLog, openState, readLogRows, type Era } from './m7aStates';
import { measureTextResize, setRootFontPercent, textResizeViolations } from './textResize';

/**
 * M7a 영유아(0~7세) 콘텐츠의 화면 (SPEC-003 IN1~IN8, CM10·CM11·QM3-1): 영유아 결정 카드·인생 기록(마일스톤 줄 — 한 해 두 줄)·엔딩 연표를
 * 320×568·360×740 × 글자 100·150·200%에서 재고(가로 넘침 0px·글자 잘림 0·끊긴 낱말(결함) 0·구분 기호 혼자 남는 줄 0), 증거 스크린샷(qa/screenshots/003/dev-M7a-*.png)을 남긴다.
 * 상태는 실제 앱의 core로 찾은 같은 시드·같은 선택의 판이다(e2e/m7aStates.ts). 모든 테스트가 뷰포트를 직접 지정하므로 mobile-360 프로젝트에서만 돈다.
 */

const SIZES = [
  { width: 320, height: 568 },
  { width: 360, height: 740 },
] as const;
const PERCENTS = [100, 150, 200] as const;
const SHOTS = 'qa/screenshots/003';

type Screen = 'decision' | 'log' | 'seven' | 'ending';
const SCREENS: readonly Screen[] = ['decision', 'log', 'seven', 'ending'];

/** 화면 종류마다 상태를 한 번만 찾아 쓴다 (워커마다 한 번씩 찾는다) */
const cache = new Map<Screen, GameState>();
async function stateOf(page: Page, screen: Screen): Promise<GameState> {
  const hit = cache.get(screen);
  if (hit !== undefined) return hit;
  await page.goto('/');
  let s: GameState;
  if (screen === 'decision') s = await findInfantDecision(page, 'infant-new-sibling', { era: 'present', minChoices: 3, firstBorn: true });
  else if (screen === 'seven') s = await findInfantDecision(page, 'school-after-hours', { era: 'present', minChoices: 3 });
  else if (screen === 'log') s = await findInfantLog(page, 'present', { minAge: 5, includeAny: ['infant-vaccine'], minPerYear: 3 });
  else s = await findInfantEnding(page, 'present');
  cache.set(screen, s);
  return s;
}

const scopeOf = (screen: Screen) => (screen === 'ending' ? '[data-testid="ending-screen"]' : '[data-testid="life-screen"]');

for (const size of SIZES) {
  for (const percent of PERCENTS) {
    for (const screen of SCREENS) {
      test(`${size.width}x${size.height} · 글자 ${percent}% · ${screen}: 가로 넘침 0px·글자 잘림 0·끊긴 낱말(결함) 0·구분 기호 혼자 남는 줄 0 (CM11·QM3-1)`, async ({ page }, testInfo) => {
        test.skip(testInfo.project.name !== 'mobile-360', '뷰포트를 직접 지정하므로 mobile-360에서만 실행');
        test.setTimeout(120_000);
        await page.setViewportSize(size);
        const state = await stateOf(page, screen);
        await openState(page, state);
        if (screen === 'decision' || screen === 'seven') await expect(page.getByTestId('choice-panel')).toBeVisible();
        if (percent !== 100) await setRootFontPercent(page, percent);
        const label = `${size.width}x${size.height}/${percent}%/${screen}`;
        const m = await measureTextResize(page);
        // 엔딩 첫머리의 출발선 문장(#ending-journey)도 모두 단언한다 — 「상위 3~17% 사이의」가 320px·글자 200%에서 상자를 넘던 결함은 M7a r2에서 고쳤다(ui/KeepStanding#standingPieces, e2e/ending.spec.ts).
        const violations = textResizeViolations(m, label);
        expect(violations, `루트 글자 ${m.rootFontPx}px`).toEqual([]);
        const words = await measureWordBreaks(page, { scope: scopeOf(screen) });
        expect(words.checked, '잰 낱말 수(공허 통과 방지)').toBeGreaterThan(60);
        expect(words.broken.map(describeWordBreak), '한 줄 전체보다 짧은데 중간에서 끊긴 낱말(결함)').toEqual([]);
        if (percent === 100) expect(words.unavoidable.map(describeWordBreak), `글자 100%인 ${size.width}px에서는 한 줄보다 긴 낱말로 끊기는 곳도 0`).toEqual([]);
        for (const i of words.intended) expect(INTENDED_BREAK_WORDS, `의도 목록 밖 낱말이 intended로 셈: ${describeWordBreak(i)}`).toContain(i.word);
        const lines = await measureLineBreaks(page, scopeOf(screen), { separators: true, keeps: true });
        expect(lines.violations).toEqual([]);
        if (words.unavoidable.length > 0) testInfo.annotations.push({ type: 'unavoidable(참고)', description: words.unavoidable.map(describeWordBreak).join(' · ') });
      });
    }
  }
}

test('인생 기록: 마일스톤 줄이 연표에 있고, 1세처럼 같은 나이에 줄이 셋인 해(걸음마 + 첫 말 + 일반 사건)가 실제 화면에 세 줄로 보인다 (M7a IN3, r3 R-362)', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-360', 'mobile-360에서만 실행');
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 360, height: 740 });
  const state = await stateOf(page, 'log');
  await openState(page, state);
  const rows = await readLogRows(page);
  const vaccine = state.history.find((h) => h.eventId === 'infant-vaccine')!;
  expect(vaccine, '연표에 첫 예방접종 줄이 있다').toBeDefined();
  expect(rows.some((r) => r.age === `${vaccine.age}세` && r.text.includes(vaccine.text.slice(0, 18))), '인생 기록 화면에 첫 예방접종 줄이 보인다').toBe(true);
  // 같은 나이 줄이 둘 이상인 해 — 화면에서도 같은 나이 알약이 두 줄
  const perAge = new Map<string, number>();
  for (const r of rows) if (r.kind === 'event' || r.kind === 'choice') perAge.set(r.age, (perAge.get(r.age) ?? 0) + 1);
  expect([...perAge.values()].some((n) => n >= 3), '한 해 세 줄(1세)').toBe(true);
  // 마일스톤이 일어난 해마다 마일스톤 줄이 일반 줄보다 앞이고, 마일스톤끼리는 id 오름차순이다 (연표 순서 = 화면 순서) — R-372: 옛 단언은 항상 참이었다
  const MS = ['infant-vaccine', 'infant-first-steps', 'infant-first-word'];
  const yearOf = (age: number) => state.history.filter((h) => h.age === age && (h.kind === 'event' || h.kind === 'choice'));
  let checkedYears = 0;
  for (const age of new Set(state.history.filter((h) => MS.includes(h.eventId ?? '')).map((h) => h.age))) {
    const lines = yearOf(age);
    const msIdx = lines.map((h, i) => (MS.includes(h.eventId ?? '') ? i : -1)).filter((i) => i >= 0);
    const otherIdx = lines.map((h, i) => (MS.includes(h.eventId ?? '') ? -1 : i)).filter((i) => i >= 0);
    // 마일스톤 줄이 모두 일반 줄보다 앞이다: 가장 뒤의 마일스톤 < 가장 앞의 일반 줄
    if (otherIdx.length > 0) expect(Math.max(...msIdx), `${age}세: 마일스톤 줄이 일반 줄보다 앞이다`).toBeLessThan(Math.min(...otherIdx));
    // 마일스톤끼리 id 오름차순
    const msIds = msIdx.map((i) => lines[i].eventId!);
    expect(msIds, `${age}세: 마일스톤 줄은 id 오름차순`).toEqual([...msIds].sort());
    checkedYears++;
  }
  expect(checkedYears, '마일스톤이 있는 해(공허 통과 방지)').toBeGreaterThanOrEqual(2);
  // 1세는 걸음마가 첫 말보다 앞이고, 두 줄 모두 일반 사건보다 앞이다
  const one = yearOf(1).map((h) => h.eventId);
  expect(one.indexOf('infant-first-steps'), '1세: 걸음마').toBeGreaterThanOrEqual(0);
  expect(one.indexOf('infant-first-steps')).toBeLessThan(one.indexOf('infant-first-word'));
  expect(rows.length).toBe(state.history.length);
});

test('엔딩 연표: 영유아기의 한 해 세 줄(1세)이 연표에 그대로 있다 (M7a, r3)', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-360', 'mobile-360에서만 실행');
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 360, height: 740 });
  const state = await stateOf(page, 'ending');
  await openState(page, state);
  const entries = await page.evaluate(() =>
    Array.from(document.querySelectorAll('[data-testid="timeline-infant"] [data-testid="timeline-entry"]')).map((li) => ({
      age: (li.querySelector('.log__age')?.textContent ?? '').trim(),
      text: (li.textContent ?? '').replace(/\s+/g, ' ').trim(),
    })),
  );
  expect(entries.length, '영유아 묶음의 연표 줄').toBeGreaterThanOrEqual(8);
  const perAge = new Map<string, number>();
  for (const e of entries) perAge.set(e.age, (perAge.get(e.age) ?? 0) + 1);
  expect([...perAge.values()].some((n) => n >= 3), '한 해 세 줄').toBe(true);
  const vaccine = state.history.find((h) => h.eventId === 'infant-vaccine')!;
  expect(entries.some((e) => e.text.includes(vaccine.text.slice(0, 18))), '첫 예방접종 줄').toBe(true);
});

// ---------- 증거 스크린샷 (qa/screenshots/003/dev-M7a-*.png) ----------

/** 고정 머리·진행 줄이 요소 스크린샷의 가운데를 가리지 않게 증거를 찍는 동안만 숨긴다 (측정이 모두 끝난 뒤라 단언에 영향이 없다) */
const HIDE_FIXED = '[data-testid="dash-head"], [data-testid="controls"] { visibility: hidden !important; }';

async function shotCard(page: Page, state: GameState, file: string): Promise<void> {
  await openState(page, state);
  await expect(page.getByTestId('choice-panel')).toBeVisible();
  await page.addStyleTag({ content: HIDE_FIXED });
  await page.getByTestId('choice-panel').screenshot({ path: `${SHOTS}/${file}.png` });
}

async function shotLog(page: Page, state: GameState, file: string): Promise<void> {
  await openState(page, state);
  // 인생 기록은 영역 안에서 스크롤되므로 증거에는 모든 줄이 한 번에 보이게 높이 제한을 풀고 찍는다
  await page.addStyleTag({ content: `.log__list { max-height: none !important; overflow: visible !important; } ${HIDE_FIXED}` });
  await page.getByTestId('log').screenshot({ path: `${SHOTS}/${file}.png` });
}

test.describe('증거 스크린샷 (360×740)', () => {
  test.use({ viewport: { width: 360, height: 740 } });

  test('마일스톤 줄(한 해 두 줄)이 있는 인생 기록 — dev-M7a-milestone-log.png', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile-360', 'mobile-360에서만 실행');
    test.setTimeout(120_000);
    const state = await stateOf(page, 'log');
    await shotLog(page, state, 'dev-M7a-milestone-log');
  });

  test('동생 맞이 카드(첫째 판, 선택지 3개 · 조부모 선택 포함) — dev-M7a-sibling-card.png', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile-360', 'mobile-360에서만 실행');
    test.setTimeout(120_000);
    await page.goto('/');
    const state = await findInfantDecision(page, 'infant-new-sibling', { era: 'present', minChoices: 3, firstBorn: true, mustInclude: 'grandma' });
    await shotCard(page, state, 'dev-M7a-sibling-card');
    await expect(page.getByTestId('choice-help')).toBeVisible();
    await expect(page.getByTestId('choice-sulk')).toBeVisible();
    await expect(page.getByTestId('choice-grandma')).toBeVisible();
  });

  test('7세 카드(학교가 끝난 뒤, 선택지 3개) — dev-M7a-seven-card.png', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile-360', 'mobile-360에서만 실행');
    test.setTimeout(120_000);
    const state = await stateOf(page, 'seven');
    expect(state.age).toBe(7);
    await shotCard(page, state, 'dev-M7a-seven-card');
    await expect(page.getByTestId('choice-academy')).toBeVisible();
  });

  /** 재력 1단계 대 5단계 같은 이벤트 카드 — 선택지 수가 다르다(2 대 3). 같은 이벤트의 같은 카드 두 장을 나란히 증거로 남긴다. */
  const PAIRS: Array<{ file: string; event: string; era: Era; low: string[]; high: string[] }> = [
    { file: 'first-birthday', event: 'infant-first-birthday', era: 'present', low: ['small', 'skip'], high: ['grand', 'small', 'skip'] },
    { file: 'kindergarten', event: 'infant-kindergarten', era: 'present', low: ['near', 'home'], high: ['near', 'famous', 'home'] },
    { file: 'early-lessons', event: 'infant-early-lessons', era: 'present', low: ['lessons', 'play'], high: ['lessons', 'english', 'play'] },
  ];
  for (const pair of PAIRS) {
    test(`재력 1·5 비교 카드: ${pair.event} — dev-M7a-wealth-${pair.file}-1.png / -5.png (1단계 ${pair.low.length}개 대 5단계 ${pair.high.length}개)`, async ({ page }, testInfo) => {
      test.skip(testInfo.project.name !== 'mobile-360', 'mobile-360에서만 실행');
      test.setTimeout(180_000);
      for (const [tier, ids] of [[1, pair.low], [5, pair.high]] as const) {
        await page.goto('/');
        const state = await findInfantDecision(page, pair.event, { era: pair.era, tier, from: 1, to: 30000 });
        expect(state.pending!.choiceIds, `재력 ${tier}단계에 보이는 선택지`).toEqual(ids);
        await shotCard(page, state, `dev-M7a-wealth-${pair.file}-${tier}`);
        const shown = await page.evaluate(() => Array.from(document.querySelectorAll('[data-testid="choice-panel"] .choice')).map((b) => (b.getAttribute('data-testid') ?? '').replace(/^choice-/, '')));
        expect(shown, `재력 ${tier}단계 화면의 선택지`).toEqual(ids);
      }
    });
  }

  /** 시대 전용 장면: 지난 세상(연탄불의 겨울밤·장날·걸어서 등교)과 다가올 세상(돌봄 기계·말하는 인형·더위)의 서술이 연표에 한 줄씩 있다 */
  const SCENES: Array<{ file: string; era: Era; ids: string[] }> = [
    { file: 'scene-past', era: 'past', ids: ['infant-coal-winter', 'infant-market-day', 'school-first-walk'] },
    { file: 'scene-future', era: 'future', ids: ['infant-care-alert', 'infant-talking-toy', 'infant-heat-day'] },
  ];
  for (const scene of SCENES) {
    test(`시대 전용 장면 — ${scene.era}: dev-M7a-${scene.file}.png`, async ({ page }, testInfo) => {
      test.skip(testInfo.project.name !== 'mobile-360', 'mobile-360에서만 실행');
      test.setTimeout(180_000);
      await page.goto('/');
      const state = await findInfantLog(page, scene.era, { minAge: scene.era === 'past' ? 8 : 7, includeAny: scene.ids, from: 1, to: 6000 });
      const entry = state.history.find((h) => scene.ids.includes(h.eventId ?? ''))!;
      await shotLog(page, state, `dev-M7a-${scene.file}`);
      const rows = await readLogRows(page);
      expect(rows.some((r) => r.age === `${entry.age}세` && r.text.includes(entry.text.slice(0, 18))), `${entry.eventId} 줄이 인생 기록에 보인다`).toBe(true);
    });
  }
});

// ---------- C10f (QA-003-M7a, CM10): 선택지 카드가 가용 높이에는 들어가지만 12px 여유까지는 못 들어가는 띠 ----------
// 360×568·글자 200%에서 재력 4단계 5세 「취학 전의 시간표」(영향 줄 5개인 「영어 유치원에 보낸다」, 카드 336px + 링 → 링 상자 347px ≤ 가용 352px)에 Tab으로 닿으면
// 브라우저의 기본 포커스 스크롤은 스크롤 여백(12px씩)까지 맞추려다 못 맞춰 링 1.7px이 하단 띠에 가렸다. ui/focusReveal.ts#revealTopOfTallCard가 이 띠에서도 링 상자를 가용 영역 안에 둔다.
test.describe('포커스 링이 하단 띠에 가려지지 않는다 (C10f)', () => {
  for (const [width, height, percent] of [
    [360, 568, 200],
    [360, 568, 150],
    [320, 568, 200],
    [360, 640, 200],
    [360, 740, 200],
  ] as ReadonlyArray<readonly [number, number, number]>) {
    test(`${width}×${height} · 글자 ${percent}% · 취학 전의 시간표(재력 4단계) 카드를 Tab·Shift+Tab으로 훑는다 — 링 상자가 하단 띠와 겹치지 않는다`, async ({ page }, testInfo) => {
      test.skip(testInfo.project.name !== 'mobile-360', '뷰포트를 직접 지정하므로 mobile-360에서만 실행');
      test.setTimeout(120_000);
      await page.setViewportSize({ width, height });
      await page.goto('/');
      const state = await findInfantDecision(page, 'infant-early-lessons', { era: 'present', tier: 4, minChoices: 3 });
      await openState(page, state);
      await expect(page.getByTestId('choice-panel')).toBeVisible();
      if (percent !== 100) await setRootFontPercent(page, percent);
      const audit = await auditFocus(page, `${width}x${height}/${percent}%/early-lessons-t4`, { headingTestId: null });
      expect(audit.forward.some((s) => s.id === 'choice-english'), '「영어 유치원에 보낸다」에 닿았다(공허 통과 방지)').toBe(true);
      expect(audit.violations).toEqual([]);
    });
  }
});

// ---------- r3 증거 스크린샷 (qa/screenshots/003/dev-M7a-r3-*.png) ----------
// 1세 세 줄 해 · 동생 맞이 3지(플래그 있음·없음) · 자가·임차 판 비교. 모든 시험이 360×740으로 찍는다.
test.describe('r3 증거 스크린샷 (360×740)', () => {
  test.use({ viewport: { width: 360, height: 740 } });

  test('1세 한 해 세 줄(걸음마 + 첫 말 + 일반 사건) — dev-M7a-r3-year1-three-lines.png', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile-360', 'mobile-360에서만 실행');
    test.setTimeout(120_000);
    const state = await stateOf(page, 'log');
    const lines = state.history.filter((h) => h.age === 1 && (h.kind === 'event' || h.kind === 'choice'));
    expect(lines.length, '1세 연표 줄').toBeGreaterThanOrEqual(3);
    expect(lines[0].eventId).toBe('infant-first-steps');
    expect(lines[1].eventId).toBe('infant-first-word');
    await shotLog(page, state, 'dev-M7a-r3-year1-three-lines');
    const rows = await readLogRows(page);
    expect(rows.filter((r) => r.age === '1세' && (r.kind === 'event' || r.kind === 'choice')).length, '화면의 1세 줄').toBeGreaterThanOrEqual(3);
  });

  for (const [flag, include, exclude] of [
    ['조부모 플래그 있음', 'grandma', 'notice'],
    ['조부모 플래그 없음', 'notice', 'grandma'],
  ] as const) {
    test(`동생 맞이 3지선다 — ${flag}: help·sulk·${include} — dev-M7a-r3-sibling-${include}.png`, async ({ page }, testInfo) => {
      test.skip(testInfo.project.name !== 'mobile-360', 'mobile-360에서만 실행');
      test.setTimeout(120_000);
      await page.goto('/');
      const state = await findInfantDecision(page, 'infant-new-sibling', { era: 'present', minChoices: 3, firstBorn: true, mustInclude: include, mustExclude: exclude });
      expect(state.pending!.choiceIds).toEqual(['help', 'sulk', include]);
      await shotCard(page, state, `dev-M7a-r3-sibling-${include}`);
      const shown = await page.evaluate(() => Array.from(document.querySelectorAll('[data-testid="choice-panel"] .choice')).map((b) => (b.getAttribute('data-testid') ?? '').replace(/^choice-/, '')));
      expect(shown, '화면의 선택지가 3개다').toEqual(['help', 'sulk', include]);
      if (include === 'notice') {
        // R-376: 눈길 끌기를 고르면 인생 기록의 결과 문장에 건강 +1의 이유(뛰어다니며)가 읽힌다 — 증거 dev-M7a-r3-sibling-notice-result.png
        await page.getByTestId('choice-notice').click();
        const row = page.locator('[data-testid="log-row"][data-kind="choice"]', { hasText: '온 집 안을 뛰어다니며' });
        await expect(row, '고른 뒤 연표에 새 결과 문장이 보인다').toBeVisible();
        await expect(row).toContainText('꾸중을 들었지만 눈길은 아이에게 돌아왔습니다');
        await page.addStyleTag({ content: HIDE_FIXED });
        await row.scrollIntoViewIfNeeded();
        await row.screenshot({ path: `${SHOTS}/dev-M7a-r3-sibling-notice-result.png` });
      }
    });
  }

  test('자가 판 대 임차 판 (T05): 임차 판에는 「이삿짐을 싸던 날」 카드가 뜨고 자가 판에는 8세까지 한 번도 안 뜬다 — dev-M7a-r3-housing-*.png', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile-360', 'mobile-360에서만 실행');
    test.setTimeout(240_000);
    await page.goto('/');
    const own = await findHousingLife(page, 'present', 'own');
    expect(own.birth.birthReport!.housing).toBe('own');
    expect(own.moved, '자가 판은 이삿짐이 일어나지 않았다').toBe(false);
    expect(Object.keys(own.life.seen)).not.toContain('infant-moving');
    // 자가 판: 출생신고 화면(사는 집: 자가) + 8세까지의 인생 기록(이삿짐 줄 없음)
    await openStateAny(page, own.birth, 'birth-screen');
    await page.getByTestId('birth-screen').screenshot({ path: `${SHOTS}/dev-M7a-r3-housing-own-birth.png` });
    await shotLog(page, own.life, 'dev-M7a-r3-housing-own-log');
    const ownRows = await readLogRows(page);
    expect(ownRows.some((r) => r.text.includes('이삿짐') || r.text.includes('살던 집을 비워야')), '자가 판의 인생 기록에 이삿짐 줄이 없다').toBe(false);
    // 임차 판: 출생신고 화면(사는 집: 임차) + 이삿짐 결정 카드(「빚을 내어 작은 집을 산다」는 재력 3에서만 보인다)
    await page.goto('/');
    const rent = await findHousingLife(page, 'present', 'rent');
    expect(rent.birth.birthReport!.housing).toBe('rent');
    expect(rent.moved, '임차 판은 이삿짐이 일어났다').toBe(true);
    await openStateAny(page, rent.birth, 'birth-screen');
    await page.getByTestId('birth-screen').screenshot({ path: `${SHOTS}/dev-M7a-r3-housing-rent-birth.png` });
    await page.goto('/');
    const card = await findInfantDecision(page, 'infant-moving', { era: 'present', minChoices: 2, from: 1, to: 30000 });
    expect(card.birthReport!.housing === 'rent' || card.birthReport!.housing === 'free').toBe(true);
    await shotCard(page, card, 'dev-M7a-r3-housing-rent-card');
  });
});

/** 출생 직후(birth) 같은 인생 이전 단계 상태를 연다 */
async function openStateAny(page: Page, state: GameState, screenTestId: string): Promise<void> {
  await startPageHidden(page);
  await page.goto('/');
  await injectSave(page, state, '/', { speed: 1, autoMode: false });
  await expect(page.getByTestId(screenTestId)).toBeVisible();
}
