// QA-003 M7c(자유 기록 「생각 남기기」) 공용 라이브러리. 앱 코드는 건드리지 않고 브라우저로만 조작한다.
// 결과: qa/results/m7c/*.jsonl, 스크린샷: qa/screenshots/003/M7c-<케이스ID>[-<접미>].png
// M4 공용(m4-lib)의 도구(실행·콘솔 수집·시드 고정·화면 열기)를 그대로 쓰고, 케이스·스크린샷·결과 위치만 M7c로 바꾼다.
// 환경: PROD(vite preview 4899, base /spoongame/) = 사람처럼 조작하는 대상, DEV(5899) = 상태 만들기 오라클(core를 브라우저에서 불러 쓴다)과 ?__quota 탐침뿐.
import fs from 'node:fs';
import path from 'node:path';
import { con, ROOT, PROD, DEV, GAME_KEY, SETTINGS_KEY, launch, sleep, mkctx, fixSeed, cleanStorageOnce, openTitle, toRoulette, skipToBirth, birthToLife, newGameToLife, waitGuard, readRaw, saveJson, overflowX, whichScreen, bodyText, pickEra, readBirth, readDash, setRootFont, rand, VP, TOUCH, STD_VIEWPORTS, parseRgb } from './m4-lib.mjs';

export { con, ROOT, PROD, DEV, GAME_KEY, SETTINGS_KEY, launch, sleep, mkctx, fixSeed, cleanStorageOnce, openTitle, toRoulette, skipToBirth, birthToLife, newGameToLife, waitGuard, readRaw, saveJson, overflowX, whichScreen, bodyText, pickEra, readBirth, readDash, setRootFont, rand, VP, TOUCH, STD_VIEWPORTS, parseRgb };

export const SHOT_PREFIX = process.env.QA_SHOT_PREFIX || 'M7c';
export const SHOT_DIR = path.join(ROOT, 'qa', 'screenshots', '003');
export const OUT = process.env.QA_OUT ? path.resolve(ROOT, process.env.QA_OUT) : path.join(ROOT, 'qa', 'results', 'm7c');
fs.mkdirSync(SHOT_DIR, { recursive: true });
fs.mkdirSync(OUT, { recursive: true });

export const SAVE_VERSION = 8;
export const SETTINGS_VERSION = 4;

export async function shot(page, id, suffix = '', opts = {}) {
  const name = `${SHOT_PREFIX}-${id}${suffix ? '-' + suffix : ''}.png`;
  await page.screenshot({ path: path.join(SHOT_DIR, name), fullPage: !!opts.full });
  return `qa/screenshots/003/${name}`;
}

export const CASES = process.env.QA_CASES || path.join(OUT, 'cases.jsonl');

