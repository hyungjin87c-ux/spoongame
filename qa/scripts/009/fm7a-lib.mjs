// QA(SPEC-009 FM7a) 브라우저 도우미 — qalib.mjs 위에. 저장 주입 규칙은 e2e/saves.ts 와 같다. 저장소 루트에서 `node qa/scripts/009/<파일>`, QA_BASE=개발 서버
import { chromium, webkit, GAME_KEY, SETTINGS_KEY, settingsEnvelope, BASE } from './qalib.mjs';
import { readFileSync } from 'node:fs';
export { chromium, webkit, GAME_KEY, SETTINGS_KEY, settingsEnvelope, BASE };

export const STATES = process.env.QA_STATES ?? 'qa/scripts/009/fm7a-states';
export const loadState = (key) => JSON.parse(readFileSync(`${STATES}/${key}.json`, 'utf8'));
export const picks = () => JSON.parse(readFileSync(`${STATES}/_picks.json`, 'utf8'));

export async function stopSaving(page) {
  for (let i = 0; i < 3; i++) {
    await page.evaluate((k) => window.dispatchEvent(new StorageEvent('storage', { key: k })), GAME_KEY);
    try { await page.getByTestId('superseded-screen').waitFor({ state: 'attached', timeout: 1000 }); return; } catch {}
  }
}

/** 저장(봉투 포함 또는 data만)을 주입하고 life 화면을 연다. scale = ?__timescale */
export async function boot(browser, st, { settings = {}, scale = 30, viewport = { width: 1280, height: 800 }, ctxOpts = {}, raw = null } = {}) {
  const ctx = await browser.newContext({ viewport, hasTouch: viewport.width < 500, locale: 'ko-KR', ...ctxOpts });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text().slice(0, 200)); });
  await page.goto(BASE + '/');
  await page.waitForFunction((k) => localStorage.getItem(k) !== null, GAME_KEY);
  await page.evaluate(([k, v, sk, sv]) => { localStorage.setItem(k, v); localStorage.setItem(sk, sv); }, [GAME_KEY, raw ?? JSON.stringify(st), SETTINGS_KEY, settingsEnvelope({ speed: 1, autoMode: false, noteCards: false, ...settings })]);
  await stopSaving(page);
  await page.goto(BASE + `/?__timescale=${scale}`);
  return { ctx, page, errors };
}

export const readSave = async (page) => {
  const raw = await page.evaluate((k) => localStorage.getItem(k), GAME_KEY);
  return raw === null ? null : JSON.parse(raw);
};

/** 인생 기록(위가 최신) 한 줄씩 — 눈에 보이는 글 그대로 */
export async function logRows(page) {
  return page.evaluate(() => [...document.querySelectorAll('[data-testid="log-list"] > li, [data-testid="log-list"] li')].map((li) => li.textContent.replace(/\s+/g, ' ').trim()));
}

/** 결정 카드가 떠 있으면 그 글과 선택지 */
export async function cardNow(page) {
  return page.evaluate(() => {
    const btns = [...document.querySelectorAll('button[data-testid^="choice-"]')].filter((b) => !['choice-ask', 'choice-hint', 'choice-panel', 'choice-text', 'choice-title'].includes(b.getAttribute('data-testid')));
    if (btns.length === 0) return null;
    const panel = document.querySelector('[data-testid="choice-panel"]');
    return {
      title: document.querySelector('[data-testid="choice-title"]')?.textContent?.trim() ?? '',
      text: document.querySelector('[data-testid="choice-text"]')?.textContent?.trim() ?? '',
      choices: btns.map((b) => ({ id: b.getAttribute('data-testid').replace(/^choice-/, ''), label: (b.querySelector('.choice__label')?.textContent ?? b.textContent).replace(/\s+/g, ' ').trim() })),
      panelText: panel?.textContent?.replace(/\s+/g, ' ').trim() ?? '',
    };
  });
}

export const ageNow = (page) => page.evaluate(() => Number(document.querySelector('[data-testid="life-age"]')?.textContent?.match(/\d+/)?.[0] ?? -1));

/** 목표 나이(그 해가 끝날 때까지)까지 진행. 결정 카드는 pick(card, nth)로 고른다(기본 첫 선택지). 카드가 뜬 순간마다 onCard(card)를 부른다 */
export async function playTo(page, targetAge, { pick = () => 0, onCard = null, maxMs = 90000 } = {}) {
  const t0 = Date.now();
  const cards = [];
  while (Date.now() - t0 < maxMs) {
    if (await page.getByTestId('ending-screen').isVisible().catch(() => false)) return { cards, ended: true };
    const card = await cardNow(page);
    if (card) {
      cards.push({ age: await ageNow(page), ...card });
      if (onCard) await onCard(card);
      const i = pick(card, cards.length - 1);
      await page.getByTestId(`choice-${card.choices[Math.min(i, card.choices.length - 1)].id}`).click({ timeout: 3000 }).catch(() => {});
      await page.waitForTimeout(60);
      continue;
    }
    const a = await ageNow(page);
    if (a >= targetAge) return { cards, ended: false };
    // 멈춰 있으면(일시정지) 이어 간다
    const paused = await page.getByTestId('pause').getAttribute('data-paused').catch(() => null);
    if (paused === 'true') await page.getByTestId('pause').click().catch(() => {});
    await page.waitForTimeout(40);
  }
  return { cards, ended: false, timeout: true };
}
