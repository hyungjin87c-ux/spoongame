// QA-003 M5 감사 공용: 저장 원문(qa/results/m5/saves)으로 영향 줄이 붙은 선택지 카드·자산 카드·엔딩 줄을 원하는 상태로 연다. (M4의 m4-states.mjs와 같은 방식)
import fs from 'node:fs';
import path from 'node:path';
import { mkctx, sleep, PROD, OUT, GAME_KEY, SETTINGS_KEY, setRootFont } from './m5-lib.mjs';

export const SAVES = path.join(OUT, 'saves');
export const loadSave = (era, tag) => JSON.parse(fs.readFileSync(path.join(SAVES, `${era}-${tag}.json`), 'utf8')).game;

/** 감사 상태 이름: 세상은 따로 고른다 */
export const STATES = ['young-choice', 'adult-choice', 'adult-dash', 'neg-dash', 'extreme-neg', 'extreme-big', 'ending', 'ending-neg', 'ending-zero', 'ending-early'];
const SCREEN = (state) => (state.startsWith('ending') ? 'ending-screen' : 'life-screen');

export async function openState(browser, state, { era = 'present', vp, font = 100, ctxOpts = {}, settingsRaw = null, base = PROD }) {
  const opts = { viewport: { width: vp.width, height: vp.height }, ...(vp.touch ? { hasTouch: true, isMobile: true, deviceScaleFactor: 2 } : {}), ...ctxOpts };
  const ctx = await mkctx(browser, opts);
  const raw = loadSave(era, state);
  await ctx.addInitScript(
    ([k, v]) => {
      try {
        if (!sessionStorage.getItem('__qa_seeded')) {
          localStorage.clear();
          localStorage.setItem(k, v);
          sessionStorage.setItem('__qa_seeded', '1');
        }
      } catch {}
    },
    [GAME_KEY, raw],
  );
  if (settingsRaw) {
    await ctx.addInitScript(
      ([k, v]) => {
        try {
          if (!sessionStorage.getItem('__qa_seeded_s')) {
            localStorage.setItem(k, v);
            sessionStorage.setItem('__qa_seeded_s', '1');
          }
        } catch {}
      },
      [SETTINGS_KEY, settingsRaw],
    );
  }
  const page = await ctx.newPage();
  await page.goto(base, { waitUntil: 'load' });
  await page.waitForSelector(`[data-testid="${SCREEN(state)}"]`, { timeout: 15000 });
  if (state.endsWith('choice')) {
    await page.waitForSelector('[data-testid="choice-panel"]', { timeout: 15000 });
    await page.waitForFunction(() => [...document.querySelectorAll('[data-testid="choice-panel"] .choice')].every((b) => b.getAttribute('aria-disabled') !== 'true'), null, { timeout: 6000 });
  }
  await sleep(300);
  if (font !== 100) await setRootFont(page, font);
  await sleep(250);
  return { ctx, page };
}

export const VPS = [
  { name: '320x568', width: 320, height: 568 },
  { name: '360x568', width: 360, height: 568 },
  { name: '360x740-touch', width: 360, height: 740, touch: true },
  { name: '375x812', width: 375, height: 812 },
  { name: '667x375-landscape', width: 667, height: 375 },
  { name: '768x1024', width: 768, height: 1024 },
  { name: '1024x768', width: 1024, height: 768 },
  { name: '1280x620', width: 1280, height: 620 },
  { name: '1280x800', width: 1280, height: 800 },
  { name: '640x400-zoom200', width: 640, height: 400 },
  { name: '320x256-zoom400', width: 320, height: 256 },
];
