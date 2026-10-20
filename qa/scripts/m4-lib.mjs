// QA-003 M4(대시보드) 공용 라이브러리. 앱 코드는 건드리지 않고 브라우저로만 조작한다.
// 결과: qa/results/m4/cases.jsonl, 스크린샷: qa/screenshots/003/M4-<케이스ID>[-<접미>].png
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';

export const ROOT = path.resolve(import.meta.dirname, '..', '..');
export const SHOT_DIR = process.env.QA_SHOT_DIR ? path.resolve(process.env.QA_SHOT_DIR) : path.join(ROOT, 'qa', 'screenshots', '003'); // QA-003 M9: QA_SHOT_DIR을 주면 세션 임시 폴더로 찍는다(PASS는 저장소에 남기지 않기 — 끝에서 FAIL·RECORD만 옮김)
export const OUT = path.join(ROOT, 'qa', 'results', 'm4');
export const PROD = process.env.QA_PROD || 'http://127.0.0.1:4899/spoongame/';
export const DEV = process.env.QA_DEV || 'http://127.0.0.1:5899/';
export const GAME_KEY = 'suzeo-game:save';
export const SETTINGS_KEY = 'suzeo-game:settings';

fs.mkdirSync(SHOT_DIR, { recursive: true });
fs.mkdirSync(OUT, { recursive: true });

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export const launch = (opts = {}) => chromium.launch({ headless: true, ...opts });

export const VP = {
  m360: { width: 360, height: 740 },
  m320: { width: 320, height: 568 },
  m375: { width: 375, height: 812 },
  t768: { width: 768, height: 1024 },
  d1280: { width: 1280, height: 800 },
  d1024: { width: 1024, height: 768 },
  d1280low: { width: 1280, height: 620 },
};
export const TOUCH = { hasTouch: true, isMobile: true, deviceScaleFactor: 2 };

/** 공통 뷰포트 11종 (SPEC QM2-1 (a)) */
export const STD_VIEWPORTS = [
  { name: '320x568', width: 320, height: 568 },
  { name: '360x568', width: 360, height: 568 },
  { name: '360x740-touch', width: 360, height: 740, touch: true },
  { name: '375x812', width: 375, height: 812 },
  { name: '667x375-landscape', width: 667, height: 375 },
  { name: '768x1024', width: 768, height: 1024 },
  { name: '1024x768', width: 1024, height: 768 },
  { name: '1280x620', width: 1280, height: 620 },
  { name: '1280x800', width: 1280, height: 800 },
  { name: '640x400-zoom200', width: 640, height: 400, zoom: true },
  { name: '320x256-zoom400', width: 320, height: 256, zoom: true },
];

export class Con {
  constructor() {
    this.items = [];
    this.requests = [];
  }
  attach(page, label = '') {
    page.on('console', (m) => {
      const t = m.type();
      if (t === 'error' || t === 'warning') this.items.push({ type: t, text: m.text().slice(0, 300), label });
    });
    page.on('pageerror', (e) => this.items.push({ type: 'pageerror', text: String(e && e.message ? e.message : e).slice(0, 300), label }));
    page.on('requestfailed', (r) => {
      const f = r.failure();
      this.items.push({ type: 'requestfailed', text: `${r.url().slice(0, 120)} ${f ? f.errorText : ''}`, label });
    });
    page.on('request', (r) => this.requests.push(r.url()));
    page.on('dialog', (d) => {
      this.items.push({ type: 'dialog', text: `${d.type()}: ${d.message().slice(0, 100)}`, label });
      d.dismiss().catch(() => {});
    });
  }
  take() {
    const a = this.items;
    this.items = [];
    return a;
  }
  takeRequests() {
    const a = this.requests;
    this.requests = [];
    return a;
  }
}
export const con = new Con();

export async function mkctx(browser, opts = {}) {
  const ctx = await browser.newContext({ viewport: VP.m360, locale: 'ko-KR', ...opts });
  ctx.on('page', (p) => con.attach(p, 'tab'));
  return ctx;
}

/** 새 판의 시드를 고정한다 — 앱이 시드를 뽑는 `crypto.getRandomValues(Uint32Array(1))`만 바꾼다(앱 코드는 그대로). */
export async function fixSeed(ctx, seed) {
  await ctx.addInitScript((s) => {
    const orig = crypto.getRandomValues.bind(crypto);
    crypto.getRandomValues = (buf) => {
      if (buf instanceof Uint32Array && buf.length === 1) {
        buf[0] = s >>> 0;
        return buf;
      }
      return orig(buf);
    };
  }, seed);
}

