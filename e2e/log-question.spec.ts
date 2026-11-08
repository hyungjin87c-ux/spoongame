import { expect, test, type Page } from '@playwright/test';
import type { GameState } from '../src/core/types';
import { injectSave, noHorizontalOverflow } from './helpers';
import { MANUAL } from './parentStates';
import { setRootFontPercent } from './textResize';

/**
 * 인생 기록 결정 줄의 질문 (SPEC-012 QF4, 완료 기준 8 — docs/design/log-question.md 안 2): 제목이 있는 결정 줄은 「사건 제목(작게, data-testid="log-q") → 고른 길 → 결과」 세 줄이고 괄호가 없다.
 * 가린 줄은 제목도 가린다. 옛 저장(v0.4.0·v0.3.0 실제 원문 fixture)도 열자마자 저장된 title이 제목으로 나온다(새 필드 0). Chromium 두 프로젝트(mobile-360·desktop)에서 돈다.
 */

test.describe.configure({ timeout: 120_000 });

/** 실제 저장 원문 고정 파일(tests/fixtures/save-v0X0-*.json)의 게임 상태 — e2e 타입 설정에는 Node 타입이 없어 `node:fs`를 동적으로 불러 읽는다(parent-subject.spec.ts와 같다) */
async function fixture(file: string): Promise<GameState> {
  const nodeFs = 'node:fs';
  const fs = (await import(nodeFs)) as { readFileSync(path: string, encoding: 'utf-8'): string };
  return (JSON.parse(fs.readFileSync(`tests/fixtures/${file}.json`, 'utf-8')) as { data: GameState }).data;
}

interface Row {
  age: string;
  qText: string | null;
  qSize: string | null;
  qColor: string | null;
  qWeight: string | null;
  ageColor: string;
  rowLatest: boolean;
  /** 제목·고른 길·결과의 위쪽 좌표(위에서 아래로 놓였는가) */
  tops: { q: number | null; pick: number | null; result: number | null };
  text: string;
  veiled: boolean;
}

async function rowsOf(page: Page): Promise<Row[]> {
  return page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>('[data-testid="log-row"]')].map((r) => {
      const q = r.querySelector<HTMLElement>('[data-testid="log-q"]');
      const cs = q ? getComputedStyle(q) : null;
      const pick = r.querySelector<HTMLElement>('.log__text em:not([hidden])');
      const result = r.querySelector<HTMLElement>('.log__result');
      return {
        age: r.querySelector('.log__age')?.textContent?.trim() ?? '',
        qText: q ? (q.textContent ?? '') : null,
        qSize: cs ? cs.fontSize : null,
        qColor: cs ? cs.color : null,
        qWeight: cs ? cs.fontWeight : null,
        ageColor: getComputedStyle(r.querySelector('.log__age')!).color,
        rowLatest: r.classList.contains('log__row--latest'),
        tops: { q: q ? q.getBoundingClientRect().top : null, pick: pick ? pick.getBoundingClientRect().top : null, result: result ? result.getBoundingClientRect().top : null },
        text: (r.querySelector('.log__text')?.textContent ?? '').replace(/\s+/g, ' ').trim(),
        veiled: r.getAttribute('data-veiled') === 'true',
      };
    }),
  );
}

const choiceLines = (g: GameState) => g.history.filter((h) => h.kind === 'choice');