const scrub = (t) => t.split(ROOT).join('<repo>').replace(/[A-Za-z]:[\\/][^\s)'"]*/g, '<path>').replace(/file:\/\/\/[^\s)'"]*/g, '<file>');

/** 케이스 하나를 돌리고 결과를 cases.jsonl에 쌓는다. fn은 { verdict, actual, shots } 를 돌려준다. */
export async function runCase(c, fn) {
  con.take();
  con.takeRequests();
  const t0 = Date.now();
  let r;
  try {
    r = await fn();
  } catch (e) {
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
export function writeJson(file, obj) {
  fs.writeFileSync(path.join(OUT, file), JSON.stringify(obj, null, 1));
}

/** 개발 서버의 core 모듈을 브라우저에서 불러 순수 함수를 실행한다(상태 만들기용 오라클, 앱 코드는 그대로). 개발 서버 페이지에서만 */
export async function evalCore(page, body, arg = null) {
  return page.evaluate(`(async () => {
    const core = await import('/src/core/index.ts');
    const arg = ${JSON.stringify(arg)};
    ${body}
  })()`);
}

export function settingsEnvelope(s = {}) {
  return JSON.stringify({ version: SETTINGS_VERSION, data: { era: 'present', lifeLength: 'short30', bgm: { on: false, volume: 30 }, theme: 'system', speed: 1, autoMode: false, noteCards: true, ...s } });
}
export const SET_MANUAL = { speed: 1, autoMode: false, noteCards: true };
export const SET_AUTO = { speed: 1, autoMode: true, noteCards: true };
export const SET_OFF = { speed: 1, autoMode: false, noteCards: false };

/** 오라클 페이지(개발 서버)를 연다 */
export async function openOracle(browser) {
  const ctx = await mkctx(browser);
  const page = await ctx.newPage();
  await page.goto(DEV, { waitUntil: 'load' });
  await page.waitForSelector('[data-testid="title-screen"]');
  return { ctx, page };
}

/**
 * 기록 카드가 없는 평범한 인생 상태(대기 중인 선택지 없음) — 기록 시트는 「생각 남기기」 버튼으로만 열린다.
 * 일시정지 상태로 만들어 시계가 흐르지 않게 한다. 자동 카드 7종은 모두 본 것으로 표시해 두어 어느 나이든 저절로 뜨지 않는다(seenAll).
 */
export async function plainLife(oracle, { era = 'present', seed = 4242, age = 9, paused = true, seenAll = true } = {}) {
  return evalCore(
    oracle,
    `let s = core.enterLife(core.enterBirth(core.beginBirth(core.createInitialState(arg.seed), arg.era)));
     for (let g = 0; g < 200 && s.phase === 'life' && !(s.age >= arg.age && s.pending === null); g++) {
       s = core.advanceUntilDecision(s, undefined, 'consume').state;
       if (s.phase !== 'life') break;
       if (s.pending !== null) s = core.resolveChoice(s, s.pending.key, s.pending.choiceIds[0]);
       else if (s.age < arg.age) s = core.stepYear(s).state;
     }
     if (arg.seenAll) {
       const seen = { ...s.seen };
       for (const id of ['note-infant-memory','note-teen-envy','note-first-love','note-youth-romance','note-illness','note-parents-aging','note-midlife']) if (seen[id] === undefined) seen[id] = s.age;
       s = { ...s, seen };
     }
     return { ...s, paused: arg.paused };`,
    { era, seed, age, paused, seenAll },
  );
}

/** 카드(id)가 뜰 차례인 상태. 선택지는 첫 선택지로 넘기고 카드는 소비하며 앞서 간다. 변형 조건을 걸 수 있다(flag: 이 플래그가 켜져 있거나 없어야 한다) */
export async function dueStateFor(oracle, cardId, { era = 'present', from = 1, to = 4000, requireFlag = null, forbidFlag = null, paused = true } = {}) {
  return evalCore(
    oracle,
    `for (let seed = arg.from; seed < arg.to; seed++) {
       let s = core.enterLife(core.enterBirth(core.beginBirth(core.createInitialState(seed), arg.era)));
       for (let g = 0; g < 900 && s.phase === 'life'; g++) {
         if (s.pending !== null) { s = core.resolveChoice(s, s.pending.key, s.pending.choiceIds[0]); continue; }
         const due = core.dueNote(s);
         if (due !== null) {
           if (due.id === arg.cardId) {
             const f = s.flags || [];
             const has = (n) => Array.isArray(f) ? f.includes(n) : !!f[n];
             if ((arg.requireFlag === null || has(arg.requireFlag)) && (arg.forbidFlag === null || !has(arg.forbidFlag))) return { ...s, paused: arg.paused };
           }
           s = core.consumeNote(s, due);
         }
         s = core.stepYear(s).state;
       }
     }
     return null;`,
    { cardId, era, from, to, requireFlag, forbidFlag, paused },
  );
}

/** 저장을 심어 prod(또는 base)를 연다 — 컨텍스트 초기화 스크립트로 한 번만 심으므로(sessionStorage 표식) 새로고침은 저장을 덮지 않는다 */
export async function openSeeded(browser, state, { base = PROD, query = '', vp = { width: 360, height: 740 }, touch = true, settings = SET_MANUAL, extraCtx = {}, init = null, hidden = false, wait = '[data-testid="life-screen"]', localFlag = false } = {}) {
  const ctx = await mkctx(browser, { viewport: { width: vp.width, height: vp.height }, ...(touch ? TOUCH : {}), ...extraCtx });
  await ctx.addInitScript(
    ([k, v, sk, sv, hid, lf]) => {
      try {
        const store = lf ? localStorage : sessionStorage;
        if (!store.getItem('__qa_seeded')) {
          localStorage.clear();
          if (v) localStorage.setItem(k, v);
          if (sv) localStorage.setItem(sk, sv);
          store.setItem('__qa_seeded', '1');
        }
      } catch {}
      if (hid) {
        window.__vis = 'hidden';
        Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => window.__vis });
      }
    },
    [GAME_KEY, state ? JSON.stringify({ version: SAVE_VERSION, data: state }) : '', SETTINGS_KEY, settingsEnvelope(settings), hidden, localFlag],
  );
  if (init) await ctx.addInitScript(init);
  const page = await ctx.newPage();
  await page.goto(base + query, { waitUntil: 'load' });
  if (wait) await page.waitForSelector(wait, { timeout: 15000 });
  await sleep(250);
  return { ctx, page };
}

// ------------------------------------------------------------------ 읽기 도우미

/** 지금 화면의 기록 시트를 읽는다 */
export const READ_NOTE = () => {
  const q = (s) => document.querySelector(s);
  const qa = (s) => [...document.querySelectorAll(s)];
  const tx = (e) => (e ? e.textContent.replace(/\s+/g, ' ').trim() : null);
  const sheet = q('[data-testid="note-sheet"]');
  const rect = (el) => {
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: Math.round(r.x * 10) / 10, y: Math.round(r.y * 10) / 10, w: Math.round(r.width * 10) / 10, h: Math.round(r.height * 10) / 10, b: Math.round(r.bottom * 10) / 10, r: Math.round(r.right * 10) / 10 };
  };
  const byIds = (ids) => (ids || '').split(/\s+/).filter(Boolean).map((i) => tx(document.getElementById(i))).filter(Boolean).join(' ');
  const input = q('[data-testid="note-input"]');
  const active = document.activeElement;
  const cite = q('[data-testid="cite"]');
  const save = q('[data-testid="note-save"]');
  const skip = q('[data-testid="note-skip"]');
  const confirmEl = q('[data-testid="note-confirm"]');
  return {
    present: !!sheet,
    via: sheet ? sheet.getAttribute('data-via') : null,
    card: sheet ? sheet.getAttribute('data-card') : null,
    compact: sheet ? sheet.getAttribute('data-compact') : null,
    sheetClass: sheet ? sheet.className : null,
    kind: tx(q('#nc-kind')),
    title: tx(q('[data-testid="note-title"]')),
    when: tx(q('[data-testid="note-when"]')),
    dialogName: sheet ? byIds(sheet.getAttribute('aria-labelledby')) : null,
    cite: cite ? { id: cite.getAttribute('data-citation'), text: tx(cite), links: cite.querySelectorAll('a, [href]').length } : null,
    inputValue: input ? input.value : null,
    inputReadOnly: input ? input.readOnly : null,
    inputInvalid: input ? input.getAttribute('aria-invalid') : null,
    inputDescribed: input ? byIds(input.getAttribute('aria-describedby')) : null,
    inputFont: input ? parseFloat(getComputedStyle(input).fontSize) : null,
    inputDir: input ? input.getAttribute('dir') : null,
    inputName: input ? input.getAttribute('name') : null,
    inputMax: input ? input.getAttribute('maxlength') : null,
    inInForm: input ? !!input.closest('form') : null,
    hint: tx(q('[data-testid="note-hint"]')),
    count: tx(q('[data-testid="note-count"]')),
    countSr: tx(q('[data-testid="note-count-sr"]')),
    msg: tx(q('[data-testid="note-msg"]')),
    msgError: q('[data-testid="note-msg"]') ? q('[data-testid="note-msg"]').className.includes('error') : null,
    notice: tx(q('[data-testid="note-notice"]')),
    toggle: tx(q('[data-testid="note-cards-toggle"]')),
    saveName: save ? byIds(save.getAttribute('aria-labelledby')) : null,
    saveDisabled: save ? save.getAttribute('aria-disabled') === 'true' || save.disabled : null,
    skipName: skip ? byIds(skip.getAttribute('aria-labelledby')) : null,
    skipDisabled: skip ? skip.getAttribute('aria-disabled') === 'true' || skip.disabled : null,
    confirm: confirmEl ? { title: tx(q('#nc-confirm-t')), sub: tx(q('.note-confirm__sub')), discard: tx(q('[data-testid="note-confirm-discard"]')), back: tx(q('[data-testid="note-confirm-back"]')) } : null,
    limitSub: tx(q('[data-testid="note-limit-sub"]')),
    limitClose: !!q('[data-testid="note-limit-close"]'),
    activeTid: active ? active.getAttribute('data-testid') || active.id || active.tagName : 'none',
    sheetRect: rect(sheet),
    overlayRect: rect(q('[data-testid="note-overlay"]')),
    inputRect: rect(input),
    saveRect: rect(save),
    skipRect: rect(skip),
    toggleRect: rect(q('[data-testid="note-cards-toggle"]')),
    sheetScrollable: sheet ? sheet.scrollHeight - sheet.clientHeight : null,
    sheetScrollTop: sheet ? sheet.scrollTop : null,
    scrollY: window.scrollY,
    docOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    htmlClass: document.documentElement.className,
    dialogCount: qa('[role="dialog"]').length,
    choiceSheet: !!q('[data-testid="choice-panel"]'),
  };
};
export const readNote = (page) => page.evaluate(READ_NOTE);