export async function cleanStorageOnce(ctx) {
  await ctx.addInitScript(() => {
    try {
      if (!sessionStorage.getItem('__qa_cleaned')) {
        localStorage.clear();
        sessionStorage.setItem('__qa_cleaned', '1');
      }
    } catch {}
  });
}

export async function shot(page, id, suffix = '', opts = {}) {
  const name = `M4-${id}${suffix ? '-' + suffix : ''}.png`;
  await page.screenshot({ path: path.join(SHOT_DIR, name), fullPage: !!opts.full });
  return `qa/screenshots/003/${name}`;
}

export const CASES = process.env.QA_CASES || path.join(OUT, 'cases.jsonl');
export async function runCase(c, fn) {
  con.take();
  con.takeRequests();
  const t0 = Date.now();
  let r;
  try {
    r = await fn();
  } catch (e) {
    r = { verdict: 'ERROR', actual: `스크립트 오류: ${String(e && e.stack ? e.stack : e).slice(0, 700)}`, shots: [] };
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

export async function openTitle(page, base = PROD, query = '') {
  await page.goto(base + query, { waitUntil: 'load' });
  await page.waitForSelector('[data-testid="title-screen"]', { timeout: 15000 });
}

export async function waitGuard(page, testid) {
  await page.waitForFunction(
    (t) => {
      const b = document.querySelector(`[data-testid="${t}"]`);
      return b !== null && b.getAttribute('aria-disabled') !== 'true' && !b.disabled;
    },
    testid,
    { timeout: 6000 },
  );
}

export const readRaw = (page, key = GAME_KEY) => page.evaluate((k) => localStorage.getItem(k), key);

export async function saveJson(page, key = GAME_KEY) {
  const raw = await readRaw(page, key);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return { __raw: raw.slice(0, 80) };
  }
}

export async function overflowX(page) {
  return page.evaluate(() => {
    const r = document.documentElement;
    return { overflow: r.scrollWidth > r.clientWidth, scrollW: r.scrollWidth, clientW: r.clientWidth };
  });
}

export const SCREENS = ['title-screen', 'roulette-screen', 'birth-screen', 'life-screen', 'ending-screen', 'superseded-screen', 'error-screen'];
export async function whichScreen(page) {
  return page.evaluate((ids) => {
    for (const id of ids) if (document.querySelector(`[data-testid="${id}"]`)) return id;
    return document.body.innerText.trim() === '' ? 'BLANK' : 'unknown';
  }, SCREENS);
}

export const bodyText = (page) => page.evaluate(() => document.body.innerText);

export async function pickEra(page, era) {
  await waitGuard(page, 'start-birth');
  await page.locator(`[data-testid="era-${era}"]`).click();
  await sleep(120);
}

export async function toRoulette(page, era = 'present') {
  if (era !== 'present') await pickEra(page, era);
  await waitGuard(page, 'start-birth');
  await page.getByTestId('start-birth').click();
  await page.waitForSelector('[data-testid="roulette-screen"]', { timeout: 8000 });
}

export async function skipToBirth(page) {
  await waitGuard(page, 'skip-roulette').catch(() => {});
  const hasSkip = await page.locator('[data-testid="skip-roulette"]').count();
  if (hasSkip) await page.getByTestId('skip-roulette').click();
  await page.waitForSelector('[data-testid="to-birth"]', { timeout: 6000 });
  await waitGuard(page, 'to-birth');
  await page.getByTestId('to-birth').click();
  await page.waitForSelector('[data-testid="birth-screen"]', { timeout: 6000 });
}

export async function birthToLife(page) {
  await waitGuard(page, 'next-life');
  await page.getByTestId('next-life').click();
  await page.waitForSelector('[data-testid="life-screen"]', { timeout: 6000 });
}

/** 첫 화면에서 대시보드까지. 새 판. */
export async function newGameToLife(page, { era = 'present', base = PROD, query = '' } = {}) {
  await openTitle(page, base, query);
  await toRoulette(page, era);
  await skipToBirth(page);
  await birthToLife(page);
}

export function parseRgb(s) {
  const m = /rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)/.exec(s);
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
}