test.describe('제목이 있는 결정 줄: 제목 → 고른 길 → 결과 (v0.4.0 저장 원문)', () => {
  test('mother-age20: 결정 줄마다 log-q가 있고 글자가 저장된 title이다 · 괄호 꼴이 없다 · 서술·단계 줄에는 log-q가 없다', async ({ page }) => {
    const save = await fixture('save-v040-mother-age20');
    await injectSave(page, save, '/', MANUAL);
    await expect(page.getByTestId('life-screen')).toBeVisible();
    const rows = await rowsOf(page);
    const lines = choiceLines(save).filter((h) => h.title);
    expect(lines.length, '제목 있는 결정 줄(공허 통과 방지)').toBeGreaterThan(3);
    const withQ = rows.filter((r) => r.qText !== null);
    expect(withQ.map((r) => r.qText).sort()).toEqual(lines.map((h) => h.title).sort());
    for (const r of withQ) {
      expect(r.text, `${r.age}: 괄호 꼴이 아니다`).not.toMatch(/\((선택|부모님이|어머니가|아버지가|이렇게)/);
      expect(r.tops.q!, `${r.age}: 제목이 고른 길보다 위`).toBeLessThan(r.tops.pick!);
      expect(r.tops.pick!, `${r.age}: 고른 길이 결과보다 위`).toBeLessThan(r.tops.result!);
    }
    // 서술·단계 줄에는 없다
    const noQ = await page.locator('[data-testid="log-row"]:not([data-kind="choice"]) [data-testid="log-q"]').count();
    expect(noQ).toBe(0);
    expect(await noHorizontalOverflow(page)).toBe(true);
  });

  test('제목 글자는 본문보다 작다: 12px · 보조색(나이 칸과 같은 색) · 보통 굵기 — 가장 최근 줄(굵게)에서도 보통이다', async ({ page }) => {
    const save = await fixture('save-v040-both-age20');
    await injectSave(page, save, '/', MANUAL);
    await expect(page.getByTestId('life-screen')).toBeVisible();
    const rows = (await rowsOf(page)).filter((r) => r.qText !== null);
    expect(rows.length).toBeGreaterThan(0);
    for (const r of rows) {
      expect(r.qSize, `${r.age}: 12px`).toBe('12px');
      expect(r.qColor, `${r.age}: --c-text-2 = 나이 칸과 같은 색`).toBe(r.ageColor);
      expect(r.qWeight, `${r.age}: 보통 굵기`).toBe('400');
    }
    // 최신 줄을 굵게 하는 규칙이 제목까지 번지지 않는다 — 굵은 줄에 임의의 제목을 심어 확인한다
    const latestBold = await page.evaluate(() => {
      const row = document.querySelector<HTMLElement>('.log__row--latest')!;
      const q = document.createElement('span');
      q.className = 'log__q';
      q.textContent = '시험 제목';
      row.querySelector('.log__text')!.prepend(q);
      return { rowWeight: getComputedStyle(row).fontWeight, qWeight: getComputedStyle(q).fontWeight };
    });
    expect(Number(latestBold.rowWeight)).toBeGreaterThanOrEqual(700);
    expect(latestBold.qWeight).toBe('400');
  });

  test('글자 200%: 가로 넘침 0이고 세 줄이 겹치지 않는다(제목 아래에 고른 길, 그 아래에 결과)', async ({ page }) => {
    await injectSave(page, await fixture('save-v040-mother-age20'), '/', MANUAL);
    await expect(page.getByTestId('life-screen')).toBeVisible();
    await setRootFontPercent(page, 200);
    expect(await noHorizontalOverflow(page)).toBe(true);
    const boxes = await page.evaluate(() =>
      [...document.querySelectorAll<HTMLElement>('[data-testid="log-row"]')].filter((r) => r.querySelector('[data-testid="log-q"]')).map((r) => {
        const b = (sel: string) => r.querySelector<HTMLElement>(sel)!.getBoundingClientRect();
        const q = b('[data-testid="log-q"]');
        const pick = b('.log__text em:not([hidden])');
        const res = b('.log__result');
        return { qBottom: q.bottom, pickTop: pick.top, pickBottom: pick.bottom, resTop: res.top };
      }),
    );
    expect(boxes.length).toBeGreaterThan(0);
    for (const x of boxes) {
      expect(x.pickTop).toBeGreaterThanOrEqual(x.qBottom - 0.5);
      expect(x.resTop).toBeGreaterThanOrEqual(x.pickBottom - 0.5);
    }
  });
});

test.describe('가린 줄은 제목도 가린다 (무거운 장면 가리기)', () => {
  test('접힘에서는 가린 줄의 제목이 보이지 않고(접근성 트리·찾기에서 빠진다), 「펼쳐 보기」를 누르면 제목·고른 길·결과가 보인다', async ({ page }) => {
    const save = await fixture('save-v040-mother-age20');
    await injectSave(page, save, '/', { ...MANUAL, gentle: true });
    await expect(page.getByTestId('life-screen')).toBeVisible();
    const veiled = page.locator('[data-testid="log-row"][data-veiled="true"]');
    const n = await veiled.count();
    expect(n, '가린 줄(공허 통과 방지)').toBeGreaterThan(0);
    for (let i = 0; i < n; i++) {
      const row = veiled.nth(i);
      await expect(row.getByTestId('log-q')).toBeHidden();
      expect(await row.locator('[data-testid="log-q"]:visible').count(), '접힘: 보이는 제목 0').toBe(0);
    }
    const first = veiled.first();
    const title = await first.getByTestId('log-q').evaluate((el) => el.textContent ?? '');
    await first.getByTestId('veil-btn').click();
    await expect(first.getByTestId('log-q')).toBeVisible();
    await expect(first.getByTestId('log-q')).toHaveText(title);
    await expect(first.getByTestId('veil-body')).toBeVisible();
    expect(await noHorizontalOverflow(page)).toBe(true);
  });
});

test.describe('옛 저장도 열자마자 제목이 나온다 (사건 풀 조회 없이 저장된 title로)', () => {
  for (const file of ['save-v040-both-age20', 'save-v040-father-ended', 'save-v030-age20', 'save-v030-age65']) {
    test(`${file}: 제목 있는 결정 줄마다 log-q, 제목 없는 결정 줄은 옛 괄호 꼴`, async ({ page }) => {
      const save = await fixture(file);
      await injectSave(page, save, '/', MANUAL);
      await expect(page.getByTestId('life-screen').or(page.getByTestId('ending-screen'))).toBeVisible();
      if (file.includes('ended')) return; // 엔딩 판은 인생 기록 카드가 없다 — 열림만 확인(엔딩 연표는 이 변경에 닿지 않는다)
      const rows = await rowsOf(page);
      const lines = choiceLines(save);
      const titled = lines.filter((h) => h.title);
      expect(rows.filter((r) => r.qText !== null)).toHaveLength(titled.length);
      for (const h of lines.filter((x) => !x.title)) {
        expect(rows.some((r) => r.text.includes(`${h.text} (`)), `${h.age}세 제목 없는 줄은 괄호 꼴`).toBe(true);
      }
      expect(await noHorizontalOverflow(page)).toBe(true);
    });
  }
});
