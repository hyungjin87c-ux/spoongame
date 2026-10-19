// QA-003 M7b(중대 결정 카드 UI·인용) 공용 라이브러리. 앱 코드는 건드리지 않고 브라우저로만 조작한다.
// 결과: qa/results/m7b/*.jsonl, 스크린샷: qa/screenshots/003/M7b-<케이스ID>[-<접미>].png
// M4 공용(m4-lib)의 도구(실행·콘솔 수집·시드 고정·화면 열기)를 그대로 쓰고, 케이스·스크린샷·결과 위치만 M7b로 바꾼다.
import fs from 'node:fs';
import path from 'node:path';
import { con, ROOT, PROD, DEV, GAME_KEY, SETTINGS_KEY, launch, sleep, mkctx, fixSeed, cleanStorageOnce, openTitle, toRoulette, skipToBirth, birthToLife, newGameToLife, waitGuard, readRaw, saveJson, overflowX, whichScreen, bodyText, pickEra, readBirth, readDash, setRootFont, rand, VP, TOUCH, STD_VIEWPORTS, parseRgb } from './m4-lib.mjs';

export { con, ROOT, PROD, DEV, GAME_KEY, SETTINGS_KEY, launch, sleep, mkctx, fixSeed, cleanStorageOnce, openTitle, toRoulette, skipToBirth, birthToLife, newGameToLife, waitGuard, readRaw, saveJson, overflowX, whichScreen, bodyText, pickEra, readBirth, readDash, setRootFont, rand, VP, TOUCH, STD_VIEWPORTS, parseRgb };

export const RP = process.env.QA_RP || '';
export const SHOT_PREFIX = process.env.QA_SHOT_PREFIX || 'M7b';
export const SHOT_DIR = path.join(ROOT, 'qa', 'screenshots', '003');
export const OUT = process.env.QA_OUT ? path.resolve(ROOT, process.env.QA_OUT) : path.join(ROOT, 'qa', 'results', 'm7b');
fs.mkdirSync(SHOT_DIR, { recursive: true });
fs.mkdirSync(OUT, { recursive: true });

export const SAVE_VERSION = 8;
export const SETTINGS_VERSION = 3;

export async function shot(page, id, suffix = '', opts = {}) {
  const name = `${SHOT_PREFIX}-${id}${suffix ? '-' + suffix : ''}.png`;
  await page.screenshot({ path: path.join(SHOT_DIR, name), fullPage: !!opts.full });
  return `qa/screenshots/003/${name}`;
}

export const CASES = process.env.QA_CASES || path.join(OUT, RP + 'cases.jsonl');

