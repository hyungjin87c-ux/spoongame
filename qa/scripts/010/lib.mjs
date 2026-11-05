// SPEC-009 FM6 + SPEC-010 묶음 QA 공용 도구 (저장소 루트에서 `node qa/scripts/010/<파일>`, QA_BASE=개발 서버 주소)
import { chromium, webkit, inject, birthState, toLife, readSave, settingsEnvelope, GAME_KEY, SETTINGS_KEY, SAVE_VERSION, BASE, lifeAt } from '../009/qalib.mjs';
export { chromium, webkit, inject, birthState, toLife, readSave, settingsEnvelope, GAME_KEY, SETTINGS_KEY, SAVE_VERSION, BASE, lifeAt };

export async function evalCore(page, body, arg = null) {
  return page.evaluate(`(async () => {
    const core = await import('/src/core/index.ts');
    await (await import('/src/data/gameData.ts')).loadGameData();
    const arg = ${JSON.stringify(arg)};
    const stripPlay = (v) => {
      if (Array.isArray(v)) return v.map(stripPlay);
      if (v === null || typeof v !== 'object') return v;
      const out = {};
      for (const [k, x] of Object.entries(v)) if (!(k === 'play' && 'phase' in v && 'rngState' in v)) out[k] = stripPlay(x);
      return out;
    };
    return stripPlay(await (async () => { ${body} })());
  })()`);
}

export async function newPage(browserType, viewport = { width: 1280, height: 800 }, opt = {}) {
  const browser = await browserType.launch();
  const ctx = await browser.newContext({ viewport, hasTouch: viewport.width < 500, ...opt });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error' || (m.type() === 'warning' && /ResizeObserver/i.test(m.text()))) errors.push(m.type() + ': ' + m.text().slice(0, 200)); });
  return { browser, ctx, page, errors };
}

export function envelope(state) { return JSON.stringify({ version: SAVE_VERSION, data: state }); }

import { readFileSync } from 'node:fs';
/** SPEC-010 본표의 줄 문장 → U번호 (「…」 첫 번째) */
export function specLines() {
  const spec = readFileSync(new URL('../../../docs/spec/SPEC-010-미래연표.md', import.meta.url), 'utf8');
  const map = new Map();
  for (const m of spec.matchAll(/^\| (U\d\d)( ○)? \|[^|]*\|[^|]*?「([^」]+)」/gm)) map.set(m[3], m[1]);
  return map;
}
export const settle = (page, ms = 40) => page.evaluate((ms) => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(r, ms)))), ms);
