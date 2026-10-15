// QA-003 M2(첫 화면·가상 인구·통계 캐러셀) 공용 라이브러리. 앱 코드는 건드리지 않고 브라우저로만 조작한다.
// 결과: qa/results/m2/cases.jsonl, 스크린샷: qa/screenshots/003/M2-<케이스ID>[-<접미>].png
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';

export const ROOT = path.resolve(import.meta.dirname, '..', '..');
export const SHOT_DIR = path.join(ROOT, 'qa', 'screenshots', '003');
export const OUT = path.join(ROOT, 'qa', 'results', 'm2');
export const PROD = process.env.QA_PROD || 'http://127.0.0.1:4299/spoongame/';
export const DEV = process.env.QA_DEV || 'http://127.0.0.1:5299/';
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

// ---------- 콘솔·네트워크 수집 ----------
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

// ---------- 스크린샷 ----------
export async function shot(page, id, suffix = '', opts = {}) {
  const name = `M2-${id}${suffix ? '-' + suffix : ''}.png`;
  await page.screenshot({ path: path.join(SHOT_DIR, name), fullPage: !!opts.full });
  return `qa/screenshots/003/${name}`;
}

// ---------- 결과 기록 ----------
export const CASES = path.join(OUT, 'cases.jsonl');
/** c: {id, cat, title, steps, expected} ; fn -> {actual, verdict: PASS|FAIL|RECORD|SKIP, severity?, shots?, note?} */
export async function runCase(c, fn) {
  con.take();
  con.takeRequests();
  const t0 = Date.now();
  let r;
  try {
    r = await fn();
  } catch (e) {
    r = { verdict: 'ERROR', actual: `스크립트 오류: ${String(e && e.message ? e.message : e).slice(0, 500)}`, shots: [] };
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
  console.log(`[${r.verdict}] ${c.id} ${c.title} :: ${String(r.actual || '').slice(0, 260)}${consoleItems.length ? ` (console ${consoleItems.length})` : ''}${ext.length ? ` (외부요청 ${ext.length})` : ''}`);
  return rec;
}

// ---------- 화면 조작 ----------
export async function openTitle(page, base = PROD, query = '') {
  await page.goto(base + query, { waitUntil: 'load' });
  await page.waitForSelector('[data-testid="title-screen"]', { timeout: 15000 });
  await page.waitForFunction(() => !document.querySelector('[data-testid="start-birth"]')?.hasAttribute('aria-disabled') || document.querySelector('[data-testid="start-birth"]')?.getAttribute('aria-disabled') !== 'true', null, { timeout: 5000 }).catch(() => {});
}

/** 첫 화면의 입력 가드(약 0.4초)가 풀릴 때까지 */
export async function waitGuard(page, testid = 'start-birth') {
  await page.waitForFunction((t) => {
    const b = document.querySelector(`[data-testid="${t}"]`);
    return b !== null && b.getAttribute('aria-disabled') !== 'true' && !b.disabled;
  }, testid, { timeout: 5000 });
}

export const readRaw = (page, key = GAME_KEY) => page.evaluate((k) => localStorage.getItem(k), key);

export async function overflowX(page) {
  return page.evaluate(() => {
    const r = document.documentElement;
    return { overflow: r.scrollWidth > r.clientWidth, scrollW: r.scrollWidth, clientW: r.clientWidth };
  });
}

/** 현재 화면 식별 */
export async function whichScreen(page) {
  return page.evaluate(() => {
    const ids = ['title-screen', 'birth-screen', 'life-screen', 'ending-screen', 'superseded-screen', 'error-screen'];
    for (const id of ids) if (document.querySelector(`[data-testid="${id}"]`)) return id;
    return document.body.innerText.trim() === '' ? 'BLANK' : 'unknown';
  });
}

export async function bodyText(page) {
  return page.evaluate(() => document.body.innerText);
}

/** 색 문자열 rgb(...) → [r,g,b] */
export function parseRgb(s) {
  const m = /rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)/.exec(s);
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
}
export const luminance = ([r, g, b]) => 0.2126 * r + 0.7152 * g + 0.0722 * b;

export function sumKind(arr, key) {
  const o = {};
  for (const x of arr) o[x[key]] = (o[x[key]] || 0) + 1;
  return o;
}

// ---------- 게임 진행 도우미 ----------
export async function lifeInfo(page) {
  return page.evaluate(() => {
    const q = (s) => document.querySelector(s);
    const txt = (s) => (q(s) ? q(s).textContent.trim() : null);
    return {
      screen: ['title-screen', 'birth-screen', 'life-screen', 'ending-screen', 'superseded-screen', 'error-screen'].find((id) => q(`[data-testid="${id}"]`)) || 'unknown',
      name: txt('[data-testid="life-name"]') || txt('[data-testid="birth-name"]') || txt('[data-testid="ending-name"]'),
      age: q('[data-testid="life-age"] strong') ? parseInt(q('[data-testid="life-age"] strong').textContent, 10) : null,
      speed: q('[data-speed][aria-pressed="true"]')?.getAttribute('data-speed') ?? null,
      auto: q('[data-testid="auto"]')?.getAttribute('aria-pressed') ?? null,
      hasChoice: !!q('[data-testid="choice-panel"]'),
    };
  });
}

/** 첫 화면에서 태어나기 → 출생 화면 → 살아가기 → 인생 화면 */
export async function startToLife(page) {
  await waitGuard(page, 'start-birth');
  await page.getByTestId('start-birth').click();
  await page.waitForSelector('[data-testid=birth-screen]', { timeout: 8000 });
  await waitGuard(page, 'next-life');
  await page.getByTestId('next-life').click();
  await page.waitForSelector('[data-testid=life-screen]', { timeout: 8000 });
}

/** 인생 화면에서 조건을 만족할 때까지 진행(선택지가 뜨면 첫 선택지를 고른다). until(info) → true면 멈춘다. */
export async function driveLife(page, until, timeoutMs = 240000) {
  const t0 = Date.now();
  for (;;) {
    const info = await lifeInfo(page);
    if (until(info)) return info;
    if (Date.now() - t0 > timeoutMs) throw new Error(`driveLife 시간 초과 ${JSON.stringify(info)}`);
    if (info.screen === 'life-screen' && info.hasChoice && info.auto !== 'true') {
      const btn = page.locator('[data-testid="choice-panel"] .choice-list button').first();
      try {
        await page.waitForFunction(() => {
          const b = document.querySelector('[data-testid="choice-panel"] .choice-list button');
          return b && b.getAttribute('aria-disabled') !== 'true';
        }, null, { timeout: 3000 });
        await btn.click({ timeout: 3000 });
      } catch {}
    }
    await sleep(120);
  }
}

export async function setSpeed(page, n) {
  await page.waitForFunction(() => document.querySelector('[data-speed="1"]')?.getAttribute('aria-disabled') !== 'true');
  await page.locator(`[data-speed="${n}"]`).click();
}

export async function saveInfo(page) {
  const raw = await readRaw(page);
  if (!raw) return null;
  try {
    const j = JSON.parse(raw);
    return { version: j.version, phase: j.data?.phase, age: j.data?.age, name: j.data?.character?.name, birthYear: j.data?.character?.birthYear, era: j.data?.era, lifeLength: j.data?.lifeLength, history: j.data?.history?.length, seed: j.data?.seed };
  } catch {
    return { raw: raw.slice(0, 60) };
  }
}
