import { expect, test, type Page } from '@playwright/test';
import type { GameState } from '../src/core/types';
import { evalCore } from './helpers';
import { openState, type Era } from './m7aStates';

/**
 * M7e-2 증거 스크린샷 (SPEC-003 M7e, 마스터 결정 C1·R2): 기존 이벤트 101개의 본문·결과를 합쇼체로 다시 쓴 뒤의 실제 화면 — 학창·청년·중년·노년 결정 카드 각 1장과
 * 인생 기록(연표) 단계별 1장 (qa/screenshots/003/dev-M7e-2-*.png). 상태는 앱 페이지가 연 개발 서버의 core로 찾는다(같은 시드·같은 선택 → 같은 상태).
 * 카드의 모든 문장이 합쇼체로 끝나는지, 연표에 합쇼체 결과 문장이 남는지도 단언한다. 모든 시험이 360×740으로 찍으므로 mobile-360 프로젝트에서만 돈다.
 */

const SHOTS = 'qa/screenshots/003';
/** 고정 머리·진행 줄이 요소 스크린샷의 가운데를 가리지 않게 증거를 찍는 동안만 숨긴다 (측정이 모두 끝난 뒤라 단언에 영향이 없다) */
const HIDE_FIXED = '[data-testid="dash-head"], [data-testid="controls"] { visibility: hidden !important; }';

/** 선택지가 minChoices개 이상인 결정 카드(pending)가 eventId인 상태를 찾는다(앞선 결정은 첫 선택지로 넘긴다). 앱 페이지가 열려 있어야 한다. */
async function findLifeDecision(page: Page, eventId: string, opts: { era?: Era; minChoices?: number; to?: number } = {}): Promise<GameState> {
  const found = await evalCore<GameState | null>(
    page,
    `for (let seed = 1; seed < arg.to; seed++) {
       let s = core.enterLife(core.enterBirth(core.beginBirth(core.createInitialState(seed), arg.era)));
       for (let guard = 0; guard < 400 && s.phase === 'life'; guard++) {
         s = core.advanceUntilDecision(s).state;
         if (s.phase !== 'life' || s.pending === null) break;
         if (s.pending.eventId === arg.id && s.pending.choiceIds.length >= arg.min) return s;
         s = core.resolveChoice(s, s.pending.key, s.pending.choiceIds[0]);
       }
     }
     return null;`,
    { id: eventId, era: opts.era ?? 'present', min: opts.minChoices ?? 3, to: opts.to ?? 400 },
  );
  expect(found, `${eventId}: 결정 카드가 떠 있는 상태를 찾지 못했다`).not.toBeNull();
  return found!;
}

/** 70세 이상에서 선택지 없이 멈춘 대시보드 상태 중, 학창·청년·중년·노년 이벤트의 연표 줄이 모두 있는 것 (첫 선택지로 자동 진행) */
async function findFullLifeLog(page: Page, era: Era = 'present'): Promise<GameState> {
  const found = await evalCore<GameState | null>(
    page,
    `const M7A = ['school-first-day', 'school-first-walk', 'school-supplies', 'school-after-hours'];
     const stageOf = (id) => (id.startsWith('school-') && !M7A.includes(id) ? 'school' : id.startsWith('youth-') ? 'youth' : id.startsWith('middle-') ? 'middle' : id.startsWith('senior-') ? 'senior' : null);
     for (let seed = 1; seed < 400; seed++) {
       let s = core.enterLife(core.enterBirth(core.beginBirth(core.createInitialState(seed), arg.era)));
       for (let guard = 0; guard < 600 && s.phase === 'life'; guard++) {
         if (s.pending !== null) s = core.resolveChoice(s, s.pending.key, s.pending.choiceIds[0]);
         else s = core.stepYear(s).state;
         if (s.phase !== 'life' || s.pending !== null || s.age < 70) continue;
         const seen = new Set(s.history.filter((x) => (x.kind === 'event' || x.kind === 'choice') && x.eventId).map((x) => stageOf(x.eventId)).filter((x) => x !== null));
         if (seen.size === 4) return s;
       }
     }
     return null;`,
    { era },
  );
  expect(found, '학창·청년·중년·노년 연표 줄이 모두 있는 70세 이상 상태를 찾지 못했다').not.toBeNull();
  return found!;
}

