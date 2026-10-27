import { expect, type Page } from '@playwright/test';
import type { Era, GameState } from '../src/core/types';
import { injectSave, startPageHidden } from './helpers';
import { SETTINGS_AUTO, SETTINGS_MANUAL, cardReady, findCardState } from './m7bStates';

/**
 * M7b 카드 e2e 공통 (m7b-focus-not-obscured · m7b-text-resize · m7b-word-breaks · m7b-line-breaks · m7b-colors).
 * 카드는 세 상태로 연다: sheet = 모달 시트(자동 모드 꺼짐) / inline = 비모달 인라인 카드(자동 모드 켜짐) / folded = 접힌 띠. 가려진 탭(startPageHidden)으로 앱 타이머를 멈춰 자동 선택이 카드를 치우지 않게 한다.
 */

export type CardUiState = 'sheet' | 'inline' | 'folded';
export const CARD_UI_STATES: readonly CardUiState[] = ['sheet', 'inline', 'folded'];

/** 상태를 심고 카드를 세 상태 중 하나로 연다. 입력 가드가 풀린 뒤 돌려준다 */
export async function openCardIn(page: Page, state: GameState, ui: CardUiState): Promise<void> {
  await injectSave(page, state, '/', ui === 'inline' ? SETTINGS_AUTO : SETTINGS_MANUAL);
  await expect(page.getByTestId('life-screen')).toBeVisible();
  await cardReady(page);
  if (ui === 'folded') {
    await page.getByTestId('decision-fold-btn').click();
    await expect(page.getByTestId('decision-fold')).toBeVisible();
    await expect(page.getByTestId('decision-reopen')).toBeEnabled();
  }
}

/** 처음 한 번만: 가려진 탭으로 앱을 연다(같은 page로 여러 카드를 갈아 끼울 때 injectSave가 새로 연다) */
export async function startHidden(page: Page): Promise<void> {
  await startPageHidden(page);
  await page.goto('/');
}

export interface LongCard {
  id: string;
  era: Era;
  /** 제목 + 상황 + 선택지 라벨 + 인용 요약 + 출처 줄의 글자 수 합 */
  total: number;
}

/**
 * 「본문 + 라벨 + 인용 + 출처의 합」이 가장 긴 카드 n개를 데이터에서 자동으로 고른다(손으로 나열하지 않는다 — 새 카드·새 인용이 들어와도 가장 긴 것이 따라온다).
 * 같은 카드는 한 번만(세상 중 가장 긴 쪽), 인용이 보이는 칸만 센다. 앱 페이지가 열려 있어야 한다.
 */
export async function longestCards(page: Page, n = 5): Promise<LongCard[]> {
  return page.evaluate<LongCard[]>(`(async () => {
    const core = await import('/src/core/index.ts');
    await (await import('/src/data/gameData.ts')).loadGameData(); // MG8: 지연 로드 덩어리를 먼저 불러온다
    const data = await import('/src/data/events/index.ts');
    const best = new Map();
    for (const ev of data.EVENT_POOL.events) {
      if (ev.choices === undefined) continue;
      // SPEC-005 QI5: 어린 시절 카드의 많은 몫은 부모님이 정하거나 흘러가서 시트로 뜨지 않는다 — 사람이 고르는 나이가 있는 카드만 센다
      if (!core.possibleAgesOf(ev).some((a) => core.decisionFor(ev.id, a) === 'self')) continue;
      for (const era of ['past', 'present', 'future']) {
        if (ev.eras !== undefined && !ev.eras.includes(era)) continue;
        const cite = core.citationFor(ev, era, 2200);
        if (cite === null) continue;
        const total = ev.title.length + ev.text.length + ev.choices.reduce((a, c) => a + c.label.length, 0) + cite.text.length + cite.sourceLine.length;
        const prev = best.get(ev.id);
        if (prev === undefined || total > prev.total) best.set(ev.id, { id: ev.id, era, total });
      }
    }
    return [...best.values()].sort((a, b) => b.total - a.total || a.id.localeCompare(b.id)).slice(0, ${n});
  })()`);
}

/** 가장 긴 카드 n개의 대기 상태를 찾는다 (앱 페이지가 열려 있어야 한다) */
export async function longestCardStates(page: Page, n = 5): Promise<Array<{ card: LongCard; state: GameState }>> {
  const cards = await longestCards(page, n);
  const out: Array<{ card: LongCard; state: GameState }> = [];
  for (const card of cards) out.push({ card, state: await findCardState(page, card.id, ({ past: 'industrial', present: 'alpha', future: 'genz' } as const)[card.era]) });
  return out;
}

/**
 * 모달 시트를 문서 흐름 안에 펼친다(감사용): 시트는 94dvh 안의 스크롤 영역이라 아래쪽(선택지·안내)이 안쪽 스크롤 밖에 있으면 낱말·줄 감사기가 「안 보이는 글자」로 건너뛴다.
 * 폭은 그대로(시트의 max-width·가로 배치)이고 세로만 제한을 풀어 카드 전부를 한 번에 잰다 — 낱말 끊김·줄바꿈은 가로 폭이 정한다.
 */
export async function expandSheet(page: Page): Promise<void> {
  await page.addStyleTag({
    content: '.overlay { position: absolute !important; inset: auto !important; top: 0; left: 0; right: 0; height: auto !important; display: block !important; background: transparent !important; } .sheet { max-height: none !important; overflow: visible !important; margin: 0 auto; border-bottom: 1px solid var(--c-border-strong); }',
  });
}