/** 인생 기록(로그)의 기록 줄들 */
export const READ_LOG = () => {
  const tx = (e) => (e ? e.textContent.replace(/\s+/g, ' ').trim() : null);
  return [...document.querySelectorAll('[data-testid="log-row"]')].map((r) => {
    const label = r.querySelector('[data-testid="note-label"]');
    const text = r.querySelector('[data-testid="note-text"]');
    const rr = r.getBoundingClientRect();
    return {
      isNote: !!label,
      row: tx(r),
      label: tx(label),
      text: text ? text.textContent : null,
      textChildren: text ? text.children.length : null,
      hasAnchor: r.querySelectorAll('a, img, script').length,
      rect: { x: Math.round(rr.x), y: Math.round(rr.y), w: Math.round(rr.width), h: Math.round(rr.height), r: Math.round(rr.right) },
    };
  });
};
export const readLog = (page) => page.evaluate(READ_LOG);

/** 결정 카드(중대 결정 시트·접힌 띠·인라인) 간이 읽기 */
export const READ_CARD = () => {
  const q = (s) => document.querySelector(s);
  const qa = (s) => [...document.querySelectorAll(s)];
  const tx = (e) => (e ? e.textContent.replace(/\s+/g, ' ').trim() : null);
  const panel = q('[data-testid="choice-panel"]');
  const fold = q('[data-testid="decision-fold"]');
  const cite = q('[data-testid="cite"]');
  const choices = panel
    ? [...panel.querySelectorAll('.choice')].map((b) => ({ id: (b.getAttribute('data-testid') || '').replace('choice-', ''), label: tx(b.querySelector('.choice__label')), disabled: b.getAttribute('aria-disabled') === 'true' || b.disabled === true }))
    : [];
  const active = document.activeElement;
  const screen = ['title-screen', 'roulette-screen', 'birth-screen', 'life-screen', 'ending-screen', 'superseded-screen', 'error-screen'].find((id) => q(`[data-testid="${id}"]`)) || 'unknown';
  return {
    screen,
    mode: panel ? panel.getAttribute('data-mode') : fold ? 'fold' : null,
    key: panel ? panel.getAttribute('data-key') : fold ? fold.getAttribute('data-key') : null,
    title: tx(q('[data-testid="choice-title"]')) ?? tx(q('[data-testid="decision-fold-title"]')),
    cite: cite ? { id: cite.getAttribute('data-citation'), text: tx(cite) } : null,
    choices,
    age: q('[data-testid="life-age"] b') ? parseInt(q('[data-testid="life-age"] b').textContent, 10) : null,
    year: tx(q('[data-testid="life-year"]')),
    pct: q('[data-testid="year-progress"]') ? q('[data-testid="year-progress"]').getAttribute('aria-valuenow') : null,
    paused: q('[data-testid="pause"]') ? q('[data-testid="pause"]').getAttribute('data-paused') : null,
    auto: q('[data-testid="auto"]') ? q('[data-testid="auto"]').getAttribute('aria-pressed') : null,
    skipDisabled: q('[data-testid="skip"]') ? q('[data-testid="skip"]').getAttribute('aria-disabled') : null,
    noteSheet: !!q('[data-testid="note-sheet"]'),
    activeTid: active ? active.getAttribute('data-testid') || active.id || active.tagName : 'none',
    dialogCount: qa('[role="dialog"]').length,
    exitAsk: !!q('[data-testid="exit-ask"]'),
    saveNotice: !!q('[data-testid="save-notice"]'),
    toolNoteText: tx(q('[data-testid="tool-note"]')),
    toolNoteDisabled: q('[data-testid="tool-note"]') ? q('[data-testid="tool-note"]').getAttribute('aria-disabled') : null,
    scrollY: window.scrollY,
  };
};
export const readCard = (page) => page.evaluate(READ_CARD);