const CARDS = [
  { stage: 'school', eventId: 'school-bully', note: '학창(9~15세) 「교실의 한 아이」', minChoices: 3 },
  { stage: 'youth', eventId: 'youth-housing', note: '청년(22~36세) 「살 곳을 구하는 일」', minChoices: 3 },
  { stage: 'middle', eventId: 'middle-home-loan', note: '중년(40~55세) 「넓혀 갈 집」', minChoices: 2 },
  { stage: 'senior', eventId: 'senior-gathering', note: '노년(66~82세) 「넉넉해진 시간」', minChoices: 3 },
] as const;

test.describe('M7e-2 증거 스크린샷 (360×740)', () => {
  test.use({ viewport: { width: 360, height: 740 } });

  for (const card of CARDS) {
    test(`${card.note} 결정 카드 — 본문이 합쇼체이고 보이는 선택지가 결정 카드와 같다 — dev-M7e-2-card-${card.stage}.png`, async ({ page }, testInfo) => {
      test.skip(testInfo.project.name !== 'mobile-360', 'mobile-360에서만 실행');
      test.setTimeout(120_000);
      await page.goto('/');
      const state = await findLifeDecision(page, card.eventId, { minChoices: card.minChoices });
      await openState(page, state);
      const panel = page.getByTestId('choice-panel');
      await expect(panel).toBeVisible();
      const text = (await panel.innerText()).replace(/\s+/g, ' ');
      expect(text, '카드의 문장은 모두 「~습니다.」로 끝난다(본문 + 안내 한 줄)').toMatch(/니다\./);
      expect(text, '해라체 「~다.」가 없다').not.toMatch(/(?<!니)다\./);
      expect(await page.locator('[data-testid="choice-panel"] .choice').count(), '화면의 선택지 = 결정 카드의 선택지').toBe(state.pending!.choiceIds.length);
      await page.addStyleTag({ content: HIDE_FIXED });
      await panel.screenshot({ path: `${SHOTS}/dev-M7e-2-card-${card.stage}.png` });
    });
  }

  test('인생 기록: 학창·청년·중년·노년 줄의 결과 문장이 모두 합쇼체로 남는다 — dev-M7e-2-log-{school,youth,middle,senior}.png', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile-360', 'mobile-360에서만 실행');
    test.setTimeout(240_000);
    await page.goto('/');
    const state = await findFullLifeLog(page);
    await openState(page, state);
    const rows = await page.evaluate(() =>
      Array.from(document.querySelectorAll<HTMLElement>('[data-testid="log-row"]')).map((row) => ({
        age: (row.querySelector('.log__age')?.textContent ?? '').trim(),
        text: (row.querySelector('.log__text')?.textContent ?? '').replace(/\s+/g, ' ').trim(),
        kind: row.getAttribute('data-kind') ?? '',
      })),
    );
    expect(rows.length, '화면의 연표 줄 = 연표').toBe(state.history.length);
    // 사건·선택 줄의 모든 문장은 합쇼체다 (스무 살·엔딩 같은 단계 줄은 시스템 문구라 M7e-3에서 바뀐다)
    for (const r of rows.filter((x) => x.kind === 'event' || x.kind === 'choice')) {
      const body = r.text.replace(/\s*\(선택: .*\)\s*$/, '');
      expect(body, `${r.age}: ${body}`).not.toMatch(/(?<!니)다\.(?=\s|$)/);
    }
    const STAGES = [
      { key: 'school', ages: [8, 19] },
      { key: 'youth', ages: [20, 39] },
      { key: 'middle', ages: [40, 64] },
      { key: 'senior', ages: [65, 100] },
    ] as const;
    await page.addStyleTag({ content: `.log__list { scroll-behavior: auto !important; } ${HIDE_FIXED}` });
    for (const st of STAGES) {
      // 그 단계의 첫 사건·선택 줄을 영역 맨 위로 올리고 인생 기록 카드를 찍는다
      const idx = rows.findIndex((r) => (r.kind === 'event' || r.kind === 'choice') && Number.parseInt(r.age, 10) >= st.ages[0] && Number.parseInt(r.age, 10) <= st.ages[1]);
      expect(idx, `${st.key}: 연표에 ${st.ages[0]}~${st.ages[1]}세 사건 줄이 있다`).toBeGreaterThanOrEqual(0);
      await page.evaluate((i) => {
        const list = document.querySelector<HTMLElement>('[data-testid="log"] .log__list')!;
        const row = list.querySelectorAll<HTMLElement>('[data-testid="log-row"]')[i];
        list.scrollTop = row.offsetTop - list.offsetTop;
      }, idx);
      await page.getByTestId('log').screenshot({ path: `${SHOTS}/dev-M7e-2-log-${st.key}.png` });
    }
  });
});
