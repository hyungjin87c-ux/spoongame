// QA-003 M4 감사 공용: 저장 원문(fixtures)으로 대시보드·엔딩·밀린·오류 화면을 원하는 상태로 연다.
import fs from 'node:fs';
import path from 'node:path';
import { mkctx, fixSeed, sleep, PROD, DEV, OUT, GAME_KEY, SETTINGS_KEY, setRootFont, waitGuard } from './m4-lib.mjs';

export const SAVES = path.join(OUT, 'saves');
export const loadSave = (era, tag) => JSON.parse(fs.readFileSync(path.join(SAVES, `${era}-${tag}.json`), 'utf8')).game;

/** 감사 상태 이름 → 만드는 방법 */
export const STATES = ['infant', 'age10', 'age30', 'age78', 'pending', 'exit-ask', 'tools-open', 'ending', 'superseded', 'error'];

/** 상태를 연다. 반환: { ctx, page }. opts: { era, vp:{width,height,touch}, font, ctxOpts } */
export async function openState(browser, state, { era = 'present', vp, font = 100, ctxOpts = {}, saveTag = null, settingsRaw = null }) {
  const base = { viewport: { width: vp.width, height: vp.height }, ...(vp.touch ? { hasTouch: true, isMobile: true, deviceScaleFactor: 2 } : {}), ...ctxOpts };
  const ctx = await mkctx(browser, base);
  const tag = saveTag ?? { infant: 'infant', age10: 'age10', age30: 'age30', age78: 'age78', pending: 'pending', 'exit-ask': 'age30', 'tools-open': 'age30', ending: 'ending', superseded: 'age10', error: 'age10' }[state];
  const raw = loadSave(era, tag);
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
  const url = state === 'error' ? DEV + '?__crash' : PROD;
  await page.goto(url, { waitUntil: 'load' });
  const want = { ending: 'ending-screen', error: 'error-screen' }[state] ?? 'life-screen';
  if (state === 'superseded') {
    await page.waitForSelector('[data-testid="life-screen"]', { timeout: 15000 });
    const other = await ctx.newPage();
    await other.goto(PROD, { waitUntil: 'load' });
    await other.evaluate(([k, v]) => localStorage.setItem(k, v), [GAME_KEY, loadSave(era, 'age16')]);
    await other.close();
    await page.waitForSelector('[data-testid="superseded-screen"]', { timeout: 8000 });
  } else {
    await page.waitForSelector(`[data-testid="${want}"]`, { timeout: 15000 });
  }
  await sleep(300);
  if (state === 'exit-ask') {
    await page.getByTestId('tool-exit').click();
    await page.waitForSelector('[data-testid="exit-ask"]');
  }
  if (state === 'tools-open') {
    await page.getByTestId('tool-bgm').click();
    await page.waitForSelector('[data-testid="bgm-volume-input"]');
  }
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