export async function readSave(page) {
  const raw = await page.evaluate((k) => localStorage.getItem(k), GAME_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return { __raw: raw.slice(0, 80) };
  }
}
export const noteRowsOf = (save) => (save && save.data && Array.isArray(save.data.history) ? save.data.history.filter((h) => h.kind === 'note') : []);

/** 기록 시트가 뜨고 두 버튼의 입력 가드(400ms)가 풀릴 때까지 */
export async function sheetReady(page, timeout = 8000) {
  await page.waitForSelector('[data-testid="note-sheet"]', { timeout });
  await page.waitForFunction(
    () => {
      const b = document.querySelector('[data-testid="note-save"]') || document.querySelector('[data-testid="note-limit-close"]');
      return b !== null && b.getAttribute('aria-disabled') !== 'true' && !b.disabled;
    },
    null,
    { timeout },
  );
}

/** 「생각 남기기」 버튼으로 수동 시트를 연다 */
export async function openManual(page, { touch = true } = {}) {
  const b = page.getByTestId('tool-note');
  if (touch) await b.tap();
  else await b.click();
  await sheetReady(page);
}

/** 입력란에 글을 넣는다. mode: 'type'(한 글자씩 키보드) | 'insert'(Input.insertText 한 번 = 붙여넣기에 가까움) | 'fill' */
export async function putText(page, text, mode = 'insert') {
  const input = page.getByTestId('note-input');
  await input.focus();
  if (mode === 'type') await page.keyboard.type(text, { delay: 5 });
  else if (mode === 'fill') await input.fill(text);
  else await page.keyboard.insertText(text);
  await sleep(120);
}