/** 케이스 하나를 돌리고 결과를 cases.jsonl에 쌓는다. fn은 { verdict, actual, shots } 를 돌려준다. */
export async function runCase(c, fn) {
  con.take();
  con.takeRequests();
  const t0 = Date.now();
  let r;
  try {
    r = await fn();
  } catch (e) {
    const scrub = (t) => t.split(ROOT).join('<repo>').replace(/[A-Za-z]:[\\/][^\s)'"]*/g, '<path>').replace(/file:\/\/\/[^\s)'"]*/g, '<file>');
    r = { verdict: 'ERROR', actual: `스크립트 오류: ${scrub(String(e && e.stack ? e.stack : e)).slice(0, 700)}`, shots: [] };
  }
  const consoleItems = con.take();
  const ext = con
    .takeRequests()
    .filter((u) => !/^(data:|blob:|about:)/.test(u))
    .filter((u) => {
      try {
        const h = new URL(u).hostname;
        return !(h === '127.0.0.1' || h === 'localhost');
      } catch {
        return true;
      }
    });
  const rec = { ...c, ...r, console: consoleItems, externalRequests: ext, ms: Date.now() - t0, at: new Date().toISOString() };
  fs.appendFileSync(CASES, JSON.stringify(rec) + '\n');
  console.log(`[${r.verdict}] ${c.id} ${c.title} :: ${String(r.actual || '').slice(0, 300)}${consoleItems.length ? ` (console ${consoleItems.length})` : ''}${ext.length ? ` (외부요청 ${ext.length})` : ''}`);
  return rec;
}

export function addCase(rec) {
  const full = { console: [], externalRequests: [], shots: [], at: new Date().toISOString(), ...rec };
  fs.appendFileSync(CASES, JSON.stringify(full) + '\n');
  console.log(`[${full.verdict}] ${full.id} ${full.title || ''} :: ${String(full.actual || '').slice(0, 300)}`);
}

export function appendJsonl(file, obj) {
  fs.appendFileSync(path.join(OUT, file), JSON.stringify(obj) + '\n');
}

/** 개발 서버의 core 모듈을 브라우저에서 불러 순수 함수를 실행한다(상태 만들기용 오라클, 앱 코드는 그대로). 개발 서버 페이지에서만 */
export async function evalCore(page, body, arg = null) {
  return page.evaluate(`(async () => {
    const core = await import('/src/core/index.ts');
    const arg = ${JSON.stringify(arg)};
    ${body}
  })()`);
}

/** 카드 eventId가 대기 중인 인생 상태를 찾는다(첫 선택지로 앞선 결정을 넘김). era별, 출생 연도 범위(minBirth/maxBirth) 지정 가능 */
export async function findCardState(page, eventId, era = 'present', opts = {}) {
  return evalCore(
    page,
    `for (let seed = arg.from; seed < arg.to; seed++) {
       let s = core.enterLife(core.enterBirth(core.beginBirth(core.createInitialState(seed), arg.era)));
       if (arg.minBirth && s.character.birthYear < arg.minBirth) continue;
       if (arg.maxBirth && s.character.birthYear > arg.maxBirth) continue;
       for (let guard = 0; guard < 80 && s.phase === 'life' && s.age <= arg.maxAge; guard++) {
         s = core.advanceUntilDecision(s).state;
         if (s.phase !== 'life' || s.pending === null) break;
         if (s.pending.eventId === arg.id && s.pending.choiceIds.length >= arg.min) return s;
         s = core.resolveChoice(s, s.pending.key, s.pending.choiceIds[0]);
       }
     }
     return null;`,
    { id: eventId, era, min: opts.minChoices ?? 2, from: opts.from ?? 1, to: opts.to ?? 6000, maxAge: opts.maxAge ?? 100, minBirth: opts.minBirth ?? 0, maxBirth: opts.maxBirth ?? 0 },
  );
}

export function settingsEnvelope(s) {
  return JSON.stringify({ version: SETTINGS_VERSION, data: { era: 'present', lifeLength: 'short30', bgm: { on: false, volume: 30 }, theme: 'system', ...s } });
}
export const SET_MANUAL = { speed: 1, autoMode: false };
export const SET_AUTO = { speed: 1, autoMode: true };

/** 저장을 심고 인생 화면을 연다. 앱 한 번 연 뒤 localStorage를 덮고(앱의 pagehide 저장이 덮지 않게 storage 이벤트로 앱을 「밀린 화면」으로 멈춘 뒤) 다시 연다. base는 PROD 또는 DEV */
export async function injectSave(page, state, base, settings = SET_MANUAL, query = '') {
  await page.goto(base, { waitUntil: 'load' });
  await page.waitForFunction((k) => localStorage.getItem(k) !== null, GAME_KEY, { timeout: 15000 });
  await page.evaluate(
    ([k, v, sk, sv]) => {
      localStorage.setItem(k, v);
      if (sv) localStorage.setItem(sk, sv);
    },
    [GAME_KEY, JSON.stringify({ version: SAVE_VERSION, data: state }), SETTINGS_KEY, settingsEnvelope(settings)],
  );
  await page.evaluate((k) => window.dispatchEvent(new StorageEvent('storage', { key: k })), GAME_KEY);
  await page.getByTestId('superseded-screen').waitFor({ state: 'attached', timeout: 3000 }).catch(() => {});
  await page.goto(base + query, { waitUntil: 'load' });
}

/** 지금 화면의 카드(시트·인라인·접힌 띠)를 읽는다 */
export const READ_CARD = () => {
  const q = (s) => document.querySelector(s);
  const qa = (s) => [...document.querySelectorAll(s)];
  const tx = (e) => (e ? e.textContent.replace(/\s+/g, ' ').trim() : null);
  const panel = q('[data-testid="choice-panel"]');
  const fold = q('[data-testid="decision-fold"]');
  const cite = q('[data-testid="cite"]');
  const choices = panel
    ? [...panel.querySelectorAll('.choice')].map((b) => ({
        id: (b.getAttribute('data-testid') || '').replace('choice-', ''),
        label: tx(b.querySelector('.choice__label')),
        impact: [...b.querySelectorAll('.impact__item')].map((i) => tx(i.querySelector('.impact__show'))),
        disabled: b.getAttribute('aria-disabled') === 'true' || b.disabled === true,
        name: b.getAttribute('aria-label'),
      }))
    : [];
  const active = document.activeElement;
  return {
    screen: ['title-screen', 'roulette-screen', 'birth-screen', 'life-screen', 'ending-screen', 'superseded-screen', 'error-screen'].find((id) => q(`[data-testid="${id}"]`)) || 'unknown',
    mode: panel ? panel.getAttribute('data-mode') : fold ? 'fold' : null,
    key: panel ? panel.getAttribute('data-key') : fold ? fold.getAttribute('data-key') : null,
    title: tx(q('[data-testid="choice-title"]')) ?? tx(q('[data-testid="decision-fold-title"]')),
    text: tx(q('[data-testid="choice-text"]')),
    when: tx(q('[data-testid="decision-when"]')),
    kindLabel: tx(q('.decision__kind')),
    cite: cite
      ? {
          id: cite.getAttribute('data-citation'),
          kind: tx(cite.querySelector('.cite__kind')),
          text: tx(cite.querySelector('[data-testid="cite-text"]')),
          src: tx(cite.querySelector('[data-testid="cite-src"]')),
          links: cite.querySelectorAll('a, [href]').length,
          html: cite.innerHTML,
        }
      : null,
    choices,
    hint: tx(q('.decision__hint')),
    autoNote: tx(q('[data-testid="auto-note"]')),
    foldNote: fold ? tx(fold.querySelector('.fold__note')) : null,
    reopenName: q('[data-testid="decision-reopen"]') ? q('[data-testid="decision-reopen"]').getAttribute('aria-labelledby') : null,
    age: q('[data-testid="life-age"] b') ? parseInt(q('[data-testid="life-age"] b').textContent, 10) : null,
    year: tx(q('[data-testid="life-year"]')),
    pct: q('[data-testid="year-progress"]') ? q('[data-testid="year-progress"]').getAttribute('aria-valuenow') : null,
    paused: q('[data-testid="pause"]') ? q('[data-testid="pause"]').getAttribute('data-paused') : null,
    auto: q('[data-testid="auto"]') ? q('[data-testid="auto"]').getAttribute('aria-pressed') : null,
    activeTid: active ? active.getAttribute('data-testid') || (active.getAttribute('data-speed') ? 'speed-' + active.getAttribute('data-speed') : active.tagName) : 'none',
    dialogCount: qa('[role="dialog"]').length,
    docOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    exitAsk: !!q('[data-testid="exit-ask"]'),
    theme: document.documentElement.getAttribute('data-theme'),
  };
};

export const readCard = (page) => page.evaluate(READ_CARD);

/** 카드 입력 가드(400ms)가 풀릴 때까지 */
export async function cardReady(page) {
  await page.waitForFunction(
    () => {
      const b = document.querySelector('[data-testid="decision-fold-btn"]');
      return b !== null && b.getAttribute('aria-disabled') !== 'true' && !b.disabled;
    },
    null,
    { timeout: 8000 },
  );
}

/** 저장 읽기 */
export async function readSave(page) {
  const raw = await page.evaluate((k) => localStorage.getItem(k), GAME_KEY);
  return raw ? JSON.parse(raw) : null;
}
export const choiceCount = (save) => (save ? save.data.history.filter((h) => h.kind === 'choice').length : -1);

export const hashFiles = async (dir) => {
  const { createHash } = await import('node:crypto');
  const files = [];
  const walk = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else files.push(p);
    }
  };
  walk(dir);
  files.sort();
  const h = createHash('sha256');
  for (const f of files) {
    h.update(path.relative(dir, f).replace(/\\/g, '/'));
    h.update('\0');
    h.update(fs.readFileSync(f));
    h.update('\0');
  }
  return { count: files.length, sha: h.digest('hex') };
};