export async function readBirth(page) {
  return page.evaluate(() => {
    const q = (s) => document.querySelector(s);
    const tx = (s) => (q(s) ? q(s).textContent.replace(/\s+/g, ' ').trim() : null);
    const fields = {};
    for (const f of document.querySelectorAll('[data-testid^="birth-field-"]')) {
      const id = f.getAttribute('data-testid').replace('birth-field-', '');
      fields[id] = { label: f.querySelector('dt')?.textContent.trim(), value: f.querySelector('dd')?.textContent.replace(/\s+/g, ' ').trim() };
    }
    return {
      name: tx('[data-testid="birth-name"]'),
      sentence: tx('[data-testid="birth-sentence"]'),
      fields,
      peers: [...document.querySelectorAll('[data-testid="peer"]')].map((p) => ({
        name: p.querySelector('[data-testid="peer-name"]')?.textContent.trim(),
        gender: p.querySelector('[data-testid="peer-gender"]')?.textContent.trim(),
        place: p.querySelector('[data-testid="peer-place"]')?.textContent.replace(/\s+/g, ' ').trim(),
        chip: p.textContent.replace(/\s+/g, ' ').trim(),
      })),
      peersNote: tx('[data-testid="peers-card"] .card__note'),
      bodyText: document.body.innerText,
    };
  });
}

/** 대시보드 상태 읽기 */
export async function readDash(page) {
  return page.evaluate(() => {
    const q = (s) => document.querySelector(s);
    const qa = (s) => [...document.querySelectorAll(s)];
    const tx = (s) => (q(s) ? q(s).textContent.replace(/\s+/g, ' ').trim() : null);
    const rect = (el) => {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) };
    };
    const fill = q('[data-testid="year-progress-fill"]');
    const bar = q('[data-testid="year-progress"]');
    return {
      screen: ['title-screen', 'roulette-screen', 'birth-screen', 'life-screen', 'ending-screen', 'superseded-screen', 'error-screen'].find((id) => q(`[data-testid="${id}"]`)) || 'unknown',
      name: tx('[data-testid="life-name"]'),
      age: q('[data-testid="life-age"] b') ? parseInt(q('[data-testid="life-age"] b').textContent, 10) : null,
      year: tx('[data-testid="life-year"]'),
      pct: tx('[data-testid="year-pct"]'),
      barNow: bar?.getAttribute('aria-valuenow') ?? null,
      barText: bar?.getAttribute('aria-valuetext') ?? null,
      fillStyle: fill ? fill.getAttribute('style') : null,
      fillW: fill ? Math.round(fill.getBoundingClientRect().width) : null,
      barW: bar ? Math.round(bar.getBoundingClientRect().width) : null,
      speed: q('[data-speed][aria-pressed="true"]')?.getAttribute('data-speed') ?? null,
      auto: q('[data-testid="auto"]')?.getAttribute('aria-pressed') ?? null,
      autoText: tx('[data-testid="auto"]'),
      paused: q('[data-testid="pause"]')?.getAttribute('data-paused') ?? null,
      pauseText: tx('[data-testid="pause"]'),
      skipDisabled: q('[data-testid="skip"]')?.getAttribute('aria-disabled') ?? null,
      hasChoice: !!q('[data-testid="choice-panel"]'),
      choiceTitle: tx('[data-testid="choice-title"]'),
      logRows: qa('[data-testid="log-row"]').length,
      logLast: qa('[data-testid="log-row"]').slice(-1).map((r) => r.textContent.replace(/\s+/g, ' ').trim())[0] ?? null,
      bgmOn: q('[data-testid="tool-bgm"]')?.getAttribute('aria-pressed') ?? null,
      darkOn: q('[data-testid="tool-dark"]')?.getAttribute('aria-pressed') ?? null,
      noteDisabled: q('[data-testid="tool-note"]')?.getAttribute('aria-disabled') ?? null,
      noteName: q('[data-testid="tool-note"]')?.textContent.replace(/\s+/g, ' ').trim() ?? null,
      exitAsk: !!q('[data-testid="exit-ask"]'),
      faceRect: rect(q('[data-testid="profile-card"] [data-testid="face"]') || q('[data-testid="profile-card"] .face')),
      theme: document.documentElement.getAttribute('data-theme'),
      docOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    };
  });
}

export async function setRootFont(page, pct) {
  await page.evaluate((p) => {
    let st = document.getElementById('__qa_font');
    if (!st) {
      st = document.createElement('style');
      st.id = '__qa_font';
      document.head.appendChild(st);
    }
    st.textContent = p === 100 ? '' : `html { font-size: ${p}% !important; }`;
  }, pct);
}

export const rand = (seed) => {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

export function appendJsonl(file, obj) {
  fs.appendFileSync(path.join(OUT, file), JSON.stringify(obj) + '\n');
}