/** 입력란 비우기 */
export async function clearInput(page) {
  const input = page.getByTestId('note-input');
  await input.focus();
  await page.keyboard.press('Control+A');
  await page.keyboard.press('Delete');
  await sleep(80);
}

export const cps = (...a) => String.fromCodePoint(...a);

export function pidOk() {
  return true;
}

/** 저장 원문(문자열)을 그대로 심어 연다 — 변조 시험용. 어느 화면이 뜨든 기다린다 */
export async function openSeededRaw(browser, raw, { base = PROD, query = '', vp = { width: 360, height: 740 }, touch = true, settings = SET_MANUAL, extraCtx = {} } = {}) {
  const ctx = await mkctx(browser, { viewport: { width: vp.width, height: vp.height }, ...(touch ? TOUCH : {}), ...extraCtx });
  await ctx.addInitScript(
    ([k, v, sk, sv]) => {
      try {
        if (!sessionStorage.getItem('__qa_seeded')) {
          localStorage.clear();
          if (v !== null) localStorage.setItem(k, v);
          if (sv) localStorage.setItem(sk, sv);
          sessionStorage.setItem('__qa_seeded', '1');
        }
      } catch {}
    },
    [GAME_KEY, raw, SETTINGS_KEY, settingsEnvelope(settings)],
  );
  const page = await ctx.newPage();
  await page.goto(base + query, { waitUntil: 'load' });
  await page.waitForSelector('[data-testid="title-screen"], [data-testid="life-screen"], [data-testid="error-screen"], [data-testid="ending-screen"], [data-testid="superseded-screen"], [data-testid="birth-screen"], [data-testid="roulette-screen"]', { timeout: 15000 });
  await sleep(350);
  return { ctx, page };
}

/** 대기 중인 결정 카드가 있는 상태 (첫 선택지로 앞선 결정을 넘기고 minAge 이상에서 멈춤). era별 */
export async function pendingState(oracle, { era = 'present', seed = 4242, minAge = 10, paused = false } = {}) {
  return evalCore(
    oracle,
    `let s = core.enterLife(core.enterBirth(core.beginBirth(core.createInitialState(arg.seed), arg.era)));
     for (let g = 0; g < 200 && s.phase === 'life'; g++) {
       s = core.advanceUntilDecision(s, undefined, 'consume').state;
       if (s.phase !== 'life') break;
       if (s.pending !== null && s.age >= arg.minAge && s.pending.choiceIds.length >= 2) return { ...s, paused: arg.paused };
       if (s.pending !== null) s = core.resolveChoice(s, s.pending.key, s.pending.choiceIds[0]);
     }
     return null;`,
    { era, seed, minAge, paused },
  );
}

/** 결정 카드를 고르면 곧바로 다음 해의 기록 카드가 뜰 차례가 되는 상태 */
export async function decisionBeforeDue(oracle, { era = 'present', from = 1, paused = true } = {}) {
  return evalCore(
    oracle,
    `for (let seed = arg.from; seed < arg.from + 1500; seed++) {
       let s = core.enterLife(core.enterBirth(core.beginBirth(core.createInitialState(seed), arg.era)));
       for (let guard = 0; guard < 800 && s.phase === 'life'; guard++) {
         if (s.pending !== null) {
           const choiceId = s.pending.choiceIds[0];
           const after = core.resolveChoice(s, s.pending.key, choiceId);
           const due = after.phase === 'life' ? core.dueNote(after) : null;
           if (due !== null && s.pending.choiceIds.length >= 2) return { state: { ...s, paused: arg.paused }, choiceId, key: s.pending.key, cardId: due.id, seed };
           s = core.autoResolveStep(s, s.pending.key).state;
           continue;
         }
         const due = core.dueNote(s);
         if (due !== null) s = core.consumeNote(s, due);
         s = core.stepYear(s).state;
       }
     }
     return null;`,
    { era, from, paused },
  );
}

/** 수동 기록을 이미 count개 쌓은 상태 */
export async function withNotes(oracle, state, count, prefix = '기록 ') {
  return evalCore(
    oracle,
    `let g = arg.state;
     for (let i = 0; i < arg.count; i++) {
       const next = core.writeNote(g, { cardId: null, text: arg.prefix + (i + 1) });
       if (next === g) throw new Error('기록을 더할 수 없다: ' + i);
       g = next;
     }
     return g;`,
    { state, count, prefix },
  );
}
